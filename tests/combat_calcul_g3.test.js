// Contrôles du calcul neuf du groupe 3 (SPECIFICATION.md, § 17 ; mission du
// lot 4.3, § 4.4 à § 4.6 et § 4.10 ; contrat de la vague 1, § 3, § 5 et § 7.1
// à § 7.3) : js/combat/jet.js, degats.js, circonstances.js et valeurs.js. Le
// coup critique, l'inversion, la relance de la palette, « +1 réussite »,
// l'ordre des dégâts, le report, la blessure neuve, ±N, le retrait du combat
// et le nom d'une source.
//
// Chaque règle est vue des deux côtés : elle s'applique, puis, à une retouche
// près (un genre de jet, un avantage, une explosion, un rang), elle ne
// s'applique plus. Les jets s'ouvrent sur des circonstances écrites à la main
// et leurs dés sont imposés ; les états et les gestes sont écrits à la main,
// sans le moteur, d'après la forme du contrat (§ 3 et § 4). Les noms sont ceux
// de la démonstration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { circonstances, modificateursDe } from "../js/combat/circonstances.js";
import { blessuresAChoisir, coupsDuGeste, degatsFixes, frapper, lettreDe, lettreDuGeste, localisationsDuGeste, localiser, victimeDe } from "../js/combat/degats.js";
import {
  ajouterReussite,
  critiqueOffert,
  critiqueReussi,
  deAttendu,
  dernierDeOffert,
  evaluerEssai,
  exploser,
  garder,
  garderLeCritique,
  inversable,
  inverserDernier,
  jetFini,
  lancerDe,
  modificateurDe,
  netDe,
  ouvrirJet,
  relancable,
  relancer,
  relancerParPalette,
  relancesRestantes,
  reussites,
  reussitesDesPlaces,
  tenterLeCritique,
  tirageGarde,
} from "../js/combat/jet.js";
import { LETTRES, geler } from "../js/combat/regles.js";
import { alliesSurLaCase, attaqueDe, courantDe, defenseDe, effetsDuGeste, effetsDurablesDe, gardesDe, nomDeLaSource, photoDe, vivant, vivantsDe } from "../js/combat/valeurs.js";
import { adversaireEssai, ajouterPassif, etatEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils : les jets ──────────────────────────────────────────────────

// Les circonstances d'un jet d'Aubépine : un d10 contre 5 par défaut ;
// « avantages » et « desavantages » en nombres, « modificateur » en un nombre.
function circ({ genre = "attaque", faces = 10, difficulte = 5, modificateur = 0, avantages = 0, desavantages = 0 } = {}) {
  return {
    genre,
    lanceur: "pj1",
    faces,
    caracteristiques: null,
    mobilisees: ["precision", "agilite"],
    difficulte,
    libelle: null,
    modificateurs: modificateur === 0 ? [] : [{ genre: "passif", nom: "Vif", valeur: modificateur }],
    avantages: avantages > 0 ? [{ genre: "main", nom: "Minutie", nombre: avantages, de: null }] : [],
    desavantages: desavantages > 0 ? [{ genre: "main", nom: "Sol glissant", nombre: desavantages, de: null }] : [],
  };
}

const ouvrir = (champs) => ouvrirJet(circ(champs));

const PAS = {
  relancer,
  garder,
  exploser,
  tenter: tenterLeCritique,
  garderLeCritique,
  inverser: inverserDernier,
  palette: relancerParPalette,
  plusUn: ajouterReussite,
};

// Joue une suite de pas : un tableau est un dé (ses valeurs brutes), un mot
// un choix. Lève au premier refus : ces pas-là sont censés passer.
function jouer(jet, ...pas) {
  let courant = jet;
  for (const [rang, un] of pas.entries()) {
    const rendu = Array.isArray(un) ? lancerDe(courant, un) : PAS[un](courant);
    assert.equal(rendu.refus, undefined, `pas ${rang + 1} (${JSON.stringify(un)}) refusé : ${rendu.refus?.message}`);
    courant = rendu.jet;
  }
  return courant;
}

// Un refus ne change rien : le jet reçu reste le même, à la lettre.
function refuse(jet, nom) {
  const avant = JSON.stringify(jet);
  const rendu = PAS[nom](jet);
  assert.equal(JSON.stringify(jet), avant, `${nom} : le jet reçu ne change pas`);
  assert.deepEqual(Object.keys(rendu), ["refus"], `${nom} : refusé`);
  assert.equal(rendu.refus.code, "hors_moment");
  return rendu.refus.message;
}

const dernier = (jet) => jet.places.at(-1).essais.at(-1);
const lu = (jet) => evaluerEssai(jet, dernier(jet));

// Trois réussites d'attaque, avec un avantage qui reste.
const troisAvecUnAvantage = (champs = {}) => jouer(ouvrir({ avantages: 1, ...champs }), [8], [8], [8]);

// ─── Les outils : les états et les gestes ───────────────────────────────────

const brioche = () =>
  pjEssai((valeurs) => {
    valeurs.identifiant = "essai-brioche-0000000002";
    valeurs.nom = "Brioche";
  });

/**
 * Aubépine (pj1) et Marmiton (adv2), puis Brioche (pj3), tous en D4 ; « pj »
 * retouche les valeurs d'Aubépine, « retoucher » l'état avant son gel.
 */
function trio({ pj = () => {}, retoucher = () => {} } = {}) {
  return etatEssai(
    miseEnPlaceEssai([
      { photo: pjEssai(pj), case: "D4" },
      { photo: adversaireEssai(), case: "D4" },
      { photo: brioche(), case: "D4" },
    ]),
    { retoucher },
  );
}

// Un geste tel que le moteur le tient au groupe 3 (contrat, § 4), gelé.
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
    cible: "adv2",
    arrivee: null,
    depart: null,
    x: 0,
    jauge: null,
    caracteristiques: null,
    difficulte: null,
    armePretee: null,
    defense: null,
    reglages: { modificateur: null, avantages: null },
    jet: null,
    degats: null,
    localisation: [],
    interventions: [],
    resultat: null,
    parent: null,
    genre: "geste",
    garde: null,
    gardee: null,
    cibles: null,
    rang: 0,
    faites: [],
    effets: [],
    passifs: [],
    critique: null,
    contre: null,
    blessures: [],
    attaqueEnPlus: null,
    ...champs,
  });
}

