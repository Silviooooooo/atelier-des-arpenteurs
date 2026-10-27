// Contrôles du journal du combat (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : js/combat/journal.js. Le texte du journal est exact : chaque
// gabarit est comparé mot pour mot, au signe près.
//
// Trois témoins :
// - les trente-six lignes du combat de référence fictif (Aubépine Crèmebrûlée
//   contre le Chef de partie et deux Marmitons de corvée), arrêtées avant le
//   code : chacune doit sortir des fonctions du journal, en texte comme en
//   segments (lignes.*, groupe 2), le genre et le texte de chaque ligne
//   inchangés ;
// - chaque gabarit du § 17, un cas chacun, et sa règle vue dans les deux sens
//   (le singulier et le pluriel, la parenthèse écrite et absente, le segment
//   écrit et tu) ;
// - les deux lignes déroulées pas à pas dans la démonstration (l'attaque
//   ajustée qui tue, la défense avec le pas de côté).
//
// Les états et les gestes sont écrits à la main, sans le moteur : une ligne
// est une fonction du geste fini, des noms et des photographies. Les jets,
// eux, sont montés par js/combat/jet.js, dé après dé, comme le moteur les
// tient. Tous les noms viennent de la démonstration. Les gabarits neufs de la
// fin du combat (lot 4.3, mission § 7) se contrôlent sur des combats joués
// par le moteur, dans tests/combat_g3_journal.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  annonce,
  ecrireBilan,
  ecrireBlessures,
  ecrireDe,
  ecrireDegats,
  ecrireEcheance,
  ecrireEffet,
  ecrireHeure,
  ecrireIntervention,
  ecrireJet,
  ecrireLocalisation,
  ecrireMort,
  ecrireOuverture,
  ecrirePlace,
  ecrireSource,
  ecrireSources,
  enTete,
  ligneDeFin,
  ligneDeFinDeTour,
  ligneDeLancement,
  ligneDePasse,
  ligneDeTour,
  ligneDuGeste,
  lignes,
  nomDuFichier,
  phrasesDuGeste,
  segmentsDuGeste,
  texteDuJournal,
} from "../js/combat/journal.js";
import { exploser, garder, jetFini, lancerDe, ouvrirJet, relancer } from "../js/combat/jet.js";
import { nommer } from "../js/combat/noms.js";
import { DIFFICULTES, SIGNES, geler } from "../js/combat/regles.js";
import { photoDe } from "../js/combat/valeurs.js";
import { CARACTERISTIQUES } from "../js/personnage/regles.js";
import { journalAttendu } from "./outils/combat_reference.js";
import {
  adversaireEssai,
  ajouterPassif,
  aubepineEssai,
  capaciteEssai,
  chefDePartieEssai,
  etatEssai,
  etatsEssai,
  faconEssai,
  marmitonDeCorveeEssai,
  miseEnPlaceEssai,
  pjEssai,
} from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const GESTE_NEUTRE = {
  numero: 1,
  acteur: "pj1",
  capacite: 0,
  facon: 0,
  mode: "attaque",
  moment: "fini",
  paye: true,
  prix: { actions: 1, souffle: 0, lien: 0, jauge: null, lienNonPaye: 0 },
  cible: null,
  arrivee: null,
  depart: null,
  x: 0,
  jauge: null,
  caracteristiques: null,
  difficulte: null,
  armePretee: null,
  reglages: { modificateur: null, avantages: null },
  jet: null,
  degats: null,
  localisation: [],
  interventions: [],
  resultat: null,
  parent: null,
  // Le groupe 3 (contrat de la vague 1, § 4).
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
  sourceDeLAttaqueEnPlus: null,
};

// Un geste tel que le moteur le tient (§ 17), gelé : le journal qui le
// modifierait lèverait. Un champ mal orthographié passerait sans bruit, et le
// contrôle éprouverait autre chose que ce qu'il croit.
function gesteEssai(champs = {}) {
  for (const nom of Object.keys(champs)) assert.ok(Object.hasOwn(GESTE_NEUTRE, nom), `gesteEssai : le champ « ${nom} » n'existe pas`);
  return geler({ ...structuredClone(GESTE_NEUTRE), ...champs });
}

const prix = (champs = {}) => ({ ...GESTE_NEUTRE.prix, ...champs });
const d20 = (brut, decalage = null) => ({ brut, decalage });
const coup = (zone, champs = {}) => ({ zone, armure: [0, 0], resistance: [5, 5], corps: [10, 10], blessure: false, blessures: 0, ...champs });
const resultat = (coups, mort = false) => ({ coups, mort });

const LETTRE = { base: "lettre", operations: [], nature: "normaux" };
const AUCUN = { base: "aucun", operations: [], nature: "normaux" };
const ARME = { base: "arme", operations: [], nature: "normaux" };
const ajuste = (base, valeur, raison, nature = "normaux") => ({ base, operations: [{ op: "ajuster", valeur, raison }], nature });

const CHOIX = { relancer, garder, exploser };

// Un jet monté dé après dé : une liste de valeurs brutes est un dé lancé (deux
// valeurs sous un désavantage), un mot est un choix du joueur.
function chaine(circonstances, ...pas) {
  let jet = ouvrirJet({ caracteristiques: null, mobilisees: [], libelle: null, modificateurs: [], avantages: [], desavantages: [], ...circonstances });
  for (const un of pas) {
    const rendu = Array.isArray(un) ? lancerDe(jet, un) : CHOIX[un](jet);
    assert.ok(rendu.jet, `le jet refuse ${JSON.stringify(un)} : ${rendu.refus?.message}`);
    jet = rendu.jet;
  }
  return jet;
}

// Le même, mené à son terme : une ligne de journal ne s'écrit que d'un geste
// fini.
function chaineFinie(circonstances, ...pas) {
  const jet = chaine(circonstances, ...pas);
  assert.ok(jetFini(jet), `la chaîne ${JSON.stringify(pas)} n'est pas finie : elle attend « ${jet.attente} »`);
  return jet;
}

const VIF = { genre: "passif", nom: "Vif", valeur: 1 };
// Un ±N de la palette sur un personnage (convention 54) : n à chaque dé de
// ses jets. Depuis la fin du −1 des blessures (lot 4.3), c'est lui, ou la
// main, qui fait passer un dé sous zéro.
const ecart = (n) => ({ genre: "effet", nom: "Cheville tordue", valeur: n });
const aLaMain = (valeur, raison) => ({ genre: "main", nom: raison, valeur });

const SOLO = { genre: "passif", nom: "Solo du chef", nombre: 1, de: null };
const MELES = { genre: "armure_melee", nom: null, nombre: 1, de: null };
const horsMaitrise = (nom, de = null) => ({ genre: "maitrise", nom, nombre: 1, de });
const mainAvantageuse = (nombre, raison) => ({ genre: "main", nom: raison, nombre, de: null });

// Un état lancé, écrit à la main, aux noms que donne nommer() : le journal
// écrit le nom court (« Marmiton n° 2 »), figé au lancement.
function etatDe(protagonistes, { mode = "demo", quiCommence = "pj", ...options } = {}) {
  const miseEnPlace = miseEnPlaceEssai(protagonistes, { mode, quiCommence });
  const noms = nommer(miseEnPlace.protagonistes.map(({ id, camp, photo }) => ({ id, camp, nom: photo.valeurs.nom })));
  return etatEssai(miseEnPlace, { noms, ...options });
}

// Les protagonistes ronds : « Aubépine » (pj1), d8 à l'attaque comme en
// défense, Frappe 5/10/15 ; « Marmiton » (adv2), attaque 4, défense 5,
// Frappe 5/10/15.
const duel = ({ pj, adv, ...options } = {}) => etatDe([{ photo: pjEssai(pj) }, { photo: adversaireEssai(adv) }], options);

// La démonstration, comme dans le combat de référence : pj1, adv2 (le Chef),
// adv3 et adv4 (les deux Marmitons).
const demonstration = (options) =>
  etatDe(
    [
      { photo: aubepineEssai(), case: "C3" },
      { photo: chefDePartieEssai(), case: "F6" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
      { photo: marmitonDeCorveeEssai(), case: "D4" },
    ],
    options,
  );

// Une capacité et une zone se retrouvent par leur nom et par leur code,
// jamais par un indice écrit.
function indice(etat, id, nom) {
  const rang = photoDe(etat, id).capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(rang, -1, `${id} n'a pas la capacité « ${nom} »`);
  return rang;
}

function zone(etat, id, code) {
  const rang = photoDe(etat, id).zones.findIndex((une) => une.code === code);
  assert.notEqual(rang, -1, `${id} n'a pas la zone « ${code} »`);
  return rang;
}

// La blessure que la démonstration donne à Aubépine (lot 4.3), figée.
const MAIN_BRULEE = etatsEssai().blessure.find((capacite) => capacite.nom === "Main brûlée");

const brioche = () =>
  pjEssai((valeurs) => {
    valeurs.nom = "Brioche";
    valeurs.identifiant = "essai-brioche-0000000002";
  });

// ─── Le combat de référence ─────────────────────────────────────────────────

// La façon d'une capacité à une puissance donnée, retrouvée par sa puissance :
// le Chef a une façon de Pas chassé par puissance, de 1 à son rang.
function faconDePuissance(etat, id, nom, puissance) {
  const rang = photoDe(etat, id).capacites[indice(etat, id, nom)].facons.findIndex((facon) => facon.puissance === puissance);
  assert.notEqual(rang, -1, `${id} n'a pas « ${nom} » à la puissance ${puissance}`);
  return rang;
}

// Les deux écritures d'une ligne : le texte du groupe 1 (ligneDuGeste et les
// lignes du cadre), et la ligne entière du groupe 2, faite par les fabriques
// lignes.* (les mêmes noms de méthodes).
const PAR_LE_TEXTE = Object.freeze({
  lancement: ligneDeLancement,
  tour: ligneDeTour,
  finDeTour: ligneDeFinDeTour,
  fin: ligneDeFin,
  passe: ligneDePasse,
  geste: ligneDuGeste,
});

// Les trente-six lignes, dans l'ordre du combat, écrites par « ecrivain »
// (PAR_LE_TEXTE ou lignes). Les circonstances de chaque jet (modificateurs,
// sources) sont celles que le calcul à la main a arrêtées ; les dés sont ceux
// du scénario, bruts.
const lignesDeReference = () => referenceEcritePar(PAR_LE_TEXTE);

function referenceEcritePar(ecrivain) {
  const etat = demonstration();
  const [AUBEPINE, CHEF, MARMITON_1, MARMITON_2] = etat.ordre;
  const joue = (acteur, nom, champs = {}) => gesteEssai({ acteur, capacite: indice(etat, acteur, nom), ...champs });
  const touche = (id, code, champs) => coup(zone(etat, id, code), champs);

  const attaque = (champs) => ({ genre: "attaque", lanceur: AUBEPINE, faces: 10, mobilisees: ["precision", "agilite"], modificateurs: [VIF], ...champs });
  const defense = (champs) => ({
    genre: "defense",
    lanceur: AUBEPINE,
    faces: 8,
    mobilisees: ["agilite", "creativite"],
    modificateurs: [VIF],
    avantages: [SOLO],
    desavantages: [MELES],
    ...champs,
  });

  return [
    ecrivain.lancement(etat),
    ecrivain.tour({ numero: 1, camp: "pj" }),
    // Aubépine est en C3, le Marmiton en D4 : sans corps-à-corps, il ne lui
    // reste que le désavantage de maîtrise.
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Frappe", {
        cible: MARMITON_1,
        jet: chaineFinie(attaque({ difficulte: 5, desavantages: [horsMaitrise("Frappe")] }), [6, 9], [8, 2]),
        degats: LETTRE,
        localisation: [d20(16)],
        resultat: resultat([touche(MARMITON_1, "bras_gauche", { armure: [15, 11] })]),
      }),
    ),
    ecrivain.geste(etat, joue(AUBEPINE, "Pas chassé", { mode: "deplacement", depart: "C3", arrivee: "D4" })),
    ecrivain.finDeTour("pj"),
    ecrivain.tour({ numero: 1, camp: "adv" }),
    ecrivain.geste(
      etat,
      joue(MARMITON_1, "Frappe", {
        cible: AUBEPINE,
        jet: chaineFinie(defense({ difficulte: 4 }), [5], [2]),
        degats: LETTRE,
        localisation: [d20(13)],
        resultat: resultat([touche(AUBEPINE, "jambe_gauche", { armure: [10, 0] })]),
      }),
    ),
    ecrivain.geste(etat, joue(CHEF, "Pas chassé", { mode: "deplacement", facon: faconDePuissance(etat, CHEF, "Pas chassé", 2), prix: prix({ souffle: 1 }), depart: "F6", arrivee: "D4" })),
    ecrivain.geste(etat, joue(MARMITON_2, "Frappe", { cible: AUBEPINE, jet: chaineFinie(defense({ difficulte: 4 }), [3], [7], [5]) })),
    ecrivain.finDeTour("adv"),
    ecrivain.tour({ numero: 2, camp: "pj" }),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Émincer", {
        prix: prix({ souffle: 4 }),
        cible: MARMITON_1,
        jet: chaineFinie(attaque({ difficulte: 5, avantages: [SOLO], desavantages: [horsMaitrise("Émincer")] }), [4], [8], [3]),
        degats: ajuste("lettre", 20, "Émincer"),
        localisation: [d20(20)],
        resultat: resultat([touche(MARMITON_1, "tete", { armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 })], true),
      }),
    ),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Taloche", {
        cible: MARMITON_2,
        caracteristiques: ["force", "agilite"],
        jet: chaineFinie(
          { genre: "attaque", lanceur: AUBEPINE, faces: 8, caracteristiques: ["force", "agilite"], mobilisees: ["force", "agilite"], difficulte: 5, modificateurs: [VIF], avantages: [SOLO] },
          [7],
          [3],
          "relancer",
          [5],
          [8],
        ),
        degats: LETTRE,
        localisation: [d20(14)],
        resultat: resultat([touche(MARMITON_2, "jambe_droite", { resistance: [5, 0], corps: [10, 7], blessure: true, blessures: 1 })]),
      }),
    ),
    ecrivain.finDeTour("pj"),
    ecrivain.tour({ numero: 2, camp: "adv" }),
    ecrivain.geste(
      etat,
      joue(CHEF, "Frappe", {
        cible: AUBEPINE,
        jet: chaineFinie(defense({ difficulte: 5 }), [4], [3]),
        degats: LETTRE,
        localisation: [d20(17)],
        interventions: [{ qui: AUBEPINE, capacite: indice(etat, AUBEPINE, "Pas de côté"), prix: { actions: 1, souffle: 3 }, effet: { genre: "annuler", x: 3 } }],
        resultat: resultat([touche(AUBEPINE, "bras_gauche", { armure: [10, 1] })]),
      }),
    ),
    ecrivain.geste(
      etat,
      joue(MARMITON_2, "Moulinet farineux", {
        prix: prix({ souffle: 5 }),
        cible: AUBEPINE,
        jet: chaineFinie(defense({ difficulte: 4, avantages: [SOLO, horsMaitrise("Moulinet farineux", "Marmiton n° 2")] }), [6], [2], "relancer", [4], [1]),
        degats: LETTRE,
        localisation: [d20(12)],
        // L'endurance tombe à 0 sans que le corps perde rien : ce n'est plus une
        // blessure (mission, § 4.10).
        resultat: resultat([touche(AUBEPINE, "jambe_gauche", { resistance: [5, 0], blessures: 1 })]),
      }),
    ),
    ecrivain.finDeTour("adv"),
    ecrivain.tour({ numero: 3, camp: "pj" }),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Goûter", {
        mode: "caracteristique",
        caracteristiques: ["savoir_sauvage", "sens"],
        difficulte: 6,
        jet: chaineFinie(
          {
            genre: "caracteristique",
            lanceur: AUBEPINE,
            faces: 6,
            caracteristiques: ["savoir_sauvage", "sens"],
            mobilisees: ["savoir_sauvage", "sens"],
            difficulte: 6,
            libelle: DIFFICULTES[6],
          },
          [6],
          [6],
          [2],
        ),
      }),
    ),
    ecrivain.finDeTour("pj"),
    ecrivain.tour({ numero: 3, camp: "adv" }),
    // La face de contre-attaque annule l'attaque, mais le bilan du jet reste
    // écrit ; Aubépine laisse passer la contre-attaque, et la ligne le dit.
    ecrivain.geste(
      etat,
      joue(CHEF, "Moulinet farineux", {
        prix: prix({ souffle: 5 }),
        cible: AUBEPINE,
        jet: chaineFinie(defense({ difficulte: 5 }), [3]),
        degats: LETTRE,
        localisation: [d20(20)],
        contre: { statut: "laissee" },
      }),
    ),
    ecrivain.passe(etat, MARMITON_2),
    ecrivain.finDeTour("adv"),
    ecrivain.tour({ numero: 4, camp: "pj" }),
    // Le jet prêté par le couteau : sans désavantage de maîtrise, et le
    // deuxième dé gardé malgré la relance qui restait.
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Fournaise", {
        mode: "jet_prete",
        armePretee: 0,
        prix: prix({ souffle: 1, lien: 1, jauge: 0 }),
        cible: CHEF,
        jet: chaineFinie(attaque({ difficulte: 7, avantages: [SOLO] }), [8], [4], "garder"),
        degats: AUCUN,
        localisation: [d20(6)],
        resultat: resultat([touche(CHEF, "torse", { armure: [38, 38] })]),
      }),
    ),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Frappe", {
        cible: CHEF,
        jet: chaineFinie(attaque({ difficulte: 7, avantages: [SOLO], desavantages: [horsMaitrise("Frappe")] }), [5]),
      }),
    ),
    ecrivain.finDeTour("pj"),
    ecrivain.tour({ numero: 4, camp: "adv" }),
    ecrivain.geste(
      etat,
      joue(CHEF, "Frappe", {
        cible: AUBEPINE,
        jet: chaineFinie(defense({ difficulte: 5 }), [5], [3]),
        degats: LETTRE,
        localisation: [d20(16)],
        resultat: resultat([touche(AUBEPINE, "bras_gauche", { armure: [1, 0], resistance: [5, 0], corps: [10, 4], blessure: true, blessures: 2 })]),
        // La blessure qu'Aubépine choisit dans le bloc de blessure.
        blessures: [{ zone: zone(etat, AUBEPINE, "bras_gauche"), capacite: MAIN_BRULEE, libre: null }],
      }),
    ),
    ecrivain.finDeTour("adv"),
    ecrivain.tour({ numero: 5, camp: "pj" }),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Frappe", {
        cible: MARMITON_2,
        jet: chaineFinie(attaque({ difficulte: 5, avantages: [SOLO], desavantages: [horsMaitrise("Frappe")] }), [4], [7], [3]),
        degats: LETTRE,
        localisation: [d20(15)],
        resultat: resultat([touche(MARMITON_2, "jambe_droite", { resistance: [0, 0], corps: [7, 0], blessures: 1 })], true),
      }),
    ),
    ecrivain.geste(
      etat,
      joue(AUBEPINE, "Frappe", {
        cible: CHEF,
        jet: chaineFinie(attaque({ difficulte: 7, avantages: [SOLO], desavantages: [horsMaitrise("Frappe")] }), [6], [8], [7]),
        degats: LETTRE,
        localisation: [d20(13)],
        resultat: resultat([touche(CHEF, "jambe_gauche", { resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 })], true),
      }),
    ),
    ecrivain.fin("pj"),
  ];
}

