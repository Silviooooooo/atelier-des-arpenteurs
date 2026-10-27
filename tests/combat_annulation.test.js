// Contrôles de « Annuler le dernier geste » (SPECIFICATION.md, § 17 et § 11,
// domaine « Combat » ; complément du groupe 2, § 4.10 ; contrat du groupe 2,
// § 2) : js/combat/moteur.js et js/combat/offre.js.
//
// Un geste fini (une capacité jouée avec ses dés, un déplacement, « Passer
// son tour », « Fin de tour », avec la mort, la fin du combat et les fins de
// tour automatiques qu'il entraîne) se défait d'un coup : l'état redevient
// celui d'avant lui, sauf le journal, le pas et l'annonce, qui ne reculent
// pas ; une ligne « Annulé » s'ajoute, qui couvre de sa plage les lignes du
// geste. On remonte ainsi jusqu'au lancement, qui ne se défait pas.
//
// Chaque règle est vue dans les deux sens : l'état d'avant retrouvé et celui
// d'après le paiement qu'on ne doit pas retrouver, la plage qui couvre les
// fins de tour et celle qui les oublierait, le bouton actif et chacune de ses
// trois raisons, dans leur ordre. La pile d'annulation ne passe jamais par
// JSON et ne se compare jamais en profondeur : les états se comparent sans
// elle, et elle par l'identité de ses maillons.
//
// Les protagonistes sont ceux de tests/outils/photographies_essai.js :
// « Aubépine » et « Ciboulette », deux personnages à deux actions, et des
// « Marmiton » à une action. Tous sont sur la case D4, sauf mention.

import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquer, gesteEnCours, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import { annulation, candidats, offre } from "../js/combat/offre.js";
import { EVENEMENTS_MAX, REGLES, SANS_ANNULATION, geler } from "../js/combat/regles.js";
import { adversaireEssai, etatEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const ANNULER = { type: "annuler" };
const CONFIRMER = { type: "confirmer" };
const APPLIQUER = { type: "appliquer" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const AUBEPINE = pjEssai();
const CIBOULETTE = pjEssai((champs) => {
  champs.identifiant = "essai-ciboulette-0000000002";
  champs.nom = "Ciboulette";
});
const MARMITON = adversaireEssai();
const SANS_ACTION = adversaireEssai((champs) => (champs.actions = 0));

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
  assert.equal(rendu.etat, etat, "un refus rend l'état reçu, l'objet même");
  assert.equal(rendu.refus.code, code, rendu.refus.message);
  if (message !== null) assert.equal(rendu.refus.message, message);
}

const capacite = (etat, qui, nom, facon = 0) => {
  const indice = etat.photos[qui].capacites.findIndex((une) => une.nom === nom);
  assert.notEqual(indice, -1, `${qui} n'a pas de capacité « ${nom} »`);
  return { type: "capacite", qui, capacite: indice, facon };
};
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });
const passer = (qui) => ({ type: "passer", qui });

// Une Frappe d'Aubépine qui manque : le premier dé paie ; depuis le lot 4.3,
// « Appliquer » passe l'étape « Interventions » et clôt le geste.
const frappeManquee = (etat, qui = "pj1", cible = "adv2") => [capacite(etat, qui, "Frappe"), viser(cible), d8(1), APPLIQUER];
// Une Frappe qui touche et tue : les dégâts sont fixés à la main, droit au corps.
const coupMortel = (etat, qui, cible) => [
  capacite(etat, qui, "Frappe"),
  viser(cible),
  d8(8),
  d8(1),
  { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 10, raison: "Dernier service" }], nature: "corps" },
  d20(5),
  APPLIQUER,
];

// Ce qui redevient ce qu'il était : tout, hors du journal, du pas, de l'annonce et de l'annulation.
const sansSuivi = ({ journal, pas, annonce, annulation: _pile, ...reste }) => reste;
const textes = (etat, depuis = 0) => etat.journal.slice(depuis).map((ligne) => ligne.texte);

