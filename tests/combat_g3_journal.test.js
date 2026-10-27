// Contrôles du journal de la fin du combat (SPECIFICATION.md, § 17.9 ; mission
// du lot 4.3, § 7 ; contrat de la vague 1, § 4, § 5, § 8 et § 10) :
// js/combat/journal.js. Chaque gabarit neuf, mot pour mot : l'intervention et
// la contre-attaque dans la ligne du geste qu'elles suivent, « Intervenir… »,
// attendre et la capacité gardée, le coup critique, les dés, la zone et les
// dégâts de la palette, le report, l'attaque en plus, rendre, ±N, les états,
// déplacer, l'ordre des phrases d'un jet de caractéristique, la blessure
// choisie, plusieurs cibles et « toute la case », les échéances, le MJ, et
// l'annulation des gestes neufs.
//
// Les lignes sortent de combats joués par le moteur (js/combat/moteur.js),
// aux dés imposés, sur les protagonistes de tests/outils/photographies_essai.js
// retouchés : « Aubépine » porte Dressage minute (une intervention gratuite,
// sans jet), Guetter (attendre), Nez fin (un passif à 1 souffle) et Minutie
// (un passif gratuit) ; « Ciboulette », Dressage minute à 2 souffle et Guetter
// à 1 souffle ; le « Marmiton », Guetter. Tous sont en D4, sauf mention. Un
// seul gabarit s'écrit aussi sur un geste retouché, pour ses trois durées : ±N
// sur un adversaire pendant un geste, dont l'effet porte l'avant et l'après.
//
// Chaque ligne se compare par son texte, et ses segments se vérifient : la
// règle d'or, leurs types, leurs phrases. Les états se comparent par leurs
// valeurs, jamais en entier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ligneEnCours, lignes } from "../js/combat/journal.js";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { SIGNES } from "../js/combat/regles.js";
import { adversaireEssai, ajouterPassif, capaciteEssai, chefDePartieEssai, etatsEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-26T21:30" };
const APPLIQUER = { type: "appliquer" };
const CONFIRMER = { type: "confirmer" };
const REVENIR = { type: "revenir" };
const LAISSER = { type: "laisser" };
const ANNULER = { type: "annuler" };
const FIN_DE_TOUR = { type: "fin_de_tour" };
const TENTER = { type: "critique", tenter: true };
const MJ = { genre: "mj" };

const SAUCIER = { genre: "archetype", titre: "Saucier" };
const GESTES = { genre: "base", titre: "Gestes de cuisine" };
const passive = (champs) => faconEssai({ elements: ["Passif"], passif: true, ...champs });
const dressage = (souffle = 0) =>
  capaciteEssai({ nom: "Dressage minute", groupe: SAUCIER, facons: [faconEssai({ cout: { souffle, lien: 0 }, description: "Sert un allié.", elements: ["Intervention"], intervention: true })] });
const guetter = (souffle = 0) => capaciteEssai({ nom: "Guetter", role: "attendre", groupe: GESTES, facons: [faconEssai({ cout: { souffle, lien: 0 }, description: "Une capacité se joue en intervention." })] });
const nezFin = () => capaciteEssai({ nom: "Nez fin", groupe: SAUCIER, facons: [passive({ cout: { souffle: 1, lien: 0 }, description: "Retourne un dé." })] });
const minutie = () => capaciteEssai({ nom: "Minutie", groupe: SAUCIER, facons: [passive({ description: "Un geste précis." })] });

// Aubépine : 0 Frappe, 1 Émincer, 2 Flambage, 3 Fournaise, 4 Pas chassé, 5 Goûter, 6 Taloche, 7 Pas de côté,
// 8 Dressage minute, 9 Guetter, 10 Nez fin, 11 Minutie.
const AUBEPINE = pjEssai((champs) => champs.capacites.push(dressage(), guetter(), nezFin(), minutie()));
const CIBOULETTE = pjEssai((champs) => {
  champs.identifiant = "essai-ciboulette-0000000002";
  champs.nom = "Ciboulette";
  champs.capacites.push(dressage(2), guetter(1));
});
// Le Marmiton : 0 Frappe, 1 Moulinet farineux, 2 Pas chassé, 3 Guetter.
const MARMITON = adversaireEssai((champs) => champs.capacites.push(guetter()));
const { blessure: BLOC_DE_BLESSURE, blocs: BLOCS } = etatsEssai();
const MAIN_BRULEE = BLOC_DE_BLESSURE.find((capacite) => capacite.nom === "Main brûlée");
const ETOURDI = BLOCS.find((bloc) => bloc.nom === "Condition").capacites.find((capacite) => capacite.nom === "Étourdi");

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

const indice = (etat, qui, nom) => etat.photos[qui].capacites.findIndex((une) => une.nom === nom);
const capacite = (etat, qui, nom, facon = 0) => ({ type: "capacite", qui, capacite: indice(etat, qui, nom), facon });
const intervenir = (etat, qui, nom, facon = 0) => ({ type: "intervenir", qui, capacite: indice(etat, qui, nom), facon });
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });
const source = (etat, qui, nom) => ({ genre: "capacite", qui, capacite: indice(etat, qui, nom) });
const effet = (genre, champs = {}, depuis = MJ) => ({ type: "effet", genre, source: depuis, ...champs });
const mj = (genre, qui, champs = {}) => ({ type: "mj", genre, qui, ...champs });

const TYPES = ["texte", "acteur", "capacite", "cible", "reussi", "echoue", "lettre", "ajuste", "mort", "fin_de_tour", "tour", "suite", "echeance", "mj"];

// Ce que toute ligne tient (contrat du groupe 2, § 3.1), et, au groupe 3, le
// nom de qui intervient ou contre-attaque, en tête de sa phrase : gelée ; ses
// segments redonnent son texte ; aucun n'est vide ; leurs phrases se suivent,
// jointes par une espace hors phrase ; « acteur » en tête d'une ligne de
// geste, ou d'une phrase d'intervention ou de contre-attaque ; « acteur » et
// « cible » avec leur camp ; « ✓ » et « ✗ » dans un dé ; la mort finit sa
// phrase.
function verifier(ligne) {
  const { segments, phrases } = ligne;
  const quoi = `« ${ligne.texte} »`;
  assert.ok(Object.isFrozen(ligne) && Object.isFrozen(segments) && segments.every(Object.isFrozen), `${quoi} : gelée`);
  assert.equal(segments.map((segment) => segment.texte).join(""), ligne.texte, `${quoi} : la règle d'or`);
  let attendue = 0;
  segments.forEach((segment, rang) => {
    const ici = `${quoi}, segment ${rang} (« ${segment.texte} »)`;
    assert.ok(TYPES.includes(segment.type), `${ici} : type ${segment.type}`);
    assert.ok(typeof segment.texte === "string" && segment.texte !== "", `${ici} : vide`);
    if (segment.phrase === null) {
      if (segment.type === "suite") assert.equal(rang, segments.length - 1, `${ici} : la suite en dernier`);
      else assert.ok(segment.type === "texte" && segment.texte === " ", `${ici} : hors phrase, une espace`);
      if (segment.type === "texte") attendue += 1;
    } else {
      assert.equal(segment.phrase, attendue, `${ici} : sa phrase`);
    }
    const enTete = rang === 0 || segments[rang - 1].phrase === null;
    if (segment.type === "acteur") assert.ok(enTete && (rang === 0 || ["intervention", "contre_attaque"].includes(phrases[segment.phrase])), `${ici} : un acteur hors de sa place`);
    if (segment.type === "acteur" || segment.type === "cible") assert.ok(["pj", "adv"].includes(segment.camp), `${ici} : son camp`);
    if (segment.type === "reussi" || segment.type === "echoue") assert.ok(Number.isInteger(segment.de) && segment.jet === 0, `${ici} : un signe hors d'un dé`);
    if (segment.type === "mort") assert.ok(phrases[segment.phrase] === "mort" && (rang === segments.length - 1 || segments[rang + 1].phrase === null), `${ici} : la mort finit sa phrase`);
  });
  assert.equal(attendue, phrases.length - 1, `${quoi} : une phrase par genre`);
  return ligne;
}