// L'indice d'une capacité, retrouvée par son nom.
function indiceDe(etat, id, nom) {
  const indice = photoDe(etat, id).capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(indice, -1, `« ${nom} » n'est pas une capacité de ${id}`);
  return indice;
}

// Un jet d'attaque d'un PJ, fini à tant de réussites : un d10 contre 5.
function jetA(nombre, { genre = "attaque" } = {}) {
  let jet = ouvrir({ genre });
  for (let rang = 0; rang < nombre; rang += 1) jet = lancerDe(jet, [10]).jet;
  if (nombre < 3) jet = lancerDe(jet, [1]).jet;
  assert.ok(jetFini(jet));
  return jet;
}

// Un coup critique réussi : trois 10, « Tenter le critique », un 10.
const jetCritique = () => jouer(ouvrir({ avantages: 1 }), [10], [10], [10], "tenter", [10]);

const d20 = (...bruts) => bruts.map((brut) => (typeof brut === "number" ? { brut, decalage: null } : brut));
const normaux = (base, ...operations) => ({ base, operations, nature: "normaux" });

// Un effet de la palette tel que le geste le garde (contrat, § 4 et § 5).
const effet = (genre, champs = {}) => ({ type: "effet", genre, source: { genre: "mj" }, prix: null, rang: 0, ...champs });
const parCapacite = (etat, nom, qui = "pj1") => ({ genre: "capacite", qui, capacite: indiceDe(etat, qui, nom) });

// Un effet durable (contrat, § 3).
const durable = (champs) => ({ id: 1, genre: "modif", porteur: "adv2", auteur: "pj1", camp: "pj", duree: "tour", source: { genre: "mj" }, ...champs });

// ─── Le coup critique : quand il s'offre ────────────────────────────────────

test("critique : il s'offre à l'attaque d'un PJ et au jet de caractéristique, trois réussites et un avantage qui reste", () => {
  const attaque = troisAvecUnAvantage();
  assert.ok(jetFini(attaque));
  assert.equal(reussitesDesPlaces(attaque), 3);
  assert.equal(relancesRestantes(attaque), 1);
  assert.equal(attaque.critique, null);
  assert.equal(critiqueOffert(attaque, "pj"), true);
  assert.equal(critiqueOffert(attaque), true, "le camp, par défaut, est celui d'un PJ");
  assert.equal(critiqueOffert(troisAvecUnAvantage({ genre: "caracteristique" }), "pj"), true, "un jet de caractéristique");
});

test("critique : jamais en défense, ni sans avantage restant, ni à deux réussites, ni pour un autre camp", () => {
  assert.equal(critiqueOffert(troisAvecUnAvantage({ genre: "defense" }), "pj"), false, "la défense, jamais (convention 6)");
  assert.equal(refuse(troisAvecUnAvantage({ genre: "defense" }), "tenter").length > 0, true);
  assert.equal(critiqueOffert(jouer(ouvrir(), [8], [8], [8]), "pj"), false, "sans avantage");
  const depense = jouer(ouvrir({ avantages: 1 }), [2], "relancer", [8], [8], [8]);
  assert.equal(reussitesDesPlaces(depense), 3);
  assert.equal(relancesRestantes(depense), 0);
  assert.equal(critiqueOffert(depense, "pj"), false, "l'avantage a servi à une relance : il n'en reste aucun");
  const deux = jouer(ouvrir({ avantages: 1 }), [8], [8], [2], "garder");
  assert.equal(critiqueOffert(deux, "pj"), false, "deux réussites");
  assert.equal(critiqueOffert(troisAvecUnAvantage(), "adv"), false);
  assert.equal(critiqueOffert(jouer(ouvrir({ avantages: 1 }), [8], [8]), "pj"), false, "un jet pas fini");
});

test("critique : « +1 réussite » ne l'ouvre pas, le critique se juge sur les places", () => {
  const garde = jouer(ouvrir({ avantages: 1 }), [8], [8], [2], "garder", "plusUn");
  assert.equal(reussites(garde), 3);
  assert.equal(reussitesDesPlaces(garde), 2);
  assert.equal(relancesRestantes(garde), 1);
  assert.equal(critiqueOffert(garde, "pj"), false);
});

// ─── Le coup critique : tenté, gardé ────────────────────────────────────────

test("critique tenté et réussi : un avantage dépensé, un 4e dé, quatre réussites, la lettre C", () => {
  const tente = jouer(ouvrir({ avantages: 2 }), [8], [8], [8], "tenter");
  assert.equal(tente.critique, "tente");
  assert.equal(tente.attente, "de");
  assert.equal(relancesRestantes(tente), 1, "deux avantages : la tentative en dépense un");
  assert.deepEqual(deAttendu(tente), { faces: 10, combien: 1, motif: "chaine", place: 4 });
  assert.equal(critiqueOffert(tente, "pj"), false, "tenté, il ne s'offre plus");
  const reussi = jouer(tente, [7]);
  assert.ok(jetFini(reussi), "la chaîne finit à la 4e place");
  assert.equal(critiqueReussi(reussi), true);
  assert.equal(reussites(reussi), 4);
  assert.equal(LETTRES[lettreDe("attaque", reussites(reussi))], "C");
  assert.equal(relancesRestantes(reussi), 1);
});

test("critique tenté et raté : la chaîne finit à trois réussites ; relancé s'il reste un avantage", () => {
  const rate = jouer(troisAvecUnAvantage(), "tenter", [2]);
  assert.ok(jetFini(rate), "plus d'avantage : le 4e dé raté finit le jet");
  assert.equal(critiqueReussi(rate), false);
  assert.equal(reussites(rate), 3);
  assert.equal(reussitesDesPlaces(rate), 3);

  const relance = jouer(ouvrir({ avantages: 2 }), [8], [8], [8], "tenter", [2]);
  assert.equal(relance.attente, "choix_relance", "l'avantage restant relance le 4e dé");
  const reussi = jouer(relance, "relancer", [9]);
  assert.equal(critiqueReussi(reussi), true);
  assert.equal(relancesRestantes(reussi), 0);
  assert.equal(reussi.places[3].essais.length, 2);
});

test("critique tenté : relancer le 3e dé par la palette avant le 4e ne finit pas la chaîne", () => {
  const tente = jouer(troisAvecUnAvantage(), "tenter");
  assert.equal(relancable(tente), true, "le dernier dé posé est le 3e");
  const relance = jouer(tente, "palette", [9]);
  assert.equal(relance.attente, "de", "le 4e dé reste attendu");
  assert.equal(deAttendu(relance).place, 4);
  assert.equal(critiqueReussi(jouer(relance, [8])), true);
});