function estGele(valeur) {
  if (valeur === null || typeof valeur !== "object") return true;
  return Object.isFrozen(valeur) && Object.values(valeur).every(estGele);
}

/**
 * Joue un geste depuis « avant », l'annule, et vérifie ce que l'annulation
 * doit rendre : l'état d'avant hors du suivi, le journal prolongé d'une ligne
 * « Annulé » qui couvre les lignes du geste, le pas qui avance, l'annonce qui
 * dit la ligne. Rend { fini, annule }.
 */
function defaire(avant, evenements, ligne) {
  const fini = jouer(avant, evenements);
  const annule = jouer(fini, ANNULER);
  assert.deepEqual(sansSuivi(annule), sansSuivi(avant), ligne);
  assert.equal(annule.protagonistes, avant.protagonistes, `${ligne} : les protagonistes d'avant, l'objet même`);
  assert.equal(annule.photos, avant.photos);
  assert.deepEqual(annule.pile, []);
  assert.equal(annule.pas, fini.pas + 1, "le pas ne recule pas");
  assert.equal(annule.journal.length, fini.journal.length + 1, "le journal non plus");
  for (const [rang, une] of fini.journal.entries()) assert.equal(annule.journal[rang], une, "aucune ligne n'est réécrite");
  const derniere = annule.journal.at(-1);
  assert.deepEqual({ genre: derniere.genre, texte: derniere.texte, barre: derniere.barre }, { genre: "annule", texte: ligne, barre: [avant.journal.length, fini.journal.length] });
  assert.deepEqual(annule.annonce, { pas: annule.pas, texte: ligne });
  assert.equal(Object.isFrozen(annule), true);
  assert.ok(Object.values(sansSuivi(annule)).every(estGele), "tout est gelé");
  return { fini, annule };
}

// ─── a) Chaque genre de geste ───────────────────────────────────────────────

test("chaque genre de geste se défait : l'état d'avant revient, hors du journal, du pas, de l'annonce et de l'annulation", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));

  // Une attaque : ses dés, sa localisation, ses dégâts appliqués.
  const { fini: frappe } = defaire(depart, [capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5), APPLIQUER], "Annulé : Aubépine — Frappe.");
  assert.equal(frappe.protagonistes.adv2.zones[0].armure, 5, "la Frappe avait porté");
  assert.equal(frappe.protagonistes.pj1.actions, 1);

  // Un jet de caractéristique, fini par « Appliquer » (lot 4.3).
  defaire(depart, [capacite(depart, "pj1", "Goûter"), regler("caracteristiques", ["sens", "parole"]), regler("difficulte", 6), d8(7), d8(4), APPLIQUER], "Annulé : Aubépine — Goûter.");
  // Un déplacement : la case d'avant revient.
  const { fini: deplace } = defaire(depart, [capacite(depart, "pj1", "Pas chassé", 1), regler("arrivee", "F6"), CONFIRMER], "Annulé : Aubépine — Pas chassé [2].");
  assert.deepEqual([deplace.protagonistes.pj1.case, deplace.protagonistes.pj1.souffle], ["F6", 9]);
  // Une capacité sans jet : son souffle revient.
  const { fini: flambe } = defaire(depart, [capacite(depart, "pj1", "Flambage", 1), viser("adv2"), CONFIRMER], "Annulé : Aubépine — Flambage [2].");
  assert.equal(flambe.protagonistes.pj1.souffle, 0);
  // Un dé manqué qui paie, puis « Appliquer » qui clôt le geste.
  const { fini: manque } = defaire(depart, frappeManquee(depart), "Annulé : Aubépine — Frappe.");
  assert.equal(manque.protagonistes.pj1.actions, 1);
  // Une passe, sans fin de tour (Ciboulette n'a pas joué).
  const { fini: passe } = defaire(depart, [passer("pj1")], "Annulé : Aubépine — passer son tour.");
  assert.deepEqual(passe.tour, { numero: 1, camp: "pj" });
  // Une fin de tour demandée.
  const { fini: fin } = defaire(depart, [FIN_DE_TOUR], "Annulé : la fin du tour des PJ.");
  assert.deepEqual(fin.tour, { numero: 1, camp: "adv" });
  // Celle des adversaires.
  const adverse = jouer(depart, FIN_DE_TOUR);
  defaire(adverse, [FIN_DE_TOUR], "Annulé : la fin du tour des adversaires.");

  // Le geste d'un adversaire : le PJ visé a lancé sa défense, et esquivé (son action, son souffle).
  const attaque = [capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(1), d20(5), { type: "esquive", x: 3 }, APPLIQUER];
  const { fini: esquive } = defaire(adverse, attaque, "Annulé : Marmiton — Frappe.");
  assert.deepEqual([esquive.protagonistes.pj1.actions, esquive.protagonistes.pj1.souffle], [1, 7]);
});

