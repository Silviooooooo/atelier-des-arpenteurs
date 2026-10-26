// Contrôles des adversaires (SPECIFICATION.md, § 16, § 6.3 et § 11, domaine
// « Adversaires ») : la notation de la feuille, l'héritage et le
// multiplicateur, les valeurs, l'équipement, les capacités, et chaque code
// de contrôle de la feuille. La banque vient du classeur d'essai, fictif ;
// les cas fautifs et les cas limites se fabriquent au moment de l'essai
// (tests/outils/adversaires_essai.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ecrireTypes } from "../js/adversaire/carte.js";
import { estAucun, lireListe, lireLocalisation, lireNombreCellule, lireTypes, reconnaitreZone } from "../js/adversaire/notation.js";
import { banqueSansAdversaires, ecrireQualite, horsMaitrise, indexerAdversaires, maitriseDe, positionDans, rangsDeMaitrise } from "../js/adversaire/resolution.js";
import { GRAVITES } from "../js/banque/controle.js";
import { comparer } from "../js/banque/differences.js";
import { importerFichier } from "../js/banque/importation.js";
import { typeDe } from "../js/banque/types.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { fraction } from "../js/personnage/expressions.js";
import { packsDArmure } from "../js/personnage/packs.js";
import { FAUTES, HUMANOIDE, avecAdversaires, sansAjoutsDuCombat } from "./outils/adversaires_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";

const _ = null;
const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));
const { banque: BANQUE } = await importerFichier(ESSAI, "classeur_essai.xlsx");
const INDEX = indexerAdversaires(BANQUE);
const demo = (nom) => INDEX.resoudre(INDEX.adversaires.get(nom));

// Une feuille Adversaires fabriquée : le socle (types Commis et Rôtisseur,
// lignes 2 et 3 ; « Marmiton », ligne 4), puis les lignes données.
async function feuille(lignes, options) {
  const { banque, anomalies, erreur } = await importerFichier(fabriquerClasseur(avecAdversaires(lignes, options)), "essai.xlsx");
  assert.equal(erreur, undefined, erreur);
  const index = indexerAdversaires(banque);
  return {
    banque,
    index,
    anomalies: anomalies.filter((a) => a.feuille === "Adversaires").map((a) => [a.code, a.ligne, a.message]),
    de: (nom) => index.resoudre(index.adversaires.get(nom)),
  };
}

const nombres = (r) => [r.actions.valeur, r.souffle.valeur, r.attaque.valeur, r.defense.valeur];
const armures = (r) => r.zones.map((z) => z.armure);
const capacite = (r, nom) => r.capacites.find((c) => c.nom === nom);
const noms = (liste) => liste.map((entree) => entree.nom);

// ─── La notation de la feuille (§ 16.1) ─────────────────────────────────────

test("notation — un nombre : cellule vide, « aucune », virgule décimale ; tout le reste est illisible", () => {
  assert.deepEqual(lireNombreCellule(""), { genre: "herite" });
  assert.deepEqual(lireNombreCellule("   "), { genre: "herite" });
  assert.deepEqual(lireNombreCellule("7"), { genre: "valeur", valeur: fraction(7) });
  assert.deepEqual(lireNombreCellule(" 1,5 "), { genre: "valeur", valeur: fraction(3, 2) });
  for (const rien of ["aucune", "Aucun", " AUCUNE "]) assert.deepEqual(lireNombreCellule(rien), { genre: "valeur", valeur: fraction(0) }, rien);
  for (const mauvais of ["1.5", "-1", "deux", "1,", "//", "aucunes"]) assert.deepEqual(lireNombreCellule(mauvais), { genre: "illisible", ecrit: mauvais }, mauvais);
  assert.equal(estAucun("aucun"), true);
  assert.equal(estAucun("aucun objet"), false);
});

