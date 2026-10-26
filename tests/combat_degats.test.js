// Contrôles des dégâts d'un geste (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : js/combat/degats.js. La lettre, les deux grilles de
// localisation, la face de contre-attaque, le décalage, les dégâts zone par
// zone, dégrossir, les dégâts directs, l'esquive, la blessure et la mort.
//
// Chaque règle est vue dans les deux sens, à un point près : l'armure qui
// tient et celle qui cède, l'endurance à 1 et à 0, le corps à 1 et à 0, le
// dé brut qui annule et le dé décalé qui n'annule pas, dégrossir qui
// s'applique et les quatre cas où il ne s'applique pas.
//
// Les états et les gestes sont écrits à la main, sans le moteur. Les exemples
// de la mission et les coups calculés à la main du combat de référence fictif
// (Aubépine Crèmebrûlée contre le Chef de partie et deux Marmitons de corvée)
// servent de témoins.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  basesPermises,
  bornesDuDecalage,
  coupsDuGeste,
  degatsFixes,
  frapper,
  imputerEsquive,
  lettreDe,
  localiser,
  nombreDeD20,
  reussitesDeLAttaque,
} from "../js/combat/degats.js";
import { jetFini, lancerDe, ouvrirJet, reussites } from "../js/combat/jet.js";
import { FACE_CONTRE, FACES_LOCALISATION, LETTRES, REUSSITES_MAX, geler } from "../js/combat/regles.js";
import { blessuresDe, courantDe, photoDe } from "../js/combat/valeurs.js";
import {
  adversaireEssai,
  ajouterPassif,
  aubepineEssai,
  chefDePartieEssai,
  etatEssai,
  marmitonDeCorveeEssai,
  miseEnPlaceEssai,
  pjEssai,
} from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

// Un geste tel que le moteur le tient (§ 17), gelé : une règle qui le
// modifierait lèverait.
function gesteEssai(champs = {}) {
  return geler({
    numero: 1,
    acteur: "pj1",
    capacite: 0,
    facon: 0,
    mode: "attaque",
    moment: "suites",
    paye: true,
    prix: { actions: 1, souffle: 0, lien: 0, jauge: null, lienNonPaye: 0 },
    cible: null,
    arrivee: null,
    depart: null,
    x: 0,
    jauge: null,
    caracteristiques: null,
    difficulte: null,
    armePretee: null,
    reglages: { modificateur: null, avantages: null },
    jet: null,
    degats: null,
    localisation: [],
    interventions: [],
    resultat: null,
    parent: null,
    ...champs,
  });
}

function indiceDe(etat, id, nom) {
  const indice = photoDe(etat, id).capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(indice, -1, `« ${nom} » n'est pas une capacité de ${id}`);
  return indice;
}

// L'indice d'une zone, retrouvée par son code.
function zoneDe(etat, id, code) {
  const indice = photoDe(etat, id).zones.findIndex((zone) => zone.code === code);
  assert.notEqual(indice, -1, `${id} n'a pas de zone « ${code} »`);
  return indice;
}

/**
 * Un jet fini qui compte tant de réussites : un d10 contre 5, des 10 pour
 * réussir, un 1 pour arrêter la chaîne. « genre » : « attaque » quand un PJ
 * attaque, « defense » quand il se défend.
 */
function jetA(genre, nombre) {
  let jet = ouvrirJet({ genre, lanceur: "pj1", faces: 10, mobilisees: [], difficulte: 5, modificateurs: [], avantages: [], desavantages: [] });
  for (let rang = 0; rang < nombre; rang += 1) jet = lancerDe(jet, [10]).jet;
  if (nombre < REUSSITES_MAX) jet = lancerDe(jet, [1]).jet;
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), nombre);
  return jet;
}

const d20 = (...bruts) => bruts.map((brut) => (typeof brut === "number" ? { brut, decalage: null } : brut));
const normaux = (base, ...operations) => ({ base, operations, nature: "normaux" });
const ajuster = (valeur, raison = "Émincer") => ({ op: "ajuster", valeur, raison });
const esquive = (x) => ({ qui: "pj1", capacite: 7, prix: { actions: 1, souffle: x }, effet: { genre: "annuler", x } });

const sansRetouche = () => {};

/** Aubépine (pj1) face à Marmiton (adv2), sur la même case : les deux protagonistes ronds. */
function duel({ pj = sansRetouche, adv = sansRetouche, retoucher = sansRetouche } = {}) {
  return etatEssai(miseEnPlaceEssai([{ photo: pjEssai(pj), case: "D4" }, { photo: adversaireEssai(adv), case: "D4" }]), { retoucher });
}

const reduction = (niveau = 1) => (valeurs) => {
  ajouterPassif(valeurs, { role: "degrossir", niveau, nom: "Réduction" });
};

// Le PJ a touché avec Frappe (5/10/15) ; l'adversaire a touché avec la sienne
// (5/10/15), et c'est le PJ qui a lancé sa défense.
const frappeDuPj = (etat, nombre, champs = {}) =>
  gesteEssai({ acteur: "pj1", capacite: indiceDe(etat, "pj1", "Frappe"), cible: "adv2", jet: jetA("attaque", nombre), degats: normaux("lettre"), ...champs });
const frappeDeLAdversaire = (etat, nombre, champs = {}) =>
  gesteEssai({ acteur: "adv2", capacite: indiceDe(etat, "adv2", "Frappe"), cible: "pj1", jet: jetA("defense", nombre), degats: normaux("lettre"), ...champs });

// Applique un geste à sa cible, comme le fera le moteur.
const appliquer = (etat, geste) => frapper(courantDe(etat, geste.cible), coupsDuGeste(etat, geste));

// L'état courant d'une victime écrit à la main : trois zones pareilles.
function victime({ armure = 10, resistance = 5, corps = 10 } = {}) {
  return geler({
    camp: "adv",
    case: "D4",
    actions: 1,
    actionsMax: 1,
    souffle: 5,
    souffleMax: 5,
    corps,
    corpsMax: 10,
    attaque: 4,
    defense: 5,
    zones: [0, 1, 2].map(() => ({ armure, armureMax: Math.max(armure, 10), resistance, resistanceMax: 5 })),
    liens: [],
    passe: false,
    mort: null,
  });
}

// Un seul coup, sur la première zone.
const unCoup = (courant, degats, { zone = 0, surplus = 0, nature = "normaux" } = {}) => frapper(courant, [{ zone, degats, surplus, nature }]);
// Ce que la première zone et le corps sont devenus : [armure, endurance, corps].
const apres = (rendu, zone = 0) => [rendu.courant.zones[zone].armure, rendu.courant.zones[zone].resistance, rendu.courant.corps];

function estGeleEnProfondeur(valeur) {
  if (valeur === null || typeof valeur !== "object") return true;
  return Object.isFrozen(valeur) && Object.values(valeur).every(estGeleEnProfondeur);
}

// ─── La lettre ──────────────────────────────────────────────────────────────

test("lettreDe, en attaque : aucune réussite, manqué ; une A, deux B, trois C", () => {
  assert.equal(lettreDe("attaque", 0), null);
  assert.deepEqual([1, 2, 3].map((nombre) => LETTRES[lettreDe("attaque", nombre)]), ["A", "B", "C"]);
  assert.deepEqual([1, 2, 3].map((nombre) => lettreDe("attaque", nombre)), [0, 1, 2]);
});

test("lettreDe, en défense : aucune réussite laisse passer C, une B, deux A ; trois, aucun dégât", () => {
  assert.deepEqual([0, 1, 2].map((nombre) => LETTRES[lettreDe("defense", nombre)]), ["C", "B", "A"]);
  assert.equal(lettreDe("defense", 3), null);
});

test("lettreDe : un jet de caractéristique n'a pas de lettre", () => {
  for (const nombre of [0, 1, 2, 3]) assert.equal(lettreDe("caracteristique", nombre), null);
});

test("reussitesDeLAttaque : celles du jet en attaque ; 3 moins celles de la défense du PJ", () => {
  assert.deepEqual([0, 1, 2, 3].map((nombre) => reussitesDeLAttaque("attaque", nombre)), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map((nombre) => reussitesDeLAttaque("defense", nombre)), [3, 2, 1, 0]);
  assert.deepEqual([0, 1, 2, 3].map((nombre) => reussitesDeLAttaque("caracteristique", nombre)), [0, 0, 0, 0]);
});

