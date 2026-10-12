// Contrôles de la séance d'un combat (SPECIFICATION.md, § 17 et § 7.2) :
// les commandes que l'écran lui passe, le texte qu'elle donne au gardien, qui
// est choisi pour jouer, et surtout l'ouverture d'un combat gardé, cas par
// cas : ce qui se reprend, ce qui ne se reprend pas, et ce que la séance
// refuse alors de jouer.
//
// Chaque cas d'ouverture se joue deux fois : sur le magasin en mémoire, et
// sur le vrai magasin posé sur une IndexedDB simulée. Les clés se fabriquent
// à l'exécution, d'un mot de passe tiré au hasard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nouveauSecret } from "../js/securite/chiffrement.js";
import { PHRASES_DE_GARDE, chiffrerCombat, creerGardien, dechiffrerCombat, magasinCombatIndexedDB, magasinCombatMemoire } from "../js/combat/enregistrement.js";
import { validerEvenement } from "../js/combat/forme.js";
import { gesteEnCours } from "../js/combat/moteur.js";
import { offre } from "../js/combat/offre.js";
import { creerSeance, heureMurale } from "../js/combat/seance.js";
import { journalAttendu, scenario } from "./outils/combat_reference.js";
import { desImposes } from "./outils/des_imposes.js";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";
import { adversaireEssai, aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai, pjEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

const NOM_BASE = "atelier-des-arpenteurs-combat";
const SOURCE = readFileSync(new URL("../js/combat/seance.js", import.meta.url), "utf8");

// Une dérivation coûte : deux pour tout le fichier.
const SECRET = await nouveauSecret(crypto.randomUUID());
const AUTRE = await nouveauSecret(crypto.randomUUID());

// 12/10/2026 à 21 h 30, heure de l'appareil : l'heure du combat de référence.
const SOIR = () => new Date(2026, 9, 12, 21, 30);

// ─── Les deux magasins ──────────────────────────────────────────────────────

// Un lieu : de quoi ouvrir un onglet de plus sur la même base, et lire
// l'enveloppe qu'elle garde, sans passer par le gardien.
const LIEUX = [
  [
    "le magasin en mémoire",
    () => {
      const magasin = magasinCombatMemoire();
      return { durable: false, onglet: async () => magasin, gardee: (mode = "demo") => magasin.lire(mode) };
    },
  ],
  [
    "l'IndexedDB simulée",
    () => {
      const fabrique = fabriqueIndexedDB();
      return {
        durable: true,
        fabrique,
        async onglet() {
          const retirer = fabrique.installer();
          try {
            return await magasinCombatIndexedDB();
          } finally {
            retirer();
          }
        },
        gardee: async (mode = "demo") => fabrique.contenu(NOM_BASE).combats?.[mode] ?? null,
      };
    },
  ],
];

/** Un contrôle par lieu. */
function partout(titre, corps) {
  for (const [nom, fabriquer] of LIEUX) test(`${titre} (${nom})`, () => corps(fabriquer()));
}

/** Une source de dés qui note ce qu'on lui demande. */
function desNotes(valeurs = []) {
  const source = desImposes(valeurs);
  const demandes = [];
  return {
    demandes,
    reste: () => source.reste(),
    lancer(faces, combien) {
      demandes.push([faces, combien]);
      return source.lancer(faces, combien);
    },
  };
}

/** Une séance et son gardien, sur un onglet du lieu. */
async function monter(lieu, { secret = SECRET, des = desNotes(), mode = "demo", magasin = null, maintenant = SOIR } = {}) {
  const pose = magasin ?? (await lieu.onglet());
  const gardien = creerGardien({ magasin: pose, mode, secret: () => secret });
  const seance = creerSeance({ gardien, des, maintenant, mode, accepter: () => {} });
  return { seance, gardien, des, magasin: pose };
}

const memoire = () => LIEUX[0][1]();
const simulee = () => LIEUX[1][1]();

/** Ce que la base garde, déchiffré : { texte, revision }, ou null. */
async function lireLaBase(lieu, { secret = SECRET, mode = "demo" } = {}) {
  const enveloppe = await lieu.gardee(mode);
  return enveloppe === null ? null : dechiffrerCombat(enveloppe, secret, { mode });
}

/** Pose un texte dans une base vide, chiffré comme le ferait le gardien. */
async function poserEnBase(lieu, texte, { revision = 3, secret = SECRET, mode = "demo", retoucher = (enveloppe) => enveloppe } = {}) {
  const enveloppe = retoucher(await chiffrerCombat(texte, secret, { mode, revision }));
  const magasin = await lieu.onglet();
  assert.deepEqual(await magasin.ecrireSi(enveloppe, 0), { ecrit: true });
  return enveloppe;
}

const accepte = (issue) => assert.deepEqual(issue, {});
const refuse = (issue, code, message) => {
  assert.deepEqual(Object.keys(issue), ["refus"]);
  assert.equal(issue.refus.code, code);
  if (message !== undefined) assert.equal(issue.refus.message, message);
};

// ─── Les combats d'essai ────────────────────────────────────────────────────

const AUBEPINE = pjEssai();
const CIBOULETTE = pjEssai((valeurs) => {
  valeurs.identifiant = "essai-ciboulette-0000000002";
  valeurs.nom = "Ciboulette";
});
const MARMITON = adversaireEssai();

// Les indices des capacités d'Aubépine (tests/outils/photographies_essai.js).
const FRAPPE = 0;
const EMINCER = 1;

const capacite = (qui, indice) => ({ evenement: { type: "capacite", qui, capacite: indice, facon: 0 } });
const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });

/** Aubépine (pj1), Ciboulette (pj2) et un Marmiton (adv3), tous sur A1 : chacun est à portée. */
function preparerLeTrio(seance) {
  accepte(seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }));
  accepte(seance.preparer({ type: "ajouter_personnage", photo: CIBOULETTE }));
  accepte(seance.preparer({ type: "ajouter_adversaires", photos: [MARMITON] }));
  accepte(seance.preparer({ type: "poser", id: "pj2", case: "A1" }));
  accepte(seance.preparer({ type: "poser", id: "adv3", case: "A1" }));
}

function lancerLeTrio(seance) {
  preparerLeTrio(seance);
  accepte(seance.lancer());
}

// Le combat de référence, tel que le lecteur de scénario le traduit.
const PHOTOS_DE_REFERENCE = { "Aubépine Crèmebrûlée": aubepineEssai(), "Chef de partie": chefDePartieEssai(), "Marmiton de corvée": marmitonDeCorveeEssai() };
const REFERENCE = versContenu(scenario, PHOTOS_DE_REFERENCE);

