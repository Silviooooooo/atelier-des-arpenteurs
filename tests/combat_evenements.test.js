// Contrôles des événements du combat (SPECIFICATION.md, § 17 et § 11,
// domaine « Combat ») : js/combat/offre.js, js/combat/moteur.js, et le
// lecteur de scénario, tests/outils/scenario.js.
//
// Un combat est une mise en place, puis une suite d'événements : ce fichier
// tient la table « quel événement est valide à quel moment », ligne par
// ligne, sur un état témoin par colonne ; ce que rend un refus (l'état reçu,
// l'objet même, et l'un des quatre codes) ; ce que fait chaque événement au
// geste en cours ; et le rejeu, qui retrouve l'état au signe près.
//
// Chaque règle est vue dans les deux sens : l'événement accepté dans sa
// colonne et refusé dans la voisine, le dé attendu et celui qui ne l'est pas,
// la cible gardée et la cible retirée, le d20 qui clôt et celui qui continue.
//
// Les protagonistes sont ceux de tests/outils/photographies_essai.js :
// « Aubépine » (pj1) et « Marmiton » (adv2), aux valeurs rondes. Le dé
// d'Aubépine est un d8, la défense du Marmiton vaut 5, son attaque 4.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appliquer, gesteEnCours, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import * as moteur from "../js/combat/moteur.js";
import * as porte from "../js/combat/offre.js";
import { accepte, offre } from "../js/combat/offre.js";
import { peutLancer } from "../js/combat/preparation.js";
import { EVENEMENTS_MAX, REGLES } from "../js/combat/regles.js";
import * as valeurs from "../js/combat/valeurs.js";
import { casesDOffice, journalAttendu, scenario } from "./outils/combat_reference.js";
import { adversaireEssai, aubepineEssai, chefDePartieEssai, etatEssai, marmitonDeCorveeEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const AUBEPINE = pjEssai();
const MARMITON = adversaireEssai();

const surD4 = (...photos) => photos.map((photo) => ({ photo, case: "D4" }));

/** Applique des événements à la suite ; un refus fait échouer le contrôle, avec sa phrase. */
function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

/** Un combat lancé. */
const combat = (protagonistes, options) => jouer(ouvrirCombat(miseEnPlaceEssai(protagonistes, options)), LANCER);

/** Vérifie qu'un événement est refusé avec ce code, et que l'état rendu est l'objet reçu. */
function refuse(etat, evenement, code, message = null) {
  const rendu = appliquer(etat, evenement);
  assert.notEqual(rendu.refus, undefined, `${JSON.stringify(evenement)} aurait dû être refusé`);
  assert.equal(rendu.etat, etat, "un refus rend l'état reçu, l'objet même");
  assert.equal(rendu.refus.code, code, rendu.refus.message);
  assert.equal(typeof rendu.refus.message, "string");
  if (message !== null) assert.equal(rendu.refus.message, message);
  assert.deepEqual(accepte(etat, evenement), { ok: false, ...rendu.refus }, "l'offre et le moteur disent le même refus");
  return rendu.refus;
}

const capacite = (etat, qui, nom, facon = 0) => {
  const indice = etat.photos[qui].capacites.findIndex((une) => une.nom === nom);
  assert.notEqual(indice, -1, `${qui} n'a pas de capacité « ${nom} »`);
  return { type: "capacite", qui, capacite: indice, facon };
};
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const de = (faces, ...lances) => ({ type: "de", faces, valeurs: lances });
const d8 = (...lances) => de(8, ...lances);
const d20 = (valeur) => de(20, valeur);
const APPLIQUER = { type: "appliquer" };

const dernier = (liste) => liste[liste.length - 1];
// La ligne du dernier geste fini : une fin de tour automatique peut la suivre.
const derniereLigne = (etat) => etat.journal.findLast((ligne) => ligne.genre === "geste").texte;

function estGele(valeur) {
  if (valeur === null || typeof valeur !== "object") return true;
  return Object.isFrozen(valeur) && Object.values(valeur).every(estGele);
}

// ─── Les états témoins, un par colonne de la table ──────────────────────────

// Aubépine attaque le Marmiton, sur sa case : sa Frappe est gratuite, dans sa
// maîtrise, et lance trois d20 de localisation dans le témoin qui en a besoin.
const AUBEPINE_A_TROIS_D20 = pjEssai((champs) => {
  champs.capacites[0].facons[0].locMultiple = 3;
});

function temoins() {
  const avant = ouvrirCombat(miseEnPlaceEssai(surD4(AUBEPINE, MARMITON)));
  const sansGeste = jouer(avant, LANCER);
  const prete = jouer(sansGeste, capacite(sansGeste, "pj1", "Frappe"), viser("adv2"));
  const sansJet = jouer(sansGeste, capacite(sansGeste, "pj1", "Flambage"));
  const jet = jouer(prete, d8(8));
  // Un avantage à la main : le dé qui échoue se relance ou se garde.
  const choixRelance = jouer(prete, regler("avantages", 1, "Minutie"), d8(2));
  // Un d8−5 contre 5 : la face maximale reste sous la difficulté, le dé explose.
  const choixExplosion = jouer(prete, regler("modificateur", -5, "Vapeur"), d8(8));
  const bilan = jouer(jet, d8(2));

  const aTroisD20 = combat(surD4(AUBEPINE_A_TROIS_D20, MARMITON));
  const localisation = jouer(aTroisD20, capacite(aTroisD20, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));

  // Le Marmiton attaque Aubépine : c'est elle qui lance sa défense, et
  // l'esquive lui est offerte.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const suites = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(2), d20(5));

  const termine = jouer(bilan, { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 999, raison: "Dernier service" }], nature: "corps" }, d20(5), APPLIQUER);

  return {
    avant: { etat: avant, admis: ["lancer"] },
    sans_geste: { etat: sansGeste, admis: ["capacite", "passer", "fin_de_tour"] },
    "preparation, une attaque prête": { etat: prete, admis: ["capacite", "regler", "revenir", "de", "passer", "fin_de_tour"], de: d8(4) },
    "preparation, une capacité sans jet": { etat: sansJet, admis: ["capacite", "regler", "revenir", "confirmer", "passer", "fin_de_tour"] },
    "jet, un dé attendu": { etat: jet, admis: ["de"], de: d8(4) },
    "jet, relancer ou garder": { etat: choixRelance, admis: ["relancer", "garder"] },
    "jet, le dé de la relance": { etat: jouer(choixRelance, { type: "relancer" }), admis: ["de"], de: d8(4) },
    "jet, faire exploser": { etat: choixExplosion, admis: ["exploser"] },
    "jet, le dé de l'explosion": { etat: jouer(choixExplosion, { type: "exploser" }), admis: ["de"], de: d8(4) },
    bilan: { etat: bilan, admis: ["de", "degats"], de: d20(5) },
    localisation: { etat: localisation, admis: ["de"], de: d20(6) },
    suites: { etat: suites, admis: ["decaler", "esquive", "appliquer"] },
    termine: { etat: termine, admis: [] },
  };
}

const TYPES = ["lancer", "capacite", "regler", "revenir", "confirmer", "de", "relancer", "garder", "exploser", "degats", "decaler", "esquive", "appliquer", "passer", "fin_de_tour"];

// Un événement bien fait de chaque type : dans sa colonne il est accepté ;
// ailleurs, seul le moment le fait refuser.
const ECHANTILLONS = {
  lancer: LANCER,
  capacite: { type: "capacite", qui: "pj1", capacite: 0, facon: 0 },
  regler: viser("adv2"),
  revenir: { type: "revenir" },
  confirmer: { type: "confirmer" },
  de: d8(4),
  relancer: { type: "relancer" },
  garder: { type: "garder" },
  exploser: { type: "exploser" },
  degats: { type: "degats", base: "lettre", operations: [], nature: "normaux" },
  decaler: { type: "decaler", de: 0, valeur: 1, raison: "Coup d'œil" },
  esquive: { type: "esquive", x: 1 },
  appliquer: APPLIQUER,
  passer: { type: "passer", qui: "pj1" },
  fin_de_tour: { type: "fin_de_tour" },
};

// ─── La table ───────────────────────────────────────────────────────────────

test("la table des événements : dans chaque colonne, chaque type est accepté ou refusé comme elle le dit", () => {
  let acceptes = 0;
  let refuses = 0;
  for (const [colonne, temoin] of Object.entries(temoins())) {
    for (const type of TYPES) {
      const evenement = type === "de" && temoin.de ? temoin.de : ECHANTILLONS[type];
      const rendu = appliquer(temoin.etat, evenement);
      if (temoin.admis.includes(type)) {
        assert.equal(rendu.refus, undefined, `${colonne} : « ${type} » aurait dû être accepté (${rendu.refus?.message})`);
        assert.notEqual(rendu.etat, temoin.etat, `${colonne} : « ${type} » rend un état neuf`);
        assert.equal(rendu.etat.pas, temoin.etat.pas + 1, `${colonne} : « ${type} » compte pour un pas`);
        acceptes += 1;
      } else {
        assert.equal(rendu.refus?.code, "hors_moment", `${colonne} : « ${type} » aurait dû être refusé pour son moment (${JSON.stringify(rendu.refus)})`);
        assert.equal(rendu.etat, temoin.etat, `${colonne} : « ${type} » refusé rend l'état reçu`);
        refuses += 1;
      }
    }
  }
  // La table entière : treize témoins, quinze types.
  assert.equal(acceptes + refuses, 13 * 15);
  assert.equal(acceptes, 1 + 3 + 6 + 6 + 1 + 2 + 1 + 1 + 1 + 2 + 1 + 3 + 0);
});

test("l'offre nomme, dans chaque colonne, les types qu'elle accepte, et eux seuls", () => {
  for (const [colonne, temoin] of Object.entries(temoins())) {
    assert.deepEqual([...offre(temoin.etat).types].sort(), [...temoin.admis].sort(), colonne);
  }
});