test("le combat de référence : ses trente-six lignes sortent mot pour mot des fonctions du journal", () => {
  const textes = lignesDeReference();
  assert.equal(journalAttendu.length, 36);
  assert.equal(textes.length, journalAttendu.length);
  textes.forEach((texte, rang) => assert.equal(texte, journalAttendu[rang], `ligne ${rang + 1} du combat de référence`));
});

// ─── Le combat de référence, en segments (groupe 2) ─────────────────────────

// Le genre de chaque ligne du combat de référence, tel que le moteur l'écrit
// depuis le groupe 1 ; les lignes 12, 34 et 35 portent une mort.
const GENRES_DE_REFERENCE = [
  ...["cadre", "tour", "geste", "geste", "cadre", "tour", "geste", "geste", "geste", "cadre", "tour"],
  ...["geste", "geste", "cadre", "tour", "geste", "geste", "cadre", "tour", "geste", "cadre", "tour"],
  ...["geste", "geste", "cadre", "tour", "geste", "geste", "cadre", "tour", "geste", "cadre", "tour"],
  ...["geste", "geste", "fin"],
];

// Au groupe 3, « echeance » (« Fin de … ») et « mj » (« MJ : »).
const TYPES = ["texte", "acteur", "capacite", "cible", "reussi", "echoue", "lettre", "ajuste", "mort", "fin_de_tour", "tour", "suite", "echeance", "mj"];

// Ce que toute ligne fabriquée tient (contrat du groupe 2, § 3.1) : gelée ;
// ses segments redonnent son texte (la règle d'or) ; aucun n'est vide ;
// leurs phrases se suivent, jointes par une espace hors phrase ; « acteur » en
// tête d'une ligne de geste ou de passe, et nulle part ailleurs ; « acteur »
// et « cible » avec leur camp ; « ✓ » et « ✗ » dans un dé, et seulement là ;
// la mort en dernier.
function verifierLaLigne(ligne, quoi) {
  const { segments, phrases } = ligne;
  assert.ok(Object.isFrozen(ligne) && Object.isFrozen(segments) && segments.every(Object.isFrozen), `${quoi} : gelée`);
  assert.equal(segments.map((segment) => segment.texte).join(""), ligne.texte, `${quoi} : la règle d'or`);
  let attendue = 0;
  segments.forEach((segment, rang) => {
    const ici = `${quoi}, segment ${rang} (« ${segment.texte} »)`;
    assert.ok(TYPES.includes(segment.type), `${ici} : type ${segment.type}`);
    assert.ok(typeof segment.texte === "string" && segment.texte !== "", `${ici} : vide`);
    if (segment.phrase === null) {
      if (segment.type === "suite") assert.equal(rang, segments.length - 1, `${ici} : la suite est en dernier`);
      else assert.ok(segment.type === "texte" && segment.texte === " " && rang > 0 && rang < segments.length - 1, `${ici} : hors phrase, une espace entre deux phrases`);
      if (segment.type === "texte") attendue += 1;
    } else {
      assert.equal(segment.phrase, attendue, `${ici} : sa phrase`);
    }
    if (segment.type === "acteur") assert.ok(rang === 0 && ligne.genre === "geste" && ["ouverture", "passe", "jet"].includes(phrases[0]), `${ici} : l'acteur ailleurs qu'en tête d'un geste`);
    if (segment.type === "acteur" || segment.type === "cible") assert.ok(["pj", "adv"].includes(segment.camp), `${ici} : son camp`);
    else assert.equal(segment.camp, undefined, `${ici} : un camp hors d'un nom`);
    if (segment.type === "reussi" || segment.type === "echoue") {
      assert.ok(Number.isInteger(segment.de) && segment.jet === 0, `${ici} : un signe hors d'un dé`);
      assert.equal(segment.texte, segment.type === "reussi" ? SIGNES.reussi : SIGNES.echoue);
    } else {
      assert.ok(!segment.texte.includes(SIGNES.reussi) && !segment.texte.includes(SIGNES.echoue), `${ici} : « ✓ » ou « ✗ » hors d'un dé`);
    }
    if (segment.type === "mort") assert.ok(rang === segments.length - 1 && phrases[segment.phrase] === "mort", `${ici} : la mort en dernier`);
  });
  assert.equal(attendue, phrases.length - 1, `${quoi} : une phrase par genre`);
}

test("le combat de référence, fabriqué par lignes.* : le genre et le texte de chaque ligne inchangés, ses segments les redonnent", () => {
  const faites = referenceEcritePar(lignes);
  assert.equal(faites.length, 36);
  assert.deepEqual(
    faites.map(({ genre, texte }) => ({ genre, texte })),
    journalAttendu.map((texte, rang) => ({ genre: GENRES_DE_REFERENCE[rang], texte })),
  );
  assert.deepEqual(
    faites.flatMap((ligne, rang) => (ligne.mort === true ? [rang + 1] : [])),
    [12, 34, 35],
    "mort: true sur les trois lignes qui tuent",
  );
  faites.forEach((ligne, rang) => verifierLaLigne(ligne, `ligne ${rang + 1}`));

  // Les segments typés du combat : un acteur par ligne de geste, une cible
  // par geste qui en a une, les dés, la lettre, le nombre saisi, les morts.
  const types = faites.flatMap((ligne) => ligne.segments.map((segment) => segment.type));
  const combien = (type) => types.filter((un) => un === type).length;
  assert.equal(combien("acteur"), 17);
  assert.equal(combien("cible"), 13);
  assert.equal(combien("reussi") + combien("echoue"), 35, "un signe par essai");
  assert.equal(combien("lettre"), 10);
  assert.equal(combien("ajuste"), 1, "l'Émincer ajusté à 20");
  assert.equal(combien("mort"), 3);
  assert.equal(combien("tour"), 9);
  assert.equal(combien("fin_de_tour"), 8);
  assert.equal(combien("suite"), 0);
});

test("le combat de référence : les phrases de chaque ligne de geste sont celles de segmentsDuGeste, et ses genres leur ordre", () => {
  const vues = [];
  const temoin = { ...lignes, geste: (etat, geste) => vues.push({ ligne: lignes.geste(etat, geste), textes: segmentsDuGeste(etat, geste), phrases: phrasesDuGeste(etat, geste) }) };
  referenceEcritePar(temoin);
  assert.equal(vues.length, 16, "les seize gestes du combat, passe exclue");
  for (const { ligne, textes, phrases } of vues) {
    assert.deepEqual(phrases.map((phrase) => phrase.genre), ligne.phrases);
    assert.deepEqual(
      phrases.map((phrase) => phrase.segments.map((segment) => segment.texte).join("")),
      textes,
    );
    assert.equal(textes.join(" "), ligne.texte);
  }
  assert.deepEqual(vues[0].ligne.phrases, ["ouverture", "jet", "localisation", "degats"]);
  assert.deepEqual(vues[1].ligne.phrases, ["ouverture"], "le déplacement");
  assert.deepEqual(vues[5].ligne.phrases, ["ouverture", "sources", "jet", "localisation", "degats", "mort"], "l'Émincer qui tue");
  assert.deepEqual(vues[7].ligne.phrases, ["ouverture", "sources", "jet", "localisation", "intervention", "degats"], "la défense au Pas de côté");
  assert.deepEqual(vues[9].ligne.phrases, ["jet"], "le jet de caractéristique tient en une phrase");
  assert.deepEqual(vues[10].ligne.phrases, ["ouverture", "sources", "jet", "localisation", "contre_attaque"], "la face de contre-attaque, puis la contre-attaque laissée");
  assert.deepEqual(vues[13].ligne.phrases, ["ouverture", "sources", "jet", "localisation", "degats", "blessures"], "la blessure choisie");
});

// ─── Le cadre ───────────────────────────────────────────────────────────────

test("le lancement compte chaque camp, au singulier comme au pluriel, et dit qui commence", () => {
  assert.equal(ligneDeLancement(duel()), "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent.");

  const marmiton = () => ({ photo: marmitonDeCorveeEssai() });
  const plusieurs = etatDe([{ photo: aubepineEssai() }, { photo: brioche() }, marmiton(), marmiton(), marmiton(), { photo: chefDePartieEssai() }], { quiCommence: "adv" });
  assert.equal(ligneDeLancement(plusieurs), "Combat lancé : 2 personnages contre 4 adversaires. Les adversaires commencent.");
});

test("le tour, la fin d'un tour et la fin du combat nomment le camp", () => {
  assert.equal(ligneDeTour({ numero: 1, camp: "pj" }), "— Tour 1 · camp des PJ —");
  assert.equal(ligneDeTour({ numero: 12, camp: "adv" }), "— Tour 12 · camp des adversaires —");
  assert.equal(ligneDeFinDeTour("pj"), "Fin du tour des PJ : ils retrouvent leurs actions.");
  assert.equal(ligneDeFinDeTour("adv"), "Fin du tour des adversaires : ils retrouvent leurs actions.");
  assert.equal(ligneDeFin("pj"), "Combat terminé : victoire des PJ.");
  assert.equal(ligneDeFin("adv"), "Combat terminé : victoire des adversaires.");
});

test("passer son tour s'écrit avec le nom court, numéro d'exemplaire compris", () => {
  const etat = demonstration();
  assert.equal(ligneDePasse(etat, "pj1"), "Aubépine passe son tour.");
  assert.equal(ligneDePasse(etat, "adv2"), "Chef passe son tour.");
  assert.equal(ligneDePasse(etat, "adv4"), "Marmiton n° 2 passe son tour.");
});

// ─── L'ouverture ────────────────────────────────────────────────────────────

test("une capacité qui évolue porte sa puissance entre crochets, les autres rien", () => {
  const etat = duel();
  const pas = indice(etat, "pj1", "Pas chassé");
  assert.equal(ecrireOuverture(etat, gesteEssai({ mode: "deplacement", capacite: pas, facon: 0, depart: "A1", arrivee: "B2" })), "Aubépine : Pas chassé [1], A1 → B2.");
  assert.equal(
    ecrireOuverture(etat, gesteEssai({ mode: "deplacement", capacite: pas, facon: 1, prix: prix({ souffle: 1 }), depart: "A1", arrivee: "C3" })),
    "Aubépine : Pas chassé [2] (1 souffle), A1 → C3.",
  );
  assert.equal(ecrireOuverture(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2" })), "Aubépine : Frappe contre Marmiton.");
});

test("le coût payé s'écrit entre parenthèses, souffle puis lien, et seulement s'il n'est pas nul", () => {
  const etat = duel({
    pj: (valeurs) => {
      valeurs.capacites.push(
        capaciteEssai({ nom: "Coup de chalumeau", facons: [faconEssai({ cout: { souffle: 10, lien: 0 }, elements: ["Intervention"], intervention: true })] }),
      );
    },
  });
  const sansJet = (nom, champs) => gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", nom), ...champs });

  assert.equal(ecrireOuverture(etat, sansJet("Coup de chalumeau", { prix: prix({ souffle: 10 }) })), "Aubépine : Coup de chalumeau (10 souffle).");
  assert.equal(ecrireOuverture(etat, sansJet("Flambage", { prix: prix({ souffle: 5 }) })), "Aubépine : Flambage [1] (5 souffle).");
  assert.equal(ecrireOuverture(etat, sansJet("Fournaise", { prix: prix({ lien: 2, jauge: 0 }) })), "Aubépine : Fournaise [1] (2 lien).");
  assert.equal(ecrireOuverture(etat, sansJet("Fournaise", { prix: prix({ souffle: 5, lien: 1, jauge: 0 }) })), "Aubépine : Fournaise [1] (5 souffle, 1 lien).");
  assert.equal(ecrireOuverture(etat, sansJet("Coup de chalumeau")), "Aubépine : Coup de chalumeau.", "un coût nul ne laisse pas de parenthèse");
  // C'est le prix payé qui s'écrit, non le coût de la banque : la part X d'un
  // coût, ou un lien qu'un adversaire ne paie pas, n'y sont pas les mêmes.
  assert.equal(ecrireOuverture(etat, sansJet("Pas de côté", { prix: prix({ souffle: 3 }) })), "Aubépine : Pas de côté (3 souffle).");
  assert.equal(ecrireOuverture(etat, sansJet("Flambage", { moment: "preparation", paye: false, prix: null })), "Aubépine : Flambage [1].", "rien n'est payé avant le premier dé");
});

// Un adversaire à deux armes, comme le Homard de la démonstration : sa Frappe
// vient de l'une ou de l'autre, et une capacité sans jet peut emprunter le jet
// de l'une d'elles.
const homard = (valeurs) => {
  valeurs.nom = "Homard furieux";
  valeurs.armes.push({ nom: "Pinces de homard", libelle: "Pinces de homard", poids: null, faces: null, caracteristiques: null, degats: [4, 8, 12], portee: 0, locMultiple: 1, mainsNues: false });
  valeurs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Pinces de homard", cout: { souffle: 2, lien: 0 }, attaque: true, degats: [4, 8, 12] }));
  valeurs.capacites.push(capaciteEssai({ nom: "Dressage minute", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ cout: { souffle: 2, lien: 0 } })] }));
};