/** La mise en place du combat de référence, par les commandes de la séance. */
function preparerLaReference(seance) {
  accepte(seance.preparer({ type: "ajouter_personnage", photo: PHOTOS_DE_REFERENCE["Aubépine Crèmebrûlée"] }));
  accepte(seance.preparer({ type: "ajouter_adversaires", photos: [PHOTOS_DE_REFERENCE["Chef de partie"]] }));
  accepte(seance.preparer({ type: "ajouter_adversaires", photos: [PHOTOS_DE_REFERENCE["Marmiton de corvée"], PHOTOS_DE_REFERENCE["Marmiton de corvée"]] }));
  for (const [id, nomDeCase] of [
    ["pj1", "C3"],
    ["adv2", "F6"],
    ["adv3", "D4"],
    ["adv4", "D4"],
  ]) {
    accepte(seance.preparer({ type: "poser", id, case: nomDeCase }));
  }
}

const lignes = (seance) => seance.etat().journal.map((ligne) => ligne.texte);

// ─── Le module ──────────────────────────────────────────────────────────────

test("le module n'a aucun état : ni variable de module, ni combat partagé entre deux séances", async () => {
  assert.doesNotMatch(SOURCE, /^(?:let|var)\s/m, "aucune variable de module ne change");
  const premiere = (await monter(memoire())).seance;
  const seconde = (await monter(memoire())).seance;
  lancerLeTrio(premiere);
  assert.equal(premiere.etat().phase, "combat");
  assert.equal(seconde.etat().phase, "preparation");
  assert.deepEqual(seconde.miseEnPlace().protagonistes, []);
  assert.equal(seconde.texte(1), '{"regles":1,"revision":1,"miseEnPlace":{"mode":"demo","quiCommence":"pj","compteur":0,"protagonistes":[]},"evenements":[]}');
});

test("le module n'importe que le moteur, l'offre, la préparation, la forme et les règles du combat", () => {
  const importes = [...SOURCE.matchAll(/^import .* from "(.+)";$/gm)].map((trouve) => trouve[1]);
  assert.deepEqual(importes, ["./moteur.js", "./offre.js", "./preparation.js", "./forme.js", "./regles.js"]);
  assert.doesNotMatch(SOURCE, /\bimport\(/);
  assert.doesNotMatch(SOURCE, /innerHTML|localStorage|indexedDB|document\./);
});

test("une séance neuve est celle de son mode, vide, en préparation, sans personne de choisi", async () => {
  for (const mode of ["demo", "reel"]) {
    const { seance } = await monter(memoire(), { mode });
    assert.deepEqual(seance.miseEnPlace(), { mode, quiCommence: "pj", compteur: 0, protagonistes: [] });
    assert.equal(seance.etat().mode, mode);
    assert.equal(seance.etat().phase, "preparation");
    assert.equal(seance.choisi(), null);
    assert.equal(seance.bloque(), null);
  }
});

// ─── L'heure ────────────────────────────────────────────────────────────────

test("heureMurale écrit l'heure locale en composantes, chiffres complétés", () => {
  assert.equal(heureMurale(new Date(2026, 9, 11, 23, 5)), "2026-10-11T23:05");
  assert.equal(heureMurale(new Date(2026, 0, 2, 3, 4, 59, 999)), "2026-01-02T03:04");
  assert.equal(heureMurale(new Date(2026, 11, 31, 0, 0)), "2026-12-31T00:00");
});

test("lancer() pose l'heure locale du moment dans l'événement, et nulle part ailleurs", async () => {
  let heure = new Date(2026, 9, 11, 23, 5);
  const { seance } = await monter(memoire(), { maintenant: () => heure });
  preparerLeTrio(seance);
  assert.equal(seance.etat().lanceLe, null);
  accepte(seance.lancer());
  assert.equal(seance.etat().lanceLe, "2026-10-11T23:05");
  assert.deepEqual(JSON.parse(seance.texte(1)).evenements, [{ type: "lancer", le: "2026-10-11T23:05" }]);
  // L'horloge qui avance ne change rien au combat lancé.
  heure = new Date(2027, 0, 1, 8, 0);
  accepte(seance.choisir("pj1"));
  accepte(seance.executer(capacite("pj1", FRAPPE)));
  assert.equal(seance.etat().lanceLe, "2026-10-11T23:05");
  assert.doesNotMatch(seance.texte(1), /2027/);
});

test("lancer() sans les deux camps est refusé, avec la raison du moteur, et rien ne se lance", async () => {
  const { seance } = await monter(memoire());
  accepte(seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }));
  refuse(seance.lancer(), "interdit", "Il faut au moins un personnage et un adversaire.");
  assert.equal(seance.etat().phase, "preparation");
  assert.deepEqual(JSON.parse(seance.texte(1)).evenements, []);
});

// ─── La préparation ─────────────────────────────────────────────────────────

partout("chaque commande de préparation change la mise en place, refait l'état, et se garde", async (lieu) => {
  const { seance, gardien } = await monter(lieu);
  assert.deepEqual(await seance.ouvrir(), { issue: "vide" });
  let revision = 0;
  const gardeeApres = async (commande) => {
    accepte(seance.preparer(commande));
    await gardien.repos();
    const lu = await lireLaBase(lieu);
    revision += 1;
    assert.equal(lu.revision, revision, "chaque changement de la préparation s'enregistre");
    assert.equal(lu.texte, seance.texte(revision));
    assert.equal(seance.etat().phase, "preparation");
  };

  await gardeeApres({ type: "ajouter_personnage", photo: AUBEPINE });
  assert.deepEqual(seance.etat().ordre, ["pj1"]);
  assert.equal(seance.etat().protagonistes.pj1.case, "A1");

  await gardeeApres({ type: "ajouter_adversaires", photos: [MARMITON, MARMITON] });
  assert.deepEqual(seance.etat().ordre, ["pj1", "adv2", "adv3"]);
  assert.equal(seance.etat().noms.adv3.court, "Marmiton n° 2");

  await gardeeApres({ type: "poser", id: "adv3", case: " d4 " });
  assert.equal(seance.miseEnPlace().protagonistes[2].case, "D4");
  assert.equal(seance.etat().protagonistes.adv3.case, "D4");

  await gardeeApres({ type: "retirer", id: "adv2" });
  assert.deepEqual(seance.etat().ordre, ["pj1", "adv3"]);
  assert.equal(seance.etat().noms.adv3.court, "Marmiton", "« Retirer » renumérote");

  await gardeeApres({ type: "qui_commence", camp: "adv" });
  assert.equal(seance.etat().quiCommence, "adv");
  assert.equal(seance.miseEnPlace().quiCommence, "adv");
  assert.equal(seance.bloque(), null, lieu.durable ? "gardé" : "en mémoire : on joue");
  assert.equal(gardien.etat(), lieu.durable ? "garde" : "memoire");
});