// Les lignes qu'un combat a écrites depuis un état, vérifiées.
const ecrites = (avant, apres) => apres.journal.slice(avant.journal.length).map(verifier);
const textes = (avant, apres) => ecrites(avant, apres).map((ligne) => ligne.texte);
// Les segments d'une phrase, en [type, texte, camp].
const phrase = (ligne, rang) => ligne.segments.filter((segment) => segment.phrase === rang).map(({ type, texte, camp }) => [type, texte, camp ?? null]);
const SUITE = String.fromCodePoint(0x2026);

// Le Marmiton attaque Aubépine, qui rate sa défense : C = 15, un d20 au torse.
// L'étape « Interventions » est ouverte.
const attaqueDuMarmiton = (etat) => jouer(etat, capacite(etat, "adv2", "Frappe"), viser("pj1"), d8(2), d20(5));
const RECOIT = "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 2 ✗ : aucune réussite, Aubépine reçoit C = 15. Localisation d20 → 5 : torse.";

// ─── Les interventions ──────────────────────────────────────────────────────

test("une intervention s'écrit dans la ligne du geste qu'elle suit, après la localisation, avant les dégâts : qui, la capacité, l'action et le coût, la cible ; personne n'intervient, rien ne s'écrit", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const suites = attaqueDuMarmiton(depart);
  const fini = jouer(suites, intervenir(suites, "pj3", "Dressage minute"), viser("pj1"), CONFIRMER, APPLIQUER);
  const [ligne] = ecrites(depart, fini);
  assert.equal(ligne.texte, `${RECOIT} Ciboulette intervient : Dressage minute (1 action, 2 souffle) sur Aubépine. Armure 10 → 0, endurance 5 → 0.`);
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "intervention", "degats"]);
  assert.deepEqual(phrase(ligne, 3), [
    ["acteur", "Ciboulette", "pj"],
    ["texte", " intervient : ", null],
    ["capacite", "Dressage minute", null],
    ["texte", " (1 action, 2 souffle) sur ", null],
    ["cible", "Aubépine", "pj"],
    ["texte", ".", null],
  ]);

  // L'esquive garde son texte, et les interventions s'écrivent dans l'ordre où elles sont jouées.
  const deux = jouer(suites, intervenir(suites, "pj3", "Dressage minute"), viser("pj1"), CONFIRMER, { type: "esquive", x: 3 }, APPLIQUER);
  assert.equal(
    ecrites(depart, deux)[0].texte,
    `${RECOIT} Ciboulette intervient : Dressage minute (1 action, 2 souffle) sur Aubépine. Aubépine intervient : Pas de côté (1 action, 3 souffle), 15 → 12. Armure 10 → 0, endurance 5 → 3.`,
  );

  // Personne n'intervient : rien ne s'écrit.
  assert.equal(ecrites(depart, jouer(suites, APPLIQUER))[0].texte, `${RECOIT} Armure 10 → 0, endurance 5 → 0.`);
});

test("une intervention à jet prêté écrit son jet, sa localisation et ses dégâts ; deux bilans dans la ligne : chaque phrase de dégâts commence par le nom de qui les reçoit", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const suites = attaqueDuMarmiton(depart);
  const pretee = jouer(suites, intervenir(suites, "pj3", "Dressage minute"), regler("jet_prete", true), viser("adv2"), d8(6), d8(2));
  const fini = jouer(pretee, { type: "degats", base: "arme", operations: [], nature: "normaux" }, d20(5), APPLIQUER, APPLIQUER);
  const [ligne] = ecrites(depart, fini);
  const attendue =
    `${RECOIT} Ciboulette intervient : Dressage minute (1 action, 2 souffle) contre Marmiton. d8 contre 5 → 6 ✓, 2 ✗ : 1 réussite, touché, dégâts de l'arme : A = 5. ` +
    "Localisation d20 → 5 : torse. Marmiton : armure 10 → 5. Aubépine : armure 10 → 0, endurance 5 → 0.";
  assert.equal(ligne.texte, attendue);
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "intervention", "jet", "localisation", "degats", "degats"]);

  // La ligne en cours : celle du geste racine, puis l'intervention en cours, au bilan ses réussites seules.
  const enCours = ligneEnCours(pretee);
  verifier(enCours);
  assert.equal(enCours.texte, `${RECOIT} Ciboulette intervient : Dressage minute (1 action, 2 souffle) contre Marmiton. d8 contre 5 → 6 ✓, 2 ✗ : 1 réussite${SUITE}`);
  assert.ok(attendue.startsWith(enCours.texte.slice(0, -1)), "son début exact");
});

test("« Intervenir… », hors d'une attaque : sa propre ligne, la même phrase, et son annulation", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const surCiboulette = jouer(depart, intervenir(depart, "pj1", "Dressage minute"), viser("pj3"), CONFIRMER);
  assert.deepEqual(textes(depart, surCiboulette), ["Aubépine intervient : Dressage minute (1 action) sur Ciboulette."]);
  assert.deepEqual(textes(depart, jouer(depart, intervenir(depart, "pj3", "Dressage minute"), CONFIRMER)), ["Ciboulette intervient : Dressage minute (1 action, 2 souffle)."]);
  const annule = jouer(surCiboulette, ANNULER);
  assert.deepEqual(textes(surCiboulette, annule), ["Annulé : Aubépine — Dressage minute."]);
});