test("degats.js n'importe que ce que le noyau lui permet", () => {
  const texte = readFileSync(new URL("../js/combat/degats.js", import.meta.url), "utf8");
  const imports = [...texte.matchAll(/^import\s[^;]*?\sfrom\s+"([^"]+)";/gm)].map((trouve) => trouve[1]).sort();
  assert.deepEqual(imports, ["./jet.js", "./regles.js", "./valeurs.js"]);
});

test("degats.js exporte ce que dit le contrat, et deux fonctions de plus : les coups d'un geste, son nombre de d20", async () => {
  assert.deepEqual(Object.keys(await import("../js/combat/degats.js")).sort(), [
    "basesPermises",
    "bornesDuDecalage",
    "coupsDuGeste",
    "degatsFixes",
    "frapper",
    "imputerEsquive",
    "lettreDe",
    "localiser",
    "nombreDeD20",
    "reussitesDeLAttaque",
  ]);
});

// Les signes qu'un fichier du dépôt ne porte jamais tels quels : les espaces
// insécables et les signes de format invisibles, fabriqués ici par leur code.
const de = (debut, fin) => `${String.fromCodePoint(debut)}-${String.fromCodePoint(fin)}`;
const INTERDITS = new RegExp(`[${[0xad, 0xa0, 0x202f, 0xfeff].map((code) => String.fromCodePoint(code)).join("")}${de(0x200b, 0x200f)}${de(0x202a, 0x202e)}${de(0x2060, 0x2064)}${de(0x2066, 0x2069)}]`, "u");

// Le commentaire qui ouvre un fichier : ses premières lignes, tant qu'elles
// commencent par « // ».
function enTeteDe(texte) {
  const lignes = texte.split(/\r?\n/);
  const fin = lignes.findIndex((ligne) => !ligne.startsWith("//"));
  return lignes.slice(0, fin === -1 ? lignes.length : fin);
}

test("degats.js : un en-tête qui dit le pourquoi et le § 17 ; ni espace insécable, ni signe invisible", () => {
  for (const fichier of ["../js/combat/degats.js", "./combat_degats.test.js"]) {
    const texte = readFileSync(new URL(fichier, import.meta.url), "utf8");
    const enTete = enTeteDe(texte);
    assert.ok(enTete.some((ligne) => ligne.includes("SPECIFICATION.md")) && enTete.some((ligne) => ligne.includes("§ 17")), `${fichier} : l'en-tête cite le § 17 de la spécification`);
    assert.ok(enTete.length >= 4, `${fichier} : l'en-tête dit ce que fait le fichier, et pourquoi`);
    assert.equal(INTERDITS.test(texte), false, `${fichier} : un signe invisible ou une espace insécable`);
  }
  assert.equal(INTERDITS.test(`a${String.fromCodePoint(0xa0)}b`), true, "le motif voit une espace insécable");
  assert.equal(INTERDITS.test(`a${String.fromCodePoint(0x2060)}b`), true, "et un signe invisible");
});

// ─── La localisation : les deux grilles ─────────────────────────────────────

const codesTouches = (valeurs) =>
  Array.from({ length: FACES_LOCALISATION }, (_, rang) => {
    const rendu = localiser(valeurs, rang + 1);
    return rendu.contre ? "contre" : valeurs.zones[rendu.zone].code;
  });

const repeter = (code, fois) => Array.from({ length: fois }, () => code);

test("la grille d'un PJ : tête 1, torse 2-11, jambe gauche 12-13, jambe droite 14-15, bras gauche 16-17, bras droit 18-19 ; 20, la contre-attaque", () => {
  const { valeurs } = pjEssai();
  assert.equal(valeurs.faceContre, FACE_CONTRE.pj);
  assert.deepEqual(codesTouches(valeurs), [
    "tete",
    ...repeter("torse", 10),
    ...repeter("jambe_gauche", 2),
    ...repeter("jambe_droite", 2),
    ...repeter("bras_gauche", 2),
    ...repeter("bras_droit", 2),
    "contre",
  ]);
  assert.deepEqual(localiser(valeurs, 14), { contre: false, face: 14, zone: 3 });
  assert.deepEqual(localiser(valeurs, 20), { contre: true });
});

test("la grille d'un adversaire est la sienne : 1, la contre-attaque ; la tête à 20", () => {
  const { valeurs } = adversaireEssai();
  assert.equal(valeurs.faceContre, FACE_CONTRE.adv);
  assert.deepEqual(codesTouches(valeurs), [
    "contre",
    ...repeter("torse", 10),
    ...repeter("jambe_gauche", 2),
    ...repeter("jambe_droite", 2),
    ...repeter("bras_gauche", 2),
    ...repeter("bras_droit", 2),
    "tete",
  ]);
  assert.deepEqual(localiser(valeurs, 20), { contre: false, face: 20, zone: 5 }, "20 est une zone chez un adversaire");
  assert.deepEqual(localiser(valeurs, 1), { contre: true }, "1 est la tête d'un PJ, la contre-attaque d'un adversaire");
});

test("une grille qui n'est pas celle d'un humanoïde se lit de même, zone par zone", () => {
  const volaille = adversaireEssai((valeurs) => {
    const zone = (nom, debut, fin) => ({ nom, ecrit: nom, code: null, debut, fin, armure: 4, resistance: 5 });
    valeurs.zones = [zone("Corps", 2, 15), zone("Aile gauche", 16, 17), zone("Aile droite", 18, 19), zone("Bec", 20, 20)];
  }).valeurs;
  const noms = Array.from({ length: FACES_LOCALISATION }, (_, rang) => {
    const rendu = localiser(volaille, rang + 1);
    return rendu.contre ? "contre" : volaille.zones[rendu.zone].nom;
  });
  assert.deepEqual(noms, ["contre", ...repeter("Corps", 14), "Aile gauche", "Aile gauche", "Aile droite", "Aile droite", "Bec"]);
});

// ─── La face de contre-attaque et le décalage ───────────────────────────────

test("le décalage déplace la face : 14 décalée à 12 passe de la jambe droite à la jambe gauche", () => {
  const { valeurs } = pjEssai();
  assert.deepEqual(localiser(valeurs, 14, -2), { contre: false, face: 12, zone: 2 });
  assert.deepEqual(localiser(valeurs, 14, 0), { contre: false, face: 14, zone: 3 });
  assert.deepEqual(localiser(valeurs, 14), localiser(valeurs, 14, 0), "sans décalage, la face est le dé");
  assert.deepEqual(localiser(valeurs, 11, 1), { contre: false, face: 12, zone: 2 });
});

test("la face de contre-attaque se lit sur le dé brut : un décalage ne l'efface pas", () => {
  const pj = pjEssai().valeurs;
  const adv = adversaireEssai().valeurs;
  for (const decalage of [-19, -5, -1, 0]) assert.deepEqual(localiser(pj, 20, decalage), { contre: true }, `PJ, 20 décalé de ${decalage}`);
  for (const decalage of [0, 1, 5, 19]) assert.deepEqual(localiser(adv, 1, decalage), { contre: true }, `adversaire, 1 décalé de ${decalage}`);
});

test("la face de contre-attaque se lit sur le dé brut : un décalage ne la crée pas", () => {
  const pj = pjEssai().valeurs;
  const adv = adversaireEssai().valeurs;
  assert.equal(localiser(pj, 19, 1).contre, false, "19 poussé à 20 n'est pas une contre-attaque");
  assert.equal(localiser(pj, 15, 5).contre, false);
  assert.equal(localiser(adv, 2, -1).contre, false, "2 poussé à 1 n'est pas une contre-attaque");
  assert.equal(localiser(adv, 20, -19).contre, false);
  // Hors de la grille, il n'y a pas de zone : l'offre ne le permet pas.
  assert.deepEqual(localiser(pj, 19, 1), { contre: false, face: 20, zone: null });
  assert.deepEqual(localiser(adv, 2, -1), { contre: false, face: 1, zone: null });
});

test("bornesDuDecalage : la face décalée reste sur une zone, de 1 à 19 sur un PJ", () => {
  const { valeurs } = pjEssai();
  assert.deepEqual(bornesDuDecalage(valeurs, 12), { min: -11, max: 7 });
  for (let brut = 1; brut <= 19; brut += 1) {
    const { min, max } = bornesDuDecalage(valeurs, brut);
    assert.equal(brut + min, 1, `dé ${brut} : la borne basse mène à la face 1`);
    assert.equal(brut + max, 19, `dé ${brut} : la borne haute mène à la face 19`);
    assert.equal(localiser(valeurs, brut, min).zone, 0, "la tête");
    assert.equal(localiser(valeurs, brut, max).zone, 5, "le bras droit");
    assert.equal(localiser(valeurs, brut, min - 1).zone, null, "un cran plus bas, plus de zone");
    assert.equal(localiser(valeurs, brut, max + 1).zone, null, "un cran plus haut, plus de zone");
  }
});

