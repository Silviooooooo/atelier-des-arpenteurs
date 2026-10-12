// Contrôles des vues du combat (SPECIFICATION.md, § 17 « Le simulateur de
// combat (lot 4) », et § 11) : js/combat/lecture.js.
//
// Ce qu'ils tiennent :
// - les cinq vues, champ par champ : la barre et ses quatre lignes d'aide, le
//   plateau, la fiche vivante (dont le texte de chacun des huit passifs
//   câblés, actif et inactif), le panneau d'action (titre, étapes, boutons et
//   raisons, cibles, cases, choix, saisies et bornes, détail des dégâts,
//   annonce), la préparation ;
// - la concordance : à chaque moment du combat de référence, tout événement
//   que porte une vue active est accepté par le moteur, tout événement que
//   porte un bouton inactif est refusé, et l'événement réellement joué
//   ensuite est de ceux que les vues portaient.
//
// Les attendus sont écrits d'après la mission et le contrat, jamais recopiés
// de ce que rend le module.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vueBarre, vueFiche, vueLigne, vuePanneau, vuePlateau, vuePreparation } from "../js/combat/lecture.js";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { candidats } from "../js/combat/offre.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide } from "../js/combat/preparation.js";
import { scenario } from "./outils/combat_reference.js";
import {
  adversaireEssai,
  ajouterPassif,
  aubepineEssai,
  capaciteEssai,
  chefDePartieEssai,
  faconEssai,
  marmitonDeCorveeEssai,
  miseEnPlaceEssai,
  pjEssai,
} from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const PHOTOS_DE_REFERENCE = {
  "Aubépine Crèmebrûlée": aubepineEssai(),
  "Chef de partie": chefDePartieEssai(),
  "Marmiton de corvée": marmitonDeCorveeEssai(),
};

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

/** Un combat lancé : chaque protagoniste est { photo, case }. */
const combat = (protagonistes, options) => jouer(ouvrirCombat(miseEnPlaceEssai(protagonistes, options)), LANCER);

/** Le duel rond : Aubépine (pj1) et un Marmiton (adv2), sur la même case sauf avis contraire. */
const duel = ({ pj = pjEssai(), adv = adversaireEssai(), casePj = "D4", caseAdv = "D4" } = {}) =>
  combat([
    { photo: pj, case: casePj },
    { photo: adv, case: caseAdv },
  ]);

const indiceDe = (etat, qui, nom) => {
  const indice = etat.photos[qui].capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(indice, -1, `« ${nom} » n'est pas une capacité de ${qui}`);
  return indice;
};

/** L'événement qui ouvre une capacité, par son nom. */
const capacite = (etat, qui, nom, facon = 0) => ({ type: "capacite", qui, capacite: indiceDe(etat, qui, nom), facon });
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const de = (faces, ...valeurs) => ({ type: "de", faces, valeurs });

/** Tous les boutons de capacité d'un panneau, à plat. */
const boutonsDe = (panneau) => panneau.groupes.flatMap((groupe) => groupe.boutons);
const boutonNomme = (panneau, libelle) => {
  const trouve = boutonsDe(panneau).find((bouton) => bouton.libelle === libelle);
  assert.ok(trouve, `aucun bouton « ${libelle} » parmi : ${boutonsDe(panneau).map((bouton) => bouton.libelle).join(", ")}`);
  return trouve;
};
const etapesDites = (panneau) => panneau.etapes.map(({ nom, etat }) => `${nom}:${etat}`).join(" ");
const etapeDite = (panneau, rang) => `${panneau.etapes[rang].nom}:${panneau.etapes[rang].etat}`;

// ─── La barre ───────────────────────────────────────────────────────────────

test("barre : l'état et la ligne d'aide de chacune des quatre phases", () => {
  const avant = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  assert.deepEqual(vueBarre(avant), {
    etat: "Préparation",
    aide: "Un protagoniste ajouté se pose d'office : un personnage sur la colonne A, un adversaire sur la colonne J. Déplacez-le en le faisant glisser, en touchant son jeton puis une case, ou par le champ « Case » de sa fiche.",
    finDeTour: null,
  });

  const tourDesPj = jouer(avant, LANCER);
  assert.deepEqual(vueBarre(tourDesPj), {
    etat: "Tour 1 · camp des PJ",
    aide: "Les PJ jouent dans l'ordre de leur choix. Le tour des adversaires commence quand tous ont joué, ou sur « Fin de tour ».",
    finDeTour: { actif: true, raison: null, commande: { evenement: { type: "fin_de_tour" } } },
  });

  const tourDesAdversaires = jouer(tourDesPj, FIN_DE_TOUR);
  assert.equal(vueBarre(tourDesAdversaires).etat, "Tour 1 · camp des adversaires");
  assert.equal(
    vueBarre(tourDesAdversaires).aide,
    "Les adversaires jouent dans l'ordre de votre choix. Le tour des PJ commence quand tous ont joué, ou sur « Fin de tour ».",
  );
  assert.equal(vueBarre(jouer(tourDesAdversaires, FIN_DE_TOUR)).etat, "Tour 2 · camp des PJ", "le numéro monte quand le camp qui a commencé rejoue");

  const { etat: fini } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  assert.equal(fini.phase, "termine");
  assert.deepEqual(vueBarre(fini), { etat: "Combat terminé", aide: "Le combat est terminé. Le journal se copie et se télécharge toujours.", finDeTour: null });
});

test("barre : « Fin de tour » reste proposé pendant qu'un geste se règle, et devient inactif au milieu d'une action", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.equal(vueBarre(etat).finDeTour.actif, true, "rien n'est payé : le tour peut finir");

  etat = jouer(etat, de(8, 6));
  assert.deepEqual(vueBarre(etat).finDeTour, { actif: false, raison: "Une action est en cours.", commande: { evenement: { type: "fin_de_tour" } } });
  assert.equal(appliquer(etat, FIN_DE_TOUR).refus.code, "hors_moment", "le moteur refuse ce que la barre dit inactif");
});

// ─── Le plateau ─────────────────────────────────────────────────────────────

test("plateau : avant le lancement, des jetons sans choix ni marque, et les seules cases occupées", () => {
  const etat = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  const vue = vuePlateau(etat, null);
  assert.equal(vue.phase, "preparation");
  assert.deepEqual(vue.cases, { A1: { jetons: ["pj1"], active: false, choix: null }, J1: { jetons: ["adv2"], active: false, choix: null } });
  assert.deepEqual(vue.jetons.pj1, {
    camp: "pj",
    entier: "Aubépine",
    jeton: "Aubépine",
    initiales: "A",
    marque: null,
    mort: false,
    nom: "Aubépine, personnage, case A1",
    choix: null,
    inactif: false,
  });
  assert.equal(vue.jetons.adv2.nom, "Marmiton, adversaire, case J1");
});

test("plateau : « Qui joue ? » : un candidat se choisit par son jeton, et rien n'est écarté au repos", () => {
  const etat = duel({ caseAdv: "E5" });
  const vue = vuePlateau(etat, null);
  assert.deepEqual(vue.jetons.pj1.choix, { commande: { choisir: "pj1" } });
  assert.equal(vue.jetons.adv2.choix, null, "ce n'est pas le tour des adversaires");
  assert.deepEqual([vue.jetons.pj1.inactif, vue.jetons.adv2.inactif], [false, false], "aucun jeton inactif hors d'un choix de cible ou d'arrivée");
  assert.equal(vue.cases.D4.active, false, "personne n'est encore choisi");

  const choisie = vuePlateau(etat, "pj1");
  assert.equal(choisie.jetons.pj1.marque, "joue");
  assert.equal(choisie.jetons.pj1.nom, "Aubépine, personnage, joue, case D4");
  assert.equal(choisie.cases.D4.active, true, "la case de qui joue");
  assert.equal(choisie.cases.E5.active, false);
  assert.equal(vuePlateau(etat, "adv2").jetons.adv2.marque, null, "un choisi qui ne peut pas jouer n'est pas celui qui joue");
});

test("plateau : pendant un choix de cible, la cible à portée se choisit, celle hors de portée devient inactive sans changer de marque", () => {
  const trio = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: adversaireEssai(), case: "D5" },
    { photo: adversaireEssai(), case: "D7" },
  ]);
  const repos = vuePlateau(trio, "pj1");
  assert.deepEqual([repos.jetons.adv2.inactif, repos.jetons.adv3.inactif], [false, false]);

  // La Frappe du couteau porte à 1 : D5 est à portée, D7 non.
  const etat = jouer(trio, capacite(trio, "pj1", "Frappe"));
  const vue = vuePlateau(etat, null);
  assert.deepEqual(vue.jetons.adv2.choix, { commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } } });
  assert.equal(vue.jetons.adv2.inactif, false);
  assert.equal(vue.jetons.adv3.choix, null);
  assert.equal(vue.jetons.adv3.inactif, true);
  assert.deepEqual([vue.jetons.adv3.marque, repos.jetons.adv3.marque], [null, null], "ni sa marque ni sa case n'ont changé");
  assert.deepEqual(vue.cases.D7, repos.cases.D7);
  assert.equal(vue.jetons.pj1.choix, null, "une attaque ne vise pas son camp");
  assert.equal(vue.jetons.pj1.marque, "joue");
  assert.equal(appliquer(etat, { type: "regler", champ: "cible", valeur: "adv3" }).refus.code, "interdit", "le moteur refuse la cible que le plateau écarte");

  const visee = vuePlateau(jouer(etat, regler("cible", "adv2")), null);
  assert.equal(visee.jetons.adv2.marque, "cible");
  assert.equal(visee.jetons.adv2.nom, "Marmiton n° 1, adversaire, ciblé, case D5");
  assert.notEqual(visee.jetons.adv2.choix, null, "la cible se rechoisit tant que rien n'est payé");

  const payee = vuePlateau(jouer(etat, regler("cible", "adv2"), de(8, 6)), null);
  assert.deepEqual([payee.jetons.adv2.choix, payee.jetons.adv2.inactif, payee.jetons.adv3.inactif], [null, false, false], "le choix est fermé : plus rien n'est écarté");
  assert.equal(payee.jetons.adv2.marque, "cible");
});

test("plateau : pendant un choix d'arrivée, les cases possibles portent leur commande et leur nom, et tout jeton est inactif", () => {
  let etat = duel({ casePj: "A1", caseAdv: "J10" });
  etat = jouer(etat, capacite(etat, "pj1", "Pas chassé", 0));
  const vue = vuePlateau(etat, null);
  assert.deepEqual(
    Object.keys(vue.cases).filter((nom) => vue.cases[nom].choix !== null),
    ["A2", "B1", "B2"],
    "à une distance de 1 : les voisines, diagonale comprise",
  );
  assert.deepEqual(vue.cases.B2, { jetons: [], active: false, choix: { commande: { evenement: { type: "regler", champ: "arrivee", valeur: "B2" } }, nom: "Case B2 : s'y déplacer" } });
  assert.equal(vue.cases.A1.choix, null, "sa propre case n'est pas une arrivée");
  assert.equal(vue.cases.A1.active, true);
  assert.deepEqual([vue.jetons.pj1.inactif, vue.jetons.adv2.inactif], [true, true]);
  assert.deepEqual([vue.jetons.pj1.choix, vue.jetons.adv2.choix], [null, null]);
});

test("plateau : un mort reste sur sa case, marqué mort ; dans une case, celui qui joue vient en tête, puis la cible", () => {
  const { etat: fini } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  const vue = vuePlateau(fini, null);
  const morts = Object.keys(vue.jetons).filter((id) => vue.jetons[id].mort);
  assert.ok(morts.length >= 2, "le combat de référence finit par la mort des adversaires");
  for (const id of morts) {
    assert.match(vue.jetons[id].nom, /, mort, case [A-J](?:10|[1-9])$/);
    assert.deepEqual([vue.jetons[id].choix, vue.jetons[id].inactif], [null, false]);
  }

  // Cinq sur la case : le dernier ajouté joue, l'avant-dernier adversaire est visé.
  const foule = combat([
    { photo: adversaireEssai(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
    { photo: pjEssai(), case: "D4" },
  ]);
  assert.deepEqual(vuePlateau(foule, null).cases.D4.jetons, ["adv1", "adv2", "adv3", "adv4", "pj5"], "au repos, l'ordre d'ajout");
  const vise = jouer(foule, capacite(foule, "pj5", "Frappe"), regler("cible", "adv4"));
  assert.deepEqual(vuePlateau(vise, null).cases.D4.jetons, ["pj5", "adv4", "adv1", "adv2", "adv3"]);
});

// ─── Une fiche vivante ──────────────────────────────────────────────────────

test("fiche : Aubépine telle que la démonstration la donne", () => {
  const etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: chefDePartieEssai(), case: "F6" },
  ]);
  const fiche = vueFiche(etat, "pj1", null);
  assert.equal(fiche.id, "pj1");
  assert.equal(fiche.camp, "pj");
  assert.equal(fiche.initiales, "A");
  assert.equal(fiche.nom, "Aubépine Crèmebrûlée", "le nom entier");
  assert.equal(fiche.sousTitre, "Marmiton · Saucier");
  assert.equal(fiche.statut, null);
  assert.deepEqual(fiche.marques, []);
  assert.deepEqual(fiche.actions, { reste: 2, max: 2 });
  assert.deepEqual(fiche.souffle, { valeur: 10, max: 10, absent: false });
  assert.deepEqual(fiche.corps, { valeur: 10, max: 10 });
  assert.deepEqual(fiche.zones[0], { faces: "1", nombreDeFaces: 1, nom: "Tête", armure: { valeur: 6, max: 6, etat: null }, resistance: { valeur: 5, max: 5 } });
  assert.deepEqual(
    fiche.zones.map((zone) => `${zone.faces} ${zone.nom} ${zone.armure.max}`),
    ["1 Tête 6", "2-11 Torse 30", "12-13 Jambe gauche 10", "14-15 Jambe droite 10", "16-17 Bras gauche 10", "18-19 Bras droit 10"],
    "dans l'ordre du d20",
  );
  assert.equal(fiche.contre, "20 : contre-attaque");
  assert.equal(fiche.attaque, "Attaque d10 +1 · Couteau d'office, précise, 3/8/20");
  assert.equal(fiche.defense, "Défense d8 +1 · agile, types mêlés");
  assert.equal(fiche.bouclier, "Couvercle de marmite : 8 (sans effet)");
  assert.deepEqual(fiche.liens, [{ nom: "Grand Four", valeur: 1, max: 1 }]);
  assert.deepEqual(fiche.passifs, [
    { texte: "Réduction : +1 contre l'armure par réussite", actif: true, raison: null },
    { texte: "Vif : +1 en agilité", actif: true, raison: null },
    { texte: "Solo du chef : 1 avantage", actif: true, raison: null },
  ]);
  assert.deepEqual(fiche.effets, []);
  assert.deepEqual(fiche.jouer, { commande: { choisir: "pj1" } });
  assert.equal(fiche.avant, null);
});

