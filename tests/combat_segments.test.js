// Contrôles des segments du journal du combat (SPECIFICATION.md, § 17.9 ;
// contrat du groupe 2 du lot 4, § 2.6 et § 3) : js/combat/journal.js.
//
// Chaque ligne du journal naît en segments typés, dont l'écran tire ses
// couleurs, ses cadres, la coupe du bandeau et les lignes barrées, sans
// jamais relire le texte. Ce fichier tient :
// - la règle d'or, gabarit par gabarit (le contrat du groupe 1, § 6 et son
//   annexe A) : les segments redonnent le texte, et le texte est celui du
//   groupe 1, au signe près ;
// - la place de chaque type de segment, et les cadres des jets (un dé
//   insécable par essai, les séparateurs hors des dés, la localisation hors
//   cadre) ;
// - des noms piégés, qui portent ce qu'un écran tenté de relire le texte y
//   chercherait (« → », « ✓ », « contre », « Annulé : », « — », « … ») ;
// - la ligne en cours (le bandeau), écrite à la main pour chaque moment ;
// - le nom d'un geste, la ligne « Annulé » et sa plage, et son annonce.
//
// Le combat de référence, lui, est vu en segments dans
// tests/combat_journal.test.js, où ses gestes sont écrits. Les états et les
// gestes sont écrits à la main, sans le moteur ; les jets sont montés par
// js/combat/jet.js, dé après dé. Les noms viennent de la démonstration, sauf
// les noms d'essai que le contrat permet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { annonce, ligneDuGeste, ligneEnCours, lignes, nommerLeGeste, phrasesDuGeste, segmentsDuGeste } from "../js/combat/journal.js";
import { exploser, garder, jetFini, lancerDe, ouvrirJet, relancer } from "../js/combat/jet.js";
import { nommer } from "../js/combat/noms.js";
import { DIFFICULTES, SIGNES, geler } from "../js/combat/regles.js";
import { photoDe } from "../js/combat/valeurs.js";
import {
  adversaireEssai,
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
  // Le lot 4.3 : les blessures qu'un PJ a choisies, une par zone blessée
  // (contrat de la vague 1, § 5.9).
  blessures: [],
};

// Un geste tel que le moteur le tient, gelé. Un champ mal orthographié
// passerait sans bruit : il est refusé.
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

function chaineFinie(circonstances, ...pas) {
  const jet = chaine(circonstances, ...pas);
  assert.ok(jetFini(jet), `la chaîne ${JSON.stringify(pas)} n'est pas finie : elle attend « ${jet.attente} »`);
  return jet;
}

const VIF = { genre: "passif", nom: "Vif", valeur: 1 };
// Un modificateur de −N. Son genre, « blessures », n'est plus de ceux que les
// circonstances posent (lot 4.3, mission § 4.10 : la fin du −1) ; le journal
// n'en lit que la valeur, et ces gabarits n'éprouvent que l'écriture du signe.
const blessures = (nombre) => ({ genre: "blessures", nom: null, valeur: -nombre });
const SOLO = { genre: "passif", nom: "Solo du chef", nombre: 1, de: null };
const MELES = { genre: "armure_melee", nom: null, nombre: 1, de: null };
const horsMaitrise = (nom, de = null) => ({ genre: "maitrise", nom, nombre: 1, de });
const mainAvantageuse = (nombre, raison) => ({ genre: "main", nom: raison, nombre, de: null });

// Les jets du duel : le couteau d'Aubépine est un d8, la défense du Marmiton
// vaut 5, son attaque 4.
const attaqueDuPj = (champs = {}) => ({ genre: "attaque", lanceur: "pj1", faces: 8, mobilisees: ["precision", "agilite"], difficulte: 5, ...champs });
const defenseDuPj = (champs = {}) => ({ genre: "defense", lanceur: "pj1", faces: 8, mobilisees: ["agilite", "creativite"], difficulte: 4, ...champs });

// Un état lancé, écrit à la main, aux noms que donne nommer() ; « noms »
// les remplace, pour les noms piégés.
function etatDe(protagonistes, { mode = "demo", quiCommence = "pj", noms: pieges = {}, ...options } = {}) {
  const miseEnPlace = miseEnPlaceEssai(protagonistes, { mode, quiCommence });
  const noms = nommer(miseEnPlace.protagonistes.map(({ id, camp, photo }) => ({ id, camp, nom: photo.valeurs.nom })));
  for (const [id, champs] of Object.entries(pieges)) noms[id] = { ...noms[id], ...champs };
  return etatEssai(miseEnPlace, { noms, ...options });
}

// « Aubépine » (pj1) contre « Marmiton » (adv2).
const duel = ({ pj, adv, ...options } = {}) => etatDe([{ photo: pjEssai(pj) }, { photo: adversaireEssai(adv) }], options);

// La démonstration : pj1, adv2 (le Chef), adv3 et adv4 (les deux Marmitons).
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

function faconDePuissance(etat, id, nom, puissance) {
  const rang = photoDe(etat, id).capacites[indice(etat, id, nom)].facons.findIndex((facon) => facon.puissance === puissance);
  assert.notEqual(rang, -1, `${id} n'a pas « ${nom} » à la puissance ${puissance}`);
  return rang;
}

// Un Marmiton à deux armes de même nom (annexe A, n° 17) : sa Frappe vient de
// l'une ou de l'autre.
const deuxSpatules = (valeurs) => {
  valeurs.armes.push({ ...valeurs.armes[0], libelle: "Spatule souple (2)" });
  valeurs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Spatule souple (2)", cout: { souffle: 2, lien: 0 }, attaque: true, degats: [5, 10, 15] }));
};

// Une adversaire sans arme : ses dégâts se saisissent à la main.
const mouette = (valeurs) => {
  valeurs.nom = "Mouette chapardeuse";
  valeurs.armes = [];
  valeurs.capacites = [capaciteEssai({ nom: "Frappe", groupe: { genre: "capacites", titre: "Capacités" }, facons: [faconEssai({ description: "Un coup de bec." })] })];
};

// Une Frappe à plusieurs d20.
const aPlusieursD20 = (nombre) => (valeurs) => {
  for (const facon of valeurs.capacites[0].facons) facon.locMultiple = nombre;
};

// La blessure que choisit un PJ : une capacité du bloc de blessure, figée.
const MAIN_BRULEE = etatsEssai().blessure.find((capacite) => capacite.nom === "Main brûlée");

const pasDeCote = (etat, x) => ({ qui: "pj1", capacite: indice(etat, "pj1", "Pas de côté"), prix: { actions: 1, souffle: x }, effet: { genre: "annuler", x } });

// ─── Ce que toute ligne tient ───────────────────────────────────────────────

const TYPES = ["texte", "acteur", "capacite", "cible", "reussi", "echoue", "lettre", "ajuste", "mort", "fin_de_tour", "tour", "suite"];
const GENRES_DE_PHRASE = ["lancement", "tour", "fin_de_tour", "fin", "passe", "annule", "ouverture", "sources", "jet", "localisation", "intervention", "degats", "blessures", "mort"];
const INSECABLES = [0x00a0, 0x202f].map((code) => String.fromCodePoint(code));
const SUITE = String.fromCodePoint(0x2026);

/**
 * Ce que toute ligne fabriquée tient (contrat du groupe 2, § 3.1) : gelée ;
 * ses segments redonnent son texte (la règle d'or) ; aucun n'est vide, ni ne
 * porte d'espace insécable ; leurs phrases se suivent, jointes par une espace
 * hors phrase, une par genre ; « acteur » en tête d'une ligne de geste ou de
 * passe, et nulle part ailleurs ; « acteur » et « cible » avec leur camp,
 * personne d'autre ; « ✓ » et « ✗ » dans un dé, et seulement là ; les dés
 * dans un seul cadre, d'un tenant ; la mort en dernier ; « … » en dernier, et
 * seulement sur la ligne en cours.
 *
 * Les noms piégés portent « ✓ » ou « ✗ » : « pieges » ne cherche alors plus
 * ces signes hors des dés (les noms se vérifient à part).
 */
