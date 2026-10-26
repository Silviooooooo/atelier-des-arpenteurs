// Contrôles de l'accord des nombres (SPECIFICATION.md, § 6.2 et § 11) : la
// règle d'accorder, cas par cas ; decrire accorde sa sortie, une fois les
// nombres calculés ; une description montrée brute, avec ses « [N] », reste
// telle qu'écrite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accorder } from "../js/banque/accord.js";
import { importerFichier } from "../js/banque/importation.js";
import { cle } from "../js/banque/noms.js";
import { decrire, descriptionA, indexerCreation, valeursParametre } from "../js/personnage/calcul.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));

test("accorder — 2 ou plus en valeur absolue : la marque ; 1, 0, 1,5 et -1 : sans marque", () => {
  assert.equal(accorder("Se déplace de 1 case(s)."), "Se déplace de 1 case.");
  assert.equal(accorder("Se déplace de 2 case(s)."), "Se déplace de 2 cases.");
  assert.equal(accorder("Se déplace de 12 case(s)."), "Se déplace de 12 cases.");
  assert.equal(accorder("Se déplace de 0 case(s)."), "Se déplace de 0 case.");
  // Le signe moins : la valeur absolue compte.
  assert.equal(accorder("Recule de -2 case(s)."), "Recule de -2 cases.");
  assert.equal(accorder("Recule de -1 case(s)."), "Recule de -1 case.");
  // La virgule décimale : 1,5 est un seul nombre, plus petit que 2.
  assert.equal(accorder("Avance de 1,5 case(s)."), "Avance de 1,5 case.");
  assert.equal(accorder("Avance de 2,5 case(s)."), "Avance de 2,5 cases.");
  assert.equal(accorder("Avance de 0,5 case(s)."), "Avance de 0,5 case.");
});

test("accorder — le dernier nombre écrit avant le mot : dans « 2/4/8 », c'est 8 ; un nombre après le mot ne compte pas", () => {
  assert.equal(accorder("Inflige 2/4/8 point(s)."), "Inflige 2/4/8 points.");
  assert.equal(accorder("Inflige 4/2/1 point(s)."), "Inflige 4/2/1 point.");
  assert.equal(accorder("Sur 3 jets, garde 1 dé(s)."), "Sur 3 jets, garde 1 dé.");
  assert.equal(accorder("Une case(s) sur 3."), "Une case(s) sur 3.");
});

test("accorder — la phrase s'arrête à chacun des six signes : un nombre de la phrase d'avant ne compte pas", () => {
  for (const signe of [".", "!", "?", ";", ":", "\n"]) {
    assert.equal(accorder(`Lance 2 dés${signe} Puis une case(s) de plus.`), `Lance 2 dés${signe} Puis une case(s) de plus.`, JSON.stringify(signe));
    assert.equal(accorder(`Lance 2 dés${signe} Puis 1 case(s).`), `Lance 2 dés${signe} Puis 1 case.`, JSON.stringify(signe));
    assert.equal(accorder(`Lance 1 dé${signe} Puis 3 case(s).`), `Lance 1 dé${signe} Puis 3 cases.`, JSON.stringify(signe));
  }
  // Une virgule ne l'arrête pas.
  assert.equal(accorder("Lance 2 dés, puis avance d'autant de case(s)."), "Lance 2 dés, puis avance d'autant de cases.");
});