test("ce qui se défait commence à l'ouverture du geste : un geste non payé, retiré par la passe ou la fin de tour, ne revient pas", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  // Aubépine prépare un Émincer ; Ciboulette passe, ce qui le retire. L'annulation rend l'état d'avant, sans lui.
  const prepare = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"));
  const passe = jouer(prepare, passer("pj3"));
  const annule = jouer(passe, ANNULER);
  assert.deepEqual(sansSuivi(annule), sansSuivi(depart));
  assert.equal(gesteEnCours(annule), null);
  // De même pour « Fin de tour ».
  assert.deepEqual(sansSuivi(jouer(prepare, FIN_DE_TOUR, ANNULER)), sansSuivi(depart));
  // Les réglages et les ouvertures d'avant le premier dé ne font aucun maillon : la pile reste l'objet même.
  assert.equal(prepare.annulation, depart.annulation);
  assert.equal(jouer(prepare, regler("modificateur", 1, "Sel fin"), { type: "revenir" }).annulation, depart.annulation);
});

// ─── b) Ce que le geste entraîne ────────────────────────────────────────────

test("la mort et la fin du combat se défont avec le geste qui les a faites", () => {
  // La mort, le combat continue : le Marmiton revit, avec son corps.
  const aTrois = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const { fini: tue, annule: ressuscite } = defaire(aTrois, coupMortel(aTrois, "pj1", "adv2"), "Annulé : Aubépine — Frappe.");
  assert.deepEqual(tue.protagonistes.adv2.mort, { tour: 1 });
  assert.equal(tue.journal[2].mort, true);
  assert.equal(ressuscite.protagonistes.adv2.mort, null);
  assert.equal(ressuscite.protagonistes.adv2.corps, 10);

  // La fin du combat : la ligne du geste et « Combat terminé », barrées ensemble ; le combat reprend.
  const aDeux = combat(surD4(AUBEPINE, MARMITON));
  const { fini, annule } = defaire(aDeux, coupMortel(aDeux, "pj1", "adv2"), "Annulé : Aubépine — Frappe.");
  assert.deepEqual([fini.phase, fini.vainqueur], ["termine", "pj"]);
  assert.deepEqual(textes(fini, 3), ["Combat terminé : victoire des PJ."]);
  assert.deepEqual(annule.journal.at(-1).barre, [2, 4]);
  assert.deepEqual([annule.phase, annule.vainqueur], ["combat", null]);
  // La palette et le menu du MJ (lot 4.3) s'offrent aussi entre deux gestes.
  assert.deepEqual(offre(annule).types, ["capacite", "effet", "mj", "passer", "fin_de_tour"], "rien n'est plus à annuler, et l'on rejoue");
  assert.deepEqual(candidats(annule), ["pj1"]);
});

