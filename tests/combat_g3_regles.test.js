// Contrôles des règles fines que le moteur joue au lot 4.3 (SPECIFICATION.md,
// § 17 « Le simulateur de combat (lot 4) » ; mission du lot 4.3, § 4.2,
// § 4.4, § 4.6, § 4.10 ; contrat de la vague 1, § 3, § 4.1, § 5.5, § 5.9,
// § 6.2) : js/combat/moteur.js et js/combat/offre.js.
//
// Le coup critique, qui s'offre à la fin d'un jet à trois réussites et se
// garde ou se tente ; attendre, qui garde une ligne jusqu'au prochain tour du
// camp de son auteur ; une attaque en plus, qui se joue sans action ; la
// blessure, une zone sans endurance qui perd du corps, que le personnage
// choisit. Puis un combat qui use de tout cela, rejoué à l'identique. Et les
// choix de l'agent principal (contrat, § 12) que le moteur joue : la
// préparation d'un geste et le prix rendu quand il est retiré (11), un passif
// une fois par jet (15), une blessure dans les bornes de la photographie
// (20) ; l'esquive qui suit la victime.
//
// Chaque règle est vue dans les deux sens : le critique offert et celui qui ne
// l'est pas, la garde jouée et son échéance, l'attaque en plus consommée et
// celle qui expire, la blessure qui vient et celle qui ne vient pas. Les
// protagonistes sont ceux de tests/outils/photographies_essai.js : « Aubépine »
// (le PJ rond, un d8, armure 10 et endurance 5 partout, corps 10), à qui l'on
// ajoute Guetter (attendre), et « Marmiton » (défense 5, attaque 4). Les états
// se comparent par leurs valeurs, jamais en entier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { degatsFixes } from "../js/combat/degats.js";
import { validerEvenement } from "../js/combat/forme.js";
import { appliquer, gesteEnCours, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import { refusDeLaBlessure } from "../js/combat/effets.js";
import { annulation, boutons, candidats, offre } from "../js/combat/offre.js";
import { REGLES } from "../js/combat/regles.js";
import { adversaireEssai, capaciteEssai, chefDePartieEssai, etatsEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-26T21:30" };
const APPLIQUER = { type: "appliquer" };
const CONFIRMER = { type: "confirmer" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const REVENIR = { type: "revenir" };
const ANNULER = { type: "annuler" };
const GARDER = { type: "critique", tenter: false };
const TENTER = { type: "critique", tenter: true };

const guetter = () =>
  capaciteEssai({ nom: "Guetter", role: "attendre", groupe: { genre: "base", titre: "Gestes de cuisine" }, facons: [faconEssai({ description: "Une capacité se joue en intervention." })] });
const dressage = () =>
  capaciteEssai({ nom: "Dressage minute", groupe: { genre: "archetype", titre: "Saucier" }, facons: [faconEssai({ description: "Sert un allié.", elements: ["Intervention"], intervention: true })] });

// Aubépine : 0 Frappe, 1 Émincer, 2 Flambage, 3 Fournaise, 4 Pas chassé, 5 Goûter, 6 Taloche, 7 Pas de côté, 8 Guetter.
const AUBEPINE = pjEssai((champs) => champs.capacites.push(guetter()));
const MARMITON = adversaireEssai();
const { blessure: BLOC_DE_BLESSURE } = etatsEssai();
const MAIN_BRULEE = BLOC_DE_BLESSURE.find((capacite) => capacite.nom === "Main brûlée");

const surD4 = (...photos) => photos.map((photo) => ({ photo, case: "D4" }));

/** Applique des événements à la suite ; un refus fait échouer le contrôle, avec sa phrase. */
function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements.flat()) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

const combat = (protagonistes, options) => jouer(ouvrirCombat(miseEnPlaceEssai(protagonistes, options)), LANCER);

function refuse(etat, evenement, code, message = null) {
  const rendu = appliquer(etat, evenement);
  assert.notEqual(rendu.refus, undefined, `${JSON.stringify(evenement)} aurait dû être refusé`);
  assert.ok(rendu.etat === etat, "un refus rend l'état reçu, l'objet même");
  assert.equal(rendu.refus.code, code, rendu.refus.message);
  if (message !== null) assert.equal(rendu.refus.message, message);
}

const indice = (etat, qui, nom) => etat.photos[qui].capacites.findIndex((une) => une.nom === nom);
const capacite = (etat, qui, nom, facon = 0) => ({ type: "capacite", qui, capacite: indice(etat, qui, nom), facon });
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });
const ajuste = (valeur, nature = "normaux") => ({ type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur, raison: "Coup de feu" }], nature });

// ─── Le coup critique ───────────────────────────────────────────────────────

