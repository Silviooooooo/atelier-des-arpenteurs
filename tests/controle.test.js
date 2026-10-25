// Contrôles du contrôle de cohérence (SPECIFICATION.md, § 6.3 et § 11,
// domaine « Contrôle ») : le classeur d'essai déclenche chaque code, E1, A8,
// A9, A10 et ceux de la feuille Adversaires sur ses variantes, et un classeur
// propre n'en déclenche aucun. Les codes de la feuille Adversaires se
// vérifient un à un dans tests/adversaires.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GRAVITES } from "../js/banque/controle.js";
import { importerFichier } from "../js/banque/importation.js";
import { cle, nomCompare, repertoire, sansSignesInvisibles } from "../js/banque/noms.js";
import { FAUTES } from "./outils/adversaires_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";
import { CLASSEUR_ESSAI, CLASSEUR_PROPRE } from "./outils/classeur_essai.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));

// Les anomalies qu'annoncent les colonnes de notes du classeur d'essai, dans
// l'ordre du rapport (§ 6.4).
const ANNONCEES = [
  ["E4", "Blocs", 7], ["E4", "Blocs", 7], ["E5", "Blocs", 8], ["E6", "Blocs", 9], ["E6", "Blocs", 9],
  ["E6", "Blocs", 10], ["E7", "Blocs", 11], ["E3", "Blocs", 16], ["E2", "Blocs", 17],
  ["E3", "Eléments", 10], ["E2", "Eléments", 11],
  ["E3", "Capacites", 8], ["E5", "Capacites", 15], ["E6", "Capacites", 18], ["E2", "Capacites", 20],
  ["A1", "Blocs", 6], ["A1", "Blocs", 6], ["A2", "Blocs", 12], ["A7", "Blocs", 14],
  ["A4", "Eléments", 9],
  ["A5", "Capacites", 16], ["A3", "Capacites", 19],
  ["A11", "Adversaires", 2], ["A1", "Adversaires", 3], ["A15", "Adversaires", 8],
  ["I3", "Blocs", 13], ["I3", "Blocs", 14], ["I1", "Blocs", 15],
  ["I3", "Blocs", 25], ["I3", "Blocs", 27], ["I3", "Blocs", 31], ["I3", "Blocs", 32], ["I3", "Blocs", 33], ["I3", "Blocs", 34], ["I3", "Blocs", 35],
  ["I3", "Blocs", 39],
  ["I1", "Eléments", 7], ["I2", "Eléments", 8], ["I1", "Capacites", 13], ["I2", "Capacites", 17],
];

// Le tableau du § 6.3, lu dans la spécification elle-même : la table du code
// s'y confronte, et un code retiré du tableau ne peut survivre dans le code.
function gravitesDeLaSpecification() {
  const texte = readFileSync(new URL("../SPECIFICATION.md", import.meta.url), "utf8");
  const section = texte.slice(texte.indexOf("### 6.3"), texte.indexOf("### 6.4"));
  return Object.fromEntries([...section.matchAll(/^\| ([EAI]\d+) \| (\S+) \|/gm)].map(([, code, gravite]) => [code, gravite]));
}

async function importer(description) {
  const resultat = await importerFichier(description ? fabriquerClasseur(description) : ESSAI, "classeur.xlsx");
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  return resultat;
}

function variante(modifier) {
  const description = structuredClone(CLASSEUR_ESSAI);
  modifier(description.feuilles);
  return description;
}

test("contrôle — le classeur d'essai déclenche exactement les anomalies qu'il annonce", async () => {
  const { anomalies } = await importer();
  assert.deepEqual(anomalies.map((a) => [a.code, a.feuille, a.ligne]), ANNONCEES);
});

// Le classeur d'essai porte un type sur chaque bloc (§ 10.3) : A8 et A9 se
// déclenchent sur une variante, un bloc sans type et un bloc d'un type
// inconnu.
const TYPES_FAUTIFS = variante((feuilles) => {
  feuilles[1].lignes[1][5] = "  ";
  feuilles[1].lignes[2][5] = "Ustensile";
});

// A10 : une seconde pièce agile sur le torse, ajoutée en fin de feuille ; le
// pack agile n'est plus proposé. Le classeur d'essai lui-même garde ses trois
// packs, pour la démonstration.
const ARMURES_SUPERPOSEES = variante((feuilles) => {
  feuilles[1].lignes.push(["Brassière de cuir", "Armure, Agile", null, "{armure:10/0/0/15/0/0}, {qualite:X}", "A10 : torse et bras gauche déjà couverts par le pack agile", "Armure"]);
});

test("contrôle — les trente-six codes du § 6.3 : dix-sept sur le classeur d'essai, les autres sur ses variantes", async () => {
  const essai = await importer();
  // Quinze codes d'avant le lot 3, plus A11 et A15 sur la feuille Adversaires.
  assert.equal(new Set(essai.anomalies.map((a) => a.code)).size, 17);
  const sansFeuille = await importer(variante((feuilles) => feuilles.splice(2, 1)));
  const types = await importer(TYPES_FAUTIFS);
  const armures = await importer(ARMURES_SUPERPOSEES);
  // La feuille Adversaires : un cas par code (tests/outils/adversaires_essai.js).
  const adversaires = [];
  for (const faute of FAUTES) adversaires.push(...(await importer(faute.description)).anomalies);
  const codes = new Set([...essai.anomalies, ...sansFeuille.anomalies, ...types.anomalies, ...armures.anomalies, ...adversaires].map((a) => a.code));
  assert.deepEqual([...codes].sort(), Object.keys(GRAVITES).sort());
  assert.equal(Object.keys(GRAVITES).length, 36);
});