test("l'offre dit le dé attendu, les choix, les dégâts, les décalages et l'esquive du moment", () => {
  const t = temoins();
  const chaine = (place) => ({ faces: 8, combien: 1, motif: "chaine", place });
  assert.equal(offre(t.avant.etat).de, null);
  assert.equal(offre(t.sans_geste.etat).de, null);
  assert.deepEqual(offre(t["preparation, une attaque prête"].etat).de, chaine(1));
  assert.equal(offre(t["preparation, une capacité sans jet"].etat).de, null);
  assert.deepEqual(offre(t["jet, un dé attendu"].etat).de, chaine(2));
  assert.deepEqual(offre(t["jet, le dé de la relance"].etat).de, { faces: 8, combien: 1, motif: "relance", place: 1 });
  assert.deepEqual(offre(t["jet, le dé de l'explosion"].etat).de, { faces: 8, combien: 1, motif: "explosion", place: 1 });
  assert.deepEqual(offre(t.bilan.etat).de, { faces: 20, combien: 1, motif: "localisation", place: 1 });
  assert.deepEqual(offre(t.localisation.etat).de, { faces: 20, combien: 1, motif: "localisation", place: 2 });
  assert.equal(offre(t.suites.etat).de, null);

  assert.deepEqual(offre(t["jet, relancer ou garder"].etat).choix, ["relancer", "garder"]);
  assert.deepEqual(offre(t["jet, faire exploser"].etat).choix, ["exploser"]);
  assert.deepEqual(offre(t["jet, un dé attendu"].etat).choix, []);
  assert.deepEqual(offre(t.bilan.etat).choix, []);

  assert.deepEqual(offre(t.bilan.etat).degats, { bases: ["lettre"], natures: ["normaux", "resistance", "corps"], max: 999 });
  assert.equal(offre(t["jet, un dé attendu"].etat).degats, null);
  assert.equal(offre(t.localisation.etat).degats, null, "le premier d20 ferme le bilan");

  // Sur la grille d'un PJ, la face 5 se décale de 1 à 19 : de −4 à +14.
  assert.deepEqual(offre(t.suites.etat).decalages, [{ de: 0, min: -4, max: 14 }]);
  assert.deepEqual(offre(t.bilan.etat).decalages, []);
  // Aucune réussite en défense : C = 15 ; Aubépine a 10 de souffle.
  assert.deepEqual(offre(t.suites.etat).esquive, { min: 1, max: 10, capacite: 7 });
  assert.equal(offre(t.bilan.etat).esquive, null);

  assert.deepEqual(offre(t["preparation, une attaque prête"].etat).pret, { ok: true });
  assert.equal(offre(t.sans_geste.etat).pret, null);
  assert.deepEqual(offre(t.sans_geste.etat).reglages, {});
  assert.deepEqual(offre(t["jet, un dé attendu"].etat).reglages, {}, "rien ne se règle après le premier dé");
});

// ─── Les refus ──────────────────────────────────────────────────────────────

test("un refus rend l'état reçu, l'objet même ; chacun des quatre codes est vu", () => {
  const t = temoins();
  const prete = t["preparation, une attaque prête"].etat;

  // forme : un champ en trop, un champ qui manque, un type inconnu, une raison invalide.
  refuse(prete, { type: "revenir", enTrop: 1 }, "forme");
  refuse(prete, { type: "regler", champ: "cible" }, "forme");
  refuse(prete, { type: "danser" }, "forme");
  refuse(prete, regler("modificateur", 1, " "), "forme");
  refuse(prete, regler("modificateur", 1), "forme");
  // hors_moment : rien de tel ne s'offre à cet instant.
  refuse(t.sans_geste.etat, { type: "revenir" }, "hors_moment", "Aucun geste n'est en cours.");
  refuse(t.avant.etat, { type: "fin_de_tour" }, "hors_moment", "Le combat n'est pas lancé.");
  refuse(t.sans_geste.etat, LANCER, "hors_moment", "Le combat est déjà lancé.");
  refuse(t.bilan.etat, { type: "fin_de_tour" }, "hors_moment", "Le geste en cours se finit d'abord.");
  refuse(t.termine.etat, { type: "fin_de_tour" }, "hors_moment", "Le combat est terminé.");
  // hors_bornes : la valeur n'est pas de celles qui s'offrent.
  refuse(prete, viser("adv9"), "hors_bornes");
  refuse(prete, regler("modificateur", 21, "Trop"), "hors_bornes");
  // interdit : le bouton existe, il est inactif, et le message est sa raison.
  const essoufflee = combat(surD4(pjEssai((champs) => (champs.souffle = 3)), MARMITON));
  refuse(essoufflee, capacite(essoufflee, "pj1", "Émincer"), "interdit", "Pas assez de souffle : 4 demandés, 3 restants.");
});

test("appliquer ne lève jamais, quoi qu'on lui donne pour événement", () => {
  const { etat } = temoins().sans_geste;
  const pieges = [null, undefined, 3, "lancer", [], {}, { type: null }, { type: {} }, Object.create({ type: "revenir" }), { type: "capacite", qui: "constructor", capacite: 0, facon: 0 }];
  for (const piege of pieges) {
    const rendu = appliquer(etat, piege);
    assert.equal(rendu.etat, etat);
    assert.equal(rendu.refus.code, "forme");
  }
  // Bien faits, mais qui ne désignent rien : un identifiant, un indice.
  refuse(etat, { type: "capacite", qui: "pj9", capacite: 0, facon: 0 }, "hors_bornes", "Ce protagoniste n'est pas dans le combat.");
  refuse(etat, { type: "capacite", qui: "pj1", capacite: 99, facon: 0 }, "hors_bornes");
  refuse(etat, { type: "capacite", qui: "pj1", capacite: 0, facon: 99 }, "hors_bornes");
  refuse(etat, { type: "passer", qui: "adv9" }, "hors_bornes");
});

test("l'événement de trop : au dernier pas permis, tout événement est refusé, même mal fait", () => {
  const mep = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON));
  const plein = etatEssai(mep, { retoucher: (etat) => (etat.pas = EVENEMENTS_MAX) });
  const phrase = "Ce combat a atteint 20 000 événements : commencez-en un nouveau.";
  for (const evenement of [...Object.values(ECHANTILLONS), null, { type: "danser" }]) {
    const rendu = appliquer(plein, evenement);
    assert.equal(rendu.etat, plein);
    assert.deepEqual(rendu.refus, { code: "hors_bornes", message: phrase });
  }
  assert.deepEqual(offre(plein).types.length > 0, true, "l'offre montre encore ce que le moment permettrait");

  // Un pas plus tôt, le combat se joue encore ; l'événement d'après est de trop.
  const presque = etatEssai(mep, { retoucher: (etat) => (etat.pas = EVENEMENTS_MAX - 1) });
  const dernierPas = jouer(presque, { type: "fin_de_tour" });
  assert.equal(dernierPas.pas, EVENEMENTS_MAX);
  refuse(dernierPas, { type: "fin_de_tour" }, "hors_bornes", phrase);
});

// ─── L'ouverture et le lancement ────────────────────────────────────────────

test("ouvrirCombat : la préparation, personne n'a joué, rien n'est au journal", () => {
  const mep = miseEnPlaceEssai([
    { photo: AUBEPINE, case: "C3" },
    { photo: MARMITON, case: "F6" },
  ]);
  const etat = ouvrirCombat(mep);
  assert.equal(etat.phase, "preparation");
  assert.equal(etat.tour, null);
  assert.equal(etat.lanceLe, null);
  assert.equal(etat.pas, 0);
  assert.deepEqual(etat.journal, []);
  assert.equal(etat.annonce, null);
  assert.deepEqual(etat.ordre, ["pj1", "adv2"]);
  assert.equal(etat.protagonistes.pj1.case, "C3");
  assert.equal(etat.protagonistes.adv2.case, "F6");
  assert.equal(etat.photos.pj1, AUBEPINE.valeurs, "les valeurs de la photographie, par référence");
  assert.equal("source" in etat.photos.pj1, false);
  assert.equal("miseEnPlace" in etat, false);
  assert.equal(estGele(etat), true);
  // La jauge de lien part pleine.
  assert.deepEqual(etat.protagonistes.pj1.liens, [{ points: 2, max: 2 }]);
});

test("ouvrirCombat puis lancer égale l'état écrit à la main, champ pour champ et dans l'ordre", () => {
  for (const quiCommence of ["pj", "adv"]) {
    const mep = miseEnPlaceEssai(
      [
        { photo: AUBEPINE, case: "C3" },
        { photo: MARMITON, case: "F6" },
      ],
      { quiCommence },
    );
    const lance = jouer(ouvrirCombat(mep), LANCER);
    const attendu = etatEssai(mep);
    assert.deepEqual(lance, attendu);
    assert.equal(JSON.stringify(lance), JSON.stringify(attendu), "le même ordre des clés");
    assert.equal(estGele(lance), true);

    // Par « Fin de tour », personne n'ayant joué : le tour 2 du même camp.
    const fin = { type: "fin_de_tour" };
    assert.deepEqual(jouer(lance, fin), etatEssai(mep, { tour: { numero: 1, camp: quiCommence === "pj" ? "adv" : "pj" } }));
    assert.deepEqual(jouer(lance, fin, fin), etatEssai(mep, { tour: { numero: 2, camp: quiCommence } }));
  }
});

test("lancer : il faut au moins un personnage et un adversaire, et la phrase est celle de la préparation", () => {
  for (const seuls of [[{ photo: AUBEPINE }], [{ photo: MARMITON }], []]) {
    const mep = miseEnPlaceEssai(seuls);
    const etat = ouvrirCombat(mep);
    assert.deepEqual(offre(etat).types, []);
    refuse(etat, LANCER, "interdit", peutLancer(mep).raison);
  }
  const mep = miseEnPlaceEssai(surD4(AUBEPINE, MARMITON));
  assert.deepEqual(peutLancer(mep), { ok: true });
  assert.equal(jouer(ouvrirCombat(mep), LANCER).phase, "combat");
  // L'heure du lancement est une donnée de l'événement : elle se garde telle quelle.
  assert.equal(jouer(ouvrirCombat(mep), { type: "lancer", le: "2026-01-02T03:04" }).lanceLe, "2026-01-02T03:04");
  refuse(ouvrirCombat(mep), { type: "lancer", le: "hier" }, "forme");
});

