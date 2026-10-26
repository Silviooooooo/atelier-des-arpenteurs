// Contrôles de l'ordre des neuf caractéristiques (SPECIFICATION.md, § 15.2,
// § 15.3 et § 15.4 ; lot 5, l'ordre du livret du 25/10/2026).
//
// L'ordre ne range que l'affichage : un personnage garde ses valeurs par
// code. Un personnage enregistré avant le lot, dont le fichier range ses
// caractéristiques dans l'ancien ordre (Force, Agilité, Précision, Sens,
// Culture néruvienne, Savoir sauvage, Parole, Empathie, Créativité), se lit
// par son fichier, son lien et l'appareil, et s'affiche avec les mêmes
// valeurs à l'étape 2 du créateur, à la fiche à l'écran et à la feuille à
// imprimer. La banque vient du classeur d'essai, fictif.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche } from "../js/personnage/calcul.js";
import { codeDuLien, lireCode, lirePersonnage } from "../js/personnage/format.js";
import { CARACTERISTIQUES, TYPES_OBJET, deDuJet } from "../js/personnage/regles.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", RACINE)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T10:00:00+02:00" };
const creation = await import("../js/ecrans/creation.js");
const fichePersonnage = await import("../js/ecrans/fiche_personnage.js");

// L'ordre du livret du 25/10/2026.
const ORDRE = ["Force", "Agilité", "Précision", "Parole", "Culture néruvienne", "Savoir sauvage", "Sens", "Empathie", "Créativité"];

// Les caractéristiques d'un personnage d'avant le lot, dans l'ordre de son
// fichier : l'ancien. Sens et Parole, Culture néruvienne et Savoir sauvage
// ont des valeurs distinctes, pour qu'un échange se voie.
const TEXTE_D_AVANT = '{"force":3,"agilite":5,"precision":4,"sens":6,"culture_neruvienne":2,"savoir_sauvage":5,"parole":3,"empathie":4,"creativite":4}';
const D_AVANT = JSON.parse(TEXTE_D_AVANT);
// Ce qui doit s'afficher, nom et valeur, dans l'ordre du livret.
const AFFICHE = [
  ["Force", "3"],
  ["Agilité", "5"],
  ["Précision", "4"],
  ["Parole", "3"],
  ["Culture néruvienne", "2"],
  ["Savoir sauvage", "5"],
  ["Sens", "6"],
  ["Empathie", "4"],
  ["Créativité", "4"],
];

// Le personnage d'essai, tel que l'écrivait l'Atelier avant le lot : le
// texte de son fichier, ses caractéristiques dans l'ancien ordre.
function texteDuFichierDAvant() {
  const objet = personnageEssai();
  objet.caracteristiques = "@CARACTERISTIQUES@";
  return `${JSON.stringify(objet, null, 2).replace('"@CARACTERISTIQUES@"', TEXTE_D_AVANT)}\n`;
}

function contexteDe(etagere) {
  return { etat: { mode: "demo", banque: BANQUE, etagere, chargement: { enveloppe: { empreinte: "0123456789abcdef" } } }, naviguer() {}, afficher() {} };
}

// Les paires [nom, valeur] d'une liste affichée, dans l'ordre du document.
const paires = (noeuds, nom, valeur) => noeuds.map((noeud) => [texteDe(noeud.querySelector(nom)), texteDe(noeud.querySelector(valeur))]);

test("l'ordre du livret du 25/10/2026 ; les paires des types d'arme ne changent pas", () => {
  assert.deepEqual(
    CARACTERISTIQUES.map((c) => c.nom),
    ORDRE,
  );
  assert.deepEqual(
    CARACTERISTIQUES.map((c) => c.code),
    ["force", "agilite", "precision", "parole", "culture_neruvienne", "savoir_sauvage", "sens", "empathie", "creativite"],
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(TYPES_OBJET).map(([code, type]) => [code, [type.attaque, type.defense]])),
    {
      lourde: [["force", "precision"], ["force", "sens"]],
      agile: [["agilite", "force"], ["agilite", "creativite"]],
      precise: [["precision", "agilite"], ["precision", "empathie"]],
    },
  );
});