test("accorder — plusieurs marques, chacune à son nombre ; « (x) » ; sans nombre, le texte reste tel qu'écrit", () => {
  assert.equal(accorder("Inflige 1 point(s) à 3 cible(s) pendant 2 tour(s)."), "Inflige 1 point à 3 cibles pendant 2 tours.");
  assert.equal(accorder("Annulez 1 dégât(s) reçu(s)."), "Annulez 1 dégât reçu.");
  assert.equal(accorder("Annulez 3 dégât(s) reçu(s)."), "Annulez 3 dégâts reçus.");
  assert.equal(accorder("Rallume 1 feu(x)."), "Rallume 1 feu.");
  assert.equal(accorder("Rallume 2 feu(x)."), "Rallume 2 feux.");
  assert.equal(accorder("Rallume 2 feu(x) et 1 bijou(x)."), "Rallume 2 feux et 1 bijou.");
  // Sans nombre dans la phrase : la marque reste.
  assert.equal(accorder("Annulez X dégât(s) reçu(s)."), "Annulez X dégât(s) reçu(s).");
  assert.equal(accorder("Rallume des feu(x)."), "Rallume des feu(x).");
  assert.equal(accorder("Se déplace de [N] case(s)."), "Se déplace de [N] case(s).");
  // Une marque sans mot devant, un texte vide ou absent.
  assert.equal(accorder("Gagne 2 (s)."), "Gagne 2 (s).");
  assert.equal(accorder(""), "");
  assert.equal(accorder(null), "");
  assert.equal(accorder("Aucune marque, 2 cases."), "Aucune marque, 2 cases.");
});

test("decrire — accorde sa sortie, une fois les nombres calculés", () => {
  const variables = (nom, valeur) => new Map([[cle(nom), valeursParametre(nom, valeur, {})]]);
  assert.equal(decrire("Se déplace de [N] case(s).", new Map(), null, 1).texte, "Se déplace de 1 case.");
  assert.equal(decrire("Se déplace de [N] case(s).", new Map(), null, 2).texte, "Se déplace de 2 cases.");
  assert.equal(decrire("Atteint {portee} case(s).", variables("portee", "1"), null, 0).texte, "Atteint 1 case.");
  assert.equal(decrire("Atteint {portee} case(s).", variables("portee", "2"), null, 0).texte, "Atteint 2 cases.");
  assert.equal(decrire("Rallume [N] feu(x).", new Map(), null, 3).texte, "Rallume 3 feux.");
  // [X] se décide en jeu : aucun nombre, la marque reste.
  assert.equal(decrire("Annulez [X] dégât(s) reçu(s).", new Map(), null, 0).texte, "Annulez X dégât(s) reçu(s).");
  // Ce qui ne se calcule pas reste tel qu'écrit, marque comprise.
  const reste = decrire("Atteint {inconnu} case(s).", new Map(), null, 1);
  assert.deepEqual(reste, { texte: "Atteint {inconnu} case(s).", avertissements: ["« {inconnu} » n'a pas de valeur ici"] });
});

test("démonstration — les descriptions s'accordent au niveau ; la banque les garde brutes, avec leurs « [N] » et leurs marques", async () => {
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const index = indexerCreation(banque);
  const texte = (nom, options) => descriptionA(index, personnageEssai(), nom, options).texte;
  assert.equal(texte("Pas chassé", { niveau: 1 }), "Se déplace de 1 case.");
  assert.equal(texte("Pas chassé", { niveau: 2 }), "Se déplace de 2 cases.");
  assert.equal(texte("Braise", { niveau: 1 }), "Rallume 1 feu.");
  assert.equal(texte("Braise", { niveau: 3 }), "Rallume 3 feux.");
  assert.equal(texte("Maîtrise de l'agile", { niveau: 1 }), "Sans désavantage pour 1 capacité d'un objet Agile, en commençant par la première.");
  assert.equal(texte("Fournaise", { niveau: 3 }), "Aveugle une cible à 2 cases.");
  assert.equal(texte("Pas de côté"), "Annulez X dégât(s) reçu(s).");
  // Brutes : telles qu'écrites dans le classeur.
  const brute = (nom) => banque.capacites.find((c) => c.nom === nom).variantes[0].description;
  assert.equal(brute("Pas chassé"), "Se déplace de [N] case(s).");
  assert.equal(brute("Braise"), "Rallume [N] feu(x).");
  assert.equal(banque.elements.find((e) => e.nom === "Portée").description, "Atteint {portee} case(s).");
});