test("attendre : la ligne gardée, jusqu'au prochain tour du camp de qui garde ; avec un coût ; la capacité gardée jouée comme une intervention ; sa fin, après la ligne du tour", () => {
  const pj = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  assert.deepEqual(textes(pj, jouer(pj, capacite(pj, "pj3", "Guetter"), regler("garde", { capacite: 0, facon: 0 }), CONFIRMER)), [
    "Ciboulette : Guetter (1 souffle), garde Frappe jusqu'au prochain tour des PJ.",
  ]);
  const adv = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  assert.deepEqual(textes(adv, jouer(adv, capacite(adv, "adv2", "Guetter"), regler("garde", { capacite: 0, facon: 0 }), CONFIRMER)), [
    "Marmiton : Guetter, garde Frappe jusqu'au prochain tour des adversaires.",
    "Fin du tour des adversaires : ils retrouvent leurs actions.",
    "— Tour 1 · camp des PJ —",
  ]);

  // Aubépine garde Taloche [1] ; au tour adverse, elle la joue par « Intervenir… » ; au tour des PJ, la garde finit.
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const garde = jouer(depart, capacite(depart, "pj1", "Guetter"), regler("garde", { capacite: 6, facon: 0 }), CONFIRMER);
  const jouee = jouer(garde, { type: "intervenir", qui: "pj1", capacite: 6, facon: 0 }, viser("adv2"), regler("caracteristiques", ["force"]), d8(8), d8(2), d20(5), APPLIQUER);
  const echu = jouer(jouee, FIN_DE_TOUR);
  assert.deepEqual(textes(depart, echu), [
    "Aubépine : Guetter, garde Taloche [1] jusqu'au prochain tour des PJ.",
    "Fin du tour des PJ : ils retrouvent leurs actions.",
    "— Tour 1 · camp des adversaires —",
    "Aubépine intervient : Taloche [1] (1 action, gardée par Guetter) contre Marmiton. d8 (Force) contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 2. Localisation d20 → 5 : torse. Armure 10 → 8.",
    "Fin du tour des adversaires : ils retrouvent leurs actions.",
    "— Tour 2 · camp des PJ —",
    "Fin de Guetter pour Aubépine : Taloche [1] n'est plus gardée.",
  ]);
  const fin = echu.journal.at(-1);
  assert.deepEqual([fin.genre, fin.phrases, fin.segments.map(({ type }) => type)], ["cadre", ["echeance"], ["echeance"]]);
});

// ─── La contre-attaque ──────────────────────────────────────────────────────

// Aubépine frappe le Marmiton : une réussite, puis la face 1, la sienne.
const ANNULEE = "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 1 : contre-attaque, l'attaque est annulée.";
const frappeContree = (etat) => jouer(etat, capacite(etat, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(1));

test("la contre-attaque jouée suit la localisation qui annule : qui, la capacité et son action, sa cible, puis son jet, sa localisation, ses dégâts ; contre un personnage, il lance sa défense", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const contre = frappeContree(depart);
  const enCours = verifier(ligneEnCours(contre));
  assert.equal(enCours.texte, `${ANNULEE}${SUITE}`, "à l'étape de la contre-attaque, la localisation qui annule");
  const riposte = jouer(contre, { type: "contre_attaquer", capacite: 0, facon: 0 }, d8(3), d20(6));
  const suite = `${ANNULEE} Marmiton contre-attaque : Frappe (1 action) contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 3 ✗ : aucune réussite, Aubépine reçoit C = 15.`;
  assert.equal(verifier(ligneEnCours(riposte)).texte, `${suite} Localisation d20 → 6${SUITE}`, "la ligne en cours prolonge celle du geste racine");
  const [ligne] = ecrites(depart, jouer(riposte, APPLIQUER));
  assert.equal(ligne.texte, `${suite} Localisation d20 → 6 : torse. Armure 10 → 0, endurance 5 → 0.`);
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "contre_attaque", "jet", "localisation", "degats"]);
  assert.deepEqual(phrase(ligne, 3).slice(0, 3), [
    ["acteur", "Marmiton", "adv"],
    ["texte", " contre-attaque : ", null],
    ["capacite", "Frappe", null],
  ]);

  // Un personnage contre-attaque : il lance son jet d'attaque.
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const paree = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), d8(2), d20(20), { type: "contre_attaquer", capacite: 0, facon: 0 }, d8(8), d8(2), d20(5), APPLIQUER);
  assert.equal(
    ecrites(adverse, paree)[0].texte,
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 2 ✗ : aucune réussite, Aubépine reçoit C = 15. Localisation d20 → 20 : contre-attaque, l'attaque est annulée. " +
      "Aubépine contre-attaque : Frappe (1 action) contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5.",
  );
});

test("la contre-attaque laissée, ou impossible : une phrase après la localisation, et chacune de ses raisons", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const laisse = jouer(frappeContree(depart), LAISSER);
  const [ligne] = ecrites(depart, laisse);
  assert.equal(ligne.texte, `${ANNULEE} Marmiton ne contre-attaque pas.`);
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "contre_attaque"]);

  const lasse = combat(surD4(AUBEPINE, adversaireEssai((champs) => (champs.actions = 0))));
  const desarme = combat(
    surD4(
      AUBEPINE,
      adversaireEssai((champs) => {
        champs.armes = [];
        for (const une of champs.capacites) for (const facon of une.facons) facon.arme = null;
      }),
    ),
  );
  const loin = combat([
    { photo: pjEssai((champs) => (champs.capacites[0].facons[0].portee = 3)), case: "D4" },
    { photo: MARMITON, case: "F4" },
  ]);
  assert.deepEqual(
    [lasse, desarme, loin].map((etat) => textes(etat, frappeContree(etat))[0]),
    [
      `${ANNULEE} Marmiton ne peut pas contre-attaquer : plus d'action.`,
      `${ANNULEE} Marmiton ne peut pas contre-attaquer : aucune arme.`,
      `${ANNULEE} Marmiton ne peut pas contre-attaquer : Aubépine est hors de portée de Spatule souple.`,
    ],
  );
});

// ─── Le coup critique ───────────────────────────────────────────────────────