test("une et deux fins de tour automatiques se défont avec le geste qui les a entraînées, jamais seules", () => {
  // Une : la dernière action d'Aubépine finit le tour des PJ.
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const une = jouer(depart, frappeManquee(depart));
  const { fini, annule } = defaire(une, frappeManquee(une), "Annulé : Aubépine — Frappe.");
  assert.deepEqual(textes(fini, 3).slice(1), ["Fin du tour des PJ : ils retrouvent leurs actions.", "— Tour 1 · camp des adversaires —"]);
  assert.deepEqual(annule.journal.at(-1).barre, [3, 6], "la ligne du geste et les deux lignes de la fin");
  assert.deepEqual(annule.tour, { numero: 1, camp: "pj" });
  assert.equal(annule.protagonistes.pj1.actions, 1);

  // Deux : face à des adversaires sans action, la fin du tour des PJ entraîne celle des adversaires.
  const immobiles = combat(surD4(AUBEPINE, SANS_ACTION));
  const entame = jouer(immobiles, frappeManquee(immobiles));
  const { fini: deux, annule: defait } = defaire(entame, frappeManquee(entame), "Annulé : Aubépine — Frappe.");
  assert.equal(deux.journal.length, 3 + 5, "le geste, puis deux fins et deux tours");
  assert.deepEqual(deux.tour, { numero: 2, camp: "pj" });
  assert.deepEqual(defait.journal.at(-1).barre, [3, 8]);
  assert.deepEqual(defait.tour, { numero: 1, camp: "pj" });

  // Le geste d'avant se défait ensuite, seul : sa plage ne touche pas l'autre.
  const encore = jouer(defait, ANNULER);
  assert.deepEqual(sansSuivi(encore), sansSuivi(immobiles));
  assert.deepEqual(encore.journal.at(-1).barre, [2, 3]);
});

// ─── c) Jusqu'au lancement ──────────────────────────────────────────────────

test("on annule geste après geste jusqu'au lancement, qui ne se défait pas ; puis « Rien à annuler depuis le lancement. »", () => {
  const lance = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const etapes = [lance];
  const gestes = [
    [capacite(lance, "pj1", "Pas chassé", 0), regler("arrivee", "E5"), CONFIRMER],
    [passer("pj3")],
    frappeManquee(lance),
    [capacite(lance, "adv2", "Frappe"), viser("pj3"), d8(8), d8(8), d8(8), APPLIQUER],
  ];
  for (const geste of gestes) etapes.push(jouer(etapes.at(-1), geste));
  const fin = etapes.at(-1);
  assert.deepEqual(fin.tour, { numero: 2, camp: "pj" }, "la Frappe du Marmiton, parée, a fini son tour");
  assert.deepEqual(annulation(fin), { actif: true, raison: null, quoi: fin.annulation.pile.quoi });
  assert.equal(annulation(fin).quoi.genre, "capacite");
  assert.equal(annulation(fin).quoi.geste.acteur, "adv2");

  let courant = fin;
  for (let rang = etapes.length - 2; rang >= 0; rang -= 1) {
    courant = jouer(courant, ANNULER);
    assert.deepEqual(sansSuivi(courant), sansSuivi(etapes[rang]), `après ${etapes.length - 1 - rang} annulation(s)`);
  }
  assert.deepEqual(textes(courant, fin.journal.length), ["Annulé : Marmiton — Frappe.", "Annulé : Aubépine — Frappe.", "Annulé : Ciboulette — passer son tour.", "Annulé : Aubépine — Pas chassé [1]."]);
  assert.equal(courant.phase, "combat", "le lancement reste");
  assert.equal(courant.annulation.pile, null);
  assert.deepEqual(annulation(courant), { actif: false, raison: "Rien à annuler depuis le lancement.", quoi: null });
  assert.equal(offre(courant).types.includes("annuler"), false);
  refuse(courant, ANNULER, "interdit", "Rien à annuler depuis le lancement.");

  // Les plages sont disjointes, et aucune ne couvre une ligne « Annulé ».
  const plages = courant.journal.filter((ligne) => ligne.genre === "annule").map((ligne) => ligne.barre);
  for (const [debut, fin_] of plages) {
    for (let rang = debut; rang < fin_; rang += 1) assert.notEqual(courant.journal[rang].genre, "annule");
  }
  const rangees = [...plages].sort((a, b) => a[0] - b[0]);
  for (let rang = 1; rang < rangees.length; rang += 1) assert.ok(rangees[rang - 1][1] <= rangees[rang][0], "disjointes");

  // Un geste joué après une annulation se défait à son tour, et seulement lui :
  // le Marmiton, au lieu de sa Frappe, passe (et finit le tour des adversaires).
  const defaite = jouer(fin, ANNULER);
  const rejoue = jouer(defaite, passer("adv2"));
  const defait = jouer(rejoue, ANNULER);
  assert.deepEqual(sansSuivi(defait), sansSuivi(etapes[3]));
  assert.deepEqual(defait.journal.at(-1).barre, [defaite.journal.length, rejoue.journal.length]);
  assert.equal(defait.annulation.pile, etapes[3].annulation.pile, "le maillon d'avant, l'objet même");
});

