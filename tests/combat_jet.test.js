// Contrôles de la chaîne d'un jet (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : les réussites et leurs bornes, les modificateurs, le compte
// net des avantages et des désavantages, les relances, le dé explosif, et
// chaque transition de js/combat/jet.js.
//
// Chaque règle est vue des deux côtés, à une valeur près : le dé qui égale la
// difficulté et celui qui la manque d'un point, la face maximale qui reste
// sous la difficulté et celle qui l'atteint, la relance qui reste et celle
// qui ne reste plus.
//
// Les jets s'ouvrent sur des circonstances écrites à la main : ce module ne
// sait ni qui lance ni pourquoi.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choixDuJet,
  deAttendu,
  evaluerEssai,
  exploser,
  garder,
  jetFini,
  lancerDe,
  modificateurDe,
  netDe,
  ouvrirJet,
  relancer,
  relancesRestantes,
  reussites,
} from "../js/combat/jet.js";
import { REUSSITES_MAX } from "../js/combat/regles.js";

// Les circonstances d'un jet d'attaque d'Aubépine : un d10 contre 5, sans
// rien d'autre. « avantages » et « desavantages » se donnent en nombres (une
// seule source), ou en listes de sources.
function circonstances({ faces = 10, difficulte = 5, modificateurs = [], avantages = 0, desavantages = 0, ...reste } = {}) {
  const sources = (donne, modele) => (Array.isArray(donne) ? donne : donne > 0 ? [{ ...modele, nombre: donne, de: null }] : []);
  return {
    genre: "attaque",
    lanceur: "pj1",
    faces,
    caracteristiques: null,
    mobilisees: ["precision", "agilite"],
    difficulte,
    libelle: null,
    modificateurs: modificateurs.map((valeur, rang) => ({ genre: "passif", nom: `Bonus ${rang + 1}`, valeur })),
    avantages: sources(avantages, { genre: "passif", nom: "Solo du chef" }),
    desavantages: sources(desavantages, { genre: "maitrise", nom: "Émincer" }),
    ...reste,
  };
}

const ouvrir = (champs) => ouvrirJet(circonstances(champs));

const GESTES = { relancer, garder, exploser };

// Joue une suite de pas : un tableau est un dé (ses valeurs brutes), un mot
// est un choix. Lève au premier refus : ces pas-là sont censés passer.
function jouer(jet, ...pas) {
  let courant = jet;
  for (const [rang, un] of pas.entries()) {
    const rendu = Array.isArray(un) ? lancerDe(courant, un) : GESTES[un](courant);
    assert.equal(rendu.refus, undefined, `pas ${rang + 1} (${JSON.stringify(un)}) refusé : ${rendu.refus?.message}`);
    courant = rendu.jet;
  }
  return courant;
}

const sommes = (jet) => jet.places.map((place) => evaluerEssai(jet, place.essais.at(-1)).somme);

function estGeleEnProfondeur(valeur) {
  if (valeur === null || typeof valeur !== "object") return true;
  return Object.isFrozen(valeur) && Object.values(valeur).every(estGeleEnProfondeur);
}

// ─── L'ouverture ────────────────────────────────────────────────────────────

test("ouvrirJet : le jet reprend ses circonstances, attend un dé, et n'a aucune place", () => {
  const donnees = circonstances({ modificateurs: [1], avantages: 1, libelle: "compliqué", caracteristiques: ["sens", "parole"] });
  const jet = ouvrirJet(donnees);
  assert.deepEqual(jet, { ...donnees, attente: "de", places: [] });
  assert.deepEqual(Object.keys(jet), ["genre", "lanceur", "faces", "caracteristiques", "mobilisees", "difficulte", "libelle", "modificateurs", "avantages", "desavantages", "attente", "places"]);
});

test("ouvrirJet : le jet est gelé, sans geler ni partager ce qu'on lui a donné", () => {
  const donnees = circonstances({ modificateurs: [1], avantages: 1, caracteristiques: ["sens", "parole"] });
  const jet = ouvrirJet(donnees);
  assert.ok(estGeleEnProfondeur(jet));
  assert.ok(!Object.isFrozen(donnees));
  assert.ok(!Object.isFrozen(donnees.modificateurs));
  assert.ok(!Object.isFrozen(donnees.modificateurs[0]));
  assert.ok(!Object.isFrozen(donnees.caracteristiques));
  donnees.modificateurs[0].valeur = 9;
  donnees.mobilisees.push("force");
  assert.equal(modificateurDe(jet), 1, "les circonstances sont figées à l'ouverture");
  assert.deepEqual(jet.mobilisees, ["precision", "agilite"]);
});

