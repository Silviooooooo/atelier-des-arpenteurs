// Contrôles de la forme du groupe 3 du lot 4 (contrat du groupe, § 4 à § 6,
// § 9 ; SPECIFICATION.md, § 17.3 et § 17.8) : la version 4 des règles, les
// constantes neuves de js/combat/regles.js, et, dans js/combat/forme.js, les
// sept événements neufs (« intervenir », « contre_attaquer », « laisser »,
// « critique », « effet », « blessure », « mj »), les réglages « garde » et
// « cibles », la capacité figée.
//
// Chaque règle est vue des deux côtés : ce qui passe, puis la même donnée,
// changée d'un seul champ, qui ne passe plus. Le moment, la source permise,
// le prix et les bornes qui dépendent de l'état ne se jugent pas ici : c'est
// l'offre.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validerCapaciteFigee, validerContenu, validerEvenement } from "../js/combat/forme.js";
import {
  BORNES_EFFET,
  BORNES_MJ,
  BORNE_DEGATS,
  BORNE_REGLAGE,
  CHAMPS_MJ,
  DUREES_EFFET,
  GENRES_EFFET,
  GENRES_MJ,
  PLAFOND_ADVERSAIRES,
  PLAFOND_PJ,
  REGLES,
  RESSOURCES_RENDRE,
  ROLES,
  ROLES_SANS_BOUTON,
  SIGNES,
} from "../js/combat/regles.js";
import { adversaireEssai, capaciteEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

const RETOUR = String.fromCodePoint(0x0a);
const INSECABLES = [String.fromCodePoint(0x00a0), String.fromCodePoint(0x202f)];

const geleEnProfondeur = (valeur) =>
  valeur === null || typeof valeur !== "object" || (Object.isFrozen(valeur) && Object.values(valeur).every(geleEnProfondeur));

const parJson = (valeur) => JSON.parse(JSON.stringify(valeur));

/** La phrase du refus ; échoue si l'événement passe. */
function refusDe(donnee) {
  const rendu = validerEvenement(donnee);
  assert.equal(rendu.evenement, undefined, `aurait dû être refusé : ${JSON.stringify(donnee)}`);
  assert.equal(typeof rendu.erreur, "string");
  return rendu.erreur;
}

function passe(donnee) {
  const rendu = validerEvenement(donnee);
  assert.equal(rendu.erreur, undefined, JSON.stringify(donnee));
  return rendu.evenement;
}

// ─── Les données d'essai ────────────────────────────────────────────────────

// Deux capacités figées, telles qu'etatsDeLaBanque les rend (contrat, § 9) :
// puissance 0, sans rôle, le bloc pour groupe, sans jauge, une façon passive.
const ETOURDI = capaciteEssai({
  nom: "Étourdi",
  groupe: { genre: "capacites", titre: "États de cuisine" },
  facons: [faconEssai({ elements: ["Passif"], passif: true, description: `Il voit trente-six chandelles.${RETOUR}Un désavantage à ses jets.` })],
});
const MAIN_BRULEE = capaciteEssai({
  nom: "Main brûlée",
  groupe: { genre: "capacites", titre: "Blessure" },
  facons: [faconEssai({ elements: ["Passif"], passif: true, description: "La poêle était chaude." })],
});

const SOURCE_CAPACITE = { genre: "capacite", qui: "pj1", capacite: 2 };
const SOURCE_ETAT = { genre: "etat", effet: 14 };
const SOURCE_MJ = { genre: "mj" };

const PHOTO_PJ = structuredClone(pjEssai().valeurs);
const PHOTO_ADV = structuredClone(adversaireEssai().valeurs);

// Un exemple au moins par événement neuf, par genre d'effet, par genre du
// MJ, par ressource, par durée, par champ du MJ.
const EXEMPLES = [
  { type: "intervenir", qui: "pj1", capacite: 7, facon: 0 },
  { type: "contre_attaquer", capacite: 0, facon: 1 },
  { type: "laisser" },
  { type: "critique", tenter: true },
  { type: "critique", tenter: false },
  { type: "blessure", capacite: MAIN_BRULEE },
  { type: "blessure", libre: "Genou farineux" },
  { type: "regler", champ: "garde", valeur: { capacite: 1, facon: 0 } },
  { type: "regler", champ: "cibles", valeur: ["adv2", "pj1", "adv3"] },
  { type: "regler", champ: "cibles", valeur: ["adv2"] },
  { type: "effet", genre: "avantages", source: SOURCE_CAPACITE, nombre: 2 },
  { type: "effet", genre: "desavantages", source: SOURCE_MJ, nombre: 1 },
  { type: "effet", genre: "relancer", source: SOURCE_ETAT },
  { type: "effet", genre: "inverser", source: SOURCE_CAPACITE, x: 3 },
  { type: "effet", genre: "reussite", source: SOURCE_MJ },
  { type: "effet", genre: "zone", source: SOURCE_MJ, de: 0, zone: 2 },
  { type: "effet", genre: "multiplier", source: SOURCE_CAPACITE, k: 2 },
  { type: "effet", genre: "ajouter", source: SOURCE_MJ, n: 5 },
  { type: "effet", genre: "retrancher", source: SOURCE_ETAT, n: 3 },
  { type: "effet", genre: "armure", source: SOURCE_CAPACITE, x: 0, n: 4 },
  { type: "effet", genre: "directs", source: SOURCE_MJ, n: 0, nature: "corps" },
  { type: "effet", genre: "directs", source: SOURCE_MJ, n: 12, nature: "resistance" },
  { type: "effet", genre: "reporter", source: SOURCE_CAPACITE, sur: "adv3" },
  { type: "effet", genre: "toute_la_case", source: SOURCE_CAPACITE, cibles: ["adv2", "adv3", "adv4"] },
  { type: "effet", genre: "attaque_en_plus", source: SOURCE_CAPACITE },
  { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "souffle", n: 3 },
  { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "corps", n: 1 },
  { type: "effet", genre: "rendre", source: SOURCE_CAPACITE, sur: "pj1", ressource: "lien", n: 1, jauge: 0 },
  { type: "effet", genre: "rendre", source: SOURCE_ETAT, sur: "adv2", ressource: "armure", n: 4, zone: 1 },
  { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "endurance", n: 2, zone: 5 },
  { type: "effet", genre: "attaque", source: SOURCE_ETAT, sur: "adv2", n: -2, duree: "tour" },
  { type: "effet", genre: "defense", source: SOURCE_CAPACITE, sur: "pj1", n: 3, duree: "jet" },
  { type: "effet", genre: "defense", source: SOURCE_MJ, sur: "adv3", n: -20, duree: "combat" },
  { type: "effet", genre: "etat", source: SOURCE_CAPACITE, sur: "adv2", capacite: ETOURDI, duree: "tour" },
  { type: "effet", genre: "etat", source: SOURCE_MJ, sur: "pj1", libre: "Farine aux yeux", duree: "combat" },
  { type: "effet", genre: "etat", source: SOURCE_ETAT, sur: "pj1", libre: "Tablier en feu", duree: "jet" },
  { type: "effet", genre: "deplacer", source: SOURCE_ETAT, sur: "adv2", vers: "D5" },
  { type: "mj", genre: "valeurs", qui: "adv2", valeurs: [{ champ: "defense", valeur: 6 }, { champ: "attaque", valeur: 0 }, { champ: "bouclier", valeur: 2 }] },
  {
    type: "mj",
    genre: "valeurs",
    qui: "pj1",
    valeurs: [
      { champ: "armure", zone: 1, valeur: 4 },
      { champ: "endurance", zone: 1, valeur: 0 },
      { champ: "armure", zone: 2, valeur: 10 },
      { champ: "lien", jauge: 0, valeur: 2 },
      { champ: "souffle", valeur: 7 },
      { champ: "souffleMax", valeur: 12 },
      { champ: "actions", valeur: 1 },
      { champ: "actionsMax", valeur: 3 },
      { champ: "corps", valeur: 999 },
    ],
  },
  { type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [{ genre: "arme", nom: "Taloche" }, { genre: "qualite", objet: "Couteau d'office", avant: "2", apres: "3" }] },
  { type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [{ genre: "arme", nom: null }, { genre: "qualite", objet: "Couteau d'office", avant: null, apres: "1,5" }] },
  { type: "mj", genre: "equipement", qui: "adv2", photo: PHOTO_ADV, changements: [{ genre: "cellule", noms: ["Spatule souple", "Tablier épais"] }] },
  { type: "mj", genre: "equipement", qui: "adv3", photo: PHOTO_ADV, changements: [{ genre: "cellule", noms: [] }] },
  { type: "mj", genre: "etat", qui: "adv2", ajout: { capacite: ETOURDI, duree: "combat" } },
  { type: "mj", genre: "etat", qui: "pj1", ajout: { libre: "Tablier en feu", duree: "tour" } },
  { type: "mj", genre: "etat", qui: "adv2", retrait: 14 },
  { type: "mj", genre: "deplacer", qui: "adv2", vers: "D5" },
  { type: "mj", genre: "retirer", qui: "adv3" },
];

const TYPES_NEUFS = ["intervenir", "contre_attaquer", "laisser", "critique", "blessure", "regler", "effet", "mj"];

/** Les chemins des objets simples d'une donnée, elle comprise, hors d'une photographie et d'une capacité figée, qui ont leurs propres contrôles. */
function etages(valeur, chemin = []) {
  if (Array.isArray(valeur)) return valeur.flatMap((element, rang) => etages(element, [...chemin, rang]));
  if (valeur === null || typeof valeur !== "object") return [];
  if (["photo", "capacite"].includes(chemin.at(-1))) return [];
  return [chemin, ...Object.keys(valeur).flatMap((nom) => etages(valeur[nom], [...chemin, nom]))];
}

/** Une copie libre de la donnée, retouchée à l'étage que dit le chemin. */
function retouchee(donnee, chemin, retoucher) {
  const copie = structuredClone(donnee);
  retoucher(chemin.reduce((objet, cle) => objet[cle], copie), copie);
  return copie;
}

// ─── Les constantes ─────────────────────────────────────────────────────────

test("regles — la version 4 : un combat gardé d'avant le groupe 3 ne se reprend pas", () => {
  assert.equal(REGLES, 4);
  const miseEnPlace = miseEnPlaceEssai([{ photo: pjEssai(), case: "C3" }, { photo: adversaireEssai(), case: "D4" }]);
  const contenu = (regles) => parJson({ regles, revision: 1, miseEnPlace, evenements: [{ type: "lancer", le: "2026-10-26T21:30" }, { type: "passer", qui: "pj1" }] });
  // Le contenu d'un combat du lot 5, tel quel : une autre version, qui ne se lit pas plus loin.
  assert.deepEqual(validerContenu(contenu(3), { mode: "demo", revision: 1 }), { autreVersion: { regles: 3 } });
  assert.deepEqual(validerContenu({ regles: 3, revision: "?" }, { mode: "demo", revision: 1 }), { autreVersion: { regles: 3 } });
  // Le même, à la version d'ici, se reprend.
  assert.ok(validerContenu(contenu(4), { mode: "demo", revision: 1 }).contenu);
});

test("regles — attendre a son bouton : il n'est plus des rôles sans bouton", () => {
  assert.ok(ROLES.includes("attendre"));
  assert.ok(!ROLES_SANS_BOUTON.includes("attendre"));
  assert.deepEqual(ROLES_SANS_BOUTON, ["passer_son_tour", "jet_de_defense"]);
});

test("regles — les constantes du groupe 3 : genres, durées, ressources, champs du MJ, bornes ; gelées", () => {
  assert.deepEqual(GENRES_EFFET, [
    "avantages", "desavantages", "relancer", "inverser", "reussite", "zone", "multiplier", "ajouter", "retrancher", "armure", "directs", "reporter",
    "toute_la_case", "attaque_en_plus", "rendre", "attaque", "defense", "etat", "deplacer",
  ]);
  assert.deepEqual(DUREES_EFFET, ["jet", "tour", "combat"]);
  assert.deepEqual(RESSOURCES_RENDRE, ["souffle", "lien", "armure", "endurance", "corps"]);
  assert.deepEqual(GENRES_MJ, ["valeurs", "equipement", "etat", "deplacer", "retirer"]);
  assert.deepEqual(CHAMPS_MJ, ["attaque", "defense", "souffle", "souffleMax", "actions", "actionsMax", "lien", "corps", "armure", "endurance", "bouclier"]);
  assert.deepEqual(BORNES_EFFET, { nombre: 20, facteurMin: 2, facteurMax: 10, points: 999, ecart: 20, libre: 40, cibles: 72 });
  // Plusieurs cibles : autant qu'un combat compte de protagonistes au plus (choix 13), une case pouvant tous les tenir.
  assert.equal(BORNES_EFFET.cibles, PLAFOND_PJ + PLAFOND_ADVERSAIRES);
  assert.deepEqual(BORNES_MJ, { valeurs: 20, valeur: 999, changements: 40, noms: 40 });
  // Les mêmes bornes que la main : un effet ne va pas plus loin qu'un réglage.
  assert.equal(BORNES_EFFET.nombre, BORNE_REGLAGE);
  assert.equal(BORNES_EFFET.ecart, BORNE_REGLAGE);
  assert.equal(BORNES_EFFET.points, BORNE_DEGATS);
  assert.equal(BORNES_MJ.valeur, BORNE_DEGATS);
  for (const constante of [GENRES_EFFET, DUREES_EFFET, RESSOURCES_RENDRE, GENRES_MJ, CHAMPS_MJ, BORNES_EFFET, BORNES_MJ, ROLES_SANS_BOUTON]) {
    assert.ok(geleEnProfondeur(constante));
  }
  assert.throws(() => GENRES_EFFET.push("autre"), TypeError);
  assert.throws(() => {
    BORNES_EFFET.cibles = 99;
  }, TypeError);
});

// ─── Les événements neufs ───────────────────────────────────────────────────

test("validerEvenement — chaque événement neuf, bien formé, est rendu en copie gelée, par JSON à l'identique", () => {
  assert.deepEqual([...new Set(EXEMPLES.map((exemple) => exemple.type))].sort(), [...TYPES_NEUFS].sort());
  const effets = EXEMPLES.filter((exemple) => exemple.type === "effet");
  const gestes = EXEMPLES.filter((exemple) => exemple.type === "mj");
  // Chaque genre, chaque ressource, chaque durée, chaque champ du MJ a son exemple.
  assert.deepEqual([...new Set(effets.map((exemple) => exemple.genre))], GENRES_EFFET);
  assert.deepEqual([...new Set(gestes.map((exemple) => exemple.genre))], GENRES_MJ);
  assert.deepEqual(new Set(effets.filter((exemple) => exemple.genre === "rendre").map((exemple) => exemple.ressource)), new Set(RESSOURCES_RENDRE));
  assert.deepEqual(new Set(effets.filter((exemple) => exemple.duree).map((exemple) => exemple.duree)), new Set(DUREES_EFFET));
  assert.deepEqual(new Set(gestes.flatMap((exemple) => (exemple.valeurs ?? []).map((valeur) => valeur.champ))), new Set(CHAMPS_MJ));
  for (const exemple of EXEMPLES) {
    const evenement = passe(parJson(exemple));
    assert.deepEqual(evenement, exemple);
    assert.ok(evenement !== exemple);
    assert.ok(geleEnProfondeur(evenement));
    // La copie passe par JSON à l'identique : c'est elle qui se garde.
    assert.deepEqual(parJson(evenement), exemple);
  }
});

test("validerEvenement — la copie ne partage rien avec la donnée", () => {
  const donnee = structuredClone(EXEMPLES.find((exemple) => exemple.genre === "toute_la_case"));
  const lu = passe(donnee);
  donnee.cibles.push("pj1");
  donnee.source.qui = "pj9";
  assert.deepEqual(lu.cibles, ["adv2", "adv3", "adv4"]);
  assert.equal(lu.source.qui, "pj1");
  const etat = structuredClone(EXEMPLES.find((exemple) => exemple.genre === "etat" && exemple.capacite));
  const figee = passe(etat).capacite;
  etat.capacite.facons[0].elements.push("Intervention");
  assert.deepEqual(figee.facons[0].elements, ["Passif"]);
  assert.ok(Object.isFrozen(figee.facons[0].elements));
  const equipement = structuredClone(EXEMPLES.find((exemple) => exemple.genre === "equipement"));
  const photo = passe(equipement).photo;
  equipement.photo.souffle = 1;
  equipement.changements[0].nom = "Couteau d'office";
  assert.equal(photo.souffle, PHOTO_PJ.souffle);
});

test("validerEvenement — un champ qui manque, à chaque étage de chaque événement neuf", () => {
  let vus = 0;
  for (const exemple of EXEMPLES) {
    for (const chemin of etages(exemple)) {
      const objet = chemin.reduce((o, cle) => o[cle], exemple);
      for (const champ of Object.keys(objet)) {
        // Le X d'un passif est facultatif : il a son propre contrôle.
        if (chemin.length === 0 && champ === "x") continue;
        refusDe(retouchee(exemple, chemin, (cible) => delete cible[champ]));
        vus += 1;
      }
    }
  }
  assert.ok(vus > 200, String(vus));
  // Sans son X, un effet payant reste un effet : X vaut alors 0 (contrat, § 5).
  const { x: _x, ...sansX } = EXEMPLES.find((exemple) => exemple.genre === "inverser");
  assert.deepEqual(passe(sansX), sansX);
});

test("validerEvenement — un champ en trop, à chaque étage de chaque événement neuf, est un refus", () => {
  let vus = 0;
  for (const exemple of EXEMPLES) {
    for (const chemin of etages(exemple)) {
      for (const [champ, valeur] of [["inconnu", 1], ["__proto__", null], ["raison", "Minutie"]]) {
        const donnee = retouchee(exemple, chemin, (cible) => Object.defineProperty(cible, champ, { value: valeur, enumerable: true }));
        refusDe(donnee);
        vus += 1;
      }
    }
  }
  assert.ok(vus > 150, String(vus));
  // Les champs d'un autre genre, ou d'un autre type, sont en trop aussi.
  for (const donnee of [
    { type: "laisser", genre: "mj" },
    { type: "critique", tenter: true, qui: "pj1" },
    { type: "intervenir", qui: "pj1", capacite: 0, facon: 0, cible: "adv2" },
    { type: "contre_attaquer", qui: "pj1", capacite: 0, facon: 0 },
    { type: "effet", genre: "relancer", source: SOURCE_MJ, n: 2 },
    { type: "effet", genre: "multiplier", source: SOURCE_MJ, k: 2, n: 2 },
    { type: "effet", genre: "attaque", source: SOURCE_MJ, sur: "adv2", n: 2, duree: "tour", zone: 0 },
    { type: "effet", genre: "etat", source: SOURCE_MJ, sur: "adv2", capacite: ETOURDI, libre: "Tablier en feu", duree: "tour" },
    { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "souffle", n: 3, jauge: 0 },
    { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "corps", n: 3, zone: 0 },
    { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "lien", n: 3, jauge: 0, zone: 0 },
    { type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "armure", n: 3, zone: 0, jauge: 0 },
    { type: "blessure", capacite: MAIN_BRULEE, libre: "Genou farineux" },
    { type: "mj", genre: "retirer", qui: "adv2", vers: "D5" },
    { type: "mj", genre: "deplacer", qui: "adv2", vers: "D5", sur: "adv2" },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { libre: "Tablier en feu", duree: "tour" }, retrait: 14 },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { capacite: ETOURDI, libre: "Tablier en feu", duree: "tour" } },
    { type: "mj", genre: "valeurs", qui: "adv2", valeurs: [{ champ: "defense", zone: 0, valeur: 6 }] },
    { type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "lien", jauge: 0, zone: 0, valeur: 2 }] },
    { type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "armure", zone: 0, jauge: 0, valeur: 2 }] },
    { type: "regler", champ: "garde", valeur: { capacite: 0, facon: 0 }, raison: "Minutie" },
    { type: "regler", champ: "cibles", valeur: ["adv2"], raison: "Minutie" },
  ]) {
    refusDe(donnee);
  }
});

