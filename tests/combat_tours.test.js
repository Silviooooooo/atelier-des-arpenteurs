// Contrôles des tours du combat (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : js/combat/moteur.js et js/combat/offre.js. Qui peut jouer,
// l'alternance dans un camp, « Passer son tour », la fin automatique d'un
// tour et « Fin de tour », les actions retrouvées, le numéro du tour, la
// mort, et la fin du combat.
//
// Chaque règle est vue dans les deux sens : le tour qui finit de lui-même et
// celui qui attend encore quelqu'un, les actions retrouvées par un camp et
// laissées à l'autre, le coup qui tue et celui qui laisse un point de corps,
// le combat qui finit et celui qui continue.
//
// Les protagonistes sont ceux de tests/outils/photographies_essai.js :
// « Aubépine » et « Ciboulette », deux personnages à deux actions, et des
// « Marmiton » à une action. Tous sont sur la case D4, sauf mention.

import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { acteurCourant, candidats, cibles, offre } from "../js/combat/offre.js";
import { aJoue, vivant } from "../js/combat/valeurs.js";
import { adversaireEssai, etatEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const AUBEPINE = pjEssai();
const CIBOULETTE = pjEssai((champs) => {
  champs.identifiant = "essai-ciboulette-0000000002";
  champs.nom = "Ciboulette";
});
const MARMITON = adversaireEssai();

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

const capacite = (etat, qui, nom, facon = 0) => ({ type: "capacite", qui, capacite: etat.photos[qui].capacites.findIndex((une) => une.nom === nom), facon });
const viser = (id) => ({ type: "regler", champ: "cible", valeur: id });
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });
const passer = (qui) => ({ type: "passer", qui });
const APPLIQUER = { type: "appliquer" };

// Une Frappe d'un PJ qui manque (1 contre une défense de 5) : une action
// dépensée, et rien d'autre.
const frappeManquee = (etat, qui, cible) => [capacite(etat, qui, "Frappe"), viser(cible), d8(1)];
// Une Frappe d'un adversaire que le PJ pare (trois réussites contre 4) : une
// action dépensée, et rien d'autre.
const frappeParee = (etat, qui, cible) => [capacite(etat, qui, "Frappe"), viser(cible), d8(8), d8(8), d8(8)];
// Une Frappe qui touche et tue : les dégâts sont fixés à la main, droit au corps.
const coupMortel = (etat, qui, cible, des, degats = 10) => [
  capacite(etat, qui, "Frappe"),
  viser(cible),
  ...des,
  { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: degats, raison: "Dernier service" }], nature: "corps" },
  d20(5),
  APPLIQUER,
];

const textes = (etat, depuis = 0) => etat.journal.slice(depuis).map((ligne) => ligne.texte);
const actions = (etat) => Object.fromEntries(etat.ordre.map((id) => [id, etat.protagonistes[id].actions]));

const FIN_DES_PJ = "Fin du tour des PJ : ils retrouvent leurs actions.";
const FIN_DES_ADVERSAIRES = "Fin du tour des adversaires : ils retrouvent leurs actions.";
const tourDes = (numero, camp) => `— Tour ${numero} · camp des ${camp} —`;

// Deux PJ et deux Marmitons : pj1, adv2, pj3, adv4.
const aQuatre = (options) => combat(surD4(AUBEPINE, MARMITON, CIBOULETTE, MARMITON), options);

// ─── Qui peut jouer ─────────────────────────────────────────────────────────

