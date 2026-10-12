// Contrôles du socle du simulateur de combat (SPECIFICATION.md, § 17 et § 11,
// domaine « Combat ») : les constantes de js/combat/regles.js, la forme de ce
// qui se garde (js/combat/forme.js) et les photographies d'essai dont se
// servent tous les autres contrôles du combat.
//
// Chaque règle est vue des deux côtés : ce qui passe, puis la même donnée,
// changée d'un seul champ, qui ne passe plus.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACE_CONTRE_ATTAQUE } from "../js/adversaire/notation.js";
import { validerContenu, validerEvenement, validerPhoto } from "../js/combat/forme.js";
import {
  ACTIONS_PJ,
  BORNES_PHOTO,
  BORNE_DEGATS,
  BORNE_REGLAGE,
  COLONNES,
  COTE,
  DIFFICULTES,
  ELEMENTS_COMBAT,
  EVENEMENTS_MAX,
  FACES_LOCALISATION,
  FACE_CONTRE,
  GRILLE_PJ,
  LETTRES,
  LONGUEUR_RAISON,
  MOTIF_CASE,
  PARAMETRE_LOC,
  PLAFOND_ADVERSAIRES,
  PLAFOND_EXEMPLAIRES,
  PLAFOND_PJ,
  REGLES,
  REUSSITES_MAX,
  ROLES,
  ROLES_PASSIFS,
  ROLES_SANS_BOUTON,
  SIGNES,
  geler,
  raisonValide,
} from "../js/combat/regles.js";
import { accepter } from "../js/personnage/format.js";
import { CARACTERISTIQUES, ZONES } from "../js/personnage/regles.js";
import { personnageEssai } from "./outils/personnage_essai.js";
import {
  adversaireEssai,
  ajouterPassif,
  aubepineEssai,
  capaciteEssai,
  chefDePartieEssai,
  etatEssai,
  faconEssai,
  marmitonDeCorveeEssai,
  miseEnPlaceEssai,
  pjEssai,
} from "./outils/photographies_essai.js";

// Les signes de contrôle se fabriquent par leur code : écrits tels quels, ils
// ne se verraient pas à la relecture.
const RETOUR = String.fromCodePoint(0x0a);
const CHARIOT = String.fromCodePoint(0x0d);
const TABULATION = String.fromCodePoint(0x09);
const NUL = String.fromCodePoint(0x00);
const SEPARATEUR_DE_LIGNE = String.fromCodePoint(0x2028);
const SEPARATEUR_DE_PARAGRAPHE = String.fromCodePoint(0x2029);
const INSECABLES = [String.fromCodePoint(0x00a0), String.fromCodePoint(0x202f)];

const geleEnProfondeur = (valeur) =>
  valeur === null || typeof valeur !== "object" || (Object.isFrozen(valeur) && Object.values(valeur).every(geleEnProfondeur));

const parJson = (valeur) => JSON.parse(JSON.stringify(valeur));

/** Une copie libre de la photographie, retouchée, telle qu'elle reviendrait d'un enregistrement. */
function retouchee(photo, retoucher) {
  const copie = structuredClone(photo);
  retoucher(copie.valeurs, copie);
  return copie;
}

/** La phrase du refus ; échoue si la photographie passe. */
function refusDe(photo, retoucher, options) {
  const rendu = validerPhoto(retouchee(photo, retoucher), options);
  assert.equal(rendu.photo, undefined, "la photographie aurait dû être refusée");
  assert.equal(typeof rendu.erreur, "string");
  return rendu.erreur;
}

function passe(photo, retoucher, options) {
  const donnee = retouchee(photo, retoucher);
  const rendu = validerPhoto(donnee, options);
  assert.equal(rendu.erreur, undefined);
  assert.deepEqual(rendu.photo, donnee);
  return rendu.photo;
}

// ─── Les constantes ─────────────────────────────────────────────────────────

test("regles — la grille des PJ égale celle des zones du personnage, face pour face", () => {
  const parCode = new Map(ZONES.map((zone) => [zone.code, zone.d20]));
  assert.equal(GRILLE_PJ.length, ZONES.length);
  for (const { code, debut, fin } of GRILLE_PJ) assert.equal(debut === fin ? String(debut) : `${debut}-${fin}`, parCode.get(code), code);
  // Dans l'ordre du d20, de 1 à 19 sans trou : la face 20 reste à la contre-attaque.
  assert.deepEqual(GRILLE_PJ.map((zone) => zone.code), ["tete", "torse", "jambe_gauche", "jambe_droite", "bras_gauche", "bras_droit"]);
  let attendue = 1;
  for (const { debut, fin } of GRILLE_PJ) {
    assert.equal(debut, attendue);
    attendue = fin + 1;
  }
  assert.equal(attendue, FACE_CONTRE.pj);
  assert.equal(FACE_CONTRE.pj, FACES_LOCALISATION);
});

test("regles — la face de contre-attaque d'un adversaire est celle de la notation des adversaires", () => {
  assert.equal(FACE_CONTRE.adv, FACE_CONTRE_ATTAQUE);
  assert.deepEqual(FACE_CONTRE, { pj: 20, adv: 1 });
});

test("regles — le plateau, les plafonds, les bornes", () => {
  assert.equal(REGLES, 1);
  assert.equal(COTE, 10);
  assert.equal(COLONNES, "ABCDEFGHIJ");
  assert.equal(COLONNES.length, COTE);
  for (const nom of ["A1", "A10", "J1", "J10", "D4"]) assert.ok(MOTIF_CASE.test(nom), nom);
  for (const nom of ["A0", "A11", "K1", "a1", "A01", " A1", "A1 ", "AA1", "", "A", "10"]) assert.ok(!MOTIF_CASE.test(nom), `« ${nom} » n'est pas une case`);
  assert.deepEqual([PLAFOND_PJ, PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES, EVENEMENTS_MAX], [12, 60, 12, 20000]);
  assert.deepEqual([ACTIONS_PJ, REUSSITES_MAX, FACES_LOCALISATION], [2, 3, 20]);
  assert.deepEqual(LETTRES, ["A", "B", "C"]);
  assert.deepEqual([BORNE_REGLAGE, BORNE_DEGATS, LONGUEUR_RAISON], [20, 999, 80]);
  assert.deepEqual(BORNES_PHOTO, { ligne: 200, texte: 4000, nombre: 9999, des: 20, faces: 100, capacites: 200, facons: 20, armes: 40, zones: 19, liens: 20, elements: 40, avertissements: 200 });
  assert.equal(PARAMETRE_LOC, "loc_multiple");
  assert.deepEqual(ELEMENTS_COMBAT, { intervention: "Intervention", passif: "Passif", degats: "Dégâts", portee: "Portée", locMultiple: "Localisation multiple", centre: "Centré" });
});

test("regles — les difficultés du livret, de 2 à 10, en minuscules", () => {
  assert.deepEqual(DIFFICULTES, {
    2: "extrêmement facile",
    3: "très facile",
    4: "facile",
    5: "moyen",
    6: "compliqué",
    7: "difficile",
    8: "très difficile",
    9: "extrêmement difficile",
    10: "quasi impossible",
  });
  for (const libelle of Object.values(DIFFICULTES)) assert.equal(libelle, libelle.toLowerCase());
  assert.equal(DIFFICULTES[1], undefined);
  assert.equal(DIFFICULTES[11], undefined);
});

test("regles — quinze rôles, dont huit passifs et trois sans bouton", () => {
  assert.deepEqual(ROLES, [
    "deplacement", "jet_de_caracteristique", "esquive", "attendre", "passer_son_tour", "jet_de_defense", "bonus_force", "bonus_agilite",
    "bonus_precision", "petit", "seul_sur_sa_case", "en_meute", "esprit_de_corps", "degrossir", "mains_nues",
  ]);
  assert.equal(new Set(ROLES).size, 15);
  assert.deepEqual(ROLES_PASSIFS, ["bonus_force", "bonus_agilite", "bonus_precision", "petit", "seul_sur_sa_case", "en_meute", "esprit_de_corps", "degrossir"]);
  assert.deepEqual(ROLES_SANS_BOUTON, ["passer_son_tour", "jet_de_defense", "attendre"]);
  for (const role of [...ROLES_PASSIFS, ...ROLES_SANS_BOUTON]) assert.ok(ROLES.includes(role), role);
  assert.ok(!ROLES_PASSIFS.some((role) => ROLES_SANS_BOUTON.includes(role)));
});

test("regles — les signes du journal sont ceux que disent leurs codes, et aucun n'est une espace", () => {
  const codes = Object.fromEntries(Object.entries(SIGNES).map(([nom, signe]) => [nom, [...signe].map((s) => s.codePointAt(0))]));
  assert.deepEqual(codes, { reussi: [0x2713], echoue: [0x2717], fleche: [0x2192], moins: [0x2212], tiret: [0x2014], point: [0x00b7] });
  // Le moins du journal n'est ni le trait d'union ni le tiret.
  assert.notEqual(SIGNES.moins, "-");
  assert.notEqual(SIGNES.moins, SIGNES.tiret);
});

test("regles — les constantes sont gelées : aucun module ne peut les changer pour les autres", () => {
  for (const constante of [FACE_CONTRE, GRILLE_PJ, LETTRES, DIFFICULTES, ELEMENTS_COMBAT, ROLES, ROLES_PASSIFS, ROLES_SANS_BOUTON, SIGNES, BORNES_PHOTO]) {
    assert.ok(geleEnProfondeur(constante));
  }
  assert.throws(() => ROLES.push("autre"), TypeError);
  assert.throws(() => {
    GRILLE_PJ[0].fin = 5;
  }, TypeError);
});

test("raisonValide — de 1 à 80 signes, sans blanc de bord, sans caractère de contrôle ni séparateur de ligne", () => {
  for (const raison of ["Émincer", "x", "Minutie, à deux mains", "a".repeat(LONGUEUR_RAISON), "à l'intérieur : des espaces"]) assert.equal(raisonValide(raison), true, raison);
  for (const raison of [
    "",
    "a".repeat(LONGUEUR_RAISON + 1),
    " Émincer",
    "Émincer ",
    `Émincer${RETOUR}`,
    `Émi${RETOUR}ncer`,
    `Émi${CHARIOT}ncer`,
    `Émi${TABULATION}ncer`,
    `Émi${NUL}ncer`,
    `Émi${String.fromCodePoint(0x7f)}ncer`,
    `Émi${String.fromCodePoint(0x85)}ncer`,
    `Émi${SEPARATEUR_DE_LIGNE}ncer`,
    `Émi${SEPARATEUR_DE_PARAGRAPHE}ncer`,
    null,
    undefined,
    12,
    ["Émincer"],
    { raison: "Émincer" },
  ]) {
    assert.equal(raisonValide(raison), false, JSON.stringify(raison));
  }
});

test("geler — en profondeur, les objets simples et les tableaux ; rend ce qu'il reçoit", () => {
  const valeur = { a: [1, { b: { c: [] } }], d: null, e: "texte" };
  assert.equal(geler(valeur), valeur);
  assert.ok(geleEnProfondeur(valeur));
  assert.throws(() => {
    valeur.a[1].b.c.push(1);
  }, TypeError);
  // Sans geler(), rien n'est gelé : le contrôle d'au-dessus voit bien quelque chose.
  assert.ok(!geleEnProfondeur({ a: [1] }));
  for (const simple of [null, undefined, 3, "texte", true]) assert.equal(geler(simple), simple);
});

test("geler — ne touche ni une Map ni une date ; ne reparcourt pas ce qui est déjà gelé ; supporte une boucle", () => {
  const table = new Map([["a", { b: 1 }]]);
  const date = new Date(0);
  const tenu = geler({ table, date });
  assert.ok(Object.isFrozen(tenu));
  assert.ok(!Object.isFrozen(table) && !Object.isFrozen(date));
  table.set("c", 2);
  // Un objet gelé à la main est cru fini : ce qu'il porte reste libre. C'est
  // la contrainte que dit regles.js, et ce qui épargne à un clic le parcours
  // du combat entier.
  const partage = Object.freeze({ libre: { n: 1 } });
  geler({ partage });
  assert.ok(!Object.isFrozen(partage.libre));
  const boucle = { nom: "boucle" };
  boucle.soi = boucle;
  assert.equal(geler(boucle), boucle);
  assert.ok(Object.isFrozen(boucle));
});

