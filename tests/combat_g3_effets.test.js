// Contrôles des effets du groupe 3 (SPECIFICATION.md, § 17 ; mission du lot
// 4.3, § 4.5 à § 4.8 et § 5 ; contrat de la vague 1, § 3, § 5, § 6.3 et
// § 7.5) : js/combat/effets.js. La palette (chaque genre, son moment et sa
// raison), la source, l'auteur et le camp, le prix d'un passif payant et son
// X, « un passif sert une fois par jet », rendre borné au maximum, ±N (et la
// valeur d'un adversaire avant et après), les états, déplacer, les gestes du MJ et leurs bornes, l'échéance, les effets
// des absents, l'attaque en plus et la garde jouable. Et les choix de l'agent
// principal (contrat, § 12) : la préparation d'un geste et le prix rendu
// (11), ni allié ni soi dans « toute la case » (10), la puissance d'un passif
// (14), les valeurs du MJ sans maximum (16), l'équipement qui renumérote (17),
// la zone d'une blessure (18), les bornes d'une photographie (20).
//
// Les états partent d'ouvrirCombat (js/combat/moteur.js) sur des
// photographies de la démonstration (tests/outils/), lancés à la main ; les
// gestes sont écrits d'après la forme du contrat (§ 4), et les fonctions
// d'effets.js sont appelées directement, sans le moteur, qui ne les appelle
// peut-être pas encore. Chaque événement passe d'abord par validerEvenement,
// comme dans le jeu. Les états reçus sont gelés : une fonction qui les
// changerait lèverait. Chaque règle est vue des deux côtés.

import { test } from "node:test";
import assert from "node:assert/strict";
import { degatsFixes, localisationsDuGeste, victimeDe } from "../js/combat/degats.js";
import {
  JET_CONTRE_UN_ALLIE,
  appliquerEffet,
  appliquerMj,
  attaqueEnPlusDe,
  echeances,
  gardeJouable,
  horsDesBornesDeLaPhoto,
  jugerEffet,
  jugerMj,
  offreDesEffets,
  prixDuPassif,
  rendrePrixDesPassifs,
  sansEffetsDesAbsents,
} from "../js/combat/effets.js";
import { validerEvenement } from "../js/combat/forme.js";
import { exploser, lancerDe, ouvrirJet } from "../js/combat/jet.js";
import { ouvrirCombat } from "../js/combat/moteur.js";
import { GENRES_EFFET, geler } from "../js/combat/regles.js";
import { attaqueDe, courantDe, defenseDe, effetsDurablesDe, photoDe, vivant } from "../js/combat/valeurs.js";
import { adversaireEssai, aubepineEssai, capaciteEssai, chefDePartieEssai, etatsEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils : les protagonistes et l'état ───────────────────────────────

const SAUCIER = { genre: "archetype", titre: "Saucier" };
const passive = (champs) => faconEssai({ elements: ["Passif"], passif: true, ...champs });

// Aubépine Crèmebrûlée, et trois passifs de plus : Minutie (X souffle),
// Braise (1 lien, sur le Grand Four), Tour de main (un coût illisible).
function aubepine(retoucher = () => {}) {
  return aubepineEssai((valeurs) => {
    valeurs.capacites.push(
      capaciteEssai({ nom: "Minutie", niveau: 1, evolue: true, groupe: SAUCIER, facons: [passive({ puissance: 1, cout: { souffle: "X", lien: 0 }, description: "[N] avantage(s)." })] }),
      capaciteEssai({ nom: "Braise", groupe: { genre: "primordial", titre: "Grand Four" }, lien: 0, facons: [passive({ cout: { souffle: 0, lien: 1 }, description: "Ravive le four." })] }),
      capaciteEssai({ nom: "Tour de main", groupe: SAUCIER, facons: [passive({ cout: null, description: "Un geste sûr." })] }),
    );
    retoucher(valeurs);
  });
}

// Le Marmiton, et un passif qui coûte du souffle et du lien.
const marmiton = () =>
  adversaireEssai((valeurs) => {
    valeurs.capacites.push(capaciteEssai({ nom: "Nez fin", groupe: { genre: "capacites", titre: "Capacités" }, facons: [passive({ cout: { souffle: 1, lien: 2 }, description: "Flaire le plat." })] }));
  });

const brioche = () =>
  pjEssai((valeurs) => {
    valeurs.identifiant = "essai-brioche-0000000002";
    valeurs.nom = "Brioche";
  });

/**
 * Aubépine (pj1), le Marmiton (adv2), le Chef de partie (adv3), tous en D4, et
 * Brioche (pj4) en A1 : l'état d'ouvrirCombat, lancé à la main (tour 1 du camp
 * « camp », un événement joué). « retoucher » reçoit une copie de l'état avant
 * son gel.
 */
function combat({ retoucher = () => {}, camp = "pj", photoAubepine = aubepine() } = {}) {
  const ouvert = ouvrirCombat(
    miseEnPlaceEssai([
      { photo: photoAubepine, case: "D4" },
      { photo: marmiton(), case: "D4" },
      { photo: chefDePartieEssai(), case: "D4" },
      { photo: brioche(), case: "A1" },
    ]),
  );
  const etat = structuredClone(ouvert);
  Object.assign(etat, { phase: "combat", tour: { numero: 1, camp }, lanceLe: "2026-10-26T21:30", pas: 1 });
  retoucher(etat);
  return geler(etat);
}

// L'indice d'une capacité, retrouvée par son nom.
function indiceDe(etat, id, nom) {
  const indice = photoDe(etat, id).capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(indice, -1, `« ${nom} » n'est pas une capacité de ${id}`);
  return indice;
}

// Un geste tel que le moteur le tient au groupe 3 (contrat, § 4) : Aubépine
// joue Frappe sur le Marmiton.
const geste = (champs = {}) => ({
  numero: 2,
  acteur: "pj1",
  capacite: 0,
  facon: 0,
  mode: "attaque",
  moment: "preparation",
  paye: false,
  prix: null,
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

const avecGestes = (etat, ...gestes) => geler({ ...etat, pile: gestes });

// Un jet d'attaque d'Aubépine : un d10 contre « difficulte » ; chaque pas est
// un dé (ses valeurs) ou « exploser ».
function jet(pas, { difficulte = 5, avantages = 0 } = {}) {
  let courant = ouvrirJet({
    genre: "attaque",
    lanceur: "pj1",
    faces: 10,
    caracteristiques: null,
    mobilisees: ["precision", "agilite"],
    difficulte,
    libelle: null,
    modificateurs: [],
    avantages: avantages > 0 ? [{ genre: "main", nom: "Minutie", nombre: avantages, de: null }] : [],
    desavantages: [],
  });
  for (const un of pas) {
    const rendu = un === "exploser" ? exploser(courant) : lancerDe(courant, un);
    assert.equal(rendu.refus, undefined, `pas refusé : ${rendu.refus?.message}`);
    courant = rendu.jet;
  }
  return courant;
}

const NORMAUX = { base: "lettre", operations: [], nature: "normaux" };

// Aubépine a touché le Marmiton : deux réussites (B, 8), les dégâts posés.
const auBilan = (champs = {}) => geste({ moment: "bilan", paye: true, jet: jet([[8], [8], [2]]), degats: NORMAUX, ...champs });
// Puis un d20 sur la face 5 (le torse) : l'étape « Interventions ».
const auxSuites = (champs = {}) => auBilan({ moment: "suites", localisation: [{ brut: 5, decalage: null }], ...champs });

// ─── Les outils : les événements et les verdicts ────────────────────────────

const MJ = { genre: "mj" };
const deCapacite = (etat, qui, nom) => ({ genre: "capacite", qui, capacite: indiceDe(etat, qui, nom) });
// La capacité que joue geste() : la Frappe d'Aubépine, seule source avant le
// paiement avec un passif (contrat, § 12, choix 11).
const FRAPPE = { genre: "capacite", qui: "pj1", capacite: 0 };

// L'événement tel que le moteur le reçoit : la copie de validerEvenement.
function lu(evenement) {
  const { evenement: copie, erreur } = validerEvenement(evenement);
  assert.equal(erreur, undefined, `forme : ${erreur}`);
  return copie;
}

const effet = (genre, champs = {}, source = MJ) => lu({ type: "effet", genre, source, ...champs });
const mj = (genre, qui, champs = {}) => lu({ type: "mj", genre, qui, ...champs });

function accepte(verdict, quoi = "") {
  assert.equal(verdict.ok, true, `${quoi} refusé : ${verdict.message}`);
}

function refuse(verdict, code, message) {
  assert.equal(verdict.ok, false, `accepté, attendu : ${message}`);
  assert.equal(verdict.code, code, verdict.message);
  if (message !== undefined) assert.equal(verdict.message, message);
}

// Juge puis applique ; l'état rendu est gelé, comme le moteur le ferait.
function appliquer(etat, evenement) {
  accepte(jugerEffet(etat, evenement), evenement.genre);
  const { etat: suivant, effet: fait } = appliquerEffet(etat, evenement);
  return { etat: geler(suivant), effet: fait };
}

function appliquerLeMj(etat, evenement) {
  accepte(jugerMj(etat, evenement), evenement.genre);
  return geler(appliquerMj(etat, evenement).etat);
}

const sommet = (etat) => etat.pile[etat.pile.length - 1];

// Un effet durable écrit à la main (contrat, § 3).
const durable = (champs) => ({ id: 0, genre: "etat", porteur: "adv2", auteur: "pj1", camp: "pj", duree: "tour", source: MJ, capacite: null, libre: "Couvert de farine", blessure: false, ...champs });

const HORS_DU_GESTE = ["rendre", "attaque", "defense", "etat", "deplacer"];

// ─── La palette : ce qu'elle offre, et quand ────────────────────────────────

test("Avant le lancement, rien ne s'offre ; hors d'un geste, les seuls effets sur une cible", () => {
  const ouvert = ouvrirCombat(miseEnPlaceEssai([{ photo: aubepine() }, { photo: marmiton() }]));
  const avant = offreDesEffets(ouvert);
  assert.deepEqual(Object.keys(avant), [...GENRES_EFFET]);
  for (const genre of GENRES_EFFET) assert.deepEqual(avant[genre], { actif: false, raison: "Le combat n'est pas lancé." }, genre);
  refuse(jugerEffet(ouvert, effet("rendre", { sur: "pj1", ressource: "corps", n: 1 })), "hors_moment", "Le combat n'est pas lancé.");

  const etat = combat();
  const offre = offreDesEffets(etat);
  for (const genre of GENRES_EFFET) {
    if (HORS_DU_GESTE.includes(genre)) assert.deepEqual(offre[genre], { actif: true, raison: null }, genre);
    else assert.deepEqual(offre[genre], { actif: false, raison: "Hors d'un geste." }, genre);
  }
  refuse(jugerEffet(etat, effet("multiplier", { k: 2 })), "hors_moment", "Hors d'un geste.");

  const fini = combat({ retoucher: (brut) => Object.assign(brut, { phase: "termine", vainqueur: "pj" }) });
  assert.deepEqual(offreDesEffets(fini).rendre, { actif: false, raison: "Le combat est terminé." });
  refuse(jugerEffet(fini, effet("deplacer", { sur: "pj1", vers: "E5" })), "hors_moment", "Le combat est terminé.");
});

test("Avantages et désavantages : un réglage du geste, avant tout dé", () => {
  const etat = avecGestes(combat(), geste());
  assert.deepEqual(offreDesEffets(etat).avantages, { actif: true, raison: null });
  const { etat: apres, effet: fait } = appliquer(etat, effet("avantages", { nombre: 2 }, FRAPPE));
  const { effets, passifs } = sommet(apres);
  assert.equal(effets.length, 1);
  assert.ok(effets[0] === fait, "l'effet rendu est celui que le geste garde");
  assert.deepEqual(
    { genre: fait.genre, nombre: fait.nombre, source: fait.source, prix: fait.prix, rang: fait.rang, auteur: fait.auteur, camp: fait.camp, durable: fait.durable },
    { genre: "avantages", nombre: 2, source: FRAPPE, prix: null, rang: 0, auteur: "pj1", camp: "pj", durable: null },
  );
  assert.deepEqual(passifs, [], "la capacité jouée n'est pas un passif");
  assert.equal(apres.effets.length, 0, "aucun effet durable");
  accepte(jugerEffet(etat, effet("desavantages", { nombre: 1 }, FRAPPE)));

  // Un dé lancé : le jet est ouvert, ses avantages figés.
  const lance = avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([[8]]) }));
  assert.deepEqual(offreDesEffets(lance).desavantages, { actif: false, raison: "Un dé est déjà lancé." });
  refuse(jugerEffet(lance, effet("avantages", { nombre: 1 })), "hors_moment", "Un dé est déjà lancé.");
});