test("fiche : un adversaire écrit ses deux nombres et ses armes ; le statut et « Jouer » suivent le tour", () => {
  const etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: chefDePartieEssai(), case: "D4" },
  ]);
  const chef = vueFiche(etat, "adv2", null);
  assert.equal(chef.nom, "Chef de partie");
  assert.equal(chef.sousTitre, "Commis, Rôtisseur ×1,4");
  assert.equal(chef.attaque, "Attaque 5 · Défense 7 · Spatule souple 6/12/19");
  assert.equal(chef.defense, null);
  assert.equal(chef.contre, "1 : contre-attaque");
  assert.deepEqual(
    chef.zones.map((zone) => `${zone.faces} ${zone.nom}`),
    ["2-11 Torse", "12-13 Jambe gauche", "14-15 Jambe droite", "16-17 Bras gauche", "18-19 Bras droit", "20 Tête"],
    "la zone écrite « Jambre droite » porte le nom des personnages",
  );
  assert.deepEqual(chef.liens, []);
  assert.equal(chef.jouer, null, "ce n'est pas son tour");

  // Celui qui joue n'a plus de bouton « Jouer » ; la cible est « ciblé ».
  assert.deepEqual([vueFiche(etat, "pj1", "pj1").statut, vueFiche(etat, "pj1", "pj1").marques, vueFiche(etat, "pj1", "pj1").jouer], ["joue", ["joue"], null]);
  const vise = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.deepEqual([vueFiche(vise, "adv2", null).statut, vueFiche(vise, "adv2", null).marques], ["ciblé", ["ciblee"]]);
  assert.equal(vueFiche(vise, "adv2", null).jouer, null);

  // À la fin du tour, « Jouer » passe au camp qui prend la main.
  const tourAdverse = jouer(etat, FIN_DE_TOUR);
  assert.deepEqual(vueFiche(tourAdverse, "adv2", null).jouer, { commande: { choisir: "adv2" } });
  assert.equal(vueFiche(tourAdverse, "pj1", null).jouer, null);

  // « a joué » : plus d'action, ou tour passé, dans le camp dont c'est le tour.
  const passe = jouer(
    combat([{ photo: pjEssai() }, { photo: pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" })) }, { photo: adversaireEssai() }]),
    { type: "passer", qui: "pj1" },
  );
  assert.deepEqual([vueFiche(passe, "pj1", null).statut, vueFiche(passe, "pj1", null).jouer], ["a joué", null]);
  assert.deepEqual([vueFiche(passe, "pj2", null).statut, vueFiche(passe, "pj2", null).jouer], [null, { commande: { choisir: "pj2" } }]);
  assert.equal(vuePlateau(passe, null).jetons.pj1.nom, "Aubépine, personnage, a joué, case A1");
});

test("fiche : avant le lancement, le champ « Case » et « Retirer » ; rien de tel ensuite", () => {
  const avant = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai(), case: "C3" }, { photo: adversaireEssai() }]));
  const fiche = vueFiche(avant, "pj1", null);
  assert.deepEqual(fiche.avant, { case: "C3", poser: { gabarit: { preparer: { type: "poser", id: "pj1" } } }, retirer: { commande: { preparer: { type: "retirer", id: "pj1" } } } });
  assert.equal(fiche.jouer, null);
  assert.equal(fiche.statut, null);
  assert.equal(vueFiche(jouer(avant, LANCER), "pj1", null).avant, null);
  assert.equal(vueFiche(avant, "pj9", null), null, "un inconnu n'a pas de fiche");
  assert.equal(vueFiche(avant, "constructor", null), null);
});

test("fiche : l'armure abîmée puis détruite, la blessure qui pèse sur les dés, le mort et son tour", () => {
  let etat = duel({ adv: adversaireEssai((valeurs) => Object.assign(valeurs, { attaque: 9 })) });
  etat = jouer(etat, FIN_DE_TOUR);
  // Le Marmiton frappe : aucune réussite en défense, C = 15 sur le torse.
  etat = jouer(etat, capacite(etat, "adv2", "Frappe"), regler("cible", "pj1"), de(8, 1), de(20, 5));
  assert.equal(vueFiche(etat, "pj1", null).zones[1].armure.etat, null, "rien n'est appliqué avant « Appliquer »");
  etat = jouer(etat, { type: "appliquer" });
  const blessee = vueFiche(etat, "pj1", null);
  assert.deepEqual(blessee.zones[1].armure, { valeur: 0, max: 10, etat: "detruite" });
  assert.deepEqual(blessee.zones[1].resistance, { valeur: 0, max: 5 });
  assert.equal(blessee.zones[0].armure.etat, null);
  assert.equal(blessee.attaque, "Attaque d8 −1 · Couteau d'office, précise, 5/10/15", "une blessure : −1, avec le signe moins du journal");
  assert.equal(blessee.defense, "Défense d8 −1 · agile");

  let entame = duel();
  entame = jouer(entame, capacite(entame, "pj1", "Frappe"), regler("cible", "adv2"), de(8, 6), de(8, 2), de(20, 12), { type: "appliquer" });
  const marmiton = vueFiche(entame, "adv2", null);
  assert.deepEqual(marmiton.zones[1].armure, { valeur: 5, max: 10, etat: "abimee" });
  assert.equal(marmiton.attaque, "Attaque 4 · Défense 5 · Spatule souple 5/10/15");

  const { etat: fini } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  const mort = fini.ordre.find((id) => fini.protagonistes[id].mort !== null);
  const fiche = vueFiche(fini, mort, null);
  assert.equal(fiche.statut, `mort au tour ${fini.protagonistes[mort].mort.tour}`);
  assert.deepEqual(fiche.marques, ["morte"]);
  assert.equal(fiche.jouer, null);
});

test("fiche : le souffle absent, la jauge de lien de taille 0, le PJ sans arme tenue", () => {
  const sansSouffle = adversaireEssai((valeurs) => Object.assign(valeurs, { souffle: 0, souffleAbsent: true, armes: [] }, { capacites: valeurs.capacites.slice(2) }));
  const pj = pjEssai((valeurs) => {
    valeurs.liens.push({ nom: "Petit Four", points: 0 });
    valeurs.armes.shift();
    valeurs.armePretee = 0;
    valeurs.capacites = valeurs.capacites.filter((une) => une.groupe.genre !== "arme");
    valeurs.capacites.find((une) => une.role === "mains_nues").facons[0].arme = 0;
  });
  const etat = duel({ pj, adv: sansSouffle });
  assert.deepEqual(vueFiche(etat, "adv2", null).souffle, { valeur: 0, max: 0, absent: true });
  assert.equal(vueFiche(etat, "adv2", null).attaque, "Attaque 4 · Défense 5", "sans arme, rien ne suit les deux nombres");
  assert.equal(vuePanneau(jouer(etat, FIN_DE_TOUR), "adv2").titre, "Marmiton joue — 1 action sur 1, souffle —");
  assert.deepEqual(vueFiche(etat, "pj1", null).liens, [{ nom: "Grand Four", valeur: 2, max: 2 }], "la jauge de taille 0 n'y est pas");
  assert.equal(vueFiche(etat, "pj1", null).attaque, "Attaque dé au choix · Taloche, 2/4/8");
  assert.equal(vueFiche(etat, "pj1", null).bouclier, null);
});

test("fiche : le texte de chacun des huit passifs câblés, actif puis inactif avec sa raison", () => {
  const ROLES = ["bonus_force", "bonus_agilite", "bonus_precision", "petit", "seul_sur_sa_case", "en_meute", "esprit_de_corps", "degrossir"];
  const NOMS = ["Costaud", "Vif", "Pointilleux", "Menu", "Solo du chef", "Brigade", "Coude à coude", "Réduction"];
  const cable = (niveau) => (valeurs) => ROLES.forEach((role, rang) => ajouterPassif(valeurs, { role, niveau, nom: NOMS[rang] }));
  const second = pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" }));

  // Un PJ seul sur sa case, niveau 1.
  const seul = combat([
    { photo: pjEssai(cable(1)), case: "D4" },
    { photo: second, case: "E5" },
    { photo: adversaireEssai(cable(2)), case: "J1" },
    { photo: adversaireEssai(), case: "J2" },
  ]);
  assert.deepEqual(vueFiche(seul, "pj1", null).passifs, [
    { texte: "Costaud : +1 en force", actif: true, raison: null },
    { texte: "Vif : +1 en agilité", actif: true, raison: null },
    { texte: "Pointilleux : +1 en précision", actif: true, raison: null },
    { texte: "Menu : +1 en défense, −1 en force", actif: true, raison: null },
    { texte: "Solo du chef : 1 avantage", actif: true, raison: null },
    { texte: "Brigade : 1 avantage en attaque", actif: false, raison: "aucun allié sur sa case" },
    { texte: "Coude à coude : 1 avantage en défense", actif: false, raison: "aucun allié sur sa case" },
    { texte: "Réduction : +1 contre l'armure par réussite", actif: true, raison: null },
  ]);
  // Un adversaire seul, niveau 2 : les bonus ne s'appliquent pas à lui, le pluriel.
  assert.deepEqual(vueFiche(seul, "adv3", null).passifs, [
    { texte: "Costaud : +2 en force", actif: false, raison: "ne s'applique pas à un adversaire" },
    { texte: "Vif : +2 en agilité", actif: false, raison: "ne s'applique pas à un adversaire" },
    { texte: "Pointilleux : +2 en précision", actif: false, raison: "ne s'applique pas à un adversaire" },
    { texte: "Menu : +2 en défense, −1 en force", actif: false, raison: "ne s'applique pas à un adversaire" },
    { texte: "Solo du chef : 2 avantages", actif: true, raison: null },
    { texte: "Brigade : 2 avantages en attaque", actif: false, raison: "aucun allié sur sa case" },
    { texte: "Coude à coude : 2 avantages en défense", actif: false, raison: "aucun allié sur sa case" },
    { texte: "Réduction : +2 contre l'armure par réussite", actif: true, raison: null },
  ]);

  // Un allié arrive sur la case : les trois passifs de case basculent, et eux seuls.
  const accompagnes = combat([
    { photo: pjEssai(cable(1)), case: "D4" },
    { photo: second, case: "D4" },
    { photo: adversaireEssai(cable(2)), case: "J1" },
    { photo: adversaireEssai(), case: "J1" },
  ]);
  const actifs = (etat, id) => vueFiche(etat, id, null).passifs.map((passif) => (passif.actif ? "oui" : passif.raison));
  assert.deepEqual(actifs(accompagnes, "pj1"), ["oui", "oui", "oui", "oui", "un allié sur sa case", "oui", "oui", "oui"]);
  assert.deepEqual(actifs(accompagnes, "adv3"), [
    "ne s'applique pas à un adversaire",
    "ne s'applique pas à un adversaire",
    "ne s'applique pas à un adversaire",
    "ne s'applique pas à un adversaire",
    "un allié sur sa case",
    "oui",
    "oui",
    "oui",
  ]);
  assert.equal(vueFiche(accompagnes, "pj1", null).attaque, "Attaque d8 +2 · Couteau d'office, précise, 5/10/15", "l'arme précise mobilise la Précision et l'Agilité");
  assert.equal(vueFiche(accompagnes, "pj1", null).defense, "Défense d8 +2 · agile", "la défense agile mobilise l'Agilité, et « petit » y ajoute son niveau");
});

// ─── Le panneau : qui joue, le titre, les capacités ─────────────────────────

test("panneau : avant le lancement il ne montre rien ; « Qui joue ? » propose chaque candidat par son nom entier", () => {
  const mep = miseEnPlaceEssai([
    { photo: aubepineEssai(), case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
  ]);
  const avant = vuePanneau(ouvrirCombat(mep), null);
  assert.deepEqual([avant.genre, avant.geste, avant.groupes, avant.annonce], ["preparation", null, [], null]);

  const etat = jouer(ouvrirCombat(mep), LANCER);
  const qui = vuePanneau(etat, null);
  assert.equal(qui.genre, "qui_joue");
  assert.deepEqual(qui.candidats, [{ id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } }]);
  assert.equal(qui.focus, "candidat:pj1");
  assert.equal(qui.geste, null);
  assert.equal(vuePanneau(etat, "adv2").genre, "qui_joue", "un choisi qui ne peut pas jouer ne joue pas");

  const tourAdverse = vuePanneau(jouer(etat, FIN_DE_TOUR), null);
  assert.deepEqual(
    tourAdverse.candidats.map((candidat) => candidat.nom),
    ["Marmiton de corvée n° 1", "Marmiton de corvée n° 2"],
    "le nom entier, numéro compris, jamais le nom court",
  );
});