// ─── d) Les trois raisons, et avant le lancement ────────────────────────────

test("le bouton : null avant le lancement ; puis inactif avec ses trois raisons, dans leur ordre, ou actif ; l'offre et le moteur disent la même chose", () => {
  const ouvert = ouvrirCombat(miseEnPlaceEssai(surD4(AUBEPINE, MARMITON)));
  assert.equal(annulation(ouvert), null);
  assert.equal(offre(ouvert).annulation, null);
  refuse(ouvert, ANNULER, "hors_moment", "Le combat n'est pas lancé.");

  const lance = jouer(ouvert, LANCER);
  const rien = { actif: false, raison: "Rien à annuler depuis le lancement.", quoi: null };
  assert.deepEqual(annulation(lance), rien);
  // Rien n'est à annuler : c'est la raison, même quand un geste non payé est en cours.
  const prepare = jouer(lance, capacite(lance, "pj1", "Frappe"), viser("adv2"));
  assert.deepEqual(annulation(prepare), rien);
  refuse(prepare, ANNULER, "interdit", "Rien à annuler depuis le lancement.");
  // Dans chaque colonne du geste en cours, la pile vide se dit d'abord.
  assert.deepEqual(annulation(jouer(prepare, d8(8))), rien);

  // Un geste fini : le bouton est actif, et dit ce qu'il défera.
  const unGeste = jouer(lance, capacite(lance, "pj1", "Pas chassé", 0), regler("arrivee", "E5"), CONFIRMER);
  const quoi = unGeste.annulation.pile.quoi;
  assert.deepEqual(annulation(unGeste), { actif: true, raison: null, quoi });
  assert.deepEqual([quoi.genre, quoi.geste.acteur, quoi.geste.depart, quoi.geste.arrivee, quoi.geste.jet], ["capacite", "pj1", "D4", "E5", null]);
  assert.equal(offre(unGeste).types.includes("annuler"), true);

  // Un geste en cours, non payé : « Revenez d'abord… » ; payé : « Terminez d'abord… », à chaque moment.
  const revenez = { actif: false, raison: "Revenez d'abord sur le geste en cours.", quoi };
  const terminez = { actif: false, raison: "Terminez d'abord le geste en cours.", quoi };
  const enPreparation = jouer(unGeste, capacite(unGeste, "pj1", "Frappe"), viser("adv2"));
  const enJet = jouer(enPreparation, d8(8));
  const auBilan = jouer(enJet, d8(2));
  const aDeuxD20 = pjEssai((champs) => (champs.capacites[0].facons[0].locMultiple = 2));
  const autre = combat(surD4(aDeuxD20, MARMITON));
  const autreGeste = jouer(autre, passer("pj1"), passer("adv2"));
  const enLocalisation = jouer(autreGeste, capacite(autreGeste, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));
  const auxSuites = jouer(enLocalisation, d20(6));
  const attendus = [
    [enPreparation, revenez],
    [enJet, terminez],
    [auBilan, terminez],
    [enLocalisation, { ...terminez, quoi: autreGeste.annulation.pile.quoi }],
    [auxSuites, { ...terminez, quoi: autreGeste.annulation.pile.quoi }],
  ];
  for (const [etat, attendu] of attendus) {
    assert.deepEqual(annulation(etat), attendu, `au moment « ${gesteEnCours(etat).moment} »`);
    assert.deepEqual(offre(etat).annulation, annulation(etat));
    assert.equal(offre(etat).types.includes("annuler"), false);
    refuse(etat, ANNULER, "interdit", attendu.raison);
  }
  assert.deepEqual(gesteEnCours(auxSuites).moment, "suites");
  // Revenu du geste non payé, le bouton est de nouveau actif.
  assert.equal(annulation(jouer(enPreparation, { type: "revenir" })).actif, true);

  // Un état sans champ « annulation » se lit comme s'il n'avait rien à annuler.
  const { annulation: _rien, ...sansChamp } = lance;
  const ancien = geler(sansChamp);
  assert.deepEqual(annulation(ancien), rien);
  refuse(ancien, ANNULER, "interdit", "Rien à annuler depuis le lancement.");
  assert.equal(annulation(jouer(ancien, passer("pj1"))).actif, true);
});

