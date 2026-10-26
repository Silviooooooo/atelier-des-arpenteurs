// Contrôles du site (SPECIFICATION.md, § 7, § 9, § 10.1 et § 11, domaine
// « Site ») : la page et sa politique de sécurité, le graphe de ses modules,
// le manifeste et les icônes de l'écran d'accueil, les jetons et leurs
// contrastes, dont les quinze couleurs du simulateur de combat (§ 17 ; lot 4,
// groupe 2, complément § 4.12), la banque de démonstration et le chargement.
// Les écrans eux-mêmes s'essaient à la main, dans le navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  const appels = [...INDEX.matchAll(/<script\b|<link rel="stylesheet"/g)].map(({ index }) => index);
  // Le premier appel est le script du thème au premier affichage (lot 5) : la politique le précède, lui aussi.
  assert.ok(INDEX.startsWith('<script src="js/apparence/theme_initial.js">', appels[0]), "le premier appel n'est pas le thème du premier affichage");
  for (const appel of appels) assert.ok(position < appel, "la politique doit précéder scripts et styles");
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

test("site — le graphe des modules de la page se résout, et atteint les seize écrans (§ 3.2)", () => {
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
    "fiche_adversaire", "fiche_type", "rencontre",
    "combat",
  ];
  assert.equal(new Set(ecrans).size, 16);
  for (const ecran of ecrans) assert.ok(vus.has(`js/ecrans/${ecran}.js`), ecran);
  const modules = [
    "js/banque/chargement.js", "js/securite/coffre.js", "js/publication/github.js", "js/lecture/zip.js", "js/personnage/calcul.js", "js/personnage/stockage.js", "js/fiche/feuilles.js",
    "js/adversaire/resolution.js", "js/adversaire/carte.js", "js/adversaire/lecture.js", "js/ecrans/echelle.js",
    // La rencontre préparée, gardée chiffrée sur l'appareil (lot 4, groupe 2 ; rencontre.js l'importe).
    "js/adversaire/rencontre_gardee.js",
    // Le simulateur de combat (§ 17) : les six parties de son écran (au groupe 2, la bulle et le journal), son moteur,
    // son enregistrement, ses dés.
    "js/ecrans/combat_plateau.js", "js/ecrans/combat_fiches.js", "js/ecrans/combat_action.js", "js/ecrans/combat_preparation.js",
    "js/ecrans/combat_bulle.js", "js/ecrans/combat_journal.js",
    "js/combat/moteur.js", "js/combat/offre.js", "js/combat/lecture.js", "js/combat/journal.js", "js/combat/seance.js", "js/combat/enregistrement.js",
    "js/combat/photographie.js", "js/combat/roles.js", "js/combat/des.js", "js/personnage/disponibles.js",
  ];
  for (const module of modules) assert.ok(vus.has(module), module);
  // L'écran du combat n'entre dans la page que par application.js, d'un import que ce parcours sait lire.
  assert.match(lire("js/application.js"), /^import \* as combat from "\.\/ecrans\/combat\.js";\r?$/m);
  // Tout module de js/ est dans le graphe : aucun fichier que la page n'appelle. Hors du graphe, les deux scripts
  // classiques que la page charge (le thème du premier affichage, la veille), et, jusqu'à l'écran Apparence
  // (lot 5, vague 2), qui l'importera, le catalogue des thèmes, que seuls lisent pour l'heure le générateur de
  // css/themes.css et les contrôles. L'ordre du parcours dépend du disque : la liste est triée.
  const tous = readdirSync(new URL("js/", RACINE), { recursive: true }).map((chemin) => `js/${chemin.replaceAll("\\", "/")}`).filter((chemin) => chemin.endsWith(".js"));
  assert.deepEqual(
    tous.filter((chemin) => !vus.has(chemin)).sort(),
    ["js/apparence/theme_initial.js", "js/apparence/themes.js", "js/veille.js"],
    "seuls le thème du premier affichage, le catalogue des thèmes et la veille vivent hors du graphe (§ 9)",
  );
  // Les deux scripts classiques sont bien appelés par la page, sans type="module".
  const classiques = balises(INDEX, "script").filter((s) => s.type !== "module").map((s) => s.src);
  assert.deepEqual(classiques, ["js/apparence/theme_initial.js", "js/veille.js"]);
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

// Les quinze couleurs du simulateur de combat (§ 17), l'exception à la
// couleur d'accent unique (§ 9) : les onze du lot 4, puis, au groupe 2, la
// hachure de la portée, son bord, le bord et le fond du cadre d'un jet. Trois
// fonds peuvent porter une case de la carte.
const COULEURS_DU_COMBAT = [
  "combat-pj", "combat-pj-doux", "combat-pj-texte", "combat-adv", "combat-adv-doux", "combat-adv-texte", "combat-sur-jeton", "combat-mort", "combat-reussite", "combat-echec", "combat-alerte",
  "combat-portee", "combat-portee-bord", "combat-cadre-jet", "combat-cadre-jet-fond",
];
const FONDS_DE_CASE = ["fond", "fond-2", "accent-doux"];
// Ce qui s'écrit, à 4,5:1 : [avant, fond].
const TEXTES_DU_COMBAT = [
  ...["combat-pj-texte", "combat-adv-texte", "combat-reussite", "combat-echec", "combat-alerte"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])),
  ["combat-pj-texte", "combat-pj-doux"],
  ["combat-adv-texte", "combat-adv-doux"],
  // Les initiales, dans le rond d'un personnage, d'un adversaire, d'un mort.
  ["combat-sur-jeton", "combat-pj"],
  ["combat-sur-jeton", "combat-adv"],
  ["combat-sur-jeton", "combat-mort"],
  // Le texte du site, posé sur les deux fonds doux.
  ...["texte", "texte-2", "accent"].flatMap((avant) => ["combat-pj-doux", "combat-adv-doux"].map((fond) => [avant, fond])),
  // Dans le cadre d'un jet : ✓, ✗ et les chiffres.
  ...["combat-reussite", "combat-echec", "texte"].map((avant) => [avant, "combat-cadre-jet-fond"]),
];
// Les ronds, à 3:1 sur le fond des cases.
const RONDS_DU_COMBAT = ["combat-pj", "combat-adv", "combat-mort"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond]));
// Les traits, à 3:1 : le bord du cadre d'un jet sur les deux fonds et sur le sien ; les traits de la hachure et le bord
// d'une case hachurée sur le fond des cases.
const TRAITS_DU_COMBAT = [
  ...["fond", "fond-2", "combat-cadre-jet-fond"].map((fond) => ["combat-cadre-jet", fond]),
  ...["combat-portee", "combat-portee-bord"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])),
];

