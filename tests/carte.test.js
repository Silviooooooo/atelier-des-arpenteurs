// Contrôles de la carte d'adversaire (SPECIFICATION.md, § 16.5 et § 11,
// domaine « Adversaires ») : la carte fabriquée dans un document simulé, sur
// les adversaires de la banque de démonstration et sur de petits adversaires
// résolus écrits à la main, puis sa feuille de style lue comme un texte. La
// mise en page elle-même, et l'impression, se mesurent dans un vrai
// navigateur (§ 16.5).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLASSE_CARTE,
  CLASSE_CARTES,
  LARGEUR_CARTE,
  LARGEUR_CARTE_MM,
  LIGNES_MINIMUM,
  abregerZone,
  carte,
  cartes,
  classesDePlace,
  ecrireCout,
  ecrireDegats,
  ecrireMultiplicateur,
} from "../js/adversaire/carte.js";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const INDEX = indexerAdversaires(BANQUE);
const demo = (nom) => INDEX.resoudre(INDEX.adversaires.get(nom));

// Un nœud fabriqué dans le document simulé, qui se lit encore une fois le
// document retiré.
function fabriquer(faire) {
  const retirer = installerDom();
  try {
    return faire();
  } finally {
    retirer();
  }
}
const carteDe = (resolu, options) => fabriquer(() => carte(resolu, options));
const textes = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)].map(texteDe);
const lignes = (noeud) => textes(noeud, ".carte-ligne");

// Un adversaire résolu écrit à la main, au contrat de resolution.js.
const PROPRE = { type: null, multiplie: false };
const zone = (nom, debut, fin, armure = 0) => ({ nom, code: null, approchee: false, debut, fin, faces: fin - debut + 1, armure, pieces: [], resistance: 5 });
const capacite = (nom, plus = {}) => ({
  nom,
  absente: false,
  rang: 1,
  evolue: true,
  armes: [],
  cout: { souffle: "0", lien: "0" },
  desavantage: [],
  desavantageEntier: false,
  descriptions: [{ source: null, texte: `Effet de ${nom}.` }],
  origines: [PROPRE],
  ...plus,
});
function resoluEssai(modifier = () => {}) {
  const nombre = (valeur) => ({ valeur, origine: PROPRE });
  const resolu = {
    nom: "Sanglier d'essai",
    ligne: 9,
    types: [],
    multiplicateur: null,
    localisation: { origine: PROPRE, invalide: false },
    zones: [zone("Corps", 2, 20, 12)],
    corps: 10,
    resistance: 5,
    actions: nombre(1),
    souffle: nombre(3),
    attaque: nombre(4),
    defense: nombre(5),
    equipement: [],
    maitrises: [],
    capacites: [],
    complet: true,
    constats: [],
  };
  modifier(resolu);
  return resolu;
}

test("carte — l'en-tête : « Adversaire », le nom, et le numéro d'exemplaire quand il y en a un", () => {
  const seule = carteDe(demo("Chef de partie"));
  assert.equal(seule.tagName, "ARTICLE");
  assert.equal(seule.className, CLASSE_CARTE);
  assert.equal(texteDe(seule.querySelector(".carte-tete")), "AdversaireChef de partie");
  assert.equal(texteDe(seule.querySelector(".carte-genre")), "Adversaire");
  assert.equal(texteDe(seule.querySelector(".carte-nom")), "Chef de partie");
  assert.equal(seule.querySelectorAll(".carte-numero").length, 0);
  const seconde = carteDe(demo("Chef de partie"), { numero: 2 });
  assert.equal(texteDe(seconde.querySelector(".carte-nom")), "Chef de partie n° 2");
  assert.equal(texteDe(seconde.querySelector(".carte-numero")), "n° 2");
  assert.equal(carteDe(demo("Chef de partie"), { numero: null }).querySelectorAll(".carte-numero").length, 0);
  // Les ornements de l'en-tête ne se lisent pas.
  assert.deepEqual([...seule.querySelectorAll(".carte-tete [aria-hidden=true]")].map((n) => n.className), ["carte-losange", "carte-filet", "carte-losange"]);
});

test("carte — la bande du d20 : vingt faces, la contre-attaque, chaque zone à sa place sur les rangées Armure et Endurance, le corps", () => {
  const chef = carteDe(demo("Chef de partie"));
  assert.deepEqual(textes(chef, ".carte-face"), Array.from({ length: 20 }, (_, i) => String(i + 1)));
  assert.deepEqual(textes(chef, ".carte-contre"), ["Contre-attaque"]);
  assert.deepEqual(textes(chef, ".carte-etiquette"), ["Armure", "Endurance", "Corps"]);
  assert.deepEqual([...chef.querySelectorAll(".carte-etiquette")].map((n) => n.className), ["carte-etiquette rangee-armure", "carte-etiquette rangee-resistance", "carte-etiquette rangee-corps"]);
  const rangee = (noeud, nom) => [...noeud.querySelectorAll(`.carte-zone.rangee-${nom}`)].map((z) => [z.className.replace(`carte-zone rangee-${nom} `, ""), texteDe(z.querySelector(".carte-nom-zone")), texteDe(z.querySelector(".carte-valeur"))]);
  assert.deepEqual(rangee(chef, "armure"), [
    ["debut-2 etendue-10", "Torse", "38"],
    ["debut-12 etendue-2", "J. g.", "0"],
    ["debut-14 etendue-2", "J. d.", "0"],
    ["debut-16 etendue-2", "B. g.", "19"],
    ["debut-18 etendue-2", "B. d.", "19"],
    ["debut-20 etendue-1 etroite", "Tête", "6"],
  ]);
  assert.deepEqual(rangee(chef, "resistance").map(([place, nom, valeur]) => [place, nom, valeur]), rangee(chef, "armure").map(([place, nom]) => [place, nom, "5"]));
  const corps = chef.querySelector(".carte-corps");
  assert.equal(corps.className, "carte-corps rangee-corps debut-2 etendue-19");
  assert.equal(corps.querySelectorAll(".carte-case").length, 10);
  assert.equal(texteDe(corps), "10");
  // Une grille qui n'est pas celle des personnages : quatre zones, de trois faces et plus.
  const homard = carteDe(demo("Homard furieux"));
  assert.deepEqual(rangee(homard, "armure"), [
    ["debut-2 etendue-10", "Corps", "30"],
    ["debut-12 etendue-3", "Pince gauche", "30"],
    ["debut-15 etendue-3", "Pince droite", "30"],
    ["debut-18 etendue-3", "Tête", "36"],
  ]);
  assert.deepEqual(rangee(carteDe(demo("Mouette chapardeuse")), "armure").map(([place]) => place), ["debut-2 etendue-12", "debut-14 etendue-3", "debut-17 etendue-3", "debut-20 etendue-1 etroite"]);
  // Sans zone, la bande garde ses faces, sa contre-attaque et son corps.
  const nue = carteDe(resoluEssai((r) => (r.zones = [])));
  assert.equal(nue.querySelectorAll(".carte-zone").length, 0);
  assert.deepEqual([nue.querySelectorAll(".carte-face").length, nue.querySelectorAll(".carte-contre").length, nue.querySelectorAll(".carte-case").length], [20, 1, 10]);
});

