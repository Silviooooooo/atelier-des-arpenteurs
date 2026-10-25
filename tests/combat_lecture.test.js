// Contrôles des vues du combat (SPECIFICATION.md, § 17 « Le simulateur de
// combat (lot 4) », et § 11 ; contrat du lot 4, groupe 2, § 2.7, § 8 et
// § 14, N6) : js/combat/lecture.js.
//
// Ce qu'ils tiennent :
// - les vues, champ par champ : la barre (ses quatre lignes d'aide, « Annuler
//   le dernier geste », ses trois raisons et ses quatre questions, la ligne
//   de la limite), le plateau (la raison d'un jeton, la case d'un
//   déplacement à un ou deux événements), la fiche vivante (dont le texte de
//   chacun des huit passifs câblés, actif et inactif, et ses actions
//   restantes), la bulle d'action (son nom, son en-tête, qui se défend, ce
//   qui la ferme ou la réduit, une ligne par façon, les survols et leurs
//   hachures, les passifs, les causes des avantages et des désavantages, les
//   étapes, les cibles, les cases, les choix, les saisies et leurs bornes, le
//   détail des dégâts, l'annonce), le journal et le bandeau (les lignes
//   barrées par les plages des lignes « Annulé », la ligne en cours), la
//   préparation (le lien vers l'écran Rencontre) ;
// - la concordance : à chaque moment du combat de référence, tout événement
//   que porte une vue active est accepté par le moteur (une case à deux
//   événements comme « Annuler le dernier geste »), tout événement que porte
//   un bouton inactif est refusé, et l'événement réellement joué ensuite est
//   de ceux que les vues portaient.
//
// Les attendus sont écrits d'après la mission, le complément et le contrat,
// jamais recopiés de ce que rend le module. La pile d'annulation ne passe
// jamais par JSON : un état se compare sans elle. Les passifs câblés que ces
// contrôles ajoutent se nomment par le code de leur rôle.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as lecture from "../js/combat/lecture.js";
import { questionDAnnulation, vueBandeau, vueBarre, vueFiche, vueJournal, vuePanneau, vuePlateau, vuePreparation } from "../js/combat/lecture.js";
import { ligneEnCours, lignes as fabriques } from "../js/combat/journal.js";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { candidats } from "../js/combat/offre.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide } from "../js/combat/preparation.js";
import { EVENEMENTS_ALERTE } from "../js/combat/regles.js";
import { scenario } from "./outils/combat_reference.js";
import {
  adversaireEssai,
  ajouterPassif,
  aubepineEssai,
  capaciteEssai,
  chefDePartieEssai,
  etatEssai,
  faconEssai,
  marmitonDeCorveeEssai,
  miseEnPlaceEssai,
  pjEssai,
} from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const ANNULER = { type: "annuler" };
const PHOTOS_DE_REFERENCE = {
  "Aubépine Crèmebrûlée": aubepineEssai(),
  "Chef de partie": chefDePartieEssai(),
  "Marmiton de corvée": marmitonDeCorveeEssai(),
};
const ACTION_EN_COURS = "Une action est en cours.";

/** Applique des événements à la suite (une liste s'aplatit) ; un refus fait échouer le contrôle, avec sa phrase. */
function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements.flat()) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

/**
 * Joue une commande d'une vue comme le fait la séance : un événement, ou
 * plusieurs, tous ou aucun. Rend { etat } ou { refus, etat }, l'état reçu.
 */
function executer(etat, commande) {
  let courant = etat;
  for (const evenement of commande.evenements ?? [commande.evenement]) {
    const rendu = appliquer(courant, evenement);
    if (rendu.refus) return { refus: rendu.refus, etat: rendu.etat === courant ? etat : rendu.etat };
    courant = rendu.etat;
  }
  return { etat: courant };
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

/** Toutes les lignes d'une bulle, à plat. */
const lignesDe = (panneau) => panneau.groupes.flatMap((groupe) => groupe.lignes);
const ligneNommee = (panneau, libelle) => {
  const trouvee = lignesDe(panneau).find((ligne) => ligne.libelle === libelle);
  assert.ok(trouvee, `aucune ligne « ${libelle} » parmi : ${lignesDe(panneau).map((ligne) => ligne.libelle).join(", ")}`);
  return trouvee;
};
const groupesDits = (panneau) => panneau.groupes.map((groupe) => `${groupe.titre} : ${groupe.lignes.map((ligne) => ligne.libelle).join(", ")}`);
const etapesDites = (panneau) => panneau.etapes.map(({ nom, etat }) => `${nom}:${etat}`).join(" ");
const etapeDite = (panneau, rang) => `${panneau.etapes[rang].nom}:${panneau.etapes[rang].etat}`;

/** Un état sans sa pile d'annulation, qui ne passe jamais par JSON. */
const sansPile = ({ annulation: _pile, ...reste }) => reste;

/** Les cases de « depuis » à une distance de min à max, dans l'ordre A1 … J10, écrites à la main. */
function casesAutour(depuis, min, max) {
  const colonnes = "ABCDEFGHIJ";
  const [colonne, ligne] = [colonnes.indexOf(depuis[0]), Number(depuis.slice(1)) - 1];
  const noms = [];
  for (let c = 0; c < 10; c += 1) {
    for (let l = 0; l < 10; l += 1) {
      const ecart = Math.max(Math.abs(c - colonne), Math.abs(l - ligne));
      if (ecart >= min && ecart <= max) noms.push(`${colonnes[c]}${l + 1}`);
    }
  }
  return noms;
}

const reference = (jusqua) => versContenu(scenario, PHOTOS_DE_REFERENCE, jusqua === undefined ? {} : { jusqua }).etat;

// ─── La barre ───────────────────────────────────────────────────────────────

const RIEN_A_ANNULER = "Rien à annuler depuis le lancement.";
const BOUTON_D_ANNULATION = (actif, raison, question = null) => ({ libelle: "Annuler le dernier geste", actif, raison, commande: { evenement: { type: "annuler" } }, question });

test("barre : l'état et la ligne d'aide de chacune des quatre phases ; « Annuler » et la limite dans chacune", () => {
  const avant = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  assert.deepEqual(vueBarre(avant), {
    etat: "Préparation",
    aide: "Un protagoniste ajouté se pose d'office : un personnage sur la colonne A, un adversaire sur la colonne J. Déplacez-le en le faisant glisser, en touchant son jeton puis une case, ou par le champ « Case » de sa fiche.",
    finDeTour: null,
    annuler: null,
    limite: null,
  });

  const tourDesPj = jouer(avant, LANCER);
  assert.deepEqual(vueBarre(tourDesPj), {
    etat: "Tour 1 · camp des PJ",
    aide: "Les PJ jouent dans l'ordre de leur choix. Le tour des adversaires commence quand tous ont joué, ou sur « Fin de tour ».",
    finDeTour: { actif: true, raison: null, commande: { evenement: { type: "fin_de_tour" } } },
    annuler: BOUTON_D_ANNULATION(false, RIEN_A_ANNULER),
    limite: null,
  });

  const tourDesAdversaires = jouer(tourDesPj, FIN_DE_TOUR);
  assert.equal(vueBarre(tourDesAdversaires).etat, "Tour 1 · camp des adversaires");
  assert.equal(
    vueBarre(tourDesAdversaires).aide,
    "Les adversaires jouent dans l'ordre de votre choix. Le tour des PJ commence quand tous ont joué, ou sur « Fin de tour ».",
  );
  assert.equal(vueBarre(jouer(tourDesAdversaires, FIN_DE_TOUR)).etat, "Tour 2 · camp des PJ", "le numéro monte quand le camp qui a commencé rejoue");

  const fini = reference();
  assert.equal(fini.phase, "termine");
  assert.deepEqual(vueBarre(fini), {
    etat: "Combat terminé",
    aide: "Le combat est terminé. Le journal se copie et se télécharge toujours.",
    finDeTour: null,
    annuler: BOUTON_D_ANNULATION(true, null, { texte: "Annuler ce geste : Aubépine — Frappe contre Chef ? Ses dés seront perdus.", confirmer: "Annuler le geste", garder: "Garder" }),
    limite: null,
  });
});

test("barre : « Fin de tour » reste proposé pendant qu'un geste se règle, et devient inactif au milieu d'une action", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.equal(vueBarre(etat).finDeTour.actif, true, "rien n'est payé : le tour peut finir");

  etat = jouer(etat, de(8, 6));
  assert.deepEqual(vueBarre(etat).finDeTour, { actif: false, raison: ACTION_EN_COURS, commande: { evenement: { type: "fin_de_tour" } } });
  assert.equal(appliquer(etat, FIN_DE_TOUR).refus.code, "hors_moment", "le moteur refuse ce que la barre dit inactif");
});

