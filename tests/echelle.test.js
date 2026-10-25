// Contrôles de js/ecrans/echelle.js et du document simulé (SPECIFICATION.md,
// § 10.1, § 11, § 16.6 et § 17.7 ; contrat du lot 4, groupe 2, § 9.3 et
// § 11) : l'unique écriture de style du code, venue de
// ecrans_adversaires.test.js et amendée pour la bulle ; la place d'une
// bulle, calculée sans DOM ; son écriture en trois propriétés ; l'écouteur
// qui la tient en place quand la fenêtre change de taille ; ce que le
// document simulé gagne au groupe 2. Les exemples sont des nombres : la
// bulle elle-même se regarde dans un vrai navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { FLECHE, calculerPlace, placerBulle, poserEchelle, tenirALEchelle, tenirLaBulle } from "../js/ecrans/echelle.js";
import { installerDom } from "./outils/dom_simule.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const ECHELLE = "js/ecrans/echelle.js";

// Le corps d'une fonction exportée d'un module, jusqu'à son accolade de fin
// de ligne.
function corpsDe(source, nom) {
  const debut = source.indexOf(`export function ${nom}(`);
  assert.notEqual(debut, -1, nom);
  return source.slice(debut, source.indexOf("\n}", debut) + 2);
}

// Les noms que posent les appels à setProperty d'un texte, dans l'ordre.
const nomsPoses = (texte) => [...texte.matchAll(/setProperty\(([^,]+),/g)].map(([, nom]) => nom);

// ─── L'unique écriture de style du code ─────────────────────────────────────

test("échelle — un seul module de js/ écrit un style : l'échelle d'un papier et la place de la bulle, quatre propriétés, rien d'autre", () => {
  // Tout ce par quoi un script pose un style : la propriété style d'un nœud,
  // son attribut, une feuille fabriquée.
  const ECRITURE = /\.style\s*(?:\?\.|\.|\[|=(?!=))|\bsetProperty\s*\(|\bcssText\b|setAttribute\(\s*["'`]style|\binsertRule\b|\bCSSStyleSheet\b|adoptedStyleSheets|createElement(?:NS)?\([^)]*["'`]style["'`]/g;
  const fichiers = readdirSync(new URL("js/", RACINE), { recursive: true }).map((chemin) => `js/${chemin.replaceAll("\\", "/")}`).filter((chemin) => chemin.endsWith(".js"));
  assert.ok(fichiers.length > 40, `${fichiers.length} modules lus`);
  const ecritures = fichiers.flatMap((chemin) => [...lire(chemin).matchAll(ECRITURE)].map(([trouve]) => [chemin, trouve]));
  // Dans echelle.js seul : poserEchelle, puis les trois écritures de placerBulle.
  const bulle = [[ECHELLE, ".style."], [ECHELLE, "setProperty("]];
  assert.deepEqual(ecritures, [[ECHELLE, ".style?."], [ECHELLE, "setProperty("], ...bulle, ...bulle, ...bulle]);

  // Quatre .style, chacun suivi de setProperty( : aucun alias ne garde le
  // style d'un nœud pour l'écrire ailleurs.
  const source = lire(ECHELLE);
  const styles = [...source.matchAll(/\.style\b(\??\.setProperty\()?/g)];
  assert.equal(styles.length, 4, "quatre .style");
  assert.deepEqual(styles.map(([, suite]) => suite), ["?.setProperty(", ".setProperty(", ".setProperty(", ".setProperty("]);
  assert.equal([...source.matchAll(/setProperty\(/g)].length, 4);
  // Les noms : --echelle par poserEchelle ; les trois de la bulle par placerBulle, et nulle part ailleurs.
  assert.deepEqual(nomsPoses(source), ['"--echelle"', '"--bulle-gauche"', '"--bulle-haut"', '"--bulle-fleche"']);
  const placer = corpsDe(source, "placerBulle");
  assert.deepEqual(nomsPoses(placer), ['"--bulle-gauche"', '"--bulle-haut"', '"--bulle-fleche"']);
  assert.deepEqual(nomsPoses(corpsDe(source, "poserEchelle")), ['"--echelle"']);
  assert.deepEqual(nomsPoses(source.replace(placer, "")), ['"--echelle"']);

  // Le motif voit les écritures qu'il doit voir, et pas une propriété nommée « style ».
  for (const faute of ['noeud.style.width = "3px"', "noeud.style = x", 'noeud.style["zoom"] = 1', 'noeud.style?.setProperty("--x", 1)', 'noeud.setAttribute("style", x)', "feuille.insertRule(x)", 'document.createElement("style")', "noeud.style.cssText = x", 'bulle.style.setProperty("--bulle-haut", "3px")', 'infobulle.style.removeProperty("--bulle-fleche")']) {
    assert.ok(faute.match(ECRITURE), faute);
  }
  for (const permis of ["fiche.style, fiche.niveau", "toutes(ELEMENTS.style)", 'nom === "style" || nom === "srcdoc"', "if (a.style === b.style) x()"]) {
    assert.equal(permis.match(ECRITURE), null, permis);
  }
  // La fiche de personnage et le cadre des cartes passent par ce module.
  assert.match(lire("js/ecrans/fiche_personnage.js"), /import \{ poserEchelle \} from "\.\/echelle\.js";/);
  assert.match(lire("js/ecrans/fiche_personnage.js"), /poserEchelle\(impression, LARGEUR_FEUILLE\)/);
  assert.match(lire("js/ecrans/rencontre.js"), /tenirALEchelle\(noeud, LARGEUR_CARTE\)/);
  assert.match(lire("css/personnage.css"), /zoom:\s*var\(--echelle, 1\);/);

  // La largeur de ce qui contient le papier, rapportée à la sienne ; jamais plus de 1.
  const poses = [];
  const papier = (largeur) => ({ parentNode: largeur === null ? null : { clientWidth: largeur }, style: { setProperty: (nom, valeur) => poses.push([nom, valeur]) } });
  assert.equal(poserEchelle(papier(397), 794), 0.5);
  assert.equal(poserEchelle(papier(2000), 794), 1);
  assert.equal(poserEchelle(papier(0), 794), 1, "pas encore mis en page");
  assert.equal(poserEchelle(papier(null), 794), 1, "hors de la page");
  assert.deepEqual(poses, [["--echelle", "0.5"], ["--echelle", "1"], ["--echelle", "1"], ["--echelle", "1"]]);
  // Un nœud sans style ne lève rien.
  assert.equal(poserEchelle({ parentNode: { clientWidth: 100 } }, 400), 0.25);
});

// ─── La place d'une bulle, sans DOM ─────────────────────────────────────────

const FENETRE = { largeur: 1280, hauteur: 800 };
const QUATRE = ["droite", "gauche", "dessous", "dessus"];
// La bulle d'une liste : 20rem de large ; écartée d'une case et de sa flèche.
const TAILLE = { largeur: 320, hauteur: 400 };
const ECART = 48 + FLECHE;
const caseEn = (gauche, haut, cote = 48) => ({ gauche, haut, droite: gauche + cote, bas: haut + cote });
const placer = (ancre, autres = {}) => calculerPlace({ ancre, taille: TAILLE, fenetre: FENETRE, cotes: QUATRE, ecart: ECART, pointe: 60, ...autres });
const ETROITE = { largeur: 700, hauteur: 800 };

test("calculerPlace — à droite, à gauche, dessous, dessus : le premier côté où la bulle tient entière, à 16 px des bords", () => {
  // La flèche fait 8 px, comme --fleche-bulle.
  assert.equal(FLECHE, 8);
  // À droite, la colonne voisine de la case laissée libre ; la pointe à 60 px sous le bord, en face du milieu de la case.
  assert.deepEqual(placer(caseEn(400, 300)), { cote: "droite", gauche: 504, haut: 264, fleche: 60, entiere: true });
  // Trop près du bord droit : à gauche.
  assert.deepEqual(placer(caseEn(1000, 300)), { cote: "gauche", gauche: 624, haut: 264, fleche: 60, entiere: true });
  // Les bornes sont comprises : à 16 px du bord droit, elle tient encore ; un pixel plus loin, non.
  assert.deepEqual(placer(caseEn(840, 300)), { cote: "droite", gauche: 944, haut: 264, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(841, 300)), { cote: "gauche", gauche: 465, haut: 264, fleche: 60, entiere: true });
  // À 16 px du bord gauche, à gauche, elle tient encore ; un pixel plus près, non : dessous.
  assert.deepEqual(placer(caseEn(392, 100), { fenetre: ETROITE }).cote, "gauche");
  assert.deepEqual(placer(caseEn(391, 100), { fenetre: ETROITE }), { cote: "dessous", gauche: 355, haut: 204, fleche: 60, entiere: true });
  // Ni à droite ni à gauche dans une fenêtre étroite : dessous, la pointe à 60 px du bord gauche de la bulle.
  assert.deepEqual(placer(caseEn(300, 100), { fenetre: ETROITE }), { cote: "dessous", gauche: 264, haut: 204, fleche: 60, entiere: true });
  // Ni dessous, la case basse : dessus.
  assert.deepEqual(placer(caseEn(300, 600), { fenetre: ETROITE }), { cote: "dessus", gauche: 264, haut: 144, fleche: 60, entiere: true });
  // En bas et en haut aussi, les bornes sont comprises : dessous jusqu'à 16 px du bas, dessus jusqu'à 16 px du haut.
  const HAUTE = { largeur: 700, hauteur: 1000 };
  assert.deepEqual(placer(caseEn(300, 480), { fenetre: HAUTE }), { cote: "dessous", gauche: 264, haut: 584, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(300, 481), { fenetre: HAUTE }), { cote: "dessus", gauche: 264, haut: 25, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(300, 472), { fenetre: HAUTE, cotes: ["dessus", "dessous"] }), { cote: "dessus", gauche: 264, haut: 16, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(300, 471), { fenetre: HAUTE, cotes: ["dessus", "dessous"] }), { cote: "dessous", gauche: 264, haut: 575, fleche: 60, entiere: true });
});

test("calculerPlace — l'ordre des côtés est celui qu'on donne ; aucun ne tient : le premier, ramené dans la fenêtre", () => {
  // Les quatre côtés tiennent : le premier donné l'emporte.
  assert.equal(placer(caseEn(400, 100)).cote, "droite");
  assert.deepEqual(placer(caseEn(400, 100), { cotes: ["gauche", "droite"] }), { cote: "gauche", gauche: 24, haut: 64, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(400, 100), { cotes: ["dessous", "droite"] }), { cote: "dessous", gauche: 364, haut: 204, fleche: 60, entiere: true });
  assert.deepEqual(placer(caseEn(400, 500), { cotes: ["dessus", "dessous", "droite"] }), { cote: "dessus", gauche: 364, haut: 44, fleche: 60, entiere: true });
  // Aucun côté ne tient, mais la bulle tient dans la fenêtre : le premier côté, ramené ; entière.
  const basse = { largeur: 700, hauteur: 600 };
  assert.deepEqual(placer(caseEn(300, 250), { fenetre: basse }), { cote: "droite", gauche: 364, haut: 184, fleche: 90, entiere: true });
  // L'infobulle d'une cause : dessous, puis dessus ; aucun ne tient : dessous, ramené.
  assert.deepEqual(placer(caseEn(300, 250), { fenetre: basse, cotes: ["dessous", "dessus"] }), { cote: "dessous", gauche: 264, haut: 184, fleche: 60, entiere: true });
  // Plus large que la fenêtre, marges ôtées : collée à la marge, et non entière.
  assert.deepEqual(placer(caseEn(100, 250), { fenetre: { largeur: 300, hauteur: 600 } }), { cote: "droite", gauche: 16, haut: 184, fleche: 90, entiere: false });
  // Plus haute : de même.
  assert.deepEqual(placer(caseEn(400, 100), { fenetre: { largeur: 1280, hauteur: 300 } }), { cote: "droite", gauche: 504, haut: 16, fleche: 108, entiere: false });
  // Tout juste : 16 px de chaque côté, elle tient.
  assert.equal(placer(caseEn(400, 100), { fenetre: { largeur: 1280, hauteur: 432 } }).entiere, true);
  assert.equal(placer(caseEn(400, 100), { fenetre: { largeur: 1280, hauteur: 431 } }).entiere, false);
  assert.equal(placer(caseEn(400, 100), { fenetre: { largeur: 352, hauteur: 800 } }).entiere, true);
  assert.equal(placer(caseEn(400, 100), { fenetre: { largeur: 351, hauteur: 800 } }).entiere, false);
  // Un côté inconnu est une faute de l'appelant.
  assert.throws(() => placer(caseEn(400, 100), { cotes: ["devant"] }), { name: "TypeError", message: "Côté inconnu : devant." });
});

test("calculerPlace — l'ancre hors de la fenêtre : la bulle reste dans la fenêtre, la flèche bornée à 12 px des coins", () => {
  // La case sous le bas de la fenêtre : la bulle collée en bas, la flèche au plus bas qu'elle peut.
  assert.deepEqual(placer(caseEn(400, 900)), { cote: "droite", gauche: 504, haut: 384, fleche: 388, entiere: true });
  // Au-dessus du haut.
  assert.deepEqual(placer(caseEn(400, -200)), { cote: "droite", gauche: 504, haut: 16, fleche: 12, entiere: true });
  // À gauche de la fenêtre, puis à droite d'elle : dessous, la flèche bornée le long du bord du haut.
  assert.deepEqual(placer(caseEn(-300, 100), { fenetre: ETROITE }), { cote: "dessous", gauche: 16, haut: 204, fleche: 12, entiere: true });
  assert.deepEqual(placer(caseEn(900, 100), { fenetre: ETROITE }), { cote: "dessous", gauche: 364, haut: 204, fleche: 308, entiere: true });
  // La marge et le coin se règlent.
  assert.deepEqual(placer(caseEn(400, -200), { marge: 40 }), { cote: "droite", gauche: 504, haut: 40, fleche: 12, entiere: true });
  assert.deepEqual(placer(caseEn(400, 900), { coin: 30 }), { cote: "droite", gauche: 504, haut: 384, fleche: 370, entiere: true });
});

test("calculerPlace — des px entiers, sans rien changer à ce qu'on lui donne", () => {
  const ancre = Object.freeze({ gauche: 400.4, haut: 300.3, droite: 448.4, bas: 348.6 });
  const taille = Object.freeze({ largeur: 320.6, hauteur: 399.5 });
  const fenetre = Object.freeze({ largeur: 1280, hauteur: 800 });
  const cotes = Object.freeze([...QUATRE]);
  const place = calculerPlace({ ancre, taille, fenetre, cotes, ecart: 56.5, pointe: 60 });
  assert.deepEqual(place, { cote: "droite", gauche: 505, haut: 264, fleche: 60, entiere: true });
  for (const cle of ["gauche", "haut", "fleche"]) assert.ok(Number.isInteger(place[cle]), cle);
  assert.deepEqual(calculerPlace({ ancre, taille, fenetre, cotes, ecart: 56.5, pointe: 60 }), place, "pure");
  // Collée en haut, la pointe en face d'un milieu à 64,45 px : 48 px.
  assert.deepEqual(calculerPlace({ ancre: { gauche: 400, haut: 40.3, droite: 448, bas: 88.6 }, taille: TAILLE, fenetre, cotes, ecart: 56, pointe: 60 }), { cote: "droite", gauche: 504, haut: 16, fleche: 48, entiere: true });
  // Dessous, ramenée : la flèche horizontale entière elle aussi.
  const dessous = calculerPlace({ ancre, taille, fenetre, cotes: ["dessous"], ecart: 56.5, pointe: 60 });
  assert.deepEqual(dessous, { cote: "dessous", gauche: 364, haut: 385, fleche: 60, entiere: true });
  assert.deepEqual([ancre, taille, cotes], [{ gauche: 400.4, haut: 300.3, droite: 448.4, bas: 348.6 }, { largeur: 320.6, hauteur: 399.5 }, QUATRE]);
});

// ─── L'écriture de la place ─────────────────────────────────────────────────

test("placerBulle — trois propriétés, en px entiers relatifs au repère, d'après les boîtes mesurées ; ni classe ni autre style", () => {
  const retirer = installerDom();
  try {
    const boite = (balise, rectangle) => Object.assign(document.createElement(balise), { rectangle });
    const cadre = boite("div", { left: 100.5, top: 50.25, width: 1100, height: 900 });
    const laCase = boite("button", { left: 400, top: 600, width: 48, height: 48 });
    const bulle = boite("div", { left: 0, top: 0, width: 320, height: 400 });
    bulle.className = "combat-bulle";
    bulle.setAttribute("role", "dialog");
    cadre.append(laCase, bulle);
    document.body.append(cadre);
    const usage = { ancre: laCase, repere: cadre, fenetre: FENETRE, cotes: QUATRE, ecart: 48 + FLECHE, pointe: 60 };

    // À droite de la case, collée au bas de la fenêtre : 504 et 384 dans la fenêtre, la pointe à 240 px.
    assert.deepEqual(placerBulle(bulle, usage), { cote: "droite", entiere: true });
    assert.deepEqual(bulle.style.ecritures, [["--bulle-gauche", "404px"], ["--bulle-haut", "334px"], ["--bulle-fleche", "240px"]]);
    // L'appelant pose la classe du côté : placerBulle n'y touche pas.
    assert.equal(bulle.className, "combat-bulle");
    assert.deepEqual([...bulle.attributs], [["class", "combat-bulle"], ["role", "dialog"]]);
    assert.deepEqual([laCase.style.ecritures, cadre.style.ecritures], [[], []], "rien d'écrit sur l'ancre ni sur le repère");

    // Une fenêtre trop basse : collée en haut (au-dessus du repère : une valeur négative), non entière.
    assert.deepEqual(placerBulle(bulle, { ...usage, fenetre: { largeur: 1280, hauteur: 300 } }), { cote: "droite", entiere: false });
    assert.deepEqual(bulle.style.ecritures.slice(3), [["--bulle-gauche", "404px"], ["--bulle-haut", "-34px"], ["--bulle-fleche", "388px"]]);
    assert.deepEqual(["--bulle-gauche", "--bulle-haut", "--bulle-fleche"].map((nom) => bulle.style.getPropertyValue(nom)), ["404px", "-34px", "388px"]);
    for (const [, valeur] of bulle.style.ecritures) assert.match(valeur, /^-?\d+px$/);

    // L'infobulle d'une ligne : son ancre, les bords de la bulle et ceux de la ligne ; son repère, la bulle.
    bulle.rectangle = { left: 504, top: 264, width: 320, height: 400 };
    const infobulle = boite("div", { left: 0, top: 0, width: 288, height: 120 });
    const ligne = boite("button", { left: 520, top: 380, width: 288, height: 36 });
    const ancre = {
      getBoundingClientRect: () => {
        const [b, l] = [bulle.getBoundingClientRect(), ligne.getBoundingClientRect()];
        return { left: b.left, right: b.right, top: l.top, bottom: l.bottom };
      },
    };
    const vers = { ancre, repere: bulle, fenetre: FENETRE, cotes: ["droite", "gauche", "dessous"], ecart: FLECHE, pointe: 14 };
    assert.deepEqual(placerBulle(infobulle, vers), { cote: "droite", entiere: true });
    assert.deepEqual(infobulle.style.ecritures, [["--bulle-gauche", "328px"], ["--bulle-haut", "120px"], ["--bulle-fleche", "14px"]]);
    // La bulle contre le bord droit : l'infobulle passe à gauche ; sa taille est celle qu'elle a, mesurée.
    bulle.rectangle = { left: 944, top: 264, width: 320, height: 400 };
    infobulle.rectangle = { left: 0, top: 0, width: 288, height: 200 };
    assert.deepEqual(placerBulle(infobulle, vers), { cote: "gauche", entiere: true });
    assert.deepEqual(infobulle.style.ecritures.slice(3), [["--bulle-gauche", "-296px"], ["--bulle-haut", "120px"], ["--bulle-fleche", "14px"]]);
    infobulle.rectangle = { left: 0, top: 0, width: 288, height: 300 };
    ligne.rectangle = { left: 960, top: 600, width: 288, height: 36 };
    assert.deepEqual(placerBulle(infobulle, vers), { cote: "gauche", entiere: true });
    assert.deepEqual(infobulle.style.ecritures.slice(6), [["--bulle-gauche", "-296px"], ["--bulle-haut", "220px"], ["--bulle-fleche", "134px"]]);
  } finally {
    retirer();
  }
});

// ─── La bulle tenue en place ────────────────────────────────────────────────

test("tenirLaBulle — un écouteur resize, à part de celui du papier, un seul à la fois, retiré quand la bulle a quitté la page ; aucun écouteur de défilement", () => {
  // Dans le texte : deux écouteurs, tous deux de taille (le papier, la bulle).
  const source = lire(ECHELLE);
  assert.deepEqual([...source.matchAll(/addEventListener\?\.\("([^"]+)"/g)].map(([, type]) => type), ["resize", "resize"]);
  assert.doesNotMatch(source, /scroll/i);

  const retirer = installerDom();
  const avant = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
  const ecoutes = [];
  globalThis.addEventListener = (type, f) => ecoutes.push([type, f]);
  globalThis.removeEventListener = (type, f) => {
    const i = ecoutes.findIndex(([t, g]) => t === type && g === f);
    if (i >= 0) ecoutes.splice(i, 1);
  };
  globalThis.requestAnimationFrame = () => 0;
  const dansLaPage = () => {
    const noeud = document.createElement("div");
    document.body.append(noeud);
    return noeud;
  };
  try {
    const appels = [];
    const premiere = dansLaPage();
    const lacherLaPremiere = tenirLaBulle(premiere, () => appels.push("première"));
    assert.equal(typeof lacherLaPremiere, "function");
    assert.deepEqual(ecoutes.map(([type]) => type), ["resize"]);
    assert.deepEqual(appels, [], "rien n'est replacé avant que la fenêtre change de taille");
    const ecouteDeLaPremiere = ecoutes[0][1];
    ecouteDeLaPremiere();
    assert.deepEqual(appels, ["première"]);

    // Une autre bulle : l'écouteur de la première se retire.
    const seconde = dansLaPage();
    const lacherLaSeconde = tenirLaBulle(seconde, () => appels.push("seconde"));
    assert.deepEqual(ecoutes.map(([type]) => type), ["resize"]);
    assert.notEqual(ecoutes[0][1], ecouteDeLaPremiere);
    // L'ancien écouteur, appelé tard, ne fait rien ; l'ancien lacher ne retire pas le nouveau.
    ecouteDeLaPremiere();
    lacherLaPremiere();
    assert.deepEqual(appels, ["première"]);
    assert.equal(ecoutes.length, 1);
    ecoutes[0][1]();
    assert.deepEqual(appels, ["première", "seconde"]);

    // Le papier tenu à l'échelle garde le sien (sa mesure), et la bulle le sien.
    const papier = dansLaPage();
    let mesure = tenirALEchelle(papier, 794);
    const ecoutesDesBulles = () => ecoutes.map(([, f]) => f).filter((f) => f !== mesure);
    assert.deepEqual(ecoutes.map(([type]) => type), ["resize", "resize"]);
    const troisieme = dansLaPage();
    tenirLaBulle(troisieme, () => appels.push("troisième"));
    assert.equal(ecoutes.length, 2);
    assert.ok(ecoutes.some(([, f]) => f === mesure), "le papier écoute encore");
    const [ecouteDeLaTroisieme] = ecoutesDesBulles();
    mesure = tenirALEchelle(papier, 794);
    assert.equal(ecoutes.length, 2);
    assert.deepEqual(ecoutesDesBulles(), [ecouteDeLaTroisieme], "la bulle écoute encore");
    lacherLaSeconde();
    assert.equal(ecoutes.length, 2, "le lacher d'une bulle remplacée ne retire rien");

    // La bulle quitte la page : au changement de taille qui suit, son écouteur se retire, sans rien replacer.
    troisieme.remove();
    ecouteDeLaTroisieme();
    assert.deepEqual(appels, ["première", "seconde"]);
    assert.deepEqual(ecoutes.map(([, f]) => f), [mesure]);

    // Une bulle pas encore posée dans la page (l'écran se construit hors d'elle) garde son écouteur.
    const neuve = document.createElement("div");
    const lacherLaNeuve = tenirLaBulle(neuve, () => appels.push("neuve"));
    const [ecouteDeLaNeuve] = ecoutesDesBulles();
    ecouteDeLaNeuve();
    assert.deepEqual(ecoutesDesBulles(), [ecouteDeLaNeuve]);
    assert.deepEqual(appels, ["première", "seconde"]);
    document.body.append(neuve);
    ecouteDeLaNeuve();
    assert.deepEqual(appels, ["première", "seconde", "neuve"]);
    // Vue dans la page, puis partie : son écouteur se retire.
    neuve.remove();
    ecouteDeLaNeuve();
    assert.deepEqual(appels, ["première", "seconde", "neuve"]);
    assert.deepEqual(ecoutes.map(([, f]) => f), [mesure]);
    lacherLaNeuve();
    assert.deepEqual(ecoutes.map(([, f]) => f), [mesure]);
    // lacher() retire l'écouteur de sa bulle, et lui seul.
    const lacherLaDerniere = tenirLaBulle(dansLaPage(), () => appels.push("dernière"));
    assert.equal(ecoutesDesBulles().length, 1);
    lacherLaDerniere();
    assert.deepEqual(ecoutes.map(([, f]) => f), [mesure]);
    assert.ok(ecoutes.every(([type]) => type === "resize"), "aucun écouteur de défilement, à aucun moment");
  } finally {
    Object.assign(globalThis, { addEventListener: avant.add, removeEventListener: avant.remove, requestAnimationFrame: avant.raf });
    retirer();
  }
  // Sans fenêtre (Node), rien ne lève.
  const lacher = tenirLaBulle({ isConnected: false }, () => {});
  assert.doesNotThrow(lacher);
});

// ─── Le document simulé ─────────────────────────────────────────────────────

test("document simulé — style, focus et défilement relevés, boîtes prêtées, contains, une fenêtre de 1 280 × 800 ; des relevés vides à chaque installation", () => {
  let retirer = installerDom();
  try {
    // La page : html, la fenêtre, puis body.
    const { documentElement: racine, body } = document;
    assert.equal(racine.tagName, "HTML");
    assert.deepEqual([racine.clientWidth, racine.clientHeight], [1280, 800]);
    assert.equal(body.parentNode, racine);
    assert.deepEqual([racine.isConnected, body.isConnected], [true, true]);
    const div = document.createElement("div");
    const span = document.createElement("span");
    div.append(span);
    assert.equal(span.isConnected, false);
    body.append(div);
    assert.equal(span.isConnected, true);

    // contains : le nœud lui-même et ses descendants.
    assert.deepEqual([div.contains(span), div.contains(div), span.contains(div), div.contains(null), racine.contains(span)], [true, true, false, false, true]);
    assert.equal(body.contains(document.createElement("p")), false);

    // Le style : propre à chaque élément, ses écritures relevées dans l'ordre.
    assert.ok(Object.hasOwn(div, "style"));
    assert.notEqual(div.style, span.style);
    assert.equal(div.style.getPropertyValue("--bulle-haut"), "");
    div.style.setProperty("--bulle-haut", "12px");
    div.style.setProperty("--bulle-haut", 14);
    assert.equal(div.style.getPropertyValue("--bulle-haut"), "14");
    assert.equal(div.style.removeProperty("--bulle-haut"), "14");
    assert.equal(div.style.getPropertyValue("--bulle-haut"), "");
    div.style.setProperty("--echelle", "0.5");
    div.style.setProperty("--echelle", "");
    assert.equal(div.style.getPropertyValue("--echelle"), "", "une valeur vide retire la propriété");
    assert.deepEqual(div.style.ecritures, [["--bulle-haut", "12px"], ["--bulle-haut", "14"], ["--bulle-haut", null], ["--echelle", "0.5"], ["--echelle", ""]]);
    assert.deepEqual(span.style.ecritures, []);
    // Réassignable : un contrôle peut prêter le sien.
    const prete = { setProperty() {} };
    div.style = prete;
    assert.equal(div.style, prete);

    // Le focus : l'élément actif, et chaque focus relevé avec ses options.
    div.focus({ preventScroll: true });
    span.focus();
    assert.equal(document.activeElement, span);
    assert.deepEqual(document.focalisations, [{ noeud: div, options: { preventScroll: true } }, { noeud: span, options: undefined }]);
    // scrollIntoView : relevé, rien ne défile.
    span.scrollIntoView({ block: "start" });
    assert.deepEqual(document.defilements, [{ noeud: span, options: { block: "start" } }]);

    // La boîte : celle qu'un contrôle prête, des zéros sinon.
    assert.equal(span.rectangle, null);
    assert.deepEqual(span.getBoundingClientRect(), { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 });
    span.rectangle = { left: 10.5, top: 20, width: 30, height: 40 };
    assert.deepEqual(span.getBoundingClientRect(), { left: 10.5, top: 20, width: 30, height: 40, right: 40.5, bottom: 60, x: 10.5, y: 20 });
    span.rectangle = { width: 30 };
    assert.deepEqual(span.getBoundingClientRect(), { left: 0, top: 0, width: 30, height: 0, right: 30, bottom: 0, x: 0, y: 0 });

    // Le défilement d'une liste : deux nombres, à zéro, qu'un contrôle règle.
    assert.deepEqual([div.scrollTop, div.scrollHeight], [0, 0]);
    div.scrollHeight = 480;
    div.scrollTop = div.scrollHeight;
    assert.equal(div.scrollTop, 480);

    // Toujours sans propagation : un écouteur en capture, un appui au doigt se déclenchent à la main.
    const vus = [];
    div.addEventListener("click", (evenement) => vus.push(["capture", evenement.target]), true);
    span.addEventListener("pointerdown", (evenement) => vus.push([evenement.type, evenement.pointerType]));
    span.click();
    assert.deepEqual(vus, [], "le clic sur l'enfant ne remonte pas");
    div.declencher("click", { target: span });
    span.declencher("pointerdown", { pointerType: "touch" });
    assert.deepEqual(vus, [["capture", span], ["pointerdown", "touch"]]);
    assert.deepEqual([typeof globalThis.matchMedia, typeof globalThis.ResizeObserver], ["undefined", "undefined"]);
  } finally {
    retirer();
  }
  // Une nouvelle installation : des relevés vides.
  retirer = installerDom();
  const bouton = document.createElement("button");
  try {
    assert.deepEqual([document.focalisations, document.defilements], [[], []]);
  } finally {
    retirer();
  }
  // Hors d'un document installé, focus et scrollIntoView ne lèvent rien.
  assert.doesNotThrow(() => bouton.focus({ preventScroll: true }));
  assert.doesNotThrow(() => bouton.scrollIntoView());
});