test("Pendant la préparation, rien n'est payé : les seuls effets « pour ce jet », de la capacité jouée ou d'un passif (choix 11)", () => {
  const etat = avecGestes(combat(), geste());
  const offre = offreDesEffets(etat);
  for (const genre of GENRES_EFFET) {
    if (["avantages", "desavantages", "attaque", "defense", "etat"].includes(genre)) assert.deepEqual(offre[genre], { actif: true, raison: null }, genre);
    else assert.deepEqual(offre[genre], { actif: false, raison: "Le geste n'est pas encore payé." }, genre);
  }
  // ±N et un état : pour ce jet seulement.
  accepte(jugerEffet(etat, effet("defense", { sur: "adv2", n: -1, duree: "jet" }, FRAPPE)));
  accepte(jugerEffet(etat, effet("etat", { sur: "adv2", libre: "Ébloui", duree: "jet" }, FRAPPE)));
  refuse(jugerEffet(etat, effet("defense", { sur: "adv2", n: -1, duree: "tour" }, FRAPPE)), "hors_moment", "Le geste n'est pas encore payé.");
  refuse(jugerEffet(etat, effet("etat", { sur: "adv2", libre: "Ébloui", duree: "combat" }, FRAPPE)), "hors_moment", "Le geste n'est pas encore payé.");
  refuse(jugerEffet(etat, effet("deplacer", { sur: "pj1", vers: "E5" }, FRAPPE)), "hors_moment", "Le geste n'est pas encore payé.");
  refuse(jugerEffet(etat, effet("relancer", {}, FRAPPE)), "hors_moment", "Le geste n'est pas encore payé.");

  // La source : la capacité jouée, ou un passif (le sien, celui du jeté) ; ni le MJ, ni une autre capacité, ni un
  // passif câblé, ni un état.
  accepte(jugerEffet(etat, effet("avantages", { nombre: 1 }, deCapacite(etat, "pj1", "Nez fin"))), "un passif d'Aubépine");
  accepte(jugerEffet(etat, effet("desavantages", { nombre: 1 }, deCapacite(etat, "adv2", "Nez fin"))), "un passif du jeté");
  const AVANT = "Avant le paiement, la source est la capacité jouée ou un passif.";
  refuse(jugerEffet(etat, effet("avantages", { nombre: 1 })), "interdit", AVANT);
  refuse(jugerEffet(etat, effet("avantages", { nombre: 1 }, deCapacite(etat, "pj1", "Flambage"))), "interdit", AVANT);
  refuse(jugerEffet(etat, effet("avantages", { nombre: 1 }, deCapacite(etat, "pj1", "Réduction"))), "interdit", AVANT);
  const porte = avecGestes(combat({ retoucher: (brut) => brut.effets.push(durable({ id: 7, porteur: "adv2" })) }), geste());
  refuse(jugerEffet(porte, effet("avantages", { nombre: 1 }, { genre: "etat", effet: 7 })), "interdit", AVANT);

  // Payé, chaque genre retrouve son moment, et toute source : ±N « tour », déplacer, le MJ.
  const paye = avecGestes(combat(), auBilan());
  accepte(jugerEffet(paye, effet("defense", { sur: "adv2", n: -1, duree: "tour" })));
  accepte(jugerEffet(paye, effet("deplacer", { sur: "pj1", vers: "E5" })));

  // Un geste sans jet (Flambage, sans jet) : rien avant le paiement, qui le finit.
  const flambage = { genre: "capacite", qui: "pj1", capacite: 3 };
  const sansJet = avecGestes(combat(), geste({ capacite: 3, mode: "sans_jet" }));
  assert.deepEqual(offreDesEffets(sansJet).avantages, { actif: false, raison: "Ce geste ne lance aucun dé." });
  assert.deepEqual(offreDesEffets(sansJet).defense, { actif: false, raison: "Ce geste ne lance aucun dé." });
  assert.deepEqual(offreDesEffets(sansJet).rendre, { actif: false, raison: "Le geste n'est pas encore payé." });
  refuse(jugerEffet(sansJet, effet("avantages", { nombre: 1 }, flambage)), "hors_moment", "Ce geste ne lance aucun dé.");
  refuse(jugerEffet(sansJet, effet("attaque", { sur: "adv2", n: 1, duree: "jet" }, flambage)), "hors_moment", "Ce geste ne lance aucun dé.");
});

test("Le prix d'un passif payé avant le paiement se rend quand le geste s'en va (choix 11)", () => {
  const etat = avecGestes(combat(), geste());
  // Minutie (X = 3 en souffle), Braise (1 lien), et le Nez fin du Marmiton (1 souffle, son lien jamais payé).
  const { etat: un } = appliquer(etat, lu({ type: "effet", genre: "avantages", nombre: 3, source: deCapacite(etat, "pj1", "Minutie"), x: 3 }));
  const { etat: deux } = appliquer(un, effet("avantages", { nombre: 1 }, deCapacite(etat, "pj1", "Braise")));
  const { etat: trois } = appliquer(deux, effet("desavantages", { nombre: 1 }, deCapacite(etat, "adv2", "Nez fin")));
  const lire = (un) => [courantDe(un, "pj1").souffle, courantDe(un, "pj1").liens[0].points, courantDe(un, "adv2").souffle];
  assert.deepEqual(lire(trois), [7, 0, 4]);
  const rendu = rendrePrixDesPassifs(trois, sommet(trois));
  assert.deepEqual(lire(rendu), [10, 1, 5]);
  assert.ok(JSON.stringify(rendu.protagonistes) === JSON.stringify(etat.protagonistes), "les protagonistes d'avant les passifs, à la lettre");
  // Rien à rendre : la capacité jouée ne coûte rien ; l'objet même.
  const { etat: gratuit } = appliquer(etat, effet("avantages", { nombre: 1 }, FRAPPE));
  assert.ok(rendrePrixDesPassifs(gratuit, sommet(gratuit)) === gratuit);
  assert.ok(rendrePrixDesPassifs(etat, sommet(etat)) === etat);
});