test("le critique : à trois réussites, avec une relance, l'étape s'offre ; garder, ou tenter le quatrième dé", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const prete = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), regler("avantages", 1, "Minutie"));
  const trois = jouer(prete, d8(8), d8(8), d8(8));
  assert.equal(gesteEnCours(trois).moment, "critique");
  assert.equal(offre(trois).critique, true);
  assert.deepEqual(offre(trois).types, ["critique", "effet"]);
  assert.equal(offre(trois).de, null);
  refuse(trois, APPLIQUER, "hors_moment");
  refuse(trois, d20(5), "hors_moment");

  // Garder : C = 15, le bilan.
  const garde = jouer(trois, GARDER);
  assert.deepEqual([gesteEnCours(garde).moment, gesteEnCours(garde).critique, gesteEnCours(garde).jet.critique], ["bilan", "garde", "garde"]);
  assert.equal(degatsFixes(garde, gesteEnCours(garde)).valeur, 15);
  refuse(garde, TENTER, "hors_moment");

  // Tenter : une relance dépensée, le quatrième dé attendu.
  const tente = jouer(trois, TENTER);
  assert.deepEqual([gesteEnCours(tente).moment, gesteEnCours(tente).critique], ["jet", "tente"]);
  assert.deepEqual(offre(tente).de, { faces: 8, combien: 1, motif: "chaine", place: 4 });
  // Réussi : un coup critique, C = 15 → 30.
  const reussi = jouer(tente, d8(8));
  assert.equal(gesteEnCours(reussi).moment, "bilan");
  const fixes = degatsFixes(reussi, gesteEnCours(reussi));
  assert.deepEqual([fixes.critique, fixes.valeur], [true, 30]);
  const tue = jouer(reussi, d20(5), APPLIQUER);
  assert.equal(tue.protagonistes.adv2.corps, 0);
  // Raté, sans relance pour le reprendre : C = 15, sans critique.
  const rate = jouer(tente, d8(1));
  assert.equal(gesteEnCours(rate).moment, "bilan");
  const sansCritique = degatsFixes(rate, gesteEnCours(rate));
  assert.deepEqual([sansCritique.critique, sansCritique.valeur], [false, 15]);
});

test("le critique ne s'offre pas sans relance, ni en défense ; un jet de caractéristique le garde ou le tente, puis attend « Appliquer »", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  // Sans avantage, aucune relance : trois réussites mènent droit au bilan.
  const sansRelance = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(8), d8(8));
  assert.equal(gesteEnCours(sansRelance).moment, "bilan");
  // En défense, jamais : le Marmiton attaque, Aubépine pare à trois réussites, avec un avantage à la main.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const pare = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), regler("avantages", 1, "Minutie"), d8(8), d8(8), d8(8));
  assert.equal(gesteEnCours(pare).moment, "suites", "aucune lettre : l'attaque est parée");
  assert.equal(offre(pare).critique, false);

  // Un jet de caractéristique : garder, puis « Appliquer » (« Terminer »).
  const gouter = jouer(depart, capacite(depart, "pj1", "Goûter"), regler("caracteristiques", ["sens", "parole"]), regler("difficulte", 6), regler("avantages", 1, "Minutie"));
  const critique = jouer(gouter, d8(7), d8(7), d8(7));
  assert.equal(gesteEnCours(critique).moment, "critique");
  const garde = jouer(critique, GARDER);
  assert.equal(gesteEnCours(garde).moment, "suites");
  assert.deepEqual(jouer(garde, APPLIQUER).pile, []);
  const tente = jouer(critique, TENTER, d8(7));
  assert.equal(gesteEnCours(tente).moment, "suites");
  assert.equal(gesteEnCours(tente).jet.places.length, 4);
});

// ─── Le moment qui se relit ─────────────────────────────────────────────────

const MJ = { genre: "mj" };

test("un jet ne clôt pas le geste : la palette peut encore changer le dernier dé, et le moment se relit d'après le jet", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  // Un manqué attend aux suites : « +1 réussite » le fait toucher, le bilan s'ouvre avec ses dégâts.
  const manque = jouer(frappe, d8(1));
  assert.equal(gesteEnCours(manque).moment, "suites");
  const touche = jouer(manque, { type: "effet", genre: "reussite", source: MJ });
  assert.equal(gesteEnCours(touche).moment, "bilan");
  assert.deepEqual(gesteEnCours(touche).degats, { base: "lettre", operations: [], nature: "normaux" });
  // Relancé par la palette : le jet rouvert attend le dé de la relance, ses dégâts retombés.
  const relance = jouer(manque, { type: "effet", genre: "relancer", source: MJ });
  assert.deepEqual([gesteEnCours(relance).moment, gesteEnCours(relance).degats], ["jet", null]);
  assert.equal(offre(relance).de.motif, "relance");
  // Au bilan de même : un touché que l'on relance retourne au jet ; relancé en échec, il revient aux suites.
  const bilan = jouer(frappe, d8(8), d8(1));
  assert.equal(gesteEnCours(bilan).moment, "bilan");
  const rouvert = jouer(bilan, { type: "effet", genre: "relancer", source: MJ });
  assert.deepEqual([gesteEnCours(rouvert).moment, gesteEnCours(rouvert).degats], ["jet", null]);
  assert.equal(gesteEnCours(jouer(rouvert, d8(8), d8(1))).moment, "bilan");
  // Inversé, un 8 devient un 1 : la chaîne s'arrête, aucune réussite, les suites.
  const unSeul = jouer(frappe, d8(8));
  const inverse = jouer(unSeul, { type: "effet", genre: "inverser", source: MJ });
  assert.equal(gesteEnCours(inverse).moment, "suites");
  // Après le premier d20, plus rien ne se relit.
  const localise = jouer(bilan, d20(5));
  assert.equal(gesteEnCours(localise).moment, "suites");
  refuse(localise, { type: "effet", genre: "relancer", source: MJ }, "hors_moment");
});

test("un effet avant le premier dé engage le geste : l'annulation le défait avec lui", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const prepare = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  // Avant le paiement, la source est la capacité jouée (choix 11) : la Frappe d'Aubépine.
  const avecEffet = jouer(prepare, { type: "effet", genre: "avantages", nombre: 1, source: { genre: "capacite", qui: "pj1", capacite: 0 } });
  assert.notEqual(avecEffet.annulation.attente, null, "l'état d'avant le geste est mis de côté");
  assert.equal(avecEffet.annulation.debut, depart.journal.length);
  const fini = jouer(avecEffet, d8(1), { type: "garder" }, APPLIQUER);
  assert.deepEqual(annulation(fini).quoi.geste.effets.map((effet) => effet.genre), ["avantages"]);
  const annule = jouer(fini, { type: "annuler" });
  assert.ok(annule.protagonistes === depart.protagonistes, "l'état d'avant le geste, l'objet même");
  assert.deepEqual(annule.journal.at(-1).barre, [depart.journal.length, fini.journal.length]);
});