test("carte — une zone de deux faces au plus s'abrège en initiales si son nom a plusieurs mots ; une zone d'une face est étroite", () => {
  assert.equal(abregerZone("Jambe gauche", 2), "J. g.");
  assert.equal(abregerZone("Jambe gauche", 1), "J. g.");
  assert.equal(abregerZone("Jambe gauche", 3), "Jambe gauche");
  assert.equal(abregerZone("Tête", 1), "Tête");
  assert.equal(abregerZone("Queue de scorpion", 2), "Q. d. s.");
  assert.equal(abregerZone("  Œil   droit ", 2), "Œ. d.");
  assert.equal(abregerZone("Aile 😀 droite", 2), "A. 😀. d.");
  // Un nombre reste entier : dix-neuf pattes numérotées gardent dix-neuf étiquettes distinctes.
  assert.equal(abregerZone("Patte 1", 2), "P. 1");
  assert.equal(abregerZone("Patte 12", 1), "P. 12");
  assert.equal(new Set(Array.from({ length: 19 }, (_, i) => abregerZone(`Patte ${i + 1}`, 1))).size, 19);
  assert.equal(abregerZone("Patte 2e", 1), "P. 2.", "un mot qui commence par un chiffre n'est pas un nombre");
  const noeud = carteDe(resoluEssai((r) => (r.zones = [zone("Corps", 2, 16), zone("Queue fourchue", 17, 18), zone("Bec", 19, 19), zone("Œil gauche", 20, 20)])));
  assert.deepEqual(
    [...noeud.querySelectorAll(".carte-zone.rangee-armure")].map((z) => [texteDe(z.querySelector(".carte-nom-zone")), z.className.split(" ").includes("etroite")]),
    [["Corps", false], ["Q. f.", false], ["Bec", true], ["Œ. g.", true]],
  );
});

test("carte — la première ligne : les classes et le multiplicateur, les maîtrises et leur rang, l'équipement, sa qualité, les pièces d'un pack ; un segment absent s'omet", () => {
  assert.equal(ecrireMultiplicateur("1,4"), "×1,4");
  const chef = carteDe(demo("Chef de partie"));
  assert.equal(texteDe(chef.querySelector(".carte-titre")), "Capacités");
  assert.equal(texteDe(chef.querySelector(".carte-resume")), "Classes Commis, Rôtisseur ×1,4 — Maîtrises Maîtrise de l'agile [3] — Équipement Spatule souple [2,8] · Armure agile [2,8] (3 pièces)");
  assert.deepEqual(textes(chef, ".carte-resume .carte-libelle"), ["Classes", "Maîtrises", "Équipement"]);
  assert.deepEqual(textes(chef, ".carte-resume .carte-separateur"), ["—", "—"]);
  assert.equal(texteDe(carteDe(demo("Marmiton de corvée")).querySelector(".carte-resume")), "Classes Commis, Rôtisseur — Maîtrises Maîtrise de l'agile [1] — Équipement Spatule souple [2] · Armure agile [2] (3 pièces)");
  assert.equal(texteDe(carteDe(demo("Plongeur")).querySelector(".carte-resume")), "Classes Commis, Rôtisseur — Maîtrises Maîtrise de l'agile [1]");
  assert.equal(texteDe(carteDe(demo("Homard furieux")).querySelector(".carte-resume")), "Équipement Carapace épaisse [2] · Toque renforcée [3] · Pinces de homard [2] · Couteau d'office [2]");
  // Ni classe, ni maîtrise, ni équipement : pas de première ligne.
  assert.equal(carteDe(demo("Mouette chapardeuse")).querySelectorAll(".carte-resume").length, 0);
  const fabriquee = carteDe(
    resoluEssai((r) => {
      r.types = [{ nom: "Bête", absent: false }];
      r.multiplicateur = "2";
      r.maitrises = [
        { nom: "Maîtrise du combat lourd", rang: 2, type: "lourde", origines: [PROPRE] },
        { nom: "Maîtrise du combat précis", rang: 1, type: "precise", origines: [PROPRE] },
      ];
      r.equipement = [
        { nom: "Armure lourde", ecrit: "armure lourde", genre: "pack", qualite: "4", pieces: ["Plastron"], origine: PROPRE },
        { nom: "Fourchette magique", ecrit: "Fourchette magique", genre: "absent", qualite: "2", pieces: null, origine: PROPRE },
      ];
    }),
  );
  assert.equal(texteDe(fabriquee.querySelector(".carte-resume")), "Classes Bête ×2 — Maîtrises Maîtrise du combat lourd [2], Maîtrise du combat précis [1] — Équipement Armure lourde [4] (1 pièce) · Fourchette magique (introuvable)");
});