// Les paires trop faibles d'une feuille de jetons, dans les deux thèmes : vide quand tout tient.
function contrastesFaibles(css, paires, seuil) {
  return ["clair", "sombre"].flatMap((theme) => {
    const j = jetons(css, theme);
    return paires.filter(([avant, fond]) => !(contraste(j[avant], j[fond]) >= seuil)).map(([avant, fond]) => `${theme} : --${avant} sur --${fond}, ${contraste(j[avant], j[fond]).toFixed(2)}:1`);
  });
}

test("jetons — les quinze couleurs du combat : le texte contraste d'au moins 4,5:1, les ronds et les traits de 3:1 sur le fond des cases, dans les deux thèmes (§ 17)", () => {
  assert.equal(COULEURS_DU_COMBAT.length, 15);
  assert.deepEqual(contrastesFaibles(JETONS, TEXTES_DU_COMBAT, 4.5), []);
  assert.deepEqual(contrastesFaibles(JETONS, RONDS_DU_COMBAT, 3), []);
  assert.deepEqual(contrastesFaibles(JETONS, TRAITS_DU_COMBAT, 3), []);
  // Chacune des quinze est mesurée, comme couleur ou comme fond.
  const mesurees = new Set([...TEXTES_DU_COMBAT, ...RONDS_DU_COMBAT, ...TRAITS_DU_COMBAT].flat());
  assert.deepEqual(COULEURS_DU_COMBAT.filter((nom) => !mesurees.has(nom)), []);
  // Ces quinze-là, et aucune autre : une couleur ajoutée sans mesure se verrait.
  for (const theme of ["clair", "sombre"]) {
    assert.deepEqual(Object.keys(jetons(JETONS, theme)).filter((nom) => nom.startsWith("combat-")), COULEURS_DU_COMBAT, theme);
  }
  const deTrop = JETONS.replace("--combat-cadre-jet-fond: #ffffff;", "--combat-cadre-jet-fond: #ffffff;\n  --combat-hachure: #d9534f;");
  assert.notDeepEqual(Object.keys(jetons(deTrop, "clair")).filter((nom) => nom.startsWith("combat-")), COULEURS_DU_COMBAT);
  // Le groupe 2 : une hachure trop pâle sur le fond doux d'une case ; un fond de cadre sombre qui avale son bord.
  assert.match(contrastesFaibles(JETONS.replace("--combat-portee: #d9534f;", "--combat-portee: #e8776e;"), TRAITS_DU_COMBAT, 3).join("\n"), /^clair : --combat-portee sur --accent-doux, /m);
  assert.match(contrastesFaibles(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #3a3f46;"), TRAITS_DU_COMBAT, 3).join("\n"), /^sombre : --combat-cadre-jet sur --combat-cadre-jet-fond, /m);
  assert.match(contrastesFaibles(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #3a3f46;"), TEXTES_DU_COMBAT, 4.5).join("\n"), /^sombre : --combat-echec sur --combat-cadre-jet-fond, /m);
  // Le contrôle refuse : des initiales blanches sur le vert du thème sombre, un rouge trop pâle pour s'écrire sur le clair.
  const blanches = contrastesFaibles(JETONS.replace("--combat-sur-jeton: #0b1722;", "--combat-sur-jeton: #ffffff;"), [["combat-sur-jeton", "combat-pj"]], 4.5);
  assert.equal(blanches.length, 1, "le thème clair, lui, garde ses initiales blanches");
  assert.match(blanches[0], /^sombre : --combat-sur-jeton sur --combat-pj, 2\.8\d:1$/);
  assert.match(contrastesFaibles(JETONS.replace("--combat-echec: #b3261e;", "--combat-echec: #e8776e;"), TEXTES_DU_COMBAT, 4.5).join("\n"), /^clair : --combat-echec sur --fond, /);
  assert.match(contrastesFaibles(JETONS.replace("--combat-mort: #7d838d;", "--combat-mort: #3a3f46;"), RONDS_DU_COMBAT, 3).join("\n"), /^sombre : --combat-mort sur --fond, /);
  // Le gris d'un mort est une couleur de rond : écrit sur le second fond, il ne tiendrait pas 4,5:1. Il n'est donc pas un texte.
  assert.equal(contrastesFaibles(JETONS, [["combat-mort", "fond-2"]], 4.5).length, 2);
});

// Les feuilles de l'interface : toute valeur y vient d'un jeton. Seule la
// largeur d'une condition @media s'y écrit en dur (§ 9), une variable n'y
// étant pas permise ; la carte d'adversaire et la fiche ont leurs contrôles.
const FEUILLES_A_JETONS = ["css/ecran.css", "css/personnage.css", "css/combat.css"];

// Ce qu'une feuille écrit en dur : vide quand tout vient de jetons.css.
function valeursEnDur(css, definis) {
  const texte = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const defauts = [];
  for (const ligne of texte.split("\n").map((brute) => brute.trim()).filter((ligne) => !ligne.startsWith("@media"))) {
    if (/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/i.test(ligne)) defauts.push(`couleur écrite en dur : ${ligne}`);
    if (/\d(?:px|rem|em|vh|vw|pt|ms|s)\b/.test(ligne)) defauts.push(`valeur écrite en dur : ${ligne}`);
    if (/font-family:/.test(ligne) && !/font-family:\s*var\(--/.test(ligne)) defauts.push(`police écrite en dur : ${ligne}`);
  }
  for (const [, nom] of texte.matchAll(/var\(--([\w-]+)\)/g)) if (!definis.has(nom)) defauts.push(`--${nom} n'est pas défini dans jetons.css`);
  if (/@font-face|@import|url\(/.test(texte)) defauts.push("police ou ressource téléchargée");
  return defauts;
}

// Les jetons de couleur qui n'ont pas, dans le thème sombre, une valeur à eux.
function sansValeurSombre(css, noms) {
  const [clair, sombre] = [jetons(css, "clair"), jetons(css, "sombre")];
  return noms.filter((nom) => !/^#[0-9a-f]{6}$/i.test(sombre[nom] ?? "") || sombre[nom] === clair[nom]);
}
// Les jetons que le bloc sombre déclare lui-même.
const declaresEnSombre = (css) => new Set([...css.slice(css.indexOf("@media (prefers-color-scheme: dark)")).matchAll(/--([\w-]+):/g)].map(([, nom]) => nom));

// Les propriétés que placerBulle (js/ecrans/echelle.js) écrit sur la bulle du
// combat, son onglet et ses infobulles : lues dans son corps, jusqu'à la
// première accolade fermante en début de ligne. combat.css les lit sans
// qu'elles soient des jetons.
function proprietesDePlacerBulle(source) {
  const debut = source.indexOf("export function placerBulle(");
  if (debut < 0) return [];
  const fin = source.indexOf("\n}", debut);
  return [...source.slice(debut, fin < 0 ? undefined : fin).matchAll(/setProperty\(\s*"--([\w-]+)"/g)].map(([, nom]) => nom);
}

test("jetons — ecran.css, personnage.css et combat.css tirent toutes leurs valeurs de jetons.css, hors les largeurs des @media ; aucune police téléchargée", () => {
  const definis = new Set(Object.keys(jetons(JETONS, "clair")));
  // La feuille du combat lit aussi les trois propriétés de la place de la bulle, et elles seules.
  const deLaBulle = proprietesDePlacerBulle(lire("js/ecrans/echelle.js"));
  assert.deepEqual(deLaBulle, ["bulle-gauche", "bulle-haut", "bulle-fleche"]);
  assert.deepEqual([...definis].filter((nom) => nom.startsWith("bulle-")), [], "la place de la bulle n'est pas un jeton");
  const definisPour = (feuille) => (feuille === "css/combat.css" ? new Set([...definis, ...deLaBulle]) : definis);
  for (const feuille of FEUILLES_A_JETONS) assert.deepEqual(valeursEnDur(lire(feuille), definisPour(feuille)), [], feuille);
  assert.doesNotMatch(JETONS, /@font-face|@import|url\(/);
  // La feuille du combat est bien lue : elle emploie ses jetons et les trois propriétés de la bulle, et ses deux largeurs
  // sont écrites là où elles sont permises ; sa troisième condition, la souris, n'en a pas.
  const combat = lire("css/combat.css");
  for (const nom of [...COULEURS_DU_COMBAT, "largeur-combat", ...deLaBulle]) assert.ok(combat.includes(`var(--${nom})`), `--${nom} ne sert pas dans css/combat.css`);
  assert.deepEqual(combat.split("\n").map((ligne) => ligne.trim()).filter((ligne) => ligne.startsWith("@")), ["@media (min-width: 56rem) {", "@media (min-width: 80rem) {", "@media (pointer: fine) {"]);
  // Les --bulle-* ne sont admises que d'après placerBulle : une autre est refusée, dans combat.css comme ailleurs.
  assert.match(valeursEnDur(".combat-bulle { left: var(--bulle-x); }", definisPour("css/combat.css")).join("\n"), /^--bulle-x n'est pas défini/);
  assert.match(valeursEnDur(".bulle { left: var(--bulle-gauche); }", definisPour("css/ecran.css")).join("\n"), /^--bulle-gauche n'est pas défini/);
  assert.deepEqual(proprietesDePlacerBulle("export function placerBulle(n) {\n  n.style.setProperty(\"--bulle-x\", \"1px\");\n}\nexport function autre(n) {\n  n.style.setProperty(\"--hors\", \"1px\");\n}\n"), ["bulle-x"]);
  // Le contrôle refuse : chaque sorte de valeur en dur, et une largeur sortie de la ligne de son @media.
  const refuse = (css, motif) => assert.match(valeursEnDur(css, definis).join("\n"), motif, css);
  refuse(".combat-x { color: #1e7a3c; }", /^couleur écrite en dur/);
  refuse(".combat-x { background: rgba(0, 0, 0, 0.5); }", /^couleur écrite en dur/);
  refuse(".combat-x { max-width: 90rem; }", /^valeur écrite en dur/);
  refuse(".combat-x { border: 1px solid var(--bordure); }", /^valeur écrite en dur/);
  refuse(".combat-x { transition: opacity 0.2s; }", /^valeur écrite en dur/);
  refuse(".combat-x { font-family: ui-monospace, monospace; }", /^police écrite en dur/);
  refuse(".combat-x { width: var(--combat-inconnu); }", /^--combat-inconnu n'est pas défini/);
  refuse('@import "autre.css";', /ressource téléchargée/);
  refuse("@media\n  (min-width: 80rem) {\n  .combat-x { display: none; }\n}", /^valeur écrite en dur : \(min-width: 80rem\) \{/);
  refuse("@container (min-width: 40rem) {\n  .combat-x { display: none; }\n}", /^valeur écrite en dur : @container/);
  assert.deepEqual(valeursEnDur("@media (min-width: 56rem) {\n  .combat-x { max-width: var(--largeur-combat); width: 45%; flex: 1 1 0; }\n}", definis), []);
  // Les jetons de couleur ont une valeur dans chaque thème. Le bord du cadre d'un jet, seul, garde la même (un gris qui
  // tient 3:1 sur les fonds des deux thèmes) : il est exempté par son nom, et le bloc sombre le redéclare.
  const EXEMPTE = "combat-cadre-jet";
  const couleurs = ["fond", "fond-2", "texte", "texte-2", "bordure", "separateur", "accent", "texte-sur-accent", "accent-doux", ...COULEURS_DU_COMBAT.filter((nom) => nom !== EXEMPTE)];
  assert.deepEqual(sansValeurSombre(JETONS, couleurs), []);
  assert.deepEqual(sansValeurSombre(JETONS, [EXEMPTE]), [EXEMPTE], "l'exemption sert : sa valeur sombre est la claire");
  assert.deepEqual(COULEURS_DU_COMBAT.filter((nom) => !declaresEnSombre(JETONS).has(nom)), [], "le bloc sombre déclare les quinze");
  assert.deepEqual(sansValeurSombre(JETONS.replace(/\s*--combat-alerte: #e6a85a;/, ""), couleurs), ["combat-alerte"], "un jeton resté à sa valeur claire");
  assert.deepEqual(sansValeurSombre(JETONS.replace("--combat-mort: #7d838d;", "--combat-mort: var(--bordure);"), couleurs), ["combat-mort"], "une valeur sombre qui ne se mesure pas");
  assert.deepEqual(sansValeurSombre(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #ffffff;"), couleurs), ["combat-cadre-jet-fond"], "le fond du cadre resté blanc");
  assert.deepEqual(COULEURS_DU_COMBAT.filter((nom) => !declaresEnSombre(JETONS.replace(/\r?\n {4}--combat-cadre-jet: #7d838d;/, "")).has(nom)), [EXEMPTE], "le bord du cadre sans valeur sombre");
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
  // Ce que le simulateur de combat y lit (lot 4, § 15.7) est dans le fichier publié, mot pour mot.
  assert.deepEqual([banque.blocs.length, banque.capacites.length, banque.elements.length, banque.adversaires.length], [37, 46, 22, 5]);
  assert.deepEqual(["Intervention", "Passif"].map((nom) => banque.elements.find((e) => e.nom === nom)?.description), ["Se joue pendant le tour adverse.", "Agit sans action."]);
  assert.deepEqual(banque.blocs.find((b) => b.nom === "Gestes de cuisine").capacites.map((c) => c.nom), ["Pas chassé", "Goûter", "Taloche", "Pas de côté", "Guetter"]);
  const variante = (nom) => banque.capacites.find((c) => c.nom === nom)?.variantes[0];
  assert.deepEqual([variante("Pas de côté")?.cout_souffle, variante("Pas de côté")?.elements, variante("Pas de côté")?.description], ["X", [{ nom: "Intervention" }], "Annulez [X] dégâts reçus."]);
  assert.equal(variante("Guetter")?.description, "Après un déplacement, ou pour finir son tour : une de vos capacités se joue en intervention jusqu'au prochain tour de votre camp.");
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
    // Les personnages en ligne (§ 15.8) : les fichiers rangés et l'index, rien d'autre.
    "personnages/Qx7-aZ_09bcdEFGHijklmn.chiffre.json": 200, "personnages/index.json": 200, "personnages/clair.json": 403,
    "personnages/court.chiffre.json": 403, "personnages/Qx7-aZ_09bcdEFGHijklmn.json": 403, "personnages/sous/Qx7-aZ_09bcdEFGHijklmn.chiffre.json": 403,
    "personnages/x.js": 403, "personnages/p.chiffree.json": 403, "index.json": 403,
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
    // GitHub Pages distingue la casse : le serveur aussi, pour personnages/.
    assert.equal((await demander("/Personnages/index.json")).statut, 403);
    assert.equal((await demander("/personnages/INDEX.json")).statut, 403);
    // Sous Windows, une barre inverse encodée sépare aussi les dossiers.
    for (const chemin of ["/plans\\p.js", "/.git\\x.js", "/tests\\outils\\x.js", "/js\\..\\plans\\p.js"]) assert.equal((await demander(chemin)).statut, 403, chemin);
  } finally {
    serveur.close();
    rmSync(racine, { recursive: true, force: true });
  }
});