function verifierLaLigne(ligne, quoi, { pieges = false } = {}) {
  const { segments, phrases } = ligne;
  assert.ok(Object.isFrozen(ligne) && Object.isFrozen(segments) && Object.isFrozen(phrases) && segments.every(Object.isFrozen), `${quoi} : gelée`);
  assert.equal(segments.map((segment) => segment.texte).join(""), ligne.texte, `${quoi} : la règle d'or`);
  assert.ok(phrases.length > 0 && phrases.every((genre) => GENRES_DE_PHRASE.includes(genre)), `${quoi} : les genres de ses phrases`);
  for (const insecable of INSECABLES) assert.ok(!ligne.texte.includes(insecable), `${quoi} : une espace insécable`);

  let phrase = 0;
  const cadre = [];
  segments.forEach((segment, rang) => {
    const ici = `${quoi}, segment ${rang} (« ${segment.texte} »)`;
    assert.ok(TYPES.includes(segment.type), `${ici} : le type ${segment.type}`);
    assert.ok(typeof segment.texte === "string" && segment.texte !== "", `${ici} : vide`);
    if (segment.phrase === null) {
      if (segment.type === "suite") {
        assert.ok(rang === segments.length - 1 && ligne.enCours === true && segment.texte === SUITE, `${ici} : « … » en dernier, sur la ligne en cours`);
      } else {
        assert.ok(segment.type === "texte" && segment.texte === " " && rang > 0 && rang < segments.length - 1, `${ici} : hors phrase, une espace entre deux phrases`);
        phrase += 1;
      }
    } else {
      assert.equal(segment.phrase, phrase, `${ici} : sa phrase`);
    }
    if (segment.type === "acteur") assert.ok(rang === 0 && ligne.genre === "geste" && ["ouverture", "passe", "jet"].includes(phrases[0]), `${ici} : l'acteur ailleurs qu'en tête d'un geste`);
    if (segment.type === "acteur" || segment.type === "cible") assert.ok(["pj", "adv"].includes(segment.camp), `${ici} : son camp`);
    else assert.ok(!Object.hasOwn(segment, "camp"), `${ici} : un camp hors d'un nom`);
    if (segment.type === "reussi" || segment.type === "echoue") {
      assert.ok(Number.isInteger(segment.de) && segment.jet === 0, `${ici} : un signe hors d'un dé`);
      assert.equal(segment.texte, segment.type === "reussi" ? SIGNES.reussi : SIGNES.echoue, `${ici} : le signe`);
    } else if (!pieges) {
      assert.ok(!segment.texte.includes(SIGNES.reussi) && !segment.texte.includes(SIGNES.echoue), `${ici} : « ✓ » ou « ✗ » hors d'un dé`);
    }
    if (Object.hasOwn(segment, "de")) assert.ok(Number.isInteger(segment.de) && segment.jet === 0, `${ici} : un dé hors du cadre`);
    if (Object.hasOwn(segment, "jet")) {
      assert.equal(segment.jet, 0, `${ici} : un seul jet par ligne`);
      cadre.push(rang);
    }
    if (segment.type === "mort") assert.ok(rang === segments.length - 1 && phrases[segment.phrase] === "mort", `${ici} : la mort en dernier`);
  });
  assert.equal(phrase, phrases.length - 1, `${quoi} : une phrase par genre`);
  if (cadre.length > 0) {
    assert.equal(dernierDe(cadre) - cadre[0] + 1, cadre.length, `${quoi} : le cadre d'un tenant`);
    assert.equal(phrases[segments[cadre[0]].phrase], "jet", `${quoi} : le cadre dans la phrase du jet`);
    // Les dés se comptent de 0, un par essai, dans l'ordre ; leurs segments se suivent.
    const des = cadre.map((rang) => segments[rang].de).filter((de) => de !== undefined);
    des.forEach((de, rang) => assert.ok(de === (rang === 0 ? 0 : des[rang - 1]) || de === des[rang - 1] + 1, `${quoi} : les dés dans l'ordre`));
    for (const rang of cadre) {
      if (segments[rang].de === undefined) assert.equal(segments[rang].type, "texte", `${quoi} : un séparateur du cadre est du texte`);
    }
  }
}

const dernierDe = (liste) => liste[liste.length - 1];

// Les phrases de la ligne d'un geste sont celles de segmentsDuGeste.
function verifierLesPhrases(etat, geste, ligne, quoi) {
  const phrases = phrasesDuGeste(etat, geste);
  assert.deepEqual(
    phrases.map((une) => une.genre),
    ligne.phrases,
    `${quoi} : les genres des phrases`,
  );
  assert.deepEqual(
    phrases.map((une) => une.segments.map((segment) => segment.texte).join("")),
    segmentsDuGeste(etat, geste),
    `${quoi} : les phrases de segmentsDuGeste`,
  );
}

// Un segment, réduit à ce que l'écran en lit.
const vu = ({ type, texte, camp, jet, de }) => ({ type, texte, ...(camp === undefined ? {} : { camp }), ...(jet === undefined ? {} : { jet }), ...(de === undefined ? {} : { de }) });
// Le cadre d'une ligne : ses segments de jet, réduits.
const cadreDe = (ligne) => ligne.segments.filter((segment) => segment.jet === 0).map(({ type, texte, de }) => (de === undefined ? { type, texte } : { type, texte, de }));

// ─── Le catalogue des gabarits ──────────────────────────────────────────────