test("A8, A9 — un bloc sans type, un bloc d'un type inconnu ; les types se comparent sans casse, accents ni espaces", async () => {
  const { banque, anomalies } = await importer(TYPES_FAUTIFS);
  const nouvelles = anomalies.filter((a) => a.code === "A8" || a.code === "A9");
  assert.deepEqual(nouvelles, [
    { gravite: "avertissement", code: "A8", feuille: "Blocs", ligne: 2, message: "Le bloc « Louche d'acier » n'a pas de type : le créateur de personnage ne le voit pas." },
    {
      gravite: "avertissement",
      code: "A9",
      feuille: "Blocs",
      ligne: 3,
      message:
        "Le bloc « Carnet de recettes » a le type « Ustensile », inconnu (types reconnus : Base, Espèce, Archétype, Style de combat, Constellation, Primordial, Arme, Armure, Arme naturelle, Armure naturelle, Équipement, Consommable, Blessure, État) : le créateur de personnage ne le voit pas.",
    },
  ]);
  // Le type se garde tel qu'écrit, espaces de bord retirés.
  assert.equal(banque.blocs[0].type, "");
  assert.equal(banque.blocs.find((b) => b.nom === "Fumoir").type, "Consommable");
  // « Equipement », « équipement », « Archetype » : reconnus, sans anomalie.
  const essai = await importer();
  assert.equal(essai.anomalies.filter((a) => a.code === "A8" || a.code === "A9").length, 0);
});

test("A10 — deux pièces d'armure d'un même type sur une même zone : le pack de ce type n'est pas proposé", async () => {
  const { anomalies } = await importer(ARMURES_SUPERPOSEES);
  const a10 = anomalies.filter((a) => a.code === "A10");
  assert.deepEqual(a10, [
    {
      gravite: "avertissement",
      code: "A10",
      feuille: "Blocs",
      ligne: 40,
      message:
        "Des pièces d'armure de type agile couvrent une même zone (torse : « Tablier de cuir » et « Brassière de cuir » ; bras gauche : « Maniques » et « Brassière de cuir ») : le pack agile n'est pas proposé au créateur de personnage.",
    },
  ]);
  // Deux types différents sur le torse (Tablier de cuir, agile ; Plastron de
  // fonte, lourde) ne se gênent pas : le classeur d'essai n'a aucun A10.
  assert.equal((await importer()).anomalies.filter((a) => a.code === "A10").length, 0);
  // Une valeur écrite « 0 » ou « 0,0 » ne couvre pas la zone.
  const zero = variante((feuilles) => feuilles[1].lignes.push(["Brassière de cuir", "Armure, Agile", null, "{armure:0/0/0/0,0/0/0}, {qualite:X}", "", "Armure"]));
  assert.equal((await importer(zero)).anomalies.filter((a) => a.code === "A10").length, 0);
});

test("E1 — la colonne « Type » est un en-tête attendu", async () => {
  const { banque, anomalies } = await importer(variante((feuilles) => (feuilles[1].lignes[0][5] = "Genre")));
  assert.equal(banque, null);
  assert.deepEqual(anomalies.map((a) => a.message), ["L'en-tête « Type » est introuvable dans la feuille Blocs : l'import s'arrête."]);
});

test("E1 — une feuille absente arrête l'import", async () => {
  const { banque, anomalies } = await importer(variante((feuilles) => feuilles.splice(2, 1)));
  assert.equal(banque, null);
  assert.deepEqual(anomalies, [
    { gravite: "bloquante", code: "E1", feuille: "Eléments", ligne: null, message: "La feuille « Eléments » est introuvable : l'import s'arrête." },
  ]);
});

test("E1 — des en-têtes absents arrêtent l'import, et tous sont listés", async () => {
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[3].lignes[0][1] = "force";
      feuilles[1].lignes[0][4] = null;
    }),
  );
  assert.equal(banque, null);
  assert.deepEqual(anomalies.map((a) => [a.code, a.feuille, a.ligne, a.message]), [
    ["E1", "Blocs", 1, "L'en-tête « Infos » est introuvable dans la feuille Blocs : l'import s'arrête."],
    ["E1", "Capacites", 1, "L'en-tête « puissance » est introuvable dans la feuille Capacites : l'import s'arrête."],
  ]);
});

test("contrôle — un classeur propre ne déclenche aucune anomalie", async () => {
  const { banque, anomalies } = await importer(CLASSEUR_PROPRE);
  assert.deepEqual(anomalies, []);
  assert.equal(banque.blocs.length, 2);
  // Il a sa feuille Adversaires, sans défaut : sans elle, I4 le dirait.
  assert.deepEqual([banque.types_adversaires.length, banque.adversaires.length], [1, 1]);
});

test("contrôle — gravité de chaque code, tri par gravité puis feuille puis ligne", async () => {
  const gravites = gravitesDeLaSpecification();
  assert.equal(Object.keys(gravites).length, 36);
  assert.equal(gravites.A10, "avertissement");
  assert.deepEqual([gravites.E8, gravites.E16, gravites.A11, gravites.A16, gravites.I4, gravites.I5], ["erreur", "erreur", "avertissement", "avertissement", "information", "information"]);
  assert.deepEqual({ ...GRAVITES }, gravites);
  const { anomalies } = await importer();
  for (const a of anomalies) assert.equal(a.gravite, gravites[a.code], a.code);
  const rang = (a) => [["bloquante", "erreur", "avertissement", "information"].indexOf(a.gravite), ["lisez_moi", "Blocs", "Eléments", "Capacites", "Adversaires"].indexOf(a.feuille), a.ligne];
  for (let i = 1; i < anomalies.length; i += 1) {
    const [precedent, courant] = [rang(anomalies[i - 1]), rang(anomalies[i])];
    const ordre = precedent[0] - courant[0] || precedent[1] - courant[1] || precedent[2] - courant[2];
    assert.ok(ordre <= 0, `${anomalies[i - 1].code} avant ${anomalies[i].code}`);
  }
});