// ─── e) La pile : une liste chaînée gelée, qui partage ──────────────────────

test("la pile : un maillon par geste, chaîné au précédent, gelé ; l'instantané partage les objets de son état ; « annuler » dépile en O(1)", () => {
  const lance = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  assert.equal(lance.annulation, SANS_ANNULATION);
  const passe = jouer(lance, passer("pj1"));
  const premier = passe.annulation.pile;
  assert.equal(Array.isArray(premier), false, "une liste chaînée, non un tableau");
  assert.deepEqual(Object.keys(premier), ["avant", "quoi", "plage", "precedent"]);
  assert.equal(premier.precedent, null);
  assert.deepEqual(premier.quoi, { genre: "passer", qui: "pj1" });
  assert.deepEqual(premier.plage, [2, 3]);
  // L'instantané : une copie de surface de l'état d'avant, sans journal, ni annonce, ni pile.
  assert.equal(premier.avant.protagonistes, lance.protagonistes);
  assert.equal(premier.avant.photos, lance.photos);
  assert.equal(premier.avant.noms, lance.noms);
  assert.deepEqual([premier.avant.journal, premier.avant.annonce, premier.avant.annulation], [null, null, null]);
  assert.deepEqual(Object.keys(premier.avant), Object.keys(lance), "les champs de l'état, dans son ordre");
  assert.equal(estGele(passe.annulation), true);

  // Le paiement met de côté l'état d'avant le geste ; le geste fini en fait le maillon, l'objet même.
  const paye = jouer(passe, capacite(passe, "pj3", "Frappe"), viser("adv2"), d8(8));
  const { attente } = paye.annulation;
  assert.notEqual(attente, null);
  assert.equal(paye.annulation.pile, premier, "rien n'est encore empilé");
  assert.deepEqual(attente.pile, [], "le geste en cours ôté");
  assert.equal(attente.protagonistes, passe.protagonistes, "pris avant le paiement");
  assert.equal(Object.isFrozen(attente), true);
  const deuxieme = jouer(paye, d8(2), d20(5), APPLIQUER).annulation;
  assert.equal(deuxieme.attente, null);
  assert.equal(deuxieme.pile.avant, attente);
  assert.equal(deuxieme.pile.precedent, premier);
  assert.equal(deuxieme.pile.quoi.genre, "capacite");
  assert.equal(deuxieme.pile.quoi.geste.acteur, "pj3");
  assert.notEqual(deuxieme.pile.quoi.geste.jet, null, "ses dés : la question le dira");
  assert.equal(estGele(deuxieme.pile), true);

  // « annuler » dépile : le maillon d'avant, l'objet même ; l'état repris partage tout avec l'instantané.
  const frappe = jouer(paye, d8(2), d20(5), APPLIQUER);
  const annule = jouer(frappe, ANNULER);
  assert.equal(annule.annulation.pile, frappe.annulation.pile.precedent);
  assert.equal(annule.annulation.pile, premier);
  assert.equal(annule.annulation.attente, null);
  assert.equal(annule.protagonistes, attente.protagonistes);
  assert.equal(annule.tour, attente.tour);
  assert.equal(Object.isFrozen(annule.annulation), true);
  const encore = jouer(annule, ANNULER);
  assert.equal(encore.annulation.pile, null);
  assert.equal(encore.protagonistes, lance.protagonistes);
});