test("validerEvenement — un X : seulement d'une capacité, entier positif ou nul", () => {
  const avecX = (source, x) => ({ type: "effet", genre: "reussite", source, x });
  for (const x of [0, 1, 6, 999]) assert.equal(passe(avecX(SOURCE_CAPACITE, x)).x, x);
  for (const x of [-1, 1.5, "3", null, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) refusDe(avecX(SOURCE_CAPACITE, x));
  // Toute autre source ne coûte rien : un X y est en trop, même nul.
  assert.equal(refusDe(avecX(SOURCE_MJ, 0)), "L'événement « effet » « reussite » : seule une capacité prend un « x ».");
  assert.equal(refusDe(avecX(SOURCE_ETAT, 2)), "L'événement « effet » « reussite » : seule une capacité prend un « x ».");
});

test("validerEvenement — chaque champ neuf mal typé", () => {
  const effet = (genre, champs, source = SOURCE_MJ) => ({ type: "effet", genre, source, ...champs });
  const valeursDuMj = (valeurs, qui = "pj1") => ({ type: "mj", genre: "valeurs", qui, valeurs });
  const equipement = (changements, photo = PHOTO_PJ, qui = "pj1") => ({ type: "mj", genre: "equipement", qui, photo, changements });
  const trous = new Array(2);
  const fautes = [
    // intervenir, contre_attaquer, critique.
    { type: "intervenir", qui: "Aubépine", capacite: 0, facon: 0 },
    { type: "intervenir", qui: "pj0", capacite: 0, facon: 0 },
    { type: "intervenir", qui: "pj1", capacite: -1, facon: 0 },
    { type: "intervenir", qui: "pj1", capacite: 0, facon: "0" },
    { type: "contre_attaquer", capacite: 1.5, facon: 0 },
    { type: "contre_attaquer", capacite: 0, facon: null },
    { type: "critique", tenter: 1 },
    { type: "critique", tenter: "true" },
    { type: "critique", tenter: null },
    // blessure.
    { type: "blessure", capacite: "Main brûlée" },
    { type: "blessure", capacite: null },
    { type: "blessure", capacite: [MAIN_BRULEE] },
    { type: "blessure", libre: 3 },
    { type: "blessure", libre: "" },
    { type: "blessure", libre: `Genou${RETOUR}farineux` },
    { type: "blessure", libre: null },
    // regler garde et cibles.
    { type: "regler", champ: "garde", valeur: null },
    { type: "regler", champ: "garde", valeur: [1, 0] },
    { type: "regler", champ: "garde", valeur: { capacite: -1, facon: 0 } },
    { type: "regler", champ: "garde", valeur: { capacite: 0, facon: 0.5 } },
    { type: "regler", champ: "garde", valeur: { capacite: 0 } },
    { type: "regler", champ: "cibles", valeur: "adv2" },
    { type: "regler", champ: "cibles", valeur: null },
    { type: "regler", champ: "cibles", valeur: [] },
    { type: "regler", champ: "cibles", valeur: ["adv2", "adv2"] },
    { type: "regler", champ: "cibles", valeur: ["Marmiton"] },
    { type: "regler", champ: "cibles", valeur: ["adv2", null] },
    { type: "regler", champ: "cibles", valeur: trous },
    // effet : le genre, la source.
    { type: "effet", source: SOURCE_MJ },
    { type: "effet", genre: "inconnu", source: SOURCE_MJ },
    { type: "effet", genre: "Reussite", source: SOURCE_MJ },
    { type: "effet", genre: 3, source: SOURCE_MJ },
    { type: "effet", genre: "constructor", source: SOURCE_MJ },
    { type: "effet", genre: "toString", source: SOURCE_MJ },
    { type: "effet", genre: "valeurs", qui: "pj1", source: SOURCE_MJ, valeurs: [] },
    effet("reussite", {}, null),
    effet("reussite", {}, "mj"),
    effet("reussite", {}, { genre: "pnj" }),
    effet("reussite", {}, { genre: "constructor" }),
    effet("reussite", {}, { genre: "capacite", qui: "pj1" }),
    effet("reussite", {}, { genre: "capacite", qui: "pj0", capacite: 0 }),
    effet("reussite", {}, { genre: "capacite", qui: "pj1", capacite: -1 }),
    effet("reussite", {}, { genre: "etat", effet: -1 }),
    effet("reussite", {}, { genre: "etat", effet: "14" }),
    effet("reussite", {}, { genre: "etat" }),
    effet("reussite", {}, { genre: "mj", qui: "pj1" }),
    // effet : les champs de chaque genre.
    effet("avantages", { nombre: "2" }),
    effet("avantages", { nombre: 1.5 }),
    effet("desavantages", { nombre: null }),
    effet("zone", { de: -1, zone: 0 }),
    effet("zone", { de: 0, zone: "1" }),
    effet("multiplier", { k: 2.5 }),
    effet("multiplier", { k: "2" }),
    effet("ajouter", { n: 2.5 }),
    effet("retrancher", { n: null }),
    effet("armure", { n: "4" }),
    effet("directs", { n: 4, nature: "normaux" }),
    effet("directs", { n: 4, nature: "armure" }),
    effet("directs", { n: 4, nature: null }),
    effet("reporter", { sur: null }),
    effet("reporter", { sur: "adv0" }),
    effet("toute_la_case", { cibles: "adv2" }),
    effet("toute_la_case", { cibles: ["adv2", "adv2"] }),
    effet("rendre", { sur: "pj1", ressource: "actions", n: 1 }),
    effet("rendre", { sur: "pj1", ressource: "Souffle", n: 1 }),
    effet("rendre", { sur: "pj1", ressource: null, n: 1 }),
    effet("rendre", { sur: "pj1", ressource: "lien", n: 1 }),
    effet("rendre", { sur: "pj1", ressource: "lien", n: 1, zone: 0 }),
    effet("rendre", { sur: "pj1", ressource: "armure", n: 1 }),
    effet("rendre", { sur: "pj1", ressource: "endurance", n: 1, jauge: 0 }),
    effet("rendre", { sur: "pj1", ressource: "armure", n: 1, zone: -1 }),
    effet("rendre", { sur: "pj1", ressource: "lien", n: 1, jauge: "0" }),
    effet("attaque", { sur: "adv2", n: 1.5, duree: "tour" }),
    effet("attaque", { sur: "adv2", n: "2", duree: "tour" }),
    effet("defense", { sur: "adv2", n: 2, duree: "tours" }),
    effet("defense", { sur: "adv2", n: 2, duree: null }),
    effet("etat", { sur: "pj1", duree: "tour" }),
    effet("etat", { sur: "pj1", libre: "Tablier en feu", duree: "manche" }),
    effet("etat", { sur: "pj1", capacite: { ...ETOURDI, role: "attendre" }, duree: "tour" }),
    effet("etat", { sur: "pj1", capacite: { ...ETOURDI, lien: 0 }, duree: "tour" }),
    effet("etat", { sur: "pj1", capacite: { ...ETOURDI, facons: [faconEssai({ arme: 0 })] }, duree: "tour" }),
    effet("deplacer", { sur: "adv2", vers: "K1" }),
    effet("deplacer", { sur: "adv2", vers: "d5" }),
    effet("deplacer", { sur: "adv2", vers: null }),
    // mj : le genre, qui.
    { type: "mj", qui: "pj1" },
    { type: "mj", genre: "inconnu", qui: "pj1" },
    { type: "mj", genre: "hasOwnProperty", qui: "pj1" },
    { type: "mj", genre: "reussite", qui: "pj1", source: SOURCE_MJ },
    { type: "mj", genre: "retirer", qui: "MJ" },
    { type: "mj", genre: "retirer" },
    // mj valeurs.
    valeursDuMj(null),
    valeursDuMj({ champ: "corps", valeur: 4 }),
    valeursDuMj([null]),
    valeursDuMj(trous),
    valeursDuMj([{ champ: "vitesse", valeur: 4 }]),
    valeursDuMj([{ champ: "Corps", valeur: 4 }]),
    valeursDuMj([{ champ: "armure", valeur: 4 }]),
    valeursDuMj([{ champ: "endurance", jauge: 0, valeur: 4 }]),
    valeursDuMj([{ champ: "lien", valeur: 4 }]),
    valeursDuMj([{ champ: "souffle", zone: 0, valeur: 4 }]),
    valeursDuMj([{ champ: "armure", zone: "0", valeur: 4 }]),
    valeursDuMj([{ champ: "corps", valeur: "4" }]),
    valeursDuMj([{ champ: "corps", valeur: 4.5 }]),
    valeursDuMj([{ champ: "corps", valeur: null }]),
    // Deux fois la même valeur : aucune ne dirait laquelle compte.
    valeursDuMj([{ champ: "corps", valeur: 4 }, { champ: "corps", valeur: 5 }]),
    valeursDuMj([{ champ: "armure", zone: 0, valeur: 4 }, { champ: "armure", zone: 0, valeur: 5 }]),
    valeursDuMj([{ champ: "lien", jauge: 1, valeur: 4 }, { champ: "lien", jauge: 1, valeur: 5 }]),
    // mj equipement : les valeurs, les changements.
    equipement([{ genre: "arme", nom: "Taloche" }], null),
    equipement([{ genre: "arme", nom: "Taloche" }], { ...PHOTO_PJ, souffle: -1 }),
    equipement([{ genre: "arme", nom: "Taloche" }], { ...PHOTO_PJ, inconnu: 1 }),
    equipement([{ genre: "arme", nom: "Taloche" }], PHOTO_ADV),
    equipement([{ genre: "cellule", noms: [] }], PHOTO_PJ, "adv2"),
    equipement(null),
    equipement({ genre: "arme", nom: "Taloche" }),
    equipement([null]),
    equipement(trous),
    equipement([{ genre: "inconnu" }]),
    equipement([{ genre: "hasOwnProperty", nom: "Taloche" }]),
    equipement([{ genre: "arme" }]),
    equipement([{ genre: "arme", nom: "" }]),
    equipement([{ genre: "arme", nom: 3 }]),
    equipement([{ genre: "arme", nom: `Taloche${RETOUR}` }]),
    equipement([{ genre: "qualite", objet: null, avant: "2", apres: "3" }]),
    equipement([{ genre: "qualite", objet: "Couteau d'office", avant: 2, apres: "3" }]),
    equipement([{ genre: "qualite", objet: "Couteau d'office", avant: "2", apres: "2.5" }]),
    equipement([{ genre: "qualite", objet: "Couteau d'office", avant: "2", apres: "deux" }]),
    equipement([{ genre: "qualite", objet: "Couteau d'office", avant: "", apres: "3" }]),
    equipement([{ genre: "qualite", objet: "Couteau d'office", avant: "1,555", apres: "3" }]),
    equipement([{ genre: "cellule", noms: "Spatule souple" }], PHOTO_ADV, "adv2"),
    equipement([{ genre: "cellule", noms: [""] }], PHOTO_ADV, "adv2"),
    equipement([{ genre: "cellule", noms: [3] }], PHOTO_ADV, "adv2"),
    equipement([{ genre: "cellule", noms: trous }], PHOTO_ADV, "adv2"),
    // mj etat, deplacer.
    { type: "mj", genre: "etat", qui: "adv2" },
    { type: "mj", genre: "etat", qui: "adv2", retrait: -1 },
    { type: "mj", genre: "etat", qui: "adv2", retrait: "14" },
    { type: "mj", genre: "etat", qui: "adv2", retrait: null },
    { type: "mj", genre: "etat", qui: "adv2", ajout: null },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { duree: "tour" } },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { libre: "Tablier en feu" } },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { libre: "Tablier en feu", duree: "jet" } },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { libre: "", duree: "tour" } },
    { type: "mj", genre: "etat", qui: "adv2", ajout: { capacite: { ...ETOURDI, inactive: "absente de la banque", facons: [] }, duree: "tour" } },
    { type: "mj", genre: "deplacer", qui: "adv2", vers: "A11" },
    { type: "mj", genre: "deplacer", qui: "adv2" },
  ];
  for (const faute of fautes) refusDe(faute);
  // Les bornes du moment ne se jugent pas ici : une zone, une jauge, une
  // capacité, un effet qui n'existent pas, une ressource au-delà de son
  // maximum, une case qui est la sienne ont la bonne forme. C'est l'offre qui
  // les refusera.
  for (const lointain of [
    { type: "intervenir", qui: "pj99999", capacite: 5000, facon: 5000 },
    { type: "regler", champ: "garde", valeur: { capacite: 5000, facon: 5000 } },
    effet("zone", { de: 19, zone: 18 }),
    effet("rendre", { sur: "pj1", ressource: "lien", n: BORNE_DEGATS, jauge: 19 }),
    effet("reussite", {}, { genre: "etat", effet: 99999 }),
    { type: "mj", genre: "etat", qui: "adv2", retrait: 99999 },
    valeursDuMj([{ champ: "attaque", valeur: 4 }]),
    valeursDuMj([{ champ: "bouclier", valeur: 4 }], "adv2"),
  ]) {
    assert.deepEqual(passe(lointain), lointain);
  }
});