test("contrôle — messages : E4 au format du § 5.1, E7 et A1 disent ce qu'ils voient", async () => {
  const { anomalies } = await importer();
  const message = (code, ligne) => anomalies.filter((a) => a.code === code && a.ligne === ligne).map((a) => a.message);
  assert.equal(message("E4", 7)[0], "Le bloc « Poêle en fonte » cite la capacité « Omelette fantôme », introuvable dans Capacites.");
  assert.match(message("E7", 11)[0], /Le bloc « Hachoir » transmet 3 fois le paramètre distance \(\{distance:0\}, \{distance:1\}\(Jet de sel\), \{distance:2\}\(Jet de sel\)\)/);
  assert.deepEqual(message("A1", 6), [
    "Le bloc « Marmite hurlante » cite « coup de poele » pour la capacité « Coup de poêle » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent.",
    "Le bloc « Marmite hurlante » cite « brulant » pour l'élément « Brûlant » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent.",
  ]);
});

// E7 (lot 2 bis) : un paramètre ciblé à côté du même paramètre sans cible est
// admis (lisez_moi, la Hache légère) ; deux sans cible, ou deux fois la même
// cible, restent une erreur ; E4 vérifie toujours que la cible existe.
test("E7 — ciblé à côté de sans cible : admis ; deux sans cible, ou la même cible deux fois : erreur", async () => {
  const avecParametres = (parametres) => variante((feuilles) => (feuilles[1].lignes[10][3] = parametres));
  const e7 = async (parametres) => (await importer(avecParametres(parametres))).anomalies.filter((a) => a.code === "E7" || a.code === "E4").map((a) => [a.code, a.ligne]);
  assert.deepEqual(await e7("{distance:0}, {distance:1}(Jet de sel)"), [["E4", 7], ["E4", 7]]);
  assert.deepEqual(await e7("{distance:1}(Jet de sel), {distance:0}"), [["E4", 7], ["E4", 7]]);
  assert.deepEqual(await e7("{distance:0}, {distance:1}"), [["E4", 7], ["E4", 7], ["E7", 11]]);
  assert.deepEqual(await e7("{distance:1}(Jet de sel), {distance:2}(jet de SEL)"), [["E4", 7], ["E4", 7], ["E7", 11]]);
  assert.deepEqual(await e7("{distance:1}(Jet de sel), {distance:2}(Coup de louche)"), [["E4", 7], ["E4", 7]]);
  // La cible d'un paramètre ciblé doit exister (E4), même à côté du paramètre sans cible.
  assert.deepEqual(await e7("{distance:0}, {distance:1}(Jet de poivre)"), [["E4", 7], ["E4", 7], ["E4", 11]]);
});

test("noms — clé sans casse, accents, espaces ni signe invisible ; résolution exacte, approchée, ambiguë, absente", () => {
  assert.equal(cle(" Coup  de Poêle "), "coupdepoele");
  assert.equal(cle("Eléments transmis aux capacités"), cle("éléments TRANSMIS aux capacites"));
  const noms = repertoire(["Coup", "Choc", "choc"]);
  assert.deepEqual(noms.resoudre("Coup"), { nom: "Coup", facon: "exacte" });
  assert.deepEqual(noms.resoudre("coup "), { nom: "Coup", facon: "approchee" });
  assert.deepEqual(noms.resoudre("CHOC"), { nom: null, candidats: ["Choc", "choc"] });
  assert.deepEqual(noms.resoudre("Rien"), { nom: null, candidats: [] });
  // Un signe invisible ne fait pas un autre nom : le renvoi est retrouvé, de la façon approchée.
  assert.equal(cle("Mar\u200Bmiton"), "marmiton");
  assert.deepEqual(repertoire(["Marmiton"]).resoudre("Marmiton\u200B"), { nom: "Marmiton", facon: "approchee" });
  assert.deepEqual(repertoire(["Marmiton\u200B"]).resoudre("marmiton"), { nom: "Marmiton\u200B", facon: "approchee" });
  // Les deux noms définis : chacun se cite exactement, et tout autre renvoi est ambigu.
  const deux = repertoire(["Marmiton", "Marmiton\u200B"]);
  assert.deepEqual(deux.resoudre("Marmiton"), { nom: "Marmiton", facon: "exacte" });
  assert.deepEqual(deux.resoudre("Marmiton\u200B"), { nom: "Marmiton\u200B", facon: "exacte" });
  assert.deepEqual(deux.resoudre("marmiton"), { nom: null, candidats: ["Marmiton", "Marmiton\u200B"] });
});

// ─── Le signe invisible (lot 4, § 6.3 ; groupe 2, compl. § 5.4) ────────────
//
// Les vingt-deux signes de format que la comparaison des noms retire, dits
// par leur code : un fichier du dépôt n'écrit jamais le signe lui-même, que
// personne ne verrait. U+061C, la marque de lettre arabe, y est entré au
// groupe 2 du lot 4.
const SIGNES_INVISIBLES = [
  0x00ad, 0x061c, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
];
const codeDit = (code) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