test("le socle n'importe que ce que dit son contrat, et n'écrit aucune espace insécable", () => {
  const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
  const imports = (source) => [...source.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gms)].map((trouve) => trouve[1]);
  assert.deepEqual(imports(lire("../js/combat/regles.js")), []);
  assert.deepEqual(imports(lire("../js/combat/forme.js")).sort(), ["../personnage/regles.js", "./regles.js"]);
  // Le lecteur d'imports voit ce qu'il doit voir : les deux formes, sur une ou plusieurs lignes.
  assert.deepEqual(imports(`import { a } from "./a.js";${RETOUR}import {${RETOUR}  b,${RETOUR}} from "../b.js";${RETOUR}export { c } from "./c.js";`), ["./a.js", "../b.js", "./c.js"]);
  for (const chemin of ["../js/combat/regles.js", "../js/combat/forme.js", "./outils/photographies_essai.js", "./combat_forme.test.js"]) {
    for (const signe of INSECABLES) assert.ok(!lire(chemin).includes(signe), `${chemin} porte une espace insécable`);
  }
  // Ni import à la volée, ni heure, ni hasard, ni appareil dans le noyau.
  for (const chemin of ["../js/combat/regles.js", "../js/combat/forme.js"]) {
    for (const mot of ["import(", "localeCompare", "toLocale", "Intl", "new Date", "Date.now", "Math.random", "document", "indexedDB"]) {
      assert.ok(!lire(chemin).includes(mot), `${chemin} : « ${mot} »`);
    }
  }
});

// ─── Les événements ─────────────────────────────────────────────────────────

const EXEMPLES = [
  { type: "lancer", le: "2026-10-12T21:30" },
  { type: "capacite", qui: "pj1", capacite: 1, facon: 0 },
  { type: "regler", champ: "facon", valeur: 1 },
  { type: "regler", champ: "jet_prete", valeur: true },
  { type: "regler", champ: "arme_pretee", valeur: 0 },
  { type: "regler", champ: "cible", valeur: "adv4" },
  { type: "regler", champ: "cible", valeur: null },
  { type: "regler", champ: "arrivee", valeur: "D4" },
  { type: "regler", champ: "caracteristiques", valeur: ["sens", "parole"] },
  { type: "regler", champ: "caracteristiques", valeur: ["force"] },
  { type: "regler", champ: "difficulte", valeur: 6 },
  { type: "regler", champ: "x", valeur: 3 },
  { type: "regler", champ: "jauge", valeur: 1 },
  { type: "regler", champ: "modificateur", valeur: 1, raison: "Minutie" },
  { type: "regler", champ: "modificateur", valeur: 0 },
  { type: "regler", champ: "avantages", valeur: -2, raison: "Sol glissant" },
  { type: "regler", champ: "avantages", valeur: 0, raison: "Minutie" },
  { type: "revenir" },
  { type: "confirmer" },
  { type: "de", faces: 10, valeurs: [6] },
  { type: "de", faces: 8, valeurs: [8, 4, 1] },
  { type: "de", faces: 20, valeurs: [20] },
  { type: "relancer" },
  { type: "garder" },
  { type: "exploser" },
  { type: "degats", base: "lettre", operations: [], nature: "normaux" },
  { type: "degats", base: "arme", operations: [{ op: "ajuster", valeur: 22, raison: "Émincer" }], nature: "normaux" },
  { type: "degats", base: "aucun", operations: [{ op: "ajuster", valeur: 4, raison: "Brûlure" }], nature: "resistance" },
  { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 0, raison: "Brûlure" }], nature: "corps" },
  { type: "decaler", de: 0, valeur: -2, raison: "Minutie" },
  { type: "decaler", de: 1, valeur: 0 },
  { type: "esquive", x: 3 },
  { type: "appliquer" },
  { type: "passer", qui: "adv12" },
  { type: "fin_de_tour" },
];

const TYPES = ["lancer", "capacite", "regler", "revenir", "confirmer", "de", "relancer", "garder", "exploser", "degats", "decaler", "esquive", "appliquer", "passer", "fin_de_tour"];

test("validerEvenement — chacun des quinze types, bien formé, est rendu en copie gelée", () => {
  assert.deepEqual([...new Set(EXEMPLES.map((exemple) => exemple.type))], TYPES);
  for (const exemple of EXEMPLES) {
    const rendu = validerEvenement(parJson(exemple));
    assert.equal(rendu.erreur, undefined, JSON.stringify(exemple));
    assert.deepEqual(rendu.evenement, exemple);
    assert.notEqual(rendu.evenement, exemple);
    assert.ok(geleEnProfondeur(rendu.evenement));
    // La copie passe par JSON à l'identique : c'est elle qui se garde.
    assert.deepEqual(parJson(rendu.evenement), exemple);
  }
});

test("validerEvenement — la copie ne partage rien avec la donnée", () => {
  const donnee = { type: "de", faces: 10, valeurs: [6, 2] };
  const { evenement } = validerEvenement(donnee);
  donnee.valeurs.push(9);
  assert.deepEqual(evenement.valeurs, [6, 2]);
  const degats = { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 5, raison: "Émincer" }], nature: "normaux" };
  const lu = validerEvenement(degats).evenement;
  degats.operations[0].valeur = 900;
  assert.equal(lu.operations[0].valeur, 5);
});

test("validerEvenement — un champ qui manque, pour chaque champ de chaque type", () => {
  let vus = 0;
  for (const exemple of EXEMPLES) {
    for (const champ of Object.keys(exemple)) {
      // La raison est facultative quand la valeur est nulle : elle a son propre contrôle.
      if (champ === "raison") continue;
      const { [champ]: _retire, ...reste } = exemple;
      const rendu = validerEvenement(reste);
      assert.equal(rendu.evenement, undefined, `${JSON.stringify(exemple)} sans « ${champ} »`);
      assert.equal(typeof rendu.erreur, "string");
      vus += 1;
    }
  }
  assert.ok(vus > 60);
});

test("validerEvenement — un champ en trop, pour chaque type, est un refus", () => {
  for (const exemple of EXEMPLES) {
    for (const [champ, valeur] of [["inconnu", 1], ["raison", "Minutie"], ["qui", "pj1"], ["__proto__", null]]) {
      if (Object.hasOwn(exemple, champ)) continue;
      // « raison » n'est en trop que là où elle n'est pas attendue.
      if (champ === "raison" && (exemple.type === "decaler" || ["modificateur", "avantages"].includes(exemple.champ))) continue;
      const donnee = { ...exemple };
      Object.defineProperty(donnee, champ, { value: valeur, enumerable: true });
      assert.equal(validerEvenement(donnee).evenement, undefined, `${JSON.stringify(exemple)} avec « ${champ} »`);
    }
  }
  // Une opération de dégâts n'a pas non plus de champ en trop.
  assert.ok(validerEvenement({ type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 1, raison: "x", de: 0 }], nature: "normaux" }).erreur);
});

test("validerEvenement — ce qui n'est pas un événement", () => {
  for (const donnee of [null, undefined, 3, "lancer", [], [{ type: "revenir" }], {}, { type: "inconnu" }, { type: 3 }, { type: "constructor" }, { type: "__proto__" }, { type: "Revenir" }, new Map(), new (class Evenement {})()]) {
    const rendu = validerEvenement(donnee);
    assert.equal(rendu.evenement, undefined);
    assert.equal(typeof rendu.erreur, "string");
  }
  class Revenir {
    type = "revenir";
  }
  assert.ok(validerEvenement(new Revenir()).erreur, "un objet d'une classe n'est pas un objet simple");
  assert.ok(validerEvenement(Object.assign(Object.create(null), { type: "revenir" })).evenement, "un objet sans prototype en est un");
});

test("validerEvenement — chaque champ mal typé", () => {
  const fautes = [
    // lancer : l'heure locale, à la minute.
    { type: "lancer", le: "2026-10-12T21:30:00" },
    { type: "lancer", le: "2026-10-12 21:30" },
    { type: "lancer", le: "2026-13-12T21:30" },
    { type: "lancer", le: "2026-10-32T21:30" },
    { type: "lancer", le: "2026-10-12T24:00" },
    { type: "lancer", le: "2026-10-12T21:60" },
    { type: "lancer", le: 1760304600000 },
    { type: "lancer", le: `2026-10-12T21:30${RETOUR}` },
    // capacite et passer : un identifiant fabriqué, des indices.
    { type: "capacite", qui: "pj0", capacite: 0, facon: 0 },
    { type: "capacite", qui: "pj01", capacite: 0, facon: 0 },
    { type: "capacite", qui: "pj123456", capacite: 0, facon: 0 },
    { type: "capacite", qui: "PJ1", capacite: 0, facon: 0 },
    { type: "capacite", qui: "allie1", capacite: 0, facon: 0 },
    { type: "capacite", qui: 1, capacite: 0, facon: 0 },
    { type: "capacite", qui: "pj1", capacite: -1, facon: 0 },
    { type: "capacite", qui: "pj1", capacite: 1.5, facon: 0 },
    { type: "capacite", qui: "pj1", capacite: "1", facon: 0 },
    { type: "capacite", qui: "pj1", capacite: 0, facon: -1 },
    { type: "capacite", qui: "pj1", capacite: 0, facon: null },
    { type: "capacite", qui: "pj1", capacite: Number.MAX_SAFE_INTEGER + 1, facon: 0 },
    { type: "passer", qui: "Aubépine" },
    { type: "passer", qui: null },
    // regler : la valeur de chaque champ.
    { type: "regler", champ: "inconnu", valeur: 1 },
    { type: "regler", champ: "constructor", valeur: 1 },
    { type: "regler", champ: 3, valeur: 1 },
    { type: "regler", champ: "facon", valeur: -1 },
    { type: "regler", champ: "facon", valeur: "0" },
    { type: "regler", champ: "jet_prete", valeur: 1 },
    { type: "regler", champ: "jet_prete", valeur: "true" },
    { type: "regler", champ: "arme_pretee", valeur: null },
    { type: "regler", champ: "arme_pretee", valeur: 0.5 },
    { type: "regler", champ: "cible", valeur: "Marmiton" },
    { type: "regler", champ: "cible", valeur: 4 },
    { type: "regler", champ: "cible", valeur: undefined },
    { type: "regler", champ: "arrivee", valeur: "K4" },
    { type: "regler", champ: "arrivee", valeur: "d4" },
    { type: "regler", champ: "arrivee", valeur: "D11" },
    { type: "regler", champ: "arrivee", valeur: null },
    { type: "regler", champ: "caracteristiques", valeur: [] },
    { type: "regler", champ: "caracteristiques", valeur: ["sens", "parole", "force"] },
    { type: "regler", champ: "caracteristiques", valeur: ["sens", "sens"] },
    { type: "regler", champ: "caracteristiques", valeur: ["Sens"] },
    { type: "regler", champ: "caracteristiques", valeur: ["charisme"] },
    { type: "regler", champ: "caracteristiques", valeur: "sens" },
    { type: "regler", champ: "difficulte", valeur: 6.5 },
    { type: "regler", champ: "difficulte", valeur: "6" },
    { type: "regler", champ: "x", valeur: null },
    { type: "regler", champ: "x", valeur: Number.NaN },
    { type: "regler", champ: "jauge", valeur: -1 },
    { type: "regler", champ: "modificateur", valeur: 1.5, raison: "Minutie" },
    { type: "regler", champ: "avantages", valeur: Infinity, raison: "Minutie" },
    // de : des faces, et des valeurs que ce dé peut montrer.
    { type: "de", faces: 1, valeurs: [1] },
    { type: "de", faces: BORNES_PHOTO.faces + 1, valeurs: [1] },
    { type: "de", faces: "10", valeurs: [1] },
    { type: "de", faces: 10, valeurs: [] },
    { type: "de", faces: 10, valeurs: 6 },
    { type: "de", faces: 10, valeurs: [0] },
    { type: "de", faces: 10, valeurs: [11] },
    { type: "de", faces: 10, valeurs: [6, 2.5] },
    { type: "de", faces: 10, valeurs: [6, "2"] },
    // degats.
    { type: "degats", base: "autre", operations: [], nature: "normaux" },
    { type: "degats", base: "lettre", operations: [], nature: "armure" },
    { type: "degats", base: "lettre", operations: null, nature: "normaux" },
    { type: "degats", base: "lettre", operations: [{ op: "multiplier", valeur: 2, raison: "Flambage" }], nature: "normaux" },
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 2.5, raison: "Flambage" }], nature: "normaux" },
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 2 }], nature: "normaux" },
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 2, raison: "" }], nature: "normaux" },
    { type: "degats", base: "lettre", operations: ["ajuster"], nature: "normaux" },
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 2, raison: "a" }, { op: "ajuster", valeur: 3, raison: "b" }], nature: "normaux" },
    // decaler, esquive.
    { type: "decaler", de: -1, valeur: 1, raison: "Minutie" },
    { type: "decaler", de: 0, valeur: 1.5, raison: "Minutie" },
    { type: "decaler", de: "0", valeur: 1, raison: "Minutie" },
    { type: "esquive", x: "3" },
    { type: "esquive", x: 2.5 },
  ];
  for (const faute of fautes) {
    const rendu = validerEvenement(faute);
    assert.equal(rendu.evenement, undefined, JSON.stringify(faute));
    assert.equal(typeof rendu.erreur, "string");
  }
  // Les bornes du moment ne se jugent pas ici : un entier hors de ses bornes
  // de jeu a la bonne forme, et c'est l'offre qui le refusera.
  for (const lointain of [
    { type: "regler", champ: "difficulte", valeur: 99 },
    { type: "regler", champ: "x", valeur: -5 },
    { type: "regler", champ: "modificateur", valeur: BORNE_REGLAGE + 1, raison: "Minutie" },
    { type: "esquive", x: 0 },
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: BORNE_DEGATS + 1, raison: "Flambage" }], nature: "normaux" },
    { type: "capacite", qui: "pj99999", capacite: 5000, facon: 5000 },
  ]) {
    assert.deepEqual(validerEvenement(lointain).evenement, lointain);
  }
});