test("carte — une ligne par capacité : le rang si elle évolue, les dégâts et la portée, le coût, le désavantage, la description ; jamais les maîtrises", () => {
  assert.equal(ecrireCout({ souffle: "5", lien: "0" }), "5 souffle");
  assert.equal(ecrireCout({ souffle: "1", lien: "1" }), "1 souffle · 1 lien");
  assert.equal(ecrireCout({ souffle: "0", lien: "2" }), "2 lien");
  assert.equal(ecrireCout({ souffle: "X", lien: "0" }), "X souffle");
  assert.equal(ecrireCout({ souffle: "0", lien: "0" }), "");
  assert.equal(ecrireCout(null), "");
  assert.equal(ecrireDegats([]), "");
  assert.equal(ecrireDegats([{ nom: "Spatule souple", degats: "8/16/25", portee: null }]), "(8/16/25)");
  assert.equal(ecrireDegats([{ nom: "Arc", degats: "3/8/20", portee: 6 }]), "(3/8/20, portée 6)");
  const chef = carteDe(demo("Chef de partie"));
  assert.deepEqual(lignes(chef).slice(1), ["Frappe (6/12/19) — Une attaque qui inflige 6/12/19.", "Moulinet farineux [1] (6/12/19) 5 souffle — Tourbillonne 1 fois.", "Pas chassé [2] 1 souffle — Se déplace de 2 cases.", ""]);
  assert.deepEqual(textes(chef, ".carte-nom-capacite"), ["Frappe", "Moulinet farineux", "Pas chassé"]);
  assert.deepEqual(textes(chef, ".carte-degats"), ["(6/12/19)", "(6/12/19)"]);
  assert.deepEqual(textes(chef, ".carte-cout"), ["5 souffle", "1 souffle"]);
  assert.deepEqual(textes(chef, ".carte-description"), ["— Une attaque qui inflige 6/12/19.", "— Tourbillonne 1 fois.", "— Se déplace de 2 cases."]);
  assert.equal(chef.querySelectorAll(".carte-desavantage").length, 0);
  // Sans la maîtrise au rang voulu, le désavantage ; entier, il ne nomme aucun bloc.
  const marmiton = carteDe(demo("Marmiton de corvée"));
  assert.deepEqual(lignes(marmiton).slice(1), ["Frappe (5/10/15) — Une attaque qui inflige 5/10/15.", "Moulinet farineux [1] (5/10/15) 5 souffle désavantage — Tourbillonne 1 fois.", "Pas chassé [1] — Se déplace de 1 case.", ""]);
  assert.deepEqual(textes(marmiton, ".carte-desavantage"), ["désavantage"]);
  assert.equal(marmiton.querySelectorAll(".carte-ligne .carte-precision").length, 1, "la seule précision est celle du pack");
  for (const noeud of [chef, marmiton]) assert.ok(!lignes(noeud).slice(1).some((l) => l.includes("Maîtrise")), "les maîtrises ne sont que sur la première ligne");
  const fabriquee = carteDe(
    resoluEssai((r) => {
      r.capacites = [
        capacite("Charge", { cout: { souffle: "1", lien: "1" } }),
        capacite("Hurlement", { evolue: false, rang: 0, cout: { souffle: "X", lien: "0" }, descriptions: [] }),
        capacite("Muette", { descriptions: [{ source: null, texte: "" }] }),
      ];
    }),
  );
  assert.deepEqual(lignes(fabriquee).slice(0, 3), ["Charge [1] 1 souffle · 1 lien — Effet de Charge.", "Hurlement X souffle", "Muette [1]"]);
});

test("carte — une capacité que deux armes donnent : chaque arme devant ses dégâts, le désavantage du seul bloc qui le donne, chaque description précédée de sa source", () => {
  const homard = carteDe(demo("Homard furieux"));
  assert.deepEqual(lignes(homard).slice(1), [
    "Frappe (Pinces de homard 4/8/12 · Couteau d'office 3/8/20, portée 1) désavantage (Couteau d'office) — Pinces de homard : Une attaque qui inflige 4/8/12. — Couteau d'office : Une attaque qui inflige 3/8/20.",
    "Choc sourd (4/8/12) 2 souffle — La cible perd autant d'attaque que vos réussites.",
    "Émincer (3/8/20, portée 1) 4 souffle désavantage — Une réussite de plus si vous en avez une.",
    "",
  ]);
  assert.deepEqual(textes(homard, ".carte-desavantage"), ["désavantage", "désavantage"]);
  assert.deepEqual(textes(homard, ".carte-ligne .carte-precision"), ["(Couteau d'office)"]);
  assert.equal(
    ecrireDegats([
      { nom: "A", degats: "1/2/3", portee: null },
      { nom: "B", degats: "4/5/6", portee: 2 },
      { nom: "C", degats: "7/8/9", portee: null },
    ]),
    "(A 1/2/3 · B 4/5/6, portée 2 · C 7/8/9)",
  );
  // Deux blocs sur trois : la mention les nomme tous les deux.
  const partielle = carteDe(resoluEssai((r) => (r.capacites = [capacite("Estoc", { desavantage: ["Rapière", "Dague"], desavantageEntier: false })])));
  assert.equal(lignes(partielle)[0], "Estoc [1] désavantage (Rapière, Dague) — Effet de Estoc.");
});