test("noms — les vingt-deux signes invisibles de la liste, U+061C compris, chacun retiré ; aucun autre signe ne l'est", () => {
  assert.equal(SIGNES_INVISIBLES.length, 22);
  for (const code of SIGNES_INVISIBLES) {
    const signe = String.fromCodePoint(code);
    assert.equal(sansSignesInvisibles(`Mar${signe}miton`), "Marmiton", codeDit(code));
    assert.equal(cle(signe), "", codeDit(code));
    assert.equal(cle(`${signe}Mar${signe}miton${signe}`), "marmiton", codeDit(code));
    // L'espace que le signe cachait au bord ne fait pas un autre nom.
    assert.equal(nomCompare(`Marmiton ${signe}`), "Marmiton", codeDit(code));
    assert.deepEqual(repertoire(["Marmiton"]).resoudre(`Marmiton${signe}`), { nom: "Marmiton", facon: "approchee" }, codeDit(code));
  }
  // Aucun autre : de tout Unicode, ces vingt-deux points de code sont les seuls à disparaître.
  const retires = [];
  for (let code = 0; code <= 0x10ffff; code += 1) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    if (sansSignesInvisibles(String.fromCodePoint(code)) === "") retires.push(code);
  }
  assert.deepEqual(retires.map(codeDit), SIGNES_INVISIBLES.map(codeDit));
  // Les voisins de la liste restent, dans le texte comme dans la clé : les signes qui bordent chaque
  // plage ou chaque signe seul (U+061B et U+061D, de part et d'autre de U+061C), U+2065 (non
  // attribué, au milieu d'une plage) et U+180E (invisible, hors liste).
  for (const code of [0x00ac, 0x00ae, 0x061b, 0x061d, 0x180e, 0x2010, 0x2065, 0x206a, 0xfefe, 0xe0001]) {
    const voisin = String.fromCodePoint(code);
    assert.equal(sansSignesInvisibles(`Mar${voisin}miton`), `Mar${voisin}miton`, codeDit(code));
    assert.equal(cle(`Mar${voisin}miton`), `mar${voisin}miton`, codeDit(code));
    assert.deepEqual(repertoire(["Marmiton"]).resoudre(`Mar${voisin}miton`), { nom: null, candidats: [] }, codeDit(code));
  }
  // Les espaces voisins ne sont pas des signes invisibles : la fonction les garde, et la clé les retire, comme avant.
  for (const code of [0x00a0, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f]) {
    const espace = String.fromCodePoint(code);
    assert.equal(sansSignesInvisibles(`Mar${espace}miton`), `Mar${espace}miton`, codeDit(code));
    assert.equal(cle(`Mar${espace}miton`), "marmiton", codeDit(code));
  }
  // Rien d'autre ne change dans le texte : ni la casse, ni les accents, ni les espaces.
  assert.equal(sansSignesInvisibles(" Coup\u200B  de Poêle "), " Coup  de Poêle ");
  assert.equal(nomCompare(" Coup\u200B  de Poêle \u200B "), "Coup  de Poêle");
  assert.notEqual(nomCompare("Coup de Poêle"), nomCompare("coup de poele"), "exactement : la casse et les accents comptent");
  assert.deepEqual([sansSignesInvisibles(null), sansSignesInvisibles(undefined), nomCompare(null)], ["", "", ""]);
});

test("E3 — un signe invisible ne cache pas un doublon : un bloc, un élément (et l'espace que le signe cachait), une capacité, de même puissance ou non", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[1].lignes.push(["Marmiton\u200B", null, "Vif", null, "E3 : « Marmiton » suivi de U+200B", "Espèce"]);
      lignes.bloc = feuilles[1].lignes.length;
      feuilles[2].lignes.push(["Collant \u2060", null, "E3 : « Collant », une espace, puis U+2060."]);
      lignes.element = feuilles[2].lignes.length;
      feuilles[3].lignes.push(["Vif\u200B", "N", null, null, null, "Doublon de puissance.", "E3 : le même nom au signe près, la même puissance"]);
      lignes.vif = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Goûter\u00AD", 1, null, null, null, "Une autre puissance.", "E3 : le même nom au signe près, quelle que soit la puissance"]);
      lignes.gouter = feuilles[3].lignes.length;
    }),
  );
  const de = (feuille, ligne) => anomalies.filter((a) => a.feuille === feuille && a.ligne === ligne).map((a) => [a.code, a.message]);
  assert.deepEqual(de("Blocs", lignes.bloc), [["E3", "Le bloc « Marmiton\u200B » est déjà défini ligne 19."]]);
  // L'élément en double n'est porté par rien sous ce nom-là : A4 le dit aussi.
  assert.deepEqual(de("Eléments", lignes.element), [
    ["E3", "L'élément « Collant \u2060 » est déjà défini ligne 5."],
    ["A4", "L'élément « Collant \u2060 » n'est porté par rien : ni bloc, ni capacité, ni paramètre transmis."],
  ]);
  // L'import garde deux capacités, telles qu'écrites ; le contrôle les confronte par leurs noms
  // (compl. § 5.4) : deux noms écrits différents n'ont que le message neuf, à la ligne de la seconde.
  assert.deepEqual(banque.capacites.filter((c) => cle(c.nom) === "vif").map((c) => c.nom), ["Vif", "Vif\u200B"]);
  assert.deepEqual(de("Capacites", lignes.vif), [
    ["E3", "La capacité « Vif\u200B » ne diffère de celle de la ligne 24 que par un signe invisible."],
    ["A3", "La capacité « Vif\u200B » n'est rattachée à aucun bloc."],
  ]);
  // Une autre puissance ne change rien : la lecture d'avant (« puissances différentes : sans E3 ») s'inverse.
  assert.deepEqual(de("Capacites", lignes.gouter), [
    ["E3", "La capacité « Goûter\u00AD » ne diffère de celle de la ligne 22 que par un signe invisible."],
    ["A3", "La capacité « Goûter\u00AD » n'est rattachée à aucun bloc."],
  ]);
  // Rien d'autre ne bouge : les anomalies annoncées, et ces sept-là.
  assert.equal(anomalies.length, ANNONCEES.length + 7);
  assert.equal(anomalies.filter((a) => a.code === "E3").length, ANNONCEES.filter(([code]) => code === "E3").length + 4);
});