test("candidats : les vivants du camp qui joue, qui n'ont pas joué, dans l'ordre d'ajout", () => {
  const mep = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON, CIBOULETTE, MARMITON));
  assert.deepEqual(candidats(ouvrirCombat(mep)), [], "personne avant le lancement");

  const depart = jouer(ouvrirCombat(mep), LANCER);
  assert.deepEqual(candidats(depart), ["pj1", "pj3"]);
  assert.deepEqual(candidats(jouer(depart, FIN_DE_TOUR)), ["adv2", "adv4"]);
  assert.deepEqual(candidats(aQuatre({ quiCommence: "adv" })), ["adv2", "adv4"]);

  // Qui a passé son tour n'est plus candidat ; qui n'a plus d'action non plus.
  assert.deepEqual(candidats(jouer(depart, passer("pj1"))), ["pj3"]);
  const uneAction = jouer(depart, frappeManquee(depart, "pj3", "adv2"));
  assert.deepEqual(candidats(uneAction), ["pj1", "pj3"], "il reste une action à Ciboulette");
  assert.deepEqual(candidats(jouer(uneAction, frappeManquee(depart, "pj3", "adv2"))), ["pj1"]);

  // Un mort n'est candidat à rien.
  const endeuille = etatEssai(mep, {
    retoucher(etat) {
      etat.protagonistes.pj1.corps = 0;
      etat.protagonistes.pj1.mort = { tour: 1 };
    },
  });
  assert.deepEqual(candidats(endeuille), ["pj3"]);
});

test("acteurCourant : l'acteur du geste en cours ; sinon celui qu'on a choisi, tant qu'il peut agir", () => {
  const depart = aQuatre();
  assert.equal(acteurCourant(depart, null), null);
  assert.equal(acteurCourant(depart, "pj3"), "pj3");
  assert.equal(acteurCourant(depart, "adv2"), null, "ce n'est pas le tour de son camp");
  assert.equal(acteurCourant(depart, "pj9"), null);
  const ouvert = jouer(depart, capacite(depart, "pj1", "Frappe"));
  assert.equal(acteurCourant(ouvert, "pj3"), "pj1", "le geste ouvert dit qui joue");
  assert.equal(acteurCourant(jouer(depart, passer("pj3")), "pj3"), null, "elle a passé son tour");
});

test("seul le camp qui joue agit : un adversaire ne joue pas pendant le tour des PJ, ni l'inverse", () => {
  const depart = aQuatre();
  const pasSonTour = "Ce protagoniste ne peut pas jouer à cet instant.";
  refuse(depart, capacite(depart, "adv2", "Frappe"), "interdit", pasSonTour);
  refuse(depart, passer("adv2"), "interdit", pasSonTour);
  assert.equal(gesteEnCours(jouer(depart, capacite(depart, "pj1", "Frappe"))).acteur, "pj1");

  const adverse = jouer(depart, FIN_DE_TOUR);
  refuse(adverse, capacite(adverse, "pj1", "Frappe"), "interdit", pasSonTour);
  refuse(adverse, passer("pj3"), "interdit", pasSonTour);
  assert.equal(gesteEnCours(jouer(adverse, capacite(adverse, "adv4", "Frappe"))).acteur, "adv4");
});