test("un geste du MJ et un effet hors d'un geste : chacun sa ligne et son maillon ; un corps mis à 0 tue, et la fin du combat se juge", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const reduit = jouer(depart, { type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "souffle", valeur: 3 }] });
  assert.equal(reduit.protagonistes.pj1.souffle, 3);
  assert.deepEqual([reduit.journal.length, annulation(reduit).quoi.genre], [depart.journal.length + 1, "mj"]);
  const rendu = jouer(reduit, { type: "effet", genre: "rendre", source: MJ, sur: "pj1", ressource: "souffle", n: 2 });
  assert.equal(rendu.protagonistes.pj1.souffle, 5);
  assert.equal(rendu.journal.length, reduit.journal.length + 1);
  const { quoi } = annulation(rendu);
  assert.deepEqual([quoi.genre, quoi.effet.genre, quoi.effet.n], ["effet", "rendre", 2]);
  // Chacun se défait seul, dans l'ordre.
  const sansEffet = jouer(rendu, { type: "annuler" });
  assert.equal(sansEffet.protagonistes.pj1.souffle, 3);
  assert.equal(sansEffet.journal.at(-1).genre, "annule");
  assert.ok(jouer(sansEffet, { type: "annuler" }).protagonistes === depart.protagonistes);

  // Le corps du seul adversaire mis à 0 : il meurt, et le combat finit.
  const tue = jouer(depart, { type: "mj", genre: "valeurs", qui: "adv2", valeurs: [{ champ: "corps", valeur: 0 }] });
  assert.deepEqual(tue.protagonistes.adv2.mort, { tour: 1 });
  assert.deepEqual([tue.phase, tue.vainqueur], ["termine", "pj"]);
  assert.equal(tue.journal.at(-1).genre, "fin");
  const revit = jouer(tue, { type: "annuler" });
  assert.deepEqual([revit.phase, revit.protagonistes.adv2.mort], ["combat", null]);
  // Un autre corps à 0 n'est pas un autre que le sien : les autres vivent.
  assert.equal(jouer(depart, { type: "mj", genre: "valeurs", qui: "adv2", valeurs: [{ champ: "corps", valeur: 1 }] }).protagonistes.adv2.mort, null);
});

// ─── La préparation d'un geste, et ce qui la retire (choix 11) ──────────────

const nezFin = (groupe = { genre: "archetype", titre: "Saucier" }) =>
  capaciteEssai({ nom: "Nez fin", groupe, facons: [faconEssai({ elements: ["Passif"], passif: true, cout: { souffle: 1, lien: 0 }, description: "Flaire le plat." })] });
// Aubépine : 0 Frappe, 1 Émincer, 2 Flambage … 6 Taloche, 7 Pas de côté, 8 Guetter, 9 Nez fin (1 souffle).
const AU_NEZ_FIN = pjEssai((champs) => champs.capacites.push(guetter(), nezFin()));
const NEZ_FIN = { genre: "capacite", qui: "pj1", capacite: 9 };
const FRAPPE_D_AUBEPINE = { genre: "capacite", qui: "pj1", capacite: 0 };
const PERSIL = pjEssai((champs) => {
  champs.identifiant = "essai-persil-0000000003";
  champs.nom = "Persil";
});
const avantages = (source, nombre = 1) => ({ type: "effet", genre: "avantages", nombre, source });
const relancerPar = (source) => ({ type: "effet", genre: "relancer", source });
const PAS_ENCORE_PAYE = "Le geste n'est pas encore payé.";
// Les protagonistes à la lettre : ce qu'un geste retiré sans être payé laisse tel qu'il l'a trouvé.
const memes = (un, autre) => JSON.stringify(un.protagonistes) === JSON.stringify(autre.protagonistes);

test("la préparation d'un geste : les seuls effets « pour ce jet », de la capacité jouée ou d'un passif, à un geste qui lance un dé (choix 11)", () => {
  const depart = combat(surD4(AU_NEZ_FIN, MARMITON));
  const prepare = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  const { effets } = offre(prepare);
  assert.deepEqual(
    [effets.avantages.actif, effets.defense.actif, effets.etat.actif, effets.rendre.raison, effets.deplacer.raison, effets.relancer.raison],
    [true, true, true, PAS_ENCORE_PAYE, PAS_ENCORE_PAYE, PAS_ENCORE_PAYE],
  );
  refuse(prepare, { type: "effet", genre: "rendre", source: MJ, sur: "pj1", ressource: "souffle", n: 1 }, "hors_moment", PAS_ENCORE_PAYE);
  refuse(prepare, { type: "effet", genre: "defense", source: FRAPPE_D_AUBEPINE, sur: "adv2", n: -1, duree: "tour" }, "hors_moment", PAS_ENCORE_PAYE);
  refuse(prepare, avantages(MJ), "interdit", "Avant le paiement, la source est la capacité jouée ou un passif.");
  const pourCeJet = jouer(prepare, { type: "effet", genre: "defense", source: NEZ_FIN, sur: "adv2", n: -1, duree: "jet" });
  assert.deepEqual(pourCeJet.effets, [], "pour ce jet : dans le geste seul");
  // Payé, tout reprend son moment, le MJ compris.
  const lance = jouer(prepare, d8(8));
  assert.equal(offre(lance).effets.relancer.actif, true);
  jouer(lance, relancerPar(MJ));
  // Un geste sans jet (Flambage) : la palette n'a rien à lui offrir avant sa confirmation, qui le finit.
  const flambage = jouer(depart, capacite(depart, "pj1", "Flambage"), viser("adv2"));
  assert.deepEqual(offre(flambage).effets.avantages, { actif: false, raison: "Ce geste ne lance aucun dé." });
  assert.equal(offre(flambage).types.includes("effet"), false);
});

