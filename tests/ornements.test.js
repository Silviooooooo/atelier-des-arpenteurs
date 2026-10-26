// Contrôles de la feuille des ornements (SPECIFICATION.md, § 10.1) :
// css/ornements.css, écrite à la main, lue comme un texte. Son rendu n'est
// pas mis à l'épreuve, seulement sa forme : tout à l'écran, chaque règle
// sous la racine d'un thème du catalogue, rien de téléchargé, aucun
// ornement de titre sur la fiche ni sur la carte, les thèmes ornés, et sa
// place dans index.html.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES } from "../js/apparence/themes.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const FEUILLE = lire("css/ornements.css").replace(/\/\*[\s\S]*?\*\//g, "").trim();

// Les thèmes qui s'appliquent par data-theme : tous, sauf les deux entrées
// « Atelier ».
const APPLIQUES = new Set(THEMES.map(({ code }) => code).filter((code) => code !== "atelier-clair" && code !== "atelier-sombre"));

// Les vingt-sept thèmes ornés ; les neuf autres n'ont aucun ornement.
const ORNES = [
  "contraste", "givre", "neon", "enluminure", "constellations", "abrasia", "tenebres", "taverne", "sables",
  "heraldique", "forge", "sylve", "cathedrale", "abysses", "arcade", "clair-obscur", "ascension", "bastion",
  "quete", "faille", "laiton", "belle-epoque", "necropole", "compagnie", "carte-aventure", "grand-cru", "velours",
];

// Les sélecteurs d'une liste, coupée aux virgules hors des parenthèses.
function diviser(prelude) {
  const selecteurs = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < prelude.length; i++) {
    if (prelude[i] === "(") profondeur++;
    else if (prelude[i] === ")") profondeur--;
    else if (prelude[i] === "," && profondeur === 0) {
      selecteurs.push(prelude.slice(debut, i));
      debut = i + 1;
    }
  }
  selecteurs.push(prelude.slice(debut));
  return selecteurs.map((selecteur) => selecteur.trim().replace(/\s+/g, " "));
}

// L'enveloppe de la feuille (ce qui précède sa première accolade), ce qui
// suit l'accolade qui la ferme, ce qui reste entre les règles, et les
// sélecteurs de chaque règle.
function lireFeuille(css) {
  const ouverture = css.indexOf("{");
  let profondeur = 0;
  let fin = -1;
  for (let i = ouverture; i < css.length && fin < 0; i++) {
    if (css[i] === "{") profondeur++;
    else if (css[i] === "}" && --profondeur === 0) fin = i;
  }
  const interieur = css.slice(ouverture + 1, fin);
  const regles = [...interieur.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(([, prelude]) => diviser(prelude));
  return {
    enveloppe: css.slice(0, ouverture).trim(),
    apres: css.slice(fin + 1).trim(),
    reste: interieur.replace(/[^{}]+\{[^{}]*\}/g, "").trim(),
    selecteurs: regles.flat(),
  };
}

const { enveloppe, apres, reste, selecteurs } = lireFeuille(FEUILLE);

test("ornements.css — la feuille est tout entière dans un seul @media screen, sans autre règle @ ; aucun @font-face, @import ni url()", () => {
  assert.equal(enveloppe, "@media screen");
  assert.equal(apres, "", "rien après le @media screen");
  assert.equal(reste, "", "une règle imbriquée dans le @media screen");
  assert.ok(selecteurs.length > 0);
  assert.doesNotMatch(FEUILLE, /@font-face|@import|url\(/i);
  assert.equal(FEUILLE.match(/@/g).length, 1, "une seule règle @");
});

test("ornements.css — chaque sélecteur part de :root[data-theme=\"<code>\"], un thème du catalogue qui s'applique par data-theme", () => {
  for (const selecteur of selecteurs) {
    const racine = selecteur.match(/^:root\[data-theme="([^"]+)"\](?: |$)/);
    assert.ok(racine, `${selecteur} ne part pas de :root[data-theme="<code>"]`);
    assert.ok(APPLIQUES.has(racine[1]), `${racine[1]} n'est pas un thème qui s'applique par data-theme`);
  }
});

test("ornements.css — un ornement de titre ne touche ni la fiche ni la carte d'adversaire", () => {
  const titres = selecteurs.filter((selecteur) => /(?<![\w.#-])h[1-6](?![\w-])/.test(selecteur));
  assert.ok(titres.length > 0);
  for (const selecteur of titres) assert.ok(selecteur.includes(":not(.feuille *, .carte-adversaire *)"), selecteur);
});

test("ornements.css — les thèmes ornés sont exactement les vingt-sept prévus, et aucun autre", () => {
  const ornes = new Set(selecteurs.map((selecteur) => selecteur.match(/^:root\[data-theme="([^"]+)"\]/)?.[1]));
  assert.deepEqual([...ornes].sort(), [...ORNES].sort());
  assert.equal(ORNES.length, 27);
});

test("index.html — css/ornements.css est liée une fois, après toutes les autres feuilles", () => {
  const liens = [...lire("index.html").matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(([, href]) => href);
  assert.equal(liens.filter((href) => href === "css/ornements.css").length, 1);
  assert.equal(liens.at(-1), "css/ornements.css");
});