test("un personnage d'avant le lot : son fichier, son lien et l'appareil lui rendent ses neuf valeurs, par code", async () => {
  const texte = texteDuFichierDAvant();
  assert.ok(texte.includes(TEXTE_D_AVANT), "le fichier range ses caractéristiques dans l'ancien ordre");
  const { personnage, erreur } = lirePersonnage(texte, { mode: "demo" });
  assert.equal(erreur, undefined);
  assert.deepEqual(personnage.caracteristiques, D_AVANT);
  const relu = await lireCode(await codeDuLien(personnage), { mode: "demo" });
  assert.deepEqual(relu.personnage.caracteristiques, D_AVANT);
  const magasin = magasinPersonnagesMemoire();
  await magasin.ecrire("demo", JSON.parse(texte));
  assert.deepEqual((await creerEtagere(magasin, "demo").lire(personnage.id)).caracteristiques, D_AVANT);
});

test("un personnage d'avant le lot : la fiche calculée suit l'ordre du livret, chaque nom avec sa valeur, et ses dés ne changent pas", () => {
  const { personnage } = lirePersonnage(texteDuFichierDAvant(), { mode: "demo" });
  const fiche = calculerFiche(BANQUE, personnage);
  assert.deepEqual(
    fiche.caracteristiques.map((c) => [c.nom, String(c.valeur)]),
    AFFICHE,
  );
  for (const [code, type] of Object.entries(TYPES_OBJET)) {
    assert.equal(fiche.des.attaque[code]?.de, deDuJet(D_AVANT[type.attaque[0]], D_AVANT[type.attaque[1]]).de, `attaque ${type.nom}`);
    assert.equal(fiche.des.defense[code]?.de, deDuJet(D_AVANT[type.defense[0]], D_AVANT[type.defense[1]]).de, `défense ${type.nom}`);
  }
});

test("un personnage d'avant le lot, gardé sur l'appareil : l'étape 2 du créateur, la fiche à l'écran et la feuille à imprimer disent les mêmes valeurs, dans l'ordre du livret", async () => {
  const retirer = installerDom();
  globalThis.localStorage = { getItem: () => "lecture", setItem: () => {} };
  try {
    const magasin = magasinPersonnagesMemoire();
    const etagere = creerEtagere(magasin, "demo");
    const donnees = JSON.parse(texteDuFichierDAvant());
    await magasin.ecrire("demo", donnees);
    const contexte = contexteDe(etagere);

    // L'étape 2 : un nom, puis sa valeur, entre « − » et « + ».
    const etape = creation.afficher(contexte, { ecran: "creation", id: donnees.id, etape: 2 });
    document.body.replaceChildren(etape);
    await laisserFiler(20);
    assert.deepEqual(paires([...etape.querySelectorAll(".caracteristique")], ".nom-pas", ".valeur-pas"), AFFICHE);
    assert.equal(texteDe(etape.querySelector(".somme")), "Somme : 36 / 36");

    // La fiche à l'écran (vue lecture) et la feuille à imprimer (le recto).
    const ecran = fichePersonnage.afficher(contexte, { ecran: "personnage", id: donnees.id });
    document.body.replaceChildren(ecran);
    await laisserFiler(20);
    assert.deepEqual(paires([...ecran.querySelector(".lecture-caracteristiques").querySelectorAll("li")], "span", "strong"), AFFICHE);
    assert.deepEqual(paires([...ecran.querySelector(".impression .recto").querySelectorAll(".caracteristique-fiche")], ".nom-caracteristique", ".boite-valeur"), AFFICHE);

    // Rien n'a été réécrit : le personnage gardé a les mêmes valeurs.
    assert.deepEqual((await etagere.lire(donnees.id)).caracteristiques, D_AVANT);
  } finally {
    delete globalThis.localStorage;
    retirer();
  }
});