// ─── Le geste en préparation ────────────────────────────────────────────────

test("capacite ouvre un geste en préparation : rien n'est payé, et il porte le pas qui l'a ouvert", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const ouvert = jouer(depart, capacite(depart, "pj1", "Émincer"));
  const geste = gesteEnCours(ouvert);
  assert.equal(ouvert.pile.length, 1);
  assert.equal(geste.numero, ouvert.pas);
  assert.deepEqual(
    { acteur: geste.acteur, capacite: geste.capacite, facon: geste.facon, mode: geste.mode, moment: geste.moment, paye: geste.paye, prix: geste.prix },
    { acteur: "pj1", capacite: 1, facon: 0, mode: "attaque", moment: "preparation", paye: false, prix: null },
  );
  assert.deepEqual(
    { cible: geste.cible, arrivee: geste.arrivee, depart: geste.depart, x: geste.x, jauge: geste.jauge, caracteristiques: geste.caracteristiques, difficulte: geste.difficulte, armePretee: geste.armePretee },
    { cible: null, arrivee: null, depart: null, x: 0, jauge: null, caracteristiques: null, difficulte: null, armePretee: null },
  );
  assert.deepEqual(geste.reglages, { modificateur: null, avantages: null });
  assert.deepEqual({ jet: geste.jet, degats: geste.degats, localisation: geste.localisation, interventions: geste.interventions, resultat: geste.resultat, parent: geste.parent }, {
    jet: null,
    degats: null,
    localisation: [],
    interventions: [],
    resultat: null,
    parent: null,
  });
  assert.equal(ouvert.protagonistes.pj1, depart.protagonistes.pj1, "rien n'a changé pour Aubépine : le même objet");
  assert.equal(moteur.gesteEnCours, valeurs.gesteEnCours, "le moteur réexporte la lecture du geste en cours");
});

test("le mode d'un geste vient du rôle de la capacité et de sa façon", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const modeDe = (etat, qui, nom) => gesteEnCours(jouer(etat, capacite(etat, qui, nom))).mode;
  assert.equal(modeDe(depart, "pj1", "Frappe"), "attaque");
  assert.equal(modeDe(depart, "pj1", "Taloche"), "attaque");
  assert.equal(modeDe(depart, "pj1", "Flambage"), "sans_jet");
  assert.equal(modeDe(depart, "pj1", "Pas chassé"), "deplacement");
  assert.equal(modeDe(depart, "pj1", "Goûter"), "caracteristique");
  // L'esquive, à son propre tour, se joue comme toute capacité : sans jet.
  assert.equal(modeDe(depart, "pj1", "Pas de côté"), "sans_jet");

  // Un adversaire qui porte la capacité du jet de caractéristique la joue
  // sans jet : seuls les joueurs lancent des dés.
  const gouteur = adversaireEssai((champs) => (champs.capacites[2].role = "jet_de_caracteristique"));
  const adverse = combat(surD4(AUBEPINE, gouteur), { quiCommence: "adv" });
  assert.equal(modeDe(adverse, "adv2", "Pas chassé"), "sans_jet");
  assert.equal(modeDe(adverse, "adv2", "Frappe"), "attaque");
});

test("un geste non payé se remplace, se retire, et ne dépense rien ; payé, il se finit d'abord", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));

  // « capacite » remplace le geste : la pile n'en porte toujours qu'un.
  const emincer = jouer(frappe, capacite(frappe, "pj1", "Émincer"));
  assert.equal(emincer.pile.length, 1);
  assert.equal(gesteEnCours(emincer).capacite, 1);
  assert.equal(gesteEnCours(emincer).cible, null, "le geste neuf ne garde rien de l'ancien");
  assert.equal(gesteEnCours(emincer).numero, emincer.pas);

  // « revenir » le retire.
  const revenu = jouer(frappe, { type: "revenir" });
  assert.deepEqual(revenu.pile, []);
  assert.equal(revenu.protagonistes, depart.protagonistes, "rien n'est dépensé : les mêmes objets");
  assert.equal(revenu.journal, depart.journal, "rien n'entre au journal");

  // Une fois le premier dé lancé, le geste est payé : plus rien ne le remplace.
  const paye = jouer(frappe, d8(8));
  assert.equal(gesteEnCours(paye).paye, true);
  refuse(paye, capacite(paye, "pj1", "Émincer"), "hors_moment");
  refuse(paye, { type: "revenir" }, "hors_moment", "Le geste en cours n'en est pas là.");
  refuse(paye, { type: "passer", qui: "pj1" }, "hors_moment");
  refuse(paye, viser("adv2"), "hors_moment");
});

test("regler : un champ qui ne s'offre pas à ce geste est refusé pour son moment ; une valeur hors de ses bornes, pour ses bornes", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"));
  assert.deepEqual(Object.keys(offre(frappe).reglages), ["cible", "modificateur", "avantages"]);
  for (const evenement of [regler("arrivee", "E5"), regler("difficulte", 6), regler("x", 1), regler("jauge", 0), regler("jet_prete", true), regler("facon", 0), regler("arme_pretee", 0), regler("caracteristiques", ["force"])]) {
    refuse(frappe, evenement, "hors_moment", "Ce réglage ne s'offre pas à ce geste.");
  }

  const gouter = jouer(depart, capacite(depart, "pj1", "Goûter"));
  assert.deepEqual(Object.keys(offre(gouter).reglages), ["caracteristiques", "difficulte", "modificateur", "avantages"]);
  assert.deepEqual(offre(gouter).reglages.difficulte, { valeur: null, min: 2, max: 10 });
  refuse(gouter, regler("difficulte", 1), "hors_bornes");
  refuse(gouter, regler("difficulte", 11), "hors_bornes");
  assert.equal(gesteEnCours(jouer(gouter, regler("difficulte", 2))).difficulte, 2);
  assert.equal(gesteEnCours(jouer(gouter, regler("difficulte", 10))).difficulte, 10);
  refuse(gouter, viser("adv2"), "hors_moment");

  // Les réglages à la main : de −20 à +20, avec leur raison ; 0 les efface.
  assert.deepEqual(offre(frappe).reglages.modificateur, { valeur: 0, min: -20, max: 20, raison: true });
  refuse(frappe, regler("avantages", -21, "Trop"), "hors_bornes");
  const regle = jouer(frappe, regler("modificateur", 20, "Sel fin"), regler("avantages", -20, "Vapeur"));
  assert.deepEqual(gesteEnCours(regle).reglages, { modificateur: { valeur: 20, raison: "Sel fin" }, avantages: { valeur: -20, raison: "Vapeur" } });
  assert.equal(offre(regle).reglages.avantages.valeur, -20);
  const efface = jouer(regle, regler("modificateur", 0), regler("avantages", 0));
  assert.deepEqual(gesteEnCours(efface).reglages, { modificateur: null, avantages: null });
});

test("l'ordre des caractéristiques : données à l'envers, la liste posée est la même, et la ligne du journal aussi, mot pour mot", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const taloche = jouer(depart, capacite(depart, "pj1", "Taloche"), viser("adv2"));
  assert.deepEqual(offre(taloche).reglages.caracteristiques, {
    valeur: null,
    options: ["force", "agilite", "precision", "sens", "culture_neruvienne", "savoir_sauvage", "parole", "empathie", "creativite"],
  });
  assert.deepEqual(offre(taloche).pret, { ok: false, manque: "Choisissez une ou deux caractéristiques." });

  const lignes = [["force", "agilite"], ["agilite", "force"]].map((choix) => {
    const regle = jouer(taloche, regler("caracteristiques", choix));
    assert.deepEqual(gesteEnCours(regle).caracteristiques, ["force", "agilite"]);
    const fini = jouer(regle, d8(8), d8(2), d20(5), APPLIQUER);
    return derniereLigne(fini);
  });
  assert.equal(lignes[0], lignes[1]);
  assert.match(lignes[0], /d8 \(Force \+ Agilité\) contre 5/);

  // Une seule caractéristique fait un dé, elle aussi ; la même deux fois n'est pas un choix.
  assert.deepEqual(gesteEnCours(jouer(taloche, regler("caracteristiques", ["sens"]))).caracteristiques, ["sens"]);
  refuse(taloche, regler("caracteristiques", ["sens", "sens"]), "forme");
  refuse(taloche, regler("caracteristiques", ["charme"]), "forme");
});

test("après un réglage, ce que l'offre ne permet plus se retire : l'arrivée, la cible, le X", () => {
  // L'arrivée : à deux cases pour un Pas chassé [2], trop loin pour un [1].
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const pas = jouer(depart, capacite(depart, "pj1", "Pas chassé", 1));
  const loin = jouer(pas, regler("arrivee", "F4"));
  assert.equal(gesteEnCours(jouer(loin, regler("facon", 0))).arrivee, null);
  const pres = jouer(pas, regler("arrivee", "E4"));
  assert.equal(gesteEnCours(jouer(pres, regler("facon", 0))).arrivee, "E4");

  // La cible : une capacité sans jet vise n'importe quel vivant ; son jet
  // prêté, un adversaire à la portée de l'arme prêtée (1 pour le couteau).
  const eloignes = combat([
    { photo: AUBEPINE, case: "D4" },
    { photo: MARMITON, case: "F4" },
  ]);
  const flambage = jouer(eloignes, capacite(eloignes, "pj1", "Flambage"));
  for (const cible of ["pj1", "adv2"]) {
    const visee = jouer(flambage, viser(cible));
    assert.equal(gesteEnCours(visee).cible, cible);
    assert.equal(gesteEnCours(jouer(visee, regler("jet_prete", true))).cible, null, `${cible} n'est plus une cible possible`);
  }
  const proches = jouer(depart, capacite(depart, "pj1", "Flambage"), viser("adv2"), regler("jet_prete", true));
  assert.equal(gesteEnCours(proches).cible, "adv2", "à portée, la cible reste");
  assert.equal(gesteEnCours(proches).mode, "jet_prete");
  assert.equal(gesteEnCours(proches).armePretee, 0);
  const rendu = jouer(proches, regler("jet_prete", false));
  assert.deepEqual({ mode: gesteEnCours(rendu).mode, armePretee: gesteEnCours(rendu).armePretee, cible: gesteEnCours(rendu).cible }, { mode: "sans_jet", armePretee: null, cible: "adv2" });

  // Le X : la puissance [1] coûte X de souffle, la [2] un coût fixe.
  const aX = pjEssai((champs) => {
    champs.capacites[2].facons[0].cout = { souffle: "X", lien: 0 };
  });
  const avecX = combat(surD4(aX, MARMITON));
  const regle = jouer(avecX, capacite(avecX, "pj1", "Flambage", 0), regler("x", 6));
  assert.equal(gesteEnCours(regle).x, 6);
  assert.equal(gesteEnCours(jouer(regle, regler("facon", 1))).x, 0, "le coût de la puissance [2] ne porte pas de X");
  assert.equal(gesteEnCours(jouer(regle, viser("adv2"))).x, 6, "un autre réglage ne touche pas au X");
});