test("un geste retiré sans être payé ne laisse rien : le prix d'un passif est rendu, de chaque façon de le retirer (choix 11)", () => {
  const depart = combat(surD4(AU_NEZ_FIN, MARMITON));
  const prepare = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  const paye = jouer(prepare, avantages(NEZ_FIN), avantages(FRAPPE_D_AUBEPINE));
  assert.equal(paye.protagonistes.pj1.souffle, 9, "Nez fin : 1 souffle, payé quand l'effet s'applique");
  assert.notEqual(paye.annulation.attente, null, "le premier effet a engagé le geste");

  // « Revenir » : l'état d'avant le geste, effets compris, et rien à défaire.
  const revenu = jouer(paye, REVENIR);
  assert.ok(memes(revenu, depart), "les protagonistes d'avant le geste, à la lettre");
  assert.ok(revenu.effets === depart.effets, "aucun effet durable : la liste même");
  assert.ok(revenu.photos === depart.photos);
  assert.deepEqual([revenu.pile.length, revenu.journal.length, revenu.annulation.attente], [0, depart.journal.length, null]);
  assert.ok(revenu.annulation.pile === depart.annulation.pile, "la pile d'annulation d'avant");
  assert.deepEqual(annulation(revenu), annulation(depart));
  // Une autre capacité : le prix rendu, le geste neuf sans rien d'engagé.
  const autre = jouer(paye, capacite(paye, "pj1", "Émincer"));
  assert.equal(autre.protagonistes.pj1.souffle, 10);
  assert.deepEqual([gesteEnCours(autre).capacite, gesteEnCours(autre).effets.length, autre.annulation.attente], [1, 0, null]);
  // Passer : le prix rendu ; l'annuler revient à l'état d'avant le geste.
  const passe = jouer(paye, { type: "passer", qui: "pj1" });
  assert.equal(passe.protagonistes.pj1.souffle, 10);
  const avantLaPasse = jouer(passe, ANNULER);
  assert.ok(memes(avantLaPasse, depart));
  assert.deepEqual(avantLaPasse.pile, []);
  // La fin du tour : de même.
  const finDuTour = jouer(paye, FIN_DE_TOUR);
  assert.equal(finDuTour.protagonistes.pj1.souffle, 10);
  assert.ok(memes(jouer(finDuTour, ANNULER), depart));
  // Le geste payé, lui, garde le prix de son passif.
  assert.equal(jouer(paye, d8(1)).protagonistes.pj1.souffle, 9);
});

test("une intervention retirée sans être payée rend le prix de son passif ; le geste du dessous reprend où il était (choix 11)", () => {
  const depart = combat(surD4(AU_NEZ_FIN, MARMITON));
  const garde = jouer(depart, capacite(depart, "pj1", "Guetter"), regler("garde", { capacite: 6, facon: 0 }), CONFIRMER);
  const etape = jouer(garde, capacite(garde, "adv2", "Frappe"), viser("pj1"), d8(2), d20(5));
  assert.equal(gesteEnCours(etape).moment, "suites");
  const paye = jouer(etape, { type: "intervenir", qui: "pj1", capacite: 6, facon: 0 }, viser("adv2"), avantages(NEZ_FIN));
  assert.deepEqual([paye.pile.length, paye.protagonistes.pj1.souffle], [2, 9]);
  const revenu = jouer(paye, REVENIR);
  assert.deepEqual([revenu.pile.length, gesteEnCours(revenu).moment], [1, "suites"]);
  assert.ok(memes(revenu, etape), "les protagonistes d'avant l'intervention, à la lettre");
  assert.ok(revenu.annulation === paye.annulation, "le geste racine reste engagé");
});

// ─── Un passif sert une fois par jet (choix 15) ─────────────────────────────

test("un passif sert une fois par jet : refusé jusqu'à la fin de ce jet, servi de nouveau au jet de la cible suivante (choix 15)", () => {
  // Le Chef : 0 Frappe, 1 Moulinet farineux (Centré, 5 souffle), 2 Pas chassé, 3 Nez fin ; 7 souffle.
  const CHEF_AU_NEZ = chefDePartieEssai((champs) => champs.capacites.push(nezFin({ genre: "capacites", titre: "Capacités" })));
  const NEZ_DU_CHEF = { genre: "capacite", qui: "adv2", capacite: 3 };
  const depart = combat(surD4(AUBEPINE, CHEF_AU_NEZ, PERSIL), { quiCommence: "adv" });
  const servi = jouer(depart, capacite(depart, "adv2", "Moulinet farineux"), { type: "effet", genre: "attaque", source: NEZ_DU_CHEF, sur: "adv2", n: 1, duree: "jet" });
  assert.equal(servi.protagonistes.adv2.souffle, 6);
  const DEJA = "Ce passif a déjà servi pour ce jet.";
  refuse(servi, avantages(NEZ_DU_CHEF), "interdit", DEJA);
  // Le premier dé d'Aubépine : le même jet, le passif a servi.
  const un = jouer(servi, d8(8));
  refuse(un, relancerPar(NEZ_DU_CHEF), "interdit", DEJA);
  // Aubépine pare ; la cible suivante, Persil, a son jet : le passif sert de nouveau, et se paie.
  const second = jouer(un, d8(8), d8(8), APPLIQUER);
  assert.deepEqual([gesteEnCours(second).rang, gesteEnCours(second).cible, gesteEnCours(second).passifs], [1, "pj3", []]);
  const deux = jouer(second, d8(8), relancerPar(NEZ_DU_CHEF));
  assert.equal(deux.protagonistes.adv2.souffle, 0, "7 − 1 − 5 − 1");
  assert.deepEqual(gesteEnCours(deux).passifs, [{ qui: "adv2", capacite: 3 }]);
  refuse(jouer(deux, d8(8)), relancerPar(NEZ_DU_CHEF), "interdit", DEJA);
});