test("validerEvenement — la raison est due dès que la valeur n'est pas nulle, et doit être valide", () => {
  for (const base of [{ type: "regler", champ: "modificateur" }, { type: "regler", champ: "avantages" }, { type: "decaler", de: 0 }]) {
    assert.ok(validerEvenement({ ...base, valeur: 2, raison: "Minutie" }).evenement);
    assert.ok(validerEvenement({ ...base, valeur: -2, raison: "Minutie" }).evenement);
    assert.ok(validerEvenement({ ...base, valeur: 0 }).evenement, "0 efface : la raison n'est pas due");
    assert.ok(validerEvenement({ ...base, valeur: 2 }).erreur, "sans raison");
    assert.ok(validerEvenement({ ...base, valeur: -1 }).erreur, "sans raison");
    for (const raison of ["", " Minutie", `Minu${RETOUR}tie`, "a".repeat(LONGUEUR_RAISON + 1), null, 3]) {
      assert.ok(validerEvenement({ ...base, valeur: 2, raison }).erreur, JSON.stringify(raison));
      assert.ok(validerEvenement({ ...base, valeur: 0, raison }).erreur, `même à 0, une raison donnée est lue : ${JSON.stringify(raison)}`);
    }
    assert.ok(validerEvenement({ ...base, valeur: 2, raison: "a".repeat(LONGUEUR_RAISON) }).evenement);
  }
  // Un réglage qui ne se fait pas à la main ne prend pas de raison.
  assert.ok(validerEvenement({ type: "regler", champ: "x", valeur: 2, raison: "Minutie" }).erreur);
  assert.ok(validerEvenement({ type: "regler", champ: "cible", valeur: "adv2", raison: "Minutie" }).erreur);
});

test("validerEvenement — l'erreur est une phrase, qui nomme l'événement et ne recopie rien d'hostile", () => {
  assert.equal(validerEvenement({ type: "capacite", qui: "pj1", facon: 0 }).erreur, "L'événement « capacite » n'a pas de champ « capacite ».");
  assert.equal(validerEvenement({ type: "revenir", [`hostile${RETOUR}`]: 1 }).erreur, "L'événement « revenir » porte un champ inconnu.");
  assert.equal(validerEvenement({ type: `hostile${RETOUR}` }).erreur, "Le type de l'événement n'est pas connu.");
  assert.equal(validerEvenement(null).erreur, "Un événement est un objet simple.");
  assert.equal(validerEvenement({ type: "regler", champ: "modificateur", valeur: 2 }).erreur, "L'événement « regler » « modificateur » demande une raison.");
  assert.equal(validerEvenement({ type: "de", faces: 10, valeurs: [11] }).erreur, "L'événement « de » : une valeur n'est pas un entier de 1 à 10.");
});

// ─── Les photographies ──────────────────────────────────────────────────────

const ESSAIS = { pjEssai, adversaireEssai, aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai };

test("photographies d'essai — gelées, sans source, acceptées par validerPhoto, et par JSON à l'identique", () => {
  for (const [nom, fabriquer] of Object.entries(ESSAIS)) {
    const photo = fabriquer();
    assert.ok(geleEnProfondeur(photo), nom);
    assert.equal(photo.source, null);
    assert.deepEqual(photo.avertissements, []);
    assert.deepEqual(parJson(photo), photo);
    const rendu = validerPhoto(parJson(photo));
    assert.equal(rendu.erreur, undefined, nom);
    assert.deepEqual(rendu.photo, photo);
    assert.notEqual(rendu.photo, photo);
    assert.ok(geleEnProfondeur(rendu.photo));
    // Chaque appel rend une photographie neuve : un contrôle ne salit pas le suivant.
    assert.notEqual(fabriquer(), photo);
  }
});

test("photographies d'essai — les deux protagonistes ronds, tels que les dit l'en-tête de l'outil", () => {
  const pj = pjEssai().valeurs;
  assert.equal(pj.nom, "Aubépine");
  assert.deepEqual([pj.actions, pj.souffle, pj.corps, pj.faceContre], [2, 10, 10, 20]);
  assert.deepEqual(Object.keys(pj.caracteristiques), CARACTERISTIQUES.map((c) => c.code));
  assert.ok(Object.values(pj.caracteristiques).every((valeur) => valeur === 4));
  assert.deepEqual(pj.zones.map((zone) => [zone.nom, zone.debut, zone.fin, zone.armure, zone.resistance]), [
    ["Tête", 1, 1, 10, 5], ["Torse", 2, 11, 10, 5], ["Jambe gauche", 12, 13, 10, 5], ["Jambe droite", 14, 15, 10, 5], ["Bras gauche", 16, 17, 10, 5], ["Bras droit", 18, 19, 10, 5],
  ]);
  assert.deepEqual(pj.deDefense, { faces: 8, type: "agile", caracteristiques: ["agilite", "creativite"], meles: false });
  assert.deepEqual(pj.armes.map((arme) => [arme.nom, arme.poids, arme.faces, arme.degats, arme.portee, arme.mainsNues]), [
    ["Couteau d'office", "precise", 8, [5, 10, 15], 1, false],
    ["Taloche", null, null, [2, 4, 8], 0, true],
  ]);
  assert.equal(pj.armePretee, 0);
  assert.deepEqual(pj.liens, [{ nom: "Grand Four", points: 2 }]);
  assert.deepEqual(pj.passifs, []);
  assert.equal(pj.bouclier, null);
  assert.deepEqual(pj.capacites.map((c) => [c.nom, c.role, c.niveau, c.groupe.genre, c.facons.map((f) => f.puissance)]), [
    ["Frappe", null, 0, "arme", [0]],
    ["Émincer", null, 0, "arme", [0]],
    ["Flambage", null, 2, "archetype", [1, 2]],
    ["Fournaise", null, 1, "primordial", [1]],
    ["Pas chassé", "deplacement", 2, "base", [1, 2]],
    ["Goûter", "jet_de_caracteristique", 0, "base", [0]],
    ["Taloche", "mains_nues", 1, "base", [1]],
    ["Pas de côté", "esquive", 0, "base", [0]],
  ]);
  const [frappe, emincer, flambage, fournaise, pas, , taloche, esquive] = pj.capacites;
  assert.deepEqual([frappe.facons[0].attaque, frappe.facons[0].cout, frappe.facons[0].desavantage, frappe.facons[0].arme], [true, { souffle: 0, lien: 0 }, false, 0]);
  assert.deepEqual([emincer.facons[0].attaque, emincer.facons[0].cout, emincer.facons[0].desavantage], [true, { souffle: 4, lien: 0 }, true]);
  assert.deepEqual(flambage.facons.map((f) => [f.attaque, f.cout.souffle]), [[false, 5], [false, 10]]);
  assert.deepEqual([fournaise.lien, fournaise.facons[0].cout], [0, { souffle: 1, lien: 1 }]);
  assert.deepEqual(pas.facons.map((f) => f.cout.souffle), [0, 1]);
  assert.deepEqual([taloche.facons[0].arme, taloche.facons[0].attaque, taloche.facons[0].degats, taloche.facons[0].portee], [1, true, [2, 4, 8], 0]);
  assert.deepEqual([esquive.facons[0].intervention, esquive.facons[0].cout], [true, { souffle: "X", lien: 0 }]);

  const adv = adversaireEssai().valeurs;
  assert.equal(adv.nom, "Marmiton");
  assert.deepEqual([adv.actions, adv.souffle, adv.corps, adv.attaque, adv.defense, adv.faceContre], [1, 5, 10, 4, 5, 1]);
  assert.deepEqual(adv.zones.map((zone) => [zone.nom, zone.debut, zone.fin, zone.armure]), [
    ["Torse", 2, 11, 10], ["Jambe gauche", 12, 13, 10], ["Jambe droite", 14, 15, 10], ["Bras gauche", 16, 17, 10], ["Bras droit", 18, 19, 10], ["Tête", 20, 20, 10],
  ]);
  assert.deepEqual(adv.armes, [{ nom: "Spatule souple", libelle: "Spatule souple", poids: "agile", faces: null, caracteristiques: null, degats: [5, 10, 15], portee: 0, locMultiple: 1, mainsNues: false }]);
  assert.deepEqual(adv.capacites.map((c) => [c.nom, c.role, c.niveau, c.groupe.genre, c.facons[0].cout.souffle, c.facons[0].desavantage, c.facons[0].attaque]), [
    ["Frappe", null, 0, "arme", 0, false, true],
    ["Moulinet farineux", null, 1, "arme", 5, true, true],
    ["Pas chassé", "deplacement", 1, "capacites", 0, false, false],
  ]);
  assert.deepEqual([adv.identifiant, adv.caracteristiques, adv.deDefense, adv.armePretee, adv.passifs, adv.liens], [null, null, null, null, [], []]);
});

test("photographies d'essai — les trois de la démonstration", () => {
  const aubepine = aubepineEssai().valeurs;
  assert.equal(aubepine.nom, "Aubépine Crèmebrûlée");
  assert.equal(aubepine.identifiant, "demo-aubepine-0000000001");
  assert.deepEqual(aubepine.caracteristiques, personnageEssai().caracteristiques);
  assert.deepEqual(aubepine.zones.map((zone) => zone.armure), [6, 30, 10, 10, 10, 10]);
  assert.deepEqual(aubepine.deDefense, { faces: 8, type: "agile", caracteristiques: ["agilite", "creativite"], meles: true });
  assert.deepEqual(aubepine.armes[0], { nom: "Couteau d'office", libelle: "Couteau d'office", poids: "precise", faces: 10, caracteristiques: ["precision", "agilite"], degats: [3, 8, 20], portee: 1, locMultiple: 1, mainsNues: false });
  assert.deepEqual(aubepine.bouclier, { nom: "Couvercle de marmite", defense: 8 });
  assert.deepEqual(aubepine.liens, [{ nom: "Grand Four", points: 1 }]);
  assert.deepEqual(aubepine.capacites.map((c) => c.nom), [
    "Frappe", "Émincer", "Réduction", "Flambage", "Dressage minute", "Maîtrise de l'agile", "Vif", "Nez fin", "Solo du chef", "Fournaise", "Cendre",
    "Se couvrir", "Boire le bouillon", "Pas chassé", "Goûter", "Taloche", "Pas de côté", "Guetter",
  ]);
  // Chaque passif câblé désigne la capacité qui porte son rôle, à son niveau.
  assert.deepEqual(aubepine.passifs.map((p) => [aubepine.capacites[p.capacite].nom, p.role, p.niveau]), [["Réduction", "degrossir", 1], ["Vif", "bonus_agilite", 1], ["Solo du chef", "seul_sur_sa_case", 1]]);
  for (const passif of aubepine.passifs) {
    assert.equal(aubepine.capacites[passif.capacite].role, passif.role);
    assert.equal(aubepine.capacites[passif.capacite].niveau, passif.niveau);
    assert.ok(aubepine.capacites[passif.capacite].facons.every((f) => f.passif));
  }
  assert.deepEqual(aubepine.capacites.filter((c) => c.role !== null).map((c) => [c.nom, c.role]), [
    ["Réduction", "degrossir"], ["Vif", "bonus_agilite"], ["Solo du chef", "seul_sur_sa_case"], ["Pas chassé", "deplacement"], ["Goûter", "jet_de_caracteristique"],
    ["Taloche", "mains_nues"], ["Pas de côté", "esquive"], ["Guetter", "attendre"],
  ]);
  // Son couteau est précis, et elle n'a que la maîtrise de l'agile.
  assert.deepEqual(aubepine.capacites.slice(0, 2).map((c) => [c.facons[0].desavantage, c.facons[0].cout.souffle, c.facons[0].degats]), [[true, 0, [3, 8, 20]], [true, 4, [3, 8, 20]]]);

  const chef = chefDePartieEssai().valeurs;
  assert.deepEqual([chef.nom, chef.sousTitre, chef.actions, chef.souffle, chef.corps, chef.attaque, chef.defense], ["Chef de partie", "Commis, Rôtisseur ×1,4", 1, 7, 10, 5, 7]);
  assert.deepEqual(chef.zones.map((zone) => [zone.nom, zone.ecrit, zone.armure]), [
    ["Torse", "Torse", 38], ["Jambe gauche", "Jambe gauche", 0], ["Jambe droite", "Jambre droite", 0], ["Bras gauche", "Bras gauche", 19], ["Bras droit", "Bras droit", 19], ["Tête", "Tête", 6],
  ]);
  assert.deepEqual(chef.armes[0].degats, [6, 12, 19]);
  assert.deepEqual(chef.capacites.map((c) => [c.nom, c.niveau, c.facons[0].puissance, c.facons[0].cout.souffle, c.facons[0].desavantage]), [
    ["Frappe", 0, 0, 0, false], ["Moulinet farineux", 1, 1, 5, false], ["Pas chassé", 2, 2, 1, false],
  ]);

  const marmiton = marmitonDeCorveeEssai().valeurs;
  assert.deepEqual([marmiton.nom, marmiton.actions, marmiton.souffle, marmiton.attaque, marmiton.defense], ["Marmiton de corvée", 1, 5, 4, 5]);
  assert.deepEqual(marmiton.zones.map((zone) => zone.armure), [30, 0, 0, 15, 15, 5]);
  assert.deepEqual(marmiton.armes[0].degats, [5, 10, 15]);
  assert.deepEqual(marmiton.capacites.map((c) => [c.nom, c.niveau, c.facons[0].cout.souffle, c.facons[0].desavantage]), [["Frappe", 0, 0, false], ["Moulinet farineux", 1, 5, true], ["Pas chassé", 1, 0, false]]);
});

