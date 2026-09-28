// Contrôles du contrôle de cohérence (SPECIFICATION.md, § 6.3 et § 11,
// domaine « Contrôle ») : le classeur d'essai déclenche chaque code, E1 sur
// ses variantes, et un classeur propre n'en déclenche aucun.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GRAVITES } from "../js/banque/controle.js";
import { importerFichier } from "../js/banque/importation.js";
import { cle, repertoire } from "../js/banque/noms.js";
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
  ["A1", "Blocs", 6], ["A1", "Blocs", 6], ["A2", "Blocs", 12], ["A6", "Blocs", 13], ["A6", "Blocs", 14], ["A7", "Blocs", 14],
  ["A4", "Eléments", 9],
  ["A5", "Capacites", 16], ["A3", "Capacites", 19],
  ["I1", "Blocs", 15], ["I1", "Eléments", 7], ["I2", "Eléments", 8], ["I1", "Capacites", 13], ["I2", "Capacites", 17],
];

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

test("contrôle — les seize codes du § 6.3 : quinze sur le classeur d'essai, E1 sur ses variantes", async () => {
  const essai = await importer();
  const sansFeuille = await importer(variante((feuilles) => feuilles.splice(2, 1)));
  const codes = new Set([...essai.anomalies, ...sansFeuille.anomalies].map((a) => a.code));
  assert.deepEqual([...codes].sort(), Object.keys(GRAVITES).sort());
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
});

test("contrôle — gravité de chaque code, tri par gravité puis feuille puis ligne", async () => {
  // Le tableau du § 6.3, recopié ici pour que la table du code s'y confronte.
  const gravites = { E1: "bloquante", I1: "information", I2: "information" };
  for (const n of [2, 3, 4, 5, 6, 7]) gravites[`E${n}`] = "erreur";
  for (const n of [1, 2, 3, 4, 5, 6, 7]) gravites[`A${n}`] = "avertissement";
  assert.deepEqual({ ...GRAVITES }, Object.fromEntries(Object.keys(GRAVITES).map((code) => [code, gravites[code]])));
  assert.equal(Object.keys(GRAVITES).length, 16);
  const { anomalies } = await importer();
  for (const a of anomalies) assert.equal(a.gravite, gravites[a.code], a.code);
  const rang = (a) => [["bloquante", "erreur", "avertissement", "information"].indexOf(a.gravite), ["lisez_moi", "Blocs", "Eléments", "Capacites"].indexOf(a.feuille), a.ligne];
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
  assert.match(message("E7", 11)[0], /Le bloc « Hachoir » transmet 2 fois le paramètre distance \(\{distance:0\}, \{distance:1\}\(Jet de sel\)\)/);
  assert.deepEqual(message("A1", 6), [
    "Le bloc « Marmite hurlante » cite « coup de poele » pour la capacité « Coup de poêle » : seules la casse, les accents ou les espaces diffèrent.",
    "Le bloc « Marmite hurlante » cite « brulant » pour l'élément « Brûlant » : seules la casse, les accents ou les espaces diffèrent.",
  ]);
});

test("noms — clé sans casse, accents ni espaces ; résolution exacte, approchée, ambiguë, absente", () => {
  assert.equal(cle(" Coup  de Poêle "), "coupdepoele");
  assert.equal(cle("Eléments transmis aux capacités"), cle("éléments TRANSMIS aux capacites"));
  const noms = repertoire(["Coup", "Choc", "choc"]);
  assert.deepEqual(noms.resoudre("Coup"), { nom: "Coup", facon: "exacte" });
  assert.deepEqual(noms.resoudre("coup "), { nom: "Coup", facon: "approchee" });
  assert.deepEqual(noms.resoudre("CHOC"), { nom: null, candidats: ["Choc", "choc"] });
  assert.deepEqual(noms.resoudre("Rien"), { nom: null, candidats: [] });
});