test("l'alternance : dans le camp qui joue, les protagonistes alternent leurs actions, dans l'ordre qu'on veut", () => {
  const depart = aQuatre();
  const alterne = jouer(depart, frappeManquee(depart, "pj3", "adv2"), frappeManquee(depart, "pj1", "adv4"), frappeManquee(depart, "pj3", "adv4"));
  assert.deepEqual(
    textes(alterne, 2).map((ligne) => ligne.split(" : ")[0]),
    ["Ciboulette", "Aubépine", "Ciboulette"],
  );
  assert.deepEqual(actions(alterne), { pj1: 1, adv2: 1, pj3: 0, adv4: 1 });
  assert.deepEqual(alterne.tour, { numero: 1, camp: "pj" }, "Aubépine a encore une action : le tour continue");
  // Ciboulette n'a plus d'action : elle a joué. Aubépine joue encore.
  assert.equal(aJoue(alterne, "pj3"), true);
  refuse(alterne, capacite(alterne, "pj3", "Frappe"), "interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
  assert.equal(aJoue(alterne, "pj1"), false);
  assert.equal(gesteEnCours(jouer(alterne, capacite(alterne, "pj1", "Frappe"))).acteur, "pj1");
});

// ─── Passer son tour ────────────────────────────────────────────────────────

test("passer son tour ne coûte rien : le protagoniste a joué, sa ligne s'écrit, ses actions restent", () => {
  const depart = aQuatre();
  const passe = jouer(depart, passer("pj1"));
  assert.deepEqual(textes(passe, 2), ["Aubépine passe son tour."]);
  assert.deepEqual(passe.journal[2], { genre: "geste", texte: "Aubépine passe son tour." });
  assert.deepEqual(passe.annonce, { pas: passe.pas, texte: "Aubépine passe son tour." });
  assert.equal(passe.protagonistes.pj1.passe, true);
  assert.equal(passe.protagonistes.pj1.actions, 2);
  assert.equal(passe.protagonistes.pj1.souffle, 10);
  assert.equal(aJoue(passe, "pj1"), true);
  assert.equal(aJoue(passe, "pj3"), false);
  assert.equal(passe.protagonistes.pj3, depart.protagonistes.pj3, "rien ne change pour les autres : le même objet");
  // Il ne joue plus à ce tour, et ne passe pas deux fois.
  refuse(passe, capacite(passe, "pj1", "Frappe"), "interdit");
  refuse(passe, passer("pj1"), "interdit");
  refuse(passe, passer("pj9"), "hors_bornes", "Ce protagoniste n'est pas dans le combat.");
});

test("passer retire un geste dont rien n'est payé, sans rien dépenser", () => {
  const depart = aQuatre();
  const ouvert = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"));
  // Ciboulette passe pendant qu'Aubépine prépare son Émincer : le geste est retiré.
  const passe = jouer(ouvert, passer("pj3"));
  assert.deepEqual(passe.pile, []);
  assert.equal(passe.protagonistes.pj1, depart.protagonistes.pj1);
  assert.deepEqual(candidats(passe), ["pj1"]);
});

test("les actions gardées en passant servent encore aux interventions du tour adverse, et le « passé » s'efface à la fin de son tour", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  // Aubépine passe : le tour des PJ finit de lui-même, elle garde ses deux actions.
  const adverse = jouer(depart, passer("pj1"));
  assert.deepEqual(adverse.tour, { numero: 1, camp: "adv" });
  assert.equal(adverse.protagonistes.pj1.passe, false, "son camp a fini son tour : elle n'a plus « passé »");
  assert.equal(adverse.protagonistes.pj1.actions, 2);
  const suites = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(1), d20(5));
  assert.deepEqual(offre(suites).esquive, { min: 1, max: 10, capacite: 7 });

  // Le « passé » d'un adversaire ne s'efface pas à la fin du tour des PJ : seulement à la fin du sien.
  const aDeux = combat(surD4(AUBEPINE, MARMITON, MARMITON), { quiCommence: "adv" });
  const unPasse = jouer(aDeux, passer("adv2"));
  assert.equal(unPasse.protagonistes.adv2.passe, true);
  assert.deepEqual(unPasse.tour, { numero: 1, camp: "adv" }, "l'autre Marmiton n'a pas joué");
  const tousPasses = jouer(unPasse, passer("adv3"));
  assert.deepEqual(tousPasses.tour, { numero: 1, camp: "pj" });
  assert.equal(tousPasses.protagonistes.adv2.passe, false);
  assert.equal(tousPasses.protagonistes.adv3.passe, false);
});

// ─── La fin d'un tour ───────────────────────────────────────────────────────

test("la fin automatique : le tour d'un camp finit de lui-même quand tous ses vivants ont joué, pas avant", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const une = jouer(depart, frappeManquee(depart, "pj1", "adv2"));
  assert.deepEqual(une.tour, { numero: 1, camp: "pj" });
  assert.equal(une.journal.length, 3, "une action reste à Aubépine : rien ne finit");

  const deux = jouer(une, frappeManquee(depart, "pj1", "adv2"));
  assert.deepEqual(deux.tour, { numero: 1, camp: "adv" });
  assert.deepEqual(textes(deux, 4), [FIN_DES_PJ, tourDes(1, "adversaires")]);
  assert.deepEqual(deux.journal.slice(4), [
    { genre: "cadre", texte: FIN_DES_PJ },
    { genre: "tour", texte: tourDes(1, "adversaires") },
  ]);
  // L'annonce dit la ligne du geste, puis les lignes de cadre, à la suite.
  assert.equal(deux.annonce.texte, textes(deux, 3).join(" "));
  assert.equal(deux.annonce.pas, deux.pas);

  // À deux PJ, le tour attend les deux : l'un sans action, l'autre qui passe.
  const aDeux = aQuatre();
  const cibouletteAJoue = jouer(aDeux, frappeManquee(aDeux, "pj3", "adv2"), frappeManquee(aDeux, "pj3", "adv2"));
  assert.deepEqual(cibouletteAJoue.tour, { numero: 1, camp: "pj" });
  assert.deepEqual(jouer(cibouletteAJoue, passer("pj1")).tour, { numero: 1, camp: "adv" });
});