test("panneau : le titre porte le nom entier d'un nom de deux mots, les actions et le souffle", () => {
  let etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
  ]);
  assert.equal(vuePanneau(etat, "pj1").titre, "Aubépine Crèmebrûlée joue — 2 actions sur 2, souffle 10");
  assert.equal(vuePanneau(etat, "pj1").genre, "action");
  // Émincer : 4 de souffle, payés au premier dé. Solo du chef annule le désavantage de maîtrise : une seule valeur.
  etat = jouer(etat, capacite(etat, "pj1", "Émincer"), regler("cible", "adv2"));
  assert.equal(vuePanneau(etat, null).titre, "Aubépine Crèmebrûlée joue — 2 actions sur 2, souffle 10", "rien n'est payé avant le premier dé");
  etat = jouer(etat, de(10, 1));
  assert.equal(etat.pile.length, 0, "manqué : le geste est fini");
  assert.equal(vuePanneau(etat, "pj1").titre, "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 6", "au singulier");
});

test("panneau : les capacités d'un PJ, groupées par origine, avec puissance, dégâts, coût et désavantage", () => {
  const etat = duel();
  const vue = vuePanneau(etat, "pj1");
  assert.deepEqual(
    vue.groupes.map((groupe) => `${groupe.titre} : ${groupe.boutons.map((bouton) => bouton.libelle).join(", ")}`),
    ["Couteau d'office (précise) : Frappe, Émincer", "Saucier : Flambage [2]", "Grand Four : Fournaise [1]", "Gestes de cuisine : Pas chassé [2], Goûter, Taloche [1], Pas de côté"],
  );
  assert.deepEqual(boutonNomme(vue, "Frappe"), {
    cle: "0:0",
    libelle: "Frappe",
    degats: "5/10/15",
    cout: null,
    desavantage: false,
    choisi: false,
    actif: true,
    raison: null,
    commande: { evenement: { type: "capacite", qui: "pj1", capacite: 0, facon: 0 } },
  });
  assert.deepEqual([boutonNomme(vue, "Émincer").cout, boutonNomme(vue, "Émincer").desavantage], ["4 souffle", true]);
  assert.deepEqual([boutonNomme(vue, "Flambage [2]").degats, boutonNomme(vue, "Flambage [2]").cout], [null, "10 souffle"], "seule une attaque porte des dégâts");
  assert.equal(boutonNomme(vue, "Fournaise [1]").cout, "1 souffle, 1 lien");
  assert.equal(boutonNomme(vue, "Taloche [1]").degats, "2/4/8");
  assert.equal(boutonNomme(vue, "Pas de côté").cout, "X souffle");
  assert.equal(boutonNomme(vue, "Pas chassé [2]").commande.evenement.facon, 1, "la plus haute puissance qu'il peut payer");
  assert.deepEqual(vue.passer, { actif: true, raison: null, commande: { evenement: { type: "passer", qui: "pj1" } } });
  assert.deepEqual(vue.mentions, { passifs: null, interventions: "Pas de côté" });
  assert.equal(etapesDites(vue), "Capacité:en_cours Cible:a_venir Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(vue.focus, null, "aucune commande n'attend : le titre");
  assert.equal(vue.geste, null);
});

test("panneau : la ligne des passifs et des interventions d'Aubépine", () => {
  const etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: chefDePartieEssai(), case: "D4" },
  ]);
  const { mentions } = vuePanneau(etat, "pj1");
  assert.equal(mentions.passifs, "Réduction [1], Maîtrise de l'agile [1], Vif [1], Nez fin, Solo du chef [1]");
  assert.equal(mentions.interventions, "Dressage minute, Pas de côté");
  const libelles = boutonsDe(vuePanneau(etat, "pj1")).map((bouton) => bouton.libelle);
  assert.ok(!libelles.some((libelle) => /Réduction|Vif|Nez fin|Solo du chef|Guetter/.test(libelle)), "ni un passif ni « attendre » n'ont de bouton");
  assert.ok(libelles.includes("Pas de côté") && libelles.includes("Dressage minute"), "les interventions gardent leur bouton à son propre tour");
});

test("panneau : chaque raison d'un bouton inactif, et le moteur refuse ce que le bouton porte", () => {
  const pj = pjEssai((valeurs) => {
    valeurs.souffle = 3;
    valeurs.liens[0].points = 0;
    valeurs.capacites.push(capaciteEssai({ nom: "Tour de broche", inactive: "absente de la banque", facons: [] }));
    valeurs.capacites.push(capaciteEssai({ nom: "Jet de sel", facons: [faconEssai({ cout: null })] }));
  });
  const etat = duel({ pj });
  const vue = vuePanneau(etat, "pj1");
  const attendus = {
    Émincer: "Pas assez de souffle : 4 demandés, 3 restants.",
    "Flambage [1]": "Pas assez de souffle : 5 demandés, 3 restants.",
    "Fournaise [1]": "Pas assez de lien : 1 demandé, 0 restant.",
    "Tour de broche": "absente de la banque",
    "Jet de sel": "coût illisible dans la banque",
  };
  for (const [libelle, raison] of Object.entries(attendus)) {
    const bouton = boutonNomme(vue, libelle);
    assert.deepEqual([bouton.actif, bouton.raison], [false, raison], libelle);
    if (bouton.commande !== null) assert.equal(appliquer(etat, bouton.commande.evenement).refus.message, raison, `${libelle} : la raison du bouton est le message du refus`);
  }
  assert.equal(boutonNomme(vue, "Tour de broche").commande, null, "une capacité absente de la banque n'a ni façon ni commande");
  assert.equal(boutonNomme(vue, "Flambage [1]").commande.evenement.facon, 0, "aucune puissance ne se paie : la plus basse, inactive");
  assert.equal(boutonNomme(vue, "Frappe").actif, true);
  assert.equal(boutonNomme(vue, "Pas chassé [2]").actif, true, "1 de souffle se paie");
});

test("panneau : les capacités d'un adversaire, une ligne par arme puis « Capacités » ; deux armes, deux boutons", () => {
  const etat = jouer(duel(), FIN_DE_TOUR);
  const vue = vuePanneau(etat, "adv2");
  assert.equal(vue.titre, "Marmiton joue — 1 action sur 1, souffle 5");
  assert.deepEqual(
    vue.groupes.map((groupe) => `${groupe.titre} : ${groupe.boutons.map((bouton) => bouton.libelle).join(", ")}`),
    ["Spatule souple : Frappe, Moulinet farineux [1]", "Capacités : Pas chassé [1]"],
  );
  assert.deepEqual([boutonNomme(vue, "Moulinet farineux [1]").cout, boutonNomme(vue, "Moulinet farineux [1]").desavantage], ["5 souffle", true]);
  assert.equal(etapeDite(vue, 2), "Jet de défense:a_venir", "quand un adversaire attaque, le jet est la défense du PJ");

  const homard = adversaireEssai((valeurs) => {
    valeurs.armes.push({ nom: "Pinces de homard", libelle: "Pinces de homard", poids: null, faces: null, caracteristiques: null, degats: [4, 8, 12], portee: 0, locMultiple: 1, mainsNues: false });
    valeurs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Pinces de homard", description: "Une attaque qui inflige 4/8/12.", attaque: true, degats: [4, 8, 12] }));
  });
  const aDeuxArmes = vuePanneau(jouer(duel({ adv: homard }), FIN_DE_TOUR), "adv2");
  assert.deepEqual(
    aDeuxArmes.groupes.map((groupe) => `${groupe.titre} : ${groupe.boutons.map((bouton) => `${bouton.libelle} ${bouton.degats ?? ""}`.trim()).join(", ")}`),
    ["Spatule souple : Frappe 5/10/15, Moulinet farineux [1] 5/10/15", "Pinces de homard : Frappe 4/8/12", "Capacités : Pas chassé [1]"],
  );
  assert.deepEqual(
    aDeuxArmes.groupes.flatMap((groupe) => groupe.boutons).filter((bouton) => bouton.libelle === "Frappe").map((bouton) => [bouton.cle, bouton.commande.evenement.facon]),
    [
      ["0:0", 0],
      ["0:1", 1],
    ],
    "chacun porte sa façon",
  );
});

// ─── Le panneau : les étapes et le geste ────────────────────────────────────

test("panneau : une attaque d'un PJ, étape par étape, jusqu'au détail des dégâts", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"));
  let vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:en_cours Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(boutonNomme(vue, "Frappe").choisi, true);
  assert.equal(boutonNomme(vue, "Émincer").choisi, false);
  assert.equal(vue.geste.description, "Une attaque qui inflige 5/10/15.");
  assert.deepEqual(vue.geste.cibles, [
    { id: "adv2", libelle: "Marmiton", choisie: false, actif: true, raison: null, commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } } },
  ]);
  assert.equal(vue.geste.sansCible, null, "une attaque exige sa cible");
  assert.equal(vue.geste.bilan, "Choisissez une cible.");
  assert.equal(vue.geste.aLancer, null);
  assert.deepEqual(vue.geste.chaine, [], "sans cible, le jet ne s'ouvre pas");
  assert.equal(vue.geste.contexte.titre, "Jet d'attaque · Frappe");
  assert.equal(vue.geste.confirmer, null, "un geste à jet se joue par son dé");
  assert.deepEqual(vue.geste.revenir, { commande: { evenement: { type: "revenir" } } });
  assert.equal(vue.focus, "cible:adv2");

  etat = jouer(etat, regler("cible", "adv2"));
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet d'attaque:en_cours Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(vue.geste.cibles[0].choisie, true);
  assert.deepEqual(vue.geste.contexte, {
    titre: "Jet d'attaque · Frappe contre Marmiton",
    de: "d8",
    detail: "Précision 4 + Agilité 4",
    modificateurs: [],
    difficulte: "5, sa défense",
    avantages: [],
    desavantages: [],
    net: null,
    reglages: {
      modificateur: { valeur: 0, raison: null, min: -20, max: 20, raisonParDefaut: "Frappe", gabarit: { evenement: { type: "regler", champ: "modificateur" } } },
      avantages: { valeur: 0, raison: null, min: -20, max: 20, raisonParDefaut: "Frappe", gabarit: { evenement: { type: "regler", champ: "avantages" } } },
    },
  });
  assert.deepEqual(vue.geste.chaine, [
    { titre: "1er dé", etat: "a_lancer", de: "d8" },
    { titre: "2e dé", etat: "a_venir", de: "d8" },
    { titre: "3e dé", etat: "a_venir", de: "d8" },
  ]);
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "chaine" });
  assert.equal(vue.geste.bilan, "Cliquez sur le d8 pour lancer le 1er dé.");
  assert.deepEqual(vue.geste.lettres, [{ texte: "1 réussite : 5" }, { texte: "2 : 10" }, { texte: "3 : 15" }]);
  assert.equal(vue.focus, "de");

  // Le premier dé paie : plus rien ne se règle, plus aucune capacité ne se choisit.
  etat = jouer(etat, de(8, 6));
  vue = vuePanneau(etat, null);
  assert.equal(vue.titre, "Aubépine joue — 1 action sur 2, souffle 10");
  assert.deepEqual([vue.geste.revenir, vue.geste.contexte.reglages], [null, null]);
  // La rangée « Cible : » reste montrée pendant le jet, comme sur la maquette : la seule cible choisie, enfoncée, inactive avec sa raison.
  const pendantLeJet = [{ id: "adv2", libelle: "Marmiton", choisie: true, actif: false, raison: "Une action est en cours.", commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } } }];
  assert.deepEqual(vue.geste.cibles, pendantLeJet);
  assert.notEqual(appliquer(etat, vue.geste.cibles[0].commande.evenement).refus, undefined, "le moteur refuse d'en changer");
  assert.equal(vue.focus, "de", "la commande qui attend reste le dé");
  assert.deepEqual(vue.geste.chaine, [
    { titre: "1er dé", etat: "reussi", valeur: 6, detail: null },
    { titre: "2e dé", etat: "a_lancer", de: "d8" },
    { titre: "3e dé", etat: "a_venir", de: "d8" },
  ]);
  assert.equal(vue.geste.bilan, "1 réussite pour l'instant. Cliquez sur le d8 pour lancer le 2e dé.");
  assert.deepEqual(vue.geste.lettres[0], { texte: "1 réussite : 5", atteinte: true });
  for (const bouton of boutonsDe(vue)) assert.deepEqual([bouton.actif, bouton.raison], [false, "Une action est en cours."], bouton.libelle);
  assert.equal(boutonNomme(vue, "Frappe").choisi, true);
  assert.deepEqual([vue.passer.actif, vue.passer.raison], [false, "Une action est en cours."]);
  assert.equal(etapeDite(vue, 2), "Jet d'attaque:en_cours");

  // Le deuxième dé échoue, sans avantage : la chaîne est finie, les dégâts se fixent.
  etat = jouer(etat, de(8, 2));
  vue = vuePanneau(etat, null);
  assert.equal(gesteEnCours(etat).moment, "bilan");
  assert.equal(etapeDite(vue, 2), "Jet d'attaque:en_cours", "les dégâts se fixent à la fin de l'étape du jet");
  assert.deepEqual(vue.geste.chaine, [
    { titre: "1er dé", etat: "reussi", valeur: 6, detail: null },
    { titre: "2e dé", etat: "echoue", valeur: 2, detail: null },
  ]);
  assert.equal(vue.geste.bilan, "1 réussite, A = 5.");
  assert.deepEqual(vue.geste.aLancer, { faces: 20, combien: 1, libelle: "d20", motif: "localisation" });
  assert.deepEqual(vue.geste.degats, {
    bases: [{ libelle: "Dégâts du rang (A = 5)", choisie: true, commande: { evenement: { type: "degats", base: "lettre", operations: [], nature: "normaux" } } }],
    saisie: { valeur: 5, raison: null, raisonParDefaut: "Frappe", min: 0, max: 999, gabarit: { evenement: { type: "degats", base: "lettre", nature: "normaux" } } },
    natures: [
      { libelle: "Dégâts normaux", choisie: true, commande: { evenement: { type: "degats", base: "lettre", operations: [], nature: "normaux" } } },
      {
        libelle: "Directs, à la résistance",
        choisie: false,
        commande: { evenement: { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 5, raison: "Frappe" }], nature: "resistance" } },
      },
      { libelle: "Directs, au corps", choisie: false, commande: { evenement: { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 5, raison: "Frappe" }], nature: "corps" } } },
    ],
  });
  assert.equal(vue.geste.localisation, null);
  assert.equal(vue.focus, "de");

  // Les dégâts fixés à la main : le nombre saisi et sa raison reviennent dans la saisie.
  etat = jouer(etat, { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 12, raison: "Coup de feu" }], nature: "normaux" });
  vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.degats.saisie.valeur, vue.geste.degats.saisie.raison], [12, "Coup de feu"]);
  assert.equal(vue.geste.bilan, "1 réussite, A = 5, ajusté à 12 (Coup de feu).");
  assert.deepEqual(vue.geste.degats.natures[2].commande.evenement.operations, [{ op: "ajuster", valeur: 12, raison: "Coup de feu" }], "la nature garde le nombre saisi");
  assert.deepEqual(vue.geste.degats.bases[0].commande.evenement.operations, [], "la commande d'une base retire l'ajustement");

  // Le d20 : jambe gauche du Marmiton (12-13). La victime est un adversaire : pas d'esquive.
  etat = jouer(etat, de(20, 12));
  vue = vuePanneau(etat, null);
  assert.equal(gesteEnCours(etat).moment, "suites");
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet d'attaque:faite Localisation:faite Interventions:faite Dégâts:en_cours");
  assert.deepEqual(vue.geste.localisation, [
    {
      brut: 12,
      face: 12,
      zone: "jambe gauche",
      decaler: { valeur: null, raison: null, min: -10, max: 8, raisonParDefaut: "Frappe", gabarit: { evenement: { type: "decaler", de: 0 } } },
    },
  ]);
  assert.deepEqual([vue.geste.degats, vue.geste.esquive, vue.geste.aLancer], [null, null, null]);
  assert.deepEqual(vue.geste.detail, [{ zone: "Jambe gauche", texte: "armure 10 → 0, résistance 5 → 3" }], "12 dégâts : l'armure, puis 2 à la résistance");
  assert.deepEqual(vue.geste.appliquer, { libelle: "Appliquer", commande: { evenement: { type: "appliquer" } } });
  assert.equal(vue.focus, "appliquer");
  assert.equal(etat.protagonistes.adv2.zones[1].armure, 10, "le détail frappe une copie : rien n'est appliqué");

  // La face décalée de −1 : 11, le torse ; le détail suit, la saisie garde le décalage.
  etat = jouer(etat, { type: "decaler", de: 0, valeur: -1, raison: "Coup d'œil" });
  vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.localisation[0].brut, vue.geste.localisation[0].face, vue.geste.localisation[0].zone], [12, 11, "torse"]);
  assert.deepEqual([vue.geste.localisation[0].decaler.valeur, vue.geste.localisation[0].decaler.raison], [-1, "Coup d'œil"]);
  assert.equal(vue.geste.detail[0].zone, "Torse");
});