test("l'arme s'écrit en tête de la parenthèse quand plusieurs armes donnent la capacité, et alors seulement", () => {
  const etat = duel({ adv: homard });
  const frappe = indice(etat, "adv2", "Frappe");
  assert.equal(
    ecrireOuverture(etat, gesteEssai({ acteur: "adv2", capacite: frappe, facon: 1, prix: prix({ souffle: 2 }), cible: "pj1" })),
    "Homard : Frappe (Pinces de homard, 2 souffle) contre Aubépine.",
  );
  assert.equal(ecrireOuverture(etat, gesteEssai({ acteur: "adv2", capacite: frappe, facon: 0, cible: "pj1" })), "Homard : Frappe (Spatule souple) contre Aubépine.");
  assert.equal(
    ecrireOuverture(etat, gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Moulinet farineux"), prix: prix({ souffle: 5 }), cible: "pj1" })),
    "Homard : Moulinet farineux [1] (5 souffle) contre Aubépine.",
    "une seule arme la donne : elle ne se nomme pas",
  );
});

test("deux armes de même nom se distinguent par leur libellé", () => {
  const etat = duel({
    adv: (valeurs) => {
      valeurs.armes.push({ ...valeurs.armes[0], libelle: "Spatule souple (2)" });
      valeurs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Spatule souple (2)", attaque: true, degats: [5, 10, 15] }));
    },
  });
  const frappe = (facon) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), facon, cible: "pj1" });
  assert.equal(ecrireOuverture(etat, frappe(0)), "Marmiton : Frappe (Spatule souple) contre Aubépine.");
  assert.equal(ecrireOuverture(etat, frappe(1)), "Marmiton : Frappe (Spatule souple (2)) contre Aubépine.");
});

test("le jet prêté d'un adversaire à plusieurs armes nomme l'arme prêtée ; ni celui d'un adversaire à une arme, ni celui d'un PJ", () => {
  const aDeuxArmes = duel({ adv: homard });
  const dressage = (etat, champs) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Dressage minute"), prix: prix({ souffle: 2 }), cible: "pj1", ...champs });
  assert.equal(
    ecrireOuverture(aDeuxArmes, dressage(aDeuxArmes, { mode: "jet_prete", armePretee: 1 })),
    "Homard : Dressage minute (Pinces de homard, 2 souffle) contre Aubépine.",
  );
  assert.equal(
    ecrireOuverture(aDeuxArmes, dressage(aDeuxArmes, { mode: "jet_prete", armePretee: 0 })),
    "Homard : Dressage minute (Spatule souple, 2 souffle) contre Aubépine.",
  );
  assert.equal(ecrireOuverture(aDeuxArmes, dressage(aDeuxArmes, { mode: "sans_jet" })), "Homard : Dressage minute (2 souffle) contre Aubépine.", "sans jet prêté, aucune arme");

  const aUneArme = duel({
    adv: (valeurs) => {
      valeurs.capacites.push(capaciteEssai({ nom: "Dressage minute", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ cout: { souffle: 2, lien: 0 } })] }));
    },
  });
  assert.equal(ecrireOuverture(aUneArme, dressage(aUneArme, { mode: "jet_prete", armePretee: 0 })), "Marmiton : Dressage minute (2 souffle) contre Aubépine.");

  // Une capacité que ses deux armes donnent, et qui emprunte le jet de l'une :
  // l'arme qui la donne, puis celle qui prête son jet si c'en est une autre.
  const aDeuxFacons = duel({
    adv: (valeurs) => {
      homard(valeurs);
      valeurs.capacites.push(
        capaciteEssai({
          nom: "Se couvrir",
          groupe: { genre: "arme", titre: "Spatule souple" },
          facons: [
            faconEssai({ arme: 0, libelle: "Spatule souple", elements: ["Intervention"], intervention: true }),
            faconEssai({ arme: 1, libelle: "Pinces de homard", elements: ["Intervention"], intervention: true }),
          ],
        }),
      );
    },
  });
  const couvert = (facon, armePretee) => gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee, capacite: indice(aDeuxFacons, "adv2", "Se couvrir"), facon, cible: "pj1" });
  assert.equal(ecrireOuverture(aDeuxFacons, couvert(1, 1)), "Homard : Se couvrir (Pinces de homard) contre Aubépine.", "la même arme : une seule fois");
  assert.equal(ecrireOuverture(aDeuxFacons, couvert(1, 0)), "Homard : Se couvrir (Pinces de homard, Spatule souple) contre Aubépine.");

  // Un PJ a deux entrées d'armes (l'arme tenue, les mains nues), mais il ne
  // choisit pas celle qui prête son jet : elle ne se nomme pas.
  const etat = duel();
  assert.equal(
    ecrireOuverture(etat, gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(etat, "pj1", "Fournaise"), prix: prix({ souffle: 1, lien: 1, jauge: 0 }), cible: "adv2" })),
    "Aubépine : Fournaise [1] (1 souffle, 1 lien) contre Marmiton.",
  );
});

test("le coût en lien qu'un adversaire ne paie pas se dit après le coût, derrière un point-virgule", () => {
  const etat = duel({ adv: homard });
  const moulinet = (champs) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Moulinet farineux"), cible: "pj1", ...champs });
  assert.equal(
    ecrireOuverture(etat, moulinet({ prix: prix({ souffle: 5, lienNonPaye: 1 }) })),
    "Homard : Moulinet farineux [1] (5 souffle ; coût en lien non payé : un adversaire n'a pas de lien) contre Aubépine.",
  );
  assert.equal(
    ecrireOuverture(etat, moulinet({ prix: prix({ lienNonPaye: 2 }) })),
    "Homard : Moulinet farineux [1] (coût en lien non payé : un adversaire n'a pas de lien) contre Aubépine.",
    "seul dans la parenthèse, sans point-virgule",
  );
  assert.equal(
    ecrireOuverture(etat, gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), facon: 1, prix: prix({ souffle: 2, lienNonPaye: 1 }), cible: "pj1" })),
    "Homard : Frappe (Pinces de homard, 2 souffle ; coût en lien non payé : un adversaire n'a pas de lien) contre Aubépine.",
  );
  assert.equal(ecrireOuverture(etat, moulinet({ prix: prix({ souffle: 5 }) })), "Homard : Moulinet farineux [1] (5 souffle) contre Aubépine.", "payé ou sans lien : rien de plus");
});

test("la cible : « contre » l'autre camp, « sur » un allié ou sur soi, rien sans cible", () => {
  const etat = etatDe([{ photo: pjEssai() }, { photo: brioche() }, { photo: marmitonDeCorveeEssai() }, { photo: marmitonDeCorveeEssai() }]);
  const flambage = (cible) => gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), prix: prix({ souffle: 5 }), cible });
  assert.equal(ecrireOuverture(etat, flambage("adv3")), "Aubépine : Flambage [1] (5 souffle) contre Marmiton n° 1.");
  assert.equal(ecrireOuverture(etat, flambage("pj2")), "Aubépine : Flambage [1] (5 souffle) sur Brioche.");
  assert.equal(ecrireOuverture(etat, flambage("pj1")), "Aubépine : Flambage [1] (5 souffle) sur Aubépine.");
  assert.equal(ecrireOuverture(etat, flambage(null)), "Aubépine : Flambage [1] (5 souffle).");

  const moulinet = (cible) => gesteEssai({ acteur: "adv3", capacite: indice(etat, "adv3", "Moulinet farineux"), prix: prix({ souffle: 5 }), cible });
  assert.equal(ecrireOuverture(etat, moulinet("pj2")), "Marmiton n° 1 : Moulinet farineux [1] (5 souffle) contre Brioche.");
  assert.equal(ecrireOuverture(etat, moulinet("adv4")), "Marmiton n° 1 : Moulinet farineux [1] (5 souffle) sur Marmiton n° 2.", "un adversaire a ses alliés, lui aussi");
});

// ─── Les sources ────────────────────────────────────────────────────────────

test("une source se nomme selon son genre, et dit de qui elle vient quand c'est de l'autre", () => {
  assert.equal(ecrireSource(SOLO), "Solo du chef");
  assert.equal(ecrireSource(horsMaitrise("Émincer")), "Émincer hors maîtrise");
  assert.equal(ecrireSource(MELES), "types d'armure mêlés");
  assert.equal(ecrireSource(mainAvantageuse(1, "Minutie")), "à la main : Minutie");
  assert.equal(ecrireSource(horsMaitrise("Moulinet farineux", "Marmiton n° 2")), "Moulinet farineux hors maîtrise de Marmiton n° 2");
  assert.equal(ecrireSource({ ...SOLO, de: "Chef" }), "Solo du chef de Chef");
});

test("la phrase des sources ne s'écrit que si le jet a des avantages et des désavantages", () => {
  const jet = (avantages, desavantages) => ({ avantages, desavantages });
  const emincer = horsMaitrise("Émincer");
  const fumee = mainAvantageuse(1, "Fumée");

  assert.equal(ecrireSources(jet([SOLO], [emincer])), "Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent.");
  assert.equal(
    ecrireSources(jet([SOLO, horsMaitrise("Moulinet farineux", "Marmiton n° 2")], [MELES])),
    "Ses 2 avantages (Solo du chef, Moulinet farineux hors maîtrise de Marmiton n° 2) et son désavantage (types d'armure mêlés) laissent 1 avantage.",
  );
  assert.equal(
    ecrireSources(jet([SOLO], [emincer, fumee])),
    "Son avantage (Solo du chef) et ses 2 désavantages (Émincer hors maîtrise, à la main : Fumée) laissent 1 désavantage.",
  );
  assert.equal(
    ecrireSources(jet([SOLO, mainAvantageuse(1, "Minutie")], [emincer, fumee])),
    "Ses 2 avantages (Solo du chef, à la main : Minutie) et ses 2 désavantages (Émincer hors maîtrise, à la main : Fumée) s'annulent.",
  );
  assert.equal(
    ecrireSources(jet([SOLO, mainAvantageuse(2, "Minutie")], [emincer])),
    "Ses 3 avantages (Solo du chef, à la main : Minutie) et son désavantage (Émincer hors maîtrise) laissent 2 avantages.",
  );
  assert.equal(
    ecrireSources(jet([SOLO], [emincer, mainAvantageuse(2, "Fumée")])),
    "Son avantage (Solo du chef) et ses 3 désavantages (Émincer hors maîtrise, à la main : Fumée) laissent 2 désavantages.",
  );

  assert.equal(ecrireSources(jet([SOLO], [])), null, "des avantages seuls : rien à annuler");
  assert.equal(ecrireSources(jet([], [emincer])), null, "des désavantages seuls");
  assert.equal(ecrireSources(jet([], [])), null);
});

test("un passif de niveau 2 se cite une fois et compte deux fois", () => {
  const solo2 = { ...SOLO, nombre: 2 };
  assert.equal(
    ecrireSources({ avantages: [solo2], desavantages: [MELES] }),
    "Ses 2 avantages (Solo du chef) et son désavantage (types d'armure mêlés) laissent 1 avantage.",
  );
  assert.equal(ecrireSources({ avantages: [SOLO], desavantages: [MELES] }), "Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent.");
});

// ─── Le dé et la chaîne ─────────────────────────────────────────────────────

test("le dé porte la somme nette de ses modificateurs, main comprise, et rien quand elle est nulle", () => {
  const de = (modificateurs, faces = 10) => ecrireDe({ faces, modificateurs });
  assert.equal(de([]), "d10");
  assert.equal(de([VIF]), "d10+1");
  assert.equal(de([ecart(-1)], 8), "d8−1");
  assert.equal(de([VIF, ecart(-1)]), "d10", "un bonus et un écart s'effacent");
  assert.equal(de([VIF, aLaMain(1, "Minutie")], 8), "d8+2");
  assert.equal(de([VIF, ecart(-2), aLaMain(-2, "Fumée")], 12), "d12−3");
  assert.equal(de([ecart(-1)], 8).codePointAt(2), 0x2212, "le moins du journal n'est pas le trait d'union");
});

test("un dé de la chaîne : sa valeur modificateur compris, puis ✓ ou ✗", () => {
  const jet = chaineFinie({ genre: "attaque", faces: 10, difficulte: 5, modificateurs: [VIF] }, [6], [8], [2]);
  assert.deepEqual(jet.places.map((place) => ecrirePlace(jet, place)), ["7 ✓", "9 ✓", "3 ✗"]);

  const juste = chaineFinie({ genre: "attaque", faces: 10, difficulte: 5 }, [5], [4]);
  assert.deepEqual(juste.places.map((place) => ecrirePlace(juste, place)), ["5 ✓", "4 ✗"], "la difficulté égalée est une réussite, un point dessous un échec");
});

test("une relance : le dé qui échoue, puis « relancé » et celui qui le remplace", () => {
  const jet = chaine({ genre: "attaque", faces: 10, difficulte: 5, avantages: [{ ...SOLO, nombre: 2 }] }, [4], "relancer", [7], [3], "relancer", [2]);
  assert.deepEqual(jet.places.map((place) => ecrirePlace(jet, place)), ["4 ✗, relancé 7 ✓", "3 ✗, relancé 2 ✗"]);

  const deuxFois = chaine({ genre: "attaque", faces: 10, difficulte: 5, avantages: [{ ...SOLO, nombre: 2 }] }, [4], "relancer", [3], "relancer", [7]);
  assert.equal(ecrirePlace(deuxFois, deuxFois.places[0]), "4 ✗, relancé 3 ✗, relancé 7 ✓");

  const garde = chaineFinie({ genre: "attaque", faces: 10, difficulte: 5, avantages: [SOLO] }, [9], [4], "garder");
  assert.equal(ecrirePlace(garde, garde.places[1]), "4 ✗", "une relance refusée ne laisse pas de trace");
});

test("un dé à désavantage : ses lancers dans l'ordre où ils tombent, modificateur compris, puis le pire", () => {
  const jet = chaineFinie({ genre: "attaque", faces: 10, difficulte: 5, modificateurs: [VIF], desavantages: [horsMaitrise("Émincer")] }, [7, 3]);
  assert.equal(ecrirePlace(jet, jet.places[0]), "8/4 → 4 ✗");

  const reussi = chaine({ genre: "attaque", faces: 10, difficulte: 5, modificateurs: [VIF], desavantages: [horsMaitrise("Émincer")] }, [6, 9]);
  assert.equal(ecrirePlace(reussi, reussi.places[0]), "7/10 → 7 ✓");

  const double = chaineFinie({ genre: "attaque", faces: 10, difficulte: 6, desavantages: [horsMaitrise("Émincer"), mainAvantageuse(1, "Fumée")] }, [9, 5, 7]);
  assert.equal(ecrirePlace(double, double.places[0]), "9/5/7 → 5 ✗", "deux désavantages : trois lancers");
});

test("une explosion : la première valeur modificateur compris, chaque ajout brut, puis la somme", () => {
  const une = chaine({ genre: "caracteristique", faces: 6, difficulte: 8, modificateurs: [VIF] }, [6], "exploser", [3]);
  assert.equal(ecrirePlace(une, une.places[0]), "7 explose, + 3 = 10 ✓");

  const enchainee = chaine({ genre: "caracteristique", faces: 6, difficulte: 15, modificateurs: [VIF] }, [6], "exploser", [6], "exploser", [2]);
  assert.equal(ecrirePlace(enchainee, enchainee.places[0]), "7 explose, + 6 explose, + 2 = 15 ✓");

  const ratee = chaineFinie({ genre: "caracteristique", faces: 6, difficulte: 12 }, [6], "exploser", [3]);
  assert.equal(ecrirePlace(ratee, ratee.places[0]), "6 explose, + 3 = 9 ✗", "une explosion peut ne pas suffire");

  const sousDesavantage = chaine({ genre: "caracteristique", faces: 6, difficulte: 8, desavantages: [mainAvantageuse(1, "Fumée")] }, [6, 6], "exploser", [3]);
  assert.equal(ecrirePlace(sousDesavantage, sousDesavantage.places[0]), "6/6 → 6 explose, + 3 = 9 ✓", "seul le dé gardé explose");

  const apresRelance = chaine({ genre: "caracteristique", faces: 6, difficulte: 8, avantages: [mainAvantageuse(1, "Minutie")] }, [4], "relancer", [6], "exploser", [5]);
  assert.equal(ecrirePlace(apresRelance, apresRelance.places[0]), "4 ✗, relancé 6 explose, + 5 = 11 ✓");
});

// Relecture de fin de groupe (lot 4) : un personnage à −2 à chaque dé (au lot
// 4, deux blessures ; depuis le lot 4.3, un ±N de la palette), sans bonus, qui
// tire 1. Ni le combat de référence ni les gabarits ci-dessus n'avaient de dé
// sous zéro, et le nombre s'écrivait avec le trait d'union.
const TRAIT_D_UNION = String.fromCodePoint(0x2d);
const sansTraitDUnion = (texte) => assert.ok(!texte.includes(TRAIT_D_UNION), `« ${texte} » porte un trait d'union`);