// Les anomalies d'une ligne d'une feuille : [code, message].
const surLaLigne = (anomalies) => (feuille, ligne) => anomalies.filter((a) => a.feuille === feuille && a.ligne === ligne).map((a) => [a.code, a.message]);
const nombreDE3 = (anomalies) => anomalies.filter((a) => a.code === "E3").length;
const E3_ANNONCEES = ANNONCEES.filter(([code]) => code === "E3").length;

// La première définition peut être celle qui porte le signe : la table des
// doublons se range, comme elle se lit, sous le nom comparé. Et les lignes de
// deux capacités de même nom peuvent s'entrelacer dans la feuille : le
// doublon est toujours la capacité dont la première ligne est la plus basse,
// à la plus basse de ses lignes (ici sa seule), et la ligne citée la
// première de l'autre, quelle que soit celle qui porte le signe (compl.
// § 5.4).
test("E3 — le signe invisible sur la première définition, et des variantes entrelacées : le doublon est la définition qui commence le plus bas, la plus haute est citée", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[1].lignes.push(["Bocal\u200B", null, "Vif", null, "Le premier « Bocal », suivi de U+200B", "Équipement"]);
      lignes.premierBloc = feuilles[1].lignes.length;
      feuilles[1].lignes.push(["Bocal", null, "Vif", null, "E3 : le second, sans signe", "Équipement"]);
      lignes.secondBloc = feuilles[1].lignes.length;
      feuilles[2].lignes.push(["Gluant\u2060", null, "Le premier « Gluant », suivi de U+2060."]);
      lignes.premierElement = feuilles[2].lignes.length;
      feuilles[2].lignes.push(["Gluant", null, "E3 : le second, sans signe."]);
      lignes.secondElement = feuilles[2].lignes.length;
      // « Blanchir » suivi de U+200B aux puissances 1 et 2, et « Blanchir » à la puissance 2, écrit entre les deux.
      feuilles[3].lignes.push(["Blanchir\u200B", 1, null, null, null, "La puissance 1.", "Le nom suivi de U+200B"]);
      lignes.haute = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Blanchir", 2, null, null, null, "La puissance 2.", "E3 : le même nom sans signe, qui commence une ligne plus bas"]);
      lignes.milieu = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Blanchir\u200B", 2, null, null, null, "Une autre puissance.", "Pas d'E3 : une autre puissance du nom écrit deux lignes plus haut"]);
      lignes.basse = feuilles[3].lignes.length;
    }),
  );
  const de = surLaLigne(anomalies);
  assert.deepEqual(de("Blocs", lignes.premierBloc), []);
  assert.deepEqual(de("Blocs", lignes.secondBloc), [["E3", `Le bloc « Bocal » est déjà défini ligne ${lignes.premierBloc}.`]]);
  // Les deux éléments ne sont portés par rien : A4 sur chacun, E3 sur le second seulement.
  assert.deepEqual(de("Eléments", lignes.premierElement).map(([code]) => code), ["A4"]);
  assert.deepEqual(de("Eléments", lignes.secondElement), [
    ["E3", `L'élément « Gluant » est déjà défini ligne ${lignes.premierElement}.`],
    ["A4", "L'élément « Gluant » n'est porté par rien : ni bloc, ni capacité, ni paramètre transmis."],
  ]);
  // L'import range la ligne basse avec la haute, sous le nom qu'elles écrivent : les lignes s'entrelacent.
  assert.deepEqual(banque.capacites.filter((c) => cle(c.nom) === "blanchir").map((c) => [c.nom, c.variantes.map((v) => v.brut.ligne)]), [
    ["Blanchir\u200B", [lignes.haute, lignes.basse]],
    ["Blanchir", [lignes.milieu]],
  ]);
  assert.deepEqual(de("Capacites", lignes.haute).map(([code]) => code), ["A3"]);
  // La capacité qui commence le plus bas est le doublon, à sa ligne la plus basse (sa seule) ; elle cite la plus haute,
  // celle qui porte le signe. La ligne basse, une autre puissance du nom écrit en haut, n'en est pas un.
  assert.deepEqual(de("Capacites", lignes.milieu), [
    ["E3", `La capacité « Blanchir » ne diffère de celle de la ligne ${lignes.haute} que par un signe invisible.`],
    ["A3", "La capacité « Blanchir » n'est rattachée à aucun bloc."],
  ]);
  assert.deepEqual(de("Capacites", lignes.basse), []);
  // Rien d'autre : trois E3, deux A4, deux A3.
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES + 3);
  assert.equal(anomalies.length, ANNONCEES.length + 7);
});

