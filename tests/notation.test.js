// Contrôles de la notation (SPECIFICATION.md, § 6.2 et § 11, domaine
// « Notation ») : chaque ligne du tableau du § 6.2, dont les accolades
// imbriquées et la virgule décimale ; une notation cassée donne E6 et garde
// le brut. Les exemples sont ceux de la spécification.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lireCapacites,
  lireElements,
  lireElementsPropres,
  lireParametres,
  lireParametresRecus,
  parametresInvoques,
} from "../js/banque/notation.js";

const sansAnomalie = (valeurs) => ({ valeurs, anomalies: [] });

test("capacites — liste séparée par des virgules", () => {
  assert.deepEqual(
    lireCapacites("Attaque de base, choc, visée"),
    sansAnomalie([
      { forme: "simple", nom: "Attaque de base" },
      { forme: "simple", nom: "choc" },
      { forme: "simple", nom: "visée" },
    ]),
  );
});

test("capacites — choix obligatoire ( a | b )", () => {
  assert.deepEqual(
    lireCapacites("(Loup solitaire | Attaque de meute)"),
    sansAnomalie([{ forme: "choix", options: ["Loup solitaire", "Attaque de meute"] }]),
  );
});

test("capacites — ensemble facultatif [ a | b ]", () => {
  assert.deepEqual(
    lireCapacites("[Cheville foulée | Doigt coupé]"),
    sansAnomalie([{ forme: "facultatif", options: ["Cheville foulée", "Doigt coupé"] }]),
  );
});

test("capacites — formes relevées : espaces intérieurs, choix d'une option, espace final", () => {
  assert.deepEqual(
    lireCapacites("a, ( b | c), (d), [e|f|g] "),
    sansAnomalie([
      { forme: "simple", nom: "a" },
      { forme: "choix", options: ["b", "c"] },
      { forme: "choix", options: ["d"] },
      { forme: "facultatif", options: ["e", "f", "g"] },
    ]),
  );
  assert.deepEqual(lireCapacites(""), sansAnomalie([]));
  assert.deepEqual(lireCapacites("a, , b,"), sansAnomalie([{ forme: "simple", nom: "a" }, { forme: "simple", nom: "b" }]));
});

test("éléments — liste, cible éventuelle entre parenthèses", () => {
  assert.deepEqual(
    lireElements("Arme, Dégâts(Attaque à mains nues)"),
    sansAnomalie([{ nom: "Arme" }, { nom: "Dégâts", cible: "Attaque à mains nues" }]),
  );
});

test("paramètres — {nom:valeur} séparés par des virgules", () => {
  assert.deepEqual(
    lireParametres("{degats:5/10/15}, {portee:0}"),
    sansAnomalie([
      { nom: "degats", valeur: "5/10/15", cible: null },
      { nom: "portee", valeur: "0", cible: null },
    ]),
  );
});

test("paramètres — valeur composée par /, gardée en chaîne", () => {
  assert.deepEqual(lireParametres("{armure:40/0/0/0/0/0}"), sansAnomalie([{ nom: "armure", valeur: "40/0/0/0/0/0", cible: null }]));
});

test("paramètres — accolades imbriquées et virgule décimale", () => {
  assert.deepEqual(
    lireParametres("{degats:{force}*0,5/{force}/{force}*2}, {portee:0}"),
    sansAnomalie([
      { nom: "degats", valeur: "{force}*0,5/{force}/{force}*2", cible: null },
      { nom: "portee", valeur: "0", cible: null },
    ]),
  );
});

test("paramètres — cible entre parenthèses après l'accolade", () => {
  assert.deepEqual(
    lireParametres("{degats:{force}*0,5/{force}/{force}*2}(Attaque à mains nues), {portee:1}(Attaque de base)"),
    sansAnomalie([
      { nom: "degats", valeur: "{force}*0,5/{force}/{force}*2", cible: "Attaque à mains nues" },
      { nom: "portee", valeur: "1", cible: "Attaque de base" },
    ]),
  );
});

test("éléments propres — nom, valeur éventuelle entre crochets", () => {
  assert.deepEqual(lireElementsPropres("Portee[1], Centré"), sansAnomalie([{ nom: "Portee", valeur: "1" }, { nom: "Centré" }]));
});

test("paramètres reçus — {nom} séparés par des virgules", () => {
  assert.deepEqual(lireParametresRecus("{portee}"), sansAnomalie(["portee"]));
  assert.deepEqual(lireParametresRecus("{degats}, {portee}"), sansAnomalie(["degats", "portee"]));
});