test("critique tenté : le 4e dé peut exploser comme les autres", () => {
  const trois = jouer(ouvrir({ faces: 6, difficulte: 7, avantages: 1 }), [6], "exploser", [2], [6], "exploser", [3], [6], "exploser", [1]);
  assert.equal(reussitesDesPlaces(trois), 3);
  assert.equal(critiqueOffert(trois, "pj"), true);
  const montre = jouer(trois, "tenter", [6]);
  assert.equal(montre.attente, "choix_explosion");
  const explose = jouer(montre, "exploser", [4]);
  assert.equal(lu(explose).somme, 10);
  assert.equal(critiqueReussi(explose), true);
});

test("critique gardé : trois réussites, l'avantage reste, et il ne s'offre plus ; garder ou tenter hors de propos est refusé", () => {
  const garde = jouer(troisAvecUnAvantage(), "garderLeCritique");
  assert.equal(garde.critique, "garde");
  assert.equal(reussites(garde), 3);
  assert.equal(relancesRestantes(garde), 1);
  assert.equal(critiqueOffert(garde, "pj"), false);
  refuse(garde, "tenter");
  refuse(garde, "garderLeCritique");
  refuse(jouer(ouvrir({ avantages: 1 }), [8], [8]), "tenter");
  assert.equal(troisAvecUnAvantage().critique, null);
});

// ─── Le coup critique : les dégâts ──────────────────────────────────────────

test("critique : il double la lettre (C = 15 → 30) avant toute opération, et le surplus de dégrossir", () => {
  const etat = trio({ pj: (valeurs) => { ajouterPassif(valeurs, { role: "degrossir", niveau: 1, nom: "Réduction" }); } });
  const critique = gesteEssai({ jet: jetCritique(), degats: normaux("lettre"), localisation: d20(7) });
  const fixes = degatsFixes(etat, critique);
  assert.equal(fixes.critique, true);
  assert.equal(LETTRES[fixes.lettre], "C");
  assert.equal(fixes.deBase, 15);
  assert.equal(fixes.valeur, 30, "C = 15, doublés : 30");
  assert.deepEqual(fixes.etapes, [{ genre: "critique", valeur: 2, resultat: 30, source: null }]);
  assert.equal(fixes.surplus, 6, "Réduction [1] : 3 réussites, doublées");
  assert.equal(fixes.contreLArmure, 6);
  assert.deepEqual(coupsDuGeste(etat, critique), [{ zone: 0, degats: 30, surplus: 6, nature: "normaux" }]);

  const sans = degatsFixes(etat, gesteEssai({ jet: jetA(3), degats: normaux("lettre"), localisation: d20(7) }));
  assert.equal(sans.critique, false);
  assert.equal(sans.valeur, 15);
  assert.equal(sans.surplus, 3);
  assert.deepEqual(sans.etapes, []);
});