test("photographies d'essai — le retoucheur change les valeurs ; une retouche que le simulateur refuserait lève", () => {
  const second = pjEssai((valeurs) => {
    valeurs.nom = "Brigadier";
    valeurs.identifiant = "essai-brigadier-0000000002";
    valeurs.liens.push({ nom: "Grande Cave", points: 3 });
    return 12;
  });
  assert.equal(second.valeurs.nom, "Brigadier");
  assert.equal(second.valeurs.liens.length, 2);
  assert.equal(pjEssai().valeurs.nom, "Aubépine", "le suivant n'en garde rien");
  const sansArme = adversaireEssai((valeurs) => {
    valeurs.actions = 0;
    valeurs.armes = [];
    valeurs.capacites = [capaciteEssai({ nom: "Goûter", groupe: { genre: "capacites", titre: "Capacités" } })];
  });
  assert.deepEqual([sansArme.valeurs.actions, sansArme.valeurs.armes, sansArme.valeurs.capacites[0].facons.length], [0, [], 1]);
  assert.throws(() => pjEssai((valeurs) => {
    valeurs.souffle = -1;
  }), /Photographie d'essai refusée : le souffle n'est pas un entier de 0 à 9 999\./);
  assert.throws(() => adversaireEssai((valeurs) => {
    valeurs.capacites[0].facons[0].arme = 3;
  }), /refusée/);
});

test("photographies d'essai — faconEssai et capaciteEssai : des valeurs neutres, et pas de champ inventé", () => {
  assert.deepEqual(faconEssai(), {
    puissance: 0, arme: null, libelle: null, cout: { souffle: 0, lien: 0 }, description: "", elements: [], passif: false, intervention: false,
    attaque: false, degats: null, portee: 0, locMultiple: 1, desavantage: false,
  });
  assert.deepEqual(faconEssai({ portee: 3, locMultiple: 2 }), { ...faconEssai(), portee: 3, locMultiple: 2 });
  assert.notEqual(faconEssai().cout, faconEssai().cout, "chaque façon a ses propres objets");
  const capacite = capaciteEssai({ nom: "Goûter", role: "jet_de_caracteristique" });
  assert.deepEqual(capacite, { nom: "Goûter", role: "jet_de_caracteristique", niveau: 0, evolue: false, groupe: { genre: "base", titre: "Gestes de cuisine" }, lien: null, inactive: null, facons: [faconEssai()] });
  assert.deepEqual(capaciteEssai({ inactive: "absente de la banque" }).facons, []);
  assert.throws(() => faconEssai({ porte: 3 }), /« porte » n'existe pas/);
  assert.throws(() => capaciteEssai({ rôle: "esquive" }), /n'existe pas/);
  // Ce qu'ils rendent tient dans une photographie.
  passe(pjEssai(), (valeurs) => {
    valeurs.capacites.push(capaciteEssai(), capaciteEssai({ nom: "Guetter", inactive: "absente de la banque" }));
  });
});

test("photographies d'essai — ajouterPassif pose la capacité et son entrée de passif, pour chacun des huit rôles", () => {
  for (const fabriquer of [pjEssai, adversaireEssai]) {
    const photo = fabriquer((valeurs) => {
      ROLES_PASSIFS.forEach((role, rang) => {
        const indice = ajouterPassif(valeurs, { role, niveau: rang + 1, nom: `Costaud ${rang + 1}` });
        assert.equal(indice, valeurs.capacites.length - 1);
      });
    });
    const { passifs, capacites } = photo.valeurs;
    assert.deepEqual(passifs.map((p) => p.role), ROLES_PASSIFS);
    for (const passif of passifs) {
      const capacite = capacites[passif.capacite];
      assert.deepEqual([capacite.role, capacite.niveau, capacite.facons[0].passif, capacite.facons[0].puissance], [passif.role, passif.niveau, true, passif.niveau]);
    }
  }
  assert.throws(() => pjEssai((valeurs) => ajouterPassif(valeurs, { role: "petit" })), /il faut le nom/);
});

test("validerPhoto — la copie est gelée, et ne partage rien avec la donnée", () => {
  const donnee = structuredClone(pjEssai());
  const { photo } = validerPhoto(donnee);
  assert.ok(geleEnProfondeur(photo));
  assert.ok(!Object.isFrozen(donnee) && !Object.isFrozen(donnee.valeurs.zones[0]));
  donnee.valeurs.zones[0].armure = 99;
  donnee.valeurs.capacites[0].facons[0].elements.push("Dégâts");
  assert.equal(photo.valeurs.zones[0].armure, 10);
  assert.deepEqual(photo.valeurs.capacites[0].facons[0].elements, []);
});

test("validerPhoto — une description de deux lignes est acceptée, un nom à retour de ligne est refusé", () => {
  const deuxLignes = `Tourbillonne.${RETOUR}Puis salue.${CHARIOT}${RETOUR}${TABULATION}Et recommence.`;
  const photo = passe(pjEssai(), (valeurs, entiere) => {
    valeurs.capacites[0].facons[0].description = deuxLignes;
    entiere.avertissements.push(`Portée illisible.${RETOUR}Elle vaut 0.`);
  });
  assert.equal(photo.valeurs.capacites[0].facons[0].description, deuxLignes);
  assert.equal(refusDe(pjEssai(), (valeurs) => {
    valeurs.nom = `Aubépine${RETOUR}Crèmebrûlée`;
  }), "le nom porte un retour à la ligne ou un caractère de contrôle.");
  // Tout autre caractère de contrôle, et les deux séparateurs de ligne, sont refusés jusque dans un texte à lignes.
  for (const signe of [NUL, String.fromCodePoint(0x0b), String.fromCodePoint(0x1b), String.fromCodePoint(0x7f), String.fromCodePoint(0x9f), SEPARATEUR_DE_LIGNE, SEPARATEUR_DE_PARAGRAPHE]) {
    assert.equal(refusDe(pjEssai(), (valeurs) => {
      valeurs.capacites[0].facons[0].description = `Tourbillonne${signe}.`;
    }), "la description de « Frappe » porte un caractère de contrôle.");
    assert.equal(refusDe(pjEssai(), (_valeurs, entiere) => {
      entiere.avertissements.push(`Portée${signe}illisible.`);
    }), "l'avertissement n° 1 porte un caractère de contrôle.");
  }
});

// Chaque texte d'une ligne de la photographie : où il est, et comment son refus le nomme.
const LIGNES = [
  ["le nom", (v, t) => (v.nom = t)],
  ["le sous-titre", (v, t) => (v.sousTitre = t)],
  ["l'identifiant du personnage", (v, t) => (v.identifiant = t)],
  ["le nom de la capacité n° 2", (v, t) => (v.capacites[1].nom = t)],
  ["le titre du groupe de « Frappe »", (v, t) => (v.capacites[0].groupe.titre = t)],
  ["le nom de l'arme n° 1", (v, t) => (v.armes[0].nom = t)],
  ["le libellé de l'arme n° 2", (v, t) => (v.armes[1].libelle = t)],
  ["le libellé de la façon n° 1 de « Frappe »", (v, t) => (v.capacites[0].facons[0].libelle = t)],
  ["le nom de la zone n° 3", (v, t) => (v.zones[2].nom = t)],
  ["le nom écrit de la zone n° 1", (v, t) => (v.zones[0].ecrit = t)],
  ["le nom de la jauge de lien n° 1", (v, t) => (v.liens[0].nom = t)],
  ["le nom du bouclier", (v, t) => (v.bouclier = { nom: t, defense: 8 })],
  ["un élément de « Taloche »", (v, t) => (v.capacites[6].facons[0].elements = ["Dégâts", t])],
];

test("validerPhoto — chaque texte d'une ligne : 200 signes passent, 201 non ; ni vide, ni retour à la ligne", () => {
  for (const [quoi, poser] of LIGNES) {
    passe(pjEssai(), (valeurs) => poser(valeurs, "é".repeat(BORNES_PHOTO.ligne)));
    passe(pjEssai(), (valeurs) => poser(valeurs, "x"));
    assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, "é".repeat(BORNES_PHOTO.ligne + 1))), `${quoi} dépasse 200 signes.`);
    for (const signe of [RETOUR, CHARIOT, TABULATION, NUL, SEPARATEUR_DE_LIGNE, SEPARATEUR_DE_PARAGRAPHE]) {
      assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, `Pas${signe}chassé`)), `${quoi} porte un retour à la ligne ou un caractère de contrôle.`);
    }
    assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, 12)), `${quoi} n'est pas un texte.`);
    // Seul le sous-titre peut être vide : un adversaire sans type n'en a pas.
    if (quoi === "le sous-titre") passe(pjEssai(), (valeurs) => poser(valeurs, ""));
    else assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, "")), `${quoi} est vide.`);
  }
  // La date de la banque est un texte d'une ligne, ou rien.
  passe(pjEssai(), (_v, entiere) => (entiere.publiee_le = "2026-10-11T20:52:00.000Z"));
  assert.equal(refusDe(pjEssai(), (_v, entiere) => (entiere.publiee_le = "")), "la date de la banque est vide.");
  assert.equal(refusDe(pjEssai(), (_v, entiere) => (entiere.publiee_le = 20261011)), "la date de la banque n'est pas un texte.");
});

test("validerPhoto — un texte à lignes : 4 000 signes passent, 4 001 non ; vide, il passe", () => {
  passe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].description = "é".repeat(BORNES_PHOTO.texte)));
  passe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].description = ""));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].description = "é".repeat(BORNES_PHOTO.texte + 1))), "la description de « Frappe » dépasse 4 000 signes.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].description = null)), "la description de « Frappe » n'est pas un texte.");
  passe(pjEssai(), (_v, entiere) => (entiere.avertissements = ["é".repeat(BORNES_PHOTO.texte), ""]));
  assert.equal(refusDe(pjEssai(), (_v, entiere) => (entiere.avertissements = ["", "é".repeat(BORNES_PHOTO.texte + 1)])), "l'avertissement n° 2 dépasse 4 000 signes.");
});

// Chaque nombre de la photographie d'un personnage, puis ceux que seul un adversaire porte.
const NOMBRES_PJ = [
  ["le nombre d'actions", (v, n) => (v.actions = n)],
  ["le souffle", (v, n) => (v.souffle = n)],
  ["le corps", (v, n) => (v.corps = n)],
  ["l'armure de la zone n° 2", (v, n) => (v.zones[1].armure = n)],
  ["la résistance de la zone n° 6", (v, n) => (v.zones[5].resistance = n)],
  ["la caractéristique « force »", (v, n) => (v.caracteristiques.force = n)],
  ["la caractéristique « creativite »", (v, n) => (v.caracteristiques.creativite = n)],
  ["les points de la jauge de lien n° 1", (v, n) => (v.liens[0].points = n)],
  ["le niveau de « Flambage »", (v, n) => (v.capacites[2].niveau = n)],
  ["la puissance de la façon n° 2 de « Flambage »", (v, n) => (v.capacites[2].facons[1].puissance = n)],
  ["la portée de la façon n° 1 de « Frappe »", (v, n) => (v.capacites[0].facons[0].portee = n)],
  ["le coût de la façon n° 1 de « Émincer » en souffle", (v, n) => (v.capacites[1].facons[0].cout.souffle = n)],
  ["le coût de la façon n° 1 de « Fournaise » en lien", (v, n) => (v.capacites[3].facons[0].cout.lien = n)],
  ["les dégâts de la façon n° 1 de « Frappe » : l'un d'eux", (v, n) => (v.capacites[0].facons[0].degats[2] = n)],
  ["les dégâts de l'arme n° 1 : l'un d'eux", (v, n) => (v.armes[0].degats[0] = n)],
  ["la portée de l'arme n° 2", (v, n) => (v.armes[1].portee = n)],
  ["la défense du bouclier", (v, n) => (v.bouclier = { nom: "Couvercle de marmite", defense: n })],
];
const NOMBRES_ADV = [
  ["l'attaque", (v, n) => (v.attaque = n)],
  ["la défense", (v, n) => (v.defense = n)],
  ["le niveau du passif câblé n° 1", (v, n) => (v.passifs[0].niveau = n)],
];