test("validerEvenement — chaque borne neuve, vue des deux côtés", () => {
  const effet = (genre, champs) => ({ type: "effet", genre, source: SOURCE_MJ, ...champs });
  const vus = { passent: 0, refuses: 0 };
  const voir = (passent, refuses) => {
    for (const donnee of passent) assert.deepEqual(passe(donnee), donnee);
    for (const donnee of refuses) refusDe(donnee);
    vus.passent += passent.length;
    vus.refuses += refuses.length;
  };
  // Avantages et désavantages : de 1 à 20.
  for (const genre of ["avantages", "desavantages"]) {
    voir([1, 20].map((nombre) => effet(genre, { nombre })), [0, 21, -1].map((nombre) => effet(genre, { nombre })));
  }
  // Multiplier : × 2 à × 10.
  voir([2, 10].map((k) => effet("multiplier", { k })), [1, 11, 0].map((k) => effet("multiplier", { k })));
  // Ajouter, retrancher, l'armure en plus : de 1 à 999 ; directs : de 0 à 999.
  for (const genre of ["ajouter", "retrancher", "armure"]) {
    voir([1, 999].map((n) => effet(genre, { n })), [0, 1000, -1].map((n) => effet(genre, { n })));
  }
  voir([0, 999].map((n) => effet("directs", { n, nature: "corps" })), [-1, 1000].map((n) => effet("directs", { n, nature: "corps" })));
  // Rendre : de 1 à 999.
  voir([1, 999].map((n) => effet("rendre", { sur: "pj1", ressource: "corps", n })), [0, 1000].map((n) => effet("rendre", { sur: "pj1", ressource: "corps", n })));
  // ±N : de −20 à 20, jamais 0.
  for (const genre of ["attaque", "defense"]) {
    voir([-20, -1, 1, 20].map((n) => effet(genre, { sur: "adv2", n, duree: "tour" })), [-21, 0, 21].map((n) => effet(genre, { sur: "adv2", n, duree: "tour" })));
  }
  // Un état libre : de 1 à 40 signes, partout où il se nomme.
  const libres = (libre) => [
    effet("etat", { sur: "pj1", libre, duree: "tour" }),
    { type: "blessure", libre },
    { type: "mj", genre: "etat", qui: "pj1", ajout: { libre, duree: "combat" } },
  ];
  voir(["a", "é".repeat(40)].flatMap(libres), ["", "é".repeat(41)].flatMap(libres));
  // Plusieurs cibles : de 1 au plafond des protagonistes (72), distinctes, au réglage comme à « toute la case » ;
  // treize ne passent plus pour trop (choix 13).
  const ids = (combien) => Array.from({ length: combien }, (_, rang) => `adv${rang + 2}`);
  const cibles = (liste) => [{ type: "regler", champ: "cibles", valeur: liste }, effet("toute_la_case", { cibles: liste })];
  voir([...cibles(ids(1)), ...cibles(ids(13)), ...cibles(ids(72))], [...cibles(ids(0)), ...cibles(ids(73))]);
  // Les valeurs du MJ : de 1 à 20 entrées, chacune de 0 à 999.
  const vingt = [
    ...[0, 1, 2, 3, 4, 5].flatMap((zone) => [{ champ: "armure", zone, valeur: 1 }, { champ: "endurance", zone, valeur: 1 }]),
    ...["attaque", "defense", "souffle", "souffleMax", "actions", "actionsMax", "corps", "bouclier"].map((champ) => ({ champ, valeur: 1 })),
  ];
  assert.equal(vingt.length, BORNES_MJ.valeurs);
  const valeursDuMj = (valeurs) => ({ type: "mj", genre: "valeurs", qui: "pj1", valeurs });
  voir(
    [valeursDuMj(vingt), valeursDuMj([{ champ: "corps", valeur: 0 }]), valeursDuMj([{ champ: "corps", valeur: 999 }])],
    [valeursDuMj([...vingt, { champ: "lien", jauge: 0, valeur: 1 }]), valeursDuMj([]), valeursDuMj([{ champ: "corps", valeur: -1 }]), valeursDuMj([{ champ: "corps", valeur: 1000 }])],
  );
  // L'équipement : de 1 à 40 changements ; de 0 à 40 noms dans une cellule.
  const equipement = (changements) => ({ type: "mj", genre: "equipement", qui: "adv2", photo: PHOTO_ADV, changements });
  const cellule = (combien) => ({ genre: "cellule", noms: Array.from({ length: combien }, () => "Spatule souple") });
  const changements = (combien) => Array.from({ length: combien }, () => cellule(1));
  voir(
    [equipement(changements(1)), equipement(changements(40)), equipement([cellule(0)]), equipement([cellule(40)])],
    [equipement(changements(0)), equipement(changements(41)), equipement([cellule(41)])],
  );
  assert.ok(vus.passent > 40 && vus.refuses > 40, JSON.stringify(vus));
});