test("descriptions — [N], [N*{degats}], {portee} : les paramètres invoqués", () => {
  assert.deepEqual(parametresInvoques("[N] fois ; [N*{degats}] dégâts à {portee} pas, puis {portee}."), ["degats", "portee"]);
  assert.deepEqual(parametresInvoques("[N]"), []);
});

function assertE6(resultat, brut, raison) {
  assert.deepEqual(resultat.valeurs.filter((valeur) => "brut" in valeur), [{ brut }]);
  assert.equal(resultat.anomalies.length, 1);
  assert.equal(resultat.anomalies[0].code, "E6");
  assert.ok(resultat.anomalies[0].message.includes(`« ${brut} »`), resultat.anomalies[0].message);
  assert.match(resultat.anomalies[0].message, raison);
}

test("E6 — délimiteur jamais fermé : le brut est gardé, le reste lu", () => {
  const capacites = lireCapacites("Coup, (Recette | Grand-mère");
  assert.deepEqual(capacites.valeurs[0], { forme: "simple", nom: "Coup" });
  assertE6(capacites, "(Recette | Grand-mère", /parenthèse « \( » jamais fermée/);
  assertE6(lireParametres("{degats:2"), "{degats:2", /accolade « \{ » jamais fermée/);
  assertE6(lireElementsPropres("Tranchant[3"), "Tranchant[3", /crochet « \[ » jamais fermé/);
  assertE6(lireCapacites("a), b"), "a)", /« \) » sans « \( »/);
});

test("E6 — paramètre sans deux-points", () => {
  assertE6(lireParametres("{portee 3}"), "{portee 3}", /paramètre sans « : »/);
});

test("E6 — autres notations illisibles, toujours gardées", () => {
  assertE6(lireParametres("portee:3"), "portee:3", /s'écrit \{nom:valeur\}/);
  assertE6(lireParametres("{:3}"), "{:3}", /nom de paramètre vide/);
  assertE6(lireParametres("{portee:}"), "{portee:}", /sans valeur/);
  assertE6(lireParametres("{a:1}{b:2}"), "{a:1}{b:2}", /seule une cible/);
  assertE6(lireCapacites("(a | )"), "(a | )", /option vide/);
  assertE6(lireCapacites("a | b"), "a | b", /forme non reconnue/);
  assertE6(lireElements("Dégâts[1]"), "Dégâts[1]", /forme non reconnue/);
  assertE6(lireParametresRecus("portee"), "portee", /s'écrit \{nom\}/);
});

test("A7 — choix écrit dans la colonne des paramètres : lu, gardé tel quel, signalé", () => {
  const resultat = lireParametres("(Loup solitaire|Attaque de meute)");
  assert.deepEqual(resultat.valeurs, [{ brut: "(Loup solitaire|Attaque de meute)" }]);
  assert.deepEqual(resultat.anomalies.map((anomalie) => anomalie.code), ["A7"]);
  assert.deepEqual(lireElements("[a | b]").anomalies.map((anomalie) => anomalie.code), ["A7"]);
});

test("jamais d'exception ; chaque brut gardé est signalé, et seulement lui", () => {
  const signes = ["a", "b", " ", ",", "|", ":", "(", ")", "[", "]", "{", "}", "*", "/", "0,5", "é"];
  let graine = 7;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const lecteurs = [lireCapacites, lireElements, lireParametres, lireElementsPropres, lireParametresRecus];
  for (let essai = 0; essai < 3000; essai += 1) {
    const texte = Array.from({ length: 1 + Math.floor(hasard() * 14) }, () => signes[Math.floor(hasard() * signes.length)]).join("");
    for (const lecteur of lecteurs) {
      const { valeurs, anomalies } = lecteur(texte);
      const bruts = valeurs.filter((valeur) => typeof valeur === "object" && "brut" in valeur);
      assert.equal(bruts.length, anomalies.length, `${lecteur.name}(${JSON.stringify(texte)})`);
      bruts.forEach(({ brut }, i) => assert.ok(anomalies[i].message.startsWith(`« ${brut} »`), `${lecteur.name}(${JSON.stringify(texte)})`));
    }
    assert.doesNotThrow(() => parametresInvoques(texte));
  }
  for (const lecteur of lecteurs) assert.deepEqual(lecteur(undefined), sansAnomalie([]));
});