test("bornesDuDecalage : de 2 à 20 sur un adversaire", () => {
  const { valeurs } = adversaireEssai();
  assert.deepEqual(bornesDuDecalage(valeurs, 12), { min: -10, max: 8 });
  for (let brut = 2; brut <= 20; brut += 1) {
    const { min, max } = bornesDuDecalage(valeurs, brut);
    assert.equal(brut + min, 2, `dé ${brut}`);
    assert.equal(brut + max, 20, `dé ${brut}`);
    assert.equal(localiser(valeurs, brut, min).zone, 0, "le torse");
    assert.equal(localiser(valeurs, brut, max).zone, 5, "la tête");
    assert.equal(localiser(valeurs, brut, min - 1).zone, null);
    assert.equal(localiser(valeurs, brut, max + 1).zone, null);
  }
});

// ─── Les bases ──────────────────────────────────────────────────────────────

test("basesPermises : une attaque a la lettre de ses réussites ; sans dégâts lisibles, « aucun »", () => {
  const etat = duel();
  assert.deepEqual(basesPermises(etat, frappeDuPj(etat, 1)), ["lettre"]);
  assert.deepEqual(basesPermises(etat, frappeDeLAdversaire(etat, 1)), ["lettre"]);
  const illisible = duel({ pj: (valeurs) => { valeurs.capacites[0].facons[0].degats = null; } });
  assert.deepEqual(basesPermises(illisible, frappeDuPj(illisible, 1)), ["aucun"]);
});

test("basesPermises : un jet prêté propose « Sans dégâts », par défaut, puis « Dégâts de l'arme » si elle en a", () => {
  const etat = duel();
  const prete = (armePretee, acteur = "pj1", nom = "Flambage") => gesteEssai({ acteur, capacite: indiceDe(etat, acteur, nom), mode: "jet_prete", cible: acteur === "pj1" ? "adv2" : "pj1", armePretee });
  assert.deepEqual(basesPermises(etat, prete(0)), ["aucun", "arme"], "le couteau");
  assert.deepEqual(basesPermises(etat, prete(1)), ["aucun", "arme"], "les mains nues");
  assert.deepEqual(basesPermises(etat, prete(null)), ["aucun"], "sans arme, pas de dégâts de l'arme");
  assert.deepEqual(basesPermises(etat, prete(9)), ["aucun"], "une arme qui n'existe pas");
  assert.deepEqual(basesPermises(etat, prete(0, "adv2", "Pas chassé")), ["aucun", "arme"], "la spatule d'un adversaire");
  assert.deepEqual(basesPermises(etat, prete(null, "adv2", "Pas chassé")), ["aucun"], "un adversaire sans arme : les dégâts se saisissent");

  const sansTarif = duel({ pj: (valeurs) => { valeurs.armes[0].degats = null; } });
  assert.deepEqual(basesPermises(sansTarif, gesteEssai({ capacite: indiceDe(sansTarif, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee: 0 })), ["aucun"]);
});

test("basesPermises : un geste sans jet d'attaque n'a aucune base", () => {
  const etat = duel();
  for (const mode of ["sans_jet", "deplacement", "caracteristique"]) {
    assert.deepEqual(basesPermises(etat, gesteEssai({ mode })), [], mode);
  }
});

// ─── Fixer les dégâts ───────────────────────────────────────────────────────

test("degatsFixes, attaque d'un PJ : les dégâts de la lettre de ses réussites", () => {
  const etat = duel();
  assert.deepEqual(degatsFixes(etat, frappeDuPj(etat, 2, { localisation: d20(9) })), {
    base: "lettre",
    lettre: 1,
    deBase: 10,
    valeur: 10,
    nature: "normaux",
    avant: [10],
    parCoup: [10],
    total: 10,
    surplus: 0,
    sourceDuSurplus: null,
  });
  assert.deepEqual(Object.keys(degatsFixes(etat, frappeDuPj(etat, 2))), ["base", "lettre", "deBase", "valeur", "nature", "avant", "parCoup", "total", "surplus", "sourceDuSurplus"]);
  assert.deepEqual([1, 2, 3].map((nombre) => degatsFixes(etat, frappeDuPj(etat, nombre)).deBase), [5, 10, 15], "A, B, C");
});

test("degatsFixes, attaque d'un adversaire : 0 réussite en défense laisse passer C, une B, deux A", () => {
  const etat = duel({ adv: (valeurs) => { valeurs.capacites[0].facons[0].degats = [6, 12, 19]; } });
  assert.deepEqual([0, 1, 2].map((nombre) => degatsFixes(etat, frappeDeLAdversaire(etat, nombre)).deBase), [19, 12, 6]);
  assert.deepEqual([0, 1, 2].map((nombre) => LETTRES[degatsFixes(etat, frappeDeLAdversaire(etat, nombre)).lettre]), ["C", "B", "A"]);
});

test("degatsFixes : sans dégâts fixés, la base par défaut, en dégâts normaux", () => {
  const etat = duel();
  const attaque = degatsFixes(etat, frappeDuPj(etat, 1, { degats: null }));
  assert.equal(attaque.base, "lettre");
  assert.equal(attaque.nature, "normaux");
  assert.equal(attaque.valeur, 5);
  const prete = degatsFixes(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee: 0, jet: jetA("attaque", 2), degats: null }));
  assert.equal(prete.base, "aucun", "« Sans dégâts », par défaut");
  assert.equal(prete.valeur, 0);
});

test("degatsFixes : « ajuster » remplace la valeur, pas les dégâts de la lettre", () => {
  const etat = duel();
  const ajuste = degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(22)), localisation: d20(20) }));
  assert.equal(ajuste.deBase, 10, "B = 10 reste écrit");
  assert.equal(ajuste.valeur, 22, "ajusté à 22");
  assert.deepEqual(ajuste.avant, [22]);
  assert.equal(ajuste.total, 22);
  const annule = degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(0)), localisation: d20(20) }));
  assert.equal(annule.valeur, 0);
  assert.deepEqual(annule.avant, [0], "des dégâts nuls : la localisation se fait quand même");
});

test("degatsFixes, jet prêté : « Sans dégâts » ne vaut rien ; « Dégâts de l'arme », la lettre dans les dégâts de l'arme prêtée", () => {
  const etat = duel();
  const prete = (champs) => degatsFixes(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", jet: jetA("attaque", 3), localisation: d20(7), ...champs }));

  const sans = prete({ armePretee: 0, degats: normaux("aucun") });
  assert.equal(sans.lettre, null, "pas de lettre pour la base « aucun »");
  assert.equal(sans.deBase, 0);
  assert.equal(sans.valeur, 0);
  assert.deepEqual(sans.avant, [0]);

  const couteau = prete({ armePretee: 0, degats: normaux("arme") });
  assert.equal(couteau.lettre, 2);
  assert.equal(couteau.deBase, 15, "C du couteau, 5/10/15");
  assert.equal(couteau.valeur, 15);
  const mains = prete({ armePretee: 1, degats: normaux("arme") });
  assert.equal(mains.deBase, 8, "C des mains nues, 2/4/8");

  const saisi = prete({ armePretee: null, degats: normaux("aucun", ajuster(4, "Frappe")) });
  assert.equal(saisi.deBase, 0);
  assert.equal(saisi.valeur, 4, "sans arme, les dégâts se saisissent à la main");
});

// ─── Plusieurs d20 ──────────────────────────────────────────────────────────

test("nombreDeD20 : autant que le dit la capacité jouée, un par défaut", () => {
  const etat = duel({
    pj: (valeurs) => {
      valeurs.capacites[1].facons[0].locMultiple = 2;
      valeurs.capacites[1].facons[0].elements = ["Localisation multiple"];
    },
    adv: (valeurs) => { valeurs.capacites[1].facons[0].locMultiple = 3; },
  });
  assert.equal(nombreDeD20(etat, frappeDuPj(etat, 1)), 1, "Frappe : un d20, par défaut");
  assert.equal(nombreDeD20(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Émincer"), cible: "adv2" })), 2);
  assert.equal(nombreDeD20(etat, frappeDeLAdversaire(etat, 1)), 1);
  assert.equal(nombreDeD20(etat, gesteEssai({ acteur: "adv2", capacite: indiceDe(etat, "adv2", "Moulinet farineux"), cible: "pj1" })), 3);
});

test("nombreDeD20 : un jet prêté lance ceux de l'arme prêtée, un seul sans arme ; un geste sans jet d'attaque, aucun", () => {
  const etat = duel({ pj: (valeurs) => { valeurs.armes[0].locMultiple = 2; valeurs.armes[1].locMultiple = 3; } });
  const prete = (armePretee) => gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee });
  assert.equal(nombreDeD20(etat, prete(0)), 2, "le couteau");
  assert.equal(nombreDeD20(etat, prete(1)), 3, "les mains nues");
  assert.equal(nombreDeD20(etat, prete(null)), 1, "sans arme");
  assert.equal(nombreDeD20(etat, frappeDuPj(etat, 1)), 1, "une attaque suit sa façon, pas l'arme");
  for (const mode of ["sans_jet", "deplacement", "caracteristique"]) {
    assert.equal(nombreDeD20(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode })), 0, mode);
  }
});