test("le coup critique : le 4e dé dans le cadre, la lettre doublée, le surplus de dégrossir doublé ; relancé ; manqué ; un jet de caractéristique ; un jet prêté sans dégâts", () => {
  const avecReduction = pjEssai((champs) => {
    ajouterPassif(champs, { role: "degrossir", niveau: 1, nom: "Réduction" });
  });
  const reduit = combat(surD4(avecReduction, MARMITON));
  const trois = jouer(reduit, capacite(reduit, "pj1", "Frappe"), viser("adv2"), regler("avantages", 1, "Minutie"), d8(8), d8(8), d8(8));
  assert.equal(gesteEnCours(trois).moment, "critique");
  assert.equal(verifier(ligneEnCours(trois)).texte, `Aubépine : Frappe contre Marmiton. d8 contre 5, 1 avantage (à la main : Minutie) → 8 ✓, 8 ✓, 8 ✓${SUITE}`, "au choix, le cadre entier");
  const reussi = jouer(trois, TENTER, d8(6), d20(5), APPLIQUER);
  const [critique] = ecrites(reduit, reussi);
  assert.equal(
    critique.texte,
    "Aubépine : Frappe contre Marmiton. d8 contre 5, 1 avantage (à la main : Minutie) → 8 ✓, 8 ✓, 8 ✓, 4e dé 6 ✓ : coup critique, C = 15, doublés : 30, +6 contre l'armure (Réduction). " +
      "Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 0. Marmiton meurt.",
  );
  // Le 4e dé est dans le cadre, d'un seul tenant.
  const de4 = critique.segments.filter((segment) => segment.de === 3);
  assert.deepEqual(
    de4.map(({ type, texte }) => [type, texte]),
    [
      ["texte", "4e dé 6 "],
      ["reussi", SIGNES.reussi],
    ],
  );

  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = (avantages, ...pas) => textes(depart, jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), regler("avantages", avantages, "Minutie"), d8(8), d8(8), d8(8), TENTER, ...pas))[0];
  assert.equal(
    frappe(2, d8(2), { type: "relancer" }, d8(6), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5, 2 avantages (à la main : Minutie) → 8 ✓, 8 ✓, 8 ✓, 4e dé 2 ✗, relancé 6 ✓ : coup critique, C = 15, doublés : 30. " +
      "Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 0. Marmiton meurt.",
  );
  assert.equal(
    frappe(1, d8(2), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5, 1 avantage (à la main : Minutie) → 8 ✓, 8 ✓, 8 ✓, 4e dé 2 ✗ : 3 réussites, C = 15. Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0.",
    "manqué : trois réussites",
  );

  const gouter = jouer(depart, capacite(depart, "pj1", "Goûter"), regler("caracteristiques", ["sens", "parole"]), regler("difficulte", 6), regler("avantages", 1, "Minutie"), d8(7), d8(7), d8(7), TENTER, d8(7), APPLIQUER);
  assert.deepEqual(textes(depart, gouter), ["Aubépine : Goûter, d8 (Parole + Sens) contre 6 (compliqué), 1 avantage (à la main : Minutie) → 7 ✓, 7 ✓, 7 ✓, 4e dé 7 ✓ : coup critique."]);
  const prete = jouer(depart, capacite(depart, "pj1", "Flambage"), regler("jet_prete", true), viser("adv2"), regler("avantages", 1, "Minutie"), d8(8), d8(8), d8(8), TENTER, d8(8), d20(5), APPLIQUER);
  assert.equal(
    textes(depart, prete)[0],
    "Aubépine : Flambage [1] (5 souffle) contre Marmiton. d8 contre 5, 1 avantage (à la main : Minutie) → 8 ✓, 8 ✓, 8 ✓, 4e dé 8 ✓ : coup critique, touché. Localisation d20 → 5 : torse.",
  );
});

// ─── La palette : les dés, la zone, les dégâts ──────────────────────────────

test("inverser, relancer par la palette, +1 réussite : dans le cadre et le bilan, avec leur source, et le prix d'un passif payant", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const nezFinDAubepine = source(depart, "pj1", "Nez fin");
  const frappe = (...pas) => textes(depart, jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), ...pas))[0];
  // Un jet manqué attend « Appliquer » : la ligne en cours dit ses réussites seules, que la palette peut changer.
  const manque = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(3));
  assert.equal(gesteEnCours(manque).moment, "suites");
  assert.equal(verifier(ligneEnCours(manque)).texte, `Aubépine : Frappe contre Marmiton. d8 contre 5 → 3 ✗ : aucune réussite${SUITE}`);
  assert.equal(
    frappe(d8(3), effet("inverser", {}, nezFinDAubepine), d8(7), d8(2), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 3 ✗ inversé (Nez fin, 1 souffle) → 6 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10. Localisation d20 → 5 : torse. Armure 10 → 0.",
  );
  assert.equal(
    frappe(d8(3), effet("inverser"), d8(2), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 3 ✗ inversé (MJ) → 6 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5.",
    "sans coût",
  );
  assert.equal(
    frappe(d8(4), effet("relancer", {}, source(depart, "pj1", "Minutie")), d8(6), d8(7), d8(1), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 4 ✗, relancé (Minutie) 6 ✓, 7 ✓, 1 ✗ : 2 réussites, B = 10. Localisation d20 → 5 : torse. Armure 10 → 0.",
  );
  assert.equal(
    frappe(d8(6), d8(7), d8(2), effet("reussite", {}, source(depart, "pj1", "Émincer")), d20(5), APPLIQUER),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 6 ✓, 7 ✓, 2 ✗ : 3 réussites (dont 1 par Émincer), C = 15. Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0.",
  );
  // Le dé inversé est d'un seul tenant : sa valeur d'avant, son signe, « inversé », sa source, la valeur d'après.
  const [ligne] = ecrites(depart, jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(3), effet("inverser", {}, nezFinDAubepine), d8(7), d8(2), d20(5), APPLIQUER));
  assert.deepEqual(
    ligne.segments.filter((segment) => segment.de === 0).map(({ type, texte }) => [type, texte]),
    [
      ["texte", "3 "],
      ["echoue", SIGNES.echoue],
      ["texte", " inversé (Nez fin, 1 souffle) → 6 "],
      ["reussi", SIGNES.reussi],
    ],
  );
});

test("la zone choisie : dans la localisation, sa source ; par le MJ", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const frappe = (depuis) => textes(depart, jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5), effet("zone", { de: 0, zone: 3 }, depuis), APPLIQUER))[0];
  assert.equal(
    frappe(source(depart, "pj1", "Minutie")),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5, zone choisie (Minutie) : bras gauche. Armure 10 → 5.",
  );
  assert.equal(frappe(MJ), "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5, zone choisie (MJ) : bras gauche. Armure 10 → 5.");
});

test("les dégâts de la palette : ×k, +N, −N, le résultat après chacune ; +N contre l'armure ; des dégâts directs ; reporter, et les dégâts au nom de qui les reçoit", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const minutieDAubepine = source(depart, "pj1", "Minutie");
  const deux = (...effets) => textes(depart, jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(7), d8(2), ...effets, d20(5), APPLIQUER))[0];
  assert.equal(
    deux(effet("multiplier", { k: 2 }, source(depart, "pj1", "Flambage")), effet("ajouter", { n: 3 }, minutieDAubepine), effet("retrancher", { n: 4 })),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, ×2 (Flambage) : 20, +3 (Minutie) : 23, −4 (MJ) : 19. " +
      "Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 6. Blessure (torse), sans effet calculé.",
    "et la blessure d'un adversaire, inchangée",
  );
  assert.equal(
    deux(effet("armure", { n: 2 }, minutieDAubepine)),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, +2 contre l'armure (Minutie). Localisation d20 → 5 : torse. Armure 10 → 0.",
  );
  assert.equal(
    deux(effet("directs", { n: 4, nature: "resistance" }, source(depart, "pj1", "Frappe"))),
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, dégâts directs à l'endurance : 4 (Frappe). Localisation d20 → 5 : torse. Endurance 5 → 1.",
  );

  const deuxMarmitons = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const reporte = jouer(deuxMarmitons, capacite(deuxMarmitons, "pj1", "Frappe"), viser("adv2"), d8(8), d8(7), d8(2), effet("reporter", { sur: "adv3" }, minutieDAubepine), d20(5), APPLIQUER);
  assert.equal(
    textes(deuxMarmitons, reporte)[0],
    "Aubépine : Frappe contre Marmiton n° 1. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, reportés sur Marmiton n° 2 (Minutie). Localisation d20 → 5 : torse. Marmiton n° 2 : armure 10 → 0.",
  );
  // C'est la victime qui meurt.
  const tue = jouer(deuxMarmitons, capacite(deuxMarmitons, "pj1", "Frappe"), viser("adv2"), d8(8), d8(7), d8(2), effet("directs", { n: 10, nature: "corps" }), effet("reporter", { sur: "adv3" }, minutieDAubepine), d20(5), APPLIQUER);
  assert.equal(
    textes(deuxMarmitons, tue)[0],
    "Aubépine : Frappe contre Marmiton n° 1. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, dégâts directs au corps : 10 (MJ), reportés sur Marmiton n° 2 (Minutie). " +
      "Localisation d20 → 5 : torse. Marmiton n° 2 : corps 10 → 0. Marmiton n° 2 meurt.",
  );
  // Le d20 se lit sur la grille de la victime : la face 20, la tête du Marmiton, est hors de celle de Ciboulette,
  // et va à sa zone la plus proche.
  const allie = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE));
  const surCiboulette = jouer(allie, capacite(allie, "pj1", "Frappe"), viser("adv2"), d8(8), d8(7), d8(2), effet("reporter", { sur: "pj3" }, minutieDAubepine), d20(20), APPLIQUER);
  assert.equal(
    textes(allie, surCiboulette)[0],
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, reportés sur Ciboulette (Minutie). Localisation d20 → 20 : bras droit. Ciboulette : armure 10 → 0.",
  );
});