test("validerEvenement — l'erreur est une phrase, qui nomme l'événement et son genre, et ne recopie rien d'hostile", () => {
  const moins = SIGNES.moins;
  const phrases = [
    [{ type: "effet", source: SOURCE_MJ, k: 2 }, "L'événement « effet » n'a pas de champ « genre »."],
    [{ type: "effet", genre: `hostile${RETOUR}`, source: SOURCE_MJ }, "L'événement « effet » : son genre n'est pas connu."],
    [{ type: "mj", genre: "toString", qui: "pj1" }, "L'événement « mj » : son genre n'est pas connu."],
    [{ type: "effet", genre: "multiplier", source: SOURCE_MJ }, "L'événement « effet » « multiplier » n'a pas de champ « k »."],
    [{ type: "effet", genre: "multiplier", source: SOURCE_MJ, k: 11 }, "L'événement « effet » « multiplier » : « k » n'est pas un entier de 2 à 10."],
    [{ type: "effet", genre: "ajouter", source: SOURCE_MJ, n: 1000 }, "L'événement « effet » « ajouter » : « n » n'est pas un entier de 1 à 999."],
    [{ type: "effet", genre: "attaque", source: SOURCE_MJ, sur: "adv2", n: 0, duree: "tour" }, `L'événement « effet » « attaque » : « n » n'est pas un entier de ${moins}20 à 20, autre que 0.`],
    [{ type: "effet", genre: "reussite", source: { genre: "pnj" } }, "L'événement « effet » « reussite » : sa source n'est ni une capacité, ni un état, ni le MJ."],
    [{ type: "effet", genre: "reussite", source: { genre: "mj", [`hostile${RETOUR}`]: 1 } }, "L'événement « effet » « reussite » : sa source porte un champ inconnu."],
    [{ type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "souffle", n: 3, zone: 0 }, "L'événement « effet » « rendre » ne prend pas de « zone » pour « souffle »."],
    [{ type: "effet", genre: "rendre", source: SOURCE_MJ, sur: "pj1", ressource: "lien", n: 3 }, "L'événement « effet » « rendre » n'a pas de champ « jauge »."],
    [{ type: "effet", genre: "etat", source: SOURCE_MJ, sur: "pj1", libre: "é".repeat(41), duree: "tour" }, "L'événement « effet » « etat » : « libre » dépasse 40 signes."],
    [
      { type: "effet", genre: "etat", source: SOURCE_MJ, sur: "pj1", capacite: { ...ETOURDI, role: "attendre" }, duree: "tour" },
      "L'événement « effet » « etat » : sa capacité est refusée : « Étourdi » porte un rôle câblé : une capacité figée n'en a pas.",
    ],
    [{ type: "blessure" }, "L'événement « blessure » porte « capacite » ou « libre » : l'un des deux."],
    [{ type: "blessure", capacite: { ...MAIN_BRULEE, lien: 0 } }, "L'événement « blessure » : sa capacité est refusée : la jauge de lien de « Main brûlée » ne désigne rien dans sa liste."],
    [{ type: "critique", tenter: 1 }, "L'événement « critique » : « tenter » n'est ni vrai ni faux."],
    [{ type: "regler", champ: "cibles", valeur: ["adv2", "adv2"] }, "L'événement « regler » « cibles » : sa valeur nomme deux fois la même cible."],
    [{ type: "regler", champ: "cibles", valeur: [] }, "L'événement « regler » « cibles » : sa valeur n'est pas une liste de 1 à 72 cibles."],
    [{ type: "regler", champ: "garde", valeur: { capacite: 0 } }, "L'événement « regler » « garde » : sa valeur n'a pas de champ « facon »."],
    [{ type: "mj", genre: "valeurs", qui: "pj1", valeurs: [] }, "L'événement « mj » « valeurs » : « valeurs » n'est pas une liste de 1 à 20 valeurs."],
    [{ type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "corps", valeur: 4 }, { champ: "corps", valeur: 5 }] }, "L'événement « mj » « valeurs » : la valeur n° 2 change une valeur déjà changée."],
    [{ type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "armure", valeur: 4 }] }, "L'événement « mj » « valeurs » : la valeur n° 1 n'a pas de champ « zone »."],
    [{ type: "mj", genre: "etat", qui: "pj1" }, "L'événement « mj » « etat » porte « ajout » ou « retrait » : l'un des deux."],
    [{ type: "mj", genre: "etat", qui: "pj1", ajout: { libre: "Tablier en feu", duree: "jet" } }, "L'événement « mj » « etat » : son ajout : « duree » n'est pas une valeur connue."],
    [{ type: "mj", genre: "etat", qui: "pj1", retrait: -1 }, "L'événement « mj » « etat » : « retrait » n'est pas l'identifiant d'un effet."],
    [{ type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [{ genre: "lame" }] }, "L'événement « mj » « equipement » : le changement n° 1 n'est ni une arme, ni une qualité, ni une cellule."],
    [
      { type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [{ genre: "qualite", objet: "Couteau d'office", avant: "2", apres: "2.5" }] },
      "L'événement « mj » « equipement » : le changement n° 1 : « apres » n'est ni une qualité (« 2 », « 1,5 ») ni rien.",
    ],
  ];
  for (const [donnee, phrase] of phrases) assert.equal(refusDe(donnee), phrase);
});