// Une ligne par gabarit du contrat du groupe 1 (§ 6.2 à § 6.4) et de son
// annexe A, avec son texte attendu, mot pour mot, et le genre de ses phrases.
function catalogue() {
  const lignesDuCatalogue = [];
  const ajouter = (nom, etat, geste, texte, phrases) => lignesDuCatalogue.push({ nom, etat, geste, texte, phrases });

  const etat = duel();
  const demo = demonstration();
  const frappe = (champs) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", ...champs });
  const recue = (champs) => gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", ...champs });

  // L'ouverture seule : sans jet, un déplacement.
  ajouter("sans jet, contre", etat, gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), facon: 1, prix: prix({ souffle: 10 }), cible: "adv2" }), "Aubépine : Flambage [2] (10 souffle) contre Marmiton.", ["ouverture"]);
  ajouter("sans jet, sur soi", etat, gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), prix: prix({ souffle: 5 }), cible: "pj1" }), "Aubépine : Flambage [1] (5 souffle) sur Aubépine.", ["ouverture"]);
  ajouter("sans jet, sans cible", etat, gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), prix: prix({ souffle: 5 }) }), "Aubépine : Flambage [1] (5 souffle).", ["ouverture"]);
  ajouter(
    "sans jet, sur un allié",
    demo,
    gesteEssai({ acteur: "adv3", mode: "sans_jet", capacite: indice(demo, "adv3", "Moulinet farineux"), prix: prix({ souffle: 5 }), cible: "adv4" }),
    "Marmiton n° 1 : Moulinet farineux [1] (5 souffle) sur Marmiton n° 2.",
    ["ouverture"],
  );
  ajouter(
    "un déplacement",
    demo,
    gesteEssai({ acteur: "adv2", mode: "deplacement", capacite: indice(demo, "adv2", "Pas chassé"), facon: faconDePuissance(demo, "adv2", "Pas chassé", 2), prix: prix({ souffle: 1 }), depart: "F6", arrivee: "D4" }),
    "Chef : Pas chassé [2] (1 souffle), F6 → D4.",
    ["ouverture"],
  );

  // L'arme dans la parenthèse (annexe A, n° 10 et n° 17), le lien non payé (n° 11).
  const spatules = duel({ adv: deuxSpatules });
  ajouter(
    "deux armes de même nom",
    spatules,
    gesteEssai({ acteur: "adv2", mode: "sans_jet", capacite: indice(spatules, "adv2", "Frappe"), facon: 1, prix: prix({ souffle: 2 }), cible: "pj1" }),
    "Marmiton : Frappe (Spatule souple (2), 2 souffle) contre Aubépine.",
    ["ouverture"],
  );
  ajouter(
    "le jet prêté d'un adversaire à plusieurs armes",
    spatules,
    gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee: 1, capacite: indice(spatules, "adv2", "Moulinet farineux"), prix: prix({ souffle: 5 }), cible: "pj1" }),
    "Marmiton : Moulinet farineux [1] (Spatule souple (2), 5 souffle) contre Aubépine.",
    ["ouverture"],
  );
  ajouter(
    "le lien non payé, seul",
    etat,
    gesteEssai({ acteur: "adv2", mode: "sans_jet", capacite: indice(etat, "adv2", "Moulinet farineux"), prix: prix({ lienNonPaye: 1 }), cible: "pj1" }),
    "Marmiton : Moulinet farineux [1] (coût en lien non payé : un adversaire n'a pas de lien) contre Aubépine.",
    ["ouverture"],
  );
  ajouter(
    "le lien non payé, après le coût",
    etat,
    gesteEssai({ acteur: "adv2", mode: "sans_jet", capacite: indice(etat, "adv2", "Moulinet farineux"), prix: prix({ souffle: 5, lienNonPaye: 1 }), cible: "pj1" }),
    "Marmiton : Moulinet farineux [1] (5 souffle ; coût en lien non payé : un adversaire n'a pas de lien) contre Aubépine.",
    ["ouverture"],
  );

  // Les attaques d'un PJ.
  ajouter("manquée", etat, frappe({ jet: chaineFinie(attaqueDuPj(), [2]) }), "Aubépine : Frappe contre Marmiton. d8 contre 5 → 2 ✗ : aucune réussite, manqué.", ["ouverture", "jet"]);
  ajouter(
    "l'attaque ajustée qui tue (G1 § 6.6)",
    demo,
    gesteEssai({
      capacite: indice(demo, "pj1", "Émincer"),
      prix: prix({ souffle: 4 }),
      cible: "adv4",
      jet: chaineFinie({ genre: "attaque", lanceur: "pj1", faces: 10, difficulte: 5, modificateurs: [VIF], avantages: [SOLO], desavantages: [horsMaitrise("Émincer")] }, [6], [8], [2]),
      degats: ajuste("lettre", 22, "Émincer"),
      localisation: [d20(20)],
      resultat: resultat([coup(zone(demo, "adv4", "tete"), { armure: [5, 0], resistance: [5, 0], corps: [10, 0], blessure: true, blessures: 1 })], true),
    }),
    "Aubépine : Émincer (4 souffle) contre Marmiton n° 2. Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent. d10+1 contre 5 → 7 ✓, 9 ✓, 3 ✗ : 2 réussites, B = 8, ajusté à 22 (Émincer), +2 contre l'armure (Réduction). Localisation d20 → 20 : tête. Armure 5 → 0, endurance 5 → 0, corps 10 → 0. Marmiton n° 2 meurt.",
    ["ouverture", "sources", "jet", "localisation", "degats", "mort"],
  );
  ajouter(
    "le dé au choix, une relance, une blessure sans effet calculé",
    etat,
    frappe({
      capacite: indice(etat, "pj1", "Taloche"),
      caracteristiques: ["force", "agilite"],
      jet: chaineFinie(attaqueDuPj({ caracteristiques: ["force", "agilite"], mobilisees: ["force", "agilite"], modificateurs: [VIF], avantages: [SOLO] }), [7], [3], "relancer", [5], [8]),
      degats: LETTRE,
      localisation: [d20(14)],
      resultat: resultat([coup(zone(etat, "adv2", "jambe_droite"), { resistance: [5, 0], corps: [10, 7], blessure: true, blessures: 1 })]),
    }),
    "Aubépine : Taloche [1] contre Marmiton. d8+1 (Force + Agilité) contre 5, 1 avantage → 8 ✓, 4 ✗, relancé 6 ✓, 9 ✓ : 3 réussites, C = 8. Localisation d20 → 14 : jambe droite. Endurance 5 → 0, corps 10 → 7. Blessure (jambe droite), sans effet calculé.",
    ["ouverture", "jet", "localisation", "degats", "blessures"],
  );
  ajouter(
    "les sources qui laissent un désavantage (annexe A, n° 3)",
    etat,
    frappe({ jet: chaineFinie(attaqueDuPj({ avantages: [SOLO], desavantages: [horsMaitrise("Émincer"), mainAvantageuse(1, "Fumée")] }), [7, 3]) }),
    "Aubépine : Frappe contre Marmiton. Son avantage (Solo du chef) et ses 2 désavantages (Émincer hors maîtrise, à la main : Fumée) laissent 1 désavantage. d8 contre 5, 1 désavantage → 7/3 → 3 ✗ : aucune réussite, manqué.",
    ["ouverture", "sources", "jet"],
  );
  ajouter(
    "le net quand les sources ont nommé la main (annexe A, n° 4)",
    etat,
    frappe({ jet: chaineFinie(attaqueDuPj({ avantages: [SOLO, mainAvantageuse(1, "Minutie")], desavantages: [horsMaitrise("Émincer")] }), [7], [2], "garder"), degats: LETTRE }),
    "Aubépine : Frappe contre Marmiton. Ses 2 avantages (Solo du chef, à la main : Minutie) et son désavantage (Émincer hors maîtrise) laissent 1 avantage. d8 contre 5, 1 avantage → 7 ✓, 2 ✗ : 1 réussite, A = 5.",
    ["ouverture", "sources", "jet"],
  );
  ajouter(
    "le net dont une part vient de la main (annexe A, n° 19)",
    etat,
    frappe({ jet: chaineFinie(attaqueDuPj({ avantages: [SOLO, mainAvantageuse(1, "Minutie")] }), [7], [2], "garder"), degats: LETTRE }),
    "Aubépine : Frappe contre Marmiton. d8 contre 5, 2 avantages (dont 1 à la main : Minutie) → 7 ✓, 2 ✗ : 1 réussite, A = 5.",
    ["ouverture", "jet"],
  );
  ajouter(
    "« Sans dégâts », puis un nombre saisi (annexe A, n° 8)",
    etat,
    gesteEssai({
      mode: "jet_prete",
      armePretee: 0,
      capacite: indice(etat, "pj1", "Fournaise"),
      prix: prix({ souffle: 1, lien: 1, jauge: 0 }),
      cible: "adv2",
      jet: chaineFinie(attaqueDuPj(), [6], [2]),
      degats: ajuste("aucun", 6, "Fournaise"),
    }),
    "Aubépine : Fournaise [1] (1 souffle, 1 lien) contre Marmiton. d8 contre 5 → 6 ✓, 2 ✗ : 1 réussite, touché, ajusté à 6 (Fournaise).",
    ["ouverture", "jet"],
  );
  ajouter(
    "« Dégâts de l'arme »",
    etat,
    gesteEssai({ mode: "jet_prete", armePretee: 0, capacite: indice(etat, "pj1", "Fournaise"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [7], [1]), degats: ARME }),
    "Aubépine : Fournaise [1] contre Marmiton. d8 contre 5 → 6 ✓, 7 ✓, 1 ✗ : 2 réussites, touché, dégâts de l'arme : B = 10.",
    ["ouverture", "jet"],
  );
  ajouter(
    "les dégâts directs (annexe A, n° 9)",
    etat,
    frappe({ jet: chaineFinie(attaqueDuPj(), [6], [7], [1]), degats: ajuste("lettre", 3, "Flambage", "corps") }),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 7 ✓, 1 ✗ : 2 réussites, B = 10, dégâts directs au corps : 3 (Flambage).",
    ["ouverture", "jet"],
  );
  ajouter(
    "la face de contre-attaque avant le dernier d20 (annexe A, n° 16)",
    duel({ pj: aPlusieursD20(3) }),
    frappe({ jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: LETTRE, localisation: [d20(6), d20(1)] }),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 2 ✗ : 1 réussite, A = 5. Localisation 3 d20 → 6 : torse ; 1 : contre-attaque, l'attaque est annulée.",
    ["ouverture", "jet", "localisation"],
  );

  // Les défenses d'Aubépine.
  ajouter("trois réussites, aucun dégât", etat, recue({ jet: chaineFinie(defenseDuPj(), [6], [7], [8]) }), "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 7 ✓, 8 ✓ : 3 réussites, aucun dégât.", ["ouverture", "jet"]);
  ajouter(
    "un passif de niveau 2 dans les sources (annexe A, n° 2)",
    etat,
    recue({ jet: chaineFinie(defenseDuPj({ avantages: [{ ...SOLO, nombre: 2 }], desavantages: [MELES] }), [6], [3], "garder"), degats: LETTRE }),
    "Marmiton : Frappe contre Aubépine. Ses 2 avantages (Solo du chef) et son désavantage (types d'armure mêlés) laissent 1 avantage. Aubépine lance sa défense, d8 contre 4, 1 avantage → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10.",
    ["ouverture", "sources", "jet"],
  );
  ajouter(
    "la face de contre-attaque après un jet qui a touché (annexe A, n° 15)",
    etat,
    recue({ jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE, localisation: [d20(20)] }),
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation d20 → 20 : contre-attaque, l'attaque est annulée.",
    ["ouverture", "jet", "localisation"],
  );
  const lourde = duel({ adv: aPlusieursD20(2) });
  ajouter(
    "l'esquive sur deux coups, les dégâts et les blessures de chacun (annexe A, n° 12 à n° 14)",
    lourde,
    gesteEssai({
      acteur: "adv2",
      capacite: indice(lourde, "adv2", "Frappe"),
      cible: "pj1",
      jet: chaineFinie(defenseDuPj(), [6], [3]),
      degats: LETTRE,
      localisation: [d20(12), d20(6)],
      interventions: [pasDeCote(lourde, 3)],
      // Le lot 4.3 (mission, § 4.10) : la zone n'est blessée que si le coup lui ôte du corps, et Aubépine
      // choisit sa blessure dans le bloc de blessure ; plus de « −1 à ses jets ».
      resultat: resultat([
        coup(zone(lourde, "pj1", "jambe_gauche"), { armure: [10, 10], resistance: [5, 0], corps: [10, 8], blessure: true, blessures: 1 }),
        coup(zone(lourde, "pj1", "torse"), { armure: [10, 3], corps: [8, 8] }),
      ]),
      blessures: [{ zone: zone(lourde, "pj1", "jambe_gauche"), capacite: MAIN_BRULEE, libre: null }],
    }),
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation 2 d20 → 12 : jambe gauche ; 6 : torse. Aubépine intervient : Pas de côté (1 action, 3 souffle), jambe gauche 10 → 7. Jambe gauche : endurance 5 → 0, corps 10 → 8. Torse : armure 10 → 3. Blessure (jambe gauche) : Main brûlée.",
    ["ouverture", "jet", "localisation", "intervention", "degats", "blessures"],
  );
  const sansArme = duel({ adv: mouette });
  const bec = (degats, ...pas) =>
    gesteEssai({ acteur: "adv2", mode: "jet_prete", capacite: indice(sansArme, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), ...pas), degats });
  ajouter("sans dégâts propres ni nombre saisi (annexe A, n° 6)", sansArme, bec(AUCUN, [6], [3]), "Mouette : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, touché.", ["ouverture", "jet"]);
  ajouter(
    "sans réussite, aux dégâts saisis (annexe A, n° 20)",
    sansArme,
    bec(ajuste("aucun", 4, "Frappe"), [3]),
    "Mouette : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 3 ✗ : aucune réussite, Aubépine reçoit 4 (à la main : Frappe).",
    ["ouverture", "jet"],
  );
  ajouter(
    "contre un jet prêté, « Dégâts de l'arme » (annexe A, n° 7)",
    etat,
    gesteEssai({ acteur: "adv2", mode: "jet_prete", armePretee: 0, capacite: indice(etat, "adv2", "Moulinet farineux"), prix: prix({ souffle: 5 }), cible: "pj1", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: ARME }),
    "Marmiton : Moulinet farineux [1] (5 souffle) contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, touché, dégâts de l'arme : B = 10.",
    ["ouverture", "jet"],
  );

  // Les jets de caractéristique : une phrase.
  const gouter = (circonstances, ...pas) =>
    gesteEssai({
      mode: "caracteristique",
      capacite: indice(demo, "pj1", "Goûter"),
      caracteristiques: circonstances.caracteristiques,
      difficulte: circonstances.difficulte,
      jet: chaineFinie({ genre: "caracteristique", lanceur: "pj1", faces: 6, mobilisees: circonstances.caracteristiques, libelle: DIFFICULTES[circonstances.difficulte], ...circonstances }, ...pas),
    });
  ajouter(
    "le jet de caractéristique qui explose deux fois",
    demo,
    gouter({ caracteristiques: ["savoir_sauvage", "sens"], difficulte: 6, modificateurs: [blessures(1)] }, [6], "exploser", [6], [6], "exploser", [2], [3]),
    "Aubépine : Goûter, d6−1 (Savoir sauvage + Sens) contre 6 (compliqué) → 5 explose, + 6 = 11 ✓, 5 explose, + 2 = 7 ✓, 2 ✗ : 2 réussites.",
    ["jet"],
  );
  ajouter(
    "une seule caractéristique (annexe A, n° 5)",
    demo,
    gouter({ caracteristiques: ["sens"], difficulte: 4 }, [5], [6], [4]),
    `Aubépine : Goûter, d6 (Sens) contre 4 (${DIFFICULTES[4]}) → 5 ✓, 6 ✓, 4 ✓ : 3 réussites.`,
    ["jet"],
  );
  return lignesDuCatalogue;
}

