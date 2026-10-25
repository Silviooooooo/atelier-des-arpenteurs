// Contrôles des écrans des adversaires, construits dans un document simulé
// (SPECIFICATION.md, § 16.6 et § 11, domaine « Adversaires ») : les listes
// et leur recherche, l'accueil, la fiche d'un adversaire et ses deux vues,
// la fiche d'un type, la rencontre et sa composition gardée chiffrée, une
// banque publiée avant le lot 3, et la carte tenue à l'échelle de l'écran
// (l'unique écriture de style se contrôle dans tests/echelle.test.js). La
// banque vient du classeur d'essai, fictif ; les cas fautifs se fabriquent au
// moment de l'essai, et la clé de démonstration se dérive à l'exécution du
// mot de passe public (§ 9). La mise en page et l'impression se mesurent dans
// un vrai navigateur (§ 16.5).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LARGEUR_CARTE } from "../js/adversaire/carte.js";
import { defautDe, ecrireOrigine } from "../js/adversaire/lecture.js";
import { NOM_BASE_RENCONTRE, chiffrerRencontre, dechiffrerRencontre, magasinRencontreMemoire } from "../js/adversaire/rencontre_gardee.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { MESSAGE_BANQUE_SANS_ADVERSAIRES, indexer } from "../js/banque/consultation.js";
import { importerFichier } from "../js/banque/importation.js";
import { lireRoute } from "../js/routes.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";
import { avecAdversaires, sansAdversaires } from "./outils/adversaires_essai.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const _ = null;
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", RACINE)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-10-11T10:00:00+02:00" };
// Une banque publiée avant le lot 3 : ni adversaires, ni types.
const { types_adversaires: _types, adversaires: _adversaires, ...AVANT_LOT_3 } = BANQUE;
// La clé de démonstration, dérivée du mot de passe public (§ 9) : la
// composition gardée se chiffre avec elle.
const { secret: SECRET_DEMO } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
// Les adversaires du classeur d'essai, dans l'ordre de la liste.
const NOMS = ["Chef de partie", "Homard furieux", "Marmiton de corvée", "Mouette chapardeuse", "Plongeur"];

const accueil = await import("../js/ecrans/accueil.js");
const anomalies = await import("../js/ecrans/anomalies.js");
const liste = await import("../js/ecrans/liste.js");
const rencontre = await import("../js/ecrans/rencontre.js");

// La rencontre et les panneaux des listes vivent dans la mémoire de leur
// module : chaque contrôle part d'une banque à lui, et d'une rencontre
// oubliée (dansLeDocument). Sans secret, la rencontre ne garde rien : les
// contrôles du lot 3 restent synchrones.
function contexteDe(banque = BANQUE, { secret = null, mode = "demo" } = {}) {
  const propre = { ...banque };
  return {
    etat: { mode, banque: propre, index: indexer(propre), secret, nouvelles: null, chargement: { enveloppe: null }, coffre: creerCoffre(magasinMemoire()), derivation: null, stockage: null },
    afficher() {},
    naviguer() {},
    recharger() {},
    oublier() {},
    dernierePublication: () => null,
    stockageMemorise: () => null,
  };
}

// Une feuille Adversaires fabriquée : le socle (types Commis et Rôtisseur,
// lignes 2 et 3 ; « Marmiton », ligne 4), puis les lignes données.
async function banqueAvec(lignes, options) {
  const { banque, erreur } = await importerFichier(fabriquerClasseur(avecAdversaires(lignes, options)), "essai.xlsx");
  assert.equal(erreur, undefined, erreur);
  return { ...banque, publiee_le: BANQUE.publiee_le };
}

// L'écran d'une adresse, choisi comme le fait js/application.js ; les
// services (le magasin de la rencontre gardée) pour l'écran Rencontre.
function ouvrir(contexte, adresse, services = {}) {
  const route = lireRoute(adresse);
  const ecran =
    route.ecran === "rencontre" ? rencontre.afficher(contexte, services) : route.ecran === "accueil" ? accueil.afficher(contexte) : route.ecran === "anomalies" ? anomalies.afficher(contexte, route) : liste.afficher(contexte, route);
  document.body.replaceChildren(ecran);
  return ecran;
}

async function dansLeDocument(faire) {
  const retirer = installerDom();
  rencontre.oublier();
  try {
    return await faire();
  } finally {
    retirer();
  }
}

// L'accueil calcule son diagnostic à part : le document ne se retire
// qu'une fois celui-ci posé.
async function ouvrirAccueil(contexte) {
  const ecran = ouvrir(contexte, "#/");
  for (let i = 0; i < 200 && !ecran.querySelector(".diagnostic"); i += 1) await laisserFiler(5);
  assert.ok(ecran.querySelector(".diagnostic"), "le diagnostic ne s'affiche pas");
  return ecran;
}

const textes = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)].map(texteDe);
const liens = (noeud, selecteur = "a") => [...noeud.querySelectorAll(selecteur)].map((a) => [texteDe(a), a.getAttribute("href")]);
const bouton = (noeud, texte) => {
  const trouves = boutons(noeud, texte);
  assert.equal(trouves.length, 1, `un bouton « ${texte} »`);
  return trouves[0];
};
// Les rubriques d'une vue lecture ou d'une fiche, par leur titre.
const rubrique = (noeud, intitule) => {
  const trouvees = [...noeud.querySelectorAll("section")].filter((s) => texteDe(s.querySelector("h2")) === intitule);
  assert.equal(trouvees.length, 1, `une rubrique « ${intitule} »`);
  return trouvees[0];
};
const paires = (noeud) => Object.fromEntries([...noeud.querySelectorAll("dt")].map((dt, i) => [texteDe(dt), texteDe(noeud.querySelectorAll("dd")[i])]));
const paragraphes = (noeud, selecteur = "li") => [...noeud.querySelectorAll(selecteur)].map((li) => textes(li, "p"));
const rangees = (noeud) => [...noeud.querySelectorAll("tbody tr")].map((tr) => tr.children.map(texteDe));
// Les entrées d'une liste de consultation : le nom, et son détail.
const entrees = (ecran) => [...ecran.querySelectorAll(".liste-entrees a")].map((a) => a.children.map(texteDe));
function saisir(champ, valeur) {
  champ.value = valeur;
  champ.declencher("input");
}
// Ce que dit une rubrique d'une fiche de type, hors son titre : ses paragraphes et ses lignes.
const contenu = (section) => section.children.filter((n) => n.tagName !== "H2").flatMap((n) => (n.tagName === "UL" ? n.children.map(texteDe) : n.tagName === "DL" ? n.children.map((d) => d.children.map(texteDe).join(" : ")) : [texteDe(n)]));
// La ligne d'un adversaire dans la rencontre : ses deux boutons, son nombre.
const ligneDe = (ecran, nom) => {
  const ligne = [...ecran.querySelectorAll(".ligne-rencontre")].find((li) => texteDe(li.querySelector("a")) === nom);
  assert.ok(ligne, `la ligne de ${nom}`);
  const [moins, plus] = ligne.querySelectorAll("button");
  return { ligne, moins, plus, valeur: () => texteDe(ligne.querySelector(".valeur-pas")) };
};
const cartesDe = (ecran) => textes(ecran, ".cadre-cartes .carte-nom");

// Les souvenirs de l'appareil, simulés : ce qui s'y lit et s'y écrit.
// `indexedDB` : une fabrique (tests/outils/indexeddb_simulee.js), dont les
// ouvertures sont comptées ; sans elle, un bouchon dont rien ne s'ouvre.
function simulerStockage(depart = {}, { indexedDB = null } = {}) {
  const journal = { lus: [], ecrits: [], ouvertures: 0 };
  const memoire = new Map(Object.entries(depart));
  const avant = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, indexedDB: globalThis.indexedDB };
  const magasin = {
    getItem: (cle) => (journal.lus.push(cle), memoire.get(cle) ?? null),
    setItem: (cle, valeur) => (journal.ecrits.push([cle, valeur]), memoire.set(cle, String(valeur))),
  };
  const base = { open: (...arguments_) => ((journal.ouvertures += 1), indexedDB ? indexedDB.open(...arguments_) : {}) };
  Object.assign(globalThis, { localStorage: magasin, sessionStorage: magasin, indexedDB: base });
  journal.retirer = () => {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete globalThis[nom];
      else globalThis[nom] = valeur;
    }
  };
  return journal;
}

// Attend qu'une condition tienne : la garde écrit au tour suivant, et la
// lecture arrive plus tard encore. Deux cents tours au plus.
async function attendreQue(condition, quoi) {
  for (let tour = 0; tour < 200; tour += 1) {
    if (await condition()) return;
    await laisserFiler(2);
  }
  assert.fail(`jamais : ${quoi}`);
}

// La composition gardée d'un magasin, déchiffrée avec la clé de démonstration.
const gardeeDans = async (magasin, mode = "demo") => (await dechiffrerRencontre(await magasin.lire(mode), SECRET_DEMO, { mode })).entrees;
const pareil = (une, autre) => JSON.stringify(une) === JSON.stringify(autre);

// ─── Les listes, la recherche, l'accueil ────────────────────────────────────