// ─── Les dés : relancer, inverser, +1 réussite ──────────────────────────────

test("Relancer et inverser portent sur le dernier dé de la chaîne, avant le dé suivant", () => {
  // Un 3 contre 5, sans relance : le jet est fini sur un échec.
  const etat = avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([[3]]) }));
  const offre = offreDesEffets(etat);
  assert.deepEqual([offre.relancer.actif, offre.inverser.actif], [true, true]);

  const { etat: relance } = appliquer(etat, effet("relancer"));
  assert.deepEqual([sommet(relance).jet.attente, sommet(relance).jet.relanceParPalette], ["de_relance", true]);
  refuse(jugerEffet(relance, effet("inverser")), "hors_moment", "Un dé est attendu.");

  // Inversé, le 3 devient un 8 : réussi, la chaîne reprend.
  const { etat: inverse, effet: fait } = appliquer(etat, effet("inverser"));
  assert.deepEqual([fait.avant, fait.apres, sommet(inverse).jet.attente], [3, 8, "de"]);
  refuse(jugerEffet(inverse, effet("inverser")), "hors_moment", "Ce dé est déjà inversé.");
  refuse(jugerEffet(inverse, effet("relancer")), "hors_moment", "Ce dé est déjà inversé.");

  // Un 10 contre 15 explose ; tant que l'explosion attend son dé, rien.
  const explosif = avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([[10], "exploser"], { difficulte: 15 }) }));
  refuse(jugerEffet(explosif, effet("relancer")), "hors_moment", "Un dé est attendu.");
  // Explosé (10 + 4 sous 15) : il se relance, il ne s'inverse plus.
  const explose = avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([[10], "exploser", [4]], { difficulte: 15 }) }));
  refuse(jugerEffet(explose, effet("inverser")), "hors_moment", "Ce dé a explosé : il ne s'inverse plus.");
  accepte(jugerEffet(explose, effet("relancer")));
});

test("Les dés : aucun avant le premier, plus rien après un d20 ou une intervention", () => {
  const prepare = avecGestes(combat(), geste());
  assert.deepEqual(offreDesEffets(prepare).relancer, { actif: false, raison: "Le geste n'est pas encore payé." });
  // La cible suivante d'un geste à plusieurs cibles : son jet s'ouvre, sans dé.
  const ouvert = avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([]) }));
  refuse(jugerEffet(ouvert, effet("inverser")), "hors_moment", "Aucun dé lancé.");
  refuse(jugerEffet(avecGestes(combat(), auxSuites()), effet("relancer")), "hors_moment", "Un d20 est déjà lancé.");

  // Un manqué attend « Passer » : une esquive jouée fige le jet.
  const manque = geste({ moment: "suites", paye: true, jet: jet([[2]]) });
  accepte(jugerEffet(avecGestes(combat(), manque), effet("inverser")));
  const esquive = { ...manque, interventions: [{ qui: "adv2", capacite: 0, prix: { actions: 1, souffle: 1 }, effet: { genre: "annuler", x: 1 } }] };
  refuse(jugerEffet(avecGestes(combat(), esquive), effet("inverser")), "hors_moment", "Une intervention est déjà jouée.");
});

test("+1 réussite : sur un jet fini, jamais au-delà de trois", () => {
  refuse(jugerEffet(avecGestes(combat(), geste({ moment: "jet", paye: true, jet: jet([[8]]) })), effet("reussite")), "hors_moment", "Le jet n'est pas fini.");
  const une = avecGestes(combat(), geste({ moment: "suites", paye: true, jet: jet([[8], [2]]) }));
  const { etat: apres, effet: fait } = appliquer(une, effet("reussite"));
  assert.deepEqual([fait.avant, fait.apres, sommet(apres).jet.bonus], [1, 2, 1]);
  const trois = avecGestes(combat(), auBilan({ jet: jet([[8], [8], [8]]) }));
  assert.deepEqual(offreDesEffets(trois).reussite, { actif: false, raison: "Le jet compte déjà trois réussites." });
});

// ─── La zone ────────────────────────────────────────────────────────────────

test("La zone d'un d20 lancé : elle remplace celle de la face, jamais une contre-attaque", () => {
  const etat = avecGestes(combat(), auxSuites());
  assert.deepEqual(offreDesEffets(etat).zone, { actif: true, raison: null });
  const { etat: apres, effet: fait } = appliquer(etat, effet("zone", { de: 0, zone: 5 }));
  const d20 = sommet(apres).localisation[0];
  assert.deepEqual([d20.brut, d20.choisie.zone, d20.choisie.source], [5, 5, MJ]);
  assert.deepEqual([fait.avant, fait.apres], [0, 5], "du torse à la tête");
  assert.equal(localisationsDuGeste(apres, sommet(apres))[0].zone, 5, "degats.js la lit");

  refuse(jugerEffet(etat, effet("zone", { de: 1, zone: 0 })), "hors_bornes", "Ce d20 n'a pas été lancé.");
  refuse(jugerEffet(etat, effet("zone", { de: 0, zone: 6 })), "hors_bornes", "Cette zone n'existe pas chez la victime.");
  // La face 1 du Marmiton est sa contre-attaque.
  const contre = avecGestes(combat(), auxSuites({ localisation: [{ brut: 1, decalage: null }] }));
  refuse(jugerEffet(contre, effet("zone", { de: 0, zone: 0 })), "hors_bornes", "Une face de contre-attaque ne se choisit pas.");
  refuse(jugerEffet(avecGestes(combat(), auBilan()), effet("zone", { de: 0, zone: 0 })), "hors_moment", "Aucun d20 lancé.");
  const applique = avecGestes(combat(), auxSuites({ moment: "blessure", resultat: { coups: [], mort: false } }));
  refuse(jugerEffet(applique, effet("zone", { de: 0, zone: 0 })), "hors_moment", "Les dégâts sont déjà appliqués.");
});

// ─── Les dégâts ─────────────────────────────────────────────────────────────

test("Les dégâts : calculés et pas encore appliqués ; degats.js lit les opérations", () => {
  const etat = avecGestes(combat(), auBilan());
  for (const genre of ["multiplier", "ajouter", "retrancher", "armure", "directs", "reporter", "toute_la_case", "attaque_en_plus"]) {
    assert.deepEqual(offreDesEffets(etat)[genre], { actif: true, raison: null }, genre);
  }
  assert.equal(degatsFixes(etat, sommet(etat)).valeur, 8);
  const { etat: double } = appliquer(etat, effet("multiplier", { k: 2 }));
  const { etat: plus } = appliquer(double, effet("ajouter", { n: 3 }));
  assert.equal(degatsFixes(plus, sommet(plus)).valeur, 19, "8 × 2 + 3");
  assert.equal(sommet(plus).effets.length, 2);

  refuse(jugerEffet(avecGestes(combat(), geste()), effet("ajouter", { n: 1 })), "hors_moment", "Le geste n'est pas encore payé.");
  const manque = avecGestes(combat(), geste({ moment: "suites", paye: true, jet: jet([[2]]) }));
  refuse(jugerEffet(manque, effet("retrancher", { n: 1 })), "hors_moment", "Aucuns dégâts calculés.");
  const applique = avecGestes(combat(), auxSuites({ moment: "blessure", resultat: { coups: [], mort: false } }));
  refuse(jugerEffet(applique, effet("directs", { n: 2, nature: "corps" })), "hors_moment", "Les dégâts sont déjà appliqués.");

  // Chaque condition compte seule : le moment, les dégâts posés, la lettre.
  const contre = avecGestes(combat(), auxSuites({ moment: "contre_attaque", localisation: [{ brut: 1, decalage: null }] }));
  refuse(jugerEffet(contre, effet("ajouter", { n: 1 })), "hors_moment", "Aucuns dégâts calculés.");
  refuse(jugerEffet(avecGestes(combat(), auBilan({ degats: null })), effet("ajouter", { n: 1 })), "hors_moment", "Aucuns dégâts calculés.");
  const devenuManque = avecGestes(combat(), auBilan({ moment: "suites", jet: jet([[2]]) }));
  refuse(jugerEffet(devenuManque, effet("ajouter", { n: 1 })), "hors_moment", "Aucuns dégâts calculés.");
});