// « Exactement » : retirer les signes invisibles ne fait pas de la
// comparaison des doublons une comparaison approchée. La casse, un accent ou
// une espace au milieu du nom font un autre nom, et non un doublon ; c'est
// un renvoi qui s'y tromperait que dirait A1.
test("E3 — exactement : la casse, un accent ou une espace intérieure font un autre nom, pas un doublon (bloc, élément, capacité de même puissance)", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[1].lignes.push(["marmiton", null, "Vif", null, "Pas d'E3 : la casse diffère", "Espèce"]);
      lignes.blocCasse = feuilles[1].lignes.length;
      feuilles[1].lignes.push(["Grand  Four", null, "Fournaise", null, "Pas d'E3 : deux espaces au milieu du nom", "Primordial"]);
      lignes.blocEspace = feuilles[1].lignes.length;
      feuilles[2].lignes.push(["Epais", null, "Pas d'E3 : l'accent diffère."]);
      lignes.element = feuilles[2].lignes.length;
      feuilles[3].lignes.push(["vif", "N", null, null, null, "La même puissance.", "Pas d'E3 : la casse diffère"]);
      lignes.capaciteCasse = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Reduction", "N", null, null, null, "La même puissance.", "Pas d'E3 : l'accent diffère"]);
      lignes.capaciteAccent = feuilles[3].lignes.length;
    }),
  );
  // Chacun a pourtant la clé d'un autre : un renvoi approché les confondrait.
  const homonymes = (liste, nom) => liste.filter((entree) => cle(entree.nom) === cle(nom)).map((entree) => entree.nom);
  assert.deepEqual(homonymes(banque.blocs, "Marmiton"), ["Marmiton", "marmiton"]);
  assert.deepEqual(homonymes(banque.blocs, "Grand Four"), ["Grand Four", "Grand  Four"]);
  assert.deepEqual(homonymes(banque.elements, "Épais"), ["Épais", "Epais"]);
  assert.deepEqual(homonymes(banque.capacites, "Vif"), ["Vif", "vif"]);
  assert.deepEqual(homonymes(banque.capacites, "Réduction"), ["Réduction", "Reduction"]);
  const de = surLaLigne(anomalies);
  assert.deepEqual(de("Blocs", lignes.blocCasse), []);
  assert.deepEqual(de("Blocs", lignes.blocEspace), []);
  // Ce que rien ne cite sous ce nom-là se dit, sans doublon : A4 pour l'élément, A3 pour les capacités.
  assert.deepEqual(de("Eléments", lignes.element), [["A4", "L'élément « Epais » n'est porté par rien : ni bloc, ni capacité, ni paramètre transmis."]]);
  assert.deepEqual(de("Capacites", lignes.capaciteCasse), [["A3", "La capacité « vif » n'est rattachée à aucun bloc."]]);
  assert.deepEqual(de("Capacites", lignes.capaciteAccent), [["A3", "La capacité « Reduction » n'est rattachée à aucun bloc."]]);
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES);
  assert.equal(anomalies.length, ANNONCEES.length + 3);
});

// Deux capacités dont les noms ne diffèrent que d'un signe invisible, et dont
// les puissances diffèrent. L'import en garde deux ; la lecture d'avant (pas
// de doublon) s'inverse au groupe 2 du lot 4 (compl. § 5.4) : rien ne les
// distingue à l'écran, et c'est un E3. La seconde, que rien ne cite sous ce
// nom-là, se dit aussi par A3. Un renvoi exact prend celle qu'il écrit ; un
// renvoi approché ne sait plus laquelle, et devient une erreur (E4, renvoi
// ambigu) dont les deux candidats ne se distinguent pas à l'écran.
test("E3 — à un signe invisible près, d'une autre puissance : deux capacités, et un E3 ; un renvoi approché vers ce nom devient ambigu (E4)", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[3].lignes.push(["Goûter\u200B", 1, null, null, null, "Une autre puissance.", "E3 : le même nom au signe près, une autre puissance ; A3"]);
      lignes.capacite = feuilles[3].lignes.length;
      feuilles[1].lignes.push(["Bocal", null, "Goûter, gouter", null, "Un renvoi exact, puis le même à l'accent près : E4, ambigu", "Équipement"]);
      lignes.bloc = feuilles[1].lignes.length;
    }),
  );
  assert.deepEqual(banque.capacites.filter((c) => cle(c.nom) === "gouter").map((c) => [c.nom, c.variantes.map((v) => v.puissance)]), [
    ["Goûter", ["0"]],
    ["Goûter\u200B", ["1"]],
  ]);
  const de = surLaLigne(anomalies);
  assert.deepEqual(de("Capacites", lignes.capacite), [
    ["E3", "La capacité « Goûter\u200B » ne diffère de celle de la ligne 22 que par un signe invisible."],
    ["A3", "La capacité « Goûter\u200B » n'est rattachée à aucun bloc."],
  ]);
  assert.deepEqual(de("Blocs", lignes.bloc), [["E4", "Le bloc « Bocal » cite la capacité « gouter », introuvable dans Capacites (renvoi ambigu : « Goûter », « Goûter\u200B »)."]]);
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES + 1);
  assert.equal(anomalies.length, ANNONCEES.length + 3);
  // Sans la seconde capacité, le même renvoi est retrouvé, et signalé (A1).
  const seul = await importer(variante((feuilles) => feuilles[1].lignes.push(["Bocal", null, "Goûter, gouter", null, "Un renvoi à l'accent près", "Équipement"])));
  assert.deepEqual(surLaLigne(seul.anomalies)("Blocs", lignes.bloc), [
    ["A1", "Le bloc « Bocal » cite « gouter » pour la capacité « Goûter » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."],
  ]);
});