test("panneau : un adversaire attaque : le jet de défense du PJ, les rangs à l'envers, l'esquive et ses bornes", () => {
  let etat = jouer(duel(), FIN_DE_TOUR);
  etat = jouer(etat, capacite(etat, "adv2", "Frappe"), regler("cible", "pj1"));
  let vue = vuePanneau(etat, null);
  assert.equal(vue.titre, "Marmiton joue — 1 action sur 1, souffle 5", "le même panneau : c'est l'adversaire qui joue");
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet de défense:en_cours Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(vue.geste.contexte.titre, "Jet de défense · Frappe contre Aubépine");
  assert.deepEqual([vue.geste.contexte.de, vue.geste.contexte.detail, vue.geste.contexte.difficulte], ["d8", "Agilité 4 + Créativité 4", "4, son attaque"]);
  assert.deepEqual(vue.geste.lettres, [{ texte: "aucune réussite : 15" }, { texte: "1 réussite : 10" }, { texte: "2 : 5" }, { texte: "3 : aucun dégât" }]);

  // Une réussite, puis un échec : B = 10.
  etat = jouer(etat, de(8, 5));
  assert.deepEqual(
    vuePanneau(etat, null).geste.lettres.filter((ligne) => ligne.atteinte),
    [],
    "en défense le rang ne se connaît qu'à la fin de la chaîne",
  );
  etat = jouer(etat, de(8, 1));
  vue = vuePanneau(etat, null);
  assert.equal(vue.geste.bilan, "1 réussite, Aubépine reçoit B = 10.");
  assert.deepEqual(vue.geste.lettres[1], { texte: "1 réussite : 10", atteinte: true });

  // Le torse d'Aubépine (2-11) : l'esquive est offerte, de 1 au plus petit du souffle et des dégâts.
  etat = jouer(etat, de(20, 5));
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet de défense:faite Localisation:faite Interventions:en_cours Dégâts:a_venir");
  assert.deepEqual(vue.geste.esquive, { libelle: "Pas de côté", min: 1, max: 10, gabarit: { evenement: { type: "esquive" } } });
  assert.equal("raison" in vue.geste.esquive || "raisonParDefaut" in vue.geste.esquive, false, "l'esquive ne demande pas de raison");
  assert.deepEqual(vue.geste.detail, [{ zone: "Torse", texte: "armure 10 → 0" }]);
  assert.notEqual(vue.geste.localisation[0].decaler, null, "le décalage reste offert");
  assert.deepEqual([vue.geste.localisation[0].decaler.min, vue.geste.localisation[0].decaler.max], [-4, 14], "la face reste de 1 à 19 sur un PJ");
  assert.notEqual(vue.geste.appliquer, null);

  // Après l'esquive : il ne reste qu'« Appliquer », et le détail est celui d'après l'esquive.
  etat = jouer(etat, { type: "esquive", x: 4 });
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet de défense:faite Localisation:faite Interventions:faite Dégâts:en_cours");
  assert.deepEqual([vue.geste.esquive, vue.geste.localisation[0].decaler], [null, null]);
  assert.deepEqual(vue.geste.detail, [{ zone: "Torse", texte: "armure 10 → 4" }]);
  assert.equal(vue.focus, "appliquer");

  // Sans souffle, pas d'esquive : l'étape des dégâts vient tout de suite.
  let aSec = jouer(duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 0 })) }), FIN_DE_TOUR);
  aSec = jouer(aSec, capacite(aSec, "adv2", "Frappe"), regler("cible", "pj1"), de(8, 1), de(20, 5));
  assert.equal(vuePanneau(aSec, null).geste.esquive, null);
  assert.equal(etapeDite(vuePanneau(aSec, null), 5), "Dégâts:en_cours");
});

test("panneau : le jet de caractéristique : son étape est en cours dès l'ouverture, puis les caractéristiques et la difficulté", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Goûter"));
  let vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Jet de caractéristique:en_cours", "il n'a pas d'étape Cible");
  assert.deepEqual(vue.geste.cibles, []);
  assert.deepEqual(vue.geste.caracteristiques.choisies, []);
  assert.equal(vue.geste.caracteristiques.de, null);
  assert.deepEqual(vue.geste.caracteristiques.gabarit, { evenement: { type: "regler", champ: "caracteristiques" } });
  assert.deepEqual(
    vue.geste.caracteristiques.options.map((option) => `${option.code}/${option.nom}/${option.valeur}`),
    [
      "force/Force/4",
      "agilite/Agilité/4",
      "precision/Précision/4",
      "sens/Sens/4",
      "culture_neruvienne/Culture néruvienne/4",
      "savoir_sauvage/Savoir sauvage/4",
      "parole/Parole/4",
      "empathie/Empathie/4",
      "creativite/Créativité/4",
    ],
    "les neuf, dans l'ordre de la liste",
  );
  assert.deepEqual(
    vue.geste.difficultes.map((une) => une.valeur),
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(vue.geste.difficultes[4], { valeur: 6, libelle: "compliqué", choisie: false, commande: { evenement: { type: "regler", champ: "difficulte", valeur: 6 } } });
  assert.equal(vue.geste.bilan, "Choisissez une ou deux caractéristiques.");
  assert.equal(vue.focus, "caracteristique:force");
  assert.equal(vue.geste.lettres, null, "aucun rang de dégâts");

  // Choisies à l'envers : la vue les rend dans l'ordre des neuf, comme le moteur les range.
  etat = jouer(etat, regler("caracteristiques", ["parole", "sens"]));
  vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.caracteristiques.choisies, vue.geste.caracteristiques.de], [["sens", "parole"], "d8"]);
  assert.equal(vue.geste.bilan, "Choisissez une difficulté.");
  assert.equal(vue.focus, "difficulte:2");

  etat = jouer(etat, regler("difficulte", 6));
  vue = vuePanneau(etat, null);
  assert.equal(vue.geste.difficultes[4].choisie, true);
  assert.deepEqual(
    [vue.geste.contexte.titre, vue.geste.contexte.de, vue.geste.contexte.detail, vue.geste.contexte.difficulte],
    ["Jet de caractéristique · Goûter", "d8", "Sens 4 + Parole 4", "6, compliqué"],
  );
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "chaine" });
  assert.equal(vue.focus, "de");
  assert.equal(etapesDites(vue), "Capacité:faite Jet de caractéristique:en_cours");
});

test("panneau : un déplacement : la puissance et ses deux boutons, les cases d'arrivée, « Confirmer » et sa raison", () => {
  let etat = duel({ casePj: "A1", caseAdv: "J10" });
  etat = jouer(etat, capacite(etat, "pj1", "Pas chassé", 1));
  let vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Arrivée:en_cours");
  assert.equal(boutonNomme(vue, "Pas chassé [2]").choisi, true);
  assert.deepEqual(vue.geste.puissance, {
    valeur: 2,
    moins: { actif: true, raison: null, commande: { evenement: { type: "regler", champ: "facon", valeur: 0 } } },
    plus: { actif: false, raison: null, commande: null },
  });
  assert.deepEqual(
    vue.geste.cases.map((une) => une.case),
    ["A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"],
    "à une distance de 1 à 2",
  );
  assert.deepEqual(vue.geste.cases[0], { case: "A2", nom: "Case A2 : s'y déplacer", choisie: false, commande: { evenement: { type: "regler", champ: "arrivee", valeur: "A2" } } });
  // Le double porte le nom même de la case de la carte.
  const surLaCarte = vuePlateau(etat, null).cases;
  for (const une of vue.geste.cases) assert.equal(une.nom, surLaCarte[une.case].choix.nom, une.case);
  assert.deepEqual(vue.geste.confirmer, { libelle: "Confirmer", actif: false, raison: "Choisissez une case d'arrivée.", commande: { evenement: { type: "confirmer" } } });
  assert.equal(appliquer(etat, { type: "confirmer" }).refus.message, "Choisissez une case d'arrivée.");
  assert.deepEqual([vue.geste.contexte, vue.geste.chaine, vue.geste.aLancer, vue.geste.lettres], [null, [], null, null], "aucun dé");
  assert.equal(vue.geste.bilan, "Choisissez une case d'arrivée.");
  assert.equal(vue.focus, "case:A2");

  // La puissance baisse : le bouton, le coût et la description la suivent.
  etat = jouer(etat, regler("facon", 0));
  vue = vuePanneau(etat, null);
  assert.equal(vue.geste.puissance.valeur, 1);
  assert.deepEqual([vue.geste.puissance.moins.actif, vue.geste.puissance.moins.commande], [false, null]);
  assert.deepEqual(vue.geste.puissance.plus, { actif: true, raison: null, commande: { evenement: { type: "regler", champ: "facon", valeur: 1 } } });
  assert.deepEqual([boutonNomme(vue, "Pas chassé [1]").choisi, boutonNomme(vue, "Pas chassé [1]").cout], [true, null]);
  assert.equal(vue.geste.description, "Se déplace de 1 cases.");
  assert.equal(vue.geste.cases.length, 3);

  etat = jouer(etat, regler("arrivee", "B2"));
  vue = vuePanneau(etat, null);
  assert.equal(vue.geste.cases.find((une) => une.case === "B2").choisie, true);
  assert.deepEqual([vue.geste.confirmer.actif, vue.geste.confirmer.raison], [true, null]);
  assert.equal(vue.geste.bilan, null);
  assert.equal(vue.focus, "confirmer");

  // Sans souffle : la puissance 2 garde sa commande, inactive, avec la raison que dira le moteur.
  let aSec = duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 0 })) });
  aSec = jouer(aSec, capacite(aSec, "pj1", "Pas chassé", 0));
  const { plus } = vuePanneau(aSec, null).geste.puissance;
  assert.deepEqual(plus, { actif: false, raison: "Pas assez de souffle : 1 demandé, 0 restant.", commande: { evenement: { type: "regler", champ: "facon", valeur: 1 } } });
  assert.equal(appliquer(aSec, plus.commande.evenement).refus.message, plus.raison);
});