test("Reporter : la victime devient un autre vivant", () => {
  const etat = avecGestes(combat(), auBilan());
  const { etat: apres, effet: fait } = appliquer(etat, effet("reporter", { sur: "adv3" }));
  assert.equal(victimeDe(sommet(apres)), "adv3");
  assert.equal(fait.avant, "adv2");
  refuse(jugerEffet(etat, effet("reporter", { sur: "adv2" })), "interdit", "Les dégâts vont déjà à ce protagoniste.");
  refuse(jugerEffet(etat, effet("reporter", { sur: "adv9" })), "hors_bornes", "Ce protagoniste n'est pas dans le combat.");
  const mort = avecGestes(combat({ retoucher: (brut) => Object.assign(brut.protagonistes.adv3, { corps: 0, mort: { tour: 1 } }) }), auBilan());
  refuse(jugerEffet(mort, effet("reporter", { sur: "adv3" })), "interdit", "Ce protagoniste est mort ou retiré du combat.");
});

test("Toute la case : sur le geste racine, à sa première cible, des vivants de sa case", () => {
  const etat = avecGestes(combat(), auBilan());
  const { etat: apres } = appliquer(etat, effet("toute_la_case", { cibles: ["adv2", "adv3"] }));
  assert.deepEqual([sommet(apres).cibles, sommet(apres).rang, sommet(apres).cible], [["adv2", "adv3"], 0, "adv2"]);
  // Ni l'auteur ni ses alliés : le jet contre eux n'est pas écrit (choix 10). Brioche rejoint la case.
  assert.equal(JET_CONTRE_UN_ALLIE, "Le jet contre un allié ou contre soi n'est pas encore écrit dans les règles.");
  refuse(jugerEffet(etat, effet("toute_la_case", { cibles: ["adv2", "pj1"] })), "interdit", JET_CONTRE_UN_ALLIE);
  const avecBrioche = avecGestes(combat({ retoucher: (brut) => (brut.protagonistes.pj4.case = "D4") }), auBilan());
  refuse(jugerEffet(avecBrioche, effet("toute_la_case", { cibles: ["adv2", "adv3", "pj4"] })), "interdit", JET_CONTRE_UN_ALLIE);
  accepte(jugerEffet(avecBrioche, effet("toute_la_case", { cibles: ["adv2", "adv3"] })));
  // Le Marmiton qui attaque Aubépine : ses alliés à lui, le Chef, ne se cochent pas ; Brioche, oui.
  const adverse = avecGestes(combat({ camp: "adv", retoucher: (brut) => (brut.protagonistes.pj4.case = "D4") }), auBilan({ acteur: "adv2", cible: "pj1" }));
  refuse(jugerEffet(adverse, effet("toute_la_case", { cibles: ["pj1", "adv3"] })), "interdit", JET_CONTRE_UN_ALLIE);
  accepte(jugerEffet(adverse, effet("toute_la_case", { cibles: ["pj1", "pj4"] })));

  refuse(jugerEffet(etat, effet("toute_la_case", { cibles: ["adv3", "adv2"] })), "hors_bornes", "La première cible est celle du geste.");
  refuse(jugerEffet(etat, effet("toute_la_case", { cibles: ["adv2"] })), "hors_bornes", "Choisissez au moins une autre cible.");
  refuse(jugerEffet(etat, effet("toute_la_case", { cibles: ["adv2", "pj4"] })), "hors_bornes", "Chaque cible est un vivant de la case de la première.");

  const emboite = avecGestes(combat(), geste({ moment: "suites", paye: true }), auBilan({ genre: "intervention", acteur: "pj4", parent: 2 }));
  refuse(jugerEffet(emboite, effet("toute_la_case", { cibles: ["adv2", "adv3"] })), "hors_moment", "Seul le geste du bas de la pile vise toute la case.");
  assert.deepEqual(offreDesEffets(apres).toute_la_case, { actif: false, raison: "Ce geste a déjà plusieurs cibles." });
  const second = avecGestes(combat(), auBilan({ rang: 1, cible: "adv3", cibles: null }));
  assert.equal(offreDesEffets(second).toute_la_case.raison, "Ce geste a déjà plusieurs cibles.");
});

test("Une attaque en plus : un effet durable de son auteur, jusqu'au prochain tour de son camp", () => {
  const etat = avecGestes(combat(), auBilan());
  const { etat: apres, effet: fait } = appliquer(etat, effet("attaque_en_plus", {}, deCapacite(etat, "pj1", "Flambage")));
  const [pose] = apres.effets;
  assert.deepEqual(pose, { id: 2, genre: "attaque_en_plus", porteur: "pj1", auteur: "pj1", camp: "pj", duree: "tour", source: fait.source });
  assert.equal(fait.durable, 2);
  assert.ok(attaqueEnPlusDe(apres, "pj1") === pose);
  assert.equal(attaqueEnPlusDe(apres, "adv2"), null);
  assert.equal(attaqueEnPlusDe(etat, "pj1"), null);
});

// ─── La source, l'auteur et le camp ─────────────────────────────────────────

test("La source : une capacité de l'acteur, du jeté ou du porteur d'un état ; un état porté ; le MJ", () => {
  const etat = avecGestes(combat(), auBilan());
  accepte(jugerEffet(etat, effet("ajouter", { n: 1 }, deCapacite(etat, "pj1", "Flambage"))));
  accepte(jugerEffet(etat, effet("ajouter", { n: 1 }, deCapacite(etat, "adv2", "Frappe"))), "le jeté");
  refuse(jugerEffet(etat, effet("ajouter", { n: 1 }, deCapacite(etat, "adv3", "Frappe"))), "hors_bornes", "Cette capacité ne peut pas être la source de cet effet.");
  refuse(jugerEffet(etat, effet("ajouter", { n: 1 }, { genre: "capacite", qui: "pj1", capacite: 99 })), "hors_bornes", "Cette capacité n'existe pas.");
  refuse(jugerEffet(etat, effet("ajouter", { n: 1 }, { genre: "etat", effet: 7 })), "hors_bornes", "Cet état n'est porté par personne.");

  // Hors d'un geste : un état, une capacité de son porteur.
  const libre = combat();
  const rendre = (source) => effet("rendre", { sur: "pj1", ressource: "corps", n: 1 }, source);
  const blesse = combat({ retoucher: (brut) => brut.protagonistes.pj1.corps-- });
  refuse(jugerEffet(blesse, rendre(deCapacite(libre, "adv3", "Frappe"))), "hors_bornes", "Cette capacité ne peut pas être la source de cet effet.");
  const porte = combat({
    retoucher: (brut) => {
      brut.protagonistes.pj1.corps--;
      brut.effets.push(durable({ id: 7, porteur: "adv3" }));
    },
  });
  accepte(jugerEffet(porte, rendre(deCapacite(libre, "adv3", "Frappe"))));
  accepte(jugerEffet(porte, rendre({ genre: "etat", effet: 7 })));
});

test("L'auteur et le camp : l'acteur du geste ; hors d'un geste, le porteur, ou le camp qui joue", () => {
  const dans = avecGestes(combat({ camp: "adv" }), auBilan());
  const { effet: duGeste } = appliquer(dans, effet("ajouter", { n: 1 }));
  assert.deepEqual([duGeste.auteur, duGeste.camp, duGeste.rang], ["pj1", "pj", 0], "le MJ pendant un geste : l'acteur");

  const surAdv = (source, camp = "pj", effets = []) =>
    appliquer(
      combat({ camp, retoucher: (brut) => brut.effets.push(...effets) }),
      effet("defense", { sur: "adv2", n: -1, duree: "tour" }, source),
    );
  const { etat: parLeMj, effet: duMj } = surAdv(MJ, "adv");
  assert.deepEqual([duMj.auteur, duMj.camp, duMj.rang], [null, "adv", null]);
  assert.deepEqual([parLeMj.effets[0].auteur, parLeMj.effets[0].camp], [null, "adv"], "la durée se dit du camp qui joue");

  const { effet: parLEtat } = surAdv({ genre: "etat", effet: 7 }, "pj", [durable({ id: 7, porteur: "adv3" })]);
  assert.deepEqual([parLEtat.auteur, parLEtat.camp], ["adv3", "adv"]);
  const etat = combat();
  const { effet: parLaCapacite } = surAdv(deCapacite(etat, "pj4", "Flambage"), "adv", [durable({ id: 7, porteur: "pj4" })]);
  assert.deepEqual([parLaCapacite.auteur, parLaCapacite.camp], ["pj4", "pj"]);
});

// ─── Le prix d'un passif ────────────────────────────────────────────────────