test("la fin automatique ne compte que les vivants : un mort n'a pas à jouer", () => {
  const mep = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const endeuille = etatEssai(mep, {
    retoucher(etat) {
      etat.protagonistes.pj3.corps = 0;
      etat.protagonistes.pj3.mort = { tour: 1 };
    },
  });
  const fini = jouer(endeuille, passer("pj1"));
  assert.deepEqual(fini.tour, { numero: 1, camp: "adv" });
  // Vivante, Ciboulette aurait retenu le tour.
  assert.deepEqual(jouer(etatEssai(mep), passer("pj1")).tour, { numero: 1, camp: "pj" });
  // Le mort ne retrouve rien : son état ne bouge plus.
  assert.equal(fini.protagonistes.pj3, endeuille.protagonistes.pj3);
});

test("« Fin de tour » finit le tour à tout moment, sauf au milieu d'une action, et écrit la même ligne que la fin automatique", () => {
  const depart = aQuatre();
  // Personne n'a joué : le tour finit quand même.
  const fini = jouer(depart, FIN_DE_TOUR);
  assert.deepEqual(fini.tour, { numero: 1, camp: "adv" });
  assert.deepEqual(textes(fini, 2), [FIN_DES_PJ, tourDes(1, "adversaires")]);
  assert.deepEqual(fini.annonce, { pas: fini.pas, texte: `${FIN_DES_PJ} ${tourDes(1, "adversaires")}` });

  // Un geste dont rien n'est payé est retiré, sans rien dépenser.
  const ouvert = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"));
  const coupe = jouer(ouvert, FIN_DE_TOUR);
  assert.deepEqual(coupe.pile, []);
  assert.deepEqual(actions(coupe), { pj1: 2, adv2: 1, pj3: 2, adv4: 1 });
  assert.equal(coupe.protagonistes.pj1.souffle, 10);
  assert.deepEqual(textes(coupe), textes(fini));

  // Au milieu d'une action (le premier dé est lancé), il est refusé.
  const enCours = jouer(ouvert, d8(8, 8));
  assert.equal(gesteEnCours(enCours).paye, true);
  refuse(enCours, FIN_DE_TOUR, "hors_moment", "Le geste en cours se finit d'abord.");
});

test("les actions retrouvées : à la fin du tour d'un camp, ses protagonistes retrouvent toutes leurs actions ; l'autre camp, non", () => {
  const depart = aQuatre();
  const entame = jouer(depart, frappeManquee(depart, "pj1", "adv2"), frappeManquee(depart, "pj3", "adv2"), frappeManquee(depart, "pj3", "adv2"));
  assert.deepEqual(actions(entame), { pj1: 1, adv2: 1, pj3: 0, adv4: 1 });
  const adverse = jouer(entame, FIN_DE_TOUR);
  assert.deepEqual(actions(adverse), { pj1: 2, adv2: 1, pj3: 2, adv4: 1 });

  // Un Marmiton joue, le tour des adversaires finit : eux seuls retrouvent leurs actions.
  const unAJoue = jouer(adverse, frappeParee(adverse, "adv2", "pj1"));
  assert.deepEqual(actions(unAJoue), { pj1: 2, adv2: 0, pj3: 2, adv4: 1 });
  assert.deepEqual(actions(jouer(unAJoue, FIN_DE_TOUR)), { pj1: 2, adv2: 1, pj3: 2, adv4: 1 });
});