test("listes — cinq onglets ; les adversaires et leurs types dans l'ordre, avec leur détail ; la recherche instantanée", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    let ecran = ouvrir(contexte, "#/adversaires");
    assert.equal(texteDe(ecran.querySelector("h1")), "Adversaires");
    assert.equal(document.title, "Adversaires — L'Atelier des Arpenteurs");
    assert.deepEqual(liens(ecran, ".onglets a"), [["Blocs", "#/blocs"], ["Capacités", "#/capacites"], ["Éléments", "#/elements"], ["Adversaires", "#/adversaires"], ["Types", "#/types"]]);
    assert.deepEqual(textes(ecran, ".onglets a[aria-current=page]"), ["Adversaires"]);
    assert.equal(texteDe(ecran.querySelector("label")), "Rechercher parmi les adversaires");
    // Le détail : ses types tels qu'il les écrit, multiplicateur compris.
    assert.deepEqual(entrees(ecran), [
      ["Chef de partie", "Commis/Rôtisseur[1,4]"],
      ["Homard furieux", "sans type"],
      ["Marmiton de corvée", "Commis/Rôtisseur"],
      ["Mouette chapardeuse", "sans type"],
      ["Plongeur", "Commis / Rôtisseur"],
    ]);
    assert.deepEqual(liens(ecran, ".liste-entrees a").map(([, href]) => href).slice(0, 2), ["#/adversaire/Chef%20de%20partie", "#/adversaire/Homard%20furieux"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "5 adversaires");
    assert.match(texteDe(ecran.querySelector(".panneau-fiche")), /^Choisissez un adversaire dans la liste\.$/);
    // La recherche se fait à chaque lettre, sur ce que l'adversaire écrit.
    const recherche = ecran.querySelector("#recherche-adversaires");
    saisir(recherche, "COMMIS");
    assert.deepEqual(entrees(ecran).map(([nom]) => nom), ["Chef de partie", "Marmiton de corvée", "Plongeur"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "3 adversaires sur 5");
    saisir(recherche, "carapace");
    assert.deepEqual(entrees(ecran).map(([nom]) => nom), ["Homard furieux"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "1 adversaire sur 5");
    saisir(recherche, "nez fin");
    assert.deepEqual(entrees(ecran).map(([nom]) => nom), ["Mouette chapardeuse"]);
    // Ce qu'il porte une fois résolu se trouve aussi : la spatule est celle du Rôtisseur, la frappe vient des armes.
    assert.equal(recherche.getAttribute("placeholder"), "Nom, type, équipement ou capacité");
    saisir(recherche, "spatule");
    assert.deepEqual(entrees(ecran).map(([nom]) => nom), ["Chef de partie", "Marmiton de corvée"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "2 adversaires sur 5");
    saisir(recherche, "frappe");
    assert.deepEqual(entrees(ecran).map(([nom]) => nom), ["Chef de partie", "Homard furieux", "Marmiton de corvée", "Mouette chapardeuse"]);
    // La fiche ouverte, la liste garde sa recherche, et marque l'entrée.
    saisir(recherche, "o");
    ecran = ouvrir(contexte, "#/adversaire/Homard%20furieux");
    assert.equal(ecran.querySelector("#recherche-adversaires").value, "o");
    assert.deepEqual(textes(ecran, ".liste-entrees a[aria-current=page] span").slice(0, 1), ["Homard furieux"]);
    assert.deepEqual(liens(ecran, ".retour a"), [["Tous les adversaires", "#/adversaires"]]);

    // Les types : la catégorie « types » lit la liste « types_adversaires » de la banque.
    ecran = ouvrir(contexte, "#/types");
    assert.equal(texteDe(ecran.querySelector("h1")), "Types");
    assert.equal(texteDe(ecran.querySelector("label")), "Rechercher parmi les types d'adversaires");
    assert.deepEqual(entrees(ecran), [["Commis", "3 adversaires"], ["Rôtisseur", "3 adversaires"]]);
    assert.deepEqual(liens(ecran, ".liste-entrees a").map(([, href]) => href), ["#/type/Commis", "#/type/R%C3%B4tisseur"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "2 types d'adversaires");
    assert.match(texteDe(ecran.querySelector(".panneau-fiche")), /^Choisissez un type d'adversaire dans la liste\.$/);
    saisir(ecran.querySelector("#recherche-types"), "rot");
    assert.deepEqual(entrees(ecran), [["Rôtisseur", "3 adversaires"]]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "1 type d'adversaire sur 2");
    assert.deepEqual(liens(ouvrir(contexte, "#/type/Commis"), ".retour a"), [["Tous les types", "#/types"]]);
    // Les autres listes portent les deux onglets aussi.
    assert.deepEqual(textes(ouvrir(contexte, "#/blocs"), ".onglets a"), ["Blocs", "Capacités", "Éléments", "Adversaires", "Types"]);
  }));

test("accueil — les comptes des adversaires et de leurs types, à côté des autres", () =>
  dansLeDocument(async () => {
    const ecran = await ouvrirAccueil(contexteDe());
    const comptes = [...ecran.querySelectorAll(".comptes a")].map((a) => [a.getAttribute("href"), texteDe(a.querySelector(".nombre")), texteDe(a).replace(/^\d+/, "")]);
    assert.deepEqual(comptes, [
      ["#/blocs", String(BANQUE.blocs.length), "blocs"],
      ["#/capacites", String(BANQUE.capacites.length), "capacités"],
      ["#/elements", String(BANQUE.elements.length), "éléments"],
      ["#/adversaires", "5", "adversaires"],
      ["#/types", "2", "types d'adversaires"],
    ]);
    assert.doesNotMatch(texteDe(ecran), /republiée/);
    // Un seul de chaque : le singulier.
    const seul = await ouvrirAccueil(contexteDe({ ...BANQUE, adversaires: BANQUE.adversaires.slice(0, 1), types_adversaires: BANQUE.types_adversaires.slice(0, 1) }));
    assert.deepEqual(textes(seul, ".comptes a").slice(3), ["1adversaire", "1type d'adversaire"]);
  }));

test("banque publiée avant le lot 3 — aucun écran ne tombe, les adversaires disent la phrase, le reste se consulte", () =>
  dansLeDocument(async () => {
    const contexte = contexteDe(AVANT_LOT_3);
    // L'accueil : trois comptes, et la phrase à la place des deux autres.
    const premier = await ouvrirAccueil(contexte);
    assert.deepEqual(liens(premier, ".comptes a").map(([, href]) => href), ["#/blocs", "#/capacites", "#/elements"]);
    assert.ok(textes(premier, "p").includes(MESSAGE_BANQUE_SANS_ADVERSAIRES));
    // Les deux listes : la phrase, une liste vide, et rien à choisir.
    for (const [adresse, compte, rien] of [["#/adversaires", "0 adversaire", "Cette banque n'a aucun adversaire."], ["#/types", "0 type d'adversaire", "Cette banque n'a aucun type d'adversaire."]]) {
      const ecran = ouvrir(contexte, adresse);
      assert.deepEqual(textes(ecran, ".panneau-liste .message"), [MESSAGE_BANQUE_SANS_ADVERSAIRES], adresse);
      assert.equal(texteDe(ecran.querySelector("[role=status]")), compte);
      assert.equal(entrees(ecran).length, 0);
      assert.equal(texteDe(ecran.querySelector(".panneau-fiche")), rien);
      saisir(ecran.querySelector("input"), "chef");
      assert.equal(texteDe(ecran.querySelector("[role=status]")), `${compte} sur 0`);
    }
    // Une fiche demandée par son adresse : introuvable, et la phrase du côté que montre un téléphone.
    for (const adresse of ["#/adversaire/Chef%20de%20partie", "#/type/Commis"]) {
      const ecran = ouvrir(contexte, adresse);
      assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Fiche introuvable", adresse);
      assert.deepEqual(textes(ecran, ".panneau-fiche .message").slice(0, 1), [MESSAGE_BANQUE_SANS_ADVERSAIRES]);
      assert.equal(ecran.querySelectorAll(".panneau-liste .message").length, 0, "la phrase ne se dit qu'une fois");
    }
    // La rencontre : la phrase, ni liste ni bouton.
    const sans = ouvrir(contexte, "#/rencontre");
    assert.equal(texteDe(sans.querySelector("h1")), "Rencontre");
    assert.deepEqual(textes(sans, ".message"), [MESSAGE_BANQUE_SANS_ADVERSAIRES]);
    assert.equal(sans.querySelectorAll("button").length, 0);
    // Le reste se consulte comme avant.
    const blocs = ouvrir(contexte, "#/blocs");
    assert.equal(entrees(blocs).length, new Set(BANQUE.blocs.map((b) => b.nom)).size);
    assert.equal(blocs.querySelectorAll(".message").length, 0);
    assert.equal(texteDe(ouvrir(contexte, "#/bloc/Spatule%20souple").querySelector(".panneau-fiche h1")), "Spatule souple");
    assert.equal(texteDe(ouvrir(contexte, "#/anomalies/Adversaires/3").querySelector("h1")), "Anomalies");
  }));

test("banque sans feuille Adversaires (I4) — deux listes vides, sans la phrase de la banque à republier", async () => {
  const { banque } = await importerFichier(fabriquerClasseur(sansAdversaires()), "essai.xlsx");
  await dansLeDocument(async () => {
    const contexte = contexteDe({ ...banque, publiee_le: BANQUE.publiee_le });
    assert.deepEqual([banque.adversaires, banque.types_adversaires], [[], []]);
    const premier = await ouvrirAccueil(contexte);
    assert.deepEqual(textes(premier, ".comptes a").slice(3), ["0adversaire", "0type d'adversaire"]);
    assert.doesNotMatch(texteDe(premier), /republiée/);
    for (const adresse of ["#/adversaires", "#/types", "#/rencontre"]) assert.doesNotMatch(texteDe(ouvrir(contexte, adresse)), /republiée/, adresse);
    assert.equal(texteDe(ouvrir(contexte, "#/adversaires").querySelector(".panneau-fiche")), "Cette banque n'a aucun adversaire.");
    assert.deepEqual(textes(ouvrir(contexte, "#/rencontre"), ".message"), ["Cette banque n'a aucun adversaire."]);
  });
});

test("banque abîmée — ce qui n'est pas une entrée n'entre dans aucune liste ; une ligne sans cellules, ou aux cellules d'un autre genre, s'ouvre quand même", () =>
  dansLeDocument(() => {
    const adversaires = [
      null,
      3,
      "x",
      { nom: 7 },
      { nom: "Sans rien" },
      { nom: "Drôle", types: 12, localisation: null, actions: {}, equipement: ["x"], capacites: {}, brut: null },
      // Des cellules et un numéro de ligne qui ne sont pas des textes : rien de technique ne s'affiche.
      { nom: "Forgé", types: { toString: 1 }, equipement: true, capacites: { a: 1 }, brut: { ligne: {} } },
      { nom: "Forgé bis", types: ["Commis"], brut: { ligne: 1e400 } },
      ...BANQUE.adversaires,
    ];
    const types = [undefined, { nom: "Vide" }, { nom: "Tordu", localisation: 5, actions: [], equipement: 3, capacites: true, brut: "x" }, ...BANQUE.types_adversaires];
    const contexte = contexteDe({ ...BANQUE, adversaires, types_adversaires: types });
    const liste = ouvrir(contexte, "#/adversaires");
    assert.deepEqual(entrees(liste).map(([nom]) => nom), ["Chef de partie", "Drôle", "Forgé", "Forgé bis", "Homard furieux", "Marmiton de corvée", "Mouette chapardeuse", "Plongeur", "Sans rien"]);
    // Une cellule Type qui n'est pas un texte vaut une cellule vide, dans la liste comme sur la fiche.
    assert.deepEqual(Object.fromEntries(entrees(liste).filter(([nom]) => /^(?:Forgé|Drôle)/.test(nom))), { "Drôle": "12", "Forgé": "sans type", "Forgé bis": "sans type" });
    // La recherche ne lève rien sur ces cellules, et n'y trouve pas de texte technique.
    saisir(liste.querySelector("#recherche-adversaires"), "object");
    assert.deepEqual(entrees(liste), []);
    saisir(liste.querySelector("#recherche-adversaires"), "forge");
    assert.deepEqual(entrees(liste).map(([nom]) => nom), ["Forgé", "Forgé bis"]);
    saisir(liste.querySelector("#recherche-adversaires"), "");
    for (const nom of ["Forgé", "Forgé bis"]) {
      const lu = ouvrir(contexte, `#/adversaire/${encodeURIComponent(nom)}`).querySelector(".lecture");
      assert.equal(texteDe(lu.children.at(-1)), "Feuille Adversaires.", "un numéro de ligne qui n'en est pas un ne s'écrit pas");
      assert.doesNotMatch(texteDe(lu), /object|Infinity|true|undefined|NaN/);
    }
    assert.deepEqual(entrees(ouvrir(contexte, "#/types")).map(([nom]) => nom), ["Commis", "Rôtisseur", "Tordu", "Vide"]);
    for (const nom of ["Sans rien", "Drôle"]) {
      const racine = ouvrir(contexte, `#/adversaire/${encodeURIComponent(nom)}`).querySelector(".ecran-adversaire");
      assert.equal(texteDe(racine.querySelector("h1")), nom);
      assert.equal(racine.querySelectorAll(".cadre-cartes .carte-adversaire").length, 1, nom);
      // Sans ligne connue, le lien d'un renvoi cassé mène au rapport entier.
      assert.equal(texteDe(racine.querySelector(".lecture").children.at(-1)), "Feuille Adversaires.");
    }
    assert.deepEqual(liens(ouvrir(contexte, "#/adversaire/Dr%C3%B4le"), ".lecture section a"), [["introuvable, voir l'anomalie", "#/anomalies"]]);
    for (const nom of ["Vide", "Tordu"]) assert.equal(texteDe(ouvrir(contexte, `#/type/${nom}`).querySelector(".panneau-fiche h1")), nom);
    const choix = ouvrir(contexte, "#/rencontre");
    assert.deepEqual(textes(choix, ".nom-rencontre .detail").slice(1, 4), ["12", "sans type", "sans type"]);
    saisir(choix.querySelector("#recherche-rencontre"), "object");
    assert.deepEqual(textes(choix, ".nom-rencontre a"), []);
    saisir(choix.querySelector("#recherche-rencontre"), "");
    ligneDe(choix, "Drôle").plus.click();
    assert.deepEqual(textes(choix, ".cadre-cartes .carte-nom"), ["Drôle"]);
    assert.match(textes(choix, ".message")[0], /^À vérifier avant d'imprimer : Drôle \(incomplet, 1 erreur\)\./);
  }));

// ─── La fiche d'un adversaire ───────────────────────────────────────────────

test("fiche d'un adversaire — deux vues, le choix gardé sur l'appareil sous sa propre clé ; la carte toujours dans la page, et elle seule à l'impression", () =>
  dansLeDocument(() => {
    const stockage = simulerStockage({ "atelier.vue-personnage": "fiche" });
    try {
      const contexte = contexteDe();
      let ecran = ouvrir(contexte, "#/adversaire/Chef%20de%20partie");
      assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Chef de partie");
      assert.equal(document.title, "Chef de partie — L'Atelier des Arpenteurs");
      let racine = ecran.querySelector(".ecran-adversaire");
      // Sans souvenir ni grand écran : la vue lecture. Le choix des personnages ne compte pas.
      assert.equal(racine.className, "ecran-adversaire vue-lecture");
      assert.deepEqual(stockage.lus, ["atelier.vue-adversaire"]);
      assert.deepEqual([...racine.querySelectorAll("button")].map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [
        ["Vue lecture", "true"],
        ["Vue carte", "false"],
        ["Ajouter à la rencontre", null],
        ["Imprimer / PDF", null],
      ]);
      // Les deux boutons de vue ont leur rangée : un grand écran, qui montre tout, la masque.
      assert.deepEqual(textes(racine.querySelector(".choix-vue"), "button"), ["Vue lecture", "Vue carte"]);
      assert.deepEqual(liens(racine, ".lien-retour a"), [["Voir la rencontre", "#/rencontre"], ["Types d'adversaires", "#/types"]]);
      // En vue lecture aussi, la carte est là : c'est elle qui s'imprime, sans numéro.
      const carteDe = (noeud) => noeud.querySelectorAll(".cadre-cartes .cartes-adversaires .carte-adversaire");
      assert.equal(carteDe(racine).length, 1);
      assert.equal(texteDe(racine.querySelector(".carte-nom")), "Chef de partie");
      assert.equal(racine.querySelectorAll(".carte-numero").length, 0);
      assert.deepEqual([".carte-actions", ".carte-souffle", ".carte-attaque", ".carte-defense"].map((c) => texteDe(racine.querySelector(`${c} .carte-valeur`))), ["1", "7", "5", "7"]);
      assert.equal(racine.querySelectorAll(".lectures-adversaire .lecture").length, 1);
      // Tout ce qui n'est pas la carte reste à l'écran.
      assert.deepEqual(racine.children.map((n) => n.className), ["ne-pas-imprimer", "lectures-adversaire ne-pas-imprimer", "cadre-cartes"]);
      assert.equal(ecran.querySelector(".panneau-liste").className, "panneau-liste ne-pas-imprimer");
      assert.equal(ecran.querySelector(".retour").className, "retour ne-pas-imprimer");
      assert.equal(racine.querySelectorAll(".cadre-cartes .provenance").length, 0, "la carte ne dit pas d'où vient une valeur");
      // « Vue carte » : la classe de la racine, les boutons, et le souvenir.
      bouton(racine, "Vue carte").click();
      assert.equal(racine.className, "ecran-adversaire vue-carte");
      assert.deepEqual([bouton(racine, "Vue lecture").getAttribute("aria-pressed"), bouton(racine, "Vue carte").getAttribute("aria-pressed")], ["false", "true"]);
      assert.deepEqual(stockage.ecrits, [["atelier.vue-adversaire", "carte"]]);
      assert.equal(carteDe(racine).length, 1);
      // Un autre adversaire s'ouvre dans la vue choisie.
      ecran = ouvrir(contexte, "#/adversaire/Plongeur");
      racine = ecran.querySelector(".ecran-adversaire");
      assert.equal(racine.className, "ecran-adversaire vue-carte");
      bouton(racine, "Vue lecture").click();
      assert.equal(racine.className, "ecran-adversaire vue-lecture");
      assert.deepEqual(stockage.ecrits.at(-1), ["atelier.vue-adversaire", "lecture"]);
    } finally {
      stockage.retirer();
    }
    // Sans souvenir : la vue lecture, même sur un grand écran, qui montre de toute façon la carte et la lecture
    // (ecran.css) ; la largeur de l'écran ne se demande plus. Un stockage refusé ne casse rien.
    const avant = { matchMedia: globalThis.matchMedia, localStorage: globalThis.localStorage, requestAnimationFrame: globalThis.requestAnimationFrame };
    try {
      const demandes = [];
      globalThis.matchMedia = (condition) => (demandes.push(condition), { matches: true });
      assert.equal(ouvrir(contexteDe(), "#/adversaire/Plongeur").querySelector(".ecran-adversaire").className, "ecran-adversaire vue-lecture");
      assert.deepEqual(demandes, []);
      globalThis.localStorage = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
      const racine = ouvrir(contexteDe(), "#/adversaire/Plongeur").querySelector(".ecran-adversaire");
      assert.equal(racine.className, "ecran-adversaire vue-lecture");
      // « Vue carte » amène la carte à l'écran, sans défiler si elle y est déjà : sur un téléphone elle est sous le pli.
      // « Vue lecture » ne déplace rien.
      globalThis.requestAnimationFrame = (f) => f();
      const amenees = [];
      racine.querySelector(".cadre-cartes").scrollIntoView = (options) => amenees.push(options);
      bouton(racine, "Vue carte").click();
      assert.equal(racine.className, "ecran-adversaire vue-carte");
      assert.deepEqual(amenees, [{ block: "nearest" }]);
      bouton(racine, "Vue lecture").click();
      assert.deepEqual(amenees.length, 1);
      bouton(racine, "Vue carte").click();
      // Une valeur gardée qui n'est pas une vue ne passe pas dans la classe.
      globalThis.localStorage = { getItem: () => "carte vue-pirate", setItem() {} };
      assert.equal(ouvrir(contexteDe(), "#/adversaire/Plongeur").querySelector(".ecran-adversaire").className, "ecran-adversaire vue-lecture");
    } finally {
      for (const [nom, valeur] of Object.entries(avant)) {
        if (valeur === undefined) delete globalThis[nom];
        else globalThis[nom] = valeur;
      }
    }
  }));

test("provenance — « de Saucier ×2 », « de Commis », « de sa ligne », « de Spatule souple » ; l'élision devant une voyelle", () => {
  assert.equal(ecrireOrigine({ type: "Saucier", multiplie: true }, "2"), "de Saucier ×2");
  assert.equal(ecrireOrigine({ type: "Rôtisseur", multiplie: true }, "1,4"), "de Rôtisseur ×1,4");
  // Ce que le multiplicateur ne touche pas ne le porte pas.
  assert.equal(ecrireOrigine({ type: "Commis", multiplie: false }, "1,4"), "de Commis");
  assert.equal(ecrireOrigine({ type: "Commis", multiplie: true }, null), "de Commis");
  assert.equal(ecrireOrigine({ type: null, multiplie: false }, "2"), "de sa ligne");
  assert.equal(ecrireOrigine({ objet: "Spatule souple" }, "2"), "de Spatule souple");
  assert.equal(ecrireOrigine({ objet: "Écaille" }), "d'Écaille");
  assert.equal(ecrireOrigine({ type: "Écumeur", multiplie: true }, "2"), "d'Écumeur ×2");
  assert.equal(ecrireOrigine({ type: "Hachoir", multiplie: false }), "de Hachoir", "un h reste entier");
  assert.equal(ecrireOrigine(null, "2"), "");
  // Ce qui rend un adversaire incertain : incomplet, ou des erreurs ; un avertissement n'en est pas une.
  const resolu = (complet, codes) => ({ complet, constats: codes.map((code) => ({ code, ligne: 2, message: "x" })) });
  assert.equal(defautDe(resolu(true, [])), null);
  assert.equal(defautDe(resolu(true, ["A11", "A15", null])), null);
  assert.equal(defautDe(resolu(false, ["E15"])), "incomplet, 1 erreur");
  assert.equal(defautDe(resolu(true, ["E12", "E14", "A1"])), "2 erreurs");
  assert.equal(defautDe(resolu(false, [])), "incomplet");
  assert.equal(defautDe(resolu(true, ["constructor", "E99"])), null, "un code inconnu n'est pas une erreur");
});

test("fiche d'un adversaire — chaque valeur dit d'où elle vient : le Chef de partie, deux types sous un multiplicateur décimal", () =>
  dansLeDocument(() => {
    const lu = ouvrir(contexteDe(), "#/adversaire/Chef%20de%20partie").querySelector(".lecture");
    // Les types, en liens, et le multiplicateur.
    const types = rubrique(lu, "Types");
    assert.deepEqual(liens(types), [["Commis", "#/type/Commis"], ["Rôtisseur", "#/type/R%C3%B4tisseur"]]);
    assert.deepEqual(textes(types, "p"), ["Appliqués dans cet ordre : pour chaque valeur, le suivant l'emporte.", "Multiplicateur ×1,4 de sa ligne : il multiplie ce qui vient des types, les nombres et la qualité de l'équipement"]);
    // Les nombres : chacun du dernier type qui le donne, multiplié.
    assert.deepEqual(paires(rubrique(lu, "Valeurs")), {
      "Nombre d'actions": "1 de Commis ×1,4",
      Souffle: "7 de Rôtisseur ×1,4",
      Attaque: "5 de Rôtisseur ×1,4",
      Défense: "7 de Rôtisseur ×1,4",
      Corps: "10 valeur fixe",
      Résistance: "5 par zone valeur fixe",
    });
    // La grille vient du type, sans multiplicateur ; l'armure de chaque zone, de ses pièces.
    const localisation = rubrique(lu, "Localisation");
    assert.deepEqual(textes(localisation, "p"), ["Grille de Commis"]);
    assert.deepEqual(textes(localisation, "thead th"), ["Zone", "d20", "Armure", "Résistance"]);
    assert.deepEqual(rangees(localisation), [
      ["Contre-attaque", "1", "—", "—"],
      ["Torse", "2-11", "38 Tablier de cuir [2,8]", "5"],
      ["Jambe gauche", "12-13", "0 aucune pièce", "5"],
      ["Jambre droite lue « Jambe droite »", "14-15", "0 aucune pièce", "5"],
      ["Bras gauche", "16-17", "19 Maniques [2,8]", "5"],
      ["Bras droit", "18-19", "19 Maniques [2,8]", "5"],
      ["Tête", "20", "6 Toque renforcée [2,8]", "5"],
    ]);
    // Les faces d'une zone ont leur classe : « 12-13 » ne se coupe pas en deux lignes sur un téléphone (ecran.css).
    assert.deepEqual(textes(localisation, ".lecture-faces"), ["2-11", "12-13", "14-15", "16-17", "18-19", "20"]);
    // La maîtrise : citée par un type, puis par sa ligne, dont le rang compte, et c'est dit.
    assert.deepEqual(paragraphes(rubrique(lu, "Maîtrises")), [["Maîtrise de l'agile rang 3, de sa ligne", "de Rôtisseur, de sa ligne"]]);
    assert.deepEqual(liens(rubrique(lu, "Maîtrises")), [["Maîtrise de l'agile", "#/capacite/Ma%C3%AEtrise%20de%20l'agile"]]);
    // L'équipement hérité : sa qualité est multipliée, 2 par défaut comprise.
    const equipement = rubrique(lu, "Équipement");
    assert.deepEqual(paragraphes(equipement), [
      ["Spatule souple qualité 2,8", "de Rôtisseur ×1,4"],
      ["Armure agile qualité 2,8 · 3 pièces", "Pièces : Tablier de cuir, Maniques, Toque renforcée", "de Rôtisseur ×1,4"],
    ]);
    assert.deepEqual(liens(equipement), [
      ["Spatule souple", "#/bloc/Spatule%20souple"],
      ["Tablier de cuir", "#/bloc/Tablier%20de%20cuir"],
      ["Maniques", "#/bloc/Maniques"],
      ["Toque renforcée", "#/bloc/Toque%20renforc%C3%A9e"],
    ]);
    // Les capacités : le rang, le coût à ce rang, les dégâts et leur arme, la description, l'origine.
    const capacites = rubrique(lu, "Capacités");
    assert.deepEqual(paragraphes(capacites), [
      ["Frappe n'évolue pas · sans coût", "Dégâts 6/12/19 de Spatule souple", "Une attaque qui inflige 6/12/19.", "de Spatule souple"],
      ["Moulinet farineux rang 1 · 5 souffle", "Dégâts 6/12/19 de Spatule souple", "Tourbillonne 1 fois.", "de Spatule souple"],
      // Une seule origine : le rang ne la répète pas. Deux : il dit de laquelle il vient.
      ["Pas chassé rang 2, de sa ligne · 1 souffle", "Se déplace de 2 cases.", "de Commis, de sa ligne"],
    ]);
    assert.deepEqual(liens(capacites), [["Frappe", "#/capacite/Frappe"], ["Moulinet farineux", "#/capacite/Moulinet%20farineux"], ["Pas chassé", "#/capacite/Pas%20chass%C3%A9"]]);
    assert.doesNotMatch(texteDe(capacites), /Désavantage|Maîtrise/, "ni désavantage, ni maîtrise parmi les capacités");
    // Les constats de ses types, chacun à sa ligne.
    const constats = rubrique(lu, "À vérifier");
    assert.deepEqual(textes(constats, "li"), [
      "A11 · avertissement — Le type « Commis » : la zone « Jambre droite » est reconnue par approximation comme « Jambe droite ». (Adversaires, ligne 2)",
      "A1 · avertissement — Le type « Rôtisseur » cite « Maitrise de l'agile » pour la capacité « Maîtrise de l'agile » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent. (Adversaires, ligne 3)",
    ]);
    assert.deepEqual(liens(constats), [["Adversaires, ligne 2", "#/anomalies/Adversaires/2"], ["Adversaires, ligne 3", "#/anomalies/Adversaires/3"]]);
    // Sa propre ligne n'a pas d'anomalie : elle se dit, sans lien.
    assert.equal(texteDe(lu.children.at(-1)), "Feuille Adversaires, ligne 5.");
    assert.equal(lu.children.at(-1).querySelectorAll("a").length, 0);
    // Toute provenance est marquée comme telle : deux pour les types, six valeurs, la grille, ses six
    // zones et la zone approchée, une maîtrise, deux objets, cinq pour les capacités.
    assert.equal(lu.querySelectorAll(".provenance").length, 2 + 6 + 1 + 6 + 1 + 1 + 2 + 5);
  }));

test("fiche d'un adversaire — le Homard furieux : sa ligne, sa grille, l'armure globale et une pièce, deux armes, le désavantage d'une seule", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    const lu = ouvrir(contexte, "#/adversaire/Homard%20furieux").querySelector(".lecture");
    assert.deepEqual(textes(rubrique(lu, "Types"), "p"), ["Aucun type : tout vient de sa ligne."]);
    assert.deepEqual(paires(rubrique(lu, "Valeurs")), {
      "Nombre d'actions": "2 de sa ligne",
      Souffle: "4 de sa ligne",
      Attaque: "6 de sa ligne",
      Défense: "7 de sa ligne",
      Corps: "10 valeur fixe",
      Résistance: "5 par zone valeur fixe",
    });
    assert.deepEqual(textes(rubrique(lu, "Localisation"), "p"), ["Grille de sa ligne"]);
    assert.deepEqual(rangees(rubrique(lu, "Localisation")), [
      ["Contre-attaque", "1", "—", "—"],
      ["Corps", "2-11", "30 Carapace épaisse [2]", "5"],
      ["Pince gauche", "12-14", "30 Carapace épaisse [2]", "5"],
      ["Pince droite", "15-17", "30 Carapace épaisse [2]", "5"],
      ["Tête", "18-20", "36 Carapace épaisse [2] + Toque renforcée [3]", "5"],
    ]);
    assert.equal(lu.querySelectorAll("section").length, 5, "ni maîtrise, ni constat : pas de rubrique vide");
    assert.deepEqual(paragraphes(rubrique(lu, "Équipement")), [
      ["Carapace épaisse qualité 2", "de sa ligne"],
      ["Toque renforcée qualité 3", "de sa ligne"],
      ["Pinces de homard qualité 2", "de sa ligne"],
      ["Couteau d'office qualité 2", "de sa ligne"],
    ]);
    // Une capacité donnée par deux armes : chacune ses dégâts, le désavantage de la seule qui le donne.
    assert.deepEqual(paragraphes(rubrique(lu, "Capacités")), [
      [
        "Frappe n'évolue pas · sans coût",
        "Dégâts 4/8/12 de Pinces de homard",
        "Dégâts 3/8/20, portée 1 de Couteau d'office",
        "Désavantage de Couteau d'office seulement",
        "Pinces de homard : Une attaque qui inflige 4/8/12.",
        "Couteau d'office : Une attaque qui inflige 3/8/20.",
        "de Pinces de homard, de Couteau d'office",
      ],
      ["Choc sourd n'évolue pas · 2 souffle", "Dégâts 4/8/12 de Pinces de homard", "La cible perd autant d'attaque que vos réussites.", "de Pinces de homard"],
      ["Émincer n'évolue pas · 4 souffle", "Dégâts 3/8/20, portée 1 de Couteau d'office", "Désavantage de Couteau d'office", "Une réussite de plus si vous en avez une.", "de Couteau d'office"],
    ]);
    // Le Marmiton, sans la maîtrise au rang voulu : le désavantage, de sa spatule.
    const marmiton = ouvrir(contexte, "#/adversaire/Marmiton%20de%20corv%C3%A9e").querySelector(".lecture");
    assert.deepEqual(paires(rubrique(marmiton, "Valeurs"))["Nombre d'actions"], "1 de Commis");
    // Une seule origine : elle se lit sous la capacité, et le rang ne la répète pas.
    assert.deepEqual(paragraphes(rubrique(marmiton, "Capacités"))[2], ["Pas chassé rang 1 · sans coût", "Se déplace de 1 cases.", "de Commis"]);
    assert.deepEqual(paragraphes(rubrique(marmiton, "Maîtrises")), [["Maîtrise de l'agile rang 1", "de Rôtisseur"]]);
    assert.deepEqual(paragraphes(rubrique(marmiton, "Capacités"))[1], ["Moulinet farineux rang 1 · 5 souffle", "Dégâts 5/10/15 de Spatule souple", "Désavantage de Spatule souple", "Tourbillonne 1 fois.", "de Spatule souple"]);
    // « aucun » : un souffle nul, écrit dans sa ligne ; aucun objet, et c'est sa ligne qui retire ceux du Rôtisseur.
    const plongeur = ouvrir(contexte, "#/adversaire/Plongeur").querySelector(".lecture");
    assert.equal(paires(rubrique(plongeur, "Valeurs")).Souffle, "0 de sa ligne");
    assert.deepEqual(textes(rubrique(plongeur, "Équipement"), "p"), ["Aucun objet de sa ligne, qui n'en garde aucun"]);
    assert.deepEqual(textes(rubrique(plongeur, "Équipement"), ".provenance"), ["de sa ligne, qui n'en garde aucun"]);
    // Un souffle que rien ne donne ; aucun objet, que personne ne retire ; un constat de sa propre ligne, et le lien vers ses anomalies.
    const mouette = ouvrir(contexte, "#/adversaire/Mouette%20chapardeuse").querySelector(".lecture");
    assert.equal(paires(rubrique(mouette, "Valeurs")).Souffle, "— rien ne le donne");
    assert.deepEqual(textes(rubrique(mouette, "Équipement"), "p"), ["Aucun objet."]);
    assert.deepEqual(liens(rubrique(mouette, "À vérifier")), [["Adversaires, ligne 8", "#/anomalies/Adversaires/8"]]);
    assert.deepEqual(liens(mouette.children.at(-1)), [["1 anomalie sur cette ligne (Adversaires, ligne 8)", "#/anomalies/Adversaires/8"]]);
  }));

test("fiche d'un adversaire — un type, un objet, une capacité introuvables s'affichent barrés, avec l'anomalie de la ligne qui les cite ; un adversaire en erreur s'affiche quand même", async () => {
  const banque = await banqueAvec([
    ["Type", "Saucier", _, _, _, _, _, "Fourchette magique", "Coup de pied retourné"],
    ["Cassé", "Commis/Spectre", _, _, _, _, _, "Louche fantôme", "//, Saut périlleux"],
    ["Second", "Commis/Saucier"],
    ["Nu"],
    ["Poêlier", "Commis", _, _, _, _, _, "Poêle en fonte"],
  ]);
  await dansLeDocument(() => {
    const contexte = contexteDe(banque);
    const casses = (noeud) => [...noeud.querySelectorAll(".renvoi-casse")].map((s) => [s.tagName, texteDe(s), liens(s.parentNode)]);
    const vers = (ligne, feuille = "Adversaires") => [["introuvable, voir l'anomalie", `#/anomalies/${feuille}/${ligne}`]];
    // Cité dans sa propre ligne, 6 : c'est là que l'anomalie se corrige.
    let racine = ouvrir(contexte, "#/adversaire/Cass%C3%A9").querySelector(".ecran-adversaire");
    assert.deepEqual(casses(rubrique(racine, "Types")), [["S", "Spectre", vers(6)]]);
    assert.deepEqual(liens(rubrique(racine, "Types")).slice(0, 1), [["Commis", "#/type/Commis"]]);
    assert.deepEqual(casses(rubrique(racine, "Équipement")), [["S", "Louche fantôme", vers(6)]]);
    assert.deepEqual(casses(rubrique(racine, "Capacités")), [["S", "Saut périlleux", vers(6)]]);
    assert.deepEqual(paragraphes(rubrique(racine, "Capacités")).at(-1), ["Saut périlleux (introuvable, voir l'anomalie) absente de la feuille Capacites", "de sa ligne"]);
    assert.deepEqual(textes(racine, ".ne-pas-imprimer .message"), ["À vérifier : incomplet, 3 erreurs. Il s'affiche et s'imprime tel qu'il se résout."]);
    assert.deepEqual(textes(rubrique(racine, "À vérifier"), ".code"), ["E8", "E11", "E13"]);
    assert.match(textes(rubrique(racine, "À vérifier"), "li")[0], /^E8 · erreur — L'adversaire « Cassé » cite le type « Spectre », introuvable/);
    // Il se résout quand même, et sa carte est là.
    assert.equal(texteDe(racine.querySelector(".carte-nom")), "Cassé");
    assert.match(texteDe(racine.querySelector(".carte-resume")), /Louche fantôme \(introuvable\)/);
    // Hérité d'un type : l'anomalie est à la ligne du type, 5.
    racine = ouvrir(contexte, "#/adversaire/Second").querySelector(".ecran-adversaire");
    assert.deepEqual(casses(rubrique(racine, "Équipement")), [["S", "Fourchette magique", vers(5)]]);
    assert.deepEqual(paragraphes(rubrique(racine, "Équipement")), [["Fourchette magique (introuvable, voir l'anomalie)", "de Saucier"]]);
    assert.deepEqual(casses(rubrique(racine, "Capacités")), [["S", "Coup de pied retourné", vers(5)]]);
    assert.deepEqual(liens(rubrique(racine, "À vérifier")), [["Adversaires, ligne 5", "#/anomalies/Adversaires/5"], ["Adversaires, ligne 5", "#/anomalies/Adversaires/5"]]);
    // Donnée par un bloc qui cite une capacité absente : l'anomalie est dans la feuille Blocs.
    racine = ouvrir(contexte, "#/adversaire/Po%C3%AAlier").querySelector(".ecran-adversaire");
    const ligneDuBloc = banque.blocs.find((b) => b.nom === "Poêle en fonte").brut.ligne;
    assert.deepEqual(casses(rubrique(racine, "Capacités")), [["S", "Omelette fantôme", vers(ligneDuBloc, "Blocs")]]);
    assert.deepEqual(paragraphes(rubrique(racine, "Capacités"))[1], ["Omelette fantôme (introuvable, voir l'anomalie) absente de la feuille Capacites", "de Poêle en fonte"]);
    // Un constat sans code n'est pas dans le rapport publié : il se dit, sans lien.
    const sansCode = [...rubrique(racine, "À vérifier").querySelectorAll("li")].filter((li) => li.querySelectorAll(".code").length === 0);
    assert.equal(sansCode.length, 1);
    assert.equal(sansCode[0].querySelectorAll("a").length, 0);
    // Rien du tout : incomplet, mais affiché, et imprimable.
    racine = ouvrir(contexte, "#/adversaire/Nu").querySelector(".ecran-adversaire");
    assert.deepEqual(textes(racine, ".ne-pas-imprimer .message"), ["À vérifier : incomplet, 1 erreur. Il s'affiche et s'imprime tel qu'il se résout."]);
    assert.deepEqual(Object.values(paires(rubrique(racine, "Valeurs"))).slice(0, 4), Array(4).fill("— rien ne le donne"));
    assert.deepEqual(textes(rubrique(racine, "Localisation"), "p"), ["Aucune localisation : ni ses types, ni sa ligne ne la donnent."]);
    assert.deepEqual(textes(rubrique(racine, "Capacités"), "p"), ["Aucune capacité."]);
    assert.equal(racine.querySelectorAll(".cadre-cartes .carte-adversaire").length, 1);
    assert.equal(racine.querySelectorAll(".carte-zone").length, 0);
  });
});

test("fiche d'un adversaire — un nombre illisible, une grille invalide : la valeur manque, son origine reste", async () => {
  const banque = await banqueAvec([
    ["Type", "Mitron", "Torse(2), Tête(21)", "beaucoup", 3, 4, 5],
    ["Apprenti", "Mitron"],
  ]);
  await dansLeDocument(() => {
    const lu = ouvrir(contexteDe(banque), "#/adversaire/Apprenti").querySelector(".lecture");
    assert.equal(paires(rubrique(lu, "Valeurs"))["Nombre d'actions"], "illisible de Mitron");
    assert.equal(paires(rubrique(lu, "Valeurs")).Souffle, "3 de Mitron");
    assert.deepEqual(textes(rubrique(lu, "Localisation"), "p"), ["Grille de Mitron", "Cette grille ne se lit pas : aucune zone n'est posée."]);
    assert.equal(lu.querySelectorAll("table").length, 0);
    assert.deepEqual(textes(rubrique(lu, "À vérifier"), ".code"), ["E10", "E14"]);
  });
});

test("fiche d'un adversaire — deux adversaires de même nom (E16) se suivent ; un nom introuvable n'est jamais le titre ; un nom en HTML reste du texte", async () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const banque = await banqueAvec([["Marmiton", "Commis[2]"], [hostile, "Commis"]]);
  await dansLeDocument(() => {
    const contexte = contexteDe(banque);
    let ecran = ouvrir(contexte, "#/adversaire/Marmiton");
    let racine = ecran.querySelector(".ecran-adversaire");
    assert.deepEqual(textes(racine, ".ne-pas-imprimer .message"), ["Ce nom désigne 2 adversaires : c'est un doublon (E16), ils se suivent ci-dessous. Une rencontre prend le premier."]);
    assert.equal(racine.querySelectorAll("h1").length, 1);
    assert.deepEqual(racine.querySelector(".lectures-adversaire").children.map((n) => (n.tagName === "H2" ? texteDe(n) : n.className)), ["Ligne 4", "lecture", "Ligne 5", "lecture"]);
    // Chacun résolu pour lui-même : le second porte le multiplicateur.
    assert.deepEqual([...racine.querySelectorAll(".lecture")].map((lu) => paires(rubrique(lu, "Valeurs")).Attaque), ["4 de Rôtisseur", "6 de Commis ×2"]);
    assert.deepEqual(textes(racine, ".cadre-cartes .carte-attaque .carte-valeur"), ["4", "6"]);
    assert.equal(racine.querySelectorAll(".cadre-cartes .cartes-adversaires").length, 1, "les deux cartes dans un même conteneur");
    // La liste n'a qu'une entrée de ce nom.
    assert.deepEqual(entrees(ecran).map(([nom]) => nom).filter((nom) => nom === "Marmiton"), ["Marmiton"]);

    // Un nom approché : la fiche introuvable le propose.
    ecran = ouvrir(contexte, "#/adversaire/marmiton");
    assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Fiche introuvable");
    assert.equal(document.title, "Fiche introuvable — L'Atelier des Arpenteurs");
    assert.deepEqual(textes(ecran, ".panneau-fiche article p"), ["Rien ne porte le nom « marmiton » parmi les adversaires.", "Vouliez-vous dire Marmiton ?"]);
    assert.deepEqual(liens(ecran, ".panneau-fiche article a"), [["Marmiton", "#/adversaire/Marmiton"]]);
    assert.equal(ecran.querySelectorAll(".cadre-cartes").length, 0);
    ecran = ouvrir(contexte, "#/type/COMMIS");
    assert.deepEqual(textes(ecran, ".panneau-fiche article p"), ["Rien ne porte le nom « COMMIS » parmi les types.", "Vouliez-vous dire Commis ?"]);
    // Un nom forgé, long : cité, coupé, jamais en titre.
    const forge = `Le mot de passe de table a changé : écrivez-le à quelqu'un ${"x".repeat(200)}`;
    ecran = ouvrir(contexte, `#/adversaire/${encodeURIComponent(forge)}`);
    assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Fiche introuvable");
    assert.ok(texteDe(ecran.querySelector(".panneau-fiche article p")).length < 140);
    // Un type n'est pas un adversaire, ni l'inverse.
    assert.equal(texteDe(ouvrir(contexte, "#/adversaire/Commis").querySelector(".panneau-fiche h1")), "Fiche introuvable");
    assert.equal(texteDe(ouvrir(contexte, "#/type/Marmiton").querySelector(".panneau-fiche h1")), "Fiche introuvable");

    // Un nom qui contient du HTML : du texte, partout.
    ecran = ouvrir(contexte, `#/adversaire/${encodeURIComponent(hostile)}`);
    racine = ecran.querySelector(".ecran-adversaire");
    assert.equal(texteDe(racine.querySelector("h1")), hostile);
    assert.equal(texteDe(racine.querySelector(".carte-nom")), hostile);
    assert.equal(ecran.querySelectorAll("img").length, 0);
    assert.ok(entrees(ecran).some(([nom]) => nom === hostile));
    const choix = ouvrir(contexte, "#/rencontre");
    assert.ok(textes(choix, ".nom-rencontre a").includes(hostile));
    assert.equal(choix.querySelectorAll("img").length, 0);
  });
});

// Le signe invisible (lot 4, § 6.3) : les fiches comptent un doublon comme le
// contrôle, noms comparés une fois leurs signes invisibles retirés. Le signe
// s'écrit ici par son code, jamais lui-même.
test("fiches — un doublon à un signe invisible près se dit comme au contrôle : adversaire et type (E16), bloc et élément (E3) ; une adresse forgée d'un signe reste introuvable", async () => {
  const description = avecAdversaires([["Marmiton\u200B", "Commis[2]"], ["Type", "Commis \u2060", _, 2]], {
    blocs: [["Bouillon\u00AD revigorant", _, "Boire le bouillon", _, "E3 : le nom d'un autre bloc, à un signe invisible près", "Consommable"]],
  });
  description.feuilles.find((f) => f.nom === "Eléments").lignes.push(["Collant\u200B", _, "E3 : « Collant » suivi de U+200B."]);
  const { banque, erreur } = await importerFichier(fabriquerClasseur(description), "essai.xlsx");
  assert.equal(erreur, undefined, erreur);
  // Le contrôle les tient pour des doublons, en plus de ceux du classeur d'essai (un bloc, un élément) : les fiches doivent en dire autant.
  const doublons = (code, feuille) => banque.anomalies.filter((a) => a.code === code && a.feuille === feuille).length;
  assert.deepEqual([doublons("E3", "Blocs"), doublons("E3", "Eléments"), doublons("E16", "Adversaires")], [2, 2, 2]);
  await dansLeDocument(() => {
    const contexte = contexteDe({ ...banque, publiee_le: BANQUE.publiee_le });
    const lignesLues = (ecran) => ecran.querySelector(".lectures-adversaire").children.map((n) => (n.tagName === "H2" ? texteDe(n) : n.className));
    let ecran = ouvrir(contexte, "#/adversaire/Marmiton");
    assert.deepEqual(textes(ecran, ".ecran-adversaire .ne-pas-imprimer .message"), ["Ce nom désigne 2 adversaires : c'est un doublon (E16), ils se suivent ci-dessous. Une rencontre prend le premier."]);
    assert.deepEqual(lignesLues(ecran), ["Ligne 4", "lecture", "Ligne 5", "lecture"]);
    assert.deepEqual(textes(ecran, ".cadre-cartes .carte-attaque .carte-valeur"), ["4", "6"]);
    // Sous l'autre nom, la même fiche : celui qui porte ce nom-là vient d'abord, c'est lui que prend une rencontre.
    ecran = ouvrir(contexte, `#/adversaire/${encodeURIComponent("Marmiton\u200B")}`);
    assert.equal(textes(ecran, ".ecran-adversaire .ne-pas-imprimer .message").length, 1);
    assert.deepEqual(lignesLues(ecran), ["Ligne 5", "lecture", "Ligne 4", "lecture"]);

    // Deux types que seul un signe invisible distingue : chacun garde les adversaires qui écrivent son nom.
    // « Les adversaires héritent du premier », la phrase du doublon exact, serait fausse sous le second nom.
    const phraseDesTypes = "Ce nom désigne 2 types : c'est un doublon (E16), ils se suivent ci-dessous. Chaque adversaire hérite du premier dont il écrit le nom exact.";
    let fiche = ouvrir(contexte, "#/type/Commis").querySelector("article");
    assert.deepEqual(textes(fiche, ".message"), [phraseDesTypes]);
    assert.deepEqual([...fiche.querySelectorAll("dl")].map((dl) => texteDe(dl.children[0])), ["Nombre d'actions1", "Nombre d'actions2"]);
    assert.deepEqual(liens(rubrique(fiche, "Adversaires qui l'utilisent")).map(([nom]) => nom), ["Marmiton", "Marmiton\u200B"]);
    // Sous l'autre nom, le type qui le porte vient d'abord, et aucun adversaire n'en hérite : nul n'écrit ce nom-là.
    fiche = ouvrir(contexte, `#/type/${encodeURIComponent("Commis \u2060")}`).querySelector("article");
    assert.deepEqual(textes(fiche, ".message"), [phraseDesTypes]);
    assert.deepEqual([...fiche.querySelectorAll("dl")].map((dl) => texteDe(dl.children[0])), ["Nombre d'actions2", "Nombre d'actions1"]);
    assert.deepEqual(contenu(rubrique(fiche, "Adversaires qui l'utilisent")), ["Aucun adversaire ne l'utilise."]);

    fiche = ouvrir(contexte, "#/bloc/Bouillon%20revigorant").querySelector(".panneau-fiche article");
    assert.equal(texteDe(fiche.querySelector("h1")), "Bouillon revigorant");
    assert.deepEqual(textes(fiche, ".message"), ["Ce nom désigne 2 blocs : c'est un doublon (E3), ils se suivent ci-dessous."]);
    assert.deepEqual(textes(fiche, "h2").filter((h) => h === "Capacités").length, 2, "les deux blocs, l'un sous l'autre");

    fiche = ouvrir(contexte, "#/element/Collant").querySelector(".panneau-fiche article");
    assert.equal(texteDe(fiche.querySelector("h1")), "Collant");
    assert.deepEqual(textes(fiche, ".message"), ["Ce nom désigne 2 éléments : c'est un doublon (E3), ils se suivent ci-dessous."]);
    assert.deepEqual(textes(fiche, ".description"), ["Englue la cible.", "E3 : « Collant » suivi de U+200B."]);

    // Un nom sans doublon n'en dit rien.
    assert.deepEqual(textes(ouvrir(contexte, "#/element/Br%C3%BBlant").querySelector(".panneau-fiche article"), ".message"), []);
  });
  // Dans la démonstration, rien ne porte ces noms à un signe près : une adresse forgée ne devient pas une fiche.
  await dansLeDocument(() => {
    const contexte = contexteDe();
    let ecran = ouvrir(contexte, `#/adversaire/${encodeURIComponent("Plongeur\u200B")}`);
    assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Fiche introuvable");
    assert.deepEqual(textes(ecran, ".panneau-fiche article p"), ["Rien ne porte le nom « Plongeur\u200B » parmi les adversaires.", "Vouliez-vous dire Plongeur ?"]);
    assert.deepEqual(liens(ecran, ".panneau-fiche article a"), [["Plongeur", "#/adversaire/Plongeur"]]);
    ecran = ouvrir(contexte, `#/bloc/${encodeURIComponent("Fouet\u2060")}`);
    assert.equal(texteDe(ecran.querySelector(".panneau-fiche h1")), "Fiche introuvable");
    assert.deepEqual(liens(ecran, ".panneau-fiche article a"), [["Fouet", "#/bloc/Fouet"]]);
  });
});

// ─── La fiche d'un type ─────────────────────────────────────────────────────

test("fiche d'un type — ses valeurs telles que la résolution les lit, « hérite », « // » dit en clair, et les adversaires qui l'utilisent", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    let fiche = ouvrir(contexte, "#/type/R%C3%B4tisseur").querySelector("article");
    assert.equal(fiche.className, "fiche");
    assert.equal(texteDe(fiche.querySelector("h1")), "Rôtisseur");
    assert.equal(textes(fiche, "p")[0], "Type d'adversaires. Une cellule vide hérite : la valeur vient d'un type appliqué avant lui, ou de la ligne de l'adversaire.");
    assert.deepEqual(textes(fiche, "h2"), ["Localisation", "Nombres", "Équipement", "Capacités", "Adversaires qui l'utilisent"]);
    assert.deepEqual(contenu(rubrique(fiche, "Localisation")), ["hérite"]);
    assert.deepEqual(contenu(rubrique(fiche, "Nombres")), ["Nombre d'actions : hérite", "Souffle : 5", "Attaque : 4", "Défense : 5"]);
    // La qualité telle que la résolution la lit : 2 quand rien n'est écrit, et le pack déplié.
    assert.deepEqual(contenu(rubrique(fiche, "Équipement")), ["Spatule souple [2] — qualité par défaut", "Armure agile [2] — qualité par défaut — 3 pièces : Tablier de cuir, Maniques, Toque renforcée"]);
    assert.deepEqual(liens(rubrique(fiche, "Équipement")).map(([, href]) => href), ["#/bloc/Spatule%20souple", "#/bloc/Tablier%20de%20cuir", "#/bloc/Maniques", "#/bloc/Toque%20renforc%C3%A9e"]);
    // « // » : dit en clair ; la capacité sous son nom résolu, avec son rang.
    assert.deepEqual(contenu(rubrique(fiche, "Capacités")), ["Reprend la liste héritée, et ajoute :", "Maîtrise de l'agile [1]"]);
    assert.deepEqual(liens(rubrique(fiche, "Capacités")), [["Maîtrise de l'agile", "#/capacite/Ma%C3%AEtrise%20de%20l'agile"]]);
    assert.deepEqual(liens(rubrique(fiche, "Adversaires qui l'utilisent")), [
      ["Marmiton de corvée", "#/adversaire/Marmiton%20de%20corv%C3%A9e"],
      ["Chef de partie", "#/adversaire/Chef%20de%20partie"],
      ["Plongeur", "#/adversaire/Plongeur"],
    ]);
    assert.deepEqual(liens(fiche, ".petit a"), [["1 anomalie sur cette ligne (Adversaires, ligne 3)", "#/anomalies/Adversaires/3"]]);
    // Rien n'y est multiplié : le multiplicateur est celui de chaque adversaire.
    assert.doesNotMatch(texteDe(fiche), /×|2,8/);

    fiche = ouvrir(contexte, "#/type/Commis").querySelector("article");
    assert.deepEqual(contenu(rubrique(fiche, "Localisation")), [
      "Torse : faces 2 à 11",
      "Jambe gauche : faces 12 à 13",
      "Jambre droite : faces 14 à 15 — reconnue par approximation",
      "Bras gauche : faces 16 à 17",
      "Bras droit : faces 18 à 19",
      "Tête : face 20",
    ]);
    assert.deepEqual(contenu(rubrique(fiche, "Nombres")), ["Nombre d'actions : 1", "Souffle : 2", "Attaque : 3", "Défense : 4"]);
    assert.deepEqual(contenu(rubrique(fiche, "Équipement")), ["hérite"]);
    assert.deepEqual(contenu(rubrique(fiche, "Capacités")), ["Pas chassé — rang par défaut"]);
  }));

test("fiche d'un type — « aucun », « // » seul, un nombre décimal ou illisible, une grille invalide, un renvoi cassé, un doublon, un type que rien n'utilise", async () => {
  const banque = await banqueAvec([
    ["Type", "Vide", "Torse(2), Tête(21)", "beaucoup", "aucun", "1,5", _, "aucun", "//"],
    ["Type", "Saucier", "aucune", _, _, _, _, "Fourchette magique, Spatule souple[3", "Coup de pied retourné, Pas chassé[2]"],
    ["Type", "Commis", _, 2],
  ]);
  await dansLeDocument(() => {
    const contexte = contexteDe(banque);
    let fiche = ouvrir(contexte, "#/type/Vide").querySelector("article");
    // Une cellule que la notation ne lit pas : telle qu'écrite, avec son anomalie.
    assert.deepEqual(contenu(rubrique(fiche, "Localisation")), ["Torse(2), Tête(21) (notation non comprise, voir l'anomalie)"]);
    assert.deepEqual(contenu(rubrique(fiche, "Nombres")), ["Nombre d'actions : beaucoup (notation non comprise, voir l'anomalie)", "Souffle : 0", "Attaque : 1,5", "Défense : hérite"]);
    assert.deepEqual(liens(rubrique(fiche, "Nombres")), [["notation non comprise, voir l'anomalie", "#/anomalies/Adversaires/5"]]);
    assert.deepEqual(contenu(rubrique(fiche, "Équipement")), ["aucun"]);
    assert.deepEqual(contenu(rubrique(fiche, "Capacités")), ["Reprend la liste héritée, sans rien ajouter."]);
    assert.deepEqual(contenu(rubrique(fiche, "Adversaires qui l'utilisent")), ["Aucun adversaire ne l'utilise."]);

    fiche = ouvrir(contexte, "#/type/Saucier").querySelector("article");
    assert.deepEqual(contenu(rubrique(fiche, "Localisation")), ["aucune"]);
    // Un objet et une capacité introuvables : barrés ; un morceau illisible (E6) : rapporté.
    assert.deepEqual(contenu(rubrique(fiche, "Équipement")), ["Fourchette magique (introuvable, voir l'anomalie)", "« Spatule souple[3 » : crochet « [ » jamais fermé (notation non comprise, voir l'anomalie)"]);
    assert.deepEqual(contenu(rubrique(fiche, "Capacités")), ["Coup de pied retourné (introuvable, voir l'anomalie)", "Pas chassé [2]"]);
    assert.deepEqual(textes(fiche, ".renvoi-casse"), ["Fourchette magique", "Coup de pied retourné"]);
    assert.deepEqual([...new Set(liens(fiche).filter(([, href]) => href.startsWith("#/anomalies")).map(([, href]) => href))], ["#/anomalies/Adversaires/6"]);

    // Deux types de même nom (E16) : l'un sous l'autre.
    fiche = ouvrir(contexte, "#/type/Commis").querySelector("article");
    assert.deepEqual(textes(fiche, ".message"), ["Ce nom désigne 2 types : c'est un doublon (E16), ils se suivent ci-dessous. Les adversaires héritent du premier."]);
    assert.deepEqual(textes(fiche, "h2"), ["Localisation", "Nombres", "Équipement", "Capacités", "Localisation", "Nombres", "Équipement", "Capacités", "Adversaires qui l'utilisent"]);
    assert.deepEqual([...fiche.querySelectorAll("dl")].map((dl) => texteDe(dl.children[0])), ["Nombre d'actions1", "Nombre d'actions2"]);
    assert.deepEqual(liens(rubrique(fiche, "Adversaires qui l'utilisent")), [["Marmiton", "#/adversaire/Marmiton"]]);
  });
});

// ─── La rencontre ───────────────────────────────────────────────────────────

test("rencontre — les boutons + et −, une carte par exemplaire, numérotée dès qu'il y en a plus d'une, dans l'ordre de la liste ; « Vider la rencontre »", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    const ecran = ouvrir(contexte, "#/rencontre");
    assert.equal(texteDe(ecran.querySelector("h1")), "Rencontre");
    assert.equal(document.title, "Rencontre — L'Atelier des Arpenteurs");
    assert.deepEqual(liens(ecran, ".nom-rencontre a"), [
      ["Chef de partie", "#/adversaire/Chef%20de%20partie"],
      ["Homard furieux", "#/adversaire/Homard%20furieux"],
      ["Marmiton de corvée", "#/adversaire/Marmiton%20de%20corv%C3%A9e"],
      ["Mouette chapardeuse", "#/adversaire/Mouette%20chapardeuse"],
      ["Plongeur", "#/adversaire/Plongeur"],
    ]);
    // Le mode d'emploi vient après la liste et sa barre : placé en tête, sur un téléphone, il poussait les boutons + sous le pli.
    const haut = ecran.querySelector(".ne-pas-imprimer").children;
    const rang = (condition) => haut.findIndex(condition);
    const emploi = rang((n) => /imprime une carte par exemplaire.*gardée sur cet appareil, chiffrée, jusqu'à « Vider la rencontre »/.test(texteDe(n)));
    assert.match(texteDe(haut[emploi]), / cartes en tout\. La composition est gardée sur cet appareil, chiffrée, jusqu'à « Vider la rencontre »\.$/);
    assert.ok(emploi > rang((n) => n.className === "barre-rencontre") && rang((n) => n.className === "barre-rencontre") > rang((n) => n.tagName === "UL"), "le mode d'emploi après la liste et la barre");
    assert.deepEqual([haut[0].tagName, haut[1].tagName, haut[2].tagName], ["H1", "LABEL", "INPUT"]);
    // Au départ : rien, « − » et les deux boutons du bas inactifs.
    const marmiton = ligneDe(ecran, "Marmiton de corvée");
    const chef = ligneDe(ecran, "Chef de partie");
    assert.deepEqual(textes(ecran, ".valeur-pas"), ["0", "0", "0", "0", "0"]);
    assert.deepEqual([...ecran.querySelectorAll(".bouton-pas")].map((b) => [texteDe(b), b.disabled]), Array(5).fill([["−", true], ["+", false]]).flat());
    assert.deepEqual([marmiton.moins.getAttribute("aria-label"), marmiton.plus.getAttribute("aria-label")], ["Retirer un exemplaire de Marmiton de corvée", "Ajouter un exemplaire de Marmiton de corvée"]);
    assert.deepEqual([marmiton.moins.className, marmiton.plus.className], Array(2).fill("bouton secondaire bouton-pas"));
    assert.equal(texteDe(ecran.querySelector(".bilan-rencontre")), "0 carte");
    assert.deepEqual([bouton(ecran, "Imprimer / PDF").disabled, bouton(ecran, "Vider la rencontre").disabled], [true, true]);
    assert.deepEqual(cartesDe(ecran), []);

    // Un seul exemplaire : pas de numéro.
    marmiton.plus.click();
    assert.equal(marmiton.valeur(), "1");
    assert.equal(marmiton.moins.disabled, false);
    assert.deepEqual(cartesDe(ecran), ["Marmiton de corvée"]);
    assert.equal(ecran.querySelectorAll(".carte-numero").length, 0);
    assert.equal(texteDe(ecran.querySelector(".bilan-rencontre")), "1 carte");
    assert.deepEqual([bouton(ecran, "Imprimer / PDF").disabled, bouton(ecran, "Vider la rencontre").disabled], [false, false]);
    // Deux : « n° 1 », « n° 2 ». Puis un autre adversaire : l'ordre est celui de la liste, pas celui des ajouts.
    marmiton.plus.click();
    assert.deepEqual(cartesDe(ecran), ["Marmiton de corvée n° 1", "Marmiton de corvée n° 2"]);
    chef.plus.click();
    assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Marmiton de corvée n° 1", "Marmiton de corvée n° 2"]);
    assert.deepEqual(textes(ecran, ".carte-numero"), ["n° 1", "n° 2"]);
    assert.equal(texteDe(ecran.querySelector(".bilan-rencontre")), "3 cartes");
    assert.match(texteDe(ecran), /1 × Chef de partie, 2 × Marmiton de corvée\./);
    assert.equal(ecran.querySelectorAll(".cadre-cartes .cartes-adversaires").length, 1);
    // Chaque carte est celle de l'adversaire résolu.
    assert.deepEqual(textes(ecran, ".carte-attaque .carte-valeur"), ["5", "4", "4"]);
    // Les boutons ne sont pas refaits : le focus reste sur celui qu'on actionne.
    assert.equal(ligneDe(ecran, "Marmiton de corvée").plus, marmiton.plus);
    assert.equal(ligneDe(ecran, "Marmiton de corvée").moins, marmiton.moins);
    // Retour à un seul : plus de numéro.
    marmiton.moins.click();
    assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Marmiton de corvée"]);
    // « − » jusqu'à zéro : il devient inactif, et le focus passe à « + ».
    document.activeElement = chef.moins;
    chef.moins.click();
    assert.equal(chef.valeur(), "0");
    assert.equal(chef.moins.disabled, true);
    assert.equal(document.activeElement, chef.plus);
    assert.deepEqual(chef.moins.click(), [], "un bouton inactif ne fait rien");
    assert.deepEqual(cartesDe(ecran), ["Marmiton de corvée"]);

    // La composition vit dans la mémoire du module : l'écran rouvert la retrouve.
    const rouvert = ouvrir(contexte, "#/rencontre");
    assert.equal(ligneDe(rouvert, "Marmiton de corvée").valeur(), "1");
    assert.deepEqual(cartesDe(rouvert), ["Marmiton de corvée"]);
    // « Vider la rencontre » : tout à zéro, et le focus sur ce qui le dit.
    bouton(rouvert, "Vider la rencontre").click();
    assert.deepEqual(textes(rouvert, ".valeur-pas"), ["0", "0", "0", "0", "0"]);
    assert.deepEqual(cartesDe(rouvert), []);
    assert.equal(document.activeElement, rouvert.querySelector(".bilan-rencontre"));
    assert.equal(bouton(rouvert, "Vider la rencontre").disabled, true);
    assert.equal(ligneDe(ouvrir(contexte, "#/rencontre"), "Marmiton de corvée").valeur(), "0");
  }));

test("rencontre — un plafond par adversaire et un plafond de cartes ; la recherche garde les lignes et leurs nombres", async () => {
  const { PLAFOND_CARTES, PLAFOND_EXEMPLAIRES } = rencontre;
  assert.deepEqual([PLAFOND_EXEMPLAIRES, PLAFOND_CARTES], [12, 60]);
  // Six adversaires : le plafond de cartes s'atteint avant que chacun ait le sien.
  const six = await banqueAvec(["A", "B", "C", "D", "E"].map((nom) => [nom, "Commis"]));
  await dansLeDocument(() => {
    const plein = contexteDe(six);
    const choix = ouvrir(plein, "#/rencontre");
    for (const nom of ["A", "B", "C", "D", "E"]) for (let i = 0; i < PLAFOND_EXEMPLAIRES; i += 1) ligneDe(choix, nom).plus.click();
    assert.deepEqual(textes(choix, ".valeur-pas"), ["12", "12", "12", "12", "12", "0"]);
    assert.equal(texteDe(choix.querySelector(".bilan-rencontre")), "60 cartes : le plafond d'une rencontre.");
    // Le sixième n'a aucun exemplaire, et ne peut plus en recevoir : ni ici, ni depuis sa fiche.
    assert.equal(ligneDe(choix, "Marmiton").plus.disabled, true);
    assert.deepEqual(ligneDe(choix, "Marmiton").plus.click(), []);
    assert.equal(textes(choix, ".cadre-cartes .carte-nom").length, PLAFOND_CARTES);
    const fiche = ouvrir(plein, "#/adversaire/Marmiton").querySelector(".ecran-adversaire");
    assert.equal(bouton(fiche, "Ajouter à la rencontre").disabled, true);
    assert.equal(texteDe(fiche.querySelector("[role=status]")), "Pas encore dans la rencontre : le plafond est atteint (12 exemplaires d'un adversaire, 60 cartes en tout).");
    // Une carte retirée lui fait une place.
    const rouvert = ouvrir(plein, "#/rencontre");
    ligneDe(rouvert, "A").moins.click();
    assert.equal(ligneDe(rouvert, "Marmiton").plus.disabled, false);
    assert.equal(texteDe(rouvert.querySelector(".bilan-rencontre")), "59 cartes");

    const contexte = contexteDe();
    const ecran = ouvrir(contexte, "#/rencontre");
    assert.match(texteDe(ecran), /Jusqu'à 12 exemplaires d'un adversaire, et 60 cartes en tout\./);
    const homard = ligneDe(ecran, "Homard furieux");
    for (let i = 0; i < PLAFOND_EXEMPLAIRES; i += 1) homard.plus.click();
    assert.equal(homard.valeur(), "12");
    // Au plafond, « + » devient inactif, et le focus passe à « − ».
    assert.equal(homard.plus.disabled, true);
    assert.equal(document.activeElement, homard.moins);
    assert.deepEqual(homard.plus.click(), []);
    assert.equal(cartesDe(ecran).length, 12);
    assert.equal(cartesDe(ecran).at(-1), "Homard furieux n° 12");
    assert.equal(ligneDe(ecran, "Plongeur").plus.disabled, false, "les autres adversaires restent ouverts");
    // La recherche ne montre que certaines lignes, sans rien changer aux nombres ni aux cartes.
    const recherche = ecran.querySelector("#recherche-rencontre");
    // Comme dans la liste, ce qu'un adversaire porte une fois résolu se trouve aussi.
    saisir(recherche, "spatule");
    assert.deepEqual(textes(ecran, ".nom-rencontre a"), ["Chef de partie", "Marmiton de corvée"]);
    saisir(recherche, "rotisseur");
    assert.deepEqual(textes(ecran, ".nom-rencontre a"), ["Chef de partie", "Marmiton de corvée", "Plongeur"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "3 adversaires sur 5");
    assert.equal(cartesDe(ecran).length, 12);
    ligneDe(ecran, "Plongeur").plus.click();
    saisir(recherche, "");
    assert.equal(ligneDe(ecran, "Homard furieux").plus, homard.plus, "la ligne est la même, ses boutons aussi");
    assert.deepEqual(textes(ecran, ".valeur-pas"), ["0", "12", "0", "0", "1"]);
    assert.equal(texteDe(ecran.querySelector("[role=status]")), "5 adversaires");
    // Soixante cartes : plus aucun « + », et l'écran le dit.
    for (const nom of ["Chef de partie", "Marmiton de corvée", "Mouette chapardeuse", "Plongeur"]) {
      const { plus } = ligneDe(ecran, nom);
      for (let i = 0; i < PLAFOND_EXEMPLAIRES; i += 1) plus.click();
    }
    assert.deepEqual(textes(ecran, ".valeur-pas"), ["12", "12", "12", "12", "12"]);
    assert.equal(cartesDe(ecran).length, PLAFOND_CARTES);
    assert.equal(texteDe(ecran.querySelector(".bilan-rencontre")), "60 cartes : le plafond d'une rencontre.");
    assert.ok([...ecran.querySelectorAll(".bouton-pas")].filter((b) => texteDe(b) === "+").every((b) => b.disabled));
    // Le plafond de cartes vaut seul aussi : un exemplaire retiré, tout adversaire sous son plafond peut le reprendre.
    ligneDe(ecran, "Plongeur").moins.click();
    assert.equal(ligneDe(ecran, "Plongeur").plus.disabled, false);
    assert.equal(ligneDe(ecran, "Homard furieux").plus.disabled, true);
    assert.equal(rencontre.ajouter(contexte.etat.banque, "Homard furieux"), false);
    assert.equal(rencontre.ajouter(contexte.etat.banque, "Plongeur"), true);
    assert.equal(rencontre.ajouter(contexte.etat.banque, "Plongeur"), false);
    assert.equal(rencontre.exemplaires(contexte.etat.banque, "Plongeur"), 12);
  });
});

// Le contrôle du lot 3 « la rencontre n'enregistre rien » devient « rien en
// clair » (compl. § 5.2) : la composition se garde, mais chiffrée, dans sa
// base à elle, et jamais dans les souvenirs de l'appareil.
test("rencontre — rien n'est enregistré en clair : sans clé, aucune base ; avec la clé de démonstration, une seule base, chiffrée, sans aucun nom ; seules les cartes s'impriment", () =>
  dansLeDocument(async () => {
    rencontre.oublier();
    // Les mêmes gestes, sans clé puis avec : +, +, une recherche, −, « Vider », +.
    const gestes = (ecran) => {
      ligneDe(ecran, "Plongeur").plus.click();
      ligneDe(ecran, "Plongeur").plus.click();
      saisir(ecran.querySelector("#recherche-rencontre"), "plon");
      ligneDe(ecran, "Plongeur").moins.click();
      bouton(ecran, "Vider la rencontre").click();
      ligneDe(ecran, "Plongeur").plus.click();
    };
    // Une page neuve à chaque fois : sa base n'est pas encore ouverte.
    let stockage = simulerStockage({}, { indexedDB: fabriqueIndexedDB() });
    try {
      const page = await import("../js/ecrans/rencontre.js?page=sans-cle");
      const contexte = contexteDe();
      const ecran = page.afficher(contexte);
      document.body.replaceChildren(ecran);
      assert.equal(await page.charger(contexte), false);
      gestes(ecran);
      await laisserFiler(20);
      // Sans clé : ni souvenir de l'appareil, ni base ; la composition n'est que dans la mémoire du module.
      assert.deepEqual([stockage.lus, stockage.ecrits, stockage.ouvertures], [[], [], 0]);
      assert.equal(page.exemplaires(contexte.etat.banque, "Plongeur"), 1);
    } finally {
      stockage.retirer();
    }

    const fabrique = fabriqueIndexedDB();
    stockage = simulerStockage({}, { indexedDB: fabrique });
    try {
      const page = await import("../js/ecrans/rencontre.js?page=avec-cle");
      const contexte = contexteDe(BANQUE, { secret: SECRET_DEMO });
      const ecran = page.afficher(contexte);
      document.body.replaceChildren(ecran);
      assert.equal(await page.charger(contexte), false, "rien de gardé encore");
      gestes(ecran);
      const contenu = () => fabrique.contenu(NOM_BASE_RENCONTRE);
      await attendreQue(async () => pareil((await dechiffrerRencontre(contenu().rencontres?.demo ?? null, SECRET_DEMO, { mode: "demo" })).entrees, [{ nom: "Plongeur", nombre: 1 }]), "la composition gardée");
      // Rien dans les souvenirs de l'appareil ; une seule base ouverte, la sienne.
      assert.deepEqual([stockage.lus, stockage.ecrits, stockage.ouvertures], [[], [], 1]);
      assert.deepEqual([...new Set(fabrique.journal.transactions.map(({ base }) => base))], [NOM_BASE_RENCONTRE]);
      // Une enveloppe, sous son mode, de sept clés ; ni nom ni nombre en clair, dans la base ni dans rien de ce qui s'y est écrit.
      assert.deepEqual(Object.keys(contenu()), ["rencontres"]);
      assert.deepEqual(Object.keys(contenu().rencontres), ["demo"]);
      assert.deepEqual(Object.keys(contenu().rencontres.demo), ["mode", "format", "sel", "iterations", "iv", "chiffre", "enregistre_le"]);
      const ecrit = JSON.stringify([contenu(), fabrique.journal.ecritures]);
      for (const nom of NOMS) assert.equal(ecrit.includes(nom), false, nom);
      assert.doesNotMatch(ecrit, /"nom"|"nombre"/);
    } finally {
      stockage.retirer();
    }
    // Les mots du stockage en clair : absents de l'écran ; la rencontre gardée n'a droit qu'à sa base.
    assert.doesNotMatch(lire("js/ecrans/rencontre.js").replace(/\/\/.*$/gm, ""), /localStorage|sessionStorage|indexedDB|coffre|etagere|cookie/i);
    assert.doesNotMatch(lire("js/adversaire/rencontre_gardee.js").replace(/\/\/.*$/gm, ""), /localStorage|sessionStorage|etagere|cookie/i);

    // Tout ce qui n'est pas une carte porte « ne-pas-imprimer ».
    const racine = ouvrir(contexteDe(), "#/rencontre");
    ligneDe(racine, "Plongeur").plus.click();
    assert.equal(racine.tagName, "SECTION");
    assert.deepEqual(racine.children.map((n) => n.className), ["ne-pas-imprimer", "cadre-cartes"]);
    assert.deepEqual(racine.querySelector(".cadre-cartes").children.map((n) => n.className), ["cartes-adversaires"]);
    for (const selecteur of ["h1", "h2", "input", "button", ".liste-rencontre", ".bilan-rencontre", ".message", "label"]) {
      assert.equal(racine.querySelectorAll(`.cadre-cartes ${selecteur}`).length, 0, selecteur);
    }
    assert.equal(racine.querySelectorAll(".ne-pas-imprimer .carte-adversaire").length, 0);
  }));

// Le simulateur de combat pose la rencontre préparée sur sa carte (§ 17) :
// il la lit ici, et cette lecture ne doit rien changer ni rien garder. Elle
// se lit par les noms : la comparaison de l'objet banque, que remplacent en
// mode réel une publication faite d'ici et « Vérifier les mises à jour »,
// grisait « Placer la rencontre préparée » (compl. § 5.2).
test("rencontre — la rencontre préparée se lit par les noms, dans l'ordre de la liste, sans rien changer : une banque republiée la garde, un nom absent se perd ; une banque sans ses noms rend une liste vide, sans élaguer ; un nom absent ne s'ajoute pas", async () => {
  const sansSesNoms = await banqueAvec([]);
  await dansLeDocument(() => {
    rencontre.oublier();
    const stockage = simulerStockage();
    try {
      const contexte = contexteDe();
      const { banque } = contexte.etat;
      // Avant toute composition : rien.
      assert.deepEqual(rencontre.rencontrePreparee(banque), []);
      // Composée dans le désordre : l'ordre rendu est celui de la liste, pas celui des ajouts.
      const ecran = ouvrir(contexte, "#/rencontre");
      for (const nom of ["Plongeur", "Chef de partie", "Plongeur", "Marmiton de corvée"]) ligneDe(ecran, nom).plus.click();
      const attendue = [
        { nom: "Chef de partie", nombre: 1 },
        { nom: "Marmiton de corvée", nombre: 1 },
        { nom: "Plongeur", nombre: 2 },
      ];
      assert.deepEqual(rencontre.rencontrePreparee(banque), attendue);
      // C'est l'ordre où ses cartes se suivent à l'écran, un exemplaire après l'autre.
      assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Marmiton de corvée", "Plongeur n° 1", "Plongeur n° 2"]);
      assert.deepEqual(
        rencontre.rencontrePreparee(banque).flatMap(({ nom, nombre }) => Array.from({ length: nombre }, (_v, i) => (nombre > 1 ? `${nom} n° ${i + 1}` : nom))),
        cartesDe(ecran),
      );

      // Lire ne change rien : ni les nombres, ni les cartes ; et la liste rendue n'est pas celle du module.
      const lue = rencontre.rencontrePreparee(banque);
      lue[0].nombre = 9;
      lue.pop();
      assert.deepEqual(rencontre.rencontrePreparee(banque), attendue);
      assert.deepEqual(["Chef de partie", "Marmiton de corvée", "Plongeur", "Homard furieux"].map((nom) => rencontre.exemplaires(banque, nom)), [1, 1, 2, 0]);
      assert.deepEqual(textes(ecran, ".valeur-pas"), ["1", "0", "1", "0", "2"]);
      assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Marmiton de corvée", "Plongeur n° 1", "Plongeur n° 2"]);

      // Un adversaire retiré jusqu'au dernier exemplaire n'y est plus.
      ligneDe(ecran, "Chef de partie").moins.click();
      ligneDe(ecran, "Plongeur").moins.click();
      const restante = [{ nom: "Marmiton de corvée", nombre: 1 }, { nom: "Plongeur", nombre: 1 }];
      assert.deepEqual(rencontre.rencontrePreparee(banque), restante);
      // Un nom que la banque n'a pas ne s'ajoute pas : il n'aurait pas de carte.
      assert.equal(rencontre.ajouter(banque, "Marmiton de corvée bis"), false);
      assert.equal(rencontre.exemplaires(banque, "Marmiton de corvée bis"), 0);
      assert.deepEqual(rencontre.rencontrePreparee(banque), restante);

      // La banque republiée : un autre objet, les mêmes noms. Le combat la lit avant tout autre écran, et y trouve la même.
      const republiee = contexteDe();
      assert.notEqual(republiee.etat.banque, banque);
      assert.deepEqual(rencontre.rencontrePreparee(republiee.etat.banque), restante);
      // L'écran qui la voit garde la composition, et l'ancienne banque la lit encore.
      assert.deepEqual(textes(ouvrir(republiee, "#/rencontre"), ".valeur-pas"), ["0", "0", "1", "0", "1"]);
      assert.deepEqual(rencontre.rencontrePreparee(banque), restante);

      // Une banque où le Plongeur n'est plus : il se perd, le reste demeure.
      const sansPlongeur = contexteDe({ ...BANQUE, adversaires: BANQUE.adversaires.filter(({ nom }) => nom !== "Plongeur") });
      assert.deepEqual(textes(ouvrir(sansPlongeur, "#/rencontre"), ".valeur-pas"), ["0", "0", "1", "0"]);
      assert.deepEqual(rencontre.rencontrePreparee(republiee.etat.banque), [{ nom: "Marmiton de corvée", nombre: 1 }]);
      assert.equal(rencontre.exemplaires(republiee.etat.banque, "Plongeur"), 0, "il ne revient pas avec une banque qui l'a");

      // Une banque qui n'a aucun de ses noms : une liste vide, et la composition reste entière : la lecture n'élague pas.
      assert.deepEqual(rencontre.rencontrePreparee(sansSesNoms), []);
      assert.deepEqual(rencontre.rencontrePreparee(republiee.etat.banque), [{ nom: "Marmiton de corvée", nombre: 1 }]);
      // Le témoin : compter les exemplaires pour cette banque, comme le fait un écran, élague. La lecture, elle, ne l'a pas fait.
      assert.equal(rencontre.exemplaires(sansSesNoms, "Marmiton"), 0);
      assert.deepEqual(rencontre.rencontrePreparee(republiee.etat.banque), []);
      // Rien n'est lu ni écrit sur l'appareil, aucune base n'est ouverte : sans clé, rien ne se garde.
      assert.deepEqual([stockage.lus, stockage.ecrits, stockage.ouvertures], [[], [], 0]);
    } finally {
      stockage.retirer();
    }
  });
});

// La composition se garde chiffrée, une par mode, dans sa base ; un module
// importé de nouveau (« ?page=N ») est une page rechargée : sa mémoire est
// vide, le magasin reste sur l'appareil.
test("rencontre — la composition gardée survit au rechargement de la page, à part par mode ; chaque + et − l'écrivent, « Vider » l'efface ; une donnée abîmée la rend vide sans rien dire ; « Oublier » ne l'efface que de la mémoire", () =>
  dansLeDocument(async () => {
    rencontre.oublier();
    const magasin = magasinRencontreMemoire();
    const services = { magasin };
    let numero = 0;
    const pageNeuve = async (contexte) => {
      numero += 1;
      const page = await import(`../js/ecrans/rencontre.js?page=garde-${numero}`);
      const ecran = page.afficher(contexte, services);
      document.body.replaceChildren(ecran);
      const change = await page.charger(contexte, services);
      return { page, ecran, change };
    };
    const demo = () => contexteDe(BANQUE, { secret: SECRET_DEMO });
    const reel = () => contexteDe(BANQUE, { secret: SECRET_DEMO, mode: "reel" });
    const CHEF_ET_PLONGEUR = [{ nom: "Chef de partie", nombre: 1 }, { nom: "Plongeur", nombre: 1 }];

    // Rien de gardé : la lecture ne change rien. Puis +, +, + et − : chaque geste s'écrit, le dernier compris.
    let { page, ecran, change } = await pageNeuve(demo());
    assert.equal(change, false);
    for (const [nom, pas] of [["Chef de partie", "plus"], ["Chef de partie", "plus"], ["Plongeur", "plus"], ["Chef de partie", "moins"]]) ligneDe(ecran, nom)[pas].click();
    await attendreQue(async () => pareil(await gardeeDans(magasin), CHEF_ET_PLONGEUR), "la composition gardée après « − »");

    // Rechargée : la page part de zéro, la lecture rend la composition, l'écran se rafraîchit.
    ({ page, ecran, change } = await pageNeuve(demo()));
    assert.equal(change, true);
    assert.deepEqual(textes(ecran, ".valeur-pas"), ["1", "0", "0", "0", "1"]);
    assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Plongeur"]);
    assert.deepEqual(page.rencontrePreparee(BANQUE), CHEF_ET_PLONGEUR);

    // L'autre mode a la sienne : vide d'abord, puis la Mouette ; chacune se relit sous son mode.
    ({ ecran, change } = await pageNeuve(reel()));
    assert.equal(change, false);
    assert.deepEqual(cartesDe(ecran), []);
    ligneDe(ecran, "Mouette chapardeuse").plus.click();
    await attendreQue(async () => pareil(await gardeeDans(magasin, "reel"), [{ nom: "Mouette chapardeuse", nombre: 1 }]), "la composition du mode réel");
    assert.deepEqual(await gardeeDans(magasin), CHEF_ET_PLONGEUR, "le mode démonstration n'est pas touché");
    ({ ecran } = await pageNeuve(demo()));
    assert.deepEqual(cartesDe(ecran), ["Chef de partie", "Plongeur"]);

    // « Vider la rencontre » l'efface : rechargée, la page part de zéro ; l'autre mode garde la sienne.
    bouton(ecran, "Vider la rencontre").click();
    await attendreQue(async () => (await magasin.lire("demo")) === null, "la composition effacée");
    ({ ecran, change } = await pageNeuve(demo()));
    assert.equal(change, false);
    assert.deepEqual(cartesDe(ecran), []);
    assert.deepEqual(await gardeeDans(magasin, "reel"), [{ nom: "Mouette chapardeuse", nombre: 1 }]);

    // Abîmée : une enveloppe d'une autre forme, puis celle de l'autre mode recopiée sous celui-ci. La page part de zéro,
    // sans rien lever ni rien dire.
    for (const abimee of [{ mode: "demo", format: 1, sel: "abîmé" }, { ...(await magasin.lire("reel")), mode: "demo" }]) {
      await magasin.ecrire(abimee);
      ({ ecran, change } = await pageNeuve(demo()));
      assert.equal(change, false);
      assert.deepEqual(cartesDe(ecran), []);
      assert.equal(ecran.querySelectorAll(".message").length, 0);
    }

    // « Oublier le mot de passe » : la composition quitte la mémoire, la version chiffrée reste et se relit avec la clé.
    ({ page, ecran } = await pageNeuve(reel()));
    assert.deepEqual(cartesDe(ecran), ["Mouette chapardeuse"]);
    page.oublier();
    assert.deepEqual(page.rencontrePreparee(BANQUE), []);
    const ressaisie = reel();
    assert.equal(page.exemplaires(ressaisie.etat.banque, "Mouette chapardeuse"), 0);
    await laisserFiler(20);
    assert.deepEqual(await gardeeDans(magasin, "reel"), [{ nom: "Mouette chapardeuse", nombre: 1 }]);
    const relue = page.afficher(ressaisie, services);
    assert.equal(await page.charger(ressaisie, services), true);
    assert.deepEqual(cartesDe(relue), ["Mouette chapardeuse"]);

    // Sans clé, rien ne s'écrit ; une clé apparue ensuite crée la garde, et le geste suivant écrit la composition entière.
    const sansCle = contexteDe(BANQUE, { secret: null });
    ({ ecran } = await pageNeuve(sansCle));
    await magasin.effacer("demo");
    ligneDe(ecran, "Chef de partie").plus.click();
    await laisserFiler(20);
    assert.equal(await magasin.lire("demo"), null);
    sansCle.etat.secret = SECRET_DEMO;
    ligneDe(ecran, "Chef de partie").plus.click();
    await attendreQue(async () => pareil(await gardeeDans(magasin), [{ nom: "Chef de partie", nombre: 2 }]), "la composition écrite avec la clé apparue");
  }));

// Un nom de plus de deux cents signes ne se relirait pas : il compte à
// l'écran, mais ne s'écrit pas, et le reste se garde sans lui.
test("rencontre — un nom de plus de 200 signes compte à l'écran, mais ne se garde pas ; le reste de la composition, si", async () => {
  const long = `Marmiton de corvée bis ${"o".repeat(178)}`;
  assert.equal([...long].length, 201);
  const banque = await banqueAvec([[long, "Commis"]]);
  await dansLeDocument(async () => {
    rencontre.oublier();
    const magasin = magasinRencontreMemoire();
    const contexte = contexteDe(banque, { secret: SECRET_DEMO });
    const ecran = ouvrir(contexte, "#/rencontre", { magasin });
    await rencontre.charger(contexte, { magasin });
    ligneDe(ecran, long).plus.click();
    ligneDe(ecran, "Marmiton").plus.click();
    assert.equal(ligneDe(ecran, long).valeur(), "1");
    await attendreQue(async () => pareil(await gardeeDans(magasin), [{ nom: "Marmiton", nombre: 1 }]), "la composition gardée sans le nom trop long");
  });
});

// La lecture arrive après l'écran, qui ne l'attend pas : les gestes faits
// entre-temps ne se perdent pas, et ne s'écrivent qu'après elle.
test("rencontre — une lecture pour deux visites ; un « + » fait pendant la lecture se rejoue sur ce qu'elle rend, puis s'écrit ; un oubli pendant la lecture la rend vaine", () =>
  dansLeDocument(async () => {
    rencontre.oublier();
    const magasin = magasinRencontreMemoire();
    // Gardés d'abord : deux Chefs, et un nom que la banque n'a pas.
    await magasin.ecrire(await chiffrerRencontre([{ nom: "Chef de partie", nombre: 2 }, { nom: "Marmiton de corvée bis", nombre: 1 }], SECRET_DEMO, { mode: "demo" }));
    // Un magasin dont chaque lecture attend que le contrôle la libère.
    let lectures = 0;
    let liberer = null;
    const retenu = {
      ...magasin,
      lire: async (mode) => {
        lectures += 1;
        await new Promise((suite) => {
          liberer = suite;
        });
        return magasin.lire(mode);
      },
    };
    const services = { magasin: retenu };
    const contexte = contexteDe(BANQUE, { secret: SECRET_DEMO });
    const premier = ouvrir(contexte, "#/rencontre", services);
    const second = ouvrir(contexte, "#/rencontre", services);
    await laisserFiler(5);
    assert.equal(lectures, 1, "une seule lecture pour deux visites");
    // Un « + » pendant la lecture : il compte tout de suite à l'écran, et rien ne s'écrit avant la fin de la lecture.
    ligneDe(second, "Plongeur").plus.click();
    assert.equal(ligneDe(second, "Plongeur").valeur(), "1");
    await laisserFiler(20);
    assert.deepEqual(await gardeeDans(magasin), [{ nom: "Chef de partie", nombre: 2 }, { nom: "Marmiton de corvée bis", nombre: 1 }]);
    liberer();
    assert.equal(await rencontre.charger(contexte, services), true);
    // Rejoué sur ce qu'elle rend : les Chefs lus, le Plongeur ajouté, le nom absent perdu ; les deux écrans le montrent.
    for (const ecran of [premier, second]) assert.deepEqual(textes(ecran, ".valeur-pas"), ["2", "0", "0", "0", "1"]);
    const attendue = [{ nom: "Chef de partie", nombre: 2 }, { nom: "Plongeur", nombre: 1 }];
    assert.deepEqual(rencontre.rencontrePreparee(BANQUE), attendue);
    await attendreQue(async () => pareil(await gardeeDans(magasin), attendue), "la composition rejouée, écrite");
    assert.equal(lectures, 1);

    // Un oubli pendant la lecture : elle arrive, et ne pose rien ; la lecture d'après, avec la clé ressaisie, se fait.
    rencontre.oublier();
    const ouverte = contexteDe(BANQUE, { secret: SECRET_DEMO });
    const pendant = ouvrir(ouverte, "#/rencontre", services);
    const enCours = rencontre.charger(ouverte, services);
    await laisserFiler(5);
    assert.equal(lectures, 2);
    rencontre.oublier();
    liberer();
    assert.equal(await enCours, false);
    assert.deepEqual(textes(pendant, ".valeur-pas"), ["0", "0", "0", "0", "0"]);
    assert.deepEqual(rencontre.rencontrePreparee(BANQUE), []);
    const ressaisie = contexteDe(BANQUE, { secret: SECRET_DEMO });
    const apres = ouvrir(ressaisie, "#/rencontre", { magasin });
    assert.equal(await rencontre.charger(ressaisie, { magasin }), true);
    assert.deepEqual(textes(apres, ".valeur-pas"), ["2", "0", "0", "0", "1"]);
  }));

test("rencontre — un adversaire incomplet ou en erreur s'imprime quand même, et l'écran le signale", async () => {
  const banque = await banqueAvec([["Nu"], ["Cassé", "Commis/Spectre"], ["Sain", "Commis", _, _, _, _, _, "aucun"]]);
  await dansLeDocument(() => {
    const ecran = ouvrir(contexteDe(banque), "#/rencontre");
    ligneDe(ecran, "Sain").plus.click();
    assert.equal(ecran.querySelectorAll(".message").length, 0, "un adversaire sain ne signale rien");
    ligneDe(ecran, "Nu").plus.click();
    assert.deepEqual(textes(ecran, ".message"), ["À vérifier avant d'imprimer : Nu (incomplet, 1 erreur). Il s'imprime tel qu'il se résout."]);
    ligneDe(ecran, "Cassé").plus.click();
    ligneDe(ecran, "Cassé").plus.click();
    assert.deepEqual(textes(ecran, ".message"), ["À vérifier avant d'imprimer : Cassé (incomplet, 1 erreur), Nu (incomplet, 1 erreur). Ils s'impriment tels qu'ils se résolvent."]);
    assert.deepEqual(liens(ecran, ".message a"), [["Cassé", "#/adversaire/Cass%C3%A9"], ["Nu", "#/adversaire/Nu"]]);
    assert.deepEqual(cartesDe(ecran), ["Cassé n° 1", "Cassé n° 2", "Nu", "Sain"]);
    assert.equal(bouton(ecran, "Imprimer / PDF").disabled, false);
    ligneDe(ecran, "Nu").moins.click();
    ligneDe(ecran, "Cassé").moins.click();
    ligneDe(ecran, "Cassé").moins.click();
    assert.equal(ecran.querySelectorAll(".message").length, 0);
  });
});

// L'impression simulée : ce que la page demande, dans l'ordre.
function simulerImpression({ polices = true } = {}) {
  const journal = [];
  const avant = { print: globalThis.print, fonts: document.fonts };
  globalThis.print = () => journal.push("impression");
  if (polices) {
    document.fonts = {
      load: async (police) => {
        await laisserFiler(5);
        journal.push(`police ${police}`);
      },
      get ready() {
        return laisserFiler(5).then(() => journal.push("polices prêtes"));
      },
    };
  }
  journal.retirer = () => {
    if (avant.print === undefined) delete globalThis.print;
    else globalThis.print = avant.print;
  };
  return journal;
}

test("impression — « Imprimer / PDF » charge les trois faces de la police de la carte, puis imprime ; sans police, il imprime quand même", () =>
  dansLeDocument(async () => {
    const ATTENDU = ["police 11px 'EB Garamond'", "police 600 11px 'EB Garamond'", "police italic 11px 'EB Garamond'", "polices prêtes", "impression"];
    const contexte = contexteDe();
    // Depuis la rencontre.
    let journal = simulerImpression();
    try {
      const ecran = ouvrir(contexte, "#/rencontre");
      ligneDe(ecran, "Chef de partie").plus.click();
      await Promise.all(bouton(ecran, "Imprimer / PDF").click());
      assert.deepEqual([...journal].sort(), [...ATTENDU].sort());
      assert.deepEqual(journal.slice(-2), ["polices prêtes", "impression"], "les polices d'abord");
    } finally {
      journal.retirer();
    }
    // Depuis la fiche, en vue lecture : la seule carte de l'adversaire, sans numéro, même s'il est deux fois dans la rencontre.
    journal = simulerImpression();
    try {
      const racine = ouvrir(contexte, "#/adversaire/Chef%20de%20partie").querySelector(".ecran-adversaire");
      bouton(racine, "Ajouter à la rencontre").click();
      assert.equal(racine.className, "ecran-adversaire vue-lecture");
      await Promise.all(bouton(racine, "Imprimer / PDF").click());
      assert.deepEqual(journal.slice(-2), ["polices prêtes", "impression"]);
      assert.equal(journal.length, ATTENDU.length);
      assert.deepEqual(cartesDe(racine), ["Chef de partie"]);
      assert.equal(racine.querySelectorAll(".carte-numero").length, 0);
    } finally {
      journal.retirer();
    }
    // Un navigateur sans l'interface des polices : l'impression se fait avec celles de secours.
    journal = simulerImpression({ polices: false });
    try {
      document.fonts = undefined;
      await rencontre.imprimerCartes();
      assert.deepEqual([...journal], ["impression"]);
      document.fonts = { load: async () => { throw new Error("police refusée"); }, ready: Promise.resolve() };
      await rencontre.imprimerCartes();
      assert.deepEqual([...journal], ["impression", "impression"]);
    } finally {
      journal.retirer();
    }
  }));

test("fiche d'un adversaire — « Ajouter à la rencontre » dit ce qui s'y trouve déjà, jusqu'au plafond", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    const racine = ouvrir(contexte, "#/adversaire/Chef%20de%20partie").querySelector(".ecran-adversaire");
    const etat = () => texteDe(racine.querySelector("[role=status]"));
    const ajout = bouton(racine, "Ajouter à la rencontre");
    assert.equal(etat(), "Pas encore dans la rencontre.");
    ajout.click();
    assert.equal(etat(), "1 exemplaire dans la rencontre.");
    ajout.click();
    assert.equal(etat(), "2 exemplaires dans la rencontre.");
    assert.equal(bouton(racine, "Ajouter à la rencontre"), ajout, "le bouton n'est pas refait");
    // La rencontre les montre, numérotés.
    const choix = ouvrir(contexte, "#/rencontre");
    assert.equal(ligneDe(choix, "Chef de partie").valeur(), "2");
    assert.deepEqual(cartesDe(choix), ["Chef de partie n° 1", "Chef de partie n° 2"]);
    // La fiche rouverte le dit encore ; au plafond, le bouton s'arrête et dit pourquoi.
    const rouverte = ouvrir(contexte, "#/adversaire/Chef%20de%20partie").querySelector(".ecran-adversaire");
    assert.equal(texteDe(rouverte.querySelector("[role=status]")), "2 exemplaires dans la rencontre.");
    const encore = bouton(rouverte, "Ajouter à la rencontre");
    document.activeElement = encore;
    for (let i = 0; i < 9; i += 1) encore.click();
    assert.equal(document.activeElement, encore, "le focus reste sur le bouton tant qu'il sert");
    encore.click();
    assert.equal(encore.disabled, true);
    // Devenu inactif, le bouton perdrait le focus : il passe au lien de la rencontre.
    assert.equal(texteDe(document.activeElement), "Voir la rencontre");
    assert.equal(texteDe(rouverte.querySelector("[role=status]")), "12 exemplaires dans la rencontre : le plafond est atteint (12 exemplaires d'un adversaire, 60 cartes en tout).");
    assert.equal(rencontre.exemplaires(contexte.etat.banque, "Chef de partie"), 12);
    // Un autre adversaire n'en a aucun.
    assert.equal(texteDe(ouvrir(contexte, "#/adversaire/Plongeur").querySelector(".ecran-adversaire [role=status]")), "Pas encore dans la rencontre.");
  }));