test("une attaque en plus : la parenthèse de l'attaque qui la prend, seule ou après le coût ; sa fin, quand elle n'a pas servi", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const donnee = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), effet("attaque_en_plus", {}, source(depart, "pj1", "Flambage")), d20(5), APPLIQUER);
  assert.deepEqual(textes(depart, donnee), ["Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5."], "l'effet ne s'écrit pas là");
  assert.deepEqual(textes(donnee, jouer(donnee, capacite(donnee, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(14), APPLIQUER)), [
    "Aubépine : Frappe (attaque en plus : Flambage) contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 14 : jambe droite. Armure 10 → 5.",
  ]);
  assert.deepEqual(textes(donnee, jouer(donnee, capacite(donnee, "pj1", "Émincer"), viser("adv2"), d8(8, 7), d8(2, 1), d20(14), APPLIQUER)), [
    "Aubépine : Émincer (4 souffle ; attaque en plus : Flambage) contre Marmiton. d8 contre 5, 1 désavantage → 8/7 → 7 ✓, 2/1 → 1 ✗ : 1 réussite, A = 5. Localisation d20 → 14 : jambe droite. Armure 10 → 5.",
  ]);
  assert.deepEqual(textes(donnee, jouer(donnee, FIN_DE_TOUR, FIN_DE_TOUR)).slice(-2), ["— Tour 2 · camp des PJ —", "Fin de Flambage pour Aubépine : plus d'attaque en plus."]);
});

// ─── Rendre, ±N, les états, déplacer ────────────────────────────────────────

test("hors d'un geste, chaque effet a sa ligne : rendre (le souffle, l'endurance d'une zone, un lien), ±N, un état libre, un déplacement ; son annulation", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const reduit = jouer(
    depart,
    mj("valeurs", "pj1", {
      valeurs: [
        { champ: "souffle", valeur: 4 },
        { champ: "endurance", zone: 1, valeur: 2 },
        { champ: "lien", jauge: 0, valeur: 0 },
      ],
    }),
    // Un état fait d'Aubépine une source, hors d'un geste (contrat, § 5).
    mj("etat", "pj1", { ajout: { capacite: ETOURDI, duree: "combat" } }),
  );
  const rendu = jouer(reduit, effet("rendre", { sur: "pj1", ressource: "souffle", n: 3 }, source(depart, "pj1", "Minutie")));
  const fini = jouer(
    rendu,
    effet("rendre", { sur: "pj1", ressource: "endurance", zone: 1, n: 3 }),
    effet("rendre", { sur: "pj1", ressource: "lien", jauge: 0, n: 1 }),
    effet("attaque", { sur: "adv2", n: -2, duree: "tour" }),
    effet("defense", { sur: "adv2", n: 1, duree: "combat" }),
    effet("defense", { sur: "pj1", n: -1, duree: "combat" }),
    effet("etat", { sur: "pj1", libre: "Couvert de farine", duree: "combat" }),
    effet("deplacer", { sur: "adv2", vers: "D5" }),
  );
  const toutes = ecrites(reduit, fini);
  assert.deepEqual(
    toutes.map((ligne) => ligne.texte),
    [
      "Aubépine : souffle 4 → 7 (Minutie).",
      "Aubépine, torse : endurance 2 → 5 (MJ).",
      "Aubépine : lien de Grand Four 0 → 1 (MJ).",
      "Attaque de Marmiton : 4 → 2 (MJ), jusqu'au prochain tour des PJ.",
      "Défense de Marmiton : 5 → 6 (MJ), jusqu'à la fin du combat.",
      "Défense d'Aubépine : −1 à chaque dé (MJ), jusqu'à la fin du combat.",
      "Aubépine : état « Couvert de farine » (MJ), jusqu'à la fin du combat.",
      "Marmiton : déplacé, D4 → D5, sans action (MJ).",
    ],
  );
  assert.deepEqual(
    toutes.map((ligne) => [ligne.genre, ...ligne.phrases]),
    [...Array(6).fill(["geste", "effet"]), ["geste", "etat"], ["geste", "effet"]],
  );
  assert.deepEqual(textes(rendu, jouer(rendu, ANNULER)), ["Annulé : effet de Minutie sur Aubépine."]);
});

test("pendant un geste, les phrases d'effet : « pour ce jet » après les sources, avant le jet ; les autres après les dégâts et la blessure, avant la mort, dans l'ordre où elles s'appliquent", () => {
  const adverse = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const pourCeJet = jouer(adverse, capacite(adverse, "adv2", "Frappe"), viser("pj1"), effet("defense", { sur: "pj1", n: -1, duree: "jet" }, source(adverse, "pj1", "Minutie")), d8(3), d20(5), APPLIQUER);
  const [jet] = ecrites(adverse, pourCeJet);
  assert.equal(
    jet.texte,
    "Marmiton : Frappe contre Aubépine. Défense d'Aubépine : −1 à chaque dé (Minutie), pour ce jet. Aubépine lance sa défense, d8−1 contre 4 → 2 ✗ : aucune réussite, Aubépine reçoit C = 15. " +
      "Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0.",
  );
  assert.deepEqual(jet.phrases, ["ouverture", "effet", "jet", "localisation", "degats"]);

  const depart = combat(surD4(AUBEPINE, MARMITON));
  const taloche = source(depart, "pj1", "Taloche");
  const tue = jouer(
    depart,
    mj("valeurs", "adv2", { valeurs: [{ champ: "corps", valeur: 1 }] }),
    capacite(depart, "pj1", "Frappe"),
    viser("adv2"),
    d8(8),
    d8(7),
    d8(2),
    effet("directs", { n: 1, nature: "corps" }),
    d20(5),
    effet("etat", { sur: "adv2", capacite: ETOURDI, duree: "tour" }, taloche),
    effet("defense", { sur: "pj1", n: -1, duree: "tour" }),
    effet("deplacer", { sur: "adv2", vers: "D5" }, taloche),
    APPLIQUER,
  );
  const [valeur, ligne, fin] = ecrites(depart, tue);
  assert.equal(valeur.texte, "MJ : corps de Marmiton : 10 → 1.");
  assert.equal(
    ligne.texte,
    "Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, dégâts directs au corps : 1 (MJ). Localisation d20 → 5 : torse. Corps 1 → 0. " +
      "Marmiton : état Étourdi (Taloche), jusqu'au prochain tour d'Aubépine. Défense d'Aubépine : −1 à chaque dé (MJ), jusqu'au prochain tour d'Aubépine. " +
      "Marmiton : déplacé, D4 → D5, sans action (Taloche). Marmiton meurt.",
  );
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "degats", "etat", "effet", "effet", "mort"]);
  assert.equal(ligne.mort, true);
  assert.equal(fin.texte, "Combat terminé : victoire des PJ.");
});

