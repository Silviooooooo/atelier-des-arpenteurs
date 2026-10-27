// Contrôles de la pile des gestes (SPECIFICATION.md, § 17 « Le simulateur de
// combat (lot 4) » ; mission du lot 4.3, § 4.1, § 4.3, § 4.9 ; contrat de la
// vague 1, § 4, § 6.1, § 6.4, § 10) : js/combat/moteur.js et
// js/combat/offre.js.
//
// Au lot 4.3, un geste peut en interrompre un autre : une intervention, dans
// l'étape « Interventions » d'une attaque, ou une contre-attaque, après une
// face de contre-attaque, s'empilent sur lui, trois étages au plus ; fini, le
// geste emboîté rejoint celui du dessous sans écrire de ligne. Hors d'une
// attaque, « Intervenir… » ouvre un geste racine. Une façon Centrée vise
// plusieurs cibles, un jet par cible, ses seuls adversaires (l'auteur et ses
// alliés inactifs : contrat, § 12, choix 10) ; une contre-attaque Centrée, son
// attaquant seul (choix 12). « Annuler » défait le geste racine avec tout ce
// qui s'y est emboîté.
//
// Chaque règle est vue dans les deux sens : l'étape ouverte et celle qui ne
// s'ouvre pas, la contre-attaque possible et chacune des raisons qui
// l'empêchent, plusieurs cibles et une seule. Les protagonistes sont ceux de
// tests/outils/photographies_essai.js, retouchés : « Aubépine » et
// « Ciboulette » portent Dressage minute (une intervention gratuite, sans
// jet) ; Aubépine porte aussi Guetter (attendre). Tous sont sur la case D4,
// sauf mention. Les états se comparent par leurs valeurs, jamais en entier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { annulation, offre } from "../js/combat/offre.js";
import { adversaireEssai, capaciteEssai, chefDePartieEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-26T21:30" };
const APPLIQUER = { type: "appliquer" };
const CONFIRMER = { type: "confirmer" };
const REVENIR = { type: "revenir" };
const LAISSER = { type: "laisser" };
const ANNULER = { type: "annuler" };
const FIN_DE_TOUR = { type: "fin_de_tour" };

const SAUCIER = { genre: "archetype", titre: "Saucier" };
const dressage = () => capaciteEssai({ nom: "Dressage minute", groupe: SAUCIER, facons: [faconEssai({ description: "Sert un allié avant son tour.", elements: ["Intervention"], intervention: true })] });
const guetter = () =>
  capaciteEssai({ nom: "Guetter", role: "attendre", groupe: { genre: "base", titre: "Gestes de cuisine" }, facons: [faconEssai({ description: "Une capacité se joue en intervention." })] });

// Aubépine : 0 Frappe … 7 Pas de côté, 8 Dressage minute, 9 Guetter.
const AUBEPINE = pjEssai((champs) => champs.capacites.push(dressage(), guetter()));
// Ciboulette : 0 Frappe … 7 Pas de côté, 8 Dressage minute.
const CIBOULETTE = pjEssai((champs) => {
  champs.identifiant = "essai-ciboulette-0000000002";
  champs.nom = "Ciboulette";
  champs.capacites.push(dressage());
});
const PERSIL = pjEssai((champs) => {
  champs.identifiant = "essai-persil-0000000003";
  champs.nom = "Persil";
});
const MARMITON = adversaireEssai();
const CHEF = chefDePartieEssai();

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
const intervenir = (etat, qui, nom, facon = 0) => ({ type: "intervenir", qui, capacite: indice(etat, qui, nom), facon });
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });
const textes = (etat, depuis = 0) => etat.journal.slice(depuis).map((ligne) => ligne.texte);

// Le Marmiton attaque Aubépine, qui rate sa défense : C = 15, un d20 au torse.
// Les suites attendent, l'étape « Interventions » ouverte.
const attaqueDuMarmiton = (etat, cible = "pj1") => jouer(etat, capacite(etat, "adv2", "Frappe"), viser(cible), d8(2), d20(5));

// ─── L'étape « Interventions » ──────────────────────────────────────────────