test("notation — la colonne Type : des types séparés par « / », le multiplicateur après le dernier seulement", () => {
  assert.deepEqual(lireTypes(""), { types: [], multiplicateur: null });
  assert.deepEqual(lireTypes("Hachoir"), { types: ["Hachoir"], multiplicateur: null });
  assert.deepEqual(lireTypes("Hachoir/Saucier[2]"), { types: ["Hachoir", "Saucier"], multiplicateur: { ecrit: "2", valeur: fraction(2) } });
  assert.deepEqual(lireTypes("  Commis /  Rôtisseur  des  bois [ 1,4 ] "), { types: ["Commis", "Rôtisseur des bois"], multiplicateur: { ecrit: "1,4", valeur: fraction(7, 5) } });
  const defauts = {
    "Hachoir[2]/Saucier": /qu'une fois, après la dernière classe/,
    "Hachoir[2]/Saucier[3]": /qu'une fois, après la dernière classe/,
    "Hachoir[2": /« \[ » jamais fermé/,
    "Hachoir2]": /« \] » sans « \[ »/,
    "Hachoir]2[": /qu'une fois, après la dernière classe/,
    "Hachoir[0]": /le multiplicateur est nul/,
    "Hachoir[0,0]": /le multiplicateur est nul/,
    "Hachoir[-1]": /« -1 » n'est pas un nombre positif/,
    "Hachoir[deux]": /« deux » n'est pas un nombre positif/,
    "Hachoir[]": /le multiplicateur est vide/,
    "Hachoir//Saucier": /un nom de classe manque/,
    "/Hachoir": /un nom de classe manque/,
    "[2]": /un nom de classe manque/,
  };
  for (const [ecrit, motif] of Object.entries(defauts)) {
    const lu = lireTypes(ecrit);
    assert.match(lu.defaut ?? "", motif, ecrit);
    assert.deepEqual([lu.types, lu.multiplicateur], [[], null], ecrit);
  }
});

test("notation — la localisation : la première face de chaque zone, rangées par face, la dernière jusqu'à 20", () => {
  assert.deepEqual(lireLocalisation(""), { genre: "herite" });
  assert.deepEqual(lireLocalisation("aucune"), { genre: "zones", zones: [], defauts: [] });
  // Écrite dans le désordre, sur plusieurs lignes, avec des espaces superflus.
  const lue = lireLocalisation("Tête( 20 ),\n Aile  droite (12) ,\nTorse(2)");
  assert.deepEqual(lue.defauts, []);
  assert.deepEqual(lue.zones, [
    { nom: "Torse", code: "torse", approchee: false, debut: 2, fin: 11 },
    { nom: "Aile droite", code: null, approchee: false, debut: 12, fin: 19 },
    { nom: "Tête", code: "tete", approchee: false, debut: 20, fin: 20 },
  ]);
  // Une seule zone couvre de 2 à 20.
  assert.deepEqual(lireLocalisation("Masse(2)").zones, [{ nom: "Masse", code: null, approchee: false, debut: 2, fin: 20 }]);
  const defauts = {
    "Torse(2), Tête(21)": /« Tête » commence sur la face 21, hors de 2 à 20/,
    "Torse(2), Tête(0)": /« Tête » commence sur la face 0, hors de 2 à 20/,
    "Torse(1), Tête(18)": /« Torse » commence sur la face 1, qui est la contre-attaque/,
    "Torse(2), Tête(2)": /« Torse » et « Tête » commencent sur la même face, 2/,
    "Torse(3), Tête(18)": /aucune zone ne couvre la face 2/,
    "Torse(6), Tête(18)": /aucune zone ne couvre les faces 2 à 5/,
    "Torse 2": /« Torse 2 » ne s'écrit pas Nom\(face\)/,
    "(2)": /« \(2\) » ne s'écrit pas Nom\(face\)/,
    "Torse(deux)": /« deux » n'est pas une face du d20/,
    "Torse(2,5)": /« 2,5 » n'est pas une face du d20/,
    "Torse(2": /ne s'écrit pas Nom\(face\)/,
  };
  for (const [ecrit, motif] of Object.entries(defauts)) {
    const fautive = lireLocalisation(ecrit);
    assert.match(fautive.defauts.join(" ; "), motif, ecrit);
    assert.deepEqual(fautive.zones, [], `${ecrit} : une grille fautive n'est pas rendue`);
  }
});

test("notation — les six zones des personnages se reconnaissent sans casse, accents ni espaces ; à deux lettres près, avec un signalement", () => {
  const exactes = { Torse: "torse", " jambe  GAUCHE ": "jambe_gauche", "Jambe droite": "jambe_droite", brasgauche: "bras_gauche", "BRAS DROIT": "bras_droit", tete: "tete", "Tête": "tete" };
  for (const [nom, code] of Object.entries(exactes)) assert.deepEqual(reconnaitreZone(nom), { code, approchee: false }, nom);
  const approchees = { "Jambre droite": "jambe_droite", Torso: "torse", "Bras droite": "bras_droit", "Jmbe gauche": "jambe_gauche", Tige: "tete" };
  for (const [nom, code] of Object.entries(approchees)) assert.deepEqual(reconnaitreZone(nom), { code, approchee: true }, nom);
  // Au-delà de deux lettres d'écart, la zone est libre : elle n'est aucune des six.
  for (const nom of ["Corps", "Aile gauche", "Pince droite", "Queue", "Masse corporelle", "Jambe", "Tentacule"]) assert.equal(reconnaitreZone(nom), null, nom);
});

test("notation — une liste : noms et nombre entre crochets, « // » en tête, « aucun » ; une virgule entre crochets ne sépare pas", () => {
  assert.deepEqual(lireListe(""), { genre: "herite" });
  assert.deepEqual(lireListe("aucun"), { genre: "liste", reprise: false, entrees: [], defauts: [] });
  assert.deepEqual(lireListe("Aucune"), { genre: "liste", reprise: false, entrees: [], defauts: [] });
  assert.deepEqual(lireListe("//"), { genre: "liste", reprise: true, entrees: [], defauts: [] });
  assert.deepEqual(lireListe("//, Maîtrise[1], Pas  chassé"), {
    genre: "liste",
    reprise: true,
    entrees: [{ nom: "Maîtrise", crochet: "1" }, { nom: "Pas chassé", crochet: null }],
    defauts: [],
  });
  assert.deepEqual(lireListe("// Dague").entrees, [{ nom: "Dague", crochet: null }]);
  assert.equal(lireListe("// Dague").reprise, true);
  assert.deepEqual(lireListe("Dague[2,5], Arc [ 3 ],").entrees, [{ nom: "Dague", crochet: "2,5" }, { nom: "Arc", crochet: "3" }]);
  assert.equal(lireListe("Dague, Arc").reprise, false);
  const defauts = {
    "Dague[2": /« Dague\[2 » : crochet « \[ » jamais fermé/,
    "Dague]": /« \] » sans « \[ » qui l'ouvre/,
    "Dague, //": /« \/\/ » ne se place qu'en tête de la liste/,
    "Dague(lancer)": /« Dague\(lancer\) » : forme non reconnue/,
    "Dague[1][2]": /forme non reconnue/,
    "[2]": /forme non reconnue/,
  };
  for (const [ecrit, motif] of Object.entries(defauts)) assert.match((lireListe(ecrit).defauts ?? []).join(" ; "), motif, ecrit);
  // Ce qui se lit entre dans la liste, le reste laisse un défaut : rien n'est avalé.
  assert.deepEqual(noms(lireListe("Dague, Arc[2, Fronde").entrees), ["Dague"]);
});

test("notation — une cellule faite d'un très long blanc se lit sans délai : ses blancs sont réduits d'abord", () => {
  // Une cellule d'Excel tient 32 767 signes. Sans réduction, ces trois lectures prenaient
  // ensemble plus d'une seconde (mesuré le 11/10/2026) ; réduites, quelques millisecondes.
  const blanc = " ".repeat(32000);
  const debut = performance.now();
  assert.deepEqual(noms(lireListe(`Dague${blanc}longue [2]${blanc},${blanc}Arc`).entrees), ["Dague longue", "Arc"]);
  assert.deepEqual(noms(lireLocalisation(`Aile${blanc}droite${blanc}(${blanc}2${blanc})`).zones), ["Aile droite"]);
  assert.deepEqual(lireTypes(`Commis${blanc}des${blanc}bois${blanc}/${blanc}Rôtisseur[${blanc}2${blanc}]`).types, ["Commis des bois", "Rôtisseur"]);
  assert.match(lireListe(`x${blanc}y(`).defauts.join(""), /jamais fermée/);
  assert.ok(performance.now() - debut < 400, `lecture en ${Math.round(performance.now() - debut)} ms`);
});

test("qualité — écrite avec deux décimales au plus, à la virgule ; le calcul garde la fraction", () => {
  const ecrites = [[fraction(2), "2"], [fraction(14, 5), "2,8"], [fraction(8, 3), "2,67"], [fraction(5, 2), "2,5"], [fraction(401, 200), "2,01"], [fraction(501, 250), "2"], [fraction(0), "0"], [fraction(1, 3), "0,33"]];
  for (const [q, ecrit] of ecrites) assert.equal(ecrireQualite(q), ecrit, `${q.n}/${q.d}`);
});

// ─── L'héritage (§ 16.2) ────────────────────────────────────────────────────

test("héritage — deux types appliqués dans l'ordre : pour chaque cellule non vide, le suivant l'emporte", () => {
  const r = demo("Marmiton de corvée");
  assert.deepEqual(r.types, [{ nom: "Commis", absent: false }, { nom: "Rôtisseur", absent: false }]);
  assert.equal(r.multiplicateur, null);
  // Actions du Commis, que le Rôtisseur laisse vides ; souffle, attaque, défense du Rôtisseur.
  assert.deepEqual(nombres(r), [1, 5, 4, 5]);
  assert.deepEqual(r.actions.origine, { type: "Commis", multiplie: false });
  assert.deepEqual(r.souffle.origine, { type: "Rôtisseur", multiplie: false });
  assert.deepEqual(r.localisation, { origine: { type: "Commis", multiplie: false }, invalide: false });
  assert.deepEqual(r.zones.map((z) => [z.nom, z.debut, z.fin, z.faces]), [
    ["Torse", 2, 11, 10], ["Jambe gauche", 12, 13, 2], ["Jambre droite", 14, 15, 2], ["Bras gauche", 16, 17, 2], ["Bras droit", 18, 19, 2], ["Tête", 20, 20, 1],
  ]);
  assert.deepEqual(r.equipement.map((o) => [o.nom, o.genre, o.qualite, o.pieces]), [
    ["Spatule souple", "bloc", "2", null],
    ["Armure agile", "pack", "2", ["Tablier de cuir", "Maniques", "Toque renforcée"]],
  ]);
  // « // » : la liste du Rôtisseur s'ajoute à celle du Commis.
  assert.deepEqual(r.maitrises.map((m) => [m.nom, m.rang, m.type]), [["Maîtrise de l'agile", 1, "agile"]]);
  assert.deepEqual(noms(r.capacites), ["Frappe", "Moulinet farineux", "Pas chassé"]);
  assert.equal(r.complet, true);
  assert.deepEqual([r.corps, r.resistance, r.zones[0].resistance], [10, 5, 5]);
});

test("héritage — l'ordre des types compte : le dernier l'emporte, cellule par cellule", async () => {
  const { de } = await feuille([["Endroit", "Commis/Rôtisseur"], ["Envers", "Rôtisseur/Commis"]]);
  assert.deepEqual(nombres(de("Endroit")), [1, 5, 4, 5]);
  assert.deepEqual(nombres(de("Envers")), [1, 2, 3, 4]);
  // Le Commis, appliqué en dernier, écrit ses capacités sans « // » : elles remplacent celles du Rôtisseur.
  assert.deepEqual(de("Envers").maitrises, []);
  assert.deepEqual(noms(de("Envers").equipement), ["Spatule souple", "Armure agile"]);
});

test("multiplicateur — il multiplie les quatre nombres et la qualité de l'équipement hérités, la qualité 2 par défaut comprise", () => {
  const r = demo("Chef de partie");
  assert.equal(r.multiplicateur, "1,4");
  // 1 × 1,4 = 1,4 ; 5 × 1,4 = 7 ; 4 × 1,4 = 5,6 ; 5 × 1,4 = 7 : l'entier inférieur, une fois, à la fin.
  assert.deepEqual(nombres(r), [1, 7, 5, 7]);
  assert.deepEqual(r.attaque.origine, { type: "Rôtisseur", multiplie: true });
  assert.deepEqual(r.actions.origine, { type: "Commis", multiplie: true });
  // La qualité 2 par défaut devient 2,8 : 5/10/15 × (1/3 + 2,8/3) = 6,33 / 12,67 / 19.
  assert.deepEqual(r.equipement.map((o) => [o.nom, o.qualite, o.origine]), [
    ["Spatule souple", "2,8", { type: "Rôtisseur", multiplie: true }],
    ["Armure agile", "2,8", { type: "Rôtisseur", multiplie: true }],
  ]);
  assert.deepEqual(capacite(r, "Frappe").armes, [{ nom: "Spatule souple", degats: "6/12/19", portee: null, desavantage: false }]);
  // 30 × 3,8/3 = 38 ; 15 × 3,8/3 = 19 ; 5 × 3,8/3 = 6,33.
  assert.deepEqual(armures(r), [38, 0, 0, 19, 19, 6]);
});

test("multiplicateur — il ne touche ni les faces du d20, ni le rang des capacités, ni ce que l'adversaire écrit dans sa ligne", async () => {
  const chef = demo("Chef de partie");
  assert.deepEqual(chef.zones.map((z) => [z.debut, z.fin]), demo("Marmiton de corvée").zones.map((z) => [z.debut, z.fin]));
  // Moulinet farineux, hérité de la spatule : rang 1, coût 5 × N = 5, sous ×1,4 comme sans.
  assert.deepEqual([capacite(chef, "Moulinet farineux").rang, capacite(chef, "Moulinet farineux").cout.souffle], [1, "5"]);

  const { de } = await feuille([
    ["Second", "Commis/Rôtisseur[2]", _, _, _, 5, _, "//, Couteau d'office[3], Rouleau de fonte", _],
    ["Doublé", "Commis/Rôtisseur[2]"],
  ]);
  const second = de("Second");
  // L'attaque écrite dans sa ligne reste 5 ; le reste est doublé.
  assert.deepEqual(nombres(second), [2, 10, 5, 10]);
  assert.deepEqual(second.attaque.origine, { type: null, multiplie: false });
  // L'équipement hérité passe de la qualité 2 à 4 ; celui de sa ligne garde la sienne.
  assert.deepEqual(second.equipement.map((o) => [o.nom, o.qualite, o.origine.type, o.origine.multiplie]), [
    ["Spatule souple", "4", "Rôtisseur", true],
    ["Armure agile", "4", "Rôtisseur", true],
    ["Couteau d'office", "3", null, false],
    ["Rouleau de fonte", "2", null, false],
  ]);
  // Une spatule héritée sous [2] est de qualité 4 : 15 × (1/3 + 4/3) vaut 25, jamais 24.
  const double = de("Doublé");
  assert.deepEqual(capacite(double, "Frappe").armes[0].degats, "8/16/25");
  assert.deepEqual(armures(double), [50, 0, 0, 25, 25, 8]);
  assert.deepEqual(nombres(double), [2, 10, 8, 10]);
});

test("arrondi — exact en fractions, à l'entier inférieur une seule fois, à la fin", async () => {
  const { de } = await feuille(
    [
      ["Type", "Demi", "Corps(2), Tête(18)", 3, 5, 3, 7],
      ["A", "Demi[1,5]"],
      ["B", "Demi[0,5]"],
      // Deux pièces à 26,67 et 6,67 : 33,33 donne 33 ; arrondies chacune, elles donneraient 32.
      ["C", "Demi", _, _, _, _, _, "Écaille fine[3], Toque renforcée[3]"],
    ],
    { blocs: [["Écaille fine", "Armure", _, "{armure:20}", "Armure naturelle globale ; I3", "Armure naturelle"]] },
  );
  assert.deepEqual(nombres(de("A")), [4, 7, 4, 10]); // 4,5 ; 7,5 ; 4,5 ; 10,5
  assert.deepEqual(nombres(de("B")), [1, 2, 1, 3]); // 1,5 ; 2,5 ; 1,5 ; 3,5
  assert.deepEqual(armures(de("C")), [26, 33]);
});

test("cellules — « aucun » veut dire rien pour une liste et 0 pour un nombre ; une liste sans « // » remplace la liste héritée", async () => {
  const plongeur = demo("Plongeur");
  assert.deepEqual(nombres(plongeur), [1, 0, 4, 5]);
  assert.deepEqual(plongeur.souffle.origine, { type: null, multiplie: false });
  assert.deepEqual(plongeur.equipement, []);
  assert.deepEqual(armures(plongeur), [0, 0, 0, 0, 0, 0]);
  // Ses capacités viennent toujours de ses types.
  assert.deepEqual(noms(plongeur.capacites), ["Pas chassé"]);
  assert.deepEqual(noms(plongeur.maitrises), ["Maîtrise de l'agile"]);

  const { de } = await feuille([
    ["Muet", "Commis/Rôtisseur", _, _, _, _, _, _, "aucune"],
    ["Remplaçant", "Commis/Rôtisseur", _, _, _, _, _, "Couteau d'office", "Goûter"],
    ["Renfort", "Commis/Rôtisseur", _, _, _, _, _, "//, Couteau d'office", "//, Goûter"],
  ]);
  // « aucune » efface les capacités citées ; celles de l'équipement restent.
  assert.deepEqual([noms(de("Muet").capacites), noms(de("Muet").maitrises)], [["Frappe", "Moulinet farineux"], []]);
  assert.deepEqual(noms(de("Remplaçant").equipement), ["Couteau d'office"]);
  assert.deepEqual([noms(de("Remplaçant").capacites), noms(de("Remplaçant").maitrises)], [["Frappe", "Émincer", "Goûter"], []]);
  assert.deepEqual(noms(de("Renfort").equipement), ["Spatule souple", "Armure agile", "Couteau d'office"]);
  assert.deepEqual(noms(de("Renfort").capacites), ["Frappe", "Moulinet farineux", "Émincer", "Pas chassé", "Goûter"]);
});

test("cellules — chaque liste dit d'où vient la dernière cellule écrite sans « // », celle qui remplace ce qui précède : une liste vide dit ainsi qui la vide", async () => {
  const SA_LIGNE = { type: null, multiplie: false };
  const de_ = (type) => ({ type, multiplie: false });
  // Le Plongeur écrit « aucun » dans son équipement ; ses capacités viennent du Commis, le Rôtisseur n'y ajoutant qu'avec « // ».
  assert.deepEqual(demo("Plongeur").listes, { equipement: SA_LIGNE, capacites: de_("Commis") });
  // Le multiplicateur ne touche pas l'origine d'une liste : il n'y a rien à multiplier dans une liste vide.
  assert.deepEqual(demo("Chef de partie").listes.equipement, de_("Rôtisseur"));
  // Sans type, tout vient de sa ligne ; une cellule que personne n'écrit n'a pas d'origine.
  assert.deepEqual(demo("Homard furieux").listes.equipement, SA_LIGNE);
  assert.equal(demo("Mouette chapardeuse").listes.equipement, null);
  const { de } = await feuille([
    ["Type", "Dépouillé", _, _, _, _, _, "aucun", "aucune"],
    ["Nu", "Commis/Rôtisseur/Dépouillé"],
    ["Rhabillé", "Commis/Rôtisseur/Dépouillé", _, _, _, _, _, "//, Couteau d'office"],
    ["Muet", "Commis/Rôtisseur", _, _, _, _, _, _, "aucune"],
  ]);
  // Un type qui écrit « aucun » vide la liste des types qui le précèdent, et c'est lui qui est nommé.
  assert.deepEqual([de("Nu").equipement, de("Nu").listes], [[], { equipement: de_("Dépouillé"), capacites: de_("Dépouillé") }]);
  // « // » ajoute sans remplacer : l'origine de la liste reste celle qui l'a vidée.
  assert.deepEqual([noms(de("Rhabillé").equipement), de("Rhabillé").listes.equipement], [["Couteau d'office"], de_("Dépouillé")]);
  assert.deepEqual(de("Muet").listes, { equipement: de_("Rôtisseur"), capacites: SA_LIGNE });
});

// ─── Les valeurs (§ 16.3) ───────────────────────────────────────────────────

test("localisation — une grille propre à chaque adversaire ; les zones libres n'ont pas de code", () => {
  const homard = demo("Homard furieux");
  assert.deepEqual(homard.types, []);
  assert.deepEqual(homard.zones.map((z) => [z.nom, z.code, z.debut, z.fin, z.faces]), [
    ["Corps", null, 2, 11, 10], ["Pince gauche", null, 12, 14, 3], ["Pince droite", null, 15, 17, 3], ["Tête", "tete", 18, 20, 3],
  ]);
  assert.deepEqual(homard.localisation.origine, { type: null, multiplie: false });
  // Un nom proche est reconnu : la zone garde son nom tel qu'écrit, et porte le code de la zone lue.
  const jambe = demo("Marmiton de corvée").zones[2];
  assert.deepEqual([jambe.nom, jambe.code, jambe.approchee], ["Jambre droite", "jambe_droite", true]);
  assert.deepEqual(nombres(demo("Mouette chapardeuse")), [2, null, 2, 3]);
});

test("armure — une pièce à une valeur est globale, et les autres s'y ajoutent ; une pièce à six valeurs se pose par nom de zone", async () => {
  const homard = demo("Homard furieux");
  // Carapace 30 partout ; la toque, de qualité 3, ajoute 5 × 4/3 = 6,67 à la tête : 36.
  assert.deepEqual(armures(homard), [30, 30, 30, 36]);
  assert.deepEqual(homard.zones[3].pieces, ["Carapace épaisse [2]", "Toque renforcée [3]"]);
  assert.deepEqual(homard.zones[0].pieces, ["Carapace épaisse [2]"]);

  const { de } = await feuille(
    [
      // Six valeurs se posent par nom, quel que soit l'ordre des zones sur le d20.
      ["Renversé", _, "Tête(2), Torse(10)", 1, 1, 1, 1, "Tablier de cuir, Toque renforcée"],
      // Deux pièces globales s'additionnent.
      ["Cuirassé", _, "Corps(2), Queue(15)", 1, 1, 1, 1, "Carapace épaisse, Écaille fine[3,5]"],
      // Autant de valeurs que de zones : dans l'ordre du d20, et la globale s'y ajoute.
      ["Sur mesure", _, "Corps(2), Pince gauche(12), Pince droite(15), Queue(18)", 1, 1, 1, 1, "Cuirasse sur mesure, Carapace épaisse"],
    ],
    {
      blocs: [
        ["Écaille fine", "Armure", _, "{armure:20}", "I3", "Armure naturelle"],
        ["Cuirasse sur mesure", "Armure", _, "{armure:10/20/0/40}", "I3", "Armure naturelle"],
      ],
    },
  );
  assert.deepEqual(de("Renversé").zones.map((z) => [z.nom, z.armure]), [["Tête", 5], ["Torse", 30]]);
  assert.deepEqual(armures(de("Cuirassé")), [60, 60]); // 30 + 20 × (1/3 + 3,5/3)
  assert.deepEqual(armures(de("Sur mesure")), [40, 50, 30, 70]);
});

test("armure — sur une zone, la dernière pièce non globale l'emporte ; une valeur nulle ne couvre rien", async () => {
  const { de } = await feuille([
    ["A", "Commis", _, _, _, _, _, "Tablier de cuir, Plastron de fonte"],
    ["B", "Commis", _, _, _, _, _, "Plastron de fonte, Tablier de cuir"],
    ["C", "Commis", _, _, _, _, _, "Plastron de fonte, Maniques, Toque renforcée"],
  ]);
  // Pas la plus élevée, comme pour un personnage : la dernière écrite.
  assert.deepEqual(armures(de("A")), [40, 0, 0, 0, 0, 0]);
  assert.deepEqual(armures(de("B")), [30, 0, 0, 0, 0, 0]);
  // Les maniques et la toque ont 0 sur le torse : le plastron y reste.
  assert.deepEqual(armures(de("C")), [40, 0, 0, 15, 15, 5]);
  assert.deepEqual(de("C").zones[0].pieces, ["Plastron de fonte [2]"]);
});

test("armure — les trois packs : toutes les pièces de type Armure qui portent l'élément, à la qualité du pack ; une armure naturelle n'en est pas", async () => {
  const { de } = await feuille([
    ["Lourd", "Commis", _, _, _, _, _, "ARMURE LOURDE[3]"],
    ["Précis", "Commis", _, _, _, _, _, "armure precise"],
  ]);
  assert.deepEqual(de("Lourd").equipement.map((o) => [o.nom, o.ecrit, o.genre, o.qualite, o.pieces]), [["Armure lourde", "ARMURE LOURDE", "pack", "3", ["Plastron de fonte"]]]);
  assert.deepEqual(armures(de("Lourd")), [53, 0, 0, 0, 0, 0]); // 40 × 4/3 = 53,33
  assert.deepEqual(de("Précis").equipement[0].pieces, ["Guêtres de toile"]);
  assert.deepEqual(armures(de("Précis")), [0, 10, 10, 0, 0, 0]);
  for (const pack of ["Armure lourde", "Armure agile", "Armure précise"]) {
    const { de: d } = await feuille([["P", "Commis", _, _, _, _, _, pack]]);
    assert.equal(d("P").equipement[0].pieces.includes("Carapace épaisse"), false, pack);
  }
});

// ─── L'équipement et les capacités (§ 16.4) ─────────────────────────────────

test("armes — plusieurs sont permises, chacune avec ses dégâts ; une capacité que deux armes donnent ne figure qu'une fois", () => {
  const homard = demo("Homard furieux");
  assert.deepEqual(noms(homard.equipement), ["Carapace épaisse", "Toque renforcée", "Pinces de homard", "Couteau d'office"]);
  // Les capacités de l'équipement, dans l'ordre des objets puis de chaque bloc.
  assert.deepEqual(noms(homard.capacites), ["Frappe", "Choc sourd", "Émincer"]);
  const frappe = capacite(homard, "Frappe");
  assert.deepEqual(frappe.armes, [
    { nom: "Pinces de homard", degats: "4/8/12", portee: null, desavantage: false },
    { nom: "Couteau d'office", degats: "3/8/20", portee: 1, desavantage: true },
  ]);
  assert.deepEqual(frappe.descriptions, [
    { source: "Pinces de homard", texte: "Une attaque qui inflige 4/8/12." },
    { source: "Couteau d'office", texte: "Une attaque qui inflige 3/8/20." },
  ]);
  assert.deepEqual(frappe.origines, [{ objet: "Pinces de homard" }, { objet: "Couteau d'office" }]);
  assert.deepEqual(capacite(homard, "Choc sourd").armes, [{ nom: "Pinces de homard", degats: "4/8/12", portee: null, desavantage: false }]);
  assert.deepEqual(capacite(homard, "Choc sourd").cout, { souffle: "2", lien: "0" });
  assert.deepEqual(capacite(homard, "Émincer").armes, [{ nom: "Couteau d'office", degats: "3/8/20", portee: 1, desavantage: true }]);
});

test("qualité — les dégâts valent {degats} × (1/3 + qualité/3) ; sans crochets, 2, ou la qualité que le classeur fixe au bloc", async () => {
  const { de } = await feuille(
    [
      ["Un", "Commis", _, _, _, _, _, "Spatule souple[1]"],
      ["Trois", "Commis", _, _, _, _, _, "Spatule souple[3]"],
      ["Zéro", "Commis", _, _, _, _, _, "Spatule souple[0]"],
      ["Fixé", "Commis", _, _, _, _, _, "Hachoir béni"],
      ["Refixé", "Commis", _, _, _, _, _, "Hachoir béni[2]"],
      ["Type", "Béni", _, _, _, _, _, "Hachoir béni"],
      ["Hérité", "Commis/Béni[2]"],
    ],
    { blocs: [["Hachoir béni", "Arme, Agile", "Frappe", "{degats:6/9/12}, {qualite:5}, {portee:0}", "Qualité fixée par le classeur", "Arme"]] },
  );
  const degats = (nom) => capacite(de(nom), "Frappe").armes[0].degats;
  assert.equal(degats("Un"), "3/6/10"); // × 2/3
  assert.equal(degats("Trois"), "6/13/20"); // × 4/3
  assert.equal(degats("Zéro"), "1/3/5"); // × 1/3
  assert.deepEqual([de("Fixé").equipement[0].qualite, degats("Fixé")], ["5", "12/18/24"]);
  assert.deepEqual([de("Refixé").equipement[0].qualite, degats("Refixé")], ["2", "6/9/12"]);
  // Héritée sous [2], la qualité 5 du bloc devient 10.
  assert.deepEqual([de("Hérité").equipement[0].qualite, degats("Hérité")], ["10", "22/33/44"]);
});

test("capacités — celles de l'équipement d'abord, puis les citées ; rang 1 par défaut, 0 pour celle qui n'évolue pas ; une citée que l'équipement donne aussi ne figure qu'une fois", async () => {
  const { de, anomalies } = await feuille([["A", "Commis", _, _, _, _, _, "Spatule souple", "Goûter, Frappe, Fournaise, Pas chassé"]]);
  assert.deepEqual(anomalies, []);
  const a = de("A");
  assert.deepEqual(a.capacites.map((c) => [c.nom, c.rang, c.evolue]), [
    ["Frappe", 0, false], ["Moulinet farineux", 1, true], ["Goûter", 0, false], ["Fournaise", 1, true], ["Pas chassé", 1, true],
  ]);
  // Frappe : donnée par la spatule et citée dans la ligne.
  assert.deepEqual(capacite(a, "Frappe").origines, [{ objet: "Spatule souple" }, { type: null, multiplie: false }]);
  assert.deepEqual(capacite(a, "Goûter").armes, []);
});

test("capacités — un bloc ne donne que ses capacités simples : un groupe au choix ne l'est pas, rien n'étant choisi", async () => {
  // Saucier : trois capacités simples, puis deux groupes ( a | b ) ; Tablier : un seul groupe [ a | b ].
  const { de, anomalies } = await feuille([["A", "Commis", _, _, _, _, _, "Saucier, Tablier"]]);
  assert.deepEqual(anomalies, []);
  assert.deepEqual(noms(de("A").capacites), ["Réduction", "Flambage", "Dressage minute", "Pas chassé"]);
  // La maîtrise proposée au choix par le Saucier n'est pas donnée.
  assert.deepEqual(de("A").maitrises, []);
});

test("feuille — une ligne de type se reconnaît à « Type » dans la colonne Nom, sans casse", async () => {
  const { banque, anomalies, de } = await feuille([["type", "Mitron", "Corps(2)", 1, 1, 1, 1], ["TYPE", "Gâte-pâte", _, 2], ["A", "Mitron/Gâte-pâte"]]);
  assert.deepEqual(anomalies, []);
  assert.deepEqual(noms(banque.types_adversaires), ["Commis", "Rôtisseur", "Mitron", "Gâte-pâte"]);
  assert.deepEqual(noms(banque.adversaires), ["Marmiton", "A"]);
  assert.deepEqual(nombres(de("A")), [2, 1, 1, 1]);
});

test("capacités — un rang propre remplace le rang hérité ; le dernier écrit compte", () => {
  const chef = demo("Chef de partie");
  // Le Rôtisseur donne la maîtrise au rang 1, le Commis le pas chassé au rang 1 : la ligne du chef écrit 3 et 2.
  assert.deepEqual(chef.maitrises.map((m) => [m.nom, m.rang]), [["Maîtrise de l'agile", 3]]);
  assert.deepEqual([capacite(chef, "Pas chassé").rang, capacite(chef, "Pas chassé").cout], [2, { souffle: "1", lien: "0" }]);
  assert.deepEqual(capacite(chef, "Pas chassé").descriptions, [{ source: null, texte: "Se déplace de 2 cases." }]);
  assert.deepEqual(capacite(chef, "Pas chassé").origines, [{ type: "Commis", multiplie: false }, { type: null, multiplie: false }]);
  // Les maîtrises ne figurent pas parmi les capacités.
  assert.equal(capacite(chef, "Maîtrise de l'agile"), undefined);
  assert.deepEqual(noms(chef.capacites), ["Frappe", "Moulinet farineux", "Pas chassé"]);
});

test("capacités — le coût s'évalue au rang, X reste X, le lien se dit ; la description s'évalue comme pour le personnage", async () => {
  const { de } = await feuille([
    ["A", "Commis", _, _, _, _, _, "Couvercle de marmite[3]", "Fournaise[3], Jet de sel, Flambage[2], Marmitage[3]"],
    ["B", "Commis", _, _, _, _, _, _, "Fournaise, Fournaise[2]"],
  ]);
  const a = de("A");
  assert.deepEqual([capacite(a, "Fournaise").rang, capacite(a, "Fournaise").cout], [3, { souffle: "7", lien: "1" }]);
  // {portee} vient de l'élément propre de la variante de puissance 3, Portée[2].
  assert.equal(capacite(a, "Fournaise").descriptions[0].texte, "Aveugle une cible à 2 cases.");
  assert.deepEqual(capacite(a, "Jet de sel").cout, { souffle: "X", lien: "0" });
  assert.equal(capacite(a, "Jet de sel").descriptions[0].texte, "Lance du sel à 2 pas.\nPuis recommence.");
  assert.deepEqual([capacite(a, "Flambage").cout.souffle, capacite(a, "Flambage").descriptions[0].texte], ["10", "Multiplie les dégâts par 3."]);
  assert.deepEqual([capacite(a, "Marmitage").cout.souffle, capacite(a, "Marmitage").descriptions[0].texte], ["2", "Mijote 3 tours."]);
  // Un bouclier donne ses capacités, à sa qualité : 8 × (1/3 + 3/3) = 10,67 ; la Défense reste celle du Commis.
  assert.equal(capacite(a, "Se couvrir").descriptions[0].texte, "Reportez les dommages sur les 10 points du couvercle.");
  assert.equal(a.defense.valeur, 4);
  // Citée deux fois : une seule capacité, au dernier rang écrit.
  assert.deepEqual(de("B").capacites.map((c) => [c.nom, c.rang, c.cout.souffle]), [["Fournaise", 2, "3"]]);
});

test("capacités — un rang au-delà du maximum y est ramené ; un rang donné à une capacité qui n'évolue pas est ignoré", async () => {
  const { de, anomalies } = await feuille([["A", "Commis", _, _, _, _, _, _, "Pas chassé[5], Goûter[2], Fournaise[9]"]]);
  assert.deepEqual(anomalies.map((a) => a[0]), ["A13", "A13", "A14"]);
  // Pas chassé [3] : N − 1 = 2 de souffle ; Fournaise, à trois variantes, s'arrête à la troisième.
  assert.deepEqual(de("A").capacites.map((c) => [c.nom, c.rang, c.cout.souffle]), [["Pas chassé", 3, "2"], ["Goûter", 0, "0"], ["Fournaise", 3, "7"]]);
});

test("maîtrises — par l'élément « Maîtrise », ou à défaut par les trois noms ; associées à Lourde, Agile, Précise par leur nom", async () => {
  const parNom = (nom) => maitriseDe(BANQUE.capacites.find((c) => c.nom === nom));
  assert.deepEqual(parNom("Maîtrise du lourd"), { type: "lourde" });
  assert.deepEqual(parNom("Maîtrise de l'agile"), { type: "agile" });
  assert.deepEqual(parNom("Maîtrise du précis"), { type: "precise" });
  assert.equal(parNom("Frappe"), null);
  assert.equal(parNom("Vif"), null);
  // Sans l'élément « Maîtrise » : les trois noms du classeur de l'auteur, écrits à l'accent près.
  const { de, anomalies } = await feuille([["A", "Commis", _, _, _, _, _, "Spatule souple", "//, Maitrise du combat agile[2]"]], {
    capacites: [["Maîtrise du combat agile", "N", _, _, _, "Les [N] premières capacités d'un objet Agile, sans désavantage.", "Sans l'élément Maîtrise"]],
  });
  assert.deepEqual(anomalies.map((a) => a[0]), ["A1"]);
  assert.deepEqual(de("A").maitrises.map((m) => [m.nom, m.rang, m.type]), [["Maîtrise du combat agile", 2, "agile"]]);
  assert.deepEqual(capacite(de("A"), "Moulinet farineux").desavantage, []);
});

test("désavantage — toute capacité issue d'un bloc Lourde, Agile ou Précise, sauf si la maîtrise atteint sa position dans le bloc", async () => {
  // Maîtrise de l'agile [1] : seule la première capacité de la spatule y échappe.
  const marmiton = demo("Marmiton de corvée");
  assert.deepEqual([capacite(marmiton, "Frappe").desavantage, capacite(marmiton, "Frappe").desavantageEntier], [[], false]);
  assert.deepEqual([capacite(marmiton, "Moulinet farineux").desavantage, capacite(marmiton, "Moulinet farineux").desavantageEntier], [["Spatule souple"], true]);
  // Une capacité citée, qui ne vient d'aucun bloc, n'a jamais de désavantage.
  assert.deepEqual(capacite(marmiton, "Pas chassé").desavantage, []);
  // Maîtrise [3] : toutes y échappent.
  assert.deepEqual(demo("Chef de partie").capacites.flatMap((c) => c.desavantage), []);
  // Une arme naturelle, sans élément de poids : jamais ; le couteau, précis, sans maîtrise : toujours.
  const homard = demo("Homard furieux");
  assert.deepEqual([capacite(homard, "Frappe").desavantage, capacite(homard, "Frappe").desavantageEntier], [["Couteau d'office"], false]);
  assert.deepEqual([capacite(homard, "Choc sourd").desavantage, capacite(homard, "Émincer").desavantageEntier], [[], true]);

  const { de } = await feuille([
    // La maîtrise de l'agile ne vaut rien pour une arme lourde.
    ["Mêlé", "Commis/Rôtisseur", _, _, _, _, _, "//, Rouleau de fonte"],
    ["Sans", "Commis", _, _, _, _, _, "Spatule souple"],
    ["Deux", "Commis", _, _, _, _, _, "Spatule souple", "//, Maîtrise de l'agile[2]"],
  ]);
  assert.deepEqual([capacite(de("Mêlé"), "Frappe").desavantage, capacite(de("Mêlé"), "Frappe").desavantageEntier], [["Rouleau de fonte"], false]);
  assert.deepEqual(capacite(de("Mêlé"), "Choc sourd").desavantageEntier, true);
  assert.deepEqual(de("Sans").capacites.map((c) => [c.nom, c.desavantage.length]), [["Frappe", 1], ["Moulinet farineux", 1], ["Pas chassé", 0]]);
  assert.deepEqual(de("Deux").capacites.flatMap((c) => c.desavantage), []);
});

// ─── La règle des maîtrises, partagée avec le simulateur de combat (§ 17) ────

// Qui donne quoi dans un bloc : un adversaire reçoit les capacités simples
// et l'option d'un choix qui n'en a qu'une ; un personnage, les simples et
// les options qu'il a choisies.
const donneAUnAdversaire = (nom) => (entree) => (entree.forme === "simple" ? entree.nom : entree.forme === "choix" && entree.options.length === 1 ? entree.options[0] : null) === nom;
const donneAuPersonnage = (nom, choisies) => (entree) => (entree.forme === "simple" ? entree.nom === nom : (entree.options ?? []).some((option) => option === nom && choisies.includes(option)));

test("maîtrises — le rang de chaque poids est le plus haut possédé ; une capacité absente, une autre capacité ou un rang illisible n'y comptent pas", () => {
  const banque = (nom) => BANQUE.capacites.find((c) => c.nom === nom);
  const rangs = rangsDeMaitrise([
    { capacite: banque("Maîtrise de l'agile"), rang: 1 },
    { capacite: banque("Maîtrise de l'agile"), rang: 2 },
    { capacite: banque("Maîtrise du lourd"), rang: 0 },
    { capacite: banque("Frappe"), rang: 3 },
    { capacite: null, rang: 3 },
  ]);
  assert.ok(rangs instanceof Map);
  assert.deepEqual([...rangs], [["agile", 2], ["lourde", 0]]);
  // L'ordre des entrées ne compte pas : le plus haut, pas le dernier.
  assert.deepEqual([...rangsDeMaitrise([{ capacite: banque("Maîtrise du précis"), rang: 3 }, { capacite: banque("Maîtrise du précis"), rang: 1 }])], [["precise", 3]]);
  // Un rang qui n'est pas un entier (une capacité « à venir » d'un personnage) vaut 0, et n'efface pas un rang lu.
  assert.deepEqual([...rangsDeMaitrise([{ capacite: banque("Maîtrise de l'agile"), rang: 2 }, { capacite: banque("Maîtrise de l'agile"), rang: null }, { capacite: banque("Maîtrise du lourd"), rang: undefined }])], [["agile", 2], ["lourde", 0]]);
  // Un itérable convient aussi : resoudre() lui donne les valeurs d'une Map.
  assert.deepEqual([...rangsDeMaitrise(new Map([["a", { capacite: banque("Maîtrise du lourd"), rang: 2 }]]).values())], [["lourde", 2]]);
  assert.deepEqual([...rangsDeMaitrise([])], []);
});

test("maîtrises — hors maîtrise : le poids du bloc, la position atteinte ou non, un bloc à deux poids, un bloc sans poids, un rang 0", () => {
  const bloc = (nom) => INDEX.index.bloc(nom);
  const agile = (rang) => new Map([["agile", rang]]);
  // La spatule est agile : la maîtrise de l'agile au rang 1 couvre la première position, pas la deuxième.
  assert.deepEqual([1, 2, 3].map((position) => horsMaitrise(bloc("Spatule souple"), position, agile(1))), [false, true, true]);
  assert.deepEqual([1, 2, 3].map((position) => horsMaitrise(bloc("Spatule souple"), position, agile(2))), [false, false, true]);
  // Sans maîtrise, ou avec celle d'un autre poids : toujours.
  assert.deepEqual([horsMaitrise(bloc("Spatule souple"), 1, new Map()), horsMaitrise(bloc("Spatule souple"), 1, new Map([["lourde", 3]]))], [true, true]);
  // Un rang 0 ne lève rien : la première position est 1.
  assert.equal(horsMaitrise(bloc("Spatule souple"), 1, agile(0)), true);
  // Un bloc sans élément de poids (une arme naturelle) ne gêne jamais.
  assert.deepEqual([1, 9].map((position) => horsMaitrise(bloc("Pinces de homard"), position, new Map())), [false, false]);
  // Un bloc à deux poids demande les deux maîtrises.
  const double = { elements: [{ nom: "Arme" }, { nom: "Agile" }, { nom: "lourde" }, { nom: "Précise", cible: "Frappe" }], capacites: [] };
  assert.equal(horsMaitrise(double, 1, agile(3)), true, "l'agile seule");
  assert.equal(horsMaitrise(double, 1, new Map([["lourde", 3]])), true, "le lourd seul");
  assert.equal(horsMaitrise(double, 2, new Map([["agile", 3], ["lourde", 1]])), true, "le lourd n'atteint pas la position");
  // L'élément Précise qui vise une capacité n'est pas un poids du bloc : la maîtrise du précis n'est pas demandée.
  assert.equal(horsMaitrise(double, 2, new Map([["agile", 2], ["lourde", 2]])), false);
  // Une capacité que le bloc ne donne pas n'a pas de position : aucun désavantage à lui prêter.
  assert.equal(horsMaitrise(bloc("Spatule souple"), null, new Map()), false);
});

test("maîtrises — la position dans un bloc : l'indice de la première entrée qui donne la capacité, groupes et entrées illisibles comptés", async () => {
  const { index, de } = await feuille(
    [
      ["Groupe 2", "Commis", _, _, _, _, _, "Batte à groupes", "//, Maîtrise de l'agile[2]"],
      ["Groupe 3", "Commis", _, _, _, _, _, "Batte à groupes", "//, Maîtrise de l'agile[3]"],
      ["Fêlé 2", "Commis", _, _, _, _, _, "Batte fêlée", "//, Maîtrise de l'agile[2]"],
      ["Fêlé 3", "Commis", _, _, _, _, _, "Batte fêlée", "//, Maîtrise de l'agile[3]"],
      ["Un poids", "Commis", _, _, _, _, _, "Batte double", "//, Maîtrise de l'agile[3]"],
      ["Deux poids", "Commis", _, _, _, _, _, "Batte double", "//, Maîtrise de l'agile[3], Maîtrise du lourd[1]"],
      ["Rang nul", "Commis", _, _, _, _, _, "Spatule souple", "//, Maîtrise figée de l'agile"],
      ["Rang un", "Commis", _, _, _, _, _, "Spatule souple", "//, Maîtrise de l'agile"],
    ],
    {
      blocs: [
        ["Batte à groupes", "Arme, Agile", "( Goûter ), ( Recette secrète | Recette de grand-mère ), Frappe, Moulinet farineux", "{degats:1/2/3}", "Un choix à une option, un vrai groupe, puis deux capacités", "Arme"],
        ["Batte fêlée", "Arme, Agile", "Frappe, Goûter | Taloche, Moulinet farineux", "{degats:1/2/3}", "E6 : la deuxième entrée ne se lit pas", "Arme"],
        ["Batte double", "Arme, Agile, Lourde", "Frappe", "{degats:1/2/3}", "Deux poids", "Arme"],
      ],
      capacites: [["Maîtrise figée de l'agile", 0, _, _, "Maîtrise", "Une maîtrise qui n'évolue pas.", "Puissance 0 : rang 0"]],
    },
  );
  const bloc = (nom) => index.index.bloc(nom);
  // Les quatre formes d'une entrée : un choix à une option, un vrai groupe, une capacité simple, une entrée illisible.
  assert.deepEqual(bloc("Batte à groupes").capacites.map((e) => e.forme), ["choix", "choix", "simple", "simple"]);
  assert.deepEqual(bloc("Batte fêlée").capacites.map((e) => e.forme ?? "illisible"), ["simple", "illisible", "simple"]);
  const position = (nomBloc, nom) => positionDans(bloc(nomBloc), donneAUnAdversaire(nom));
  assert.deepEqual(["Goûter", "Frappe", "Moulinet farineux"].map((nom) => position("Batte à groupes", nom)), [1, 3, 4]);
  assert.deepEqual(["Frappe", "Moulinet farineux"].map((nom) => position("Batte fêlée", nom)), [1, 3]);
  // Personne ne choisit pour un adversaire : l'option d'un vrai groupe n'a pas de position chez lui ; un personnage qui l'a choisie l'a à la place du groupe.
  assert.equal(position("Batte à groupes", "Recette secrète"), null);
  assert.equal(positionDans(bloc("Batte à groupes"), donneAuPersonnage("Recette secrète", ["Recette secrète"])), 2);
  assert.equal(positionDans(bloc("Batte à groupes"), donneAuPersonnage("Recette secrète", ["Recette de grand-mère"])), null);
  assert.equal(positionDans(bloc("Batte à groupes"), donneAuPersonnage("Frappe", [])), 3);
  // Le Saucier d'Aubépine : trois capacités, le style choisi en quatrième, la maîtrise choisie en cinquième.
  const saucier = INDEX.index.bloc("Saucier");
  assert.deepEqual(["Réduction", "Solo du chef", "Maîtrise de l'agile", "Brigade"].map((nom) => positionDans(saucier, donneAuPersonnage(nom, ["Solo du chef", "Maîtrise de l'agile"]))), [1, 4, 5, null]);
  // Une capacité que le bloc donne deux fois prend sa première entrée ; un bloc sans liste n'a aucune position.
  assert.equal(positionDans({ capacites: [{ forme: "simple", nom: "Goûter" }, { forme: "simple", nom: "Frappe" }, { forme: "simple", nom: "Frappe" }] }, donneAUnAdversaire("Frappe")), 2);
  assert.deepEqual([positionDans({ capacites: [] }, () => true), positionDans({}, () => true), positionDans(null, () => true)], [null, null, null]);

  // La résolution compte de même. Le groupe compte : Frappe est en troisième place, Moulinet farineux en quatrième.
  const genees = (nom) => de(nom).capacites.filter((c) => c.desavantage.length).map((c) => c.nom);
  assert.deepEqual([genees("Groupe 2"), genees("Groupe 3")], [["Frappe", "Moulinet farineux"], ["Moulinet farineux"]]);
  // L'entrée illisible compte : Moulinet farineux est en troisième place, pas en deuxième.
  assert.deepEqual([genees("Fêlé 2"), genees("Fêlé 3")], [["Moulinet farineux"], []]);
  // Deux poids : la maîtrise de l'agile ne suffit pas, il faut aussi celle du lourd.
  assert.deepEqual([genees("Un poids"), genees("Deux poids")], [["Frappe"], []]);
  // Une maîtrise au rang 0 ne lève rien ; au rang 1, la première capacité.
  assert.deepEqual(de("Rang nul").maitrises.map((m) => [m.nom, m.rang, m.type]), [["Maîtrise figée de l'agile", 0, "agile"]]);
  assert.deepEqual([genees("Rang nul"), genees("Rang un")], [["Frappe", "Moulinet farineux"], ["Moulinet farineux"]]);
});

test("maîtrises — les trois fonctions redisent le désavantage de chaque capacité résolue, objet par objet", async () => {
  const { index, de } = await feuille([
    ["Mêlé", "Commis/Rôtisseur", _, _, _, _, _, "//, Rouleau de fonte, Rouleau à pâtisserie, Couteau d'office"],
    ["Deux", "Commis", _, _, _, _, _, "Spatule souple, Pinces de homard", "//, Maîtrise de l'agile[2], Maîtrise du lourd"],
  ]);
  let couples = 0;
  const verifier = (source, resolu) => {
    const rangs = rangsDeMaitrise(resolu.maitrises.map((maitrise) => ({ capacite: source.capacite(maitrise.nom), rang: maitrise.rang })));
    for (const c of resolu.capacites) {
      for (const objet of new Set(c.origines.map((origine) => origine.objet).filter(Boolean))) {
        const gene = horsMaitrise(source.bloc(objet), positionDans(source.bloc(objet), donneAUnAdversaire(c.nom)), rangs);
        assert.equal(gene, c.desavantage.includes(objet), `${resolu.nom}, ${c.nom}, ${objet}`);
        couples += 1;
      }
    }
  };
  for (const ligne of BANQUE.adversaires) verifier(INDEX.index, INDEX.resoudre(ligne));
  for (const nom of ["Mêlé", "Deux"]) verifier(index.index, de(nom));
  // La comparaison n'est pas vide, et voit les deux réponses.
  assert.equal(couples, 20);
  assert.deepEqual(de("Mêlé").capacites.map((c) => [c.nom, c.desavantage]), [
    ["Frappe", ["Rouleau de fonte", "Couteau d'office"]],
    ["Moulinet farineux", ["Spatule souple"]],
    ["Choc sourd", ["Rouleau de fonte"]],
    ["Coup de louche", []],
    ["Sauce piquante", []],
    ["Émincer", ["Couteau d'office"]],
    ["Pas chassé", []],
  ]);
});

// ─── Ce que la résolution rend de plus au simulateur de combat (§ 17) ───────

// Des objets fabriqués pour ces contrôles, dans l'ordre des colonnes de la
// feuille Blocs : une arme naturelle qui transmet un élément et des
// paramètres à une capacité qu'elle vise, un objet qui donne des dégâts sans
// être une arme, une arme aux valeurs hors bornes, une arme dont les dégâts
// demandent des caractéristiques, une arme à deux poids.
const BLOCS_DU_COMBAT = [
  ["Filet lesté", "Arme, Intervention(Frappe)", "Frappe, Choc sourd", "{degats:2/4/6}, {portee:3}, {loc_multiple:2}, {loc_multiple:3}(Choc sourd), {portee:5}(Choc sourd)", "Portée et dés de localisation, pour le bloc et pour une capacité", "Arme naturelle"],
  ["Gant clouté", _, "Frappe", "{degats:1/2/3}", "Des dégâts, sans être une arme", "Équipement"],
  ["Louche tordue", "Arme", "Frappe", "{degats:1/2/3}, {portee:1-3}, {loc_multiple:0}", "Portée négative, aucun dé de localisation", "Arme"],
  ["Pilon des forts", "Arme, Lourde", "Frappe", "{degats:{force}/{force}/{force}}", "Dégâts incalculables pour un adversaire", "Arme"],
  ["Batte double", "Arme, Agile, Lourde", "Frappe", "{degats:1/2/3}", "Deux poids", "Arme"],
];

test("combat — les armes de l'adversaire : les objets de type Arme ou Arme naturelle, dans l'ordre de l'équipement, avec leur poids et leurs valeurs en nombres", async () => {
  // Le pack d'armure ne donne aucune arme ; la qualité 2,8 du Chef de partie y est exacte (5/10/15 × 1,2666…).
  assert.deepEqual(demo("Marmiton de corvée").armes, [{ nom: "Spatule souple", poids: "agile", degats: [5, 10, 15], portee: 0, locMultiple: 1 }]);
  assert.deepEqual(demo("Chef de partie").armes, [{ nom: "Spatule souple", poids: "agile", degats: [6, 12, 19], portee: 0, locMultiple: 1 }]);
  // Une arme naturelle, sans poids ; puis une arme précise, de portée 1. La carapace et la toque n'en sont pas.
  assert.deepEqual(demo("Homard furieux").armes, [
    { nom: "Pinces de homard", poids: null, degats: [4, 8, 12], portee: 0, locMultiple: 1 },
    { nom: "Couteau d'office", poids: "precise", degats: [3, 8, 20], portee: 1, locMultiple: 1 },
  ]);
  assert.deepEqual([demo("Plongeur").armes, demo("Mouette chapardeuse").armes], [[], []]);

  const { de } = await feuille(
    [
      ["Pêcheur", "Commis", _, _, _, _, _, "Filet lesté, Gant clouté, Couvercle de marmite, Filet lesté[5]"],
      ["Plongeur", "Commis", _, _, _, _, _, "Louche tordue, Pilon des forts, Batte double"],
    ],
    { blocs: BLOCS_DU_COMBAT },
  );
  // La même arme deux fois : deux entrées, chacune à sa qualité (× 1 et × 2). Ni le gant, qui donne des dégâts sans être une arme, ni le bouclier.
  assert.deepEqual(de("Pêcheur").armes, [
    { nom: "Filet lesté", poids: null, degats: [2, 4, 6], portee: 3, locMultiple: 2 },
    { nom: "Filet lesté", poids: null, degats: [4, 8, 12], portee: 3, locMultiple: 2 },
  ]);
  // Une portée négative vaut 0, un nombre de dés nul vaut 1 ; des dégâts qui ne se calculent pas sans caractéristiques sont absents ; deux poids n'en font aucun.
  assert.deepEqual(de("Plongeur").armes, [
    { nom: "Louche tordue", poids: null, degats: [1, 2, 3], portee: 0, locMultiple: 1 },
    { nom: "Pilon des forts", poids: "lourde", degats: null, portee: 0, locMultiple: 1 },
    { nom: "Batte double", poids: null, degats: [1, 2, 3], portee: 0, locMultiple: 1 },
  ]);
});

test("combat — par capacité : ses valeurs par arme, en regard de celles de la carte, ce qu'elle porte en propre, et ses éléments au rang joué", async () => {
  const marmiton = demo("Marmiton de corvée");
  assert.deepEqual(capacite(marmiton, "Frappe").parArme, [{ arme: 0, degats: [5, 10, 15], portee: 0, locMultiple: 1, desavantage: false }]);
  assert.deepEqual(capacite(marmiton, "Moulinet farineux").parArme, [{ arme: 0, degats: [5, 10, 15], portee: 0, locMultiple: 1, desavantage: true }]);
  // Citée, sans objet : rien par arme, et rien en propre que les valeurs par défaut.
  assert.deepEqual([capacite(marmiton, "Pas chassé").parArme, capacite(marmiton, "Pas chassé").propres], [[], { degats: null, portee: 0, locMultiple: 1 }]);
  const homard = demo("Homard furieux");
  assert.deepEqual(capacite(homard, "Frappe").parArme, [
    { arme: 0, degats: [4, 8, 12], portee: 0, locMultiple: 1, desavantage: false },
    { arme: 1, degats: [3, 8, 20], portee: 1, locMultiple: 1, desavantage: true },
  ]);
  assert.deepEqual(capacite(homard, "Émincer").parArme, [{ arme: 1, degats: [3, 8, 20], portee: 1, locMultiple: 1, desavantage: true }]);
  // Les éléments : ceux de la capacité, lus dans la banque.
  const mouette = demo("Mouette chapardeuse");
  assert.deepEqual([capacite(mouette, "Nez fin").elements, capacite(mouette, "Frappe").elements, capacite(mouette, "Frappe").parArme], [["Passif"], [], []]);

  const { de } = await feuille(
    [
      ["Pêcheur", "Commis", _, _, _, _, _, "Filet lesté, Gant clouté, Couvercle de marmite, Filet lesté[5]", "//, Morsure, Fournaise[2], Fournaise[3], Recette perdue, Nez fin"],
      ["Braisier", "Commis", _, _, _, _, _, _, "Fournaise"],
      ["Plongeur", "Commis", _, _, _, _, _, "Louche tordue, Pilon des forts, Batte double"],
    ],
    { blocs: BLOCS_DU_COMBAT, capacites: [["Morsure", 0, 1, _, "Dégâts[4/8/12]", "Mord pour {degats}.", "Dégâts propres"]] },
  );
  const pecheur = de("Pêcheur");
  // Frappe : le filet, le gant (qui n'est pas une arme : arme null), le second filet. Les entrées de la carte ne changent pas.
  assert.deepEqual(capacite(pecheur, "Frappe").armes, [
    { nom: "Filet lesté", degats: "2/4/6", portee: 3, desavantage: false },
    { nom: "Gant clouté", degats: "1/2/3", portee: null, desavantage: false },
    { nom: "Filet lesté", degats: "4/8/12", portee: 3, desavantage: false },
  ]);
  assert.deepEqual(capacite(pecheur, "Frappe").parArme, [
    { arme: 0, degats: [2, 4, 6], portee: 3, locMultiple: 2, desavantage: false },
    { arme: null, degats: [1, 2, 3], portee: 0, locMultiple: 1, desavantage: false },
    { arme: 1, degats: [4, 8, 12], portee: 3, locMultiple: 2, desavantage: false },
  ]);
  // Un paramètre qui vise la capacité prime sur celui du bloc : la portée et le nombre de dés de Choc sourd ne sont pas ceux de l'arme.
  assert.deepEqual(capacite(pecheur, "Choc sourd").parArme, [
    { arme: 0, degats: [2, 4, 6], portee: 5, locMultiple: 3, desavantage: false },
    { arme: 1, degats: [4, 8, 12], portee: 5, locMultiple: 3, desavantage: false },
  ]);
  assert.deepEqual(pecheur.armes.map((arme) => [arme.portee, arme.locMultiple]), [[3, 2], [3, 2]]);
  // Le bouclier donne « Se couvrir » sans dégâts : aucune entrée par arme.
  assert.deepEqual([capacite(pecheur, "Se couvrir").armes, capacite(pecheur, "Se couvrir").parArme], [[], []]);
  // Les éléments : l'élément que le filet transmet à Frappe en la visant, et à elle seule ; les éléments propres, sans leur valeur, au rang joué.
  assert.deepEqual([capacite(pecheur, "Frappe").elements, capacite(pecheur, "Choc sourd").elements], [["Intervention"], []]);
  assert.deepEqual([capacite(pecheur, "Morsure").elements, capacite(pecheur, "Nez fin").elements], [["Dégâts"], ["Passif"]]);
  assert.deepEqual([capacite(pecheur, "Fournaise").rang, capacite(pecheur, "Fournaise").elements], [3, ["Portée"]]);
  assert.deepEqual([capacite(de("Braisier"), "Fournaise").rang, capacite(de("Braisier"), "Fournaise").elements], [1, []]);
  // En propre : les dégâts d'un élément Dégâts, sans qualité ; la portée d'un élément Portée, celle de la variante du rang.
  assert.deepEqual(capacite(pecheur, "Morsure").propres, { degats: [4, 8, 12], portee: 0, locMultiple: 1 });
  assert.deepEqual(capacite(pecheur, "Fournaise").propres, { degats: null, portee: 2, locMultiple: 1 });
  assert.deepEqual(capacite(de("Braisier"), "Fournaise").propres, { degats: null, portee: 0, locMultiple: 1 });
  // Les dégâts d'une arme ne sont pas ceux que la capacité porte en propre.
  assert.deepEqual(capacite(pecheur, "Frappe").propres, { degats: null, portee: 0, locMultiple: 1 });
  // Une capacité absente de la banque : rien.
  const perdue = capacite(pecheur, "Recette perdue");
  assert.deepEqual([perdue.absente, perdue.elements, perdue.parArme, perdue.propres], [true, [], [], null]);

  // Bornées comme celles de l'arme : portée négative, nombre de dés nul. Le pilon, aux dégâts incalculables, gêne (lourd) sans figurer par arme.
  const frappe = capacite(de("Plongeur"), "Frappe");
  assert.deepEqual(frappe.parArme, [
    { arme: 0, degats: [1, 2, 3], portee: 0, locMultiple: 1, desavantage: false },
    { arme: 2, degats: [1, 2, 3], portee: 0, locMultiple: 1, desavantage: true },
  ]);
  assert.deepEqual(frappe.desavantage, ["Pilon des forts", "Batte double"]);

  // Le parallèle, tenu pour tous : une entrée par arme pour une entrée de la carte, mêmes dégâts, même désavantage, même portée.
  let entrees = 0;
  for (const resolu of [...BANQUE.adversaires.map((ligne) => INDEX.resoudre(ligne)), pecheur, de("Plongeur"), de("Braisier")]) {
    assert.deepEqual(JSON.parse(JSON.stringify(resolu)), resolu, `${resolu.nom} passe par JSON à l'identique`);
    for (const c of resolu.capacites) {
      assert.equal(c.parArme.length, c.armes.length, `${resolu.nom}, ${c.nom}`);
      c.armes.forEach((arme, k) => {
        const jumelle = c.parArme[k];
        assert.equal(jumelle.degats.join("/"), arme.degats, `${resolu.nom}, ${c.nom}, ${arme.nom}`);
        assert.deepEqual([jumelle.desavantage, jumelle.portee], [arme.desavantage, arme.portee ?? 0]);
        // L'indice désigne bien l'objet qui donne ces dégâts ; un objet qui n'est pas une arme n'en a pas.
        if (jumelle.arme !== null) assert.equal(resolu.armes[jumelle.arme].nom, arme.nom);
        else assert.equal(resolu.armes.some((portee) => portee.nom === arme.nom), false);
        entrees += 1;
      });
    }
  }
  assert.equal(entrees, 15);
});

test("combat — les types d'un adversaire s'écrivent comme sur sa carte ; sans type, rien", () => {
  assert.equal(ecrireTypes(demo("Chef de partie")), "Commis, Rôtisseur ×1,4");
  assert.equal(ecrireTypes(demo("Marmiton de corvée")), "Commis, Rôtisseur");
  assert.deepEqual([ecrireTypes(demo("Homard furieux")), ecrireTypes(demo("Mouette chapardeuse"))], ["", ""]);
  assert.equal(ecrireTypes({ types: [{ nom: "Commis", absent: false }], multiplicateur: "2" }), "Commis ×2");
});

// ─── Ce que la relecture du cœur a fait préciser ────────────────────────────

test("rangs — le dernier écrit compte, même plus bas ; un rang cité vaut aussi pour une capacité que l'équipement donne ; le multiplicateur n'y touche pas", async () => {
  const { de, anomalies } = await feuille([
    ["Type", "Maître", _, _, _, _, _, "Spatule souple", "Maîtrise de l'agile[3], Pas chassé[3], Fournaise[2]"],
    // Y plus petit que X : « le plus élevé » donnerait 3 partout.
    ["Novice", "Commis/Maître", _, _, _, _, _, _, "//, Maîtrise de l'agile[1], Pas chassé[2], Moulinet farineux[3]"],
    ["Doublé", "Commis/Maître[2]"],
    ["Triplé", "Commis/Maître[3]"],
  ]);
  assert.deepEqual(anomalies, []);
  const novice = de("Novice");
  assert.deepEqual(novice.maitrises.map((m) => [m.nom, m.rang]), [["Maîtrise de l'agile", 1]]);
  assert.deepEqual(novice.capacites.map((c) => [c.nom, c.rang, c.cout.souffle]), [["Frappe", 0, "0"], ["Moulinet farineux", 3, "15"], ["Pas chassé", 2, "1"], ["Fournaise", 2, "3"]]);
  // Maîtrise retombée à 1 : la seconde capacité de la spatule retrouve son désavantage.
  assert.deepEqual(capacite(novice, "Moulinet farineux").desavantage, ["Spatule souple"]);
  // Sous [2] puis [3], les rangs hérités restent 3, 3 et 2 : ni 6, ni plafonnés à 3 par un produit.
  for (const nom of ["Doublé", "Triplé"]) {
    const r = de(nom);
    assert.deepEqual(r.maitrises.map((m) => m.rang), [3], nom);
    assert.deepEqual(r.capacites.map((c) => [c.nom, c.rang]), [["Frappe", 0], ["Moulinet farineux", 1], ["Pas chassé", 3], ["Fournaise", 2]], nom);
  }
  assert.deepEqual([de("Doublé").souffle.valeur, de("Triplé").souffle.valeur], [4, 6]);
});

test("arrondi — les quatre nombres d'un type décimal, multipliés : exacts jusqu'au bout, pas arrondis avant le produit", async () => {
  const { de } = await feuille([["Type", "Fin", "Corps(2), Tête(18)", "2,5", "0,5", "1,5", "3,5"], ["D", "Fin[2]"], ["E", "Fin"], ["F", "Fin[1,5]"]]);
  // 2,5 × 2 = 5 ; 0,5 × 2 = 1 ; 1,5 × 2 = 3 ; 3,5 × 2 = 7. Arrondis d'abord, ils donneraient 4, 0, 2, 6.
  assert.deepEqual(nombres(de("D")), [5, 1, 3, 7]);
  assert.deepEqual(nombres(de("E")), [2, 0, 1, 3]);
  // 3,75 ; 0,75 ; 2,25 ; 5,25.
  assert.deepEqual(nombres(de("F")), [3, 0, 2, 5]);
});

test("armure — une zone reconnue par approximation reçoit l'armure de sa zone ; six valeurs sans leur zone : dites, et posées selon le nombre de zones", async () => {
  const araignee = "Abdomen(2), Patte avant(8), Patte du milieu(11), Patte arrière(14), Crochets(17), Tête(20)";
  const { de, anomalies } = await feuille(
    [
      // « Jambre droite » se lit « jambe droite » : les guêtres (10 aux deux jambes) s'y posent.
      ["Type", "Boiteux", "Torse(2), Jambe gauche(12), Jambre droite(14), Tête(20)", 1, 1, 1, 1, "Guêtres de toile"],
      ["Guêtré", "Boiteux"],
      // Six zones, dont la seule tête est nommée : une chitine à six valeurs se pose dans l'ordre du d20.
      ["Araignée", _, araignee, 1, 1, 1, 1, "Chitine"],
      // La toque trouve la tête ; les maniques, sans bras, ne couvrent rien.
      ["Tronc", _, "Corps(2), Tête(18)", 1, 1, 1, 1, "Maniques, Toque renforcée"],
      // Aucune valeur perdue : le tablier et la toque se posent par nom, sans avertissement, sur une grille à six zones.
      ["Presque", _, "Torse(2), Jambe gauche(12), Jambe droite(14), Bras gauche(16), Gueule(18), Tête(20)", 1, 1, 1, 1, "Tablier de cuir, Toque renforcée"],
      ["Six", _, "Écaille A(2), Écaille B(5), Écaille C(8), Écaille D(11), Écaille E(14), Écaille F(17)", 1, 1, 1, 1, "Tablier de cuir"],
    ],
    { blocs: [["Chitine", "Armure", _, "{armure:20/5/5/5/8/10}", "I3", "Armure naturelle"]] },
  );
  assert.deepEqual(armures(de("Guêtré")), [0, 10, 10, 0]);
  assert.deepEqual(de("Guêtré").zones[2].pieces, ["Guêtres de toile [2]"]);
  assert.deepEqual(armures(de("Araignée")), [20, 5, 5, 5, 8, 10]);
  assert.deepEqual(armures(de("Tronc")), [0, 5]);
  assert.deepEqual(armures(de("Presque")), [30, 0, 0, 0, 0, 5]);
  assert.deepEqual(armures(de("Six")), [30, 0, 0, 0, 0, 0]);
  assert.deepEqual(anomalies.map((a) => [a[0], a[1]]), [["A11", 5], ["A12", 7], ["A12", 8], ["A12", 10]]);
});

test("packs — une armure naturelle qui porte l'élément du pack n'y entre pas", async () => {
  // La carapace du classeur d'essai ne porte aucun élément de poids : celle-ci porte Agile, et reste hors du pack.
  const { de } = await feuille([["A", "Commis", _, _, _, _, _, "Armure agile"]], {
    blocs: [["Cuir de bête", "Armure, Agile", _, "{armure:9/9/9/9/9/9}", "Armure naturelle agile ; I3", "Armure naturelle"]],
  });
  assert.deepEqual(de("A").equipement[0].pieces, ["Tablier de cuir", "Maniques", "Toque renforcée"]);
  assert.deepEqual(armures(de("A")), [30, 0, 0, 15, 15, 5]);
});

test("capacités — des dégâts donnés par un élément propre ne sont pas une « capacité d'arme sans arme »", async () => {
  const { de, anomalies } = await feuille([["A", "Commis", _, _, _, _, _, _, "Morsure, Frappe"]], {
    capacites: [["Morsure", 0, 1, _, "Dégâts[4/8/12]", "Mord pour {degats}.", "Dégâts propres"]],
  });
  assert.equal(capacite(de("A"), "Morsure").descriptions[0].texte, "Mord pour 4/8/12.");
  // Le témoin : Frappe, sans arme ni élément propre, garde son avertissement.
  assert.deepEqual(anomalies.map((a) => [a[0], a[2].includes("« Frappe »")]), [["A15", true]]);
});

test("capacités — un choix obligatoire à une seule option est donné ; un vrai choix ne donne rien, et l'écran le dit", async () => {
  const { de } = await feuille([["A", "Commis", _, _, _, _, _, "Rouleau à pâtisserie"], ["B", "Commis", _, _, _, _, _, "Saucier"]]);
  // Rouleau à pâtisserie : « Coup de louche, ( Sauce piquante ) ».
  assert.deepEqual(noms(de("A").capacites), ["Coup de louche", "Sauce piquante", "Pas chassé"]);
  const dits = de("B").constats.filter((c) => c.code === null).map((c) => c.message);
  assert.deepEqual(dits, ["L'adversaire « B » porte « Saucier », qui propose des capacités au choix : rien n'est choisi pour un adversaire, aucune n'est donnée."]);
  assert.deepEqual(de("B").constatsDeResolution.filter((c) => c.code), []);
});

test("résolution — une somme d'armures qui sort des entiers sûrs est dite, pas perdue en silence ; une capacité citée deux fois par son bloc n'a qu'une source", async () => {
  const { de, anomalies } = await feuille(
    [["Massif", "Commis", _, _, _, _, _, "Montagne, Colline"], ["Fouetteur", "Commis", _, _, _, _, _, "Fouet double"]],
    {
      blocs: [
        ["Montagne", "Armure", _, "{armure:999999999*9000000}", "Armure démesurée ; I3", "Armure naturelle"],
        ["Colline", "Armure", _, "{armure:999999999*9000000}", "Armure démesurée ; I3", "Armure naturelle"],
        ["Fouet double", "Arme", "Frappe, Frappe", "{degats:1/2/3}", "La même capacité, deux fois", "Arme"],
      ],
    },
  );
  // Chaque montagne tient dans un entier sûr ; leur somme, non : la seconde ne s'ajoute pas, et c'est dit.
  assert.deepEqual(anomalies, [["E14", 5, "L'adversaire « Massif » : la somme des armures, avec « Colline », sort des nombres que l'Atelier calcule."]]);
  assert.deepEqual(armures(de("Massif")), Array(6).fill(8999999991000000));
  assert.deepEqual(de("Massif").zones[0].pieces, ["Montagne [2]"]);
  assert.deepEqual(capacite(de("Fouetteur"), "Frappe").armes, [{ nom: "Fouet double", degats: "1/2/3", portee: null, desavantage: false }]);
});

test("feuille — « aucun » dans la colonne Type : aucun type ; un nom à double espace, écrit de même, n'est pas « approché »", async () => {
  const { de, anomalies } = await feuille(
    [
      ["Solitaire", "aucun", "Corps(2)", 1, 1, 1, 1],
      ["Exact", "Commis", _, _, _, _, _, "Grand  couteau"],
      ["Approché", "Commis", _, _, _, _, _, "grand couteau"],
    ],
    { blocs: [["Grand  couteau", "Arme", "Frappe", "{degats:2/4/6}", "Nom à double espace", "Arme"]] },
  );
  assert.deepEqual([de("Solitaire").types, de("Solitaire").complet], [[], true]);
  assert.deepEqual(noms(de("Exact").equipement), ["Grand  couteau"]);
  assert.deepEqual(anomalies, [["A1", 7, "L'adversaire « Approché » cite « grand couteau » pour le bloc « Grand  couteau » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."]]);
});

test("résolution — « complet » : une grille, une attaque et une défense qui se lisent", async () => {
  const { de } = await feuille([
    ["Entier", _, "Corps(2)", _, _, 1, 1],
    ["Grille fautive", _, "Corps(5)", 1, 1, 1, 1],
    ["Attaque illisible", _, "Corps(2)", 1, 1, "fort", 1],
    ["Sans défense", _, "Corps(2)", 1, 1, 1],
    ["Défense nulle", _, "Corps(2)", 1, 1, 1, "aucune"],
  ]);
  assert.deepEqual(["Entier", "Grille fautive", "Attaque illisible", "Sans défense", "Défense nulle"].map((nom) => de(nom).complet), [true, false, false, false, true]);
  // « sans défense », seul : la grille et l'attaque sont là.
  assert.deepEqual(de("Sans défense").constatsDeResolution.map((c) => [c.code, c.message]), [["E15", "L'adversaire « Sans défense » est incomplet une fois l'héritage appliqué : sans défense."]]);
  assert.equal(de("Défense nulle").defense.valeur, 0);
});

// ─── La démonstration et les ajouts du simulateur de combat (§ 16.7) ────────

// Le lot 4 a posé dans le classeur d'essai deux éléments, deux capacités du
// bloc de base, et Passif ou Intervention sur quatorze capacités, dont une
// maîtrise et une capacité que portent des adversaires. Aucune valeur d'un
// adversaire ne doit en changer : chacun se résout, par le même code, comme
// sur le classeur d'avant.
test("démonstration — les ajouts du simulateur de combat ne changent aucun adversaire : chacun se résout à l'identique sur le classeur d'avant", async () => {
  const { banque: avant, erreur } = await importerFichier(fabriquerClasseur(sansAjoutsDuCombat()), "classeur_essai.xlsx");
  assert.equal(erreur, undefined, erreur);
  // Le classeur d'avant est bien un autre classeur : ni les deux éléments, ni les deux capacités.
  assert.deepEqual([avant.capacites.length, avant.elements.length], [BANQUE.capacites.length - 2, BANQUE.elements.length - 2]);
  assert.deepEqual([BANQUE.capacites.length, BANQUE.elements.length], [46, 22]);
  const ajoutes = (liste, ancienne) => liste.map((entree) => entree.nom).filter((nom) => !ancienne.some((entree) => entree.nom === nom));
  assert.deepEqual(ajoutes(BANQUE.elements, avant.elements), ["Intervention", "Passif"]);
  assert.deepEqual(ajoutes(BANQUE.capacites, avant.capacites), ["Pas de côté", "Guetter"]);
  // Les ajouts touchent bien ce que portent des adversaires : la comparaison n'est pas vide de sens.
  const elementsDe = (banque, nom) => banque.capacites.find((c) => c.nom === nom).variantes[0].elements.map((e) => e.nom);
  assert.deepEqual([elementsDe(avant, "Nez fin"), elementsDe(BANQUE, "Nez fin")], [[], ["Passif"]]);
  assert.deepEqual([elementsDe(avant, "Maîtrise de l'agile"), elementsDe(BANQUE, "Maîtrise de l'agile")], [["Maîtrise"], ["Maîtrise", "Passif"]]);

  // Tout ce que rend la résolution : nombres, zones et armures, équipement, maîtrises, capacités, constats.
  const resolus = (banque) => {
    const index = indexerAdversaires(banque);
    return JSON.parse(JSON.stringify(banque.adversaires.map((adversaire) => index.resoudre(adversaire))));
  };
  const [aujourdhui, hier] = [resolus(BANQUE), resolus(avant)];
  assert.deepEqual(aujourdhui.map((r) => r.nom), ["Marmiton de corvée", "Chef de partie", "Plongeur", "Homard furieux", "Mouette chapardeuse"]);
  // Un seul champ de la résolution dit les éléments d'une capacité (il est
  // venu avec le simulateur, § 17) : c'est le seul que les ajouts peuvent
  // changer, et il se compare à part, juste après. Tout le reste, champs
  // neufs compris (les armes, les valeurs par arme et en propre), est égal.
  const sansElements = (resolu) => ({ ...resolu, capacites: resolu.capacites.map(({ elements, ...reste }) => (assert.ok(Array.isArray(elements), "le champ écarté existe"), reste)) });
  for (const [i, resolu] of aujourdhui.entries()) assert.deepEqual(sansElements(resolu), sansElements(hier[i]), resolu.nom);
  // Les éléments : un seul écart, le Passif posé sur une capacité de la Mouette chapardeuse.
  const elementsDesCapacites = (liste) => liste.flatMap((resolu) => resolu.capacites.map((c) => [resolu.nom, c.nom, c.elements]));
  const [dits, ditsHier] = [elementsDesCapacites(aujourdhui), elementsDesCapacites(hier)];
  assert.equal(dits.length, 12);
  assert.deepEqual(dits.filter((ligne, i) => ligne[2].join() !== ditsHier[i][2].join()), [["Mouette chapardeuse", "Nez fin", ["Passif"]]]);
  assert.deepEqual(ditsHier.filter((ligne) => ligne[2].length), []);
  // Les types se lisent de même, et la feuille porte les mêmes anomalies.
  const lus = (banque) => {
    const index = indexerAdversaires(banque);
    return JSON.parse(JSON.stringify(banque.types_adversaires.map((type) => index.analyser(type, "type").constats)));
  };
  assert.deepEqual(lus(BANQUE), lus(avant));
  const anomalies = (banque) => banque.anomalies.map((a) => [a.code, a.feuille, a.ligne, a.message]);
  assert.deepEqual(anomalies(BANQUE), anomalies(avant));
});

// ─── Les contrôles de la feuille (§ 6.3) ────────────────────────────────────

test("contrôle — la feuille du classeur d'essai ne porte que les trois anomalies qu'elle annonce", () => {
  assert.deepEqual(
    BANQUE.anomalies.filter((a) => a.feuille === "Adversaires").map((a) => [a.code, a.ligne, a.message]),
    [
      ["A11", 2, "La classe « Commis » : la zone « Jambre droite » est reconnue par approximation comme « Jambe droite »."],
      ["A1", 3, "La classe « Rôtisseur » cite « Maitrise de l'agile » pour la capacité « Maîtrise de l'agile » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent."],
      ["A15", 8, "L'adversaire « Mouette chapardeuse » a la capacité « Frappe », qui invoque {degats}, sans arme pour lui donner ses dégâts."],
    ],
  );
});

for (const faute of FAUTES) {
  test(`contrôle — ${faute.code} : ${faute.cas}`, async () => {
    const { anomalies, erreur } = await importerFichier(fabriquerClasseur(faute.description), "essai.xlsx");
    assert.equal(erreur, undefined, erreur);
    const obtenues = anomalies.filter((a) => a.feuille === "Adversaires");
    assert.deepEqual(obtenues.map((a) => [a.code, a.ligne, a.message]), faute.attendues);
    for (const a of obtenues) assert.equal(a.gravite, GRAVITES[a.code], a.code);
    assert.ok(faute.attendues.some(([code]) => code === faute.code), `le cas déclenche ${faute.code}`);
  });
}

// « De même nom » (E16, A16) s'entend exactement, une fois les signes
// invisibles retirés (§ 6.3) : ce retrait ne fait pas de la comparaison une
// comparaison approchée. La casse, un accent ou une espace au milieu du nom
// font un autre nom, et non un doublon ; un type nouveau, que rien n'utilise,
// se dit donc par I5, comme tout type.
test("contrôle — E16 et A16 comparent exactement : la casse, un accent ou une espace intérieure font un autre nom, pas un doublon", async () => {
  const { banque, anomalies } = await feuille([
    ["marmiton", "Commis"],
    ["Mar miton", "Commis"],
    ["Type", "commis", _, 2],
    ["Type", "Rotisseur", _, 2],
    ["Type", "Rôtis seur", _, 2],
    ["rôtisseur", "Commis"],
    ["Rotisseur", "Commis"],
  ]);
  // Chacun est une entrée de la banque, sous le nom qu'il écrit.
  assert.deepEqual(noms(banque.adversaires), ["Marmiton", "marmiton", "Mar miton", "rôtisseur", "Rotisseur"]);
  assert.deepEqual(noms(banque.types_adversaires), ["Commis", "Rôtisseur", "commis", "Rotisseur", "Rôtis seur"]);
  assert.deepEqual(anomalies, [
    // « Rotisseur », l'adversaire, porte exactement le nom d'un type : A16, et lui seul.
    ["A16", 11, "L'adversaire « Rotisseur » porte le nom d'une classe, définie ligne 8."],
    ["I5", 7, "La classe « commis » n'est utilisée par aucun adversaire."],
    ["I5", 8, "La classe « Rotisseur » n'est utilisée par aucun adversaire."],
    ["I5", 9, "La classe « Rôtis seur » n'est utilisée par aucun adversaire."],
  ]);
});

test("contrôle — les dix-sept codes de la feuille, chacun déclenché, avec sa gravité", () => {
  const codes = ["E8", "E9", "E10", "E11", "E12", "E13", "E14", "E15", "E16", "A11", "A12", "A13", "A14", "A15", "A16", "I4", "I5"];
  const declenches = new Set(FAUTES.flatMap((faute) => faute.attendues.map(([code]) => code)));
  for (const code of codes) {
    assert.ok(declenches.has(code), `${code} n'est déclenché par aucun cas`);
    assert.equal(GRAVITES[code], code.startsWith("E") ? "erreur" : code.startsWith("A") ? "avertissement" : "information", code);
  }
});

test("contrôle — le socle des variantes est sans défaut, et un en-tête absent de la feuille arrête l'import (E1)", async () => {
  assert.deepEqual((await feuille([])).anomalies, []);
  const entetes = ["Nom", "Type", "Localisation", "Nombre d'actions", "Haleine", "Attaque", "Défense", "Equipement", "Capacités"];
  const { banque, anomalies } = await importerFichier(fabriquerClasseur(avecAdversaires([], { entetes })), "essai.xlsx");
  assert.equal(banque, null);
  assert.deepEqual(anomalies.map((a) => [a.code, a.feuille, a.ligne, a.message]), [["E1", "Adversaires", 1, "L'en-tête « Souffle » est introuvable dans la feuille Adversaires : l'import s'arrête."]]);
});

test("contrôle — les anomalies de la feuille se rangent après celles des autres feuilles, et un code à deux chiffres après un code à un", async () => {
  const { anomalies } = await importerFichier(
    fabriquerClasseur(avecAdversaires([["A", "Commis/Spectre[2", HUMANOIDE, "trop", _, _, _, "Fourchette", "Rien"]])),
    "essai.xlsx",
  );
  const erreurs = anomalies.filter((a) => a.gravite === "erreur");
  const feuilles = [...new Set(erreurs.map((a) => a.feuille))];
  assert.deepEqual(feuilles, ["Blocs", "Eléments", "Capacites", "Adversaires"]);
  // Sur une même ligne : E9, puis E11, E13, E14, dans l'ordre des nombres et non des lettres.
  assert.deepEqual(erreurs.filter((a) => a.feuille === "Adversaires").map((a) => a.code), ["E9", "E11", "E13", "E14"]);
});

test("résolution — un adversaire en erreur se résout quand même, et dit ses constats avec leur ligne", async () => {
  const { de } = await feuille([["Fantôme", "Commis/Spectre", _, _, _, _, _, "Fourchette magique", "Frappe, Rien"]]);
  const r = de("Fantôme");
  assert.deepEqual(r.types, [{ nom: "Commis", absent: false }, { nom: "Spectre", absent: true }]);
  assert.equal(r.complet, false);
  // Ce qui se lit est gardé : le type trouvé s'applique, l'objet et la capacité introuvables se montrent.
  assert.deepEqual(nombres(r), [1, 2, 3, 4]);
  assert.deepEqual(r.equipement.map((o) => [o.nom, o.genre]), [["Fourchette magique", "absent"]]);
  assert.deepEqual(r.capacites.map((c) => [c.nom, c.absente]), [["Frappe", false], ["Rien", true]]);
  assert.deepEqual(r.constats.map((c) => [c.code, c.ligne]), [["E8", 5], ["E11", 5], ["E13", 5], ["A15", 5]]);
  // Un type cassé rend la suite incertaine : le contrôle ne garde que les constats des lignes.
  assert.deepEqual(r.constatsDeResolution, []);
  // Sans rien d'hérité, il n'est pas dit « incomplet » en plus, pas même à l'écran : son type manque, c'est tout.
  const { de: seul } = await feuille([["Spectre errant", "Spectre"]]);
  assert.deepEqual(seul("Spectre errant").constats.map((c) => c.code), ["E8"]);
  assert.equal(seul("Spectre errant").complet, false);
  // Les constats d'un type suivent l'adversaire à l'écran, avec la ligne du type.
  assert.deepEqual(demo("Plongeur").constats.map((c) => [c.code, c.ligne]), [["A11", 2], ["A1", 3]]);
});

test("résolution — une donnée hostile ne lève pas d'exception et ne touche pas aux prototypes", async () => {
  const { de, anomalies, index } = await feuille([
    ["__proto__", "constructor/toString", "__proto__(2), constructor(9)", 1, 1, 1, 1, "__proto__[2], hasOwnProperty", "constructor, valueOf[3]"],
    ["<img src=x onerror=alert(1)>", "Commis", _, _, _, _, _, "<b>Spatule</b>", "<script>alert`1`</script>"],
    ["Type", "Titan", "Corps(2)", 1, 1, "999999999,999999", 1, "Spatule souple[999999999,999999]"],
    ["Démesuré", "Titan[999999999,999999]"],
  ]);
  assert.equal(de("__proto__").nom, "__proto__");
  assert.deepEqual(noms(de("__proto__").zones), ["__proto__", "constructor"]);
  // Du HTML reste un nom comme un autre : introuvable, gardé tel quel, jamais interprété.
  const balise = de("<img src=x onerror=alert(1)>");
  assert.deepEqual(balise.equipement.map((o) => [o.nom, o.genre]), [["<b>Spatule</b>", "absent"]]);
  assert.deepEqual(balise.capacites.map((c) => [c.nom, c.absente]), [["<script>alert`1`</script>", true]]);
  // Des nombres démesurés : un produit qui sort des entiers sûrs ne se calcule pas ; la valeur héritée
  // reste, et c'est dit (E14), sans exception.
  const demesure = de("Démesuré");
  assert.deepEqual(nombres(demesure), [999999999, 999999999, 999999999, 999999999]);
  assert.deepEqual([demesure.actions.origine.multiplie, demesure.attaque.origine.multiplie], [true, false]);
  assert.deepEqual(
    demesure.constatsDeResolution.filter((c) => c.code === "E14").map((c) => c.message.replace(/^.*? : /, "")),
    [
      "l'attaque × 999999999,999999 sort des nombres que l'Atelier calcule ; la valeur héritée reste telle quelle.",
      "la qualité de « Spatule souple » × 999999999,999999 sort des nombres que l'Atelier calcule ; la valeur héritée reste telle quelle.",
      // La qualité propre du type, démesurée elle aussi : les dégâts ne se calculent pas, et c'est dit.
      "L'adversaire « Démesuré » porte « Spatule souple », dont les dégâts, « 5/10/15 », ne se calculent pas à la qualité 1000000000.",
    ],
  );
  assert.deepEqual(capacite(demesure, "Frappe").armes, []);
  assert.equal(index.type("__proto__"), null);
  assert.deepEqual(anomalies.filter((a) => a[1] === 5).map((a) => a[0]), ["E8", "E8", "E11", "E11", "E13", "E13"]);
});

test("résolution — des types, des blocs et des capacités nommés comme le prototype : résolus comme les autres, le prototype intact", async () => {
  // C'est là qu'une table tenue dans un objet nu se laisserait polluer : des noms définis, cités et résolus.
  const avant = Object.getOwnPropertyNames(Object.prototype).sort();
  const { de, anomalies, index } = await feuille(
    [
      ["Type", "__proto__", HUMANOIDE, 1, 1, 1, 1, "constructor", "toString"],
      ["Type", "constructor", _, 2, _, _, _, "//, hasOwnProperty[3]", "//, valueOf"],
      ["Sbire", "__proto__/constructor[2]"],
      ["hasOwnProperty", "__proto__"],
    ],
    {
      blocs: [
        ["constructor", "Arme", "toString", "{degats:1/2/3}, {constructor:4}, {__proto__:5}", "nom hostile", "Arme"],
        ["hasOwnProperty", "Armure", _, "{armure:7}", "nom hostile ; I3", "Armure naturelle"],
      ],
      capacites: [["toString", 0, 1, _, _, "Frappe pour {degats}, {constructor} et {__proto__}.", "nom hostile"], ["valueOf", "N", "N", _, _, "Vaut [N].", "nom hostile"]],
    },
  );
  assert.deepEqual(anomalies, []);
  const sbire = de("Sbire");
  assert.deepEqual(sbire.types.map((t) => [t.nom, t.absent]), [["__proto__", false], ["constructor", false]]);
  // Actions 2 × 2 ; le reste 1 × 2 ; l'arme et l'armure héritées, à la qualité 2 × 2 et 3 × 2.
  assert.deepEqual(nombres(sbire), [4, 2, 2, 2]);
  assert.deepEqual(sbire.equipement.map((o) => [o.nom, o.qualite]), [["constructor", "4"], ["hasOwnProperty", "6"]]);
  assert.deepEqual(armures(sbire), [16, 16, 16, 16, 16, 16]); // 7 × (1/3 + 6/3) = 16,33
  assert.deepEqual(sbire.capacites.map((c) => [c.nom, c.rang, c.armes.map((a) => a.degats)]), [["toString", 0, ["1/3/5"]], ["valueOf", 1, []]]);
  assert.equal(capacite(sbire, "toString").descriptions[0].texte, "Frappe pour 1/3/5, 4 et 5.");
  // Aucun constat, pas même sans code : un paramètre « constructor » lu dans la table des rangs en laissait un.
  assert.deepEqual(sbire.constats, []);
  assert.deepEqual(index.utilisateurs("__proto__"), ["Sbire", "hasOwnProperty"]);
  assert.deepEqual(index.utilisateurs("constructor"), ["Sbire"]);
  assert.equal(index.type("__proto__").nom, "__proto__");
  // Le prototype des objets n'a rien gagné, et rien d'énumérable.
  assert.deepEqual(Object.getOwnPropertyNames(Object.prototype).sort(), avant);
  assert.deepEqual(Object.keys(Object.prototype), []);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test("résolution — une banque abîmée ou forgée ne fait rien lever : ce qui ne se lit pas n'y entre pas", () => {
  const piege = { toString: 0, valueOf: 0 };
  const forgee = {
    ...BANQUE,
    types_adversaires: [null, 5, "texte", { nom: piege }, { nom: "Sans rien" }, { nom: "Piégé", localisation: piege, actions: piege, equipement: piege, capacites: piege, brut: null }],
    adversaires: [
      null,
      { nom: 7 },
      { nom: "Seul" },
      { nom: "Tordu", types: piege, localisation: ["Corps(2)"], actions: {}, souffle: true, attaque: 3, defense: "4", equipement: 12, capacites: null },
      { nom: "Hérite", types: "Piégé/Sans rien", localisation: "Corps(2)", attaque: "1", defense: "1", brut: { ligne: "x" } },
    ],
  };
  const index = indexerAdversaires(forgee);
  assert.deepEqual([...index.types.keys()], ["Sans rien", "Piégé"]);
  assert.deepEqual([...index.adversaires.keys()], ["Seul", "Tordu", "Hérite"]);
  for (const adversaire of index.adversaires.values()) assert.equal(typeof index.resoudre(adversaire).complet, "boolean", adversaire.nom);
  // Une cellule qui est un nombre se lit ; un objet, un tableau, un booléen valent une cellule vide.
  const tordu = index.resoudre(index.adversaires.get("Tordu"));
  assert.deepEqual([nombres(tordu), tordu.zones.length, tordu.ligne], [[null, null, 3, 4], 0, null]);
  assert.equal(index.resoudre(index.adversaires.get("Hérite")).complet, true);
  // Des listes qui n'en sont pas : aucun adversaire, sans exception.
  for (const liste of [{}, 5, "texte", null, undefined]) {
    const vide = indexerAdversaires({ ...BANQUE, adversaires: liste, types_adversaires: liste });
    assert.deepEqual([vide.types.size, vide.adversaires.size], [0, 0]);
  }
  // Les différences restent debout, elles aussi.
  const d = comparer(forgee, BANQUE);
  assert.deepEqual(d.adversaires.retires, ["Seul", "Tordu", "Hérite"]);
  assert.equal(comparer(BANQUE, { ...BANQUE, adversaires: {}, types_adversaires: 5 }).totaux.adversaires, 0);
});

test("résolution — une cellule démesurée : cent trente mille objets sans débordement de pile, et un nom démesuré cité coupé", () => {
  // Excel borne une cellule à 32 767 signes ; un classeur forgé, non. Un étalement en arguments de plus de
  // 125 000 entrées levait « Maximum call stack size exceeded » (relecture du lot 3).
  const foule = { nom: "Foule", types: "", localisation: "Corps(2)", actions: "1", souffle: "", attaque: "1", defense: "1", equipement: Array(130000).fill("Carapace épaisse").join(","), capacites: "" };
  const long = "Géant".repeat(2000);
  const geant = { nom: long, types: `${long}/Commis`, localisation: `${long}(2)`, actions: long, souffle: "", attaque: "1", defense: "1", equipement: `${long}[${long}]`, capacites: `${long}, Pas chassé[${long}]` };
  const index = indexerAdversaires({ ...BANQUE, adversaires: [foule, geant] });
  const debut = performance.now();
  const resolue = index.resoudre(foule);
  assert.equal(resolue.equipement.length, 130000);
  assert.deepEqual(armures(resolue), [3900000]); // 130 000 × 30
  assert.ok(performance.now() - debut < 5000, `résolue en ${Math.round(performance.now() - debut)} ms`);
  // Un nom de dix mille signes, cité dans chaque constat de sa ligne : chaque message reste court.
  const constats = index.resoudre(geant).constats;
  // Le type, le nombre d'actions, la qualité, l'objet, la capacité, le rang ; puis la zone approchée du type Commis.
  assert.deepEqual(constats.map((c) => c.code), ["E8", "E14", "E14", "E11", "E13", "E14", "A11"]);
  for (const constat of constats) assert.ok(constat.message.length < 500, `${constat.code} : ${constat.message.length} signes`);
  assert.match(constats[0].message, /^L'adversaire « (Géant){16}… » cite la classe « (Géant){16}… », introuvable/);
});

// ─── Les types de bloc naturels, et les banques d'avant le lot 3 ────────────

test("types — « Arme naturelle » et « Armure naturelle » sont reconnus, et le créateur de personnage les ignore", () => {
  const bloc = (nom) => BANQUE.blocs.find((b) => b.nom === nom);
  assert.equal(typeDe(bloc("Pinces de homard")), "arme_naturelle");
  assert.equal(typeDe(bloc("Carapace épaisse")), "armure_naturelle", "écrit « armure naturelle », sans majuscule");
  assert.deepEqual(BANQUE.anomalies.filter((a) => a.code === "A9"), []);
  const creation = indexerCreation(BANQUE);
  for (const type of ["arme", "armure", "equipement", "consommable"]) {
    const proposes = noms(creation.blocsDeType(type));
    assert.equal(proposes.includes("Pinces de homard") || proposes.includes("Carapace épaisse"), false, type);
  }
  assert.deepEqual(noms(creation.blocsDeType("arme_naturelle")), ["Pinces de homard"]);
  // Les packs d'armure du créateur ne contiennent que des pièces de type Armure, et restent proposés.
  const packs = packsDArmure(BANQUE.blocs);
  assert.deepEqual(packs.map((p) => [p.type, p.propose, noms(p.pieces)]), [
    ["lourde", true, ["Plastron de fonte"]],
    ["agile", true, ["Tablier de cuir", "Maniques", "Toque renforcée"]],
    ["precise", true, ["Guêtres de toile"]],
  ]);
});

test("banque d'avant le lot 3 — sans les listes d'adversaires : rien à résoudre, aucune exception", () => {
  const ancienne = { ...BANQUE };
  delete ancienne.types_adversaires;
  delete ancienne.adversaires;
  assert.equal(banqueSansAdversaires(ancienne), true);
  assert.equal(banqueSansAdversaires(BANQUE), false);
  const index = indexerAdversaires(ancienne);
  assert.deepEqual([index.types.size, index.adversaires.size, index.type("Commis"), index.utilisateurs("Commis")], [0, 0, null, []]);
});

test("index — les adversaires qui utilisent un type, et un type retrouvé à la casse près", () => {
  assert.deepEqual(INDEX.utilisateurs("Commis"), ["Marmiton de corvée", "Chef de partie", "Plongeur"]);
  assert.deepEqual(INDEX.utilisateurs("Rôtisseur"), ["Marmiton de corvée", "Chef de partie", "Plongeur"]);
  assert.deepEqual(INDEX.utilisateurs("Inconnu"), []);
  assert.equal(INDEX.type("rotisseur").nom, "Rôtisseur");
  // Ce que la résolution lit d'un type, pour sa fiche : ses cellules, sans héritage.
  const lue = INDEX.analyser(INDEX.types.get("Rôtisseur"), "type").lue;
  assert.deepEqual([lue.localisation.genre, lue.nombres.actions.genre, lue.capacites.reprise], ["herite", "herite", true]);
  assert.deepEqual(lue.equipement.objets.map((o) => [o.nom, o.genre]), [["Spatule souple", "bloc"], ["Armure agile", "pack"]]);
  assert.deepEqual(lue.capacites.citees.map((c) => [c.nom, c.rang]), [["Maîtrise de l'agile", 1]]);
});

// ─── Mise à l'épreuve (lot 4) : ce que les casses du code n'avaient pas fait échouer ───

test("combat — une arme ne tient ses valeurs que des paramètres sans cible de son bloc ; ceux qui visent une capacité restent à cette capacité", async () => {
  const { de } = await feuille(
    [["Écumeur", "Commis", _, _, _, _, _, "Écumoire lestée"]],
    { blocs: [["Écumoire lestée", "Arme", "Frappe, Choc sourd", "{degats:1/2/3}, {portee:4}(Choc sourd), {loc_multiple:2}(Choc sourd)", "Portée et dés de localisation pour une seule capacité", "Arme"]] },
  );
  const ecumeur = de("Écumeur");
  // L'arme ne transmet à toutes ni portée ni dé de localisation : la même case, un dé.
  assert.deepEqual(ecumeur.armes, [{ nom: "Écumoire lestée", poids: null, degats: [1, 2, 3], portee: 0, locMultiple: 1 }]);
  assert.deepEqual(capacite(ecumeur, "Frappe").parArme, [{ arme: 0, degats: [1, 2, 3], portee: 0, locMultiple: 1, desavantage: false }]);
  assert.deepEqual(capacite(ecumeur, "Choc sourd").parArme, [{ arme: 0, degats: [1, 2, 3], portee: 4, locMultiple: 2, desavantage: false }]);
});

test("combat — une copie par exemplaire : deux armes, ou deux résolutions, ne partagent ni leur entrée ni leurs dégâts", async () => {
  const { de } = await feuille([["Jongleur", "Commis", _, _, _, _, _, "Spatule souple, Spatule souple"]]);
  const [une, autre] = de("Jongleur").armes;
  assert.deepEqual(une, autre);
  assert.notEqual(une, autre);
  assert.notEqual(une.degats, autre.degats);
  // Qui retouche l'une ne change ni l'autre, ni la résolution suivante.
  une.degats[0] = 99;
  une.portee = 7;
  assert.deepEqual(autre, { nom: "Spatule souple", poids: "agile", degats: [5, 10, 15], portee: 0, locMultiple: 1 });
  assert.deepEqual(de("Jongleur").armes, [autre, autre]);
});

test("combat — un élément que deux objets transmettent à la même capacité ne s'y écrit qu'une fois", async () => {
  const { de } = await feuille(
    [
      ["Rétiaire", "Commis", _, _, _, _, _, "Filet lesté, Nasse lestée"],
      ["Pêcheur", "Commis", _, _, _, _, _, "Nasse lestée"],
    ],
    { blocs: [...BLOCS_DU_COMBAT, ["Nasse lestée", "Arme, Intervention(Frappe), Passif(Frappe)", "Frappe", "{degats:1/1/1}", "Le même élément que le filet, et un autre", "Arme"]] },
  );
  assert.deepEqual(capacite(de("Pêcheur"), "Frappe").elements, ["Intervention", "Passif"]);
  assert.deepEqual(capacite(de("Rétiaire"), "Frappe").elements, ["Intervention", "Passif"], "dans l'ordre de rencontre, sans doublon");
  assert.equal(capacite(de("Rétiaire"), "Frappe").parArme.length, 2);
});

// ─── Le groupe 2 : une capacité à une puissance (contrat du groupe, § 5.1) ───

test("capacitesA — au rang, ce que rend resoudre, pour chaque adversaire du classeur d'essai ; null pour une absente, au-delà du rang, une variante manquante ; les constats ne changent pas", async () => {
  let comparees = 0;
  for (const ligne of BANQUE.adversaires) {
    const avant = JSON.stringify(INDEX.resoudre(ligne));
    const resolu = INDEX.resoudre(ligne);
    for (const [k, c] of resolu.capacites.entries()) {
      if (c.absente || c.rang < 1) continue;
      assert.deepEqual(INDEX.capacitesA(ligne, c.rang)[k], c, `${ligne.nom}, ${c.nom}`);
      comparees += 1;
    }
    // Une maîtrise n'est pas une capacité de la résolution : la liste reste parallèle.
    for (const puissance of [1, 2, 3]) assert.equal(INDEX.capacitesA(ligne, puissance).length, resolu.capacites.length, `${ligne.nom}, puissance ${puissance}`);
    assert.equal(JSON.stringify(INDEX.resoudre(ligne)), avant, `${ligne.nom} : rien ne change, constats compris`);
  }
  assert.equal(comparees, 5);

  const { de, index } = await feuille(
    [["Pêcheur", "Commis", _, _, _, _, _, "Spatule souple", "Fournaise[2], Coup d'aile[3], Recette perdue, Goûter, Maîtrise de l'agile[2]"]],
    { capacites: [["Coup d'aile", 1, 1, _, _, "Bat de l'aile.", "Puissances 1 et 3"], ["Coup d'aile", 3, 3, _, _, "Bat des deux ailes.", _]] },
  );
  const pecheur = index.adversaires.get("Pêcheur");
  const resolu = de("Pêcheur");
  assert.deepEqual(noms(resolu.capacites), ["Frappe", "Moulinet farineux", "Fournaise", "Coup d'aile", "Recette perdue", "Goûter"]);
  assert.deepEqual(noms(resolu.maitrises), ["Maîtrise de l'agile"]);
  const nuls = (puissance) => index.capacitesA(pecheur, puissance).map((c, k) => (c === null ? resolu.capacites[k].nom : null)).filter(Boolean);
  // Frappe et Goûter n'évoluent pas ; Moulinet est au rang 1, Fournaise au rang 2 ; Coup d'aile n'a pas de variante 2 ; Recette perdue est absente.
  assert.deepEqual(nuls(1), ["Frappe", "Recette perdue", "Goûter"]);
  assert.deepEqual(nuls(2), ["Frappe", "Moulinet farineux", "Coup d'aile", "Recette perdue", "Goûter"]);
  assert.deepEqual(nuls(3), ["Frappe", "Moulinet farineux", "Fournaise", "Recette perdue", "Goûter"]);
  // Les entrées non nulles sont celles de leur capacité, à cette puissance.
  assert.deepEqual(index.capacitesA(pecheur, 1)[3].descriptions, [{ source: null, texte: "Bat de l'aile." }]);
  assert.deepEqual(index.capacitesA(pecheur, 3)[3].descriptions, [{ source: null, texte: "Bat des deux ailes." }]);
  // Hors de 1 au rang, ou une puissance qui n'est pas un entier : rien.
  for (const puissance of [0, 4, -1, 1.5, "2", null]) assert.deepEqual(nuls(puissance), noms(resolu.capacites), String(puissance));
});

test("capacitesA — à une puissance, son coût, sa description, ses éléments et ce qu'elle porte en propre ; son rang, ses armes et son désavantage restent", async () => {
  const { de, index } = await feuille(
    [["Pêcheur", "Commis", _, _, _, _, _, "Spatule souple, Spatule souple[3]", "Tour de main[3], Fournaise[3], Moulinet farineux[3]"]],
    { capacites: [["Tour de main", "N", "N", "N-1", _, "Tourne [N] fois la main.", "Coûts 1, 2, 3 et une description en N"]] },
  );
  const pecheur = index.adversaires.get("Pêcheur");
  const par = [1, 2, 3].map((puissance) => index.capacitesA(pecheur, puissance));
  const a = (nom, liste) => liste.find((c) => c?.nom === nom);
  // Une banque fabriquée : coûts 1, 2, 3 en souffle, 0, 1, 2 en lien, et la description en N ; le rang reste 3.
  assert.deepEqual(par.map((liste) => [a("Tour de main", liste).rang, a("Tour de main", liste).cout, a("Tour de main", liste).descriptions]), [
    [3, { souffle: "1", lien: "0" }, [{ source: null, texte: "Tourne 1 fois la main." }]],
    [3, { souffle: "2", lien: "1" }, [{ source: null, texte: "Tourne 2 fois la main." }]],
    [3, { souffle: "3", lien: "2" }, [{ source: null, texte: "Tourne 3 fois la main." }]],
  ]);
  // Les éléments et la portée propre de la variante de chaque puissance ; la description lit sa portée.
  assert.deepEqual(par.map((liste) => [a("Fournaise", liste).cout.souffle, a("Fournaise", liste).elements, a("Fournaise", liste).propres.portee, a("Fournaise", liste).descriptions[0].texte]), [
    ["1", [], 0, "Réchauffe la case."],
    ["3", ["Portée"], 1, "Brûle trois adversaires à 1 case."],
    ["7", ["Portée"], 2, "Aveugle une cible à 2 cases."],
  ]);
  // Les armes et le désavantage ne tiennent pas à la puissance : deux spatules, la seconde à la qualité 3.
  for (const liste of par) {
    const moulinet = a("Moulinet farineux", liste);
    assert.deepEqual(moulinet.parArme.map((entree) => [entree.arme, entree.degats, entree.desavantage]), [[0, [5, 10, 15], true], [1, [6, 13, 20], true]]);
    assert.deepEqual([moulinet.rang, moulinet.desavantage, moulinet.desavantageEntier], [3, ["Spatule souple", "Spatule souple"], true]);
  }
  assert.deepEqual(par.map((liste) => a("Moulinet farineux", liste).cout.souffle), ["5", "10", "15"]);
  assert.deepEqual(par.map((liste) => a("Moulinet farineux", liste).armes.map((arme) => arme.degats)), Array(3).fill(["5/10/15", "6/13/20"]));
  // Au rang, la résolution même ; Frappe, qui n'évolue pas, n'y a pas d'entrée.
  assert.deepEqual(par[2], de("Pêcheur").capacites.map((c) => (c.rang === 3 ? c : null)));
  assert.deepEqual(noms(de("Pêcheur").capacites), ["Frappe", "Moulinet farineux", "Tour de main", "Fournaise"]);
});
