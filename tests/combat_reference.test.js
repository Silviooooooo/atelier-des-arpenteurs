// Contrôles du combat de référence fictif du simulateur de combat
// (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) », et § 11).
//
// Le combat de référence (tests/outils/combat_reference.js) est l'oracle du
// moteur : un combat entier, joué dans la démonstration sans en changer une
// valeur, dont le journal et l'état final ont été calculés à la main avant le
// code, puis recalculés deux fois. Ce fichier le fait jouer par le chemin
// entier, celui que suivra l'écran : la banque de démonstration telle qu'elle
// est publiée, les photographies qu'en tire js/combat/photographie.js, le
// lecteur de scénario, le moteur. Il compare ensuite les cases d'office des
// ajouts, l'état final et le journal, mot pour mot.
//
// Rien ici ne se corrige d'après ce que rend le moteur : un écart est un
// défaut du moteur, ou une lecture à porter devant l'auteur. Les valeurs
// écrites dans ce fichier (le suivi des ressources, le point de la maquette,
// le compte des événements) sont transcrites du calcul à la main, ou comptées
// sur le scénario ; aucune n'a été relevée sur le moteur.
//
// Les comparaisons, celle du journal, celle de l'état et celle d'un combat
// arrêté en cours de route, sont celles du banc sur le vrai classeur
// (tests/banc_combat_reel.js). Elles sont vues ici dans les deux sens : dire
// un écart, en citant la ligne ou le protagoniste, puis se taire. Ce que le
// banc compare hors de node --test est ainsi tenu.
//
// Au groupe 2 (contrat du groupe, § 2, § 3, § 4.5) : les trente-six lignes ne
// changent pas, et chacune est la concaténation de ses segments ; à chaque
// événement, la ligne en cours est le début exact de la ligne que le geste
// écrira ; à la fin de chaque geste, « annuler » rend l'état d'avant lui ;
// et le même combat, écrit en version 1 ou 2 des règles (d'avant le lot 5),
// se dit d'une autre version.
//
// Au lot 4.3 (mission, § 10) : sans le −1 des blessures, huit lignes changent,
// et la mission les redonne mot pour mot ; Moulinet farineux est Centré, la
// contre-attaque se laisse passer, et Aubépine choisit sa blessure dans le bloc
// de blessure de la banque. L'état final porte ses blessures en liste, et la
// version des règles est la 4.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { validerContenu, validerPhoto } from "../js/combat/forme.js";
import { evaluerEssai } from "../js/combat/jet.js";
import { ligneEnCours, nommerLeGeste, phrasesDuGeste, segmentsDuGeste } from "../js/combat/journal.js";
import { appliquer, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import { offre } from "../js/combat/offre.js";
import { REGLES } from "../js/combat/regles.js";
import { photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { ecrireAbsents, tableDesRoles } from "../js/combat/roles.js";
import { effetsDurablesDe, gesteEnCours } from "../js/combat/valeurs.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter, lirePersonnage } from "../js/personnage/format.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { bornesDesFacons, ecartsDeCapacitesA, ecartsDeLArret, ecartsDeLEtat, ecartsDeLOffreAllegee, ecartsDeLaLigneEnCours, ecartsDesSegments, ecartsDuJournal, ecrireDepart } from "./banc_combat_reel.js";
import { casesDOffice, etatAttendu, journalAttendu, scenario } from "./outils/combat_reference.js";
import { versContenu } from "./outils/scenario.js";

// ─── La démonstration, telle qu'elle est publiée ────────────────────────────

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const AUBEPINE = lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage;
const INDEX = indexerCreation(BANQUE);
const ROLES = await tableDesRoles(BANQUE, "demo");
const ADVERSAIRES = indexerAdversaires(BANQUE, INDEX);

const RENDUS = {
  "Aubépine Crèmebrûlée": photographierPersonnage(BANQUE, AUBEPINE, { index: INDEX, roles: ROLES }),
  "Chef de partie": photographierAdversaire(ADVERSAIRES, "Chef de partie", { banque: BANQUE, roles: ROLES }),
  "Marmiton de corvée": photographierAdversaire(ADVERSAIRES, "Marmiton de corvée", { banque: BANQUE, roles: ROLES }),
};
for (const [nom, rendu] of Object.entries(RENDUS)) assert.equal(rendu.refus, undefined, `${nom} : ${rendu.refus}`);
const PHOTOS = Object.fromEntries(Object.entries(RENDUS).map(([nom, rendu]) => [nom, rendu.photo]));

// Le combat entier, joué une fois ; et le même, arrêté où l'on veut. La
// blessure qu'Aubépine choisit se prend, figée, dans le bloc de blessure de la
// banque publiée (photographie.js, etatsDeLaBanque).
const JOUE = versContenu(scenario, PHOTOS, { banque: BANQUE });
const arrete = (jusqua) => versContenu(scenario, PHOTOS, { jusqua, banque: BANQUE }).etat;
const lignesDe = (etat) => etat.journal.map((ligne) => ligne.texte);

const [PJ, CHEF, MARMITON_1, MARMITON_2] = JOUE.etat.ordre;
const zoneDe = (etat, id, code) => etat.protagonistes[id].zones[etat.photos[id].zones.findIndex((zone) => zone.code === code)];
const signe = (code) => String.fromCodePoint(code);

// Le même combat, tenu un événement à la fois : TENUS[n] est l'état après n
// événements, comme le tient l'écran.
const TENUS = [ouvrirCombat(JOUE.contenu.miseEnPlace)];
for (const evenement of JOUE.contenu.evenements) TENUS.push(appliquer(TENUS.at(-1), evenement).etat);

// Les gestes finis, chacun à l'événement qui l'a fini : un maillon neuf sur la
// pile d'annulation (la pile se compare par identité de maillons).
const FINS_DE_GESTE = [];
for (let n = 1; n < TENUS.length; n += 1) {
  const maillon = TENUS[n].annulation.pile;
  if (maillon !== TENUS[n - 1].annulation.pile && maillon?.precedent === TENUS[n - 1].annulation.pile) FINS_DE_GESTE.push({ n, maillon });
}

const texteDes = (segments) => segments.map((segment) => segment.texte).join("");

// Les blessures qu'un protagoniste porte (lot 4.3) : ses effets durables de
// blessure, dans l'ordre où ils sont venus.
const blessuresPortees = (etat, id) => effetsDurablesDe(etat, id).filter((effet) => effet.blessure === true);

// Où deux valeurs se séparent : le chemin du premier écart, pour qu'un échec
// dise autre chose que deux états entiers (et qu'aucun état entier ne passe
// par assert.deepEqual).
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

// ─── Les photographies ──────────────────────────────────────────────────────

test("la démonstration donne les trois photographies du combat, avec leur source, et chacune se relirait d'un combat gardé", () => {
  assert.deepEqual(Object.keys(PHOTOS), scenario.ajouts.map(([, nom]) => nom), "une photographie par nom des ajouts, et pas une de plus");
  for (const [nom, photo] of Object.entries(PHOTOS)) {
    assert.equal(photo.valeurs.nom, nom);
    assert.notEqual(photo.source, null, `${nom} : une photographie de la banque porte sa source, celles d'essai n'en ont pas`);
    assert.equal(photo.publiee_le, BANQUE.publiee_le ?? null, `${nom} : la date de la banque`);
    const relue = validerPhoto(JSON.parse(JSON.stringify(photo)), { accepter });
    assert.equal(relue.erreur, undefined, `${nom} : ${relue.erreur}`);
    assert.deepEqual(relue.photo, photo, `${nom} : passée par JSON, la photographie est la même`);
  }
  assert.deepEqual([PHOTOS["Aubépine Crèmebrûlée"].camp, PHOTOS["Chef de partie"].camp, PHOTOS["Marmiton de corvée"].camp], ["pj", "adv", "adv"]);
});

// Relecture de fin de groupe (lot 4) : le banc disait l'armure de chaque zone
// sans ses faces. La localisation était alors la seule valeur d'un journal
// qui ne se recalculait pas d'après sa sortie.
test("le départ que dit le banc : chaque zone avec ses faces et son armure, dans l'ordre du d20", () => {
  const zonesDe = (photo) => {
    const lignes = ecrireDepart(photo).filter((ligne) => ligne.includes("zones, dans l'ordre du d20"));
    assert.equal(lignes.length, 1, `${photo.valeurs.nom} : une ligne pour ses zones`);
    return lignes[0];
  };
  const TETE = "      zones, dans l'ordre du d20 (faces : armure) : ";
  assert.equal(zonesDe(PHOTOS["Aubépine Crèmebrûlée"]), `${TETE}tête 1 : 6, torse 2-11 : 30, jambe gauche 12-13 : 10, jambe droite 14-15 : 10, bras gauche 16-17 : 10, bras droit 18-19 : 10 ; face de contre-attaque : 20`);
  assert.equal(zonesDe(PHOTOS["Chef de partie"]), `${TETE}torse 2-11 : 38, jambe gauche 12-13 : 0, jambe droite 14-15 : 0, bras gauche 16-17 : 19, bras droit 18-19 : 19, tête 20 : 6 ; face de contre-attaque : 1`);
  // Une grille qui n'est pas celle des personnages : ses faces ne se devinent pas.
  const homard = photographierAdversaire(ADVERSAIRES, "Homard furieux", { banque: BANQUE, roles: ROLES }).photo;
  assert.equal(zonesDe(homard), `${TETE}corps 2-11 : 30, pince gauche 12-14 : 30, pince droite 15-17 : 30, tête 18-20 : 36 ; face de contre-attaque : 1`);

  // La localisation se recalcule d'après cette ligne : chaque face du d20, hors celle de la contre-attaque, y est une fois.
  for (const photo of [...Object.values(PHOTOS), homard]) {
    const [zones] = zonesDe(photo).slice(TETE.length).split(" ; ");
    const faces = [...zones.matchAll(/ (\d+)(?:-(\d+))? : \d+/g)].flatMap(([, debut, fin]) => Array.from({ length: Number(fin ?? debut) - Number(debut) + 1 }, (_, rang) => Number(debut) + rang));
    assert.deepEqual(faces, Array.from({ length: 20 }, (_, rang) => rang + 1).filter((face) => face !== photo.valeurs.faceContre), photo.valeurs.nom);
  }
});

test("aucun rôle câblé ne manque à la démonstration : la ligne des absents est vide, et elle sait ne pas l'être", async () => {
  assert.deepEqual(ROLES.absents, []);
  assert.equal(ecrireAbsents(ROLES.absents), null, "la préparation n'écrit pas la ligne « Câblés absents de la banque »");

  // Armé : la même banque, lue comme le vrai classeur, n'a aucun des noms attendus.
  const commeLeVrai = await tableDesRoles(BANQUE, "reel");
  assert.ok(commeLeVrai.absents.length > 0);
  assert.match(ecrireAbsents(commeLeVrai.absents), /^Câblés absents de la banque : .+\.$/);
});

// ─── La mise en place ───────────────────────────────────────────────────────

test("les ajouts se posent d'office : Aubépine en A1, le Chef en J1, les deux Marmitons ensemble en J2", () => {
  assert.deepEqual(JOUE.casesDOffice, casesDOffice);
  assert.deepEqual(casesDOffice, ["A1", "J1", "J2", "J2"], "un personnage sur la colonne A, un adversaire sur la colonne J, les exemplaires sur la même case");
});

test("puis ils se déplacent avant le lancement, et rien de la mise en place n'entre au journal", () => {
  const { miseEnPlace } = JOUE.contenu;
  assert.deepEqual(
    miseEnPlace.protagonistes.map(({ id, case: nomDeCase }) => [id, nomDeCase]),
    [
      [PJ, "C3"],
      [CHEF, "F6"],
      [MARMITON_1, "D4"],
      [MARMITON_2, "D4"],
    ],
  );
  assert.deepEqual([miseEnPlace.mode, miseEnPlace.quiCommence], ["demo", "pj"]);

  const avant = ouvrirCombat(miseEnPlace);
  assert.equal(avant.phase, "preparation");
  assert.deepEqual(avant.journal, []);
  assert.equal(avant.pas, 0);
  assert.deepEqual(
    avant.ordre.map((id) => avant.noms[id].court),
    etatAttendu.map(({ protagoniste }) => protagoniste),
    "les noms courts du journal, dans l'ordre d'ajout",
  );
  assert.equal(JOUE.contenu.evenements[0].type, "lancer", "le premier événement est le lancement");
});

// ─── Le journal et l'état final ─────────────────────────────────────────────

test("le journal du combat de référence, mot pour mot : trente-six lignes, du lancement à la victoire", () => {
  const lignes = lignesDe(JOUE.etat);
  const ecarts = ecartsDuJournal(lignes, journalAttendu);
  assert.equal(ecarts.length, 0, `${ecarts.length} ligne(s) s'écartent du journal attendu :\n${ecarts.join("\n")}`);
  assert.deepEqual(lignes, journalAttendu);
  assert.equal(lignes.length, 36);

  // Le texte est exact jusque dans ses signes : aucune espace insécable, et aucun signe moins. Les cinq qu'il
  // portait venaient du −1 des blessures, qui n'est plus (mission du lot 4.3, § 10 : « d10−1 » devient « d10+1 ») ;
  // les signes moins des gabarits neufs s'éprouvent sur des combats fabriqués (combat_g3_journal.test.js).
  const texte = lignes.join("\n");
  for (const code of [0x00a0, 0x202f]) assert.equal(texte.includes(signe(code)), false, "aucune espace insécable");
  assert.equal(texte.includes(signe(0x2212)), false, "aucun signe moins");
  assert.equal(/\d-\d|d\d+-/.test(texte), false, "aucun trait d'union pour un signe moins");
});

test("l'état final du combat de référence, protagoniste par protagoniste : case, actions, souffle, lien, corps, zones touchées", () => {
  const ecarts = ecartsDeLEtat(JOUE.etat, etatAttendu);
  assert.equal(ecarts.length, 0, `${ecarts.length} écart(s) avec l'état attendu :\n${ecarts.join("\n")}`);

  // Le combat finit pendant le tour 5 des PJ, sans « Fin du tour ».
  assert.equal(JOUE.etat.phase, "termine");
  assert.equal(JOUE.etat.vainqueur, "pj");
  assert.deepEqual(JOUE.etat.tour, { numero: 5, camp: "pj" });
  assert.equal(gesteEnCours(JOUE.etat), null);
  assert.equal(JOUE.etat.pas, JOUE.contenu.evenements.length);

  // La blessure d'Aubépine (lot 4.3) : Main brûlée, prise figée dans le bloc de blessure de la banque, rejoint sa
  // photographie pour ce combat, et un effet durable la montre, avec sa zone (contrat, § 5.9 ; § 12, choix 18).
  const [blessure, ...autres] = blessuresPortees(JOUE.etat, PJ);
  assert.equal(autres.length, 0, "une seule blessure");
  const photo = JOUE.etat.photos[PJ];
  assert.ok(photo.capacites.at(-1) === blessure.capacite, "la capacité figée est la dernière de sa photographie, l'objet même");
  assert.equal(photo.capacites.length, JOUE.contenu.miseEnPlace.protagonistes[0].photo.valeurs.capacites.length + 1, "une capacité de plus que sa photographie de départ");
  assert.deepEqual([blessure.capacite.nom, blessure.capacite.groupe.titre, blessure.capacite.facons[0].description, blessure.libre], ["Main brûlée", "Blessure", "Désavantage avec une arme précise.", null]);
  assert.deepEqual([blessure.genre, blessure.duree, blessure.porteur, blessure.auteur, photo.zones[blessure.zone].code], ["etat", "combat", PJ, CHEF, "bras_gauche"]);
  assert.deepEqual(blessure.source, { genre: "capacite", qui: PJ, capacite: photo.capacites.length - 1 });
  // Les autres effets durables : aucun ; et aucun adversaire n'a d'étape de blessure.
  assert.deepEqual(JOUE.etat.effets.map((effet) => effet.porteur), [PJ]);
});

// Le suivi des ressources du calcul à la main (son tableau « étape par
// étape »), relu après chaque geste du scénario. Une fin automatique de tour
// suit son geste dans le même événement : la ligne d'un geste qui finit un
// tour est donc celle d'après la fin du tour.
//
// Ses blessures (lot 4.3, mission § 4.10 et § 10) : celles qu'elle porte, non
// plus ses zones sans endurance. Le Moulinet du geste 12 lui laisse la jambe
// gauche sans endurance sans lui ôter de corps : aucune blessure ; la Frappe du
// geste 22 lui en fait choisir une, Main brûlée.
//   [tour, camp qui joue, actions d'Aubépine, son souffle, son lien, ses blessures, souffle du Chef, souffle de Marmiton n° 2]
const SUIVI = [
  /* départ               */ [1, "pj", 2, 10, 1, 0, 7, 5],
  /*  1 Frappe            */ [1, "pj", 1, 10, 1, 0, 7, 5],
  /*  2 Pas chassé, fin   */ [1, "adv", 2, 10, 1, 0, 7, 5],
  /*  4 Frappe            */ [1, "adv", 2, 10, 1, 0, 7, 5],
  /*  5 Pas chassé [2]    */ [1, "adv", 2, 10, 1, 0, 6, 5],
  /*  6 Frappe, fin       */ [2, "pj", 2, 10, 1, 0, 6, 5],
  /*  8 Émincer           */ [2, "pj", 1, 6, 1, 0, 6, 5],
  /*  9 Taloche, fin      */ [2, "adv", 2, 6, 1, 0, 6, 5],
  /* 11 Frappe, esquive   */ [2, "adv", 1, 3, 1, 0, 6, 5],
  /* 12 Moulinet, fin     */ [3, "pj", 1, 3, 1, 0, 6, 0],
  /* 14 Goûter, fin       */ [3, "adv", 2, 3, 1, 0, 6, 0],
  /* 16 Moulinet annulé   */ [3, "adv", 2, 3, 1, 0, 1, 0],
  /* 17 passe, fin        */ [4, "pj", 2, 3, 1, 0, 1, 0],
  /* 19 Fournaise         */ [4, "pj", 1, 2, 0, 0, 1, 0],
  /* 20 Frappe, fin       */ [4, "adv", 2, 2, 0, 0, 1, 0],
  /* 22 Frappe            */ [4, "adv", 2, 2, 0, 1, 1, 0],
  /* 23 « Fin de tour »   */ [5, "pj", 2, 2, 0, 1, 1, 0],
  /* 24 Frappe            */ [5, "pj", 1, 2, 0, 1, 1, 0],
  /* 25 Frappe, victoire  */ [5, "pj", 0, 2, 0, 1, 1, 0],
];

test("le suivi des ressources, geste après geste : les actions qui manquent après le Pas de côté, le souffle, le lien, les blessures", () => {
  assert.equal(SUIVI.length, scenario.gestes.length + 1, "une ligne par geste du scénario, après celle du départ");
  SUIVI.forEach((attendu, gestes) => {
    const etat = arrete(gestes);
    const { actions, souffle, liens } = etat.protagonistes[PJ];
    assert.deepEqual(
      [etat.tour.numero, etat.tour.camp, actions, souffle, liens[0].points, blessuresPortees(etat, PJ).length, etat.protagonistes[CHEF].souffle, etat.protagonistes[MARMITON_2].souffle],
      attendu,
      `après ${gestes} geste(s) du scénario`,
    );
  });

  // Le Pas de côté du tour 2 des adversaires coûte une action : Aubépine n'en a qu'une à son tour 3, et les retrouve à la fin de celui-ci.
  assert.equal(arrete(9).protagonistes[PJ].actions, 1);
  assert.equal(arrete(10).protagonistes[PJ].actions, 2);
});

test("le moment de la maquette : la Taloche d'Aubépine, la relance choisie, le dé de la relance à cliquer", () => {
  const etat = arrete({ geste: 7, des: 2 });
  const geste = gesteEnCours(etat);
  assert.deepEqual([geste.acteur, geste.cible, geste.moment, geste.paye], [PJ, MARMITON_2, "jet", true]);

  // 1er dé : 8, réussi (7 + 1) ; 2e dé : 4, échec, relancé ; le 3e dé est à venir.
  assert.equal(geste.jet.places.length, 2);
  const essais = geste.jet.places.map((place) => evaluerEssai(geste.jet, place.essais[0]));
  assert.deepEqual(
    essais.map(({ somme, reussi }) => [somme, reussi]),
    [
      [8, true],
      [4, false],
    ],
  );
  const offert = offre(etat);
  assert.deepEqual(offert.de, { faces: 8, combien: 1, motif: "relance", place: 2 }, "le d8 de la relance, et lui seul");
  assert.deepEqual(offert.choix, []);
  // Et la palette (lot 4.3), qui s'offre à tout moment d'un geste payé.
  assert.deepEqual(offert.types, ["de", "effet"]);

  // L'action de la Taloche est payée au premier dé ; le journal finit par la ligne d'Émincer.
  assert.deepEqual([etat.protagonistes[PJ].actions, etat.protagonistes[PJ].souffle], [0, 6]);
  assert.deepEqual(zoneDe(etat, PJ, "jambe_gauche"), { armure: 0, armureMax: 10, resistance: 5, resistanceMax: 5 });
  assert.deepEqual(etat.protagonistes[MARMITON_1].mort, { tour: 2 });
  assert.equal(etat.protagonistes[MARMITON_2].corps, 10);
  assert.ok(etat.protagonistes[MARMITON_2].zones.every((zone) => zone.armure === zone.armureMax && zone.resistance === zone.resistanceMax), "Marmiton n° 2 est intact");
  assert.deepEqual([etat.protagonistes[CHEF].actions, etat.protagonistes[CHEF].actionsMax, etat.protagonistes[CHEF].souffle], [1, 1, 6]);
  assert.deepEqual(lignesDe(etat), journalAttendu.slice(0, 12));
  assert.match(journalAttendu[11], /^Aubépine : Émincer /);
});

test("ce que le combat traverse : un événement par dé et par choix, de chaque sorte que la mission demande", () => {
  const compte = {};
  for (const { type } of JOUE.contenu.evenements) compte[type] = (compte[type] ?? 0) + 1;
  // Compté sur le scénario du lot 4.3 (mission, § 10) : dix-huit gestes, dont un « passe » et une « Fin de tour » ;
  // dix-sept réglages (Moulinet farineux, Centré, coche sa cible d'office aux gestes 12 et 16, sans « regler ») ; deux
  // déplacements confirmés ; quarante-six événements de dés (trente-cinq de chaîne, onze d20), qui portent
  // quarante-huit valeurs (le désavantage du geste 1 en lance deux à la fois, deux fois) ; deux relances prises et une
  // refusée ; aucune explosion (le Goûter du geste 14, sans le −1, réussit sans exploser) ; des dégâts fixés une fois ;
  // une esquive ; treize « Appliquer » : dix attaques qui touchent, puis la défense à trois réussites (geste 6), le
  // Goûter (geste 14) et le coup manqué (geste 20), qui l'attendent depuis le lot 4.3 (contrat, § 12, choix 1) ; la
  // face de contre-attaque du geste 16 finit par « laisser » ; une blessure choisie (geste 22). Cent quatre en tout.
  assert.deepEqual(compte, {
    lancer: 1,
    capacite: 16,
    regler: 17,
    confirmer: 2,
    de: 46,
    relancer: 2,
    garder: 1,
    degats: 1,
    esquive: 1,
    appliquer: 13,
    laisser: 1,
    blessure: 1,
    passer: 1,
    fin_de_tour: 1,
  });
  assert.equal(JOUE.contenu.evenements.length, 104);
  assert.equal(JOUE.contenu.evenements.filter((evenement) => evenement.type === "de").flatMap((evenement) => evenement.valeurs).length, 48);
  const d20 = JOUE.contenu.evenements.filter((evenement) => evenement.type === "de" && evenement.faces === 20);
  assert.deepEqual(
    d20.map((evenement) => evenement.valeurs[0]),
    scenario.gestes.flatMap((geste) => geste.localisation ?? []),
    "les d20 du scénario, dans l'ordre, un événement chacun",
  );
  assert.deepEqual(
    JOUE.contenu.evenements.filter((evenement) => evenement.type === "de" && evenement.faces !== 20).flatMap((evenement) => evenement.valeurs),
    scenario.gestes.flatMap((geste) => geste.des ?? []),
    "tous les dés du scénario sont lancés, dans l'ordre, et aucun autre",
  );
});

test("le combat de référence couvre chaque point que la mission lui demande, et le journal joué le montre", () => {
  const lignes = lignesDe(JOUE.etat);
  // Un point de la liste, et le fragment du journal qui le montre (un texte exact, ou un motif).
  const POINTS = [
    ["un déplacement gratuit", /^Aubépine : Pas chassé \[1\], C3 → D4\.$/],
    ["un déplacement payant, celui du Chef de partie", /^Chef : Pas chassé \[2\] \(1 souffle\), F6 → D4\.$/],
    ["un avantage et un désavantage de maîtrise qui s'annulent", "Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent."],
    ["des dégâts fixés à la main, et Réduction", "B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction)."],
    ["une mort par l'armure, l'endurance et le corps", "Armure 5 → 0, endurance 5 → 0, corps 10 → 0. Marmiton n° 1 meurt."],
    ["un coup sur une zone sans armure d'un adversaire, et sa blessure", "Localisation d20 → 14 : jambe droite. Endurance 5 → 0, corps 10 → 7. Blessure (jambe droite), sans effet calculé."],
    // Au lot 4.3 (mission, § 4.10 et § 10) : une zone sans endurance n'est une blessure que si le coup ôte du corps.
    ["un coup sur une zone sans armure d'Aubépine, qui ne lui ôte pas de corps : aucune blessure", /Localisation d20 → 12 : jambe gauche\. Endurance 5 → 0\.$/],
    ["un coup qui ôte du corps à Aubépine, et la blessure qu'elle choisit dans le bloc de blessure", /, corps 10 → 4\. Blessure \(bras gauche\) : Main brûlée\.$/],
    ["une capacité Centrée, sa seule cible cochée d'office", /^Marmiton n° 2 : Moulinet farineux \[1\] \(5 souffle\) contre Aubépine\. /],
    ["une contre-attaque qui s'offre, et qu'Aubépine laisse passer", /contre-attaque, l'attaque est annulée\. Aubépine ne contre-attaque pas\.$/],
    ["une défense avec relance d'avantage", "Aubépine lance sa défense, d8+1 contre 4, 1 avantage → 7 ✓, 3 ✗, relancé 5 ✓, 2 ✗ : 2 réussites"],
    ["une défense à trois réussites", /Aubépine lance sa défense, .* : 3 réussites, aucun dégât\.$/],
    ["une esquive pendant le tour adverse", "Aubépine intervient : Pas de côté (1 action, 3 souffle), 12 → 9."],
    ["une capacité sans dégâts jouée avec un jet d'attaque, et sa localisation", /^Aubépine : Fournaise \[1\] \(1 souffle, 1 lien\) contre Chef\. .* : 1 réussite, touché\. Localisation d20 → 6 : torse\.$/],
    // Le dé explosif n'y est plus (mission du lot 4.3, § 10 : le Goûter réussit sans exploser) ; la table des
    // événements (combat_evenements) et la ligne en cours (combat_segments) l'éprouvent sur des combats fabriqués.
    ["un jet de caractéristique", /^Aubépine : Goûter, d6 \(Savoir sauvage \+ Sens\) contre 6 \(compliqué\) → .* : 2 réussites\.$/],
    ["une Taloche", "Aubépine : Taloche [1] contre Marmiton n° 2. d8+1 (Force + Agilité) contre 5"],
    ["« Passer son tour »", /^Marmiton n° 2 passe son tour\.$/],
    ["la fin du combat", /^Combat terminé : victoire des PJ\.$/],
    // En plus de la liste : les deux gabarits hors mission que la référence emploie.
    ["la source « types d'armure mêlés »", "son désavantage (types d'armure mêlés)"],
    ["le bilan écrit avant la face de contre-attaque", "Aubépine reçoit C = 19. Localisation d20 → 20 : contre-attaque, l'attaque est annulée."],
  ];
  for (const [point, fragment] of POINTS) {
    assert.ok(
      lignes.some((ligne) => (typeof fragment === "string" ? ligne.includes(fragment) : fragment.test(ligne))),
      `${point} : aucune ligne du journal ne le montre`,
    );
  }

  // L'action qui manque après l'esquive : au tour 3, Aubépine ne joue qu'un geste avant la fin de son tour ; au tour 2, elle en jouait deux.
  const FIN_DES_PJ = "Fin du tour des PJ : ils retrouvent leurs actions.";
  const tour3 = lignes.indexOf("— Tour 3 · camp des PJ —");
  assert.equal(lignes[tour3 + 2], FIN_DES_PJ);
  const tour2 = lignes.indexOf("— Tour 2 · camp des PJ —");
  assert.equal(lignes[tour2 + 3], FIN_DES_PJ);
  assert.notEqual(lignes[tour2 + 2], FIN_DES_PJ);

  // La fin automatique des tours, sept fois, et « Fin de tour » par le bouton, une fois : la même ligne.
  const fins = lignes.filter((ligne) => /^Fin du tour des (PJ|adversaires) : ils retrouvent leurs actions\.$/.test(ligne)).length;
  const demandees = JOUE.contenu.evenements.filter((evenement) => evenement.type === "fin_de_tour").length;
  assert.deepEqual([fins, demandees], [8, 1]);
});

// ─── Les segments, la ligne en cours, l'annulation (groupe 2) ──────────────

test("les trente-six lignes, inchangées, sont chacune la concaténation de leurs segments, numérotés par leurs phrases", () => {
  const journal = JOUE.etat.journal;
  assert.equal(journal.length, 36);
  journal.forEach((ligne, rang) => {
    const ou = `ligne ${rang + 1}`;
    assert.equal(ligne.texte, journalAttendu[rang], `${ou} : inchangée`);
    assert.equal(texteDes(ligne.segments), ligne.texte, `${ou} : la concaténation de ses segments`);
    assert.ok(ligne.phrases.length >= 1, ou);
    for (const segment of ligne.segments) {
      assert.notEqual(segment.texte, "", `${ou} : un segment vide`);
      assert.ok(segment.phrase === null || (Number.isInteger(segment.phrase) && segment.phrase >= 0 && segment.phrase < ligne.phrases.length), `${ou} : le segment « ${segment.texte} » n'est d'aucune phrase de la ligne`);
    }
    // Chaque phrase a ses segments, dans l'ordre ; ce qui les joint n'est d'aucune.
    const numeros = ligne.segments.map((segment) => segment.phrase).filter((phrase) => phrase !== null);
    assert.deepEqual([...new Set(numeros)], ligne.phrases.map((_, numero) => numero), `${ou} : les phrases, dans l'ordre`);
    assert.ok(ligne.segments.filter((segment) => segment.phrase === null).every((segment) => segment.texte === " "), `${ou} : entre deux phrases, une espace`);
  });
  // La ligne « Annulé » est la seule neuve du groupe : le combat de référence n'en a pas.
  assert.equal(journal.some((ligne) => ligne.genre === "annule" || ligne.texte.startsWith("Annulé")), false);
});

test("les phrases de chaque ligne de geste sont celles de segmentsDuGeste et de phrasesDuGeste, une à une", () => {
  const gestes = FINS_DE_GESTE.filter(({ maillon }) => maillon.quoi.genre === "capacite");
  assert.equal(gestes.length, 16, "seize capacités jouées");
  for (const { n, maillon } of gestes) {
    const { geste } = maillon.quoi;
    const ligne = TENUS[n].journal[maillon.plage[0]];
    const ou = `la ligne ${maillon.plage[0] + 1} (${ligne.texte.slice(0, 40)}…)`;
    assert.equal(ligne.genre, "geste", ou);
    const parPhrase = ligne.phrases.map((_, numero) => texteDes(ligne.segments.filter((segment) => segment.phrase === numero)));
    assert.deepEqual(parPhrase, segmentsDuGeste(JOUE.etat, geste), ou);
    assert.deepEqual(ligne.phrases, phrasesDuGeste(JOUE.etat, geste).map((phrase) => phrase.genre), ou);
    assert.equal(segmentsDuGeste(JOUE.etat, geste).join(" "), ligne.texte, ou);
  }
});

// Ce que la ligne en cours dit à un moment : le moment du geste, et ce qu'il attend.
function casDeLaLigneEnCours(geste) {
  if (geste.moment === "jet") return `jet, ${geste.jet.attente}`;
  if (geste.moment === "suites") return (geste.interventions ?? []).length > 0 ? "suites, esquive jouée" : "suites, sans esquive";
  return geste.moment;
}

test("la ligne en cours : à chaque événement du combat, le début exact de la ligne que le geste écrira, suivi de « … » sans espace ; nulle hors d'un geste payé", () => {
  const SUITE = { type: "suite", texte: signe(0x2026), phrase: null };
  const vus = new Map();
  let enCours = 0;
  let nulles = 0;
  TENUS.forEach((etat, n) => {
    const ou = `après ${n} événement(s)`;
    const geste = etat.pile.at(-1) ?? null;
    const ligne = ligneEnCours(etat);
    if (geste === null || geste.paye !== true) {
      assert.equal(ligne, null, `${ou} : ${geste === null ? "sans geste" : "avant le paiement"}`);
      nulles += 1;
      return;
    }
    // La ligne que ce geste écrira : celle du premier maillon posé après cet état.
    const fin = FINS_DE_GESTE.find((une) => une.n > n);
    assert.equal(fin.maillon.quoi.geste.acteur, geste.acteur, ou);
    const finale = TENUS[fin.n].journal[fin.maillon.plage[0]];
    assert.notEqual(ligne, null, `${ou} : un geste payé, avec un jet`);
    enCours += 1;
    const cas = casDeLaLigneEnCours(geste);
    vus.set(cas, (vus.get(cas) ?? 0) + 1);

    assert.equal(ligne.genre, "geste", ou);
    assert.equal(ligne.enCours, true, ou);
    assert.deepEqual(ligne.segments.at(-1), SUITE, `${ou} : « … » ferme la ligne, hors de toute phrase`);
    assert.equal(texteDes(ligne.segments), ligne.texte, `${ou} : la concaténation de ses segments`);
    const debut = ligne.texte.slice(0, -1);
    assert.ok(finale.texte.startsWith(debut), `${ou} (${cas}) : « ${debut} » ne débute pas « ${finale.texte} »`);
    assert.ok(debut.length < finale.texte.length, `${ou} : la ligne en cours n'est pas la ligne entière`);
    // Les segments sont ceux de la ligne finale ; le dernier peut n'en être qu'un début.
    const ecrits = ligne.segments.slice(0, -1);
    ecrits.slice(0, -1).forEach((segment, rang) => assert.deepEqual(segment, finale.segments[rang], `${ou} : le segment n° ${rang + 1}`));
    const { texte, ...champs } = ecrits.at(-1);
    const { texte: entier, ...attendus } = finale.segments[ecrits.length - 1];
    assert.deepEqual(champs, attendus, `${ou} : le dernier segment écrit, de la même sorte`);
    assert.ok(entier.startsWith(texte), `${ou} : le dernier segment écrit débute le sien`);
    assert.deepEqual(ligne.phrases, finale.phrases.slice(0, ligne.phrases.length), `${ou} : les phrases, dans l'ordre`);
  });

  // Plus de quarante états, et chaque cas du contrat (§ 3.4) que ce combat traverse : la chaîne, un dé qui attend
  // une relance, le bilan, les suites avant et après l'esquive ; et, depuis le lot 4.3, la contre-attaque qui
  // s'offre (geste 16) et la blessure à choisir (geste 22). Un manqué, une défense sans dégât et un jet de
  // caractéristique attendent « Appliquer » aux suites (contrat du lot 4.3, § 12, choix 1). Le moment
  // « localisation » (plusieurs d20 à lancer) n'arrive pas dans ce combat, dont chaque coup n'en lance qu'un : il
  // partage sa règle avec « suites, sans esquive ». L'explosion n'y arrive plus (mission du lot 4.3, § 10). Les
  // contrôles du journal éprouvent l'un et l'autre à la main (tests/combat_segments.test.js).
  assert.ok(enCours > 40, `${enCours} états avec une ligne en cours`);
  assert.ok(nulles > 20, `${nulles} états sans ligne en cours`);
  assert.deepEqual([...vus.keys()].sort(), ["bilan", "blessure", "contre_attaque", "jet, choix_relance", "jet, de", "jet, de_relance", "suites, esquive jouée", "suites, sans esquive"], JSON.stringify(Object.fromEntries(vus)));
});

// Ce qui ne recule pas à l'annulation : le journal, le pas, l'annonce, et la pile elle-même.
const sansCeQuiAvance = ({ journal, pas, annonce, annulation, ...reste }) => reste;
// L'id d'un effet durable est le pas qui l'a posé (contrat du lot 4.3, § 3) : rejoué après « annuler », le
// geste le pose à un autre pas. L'état rejoué se compare donc sans ces ids ; tout le reste est le même.
const sansLesIds = (etat) => ({ ...sansCeQuiAvance(etat), effets: etat.effets.map(({ id, ...effet }) => effet) });

test("à la fin de chaque geste, « annuler » rend l'état d'avant lui, écrit une ligne « Annulé » qui couvre ses lignes, et le geste se rejoue à l'identique", () => {
  assert.equal(FINS_DE_GESTE.length, scenario.gestes.length, "un maillon par geste du scénario");
  const genres = new Map();
  for (const { n, maillon } of FINS_DE_GESTE) {
    const ou = `le geste fini à l'événement n° ${n} (${maillon.quoi.genre})`;
    genres.set(maillon.quoi.genre, (genres.get(maillon.quoi.genre) ?? 0) + 1);
    // L'état d'avant le geste : celui qui précède son ouverture.
    let debut = n - 1;
    if (maillon.quoi.genre === "capacite") while (TENUS[debut].pile.length > 0) debut -= 1;
    const avant = TENUS[debut];
    assert.equal(avant.pile.length, 0, ou);

    const { etat: annule, refus } = appliquer(TENUS[n], { type: "annuler" });
    assert.equal(refus, undefined, `${ou} : ${refus?.message}`);
    assert.equal(premierEcart(sansCeQuiAvance(annule), sansCeQuiAvance(avant)), null, `${ou} : l'état d'avant le geste`);
    // La pile : le maillon d'avant, l'objet même.
    assert.equal(annule.annulation.pile, maillon.precedent, ou);
    assert.equal(annule.annulation.pile, avant.annulation.pile, ou);
    assert.equal(annule.annulation.attente, null, ou);
    // Le journal ne recule pas : les mêmes lignes, puis « Annulé », qui couvre la plage du geste.
    assert.equal(annule.pas, TENUS[n].pas + 1, ou);
    assert.equal(annule.journal.length, TENUS[n].journal.length + 1, ou);
    TENUS[n].journal.forEach((ligne, rang) => assert.equal(annule.journal[rang], ligne, `${ou} : la ligne ${rang + 1} n'est pas réécrite`));
    const derniere = annule.journal.at(-1);
    assert.equal(derniere.genre, "annule", ou);
    assert.equal(derniere.texte, `Annulé : ${nommerLeGeste(TENUS[n], maillon.quoi)}.`, ou);
    assert.deepEqual(derniere.barre, [...maillon.plage], ou);
    assert.equal(maillon.plage[1], TENUS[n].journal.length, `${ou} : la plage va jusqu'à la dernière ligne du geste`);
    assert.ok(maillon.plage[0] >= avant.journal.length && maillon.plage[0] < maillon.plage[1], `${ou} : la plage couvre les lignes du geste, et elles seules`);

    // Rejoué sur l'état annulé, le geste refait le même état, et réécrit les mêmes lignes à la suite.
    let rejoue = annule;
    for (const evenement of JOUE.contenu.evenements.slice(debut, n)) {
      const rendu = appliquer(rejoue, evenement);
      assert.equal(rendu.refus, undefined, `${ou}, rejoué : ${rendu.refus?.message}`);
      rejoue = rendu.etat;
    }
    assert.equal(premierEcart(sansLesIds(rejoue), sansLesIds(TENUS[n])), null, `${ou}, rejoué`);
    // Les ids : ceux d'avant le geste restent ; ceux qu'il pose suivent son pas neuf, décalé d'autant que
    // l'annulation et le geste l'ont fait avancer.
    const decalage = annule.pas - debut;
    assert.deepEqual(rejoue.effets.map((effet) => effet.id), TENUS[n].effets.map((effet) => (effet.id > debut ? effet.id + decalage : effet.id)), `${ou}, rejoué : les ids des effets`);
    assert.deepEqual(
      rejoue.journal.slice(annule.journal.length).map((ligne) => ligne.texte),
      TENUS[n].journal.slice(...maillon.plage).map((ligne) => ligne.texte),
      `${ou}, rejoué : les mêmes lignes`,
    );
    assert.equal(rejoue.annulation.pile.quoi.genre, maillon.quoi.genre, ou);
  }
  assert.deepEqual(Object.fromEntries(genres), { capacite: 16, passer: 1, fin_de_tour: 1 });

  // Et jusqu'au lancement, geste après geste, puis plus rien à annuler.
  let etat = JOUE.etat;
  for (let fois = 0; fois < scenario.gestes.length; fois += 1) etat = appliquer(etat, { type: "annuler" }).etat;
  assert.equal(premierEcart(sansCeQuiAvance(etat), sansCeQuiAvance(TENUS[1])), null, "défait jusqu'au lancement");
  assert.equal(etat.annulation.pile, null);
  assert.deepEqual(appliquer(etat, { type: "annuler" }).refus, { code: "interdit", message: "Rien à annuler depuis le lancement." });
});

test("le combat de référence écrit en version 1, 2 ou 3 des règles (d'avant le lot 4.3) se dit d'une autre version, et ne se rejoue pas ; en version courante, il se relit et se rejoue", () => {
  assert.equal(REGLES, 4);
  const texte = JSON.stringify(JOUE.contenu);
  for (const regles of [1, 2, 3]) {
    const enVersionAncienne = { ...JSON.parse(texte), regles };
    assert.deepEqual(validerContenu(enVersionAncienne, { mode: "demo", revision: JOUE.contenu.revision, accepter }), { autreVersion: { regles } });
    assert.equal(rejouer(enVersionAncienne).erreur.pas, 0);
    assert.equal(rejouer(enVersionAncienne).etat, undefined);
  }
  // Désarmé : la version courante.
  const lu = validerContenu(JSON.parse(texte), { mode: "demo", revision: JOUE.contenu.revision, accepter });
  assert.equal(lu.erreur, undefined, lu.erreur);
  assert.equal(lu.autreVersion, undefined);
  assert.deepEqual(rejouer(lu.contenu).etat.journal.map((ligne) => ligne.texte), journalAttendu);
});

// ─── Les comparaisons, dans les deux sens ───────────────────────────────────

test("la comparaison du journal cite la ligne qui s'écarte, et l'endroit ; elle se tait sur deux journaux égaux", () => {
  assert.deepEqual(ecartsDuJournal(journalAttendu, journalAttendu), []);
  assert.deepEqual(ecartsDuJournal([], []), []);

  // Un seul dé change au premier geste, sans rien changer à son issue : seule la ligne 3 s'écarte.
  const autre = structuredClone(scenario);
  autre.gestes[0].des = [6, 9, 8, 3];
  const lignes = lignesDe(versContenu(autre, PHOTOS).etat);
  const ecarts = ecartsDuJournal(lignes, journalAttendu);
  assert.equal(ecarts.length, 1);
  assert.match(ecarts[0], /^ligne 3, au signe \d+ \(obtenu « 4 », U\+0034 ; attendu « 3 », U\+0033\) :\n/);
  assert.ok(ecarts[0].includes(`obtenu  : ${lignes[2]}`) && ecarts[0].includes(`attendu : ${journalAttendu[2]}`), "l'écart porte les deux lignes entières");
  assert.match(lignes[2], /9\/4 → 4 ✗/);

  // Une ligne qui manque, une ligne en trop.
  assert.deepEqual(ecartsDuJournal(journalAttendu.slice(0, 35), journalAttendu), [`ligne 36, absente du journal :\n    attendu : ${journalAttendu[35]}`]);
  assert.deepEqual(ecartsDuJournal([...journalAttendu, "Une ligne de plus."], journalAttendu), ["ligne 37, en trop dans le journal :\n    obtenu  : Une ligne de plus."]);

  // Deux signes qui se ressemblent : un trait d'union à la place du signe moins, une espace insécable à la place d'une espace.
  // Le journal de référence n'a plus de signe moins (lot 4.3) : la ligne qui en porte un est forgée.
  const avecMoins = journalAttendu[2].replace("d10+1", `d10${signe(0x2212)}1`);
  assert.notEqual(avecMoins, journalAttendu[2]);
  assert.match(ecartsDuJournal([avecMoins.replace(signe(0x2212), "-")], [avecMoins])[0], /obtenu « - », U\+002D ; attendu « . », U\+2212/u);
  assert.match(ecartsDuJournal([journalAttendu[0].replace(" ", signe(0x00a0))], [journalAttendu[0]])[0], /^ligne 1, au signe 7 \(obtenu « . », U\+00A0 ; attendu « {3}», U\+0020\)/u);
  // Une ligne coupée court.
  assert.match(ecartsDuJournal(["Combat"], ["Combat lancé"])[0], /^ligne 1, au signe 7 \(obtenu la fin de la ligne ; attendu « {3}», U\+0020\)/);
});

test("la comparaison de l'état nomme le protagoniste et ce qui s'écarte, champ par champ ; elle se tait sur l'état attendu", () => {
  const etat = JOUE.etat;
  assert.deepEqual(ecartsDeLEtat(etat, etatAttendu), []);

  // Chaque retouche de l'état attendu fait exactement un écart, celui-là.
  const retouches = [
    [(attendus) => (attendus[0].case = "D5"), "Aubépine : case D4, attendu D5."],
    [(attendus) => (attendus[0].actions = 1), "Aubépine : actions 0, attendu 1."],
    [(attendus) => (attendus[0].actionsMax = 3), "Aubépine : actions au plus 2, attendu 3."],
    [(attendus) => (attendus[0].souffle = 3), "Aubépine : souffle 2, attendu 3."],
    [(attendus) => (attendus[1].souffleMax = 8), "Chef : souffle au plus 7, attendu 8."],
    [(attendus) => (attendus[0].corps = 5), "Aubépine : corps 4, attendu 5."],
    [(attendus) => (attendus[3].corpsMax = 12), "Marmiton n° 2 : corps au plus 10, attendu 12."],
    [(attendus) => (attendus[1].defense = 6), "Chef : défense 7, attendu 6."],
    [(attendus) => (attendus[1].attaque = 6), "Chef : attaque 5, attendu 6."],
    // Les blessures (lot 4.3) : une liste, comparée dans l'ordre, nom, zone et durée.
    [(attendus) => (attendus[0].blessures = []), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu aucune."],
    [(attendus) => (attendus[0].blessures[0].nom = "Cheville tordue"), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu Cheville tordue (bras gauche, combat)."],
    [(attendus) => (attendus[0].blessures[0].zone = "bras_droit"), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu Main brûlée (bras droit, combat)."],
    [(attendus) => (attendus[0].blessures[0].zone = "queue"), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu Main brûlée (queue, combat)."],
    [(attendus) => (attendus[0].blessures[0].duree = "tour"), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu Main brûlée (bras gauche, tour)."],
    [(attendus) => attendus[0].blessures.push({ nom: "Côtes froissées", zone: "torse", duree: "combat" }), "Aubépine : blessures Main brûlée (bras gauche, combat), attendu Main brûlée (bras gauche, combat), Côtes froissées (torse, combat)."],
    // Un scénario d'avant le lot 4.3, qui comptait ses zones sans endurance.
    [(attendus) => (attendus[0].blessures = 2), "Aubépine : blessures attendues en nombre (2) ; depuis le lot 4.3, l'état attendu les dit en liste, chacune { nom, zone, duree }."],
    [(attendus) => (attendus[0].liens[0].points = 1), "Aubépine : lien Grand Four 0/1, attendu 1/1."],
    [(attendus) => (attendus[0].liens[0].max = 2), "Aubépine : lien Grand Four 0/1, attendu 0/2."],
    [(attendus) => (attendus[0].liens[0].nom = "Vieux Chaudron"), "Aubépine : jauge de lien n° 1 « Grand Four », attendu « Vieux Chaudron »."],
    [(attendus) => (attendus[1].liens = [{ nom: "Grand Four", points: 1, max: 1 }]), "Chef : jauges de lien 0, attendu 1.\nChef : jauge de lien n° 1 « aucune », attendu « Grand Four »."],
    [(attendus) => (attendus[0].mort = { tour: 5 }), "Aubépine : vivant, attendu mort au tour 5."],
    [(attendus) => (attendus[1].mort = null), "Chef : mort au tour 5, attendu vivant."],
    [(attendus) => (attendus[2].mort = { tour: 3 }), "Marmiton n° 1 : mort au tour 2, attendu mort au tour 3."],
    [(attendus) => (attendus[0].zones[0].armure = 1), "Aubépine, jambe gauche : armure 0/10, attendu 1/10."],
    [(attendus) => (attendus[0].zones[0].resistance = 5), "Aubépine, jambe gauche : endurance 0/5, attendu 5/5."],
    [(attendus) => (attendus[2].zones[0].armureMax = 16), "Marmiton n° 1, bras gauche : armure 11/15, attendu 11/16."],
    [(attendus) => (attendus[1].zones[1].armure = 37), "Chef, torse : armure 38/38, attendu 37/38."],
    // Une zone touchée que l'état attendu ne dit plus : elle devrait être intacte.
    [(attendus) => attendus[3].zones.pop(), "Marmiton n° 2, jambe droite : armure 0/0, endurance 0/5, attendue intacte."],
    [(attendus) => attendus[2].zones.push({ code: "queue", armure: 1, armureMax: 1, resistance: 5, resistanceMax: 5 }), "Marmiton n° 1 : aucune zone « queue » dans sa grille (torse, jambe_gauche, jambe_droite, bras_gauche, bras_droit, tete)."],
    [(attendus) => (attendus[1].protagoniste = "Sous-chef"), "Sous-chef : absent du combat (noms courts : Aubépine, Chef, Marmiton n° 1, Marmiton n° 2)."],
    [(attendus) => attendus.pop(), "Le combat compte 4 protagoniste(s), l'état attendu 3."],
    [
      (attendus) => attendus.reverse(),
      [
        "Marmiton n° 2 : au rang 4 de l'ordre d'ajout, attendu au rang 1.",
        "Marmiton n° 1 : au rang 3 de l'ordre d'ajout, attendu au rang 2.",
        "Chef : au rang 2 de l'ordre d'ajout, attendu au rang 3.",
        "Aubépine : au rang 1 de l'ordre d'ajout, attendu au rang 4.",
      ].join("\n"),
    ],
  ];
  for (const [retoucher, attendu] of retouches) {
    const attendus = structuredClone(etatAttendu);
    retoucher(attendus);
    assert.equal(ecartsDeLEtat(etat, attendus).join("\n"), attendu);
  }

  // Ce que l'état attendu ne dit pas ne se compare pas : les actions d'un mort, les blessures d'un adversaire, un lien nul,
  // le tour d'une mort, la mort elle-même, des zones absentes d'un protagoniste intact.
  assert.equal(etatAttendu[1].actions, null);
  const sansLiens = structuredClone(etatAttendu);
  sansLiens[0].liens = null;
  sansLiens[2].mort = { tour: null };
  delete sansLiens[3].mort;
  assert.deepEqual(ecartsDeLEtat(etat, sansLiens), []);
  assert.deepEqual(ecartsDeLEtat(etat, [{ protagoniste: "Aubépine" }, { protagoniste: "Chef" }, { protagoniste: "Marmiton n° 1" }, { protagoniste: "Marmiton n° 2" }]).length, 6, "sans zones dites, chaque zone touchée s'écarte d'« intacte »");
  // Dès qu'il les dit, elles se comparent.
  const dites = structuredClone(etatAttendu);
  dites[1].actions = 0;
  dites[2].blessures = [];
  dites[3].blessures = [{ nom: "Genou en vrac", zone: "jambe_droite", duree: "combat" }];
  assert.deepEqual(ecartsDeLEtat(etat, dites), ["Chef : actions 1, attendu 0.", "Marmiton n° 2 : blessures aucune, attendu Genou en vrac (jambe droite, combat)."]);
  // La zone d'une blessure se retrouve aussi par son nom.
  const blessureParNom = structuredClone(etatAttendu);
  blessureParNom[0].blessures[0].zone = "Bras gauche";
  assert.deepEqual(ecartsDeLEtat(etat, blessureParNom), []);
  // Un effet durable qui n'est pas une blessure (une garde, un état posé par le MJ) ne se compte pas parmi elles.
  const garde = { id: etat.pas + 1, genre: "guet", porteur: PJ, auteur: PJ, camp: "pj", duree: "tour", source: { genre: "capacite", qui: PJ, capacite: 0 }, garde: { capacite: 0, facon: 0 } };
  const etatLibre = { id: etat.pas + 2, genre: "etat", porteur: PJ, auteur: null, camp: "pj", duree: "combat", source: { genre: "mj" }, capacite: null, libre: "En nage", blessure: false };
  assert.deepEqual(ecartsDeLEtat({ ...etat, effets: [garde, ...etat.effets, etatLibre] }, etatAttendu), []);

  // Une zone que la banque ne reconnaît pas se retrouve par son nom.
  const parNom = structuredClone(etatAttendu);
  parNom[3].zones = [{ nom: "Jambe droite", armure: 0, armureMax: 0, resistance: 0, resistanceMax: 5 }];
  assert.deepEqual(ecartsDeLEtat(etat, parNom), []);
  parNom[3].zones[0].resistance = 1;
  assert.deepEqual(ecartsDeLEtat(etat, parNom), ["Marmiton n° 2, jambe droite : endurance 0/5, attendu 1/5."]);

  // Un état d'avant la fin n'est pas l'état final.
  assert.ok(ecartsDeLEtat(arrete(17), etatAttendu).length > 0);
});

test("la comparaison d'un combat arrêté en cours de route : le moment de la maquette y est tout entier, et chaque écart se dit", () => {
  const etat = arrete({ geste: 7, des: 2 });
  // Le moment de la maquette, tel que le calcul à la main le décrit.
  const maquette = {
    lignes: 12,
    cible: "Marmiton n° 2",
    chaine: [
      { somme: 8, reussi: true },
      { somme: 4, reussi: false },
    ],
    de: { faces: 8, combien: 1, motif: "relance", place: 2 },
    etatAttendu: [
      { protagoniste: "Aubépine", case: "D4", actions: 0, actionsMax: 2, souffle: 6, souffleMax: 10, liens: [{ nom: "Grand Four", points: 1, max: 1 }], corps: 10, corpsMax: 10, mort: null, blessures: [], zones: [{ code: "jambe_gauche", armure: 0, armureMax: 10, resistance: 5, resistanceMax: 5 }] },
      { protagoniste: "Chef", case: "D4", actions: 1, actionsMax: 1, souffle: 6, souffleMax: 7, liens: [], corps: 10, corpsMax: 10, mort: null, blessures: null, zones: [] },
      { protagoniste: "Marmiton n° 1", case: "D4", actions: null, actionsMax: null, souffle: 5, souffleMax: 5, liens: [], corps: 0, corpsMax: 10, mort: { tour: 2 }, blessures: null, zones: etatAttendu[2].zones },
      { protagoniste: "Marmiton n° 2", case: "D4", actions: null, actionsMax: null, souffle: 5, souffleMax: 5, liens: [], corps: 10, corpsMax: 10, mort: null, blessures: null, zones: [] },
    ],
  };
  assert.deepEqual(ecartsDeLArret(etat, maquette, journalAttendu), []);
  assert.deepEqual(ecartsDeLArret(etat, {}, journalAttendu), [], "rien d'attendu, rien à dire");

  // Chaque champ, faussé seul, fait son écart.
  const fausses = [
    [{ lignes: 11 }, `ligne 12, en trop dans le journal :\n    obtenu  : ${journalAttendu[11]}`],
    [{ lignes: 13 }, `ligne 13, absente du journal :\n    attendu : ${journalAttendu[12]}`],
    [{ cible: "Chef" }, "La cible du geste en cours : Marmiton n° 2, attendu Chef."],
    [{ cible: null }, "La cible du geste en cours : Marmiton n° 2, attendu aucune."],
    [{ chaine: [maquette.chaine[0], { somme: 5, reussi: false }] }, "Les dés du jet en cours : 8 ✓, 4 ✗, attendu 8 ✓, 5 ✗."],
    [{ chaine: [maquette.chaine[0], { somme: 4, reussi: true }] }, "Les dés du jet en cours : 8 ✓, 4 ✗, attendu 8 ✓, 4 ✓."],
    [{ chaine: [maquette.chaine[0]] }, "Les dés du jet en cours : 8 ✓, 4 ✗, attendu 8 ✓."],
    [{ de: { ...maquette.de, place: 3 } }, "Le dé à lancer : d8, relance, place 2, attendu d8, relance, place 3."],
    [{ de: { ...maquette.de, motif: "chaine" } }, "Le dé à lancer : d8, relance, place 2, attendu d8, chaine, place 2."],
    [{ de: { ...maquette.de, faces: 10 } }, "Le dé à lancer : d8, relance, place 2, attendu d10, relance, place 2."],
    [{ de: null }, "Le dé à lancer : d8, relance, place 2, attendu aucun."],
    [{ etatAttendu: maquette.etatAttendu.map((attendu, rang) => (rang === 0 ? { ...attendu, souffle: 7 } : attendu)) }, "Aubépine : souffle 6, attendu 7."],
  ];
  for (const [champs, attendu] of fausses) assert.equal(ecartsDeLArret(etat, { ...maquette, ...champs }, journalAttendu).join("\n"), attendu);

  // Hors d'un geste : ni cible, ni dé lancé, ni dé attendu.
  const entreDeuxGestes = arrete(6);
  assert.deepEqual(ecartsDeLArret(entreDeuxGestes, { cible: null, chaine: [], de: null, lignes: 12 }, journalAttendu), []);
  assert.deepEqual(ecartsDeLArret(entreDeuxGestes, { cible: "Chef", chaine: maquette.chaine, de: maquette.de }, journalAttendu), [
    "La cible du geste en cours : aucune, attendu Chef.",
    "Les dés du jet en cours : aucun dé, attendu 8 ✓, 4 ✗.",
    "Le dé à lancer : aucun, attendu d8, relance, place 2.",
  ]);

  // Un dé à désavantage se lance deux fois : le dé attendu le dit.
  const avantLePremierDe = arrete({ geste: 1, des: 0 });
  assert.deepEqual(ecartsDeLArret(avantLePremierDe, { cible: "Marmiton n° 1", chaine: [], de: { faces: 10, combien: 2, motif: "chaine", place: 1 }, lignes: 2 }, journalAttendu), []);
  assert.deepEqual(ecartsDeLArret(avantLePremierDe, { de: { faces: 10, combien: 1, motif: "chaine", place: 1 } }, journalAttendu), ["Le dé à lancer : d10, 2 valeurs, chaine, place 1, attendu d10, chaine, place 1."]);
});

// Les comparaisons du banc ajoutées au groupe 2 : sur la démonstration, elles
// se taisent ; chacune dit l'écart qu'on lui forge.
test("les comparaisons neuves du banc : les segments, la ligne en cours, l'offre allégée, les puissances et les bornes ; elles se taisent sur la démonstration, et disent l'écart qu'on leur forge", () => {
  // Les segments.
  assert.deepEqual(ecartsDesSegments(JOUE.etat.journal), []);
  const troisieme = JOUE.etat.journal[2];
  const amputee = { ...troisieme, segments: troisieme.segments.slice(1) };
  assert.match(ecartsDesSegments([JOUE.etat.journal[0], amputee])[0], /^ligne 2, ses segments ne redonnent pas son texte :\n {4}texte {4}: /);
  assert.deepEqual(ecartsDesSegments([{ genre: "cadre", texte: "x", segments: [{ type: "texte", texte: "x", phrase: 0 }, { type: "texte", texte: "", phrase: 0 }] }]), ["ligne 1 : un segment vide."]);

  // La ligne en cours.
  const { ecarts, enCours } = ecartsDeLaLigneEnCours(TENUS);
  assert.deepEqual(ecarts, []);
  assert.ok(enCours > 40, `${enCours} états`);
  const retouchee = (retoucher) => (etat) => {
    const ligne = ligneEnCours(etat);
    return ligne === null ? null : retoucher(ligne);
  };
  const espacee = ecartsDeLaLigneEnCours(TENUS, { lire: retouchee((ligne) => ({ ...ligne, texte: `${ligne.texte.slice(0, -1)} ${signe(0x2026)}`, segments: [...ligne.segments.slice(0, -1), { type: "suite", texte: ` ${signe(0x2026)}`, phrase: null }] })) });
  assert.equal(espacee.ecarts.length, enCours);
  assert.match(espacee.ecarts[0], /ne finit pas par « … », hors phrase/);
  const decalee = ecartsDeLaLigneEnCours(TENUS, { lire: retouchee((ligne) => ({ ...ligne, texte: `X${ligne.texte}` })) });
  assert.equal(decalee.ecarts.length, enCours);
  assert.match(decalee.ecarts[0], /ne débute pas la ligne du geste :\n {4}en cours : X/);

  // L'offre allégée.
  for (const n of [0, 1, 20, 52, TENUS.length - 1]) {
    const { ecarts: ici, verdicts } = ecartsDeLOffreAllegee(TENUS[n]);
    assert.deepEqual(ici, [], `après ${n} événement(s)`);
    assert.ok(verdicts > 50);
  }
  const toujoursOui = ecartsDeLOffreAllegee(TENUS[1], { juger: () => ({ ok: true }), quoi: "le tour 1" });
  assert.ok(toujoursOui.ecarts.length > 0 && toujoursOui.ecarts.length < toujoursOui.verdicts, "un juge qui dit toujours oui s'écarte, sauf là où l'ancien disait oui");
  assert.match(toujoursOui.ecarts[0], /^le tour 1, \{"type":"capacite",/);

  // Les puissances : chaque adversaire complet de la démonstration, à son rang comme resoudre.
  let comparees = 0;
  for (const [nom, ligne] of ADVERSAIRES.adversaires) {
    if (!ADVERSAIRES.resoudre(ligne).complet) continue;
    const vu = ecartsDeCapacitesA(ADVERSAIRES, ligne, nom);
    assert.deepEqual(vu.ecarts, [], nom);
    comparees += vu.comparees;
  }
  assert.ok(comparees > 10, `${comparees} capacités comparées`);
  const chef = ADVERSAIRES.adversaires.get("Chef de partie");
  const sansPuissance = { ...ADVERSAIRES, capacitesA: (ligne, puissance) => ADVERSAIRES.capacitesA(ligne, puissance).map(() => null) };
  assert.ok(ecartsDeCapacitesA(sansPuissance, chef, "Chef de partie").ecarts.every((ecart) => /^Chef de partie, .+ : à son rang \(\d+\), capacitesA ne rend pas la capacité de resoudre\.$/.test(ecart)));
  assert.ok(ecartsDeCapacitesA(sansPuissance, chef, "Chef de partie").ecarts.length > 0);
  const auDela = { ...ADVERSAIRES, capacitesA: (ligne, puissance) => ADVERSAIRES.capacitesA(ligne, Math.min(puissance, 1)) };
  assert.ok(ecartsDeCapacitesA(auDela, chef, "Chef de partie").ecarts.some((ecart) => /résolue au-delà de son rang/.test(ecart)));

  // Les bornes des façons : le Chef joue Pas chassé à deux puissances.
  const bornes = bornesDesFacons(PHOTOS["Chef de partie"]);
  const chefValeurs = PHOTOS["Chef de partie"].valeurs;
  assert.equal(bornes.enTout, chefValeurs.capacites.reduce((total, capacite) => total + capacite.facons.length, 0));
  assert.equal(bornes.parCapacite, Math.max(...chefValeurs.capacites.map((capacite) => capacite.facons.length)));
  assert.equal(chefValeurs.capacites.find((capacite) => capacite.nom === bornes.capacite).facons.length, bornes.parCapacite);
  assert.equal(bornes.deplacements, chefValeurs.capacites.filter((capacite) => capacite.role === "deplacement").reduce((total, capacite) => total + capacite.facons.length, 0));
  assert.ok(bornes.deplacements >= 2, "Pas chassé [1] et [2]");
});