// « Ajouter à la rencontre » écrit la composition entière : la fiche la lit
// donc d'abord, à sa première visite, sans que l'écran l'attende.
test("fiche d'un adversaire — elle lit la composition gardée à sa première visite, sans l'attendre, et redit ce qui s'y trouve ; son « Ajouter » écrit la composition entière", () =>
  dansLeDocument(async () => {
    rencontre.oublier();
    const ficheAdversaire = await import("../js/ecrans/fiche_adversaire.js");
    const magasin = magasinRencontreMemoire();
    await magasin.ecrire(await chiffrerRencontre([{ nom: "Chef de partie", nombre: 2 }, { nom: "Plongeur", nombre: 1 }], SECRET_DEMO, { mode: "demo" }));
    const contexte = contexteDe(BANQUE, { secret: SECRET_DEMO });
    const racine = ficheAdversaire.afficher(contexte, "Chef de partie", { magasin });
    document.body.replaceChildren(racine);
    const etat = () => texteDe(racine.querySelector("[role=status]"));
    // La fiche s'affiche sans attendre la lecture, puis la redit.
    assert.equal(etat(), "Pas encore dans la rencontre.");
    assert.equal(await rencontre.charger(contexte, { magasin }), true);
    assert.equal(etat(), "2 exemplaires dans la rencontre.");
    bouton(racine, "Ajouter à la rencontre").click();
    assert.equal(etat(), "3 exemplaires dans la rencontre.");
    await attendreQue(async () => pareil(await gardeeDans(magasin), [{ nom: "Chef de partie", nombre: 3 }, { nom: "Plongeur", nombre: 1 }]), "l'ajout de la fiche, gardé avec le reste");
    // L'écran Rencontre, ensuite, ne relit pas : il montre la même.
    assert.deepEqual(cartesDe(ouvrir(contexte, "#/rencontre", { magasin })), ["Chef de partie n° 1", "Chef de partie n° 2", "Chef de partie n° 3", "Plongeur"]);
  }));