test("une valeur de dé passée sous zéro porte le moins du journal : le dé seul, la relance, les lancers d'un désavantage et le pire, l'explosion et sa somme", () => {
  const blesse = (champs = {}) => ({ genre: "attaque", faces: 8, difficulte: 5, modificateurs: [ecart(-2)], ...champs });
  const places = (jet) => jet.places.map((place) => ecrirePlace(jet, place));

  const seul = chaineFinie(blesse(), [1]);
  assert.deepEqual(places(seul), ["−1 ✗"]);
  assert.equal(places(seul)[0].codePointAt(0), 0x2212, "le moins du modificateur, pas le trait d'union");
  assert.deepEqual(places(chaineFinie(blesse(), [2])), ["0 ✗"], "zéro ne porte aucun signe");
  assert.deepEqual(places(chaineFinie(blesse(), [3])), ["1 ✗"], "ni une valeur restée positive");

  const relance = chaine(blesse({ avantages: [SOLO] }), [5], "relancer", [1]);
  assert.deepEqual(places(relance), ["3 ✗, relancé −1 ✗"]);

  const desavantage = chaineFinie(blesse({ desavantages: [horsMaitrise("Émincer")] }), [2, 1]);
  assert.deepEqual(places(desavantage), ["0/−1 → −1 ✗"]);
  const trois = chaineFinie(blesse({ modificateurs: [ecart(-2), aLaMain(-3, "Fumée")], desavantages: [horsMaitrise("Émincer"), MELES] }), [8, 1, 6]);
  assert.deepEqual(places(trois), ["3/−4/1 → −4 ✗"], "chaque lancer porte son signe, et le pire gardé aussi");

  // Un d6 à −8 : sa face maximale vaut −2, sous la difficulté ; il explose.
  const accable = { genre: "caracteristique", faces: 6, difficulte: 6, modificateurs: [ecart(-6), aLaMain(-2, "Fumée")] };
  const ratee = chaineFinie(accable, [6], "exploser", [1]);
  assert.deepEqual(places(ratee), ["−2 explose, + 1 = −1 ✗"], "la première valeur et la somme ; l'ajout, brut, n'a pas de signe");
  const enchainee = chaineFinie(accable, [6], "exploser", [6], "exploser", [6], [1]);
  assert.deepEqual(places(enchainee), ["−2 explose, + 6 explose, + 6 = 10 ✓", "−7 ✗"]);

  for (const texte of [seul, relance, desavantage, trois, ratee, enchainee].flatMap(places)) sansTraitDUnion(texte);
  sansTraitDUnion("−1 ✗");
  assert.throws(() => sansTraitDUnion(`${TRAIT_D_UNION}1 ✗`), "le témoin voit un trait d'union");
});

// ─── La phrase du jet ───────────────────────────────────────────────────────

// Les jets du duel : le couteau d'Aubépine est un d8, la défense du Marmiton
// vaut 5, son attaque 4.
const attaqueDuPj = (champs = {}) => ({ genre: "attaque", lanceur: "pj1", faces: 8, mobilisees: ["precision", "agilite"], difficulte: 5, ...champs });
const defenseDuPj = (champs = {}) => ({ genre: "defense", lanceur: "pj1", faces: 8, mobilisees: ["agilite", "creativite"], difficulte: 4, ...champs });

test("la phrase du jet : le dé, la difficulté, les dés, le bilan", () => {
  const etat = duel();
  const frappe = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE });
  assert.equal(ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ modificateurs: [VIF] }), [6], [8], [2]))), "d8+1 contre 5 → 7 ✓, 9 ✓, 3 ✗ : 2 réussites, B = 10.");
  assert.equal(ecrireJet(etat, frappe(chaineFinie(attaqueDuPj(), [3]))), "d8 contre 5 → 3 ✗ : aucune réussite, manqué.");
});

test("le modificateur à la main se dit après la difficulté, avec son signe et sa raison", () => {
  const etat = duel();
  const frappe = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE });
  assert.equal(
    ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ modificateurs: [VIF, aLaMain(1, "Minutie")] }), [6], [2]))),
    "d8+2 contre 5 (+1 à la main : Minutie) → 8 ✓, 4 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(
    ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ modificateurs: [aLaMain(-2, "Fumée")] }), [8], [6]))),
    "d8−2 contre 5 (−2 à la main : Fumée) → 6 ✓, 4 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ modificateurs: [VIF] }), [6], [2]))), "d8+1 contre 5 → 7 ✓, 3 ✗ : 1 réussite, A = 5.", "un passif ne se nomme pas");
});

test("le reste net d'avantages ou de désavantages suit la difficulté, sans nommer sa source", () => {
  const etat = duel();
  const frappe = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE });
  assert.equal(
    ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ avantages: [SOLO] }), [7], [2], "garder"))),
    "d8 contre 5, 1 avantage → 7 ✓, 2 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(
    ecrireJet(etat, frappe(chaineFinie(attaqueDuPj({ desavantages: [horsMaitrise("Émincer"), { ...SOLO, de: "Marmiton" }] }), [7, 6, 5], [8, 2, 6]))),
    "d8 contre 5, 2 désavantages → 7/6/5 → 5 ✓, 8/2/6 → 2 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(ecrireJet(etat, frappe(chaineFinie(attaqueDuPj(), [7], [2]))), "d8 contre 5 → 7 ✓, 2 ✗ : 1 réussite, A = 5.", "net nul : rien");
});

test("la main seule s'y nomme : en entier si tout le net vient d'elle, pour sa part sinon, et pas deux fois", () => {
  const etat = duel();
  const frappe = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE });
  const phrase = (circonstances, ...pas) => ecrireJet(etat, frappe(chaineFinie(attaqueDuPj(circonstances), ...pas)));

  assert.equal(phrase({ avantages: [mainAvantageuse(1, "Minutie")] }, [7], [2], "garder"), "d8 contre 5, 1 avantage (à la main : Minutie) → 7 ✓, 2 ✗ : 1 réussite, A = 5.");
  assert.equal(
    phrase({ desavantages: [mainAvantageuse(2, "Fumée")] }, [7, 6, 5], [8, 2, 6]),
    "d8 contre 5, 2 désavantages (à la main : Fumée) → 7/6/5 → 5 ✓, 8/2/6 → 2 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(
    phrase({ avantages: [SOLO, mainAvantageuse(1, "Minutie")] }, [7], [2], "garder"),
    "d8 contre 5, 2 avantages (dont 1 à la main : Minutie) → 7 ✓, 2 ✗ : 1 réussite, A = 5.",
  );
  assert.equal(
    phrase({ desavantages: [horsMaitrise("Émincer"), mainAvantageuse(2, "Minutie")] }, [7, 6, 5, 8], [8, 2, 6, 3]),
    "d8 contre 5, 3 désavantages (dont 2 à la main : Minutie) → 7/6/5/8 → 5 ✓, 8/2/6/3 → 2 ✗ : 1 réussite, A = 5.",
  );

  // La phrase des sources a déjà nommé la main : le net ne la redit pas.
  const mele = chaineFinie(attaqueDuPj({ avantages: [SOLO, mainAvantageuse(1, "Minutie")], desavantages: [horsMaitrise("Émincer")] }), [7], [2], "garder");
  assert.equal(ecrireSources(mele), "Ses 2 avantages (Solo du chef, à la main : Minutie) et son désavantage (Émincer hors maîtrise) laissent 1 avantage.");
  assert.equal(ecrireJet(etat, frappe(mele)), "d8 contre 5, 1 avantage → 7 ✓, 2 ✗ : 1 réussite, A = 5.");
});

test("en défense, c'est le PJ visé qui lance, et la phrase le dit", () => {
  const etat = duel();
  const frappe = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj({ modificateurs: [VIF] }), [7], [2]), degats: LETTRE });
  assert.equal(ecrireJet(etat, frappe), "Aubépine lance sa défense, d8+1 contre 4 → 8 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10.");
});

test("le jet de caractéristique : la capacité, le dé, ses caractéristiques, la difficulté et son libellé", () => {
  const etat = duel();
  const gouter = (circonstances, ...pas) =>
    gesteEssai({
      mode: "caracteristique",
      capacite: indice(etat, "pj1", "Goûter"),
      caracteristiques: circonstances.caracteristiques,
      difficulte: circonstances.difficulte,
      jet: chaineFinie({ genre: "caracteristique", lanceur: "pj1", faces: 8, mobilisees: circonstances.caracteristiques, libelle: DIFFICULTES[circonstances.difficulte], ...circonstances }, ...pas),
    });

  const unSucces = gouter({ caracteristiques: ["parole", "sens"], difficulte: 6 }, [7], [4]);
  assert.equal(ligneDuGeste(etat, unSucces), "Aubépine : Goûter, d8 (Parole + Sens) contre 6 (compliqué) → 7 ✓, 4 ✗ : 1 réussite.");
  assert.deepEqual(segmentsDuGeste(etat, unSucces), ["Aubépine : Goûter, d8 (Parole + Sens) contre 6 (compliqué) → 7 ✓, 4 ✗ : 1 réussite."], "une seule phrase");
  assert.equal(ligneDuGeste(etat, gouter({ caracteristiques: ["parole", "sens"], difficulte: 6 }, [4])), "Aubépine : Goûter, d8 (Parole + Sens) contre 6 (compliqué) → 4 ✗ : aucune réussite.");
  assert.equal(
    ligneDuGeste(etat, gouter({ caracteristiques: ["sens"], difficulte: 4 }, [5], [6], [7])),
    `Aubépine : Goûter, d8 (Sens) contre 4 (${DIFFICULTES[4]}) → 5 ✓, 6 ✓, 7 ✓ : 3 réussites.`,
    "une seule caractéristique, et le libellé que les règles donnent à la difficulté",
  );
  // L'ordre des parenthèses après la difficulté : le libellé, puis le réglage
  // à la main.
  assert.equal(
    ligneDuGeste(etat, gouter({ caracteristiques: ["parole", "sens"], difficulte: 6, modificateurs: [VIF, aLaMain(1, "Minutie")] }, [5], [3])),
    "Aubépine : Goûter, d8+2 (Parole + Sens) contre 6 (compliqué, +1 à la main : Minutie) → 7 ✓, 5 ✗ : 1 réussite.",
  );
  assert.equal(
    ligneDuGeste(etat, gouter({ caracteristiques: ["parole", "sens"], difficulte: 6, avantages: [mainAvantageuse(1, "Minutie")] }, [7], [4], "garder")),
    "Aubépine : Goûter, d8 (Parole + Sens) contre 6 (compliqué), 1 avantage (à la main : Minutie) → 7 ✓, 4 ✗ : 1 réussite.",
  );
});

test("la ligne d'un jet au dé négatif : le modificateur et la valeur portent le même moins, et aucun trait d'union ne s'y glisse", () => {
  const etat = duel();
  const sens = ["savoir_sauvage", "sens"];
  const gouter = gesteEssai({
    mode: "caracteristique",
    capacite: indice(etat, "pj1", "Goûter"),
    caracteristiques: sens,
    difficulte: 6,
    jet: chaineFinie({ genre: "caracteristique", lanceur: "pj1", faces: 6, caracteristiques: sens, mobilisees: sens, difficulte: 6, libelle: DIFFICULTES[6], modificateurs: [ecart(-2)] }, [1]),
  });
  const ligne = ligneDuGeste(etat, gouter);
  assert.equal(ligne, "Aubépine : Goûter, d6−2 (Savoir sauvage + Sens) contre 6 (compliqué) → −1 ✗ : aucune réussite.");
  assert.equal([...ligne].filter((signe) => signe === SIGNES.moins).length, 2, "le modificateur et la valeur");
  sansTraitDUnion(ligne);

  // En défense, sous un désavantage : une attaque sur un personnage à −2 à chaque dé de défense.
  const frappe = gesteEssai({
    acteur: "adv2",
    capacite: indice(etat, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(defenseDuPj({ modificateurs: [ecart(-2)], desavantages: [MELES] }), [2, 1]),
    degats: LETTRE,
    localisation: [d20(5)],
    resultat: resultat([coup(zone(etat, "pj1", "torse"), { resistance: [5, 0], blessures: 1 })]),
  });
  const recue = ligneDuGeste(etat, frappe);
  assert.equal(
    recue,
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8−2 contre 4, 1 désavantage → 0/−1 → −1 ✗ : aucune réussite, Aubépine reçoit C = 15. Localisation d20 → 5 : torse. Endurance 5 → 0.",
  );
  sansTraitDUnion(recue);
});

test("les caractéristiques d'un dé au choix s'écrivent dans l'ordre des neuf, celui où le jet les garde", () => {
  const etat = duel();
  const ordre = CARACTERISTIQUES.map((caracteristique) => caracteristique.code);
  const taloche = (caracteristiques) =>
    gesteEssai({
      capacite: indice(etat, "pj1", "Taloche"),
      cible: "adv2",
      caracteristiques,
      jet: chaineFinie(attaqueDuPj({ caracteristiques, mobilisees: caracteristiques, modificateurs: [VIF] }), [7], [2]),
      degats: LETTRE,
    });

  for (const [codes, noms] of [
    [["force", "agilite"], "Force + Agilité"],
    [["force", "precision"], "Force + Précision"],
    [["parole", "sens"], "Parole + Sens"],
    [["savoir_sauvage", "sens"], "Savoir sauvage + Sens"],
    [["culture_neruvienne", "creativite"], "Culture néruvienne + Créativité"],
  ]) {
    assert.deepEqual(codes, [...codes].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)), "le témoin est dans l'ordre des neuf");
    assert.equal(ecrireJet(etat, taloche(codes)), `d8+1 (${noms}) contre 5 → 8 ✓, 3 ✗ : 1 réussite, A = 2.`);
  }
  assert.equal(
    ligneDuGeste(etat, taloche(["force", "precision"])),
    "Aubépine : Taloche [1] contre Marmiton. d8+1 (Force + Précision) contre 5 → 8 ✓, 3 ✗ : 1 réussite, A = 2.",
    "l'attaque à mains nues",
  );
  // Le journal ne range rien : c'est le moteur qui pose la liste dans l'ordre
  // des neuf. Une arme au dé fixe ne les écrit pas.
  assert.equal(ecrireJet(etat, taloche(["agilite", "force"])), "d8+1 (Agilité + Force) contre 5 → 8 ✓, 3 ✗ : 1 réussite, A = 2.");
  const frappe = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [7], [2]), degats: LETTRE });
  assert.equal(ecrireJet(etat, frappe), "d8 contre 5 → 7 ✓, 2 ✗ : 1 réussite, A = 5.");
});

// ─── Le bilan ───────────────────────────────────────────────────────────────

test("le bilan d'une attaque d'un PJ : ses réussites, la lettre et ses dégâts ; ou manqué", () => {
  const etat = duel();
  const frappe = (...pas) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), ...pas), degats: LETTRE });
  assert.equal(ecrireBilan(etat, frappe([6], [2])), "1 réussite, A = 5");
  assert.equal(ecrireBilan(etat, frappe([6], [7], [1])), "2 réussites, B = 10");
  assert.equal(ecrireBilan(etat, frappe([6], [7], [8])), "3 réussites, C = 15");
  assert.equal(ecrireBilan(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [2]) })), "aucune réussite, manqué");
  // Tant que les dégâts ne sont pas fixés, ce sont ceux de la base par défaut.
  assert.equal(ecrireBilan(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet: chaine(attaqueDuPj(), [6]) })), "1 réussite, A = 5");
});

test("le bilan d'une capacité sans dégâts : touché ; avec les dégâts de l'arme : la lettre de l'arme", () => {
  const etat = duel();
  const fournaise = (degats, ...pas) =>
    gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(etat, "pj1", "Fournaise"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), ...pas), degats });
  assert.equal(ecrireBilan(etat, fournaise(AUCUN, [6], [2])), "1 réussite, touché");
  assert.equal(ecrireBilan(etat, fournaise(AUCUN, [6], [7], [8])), "3 réussites, touché");
  assert.equal(ecrireBilan(etat, fournaise(ARME, [6], [7], [1])), "2 réussites, touché, dégâts de l'arme : B = 10");
  assert.equal(ecrireBilan(etat, fournaise(null, [2])), "aucune réussite, manqué");
  assert.equal(ecrireBilan(etat, fournaise(ajuste("aucun", 6, "Fournaise"), [6], [2])), "1 réussite, touché, ajusté à 6 (Fournaise)", "un nombre saisi sur « Sans dégâts »");

  // Une attaque dont les dégâts ne se lisent pas s'écrit comme un jet prêté
  // « Sans dégâts », quel que soit son mode.
  const illisible = duel({
    pj: (valeurs) => {
      valeurs.capacites[0].facons[0].degats = null;
    },
  });
  const frappe = gesteEssai({ capacite: indice(illisible, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: AUCUN });
  assert.equal(ecrireBilan(illisible, frappe), "1 réussite, touché");
});

