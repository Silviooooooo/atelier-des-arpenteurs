// Contrôle du défilement de l'écran du combat (SPECIFICATION.md, § 17,
// « Le simulateur de combat (lot 4) » ; contrat du lot 4, groupe 2, § 0.2,
// règle 2, § 9.10, § 9.11 et § 14 É5 a ; complément, § 4.5).
//
// L'écran ne fait jamais défiler la page de lui-même : la bulle est à côté
// du jeton, la commande qui attend est déjà à l'écran. La règle se lit dans
// les sources de js/ecrans/combat*.js et de js/ecrans/echelle.js, telles
// qu'elles sont écrites, commentaires compris :
// - tout focus s'écrit .focus({ preventScroll: true }) ;
// - un seul scrollIntoView, dans montrerLeJournal() (combat.js), demandé
//   par un clic : { block: "start" } sur le journal, puis le focus sur son
//   titre, sans défiler de nouveau ;
// - ni scrollTo, ni scrollBy, ni window.scroll, ni scroll() d'un élément ;
// - un seul « scrollTop = », celui de la liste du journal (creerListe,
//   combat_journal.js), qui défile en elle-même pour montrer sa dernière
//   ligne.
// Le contrôle se voit armé sur des sources fautives fabriquées ici, chacune
// d'une seule faute ; le contrôle de l'écran (combat_ecran.test.js) relève,
// lui, chaque focus et chaque scrollIntoView du combat de référence joué.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const RACINE = new URL("../", import.meta.url);
// Les fins de ligne de l'arbre de travail varient d'un fichier à l'autre (CRLF ou LF) : la règle lit le texte, ramené à LF.
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8").replaceAll("\r\n", "\n");

// Les modules que la règle tient : chaque partie de l'écran du combat, et le
// module qui place la bulle.
const CHEMINS = [
  ...readdirSync(new URL("js/ecrans/", RACINE))
    .filter((nom) => /^combat.*\.js$/.test(nom))
    .map((nom) => `js/ecrans/${nom}`),
  "js/ecrans/echelle.js",
].sort();
const SOURCES = Object.fromEntries(CHEMINS.map((chemin) => [chemin, lire(chemin)]));

const ECRAN = "js/ecrans/combat.js";
const JOURNAL = "js/ecrans/combat_journal.js";
const FOCUS_PERMIS = ".focus({ preventScroll: true })";

/** Le numéro de la ligne d'une position. */
const ligneDe = (texte, position) => texte.slice(0, position).split("\n").length;

/**
 * L'étendue d'une fonction nommée, déclarée « function nom( » : de son
 * accolade ouvrante à celle qui la ferme, accolades comptées. null si elle
 * n'existe pas.
 */
function etendueDe(texte, nom) {
  const debut = texte.indexOf(`function ${nom}(`);
  if (debut < 0) return null;
  const ouvrante = texte.indexOf(") {", debut);
  if (ouvrante < 0) return null;
  let profondeur = 0;
  for (let i = ouvrante + 2; i < texte.length; i += 1) {
    if (texte[i] === "{") profondeur += 1;
    if (texte[i] === "}") {
      profondeur -= 1;
      if (profondeur === 0) return { debut, fin: i + 1 };
    }
  }
  return null;
}

const dansLaFonction = (texte, nom, position) => {
  const etendue = etendueDe(texte, nom);
  return etendue !== null && position > etendue.debut && position < etendue.fin;
};

/**
 * Les défauts de défilement d'un jeu de sources { chemin: texte } : une
 * phrase par faute, la liste vide quand la règle tient.
 */