test("Un passif payant se paie quand l'effet s'applique, par son porteur", () => {
  const etat = avecGestes(combat(), geste());
  const nezFin = deCapacite(etat, "pj1", "Nez fin");
  assert.deepEqual(prixDuPassif(etat, nezFin), { souffle: 1, lien: 0, jauge: null, lienNonPaye: 0 });
  const { etat: apres, effet: fait } = appliquer(etat, effet("avantages", { nombre: 1 }, nezFin));
  assert.deepEqual(fait.prix, { souffle: 1, lien: 0, jauge: null, lienNonPaye: 0 });
  assert.equal(courantDe(apres, "pj1").souffle, 9);
  assert.equal(courantDe(etat, "pj1").souffle, 10, "l'état reçu ne change pas");

  // Le lien, sur la jauge du primordial.
  const braise = deCapacite(etat, "pj1", "Braise");
  const { etat: lie, effet: duLien } = appliquer(etat, effet("avantages", { nombre: 1 }, braise));
  assert.deepEqual(duLien.prix, { souffle: 0, lien: 1, jauge: 0, lienNonPaye: 0 });
  assert.equal(courantDe(lie, "pj1").liens[0].points, 0);
  const vide = avecGestes(combat({ retoucher: (brut) => (brut.protagonistes.pj1.liens[0].points = 0) }), geste());
  refuse(jugerEffet(vide, effet("avantages", { nombre: 1 }, braise)), "interdit", "Pas assez de lien : 1 demandé, 0 restant.");
  const essouffle = avecGestes(combat({ retoucher: (brut) => (brut.protagonistes.pj1.souffle = 0) }), geste());
  refuse(jugerEffet(essouffle, effet("avantages", { nombre: 1 }, nezFin)), "interdit", "Pas assez de souffle : 1 demandé, 0 restant.");
  refuse(jugerEffet(etat, effet("avantages", { nombre: 1 }, deCapacite(etat, "pj1", "Tour de main"))), "interdit", "Ce passif a un coût illisible dans la banque.");

  // Toute autre source ne coûte rien : une capacité active, un passif câblé, le MJ (le geste payé, où elles
  // s'appliquent).
  const paye = avecGestes(combat(), auBilan());
  for (const source of [deCapacite(etat, "pj1", "Flambage"), deCapacite(etat, "pj1", "Réduction"), MJ]) {
    assert.equal(prixDuPassif(etat, source), null);
    assert.equal(appliquer(paye, effet("ajouter", { n: 1 }, source)).effet.prix, null);
  }
});

test("Le X d'un passif se choisit avant « Appliquer » ; un adversaire ne paie jamais son lien", () => {
  const etat = avecGestes(combat(), geste());
  const minutie = deCapacite(etat, "pj1", "Minutie");
  const { etat: apres, effet: fait } = appliquer(etat, lu({ type: "effet", genre: "avantages", nombre: 3, source: minutie, x: 3 }));
  assert.deepEqual([fait.prix.souffle, fait.x, courantDe(apres, "pj1").souffle], [3, 3, 7]);
  refuse(jugerEffet(etat, lu({ type: "effet", genre: "avantages", nombre: 1, source: minutie, x: 11 })), "hors_bornes", "X ne va que de 0 à 10.");
  const nezFin = deCapacite(etat, "pj1", "Nez fin");
  refuse(jugerEffet(etat, lu({ type: "effet", genre: "avantages", nombre: 1, source: nezFin, x: 1 })), "hors_bornes", "Seul un passif au coût X prend un X.");
  // X à 0 : un passif payant, qui ne coûte rien.
  assert.deepEqual(prixDuPassif(etat, minutie, 0), { souffle: 0, lien: 0, jauge: null, lienNonPaye: 0 });

  // Le Marmiton attaque Aubépine, et flaire : 1 souffle payé, 2 de lien non payés.
  const adverse = avecGestes(combat({ camp: "adv" }), geste({ acteur: "adv2", cible: "pj1" }));
  const { etat: paye, effet: duMarmiton } = appliquer(adverse, effet("desavantages", { nombre: 1 }, deCapacite(adverse, "adv2", "Nez fin")));
  assert.deepEqual(duMarmiton.prix, { souffle: 1, lien: 0, jauge: null, lienNonPaye: 2 });
  assert.deepEqual([courantDe(paye, "adv2").souffle, duMarmiton.auteur, duMarmiton.camp], [4, "adv2", "adv"]);
});

test("Un passif sert une fois par jet, payant ou non ; un passif câblé, autant qu'on veut", () => {
  const etat = avecGestes(combat(), geste());
  const nezFin = deCapacite(etat, "pj1", "Nez fin");
  const { etat: apres } = appliquer(etat, effet("avantages", { nombre: 1 }, nezFin));
  assert.deepEqual(sommet(apres).passifs, [{ qui: "pj1", capacite: nezFin.capacite }]);
  refuse(jugerEffet(apres, effet("desavantages", { nombre: 1 }, nezFin)), "interdit", "Ce passif a déjà servi pour ce jet.");
  accepte(jugerEffet(apres, effet("desavantages", { nombre: 1 }, deCapacite(etat, "pj1", "Minutie"))), "un autre passif");

  const gratuit = deCapacite(etat, "pj1", "Maîtrise de l'agile");
  assert.equal(prixDuPassif(etat, gratuit), null);
  const { etat: servi } = appliquer(etat, effet("avantages", { nombre: 1 }, gratuit));
  refuse(jugerEffet(servi, effet("avantages", { nombre: 1 }, gratuit)), "interdit", "Ce passif a déjà servi pour ce jet.");

  // Un passif câblé n'est pas retenu : il s'applique, le geste payé, autant qu'on veut.
  const cable = deCapacite(etat, "pj1", "Réduction");
  const { etat: une } = appliquer(avecGestes(combat(), auBilan()), effet("ajouter", { n: 1 }, cable));
  assert.deepEqual(sommet(une).passifs, []);
  accepte(jugerEffet(une, effet("ajouter", { n: 1 }, cable)));

  // Hors d'un geste, il se paie, sans jet à retenir.
  const libre = combat({
    retoucher: (brut) => {
      brut.protagonistes.pj1.corps = 5;
      brut.effets.push(durable({ id: 7, porteur: "pj1" }));
    },
  });
  const { etat: soigne } = appliquer(libre, effet("rendre", { sur: "pj1", ressource: "corps", n: 1 }, nezFin));
  assert.deepEqual([courantDe(soigne, "pj1").souffle, courantDe(soigne, "pj1").corps, soigne.pile.length], [9, 6, 0]);
});

test("Le passif se lit à la puissance tenue : la plus haute qui ne passe pas son niveau", () => {
  const poivre = (niveau) =>
    combat({
      photoAubepine: aubepine((valeurs) => {
        valeurs.capacites.push(
          capaciteEssai({
            nom: "Poivre",
            niveau,
            evolue: true,
            groupe: SAUCIER,
            facons: [passive({ puissance: 1, cout: { souffle: 2, lien: 0 } }), faconEssai({ puissance: 2, cout: { souffle: 3, lien: 0 } })],
          }),
        );
      }),
    });
  const auNiveau1 = poivre(1);
  assert.equal(prixDuPassif(auNiveau1, deCapacite(auNiveau1, "pj1", "Poivre")).souffle, 2);
  const auNiveau2 = poivre(2);
  assert.equal(prixDuPassif(auNiveau2, deCapacite(auNiveau2, "pj1", "Poivre")), null, "actif à sa puissance 2 : ni passif ni prix");

  // Chez un adversaire, à son rang (choix 14) : la plus haute de ses façons jouables.
  const piment = (rang) =>
    combat({
      retoucher: (brut) =>
        brut.photos.adv2.capacites.push(
          capaciteEssai({
            nom: "Piment",
            niveau: rang,
            evolue: true,
            groupe: { genre: "capacites", titre: "Capacités" },
            facons: [passive({ puissance: 1, cout: { souffle: 2, lien: 0 } }), passive({ puissance: 2, cout: { souffle: 4, lien: 0 } })],
          }),
        ),
    });
  const auRang1 = piment(1);
  assert.equal(prixDuPassif(auRang1, deCapacite(auRang1, "adv2", "Piment")).souffle, 2, "au rang 1, la puissance 1");
  const auRang2 = piment(2);
  assert.equal(prixDuPassif(auRang2, deCapacite(auRang2, "adv2", "Piment")).souffle, 4, "au rang 2, la plus haute");
});

// ─── Les effets sur une cible ───────────────────────────────────────────────

test("Rendre, sans passer le maximum ; un mort ne se soigne pas", () => {
  const etat = combat({
    retoucher: (brut) => {
      const pj = brut.protagonistes.pj1;
      Object.assign(pj, { souffle: 6, corps: 4 });
      pj.zones[1].armure = 20;
      pj.zones[0].resistance = 2;
      pj.liens[0].points = 0;
    },
  });
  const rendre = (ressource, n, champs = {}) => appliquer(etat, effet("rendre", { sur: "pj1", ressource, n, ...champs }));
  const { etat: souffle, effet: fait } = rendre("souffle", 3);
  assert.deepEqual([fait.avant, fait.apres, courantDe(souffle, "pj1").souffle], [6, 9, 9]);
  assert.equal(courantDe(rendre("souffle", 10).etat, "pj1").souffle, 10, "borné au maximum");
  assert.equal(courantDe(rendre("corps", 3).etat, "pj1").corps, 7);
  assert.equal(courantDe(rendre("armure", 50, { zone: 1 }).etat, "pj1").zones[1].armure, 30);
  assert.equal(courantDe(rendre("endurance", 1, { zone: 0 }).etat, "pj1").zones[0].resistance, 3);
  assert.equal(courantDe(rendre("lien", 4, { jauge: 0 }).etat, "pj1").liens[0].points, 1);

  refuse(jugerEffet(etat, effet("rendre", { sur: "pj1", ressource: "armure", n: 1, zone: 0 })), "interdit", "Déjà au maximum.");
  refuse(jugerEffet(etat, effet("rendre", { sur: "pj1", ressource: "endurance", n: 1, zone: 6 })), "hors_bornes", "Cette zone n'existe pas.");
  refuse(jugerEffet(etat, effet("rendre", { sur: "adv2", ressource: "lien", n: 1, jauge: 0 })), "hors_bornes", "Cette jauge de lien n'existe pas.");
  const mort = combat({ retoucher: (brut) => Object.assign(brut.protagonistes.adv2, { corps: 0, mort: { tour: 1 } }) });
  refuse(jugerEffet(mort, effet("rendre", { sur: "adv2", ressource: "corps", n: 1 })), "interdit", "Ce protagoniste est mort ou retiré du combat.");

  // Pendant un geste : l'effet entre dans le geste.
  const { etat: dans } = appliquer(avecGestes(etat, auBilan()), effet("rendre", { sur: "pj1", ressource: "corps", n: 1 }));
  assert.deepEqual([sommet(dans).effets[0].apres, courantDe(dans, "pj1").corps], [5, 5]);
});

