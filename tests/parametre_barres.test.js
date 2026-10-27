// Contrôles d'un paramètre écrit avec des « / » (mission du lot 4.3, § 9,
// point 2 ; SPECIFICATION.md, § 15.2).
//
// Hors de RANGS (autre que dégâts et armure), une barre de premier niveau
// sépare toujours des valeurs, jamais une division : « 5/10/15 » se lit
// comme une suite de trois valeurs, chacune évaluée comme une expression,
// sans la qualité (que seuls dégâts, défense et armure prennent), et
// s'affiche jointe par « / ». Une barre entre accolades, crochets ou
// parenthèses n'est pas de premier niveau : elle ne coupe rien. Dégâts et
// armure gardent leurs rangs.
//
// La banque vient du classeur d'essai, fictif : la Louche d'acier transmet
// {chaleur:5/10/15}, que reçoit l'élément Brûlant.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche, contexte, indexerCreation, qualiteDe, valeursParametre } from "../js/personnage/calcul.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T22:34:07+02:00" };
const INDEX = indexerCreation(BANQUE);
const AUBEPINE = personnageEssai();
const LOUCHE = INDEX.bloc("Louche d'acier");
const QUALITE_3 = qualiteDe(INDEX.bloc("Rouleau de fonte"), "3");

test("barres — hors de RANGS, une suite de valeurs : « 5/10/15 », chacune une expression, sans la qualité", () => {
  assert.deepEqual(valeursParametre("chaleur", "5/10/15"), { valeurs: [5, 10, 15] });
  // Chacune une expression, les caractéristiques comprises (Force 4).
  assert.deepEqual(valeursParametre("chaleur", "{force}*0,5/{force}/{force}*2", { caracteristiques: AUBEPINE.caracteristiques }), { valeurs: [2, 4, 8] });
  assert.ok(valeursParametre("chaleur", "N/2").erreur, "N n'a pas de valeur dans un paramètre");
  // Sans la qualité : seuls dégâts, défense et armure la prennent.
  assert.deepEqual(valeursParametre("chaleur", "5/10/15", { qualite: QUALITE_3 }), { valeurs: [5, 10, 15] });
  // Un morceau qui ne se calcule pas : la valeur entière reste telle qu'écrite.
  const vide = valeursParametre("chaleur", "5//15");
  assert.deepEqual([vide.valeurs, vide.brut], [undefined, "5//15"]);
  assert.deepEqual(valeursParametre("chaleur", "5/X/15"), { erreur: null, x: true, brut: "5/X/15" });
});

test("barres — une barre hors du premier niveau (accolades, crochets, parenthèses) ne coupe rien : la valeur reste une, telle qu'écrite si elle ne se calcule pas", () => {
  const entre = valeursParametre("chaleur", "(10/2)");
  assert.equal(entre.brut, "(10/2)");
  assert.match(entre.erreur, /« \(10\/2\) » n'est pas une expression que l'Atelier calcule/, "le morceau entier, non « (10 »");
  const accolades = valeursParametre("chaleur", "{a/b}");
  assert.match(accolades.erreur, /« \{a\/b\} » est inconnu ici/);
  const crochets = valeursParametre("chaleur", "[10/2]");
  assert.match(crochets.erreur, /« \[10\/2\] »/);
  // Une parenthèse fermée, la barre suivante coupe de nouveau.
  const apres = valeursParametre("chaleur", "(1)/2");
  assert.match(apres.erreur, /« \(1\) »/);
});

test("barres — une valeur sans barre ne change pas ; dégâts et armure gardent leurs rangs et la qualité", () => {
  assert.deepEqual(valeursParametre("chaleur", "3"), { valeurs: [3] });
  assert.deepEqual(valeursParametre("portee", "{force}*0,5", { caracteristiques: AUBEPINE.caracteristiques }), { valeurs: [2] });
  assert.deepEqual(valeursParametre("defense", "8", { qualite: QUALITE_3 }), { valeurs: [10] }, "8 × 4/3");
  assert.deepEqual(valeursParametre("degats", "8/11/13", { qualite: QUALITE_3 }), { valeurs: [10, 14, 17] });
  assert.deepEqual(valeursParametre("armure", "30/0/0/0/0/0"), { valeurs: [30, 0, 0, 0, 0, 0] });
  assert.match(valeursParametre("degats", "5/10").erreur, /degats : 3 valeurs attendues dans « 5\/10 »/);
});

test("Louche d'acier — Brûlant 5/10/15, et non plus 0 : au calcul, dans la description de la fiche, et à l'étape 7 du créateur", async () => {
  const variables = contexte(INDEX, AUBEPINE, LOUCHE, qualiteDe(LOUCHE, "2"), INDEX.capacite("Coup de louche"), 0);
  assert.deepEqual(variables.get("chaleur"), { valeurs: [5, 10, 15] });
  // Sur la fiche : « Frappe pour {chaleur} point(s). », jointe par « / ».
  const fiche = calculerFiche(BANQUE, personnageEssai((p) => p.equipement.push({ nom: "Louche d'acier", choix: [], qualite: null, place: "sac" })), { index: INDEX });
  const coup = fiche.capacites.find((c) => c.nom === "Coup de louche");
  assert.equal(coup.descriptions.find((d) => d.source === "Louche d'acier")?.texte, "Frappe pour 5/10/15 points.");
  assert.ok(!fiche.avertissements.some((a) => /chaleur/.test(a.texte)), "aucun avertissement");
  // Au créateur, la vignette de la Louche d'acier, à l'étape 7.
  const retirer = installerDom();
  try {
    const creation = await import("../js/ecrans/creation.js");
    const contexteEcran = { etat: { mode: "demo", banque: BANQUE, etagere: creerEtagere(magasinPersonnagesMemoire(), "demo"), chargement: { enveloppe: { empreinte: "0123456789abcdef" } } }, naviguer() {}, afficher() {} };
    await contexteEcran.etat.etagere.garder(AUBEPINE);
    const ecran = creation.afficher(contexteEcran, { ecran: "creation", id: AUBEPINE.id, etape: 7 });
    document.body.replaceChildren(ecran);
    await laisserFiler(10);
    const vignette = [...ecran.querySelectorAll("input[name=arme]")].map((entree) => entree.parentNode).find((v) => texteDe(v.querySelector("label")).startsWith("Louche d'acier"));
    assert.ok(vignette, "la vignette de la Louche d'acier");
    const paires = [...vignette.querySelectorAll("dt")].map((dt, i) => [texteDe(dt), texteDe(vignette.querySelectorAll("dd")[i])]);
    assert.deepEqual(paires, [["Brûlant", "5/10/15"], ["Distance", "0"]]);
  } finally {
    retirer();
  }
});

test("Rouleau à pâtisserie — sa chaleur visée, « {force}*0,5/{force}/{force}*2 », trois valeurs à la Force du personnage", () => {
  const fiche = calculerFiche(BANQUE, personnageEssai((p) => p.equipement.push({ nom: "Rouleau à pâtisserie", choix: [], qualite: null, place: "sac" })), { index: INDEX });
  const coup = fiche.capacites.find((c) => c.nom === "Coup de louche");
  assert.equal(coup.descriptions.find((d) => d.source === "Rouleau à pâtisserie")?.texte, "Frappe pour 2/4/8 points.");
});