// E3 élargi (compl. § 5.4) : « Goûter » aux puissances 0 (ligne 22) et 2, et
// « Goûter » suivi de U+00AD à la puissance 1. Aucune puissance commune :
// un E3 quand même, au message neuf. Les deux variantes du nom écrit
// « Goûter » ne sont pas un doublon.
test("E3 élargi — « Goûter » suivi de U+00AD, puissance 1, à côté de « Goûter » aux puissances 0 et 2 : un E3, au message neuf ; deux variantes d'un même nom écrit, aucun", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[3].lignes.push(["Goûter", 2, null, null, null, "La puissance 2.", "Pas d'E3 : une autre puissance du même nom écrit"]);
      lignes.puissance2 = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Goûter\u00AD", 1, null, null, null, "La puissance 1.", "E3 : le même nom au signe près, aucune puissance commune"]);
      lignes.signe = feuilles[3].lignes.length;
    }),
  );
  assert.deepEqual(banque.capacites.filter((c) => cle(c.nom) === "gouter").map((c) => [c.nom, c.variantes.map((v) => [v.puissance, v.brut.ligne])]), [
    ["Goûter", [["0", 22], ["2", lignes.puissance2]]],
    ["Goûter\u00AD", [["1", lignes.signe]]],
  ]);
  const de = surLaLigne(anomalies);
  assert.deepEqual(de("Capacites", 22), []);
  assert.deepEqual(de("Capacites", lignes.puissance2), []);
  assert.deepEqual(de("Capacites", lignes.signe), [
    ["E3", "La capacité « Goûter\u00AD » ne diffère de celle de la ligne 22 que par un signe invisible."],
    ["A3", "La capacité « Goûter\u00AD » n'est rattachée à aucun bloc."],
  ]);
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES + 1);
  assert.equal(anomalies.length, ANNONCEES.length + 2);
});

// Trois noms écrits d'un même groupe : « Sauce piquante » (lignes 5 à 8 du
// classeur d'essai, puissances 1, 2, 3 et un doublon de la 2), puis le même
// nom avec U+200B au milieu, puis avec U+00AD au bout. Chacune des deux
// autres reçoit un E3 à la plus basse de ses propres lignes (compl. § 5.4,
// « à la ligne la plus basse » ; relecture du groupe 2, C-22), qui cite la
// ligne 5 ; une autre puissance d'un nom écrit n'en reçoit pas, une même
// puissance garde le message d'avant, qui cite la ligne de ce nom écrit.
test("E3 élargi — trois noms d'un groupe : deux E3, chacun à la plus basse des lignes de sa capacité, citant la première ; une même puissance d'un même nom écrit garde l'ancien message", async () => {
  const lignes = {};
  const { anomalies } = await importer(
    variante((feuilles) => {
      feuilles[3].lignes.push(["Sauce\u200B piquante", 1, null, null, null, "La puissance 1.", "E3 : le nom de la ligne 5, U+200B au milieu"]);
      lignes.milieu = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Sauce piquante\u00AD", 3, null, null, null, "La puissance 3.", "E3 : le nom de la ligne 5, U+00AD au bout"]);
      lignes.bout = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Sauce\u200B piquante", 2, null, null, null, "La puissance 2.", "Pas d'E3 : une autre puissance d'un nom déjà signalé"]);
      lignes.autrePuissance = feuilles[3].lignes.length;
      feuilles[3].lignes.push(["Sauce\u200B piquante", 1, null, null, null, "Doublon de puissance.", "E3 : même nom écrit, même puissance"]);
      lignes.doublon = feuilles[3].lignes.length;
    }),
  );
  const de = surLaLigne(anomalies);
  // « Sauce\u200B piquante » a trois lignes (milieu, autrePuissance, doublon) :
  // son E3 va à la plus basse, avec celui du doublon de puissance ; A3 reste
  // à sa première.
  assert.deepEqual(de("Capacites", lignes.milieu), [["A3", "La capacité « Sauce\u200B piquante » n'est rattachée à aucun bloc."]]);
  // « Sauce piquante\u00AD » n'en a qu'une : la plus basse est la première.
  assert.deepEqual(de("Capacites", lignes.bout), [
    ["E3", "La capacité « Sauce piquante\u00AD » ne diffère de celle de la ligne 5 que par un signe invisible."],
    ["A3", "La capacité « Sauce piquante\u00AD » n'est rattachée à aucun bloc."],
  ]);
  assert.deepEqual(de("Capacites", lignes.autrePuissance), []);
  assert.deepEqual(de("Capacites", lignes.doublon), [
    ["E3", `La capacité « Sauce\u200B piquante » a déjà une variante de puissance « 1 », ligne ${lignes.milieu}.`],
    ["E3", "La capacité « Sauce\u200B piquante » ne diffère de celle de la ligne 5 que par un signe invisible."],
  ]);
  // La première ne reçoit rien de plus que le doublon que le classeur d'essai annonce (ligne 8).
  assert.deepEqual(de("Capacites", 5), []);
  assert.deepEqual(de("Capacites", 8), [["E3", "La capacité « Sauce piquante » a déjà une variante de puissance « 2 », ligne 6."]]);
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES + 3);
  assert.equal(anomalies.length, ANNONCEES.length + 5);
});

