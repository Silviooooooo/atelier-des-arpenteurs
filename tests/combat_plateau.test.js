// Contrôles du plateau du combat (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : les cases lues, la distance, les cases à portée et la pose
// d'office de js/combat/plateau.js.
//
// Chaque règle est vue des deux côtés : la case qui passe et sa voisine qui
// ne passe pas, la diagonale qui compte pour une case et non pour deux, la
// colonne pleine et celle qui ne l'est pas encore.

import { test } from "node:test";
import assert from "node:assert/strict";
import { caseDOffice, casesEntre, coordonnees, distance, lireCase } from "../js/combat/plateau.js";
import { COLONNES, COTE } from "../js/combat/regles.js";

const colonne = (lettre) => Array.from({ length: COTE }, (_, ligne) => `${lettre}${ligne + 1}`);
const toutes = [...COLONNES].flatMap(colonne);

test("lireCase : une case saisie se garde sous son nom, bords et casse tolérés", () => {
  assert.equal(lireCase("D4"), "D4");
  assert.equal(lireCase("d4"), "D4");
  assert.equal(lireCase("  j10\t"), "J10");
  assert.equal(lireCase("A1"), "A1");
  assert.equal(lireCase("a10"), "A10");
  for (const nom of toutes) assert.equal(lireCase(nom.toLowerCase()), nom);
});

test("lireCase : ce qui n'est pas une case du plateau n'est rien", () => {
  for (const texte of ["K1", "A0", "A11", "J11", "D 4", "D04", "4D", "", " ", "AA1", "D4.", "D-4", "D4 E5"]) {
    assert.equal(lireCase(texte), null, `« ${texte} »`);
  }
  for (const valeur of [null, undefined, 4, ["D4"], { case: "D4" }]) assert.equal(lireCase(valeur), null);
});

test("coordonnees : la colonne et la ligne, de 0 à 9", () => {
  assert.deepEqual(coordonnees("A1"), { colonne: 0, ligne: 0 });
  assert.deepEqual(coordonnees("D4"), { colonne: 3, ligne: 3 });
  assert.deepEqual(coordonnees("A10"), { colonne: 0, ligne: 9 });
  assert.deepEqual(coordonnees("J1"), { colonne: 9, ligne: 0 });
  assert.deepEqual(coordonnees("J10"), { colonne: 9, ligne: 9 });
});

test("coordonnees : un nom qui n'est pas exactement celui d'une case n'a pas de coordonnées", () => {
  for (const nom of ["d4", " D4", "K1", "A0", "A11", "", null, undefined, 12]) assert.equal(coordonnees(nom), null, String(nom));
});

test("distance : une diagonale compte pour une case (Tchebychev)", () => {
  assert.equal(distance("C3", "C3"), 0, "la même case");
  assert.equal(distance("C3", "C4"), 1);
  assert.equal(distance("C3", "D3"), 1);
  assert.equal(distance("C3", "D4"), 1, "une diagonale : une case, non deux");
  assert.equal(distance("C3", "B2"), 1);
  assert.equal(distance("G7", "E5"), 2, "deux diagonales : deux cases, non quatre");
  assert.equal(distance("C3", "F4"), 3, "le plus grand des deux écarts, non leur somme");
  assert.equal(distance("C3", "D7"), 4);
  assert.equal(distance("A1", "J10"), 9);
  assert.equal(distance("A1", "A10"), 9);
  assert.equal(distance("A10", "J1"), 9);
});

test("distance : la même dans les deux sens, pour toutes les cases", () => {
  for (const a of ["A1", "D4", "J10", "E10"]) {
    for (const b of toutes) {
      assert.equal(distance(a, b), distance(b, a));
      assert.equal(distance(a, b) === 0, a === b);
    }
  }
});

test("distance : une case qui n'en est pas une n'est à portée de rien", () => {
  assert.equal(distance("K1", "A1"), Infinity);
  assert.equal(distance("A1", "d4"), Infinity);
  assert.equal(distance(null, undefined), Infinity);
  assert.equal(distance("K1", "K1"), Infinity);
});

test("casesEntre : les cases à une distance de 1, autour d'une case du milieu", () => {
  assert.deepEqual(casesEntre("E5", 1, 1), ["D4", "D5", "D6", "E4", "E6", "F4", "F5", "F6"]);
});

test("casesEntre : les bornes sont comprises, et la case elle-même n'y est qu'à la distance 0", () => {
  assert.deepEqual(casesEntre("E5", 0, 0), ["E5"]);
  assert.equal(casesEntre("E5", 1, 2).length, 24);
  assert.ok(!casesEntre("E5", 1, 2).includes("E5"));
  assert.equal(casesEntre("E5", 0, 2).length, 25);
  assert.ok(casesEntre("E5", 1, 2).includes("G7"), "à 2, borne comprise");
  assert.ok(!casesEntre("E5", 1, 2).includes("H5"), "à 3, hors de la borne");
  assert.deepEqual(casesEntre("E5", 2, 2).filter((nom) => nom.startsWith("E")), ["E3", "E7"]);
});