function defautsDuDefilement(sources) {
  const defauts = [];
  const vues = [];
  const ecritures = [];
  for (const [chemin, texte] of Object.entries(sources)) {
    for (const trouve of texte.matchAll(/\.focus\s*\(/g)) {
      if (!texte.startsWith(FOCUS_PERMIS, trouve.index)) defauts.push(`${chemin}, ligne ${ligneDe(texte, trouve.index)} : un focus sans { preventScroll: true }`);
    }
    for (const trouve of texte.matchAll(/scrollIntoView/g)) vues.push({ chemin, position: trouve.index });
    for (const trouve of texte.matchAll(/\bscrollTo\b|\bscrollBy\b|\bwindow\.scroll\b|\.scroll\s*\(/g)) {
      defauts.push(`${chemin}, ligne ${ligneDe(texte, trouve.index)} : ${trouve[0]} fait défiler la page`);
    }
    for (const trouve of texte.matchAll(/\bscrollTop\s*[-+*/]?=(?!=)/g)) ecritures.push({ chemin, position: trouve.index });
  }
  if (vues.length !== 1) defauts.push(`${vues.length} scrollIntoView au lieu d'un seul`);
  else {
    const [{ chemin, position }] = vues;
    if (chemin !== ECRAN || !dansLaFonction(sources[chemin], "montrerLeJournal", position)) defauts.push(`le scrollIntoView est hors de montrerLeJournal() (${chemin}, ligne ${ligneDe(sources[chemin], position)})`);
  }
  if (ecritures.length !== 1) defauts.push(`${ecritures.length} « scrollTop = » au lieu d'un seul`);
  else {
    const [{ chemin, position }] = ecritures;
    if (chemin !== JOURNAL || !dansLaFonction(sources[chemin], "creerListe", position)) defauts.push(`le « scrollTop = » est hors de la liste du journal (${chemin}, ligne ${ligneDe(sources[chemin], position)})`);
  }
  return defauts;
}

/** Les sources réelles, retouchées : chaque retouche [chemin, avant, apres] remplace une fois « avant » par « apres ». */
function fautives(retouches) {
  const sources = { ...SOURCES };
  for (const [chemin, avant, apres] of retouches) {
    assert.ok(sources[chemin].includes(avant), `${chemin} contient « ${avant} »`);
    sources[chemin] = sources[chemin].replace(avant, apres);
  }
  return sources;
}
const fautive = (chemin, avant, apres) => fautives([[chemin, avant, apres]]);

test("défilement — la règle porte sur chaque partie de l'écran du combat et sur echelle.js", () => {
  for (const chemin of [
    "js/ecrans/combat.js",
    "js/ecrans/combat_action.js",
    "js/ecrans/combat_bulle.js",
    "js/ecrans/combat_fiches.js",
    "js/ecrans/combat_journal.js",
    "js/ecrans/combat_plateau.js",
    "js/ecrans/combat_preparation.js",
    "js/ecrans/echelle.js",
  ]) {
    assert.ok(CHEMINS.includes(chemin), chemin);
  }
  // Chaque focus des parties y est compté : la règle a de quoi mordre.
  const focus = Object.values(SOURCES).reduce((total, texte) => total + (texte.match(/\.focus\s*\(/g) ?? []).length, 0);
  assert.ok(focus >= 20, `${focus} focus lus`);
});

test("défilement — les sources tiennent la règle : chaque focus sans défiler, un seul scrollIntoView (montrerLeJournal), aucun scrollTo ni scrollBy, un seul « scrollTop = » (la liste du journal)", () => {
  assert.deepEqual(defautsDuDefilement(SOURCES), []);
});

test("défilement — montrerLeJournal() : le journal se montre par le haut, puis son titre reçoit le focus, sans défiler de nouveau", () => {
  const etendue = etendueDe(SOURCES[ECRAN], "montrerLeJournal");
  assert.ok(etendue, "montrerLeJournal() existe");
  const corps = SOURCES[ECRAN].slice(etendue.debut, etendue.fin);
  assert.match(corps, /journal\.scrollIntoView\(\{ block: "start" \}\);\s*titreDuJournal\.focus\(\{ preventScroll: true \}\);/);
  // Elle est le seul moyen du bandeau : « Journal ↓ », ou un clic à la souris sur lui.
  assert.match(SOURCES[ECRAN], /creerBandeau\(\{ montrerLeJournal, tient: services\.tient, surveiller: services\.surveiller \}\)/);
  // Le titre qu'elle focalise ne prend le focus que s'il le peut, sans entrer dans l'ordre du clavier.
  assert.match(SOURCES[ECRAN], /const titreDuJournal = el\("h2", \{ id: "combat-journal-titre", tabindex: "-1" \}, "Journal"\);/);
});

test("défilement — le contrôle voit chaque faute, une à la fois, sur des sources fautives", () => {
  const FAUTES = [
    ["un focus sans option", fautive("js/ecrans/combat_plateau.js", "pose.noeud.focus({ preventScroll: true })", "pose.noeud.focus()"), /combat_plateau\.js, ligne \d+ : un focus sans/],
    ["un focus qui défile", fautive(ECRAN, "h1.focus({ preventScroll: true });\n  }\n\n  // La question", "h1.focus({ preventScroll: false });\n  }\n\n  // La question"), /combat\.js, ligne \d+ : un focus sans/],
    ["un focus aux options prêtées", fautive("js/ecrans/combat_bulle.js", "cible.focus({ preventScroll: true });", "cible.focus(options);"), /combat_bulle\.js, ligne \d+ : un focus sans/],
    ["un focus d'echelle.js", { ...SOURCES, "js/ecrans/echelle.js": `${SOURCES["js/ecrans/echelle.js"]}\nexport const viser = (noeud) => noeud.focus();\n` }, /echelle\.js, ligne \d+ : un focus sans/],
    ["un second scrollIntoView", fautive("js/ecrans/combat_bulle.js", "cible.focus({ preventScroll: true });", "cible.scrollIntoView();\n    cible.focus({ preventScroll: true });"), /2 scrollIntoView au lieu d'un seul/],
    ["aucun scrollIntoView", fautive(ECRAN, 'journal.scrollIntoView({ block: "start" });', ""), /0 scrollIntoView au lieu d'un seul/],
    [
      "le scrollIntoView hors de montrerLeJournal()",
      fautives([
        [ECRAN, '    journal.scrollIntoView({ block: "start" });\n', ""],
        [ECRAN, "    h1.focus({ preventScroll: true });\n  }\n\n  // La question", '    journal.scrollIntoView({ block: "start" });\n    h1.focus({ preventScroll: true });\n  }\n\n  // La question'],
      ]),
      /le scrollIntoView est hors de montrerLeJournal\(\) \(js\/ecrans\/combat\.js, ligne \d+\)/,
    ],
    ["le scrollIntoView dans une autre partie", fautives([[ECRAN, '    journal.scrollIntoView({ block: "start" });\n', ""], ["js/ecrans/combat_bulle.js", "cible.focus({ preventScroll: true });", "cible.scrollIntoView();\n    cible.focus({ preventScroll: true });"]]), /hors de montrerLeJournal\(\) \(js\/ecrans\/combat_bulle\.js/],
    ["window.scrollTo", fautive("js/ecrans/combat_fiches.js", "(pareil ?? fiche.resume).focus({ preventScroll: true });", "(pareil ?? fiche.resume).focus({ preventScroll: true });\n    window.scrollTo(0, 0);"), /scrollTo fait défiler la page/],
    ["scrollBy", fautive("js/ecrans/combat_preparation.js", "?.focus({ preventScroll: true });", "?.focus({ preventScroll: true });\n      noeud.scrollBy(0, 40);"), /scrollBy fait défiler la page/],
    ["window.scroll", fautive("js/ecrans/combat_action.js", "champ.focus({ preventScroll: true });", "champ.focus({ preventScroll: true });\n    window.scroll(0, 0);"), /window\.scroll fait défiler la page/],
    ["scroll() d'un élément", fautive("js/ecrans/echelle.js", "export const FLECHE = 8;", "export const FLECHE = 8;\nexport const remonter = (noeud) => noeud.scroll({ top: 0 });"), /\.scroll\( fait défiler la page/],
    ["un second « scrollTop = »", fautive(ECRAN, "    journal.scrollIntoView", "    liste.noeud.scrollTop = 0;\n    journal.scrollIntoView"), /2 « scrollTop = » au lieu d'un seul/],
    ["un « scrollTop += »", fautive("js/ecrans/combat_bulle.js", "cible.focus({ preventScroll: true });", "cible.focus({ preventScroll: true });\n    defile.scrollTop += 10;"), /2 « scrollTop = » au lieu d'un seul/],
    [
      "le « scrollTop = » déplacé dans l'écran",
      fautives([
        [JOURNAL, "    if (ajoutees > 0 || !suite) noeud.scrollTop = noeud.scrollHeight;\n", ""],
        [ECRAN, "    journal.scrollIntoView", "    liste.noeud.scrollTop = liste.noeud.scrollHeight;\n    journal.scrollIntoView"],
      ]),
      /le « scrollTop = » est hors de la liste du journal \(js\/ecrans\/combat\.js/,
    ],
    [
      "le « scrollTop = » hors de creerListe",
      fautives([
        [JOURNAL, "    if (ajoutees > 0 || !suite) noeud.scrollTop = noeud.scrollHeight;\n", ""],
        [JOURNAL, "export function creerBandeau(", "const remonter = (noeud) => {\n  noeud.scrollTop = 0;\n};\n\nexport function creerBandeau("],
      ]),
      /le « scrollTop = » est hors de la liste du journal \(js\/ecrans\/combat_journal\.js/,
    ],
    ["aucun « scrollTop = »", fautive(JOURNAL, "noeud.scrollTop = noeud.scrollHeight;", "noeud.scrollHeight;"), /0 « scrollTop = » au lieu d'un seul/],
  ];
  for (const [quoi, sources, attendu] of FAUTES) {
    const defauts = defautsDuDefilement(sources);
    assert.ok(defauts.some((defaut) => attendu.test(defaut)), `${quoi} : ${JSON.stringify(defauts)}`);
  }
  // Une lecture n'est pas une écriture : comparer scrollTop ne fait rien défiler.
  assert.deepEqual(defautsDuDefilement(fautive(JOURNAL, "noeud.scrollTop = noeud.scrollHeight;", "noeud.scrollTop = noeud.scrollHeight;\n    if (noeud.scrollTop === 0) noeud.dataset;")), []);
});