test("les blessures ne pèsent pas sur la localisation : le d20 se lit tel qu'il tombe", () => {
  const blesse = duel({
    retoucher: (etat) => {
      for (const id of ["pj1", "adv2"]) {
        etat.protagonistes[id].zones[0].resistance = 0;
        etat.protagonistes[id].zones[1].resistance = 0;
      }
    },
  });
  const sain = duel();
  for (const brut of [2, 12, 14, 19]) {
    assert.deepEqual(coupsDuGeste(blesse, frappeDuPj(blesse, 1, { localisation: d20(brut) }))[0].zone, coupsDuGeste(sain, frappeDuPj(sain, 1, { localisation: d20(brut) }))[0].zone, `sur l'adversaire, dé ${brut}`);
    assert.deepEqual(coupsDuGeste(blesse, frappeDeLAdversaire(blesse, 1, { localisation: d20(brut) }))[0].zone, coupsDuGeste(sain, frappeDeLAdversaire(sain, 1, { localisation: d20(brut) }))[0].zone, `sur le PJ, dé ${brut}`);
  }
});

test("plusieurs d20 : les dégâts s'appliquent en entier à chaque zone, même deux fois à la même", () => {
  const etat = duel();
  const aucun = degatsFixes(etat, frappeDuPj(etat, 2));
  assert.deepEqual(aucun.avant, [], "avant le premier d20, aucun coup");
  assert.equal(aucun.total, 0);

  const deux = frappeDuPj(etat, 2, { localisation: d20(6, 13) });
  assert.deepEqual(degatsFixes(etat, deux).avant, [10, 10]);
  assert.equal(degatsFixes(etat, deux).total, 20, "le total : la somme des dégâts de chaque zone touchée");
  assert.deepEqual(coupsDuGeste(etat, deux), [
    { zone: zoneDe(etat, "adv2", "torse"), degats: 10, surplus: 0, nature: "normaux" },
    { zone: zoneDe(etat, "adv2", "jambe_gauche"), degats: 10, surplus: 0, nature: "normaux" },
  ]);

  const memeZone = frappeDuPj(etat, 1, { localisation: d20(4, 9, 11) });
  assert.deepEqual(degatsFixes(etat, memeZone).avant, [5, 5, 5]);
  const torse = zoneDe(etat, "adv2", "torse");
  assert.deepEqual(coupsDuGeste(etat, memeZone).map((coup) => coup.zone), [torse, torse, torse]);
  assert.equal(appliquer(etat, memeZone).courant.zones[torse].armure, 0, "armure 10, trois fois 5");
  assert.equal(appliquer(etat, memeZone).courant.zones[torse].resistance, 0, "le troisième coup passe à l'endurance");
});

test("coupsDuGeste : chaque d20 se lit sur la grille de la cible, décalage compris", () => {
  const etat = duel();
  const surLAdversaire = frappeDuPj(etat, 1, { localisation: d20(20, { brut: 14, decalage: { valeur: -2, raison: "Minutie" } }) });
  assert.deepEqual(coupsDuGeste(etat, surLAdversaire).map((coup) => photoDe(etat, "adv2").zones[coup.zone].code), ["tete", "jambe_gauche"]);
  const surLePj = frappeDeLAdversaire(etat, 1, { localisation: d20(1, { brut: 14, decalage: { valeur: 3, raison: "Minutie" } }) });
  assert.deepEqual(coupsDuGeste(etat, surLePj).map((coup) => photoDe(etat, "pj1").zones[coup.zone].code), ["tete", "bras_gauche"]);
});

test("la face de contre-attaque annule toute l'attaque, même parmi plusieurs dés ; sans elle, chaque dé porte", () => {
  const etat = duel();
  const surLAdversaire = (...bruts) => frappeDuPj(etat, 3, { localisation: d20(...bruts) });
  assert.equal(coupsDuGeste(etat, surLAdversaire(6, 13)).length, 2);
  assert.deepEqual(coupsDuGeste(etat, surLAdversaire(1)), [], "la face 1 d'un adversaire");
  assert.deepEqual(coupsDuGeste(etat, surLAdversaire(6, 1)), [], "le premier dé, sur le torse, est annulé lui aussi");
  assert.deepEqual(coupsDuGeste(etat, surLAdversaire(1, 6)), []);
  assert.equal(coupsDuGeste(etat, surLAdversaire(20)).length, 1, "20 est la tête d'un adversaire, pas sa contre-attaque");

  const surLePj = (...bruts) => frappeDeLAdversaire(etat, 0, { localisation: d20(...bruts) });
  assert.deepEqual(coupsDuGeste(etat, surLePj(20)), [], "la face 20 d'un PJ");
  assert.deepEqual(coupsDuGeste(etat, surLePj(6, 20)), []);
  assert.equal(coupsDuGeste(etat, surLePj(1)).length, 1, "1 est la tête d'un PJ, pas sa contre-attaque");

  const decalee = frappeDuPj(etat, 3, { localisation: d20({ brut: 1, decalage: { valeur: 5, raison: "Minutie" } }) });
  assert.deepEqual(coupsDuGeste(etat, decalee), [], "le décalage n'efface pas la face brute");
  assert.equal(appliquer(etat, surLAdversaire(6, 1)).courant, courantDe(etat, "adv2"), "rien n'est appliqué");
});

test("une capacité sans dégâts qui touche se localise, et aucune zone ne perd rien", () => {
  const etat = duel({ pj: reduction(2) });
  const geste = gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee: 0, jet: jetA("attaque", 1), degats: normaux("aucun"), localisation: d20(7) });
  assert.deepEqual(coupsDuGeste(etat, geste), [{ zone: zoneDe(etat, "adv2", "torse"), degats: 0, surplus: 0, nature: "normaux" }]);
  const rendu = appliquer(etat, geste);
  assert.equal(rendu.courant, courantDe(etat, "adv2"), "l'état de la cible est le même objet");
  assert.deepEqual(rendu.coups, [{ zone: zoneDe(etat, "adv2", "torse"), armure: [10, 10], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }]);
  assert.equal(rendu.mort, false);
});

// ─── Les dégâts, zone par zone ──────────────────────────────────────────────

test("zone par zone : l'armure perd les dégâts, et tient tant qu'elle les couvre", () => {
  const rendu = unCoup(victime({ armure: 15 }), 8);
  assert.deepEqual(apres(rendu), [7, 5, 10], "Armure 15 → 7.");
  assert.deepEqual(rendu.coups, [{ zone: 0, armure: [15, 7], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }]);
  assert.equal(rendu.mort, false);
  assert.deepEqual(apres(unCoup(victime({ armure: 15 }), 15)), [0, 5, 10], "juste couverte : rien ne passe");
  assert.deepEqual(apres(unCoup(victime({ armure: 15 }), 16)), [0, 4, 10], "un point de plus passe à l'endurance");
});