// ─── L'esquive suit la victime ──────────────────────────────────────────────

test("l'esquive suit la victime : des dégâts reportés sur un autre personnage, c'est lui qui esquive et qui paie", () => {
  // Persil n'a que 6 de souffle : son esquive va de 1 à 6, celle d'Aubépine irait à 10.
  const essouffle = pjEssai((champs) => Object.assign(champs, { identifiant: "essai-persil-0000000003", nom: "Persil", souffle: 6 }));
  const depart = combat(surD4(AUBEPINE, MARMITON, essouffle), { quiCommence: "adv" });
  const reporte = jouer(depart, capacite(depart, "adv2", "Frappe"), viser("pj1"), d8(2), { type: "effet", genre: "reporter", source: MJ, sur: "pj3" }, d20(5));
  assert.equal(gesteEnCours(reporte).moment, "suites");
  assert.deepEqual(offre(reporte).esquive, { min: 1, max: 6, capacite: 7 });
  const esquive = jouer(reporte, { type: "esquive", x: 3 });
  const { pj1, pj3 } = esquive.protagonistes;
  assert.deepEqual([pj3.souffle, pj3.actions, pj1.souffle, pj1.actions], [3, 1, 10, 2]);
  const fini = jouer(esquive, APPLIQUER);
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 10, "Aubépine n'est pas touchée");
  assert.deepEqual([fini.protagonistes.pj3.zones[1].armure, fini.protagonistes.pj3.zones[1].resistance], [0, 3], "C = 15, 3 esquivés : 12 sur Persil");
  assert.deepEqual([fini.protagonistes.pj3.souffle, fini.protagonistes.pj3.actions], [3, 1], "les coups frappent Persil tel qu'il est, son esquive payée");
});

// ─── Attendre ───────────────────────────────────────────────────────────────

test("attendre : sa ligne paraît ; il se règle (la ligne gardée), se confirme, et le protagoniste a joué", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  assert.deepEqual(
    boutons(depart, "pj1").filter((ligne) => ligne.capacite === 8),
    [{ capacite: 8, facon: 0, actif: true, raison: null }],
  );
  const ouvert = jouer(depart, capacite(depart, "pj1", "Guetter"));
  assert.equal(gesteEnCours(ouvert).mode, "attendre");
  const { reglages, pret } = offre(ouvert);
  // Ses lignes, sauf attendre lui-même et l'esquive.
  assert.deepEqual(
    reglages.garde.options.map(({ capacite: une, facon }) => `${une}.${facon}`),
    ["0.0", "1.0", "2.0", "2.1", "3.0", "4.0", "4.1", "5.0", "6.0"],
  );
  assert.equal(reglages.garde.valeur, null);
  assert.equal("cible" in reglages, false);
  assert.deepEqual(pret, { ok: false, manque: "Choisissez la capacité à garder." });
  refuse(ouvert, CONFIRMER, "interdit", "Choisissez la capacité à garder.");
  refuse(ouvert, regler("garde", { capacite: 8, facon: 0 }), "hors_bornes", "Cette ligne ne se garde pas.");
  refuse(ouvert, regler("garde", { capacite: 7, facon: 0 }), "hors_bornes", "Cette ligne ne se garde pas.");

  const garde = jouer(ouvert, regler("garde", { capacite: 6, facon: 0 }), CONFIRMER);
  assert.deepEqual(garde.pile, []);
  assert.deepEqual([garde.protagonistes.pj1.actions, garde.protagonistes.pj1.passe], [2, false], "le tour a fini : ses actions reviennent");
  assert.equal(annulation(garde).quoi.geste.prix.actions, 1, "attendre a coûté une action");
  assert.equal(garde.effets.length, 1);
  const [guet] = garde.effets;
  assert.deepEqual(
    { ...guet },
    { id: guet.id, genre: "guet", porteur: "pj1", auteur: "pj1", camp: "pj", duree: "tour", source: { genre: "capacite", qui: "pj1", capacite: 8 }, garde: { capacite: 6, facon: 0 } },
  );
  // Elle a joué : son tour finit de lui-même, sans qu'elle ait dépensé sa seconde action.
  assert.deepEqual(garde.tour, { numero: 1, camp: "adv" });
  // Désarmé : sans action, la ligne d'attendre est inactive.
  const lasse = combat(surD4(pjEssai((champs) => Object.assign(champs, { actions: 0, capacites: [...champs.capacites, guetter()] })), MARMITON), { quiCommence: "adv" });
  assert.equal(boutons(lasse, "pj1").find((ligne) => ligne.capacite === 8).raison, "Plus d'action à ce tour.");
});