test("une commande de préparation refusée ne change rien et ne garde rien", async () => {
  const lieu = simulee();
  const { seance, gardien } = await monter(lieu);
  await seance.ouvrir();
  accepte(seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }));
  await gardien.repos();
  const avant = { miseEnPlace: seance.miseEnPlace(), etat: seance.etat(), texte: seance.texte(1), ecritures: lieu.fabrique.journal.ecritures.length };
  assert.equal(avant.ecritures, 1);

  refuse(seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }), "interdit", "Ce personnage est déjà dans le combat.");
  refuse(seance.preparer({ type: "ajouter_adversaires", photos: Array.from({ length: 13 }, () => MARMITON) }), "interdit", "12 exemplaires au plus d'un même adversaire.");
  refuse(seance.preparer({ type: "ajouter_adversaires", photos: "Marmiton" }), "interdit", "Ce n'est pas un adversaire.");
  refuse(seance.preparer({ type: "ajouter_adversaires", photos: [AUBEPINE] }), "interdit", "Ce n'est pas un adversaire.");
  refuse(seance.preparer({ type: "retirer", id: "adv9" }), "interdit", "Ce protagoniste n'est pas dans le combat.");
  refuse(seance.preparer({ type: "poser", id: "pj1", case: "K4" }), "interdit", "Cette case n'est pas sur la carte : elles vont de A1 à J10.");
  refuse(seance.preparer({ type: "qui_commence", camp: "personne" }), "interdit");
  for (const inconnue of [{ type: "vider" }, { type: "constructor" }, {}, null, undefined, "retirer"]) {
    refuse(seance.preparer(inconnue), "forme", "Cette commande n'est pas de celles de la séance.");
  }

  await gardien.repos();
  assert.equal(seance.miseEnPlace(), avant.miseEnPlace);
  assert.equal(seance.etat(), avant.etat);
  assert.equal(seance.texte(1), avant.texte);
  assert.equal(lieu.fabrique.journal.ecritures.length, avant.ecritures);
});

test("la mise en place se fige au lancement : toute commande de préparation est alors refusée", async () => {
  const { seance } = await monter(memoire());
  preparerLeTrio(seance);
  // Avant le lancement, la même commande passe.
  accepte(seance.preparer({ type: "poser", id: "pj1", case: "B2" }));
  accepte(seance.preparer({ type: "poser", id: "pj1", case: "A1" }));
  accepte(seance.lancer());
  const figee = seance.miseEnPlace();
  for (const commande of [
    { type: "poser", id: "pj1", case: "B2" },
    { type: "retirer", id: "adv3" },
    { type: "qui_commence", camp: "adv" },
    { type: "ajouter_adversaires", photos: [MARMITON] },
    { type: "ajouter_personnage", photo: pjEssai((valeurs) => void (valeurs.identifiant = "essai-estragon-0000000003")) },
  ]) {
    refuse(seance.preparer(commande), "hors_moment", "Le combat est déjà lancé.");
  }
  assert.equal(seance.miseEnPlace(), figee);
});