test("zone par zone : le reste passe à l'endurance, puis au corps", () => {
  assert.deepEqual(apres(unCoup(victime({ armure: 5 }), 7)), [0, 3, 10], "5 à l'armure, 2 à l'endurance");
  assert.deepEqual(apres(unCoup(victime({ armure: 5 }), 10)), [0, 0, 10], "juste couvert par l'armure et l'endurance");
  assert.deepEqual(apres(unCoup(victime({ armure: 5 }), 11)), [0, 0, 9], "un point de plus passe au corps");
  assert.deepEqual(apres(unCoup(victime({ armure: 5 }), 12)), [0, 0, 8]);
  const rendu = unCoup(victime({ armure: 5 }), 12);
  assert.deepEqual(rendu.coups[0], { zone: 0, armure: [5, 0], resistance: [5, 0], corps: [10, 8], blessure: true, blessures: 1 });
});

test("zone par zone : une armure déjà nulle laisse tout passer à l'endurance", () => {
  const rendu = unCoup(victime({ armure: 0 }), 3);
  assert.deepEqual(apres(rendu), [0, 2, 10], "Endurance 5 → 2.");
  assert.deepEqual(rendu.coups[0].armure, [0, 0]);
  assert.deepEqual(apres(unCoup(victime({ armure: 0, resistance: 0 }), 3)), [0, 0, 7], "sans armure ni endurance : au corps");
});

test("zone par zone : seule la zone touchée change, le corps est commun", () => {
  const rendu = unCoup(victime({ armure: 5 }), 12, { zone: 1 });
  assert.deepEqual(apres(rendu, 0), [5, 5, 8], "la zone voisine garde son armure et son endurance");
  assert.deepEqual(apres(rendu, 1), [0, 0, 8]);
  assert.deepEqual(apres(rendu, 2), [5, 5, 8]);
});

test("ce qui dépasse 0 de corps se perd", () => {
  const rendu = unCoup(victime({ armure: 5 }), 999);
  assert.deepEqual(apres(rendu), [0, 0, 0]);
  assert.deepEqual(rendu.coups[0].corps, [10, 0]);
  assert.equal(rendu.mort, true);
  assert.deepEqual(apres(unCoup(victime({ armure: 0, resistance: 0, corps: 7 }), 8)), [0, 0, 0], "Corps 7 → 0.");
});

test("des dégâts de 0 ou moins n'enlèvent rien", () => {
  for (const degats of [0, -1, -50]) {
    const courant = victime({ armure: 5 });
    const rendu = unCoup(courant, degats, { surplus: 3 });
    assert.equal(rendu.courant, courant, `${degats} : le même objet`);
    assert.deepEqual(rendu.coups, [{ zone: 0, armure: [5, 5], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }]);
    assert.equal(rendu.mort, false);
  }
  assert.deepEqual(apres(unCoup(victime({ armure: 5 }), 1)), [4, 5, 10], "un seul point, lui, enlève");
});

test("deux dés sur la même zone se suivent : le second part de ce qu'a laissé le premier", () => {
  const rendu = frapper(victime({ armure: 10 }), [
    { zone: 0, degats: 8, surplus: 0, nature: "normaux" },
    { zone: 0, degats: 8, surplus: 0, nature: "normaux" },
  ]);
  assert.deepEqual(rendu.coups, [
    { zone: 0, armure: [10, 2], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 },
    { zone: 0, armure: [2, 0], resistance: [5, 0], corps: [10, 9], blessure: true, blessures: 1 },
  ]);
  assert.deepEqual(apres(rendu), [0, 0, 9]);
});

test("deux dés sur deux zones : chacune son armure et son endurance, un seul corps", () => {
  const rendu = frapper(victime({ armure: 2 }), [
    { zone: 0, degats: 10, surplus: 0, nature: "normaux" },
    { zone: 2, degats: 10, surplus: 0, nature: "normaux" },
  ]);
  assert.deepEqual(rendu.coups, [
    { zone: 0, armure: [2, 0], resistance: [5, 0], corps: [10, 7], blessure: true, blessures: 1 },
    { zone: 2, armure: [2, 0], resistance: [5, 0], corps: [7, 4], blessure: true, blessures: 2 },
  ]);
  assert.deepEqual(apres(rendu, 1), [2, 5, 4], "la zone du milieu n'a rien reçu");
  assert.equal(rendu.mort, false);
});

// ─── Dégrossir ──────────────────────────────────────────────────────────────

test("dégrossir, les exemples de la mission : armure 15, dégâts 13, +3, l'armure tombe à 0 et rien ne passe", () => {
  assert.deepEqual(apres(unCoup(victime({ armure: 15 }), 13, { surplus: 3 })), [0, 5, 10]);
  assert.deepEqual(apres(unCoup(victime({ armure: 15 }), 13)), [2, 5, 10], "sans dégrossir, l'armure garde 2");
  assert.deepEqual(apres(unCoup(victime({ armure: 30 }), 13, { surplus: 3 })), [14, 5, 10], "Armure 30 → 14.");
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 9)), [1, 5, 10], "Armure 10 → 1.");
});

test("dégrossir : ce qui passe à l'endurance reste « les dégâts moins l'armure d'avant le coup »", () => {
  const rendu = unCoup(victime({ armure: 5 }), 22, { surplus: 2 });
  assert.deepEqual(rendu.coups, [{ zone: 0, armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 }], "Armure 5 → 0, endurance 5 → 0, corps 10 → 0.");
  assert.equal(rendu.mort, true);

  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 12, { surplus: 3 })), [0, 3, 10], "12 − 10 = 2 passent, pas 5");
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 12)), [0, 3, 10], "l'endurance reçoit la même chose sans dégrossir");
  assert.deepEqual(apres(unCoup(victime({ armure: 0 }), 8, { surplus: 3 })), [0, 0, 7], "sans armure, le surplus ne sert à rien : Endurance 5 → 0, corps 10 → 7.");
});

test("dégrossir, chez un PJ : N points de plus contre l'armure par réussite, N étant le niveau de la capacité", () => {
  const etat = duel({ pj: reduction(1) });
  for (const nombre of [1, 2, 3]) {
    const fixes = degatsFixes(etat, frappeDuPj(etat, nombre));
    assert.equal(fixes.surplus, nombre, `${nombre} réussite(s)`);
    assert.equal(fixes.sourceDuSurplus, "Réduction", "le nom que la banque donne à la capacité");
  }
  const niveau2 = duel({ pj: reduction(2) });
  assert.deepEqual([1, 2, 3].map((nombre) => degatsFixes(niveau2, frappeDuPj(niveau2, nombre)).surplus), [2, 4, 6]);

  const sans = degatsFixes(duel(), frappeDuPj(duel(), 3));
  assert.equal(sans.surplus, 0, "sans le passif, rien");
  assert.equal(sans.sourceDuSurplus, null);
  const niveau0 = duel({ pj: reduction(0) });
  assert.equal(degatsFixes(niveau0, frappeDuPj(niveau0, 3)).surplus, 0, "au niveau 0, rien");
  assert.equal(degatsFixes(niveau0, frappeDuPj(niveau0, 3)).sourceDuSurplus, null);
});

test("dégrossir, chez un adversaire : ses réussites valent 3 moins celles de la défense du PJ", () => {
  const etat = duel({ adv: reduction(2) });
  assert.deepEqual([0, 1, 2].map((nombre) => degatsFixes(etat, frappeDeLAdversaire(etat, nombre)).surplus), [6, 4, 2]);
  assert.equal(degatsFixes(etat, frappeDeLAdversaire(etat, 1)).sourceDuSurplus, "Réduction");

  const duPj = duel({ pj: reduction(2) });
  assert.equal(degatsFixes(duPj, frappeDeLAdversaire(duPj, 0)).surplus, 0, "le passif de la cible ne compte pas : c'est celui de l'attaquant");
  assert.equal(degatsFixes(etat, frappeDuPj(etat, 3)).surplus, 0);
});

test("dégrossir compte les réussites du jet, pas l'ajustement à la main", () => {
  const etat = duel({ pj: reduction(1) });
  const fixes = degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(22)) }));
  assert.equal(fixes.valeur, 22);
  assert.equal(fixes.surplus, 2, "+2 contre l'armure, pour deux réussites");
});

test("dégrossir vaut pour les mains nues et pour un jet prêté joué avec « Dégâts de l'arme »", () => {
  const etat = duel({ pj: reduction(1) });
  const taloche = gesteEssai({ capacite: indiceDe(etat, "pj1", "Taloche"), cible: "adv2", caracteristiques: ["force", "agilite"], jet: jetA("attaque", 3), degats: normaux("lettre") });
  assert.equal(degatsFixes(etat, taloche).deBase, 8);
  assert.equal(degatsFixes(etat, taloche).surplus, 3);
  const prete = gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee: 0, jet: jetA("attaque", 2), degats: normaux("arme") });
  assert.equal(degatsFixes(etat, prete).surplus, 2);
});