test("la garde jouée : la ligne gardée est une intervention jusqu'au prochain tour du camp de son auteur, puis l'échéance l'ôte, avec sa ligne", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const garde = jouer(depart, capacite(depart, "pj1", "Guetter"), regler("garde", { capacite: 6, facon: 0 }), CONFIRMER);
  const [guet] = garde.effets;
  // Au tour adverse : la Taloche gardée paraît parmi ses interventions.
  const [aubepine] = offre(garde).interventions.intervenants;
  assert.deepEqual(aubepine.options, [{ capacite: 6, facon: 0, gardee: guet.id, actif: true, raison: null }]);
  // « Intervenir… » : la Taloche, jouée comme une capacité (sa cible, son dé au choix, ses dés).
  const taloche = jouer(garde, { type: "intervenir", qui: "pj1", capacite: 6, facon: 0 }, viser("adv2"), regler("caracteristiques", ["force"]), d8(8), d8(2), d20(5), APPLIQUER);
  assert.deepEqual(taloche.pile, []);
  assert.equal(annulation(taloche).quoi.geste.gardee, guet.id);
  assert.equal(taloche.protagonistes.adv2.zones[0].armure, 8, "A = 2");
  assert.equal(taloche.protagonistes.pj1.actions, 1, "une action, dépensée pendant le tour adverse");
  assert.ok(taloche.effets[0] === guet, "elle reste gardée : la fin du tour des PJ ne l'a pas ôtée");

  // Le prochain tour des PJ : la garde s'en va, et sa ligne suit celle du tour.
  const echu = jouer(taloche, FIN_DE_TOUR);
  assert.deepEqual(echu.tour, { numero: 2, camp: "pj" });
  assert.deepEqual(echu.effets, []);
  const ecrites = echu.journal.slice(taloche.journal.length);
  assert.deepEqual(
    ecrites.map((ligne) => [ligne.genre, ligne.phrases[0]]),
    [
      ["cadre", "fin_de_tour"],
      ["tour", "tour"],
      ["cadre", "echeance"],
    ],
  );
  // Plus d'intervention gardée au tour suivant des adversaires.
  assert.deepEqual(offre(jouer(echu, FIN_DE_TOUR)).interventions.intervenants, []);
});

// ─── Une attaque en plus ────────────────────────────────────────────────────

test("une attaque en plus : son porteur reste un candidat, une capacité d'attaque ne lui coûte pas d'action, et la consomme", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const bilan = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2));
  const plus = jouer(bilan, { type: "effet", genre: "attaque_en_plus", source: { genre: "mj" } }, d20(5), APPLIQUER);
  const enPlus = plus.effets.find((effet) => effet.genre === "attaque_en_plus");
  assert.deepEqual([enPlus.porteur, enPlus.camp, enPlus.duree], ["pj1", "pj", "tour"]);
  assert.equal(plus.protagonistes.pj1.actions, 1);
  // Tant qu'elle est là, une attaque la consomme, même quand il reste une action : l'action reste.
  const consommee = jouer(plus, capacite(plus, "pj1", "Frappe"), viser("adv2"), d8(1), APPLIQUER);
  assert.equal(consommee.protagonistes.pj1.actions, 1);
  assert.equal(annulation(consommee).quoi.geste.attaqueEnPlus, enPlus.id);
  assert.equal(consommee.effets.length, 0);
  // Sa dernière action dépensée par une capacité sans jet (Flambage), qui ne la consomme pas : elle reste
  // candidate, et le tour ne finit pas.
  const sansAction = jouer(plus, capacite(plus, "pj1", "Flambage"), viser("adv2"), CONFIRMER);
  assert.equal(sansAction.protagonistes.pj1.actions, 0);
  assert.ok(sansAction.effets[0] === enPlus);
  assert.deepEqual(candidats(sansAction), ["pj1"]);
  assert.deepEqual(sansAction.tour, { numero: 1, camp: "pj" });
  const lignes = boutons(sansAction, "pj1");
  assert.deepEqual(
    lignes.filter((ligne) => ligne.capacite === 0),
    [{ capacite: 0, facon: 0, actif: true, raison: null }],
    "Frappe, une attaque : sans action",
  );
  assert.equal(lignes.find((ligne) => ligne.capacite === 2).raison, "Plus d'action à ce tour.", "Flambage, sans jet : il faut une action");
  refuse(sansAction, capacite(sansAction, "pj1", "Flambage"), "interdit", "Plus d'action à ce tour.");
  refuse(sansAction, capacite(sansAction, "pj1", "Goûter"), "interdit", "Plus d'action à ce tour.");

  // La Frappe en plus : rien en action, l'effet consommé au paiement, le geste en garde la trace.
  const troisieme = jouer(sansAction, capacite(sansAction, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2));
  const geste = gesteEnCours(troisieme);
  assert.deepEqual([geste.prix.actions, geste.attaqueEnPlus], [0, enPlus.id]);
  assert.deepEqual(geste.sourceDeLAttaqueEnPlus, { genre: "mj" });
  assert.equal(troisieme.effets.some((effet) => effet.genre === "attaque_en_plus"), false);
  const fini = jouer(troisieme, d20(5), APPLIQUER);
  assert.deepEqual(fini.tour, { numero: 1, camp: "adv" }, "plus candidate : le tour finit de lui-même");

  // Même après avoir passé, elle reste candidate ; et l'échéance l'ôte au prochain tour des PJ.
  const passe = jouer(plus, { type: "passer", qui: "pj1" });
  assert.deepEqual(candidats(passe), ["pj1"]);
  const expire = jouer(passe, FIN_DE_TOUR, FIN_DE_TOUR);
  assert.deepEqual(expire.tour, { numero: 2, camp: "pj" });
  assert.equal(expire.effets.length, 0);
});

// ─── La blessure ────────────────────────────────────────────────────────────

// Le Marmiton frappe Aubépine, qui rate sa défense ; les dégâts sont ajustés à la main.
const frappeSurAubepine = (etat, degats, ...d20s) => jouer(etat, capacite(etat, "adv2", "Frappe"), viser("pj1"), d8(1), degats, ...d20s);

