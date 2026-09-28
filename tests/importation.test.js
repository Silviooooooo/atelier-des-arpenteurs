// Contrôles de l'import (SPECIFICATION.md, § 5.1 et § 6) : la banque tirée
// du classeur d'essai a le format du § 5.1, les colonnes se retrouvent par
// leur en-tête, les valeurs restent des chaînes et le brut garde tout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { CLASSEUR_ESSAI } from "./outils/classeur_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));

async function banque() {
  const resultat = await importerFichier(ESSAI, "classeur_essai.xlsx");
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  return resultat.banque;
}

test("import — la banque a le format du § 5.1, avec la source et son empreinte", async () => {
  const b = await banque();
  assert.deepEqual(Object.keys(b), ["format", "sources", "blocs", "capacites", "elements", "lisez_moi", "anomalies"]);
  assert.equal(b.format, 1);
  const empreinte = `sha256:${createHash("sha256").update(ESSAI).digest("hex")}`;
  assert.deepEqual(b.sources, [{ classeur: "regles", fichier: "classeur_essai.xlsx", empreinte }]);
  assert.deepEqual([b.blocs.length, b.capacites.length, b.elements.length, b.lisez_moi.length], [15, 15, 9, 5]);
});

test("import — un bloc : éléments, capacités, paramètres, notes et brut", async () => {
  const bloc = (await banque()).blocs.find((b) => b.nom === "Rouleau à pâtisserie");
  assert.deepEqual(bloc, {
    nom: "Rouleau à pâtisserie",
    elements: [{ nom: "Brûlant", cible: "Coup de louche" }],
    capacites: [
      { forme: "simple", nom: "Coup de louche" },
      { forme: "choix", options: ["Sauce piquante"] },
    ],
    parametres: [{ nom: "chaleur", valeur: "{force}*0,5/{force}/{force}*2", cible: "Coup de louche" }],
    notes: "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
    brut: {
      feuille: "Blocs",
      ligne: 5,
      cellules: {
        Nom: "Rouleau à pâtisserie",
        "Eléments transmis aux capacités": "Brûlant(Coup de louche)",
        Capacités: "Coup de louche, ( Sauce piquante )",
        "Paramètres transmis aux capacités": "{chaleur:{force}*0,5/{force}/{force}*2}(Coup de louche)",
        Infos: "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
      },
    },
  });
});

test("import — capacités : une variante par ligne, retrouvée malgré l'ordre et l'écriture des en-têtes", async () => {
  const b = await banque();
  const sauce = b.capacites.find((c) => c.nom === "Sauce piquante");
  assert.deepEqual(sauce.variantes.map((v) => v.puissance), ["1", "2", "3", "2"]);
  const { brut, ...troisieme } = sauce.variantes[2];
  assert.deepEqual(troisieme, {
    puissance: "3",
    cout_souffle: "4",
    cout_lien: "1",
    elements: [{ nom: "Brûlant" }],
    description: "[N*{chaleur}] points.",
    notes: "",
  });
  assert.equal(brut.ligne, 7);
  assert.equal(brut.cellules["Éléments propres"], "Brûlant");
});

test("import — les valeurs restent des chaînes, telles qu'écrites", async () => {
  const b = await banque();
  const variante = (nom) => b.capacites.find((c) => c.nom === nom).variantes[0];
  assert.deepEqual([variante("Moulinet farineux").puissance, variante("Moulinet farineux").cout_souffle], ["N", "5*N"]);
  assert.equal(variante("Moulinet farineux").description, "Tourbillonne [N] fois.");
  assert.equal(variante("Jet de sel").cout_souffle, "X");
  assert.deepEqual(variante("Jet de sel").elements, [{ nom: "Distance", valeur: "2" }]);
  assert.equal(variante("Jet de sel").description, "Lance du sel à {distance} pas.\nPuis recommence.");
  assert.equal(variante("Coup de louche").puissance, "0");
});

test("import — éléments : paramètres reçus, description telle qu'écrite", async () => {
  const b = await banque();
  const { brut, ...sale } = b.elements.find((e) => e.nom === "Salé");
  assert.deepEqual(sale, { nom: "Salé", parametres_recus: ["sel"], description: "" });
  assert.deepEqual(brut.cellules, { Nom: "Salé", "Paramètres reçus": "{sel}", Description: "" });
});

test("import — noms sans espaces de bord ; le nom d'origine reste dans le brut", async () => {
  const b = await banque();
  const fumoir = b.blocs.find((bloc) => bloc.nom === "Fumoir");
  assert.equal(fumoir.brut.cellules.Nom, " Fumoir ");
  assert.ok(b.capacites.some((c) => c.nom === "Marmitage"));
});

test("import — lisez_moi : rubrique et texte tels qu'écrits", async () => {
  assert.deepEqual((await banque()).lisez_moi, [
    { rubrique: "Syntaxe", texte: "Un bloc transmet un paramètre sous la forme {nom:valeur}." },
    { rubrique: "", texte: "Une capacité invoque un paramètre sous la forme {nom}." },
    { rubrique: "", texte: "Un choix obligatoire s'écrit (a | b), un ensemble facultatif [a | b]." },
    { rubrique: "nb", texte: "La colonne Infos et la colonne origine n'ont aucune valeur légale." },
    { rubrique: "", texte: "Ce classeur est fictif : il sert aux contrôles de l'Atelier." },
  ]);
});

test("import — une ligne sans nom n'entre pas ; une feuille en plus est ignorée", async () => {
  const b = await banque();
  assert.ok([...b.blocs, ...b.elements, ...b.capacites].every((objet) => objet.nom));
  assert.ok(!JSON.stringify(b).includes("Formes de cellules"));
});

test("import — une colonne nommée « __proto__ » ou « constructor » reste dans le brut", async () => {
  const description = structuredClone(CLASSEUR_ESSAI);
  const blocs = description.feuilles.find((feuille) => feuille.nom === "Blocs");
  blocs.lignes[0].push("__proto__", "constructor");
  blocs.lignes[1].push("PROTO", "CONSTRUCTEUR");
  const { banque } = await importerFichier(fabriquerClasseur(description), "variante.xlsx");
  const cellules = banque.blocs.find((bloc) => bloc.nom === "Louche d'acier").brut.cellules;
  assert.equal(Object.hasOwn(cellules, "__proto__"), true, "la colonne __proto__ n'est pas avalée");
  assert.equal(cellules.__proto__, "PROTO");
  assert.equal(cellules.constructor, "CONSTRUCTEUR");
  assert.equal(Object.getPrototypeOf(cellules), Object.prototype, "aucune pollution");
  assert.match(JSON.stringify(banque), /"__proto__":"PROTO"/);
});

test("import — un fichier illisible donne un message, pas une exception", async () => {
  const resultat = await importerFichier(Buffer.from("Nom;Capacités"), "notes.csv");
  assert.deepEqual(Object.keys(resultat), ["erreur"]);
  assert.match(resultat.erreur, /pas une archive ZIP/);
});