// ─── a) La règle d'or, gabarit par gabarit ──────────────────────────────────

test("chaque gabarit : la ligne fabriquée a le texte du groupe 1, mot pour mot, et ses segments le redonnent", () => {
  const vues = catalogue();
  assert.equal(vues.length, 28, "un cas par gabarit");
  for (const { nom, etat, geste, texte, phrases } of vues) {
    const ligne = lignes.geste(etat, geste);
    assert.equal(ligne.texte, texte, nom);
    assert.equal(ligneDuGeste(etat, geste), texte, `${nom} : ligneDuGeste`);
    assert.equal(ligne.genre, "geste", nom);
    assert.deepEqual(ligne.phrases, phrases, `${nom} : ses phrases`);
    assert.equal(Object.hasOwn(ligne, "mort"), geste.resultat?.mort === true, `${nom} : mort`);
    verifierLaLigne(ligne, nom);
    verifierLesPhrases(etat, geste, ligne, nom);
  }
});

test("les lignes du cadre et la passe : une phrase, son genre, ses segments", () => {
  const etat = demonstration();
  const seul = (phrase, type, texte) => ({ segments: [{ type, texte, phrase: 0 }], phrases: [phrase] });
  assert.deepEqual(lignes.lancement(etat), {
    genre: "cadre",
    texte: "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent.",
    ...seul("lancement", "texte", "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent."),
  });
  assert.deepEqual(lignes.tour({ numero: 2, camp: "adv" }), { genre: "tour", texte: "— Tour 2 · camp des adversaires —", ...seul("tour", "tour", "— Tour 2 · camp des adversaires —") });
  assert.deepEqual(lignes.finDeTour("pj"), {
    genre: "cadre",
    texte: "Fin du tour des PJ : ils retrouvent leurs actions.",
    ...seul("fin_de_tour", "fin_de_tour", "Fin du tour des PJ : ils retrouvent leurs actions."),
  });
  assert.deepEqual(lignes.fin("adv"), { genre: "fin", texte: "Combat terminé : victoire des adversaires.", ...seul("fin", "texte", "Combat terminé : victoire des adversaires.") });
  assert.deepEqual(lignes.passe(etat, "adv4"), {
    genre: "geste",
    texte: "Marmiton n° 2 passe son tour.",
    segments: [
      { type: "acteur", texte: "Marmiton n° 2", phrase: 0, camp: "adv" },
      { type: "texte", texte: " passe son tour.", phrase: 0 },
    ],
    phrases: ["passe"],
  });
  for (const ligne of [lignes.lancement(etat), lignes.tour({ numero: 1, camp: "pj" }), lignes.finDeTour("adv"), lignes.fin("pj"), lignes.passe(etat, "pj1")]) verifierLaLigne(ligne, ligne.texte);

  // Les fabriques : dix, dans un objet gelé. Le lot 4.3 a ajouté l'échéance, l'effet hors d'un geste et le geste du
  // MJ, dont les lignes sont éprouvées dans combat_g3_journal.test.js.
  assert.ok(Object.isFrozen(lignes));
  assert.deepEqual(Object.keys(lignes).sort(), ["annulation", "echeance", "effet", "fin", "finDeTour", "geste", "lancement", "mj", "passe", "tour"]);
});

// ─── b) Chaque type à sa place ──────────────────────────────────────────────

