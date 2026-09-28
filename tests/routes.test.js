// Contrôles des adresses, de la recherche et de ce que les fiches affichent
// (SPECIFICATION.md, § 5.2 et § 9). Les écrans eux-mêmes s'essaient à la
// main, dans le navigateur, d'après la liste d'essais du compte rendu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexer } from "../js/banque/consultation.js";
import { importerFichier } from "../js/banque/importation.js";
import { TEXTES, filtrer, pourRecherche } from "../js/banque/recherche.js";
import { adresseAnomalies, adresseFiche, adresseListe, lireRoute } from "../js/routes.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));
const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");

test("routes — l'adresse d'une fiche se décode (§ 9)", () => {
  assert.deepEqual(lireRoute("#/capacite/Attaque%20de%20base"), { ecran: "fiche", categorie: "capacites", nom: "Attaque de base" });
  assert.deepEqual(lireRoute("#/bloc/Po%C3%AAle%20en%20fonte"), { ecran: "fiche", categorie: "blocs", nom: "Poêle en fonte" });
  assert.deepEqual(lireRoute("#/element/Port%C3%A9e"), { ecran: "fiche", categorie: "elements", nom: "Portée" });
  // Un navigateur peut laisser le nom en clair dans l'adresse.
  assert.deepEqual(lireRoute("#/capacite/Attaque de base"), { ecran: "fiche", categorie: "capacites", nom: "Attaque de base" });
});

test("routes — aller-retour des noms difficiles", () => {
  for (const nom of ["Attaque de base", "Constellation d'Enaël", "Maîtrise du combat précis", "50 % / 100 %", "a#b?c&d", "Œil (de) [lynx]", "trouvé !"]) {
    for (const categorie of ["blocs", "capacites", "elements"]) {
      const adresse = adresseFiche(categorie, nom);
      assert.match(adresse, /^#\/(bloc|capacite|element)\/[^ #?]+$/);
      assert.deepEqual(lireRoute(adresse), { ecran: "fiche", categorie, nom });
    }
  }
  assert.equal(adresseFiche("capacites", "Attaque de base"), "#/capacite/Attaque%20de%20base");
});

test("routes — accueil, listes, anomalies, auteur, et les adresses abîmées", () => {
  for (const adresse of ["", "#", "#/", null]) assert.deepEqual(lireRoute(adresse), { ecran: "accueil" });
  for (const categorie of ["blocs", "capacites", "elements"]) assert.deepEqual(lireRoute(adresseListe(categorie)), { ecran: "liste", categorie });
  assert.deepEqual(lireRoute("#/anomalies"), { ecran: "anomalies" });
  assert.deepEqual(lireRoute(adresseAnomalies("Blocs", 14)), { ecran: "anomalies", feuille: "Blocs", ligne: 14 });
  assert.deepEqual(lireRoute(adresseAnomalies("Eléments", 3)), { ecran: "anomalies", feuille: "Eléments", ligne: 3 });
  assert.equal(adresseAnomalies(), "#/anomalies");
  assert.deepEqual(lireRoute("#/auteur"), { ecran: "auteur" });
  for (const abimee of ["#/bloc/%E0%A4%A", "#/bloc/", "#/sorts", "#/anomalies/Blocs/x", "#/anomalies/Inconnue/3", "#/auteur/cle"]) {
    assert.equal(lireRoute(abimee).ecran, "introuvable", abimee);
  }
});

test("recherche — sans casse ni accents, sur les noms et les descriptions", () => {
  assert.equal(pourRecherche("  Épée   LONGUE "), "epee longue");
  assert.equal(pourRecherche("Cœur d’Enaël"), "coeur d'enael");
  const blocs = (requete) => filtrer(banque.blocs, requete, TEXTES.blocs).map((b) => b.nom);
  const capacites = (requete) => filtrer(banque.capacites, requete, TEXTES.capacites).map((c) => c.nom);
  const elements = (requete) => filtrer(banque.elements, requete, TEXTES.elements).map((e) => e.nom);
  assert.deepEqual(blocs("ECUMOIRE"), ["Écumoire"]);
  assert.deepEqual(blocs("poele"), ["Poêle en fonte"]);
  assert.equal(blocs("").length, banque.blocs.length);
  // Les mots se cherchent chacun, dans n'importe quel ordre.
  assert.deepEqual(capacites("louche coup"), ["Coup de louche"]);
  // La description compte, pour chaque variante.
  assert.deepEqual(capacites("doublon puissance"), ["Sauce piquante"]);
  assert.deepEqual(capacites("recommence"), ["Jet de sel"]);
  assert.deepEqual(elements("englue"), ["Collant"]);
  assert.deepEqual(elements("introuvable"), []);
});

test("fiches — renvois résolus comme au contrôle, cassés sinon", () => {
  const index = indexer(banque);
  assert.equal(index.resoudre("capacites", "Coup de louche"), "Coup de louche");
  assert.equal(index.resoudre("capacites", "coup de poele"), "Coup de poêle");
  assert.equal(index.resoudre("elements", "brulant"), "Brûlant");
  assert.equal(index.resoudre("capacites", "Omelette fantôme"), null);
  assert.equal(index.entrees("blocs", "Louche d'acier").length, 2);
  assert.deepEqual(index.entrees("blocs", "inconnu"), []);
});

test("fiches — « octroyée par », « porté par », nom affiché (§ 5.2, § 9)", () => {
  const index = indexer(banque);
  assert.deepEqual(index.octroyeePar("Sauce piquante"), [
    { bloc: "Rouleau à pâtisserie", forme: "choix" },
    { bloc: "Marmite hurlante", forme: "simple" },
  ]);
  assert.deepEqual(index.octroyeePar("Brûlure légère"), [{ bloc: "Tablier", forme: "facultatif" }]);
  // Une cible ne rattache pas (A3) : Crêpe volante n'est octroyée par rien.
  assert.deepEqual(index.octroyeePar("Plat oublié"), []);
  // Salé n'est porté que par un paramètre transmis (A4).
  assert.deepEqual(index.portePar("Salé"), { blocs: ["Marmite hurlante"], capacites: [] });
  // Le paramètre illisible d'Écumoire (E6) ne porte rien.
  assert.deepEqual(index.portePar("Distance"), { blocs: ["Louche d'acier", "Hachoir"], capacites: ["Jet de sel"] });
  assert.deepEqual(index.portePar("Oublié"), { blocs: [], capacites: [] });
  assert.equal(index.nomAffiche("chaleur"), "Brûlant");
  assert.equal(index.nomAffiche("piment"), "piment");
});

test("fiches — les anomalies d'une ligne, et la fiche d'une ligne", () => {
  const index = indexer(banque);
  assert.deepEqual(index.anomaliesDe("Blocs", 7).map((a) => a.code), ["E4", "E4"]);
  assert.deepEqual(index.anomaliesDe("Blocs", 2), []);
  assert.deepEqual(index.entreeDeLigne("Blocs", 7), { categorie: "blocs", nom: "Poêle en fonte" });
  assert.deepEqual(index.entreeDeLigne("Capacites", 6), { categorie: "capacites", nom: "Sauce piquante" });
  assert.deepEqual(index.entreeDeLigne("Eléments", 3), { categorie: "elements", nom: "Brûlant" });
  assert.equal(index.entreeDeLigne("Blocs", 99), null);
});