test("une photographie qui ne se reprendrait pas ne s'ajoute pas ; celle qui s'ajoute est la copie validée", async () => {
  const { seance } = await monter(memoire());
  const hostile = structuredClone(AUBEPINE);
  hostile.valeurs.nom = "Aubépine\nCrèmebrûlée";
  const refus = seance.preparer({ type: "ajouter_personnage", photo: hostile });
  refuse(refus, "interdit");
  assert.match(refus.refus.message, /^Ne s'ajoute pas : .+\.$/);
  const mauvais = structuredClone(MARMITON);
  mauvais.valeurs.actions = -1;
  assert.match(seance.preparer({ type: "ajouter_adversaires", photos: [MARMITON, mauvais] }).refus.message, /^Ne s'ajoute pas : /);
  assert.deepEqual(seance.miseEnPlace().protagonistes, [], "tout ou rien");

  // Une photographie non gelée, mais bien faite, s'ajoute : la séance garde sa copie gelée.
  const degelee = structuredClone(AUBEPINE);
  accepte(seance.preparer({ type: "ajouter_personnage", photo: degelee }));
  const gardee = seance.miseEnPlace().protagonistes[0].photo;
  assert.notEqual(gardee, degelee);
  assert.ok(Object.isFrozen(gardee) && Object.isFrozen(gardee.valeurs.capacites[0]));
  assert.deepEqual(gardee, AUBEPINE);
});

// ─── Jouer, et le texte gardé ───────────────────────────────────────────────

test("un événement refusé ne change ni l'état, ni le texte, ni la base", async () => {
  const lieu = simulee();
  const { seance, gardien } = await monter(lieu);
  await seance.ouvrir();
  lancerLeTrio(seance);
  await gardien.repos();
  const avant = { etat: seance.etat(), texte: seance.texte(9), ecritures: lieu.fabrique.journal.ecritures.length, revision: (await lireLaBase(lieu)).revision };

  refuse(seance.jouer({ type: "appliquer" }), "hors_moment");
  refuse(seance.jouer({ type: "inconnu" }), "forme");
  refuse(seance.jouer({ type: "capacite", qui: "adv3", capacite: 0, facon: 0 }), "interdit");
  refuse(seance.executer({ evenement: { type: "passer", qui: "pj1", enTrop: true } }), "forme");
  await gardien.repos();
  assert.equal(seance.etat(), avant.etat);
  assert.equal(seance.texte(9), avant.texte);
  assert.equal(lieu.fabrique.journal.ecritures.length, avant.ecritures);

  // Dans l'autre sens : accepté, il rejoint la suite et la base.
  accepte(seance.jouer({ type: "passer", qui: "pj1" }));
  await gardien.repos();
  assert.notEqual(seance.etat(), avant.etat);
  assert.deepEqual(JSON.parse(seance.texte(9)).evenements.at(-1), { type: "passer", qui: "pj1" });
  const lu = await lireLaBase(lieu);
  assert.equal(lu.revision, avant.revision + 1);
  assert.equal(lu.texte, seance.texte(lu.revision));
});

test("le texte gardé porte chaque événement dans l'ordre de ses champs, quel que soit celui du clic", async () => {
  const { seance } = await monter(memoire());
  lancerLeTrio(seance);
  accepte(seance.jouer({ facon: 0, capacite: FRAPPE, qui: "pj1", type: "capacite" }));
  accepte(seance.jouer({ raison: "Coup de main", valeur: 1, champ: "modificateur", type: "regler" }));
  const texte = seance.texte(4);
  assert.ok(texte.endsWith('{"type":"capacite","qui":"pj1","capacite":0,"facon":0},{"type":"regler","champ":"modificateur","valeur":1,"raison":"Coup de main"}]}'), texte.slice(-160));
});

test("texte(revision) égale JSON.stringify du contenu, du combat vide au combat de référence joué en entier", async () => {
  const valeurs = REFERENCE.contenu.evenements.filter((evenement) => evenement.type === "de").flatMap((evenement) => evenement.valeurs);
  const { seance, des } = await monter(memoire(), { des: desNotes(valeurs) });
  const contenu = (revision, evenements) => JSON.stringify({ regles: 1, revision, miseEnPlace: seance.miseEnPlace(), evenements });
  assert.equal(seance.texte(1), contenu(1, []));

  preparerLaReference(seance);
  assert.deepEqual(seance.miseEnPlace(), REFERENCE.contenu.miseEnPlace);
  assert.equal(seance.texte(8), contenu(8, []));

  // Le combat de référence, par les commandes de l'écran : chaque dé par
  // lancerLeDe(), qui demande à la source ce que le moteur attend.
  accepte(seance.lancer());
  const joues = [REFERENCE.contenu.evenements[0]];
  for (const evenement of REFERENCE.contenu.evenements.slice(1)) {
    accepte(evenement.type === "de" ? seance.lancerLeDe() : seance.executer({ evenement }));
    joues.push(evenement);
    if (joues.length % 40 === 0) assert.equal(seance.texte(joues.length), contenu(joues.length, joues.map((joue) => validerEvenement(joue).evenement)));
  }
  assert.deepEqual(des.reste(), [], "tous les dés du scénario sont tombés, et aucun autre");
  assert.deepEqual(
    des.demandes,
    REFERENCE.contenu.evenements.filter((evenement) => evenement.type === "de").map((evenement) => [evenement.faces, evenement.valeurs.length]),
  );
  assert.deepEqual(lignes(seance), journalAttendu);
  assert.deepEqual(seance.etat(), REFERENCE.etat);

  const texte = seance.texte(17);
  assert.equal(texte, contenu(17, joues.map((joue) => validerEvenement(joue).evenement)));
  assert.deepEqual(JSON.parse(texte), JSON.parse(JSON.stringify({ ...REFERENCE.contenu, revision: 17 })));
  assert.equal(texte, JSON.stringify(JSON.parse(texte)), "ni blanc, ni clé de trop");
  assert.equal(seance.etat().phase, "termine");
});

// ─── Qui joue ───────────────────────────────────────────────────────────────

test("choisir : un candidat ou personne ; un autre que l'acteur d'un geste non payé le fait d'abord revenir", async () => {
  const { seance, des } = await monter(memoire(), { des: desNotes([8, 1, 12]) });
  preparerLeTrio(seance);
  // Avant le lancement, personne n'est candidat.
  refuse(seance.choisir("pj1"), "interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
  accepte(seance.choisir(null));
  accepte(seance.lancer());
  const evenements = () => JSON.parse(seance.texte(1)).evenements;
  assert.equal(seance.choisi(), null);

  // Ni un adversaire pendant le tour des PJ, ni un inconnu.
  for (const id of ["adv3", "pj9", "constructor", undefined, 1]) {
    refuse(seance.choisir(id), "interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
    assert.equal(seance.choisi(), null);
  }

  // Choisir n'est pas un événement.
  accepte(seance.choisir("pj1"));
  assert.equal(seance.choisi(), "pj1");
  assert.equal(evenements().length, 1);
  accepte(seance.executer({ choisir: "pj2" }));
  assert.equal(seance.choisi(), "pj2");
  accepte(seance.executer({ choisir: null }));
  assert.equal(seance.choisi(), null);

  // Un geste ouvert : « choisi » suit son acteur.
  accepte(seance.choisir("pj1"));
  accepte(seance.executer(capacite("pj2", FRAPPE)));
  assert.equal(seance.choisi(), "pj2");

  // Le même acteur : rien ne revient.
  accepte(seance.choisir("pj2"));
  assert.equal(gesteEnCours(seance.etat()).acteur, "pj2");
  assert.equal(evenements().at(-1).type, "capacite");

  // Un autre : le geste non payé revient, puis le choix se pose.
  accepte(seance.choisir("pj1"));
  assert.equal(gesteEnCours(seance.etat()), null);
  assert.deepEqual(evenements().at(-1), { type: "revenir" });
  assert.equal(seance.choisi(), "pj1");

  // Personne : de même.
  accepte(seance.executer(capacite("pj1", FRAPPE)));
  accepte(seance.choisir(null));
  assert.equal(gesteEnCours(seance.etat()), null);
  assert.equal(seance.choisi(), null);
  assert.equal(evenements().filter((evenement) => evenement.type === "revenir").length, 2);

  // Un geste payé ne se quitte pas.
  accepte(seance.executer(capacite("pj1", FRAPPE)));
  accepte(seance.executer(regler("cible", "adv3")));
  accepte(seance.lancerLeDe());
  assert.equal(gesteEnCours(seance.etat()).paye, true);
  const paye = seance.etat();
  refuse(seance.choisir("pj2"), "hors_moment", "Le geste en cours se finit d'abord.");
  refuse(seance.choisir(null), "hors_moment", "Le geste en cours se finit d'abord.");
  assert.equal(seance.etat(), paye);
  assert.equal(seance.choisi(), "pj1");
  accepte(seance.choisir("pj1"));

  // Le geste fini, celui qui a joué reste choisi tant qu'il est candidat…
  accepte(seance.lancerLeDe());
  accepte(seance.lancerLeDe());
  accepte(seance.executer({ evenement: { type: "appliquer" } }));
  assert.equal(gesteEnCours(seance.etat()), null);
  assert.equal(seance.etat().protagonistes.pj1.actions, 1);
  assert.equal(seance.choisi(), "pj1");
  // … puis le choix retombe.
  accepte(seance.jouer({ type: "passer", qui: "pj1" }));
  assert.equal(seance.choisi(), null);
  refuse(seance.choisir("pj1"), "interdit");
  assert.deepEqual(des.reste(), []);
});

test("executer aiguille les trois commandes des vues, et refuse le reste", async () => {
  const { seance } = await monter(memoire());
  accepte(seance.executer({ preparer: { type: "ajouter_personnage", photo: AUBEPINE } }));
  accepte(seance.executer({ preparer: { type: "ajouter_adversaires", photos: [MARMITON] } }));
  assert.deepEqual(seance.etat().ordre, ["pj1", "adv2"]);
  accepte(seance.executer({ evenement: { type: "lancer", le: "2026-10-12T21:30" } }));
  assert.equal(seance.etat().phase, "combat");
  accepte(seance.executer({ choisir: "pj1" }));
  assert.equal(seance.choisi(), "pj1");
  const avant = seance.etat();
  for (const inconnue of [{}, { lancer: true }, null, undefined, "revenir", 3]) {
    refuse(seance.executer(inconnue), "forme", "Cette commande n'est pas de celles de la séance.");
  }
  assert.equal(seance.etat(), avant);
  assert.equal(seance.choisi(), "pj1");
});

// ─── Le dé ──────────────────────────────────────────────────────────────────

test("lancerLeDe ne tire que le dé que le moteur attend, avec ses faces et son nombre", async () => {
  const { seance, des } = await monter(memoire(), { des: desNotes([8, 2, 20, 6]) });
  lancerLeTrio(seance);

  // Aucun geste : aucun dé.
  refuse(seance.lancerLeDe(), "hors_moment", "Aucun dé n'est attendu à cet instant.");
  // Un geste qui n'est pas prêt : sa raison, et toujours aucun dé.
  accepte(seance.executer(capacite("pj1", EMINCER)));
  refuse(seance.lancerLeDe(), "interdit", "Choisissez une cible.");
  assert.deepEqual(des.demandes, []);
  assert.equal(gesteEnCours(seance.etat()).paye, false);

  // Prêt : hors maîtrise, un désavantage, donc deux valeurs pour ce dé.
  accepte(seance.executer(regler("cible", "adv3")));
  assert.deepEqual(offre(seance.etat()).de, { faces: 8, combien: 2, motif: "chaine", place: 1 });
  accepte(seance.lancerLeDe());
  assert.deepEqual(des.demandes, [[8, 2]]);
  assert.deepEqual(JSON.parse(seance.texte(1)).evenements.at(-1), { type: "de", faces: 8, valeurs: [8, 2] });
  // Le pire des deux (2) manque la défense de 5 : le geste est fini, payé.
  assert.equal(gesteEnCours(seance.etat()), null);
  assert.equal(seance.etat().protagonistes.pj1.souffle, 6);

  // Une attaque qui touche, puis son d20 : une seule valeur, à vingt faces.
  accepte(seance.executer(capacite("pj2", FRAPPE)));
  accepte(seance.executer(regler("cible", "adv3")));
  const { seance: autre, des: autresDes } = await monter(memoire(), { des: desNotes([6, 1, 12]) });
  lancerLeTrio(autre);
  accepte(autre.executer(capacite("pj1", FRAPPE)));
  accepte(autre.executer(regler("cible", "adv3")));
  accepte(autre.lancerLeDe());
  accepte(autre.lancerLeDe());
  assert.equal(gesteEnCours(autre.etat()).moment, "bilan");
  accepte(autre.lancerLeDe());
  assert.deepEqual(autresDes.demandes, [
    [8, 1],
    [8, 1],
    [20, 1],
  ]);
  assert.deepEqual(autresDes.reste(), []);
});

// ─── L'ouverture ────────────────────────────────────────────────────────────

partout("ouvrir : rien de gardé, la séance reste vide et se joue", async (lieu) => {
  const { seance, gardien } = await monter(lieu);
  assert.deepEqual(await seance.ouvrir(), { issue: "vide" });
  assert.equal(seance.bloque(), null);
  assert.deepEqual(seance.miseEnPlace().protagonistes, []);
  assert.equal(gardien.etat(), lieu.durable ? "garde" : "memoire");
  lancerLeTrio(seance);
  await gardien.repos();
  // La première écriture part au premier clic ; les suivantes, venues
  // pendant qu'elle chiffrait, n'en font qu'une.
  const lu = await lireLaBase(lieu);
  assert.equal(lu.revision, 2);
  assert.equal(lu.texte, seance.texte(2));
});

partout("ouvrir : un combat gardé se reprend, état et journal au signe près, par un autre onglet", async (lieu) => {
  const premier = await monter(lieu, { des: desNotes([8]) });
  await premier.seance.ouvrir();
  lancerLeTrio(premier.seance);
  accepte(premier.seance.executer(capacite("pj1", FRAPPE)));
  accepte(premier.seance.executer(regler("cible", "adv3")));
  accepte(premier.seance.lancerLeDe());
  await premier.gardien.repos();

  const second = await monter(lieu);
  assert.deepEqual(await second.seance.ouvrir(), { issue: "repris" });
  assert.equal(second.seance.bloque(), null);
  assert.deepEqual(second.seance.etat(), premier.seance.etat());
  assert.deepEqual(second.seance.miseEnPlace(), premier.seance.miseEnPlace());
  assert.equal(second.seance.texte(12), premier.seance.texte(12));
  assert.ok(Object.isFrozen(second.seance.miseEnPlace()) && Object.isFrozen(second.seance.etat()));
  // Le geste en cours dit qui joue ; hors de lui, personne n'est choisi.
  assert.equal(second.seance.choisi(), "pj1");

  // Le combat repris se joue et se garde à la révision suivante.
  const revision = (await lireLaBase(lieu)).revision;
  accepte(second.seance.jouer({ type: "de", faces: 8, valeurs: [1] }));
  await second.gardien.repos();
  const lu = await lireLaBase(lieu);
  assert.equal(lu.revision, revision + 1);
  assert.equal(lu.texte, second.seance.texte(revision + 1));
  assert.equal(second.seance.choisi(), "pj1");
});

test("ouvrir : hors d'un geste, personne n'est choisi après un rechargement", async () => {
  const lieu = simulee();
  const premier = await monter(lieu);
  await premier.seance.ouvrir();
  lancerLeTrio(premier.seance);
  accepte(premier.seance.choisir("pj2"));
  await premier.gardien.repos();
  const second = await monter(lieu);
  assert.deepEqual(await second.seance.ouvrir(), { issue: "repris" });
  assert.equal(premier.seance.choisi(), "pj2");
  assert.equal(second.seance.choisi(), null);
});

partout("un rechargement en plein geste retrouve le moment, et n'attend pas un dé déjà lancé", async (lieu) => {
  // Le point de la maquette : au septième geste, deux dés lancés, la relance
  // choisie, son dé à cliquer.
  const coupe = versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: { geste: 7, des: 2 } });
  const suite = REFERENCE.contenu.evenements.slice(coupe.contenu.evenements.length);
  assert.equal(suite[0].type, "de");
  await poserEnBase(lieu, JSON.stringify({ ...coupe.contenu, revision: 3 }));

  const des = desNotes(suite[0].valeurs);
  const { seance, gardien } = await monter(lieu, { des });
  assert.deepEqual(await seance.ouvrir(), { issue: "repris" });
  assert.deepEqual(seance.etat(), coupe.etat);
  const geste = gesteEnCours(seance.etat());
  assert.equal(geste.moment, "jet");
  assert.equal(geste.paye, true);
  assert.equal(geste.jet.attente, "de_relance");
  assert.equal(seance.choisi(), geste.acteur);
  // Les deux dés déjà tombés sont dans le jet ; le moteur n'attend que le suivant.
  const tombes = geste.jet.places.flatMap((place) => place.essais).length;
  assert.equal(tombes, 2);
  assert.deepEqual(offre(seance.etat()).de, { faces: suite[0].faces, combien: 1, motif: "relance", place: geste.jet.places.length });
  assert.deepEqual(des.demandes, [], "l'ouverture ne tire aucun dé");

  accepte(seance.lancerLeDe());
  assert.deepEqual(des.demandes, [[suite[0].faces, 1]]);
  assert.deepEqual(des.reste(), []);
  // La suite du scénario mène au même journal que le combat joué d'une traite.
  for (const evenement of suite.slice(1)) accepte(seance.jouer(evenement));
  assert.deepEqual(lignes(seance), journalAttendu);
  assert.deepEqual(seance.etat(), REFERENCE.etat);
  await gardien.repos();
  assert.equal((await lireLaBase(lieu)).revision, 5, "une file à une place : le premier dé part, puis une seule écriture porte toute la suite");
  assert.equal((await lireLaBase(lieu)).texte, seance.texte(5));
});

partout("un combat dont une photographie porte une description de deux lignes se garde et se reprend", async (lieu) => {
  const DEUX_LIGNES = "Fait revenir à feu vif.\nPuis déglace : 2 dégâts de plus.";
  const bavarde = pjEssai((valeurs) => {
    valeurs.capacites[FRAPPE].facons[0].description = DEUX_LIGNES;
  });
  const premier = await monter(lieu);
  await premier.seance.ouvrir();
  accepte(premier.seance.preparer({ type: "ajouter_personnage", photo: bavarde }));
  accepte(premier.seance.preparer({ type: "ajouter_adversaires", photos: [MARMITON] }));
  accepte(premier.seance.lancer());
  await premier.gardien.repos();

  const second = await monter(lieu);
  assert.deepEqual(await second.seance.ouvrir(), { issue: "repris" });
  assert.equal(second.seance.miseEnPlace().protagonistes[0].photo.valeurs.capacites[FRAPPE].facons[0].description, DEUX_LIGNES);
  assert.equal(second.seance.etat().photos.pj1.capacites[FRAPPE].facons[0].description, DEUX_LIGNES);
  assert.deepEqual(second.seance.etat(), premier.seance.etat());
  assert.equal(second.seance.etat().phase, "combat");
});

// Les contenus qui ne se reprennent pas, chacun fabriqué d'un contenu sain.
const SAIN = JSON.parse(JSON.stringify(versContenu(scenario, PHOTOS_DE_REFERENCE, { jusqua: 2 }).contenu));
const abime = (retoucher) => {
  const contenu = structuredClone(SAIN);
  contenu.revision = 3;
  return JSON.stringify(retoucher(contenu) ?? contenu);
};

const ILLISIBLES = [
  ["un texte qui n'est pas du JSON", {}, () => '{"regles":1,"revision":3,"miseEnPlace":'],
  ["un contenu refusé : une clé de trop", {}, () => abime((contenu) => ({ ...contenu, enTrop: [] }))],
  ["un contenu refusé : une clé qui manque", {}, () => abime((contenu) => void delete contenu.evenements)],
  ["un contenu refusé : le combat d'un autre mode", {}, () => abime((contenu) => void (contenu.miseEnPlace.mode = "reel"))],
  ["un contenu refusé : une photographie dont le nom tient sur deux lignes", {}, () => abime((contenu) => void (contenu.miseEnPlace.protagonistes[0].photo.valeurs.nom = "Aubépine\nCrèmebrûlée"))],
  ["un contenu refusé : un événement mal fait", {}, () => abime((contenu) => void contenu.evenements.push({ type: "de", faces: 8 }))],
  ["une révision qui ne concorde pas avec celle de l'enveloppe", {}, () => abime((contenu) => void (contenu.revision = 5))],
  ["un rejeu refusé : un événement bien fait, mais hors de son moment", {}, () => abime((contenu) => void contenu.evenements.push({ type: "appliquer" }))],
  ["un rejeu refusé : un dé qui n'est pas celui qu'attend le moteur", {}, () => abime((contenu) => void contenu.evenements.splice(1, 0, { type: "de", faces: 12, valeurs: [3] }))],
  ["le sel d'une autre clé (le mot de passe de table a changé)", { secret: AUTRE }, () => abime(() => {})],
  [
    "un chiffré abîmé",
    {
      retoucher: (enveloppe) => ({ ...enveloppe, chiffre: `${enveloppe.chiffre.at(0) === "A" ? "B" : "A"}${enveloppe.chiffre.slice(1)}` }),
    },
    () => abime(() => {}),
  ],
];

const COMMANDES = [
  ["preparer", (seance) => seance.preparer({ type: "qui_commence", camp: "adv" })],
  ["preparer (ajout)", (seance) => seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE })],
  ["lancer", (seance) => seance.lancer()],
  ["choisir", (seance) => seance.choisir(null)],
  ["jouer", (seance) => seance.jouer({ type: "fin_de_tour" })],
  ["lancerLeDe", (seance) => seance.lancerLeDe()],
  ["executer (événement)", (seance) => seance.executer({ evenement: { type: "revenir" } })],
  ["executer (choisir)", (seance) => seance.executer({ choisir: null })],
  ["executer (préparer)", (seance) => seance.executer({ preparer: { type: "retirer", id: "pj1" } })],
];