test("l'ouverture : l'acteur et la cible avec leur camp, la capacité avec sa puissance, le reste en texte", () => {
  const vues = new Map(catalogue().map((cas) => [cas.nom, cas]));
  const ouverture = (nom) => {
    const { etat, geste } = vues.get(nom);
    return lignes.geste(etat, geste).segments.filter((segment) => segment.phrase === 0).map(vu);
  };
  assert.deepEqual(ouverture("sans jet, contre"), [
    { type: "acteur", texte: "Aubépine", camp: "pj" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Flambage [2]" },
    { type: "texte", texte: " (10 souffle) contre " },
    { type: "cible", texte: "Marmiton", camp: "adv" },
    { type: "texte", texte: "." },
  ]);
  assert.deepEqual(ouverture("sans jet, sur un allié"), [
    { type: "acteur", texte: "Marmiton n° 1", camp: "adv" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Moulinet farineux [1]" },
    { type: "texte", texte: " (5 souffle) sur " },
    { type: "cible", texte: "Marmiton n° 2", camp: "adv" },
    { type: "texte", texte: "." },
  ]);
  assert.deepEqual(ouverture("sans jet, sur soi").slice(-2), [
    { type: "cible", texte: "Aubépine", camp: "pj" },
    { type: "texte", texte: "." },
  ]);
  assert.deepEqual(ouverture("sans jet, sans cible"), [
    { type: "acteur", texte: "Aubépine", camp: "pj" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Flambage [1]" },
    { type: "texte", texte: " (5 souffle)." },
  ]);
  assert.deepEqual(ouverture("un déplacement"), [
    { type: "acteur", texte: "Chef", camp: "adv" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Pas chassé [2]" },
    { type: "texte", texte: " (1 souffle), F6 → D4." },
  ]);
  assert.deepEqual(ouverture("manquée"), [
    { type: "acteur", texte: "Aubépine", camp: "pj" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Frappe" },
    { type: "texte", texte: " contre " },
    { type: "cible", texte: "Marmiton", camp: "adv" },
    { type: "texte", texte: "." },
  ]);
  // Le jet de caractéristique : l'ouverture est dans la phrase du jet.
  const { etat, geste } = vues.get("une seule caractéristique (annexe A, n° 5)");
  assert.deepEqual(lignes.geste(etat, geste).segments.slice(0, 4).map(vu), [
    { type: "acteur", texte: "Aubépine", camp: "pj" },
    { type: "texte", texte: " : " },
    { type: "capacite", texte: "Goûter" },
    { type: "texte", texte: `, d6 (Sens) contre 4 (${DIFFICULTES[4]}) → ` },
  ]);
});

test("le bilan : chaque « {L} = {v} » en lettre, le seul nombre après « ajusté à » en ajusté ; le reste en texte", () => {
  const vues = new Map(catalogue().map((cas) => [cas.nom, cas]));
  const apresLeCadre = (nom) => {
    const { etat, geste } = vues.get(nom);
    const ligne = lignes.geste(etat, geste);
    const jet = ligne.phrases.indexOf("jet");
    const segments = ligne.segments.filter((segment) => segment.phrase === jet);
    const fin = segments.findLastIndex((segment) => segment.jet === 0);
    return segments.slice(fin + 1).map(vu);
  };
  assert.deepEqual(apresLeCadre("l'attaque ajustée qui tue (G1 § 6.6)"), [
    { type: "texte", texte: " : 2 réussites, " },
    { type: "lettre", texte: "B = 8" },
    { type: "texte", texte: ", ajusté à " },
    { type: "ajuste", texte: "22" },
    { type: "texte", texte: " (Émincer), +2 contre l'armure (Réduction)." },
  ]);
  assert.deepEqual(apresLeCadre("« Sans dégâts », puis un nombre saisi (annexe A, n° 8)"), [
    { type: "texte", texte: " : 1 réussite, touché, ajusté à " },
    { type: "ajuste", texte: "6" },
    { type: "texte", texte: " (Fournaise)." },
  ]);
  assert.deepEqual(apresLeCadre("« Dégâts de l'arme »"), [
    { type: "texte", texte: " : 2 réussites, touché, dégâts de l'arme : " },
    { type: "lettre", texte: "B = 10" },
    { type: "texte", texte: "." },
  ]);
  assert.deepEqual(apresLeCadre("un passif de niveau 2 dans les sources (annexe A, n° 2)"), [
    { type: "texte", texte: " : 1 réussite, Aubépine reçoit " },
    { type: "lettre", texte: "B = 10" },
    { type: "texte", texte: "." },
  ]);
  assert.deepEqual(
    apresLeCadre("les dégâts directs (annexe A, n° 9)"),
    [
      { type: "texte", texte: " : 2 réussites, " },
      { type: "lettre", texte: "B = 10" },
      { type: "texte", texte: ", dégâts directs au corps : 3 (Flambage)." },
    ],
    "les dégâts directs restent du texte",
  );
  assert.deepEqual(
    apresLeCadre("sans réussite, aux dégâts saisis (annexe A, n° 20)"),
    [{ type: "texte", texte: " : aucune réussite, Aubépine reçoit 4 (à la main : Frappe)." }],
    "« reçoit 4 (à la main : …) » reste du texte",
  );
  assert.deepEqual(apresLeCadre("manquée"), [{ type: "texte", texte: " : aucune réussite, manqué." }]);
  assert.deepEqual(apresLeCadre("trois réussites, aucun dégât"), [{ type: "texte", texte: " : 3 réussites, aucun dégât." }]);
  assert.deepEqual(apresLeCadre("une seule caractéristique (annexe A, n° 5)"), [{ type: "texte", texte: " : 3 réussites." }]);

  // Le compte, sur tout le catalogue : une lettre par bilan qui en a une, un seul nombre ajusté.
  const types = catalogue().flatMap(({ etat, geste }) => lignes.geste(etat, geste).segments.map((segment) => segment.type));
  assert.equal(types.filter((type) => type === "ajuste").length, 2);
  assert.equal(types.filter((type) => type === "lettre").length, 11);
});

test("les phrases qui suivent le jet restent du texte, et la mort ferme la ligne", () => {
  const vues = new Map(catalogue().map((cas) => [cas.nom, cas]));
  const { etat, geste } = vues.get("l'esquive sur deux coups, les dégâts et les blessures de chacun (annexe A, n° 12 à n° 14)");
  const ligne = lignes.geste(etat, geste);
  for (const genre of ["localisation", "intervention", "degats", "blessures"]) {
    const segments = ligne.segments.filter((segment) => segment.phrase === ligne.phrases.indexOf(genre));
    assert.equal(segments.length, 1, genre);
    assert.equal(segments[0].type, "texte", genre);
  }
  assert.ok(!ligne.segments.some((segment) => segment.type === "cible" && segment.phrase > 0), "un nom répété plus loin est du texte");

  const tue = vues.get("l'attaque ajustée qui tue (G1 § 6.6)");
  const mortelle = lignes.geste(tue.etat, tue.geste);
  assert.equal(mortelle.mort, true);
  assert.deepEqual(vu(dernierDe(mortelle.segments)), { type: "mort", texte: "Marmiton n° 2 meurt." });
  assert.equal(mortelle.segments.filter((segment) => segment.type === "mort").length, 1);
  const vivante = vues.get("manquée");
  assert.equal(Object.hasOwn(lignes.geste(vivante.etat, vivante.geste), "mort"), false, "mort: true seulement quand la victime meurt");
});

// ─── c) Les cadres ──────────────────────────────────────────────────────────

test("le cadre : un dé insécable par essai, les séparateurs hors des dés, la localisation hors cadre", () => {
  const etat = duel();
  const cadre = (jet, champs = {}) => cadreDe(lignes.geste(etat, gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE, ...champs })));

  assert.deepEqual(
    cadre(chaineFinie(attaqueDuPj({ modificateurs: [blessures(1)] }), [5])),
    [
      { type: "texte", texte: "4 ", de: 0 },
      { type: "echoue", texte: "✗", de: 0 },
    ],
    "un seul dé s'encadre seul",
  );
  assert.deepEqual(
    cadre(chaineFinie(attaqueDuPj({ modificateurs: [VIF] }), [6], [8], [2])),
    [
      { type: "texte", texte: "7 ", de: 0 },
      { type: "reussi", texte: "✓", de: 0 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "9 ", de: 1 },
      { type: "reussi", texte: "✓", de: 1 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "3 ", de: 2 },
      { type: "echoue", texte: "✗", de: 2 },
    ],
    "trois dés",
  );
  assert.deepEqual(
    cadre(chaineFinie(attaqueDuPj({ faces: 10, modificateurs: [VIF], desavantages: [horsMaitrise("Émincer")] }), [6, 9], [8, 2])),
    [
      { type: "texte", texte: "7/10 → 7 ", de: 0 },
      { type: "reussi", texte: "✓", de: 0 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "9/3 → 3 ", de: 1 },
      { type: "echoue", texte: "✗", de: 1 },
    ],
    "le désavantage : ses lancers et sa flèche dans le dé",
  );
  assert.deepEqual(
    cadre(chaineFinie(attaqueDuPj({ modificateurs: [VIF], avantages: [SOLO] }), [7], [3], "relancer", [5], [8])),
    [
      { type: "texte", texte: "8 ", de: 0 },
      { type: "reussi", texte: "✓", de: 0 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "4 ", de: 1 },
      { type: "echoue", texte: "✗", de: 1 },
      { type: "texte", texte: ", relancé " },
      { type: "texte", texte: "6 ", de: 2 },
      { type: "reussi", texte: "✓", de: 2 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "9 ", de: 3 },
      { type: "reussi", texte: "✓", de: 3 },
    ],
    "une relance : un dé de plus, « relancé » hors des deux",
  );

  const caracteristique = (circonstances, ...pas) =>
    cadreDe(lignes.geste(etat, gesteEssai({ mode: "caracteristique", capacite: indice(etat, "pj1", "Goûter"), jet: chaineFinie({ genre: "caracteristique", lanceur: "pj1", faces: 6, ...circonstances }, ...pas) })));
  assert.deepEqual(
    caracteristique({ difficulte: 8, modificateurs: [blessures(1)] }, [6], "exploser", [6], [1]),
    [
      { type: "texte", texte: "5 explose, + 6 = 11 ", de: 0 },
      { type: "reussi", texte: "✓", de: 0 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "0 ", de: 1 },
      { type: "echoue", texte: "✗", de: 1 },
    ],
    "une explosion : la valeur, l'ajout et la somme dans le même dé",
  );
  assert.deepEqual(
    caracteristique({ difficulte: 15, modificateurs: [VIF] }, [6], "exploser", [6], "exploser", [2], [1]),
    [
      { type: "texte", texte: "7 explose, + 6 explose, + 2 = 15 ", de: 0 },
      { type: "reussi", texte: "✓", de: 0 },
      { type: "texte", texte: ", " },
      { type: "texte", texte: "2 ", de: 1 },
      { type: "echoue", texte: "✗", de: 1 },
    ],
    "une double explosion",
  );

  // Le dé de localisation n'est pas encadré.
  const touche = lignes.geste(
    etat,
    gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", jet: chaineFinie(attaqueDuPj(), [6], [2]), degats: LETTRE, localisation: [d20(6)], resultat: resultat([coup(zone(etat, "adv2", "torse"), { armure: [10, 5] })]) }),
  );
  const localisation = touche.segments.filter((segment) => segment.phrase === touche.phrases.indexOf("localisation"));
  assert.deepEqual(localisation.map(vu), [{ type: "texte", texte: "Localisation d20 → 6 : torse." }]);
  assert.equal(touche.segments.filter((segment) => Object.hasOwn(segment, "jet")).length, 5, "seuls les dés du jet et leur séparateur");
  verifierLaLigne(touche, "la Frappe qui touche");

  // Aucune espace insécable, ni dans un segment ni dans un texte du catalogue.
  for (const { etat: un, geste } of catalogue()) {
    for (const segment of lignes.geste(un, geste).segments) for (const insecable of INSECABLES) assert.ok(!segment.texte.includes(insecable), segment.texte);
  }
});

// ─── d) Les noms piégés ─────────────────────────────────────────────────────

// Deux noms qui portent ce qu'un écran tenté de relire le texte y
// chercherait : le nom d'essai du groupe 1, et un nom qui imite une ligne
// « Annulé », une capacité à sa puissance, la suite d'une ligne en cours, la
// coupe du bandeau et la fin d'une phrase.
const BRULOT = "Brûlot → ✓ contre tous";
const PIEGE = `Annulé : Mouette chapardeuse ${SIGNES.tiret} [1] ${SUITE} […] .`;

test("deux noms piégés, en acteur et en cible : ils restent entiers dans leur segment, et rien de ce qu'ils portent ne compte", () => {
  const etat = duel({ noms: { pj1: { court: BRULOT }, adv2: { court: PIEGE } } });
  const attaque = gesteEssai({
    capacite: indice(etat, "pj1", "Taloche"),
    cible: "adv2",
    caracteristiques: ["force", "agilite"],
    jet: chaineFinie(attaqueDuPj({ caracteristiques: ["force", "agilite"], modificateurs: [VIF] }), [7], [2]),
    degats: LETTRE,
    localisation: [d20(6)],
    resultat: resultat([coup(zone(etat, "adv2", "torse"), { armure: [10, 0], resistance: [5, 0], corps: [10, 0] })], true),
  });
  const ligne = lignes.geste(etat, attaque);
  assert.equal(
    ligne.texte,
    `${BRULOT} : Taloche [1] contre ${PIEGE}. d8+1 (Force + Agilité) contre 5 → 8 ✓, 3 ✗ : 1 réussite, A = 2. Localisation d20 → 6 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 0. ${PIEGE} meurt.`,
  );
  verifierLaLigne(ligne, "l'attaque piégée", { pieges: true });
  assert.deepEqual(vu(ligne.segments[0]), { type: "acteur", texte: BRULOT, camp: "pj" });
  assert.deepEqual(ligne.segments.filter((segment) => segment.type === "cible").map(vu), [{ type: "cible", texte: PIEGE, camp: "adv" }]);
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "degats", "mort"], "les phrases ne se comptent pas aux points d'un nom");
  assert.equal(ligne.segments.filter((segment) => segment.type === "reussi").length, 1, "le « ✓ » du nom n'est pas un dé");
  assert.equal(ligne.segments.filter((segment) => segment.type === "echoue").length, 1);
  assert.deepEqual(vu(dernierDe(ligne.segments)), { type: "mort", texte: `${PIEGE} meurt.` });
  verifierLesPhrases(etat, attaque, ligne, "l'attaque piégée");

  // En défense, le nom de qui lance est du texte : il est répété.
  const defense = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE });
  const recue = lignes.geste(etat, defense);
  assert.equal(recue.texte, `${PIEGE} : Frappe contre ${BRULOT}. ${BRULOT} lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, ${BRULOT} reçoit B = 10.`);
  verifierLaLigne(recue, "la défense piégée", { pieges: true });
  assert.deepEqual(recue.segments.filter((segment) => segment.type === "acteur" || segment.type === "cible").map(vu), [
    { type: "acteur", texte: PIEGE, camp: "adv" },
    { type: "cible", texte: BRULOT, camp: "pj" },
  ]);
  assert.equal(recue.segments.filter((segment) => segment.type === "reussi").length, 1);

  // La passe, et la ligne « Annulé » : le nom n'y change rien.
  assert.deepEqual(lignes.passe(etat, "adv2").segments.map(vu), [
    { type: "acteur", texte: PIEGE, camp: "adv" },
    { type: "texte", texte: " passe son tour." },
  ]);
  const annulee = lignes.annulation(etat, { genre: "capacite", geste: attaque }, [4, 5]);
  assert.equal(annulee.texte, `Annulé : ${BRULOT} ${SIGNES.tiret} Taloche [1].`);
  assert.deepEqual(annulee.segments, [{ type: "texte", texte: annulee.texte, phrase: 0 }]);
  verifierLaLigne(annulee, "l'annulation piégée", { pieges: true });
  assert.equal(nommerLeGeste(etat, { genre: "capacite", geste: attaque }, { detail: true }), `${BRULOT} ${SIGNES.tiret} Taloche [1] contre ${PIEGE}`);
  assert.equal(nommerLeGeste(etat, { genre: "passer", qui: "adv2" }), `${PIEGE} ${SIGNES.tiret} passer son tour`);

  // La ligne en cours, avec ces noms.
  const enCours = ligneEnCours(duel({ noms: { pj1: { court: BRULOT }, adv2: { court: PIEGE } }, retoucher: (brut) => brut.pile.push({ ...attaque, moment: "bilan", localisation: [], resultat: null }) }));
  assert.equal(enCours.texte, `${BRULOT} : Taloche [1] contre ${PIEGE}. d8+1 (Force + Agilité) contre 5 → 8 ✓, 3 ✗ : 1 réussite${SUITE}`);
  verifierLaLigne(enCours, "la ligne en cours piégée", { pieges: true });
});