// ─── La capacité figée ──────────────────────────────────────────────────────

test("validerCapaciteFigee — une capacité de bloc, au format de la photographie, rendue en copie gelée", () => {
  for (const figee of [ETOURDI, MAIN_BRULEE]) {
    const { capacite, erreur } = validerCapaciteFigee(parJson(figee));
    assert.equal(erreur, undefined);
    assert.deepEqual(capacite, figee);
    assert.ok(geleEnProfondeur(capacite));
  }
  const donnee = structuredClone(ETOURDI);
  const { capacite } = validerCapaciteFigee(donnee);
  assert.ok(capacite !== donnee);
  donnee.facons[0].elements.push("Intervention");
  assert.deepEqual(capacite.facons[0].elements, ["Passif"]);
  // Plusieurs façons, un coût, une description de deux lignes : tout ce qu'une capacité de photographie porte.
  const riche = capaciteEssai({
    nom: "Étourdi",
    niveau: 2,
    groupe: { genre: "capacites", titre: "États de cuisine" },
    facons: [faconEssai({ puissance: 1, cout: { souffle: "X", lien: 0 } }), faconEssai({ puissance: 2, description: `Sonné.${RETOUR}Encore.` })],
  });
  assert.deepEqual(validerCapaciteFigee(riche).capacite, riche);
});

