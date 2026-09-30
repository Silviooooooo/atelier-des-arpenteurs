// Contrôles du site (SPECIFICATION.md, § 7, § 9, § 10.1 et § 11, domaine
// « Site ») : la page et sa politique de sécurité, le graphe de ses modules,
// le manifeste et les icônes de l'écran d'accueil, les jetons et leurs
// contrastes, la banque de démonstration et le chargement. Les écrans
// eux-mêmes s'essaient à la main, dans le navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateSync, crc32 } from "node:zlib";
import { CHEMINS, MOT_DE_PASSE_DEMO, demanderStockageDurable, empreinteCourte, modeDe, ouvrirAvecCoffre, ouvrirParMotDePasse, telecharger } from "../js/banque/chargement.js";
import { importerFichier } from "../js/banque/importation.js";
import { preparerPublication } from "../js/publication/preparation.js";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";
import { LONGUEUR_MINIMALE, normaliserMotDePasse, nouveauSecret, ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { COTE, QUADRILATERES, couleursDesJetons, pixels, svg } from "../outils/icones.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const existe = (chemin) => existsSync(new URL(chemin, RACINE));
const INDEX = lire("index.html");
const JETONS = lire("css/jetons.css");
const ESSAI = readFileSync(new URL("essais/classeur_essai.xlsx", RACINE));

function balises(html, nom) {
  return [...html.matchAll(new RegExp(`<${nom}\\b([^>]*)>`, "gi"))].map(([, attributs]) =>
    Object.fromEntries([...attributs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, cle, valeur]) => [cle.toLowerCase(), valeur])),
  );
}

// Les jetons d'un thème : le clair, puis le sombre qui le surcharge.
function jetons(css, theme) {
  const lireBloc = (bloc) => Object.fromEntries([...bloc.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, nom, valeur]) => [nom, valeur.trim()]));
  const debutSombre = css.indexOf("@media (prefers-color-scheme: dark)");
  const clair = lireBloc(css.slice(css.indexOf(":root"), debutSombre));
  return theme === "clair" ? clair : { ...clair, ...lireBloc(css.slice(debutSombre)) };
}