test("validerPhoto — chaque nombre : de 0 à 9 999, entier", () => {
  const avecPassif = () => adversaireEssai((valeurs) => {
    ajouterPassif(valeurs, { role: "en_meute", nom: "Brigade" });
  });
  for (const [photo, nombres] of [[pjEssai, NOMBRES_PJ], [avecPassif, NOMBRES_ADV]]) {
    for (const [quoi, poser] of nombres) {
      passe(photo(), (valeurs) => poser(valeurs, 0));
      passe(photo(), (valeurs) => poser(valeurs, BORNES_PHOTO.nombre));
      for (const faux of [BORNES_PHOTO.nombre + 1, -1, 1.5, "3", null, Number.NaN, Infinity]) {
        // Un coût peut être « X », un autre texte non.
        assert.equal(refusDe(photo(), (valeurs) => poser(valeurs, faux)), `${quoi} n'est pas un entier de 0 à 9 999.`, `${quoi} : ${faux}`);
      }
    }
  }
  // Le coût : un entier ou « X » pour chaque part, ou rien du tout quand la banque ne se lit pas.
  passe(pjEssai(), (valeurs) => (valeurs.capacites[1].facons[0].cout = { souffle: "X", lien: "X" }));
  passe(pjEssai(), (valeurs) => (valeurs.capacites[1].facons[0].cout = null));
  assert.ok(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[1].facons[0].cout = { souffle: "x", lien: 0 })));
  assert.ok(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[1].facons[0].cout = { souffle: 1 })));
  assert.ok(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[1].facons[0].cout = 4)));
  // Les dégâts : trois nombres, ou rien.
  passe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].degats = null));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].degats = [5, 10])), "les dégâts de la façon n° 1 de « Frappe » ne sont pas 3 nombres.");
  assert.ok(refusDe(pjEssai(), (valeurs) => (valeurs.armes[0].degats = [5, 10, 15, 20])));
  assert.ok(refusDe(pjEssai(), (valeurs) => (valeurs.armes[0].degats = "5/10/15")));
});

test("validerPhoto — les d20 d'une localisation, de 1 à 20 ; les faces d'un dé, de 2 à 100", () => {
  for (const [quoi, poser] of [
    ["le nombre de d20 de la façon n° 1 de « Frappe »", (v, n) => (v.capacites[0].facons[0].locMultiple = n)],
    ["le nombre de d20 de l'arme n° 1", (v, n) => (v.armes[0].locMultiple = n)],
  ]) {
    passe(pjEssai(), (valeurs) => poser(valeurs, 1));
    passe(pjEssai(), (valeurs) => poser(valeurs, BORNES_PHOTO.des));
    for (const faux of [0, BORNES_PHOTO.des + 1, 1.5, null]) assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, faux)), `${quoi} n'est pas un entier de 1 à 20.`);
  }
  for (const [quoi, poser] of [
    ["le dé de défense", (v, n) => (v.deDefense.faces = n)],
    ["le dé de l'arme n° 1", (v, n) => (v.armes[0].faces = n)],
  ]) {
    passe(pjEssai(), (valeurs) => poser(valeurs, 2));
    passe(pjEssai(), (valeurs) => poser(valeurs, BORNES_PHOTO.faces));
    for (const faux of [1, 0, BORNES_PHOTO.faces + 1, 8.5, "8"]) assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, faux)), `${quoi} n'est pas un entier de 2 à 100.`);
  }
});

test("validerPhoto — chaque liste à sa borne, et un cran au-delà", () => {
  const fois = (combien, fabriquer) => Array.from({ length: combien }, (_rien, rang) => fabriquer(rang));
  const arme = (rang) => ({ nom: `Spatule ${rang + 1}`, libelle: `Spatule ${rang + 1}`, poids: "agile", faces: null, caracteristiques: null, degats: null, portee: 0, locMultiple: 1, mainsNues: false });
  const listes = [
    ["la photographie compte plus de 200 capacités.", BORNES_PHOTO.capacites, (v, n) => (v.capacites = fois(n, (rang) => capaciteEssai({ nom: `Tour ${rang + 1}` })))],
    ["la liste des façons de « Frappe » compte plus de 20 façons.", BORNES_PHOTO.facons, (v, n) => (v.capacites[0].facons = fois(n, (rang) => faconEssai({ puissance: rang })))],
    ["la liste des armes compte plus de 40 armes.", BORNES_PHOTO.armes, (v, n) => (v.armes = fois(n, arme))],
    ["la liste des jauges de lien compte plus de 20 jauges.", BORNES_PHOTO.liens, (v, n) => (v.liens = fois(n, (rang) => ({ nom: `Four ${rang + 1}`, points: 1 })))],
    ["la liste des éléments de « Frappe » compte plus de 40 éléments.", BORNES_PHOTO.elements, (v, n) => (v.capacites[0].facons[0].elements = fois(n, (rang) => `Élément ${rang + 1}`))],
    ["la photographie compte plus de 200 avertissements.", BORNES_PHOTO.avertissements, (_v, n, entiere) => (entiere.avertissements = fois(n, (rang) => `Avertissement ${rang + 1}`))],
  ];
  for (const [phrase, borne, poser] of listes) {
    passe(pjEssai(), (valeurs, entiere) => poser(valeurs, borne, entiere));
    assert.equal(refusDe(pjEssai(), (valeurs, entiere) => poser(valeurs, borne + 1, entiere)), phrase);
  }
  // Dix-neuf zones d'une face tiennent sur le d20 d'un personnage ; une vingtième n'a plus de face.
  const zones = (combien) => fois(combien, (rang) => ({ nom: `Écaille ${rang + 1}`, ecrit: `Écaille ${rang + 1}`, code: null, debut: rang + 1, fin: rang + 1, armure: 1, resistance: 5 }));
  passe(pjEssai(), (valeurs) => (valeurs.zones = zones(BORNES_PHOTO.zones)));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones = zones(BORNES_PHOTO.zones + 1))), "la liste des zones compte plus de 19 zones.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones = [])), "la liste des zones est vide.");
  // Les passifs câblés : au plus autant que de capacités.
  const passif = { capacite: 0, role: "petit", niveau: 1 };
  passe(pjEssai(), (valeurs) => (valeurs.passifs = fois(valeurs.capacites.length, () => ({ ...passif }))));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.passifs = fois(valeurs.capacites.length + 1, () => ({ ...passif })))), "la liste des passifs câblés compte plus de 8 passifs.");
  // Une liste qui n'en est pas une.
  for (const poser of [(v) => (v.capacites = {}), (v) => (v.armes = null), (v) => (v.zones = "Torse"), (v) => (v.liens = 2), (v) => (v.passifs = undefined), (v) => (v.capacites[0].facons = {}), (v) => (v.capacites[0].facons[0].elements = "Dégâts")]) {
    assert.match(refusDe(pjEssai(), poser), /n'est pas une liste\.$/);
  }
});

test("validerPhoto — les indices désignent quelque chose dans leur liste", () => {
  const indices = [
    ["l'arme de la façon n° 1 de « Frappe »", (v, n) => (v.capacites[0].facons[0].arme = n), 2],
    ["la jauge de lien de « Fournaise »", (v, n) => (v.capacites[3].lien = n), 1],
    ["l'arme prêtée", (v, n) => (v.armePretee = n), 2],
  ];
  for (const [quoi, poser, longueur] of indices) {
    passe(pjEssai(), (valeurs) => poser(valeurs, longueur - 1));
    passe(pjEssai(), (valeurs) => poser(valeurs, null));
    for (const faux of [longueur, -1, 0.5, "0"]) assert.equal(refusDe(pjEssai(), (valeurs) => poser(valeurs, faux)), `${quoi} ne désigne rien dans sa liste.`);
  }
  const avecPassif = () => pjEssai((valeurs) => {
    ajouterPassif(valeurs, { role: "petit", nom: "Costaud" });
  });
  passe(avecPassif(), (valeurs) => (valeurs.passifs[0].capacite = 0));
  for (const faux of [9, -1, null]) assert.equal(refusDe(avecPassif(), (valeurs) => (valeurs.passifs[0].capacite = faux)), "la capacité du passif câblé n° 1 ne désigne rien dans sa liste.");
  // Une arme retirée laisse orphelines les façons qui la désignaient.
  assert.equal(refusDe(pjEssai(), (valeurs) => valeurs.armes.pop()), "l'arme de la façon n° 1 de « Taloche » ne désigne rien dans sa liste.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.liens = [])), "la jauge de lien de « Fournaise » ne désigne rien dans sa liste.");
});

test("validerPhoto — les rôles, les genres, les poids et les codes sont des valeurs connues", () => {
  for (const role of [...ROLES, null]) passe(pjEssai(), (valeurs) => (valeurs.capacites[0].role = role));
  for (const faux of ["Esquive", "maitrise", "", 3, undefined]) assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].role = faux)), "le rôle de « Frappe » n'est pas une valeur connue.");
  const avecPassif = () => pjEssai((valeurs) => {
    ajouterPassif(valeurs, { role: "petit", nom: "Costaud" });
  });
  for (const role of ROLES_PASSIFS) passe(avecPassif(), (valeurs) => (valeurs.passifs[0].role = role));
  // Un rôle qui n'est pas un passif câblé n'a rien à faire dans les passifs.
  for (const faux of ["esquive", "mains_nues", null]) assert.equal(refusDe(avecPassif(), (valeurs) => (valeurs.passifs[0].role = faux)), "le rôle du passif câblé n° 1 n'est pas une valeur connue.");
  for (const genre of ["arme", "archetype", "espece", "style", "constellation", "primordial", "objet", "base", "capacites"]) passe(pjEssai(), (valeurs) => (valeurs.capacites[0].groupe.genre = genre));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].groupe.genre = "Arme")), "le genre du groupe de « Frappe » n'est pas une valeur connue.");
  for (const poids of ["lourde", "agile", "precise", null]) passe(pjEssai(), (valeurs) => (valeurs.armes[0].poids = poids));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.armes[0].poids = "précise")), "le poids de l'arme n° 1 n'est pas une valeur connue.");
  for (const type of ["lourde", "agile", "precise"]) passe(pjEssai(), (valeurs) => (valeurs.deDefense.type = type));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.deDefense.type = null)), "le type de la défense n'est pas une valeur connue.");
  for (const code of [...GRILLE_PJ.map((zone) => zone.code), null]) passe(pjEssai(), (valeurs) => (valeurs.zones[0].code = code));
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[0].code = "queue")), "le code de la zone n° 1 n'est pas une valeur connue.");
  assert.equal(refusDe(pjEssai(), (_v, entiere) => (entiere.camp = "allie")), "le camp n'est pas une valeur connue.");
  // Les caractéristiques d'un dé : une ou deux, connues ; la même peut compter double.
  passe(pjEssai(), (valeurs) => (valeurs.deDefense.caracteristiques = ["force", "force"]));
  passe(pjEssai(), (valeurs) => (valeurs.armes[0].caracteristiques = ["sens"]));
  for (const faux of [[], ["force", "sens", "parole"], ["charisme"], "force", null]) {
    assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.deDefense.caracteristiques = faux)), "les caractéristiques de la défense ne sont pas une ou deux caractéristiques connues.");
  }
  for (const [champ, cible] of [["passif", "« passif » de la façon n° 1 de « Frappe »"], ["intervention", "« intervention » de la façon n° 1 de « Frappe »"], ["attaque", "« attaque » de la façon n° 1 de « Frappe »"], ["desavantage", "« desavantage » de la façon n° 1 de « Frappe »"]]) {
    passe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0][champ] = true));
    assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0][champ] = 1)), `${cible} n'est ni vrai ni faux.`);
  }
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[0].evolue = "oui")), "« evolue » de « Frappe » n'est ni vrai ni faux.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.armes[0].mainsNues = 0)), "« mainsNues » de l'arme n° 1 n'est ni vrai ni faux.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.deDefense.meles = null)), "« meles » de la défense n'est ni vrai ni faux.");
});