/** Bloquée, la séance refuse toute commande, par la phrase de la barre, et rien ne bouge. */
function toutEstRefuse({ seance, gardien, des }, phrase) {
  const avant = { etat: seance.etat(), miseEnPlace: seance.miseEnPlace(), choisi: seance.choisi(), texte: seance.texte(1) };
  assert.equal(gardien.phrase(), phrase);
  for (const [nom, commander] of COMMANDES) {
    const issue = commander(seance);
    assert.deepEqual(issue, { refus: { code: "interdit", message: phrase } }, nom);
  }
  assert.equal(seance.etat(), avant.etat);
  assert.equal(seance.miseEnPlace(), avant.miseEnPlace);
  assert.equal(seance.choisi(), avant.choisi);
  assert.equal(seance.texte(1), avant.texte);
  assert.deepEqual(des.demandes, []);
}

for (const [cas, options, fabriquer] of ILLISIBLES) {
  partout(`ouvrir : ${cas} est une donnée abîmée, que seul « Nouveau combat » remplace`, async (lieu) => {
    const enveloppe = await poserEnBase(lieu, fabriquer(), options);
    const montee = await monter(lieu);
    const { seance, gardien } = montee;
    assert.deepEqual(await seance.ouvrir(), { issue: "illisible" });
    assert.equal(seance.bloque(), "illisible");
    assert.equal(gardien.etat(), "illisible");
    assert.deepEqual(seance.miseEnPlace().protagonistes, [], "rien de l'enregistrement n'entre en mémoire");
    assert.equal(seance.etat().phase, "preparation");
    toutEstRefuse(montee, PHRASES_DE_GARDE.illisible);
    await gardien.repos();
    assert.deepEqual(await lieu.gardee(), enveloppe, "la base n'a pas bougé");

    // « Nouveau combat » rend la main tout de suite, et s'écrit au-dessus.
    accepte(seance.nouveau());
    assert.equal(seance.bloque(), null);
    accepte(seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }));
    await gardien.repos();
    assert.equal(gardien.etat(), lieu.durable ? "garde" : "memoire");
    const lu = await lireLaBase(lieu);
    assert.equal(lu.revision, 5, "la révision ne redescend pas : le combat vide à 4, l'ajout à 5");
    assert.equal(lu.texte, seance.texte(5));

    const suivante = await monter(lieu);
    assert.deepEqual(await suivante.seance.ouvrir(), { issue: "repris" });
    assert.deepEqual(suivante.seance.etat().ordre, ["pj1"]);
  });
}