test("l'action dépensée en esquive pendant le tour adverse manque au tour suivant, et ne revient qu'à la fin de son propre tour", () => {
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  // Le Marmiton attaque, Aubépine esquive : une action de moins. Le tour des
  // adversaires finit de lui-même (le Marmiton n'a qu'une action).
  const esquive = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(1), d20(5), { type: "esquive", x: 2 }, APPLIQUER);
  assert.deepEqual(esquive.tour, { numero: 1, camp: "pj" });
  assert.deepEqual(actions(esquive), { pj1: 1, adv2: 1 }, "le Marmiton a retrouvé la sienne ; Aubépine, non");

  // À son tour, il ne lui reste qu'une action : après elle, son tour finit, et ses deux actions reviennent.
  const apresUne = jouer(esquive, frappeManquee(esquive, "pj1", "adv2"));
  assert.deepEqual(apresUne.tour, { numero: 2, camp: "adv" });
  assert.deepEqual(actions(apresUne), { pj1: 2, adv2: 1 });

  // Sans esquive, elle aurait eu ses deux actions : la première ne finit pas son tour.
  const sansEsquive = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(1), d20(5), APPLIQUER);
  assert.deepEqual(actions(sansEsquive), { pj1: 2, adv2: 1 });
  assert.deepEqual(jouer(sansEsquive, frappeManquee(sansEsquive, "pj1", "adv2")).tour, { numero: 1, camp: "pj" });
});

test("le numéro du tour monte quand le camp qui a commencé rejoue, que ce soient les PJ ou les adversaires", () => {
  for (const [quiCommence, premier, second] of [
    ["pj", "PJ", "adversaires"],
    ["adv", "adversaires", "PJ"],
  ]) {
    const autre = quiCommence === "pj" ? "adv" : "pj";
    const depart = aQuatre({ quiCommence });
    const tours = [depart];
    for (let fois = 0; fois < 4; fois += 1) tours.push(jouer(tours[tours.length - 1], FIN_DE_TOUR));
    assert.deepEqual(
      tours.map((etat) => etat.tour),
      [
        { numero: 1, camp: quiCommence },
        { numero: 1, camp: autre },
        { numero: 2, camp: quiCommence },
        { numero: 2, camp: autre },
        { numero: 3, camp: quiCommence },
      ],
    );
    assert.deepEqual(
      textes(tours[4]).filter((ligne) => ligne.startsWith("—")),
      [tourDes(1, premier), tourDes(1, second), tourDes(2, premier), tourDes(2, second), tourDes(3, premier)],
    );
  }
});

// ─── Les camps qui ne peuvent pas agir ──────────────────────────────────────

const SANS_ACTION = adversaireEssai((champs) => (champs.actions = 0));

test("un camp qui commence sans pouvoir agir voit son tour finir dès le lancement", () => {
  const lance = combat(surD4(AUBEPINE, SANS_ACTION), { quiCommence: "adv" });
  assert.deepEqual(textes(lance), [
    "Combat lancé : 1 personnage contre 1 adversaire. Les adversaires commencent.",
    tourDes(1, "adversaires"),
    FIN_DES_ADVERSAIRES,
    tourDes(1, "PJ"),
  ]);
  assert.deepEqual(lance.tour, { numero: 1, camp: "pj" });
  assert.equal(lance.pas, 1);
  assert.deepEqual(lance.annonce, { pas: 1, texte: textes(lance).join(" ") });
  assert.deepEqual(candidats(lance), ["pj1"]);

  // Avec une action, le même adversaire garde la main : rien ne finit.
  const attend = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  assert.equal(attend.journal.length, 2);
  assert.deepEqual(attend.tour, { numero: 1, camp: "adv" });

  // Plus tard, le tour de ces adversaires se passe de même : les PJ rejouent aussitôt.
  const suite = jouer(lance, passer("pj1"));
  assert.deepEqual(textes(suite, 4), ["Aubépine passe son tour.", FIN_DES_PJ, tourDes(2, "adversaires"), FIN_DES_ADVERSAIRES, tourDes(2, "PJ")]);
  assert.deepEqual(suite.tour, { numero: 2, camp: "pj" });
});