test("sens de l'écriture — un nom qui porte U+202E s'affiche sans lui dans la liste, la rencontre, sa composition et ses cartes ; son adresse et le nom des boutons le gardent", async () => {
  const renverse = String.fromCodePoint(0x202e);
  const nom = `Chef${renverse} tournant`;
  const banque = await banqueAvec([[nom, "Commis"]]);
  await dansLeDocument(() => {
    const contexte = contexteDe(banque);
    const adresse = `#/adversaire/Chef%E2%80%AE%20tournant`;
    assert.deepEqual(liens(ouvrir(contexte, "#/adversaires"), ".liste-entrees a").map(([texte, href]) => [texte.startsWith("Chef tournant"), href]).filter(([, href]) => href === adresse), [[true, adresse]]);
    const choix = ouvrir(contexte, "#/rencontre");
    const ligne = ligneDe(choix, "Chef tournant");
    assert.equal(ligne.plus.getAttribute("aria-label"), `Ajouter un exemplaire de ${nom}`);
    ligne.plus.click();
    ligne.plus.click();
    // « 2 × Chef tournant » : sans le signe, le nombre et ce qui suit ne se lisent pas à l'envers.
    assert.equal(textes(choix, "p").some((texte) => texte === "2 × Chef tournant."), true, "la composition");
    assert.deepEqual(cartesDe(choix), ["Chef tournant n° 1", "Chef tournant n° 2"]);
    assert.equal(texteDe(choix).includes(renverse), false);
    // La fiche s'ouvre par son adresse exacte, et son titre n'a pas le signe non plus.
    const fiche = ouvrir(contexte, adresse);
    assert.equal(texteDe(fiche.querySelector(".panneau-fiche h1")), "Chef tournant");
    assert.equal(texteDe(fiche).includes(renverse), false);
  });
});