test("carte — quatre lignes de capacités au moins, et autant qu'il en faut ; une capacité absente le dit", () => {
  assert.equal(LIGNES_MINIMUM, 4);
  const compter = (noeud) => [noeud.querySelectorAll(".carte-ligne").length - noeud.querySelectorAll(".carte-resume").length, noeud.querySelectorAll(".carte-ligne-vide").length];
  assert.deepEqual(compter(carteDe(demo("Chef de partie"))), [4, 1]);
  assert.deepEqual(compter(carteDe(demo("Plongeur"))), [4, 3]);
  assert.deepEqual(compter(carteDe(demo("Mouette chapardeuse"))), [4, 2]);
  assert.deepEqual(compter(carteDe(resoluEssai())), [4, 4]);
  const avec = (n) => carteDe(resoluEssai((r) => (r.capacites = Array.from({ length: n }, (_, i) => capacite(`Capacité ${i + 1}`)))));
  assert.deepEqual(compter(avec(4)), [4, 0]);
  assert.deepEqual(compter(avec(7)), [7, 0]);
  assert.equal(lignes(avec(7)).at(-1), "Capacité 7 [1] — Effet de Capacité 7.");
  // Les lignes vides suivent les capacités, et ne portent rien.
  assert.deepEqual(lignes(carteDe(demo("Plongeur"))).slice(1), ["Pas chassé [1] — Se déplace de 1 case.", "", "", ""]);
  const absente = carteDe(resoluEssai((r) => (r.capacites = [{ nom: "Coup de pied retourné", absente: true, rang: null, armes: [], degats: "", cout: null, desavantage: [], descriptions: [], origines: [PROPRE] }])));
  assert.equal(lignes(absente)[0], "Coup de pied retourné introuvable dans Capacites");
  assert.equal(texteDe(absente.querySelector(".carte-absente")), "introuvable dans Capacites");
});

test("carte — la colonne de droite : le nombre d'actions, le souffle, l'attaque, la défense ; une valeur absente laisse sa place vide ; aucune provenance", () => {
  const chef = carteDe(demo("Chef de partie"));
  assert.deepEqual(textes(chef, ".carte-nombre"), ["Nombre d'actions : 1", "Souffle : 7"]);
  assert.equal(texteDe(chef.querySelector(".carte-actions .carte-valeur")), "1");
  assert.equal(texteDe(chef.querySelector(".carte-souffle .carte-valeur")), "7");
  assert.deepEqual([texteDe(chef.querySelector(".carte-attaque .carte-libelle")), texteDe(chef.querySelector(".carte-attaque .carte-valeur"))], ["Attaque", "5"]);
  assert.deepEqual([texteDe(chef.querySelector(".carte-defense .carte-libelle")), texteDe(chef.querySelector(".carte-defense .carte-valeur"))], ["Défense", "7"]);
  assert.deepEqual([...chef.querySelectorAll(".carte-droite .carte-valeur")].length, 4);
  assert.doesNotMatch(texteDe(chef), /Dégâts/, "l'ancienne case « Dégâts » n'existe pas");
  // Ce que la vue lecture dit à l'écran, la carte ne le dit pas.
  assert.doesNotMatch(texteDe(chef), /\bde (?:Commis|Rôtisseur|Spatule souple|Armure agile)\b/);
  assert.equal(texteDe(chef).split("×1,4").length - 1, 1, "le multiplicateur n'est écrit qu'après les classes");
  // Un souffle nul s'écrit ; un souffle que rien ne donne laisse sa place.
  assert.equal(texteDe(carteDe(demo("Plongeur")).querySelector(".carte-souffle")), "Souffle : 0");
  const mouette = carteDe(demo("Mouette chapardeuse"));
  assert.equal(texteDe(mouette.querySelector(".carte-souffle")), "Souffle :");
  assert.equal(mouette.querySelectorAll(".carte-souffle .carte-valeur").length, 1, "la place reste");
  const vide = carteDe(
    resoluEssai((r) => {
      for (const champ of ["actions", "souffle", "attaque", "defense"]) r[champ] = { valeur: null, origine: null };
    }),
  );
  assert.deepEqual(textes(vide, ".carte-droite .carte-valeur"), ["", "", "", ""]);
  assert.deepEqual(textes(vide, ".carte-carre"), ["Attaque", "Défense"]);
});

test("carte — un nom qui contient du HTML reste du texte ; une zone hors de la bande n'est pas placée", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const noeud = carteDe(
    resoluEssai((r) => {
      r.nom = hostile;
      r.types = [{ nom: "<b>Type</b>", absent: false }];
      r.zones = [zone("<i>Zone</i>", 2, 20)];
      r.equipement = [{ nom: "<script>x</script>", ecrit: "x", genre: "bloc", qualite: "2", pieces: null, origine: PROPRE }];
      r.capacites = [capacite("<a href=javascript:alert(1)>Lien</a>", { descriptions: [{ source: null, texte: "<svg onload=alert(1)>" }] })];
    }),
    { numero: "<u>3</u>" },
  );
  assert.equal(texteDe(noeud.querySelector(".carte-nom")), `${hostile} n° <u>3</u>`);
  assert.equal(texteDe(noeud.querySelector(".carte-nom-zone")), "<i>Zone</i>");
  assert.equal(texteDe(noeud.querySelector(".carte-resume")), "Classes <b>Type</b> — Équipement <script>x</script> [2]");
  assert.equal(lignes(noeud)[1], "<a href=javascript:alert(1)>Lien</a> [1] — <svg onload=alert(1)>");
  for (const balise of ["img", "b", "i", "u", "a", "script", "svg"]) assert.equal(noeud.querySelectorAll(balise).length, 0, balise);
  for (const element of [noeud, ...noeud.querySelectorAll("div"), ...noeud.querySelectorAll("span")]) {
    assert.deepEqual([...element.attributs.keys()].filter((nom) => nom !== "class" && nom !== "aria-hidden"), [], "ni style, ni gestionnaire, ni adresse");
    assert.equal(element.ecouteurs.size, 0);
  }
  // Les classes de place ne viennent que d'entiers vérifiés.
  assert.equal(classesDePlace(2, 19), "debut-2 etendue-19");
  assert.equal(classesDePlace(20, 1), "debut-20 etendue-1");
  for (const [debut, faces] of [[1, 3], [2, 20], [20, 2], [21, 1], [5, 0], [5, -1], [2.5, 2], ["2", 3], [2, "3 x"], [null, 1], [NaN, 1]]) {
    assert.equal(classesDePlace(debut, faces), null, `${debut}, ${faces}`);
  }
  const deplacee = carteDe(resoluEssai((r) => (r.zones = [zone("Corps", 2, 11), { ...zone("Queue", 12, 20), debut: "12 etendue-19 carte-contre" }, { ...zone("Aile", 12, 20), faces: 30 }])));
  assert.deepEqual([...deplacee.querySelectorAll(".carte-zone")].map((z) => z.className), ["carte-zone rangee-armure debut-2 etendue-10", "carte-zone rangee-resistance debut-2 etendue-10"]);
});