test("barre : « Annuler le dernier geste » : ses trois raisons, dans leur ordre ; la question seulement quand il est actif ; le moteur suit le bouton", () => {
  const lance = duel();
  const raisonDe = (etat) => vueBarre(etat).annuler;
  const refus = (etat) => appliquer(etat, ANNULER).refus;

  // Rien de fini depuis le lancement : la première raison, même pendant un geste.
  assert.deepEqual(raisonDe(lance), BOUTON_D_ANNULATION(false, RIEN_A_ANNULER));
  const ouvert = jouer(lance, capacite(lance, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.deepEqual(raisonDe(ouvert), BOUTON_D_ANNULATION(false, RIEN_A_ANNULER), "rien à annuler passe avant le geste en cours");
  assert.equal(refus(ouvert).message, RIEN_A_ANNULER);

  // Un geste fini : actif, avec sa question.
  const manque = jouer(ouvert, de(8, 1));
  assert.deepEqual(raisonDe(manque), BOUTON_D_ANNULATION(true, null, { texte: "Annuler ce geste : Aubépine — Frappe contre Marmiton ? Ses dés seront perdus.", confirmer: "Annuler le geste", garder: "Garder" }));
  assert.equal(refus(manque), undefined);

  // Un geste ouvert, rien n'est payé : la deuxième raison.
  const reouvert = jouer(manque, capacite(manque, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.deepEqual(raisonDe(reouvert), BOUTON_D_ANNULATION(false, "Revenez d'abord sur le geste en cours."));
  assert.equal(refus(reouvert).message, "Revenez d'abord sur le geste en cours.");

  // Payé, pas fini : la troisième.
  const paye = jouer(reouvert, de(8, 6));
  assert.deepEqual(raisonDe(paye), BOUTON_D_ANNULATION(false, "Terminez d'abord le geste en cours."));
  assert.equal(refus(paye).message, "Terminez d'abord le geste en cours.");
  for (const etat of [lance, ouvert, reouvert, paye]) assert.equal(raisonDe(etat).question, null, "inactif : aucune question");
});

test("barre : les quatre questions d'« Annuler le dernier geste », mot pour mot", () => {
  const question = (gestes) => vueBarre(versContenu({ ...scenario, gestes }, PHOTOS_DE_REFERENCE).etat).annuler.question.texte;
  // La Taloche d'Aubépine, ses dés : la seconde phrase.
  assert.equal(vueBarre(reference(7)).annuler.question.texte, "Annuler ce geste : Aubépine — Taloche [1] contre Marmiton n° 2 ? Ses dés seront perdus.");
  // Un déplacement : son départ et son arrivée, sans dé.
  assert.equal(vueBarre(reference(2)).annuler.question.texte, "Annuler ce geste : Aubépine — Pas chassé [1], C3 → D4 ?");
  assert.equal(question([{ qui: "Aubépine", passe: true }]), "Annuler ce geste : Aubépine — passer son tour ?");
  assert.equal(question([{ finDeTour: true }]), "Annuler la fin du tour des PJ ?");
  assert.equal(question([{ finDeTour: true }, { finDeTour: true }]), "Annuler la fin du tour des adversaires ?");

  // La question est celle que l'on demande pour le geste que l'offre défera.
  const etat = reference(7);
  assert.equal(questionDAnnulation(etat, etat.annulation.pile.quoi), vueBarre(etat).annuler.question.texte);
  assert.equal(questionDAnnulation(etat, { genre: "passer", qui: "adv3" }), "Annuler ce geste : Marmiton n° 1 — passer son tour ?");
});

test("barre : la limite des événements : rien à 13 499, la phrase dès 13 500, dans chaque phase", () => {
  const PHRASE = "Ce combat approche de sa limite (13 500 événements sur 15 000) : copiez ou téléchargez le journal ; au-delà, il faudra en commencer un nouveau.";
  assert.equal(EVENEMENTS_ALERTE, 13500);
  const lance = duel();
  const fini = reference();
  const avant = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  for (const etat of [avant, lance, fini]) {
    assert.equal(vueBarre({ ...etat, pas: 13499 }).limite, null, `${etat.phase} : à 13 499, rien`);
    assert.equal(vueBarre({ ...etat, pas: 13500 }).limite, PHRASE, `${etat.phase} : dès 13 500`);
    assert.equal(vueBarre({ ...etat, pas: 14999 }).limite, PHRASE);
  }
  assert.equal(vueBarre(lance).limite, null);
  for (const code of [0x00a0, 0x202f]) assert.equal(PHRASE.includes(String.fromCodePoint(code)), false);
});

// ─── Le plateau ─────────────────────────────────────────────────────────────

test("plateau : avant le lancement, des jetons sans choix ni marque ni raison, et les seules cases occupées", () => {
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
    raison: null,
  });
  assert.equal(vue.jetons.adv2.nom, "Marmiton, adversaire, case J1");
});

test("plateau : « Qui joue ? » : un candidat se choisit par son jeton, et rien n'est écarté au repos", () => {
  const etat = duel({ caseAdv: "E5" });
  const vue = vuePlateau(etat, null);
  assert.deepEqual(vue.jetons.pj1.choix, { commande: { choisir: "pj1" } });
  assert.equal(vue.jetons.adv2.choix, null, "ce n'est pas le tour des adversaires");
  assert.deepEqual([vue.jetons.pj1.inactif, vue.jetons.adv2.inactif], [false, false], "aucun jeton inactif hors d'un choix de cible ou d'arrivée");
  assert.deepEqual([vue.jetons.pj1.raison, vue.jetons.adv2.raison], [null, null]);
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
  assert.equal(vue.jetons.adv3.raison, null, "écarté d'un choix de cible : sans raison de jeton");
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
  assert.deepEqual([payee.jetons.adv2.choix, payee.jetons.adv2.inactif, payee.jetons.adv3.inactif], [null, false, false], "le choix est fermé ; un adversaire n'est pas un candidat");
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

test("plateau : la case d'un déplacement fait jouer la plus petite puissance qui l'atteint : un événement quand c'est la façon en cours, sinon la façon puis la case", () => {
  // Le Chef de partie, en F6, depuis sa ligne Pas chassé [2] (vue 4).
  let etat = jouer(
    combat([
      { photo: aubepineEssai(), case: "A1" },
      { photo: chefDePartieEssai(), case: "F6" },
    ]),
    FIN_DE_TOUR,
  );
  const depuisDeux = jouer(etat, capacite(etat, "adv2", "Pas chassé", 1));
  const vue = vuePlateau(depuisDeux, null);
  const choix = Object.fromEntries(Object.entries(vue.cases).filter(([, une]) => une.choix !== null).map(([nom, une]) => [nom, une.choix.commande]));
  assert.deepEqual(Object.keys(choix), casesAutour("F6", 1, 2));
  // À une case : Pas chassé [1], gratuit ; deux événements, la façon puis la case.
  assert.deepEqual(choix.E5, { evenements: [regler("facon", 0), regler("arrivee", "E5")] });
  for (const nom of casesAutour("F6", 1, 1)) assert.deepEqual(choix[nom], { evenements: [regler("facon", 0), regler("arrivee", nom)] }, nom);
  // À deux cases : la façon en cours suffit.
  assert.deepEqual(choix.D4, { evenement: regler("arrivee", "D4") });
  for (const nom of casesAutour("F6", 2, 2)) assert.deepEqual(choix[nom], { evenement: regler("arrivee", nom) }, nom);
  // Les doubles de la bulle portent les mêmes commandes.
  const geste = vuePanneau(depuisDeux, null).geste;
  for (const une of geste.cases) assert.deepEqual(une.commande, choix[une.case], une.case);

  // Le moteur joue la case : Pas chassé [1], gratuit, et le journal le dit.
  const joue = executer(depuisDeux, choix.E5);
  assert.equal(joue.refus, undefined, joue.refus?.message);
  assert.equal(gesteEnCours(joue.etat).facon, 0);
  etat = jouer(joue.etat, { type: "confirmer" });
  assert.equal(etat.journal.at(-3).texte, "Chef : Pas chassé [1], F6 → E5.");
  assert.equal(etat.protagonistes.adv2.souffle, 7, "gratuit");

  // Depuis la ligne Pas chassé [1], chaque case est de la façon en cours.
  const depuisUne = jouer(depuisDeux, capacite(depuisDeux, "adv2", "Pas chassé", 0));
  const simples = Object.values(vuePlateau(depuisUne, null).cases).filter((une) => une.choix !== null);
  assert.equal(simples.length, 8);
  assert.ok(simples.every((une) => une.choix.commande.evenement?.champ === "arrivee"));
});

test("plateau : un mort reste sur sa case, marqué mort ; dans une case, celui qui joue vient en tête, puis la cible", () => {
  const fini = reference();
  const vue = vuePlateau(fini, null);
  const morts = Object.keys(vue.jetons).filter((id) => vue.jetons[id].mort);
  assert.ok(morts.length >= 2, "le combat de référence finit par la mort des adversaires");
  for (const id of morts) {
    assert.match(vue.jetons[id].nom, /, mort, case [A-J](?:10|[1-9])$/);
    assert.deepEqual([vue.jetons[id].choix, vue.jetons[id].inactif, vue.jetons[id].raison], [null, false, null]);
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
  assert.deepEqual(fiche.actions, { reste: 2, max: 2, texte: "actions restantes : 2 sur 2" });
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
  assert.deepEqual(chef.actions, { reste: 1, max: 1, texte: "actions restantes : 1 sur 1" });
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

  const fini = reference();
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
  assert.deepEqual(vuePanneau(jouer(etat, FIN_DE_TOUR), "adv2").entete, { titre: "Marmiton", sous: "actions restantes : 1 sur 1 · souffle —" }, "sans souffle écrit : « souffle — »");
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

// ─── La bulle : qui joue, son en-tête, ses lignes ───────────────────────────

const VIDE = { candidats: [], nom: null, entete: null, defenseur: null, fermeture: null, etapes: [], groupes: [], passer: null, passifs: [], geste: null, vainqueur: null, focus: null };
const FERMER = { genre: "fermer", libelle: "Fermer", commande: { choisir: null } };

test("bulle : avant le lancement elle ne montre rien ; « Qui joue ? » propose chaque candidat par son nom entier", () => {
  const mep = miseEnPlaceEssai([
    { photo: aubepineEssai(), case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
  ]);
  assert.deepEqual(vuePanneau(ouvrirCombat(mep), null), { genre: "preparation", ...VIDE, annonce: null });

  const etat = jouer(ouvrirCombat(mep), LANCER);
  const qui = vuePanneau(etat, null);
  assert.deepEqual(qui, { genre: "qui_joue", ...VIDE, candidats: [{ id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } }], annonce: etat.annonce, focus: "candidat:pj1" });
  assert.equal(vuePanneau(etat, "adv2").genre, "qui_joue", "un choisi qui ne peut pas jouer ne joue pas");

  const tourAdverse = vuePanneau(jouer(etat, FIN_DE_TOUR), null);
  assert.deepEqual(
    tourAdverse.candidats.map((candidat) => candidat.nom),
    ["Marmiton de corvée n° 1", "Marmiton de corvée n° 2"],
    "le nom entier, numéro compris, jamais le nom court",
  );
});

test("bulle : Aubépine, sans geste (vue 1) : son nom, son en-tête, « Fermer », une ligne par façon dans ses groupes, les passifs en pied, le focus à la première ligne active", () => {
  const etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: chefDePartieEssai(), case: "F6" },
  ]);
  const vue = vuePanneau(etat, "pj1");
  assert.equal(vue.genre, "action");
  assert.equal(vue.nom, "Aubépine Crèmebrûlée : ses actions");
  assert.deepEqual(vue.entete, { titre: "Aubépine Crèmebrûlée", sous: "actions restantes : 2 sur 2 · souffle 10/10" });
  assert.equal(vue.defenseur, null);
  assert.deepEqual(vue.fermeture, FERMER);
  assert.deepEqual(groupesDits(vue), [
    "Couteau d'office (précise) : Frappe, Émincer",
    "Saucier : Flambage [1], Flambage [2], Dressage minute",
    "Grand Four : Fournaise [1], Cendre",
    "Couvercle de marmite : Se couvrir",
    "Bouillon revigorant : Boire le bouillon",
    "Gestes de cuisine : Pas chassé [1], Goûter, Taloche [1], Pas de côté",
  ]);
  assert.deepEqual(ligneNommee(vue, "Frappe"), {
    cle: "0:0",
    libelle: "Frappe",
    degats: "3/8/20",
    desavantage: true,
    intervention: false,
    cout: "gratuit",
    choisi: false,
    actif: true,
    raison: null,
    commande: { evenement: { type: "capacite", qui: "pj1", capacite: 0, facon: 0 } },
    jouer: "Jouer Frappe",
    survol: {
      titre: "Frappe",
      origine: "Couteau d'office",
      description: "Une attaque qui inflige 3/8/20.",
      portee: "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte.",
      causes: [
        {
          texte: "Frappe hors maîtrise : Frappe vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
          citation: null,
          sens: "desavantage",
        },
      ],
      cout: "Coût : 1 action, aucun souffle",
      hachures: ["C3", "C4", "C5", "D3", "D4", "D5", "E3", "E4", "E5"],
    },
  });
  assert.deepEqual(ligneNommee(vue, "Taloche [1]"), {
    cle: "15:0",
    libelle: "Taloche [1]",
    degats: "2/4/8",
    desavantage: false,
    intervention: false,
    cout: "gratuit",
    choisi: false,
    actif: true,
    raison: null,
    commande: { evenement: { type: "capacite", qui: "pj1", capacite: 15, facon: 0 } },
    jouer: "Jouer Taloche [1]",
    survol: {
      titre: "Taloche",
      // Les mains nues ne sont pas une arme qu'on nomme : leur arme porte le
      // nom de la capacité, et l'infobulle aurait dit « Taloche · Taloche ».
      origine: "Gestes de cuisine",
      description: "Une taloche qui inflige 2/4/8.",
      portee: "Portée 0 : sa case seule, hachurée sur la carte.",
      causes: [],
      cout: "Coût : 1 action, aucun souffle",
      hachures: ["D4"],
    },
  });
  const pas = ligneNommee(vue, "Pas chassé [1]");
  assert.deepEqual([pas.degats, pas.cout, pas.survol.portee, pas.survol.hachures], ["1 case", "gratuit", "Arrivée : les cases à une distance de 1 à 1, hachurées sur la carte.", casesAutour("D4", 1, 1)]);
  assert.deepEqual([ligneNommee(vue, "Émincer").cout, ligneNommee(vue, "Fournaise [1]").cout, ligneNommee(vue, "Pas de côté").cout], ["4 souffle", "1 souffle, 1 lien", "X souffle"]);
  assert.deepEqual(
    lignesDe(vue).filter((ligne) => ligne.intervention).map((ligne) => ligne.libelle),
    ["Dressage minute", "Pas de côté"],
    "les interventions ont leur ligne, marquée",
  );
  assert.deepEqual(vue.passer, { actif: true, raison: null, commande: { evenement: { type: "passer", qui: "pj1" } } });

  // En pied, les capacités toutes passives ; ni un passif ni « attendre » n'a de ligne.
  assert.deepEqual(
    vue.passifs.map((passif) => [passif.cle, passif.libelle]),
    [
      ["passif:2", "Réduction [1]"],
      ["passif:5", "Maîtrise de l'agile [1]"],
      ["passif:6", "Vif [1]"],
      ["passif:7", "Nez fin"],
      ["passif:8", "Solo du chef [1]"],
    ],
  );
  assert.deepEqual(vue.passifs[0].survol, {
    titre: "Réduction",
    origine: "Saucier",
    description: "Retire 1 points d'armure par réussite.",
    portee: null,
    causes: [],
    cout: "Passif : ne se joue pas",
    hachures: [],
  });
  assert.equal(vue.passifs[4].survol.origine, "Style de combat");
  assert.ok(!lignesDe(vue).some((ligne) => /Réduction|Vif|Nez fin|Solo du chef|Guetter|Maîtrise/.test(ligne.libelle)));
  assert.equal(vue.focus, "ligne:0:0", "la première ligne active");
  assert.equal(etapesDites(vue), "Capacité:en_cours Cible:a_venir Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(vue.geste, null);
  for (const cle of ["titre", "mentions"]) assert.equal(Object.hasOwn(vue, cle), false, `« ${cle} » a disparu`);
});

test("bulle : le Chef de partie : une ligne par puissance de Pas chassé, ses lignes sous son arme, ses survols de son point de vue", () => {
  const etat = jouer(
    combat([
      { photo: aubepineEssai(), case: "A1" },
      { photo: chefDePartieEssai(), case: "F6" },
    ]),
    FIN_DE_TOUR,
  );
  const vue = vuePanneau(etat, "adv2");
  assert.equal(vue.nom, "Chef de partie : ses actions");
  assert.deepEqual(vue.entete, { titre: "Chef de partie", sous: "actions restantes : 1 sur 1 · souffle 7/7" });
  assert.deepEqual(groupesDits(vue), ["Spatule souple : Frappe, Moulinet farineux [1]", "Capacités : Pas chassé [1], Pas chassé [2]"]);
  assert.deepEqual(
    lignesDe(vue).map((ligne) => [ligne.cle, ligne.degats, ligne.cout, ligne.desavantage, ligne.actif]),
    [
      ["0:0", "6/12/19", "gratuit", false, true],
      ["1:0", "6/12/19", "5 souffle", false, true],
      ["2:0", "1 case", "gratuit", false, true],
      ["2:1", "2 cases", "1 souffle", false, true],
    ],
  );
  assert.deepEqual(ligneNommee(vue, "Frappe").survol, {
    titre: "Frappe",
    origine: "Spatule souple",
    description: "Une attaque qui inflige 6/12/19.",
    portee: "Portée 0 : sa case seule, hachurée sur la carte.",
    causes: [],
    cout: "Coût : 1 action, aucun souffle",
    hachures: ["F6"],
  });
  assert.deepEqual(ligneNommee(vue, "Pas chassé [2]").survol, {
    titre: "Pas chassé",
    origine: null,
    description: "Se déplace de 2 cases.",
    portee: "Arrivée : les cases à une distance de 1 à 2, hachurées sur la carte.",
    causes: [],
    cout: "Coût : 1 action, 1 souffle",
    hachures: casesAutour("F6", 1, 2),
  });
  assert.deepEqual(vue.passifs, []);
  assert.equal(etapeDite(vue, 2), "Jet de défense:a_venir", "quand un adversaire attaque, le jet est la défense du PJ");
  assert.equal(vue.focus, "ligne:0:0");
});

test("bulle : « Fermer » tant que rien n'est payé, « Réduire » et son onglet après le premier dé", () => {
  const avantLeDe = reference({ geste: 7, des: 0 });
  assert.equal(gesteEnCours(avantLeDe).paye, false);
  assert.deepEqual(vuePanneau(avantLeDe, null).fermeture, FERMER, "avant le premier dé, fermer vaut « Revenir »");
  const apres = reference({ geste: 7, des: 1 });
  assert.deepEqual(vuePanneau(apres, null).fermeture, { genre: "reduire", libelle: "Réduire", onglet: "Taloche [1] : rouvrir" });
  assert.deepEqual(vuePanneau(reference({ geste: 7, des: 2 }), null).fermeture, { genre: "reduire", libelle: "Réduire", onglet: "Taloche [1] : rouvrir" });
  // Sans geste : fermer.
  assert.deepEqual(vuePanneau(reference(6), "pj1").fermeture, FERMER);
  // Un adversaire qui attaque, après le premier dé.
  assert.deepEqual(vuePanneau(reference({ geste: 8, des: 1 }), null).fermeture, { genre: "reduire", libelle: "Réduire", onglet: "Frappe : rouvrir" });
});

test("bulle : chaque raison d'une ligne inactive, et le moteur refuse ce que la ligne porte", () => {
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
    "Flambage [2]": "Pas assez de souffle : 10 demandés, 3 restants.",
    "Fournaise [1]": "Pas assez de lien : 1 demandé, 0 restant.",
    "Tour de broche": "absente de la banque",
    "Jet de sel": "coût illisible dans la banque",
  };
  for (const [libelle, raison] of Object.entries(attendus)) {
    const ligne = ligneNommee(vue, libelle);
    assert.deepEqual([ligne.actif, ligne.raison], [false, raison], libelle);
    if (ligne.commande !== null) assert.equal(appliquer(etat, ligne.commande.evenement).refus.message, raison, `${libelle} : la raison de la ligne est le message du refus`);
  }
  const broche = ligneNommee(vue, "Tour de broche");
  assert.deepEqual([broche.cle, broche.commande, broche.cout, broche.degats], ["8:", null, null, null], "une capacité absente de la banque n'a ni façon ni commande");
  assert.deepEqual(broche.survol, { titre: "Tour de broche", origine: "Gestes de cuisine", description: "", portee: null, causes: [], cout: "Coût : illisible", hachures: [] });
  assert.deepEqual([ligneNommee(vue, "Jet de sel").cout, ligneNommee(vue, "Jet de sel").survol.cout], [null, "Coût : illisible"]);
  assert.equal(ligneNommee(vue, "Frappe").actif, true);
  assert.equal(ligneNommee(vue, "Pas chassé [2]").actif, true, "1 de souffle se paie");
  assert.equal(vue.focus, "ligne:0:0");
});

test("bulle : sans ligne active, le focus va à « Passer son tour » ; sans rien à faire, au titre", () => {
  const pj = pjEssai((valeurs) => {
    valeurs.souffle = 0;
    valeurs.capacites = valeurs.capacites.filter((une) => une.nom === "Émincer");
  });
  const etat = duel({ pj });
  const vue = vuePanneau(etat, "pj1");
  assert.deepEqual(lignesDe(vue).map((ligne) => ligne.actif), [false]);
  assert.equal(vue.focus, "passer");
});

test("bulle : les capacités d'un adversaire, une ligne par arme puis « Capacités » ; deux armes, deux lignes", () => {
  const etat = jouer(duel(), FIN_DE_TOUR);
  const vue = vuePanneau(etat, "adv2");
  assert.deepEqual(vue.entete, { titre: "Marmiton", sous: "actions restantes : 1 sur 1 · souffle 5/5" });
  assert.deepEqual(groupesDits(vue), ["Spatule souple : Frappe, Moulinet farineux [1]", "Capacités : Pas chassé [1]"]);
  assert.deepEqual([ligneNommee(vue, "Moulinet farineux [1]").cout, ligneNommee(vue, "Moulinet farineux [1]").desavantage], ["5 souffle", true]);
  assert.deepEqual(ligneNommee(vue, "Moulinet farineux [1]").survol.causes, [
    {
      texte: "Moulinet farineux hors maîtrise : Moulinet farineux vient du Spatule souple (agile), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
      citation: null,
      sens: "desavantage",
    },
  ], "un adversaire dit ses causes de son point de vue");

  const homard = adversaireEssai((valeurs) => {
    valeurs.armes.push({ nom: "Pinces de homard", libelle: "Pinces de homard", poids: null, faces: null, caracteristiques: null, degats: [4, 8, 12], portee: 0, locMultiple: 1, mainsNues: false });
    valeurs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Pinces de homard", description: "Une attaque qui inflige 4/8/12.", attaque: true, degats: [4, 8, 12] }));
  });
  const aDeuxArmes = vuePanneau(jouer(duel({ adv: homard }), FIN_DE_TOUR), "adv2");
  assert.deepEqual(
    aDeuxArmes.groupes.map((groupe) => `${groupe.titre} : ${groupe.lignes.map((ligne) => `${ligne.libelle} ${ligne.degats ?? ""}`.trim()).join(", ")}`),
    ["Spatule souple : Frappe 5/10/15, Moulinet farineux [1] 5/10/15", "Pinces de homard : Frappe 4/8/12", "Capacités : Pas chassé [1] 1 case"],
  );
  assert.deepEqual(
    lignesDe(aDeuxArmes).filter((ligne) => ligne.libelle === "Frappe").map((ligne) => [ligne.cle, ligne.commande.evenement.facon, ligne.survol.origine]),
    [
      ["0:0", 0, "Spatule souple"],
      ["0:1", 1, "Pinces de homard"],
    ],
    "chacune porte sa façon, et son arme pour origine",
  );
});

test("bulle : seule une attaque porte des dégâts sur sa ligne, même si la banque en écrit à une autre capacité", () => {
  const pj = pjEssai((valeurs) => {
    valeurs.capacites.push(capaciteEssai({ nom: "Coup de louche", facons: [faconEssai({ description: "Ajoute 8/11/13 à la prochaine attaque.", degats: [8, 11, 13] })] }));
  });
  const vue = vuePanneau(duel({ pj }), "pj1");
  assert.equal(ligneNommee(vue, "Coup de louche").degats, null, "ce n'est pas une attaque");
  assert.equal(ligneNommee(vue, "Frappe").degats, "5/10/15");
});

test("bulle : les passifs ne nomment que ce qui n'a pas de ligne : une capacité jouable à une puissance garde la sienne, sans sa façon passive", () => {
  const avec = (niveau, facons) =>
    pjEssai((valeurs) => {
      valeurs.capacites.push(capaciteEssai({ nom: "Tour de main", niveau, evolue: true, facons }));
    });
  const passive = (puissance, description = "") => faconEssai({ puissance, elements: ["Passif"], passif: true, description });

  // Passive à la puissance 1, jouable à la puissance 2 : une seule ligne, aucune pour la façon passive.
  const mixte = vuePanneau(duel({ pj: avec(2, [passive(1), faconEssai({ puissance: 2 })]) }), "pj1");
  assert.deepEqual(mixte.passifs, [], "elle a une ligne : ce n'est pas un passif");
  assert.deepEqual(
    lignesDe(mixte).filter((ligne) => ligne.libelle.startsWith("Tour de main")).map((ligne) => ligne.cle),
    ["8:1"],
  );

  // Passive à toutes ses puissances : en pied, avec son niveau, sans ligne ; la description de sa façon au niveau.
  const toute = vuePanneau(duel({ pj: avec(2, [passive(1, "Au niveau 1."), passive(2, "Au niveau 2.")]) }), "pj1");
  assert.deepEqual(toute.passifs.map((passif) => [passif.cle, passif.libelle, passif.survol.description]), [["passif:8", "Tour de main [2]", "Au niveau 2."]]);
  assert.equal(lignesDe(toute).filter((ligne) => ligne.libelle.startsWith("Tour de main")).length, 0);
  // Aucune façon à son niveau : la dernière.
  const audela = vuePanneau(duel({ pj: avec(3, [passive(1, "Au niveau 1."), passive(2, "Au niveau 2.")]) }), "pj1");
  assert.equal(audela.passifs[0].survol.description, "Au niveau 2.");
});

// ─── Les survols ────────────────────────────────────────────────────────────

test("survol : Frappe, Émincer, Pas chassé [2], une capacité sans jet, Goûter, Pas de côté ; les hachures d'une portée 0, 1, 2, d'un déplacement, aucune", () => {
  const pj = pjEssai((valeurs) => {
    valeurs.capacites.push(
      capaciteEssai({ nom: "Coup de louche", groupe: { genre: "base", titre: "Gestes de cuisine" }, facons: [faconEssai({ description: "Touche à deux cases.", attaque: true, degats: [1, 2, 3], portee: 2 })] }),
    );
  });
  const vue = vuePanneau(duel({ pj, caseAdv: "H8" }), "pj1");
  const survol = (libelle) => ligneNommee(vue, libelle).survol;

  assert.deepEqual(survol("Frappe"), {
    titre: "Frappe",
    origine: "Couteau d'office",
    description: "Une attaque qui inflige 5/10/15.",
    portee: "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte.",
    causes: [],
    cout: "Coût : 1 action, aucun souffle",
    hachures: casesAutour("D4", 0, 1),
  });
  assert.deepEqual(survol("Émincer").causes, [
    {
      texte: "Émincer hors maîtrise : Émincer vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
      citation: null,
      sens: "desavantage",
    },
  ]);
  assert.equal(survol("Émincer").cout, "Coût : 1 action, 4 souffle");
  assert.deepEqual(survol("Pas chassé [2]"), {
    titre: "Pas chassé",
    origine: "Gestes de cuisine",
    description: "Se déplace de 2 cases.",
    portee: "Arrivée : les cases à une distance de 1 à 2, hachurées sur la carte.",
    causes: [],
    cout: "Coût : 1 action, 1 souffle",
    hachures: casesAutour("D4", 1, 2),
  });
  assert.equal(survol("Pas chassé [2]").hachures.includes("D4"), false, "un déplacement ne hachure pas sa case");
  assert.equal(survol("Pas chassé [1]").description, "Se déplace de 1 cases.", "la description à la puissance de la ligne");
  assert.deepEqual(survol("Fournaise [1]"), {
    titre: "Fournaise",
    origine: "Grand Four",
    description: "Réchauffe la case.",
    portee: "Cible au choix, sans condition de portée",
    causes: [],
    cout: "Coût : 1 action, 1 souffle, 1 lien",
    hachures: [],
  });
  assert.deepEqual([survol("Flambage [2]").description, survol("Flambage [2]").portee, survol("Flambage [2]").hachures], ["Multiplie les dégâts par 3.", "Cible au choix, sans condition de portée", []]);
  assert.deepEqual([survol("Goûter").portee, survol("Goûter").hachures, survol("Goûter").origine], ["Sans cible", [], "Gestes de cuisine"]);
  assert.equal(survol("Pas de côté").cout, "Coût : 1 action, X souffle");
  // Les hachures d'une attaque vont de 0 à sa portée : sa case comprise.
  assert.deepEqual(survol("Taloche [1]").hachures, ["D4"]);
  assert.deepEqual([survol("Coup de louche").portee, survol("Coup de louche").hachures], ["Portée 2 : sa case et les cases à 2 de distance au plus, hachurées sur la carte.", casesAutour("D4", 0, 2)]);
  assert.equal(survol("Coup de louche").hachures.length, 25);
});

test("survol : un adversaire qui porte un coût en lien le dit non payé ; une ligne sans portée écrite vaut 0", () => {
  const lie = adversaireEssai((valeurs) => {
    valeurs.capacites[0].facons[0].cout = { souffle: 0, lien: 2 };
    valeurs.capacites[1].facons[0].cout = { souffle: "X", lien: "X" };
  });
  const vue = vuePanneau(jouer(duel({ adv: lie }), FIN_DE_TOUR), "adv2");
  assert.equal(ligneNommee(vue, "Frappe").cout, "2 lien");
  assert.equal(ligneNommee(vue, "Frappe").survol.cout, "Coût : 1 action, aucun souffle, 2 lien ; coût en lien non payé : un adversaire n'a pas de lien");
  assert.equal(ligneNommee(vue, "Moulinet farineux [1]").survol.cout, "Coût : 1 action, X souffle, X lien ; coût en lien non payé : un adversaire n'a pas de lien");
  // Un PJ paie son lien : rien de tel.
  assert.equal(ligneNommee(vuePanneau(duel(), "pj1"), "Fournaise [1]").survol.cout, "Coût : 1 action, 1 souffle, 1 lien");
});

test("survol : les causes qui ne dépendent pas de la cible : « en meute » avec un allié seulement, la maîtrise ; leur citation", () => {
  const meute = (valeurs) => {
    const indice = ajouterPassif(valeurs, { role: "en_meute", niveau: 2, nom: "en_meute" });
    valeurs.capacites[indice].facons[0].description = "Un allié sur sa case : 2 avantages en attaque.";
  };
  const ciboulette = pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" }));
  const MEUTE = { texte: "en_meute [2] : un allié sur sa case (D4) ; 2 avantages.", citation: "« Un allié sur sa case : 2 avantages en attaque. »", sens: "avantage" };
  const EMINCER = {
    texte: "Émincer hors maîtrise : Émincer vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
    citation: null,
    sens: "desavantage",
  };

  const accompagne = combat([
    { photo: pjEssai(meute), case: "D4" },
    { photo: ciboulette, case: "D4" },
    { photo: adversaireEssai(), case: "H8" },
  ]);
  const vue = vuePanneau(accompagne, "pj1");
  assert.deepEqual(ligneNommee(vue, "Frappe").survol.causes, [MEUTE]);
  assert.deepEqual(ligneNommee(vue, "Émincer").survol.causes, [MEUTE, EMINCER], "les avantages, puis les désavantages ; sans compte");
  assert.deepEqual(ligneNommee(vue, "Fournaise [1]").survol.causes, [], "une capacité qui n'attaque pas n'a aucune cause");

  const seul = combat([
    { photo: pjEssai(meute), case: "D4" },
    { photo: ciboulette, case: "E5" },
    { photo: adversaireEssai(), case: "H8" },
  ]);
  assert.deepEqual(ligneNommee(vuePanneau(seul, "pj1"), "Émincer").survol.causes, [EMINCER], "sans allié sur sa case, rien : une absence ne s'explique pas");
});

// ─── Les causes du jet ──────────────────────────────────────────────────────

test("causes : chaque phrase, dans l'ordre du jet ; la citation d'un passif ; le compte seulement quand les deux sortes sont là", () => {
  const SOLO = { texte: "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage.", citation: "« Seul sur sa case : 1 avantages. »", sens: "avantage" };

  // La Taloche d'Aubépine (vue 2 bis) : un avantage seul, sans compte.
  assert.deepEqual(vuePanneau(reference({ geste: 7, des: 2 }), null).geste.contexte.causes, { nombre: "1 avantage", nom: "1 avantage : voir la cause", phrases: [SOLO], compte: null });

  // Sa Frappe de C3 contre D4 : la maîtrise seule.
  assert.deepEqual(vuePanneau(reference({ geste: 1, des: 0 }), null).geste.contexte.causes, {
    nombre: "1 désavantage",
    nom: "1 désavantage : voir la cause",
    phrases: [
      {
        texte: "Frappe hors maîtrise : Frappe vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
        citation: null,
        sens: "desavantage",
      },
    ],
    compte: null,
  });

  // Émincer sur la case du Marmiton : Solo du chef et la maîtrise s'annulent.
  assert.deepEqual(vuePanneau(reference({ geste: 6, des: 0 }), null).geste.contexte.causes, {
    nombre: "avantages et désavantages s'annulent",
    nom: "avantages et désavantages s'annulent : voir la cause",
    phrases: [
      SOLO,
      {
        texte: "Émincer hors maîtrise : Émincer vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
        citation: null,
        sens: "desavantage",
      },
    ],
    compte: "Avantages et désavantages s'annulent : aucun ne reste.",
  });

  // Le Chef frappe Aubépine : sa défense, ses types d'armure mêlés.
  assert.deepEqual(vuePanneau(reference({ geste: 8, des: 0 }), null).geste.contexte.causes.phrases, [SOLO, { texte: "Types d'armure mêlés : 1 désavantage en défense.", citation: null, sens: "desavantage" }]);

  // Le Moulinet du Marmiton n° 2 : sa maîtrise, inversée, devient un avantage d'Aubépine ; il reste 1 avantage.
  assert.deepEqual(vuePanneau(reference({ geste: 9, des: 0 }), null).geste.contexte.causes, {
    nombre: "1 avantage",
    nom: "1 avantage : voir la cause",
    phrases: [
      SOLO,
      {
        texte:
          "Moulinet farineux hors maîtrise : Moulinet farineux vient du Spatule souple (agile), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage. Venu de Marmiton n° 2 : ce désavantage devient un avantage pour Aubépine.",
        citation: null,
        sens: "avantage",
      },
      { texte: "Types d'armure mêlés : 1 désavantage en défense.", citation: null, sens: "desavantage" },
    ],
    compte: "Avantages et désavantages s'annulent : il reste 1 avantage.",
  });
});

test("causes : la main, « esprit de corps », et l'inversion d'un passif de l'autre, dit sur la case de son porteur", () => {
  // La main : un avantage de plus que la maîtrise n'annule pas.
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Émincer"), regler("cible", "adv2"), regler("avantages", 2, "Coup d'œil"));
  assert.deepEqual(vuePanneau(etat, null).geste.contexte.causes, {
    nombre: "1 avantage",
    nom: "1 avantage : voir la cause",
    phrases: [
      { texte: "À la main : Coup d'œil.", citation: null, sens: "avantage" },
      {
        texte: "Émincer hors maîtrise : Émincer vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
        citation: null,
        sens: "desavantage",
      },
    ],
    compte: "Avantages et désavantages s'annulent : il reste 1 avantage.",
  });
  etat = jouer(etat, regler("avantages", -1, "Fumée"));
  assert.deepEqual(
    vuePanneau(etat, null).geste.contexte.causes.phrases.map((phrase) => [phrase.texte.slice(0, 18), phrase.sens]),
    [
      ["Émincer hors maîtr", "desavantage"],
      ["À la main : Fumée.", "desavantage"],
    ],
  );
  assert.equal(vuePanneau(etat, null).geste.contexte.causes.compte, null, "deux désavantages, aucun avantage : pas de compte");

  // « esprit de corps » : un PJ qui se défend, un allié sur sa case.
  const corps = pjEssai((valeurs) => void ajouterPassif(valeurs, { role: "esprit_de_corps", nom: "esprit_de_corps" }));
  const ciboulette = pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" }));
  let defense = jouer(
    combat([
      { photo: corps, case: "D4" },
      { photo: ciboulette, case: "D4" },
      { photo: adversaireEssai(), case: "D4" },
    ]),
    FIN_DE_TOUR,
  );
  defense = jouer(defense, capacite(defense, "adv3", "Frappe"), regler("cible", "pj1"));
  assert.deepEqual(vuePanneau(defense, null).geste.contexte.causes.phrases, [{ texte: "esprit_de_corps [1] : un allié sur sa case (D4) ; 1 avantage.", citation: null, sens: "avantage" }]);

  // L'inversion : « en meute » d'un Marmiton qui attaque d'E5, son allié avec lui, Aubépine en D4.
  const meute = adversaireEssai((valeurs) => {
    const indice = ajouterPassif(valeurs, { role: "en_meute", nom: "en_meute" });
    valeurs.capacites[indice].facons[0].description = "Un allié sur sa case : 1 avantage en attaque.";
    valeurs.capacites[0].facons[0].portee = 1;
  });
  let inverse = jouer(
    combat([
      { photo: pjEssai(), case: "D4" },
      { photo: meute, case: "E5" },
      { photo: adversaireEssai(), case: "E5" },
    ]),
    FIN_DE_TOUR,
  );
  inverse = jouer(inverse, capacite(inverse, "adv2", "Frappe"), regler("cible", "pj1"));
  assert.deepEqual(vuePanneau(inverse, null).geste.contexte.causes, {
    nombre: "1 désavantage",
    nom: "1 désavantage : voir la cause",
    phrases: [
      {
        texte: "en_meute [1] : un allié sur sa case (E5) ; 1 avantage. Venu de Marmiton n° 1 : cet avantage devient un désavantage pour Aubépine.",
        citation: "« Un allié sur sa case : 1 avantage en attaque. »",
        sens: "desavantage",
      },
    ],
    compte: null,
  });
});

// ─── L'en-tête d'un jet, qui se défend, la défense ──────────────────────────

test("en-tête : le geste d'un PJ (« action 1 sur 2 », puis « dernière action »), comptée avant le paiement ; d'un adversaire, et qui se défend", () => {
  // Aubépine, sa première action : avant et après le premier dé, la même.
  assert.deepEqual(vuePanneau(reference({ geste: 1, des: 0 }), null).entete, { titre: "Frappe contre Marmiton de corvée n° 1", sous: "Aubépine · action 1 sur 2 · souffle 10/10" });
  const paye = reference({ geste: 1, des: 1 });
  assert.equal(paye.protagonistes.pj1.actions, 1, "le premier dé a payé l'action");
  assert.deepEqual(vuePanneau(paye, null).entete, { titre: "Frappe contre Marmiton de corvée n° 1", sous: "Aubépine · action 1 sur 2 · souffle 10/10" });
  assert.equal(vuePanneau(paye, null).defenseur, null, "un PJ qui attaque ne se défend pas");

  // Sa dernière action (vue 2 bis), le souffle courant.
  const taloche = vuePanneau(reference({ geste: 7, des: 2 }), null);
  assert.deepEqual(taloche.entete, { titre: "Taloche [1] contre Marmiton de corvée n° 2", sous: "Aubépine · dernière action · souffle 6/10" });
  assert.deepEqual(vuePanneau(reference({ geste: 7, des: 0 }), null).entete, taloche.entete, "avant le premier dé, la même");

  // Le Chef frappe Aubépine : son en-tête, puis Aubépine qui se défend.
  for (const des of [0, 1]) {
    const chef = vuePanneau(reference({ geste: 8, des }), null);
    assert.deepEqual(chef.entete, { titre: "Frappe contre Aubépine Crèmebrûlée", sous: "Chef · dernière action · souffle 6/7" }, `${des} dé(s)`);
    assert.equal(chef.defenseur, "Aubépine lance sa défense · souffle 6/10");
    assert.equal(chef.nom, "Chef de partie : ses actions");
  }
});

test("en-tête : le libellé seul sans cible, pour un déplacement, un jet de caractéristique ; « sur » soi, « contre » l'autre camp", () => {
  const etat = combat([
    { photo: aubepineEssai(), case: "D4" },
    { photo: chefDePartieEssai(), case: "D4" },
  ]);
  const titre = (...evenements) => vuePanneau(jouer(etat, ...evenements), null).entete.titre;
  assert.equal(titre(capacite(etat, "pj1", "Frappe")), "Frappe", "la cible n'est pas encore choisie");
  assert.equal(titre(capacite(etat, "pj1", "Pas chassé")), "Pas chassé [1]");
  assert.equal(titre(capacite(etat, "pj1", "Pas chassé"), regler("arrivee", "E5")), "Pas chassé [1]", "un déplacement : le libellé seul, même son arrivée choisie");
  assert.equal(titre(capacite(etat, "pj1", "Goûter")), "Goûter");
  assert.equal(titre(capacite(etat, "pj1", "Flambage")), "Flambage [1]", "sans cible");
  assert.equal(titre(capacite(etat, "pj1", "Flambage"), regler("cible", "pj1")), "Flambage [1] sur Aubépine Crèmebrûlée");
  assert.equal(titre(capacite(etat, "pj1", "Flambage", 1), regler("cible", "adv2")), "Flambage [2] contre Chef de partie");
  assert.equal(vuePanneau(jouer(etat, capacite(etat, "pj1", "Goûter")), null).entete.sous, "Aubépine · action 1 sur 2 · souffle 10/10");

  // Un adversaire dont la capacité ne lance pas de dé : personne ne se défend.
  const cri = capaciteEssai({ nom: "Coup de sifflet", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de sifflet." })] });
  let sifflet = jouer(duel({ adv: adversaireEssai((valeurs) => valeurs.capacites.push(cri)) }), FIN_DE_TOUR);
  sifflet = jouer(sifflet, capacite(sifflet, "adv2", "Coup de sifflet"), regler("cible", "pj1"));
  assert.deepEqual([vuePanneau(sifflet, null).entete.titre, vuePanneau(sifflet, null).defenseur], ["Coup de sifflet contre Aubépine", null]);
  // Le même, son jet prêté : le PJ visé se défend.
  sifflet = jouer(sifflet, regler("jet_prete", true), regler("cible", "pj1"));
  assert.equal(vuePanneau(sifflet, null).defenseur, "Aubépine lance sa défense · souffle 10/10");
});

test("défense : à égalité de dés, « Défense : » et ses types, le choisi retenu, tant que rien n'est lancé", () => {
  const options = (choisi) =>
    [
      ["agile", "agile"],
      ["precise", "précise"],
    ].map(([code, libelle]) => ({ code, libelle, choisie: code === choisi, commande: { evenement: { type: "regler", champ: "defense", valeur: code } } }));
  const avant = reference({ geste: 8, des: 0 });
  assert.deepEqual(vuePanneau(avant, null).geste.contexte.defense, { libelle: "Défense :", options: options("agile") }, "le défaut proposé : le type retenu");
  const precise = jouer(avant, regler("defense", "precise"));
  assert.deepEqual(vuePanneau(precise, null).geste.contexte.defense, { libelle: "Défense :", options: options("precise") });
  assert.deepEqual(vuePanneau(precise, null).geste.contexte.detail, "Précision 5 + Empathie 4", "le jet prend les caractéristiques de défense du type choisi");
  assert.deepEqual(vuePanneau(avant, null).geste.contexte.detail, "Agilité 5 + Créativité 4");
  assert.equal(vuePanneau(jouer(precise, de(8, 5)), null).geste.contexte.defense, null, "après le premier dé, plus rien ne se règle");
  // Aubépine qui attaque n'a pas à choisir sa défense.
  assert.equal(vuePanneau(reference({ geste: 7, des: 0 }), null).geste.contexte.defense, null);
});

// ─── La bulle : les étapes et le geste ──────────────────────────────────────

test("bulle : une attaque d'un PJ, étape par étape, jusqu'au détail des dégâts", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"));
  let vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:en_cours Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(ligneNommee(vue, "Frappe").choisi, true);
  assert.equal(ligneNommee(vue, "Émincer").choisi, false);
  assert.equal(ligneNommee(vue, "Émincer").actif, true, "rien n'est payé : une autre ligne se joue encore");
  assert.equal(vue.geste.description, "Une attaque qui inflige 5/10/15.");
  assert.deepEqual(vue.geste.cibles, [
    { id: "adv2", libelle: "Marmiton", choisie: false, actif: true, raison: null, commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } } },
  ]);
  assert.equal(vue.geste.sansCible, null, "une attaque exige sa cible");
  assert.equal(vue.geste.bilan, "Choisissez une cible.");
  assert.equal(vue.geste.aLancer, null);
  assert.deepEqual(vue.geste.chaine, [], "sans cible, le jet ne s'ouvre pas");
  assert.deepEqual(vue.geste.contexte, { de: null, detail: null, modificateurs: [], difficulte: null, causes: null, defense: null, reglages: vue.geste.contexte.reglages });
  assert.equal(vue.geste.confirmer, null, "un geste à jet se joue par son dé");
  assert.deepEqual(vue.geste.revenir, { commande: { evenement: { type: "revenir" } } });
  assert.equal(vue.focus, "cible:adv2");
  assert.equal(Object.hasOwn(vue.geste, "puissance"), false, "ni + ni − : la puissance est une ligne");

  etat = jouer(etat, regler("cible", "adv2"));
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet d'attaque:en_cours Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.equal(vue.geste.cibles[0].choisie, true);
  assert.deepEqual(vue.entete, { titre: "Frappe contre Marmiton", sous: "Aubépine · action 1 sur 2 · souffle 10/10" });
  assert.deepEqual(vue.geste.contexte, {
    de: "d8",
    detail: "Précision 4 + Agilité 4",
    modificateurs: [],
    difficulte: "5, sa défense",
    causes: null,
    defense: null,
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

  // Le premier dé paie : plus rien ne se règle, plus aucune ligne ne se joue.
  etat = jouer(etat, de(8, 6));
  vue = vuePanneau(etat, null);
  assert.deepEqual(vue.entete, { titre: "Frappe contre Marmiton", sous: "Aubépine · action 1 sur 2 · souffle 10/10" });
  assert.deepEqual([vue.geste.revenir, vue.geste.contexte.reglages], [null, null]);
  // La rangée « Cible : » reste montrée pendant le jet, comme sur la maquette : la seule cible choisie, enfoncée, inactive avec sa raison.
  const pendantLeJet = [{ id: "adv2", libelle: "Marmiton", choisie: true, actif: false, raison: ACTION_EN_COURS, commande: { evenement: { type: "regler", champ: "cible", valeur: "adv2" } } }];
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
  for (const ligne of lignesDe(vue)) assert.deepEqual([ligne.actif, ligne.raison], [false, ACTION_EN_COURS], ligne.libelle);
  assert.equal(ligneNommee(vue, "Frappe").choisi, true);
  assert.deepEqual([vue.passer.actif, vue.passer.raison], [false, ACTION_EN_COURS]);
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

// La raison proposée d'office est le nom de la capacité, coupé à 80 unités
// UTF-16. Un nom peut être plus long, et c'est une donnée hostile : la coupe
// peut tomber au milieu d'un signe astral. La raison n'en garde pas la moitié,
// sans quoi le moteur la refuserait, et avec elle les dégâts directs de la
// capacité (relecture du groupe 2, C-15). Un nom qui porte un demi-codet
// isolé n'entre plus dans un combat : la forme d'une photographie le refuse,
// et la photographie le remplace par une espace (C-15, suite) ; l'élagage de
// la raison proposée reste une défense de plus. Les demi-codets se fabriquent
// par leur code ; le signe astral est une poêle (U+1F373), deux unités.
test("raison proposée : un nom coupé au milieu d'un signe astral ; partout où elle est proposée, sans demi-codet, de 80 unités au plus, et le moteur l'accepte ; un nom à demi-codet isolé n'entre pas dans une photographie", () => {
  const POELE = String.fromCodePoint(0x1f373);
  const DEMI_CODET = /\p{Cs}/u;

  // Frappe renommée ; les six raisons proposées pendant son attaque, chacune
  // éprouvée par le moteur là où l'écran la propose.
  function raisonsProposees(nom) {
    let etat = duel({ pj: pjEssai((valeurs) => Object.assign(valeurs.capacites[0], { nom })) });
    const proposees = [];
    const accepte = (depuis, evenement, ou) => {
      const rendu = appliquer(depuis, evenement);
      assert.equal(rendu.refus, undefined, `${ou} : ${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    };
    etat = jouer(etat, capacite(etat, "pj1", nom), regler("cible", "adv2"));
    let vue = vuePanneau(etat, null);
    for (const champ of ["modificateur", "avantages"]) {
      const saisie = vue.geste.contexte.reglages[champ];
      proposees.push(saisie.raisonParDefaut);
      accepte(etat, completer(saisie, 1), `le contexte, « ${champ} »`);
    }
    etat = jouer(etat, de(8, 6), de(8, 2));
    vue = vuePanneau(etat, null);
    proposees.push(vue.geste.degats.saisie.raisonParDefaut);
    accepte(etat, completer(vue.geste.degats.saisie, 7), "la saisie des dégâts");
    for (const nature of vue.geste.degats.natures.slice(1)) {
      proposees.push(nature.commande.evenement.operations[0].raison);
      accepte(etat, nature.commande.evenement, `la nature « ${nature.libelle} »`);
    }
    etat = jouer(etat, de(20, 12));
    vue = vuePanneau(etat, null);
    const { decaler } = vue.geste.localisation[0];
    proposees.push(decaler.raisonParDefaut);
    accepte(etat, completer(decaler, -1), "le décalage du d20");
    for (const raison of proposees) {
      assert.ok(!DEMI_CODET.test(raison), `${JSON.stringify(raison)} porte un demi-codet isolé`);
      assert.ok(raison.length >= 1 && raison.length <= 80, `${JSON.stringify(raison)} : ${raison.length} unités`);
    }
    return proposees;
  }

  // 79 « a », une poêle, une suite : la coupe à 80 tombe entre les deux
  // moitiés de la poêle, qui s'ôte entière.
  const coupee = `${"a".repeat(79)}${POELE} et sa suite`;
  assert.equal(coupee.slice(0, 80).at(-1), POELE[0], "le cas est bien formé : la coupe seule laisserait la première moitié");
  assert.deepEqual(raisonsProposees(coupee), Array(6).fill("a".repeat(79)));
  // Une poêle entière à la 80e unité reste.
  const pleine = `${"a".repeat(78)}${POELE}`;
  assert.deepEqual(raisonsProposees(`${pleine} et sa suite`), Array(6).fill(pleine));
  // Deux demi-codets isolés au milieu du nom, un de queue puis un de tête, ou
  // un demi-codet de tête à la fin d'un nom court : la photographie est refusée.
  for (const nom of [`Fra${POELE[1]}p${POELE[0]}pe`, `Frappe${POELE[0]}`]) {
    assert.throws(() => pjEssai((valeurs) => Object.assign(valeurs.capacites[0], { nom })), /porte un retour à la ligne ou un caractère de contrôle/, JSON.stringify(nom));
  }
});

test("bulle : un adversaire attaque : le jet de défense du PJ, les rangs à l'envers, l'esquive et ses bornes", () => {
  let etat = jouer(duel(), FIN_DE_TOUR);
  etat = jouer(etat, capacite(etat, "adv2", "Frappe"), regler("cible", "pj1"));
  let vue = vuePanneau(etat, null);
  assert.deepEqual(vue.entete, { titre: "Frappe contre Aubépine", sous: "Marmiton · dernière action · souffle 5/5" }, "la même bulle : c'est l'adversaire qui joue");
  assert.equal(vue.defenseur, "Aubépine lance sa défense · souffle 10/10");
  assert.equal(etapesDites(vue), "Capacité:faite Cible:faite Jet de défense:en_cours Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
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
  assert.equal(vue.defenseur, "Aubépine lance sa défense · souffle 6/10", "le souffle courant de qui se défend");
  assert.equal(vue.focus, "appliquer");

  // Sans souffle, pas d'esquive : l'étape des dégâts vient tout de suite.
  let aSec = jouer(duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 0 })) }), FIN_DE_TOUR);
  aSec = jouer(aSec, capacite(aSec, "adv2", "Frappe"), regler("cible", "pj1"), de(8, 1), de(20, 5));
  assert.equal(vuePanneau(aSec, null).geste.esquive, null);
  assert.equal(etapeDite(vuePanneau(aSec, null), 5), "Dégâts:en_cours");
});

test("bulle : le jet de caractéristique : son étape est en cours dès l'ouverture, puis les caractéristiques et la difficulté", () => {
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
    [vue.entete.titre, vue.geste.contexte.de, vue.geste.contexte.detail, vue.geste.contexte.difficulte, vue.geste.contexte.causes],
    ["Goûter", "d8", "Sens 4 + Parole 4", "6, compliqué", null],
  );
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 1, libelle: "d8", motif: "chaine" });
  assert.equal(vue.focus, "de");
  assert.equal(etapesDites(vue), "Capacité:faite Jet de caractéristique:en_cours");
});

test("bulle : un déplacement : une ligne par puissance, les cases d'arrivée à un ou deux événements, « Confirmer » et sa raison", () => {
  let etat = duel({ casePj: "A1", caseAdv: "J10" });
  const deuxCases = jouer(etat, capacite(etat, "pj1", "Pas chassé", 1));
  let vue = vuePanneau(deuxCases, null);
  assert.equal(etapesDites(vue), "Capacité:faite Arrivée:en_cours");
  assert.deepEqual(
    lignesDe(vue).filter((ligne) => ligne.libelle.startsWith("Pas chassé")).map((ligne) => [ligne.libelle, ligne.choisi, ligne.degats, ligne.cout]),
    [
      ["Pas chassé [1]", false, "1 case", "gratuit"],
      ["Pas chassé [2]", true, "2 cases", "1 souffle"],
    ],
  );
  assert.deepEqual(
    vue.geste.cases.map((une) => une.case),
    ["A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"],
    "à une distance de 1 à 2",
  );
  // À une case, Pas chassé [1] l'atteint et se paie : la façon, puis la case.
  assert.deepEqual(vue.geste.cases[0], { case: "A2", nom: "Case A2 : s'y déplacer", choisie: false, commande: { evenements: [regler("facon", 0), regler("arrivee", "A2")] } });
  assert.deepEqual(vue.geste.cases[1], { case: "A3", nom: "Case A3 : s'y déplacer", choisie: false, commande: { evenement: regler("arrivee", "A3") } });
  // Le double porte le nom et la commande mêmes de la case de la carte.
  const surLaCarte = vuePlateau(deuxCases, null).cases;
  for (const une of vue.geste.cases) assert.deepEqual([une.nom, une.commande], [surLaCarte[une.case].choix.nom, surLaCarte[une.case].choix.commande], une.case);
  assert.deepEqual(vue.geste.confirmer, { libelle: "Confirmer", actif: false, raison: "Choisissez une case d'arrivée.", commande: { evenement: { type: "confirmer" } } });
  assert.equal(appliquer(deuxCases, { type: "confirmer" }).refus.message, "Choisissez une case d'arrivée.");
  assert.deepEqual([vue.geste.contexte, vue.geste.chaine, vue.geste.aLancer, vue.geste.lettres], [null, [], null, null], "aucun dé");
  assert.equal(vue.geste.bilan, "Choisissez une case d'arrivée.");
  assert.equal(vue.focus, "case:A2");
  assert.equal(vue.geste.description, "Se déplace de 2 cases.");

  // La case voisine : la puissance 1 se joue, et la ligne choisie la suit.
  const joue = executer(deuxCases, vue.geste.cases[3].commande);
  assert.equal(joue.refus, undefined, joue.refus?.message);
  vue = vuePanneau(joue.etat, null);
  assert.deepEqual([ligneNommee(vue, "Pas chassé [1]").choisi, ligneNommee(vue, "Pas chassé [2]").choisi], [true, false]);
  assert.deepEqual(vue.geste.cases.map((une) => [une.case, une.choisie]), [["A2", false], ["B1", false], ["B2", true]]);
  assert.ok(vue.geste.cases.every((une) => une.commande.evenement !== undefined), "la façon en cours atteint chaque case");
  assert.deepEqual([vue.geste.confirmer.actif, vue.geste.confirmer.raison], [true, null]);
  assert.equal(vue.geste.bilan, null);
  assert.equal(vue.focus, "confirmer");
  assert.equal(vue.geste.description, "Se déplace de 1 cases.");
  etat = jouer(joue.etat, { type: "confirmer" });
  assert.equal(etat.journal.at(-1).texte, "Aubépine : Pas chassé [1], A1 → B2.");

  // Sans souffle : la ligne de puissance 2 reste, inactive, avec la raison que dira le moteur.
  const aSec = duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 0 })) });
  const deux = ligneNommee(vuePanneau(aSec, "pj1"), "Pas chassé [2]");
  assert.deepEqual([deux.actif, deux.raison], [false, "Pas assez de souffle : 1 demandé, 0 restant."]);
  assert.equal(appliquer(aSec, deux.commande.evenement).refus.message, deux.raison);
});

test("bulle : une capacité sans jet : « Sans cible », tout vivant, « Confirmer », et le jet prêté par l'arme tenue, avec les hachures de sa portée", () => {
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
  assert.deepEqual(vue.geste.jetPrete, {
    presse: false,
    actif: true,
    raison: null,
    commande: { evenement: { type: "regler", champ: "jet_prete", valeur: true } },
    arme: "Couteau d'office",
    hachures: casesAutour("D4", 0, 1),
  });
  assert.deepEqual(vue.geste.confirmer, { libelle: "Confirmer", actif: true, raison: null, commande: { evenement: { type: "confirmer" } } });
  assert.deepEqual([vue.geste.contexte, vue.geste.armes], [null, null]);
  assert.equal(vue.entete.titre, "Flambage [1]");
  assert.equal(vue.focus, "confirmer");
  assert.deepEqual(vuePlateau(etat, null).jetons.pj1.choix, { commande: { evenement: { type: "regler", champ: "cible", valeur: "pj1" } } }, "sur soi : son propre jeton se choisit");

  // Le jet prêté : une cible adverse, à la portée de l'arme (1) ; H8 est trop loin.
  etat = jouer(etat, regler("jet_prete", true));
  vue = vuePanneau(etat, null);
  assert.equal(etapesDites(vue), "Capacité:faite Cible:en_cours Jet d'attaque:a_venir Localisation:a_venir Interventions:a_venir Dégâts:a_venir");
  assert.deepEqual([vue.geste.jetPrete.presse, vue.geste.jetPrete.commande.evenement.valeur, vue.geste.jetPrete.arme, vue.geste.jetPrete.hachures], [true, false, "Couteau d'office", casesAutour("D4", 0, 1)]);
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
  assert.deepEqual(vue.geste.lettres, [{ texte: "1 réussite : 5" }, { texte: "2 : 10" }, { texte: "3 : 15" }], "les dégâts de l'arme prêtée");
  assert.equal(vue.focus, null, "aucune cible possible : le titre");
});

test("bulle : le jet prêté d'un adversaire : « sans arme », sans hachure, ou le choix entre ses armes ; les dégâts « Sans dégâts » et « Dégâts de l'arme »", () => {
  const cri = capaciteEssai({ nom: "Coup de sifflet", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de sifflet." })] });
  const sansArme = adversaireEssai((valeurs) => Object.assign(valeurs, { armes: [], capacites: [cri] }));
  let etat = jouer(duel({ adv: sansArme }), FIN_DE_TOUR);
  etat = jouer(etat, capacite(etat, "adv2", "Coup de sifflet"));
  assert.deepEqual([vuePanneau(etat, null).geste.jetPrete.arme, vuePanneau(etat, null).geste.jetPrete.hachures], ["sans arme", []]);
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
  assert.deepEqual(vuePanneau(double, null).geste.jetPrete.hachures, ["D4"], "la Spatule, portée 0");
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

test("bulle : X et ses bornes, sans raison ; le choix de la jauge de lien", () => {
  let etat = duel({ pj: pjEssai((valeurs) => Object.assign(valeurs, { souffle: 7 })) });
  etat = jouer(etat, capacite(etat, "pj1", "Pas de côté"));
  let vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.x, { valeur: 0, min: 0, max: 7, gabarit: { evenement: { type: "regler", champ: "x" } } }, "de 0 à ce qui reste");
  assert.equal(vue.geste.jauges, null);
  etat = jouer(etat, regler("x", 3));
  assert.equal(vuePanneau(etat, null).geste.x.valeur, 3);
  assert.equal(vuePanneau(jouer(etat, { type: "revenir" }), "pj1").geste, null, "« Revenir » : le geste quitte la bulle");

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

test("bulle : les réglages à la main entrent au contexte et aux causes ; sous désavantage le dé se lance deux fois et son détail le dit", () => {
  let etat = duel();
  etat = jouer(etat, capacite(etat, "pj1", "Émincer"), regler("cible", "adv2"), regler("modificateur", 2, "Minutie"));
  let vue = vuePanneau(etat, null);
  // Le dé s'écrit nu : son modificateur le suit, avec sa source, une seule fois (« d8+2 » devant « +2 » se lisait d8+2+2).
  assert.deepEqual([vue.geste.contexte.de, vue.geste.contexte.modificateurs], ["d8", ["+2 (à la main : Minutie)"]]);
  assert.deepEqual([vue.geste.contexte.reglages.modificateur.valeur, vue.geste.contexte.reglages.modificateur.raison], [2, "Minutie"]);
  assert.deepEqual([vue.geste.contexte.causes.nombre, vue.geste.contexte.causes.phrases.length, vue.geste.contexte.causes.compte], ["1 désavantage", 1, null]);
  assert.deepEqual(vue.geste.aLancer, { faces: 8, combien: 2, libelle: "d8", motif: "chaine" });
  assert.equal(vue.geste.bilan, "Cliquez sur le d8 pour lancer le 1er dé. Il se lance 2 fois : le pire est gardé.");

  // Un avantage à la main annule le désavantage de maîtrise.
  const annule = vuePanneau(jouer(etat, regler("avantages", 1, "Coup d'œil")), null);
  assert.deepEqual(
    [annule.geste.contexte.causes.nombre, annule.geste.contexte.causes.phrases[0].texte, annule.geste.contexte.causes.compte, annule.geste.aLancer.combien],
    ["avantages et désavantages s'annulent", "À la main : Coup d'œil.", "Avantages et désavantages s'annulent : aucun ne reste.", 1],
  );
  const inverse = vuePanneau(jouer(etat, regler("avantages", -1, "Fumée")), null);
  assert.deepEqual([inverse.geste.contexte.causes.nombre, inverse.geste.contexte.causes.phrases.map((phrase) => phrase.sens)], ["2 désavantages", ["desavantage", "desavantage"]]);

  etat = jouer(etat, de(8, 7, 4));
  vue = vuePanneau(etat, null);
  assert.deepEqual(vue.geste.chaine[0], { titre: "1er dé", etat: "reussi", valeur: 6, detail: "7/4 → 4 + 2" });
  assert.equal(vue.entete.sous, "Aubépine · action 1 sur 2 · souffle 6/10", "le souffle courant, l'action comptée avant le paiement");
});

test("bulle : relancer ou garder, puis le dé de la relance", () => {
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
  assert.equal(vue.geste.contexte.causes.nombre, "1 avantage");

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

test("bulle : le dé explosif : « Faire exploser » est le seul choix, puis c'est ce dé qu'on clique", () => {
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

test("bulle : le point de la maquette, dans la démonstration : la Taloche d'Aubépine, un avantage à dépenser (vue 2 bis)", () => {
  // Le septième geste du combat de référence, arrêté après son deuxième dé : la relance est choisie.
  const { contenu, etat: relanceChoisie } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  assert.deepEqual(contenu.evenements.at(-1), { type: "relancer" });
  const avantLeChoix = jouer(ouvrirCombat(contenu.miseEnPlace), ...contenu.evenements.slice(0, -1));

  const vue = vuePanneau(avantLeChoix, null);
  assert.equal(vue.genre, "action");
  assert.equal(vue.nom, "Aubépine Crèmebrûlée : ses actions");
  assert.deepEqual(vue.entete, { titre: "Taloche [1] contre Marmiton de corvée n° 2", sous: "Aubépine · dernière action · souffle 6/10" });
  assert.deepEqual(vue.fermeture, { genre: "reduire", libelle: "Réduire", onglet: "Taloche [1] : rouvrir" });
  assert.deepEqual(vue.etapes, [
    { nom: "Capacité", etat: "faite" },
    { nom: "Cible", etat: "faite" },
    { nom: "Jet d'attaque", etat: "en_cours" },
    { nom: "Localisation", etat: "a_venir" },
    { nom: "Interventions", etat: "a_venir" },
    { nom: "Dégâts", etat: "a_venir" },
  ]);
  const taloche = ligneNommee(vue, "Taloche [1]");
  assert.deepEqual([taloche.degats, taloche.cout, taloche.desavantage, taloche.choisi, taloche.actif], ["2/4/8", "gratuit", false, true, false]);
  assert.equal(vue.geste.description, "Une taloche qui inflige 2/4/8.");
  assert.deepEqual(vue.geste.contexte, {
    de: "d8",
    detail: "Force 4 + Agilité 5",
    modificateurs: ["+1 (Vif)"],
    difficulte: "5, sa défense",
    causes: {
      nombre: "1 avantage",
      nom: "1 avantage : voir la cause",
      phrases: [{ texte: "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage.", citation: "« Seul sur sa case : 1 avantages. »", sens: "avantage" }],
      compte: null,
    },
    defense: null,
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

test("bulle : l'annonce est celle de l'état, dans chaque genre ; le combat terminé dit sa victoire", () => {
  const mep = miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]);
  assert.equal(vuePanneau(ouvrirCombat(mep), null).annonce, null);
  const lance = jouer(ouvrirCombat(mep), LANCER);
  assert.deepEqual(vuePanneau(lance, null).annonce, { pas: 1, texte: "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. — Tour 1 · camp des PJ —" });
  assert.equal(vuePanneau(lance, null).annonce, lance.annonce, "l'objet même : rien ne se redit tant que le pas ne change pas");
  assert.equal(vuePanneau(lance, "pj1").annonce, lance.annonce);

  const fini = reference();
  const vue = vuePanneau(fini, null);
  assert.deepEqual(vue, { genre: "termine", ...VIDE, annonce: fini.annonce, vainqueur: "Combat terminé : victoire des PJ." });
});

test("bulle : le dé d'un jet de caractéristique compte les deux caractéristiques choisies, pas deux fois la première", () => {
  let etat = duel({ pj: pjEssai((valeurs) => void (valeurs.caracteristiques.sens = 6)) });
  etat = jouer(etat, capacite(etat, "pj1", "Goûter"), regler("caracteristiques", ["force", "sens"]));
  let vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.caracteristiques.choisies, vue.geste.caracteristiques.de], [["force", "sens"], "d10"], "Force 4 + Sens 6 : un d10");

  etat = jouer(etat, regler("difficulte", 6));
  vue = vuePanneau(etat, null);
  assert.deepEqual([vue.geste.contexte.de, vue.geste.contexte.detail], ["d10", "Force 4 + Sens 6"]);
  assert.equal(vue.geste.aLancer.faces, 10, "le dé que le moteur attend est le même");
});

test("bulle : une attaque à deux localisations : entre ses deux d20, l'étape « Localisation » est en cours", () => {
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

// ─── Le plateau et la fiche pendant une action ──────────────────────────────

const CIBOULETTE_ESSAI = () => pjEssai((valeurs) => Object.assign(valeurs, { identifiant: "essai-ciboulette-0000000002", nom: "Ciboulette" }));

test("plateau : tant que rien n'est payé, un candidat se choisit hors d'un choix de cible ; après le premier dé, chaque autre candidat attend, avec sa raison", () => {
  const trio = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: CIBOULETTE_ESSAI(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
  ]);
  assert.deepEqual(vuePlateau(trio, null).jetons.pj2.choix, { commande: { choisir: "pj2" } }, "au repos, le candidat se choisit par son jeton");

  // Un geste qui se règle sans cible ni arrivée : chaque candidat se choisit encore.
  const gouter = jouer(trio, capacite(trio, "pj1", "Goûter"));
  let vue = vuePlateau(gouter, null);
  assert.deepEqual([vue.jetons.pj1.choix, vue.jetons.pj2.choix, vue.jetons.adv3.choix], [{ commande: { choisir: "pj1" } }, { commande: { choisir: "pj2" } }, null]);
  assert.deepEqual([vue.jetons.pj2.inactif, vue.jetons.pj2.raison], [false, null]);

  // Pendant le choix d'une cible, seule la cible se choisit.
  const vise = jouer(trio, capacite(trio, "pj1", "Frappe"));
  vue = vuePlateau(vise, null);
  assert.deepEqual([vue.jetons.pj2.choix, vue.jetons.pj2.inactif, vue.jetons.pj2.raison], [null, true, null]);

  // Le dé est tombé : le choix de la cible est fermé, l'action n'est pas finie.
  const paye = jouer(vise, regler("cible", "adv3"), de(8, 6));
  assert.ok(candidats(paye).includes("pj2"), "Ciboulette peut encore agir à ce tour");
  vue = vuePlateau(paye, null);
  assert.deepEqual([vue.jetons.pj1.choix, vue.jetons.pj2.choix, vue.jetons.adv3.choix], [null, null, null]);
  assert.deepEqual(
    ["pj1", "pj2", "adv3"].map((id) => [vue.jetons[id].inactif, vue.jetons[id].raison]),
    [
      [false, null],
      [true, ACTION_EN_COURS],
      [false, null],
    ],
    "celui qui joue et sa cible ne sont pas écartés",
  );
  assert.equal(vueFiche(paye, "pj2", null).jouer, null, "la fiche non plus ne propose pas de jouer");
});

// « Jouer » d'une fiche ouvre la bulle comme le jeton (compl. § 4.1) : il
// suit exactement le choix des jetons, tant que rien n'est payé et hors d'un
// choix de cible ou d'arrivée (relecture du groupe 2, C-18).
test("fiche : « Jouer » suit le choix des jetons : pendant un geste non payé, hors d'un choix de cible ou d'arrivée ; ni pendant ce choix, ni après le premier dé", () => {
  const trio = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: CIBOULETTE_ESSAI(), case: "D4" },
    { photo: adversaireEssai(), case: "D4" },
  ]);
  const commeLeJeton = (etat, id, ou) => {
    const jeton = vuePlateau(etat, null).jetons[id].choix;
    assert.deepEqual(vueFiche(etat, id, null).jouer, jeton?.commande?.choisir === id ? jeton : null, `${ou} : la fiche de ${id} et son jeton`);
  };

  // Aubépine ouvre Goûter, qui se règle sans cible ni arrivée, et rien n'est lancé : Ciboulette se choisit par sa fiche.
  let etat = jouer(trio, capacite(trio, "pj1", "Goûter"), regler("caracteristiques", ["force"]), regler("difficulte", 5));
  assert.deepEqual(vueFiche(etat, "pj2", null).jouer, { commande: { choisir: "pj2" } }, "le geste n'est pas payé");
  assert.equal(vueFiche(etat, "pj1", null).jouer, null, "celui qui joue ne se choisit pas par sa fiche");
  for (const id of ["pj2", "adv3"]) commeLeJeton(etat, id, "Goûter ouvert");

  // Le premier dé paie : plus personne ne se choisit.
  etat = jouer(etat, de(8, 6));
  assert.equal(gesteEnCours(etat).paye, true);
  assert.equal(vueFiche(etat, "pj2", null).jouer, null, "après le premier dé");
  commeLeJeton(etat, "pj2", "après le premier dé");

  // Pendant un choix de cible, la cible choisie comprise, rien : le jeton non plus ne choisit pas.
  const vise = jouer(trio, capacite(trio, "pj1", "Frappe"));
  for (const pas of [vise, jouer(vise, regler("cible", "adv3"))]) {
    assert.equal(vueFiche(pas, "pj2", null).jouer, null, "pendant le choix de la cible");
    commeLeJeton(pas, "pj2", "pendant le choix de la cible");
  }
  // Pendant un choix d'arrivée, de même.
  const enMarche = jouer(trio, capacite(trio, "pj1", "Pas chassé"));
  assert.equal(vueFiche(enMarche, "pj2", null).jouer, null, "pendant le choix de l'arrivée");
  commeLeJeton(enMarche, "pj2", "pendant le choix de l'arrivée");

  // Au tour des adversaires : le Chef sur Frappe, sa cible choisie, sans dé. Le
  // choix de la cible reste ouvert jusqu'au dé : le Marmiton n° 1 ne se choisit
  // ni par son jeton ni par sa fiche ; au repos, il se choisit par les deux.
  const cuisine = jouer(
    combat([
      { photo: aubepineEssai(), case: "D4" },
      { photo: chefDePartieEssai(), case: "D4" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
    ]),
    FIN_DE_TOUR,
  );
  assert.deepEqual(vueFiche(cuisine, "adv3", null).jouer, { commande: { choisir: "adv3" } });
  const chef = jouer(cuisine, capacite(cuisine, "adv2", "Frappe"), regler("cible", "pj1"));
  assert.equal(vueFiche(chef, "adv3", "adv2").jouer, null);
  assert.equal(vuePlateau(chef, "adv2").jetons.adv3.choix, null);
});

test("fiche : « a joué » ne se dit que dans le camp dont c'est le tour, même de qui n'a aucune action", () => {
  // Un adversaire sans action : il n'a rien à jouer, mais ce n'est pas son tour.
  const etat = combat([
    { photo: pjEssai(), case: "D4" },
    { photo: CIBOULETTE_ESSAI(), case: "D4" },
    { photo: adversaireEssai((valeurs) => void (valeurs.actions = 0)), case: "D4" },
  ]);
  assert.equal(etat.tour.camp, "pj");
  const fiche = vueFiche(etat, "adv3", null);
  assert.deepEqual(fiche.actions, { reste: 0, max: 0, texte: "actions restantes : 0 sur 0" });
  assert.equal(fiche.statut, null, "le tour est aux PJ : l'adversaire n'« a » pas « joué »");
  assert.deepEqual(fiche.marques, []);
  assert.doesNotMatch(vuePlateau(etat, null).jetons.adv3.nom, /a joué/);
  // Dans l'autre sens : le PJ qui passe, au tour des PJ, « a joué ».
  const passe = jouer(etat, { type: "passer", qui: "pj1" });
  assert.equal(passe.tour.camp, "pj");
  assert.equal(vueFiche(passe, "pj1", null).statut, "a joué");
  assert.equal(vueFiche(passe, "adv3", null).statut, null);
});

test("fiche : les actions restantes baissent dès que l'action est payée, sur leur maximum inchangé ; « 1 action sur 2 » ne s'écrit plus", () => {
  let etat = duel();
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 2, max: 2, texte: "actions restantes : 2 sur 2" });
  etat = jouer(etat, capacite(etat, "pj1", "Frappe"), regler("cible", "adv2"));
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 2, max: 2, texte: "actions restantes : 2 sur 2" }, "rien n'est payé avant le premier dé");
  etat = jouer(etat, de(8, 6));
  assert.deepEqual(vueFiche(etat, "pj1", null).actions, { reste: 1, max: 2, texte: "actions restantes : 1 sur 2" });
  assert.deepEqual(vueFiche(etat, "adv2", null).actions, { reste: 1, max: 1, texte: "actions restantes : 1 sur 1" });
  const toutes = JSON.stringify([vueBarre(etat), vuePlateau(etat, null), etat.ordre.map((id) => vueFiche(etat, id, null)), vuePanneau(etat, null)]);
  assert.doesNotMatch(toutes, /\d+ actions? sur \d+/, "« 1 action sur 2 » ne s'écrit plus nulle part");
});

// ─── Le journal et le bandeau ───────────────────────────────────────────────

test("journal : depuis 0, chaque ligne du combat de référence, son rang, ses segments, non barrée ; depuis un rang, la suite seule", () => {
  const fini = reference();
  const vue = vueJournal(fini);
  assert.equal(vue.total, 36);
  assert.equal(vue.lignes.length, 36);
  vue.lignes.forEach((ligne, rang) => {
    const ecrite = fini.journal[rang];
    assert.deepEqual(Object.keys(ligne), ["rang", "genre", "texte", "segments", "phrases", "barree", "barre"]);
    assert.deepEqual([ligne.rang, ligne.genre, ligne.texte, ligne.barree, ligne.barre], [rang, ecrite.genre, ecrite.texte, false, null], `ligne ${rang}`);
    assert.equal(ligne.segments, ecrite.segments, "les segments du journal, l'objet même");
    assert.equal(ligne.phrases, ecrite.phrases);
  });
  // La mort se lit dans son segment, non dans le texte.
  assert.deepEqual(
    vue.lignes.flatMap((ligne) => ligne.segments.filter((segment) => segment.type === "mort").map((segment) => segment.texte)),
    ["Marmiton n° 1 meurt.", "Marmiton n° 2 meurt.", "Chef meurt."],
  );

  const suite = vueJournal(fini, 30);
  assert.equal(suite.total, 36);
  assert.deepEqual(suite.lignes.map((ligne) => ligne.rang), [30, 31, 32, 33, 34, 35]);
  assert.deepEqual(suite.lignes, vue.lignes.slice(30));
  assert.deepEqual(vueJournal(fini, 36), { total: 36, lignes: [] });
  assert.deepEqual(vueJournal(fini, 99), { total: 36, lignes: [] }, "au-delà du journal, rien");
  assert.deepEqual(vueJournal(fini, -4), vue, "un rang négatif part du début");
  assert.deepEqual(vueJournal(fini, 2.5), vue, "un rang qui n'est pas entier aussi");
});

test("journal : une annulation barre les lignes de son geste, fins de tour comprises, et elles seules ; la ligne « Annulé » ne l'est jamais ; depuis un rang, seules ses annulations comptent", () => {
  // Après la Taloche, la fin automatique du tour des PJ : trois lignes, 12 à 14.
  const avant = reference(7);
  assert.equal(avant.journal.length, 15);
  const une = jouer(avant, ANNULER);
  let vue = vueJournal(une);
  assert.equal(vue.total, 16);
  assert.deepEqual(vue.lignes.filter((ligne) => ligne.barree).map((ligne) => ligne.rang), [12, 13, 14]);
  assert.deepEqual(vue.lignes[15], {
    rang: 15,
    genre: "annule",
    texte: "Annulé : Aubépine — Taloche [1].",
    segments: une.journal[15].segments,
    phrases: ["annule"],
    barree: false,
    barre: [12, 15],
  });
  assert.equal(vue.lignes.filter((ligne) => ligne.barre !== null).length, 1, "seule la ligne « Annulé » porte une plage");

  // Puis Émincer, la ligne 11.
  const deux = jouer(une, ANNULER);
  vue = vueJournal(deux);
  assert.deepEqual(vue.lignes.filter((ligne) => ligne.barree).map((ligne) => ligne.rang), [11, 12, 13, 14]);
  assert.deepEqual([vue.lignes[15].barree, vue.lignes[16].barree, vue.lignes[16].barre], [false, false, [11, 12]]);

  // Depuis un rang : les lignes déjà posées ne reviennent pas ; l'écran les barre par la plage.
  assert.deepEqual(vueJournal(une, 13).lignes.map((ligne) => [ligne.rang, ligne.barree]), [[13, true], [14, true], [15, false]]);
  assert.deepEqual(vueJournal(deux, 16).lignes.map((ligne) => [ligne.rang, ligne.barree, ligne.barre]), [[16, false, [11, 12]]]);
  assert.deepEqual(vueJournal(deux, 15).lignes.map((ligne) => [ligne.rang, ligne.barree]), [[15, false], [16, false]]);
});

test("journal : une plage se lit sa fin exclue ; une ligne « Annulé » ne barre que ce qui la précède ; une ligne écrite à la main tient en un segment", () => {
  const base = etatEssai(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  const aLaMain = (texte) => ({ genre: "geste", texte });
  const annule = (barre) => ({ genre: "annule", texte: "Annulé : à la main.", barre });
  const journal = [
    ...base.journal, // 0, 1
    aLaMain("Deux."), // 2
    aLaMain("Trois."), // 3
    aLaMain("Quatre."), // 4 : juste après la plage [2, 4)
    annule([2, 4]), // 5
    aLaMain("Six."), // 6
    annule([6, 9]), // 7 : sa plage la dépasse ; elle ne barre ni elle-même ni ce qui la suit
    aLaMain("Huit."), // 8
    annule([1.5, 3]), // 9 : une plage qui ne se lit pas ne barre rien
    annule([5, 6]), // 10 : elle couvre une ligne « Annulé », qui ne se barre jamais
  ];
  const etat = { ...base, journal };
  const vue = vueJournal(etat);
  assert.deepEqual(
    vue.lignes.map((ligne) => [ligne.rang, ligne.barree]),
    [
      [0, false],
      [1, false],
      [2, true],
      [3, true],
      [4, false],
      [5, false],
      [6, true],
      [7, false],
      [8, false],
      [9, false],
      [10, false],
    ],
  );
  assert.deepEqual([vue.lignes[5].barre, vue.lignes[7].barre, vue.lignes[9].barre, vue.lignes[10].barre], [[2, 4], [6, 9], null, [5, 6]]);
  // Écrite à la main, sans segments : un seul, son texte, phrase 0.
  assert.deepEqual([vue.lignes[2].segments, vue.lignes[2].phrases], [[{ type: "texte", texte: "Deux.", phrase: 0 }], ["ouverture"]]);
  assert.deepEqual(vue.lignes[1].segments, [{ type: "texte", texte: base.journal[1].texte, phrase: 0 }]);
  for (const ligne of vue.lignes) assert.equal(ligne.segments.map((segment) => segment.texte).join(""), ligne.texte);
});

test("journal : 7 500 annulations en un passage : chaque ligne n'est lue qu'une fois", () => {
  const base = duel();
  const quoi = { genre: "passer", qui: "pj1" };
  const ecrites = [...base.journal];
  for (let k = 0; k < 7500; k += 1) {
    const rang = ecrites.length;
    ecrites.push(fabriques.passe(base, "pj1"), fabriques.annulation(base, quoi, [rang, rang + 1]));
  }
  let lectures = 0;
  const journal = new Proxy(ecrites, {
    get(cible, cle, recepteur) {
      if (typeof cle === "string" && /^\d+$/.test(cle)) lectures += 1;
      return Reflect.get(cible, cle, recepteur);
    },
  });
  const etat = { ...base, journal };
  const vue = vueJournal(etat);
  assert.equal(vue.total, 15002);
  assert.ok(lectures <= vue.total, `${lectures} lectures pour ${vue.total} lignes`);
  const passes = vue.lignes.filter((ligne) => ligne.genre === "geste");
  const annulees = vue.lignes.filter((ligne) => ligne.genre === "annule");
  assert.equal(passes.length, 7500);
  assert.ok(passes.every((ligne) => ligne.barree), "chaque passe est barrée");
  assert.ok(annulees.every((ligne) => !ligne.barree && ligne.barre[0] === ligne.rang - 1));
  assert.equal(annulees[0].texte, "Annulé : Aubépine — passer son tour.");

  lectures = 0;
  const fin = vueJournal(etat, 15000);
  assert.deepEqual(fin.lignes.map((ligne) => [ligne.rang, ligne.barree]), [[15000, true], [15001, false]]);
  assert.ok(lectures <= 2, "depuis un rang, seules les lignes qui suivent se lisent");
});

test("bandeau : null avant le lancement ; la dernière ligne, avec son rang ; pendant un geste payé, la ligne en cours, sans rang ; la ligne « Annulé » garde sa plage", () => {
  const avant = ouvrirCombat(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  assert.equal(vueBandeau(avant), null);

  const lance = duel();
  const derniere = lance.journal.at(-1);
  assert.deepEqual(vueBandeau(lance), {
    enCours: false,
    ligne: { rang: 1, genre: "tour", texte: "— Tour 1 · camp des PJ —", segments: derniere.segments, phrases: ["tour"], barree: false, barre: null },
  });

  // Un geste ouvert, rien n'est payé : la dernière ligne du journal.
  const ouvert = reference({ geste: 7, des: 0 });
  assert.deepEqual(vueBandeau(ouvert).ligne.rang, ouvert.journal.length - 1);
  assert.equal(vueBandeau(ouvert).enCours, false);

  // Après le premier dé : la ligne que le geste écrit, suivie de « … ».
  for (const des of [1, 2]) {
    const paye = reference({ geste: 7, des });
    const enCours = ligneEnCours(paye);
    const vue = vueBandeau(paye);
    assert.equal(vue.enCours, true);
    assert.deepEqual(vue.ligne, { rang: null, genre: "geste", texte: enCours.texte, segments: enCours.segments, phrases: enCours.phrases, barree: false, barre: null });
    assert.ok(vue.ligne.texte.startsWith("Aubépine : Taloche [1] contre Marmiton n° 2."));
    assert.ok(vue.ligne.texte.endsWith(String.fromCodePoint(0x2026)));
  }

  // Le geste fini, sa ligne ; annulé, la ligne « Annulé » et sa plage.
  const fini = reference(7);
  assert.deepEqual([vueBandeau(fini).enCours, vueBandeau(fini).ligne.rang, vueBandeau(fini).ligne.texte], [false, 14, "— Tour 2 · camp des adversaires —"]);
  const annule = vueBandeau(jouer(fini, ANNULER));
  assert.deepEqual([annule.ligne.rang, annule.ligne.genre, annule.ligne.barre, annule.ligne.barree], [15, "annule", [12, 15], false]);

  // Un état écrit à la main : sa dernière ligne, en un segment.
  const aLaMain = etatEssai(miseEnPlaceEssai([{ photo: pjEssai() }, { photo: adversaireEssai() }]));
  assert.deepEqual(vueBandeau(aLaMain).ligne.segments, [{ type: "texte", texte: aLaMain.journal.at(-1).texte, phrase: 0 }]);
});

// ─── Rien d'instable ────────────────────────────────────────────────────────

test("vues : rien d'instable : deux lectures du même état donnent le même texte, sans espace insécable, et l'état n'est pas touché", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  const etat = jouer(ouvrirCombat(contenu.miseEnPlace), ...contenu.evenements);
  const avant = JSON.stringify(sansPile(etat));
  const lire = () =>
    JSON.stringify([vueBarre(etat), vuePlateau(etat, null), etat.ordre.map((id) => vueFiche(etat, id, null)), vuePanneau(etat, null), vueJournal(etat), vueBandeau(etat)]);
  assert.equal(lire(), lire());
  assert.equal(JSON.stringify(sansPile(etat)), avant);
  assert.ok(Object.isFrozen(etat), "l'état est gelé : une vue qui l'écrirait lèverait");
  for (const code of [0x00a0, 0x202f]) assert.equal(lire().includes(String.fromCodePoint(code)), false, "aucune espace insécable dans une vue");
});

// ─── La préparation ─────────────────────────────────────────────────────────

const APPORTS_VIDES = { personnages: [], phrases: [], adversaires: [], rencontre: [], absents: null };
const COMPOSEZ = "Composez d'abord une rencontre à l'écran Rencontre.";
const LIEN = { avant: "Composez d'abord une rencontre à l'", texte: "écran Rencontre", apres: ".", adresse: "#/rencontre" };

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

test("préparation : vide, elle attend ses personnages, dit la banque sans adversaire, mène à l'écran Rencontre, et refuse de lancer", () => {
  const mep = miseEnPlaceVide("demo");
  const vue = vuePreparation(mep, { ...APPORTS_VIDES, personnages: null, phrases: ["Les personnages en ligne ne se lisent pas pour l'instant."] });
  assert.deepEqual(vue, {
    personnages: { attente: true, phrases: ["Les personnages en ligne ne se lisent pas pour l'instant."], options: [] },
    adversaires: { options: [], vide: "Cette banque n'a aucun adversaire." },
    rencontre: { actif: false, raison: COMPOSEZ, lien: LIEN },
    quiCommence: [
      { camp: "pj", libelle: "Les PJ", choisi: true, commande: { preparer: { type: "qui_commence", camp: "pj" } } },
      { camp: "adv", libelle: "Les adversaires", choisi: false, commande: { preparer: { type: "qui_commence", camp: "adv" } } },
    ],
    lancer: { actif: false, raison: "Il faut au moins un personnage et un adversaire." },
    absents: null,
    avertissements: [],
  });
  assert.equal(`${LIEN.avant}${LIEN.texte}${LIEN.apres}`, vue.rencontre.raison, "les trois morceaux redonnent la raison");
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

test("préparation : la rencontre préparée se place, sauf vide (avec son lien) ou au-delà d'un plafond (sans lien) ; un adversaire qui ne s'ajoute pas ne compte pas", () => {
  const adversaires = [
    { nom: "Marmiton", refus: null },
    { nom: "Plongeur", refus: null },
    { nom: "Mouette", refus: "Ne s'ajoute pas : incomplet, 2 erreurs." },
  ];
  const avec = (mep, rencontre) => vuePreparation(mep, { ...APPORTS_VIDES, adversaires, rencontre }).rencontre;
  const vide = mettreEnPlace({});
  const PRETE = { actif: true, raison: null, lien: null };
  assert.deepEqual(avec(vide, []), { actif: false, raison: COMPOSEZ, lien: LIEN });
  assert.deepEqual(avec(vide, [{ nom: "Marmiton", nombre: 3 }, { nom: "Plongeur", nombre: 1 }]), PRETE);
  assert.deepEqual(avec(vide, [{ nom: "Marmiton", nombre: 12 }]), PRETE);
  assert.deepEqual(avec(mettreEnPlace({ adversaires: { Marmiton: 10 } }), [{ nom: "Marmiton", nombre: 2 }]), PRETE, "à la suite : dix et deux font douze");
  assert.deepEqual(avec(mettreEnPlace({ adversaires: { Marmiton: 10 } }), [{ nom: "Marmiton", nombre: 3 }]), { actif: false, raison: "12 exemplaires au plus d'un même adversaire.", lien: null });
  const pleins = { Marmiton: 12, Saucier: 12, Rôtisseur: 12, Commis: 12, Mitron: 10 };
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Plongeur", nombre: 2 }]), PRETE);
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Plongeur", nombre: 3 }]), { actif: false, raison: "60 adversaires au plus dans un combat.", lien: null });
  assert.deepEqual(avec(mettreEnPlace({ adversaires: pleins }), [{ nom: "Mouette", nombre: 9 }, { nom: "Plongeur", nombre: 2 }]), PRETE, "la Mouette est laissée : elle ne pèse pas sur le plafond");
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

// Dit si les vues portent le pas que le combat joue ensuite : un événement,
// ou les deux événements d'une case d'arrivée.
function porte({ panneau, barre, plateau }, pas) {
  if (Array.isArray(pas)) return relever([panneau, plateau]).commandes.some(({ commande, actif }) => actif && commande.evenements && memeEvenement(commande.evenements, pas));
  const evenement = pas;
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
 * Éprouve un état : tout ce que porte une vue active est accepté par le
 * moteur (une commande à deux événements, tous) ; tout événement que porte un
 * bouton inactif est refusé, et l'état rendu est l'objet reçu ; toute
 * commande « choisir » désigne un candidat, ou personne (« Fermer »). Rend le
 * compte de ce qui a été éprouvé.
 */
function eprouver(etat, choisi, ou) {
  const vues = { barre: vueBarre(etat), plateau: vuePlateau(etat, choisi), fiches: etat.ordre.map((id) => vueFiche(etat, id, choisi)), panneau: vuePanneau(etat, choisi) };
  const { commandes, gabarits } = relever(vues);
  const compte = { acceptes: 0, refuses: 0, choisis: 0, saisies: 0, doubles: 0, annuler: 0 };

  for (const { commande, actif, inactif } of commandes) {
    if (commande.choisir !== undefined) {
      assert.ok(commande.choisir === null || candidats(etat).includes(commande.choisir), `${ou} : « choisir ${commande.choisir} » ne désigne pas un candidat`);
      compte.choisis += 1;
      continue;
    }
    if (commande.preparer !== undefined) continue;
    const rendu = executer(etat, commande);
    if (actif && !inactif) {
      assert.equal(rendu.refus, undefined, `${ou} : une vue porte ${JSON.stringify(commande)}, que le moteur refuse : ${rendu.refus?.message}`);
      compte.acceptes += 1;
      if (commande.evenements) compte.doubles += 1;
      if (commande.evenement?.type === "annuler") compte.annuler += 1;
    } else {
      assert.notEqual(rendu.refus, undefined, `${ou} : un bouton inactif porte ${JSON.stringify(commande)}, que le moteur accepte`);
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
  const total = { acceptes: 0, refuses: 0, choisis: 0, saisies: 0, doubles: 0, annuler: 0, moments: 0 };
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
  assert.ok(total.doubles > 0, `${total.doubles} cases à deux événements`);
  assert.ok(total.annuler > 10, `${total.annuler} annulations offertes et acceptées`);
  assert.deepEqual(
    [...typesJoues].sort(),
    ["appliquer", "capacite", "confirmer", "de", "degats", "esquive", "fin_de_tour", "garder", "passer", "regler", "relancer", "exploser"].sort(),
    "tous les types du combat de référence ont été retrouvés dans une vue",
  );
});

test("concordance : là où le combat de référence ne passe pas (X, jauge, décalage, arme prêtée, case à deux événements, explosion, annulation)", () => {
  const eprouverLaSuite = (depart, pas, ou) => {
    let etat = depart;
    let compte = 0;
    pas.forEach((un, rang) => {
      const qui = Array.isArray(un) ? null : (un.qui ?? null);
      const lu = eprouver(etat, qui, `${ou}, avant le pas n° ${rang + 1}`);
      assert.ok(porte(lu.vues, un), `${ou} : aucune vue ne porte ${JSON.stringify(un)}`);
      compte += lu.compte.acceptes + lu.compte.refuses + lu.compte.saisies;
      etat = jouer(etat, un);
    });
    eprouver(etat, null, `${ou}, à la fin`);
    return { compte, etat };
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

  let { compte, etat } = eprouverLaSuite(
    depart,
    [
      // X et la jauge, puis « Revenir ».
      c("pj1", "Bouquet garni"),
      regler("jauge", 1),
      regler("x", 2),
      regler("cible", "adv2"),
      { type: "revenir" },
      // La ligne de puissance 2, une case voisine qui joue la puissance 1, puis une autre case.
      c("pj1", "Pas chassé", 1),
      [regler("facon", 0), regler("arrivee", "D5")],
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
      // Annuler le dernier geste, deux fois : le jet prêté et sa fin de tour, puis la Frappe.
      ANNULER,
      ANNULER,
    ],
    "le duel d'essai",
  );
  assert.ok(compte > 500, `${compte} événements éprouvés`);
  assert.equal(etat.tour.camp, "pj", "les deux gestes et leurs fins de tour sont défaits");
  assert.equal(etat.journal.at(-1).texte, "Annulé : Aubépine — Frappe.");

  // Un adversaire qui porte un coût en lien, un autre sans arme, une capacité absente de la banque.
  const lie = adversaireEssai((valeurs) => {
    valeurs.capacites[0].facons[0].cout = { souffle: 0, lien: 2 };
    valeurs.capacites.push(capaciteEssai({ nom: "Tour de broche", groupe: { genre: "capacites", titre: "Capacités" }, inactive: "absente de la banque", facons: [] }));
  });
  const tourAdverse = jouer(duel({ adv: lie }), FIN_DE_TOUR);
  ({ compte } = eprouverLaSuite(tourAdverse, [capacite(tourAdverse, "adv2", "Frappe"), regler("cible", "pj1"), de(8, 8), de(8, 8), de(8, 8)], "l'adversaire au coût en lien"));
  assert.ok(compte > 20, `${compte} événements éprouvés`);
});

// ─── Le module ──────────────────────────────────────────────────────────────

test("module : ses vues, et elles seules (vueLigne a disparu) ; il n'importe jamais le moteur, seulement ce que le contrat lui permet, et rien de l'appareil ni de la page", () => {
  assert.deepEqual(Object.keys(lecture).sort(), ["questionDAnnulation", "vueBandeau", "vueBarre", "vueFiche", "vueJournal", "vuePanneau", "vuePlateau", "vuePreparation"]);
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
    "./plateau.js",
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
  const entete = source.slice(0, source.search(/^import /m));
  assert.match(entete, /SPECIFICATION\.md,\s+\/\/\s+§ 17/);
  assert.match(entete, /§ 2\.7 et § 8/);
});