test("un geste forgé ne fait pas lever les fabriques, et un nom vide ne laisse aucun segment vide", () => {
  const etat = duel({
    retoucher: (brut) => {
      delete brut.noms.adv2;
    },
  });
  const passe = lignes.passe(etat, "constructor");
  assert.equal(passe.texte, " passe son tour.");
  assert.deepEqual(passe.segments, [{ type: "texte", texte: " passe son tour.", phrase: 0 }], "un inconnu n'est ni acteur ni vide");
  assert.deepEqual(lignes.passe(etat, "adv2").segments[0], { type: "acteur", texte: "Marmiton", phrase: 0, camp: "adv" }, "sans nom court, celui de la photographie");

  const jet = chaineFinie(attaqueDuPj(), [6], [2]);
  for (const forge of [
    gesteEssai({ acteur: "pj9", capacite: 99, facon: 7, mode: "sans_jet", cible: "adv9" }),
    gesteEssai({ acteur: "__proto__", capacite: 0, mode: "deplacement" }),
    gesteEssai({ capacite: 99, cible: "constructor", jet, degats: LETTRE, localisation: [d20(6)], resultat: resultat([coup(42, { armure: [3, 0], resistance: [5, 0], blessure: true, blessures: 1 })]) }),
  ]) {
    const ligne = lignes.geste(etat, forge);
    assert.equal(ligne.texte, ligneDuGeste(etat, forge));
    assert.equal(ligne.segments.map((segment) => segment.texte).join(""), ligne.texte);
    assert.ok(ligne.segments.every((segment) => segment.texte !== ""), "aucun segment vide");
    assert.ok(!ligne.segments.some((segment) => (segment.type === "acteur" || segment.type === "cible") && !["pj", "adv"].includes(segment.camp)));
  }
  // Un nom sans protagoniste (un identifiant gardé, forgé) : ni acteur ni cible, faute de camp.
  const fantome = duel({
    retoucher: (brut) => {
      brut.noms.adv9 = { entier: "Marmiton de corvée bis", court: "Marmiton de corvée bis", jeton: "Marmiton de corvée bis", initiales: "MB", exemplaire: null };
    },
  });
  const vise = lignes.geste(fantome, gesteEssai({ mode: "sans_jet", capacite: indice(fantome, "pj1", "Flambage"), cible: "adv9" }));
  assert.equal(vise.texte, "Aubépine : Flambage [1] contre Marmiton de corvée bis.");
  assert.deepEqual(vise.segments.slice(-1).map(vu), [{ type: "texte", texte: " contre Marmiton de corvée bis." }]);
  assert.deepEqual(lignes.passe(fantome, "adv9").segments.map(vu), [{ type: "texte", texte: "Marmiton de corvée bis passe son tour." }]);
  assert.equal(nommerLeGeste(etat, null), "");
  assert.equal(nommerLeGeste(etat, { genre: "capacite", geste: null }), "");
});

// ─── e) La ligne en cours ───────────────────────────────────────────────────

// Un état dont le geste en cours est « geste ».
const enCoursDans = (geste, options = {}) => duel({ ...options, retoucher: (brut) => brut.pile.push(geste) });

// La ligne en cours débute la ligne finale : ses segments sont les siens, le
// dernier pouvant n'en être qu'un début (même type, phrase, jet, dé), puis
// « … », sans espace avant.
function debute(enCours, finale, quoi) {
  verifierLaLigne(enCours, quoi);
  verifierLaLigne(finale, `${quoi}, la ligne finale`);
  assert.equal(enCours.genre, "geste");
  assert.equal(enCours.enCours, true);
  assert.ok(enCours.texte.endsWith(SUITE) && !enCours.texte.endsWith(` ${SUITE}`), `${quoi} : « … » sans espace avant`);
  const debut = enCours.texte.slice(0, -SUITE.length);
  assert.ok(finale.texte.startsWith(debut), `${quoi} : « ${debut} » ne débute pas « ${finale.texte} »`);
  assert.ok(finale.texte.length > debut.length, `${quoi} : la ligne finale dit plus`);
  const siens = enCours.segments.slice(0, -1);
  siens.slice(0, -1).forEach((segment, rang) => assert.deepEqual(segment, finale.segments[rang], `${quoi} : segment ${rang}`));
  const [dernier, sonModele] = [dernierDe(siens), finale.segments[siens.length - 1]];
  const { texte: debutDuTexte, ...forme } = dernier;
  const { texte: texteFinal, ...formeFinale } = sonModele;
  assert.deepEqual(forme, formeFinale, `${quoi} : le dernier segment a la forme du sien`);
  assert.ok(texteFinal.startsWith(debutDuTexte), `${quoi} : « ${debutDuTexte} » ne débute pas « ${texteFinal} »`);
  assert.deepEqual(enCours.phrases, finale.phrases.slice(0, enCours.phrases.length), `${quoi} : ses phrases sont les premières de la ligne`);
}