test("l'étape « Interventions » : le jeté et ses alliés vivants, chacun avec ses options ; l'esquive au seul jeté", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const suites = attaqueDuMarmiton(depart);
  assert.equal(gesteEnCours(suites).moment, "suites");
  const { interventions, types } = offre(suites);
  assert.deepEqual(
    interventions.intervenants.map(({ qui }) => qui),
    ["pj1", "pj3"],
  );
  // Dressage minute, une option qui se paie ; l'esquive (Pas de côté) n'en est pas une : elle garde son événement.
  assert.deepEqual(interventions.intervenants[0].options, [{ capacite: 8, facon: 0, gardee: null, actif: true, raison: null }]);
  assert.deepEqual(interventions.esquive, { min: 1, max: 10, capacite: 7 });
  assert.ok(types.includes("intervenir") && types.includes("esquive") && types.includes("appliquer"));

  // Désarmé : sans action, Ciboulette n'est plus des intervenants ; mort, non plus.
  const sansAction = attaqueDuMarmiton(combat(surD4(AUBEPINE, MARMITON, pjEssai((champs) => Object.assign(champs, { nom: "Ciboulette", actions: 0, capacites: [...champs.capacites, dressage()] }))), { quiCommence: "adv" }));
  assert.deepEqual(
    offre(sansAction).interventions.intervenants.map(({ qui }) => qui),
    ["pj1"],
  );
  refuse(sansAction, intervenir(sansAction, "pj3", "Dressage minute"), "interdit", "Plus d'action à ce tour.");
  // L'attaqué est un adversaire sans intervention : l'étape s'ouvre sans personne, « Appliquer » la passe.
  const pjAttaque = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const surLeMarmiton = jouer(pjAttaque, capacite(pjAttaque, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));
  assert.deepEqual(offre(surLeMarmiton).interventions, { intervenants: [], esquive: null });
  assert.equal(offre(surLeMarmiton).types.includes("intervenir"), false);
  refuse(surLeMarmiton, intervenir(surLeMarmiton, "pj3", "Dressage minute"), "interdit");
  // Hors des suites, l'étape n'est pas ouverte.
  refuse(jouer(depart, capacite(depart, "adv2", "Frappe"), viser("pj1"), d8(2)), intervenir(depart, "pj3", "Dressage minute"), "hors_moment", "Le geste en cours n'en est pas là.");
});

test("une intervention dans l'étape s'empile, puis rejoint le geste du dessous sans écrire de ligne ; l'étape revient", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const suites = attaqueDuMarmiton(depart);
  const racine = gesteEnCours(suites);

  const emboite = jouer(suites, intervenir(suites, "pj3", "Dressage minute"));
  assert.equal(emboite.pile.length, 2);
  const haut = gesteEnCours(emboite);
  assert.deepEqual([haut.genre, haut.parent, haut.acteur, haut.moment, haut.paye], ["intervention", racine.numero, "pj3", "preparation", false]);
  assert.ok(emboite.pile[0] === racine, "le geste du dessous attend, l'objet même");
  // Un geste emboîté ne cède pas la place : ni une capacité, ni « passer », ni « Fin de tour » ne le retirent.
  // Dressage minute ne lance aucun dé : la palette n'a rien à lui offrir avant qu'il soit payé (choix 11).
  assert.deepEqual(offre(emboite).types, ["regler", "revenir", "confirmer"]);
  refuse(emboite, capacite(emboite, "adv2", "Frappe"), "hors_moment", "Le geste en cours se finit d'abord.");
  refuse(emboite, FIN_DE_TOUR, "hors_moment", "Le geste en cours se finit d'abord.");
  refuse(emboite, { type: "passer", qui: "adv2" }, "hors_moment", "Le geste en cours se finit d'abord.");

  // « Revenir » le retire : le dessous reprend à son moment, rien n'est payé.
  const revenu = jouer(emboite, REVENIR);
  assert.equal(revenu.pile.length, 1);
  assert.ok(revenu.pile[0] === racine);
  assert.equal(revenu.protagonistes.pj3.actions, 2);

  // Confirmée, elle coûte une action, puis son coût (nul), et rejoint le dessous.
  const joint = jouer(emboite, CONFIRMER);
  assert.equal(joint.pile.length, 1);
  const dessous = gesteEnCours(joint);
  assert.equal(dessous.moment, "suites");
  assert.equal(dessous.interventions.length, 1);
  const { geste } = dessous.interventions[0];
  assert.deepEqual([geste.genre, geste.acteur, geste.paye, geste.moment, geste.prix.actions], ["intervention", "pj3", true, "fini", 1]);
  assert.equal(joint.protagonistes.pj3.actions, 1);
  assert.equal(joint.journal.length, suites.journal.length, "aucune ligne : le journal la dira dans celle du geste racine");
  // L'étape revient, avec ceux qui peuvent encore : Ciboulette a gardé une action.
  assert.deepEqual(
    offre(joint).interventions.intervenants.map(({ qui }) => qui),
    ["pj1", "pj3"],
  );
  const deux = jouer(joint, intervenir(joint, "pj3", "Dressage minute"), CONFIRMER);
  assert.equal(gesteEnCours(deux).interventions.length, 2);
  assert.deepEqual(
    offre(deux).interventions.intervenants.map(({ qui }) => qui),
    ["pj1"],
  );
  // « Appliquer » clôt l'étape et le geste : une seule ligne, celle du geste racine.
  const fini = jouer(deux, APPLIQUER);
  assert.deepEqual(fini.pile, []);
  // La ligne du geste, puis la fin automatique du tour (le Marmiton a joué).
  assert.deepEqual(
    fini.journal.slice(suites.journal.length).map((ligne) => ligne.genre),
    ["geste", "cadre", "tour"],
  );
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 0, "les dégâts du Marmiton s'appliquent");
});