// La mission, § 7 : « avant le premier dé, elles viennent après la phrase des
// sources ». Un jet de caractéristique qui en a garde l'acteur en tête de
// ligne : son début fait sa propre phrase (gabarit à confirmer).
test("un jet de caractéristique : la phrase des sources, puis un effet « pour ce jet », avant son premier dé ; son début a alors sa phrase ; sans elles, une seule phrase", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const gouter = source(depart, "pj1", "Goûter");
  const preparer = (...effets) => [capacite(depart, "pj1", "Goûter"), regler("caracteristiques", ["sens"]), regler("difficulte", 6), ...effets];
  const ouvert = jouer(depart, preparer(regler("avantages", 1, "Minutie"), effet("desavantages", { nombre: 1 }, gouter), effet("etat", { sur: "pj1", capacite: ETOURDI, duree: "jet" }, gouter)), d8(7));
  const DEBUT =
    "Aubépine : Goûter. Son avantage (à la main : Minutie) et son désavantage (Goûter) s'annulent. Aubépine : état Étourdi (Goûter), pour ce jet. d8 (Sens) contre 6 (compliqué) → 7 ✓";
  assert.equal(verifier(ligneEnCours(ouvert)).texte, `${DEBUT}${SUITE}`, "la ligne en cours en est le début exact");
  const [ligne] = ecrites(depart, jouer(ouvert, d8(2), APPLIQUER));
  assert.equal(ligne.texte, `${DEBUT}, 2 ✗ : 1 réussite.`);
  assert.deepEqual(ligne.phrases, ["ouverture", "sources", "etat", "jet"]);
  assert.deepEqual(phrase(ligne, 0), [
    ["acteur", "Aubépine", "pj"],
    ["texte", " : ", null],
    ["capacite", "Goûter", null],
    ["texte", ".", null],
  ]);

  // L'effet seul, sans phrase des sources ; puis sans rien : la phrase d'aujourd'hui.
  const seul = jouer(depart, preparer(effet("etat", { sur: "pj1", capacite: ETOURDI, duree: "jet" }, gouter)), d8(7), d8(2), APPLIQUER);
  assert.deepEqual(textes(depart, seul), ["Aubépine : Goûter. Aubépine : état Étourdi (Goûter), pour ce jet. d8 (Sens) contre 6 (compliqué) → 7 ✓, 2 ✗ : 1 réussite."]);
  const sans = jouer(depart, preparer(), d8(7), d8(2), APPLIQUER);
  assert.deepEqual(textes(depart, sans), ["Aubépine : Goûter, d8 (Sens) contre 6 (compliqué) → 7 ✓, 2 ✗ : 1 réussite."]);
});

// Le seul gabarit écrit aussi sur un geste retouché : l'effet ±N d'un
// adversaire appliqué pendant un geste porte sa valeur avant et après
// (js/combat/effets.js) ; le journal les lit dans l'effet, et ne les
// recalcule pas. Le contrôle suivant le joue par le moteur.
test("±N sur un adversaire, pendant un geste : sa valeur avant et après, que porte l'effet, et sa durée", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const suites = jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5));
  const geste = gesteEnCours(suites);
  const ecart = (champs) => ({ type: "effet", genre: "attaque", sur: "adv2", n: -2, source: source(depart, "pj1", "Minutie"), x: 0, prix: null, rang: 0, auteur: "pj1", camp: "pj", durable: null, avant: 4, apres: 2, ...champs });
  const fini = (...effets) => verifier(lignes.geste(suites, { ...geste, moment: "fini", resultat: { coups: [], mort: false }, effets })).texte;
  const DEBUT = "Aubépine : Frappe contre Marmiton.";
  const JET = "d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse.";
  assert.equal(fini(ecart({ duree: "tour", durable: 7 })), `${DEBUT} ${JET} Attaque de Marmiton : 4 → 2 (Minutie), jusqu'au prochain tour d'Aubépine.`);
  assert.equal(fini(ecart({ duree: "combat", durable: 7 })), `${DEBUT} ${JET} Attaque de Marmiton : 4 → 2 (Minutie), jusqu'à la fin du combat.`);
  assert.equal(fini(ecart({ duree: "jet" })), `${DEBUT} Attaque de Marmiton : 4 → 2 (Minutie), pour ce jet. ${JET}`);
});

test("±N sur un adversaire, dans un geste joué : la ligne dit sa valeur avant et après, jamais « ? »", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const minutie = source(depart, "pj1", "Minutie");
  const joue = jouer(
    depart,
    capacite(depart, "pj1", "Frappe"),
    viser("adv2"),
    effet("defense", { sur: "adv2", n: -2, duree: "jet" }, minutie),
    d8(8),
    d8(2),
    d20(5),
    effet("attaque", { sur: "adv2", n: -1, duree: "tour" }),
    APPLIQUER,
  );
  const [ligne] = ecrites(depart, joue);
  assert.ok(!ligne.texte.includes("?"), ligne.texte);
  assert.equal(
    ligne.texte,
    "Aubépine : Frappe contre Marmiton. Défense de Marmiton : 5 → 3 (Minutie), pour ce jet. d8 contre 3 → 8 ✓, 2 ✗ : 1 réussite, A = 5. " +
      "Localisation d20 → 5 : torse. Armure 10 → 5. Attaque de Marmiton : 4 → 3 (MJ), jusqu'au prochain tour d'Aubépine.",
  );
  assert.deepEqual(ligne.phrases, ["ouverture", "effet", "jet", "localisation", "degats", "effet"]);
});

// ─── La blessure ────────────────────────────────────────────────────────────

test("la blessure d'un personnage : la capacité choisie, ou l'état libre, après les dégâts", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON), { quiCommence: "adv" });
  const blesse = jouer(
    depart,
    capacite(depart, "adv2", "Frappe"),
    viser("pj1"),
    d8(2),
    { type: "degats", base: "lettre", operations: [{ op: "ajuster", valeur: 20, raison: "Coup de chaud" }], nature: "normaux" },
    d20(5),
    APPLIQUER,
  );
  assert.equal(gesteEnCours(blesse).moment, "blessure");
  const DEBUT =
    "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 2 ✗ : aucune réussite, Aubépine reçoit C = 15, ajusté à 20 (Coup de chaud). Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 5.";
  assert.equal(verifier(ligneEnCours(blesse)).texte, `${DEBUT}${SUITE}`, "au choix de la blessure, les dégâts appliqués");
  const [capaciteChoisie] = ecrites(depart, jouer(blesse, { type: "blessure", capacite: MAIN_BRULEE }));
  assert.equal(capaciteChoisie.texte, `${DEBUT} Blessure (torse) : Main brûlée.`);
  assert.deepEqual(capaciteChoisie.phrases.slice(-2), ["degats", "blessures"]);
  assert.equal(textes(depart, jouer(blesse, { type: "blessure", libre: "Doigt entaillé" }))[0], `${DEBUT} Blessure (torse) : « Doigt entaillé » (état libre).`);
});