test("la blessure d'un personnage : une étape par zone sans endurance qui perd du corps ; la capacité choisie rejoint sa photographie", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  // 20 au torse : armure 10 → 0, endurance 5 → 0, corps 10 → 5.
  const blesse = jouer(frappeSurAubepine(depart, ajuste(20), d20(5)), APPLIQUER);
  assert.equal(gesteEnCours(blesse).moment, "blessure");
  assert.deepEqual(offre(blesse).blessure, { zone: 1 });
  assert.deepEqual(offre(blesse).types, ["blessure", "effet"]);
  refuse(blesse, APPLIQUER, "hors_moment");

  const choisie = jouer(blesse, { type: "blessure", capacite: MAIN_BRULEE });
  assert.deepEqual(choisie.pile, []);
  const avant = depart.photos.pj1.capacites;
  const apres = choisie.photos.pj1.capacites;
  assert.equal(apres.length, avant.length + 1);
  assert.ok(avant.every((une, rang) => apres[rang] === une), "ses capacités d'avant, les objets mêmes");
  assert.equal(apres.at(-1).nom, "Main brûlée");
  assert.ok(choisie.photos.adv2 === depart.photos.adv2);
  const [effet] = choisie.effets;
  assert.deepEqual(
    [effet.genre, effet.porteur, effet.duree, effet.blessure, effet.zone, effet.libre, effet.capacite.nom],
    ["etat", "pj1", "combat", true, 1, null, "Main brûlée"],
  );
  assert.deepEqual(effet.source, { genre: "capacite", qui: "pj1", capacite: avant.length });
  assert.deepEqual(annulation(choisie).quoi.geste.blessures, [{ zone: 1, capacite: validerEvenement({ type: "blessure", capacite: MAIN_BRULEE }).evenement.capacite, libre: null }]);
  // Un passif n'a pas de ligne.
  assert.equal(boutons(choisie, "pj1").some((ligne) => ligne.capacite === avant.length), false);

  // Un état libre : l'effet seul, la photographie inchangée.
  const libre = jouer(blesse, { type: "blessure", libre: "Brûlure" });
  assert.ok(libre.photos.pj1 === depart.photos.pj1);
  assert.deepEqual([libre.effets[0].libre, libre.effets[0].capacite, libre.effets[0].blessure, libre.effets[0].zone], ["Brûlure", null, true, 1]);
  // La blessure se défait avec le geste qui l'a faite.
  const annule = jouer(choisie, { type: "annuler" });
  assert.ok(annule.photos === depart.photos);
  assert.deepEqual(annule.effets, []);
});

test("la blessure : deux zones, deux étapes dans l'ordre des dés ; deux coups sur une zone, une seule ; aucune si le coup tue, ni au corps seul", () => {
  // Deux d20 : le torse (5), puis la jambe droite (14) ; 16 à chacun.
  const aDeuxD20 = adversaireEssai((champs) => (champs.capacites[0].facons[0].locMultiple = 2));
  const robuste = pjEssai((champs) => (champs.corps = 30));
  const deux = combat(surD4(robuste, aDeuxD20), { quiCommence: "adv" });
  const premiere = jouer(frappeSurAubepine(deux, ajuste(16), d20(14), d20(5)), APPLIQUER);
  assert.deepEqual(offre(premiere).blessure, { zone: 3 }, "la jambe droite, le premier dé");
  const seconde = jouer(premiere, { type: "blessure", libre: "Entorse" });
  assert.deepEqual(offre(seconde).blessure, { zone: 1 });
  const fini = jouer(seconde, { type: "blessure", capacite: MAIN_BRULEE });
  assert.deepEqual(fini.pile, []);
  assert.deepEqual(
    fini.effets.map((effet) => effet.zone),
    [3, 1],
  );
  // Deux coups au torse : une blessure.
  const memeZone = jouer(frappeSurAubepine(deux, ajuste(16), d20(5), d20(6)), APPLIQUER);
  const unique = jouer(memeZone, { type: "blessure", libre: "Côte fêlée" });
  assert.deepEqual(unique.pile, []);
  assert.equal(unique.effets.length, 1);

  // Le coup qui tue : aucune étape, la victime meurt.
  const depart = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const tue = jouer(frappeSurAubepine(depart, ajuste(25), d20(5)), APPLIQUER);
  assert.deepEqual(tue.pile, []);
  assert.deepEqual(tue.protagonistes.pj1.mort, { tour: 1 });
  // Des dégâts au corps seul : aucune.
  const auCorps = jouer(frappeSurAubepine(depart, ajuste(5, "corps"), d20(5)), APPLIQUER);
  assert.deepEqual(auCorps.pile, []);
  assert.equal(auCorps.protagonistes.pj1.corps, 5);
  // L'endurance à 0 sans perte de corps : aucune.
  const sansCorps = jouer(frappeSurAubepine(depart, ajuste(15), d20(5)), APPLIQUER);
  assert.deepEqual(sansCorps.pile, []);
  assert.deepEqual([sansCorps.protagonistes.pj1.zones[1].resistance, sansCorps.protagonistes.pj1.corps], [0, 10]);
  // Hors de son moment, une blessure ne se choisit pas.
  refuse(depart, { type: "blessure", libre: "Brûlure" }, "hors_moment");
});

test("la blessure d'un adversaire : la même condition, sa zone blessée, sans étape", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const fini = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), ajuste(20), d20(5), APPLIQUER);
  assert.deepEqual(fini.pile, [], "aucune étape");
  const { resultat } = annulation(fini).quoi.geste;
  assert.deepEqual([resultat.coups[0].blessure, resultat.coups[0].corpsPerdu], [true, true]);
  assert.deepEqual(fini.effets, [], "sans effet calculé");
});