// ─── Les anomalies de la feuille ────────────────────────────────────────────

test("anomalies — l'adresse d'une ligne de la feuille Adversaires la met en avant, et mène à la fiche du type ou de l'adversaire", () =>
  dansLeDocument(() => {
    const contexte = contexteDe();
    let ecran = ouvrir(contexte, "#/anomalies/Adversaires/3");
    assert.deepEqual(textes(ecran, ".message"), ["1 anomalie sur la ligne 3 de la feuille Adversaires, mise en avant ci-dessous."]);
    const visees = [...ecran.querySelectorAll(".surlignee")];
    assert.equal(visees.length, 1);
    assert.match(texteDe(visees[0]), /^A1 · avertissement · Adversaires, ligne 3/);
    assert.deepEqual(liens(visees[0]), [["Voir la fiche « Rôtisseur »", "#/type/R%C3%B4tisseur"]]);
    ecran = ouvrir(contexte, "#/anomalies/Adversaires/8");
    assert.deepEqual(liens(ecran.querySelector(".surlignee")), [["Voir la fiche « Mouette chapardeuse »", "#/adversaire/Mouette%20chapardeuse"]]);
    assert.deepEqual(textes(ouvrir(contexte, "#/anomalies/Adversaires/99"), ".message"), ["Aucune anomalie sur la ligne 99 de la feuille Adversaires."]);
    // Les anomalies de la feuille viennent après celles des autres, dans chaque gravité.
    const feuilles = [...ouvrir(contexte, "#/anomalies").querySelectorAll(".anomalie.avertissement")].map((li) => texteDe(li.children[0]).split(" · ")[2].split(",")[0]);
    assert.deepEqual(feuilles.slice(-3), ["Adversaires", "Adversaires", "Adversaires"]);
    assert.equal(feuilles.indexOf("Adversaires"), feuilles.length - 3);
  }));