test("carte — un signe qui commande le sens de l'écriture, laissé dans un nom, ne s'affiche pas : les nombres qui le suivent ne se lisent pas à l'envers", () => {
  // U+202E renverse tout ce qui le suit dans la ligne : « 13/26/41 » se lirait « 14/62/31 ». Les signes voisins de même.
  const signes = [0x202a, 0x202b, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x200f].map((code) => String.fromCodePoint(code));
  const [, , , renverse] = signes;
  const noeud = carteDe(
    resoluEssai((r) => {
      r.nom = `Chef${renverse}`;
      r.types = [{ nom: `Saucier${renverse}`, absent: false }];
      r.zones = [zone(`Corps${renverse}`, 2, 20)];
      r.equipement = [{ nom: `Rapière${renverse} fine`, ecrit: "x", genre: "bloc", qualite: "4", pieces: null, origine: PROPRE }];
      r.capacites = [capacite(`Estoc${signes.join("")} vif`, { descriptions: [{ source: null, texte: `Inflige 13/26/41${renverse}.` }] })];
    }),
    { numero: 12 },
  );
  assert.equal(texteDe(noeud.querySelector(".carte-nom")), "Chef n° 12");
  assert.equal(texteDe(noeud.querySelector(".carte-nom-zone")), "Corps");
  assert.equal(texteDe(noeud.querySelector(".carte-resume")), "Classes Saucier — Équipement Rapière fine [4]");
  assert.equal(lignes(noeud)[1], "Estoc vif [1] — Inflige 13/26/41.");
  for (const signe of signes) assert.equal(texteDe(noeud).includes(signe), false, `U+${signe.codePointAt(0).toString(16)}`);
  // Les accents, les ligatures et les émojis ne sont pas des signes de sens : ils restent.
  const intact = "Œil d'été 😀 !";
  assert.equal(texteDe(carteDe(resoluEssai((r) => (r.nom = intact))).querySelector(".carte-nom")), intact);
});

test("cartes — les cartes d'une rencontre, dans l'ordre, numérotées ; la largeur de la carte, pour l'échelle", () => {
  const chef = demo("Chef de partie");
  const marmiton = demo("Marmiton de corvée");
  const rencontre = fabriquer(() => cartes([{ resolu: chef, numero: null }, { resolu: marmiton, numero: 1 }, { resolu: marmiton, numero: 2 }, { resolu: chef }]));
  assert.equal(rencontre.tagName, "DIV");
  assert.equal(rencontre.className, CLASSE_CARTES);
  assert.deepEqual(rencontre.children.map((n) => n.className), Array(4).fill(CLASSE_CARTE));
  assert.deepEqual(textes(rencontre, ".carte-nom"), ["Chef de partie", "Marmiton de corvée n° 1", "Marmiton de corvée n° 2", "Chef de partie"]);
  assert.equal(fabriquer(() => cartes([])).children.length, 0);
  assert.deepEqual([CLASSE_CARTE, CLASSE_CARTES], ["carte-adversaire", "cartes-adversaires"]);
  // 190 mm à 96 pixels par pouce : la largeur dont l'écran tire l'échelle.
  assert.equal(LARGEUR_CARTE_MM, 190);
  assert.ok(Math.abs(LARGEUR_CARTE - 718.11) < 0.01, String(LARGEUR_CARTE));
});

// ─── La feuille de style, lue comme un texte ────────────────────────────────

const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const CSS = sansCommentaires(lire("css/adversaire.css"));
const JETONS = lire("css/jetons.css");
// Les feuilles de l'interface et de la fiche, dont celle du simulateur de
// combat (§ 17) : la carte ne leur prête ni ses classes, ni sa police.
const AUTRES_FEUILLES = ["css/ecran.css", "css/personnage.css", "css/fiche.css", "css/combat.css"];

// Les règles d'une feuille : { selecteur, corps, cadre }, où cadre est la
// règle @media qui l'enveloppe, ou "". Une règle @font-face ou @page garde
// son nom pour sélecteur.
function regles(css, cadre = "") {
  const lues = [];
  let debut = 0;
  while (css.indexOf("{", debut) !== -1) {
    const ouvre = css.indexOf("{", debut);
    let ferme = ouvre;
    for (let profondeur = 1; profondeur > 0; ) {
      ferme += 1;
      assert.ok(ferme < css.length, "accolade jamais fermée");
      if (css[ferme] === "{") profondeur += 1;
      if (css[ferme] === "}") profondeur -= 1;
    }
    const selecteur = css.slice(debut, ouvre).trim().replace(/\s+/g, " ");
    const corps = css.slice(ouvre + 1, ferme).trim();
    if (selecteur.startsWith("@media")) lues.push(...regles(corps, selecteur));
    else lues.push({ selecteur, corps, cadre });
    debut = ferme + 1;
  }
  return lues;
}
const declarations = (corps) => Object.fromEntries(corps.split(";").map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]));
const REGLES = regles(CSS);
const STYLES = REGLES.filter((r) => !r.selecteur.startsWith("@"));
const regle = (selecteur, cadre = "") => {
  const trouvees = REGLES.filter((r) => r.cadre === cadre && r.selecteur.split(/\s*,\s*/).includes(selecteur));
  assert.equal(trouvees.length, 1, `${cadre} ${selecteur} : ${trouvees.length} règle(s)`);
  return declarations(trouvees[0].corps);
};
const classesDe = (css) => new Set(regles(sansCommentaires(css)).filter((r) => !r.selecteur.startsWith("@")).flatMap((r) => [...r.selecteur.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(([, classe]) => classe)));
const jetonsDe = (bloc) => Object.fromEntries([...bloc.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, nom, valeur]) => [nom, valeur.trim()]));

