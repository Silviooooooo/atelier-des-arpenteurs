// Contrôles des lectures d'un protagoniste et des circonstances d'un jet
// (SPECIFICATION.md, § 17 et § 11, domaine « Combat ») : js/combat/valeurs.js
// et js/combat/circonstances.js.
//
// Chaque règle est vue dans les deux sens : elle s'applique, puis, à une
// retouche près (une case, un allié, un mort, un niveau, un mode), elle ne
// s'applique plus. Les dix lignes de sources d'avantage et de désavantage et
// les sept modificateurs sont pris un par un, puis ensemble, pour leur ordre.
//
// Les états sont écrits à la main (tests/outils/photographies_essai.js), sans
// le moteur ; les gestes aussi, d'après la forme du § 17. Les cas calculés à
// la main du combat de référence fictif servent de témoins : Aubépine
// Crèmebrûlée contre le Chef de partie et deux Marmitons de corvée.
//
// Au groupe 2 (contrat du groupe, § 5.4, § 5.5 et § 14, N4) : le rôle et
// l'indice de capacité d'une source de passif ; les causes sans cible du
// survol (sourcesSansCible) ; la défense à égalité de dés, au choix du joueur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { circonstances, modificateursDe, passifsDe, sourcesSansCible } from "../js/combat/circonstances.js";
import { modificateurDe, netDe, ouvrirJet } from "../js/combat/jet.js";
import { DIFFICULTES, ROLES_PASSIFS, SIGNES, geler } from "../js/combat/regles.js";
import { TYPES_OBJET } from "../js/personnage/regles.js";
import {
  aJoue,
  alliesSurLaCase,
  attaqueDe,
  blessuresDe,
  campDe,
  capaciteDe,
  courantDe,
  defenseDe,
  faconDe,
  gesteEnCours,
  photoDe,
  vivant,
  vivantsDe,
} from "../js/combat/valeurs.js";
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

// ─── Les outils ─────────────────────────────────────────────────────────────

// Un geste au moment de sa préparation, tel que le moteur le tient (§ 17).
// Il est gelé : une règle qui le modifierait lèverait.
function gesteEssai(champs = {}) {
  return geler({
    numero: 1,
    acteur: "pj1",
    capacite: 0,
    facon: 0,
    mode: "attaque",
    moment: "preparation",
    paye: false,
    prix: null,
    cible: null,
    arrivee: null,
    depart: null,
    x: 0,
    jauge: null,
    caracteristiques: null,
    difficulte: null,
    armePretee: null,
    defense: null,
    reglages: { modificateur: null, avantages: null },
    jet: null,
    degats: null,
    localisation: [],
    interventions: [],
    resultat: null,
    parent: null,
    ...champs,
  });
}

// L'indice d'une capacité, retrouvée par son nom : jamais un indice écrit.
function indiceDe(etat, id, nom) {
  const indice = photoDe(etat, id).capacites.findIndex((capacite) => capacite.nom === nom);
  assert.notEqual(indice, -1, `« ${nom} » n'est pas une capacité de ${id}`);
  return indice;
}

// Le geste d'un protagoniste qui joue une capacité nommée.
const joue = (etat, acteur, nom, champs = {}) => gesteEssai({ acteur, capacite: indiceDe(etat, acteur, nom), ...champs });

const sansRetouche = () => {};

// Une alliée d'Aubépine, et un second adversaire : chacun a son nom.
const brioche = (retoucher = sansRetouche) =>
  pjEssai((valeurs) => {
    valeurs.identifiant = "essai-brioche-0000000002";
    valeurs.nom = "Brioche";
    retoucher(valeurs);
  });
const commis = (retoucher = sansRetouche) =>
  adversaireEssai((valeurs) => {
    valeurs.nom = "Commis";
    retoucher(valeurs);
  });

/**
 * Aubépine (pj1) face à Marmiton (adv2), sur la même case par défaut ; puis
 * « autres », dont l'identifiant suit leur rang (pj3, adv3, adv4…).
 */
function duel({ pj = sansRetouche, adv = sansRetouche, casePj = "D4", caseAdv = "D4", autres = [], retoucher = sansRetouche, noms = {} } = {}) {
  const protagonistes = [{ photo: pjEssai(pj), case: casePj }, { photo: adversaireEssai(adv), case: caseAdv }, ...autres];
  return etatEssai(miseEnPlaceEssai(protagonistes), { retoucher, noms });
}

const tuer = (...ids) => (etat) => {
  for (const id of ids) {
    etat.protagonistes[id].corps = 0;
    etat.protagonistes[id].mort = { tour: 1 };
  }
};

// Le PJ attaque (Frappe, dans sa maîtrise) ; l'adversaire attaque (Frappe).
const attaqueDuPj = (etat, champs = {}) => circonstances(etat, joue(etat, "pj1", "Frappe", { cible: "adv2", ...champs }));
const attaqueDeLAdversaire = (etat, champs = {}) => circonstances(etat, joue(etat, "adv2", "Frappe", { cible: "pj1", ...champs }));

const passif = (role, nom, niveau = 1) => (valeurs) => {
  ajouterPassif(valeurs, { role, niveau, nom });
};
const ensemble = (...retouches) => (valeurs) => {
  for (const retouche of retouches) retouche(valeurs);
};

const CLES = ["genre", "lanceur", "faces", "caracteristiques", "mobilisees", "difficulte", "libelle", "modificateurs", "avantages", "desavantages"];

// Les modules qu'un fichier du noyau importe, lus dans son texte.
function importsDe(fichier) {
  const texte = readFileSync(new URL(`../js/combat/${fichier}`, import.meta.url), "utf8");
  return [...texte.matchAll(/^import\s[^;]*?\sfrom\s+"([^"]+)";/gm)].map((trouve) => trouve[1]).sort();
}

// Les signes qu'un fichier du dépôt ne porte jamais tels quels : les espaces
// insécables et les signes de format invisibles, fabriqués ici par leur code.
const de = (debut, fin) => `${String.fromCodePoint(debut)}-${String.fromCodePoint(fin)}`;
const INTERDITS = new RegExp(`[${[0xad, 0xa0, 0x202f, 0xfeff].map((code) => String.fromCodePoint(code)).join("")}${de(0x200b, 0x200f)}${de(0x202a, 0x202e)}${de(0x2060, 0x2064)}${de(0x2066, 0x2069)}]`, "u");

// Le commentaire qui ouvre un fichier : ses premières lignes, tant qu'elles
// commencent par « // ».
function enTeteDe(texte) {
  const lignes = texte.split(/\r?\n/);
  const fin = lignes.findIndex((ligne) => !ligne.startsWith("//"));
  return lignes.slice(0, fin === -1 ? lignes.length : fin);
}

// ─── valeurs.js : le geste en cours ─────────────────────────────────────────

test("gesteEnCours : null entre deux gestes, sinon le sommet de la pile", () => {
  const etat = duel();
  assert.equal(gesteEnCours(etat), null);
  const premier = gesteEssai({ numero: 3 });
  const second = gesteEssai({ numero: 7 });
  assert.equal(gesteEnCours({ ...etat, pile: [premier] }), premier);
  assert.equal(gesteEnCours({ ...etat, pile: [premier, second] }), second, "le dernier empilé, pas le premier");
});

test("valeurs.js n'importe rien : l'offre, le journal et les vues y lisent le geste sans cycle", () => {
  assert.deepEqual(importsDe("valeurs.js"), []);
});

test("circonstances.js n'importe que ce que le noyau lui permet", () => {
  assert.deepEqual(importsDe("circonstances.js"), ["../personnage/regles.js", "./plateau.js", "./regles.js", "./valeurs.js"]);
});

test("valeurs.js et circonstances.js exportent ce que dit le contrat, sans un nom de plus", async () => {
  assert.deepEqual(Object.keys(await import("../js/combat/valeurs.js")).sort(), [
    "aJoue",
    "alliesSurLaCase",
    "attaqueDe",
    "blessuresDe",
    "campDe",
    "capaciteDe",
    "courantDe",
    "defenseDe",
    "faconDe",
    "gesteEnCours",
    "photoDe",
    "vivant",
    "vivantsDe",
  ]);
  assert.deepEqual(Object.keys(await import("../js/combat/circonstances.js")).sort(), ["circonstances", "modificateursDe", "passifsDe", "sourcesSansCible"]);
});

test("valeurs.js et circonstances.js : un en-tête qui dit le pourquoi et le § 17 ; ni espace insécable, ni signe invisible", () => {
  for (const fichier of ["../js/combat/valeurs.js", "../js/combat/circonstances.js", "./combat_circonstances.test.js"]) {
    const texte = readFileSync(new URL(fichier, import.meta.url), "utf8");
    const enTete = enTeteDe(texte);
    assert.ok(enTete.some((ligne) => ligne.includes("SPECIFICATION.md")) && enTete.some((ligne) => ligne.includes("§ 17")), `${fichier} : l'en-tête cite le § 17 de la spécification`);
    assert.ok(enTete.length >= 4, `${fichier} : l'en-tête dit ce que fait le fichier, et pourquoi`);
    assert.equal(INTERDITS.test(texte), false, `${fichier} : un signe invisible ou une espace insécable`);
  }
  assert.equal(INTERDITS.test(`a${String.fromCodePoint(0x200b)}b`), true, "le motif voit un signe invisible");
  assert.equal(INTERDITS.test(`a${String.fromCodePoint(0x202f)}b`), true, "et une espace insécable");
});

// ─── valeurs.js : un protagoniste ───────────────────────────────────────────

test("photoDe, courantDe, campDe : ce qui ne bouge pas, ce qui bouge, le camp", () => {
  const etat = duel({ casePj: "C3" });
  assert.equal(photoDe(etat, "pj1"), etat.photos.pj1, "les valeurs de la photographie, par référence");
  assert.equal(photoDe(etat, "pj1").nom, "Aubépine");
  assert.equal(courantDe(etat, "adv2"), etat.protagonistes.adv2);
  assert.equal(courantDe(etat, "pj1").case, "C3");
  assert.equal(campDe(etat, "pj1"), "pj");
  assert.equal(campDe(etat, "adv2"), "adv");
});

test("un identifiant inconnu ou piégé ne lève pas : null, faux, zéro, une liste vide", () => {
  const etat = duel();
  for (const id of ["adv9", "", "constructor", "__proto__", "toString", null, undefined, 3, {}]) {
    assert.equal(photoDe(etat, id), null, `photoDe(${String(id)})`);
    assert.equal(courantDe(etat, id), null, `courantDe(${String(id)})`);
    assert.equal(campDe(etat, id), null);
    assert.equal(vivant(etat, id), false);
    assert.equal(aJoue(etat, id), true, "qui n'est pas dans le combat n'a rien à jouer");
    assert.deepEqual(attaqueDe(etat, id), { valeur: null, base: null, ecarts: [] });
    assert.deepEqual(defenseDe(etat, id), { valeur: null, base: null, ecarts: [] });
    assert.equal(blessuresDe(etat, id), 0);
    assert.deepEqual(alliesSurLaCase(etat, id), []);
    assert.equal(capaciteDe(etat, id, 0), null);
    assert.deepEqual(passifsDe(etat, id), []);
    assert.deepEqual(modificateursDe(etat, id, { genre: "attaque", mobilisees: ["force"] }), []);
    assert.deepEqual(sourcesSansCible(etat, id, 0, 0), { avantages: [], desavantages: [] });
  }
});

test("vivant, vivantsDe : un mort n'est plus compté ; l'ordre est celui de l'ajout", () => {
  const autres = [{ photo: commis(), case: "E5" }, { photo: brioche(), case: "A1" }, { photo: commis(), case: "E5" }];
  const tous = duel({ autres });
  assert.deepEqual(vivantsDe(tous, "pj"), ["pj1", "pj4"]);
  assert.deepEqual(vivantsDe(tous, "adv"), ["adv2", "adv3", "adv5"]);
  assert.equal(vivant(tous, "adv3"), true);

  const apres = duel({ autres, retoucher: tuer("adv3", "pj1") });
  assert.equal(vivant(apres, "adv3"), false);
  assert.deepEqual(vivantsDe(apres, "adv"), ["adv2", "adv5"]);
  assert.deepEqual(vivantsDe(apres, "pj"), ["pj4"]);
  assert.deepEqual(vivantsDe(apres, "arbitre"), [], "un camp qui n'existe pas n'a personne");
});

test("aJoue : plus d'action, ou tour passé ; sinon non", () => {
  const frais = duel();
  assert.equal(aJoue(frais, "pj1"), false, "2 actions, n'a pas passé");
  const uneAction = duel({ retoucher: (etat) => { etat.protagonistes.pj1.actions = 1; } });
  assert.equal(aJoue(uneAction, "pj1"), false, "il lui reste une action");
  const sansAction = duel({ retoucher: (etat) => { etat.protagonistes.pj1.actions = 0; } });
  assert.equal(aJoue(sansAction, "pj1"), true);
  const passe = duel({ retoucher: (etat) => { etat.protagonistes.pj1.passe = true; } });
  assert.equal(aJoue(passe, "pj1"), true, "passer : ses actions restantes ne servent plus à ce tour");
  assert.equal(aJoue(passe, "adv2"), false, "passer ne vaut que pour celui qui passe");
});