test("critique : un jet prêté sans dégâts ne double rien, un jet de caractéristique n'a pas de lettre", () => {
  const etat = trio();
  const prete = degatsFixes(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", armePretee: 0, jet: jetCritique(), degats: normaux("aucun"), localisation: d20(7) }));
  assert.equal(prete.critique, true, "le coup critique se dit, touché");
  assert.equal(prete.valeur, 0);
  assert.deepEqual(prete.etapes, []);
  const arme = degatsFixes(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Flambage"), mode: "jet_prete", armePretee: 0, jet: jetCritique(), degats: normaux("arme"), localisation: d20(7) }));
  assert.equal(arme.valeur, 30, "« Dégâts de l'arme » : C = 15, doublés");
  const gouter = gesteEssai({ capacite: indiceDe(etat, "pj1", "Goûter"), mode: "caracteristique", jet: jouer(ouvrir({ genre: "caracteristique", avantages: 1 }), [10], [10], [10], "tenter", [10]) });
  assert.equal(critiqueReussi(gouter.jet), true);
  assert.equal(lettreDuGeste(etat, gouter), null);
});

// ─── L'inversion ────────────────────────────────────────────────────────────

test("inverser : la valeur gardée devient faces + 1 − valeur, puis le modificateur s'ajoute, et le dé se rejuge", () => {
  const rate = jouer(ouvrir({ faces: 8, difficulte: 7, modificateur: 1 }), [2]);
  assert.ok(jetFini(rate), "3 contre 7, sans avantage");
  assert.equal(inversable(rate), true);
  const inverse = jouer(rate, "inverser");
  assert.equal(dernier(inverse).inverse, true);
  assert.equal(tirageGarde(inverse, dernier(inverse)), 2, "le tirage d'avant l'inversion");
  assert.deepEqual(lu(inverse), { garde: 7, premier: 8, somme: 8, reussi: true, explosible: false }, "9 − 2 = 7, puis +1 : 8 contre 7");
  assert.equal(inverse.attente, "de", "un échec devenu réussite poursuit la chaîne");
  assert.equal(reussites(inverse), 1);
});

test("inverser : une réussite devenue échec finit la chaîne, même avec des avantages ; elle peut finir à trois réussites", () => {
  const enCours = jouer(ouvrir({ avantages: 2 }), [9]);
  assert.equal(enCours.attente, "de");
  const inverse = jouer(enCours, "inverser");
  assert.equal(lu(inverse).garde, 2);
  assert.equal(inverse.attente, "fini", "un dé inversé ne se relance plus : pas de choix de relance");
  assert.equal(relancesRestantes(inverse), 2);
  assert.equal(reussites(inverse), 0);

  const atrois = jouer(ouvrir(), [8], [8], [3], "inverser");
  assert.ok(jetFini(atrois));
  assert.equal(reussites(atrois), 3, "le 3e dé inversé (8) finit la chaîne à trois");
});

test("inverser : un dé inversé ne se relance plus et ne s'inverse plus", () => {
  const inverse = jouer(ouvrir({ avantages: 1 }), [9], "inverser");
  assert.equal(inversable(inverse), false);
  assert.equal(relancable(inverse), false);
  assert.equal(dernierDeOffert(inverse), false);
  refuse(inverse, "inverser");
  refuse(inverse, "palette");
});

test("inverser : montrant alors sa face maximale, il peut exploser", () => {
  const rate = jouer(ouvrir({ faces: 6, difficulte: 9 }), [1]);
  const inverse = jouer(rate, "inverser");
  assert.equal(lu(inverse).garde, 6);
  assert.equal(inverse.attente, "choix_explosion");
  const explose = jouer(inverse, "exploser", [4]);
  assert.equal(lu(explose).somme, 10);
  assert.equal(explose.attente, "de");
  assert.equal(dernier(explose).inverse, true, "l'explosion garde l'inversion");
});

test("inverser : pas un essai qui a déjà explosé ; la relance de la palette, elle, le peut", () => {
  const explose = jouer(ouvrir({ faces: 6, difficulte: 9 }), [6], "exploser", [1]);
  assert.ok(jetFini(explose));
  assert.equal(inversable(explose), false);
  refuse(explose, "inverser");
  assert.equal(relancable(explose), true);
  assert.equal(dernierDeOffert(explose), true);
});

test("inverser : sous désavantage, c'est le dé gardé, le pire, qui s'inverse", () => {
  const rate = jouer(ouvrir({ desavantages: 1 }), [9, 2]);
  assert.equal(lu(rate).garde, 2);
  assert.ok(jetFini(rate));
  const inverse = jouer(rate, "inverser");
  assert.equal(tirageGarde(inverse, dernier(inverse)), 2);
  assert.equal(lu(inverse).garde, 9, "11 − 2");
  assert.equal(lu(inverse).reussi, true);
});

test("le dernier dé : posé seulement ; ni avant le premier dé, ni quand une relance ou une explosion attend son dé", () => {
  assert.equal(dernierDeOffert(ouvrir()), false, "aucun dé lancé");
  const choix = jouer(ouvrir({ avantages: 1 }), [2]);
  assert.equal(choix.attente, "choix_relance");
  assert.equal(inversable(choix), true);
  const relance = jouer(choix, "relancer");
  assert.equal(relance.attente, "de_relance");
  assert.equal(inversable(relance), false);
  assert.equal(relancable(relance), false);
  const montre = jouer(ouvrir({ faces: 6, difficulte: 9 }), [6]);
  assert.equal(montre.attente, "choix_explosion");
  assert.equal(inversable(montre), true, "devant l'explosion, le dé est posé");
  const explosion = jouer(montre, "exploser");
  assert.equal(dernierDeOffert(explosion), false);
  refuse(explosion, "inverser");
  refuse(explosion, "palette");
});

// ─── La relance de la palette ───────────────────────────────────────────────

test("relancer par la palette : un essai de plus à la même place, marqué, sans dépenser d'avantage", () => {
  const rate = jouer(ouvrir(), [3]);
  assert.ok(jetFini(rate));
  const attend = jouer(rate, "palette");
  assert.equal(attend.attente, "de_relance");
  assert.equal(attend.relanceParPalette, true);
  assert.deepEqual(deAttendu(attend), { faces: 10, combien: 1, motif: "relance", place: 1 });
  const relance = jouer(attend, [8]);
  assert.equal(relance.places.length, 1);
  assert.equal(relance.places[0].essais.length, 2);
  assert.equal(relance.places[0].essais[1].par, "palette");
  assert.equal(relance.relanceParPalette, false);
  assert.equal(relance.attente, "de", "la relance réussie poursuit la chaîne");
});

test("relancer par la palette : hors du compte des avantages ; l'avantage reste pour une relance ordinaire", () => {
  const choix = jouer(ouvrir({ avantages: 1 }), [3]);
  assert.equal(relancesRestantes(choix), 1);
  const attend = jouer(choix, "palette");
  assert.equal(relancesRestantes(attend), 1, "la relance de la palette ne compte pas, même choisie");
  const rate = jouer(attend, [4]);
  assert.equal(rate.attente, "choix_relance", "l'avantage reste");
  assert.equal(relancesRestantes(rate), 1);
  const reussi = jouer(rate, "relancer", [9]);
  assert.equal(relancesRestantes(reussi), 0);
  assert.equal(reussi.places[0].essais.length, 3);
  assert.equal(reussi.places[0].essais[2].par, undefined, "la relance d'un avantage ne porte pas la marque");
});

test("relancer par la palette : un dé réussi aussi, qui peut échouer", () => {
  const reussi = jouer(ouvrir(), [9]);
  const relance = jouer(reussi, "palette", [2]);
  assert.ok(jetFini(relance));
  assert.equal(reussites(relance), 0);
});

// ─── +1 réussite ────────────────────────────────────────────────────────────

test("+1 réussite : sur un jet fini, jamais au-delà de trois", () => {
  const une = jouer(ouvrir(), [8], [2]);
  const deux = jouer(une, "plusUn");
  assert.equal(deux.bonus, 1);
  assert.equal(reussites(deux), 2);
  assert.equal(reussitesDesPlaces(deux), 1);
  const trois = jouer(deux, "plusUn");
  assert.equal(reussites(trois), 3);
  refuse(trois, "plusUn");
  refuse(jouer(ouvrir(), [8], [8], [8]), "plusUn");
  refuse(jouer(ouvrir(), [8]), "plusUn");
  assert.equal(reussites({ ...jouer(ouvrir(), [8], [8], [8]), bonus: 2 }), 3, "trois au plus, même forcé");
});

test("+1 réussite : la lettre suit ; le jet d'un adversaire aussi (une défense de plus, moins de dégâts)", () => {
  const etat = trio();
  const b = gesteEssai({ jet: jouer(jetA(2), "plusUn"), degats: normaux("lettre"), localisation: d20(7) });
  assert.equal(LETTRES[lettreDuGeste(etat, b)], "C");
  assert.equal(degatsFixes(etat, b).valeur, 15);
  const defense = gesteEssai({ acteur: "adv2", cible: "pj1", jet: jouer(jetA(1, { genre: "defense" }), "plusUn"), degats: normaux("lettre"), localisation: d20(7) });
  assert.equal(LETTRES[lettreDuGeste(etat, defense)], "A");
});

// ─── L'ordre des dégâts ─────────────────────────────────────────────────────

test("l'ordre des dégâts : la lettre, le critique, l'ajustement, ×k, +N, −N (jamais sous 0), les dégâts directs", () => {
  const etat = trio();
  const flambage = parCapacite(etat, "Flambage");
  const geste = gesteEssai({
    jet: jetCritique(),
    degats: { base: "lettre", operations: [{ op: "ajuster", valeur: 12, raison: "Émincer" }], nature: "normaux" },
    localisation: d20(7),
    effets: [
      effet("multiplier", { k: 2, source: flambage }),
      effet("ajouter", { n: 3 }),
      effet("retrancher", { n: 30 }),
      effet("ajouter", { n: 5 }),
      effet("directs", { n: 4, nature: "resistance" }),
    ],
  });
  const fixes = degatsFixes(etat, geste);
  assert.deepEqual(
    fixes.etapes.map(({ genre, valeur, resultat }) => [genre, valeur, resultat]),
    [
      ["critique", 2, 30],
      ["ajuster", 12, 12],
      ["multiplier", 2, 24],
      ["ajouter", 3, 27],
      ["retrancher", 30, 0],
      ["ajouter", 5, 5],
      ["directs", 4, 4],
    ],
  );
  assert.equal(fixes.etapes[1].raison, "Émincer");
  assert.ok(fixes.etapes[2].source === geste.effets[0].source, "la source de l'effet");
  assert.equal(fixes.etapes[6].nature, "resistance");
  assert.equal(fixes.valeur, 4);
  assert.equal(fixes.nature, "resistance", "des dégâts directs à l'endurance");
  assert.deepEqual(coupsDuGeste(etat, geste), [{ zone: 0, degats: 4, surplus: 0, nature: "resistance" }]);
});

test("l'ordre des dégâts : les opérations de la palette dans l'ordre où elles s'appliquent", () => {
  const etat = trio();
  const avec = (...effets) => degatsFixes(etat, gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets })).valeur;
  assert.equal(avec(effet("ajouter", { n: 2 }), effet("multiplier", { k: 3 })), 36, "(10 + 2) × 3");
  assert.equal(avec(effet("multiplier", { k: 3 }), effet("ajouter", { n: 2 })), 32, "10 × 3 + 2");
  assert.equal(avec(effet("retrancher", { n: 4 })), 6);
  assert.equal(avec(effet("retrancher", { n: 11 })), 0, "jamais sous 0");
  assert.equal(avec(effet("directs", { n: 7, nature: "corps" }), effet("multiplier", { k: 2 })), 14, "après les dégâts directs, la palette continue");
});