test("dégrossir ne s'applique jamais sans dégâts : « Sans dégâts », dégâts saisis sur la base « aucun », dégâts fixés à 0", () => {
  const etat = duel({ pj: reduction(3) });
  const prete = (degats) => degatsFixes(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", cible: "adv2", armePretee: 0, jet: jetA("attaque", 2), degats }));
  assert.equal(prete(normaux("arme")).surplus, 6, "le témoin : avec « Dégâts de l'arme », il s'applique");
  for (const [degats, quoi] of [[normaux("aucun"), "« Sans dégâts »"], [normaux("aucun", ajuster(9)), "des dégâts saisis à la main"]]) {
    assert.equal(prete(degats).surplus, 0, quoi);
    assert.equal(prete(degats).sourceDuSurplus, null, quoi);
  }
  const nuls = degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(0)) }));
  assert.equal(nuls.surplus, 0, "des dégâts fixés à 0");
  assert.equal(degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(1)) })).surplus, 6, "à 1, il s'applique");
});

test("dégrossir ne s'applique jamais en dégâts directs", () => {
  const etat = duel({ pj: reduction(3) });
  for (const nature of ["resistance", "corps"]) {
    const fixes = degatsFixes(etat, frappeDuPj(etat, 2, { degats: { base: "lettre", operations: [ajuster(4)], nature } }));
    assert.equal(fixes.nature, nature);
    assert.equal(fixes.valeur, 4);
    assert.equal(fixes.surplus, 0, nature);
    assert.equal(fixes.sourceDuSurplus, null);
  }
  assert.equal(degatsFixes(etat, frappeDuPj(etat, 2, { degats: normaux("lettre", ajuster(4)) })).surplus, 6, "les mêmes, en dégâts normaux");
  // Et frapper() n'en tient pas compte, même si on lui en donnait un.
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 3, { surplus: 6, nature: "resistance" })), [10, 2, 10]);
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 3, { surplus: 6, nature: "corps" })), [10, 5, 7]);
});

test("dégrossir ne s'applique pas à un coup que l'esquive a annulé", () => {
  const etat = duel({ adv: reduction(2) });
  const torse = zoneDe(etat, "pj1", "torse");
  const jambe = zoneDe(etat, "pj1", "jambe_gauche");
  // Une réussite en défense : B = 10, et deux réussites pour l'attaquant, +4.
  const geste = (x) => frappeDeLAdversaire(etat, 1, { localisation: d20(6, 13), interventions: x > 0 ? [esquive(x)] : [] });

  const sansEsquive = appliquer(etat, geste(0));
  assert.deepEqual([sansEsquive.courant.zones[torse].armure, sansEsquive.courant.zones[jambe].armure], [0, 0], "10 + 4 contre une armure de 10, deux fois");

  const premierAnnule = appliquer(etat, geste(10));
  assert.deepEqual(coupsDuGeste(etat, geste(10)).map((coup) => coup.degats), [0, 10]);
  assert.equal(premierAnnule.courant.zones[torse].armure, 10, "le coup annulé ne dégrossit pas");
  assert.equal(premierAnnule.courant.zones[jambe].armure, 0, "le coup qui reste, si");

  const entame = appliquer(etat, geste(9));
  assert.equal(entame.courant.zones[torse].armure, 5, "un seul point de dégâts restant : 1 + 4 contre l'armure");
});

// ─── Les dégâts directs ─────────────────────────────────────────────────────

test("dégâts directs à l'endurance : la zone touchée, puis le corps, sans toucher l'armure", () => {
  const rendu = unCoup(victime({ armure: 10 }), 3, { nature: "resistance" });
  assert.deepEqual(rendu.coups, [{ zone: 0, armure: [10, 10], resistance: [5, 2], corps: [10, 10], blessure: false, blessures: 0 }]);
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 5, { nature: "resistance" })), [10, 0, 10], "juste l'endurance");
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 8, { nature: "resistance" })), [10, 0, 7], "le reste passe au corps");
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 3)), [7, 5, 10], "les mêmes, en dégâts normaux, s'arrêtent à l'armure");
  assert.equal(unCoup(victime({ armure: 10 }), 5, { nature: "resistance" }).coups[0].blessure, true, "la blessure vaut aussi en dégâts directs");
});

test("dégâts directs au corps : ni l'armure ni l'endurance", () => {
  const rendu = unCoup(victime({ armure: 10 }), 4, { nature: "corps" });
  assert.deepEqual(rendu.coups, [{ zone: 0, armure: [10, 10], resistance: [5, 5], corps: [10, 6], blessure: false, blessures: 0 }]);
  assert.equal(rendu.mort, false);
  assert.equal(unCoup(victime({ armure: 10 }), 10, { nature: "corps" }).mort, true);
  assert.deepEqual(apres(unCoup(victime({ armure: 10 }), 25, { nature: "corps" })), [10, 5, 0], "ce qui dépasse se perd");
});

test("dégâts directs, d'un geste : le nombre saisi remplace les dégâts du coup", () => {
  const etat = duel();
  const torse = zoneDe(etat, "adv2", "torse");
  const geste = (nature) => frappeDuPj(etat, 2, { degats: { base: "lettre", operations: [ajuster(7, "Poison")], nature }, localisation: d20(6) });
  assert.deepEqual(coupsDuGeste(etat, geste("resistance")), [{ zone: torse, degats: 7, surplus: 0, nature: "resistance" }]);
  const aLaResistance = appliquer(etat, geste("resistance"));
  assert.deepEqual(aLaResistance.coups[0], { zone: torse, armure: [10, 10], resistance: [5, 0], corps: [10, 8], blessure: true, blessures: 1 });
  const auCorps = appliquer(etat, geste("corps"));
  assert.deepEqual(auCorps.coups[0], { zone: torse, armure: [10, 10], resistance: [5, 5], corps: [10, 3], blessure: false, blessures: 0 });
});

// ─── L'esquive ──────────────────────────────────────────────────────────────

test("imputerEsquive : X points annulent X dégâts", () => {
  assert.deepEqual(imputerEsquive([16], 3), [13], "16 → 13");
  assert.deepEqual(imputerEsquive([12], 12), [0]);
  assert.deepEqual(imputerEsquive([12], 0), [12], "sans esquive, rien ne change");
  assert.deepEqual(imputerEsquive([12], 1), [11]);
  assert.deepEqual(imputerEsquive([12], 40), [0], "on n'annule pas plus qu'il n'y a");
  assert.deepEqual(imputerEsquive([], 5), []);
});

test("imputerEsquive : sur plusieurs zones, zone après zone, dans l'ordre des dés", () => {
  assert.deepEqual(imputerEsquive([12, 12], 15), [0, 9]);
  assert.deepEqual(imputerEsquive([10, 10], 12), [0, 8], "torse 10 → 0, jambe gauche 10 → 8");
  assert.deepEqual(imputerEsquive([10, 10], 10), [0, 10], "juste le premier coup");
  assert.deepEqual(imputerEsquive([10, 10], 9), [1, 10], "le second n'est entamé qu'une fois le premier annulé");
  assert.deepEqual(imputerEsquive([10, 10, 10], 25), [0, 0, 5]);
  assert.deepEqual(imputerEsquive([0, 10], 4), [0, 6], "un coup sans dégâts ne retient rien");
  const coups = Object.freeze([10, 10]);
  assert.deepEqual(imputerEsquive(coups, 3), [7, 10], "la liste reçue ne change pas");
});

test("imputerEsquive : l'esquive annule, elle n'ajoute jamais ; un coup de 0 ou moins ne lui prend rien", () => {
  assert.deepEqual(imputerEsquive([12], -3), [12], "X se choisit à partir de 1 : un X négatif n'ajoute aucun dégât");
  assert.deepEqual(imputerEsquive([10, 10], -5), [10, 10]);
  assert.deepEqual(imputerEsquive([-2, 12], 5), [-2, 7], "5 points annulent 5 dégâts : des dégâts négatifs n'en rendent pas à l'esquive");
  assert.deepEqual(imputerEsquive([-2, -2], 3), [-2, -2], "des dégâts de 0 ou moins restent ce qu'ils sont");
});

