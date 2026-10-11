// Contrôles des adresses, de la recherche et de ce que les fiches affichent
// (SPECIFICATION.md, § 5.2, § 9 et § 16.6). Les écrans eux-mêmes s'essaient
// à la main, dans le navigateur, d'après la liste d'essais du compte rendu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MESSAGE_BANQUE_SANS_ADVERSAIRES, entreesDe, indexer, listeDe, manqueDe } from "../js/banque/consultation.js";
import { importerFichier } from "../js/banque/importation.js";
import { TEXTES, filtrer, pourRecherche } from "../js/banque/recherche.js";
import { CATEGORIES, adresseAnomalies, adresseFiche, adresseListe, lireRoute, rubriqueDe } from "../js/routes.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));
const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
// Une banque publiée avant le lot 3 : ni adversaires, ni types.
const { types_adversaires: _types, adversaires: _adversaires, ...AVANT_LOT_3 } = banque;

test("routes — l'adresse d'une fiche se décode (§ 9)", () => {
  assert.deepEqual(lireRoute("#/capacite/Attaque%20de%20base"), { ecran: "fiche", categorie: "capacites", nom: "Attaque de base" });
  assert.deepEqual(lireRoute("#/bloc/Po%C3%AAle%20en%20fonte"), { ecran: "fiche", categorie: "blocs", nom: "Poêle en fonte" });
  assert.deepEqual(lireRoute("#/element/Port%C3%A9e"), { ecran: "fiche", categorie: "elements", nom: "Portée" });
  // Un navigateur peut laisser le nom en clair dans l'adresse.
  assert.deepEqual(lireRoute("#/capacite/Attaque de base"), { ecran: "fiche", categorie: "capacites", nom: "Attaque de base" });
  // Les adversaires et leurs types (§ 16.6) : la catégorie « types » n'est pas la clé de la banque.
  assert.deepEqual(lireRoute("#/adversaire/Chef%20de%20partie"), { ecran: "fiche", categorie: "adversaires", nom: "Chef de partie" });
  assert.deepEqual(lireRoute("#/type/R%C3%B4tisseur"), { ecran: "fiche", categorie: "types", nom: "Rôtisseur" });
});