test("le bilan d'une défense : ce que reçoit le PJ, d'autant moins qu'il réussit ; rien à trois réussites", () => {
  const etat = duel();
  const frappe = (...pas) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), ...pas), degats: LETTRE });
  assert.equal(ecrireBilan(etat, frappe([3])), "aucune réussite, Aubépine reçoit C = 15");
  assert.equal(ecrireBilan(etat, frappe([6], [3])), "1 réussite, Aubépine reçoit B = 10");
  assert.equal(ecrireBilan(etat, frappe([6], [7], [3])), "2 réussites, Aubépine reçoit A = 5");
  assert.equal(
    ecrireBilan(etat, gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), [6], [7], [8]) })),
    "3 réussites, aucun dégât",
  );
});

// Un adversaire sans arme, comme la Mouette de la démonstration : sa Frappe
// n'est pas une attaque, elle emprunte un jet « sans arme », et ses dégâts se
// saisissent à la main.
const mouette = (valeurs) => {
  valeurs.nom = "Mouette chapardeuse";
  valeurs.armes = [];
  valeurs.capacites = [capaciteEssai({ nom: "Frappe", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de bec." })] })];
};

test("le bilan d'une défense contre une attaque sans arme : le nombre saisi, et sa raison", () => {
  const etat = duel({ adv: mouette });
  const frappe = (degats, ...pas) =>
    gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee: null, capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), ...pas), degats });

  assert.equal(ecrireBilan(etat, frappe(ajuste("aucun", 4, "Frappe"), [6], [3])), "1 réussite, Aubépine reçoit 4 (à la main : Frappe)");
  assert.equal(ecrireBilan(etat, frappe(ajuste("aucun", 4, "Frappe"), [3])), "aucune réussite, Aubépine reçoit 4 (à la main : Frappe)");
  assert.equal(ecrireBilan(etat, frappe(AUCUN, [6], [3])), "1 réussite, touché", "sans nombre saisi");
  assert.equal(ecrireBilan(etat, frappe(AUCUN, [3])), "aucune réussite, touché");
  assert.equal(ecrireBilan(etat, frappe(null, [6], [7], [8])), "3 réussites, aucun dégât");
  // Des dégâts directs ne sont pas « reçus » comme les autres : ils se disent
  // à part, avec leur destination.
  assert.equal(
    ecrireBilan(etat, frappe(ajuste("aucun", 4, "Frappe", "resistance"), [6], [3])),
    "1 réussite, touché, dégâts directs à l'endurance : 4 (Frappe)",
  );

  assert.equal(
    ligneDuGeste(
      etat,
      gesteEssai({
        acteur: "adv2",
        mode: "jet_prete",
        capacite: indice(etat, "adv2", "Frappe"),
        cible: "pj1",
        jet: chaineFinie(defenseDuPj(), [6], [3]),
        degats: ajuste("aucun", 4, "Frappe"),
        localisation: [d20(5)],
        resultat: resultat([coup(zone(etat, "pj1", "torse"), { armure: [10, 6] })]),
      }),
    ),
    "Mouette : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit 4 (à la main : Frappe). Localisation d20 → 5 : torse. Armure 10 → 6.",
  );
});

test("le bilan d'une défense contre un jet prêté joué avec les dégâts de l'arme", () => {
  const etat = duel({
    adv: (valeurs) => {
      valeurs.capacites.push(capaciteEssai({ nom: "Dressage minute", groupe: { genre: "capacites", titre: "Capacités" } }));
    },
  });
  const dressage = (degats, ...pas) =>
    gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee: 0, capacite: indice(etat, "adv2", "Dressage minute"), cible: "pj1", jet: chaineFinie(defenseDuPj(), ...pas), degats });
  assert.equal(ecrireBilan(etat, dressage(ARME, [6], [3])), "1 réussite, touché, dégâts de l'arme : B = 10");
  assert.equal(ecrireBilan(etat, dressage(ARME, [3])), "aucune réussite, touché, dégâts de l'arme : C = 15");
  assert.equal(ecrireBilan(etat, dressage(AUCUN, [6], [3])), "1 réussite, touché");
});

test("les deux nombres du bilan : après la lettre, ses dégâts ; après « ajusté à » et « reçoit », le nombre saisi", () => {
  const etat = demonstration();
  const emincer = gesteEssai({
    capacite: indice(etat, "pj1", "Émincer"),
    prix: prix({ souffle: 4 }),
    cible: "adv4",
    jet: chaineFinie({ genre: "attaque", lanceur: "pj1", faces: 10, difficulte: 5, modificateurs: [VIF], avantages: [SOLO], desavantages: [horsMaitrise("Émincer")] }, [6], [8], [2]),
    degats: ajuste("lettre", 22, "Émincer"),
  });
  assert.equal(ecrireBilan(etat, emincer), "2 réussites, B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction)", "B vaut 8, quoi qu'on saisisse");
  assert.equal(ecrireBilan(etat, { ...emincer, degats: LETTRE }), "2 réussites, B = 8, +2 contre l'armure (Réduction)", "sans saisie, rien ne suit la lettre");

  const sansArme = duel({ adv: mouette });
  const frappe = gesteEssai({
    acteur: "adv2",
    mode: "jet_prete",
    capacite: indice(sansArme, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(defenseDuPj(), [6], [3]),
    degats: ajuste("aucun", 4, "Frappe"),
  });
  assert.equal(ecrireBilan(sansArme, frappe), "1 réussite, Aubépine reçoit 4 (à la main : Frappe)", "jamais « reçoit 0 »");

  const enDefense = duel();
  const ajustee = gesteEssai({
    acteur: "adv2",
    capacite: indice(enDefense, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(defenseDuPj(), [6], [3]),
    degats: ajuste("lettre", 22, "Moulinet farineux"),
  });
  assert.equal(ecrireBilan(enDefense, ajustee), "1 réussite, Aubépine reçoit B = 10, ajusté à 22 (Moulinet farineux)");
});

test("des dégâts fixés deux fois : le journal écrit le dernier nombre et sa raison, ceux qui s'appliquent", () => {
  const etat = demonstration();
  const deuxFois = { base: "lettre", operations: [{ op: "ajuster", valeur: 12, raison: "Minutie" }, { op: "ajuster", valeur: 22, raison: "Émincer" }], nature: "normaux" };
  const emincer = gesteEssai({
    capacite: indice(etat, "pj1", "Émincer"),
    prix: prix({ souffle: 4 }),
    cible: "adv4",
    jet: chaineFinie({ genre: "attaque", lanceur: "pj1", faces: 10, difficulte: 5, modificateurs: [VIF], avantages: [SOLO], desavantages: [horsMaitrise("Émincer")] }, [6], [8], [2]),
    degats: deuxFois,
  });
  assert.equal(ecrireBilan(etat, emincer), "2 réussites, B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction)", "le dernier nombre fixé remplace le premier");
});

test("les dégâts directs se disent à la place de « ajusté à », avec leur destination", () => {
  const etat = duel();
  const frappe = (degats) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [7], [1]), degats });
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 3, "Flambage", "resistance"))), "2 réussites, B = 10, dégâts directs à l'endurance : 3 (Flambage)");
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 3, "Flambage", "corps"))), "2 réussites, B = 10, dégâts directs au corps : 3 (Flambage)");
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 3, "Flambage"))), "2 réussites, B = 10, ajusté à 3 (Flambage)", "en dégâts normaux");

  const enDefense = gesteEssai({
    acteur: "adv2",
    capacite: indice(etat, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(defenseDuPj(), [6], [3]),
    degats: ajuste("lettre", 2, "Moulinet farineux", "corps"),
  });
  assert.equal(ecrireBilan(etat, enDefense), "1 réussite, Aubépine reçoit B = 10, dégâts directs au corps : 2 (Moulinet farineux)");
});

test("dégrossir s'écrit quand il s'applique : ses points, et le nom de la capacité qui le porte", () => {
  const reduction = (valeurs) => {
    ajouterPassif(valeurs, { role: "degrossir", niveau: 1, nom: "Réduction" });
  };
  const etat = duel({ pj: reduction });
  const frappe = (degats, ...pas) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), ...pas), degats });
  assert.equal(ecrireBilan(etat, frappe(LETTRE, [6], [2])), "1 réussite, A = 5, +1 contre l'armure (Réduction)");
  assert.equal(ecrireBilan(etat, frappe(LETTRE, [6], [7], [8])), "3 réussites, C = 15, +3 contre l'armure (Réduction)");
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 22, "Émincer"), [6], [7], [1])), "2 réussites, B = 10, ajusté à 22 (Émincer), +2 contre l'armure (Réduction)");

  // Il ne s'écrit pas là où il ne s'applique pas.
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 0, "Émincer"), [6], [2])), "1 réussite, A = 5, ajusté à 0 (Émincer)", "des dégâts ramenés à 0");
  assert.equal(ecrireBilan(etat, frappe(ajuste("lettre", 3, "Flambage", "corps"), [6], [2])), "1 réussite, A = 5, dégâts directs au corps : 3 (Flambage)", "des dégâts directs");
  const fournaise = gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(etat, "pj1", "Fournaise"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: AUCUN });
  assert.equal(ecrireBilan(etat, fournaise), "1 réussite, touché", "« Sans dégâts »");
  assert.equal(ecrireBilan(etat, { ...fournaise, degats: ARME }), "1 réussite, touché, dégâts de l'arme : A = 5, +1 contre l'armure (Réduction)", "« Dégâts de l'arme »");

  const sans = duel();
  const sansPassif = gesteEssai({ capacite: indice(sans, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: LETTRE });
  assert.equal(ecrireBilan(sans, sansPassif), "1 réussite, A = 5", "sans le passif");

  // Chez un adversaire qui attaque, ses réussites valent 3 moins celles de la
  // défense du PJ.
  const adverse = duel({
    adv: (valeurs) => {
      ajouterPassif(valeurs, { role: "degrossir", niveau: 2, nom: "Réduction" });
    },
  });
  const recue = (...pas) => gesteEssai({ acteur: "adv2", capacite: indice(adverse, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), ...pas), degats: LETTRE });
  assert.equal(ecrireBilan(adverse, recue([6], [3])), "1 réussite, Aubépine reçoit B = 10, +4 contre l'armure (Réduction)");
  assert.equal(ecrireBilan(adverse, recue([3])), "aucune réussite, Aubépine reçoit C = 15, +6 contre l'armure (Réduction)");
});

// ─── La localisation ────────────────────────────────────────────────────────

// Une Frappe à plusieurs d20, chez l'un ou chez l'autre.
const aPlusieursD20 = (nombre) => (valeurs) => {
  for (const facon of valeurs.capacites[0].facons) facon.locMultiple = nombre;
};

test("la localisation : le dé, puis la zone de la grille de la cible, en minuscule", () => {
  const etat = duel();
  const surLAdversaire = (...des) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: des });
  const surLePj = (...des) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", localisation: des });

  assert.equal(ecrireLocalisation(etat, surLAdversaire(d20(14))), "Localisation d20 → 14 : jambe droite.");
  assert.equal(ecrireLocalisation(etat, surLePj(d20(14))), "Localisation d20 → 14 : jambe droite.");
  assert.equal(ecrireLocalisation(etat, surLAdversaire(d20(20))), "Localisation d20 → 20 : tête.", "la tête d'un adversaire est en 20");
  assert.equal(ecrireLocalisation(etat, surLePj(d20(1))), "Localisation d20 → 1 : tête.", "celle d'un PJ en 1");
  assert.equal(ecrireLocalisation(etat, surLAdversaire()), null, "aucun d20 lancé : rien");
});

test("la face de contre-attaque annule l'attaque : 1 sur un adversaire, 20 sur un PJ, lue sur le dé brut", () => {
  const etat = duel();
  const surLAdversaire = (...des) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: des });
  const surLePj = (...des) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", localisation: des });

  assert.equal(ecrireLocalisation(etat, surLAdversaire(d20(1))), "Localisation d20 → 1 : contre-attaque, l'attaque est annulée.");
  assert.equal(ecrireLocalisation(etat, surLePj(d20(20))), "Localisation d20 → 20 : contre-attaque, l'attaque est annulée.");
  assert.equal(
    ecrireLocalisation(etat, surLAdversaire(d20(1, { valeur: 5, raison: "Minutie" }))),
    "Localisation d20 → 1 : contre-attaque, l'attaque est annulée.",
    "un décalage ne l'efface pas",
  );
  assert.equal(
    ecrireLocalisation(etat, surLAdversaire(d20(3, { valeur: -1, raison: "Minutie" }))),
    "Localisation d20 → 3, décalée à 2 (Minutie) : torse.",
    "et ne la crée pas : la face décalée reste sur une zone",
  );
});

test("avec plusieurs d20 : leur nombre, puis chaque dé ; une face de contre-attaque arrête les suivants", () => {
  const deux = duel({ pj: aPlusieursD20(2) });
  const frappe = (etat, ...des) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: des });
  assert.equal(ecrireLocalisation(deux, frappe(deux, d20(6), d20(13))), "Localisation 2 d20 → 6 : torse ; 13 : jambe gauche.");
  assert.equal(ecrireLocalisation(deux, frappe(deux, d20(6), d20(6))), "Localisation 2 d20 → 6 : torse ; 6 : torse.", "deux fois la même zone");
  assert.equal(ecrireLocalisation(deux, frappe(deux, d20(6), d20(1))), "Localisation 2 d20 → 6 : torse ; 1 : contre-attaque, l'attaque est annulée.");

  const trois = duel({ pj: aPlusieursD20(3) });
  assert.equal(
    ecrireLocalisation(trois, frappe(trois, d20(6), d20(1))),
    "Localisation 3 d20 → 6 : torse ; 1 : contre-attaque, l'attaque est annulée.",
    "le nombre reste celui des d20 du geste, les dés écrits sont ceux qui ont été lancés",
  );
  assert.equal(ecrireLocalisation(trois, frappe(trois, d20(1))), "Localisation 3 d20 → 1 : contre-attaque, l'attaque est annulée.");
});

test("le jet prêté lance les d20 de l'arme prêtée", () => {
  const etat = duel({
    pj: (valeurs) => {
      valeurs.armes[0].locMultiple = 2;
    },
  });
  const fournaise = gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(etat, "pj1", "Fournaise"), cible: "adv2", localisation: [d20(6), d20(20)] });
  assert.equal(ecrireLocalisation(etat, fournaise), "Localisation 2 d20 → 6 : torse ; 20 : tête.");
  assert.equal(
    ecrireLocalisation(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: [d20(6)] })),
    "Localisation d20 → 6 : torse.",
    "la Frappe, elle, n'en lance qu'un",
  );
});

test("une face décalée : le dé, la face d'arrivée, la raison, puis la zone d'arrivée", () => {
  const etat = duel();
  const frappe = (...des) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", localisation: des });
  assert.equal(ecrireLocalisation(etat, frappe(d20(14, { valeur: -2, raison: "Minutie" }))), "Localisation d20 → 14, décalée à 12 (Minutie) : jambe gauche.");
  assert.equal(ecrireLocalisation(etat, frappe(d20(14, { valeur: 3, raison: "Nez fin" }))), "Localisation d20 → 14, décalée à 17 (Nez fin) : bras gauche.");
  assert.equal(ecrireLocalisation(etat, frappe(d20(14, null))), "Localisation d20 → 14 : jambe droite.", "sans décalage");
  assert.equal(ecrireLocalisation(etat, frappe(d20(14, { valeur: 0, raison: "Minutie" }))), "Localisation d20 → 14 : jambe droite.", "un décalage nul n'en est pas un");
  // L'offre ne permet pas de sortir de la grille ; une face au-delà va à la
  // zone la plus proche (contrat de la vague 1, § 12, choix 5), et le journal
  // ne lève pas.
  assert.equal(ecrireLocalisation(etat, frappe(d20(14, { valeur: 20, raison: "Minutie" }))), "Localisation d20 → 14, décalée à 34 (Minutie) : bras droit.");

  const deux = duel({ adv: aPlusieursD20(2) });
  const double = gesteEssai({ acteur: "adv2", capacite: indice(deux, "adv2", "Frappe"), cible: "pj1", localisation: [d20(6), d20(14, { valeur: -2, raison: "Minutie" })] });
  assert.equal(ecrireLocalisation(deux, double), "Localisation 2 d20 → 6 : torse ; 14, décalée à 12 (Minutie) : jambe gauche.");
});

