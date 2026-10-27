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
//    tout autre type d'événement est refusé ; depuis la vague 3 du lot 4.3, la
//    palette et le menu du MJ compris, Mode MJ allumé comme éteint.
//
// Au groupe 2 (contrat du groupe, § 0.2, règle 6, § 4.3, § 6.3) : chaque état
// porte sa pile d'annulation, une liste chaînée de maillons gelés qui ne
// passe jamais par JSON et ne se compare jamais en profondeur. Les états se
// comparent donc sans elle, et la pile par sa forme (ce que chaque maillon
// défait, et sa plage) ; « annuler » est un événement comme un autre, tiré au
// hasard, porté par la barre ; une case d'arrivée peut porter deux
// événements, { evenements } ; le rejeu se fait par tranches, d'un
// générateur.
//
// Le hasard de ce fichier est un générateur à graine écrite : un échec se
// retrouve à l'identique.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { sourceAleatoire } from "../js/combat/des.js";
import { passifDe } from "../js/combat/effets.js";
import { validerContenu, validerEvenement } from "../js/combat/forme.js";
import { texteDuJournal } from "../js/combat/journal.js";
import { vueBarre, vueFiche, vueMenuMj, vuePalette, vuePanneau, vuePlateau, vueVignettes } from "../js/combat/lecture.js";
import { appliquer, gesteEnCours, ouvrirCombat, rejeu, rejouer } from "../js/combat/moteur.js";
import { boutons, candidats, offre } from "../js/combat/offre.js";
import { etatsDeLaBanque, photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { BORNES_MJ, COLONNES, COTE } from "../js/combat/regles.js";
import { tableDesRoles } from "../js/combat/roles.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter, lirePersonnage } from "../js/personnage/format.js";
import { CARACTERISTIQUES } from "../js/personnage/regles.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { journalAttendu, scenario } from "./outils/combat_reference.js";
import { adversaireEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";
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

// La blessure du geste 22 se prend dans le bloc de blessure de la banque (lot 4.3).
const { contenu: CONTENU } = versContenu(scenario, PHOTOS, { banque: BANQUE });
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
const TYPES = ["lancer", "capacite", "regler", "revenir", "confirmer", "de", "relancer", "garder", "exploser", "degats", "decaler", "esquive", "appliquer", "passer", "fin_de_tour", "annuler"];

// L'état sans sa pile d'annulation : c'est lui qui se compare en profondeur,
// et lui qui passe par JSON.
const sansAnnulation = ({ annulation, ...reste }) => reste;

// La forme de la pile, lue sans descendre dans les instantanés : chaque
// maillon par ce qu'il défait et sa plage, du plus récent au plus ancien, et
// l'attente d'un geste payé. null pour ce qui n'a pas de pile.
function formeDeLaPile(etat) {
  if (etat?.annulation === undefined) return null;
  const { attente, pile } = etat.annulation;
  const maillons = [];
  for (let maillon = pile; maillon !== null; maillon = maillon.precedent) maillons.push([maillon.quoi.genre, ...maillon.plage]);
  return { attente: attente !== null, maillons };
}

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

// Deux états égaux : tout ce qui n'est pas la pile, en profondeur ; puis la
// forme de la pile.
function memeEtat(obtenu, attendu, quoi) {
  const [a, b] = [sansAnnulation(obtenu), sansAnnulation(attendu)];
  const ecart = premierEcart(a, b);
  assert.equal(ecart, null, `${quoi} : ${ecart}`);
  assert.deepStrictEqual(a, b, quoi);
  assert.deepStrictEqual(formeDeLaPile(obtenu), formeDeLaPile(attendu), `${quoi} : la pile d'annulation`);
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
  for (let n = 0; n < NOMBRE; n += 1) assert.notEqual(premierEcart(sansAnnulation(TENUS[n]), sansAnnulation(TENUS[n + 1])), null, `l'événement n° ${n + 1} change l'état`);
  // La pile ne se compare que par sa forme : deux maillons de même forme, aux instantanés différents, sont égaux ;
  // un maillon de plus, ou une autre plage, ne l'est pas.
  const geste = (lanceLe, plage, precedent = null) => ({ annulation: { attente: null, pile: { avant: { lanceLe }, quoi: { genre: "passer", qui: "pj1" }, plage, precedent } } });
  memeEtat(geste("2026-10-12T21:30", [3, 5]), geste("2031-01-02T03:04", [3, 5]), "deux piles de même forme");
  assert.throws(() => memeEtat(geste("2026-10-12T21:30", [3, 5]), geste("2026-10-12T21:30", [3, 6]), "deux plages"), /deux plages : la pile/);
  assert.throws(() => memeEtat(geste("x", [5, 6], geste("x", [3, 5]).annulation.pile), geste("x", [5, 6]), "un maillon de plus"), /un maillon de plus : la pile/);
});

test("le combat de référence, rejoué, rend son journal attendu : c'est bien lui que ces contrôles éprouvent", () => {
  // Recompté sur le scénario au lot 4.3 (mission, § 10) : trois « Appliquer »
  // de plus (deux manqués et un jet de caractéristique), une contre-attaque
  // laissée, une blessure choisie, deux cibles Centrées que l'on ne règle plus,
  // et les dés des gestes que la fin du −1 a changés.
  assert.equal(NOMBRE, 104);
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
  // La pile se refait au rejeu : un maillon par geste du scénario.
  assert.equal(formeDeLaPile(FINAL).maillons.length, scenario.gestes.length);
});

test("préfixes : le rejeu par tranches rend, à chaque taille de tranche, l'état de rejouer(), et cède après chaque tranche le nombre d'événements déjà joués", () => {
  for (const tranche of [1, 7, 50, 105, 1000]) {
    const suite = rejeu(CONTENU, tranche);
    const cedes = [];
    let etape = suite.next();
    while (!etape.done) {
      cedes.push(etape.value.pas);
      etape = suite.next();
    }
    assert.deepEqual(cedes, Array.from({ length: Math.floor(NOMBRE / tranche) }, (_, rang) => (rang + 1) * tranche), `tranches de ${tranche}`);
    memeEtat(etape.value.etat, FINAL, `tranches de ${tranche}`);
  }
  // Un refus s'y dit de même, au rang de l'événement refusé.
  const abime = { ...CONTENU, evenements: [...CONTENU.evenements.slice(0, 60), { type: "danser" }] };
  const suite = rejeu(abime, 7);
  let etape = suite.next();
  while (!etape.done) etape = suite.next();
  assert.deepEqual(etape.value, rejouer(abime));
  assert.equal(etape.value.erreur.pas, 61);
});

test("préfixes : le rejeu s'arrête au premier refus et dit lequel, sans tronquer la suite en silence", () => {
  // Un événement qui ne se répète jamais (le lancement, une confirmation, « Appliquer »), glissé deux fois de suite :
  // le second n'est plus attendu.
  const sansReplique = CONTENU.evenements.flatMap((evenement, rang) => (["lancer", "confirmer", "appliquer"].includes(evenement.type) ? [rang + 1] : []));
  assert.equal(sansReplique.length, 16);
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
    assert.equal(JSON.stringify(sansAnnulation(rejoue.etat)), JSON.stringify(sansAnnulation(TENUS[n])), "jusqu'à l'ordre des clés");
  }
});