test("routes — aller-retour des noms difficiles", () => {
  assert.deepEqual(Object.keys(CATEGORIES), ["blocs", "capacites", "elements", "adversaires", "types"]);
  for (const nom of ["Attaque de base", "Constellation d'Enaël", "Maîtrise du combat précis", "50 % / 100 %", "a#b?c&d", "Œil (de) [lynx]", "trouvé !", "Humain/Brigand[2]", "<b>Marmiton</b>", "__proto__"]) {
    for (const categorie of Object.keys(CATEGORIES)) {
      const adresse = adresseFiche(categorie, nom);
      assert.match(adresse, /^#\/(bloc|capacite|element|adversaire|type)\/[^ #?<>]+$/);
      assert.deepEqual(lireRoute(adresse), { ecran: "fiche", categorie, nom });
    }
  }
  assert.equal(adresseFiche("capacites", "Attaque de base"), "#/capacite/Attaque%20de%20base");
  assert.equal(adresseFiche("adversaires", "Marmiton de corvée"), "#/adversaire/Marmiton%20de%20corv%C3%A9e");
  assert.equal(adresseFiche("types", "Brigand"), "#/type/Brigand");
  // Un demi-codet seul ne fait pas lever la fabrication de l'adresse (relecture du lot 3) ; une paire reste entière.
  const [haut, bas] = [String.fromCharCode(0xd800), String.fromCharCode(0xdc00)];
  assert.throws(() => encodeURIComponent(haut), URIError, "le défaut que l'adresse évite");
  assert.equal(adresseFiche("adversaires", `Fant${haut}me`), "#/adversaire/Fant%EF%BF%BDme");
  assert.equal(adresseFiche("adversaires", bas), "#/adversaire/%EF%BF%BD");
  assert.deepEqual(lireRoute(adresseFiche("adversaires", "Dragon 🐉")), { ecran: "fiche", categorie: "adversaires", nom: "Dragon 🐉" });
});

test("routes — accueil, listes, anomalies, auteur, rencontre, et les adresses abîmées", () => {
  for (const adresse of ["", "#", "#/", null]) assert.deepEqual(lireRoute(adresse), { ecran: "accueil" });
  for (const categorie of Object.keys(CATEGORIES)) assert.deepEqual(lireRoute(adresseListe(categorie)), { ecran: "liste", categorie });
  assert.deepEqual([lireRoute("#/adversaires"), lireRoute("#/types")], [{ ecran: "liste", categorie: "adversaires" }, { ecran: "liste", categorie: "types" }]);
  assert.deepEqual(lireRoute("#/anomalies"), { ecran: "anomalies" });
  assert.deepEqual(lireRoute(adresseAnomalies("Blocs", 14)), { ecran: "anomalies", feuille: "Blocs", ligne: 14 });
  assert.deepEqual(lireRoute(adresseAnomalies("Eléments", 3)), { ecran: "anomalies", feuille: "Eléments", ligne: 3 });
  // La feuille Adversaires a ses anomalies, et leur adresse (§ 16.6).
  assert.equal(adresseAnomalies("Adversaires", 3), "#/anomalies/Adversaires/3");
  assert.deepEqual(lireRoute("#/anomalies/Adversaires/3"), { ecran: "anomalies", feuille: "Adversaires", ligne: 3 });
  assert.equal(adresseAnomalies(), "#/anomalies");
  assert.deepEqual(lireRoute("#/auteur"), { ecran: "auteur" });
  assert.deepEqual(lireRoute("#/rencontre"), { ecran: "rencontre" });
  // Les noms d'Object.prototype ne sont ni des listes ni des fiches.
  const prototype = ["#/constructor", "#/__proto__", "#/__proto__/x", "#/toString", "#/hasOwnProperty", "#/valueOf/abc", "#/anomalies/constructor/3"];
  const adversaires = ["#/adversaire", "#/adversaire/", "#/adversaire/%E0%A4%A", "#/adversaires/Chef", "#/type/", "#/types/Commis", "#/rencontre/2", "#/rencontres", "#/anomalies/adversaires/3", "#/anomalies/Adversaires/-1"];
  for (const abimee of ["#/bloc/%E0%A4%A", "#/bloc/", "#/sorts", "#/anomalies/Blocs/x", "#/anomalies/Inconnue/3", "#/auteur/cle", ...prototype, ...adversaires]) {
    assert.equal(lireRoute(abimee).ecran, "introuvable", abimee);
  }
});

test("routes — chaque écran marque son lien de la navigation ; les types marquent « Adversaires »", () => {
  const marque = (adresse) => rubriqueDe(lireRoute(adresse));
  assert.deepEqual(
    ["#/blocs", "#/bloc/Louche", "#/capacites", "#/elements", "#/anomalies", "#/anomalies/Adversaires/3", "#/auteur"].map(marque),
    ["blocs", "blocs", "capacites", "elements", "anomalies", "anomalies", "auteur"],
  );
  assert.deepEqual(["#/adversaires", "#/adversaire/Chef%20de%20partie", "#/types", "#/type/Commis"].map(marque), Array(4).fill("adversaires"));
  assert.equal(marque("#/rencontre"), "rencontre");
  const id = "demo-aubepine-0000000001";
  assert.deepEqual(["#/personnages", `#/personnage/${id}`, `#/personnage/${id}/etape/3`, "#/recevoir/abc"].map(marque), Array(4).fill("personnages"));
  // La navigation de la page porte un lien par rubrique, et rien que des routes.
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const liens = [...page.matchAll(/<li><a href="(#\/[a-z]+)" data-route="([a-z]+)">([^<]+)<\/a><\/li>/g)].map(([, href, route, texte]) => [href, route, texte]);
  assert.deepEqual(liens, [
    ["#/blocs", "blocs", "Blocs"],
    ["#/capacites", "capacites", "Capacités"],
    ["#/elements", "elements", "Éléments"],
    ["#/adversaires", "adversaires", "Adversaires"],
    ["#/rencontre", "rencontre", "Rencontre"],
    ["#/personnages", "personnages", "Personnages"],
    ["#/anomalies", "anomalies", "Anomalies"],
    ["#/auteur", "auteur", "Auteur"],
  ]);
  for (const [href, route] of liens) assert.equal(marque(href), route, href);
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

test("recherche — un adversaire se trouve par son nom, ses types, son équipement et ses capacités, tels qu'il les écrit ; un type par son nom", () => {
  const adversaires = (requete) => filtrer(banque.adversaires, requete, TEXTES.adversaires).map((a) => a.nom);
  const types = (requete) => filtrer(banque.types_adversaires, requete, TEXTES.types).map((t) => t.nom);
  assert.deepEqual(adversaires("HOMARD"), ["Homard furieux"]);
  assert.deepEqual(adversaires("corvee"), ["Marmiton de corvée"]);
  // La colonne Type, multiplicateur compris.
  assert.deepEqual(adversaires("rotisseur"), ["Marmiton de corvée", "Chef de partie", "Plongeur"]);
  assert.deepEqual(adversaires("1,4"), ["Chef de partie"]);
  assert.deepEqual(adversaires("carapace toque"), ["Homard furieux"]);
  assert.deepEqual(adversaires("nez fin"), ["Mouette chapardeuse"]);
  // Ce qu'un adversaire hérite n'est pas écrit dans sa ligne : la spatule est celle du type.
  assert.deepEqual(adversaires("spatule"), []);
  assert.equal(adversaires("").length, banque.adversaires.length);
  assert.deepEqual(types("rot"), ["Rôtisseur"]);
  assert.deepEqual(types("spatule"), []);
  // Une ligne sans ces cellules (banque abîmée) ne lève rien.
  assert.deepEqual(filtrer([{ nom: "Nu" }], "nu", TEXTES.adversaires), [{ nom: "Nu" }]);
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

test("fiches — l'index range les adversaires et leurs types, résolus comme tout renvoi, et garde leur résolution", () => {
  const index = indexer(banque);
  assert.equal(index.entrees("adversaires", "Chef de partie").length, 1);
  assert.equal(index.entrees("types", "Commis")[0].brut.ligne, 2);
  assert.deepEqual(index.entrees("adversaires", "Commis"), [], "un type n'est pas un adversaire");
  assert.equal(index.resoudre("adversaires", "chef de PARTIE"), "Chef de partie");
  assert.equal(index.resoudre("types", "rotisseur"), "Rôtisseur");
  assert.equal(index.resoudre("types", "Sous-chef"), null);
  // La feuille porte deux sortes de lignes : chacune mène à sa fiche.
  assert.deepEqual(index.entreeDeLigne("Adversaires", 3), { categorie: "types", nom: "Rôtisseur" });
  assert.deepEqual(index.entreeDeLigne("Adversaires", 5), { categorie: "adversaires", nom: "Chef de partie" });
  assert.equal(index.entreeDeLigne("Adversaires", 99), null);
  assert.deepEqual(index.anomaliesDe("Adversaires", 8).map((a) => a.code), ["A15"]);
  // L'index de résolution se fait une fois par banque.
  assert.equal(index.adversaires(), index.adversaires());
  assert.equal(index.adversaires().resoudre(index.entrees("adversaires", "Chef de partie")[0]).attaque.valeur, 5);
  assert.deepEqual(index.adversaires().utilisateurs("Commis"), ["Marmiton de corvée", "Chef de partie", "Plongeur"]);
  // Les noms d'Object.prototype ne sont pas des entrées.
  for (const nom of ["constructor", "__proto__", "toString"]) assert.deepEqual(index.entrees("adversaires", nom), [], nom);
  // La liste d'une catégorie : la clé de la banque n'est pas toujours son nom.
  assert.deepEqual(entreesDe(banque, "types"), banque.types_adversaires);
  assert.deepEqual(entreesDe(banque, "adversaires"), banque.adversaires);
  assert.equal(entreesDe(banque, "adversaires")[0], banque.adversaires[0], "les entrées mêmes de la banque");
  assert.equal(entreesDe(banque, "blocs"), banque.blocs);
  assert.deepEqual(listeDe(banque, "adversaires").map((a) => a.nom), ["Chef de partie", "Homard furieux", "Marmiton de corvée", "Mouette chapardeuse", "Plongeur"]);
  assert.deepEqual(listeDe({ adversaires: [{ nom: "b" }, { nom: "A" }, { nom: "b" }] }, "adversaires").map((a) => a.nom), ["A", "b"], "une entrée par nom");
  assert.equal(manqueDe(banque, "adversaires"), null);
});

test("fiches — une banque publiée avant le lot 3 s'indexe sans exception, et dit ce qui lui manque", () => {
  assert.equal(Object.hasOwn(AVANT_LOT_3, "adversaires") || Object.hasOwn(AVANT_LOT_3, "types_adversaires"), false);
  const index = indexer(AVANT_LOT_3);
  assert.equal(index.resoudre("capacites", "coup de poele"), "Coup de poêle", "le reste se consulte comme avant");
  for (const categorie of ["adversaires", "types"]) {
    assert.deepEqual(entreesDe(AVANT_LOT_3, categorie), []);
    assert.deepEqual(listeDe(AVANT_LOT_3, categorie), []);
    assert.deepEqual(index.entrees(categorie, "Chef de partie"), []);
    assert.equal(index.resoudre(categorie, "Chef de partie"), null);
    assert.equal(manqueDe(AVANT_LOT_3, categorie), MESSAGE_BANQUE_SANS_ADVERSAIRES);
  }
  assert.equal(MESSAGE_BANQUE_SANS_ADVERSAIRES, "Les adversaires ont besoin d'une banque republiée depuis le classeur à jour.");
  for (const categorie of ["blocs", "capacites", "elements"]) assert.equal(manqueDe(AVANT_LOT_3, categorie), null, categorie);
  assert.equal(index.entreeDeLigne("Adversaires", 3), null);
  assert.deepEqual(index.adversaires().utilisateurs("Commis"), []);
  assert.equal(index.adversaires().adversaires.size, 0);
  // Une seule des deux listes : la banque n'est pas celle d'un classeur à jour.
  assert.equal(manqueDe({ ...AVANT_LOT_3, adversaires: [] }, "types"), MESSAGE_BANQUE_SANS_ADVERSAIRES);
  // Une feuille Adversaires absente (I4) laisse deux listes vides : rien ne manque.
  assert.equal(manqueDe({ ...AVANT_LOT_3, adversaires: [], types_adversaires: [] }, "adversaires"), null);
});