test("adversaire.css — aucune couleur écrite en dur ; chaque jeton de la carte est défini dans jetons.css, sert, et garde sa valeur dans le thème sombre", () => {
  assert.doesNotMatch(CSS, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i);
  // Toute couleur passe par un jeton de la carte : pas de couleur nommée non plus.
  for (const { selecteur, corps } of STYLES) {
    for (const [propriete, valeur] of Object.entries(declarations(corps))) {
      if (/^(?:color|background|border(?:-(?:top|right|bottom|left))?)$/.test(propriete)) assert.match(valeur, /var\(--carte-[\w-]+\)/, `${selecteur} { ${propriete}: ${valeur} }`);
    }
  }
  const sombre = JETONS.indexOf("@media (prefers-color-scheme: dark)");
  const clairs = jetonsDe(JETONS.slice(0, sombre));
  const employes = new Set([...CSS.matchAll(/var\(--([\w-]+)[),]/g)].map(([, nom]) => nom));
  const deLaCarte = Object.keys(clairs).filter((nom) => nom.startsWith("carte-") || nom === "police-carte");
  // --echelle est le nombre que l'écran pose (§ 16.6) : il se lit avec une valeur de repli.
  assert.deepEqual([...employes].filter((nom) => !deLaCarte.includes(nom)), ["echelle"]);
  assert.match(CSS, /zoom:\s*var\(--echelle, 1\);/);
  assert.deepEqual(deLaCarte.filter((nom) => !employes.has(nom)), [], "jeton de la carte que rien n'emploie");
  assert.deepEqual(Object.keys(jetonsDe(JETONS.slice(sombre))).filter((nom) => /carte/.test(nom) && nom !== "largeur-carte"), [], "la carte est du papier : pas de valeur sombre");
  // Le style du modèle (mission, § 7).
  assert.deepEqual([clairs["carte-papier"], clairs["carte-trait"], clairs["carte-accent"], clairs["carte-encre"]], ["#fffdf8", "#3a3126", "#6d4a1f", "#2b2318"]);
  assert.match(clairs["police-carte"], /^"EB Garamond", .+, serif$/);
  // La carte pose elle-même ce que l'interface lui transmettrait.
  const racineCarte = regle(".carte-adversaire");
  assert.deepEqual(
    Object.fromEntries(["box-sizing", "margin", "background", "color", "font-family", "line-height", "overflow-wrap"].map((p) => [p, racineCarte[p]])),
    { "box-sizing": "border-box", margin: "0", background: "var(--carte-papier)", color: "var(--carte-encre)", "font-family": "var(--police-carte)", "line-height": "normal", "overflow-wrap": "normal" },
  );
  assert.deepEqual(regle(".carte-adversaire *"), { "box-sizing": "border-box", margin: "0", padding: "0" });
});

test("adversaire.css — chaque règle commence par la carte ou par son conteneur ; aucune de ses classes n'existe dans l'interface ni dans la fiche ; le code et la feuille portent les mêmes", () => {
  const hors = STYLES.flatMap((r) => r.selecteur.split(/\s*,\s*/).map((selecteur) => [r.cadre, selecteur])).filter(([, selecteur]) => !/^(?:\.carte-adversaire|\.cartes-adversaires)(?![\w-])/.test(selecteur));
  // La seule règle qui sort de la carte : le fond de la page, à l'impression.
  assert.deepEqual(hors, [["@media print", "html:has(.cartes-adversaires)"], ["@media print", "body:has(.cartes-adversaires)"]]);
  const feuille = classesDe(lire("css/adversaire.css"));
  // Une classe nommée dans :not() n'habille rien : les titres des écrans (css/ecran.css, lot 5) épargnent ainsi la carte.
  const prisesPar = (css) => classesDe(css.replace(/:not\([^()]*\)/g, ""));
  assert.ok(classesDe(lire("css/ecran.css")).has("carte-adversaire"), "l'exemption sert : ecran.css nomme la carte pour l'épargner");
  for (const autre of AUTRES_FEUILLES) {
    const prises = prisesPar(lire(autre));
    assert.ok(prises.size > 0, `${autre} : aucune classe lue`);
    assert.deepEqual([...feuille].filter((classe) => prises.has(classe)), [], autre);
  }
  // Le simulateur de combat (§ 17) montre des cartes dans son panneau « Fiche complète » : sa feuille ne les
  // habille pas pour autant. Il appelle « plateau » sa propre carte, et aucune de ses classes ne porte « carte ».
  assert.deepEqual([...classesDe(lire("css/combat.css"))].filter((classe) => /carte/.test(classe)), []);
  // Le contrôle refuse : une feuille qui reprendrait une classe de la carte, sous un autre conteneur, ou devant un
  // :not() ; il n'admet que la classe qu'un :not() nomme.
  const intruse = prisesPar(".combat-panneau .carte-nom { margin: 0; }\n.combat .rangee-armure,\n.combat-fiche { margin: 0; }\n.carte-bas:not(.combat-fiche) { margin: 0; }\n:where(h2):where(:not(.carte-corps *)) { margin: 0; }");
  assert.deepEqual([...feuille].filter((classe) => intruse.has(classe)).sort(), ["carte-bas", "carte-nom", "rangee-armure"]);
  // Chaque classe que le code pose a sa règle, et chaque règle sert : les
  // adversaires de la démonstration, et un adversaire où tout figure.
  const complet = resoluEssai((r) => {
    r.zones = [zone("Corps", 2, 19), zone("Tête", 20, 20)];
    r.types = [{ nom: "Bête", absent: false }];
    r.equipement = [{ nom: "Armure lourde", ecrit: "Armure lourde", genre: "pack", qualite: "2", pieces: ["Plastron"], origine: PROPRE }];
    r.capacites = [capacite("Charge", { armes: [{ nom: "Défenses", degats: "1/2/3", portee: null, desavantage: true }], cout: { souffle: "2", lien: "0" }, desavantage: ["Défenses"], desavantageEntier: true }), { nom: "Ruade", absente: true, rang: null, armes: [], cout: null, desavantage: [], descriptions: [], origines: [] }];
    r.maitrises = [{ nom: "Maîtrise du combat lourd", rang: 1, type: "lourde", origines: [PROPRE] }];
  });
  const rencontre = fabriquer(() => cartes([...[...INDEX.adversaires.keys()].map((nom) => ({ resolu: demo(nom) })), { resolu: complet, numero: 2 }]));
  const posees = new Set([rencontre, ...rencontre.querySelectorAll("[class]")].flatMap((n) => n.className.split(/\s+/)));
  // Cinq repères disent ce qu'est une case, sans rien changer à son aspect.
  assert.deepEqual([...posees].filter((classe) => !feuille.has(classe)), ["carte-ligne-vide", "carte-actions", "carte-souffle", "carte-attaque", "carte-defense"], "classe posée par carte.js, sans règle");
  assert.deepEqual([...feuille].filter((classe) => !posees.has(classe) && !/^(?:debut|etendue)-\d+$/.test(classe)), [], "règle qu'aucune carte n'emploie");
});