test("panneau : une capacité sans jet : « Sans cible », tout vivant, « Confirmer », et le jet prêté par l'arme tenue", () => {
  let etat = duel({ caseAdv: "H8" });
  etat = jouer(etat, capacite(etat, "pj1", "Flambage", 0));
  let vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:en_cours");
  assert.deepEqual(vue.geste.sansCible, { choisie: true, commande: { evenement: { type: "regler", champ: "cible", valeur: null } } });
  assert.deepEqual(
    vue.geste.cibles.map((cible) => `${cible.libelle}:${cible.actif}`),
    ["Aubépine:true", "Marmiton:true"],
    "un vivant quelconque, allié ou soi compris, sans condition de portée",
  );
  assert.deepEqual(vue.geste.jetPrete, { presse: false, actif: true, raison: null, commande: { evenement: { type: "regler", champ: "jet_prete", valeur: true } }, arme: "Couteau d'office" });
  assert.deepEqual(vue.geste.confirmer, { libelle: "Confirmer", actif: true, raison: null, commande: { evenement: { type: "confirmer" } } });
  assert.deepEqual([vue.geste.contexte, vue.geste.armes], [null, null]);
  assert.equal(vue.geste.puissance.valeur, 1);
  assert.equal(vue.focus, "confirmer");
  assert.deepEqual(vuePlateau(etat, null).jetons.pj1.choix, { commande: { evenement: { type: "regler", champ: "cible", valeur: "pj1" } } }, "sur soi : son propre jeton se choisit");

  // Le jet prêté : une cible adverse, à la portée de l'arme (1) ; H8 est trop loin.
  etat = jouer(etat, regler("jet_prete", true));
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:en_cours Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.deepEqual([vue.geste.jetPrete.presse, vue.geste.jetPrete.commande.evenement.valeur, vue.geste.jetPrete.arme], [true, false, "Couteau d'office"]);
  assert.equal(vue.geste.sansCible, null);
  assert.equal(vue.geste.confirmer, null);
  assert.deepEqual(vue.geste.cibles, [
    {
      id: "adv2",
      libelle: "Marmiton",
      choisie: false,
      actif: false,
      raison: "hors de portée : 4 cases, portée 1",
      commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } },
    },
  ]);
  assert.equal(appliquer(etat, vue.geste.cibles[0].commande.evenement).refus.message, "hors de portée : 4 cases, portée 1");
  assert.equal(vue.geste.contexte.titre, "Jet d'attaque · Flambage [1]");
  assert.deepEqual(vue.geste.lettres, [{ texte: "1 réussite : 5" }, { texte: "2 : 10" }, { texte: "3 : 15" }], "les dégâts de l'arme prêtée");
  assert.equal(vue.focus, null, "aucune cible possible : le titre");
});

test("panneau : le jet prêté d'un adversaire : « sans arme », ou le choix entre ses armes ; les dégâts « Sans dégâts » et « Dégâts de l'arme »", () => {
  const cri = capaciteEssai({ nom: "Coup de sifflet", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de sifflet." })] });
  const sansArme = adversaireEssai((valeurs) => Object.assign(valeurs, { armes: [], capacites: [cri] }));
  let etat = jouer(duel({ adv: sansArme }), FIN_DE_TOUR);
  etat = jouer(etat, capacite(etat, "adv2", "Coup de sifflet"));
  assert.equal(vuePanneau(etat, null).geste.jetPrete.arme, "sans arme");
  etat = jouer(etat, regler("jet_prete", true));
  let vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.jetPrete.arme, vue.geste.armes, vue.geste.lettres], ["sans arme", null, null]);
  // Une réussite en défense : touché ; sans arme, la seule base est « Sans dégâts », et le nombre se saisit.
  etat = jouer(etat, regler("cible", "pj1"), de(8, 5), de(8, 1));
  vue = vuePanneau(etat, null);
  assert.deepEqual(
    vue.geste.degats.bases.map((base) => `${base.libelle}:${base.choisie}`),
    ["Sans dégâts:true"],
  );
  assert.deepEqual(vue.geste.degats.saisie, { valeur: 0, raison: null, raisonParDefaut: "Coup de sifflet", min: 0, max: 999, gabarit: { evenement: { type: "degats", base: "aucun", nature: "normaux" } } });
  assert.equal(vue.geste.bilan, "1 réussite, touché.");

  const aDeuxArmes = adversaireEssai((valeurs) => {
    valeurs.armes.push({ nom: "Pinces de homard", libelle: "Pinces de homard", poids: null, faces: null, caracteristiques: null, degats: [4, 8, 12], portee: 0, locMultiple: 1, mainsNues: false });
    valeurs.capacites.push(cri);
  });
  let double = jouer(duel({ adv: aDeuxArmes }), FIN_DE_TOUR);
  double = jouer(double, capacite(double, "adv2", "Coup de sifflet"));
  assert.equal(vuePanneau(double, null).geste.armes, null, "le choix de l'arme ne vient qu'avec le jet prêté");
  double = jouer(double, regler("jet_prete", true));
  vue = vuePanneau(double, null);
  assert.deepEqual(vue.geste.armes, [
    { libelle: "Spatule souple", choisie: true, commande: { evenement: { type: "regler", champ: "arme_pretee", valeur: 0 } } },
    { libelle: "Pinces de homard", choisie: false, commande: { evenement: { type: "regler", champ: "arme_pretee", valeur: 1 } } },
  ]);
  double = jouer(double, regler("arme_pretee", 1));
  vue = vuePanneau(double, null);
  assert.deepEqual([vue.geste.jetPrete.arme, vue.geste.armes[1].choisie], ["Pinces de homard", true]);
  assert.equal(vue.geste.lettres[0].texte, "aucune réussite : 12", "les dégâts de l'arme prêtée, à l'envers en défense");
  double = jouer(double, regler("cible", "pj1"), de(8, 5), de(8, 1));
  vue = vuePanneau(double, null);
  assert.deepEqual(
    vue.geste.degats.bases.map((base) => `${base.libelle}:${base.choisie}`),
    ["Sans dégâts:true", "Dégâts de l'arme (B = 8):false"],
    "« Sans dégâts » par défaut",
  );
  assert.deepEqual(vue.geste.degats.bases[1].commande, { evenement: { type: "degats", base: "arme", operations: [], nature: "normaux" } });
});

test("panneau : X et ses bornes, sans raison ; le choix de la jauge de lien", () => {
  let etat = duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 7 })) });
  etat = jouer(etat, capacite(etat, "pj1", "Pas de côté"));
  let vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.x, { valeur: 0, min: 0, max: 7, gabarit: { evenement: { type: "regler", champ: "x" } } }, "de 0 à ce qui reste");
  assert.equal(vue.geste.jauges, null);
  etat = jouer(etat, regler("x", 3));
  assert.equal(vuePanneau(etat, null).geste.x.valeur, 3);
  assert.equal(vuePanneau(jouer(etat, { type: "revenir" }), "pj1").geste, null, "« Revenir » : le geste quitte le panneau");

  const pj = pjEssai((valeurs) => {
    valeurs.liens.push({ nom: "Vieux Chaudron", points: 3 });
    valeurs.capacites.push(capaciteEssai({ nom: "Bouquet garni", facons: [faconEssai({ cout: { souffle: 0, lien: 2 }, description: "Parfume la case." })] }));
  });
  let lie = duel({ pj });
  lie = jouer(lie, capacite(lie, "pj1", "Bouquet garni"));
  vue = vuePanneau(lie, null);
  assert.deepEqual(vue.geste.jauges, [
    { nom: "Grand Four", choisie: true, commande: { evenement: { type: "regler", champ: "jauge", valeur: 0 } } },
    { nom: "Vieux Chaudron", choisie: false, commande: { evenement: { type: "regler", champ: "jauge", valeur: 1 } } },
  ]);
  assert.equal(vuePanneau(jouer(lie, regler("jauge", 1)), null).geste.jauges[1].choisie, true);
  lie = jouer(lie, { type: "revenir" });
  lie = jouer(lie, capacite(lie, "pj1", "Fournaise"));
  assert.equal(vuePanneau(lie, null).geste.jauges, null, "la capacité d'un primordial ne paie que sur sa jauge");
});

test("panneau : les réglages à la main entrent au contexte ; sous désavantage le dé se lance deux fois et son détail le dit", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Émincer"), regler("cible", "adv2"), regler("modificateur", 2, "Minutie"));
  let vue = vuePanneau(etat, null);
  // Le dé s'écrit nu : son modificateur le suit, avec sa source, une seule fois (« d8+2 » devant « +2 » se lisait d8+2+2).
  assert.deepEqual([vue.geste.contexte.de, vue.geste.contexte.modificateurs], ["d8", ["+2 (à la main : Minutie)"]]);
  assert.deepEqual([vue.geste.contexte.reglages.modificateur.valeur, vue.geste.contexte.reglages.modificateur.raison], [2, "Minutie"]);
  assert.deepEqual([vue.geste.contexte.avantages, vue.geste.contexte.desavantages, vue.geste.contexte.net], [[], ["Émincer hors maîtrise"], "1 désavantage"]);
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 2, libelle: "d8", motif: "chaine" });
  assert.equal(vue.geste.bilan, "Cliquez sur le d8 pour lancer le 1er dé. Il se lance 2 fois : le pire est gardé.");

  // Un avantage à la main annule le désavantage de maîtrise.
  const annule = vuePanneau(jouer(etat, regler("avantages", 1, "Coup d'œil")), null);
  assert.deepEqual(
    [annule.geste.contexte.avantages, annule.geste.contexte.net, annule.geste.aLancer.combien],
    [["à la main : Coup d'œil"], "avantages et désavantages s'annulent", 1],
  );
  const inverse = vuePanneau(jouer(etat, regler("avantages", -1, "Fumée")), null);
  assert.deepEqual([inverse.geste.contexte.desavantages, inverse.geste.contexte.net], [["Émincer hors maîtrise", "à la main : Fumée"], "2 désavantages"]);

  etat = jouer(etat, de(8, 7, 4));
  vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.chaine[0], { titre: "1er dé", etat: "reussi", valeur: 6, detail: "7/4 → 4 + 2" });
  assert.equal(vue.titre, "Aubépine joue — 1 action sur 2, souffle 6");
});

test("panneau : relancer ou garder, puis le dé de la relance", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"), regler("avantages", 1, "Coup d'œil"), de(8, 6), de(8, 2));
  let vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.choix, [
    { cle: "relancer", libelle: "Relancer le 2e dé", commande: { evenement: { type: "relancer" } } },
    { cle: "garder", libelle: "Garder ce dé", commande: { evenement: { type: "garder" } } },
  ]);
  assert.equal(vue.geste.bilan, "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.");
  assert.deepEqual([vue.geste.aLancer, vue.focus], [null, "choix:relancer"]);
  assert.deepEqual(
    vue.geste.chaine.map((entree) => `${entree.titre}:${entree.etat}`),
    ["1er dé:reussi", "2e dé:echoue", "3e dé:a_venir"],
  );
  assert.equal(vue.geste.contexte.net, "1 avantage");

  const relance = jouer(etat, { type: "relancer" });
  vue = vuePanneau(relance, null);
  assert.deepEqual(vue.geste.choix, []);
  assert.deepEqual(vue.geste.chaine, [
    { titre: "1er dé", etat: "reussi", valeur: 6, detail: null },
    { titre: "2e dé", etat: "relance", valeur: 2, detail: null },
    { titre: "relance", etat: "a_lancer", de: "d8" },
    { titre: "3e dé", etat: "a_venir", de: "d8" },
  ]);
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "relance" });
  assert.equal(vue.geste.bilan, "1 réussite pour l'instant. Avantage dépensé : cliquez sur le d8 pour relancer le 2e dé.");
  assert.equal(vue.focus, "de");

  vue = vuePanneau(jouer(relance, de(8, 7)), null);
  assert.deepEqual(
    vue.geste.chaine.map((entree) => `${entree.titre}:${entree.etat}:${entree.valeur ?? entree.de}`),
    ["1er dé:reussi:6", "2e dé:relance:2", "relance:reussi:7", "3e dé:a_lancer:d8"],
  );
  assert.equal(vue.geste.bilan, "2 réussites pour l'instant. Cliquez sur le d8 pour lancer le 3e dé.");

  // Garder : la chaîne s'arrête, le bilan est celui du journal.
  vue = vuePanneau(jouer(etat, { type: "garder" }), null);
  assert.deepEqual([vue.geste.choix, vue.geste.bilan], [[], "1 réussite, A = 5."]);
  assert.equal(vue.geste.chaine.length, 2, "plus de dé à venir");
});