test("validerCapaciteFigee — ni arme, ni jauge, ni rôle câblé, ni absente de la banque ; ses champs, eux seuls", () => {
  const refus = (retoucher) => {
    const donnee = structuredClone(ETOURDI);
    retoucher(donnee);
    const rendu = validerCapaciteFigee(donnee);
    assert.equal(rendu.capacite, undefined);
    return rendu.erreur;
  };
  assert.equal(refus((c) => (c.facons[0].arme = 0)), "l'arme de la façon n° 1 de « Étourdi » ne désigne rien dans sa liste.");
  assert.equal(refus((c) => (c.lien = 0)), "la jauge de lien de « Étourdi » ne désigne rien dans sa liste.");
  assert.equal(refus((c) => (c.role = "attendre")), "« Étourdi » porte un rôle câblé : une capacité figée n'en a pas.");
  assert.equal(refus((c) => (c.role = "bonus_force")), "« Étourdi » porte un rôle câblé : une capacité figée n'en a pas.");
  assert.equal(refus((c) => Object.assign(c, { inactive: "absente de la banque", facons: [] })), "« Étourdi » est dite absente de la banque.");
  assert.equal(refus((c) => delete c.nom), "la capacité figée n'a pas de champ « nom ».");
  assert.equal(refus((c) => (c.inconnu = 1)), "la capacité figée porte un champ inconnu.");
  assert.equal(refus((c) => (c.facons[0].inconnu = 1)), "la façon n° 1 de « Étourdi » porte un champ inconnu.");
  assert.equal(refus((c) => (c.nom = `Étour${RETOUR}di`)), "le nom de la capacité figée porte un retour à la ligne ou un caractère de contrôle.");
  assert.equal(refus((c) => (c.role = "inconnu")), "le rôle de « Étourdi » n'est pas une valeur connue.");
  for (const donnee of [null, undefined, "Étourdi", 3, [], [ETOURDI], new Map()]) {
    assert.equal(validerCapaciteFigee(donnee).erreur, "la capacité figée n'est pas un objet simple.");
  }
});