test("adversaire.css — les deux familles de classes de position, complètes : dix-neuf premières faces, dix-neuf étendues, sur vingt et une colonnes", () => {
  assert.equal(regle(".carte-adversaire .carte-bande")["grid-template-columns"], "20mm repeat(20, minmax(0, 1fr))");
  const famille = (nom) => STYLES.filter((r) => new RegExp(`\\.${nom}-\\d+\\b`).test(r.selecteur)).map((r) => [r.selecteur, r.corps, r.cadre]);
  // La face n est dans la colonne n + 1 : la première est celle de l'étiquette.
  assert.deepEqual(famille("debut"), Array.from({ length: 19 }, (_, i) => [`.carte-adversaire .debut-${i + 2}`, `grid-column-start: ${i + 3};`, ""]));
  assert.deepEqual(famille("etendue"), Array.from({ length: 19 }, (_, i) => [`.carte-adversaire .etendue-${i + 1}`, `grid-column-end: span ${i + 1};`, ""]));
  // Toute place que le code peut donner a ses deux règles.
  const feuille = classesDe(lire("css/adversaire.css"));
  for (let debut = 2; debut <= 20; debut += 1) {
    for (let faces = 1; debut + faces - 1 <= 20; faces += 1) for (const classe of classesDePlace(debut, faces).split(" ")) assert.ok(feuille.has(classe), classe);
  }
  // Les rangées et la contre-attaque, elles, sont fixes.
  assert.deepEqual([regle(".carte-adversaire .rangee-armure"), regle(".carte-adversaire .rangee-resistance"), regle(".carte-adversaire .rangee-corps")], [{ "grid-row": "2" }, { "grid-row": "3" }, { "grid-row": "4" }]);
  assert.equal(regle(".carte-adversaire .carte-contre")["grid-area"], "2 / 2 / span 3");
  // Trois phrases de la mission (§ 7) que seule la feuille tient : la case
  // « Contre-attaque » verticale, la description en italique, la hauteur
  // variable (aucune hauteur ni rognage sur la carte, impression comprise).
  assert.equal(regle(".carte-adversaire .carte-contre span")["writing-mode"], "vertical-rl");
  assert.equal(regle(".carte-adversaire .carte-description")["font-style"], "italic");
  for (const r of REGLES.filter((r) => r.selecteur.split(/\s*,\s*/).some((s) => /\.carte-adversaire$/.test(s)))) {
    assert.deepEqual(Object.keys(declarations(r.corps)).filter((p) => /^(?:max-)?height$|^overflow/.test(p) && p !== "overflow-wrap"), [], `${r.cadre} ${r.selecteur}`);
  }
  assert.equal(regle(".carte-adversaire .carte-etiquette")["grid-column"], "1");
  assert.deepEqual([regle(".carte-adversaire .carte-coin")["grid-row"], regle(".carte-adversaire .carte-face")["grid-row"]], ["1", "1"]);
});

