// Contrôles de la comparaison mot à mot (SPECIFICATION.md, § 15.3, étape 8
// du créateur) : js/personnage/difference.js découpe deux textes en mots et
// en signes, garde la plus longue sous-suite commune des mots, comparés tels
// quels, et marque les autres, « retirés » du texte actuel, « ajoutés » au
// suivant. Chaque cas vérifie aussi que les morceaux recollés redonnent le
// texte à l'identique, et qu'aucun signe ni aucun espace n'est marqué.
//
// La démonstration d'abord, telle qu'elle est publiée : Fournaise, du niveau
// 1 au niveau 2, sous les yeux d'Aubépine.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { descriptionA, indexerCreation } from "../js/personnage/calcul.js";
import { difference } from "../js/personnage/difference.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(readFileSync(new URL("essais/banque_demo.chiffree.json", racine), "utf8")), MOT_DE_PASSE_DEMO);
const INDEX = indexerCreation(BANQUE);

const MOT_ENTIER = /^[\p{L}\p{N}\p{M}]+$/u;
const recolle = (morceaux) => morceaux.map((m) => m.texte).join("");
const marques = (morceaux, cle) => morceaux.filter((m) => m[cle]).map((m) => m.texte);

// La comparaison de deux textes, et ce qui vaut pour toutes : chaque suite
// recolle son texte, n'a pas de morceau vide, porte sa seule clé, et ne
// marque que des mots entiers. Rend les mots retirés et ajoutés.
function comparer(avant, apres) {
  const d = difference(avant, apres);
  assert.equal(recolle(d.avant), avant ?? "");
  assert.equal(recolle(d.apres), apres ?? "");
  for (const [suite, cle, autre] of [[d.avant, "retire", "ajoute"], [d.apres, "ajoute", "retire"]]) {
    for (const morceau of suite) {
      assert.ok(morceau.texte.length > 0, "aucun morceau vide");
      assert.equal(typeof morceau[cle], "boolean");
      assert.ok(!(autre in morceau), `un morceau ne porte que « ${cle} »`);
      if (morceau[cle]) assert.match(morceau.texte, MOT_ENTIER);
    }
  }
  return { d, retires: marques(d.avant, "retire"), ajoutes: marques(d.apres, "ajoute") };
}

test("démonstration — Fournaise, du niveau 1 au niveau 2 : deux mots retirés, cinq ajoutés, « case » demeure", () => {
  const texte = (niveau) => descriptionA(INDEX, personnageEssai(), "Fournaise", { niveau }).texte;
  assert.equal(texte(1), "Réchauffe la case.");
  assert.equal(texte(2), "Brûle trois adversaires à 1 case.");
  const { d, retires, ajoutes } = comparer(texte(1), texte(2));
  assert.deepEqual(retires, ["Réchauffe", "la"]);
  assert.deepEqual(ajoutes, ["Brûle", "trois", "adversaires", "à", "1"]);
  // Les morceaux eux-mêmes : les mots marqués seuls, le reste réuni.
  assert.deepEqual(d.avant, [
    { texte: "Réchauffe", retire: true },
    { texte: " ", retire: false },
    { texte: "la", retire: true },
    { texte: " case.", retire: false },
  ]);
  assert.deepEqual(d.apres.at(-1), { texte: " case.", ajoute: false });
});

test("démonstration — Fournaise, du niveau 2 au niveau 3 : « case » et « cases » sont deux mots", () => {
  const texte = (niveau) => descriptionA(INDEX, personnageEssai(), "Fournaise", { niveau }).texte;
  const { retires, ajoutes } = comparer(texte(2), texte(3));
  assert.equal(texte(3), "Aveugle une cible à 2 cases.");
  assert.deepEqual(retires, ["Brûle", "trois", "adversaires", "1", "case"]);
  assert.deepEqual(ajoutes, ["Aveugle", "une", "cible", "2", "cases"]);
});

test("un mot ajouté, un mot retiré : au milieu comme à la fin", () => {
  assert.deepEqual(comparer("Brûle la case.", "Brûle toute la case.").ajoutes, ["toute"]);
  assert.deepEqual(comparer("Brûle la case.", "Brûle toute la case.").retires, []);
  assert.deepEqual(comparer("Brûle toute la case.", "Brûle la case.").retires, ["toute"]);
  assert.deepEqual(comparer("Brûle toute la case.", "Brûle la case.").ajoutes, []);
  assert.deepEqual(comparer("Atteint une cible.", "Atteint une cible brûlante.").ajoutes, ["brûlante"]);
  assert.deepEqual(comparer("Atteint une cible brûlante.", "Atteint une cible.").retires, ["brûlante"]);
});

test("un mot répété : seule l'occurrence de trop est marquée", () => {
  const { d, ajoutes, retires } = comparer("Brûle une case.", "Brûle une case, puis une case.");
  assert.deepEqual(retires, []);
  assert.deepEqual(ajoutes, ["puis", "une", "case"]);
  assert.deepEqual(d.apres, [
    { texte: "Brûle une case, ", ajoute: false },
    { texte: "puis", ajoute: true },
    { texte: " ", ajoute: false },
    { texte: "une", ajoute: true },
    { texte: " ", ajoute: false },
    { texte: "case", ajoute: true },
    { texte: ".", ajoute: false },
  ]);
  const retour = comparer("la case et la braise", "la braise");
  assert.deepEqual(retour.retires, ["case", "et", "la"]);
  assert.deepEqual(retour.d.avant[0], { texte: "la ", retire: false });
  assert.deepEqual(retour.d.avant.at(-2), { texte: "la", retire: true });
});