test("« Intervenir… » hors d'une attaque : le camp qui ne joue pas, un geste racine, sa ligne et son maillon", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const { interventions, types } = offre(depart);
  assert.deepEqual(
    interventions.intervenants.map(({ qui }) => qui),
    ["pj1", "pj3"],
  );
  assert.equal(interventions.esquive, null, "l'esquive ne s'offre que dans l'étape d'une attaque");
  assert.ok(types.includes("intervenir") && types.includes("capacite"));
  // Le camp qui joue n'intervient pas : il joue ses interventions comme des capacités.
  refuse(depart, intervenir(depart, "adv2", "Frappe"), "interdit", "Ce protagoniste ne peut pas intervenir à cet instant.");
  refuse(depart, intervenir(depart, "pj1", "Frappe"), "hors_bornes", "Cette capacité n'est pas une intervention de ce protagoniste.");
  refuse(depart, intervenir(depart, "pj1", "Pas de côté"), "hors_bornes", "Cette capacité n'est pas une intervention de ce protagoniste.");
  refuse(depart, { type: "intervenir", qui: "pj99", capacite: 8, facon: 0 }, "hors_bornes", "Ce protagoniste n'est pas dans le combat.");

  const ouvert = jouer(depart, intervenir(depart, "pj1", "Dressage minute"));
  const geste = gesteEnCours(ouvert);
  assert.deepEqual([geste.genre, geste.parent, geste.acteur], ["intervention", null, "pj1"]);
  // Un geste racine : il cède la place comme une capacité.
  assert.ok(offre(ouvert).types.includes("capacite"));
  const fini = jouer(ouvert, CONFIRMER);
  assert.deepEqual(fini.pile, []);
  assert.equal(fini.journal.length, depart.journal.length + 1);
  assert.equal(fini.protagonistes.pj1.actions, 1, "une action, dépensée pendant le tour adverse");
  assert.equal(annulation(fini).quoi.geste.genre, "intervention");
  const annule = jouer(fini, ANNULER);
  assert.ok(annule.protagonistes === depart.protagonistes, "le maillon défait l'intervention");

  // Au tour des PJ, « Intervenir… » ne s'offre qu'au camp adverse : les Marmitons n'ont pas d'intervention.
  const pj = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  assert.deepEqual(offre(pj).interventions.intervenants, []);
  refuse(pj, intervenir(pj, "pj1", "Dressage minute"), "interdit", "Ce protagoniste ne peut pas intervenir à cet instant.");

  // Un adversaire dont la Frappe est une intervention : au tour des PJ, il attaque Aubépine. Son geste,
  // une intervention, n'ouvre pas d'étape : ni intervention ni esquive pour Aubépine.
  const vif = adversaireEssai((champs) => {
    champs.capacites[0].facons[0].intervention = true;
    champs.capacites[0].facons[0].elements = ["Intervention"];
  });
  const auTourDesPj = combat(surD4(AUBEPINE, vif, CIBOULETTE));
  assert.deepEqual(
    offre(auTourDesPj).interventions.intervenants.map(({ qui }) => qui),
    ["adv2"],
  );
  const surAubepine = jouer(auTourDesPj, intervenir(auTourDesPj, "adv2", "Frappe"), viser("pj1"), d8(2), d20(5));
  assert.equal(gesteEnCours(surAubepine).moment, "suites");
  assert.equal(offre(surAubepine).esquive, null);
  assert.equal(offre(surAubepine).interventions, null);
  assert.equal(jouer(surAubepine, APPLIQUER).protagonistes.pj1.zones[1].armure, 0);
});