test("ouvrirJet : des circonstances sans libellé ni caractéristiques choisies donnent null", () => {
  const { libelle, caracteristiques, ...sans } = circonstances();
  const jet = ouvrirJet(sans);
  assert.equal(jet.libelle, null);
  assert.equal(jet.caracteristiques, null);
});

// ─── La chaîne ──────────────────────────────────────────────────────────────

test("la chaîne : une réussite fait lancer le dé suivant, le premier échec l'arrête", () => {
  let jet = ouvrir();
  assert.deepEqual(deAttendu(jet), { faces: 10, combien: 1, motif: "chaine", place: 1 });
  jet = jouer(jet, [7]);
  assert.equal(jet.attente, "de");
  assert.deepEqual(deAttendu(jet), { faces: 10, combien: 1, motif: "chaine", place: 2 });
  jet = jouer(jet, [9]);
  assert.deepEqual(deAttendu(jet), { faces: 10, combien: 1, motif: "chaine", place: 3 });
  jet = jouer(jet, [3]);
  assert.equal(jet.attente, "fini");
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 2);
  assert.equal(deAttendu(jet), null);
  assert.deepEqual(jet.places, [
    { essais: [{ tirages: [7], explosions: [] }] },
    { essais: [{ tirages: [9], explosions: [] }] },
    { essais: [{ tirages: [3], explosions: [] }] },
  ]);
});

test("la chaîne : un dé qui égale la difficulté est réussi, un point dessous il échoue", () => {
  const egal = jouer(ouvrir({ difficulte: 5 }), [5]);
  assert.equal(reussites(egal), 1);
  assert.equal(egal.attente, "de");

  const dessous = jouer(ouvrir({ difficulte: 5 }), [4]);
  assert.equal(reussites(dessous), 0);
  assert.equal(dessous.attente, "fini");
});

test("la chaîne : un échec au premier dé, aucune réussite, et la chaîne est finie", () => {
  const jet = jouer(ouvrir(), [1]);
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 0);
  assert.equal(jet.places.length, 1);
});

test("la chaîne : trois réussites la finissent, et aucun quatrième dé ne se lance", () => {
  assert.equal(REUSSITES_MAX, 3);
  const deux = jouer(ouvrir(), [5], [10]);
  assert.ok(!jetFini(deux), "à deux réussites, la chaîne continue");
  assert.equal(deAttendu(deux).place, 3);

  const trois = jouer(deux, [5]);
  assert.ok(jetFini(trois));
  assert.equal(reussites(trois), 3);
  assert.equal(deAttendu(trois), null);
  assert.deepEqual(choixDuJet(trois), []);
  const quatrieme = lancerDe(trois, [10]);
  assert.equal(quatrieme.refus.code, "hors_moment");
  assert.equal(quatrieme.jet, undefined);
});

test("la chaîne : un échec à la deuxième place garde la première réussite", () => {
  const jet = jouer(ouvrir(), [8], [2]);
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 1);
});

// ─── Les modificateurs ──────────────────────────────────────────────────────

test("les modificateurs : leur somme s'ajoute à chaque dé de la chaîne", () => {
  const jet = jouer(ouvrir({ difficulte: 5, modificateurs: [1] }), [4], [4], [3]);
  assert.equal(modificateurDe(jet), 1);
  assert.deepEqual(sommes(jet), [5, 5, 4]);
  assert.equal(reussites(jet), 2, "4 + 1 réussit contre 5 à chaque place, 3 + 1 échoue");

  const sans = jouer(ouvrir({ difficulte: 5 }), [4]);
  assert.equal(modificateurDe(sans), 0);
  assert.equal(reussites(sans), 0, "sans le +1, le même 4 échoue");
});

test("les modificateurs : un malus fait échouer un dé qui aurait réussi", () => {
  const blesse = jouer(ouvrir({ difficulte: 5, modificateurs: [-1] }), [5]);
  assert.equal(reussites(blesse), 0, "5 − 1 échoue contre 5");
  assert.ok(jetFini(blesse));
  const juste = jouer(ouvrir({ difficulte: 5, modificateurs: [-1] }), [6]);
  assert.equal(reussites(juste), 1);
});

test("les modificateurs : plusieurs se somment, bonus et malus mêlés", () => {
  const jet = ouvrir({ modificateurs: [2, -1, 3] });
  assert.equal(modificateurDe(jet), 4);
  assert.deepEqual(evaluerEssai(jet, { tirages: [1], explosions: [] }), { garde: 1, premier: 5, somme: 5, reussi: true, explosible: false });
});

// ─── Le compte net ──────────────────────────────────────────────────────────