test("validerPhoto — la grille : sans trou, sans chevauchement, toutes les faces sauf celle de la contre-attaque", () => {
  // Un trou : la jambe gauche commence à 13, la face 12 n'est à personne.
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[2].debut = 13)), "la grille des zones a un trou ou un chevauchement avant la zone n° 3.");
  // Un chevauchement : le torse va jusqu'à 12, que la jambe gauche a déjà.
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[1].fin = 12)), "la grille des zones a un trou ou un chevauchement avant la zone n° 3.");
  // La face de contre-attaque dans une zone : la 20 d'un personnage, la 1 d'un adversaire.
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[5].fin = 20)), "la grille des zones ne finit pas à la face 19.");
  assert.equal(refusDe(adversaireEssai(), (valeurs) => (valeurs.zones[0].debut = 1)), "la grille des zones ne commence pas à la face 2.");
  // Une grille trop courte, une zone à l'envers, une face hors du dé.
  assert.equal(refusDe(pjEssai(), (valeurs) => valeurs.zones.pop()), "la grille des zones ne finit pas à la face 19.");
  assert.equal(refusDe(adversaireEssai(), (valeurs) => valeurs.zones.shift()), "la grille des zones ne commence pas à la face 2.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[1].fin = 1)), "la zone n° 2 finit avant de commencer.");
  assert.equal(refusDe(adversaireEssai(), (valeurs) => (valeurs.zones[5].fin = 21)), "la dernière face de la zone n° 6 n'est pas un entier de 1 à 20.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.zones[0].debut = 0)), "la première face de la zone n° 1 n'est pas un entier de 1 à 20.");
  // La face de contre-attaque est celle du camp, et la grille la suit.
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.faceContre = 1)), "la face de contre-attaque n'est pas celle de son camp.");
  assert.equal(refusDe(adversaireEssai(), (valeurs) => (valeurs.faceContre = 20)), "la face de contre-attaque n'est pas celle de son camp.");
  // Une autre découpe, entière, passe : deux zones sur un adversaire.
  passe(adversaireEssai(), (valeurs) => {
    valeurs.zones = [
      { nom: "Corps", ecrit: "Corps", code: null, debut: 2, fin: 17, armure: 12, resistance: 5 },
      { nom: "Tête", ecrit: "Tête", code: "tete", debut: 18, fin: 20, armure: 3, resistance: 5 },
    ];
  });
});

test("validerPhoto — ce que seul un personnage porte, ce que seul un adversaire porte", () => {
  for (const [poser, phrase] of [
    [(v) => (v.identifiant = null), "l'identifiant du personnage n'est pas un texte."],
    [(v) => (v.caracteristiques = null), "la liste des caractéristiques n'est pas un objet simple."],
    [(v) => delete v.caracteristiques.sens, "la liste des caractéristiques n'a pas de champ « sens »."],
    [(v) => (v.caracteristiques.charisme = 4), "la liste des caractéristiques porte un champ inconnu."],
    [(v) => (v.deDefense = null), "le dé de défense n'est pas un objet simple."],
    [(v) => (v.attaque = 5), "l'attaque n'est pas vide, pour un personnage."],
    [(v) => (v.defense = 5), "la défense n'est pas vide, pour un personnage."],
  ]) {
    assert.equal(refusDe(pjEssai(), poser), phrase);
  }
  for (const [poser, phrase] of [
    [(v) => (v.identifiant = "demo-marmiton-0000000001"), "l'identifiant n'est pas vide, pour un adversaire."],
    [(v) => (v.caracteristiques = pjEssai().valeurs.caracteristiques), "la liste des caractéristiques n'est pas vide, pour un adversaire."],
    [(v) => (v.deDefense = pjEssai().valeurs.deDefense), "le dé de défense n'est pas vide, pour un adversaire."],
    [(v) => (v.attaque = null), "l'attaque n'est pas un entier de 0 à 9 999."],
    [(v) => (v.defense = null), "la défense n'est pas un entier de 0 à 9 999."],
    [(v) => (v.armePretee = 0), "l'arme prêtée n'est pas vide, pour un adversaire."],
  ]) {
    assert.equal(refusDe(adversaireEssai(), poser), phrase);
  }
  // Le camp décide : la photographie d'un personnage dite d'un adversaire est refusée, et l'inverse.
  assert.ok(refusDe(pjEssai(), (_v, entiere) => (entiere.camp = "adv")));
  assert.ok(refusDe(adversaireEssai(), (_v, entiere) => (entiere.camp = "pj")));
});

test("validerPhoto — le souffle absent vaut 0 ; un dé a ses caractéristiques ; une capacité absente n'a pas de façon", () => {
  passe(adversaireEssai(), (valeurs) => {
    valeurs.souffle = 0;
    valeurs.souffleAbsent = true;
  });
  assert.equal(refusDe(adversaireEssai(), (valeurs) => (valeurs.souffleAbsent = true)), "le souffle est dit absent, et n'est pas nul.");
  assert.equal(refusDe(adversaireEssai(), (valeurs) => (valeurs.souffleAbsent = 0)), "« souffleAbsent » n'est ni vrai ni faux.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.armes[0].faces = null)), "l'arme n° 1 a un dé sans caractéristiques, ou l'inverse.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.armes[1].faces = 8)), "l'arme n° 2 a un dé sans caractéristiques, ou l'inverse.");
  passe(pjEssai(), (valeurs) => {
    valeurs.capacites[2].inactive = "absente de la banque";
    valeurs.capacites[2].facons = [];
  });
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[2].inactive = "absente de la banque")), "« Flambage » n'a pas le nombre de façons que veut « inactive ».");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[2].facons = [])), "« Flambage » n'a pas le nombre de façons que veut « inactive ».");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[2].inactive = "en panne")), "« inactive » de « Flambage » n'est pas une valeur connue.");
  assert.equal(refusDe(pjEssai(), (valeurs) => (valeurs.capacites[2].inactive = false)), "« inactive » de « Flambage » n'est pas une valeur connue.");
});

test("validerPhoto — un champ qui manque ou un champ en trop, à chaque étage", () => {
  const etages = [
    ["la photographie", (_v, entiere) => entiere, "valeurs"],
    ["la liste des valeurs", (v) => v, "nom"],
    ["la zone n° 1", (v) => v.zones[0], "ecrit"],
    ["l'arme n° 1", (v) => v.armes[0], "libelle"],
    ["la jauge de lien n° 1", (v) => v.liens[0], "points"],
    ["la capacité n° 1", (v) => v.capacites[0], "niveau"],
    ["le groupe de « Frappe »", (v) => v.capacites[0].groupe, "titre"],
    ["la façon n° 1 de « Frappe »", (v) => v.capacites[0].facons[0], "desavantage"],
    ["le coût de la façon n° 1 de « Frappe »", (v) => v.capacites[0].facons[0].cout, "lien"],
    ["le dé de défense", (v) => v.deDefense, "meles"],
  ];
  for (const [quoi, etage, champ] of etages) {
    assert.equal(refusDe(pjEssai(), (valeurs, entiere) => delete etage(valeurs, entiere)[champ]), `${quoi} n'a pas de champ « ${champ} ».`);
    assert.equal(refusDe(pjEssai(), (valeurs, entiere) => (etage(valeurs, entiere).inconnu = 1)), `${quoi} porte un champ inconnu.`);
  }
  const avecPassif = () => pjEssai((valeurs) => {
    ajouterPassif(valeurs, { role: "petit", nom: "Costaud" });
    valeurs.bouclier = { nom: "Couvercle de marmite", defense: 8 };
  });
  assert.equal(refusDe(avecPassif(), (valeurs) => (valeurs.passifs[0].nom = "Costaud")), "le passif câblé n° 1 porte un champ inconnu.");
  assert.equal(refusDe(avecPassif(), (valeurs) => delete valeurs.passifs[0].niveau), "le passif câblé n° 1 n'a pas de champ « niveau ».");
  assert.equal(refusDe(avecPassif(), (valeurs) => (valeurs.bouclier.qualite = 2)), "le bouclier porte un champ inconnu.");
  assert.equal(refusDe(avecPassif(), (valeurs) => delete valeurs.bouclier.defense), "le bouclier n'a pas de champ « defense ».");
  // Chacun des dix-neuf champs des valeurs est attendu.
  for (const champ of Object.keys(pjEssai().valeurs)) {
    assert.equal(refusDe(pjEssai(), (valeurs) => delete valeurs[champ]), `la liste des valeurs n'a pas de champ « ${champ} ».`);
  }
  assert.equal(Object.keys(pjEssai().valeurs).length, 19);
  for (const donnee of [null, undefined, 3, "photo", [], new Map()]) {
    assert.deepEqual(validerPhoto(donnee), { erreur: "la photographie n'est pas un objet simple." });
  }
});

test("validerPhoto — la source : rien, un personnage que « accepter » vérifie, ou un adversaire ; des données simples seulement", () => {
  const sur = personnageEssai();
  // Le personnage d'essai passe « accepter », le vrai : sinon ce contrôle ne dirait rien.
  assert.doesNotThrow(() => accepter(structuredClone(sur)));
  const photo = passe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: sur }), { accepter });
  assert.deepEqual(photo.source.personnage, sur);
  assert.ok(geleEnProfondeur(photo.source));
  assert.deepEqual(parJson(photo), photo);
  // Le même personnage, abîmé : « accepter » le refuse, donc la photographie aussi.
  assert.equal(refusDe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: { ...sur, format: 99 } }), { accepter }), "le personnage de la source est refusé.");
  assert.equal(refusDe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: { ...sur, caracteristiques: null } }), { accepter }), "le personnage de la source est refusé.");
  // Sans de quoi le vérifier, il ne passe pas.
  assert.equal(refusDe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: sur })), "le personnage de la source ne peut pas être vérifié.");
  assert.equal(refusDe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: sur }), { accepter: true }), "le personnage de la source ne peut pas être vérifié.");
  // « accepter » reçoit une copie : ce qu'il y changerait ne touche ni la donnée ni la photographie.
  const gardee = passe(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: sur }), {
    accepter: (recu) => {
      recu.identite.nom = "Changé";
    },
  });
  assert.equal(gardee.source.personnage.identite.nom, "Aubépine Crèmebrûlée");
  for (const [source, phrase] of [
    [{}, "la source de la photographie n'a pas de champ « personnage »."],
    [{ personnage: sur, resolu: {} }, "la source de la photographie porte un champ inconnu."],
    [{ personnage: null }, "le personnage de la source n'est pas un objet simple."],
    [{ personnage: [sur] }, "le personnage de la source n'est pas un objet simple."],
    [3, "la source de la photographie n'est pas un objet simple."],
  ]) {
    assert.equal(refusDe(aubepineEssai(), (_v, entiere) => (entiere.source = source), { accepter: () => {} }), phrase);
  }

  // Un adversaire : sa ligne, celles de ses types, sa résolution, telles que lues.
  const source = { ligne: { nom: "Chef de partie", brut: { feuille: "Adversaires", ligne: 5, cellules: { Nom: "Chef de partie" } } }, types: [{ nom: "Commis" }, { nom: "Rôtisseur" }], resolu: { complet: true, corps: 10, multiplicateur: 1.4, zones: [] } };
  const adverse = passe(chefDePartieEssai(), (_v, entiere) => (entiere.source = source));
  assert.deepEqual(adverse.source, source);
  assert.notEqual(adverse.source.ligne, source.ligne);
  for (const [abimer, phrase] of [
    [(s) => delete s.types, "la source de la photographie n'a pas de champ « types »."],
    [(s) => (s.personnage = sur), "la source de la photographie porte un champ inconnu."],
    [(s) => (s.types = [null]), "la source de la photographie n'a pas la forme d'un adversaire : sa ligne, celles de ses types, sa résolution."],
    [(s) => (s.resolu = []), "la source de la photographie n'a pas la forme d'un adversaire : sa ligne, celles de ses types, sa résolution."],
    [(s) => (s.resolu.table = new Map()), "la source de la photographie porte autre chose que des données simples."],
    [(s) => (s.resolu.defaut = undefined), "la source de la photographie porte autre chose que des données simples."],
    [(s) => (s.resolu.multiplicateur = Number.NaN), "la source de la photographie porte autre chose que des données simples."],
    [(s) => (s.ligne.lire = () => 1), "la source de la photographie porte autre chose que des données simples."],
    [(s) => Object.defineProperty(s.ligne, "__proto__", { value: { hostile: true }, enumerable: true }), "la source de la photographie porte un champ interdit."],
  ]) {
    const donnee = retouchee(chefDePartieEssai(), () => {});
    donnee.source = { ligne: { ...source.ligne }, types: [...source.types], resolu: { ...source.resolu } };
    abimer(donnee.source);
    assert.deepEqual(validerPhoto(donnee), { erreur: phrase });
  }
  // Une source forgée, imbriquée à l'excès, est refusée sans faire déborder la pile.
  let abime = {};
  for (let niveau = 0; niveau < 50000; niveau += 1) abime = { abime };
  const profonde = retouchee(chefDePartieEssai(), () => {});
  profonde.source = { ligne: {}, types: [], resolu: abime };
  assert.deepEqual(validerPhoto(profonde), { erreur: "la source de la photographie est trop imbriquée." });
  // Soixante étages passent.
  let admise = {};
  for (let niveau = 0; niveau < 60; niveau += 1) admise = { admise };
  profonde.source = { ligne: {}, types: [], resolu: admise };
  assert.equal(validerPhoto(profonde).erreur, undefined);
});