test("une intervention n'ouvre rien : ni étape, ni esquive, ni contre-attaque ; la ligne gardée par attendre en est une", () => {
  // Au tour des PJ, Aubépine garde sa Frappe ; au tour adverse, le Marmiton attaque Ciboulette.
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const garde = jouer(depart, capacite(depart, "pj1", "Guetter"), regler("garde", { capacite: 0, facon: 0 }), CONFIRMER, FIN_DE_TOUR);
  assert.deepEqual(garde.tour, { numero: 1, camp: "adv" });
  const guet = garde.effets.find((effet) => effet.genre === "guet");
  const suites = attaqueDuMarmiton(garde, "pj3");
  // L'attaquée d'abord, puis ses alliés.
  assert.deepEqual(
    offre(suites).interventions.intervenants.map(({ qui }) => qui),
    ["pj3", "pj1"],
  );
  const aubepine = offre(suites).interventions.intervenants[1];
  assert.deepEqual(aubepine.options, [
    { capacite: 0, facon: 0, gardee: guet.id, actif: true, raison: null },
    { capacite: 8, facon: 0, gardee: null, actif: true, raison: null },
  ]);

  // La Frappe gardée, jouée en intervention : une attaque, qui se règle et se lance comme une capacité.
  const emboite = jouer(suites, intervenir(suites, "pj1", "Frappe"));
  assert.equal(gesteEnCours(emboite).gardee, guet.id);
  assert.equal(gesteEnCours(emboite).mode, "attaque");
  const aSesSuites = jouer(emboite, viser("adv2"), d8(8), d8(2), d20(5));
  assert.equal(aSesSuites.pile.length, 2);
  assert.equal(gesteEnCours(aSesSuites).moment, "suites");
  const offert = offre(aSesSuites);
  assert.equal(offert.interventions, null, "son étape ne s'ouvre pas");
  assert.equal(offert.esquive, null);
  assert.equal(offert.types.includes("intervenir"), false);
  const joint = jouer(aSesSuites, APPLIQUER);
  assert.equal(joint.pile.length, 1);
  assert.equal(joint.protagonistes.adv2.zones[0].armure, 5, "la Frappe d'Aubépine a porté : A = 5");
  assert.ok(joint.effets.some((effet) => effet.id === guet.id), "elle reste gardée jusqu'à l'échéance");

  // Sa propre face de contre-attaque l'annule, sans plus : pas d'étape de contre-attaque.
  const annulee = jouer(emboite, viser("adv2"), d8(8), d8(2), d20(1));
  assert.equal(annulee.pile.length, 1, "le geste emboîté a fini, et rejoint le dessous");
  const { geste } = gesteEnCours(annulee).interventions[0];
  assert.deepEqual([geste.moment, geste.contre], ["fini", null]);
  assert.equal(annulee.protagonistes.adv2.actions, 0, "le Marmiton a joué ; il ne contre-attaque pas");
});

// ─── La contre-attaque ──────────────────────────────────────────────────────

// Aubépine frappe le Marmiton : une réussite, puis la face 1, la sienne.
const frappeContree = (etat) => jouer(etat, capacite(etat, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(1));

test("la contre-attaque possible : l'étape et ses options, puis « Laisser passer »", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const contre = frappeContree(depart);
  const geste = gesteEnCours(contre);
  assert.equal(geste.moment, "contre_attaque");
  const offerte = offre(contre).contre;
  assert.deepEqual([offerte.possible, offerte.raison, offerte.arme, offerte.portee, offerte.distance], [true, null, null, null, null]);
  // Les façons d'attaque de sa spatule : Frappe, Moulinet farineux (5 souffle, il en a 5).
  assert.deepEqual(offerte.options, [
    { capacite: 0, facon: 0, actif: true, raison: null },
    { capacite: 1, facon: 0, actif: true, raison: null },
  ]);
  assert.deepEqual(offre(contre).types, ["contre_attaquer", "laisser", "effet"]);
  refuse(contre, { type: "contre_attaquer", capacite: 2, facon: 0 }, "hors_bornes", "Cette capacité ne contre-attaque pas.");
  refuse(contre, APPLIQUER, "hors_moment");

  // Un personnage contre-attaque de son arme tenue : Frappe et Émincer, du couteau ; la Taloche, des mains
  // nues, n'en est pas.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const paree = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(2), d20(20));
  assert.deepEqual(
    offre(paree).contre.options.map(({ capacite: une, actif }) => [une, actif]),
    [
      [0, true],
      [1, true],
    ],
  );

  const laisse = jouer(contre, LAISSER);
  assert.deepEqual(laisse.pile, []);
  assert.deepEqual(annulation(laisse).quoi.geste.contre, { statut: "laissee" });
  assert.equal(laisse.protagonistes.adv2.actions, 1, "laisser passer ne coûte rien");
  assert.equal(laisse.journal.length, depart.journal.length + 1);
});