test("±N : « pour ce jet » dans le geste, avant tout dé ; « tour » et « combat » durables", () => {
  const prepare = avecGestes(combat(), geste());
  const { etat: duJet } = appliquer(prepare, effet("defense", { sur: "adv2", n: -2, duree: "jet" }, FRAPPE));
  assert.equal(duJet.effets.length, 0);
  assert.equal(defenseDe(duJet, "adv2", sommet(duJet)).valeur, 3, "valeurs.js la lit dans le geste");
  assert.equal(defenseDe(duJet, "adv2").valeur, 5);
  refuse(jugerEffet(combat(), effet("attaque", { sur: "adv2", n: 1, duree: "jet" })), "hors_moment", "Hors d'un geste.");
  refuse(jugerEffet(avecGestes(combat(), auBilan()), effet("attaque", { sur: "adv2", n: 1, duree: "jet" })), "hors_moment", "Un dé est déjà lancé.");

  const { etat: tour, effet: fait } = appliquer(combat(), effet("attaque", { sur: "adv2", n: 2, duree: "tour" }));
  assert.deepEqual(tour.effets[0], { id: 2, genre: "modif", porteur: "adv2", auteur: null, camp: "pj", duree: "tour", source: MJ, valeur: "attaque", n: 2 });
  assert.equal(fait.durable, 2);
  assert.equal(attaqueDe(tour, "adv2").valeur, 6);
  const { etat: combatEntier } = appliquer(combat(), effet("defense", { sur: "pj1", n: 1, duree: "combat" }));
  assert.deepEqual(
    effetsDurablesDe(combatEntier, "pj1").map(({ genre, valeur, n, duree }) => [genre, valeur, n, duree]),
    [["modif", "defense", 1, "combat"]],
  );
});

// Le journal lit dans l'effet la valeur d'un adversaire avant et après un ±N
// appliqué pendant un geste : sans elles, il écrivait « ? → ? ».
test("±N sur un adversaire, pendant un geste : l'effet rendu porte sa valeur avant et après, lue avec le geste ; l'effet durable posé ne la porte pas ; rien pour un personnage, ni hors d'un geste", () => {
  const prepare = avecGestes(combat(), geste());
  const { etat: duJet, effet: premier } = appliquer(prepare, effet("defense", { sur: "adv2", n: -2, duree: "jet" }, FRAPPE));
  assert.deepEqual([premier.avant, premier.apres], [5, 3], "pour ce jet");
  const { effet: second } = appliquer(duJet, effet("defense", { sur: "adv2", n: -1, duree: "jet" }, FRAPPE));
  assert.deepEqual([second.avant, second.apres], [3, 2], "le second part de la valeur que le premier a écartée, dans le geste");
  assert.deepEqual(sommet(duJet).effets.map(({ avant, apres }) => [avant, apres]), [[5, 3]], "le geste garde l'effet tel que rendu");

  const { etat: tour, effet: fait } = appliquer(avecGestes(combat(), auxSuites()), effet("attaque", { sur: "adv2", n: 2, duree: "tour" }));
  assert.deepEqual([fait.avant, fait.apres, fait.durable], [4, 6, 2], "durée « tour »");
  const pose = effetsDurablesDe(tour, "adv2")[0];
  assert.deepEqual([Object.hasOwn(pose, "avant"), Object.hasOwn(pose, "apres")], [false, false], "l'effet durable « modif » ne les porte pas");
  const chef = attaqueDe(combat(), "adv3").valeur;
  const { effet: entier } = appliquer(avecGestes(combat(), auxSuites()), effet("attaque", { sur: "adv3", n: -1, duree: "combat" }));
  assert.deepEqual([entier.avant, entier.apres], [chef, chef - 1], "durée « combat »");

  // Un durable se lit sans les ±N « pour ce jet » du geste : son échéance
  // rendra la valeur sans eux (contrat du lot 4.3, choix 24).
  const garde = avecGestes(combat(), auxSuites({ effets: [premier] }));
  assert.equal(defenseDe(garde, "adv2", sommet(garde)).valeur, 3, "le geste garde son −2 pour ce jet");
  const { effet: durableSurJet } = appliquer(garde, effet("defense", { sur: "adv2", n: -1, duree: "tour" }));
  assert.deepEqual([durableSurJet.avant, durableSurJet.apres], [5, 4], "un durable sur une valeur déjà écartée pour ce jet");

  const { effet: horsGeste } = appliquer(combat(), effet("defense", { sur: "adv2", n: 1, duree: "tour" }));
  assert.deepEqual([Object.hasOwn(horsGeste, "avant"), Object.hasOwn(horsGeste, "apres")], [false, false], "hors d'un geste, le journal les lit sur l'état d'avant et d'après");

  for (const duree of ["jet", "tour"]) {
    const ou = duree === "jet" ? prepare : avecGestes(combat(), auxSuites());
    const { effet: surPj } = appliquer(ou, effet("defense", { sur: "pj1", n: -1, duree }, duree === "jet" ? FRAPPE : MJ));
    assert.deepEqual([Object.hasOwn(surPj, "avant"), Object.hasOwn(surPj, "apres")], [false, false], `un personnage, « ${duree} »`);
  }
});

test("Un état : une capacité figée ou un nom libre, durable, ou pour ce jet", () => {
  const etourdi = etatsEssai().blocs[1].capacites[0];
  const { etat: pose, effet: fait } = appliquer(combat(), effet("etat", { sur: "adv2", capacite: etourdi, duree: "tour" }));
  const [durableEtat] = pose.effets;
  assert.deepEqual(
    [durableEtat.genre, durableEtat.porteur, durableEtat.capacite.nom, durableEtat.libre, durableEtat.blessure, durableEtat.duree, fait.durable],
    ["etat", "adv2", "Étourdi", null, false, "tour", 2],
  );
  const { etat: libre } = appliquer(combat(), effet("etat", { sur: "pj1", libre: "Couvert de farine", duree: "combat" }));
  assert.deepEqual([libre.effets[0].libre, libre.effets[0].capacite], ["Couvert de farine", null]);

  const { etat: duJet } = appliquer(avecGestes(combat(), geste()), effet("etat", { sur: "adv2", libre: "Ébloui", duree: "jet" }, FRAPPE));
  assert.deepEqual([duJet.effets.length, sommet(duJet).effets[0].libre], [0, "Ébloui"]);
  refuse(jugerEffet(combat(), effet("etat", { sur: "pj9", libre: "Ébloui", duree: "tour" })), "hors_bornes", "Ce protagoniste n'est pas dans le combat.");
});

test("Déplacer, sans action, vers une autre case", () => {
  const { etat: apres, effet: fait } = appliquer(combat(), effet("deplacer", { sur: "pj1", vers: "E5" }));
  assert.deepEqual([courantDe(apres, "pj1").case, fait.depart, courantDe(apres, "pj1").actions], ["E5", "D4", 2]);
  refuse(jugerEffet(combat(), effet("deplacer", { sur: "pj1", vers: "D4" })), "interdit", "Ce protagoniste est déjà sur cette case.");
});

// ─── Le MJ ──────────────────────────────────────────────────────────────────

test("Le MJ entre deux gestes, sur un vivant présent", () => {
  const valeur = mj("valeurs", "adv2", { valeurs: [{ champ: "attaque", valeur: 6 }] });
  refuse(jugerMj(avecGestes(combat(), geste()), valeur), "hors_moment", "Le geste en cours se finit d'abord.");
  refuse(jugerMj(ouvrirCombat(miseEnPlaceEssai([{ photo: aubepine() }, { photo: marmiton() }])), valeur), "hors_moment", "Le combat n'est pas lancé.");
  refuse(jugerMj(combat(), mj("retirer", "adv9")), "hors_bornes", "Ce protagoniste n'est pas dans le combat.");
  const mort = combat({ retoucher: (brut) => Object.assign(brut.protagonistes.adv2, { corps: 0, mort: { tour: 1 } }) });
  refuse(jugerMj(mort, valeur), "interdit", "Ce protagoniste est mort ou retiré du combat.");
});