test("casesEntre : rien ne sort du plateau", () => {
  assert.deepEqual(casesEntre("A1", 1, 1), ["A2", "B1", "B2"]);
  assert.deepEqual(casesEntre("J10", 1, 1), ["I9", "I10", "J9"]);
  assert.deepEqual(casesEntre("A10", 1, 1), ["A9", "B9", "B10"]);
  for (const nom of casesEntre("J10", 0, 99)) assert.ok(toutes.includes(nom));
});

test("casesEntre : l'ordre est A1, A2 … A10, B1 … J10", () => {
  assert.deepEqual(casesEntre("D4", 0, 9), toutes);
  assert.equal(toutes[1], "A2");
  assert.equal(toutes[9], "A10", "la ligne 10 vient après la ligne 9, non après la ligne 1");
  assert.equal(toutes[10], "B1");
  assert.equal(toutes[99], "J10");
});

test("casesEntre : chaque case rendue est à la distance dite, et aucune autre", () => {
  for (const depart of ["A1", "E5", "J3"]) {
    for (const [min, max] of [[1, 1], [1, 2], [2, 4], [0, 3]]) {
      const attendues = toutes.filter((nom) => distance(depart, nom) >= min && distance(depart, nom) <= max);
      assert.deepEqual(casesEntre(depart, min, max), attendues);
    }
  }
});

test("casesEntre : un départ hors du plateau, ou des bornes à l'envers, ne donnent rien", () => {
  assert.deepEqual(casesEntre("K1", 0, 9), []);
  assert.deepEqual(casesEntre("e5", 0, 9), []);
  assert.deepEqual(casesEntre("E5", 2, 1), []);
});

test("caseDOffice : un PJ se pose sur la colonne A, à la première ligne libre en partant de 1", () => {
  assert.equal(caseDOffice("pj", []), "A1");
  assert.equal(caseDOffice("pj", ["A1"]), "A2");
  assert.equal(caseDOffice("pj", ["A1", "A2", "A3"]), "A4");
  assert.equal(caseDOffice("pj", ["A1", "A3"]), "A2", "la première libre, non celle qui suit la dernière prise");
  assert.equal(caseDOffice("pj", ["A2", "B1", "J1"]), "A1");
});

test("caseDOffice : un adversaire se pose sur la colonne J", () => {
  assert.equal(caseDOffice("adv", []), "J1");
  assert.equal(caseDOffice("adv", ["J1"]), "J2");
  assert.equal(caseDOffice("adv", ["A1", "A2"]), "J1", "les cases des PJ ne le gênent pas là");
  assert.equal(caseDOffice("adv", ["J1", "J3"]), "J2");
});

test("caseDOffice : une case est prise dès que quelqu'un y est, de quelque camp qu'il soit", () => {
  // Les cases données sont celles de tous les protagonistes : un adversaire
  // déplacé en A1 prend la place d'office du premier PJ.
  assert.equal(caseDOffice("pj", ["A1"]), "A2");
  assert.equal(caseDOffice("adv", ["J1", "J1", "J1"]), "J2", "trois sur la même case n'en prennent qu'une");
});

test("caseDOffice : une colonne pleine passe à sa voisine (B, puis C… ; I, puis H…)", () => {
  assert.equal(caseDOffice("pj", colonne("A").slice(0, 9)), "A10", "il reste une ligne");
  assert.equal(caseDOffice("pj", colonne("A")), "B1");
  assert.equal(caseDOffice("pj", [...colonne("A"), "B1"]), "B2");
  assert.equal(caseDOffice("pj", [...colonne("A"), ...colonne("B")]), "C1");
  assert.equal(caseDOffice("adv", colonne("J").slice(0, 9)), "J10");
  assert.equal(caseDOffice("adv", colonne("J")), "I1");
  assert.equal(caseDOffice("adv", [...colonne("J"), ...colonne("I")]), "H1");
  assert.equal(caseDOffice("adv", [...colonne("J"), ...colonne("H")]), "I1", "la voisine d'abord");
});

test("caseDOffice : un nouvel exemplaire rejoint la case des siens, même occupée", () => {
  assert.equal(caseDOffice("adv", ["J1", "J2"], "J2"), "J2");
  assert.equal(caseDOffice("adv", ["J1", "D4"], "D4"), "D4", "où qu'on les ait déplacés");
  assert.equal(caseDOffice("adv", ["J1", "J2"], null), "J3", "sans les siens, la première case libre");
  assert.equal(caseDOffice("adv", ["J1", "J2"]), "J3");
});

test("caseDOffice : rien pour un camp inconnu, un plateau plein, ou une case des siens qui n'en est pas une", () => {
  assert.equal(caseDOffice("autre", []), null);
  assert.equal(caseDOffice("toString", []), null);
  assert.equal(caseDOffice("pj", toutes), null);
  assert.equal(caseDOffice("adv", toutes), null);
  assert.equal(caseDOffice("pj", toutes.filter((nom) => nom !== "J10")), "J10", "la dernière case libre");
  assert.equal(caseDOffice("adv", toutes.filter((nom) => nom !== "A10")), "A10");
  assert.equal(caseDOffice("adv", [], "K1"), null);
});