test("la ligne en cours : null sans geste, avant le paiement, et pour un geste sans jet", () => {
  assert.equal(ligneEnCours(duel()), null, "sans geste");
  const etat = duel();
  const enPreparation = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "preparation", paye: false, prix: null });
  assert.equal(ligneEnCours(enCoursDans(enPreparation)), null, "avant le paiement");
  const nonPaye = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", paye: false, jet: chaine(attaqueDuPj(), [6]) });
  assert.equal(ligneEnCours(enCoursDans(nonPaye)), null, "rien n'est payé : rien ne s'écrit");
  const payeSansJet = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", paye: true, jet: null });
  assert.equal(ligneEnCours(enCoursDans(payeSansJet)), null, "une attaque payée sans jet (forgée) : rien, sans lever");
  const sansJet = gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), moment: "preparation", paye: true, prix: prix({ souffle: 5 }) });
  assert.equal(ligneEnCours(enCoursDans(sansJet)), null, "un geste sans jet");
  const deplacement = gesteEssai({ mode: "deplacement", capacite: indice(etat, "pj1", "Pas chassé"), moment: "preparation", paye: true, depart: "A1", arrivee: "B2" });
  assert.equal(ligneEnCours(enCoursDans(deplacement)), null, "un déplacement");
});

test("la ligne en cours, pendant la chaîne : l'ouverture, les sources, le jet jusqu'au dernier dé lancé", () => {
  const etat = duel();
  const frappe = (jet, champs = {}) => gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "jet", jet, ...champs });
  const fini = (jet) => lignes.geste(etat, frappe(jet, { moment: "fini", degats: LETTRE }));

  // Un dé réussi, la chaîne continue.
  const unDe = ligneEnCours(enCoursDans(frappe(chaine(attaqueDuPj({ modificateurs: [VIF] }), [6]))));
  assert.equal(unDe.texte, `Aubépine : Frappe contre Marmiton. d8+1 contre 5 → 7 ✓${SUITE}`);
  assert.deepEqual(vu(dernierDe(unDe.segments)), { type: "suite", texte: SUITE });
  assert.equal(dernierDe(unDe.segments).phrase, null);
  assert.deepEqual(unDe.phrases, ["ouverture", "jet"]);
  debute(unDe, fini(chaine(attaqueDuPj({ modificateurs: [VIF] }), [6], [8], [2])), "un dé réussi");

  // Une relance offerte : le dé garde son « ✗ » ; puis la relance choisie.
  const offerte = chaine(attaqueDuPj({ avantages: [SOLO] }), [6], [3]);
  assert.equal(offerte.attente, "choix_relance");
  const relance = ligneEnCours(enCoursDans(frappe(offerte)));
  assert.equal(relance.texte, `Aubépine : Frappe contre Marmiton. d8 contre 5, 1 avantage → 6 ✓, 3 ✗${SUITE}`);
  debute(relance, fini(chaineFinie(attaqueDuPj({ avantages: [SOLO] }), [6], [3], "relancer", [7], [2])), "la relance offerte, puis jouée");
  debute(relance, fini(chaineFinie(attaqueDuPj({ avantages: [SOLO] }), [6], [3], "garder")), "la relance offerte, puis refusée");
  const choisie = ligneEnCours(enCoursDans(frappe(chaine(attaqueDuPj({ avantages: [SOLO] }), [6], [3], "relancer"))));
  assert.equal(choisie.texte, relance.texte, "la relance choisie, son dé pas encore lancé");

  // Les sources entières dès le premier dé.
  const sources = ligneEnCours(enCoursDans(frappe(chaine(attaqueDuPj({ avantages: [SOLO], desavantages: [horsMaitrise("Frappe")] }), [6]))));
  assert.equal(sources.texte, `Aubépine : Frappe contre Marmiton. Son avantage (Solo du chef) et son désavantage (Frappe hors maîtrise) s'annulent. d8 contre 5 → 6 ✓${SUITE}`);
  assert.deepEqual(sources.phrases, ["ouverture", "sources", "jet"]);
});

test("la ligne en cours, un dé qui attend d'exploser : sans signe ni somme", () => {
  const etat = duel();
  const de6 = (champs = {}) => ({ genre: "caracteristique", lanceur: "pj1", faces: 6, caracteristiques: ["sens"], difficulte: 13, ...champs });
  const gouter = (jet, moment = "jet") => gesteEssai({ mode: "caracteristique", capacite: indice(etat, "pj1", "Goûter"), caracteristiques: ["sens"], difficulte: 13, moment, jet });
  const enCours = (...pas) => ligneEnCours(enCoursDans(gouter(chaine(de6(), ...pas))));
  const finale = lignes.geste(etat, gouter(chaineFinie(de6(), [6], "exploser", [6], "exploser", [2], [1]), "fini"));
  const tete = "Aubépine : Goûter, d6 (Sens) contre 13 → ";

  const offerte = enCours([6]);
  assert.equal(chaine(de6(), [6]).attente, "choix_explosion");
  assert.equal(offerte.texte, `${tete}6${SUITE}`, "l'explosion offerte");
  assert.deepEqual(offerte.phrases, ["jet"]);
  debute(offerte, finale, "l'explosion offerte");
  assert.equal(enCours([6], "exploser").texte, `${tete}6${SUITE}`, "l'explosion choisie, son dé pas encore lancé");
  const encore = enCours([6], "exploser", [6]);
  assert.equal(encore.texte, `${tete}6 explose, + 6${SUITE}`, "une explosion, une autre offerte");
  debute(encore, finale, "une autre explosion offerte");
  assert.deepEqual(cadreDe(encore), [{ type: "texte", texte: "6 explose, + 6", de: 0 }], "un dé inachevé : ni signe ni somme");
  const finie = enCours([6], "exploser", [6], "exploser", [2]);
  assert.equal(finie.texte, `${tete}6 explose, + 6 explose, + 2 = 14 ✓${SUITE}`, "l'essai fini a sa somme et son signe");
  debute(finie, finale, "l'explosion finie");

  // Après une relance, seul l'essai relancé attend : celui d'avant garde son « ✗ ».
  const minutie = (...pas) => ligneEnCours(enCoursDans(gouter(chaine(de6({ avantages: [mainAvantageuse(1, "Minutie")] }), ...pas))));
  assert.equal(minutie([4], "relancer", [6]).texte, `Aubépine : Goûter, d6 (Sens) contre 13, 1 avantage (à la main : Minutie) → 4 ✗, relancé 6${SUITE}`);
  debute(minutie([4], "relancer", [6]), lignes.geste(etat, gouter(chaineFinie(de6({ avantages: [mainAvantageuse(1, "Minutie")] }), [4], "relancer", [6], "exploser", [1]), "fini")), "la relance qui attend d'exploser");

  // Seul le dernier essai attend : ceux d'avant sont finis.
  const second = enCours([6], "exploser", [6], "exploser", [2], [6]);
  assert.equal(second.texte, `${tete}6 explose, + 6 explose, + 2 = 14 ✓, 6${SUITE}`);
});

test("la ligne en cours, au bilan : le cadre entier, puis les réussites seules", () => {
  const etat = duel();
  const jet = chaineFinie(attaqueDuPj(), [6], [7], [1]);
  const auBilan = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2", moment: "bilan", jet, degats: LETTRE });
  const bilan = ligneEnCours(enCoursDans(auBilan));
  assert.equal(bilan.texte, `Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 7 ✓, 1 ✗ : 2 réussites${SUITE}`);
  assert.deepEqual(vu(bilan.segments[bilan.segments.length - 2]), { type: "texte", texte: " : 2 réussites" });
  // Les dégâts peuvent encore changer : la ligne en cours débute chacune de leurs fins.
  for (const degats of [LETTRE, ajuste("lettre", 22, "Émincer"), ajuste("lettre", 3, "Flambage", "corps")]) {
    debute(bilan, lignes.geste(etat, { ...auBilan, moment: "fini", degats }), `les dégâts ${JSON.stringify(degats)}`);
  }

  // En défense, sans réussite : « aucune réussite ».
  const recue = gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", moment: "bilan", jet: chaineFinie(defenseDuPj(), [3]), degats: LETTRE });
  assert.equal(ligneEnCours(enCoursDans(recue)).texte, `Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 3 ✗ : aucune réussite${SUITE}`);
});