test("l'arme prêtée d'un adversaire : à changer d'arme, la cible que la nouvelle portée n'atteint pas se retire", () => {
  const aDeuxArmes = adversaireEssai((champs) => {
    champs.armes.push({ nom: "Louche à long manche", libelle: "Louche à long manche", poids: null, faces: null, caracteristiques: null, degats: [1, 2, 3], portee: 3, locMultiple: 1, mainsNues: false });
    champs.capacites.push({ ...champs.capacites[2], nom: "Humer", role: null });
  });
  const depart = combat(
    [
      { photo: AUBEPINE, case: "D4" },
      { photo: aDeuxArmes, case: "F4" },
    ],
    { quiCommence: "adv" },
  );
  const humer = jouer(depart, capacite(depart, "adv2", "Humer"), regler("jet_prete", true));
  assert.deepEqual(offre(humer).reglages.arme_pretee, { valeur: 0, options: [0, 1] });
  assert.deepEqual(offre(humer).reglages.cible.options, [], "la spatule ne porte pas à deux cases");
  const louche = jouer(humer, regler("arme_pretee", 1), viser("pj1"));
  assert.equal(gesteEnCours(louche).cible, "pj1");
  assert.equal(gesteEnCours(jouer(louche, regler("arme_pretee", 0))).cible, null);
  refuse(humer, regler("arme_pretee", 2), "hors_bornes");
  refuse(humer, regler("arme_pretee", null), "forme");
});

// ─── Prêt, ou non ───────────────────────────────────────────────────────────

test("confirmer et le premier dé demandent un geste prêt ; sinon le refus dit ce qui manque", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));

  // Une attaque sans cible : le dé est refusé ; la cible choisie, il part.
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"));
  assert.deepEqual(offre(frappe).pret, { ok: false, manque: "Choisissez une cible." });
  assert.equal(offre(frappe).de, null);
  refuse(frappe, d8(4), "interdit", "Choisissez une cible.");
  assert.equal(gesteEnCours(jouer(frappe, viser("adv2"), d8(8))).paye, true);
  // Une attaque ne se confirme pas : elle se joue par son dé.
  refuse(jouer(frappe, viser("adv2")), { type: "confirmer" }, "hors_moment");

  // Un déplacement sans arrivée : refusé ; l'arrivée choisie, il se confirme.
  const pas = jouer(depart, capacite(depart, "pj1", "Pas chassé"));
  assert.deepEqual(offre(pas).pret, { ok: false, manque: "Choisissez une case d'arrivée." });
  refuse(pas, { type: "confirmer" }, "interdit", "Choisissez une case d'arrivée.");
  refuse(pas, d8(4), "hors_moment", "Ce geste ne lance aucun dé.");
  assert.deepEqual(jouer(pas, regler("arrivee", "E5"), { type: "confirmer" }).pile, []);

  // Un jet de caractéristique : les caractéristiques, puis la difficulté.
  const gouter = jouer(depart, capacite(depart, "pj1", "Goûter"));
  refuse(gouter, d8(4), "interdit", "Choisissez une ou deux caractéristiques.");
  const choisies = jouer(gouter, regler("caracteristiques", ["parole", "sens"]));
  refuse(choisies, d8(4), "interdit", "Choisissez une difficulté.");
  const pret = jouer(choisies, regler("difficulte", 6));
  assert.deepEqual(offre(pret).pret, { ok: true });
  assert.deepEqual(gesteEnCours(jouer(pret, d8(7))).jet.caracteristiques, ["sens", "parole"]);

  // Une capacité sans jet ne demande rien : elle se confirme telle quelle.
  const flambage = jouer(depart, capacite(depart, "pj1", "Flambage"));
  assert.deepEqual(offre(flambage).pret, { ok: true });
  assert.deepEqual(jouer(flambage, { type: "confirmer" }).pile, []);
});

test("un dé : ses faces sont celles du dé attendu, et ses valeurs en comptent autant qu'il faut", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  refuse(frappe, de(10, 4), "hors_bornes", "Le dé attendu est un d8.");
  refuse(frappe, d8(4, 4), "hors_bornes", "Ce dé attend une valeur de 1 à 8.");
  refuse(frappe, d8(9), "forme");
  refuse(frappe, d8(0), "forme");
  refuse(frappe, d8(), "forme");

  // Émincer est hors maîtrise : 1 désavantage, deux valeurs par dé de la chaîne.
  const emincer = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"));
  assert.deepEqual(offre(emincer).de, { faces: 8, combien: 2, motif: "chaine", place: 1 });
  refuse(emincer, d8(4), "hors_bornes", "Ce dé attend 2 valeurs de 1 à 8.");
  const lance = jouer(emincer, d8(7, 6));
  assert.deepEqual(gesteEnCours(lance).jet.places, [{ essais: [{ tirages: [7, 6], explosions: [] }] }]);

  // Le d20 de localisation : un d20, une valeur.
  const bilan = jouer(frappe, d8(8), d8(2));
  refuse(bilan, d8(4), "hors_bornes", "Le dé attendu est un d20.");
  refuse(bilan, de(20, 4, 5), "hors_bornes");
  assert.deepEqual(gesteEnCours(jouer(bilan, d20(20))).localisation, [{ brut: 20, decalage: null }]);
});

// ─── La chaîne, le bilan, la localisation ───────────────────────────────────

test("le premier dé fige les circonstances du jet : ce qui change ensuite n'y revient pas", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), regler("modificateur", 1, "Sel fin"));
  assert.equal(gesteEnCours(frappe).jet, null, "avant le premier dé, le jet n'existe pas");
  const lance = jouer(frappe, d8(4));
  const { jet } = gesteEnCours(lance);
  assert.deepEqual(
    { genre: jet.genre, lanceur: jet.lanceur, faces: jet.faces, difficulte: jet.difficulte, modificateurs: jet.modificateurs, attente: jet.attente },
    { genre: "attaque", lanceur: "pj1", faces: 8, difficulte: 5, modificateurs: [{ genre: "main", nom: "Sel fin", valeur: 1 }], attente: "de" },
  );
  assert.equal(gesteEnCours(lance).moment, "jet");
  // Quand un adversaire attaque, c'est le PJ visé qui lance : sa défense, contre l'attaque.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const defense = gesteEnCours(jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(4))).jet;
  assert.deepEqual({ genre: defense.genre, lanceur: defense.lanceur, difficulte: defense.difficulte }, { genre: "defense", lanceur: "pj1", difficulte: 4 });
});

test("la fin de la chaîne : manqué, c'est fini ; touché, le bilan s'ouvre avec ses dégâts par défaut", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));

  // Aucune réussite : manqué. Le geste se clôt sur ce dé, sans d20.
  const manque = jouer(frappe, d8(4));
  assert.deepEqual(manque.pile, []);
  assert.match(derniereLigne(manque), /^Aubépine : Frappe contre Marmiton\. d8 contre 5 → 4 ✗ : aucune réussite, manqué\.$/);
  assert.deepEqual(manque.protagonistes.adv2, depart.protagonistes.adv2);
  assert.equal(manque.protagonistes.pj1.actions, 1, "l'action reste payée");

  // Une réussite : touché. Le geste attend le d20, et ses dégâts sont fixés.
  const touche = jouer(frappe, d8(5), d8(4));
  assert.equal(gesteEnCours(touche).moment, "bilan");
  assert.deepEqual(gesteEnCours(touche).degats, { base: "lettre", operations: [], nature: "normaux" });
  assert.equal(touche.journal, depart.journal, "la ligne ne s'écrit qu'une fois le geste fini");

  // Trois réussites : la chaîne s'arrête d'elle-même.
  const trois = jouer(frappe, d8(5), d8(6), d8(7));
  assert.equal(gesteEnCours(trois).moment, "bilan");
  refuse(trois, d8(8), "hors_bornes", "Le dé attendu est un d20.");

  // En défense : trois réussites, aucun dégât, l'attaque n'a pas touché ; deux, elle touche.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const attaque = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"));
  const paree = jouer(attaque, d8(4), d8(5), d8(6));
  assert.deepEqual(paree.pile, []);
  assert.match(derniereLigne(paree), /Aubépine lance sa défense, d8 contre 4 → 4 ✓, 5 ✓, 6 ✓ : 3 réussites, aucun dégât\.$/);
  assert.equal(gesteEnCours(jouer(attaque, d8(4), d8(5), d8(3))).moment, "bilan");

  // Un jet de caractéristique se clôt sur son dernier dé, réussi ou non.
  const gouter = jouer(depart, capacite(depart, "pj1", "Goûter"), regler("caracteristiques", ["sens", "parole"]), regler("difficulte", 6));
  const reussi = jouer(gouter, d8(7), d8(4));
  assert.deepEqual(reussi.pile, []);
  assert.equal(derniereLigne(reussi), "Aubépine : Goûter, d8 (Sens + Parole) contre 6 (compliqué) → 7 ✓, 4 ✗ : 1 réussite.");
  assert.equal(derniereLigne(jouer(gouter, d8(5))), "Aubépine : Goûter, d8 (Sens + Parole) contre 6 (compliqué) → 5 ✗ : aucune réussite.");
});