// ─── Plusieurs cibles ───────────────────────────────────────────────────────

test("plusieurs cibles : une ligne par cible, son rang, la première porte le coût ; une seule cible, la ligne d'une attaque ordinaire", () => {
  const depart = combat(surD4(AUBEPINE, chefDePartieEssai(), CIBOULETTE), { quiCommence: "adv" });
  const fini = jouer(depart, capacite(depart, "adv2", "Moulinet farineux"), d8(8), d8(8), d8(8), APPLIQUER, d8(5), d8(1), d20(5), APPLIQUER);
  assert.deepEqual(textes(depart, fini).slice(0, 2), [
    "Chef : Moulinet farineux [1] (5 souffle) contre Aubépine, cible 1 sur 2. Aubépine lance sa défense, d8 contre 5 → 8 ✓, 8 ✓, 8 ✓ : 3 réussites, aucun dégât.",
    "Chef : Moulinet farineux [1] contre Ciboulette, cible 2 sur 2. Ciboulette lance sa défense, d8 contre 5 → 5 ✓, 1 ✗ : 1 réussite, Ciboulette reçoit B = 12. Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 3.",
  ]);

  const isolee = combat(
    [
      { photo: AUBEPINE, case: "D4" },
      { photo: chefDePartieEssai(), case: "D4" },
      { photo: CIBOULETTE, case: "A1" },
    ],
    { quiCommence: "adv" },
  );
  const seule = jouer(isolee, capacite(isolee, "adv2", "Moulinet farineux"), d8(8), d8(8), d8(8), APPLIQUER);
  assert.equal(textes(isolee, seule)[0], "Chef : Moulinet farineux [1] (5 souffle) contre Aubépine. Aubépine lance sa défense, d8 contre 5 → 8 ✓, 8 ✓, 8 ✓ : 3 réussites, aucun dégât.");
});

// La mission, § 4.6 : « Chaque effet appliqué […] s'écrit au journal ». Le
// gabarit est neuf, à confirmer : « , toute la case (Frappe) ».
test("toute la case : à la fin du bilan de la première cible, après les opérations, avec sa source et le prix d'un passif ; la cible suivante n'en dit rien", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const frappe = source(depart, "pj1", "Frappe");
  const premiere = (depuis, ...avant) =>
    jouer(depart, capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(8), d8(7), d8(2), ...avant, effet("toute_la_case", { cibles: ["adv2", "adv3"] }, depuis), d20(5), APPLIQUER);
  const fini = jouer(premiere(frappe, effet("multiplier", { k: 2 }, frappe)), d8(8), d8(2), d20(5), APPLIQUER);
  const [ligne, suivante] = ecrites(depart, fini);
  assert.equal(
    ligne.texte,
    "Aubépine : Frappe contre Marmiton n° 1, cible 1 sur 2. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, ×2 (Frappe) : 20, toute la case (Frappe). " +
      "Localisation d20 → 5 : torse. Armure 10 → 0, endurance 5 → 0, corps 10 → 5. Blessure (torse), sans effet calculé.",
  );
  assert.deepEqual(ligne.phrases, ["ouverture", "jet", "localisation", "degats", "blessures"]);
  assert.equal(suivante.texte, "Aubépine : Frappe contre Marmiton n° 2, cible 2 sur 2. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5.");

  const bilan = (etat) => ecrites(depart, etat)[0].texte.split(" Localisation")[0];
  assert.equal(bilan(premiere(source(depart, "pj1", "Nez fin"))), "Aubépine : Frappe contre Marmiton n° 1, cible 1 sur 2. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, toute la case (Nez fin, 1 souffle).");
  assert.equal(bilan(premiere(MJ)), "Aubépine : Frappe contre Marmiton n° 1, cible 1 sur 2. d8 contre 5 → 8 ✓, 7 ✓, 2 ✗ : 2 réussites, B = 10, toute la case (MJ).");
});

// ─── Les échéances ──────────────────────────────────────────────────────────

test("les échéances : une ligne chacune, juste après « — Tour … — », dans l'ordre des effets ; deux ±N du même adversaire partent l'un après l'autre", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const taloche = source(depart, "pj1", "Taloche");
  const pose = jouer(
    depart,
    capacite(depart, "pj1", "Frappe"),
    viser("adv2"),
    d8(8),
    d8(2),
    d20(5),
    effet("attaque", { sur: "adv2", n: -2, duree: "tour" }, source(depart, "pj1", "Minutie")),
    effet("attaque", { sur: "adv2", n: -2, duree: "tour" }, taloche),
    effet("etat", { sur: "adv2", capacite: ETOURDI, duree: "tour" }, taloche),
    effet("defense", { sur: "pj1", n: -1, duree: "tour" }, taloche),
    APPLIQUER,
  );
  assert.deepEqual(textes(pose, jouer(pose, FIN_DE_TOUR, FIN_DE_TOUR)), [
    "Fin du tour des PJ : ils retrouvent leurs actions.",
    "— Tour 1 · camp des adversaires —",
    "Fin du tour des adversaires : ils retrouvent leurs actions.",
    "— Tour 2 · camp des PJ —",
    "Fin de Minutie pour Marmiton : attaque 0 → 2.",
    "Fin de Taloche pour Marmiton : attaque 2 → 4.",
    "Fin de l'état Étourdi pour Marmiton.",
    "Fin de Taloche pour Aubépine : plus de −1 à chaque dé de défense.",
  ]);
});

// ─── Le MJ ──────────────────────────────────────────────────────────────────