test("panneau : le dé explosif : « Faire exploser » est le seul choix, puis c'est ce dé qu'on clique", () => {
  // Deux caractéristiques à 4 : un d8, contre 10. Le 8 montre sa face maximale sous la difficulté.
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Goûter"), regler("caracteristiques", ["sens", "parole"]), regler("difficulte", 10), de(8, 8));
  let vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.choix, [{ cle: "exploser", libelle: "Faire exploser", commande: { evenement: { type: "exploser" } } }]);
  assert.deepEqual(vue.geste.chaine[0], { titre: "1er dé", etat: "a_lancer", valeur: 8, detail: null }, "ni réussi ni échoué");
  assert.equal(vue.geste.aLancer, null, "le dé n'agit qu'une fois l'explosion choisie");
  assert.equal(vue.geste.bilan, "Le 1er dé montre sa face maximale sans atteindre la difficulté : il peut exploser.");
  assert.equal(vue.focus, "choix:exploser");

  etat = jouer(etat, { type: "exploser" });
  vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "explosion" });
  assert.equal(vue.geste.chaine.findIndex((entree) => entree.etat === "a_lancer"), 0, "la première entrée à lancer est le dé qui explose");
  assert.equal(vue.geste.bilan, "Cliquez sur le d8 pour faire exploser le 1er dé.");

  // 8 + 3 = 11 : réussi ; le détail montre l'ajout, brut.
  etat = jouer(etat, de(8, 3));
  vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.chaine[0], { titre: "1er dé", etat: "reussi", valeur: 11, detail: "8 + 3" });
});

test("panneau : le point de la maquette, dans la démonstration : la Taloche d'Aubépine, un avantage à dépenser", () => {
  // Le septième geste du combat de référence, arrêté après son deuxième dé : la relance est choisie.
  const { contenu, etat: relanceChoisie } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  assert.deepEqual(contenu.evenements.at(-1), { type: "relancer" });
  const avantLeChoix = jouer(ouvrirCombat(contenu.miseEnPlace), ...contenu.evenements.slice(0, -1));

  const vue = vuePanneau(avantLeChoix, null);
  assert.equal(vue.genre, "action");
  assert.match(vue.titre, /^Aubépine Crèmebrûlée joue — /);
  assert.deepEqual(vue.etapes, [
    { nom: "Capacité", etat: "faite" },
    { nom: "Cible", etat: "faite" },
    { nom: "Jet d'attaque", etat: "en_cours" },
    { nom: "Localisation", etat: "a_venir" },
    { nom: "Interventions", etat: "a_venir" },
    { nom: "Dégâts", etat: "a_venir" },
  ]);
  const taloche = boutonNomme(vue, "Taloche [1]");
  assert.deepEqual([taloche.degats, taloche.cout, taloche.desavantage, taloche.choisi], ["2/4/8", null, false, true]);
  assert.equal(vue.geste.description, "Une taloche qui inflige 2/4/8.");
  assert.deepEqual(vue.geste.contexte, {
    titre: "Jet d'attaque · Taloche [1] contre Marmiton de corvée n° 2",
    de: "d8",
    detail: "Force 4 + Agilité 5",
    modificateurs: ["+1 (Vif)"],
    difficulte: "5, sa défense",
    avantages: ["Solo du chef"],
    desavantages: [],
    net: "1 avantage",
    reglages: null,
  });
  assert.deepEqual(vue.geste.chaine, [
    { titre: "1er dé", etat: "reussi", valeur: 8, detail: "7 + 1" },
    { titre: "2e dé", etat: "echoue", valeur: 4, detail: "3 + 1" },
    { titre: "3e dé", etat: "a_venir", de: "d8" },
  ]);
  assert.equal(vue.geste.aLancer, null);
  assert.equal(vue.geste.bilan, "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.");
  assert.deepEqual(vue.geste.lettres, [{ texte: "1 réussite : 2", atteinte: true }, { texte: "2 : 4" }, { texte: "3 : 8" }, { texte: "Réduction : +1 contre l'armure par réussite" }]);
  assert.deepEqual(vue.geste.choix, [
    { cle: "relancer", libelle: "Relancer le 2e dé", commande: { evenement: { type: "relancer" } } },
    { cle: "garder", libelle: "Garder ce dé", commande: { evenement: { type: "garder" } } },
  ]);
  assert.equal(vue.focus, "choix:relancer");
  assert.deepEqual(vue.annonce, avantLeChoix.annonce);
  assert.match(vue.annonce.texte, /^2e dé : 4, échec\. Relancer ou garder \?$/);

  const apres = vuePanneau(relanceChoisie, null).geste;
  assert.deepEqual(apres.choix, []);
  assert.deepEqual(apres.chaine[1], { titre: "2e dé", etat: "relance", valeur: 4, detail: "3 + 1" });
  assert.deepEqual(apres.chaine[2], { titre: "relance", etat: "a_lancer", de: "d8" });
  assert.deepEqual(apres.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "relance" });
  // Le bilan de la maquette : la tête, puis l'avantage dépensé.
  assert.equal(apres.bilan, "1 réussite pour l'instant. Avantage dépensé : cliquez sur le d8 pour relancer le 2e dé.");
  // Et la rangée « Cible : » y est encore, avec la cible choisie.
  assert.deepEqual(apres.cibles.map((cible) => [cible.libelle, cible.choisie, cible.actif]), [["Marmiton de corvée n° 2", true, false]]);
});

test("panneau : l'annonce est celle de l'état, dans chaque genre ; le combat terminé dit sa victoire", () => {
  const mep = miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]);
  assert.equal(vuePanneau(ouvrirCombat(mep), null).annonce, null);
  const lance = jouer(ouvrirCombat(mep), LANCER);
  assert.deepEqual(vuePanneau(lance, null).annonce, { pas: 1, texte: "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. — Tour 1 · camp des PJ —" });
  assert.equal(vuePanneau(lance, null).annonce, lance.annonce, "l'objet même : rien ne se redit tant que le pas ne change pas");
  assert.equal(vuePanneau(lance, "pj1").annonce, lance.annonce);

  const { etat: fini } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  const vue = vuePanneau(fini, null);
  assert.deepEqual([vue.genre, vue.vainqueur, vue.geste, vue.candidats, vue.groupes], ["termine", "Combat terminé : victoire des PJ.", null, [], []]);
  assert.equal(vue.annonce, fini.annonce);
});

test("vues : rien d'instable : deux lectures du même état donnent le même texte, et l'état n'est pas touché", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  const etat = jouer(ouvrirCombat(contenu.miseEnPlace), ...contenu.evenements);
  const avant = JSON.stringify(etat);
  const lire = () => JSON.stringify([vueBarre(etat), vuePlateau(etat, null), etat.ordre.map((id) => vueFiche(etat, id, null)), vuePanneau(etat, null)]);
  assert.equal(lire(), lire());
  assert.equal(JSON.stringify(etat), avant);
  assert.ok(Object.isFrozen(etat), "l'état est gelé : une vue qui l'écrirait lèverait");
});

// ─── La préparation ─────────────────────────────────────────────────────────

const APPORTS_VIDES = { personnages: [], phrases: [], adversaires: [], rencontre: [], absents: null };

/** Une mise en place faite par la préparation elle-même, avec tant de PJ et tant d'exemplaires de chaque adversaire. */
function mettreEnPlace({ pj = 0, adversaires = {} }) {
  let mep = miseEnPlaceVide("demo");
  for (let rang = 0; rang < pj; rang += 1) {
    const photo = pjEssai((valeurs) => Object.assign(valeurs, { identifiant: `essai-cuisinier-${String(rang).padStart(10, "0")}`, nom: `Cuisinier ${rang + 1}` }));
    mep = ajouterPersonnage(mep, photo).miseEnPlace;
  }
  for (const [nom, nombre] of Object.entries(adversaires)) {
    const photo = adversaireEssai((valeurs) => Object.assign(valeurs, { nom }));
    mep = ajouterAdversaires(mep, Array.from({ length: nombre }, () => photo)).miseEnPlace;
  }
  return mep;
}

test("préparation : vide, elle attend ses personnages, dit la banque sans adversaire, et refuse de lancer", () => {
  const mep = miseEnPlaceVide("demo");
  const vue = vuePreparation(mep, { ...APPORTS_VIDES, personnages: null, phrases: ["Les personnages en ligne ne se lisent pas pour l'instant."] });
  assert.deepEqual(vue, {
    personnages: { attente: true, phrases: ["Les personnages en ligne ne se lisent pas pour l'instant."], options: [] },
    adversaires: { options: [], vide: "Cette banque n'a aucun adversaire." },
    rencontre: { actif: false, raison: "Composez d'abord une rencontre" },
    quiCommence: [
      { camp: "pj", libelle: "Les PJ", choisi: true, commande: { preparer: { type: "qui_commence", camp: "pj" } } },
      { camp: "adv", libelle: "Les adversaires", choisi: false, commande: { preparer: { type: "qui_commence", camp: "adv" } } },
    ],
    lancer: { actif: false, raison: "Il faut au moins un personnage et un adversaire." },
    absents: null,
    avertissements: [],
  });
  assert.equal(vuePreparation(mep, APPORTS_VIDES).personnages.attente, false, "une liste vide n'est pas une attente");
  assert.equal(readFileSync(new URL("../js/ecrans/rencontre.js", import.meta.url), "utf8").includes(`"${vue.adversaires.vide}"`), true, "la phrase de l'écran Rencontre");
});

test("préparation : un personnage s'ajoute, ou dit pourquoi non : son refus, déjà présent, le plafond", () => {
  const apports = {
    ...APPORTS_VIDES,
    personnages: [
      { cle: "essai-cuisinier-0000000000", nom: "Cuisinier 1", source: "appareil", refus: null },
      { cle: "essai-ciboulette-0000000002", nom: "Ciboulette", source: "en_ligne", refus: null },
      { cle: "essai-persil-0000000003", nom: "Persil", source: "appareil", refus: "Ses caractéristiques ne sont pas complètes." },
    ],
  };
  const vue = vuePreparation(mettreEnPlace({ pj: 1 }), apports);
  assert.deepEqual(vue.personnages.options, [
    { cle: "essai-cuisinier-0000000000", nom: "Cuisinier 1", actif: false, raison: "Ce personnage est déjà dans le combat." },
    { cle: "essai-ciboulette-0000000002", nom: "Ciboulette", actif: true, raison: null },
    { cle: "essai-persil-0000000003", nom: "Persil", actif: false, raison: "Ses caractéristiques ne sont pas complètes." },
  ]);
  assert.deepEqual(vue.lancer, { actif: false, raison: "Il faut au moins un personnage et un adversaire." });

  const onze = vuePreparation(mettreEnPlace({ pj: 11 }), apports);
  assert.equal(onze.personnages.options[1].actif, true, "le douzième s'ajoute");
  const douze = vuePreparation(mettreEnPlace({ pj: 12 }), apports);
  assert.deepEqual(
    douze.personnages.options.map((option) => option.raison),
    ["Ce personnage est déjà dans le combat.", "12 personnages au plus dans un combat.", "Ses caractéristiques ne sont pas complètes."],
    "déjà présent se dit avant le plafond ; le refus de la photographie avant tout",
  );
});

test("préparation : un adversaire et ses exemplaires encore possibles, les deux plafonds, « Qui commence », « Lancer »", () => {
  const apports = {
    ...APPORTS_VIDES,
    adversaires: [
      { nom: "Marmiton", refus: null },
      { nom: "Plongeur", refus: null },
      { nom: "Mouette", refus: "Ne s'ajoute pas : incomplet, 2 erreurs." },
    ],
  };
  const vue = vuePreparation(mettreEnPlace({ pj: 1, adversaires: { Marmiton: 10 } }), apports);
  assert.deepEqual(vue.adversaires, {
    options: [
      { nom: "Marmiton", actif: true, raison: null, max: 2 },
      { nom: "Plongeur", actif: true, raison: null, max: 12 },
      { nom: "Mouette", actif: false, raison: "Ne s'ajoute pas : incomplet, 2 erreurs.", max: 12 },
    ],
    vide: null,
  });
  assert.deepEqual(vue.lancer, { actif: true, raison: null });

  const douze = vuePreparation(mettreEnPlace({ adversaires: { Marmiton: 12 } }), apports);
  assert.deepEqual(douze.adversaires.options[0], { nom: "Marmiton", actif: false, raison: "12 exemplaires au plus d'un même adversaire.", max: 0 });
  assert.equal(douze.adversaires.options[1].actif, true);

  const pleins = { Marmiton: 12, Plongeur: 12, Saucier: 12, Rôtisseur: 12, Commis: 10 };
  const presque = vuePreparation(mettreEnPlace({ adversaires: pleins }), apports);
  assert.deepEqual(presque.adversaires.options[1], { nom: "Plongeur", actif: false, raison: "12 exemplaires au plus d'un même adversaire.", max: 0 });
  const libre = vuePreparation(mettreEnPlace({ adversaires: pleins }), { ...apports, adversaires: [{ nom: "Commis", refus: null }] });
  assert.deepEqual(libre.adversaires.options[0], { nom: "Commis", actif: true, raison: null, max: 2 }, "58 posés : il en reste 2, le plafond des soixante borne avant celui des douze");
  const plein = vuePreparation(mettreEnPlace({ adversaires: { ...pleins, Commis: 12 } }), { ...apports, adversaires: [{ nom: "Mitron", refus: null }] });
  assert.deepEqual(plein.adversaires.options[0], { nom: "Mitron", actif: false, raison: "60 adversaires au plus dans un combat.", max: 0 });

  let mep = mettreEnPlace({ pj: 1, adversaires: { Marmiton: 1 } });
  mep = { ...mep, quiCommence: "adv" };
  assert.deepEqual(
    vuePreparation(mep, apports).quiCommence.map((camp) => camp.choisi),
    [false, true],
  );
});