test("relancer, garder, exploser : chacun à son attente, et le geste suit", () => {
  const t = temoins();
  const choix = t["jet, relancer ou garder"].etat;

  // Garder arrête la chaîne : aucune réussite, manqué.
  const garde = jouer(choix, { type: "garder" });
  assert.deepEqual(garde.pile, []);
  assert.match(derniereLigne(garde), /d8 contre 5, 1 avantage \(à la main : Minutie\) → 2 ✗ : aucune réussite, manqué\.$/);

  // Relancer attend un dé, qui remplace le premier ; la relance est dépensée.
  const relance = jouer(choix, { type: "relancer" }, d8(6));
  assert.deepEqual(gesteEnCours(relance).jet.places, [{ essais: [{ tirages: [2], explosions: [] }, { tirages: [6], explosions: [] }] }]);
  const echec = jouer(relance, d8(1));
  assert.match(derniereLigne(jouer(echec, d20(5), APPLIQUER)), /→ 2 ✗, relancé 6 ✓, 1 ✗ : 1 réussite, A = 5\./);
  refuse(relance, { type: "relancer" }, "hors_moment", "Aucun dé ne se relance à cet instant.");
  refuse(relance, { type: "garder" }, "hors_moment", "Aucun dé n'est à garder à cet instant.");
  refuse(choix, { type: "exploser" }, "hors_moment", "Aucun dé n'explose à cet instant.");

  // Devant un dé qui peut exploser, exploser est la seule suite.
  const explosion = t["jet, faire exploser"].etat;
  refuse(explosion, d8(4), "hors_moment", "Aucun dé n'est attendu à cet instant.");
  const explose = jouer(explosion, { type: "exploser" }, d8(3));
  assert.deepEqual(gesteEnCours(explose).jet.places[0].essais, [{ tirages: [8], explosions: [3] }]);
  assert.equal(gesteEnCours(explose).jet.attente, "de", "8 − 5 + 3 = 6 : réussi, la chaîne continue");
});

test("fixer les dégâts : pendant le bilan seulement, autant de fois qu'on veut, et le dernier compte", () => {
  const { etat: bilan } = temoins().bilan;
  const ajuster = (valeur, raison = "Frappe") => [{ op: "ajuster", valeur, raison }];
  const degats = (base, operations, nature) => ({ type: "degats", base, operations, nature });

  const fixe = jouer(bilan, degats("lettre", ajuster(22), "normaux"), degats("lettre", ajuster(7, "Petit feu"), "normaux"));
  assert.deepEqual(gesteEnCours(fixe).degats, { base: "lettre", operations: [{ op: "ajuster", valeur: 7, raison: "Petit feu" }], nature: "normaux" });
  assert.equal(gesteEnCours(fixe).moment, "bilan");
  const applique = jouer(fixe, d20(5), APPLIQUER);
  assert.match(derniereLigne(applique), /1 réussite, A = 5, ajusté à 7 \(Petit feu\)\. Localisation d20 → 5 : torse\. Armure 10 → 3\.$/);

  // Une base que ce geste n'a pas ; une nature directe sans son nombre ; des dégâts hors de 0 à 999.
  refuse(bilan, degats("arme", [], "normaux"), "hors_bornes");
  refuse(bilan, degats("aucun", [], "normaux"), "hors_bornes");
  refuse(bilan, degats("lettre", [], "resistance"), "hors_bornes", "Des dégâts directs demandent un nombre et une raison.");
  refuse(bilan, degats("lettre", [], "corps"), "hors_bornes");
  refuse(bilan, degats("lettre", ajuster(1000), "normaux"), "hors_bornes", "Les dégâts vont de 0 à 999.");
  refuse(bilan, degats("lettre", ajuster(-1), "normaux"), "hors_bornes");
  assert.equal(gesteEnCours(jouer(bilan, degats("lettre", ajuster(999), "normaux"))).degats.operations[0].valeur, 999);
  assert.equal(gesteEnCours(jouer(bilan, degats("lettre", ajuster(0), "normaux"))).degats.operations[0].valeur, 0);
  refuse(bilan, degats("lettre", [...ajuster(1), ...ajuster(2)], "normaux"), "forme");
  refuse(bilan, degats("lettre", ajuster(1, ""), "normaux"), "forme");

  // Des dégâts directs : à la résistance de la zone (le reste au corps), ou droit au corps, sans toucher l'armure.
  const directs = jouer(bilan, degats("lettre", ajuster(7, "Huile chaude"), "resistance"), d20(5), APPLIQUER);
  assert.deepEqual(directs.protagonistes.adv2.zones[0], { armure: 10, armureMax: 10, resistance: 0, resistanceMax: 5 });
  assert.equal(directs.protagonistes.adv2.corps, 8);
  const auCorps = jouer(bilan, degats("lettre", ajuster(4, "Plat avarié"), "corps"), d20(5), APPLIQUER);
  assert.deepEqual(auCorps.protagonistes.adv2.zones[0], { armure: 10, armureMax: 10, resistance: 5, resistanceMax: 5 });
  assert.equal(auCorps.protagonistes.adv2.corps, 6);

  // Le premier d20 ferme le bilan : les dégâts ne se changent plus.
  refuse(jouer(bilan, d20(5)), degats("lettre", ajuster(3), "normaux"), "hors_moment");
});

test("une capacité sans dégâts qui touche se localise : le d20 se lance, « Appliquer » ne change aucune zone", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const prete = jouer(depart, capacite(depart, "pj1", "Flambage"), regler("jet_prete", true), viser("adv2"));

  const touche = jouer(prete, d8(8), d8(2));
  assert.equal(gesteEnCours(touche).moment, "bilan");
  assert.deepEqual(gesteEnCours(touche).degats, { base: "aucun", operations: [], nature: "normaux" }, "« Sans dégâts » par défaut");
  assert.deepEqual(offre(touche).degats.bases, ["aucun", "arme"]);
  assert.deepEqual(offre(touche).de, { faces: 20, combien: 1, motif: "localisation", place: 1 });
  const localise = jouer(touche, d20(5));
  assert.equal(gesteEnCours(localise).moment, "suites");
  assert.deepEqual(offre(localise).types, ["decaler", "appliquer"], "« Appliquer », toujours, même sans dégâts");
  const fini = jouer(localise, APPLIQUER);
  assert.deepEqual(fini.protagonistes.adv2, depart.protagonistes.adv2, "aucune zone ne perd rien");
  assert.equal(derniereLigne(fini), "Aubépine : Flambage [1] (5 souffle) contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, touché. Localisation d20 → 5 : torse.");

  // « Dégâts de l'arme » : la lettre des réussites, sur les dégâts du couteau.
  const armee = jouer(touche, { type: "degats", base: "arme", operations: [], nature: "normaux" }, d20(5), APPLIQUER);
  assert.equal(armee.protagonistes.adv2.zones[0].armure, 5);
  assert.match(derniereLigne(armee), /1 réussite, touché, dégâts de l'arme : A = 5\. Localisation d20 → 5 : torse\. Armure 10 → 5\.$/);

  // Manqué, rien ne se localise ; confirmée sans jet, rien non plus.
  const manque = jouer(prete, d8(2));
  assert.deepEqual(manque.pile, []);
  assert.doesNotMatch(derniereLigne(manque), /Localisation/);
  const sansJet = jouer(depart, capacite(depart, "pj1", "Flambage"), viser("adv2"), { type: "confirmer" });
  assert.equal(derniereLigne(sansJet), "Aubépine : Flambage [1] (5 souffle) contre Marmiton.");

  // Une attaque dont les dégâts ne se lisent pas touche « sans dégâts », et se localise de même.
  const illisible = pjEssai((champs) => (champs.capacites[0].facons[0].degats = null));
  const sansDegats = combat(surD4(illisible, MARMITON));
  const frappe = jouer(sansDegats, capacite(sansDegats, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2));
  assert.deepEqual(gesteEnCours(frappe).degats, { base: "aucun", operations: [], nature: "normaux" });
  assert.deepEqual(jouer(frappe, d20(5), APPLIQUER).protagonistes.adv2, sansDegats.protagonistes.adv2);
});

test("la localisation : autant de d20 que le dit la capacité, puis les suites", () => {
  const depart = combat(surD4(AUBEPINE_A_TROIS_D20, MARMITON));
  const bilan = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2));
  const un = jouer(bilan, d20(5));
  assert.equal(gesteEnCours(un).moment, "localisation");
  refuse(un, APPLIQUER, "hors_moment");
  const deux = jouer(un, d20(5));
  assert.equal(gesteEnCours(deux).moment, "localisation");
  const trois = jouer(deux, d20(20));
  assert.equal(gesteEnCours(trois).moment, "suites");
  refuse(trois, d20(7), "hors_moment", "Le geste en cours n'en est pas là.");
  // Les dégâts s'appliquent à chaque zone, même deux fois à la même : A = 5, deux fois au torse, une à la tête.
  const fini = jouer(trois, APPLIQUER);
  assert.equal(fini.protagonistes.adv2.zones[0].armure, 0);
  assert.equal(fini.protagonistes.adv2.zones[5].armure, 5);
  assert.match(derniereLigne(fini), /Localisation 3 d20 → 5 : torse ; 5 : torse ; 20 : tête\./);

  // Un seul d20, par défaut : il mène droit aux suites.
  const simple = combat(surD4(AUBEPINE, MARMITON));
  const seul = jouer(simple, capacite(simple, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));
  assert.equal(gesteEnCours(seul).moment, "suites");
});