partout("ouvrir : le même contenu, sain, se reprend (les cas abîmés ne tiennent qu'à leur retouche)", async (lieu) => {
  await poserEnBase(lieu, abime(() => {}));
  const { seance } = await monter(lieu);
  assert.deepEqual(await seance.ouvrir(), { issue: "repris" });
  assert.equal(seance.bloque(), null);
  assert.deepEqual(seance.etat().ordre, ["pj1", "adv2", "adv3", "adv4"]);
  assert.deepEqual(lignes(seance), journalAttendu.slice(0, seance.etat().journal.length));
});

partout("ouvrir : un contenu d'une autre version des règles se dit, ne se rejoue pas, et se remplace", async (lieu) => {
  // Cinq clés : une autre version peut en avoir ajouté une, ce n'est pas une donnée abîmée.
  const enveloppe = await poserEnBase(lieu, abime((contenu) => ({ ...contenu, regles: 2, effets: [] })));
  const montee = await monter(lieu);
  const { seance, gardien } = montee;
  assert.deepEqual(await seance.ouvrir(), { issue: "autre_version" });
  assert.equal(seance.bloque(), "autre_version");
  assert.equal(gardien.etat(), "autre_version");
  assert.deepEqual(seance.miseEnPlace().protagonistes, []);
  toutEstRefuse(montee, PHRASES_DE_GARDE.autre_version);
  await gardien.repos();
  assert.deepEqual(await lieu.gardee(), enveloppe);

  accepte(seance.nouveau());
  assert.equal(seance.bloque(), null);
  await gardien.repos();
  const lu = await lireLaBase(lieu);
  assert.equal(lu.revision, 4);
  assert.deepEqual(JSON.parse(lu.texte), { regles: 1, revision: 4, miseEnPlace: { mode: "demo", quiCommence: "pj", compteur: 0, protagonistes: [] }, evenements: [] });
});