// ─── L'échelle de la carte ──────────────────────────────────────────────────
// (L'unique écriture de style du code se contrôle dans tests/echelle.test.js.)

test("échelle — la carte se tient à la largeur de l'écran, d'un téléphone de 360 px à un grand écran ; un seul papier écoute la fenêtre", () =>
  dansLeDocument(() => {
    const avant = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
    const ecoutes = [];
    let images = [];
    const peindre = () => {
      const dues = images;
      images = [];
      for (const f of dues) f();
    };
    globalThis.addEventListener = (type, f) => ecoutes.push([type, f]);
    globalThis.removeEventListener = (type, f) => ecoutes.splice(ecoutes.findIndex(([t, g]) => t === type && g === f), 1);
    globalThis.requestAnimationFrame = (f) => images.push(f);
    try {
      const contexte = contexteDe();
      const poses = [];
      // Le document simulé n'a ni style ni largeur : on les lui prête.
      const equiper = (ecran, largeur) => {
        const cadre = ecran.querySelector(".cadre-cartes");
        cadre.style = { setProperty: (nom, valeur) => poses.push([nom, Number(valeur)]) };
        cadre.parentNode.clientWidth = largeur;
        return cadre;
      };
      // Un téléphone de 360 px : 328 px une fois les marges de la page ôtées.
      let ecran = ouvrir(contexte, "#/adversaire/Chef%20de%20partie");
      let cadre = equiper(ecran, 328);
      assert.equal(cadre.parentNode.className, "ecran-adversaire vue-lecture", "la largeur mesurée est celle de la fiche");
      peindre();
      assert.deepEqual(poses.at(-1), ["--echelle", 328 / LARGEUR_CARTE]);
      assert.ok(poses.at(-1)[1] * LARGEUR_CARTE <= 328, "la carte ne dépasse pas l'écran");
      assert.deepEqual(ecoutes.map(([type]) => type), ["resize"]);
      // La fenêtre s'élargit : la carte reprend sa taille, sans la dépasser.
      cadre.parentNode.clientWidth = 736;
      ecoutes[0][1]();
      assert.deepEqual(poses.at(-1), ["--echelle", 1]);
      // Changer de vue fait mesurer de nouveau.
      cadre.parentNode.clientWidth = 400;
      bouton(ecran, "Vue carte").click();
      peindre();
      assert.deepEqual(poses.at(-1), ["--echelle", 400 / LARGEUR_CARTE]);

      // La rencontre remplace la fiche : un seul écouteur, le sien.
      const ancien = ecoutes[0][1];
      ecran = ouvrir(contexte, "#/rencontre");
      cadre = equiper(ecran, 600);
      assert.equal(cadre.parentNode, ecran);
      peindre();
      assert.deepEqual(ecoutes.map(([type]) => type), ["resize"]);
      assert.notEqual(ecoutes[0][1], ancien);
      assert.deepEqual(poses.at(-1), ["--echelle", 600 / LARGEUR_CARTE]);
      // Une mesure tardive de la fiche, partie de la page, ne retire pas l'écouteur de la rencontre.
      const avantLaMesure = poses.length;
      ancien();
      assert.equal(poses.length, avantLaMesure);
      assert.equal(ecoutes.length, 1);
      // Chaque carte ajoutée fait mesurer de nouveau : la page s'allonge.
      cadre.parentNode.clientWidth = 585;
      ligneDe(ecran, "Plongeur").plus.click();
      peindre();
      assert.deepEqual(poses.at(-1), ["--echelle", 585 / LARGEUR_CARTE]);
      // L'écran quitté : à la première mesure, son écouteur se retire.
      document.body.replaceChildren();
      ecoutes[0][1]();
      assert.deepEqual(ecoutes, []);
      // Trois fiches de suite : toujours un seul écouteur.
      for (const nom of ["Plongeur", "Homard%20furieux", "Chef%20de%20partie"]) ouvrir(contexte, `#/adversaire/${nom}`);
      assert.deepEqual(ecoutes.map(([type]) => type), ["resize"]);
    } finally {
      Object.assign(globalThis, { addEventListener: avant.add, removeEventListener: avant.remove, requestAnimationFrame: avant.raf });
    }
  }));