test("la ligne en cours, à la localisation et aux suites : le jet entier, le premier d20 brut ; après l'esquive, la localisation et l'intervention", () => {
  const lourde = duel({ pj: aPlusieursD20(2) });
  const jet = chaineFinie(attaqueDuPj(), [6], [7], [1]);
  const frappe = (champs) => gesteEssai({ capacite: indice(lourde, "pj1", "Frappe"), cible: "adv2", jet, degats: LETTRE, ...champs });
  const finale = lignes.geste(lourde, frappe({ moment: "fini", localisation: [d20(6), d20(13, { valeur: -1, raison: "Minutie" })], resultat: resultat([coup(zone(lourde, "adv2", "torse"), { armure: [10, 0] })]) }));

  const premier = ligneEnCours(enCoursDans(frappe({ moment: "localisation", localisation: [d20(6)] }), { pj: aPlusieursD20(2) }));
  assert.equal(premier.texte, `Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 7 ✓, 1 ✗ : 2 réussites, B = 10. Localisation 2 d20 → 6${SUITE}`);
  assert.deepEqual(premier.phrases, ["ouverture", "jet", "localisation"]);
  debute(premier, finale, "un d20 sur deux");
  const tous = ligneEnCours(enCoursDans(frappe({ moment: "suites", localisation: [d20(6), d20(13)] }), { pj: aPlusieursD20(2) }));
  assert.equal(tous.texte, premier.texte, "aux suites, une face peut encore se décaler : le premier dé brut seul");
  debute(tous, finale, "les deux d20, avant les suites");

  // Aubépine en défense : avant l'esquive, puis après.
  const etat = duel();
  const recue = (champs) =>
    gesteEssai({ acteur: "adv2", capacite: indice(etat, "adv2", "Frappe"), cible: "pj1", jet: chaineFinie(defenseDuPj(), [6], [3]), degats: LETTRE, localisation: [d20(12)], ...champs });
  const esquivee = lignes.geste(etat, recue({ moment: "fini", interventions: [pasDeCote(etat, 3)], resultat: resultat([coup(zone(etat, "pj1", "jambe_gauche"), { armure: [10, 3] })]) }));
  const avant = ligneEnCours(enCoursDans(recue({ moment: "suites" })));
  assert.equal(avant.texte, `Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation d20 → 12${SUITE}`);
  debute(avant, esquivee, "les suites, avant l'esquive");
  const apres = ligneEnCours(enCoursDans(recue({ moment: "suites", interventions: [pasDeCote(etat, 3)] })));
  assert.equal(
    apres.texte,
    `Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation d20 → 12 : jambe gauche. Aubépine intervient : Pas de côté (1 action, 3 souffle), 10 → 7.${SUITE}`,
  );
  assert.deepEqual(apres.phrases, ["ouverture", "jet", "localisation", "intervention"]);
  debute(apres, esquivee, "les suites, après l'esquive");
});

// ─── f) Le nom d'un geste, la ligne « Annulé » ──────────────────────────────

test("le nom d'un geste : la capacité et sa puissance ; avec le détail, sa cible ou son trajet", () => {
  const etat = demonstration();
  const capacite = (geste) => ({ genre: "capacite", geste });
  const taloche = gesteEssai({ capacite: indice(etat, "pj1", "Taloche"), cible: "adv4", jet: chaineFinie(attaqueDuPj(), [2]) });
  assert.equal(nommerLeGeste(etat, capacite(taloche)), "Aubépine — Taloche [1]");
  assert.equal(nommerLeGeste(etat, capacite(taloche), { detail: true }), "Aubépine — Taloche [1] contre Marmiton n° 2");
  const pas = gesteEssai({ mode: "deplacement", capacite: indice(etat, "pj1", "Pas chassé"), depart: "C3", arrivee: "D4" });
  assert.equal(nommerLeGeste(etat, capacite(pas)), "Aubépine — Pas chassé [1]");
  assert.equal(nommerLeGeste(etat, capacite(pas), { detail: true }), "Aubépine — Pas chassé [1], C3 → D4");
  const frappe = gesteEssai({ capacite: indice(etat, "pj1", "Frappe"), cible: "adv2" });
  assert.equal(nommerLeGeste(etat, capacite(frappe), { detail: true }), "Aubépine — Frappe contre Chef", "une capacité qui n'évolue pas : sans puissance");
  const surSoi = gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage"), cible: "pj1" });
  assert.equal(nommerLeGeste(etat, capacite(surSoi), { detail: true }), "Aubépine — Flambage [1] sur Aubépine", "sur soi");
  const surUnAllie = gesteEssai({ acteur: "adv3", mode: "sans_jet", capacite: indice(etat, "adv3", "Moulinet farineux"), cible: "adv4" });
  assert.equal(nommerLeGeste(etat, capacite(surUnAllie), { detail: true }), "Marmiton n° 1 — Moulinet farineux [1] sur Marmiton n° 2", "sur un allié");
  const sansCible = gesteEssai({ mode: "sans_jet", capacite: indice(etat, "pj1", "Flambage") });
  assert.equal(nommerLeGeste(etat, capacite(sansCible), { detail: true }), "Aubépine — Flambage [1]");
  const chef = gesteEssai({ acteur: "adv2", mode: "deplacement", capacite: indice(etat, "adv2", "Pas chassé"), facon: faconDePuissance(etat, "adv2", "Pas chassé", 2), depart: "F6", arrivee: "D4" });
  assert.equal(nommerLeGeste(etat, capacite(chef), { detail: true }), "Chef — Pas chassé [2], F6 → D4");

  assert.equal(nommerLeGeste(etat, { genre: "passer", qui: "pj1" }), "Aubépine — passer son tour");
  assert.equal(nommerLeGeste(etat, { genre: "passer", qui: "adv4" }, { detail: true }), "Marmiton n° 2 — passer son tour");
  assert.equal(nommerLeGeste(etat, { genre: "fin_de_tour", camp: "pj" }), "la fin du tour des PJ");
  assert.equal(nommerLeGeste(etat, { genre: "fin_de_tour", camp: "adv" }, { detail: true }), "la fin du tour des adversaires");
  for (const nom of [nommerLeGeste(etat, capacite(taloche)), nommerLeGeste(etat, capacite(pas), { detail: true })]) assert.ok(nom.includes(SIGNES.tiret) && nom.includes(" "));
});

test("les trois lignes « Annulé » : leur texte, un seul segment, leur barre ; aucune ligne réécrite", () => {
  const etat = demonstration();
  const taloche = gesteEssai({ capacite: indice(etat, "pj1", "Taloche"), cible: "adv4", jet: chaineFinie(attaqueDuPj(), [2]) });
  const plage = Object.freeze([12, 13]);
  assert.deepEqual(lignes.annulation(etat, { genre: "capacite", geste: taloche }, plage), {
    genre: "annule",
    texte: "Annulé : Aubépine — Taloche [1].",
    segments: [{ type: "texte", texte: "Annulé : Aubépine — Taloche [1].", phrase: 0 }],
    phrases: ["annule"],
    barre: [12, 13],
  });
  assert.deepEqual(lignes.annulation(etat, { genre: "passer", qui: "pj1" }, [20, 23]), {
    genre: "annule",
    texte: "Annulé : Aubépine — passer son tour.",
    segments: [{ type: "texte", texte: "Annulé : Aubépine — passer son tour.", phrase: 0 }],
    phrases: ["annule"],
    barre: [20, 23],
  });
  assert.deepEqual(lignes.annulation(etat, { genre: "fin_de_tour", camp: "pj" }, [4, 6]), {
    genre: "annule",
    texte: "Annulé : la fin du tour des PJ.",
    segments: [{ type: "texte", texte: "Annulé : la fin du tour des PJ.", phrase: 0 }],
    phrases: ["annule"],
    barre: [4, 6],
  });
  assert.equal(lignes.annulation(etat, { genre: "fin_de_tour", camp: "adv" }, [7, 9]).texte, "Annulé : la fin du tour des adversaires.");
  const pas = gesteEssai({ mode: "deplacement", capacite: indice(etat, "pj1", "Pas chassé"), depart: "C3", arrivee: "D4" });
  assert.equal(lignes.annulation(etat, { genre: "capacite", geste: pas }, [3, 4]).texte, "Annulé : Aubépine — Pas chassé [1].", "un déplacement : sans son trajet");

  const annulee = lignes.annulation(etat, { genre: "capacite", geste: taloche }, plage);
  verifierLaLigne(annulee, "la ligne « Annulé »");
  assert.ok(Object.isFrozen(annulee.barre));
  assert.equal(Object.hasOwn(annulee, "mort"), false);
  assert.ok(!annulee.segments.some((segment) => segment.type === "acteur"), "une ligne « Annulé » n'a pas d'acteur : elle ne se colore pas");
});

test("l'annonce d'une annulation est la ligne « Annulé », avec ou sans le compte des lignes d'avant", () => {
  const etat = demonstration();
  const taloche = gesteEssai({ capacite: indice(etat, "pj1", "Taloche"), cible: "adv4", jet: chaineFinie(attaqueDuPj(), [2]) });
  const ANNULER = { type: "annuler" };
  const apres = demonstration({
    retoucher: (brut) => {
      brut.journal.push(lignes.geste(brut, taloche), lignes.annulation(brut, { genre: "capacite", geste: taloche }, [2, 3]));
    },
  });
  assert.equal(apres.journal.length, 4);
  assert.equal(annonce(apres, null, ANNULER, 3), "Annulé : Aubépine — Taloche [1].");
  assert.equal(annonce(apres, null, ANNULER), "Annulé : Aubépine — Taloche [1].", "sans le compte : depuis la dernière ligne « Annulé »");
  assert.equal(annonce(etat, null, ANNULER), null, "sans ligne « Annulé », rien");

  // Deux annulations de suite : la dernière seule se dit.
  const deux = demonstration({
    retoucher: (brut) => {
      brut.journal.push(lignes.finDeTour("pj"), lignes.tour({ numero: 1, camp: "adv" }), lignes.annulation(brut, { genre: "fin_de_tour", camp: "pj" }, [2, 4]), lignes.annulation(brut, { genre: "passer", qui: "pj1" }, [0, 0]));
    },
  });
  assert.equal(annonce(deux, null, ANNULER), "Annulé : Aubépine — passer son tour.");
  assert.equal(annonce(deux, null, ANNULER, 5), "Annulé : Aubépine — passer son tour.");
});