// ─── L'équipement du MJ ─────────────────────────────────────────────────────

test("validerEvenement — l'équipement du MJ : les valeurs d'une photographie du camp de « qui », lues comme à l'ajout", () => {
  const equipement = (qui, photo) => ({ type: "mj", genre: "equipement", qui, photo, changements: [{ genre: "arme", nom: "Taloche" }] });
  assert.deepEqual(passe(equipement("pj1", PHOTO_PJ)).photo, PHOTO_PJ);
  assert.deepEqual(passe(equipement("adv2", PHOTO_ADV)).photo, PHOTO_ADV);
  // L'identifiant dit le camp : les valeurs d'un personnage ne vont pas à un adversaire, ni l'inverse.
  assert.equal(refusDe(equipement("adv2", PHOTO_PJ)), "L'événement « mj » « equipement » : sa photographie est refusée : la face de contre-attaque n'est pas celle de son camp.");
  assert.match(refusDe(equipement("pj1", PHOTO_ADV)), /^L'événement « mj » « equipement » : sa photographie est refusée : /);
  // Une photographie entière (son camp, sa source) n'est pas des valeurs.
  refusDe(equipement("pj1", pjEssai()));
  // Les bornes d'une photographie valent ici aussi.
  const tropLongue = structuredClone(PHOTO_PJ);
  tropLongue.nom = "é".repeat(201);
  assert.equal(refusDe(equipement("pj1", tropLongue)), "L'événement « mj » « equipement » : sa photographie est refusée : le nom dépasse 200 signes.");
});

// ─── Le contenu, et ce qui ne lève jamais ───────────────────────────────────

test("validerContenu — un combat de la version 4 garde les événements neufs ; un mal formé est refusé à son rang", () => {
  const miseEnPlace = miseEnPlaceEssai([{ photo: pjEssai(), case: "C3" }, { photo: adversaireEssai(), case: "D4" }]);
  const evenements = [{ type: "lancer", le: "2026-10-26T21:30" }, ...EXEMPLES];
  const contenu = parJson({ regles: REGLES, revision: 1, miseEnPlace, evenements });
  const rendu = validerContenu(contenu, { mode: "demo", revision: 1 });
  assert.equal(rendu.erreur, undefined);
  assert.equal(rendu.contenu.evenements.length, EXEMPLES.length + 1);
  assert.ok(geleEnProfondeur(rendu.contenu.evenements));
  assert.equal(contenu.evenements[4].type, "critique");
  contenu.evenements[4].tenter = "oui";
  assert.equal(validerContenu(contenu, { mode: "demo", revision: 1 }).erreur, "L'événement n° 5 est refusé : L'événement « critique » : « tenter » n'est ni vrai ni faux.");
});

test("le socle — aucune fonction ne lève, même sur une donnée piégée dans un champ neuf", () => {
  const piege = (objet, champ) => Object.defineProperty(objet, champ, { enumerable: true, get: () => { throw new Error("piège"); } });
  const lisible = "L'événement ne se lit pas.";
  for (const donnee of [
    piege({ type: "effet", source: SOURCE_MJ }, "genre"),
    piege({ type: "effet", genre: "reussite" }, "source"),
    { type: "effet", genre: "reussite", source: piege({}, "genre") },
    { type: "effet", genre: "reussite", source: piege({ genre: "etat" }, "effet") },
    piege({ type: "effet", genre: "reussite", source: SOURCE_CAPACITE }, "x"),
    { type: "regler", champ: "garde", valeur: piege({ capacite: 0 }, "facon") },
    { type: "regler", champ: "cibles", valeur: piege(["adv2"], "0") },
    { type: "blessure", capacite: piege(structuredClone(MAIN_BRULEE), "facons") },
    piege({ type: "blessure" }, "libre"),
    { type: "mj", genre: "valeurs", qui: "pj1", valeurs: [piege({ champ: "corps" }, "valeur")] },
    { type: "mj", genre: "equipement", qui: "pj1", photo: piege(structuredClone(PHOTO_PJ), "souffle"), changements: [] },
    { type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [piege({ genre: "arme" }, "nom")] },
    { type: "mj", genre: "etat", qui: "pj1", ajout: piege({ libre: "Tablier en feu" }, "duree") },
  ]) {
    assert.deepEqual(validerEvenement(donnee), { erreur: lisible });
  }
  assert.deepEqual(validerCapaciteFigee(piege(structuredClone(ETOURDI), "nom")), { erreur: "la capacité figée ne se lit pas." });
  assert.deepEqual(validerCapaciteFigee(piege(structuredClone(ETOURDI), "groupe")), { erreur: "la capacité figée ne se lit pas." });
});

test("le socle — aucune phrase neuve ne porte d'espace insécable, ni ce fichier", () => {
  const phrases = [
    refusDe({ type: "effet", genre: "attaque", source: SOURCE_MJ, sur: "adv2", n: 0, duree: "tour" }),
    refusDe({ type: "effet", genre: "multiplier", source: SOURCE_MJ, k: 11 }),
    refusDe({ type: "regler", champ: "cibles", valeur: [] }),
    refusDe({ type: "mj", genre: "valeurs", qui: "pj1", valeurs: [] }),
    refusDe({ type: "mj", genre: "equipement", qui: "pj1", photo: PHOTO_PJ, changements: [] }),
    refusDe({ type: "blessure", libre: "é".repeat(41) }),
    validerCapaciteFigee(null).erreur,
  ];
  for (const phrase of phrases) {
    for (const signe of INSECABLES) assert.ok(!phrase.includes(signe), phrase);
  }
  const source = readFileSync(new URL("./combat_forme_g3.test.js", import.meta.url), "utf8");
  for (const signe of INSECABLES) assert.ok(!source.includes(signe));
});