test("une blessure qui ferait passer sa photographie au-delà de deux cents capacités est refusée, avec sa raison ; l'état libre reste (choix 20)", () => {
  const recettes = (jusqua) => (champs) => {
    while (champs.capacites.length < jusqua) {
      champs.capacites.push(capaciteEssai({ nom: `Recette ${champs.capacites.length}`, groupe: { genre: "archetype", titre: "Saucier" }, facons: [faconEssai({ description: "Une recette." })] }));
    }
  };
  const blesser = (photo) => {
    const depart = combat(surD4(photo, MARMITON), { quiCommence: "adv" });
    return jouer(frappeSurAubepine(depart, ajuste(20), d20(5)), APPLIQUER);
  };
  const pleine = blesser(pjEssai(recettes(200)));
  assert.equal(gesteEnCours(pleine).moment, "blessure");
  const RAISON = "La photographie compterait plus de 200 capacités.";
  assert.equal(refusDeLaBlessure(pleine, MAIN_BRULEE), RAISON);
  refuse(pleine, { type: "blessure", capacite: MAIN_BRULEE }, "interdit", RAISON);
  assert.deepEqual(jouer(pleine, { type: "blessure", libre: "Brûlure" }).pile, []);
  // Une place de moins : la capacité entre, la photographie compte deux cents capacités.
  const presque = blesser(pjEssai(recettes(199)));
  assert.equal(refusDeLaBlessure(presque, MAIN_BRULEE), null);
  assert.equal(jouer(presque, { type: "blessure", capacite: MAIN_BRULEE }).photos.pj1.capacites.length, 200);
});

// ─── Un combat qui use de tout ──────────────────────────────────────────────

test("le rejeu d'un combat qui use de tout cela rend le même état, journal et maillons compris", () => {
  const AVEC_TOUT = pjEssai((champs) => champs.capacites.push(guetter(), dressage()));
  const CIBOULETTE = pjEssai((champs) => {
    champs.identifiant = "essai-ciboulette-0000000002";
    champs.nom = "Ciboulette";
    champs.capacites.push(dressage());
  });
  const miseEnPlace = miseEnPlaceEssai(surD4(AVEC_TOUT, chefDePartieEssai(), CIBOULETTE, MARMITON));
  const evenements = [];
  let etat = ouvrirCombat(miseEnPlace);
  const faire = (...liste) => {
    for (const evenement of liste.flat()) {
      etat = jouer(etat, evenement);
      evenements.push(evenement);
    }
  };
  faire(LANCER);
  // Tour 1 des PJ : le critique tenté et réussi, puis une attaque en plus ; Aubépine garde sa Taloche.
  faire(capacite(etat, "pj1", "Frappe"), viser("adv4"), regler("avantages", 1, "Minutie"), d8(8), d8(8), d8(8), TENTER, d8(8));
  faire({ type: "effet", genre: "attaque_en_plus", source: { genre: "mj" } }, d20(5), APPLIQUER);
  faire(capacite(etat, "pj1", "Guetter"), regler("garde", { capacite: 6, facon: 0 }), CONFIRMER);
  // Ciboulette frappe le Chef : sa face de contre-attaque ; il contre-attaque, Aubépine intervient dans l'étape.
  faire(capacite(etat, "pj3", "Frappe"), viser("adv2"), d8(8), d8(2), d20(1));
  faire({ type: "contre_attaquer", capacite: 0, facon: 0 }, d8(5), d8(5), d8(1), d20(14));
  faire({ type: "intervenir", qui: "pj3", capacite: 8, facon: 0 }, CONFIRMER, APPLIQUER);
  // Un geste du MJ, un effet hors d'un geste.
  faire({ type: "mj", genre: "valeurs", qui: "pj3", valeurs: [{ champ: "souffle", valeur: 4 }] });
  faire({ type: "effet", genre: "rendre", source: { genre: "mj" }, sur: "pj3", ressource: "souffle", n: 1 });
  // Le Marmiton est mort ; le Chef a dépensé son action à contre-attaquer : le tour des adversaires finit de
  // lui-même, et celui des PJ commence, sans la garde ni l'attaque en plus, échues.
  faire(FIN_DE_TOUR);
  assert.deepEqual(etat.tour, { numero: 2, camp: "pj" });
  assert.deepEqual(etat.effets, []);
  faire(FIN_DE_TOUR);
  // Tour 2 des adversaires : le Chef, Centré, vise ses deux adversaires ; la seconde est blessée.
  faire(capacite(etat, "adv2", "Moulinet farineux"), d8(8), d8(8), d8(8), APPLIQUER);
  faire(d8(1), ajuste(20), d20(5), APPLIQUER, { type: "blessure", capacite: MAIN_BRULEE });
  faire(FIN_DE_TOUR);
  // Puis on défait le dernier geste du Chef, et l'on reprend.
  faire({ type: "annuler" });

  // Le combat a bien vu tout cela.
  const types = new Set(evenements.map((evenement) => evenement.type));
  for (const type of ["critique", "effet", "intervenir", "contre_attaquer", "mj", "blessure", "annuler"]) assert.ok(types.has(type), type);
  assert.ok(etat.journal.length > 10);

  const rejoue = rejouer(JSON.parse(JSON.stringify({ regles: REGLES, revision: 1, miseEnPlace, evenements })));
  assert.equal(rejoue.erreur, undefined, rejoue.erreur?.message);
  const sansSuivi = ({ annulation: _pile, ...reste }) => reste;
  assert.ok(JSON.stringify(sansSuivi(rejoue.etat)) === JSON.stringify(sansSuivi(etat)), "le même état, au signe près, journal compris");
  const forme = (un) => {
    const maillons = [];
    for (let maillon = un.annulation.pile; maillon !== null; maillon = maillon.precedent) maillons.push(`${maillon.quoi.genre} ${maillon.plage.join("-")}`);
    return maillons.join(" | ");
  };
  assert.equal(forme(rejoue.etat), forme(etat));
});