test("deux fins de tour d'affilée au plus : quand aucun camp ne peut agir, le combat attend « Fin de tour »", () => {
  const immobile = pjEssai((champs) => (champs.actions = 0));
  const lance = combat(surD4(immobile, SANS_ACTION));
  // Le lancement : le tour des PJ finit, puis celui des adversaires, et l'on s'arrête là.
  assert.deepEqual(textes(lance), [
    "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent.",
    tourDes(1, "PJ"),
    FIN_DES_PJ,
    tourDes(1, "adversaires"),
    FIN_DES_ADVERSAIRES,
    tourDes(2, "PJ"),
  ]);
  assert.deepEqual(lance.tour, { numero: 2, camp: "pj" });
  assert.equal(lance.phase, "combat");
  assert.deepEqual(candidats(lance), []);
  assert.deepEqual(offre(lance).types, ["fin_de_tour"], "seule « Fin de tour » s'offre");

  // « Fin de tour » : la fin demandée, puis deux fins automatiques, pas une de plus.
  const pousse = jouer(lance, FIN_DE_TOUR);
  assert.deepEqual(textes(pousse, 6), [FIN_DES_PJ, tourDes(2, "adversaires"), FIN_DES_ADVERSAIRES, tourDes(3, "PJ"), FIN_DES_PJ, tourDes(3, "adversaires")]);
  assert.deepEqual(pousse.tour, { numero: 3, camp: "adv" });
  assert.equal(pousse.pas, 2);
  assert.equal(pousse.annonce.texte, textes(pousse, 6).join(" "));
});

// ─── La mort ────────────────────────────────────────────────────────────────

test("la mort : à 0 point de corps, un protagoniste meurt ; il ne joue plus et ne se cible plus", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const tue = jouer(depart, coupMortel(depart, "pj1", "adv2", [d8(8), d8(1)]));
  assert.equal(tue.protagonistes.adv2.corps, 0);
  assert.deepEqual(tue.protagonistes.adv2.mort, { tour: 1 });
  assert.equal(vivant(tue, "adv2"), false);
  assert.equal(vivant(tue, "adv3"), true);
  assert.deepEqual(tue.journal[2], {
    genre: "geste",
    texte: "Aubépine : Frappe contre Marmiton n° 1. d8 contre 5 → 8 ✓, 1 ✗ : 1 réussite, A = 5, dégâts directs au corps : 10 (Dernier service). Localisation d20 → 5 : torse. Corps 10 → 0. Marmiton n° 1 meurt.",
    mort: true,
  });
  assert.equal(tue.phase, "combat", "il reste un adversaire : le combat continue");

  // Il ne se cible plus : ni par une attaque, ni par une capacité sans jet.
  const frappe = jouer(tue, capacite(tue, "pj1", "Frappe"));
  assert.deepEqual(cibles(frappe), [
    { id: "adv2", possible: false, raison: "mort" },
    { id: "adv3", possible: true, raison: null },
  ]);
  refuse(frappe, viser("adv2"), "interdit", "mort");
  const flambage = jouer(tue, capacite(tue, "pj1", "Flambage"));
  assert.deepEqual(offre(flambage).reglages.cible.options, [null, "pj1", "adv3"]);
  refuse(flambage, viser("adv2"), "interdit", "mort");

  // Il ne joue plus : au tour des adversaires, seul le vivant est candidat, et le tour finit avec lui.
  const adverse = jouer(tue, FIN_DE_TOUR);
  assert.deepEqual(candidats(adverse), ["adv3"]);
  refuse(adverse, capacite(adverse, "adv2", "Frappe"), "interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
  refuse(adverse, passer("adv2"), "interdit");
  assert.deepEqual(jouer(adverse, passer("adv3")).tour, { numero: 2, camp: "pj" });
  assert.deepEqual(adverse.protagonistes.adv2, tue.protagonistes.adv2, "la fin d'un tour ne touche pas au mort");
});

test("à 1 point de corps, on vit encore : ni mort, ni ligne marquée, et l'on reste une cible", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const blesse = jouer(depart, coupMortel(depart, "pj1", "adv2", [d8(8), d8(1)], 9));
  assert.equal(blesse.protagonistes.adv2.corps, 1);
  assert.equal(blesse.protagonistes.adv2.mort, null);
  assert.equal("mort" in blesse.journal[2], false);
  assert.doesNotMatch(blesse.journal[2].texte, /meurt/);
  const frappe = jouer(blesse, capacite(blesse, "pj1", "Frappe"));
  assert.deepEqual(cibles(frappe), [
    { id: "adv2", possible: true, raison: null },
    { id: "adv3", possible: true, raison: null },
  ]);
  assert.deepEqual(candidats(jouer(blesse, FIN_DE_TOUR)), ["adv2", "adv3"]);
});