test("adversaire.css — EB Garamond : deux @font-face, la police variable et son italique, hébergées dans polices/", () => {
  const polices = REGLES.filter((r) => r.selecteur === "@font-face").map((r) => declarations(r.corps));
  assert.deepEqual(polices, [
    { "font-family": '"EB Garamond"', src: 'url("../polices/EBGaramond-Variable.woff2") format("woff2")', "font-weight": "400 800", "font-style": "normal", "font-display": "swap" },
    { "font-family": '"EB Garamond"', src: 'url("../polices/EBGaramond-Italic.woff2") format("woff2")', "font-weight": "400", "font-style": "italic", "font-display": "swap" },
  ]);
  assert.equal([...CSS.matchAll(/url\(/g)].length, 2, "aucune autre adresse");
  assert.doesNotMatch(CSS, /@import/);
  for (const fichier of ["EBGaramond-Variable.woff2", "EBGaramond-Italic.woff2"]) assert.equal(readFileSync(new URL(`polices/${fichier}`, racine)).subarray(0, 4).toString("latin1"), "wOF2", fichier);
  // Les graisses de la maquette, 400 et 600 : la police variable les couvre.
  assert.deepEqual([...new Set(STYLES.map((r) => declarations(r.corps)["font-weight"]).filter(Boolean))].sort(), ["400", "600"]);
  // La police n'est nommée que par son jeton, sous la carte : elle ne se charge que pour elle.
  const familles = STYLES.flatMap((r) => (declarations(r.corps)["font-family"] ? [[r.selecteur, declarations(r.corps)["font-family"]]] : []));
  assert.deepEqual(familles, [[".carte-adversaire", "var(--police-carte)"]]);
  const empruntee = /police-carte|EB Garamond/;
  for (const autre of AUTRES_FEUILLES) assert.doesNotMatch(lire(autre), empruntee, autre);
  assert.match(".combat-panneau { font-family: var(--police-carte); }", empruntee, "l'emprunt par le jeton se verrait");
});

test("adversaire.css — l'impression : une page nommée A4 à marges, 190 mm, 4 mm entre les cartes, une carte jamais coupée ni masquée, les couleurs gardées, le zoom remis à 1", () => {
  assert.deepEqual(declarations(REGLES.find((r) => r.selecteur === "@page cartes-adversaires").corps), { size: "A4", margin: "11mm 10mm", background: "var(--carte-papier)" });
  assert.deepEqual(REGLES.filter((r) => r.selecteur.startsWith("@page")).length, 1, "la page par défaut reste celle de fiche.css");
  // La page nommée, trois fois : sans la racine, Firefox imprime la première
  // page sans marge ; sans la carte, les pages après la deuxième (relecture
  // du lot 3, mesuré dans Firefox 143 et 157).
  const nommees = REGLES.filter((r) => r.cadre === "@media print" && declarations(r.corps).page === "cartes-adversaires").map((r) => r.selecteur);
  assert.deepEqual(nommees, ["html:has(.cartes-adversaires), body:has(.cartes-adversaires)", ".cartes-adversaires", ".cartes-adversaires .carte-adversaire"]);
  assert.deepEqual(regle(".cartes-adversaires", "@media print"), {
    page: "cartes-adversaires",
    width: "190mm",
    zoom: "1 !important",
    background: "var(--carte-papier)",
    "print-color-adjust": "exact",
    "-webkit-print-color-adjust": "exact",
  });
  assert.equal(regle(".cartes-adversaires .carte-adversaire", "@media print")["break-inside"], "avoid");
  assert.deepEqual(regle("html:has(.cartes-adversaires)", "@media print"), { page: "cartes-adversaires", background: "var(--carte-papier)" });
  // Hors impression aussi : la largeur, l'écart, et l'échelle de l'écran.
  assert.deepEqual(regle(".cartes-adversaires"), { width: "190mm", zoom: "var(--echelle, 1)" });
  assert.deepEqual(regle(".cartes-adversaires .carte-adversaire + .carte-adversaire"), { "margin-top": "4mm" });
  const racineCarte = regle(".carte-adversaire");
  assert.deepEqual([racineCarte.width, racineCarte["break-inside"], racineCarte["print-color-adjust"], racineCarte["-webkit-print-color-adjust"]], [`${LARGEUR_CARTE_MM}mm`, "avoid", "exact", "exact"]);
  // Rien ne masque une carte : une carte masquée hors de l'écran sortirait
  // une page vide (lot 2, la vue lecture).
  assert.doesNotMatch(CSS, /display:\s*none|visibility:\s*hidden/);
  // Les règles globales de fiche.css, avec lesquelles la carte compose.
  const fiche = lire("css/fiche.css");
  assert.match(fiche, /@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
  assert.match(fiche.slice(fiche.indexOf("@media print")), /body \{[^}]*background: var\(--fiche-papier\);/);
});

test("index.html — la feuille de la carte est liée, après celle de la fiche", () => {
  const page = lire("index.html");
  const liens = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(([, href]) => href);
  assert.ok(liens.includes("css/adversaire.css"), "css/adversaire.css n'est pas liée");
  assert.ok(liens.indexOf("css/adversaire.css") > liens.indexOf("css/fiche.css"), "après css/fiche.css");
  assert.ok(liens.indexOf("css/jetons.css") === 0, "les jetons d'abord");
});

// Les feuilles que lie une page, dans l'ordre, et ce qui manque à cet ordre
// pour le simulateur de combat (§ 17).
function defautsDesFeuilles(page) {
  const liens = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(([, href]) => href);
  const defauts = [];
  if (liens.filter((href) => href === "css/combat.css").length !== 1) defauts.push("css/combat.css n'est pas liée, une fois");
  // Après l'interface, dont elle reprend les boutons et les champs ; après la fiche et la carte, que son panneau montre.
  else if (liens.indexOf("css/combat.css") !== liens.length - 1) defauts.push("css/combat.css n'est pas la dernière");
  if (liens.indexOf("css/jetons.css") !== 0) defauts.push("les jetons ne viennent pas d'abord");
  if ((page.match(/<link\b[^>]*stylesheet/g) ?? []).length !== liens.length) defauts.push("une feuille est liée sous une autre forme");
  return { liens, defauts };
}

test("index.html — la feuille du combat est liée, la dernière ; l'ordre des autres ne change pas", () => {
  const page = lire("index.html");
  const { liens, defauts } = defautsDesFeuilles(page);
  assert.deepEqual(defauts, []);
  // La feuille des thèmes (lot 5) suit aussitôt les jetons qu'elle redéfinit.
  assert.deepEqual(liens, ["css/jetons.css", "css/themes.css", "css/ecran.css", "css/personnage.css", "css/fiche.css", "css/adversaire.css", "css/combat.css"]);
  const lien = '<link rel="stylesheet" href="css/combat.css">';
  const fautive = (texte, motif) => {
    assert.notEqual(texte, page);
    assert.match(defautsDesFeuilles(texte).defauts.join("\n"), motif);
  };
  fautive(page.replace(/ *<link rel="stylesheet" href="css\/combat\.css">\r?\n/, ""), /n'est pas liée/);
  fautive(page.replace(lien, `${lien}\n    ${lien}`), /n'est pas liée, une fois/);
  fautive(page.replace(lien, "").replace('<link rel="stylesheet" href="css/jetons.css">', `${lien}\n    <link rel="stylesheet" href="css/jetons.css">`), /n'est pas la dernière\nles jetons ne viennent pas d'abord/);
  fautive(page.replace(lien, '<link href="css/combat.css" rel="stylesheet">'), /n'est pas liée, une fois\nune feuille est liée sous une autre forme/);
});