test("l'ordre des dégâts : +N contre l'armure s'ajoute à dégrossir, sans changer la valeur", () => {
  const etat = trio({ pj: (valeurs) => { ajouterPassif(valeurs, { role: "degrossir", niveau: 1, nom: "Réduction" }); } });
  const geste = gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("armure", { n: 3 }), effet("ajouter", { n: 1 })] });
  const fixes = degatsFixes(etat, geste);
  assert.equal(fixes.valeur, 11);
  assert.equal(fixes.surplus, 2, "Réduction : deux réussites");
  assert.deepEqual(fixes.armure, [{ n: 3, source: { genre: "mj" } }]);
  assert.equal(fixes.contreLArmure, 5);
  assert.deepEqual(fixes.etapes.map((etape) => etape.genre), ["ajouter"], "l'armure n'est pas une étape de la valeur");
  const [coup] = coupsDuGeste(etat, geste);
  assert.equal(coup.surplus, 5);
  const rendu = frapper(courantDe(etat, "adv2"), [coup]);
  assert.deepEqual(rendu.coups[0].armure, [10, 0], "11 + 5 contre une armure de 10");
  assert.deepEqual(rendu.coups[0].resistance, [5, 4], "l'endurance reçoit 11 − 10");
  const sansLettre = degatsFixes(trio(), gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("armure", { n: 3 })] }));
  assert.equal(sansLettre.surplus, 0);
  assert.equal(sansLettre.contreLArmure, 3);
});

test("+N contre l'armure sur des dégâts nuls ne retire rien ; dégrossir compte les réussites de « +1 réussite » (choix 19)", () => {
  const etat = trio({ pj: (valeurs) => { ajouterPassif(valeurs, { role: "degrossir", niveau: 1, nom: "Réduction" }); } });
  // B = 10, −30 : rien, et 3 de plus contre l'armure ne l'entament pas.
  const nul = gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("retrancher", { n: 30 }), effet("armure", { n: 3 })] });
  const fixes = degatsFixes(etat, nul);
  assert.deepEqual([fixes.valeur, fixes.surplus, fixes.contreLArmure], [0, 0, 3], "dégrossir ne vaut rien sur des dégâts nuls ; +3 reste");
  const rendu = frapper(courantDe(etat, "adv2"), coupsDuGeste(etat, nul));
  assert.deepEqual(rendu.courant.zones.map((zone) => zone.armure), [10, 10, 10, 10, 10, 10]);
  // Une réussite, puis « +1 réussite » : dégrossir en compte deux.
  const une = degatsFixes(etat, gesteEssai({ jet: jetA(1), degats: normaux("lettre"), localisation: d20(7) }));
  const deux = degatsFixes(etat, gesteEssai({ jet: jouer(jetA(1), "plusUn"), degats: normaux("lettre"), localisation: d20(7) }));
  assert.deepEqual([une.surplus, deux.surplus], [1, 2]);
});

test("l'ordre des dégâts : les dégâts directs de la palette éteignent dégrossir ; seuls comptent les effets de la cible en cours", () => {
  const etat = trio({ pj: (valeurs) => { ajouterPassif(valeurs, { role: "degrossir", niveau: 1, nom: "Réduction" }); } });
  const directs = degatsFixes(etat, gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("directs", { n: 6, nature: "resistance" })] }));
  assert.equal(directs.surplus, 0);
  const autreRang = degatsFixes(etat, gesteEssai({ jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("multiplier", { k: 2, rang: 1 })] }));
  assert.equal(autreRang.valeur, 10, "l'effet d'une autre cible ne compte pas");
  const deuxieme = degatsFixes(etat, gesteEssai({ rang: 1, jet: jetA(2), degats: normaux("lettre"), localisation: d20(7), effets: [effet("multiplier", { k: 2, rang: 1 })] }));
  assert.equal(deuxieme.valeur, 20);
});

// ─── Reporter ───────────────────────────────────────────────────────────────

test("reporter : la victime devient « sur » ; le dernier report de la cible en cours compte", () => {
  assert.equal(victimeDe(gesteEssai()), "adv2");
  assert.equal(victimeDe(gesteEssai({ effets: [effet("reporter", { sur: "pj3" })] })), "pj3");
  assert.equal(victimeDe(gesteEssai({ effets: [effet("reporter", { sur: "pj3" }), effet("reporter", { sur: "pj1" })] })), "pj1");
  assert.equal(victimeDe(gesteEssai({ effets: [effet("reporter", { sur: "pj3", rang: 1 })] })), "adv2", "le report d'une autre cible");
  const etat = trio();
  assert.equal(degatsFixes(etat, gesteEssai({ jet: jetA(1), degats: normaux("lettre"), effets: [effet("reporter", { sur: "pj3" })] })).victime, "pj3");
});