test("la mort porte le numéro du tour où elle survient", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const auTour2 = jouer(depart, FIN_DE_TOUR, FIN_DE_TOUR);
  assert.deepEqual(auTour2.tour, { numero: 2, camp: "pj" });
  assert.deepEqual(jouer(auTour2, coupMortel(auTour2, "pj1", "adv3", [d8(8), d8(1)])).protagonistes.adv3.mort, { tour: 2 });
});

// ─── La fin du combat ───────────────────────────────────────────────────────

test("la fin du combat : quand un camp n'a plus de vivant, « Combat terminé », sans « Fin du tour », et personne ne retrouve ses actions", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  // Aubépine dépense sa première action, puis tue le Marmiton avec la dernière.
  const derniere = jouer(depart, frappeManquee(depart, "pj1", "adv2"));
  const fini = jouer(derniere, coupMortel(derniere, "pj1", "adv2", [d8(8), d8(1)]));
  assert.equal(fini.phase, "termine");
  assert.equal(fini.vainqueur, "pj");
  assert.deepEqual(fini.pile, []);
  assert.deepEqual(fini.journal.slice(4), [{ genre: "fin", texte: "Combat terminé : victoire des PJ." }]);
  assert.equal(fini.journal[3].mort, true);
  assert.match(fini.journal[3].texte, /Marmiton meurt\.$/);
  assert.equal(
    textes(fini).some((ligne) => ligne.startsWith("Fin du tour")),
    false,
  );
  assert.equal(fini.protagonistes.pj1.actions, 0, "le combat finit pendant son tour : ses actions ne reviennent pas");
  assert.deepEqual(fini.tour, { numero: 1, camp: "pj" });
  assert.equal(fini.annonce.texte, `${fini.journal[3].texte} Combat terminé : victoire des PJ.`);

  // On ne joue plus : rien ne s'offre, tout est refusé.
  assert.deepEqual(candidats(fini), []);
  assert.deepEqual(offre(fini).types, []);
  for (const evenement of [FIN_DE_TOUR, passer("pj1"), capacite(fini, "pj1", "Frappe"), LANCER, APPLIQUER]) {
    refuse(fini, evenement, "hors_moment", "Le combat est terminé.");
  }
});

test("la victoire va au camp qui reste : celle des adversaires quand le dernier PJ meurt", () => {
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const fini = jouer(adverse, coupMortel(adverse, "adv2", "pj1", [d8(1)]));
  assert.equal(fini.phase, "termine");
  assert.equal(fini.vainqueur, "adv");
  assert.deepEqual(fini.protagonistes.pj1.mort, { tour: 1 });
  assert.deepEqual(textes(fini, 3), ["Combat terminé : victoire des adversaires."]);
  assert.match(fini.journal[2].texte, /Corps 10 → 0\. Aubépine meurt\.$/);
});

test("tant qu'un vivant reste dans chaque camp, le combat continue, et le tour finit comme d'habitude", () => {
  // Deux Marmitons : le premier meurt de la dernière action d'Aubépine.
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const derniere = jouer(depart, frappeManquee(depart, "pj1", "adv2"));
  const suite = jouer(derniere, coupMortel(derniere, "pj1", "adv2", [d8(8), d8(1)]));
  assert.equal(suite.phase, "combat");
  assert.equal(suite.vainqueur, null);
  assert.deepEqual(textes(suite, 4), [FIN_DES_PJ, tourDes(1, "adversaires")]);
  assert.equal(suite.protagonistes.pj1.actions, 2);
  assert.deepEqual(candidats(suite), ["adv3"]);

  // Deux PJ : l'un meurt, l'autre reste, les adversaires n'ont pas gagné.
  const aDeux = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const endeuille = jouer(aDeux, coupMortel(aDeux, "adv2", "pj3", [d8(1)]));
  assert.equal(endeuille.phase, "combat");
  assert.deepEqual(endeuille.protagonistes.pj3.mort, { tour: 1 });
  assert.deepEqual(candidats(endeuille), ["pj1"]);
});