test("degatsFixes : l'esquive laisse « avant » et le total, et retire ses points de « parCoup »", () => {
  const etat = duel();
  const geste = (interventions) => frappeDeLAdversaire(etat, 1, { localisation: d20(6, 13), interventions });
  const sans = degatsFixes(etat, geste([]));
  assert.deepEqual(sans.avant, [10, 10]);
  assert.deepEqual(sans.parCoup, [10, 10]);
  assert.equal(sans.total, 20);

  const avec = degatsFixes(etat, geste([esquive(12)]));
  assert.deepEqual(avec.avant, [10, 10], "les dégâts d'avant l'esquive");
  assert.deepEqual(avec.parCoup, [0, 8]);
  assert.equal(avec.total, 20, "la borne de l'esquive : la somme d'avant");
  assert.equal(avec.valeur, 10, "les dégâts fixés ne changent pas");

  const rendu = appliquer(etat, geste([esquive(12)]));
  assert.equal(rendu.courant.zones[zoneDe(etat, "pj1", "torse")].armure, 10, "le torse n'a rien reçu");
  assert.equal(rendu.courant.zones[zoneDe(etat, "pj1", "jambe_gauche")].armure, 2);
});

// ─── La blessure ────────────────────────────────────────────────────────────

test("la blessure : l'endurance d'une zone tombe à 0 ; à 1, ce n'en est pas une", () => {
  const blessee = unCoup(victime({ armure: 0 }), 5);
  assert.equal(blessee.coups[0].blessure, true);
  assert.equal(blessee.coups[0].blessures, 1);
  const entamee = unCoup(victime({ armure: 0 }), 4);
  assert.deepEqual(entamee.coups[0].resistance, [5, 1]);
  assert.equal(entamee.coups[0].blessure, false);
  assert.equal(entamee.coups[0].blessures, 0);
});

test("la blessure ne se compte qu'une fois par zone, et le compte suit les zones à 0", () => {
  const dejaBlessee = unCoup(victime({ armure: 0, resistance: 0 }), 2);
  assert.equal(dejaBlessee.coups[0].blessure, false, "l'endurance était déjà à 0 : ce coup ne blesse pas");
  assert.equal(dejaBlessee.coups[0].blessures, 3, "les trois zones de cette victime sont à 0");

  const rendu = frapper(victime({ armure: 0 }), [
    { zone: 0, degats: 5, surplus: 0, nature: "normaux" },
    { zone: 0, degats: 1, surplus: 0, nature: "normaux" },
    { zone: 2, degats: 5, surplus: 0, nature: "normaux" },
    { zone: 1, degats: 2, surplus: 0, nature: "normaux" },
  ]);
  assert.deepEqual(rendu.coups.map((coup) => coup.blessure), [true, false, true, false]);
  assert.deepEqual(rendu.coups.map((coup) => coup.blessures), [1, 1, 2, 2], "−1, puis −2 à ses jets");
});

test("le compte des blessures d'un coup est celui que lit le jet suivant", () => {
  const etat = duel();
  const geste = frappeDeLAdversaire(etat, 0, { localisation: d20(13) });
  const rendu = appliquer(etat, geste);
  const jambe = zoneDe(etat, "pj1", "jambe_gauche");
  assert.deepEqual(rendu.coups, [{ zone: jambe, armure: [10, 0], resistance: [5, 0], corps: [10, 10], blessure: true, blessures: 1 }], "C = 15 : armure 10, endurance 5");
  const ensuite = { ...etat, protagonistes: { ...etat.protagonistes, pj1: rendu.courant } };
  assert.equal(blessuresDe(etat, "pj1"), 0);
  assert.equal(blessuresDe(ensuite, "pj1"), rendu.coups[0].blessures);
});

// ─── La mort ────────────────────────────────────────────────────────────────

test("la mort : à 0 point de corps ; à 1, on vit encore", () => {
  assert.equal(unCoup(victime({ armure: 0, resistance: 0 }), 9).mort, false);
  assert.deepEqual(apres(unCoup(victime({ armure: 0, resistance: 0 }), 9)), [0, 0, 1]);
  assert.equal(unCoup(victime({ armure: 0, resistance: 0 }), 10).mort, true);
  assert.equal(unCoup(victime({ armure: 0, resistance: 0 }), 0).mort, false, "sans dégâts, personne ne meurt");
  assert.equal(frapper(victime(), []).mort, false, "sans coup non plus");
});

test("la mort peut venir du second dé : le corps se vide d'une zone à l'autre", () => {
  const rendu = frapper(victime({ armure: 0, resistance: 0, corps: 10 }), [
    { zone: 0, degats: 6, surplus: 0, nature: "normaux" },
    { zone: 1, degats: 6, surplus: 0, nature: "normaux" },
  ]);
  assert.deepEqual(rendu.coups.map((coup) => coup.corps), [[10, 4], [4, 0]]);
  assert.equal(rendu.mort, true);
});

// ─── Ce que frapper reçoit et rend ──────────────────────────────────────────

test("frapper ne change pas ce qu'il reçoit, et rend un état neuf, gelé, qui partage les zones intactes", () => {
  const courant = victime({ armure: 5 });
  const avant = JSON.stringify(courant);
  const coups = Object.freeze([Object.freeze({ zone: 1, degats: 7, surplus: 0, nature: "normaux" })]);
  const rendu = frapper(courant, coups);
  assert.equal(JSON.stringify(courant), avant);
  assert.notEqual(rendu.courant, courant);
  assert.ok(estGeleEnProfondeur(rendu.courant));
  assert.ok(estGeleEnProfondeur(rendu.coups));
  assert.equal(rendu.courant.zones[0], courant.zones[0], "une zone intacte est la même");
  assert.equal(rendu.courant.zones[2], courant.zones[2]);
  assert.notEqual(rendu.courant.zones[1], courant.zones[1]);
  assert.deepEqual(rendu.courant.zones[1], { armure: 0, armureMax: 10, resistance: 3, resistanceMax: 5 }, "les maxima ne bougent pas");
  const { zones, corps, ...reste } = rendu.courant;
  const { zones: zonesAvant, corps: corpsAvant, ...resteAvant } = courant;
  assert.deepEqual(reste, resteAvant, "ni la case, ni les actions, ni le souffle, ni la mort : frapper ne tue pas, il le dit");
  assert.equal(rendu.courant.mort, null);
});

test("la victime est un paramètre : frapper ne connaît ni l'état ni la cible du geste", () => {
  assert.equal(frapper.length, 2);
  const etat = duel();
  const geste = frappeDuPj(etat, 3, { localisation: d20(6) });
  // Les coups pensés pour Marmiton, reportés sur Aubépine elle-même.
  const reportes = frapper(courantDe(etat, "pj1"), coupsDuGeste(etat, geste));
  assert.equal(reportes.courant.zones[0].armure, 0, "la zone de même indice chez une autre victime");
  assert.equal(courantDe(etat, "adv2").zones[0].armure, 10);
});

test("un coup sur une zone qui n'existe pas ne change rien", () => {
  for (const zone of [-1, 3, 1.5, null, undefined, "0"]) {
    const courant = victime({ armure: 5 });
    const rendu = frapper(courant, [{ zone, degats: 50, surplus: 0, nature: "normaux" }]);
    assert.equal(rendu.courant, courant, `zone ${String(zone)}`);
    assert.equal(rendu.mort, false);
    assert.deepEqual(rendu.coups[0].corps, [10, 10]);
  }
});

// ─── Les témoins : le combat de référence fictif ────────────────────────────

/**
 * Aubépine Crèmebrûlée (pj1), le Chef de partie (adv2) et deux Marmitons de
 * corvée (adv3, adv4), tels que la démonstration les donne, tous sur la même
 * case. Aubépine porte Réduction [1] (dégrossir).
 */