test("préparation : la rencontre préparée se place, sauf vide ou au-delà d'un plafond ; un adversaire qui ne s'ajoute pas ne compte pas", () => {
  const adversaires = [
    { nom: "Marmiton", refus: null },
    { nom: "Plongeur", refus: null },
    { nom: "Mouette", refus: "Ne s'ajoute pas : incomplet, 2 erreurs." },
  ];
  const avec = (mep, rencontre) => vuePreparation(mep, { ...APPORTS_VIDES, adversaires, rencontre }).rencontre;
  const vide = mettreEnPlace({});
  // Le texte de la mission (§ 10.7), tel quel : sans point final.
  assert.deepEqual(avec(vide, []), { actif: false, raison: "Composez d'abord une rencontre" });
  assert.deepEqual(avec(vide, [{ nom: "Marmiton", nombre: 3 }, { nom: "Plongeur", nombre: 1 }]), { actif: true, raison: null });
  assert.deepEqual(avec(vide, [{ nom: "Marmiton", nombre: 12 }]), { actif: true, raison: null });
  assert.deepEqual(avec(mettreEnPlace({ adversaires: { Marmiton: 10 } }), [{ nom: "Marmiton", nombre: 2 }]), { actif: true, raison: null }, "à la suite : dix et deux font douze");
  assert.deepEqual(avec(mettreEnPlace({ adversaires: { Marmiton: 10 } }), [{ nom: "Marmiton", nombre: 3 }]), { actif: false, raison: "12 exemplaires au plus d'un même adversaire." });
  const pleins = { Marmiton: 12, Saucier: 12, Rôtisseur: 12, Commis: 12, Mitron: 10 };
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Plongeur", nombre: 2 }]), { actif: true, raison: null });
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Plongeur", nombre: 3 }]), { actif: false, raison: "60 adversaires au plus dans un combat." });
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Mouette", nombre: 9 }, { nom: "Plongeur", nombre: 2 }]), { actif: true, raison: null }, "la Mouette est laissée : elle ne pèse pas sur le plafond");
});

test("préparation : la ligne des câblés absents et les avertissements des photographies posées, sans doublon ni champ instable", () => {
  const mep = mettreEnPlace({ pj: 1, adversaires: { Marmiton: 2 } });
  const averti = {
    ...mep,
    protagonistes: mep.protagonistes.map((protagoniste) => ({
      ...protagoniste,
      photo: { ...protagoniste.photo, avertissements: protagoniste.camp === "pj" ? ["« Frappe » : sa portée, « loin », ne se lit pas ; elle vaut 0."] : ["« Moulinet farineux » : ses dégâts, « beaucoup », ne se calculent pas ; elle n'en a pas."] },
    })),
  };
  const apports = { ...APPORTS_VIDES, absents: "Câblés absents de la banque : bonus de Force, en meute." };
  const vue = vuePreparation(averti, apports);
  assert.equal(vue.absents, "Câblés absents de la banque : bonus de Force, en meute.");
  assert.deepEqual(vue.avertissements, [
    "Cuisinier 1 — « Frappe » : sa portée, « loin », ne se lit pas ; elle vaut 0.",
    "Marmiton — « Moulinet farineux » : ses dégâts, « beaucoup », ne se calculent pas ; elle n'en a pas.",
  ]);
  assert.deepEqual(vuePreparation(mep, apports).avertissements, []);
  assert.equal(JSON.stringify(vuePreparation(averti, apports)), JSON.stringify(vue), "deux lectures, le même texte : aucun bloc ne se referait pour rien");
});

// ─── La concordance des vues et du moteur ───────────────────────────────────

// Toutes les commandes que porte une vue, avec ce que dit leur porteur :
// { commande, actif } pour un bouton, { gabarit, saisie } pour une saisie.
function relever(valeur, trouves = { commandes: [], gabarits: [] }) {
  if (valeur === null || typeof valeur !== "object") return trouves;
  if (!Array.isArray(valeur)) {
    if (valeur.commande) trouves.commandes.push({ commande: valeur.commande, actif: valeur.actif !== false, inactif: valeur.inactif === true });
    if (valeur.gabarit) trouves.gabarits.push(valeur);
  }
  for (const enfant of Object.values(valeur)) relever(enfant, trouves);
  return trouves;
}

// Un gabarit complété comme le fait le panneau (js/ecrans/combat_action.js).
function completer(saisie, valeur) {
  const { evenement } = saisie.gabarit;
  if (evenement.type === "degats") return { ...evenement, operations: [{ op: "ajuster", valeur, raison: saisie.raison ?? saisie.raisonParDefaut }] };
  if (evenement.type === "esquive") return { ...evenement, x: valeur };
  if (Array.isArray(valeur) || valeur === 0 || !("raisonParDefaut" in saisie)) return { ...evenement, valeur };
  return { ...evenement, valeur, raison: saisie.raison ?? saisie.raisonParDefaut };
}

// Les valeurs avec lesquelles éprouver une saisie : ses deux bornes, et 0 s'il y est.
function valeursDEpreuve(saisie) {
  if (saisie.options) return [[saisie.options[0].code], [saisie.options[1].code, saisie.options[0].code]];
  const bornes = [saisie.min, saisie.max];
  if (saisie.min < 0 && saisie.max > 0) bornes.push(0);
  return [...new Set(bornes)];
}

const memeEvenement = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Dit si les vues portent l'événement que le combat joue ensuite.
function porte({ panneau, barre, plateau }, evenement) {
  if (evenement.type === "de") {
    const attendu = panneau.geste?.aLancer ?? null;
    return attendu !== null && attendu.faces === evenement.faces && attendu.combien === evenement.valeurs.length;
  }
  const { commandes, gabarits } = relever([panneau, barre, plateau]);
  if (commandes.some(({ commande, actif }) => actif && commande.evenement && memeEvenement(commande.evenement, evenement))) return true;
  return gabarits.some((saisie) => {
    const gabarit = saisie.gabarit.evenement;
    if (!gabarit || gabarit.type !== evenement.type) return false;
    if (evenement.type === "degats") {
      const [operation] = evenement.operations;
      return gabarit.base === evenement.base && gabarit.nature === evenement.nature && operation.valeur >= saisie.min && operation.valeur <= saisie.max;
    }
    if (evenement.type === "esquive") return evenement.x >= saisie.min && evenement.x <= saisie.max;
    if (evenement.type === "decaler") return gabarit.de === evenement.de && evenement.valeur >= saisie.min && evenement.valeur <= saisie.max;
    if (gabarit.champ !== evenement.champ) return false;
    if (saisie.options) return evenement.valeur.every((code) => saisie.options.some((option) => option.code === code));
    return evenement.valeur >= saisie.min && evenement.valeur <= saisie.max;
  });
}

/**
 * Éprouve un état : tout événement que porte une vue active est accepté par
 * le moteur ; tout événement que porte un bouton inactif est refusé, et
 * l'état rendu est l'objet reçu ; toute commande « choisir » désigne un
 * candidat. Rend le compte de ce qui a été éprouvé.
 */
function eprouver(etat, choisi, ou) {
  const vues = { barre: vueBarre(etat), plateau: vuePlateau(etat, choisi), fiches: etat.ordre.map((id) => vueFiche(etat, id, choisi)), panneau: vuePanneau(etat, choisi) };
  const { commandes, gabarits } = relever(vues);
  const compte = { acceptes: 0, refuses: 0, choisis: 0, saisies: 0 };

  for (const { commande, actif, inactif } of commandes) {
    if (commande.choisir !== undefined) {
      assert.ok(candidats(etat).includes(commande.choisir), `${ou} : « choisir ${commande.choisir} » ne désigne pas un candidat`);
      compte.choisis += 1;
      continue;
    }
    if (commande.preparer !== undefined) continue;
    const rendu = appliquer(etat, commande.evenement);
    if (actif && !inactif) {
      assert.equal(rendu.refus, undefined, `${ou} : une vue porte ${JSON.stringify(commande.evenement)}, que le moteur refuse : ${rendu.refus?.message}`);
      compte.acceptes += 1;
    } else {
      assert.notEqual(rendu.refus, undefined, `${ou} : un bouton inactif porte ${JSON.stringify(commande.evenement)}, que le moteur accepte`);
      assert.equal(rendu.etat, etat, `${ou} : un refus rend l'état reçu`);
      compte.refuses += 1;
    }
  }
  for (const saisie of gabarits) {
    if (!saisie.gabarit.evenement) continue;
    for (const valeur of valeursDEpreuve(saisie)) {
      const evenement = completer(saisie, valeur);
      const rendu = appliquer(etat, evenement);
      assert.equal(rendu.refus, undefined, `${ou} : une saisie porte ${JSON.stringify(evenement)}, que le moteur refuse : ${rendu.refus?.message}`);
      compte.saisies += 1;
    }
  }
  return { vues, compte };
}

test("concordance : à chaque moment du combat de référence, le moteur accepte tout ce que portent les vues, refuse ce que porte un bouton inactif, et joue ce qu'elles portaient", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  let etat = ouvrirCombat(contenu.miseEnPlace);
  const total = { acceptes: 0, refuses: 0, choisis: 0, saisies: 0, moments: 0 };
  const typesJoues = new Set();

  contenu.evenements.forEach((evenement, rang) => {
    const ou = `avant l'événement n° ${rang + 1} (${evenement.type})`;
    // Hors d'un geste, l'écran a choisi celui qui va jouer ; on éprouve aussi « Qui joue ? » et chaque autre candidat.
    const quiJoue = evenement.qui ?? null;
    for (const choisi of new Set([quiJoue, null, ...candidats(etat)])) {
      const { vues, compte } = eprouver(etat, choisi, `${ou}, choisi ${choisi}`);
      for (const cle of Object.keys(compte)) total[cle] += compte[cle];
      if (choisi === quiJoue && evenement.type !== "lancer") {
        assert.ok(porte(vues, evenement), `${ou} : aucune vue ne porte ${JSON.stringify(evenement)}`);
        typesJoues.add(evenement.type);
      }
    }
    total.moments += 1;
    etat = jouer(etat, evenement);
  });
  eprouver(etat, null, "à la fin du combat");

  assert.equal(etat.phase, "termine");
  assert.equal(total.moments, contenu.evenements.length);
  // Le contrôle ne passe pas à vide : chaque sorte de commande a été éprouvée, souvent.
  assert.ok(total.acceptes > 1000, `${total.acceptes} événements acceptés`);
  assert.ok(total.refuses > 100, `${total.refuses} événements refusés`);
  assert.ok(total.choisis > 50, `${total.choisis} choix de qui joue`);
  assert.ok(total.saisies > 100, `${total.saisies} saisies complétées`);
  assert.deepEqual(
    [...typesJoues].sort(),
    ["appliquer", "capacite", "confirmer", "de", "degats", "esquive", "fin_de_tour", "garder", "passer", "regler", "relancer", "exploser"].sort(),
    "tous les types du combat de référence ont été retrouvés dans une vue",
  );
});

test("concordance : là où le combat de référence ne passe pas (X, jauge, décalage, arme prêtée, puissance, explosion)", () => {
  const eprouverLaSuite = (depart, evenements, ou) => {
    let etat = depart;
    let compte = 0;
    evenements.forEach((evenement, rang) => {
      const lu = eprouver(etat, evenement.qui ?? null, `${ou}, avant l'événement n° ${rang + 1}`);
      assert.ok(porte(lu.vues, evenement), `${ou} : aucune vue ne porte ${JSON.stringify(evenement)}`);
      compte += lu.compte.acceptes + lu.compte.refuses + lu.compte.saisies;
      etat = jouer(etat, evenement);
    });
    eprouver(etat, null, `${ou}, à la fin`);
    return compte;
  };

  const pj = pjEssai((valeurs) => {
    valeurs.souffle = 6;
    valeurs.liens.push({ nom: "Vieux Chaudron", points: 3 });
    valeurs.capacites.push(capaciteEssai({ nom: "Bouquet garni", facons: [faconEssai({ cout: { souffle: "X", lien: 1 }, description: "Parfume la case." })] }));
  });
  const adv = adversaireEssai((valeurs) => {
    valeurs.armes.push({ nom: "Pinces de homard", libelle: "Pinces de homard", poids: null, faces: null, caracteristiques: null, degats: [4, 8, 12], portee: 0, locMultiple: 2, mainsNues: false });
    valeurs.capacites.push(capaciteEssai({ nom: "Coup de sifflet", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de sifflet." })] }));
  });
  const depart = duel({ pj, adv });
  const c = (qui, nom, facon = 0) => capacite(depart, qui, nom, facon);

  let compte = eprouverLaSuite(
    depart,
    [
      // X et la jauge, puis « Revenir ».
      c("pj1", "Bouquet garni"),
      regler("jauge", 1),
      regler("x", 2),
      regler("cible", "adv2"),
      { type: "revenir" },
      // La puissance, puis un déplacement confirmé.
      c("pj1", "Pas chassé", 1),
      regler("facon", 0),
      regler("arrivee", "D5"),
      regler("arrivee", "E5"),
      { type: "revenir" },
      // Un jet de caractéristique qui explose, avec un modificateur à la main.
      c("pj1", "Goûter"),
      regler("caracteristiques", ["force"]),
      regler("difficulte", 10),
      regler("modificateur", -1, "Fumée"),
      de(8, 8),
      { type: "exploser" },
      de(8, 1),
      // Des dégâts directs, un décalage.
      c("pj1", "Frappe"),
      regler("cible", "adv2"),
      regler("avantages", 2, "Coup d'œil"),
      de(8, 1),
      { type: "relancer" },
      de(8, 7),
      de(8, 1),
      { type: "garder" },
      // La nature d'abord (elle porte les dégâts du moment et la raison par défaut), puis le nombre saisi.
      { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 5, raison: "Frappe" }], nature: "resistance" },
      { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 3, raison: "Frappe" }], nature: "resistance" },
      de(20, 20),
      { type: "decaler", de: 0, valeur: -3, raison: "Frappe" },
      { type: "appliquer" },
      // Le tour adverse : un jet prêté par la seconde arme, deux d20, l'esquive.
      c("adv2", "Coup de sifflet"),
      regler("jet_prete", true),
      regler("arme_pretee", 1),
      regler("cible", "pj1"),
      de(8, 1),
      { type: "degats", base: "arme", operations: [], nature: "normaux" },
      de(20, 3),
      de(20, 12),
      { type: "esquive", x: 4 },
      { type: "appliquer" },
    ],
    "le duel d'essai",
  );
  assert.ok(compte > 500, `${compte} événements éprouvés`);

  // Un adversaire qui porte un coût en lien, un autre sans arme, une capacité absente de la banque.
  const lie = adversaireEssai((valeurs) => {
    valeurs.capacites[0].facons[0].cout = { souffle: 0, lien: 2 };
    valeurs.capacites.push(capaciteEssai({ nom: "Tour de broche", groupe: { genre: "capacites", titre: "Capacités" }, inactive: "absente de la banque", facons: [] }));
  });
  const tourAdverse = jouer(duel({ adv: lie }), FIN_DE_TOUR);
  compte = eprouverLaSuite(tourAdverse, [capacite(tourAdverse, "adv2", "Frappe"), regler("cible", "pj1"), de(8, 8), de(8, 8), de(8, 8)], "l'adversaire au coût en lien");
  assert.ok(compte > 20, `${compte} événements éprouvés`);
});