test("attaqueDe, defenseDe : les nombres courants d'un adversaire, jamais ceux de sa photographie ; null pour un PJ", () => {
  const etat = duel();
  assert.deepEqual(attaqueDe(etat, "adv2"), { valeur: 4, base: 4, ecarts: [] });
  assert.deepEqual(defenseDe(etat, "adv2"), { valeur: 5, base: 5, ecarts: [] });
  assert.deepEqual(attaqueDe(etat, "pj1"), { valeur: null, base: null, ecarts: [] }, "l'attaque d'un PJ est un dé");
  assert.deepEqual(defenseDe(etat, "pj1"), { valeur: null, base: null, ecarts: [] });

  const change = duel({ retoucher: (courant) => { courant.protagonistes.adv2.attaque = 6; courant.protagonistes.adv2.defense = 3; } });
  assert.equal(change.photos.adv2.attaque, 4, "la photographie n'a pas bougé");
  assert.equal(attaqueDe(change, "adv2").valeur, 6);
  assert.equal(defenseDe(change, "adv2").valeur, 3);
});

test("blessuresDe : une par zone dont l'endurance est à 0", () => {
  assert.equal(blessuresDe(duel(), "pj1"), 0);
  const entamee = duel({ retoucher: (etat) => { etat.protagonistes.pj1.zones[2].resistance = 1; etat.protagonistes.pj1.zones[2].armure = 0; } });
  assert.equal(blessuresDe(entamee, "pj1"), 0, "une endurance entamée, ou une armure à 0, ne sont pas une blessure");
  const une = duel({ retoucher: (etat) => { etat.protagonistes.pj1.zones[2].resistance = 0; } });
  assert.equal(blessuresDe(une, "pj1"), 1);
  assert.equal(blessuresDe(une, "adv2"), 0, "chacun les siennes");
  const deux = duel({ retoucher: (etat) => { etat.protagonistes.pj1.zones[2].resistance = 0; etat.protagonistes.pj1.zones[4].resistance = 0; } });
  assert.equal(blessuresDe(deux, "pj1"), 2);
});

test("alliesSurLaCase : les vivants de son camp sur sa case, autres que lui, dans l'ordre d'ajout", () => {
  const autres = [{ photo: brioche(), case: "D4" }, { photo: commis(), case: "D4" }, { photo: brioche((valeurs) => { valeurs.nom = "Chouquette"; valeurs.identifiant = "essai-chouquette-00000003"; }), case: "D4" }];
  const etat = duel({ autres });
  assert.deepEqual(alliesSurLaCase(etat, "pj1"), ["pj3", "pj5"], "ni lui-même, ni les adversaires de la case");
  assert.deepEqual(alliesSurLaCase(etat, "pj3"), ["pj1", "pj5"]);
  assert.deepEqual(alliesSurLaCase(etat, "adv2"), ["adv4"]);

  const ailleurs = duel({ autres: [{ photo: brioche(), case: "D5" }] });
  assert.deepEqual(alliesSurLaCase(ailleurs, "pj1"), [], "la case voisine n'est pas sa case");

  const morte = duel({ autres, retoucher: tuer("pj3") });
  assert.deepEqual(alliesSurLaCase(morte, "pj1"), ["pj5"], "une morte n'est l'alliée de personne");
});

test("capaciteDe, faconDe : par indice ; ce qui n'existe pas est null", () => {
  const etat = duel();
  const pas = indiceDe(etat, "pj1", "Pas chassé");
  assert.equal(capaciteDe(etat, "pj1", pas).nom, "Pas chassé");
  assert.equal(faconDe(etat, gesteEssai({ capacite: pas, facon: 1 })).puissance, 2);
  assert.equal(faconDe(etat, gesteEssai({ capacite: pas, facon: 0 })).puissance, 1);

  for (const indice of [-1, 99, 1.5, "0", null, undefined, "length"]) {
    assert.equal(capaciteDe(etat, "pj1", indice), null, `capacité ${String(indice)}`);
    assert.equal(faconDe(etat, gesteEssai({ capacite: pas, facon: indice })), null, `façon ${String(indice)}`);
  }
  // La borne même : le premier indice après la fin n'est déjà plus personne.
  const capacites = photoDe(etat, "pj1").capacites;
  assert.equal(capaciteDe(etat, "pj1", capacites.length), null, "l'indice d'après la dernière capacité");
  assert.equal(capaciteDe(etat, "pj1", capacites.length - 1), capacites[capacites.length - 1], "la dernière capacité, elle, existe");
  assert.equal(faconDe(etat, gesteEssai({ capacite: pas, facon: capacites[pas].facons.length })), null, "l'indice d'après la dernière façon");
  assert.equal(faconDe(etat, gesteEssai({ capacite: 99 })), null);
  assert.equal(faconDe(etat, gesteEssai({ acteur: "adv9" })), null);
  assert.equal(faconDe(etat, null), null);
});

// ─── Qui lance, quel dé, contre quoi ────────────────────────────────────────

test("attaque d'un PJ : il lance le dé de son arme contre la défense de sa cible", () => {
  const etat = duel();
  const rendu = attaqueDuPj(etat);
  assert.deepEqual(rendu, {
    genre: "attaque",
    lanceur: "pj1",
    faces: 8,
    caracteristiques: null,
    mobilisees: ["precision", "agilite"],
    difficulte: 5,
    libelle: null,
    modificateurs: [],
    avantages: [],
    desavantages: [],
  });
  assert.deepEqual(Object.keys(rendu), CLES);
  assert.deepEqual(Object.keys(ouvrirJet(rendu)), [...CLES, "attente", "places"], "de quoi ouvrir le jet, tel quel");
});

test("attaque d'un PJ : le dé suit l'arme, la difficulté suit la défense courante de la cible", () => {
  const lourde = duel({ pj: (valeurs) => { valeurs.armes[0].faces = 12; valeurs.armes[0].caracteristiques = ["force", "precision"]; } });
  assert.equal(attaqueDuPj(lourde).faces, 12);
  assert.deepEqual(attaqueDuPj(lourde).mobilisees, ["force", "precision"]);

  const affaibli = duel({ retoucher: (etat) => { etat.protagonistes.adv2.defense = 3; } });
  assert.equal(attaqueDuPj(affaibli).difficulte, 3, "la défense se lit dans l'état courant");
  assert.equal(attaqueDuPj(duel({ adv: (valeurs) => { valeurs.defense = 7; } })).difficulte, 7);
});

test("attaque : sans cible, ou contre quelqu'un de son camp, il manque une cible", () => {
  const etat = duel({ autres: [{ photo: brioche(), case: "D4" }] });
  const manque = { manque: "Choisissez une cible." };
  assert.deepEqual(attaqueDuPj(etat, { cible: null }), manque);
  assert.deepEqual(attaqueDuPj(etat, { cible: "pj3" }), manque, "une alliée n'est pas la cible d'une attaque");
  assert.deepEqual(attaqueDuPj(etat, { cible: "pj1" }), manque);
  assert.deepEqual(attaqueDuPj(etat, { cible: "adv9" }), manque);
  assert.deepEqual(attaqueDeLAdversaire(etat, { cible: null }), manque);
  assert.equal(attaqueDuPj(etat).manque, undefined, "avec une cible adverse, rien ne manque");
});

test("attaque : contre quelqu'un de son camp, c'est la cible qui manque, avant tout choix de dé", () => {
  // À mains nues, le dé reste à choisir : la phrase ne doit pas demander des
  // caractéristiques pour une attaque qui n'a pas de cible adverse.
  const etat = duel({ autres: [{ photo: brioche(), case: "D4" }] });
  const taloche = (champs) => circonstances(etat, joue(etat, "pj1", "Taloche", champs));
  assert.deepEqual(taloche({ cible: "pj3", caracteristiques: null }), { manque: "Choisissez une cible." }, "une alliée, sans caractéristique choisie");
  assert.deepEqual(taloche({ cible: "pj1", caracteristiques: null }), { manque: "Choisissez une cible." }, "elle-même");
  assert.deepEqual(taloche({ cible: "adv2", caracteristiques: null }), { manque: "Choisissez une ou deux caractéristiques." }, "contre un adversaire, il ne manque que le dé");
});

test("attaque à mains nues : le dé se fait d'une ou deux caractéristiques, choisies au moment du jet", () => {
  const etat = duel({ pj: (valeurs) => { valeurs.caracteristiques.force = 5; valeurs.caracteristiques.sens = 3; } });
  const taloche = (caracteristiques) => circonstances(etat, joue(etat, "pj1", "Taloche", { cible: "adv2", caracteristiques }));

  assert.deepEqual(taloche(null), { manque: "Choisissez une ou deux caractéristiques." });
  assert.deepEqual(taloche([]), { manque: "Choisissez une ou deux caractéristiques." });
  assert.deepEqual(taloche(["force", "agilite", "sens"]), { manque: "Choisissez une ou deux caractéristiques." });

  const deux = taloche(["force", "agilite"]);
  assert.equal(deux.faces, 8, "5 + 4 = 9, arrondi au pair inférieur");
  assert.deepEqual(deux.caracteristiques, ["force", "agilite"]);
  assert.deepEqual(deux.mobilisees, ["force", "agilite"]);
  assert.equal(deux.genre, "attaque");
  assert.equal(deux.difficulte, 5);

  const forte = taloche(["force"]);
  assert.equal(forte.faces, 10, "le double d'une seule : 5 + 5");
  assert.deepEqual(forte.caracteristiques, ["force"]);
  assert.deepEqual(forte.mobilisees, ["force"]);
  assert.equal(taloche(["sens"]).faces, 6, "3 + 3");
  assert.equal(taloche(["sens", "force"]).faces, 8, "3 + 5");

  assert.deepEqual(taloche(["malice"]), { manque: "Ces caractéristiques ne donnent aucun dé." }, "une caractéristique inconnue ne fait pas un dé");
});

test("une arme au dé fixe ne demande aucune caractéristique, et n'écoute pas celles qu'on lui donnerait", () => {
  const etat = duel();
  const rendu = attaqueDuPj(etat, { caracteristiques: ["force"] });
  assert.equal(rendu.faces, 8);
  assert.equal(rendu.caracteristiques, null);
  assert.deepEqual(rendu.mobilisees, ["precision", "agilite"]);
});

test("une attaque que ne donne aucune arme : son dé se choisit comme à mains nues", () => {
  const etat = duel({
    pj: (valeurs) => {
      valeurs.capacites.push(capaciteEssai({ nom: "Jet de sel", facons: [faconEssai({ arme: null, attaque: true, degats: [1, 2, 3], elements: ["Dégâts"] })] }));
    },
  });
  const sel = (caracteristiques) => circonstances(etat, joue(etat, "pj1", "Jet de sel", { cible: "adv2", caracteristiques }));
  assert.deepEqual(sel(null), { manque: "Choisissez une ou deux caractéristiques." });
  assert.equal(sel(["precision", "sens"]).faces, 8);
  assert.deepEqual(sel(["precision", "sens"]).caracteristiques, ["precision", "sens"]);
});

test("attaque d'un adversaire : le PJ visé lance sa défense contre l'attaque de l'adversaire", () => {
  const etat = duel();
  const rendu = attaqueDeLAdversaire(etat);
  assert.deepEqual(rendu, {
    genre: "defense",
    lanceur: "pj1",
    faces: 8,
    caracteristiques: null,
    mobilisees: ["agilite", "creativite"],
    difficulte: 4,
    libelle: null,
    modificateurs: [],
    avantages: [],
    desavantages: [],
  });
  assert.deepEqual(Object.keys(rendu), CLES);
});

test("attaque d'un adversaire : le dé suit la défense du PJ visé, la difficulté suit l'attaque courante", () => {
  const lourde = duel({ pj: (valeurs) => { valeurs.deDefense = { faces: 10, type: "lourde", caracteristiques: ["force", "sens"], meles: false, egalite: [] }; } });
  assert.equal(attaqueDeLAdversaire(lourde).faces, 10);
  assert.deepEqual(attaqueDeLAdversaire(lourde).mobilisees, ["force", "sens"]);

  const enrage = duel({ retoucher: (etat) => { etat.protagonistes.adv2.attaque = 7; } });
  assert.equal(attaqueDeLAdversaire(enrage).difficulte, 7, "l'attaque se lit dans l'état courant");

  const deux = duel({ autres: [{ photo: brioche((valeurs) => { valeurs.deDefense.faces = 6; }), case: "D4" }] });
  const versBrioche = circonstances(deux, joue(deux, "adv2", "Frappe", { cible: "pj3" }));
  assert.equal(versBrioche.lanceur, "pj3", "c'est le PJ visé qui lance, pas un autre");
  assert.equal(versBrioche.faces, 6);
});

