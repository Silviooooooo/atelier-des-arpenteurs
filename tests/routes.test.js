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
import { avecAdversaires } from "./outils/adversaires_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";

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
  // Les adversaires et leurs classes (§ 16.6) : la catégorie « types » n'est pas la clé de la banque.
  assert.deepEqual(lireRoute("#/adversaire/Chef%20de%20partie"), { ecran: "fiche", categorie: "adversaires", nom: "Chef de partie" });
  assert.deepEqual(lireRoute("#/classe/R%C3%B4tisseur"), { ecran: "fiche", categorie: "types", nom: "Rôtisseur" });
  // L'adresse d'avant le lot 5, qu'un lien envoyé peut porter, mène à la même fiche.
  assert.deepEqual(lireRoute("#/type/R%C3%B4tisseur"), { ecran: "fiche", categorie: "types", nom: "Rôtisseur" });
});

test("routes — aller-retour des noms difficiles", () => {
  assert.deepEqual(Object.keys(CATEGORIES), ["blocs", "capacites", "elements", "adversaires", "types"]);
  for (const nom of ["Attaque de base", "Constellation d'Enaël", "Maîtrise du combat précis", "50 % / 100 %", "a#b?c&d", "Œil (de) [lynx]", "trouvé !", "Hachoir/Saucier[2]", "<b>Marmiton</b>", "__proto__"]) {
    for (const categorie of Object.keys(CATEGORIES)) {
      const adresse = adresseFiche(categorie, nom);
      assert.match(adresse, /^#\/(bloc|capacite|element|adversaire|classe)\/[^ #?<>]+$/);
      assert.deepEqual(lireRoute(adresse), { ecran: "fiche", categorie, nom });
    }
  }
  assert.equal(adresseFiche("capacites", "Attaque de base"), "#/capacite/Attaque%20de%20base");
  assert.equal(adresseFiche("adversaires", "Marmiton de corvée"), "#/adversaire/Marmiton%20de%20corv%C3%A9e");
  assert.equal(adresseFiche("types", "Saucier"), "#/classe/Saucier");
  // Un demi-codet seul ne fait pas lever la fabrication de l'adresse (relecture du lot 3) ; une paire reste entière.
  const [haut, bas] = [String.fromCharCode(0xd800), String.fromCharCode(0xdc00)];
  assert.throws(() => encodeURIComponent(haut), URIError, "le défaut que l'adresse évite");
  assert.equal(adresseFiche("adversaires", `Fant${haut}me`), "#/adversaire/Fant%EF%BF%BDme");
  assert.equal(adresseFiche("adversaires", bas), "#/adversaire/%EF%BF%BD");
  assert.deepEqual(lireRoute(adresseFiche("adversaires", "Dragon 🐉")), { ecran: "fiche", categorie: "adversaires", nom: "Dragon 🐉" });
});

test("routes — accueil, listes, anomalies, auteur, rencontre, combat, apparence, et les adresses abîmées", () => {
  for (const adresse of ["", "#", "#/", null]) assert.deepEqual(lireRoute(adresse), { ecran: "accueil" });
  for (const categorie of Object.keys(CATEGORIES)) assert.deepEqual(lireRoute(adresseListe(categorie)), { ecran: "liste", categorie });
  assert.deepEqual([lireRoute("#/adversaires"), lireRoute("#/classes")], [{ ecran: "liste", categorie: "adversaires" }, { ecran: "liste", categorie: "types" }]);
  // Les classes (lot 5) : l'adresse neuve s'écrit, l'ancienne se lit encore.
  assert.deepEqual([adresseListe("types"), adresseListe("adversaires")], ["#/classes", "#/adversaires"]);
  assert.deepEqual(lireRoute("#/types"), { ecran: "liste", categorie: "types" });
  assert.deepEqual(lireRoute("#/anomalies"), { ecran: "anomalies" });
  assert.deepEqual(lireRoute(adresseAnomalies("Blocs", 14)), { ecran: "anomalies", feuille: "Blocs", ligne: 14 });
  assert.deepEqual(lireRoute(adresseAnomalies("Eléments", 3)), { ecran: "anomalies", feuille: "Eléments", ligne: 3 });
  // La feuille Adversaires a ses anomalies, et leur adresse (§ 16.6).
  assert.equal(adresseAnomalies("Adversaires", 3), "#/anomalies/Adversaires/3");
  assert.deepEqual(lireRoute("#/anomalies/Adversaires/3"), { ecran: "anomalies", feuille: "Adversaires", ligne: 3 });
  assert.equal(adresseAnomalies(), "#/anomalies");
  assert.deepEqual(lireRoute("#/auteur"), { ecran: "auteur" });
  assert.deepEqual(lireRoute("#/rencontre"), { ecran: "rencontre" });
  // Le simulateur de combat (§ 17) : une seule adresse, qui ne porte rien du combat en cours.
  assert.deepEqual(lireRoute("#/combat"), { ecran: "combat" });
  assert.deepEqual(lireRoute("#combat"), { ecran: "combat" }, "sans la barre, comme les autres écrans");
  // La page Apparence (lot 5) : une seule adresse ; le thème ne s'y lit pas.
  assert.deepEqual(lireRoute("#/apparence"), { ecran: "apparence" });
  const apparences = ["#/apparence/", "#/apparence/taverne", "#/apparences", "#/Apparence", "#/apparence%20", "#/theme", "#/auteur/apparence"];
  const combats = ["#/combat/", "#/combat/2", "#/combat/demo", "#/combat/Chef%20de%20partie", "#/combats", "#/Combat", "#/combat%20", "#/ combat", "#/rencontre/combat", "#/combat?demo=1"];
  // Les noms d'Object.prototype ne sont ni des listes ni des fiches.
  const prototype = ["#/constructor", "#/__proto__", "#/__proto__/x", "#/toString", "#/hasOwnProperty", "#/valueOf/abc", "#/anomalies/constructor/3"];
  const adversaires = ["#/adversaire", "#/adversaire/", "#/adversaire/%E0%A4%A", "#/adversaires/Chef", "#/type/", "#/types/Commis", "#/classe/", "#/classes/Commis", "#/classe", "#/Classes", "#/rencontre/2", "#/rencontres", "#/anomalies/adversaires/3", "#/anomalies/Adversaires/-1"];
  for (const abimee of ["#/bloc/%E0%A4%A", "#/bloc/", "#/sorts", "#/anomalies/Blocs/x", "#/anomalies/Inconnue/3", "#/auteur/cle", ...prototype, ...adversaires, ...combats, ...apparences]) {
    assert.equal(lireRoute(abimee).ecran, "introuvable", abimee);
  }
});

test("routes — chaque écran marque son lien de la navigation ; les classes marquent « Adversaires »", () => {
  const marque = (adresse) => rubriqueDe(lireRoute(adresse));
  assert.deepEqual(
    ["#/blocs", "#/bloc/Louche", "#/capacites", "#/elements", "#/anomalies", "#/anomalies/Adversaires/3", "#/auteur"].map(marque),
    ["blocs", "blocs", "capacites", "elements", "anomalies", "anomalies", "auteur"],
  );
  assert.deepEqual(["#/adversaires", "#/adversaire/Chef%20de%20partie", "#/classes", "#/classe/Commis", "#/types", "#/type/Commis"].map(marque), Array(6).fill("adversaires"));
  assert.equal(marque("#/rencontre"), "rencontre");
  // Le combat a sa rubrique à lui (§ 17) : ni celle de la rencontre, ni celle des adversaires.
  assert.equal(marque("#/combat"), "combat");
  assert.equal(marque("#/combat/2"), "introuvable", "une adresse abîmée ne marque aucun lien");
  // La page Apparence marque son lien, le dernier du menu (lot 5).
  assert.equal(marque("#/apparence"), "apparence");
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
    ["#/combat", "combat", "Combat"],
    ["#/personnages", "personnages", "Personnages"],
    ["#/anomalies", "anomalies", "Anomalies"],
    ["#/auteur", "auteur", "Auteur"],
    ["#/apparence", "apparence", "Apparence"],
  ]);
  for (const [href, route] of liens) assert.equal(marque(href), route, href);
  // Le motif ne lit qu'une forme : un lien écrit autrement manquerait à la liste, et se verrait.
  assert.equal(page.match(/<a\b[^>]*data-route=/g).length, liens.length, "un lien de la navigation n'a pas la forme attendue");
  assert.equal(liens.findIndex(([, route]) => route === "combat"), liens.findIndex(([, route]) => route === "rencontre") + 1, "« Combat » suit « Rencontre »");
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
  // Les écrans cherchent aussi dans ce qu'il porte une fois résolu (l'index de la consultation) : ce qu'il hérite de
  // ses types, les capacités que donne son équipement, les pièces d'un pack. Le champ dit « équipement ou capacité ».
  const index = indexer(banque);
  const porteurs = (requete) => filtrer(banque.adversaires, requete, index.textesAdversaire).map((a) => a.nom);
  assert.deepEqual(porteurs("spatule"), ["Marmiton de corvée", "Chef de partie"]);
  assert.deepEqual(porteurs("frappe"), ["Marmiton de corvée", "Chef de partie", "Homard furieux", "Mouette chapardeuse"]);
  assert.deepEqual(porteurs("emincer"), ["Homard furieux"]);
  assert.deepEqual(porteurs("tablier"), ["Marmiton de corvée", "Chef de partie"]);
  assert.deepEqual(porteurs("maitrise agile"), ["Marmiton de corvée", "Chef de partie", "Plongeur"]);
  // Ce qu'il écrit lui-même se trouve toujours, et rien d'autre.
  assert.deepEqual(porteurs("rotisseur"), adversaires("rotisseur"));
  assert.deepEqual(porteurs("1,4"), ["Chef de partie"]);
  assert.deepEqual(porteurs("introuvable"), []);
  // Chaque adversaire n'est résolu qu'une fois : la seconde recherche relit les mêmes textes.
  assert.equal(index.textesAdversaire(banque.adversaires[0]), index.textesAdversaire(banque.adversaires[0]));
  // Une cellule qui n'est pas un texte (banque forgée) ne se cherche pas, et ne lève rien.
  assert.deepEqual(filtrer([{ nom: "Forgé", types: { toString: 1 }, equipement: true }], "forge", TEXTES.adversaires).length, 1);
  assert.deepEqual(filtrer([{ nom: "Forgé", types: { toString: 1 }, equipement: true }], "true", TEXTES.adversaires), []);
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

// Le signe invisible (lot 4, § 6.3), écrit par son code. Les fiches lisent
// entrees() : elle compte un doublon comme le contrôle (E3, E16).
test("fiches — les entrées d'un nom comptent ses doublons à un signe invisible près, sous un nom exact seulement ; la casse, un accent ou une espace intérieure font un autre nom", async () => {
  const description = avecAdversaires([["Marmiton\u200B", "Commis"], ["Type", "Commis \u2060", null, 2]], {
    blocs: [["Fou\u200Bet", null, "Coup de louche", null, "E3 : « Fouet » à un signe invisible près", "Équipement"]],
    capacites: [["Vif\u200B", "N", null, null, null, "Doublon de puissance.", "E3 : « Vif » suivi de U+200B"]],
  });
  description.feuilles.find((f) => f.nom === "Eléments").lignes.push(["Collant\u200B", null, "E3 : « Collant » suivi de U+200B."]);
  // Et trois noms qui ne diffèrent d'un autre que par la casse, une espace au milieu ou un accent : d'autres noms (lignes 7 et 8 de la feuille Adversaires).
  description.feuilles.find((f) => f.nom === "Adversaires").lignes.push(["marmiton", "Commis"], ["Type", "Com mis", null, 3]);
  description.feuilles.find((f) => f.nom === "Blocs").lignes.push(["Fouét", null, "Coup de louche", null, "Un autre nom que « Fouet » : l'accent diffère", "Équipement"]);
  const { banque: doublee } = await importerFichier(fabriquerClasseur(description), "essai.xlsx");
  const index = indexer(doublee);
  const lus = (categorie, nom) => index.entrees(categorie, nom).map((entree) => [entree.nom, entree.brut?.ligne ?? entree.variantes[0].brut.ligne]);
  // D'abord l'entrée qui porte le nom tel qu'il est écrit, puis celle qui n'en diffère que par un signe invisible.
  assert.deepEqual(lus("adversaires", "Marmiton"), [["Marmiton", 4], ["Marmiton\u200B", 5]]);
  assert.deepEqual(lus("adversaires", "Marmiton\u200B"), [["Marmiton\u200B", 5], ["Marmiton", 4]]);
  assert.deepEqual(lus("types", "Commis"), [["Commis", 2], ["Commis \u2060", 6]]);
  assert.deepEqual(lus("blocs", "Fouet").map(([nom]) => nom), ["Fouet", "Fou\u200Bet"]);
  assert.deepEqual(lus("elements", "Collant").map(([nom]) => nom), ["Collant", "Collant\u200B"]);
  // La première reste celle du nom exact : la fiche d'une capacité, qui ne montre que la première, ne change pas.
  assert.deepEqual(lus("capacites", "Vif").map(([nom]) => nom), ["Vif", "Vif\u200B"]);
  assert.equal(index.entrees("capacites", "Vif\u200B")[0].nom, "Vif\u200B");
  // Un doublon exact garde l'ordre de la feuille ; un nom sans doublon, sa seule entrée.
  assert.deepEqual(lus("blocs", "Louche d'acier"), [["Louche d'acier", 2], ["Louche d'acier", 16]]);
  assert.deepEqual(lus("types", "Rôtisseur"), [["Rôtisseur", 3]]);
  // Un type et un adversaire ne se mêlent pas.
  assert.deepEqual(index.entrees("adversaires", "Commis"), []);
  // « Exactement » : la casse, une espace au milieu du nom ou un accent font un autre nom. Il a ses propres
  // entrées, et n'est pas compté parmi celles du premier (plus haut : deux « Marmiton », deux « Commis », deux « Fouet »).
  assert.deepEqual(lus("adversaires", "marmiton"), [["marmiton", 7]]);
  assert.deepEqual(lus("types", "Com mis"), [["Com mis", 8]]);
  assert.deepEqual(lus("blocs", "Fouét").map(([nom]) => nom), ["Fouét"]);
  assert.deepEqual(index.entrees("adversaires", "MARMITON"), []);
  // Rien ne porte ce nom exact : aucune entrée, même à un signe près. Le renvoi, lui, se résout, de la façon approchée.
  const simple = indexer(banque);
  assert.deepEqual(simple.entrees("adversaires", "Plongeur\u200B"), []);
  assert.equal(simple.resoudre("adversaires", "Plongeur\u200B"), "Plongeur");
  assert.deepEqual(simple.entrees("blocs", "Fouet\u2060"), []);
  assert.equal(simple.resoudre("blocs", "Fouet\u2060"), "Fouet");
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