// ─── Le contenu ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };

function contenuEssai(retoucher = () => {}) {
  const miseEnPlace = miseEnPlaceEssai([{ photo: pjEssai(), case: "C3" }, { photo: chefDePartieEssai(), case: "F6" }, { photo: adversaireEssai(), case: "D4" }, { photo: adversaireEssai(), case: "D4" }]);
  const contenu = structuredClone({ regles: REGLES, revision: 17, miseEnPlace, evenements: [LANCER, { type: "capacite", qui: "pj1", capacite: 0, facon: 0 }, { type: "regler", champ: "cible", valeur: "adv3" }, { type: "de", faces: 8, valeurs: [6] }] });
  retoucher(contenu, contenu.miseEnPlace.protagonistes);
  return contenu;
}
const OPTIONS = { mode: "demo", revision: 17 };

function contenuRefuse(retoucher, options = OPTIONS) {
  const rendu = validerContenu(contenuEssai(retoucher), options);
  assert.deepEqual(Object.keys(rendu), ["erreur"]);
  assert.equal(typeof rendu.erreur, "string");
  return rendu.erreur;
}

/** Un PJ de plus, que rien ne confond avec les autres. */
const autrePj = (rang) => structuredClone(pjEssai((valeurs) => {
  valeurs.nom = `Brigadier ${rang}`;
  valeurs.identifiant = `essai-brigadier-${rang}`;
}));
const autreAdversaire = (nom) => structuredClone(adversaireEssai((valeurs) => {
  valeurs.nom = nom;
}));

test("validerContenu — un contenu bien formé est rendu en copie gelée, par JSON à l'identique", () => {
  const donnee = contenuEssai();
  const rendu = validerContenu(parJson(donnee), OPTIONS);
  assert.deepEqual(Object.keys(rendu), ["contenu"]);
  assert.deepEqual(rendu.contenu, donnee);
  assert.ok(geleEnProfondeur(rendu.contenu));
  assert.deepEqual(Object.keys(rendu.contenu), ["regles", "revision", "miseEnPlace", "evenements"]);
  assert.deepEqual(Object.keys(rendu.contenu.miseEnPlace), ["mode", "quiCommence", "compteur", "protagonistes"]);
  assert.deepEqual(rendu.contenu.miseEnPlace.protagonistes.map((p) => [p.id, p.camp, p.case]), [["pj1", "pj", "C3"], ["adv2", "adv", "F6"], ["adv3", "adv", "D4"], ["adv4", "adv", "D4"]]);
  // Avant le lancement : aucun événement, et même aucun protagoniste.
  const vide = { regles: REGLES, revision: 0, miseEnPlace: { mode: "reel", quiCommence: "adv", compteur: 0, protagonistes: [] }, evenements: [] };
  assert.deepEqual(validerContenu(vide, { mode: "reel", revision: 0 }).contenu, vide);
});

test("validerContenu — une autre version des règles se dit, avant tout autre examen", () => {
  // Un contenu du groupe 2, à cinq clés : ce n'est pas une donnée abîmée.
  const cinqCles = { ...contenuEssai(), regles: 2, effets: [] };
  assert.deepEqual(validerContenu(cinqCles, OPTIONS), { autreVersion: { regles: 2 } });
  // Ni la révision, ni le mode, ni le reste n'en sont regardés.
  assert.deepEqual(validerContenu({ regles: 2, revision: "?", miseEnPlace: null }, { mode: "reel", revision: 3 }), { autreVersion: { regles: 2 } });
  assert.deepEqual(validerContenu({ regles: 0 }, OPTIONS), { autreVersion: { regles: 0 } });
  assert.ok(validerContenu({ regles: 0 }, OPTIONS).autreVersion, "ce qui est rendu se teste d'un simple « if »");
  // La même cinquième clé, à la version d'ici, est une donnée abîmée.
  assert.equal(validerContenu({ ...contenuEssai(), effets: [] }, OPTIONS).erreur, "Le contenu porte un champ inconnu.");
  // Une version qui n'est pas un entier n'est pas « une autre version ».
  for (const regles of ["2", 1.5, null, undefined, [2]]) {
    assert.equal(contenuRefuse((contenu) => (contenu.regles = regles)), "La version des règles du contenu ne se lit pas.");
  }
});

test("validerContenu — ses quatre clés, elles seules ; la révision de l'enveloppe ; le mode de la visite", () => {
  for (const cle of ["regles", "revision", "miseEnPlace", "evenements"]) {
    const erreur = contenuRefuse((contenu) => delete contenu[cle]);
    assert.equal(erreur, `Le contenu n'a pas de champ « ${cle} ».`);
  }
  for (const donnee of [null, undefined, "{}", [], 3]) assert.deepEqual(validerContenu(donnee, OPTIONS), { erreur: "Le contenu n'est pas un objet simple." });
  assert.ok(validerContenu(contenuEssai(), { mode: "demo", revision: 17 }).contenu);
  for (const revision of [16, 18, "17", undefined, null]) {
    assert.equal(contenuRefuse(() => {}, { mode: "demo", revision }), "La révision du contenu n'est pas celle de son enveloppe.");
  }
  for (const revision of [-1, 1.5, "17", null]) {
    assert.equal(contenuRefuse((contenu) => (contenu.revision = revision), { mode: "demo", revision }), "La révision du contenu n'est pas celle de son enveloppe.");
  }
  for (const mode of ["reel", "", undefined, null]) assert.equal(contenuRefuse(() => {}, { mode, revision: 17 }), "La mise en place n'est pas celle de ce mode.");
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.mode = undefined), { mode: undefined, revision: 17 }), "La mise en place n'est pas celle de ce mode.");
  // Sans options du tout, rien ne lève.
  assert.equal(validerContenu(contenuEssai()).erreur, "La révision du contenu n'est pas celle de son enveloppe.");
  assert.equal(validerContenu(contenuEssai(), null).erreur, "La révision du contenu n'est pas celle de son enveloppe.");
});

test("validerContenu — la mise en place : ses champs, le camp qui commence, le compteur", () => {
  assert.equal(contenuRefuse((contenu) => delete contenu.miseEnPlace.compteur), "La mise en place n'a pas de champ « compteur ».");
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.tour = 1)), "La mise en place porte un champ inconnu.");
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace = [])), "La mise en place n'est pas un objet simple.");
  assert.ok(validerContenu(contenuEssai((contenu) => (contenu.miseEnPlace.quiCommence = "adv")), OPTIONS).contenu);
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.quiCommence = "PJ")), "Le camp qui commence n'est pas une valeur connue.");
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.compteur = -1)), "Le compteur des identifiants n'est pas un indice.");
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.protagonistes = {})), "La mise en place n'est pas une liste.");
  // Le compteur ne redescend jamais : il a pu dépasser ceux qui restent, jamais l'inverse.
  assert.ok(validerContenu(contenuEssai((contenu) => (contenu.miseEnPlace.compteur = 40)), OPTIONS).contenu);
  assert.equal(contenuRefuse((contenu) => (contenu.miseEnPlace.compteur = 3)), "L'identifiant « adv4 » dépasse le compteur.");
});

test("validerContenu — les identifiants : au motif, uniques, du bon camp ; les cases lisibles", () => {
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[0].id = "pj0")), "L'identifiant du protagoniste n° 1 n'est pas l'identifiant d'un protagoniste.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[1].id = "Chef de partie")), "L'identifiant du protagoniste n° 2 n'est pas l'identifiant d'un protagoniste.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[3].id = "adv3")), "L'identifiant « adv3 » sert deux fois.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[1].id = "pj2")), "L'identifiant « pj2 » n'est pas celui de son camp.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[1].camp = "pj")), "L'identifiant « adv2 » n'est pas celui de son camp.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[1].camp = "allie")), "Le camp de « adv2 » n'est pas une valeur connue.");
  // La photographie est celle du camp que dit l'identifiant.
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[1].photo = structuredClone(pjEssai()))), "La photographie de « adv2 » n'est pas de son camp.");
  for (const nom of ["K1", "A11", "a1", "", null, 4]) assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[2].case = nom)), "La case de « adv3 » n'est pas une case, de A1 à J10.");
  assert.equal(contenuRefuse((_c, protagonistes) => delete protagonistes[2].case), "Le protagoniste n° 3 n'a pas de champ « case ».");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[2].nom = "Marmiton")), "Le protagoniste n° 3 porte un champ inconnu.");
});

test("validerContenu — chaque photographie passe par validerPhoto, avec « accepter »", () => {
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[0].photo.valeurs.souffle = -1)), "La photographie de « pj1 » est refusée : le souffle n'est pas un entier de 0 à 9 999.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[2].photo.valeurs.zones[0].debut = 1)), "La photographie de « adv3 » est refusée : la grille des zones ne commence pas à la face 2.");
  assert.equal(contenuRefuse((_c, protagonistes) => (protagonistes[2].photo = null)), "La photographie de « adv3 » est refusée : la photographie n'est pas un objet simple.");
  const personnage = personnageEssai();
  const avecSource = (contenu) => (contenu.miseEnPlace.protagonistes[0].photo.source = { personnage });
  const vus = [];
  const rendu = validerContenu(contenuEssai(avecSource), { ...OPTIONS, accepter: (recu) => vus.push(recu.id) });
  assert.deepEqual(rendu.contenu.miseEnPlace.protagonistes[0].photo.source.personnage, personnage);
  assert.deepEqual(vus, ["demo-aubepine-0000000001"]);
  assert.equal(contenuRefuse(avecSource), "La photographie de « pj1 » est refusée : le personnage de la source ne peut pas être vérifié.");
  assert.equal(
    contenuRefuse(avecSource, { ...OPTIONS, accepter: () => { throw new Error("refusé"); } }),
    "La photographie de « pj1 » est refusée : le personnage de la source est refusé.",
  );
});

test("validerContenu — les plafonds : 12 personnages, 60 adversaires, 12 exemplaires, vus des deux côtés", () => {
  const avec = (photos) => (contenu) => {
    contenu.miseEnPlace.protagonistes = photos.map((photo, rang) => ({ id: `${photo.camp}${rang + 1}`, camp: photo.camp, case: "A1", photo }));
    contenu.miseEnPlace.compteur = photos.length;
    contenu.evenements = [];
  };
  const pjs = (combien) => Array.from({ length: combien }, (_rien, rang) => autrePj(rang + 1));
  const adversaires = (combien, parNom) => Array.from({ length: combien }, (_rien, rang) => autreAdversaire(`Marmiton ${Math.floor(rang / parNom) + 1}`));

  assert.ok(validerContenu(contenuEssai(avec(pjs(PLAFOND_PJ))), OPTIONS).contenu);
  assert.equal(contenuRefuse(avec(pjs(PLAFOND_PJ + 1))), "Le combat compte plus de 12 personnages.");

  assert.ok(validerContenu(contenuEssai(avec(adversaires(PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES))), OPTIONS).contenu);
  assert.equal(contenuRefuse(avec(adversaires(PLAFOND_ADVERSAIRES + 1, PLAFOND_EXEMPLAIRES))), "Le combat compte plus de 60 adversaires.");

  assert.ok(validerContenu(contenuEssai(avec(adversaires(PLAFOND_EXEMPLAIRES, PLAFOND_EXEMPLAIRES))), OPTIONS).contenu);
  assert.equal(contenuRefuse(avec(adversaires(PLAFOND_EXEMPLAIRES + 1, PLAFOND_EXEMPLAIRES + 1))), "Le combat compte plus de 12 exemplaires d'un même adversaire.");

  // Les deux plafonds ensemble tiennent ; un protagoniste de plus, de l'un ou l'autre camp, non.
  assert.ok(validerContenu(contenuEssai(avec([...pjs(PLAFOND_PJ), ...adversaires(PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES)])), OPTIONS).contenu);
  assert.equal(contenuRefuse(avec([...pjs(PLAFOND_PJ + 1), ...adversaires(PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES)])), "La mise en place compte plus de 72 protagonistes.");

  // Un personnage ne s'ajoute qu'une fois ; deux personnages de même nom ne sont pas le même.
  assert.equal(contenuRefuse(avec([autrePj(1), autrePj(1)])), "Le personnage de « pj2 » est deux fois dans le combat.");
  const homonyme = autrePj(2);
  homonyme.valeurs.nom = "Brigadier 1";
  assert.ok(validerContenu(contenuEssai(avec([autrePj(1), homonyme])), OPTIONS).contenu);
});