test("le nom d'une zone : celui des personnages si elle est reconnue, sinon le nom écrit, initiale en minuscule", () => {
  // La banque écrit « Jambre droite » ; la photographie la reconnaît.
  const etat = demonstration();
  const jambe = zone(etat, "adv2", "jambe_droite");
  assert.equal(photoDe(etat, "adv2").zones[jambe].ecrit, "Jambre droite");
  assert.equal(ecrireLocalisation(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: [d20(14)] })), "Localisation d20 → 14 : jambe droite.");

  const aile = duel({
    adv: (valeurs) => {
      Object.assign(valeurs.zones[1], { nom: "Aile gauche", ecrit: "Aile gauche", code: null });
      Object.assign(valeurs.zones[2], { nom: "Queue du Homard", ecrit: "Queue du Homard", code: null });
    },
  });
  const frappe = (brut) => gesteEssai({ capacite: indice(aile, "pj1", "Frappe"), cible: "adv2", localisation: [d20(brut)] });
  assert.equal(ecrireLocalisation(aile, frappe(12)), "Localisation d20 → 12 : aile gauche.");
  assert.equal(ecrireLocalisation(aile, frappe(14)), "Localisation d20 → 14 : queue du Homard.", "l'initiale seule change");
});

// ─── Les suites ─────────────────────────────────────────────────────────────

const pasDeCote = (etat, x) => ({ qui: "pj1", capacite: indice(etat, "pj1", "Pas de côté"), prix: { actions: 1, souffle: x }, effet: { genre: "annuler", x } });

test("l'intervention : qui, la capacité, son prix, puis les dégâts d'avant et d'après", () => {
  const etat = duel();
  const intervention = pasDeCote(etat, 3);
  const frappe = gesteEssai({
    acteur: "adv2",
    capacite: indice(etat, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(defenseDuPj(), [6], [3]),
    degats: LETTRE,
    localisation: [d20(12)],
    interventions: [intervention],
  });
  assert.equal(ecrireIntervention(etat, frappe, frappe.interventions[0]), "Aubépine intervient : Pas de côté (1 action, 3 souffle), 10 → 7.");

  const totale = { ...frappe, interventions: [pasDeCote(etat, 10)] };
  assert.equal(ecrireIntervention(etat, totale, totale.interventions[0]), "Aubépine intervient : Pas de côté (1 action, 10 souffle), 10 → 0.");

  // Les interventions d'un geste sont une liste : la seconde part de ce que
  // la première a laissé.
  const deux = { ...frappe, interventions: [pasDeCote(etat, 3), pasDeCote(etat, 4)] };
  assert.equal(ecrireIntervention(etat, deux, deux.interventions[0]), "Aubépine intervient : Pas de côté (1 action, 3 souffle), 10 → 7.");
  assert.equal(ecrireIntervention(etat, deux, deux.interventions[1]), "Aubépine intervient : Pas de côté (1 action, 4 souffle), 7 → 3.");
  assert.equal(
    ligneDuGeste(etat, { ...deux, resultat: resultat([coup(zone(etat, "pj1", "jambe_gauche"), { armure: [10, 7] })]) }),
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation d20 → 12 : jambe gauche. Aubépine intervient : Pas de côté (1 action, 3 souffle), 10 → 7. Aubépine intervient : Pas de côté (1 action, 4 souffle), 7 → 3. Armure 10 → 7.",
  );
});

test("l'intervention sur plusieurs d20 : zone après zone, dans l'ordre des dés, et seuls les coups qu'elle change", () => {
  const etat = duel({ adv: aPlusieursD20(2) });
  const frappe = (x, ...des) =>
    gesteEssai({
      acteur: "adv2",
      capacite: indice(etat, "adv2", "Frappe"),
      cible: "pj1",
      jet: chaineFinie(defenseDuPj(), [6], [3]),
      degats: LETTRE,
      localisation: des,
      interventions: [pasDeCote(etat, x)],
    });
  const ecrite = (geste) => ecrireIntervention(etat, geste, geste.interventions[0]);

  assert.equal(ecrite(frappe(12, d20(6), d20(13))), "Aubépine intervient : Pas de côté (1 action, 12 souffle), torse 10 → 0, jambe gauche 10 → 8.");
  assert.equal(ecrite(frappe(3, d20(6), d20(13))), "Aubépine intervient : Pas de côté (1 action, 3 souffle), torse 10 → 7.", "un seul coup change : la zone se dit quand même");
  assert.equal(ecrite(frappe(10, d20(6), d20(13))), "Aubépine intervient : Pas de côté (1 action, 10 souffle), torse 10 → 0.", "le second coup, intact, ne s'écrit pas");
  assert.equal(ecrite(frappe(15, d20(6), d20(6))), "Aubépine intervient : Pas de côté (1 action, 15 souffle), torse 10 → 0, torse 10 → 5.", "deux fois la même zone");
});

test("les dégâts appliqués : ce qui change seulement, dans l'ordre armure, endurance, corps", () => {
  const etat = duel();
  const applique = (...coups) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: [d20(6)], resultat: resultat(coups) });
  const torse = zone(etat, "adv2", "torse");

  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [15, 7] }))), "Armure 15 → 7.");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [5, 0], resistance: [5, 0], corps: [10, 0] }))), "Armure 5 → 0, endurance 5 → 0, corps 10 → 0.");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [0, 0], resistance: [5, 2] }))), "Endurance 5 → 2.", "armure déjà nulle");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { resistance: [0, 0], corps: [7, 0] }))), "Corps 7 → 0.");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [5, 0], corps: [10, 8] }))), "Armure 5 → 0, corps 10 → 8.");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [38, 38] }))), null, "rien ne change : pas de phrase");
  assert.equal(ecrireDegats(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2" })), null, "rien n'a été appliqué");
});

test("les dégâts appliqués sur plusieurs d20 : une phrase par coup qui change, chacune avec sa zone", () => {
  const etat = duel({
    pj: aPlusieursD20(2),
    adv: (valeurs) => {
      Object.assign(valeurs.zones[2], { nom: "aile gauche", ecrit: "aile gauche", code: null });
    },
  });
  const applique = (...coups) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: [d20(6), d20(13)], resultat: resultat(coups) });
  const torse = zone(etat, "adv2", "torse");
  const jambe = zone(etat, "adv2", "jambe_gauche");

  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [30, 19] }), coup(jambe, { armure: [15, 4] }))), "Torse : armure 30 → 19. Jambe gauche : armure 15 → 4.");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [30, 30] }), coup(jambe, { armure: [15, 4] }))), "Jambe gauche : armure 15 → 4.", "la forme reste, le coup sans effet ne s'écrit pas");
  assert.equal(
    ecrireDegats(etat, applique(coup(torse, { armure: [5, 0], resistance: [5, 2] }), coup(torse, { resistance: [2, 0], corps: [10, 3], blessure: true, blessures: 1 }))),
    "Torse : armure 5 → 0, endurance 5 → 2. Torse : endurance 2 → 0, corps 10 → 3.",
    "deux coups sur la même zone se suivent",
  );
  assert.equal(ecrireDegats(etat, applique(coup(2, { armure: [3, 0] }), coup(torse, { armure: [30, 30] }))), "Aile gauche : armure 3 → 0.", "en tête de phrase, une majuscule");
  assert.equal(ecrireDegats(etat, applique(coup(torse, { armure: [30, 30] }), coup(jambe, { armure: [15, 15] }))), null);
});

test("la blessure : celle qu'un PJ a choisie, une capacité ou un état libre ; rien de calculé pour un adversaire ; rien si le coup tue", () => {
  const etat = duel({
    adv: (valeurs) => {
      Object.assign(valeurs.zones[1], { nom: "Aile gauche", ecrit: "Aile gauche", code: null });
    },
  });
  const surLePj = (coups, choisies = [], mort = false) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", localisation: [d20(12)], resultat: resultat(coups, mort), blessures: choisies });
  const surLAdversaire = (coups, mort = false) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", localisation: [d20(12)], resultat: resultat(coups, mort) });
  const jambe = zone(etat, "pj1", "jambe_gauche");
  const bras = zone(etat, "pj1", "bras_gauche");

  const blesse = (indice) => coup(indice, { resistance: [5, 0], corps: [10, 8], blessure: true, blessures: 1 });
  assert.equal(ecrireBlessures(etat, surLePj([blesse(jambe)], [{ zone: jambe, capacite: MAIN_BRULEE, libre: null }])), "Blessure (jambe gauche) : Main brûlée.");
  assert.equal(ecrireBlessures(etat, surLePj([blesse(bras)], [{ zone: bras, capacite: null, libre: "Doigt entaillé" }])), "Blessure (bras gauche) : « Doigt entaillé » (état libre).");
  // Le −1 à ses jets n'est plus (mission, § 4.10) : un coup qui blesse, sans blessure choisie, n'écrit rien.
  assert.equal(ecrireBlessures(etat, surLePj([blesse(jambe)])), null, "la blessure d'un PJ est celle qu'il a choisie");
  assert.equal(ecrireBlessures(etat, surLAdversaire([coup(1, { resistance: [5, 0], blessure: true, blessures: 1 })])), "Blessure (aile gauche), sans effet calculé.");

  assert.equal(ecrireBlessures(etat, surLePj([coup(jambe, { resistance: [5, 1] })])), null, "l'endurance tient");
  assert.equal(ecrireBlessures(etat, surLePj([coup(jambe, { resistance: [0, 0], corps: [10, 6], blessures: 1 })])), null, "déjà blessée : pas une blessure de plus");
  assert.equal(ecrireBlessures(etat, surLePj([coup(jambe, { resistance: [5, 0], corps: [3, 0], blessures: 1 })], [], true)), null, "le coup tue");
  assert.equal(ecrireBlessures(etat, surLAdversaire([coup(1, { resistance: [5, 0], corps: [2, 0], blessure: true, blessures: 1 })], true)), null);
  assert.equal(ecrireBlessures(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2" })), null, "rien n'a été appliqué");
});

test("plusieurs blessures dans un même geste : une phrase par zone, dans l'ordre des dés, chacune celle qui a été choisie", () => {
  const etat = duel({ adv: aPlusieursD20(2) });
  const frappe = gesteEssai({
    acteur: "adv2",
    capacite: indice(etat, "adv2", "Frappe"),
    cible: "pj1",
    localisation: [d20(12), d20(6)],
    resultat: resultat([
      coup(zone(etat, "pj1", "jambe_gauche"), { resistance: [5, 0], corps: [10, 9], blessure: true, blessures: 1 }),
      coup(zone(etat, "pj1", "torse"), { resistance: [5, 0], corps: [9, 7], blessure: true, blessures: 2 }),
    ]),
    blessures: [
      { zone: zone(etat, "pj1", "jambe_gauche"), capacite: MAIN_BRULEE, libre: null },
      { zone: zone(etat, "pj1", "torse"), capacite: null, libre: "Doigt entaillé" },
    ],
  });
  assert.equal(ecrireBlessures(etat, frappe), "Blessure (jambe gauche) : Main brûlée. Blessure (torse) : « Doigt entaillé » (état libre).");
});

test("la mort : « meurt », avec le nom court de la cible ; rien si elle survit", () => {
  const etat = demonstration();
  const frappe = (mort) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv4", resultat: resultat([coup(0, { corps: [3, mort ? 0 : 1] })], mort) });
  assert.equal(ecrireMort(etat, frappe(true)), "Marmiton n° 2 meurt.");
  assert.equal(ecrireMort(etat, frappe(false)), null);
  assert.equal(ecrireMort(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv4" })), null);

  const recue = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", resultat: resultat([coup(0, { corps: [3, 0] })], true) });
  assert.equal(ecrireMort(etat, recue), "Aubépine meurt.");
});

// ─── La ligne entière ───────────────────────────────────────────────────────

test("l'attaque ajustée qui tue, déroulée dans la démonstration : ses segments, puis sa ligne", () => {
  const etat = demonstration();
  const emincer = gesteEssai({
    capacite: indice(etat, "pj1", "Émincer"),
    prix: prix({ souffle: 4 }),
    cible: "adv4",
    jet: chaineFinie(
      { genre: "attaque", lanceur: "pj1", faces: 10, mobilisees: ["precision", "agilite"], difficulte: 5, modificateurs: [VIF], avantages: [SOLO], desavantages: [horsMaitrise("Émincer")] },
      [6],
      [8],
      [2],
    ),
    degats: ajuste("lettre", 22, "Émincer"),
    localisation: [d20(20)],
    resultat: resultat([coup(zone(etat, "adv4", "tete"), { armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 })], true),
  });

  assert.deepEqual(segmentsDuGeste(etat, emincer), [
    "Aubépine : Émincer (4 souffle) contre Marmiton n° 2.",
    "Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent.",
    "d10+1 contre 5 → 7 ✓, 9 ✓, 3 ✗ : 2 réussites, B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction).",
    "Localisation d20 → 20 : tête.",
    "Armure 5 → 0, endurance 5 → 0, corps 10 → 0.",
    "Marmiton n° 2 meurt.",
  ]);
  assert.equal(
    ligneDuGeste(etat, emincer),
    "Aubépine : Émincer (4 souffle) contre Marmiton n° 2. Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent. d10+1 contre 5 → 7 ✓, 9 ✓, 3 ✗ : 2 réussites, B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction). Localisation d20 → 20 : tête. Armure 5 → 0, endurance 5 → 0, corps 10 → 0. Marmiton n° 2 meurt.",
  );
  for (const segment of segmentsDuGeste(etat, emincer)) assert.ok(segment.endsWith("."), `« ${segment} » finit par un point`);
});

test("la défense avec le pas de côté, déroulée dans la démonstration", () => {
  const etat = demonstration();
  const frappe = gesteEssai({
    acteur: "adv2",
    capacite: indice(etat, "adv2", "Frappe"),
    cible: "pj1",
    jet: chaineFinie(
      { genre: "defense", lanceur: "pj1", faces: 8, mobilisees: ["agilite", "creativite"], difficulte: 5, modificateurs: [VIF], avantages: [SOLO], desavantages: [MELES] },
      [7],
      [3],
    ),
    degats: LETTRE,
    localisation: [d20(12)],
    interventions: [pasDeCote(etat, 3)],
    resultat: resultat([coup(zone(etat, "pj1", "jambe_gauche"), { armure: [10, 1] })]),
  });
  assert.equal(
    ligneDuGeste(etat, frappe),
    "Chef : Frappe contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 5 → 8 ✓, 4 ✗ : 1 réussite, Aubépine reçoit B = 12. Localisation d20 → 12 : jambe gauche. Aubépine intervient : Pas de côté (1 action, 3 souffle), 12 → 9. Armure 10 → 1.",
  );
});

test("une capacité sans jet et un déplacement tiennent en une phrase", () => {
  const etat = duel();
  const flambage = gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), facon: 1, prix: prix({ souffle: 10 }), cible: "adv2" });
  assert.deepEqual(segmentsDuGeste(etat, flambage), ["Aubépine : Flambage [2] (10 souffle) contre Marmiton."]);
  const pas = gesteEssai({ acteur: "adv2", mode: "deplacement", capacite: indice(etat, "adv2", "Pas chassé"), depart: "J1", arrivee: "I2" });
  assert.equal(ligneDuGeste(etat, pas), "Marmiton : Pas chassé [1], J1 → I2.");
});

test("un nom hostile reste du texte, écrit tel quel", () => {
  const etat = duel({
    adv: (valeurs) => {
      valeurs.nom = "<b>Marmiton</b> (faux) : x → y";
    },
  });
  const frappe = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [2]) });
  assert.equal(ligneDuGeste(etat, frappe), "Aubépine : Frappe contre <b>Marmiton</b>. d8 contre 5 → 2 ✗ : aucune réussite, manqué.");
  const raison = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: ajuste("lettre", 7, "a) ; b : → ✓") });
  assert.equal(ecrireBilan(etat, raison), "1 réussite, A = 5, ajusté à 7 (a) ; b : → ✓)");
});