test("le compte net : avantages et désavantages s'annulent, seule la différence reste", () => {
  assert.equal(netDe(ouvrir()), 0);
  assert.equal(netDe(ouvrir({ avantages: 2 })), 2);
  assert.equal(netDe(ouvrir({ desavantages: 2 })), -2);
  assert.equal(netDe(ouvrir({ avantages: 2, desavantages: 1 })), 1);
  assert.equal(netDe(ouvrir({ avantages: 1, desavantages: 3 })), -2);

  const annules = ouvrir({ avantages: 1, desavantages: 1 });
  assert.equal(netDe(annules), 0);
  assert.equal(deAttendu(annules).combien, 1, "ni lancer de plus");
  assert.equal(relancesRestantes(annules), 0, "ni relance");
  assert.ok(jetFini(jouer(annules, [1])), "un échec finit le jet, sans rien proposer");
});

test("le compte net : plusieurs sources se somment de chaque côté", () => {
  const jet = ouvrirJet(
    circonstances({
      avantages: [
        { genre: "passif", nom: "Solo du chef", nombre: 2, de: null },
        { genre: "main", nom: "Minutie", nombre: 1, de: null },
      ],
      desavantages: [
        { genre: "maitrise", nom: "Émincer", nombre: 1, de: null },
        { genre: "armure_melee", nom: null, nombre: 1, de: null },
      ],
    }),
  );
  assert.equal(netDe(jet), 1);
  assert.equal(relancesRestantes(jet), 1);
  assert.equal(deAttendu(jet).combien, 1);
});

test("le compte net : un avantage qui reste donne des relances, jamais de lancer de plus ; un désavantage, l'inverse", () => {
  const avantage = ouvrir({ avantages: 2, desavantages: 1 });
  assert.equal(deAttendu(avantage).combien, 1);
  assert.equal(relancesRestantes(avantage), 1);

  const desavantage = ouvrir({ avantages: 1, desavantages: 3 });
  assert.equal(deAttendu(desavantage).combien, 3);
  assert.equal(relancesRestantes(desavantage), 0);
});

// ─── Le désavantage ─────────────────────────────────────────────────────────

test("le désavantage : avec k désavantages, chaque dé se lance k + 1 fois", () => {
  for (const k of [1, 2, 5]) {
    const jet = ouvrir({ desavantages: k });
    assert.equal(deAttendu(jet).combien, k + 1);
    const valeurs = Array.from({ length: k + 1 }, () => 9);
    assert.equal(lancerDe(jet, valeurs).jet.places[0].essais[0].tirages.length, k + 1);
    assert.equal(lancerDe(jet, valeurs.slice(1)).refus.code, "hors_bornes", "une valeur de moins");
    assert.equal(lancerDe(jet, [...valeurs, 9]).refus.code, "hors_bornes", "une valeur de plus");
  }
  assert.equal(lancerDe(ouvrir(), [9, 9]).refus.code, "hors_bornes", "sans désavantage, un dé n'a qu'une valeur");
});

test("le désavantage : on garde le pire des tirages, où qu'il tombe", () => {
  const jet = ouvrir({ difficulte: 5, desavantages: 1 });
  assert.equal(evaluerEssai(jet, { tirages: [8, 4], explosions: [] }).garde, 4);
  assert.equal(evaluerEssai(jet, { tirages: [4, 8], explosions: [] }).garde, 4);
  assert.equal(reussites(jouer(jet, [8, 4])), 0, "8 et 4 : le 4 est gardé, il échoue");
  assert.equal(reussites(jouer(jet, [8, 5])), 1, "8 et 5 : le 5 est gardé, il réussit");

  const deux = ouvrir({ difficulte: 5, desavantages: 2 });
  assert.equal(evaluerEssai(deux, { tirages: [9, 7, 3], explosions: [] }).garde, 3);
});

test("le désavantage : sans désavantage net, le premier tirage est le dé", () => {
  const jet = ouvrir({ avantages: 1 });
  assert.equal(evaluerEssai(jet, { tirages: [8], explosions: [] }).garde, 8);
  assert.equal(evaluerEssai(ouvrir(), { tirages: [8], explosions: [] }).garde, 8);
});

test("le désavantage : il pèse sur chaque dé de la chaîne, pas sur le premier seulement", () => {
  let jet = ouvrir({ difficulte: 5, modificateurs: [1], desavantages: 1 });
  jet = jouer(jet, [6, 9]);
  assert.equal(deAttendu(jet).combien, 2, "le deuxième dé aussi");
  jet = jouer(jet, [8, 4]);
  assert.equal(deAttendu(jet).combien, 2, "le troisième aussi");
  jet = jouer(jet, [3, 10]);
  assert.deepEqual(sommes(jet), [7, 5, 4], "6 + 1, 4 + 1, 3 + 1");
  assert.equal(reussites(jet), 2);
  assert.ok(jetFini(jet));
});

test("le désavantage : un échec ne propose aucune relance", () => {
  const jet = jouer(ouvrir({ desavantages: 1 }), [2, 9]);
  assert.ok(jetFini(jet));
  assert.deepEqual(choixDuJet(jet), []);
});