// ─── f) Le plafond ──────────────────────────────────────────────────────────

test("« annuler » compte pour le plafond : accepté au dernier pas permis, puis refusé comme tout événement", () => {
  const mep = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON));
  const presque = etatEssai(mep, { retoucher: (etat) => (etat.pas = EVENEMENTS_MAX - 3) });
  // Deux passes : deux maillons ; le pas est alors EVENEMENTS_MAX − 1.
  const deux = jouer(presque, passer("pj1"), passer("adv2"));
  assert.equal(deux.pas, EVENEMENTS_MAX - 1);
  const dernier = jouer(deux, ANNULER);
  assert.equal(dernier.pas, EVENEMENTS_MAX);
  assert.equal(annulation(dernier).actif, true, "il reste un geste à annuler");
  refuse(dernier, ANNULER, "hors_bornes", "Ce combat a atteint 15 000 événements : commencez-en un nouveau.");
});

// ─── g) Le rejeu ────────────────────────────────────────────────────────────

test("le rejeu des annulations : le même état, journal compris ; le contenu passe par JSON, la pile non", () => {
  const miseEnPlace = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const evenements = [];
  let etat = ouvrirCombat(miseEnPlace);
  const noter = (...suite) => {
    for (const evenement of suite.flat()) {
      etat = jouer(etat, evenement);
      evenements.push(evenement);
    }
  };
  noter(LANCER, capacite(etat, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5), APPLIQUER);
  noter(passer("pj3"), ANNULER, ANNULER);
  noter(capacite(etat, "pj1", "Flambage", 0), CONFIRMER, FIN_DE_TOUR, ANNULER);
  const contenu = { regles: REGLES, revision: 1, miseEnPlace, evenements };

  // Le contenu ne garde que les événements : les dés du geste défait y restent, la pile n'y est pas.
  assert.equal(JSON.stringify(contenu).includes("annulation"), false);
  assert.equal(evenements.filter((evenement) => evenement.type === "annuler").length, 3);
  assert.equal(evenements.filter((evenement) => evenement.type === "de").length, 3);

  for (const relu of [rejouer(contenu), rejouer(JSON.parse(JSON.stringify(contenu)))]) {
    const { annulation: pileRelue, ...reste } = relu.etat;
    const { annulation: pile, ...attendu } = etat;
    assert.deepEqual(reste, attendu);
    assert.equal(JSON.stringify(reste), JSON.stringify(attendu));
    assert.deepEqual(JSON.parse(JSON.stringify(reste)), reste, "l'état, sans sa pile, passe par JSON à l'identique");
    // La pile se refait au rejeu : les mêmes gestes, d'autres objets.
    const genres = (annul) => {
      const liste = [];
      for (let maillon = annul.pile; maillon !== null; maillon = maillon.precedent) liste.push(maillon.quoi.genre);
      return liste;
    };
    assert.deepEqual(genres(pileRelue), genres(pile));
    assert.deepEqual(genres(pile), ["capacite"]);
    assert.notEqual(pileRelue.pile, pile.pile);
  }
  assert.deepEqual(textes(etat).filter((ligne) => ligne.startsWith("Annulé")), ["Annulé : Ciboulette — passer son tour.", "Annulé : Aubépine — Frappe.", "Annulé : la fin du tour des PJ."]);
  assert.equal(etat.protagonistes.pj1.souffle, 5, "le Flambage reste joué");
  assert.equal(etat.protagonistes.adv2.zones[0].armure, 10, "la Frappe est défaite");
});