test("jet de caractéristique : un dé au choix contre la difficulté choisie, avec le libellé du livret", () => {
  const etat = duel({ pj: (valeurs) => { valeurs.caracteristiques.sens = 3; valeurs.caracteristiques.savoir_sauvage = 3; } });
  const gouter = (champs) => circonstances(etat, joue(etat, "pj1", "Goûter", { mode: "caracteristique", ...champs }));

  assert.deepEqual(gouter({}), { manque: "Choisissez une ou deux caractéristiques." });
  assert.deepEqual(gouter({ caracteristiques: ["sens", "savoir_sauvage"] }), { manque: "Choisissez une difficulté." });
  for (const difficulte of [1, 11, 0, 6.5, "6", null]) {
    assert.deepEqual(gouter({ caracteristiques: ["sens"], difficulte }), { manque: "Choisissez une difficulté." }, `difficulté ${String(difficulte)}`);
  }

  const rendu = gouter({ caracteristiques: ["sens", "savoir_sauvage"], difficulte: 6 });
  assert.deepEqual(rendu, {
    genre: "caracteristique",
    lanceur: "pj1",
    faces: 6,
    caracteristiques: ["sens", "savoir_sauvage"],
    mobilisees: ["sens", "savoir_sauvage"],
    difficulte: 6,
    libelle: "compliqué",
    modificateurs: [],
    avantages: [],
    desavantages: [],
  });
  assert.deepEqual(Object.keys(rendu), CLES);

  for (const difficulte of [2, 5, 10]) {
    const autre = gouter({ caracteristiques: ["parole"], difficulte });
    assert.equal(autre.difficulte, difficulte);
    assert.equal(autre.libelle, DIFFICULTES[difficulte]);
    assert.equal(autre.faces, 8, "le double d'une seule : 4 + 4");
  }
});

test("jet de caractéristique : il n'a pas de cible, et un adversaire n'en lance pas", () => {
  const etat = duel({ adv: (valeurs) => { valeurs.capacites.push(capaciteEssai({ nom: "Goûter", role: "jet_de_caracteristique", groupe: { genre: "capacites", titre: "Capacités" } })); } });
  const duPj = circonstances(etat, joue(etat, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["sens"], difficulte: 4, cible: "adv2" }));
  assert.equal(duPj.difficulte, 4, "la difficulté est la sienne, pas la défense de quiconque");
  assert.equal(duPj.genre, "caracteristique");
  const deLAdversaire = circonstances(etat, joue(etat, "adv2", "Goûter", { mode: "caracteristique", caracteristiques: ["sens"], difficulte: 4 }));
  assert.deepEqual(deLAdversaire, { manque: "Seul un personnage lance un jet de caractéristique." });
});

test("jet prêté d'un PJ : le dé de l'arme prêtée, contre la défense de la cible", () => {
  const etat = duel();
  const prete = (champs) => circonstances(etat, joue(etat, "pj1", "Flambage", { mode: "jet_prete", cible: "adv2", ...champs }));

  const couteau = prete({ armePretee: 0 });
  assert.equal(couteau.genre, "attaque");
  assert.equal(couteau.lanceur, "pj1");
  assert.equal(couteau.faces, 8);
  assert.equal(couteau.caracteristiques, null);
  assert.deepEqual(couteau.mobilisees, ["precision", "agilite"]);
  assert.equal(couteau.difficulte, 5);

  assert.deepEqual(prete({ armePretee: 1 }), { manque: "Choisissez une ou deux caractéristiques." }, "les mains nues prêtent un dé au choix");
  assert.deepEqual(prete({ armePretee: 1, caracteristiques: ["force"] }).caracteristiques, ["force"]);
  assert.deepEqual(prete({ armePretee: null }), { manque: "Choisissez une ou deux caractéristiques." }, "sans arme à prêter, le dé est au choix");
  assert.equal(prete({ armePretee: null, caracteristiques: ["sens", "parole"] }).faces, 8);
  assert.deepEqual(prete({ armePretee: 0, cible: null }), { manque: "Choisissez une cible." });
});

test("jet prêté d'un adversaire : c'est encore le PJ visé qui lance sa défense, avec ou sans arme", () => {
  const etat = duel();
  for (const armePretee of [0, null]) {
    const rendu = circonstances(etat, joue(etat, "adv2", "Pas chassé", { mode: "jet_prete", cible: "pj1", armePretee }));
    assert.equal(rendu.genre, "defense");
    assert.equal(rendu.lanceur, "pj1");
    assert.equal(rendu.faces, 8);
    assert.equal(rendu.difficulte, 4);
  }
});

test("un geste sans jet ne lance aucun dé", () => {
  const etat = duel();
  const manque = { manque: "Ce geste ne lance aucun dé." };
  assert.deepEqual(circonstances(etat, joue(etat, "pj1", "Flambage", { mode: "sans_jet", cible: "adv2" })), manque);
  assert.deepEqual(circonstances(etat, joue(etat, "pj1", "Pas chassé", { mode: "deplacement", arrivee: "D5" })), manque);
  assert.equal(circonstances(etat, joue(etat, "pj1", "Flambage", { mode: "jet_prete", cible: "adv2", armePretee: 0 })).manque, undefined, "le même, une fois le jet prêté");
});

// ─── Les sept modificateurs, un par un ──────────────────────────────────────

// Un jet à mains nues, qui mobilise ce qu'on veut.
const aMainsNues = (etat, caracteristiques, champs = {}) => circonstances(etat, joue(etat, "pj1", "Taloche", { cible: "adv2", caracteristiques, ...champs }));

test("modificateur 1, bonus de Force : +N quand le jet mobilise la Force, rien sinon", () => {
  const etat = duel({ pj: passif("bonus_force", "Costaud", 2) });
  assert.deepEqual(aMainsNues(etat, ["force", "agilite"]).modificateurs, [{ genre: "passif", nom: "Costaud", valeur: 2 }]);
  assert.deepEqual(aMainsNues(etat, ["force"]).modificateurs, [{ genre: "passif", nom: "Costaud", valeur: 2 }], "une seule fois, même pour le double de la Force");
  assert.deepEqual(aMainsNues(etat, ["agilite", "precision"]).modificateurs, []);
  assert.deepEqual(attaqueDuPj(etat).modificateurs, [], "le couteau mobilise la Précision et l'Agilité");
  assert.deepEqual(aMainsNues(duel(), ["force", "agilite"]).modificateurs, [], "sans le passif, rien");
});

test("modificateur 2, bonus d'Agilité : +N quand le jet mobilise l'Agilité, rien sinon", () => {
  const etat = duel({ pj: passif("bonus_agilite", "Vif", 1) });
  assert.deepEqual(attaqueDuPj(etat).modificateurs, [{ genre: "passif", nom: "Vif", valeur: 1 }]);
  assert.deepEqual(attaqueDeLAdversaire(etat).modificateurs, [{ genre: "passif", nom: "Vif", valeur: 1 }], "sa défense agile la mobilise aussi");
  assert.deepEqual(aMainsNues(etat, ["force", "precision"]).modificateurs, []);
});

test("modificateur 3, bonus de Précision : +N quand le jet mobilise la Précision, rien sinon", () => {
  const etat = duel({ pj: passif("bonus_precision", "Main sûre", 3) });
  assert.deepEqual(attaqueDuPj(etat).modificateurs, [{ genre: "passif", nom: "Main sûre", valeur: 3 }]);
  assert.deepEqual(attaqueDeLAdversaire(etat).modificateurs, [], "sa défense agile ne mobilise pas la Précision");
  assert.deepEqual(aMainsNues(etat, ["force", "agilite"]).modificateurs, []);
});

test("modificateurs 4 et 5, petit : +N aux jets de défense ; −1 aux jets qui mobilisent la Force, quel que soit N", () => {
  const etat = duel({ pj: passif("petit", "Demi-portion", 2) });
  assert.deepEqual(attaqueDeLAdversaire(etat).modificateurs, [{ genre: "passif", nom: "Demi-portion", valeur: 2 }], "en défense, sans la Force");
  assert.deepEqual(attaqueDuPj(etat).modificateurs, [], "en attaque, sans la Force : rien");
  assert.deepEqual(aMainsNues(etat, ["force", "agilite"]).modificateurs, [{ genre: "passif", nom: "Demi-portion", valeur: -1 }], "en attaque, avec la Force");

  const lourd = duel({
    pj: ensemble(passif("petit", "Demi-portion", 3), (valeurs) => { valeurs.deDefense = { faces: 8, type: "lourde", caracteristiques: ["force", "sens"], meles: false, egalite: [] }; }),
  });
  assert.deepEqual(
    attaqueDeLAdversaire(lourd).modificateurs,
    [{ genre: "passif", nom: "Demi-portion", valeur: 3 }, { genre: "passif", nom: "Demi-portion", valeur: -1 }],
    "une défense qui mobilise la Force : le bonus, puis le malus",
  );
  const gouter = circonstances(lourd, joue(lourd, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["force", "sens"], difficulte: 5 }));
  assert.deepEqual(gouter.modificateurs, [{ genre: "passif", nom: "Demi-portion", valeur: -1 }], "un jet de caractéristique n'est pas une défense");
});

test("modificateur 6, blessures : −1 par zone dont l'endurance est à 0, à chaque jet du PJ", () => {
  const blesser = (...zones) => (etat) => {
    for (const zone of zones) etat.protagonistes.pj1.zones[zone].resistance = 0;
  };
  const une = duel({ retoucher: blesser(2) });
  const blessure = [{ genre: "blessures", nom: null, valeur: -1 }];
  assert.deepEqual(attaqueDuPj(une).modificateurs, blessure, "en attaque");
  assert.deepEqual(attaqueDeLAdversaire(une).modificateurs, blessure, "en défense");
  assert.deepEqual(circonstances(une, joue(une, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["sens"], difficulte: 5 })).modificateurs, blessure, "au jet de caractéristique");

  assert.deepEqual(attaqueDuPj(duel({ retoucher: blesser(2, 4) })).modificateurs, [{ genre: "blessures", nom: null, valeur: -2 }], "elles se cumulent");
  assert.deepEqual(attaqueDuPj(duel({ retoucher: blesser(0, 1, 5) })).modificateurs, [{ genre: "blessures", nom: null, valeur: -3 }]);
  assert.deepEqual(attaqueDuPj(duel()).modificateurs, [], "sans blessure, rien");
  const entamee = duel({ retoucher: (etat) => { etat.protagonistes.pj1.zones[2].resistance = 1; } });
  assert.deepEqual(attaqueDuPj(entamee).modificateurs, [], "une endurance à 1 n'est pas une blessure");
});

test("modificateur 7, la main : ±N avec sa raison, en dernier ; nul ou absent, rien", () => {
  const etat = duel();
  const regle = (modificateur) => attaqueDuPj(etat, { reglages: { modificateur, avantages: null } }).modificateurs;
  assert.deepEqual(regle({ valeur: 1, raison: "Inspiration" }), [{ genre: "main", nom: "Inspiration", valeur: 1 }]);
  assert.deepEqual(regle({ valeur: -3, raison: "Sol glissant" }), [{ genre: "main", nom: "Sol glissant", valeur: -3 }]);
  assert.deepEqual(regle(null), []);
  assert.deepEqual(regle({ valeur: 0, raison: "Inspiration" }), []);
  const defense = attaqueDeLAdversaire(etat, { reglages: { modificateur: { valeur: 2, raison: "Abri" }, avantages: null } });
  assert.deepEqual(defense.modificateurs, [{ genre: "main", nom: "Abri", valeur: 2 }], "la main vaut aussi pour la défense du PJ");
  const gouter = circonstances(etat, joue(etat, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["sens"], difficulte: 5, reglages: { modificateur: { valeur: 1, raison: "Inspiration" }, avantages: null } }));
  assert.deepEqual(gouter.modificateurs, [{ genre: "main", nom: "Inspiration", valeur: 1 }]);
});