// Le journal s'écrit au cœur de appliquer(), qui ne lève jamais : un geste que
// le moteur ne ferait pas (un identifiant ou un indice inconnu) donne une
// ligne pauvre, pas une exception.
test("un geste forgé ne fait pas lever le journal", () => {
  const etat = duel({
    retoucher: (brut) => {
      delete brut.noms.adv2;
    },
  });
  assert.equal(ligneDePasse(etat, "adv2"), "Marmiton passe son tour.", "sans nom court, le nom de la photographie");
  assert.equal(ligneDePasse(etat, "constructor"), " passe son tour.");

  const jet = chaineFinie(attaqueDuPj({ caracteristiques: ["inconnue"] }), [6], [2]);
  assert.equal(ecrireJet(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE })), "d8 (inconnue) contre 5 → 6 ✓, 2 ✗ : 1 réussite, A = 5.");

  const forges = [
    gesteEssai({ acteur: "pj9", capacite: 99, facon: 7, mode: "sans_jet", cible: "adv9" }),
    gesteEssai({ acteur: "__proto__", capacite: 0, mode: "deplacement" }),
    gesteEssai({ capacite: 99, cible: "constructor", jet, degats: LETTRE, localisation: [d20(6)], resultat: resultat([coup(42, { armure: [3, 0], resistance: [5, 0], blessure: true, blessures: 1 })]) }),
    gesteEssai({ cible: "adv2", jet, degats: LETTRE, localisation: [d20(6), d20(7)], interventions: [{ qui: "pj9", capacite: 99, prix: { actions: 1, souffle: 2 }, effet: { genre: "annuler", x: 2 } }], resultat: resultat([coup(42, { armure: [3, 0] })]) }),
  ];
  for (const forge of forges) {
    assert.equal(typeof ligneDuGeste(etat, forge), "string");
    assert.doesNotThrow(() => annonce(etat, forge, { type: "de", faces: 8, valeurs: [1] }));
    assert.doesNotThrow(() => annonce(etat, forge, { type: "appliquer" }, 0));
  }
  const sansDe = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet: chaine(attaqueDuPj()) });
  assert.equal(annonce(etat, sansDe, { type: "de", faces: 8, valeurs: [1] }), null, "un jet sans dé lancé n'a rien à annoncer");
});

// ─── Les annonces ───────────────────────────────────────────────────────────

const DE = { type: "de", faces: 8, valeurs: [1] };

test("l'annonce d'un dé de la chaîne : son rang, sa valeur, son issue ; et la question quand une relance reste", () => {
  const etat = duel();
  const enCours = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet });

  assert.equal(annonce(etat, enCours(chaine(attaqueDuPj({ modificateurs: [VIF] }), [8])), DE), "1er dé : 9, réussi.");
  assert.equal(annonce(etat, enCours(chaine(attaqueDuPj({ modificateurs: [VIF] }), [8], [7])), DE), "2e dé : 8, réussi.");
  assert.equal(annonce(etat, enCours(chaine(attaqueDuPj({ modificateurs: [VIF], avantages: [SOLO] }), [8], [3])), DE), "2e dé : 4, échec. Relancer ou garder ?");
  assert.equal(annonce(etat, enCours(chaine(attaqueDuPj({ avantages: [SOLO] }), [3], "relancer", [7])), DE), "1er dé : 7, réussi.", "le dé d'une relance garde son rang");
  assert.equal(
    annonce(etat, enCours(chaine(attaqueDuPj({ modificateurs: [VIF], desavantages: [horsMaitrise("Émincer")] }), [7, 5])), DE),
    "1er dé : 8 et 6, on garde 6, réussi.",
    "sous désavantage, les lancers modificateur compris, puis le pire",
  );
  assert.equal(annonce(etat, enCours(chaine(attaqueDuPj({ desavantages: [horsMaitrise("Émincer"), MELES] }), [7, 5, 6])), DE), "1er dé : 7, 5 et 6, on garde 5, réussi.");
});

test("l'annonce d'une explosion : ce que le dé peut faire, puis la somme et son issue", () => {
  const etat = duel();
  const gouter = (jet) => gesteEssai({ mode: "caracteristique", capacite: indice(etat, "pj1", "Goûter"), moment: "jet", jet });
  const de6 = (champs) => ({ genre: "caracteristique", lanceur: "pj1", faces: 6, difficulte: 8, ...champs });

  assert.equal(annonce(etat, gouter(chaine(de6(), [6])), DE), "1er dé : 6, il peut exploser.");
  assert.equal(annonce(etat, gouter(chaine(de6(), [6], "exploser", [3])), DE), "Le dé explose : 6 plus 3, 9, réussi.");
  assert.equal(annonce(etat, gouter(chaine(de6({ difficulte: 13 }), [6], "exploser", [6])), DE), "Le dé explose : 6 plus 6, 12, il peut encore exploser.");
  assert.equal(annonce(etat, gouter(chaine(de6({ difficulte: 13, modificateurs: [ecart(-1)] }), [6], "exploser", [6], "exploser", [2])), DE), "Le dé explose : 5 plus 6 plus 2, 13, réussi.");
  assert.equal(
    annonce(etat, gouter(chaine(de6({ difficulte: 12, avantages: [mainAvantageuse(1, "Minutie")] }), [6], "exploser", [3])), DE),
    "Le dé explose : 6 plus 3, 9, échec. Relancer ou garder ?",
  );
  assert.equal(annonce(etat, gouter(chaine(de6(), [6], "exploser")), { type: "exploser" }), null, "le choix d'exploser n'annonce rien : c'est son dé qui parle");
});

test("à la fin d'une chaîne qui touche, l'annonce ajoute le bilan ; un dé gardé annonce le bilan seul", () => {
  const etat = duel();
  const auBilan = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "bilan", jet, degats: LETTRE });

  assert.equal(annonce(etat, auBilan(chaineFinie(attaqueDuPj(), [6], [7], [8])), DE), "3e dé : 8, réussi. 3 réussites, C = 15.");
  assert.equal(annonce(etat, auBilan(chaineFinie(attaqueDuPj(), [6], [3])), DE), "2e dé : 3, échec. 1 réussite, A = 5.");
  assert.equal(
    annonce(etat, auBilan(chaineFinie(attaqueDuPj({ modificateurs: [VIF], desavantages: [horsMaitrise("Émincer")] }), [7, 5], [7, 3])), DE),
    "2e dé : 8 et 4, on garde 4, échec. 1 réussite, A = 5.",
  );
  assert.equal(annonce(etat, auBilan(chaineFinie(attaqueDuPj({ avantages: [SOLO] }), [6], [3], "garder")), { type: "garder" }), "1 réussite, A = 5.");

  const recue = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE });
  assert.equal(annonce(etat, recue, DE), "2e dé : 3, échec. 1 réussite, Aubépine reçoit B = 10.");
});

// Relecture de fin de groupe (lot 4) : le bilan suivait le dé sans majuscule
// (« … échec. aucune réussite, … »), et disait « touché » d'une attaque dont
// les dégâts restaient à saisir.
test("le bilan annoncé est une phrase : il commence par une majuscule, après le dé comme seul", () => {
  const etat = duel();
  const recue = (circonstances, ...pas) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj(circonstances), ...pas), degats: LETTRE });

  assert.equal(annonce(etat, recue({}, [3]), DE), "1er dé : 3, échec. Aucune réussite, Aubépine reçoit C = 15.");
  assert.equal(annonce(etat, recue({ avantages: [SOLO] }, [3], "garder"), { type: "garder" }), "Aucune réussite, Aubépine reçoit C = 15.", "le dé gardé : le bilan seul");
  // Le journal, lui, écrit le même bilan après deux-points, en minuscule.
  assert.equal(ecrireBilan(etat, recue({}, [3])), "aucune réussite, Aubépine reçoit C = 15");
  // Un bilan qui commence par un chiffre ne change pas.
  assert.equal(annonce(etat, recue({}, [6], [3]), DE), "2e dé : 3, échec. 1 réussite, Aubépine reçoit B = 10.");
});

test("le bilan annoncé ne dit rien de dégâts qui ne sont pas fixés : une attaque sans dégâts propres n'annonce que ses réussites", () => {
  // La Mouette n'a pas d'arme : ses dégâts se saisissent à la main, après le jet.
  const etat = duel({ adv: mouette });
  const bec = (degats, ...pas) =>
    gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee: null, capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj(), ...pas), degats });
  assert.equal(annonce(etat, bec(AUCUN, [6], [3]), DE), "2e dé : 3, échec. 1 réussite.");
  assert.equal(annonce(etat, bec(AUCUN, [3]), DE), "1er dé : 3, échec. Aucune réussite.");
  assert.equal(ecrireBilan(etat, bec(AUCUN, [6], [3])), "1 réussite, touché", "le journal, à la fin du geste, écrit ce qui a été fixé");
  // Le nombre saisi, lui, est fixé : il se dit.
  assert.equal(annonce(etat, bec(ajuste("aucun", 4, "Frappe"), [6], [3]), DE), "2e dé : 3, échec. 1 réussite, Aubépine reçoit 4 (à la main : Frappe).");

  // Le jet prêté d'un personnage part « Sans dégâts » : ceux de l'arme restent à demander.
  const pj = duel();
  const fournaise = (degats, ...pas) =>
    gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(pj, "pj1", "Fournaise"), cible: "adv2", moment: "bilan", jet: chaineFinie(attaqueDuPj(), ...pas), degats });
  assert.equal(annonce(pj, fournaise(AUCUN, [6], [3]), DE), "2e dé : 3, échec. 1 réussite.");
  assert.equal(annonce(pj, fournaise(ARME, [6], [3]), DE), "2e dé : 3, échec. 1 réussite, touché, dégâts de l'arme : A = 5.");
  // Une attaque aux dégâts propres dit sa lettre : le jet l'a décidée.
  const frappe = gesteEssai({ capacite: indice(pj, "pj1", "Frappe"), cible: "adv2", moment: "bilan", jet: chaineFinie(attaqueDuPj(), [6], [3]), degats: LETTRE });
  assert.equal(annonce(pj, frappe, DE), "2e dé : 3, échec. 1 réussite, A = 5.");
});

test("l'annonce d'un dé passé sous zéro porte le moins du journal, comme sa ligne", () => {
  const etat = duel();
  const enCours = (jet) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet });
  // En défense, sous un désavantage, le dé qui échoue finit la chaîne : le bilan suit.
  const recue = (desavantages, ...pas) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj({ modificateurs: [ecart(-2)], desavantages }), ...pas), degats: LETTRE });
  const dites = [
    [annonce(etat, enCours(chaine(attaqueDuPj({ modificateurs: [ecart(-2)], avantages: [SOLO] }), [1])), DE), "1er dé : −1, échec. Relancer ou garder ?"],
    [annonce(etat, recue([MELES], [2, 1]), DE), "1er dé : 0 et −1, on garde −1, échec. Aucune réussite, Aubépine reçoit C = 15."],
    [annonce(etat, recue([MELES, mainAvantageuse(1, "Fumée")], [2, 1, 3]), DE), "1er dé : 0, −1 et 1, on garde −1, échec. Aucune réussite, Aubépine reçoit C = 15."],
  ];
  const gouter = (jet) => gesteEssai({ mode: "caracteristique", capacite: indice(etat, "pj1", "Goûter"), moment: "jet", jet });
  const accable = { genre: "caracteristique", lanceur: "pj1", faces: 6, difficulte: 6, modificateurs: [ecart(-6), aLaMain(-2, "Fumée")], avantages: [mainAvantageuse(1, "Minutie")] };
  dites.push(
    [annonce(etat, gouter(chaine(accable, [6])), DE), "1er dé : −2, il peut exploser."],
    [annonce(etat, gouter(chaine(accable, [6], "exploser", [1])), DE), "Le dé explose : −2 plus 1, −1, échec. Relancer ou garder ?"],
    [annonce(etat, gouter(chaine(accable, [6], "exploser", [6])), DE), "Le dé explose : −2 plus 6, 4, il peut encore exploser."],
  );
  for (const [dite, attendue] of dites) {
    assert.equal(dite, attendue);
    sansTraitDUnion(dite);
  }
});

// Relecture de fin de groupe (lot 4) : l'esquive et la face décalée ne
// lancent aucun dé, et un lecteur d'écran n'en entendait rien avant
// « Appliquer ».
test("l'esquive et la face décalée s'annoncent par la phrase que le journal en écrira", () => {
  const etat = duel({ adv: aPlusieursD20(2) });
  const frappe = (champs) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "suites", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE, localisation: [d20(6), d20(14)], ...champs });
  const ESQUIVE = { type: "esquive", x: 12 };
  const DECALER = { type: "decaler", de: 1, valeur: -2, raison: "Minutie" };

  const esquivee = frappe({ interventions: [pasDeCote(etat, 12)] });
  const intervention = "Aubépine intervient : Pas de côté (1 action, 12 souffle), torse 10 → 0, jambe droite 10 → 8.";
  assert.equal(annonce(etat, esquivee, ESQUIVE), intervention);
  assert.equal(annonce(etat, esquivee, ESQUIVE, etat.journal.length), intervention, "avec le compte des lignes aussi");
  assert.equal(ecrireIntervention(etat, esquivee, esquivee.interventions[0]), intervention, "mot pour mot celle du journal");
  // De deux interventions, c'est la dernière jouée qui se dit.
  const deux = frappe({ interventions: [pasDeCote(etat, 3), pasDeCote(etat, 4)] });
  assert.equal(annonce(etat, deux, ESQUIVE), "Aubépine intervient : Pas de côté (1 action, 4 souffle), torse 7 → 3.");

  const decalee = frappe({ localisation: [d20(6), d20(14, { valeur: -2, raison: "Minutie" })] });
  const localisation = "Localisation 2 d20 → 6 : torse ; 14, décalée à 12 (Minutie) : jambe gauche.";
  assert.equal(annonce(etat, decalee, DECALER), localisation);
  assert.equal(annonce(etat, decalee, DECALER, etat.journal.length), localisation);
  assert.equal(ecrireLocalisation(etat, decalee), localisation, "mot pour mot celle du journal");
  // Un décalage ramené à 0 dit la face d'origine : on entend qu'il n'y en a plus.
  assert.equal(annonce(etat, frappe(), { ...DECALER, valeur: 0 }), "Localisation 2 d20 → 6 : torse ; 14 : jambe droite.");

  // Les autres événements du même moment restent muets, et un geste sans d20 ni intervention n'a rien à en dire.
  assert.equal(annonce(etat, esquivee, { type: "degats", base: "lettre", operations: [], nature: "normaux" }), null);
  const avant = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE });
  assert.equal(annonce(etat, avant, ESQUIVE), null);
  assert.equal(annonce(etat, avant, DECALER), null);
  assert.equal(annonce(etat, null, ESQUIVE), null, "sans geste");
});

test("l'annonce d'un d20 : la face, puis la zone", () => {
  const etat = duel({ adv: aPlusieursD20(2) });
  const frappe = (moment, ...des) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment, jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE, localisation: des });
  const D20 = { type: "de", faces: 20, valeurs: [12] };

  assert.equal(annonce(etat, frappe("localisation", d20(12)), D20), "Localisation : 12, jambe gauche.");
  assert.equal(annonce(etat, frappe("suites", d20(12), d20(6)), D20), "Localisation : 6, torse.", "le dernier d20 lancé");
});

test("un événement qui ne lance rien et n'écrit rien n'annonce rien", () => {
  const etat = duel();
  const geste = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet: chaine(attaqueDuPj({ avantages: [SOLO] }), [6], [3]) });
  for (const evenement of [
    { type: "capacite", qui: "pj1", capacite: 0, facon: 0 },
    { type: "regler", champ: "cible", valeur: "adv2" },
    { type: "revenir" },
    { type: "relancer" },
    { type: "degats", base: "lettre", operations: [], nature: "normaux" },
    { type: "decaler", de: 0, valeur: 1, raison: "Minutie" },
    { type: "esquive", x: 3 },
  ]) {
    assert.equal(annonce(etat, geste, evenement), null, evenement.type);
    assert.equal(annonce(etat, geste, evenement, etat.journal.length), null, `${evenement.type}, avec le compte des lignes`);
  }
  assert.equal(annonce(etat, null, DE), null, "sans geste");
  assert.equal(annonce(etat, gesteEssai({ mode: "sans_jet", moment: "preparation" }), { type: "regler", champ: "cible", valeur: null }), null);
});