test("la contre-attaque jouée : un geste emboîté qui vise l'attaquant ; son étape a ses interventions, trois étages ; annuler défait tout", () => {
  // Ciboulette passe d'abord : un maillon d'avant, que l'annulation laissera.
  const lance = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const depart = jouer(lance, { type: "passer", qui: "pj3" });
  const contre = frappeContree(depart);
  const racine = gesteEnCours(contre);
  const joue = jouer(contre, { type: "contre_attaquer", capacite: 0, facon: 0 });
  assert.equal(joue.pile.length, 2);
  const riposte = gesteEnCours(joue);
  assert.deepEqual([riposte.genre, riposte.parent, riposte.acteur, riposte.cible, riposte.mode], ["contre_attaque", racine.numero, "adv2", "pj1", "attaque"]);
  // Sa cible est posée, sa façon choisie par l'étape : ni l'une ni l'autre ne se règle.
  const { reglages } = offre(joue);
  assert.equal("cible" in reglages, false);
  assert.equal("facon" in reglages, false);
  // L'inversion : c'est Aubépine qui lance sa défense, contre l'attaque 4 du Marmiton.
  assert.deepEqual(offre(joue).de, { faces: 8, combien: 1, motif: "chaine", place: 1 });
  // Un autre réglage ne lui retire pas sa cible.
  const regle = jouer(joue, regler("modificateur", 1, "Vapeur"));
  assert.deepEqual([gesteEnCours(regle).cible, offre(regle).pret.ok], ["pj1", true]);

  // Aucune réussite : C = 15, au torse ; l'étape de la contre-attaque s'ouvre (l'attaqué : Aubépine, et Ciboulette).
  const etape = jouer(joue, d8(1), d20(5));
  assert.equal(gesteEnCours(etape).moment, "suites");
  assert.equal(etape.protagonistes.adv2.actions, 0, "une action, puis son coût");
  assert.deepEqual(
    offre(etape).interventions.intervenants.map(({ qui }) => qui),
    ["pj1", "pj3"],
  );
  assert.deepEqual(offre(etape).esquive, { min: 1, max: 10, capacite: 7 });
  // Trois étages : Ciboulette intervient dans l'étape de la contre-attaque.
  const trois = jouer(etape, intervenir(etape, "pj3", "Dressage minute"));
  assert.equal(trois.pile.length, 3);
  assert.deepEqual(
    trois.pile.map((geste) => geste.genre),
    ["geste", "contre_attaque", "intervention"],
  );
  assert.equal(gesteEnCours(trois).parent, riposte.numero);
  const deux = jouer(trois, CONFIRMER);
  assert.equal(deux.pile.length, 2);
  assert.equal(gesteEnCours(deux).interventions.length, 1);

  // « Appliquer » : la contre-attaque finit, rejoint le geste racine, qui finit à son tour.
  const fini = jouer(deux, APPLIQUER);
  assert.deepEqual(fini.pile, []);
  assert.equal(fini.journal.length, depart.journal.length + 1, "une seule ligne : celle du geste racine");
  const { geste } = annulation(fini).quoi;
  assert.equal(geste.contre.statut, "jouee");
  assert.equal(geste.contre.geste.genre, "contre_attaque");
  assert.equal(geste.contre.geste.interventions[0].geste.acteur, "pj3");
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 0, "la contre-attaque a porté");

  // Pendant les gestes emboîtés, l'annulation attend la fin du geste racine.
  refuse(etape, ANNULER, "interdit", "Terminez d'abord le geste en cours.");
  // Annuler défait le geste racine avec sa contre-attaque et son intervention : l'état d'avant revient.
  const annule = jouer(fini, ANNULER);
  assert.ok(annule.protagonistes === depart.protagonistes, "les protagonistes d'avant la Frappe, l'objet même");
  assert.deepEqual(annule.pile, []);
  assert.deepEqual(annule.journal.at(-1).barre, [depart.journal.length, fini.journal.length]);
  assert.equal(annule.annulation.pile.quoi.genre, "passer", "un seul maillon défait : le geste racine ; la passe d'avant reste");
});