test("les modificateurs suivent l'ordre écrit, pas celui de la photographie", () => {
  // Les passifs sont posés à rebours de l'ordre attendu. Aucun jet ne
  // mobilise les trois caractéristiques ensemble : chaque paire voisine de
  // l'ordre écrit (Force, Agilité, Précision, petit, puis son malus) est vue
  // dans un jet au moins.
  const tout = ensemble(passif("petit", "Demi-portion", 2), passif("bonus_precision", "Main sûre", 3), passif("bonus_agilite", "Vif", 1), passif("bonus_force", "Costaud", 2));
  const blesser = (etat) => { etat.protagonistes.pj1.zones[3].resistance = 0; };
  const main = { modificateur: { valeur: 1, raison: "Inspiration" }, avantages: null };
  const defenseDuType = (type) => (valeurs) => {
    valeurs.deDefense = { faces: 8, type, caracteristiques: [...TYPES_OBJET[type].defense], meles: false, egalite: [] };
  };

  const enDefenseLourde = duel({ pj: ensemble(tout, defenseDuType("lourde")), retoucher: blesser });
  assert.deepEqual(attaqueDeLAdversaire(enDefenseLourde, { reglages: main }).modificateurs, [
    { genre: "passif", nom: "Costaud", valeur: 2 },
    { genre: "passif", nom: "Demi-portion", valeur: 2 },
    { genre: "passif", nom: "Demi-portion", valeur: -1 },
    { genre: "blessures", nom: null, valeur: -1 },
    { genre: "main", nom: "Inspiration", valeur: 1 },
  ]);

  const enDefensePrecise = duel({ pj: ensemble(tout, defenseDuType("precise")), retoucher: blesser });
  assert.deepEqual(attaqueDeLAdversaire(enDefensePrecise, { reglages: main }).modificateurs, [
    { genre: "passif", nom: "Main sûre", valeur: 3 },
    { genre: "passif", nom: "Demi-portion", valeur: 2 },
    { genre: "blessures", nom: null, valeur: -1 },
    { genre: "main", nom: "Inspiration", valeur: 1 },
  ]);

  const enAttaque = duel({ pj: tout, retoucher: blesser });
  assert.deepEqual(aMainsNues(enAttaque, ["agilite", "force"], { reglages: main }).modificateurs, [
    { genre: "passif", nom: "Costaud", valeur: 2 },
    { genre: "passif", nom: "Vif", valeur: 1 },
    { genre: "passif", nom: "Demi-portion", valeur: -1 },
    { genre: "blessures", nom: null, valeur: -1 },
    { genre: "main", nom: "Inspiration", valeur: 1 },
  ]);
  assert.deepEqual(attaqueDuPj(enAttaque, { reglages: main }).modificateurs, [
    { genre: "passif", nom: "Vif", valeur: 1 },
    { genre: "passif", nom: "Main sûre", valeur: 3 },
    { genre: "blessures", nom: null, valeur: -1 },
    { genre: "main", nom: "Inspiration", valeur: 1 },
  ]);
  assert.equal(modificateurDe(ouvrirJet(attaqueDuPj(enAttaque, { reglages: main }))), 4, "1 + 3 − 1 + 1");
});

test("le N d'un bonus est le niveau de la capacité : au niveau 2, un d10 devient « d10+2 »", () => {
  const marteau = (valeurs) => { valeurs.armes[0].faces = 10; valeurs.armes[0].caracteristiques = ["force", "precision"]; };
  const jetAu = (niveau) => ouvrirJet(attaqueDuPj(duel({ pj: ensemble(marteau, passif("bonus_force", "Costaud", niveau)) })));

  const niveau2 = jetAu(2);
  assert.equal(niveau2.faces, 10);
  assert.equal(modificateurDe(niveau2), 2, "d10+2");
  assert.equal(modificateurDe(jetAu(1)), 1, "d10+1 au niveau 1");
  assert.equal(modificateurDe(jetAu(3)), 3);
  assert.equal(modificateurDe(ouvrirJet(attaqueDuPj(duel({ pj: marteau })))), 0, "d10 sans le passif");

  const niveau0 = attaqueDuPj(duel({ pj: ensemble(marteau, passif("bonus_force", "Costaud", 0)) }));
  assert.deepEqual(niveau0.modificateurs, [], "un nombre nul n'entre pas dans la liste");
});

test("deux passifs du même rôle comptent tous les deux, dans l'ordre de la photographie", () => {
  const etat = duel({ pj: ensemble(passif("bonus_agilite", "Vif", 1), passif("bonus_agilite", "Pied léger", 2)) });
  assert.deepEqual(attaqueDuPj(etat).modificateurs, [{ genre: "passif", nom: "Vif", valeur: 1 }, { genre: "passif", nom: "Pied léger", valeur: 2 }]);
});

test("modificateursDe : la même liste, sans la main, pour la fiche comme pour le jet", () => {
  const etat = duel({ pj: ensemble(passif("bonus_agilite", "Vif", 1), passif("petit", "Demi-portion", 2)), retoucher: (courant) => { courant.protagonistes.pj1.zones[0].resistance = 0; } });
  assert.deepEqual(modificateursDe(etat, "pj1", { genre: "attaque", mobilisees: ["precision", "agilite"] }), [
    { genre: "passif", nom: "Vif", valeur: 1 },
    { genre: "blessures", nom: null, valeur: -1 },
  ]);
  assert.deepEqual(modificateursDe(etat, "pj1", { genre: "defense", mobilisees: ["agilite", "creativite"] }), [
    { genre: "passif", nom: "Vif", valeur: 1 },
    { genre: "passif", nom: "Demi-portion", valeur: 2 },
    { genre: "blessures", nom: null, valeur: -1 },
  ]);
  assert.deepEqual(modificateursDe(etat, "pj1", { genre: "caracteristique", mobilisees: ["sens"] }), [{ genre: "blessures", nom: null, valeur: -1 }]);
  assert.deepEqual(modificateursDe(etat, "pj1"), [{ genre: "blessures", nom: null, valeur: -1 }], "sans jet nommé : ce qui vaut pour tout jet, les blessures");
  const main = { modificateur: { valeur: 5, raison: "Inspiration" }, avantages: null };
  assert.deepEqual(
    attaqueDuPj(etat, { reglages: main }).modificateurs,
    [...modificateursDe(etat, "pj1", { genre: "attaque", mobilisees: ["precision", "agilite"] }), { genre: "main", nom: "Inspiration", valeur: 5 }],
  );
});

test("un adversaire : ni ses bonus, ni son malus, ni ses blessures ne s'appliquent, à lui comme au PJ", () => {
  const charge = ensemble(passif("bonus_force", "Costaud", 2), passif("bonus_agilite", "Vif", 2), passif("bonus_precision", "Main sûre", 2), passif("petit", "Demi-portion", 2));
  const blesser = (etat) => { etat.protagonistes.adv2.zones[0].resistance = 0; etat.protagonistes.adv2.zones[1].resistance = 0; };
  const etat = duel({ adv: charge, retoucher: blesser });
  const nu = duel();

  for (const genre of ["attaque", "defense", "caracteristique"]) {
    assert.deepEqual(modificateursDe(etat, "adv2", { genre, mobilisees: ["force", "agilite"] }), [], genre);
  }
  assert.deepEqual(attaqueDeLAdversaire(etat), attaqueDeLAdversaire(nu), "quand il attaque : la défense du PJ ne change pas");
  assert.deepEqual(attaqueDuPj(etat), attaqueDuPj(nu), "quand il se défend : ni la difficulté ni le jet du PJ ne changent");
  assert.equal(attaqueDuPj(etat).difficulte, 5, "petit ne monte pas la défense d'un adversaire");

  const pjCharge = duel({ pj: charge });
  assert.notDeepEqual(attaqueDuPj(pjCharge).modificateurs, [], "les mêmes passifs, chez un PJ, s'appliquent");
});

// ─── Les dix sources d'avantage et de désavantage, une par une ──────────────

const solo = (niveau = 1) => passif("seul_sur_sa_case", "Solo du chef", niveau);
const brigade = (niveau = 1) => passif("en_meute", "Brigade", niveau);
const coude = (niveau = 1) => passif("esprit_de_corps", "Coude à coude", niveau);
const melee = (valeurs) => { valeurs.deDefense.meles = true; };

// Une source de passif porte son rôle et l'indice de sa capacité chez son
// porteur (contrat du groupe 2, § 5.5). ajouterPassif range un passif après
// les capacités de son porteur : le premier ajouté a pour indice leur nombre,
// lu ici, jamais écrit.
const PREMIER_PASSIF = { pj: pjEssai().valeurs.capacites.length, adv: adversaireEssai().valeurs.capacites.length };

const SOLO = { genre: "passif", nom: "Solo du chef", nombre: 1, de: null, role: "seul_sur_sa_case", capacite: PREMIER_PASSIF.pj };
const BRIGADE = { genre: "passif", nom: "Brigade", nombre: 1, de: null, role: "en_meute", capacite: PREMIER_PASSIF.pj };
const COUDE = { genre: "passif", nom: "Coude à coude", nombre: 1, de: null, role: "esprit_de_corps", capacite: PREMIER_PASSIF.pj };

// La même source, premier passif du Marmiton : inversée, elle porte son nom.
const chezLAdversaire = (source, nombre) => ({ ...source, nombre, de: "Marmiton", capacite: PREMIER_PASSIF.adv });

test("source 1, seul sur sa case (lanceur) : N avantages en attaque et en défense, au corps-à-corps, sans allié vivant sur sa case", () => {
  const alliee = { photo: brioche(), case: "D4" };

  const seul = duel({ pj: solo() });
  assert.deepEqual(attaqueDuPj(seul).avantages, [SOLO], "en attaque");
  assert.deepEqual(attaqueDeLAdversaire(seul).avantages, [SOLO], "en défense");
  assert.deepEqual(attaqueDuPj(seul).desavantages, []);

  const aDistance = duel({ pj: solo(), casePj: "C3" });
  assert.deepEqual(attaqueDuPj(aDistance).avantages, [], "à une case : ce n'est pas le corps-à-corps");
  assert.deepEqual(attaqueDeLAdversaire(aDistance).avantages, []);

  const accompagne = duel({ pj: solo(), autres: [alliee] });
  assert.deepEqual(attaqueDuPj(accompagne).avantages, [], "une alliée vivante sur sa case");
  assert.deepEqual(attaqueDeLAdversaire(accompagne).avantages, []);

  assert.deepEqual(attaqueDuPj(duel({ pj: solo(), autres: [alliee], retoucher: tuer("pj3") })).avantages, [SOLO], "une alliée morte ne compte pas");
  assert.deepEqual(attaqueDuPj(duel({ pj: solo(), autres: [{ photo: brioche(), case: "D5" }] })).avantages, [SOLO], "une alliée sur la case voisine ne compte pas");
  assert.deepEqual(attaqueDuPj(duel({ pj: solo(), autres: [{ photo: commis(), case: "D4" }] })).avantages, [SOLO], "un second adversaire sur la case n'est pas un allié");

  assert.deepEqual(attaqueDuPj(duel({ pj: solo(2) })).avantages, [{ ...SOLO, nombre: 2 }], "N est le niveau de la capacité");
  assert.deepEqual(attaqueDuPj(duel({ pj: solo(0) })).avantages, [], "au niveau 0, la source n'entre pas");
  assert.deepEqual(attaqueDuPj(duel()).avantages, [], "sans le passif, rien");
});

test("source 2, en meute (lanceur) : N avantages en attaque, avec un allié vivant sur sa case", () => {
  const alliee = { photo: brioche(), case: "D4" };

  const enMeute = duel({ pj: brigade(), autres: [alliee] });
  assert.deepEqual(attaqueDuPj(enMeute).avantages, [BRIGADE]);
  assert.deepEqual(attaqueDeLAdversaire(enMeute).avantages, [], "pas en défense");

  assert.deepEqual(attaqueDuPj(duel({ pj: brigade() })).avantages, [], "sans allié");
  assert.deepEqual(attaqueDuPj(duel({ pj: brigade(), autres: [alliee], retoucher: tuer("pj3") })).avantages, [], "une alliée morte ne compte pas");
  assert.deepEqual(attaqueDuPj(duel({ pj: brigade(), autres: [{ photo: brioche(), case: "E5" }] })).avantages, [], "une alliée ailleurs ne compte pas");

  const aDistance = duel({ pj: brigade(), casePj: "C3", autres: [{ photo: brioche(), case: "C3" }] });
  assert.deepEqual(attaqueDuPj(aDistance).avantages, [BRIGADE], "le corps-à-corps n'est pas demandé : l'alliée est sur sa case à lui");
  assert.deepEqual(attaqueDuPj(duel({ pj: brigade(3), autres: [alliee] })).avantages, [{ ...BRIGADE, nombre: 3 }]);
});

test("source 3, esprit de corps (lanceur) : N avantages en défense, avec un allié vivant sur sa case", () => {
  const alliee = { photo: brioche(), case: "D4" };

  const ensembleSurLaCase = duel({ pj: coude(), autres: [alliee] });
  assert.deepEqual(attaqueDeLAdversaire(ensembleSurLaCase).avantages, [COUDE]);
  assert.deepEqual(attaqueDuPj(ensembleSurLaCase).avantages, [], "pas en attaque");

  assert.deepEqual(attaqueDeLAdversaire(duel({ pj: coude() })).avantages, [], "sans allié");
  assert.deepEqual(attaqueDeLAdversaire(duel({ pj: coude(), autres: [alliee], retoucher: tuer("pj3") })).avantages, [], "une alliée morte ne compte pas");
  assert.deepEqual(attaqueDeLAdversaire(duel({ pj: coude(2), autres: [alliee] })).avantages, [{ ...COUDE, nombre: 2 }]);

  const aDistance = duel({ pj: coude(), casePj: "C3", autres: [{ photo: brioche(), case: "C3" }] });
  assert.deepEqual(attaqueDeLAdversaire(aDistance).avantages, [COUDE], "le corps-à-corps n'est pas demandé : l'alliée est sur sa case à lui");
  assert.deepEqual(attaqueDeLAdversaire(duel({ pj: coude(), autres: [{ photo: brioche(), case: "E5" }] })).avantages, [], "une alliée ailleurs ne compte pas");
});