test("reporter : les d20 se lisent sur la grille de la victime ; la face de contre-attaque reste celle de la cible visée", () => {
  const etat = trio();
  const reporte = (...bruts) => gesteEssai({ jet: jetA(1), degats: normaux("lettre"), localisation: d20(...bruts), effets: [effet("reporter", { sur: "pj3" })] });
  const surLaCible = localisationsDuGeste(etat, gesteEssai({ localisation: d20(12) }));
  assert.equal(photoDe(etat, "adv2").zones[surLaCible[0].zone].code, "jambe_gauche");
  const [douze] = localisationsDuGeste(etat, reporte(12));
  assert.equal(douze.zone, 2);
  assert.equal(photoDe(etat, "pj3").zones[douze.zone].code, "jambe_gauche", "12 : la jambe gauche de Brioche, à son indice");
  const [vingt] = localisationsDuGeste(etat, reporte(20));
  assert.equal(vingt.contre, false, "20 n'est la contre-attaque que du PJ visé, pas de la victime");
  assert.equal(vingt.face, 20);
  assert.equal(photoDe(etat, "pj3").zones[vingt.zone].code, "bras_droit", "hors de sa grille : la zone la plus proche");
  assert.deepEqual(localisationsDuGeste(etat, reporte(1)), [{ contre: true }], "1, la face de contre-attaque du Marmiton visé");
  assert.deepEqual(coupsDuGeste(etat, reporte(1)), []);
  assert.deepEqual(coupsDuGeste(etat, reporte(12)), [{ zone: 2, degats: 5, surplus: 0, nature: "normaux" }]);
});

test("la zone choisie : elle remplace celle de la face, par son indice, si la grille l'a", () => {
  const etat = trio();
  const choisie = { brut: 7, decalage: null, choisie: { zone: 3, source: { genre: "mj" } } };
  assert.deepEqual(localisationsDuGeste(etat, gesteEssai({ localisation: [choisie] })), [{ contre: false, face: 7, zone: 3 }], "la face reste, la zone change");
  const grille = { faceContre: 1, zones: [{ debut: 2, fin: 10 }, { debut: 11, fin: 20 }] };
  assert.deepEqual(localiser(grille, 7, 0, { zone: 4, source: { genre: "mj" } }), { contre: false, face: 7, zone: 0 }, "une zone que la grille n'a pas : celle de la face");
  assert.deepEqual(localiser(grille, 7, 0, { zone: 1, source: { genre: "mj" } }), { contre: false, face: 7, zone: 1 });
  assert.deepEqual(localiser(grille, 1, 0, { zone: 1, source: { genre: "mj" } }), { contre: true }, "une face de contre-attaque ne se choisit pas");
  assert.equal(localiser(grille, 25).zone, 1, "hors de la grille, la plus proche");
  assert.equal(localiser({ faceContre: 1, zones: [{ debut: 2, fin: 4 }, { debut: 8, fin: 12 }] }, 6).zone, 0, "à égalité, la première");
  assert.equal(localiser({ faceContre: 1, zones: [{ debut: 2, fin: 4 }, { debut: 7, fin: 12 }] }, 6).zone, 1, "sinon, la plus proche");
});

// ─── La blessure neuve ──────────────────────────────────────────────────────

test("frapper : la blessure, endurance à 0 et corps perdu, une par zone, aucune si les coups tuent, aucune en nature corps", () => {
  const victime = (corps = 10) => geler({ ...courantDe(trio(), "pj1"), corps, zones: courantDe(trio(), "pj1").zones.map((zone) => ({ ...zone, armure: 0 })) });
  const deux = frapper(victime(), [
    { zone: 1, degats: 7, surplus: 0, nature: "normaux" },
    { zone: 1, degats: 3, surplus: 0, nature: "normaux" },
    { zone: 4, degats: 5, surplus: 0, nature: "normaux" },
  ]);
  assert.deepEqual(deux.coups.map((coup) => [coup.blessure, coup.corpsPerdu]), [[true, true], [false, true], [false, false]]);
  const tue = frapper(victime(4), [{ zone: 1, degats: 9, surplus: 0, nature: "normaux" }]);
  assert.equal(tue.mort, true);
  assert.equal(tue.coups[0].blessure, false);
  const vide = geler({ ...victime(), zones: victime().zones.map((zone) => ({ ...zone, resistance: 0 })) });
  const auCorps = frapper(vide, [{ zone: 1, degats: 3, surplus: 0, nature: "corps" }]);
  assert.deepEqual(auCorps.coups[0].resistance, [0, 0]);
  assert.equal(auCorps.coups[0].corpsPerdu, true);
  assert.equal(auCorps.coups[0].blessure, false, "une zone sans endurance, du corps perdu, mais au corps : aucune");
  assert.equal(frapper(vide, [{ zone: 1, degats: 3, surplus: 0, nature: "normaux" }]).coups[0].blessure, true, "les mêmes, en dégâts normaux : blessée");
  const aLEndurance = frapper(victime(), [{ zone: 1, degats: 9, surplus: 0, nature: "resistance" }]);
  assert.equal(aLEndurance.coups[0].blessure, true, "des dégâts directs à l'endurance blessent");
});

test("blessuresAChoisir : les zones blessées d'un PJ, dans l'ordre des dés, moins celles déjà choisies", () => {
  const sansArmure = (etat) => {
    for (const id of ["pj1", "pj3"]) etat.protagonistes[id].zones = etat.protagonistes[id].zones.map((zone) => ({ ...zone, armure: 0 }));
  };
  const etat = trio({ retoucher: sansArmure });
  const coups = [
    { zone: 4, degats: 6, surplus: 0, nature: "normaux" },
    { zone: 1, degats: 6, surplus: 0, nature: "normaux" },
    { zone: 4, degats: 6, surplus: 0, nature: "normaux" },
  ];
  const { coups: rendus, mort } = frapper(courantDe(etat, "pj1"), coups);
  const geste = gesteEssai({ acteur: "adv2", cible: "pj1", resultat: { coups: rendus, mort } });
  assert.deepEqual(blessuresAChoisir(etat, geste), [4, 1]);
  assert.deepEqual(blessuresAChoisir(etat, { ...geste, blessures: [{ zone: 4, capacite: null, libre: "Main brûlée" }] }), [1]);
  assert.deepEqual(blessuresAChoisir(etat, gesteEssai({ acteur: "adv2", cible: "pj1" })), [], "avant les coups, rien");

  const morte = trio({ retoucher: (courant) => { sansArmure(courant); courant.protagonistes.pj1.corps = 0; } });
  assert.deepEqual(blessuresAChoisir(morte, geste), [], "une victime morte n'en choisit pas");
  const adversaire = gesteEssai({ resultat: { coups: [{ zone: 0, blessure: true }], mort: false } });
  assert.deepEqual(blessuresAChoisir(etat, adversaire), [], "un adversaire : sans étape");
  const reportee = gesteEssai({ resultat: { coups: [{ zone: 2, blessure: true }], mort: false }, effets: [effet("reporter", { sur: "pj3" })] });
  assert.deepEqual(blessuresAChoisir(etat, reportee), [2], "la blessure suit la victime");
});