test("la contre-attaque d'une contre-attaque n'existe pas : sa propre face l'annule, sans plus", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const joue = jouer(frappeContree(depart), { type: "contre_attaquer", capacite: 0, facon: 0 });
  // La face 20, celle d'Aubépine, sur le d20 de la contre-attaque.
  const fini = jouer(joue, d8(1), d20(20));
  assert.deepEqual(fini.pile, [], "la contre-attaque finit, puis le geste racine");
  const { geste } = annulation(fini).quoi;
  assert.deepEqual([geste.contre.statut, geste.contre.geste.contre], ["jouee", null]);
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 10, "rien ne s'applique");
});

test("une contre-attaque Centrée vise l'attaquant seul, sans étape « Cible » (choix 12)", () => {
  // Aubépine frappe le Chef, Ciboulette sur la même case ; la face 1, la sienne : il riposte d'un Moulinet farineux.
  const depart = combat(surD4(AUBEPINE, CHEF, CIBOULETTE));
  const contre = frappeContree(depart);
  assert.ok(offre(contre).contre.options.some(({ capacite: une, actif }) => une === 1 && actif), "le Moulinet farineux est une de ses ripostes");
  const joue = jouer(contre, { type: "contre_attaquer", capacite: 1, facon: 0 });
  const riposte = gesteEnCours(joue);
  assert.deepEqual([riposte.genre, riposte.cible, riposte.cibles], ["contre_attaque", "pj1", null]);
  const { reglages } = offre(joue);
  assert.deepEqual(["cible" in reglages, "cibles" in reglages], [false, false]);
  // Aubépine ne pare pas : C au torse, sur elle seule, qui en est blessée.
  const touche = jouer(joue, d8(1), d20(5), APPLIQUER);
  assert.equal(gesteEnCours(touche).moment, "blessure");
  const fini = jouer(touche, { type: "blessure", libre: "Farine aux yeux" });
  assert.deepEqual(fini.pile, []);
  assert.equal(annulation(fini).quoi.geste.contre.geste.cibles, null);
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 0);
  assert.equal(fini.protagonistes.pj3.zones[1].armure, 10, "Ciboulette, sur la case, n'est pas visée");
  assert.equal(fini.protagonistes.adv2.souffle, 2, "7 − 5 : un seul coût, une seule cible");
});

test("la contre-attaque impossible : chaque raison, la première dans l'ordre action, arme, portée ; le geste continue", () => {
  const raisonDe = (etat) => annulation(etat).quoi.geste.contre;
  // Sans action : le Marmiton n'en a aucune.
  const lasse = combat(surD4(AUBEPINE, adversaireEssai((champs) => (champs.actions = 0))));
  const sansAction = frappeContree(lasse);
  assert.deepEqual(sansAction.pile, [], "le geste finit sur la face");
  assert.deepEqual(raisonDe(sansAction), { statut: "impossible", raison: "action", arme: null, portee: null, distance: null });
  // Sans arme : aucune façon d'attaque ne vient d'une arme.
  const desarme = adversaireEssai((champs) => {
    champs.armes = [];
    for (const une of champs.capacites) for (const facon of une.facons) facon.arme = null;
  });
  const sansArme = frappeContree(combat(surD4(AUBEPINE, desarme)));
  assert.deepEqual(raisonDe(sansArme), { statut: "impossible", raison: "arme", arme: null, portee: null, distance: null });
  // Hors de portée : Aubépine frappe de loin (portée 3), la spatule du Marmiton ne porte pas (0).
  const allonge = pjEssai((champs) => (champs.capacites[0].facons[0].portee = 3));
  const loin = combat([
    { photo: allonge, case: "D4" },
    { photo: MARMITON, case: "F4" },
  ]);
  const horsDePortee = frappeContree(loin);
  assert.deepEqual(raisonDe(horsDePortee), { statut: "impossible", raison: "portee", arme: "Spatule souple", portee: 0, distance: 2 });
  // L'ordre : sans action et hors de portée, c'est l'action qui se dit.
  const lasEtLoin = combat([
    { photo: allonge, case: "D4" },
    { photo: adversaireEssai((champs) => (champs.actions = 0)), case: "F4" },
  ]);
  assert.equal(raisonDe(frappeContree(lasEtLoin)).raison, "action");
  // Désarmé : à portée, avec son action, il le peut.
  assert.equal(offre(frappeContree(combat(surD4(AUBEPINE, MARMITON)))).contre.possible, true);
});