partout("ouvrir : une enveloppe d'un format plus récent bloque tout, « Nouveau combat » compris", async (lieu) => {
  const enveloppe = await poserEnBase(lieu, abime(() => {}), { retoucher: (lue) => ({ ...lue, format: 2, compression: "autre" }) });
  const montee = await monter(lieu);
  const { seance, gardien } = montee;
  assert.deepEqual(await seance.ouvrir(), { issue: "recent" });
  assert.equal(seance.bloque(), "recent");
  assert.equal(gardien.etat(), "recent");
  toutEstRefuse(montee, PHRASES_DE_GARDE.recent);
  assert.deepEqual(seance.nouveau(), { refus: { code: "interdit", message: PHRASES_DE_GARDE.recent } });
  assert.equal(seance.bloque(), "recent");
  await gardien.repos();
  assert.deepEqual(await lieu.gardee(), enveloppe, "rien ne s'écrit par-dessus");
});

partout("ouvrir : sans clé, le combat gardé n'est pas lu, la séance se joue en mémoire et n'écrit rien", async (lieu) => {
  const enveloppe = await poserEnBase(lieu, abime(() => {}));
  const { seance, gardien } = await monter(lieu, { secret: null });
  assert.deepEqual(await seance.ouvrir(), { issue: "sans_cle" });
  assert.equal(seance.bloque(), null);
  assert.equal(gardien.etat(), "sans_cle");
  assert.deepEqual(seance.miseEnPlace().protagonistes, []);
  lancerLeTrio(seance);
  accepte(seance.nouveau());
  preparerLeTrio(seance);
  await gardien.repos();
  assert.equal(seance.etat().phase, "preparation");
  assert.deepEqual(await lieu.gardee(), enveloppe);

  // Sans rien de gardé : de même, et la base reste vide.
  const [, fabriquer] = LIEUX.find(([, autre]) => autre().durable === lieu.durable);
  const vide = fabriquer();
  const seule = await monter(vide, { secret: { sel: SECRET.sel, iterations: SECRET.iterations } });
  assert.deepEqual(await seule.seance.ouvrir(), { issue: "sans_cle" });
  assert.equal(seule.seance.bloque(), null);
  lancerLeTrio(seule.seance);
  await seule.gardien.repos();
  assert.equal(await vide.gardee(), null);
});

test("ouvrir : l'oubli du mot de passe pendant la lecture ne remet rien en mémoire", async () => {
  const lieu = simulee();
  await poserEnBase(lieu, abime(() => {}));
  const vrai = await lieu.onglet();
  let lacher;
  const retenue = new Promise((tenir) => (lacher = tenir));
  let lectures = 0;
  const lent = {
    durable: vrai.durable,
    ecrireSi: (...arguments_) => vrai.ecrireSi(...arguments_),
    async lire(mode) {
      lectures += 1;
      const lu = await vrai.lire(mode);
      await retenue;
      return lu;
    },
  };
  const { seance, gardien } = await monter(lieu, { magasin: lent });
  const ouverture = seance.ouvrir();
  while (lectures === 0) await new Promise((suite) => setTimeout(suite, 0));
  gardien.oublier();
  lacher();
  assert.deepEqual(await ouverture, { issue: "sans_cle" });
  assert.deepEqual(seance.miseEnPlace().protagonistes, []);
  assert.equal(seance.etat().phase, "preparation");

  // Dans l'autre sens : sans l'oubli, la même lecture lente reprend le combat.
  const sansOubli = await monter(lieu, { magasin: lent });
  assert.deepEqual(await sansOubli.seance.ouvrir(), { issue: "repris" });
  assert.equal(sansOubli.seance.etat().phase, "combat");
});