test("la face de contre-attaque clôt le geste et arrête les d20 ; l'action et le coût restent payés", () => {
  // Sur un adversaire, c'est la face 1 : au deuxième d20 de trois, tout s'arrête.
  const depart = combat(surD4(AUBEPINE_A_TROIS_D20, MARMITON));
  const premier = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));
  const annule = jouer(premier, d20(1));
  assert.deepEqual(annule.pile, [], "le geste se clôt sur ce dé");
  refuse(annule, d20(7), "hors_moment", "Aucun geste n'est en cours.");
  assert.deepEqual(annule.protagonistes.adv2, depart.protagonistes.adv2, "rien n'est appliqué, pas même le premier d20");
  assert.equal(annule.protagonistes.pj1.actions, 1);
  assert.match(derniereLigne(annule), /1 réussite, A = 5\. Localisation 3 d20 → 5 : torse ; 1 : contre-attaque, l'attaque est annulée\.$/);
  // La face 20, sur un adversaire, n'est que sa tête.
  assert.equal(gesteEnCours(jouer(premier, d20(20))).moment, "localisation");

  // Sur un PJ, c'est la face 20 ; la face 1 n'est que sa tête.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const bilan = jouer(adverse, capacite(adverse, "adv2", "Moulinet farineux"), viser("pj1"), d8(2), { type: "garder" });
  const pare = jouer(bilan, d20(20));
  assert.deepEqual(pare.pile, []);
  assert.deepEqual(pare.protagonistes.pj1, adverse.protagonistes.pj1);
  assert.equal(pare.protagonistes.adv2.souffle, 0, "les 5 points de souffle du Moulinet restent payés");
  assert.match(derniereLigne(pare), /Aubépine reçoit C = 15\. Localisation d20 → 20 : contre-attaque, l'attaque est annulée\.$/);
  assert.equal(gesteEnCours(jouer(bilan, d20(1))).moment, "suites");
});

test("décaler la face : aux suites, tant qu'aucune esquive n'est jouée, et sans sortir de la grille", () => {
  const { etat: suites } = temoins().suites;
  const decale = jouer(suites, { type: "decaler", de: 0, valeur: 9, raison: "Coup d'œil" });
  assert.deepEqual(gesteEnCours(decale).localisation, [{ brut: 5, decalage: { valeur: 9, raison: "Coup d'œil" } }]);
  assert.equal(gesteEnCours(decale).moment, "suites", "il n'y a pas d'étape de validation");
  const fini = jouer(decale, APPLIQUER);
  assert.match(derniereLigne(fini), /Localisation d20 → 5, décalée à 14 \(Coup d'œil\) : jambe droite\. Armure 10 → 0, résistance 5 → 0\. Blessure/);
  // 0 retire le décalage.
  assert.deepEqual(gesteEnCours(jouer(decale, { type: "decaler", de: 0, valeur: 0 })).localisation, [{ brut: 5, decalage: null }]);

  // Les bornes : de 1 à 19 sur un PJ, pour la face 5 : de −4 à +14.
  for (const valeur of [-4, 14]) assert.equal(gesteEnCours(jouer(suites, { type: "decaler", de: 0, valeur, raison: "Coup d'œil" })).localisation[0].decalage.valeur, valeur);
  for (const valeur of [-5, 15]) refuse(suites, { type: "decaler", de: 0, valeur, raison: "Coup d'œil" }, "hors_bornes", "La face décalée doit rester sur une zone.");
  refuse(suites, { type: "decaler", de: 1, valeur: 1, raison: "Coup d'œil" }, "hors_bornes", "Ce dé de localisation n'a pas été lancé.");
  refuse(suites, { type: "decaler", de: 0, valeur: 1 }, "forme");

  // Une fois l'esquive jouée, la face ne se décale plus.
  const esquive = jouer(suites, { type: "esquive", x: 3 });
  assert.deepEqual(offre(esquive).decalages, []);
  refuse(esquive, { type: "decaler", de: 0, valeur: 1, raison: "Coup d'œil" }, "hors_moment");
});

test("l'esquive : offerte au PJ visé, de 1 au plus petit du souffle et des dégâts, payée tout de suite, une seule fois", () => {
  const { etat: suites } = temoins().suites;
  assert.deepEqual(offre(suites).esquive, { min: 1, max: 10, capacite: 7 });
  refuse(suites, { type: "esquive", x: 0 }, "hors_bornes", "L'esquive annule de 1 à 10 dégâts.");
  refuse(suites, { type: "esquive", x: 11 }, "hors_bornes");

  const esquive = jouer(suites, { type: "esquive", x: 3 });
  assert.equal(esquive.protagonistes.pj1.actions, 1);
  assert.equal(esquive.protagonistes.pj1.souffle, 7);
  assert.deepEqual(gesteEnCours(esquive).interventions, [{ qui: "pj1", capacite: 7, prix: { actions: 1, souffle: 3 }, effet: { genre: "annuler", x: 3 } }]);
  assert.equal(offre(esquive).esquive, null);
  refuse(esquive, { type: "esquive", x: 1 }, "hors_moment", "L'esquive ne s'offre pas à cet instant.");
  assert.deepEqual(offre(esquive).types, ["appliquer"], "après une esquive, il ne reste qu'« Appliquer »");
  const fini = jouer(esquive, APPLIQUER);
  assert.equal(fini.protagonistes.pj1.zones[1].armure, 0);
  assert.equal(fini.protagonistes.pj1.zones[1].resistance, 3, "15 − 3 = 12 : l'armure tombe, 2 passent à la résistance");
  assert.match(derniereLigne(fini), /Aubépine intervient : Pas de côté \(1 action, 3 souffle\), 15 → 12\. Armure 10 → 0, résistance 5 → 3\.$/);

  // Le plus petit du souffle et des dégâts.
  const adverse = (pj) => combat(surD4(pj, MARMITON), { quiCommence: "adv" });
  const jusquAuxSuites = (etat, ...des) => jouer(etat, capacite(etat, "adv2", "Frappe"), viser("pj1"), ...des, d20(5));
  const essoufflee = adverse(pjEssai((champs) => (champs.souffle = 4)));
  assert.deepEqual(offre(jusquAuxSuites(essoufflee, d8(2))).esquive, { min: 1, max: 4, capacite: 7 });
  // Deux réussites en défense : A = 5.
  assert.deepEqual(offre(jusquAuxSuites(adverse(AUBEPINE), d8(4), d8(4), d8(2))).esquive, { min: 1, max: 5, capacite: 7 });

  // Elle ne s'offre pas : sans souffle, sans action, sans la capacité, sans dégâts, ni à un adversaire.
  assert.equal(offre(jusquAuxSuites(adverse(pjEssai((champs) => (champs.souffle = 0))), d8(2))).esquive, null);
  assert.equal(offre(jusquAuxSuites(adverse(pjEssai((champs) => (champs.actions = 0))), d8(2))).esquive, null);
  assert.equal(offre(jusquAuxSuites(adverse(pjEssai((champs) => (champs.capacites[7].role = null))), d8(2))).esquive, null);
  const sansDegats = combat(surD4(AUBEPINE, adversaireEssai((champs) => (champs.capacites[0].facons[0].degats = null))), { quiCommence: "adv" });
  assert.equal(offre(jusquAuxSuites(sansDegats, d8(2))).esquive, null);
  const { etat: bilan } = temoins().bilan;
  assert.equal(offre(jouer(bilan, d20(5))).esquive, null, "le souffle d'un adversaire n'annule rien");
});

test("appliquer : les dégâts vont à la victime, la ligne s'écrit, le geste quitte la pile", () => {
  const { etat: bilan } = temoins().bilan;
  const suites = jouer(bilan, d20(5));
  assert.equal(gesteEnCours(suites).resultat, null);
  const fini = jouer(suites, APPLIQUER);
  assert.deepEqual(fini.pile, []);
  assert.deepEqual(fini.protagonistes.adv2.zones[0], { armure: 5, armureMax: 10, resistance: 5, resistanceMax: 5 });
  assert.equal(fini.protagonistes.adv2.zones[1], bilan.protagonistes.adv2.zones[1], "une zone intacte est partagée : le même objet");
  assert.equal(fini.photos, bilan.photos, "les photographies sont partagées");
  assert.deepEqual(dernier(fini.journal), { genre: "geste", texte: "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5." });
});

// ─── L'état rendu ───────────────────────────────────────────────────────────

test("tout ce que rend appliquer est gelé, et rien de ce qu'elle reçoit n'est modifié", () => {
  for (const [colonne, temoin] of Object.entries(temoins())) {
    assert.equal(estGele(temoin.etat), true, colonne);
    const avant = JSON.stringify(temoin.etat);
    for (const type of TYPES) appliquer(temoin.etat, type === "de" && temoin.de ? temoin.de : ECHANTILLONS[type]);
    assert.equal(JSON.stringify(temoin.etat), avant, `${colonne} : l'état reçu n'a pas changé`);
  }
  // L'événement non plus : ni gelé, ni retouché.
  const { etat } = temoins().bilan;
  const evenement = { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 3, raison: "Frappe" }], nature: "normaux" };
  const copie = structuredClone(evenement);
  const rendu = jouer(etat, evenement);
  assert.deepEqual(evenement, copie);
  assert.equal(Object.isFrozen(evenement), false);
  assert.equal(estGele(rendu), true);
});

test("l'annonce porte le pas de l'événement qui l'a dite ; un événement qui n'a rien à dire laisse celle d'avant, l'objet même", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  assert.deepEqual(depart.annonce, { pas: 1, texte: "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. — Tour 1 · camp des PJ —" });
  const ouvert = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"));
  assert.equal(ouvert.pas, 3);
  assert.equal(ouvert.annonce, depart.annonce);
  const lance = jouer(ouvert, d8(8));
  assert.equal(lance.annonce.pas, 4);
  assert.equal(typeof lance.annonce.texte, "string");
  assert.notEqual(lance.annonce.texte, "");
  // La fin d'un geste : sa ligne, entière.
  const fini = jouer(lance, d8(2), d20(5), APPLIQUER);
  assert.deepEqual(fini.annonce, { pas: fini.pas, texte: derniereLigne(fini) });
});

// ─── Le rejeu ───────────────────────────────────────────────────────────────