// ─── Plusieurs cibles ───────────────────────────────────────────────────────

// Le Chef joue Moulinet farineux, Centré : ses cibles sont les vivants de sa case.
const moulinet = (etat) => capacite(etat, "adv2", "Moulinet farineux");

test("plusieurs cibles d'office : les adversaires de l'auteur sur sa case, un jet par cible, le coût payé une fois, une ligne par cible", () => {
  // pj1 Aubépine, adv2 le Chef, pj3 Ciboulette, adv4 un Marmiton, tous en D4.
  const depart = combat(surD4(AUBEPINE, CHEF, CIBOULETTE, MARMITON), { quiCommence: "adv" });
  const ouvert = jouer(depart, moulinet(depart));
  const { reglages, pret } = offre(ouvert);
  assert.equal("cible" in reglages, false, "une façon Centrée ne règle pas une cible");
  // Les vivants de la case ; le Chef et son Marmiton, inactifs : le jet contre un allié ou contre soi n'est pas
  // écrit (choix 10).
  const ALLIE = "Le jet contre un allié ou contre soi n'est pas encore écrit dans les règles.";
  assert.deepEqual(reglages.cibles, {
    valeur: null,
    options: ["pj1", "pj3"],
    dOffice: ["pj1", "pj3"],
    vivants: [
      { id: "pj1", actif: true, raison: null },
      { id: "adv2", actif: false, raison: ALLIE },
      { id: "pj3", actif: true, raison: null },
      { id: "adv4", actif: false, raison: ALLIE },
    ],
  });
  refuse(ouvert, regler("cibles", ["pj1", "adv4"]), "interdit", ALLIE);
  refuse(ouvert, regler("cibles", ["adv2"]), "interdit", ALLIE);
  refuse(ouvert, regler("cibles", ["pj99", "adv4"]), "hors_bornes", "Ce protagoniste n'est pas un vivant de la case de l'auteur.");
  assert.deepEqual(pret, { ok: true });
  assert.equal(gesteEnCours(ouvert).cible, "pj1", "la première cible, que le jet lira");
  refuse(ouvert, viser("pj3"), "hors_moment", "Ce réglage ne s'offre pas à ce geste.");

  // La première cible : Aubépine pare (trois réussites contre 5) ; « Appliquer ».
  const premiere = jouer(ouvert, d8(8), d8(8), d8(8));
  assert.deepEqual(gesteEnCours(premiere).cibles, ["pj1", "pj3"]);
  assert.equal(premiere.protagonistes.adv2.souffle, 2, "le coût, payé au premier dé");
  const seconde = jouer(premiere, APPLIQUER);
  assert.equal(seconde.journal.length, depart.journal.length + 1, "la ligne de la première cible");
  const geste = gesteEnCours(seconde);
  assert.deepEqual([geste.rang, geste.cible, geste.moment, geste.faites.length, geste.faites[0].cible], [1, "pj3", "jet", 1, "pj1"]);
  assert.equal(geste.jet.lanceur, "pj3", "le jet de la cible suivante s'ouvre aussitôt");
  assert.equal(geste.jet.places.length, 0);
  assert.equal(seconde.protagonistes.adv2.souffle, 2, "rien de plus n'est payé");

  // La seconde : Ciboulette, une réussite, B = 12 au torse.
  const fini = jouer(seconde, d8(5), d8(1), d20(5), APPLIQUER);
  assert.deepEqual(fini.pile, []);
  assert.equal(fini.journal.length, depart.journal.length + 2, "une ligne par cible");
  assert.deepEqual([fini.protagonistes.pj3.zones[1].armure, fini.protagonistes.pj3.zones[1].resistance], [0, 3]);
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 10);
  // Annuler défait les deux cibles d'un coup.
  const annule = jouer(fini, ANNULER);
  assert.ok(annule.protagonistes === depart.protagonistes);
  assert.deepEqual(annule.journal.at(-1).barre, [depart.journal.length, fini.journal.length]);
});