test("validerContenu — les événements : chacun par validerEvenement, 20 000 au plus", () => {
  assert.equal(contenuRefuse((contenu) => (contenu.evenements = {})), "Le combat n'est pas une liste.");
  assert.equal(contenuRefuse((contenu) => contenu.evenements.push({ type: "de", faces: 8, valeurs: [9] })), "L'événement n° 5 est refusé : L'événement « de » : une valeur n'est pas un entier de 1 à 8.");
  assert.equal(contenuRefuse((contenu) => (contenu.evenements[1].inconnu = 1)), "L'événement n° 2 est refusé : L'événement « capacite » porte un champ inconnu.");
  assert.equal(contenuRefuse((contenu) => (contenu.evenements[0] = null)), "L'événement n° 1 est refusé : Un événement est un objet simple.");
  // Ce qui est permis à cet instant ne se juge pas ici : deux lancements de suite ont la bonne forme.
  assert.ok(validerContenu(contenuEssai((contenu) => contenu.evenements.push(LANCER)), OPTIONS).contenu);
  const tant = (combien) => (contenu) => (contenu.evenements = Array.from({ length: combien }, () => ({ type: "fin_de_tour" })));
  const plein = validerContenu(contenuEssai(tant(EVENEMENTS_MAX)), OPTIONS);
  assert.equal(plein.contenu.evenements.length, EVENEMENTS_MAX);
  assert.equal(contenuRefuse(tant(EVENEMENTS_MAX + 1)), "Le combat compte plus de 20 000 événements.");
});

test("le socle — aucune des trois fonctions ne lève, même sur une donnée piégée", () => {
  const piege = (objet, champ) => Object.defineProperty(objet, champ, { enumerable: true, get: () => { throw new Error("piège"); } });
  assert.deepEqual(validerEvenement(piege({}, "type")), { erreur: "L'événement ne se lit pas." });
  assert.deepEqual(validerPhoto(piege(structuredClone(pjEssai()), "camp")), { erreur: "la photographie ne se lit pas." });
  assert.deepEqual(validerContenu(piege({}, "regles"), OPTIONS), { erreur: "Le contenu ne se lit pas." });
  // Un « accepter » qui lève autre chose qu'un refus de personnage ne sort pas non plus.
  const donnee = retouchee(aubepineEssai(), (_v, entiere) => (entiere.source = { personnage: personnageEssai() }));
  assert.deepEqual(validerPhoto(donnee, { accepter: () => { throw new TypeError("défaut du code"); } }), { erreur: "le personnage de la source est refusé." });
  for (const options of [undefined, null, 3, "accepter", {}]) assert.doesNotThrow(() => [validerPhoto(donnee, options), validerContenu(contenuEssai(), options)]);
});

test("le socle — aucune phrase rendue ne porte d'espace insécable", () => {
  const phrases = [
    validerEvenement({ type: "de", faces: 10, valeurs: [11] }).erreur,
    validerPhoto(retouchee(pjEssai(), (valeurs) => (valeurs.souffle = -1))).erreur,
    validerPhoto(retouchee(pjEssai(), (valeurs) => (valeurs.capacites[0].facons[0].description = "é".repeat(4001)))).erreur,
    contenuRefuse((contenu) => (contenu.evenements = Array.from({ length: EVENEMENTS_MAX + 1 }, () => ({ type: "garder" })))),
    ...Object.values(DIFFICULTES),
  ];
  for (const phrase of phrases) {
    assert.equal(typeof phrase, "string");
    for (const signe of INSECABLES) assert.ok(!phrase.includes(signe), phrase);
  }
});

// ─── La mise en place et l'état d'essai ─────────────────────────────────────

test("miseEnPlaceEssai — un seul compteur, l'ordre donné, les cases dites ou d'office ; acceptée par validerContenu", () => {
  const miseEnPlace = miseEnPlaceEssai([{ photo: pjEssai(), case: "C3" }, { photo: adversaireEssai() }, { photo: pjEssai((v) => (v.identifiant = "essai-second")) }, { photo: chefDePartieEssai(), case: "F6" }]);
  assert.deepEqual([miseEnPlace.mode, miseEnPlace.quiCommence, miseEnPlace.compteur], ["demo", "pj", 4]);
  assert.deepEqual(miseEnPlace.protagonistes.map((p) => [p.id, p.camp, p.case]), [["pj1", "pj", "C3"], ["adv2", "adv", "J1"], ["pj3", "pj", "A1"], ["adv4", "adv", "F6"]]);
  assert.ok(geleEnProfondeur(miseEnPlace));
  assert.ok(validerContenu({ regles: REGLES, revision: 1, miseEnPlace: parJson(miseEnPlace), evenements: [] }, { mode: "demo", revision: 1 }).contenu);
  const reelle = miseEnPlaceEssai([{ photo: adversaireEssai() }], { mode: "reel", quiCommence: "adv" });
  assert.deepEqual([reelle.mode, reelle.quiCommence, reelle.compteur, reelle.protagonistes[0].id], ["reel", "adv", 1, "adv1"]);
});

test("etatEssai — l'état d'un combat lancé : chacun à ses valeurs de départ, personne n'a joué", () => {
  const aubepine = pjEssai();
  const marmiton = adversaireEssai();
  const etat = etatEssai(miseEnPlaceEssai([{ photo: aubepine, case: "C3" }, { photo: marmiton, case: "D4" }]));
  assert.ok(geleEnProfondeur(etat));
  assert.deepEqual(Object.keys(etat), ["regles", "mode", "quiCommence", "phase", "ordre", "photos", "noms", "lanceLe", "tour", "protagonistes", "effets", "pile", "journal", "annonce", "vainqueur", "pas"]);
  assert.deepEqual([etat.regles, etat.mode, etat.quiCommence, etat.phase, etat.lanceLe, etat.vainqueur, etat.pas], [1, "demo", "pj", "combat", "2026-10-12T21:30", null, 1]);
  assert.deepEqual(etat.ordre, ["pj1", "adv2"]);
  // Les valeurs de la photographie, par référence, jamais la photographie entière.
  assert.equal(etat.photos.pj1, aubepine.valeurs);
  assert.equal(etat.photos.adv2, marmiton.valeurs);
  assert.deepEqual(etat.noms, {
    pj1: { entier: "Aubépine", court: "Aubépine", jeton: "Aubépine", initiales: "A", exemplaire: null },
    adv2: { entier: "Marmiton", court: "Marmiton", jeton: "Marmiton", initiales: "M", exemplaire: null },
  });
  assert.deepEqual(etat.tour, { numero: 1, camp: "pj" });
  assert.deepEqual(etat.protagonistes.pj1, {
    camp: "pj", case: "C3", actions: 2, actionsMax: 2, souffle: 10, souffleMax: 10, corps: 10, corpsMax: 10, attaque: null, defense: null,
    zones: Array.from({ length: 6 }, () => ({ armure: 10, armureMax: 10, resistance: 5, resistanceMax: 5 })),
    liens: [{ points: 2, max: 2 }],
    passe: false, mort: null,
  });
  assert.deepEqual({ ...etat.protagonistes.adv2, zones: null }, {
    camp: "adv", case: "D4", actions: 1, actionsMax: 1, souffle: 5, souffleMax: 5, corps: 10, corpsMax: 10, attaque: 4, defense: 5, zones: null, liens: [], passe: false, mort: null,
  });
  assert.equal(etat.protagonistes.adv2.zones.length, marmiton.valeurs.zones.length);
  assert.deepEqual([etat.effets, etat.pile], [[], []]);
  assert.deepEqual(etat.journal, [
    { genre: "cadre", texte: "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent." },
    { genre: "tour", texte: `${SIGNES.tiret} Tour 1 ${SIGNES.point} camp des PJ ${SIGNES.tiret}` },
  ]);
  assert.deepEqual(etat.annonce, { pas: 1, texte: `Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. ${SIGNES.tiret} Tour 1 ${SIGNES.point} camp des PJ ${SIGNES.tiret}` });
  for (const { texte } of etat.journal) for (const signe of INSECABLES) assert.ok(!texte.includes(signe));
  // Il passe par JSON à l'identique, comme tout état.
  assert.deepEqual(parJson(etat), etat);
});

test("etatEssai — les pluriels, le camp qui commence, un tour plus loin, des noms donnés, une retouche", () => {
  const miseEnPlace = miseEnPlaceEssai([{ photo: aubepineEssai() }, { photo: pjEssai() }, { photo: marmitonDeCorveeEssai(), case: "D4" }, { photo: marmitonDeCorveeEssai(), case: "D4" }, { photo: chefDePartieEssai() }], { quiCommence: "adv" });
  const etat = etatEssai(miseEnPlace);
  assert.equal(etat.journal[0].texte, "Combat lancé : 2 personnages contre 3 adversaires. Les adversaires commencent.");
  assert.equal(etat.journal[1].texte, `${SIGNES.tiret} Tour 1 ${SIGNES.point} camp des adversaires ${SIGNES.tiret}`);
  assert.deepEqual(etat.tour, { numero: 1, camp: "adv" });
  // « Le nom tel quel » : sans « noms », deux exemplaires portent le même.
  assert.deepEqual([etat.noms.adv3.court, etat.noms.adv4.court, etat.noms.pj1.court, etat.noms.pj1.initiales], ["Marmiton de corvée", "Marmiton de corvée", "Aubépine Crèmebrûlée", "A"]);

  const plusLoin = etatEssai(miseEnPlace, {
    tour: { numero: 2, camp: "pj" },
    lanceLe: "2026-10-11T23:05",
    noms: { adv3: { entier: "Marmiton de corvée n° 1", court: "Marmiton n° 1", jeton: "Marmiton 1", initiales: "M1", exemplaire: 1 }, adv4: { court: "Marmiton n° 2", exemplaire: 2 } },
    retoucher: (brouillon) => {
      brouillon.protagonistes.pj1.actions = 1;
      brouillon.protagonistes.pj1.souffle = 6;
      brouillon.protagonistes.adv4.mort = { tour: 1 };
    },
  });
  assert.deepEqual(plusLoin.tour, { numero: 2, camp: "pj" });
  assert.equal(plusLoin.lanceLe, "2026-10-11T23:05");
  // Trois fins de tour séparent le tour 1 des adversaires du tour 2 des PJ : un événement chacune.
  assert.equal(plusLoin.pas, 4);
  assert.deepEqual(plusLoin.journal.map((ligne) => [ligne.genre, ligne.texte]), [
    ["cadre", "Combat lancé : 2 personnages contre 3 adversaires. Les adversaires commencent."],
    ["tour", `${SIGNES.tiret} Tour 1 ${SIGNES.point} camp des adversaires ${SIGNES.tiret}`],
    ["cadre", "Fin du tour des adversaires : ils retrouvent leurs actions."],
    ["tour", `${SIGNES.tiret} Tour 1 ${SIGNES.point} camp des PJ ${SIGNES.tiret}`],
    ["cadre", "Fin du tour des PJ : ils retrouvent leurs actions."],
    ["tour", `${SIGNES.tiret} Tour 2 ${SIGNES.point} camp des adversaires ${SIGNES.tiret}`],
    ["cadre", "Fin du tour des adversaires : ils retrouvent leurs actions."],
    ["tour", `${SIGNES.tiret} Tour 2 ${SIGNES.point} camp des PJ ${SIGNES.tiret}`],
  ]);
  assert.deepEqual(plusLoin.annonce, { pas: 4, texte: `Fin du tour des adversaires : ils retrouvent leurs actions. ${SIGNES.tiret} Tour 2 ${SIGNES.point} camp des PJ ${SIGNES.tiret}` });
  assert.deepEqual(plusLoin.noms.adv3, { entier: "Marmiton de corvée n° 1", court: "Marmiton n° 1", jeton: "Marmiton 1", initiales: "M1", exemplaire: 1 });
  assert.deepEqual(plusLoin.noms.adv4, { entier: "Marmiton de corvée", court: "Marmiton n° 2", jeton: "Marmiton de corvée", initiales: "M", exemplaire: 2 });
  assert.deepEqual([plusLoin.protagonistes.pj1.actions, plusLoin.protagonistes.pj1.actionsMax, plusLoin.protagonistes.pj1.souffle, plusLoin.protagonistes.adv4.mort], [1, 2, 6, { tour: 1 }]);
  assert.ok(geleEnProfondeur(plusLoin));
  // Le numéro du tour monte quand le camp qui a commencé rejoue.
  assert.deepEqual(etatEssai(miseEnPlace, { tour: { numero: 2, camp: "adv" } }).pas, 3);
  assert.throws(() => etatEssai(miseEnPlace, { tour: { numero: 0, camp: "pj" } }), /n'existe pas/);
  assert.throws(() => etatEssai(miseEnPlace, { tour: { numero: 1, camp: "allie" } }), /n'existe pas/);
});