// ─── L'avantage ─────────────────────────────────────────────────────────────

test("l'avantage : un dé qui échoue se relance ou se garde, au choix", () => {
  const jet = jouer(ouvrir({ avantages: 1 }), [3]);
  assert.equal(jet.attente, "choix_relance");
  assert.deepEqual(choixDuJet(jet), ["relancer", "garder"]);
  assert.equal(deAttendu(jet), null, "aucun dé n'est attendu tant que le choix n'est pas fait");
  assert.ok(!jetFini(jet));
});

test("l'avantage : sans avantage, un dé qui échoue finit le jet, et rien ne se relance", () => {
  const jet = jouer(ouvrir(), [3]);
  assert.ok(jetFini(jet));
  assert.deepEqual(choixDuJet(jet), []);
  assert.equal(relancer(jet).refus.code, "hors_moment");
});

test("l'avantage : un dé réussi ne propose pas de relance", () => {
  const jet = jouer(ouvrir({ avantages: 1 }), [9]);
  assert.equal(jet.attente, "de");
  assert.deepEqual(choixDuJet(jet), []);
  assert.equal(relancer(jet).refus.code, "hors_moment");
  assert.equal(relancesRestantes(jet), 1, "la relance reste pour un dé suivant");
});

test("l'avantage : la relance remplace le dé, à la même place, et se lance une seule fois", () => {
  let jet = jouer(ouvrir({ avantages: 1 }), [9], [3], "relancer");
  assert.equal(jet.attente, "de_relance");
  assert.deepEqual(deAttendu(jet), { faces: 10, combien: 1, motif: "relance", place: 2 });
  assert.equal(lancerDe(jet, [7, 7]).refus.code, "hors_bornes");
  jet = jouer(jet, [7]);
  assert.equal(jet.places.length, 2, "pas de place de plus");
  assert.deepEqual(jet.places[1], { essais: [{ tirages: [3], explosions: [] }, { tirages: [7], explosions: [] }] });
  assert.equal(reussites(jet), 2, "la place vaut par son dernier essai");
  assert.equal(jet.attente, "de", "la relance réussie, la chaîne continue");
  assert.equal(deAttendu(jet).place, 3);
});

test("l'avantage : une relance qui échoue finit le jet quand il n'en reste plus", () => {
  const jet = jouer(ouvrir({ avantages: 1 }), [3], "relancer", [2]);
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 0);
  assert.deepEqual(choixDuJet(jet), []);
});

test("l'avantage : garder arrête la chaîne, même s'il reste des relances", () => {
  const jet = jouer(ouvrir({ avantages: 3 }), [9], [3], "garder");
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 1);
  assert.equal(relancesRestantes(jet), 3, "garder ne dépense rien");
  assert.equal(jet.places[1].essais.length, 1);
  assert.equal(deAttendu(jet), null);
});

test("l'avantage : k avantages donnent k relances pour tout le jet, pas une de plus", () => {
  // Un avantage : la relance dépensée à la première place manque à la deuxième.
  const un = jouer(ouvrir({ avantages: 1 }), [3], "relancer", [8], [2]);
  assert.ok(jetFini(un), "le deuxième dé échoue : plus de relance");
  assert.equal(reussites(un), 1);

  // Deux avantages : deux relances, sur la même place ou sur deux.
  let deux = jouer(ouvrir({ avantages: 2 }), [3], "relancer", [2]);
  assert.equal(deux.attente, "choix_relance", "il en reste une : le même dé se relance encore");
  deux = jouer(deux, "relancer", [1]);
  assert.ok(jetFini(deux), "la troisième fois, il n'y en a plus");
  assert.equal(deux.places[0].essais.length, 3);

  const reparties = jouer(ouvrir({ avantages: 2 }), [3], "relancer", [8], [2], "relancer", [9], [1]);
  assert.ok(jetFini(reparties));
  assert.equal(reussites(reparties), 2);
});

test("l'avantage : les relances restantes se comptent au fil du jet, et la relance choisie est déjà dépensée", () => {
  let jet = ouvrir({ avantages: 2 });
  assert.equal(relancesRestantes(jet), 2);
  jet = jouer(jet, [3]);
  assert.equal(relancesRestantes(jet), 2, "le choix n'est pas fait");
  jet = jouer(jet, "relancer");
  assert.equal(relancesRestantes(jet), 1, "choisie, donc dépensée, avant même son dé");
  jet = jouer(jet, [9]);
  assert.equal(relancesRestantes(jet), 1);
  jet = jouer(jet, [2], "relancer", [2]);
  assert.equal(relancesRestantes(jet), 0);
  assert.ok(jetFini(jet));
});