// ─── Les règles d'écran, lues comme un texte ────────────────────────────────

test("ecran.css — le cadre des cartes n'est masqué qu'à l'écran, l'impression le rétablit ; les cibles tactiles ; rien ne déborde", () => {
  const css = lire("css/ecran.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const bloc = (cadre) => {
    const debut = css.indexOf(`${cadre} {`);
    assert.notEqual(debut, -1, cadre);
    return css.slice(debut, css.indexOf("\n}", debut) + 2);
  };
  const ecran = bloc("@media screen");
  const impression = bloc("@media print");
  // En vue lecture, la carte reste mise en page : invisible et sans hauteur, jamais retirée.
  assert.match(ecran, /\.ecran-adversaire\.vue-lecture \.cadre-cartes \{\s*height: 0;\s*overflow: hidden;\s*visibility: hidden;\s*\}/);
  assert.match(ecran, /\.ecran-adversaire\.vue-carte \.lectures-adversaire \{\s*display: none;\s*\}/);
  // Sur un grand écran, la carte puis la lecture se montrent ensemble, quelle que soit la vue, et le choix d'une vue disparaît :
  // chaque valeur dit d'où elle vient dès l'ouverture (mission, § 8).
  const grand = bloc("@media screen and (min-width: 56rem)");
  assert.match(grand, /\.ecran-adversaire \.choix-vue \{\s*display: none;\s*\}/);
  assert.match(grand, /\.ecran-adversaire\.vue-lecture \.cadre-cartes,\s*\.ecran-adversaire\.vue-carte \.cadre-cartes \{\s*order: 1;\s*height: auto;\s*margin-bottom: var\(--espace-4\);\s*overflow: auto;\s*visibility: visible;\s*\}/);
  assert.match(grand, /\.ecran-adversaire\.vue-lecture \.lectures-adversaire,\s*\.ecran-adversaire\.vue-carte \.lectures-adversaire \{\s*display: block;\s*order: 2;\s*\}/);
  assert.match(grand, /\.ecran-adversaire \{\s*display: flex;\s*flex-direction: column;\s*\}/);
  // Hors de @media screen, rien ne masque le cadre : masqué à l'impression, il sortirait une page vide.
  const horsEcran = css.replace(ecran, "").replace(grand, "");
  assert.doesNotMatch(horsEcran, /cadre-cartes[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden|height:\s*0)/);
  assert.match(impression, /\.cadre-cartes \{\s*display: block !important;\s*height: auto !important;\s*max-width: none !important;\s*overflow: visible !important;\s*visibility: visible !important;\s*\}/);
  // La liste ne s'imprime pas : la fiche prend la page.
  assert.match(impression, /\.consultation \{\s*display: block;\s*\}/);
  // Tant que l'échelle n'est pas posée, c'est le cadre qui défile, pas la page.
  assert.match(horsEcran, /\.cadre-cartes \{\s*max-width: 100%;\s*overflow-x: auto;\s*\}/);
  // Les boutons + et −, et les lignes de la vue lecture : 44 px au moins.
  assert.match(lire("css/jetons.css"), /--cible-tactile: 44px;/);
  assert.match(css, /\.bouton-pas \{\s*min-width: var\(--cible-tactile\);\s*min-height: var\(--cible-tactile\);/);
  assert.match(css, /\.lecture-liste li \{[^}]*min-height: var\(--cible-tactile\);/);
  assert.match(css, /\.nom-rencontre a \{[^}]*min-height: var\(--cible-tactile\);/);
  // Le lien seul dans sa ligne (un type) se touche sur toute la hauteur de la ligne.
  assert.match(css, /\.lecture-liste li > a \{[^}]*min-height: var\(--cible-tactile\);/);
  // Rien ne fait défiler la page de côté : un nom d'un seul mot très long se replie, la rubrique d'une grille trop large
  // défile seule, et les faces d'une zone ne se coupent pas en deux lignes.
  assert.match(css, /\.nom-rencontre a \{[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /\.lecture-section:has\(> \.lecture-zones\) \{\s*overflow-x: auto;\s*\}/);
  assert.match(css, /\.lecture-zones \.lecture-faces \{\s*white-space: nowrap;\s*\}/);
  assert.match(css, /\.barre-rencontre,\s*\.barre-publication \{\s*position: sticky;\s*bottom: 0;/);
  // Aucune classe de la carte n'est nommée ici : la carte est du papier, dans sa feuille.
  assert.doesNotMatch(css, /\.cartes?-adversaires?\b|\.carte-(?!personnage\b)[a-z]/);
  // La provenance ne se lit qu'à l'écran : la carte, qui s'imprime, n'en a ni la classe ni la fonction.
  assert.match(css, /\.provenance \{/);
  assert.doesNotMatch(lire("js/adversaire/carte.js").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), /provenance|ecrireOrigine/);
  assert.doesNotMatch(lire("css/adversaire.css").replace(/\/\*[\s\S]*?\*\//g, ""), /provenance/);
});