test("source 4, maîtrise (lanceur) : 1 désavantage à son attaque hors maîtrise, au nom de la capacité jouée", () => {
  const etat = duel();
  const emincer = circonstances(etat, joue(etat, "pj1", "Émincer", { cible: "adv2" }));
  assert.deepEqual(emincer.desavantages, [{ genre: "maitrise", nom: "Émincer", nombre: 1, de: null }]);
  assert.deepEqual(emincer.avantages, []);
  assert.deepEqual(attaqueDuPj(etat).desavantages, [], "Frappe est dans sa maîtrise");
  const taloche = circonstances(etat, joue(etat, "pj1", "Taloche", { cible: "adv2", caracteristiques: ["force"] }));
  assert.deepEqual(taloche.desavantages, [], "les mains nues ne sont l'objet d'aucune maîtrise");
});

test("source 5, types d'armure mêlés (lanceur) : 1 désavantage en défense, jamais en attaque", () => {
  const meles = duel({ pj: melee });
  assert.deepEqual(attaqueDeLAdversaire(meles).desavantages, [{ genre: "armure_melee", nom: null, nombre: 1, de: null }]);
  assert.deepEqual(attaqueDuPj(meles).desavantages, [], "pas en attaque");
  assert.deepEqual(attaqueDeLAdversaire(duel()).desavantages, [], "une armure d'un seul type");
  const gouter = circonstances(meles, joue(meles, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["sens"], difficulte: 5 }));
  assert.deepEqual(gouter.desavantages, [], "ni au jet de caractéristique");
});

test("source 6, seul sur sa case (l'autre) : ses N avantages deviennent N désavantages du PJ", () => {
  const SOLO_INVERSE = chezLAdversaire(SOLO, 2);
  const allie = { photo: commis(), case: "D4" };

  const seul = duel({ adv: solo(2) });
  assert.deepEqual(attaqueDuPj(seul).desavantages, [SOLO_INVERSE], "il se défend");
  assert.deepEqual(attaqueDeLAdversaire(seul).desavantages, [SOLO_INVERSE], "il attaque");
  assert.deepEqual(attaqueDuPj(seul).avantages, [], "ce n'est pas un avantage du PJ");
  assert.deepEqual(attaqueDeLAdversaire(seul).avantages, []);

  assert.deepEqual(attaqueDuPj(duel({ adv: solo(2), casePj: "C3" })).desavantages, [], "à une case : pas de corps-à-corps");
  const accompagne = duel({ adv: solo(2), autres: [allie] });
  assert.deepEqual(attaqueDuPj(accompagne).desavantages, [], "un allié vivant sur sa case");
  assert.deepEqual(attaqueDeLAdversaire(accompagne).desavantages, []);
  assert.deepEqual(attaqueDuPj(duel({ adv: solo(2), autres: [allie], retoucher: tuer("adv3") })).desavantages, [SOLO_INVERSE], "un allié mort ne compte pas");
  assert.deepEqual(attaqueDuPj(duel({ adv: solo(2), autres: [{ photo: brioche(), case: "D4" }] })).desavantages, [SOLO_INVERSE], "l'alliée du PJ n'est pas la sienne");
});

test("source 7, en meute (l'autre) : N désavantages du PJ quand l'adversaire attaque avec un allié sur sa case", () => {
  const BRIGADE_INVERSE = chezLAdversaire(BRIGADE, 1);
  const allie = { photo: commis(), case: "D4" };

  const enMeute = duel({ adv: brigade(), autres: [allie] });
  assert.deepEqual(attaqueDeLAdversaire(enMeute).desavantages, [BRIGADE_INVERSE]);
  assert.deepEqual(attaqueDuPj(enMeute).desavantages, [], "quand il se défend, rien");
  assert.deepEqual(attaqueDeLAdversaire(duel({ adv: brigade() })).desavantages, [], "sans allié");
  assert.deepEqual(attaqueDeLAdversaire(duel({ adv: brigade(), autres: [allie], retoucher: tuer("adv3") })).desavantages, [], "un allié mort ne compte pas");
  assert.deepEqual(attaqueDeLAdversaire(duel({ adv: brigade(), autres: [{ photo: brioche(), case: "D4" }] })).desavantages, [], "l'alliée du PJ n'est pas la sienne");
  assert.deepEqual(attaqueDeLAdversaire(duel({ adv: brigade(), casePj: "C3", autres: [allie] })).desavantages, [BRIGADE_INVERSE], "il attaque de loin : le corps-à-corps n'est pas demandé");
});

test("source 8, esprit de corps (l'autre) : N désavantages du PJ quand l'adversaire se défend avec un allié sur sa case", () => {
  const COUDE_INVERSE = chezLAdversaire(COUDE, 3);
  const allie = { photo: commis(), case: "D4" };

  const serres = duel({ adv: coude(3), autres: [allie] });
  assert.deepEqual(attaqueDuPj(serres).desavantages, [COUDE_INVERSE]);
  assert.deepEqual(attaqueDeLAdversaire(serres).desavantages, [], "quand il attaque, rien");
  assert.deepEqual(attaqueDuPj(duel({ adv: coude(3) })).desavantages, [], "sans allié");
  assert.deepEqual(attaqueDuPj(duel({ adv: coude(3), autres: [allie], retoucher: tuer("adv3") })).desavantages, [], "un allié mort ne compte pas");
  assert.deepEqual(attaqueDuPj(duel({ adv: coude(3), casePj: "C3", autres: [allie] })).desavantages, [COUDE_INVERSE], "attaqué de loin : le corps-à-corps n'est pas demandé");
});

test("source 9, maîtrise (l'autre) : son désavantage hors maîtrise devient 1 avantage du PJ", () => {
  const etat = duel();
  const moulinet = circonstances(etat, joue(etat, "adv2", "Moulinet farineux", { cible: "pj1" }));
  assert.deepEqual(moulinet.avantages, [{ genre: "maitrise", nom: "Moulinet farineux", nombre: 1, de: "Marmiton" }]);
  assert.deepEqual(moulinet.desavantages, [], "ce n'est pas un désavantage du PJ");
  assert.deepEqual(attaqueDeLAdversaire(etat).avantages, [], "sa Frappe est dans sa maîtrise");
});

test("source 10, la main : k avantages si k est positif, |k| désavantages s'il est négatif, avec sa raison", () => {
  const etat = duel();
  const regle = (avantages, lancer = attaqueDuPj) => lancer(etat, { reglages: { modificateur: null, avantages } });

  assert.deepEqual(regle({ valeur: 2, raison: "Minutie" }).avantages, [{ genre: "main", nom: "Minutie", nombre: 2, de: null }]);
  assert.deepEqual(regle({ valeur: 2, raison: "Minutie" }).desavantages, []);
  assert.deepEqual(regle({ valeur: -1, raison: "Fumée" }).desavantages, [{ genre: "main", nom: "Fumée", nombre: 1, de: null }]);
  assert.deepEqual(regle({ valeur: -1, raison: "Fumée" }).avantages, []);
  assert.deepEqual(regle({ valeur: -3, raison: "Fumée" }).desavantages, [{ genre: "main", nom: "Fumée", nombre: 3, de: null }]);
  assert.deepEqual(regle(null).avantages, []);
  assert.deepEqual(regle({ valeur: 0, raison: "Minutie" }).avantages, []);
  assert.deepEqual(regle({ valeur: 0, raison: "Minutie" }).desavantages, []);
  assert.deepEqual(regle({ valeur: 1, raison: "Abri" }, attaqueDeLAdversaire).avantages, [{ genre: "main", nom: "Abri", nombre: 1, de: null }], "en défense aussi");
});

// ─── Leur ordre, l'inversion, le jet prêté ──────────────────────────────────

test("l'ordre des sources : celles du lanceur, celles de l'autre, puis la main", () => {
  const avantage = { modificateur: null, avantages: { valeur: 1, raison: "Minutie" } };
  const desavantage = { modificateur: null, avantages: { valeur: -2, raison: "Fumée" } };
  const allie = { photo: commis(), case: "D4" };

  // Le PJ se défend, seul sur sa case, contre un Moulinet hors maîtrise d'un
  // adversaire seul lui aussi.
  const seuls = duel({ pj: ensemble(solo(), melee), adv: solo(2) });
  const defenseAvantagee = circonstances(seuls, joue(seuls, "adv2", "Moulinet farineux", { cible: "pj1", reglages: avantage }));
  assert.deepEqual(defenseAvantagee.avantages, [SOLO, { genre: "maitrise", nom: "Moulinet farineux", nombre: 1, de: "Marmiton" }, { genre: "main", nom: "Minutie", nombre: 1, de: null }]);
  assert.deepEqual(defenseAvantagee.desavantages, [{ genre: "armure_melee", nom: null, nombre: 1, de: null }, chezLAdversaire(SOLO, 2)]);
  const defenseGenee = circonstances(seuls, joue(seuls, "adv2", "Moulinet farineux", { cible: "pj1", reglages: desavantage }));
  assert.deepEqual(defenseGenee.desavantages, [
    { genre: "armure_melee", nom: null, nombre: 1, de: null },
    chezLAdversaire(SOLO, 2),
    { genre: "main", nom: "Fumée", nombre: 2, de: null },
  ]);
  assert.equal(netDe(ouvrirJet(defenseGenee)), 2 - 5, "2 avantages, 5 désavantages");

  // Le PJ attaque hors maîtrise, une alliée à ses côtés, un adversaire
  // entouré des siens.
  const meles = duel({ pj: brigade(2), adv: coude(), autres: [{ photo: brioche(), case: "D4" }, allie] });
  const attaque = circonstances(meles, joue(meles, "pj1", "Émincer", { cible: "adv2", reglages: desavantage }));
  assert.deepEqual(attaque.avantages, [{ ...BRIGADE, nombre: 2 }]);
  assert.deepEqual(attaque.desavantages, [
    { genre: "maitrise", nom: "Émincer", nombre: 1, de: null },
    chezLAdversaire(COUDE, 1),
    { genre: "main", nom: "Fumée", nombre: 2, de: null },
  ]);
  assert.equal(netDe(ouvrirJet(attaque)), 2 - 4);
});

test("l'inversion, dans les deux sens : l'avantage de l'adversaire désavantage le PJ, son désavantage l'avantage", () => {
  const etat = duel({ adv: solo(), noms: { adv2: { court: "Marmiton n° 1" } } });
  const rendu = circonstances(etat, joue(etat, "adv2", "Moulinet farineux", { cible: "pj1" }));
  assert.deepEqual(rendu.desavantages, [{ ...chezLAdversaire(SOLO, 1), de: "Marmiton n° 1" }], "son avantage : un désavantage du PJ");
  assert.deepEqual(rendu.avantages, [{ genre: "maitrise", nom: "Moulinet farineux", nombre: 1, de: "Marmiton n° 1" }], "son désavantage : un avantage du PJ");
  assert.equal(rendu.lanceur, "pj1", "dans le même jet, celui du PJ");
  assert.equal(netDe(ouvrirJet(rendu)), 0);

  // La source inversée porte le nom court du journal ; faute de nom court,
  // le nom de la photographie, jamais rien.
  const sansNoms = { ...etat, noms: { pj1: etat.noms.pj1 } };
  assert.equal(circonstances(sansNoms, joue(sansNoms, "adv2", "Moulinet farineux", { cible: "pj1" })).avantages[0].de, "Marmiton");

  // Les mêmes sources, chez le PJ qui lance, ne sont pas inversées et ne
  // portent le nom de personne.
  const miroir = duel({ pj: solo() });
  const duPj = circonstances(miroir, joue(miroir, "pj1", "Émincer", { cible: "adv2" }));
  assert.deepEqual(duPj.avantages, [SOLO]);
  assert.deepEqual(duPj.desavantages, [{ genre: "maitrise", nom: "Émincer", nombre: 1, de: null }]);
});