test("l'avantage : le net compte, non le nombre d'avantages écrits", () => {
  const jet = jouer(ouvrir({ avantages: 2, desavantages: 1 }), [3], "relancer", [2]);
  assert.ok(jetFini(jet), "deux avantages et un désavantage : une seule relance");
});

test("l'avantage : les deux jets à relance de l'annexe A de la mission", () => {
  // Une défense, d10+1 contre 4 : 5, 7, 2, puis la relance du troisième dé : 1.
  const defense = jouer(ouvrir({ difficulte: 4, modificateurs: [1], avantages: 1 }), [5], [7], [2], "relancer", [1]);
  assert.deepEqual(sommes(defense), [6, 8, 2]);
  assert.equal(reussites(defense), 2);
  assert.ok(jetFini(defense));

  // Une attaque, d10+1 contre 5 : 8, 3, la relance du deuxième dé : 6, puis 4.
  const attaque = jouer(ouvrir({ difficulte: 5, modificateurs: [1], avantages: 1 }), [8], [3], "relancer", [6], [4]);
  assert.deepEqual(sommes(attaque), [9, 7, 5]);
  assert.equal(reussites(attaque), 3);
  assert.ok(jetFini(attaque));
});

// ─── Le dé explosif ─────────────────────────────────────────────────────────

test("le dé explosif : la face maximale qui reste sous la difficulté peut exploser", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 7 }), [6]);
  assert.equal(jet.attente, "choix_explosion");
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 6, somme: 6, reussi: false, explosible: true });
});

test("le dé explosif : la face maximale qui atteint la difficulté réussit, sans exploser", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 6 }), [6]);
  assert.equal(jet.attente, "de");
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 6, somme: 6, reussi: true, explosible: false });
  assert.equal(exploser(jet).refus.code, "hors_moment");
});

test("le dé explosif : un dé qui ne montre pas sa face maximale n'explose pas", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 9 }), [5]);
  assert.ok(jetFini(jet));
  assert.equal(evaluerEssai(jet, jet.places[0].essais[0]).explosible, false);
  assert.equal(exploser(jet).refus.code, "hors_moment");
});

test("le dé explosif : la face maximale s'entend modificateurs compris", () => {
  // d6+1 : 6 + 1 atteint 7, le dé réussit et n'explose pas ; contre 8, il explose.
  const atteint = jouer(ouvrir({ faces: 6, difficulte: 7, modificateurs: [1] }), [6]);
  assert.equal(atteint.attente, "de");
  assert.equal(reussites(atteint), 1);

  const dessous = jouer(ouvrir({ faces: 6, difficulte: 8, modificateurs: [1] }), [6]);
  assert.equal(dessous.attente, "choix_explosion");

  // d6−1 contre 6 : sans le malus le 6 réussirait ; avec lui, il explose.
  const blesse = jouer(ouvrir({ faces: 6, difficulte: 6, modificateurs: [-1] }), [6]);
  assert.equal(blesse.attente, "choix_explosion");
  assert.equal(evaluerEssai(blesse, blesse.places[0].essais[0]).premier, 5);
});

test("le dé explosif : « exploser » est la seule suite offerte, même avec un avantage", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [6]);
  assert.deepEqual(choixDuJet(jet), ["exploser"]);
  assert.equal(deAttendu(jet), null);
  assert.equal(relancer(jet).refus.code, "hors_moment");
  assert.equal(garder(jet).refus.code, "hors_moment");
  assert.equal(lancerDe(jet, [3]).refus.code, "hors_moment");
  assert.ok(!jetFini(jet));
});

test("le dé explosif : l'explosion relance le même dé, une seule fois, et ajoute sa valeur brute", () => {
  let jet = jouer(ouvrir({ faces: 6, difficulte: 9 }), [6], "exploser");
  assert.equal(jet.attente, "de_explosion");
  assert.deepEqual(deAttendu(jet), { faces: 6, combien: 1, motif: "explosion", place: 1 });
  assert.equal(lancerDe(jet, [3, 3]).refus.code, "hors_bornes");
  jet = jouer(jet, [3]);
  assert.deepEqual(jet.places, [{ essais: [{ tirages: [6], explosions: [3] }] }], "à la même place, dans le même essai");
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 6, somme: 9, reussi: true, explosible: false });
  assert.equal(jet.attente, "de", "9 atteint 9 : la chaîne continue");
  assert.equal(deAttendu(jet).place, 2);
});

test("le dé explosif : le modificateur ne compte qu'une fois", () => {
  // d6+2 contre 12 : 6 + 2 = 8, puis + 3 = 11, qui échoue. Compté deux fois,
  // le modificateur ferait 13, qui réussirait.
  const jet = jouer(ouvrir({ faces: 6, difficulte: 12, modificateurs: [2] }), [6], "exploser", [3]);
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 8, somme: 11, reussi: false, explosible: false });
  assert.ok(jetFini(jet));

  const juste = jouer(ouvrir({ faces: 6, difficulte: 12, modificateurs: [2] }), [6], "exploser", [4]);
  assert.equal(evaluerEssai(juste, juste.places[0].essais[0]).somme, 12);
  assert.equal(reussites(juste), 1);
});