test("la plus longue sous-suite commune : un mot présent des deux côtés peut être marqué", () => {
  // poivre, laurier, persil : la seule sous-suite commune de trois mots.
  const { retires, ajoutes } = comparer("sel poivre thym laurier persil", "poivre laurier sel persil thym");
  assert.deepEqual(retires, ["sel", "thym"]);
  assert.deepEqual(ajoutes, ["sel", "thym"]);
});

test("casse et accent : deux mots qui ne diffèrent que par eux ne sont pas le même mot", () => {
  const casse = comparer("Frappe la cible.", "frappe la cible.");
  assert.deepEqual([casse.retires, casse.ajoutes], [["Frappe"], ["frappe"]]);
  const accent = comparer("Brûle la case.", "Brule la case.");
  assert.deepEqual([accent.retires, accent.ajoutes], [["Brûle"], ["Brule"]]);
});

test("les mots au sens Unicode : chiffres, lettres accentuées, marques combinantes ; l'apostrophe sépare", () => {
  const chiffres = comparer("Niveau 2", "Niveau 3");
  assert.deepEqual([chiffres.retires, chiffres.ajoutes], [["2"], ["3"]]);
  // Une marque combinante tient à sa lettre : « Brûle » écrit en deux signes reste un seul mot.
  const marque = comparer("Bru\u0302le la case.", "Brule la case.");
  assert.deepEqual([marque.retires, marque.ajoutes], [["Bru\u0302le"], ["Brule"]]);
  const apostrophe = comparer("Maîtrise de l'agile", "Maîtrise du lourd");
  assert.deepEqual([apostrophe.retires, apostrophe.ajoutes], [["de", "l", "agile"], ["du", "lourd"]]);
});

test("la ponctuation et les espaces se gardent tels qu'écrits, et ne sont jamais marqués", () => {
  // Les mêmes mots, d'autres signes et d'autres espaces : rien n'est marqué.
  const memes = comparer("Réchauffe  la case ;\u00a0puis\tattend…", "Réchauffe la case !\npuis attend.");
  assert.deepEqual([memes.retires, memes.ajoutes], [[], []]);
  assert.deepEqual(memes.d.avant, [{ texte: "Réchauffe  la case ;\u00a0puis\tattend…", retire: false }]);
  const signes = comparer("Brûle (trois) adversaires, à 1 case.", "Brûle (deux) adversaires, à 2 cases !");
  assert.deepEqual([signes.retires, signes.ajoutes], [["trois", "1", "case"], ["deux", "2", "cases"]]);
  assert.deepEqual(signes.d.apres.slice(0, 3), [
    { texte: "Brûle (", ajoute: false },
    { texte: "deux", ajoute: true },
    { texte: ") adversaires, à ", ajoute: false },
  ]);
  // Des signes seuls : aucun mot, rien à marquer.
  assert.deepEqual(comparer("  ", " . ").d, { avant: [{ texte: "  ", retire: false }], apres: [{ texte: " . ", ajoute: false }] });
});

test("les textes vides : aucun morceau ; face à un texte vide, tous les mots sont marqués", () => {
  assert.deepEqual(difference("", ""), { avant: [], apres: [] });
  assert.deepEqual(difference(undefined, null), { avant: [], apres: [] });
  const ajout = comparer("", "Brûle la case.");
  assert.deepEqual([ajout.d.avant, ajout.ajoutes], [[], ["Brûle", "la", "case"]]);
  const retrait = comparer("Réchauffe la case.", "");
  assert.deepEqual([retrait.retires, retrait.d.apres], [["Réchauffe", "la", "case"], []]);
});

test("les textes égaux : un seul morceau, sans marque", () => {
  const texte = "Brûle trois adversaires à 1 case.";
  assert.deepEqual(difference(texte, texte), { avant: [{ texte, retire: false }], apres: [{ texte, ajoute: false }] });
});

// La borne de difference.js (CASES_MAX, quatre millions de cases) : la table
// de la sous-suite porte (n + 1) × (m + 1) cases, n et m comptant les mots
// du milieu, hors le début et la fin communs. Les deux textes ont ici le même
// début et la même fin, et, au milieu, les mêmes mots communs, encadrés de
// mots qui diffèrent.
const COMMUNS = Array.from({ length: 1997 }, (_, k) => `m${k}`);
const milieu = (...mots) => `Début ${mots.join(" ")} fin.`;

test("la borne : juste sous elle, 2000 × 2000 cases, la sous-suite exacte", () => {
  // n = m = 1999 : (n + 1) × (m + 1) vaut la borne, sans la passer.
  const { retires, ajoutes } = comparer(milieu("a", ...COMMUNS, "z"), milieu("b", ...COMMUNS, "y"));
  assert.deepEqual(retires, ["a", "z"]);
  assert.deepEqual(ajoutes, ["b", "y"]);
});

test("la borne : juste au-dessus, 2000 × 2001 cases, tout le milieu marqué ; le début et la fin communs demeurent", () => {
  // Un mot de plus au texte suivant : n = 1999, m = 2000.
  const avant = milieu("a", ...COMMUNS, "z");
  const apres = milieu("b", ...COMMUNS, "y", "w");
  const { d, retires, ajoutes } = comparer(avant, apres);
  assert.deepEqual(retires, ["a", ...COMMUNS, "z"]);
  assert.deepEqual(ajoutes, ["b", ...COMMUNS, "y", "w"]);
  assert.deepEqual(d.avant[0], { texte: "Début ", retire: false });
  assert.deepEqual(d.apres.at(-1), { texte: " fin.", ajoute: false });
});