test("une source de passif porte son rôle et l'indice de sa capacité chez son porteur, inversée ou non ; les autres sources, non", () => {
  // Vif est posé d'abord : l'indice d'un passif n'est ni celui du premier
  // ajouté, ni son rang dans la liste « passifs ».
  const avant = passif("bonus_agilite", "Vif");
  const source = (etat, porteur, nom, role, nombre, de = null) => ({ genre: "passif", nom, nombre, de, role, capacite: indiceDe(etat, porteur, nom) });

  const seuls = duel({ pj: ensemble(avant, solo()), adv: ensemble(avant, solo(2)) });
  const contreSeul = attaqueDuPj(seuls);
  assert.deepEqual(contreSeul.avantages, [source(seuls, "pj1", "Solo du chef", "seul_sur_sa_case", 1)]);
  assert.deepEqual(contreSeul.desavantages, [source(seuls, "adv2", "Solo du chef", "seul_sur_sa_case", 2, "Marmiton")], "inversée : l'indice chez l'adversaire, son porteur");
  assert.notEqual(indiceDe(seuls, "pj1", "Solo du chef"), PREMIER_PASSIF.pj);

  const entoures = duel({
    pj: ensemble(avant, brigade(), coude(2)),
    adv: ensemble(avant, coude(3), brigade()),
    autres: [{ photo: brioche(), case: "D4" }, { photo: commis(), case: "D4" }],
  });
  const attaque = attaqueDuPj(entoures);
  const defense = attaqueDeLAdversaire(entoures);
  assert.deepEqual(attaque.avantages, [source(entoures, "pj1", "Brigade", "en_meute", 1)]);
  assert.deepEqual(attaque.desavantages, [source(entoures, "adv2", "Coude à coude", "esprit_de_corps", 3, "Marmiton")]);
  assert.deepEqual(defense.avantages, [source(entoures, "pj1", "Coude à coude", "esprit_de_corps", 2)]);
  assert.deepEqual(defense.desavantages, [source(entoures, "adv2", "Brigade", "en_meute", 1, "Marmiton")]);

  // L'indice désigne la capacité, et l'entrée de « passifs » qui porte le rôle.
  const vues = [...attaque.avantages.map((un) => ["pj1", un]), ...attaque.desavantages.map((un) => ["adv2", un]), ...defense.avantages.map((un) => ["pj1", un]), ...defense.desavantages.map((un) => ["adv2", un])];
  for (const [porteur, { nom, role, capacite }] of vues) {
    assert.equal(capaciteDe(entoures, porteur, capacite).nom, nom);
    assert.ok(photoDe(entoures, porteur).passifs.some((un) => un.capacite === capacite && un.role === role), `${nom} : son entrée dans « passifs »`);
  }

  // La maîtrise, l'armure mêlée et la main ne sont pas des passifs : ni rôle, ni indice.
  const meles = duel({ pj: melee });
  const autres = circonstances(meles, joue(meles, "adv2", "Moulinet farineux", { cible: "pj1", reglages: { modificateur: null, avantages: { valeur: -1, raison: "Fumée" } } }));
  for (const un of [...autres.avantages, ...autres.desavantages]) assert.deepEqual(Object.keys(un), ["genre", "nom", "nombre", "de"], un.genre);
  assert.equal(autres.avantages.length + autres.desavantages.length, 3, "la maîtrise inversée, l'armure mêlée, la main");
});

test("un jet prêté ne porte pas le désavantage de maîtrise, ni pour qui le lance, ni par inversion ; les passifs y valent", () => {
  // Une capacité sans dégâts d'une arme hors maîtrise : jouée avec le jet de
  // l'arme, elle ne gêne personne. Sa maîtrise nomme l'arme et son poids
  // (contrat du groupe 2, § 5.3). Solo du chef est posé avant elle : il reste
  // le premier passif ajouté.
  const tourDeLame = (valeurs) => {
    const arme = valeurs.armes[0];
    const facon = faconEssai({ arme: 0, libelle: valeurs.caracteristiques ? null : "Spatule souple", desavantage: true, maitrise: { origine: arme.nom, poids: arme.poids } });
    valeurs.capacites.push(capaciteEssai({ nom: "Tour de lame", groupe: valeurs.capacites[0].groupe, facons: [facon] }));
  };
  const etat = duel({ pj: ensemble(solo(), tourDeLame), adv: tourDeLame });

  const pretePj = circonstances(etat, joue(etat, "pj1", "Tour de lame", { mode: "jet_prete", cible: "adv2", armePretee: 0 }));
  assert.deepEqual(pretePj.desavantages, [], "pas de désavantage de maîtrise pour le PJ");
  assert.deepEqual(pretePj.avantages, [SOLO], "un jet prêté est un jet d'attaque comme un autre : les passifs valent");
  const jouePj = circonstances(etat, joue(etat, "pj1", "Tour de lame", { mode: "attaque", cible: "adv2" }));
  assert.deepEqual(jouePj.desavantages, [{ genre: "maitrise", nom: "Tour de lame", nombre: 1, de: null }], "la même façon, jouée comme une attaque, le porte");

  const preteAdv = circonstances(etat, joue(etat, "adv2", "Tour de lame", { mode: "jet_prete", cible: "pj1", armePretee: 0 }));
  assert.deepEqual(preteAdv.avantages, [SOLO], "pas d'avantage inversé pour le PJ : seulement son passif");
  const joueAdv = circonstances(etat, joue(etat, "adv2", "Tour de lame", { mode: "attaque", cible: "pj1" }));
  assert.deepEqual(joueAdv.avantages, [SOLO, { genre: "maitrise", nom: "Tour de lame", nombre: 1, de: "Marmiton" }], "jouée comme une attaque, elle s'inverse");
});

test("un jet de caractéristique n'a que la main : ni passif, ni maîtrise, ni armure mêlée", () => {
  const etat = duel({ pj: ensemble(solo(), brigade(), coude(), melee), adv: solo(), autres: [{ photo: brioche(), case: "D4" }] });
  const gouter = (reglages) => circonstances(etat, joue(etat, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["parole", "sens"], difficulte: 6, cible: "adv2", reglages }));
  const nu = gouter({ modificateur: null, avantages: null });
  assert.deepEqual(nu.avantages, []);
  assert.deepEqual(nu.desavantages, []);
  assert.deepEqual(gouter({ modificateur: null, avantages: { valeur: 1, raison: "Minutie" } }).avantages, [{ genre: "main", nom: "Minutie", nombre: 1, de: null }]);
  assert.deepEqual(gouter({ modificateur: null, avantages: { valeur: -1, raison: "Fumée" } }).desavantages, [{ genre: "main", nom: "Fumée", nombre: 1, de: null }]);
});

test("circonstances ne change ni l'état ni le geste, et rend des listes qui lui sont propres", () => {
  const etat = duel({ pj: ensemble(solo(), passif("bonus_agilite", "Vif", 1)) });
  const geste = joue(etat, "pj1", "Frappe", { cible: "adv2" });
  const avant = JSON.stringify([etat, geste]);
  const premier = circonstances(etat, geste);
  const second = circonstances(etat, geste);
  assert.equal(JSON.stringify([etat, geste]), avant);
  assert.deepEqual(premier, second, "le même calcul à l'aperçu et au paiement");
  assert.notEqual(premier.mobilisees, etat.photos.pj1.armes[0].caracteristiques, "une copie, pas la liste de la photographie");
  premier.mobilisees.push("force");
  premier.avantages.length = 0;
  assert.deepEqual(circonstances(etat, geste), second, "ce qu'on fait d'un résultat ne revient pas sur le suivant");
});

// ─── Les causes sans cible : le survol d'une capacité ───────────────────────

const RIEN = { avantages: [], desavantages: [] };
const horsMaitrise = (nom) => ({ genre: "maitrise", nom, nombre: 1, de: null });

test("sourcesSansCible : la maîtrise d'Émincer, rien pour Frappe ; vue du porteur, sans inversion", () => {
  const etat = duel();
  const sansCible = (id, nom, facon = 0) => sourcesSansCible(etat, id, indiceDe(etat, id, nom), facon);

  assert.deepEqual(sansCible("pj1", "Émincer"), { avantages: [], desavantages: [horsMaitrise("Émincer")] });
  assert.deepEqual(sansCible("pj1", "Émincer").desavantages, circonstances(etat, joue(etat, "pj1", "Émincer", { cible: "adv2" })).desavantages, "le désavantage même du jet");
  assert.deepEqual(sansCible("pj1", "Frappe"), RIEN, "Frappe est dans sa maîtrise");
  assert.deepEqual(sansCible("pj1", "Taloche"), RIEN, "les mains nues ne sont l'objet d'aucune maîtrise");

  // Chez l'adversaire, son désavantage reste le sien : au jet, il devient un avantage du PJ.
  assert.deepEqual(sansCible("adv2", "Moulinet farineux"), { avantages: [], desavantages: [horsMaitrise("Moulinet farineux")] });
  assert.deepEqual(sansCible("adv2", "Frappe"), RIEN);

  // Une façon qui n'attaque pas ne porte aucune cause, même hors maîtrise.
  const tourDeLame = (valeurs) => {
    const facon = faconEssai({ arme: 0, desavantage: true, maitrise: { origine: "Couteau d'office", poids: "precise" } });
    valeurs.capacites.push(capaciteEssai({ nom: "Tour de lame", groupe: valeurs.capacites[0].groupe, facons: [facon] }));
  };
  const avecTour = duel({ pj: tourDeLame });
  assert.deepEqual(sourcesSansCible(avecTour, "pj1", indiceDe(avecTour, "pj1", "Tour de lame"), 0), RIEN, "une façon sans attaque, hors maîtrise");
  for (const nom of ["Flambage", "Fournaise", "Goûter", "Pas de côté"]) assert.deepEqual(sansCible("pj1", nom), RIEN, nom);
  assert.deepEqual(sansCible("pj1", "Pas chassé", 1), RIEN, "Pas chassé [2]");

  // Ce qui n'existe pas n'a aucune cause, et ne lève pas.
  const emincer = indiceDe(etat, "pj1", "Émincer");
  for (const facon of [1, -1, null, undefined, "0", 1.5]) assert.deepEqual(sourcesSansCible(etat, "pj1", emincer, facon), RIEN, `façon ${String(facon)}`);
  for (const capacite of [99, -1, null, "0"]) assert.deepEqual(sourcesSansCible(etat, "pj1", capacite, 0), RIEN, `capacité ${String(capacite)}`);
});

test("sourcesSansCible : « en meute » avec un allié vivant sur sa case seulement, sans cible ni corps-à-corps", () => {
  const alliee = { photo: brioche(), case: "D4" };
  const frappe = (etat, id = "pj1") => sourcesSansCible(etat, id, indiceDe(etat, id, "Frappe"), 0);
  const BRIGADE2 = { ...BRIGADE, nombre: 2 };

  const enMeute = duel({ pj: brigade(2), autres: [alliee] });
  assert.deepEqual(frappe(enMeute), { avantages: [BRIGADE2], desavantages: [] });
  assert.deepEqual(frappe(enMeute).avantages, attaqueDuPj(enMeute).avantages, "l'avantage même du jet");

  assert.deepEqual(frappe(duel({ pj: brigade(2) })), RIEN, "sans allié");
  assert.deepEqual(frappe(duel({ pj: brigade(2), autres: [alliee], retoucher: tuer("pj3") })), RIEN, "une alliée morte ne compte pas");
  assert.deepEqual(frappe(duel({ pj: brigade(2), autres: [{ photo: brioche(), case: "E5" }] })), RIEN, "une alliée ailleurs ne compte pas");
  assert.deepEqual(frappe(duel({ pj: brigade(2), autres: [{ photo: commis(), case: "D4" }] })), RIEN, "un second adversaire sur la case n'est pas un allié");
  assert.deepEqual(frappe(duel({ pj: brigade(0), autres: [alliee] })), RIEN, "au niveau 0, la source n'entre pas");
  assert.deepEqual(frappe(duel({ pj: brigade(2), casePj: "A1", autres: [{ photo: brioche(), case: "A1" }] })), { avantages: [BRIGADE2], desavantages: [] }, "loin de tout adversaire : ni la cible ni le corps-à-corps ne comptent");

  // Une façon qui n'attaque pas : rien, même en meute ; une attaque hors maîtrise : les deux.
  for (const nom of ["Flambage", "Pas chassé", "Goûter"]) assert.deepEqual(sourcesSansCible(enMeute, "pj1", indiceDe(enMeute, "pj1", nom), 0), RIEN, nom);
  assert.deepEqual(sourcesSansCible(enMeute, "pj1", indiceDe(enMeute, "pj1", "Émincer"), 0), { avantages: [BRIGADE2], desavantages: [horsMaitrise("Émincer")] });

  // Chez l'adversaire, sans inversion : son avantage, au nom de personne.
  const meute = duel({ adv: brigade(), autres: [{ photo: commis(), case: "D4" }] });
  assert.deepEqual(frappe(meute, "adv2"), { avantages: [{ ...BRIGADE, capacite: PREMIER_PASSIF.adv }], desavantages: [] });
  assert.deepEqual(frappe(duel({ adv: brigade() }), "adv2"), RIEN, "seul, rien");
});

test("sourcesSansCible : rien d'autre ; ni seul sur sa case, ni esprit de corps, ni armure mêlée, ni bonus", () => {
  const tout = ensemble(solo(3), brigade(), coude(2), melee, passif("bonus_agilite", "Vif", 2), passif("petit", "Demi-portion", 1));
  for (const autres of [[], [{ photo: brioche(), case: "D4" }]]) {
    const etat = duel({ pj: tout, adv: ensemble(solo(), coude()), autres });
    const rendu = sourcesSansCible(etat, "pj1", indiceDe(etat, "pj1", "Frappe"), 0);
    assert.deepEqual(rendu.avantages.map(({ role }) => role), autres.length > 0 ? ["en_meute"] : [], `${autres.length} alliée sur la case`);
    assert.deepEqual(rendu.desavantages, [], "rien de l'adversaire, qui n'est pas encore la cible");
  }
  const adverse = duel({ adv: ensemble(solo(2), coude(), brigade()) });
  assert.deepEqual(sourcesSansCible(adverse, "adv2", indiceDe(adverse, "adv2", "Frappe"), 0), RIEN, "seul sur sa case : son Solo du chef attend la cible");
});