// ─── ±N ─────────────────────────────────────────────────────────────────────

test("±N d'un adversaire : sa défense écartée par ses effets durables, puis par ceux « pour ce jet » du geste", () => {
  const etat = trio({ retoucher: (courant) => { courant.effets = [durable({ id: 4, valeur: "defense", n: -2, source: { genre: "capacite", qui: "pj1", capacite: 2 } })]; } });
  const defense = defenseDe(etat, "adv2");
  assert.equal(defense.base, 5);
  assert.equal(defense.valeur, 3);
  assert.equal(defense.ecarts.length, 1);
  assert.equal(defense.ecarts[0].nom, "Flambage");
  assert.equal(defense.ecarts[0].n, -2);
  assert.ok(defense.ecarts[0].effet === etat.effets[0]);
  assert.equal(attaqueDe(etat, "adv2").valeur, 4, "l'attaque n'a pas bougé");

  const geste = gesteEssai({ jet: null, moment: "preparation", paye: false, effets: [effet("defense", { sur: "adv2", n: 1, duree: "jet" }), effet("defense", { sur: "pj3", n: 9, duree: "jet" })] });
  const pourCeJet = defenseDe(etat, "adv2", geste);
  assert.equal(pourCeJet.valeur, 4);
  assert.deepEqual(pourCeJet.ecarts.map((ecart) => [ecart.nom, ecart.n]), [["Flambage", -2], ["MJ", 1]], "les durables, puis ceux du geste");
  assert.equal(circonstances(etat, geste).difficulte, 4, "la difficulté du PJ qui attaque");
  assert.equal(defenseDe(etat, "adv2").valeur, 3, "hors du geste, l'effet « pour ce jet » ne vaut pas");
});

test("±N d'un adversaire : aucun plancher ; sa défense passe sous 0, et un 1 la réussit (choix 19)", () => {
  const etat = trio({ retoucher: (courant) => { courant.effets = [durable({ id: 4, valeur: "defense", n: -9 })]; } });
  const defense = defenseDe(etat, "adv2");
  assert.deepEqual([defense.base, defense.valeur], [5, -4]);
  const circ = circonstances(etat, gesteEssai({ jet: null, moment: "preparation", paye: false }));
  assert.equal(circ.difficulte, -4);
  assert.equal(reussitesDesPlaces(lancerDe(ouvrirJet(circ), [1]).jet), 1);
});

test("±N d'un adversaire : son attaque écartée fait la difficulté de la défense du PJ", () => {
  const etat = trio({ retoucher: (courant) => { courant.effets = [durable({ valeur: "attaque", n: 3 })]; } });
  assert.equal(attaqueDe(etat, "adv2").valeur, 7);
  const contrePj = gesteEssai({ acteur: "adv2", cible: "pj1", moment: "preparation", paye: false });
  assert.equal(circonstances(etat, contrePj).difficulte, 7);
  assert.equal(circonstances(etat, contrePj).genre, "defense");
});