test("le dé explosif : il s'enchaîne tant que le dé montre sa face maximale et que la somme reste sous la difficulté", () => {
  let jet = jouer(ouvrir({ faces: 6, difficulte: 15 }), [6], "exploser", [6]);
  assert.equal(jet.attente, "choix_explosion", "12 reste sous 15, et le dé montre 6");
  jet = jouer(jet, "exploser", [2]);
  assert.deepEqual(jet.places[0].essais[0], { tirages: [6], explosions: [6, 2] });
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 6, somme: 14, reussi: false, explosible: false });
  assert.ok(jetFini(jet), "le dé ne montre plus sa face maximale : 14 échoue contre 15");
});

test("le dé explosif : il s'arrête dès que la somme n'est plus sous la difficulté, même si le dé montre encore sa face maximale", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 12 }), [6], "exploser", [6]);
  assert.deepEqual(evaluerEssai(jet, jet.places[0].essais[0]), { garde: 6, premier: 6, somme: 12, reussi: true, explosible: false });
  assert.equal(jet.attente, "de");
  assert.equal(exploser(jet).refus.code, "hors_moment");
});

test("le dé explosif : la face que montre le dé est celle de sa dernière explosion", () => {
  const jet = ouvrir({ faces: 6, difficulte: 30 });
  assert.equal(evaluerEssai(jet, { tirages: [6], explosions: [6, 6] }).explosible, true);
  assert.equal(evaluerEssai(jet, { tirages: [6], explosions: [6, 5] }).explosible, false);
  assert.equal(evaluerEssai(jet, { tirages: [6], explosions: [5] }).explosible, false);
});

test("le dé explosif : sous désavantage, seul le dé gardé explose", () => {
  const circ = { faces: 6, difficulte: 9, desavantages: 1 };
  const garde = jouer(ouvrir(circ), [6, 6]);
  assert.equal(garde.attente, "choix_explosion", "le pire des deux est un 6");

  const autre = jouer(ouvrir(circ), [6, 5]);
  assert.ok(jetFini(autre), "le 5 est gardé : le 6 écarté n'explose pas");
  assert.equal(evaluerEssai(autre, autre.places[0].essais[0]).explosible, false);
  assert.ok(jetFini(jouer(ouvrir(circ), [5, 6])));
});

test("le dé explosif : sous désavantage, l'explosion se lance une seule fois", () => {
  let jet = jouer(ouvrir({ faces: 6, difficulte: 9, desavantages: 2 }), [6, 6, 6], "exploser");
  assert.deepEqual(deAttendu(jet), { faces: 6, combien: 1, motif: "explosion", place: 1 });
  assert.equal(lancerDe(jet, [4, 4, 4]).refus.code, "hors_bornes");
  jet = jouer(jet, [4]);
  assert.equal(evaluerEssai(jet, jet.places[0].essais[0]).somme, 10);
  assert.equal(deAttendu(jet).combien, 3, "le dé suivant de la chaîne reprend ses trois lancers");
});

test("le dé explosif : la relance ne se propose qu'à un dé qui a fini d'exploser", () => {
  let jet = jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [6], "exploser", [1]);
  assert.equal(jet.attente, "choix_relance", "6 + 1 échoue contre 9 : la relance se propose alors");
  assert.deepEqual(choixDuJet(jet), ["relancer", "garder"]);
  assert.ok(jetFini(jouer(jet, "garder")));
});

test("le dé explosif : une relance remplace le dé et sa somme, et peut exploser à son tour", () => {
  let jet = jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [6], "exploser", [1], "relancer", [6]);
  assert.equal(jet.attente, "choix_explosion", "le dé de la relance montre sa face maximale");
  assert.equal(evaluerEssai(jet, jet.places[0].essais[1]).somme, 6, "sa somme repart du dé, sans le 6 + 1 d'avant");
  jet = jouer(jet, "exploser", [4]);
  assert.deepEqual(jet.places[0], {
    essais: [
      { tirages: [6], explosions: [1] },
      { tirages: [6], explosions: [4] },
    ],
  });
  assert.equal(evaluerEssai(jet, jet.places[0].essais[1]).somme, 10);
  assert.equal(reussites(jet), 1);
  assert.equal(jet.attente, "de");
});

test("le dé explosif : après une explosion qui échoue sans relance, le jet est fini", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 9 }), [6], "exploser", [2]);
  assert.ok(jetFini(jet));
  assert.equal(reussites(jet), 0);
});