// ─── La défense à égalité de dés ────────────────────────────────────────────

const MAIN_SURE = { genre: "passif", nom: "Main sûre", valeur: 2 };
const aEgalite = (...types) => (valeurs) => { valeurs.deDefense.egalite = types; };

test("défense à égalité : un PJ agile et précis, porteur de bonus_precision ; le défaut, puis « precise » qui change le modificateur", () => {
  const etat = duel({ pj: ensemble(aEgalite("agile", "precise"), passif("bonus_precision", "Main sûre", 2)) });

  const parDefaut = attaqueDeLAdversaire(etat);
  assert.deepEqual([parDefaut.faces, parDefaut.mobilisees, parDefaut.modificateurs], [8, ["agilite", "creativite"], []], "le défaut proposé : le type retenu, agile");
  assert.equal(modificateurDe(ouvrirJet(parDefaut)), 0);
  assert.deepEqual(attaqueDeLAdversaire(etat, { defense: "agile" }), parDefaut, "le type retenu, choisi : le même jet");

  const precise = attaqueDeLAdversaire(etat, { defense: "precise" });
  assert.deepEqual([precise.faces, precise.mobilisees, precise.modificateurs], [8, ["precision", "empathie"], [MAIN_SURE]], "« precise » : la Précision et l'Empathie, donc Main sûre");
  assert.equal(modificateurDe(ouvrirJet(precise)), 2, "d8+2");
  const horsDuType = ({ mobilisees, modificateurs, ...reste }) => reste;
  assert.deepEqual(horsDuType(precise), horsDuType(parDefaut), "le dé, la difficulté et les sources ne changent pas");

  // Un type hors de l'égalité, ou qui n'en est pas un : le défaut.
  for (const defense of ["lourde", "__proto__", "constructor", "precision", "", 3, null, undefined]) {
    assert.deepEqual(attaqueDeLAdversaire(etat, { defense }), parDefaut, `défense ${String(defense)}`);
  }
  const sansEgalite = duel({ pj: passif("bonus_precision", "Main sûre", 2) });
  assert.deepEqual(attaqueDeLAdversaire(sansEgalite, { defense: "precise" }), attaqueDeLAdversaire(sansEgalite), "sans égalité, pas de choix : le type retenu");

  // Le jet prêté d'un adversaire aussi ; quand le PJ attaque, le réglage ne joue pas.
  const prete = (defense) => circonstances(etat, joue(etat, "adv2", "Pas chassé", { mode: "jet_prete", cible: "pj1", armePretee: 0, defense }));
  assert.deepEqual(prete("precise").modificateurs, [MAIN_SURE]);
  assert.deepEqual(prete(null).modificateurs, []);
  assert.deepEqual(attaqueDuPj(etat, { defense: "precise" }), attaqueDuPj(etat), "en attaque, rien ne change");
});

test("défense à égalité de trois types : « lourde » mobilise la Force et le Sens ; bonus et malus suivent le type choisi", () => {
  const etat = duel({ pj: ensemble(aEgalite("lourde", "agile", "precise"), passif("bonus_force", "Costaud", 1), passif("petit", "Demi-portion", 2)) });
  const lourde = attaqueDeLAdversaire(etat, { defense: "lourde" });
  assert.deepEqual(lourde.mobilisees, ["force", "sens"]);
  assert.deepEqual(lourde.modificateurs, [{ genre: "passif", nom: "Costaud", valeur: 1 }, { genre: "passif", nom: "Demi-portion", valeur: 2 }, { genre: "passif", nom: "Demi-portion", valeur: -1 }]);
  assert.deepEqual(attaqueDeLAdversaire(etat).modificateurs, [{ genre: "passif", nom: "Demi-portion", valeur: 2 }], "agile : ni Costaud, ni le malus de Force");
  assert.deepEqual(attaqueDeLAdversaire(etat, { defense: "precise" }).mobilisees, ["precision", "empathie"]);
  assert.equal(lourde.faces, 8, "le dé reste celui de la photographie");
});

// ─── Les témoins : le combat de référence fictif ────────────────────────────

/**
 * Aubépine Crèmebrûlée (pj1), le Chef de partie (adv2) et deux Marmitons de
 * corvée (adv3, adv4), tels que la démonstration les donne. Aubépine porte
 * Vif [1] (bonus d'Agilité), Solo du chef [1] (seul sur sa case), Réduction
 * [1], une armure aux types mêlés, et n'a pas la maîtrise de son couteau.
 */