test("±N d'un PJ : N à chaque dé de ses jets de ce genre, durables puis « pour ce jet », avant la main", () => {
  const etat = trio({
    retoucher: (courant) => {
      courant.effets = [durable({ id: 1, porteur: "pj1", camp: "adv", valeur: "attaque", n: 2 }), durable({ id: 2, porteur: "pj1", camp: "adv", valeur: "defense", n: -1 })];
    },
  });
  const main = { modificateur: { valeur: 1, raison: "Inspiration" }, avantages: null };
  const attaque = circonstances(
    etat,
    gesteEssai({
      moment: "preparation",
      paye: false,
      reglages: main,
      effets: [effet("attaque", { sur: "pj1", n: -3, duree: "jet", source: parCapacite(etat, "Émincer") }), effet("attaque", { sur: "pj3", n: 5, duree: "jet" })],
    }),
  );
  assert.deepEqual(attaque.modificateurs, [
    { genre: "effet", nom: "MJ", valeur: 2 },
    { genre: "effet", nom: "Émincer", valeur: -3 },
    { genre: "main", nom: "Inspiration", valeur: 1 },
  ]);
  const jet = jouer(ouvrirJet(attaque), [6]);
  assert.equal(modificateurDe(jet), 0);
  assert.equal(lu(jet).premier, 6, "2 − 3 + 1 sur le dé");

  const defense = circonstances(etat, gesteEssai({ acteur: "adv2", cible: "pj1", moment: "preparation", paye: false }));
  assert.deepEqual(defense.modificateurs, [{ genre: "effet", nom: "MJ", valeur: -1 }], "en défense, son −1 seul");
  const gouter = circonstances(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Goûter"), mode: "caracteristique", cible: null, caracteristiques: ["sens"], difficulte: 5, moment: "preparation", paye: false }));
  assert.deepEqual(gouter.modificateurs, [], "un jet de caractéristique n'a pas de ±N");
  assert.deepEqual(modificateursDe(etat, "adv2", { genre: "attaque", mobilisees: [] }), [], "un adversaire n'a pas de modificateur");
  assert.deepEqual(modificateursDe(etat, "pj1", { genre: "attaque", mobilisees: [] }), [{ genre: "effet", nom: "MJ", valeur: 2 }], "sans geste : les durables seuls");
});

// ─── Les avantages « pour ce jet » ──────────────────────────────────────────

test("avantages et désavantages « pour ce jet » : après ceux d'aujourd'hui, avant la main, au nom de leur source ; toutes les cibles du geste", () => {
  const etat = trio({ retoucher: (courant) => { courant.protagonistes.adv2.case = "E5"; } });
  const main = { modificateur: null, avantages: { valeur: 1, raison: "Inspiration" } };
  const geste = gesteEssai({
    capacite: indiceDe(etat, "pj1", "Émincer"),
    moment: "preparation",
    paye: false,
    reglages: main,
    effets: [effet("avantages", { nombre: 2, source: parCapacite(etat, "Flambage") }), effet("desavantages", { nombre: 1 })],
  });
  const rendu = circonstances(etat, geste);
  assert.deepEqual(rendu.avantages, [
    { genre: "effet", nom: "Flambage", nombre: 2, de: null },
    { genre: "main", nom: "Inspiration", nombre: 1, de: null },
  ]);
  assert.deepEqual(rendu.desavantages, [
    { genre: "maitrise", nom: "Émincer", nombre: 1, de: null },
    { genre: "effet", nom: "MJ", nombre: 1, de: null },
  ]);
  assert.equal(netDe(ouvrirJet(rendu)), 1);

  const deuxieme = gesteEssai({ rang: 1, cible: "adv2", moment: "jet", faites: [{ cible: "adv2", effets: [effet("avantages", { nombre: 2 })] }], effets: [] });
  assert.deepEqual(circonstances(etat, deuxieme).avantages, [{ genre: "effet", nom: "MJ", nombre: 2, de: null }], "un effet « pour ce jet » vaut pour la cible suivante");
  const gouter = circonstances(etat, gesteEssai({ capacite: indiceDe(etat, "pj1", "Goûter"), mode: "caracteristique", cible: null, caracteristiques: ["sens"], difficulte: 5, effets: [effet("desavantages", { nombre: 3 })] }));
  assert.deepEqual(gouter.desavantages, [{ genre: "effet", nom: "MJ", nombre: 3, de: null }], "au jet de caractéristique aussi");
});

test("effetsDuGeste : ceux des cibles finies, puis les siens ; une même entrée ne compte qu'une fois", () => {
  const un = effet("avantages", { nombre: 1 });
  const deux = effet("ajouter", { n: 2, rang: 1 });
  const geste = gesteEssai({ faites: [{ effets: [un] }], effets: [un, deux] });
  const lus = effetsDuGeste(geste);
  assert.equal(lus.length, 2);
  assert.ok(lus[0] === geste.faites[0].effets[0]);
  assert.ok(lus[1] === geste.effets[1]);
  assert.deepEqual(effetsDuGeste(null), []);
  assert.deepEqual(effetsDuGeste({}), []);
});

// ─── Vivant, retiré ─────────────────────────────────────────────────────────

test("vivant : un retiré par le MJ n'est plus compté, comme un mort ; il n'est l'allié de personne", () => {
  const etat = trio();
  assert.equal(vivant(etat, "pj3"), true);
  assert.deepEqual(alliesSurLaCase(etat, "pj1"), ["pj3"]);
  const retire = trio({ retoucher: (courant) => { courant.protagonistes.pj3.retire = true; } });
  assert.equal(vivant(retire, "pj3"), false);
  assert.deepEqual(vivantsDe(retire, "pj"), ["pj1"]);
  assert.deepEqual(alliesSurLaCase(retire, "pj1"), []);
  const mort = trio({ retoucher: (courant) => { courant.protagonistes.pj3.mort = { tour: 1 }; } });
  assert.deepEqual(alliesSurLaCase(mort, "pj1"), []);
  const present = trio({ retoucher: (courant) => { courant.protagonistes.pj3.retire = false; } });
  assert.equal(vivant(present, "pj3"), true, "retire: false, il joue");
});

// ─── Les effets portés, et le nom d'une source ──────────────────────────────

test("nomDeLaSource : une capacité, un état porté (sa capacité figée ou son texte), le MJ ; null sinon", () => {
  const etat = trio({
    retoucher: (courant) => {
      courant.effets = [
        { id: 7, genre: "etat", porteur: "adv2", auteur: null, camp: "pj", duree: "combat", source: { genre: "mj" }, capacite: { nom: "Étourdi" }, libre: null, blessure: false },
        { id: 9, genre: "etat", porteur: "pj1", auteur: null, camp: "pj", duree: "combat", source: { genre: "mj" }, capacite: null, libre: "Main brûlée", blessure: true },
        { id: 11, genre: "guet", porteur: "pj1", auteur: "pj1", camp: "pj", duree: "tour", source: { genre: "mj" }, garde: { capacite: 0, facon: 0 } },
      ];
    },
  });
  assert.equal(nomDeLaSource(etat, parCapacite(etat, "Flambage")), "Flambage");
  assert.equal(nomDeLaSource(etat, { genre: "capacite", qui: "adv2", capacite: 1 }), "Moulinet farineux");
  assert.equal(nomDeLaSource(etat, { genre: "etat", effet: 7 }), "Étourdi");
  assert.equal(nomDeLaSource(etat, { genre: "etat", effet: 9 }), "Main brûlée");
  assert.equal(nomDeLaSource(etat, { genre: "mj" }), "MJ");
  for (const source of [{ genre: "etat", effet: 99 }, { genre: "capacite", qui: "pj1", capacite: 99 }, { genre: "autre" }, null, "MJ"]) assert.equal(nomDeLaSource(etat, source), null, JSON.stringify(source));

  assert.deepEqual(effetsDurablesDe(etat, "pj1").map((un) => un.id), [9, 11]);
  assert.deepEqual(effetsDurablesDe(etat, "adv2").map((un) => un.id), [7]);
  assert.deepEqual(gardesDe(etat, "pj1").map((un) => un.id), [11]);
  assert.deepEqual(gardesDe(etat, "adv2"), []);
});

// ─── La lettre ──────────────────────────────────────────────────────────────

test("lettreDe : quatre réussites d'attaque donnent C ; lettreDuGeste : null pour un manqué ou sans jet", () => {
  assert.deepEqual([1, 2, 3, 4].map((nombre) => LETTRES[lettreDe("attaque", nombre)]), ["A", "B", "C", "C"]);
  assert.equal(lettreDe("attaque", 0), null);
  assert.equal(lettreDe("defense", 3), null);
  assert.equal(lettreDe("caracteristique", 3), null);
  const etat = trio();
  assert.equal(lettreDuGeste(etat, gesteEssai({ jet: jetA(0) })), null);
  assert.equal(lettreDuGeste(etat, gesteEssai({ jet: null })), null);
  assert.equal(LETTRES[lettreDuGeste(etat, gesteEssai({ jet: jetCritique() }))], "C");
});