// ─── Le journal ─────────────────────────────────────────────────────────────

test("journal : une ligne où quelqu'un meurt donne à part la phrase de la mort, et elle seule ; les autres rendent leur texte entier", () => {
  const { etat } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  assert.equal(etat.phase, "termine");
  const mortes = etat.journal.filter((ligne) => ligne.mort === true);
  assert.equal(mortes.length, 3, "le combat de référence a trois morts");
  for (const ligne of etat.journal) {
    const vue = vueLigne(etat, ligne);
    // La ligne ne perd ni ne gagne un signe : les deux morceaux la redonnent.
    assert.equal(`${vue.texte}${vue.mort ?? ""}`, ligne.texte);
    assert.equal(vue.genre, ligne.genre);
    if (ligne.mort !== true) assert.equal(vue.mort, null, ligne.texte);
  }
  assert.deepEqual(
    mortes.map((ligne) => vueLigne(etat, ligne).mort),
    ["Marmiton n° 1 meurt.", "Marmiton n° 2 meurt.", "Chef meurt."],
  );
  // Ce qui précède finit par l'espace qui séparait les phrases, et ne redit pas la mort.
  for (const ligne of mortes) {
    const vue = vueLigne(etat, ligne);
    assert.match(vue.texte, /\. $/);
    assert.doesNotMatch(vue.texte, /meurt/);
  }
  // La forme d'une ligne dans l'état ne change pas : un genre, un texte, et « mort » pour celles-là seulement.
  for (const ligne of etat.journal) assert.deepEqual(Object.keys(ligne).sort(), ligne.mort === true ? ["genre", "mort", "texte"] : ["genre", "texte"]);

  // Le plus long des noms qui finissent la ligne : un mort nommé comme la fin d'un autre ne lui prend pas sa phrase.
  const homonymes = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: adversaireEssai((valeurs) => Object.assign(valeurs, { nom: "Sous-Marmiton" })), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
  ]);
  const court = (id) => homonymes.noms[id].court;
  const tous = { ...homonymes, protagonistes: { ...homonymes.protagonistes, adv2: { ...homonymes.protagonistes.adv2, mort: { tour: 1 } }, adv3: { ...homonymes.protagonistes.adv3, mort: { tour: 1 } } } };
  assert.ok(`${court("adv2")} meurt.`.endsWith(`${court("adv3")} meurt.`), `${court("adv2")} finit comme ${court("adv3")}`);
  assert.deepEqual(vueLigne(tous, { genre: "geste", texte: `Corps 2 → 0. ${court("adv2")} meurt.`, mort: true }), { genre: "geste", texte: "Corps 2 → 0. ", mort: `${court("adv2")} meurt.` });
  // Un vivant ne prête pas son nom : seul un mort du combat finit une ligne.
  assert.deepEqual(vueLigne(homonymes, { genre: "geste", texte: `Corps 2 → 0. ${court("adv2")} meurt.`, mort: true }), { genre: "geste", texte: "", mort: `Corps 2 → 0. ${court("adv2")} meurt.` }, "introuvable : la ligne entière");
  // Sans la marque de l'état, rien n'est mis en évidence, même si le texte finit ainsi.
  assert.deepEqual(vueLigne(tous, { genre: "geste", texte: `${court("adv2")} meurt.` }), { genre: "geste", texte: `${court("adv2")} meurt.`, mort: null });
});

// ─── Le module ──────────────────────────────────────────────────────────────

test("module : il n'importe jamais le moteur, seulement ce que le contrat lui permet, et rien de l'appareil ni de la page", () => {
  const source = readFileSync(new URL("../js/combat/lecture.js", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import [^;]+ from "([^"]+)";$/gm)].map((trouve) => trouve[1]).sort();
  const permis = [
    "../personnage/regles.js",
    "./circonstances.js",
    "./degats.js",
    "./jet.js",
    "./journal.js",
    "./noms.js",
    "./offre.js",
    "./preparation.js",
    "./regles.js",
    "./valeurs.js",
  ];
  assert.ok(imports.length > 0);
  for (const chemin of imports) assert.ok(permis.includes(chemin), `import non permis : ${chemin}`);
  assert.equal(source.includes("moteur.js\""), false, "jamais le moteur : les vues sortent de l'offre");
  assert.equal(/\bimport\(/.test(source), false, "aucun import à la volée");
  for (const interdit of ["localeCompare", "toLocale", "Intl", "new Date", "Date.now", "Math.random", "document", "indexedDB", "innerHTML", "outerHTML", ".style"]) {
    assert.equal(source.includes(interdit), false, `le texte du module contient « ${interdit} »`);
  }
  for (const code of [0x00a0, 0x202f]) assert.equal(source.includes(String.fromCodePoint(code)), false, "aucune espace insécable");
});

// ─── Ce que la mise à l'épreuve a montré sans contrôle ──────────────────────

const CIBOULETTE_ESSAI = () => pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" }));

test("fiche : « a joué » ne se dit que dans le camp dont c'est le tour, même de qui n'a aucune action", () => {
  // Un adversaire sans action : il n'a rien à jouer, mais ce n'est pas son tour.
  const etat = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: CIBOULETTE_ESSAI(), case: "D4" },
    { photo: adversaireEssai((valeurs) => void (valeurs.actions = 0)), case: "D4" },
  ]);
  assert.equal(etat.tour.camp, "pj");
  const fiche = vueFiche(etat, "adv3", null);
  assert.deepEqual(fiche.actions, { reste: 0, max: 0 });
  assert.equal(fiche.statut, null, "le tour est aux PJ : l'adversaire n'« a » pas « joué »");
  assert.deepEqual(fiche.marques, []);
  assert.doesNotMatch(vuePlateau(etat, null).jetons.adv3.nom, /a joué/);
  // Dans l'autre sens : le PJ qui passe, au tour des PJ, « a joué ».
  const passe = jouer(etat, { type: "passer", qui: "pj1" });
  assert.equal(passe.tour.camp, "pj");
  assert.equal(vueFiche(passe, "pj1", null).statut, "a joué");
  assert.equal(vueFiche(passe, "adv3", null).statut, null);
});

test("plateau : dès qu'une action est en cours, aucun jeton ne propose de jouer, pas même celui d'un candidat", () => {
  const trio = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: CIBOULETTE_ESSAI(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
  ]);
  assert.deepEqual(vuePlateau(trio, null).jetons.pj2.choix, { commande: { choisir: "pj2" } }, "au repos, le candidat se choisit par son jeton");

  // Le dé est tombé : le choix de la cible est fermé, l'action n'est pas finie.
  const paye = jouer(trio, capacite(trio, "pj1", "Frappe"), regler("cible", "adv3"), de(8, 6));
  assert.ok(candidats(paye).includes("pj2"), "Ciboulette peut encore agir à ce tour");
  const vue = vuePlateau(paye, null);
  assert.deepEqual([vue.jetons.pj1.choix, vue.jetons.pj2.choix, vue.jetons.adv3.choix], [null, null, null]);
  assert.deepEqual([vue.jetons.pj1.inactif, vue.jetons.pj2.inactif, vue.jetons.adv3.inactif], [false, false, false], "hors d'un choix, rien n'est écarté");

  // Un geste qui se règle sans cible ni arrivée : rien n'est « au repos » non plus.
  const gouter = jouer(trio, capacite(trio, "pj1", "Goûter"));
  assert.equal(vuePlateau(gouter, null).jetons.pj2.choix, null);
});

test("panneau : seule une attaque porte des dégâts sur son bouton, même si la banque en écrit à une autre capacité", () => {
  const pj = pjEssai((valeurs) => {
    valeurs.capacites.push(capaciteEssai({ nom: "Coup de louche", facons: [faconEssai({ description: "Ajoute 8/11/13 à la prochaine attaque.", degats: [8, 11, 13] })] }));
  });
  const vue = vuePanneau(duel({ pj }), "pj1");
  assert.equal(boutonNomme(vue, "Coup de louche").degats, null, "ce n'est pas une attaque");
  assert.equal(boutonNomme(vue, "Frappe").degats, "5/10/15");
});

test("panneau : la ligne des passifs ne nomme que ce qui n'a pas de bouton : une capacité jouable à une puissance garde le sien", () => {
  const avec = (facons) =>
    pjEssai((valeurs) => {
      valeurs.capacites.push(capaciteEssai({ nom: "Tour de main", niveau: 2, evolue: true, facons }));
    });
  const passive = (puissance) => faconEssai({ puissance, elements: ["Passif"], passif: true });

  // Passive à la puissance 1, jouable à la puissance 2.
  const mixte = vuePanneau(duel({ pj: avec([passive(1), faconEssai({ puissance: 2 })]) }), "pj1");
  assert.equal(mixte.mentions.passifs, null, "elle a un bouton : ce n'est pas un passif");
  assert.equal(boutonsDe(mixte).filter((bouton) => bouton.libelle.startsWith("Tour de main")).length, 1);

  // Passive à toutes ses puissances : nommée, avec son niveau, sans bouton.
  const toute = vuePanneau(duel({ pj: avec([passive(1), passive(2)]) }), "pj1");
  assert.equal(toute.mentions.passifs, "Tour de main [2]");
  assert.equal(boutonsDe(toute).filter((bouton) => bouton.libelle.startsWith("Tour de main")).length, 0);
});

test("panneau : le dé d'un jet de caractéristique compte les deux caractéristiques choisies, pas deux fois la première", () => {
  let etat = duel({ pj: pjEssai((valeurs) => void (valeurs.caracteristiques.sens = 6)) });
  etat = jouer(etat, capacite(etat, "pj1", "Goûter"), regler("caracteristiques", ["force", "sens"]));
  let vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.caracteristiques.choisies, vue.geste.caracteristiques.de], [["force", "sens"], "d10"], "Force 4 + Sens 6 : un d10");

  etat = jouer(etat, regler("difficulte", 6));
  vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.contexte.de, vue.geste.contexte.detail], ["d10", "Force 4 + Sens 6"]);
  assert.equal(vue.geste.aLancer.faces, 10, "le dé que le moteur attend est le même");
});

test("fiche : les actions restantes baissent dès que l'action est payée, sur leur maximum inchangé", () => {
  let etat = duel();
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 2, max: 2 });
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 2, max: 2 }, "rien n'est payé avant le premier dé");
  etat = jouer(etat, de(8, 6));
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 1, max: 2 });
  assert.deepEqual(vueFiche(etat, "adv2", null).actions, { reste: 1, max: 1 });
});

test("panneau : une attaque à deux localisations : entre ses deux d20, l'étape « Localisation » est en cours", () => {
  let etat = duel({ pj: pjEssai((valeurs) => void (valeurs.capacites[0].facons[0].locMultiple = 2)) });
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"), de(8, 6), de(8, 2));
  assert.equal(gesteEnCours(etat).moment, "bilan");
  assert.equal(etapeDite(vuePanneau(etat, null), 2), "Jet d'attaque:en_cours");

  // Le premier d20 est tombé, le second reste à lancer.
  etat = jouer(etat, de(20, 12));
  let vue = vuePanneau(etat, null);
  assert.equal(gesteEnCours(etat).moment, "localisation");
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet d'attaque:faite Localisation:en_cours Interventions:a_venir Dégâts:a_venir");
  assert.deepEqual(vue.geste.aLancer, { faces: 20, combien: 1, libelle: "d20", motif: "localisation" });
  assert.deepEqual(
    vue.geste.localisation.map(({ brut, zone }) => `${brut} ${zone}`),
    ["12 jambe gauche"],
  );
  assert.equal(vue.geste.appliquer, null, "rien ne s'applique avant le dernier d20");

  etat = jouer(etat, de(20, 3));
  vue = vuePanneau(etat, null);
  assert.equal(gesteEnCours(etat).moment, "suites");
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet d'attaque:faite Localisation:faite Interventions:faite Dégâts:en_cours");
  assert.deepEqual(
    vue.geste.localisation.map(({ brut, zone, decaler }) => `${brut} ${zone} ${decaler.gabarit.evenement.de}`),
    ["12 jambe gauche 0", "3 torse 1"],
    "chaque d20 se décale par son propre rang",
  );
});