// « Le message, à la ligne la plus basse » (compl. § 5.4), lu comme la plus
// basse des lignes de la capacité signalée (choix fait seul, réversible ;
// relecture du groupe 2, C-22) : pour une capacité d'une seule ligne, c'est
// la même que la première ; pour une capacité à plusieurs variantes, non.
// « Goûter » suivi de U+061C, aux lignes n et n + 5 ; entre elles, quatre
// autres puissances de « Goûter » (ligne 22). Le message cite la première
// ligne de « Goûter », non la plus basse.
test("E3 — à la plus basse des lignes de la capacité signalée : « Goûter » suivi de U+061C aux lignes n et n + 5 ; le message cite la première ligne de l'autre", async () => {
  const lignes = {};
  const { banque, anomalies } = await importer(
    variante((feuilles) => {
      feuilles[3].lignes.push(["Goûter\u061C", 1, null, null, null, "La puissance 1.", "Le nom suivi de U+061C : sa première ligne"]);
      lignes.n = feuilles[3].lignes.length;
      for (const puissance of [2, 3, 4, 5]) {
        feuilles[3].lignes.push(["Goûter", puissance, null, null, null, `La puissance ${puissance}.`, "Pas d'E3 : une autre puissance du même nom écrit"]);
      }
      feuilles[3].lignes.push(["Goûter\u061C", 2, null, null, null, "La puissance 2.", "E3 : le nom suivi de U+061C, à sa ligne la plus basse"]);
      lignes.basse = feuilles[3].lignes.length;
    }),
  );
  assert.equal(lignes.basse, lignes.n + 5);
  assert.deepEqual(banque.capacites.filter((c) => cle(c.nom) === "gouter").map((c) => [c.nom, c.variantes.map((v) => v.brut.ligne)]), [
    ["Goûter", [22, lignes.n + 1, lignes.n + 2, lignes.n + 3, lignes.n + 4]],
    ["Goûter\u061C", [lignes.n, lignes.basse]],
  ]);
  const de = surLaLigne(anomalies);
  assert.deepEqual(de("Capacites", lignes.n), [["A3", "La capacité « Goûter\u061C » n'est rattachée à aucun bloc."]], "rien d'autre à sa première ligne");
  for (let ligne = lignes.n + 1; ligne < lignes.basse; ligne += 1) assert.deepEqual(de("Capacites", ligne), [], `ligne ${ligne}`);
  assert.deepEqual(de("Capacites", lignes.basse), [["E3", "La capacité « Goûter\u061C » ne diffère de celle de la ligne 22 que par un signe invisible."]]);
  assert.deepEqual(de("Capacites", 22), []);
  assert.equal(nombreDE3(anomalies), E3_ANNONCEES + 1);
  assert.equal(anomalies.length, ANNONCEES.length + 2);
});

test("A1 — un renvoi qui ne diffère que d'un signe invisible est résolu, et signalé : capacité, élément, paramètre", async () => {
  let ligne;
  const { anomalies } = await importer(
    variante((feuilles) => {
      feuilles[1].lignes.push(["Bocal", "Collant\u200B", "Vif\u00AD", "{cha\u2060leur:1}", "A1 : trois renvois à un signe invisible près", "Équipement"]);
      ligne = feuilles[1].lignes.length;
    }),
  );
  assert.deepEqual(anomalies.filter((a) => a.feuille === "Blocs" && a.ligne === ligne).map((a) => [a.code, a.gravite, a.message]), [
    ["A1", "avertissement", "Le bloc « Bocal » cite « Vif\u00AD » pour la capacité « Vif » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."],
    ["A1", "avertissement", "Le bloc « Bocal » cite « Collant\u200B » pour l'élément « Collant » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."],
    ["A1", "avertissement", "Le bloc « Bocal » cite « cha\u2060leur » pour le paramètre « chaleur » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."],
  ]);
  // Résolus : ni capacité, ni élément introuvable, ni paramètre que rien ne reçoit.
  assert.equal(anomalies.length, ANNONCEES.length + 3);
});

// Un signe invisible écrit tel quel dans un fichier ne se voit ni à la
// relecture ni dans une différence, et un outil peut l'ôter sans rien dire :
// la liste de noms.js y perdrait un signe, un contrôle son cas. Le code et
// les contrôles l'écrivent donc par son code (barre oblique inversée, « u »,
// quatre chiffres), et la spécification par « U+… ».
test("signe invisible — ni le code, ni les contrôles, ni la spécification n'en écrivent un tel quel", () => {
  const signes = new Set(SIGNES_INVISIBLES.map((code) => String.fromCodePoint(code)));
  const racine = new URL("../", import.meta.url);
  const fichiers = ["SPECIFICATION.md"];
  for (const dossier of ["js", "outils", "tests"]) {
    for (const fichier of readdirSync(new URL(`${dossier}/`, racine), { recursive: true })) {
      if (fichier.endsWith(".js")) fichiers.push(`${dossier}/${fichier.replaceAll("\\", "/")}`);
    }
  }
  assert.ok(fichiers.includes("js/banque/noms.js") && fichiers.includes("tests/outils/adversaires_essai.js"), "les sous-dossiers sont lus");
  const fautes = [];
  for (const chemin of fichiers) {
    readFileSync(new URL(chemin, racine), "utf8")
      .split("\n")
      .forEach((ligne, indice) => {
        for (const signe of ligne) if (signes.has(signe)) fautes.push(`${chemin}, ligne ${indice + 1} : ${codeDit(signe.codePointAt(0))}`);
      });
  }
  assert.deepEqual(fautes, []);
});