test("plusieurs cibles réglées : dans l'ordre choisi ; une seule cible, d'office ou réglée, est une attaque ordinaire", () => {
  const depart = combat(surD4(AUBEPINE, CHEF, CIBOULETTE, MARMITON), { quiCommence: "adv" });
  const regle = jouer(depart, moulinet(depart), regler("cibles", ["pj3", "pj1"]));
  assert.equal(gesteEnCours(regle).cible, "pj3");
  const paye = jouer(regle, d8(8), d8(8), d8(8));
  assert.deepEqual(gesteEnCours(paye).cibles, ["pj3", "pj1"]);
  assert.equal(gesteEnCours(paye).jet.lanceur, "pj3");
  // Une cible hors de la case, ou nommée deux fois, ne se règle pas.
  refuse(jouer(depart, moulinet(depart)), regler("cibles", ["pj99"]), "hors_bornes");
  refuse(jouer(depart, moulinet(depart)), regler("cibles", ["pj1", "pj1"]), "forme");

  // Une seule cible réglée : ni liste ni rang, une seule ligne.
  const seule = jouer(depart, moulinet(depart), regler("cibles", ["pj3"]), d8(8), d8(8), d8(8));
  assert.deepEqual([gesteEnCours(seule).cibles, gesteEnCours(seule).cible], [null, "pj3"]);
  assert.equal(jouer(seule, APPLIQUER).journal.length, depart.journal.length + 1);
  // Une seule cible d'office : Aubépine seule sur la case du Chef.
  const isolee = combat(
    [
      { photo: AUBEPINE, case: "D4" },
      { photo: CHEF, case: "D4" },
      { photo: CIBOULETTE, case: "A1" },
    ],
    { quiCommence: "adv" },
  );
  const ordinaire = jouer(isolee, moulinet(isolee), d8(8), d8(8), d8(8));
  assert.deepEqual([gesteEnCours(ordinaire).cibles, gesteEnCours(ordinaire).cible], [null, "pj1"]);
  // Aucune cible d'office : le geste n'est pas prêt.
  const seulChef = combat(
    [
      { photo: AUBEPINE, case: "A1" },
      { photo: CHEF, case: "D4" },
    ],
    { quiCommence: "adv" },
  );
  assert.deepEqual(offre(jouer(seulChef, moulinet(seulChef))).pret, { ok: false, manque: "Choisissez une cible." });
  // Une façon qui n'est pas Centrée garde sa cible, à portée.
  assert.equal("cibles" in offre(jouer(depart, capacite(depart, "adv2", "Frappe"))).reglages, false);
});

test("plusieurs cibles : une cible morte entre-temps est sautée", () => {
  // Trois cibles d'office : Aubépine, Ciboulette, Persil. Les dégâts de la première sont reportés sur Ciboulette, et la tuent.
  const depart = combat(surD4(AUBEPINE, CHEF, CIBOULETTE, PERSIL), { quiCommence: "adv" });
  const bilan = jouer(
    depart,
    moulinet(depart),
    d8(1),
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 20, raison: "Coup de feu" }], nature: "corps" },
    { type: "effet", genre: "reporter", source: { genre: "mj" }, sur: "pj3" },
  );
  assert.deepEqual(gesteEnCours(bilan).cibles, ["pj1", "pj3", "pj4"]);
  const apres = jouer(bilan, d20(5), APPLIQUER);
  assert.deepEqual(apres.protagonistes.pj3.mort, { tour: 1 }, "Ciboulette meurt à la fin de la première cible");
  assert.equal(apres.protagonistes.pj1.corps, 10);
  const geste = gesteEnCours(apres);
  assert.deepEqual([geste.rang, geste.cible], [2, "pj4"], "Ciboulette est sautée");
  const fini = jouer(apres, d8(8), d8(8), d8(8), APPLIQUER);
  assert.deepEqual(fini.pile, []);
  const gestes = fini.journal.slice(depart.journal.length).filter((ligne) => ligne.genre === "geste");
  assert.equal(gestes.length, 2, "deux lignes : la cible sautée n'en a pas");
  assert.equal(gestes[0].mort, true, "la première dit la mort de Ciboulette");
});