test("le dé explosif : il vaut à chaque place de la chaîne", () => {
  const jet = jouer(ouvrir({ faces: 4, difficulte: 5, modificateurs: [0] }), [4], "exploser", [1], [4], "exploser", [4], [2]);
  assert.deepEqual(sommes(jet), [5, 8, 2]);
  assert.equal(reussites(jet), 2);
  assert.ok(jetFini(jet));
});

// ─── Les transitions ────────────────────────────────────────────────────────

// Un jet arrêté sur chacune des six attentes.
const TEMOINS = {
  de: () => ouvrir({ faces: 6, difficulte: 9, avantages: 1 }),
  choix_relance: () => jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [2]),
  de_relance: () => jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [2], "relancer"),
  choix_explosion: () => jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [6]),
  de_explosion: () => jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [6], "exploser"),
  fini: () => jouer(ouvrir({ faces: 6, difficulte: 9, avantages: 1 }), [2], "garder"),
};

const PERMIS = {
  de: ["lancerDe"],
  choix_relance: ["relancer", "garder"],
  de_relance: ["lancerDe"],
  choix_explosion: ["exploser"],
  de_explosion: ["lancerDe"],
  fini: [],
};

const TRANSITIONS = {
  lancerDe: (jet) => lancerDe(jet, [3]),
  relancer,
  garder,
  exploser,
};

test("les transitions : chaque témoin est bien arrêté sur son attente", () => {
  for (const [attente, fabriquer] of Object.entries(TEMOINS)) assert.equal(fabriquer().attente, attente);
  assert.deepEqual(Object.keys(TEMOINS), Object.keys(PERMIS));
});

for (const [attente, fabriquer] of Object.entries(TEMOINS)) {
  for (const [nom, transition] of Object.entries(TRANSITIONS)) {
    const permise = PERMIS[attente].includes(nom);
    test(`les transitions : à l'attente « ${attente} », ${nom} est ${permise ? "acceptée" : "refusée, sans rien changer"}`, () => {
      const jet = fabriquer();
      const avant = JSON.stringify(jet);
      const rendu = transition(jet);
      assert.equal(JSON.stringify(jet), avant, "le jet reçu ne change jamais");
      if (permise) {
        assert.deepEqual(Object.keys(rendu), ["jet"]);
        assert.notEqual(rendu.jet, jet);
        assert.notEqual(rendu.jet.attente, attente);
      } else {
        assert.deepEqual(Object.keys(rendu), ["refus"]);
        assert.equal(rendu.refus.code, "hors_moment");
        assert.equal(typeof rendu.refus.message, "string");
        assert.ok(rendu.refus.message.length > 0);
      }
    });
  }
}

test("les transitions : ce que le jet attend, attente par attente", () => {
  const lectures = Object.fromEntries(Object.entries(TEMOINS).map(([attente, fabriquer]) => [attente, { de: deAttendu(fabriquer())?.motif ?? null, choix: choixDuJet(fabriquer()), fini: jetFini(fabriquer()) }]));
  assert.deepEqual(lectures, {
    de: { de: "chaine", choix: [], fini: false },
    choix_relance: { de: null, choix: ["relancer", "garder"], fini: false },
    de_relance: { de: "relance", choix: [], fini: false },
    choix_explosion: { de: null, choix: ["exploser"], fini: false },
    de_explosion: { de: "explosion", choix: [], fini: false },
    fini: { de: null, choix: [], fini: true },
  });
});

// ─── Les valeurs d'un dé ────────────────────────────────────────────────────

test("lancerDe : une valeur va de 1 aux faces du dé, bornes comprises", () => {
  const jet = ouvrir({ faces: 10, difficulte: 5 });
  assert.ok(lancerDe(jet, [1]).jet);
  assert.ok(lancerDe(jet, [10]).jet);
  for (const valeurs of [[0], [11], [-3], [2.5], ["7"], [null], [NaN], [Infinity], [], [7, 7]]) {
    const rendu = lancerDe(jet, valeurs);
    assert.deepEqual(Object.keys(rendu), ["refus"], JSON.stringify(valeurs));
    assert.equal(rendu.refus.code, "hors_bornes");
  }
  for (const valeurs of [7, "7", null, undefined, { 0: 7, length: 1 }]) assert.equal(lancerDe(jet, valeurs).refus.code, "hors_bornes");
});

test("lancerDe : le refus dit le dé attendu", () => {
  assert.equal(lancerDe(ouvrir({ faces: 10 }), [11]).refus.message, "Ce dé attend une valeur de 1 à 10.");
  assert.equal(lancerDe(ouvrir({ faces: 8, desavantages: 1 }), [3]).refus.message, "Ce dé attend 2 valeurs de 1 à 8.");
});