test("le MJ : une phrase par valeur changée, chacune ouverte par « MJ : » ; un maximum entraîne sa valeur ; l'équipement, les états, le déplacement, le retrait", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const defense = jouer(depart, mj("valeurs", "adv2", { valeurs: [{ champ: "defense", valeur: 6 }] }));
  const valeurs = jouer(
    defense,
    mj("valeurs", "pj1", {
      valeurs: [
        { champ: "armure", zone: 1, valeur: 4 },
        { champ: "souffleMax", valeur: 5 },
      ],
    }),
  );
  const pose = jouer(valeurs, mj("etat", "adv2", { ajout: { capacite: ETOURDI, duree: "combat" } }));
  const retire = jouer(pose, mj("etat", "adv2", { retrait: pose.effets.at(-1).id }));
  const deplace = jouer(retire, mj("deplacer", "adv2", { vers: "D5" }));
  const toutes = ecrites(depart, deplace);
  assert.deepEqual(
    toutes.map((ligne) => ligne.texte),
    [
      "MJ : défense de Marmiton : 5 → 6.",
      "MJ : Aubépine, torse : armure 10 → 4. MJ : souffle maximum d'Aubépine : 10 → 5. MJ : souffle d'Aubépine : 10 → 5.",
      "MJ : état Étourdi sur Marmiton, jusqu'à la fin du combat.",
      "MJ : état Étourdi retiré de Marmiton.",
      "MJ : Marmiton, D4 → D5, sans action.",
    ],
  );
  assert.deepEqual(toutes[1].phrases, ["mj", "mj", "mj"]);
  assert.deepEqual(phrase(toutes[1], 1), [
    ["mj", "MJ : ", null],
    ["texte", "souffle maximum d'Aubépine : 10 → 5.", null],
  ]);
  // Une valeur égale à l'actuelle ne s'écrit pas.
  assert.deepEqual(
    textes(
      depart,
      jouer(
        depart,
        mj("valeurs", "pj1", {
          valeurs: [
            { champ: "souffle", valeur: 10 },
            { champ: "corps", valeur: 9 },
          ],
        }),
      ),
    ),
    ["MJ : corps d'Aubépine : 10 → 9."],
  );
  // La durée d'un état du MJ se dit du camp qui joue.
  assert.deepEqual(textes(depart, jouer(depart, mj("etat", "pj1", { ajout: { libre: "Couvert de farine", duree: "tour" } }))), ["MJ : état « Couvert de farine » sur Aubépine, jusqu'au prochain tour des PJ."]);

  const equipe = jouer(
    depart,
    mj("equipement", "pj1", {
      photo: AUBEPINE.valeurs,
      changements: [
        { genre: "arme", nom: "Couteau d'office" },
        { genre: "qualite", objet: "Couvercle de marmite", avant: "2", apres: "3" },
        { genre: "arme", nom: null },
        { genre: "qualite", objet: "Couteau d'office", avant: null, apres: "1,5" },
      ],
    }),
  );
  assert.deepEqual(textes(depart, equipe), [
    "MJ : Aubépine tient Couteau d'office. MJ : qualité de Couvercle de marmite d'Aubépine : 2 → 3. MJ : Aubépine ne tient aucune arme. MJ : qualité de Couteau d'office d'Aubépine : aucune → 1,5.",
  ]);
  const cellule = jouer(
    depart,
    mj("equipement", "adv2", {
      photo: MARMITON.valeurs,
      changements: [
        { genre: "cellule", noms: ["Spatule souple", "Couvercle de marmite"] },
        { genre: "cellule", noms: [] },
      ],
    }),
  );
  assert.deepEqual(textes(depart, cellule), ["MJ : équipement de Marmiton : Spatule souple, Couvercle de marmite. MJ : équipement de Marmiton : aucun."]);

  const avecBouclier = combat(surD4(pjEssai((champs) => (champs.bouclier = { nom: "Couvercle de marmite", defense: 8 })), MARMITON));
  assert.deepEqual(textes(avecBouclier, jouer(avecBouclier, mj("valeurs", "pj1", { valeurs: [{ champ: "bouclier", valeur: 9 }] }))), ["MJ : défense du bouclier d'Aubépine : 8 → 9."]);
  const deux = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  assert.deepEqual(textes(deux, jouer(deux, mj("retirer", "adv3"))), ["MJ : Marmiton n° 2 quitte le combat."]);
});

// ─── L'annulation ───────────────────────────────────────────────────────────

test("« Annulé : » d'un geste du MJ, par ce qu'il a changé ; d'un effet hors d'un geste ; un geste emboîté se défait avec son geste racine, sous la ligne de celui-ci", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON, MARMITON));
  const annule = (...evenements) => {
    const fait = jouer(depart, ...evenements);
    return textes(fait, jouer(fait, ANNULER))[0];
  };
  assert.deepEqual(
    [
      annule(mj("valeurs", "adv2", { valeurs: [{ champ: "defense", valeur: 6 }] })),
      annule(mj("valeurs", "pj1", { valeurs: [{ champ: "armure", zone: 1, valeur: 4 }] })),
      annule(
        mj("valeurs", "pj1", {
          valeurs: [
            { champ: "souffle", valeur: 4 },
            { champ: "corps", valeur: 9 },
          ],
        }),
      ),
      annule(mj("equipement", "pj1", { photo: AUBEPINE.valeurs, changements: [{ genre: "arme", nom: "Couteau d'office" }] })),
      annule(mj("etat", "adv2", { ajout: { capacite: ETOURDI, duree: "combat" } })),
      annule(mj("deplacer", "adv2", { vers: "D5" })),
      annule(mj("retirer", "adv3")),
      annule(effet("deplacer", { sur: "adv2", vers: "D5" })),
    ],
    [
      "Annulé : MJ — défense de Marmiton n° 1.",
      "Annulé : MJ — Aubépine, torse : armure.",
      "Annulé : MJ — valeurs d'Aubépine.",
      "Annulé : MJ — équipement d'Aubépine.",
      "Annulé : MJ — état de Marmiton n° 1.",
      "Annulé : MJ — déplacement de Marmiton n° 1.",
      "Annulé : MJ — retrait de Marmiton n° 2.",
      "Annulé : effet de MJ sur Marmiton n° 1.",
    ],
  );

  // Le geste racine et son intervention : une ligne « Annulé », qui barre la ligne du geste et le cadre qu'il a entraîné.
  const adverse = combat(surD4(AUBEPINE, MARMITON, CIBOULETTE), { quiCommence: "adv" });
  const suites = attaqueDuMarmiton(adverse);
  const fini = jouer(suites, intervenir(suites, "pj3", "Dressage minute"), viser("pj1"), CONFIRMER, APPLIQUER);
  const defait = jouer(fini, ANNULER);
  const [ligne] = ecrites(fini, defait);
  assert.equal(ligne.texte, "Annulé : Marmiton — Frappe.");
  assert.deepEqual(ligne.barre, [adverse.journal.length, fini.journal.length]);
});

// Choix 11 de l'agent principal : pendant la préparation d'un geste, la palette
// n'offre que les effets « pour ce jet » ; un geste retiré n'écrit rien, ni de
// lui ni de ses effets.
test("un effet appliqué pendant la préparation d'un geste ensuite retiré ne s'écrit pas", () => {
  const depart = combat(surD4(AUBEPINE, MARMITON));
  const minutieDAubepine = source(depart, "pj1", "Minutie");
  const prepare = jouer(
    depart,
    capacite(depart, "pj1", "Frappe"),
    viser("adv2"),
    effet("avantages", { nombre: 1 }, minutieDAubepine),
    effet("defense", { sur: "adv2", n: -1, duree: "jet" }, source(depart, "pj1", "Frappe")),
  );
  const retire = jouer(prepare, REVENIR);
  assert.deepEqual(textes(depart, retire), [], "rien n'est écrit");
  const joue = jouer(retire, capacite(retire, "pj1", "Frappe"), viser("adv2"), d8(8), d8(2), d20(5), APPLIQUER);
  assert.deepEqual(textes(depart, joue), ["Aubépine : Frappe contre Marmiton. d8 contre 5 → 8 ✓, 2 ✗ : 1 réussite, A = 5. Localisation d20 → 5 : torse. Armure 10 → 5."], "ni l'avantage, ni l'écart");
});