test("JSON : l'état lui-même, hors de sa pile d'annulation, n'est fait que de données simples, il passe par JSON à l'identique", () => {
  for (let n = 0; n <= NOMBRE; n += 1) memeEtat(JSON.parse(JSON.stringify(sansAnnulation(TENUS[n]))), sansAnnulation(TENUS[n]), `l'état après ${n} événement(s)`);
  // La pile ne passe jamais par JSON : le contenu gardé n'en porte rien, et c'est le rejeu qui la refait.
  const garde = JSON.stringify(CONTENU);
  assert.equal(garde.includes('"annulation"') || garde.includes('"precedent"') || garde.includes('"plage"'), false);
  assert.equal(formeDeLaPile(rejouer(JSON.parse(garde)).etat).maillons.length, scenario.gestes.length);
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
  let blessures = 0;
  for (let n = 2; n <= NOMBRE; n += 1) {
    // Au lot 4.3, une blessure choisie prolonge la photographie de sa victime
    // (contrat de la vague 1, § 5.9) : seule celle-là change, les autres restent
    // l'objet même, et ses capacités d'avant aussi.
    if (CONTENU.evenements[n - 1].type === "blessure") {
      blessures += 1;
      const changees = TENUS[n].ordre.filter((id) => TENUS[n].photos[id] !== TENUS[n - 1].photos[id]);
      assert.deepEqual(changees, ["pj1"], "seule la photographie de la victime est prolongée");
      const [avant, apres] = [TENUS[n - 1].photos.pj1.capacites, TENUS[n].photos.pj1.capacites];
      assert.equal(apres.length, avant.length + 1);
      assert.ok(avant.every((capacite, rang) => apres[rang] === capacite), "ses capacités d'avant ne sont pas recopiées");
      continue;
    }
    assert.equal(TENUS[n].photos, TENUS[n - 1].photos, "les photographies ne sont jamais recopiées");
    assert.equal(TENUS[n].noms, TENUS[n - 1].noms, "les noms sont figés au lancement");
    assert.equal(TENUS[n].ordre, TENUS[n - 1].ordre);
  }
  assert.equal(blessures, 1, "le combat de référence a sa blessure : ce contrôle la voit");
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
  // À la vague 3 du lot 4.3 : les vignettes, la palette du MJ et le menu du MJ aussi.
  const { blocs } = etatsDeLaBanque(BANQUE);
  const { rejoue, texte } = sansHeureNiHasard(() => {
    const rendu = rejouer(CONTENU);
    for (const etat of TENUS) {
      offre(etat);
      const choisi = candidats(etat)[0] ?? null;
      vueBarre(etat);
      vuePlateau(etat, choisi);
      vuePanneau(etat, choisi);
      vueVignettes(etat, choisi);
      vuePalette(etat, { genre: "mj" }, { etats: blocs, libre: true });
      for (const id of etat.ordre) {
        vueFiche(etat, id, choisi);
        vueMenuMj(etat, id, { etats: blocs });
      }
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

  // L'état ne porte ni la mise en place ni une source : seulement les valeurs, par référence. Au lot 4.3,
  // la photographie d'Aubépine est prolongée par sa blessure : ses autres champs restent ceux de la photo.
  for (const [rang, { id, photo }] of CONTENU.miseEnPlace.protagonistes.entries()) {
    if (id !== "pj1") {
      assert.equal(FINAL.photos[id], photo.valeurs, `protagoniste n° ${rang + 1}`);
      continue;
    }
    for (const [champ, valeur] of Object.entries(photo.valeurs)) {
      if (champ !== "capacites") assert.equal(FINAL.photos[id][champ], valeur, `protagoniste n° ${rang + 1}, ${champ}`);
    }
    assert.ok(photo.valeurs.capacites.every((capacite, indice) => FINAL.photos[id].capacites[indice] === capacite));
  }
  // La source d'une photographie n'y est pas ; celle d'un effet durable est la sienne (contrat, § 3).
  assert.equal(JSON.stringify(FINAL.photos).includes('"source"'), false);
  assert.equal(JSON.stringify(sansAnnulation(FINAL)).includes('"miseEnPlace"'), false);
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
  // Au lot 4.3 (contrat de la vague 1, § 7.5) : les effets, que l'offre juge et que le moteur applique ;
  // ils n'importent de l'offre que le prix d'un geste. L'offre lit l'élément Centré par la clé des noms.
  "effets.js": ["valeurs.js", "jet.js", "degats.js", "offre.js", "regles.js"],
  "offre.js": ["valeurs.js", "circonstances.js", "degats.js", "effets.js", "jet.js", "plateau.js", "forme.js", "regles.js", "../personnage/regles.js", "../banque/noms.js"],
  "journal.js": ["regles.js", "valeurs.js", "jet.js", "degats.js", "../personnage/regles.js"],
  "moteur.js": ["regles.js", "forme.js", "plateau.js", "noms.js", "preparation.js", "jet.js", "valeurs.js", "circonstances.js", "degats.js", "effets.js", "offre.js", "journal.js", "../personnage/regles.js"],
  // Au groupe 2, les cases hachurées d'une portée (casesEntre) : contrat du groupe, § 1. Au lot 4.3, la raison
  // d'une capacité de blessure inactive (effets.js, refusDeLaBlessure).
  // À la vague 3 du lot 4.3 (contrat de la vague, § 8.0), la palette et le menu du MJ, que lecture.js réexporte.
  "lecture.js": ["offre.js", "circonstances.js", "valeurs.js", "degats.js", "effets.js", "jet.js", "journal.js", "preparation.js", "plateau.js", "noms.js", "regles.js", "../personnage/regles.js", "lecture_mj.js"],
  // La palette et le menu du MJ (contrat de la vague 3, § 3.6, § 3.7 et D10 bis) : le juge des effets et du MJ, la forme
  // des valeurs choisies, les phrases du journal pour l'aperçu, la case voisine ; jamais le moteur.
  "lecture_mj.js": ["degats.js", "effets.js", "forme.js", "journal.js", "plateau.js", "regles.js", "valeurs.js"],
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
  assert.equal(Object.keys(NOYAU).length, 15);
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
  // Vingt depuis la souche de lecture_mj.js (contrat de la vague 3 du lot 4.3, § 8.0).
  assert.equal(Object.keys(graphe).length, 20);
  // Au lot 4.3, une seule boucle, voulue (contrat de la vague 1, § 7.5) : l'offre importe les effets,
  // qui n'importent d'elle que le prix d'un geste, appelé dans leurs fonctions et jamais au chargement.
  // Armé : elle est bien là ; désarmé : sans elle, aucun cycle.
  const boucle = cycleDans(graphe);
  assert.ok(["js/combat/offre.js → js/combat/effets.js → js/combat/offre.js", "js/combat/effets.js → js/combat/offre.js → js/combat/effets.js"].includes(boucle), boucle);
  assert.match(sourceDe("js/combat/effets.js"), /^import \{ prixDuGeste \} from "\.\/offre\.js";$/m);
  const sansLaBoucle = { ...graphe, "js/combat/effets.js": graphe["js/combat/effets.js"].filter((importe) => importe !== "js/combat/offre.js") };
  assert.equal(cycleDans(sansLaBoucle), null);
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
  // Ce qui abandonne le geste en cours se tire rarement, pour que les suites aillent au bout de leurs gestes ;
  // l'annulation de même, pour qu'elles avancent.
  const rare = { fin_de_tour: 0.08, revenir: 0.1, passer: 0.1, annuler: 0.25, ...(gesteEnCours(etat) === null ? {} : { capacite: 0.1, regler: 0.6 }) };
  // La palette et le menu du MJ (lot 4.3) ont leurs propres contrôles (combat_g3_effets.test.js) : leurs
  // événements, faits de leur source et de leur genre, ne se tirent pas ici.
  const types = offert.types.filter((type) => type !== "effet" && type !== "mj" && (!Object.hasOwn(rare, type) || suivant() < rare[type]));
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
      // Les cibles d'une façon Centrée (lot 4.3) : une liste, dans l'ordre des jets. Sans adversaire sur sa
      // case, elle n'en offre aucune (contrat, § 12, choix 10) : le tireur passe son tour, comme pour « cible ».
      if (champ === "cibles") return reglage.options.length === 0 ? null : { type, champ, valeur: [...new Set([parmi(reglage.options), parmi(reglage.options)])] };
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
    // Le lot 4.3 : une intervention et une contre-attaque parmi les options actives ; le critique, tenté ou
    // gardé ; une blessure, un état libre.
    intervenir() {
      const { qui, options } = parmi(offert.interventions.intervenants);
      const { capacite, facon } = parmi(options.filter((option) => option.actif));
      return { type, qui, capacite, facon };
    },
    contre_attaquer() {
      const { capacite, facon } = parmi(offert.contre.options.filter((option) => option.actif));
      return { type, capacite, facon };
    },
    critique: () => ({ type, tenter: suivant() < 0.5 }),
    blessure: () => ({ type, libre: "Brûlure" }),
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
  const compte = { envoyes: 0, acceptes: 0, offerts: 0, refus: Object.fromEntries(CODES_DE_REFUS.map((code) => [code, 0])), types: {}, termines: 0, departs: new Set(), annulations: new Map() };

  while (compte.envoyes < TOTAL) {
    const depart = hasard.entier(0, NOMBRE);
    compte.departs.add(depart);
    let etat = TENUS[depart];
    const suite = CONTENU.evenements.slice(0, depart);

    for (let coup = 0; coup < PAR_SUITE && compte.envoyes < TOTAL; coup += 1) {
      const offert = hasard.suivant() < 0.6 ? evenementOffert(etat, hasard) : null;
      const evenement = offert ?? evenementQuelconque(etat, hasard);
      const ou = `suite partie de l'événement n° ${depart}, coup n° ${coup + 1}, ${ecrire(evenement)}`;
      const avant = JSON.stringify(sansAnnulation(etat));
      const pileAvant = etat.annulation;
      let rendu;
      assert.doesNotThrow(() => {
        rendu = appliquer(etat, evenement);
      }, `le moteur lève : ${ou}`);
      compte.envoyes += 1;
      assert.equal(JSON.stringify(sansAnnulation(etat)), avant, `l'état reçu est modifié : ${ou}`);
      assert.equal(etat.annulation, pileAvant, `la pile de l'état reçu est remplacée : ${ou}`);

      if (rendu.refus) {
        assert.equal(offert, null, `offert, mais refusé (${rendu.refus.message}) : ${ou}`);
        assert.equal(rendu.etat, etat, `un refus rend l'état reçu, l'objet même : ${ou}`);
        assert.ok(CODES_DE_REFUS.includes(rendu.refus.code), `le code du refus : ${ou}`);
        assert.ok(typeof rendu.refus.message === "string" && rendu.refus.message !== "", `le message du refus : ${ou}`);
        compte.refus[rendu.refus.code] += 1;
        if (rendu.refus.code === "interdit" && validerEvenement(evenement).evenement?.type === "annuler") compte.annulations.set(rendu.refus.message, (compte.annulations.get(rendu.refus.message) ?? 0) + 1);
        continue;
      }

      compte.acceptes += 1;
      compte.offerts += offert === null ? 0 : 1;
      compte.types[evenement.type] = (compte.types[evenement.type] ?? 0) + 1;
      // Ce qui se garde est la copie aux seuls champs connus, comme le fait la séance.
      suite.push(validerEvenement(evenement).evenement);
      assert.equal(rendu.etat.pas, etat.pas + 1, ou);
      assert.ok(Object.isFrozen(rendu.etat) && Object.isFrozen(rendu.etat.protagonistes) && Object.isFrozen(rendu.etat.pile) && Object.isFrozen(rendu.etat.annulation), `l'état rendu est gelé : ${ou}`);
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
  // L'annulation refusée pour chacune de ses trois raisons.
  t.diagnostic(`annulations refusées : ${JSON.stringify(Object.fromEntries(compte.annulations))}`);
  assert.deepEqual([...compte.annulations.keys()].sort(), ["Revenez d'abord sur le geste en cours.", "Rien à annuler depuis le lancement.", "Terminez d'abord le geste en cours."]);
  // Les types neufs du lot 4.3 n'ont pas tous leur moment dans ces suites : chacun a ses contrôles dans
  // combat_g3_pile.test.js et combat_g3_regles.test.js. Et depuis la fin du −1, la face maximale des dés de
  // ce combat atteint presque toujours la difficulté : « exploser » ne s'y tire plus qu'au hasard d'un jet de
  // caractéristique ; il a ses contrôles dans combat_evenements.test.js, et son rechargement plus bas.
  const sansLancement = (types) => types.filter((type) => type !== "lancer" && type !== "exploser" && TYPES.includes(type)).sort();
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
  // Depuis le lot 4.3, le combat de référence n'a plus d'explosion (les dés qu'a changés la fin du −1) :
  // un dé qui peut exploser, puis le dé de l'explosion, se rechargent ici, sur les photographies rondes.
  assert.deepEqual([...vus.motifs].sort(), ["chaine", "localisation", "relance"]);
  assert.deepEqual([...vus.choix].sort(), ["garder", "relancer"]);
  const miseEnPlace = miseEnPlaceEssai([{ photo: pjEssai(), case: "D4" }, { photo: adversaireEssai(), case: "D4" }]);
  const explosion = [
    LANCER,
    { type: "capacite", qui: "pj1", capacite: 0, facon: 0 },
    { type: "regler", champ: "cible", valeur: "adv2" },
    { type: "regler", champ: "modificateur", valeur: -5, raison: "Vapeur" },
    { type: "de", faces: 8, valeurs: [8] },
    { type: "exploser" },
  ];
  let tenu = ouvrirCombat(miseEnPlace);
  for (const [rang, evenement] of explosion.entries()) {
    tenu = appliquer(tenu, evenement).etat;
    const recharge = rejouer(JSON.parse(JSON.stringify({ regles: CONTENU.regles, revision: CONTENU.revision, miseEnPlace, evenements: explosion.slice(0, rang + 1) }))).etat;
    assert.deepStrictEqual(offre(recharge).de, offre(tenu).de, `l'explosion, après ${rang + 1} événement(s)`);
    assert.deepStrictEqual(offre(recharge).choix, offre(tenu).choix);
    if (evenement.type === "de") assert.deepEqual(offre(recharge).choix, ["exploser"], "8 − 5 sous 5 : le dé peut exploser");
  }
  assert.equal(offre(tenu).de.motif, "explosion");
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
// dit leur porteur, et leurs saisies, avec leur gabarit. Depuis la vague 3 du
// lot 4.3 (contrat de la vague, § 3), deux marques s'héritent : un objet
// « actif: false » rend inactif tout ce qu'il contient, et « mj: true »
// marque ce que le Mode MJ seul montre, avec tout ce qu'il contient.
function relever(valeur, trouves = { commandes: [], saisies: [] }, herite = { actif: true, mj: false }) {
  if (valeur === null || typeof valeur !== "object") return trouves;
  let ici = herite;
  if (!Array.isArray(valeur)) {
    ici = { actif: herite.actif && valeur.actif !== false, mj: herite.mj || valeur.mj === true };
    if (valeur.commande) trouves.commandes.push({ commande: valeur.commande, actif: ici.actif && valeur.inactif !== true, mj: ici.mj });
    if (valeur.gabarit?.evenement) trouves.saisies.push({ saisie: valeur, actif: ici.actif, mj: ici.mj });
  }
  // Un événement ne porte pas de vue : ni commande ni gabarit ne se fouillent.
  for (const [cle, enfant] of Object.entries(valeur)) if (cle !== "commande" && cle !== "gabarit") relever(enfant, trouves, ici);
  return trouves;
}

// Un gabarit complété comme le fait l'écran : de la valeur saisie et, s'il en
// faut une, de la raison proposée.
function completer(saisie, valeur) {
  const { evenement } = saisie.gabarit;
  if (evenement.type === "degats") return { ...evenement, operations: [{ op: "ajuster", valeur, raison: saisie.raison ?? saisie.raisonParDefaut }] };
  if (evenement.type === "esquive") return { ...evenement, x: valeur };
  // Le lot 4.3 : l'état libre d'une blessure se complète de son nom.
  if (evenement.type === "blessure") return { ...evenement, libre: valeur };
  if (Array.isArray(valeur) || valeur === 0 || !("raisonParDefaut" in saisie)) return { ...evenement, valeur };
  return { ...evenement, valeur, raison: saisie.raison ?? saisie.raisonParDefaut };
}

// Les valeurs avec lesquelles éprouver une saisie : ses bornes, et 0 quand il est entre elles ; pour un nom
// (l'état libre d'une blessure), un nom court et un nom à sa longueur la plus grande.
function valeursDEpreuve(saisie) {
  if (saisie.gabarit.evenement.type === "blessure") return ["Genou en vrac", "Genou en vrac".padEnd(saisie.max, ".")];
  if (saisie.options) return [[saisie.options[0].code], [saisie.options[1].code, saisie.options[0].code]];
  const bornes = [saisie.min, saisie.max];
  if (saisie.min < 0 && saisie.max > 0) bornes.push(0);
  return [...new Set(bornes)];
}

// ─── La palette et le menu du MJ, complétés comme le fait l'écran ───────────
//
// Contrat de la vague 3 du lot 4.3, § 3.6, § 3.7 et § 7. Un genre de la
// palette se complète de Choisi.valeurs, champ par champ ; un geste du MJ, de
// ce que son entrée demande. Les deux bouts de chaque champ l'éprouvent : la
// première et la dernière option active, la borne basse et la borne haute d'un
// nombre (jamais une valeur exclue, le 0 d'un ±N), une case à chaque bout de
// la carte qui n'est pas la sienne ; « toute la case » coche une autre cible,
// puis toutes ; un état se prend au classeur, ou se nomme (le plus long nom
// permis).

// Les blocs d'états de la banque, que l'écran donne à la palette et au menu.
const ETATS = etatsDeLaBanque(BANQUE).blocs;
// ±N et un état ont leur durée à l'onglet Durée (§ 3.6).
const A_DUREE = ["attaque", "defense", "etat"];
const NOM_LIBRE = "Dans la fumée";
const CASES_AUX_BOUTS = { premier: [`${COLONNES[0]}1`, `${COLONNES[1]}1`], dernier: [`${COLONNES.at(-1)}${COTE}`, `${COLONNES.at(-2)}${COTE}`] };

const present = (valeur) => valeur !== null && valeur !== undefined;
const optionsDuChamp = (champ) => champ.options ?? (champ.blocs ?? []).flatMap((bloc) => bloc.options);

// Un événement écrit clés rangées : deux écritures du même événement se comparent.
const canonique = (valeur) => JSON.stringify(valeur, (cle, ici) => (ici !== null && typeof ici === "object" && !Array.isArray(ici) ? Object.fromEntries(Object.entries(ici).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : ici));

// La valeur d'un champ de la palette au bout « premier » ou « dernier » ;
// undefined quand il n'a rien d'actif à choisir.
function valeurDuChamp(champ, bout) {
  const premier = bout === "premier";
  if (champ.sorte === "nombre") {
    let valeur = premier ? champ.min : champ.max;
    while ((champ.exclus ?? []).includes(valeur)) valeur += premier ? 1 : -1;
    return valeur;
  }
  if (champ.sorte === "case") return CASES_AUX_BOUTS[bout].find((nom) => nom !== champ.exclue);
  if (champ.sorte === "cibles") {
    // La cible en cours, en tête, cochée et fixe ; puis une autre, ou toutes les autres.
    const [cible, ...autres] = champ.options;
    const cochees = autres.filter((option) => option.actif).map((option) => option.valeur);
    return cible === undefined || cochees.length === 0 ? undefined : [cible.valeur, ...(premier ? cochees.slice(0, 1) : cochees)];
  }
  const actives = optionsDuChamp(champ).filter((option) => option.actif);
  if (actives.length === 0) return undefined;
  return (premier ? actives[0] : actives.at(-1)).valeur;
}

// Choisi.valeurs d'un genre, chaque champ à ce bout (« libre » : le premier
// bout, l'état nommé plutôt que pris au classeur) ; le tuple d'une ressource
// s'étale (§ 3.6). null quand un champ n'a rien à choisir.
function valeursChoisies(champs, bout) {
  let valeurs = {};
  for (const champ of champs) {
    if (champ.sorte === "texte" || (bout === "libre" && champ.nom === "capacite")) continue;
    const valeur = valeurDuChamp(champ, bout === "libre" ? "premier" : bout);
    if (valeur === undefined) return null;
    valeurs = champ.nom === "ressource" ? { ...valeurs, ...valeur } : { ...valeurs, [champ.nom]: valeur };
  }
  if (bout === "libre") {
    const texte = champs.find((champ) => champ.sorte === "texte") ?? null;
    if (texte === null) return null;
    valeurs.libre = NOM_LIBRE.padEnd(texte.max, ".");
  }
  return valeurs;
}

// Choisi.valeurs d'un genre tel que la palette le montre, chaque champ à sa
// valeur par défaut ; la case d'arrivée, qu'aucun défaut ne pose, au premier bout.
function valeursParDefaut(champs) {
  let valeurs = {};
  for (const champ of champs) {
    if (champ.nom === "ressource" && present(champ.valeur)) valeurs = { ...valeurs, ...champ.valeur };
    else valeurs = { ...valeurs, [champ.nom]: champ.valeur ?? (champ.sorte === "case" ? valeurDuChamp(champ, "premier") : null) };
  }
  return valeurs;
}

// L'événement « effet » de Choisi : le gabarit, les valeurs, X ; un état du
// classeur (« 1:0 », le bloc et son rang dans ETATS) devient sa capacité figée.
function evenementDeLaPalette(gabarit, valeurs, x) {
  const { capacite = null, libre = null, ...reste } = valeurs;
  const evenement = { ...gabarit.evenement, ...reste };
  if (present(x)) evenement.x = x;
  if (present(libre)) evenement.libre = libre;
  else if (present(capacite)) {
    const [bloc, rang] = capacite.split(":").map(Number);
    evenement.capacite = ETATS[bloc]?.capacites?.[rang] ?? null;
  }
  return evenement;
}

// Les événements qui éprouvent un genre de la palette : les deux bouts (et
// l'état nommé) quand il est actif ; sinon un seul, ses valeurs par défaut.
// « duree » : le champ de l'onglet Durée ; « x » : celui de la palette.
function epreuvesDeLEffet(saisie, actif, { duree = null, x = null } = {}) {
  const champs = A_DUREE.includes(saisie.genre) && duree !== null ? [...saisie.champs, duree] : saisie.champs;
  if (!actif) return [evenementDeLaPalette(saisie.gabarit, valeursParDefaut(champs), x?.valeur ?? null)];
  const evenements = new Map();
  for (const bout of saisie.genre === "etat" ? ["premier", "dernier", "libre"] : ["premier", "dernier"]) {
    const valeurs = valeursChoisies(champs, bout);
    if (valeurs === null) continue;
    const leX = x === null ? null : bout === "dernier" ? x.max : x.min;
    evenements.set(JSON.stringify([valeurs, leX]), evenementDeLaPalette(saisie.gabarit, valeurs, leX));
  }
  return [...evenements.values()];
}

// Les événements qui éprouvent une saisie du menu du MJ (§ 3.7) : chaque
// valeur à sa borne basse, puis à sa borne haute, quand elle change (jamais
// plus de BORNES_MJ.valeurs entrées par geste) ; un état ajouté, de chaque
// durée du menu (« tour » d'abord), et nommé d'un nom court ou du plus long
// permis ; une case d'arrivée à chaque bout de la carte.
function epreuvesDuMj(saisie, { durees = ["tour"] } = {}) {
  const { evenement } = saisie.gabarit;
  const [premiere, derniere] = [durees[0], durees.at(-1)];
  if (evenement.genre === "valeurs") {
    const gestes = [];
    for (const borne of ["min", "max"]) {
      const entrees = saisie.champs.filter((champ) => champ[borne] !== champ.valeur).map((champ) => ({ ...champ.entree, valeur: champ[borne] }));
      for (let debut = 0; debut < entrees.length; debut += BORNES_MJ.valeurs) gestes.push({ ...evenement, valeurs: entrees.slice(debut, debut + BORNES_MJ.valeurs) });
    }
    return gestes;
  }
  // L'état libre a un ajout vide, que l'écran complète du nom ; un état du classeur, de sa seule durée.
  const libre = evenement.genre === "etat" && Object.keys(evenement.ajout ?? {}).length === 0;
  if (libre) return [{ ...evenement, ajout: { libre: NOM_LIBRE, duree: premiere } }, { ...evenement, ajout: { libre: NOM_LIBRE.padEnd(saisie.max, "."), duree: derniere } }];
  if (evenement.genre === "etat") return [premiere, derniere].map((duree) => ({ ...evenement, ajout: { ...evenement.ajout, duree } }));
  if (evenement.genre === "deplacer") return ["premier", "dernier"].map((bout) => ({ ...evenement, vers: valeurDuChamp({ sorte: "case", exclue: saisie.exclue }, bout) }));
  return [evenement];
}

// Les événements qui éprouvent une saisie, complétée comme le fait l'écran ;
// une saisie inactive ne s'éprouve que d'un seul, refusé.
function epreuvesDe({ saisie, actif }, contexte = {}) {
  const { type } = saisie.gabarit.evenement;
  let evenements;
  if (type === "effet") evenements = epreuvesDeLEffet(saisie, actif, contexte);
  else if (type === "mj") evenements = epreuvesDuMj(saisie, contexte);
  else evenements = valeursDEpreuve(saisie).map((valeur) => completer(saisie, valeur));
  return actif ? evenements : evenements.slice(0, 1);
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
    annuler: { type: "annuler" },
  };
}

// Le panneau reçoit, comme à l'écran, les capacités du bloc de blessure de la banque (lot 4.3). À la vague 3
// du lot (contrat de la vague, § 7), les vignettes du téléphone s'y ajoutent ; « Intervenir… » vit dans la
// barre.
const BLESSURES = etatsDeLaBanque(BANQUE).blessure;
const vuesDe = (etat, choisi) => ({
  barre: vueBarre(etat),
  plateau: vuePlateau(etat, choisi),
  fiches: etat.ordre.map((id) => vueFiche(etat, id, choisi)),
  panneau: vuePanneau(etat, choisi, { blessures: BLESSURES }),
  vignettes: vueVignettes(etat, choisi),
});

// Ce que le Mode MJ éteint n'a pas à porter (contrat de la vague 3, § 7, R n° 3) : les gestes du MJ, les
// effets (la palette, sauf au nom de la capacité jouée, d'un passif ou d'un état), le décalage d'un d20 ; et le
// lancement, commande de la préparation.
const SANS_LE_MODE_MJ = ["lancer", "mj", "effet", "decaler"];

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

// Les événements d'une commande, joués à la suite comme le fait la séance
// (contrat du groupe 2, § 6.3) : { refus, rang, etat } au premier refus
// (« etat », celui qu'a reçu l'événement refusé), sinon { refus: null,
// types }, avec le type de chacun, et pour chacun si l'offre l'annonçait à
// son moment (« offertIci » : l'offre de l'état reçu, déjà lue).
function jouerLaCommande(etat, evenements, offertIci = offre(etat)) {
  let courant = etat;
  const types = [];
  for (const [rang, evenement] of evenements.entries()) {
    const offert = (rang === 0 ? offertIci : offre(courant)).types.includes(evenement.type);
    const rendu = appliquer(courant, evenement);
    if (rendu.refus) return { refus: rendu.refus, rang, recu: courant, rendu: rendu.etat };
    types.push({ type: evenement.type, offert });
    courant = rendu.etat;
  }
  return { refus: null, types };
}

// Ce qu'une source de palette peut être quand le Mode MJ est éteint (contrat
// de la vague 3, § 7) : la capacité jouée, un passif, ou un état.
function sourceSansLeModeMj(etat, source) {
  if (source?.genre === "etat") return true;
  if (source?.genre !== "capacite") return false;
  const geste = gesteEnCours(etat);
  return (geste !== null && source.qui === geste.acteur && source.capacite === geste.capacite) || passifDe(etat, source) !== null;
}

/**
 * Joue les événements d'un élément de vue et en tient le bilan. Mode MJ
 * allumé : actif, le moteur les accepte, et l'offre annonçait chacun à son
 * moment ; inactif, il les refuse, et l'état rendu est l'objet reçu. Mode MJ
 * éteint, sur ce même jeu, sans rien appliquer de plus : seuls comptent les
 * éléments sans « mj » ; aucun ne porte un geste du MJ, et un effet n'y a
 * pour source que la capacité jouée, un passif ou un état.
 */
function jouerLElement(etat, ou, offert, evenements, { actif, mj }, bilan) {
  const joue = jouerLaCommande(etat, evenements, offert);
  if (!actif) {
    assert.notEqual(joue.refus, null, `${ou} : un élément inactif porte ${JSON.stringify(evenements)}, que le moteur accepte`);
    assert.equal(joue.rendu, joue.recu, `${ou} : un refus rend l'état reçu`);
    bilan.compte.inactifs += 1;
    return;
  }
  assert.equal(joue.refus, null, `${ou} : une vue porte ${JSON.stringify(evenements)}, que le moteur refuse (${joue.refus?.message})`);
  joue.types.forEach(({ type, offert: annonce }, rang) => {
    assert.ok(annonce, `${ou} : une vue porte un « ${type} » que l'offre n'annonce pas à son moment`);
    bilan.allume.add(type);
    if (mj) return;
    assert.notEqual(type, "mj", `${ou} : le Mode MJ éteint montre un geste du MJ : ${JSON.stringify(evenements[rang])}`);
    if (type === "effet") {
      assert.ok(sourceSansLeModeMj(etat, evenements[rang].source), `${ou} : le Mode MJ éteint montre un effet au nom de ${JSON.stringify(evenements[rang].source)}`);
      bilan.compte.effetsSansLeModeMj += 1;
    }
    bilan.eteint.add(type);
  });
}

// Éprouve tout ce que porte un relevé : ses commandes, puis ses saisies,
// complétées comme le fait l'écran (« contexte » : la durée et X d'une
// palette, les durées d'un menu du MJ).
function eprouverLeReleve(etat, ou, offert, { commandes, saisies }, bilan, contexte = {}) {
  for (const { commande, actif, mj } of commandes) {
    // { evenement } ou { evenements } : les autres commandes (choisir, préparer) ne sont pas des événements.
    const evenements = commande.evenements ?? (commande.evenement === undefined ? null : [commande.evenement]);
    if (evenements === null) continue;
    if (commande.evenements !== undefined) {
      assert.ok(Array.isArray(evenements) && evenements.length >= 1 && evenements.length <= 4, `${ou} : une commande porte ${JSON.stringify(commande)}, qui n'a pas de 1 à 4 événements`);
      bilan.compte.multiples += 1;
    }
    jouerLElement(etat, ou, offert, evenements, { actif, mj }, bilan);
    if (actif) bilan.compte.acceptes += 1;
  }
  for (const releve of saisies) {
    // Un genre de la palette inactif pour la même raison qu'à une autre palette de cet état (son moment, le
    // plus souvent, qui ne tient pas à la source) ne s'éprouve qu'une fois.
    if (!releve.actif && releve.saisie.gabarit.evenement.type === "effet") {
      const raison = `${releve.saisie.genre} ${releve.saisie.raison}`;
      if (bilan.refusDesGenres.has(raison)) continue;
      bilan.refusDesGenres.add(raison);
    }
    const evenements = epreuvesDe(releve, contexte);
    assert.ok(evenements.length > 0, `${ou} : une saisie ne se complète d'aucune valeur : ${JSON.stringify(releve.saisie.gabarit)}`);
    for (const evenement of evenements) {
      jouerLElement(etat, ou, offert, [evenement], releve, bilan);
      if (!releve.actif) continue;
      bilan.compte.saisies += 1;
      if (evenement.type === "effet") bilan.compte.effets += 1;
      if (evenement.type === "mj") bilan.compte.mj += 1;
    }
  }
}

// Les sources de la palette que portent les vues (contrat de la vague 3, § 7),
// chacune avec ce qui l'ouvre : « Palette », que le Mode MJ seul montre (la
// palette libre, au nom de la capacité jouée) ; « Appliquer l'effet de… » ; un
// passif du jet qui peut servir ; l'étiquette d'un état ; et le MJ, que la
// palette libre propose toujours. Une source ouverte par un élément sans
// « mj » se voit Mode MJ éteint.
function sourcesDesVues(vues, sources) {
  const ouvrir = (source, { libre = false, mj = false } = {}) => {
    const cle = canonique(source);
    const deja = sources.get(cle) ?? { source, libre: false, mjSeul: true };
    sources.set(cle, { source, libre: deja.libre || libre, mjSeul: deja.mjSeul && mj });
  };
  const geste = vues.panneau.geste;
  if (geste?.palette) ouvrir(geste.palette.source, { libre: true, mj: geste.palette.mj === true });
  if (geste?.appliquerEffet) ouvrir(geste.appliquerEffet.source);
  for (const passif of geste?.passifs ?? []) if (passif.actif !== false) ouvrir(passif.source);
  for (const fiche of vues.fiches) for (const etiquette of fiche?.effets ?? []) if (etiquette.appliquer) ouvrir(etiquette.appliquer.source);
  ouvrir({ genre: "mj" }, { libre: true, mj: true });
  return sources;
}

const LE_JOURNAL_ECRIRA = "Le journal écrira : ";

// Les genres qui ont leur phrase au journal (journal.js, ecrireEffet) : leur aperçu ne manque jamais.
const AVEC_SA_PHRASE = ["rendre", "attaque", "defense", "etat", "deplacer"];

/**
 * Le chemin entier de « Appliquer » (D10 bis), pour un genre choisi : la
 * palette rendue avec ce choix et la simulation du vrai moteur porte un
 * « Appliquer » actif, dont la commande est l'événement que l'écran complète,
 * et un aperçu (« Le journal écrira : … »), que rendre, ±N, un état et un
 * déplacement ont toujours (journal.js, ecrireEffet ; contrat, § 7) ; la
 * commande se joue. Rend la palette rendue.
 */
function appliquerLeChoix(etat, ou, offert, { source, apports, mj }, genre, valeurs, x, bilan) {
  const choisi = { genre: genre.genre, valeurs, x };
  const vue = vuePalette(etat, source, { ...apports, choisi });
  const duree = vue.onglets.at(-1).champ;
  const ici = `${ou}, « Appliquer » ${JSON.stringify(choisi)} au nom de ${JSON.stringify(source)}`;
  assert.equal(vue.appliquer?.actif, true, `${ici} : inactif (${vue.appliquer?.raison})`);
  const attendu = evenementDeLaPalette(genre.gabarit, A_DUREE.includes(genre.genre) ? { duree: duree?.valeur, ...valeurs } : valeurs, x);
  assert.equal(canonique(vue.appliquer.commande?.evenement), canonique(attendu), `${ici} : sa commande n'est pas l'événement que l'écran complète`);
  if (AVEC_SA_PHRASE.includes(genre.genre)) assert.ok(vue.apercu?.startsWith(LE_JOURNAL_ECRIRA), `${ici} : aucun aperçu (${vue.apercu})`);
  else assert.ok(vue.apercu === null || vue.apercu.startsWith(LE_JOURNAL_ECRIRA), `${ici} : l'aperçu ${vue.apercu}`);
  jouerLElement(etat, ou, offert, [vue.appliquer.commande.evenement], { actif: true, mj: mj || genre.mj }, bilan);
  bilan.compte.simules += 1;
  if (vue.apercu !== null) bilan.compte.apercus += 1;
  return vue;
}

/**
 * Les palettes d'un état, une par source, rendues une fois sans choix
 * (contrat de la vague 3, § 7) : tout ce qu'elles portent s'éprouve. Avant,
 * deux chemins entiers de « Appliquer », une fois par état, chacun à tour de
 * rôle d'un pas à l'autre, de genre comme de source : un genre actif de
 * l'onglet Cible, choisi à ses valeurs par défaut, dont l'onglet Durée donne
 * sa durée à ±N et à un état de toutes les palettes de l'état (la durée ne se
 * juge qu'au moment, jamais à la source : js/combat/effets.js, raisonDuMoment) ;
 * puis un autre genre actif, choisi à un bout de ses champs.
 */
function eprouverLesPalettes(etat, ou, offert, sources, bilan, n) {
  const simuler = (evenement) => appliquer(etat, evenement);
  const palettes = [...sources.values()].map(({ source, libre, mjSeul }) => {
    const apports = { etats: ETATS, libre, choisi: null, simuler };
    const palette = vuePalette(etat, source, apports);
    assert.notEqual(palette, null, `${ou} : une vue porte la source ${JSON.stringify(source)}, que la palette ne trouve pas`);
    bilan.compte.palettes += 1;
    const actifs = palette.onglets.flatMap((onglet) => onglet.genres).filter((genre) => genre.actif);
    return { palette, ouverte: { source, apports, mj: mjSeul }, aDuree: actifs.filter((genre) => A_DUREE.includes(genre.genre)), autres: actifs.filter((genre) => !A_DUREE.includes(genre.genre)) };
  });
  const aTourDeRole = (liste) => (liste.length === 0 ? null : liste[n % liste.length]);

  let duree = null;
  const avecDuree = aTourDeRole(palettes.filter((une) => une.aDuree.length > 0));
  if (avecDuree !== null) {
    const genre = aTourDeRole(avecDuree.aDuree);
    const { x } = avecDuree.palette;
    duree = appliquerLeChoix(etat, ou, offert, avecDuree.ouverte, genre, valeursParDefaut(genre.champs), x?.valeur ?? null, bilan).onglets.at(-1).champ;
    assert.equal(duree?.nom, "duree", `${ou} : l'onglet Durée porte la durée de « ${genre.genre} »`);
  }
  const avecAutres = aTourDeRole(palettes.filter((une) => une.autres.length > 0));
  if (avecAutres !== null) {
    const genre = aTourDeRole(avecAutres.autres);
    const { x } = avecAutres.palette;
    const bout = n % 2 === 0 ? "premier" : "dernier";
    const valeurs = valeursChoisies(genre.champs, bout);
    assert.notEqual(valeurs, null, `${ou} : « ${genre.genre} », actif, n'a rien à choisir`);
    appliquerLeChoix(etat, ou, offert, avecAutres.ouverte, genre, valeurs, x === null ? null : x[bout === "premier" ? "min" : "max"], bilan);
    bilan.compte.genresChoisis.add(genre.genre);
  }

  for (const { palette, ouverte } of palettes) eprouverLeReleve(etat, ou, offert, relever(palette, undefined, { actif: true, mj: ouverte.mj }), bilan, { duree, x: palette.x });
}

/**
 * Le menu du MJ d'un vivant, une fois par état (contrat de la vague 3, § 7) :
 * inactif, il l'est tout entier (§ 3) et un seul refus l'éprouve ; actif, tout
 * ce qu'il porte s'éprouve, puis le chemin entier d'« Enregistrer » (D10 bis) :
 * sa première valeur saisie à l'autre bout, avec la simulation du vrai moteur.
 */
function eprouverLeMenu(etat, ou, offert, id, bilan) {
  const apports = { etats: ETATS, saisies: null, simuler: (evenement) => appliquer(etat, evenement) };
  const menu = vueMenuMj(etat, id, apports);
  if (menu === null) return;
  bilan.compte.menus += 1;
  assert.equal(menu.mj, true, `${ou} : le menu du MJ de ${id} ne se montre qu'en Mode MJ`);
  if (menu.actif === false) {
    assert.ok(typeof menu.raison === "string" && menu.raison.length > 0, `${ou} : le menu inactif de ${id} dit pourquoi`);
    jouerLElement(etat, ou, offert, [menu.retirer.commande.evenement], { actif: false, mj: true }, bilan);
    bilan.compte.menusInactifs += 1;
    return;
  }
  eprouverLeReleve(etat, ou, offert, relever(menu), bilan, { durees: menu.etats.durees.map((duree) => duree.valeur) });
  const [champ] = menu.valeurs.champs;
  const saisies = { [champ.cle]: champ.valeur === champ.max ? champ.min : champ.max };
  const { valeurs } = vueMenuMj(etat, id, { ...apports, saisies });
  const ici = `${ou}, « Enregistrer » ${JSON.stringify(saisies)} pour ${id}`;
  assert.equal(valeurs.enregistrer.actif, true, `${ici} : inactif (${valeurs.enregistrer.raison})`);
  assert.ok(valeurs.apercu?.startsWith(LE_JOURNAL_ECRIRA), `${ici} : aucun aperçu (${valeurs.apercu})`);
  jouerLElement(etat, ou, offert, [valeurs.enregistrer.commande.evenement], { actif: true, mj: true }, bilan);
  bilan.compte.simules += 1;
}

test("concordance : à chaque pas du combat de référence, Mode MJ allumé puis éteint, tout ce que porte une vue est accepté, tout ce qu'elle dit inactif est refusé, et un événement de tout autre type est refusé, l'état rendu étant l'objet reçu", (t) => {
  const compte = { acceptes: 0, saisies: 0, refuses: 0, inactifs: 0, multiples: 0, palettes: 0, effets: 0, effetsSansLeModeMj: 0, menus: 0, menusInactifs: 0, mj: 0, simules: 0, apercus: 0, genresChoisis: new Set() };
  const typesPortes = new Set();
  const typesEteints = new Set();
  const typesRefuses = new Set();

  TENUS.forEach((etat, n) => {
    const ou = `après ${n} événement(s)`;
    const offert = offre(etat);
    // Hors d'un geste, l'écran a choisi celui qui joue : celui que le scénario fait jouer ensuite, sinon le premier qui le peut.
    const suivant = CONTENU.evenements[n];
    const choisi = suivant?.qui ?? candidats(etat)[0] ?? null;
    const bilan = { compte, allume: new Set(), eteint: new Set(), refusDesGenres: new Set() };
    const sources = new Map();

    for (const lu of new Set([choisi, null])) {
      const vues = vuesDe(etat, lu);
      eprouverLeReleve(etat, ou, offert, relever(vues), bilan);
      sourcesDesVues(vues, sources);
    }
    // Une fois par état, hors de la boucle de « choisi » (contrat de la vague 3, § 7, R n° 29) : la palette de
    // chaque source que portent les vues, et le menu du MJ de chaque vivant.
    eprouverLesPalettes(etat, ou, offert, sources, bilan, n);
    for (const id of etat.ordre) eprouverLeMenu(etat, ou, offert, id, bilan);

    // Le dé n'est pas une commande : l'écran lance celui que le panneau dit attendre.
    const aLancer = vuePanneau(etat, choisi).geste?.aLancer ?? null;
    assert.deepEqual(aLancer === null ? null : [aLancer.faces, aLancer.combien, aLancer.motif], offert.de === null ? null : [offert.de.faces, offert.de.combien, offert.de.motif], `${ou} : le dé du panneau est celui de l'offre`);
    if (aLancer !== null) for (const portes of [bilan.allume, bilan.eteint]) portes.add("de");

    // Tout ce que l'offre annonce se joue depuis une vue : l'écran ne laisse aucun geste hors d'atteinte, Mode MJ
    // allumé ; éteint, rien de ce que le Mode MJ ne montre pas seul.
    for (const type of offert.types) {
      if (type === "lancer") continue;
      assert.ok(bilan.allume.has(type), `${ou} : l'offre annonce « ${type} », qu'aucune vue ne porte`);
      if (!SANS_LE_MODE_MJ.includes(type)) assert.ok(bilan.eteint.has(type), `${ou} : l'offre annonce « ${type} », que le Mode MJ éteint ne montre pas`);
    }
    for (const type of bilan.allume) typesPortes.add(type);
    for (const type of bilan.eteint) typesEteints.add(type);

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
  t.diagnostic(
    `${compte.acceptes} commandes acceptées, dont ${compte.multiples} à plusieurs événements ; ${compte.saisies} saisies complétées, dont ${compte.effets} effets de ${compte.palettes} palettes (${compte.effetsSansLeModeMj} Mode MJ éteint) et ${compte.mj} gestes de ${compte.menus} menus du MJ (${compte.menusInactifs} inactifs) ; ${compte.simules} « Appliquer » et « Enregistrer » simulés, ${compte.apercus} aperçus, ${compte.genresChoisis.size} genres choisis hors de l'onglet Cible (${[...compte.genresChoisis].sort().join(", ")}) ; ${compte.inactifs} éléments inactifs refusés ; ${compte.refuses} événements d'un autre type refusés`,
  );
  assert.ok(compte.acceptes > 1000, `${compte.acceptes} commandes acceptées`);
  // Le Chef qui avance d'une case depuis Pas chassé [2] la paie de [1] : la case porte deux événements.
  assert.ok(compte.multiples > 0, "des cases d'arrivée portent deux événements");
  assert.ok(compte.saisies > 100, `${compte.saisies} saisies complétées`);
  assert.ok(compte.inactifs > 50, `${compte.inactifs} éléments inactifs refusés`);
  assert.ok(compte.refuses > 1000, `${compte.refuses} événements d'un autre type refusés`);
  // La vague 3 du lot 4.3 : la palette (Mode MJ éteint compris), le menu du MJ, actif et inactif, et les chemins
  // entiers de « Appliquer » et d'« Enregistrer ».
  assert.ok(compte.effets > 1000 && compte.effetsSansLeModeMj > 1000, `${compte.effets} effets, dont ${compte.effetsSansLeModeMj} Mode MJ éteint`);
  assert.ok(compte.mj > 100 && compte.menusInactifs > 100, `${compte.mj} gestes du MJ, ${compte.menusInactifs} menus inactifs`);
  assert.ok(compte.simules > 100 && compte.genresChoisis.size >= 10, `${compte.simules} simulés, ${compte.genresChoisis.size} genres choisis hors de l'onglet Cible`);
  assert.deepEqual([...typesRefuses].sort(), [...TYPES].sort(), "chaque type a été refusé à un moment où il ne s'offrait pas");
  // Le lancement est une commande de la préparation ; le combat de référence n'explose plus (mission du lot 4.3,
  // § 10), et « exploser » se voit porté dans les contrôles de l'écran. Les types du lot 4.3 que ce combat
  // traverse : la blessure, la contre-attaque laissée ou jouée, l'intervention, l'effet, le geste du MJ. Le
  // critique, qu'il ne traverse pas, se voit porté dans les contrôles de la lecture (combat_lecture).
  const ATTENDUS = [...TYPES.filter((type) => type !== "lancer" && type !== "exploser"), "blessure", "laisser", "intervenir", "contre_attaquer", "effet", "mj"];
  assert.deepEqual(ATTENDUS.filter((type) => !typesPortes.has(type)), [], "chaque type d'événement est porté par une vue à un moment du combat");
  assert.deepEqual(ATTENDUS.filter((type) => !SANS_LE_MODE_MJ.includes(type) && !typesEteints.has(type)), [], "le Mode MJ éteint porte chaque type qu'il doit montrer");
  assert.deepEqual([...typesPortes].filter((type) => !TYPES.includes(type) && !ATTENDUS.includes(type) && type !== "critique"), [], "une vue ne porte rien d'autre");
});