function reference(retoucher = sansRetouche) {
  return etatEssai(
    miseEnPlaceEssai([
      { photo: aubepineEssai(), case: "D4" },
      { photo: chefDePartieEssai(), case: "D4" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
    ]),
    { noms: { pj1: { court: "Aubépine" }, adv2: { court: "Chef" }, adv3: { court: "Marmiton n° 1" }, adv4: { court: "Marmiton n° 2" } }, retoucher },
  );
}

// Un geste d'attaque du combat de référence, une fois ses dés tombés.
function coupDeReference(etat, { qui, joue: nom, contre, reussites: nombre, des, mode = "attaque", armePretee = null, degats = normaux(mode === "attaque" ? "lettre" : "aucun"), interventions = [] }) {
  const genre = qui === "pj1" ? "attaque" : "defense";
  return gesteEssai({ acteur: qui, capacite: indiceDe(etat, qui, nom), mode, cible: contre, armePretee, jet: jetA(genre, nombre), degats, localisation: d20(...des), interventions });
}

// Le bilan et les changements d'un coup, comme le journal les dira.
function verifier(etat, geste, { lettre, deBase, valeur = deBase, surplus, zone, coup, mort }) {
  const fixes = degatsFixes(etat, geste);
  assert.equal(fixes.lettre === null ? null : LETTRES[fixes.lettre], lettre, "la lettre");
  assert.equal(fixes.deBase, deBase, "les dégâts de la lettre");
  assert.equal(fixes.valeur, valeur, "les dégâts fixés");
  assert.equal(fixes.surplus, surplus, "le surplus de Réduction");
  assert.equal(fixes.sourceDuSurplus, surplus > 0 ? "Réduction" : null);
  const rendu = appliquer(etat, geste);
  assert.deepEqual(rendu.coups, [{ zone: zoneDe(etat, geste.cible, zone), ...coup }]);
  assert.equal(rendu.mort, mort);
  return rendu;
}

test("référence, étape 1 : « A = 3, +1 contre l'armure (Réduction). Localisation d20 → 16 : bras gauche. Armure 15 → 11. »", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Frappe", contre: "adv3", reussites: 1, des: [16] });
  verifier(etat, geste, { lettre: "A", deBase: 3, surplus: 1, zone: "bras_gauche", coup: { armure: [15, 11], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }, mort: false });
});

test("référence, étape 4 : « Aubépine reçoit B = 10. Localisation d20 → 13 : jambe gauche. Armure 10 → 0. »", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "adv3", joue: "Frappe", contre: "pj1", reussites: 1, des: [13] });
  verifier(etat, geste, { lettre: "B", deBase: 10, surplus: 0, zone: "jambe_gauche", coup: { armure: [10, 0], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }, mort: false });
});

test("référence, étape 8 : « B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction). […] tête. Armure 5 → 0, endurance 5 → 0, corps 10 → 0. » : il meurt", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Émincer", contre: "adv3", reussites: 2, des: [20], degats: normaux("lettre", ajuster(20)) });
  verifier(etat, geste, { lettre: "B", deBase: 8, valeur: 20, surplus: 2, zone: "tete", coup: { armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 }, mort: true });
});

test("référence, étape 9 : Taloche, « C = 8, +3 contre l'armure (Réduction). […] jambe droite. Endurance 5 → 0, corps 10 → 7. », une blessure", () => {
  const etat = reference();
  const geste = gesteEssai({ acteur: "pj1", capacite: indiceDe(etat, "pj1", "Taloche"), cible: "adv4", caracteristiques: ["force", "agilite"], jet: jetA("attaque", 3), degats: normaux("lettre"), localisation: d20(14) });
  // Les jambes d'un Marmiton de corvée n'ont pas d'armure : le surplus ne change rien.
  verifier(etat, geste, { lettre: "C", deBase: 8, surplus: 3, zone: "jambe_droite", coup: { armure: [0, 0], resistance: [5, 0], corps: [10, 7], blessure: true, blessures: 1 }, mort: false });
});

test("référence, étape 11 : « Aubépine reçoit B = 12. […] bras gauche. Aubépine intervient : Pas de côté (1 action, 3 souffle), 12 → 9. Armure 10 → 1. »", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "adv2", joue: "Frappe", contre: "pj1", reussites: 1, des: [17], interventions: [esquive(3)] });
  const fixes = degatsFixes(etat, geste);
  assert.deepEqual(fixes.avant, [12]);
  assert.deepEqual(fixes.parCoup, [9]);
  assert.equal(fixes.total, 12);
  verifier(etat, geste, { lettre: "B", deBase: 12, surplus: 0, zone: "bras_gauche", coup: { armure: [10, 1], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }, mort: false });
});

test("référence, étape 12 : « Aubépine reçoit A = 5. […] jambe gauche. Endurance 5 → 0. Blessure (jambe gauche) : −1 à ses jets. »", () => {
  const etat = reference((courant) => { courant.protagonistes.pj1.zones[2].armure = 0; });
  const geste = coupDeReference(etat, { qui: "adv4", joue: "Moulinet farineux", contre: "pj1", reussites: 2, des: [12] });
  verifier(etat, geste, { lettre: "A", deBase: 5, surplus: 0, zone: "jambe_gauche", coup: { armure: [0, 0], resistance: [5, 0], corps: [10, 10], blessure: true, blessures: 1 }, mort: false });
});

test("référence, étape 16 : « Aubépine reçoit C = 19. Localisation d20 → 20 : contre-attaque, l'attaque est annulée. »", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "adv2", joue: "Moulinet farineux", contre: "pj1", reussites: 0, des: [20] });
  const fixes = degatsFixes(etat, geste);
  assert.equal(LETTRES[fixes.lettre], "C");
  assert.equal(fixes.deBase, 19, "le bilan reste écrit");
  assert.deepEqual(fixes.avant, [], "aucun d20 ne touche une zone");
  assert.deepEqual(coupsDuGeste(etat, geste), []);
  const rendu = appliquer(etat, geste);
  assert.equal(rendu.courant, courantDe(etat, "pj1"), "rien n'est appliqué");
  assert.equal(rendu.mort, false);
});

test("référence, étape 19 : Fournaise avec le jet du couteau, « touché. Localisation d20 → 6 : torse. », sans dégâts ni Réduction", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Fournaise", contre: "adv2", reussites: 1, des: [6], mode: "jet_prete", armePretee: 0 });
  assert.deepEqual(basesPermises(etat, geste), ["aucun", "arme"]);
  const rendu = verifier(etat, geste, { lettre: null, deBase: 0, surplus: 0, zone: "torse", coup: { armure: [38, 38], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0 }, mort: false });
  assert.equal(rendu.courant, courantDe(etat, "adv2"), "le torse du Chef reste à 38 sur 38");
});

test("référence, étape 22 : « Aubépine reçoit B = 12. […] bras gauche. Armure 1 → 0, endurance 5 → 0, corps 10 → 4. Blessure (bras gauche) : −2 à ses jets. »", () => {
  const etat = reference((courant) => {
    const { zones } = courant.protagonistes.pj1;
    zones[2].armure = 0;
    zones[2].resistance = 0;
    zones[4].armure = 1;
  });
  const geste = coupDeReference(etat, { qui: "adv2", joue: "Frappe", contre: "pj1", reussites: 1, des: [16] });
  verifier(etat, geste, { lettre: "B", deBase: 12, surplus: 0, zone: "bras_gauche", coup: { armure: [1, 0], resistance: [5, 0], corps: [10, 4], blessure: true, blessures: 2 }, mort: false });
});

test("référence, étape 24 : « B = 8, +2 contre l'armure (Réduction). […] jambe droite. Corps 7 → 0. » : il meurt, le surplus se perd", () => {
  const etat = reference((courant) => {
    courant.protagonistes.adv4.zones[2].resistance = 0;
    courant.protagonistes.adv4.corps = 7;
  });
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Frappe", contre: "adv4", reussites: 2, des: [15] });
  verifier(etat, geste, { lettre: "B", deBase: 8, surplus: 2, zone: "jambe_droite", coup: { armure: [0, 0], resistance: [0, 0], corps: [7, 0], blessure: false, blessures: 1 }, mort: true });
});

test("référence, étape 25 : « C = 20, +3 contre l'armure (Réduction). […] jambe gauche. Endurance 5 → 0, corps 10 → 0. » : le Chef meurt", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Frappe", contre: "adv2", reussites: 3, des: [13] });
  verifier(etat, geste, { lettre: "C", deBase: 20, surplus: 3, zone: "jambe_gauche", coup: { armure: [0, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 }, mort: true });
});

test("annexe A de la mission, étape 2, dans la démonstration : « B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction). […] Armure 5 → 0, endurance 5 → 0, corps 10 → 0. »", () => {
  const etat = reference();
  const geste = coupDeReference(etat, { qui: "pj1", joue: "Émincer", contre: "adv4", reussites: 2, des: [20], degats: normaux("lettre", ajuster(22)) });
  verifier(etat, geste, { lettre: "B", deBase: 8, valeur: 22, surplus: 2, zone: "tete", coup: { armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 }, mort: true });
});