const PHOTOS_DE_REFERENCE = { "Aubépine Crèmebrûlée": aubepineEssai(), "Chef de partie": chefDePartieEssai(), "Marmiton de corvée": marmitonDeCorveeEssai() };

test("rejouer refait l'état en appliquant chaque événement, journal compris, et le retrouve après un passage par JSON", () => {
  const { contenu, etat } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  assert.deepEqual(rejouer(contenu), { etat });
  const relu = rejouer(JSON.parse(JSON.stringify(contenu)));
  assert.deepEqual(relu.etat, etat);
  assert.equal(JSON.stringify(relu.etat), JSON.stringify(etat));
  assert.equal(estGele(relu.etat), true);
  assert.equal(etat.pas, contenu.evenements.length);
  // Sans événement, c'est l'état de la préparation.
  assert.deepEqual(rejouer({ ...contenu, evenements: [] }), { etat: ouvrirCombat(contenu.miseEnPlace) });
});

test("rejouer s'arrête au premier refus, et dit lequel : la suite n'est jamais tronquée en silence", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 2 });
  const [premier, ...suite] = contenu.evenements;
  // Un événement de trop au milieu : le troisième.
  const forge = { ...contenu, evenements: [premier, suite[0], { type: "appliquer" }, ...suite.slice(1)] };
  assert.deepEqual(rejouer(forge), { erreur: { pas: 3, code: "hors_moment", message: "Le geste en cours n'en est pas là." } });
  // Un dé qui n'est plus celui que le moteur attend : refusé, non rejoué de travers.
  const rang = contenu.evenements.findIndex((evenement) => evenement.type === "de");
  const autreDe = contenu.evenements.map((evenement, indice) => (indice === rang ? { ...evenement, faces: 12 } : evenement));
  assert.deepEqual(rejouer({ ...contenu, evenements: autreDe }).erreur, { pas: rang + 1, code: "hors_bornes", message: "Le dé attendu est un d10." });
  // Un événement mal fait.
  assert.equal(rejouer({ ...contenu, evenements: [premier, { type: "danser" }] }).erreur.code, "forme");
  assert.equal(rejouer({ ...contenu, evenements: [premier, { type: "danser" }] }).erreur.pas, 2);
});

test("rejouer refuse un contenu d'une autre version des règles, ou qui ne se lit pas, sans rien jouer", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 0 });
  assert.equal(contenu.regles, REGLES);
  assert.deepEqual(rejouer({ ...contenu, regles: REGLES + 1 }).erreur, { pas: 0, code: "forme", message: "Ce combat a été commencé avec une autre version des règles." });
  for (const abime of [null, {}, { ...contenu, evenements: null }, { ...contenu, miseEnPlace: null }, { ...contenu, miseEnPlace: { protagonistes: [{}] } }]) {
    const rendu = rejouer(abime);
    assert.equal(rendu.etat, undefined);
    assert.equal(rendu.erreur.pas, 0);
    assert.equal(rendu.erreur.code, "forme");
  }
});

// ─── Le lecteur de scénario ─────────────────────────────────────────────────

test("le scénario de référence se joue en entier : les cases d'office, le journal mot pour mot, la victoire", () => {
  const { contenu, etat, casesDOffice: cases } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  assert.deepEqual(cases, casesDOffice);
  assert.deepEqual(
    etat.journal.map((ligne) => ligne.texte),
    journalAttendu,
  );
  assert.equal(etat.phase, "termine");
  assert.equal(etat.vainqueur, "pj");
  assert.deepEqual(contenu.evenements[0], { type: "lancer", le: scenario.lanceLe });
  assert.deepEqual(Object.keys(contenu), ["regles", "revision", "miseEnPlace", "evenements"]);
  assert.equal(contenu.miseEnPlace.quiCommence, "pj");
  assert.deepEqual(
    contenu.miseEnPlace.protagonistes.map((protagoniste) => protagoniste.case),
    ["C3", "F6", "D4", "D4"],
  );
  // Les lignes où quelqu'un meurt le disent.
  assert.deepEqual(
    etat.journal.filter((ligne) => ligne.mort).map((ligne) => ligne.texte.slice(-8)),
    ["1 meurt.", "2 meurt.", "f meurt."],
  );
});

const avecLeGeste = (rang, champs) => ({ ...scenario, gestes: scenario.gestes.map((geste, indice) => (indice === rang ? { ...geste, ...champs } : geste)) });

test("le lecteur de scénario lève, en citant le geste : un dé de trop, un dé qui manque, un événement refusé, une consigne qui ne sert pas", () => {
  const jouerAvec = (rang, champs) => () => versContenu(avecLeGeste(rang, champs), PHOTOS_DE_REFERENCE);
  assert.throws(jouerAvec(0, { des: [6, 9, 8, 2, 4] }), /^Error: Geste n° 1 \(Aubépine, Frappe\) : 1 dé\(s\) de trop dans « des » : 4\.$/);
  assert.throws(jouerAvec(0, { des: [6, 9, 8] }), /Geste n° 1 \(Aubépine, Frappe\) : un dé manque dans « des » : le moteur attend 2 d10 après 2 valeur\(s\)/);
  assert.throws(jouerAvec(0, { localisation: [16, 3] }), /Geste n° 1 .* de trop dans « localisation » : 3\./);
  assert.throws(jouerAvec(0, { localisation: [] }), /Geste n° 1 .* un dé manque dans « localisation »/);
  // Le Chef est en F6, hors de la portée du couteau : la cible est refusée.
  assert.throws(jouerAvec(0, { contre: "Chef" }), /Geste n° 1 \(Aubépine, Frappe\) : l'événement \{"type":"regler","champ":"cible","valeur":"adv2"\} est refusé \(interdit\) : hors de portée : 3 cases, portée 1/);
  assert.throws(jouerAvec(0, { esquive: 2 }), /Geste n° 1 .*"type":"esquive","x":2.* est refusé \(hors_moment\)/);
  // Le dernier geste du tour 4 manque : il n'y a pas de bilan où fixer des dégâts.
  assert.throws(jouerAvec(13, { degats: { ajuste: 3 } }), /Geste n° 14 \(Aubépine, Frappe\) : « degats » est écrit, mais le geste a fini sans que le moteur l'offre\./);
  assert.throws(jouerAvec(0, { garde: [3] }), /Geste n° 1 .* aucun dé n'était à garder à la place 3\./);
  assert.throws(jouerAvec(0, { cible: "Chef" }), /Geste n° 1 .* le champ « cible » n'existe pas\./);
  assert.throws(jouerAvec(0, { qui: "Aubépine Crèmebrûlée" }), /personne ne s'appelle « Aubépine Crèmebrûlée » \(noms courts : Aubépine, Chef, Marmiton n° 1, Marmiton n° 2\)/);
  assert.throws(jouerAvec(0, { joue: "Fricassée" }), /Aubépine n'a pas de capacité « Fricassée »\./);
  assert.throws(jouerAvec(0, { sur: "Marmiton n° 1", contre: undefined }), /« sur » vise un allié ou soi/);
  assert.throws(jouerAvec(1, { vers: "D4", puissance: 3 }), /0 façon\(s\) de « Pas chassé » répondent/);
  assert.throws(() => versContenu(scenario, { ...PHOTOS_DE_REFERENCE, "Chef de partie": undefined }), /La mise en place : /);
  assert.throws(() => versContenu({ ...scenario, ajouts: [["pj", "Ciboulette"]] }, PHOTOS_DE_REFERENCE), /La mise en place : aucune photographie pour « Ciboulette »\./);
});

test("le lecteur de scénario s'arrête après tant de gestes, ou en plein geste, avant le dé suivant", () => {
  const entier = versContenu(scenario, PHOTOS_DE_REFERENCE);
  const debut = (nombre) => entier.contenu.evenements.slice(0, nombre);

  // Aucun geste : le lancement seul.
  const lance = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 0 });
  assert.deepEqual(lance.contenu.evenements, [{ type: "lancer", le: scenario.lanceLe }]);
  // Deux gestes : la Frappe et le Pas chassé, puis la fin automatique du tour.
  const deux = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 2 });
  assert.deepEqual(deux.contenu.evenements, debut(deux.contenu.evenements.length));
  assert.equal(deux.etat.journal.length, 6);
  assert.deepEqual(deux.etat.tour, { numero: 1, camp: "adv" });
  assert.deepEqual(deux.etat.pile, []);

  // Le septième geste, la Taloche : deux dés lancés, la relance choisie, le
  // combat attend le dé de la relance.
  const enPlein = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  assert.deepEqual(enPlein.contenu.evenements, debut(enPlein.contenu.evenements.length));
  assert.deepEqual(dernier(enPlein.contenu.evenements), { type: "relancer" });
  assert.deepEqual(offre(enPlein.etat).de, { faces: 8, combien: 1, motif: "relance", place: 2 });
  assert.equal(gesteEnCours(enPlein.etat).jet.places.length, 2);
  // Avant le premier dé : la capacité et ses réglages, rien de payé.
  const avant = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 0 } });
  assert.equal(gesteEnCours(avant.etat).paye, false);
  assert.deepEqual(gesteEnCours(avant.etat).caracteristiques, ["force", "agilite"]);
  assert.equal(avant.etat.protagonistes.pj1.actions, 1, "l'Émincer d'avant a pris la première action");
  // Les quatre dés de la chaîne lancés : il attend le d20.
  const auD20 = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 4 } });
  assert.equal(offre(auD20.etat).de.motif, "localisation");

  // Le d20 lancé : les dégâts attendent « Appliquer ».
  const auxSuites = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 5 } });
  assert.equal(gesteEnCours(auxSuites.etat).moment, "suites");
  assert.equal(auxSuites.etat.protagonistes.adv4.corps, 10, "rien n'est appliqué");
  // Au huitième geste, l'esquive écrite n'est pas jouée non plus : on s'arrête avant elle.
  const avantLEsquive = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 8, des: 3 } });
  assert.deepEqual(offre(avantLEsquive.etat).esquive, { min: 1, max: 6, capacite: 16 });
  assert.deepEqual(gesteEnCours(avantLEsquive.etat).interventions, []);

  // Un geste qui ne lance pas tant de dés, ou que ce dé finit : on ne s'y arrête pas.
  assert.throws(() => versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 6 } }), /Geste n° 7 \(Aubépine, Taloche\) : le geste a fini avant qu'on s'y arrête \(6 dé\(s\) demandé\(s\)\)\./);
  assert.throws(() => versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 14, des: 1 } }), /Geste n° 14 \(Aubépine, Frappe\) : le geste a fini avant qu'on s'y arrête/);
  assert.throws(() => versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 12, des: 0 } }), /Geste n° 12 \(Marmiton n° 2, passe\) : le geste a fini avant qu'on s'y arrête/);
  assert.throws(() => versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 99 }), /« jusqua » est un nombre de gestes \(de 0 à 18\)/);
  assert.throws(() => versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 0, des: 1 } }), /« jusqua »/);
});