// ─── Le blocage, « Reprendre », « Nouveau combat » ──────────────────────────

partout("un combat ouvert ailleurs bloque la séance ; « Reprendre le combat le plus récent » la rend", async (lieu) => {
  const ici = await monter(lieu);
  const ailleurs = await monter(lieu);
  await ici.seance.ouvrir();
  preparerLeTrio(ici.seance);
  await ici.gardien.repos();
  assert.deepEqual(await ailleurs.seance.ouvrir(), { issue: "repris" });

  // L'autre onglet lance le combat ; celui-ci, qui ne le sait pas, déplace un jeton.
  accepte(ailleurs.seance.lancer());
  accepte(ailleurs.seance.jouer({ type: "passer", qui: "pj1" }));
  await ailleurs.gardien.repos();
  const gardee = await lieu.gardee();
  assert.equal(ici.seance.bloque(), null);
  accepte(ici.seance.preparer({ type: "poser", id: "pj1", case: "B2" }));
  await ici.gardien.repos();
  assert.equal(ici.gardien.etat(), "ailleurs");
  assert.equal(ici.seance.bloque(), "ailleurs");
  assert.deepEqual(await lieu.gardee(), gardee, "rien n'est écrasé");
  toutEstRefuse(ici, PHRASES_DE_GARDE.ailleurs);
  assert.deepEqual(ici.seance.nouveau(), { refus: { code: "interdit", message: PHRASES_DE_GARDE.ailleurs } });
  await ici.gardien.repos();
  assert.deepEqual(await lieu.gardee(), gardee);

  // Reprendre : la séance rejoue le combat de l'autre onglet, et repart de sa révision.
  assert.deepEqual(await ici.seance.reprendre(), { issue: "repris" });
  assert.equal(ici.seance.bloque(), null);
  assert.deepEqual(ici.seance.etat(), ailleurs.seance.etat());
  assert.equal(ici.seance.etat().protagonistes.pj1.case, "A1", "le déplacement refusé n'a pas survécu");
  const revision = (await lireLaBase(lieu)).revision;
  accepte(ici.seance.jouer({ type: "passer", qui: "pj2" }));
  await ici.gardien.repos();
  const lu = await lireLaBase(lieu);
  assert.equal(lu.revision, revision + 1);
  assert.equal(lu.texte, ici.seance.texte(revision + 1));

  // Et c'est l'autre onglet, maintenant, qui trouve une révision inattendue.
  accepte(ailleurs.seance.jouer({ type: "fin_de_tour" }));
  await ailleurs.gardien.repos();
  assert.equal(ailleurs.seance.bloque(), "ailleurs");
  assert.deepEqual((await lireLaBase(lieu)).texte, lu.texte);
});

partout("« Nouveau combat » : un combat vide, gardé à la révision suivante, qui se reprend vide", async (lieu) => {
  const { seance, gardien } = await monter(lieu);
  await seance.ouvrir();
  lancerLeTrio(seance);
  accepte(seance.choisir("pj2"));
  accepte(seance.executer(capacite("pj2", FRAPPE)));
  await gardien.repos();
  const avant = await lireLaBase(lieu);
  assert.equal(JSON.parse(avant.texte).evenements.length, 2);

  accepte(seance.nouveau());
  assert.deepEqual(seance.miseEnPlace(), { mode: "demo", quiCommence: "pj", compteur: 0, protagonistes: [] });
  assert.equal(seance.etat().phase, "preparation");
  assert.deepEqual(seance.etat().journal, []);
  assert.deepEqual(seance.etat().ordre, []);
  assert.equal(seance.choisi(), null);
  assert.equal(gesteEnCours(seance.etat()), null);
  await gardien.repos();
  const apres = await lireLaBase(lieu);
  assert.equal(apres.revision, avant.revision + 1, "il n'efface rien : il écrit au-dessus");
  assert.deepEqual(JSON.parse(apres.texte), { regles: 1, revision: apres.revision, miseEnPlace: seance.miseEnPlace(), evenements: [] });

  // Le compteur repart : le combat neuf ne doit rien à l'ancien.
  accepte(seance.preparer({ type: "ajouter_adversaires", photos: [MARMITON] }));
  assert.deepEqual(seance.etat().ordre, ["adv1"]);
  await gardien.repos();
  const suivante = await monter(lieu);
  assert.deepEqual(await suivante.seance.ouvrir(), { issue: "repris" });
  assert.deepEqual(suivante.seance.etat().ordre, ["adv1"]);
  assert.equal(suivante.seance.etat().phase, "preparation");
});

test("une écriture qui échoue ne bloque pas la séance : le combat continue en mémoire", async () => {
  const lieu = simulee();
  const { seance, gardien } = await monter(lieu);
  await seance.ouvrir();
  preparerLeTrio(seance);
  await gardien.repos();
  const gardee = await lieu.gardee();
  lieu.fabrique.pannes.ecritureEchoue = true;
  accepte(seance.lancer());
  await gardien.repos();
  assert.equal(gardien.etat(), "memoire");
  assert.equal(seance.bloque(), null);
  accepte(seance.jouer({ type: "passer", qui: "pj1" }));
  accepte(seance.nouveau());
  await gardien.repos();
  assert.deepEqual(await lieu.gardee(), gardee, "l'écriture d'avant reste");
});

test("le mode à part : la séance de la démonstration ne lit ni n'écrit le combat réel", async () => {
  const lieu = simulee();
  const reel = await monter(lieu, { mode: "reel" });
  await reel.seance.ouvrir();
  accepte(reel.seance.preparer({ type: "ajouter_adversaires", photos: [MARMITON] }));
  await reel.gardien.repos();
  const demo = await monter(lieu, { mode: "demo" });
  assert.deepEqual(await demo.seance.ouvrir(), { issue: "vide" });
  accepte(demo.seance.preparer({ type: "ajouter_personnage", photo: AUBEPINE }));
  await demo.gardien.repos();
  assert.deepEqual(JSON.parse((await lireLaBase(lieu, { mode: "reel" })).texte).miseEnPlace.protagonistes.map((protagoniste) => protagoniste.id), ["adv1"]);
  assert.deepEqual(JSON.parse((await lireLaBase(lieu, { mode: "demo" })).texte).miseEnPlace.protagonistes.map((protagoniste) => protagoniste.id), ["pj1"]);
  assert.equal(JSON.parse(demo.seance.texte(1)).miseEnPlace.mode, "demo");
  assert.equal(JSON.parse(reel.seance.texte(1)).miseEnPlace.mode, "reel");
});