test("Le MJ change une valeur : ses bornes, et un maximum entraîne la valeur", () => {
  const etat = combat();
  const valeurs = (qui, ...liste) => mj("valeurs", qui, { valeurs: liste });
  assert.equal(courantDe(appliquerLeMj(etat, valeurs("adv2", { champ: "attaque", valeur: 6 })), "adv2").attaque, 6);
  refuse(jugerMj(etat, valeurs("pj1", { champ: "defense", valeur: 6 })), "hors_bornes", "L'attaque et la défense sont celles d'un adversaire.");

  const moins = courantDe(appliquerLeMj(etat, valeurs("pj1", { champ: "souffleMax", valeur: 4 }, { champ: "actionsMax", valeur: 1 })), "pj1");
  assert.deepEqual([moins.souffleMax, moins.souffle, moins.actionsMax, moins.actions], [4, 4, 1, 1]);
  const plus = courantDe(appliquerLeMj(etat, valeurs("pj1", { champ: "souffleMax", valeur: 12 })), "pj1");
  assert.deepEqual([plus.souffleMax, plus.souffle], [12, 10]);

  const zones = courantDe(appliquerLeMj(etat, valeurs("pj1", { champ: "armure", zone: 1, valeur: 5 }, { champ: "endurance", zone: 0, valeur: 0 }, { champ: "corps", valeur: 0 })), "pj1");
  assert.deepEqual([zones.zones[1].armure, zones.zones[0].resistance, zones.corps], [5, 0, 0]);
  refuse(jugerMj(etat, valeurs("pj1", { champ: "armure", zone: 6, valeur: 5 })), "hors_bornes", "Cette zone n'existe pas.");

  const sansLien = combat({ retoucher: (brut) => (brut.protagonistes.pj1.liens[0].points = 0) });
  assert.equal(courantDe(appliquerLeMj(sansLien, valeurs("pj1", { champ: "lien", jauge: 0, valeur: 1 })), "pj1").liens[0].points, 1);
  refuse(jugerMj(sansLien, valeurs("pj1", { champ: "lien", jauge: 1, valeur: 0 })), "hors_bornes", "Cette jauge de lien n'existe pas.");

  // Aucune valeur n'est bornée par son maximum, le lien compris : le MJ décide (choix 16). « Rendre », lui, l'est.
  const audela = appliquerLeMj(
    etat,
    valeurs("pj1", { champ: "souffle", valeur: 15 }, { champ: "corps", valeur: 14 }, { champ: "lien", jauge: 0, valeur: 3 }, { champ: "armure", zone: 1, valeur: 35 }, { champ: "actions", valeur: 4 }),
  );
  const fort = courantDe(audela, "pj1");
  assert.deepEqual(
    [fort.souffle, fort.souffleMax, fort.corps, fort.corpsMax, fort.liens[0].points, fort.liens[0].max, fort.zones[1].armure, fort.zones[1].armureMax, fort.actions, fort.actionsMax],
    [15, 10, 14, 10, 3, 1, 35, 30, 4, 2],
  );
  refuse(jugerEffet(audela, effet("rendre", { sur: "pj1", ressource: "souffle", n: 1 })), "interdit", "Déjà au maximum.");
  refuse(jugerEffet(audela, effet("rendre", { sur: "pj1", ressource: "lien", n: 1, jauge: 0 })), "interdit", "Déjà au maximum.");

  // La défense du bouclier : Aubépine porte le couvercle de marmite (8).
  assert.equal(courantDe(appliquerLeMj(etat, valeurs("pj1", { champ: "bouclier", valeur: 10 })), "pj1").bouclier, 10);
  refuse(jugerMj(etat, valeurs("pj1", { champ: "bouclier", valeur: 8 })), "interdit", "Aucune valeur ne change.");
  refuse(jugerMj(etat, valeurs("adv2", { champ: "bouclier", valeur: 8 })), "hors_bornes", "Ce protagoniste n'a pas de bouclier.");
  refuse(jugerMj(etat, valeurs("pj1", { champ: "souffle", valeur: 10 }, { champ: "corps", valeur: 10 })), "interdit", "Aucune valeur ne change.");
  accepte(jugerMj(etat, valeurs("pj1", { champ: "souffle", valeur: 10 }, { champ: "corps", valeur: 9 })), "une valeur sur deux change");
});

test("Le MJ change l'équipement : l'armure garde ses dégâts, les blessures suivent leur nouvel indice", () => {
  const mainBrulee = etatsEssai().blessure[1];
  const etat = combat({
    retoucher: (brut) => {
      const pj = brut.protagonistes.pj1;
      pj.zones[1].armure = 20;
      pj.bouclier = 10;
      pj.souffle = 3;
      brut.photos.pj1.capacites.push(structuredClone(mainBrulee));
      brut.effets.push(
        durable({ id: 7, porteur: "pj1", auteur: "pj1", libre: null, capacite: null, blessure: true, zone: 1, duree: "combat", source: { genre: "capacite", qui: "pj1", capacite: 21 } }),
        durable({ id: 8, porteur: "pj1", auteur: "pj1", genre: "modif", valeur: "defense", n: 1, source: { genre: "capacite", qui: "pj1", capacite: 21 } }),
      );
    },
  });
  assert.equal(photoDe(etat, "pj1").capacites[21].nom, "Main brûlée");
  // La photographie recalculée : le torse à 40, sans « Boire le bouillon ».
  const neuve = aubepine((valeurs) => {
    valeurs.zones[1].armure = 40;
    valeurs.capacites = valeurs.capacites.filter((capacite) => capacite.nom !== "Boire le bouillon");
  }).valeurs;
  const evenement = mj("equipement", "pj1", { photo: neuve, changements: [{ genre: "qualite", objet: "Tablier", avant: "1", apres: "2" }] });
  const apres = appliquerLeMj(etat, evenement);
  const pj = courantDe(apres, "pj1");
  assert.deepEqual([pj.zones[1].armure, pj.zones[1].armureMax, pj.zones[0].armure, pj.souffle, pj.bouclier], [30, 40, 6, 3, null]);
  const capacites = photoDe(apres, "pj1").capacites;
  assert.deepEqual([capacites.length, capacites[20].nom], [21, "Main brûlée"]);
  assert.deepEqual(apres.effets.map((un) => un.source.capacite), [20, 20]);
  assert.equal(apres.effets[0].zone, 1, "la blessure garde sa zone (choix 18)");

  // Un adversaire : son attaque et sa défense suivent la photographie.
  const commis = adversaireEssai((valeurs) => Object.assign(valeurs, { attaque: 6, defense: 3 })).valeurs;
  const adv = courantDe(appliquerLeMj(combat(), mj("equipement", "adv2", { photo: commis, changements: [{ genre: "cellule", noms: ["Louche"] }] })), "adv2");
  assert.deepEqual([adv.attaque, adv.defense], [6, 3]);

  refuse(jugerMj(etat, mj("equipement", "pj1", { photo: brioche().valeurs, changements: [{ genre: "arme", nom: null }] })), "hors_bornes", "Cette photographie n'est pas celle de ce protagoniste.");
  const cinqZones = adversaireEssai((valeurs) => {
    valeurs.zones = valeurs.zones.slice(0, 5);
    valeurs.zones[4].fin = 20;
  }).valeurs;
  refuse(jugerMj(combat(), mj("equipement", "adv2", { photo: cinqZones, changements: [{ genre: "arme", nom: "Louche" }] })), "hors_bornes", "Cette photographie n'a pas le même nombre de zones.");

  // Deux cents capacités, puis Main brûlée remise au bout : au-delà des bornes, refusé (choix 20).
  const pleine = aubepine((valeurs) => {
    while (valeurs.capacites.length < 200) valeurs.capacites.push(capaciteEssai({ nom: `Recette ${valeurs.capacites.length}`, groupe: SAUCIER, facons: [faconEssai({ description: "Une recette." })] }));
  }).valeurs;
  const changements = [{ genre: "qualite", objet: "Tablier", avant: "1", apres: "2" }];
  refuse(jugerMj(etat, mj("equipement", "pj1", { photo: pleine, changements })), "interdit", "La photographie compterait plus de 200 capacités.");
  accepte(jugerMj(combat(), mj("equipement", "pj1", { photo: pleine, changements })), "sans blessure, deux cents tiennent");
});

test("Une photographie ne passe jamais ses bornes : deux cents capacités, six cents façons (choix 20)", () => {
  const capacites = (nombre, facons = 1) => Array.from({ length: nombre }, () => ({ facons: Array.from({ length: facons }, () => ({})) }));
  assert.equal(horsDesBornesDeLaPhoto(capacites(200)), null);
  assert.equal(horsDesBornesDeLaPhoto(capacites(201)), "La photographie compterait plus de 200 capacités.");
  assert.equal(horsDesBornesDeLaPhoto(capacites(30, 20)), null);
  assert.equal(horsDesBornesDeLaPhoto([...capacites(30, 20), ...capacites(1)]), "La photographie compterait plus de 600 façons.");
});