test("le lecteur de scénario : les champs que la référence n'emploie pas (sur, sansCible, x, main, decale, arme)", () => {
  const photos = { Aubépine: AUBEPINE, Marmiton: MARMITON };
  const base = { mode: "demo", quiCommence: "pj", lanceLe: "2026-10-12T21:30", ajouts: [["pj", "Aubépine"], ["adversaire", "Marmiton", 2]], cases: { "Marmiton n° 1": "A1", "Marmiton n° 2": "A1" } };
  const { etat, contenu } = versContenu(
    {
      ...base,
      gestes: [
        { qui: "Aubépine", joue: "Flambage", puissance: 1, sur: "Aubépine" },
        // Le deuxième dé échoue, une relance reste : elle est refusée (garde).
        {
          qui: "Aubépine",
          joue: "Frappe",
          contre: "Marmiton n° 2",
          main: { modificateur: [1, "Sel fin"], avantages: [1, "Minutie"] },
          des: [7, 2],
          garde: [2],
          localisation: [20],
          decale: [{ de: 0, valeur: -8, raison: "Coup d'œil" }],
        },
        // Aubépine a retrouvé ses deux actions : l'esquive lui en prend une.
        { qui: "Marmiton n° 1", joue: "Frappe", arme: "Spatule souple", contre: "Aubépine", des: [1], localisation: [3], esquive: 4 },
        { qui: "Marmiton n° 2", joue: "Pas chassé", puissance: 1, vers: "B2" },
        // Il lui reste une action, et 1 point de souffle.
        { qui: "Aubépine", joue: "Pas de côté", sansCible: true, x: 1 },
        { qui: "Marmiton n° 1", passe: true },
        { finDeTour: true },
      ],
    },
    photos,
  );
  assert.deepEqual(
    etat.journal.map((ligne) => ligne.texte),
    [
      "Combat lancé : 1 personnage contre 2 adversaires. Les PJ commencent.",
      "— Tour 1 · camp des PJ —",
      "Aubépine : Flambage [1] (5 souffle) sur Aubépine.",
      "Aubépine : Frappe contre Marmiton n° 2. d8+1 contre 5 (+1 à la main : Sel fin), 1 avantage (à la main : Minutie) → 8 ✓, 3 ✗ : 1 réussite, A = 5. Localisation d20 → 20, décalée à 12 (Coup d'œil) : jambe gauche. Armure 10 → 5.",
      "Fin du tour des PJ : ils retrouvent leurs actions.",
      "— Tour 1 · camp des adversaires —",
      "Marmiton n° 1 : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 1 ✗ : aucune réussite, Aubépine reçoit C = 15. Localisation d20 → 3 : torse. Aubépine intervient : Pas de côté (1 action, 4 souffle), 15 → 11. Armure 10 → 0, résistance 5 → 4.",
      "Marmiton n° 2 : Pas chassé [1], A1 → B2.",
      "Fin du tour des adversaires : ils retrouvent leurs actions.",
      "— Tour 2 · camp des PJ —",
      "Aubépine : Pas de côté (1 souffle).",
      "Fin du tour des PJ : ils retrouvent leurs actions.",
      "— Tour 2 · camp des adversaires —",
      "Marmiton n° 1 passe son tour.",
      "Fin du tour des adversaires : ils retrouvent leurs actions.",
      "— Tour 3 · camp des PJ —",
    ],
  );
  assert.deepEqual(dernier(contenu.evenements), { type: "fin_de_tour" });
  assert.deepEqual(
    contenu.evenements.filter((evenement) => evenement.type === "regler" && evenement.champ === "cible").map((evenement) => evenement.valeur),
    ["pj1", "adv3", "pj1"],
    "« sansCible » ne règle rien : la cible est déjà vide",
  );
});

test("le lecteur de scénario : des dégâts fixés, une face décalée, une arme prêtée par son libellé", () => {
  const photos = { Aubépine: AUBEPINE, Marmiton: MARMITON };
  const { etat } = versContenu(
    {
      mode: "demo",
      lanceLe: "2026-10-12T21:30",
      ajouts: [["pj", "Aubépine"], ["adversaire", "Marmiton"]],
      cases: { Marmiton: "A1" },
      gestes: [
        { qui: "Aubépine", joue: "Flambage", puissance: 1, pret: "Couteau d'office", contre: "Marmiton", des: [8, 1], degats: { base: "arme" }, localisation: [14], decale: [{ de: 0, valeur: -2, raison: "Coup d'œil" }] },
        { qui: "Aubépine", joue: "Frappe", contre: "Marmiton", des: [8, 8, 1], degats: { ajuste: 12, raison: "Coup de torchon", nature: "resistance" }, localisation: [2] },
      ],
    },
    photos,
  );
  assert.deepEqual(
    etat.journal.slice(2, 4).map((ligne) => ligne.texte),
    [
      "Aubépine : Flambage [1] (5 souffle) contre Marmiton. d8 contre 5 → 8 ✓, 1 ✗ : 1 réussite, touché, dégâts de l'arme : A = 5. Localisation d20 → 14, décalée à 12 (Coup d'œil) : jambe gauche. Armure 10 → 5.",
      "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 8 ✓, 1 ✗ : 2 réussites, B = 10, dégâts directs à la résistance : 12 (Coup de torchon). Localisation d20 → 2 : torse. Résistance 5 → 0, corps 10 → 3. Blessure (torse), sans effet calculé.",
    ],
  );
  assert.equal(etat.quiCommence, "pj", "sans « quiCommence », les PJ commencent");
});

// ─── Les modules ────────────────────────────────────────────────────────────

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const importsDe = (texte) => [...texte.matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)";/gms)].map((trouve) => trouve[1]).sort();

test("offre.js et moteur.js n'importent que ce que le noyau leur permet ; l'offre n'importe jamais le moteur", () => {
  assert.deepEqual(importsDe(lire("../js/combat/offre.js")), ["../personnage/regles.js", "./circonstances.js", "./degats.js", "./forme.js", "./jet.js", "./plateau.js", "./regles.js", "./valeurs.js"]);
  const duMoteur = importsDe(lire("../js/combat/moteur.js"));
  const permis = ["../personnage/regles.js", "./circonstances.js", "./degats.js", "./forme.js", "./jet.js", "./journal.js", "./noms.js", "./offre.js", "./plateau.js", "./preparation.js", "./regles.js", "./valeurs.js"];
  for (const chemin of duMoteur) assert.equal(permis.includes(chemin), true, `le moteur importe ${chemin}`);
  for (const attendu of ["./offre.js", "./journal.js", "./forme.js", "../personnage/regles.js"]) assert.equal(duMoteur.includes(attendu), true, `le moteur n'importe pas ${attendu}`);
});

test("offre.js et moteur.js exportent ce que dit le contrat, et l'offre deux fonctions de plus : le prix d'un geste, celui d'une esquive", () => {
  assert.deepEqual(Object.keys(moteur).sort(), ["appliquer", "gesteEnCours", "ouvrirCombat", "rejouer"]);
  assert.deepEqual(Object.keys(porte).sort(), [
    "accepte",
    "acteurCourant",
    "arrivees",
    "boutons",
    "candidats",
    "cibles",
    "esquiveOfferte",
    "faconsDe",
    "offre",
    "pret",
    "prixDeLEsquive",
    "prixDuGeste",
    "reglages",
  ]);
});

test("offre.js, moteur.js et scenario.js : un en-tête qui dit le pourquoi et le § 17 ; ni hasard, ni heure, ni écran ; aucun signe caché", () => {
  const invisibles = [0xa0, 0x202f, 0xad, 0xfeff, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x2060];
  for (const chemin of ["../js/combat/offre.js", "../js/combat/moteur.js", "./outils/scenario.js"]) {
    const texte = lire(chemin);
    assert.match(texte.slice(0, 400), /^\/\/ .*\(SPECIFICATION\.md, § 17/s, chemin);
    for (const code of invisibles) assert.equal(texte.includes(String.fromCodePoint(code)), false, `${chemin} porte le signe U+${code.toString(16)}`);
  }
  // Le noyau : rien de local à l'appareil, ni Map ni Set (l'état passe par JSON à l'identique).
  for (const chemin of ["../js/combat/offre.js", "../js/combat/moteur.js"]) {
    const texte = lire(chemin);
    for (const interdit of ["localeCompare", "toLocale", "Intl", "new Date", "Date.now", "Math.random", "document", "indexedDB", "innerHTML", "new Map", "new Set"]) {
      assert.equal(texte.includes(interdit), false, `${chemin} emploie ${interdit}`);
    }
  }
  // Le moment d'un geste ne change que dans avancer() : un seul « switch » dans le moteur, aucun dans l'offre ;
  // hors d'avancer(), le moteur n'écrit un moment qu'à l'ouverture du geste.
  assert.equal(lire("../js/combat/moteur.js").split("switch (").length - 1, 1);
  assert.equal(lire("../js/combat/offre.js").includes("switch ("), false);
  assert.equal(lire("../js/combat/moteur.js").split("moment:").length - 1, 1);
});