function contraste(a, b) {
  const luminance = (hex) => {
    const [r, v, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * v + 0.0722 * bl;
  };
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

// Un PNG relu : signature, morceaux et leurs CRC, en-tête, pixels.
function lirePng(octets) {
  assert.deepEqual([...octets.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const morceaux = [];
  for (let position = 8; position < octets.length; ) {
    const longueur = octets.readUInt32BE(position);
    const type = octets.toString("latin1", position + 4, position + 8);
    const donnees = octets.subarray(position + 8, position + 8 + longueur);
    assert.equal(octets.readUInt32BE(position + 8 + longueur), crc32(octets.subarray(position + 4, position + 8 + longueur)), `CRC de ${type}`);
    morceaux.push({ type, donnees });
    position += 12 + longueur;
  }
  const entete = morceaux[0].donnees;
  const [largeur, hauteur] = [entete.readUInt32BE(0), entete.readUInt32BE(4)];
  const brut = inflateSync(Buffer.concat(morceaux.filter((m) => m.type === "IDAT").map((m) => m.donnees)));
  const pixelsLus = Buffer.alloc(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    assert.equal(brut[y * (largeur * 3 + 1)], 0, "filtre de ligne");
    brut.copy(pixelsLus, y * largeur * 3, y * (largeur * 3 + 1) + 1, (y + 1) * (largeur * 3 + 1));
  }
  return { types: morceaux.map((m) => m.type), largeur, hauteur, profondeur: entete[8], couleur: entete[9], pixels: pixelsLus };
}

test("site — la politique de sécurité du <meta>, avant tout script et tout style (§ 10.1)", () => {
  const meta = balises(INDEX, "meta").find((m) => m["http-equiv"] === "Content-Security-Policy");
  assert.ok(meta, "politique de sécurité absente");
  const directives = Object.fromEntries(meta.content.split(";").map((d) => d.trim().split(/\s+/)).map(([nom, ...valeurs]) => [nom, valeurs]));
  // Toute la table, et rien d'autre : une directive affaiblie, retirée ou
  // ajoutée se voit (§ 10.1).
  assert.deepEqual(directives, {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", "https://api.github.com"],
    "manifest-src": ["'self'"],
    "worker-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
  });
  assert.doesNotMatch(meta.content, /unsafe-|\*|data:|blob:/);
  const position = INDEX.indexOf("Content-Security-Policy");
  assert.ok(position < INDEX.search(/<script|<link rel="stylesheet"/), "la politique doit précéder scripts et styles");
});

test("site — le zoom n'est jamais interdit ; ni script, ni style, ni gestionnaire en ligne", () => {
  const vue = balises(INDEX, "meta").find((m) => m.name === "viewport");
  assert.match(vue.content, /width=device-width/);
  assert.doesNotMatch(vue.content, /user-scalable|maximum-scale|minimum-scale/);
  for (const script of balises(INDEX, "script")) assert.ok(script.src, "script sans src");
  assert.doesNotMatch(INDEX, /<style|\sstyle=|\son[a-z]+=/i);
});

test("site — chaque fichier que la page appelle existe", () => {
  const appels = [...balises(INDEX, "link").map((l) => l.href), ...balises(INDEX, "script").map((s) => s.src)];
  assert.ok(appels.length >= 7);
  for (const appel of appels) assert.ok(existe(appel), appel);
});

test("site — le graphe des modules de la page se résout, et atteint les douze écrans (§ 3.2)", () => {
  const vus = new Set();
  const aVoir = ["js/application.js"];
  while (aVoir.length) {
    const chemin = aVoir.pop();
    if (vus.has(chemin)) continue;
    assert.ok(existe(chemin), `module introuvable : ${chemin}`);
    vus.add(chemin);
    for (const [, cible] of lire(chemin).matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gms)) {
      assert.match(cible, /^\.\.?\//, `${chemin} importe « ${cible} », qui n'est pas un fichier du site`);
      aVoir.push(new URL(cible, new URL(chemin, "https://site/")).pathname.slice(1));
    }
  }
  const ecrans = [
    "accueil", "mot_de_passe", "liste", "fiche_bloc", "fiche_capacite", "fiche_element", "anomalies", "espace_auteur",
    "personnages", "creation", "reception", "fiche_personnage",
  ];
  for (const ecran of ecrans) assert.ok(vus.has(`js/ecrans/${ecran}.js`), ecran);
  for (const module of ["js/banque/chargement.js", "js/securite/coffre.js", "js/publication/github.js", "js/lecture/zip.js", "js/personnage/calcul.js", "js/personnage/stockage.js", "js/fiche/feuilles.js"]) {
    assert.ok(vus.has(module), module);
  }
});

test("site — le manifeste : noms, affichage, couleurs des jetons, icônes aux tailles dites", () => {
  const manifeste = JSON.parse(lire("manifest.webmanifest"));
  assert.equal(manifeste.name, "L'Atelier des Arpenteurs");
  assert.equal(manifeste.short_name, "Atelier");
  assert.equal(manifeste.display, "standalone");
  // Sans start_url, l'Atelier s'ouvre à l'adresse d'où on l'a ajouté :
  // la démonstration ajoutée à l'écran d'accueil reste la démonstration.
  assert.equal(manifeste.start_url, undefined);
  const clair = jetons(JETONS, "clair");
  assert.equal(manifeste.background_color, clair.fond);
  assert.equal(manifeste.theme_color, clair.fond);
  const tailles = new Set();
  for (const icone of manifeste.icons) {
    assert.ok(existe(icone.src), icone.src);
    if (icone.type === "image/svg+xml") {
      assert.equal(icone.sizes, "any");
      continue;
    }
    const { largeur, hauteur } = lirePng(readFileSync(new URL(icone.src, RACINE)));
    assert.equal(`${largeur}x${hauteur}`, icone.sizes, icone.src);
    tailles.add(icone.sizes);
  }
  assert.deepEqual([...tailles].sort(), ["192x192", "512x512"]);
  assert.ok(manifeste.icons.some((i) => i.purpose === "maskable"));
  const pomme = balises(INDEX, "link").find((l) => l.rel === "apple-touch-icon");
  const { largeur, hauteur } = lirePng(readFileSync(new URL(pomme.href, RACINE)));
  assert.equal(`${largeur}x${hauteur}`, "180x180");
  assert.ok(balises(INDEX, "link").some((l) => l.rel === "manifest" && l.href === "manifest.webmanifest"));
  const teintes = balises(INDEX, "meta").filter((m) => m.name === "theme-color");
  assert.deepEqual(
    teintes.map((m) => [m.media, m.content]),
    [
      ["(prefers-color-scheme: light)", clair.fond],
      ["(prefers-color-scheme: dark)", jetons(JETONS, "sombre").fond],
    ],
  );
});

test("icônes — le monogramme « AA » que dessine outils/icones.js, sans transparence", () => {
  const couleurs = couleursDesJetons(JETONS);
  assert.deepEqual(couleurs, { fond: jetons(JETONS, "clair").accent, lettres: jetons(JETONS, "clair")["texte-sur-accent"] });
  // Git peut rendre le SVG avec des fins de ligne Windows : on les ramène.
  assert.equal(lire("icones/icone.svg").replaceAll("\r\n", "\n"), svg(couleurs));
  for (const taille of [180, 192, 512]) {
    const png = lirePng(readFileSync(new URL(`icones/icone-${taille}.png`, RACINE)));
    assert.deepEqual(png.types, ["IHDR", "IDAT", "IEND"]);
    assert.deepEqual([png.largeur, png.hauteur, png.profondeur, png.couleur], [taille, taille, 8, 2]);
    assert.ok(png.pixels.equals(Buffer.from(pixels(taille, couleurs))), `icone-${taille}.png diffère : relancer node outils/icones.js`);
  }
  // Les lettres restent dans le disque que garde une découpe d'Android.
  const rayon = Math.max(...QUADRILATERES.flat().map(([x, y]) => Math.hypot(x - COTE / 2, y - COTE / 2)));
  assert.ok(rayon <= 0.4 * COTE, `rayon ${rayon}`);
});

test("jetons — le texte contraste d'au moins 4,5:1, les bordures de 3:1, dans les deux thèmes", () => {
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(JETONS, theme);
    const texte = [
      ["texte", "fond"],
      ["texte", "fond-2"],
      ["texte-2", "fond"],
      ["texte-2", "fond-2"],
      ["accent", "fond"],
      ["accent", "fond-2"],
      ["texte-sur-accent", "accent"],
      ["texte", "accent-doux"],
      ["texte-2", "accent-doux"],
      ["accent", "accent-doux"],
    ];
    for (const [avant, fond] of texte) {
      const mesure = contraste(j[avant], j[fond]);
      assert.ok(mesure >= 4.5, `${theme} : --${avant} sur --${fond}, ${mesure.toFixed(2)}:1`);
    }
    for (const fond of ["fond", "fond-2"]) assert.ok(contraste(j.bordure, j[fond]) >= 3, `${theme} : --bordure sur --${fond}`);
  }
});

test("jetons — ecran.css et personnage.css tirent toutes leurs valeurs de jetons.css ; aucune police téléchargée", () => {
  const ecran = ["css/ecran.css", "css/personnage.css"].map(lire).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const lignes = ecran.split("\n").filter((ligne) => !ligne.trim().startsWith("@media"));
  for (const ligne of lignes) {
    assert.doesNotMatch(ligne, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/i, `couleur écrite en dur : ${ligne.trim()}`);
    assert.doesNotMatch(ligne, /\d(?:px|rem|em|vh|vw|pt|ms|s)\b/, `valeur écrite en dur : ${ligne.trim()}`);
    if (/font-family:/.test(ligne)) assert.match(ligne, /font-family:\s*var\(--/);
  }
  const definis = new Set(Object.keys(jetons(JETONS, "clair")));
  for (const [, nom] of ecran.matchAll(/var\(--([\w-]+)\)/g)) assert.ok(definis.has(nom), `--${nom} n'est pas défini dans jetons.css`);
  for (const css of [ecran, JETONS]) assert.doesNotMatch(css, /@font-face|@import|url\(/);
  // Les jetons de couleur ont une valeur dans chaque thème.
  const sombre = jetons(JETONS, "sombre");
  for (const nom of ["fond", "fond-2", "texte", "texte-2", "bordure", "separateur", "accent", "texte-sur-accent", "accent-doux"]) {
    assert.match(sombre[nom], /^#[0-9a-f]{6}$/i, nom);
    assert.notEqual(sombre[nom], jetons(JETONS, "clair")[nom], `--${nom} sans valeur sombre`);
  }
});

test("démonstration — la banque se déchiffre avec le mot de passe public et vient du classeur d'essai", async () => {
  assert.ok(CHEMINS.demo.startsWith("essais/"));
  assert.ok([...MOT_DE_PASSE_DEMO].length >= LONGUEUR_MINIMALE);
  // Déjà en minuscules : la normalisation du lot 2 bis ne change pas sa clé.
  assert.equal(normaliserMotDePasse(MOT_DE_PASSE_DEMO), MOT_DE_PASSE_DEMO);
  const enveloppe = JSON.parse(lire(CHEMINS.demo));
  assert.deepEqual(Object.keys(enveloppe), ["format", "publiee_le", "empreinte", "kdf", "chiffre"]);
  assert.equal(enveloppe.format, 2);
  const { banque, erreur } = await ouvrirAvecMotDePasse(enveloppe, MOT_DE_PASSE_DEMO);
  assert.equal(erreur, undefined, erreur);
  const { banque: attendue } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const { publiee_le: date, ...reste } = banque;
  assert.equal(date, enveloppe.publiee_le);
  assert.deepEqual(reste, attendue, "banque périmée : relancer node outils/banque_demo.js");
  assert.equal((await ouvrirAvecMotDePasse(enveloppe, "un autre mot de passe de table")).code, "mot_de_passe");
});

test("démonstration — le mot de passe saisi, en majuscules comme en minuscules, ouvre la banque, et la clé gardée la rouvre", async () => {
  const enveloppe = JSON.parse(lire(CHEMINS.demo));
  const coffre = creerCoffre(magasinMemoire());
  const { banque, erreur } = await ouvrirParMotDePasse(enveloppe, MOT_DE_PASSE_DEMO.toUpperCase(), { coffre, mode: "demo", garder: true });
  assert.equal(erreur, undefined, erreur);
  assert.equal(banque.sources[0].fichier, "classeur_essai.xlsx");
  // La clé gardée l'ouvre à la visite suivante.
  assert.ok((await ouvrirAvecCoffre(enveloppe, coffre, "demo")).banque);
  // Le format 1 ne se lit plus (lot 2 bis).
  assert.deepEqual(await ouvrirAvecCoffre({ ...enveloppe, format: 1 }, coffre, "demo"), { erreur: "Le fichier de la banque est abîmé ou d'un format inconnu." });
});

test("chargement — banque absente, présente, abîmée ; un paramètre unique, sans cache (§ 8.3)", async () => {
  const enveloppe = JSON.parse(lire(CHEMINS.demo));
  const appels = [];
  const simuler = (reponse) => async (adresse, init) => {
    appels.push({ adresse, init });
    if (reponse instanceof Error) throw reponse;
    return reponse;
  };
  assert.deepEqual(await telecharger("reel", { fetch: simuler(new Response("Introuvable", { status: 404 })), maintenant: 123 }), { absente: true });
  assert.deepEqual(appels[0], { adresse: "donnees/banque.chiffree.json?v=123", init: { cache: "no-store" } });
  assert.deepEqual(await telecharger("demo", { fetch: simuler(new Response(JSON.stringify(enveloppe))), maintenant: 456 }), { enveloppe });
  assert.equal(appels[1].adresse, "essais/banque_demo.chiffree.json?v=456");
  assert.match((await telecharger("reel", { fetch: simuler(new Response("<html>")) })).erreur, /abîmé/);
  assert.match((await telecharger("reel", { fetch: simuler(new Response(JSON.stringify({ format: "x" }))) })).erreur, /format inconnu/);
  assert.match((await telecharger("reel", { fetch: simuler(new Response(JSON.stringify({ ...enveloppe, format: 9 }))) })).erreur, /rechargez la page/);
  // Format 2 : l'empreinte se vérifie dès le téléchargement, sans clé.
  const abimee = { ...enveloppe, empreinte: `sha256:${"0".repeat(64)}` };
  assert.match((await telecharger("demo", { fetch: simuler(new Response(JSON.stringify(abimee))) })).erreur, /abîmé.*empreinte/);
  assert.match((await telecharger("reel", { fetch: simuler(new Response("", { status: 503 })) })).erreur, /503/);
  assert.match((await telecharger("reel", { fetch: simuler(new TypeError("Failed to fetch")) })).erreur, /connexion/);
});

test("chargement — clé gardée, mot de passe requis ou changé ; démonstration et réel séparés", async () => {
  const enveloppe = JSON.parse(lire(CHEMINS.demo));
  const coffre = creerCoffre(magasinMemoire());
  assert.deepEqual(await ouvrirAvecCoffre(enveloppe, coffre, "demo"), { motDePasse: "requis" });
  // Sans « se souvenir », rien n'est gardé.
  assert.ok((await ouvrirParMotDePasse(enveloppe, MOT_DE_PASSE_DEMO, { coffre, mode: "demo", garder: false })).banque);
  assert.equal(await coffre.lireCle("demo"), null);
  const ouverte = await ouvrirParMotDePasse(enveloppe, MOT_DE_PASSE_DEMO, { coffre, mode: "demo", garder: true });
  assert.ok(Number.isInteger(ouverte.secret.duree));
  assert.equal((await ouvrirAvecCoffre(enveloppe, coffre, "demo")).banque.publiee_le, enveloppe.publiee_le);
  assert.deepEqual(await ouvrirAvecCoffre(enveloppe, coffre, "reel"), { motDePasse: "requis" });
  assert.equal((await ouvrirParMotDePasse(enveloppe, "mauvais mot de passe de table", { coffre, mode: "reel", garder: true })).code, "mot_de_passe");
  assert.equal(await coffre.lireCle("reel"), null);
  // Un nouveau mot de passe de table : la clé gardée ne suffit plus.
  const { banque } = await ouvrirAvecMotDePasse(enveloppe, MOT_DE_PASSE_DEMO);
  const autre = await preparerPublication({ publiee: { enveloppe: null }, banque: { ...banque, publiee_le: undefined }, secret: await nouveauSecret("un tout autre mot de passe") });
  assert.deepEqual(await ouvrirAvecCoffre(autre.enveloppe, coffre, "demo"), { motDePasse: "change" });
});

test("chargement — stockage durable, mode, empreinte courte", async () => {
  assert.equal(await demanderStockageDurable(undefined), "non pris en charge");
  assert.equal(await demanderStockageDurable({ persisted: async () => false, persist: async () => true }), "accordé");
  assert.equal(await demanderStockageDurable({ persisted: async () => true, persist: async () => true }), "déjà accordé");
  assert.equal(await demanderStockageDurable({ persisted: async () => false, persist: async () => false }), "refusé");
  assert.equal(await demanderStockageDurable({ persist: async () => Promise.reject(new Error("non")) }), "non pris en charge");
  assert.equal(modeDe("?demo=1"), "demo");
  for (const recherche of ["", "?demo=0", "?demo=oui", "?autre=1"]) assert.equal(modeDe(recherche), "reel");
  assert.equal(empreinteCourte("sha256:89b31f2f9a5d3a39d7a0"), "89b31f2f9a5d");
});

test("mot de passe — l'attente ne dépend pas de la peinture de la fenêtre", async () => {
  // Une fenêtre masquée ne peint pas : requestAnimationFrame n'y rappelle jamais.
  globalThis.requestAnimationFrame = () => 0;
  const { laisserPeindre } = await import("../js/ecrans/mot_de_passe.js");
  const issue = await Promise.race([laisserPeindre().then(() => "repris"), new Promise((resoudre) => setTimeout(() => resoudre("bloqué"), 1000))]);
  assert.equal(issue, "repris");
  delete globalThis.requestAnimationFrame;
});

test("serveur local — la seule machine, les seuls fichiers du site (§ 3.2)", async () => {
  const { creerServeur } = await import("../outils/serveur_local.js");
  // Un dossier d'essai : ce que le site sert, et ce qu'il ne doit pas servir.
  const racine = mkdtempSync(join(tmpdir(), "atelier-serveur-"));
  const fichiers = {
    "index.html": 200, "js/a.js": 200, "donnees/banque.chiffree.json": 200, "icones/i.svg": 200,
    ".git/config": 403, ".git/x.js": 403, ".cache/x.js": 403, "plans/p.js": 403, "ressources/r.png": 403, "Système/s.js": 403,
    "essais/c.xlsx": 403, "donnees/banque.json": 403, "SPECIFICATION.md": 403, "package.json": 403,
    "polices/p.woff2": 200, "polices/OFL.txt": 403, "essais/personnage_demo.arpenteur.json": 200, "essais/autre.arpenteur.json": 403,
  };
  for (const chemin of Object.keys(fichiers)) {
    mkdirSync(join(racine, dirname(chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), "x");
  }
  const serveur = creerServeur(racine);
  await new Promise((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
  const { port } = serveur.address();
  // Host se choisit ici : une page hostile dont le nom se résout vers
  // 127.0.0.1 (rebinding DNS) envoie le sien.
  const demander = (chemin, hote = `localhost:${port}`) =>
    new Promise((resoudre, rejeter) => {
      request({ host: "127.0.0.1", port, path: encodeURI(chemin), headers: { Host: hote } }, (reponse) => {
        reponse.resume();
        resoudre({ statut: reponse.statusCode, entetes: reponse.headers });
      })
        .on("error", rejeter)
        .end();
    });
  try {
    for (const [chemin, statut] of Object.entries(fichiers)) assert.equal((await demander(`/${chemin}`)).statut, statut, chemin);
    const page = await demander("/");
    assert.equal(page.statut, 200);
    assert.equal(page.entetes["x-content-type-options"], "nosniff");
    assert.equal((await demander("/js/a.js", `127.0.0.1:${port}`)).statut, 200);
    assert.equal((await demander("/js/a.js", `[::1]:${port}`)).statut, 200);
    assert.equal((await demander("/index.html", `exemple.com:${port}`)).statut, 403);
    assert.equal((await demander("/index.html", "localhost:1")).statut, 403);
    assert.equal((await demander("/..%2f..%2fwindows/win.ini")).statut, 403);
    // Sous Windows, une barre inverse encodée sépare aussi les dossiers.
    for (const chemin of ["/plans\\p.js", "/.git\\x.js", "/tests\\outils\\x.js", "/js\\..\\plans\\p.js"]) assert.equal((await demander(chemin)).statut, 403, chemin);
  } finally {
    serveur.close();
    rmSync(racine, { recursive: true, force: true });
  }
});