test("Le MJ change l'équipement : les effets durables et les gardes suivent leur capacité, par son nom ; ce qui disparaît s'en va (choix 17)", () => {
  const ici = combat();
  const n = (nom) => indiceDe(ici, "pj1", nom);
  const guet = (id, garde) => ({ id, genre: "guet", porteur: "pj1", auteur: "pj1", camp: "pj", duree: "tour", source: { genre: "capacite", qui: "pj1", capacite: n("Guetter") }, garde });
  const duMarmiton = durable({ id: 7, porteur: "pj1", auteur: "adv2", camp: "adv", source: { genre: "capacite", qui: "adv2", capacite: 0 } });
  const etat = combat({
    retoucher: (brut) =>
      brut.effets.push(
        durable({ id: 3, genre: "modif", valeur: "defense", n: -1, source: { genre: "capacite", qui: "pj1", capacite: n("Minutie") } }),
        durable({ id: 4, genre: "modif", porteur: "pj1", valeur: "attaque", n: 1, source: { genre: "capacite", qui: "pj1", capacite: n("Boire le bouillon") } }),
        guet(5, { capacite: n("Taloche"), facon: 0 }),
        guet(6, { capacite: n("Flambage"), facon: 0 }),
        duMarmiton,
      ),
  });
  // La photographie neuve : sans « Boire le bouillon » ; Flambage, ses deux puissances dans l'autre ordre.
  const neuve = aubepine((valeurs) => {
    valeurs.capacites = valeurs.capacites.filter((capacite) => capacite.nom !== "Boire le bouillon");
    valeurs.capacites.find((capacite) => capacite.nom === "Flambage").facons.reverse();
  }).valeurs;
  const changements = [{ genre: "qualite", objet: "Tablier", avant: "1", apres: "2" }];
  const apres = appliquerLeMj(etat, mj("equipement", "pj1", { photo: neuve, changements }));
  const nouveau = (nom) => indiceDe(apres, "pj1", nom);
  const lire = (un) => [un.id, un.source.capacite, un.garde ? `${un.garde.capacite}.${un.garde.facon}` : null];
  assert.deepEqual(apres.effets.map(lire), [
    [3, nouveau("Minutie"), null],
    [5, nouveau("Guetter"), `${nouveau("Taloche")}.0`],
    [6, nouveau("Guetter"), `${nouveau("Flambage")}.1`],
    [7, 0, null],
  ]);
  assert.deepEqual([n("Minutie"), nouveau("Minutie"), n("Taloche"), nouveau("Taloche")], [18, 17, 15, 14], "décalées d'un cran");
  assert.ok(apres.effets[3] === duMarmiton, "la source d'un autre ne change pas : l'objet même");
  assert.equal(photoDe(apres, "pj1").capacites[nouveau("Flambage")].facons[1].puissance, 1, "la façon gardée : la même puissance");
  assert.ok(gardeJouable(apres, "pj1", nouveau("Taloche"), 0) === apres.effets[1]);

  // La façon gardée disparaît (Flambage à sa seule puissance 2) : sa garde s'en va ; Guetter disparu, les deux.
  const sansUne = aubepine((valeurs) => {
    const flambage = valeurs.capacites.find((capacite) => capacite.nom === "Flambage");
    flambage.facons = flambage.facons.filter((facon) => facon.puissance === 2);
  }).valeurs;
  assert.deepEqual(appliquerLeMj(etat, mj("equipement", "pj1", { photo: sansUne, changements })).effets.map((un) => un.id), [3, 4, 5, 7]);
  const sansGuetter = aubepine((valeurs) => (valeurs.capacites = valeurs.capacites.filter((capacite) => capacite.nom !== "Guetter"))).valeurs;
  assert.deepEqual(appliquerLeMj(etat, mj("equipement", "pj1", { photo: sansGuetter, changements })).effets.map((un) => un.id), [3, 4, 7]);
});

test("Le MJ ajoute et retire un état, déplace, retire du combat", () => {
  const etourdi = etatsEssai().blocs[1].capacites[0];
  const ajoute = appliquerLeMj(combat({ camp: "adv" }), mj("etat", "pj1", { ajout: { capacite: etourdi, duree: "tour" } }));
  const [pose] = ajoute.effets;
  assert.deepEqual(
    [pose.id, pose.genre, pose.porteur, pose.auteur, pose.camp, pose.duree, pose.source, pose.capacite.nom, pose.blessure],
    [2, "etat", "pj1", null, "adv", "tour", MJ, "Étourdi", false],
  );

  const porte = combat({ retoucher: (brut) => brut.effets.push(durable({ id: 7, porteur: "adv2" }), durable({ id: 8, porteur: "adv2", blessure: true, duree: "combat" })) });
  assert.deepEqual(appliquerLeMj(porte, mj("etat", "adv2", { retrait: 8 })).effets.map((un) => un.id), [7]);
  refuse(jugerMj(porte, mj("etat", "pj1", { retrait: 7 })), "hors_bornes", "Cet état n'est pas porté par ce protagoniste.");
  refuse(jugerMj(porte, mj("etat", "adv2", { retrait: 9 })), "hors_bornes", "Cet état n'est pas porté par ce protagoniste.");

  assert.equal(courantDe(appliquerLeMj(combat(), mj("deplacer", "adv3", { vers: "J10" })), "adv3").case, "J10");
  refuse(jugerMj(combat(), mj("deplacer", "adv3", { vers: "D4" })), "interdit", "Ce protagoniste est déjà sur cette case.");

  const auteurs = combat({ retoucher: (brut) => brut.effets.push(durable({ id: 7, porteur: "adv2" }), durable({ id: 8, porteur: "pj1", auteur: "adv2" })) });
  const retire = appliquerLeMj(auteurs, mj("retirer", "adv2"));
  assert.deepEqual([courantDe(retire, "adv2").retire, vivant(retire, "adv2")], [true, false]);
  assert.deepEqual(retire.effets.map((un) => un.id), [8], "ses effets s'en vont ; ceux dont il est l'auteur restent");
  refuse(jugerMj(retire, mj("retirer", "adv2")), "interdit", "Ce protagoniste est mort ou retiré du combat.");
});

// ─── Les effets durables ────────────────────────────────────────────────────

test("L'échéance : au prochain tour du camp de l'auteur, les effets « tour » de ce camp s'en vont, dans l'ordre", () => {
  const etat = combat({
    retoucher: (brut) =>
      brut.effets.push(
        durable({ id: 3, genre: "modif", valeur: "attaque", n: 1, libre: undefined }),
        durable({ id: 4, duree: "combat" }),
        durable({ id: 5, camp: "adv", auteur: "adv2" }),
        durable({ id: 6, genre: "guet", porteur: "pj1", garde: { capacite: 3, facon: 0 } }),
      ),
  });
  const { etat: apres, parties } = echeances(etat, "pj");
  assert.deepEqual(parties.map((un) => un.id), [3, 6]);
  assert.deepEqual(apres.effets.map((un) => un.id), [4, 5], "« combat » ne finit jamais ; l'autre camp attend son tour");
  const { etat: rien, parties: aucune } = echeances(geler(apres), "pj");
  assert.ok(rien === apres, "rien ne part : l'objet même");
  assert.deepEqual(aucune, []);
  assert.deepEqual(echeances(apres, "adv").parties.map((un) => un.id), [5]);
});

test("Les effets d'un mort ou d'un retiré s'en vont", () => {
  const etat = combat({
    retoucher: (brut) => {
      Object.assign(brut.protagonistes.adv2, { corps: 0, mort: { tour: 1 } });
      brut.protagonistes.pj4.retire = true;
      brut.effets.push(durable({ id: 3, porteur: "adv2" }), durable({ id: 4, porteur: "pj1", auteur: "adv2" }), durable({ id: 5, porteur: "pj4" }));
    },
  });
  assert.deepEqual(sansEffetsDesAbsents(etat).effets.map((un) => un.id), [4]);
  const vivants = combat({ retoucher: (brut) => brut.effets.push(durable({ id: 3, porteur: "adv2" })) });
  assert.ok(sansEffetsDesAbsents(vivants) === vivants, "aucun absent : l'objet même");
});

test("La garde jouable : la ligne gardée par un « guet » de son porteur", () => {
  const etat = combat({ retoucher: (brut) => brut.effets.push(durable({ id: 3, genre: "guet", porteur: "pj1", garde: { capacite: 3, facon: 1 } })) });
  assert.ok(gardeJouable(etat, "pj1", 3, 1) === etat.effets[0]);
  assert.equal(gardeJouable(etat, "pj1", 3, 0), null, "une autre façon");
  assert.equal(gardeJouable(etat, "pj1", 1, 0), null, "une autre capacité");
  assert.equal(gardeJouable(etat, "pj4", 3, 1), null, "un autre porteur");
  const disparue = combat({ retoucher: (brut) => brut.effets.push(durable({ id: 3, genre: "guet", porteur: "pj1", garde: { capacite: 99, facon: 0 } })) });
  assert.equal(gardeJouable(disparue, "pj1", 99, 0), null, "une ligne qui n'existe pas");
});