test("lancerDe : les valeurs données ne sont ni gardées par référence, ni changées", () => {
  const valeurs = [8, 4];
  const jet = jouer(ouvrir({ desavantages: 1 }), valeurs);
  assert.deepEqual(jet.places[0].essais[0].tirages, [8, 4]);
  assert.notEqual(jet.places[0].essais[0].tirages, valeurs);
  assert.ok(!Object.isFrozen(valeurs));
});

// ─── evaluerEssai, et ce qui se recalcule ───────────────────────────────────

test("evaluerEssai : les cinq valeurs d'un essai, et elles seules", () => {
  const jet = ouvrir({ faces: 8, difficulte: 6, modificateurs: [1] });
  assert.deepEqual(evaluerEssai(jet, { tirages: [4], explosions: [] }), { garde: 4, premier: 5, somme: 5, reussi: false, explosible: false });
  assert.deepEqual(evaluerEssai(jet, { tirages: [5], explosions: [] }), { garde: 5, premier: 6, somme: 6, reussi: true, explosible: false });
  assert.deepEqual(Object.keys(evaluerEssai(jet, { tirages: [5], explosions: [] })), ["garde", "premier", "somme", "reussi", "explosible"]);
});

test("evaluerEssai : rien de ce qu'il calcule n'est gardé dans le jet", () => {
  const jet = jouer(ouvrir({ faces: 6, difficulte: 9, modificateurs: [1], avantages: 1 }), [6], "exploser", [1], "relancer", [5]);
  for (const place of jet.places) {
    assert.deepEqual(Object.keys(place), ["essais"]);
    for (const essai of place.essais) assert.deepEqual(Object.keys(essai), ["tirages", "explosions"]);
  }
  assert.equal(Object.keys(jet).length, 12);
});

test("reussites : une place vaut par son dernier essai", () => {
  const jet = ouvrir({ difficulte: 5 });
  const essai = (valeur) => ({ tirages: [valeur], explosions: [] });
  assert.equal(reussites({ ...jet, places: [{ essais: [essai(2), essai(7)] }, { essais: [essai(9)] }, { essais: [essai(3), essai(1)] }] }), 2);
  assert.equal(reussites({ ...jet, places: [] }), 0);
});

// ─── La pureté ──────────────────────────────────────────────────────────────

test("tout jet rendu est gelé, et partage avec le précédent ce qui n'a pas changé", () => {
  const premier = jouer(ouvrir({ modificateurs: [1], avantages: 1 }), [9]);
  const second = jouer(premier, [2]);
  const troisieme = jouer(second, "relancer");
  const quatrieme = jouer(troisieme, [8]);
  for (const jet of [premier, second, troisieme, quatrieme]) assert.ok(estGeleEnProfondeur(jet));
  assert.equal(second.modificateurs, premier.modificateurs);
  assert.equal(second.avantages, premier.avantages);
  assert.equal(second.places[0], premier.places[0], "la place déjà jouée n'est pas recopiée");
  assert.equal(troisieme.places, second.places, "un choix ne touche pas aux places");
  assert.equal(quatrieme.places[0], premier.places[0]);
  assert.equal(quatrieme.places[1].essais[0], second.places[1].essais[0]);
  assert.equal(premier.places.length, 1, "le jet d'avant n'a pas bougé");
  assert.equal(second.places[1].essais.length, 1);
});

test("un jet passe par JSON à l'identique, et reprend là où il en était", () => {
  const pas = [[6], "exploser", [1], "relancer", [6], "exploser", [4], [3]];
  for (let coupe = 0; coupe <= pas.length; coupe += 1) {
    const avant = jouer(ouvrir({ faces: 6, difficulte: 9, modificateurs: [0], avantages: 1 }), ...pas.slice(0, coupe));
    const relu = JSON.parse(JSON.stringify(avant));
    assert.deepEqual(relu, avant);
    assert.deepEqual(deAttendu(relu), deAttendu(avant));
    assert.deepEqual(choixDuJet(relu), choixDuJet(avant));
    assert.deepEqual(jouer(relu, ...pas.slice(coupe)), jouer(avant, ...pas.slice(coupe)));
  }
});

test("le même jet, rejoué avec les mêmes valeurs, repasse par les mêmes attentes", () => {
  const pas = [[6, 6], "exploser", [3], [2, 5]];
  const attentes = (depart) => {
    const vues = [];
    let jet = depart;
    for (const un of pas) {
      jet = jouer(jet, un);
      vues.push(jet.attente);
    }
    return vues;
  };
  const circ = { faces: 6, difficulte: 9, modificateurs: [1], desavantages: 1 };
  assert.deepEqual(attentes(ouvrir(circ)), ["choix_explosion", "de_explosion", "de", "fini"]);
  assert.deepEqual(attentes(ouvrir(circ)), attentes(ouvrir(circ)));
});
