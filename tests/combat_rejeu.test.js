// Contrôles du rejeu du simulateur de combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) », et § 11).
//
// Un combat gardé n'est qu'une mise en place et une suite d'événements : tout
// le reste se recalcule en les rejouant. Un rechargement en plein combat ne
// retrouve donc l'état, le journal et le dé attendu que si le moteur est
// exactement rejouable. Ce fichier tient les propriétés qui font ce rejeu,
// sur le combat de référence fictif, joué par les photographies de la
// démonstration :
// 1. rejouer les n premiers événements rend l'état tenu un événement à la
//    fois, pour tout n, journal compris ;
// 2. un passage par JSON ne change rien ;
// 3. le moteur ne modifie rien de ce qu'il reçoit, et tout ce qu'il rend est
//    gelé ;
// 4. il ne lit ni l'heure, ni le hasard, ni la langue de l'appareil ;
// 5. il ne lit ni la banque, ni la source des photographies ;
// 6. ses fichiers n'importent que ce que le noyau permet, sans cycle ;
// 7. des événements au hasard, bien et mal faits, ne le font jamais lever, et
//    toute suite acceptée se rejoue à l'identique ;
// 8. un dé lancé n'est jamais redemandé ;
// 9. l'offre et le réducteur concordent : ce que portent les vues est accepté,
//    tout autre type d'événement est refusé.
//
// Le hasard de ce fichier est un générateur à graine écrite : un échec se
// retrouve à l'identique.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { sourceAleatoire } from "../js/combat/des.js";
import { validerContenu, validerEvenement } from "../js/combat/forme.js";
import { texteDuJournal } from "../js/combat/journal.js";
import { vueBarre, vueFiche, vuePanneau, vuePlateau } from "../js/combat/lecture.js";
import { appliquer, gesteEnCours, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import { boutons, candidats, offre } from "../js/combat/offre.js";
import { photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { tableDesRoles } from "../js/combat/roles.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter, lirePersonnage } from "../js/personnage/format.js";
import { CARACTERISTIQUES } from "../js/personnage/regles.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { journalAttendu, scenario } from "./outils/combat_reference.js";
import { versContenu } from "./outils/scenario.js";

// ─── Le combat de référence, par les photographies de la démonstration ──────

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const INDEX = indexerCreation(BANQUE);
const ROLES = await tableDesRoles(BANQUE, "demo");
const ADVERSAIRES = indexerAdversaires(BANQUE, INDEX);
const photoDe = (rendu) => {
  assert.equal(rendu.refus, undefined, rendu.refus);
  return rendu.photo;
};
const PHOTOS = {
  "Aubépine Crèmebrûlée": photoDe(photographierPersonnage(BANQUE, lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage, { index: INDEX, roles: ROLES })),
  "Chef de partie": photoDe(photographierAdversaire(ADVERSAIRES, "Chef de partie", { banque: BANQUE, roles: ROLES })),
  "Marmiton de corvée": photoDe(photographierAdversaire(ADVERSAIRES, "Marmiton de corvée", { banque: BANQUE, roles: ROLES })),
};

const { contenu: CONTENU } = versContenu(scenario, PHOTOS);
const NOMBRE = CONTENU.evenements.length;
const prefixe = (n, contenu = CONTENU) => ({ ...contenu, evenements: contenu.evenements.slice(0, n) });

// L'état tenu un événement à la fois, comme le tient l'écran en jeu :
// TENUS[n] est l'état après n événements.
const TENUS = [ouvrirCombat(CONTENU.miseEnPlace)];
for (const evenement of CONTENU.evenements) {
  const { etat, refus } = appliquer(TENUS.at(-1), evenement);
  assert.equal(refus, undefined, refus?.message);
  TENUS.push(etat);
}
const FINAL = TENUS.at(-1);
const lignesDe = (etat) => etat.journal.map((ligne) => ligne.texte);

const CODES_DE_REFUS = ["forme", "hors_moment", "hors_bornes", "interdit"];
const TYPES = ["lancer", "capacite", "regler", "revenir", "confirmer", "de", "relancer", "garder", "exploser", "degats", "decaler", "esquive", "appliquer", "passer", "fin_de_tour"];

// Où deux valeurs se séparent : le chemin du premier écart, pour qu'un échec
// dise autre chose que deux états entiers.
function premierEcart(a, b, chemin = "etat") {
  if (Object.is(a, b)) return null;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return `${chemin} : ${JSON.stringify(a)} contre ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${chemin} : une liste contre un objet`;
  const clesA = Object.keys(a);
  const clesB = Object.keys(b);
  if (clesA.join("|") !== clesB.join("|")) return `${chemin} : les clés [${clesA.join(", ")}] contre [${clesB.join(", ")}]`;
  for (const cle of clesA) {
    const ecart = premierEcart(a[cle], b[cle], `${chemin}.${cle}`);
    if (ecart !== null) return ecart;
  }
  return null;
}

function memeEtat(obtenu, attendu, quoi) {
  const ecart = premierEcart(obtenu, attendu);
  assert.equal(ecart, null, `${quoi} : ${ecart}`);
  assert.deepStrictEqual(obtenu, attendu, quoi);
}

// ─── 1. Les préfixes ────────────────────────────────────────────────────────

test("la sonde des écarts dit où deux états se séparent, et se tait sur deux états égaux", () => {
  assert.equal(premierEcart({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), null);
  assert.equal(premierEcart({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }), "etat.a.1.b : 2 contre 3");
  assert.equal(premierEcart({ a: 1, b: 2 }, { b: 2, a: 1 }), "etat : les clés [a, b] contre [b, a]", "jusqu'à l'ordre des clés");
  assert.equal(premierEcart({ a: [] }, { a: {} }), "etat.a : une liste contre un objet");
  assert.equal(premierEcart({ a: null }, { a: {} }), "etat.a : null contre {}");
  assert.throws(() => memeEtat({ pas: 1 }, { pas: 2 }, "deux états"), /deux états : etat[.]pas : 1 contre 2/);
  // Un événement de plus fait toujours un autre état : la comparaison des préfixes ne passe pas à vide.
  for (let n = 0; n < NOMBRE; n += 1) assert.notEqual(premierEcart(TENUS[n], TENUS[n + 1]), null, `l'événement n° ${n + 1} change l'état`);
});

test("le combat de référence, rejoué, rend son journal attendu : c'est bien lui que ces contrôles éprouvent", () => {
  assert.equal(NOMBRE, 105);
  assert.deepEqual(lignesDe(FINAL), journalAttendu);
  assert.equal(FINAL.phase, "termine");
});

test("préfixes : pour tout n, rejouer les n premiers événements rend l'état tenu un événement à la fois, journal compris", () => {
  for (let n = 0; n <= NOMBRE; n += 1) {
    const rejoue = rejouer(prefixe(n));
    assert.equal(rejoue.erreur, undefined, `après ${n} événement(s) : ${rejoue.erreur?.message}`);
    memeEtat(rejoue.etat, TENUS[n], `après ${n} événement(s)`);
    assert.equal(rejoue.etat.pas, n);
  }
  // Le journal ne perd jamais une ligne, et n'en récrit aucune.
  for (let n = 1; n <= NOMBRE; n += 1) {
    const avant = lignesDe(TENUS[n - 1]);
    assert.deepEqual(lignesDe(TENUS[n]).slice(0, avant.length), avant, `l'événement n° ${n} ne touche pas aux lignes déjà écrites`);
  }
});

test("préfixes : le rejeu s'arrête au premier refus et dit lequel, sans tronquer la suite en silence", () => {
  // Un événement qui ne se répète jamais (le lancement, une confirmation, « Appliquer »), glissé deux fois de suite :
  // le second n'est plus attendu.
  const sansReplique = CONTENU.evenements.flatMap((evenement, rang) => (["lancer", "confirmer", "appliquer"].includes(evenement.type) ? [rang + 1] : []));
  assert.equal(sansReplique.length, 13);
  for (const n of sansReplique) {
    const abime = { ...CONTENU, evenements: [...CONTENU.evenements.slice(0, n), CONTENU.evenements[n - 1], ...CONTENU.evenements.slice(n)] };
    const rejoue = rejouer(abime);
    assert.equal(rejoue.etat, undefined);
    assert.equal(rejoue.erreur.pas, n + 1, `l'événement doublé après le n° ${n}`);
    assert.ok(CODES_DE_REFUS.includes(rejoue.erreur.code));
    assert.equal(typeof rejoue.erreur.message, "string");
  }
  // Désarmé : un événement de moins se rejoue, et rend l'état d'avant.
  assert.equal(rejouer(prefixe(NOMBRE - 1)).erreur, undefined);
});

// ─── 2. Le passage par JSON ─────────────────────────────────────────────────

test("JSON : le contenu passé par JSON se rejoue au même état, à la fin comme en plein geste", () => {
  for (let n = 0; n <= NOMBRE; n += 1) {
    const rejoue = rejouer(JSON.parse(JSON.stringify(prefixe(n))));
    assert.equal(rejoue.erreur, undefined, `après ${n} événement(s) : ${rejoue.erreur?.message}`);
    memeEtat(rejoue.etat, TENUS[n], `après ${n} événement(s), par JSON`);
    assert.equal(JSON.stringify(rejoue.etat), JSON.stringify(TENUS[n]), "jusqu'à l'ordre des clés");
  }
});

test("JSON : l'état lui-même n'est fait que de données simples, il passe par JSON à l'identique", () => {
  for (let n = 0; n <= NOMBRE; n += 1) memeEtat(JSON.parse(JSON.stringify(TENUS[n])), TENUS[n], `l'état après ${n} événement(s)`);
});

test("JSON : le combat gardé repasse par la validation de la forme, puis se rejoue au même état", () => {
  for (const n of [0, 1, 52, NOMBRE]) {
    const lu = validerContenu(JSON.parse(JSON.stringify(prefixe(n))), { mode: "demo", revision: CONTENU.revision, accepter });
    assert.equal(lu.erreur, undefined, lu.erreur);
    memeEtat(rejouer(lu.contenu).etat, TENUS[n], `après ${n} événement(s), relu`);
  }
  // Armé : la démonstration ne relit pas ce contenu comme un combat du mode réel.
  assert.notEqual(validerContenu(JSON.parse(JSON.stringify(CONTENU)), { mode: "reel", revision: CONTENU.revision, accepter }).erreur, undefined);
});

// ─── 3. Le gel ──────────────────────────────────────────────────────────────

// Gèle tout, sans rien croire déjà gelé.
function gelerTout(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== "object" || vus.has(valeur)) return valeur;
  vus.add(valeur);
  Object.freeze(valeur);
  for (const enfant of Object.values(valeur)) gelerTout(enfant, vus);
  return valeur;
}

// Le chemin du premier objet qui n'est pas gelé, ou null.
function nonGele(valeur, chemin = "etat", vus = new Set()) {
  if (valeur === null || typeof valeur !== "object" || vus.has(valeur)) return null;
  vus.add(valeur);
  if (!Object.isFrozen(valeur)) return chemin;
  for (const [cle, enfant] of Object.entries(valeur)) {
    const trouve = nonGele(enfant, `${chemin}.${cle}`, vus);
    if (trouve !== null) return trouve;
  }
  return null;
}

test("gel : les deux sondes de ce contrôle voient ce qu'elles doivent voir", () => {
  const objet = { a: [{ b: 1 }], c: { d: {} } };
  assert.equal(nonGele(objet), "etat");
  Object.freeze(objet);
  assert.equal(nonGele(objet), "etat.a", "un objet gelé en surface n'est pas gelé");
  gelerTout(objet);
  assert.equal(nonGele(objet), null);
  assert.throws(() => {
    objet.c.d.e = 1;
  }, TypeError);
});

test("gel : tout gelé avant chaque événement, le combat se joue jusqu'au bout ; et tout ce que rend le moteur est déjà gelé", () => {
  const miseEnPlace = gelerTout(JSON.parse(JSON.stringify(CONTENU.miseEnPlace)));
  let etat = ouvrirCombat(miseEnPlace);
  assert.equal(nonGele(etat), null, `l'état ouvert : ${nonGele(etat)}`);
  CONTENU.evenements.forEach((evenement, rang) => {
    gelerTout(etat);
    const rendu = appliquer(etat, gelerTout(structuredClone(evenement)));
    assert.equal(rendu.refus, undefined, `événement n° ${rang + 1} : ${rendu.refus?.message}`);
    assert.equal(nonGele(rendu.etat), null, `événement n° ${rang + 1} (${evenement.type}) : ${nonGele(rendu.etat)} n'est pas gelé`);
    assert.notEqual(rendu.etat, etat);
    etat = rendu.etat;
  });
  assert.deepEqual(lignesDe(etat), journalAttendu);
  memeEtat(etat, FINAL, "le combat joué sur des données gelées");
});

test("gel : un événement refusé rend l'état reçu, l'objet même, à chaque moment du combat", () => {
  for (let n = 0; n <= NOMBRE; n += 1) {
    const etat = gelerTout(TENUS[n]);
    const rendu = appliquer(etat, gelerTout({ type: "danser" }));
    assert.equal(rendu.etat, etat);
    assert.equal(rendu.refus.code, "forme");
  }
});

test("gel : un état partage avec le précédent ce qui n'a pas changé", () => {
  for (let n = 2; n <= NOMBRE; n += 1) {
    assert.equal(TENUS[n].photos, TENUS[n - 1].photos, "les photographies ne sont jamais recopiées");
    assert.equal(TENUS[n].noms, TENUS[n - 1].noms, "les noms sont figés au lancement");
    assert.equal(TENUS[n].ordre, TENUS[n - 1].ordre);
  }
  // Un dé de la chaîne ne touche à aucun protagoniste hors de celui qui paie.
  const premierDe = CONTENU.evenements.findIndex((evenement) => evenement.type === "de");
  const [avant, apres] = [TENUS[premierDe], TENUS[premierDe + 1]];
  const inchanges = avant.ordre.filter((id) => apres.protagonistes[id] === avant.protagonistes[id]);
  assert.equal(inchanges.length, avant.ordre.length - 1, "seul celui qui paie son action est refait");
});

// ─── 4. Ni heure, ni hasard, ni langue de l'appareil ────────────────────────

// Pendant « action », toute lecture de l'heure, du hasard ou de la langue de
// l'appareil lève. Tout est remis en place ensuite, quoi qu'il arrive.
function sansHeureNiHasard(action) {
  const lever = (quoi) =>
    function interdit() {
      throw new Error(`Le noyau a lu ${quoi}.`);
    };
  const DateInterdite = lever("l'heure (Date)");
  for (const nom of ["now", "parse", "UTC"]) DateInterdite[nom] = lever(`l'heure (Date.${nom})`);

  const poses = [];
  const poser = (objet, nom, valeur) => {
    poses.push([objet, nom, Object.getOwnPropertyDescriptor(objet, nom)]);
    Object.defineProperty(objet, nom, { value: valeur, configurable: true, writable: true });
  };
  try {
    poser(globalThis, "Date", DateInterdite);
    poser(Math, "random", lever("le hasard (Math.random)"));
    poser(globalThis.crypto, "getRandomValues", lever("le hasard (crypto.getRandomValues)"));
    poser(String.prototype, "localeCompare", lever("la langue de l'appareil (localeCompare)"));
    for (const prototype of [String.prototype, Number.prototype, Array.prototype]) {
      for (const nom of Object.getOwnPropertyNames(prototype).filter((un) => un.startsWith("toLocale"))) poser(prototype, nom, lever(`la langue de l'appareil (${nom})`));
    }
    return action();
  } finally {
    for (const [objet, nom, descripteur] of poses.reverse()) {
      if (descripteur) Object.defineProperty(objet, nom, descripteur);
      else delete objet[nom];
    }
  }
}

test("ni heure ni hasard : le piège lève sur chaque lecture, puis rend tout comme il l'a trouvé", () => {
  const lectures = [
    () => Date.now(),
    () => new Date(),
    () => Date(),
    () => Date.parse("2026-10-12"),
    () => Math.random(),
    () => crypto.getRandomValues(new Uint8Array(1)),
    () => "a".localeCompare("b"),
    () => (1234).toLocaleString("fr"),
    () => "A".toLocaleLowerCase(),
    // La source de dés de l'écran, elle, lit le hasard : c'est ce que le noyau ne doit jamais faire.
    () => sourceAleatoire().lancer(6),
  ];
  for (const lecture of lectures) assert.throws(() => sansHeureNiHasard(lecture), /^Error: Le noyau a lu /, String(lecture));

  // Désarmé : hors du piège, tout répond comme avant, y compris après une lecture qui a levé.
  assert.equal(typeof Date.now(), "number");
  assert.ok(new Date() instanceof Date);
  assert.equal(typeof Math.random(), "number");
  assert.equal(crypto.getRandomValues(new Uint8Array(4)).length, 4);
  assert.equal("a".localeCompare("b"), -1);
  assert.equal(Object.hasOwn(globalThis.crypto, "getRandomValues"), false, "rien ne reste posé sur crypto");
  assert.equal(sansHeureNiHasard(() => 7), 7);
  const [de] = sourceAleatoire().lancer(6);
  assert.ok(de >= 1 && de <= 6);
});

test("ni heure ni hasard : sous le piège, le combat se rejoue au même état ; l'offre, les vues et le texte du journal se lisent", () => {
  const { rejoue, texte } = sansHeureNiHasard(() => {
    const rendu = rejouer(CONTENU);
    for (const etat of TENUS) {
      offre(etat);
      const choisi = candidats(etat)[0] ?? null;
      vueBarre(etat);
      vuePlateau(etat, choisi);
      vuePanneau(etat, choisi);
      for (const id of etat.ordre) vueFiche(etat, id, choisi);
    }
    return { rejoue: rendu, texte: texteDuJournal(rendu.etat) };
  });
  assert.equal(rejoue.erreur, undefined, rejoue.erreur?.message);
  memeEtat(rejoue.etat, FINAL, "le combat rejoué sous le piège");

  // L'heure du lancement est une donnée de l'événement : l'en-tête l'écrit sans consulter l'horloge.
  assert.deepEqual(texte.split("\n").slice(0, 5), [
    "Simulateur de combat — L'Atelier des Arpenteurs",
    "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)",
    "Personnages : Aubépine Crèmebrûlée",
    "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2",
    "",
  ]);
  assert.deepEqual(texte.split("\n").slice(5), journalAttendu);
});

test("ni heure ni hasard : l'heure du lancement ne vient que de l'événement « lancer »", () => {
  const autreHeure = { ...CONTENU, evenements: [{ type: "lancer", le: "2031-01-02T03:04" }, ...CONTENU.evenements.slice(1)] };
  const rejoue = rejouer(autreHeure).etat;
  assert.equal(rejoue.lanceLe, "2031-01-02T03:04");
  assert.equal(FINAL.lanceLe, scenario.lanceLe);
  // Rien d'autre n'en dépend : le journal et tout le reste de l'état sont les mêmes.
  memeEtat({ ...rejoue, lanceLe: FINAL.lanceLe }, FINAL, "le combat lancé à une autre heure");
});

// ─── 5. Ni banque ───────────────────────────────────────────────────────────

const avecDesPhotos = (retoucher) => ({
  ...CONTENU,
  miseEnPlace: { ...CONTENU.miseEnPlace, protagonistes: CONTENU.miseEnPlace.protagonistes.map((protagoniste) => ({ ...protagoniste, photo: retoucher(protagoniste.photo) })) },
});

test("ni banque : la source des photographies mise à null, le combat se rejoue au même état, avec le même journal", () => {
  assert.ok(CONTENU.miseEnPlace.protagonistes.every(({ photo }) => photo.source !== null), "ces photographies viennent de la banque : elles portent leur source");
  const sansSource = avecDesPhotos((photo) => ({ ...photo, source: null }));
  for (const n of [0, 1, 52, NOMBRE]) memeEtat(rejouer(prefixe(n, sansSource)).etat, TENUS[n], `après ${n} événement(s), sans source`);
  assert.deepEqual(lignesDe(rejouer(sansSource).etat), journalAttendu);
});

test("ni banque : le noyau ne lit jamais la source ni les avertissements d'une photographie, seulement ses valeurs", () => {
  const lever = (quoi) => () => {
    throw new Error(`Le noyau a lu ${quoi} d'une photographie.`);
  };
  const piegee = (photo) => {
    const copie = { camp: photo.camp, publiee_le: photo.publiee_le, valeurs: photo.valeurs };
    Object.defineProperty(copie, "source", { enumerable: true, get: lever("la source") });
    Object.defineProperty(copie, "avertissements", { enumerable: true, get: lever("les avertissements") });
    return copie;
  };
  const piege = avecDesPhotos(piegee);
  // Armé : la photographie piégée lève bien quand on la lit.
  assert.throws(() => piege.miseEnPlace.protagonistes[0].photo.source, /la source/);
  // Désarmé : le rejeu ne la lit pas.
  const rejoue = rejouer(piege);
  assert.equal(rejoue.erreur, undefined, rejoue.erreur?.message);
  memeEtat(rejoue.etat, FINAL, "le combat rejoué sur des photographies piégées");

  // L'état ne porte ni la mise en place ni une source : seulement les valeurs, par référence.
  for (const [rang, { id, photo }] of CONTENU.miseEnPlace.protagonistes.entries()) {
    assert.equal(FINAL.photos[id], photo.valeurs, `protagoniste n° ${rang + 1}`);
  }
  assert.equal(JSON.stringify(FINAL).includes('"source"'), false);
  assert.equal(JSON.stringify(FINAL).includes('"miseEnPlace"'), false);
});

// ─── 6. Le graphe des imports ───────────────────────────────────────────────

// Ce que chaque fichier du noyau a le droit d'importer : la colonne « Importe »
// du § 17. Tout le noyau tient dans js/combat/, plus deux modules sans import
// de l'appareil : la clé des noms, et les règles du personnage.
const HORS_NOYAU_PERMIS = ["js/banque/noms.js", "js/personnage/regles.js"];
const NOYAU = {
  "regles.js": [],
  "forme.js": ["regles.js", "../personnage/regles.js"],
  "plateau.js": ["regles.js"],
  "noms.js": ["../banque/noms.js"],
  "preparation.js": ["plateau.js", "regles.js"],
  "jet.js": ["regles.js"],
  "valeurs.js": [],
  "circonstances.js": ["valeurs.js", "plateau.js", "regles.js", "../personnage/regles.js"],
  "degats.js": ["valeurs.js", "jet.js", "regles.js"],
  "offre.js": ["valeurs.js", "circonstances.js", "degats.js", "jet.js", "plateau.js", "forme.js", "regles.js", "../personnage/regles.js"],
  "journal.js": ["regles.js", "valeurs.js", "jet.js", "degats.js", "../personnage/regles.js"],
  "moteur.js": ["regles.js", "forme.js", "plateau.js", "noms.js", "preparation.js", "jet.js", "valeurs.js", "circonstances.js", "degats.js", "offre.js", "journal.js", "../personnage/regles.js"],
  "lecture.js": ["offre.js", "circonstances.js", "valeurs.js", "degats.js", "jet.js", "journal.js", "preparation.js", "noms.js", "regles.js", "../personnage/regles.js"],
};
// Le bord : ce qui touche la banque, le hasard, la clé ou l'appareil.
const BORD = ["des.js", "enregistrement.js", "photographie.js", "roles.js", "seance.js"];

const MOTIF_IMPORT = /^(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gms;
const MOTIF_IMPORT_NU = /^import\s*["']([^"']+)["']/gm;
const importsDe = (source) => [...source.matchAll(MOTIF_IMPORT), ...source.matchAll(MOTIF_IMPORT_NU)].map((trouve) => trouve[1]);
// Le chemin d'un import, depuis la racine du dépôt.
const resoudre = (depuis, chemin) => new URL(chemin, new URL(depuis, racine)).href.slice(racine.href.length);
const sourceDe = (fichier) => lire(fichier);

test("le graphe : la lecture des imports voit chaque forme d'import, sur plusieurs lignes comme en réexport", () => {
  const source = ['import { a } from "./a.js";', "import {", "  b,", "  c,", '} from "../b/c.js";', 'export { d } from "./d.js";', 'import * as e from "./e.js";', 'import "./f.js";', "export const from = 1;", 'const g = "./g.js";'].join("\n");
  assert.deepEqual(importsDe(source), ["./a.js", "../b/c.js", "./d.js", "./e.js", "./f.js"]);
  assert.equal(resoudre("js/combat/forme.js", "../personnage/regles.js"), "js/personnage/regles.js");
  assert.equal(resoudre("js/combat/moteur.js", "./offre.js"), "js/combat/offre.js");
  // Le moteur réexporte le geste en cours : c'est un import comme un autre.
  assert.ok(importsDe(sourceDe("js/combat/moteur.js")).filter((chemin) => chemin === "./valeurs.js").length === 2);
});

test("le graphe : tout fichier de js/combat/ est du noyau ou du bord, et aucun n'est oublié", () => {
  const fichiers = readdirSync(new URL("js/combat/", racine)).sort();
  assert.deepEqual(fichiers, [...Object.keys(NOYAU), ...BORD].sort(), "un fichier neuf de js/combat/ se range ici, dans le noyau ou dans le bord");
  assert.equal(Object.keys(NOYAU).length, 13);
});

test("le graphe : chaque fichier du noyau n'importe que ce que sa ligne permet, et rien à la volée", () => {
  for (const [fichier, permis] of Object.entries(NOYAU)) {
    const source = sourceDe(`js/combat/${fichier}`);
    const attendus = permis.map((chemin) => resoudre(`js/combat/${fichier}`, chemin.startsWith(".") ? chemin : `./${chemin}`));
    for (const chemin of importsDe(source)) {
      const importe = resoudre(`js/combat/${fichier}`, chemin);
      assert.ok(attendus.includes(importe), `${fichier} importe ${importe}, que sa ligne ne permet pas`);
      assert.ok(importe.startsWith("js/combat/") ? Object.hasOwn(NOYAU, importe.slice("js/combat/".length)) : HORS_NOYAU_PERMIS.includes(importe), `${fichier} importe ${importe}, qui n'est pas du noyau`);
    }
    assert.equal(/\bimport\s*\(/.test(source), false, `${fichier} : aucun import à la volée`);
    assert.equal(/\brequire\s*\(/.test(source), false, `${fichier} : aucun require`);
  }
  // Ni l'offre ni les vues n'importent le moteur : elles ne peuvent pas diverger de lui, il sort d'elles.
  for (const fichier of ["offre.js", "lecture.js"]) assert.equal(NOYAU[fichier].includes("moteur.js"), false);
});

test("le graphe : tout ce que le noyau atteint, d'import en import, reste dans le noyau", () => {
  for (const fichier of Object.keys(NOYAU)) {
    const atteints = new Set();
    const visiter = (chemin) => {
      if (atteints.has(chemin)) return;
      atteints.add(chemin);
      for (const importe of importsDe(sourceDe(chemin))) visiter(resoudre(chemin, importe));
    };
    visiter(`js/combat/${fichier}`);
    for (const chemin of atteints) {
      assert.ok(chemin.startsWith("js/combat/") ? Object.hasOwn(NOYAU, chemin.slice("js/combat/".length)) : HORS_NOYAU_PERMIS.includes(chemin), `${fichier} atteint ${chemin}`);
    }
    if (fichier === "offre.js" || fichier === "lecture.js") assert.equal(atteints.has("js/combat/moteur.js"), false, `${fichier} n'atteint jamais le moteur`);
  }
  // Armé : le bord, lui, sort du noyau.
  assert.ok(importsDe(sourceDe("js/combat/photographie.js")).some((chemin) => !HORS_NOYAU_PERMIS.includes(resoudre("js/combat/photographie.js", chemin)) && !chemin.startsWith("./")));
});

// Un cycle parmi les imports de js/combat/, par un parcours en profondeur : le
// chemin du premier fichier retrouvé en cours de visite, ou null.
function cycleDans(graphe) {
  const finis = new Set();
  const visiter = (fichier, pile) => {
    if (pile.includes(fichier)) return [...pile.slice(pile.indexOf(fichier)), fichier].join(" → ");
    if (finis.has(fichier)) return null;
    for (const importe of graphe[fichier] ?? []) {
      const cycle = visiter(importe, [...pile, fichier]);
      if (cycle !== null) return cycle;
    }
    finis.add(fichier);
    return null;
  };
  for (const fichier of Object.keys(graphe)) {
    const cycle = visiter(fichier, []);
    if (cycle !== null) return cycle;
  }
  return null;
}

test("le graphe : aucun cycle d'import dans js/combat/", () => {
  // Armé, puis désarmé, sur deux graphes écrits à la main.
  assert.equal(cycleDans({ a: ["b"], b: ["c"], c: ["a"] }), "a → b → c → a");
  assert.equal(cycleDans({ a: ["a"] }), "a → a");
  assert.equal(cycleDans({ a: ["b", "c"], b: ["c"], c: [] }), null);

  const graphe = {};
  for (const fichier of readdirSync(new URL("js/combat/", racine))) {
    const chemin = `js/combat/${fichier}`;
    graphe[chemin] = importsDe(sourceDe(chemin))
      .map((importe) => resoudre(chemin, importe))
      .filter((importe) => importe.startsWith("js/combat/"));
  }
  assert.equal(Object.keys(graphe).length, 18);
  assert.equal(cycleDans(graphe), null);
});

test("le graphe : le texte du noyau ne nomme ni l'horloge, ni le hasard, ni la langue de l'appareil, ni la page, ni la base", () => {
  const INTERDITS = ["localeCompare", "toLocale", "Intl", "new Date", "Date.now", "Math.random", "document", "indexedDB"];
  for (const fichier of Object.keys(NOYAU)) {
    const source = sourceDe(`js/combat/${fichier}`);
    for (const interdit of INTERDITS) assert.equal(source.includes(interdit), false, `${fichier} contient « ${interdit} »`);
  }
  // Armé : le bord, lui, en nomme ; la recherche les voit.
  assert.ok(sourceDe("js/combat/seance.js").includes("new Date"));
  assert.ok(sourceDe("js/combat/enregistrement.js").includes("indexedDB"));
});

// ─── 7. Des événements au hasard ────────────────────────────────────────────

// Un générateur congruentiel, à graine écrite.
function hasardDe(graine) {
  let etat = graine >>> 0;
  const suivant = () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
  const entier = (min, max) => min + Math.floor(suivant() * (max - min + 1));
  return { suivant, entier, parmi: (liste) => liste[entier(0, liste.length - 1)] };
}

const CODES = CARACTERISTIQUES.map((caracteristique) => caracteristique.code);
const IDS = ["pj1", "adv2", "adv3", "adv4", "pj5", "adv9", "pj0", "constructor", "__proto__"];
const CASES = ["A1", "D4", "E5", "J10", "C3", "F6", "K1", "D5", "E4", "d4"];
const RAISONS = ["Minutie", "", " x", "Coup d'œil", "a".repeat(81), null, 3];
const LANCER = { type: "lancer", le: "2026-10-12T21:30" };

// Un événement que l'offre annonce : il doit être accepté.
function evenementOffert(etat, { suivant, entier, parmi }) {
  const offert = offre(etat);
  // Ce qui abandonne le geste en cours se tire rarement, pour que les suites aillent au bout de leurs gestes.
  const rare = { fin_de_tour: 0.08, revenir: 0.1, passer: 0.1, ...(gesteEnCours(etat) === null ? {} : { capacite: 0.1, regler: 0.6 }) };
  const types = offert.types.filter((type) => !Object.hasOwn(rare, type) || suivant() < rare[type]);
  if (types.length === 0) return null;
  const type = parmi(types);
  const fabriques = {
    lancer: () => LANCER,
    capacite() {
      const qui = parmi(candidats(etat));
      const actifs = boutons(etat, qui).filter((bouton) => bouton.actif);
      if (actifs.length === 0) return null;
      const { capacite, facon } = parmi(actifs);
      return { type, qui, capacite, facon };
    },
    passer: () => ({ type, qui: parmi(candidats(etat)) }),
    regler() {
      const champ = parmi(Object.keys(offert.reglages));
      const reglage = offert.reglages[champ];
      if (champ === "caracteristiques") return { type, champ, valeur: [...new Set([parmi(reglage.options), parmi(reglage.options)])] };
      if (reglage.options) return reglage.options.length === 0 ? null : { type, champ, valeur: parmi(reglage.options) };
      const valeur = reglage.raison ? entier(-3, 3) : entier(reglage.min, reglage.max);
      return reglage.raison && valeur !== 0 ? { type, champ, valeur, raison: "Minutie" } : { type, champ, valeur };
    },
    de: () => ({ type, faces: offert.de.faces, valeurs: Array.from({ length: offert.de.combien }, () => entier(1, offert.de.faces)) }),
    degats() {
      const nature = parmi(offert.degats.natures);
      const ajuste = nature !== "normaux" || suivant() < 0.4;
      return { type, base: parmi(offert.degats.bases), operations: ajuste ? [{ op: "ajuster", valeur: entier(0, 25), raison: "Coup de feu" }] : [], nature };
    },
    decaler() {
      const { de, min, max } = parmi(offert.decalages);
      const valeur = entier(min, max);
      return valeur === 0 ? { type, de, valeur } : { type, de, valeur, raison: "Tour de main" };
    },
    esquive: () => ({ type, x: entier(offert.esquive.min, offert.esquive.max) }),
  };
  return Object.hasOwn(fabriques, type) ? fabriques[type]() : { type };
}

// Un événement quelconque : souvent du bon type au mauvais moment, parfois hors
// de ses bornes, parfois mal fait, parfois tout autre chose qu'un événement.
function evenementQuelconque(etat, { suivant, entier, parmi }) {
  const offert = offre(etat);
  const raison = () => (suivant() < 0.85 ? "Minutie" : parmi(RAISONS));
  const fabriques = {
    lancer: () => ({ type: "lancer", le: parmi([LANCER.le, "hier", 20261012]) }),
    capacite: () => ({ type: "capacite", qui: parmi(IDS), capacite: entier(-1, 20), facon: entier(-1, 2) }),
    regler() {
      const champ = parmi(["facon", "jet_prete", "arme_pretee", "cible", "cible", "arrivee", "caracteristiques", "difficulte", "x", "jauge", "modificateur", "avantages", "inconnu"]);
      const valeur = {
        facon: () => entier(-1, 3),
        jet_prete: () => parmi([true, false, 1]),
        arme_pretee: () => parmi([0, 1, 2, null]),
        cible: () => parmi([...IDS, null]),
        arrivee: () => parmi(CASES),
        caracteristiques: () => parmi([[parmi(CODES)], [parmi(CODES), parmi(CODES)], [], ["charme"], "force"]),
        difficulte: () => entier(0, 12),
        x: () => entier(-1, 12),
        jauge: () => entier(-1, 3),
        modificateur: () => entier(-22, 22),
        avantages: () => entier(-3, 3),
        inconnu: () => 1,
      }[champ]();
      const evenement = { type: "regler", champ, valeur };
      if (["modificateur", "avantages"].includes(champ) ? suivant() < 0.9 : suivant() < 0.05) evenement.raison = raison();
      return evenement;
    },
    de: () =>
      offert.de && suivant() < 0.7
        ? { type: "de", faces: offert.de.faces, valeurs: Array.from({ length: suivant() < 0.9 ? offert.de.combien : entier(0, 3) }, () => entier(0, offert.de.faces + 1)) }
        : { type: "de", faces: parmi([4, 6, 8, 10, 12, 20, 1, 101, "d8"]), valeurs: parmi([[entier(0, 21)], [], "6", [1.5]]) },
    degats: () => ({
      type: "degats",
      base: parmi(["lettre", "arme", "aucun", "tout"]),
      operations: suivant() < 0.5 ? [] : [{ op: parmi(["ajuster", "ajuster", "doubler"]), valeur: entier(-1, 1000), raison: raison() }],
      nature: parmi(["normaux", "normaux", "resistance", "corps", "armure"]),
    }),
    decaler: () => ({ type: "decaler", de: entier(-1, 2), valeur: entier(-20, 20), raison: raison() }),
    esquive: () => ({ type: "esquive", x: entier(-1, 12) }),
    passer: () => ({ type: "passer", qui: parmi(IDS) }),
    // Ce qui n'est pas un événement, ou qui en a l'air : rien de cela ne doit faire lever le moteur.
    autre: () =>
      parmi([
        null,
        undefined,
        3,
        "appliquer",
        [],
        {},
        { type: "danser" },
        { type: "revenir", enTrop: 1 },
        { type: "constructor" },
        { type: "__proto__" },
        { type: ["de"] },
        Object.create({ type: "appliquer" }),
        {
          get type() {
            throw new Error("un événement piégé");
          },
        },
        new Proxy(
          {},
          {
            get() {
              throw new Error("un événement piégé");
            },
          },
        ),
      ]),
  };
  const type = parmi([...TYPES, ...TYPES, "regler", "regler", "de", "de", "capacite", "autre", "autre"]);
  return Object.hasOwn(fabriques, type) ? fabriques[type]() : { type };
}

// L'événement, écrit pour un message d'échec, même piégé.
function ecrire(evenement) {
  try {
    return JSON.stringify(evenement) ?? String(evenement);
  } catch {
    return "(un événement piégé)";
  }
}

test("événements au hasard : 5 000 événements bien et mal faits ; le moteur ne lève jamais, un refus rend l'état reçu, toute suite acceptée se rejoue à l'identique", (t) => {
  const hasard = hasardDe(20261012);
  const TOTAL = 5000;
  const PAR_SUITE = 25;
  const compte = { envoyes: 0, acceptes: 0, offerts: 0, refus: Object.fromEntries(CODES_DE_REFUS.map((code) => [code, 0])), types: {}, termines: 0, departs: new Set() };

  while (compte.envoyes < TOTAL) {
    const depart = hasard.entier(0, NOMBRE);
    compte.departs.add(depart);
    let etat = TENUS[depart];
    const suite = CONTENU.evenements.slice(0, depart);

    for (let coup = 0; coup < PAR_SUITE && compte.envoyes < TOTAL; coup += 1) {
      const offert = hasard.suivant() < 0.6 ? evenementOffert(etat, hasard) : null;
      const evenement = offert ?? evenementQuelconque(etat, hasard);
      const ou = `suite partie de l'événement n° ${depart}, coup n° ${coup + 1}, ${ecrire(evenement)}`;
      const avant = JSON.stringify(etat);
      let rendu;
      assert.doesNotThrow(() => {
        rendu = appliquer(etat, evenement);
      }, `le moteur lève : ${ou}`);
      compte.envoyes += 1;
      assert.equal(JSON.stringify(etat), avant, `l'état reçu est modifié : ${ou}`);

      if (rendu.refus) {
        assert.equal(offert, null, `offert, mais refusé (${rendu.refus.message}) : ${ou}`);
        assert.equal(rendu.etat, etat, `un refus rend l'état reçu, l'objet même : ${ou}`);
        assert.ok(CODES_DE_REFUS.includes(rendu.refus.code), `le code du refus : ${ou}`);
        assert.ok(typeof rendu.refus.message === "string" && rendu.refus.message !== "", `le message du refus : ${ou}`);
        compte.refus[rendu.refus.code] += 1;
        continue;
      }

      compte.acceptes += 1;
      compte.offerts += offert === null ? 0 : 1;
      compte.types[evenement.type] = (compte.types[evenement.type] ?? 0) + 1;
      // Ce qui se garde est la copie aux seuls champs connus, comme le fait la séance.
      suite.push(validerEvenement(evenement).evenement);
      assert.equal(rendu.etat.pas, etat.pas + 1, ou);
      assert.ok(Object.isFrozen(rendu.etat) && Object.isFrozen(rendu.etat.protagonistes) && Object.isFrozen(rendu.etat.pile), `l'état rendu est gelé : ${ou}`);
      etat = rendu.etat;
      compte.termines += etat.phase === "termine" ? 1 : 0;
      if (etat.phase === "combat") assert.ok(offre(etat).types.length > 0, `le combat ne s'offre plus rien : ${ou}`);
      for (const id of etat.ordre) {
        const { actions, souffle, corps, liens, zones } = etat.protagonistes[id];
        const nombres = [actions, souffle, corps, ...liens.map((jauge) => jauge.points), ...zones.flatMap((zone) => [zone.armure, zone.resistance])];
        assert.ok(nombres.every((nombre) => Number.isInteger(nombre) && nombre >= 0), `une ressource de ${id} passe sous 0 : ${ou}`);
      }
    }

    const rejoue = rejouer(JSON.parse(JSON.stringify({ ...CONTENU, evenements: suite })));
    assert.equal(rejoue.erreur, undefined, `la suite partie de l'événement n° ${depart} ne se rejoue pas : ${rejoue.erreur?.message}`);
    memeEtat(rejoue.etat, etat, `la suite partie de l'événement n° ${depart}, rejouée`);
  }

  // Le contrôle ne passe pas à vide : il a envoyé de tout, et vu chaque issue.
  t.diagnostic(`${compte.envoyes} événements envoyés, ${compte.acceptes} acceptés (dont ${compte.acceptes - compte.offerts} quelconques) ; refus : ${JSON.stringify(compte.refus)} ; acceptés par type : ${JSON.stringify(compte.types)} ; ${compte.departs.size} départs, ${compte.termines} états terminés`);
  assert.equal(compte.envoyes, TOTAL);
  assert.ok(compte.acceptes > 1500, `${compte.acceptes} événements acceptés`);
  assert.ok(compte.acceptes - compte.offerts > 20, `${compte.acceptes - compte.offerts} événements quelconques acceptés`);
  for (const code of CODES_DE_REFUS) assert.ok(compte.refus[code] > 30, `${compte.refus[code]} refus « ${code} »`);
  const sansLancement = (types) => types.filter((type) => type !== "lancer").sort();
  assert.deepEqual(sansLancement(Object.keys(compte.types)), sansLancement(TYPES), "chaque type d'événement a été accepté une fois au moins (le lancement ne s'offre qu'à une suite partie d'avant lui)");
  assert.ok(compte.departs.size > 60, `${compte.departs.size} moments de départ différents`);
  assert.ok(compte.termines > 0, "des suites sont allées jusqu'à la fin d'un combat");
});

test("événements au hasard : avant le lancement, seul « lancer » passe, et il se rejoue", () => {
  const hasard = hasardDe(7);
  const etat = TENUS[0];
  for (let coup = 0; coup < 300; coup += 1) {
    const evenement = evenementQuelconque(etat, hasard);
    let rendu;
    assert.doesNotThrow(() => {
      rendu = appliquer(etat, evenement);
    }, ecrire(evenement));
    if (rendu.refus) assert.equal(rendu.etat, etat);
    else assert.deepEqual(validerEvenement(evenement).evenement, LANCER, "rien d'autre que le lancement n'est accepté");
  }
  memeEtat(appliquer(etat, LANCER).etat, TENUS[1], "le lancement");
});

// ─── 8. Un dé n'est jamais relancé ──────────────────────────────────────────

// Les dés que tient un geste : un par essai de la chaîne, un par explosion,
// un par d20. C'est autant d'événements « de » depuis qu'il est ouvert.
const desTenus = (geste) => (geste.jet?.places ?? []).reduce((total, place) => total + place.essais.reduce((somme, essai) => somme + 1 + essai.explosions.length, 0), 0) + geste.localisation.length;

test("un dé n'est jamais relancé : rechargé en plein geste, le combat attend le même dé et offre les mêmes choix, sans en avoir perdu ni redemandé un", (t) => {
  const vus = { enGeste: 0, motifs: new Set(), choix: new Set() };
  let ouvertA = 0;
  for (let n = 0; n <= NOMBRE; n += 1) {
    if (n > 0 && CONTENU.evenements[n - 1].type === "capacite") ouvertA = n;
    const tenu = TENUS[n];
    if (gesteEnCours(tenu) === null) continue;
    vus.enGeste += 1;
    const attendu = offre(tenu);

    for (const [chemin, contenu] of [
      ["rejoué", prefixe(n)],
      ["rechargé par JSON", JSON.parse(JSON.stringify(prefixe(n)))],
    ]) {
      const { etat } = rejouer(contenu);
      const ou = `après ${n} événement(s), ${chemin}`;
      const offert = offre(etat);
      assert.deepStrictEqual(offert.de, attendu.de, `le dé attendu, ${ou}`);
      assert.deepStrictEqual(offert.choix, attendu.choix, `les choix, ${ou}`);
      assert.deepStrictEqual(offert, attendu, `toute l'offre, ${ou}`);

      const lances = CONTENU.evenements.slice(ouvertA, n).filter((evenement) => evenement.type === "de").length;
      assert.equal(desTenus(gesteEnCours(etat)), lances, `les dés déjà lancés sont tous dans le geste, ${ou}`);
      // Ce compte suit chaque dé : avant le dernier lancé, le geste en tenait un de moins.
      if (CONTENU.evenements[n - 1].type === "de" && lances > 1) assert.equal(desTenus(gesteEnCours(TENUS[n - 1])), lances - 1, ou);
    }

    if (attendu.de !== null) vus.motifs.add(attendu.de.motif);
    for (const choix of attendu.choix) vus.choix.add(choix);

    // Juste après « relancer » ou « exploser », le dé attendu est celui du choix, à la même place : le dé d'avant n'est pas redemandé.
    const dernier = CONTENU.evenements[n - 1].type;
    if (dernier === "relancer") assert.equal(attendu.de.motif, "relance");
    if (dernier === "exploser") assert.equal(attendu.de.motif, "explosion");
    // Juste après un dé, ce qui est attendu n'est jamais ce dé-là : la place avance, ou un choix s'offre, ou le motif change.
    if (dernier === "de" && attendu.de !== null) {
      const precedent = offre(TENUS[n - 1]).de;
      assert.notDeepStrictEqual(attendu.de, precedent, `après ${n} événement(s), le dé qui vient d'être lancé est encore attendu`);
    }
  }

  // Le contrôle ne passe pas à vide : le combat de référence s'arrête à chaque sorte de moment.
  t.diagnostic(`${vus.enGeste} moments en plein geste sur ${NOMBRE + 1}`);
  assert.ok(vus.enGeste > 60, `${vus.enGeste} moments en plein geste`);
  assert.deepEqual([...vus.motifs].sort(), ["chaine", "explosion", "localisation", "relance"]);
  assert.deepEqual([...vus.choix].sort(), ["exploser", "garder", "relancer"]);
});

test("un dé n'est jamais relancé : hors d'un geste, aucun dé n'est attendu, avant comme après un rechargement", () => {
  let horsGeste = 0;
  for (let n = 0; n <= NOMBRE; n += 1) {
    if (gesteEnCours(TENUS[n]) !== null) continue;
    horsGeste += 1;
    assert.equal(offre(TENUS[n]).de, null);
    assert.equal(offre(rejouer(prefixe(n)).etat).de, null);
  }
  assert.ok(horsGeste > 15);
});

// ─── 9. La concordance de l'offre et du réducteur ───────────────────────────

// Tout ce que portent des vues : les commandes de leurs boutons, avec ce que
// dit leur porteur, et leurs saisies, avec leur gabarit.
function relever(valeur, trouves = { commandes: [], saisies: [] }) {
  if (valeur === null || typeof valeur !== "object") return trouves;
  if (!Array.isArray(valeur)) {
    if (valeur.commande) trouves.commandes.push({ commande: valeur.commande, actif: valeur.actif !== false && valeur.inactif !== true });
    if (valeur.gabarit?.evenement) trouves.saisies.push(valeur);
  }
  for (const enfant of Object.values(valeur)) relever(enfant, trouves);
  return trouves;
}

// Un gabarit complété comme le fait l'écran : de la valeur saisie et, s'il en
// faut une, de la raison proposée.
function completer(saisie, valeur) {
  const { evenement } = saisie.gabarit;
  if (evenement.type === "degats") return { ...evenement, operations: [{ op: "ajuster", valeur, raison: saisie.raison ?? saisie.raisonParDefaut }] };
  if (evenement.type === "esquive") return { ...evenement, x: valeur };
  if (Array.isArray(valeur) || valeur === 0 || !("raisonParDefaut" in saisie)) return { ...evenement, valeur };
  return { ...evenement, valeur, raison: saisie.raison ?? saisie.raisonParDefaut };
}

// Les valeurs avec lesquelles éprouver une saisie : ses bornes, et 0 quand il est entre elles.
function valeursDEpreuve(saisie) {
  if (saisie.options) return [[saisie.options[0].code], [saisie.options[1].code, saisie.options[0].code]];
  const bornes = [saisie.min, saisie.max];
  if (saisie.min < 0 && saisie.max > 0) bornes.push(0);
  return [...new Set(bornes)];
}

// Un événement bien fait de chaque type, plausible à cet instant : s'il est
// refusé, ce n'est pas pour sa forme.
function unDeChaqueType(etat) {
  const qui = candidats(etat)[0] ?? etat.ordre[0];
  const de = offre(etat).de;
  return {
    lancer: LANCER,
    capacite: { type: "capacite", qui, capacite: 0, facon: 0 },
    regler: { type: "regler", champ: "modificateur", valeur: 0 },
    revenir: { type: "revenir" },
    confirmer: { type: "confirmer" },
    de: { type: "de", faces: de?.faces ?? 20, valeurs: Array.from({ length: de?.combien ?? 1 }, () => 1) },
    relancer: { type: "relancer" },
    garder: { type: "garder" },
    exploser: { type: "exploser" },
    degats: { type: "degats", base: "lettre", operations: [], nature: "normaux" },
    decaler: { type: "decaler", de: 0, valeur: 0 },
    esquive: { type: "esquive", x: 1 },
    appliquer: { type: "appliquer" },
    passer: { type: "passer", qui },
    fin_de_tour: { type: "fin_de_tour" },
  };
}

const vuesDe = (etat, choisi) => ({ barre: vueBarre(etat), plateau: vuePlateau(etat, choisi), fiches: etat.ordre.map((id) => vueFiche(etat, id, choisi)), panneau: vuePanneau(etat, choisi) });

test("concordance : les événements d'épreuve sont bien faits, un de chaque type", () => {
  for (const etat of [TENUS[0], TENUS[1], TENUS[52], FINAL]) {
    const echantillons = unDeChaqueType(etat);
    assert.deepEqual(Object.keys(echantillons), TYPES);
    for (const [type, evenement] of Object.entries(echantillons)) {
      const lu = validerEvenement(evenement);
      assert.equal(lu.erreur, undefined, `${type} : ${lu.erreur}`);
      assert.equal(lu.evenement.type, type);
    }
  }
});

test("concordance : à chaque pas du combat de référence, tout ce que porte une vue est accepté, et un événement de tout autre type est refusé, l'état rendu étant l'objet reçu", (t) => {
  const compte = { acceptes: 0, saisies: 0, refuses: 0, inactifs: 0 };
  const typesPortes = new Set();
  const typesRefuses = new Set();

  TENUS.forEach((etat, n) => {
    const ou = `après ${n} événement(s)`;
    const offert = offre(etat);
    // Hors d'un geste, l'écran a choisi celui qui joue : celui que le scénario fait jouer ensuite, sinon le premier qui le peut.
    const suivant = CONTENU.evenements[n];
    const choisi = suivant?.qui ?? candidats(etat)[0] ?? null;
    const portes = new Set();

    for (const lu of new Set([choisi, null])) {
      const { commandes, saisies } = relever(vuesDe(etat, lu));
      for (const { commande, actif } of commandes) {
        if (commande.evenement === undefined) continue;
        const rendu = appliquer(etat, commande.evenement);
        if (actif) {
          assert.equal(rendu.refus, undefined, `${ou} : une vue porte ${JSON.stringify(commande.evenement)}, que le moteur refuse (${rendu.refus?.message})`);
          assert.ok(offert.types.includes(commande.evenement.type), `${ou} : une vue porte un « ${commande.evenement.type} » que l'offre n'annonce pas`);
          portes.add(commande.evenement.type);
          compte.acceptes += 1;
        } else {
          assert.notEqual(rendu.refus, undefined, `${ou} : un bouton inactif porte ${JSON.stringify(commande.evenement)}, que le moteur accepte`);
          assert.equal(rendu.etat, etat, `${ou} : un refus rend l'état reçu`);
          compte.inactifs += 1;
        }
      }
      for (const saisie of saisies) {
        for (const valeur of valeursDEpreuve(saisie)) {
          const evenement = completer(saisie, valeur);
          const rendu = appliquer(etat, evenement);
          assert.equal(rendu.refus, undefined, `${ou} : une saisie porte ${JSON.stringify(evenement)}, que le moteur refuse (${rendu.refus?.message})`);
          portes.add(evenement.type);
          compte.saisies += 1;
        }
      }
    }

    // Le dé n'est pas une commande : l'écran lance celui que le panneau dit attendre.
    const aLancer = vuePanneau(etat, choisi).geste?.aLancer ?? null;
    assert.deepEqual(aLancer === null ? null : [aLancer.faces, aLancer.combien, aLancer.motif], offert.de === null ? null : [offert.de.faces, offert.de.combien, offert.de.motif], `${ou} : le dé du panneau est celui de l'offre`);
    if (aLancer !== null) portes.add("de");

    // Tout ce que l'offre annonce se joue depuis une vue : l'écran ne laisse aucun geste hors d'atteinte.
    for (const type of offert.types) {
      if (type === "lancer") continue;
      assert.ok(portes.has(type), `${ou} : l'offre annonce « ${type} », qu'aucune vue ne porte`);
    }
    for (const type of portes) typesPortes.add(type);

    // Un événement de chaque autre type est refusé, et l'état rendu est l'objet reçu.
    const echantillons = unDeChaqueType(etat);
    for (const type of TYPES) {
      if (offert.types.includes(type)) continue;
      const rendu = appliquer(etat, echantillons[type]);
      assert.notEqual(rendu.refus, undefined, `${ou} : « ${type} » n'est pas offert, et le moteur l'accepte`);
      assert.notEqual(rendu.refus.code, "forme", `${ou} : « ${type} » est refusé pour sa forme, non pour son moment`);
      assert.equal(rendu.etat, etat, `${ou} : le refus de « ${type} » rend l'état reçu`);
      typesRefuses.add(type);
      compte.refuses += 1;
    }

    // Et l'événement que le combat joue ensuite est de ceux que l'offre annonçait.
    if (suivant !== undefined) assert.ok(offert.types.includes(suivant.type), `${ou} : le combat joue « ${suivant.type} », que l'offre n'annonçait pas`);
  });

  // Le contrôle ne passe pas à vide.
  t.diagnostic(`${compte.acceptes} commandes acceptées, ${compte.saisies} saisies complétées, ${compte.inactifs} boutons inactifs refusés, ${compte.refuses} événements d'un autre type refusés`);
  assert.ok(compte.acceptes > 1000, `${compte.acceptes} commandes acceptées`);
  assert.ok(compte.saisies > 100, `${compte.saisies} saisies complétées`);
  assert.ok(compte.inactifs > 50, `${compte.inactifs} boutons inactifs refusés`);
  assert.ok(compte.refuses > 1000, `${compte.refuses} événements d'un autre type refusés`);
  assert.deepEqual([...typesRefuses].sort(), [...TYPES].sort(), "chaque type a été refusé à un moment où il ne s'offrait pas");
  assert.deepEqual([...typesPortes].sort(), TYPES.filter((type) => type !== "lancer").sort(), "chaque type d'événement est porté par une vue à un moment du combat, sauf le lancement, qui est une commande de la préparation");
});