test("après le lancement et après une fin de tour, l'annonce dit les lignes de cadre écrites, à la suite", () => {
  const lance = duel();
  const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
  assert.equal(lance.annonce.texte, "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. — Tour 1 · camp des PJ —");
  assert.equal(annonce(lance, null, LANCER, 0), lance.annonce.texte);
  assert.equal(annonce(lance, null, LANCER), lance.annonce.texte, "sans le compte des lignes : tout le journal");

  const FIN = { type: "fin_de_tour" };
  const tourne = duel({ tour: { numero: 1, camp: "adv" } });
  assert.equal(tourne.annonce.texte, "Fin du tour des PJ : ils retrouvent leurs actions. — Tour 1 · camp des adversaires —");
  assert.equal(annonce(tourne, null, FIN, 2), tourne.annonce.texte);
  assert.equal(annonce(tourne, null, FIN), tourne.annonce.texte, "sans le compte : depuis la dernière fin de tour");

  // Deux fins de tour d'un même événement (celle qu'on demande, puis une fin
  // automatique) : seul le compte des lignes d'avant les rend toutes.
  const deuxFins = duel({ tour: { numero: 2, camp: "pj" } });
  assert.equal(
    annonce(deuxFins, null, FIN, 2),
    "Fin du tour des PJ : ils retrouvent leurs actions. — Tour 1 · camp des adversaires — Fin du tour des adversaires : ils retrouvent leurs actions. — Tour 2 · camp des PJ —",
  );
  assert.equal(annonce(deuxFins, null, FIN, 4), "Fin du tour des adversaires : ils retrouvent leurs actions. — Tour 2 · camp des PJ —");
  assert.equal(annonce(deuxFins, null, FIN), "Fin du tour des adversaires : ils retrouvent leurs actions. — Tour 2 · camp des PJ —", "sans le compte, la dernière seulement");
});

test("à la fin d'un geste, l'annonce est sa ligne de journal entière, suivie du cadre qu'elle entraîne", () => {
  const modele = duel();
  const frappe = gesteEssai({
    capacite: indice(modele, "pj1", "Frappe"),
    cible: "adv2",
    jet: chaineFinie(attaqueDuPj(), [6], [3]),
    degats: LETTRE,
    localisation: [d20(6)],
    resultat: resultat([coup(zone(modele, "adv2", "torse"), { armure: [10, 5] })]),
  });
  const ligne = ligneDuGeste(modele, frappe);
  assert.equal(ligne, "Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 3 ✗ : 1 réussite, A = 5. Localisation d20 → 6 : torse. Armure 10 → 5.");

  const APPLIQUER = { type: "appliquer" };
  const seule = duel({ retoucher: (etat) => etat.journal.push({ genre: "geste", texte: ligne }) });
  assert.equal(annonce(seule, frappe, APPLIQUER, 2), ligne);
  assert.equal(annonce(seule, frappe, APPLIQUER), ligne, "sans le compte : depuis la ligne du geste");

  const suivie = duel({
    retoucher: (etat) => etat.journal.push({ genre: "geste", texte: ligne }, { genre: "cadre", texte: ligneDeFinDeTour("pj") }, { genre: "tour", texte: ligneDeTour({ numero: 1, camp: "adv" }) }),
  });
  const attendu = `${ligne} Fin du tour des PJ : ils retrouvent leurs actions. — Tour 1 · camp des adversaires —`;
  assert.equal(annonce(suivie, frappe, APPLIQUER, 2), attendu);
  assert.equal(annonce(suivie, frappe, APPLIQUER), attendu);

  const mortelle = duel({ retoucher: (etat) => etat.journal.push({ genre: "geste", texte: ligne, mort: true }, { genre: "fin", texte: ligneDeFin("pj") }) });
  assert.equal(annonce(mortelle, frappe, APPLIQUER, 2), `${ligne} Combat terminé : victoire des PJ.`);
  assert.equal(annonce(mortelle, frappe, APPLIQUER), `${ligne} Combat terminé : victoire des PJ.`);

  // Le dé qui manque finit le geste : l'annonce est la ligne, non le dé.
  const manque = gesteEssai({ capacite: indice(modele, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [2]) });
  const ligneManquee = ligneDuGeste(modele, manque);
  const ratee = duel({ retoucher: (etat) => etat.journal.push({ genre: "geste", texte: ligneManquee }) });
  assert.equal(annonce(ratee, manque, DE, 2), "Aubépine : Frappe contre Marmiton. d8 contre 5 → 2 ✗ : aucune réussite, manqué.");
  assert.equal(annonce(ratee, manque, DE), "Aubépine : Frappe contre Marmiton. d8 contre 5 → 2 ✗ : aucune réussite, manqué.");

  // Tant que le geste est sur la pile, un dé n'a écrit aucune ligne : sans le
  // compte, la ligne d'un geste d'avant ne se redit pas.
  const enCours = gesteEssai({ capacite: indice(modele, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet: chaine(attaqueDuPj(), [6]) });
  const ouvert = duel({
    retoucher: (etat) => {
      etat.journal.push({ genre: "geste", texte: ligne });
      etat.pile.push(enCours);
    },
  });
  assert.equal(annonce(ouvert, enCours, DE), "1er dé : 6, réussi.");
  assert.equal(annonce(ouvert, enCours, DE, 3), "1er dé : 6, réussi.");
});

test("« passer » s'annonce par sa ligne, et par le cadre qui la suit", () => {
  const PASSER = { type: "passer", qui: "pj1" };
  const passe = duel({
    retoucher: (etat) => etat.journal.push({ genre: "geste", texte: "Aubépine passe son tour." }, { genre: "cadre", texte: ligneDeFinDeTour("pj") }, { genre: "tour", texte: ligneDeTour({ numero: 1, camp: "adv" }) }),
  });
  const attendu = "Aubépine passe son tour. Fin du tour des PJ : ils retrouvent leurs actions. — Tour 1 · camp des adversaires —";
  assert.equal(annonce(passe, null, PASSER, 2), attendu);
  assert.equal(annonce(passe, null, PASSER), attendu);
});

// ─── L'en-tête, le texte, le fichier ────────────────────────────────────────

test("l'heure du lancement se découpe comme un texte : le jour, puis l'heure sans zéro et les minutes sur deux chiffres", () => {
  assert.equal(ecrireHeure("2026-10-11T23:05"), "11/10/2026 à 23 h 05");
  assert.equal(ecrireHeure("2026-10-12T09:05"), "12/10/2026 à 9 h 05");
  assert.equal(ecrireHeure("2026-01-02T00:00"), "02/01/2026 à 0 h 00");
  assert.equal(ecrireHeure("2026-10-12T10:59"), "12/10/2026 à 10 h 59");
  for (const illisible of [null, undefined, "", "hier soir", "2026-10-11", "2026-10-11T23:05:00", "2026-10-11T23:05 ", 20261011]) {
    assert.equal(ecrireHeure(illisible), "", `${JSON.stringify(illisible)} ne se lit pas`);
  }
});

test("le nom du fichier porte la date et l'heure du lancement, et rien d'autre", () => {
  assert.equal(nomDuFichier("2026-10-11T23:05"), "combat-2026-10-11-23h05.txt");
  assert.equal(nomDuFichier("2026-10-12T09:05"), "combat-2026-10-12-09h05.txt", "l'heure garde ici son zéro");
  for (const hostile of [null, "", "../../secret", "2026-10-11T23:05/../x", "2026-10-11T23:05\n", "aaaa-mm-jjThh:mm"]) {
    assert.equal(nomDuFichier(hostile), "combat.txt", `${JSON.stringify(hostile)} n'entre pas dans un nom de fichier`);
  }
});

test("l'en-tête : le titre, l'heure, les personnages, puis chaque adversaire une fois avec ses numéros", () => {
  assert.deepEqual(enTete(demonstration({ lanceLe: "2026-10-11T23:05" })), [
    "Simulateur de combat — L'Atelier des Arpenteurs",
    "Combat lancé le 11/10/2026 à 23 h 05 (démonstration)",
    "Personnages : Aubépine Crèmebrûlée",
    "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2",
  ]);

  const marmiton = () => ({ photo: marmitonDeCorveeEssai() });
  const reel = etatDe([{ photo: aubepineEssai() }, { photo: brioche() }, marmiton(), { photo: chefDePartieEssai() }, marmiton(), marmiton()], { mode: "reel", lanceLe: "2026-10-12T09:05" });
  assert.deepEqual(enTete(reel), [
    "Simulateur de combat — L'Atelier des Arpenteurs",
    "Combat lancé le 12/10/2026 à 9 h 05",
    "Personnages : Aubépine Crèmebrûlée, Brioche",
    "Adversaires : Marmiton de corvée n° 1, n° 2 et n° 3 ; Chef de partie",
  ]);

  assert.equal(enTete(duel())[3], "Adversaires : Marmiton", "un seul exemplaire : pas de numéro");
});

test("le texte du journal : l'en-tête, une ligne vide, les lignes ; en LF pour la copie, en CRLF pour le fichier", () => {
  const etat = demonstration();
  const copie = texteDuJournal(etat);
  assert.equal(
    copie,
    [
      "Simulateur de combat — L'Atelier des Arpenteurs",
      "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)",
      "Personnages : Aubépine Crèmebrûlée",
      "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2",
      "",
      "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent.",
      "— Tour 1 · camp des PJ —",
    ].join("\n"),
  );
  assert.ok(!copie.includes("\r"), "la copie n'a aucun retour chariot");
  assert.ok(!copie.endsWith("\n"), "la dernière ligne n'est pas suivie d'une fin de ligne");

  const fichier = texteDuJournal(etat, "\r\n");
  assert.equal(fichier, copie.replaceAll("\n", "\r\n"));
  assert.equal(fichier.split("\r\n").length, 7);
  assert.ok(!fichier.replaceAll("\r\n", "").includes("\n"), "aucune fin de ligne nue dans le fichier");
});

// ─── Les signes ─────────────────────────────────────────────────────────────

const INSECABLES = [0x00a0, 0x202f].map((code) => String.fromCodePoint(code));
const sansInsecable = (texte, quoi) => {
  for (const insecable of INSECABLES) assert.ok(!texte.includes(insecable), `${quoi} porte une espace insécable (U+${insecable.codePointAt(0).toString(16).toUpperCase()})`);
};

const source = readFileSync(new URL("../js/combat/journal.js", import.meta.url), "utf8");

test("aucune espace insécable : ni dans le source du journal, ni dans ce qu'il écrit, ni dans le journal de référence", () => {
  sansInsecable(source, "le source du journal");
  sansInsecable(journalAttendu.join("\n"), "le journal de référence");

  const etat = demonstration();
  const segments = referenceEcritePar(lignes).flatMap((ligne) => ligne.segments.map((segment) => segment.texte));
  assert.ok(segments.length > 300, "les segments du combat de référence");
  const ecrits = [...lignesDeReference(), ...segments, ...enTete(etat), texteDuJournal(etat, "\r\n"), nomDuFichier(etat.lanceLe), ecrireHeure("2026-10-12T09:05"), ligneDeFin("adv"), annonce(etat, null, { type: "lancer", le: etat.lanceLe })];
  assert.ok(ecrits.length > 40);
  ecrits.forEach((texte, rang) => sansInsecable(texte, `le texte ${rang + 1}`));
  assert.ok(ecrits.join("\n").includes("n° 1"), "« n° 1 » s'écrit avec une espace ordinaire");
  assert.ok(ecrireHeure("2026-10-11T23:05").includes(" h "), "« 23 h 05 » aussi");

  assert.ok(`a${INSECABLES[0]}b` !== "a b", "le témoin est bien une espace insécable");
});

// Le journal de référence n'a plus de signe moins (mission, § 10) : les cinq
// qu'il portait venaient du −1 des blessures, qui n'est plus. Ceux du journal
// viennent désormais des gabarits neufs (mission, § 7) : « −3 (…) : 17 »,
// « −1 à chaque dé », « plus de −1 à chaque dé de défense » ; le signe fois
// de « ×2 » et les guillemets d'un état libre s'écrivent, eux aussi, par leur
// code.
test("le journal de référence ne porte plus de signe moins ; les gabarits neufs écrivent le leur, le signe fois et les guillemets, par leur code", () => {
  const moins = [...journalAttendu.join("")].filter((signe) => signe === SIGNES.moins).length;
  assert.equal(moins, 0, "le −1 des blessures n'est plus");
  assert.equal(SIGNES.moins.codePointAt(0), 0x2212);
  // Aucun nombre ne s'y écrit avec le trait d'union : ni dans le journal
  // attendu, ni dans les lignes que les fonctions du journal en tirent.
  for (const ligne of [...journalAttendu, ...lignesDeReference()]) assert.doesNotMatch(ligne, /-\d/, ligne);
  assert.match(`d8${TRAIT_D_UNION}1`, /-\d/, "le motif voit un trait d'union devant un chiffre");

  // Les gabarits neufs qui portent un moins, le signe fois, des guillemets.
  const etat = duel();
  const MJ = { genre: "mj" };
  const parLeMj = { source: MJ, prix: null, auteur: null, camp: "pj", rang: 0, durable: null };
  const frappe = gesteEssai({
    capacite: indice(etat, "pj1", "Frappe"),
    cible: "adv2",
    jet: chaineFinie(attaqueDuPj(), [6], [7], [2]),
    degats: LETTRE,
    effets: [
      { type: "effet", genre: "multiplier", k: 2, ...parLeMj },
      { type: "effet", genre: "retrancher", n: 3, ...parLeMj },
    ],
  });
  const ecrits = [
    [ecrireBilan(etat, frappe), "2 réussites, B = 10, ×2 (MJ) : 20, −3 (MJ) : 17"],
    [ecrireEffet(etat, { type: "effet", genre: "defense", sur: "pj1", n: -1, duree: "combat", ...parLeMj }), "Défense d'Aubépine : −1 à chaque dé (MJ), jusqu'à la fin du combat."],
    [ecrireEcheance(etat, { id: 3, genre: "modif", porteur: "pj1", auteur: null, camp: "pj", duree: "tour", source: MJ, valeur: "defense", n: -1 }), "Fin de MJ pour Aubépine : plus de −1 à chaque dé de défense."],
    [ecrireEffet(etat, { type: "effet", genre: "etat", sur: "pj1", libre: "Couvert de farine", duree: "combat", ...parLeMj }), "Aubépine : état « Couvert de farine » (MJ), jusqu'à la fin du combat."],
  ];
  for (const [ecrit, attendu] of ecrits) {
    assert.equal(ecrit, attendu);
    assert.doesNotMatch(ecrit, /-\d/, ecrit);
  }
  const tout = ecrits.map(([ecrit]) => ecrit).join("");
  assert.equal([...tout].filter((signe) => signe === SIGNES.moins).length, 3, "trois moins, celui de SIGNES");
  assert.equal([...tout].filter((signe) => signe.codePointAt(0) === 0x00d7).length, 1, "le signe fois, U+00D7");
  assert.deepEqual([0x00ab, 0x00bb].map((point) => tout.includes(String.fromCodePoint(point))), [true, true], "les guillemets");

  // Hors des commentaires, le source n'écrit aucun des signes : il les prend
  // à SIGNES, pour qu'aucun éditeur ne remplace l'un par son voisin.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(code.includes("SIGNES.fleche") && code.includes("SIGNES.moins"), "le code lu est bien celui du journal");
  for (const [nom, signe] of Object.entries(SIGNES)) assert.ok(!code.includes(signe), `le signe « ${nom} » est écrit en dur`);
  // Les points de suspension de la ligne en cours (groupe 2) aussi, et, au
  // groupe 3, le signe fois et les guillemets.
  for (const [nom, point] of [
    ["les points de suspension", 0x2026],
    ["le signe fois", 0x00d7],
    ["le guillemet ouvrant", 0x00ab],
    ["le guillemet fermant", 0x00bb],
  ]) {
    assert.ok(!code.includes(String.fromCodePoint(point)), `${nom} : écrit en dur`);
  }
});

test("le journal n'importe que le noyau qu'on lui permet, et ne lit rien de l'appareil", () => {
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((trouve) => trouve[1]).sort();
  assert.deepEqual(imports, ["../personnage/regles.js", "./degats.js", "./jet.js", "./regles.js", "./valeurs.js"]);
  for (const interdit of ["localeCompare", "toLocale", "Intl", "new Date", "Date.now", "Math.random", "document", "indexedDB", "innerHTML"]) {
    assert.ok(!source.includes(interdit), `le source du journal contient « ${interdit} »`);
  }
});