function reference({ cases = {}, retoucher = sansRetouche } = {}) {
  const lieux = { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4", ...cases };
  return etatEssai(
    miseEnPlaceEssai([
      { photo: aubepineEssai(), case: lieux.pj1 },
      { photo: chefDePartieEssai(), case: lieux.adv2 },
      { photo: marmitonDeCorveeEssai(), case: lieux.adv3 },
      { photo: marmitonDeCorveeEssai(), case: lieux.adv4 },
    ]),
    { noms: { pj1: { court: "Aubépine" }, adv2: { court: "Chef" }, adv3: { court: "Marmiton n° 1" }, adv4: { court: "Marmiton n° 2" } }, retoucher },
  );
}

const blesserAubepine = (...zones) => (etat) => {
  for (const zone of zones) etat.protagonistes.pj1.zones[zone].resistance = 0;
};

const VIF = { genre: "passif", nom: "Vif", valeur: 1 };
const MELEE = { genre: "armure_melee", nom: null, nombre: 1, de: null };
// Solo du chef, à sa place parmi les capacités d'Aubépine, retrouvée par son nom.
const SOLO_D_AUBEPINE = { ...SOLO, capacite: indiceDe(reference(), "pj1", "Solo du chef") };

// Ce qu'un témoin vérifie : le dé, son modificateur net, la difficulté, le
// net des avantages, et les deux listes de sources.
function verifier(rendu, { faces, modificateur, difficulte, net, avantages, desavantages }) {
  const jet = ouvrirJet(rendu);
  assert.equal(jet.faces, faces, "le dé");
  assert.equal(modificateurDe(jet), modificateur, "le modificateur net");
  assert.equal(jet.difficulte, difficulte, "la difficulté");
  assert.equal(netDe(jet), net, "le net des avantages");
  assert.deepEqual(rendu.avantages, avantages);
  assert.deepEqual(rendu.desavantages, desavantages);
}

test("référence, étape 1 : Frappe à une case, « d10+1 contre 5, 1 désavantage » (hors maîtrise, sans Solo du chef)", () => {
  const etat = reference({ cases: { pj1: "C3", adv2: "F6" } });
  const rendu = circonstances(etat, joue(etat, "pj1", "Frappe", { cible: "adv3" }));
  assert.deepEqual(rendu.modificateurs, [VIF]);
  verifier(rendu, { faces: 10, modificateur: 1, difficulte: 5, net: -1, avantages: [], desavantages: [{ genre: "maitrise", nom: "Frappe", nombre: 1, de: null }] });
});

test("référence, étape 4 : un Marmiton frappe, Solo du chef et les types mêlés s'annulent, « d8+1 contre 4 »", () => {
  const etat = reference({ cases: { adv2: "F6" } });
  const rendu = circonstances(etat, joue(etat, "adv3", "Frappe", { cible: "pj1" }));
  assert.equal(rendu.genre, "defense");
  assert.equal(rendu.lanceur, "pj1");
  assert.deepEqual(rendu.modificateurs, [VIF], "sa défense agile mobilise l'Agilité");
  verifier(rendu, { faces: 8, modificateur: 1, difficulte: 4, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: [MELEE] });
});

test("référence, étape 8 : Émincer au corps-à-corps, l'avantage et le désavantage de maîtrise s'annulent", () => {
  const etat = reference();
  const rendu = circonstances(etat, joue(etat, "pj1", "Émincer", { cible: "adv3" }));
  verifier(rendu, { faces: 10, modificateur: 1, difficulte: 5, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: [{ genre: "maitrise", nom: "Émincer", nombre: 1, de: null }] });
});

test("référence, étape 9 : Taloche, « d8+1 (Force + Agilité) contre 5, 1 avantage »", () => {
  const etat = reference();
  const rendu = circonstances(etat, joue(etat, "pj1", "Taloche", { cible: "adv4", caracteristiques: ["force", "agilite"] }));
  assert.deepEqual(rendu.caracteristiques, ["force", "agilite"]);
  assert.deepEqual(rendu.modificateurs, [VIF], "le jet mobilise l'Agilité");
  verifier(rendu, { faces: 8, modificateur: 1, difficulte: 5, net: 1, avantages: [SOLO_D_AUBEPINE], desavantages: [] });
});

test("référence, étape 12 : Moulinet farineux hors maîtrise, « Ses 2 avantages (…) et son désavantage (…) laissent 1 avantage »", () => {
  const etat = reference({ retoucher: tuer("adv3") });
  const rendu = circonstances(etat, joue(etat, "adv4", "Moulinet farineux", { cible: "pj1" }));
  verifier(rendu, {
    faces: 8,
    modificateur: 1,
    difficulte: 4,
    net: 1,
    avantages: [SOLO_D_AUBEPINE, { genre: "maitrise", nom: "Moulinet farineux", nombre: 1, de: "Marmiton n° 2" }],
    desavantages: [MELEE],
  });
});

test("référence, étape 14 : Goûter avec une blessure, « d6−1 (Savoir sauvage + Sens) contre 6 (compliqué) », sans avantage", () => {
  const etat = reference({ retoucher: blesserAubepine(2) });
  const rendu = circonstances(etat, joue(etat, "pj1", "Goûter", { mode: "caracteristique", caracteristiques: ["savoir_sauvage", "sens"], difficulte: 6 }));
  assert.equal(rendu.libelle, "compliqué");
  assert.deepEqual(rendu.caracteristiques, ["savoir_sauvage", "sens"]);
  assert.deepEqual(rendu.modificateurs, [{ genre: "blessures", nom: null, valeur: -1 }], "l'Agilité n'y est pas : pas de Vif");
  verifier(rendu, { faces: 6, modificateur: -1, difficulte: 6, net: 0, avantages: [], desavantages: [] });
});

test("référence, étape 16 : le Chef attaque dans sa maîtrise, « d8 contre 5 » (Vif +1, une blessure −1)", () => {
  const etat = reference({ retoucher: (courant) => { tuer("adv3")(courant); blesserAubepine(2)(courant); } });
  const rendu = circonstances(etat, joue(etat, "adv2", "Moulinet farineux", { cible: "pj1" }));
  assert.deepEqual(rendu.modificateurs, [VIF, { genre: "blessures", nom: null, valeur: -1 }]);
  verifier(rendu, { faces: 8, modificateur: 0, difficulte: 5, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: [MELEE] });
});

test("référence, étape 19 : Fournaise avec le jet prêté du couteau, « d10 contre 7, 1 avantage »", () => {
  const etat = reference({ retoucher: (courant) => { tuer("adv3")(courant); blesserAubepine(2)(courant); } });
  const rendu = circonstances(etat, joue(etat, "pj1", "Fournaise", { mode: "jet_prete", cible: "adv2", armePretee: 0 }));
  assert.equal(rendu.genre, "attaque");
  verifier(rendu, { faces: 10, modificateur: 0, difficulte: 7, net: 1, avantages: [SOLO_D_AUBEPINE], desavantages: [] });
});

test("référence, étapes 24 et 25 : deux blessures, « d10−1 contre 5 » puis « d10−1 contre 7 »", () => {
  const etat = reference({ retoucher: (courant) => { tuer("adv3")(courant); blesserAubepine(2, 4)(courant); } });
  const maitrise = [{ genre: "maitrise", nom: "Frappe", nombre: 1, de: null }];
  const contreMarmiton = circonstances(etat, joue(etat, "pj1", "Frappe", { cible: "adv4" }));
  assert.deepEqual(contreMarmiton.modificateurs, [VIF, { genre: "blessures", nom: null, valeur: -2 }]);
  verifier(contreMarmiton, { faces: 10, modificateur: -1, difficulte: 5, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: maitrise });
  const contreChef = circonstances(etat, joue(etat, "pj1", "Frappe", { cible: "adv2" }));
  verifier(contreChef, { faces: 10, modificateur: -1, difficulte: 7, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: maitrise });
});

test("référence, étape 4 au choix : Aubépine, agile et précise à égalité ; « precise » ôte Vif, « d8+1 contre 4 » devient « d8 contre 4 »", () => {
  const etat = reference({ cases: { adv2: "F6" } });
  const marmiton = (defense) => circonstances(etat, joue(etat, "adv3", "Frappe", { cible: "pj1", defense }));
  assert.deepEqual(marmiton(null).modificateurs, [VIF]);
  verifier(marmiton(null), { faces: 8, modificateur: 1, difficulte: 4, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: [MELEE] });
  const precise = marmiton("precise");
  assert.deepEqual(precise.mobilisees, ["precision", "empathie"]);
  assert.deepEqual(precise.modificateurs, [], "Vif ne vaut que pour l'Agilité");
  verifier(precise, { faces: 8, modificateur: 0, difficulte: 4, net: 0, avantages: [SOLO_D_AUBEPINE], desavantages: [MELEE] });
});

test("référence : les causes sans cible de la démonstration ; Frappe et Émincer d'Aubépine hors maîtrise, le Moulinet du Marmiton de corvée, non celui du Chef", () => {
  const etat = reference();
  const sansCible = (id, nom, facon = 0) => sourcesSansCible(etat, id, indiceDe(etat, id, nom), facon);
  assert.deepEqual(sansCible("pj1", "Frappe"), { avantages: [], desavantages: [horsMaitrise("Frappe")] });
  assert.deepEqual(sansCible("pj1", "Émincer"), { avantages: [], desavantages: [horsMaitrise("Émincer")] });
  assert.deepEqual(sansCible("pj1", "Taloche"), RIEN);
  assert.deepEqual(sansCible("adv3", "Moulinet farineux"), { avantages: [], desavantages: [horsMaitrise("Moulinet farineux")] });
  assert.deepEqual(sansCible("adv2", "Moulinet farineux"), RIEN, "la maîtrise du Chef couvre ses deux capacités de spatule");
  assert.deepEqual(sansCible("adv2", "Pas chassé", 1), RIEN, "Pas chassé [2]");
});

// ─── passifsDe : la fiche ───────────────────────────────────────────────────

const POUR_LA_FICHE = [
  { role: "bonus_force", nom: "Costaud", un: "+1 en force", deux: "+2 en force" },
  { role: "bonus_agilite", nom: "Vif", un: "+1 en agilité", deux: "+2 en agilité" },
  { role: "bonus_precision", nom: "Main sûre", un: "+1 en précision", deux: "+2 en précision" },
  { role: "petit", nom: "Demi-portion", un: `+1 en défense, ${SIGNES.moins}1 en force`, deux: `+2 en défense, ${SIGNES.moins}1 en force` },
  { role: "seul_sur_sa_case", nom: "Solo du chef", un: "1 avantage", deux: "2 avantages" },
  { role: "en_meute", nom: "Brigade", un: "1 avantage en attaque", deux: "2 avantages en attaque" },
  { role: "esprit_de_corps", nom: "Coude à coude", un: "1 avantage en défense", deux: "2 avantages en défense" },
  { role: "degrossir", nom: "Réduction", un: "+1 contre l'armure par réussite", deux: "+2 contre l'armure par réussite" },
];

const tousLesPassifs = (niveau) => ensemble(...POUR_LA_FICHE.map(({ role, nom }) => passif(role, nom, niveau)));
const parRole = (liste) => Object.fromEntries(liste.map((un) => [un.role, un]));

test("passifsDe : les huit passifs câblés, leur effet au niveau 1 et au niveau 2, dans l'ordre de la photographie", () => {
  assert.deepEqual(POUR_LA_FICHE.map(({ role }) => role), ROLES_PASSIFS, "les huit rôles, tous");
  for (const [niveau, cle] of [[1, "un"], [2, "deux"]]) {
    const etat = duel({ pj: tousLesPassifs(niveau) });
    const rendus = passifsDe(etat, "pj1");
    assert.deepEqual(rendus.map(({ role }) => role), ROLES_PASSIFS);
    for (const [rang, attendu] of POUR_LA_FICHE.entries()) {
      const rendu = rendus[rang];
      assert.deepEqual(Object.keys(rendu), ["capacite", "nom", "role", "niveau", "effet", "actif", "raison"]);
      assert.equal(rendu.nom, attendu.nom);
      assert.equal(rendu.niveau, niveau);
      assert.equal(rendu.effet, attendu[cle], attendu.role);
      assert.equal(capaciteDe(etat, "pj1", rendu.capacite).nom, attendu.nom, "l'indice désigne la capacité");
    }
  }

  const aRebours = duel({ pj: ensemble(passif("degrossir", "Réduction"), passif("bonus_agilite", "Vif"), passif("seul_sur_sa_case", "Solo du chef")) });
  assert.deepEqual(passifsDe(aRebours, "pj1").map(({ nom }) => nom), ["Réduction", "Vif", "Solo du chef"], "l'ordre de la photographie, tel quel");
  assert.deepEqual(passifsDe(duel(), "pj1"), [], "sans passif câblé, rien");
});

test("passifsDe : un PJ seul sur sa case, puis accompagné", () => {
  const seul = parRole(passifsDe(duel({ pj: tousLesPassifs(1) }), "pj1"));
  for (const role of ["bonus_force", "bonus_agilite", "bonus_precision", "petit", "seul_sur_sa_case", "degrossir"]) {
    assert.equal(seul[role].actif, true, role);
    assert.equal(seul[role].raison, null, role);
  }
  for (const role of ["en_meute", "esprit_de_corps"]) {
    assert.equal(seul[role].actif, false, role);
    assert.equal(seul[role].raison, "aucun allié sur sa case", role);
  }

  const alliee = { photo: brioche(), case: "D4" };
  const accompagne = parRole(passifsDe(duel({ pj: tousLesPassifs(1), autres: [alliee] }), "pj1"));
  assert.equal(accompagne.seul_sur_sa_case.actif, false);
  assert.equal(accompagne.seul_sur_sa_case.raison, "un allié sur sa case");
  for (const role of ["bonus_force", "bonus_agilite", "bonus_precision", "petit", "en_meute", "esprit_de_corps", "degrossir"]) {
    assert.equal(accompagne[role].actif, true, role);
    assert.equal(accompagne[role].raison, null, role);
  }

  const veuve = parRole(passifsDe(duel({ pj: tousLesPassifs(1), autres: [alliee], retoucher: tuer("pj3") }), "pj1"));
  assert.equal(veuve.seul_sur_sa_case.actif, true, "une alliée morte ne compte pas");
  assert.equal(veuve.en_meute.raison, "aucun allié sur sa case");

  const loin = parRole(passifsDe(duel({ pj: tousLesPassifs(1), casePj: "A1" }), "pj1"));
  assert.equal(loin.seul_sur_sa_case.actif, true, "hors d'un jet, seule la case se regarde : le corps-à-corps se juge au jet");
});

test("passifsDe : chez un adversaire, les bonus et le malus ne s'appliquent pas ; les avantages et dégrossir, si", () => {
  const seul = parRole(passifsDe(duel({ adv: tousLesPassifs(2) }), "adv2"));
  for (const role of ["bonus_force", "bonus_agilite", "bonus_precision", "petit"]) {
    assert.equal(seul[role].actif, false, role);
    assert.equal(seul[role].raison, "ne s'applique pas à un adversaire", role);
  }
  assert.equal(seul.petit.effet, `+2 en défense, ${SIGNES.moins}1 en force`, "l'effet reste écrit");
  assert.equal(seul.seul_sur_sa_case.actif, true);
  assert.equal(seul.en_meute.raison, "aucun allié sur sa case");
  assert.equal(seul.esprit_de_corps.raison, "aucun allié sur sa case");
  assert.equal(seul.degrossir.actif, true);
  assert.equal(seul.degrossir.raison, null);

  const accompagne = parRole(passifsDe(duel({ adv: tousLesPassifs(2), autres: [{ photo: commis(), case: "D4" }] }), "adv2"));
  assert.equal(accompagne.seul_sur_sa_case.raison, "un allié sur sa case");
  assert.equal(accompagne.en_meute.actif, true);
  assert.equal(accompagne.esprit_de_corps.actif, true);
  assert.equal(accompagne.bonus_force.raison, "ne s'applique pas à un adversaire", "un allié n'y change rien");
  assert.equal(accompagne.degrossir.actif, true, "dégrossir n'est jamais inactif");
});

test("passifsDe dit « actif » ce que le jet applique, et « inactif » ce qu'il n'applique pas", () => {
  // Au corps-à-corps, la fiche et le jet lisent la même table.
  for (const autres of [[], [{ photo: brioche(), case: "D4" }]]) {
    const etat = duel({ pj: ensemble(solo(), brigade(), coude()), autres });
    const fiche = parRole(passifsDe(etat, "pj1"));
    const appliques = new Set([...attaqueDuPj(etat).avantages, ...attaqueDeLAdversaire(etat).avantages].map(({ nom }) => nom));
    for (const { nom, actif } of Object.values(fiche)) {
      assert.equal(appliques.has(nom), actif, `${nom}, ${autres.length} alliée sur la case`);
    }
  }
});

// Relecture de fin de groupe (lot 4) : au niveau 0, la fiche disait « +0 en
// force », « 0 avantage », actifs, quand le jet n'en applique rien.
test("passifsDe : au niveau 0, un passif câblé se dit inactif, « niveau 0 », et non « +0 » ; « petit » ne garde que son −1 de Force", () => {
  const alliee = { photo: brioche(), case: "D4" };
  for (const autres of [[], [alliee]]) {
    const etat = duel({ pj: tousLesPassifs(0), autres });
    const rendus = passifsDe(etat, "pj1");
    assert.deepEqual(rendus.map(({ role }) => role), ROLES_PASSIFS, "les huit restent sur la fiche");
    const fiche = parRole(rendus);
    for (const role of ROLES_PASSIFS.filter((un) => un !== "petit")) {
      assert.deepEqual(Object.keys(fiche[role]), ["capacite", "nom", "role", "niveau", "effet", "actif", "raison"]);
      assert.deepEqual([fiche[role].niveau, fiche[role].effet, fiche[role].actif, fiche[role].raison], [0, "sans effet", false, "niveau 0"], role);
    }
    assert.deepEqual([fiche.petit.effet, fiche.petit.actif, fiche.petit.raison], [`${SIGNES.moins}1 en force`, true, null], "le −1 de Force ne dépend pas du niveau");
    for (const { effet, nom } of rendus) assert.doesNotMatch(effet, /(^|\D)0(\D|$)/, `${nom} : aucun « +0 », aucun « 0 avantage »`);

    // La fiche dit ce que fait le jet : de ces huit passifs, il n'applique que le −1 de Force.
    const tout = ["force", "agilite", "precision"];
    const appliques = [
      ...modificateursDe(etat, "pj1", { genre: "attaque", mobilisees: tout }),
      ...modificateursDe(etat, "pj1", { genre: "defense", mobilisees: tout }),
      ...attaqueDuPj(etat).avantages,
      ...attaqueDeLAdversaire(etat).avantages,
    ];
    const MALUS = { genre: "passif", nom: "Demi-portion", valeur: -1 };
    assert.deepEqual(appliques, [MALUS, MALUS], `${autres.length} alliée sur la case`);
    for (const { nom, role, actif } of rendus) {
      if (role !== "degrossir") assert.equal(appliques.some((applique) => applique.nom === nom), actif, nom);
    }
  }

  // Chez un adversaire, de même : « niveau 0 » passe avant toute autre raison ; le −1 de « petit » ne s'applique pas à lui.
  const adverse = parRole(passifsDe(duel({ adv: tousLesPassifs(0) }), "adv2"));
  for (const role of ROLES_PASSIFS.filter((un) => un !== "petit")) assert.deepEqual([adverse[role].effet, adverse[role].raison], ["sans effet", "niveau 0"], role);
  assert.deepEqual([adverse.petit.effet, adverse.petit.actif, adverse.petit.raison], [`${SIGNES.moins}1 en force`, false, "ne s'applique pas à un adversaire"]);
  assert.deepEqual(attaqueDuPj(duel({ adv: tousLesPassifs(0) })).desavantages, [], "et rien ne passe au personnage, inversé");

  // Le voisin : au niveau 1, les mêmes passifs disent leur effet, et jouent.
  const unDePlus = parRole(passifsDe(duel({ pj: tousLesPassifs(1) }), "pj1"));
  assert.deepEqual([unDePlus.bonus_force.effet, unDePlus.bonus_force.actif, unDePlus.bonus_force.raison], ["+1 en force", true, null]);
  assert.deepEqual([unDePlus.degrossir.effet, unDePlus.degrossir.actif], ["+1 contre l'armure par réussite", true]);
  assert.equal(unDePlus.petit.effet, `+1 en défense, ${SIGNES.moins}1 en force`);
});

test("référence : la fiche d'Aubépine, seule PJ, porte ses trois passifs actifs", () => {
  const etat = reference();
  assert.deepEqual(passifsDe(etat, "pj1"), [
    { capacite: indiceDe(etat, "pj1", "Réduction"), nom: "Réduction", role: "degrossir", niveau: 1, effet: "+1 contre l'armure par réussite", actif: true, raison: null },
    { capacite: indiceDe(etat, "pj1", "Vif"), nom: "Vif", role: "bonus_agilite", niveau: 1, effet: "+1 en agilité", actif: true, raison: null },
    { capacite: indiceDe(etat, "pj1", "Solo du chef"), nom: "Solo du chef", role: "seul_sur_sa_case", niveau: 1, effet: "1 avantage", actif: true, raison: null },
  ]);
  assert.deepEqual(passifsDe(etat, "adv3"), [], "un Marmiton de corvée n'a aucun passif câblé");
});
