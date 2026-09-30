// Contrôles des règles du personnage (SPECIFICATION.md, § 15.2 et § 11,
// domaine « Personnage »). La banque vient du classeur d'essai, fictif ;
// quelques cas se fabriquent au moment de l'essai.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche, capacitesDuBloc, coutA, evolution, indexerCreation, qualiteDe, valeursParametre } from "../js/personnage/calcul.js";
import { entierInferieur, evaluer, fraction, lireNombre } from "../js/personnage/expressions.js";
import { MESSAGE_BANQUE_SANS_TYPES, banqueUtilisable, manques, niveauxPermis, tirerConstellation, tirerIndice } from "../js/personnage/parcours.js";
import { COUT_NIVEAU, ZONES, deDuJet } from "../js/personnage/regles.js";
import { changements, relever } from "../js/personnage/suivi.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));
const { banque: BANQUE } = await importerFichier(ESSAI, "classeur_essai.xlsx");
const INDEX = indexerCreation(BANQUE);
const fiche = (modifier) => calculerFiche(BANQUE, personnageEssai(modifier), { index: INDEX });
const capacite = (f, nom) => f.capacites.find((c) => c.nom === nom);

test("dés — la table du livret, bornes comprises : somme arrondie au pair inférieur", () => {
  const table = [
    [2, 2, "d4"], [2, 3, "d4"], [3, 3, "d6"], [3, 4, "d6"], [4, 4, "d8"], [4, 5, "d8"],
    [5, 5, "d10"], [5, 6, "d10"], [6, 6, "d12"],
  ];
  for (const [a, b, de] of table) assert.equal(deDuJet(a, b).de, de, `${a} + ${b}`);
  assert.equal(deDuJet(3).de, "d6", "une seule caractéristique compte double");
  assert.equal(deDuJet(2, 3).somme, 5);
  assert.equal(deDuJet(1, 1), null, "sous d4 : aucun dé du tableau");
  assert.equal(deDuJet(7, 7), null, "au-delà de d12 : aucun dé du tableau");
  assert.equal(deDuJet(null, 3), null);
});

test("dés — attaque : lourde For+Pré, agile Agi+For, précise Pré+Agi ; défense : lourde For+Sen, agile Agi+Cré, précise Pré+Emp", () => {
  const f = fiche((p) => {
    p.caracteristiques = { force: 6, agilite: 2, precision: 4, sens: 5, culture_neruvienne: 4, savoir_sauvage: 4, parole: 4, empathie: 3, creativite: 4 };
  });
  assert.deepEqual(Object.fromEntries(Object.entries(f.des.attaque).map(([k, d]) => [k, d.somme])), { lourde: 10, agile: 8, precise: 6 });
  assert.deepEqual(Object.fromEntries(Object.entries(f.des.defense).map(([k, d]) => [k, d.somme])), { lourde: 11, agile: 6, precise: 7 });
  assert.equal(f.attaque.nom, "Couteau d'office");
  assert.equal(f.attaque.de.de, "d6", "arme précise : Pré + Agi = 6");
});

test("défense — types mêlés : le dé le plus faible, et la mention du désavantage ; un seul type : son dé", () => {
  const meles = fiche((p) => {
    p.caracteristiques = { force: 6, agilite: 2, precision: 4, sens: 5, culture_neruvienne: 4, savoir_sauvage: 4, parole: 4, empathie: 3, creativite: 4 };
    p.equipement[2].place = "sac"; // Tablier de cuir, agile
    p.equipement[3].place = "equipe"; // Plastron de fonte, lourde
    p.equipement[5].place = "sac"; // Maniques, agile
    p.equipement[6].place = "sac"; // Toque, agile
  });
  // Lourde For+Sen = 11 → d10 ; précise Pré+Emp = 7 → d6 : le plus faible.
  assert.deepEqual([meles.defense.type, meles.defense.de.de, meles.defense.meles], ["precise", "d6", true]);
  assert.equal(meles.defense.mention, "désavantage sans la maîtrise de toutes les pièces");
  assert.deepEqual(meles.defense.pieces, ["Plastron de fonte", "Guêtres de toile"]);
  const seul = fiche((p) => {
    for (const rang of [2, 4, 5, 6]) p.equipement[rang].place = "sac";
    p.equipement[3].place = "equipe";
  });
  assert.deepEqual([seul.defense.type, seul.defense.de.de, seul.defense.meles, seul.defense.mention], ["lourde", "d6", false, ""]);
});

test("défense — sans aucune pièce : le dé le plus avantageux des trois, avec son type", () => {
  const f = fiche((p) => {
    p.caracteristiques = { force: 6, agilite: 2, precision: 4, sens: 5, culture_neruvienne: 4, savoir_sauvage: 4, parole: 4, empathie: 3, creativite: 4 };
    for (const rang of [2, 4, 5, 6]) p.equipement[rang].place = "sac";
  });
  assert.deepEqual(f.defense.pieces, []);
  assert.deepEqual([f.defense.type, f.defense.de.de], ["lourde", "d10"]);
  assert.match(f.defense.mention, /plus avantageux/);
});

test("armure — l'ordre des six zones de l'élément Armure, et la plus élevée par zone, jamais la somme", () => {
  assert.deepEqual(ZONES.map((z) => z.code), ["torse", "jambe_gauche", "jambe_droite", "bras_gauche", "bras_droit", "tete"]);
  assert.deepEqual(ZONES.map((z) => z.d20), ["2-11", "12-13", "14-15", "16-17", "18-19", "1"]);
  // Tablier de cuir 30/0/0/0/0/0 (qualité 2), Guêtres 0/10/10/0/0/0 (X),
  // Maniques 0/0/0/15/15/0 (qualité 1 : 10), Toque 0/0/0/0/0/5 (qualité 3 : 6).
  const f = fiche();
  assert.deepEqual(f.armure.zones, { torse: 30, jambe_gauche: 10, jambe_droite: 10, bras_gauche: 10, bras_droit: 10, tete: 6 });
  // Deux pièces sur le torse : la plus élevée, et le livret les interdit ensemble.
  const deux = fiche((p) => (p.equipement[3].place = "equipe")); // Plastron de fonte 40, qualité X
  assert.equal(deux.armure.zones.torse, 40, "la plus élevée des deux, pas 70");
  assert.deepEqual(deux.armure.couvertes.torse, ["Tablier de cuir", "Plastron de fonte"]);
  assert.ok(deux.avertissements.some((a) => /Torse : Tablier de cuir et Plastron de fonte couvrent la même zone/.test(a.texte)));
  assert.ok(manques(BANQUE, personnageEssai((p) => (p.equipement[3].place = "equipe")), { index: INDEX })[7].some((m) => /même zone/.test(m)));
});

test("qualité — 1/3 + q/3, en fractions exactes, arrondi inférieur une fois l'opération faite ; X laisse les valeurs brutes", () => {
  const bloc = INDEX.bloc("Rouleau de fonte");
  const degats = (q) => valeursParametre("degats", "8/11/13", { qualite: qualiteDe(bloc, q) }).valeurs;
  assert.deepEqual(degats(null), [8, 11, 13], "qualité X : valeurs brutes");
  assert.equal(qualiteDe(bloc, null).texte, "X");
  assert.deepEqual(degats("1"), [5, 7, 8], "× 2/3 : 5,33 → 5 ; 7,33 → 7 ; 8,67 → 8");
  assert.deepEqual(degats("2"), [8, 11, 13], "× 1, exactement : jamais 7 ou 10 par la virgule flottante");
  assert.deepEqual(degats("3"), [10, 14, 17], "× 4/3 : 10,67 → 10 ; 14,67 → 14 ; 17,33 → 17");
  assert.deepEqual(degats("1,5"), [6, 9, 10], "× 5/6");
  assert.deepEqual(valeursParametre("degats", "5/10/15", { qualite: qualiteDe(bloc, "2") }).valeurs, [5, 10, 15]);
  // En virgule flottante, 15 × (1/3 + 4/3) vaut 24,999… et s'arrondirait à 24.
  assert.equal(Math.floor(15 * (1 / 3 + 4 / 3)), 24);
  assert.deepEqual(valeursParametre("degats", "5/10/15", { qualite: qualiteDe(bloc, "4") }).valeurs, [8, 16, 25]);
  // La qualité ne touche que dégâts, défense et armure.
  assert.deepEqual(valeursParametre("portee", "3", { qualite: qualiteDe(bloc, "3") }).valeurs, [3]);
  // Sans paramètre qualite, pas de qualité.
  assert.equal(qualiteDe(INDEX.bloc("Bouillon revigorant"), "2").applicable, false);
  const f = fiche();
  assert.deepEqual(f.attaque.degats, [3, 8, 20], "Couteau d'office, qualité 2");
  assert.equal(f.bouclier.defense, 8);
  assert.equal(fiche((p) => (p.equipement[7].qualite = "1")).bouclier.defense, 5, "défense 8 × 2/3");
});

test("expressions — nombres à virgule, priorités, arrondi inférieur ; toute autre forme refusée", () => {
  const n = (x) => (nom) => (nom === "N" ? fraction(x) : null);
  assert.equal(evaluer("2+3*4").entier, 14);
  assert.equal(evaluer("7/2").entier, 3);
  assert.equal(evaluer("1/3 + 2/3").entier, 1, "exactement 1");
  assert.equal(evaluer("0,5*5").entier, 2);
  assert.equal(evaluer("N-1", n(1)).entier, 0);
  assert.equal(evaluer("5*N", n(3)).entier, 15);
  assert.equal(evaluer("10 - 4 - 3").entier, 3, "de gauche à droite");
  assert.equal(evaluer("12/2/3").entier, 2, "de gauche à droite");
  assert.equal(entierInferieur(fraction(-7, 2)), -4);
  assert.deepEqual(evaluer("X"), { x: true });
  assert.deepEqual(lireNombre("0,5"), { n: 1, d: 2 });
  for (const forme of ["(1+2)", "-1", "2*", "{inconnu}", "3/0", "abc", "", "1,2,3", "2 3"]) assert.ok(evaluer(forme).erreur, forme);
});

test("mains nues — {force}*0,5/{force}/{force}*2 : les dégâts calculés, et un dé vide faute de règle", () => {
  const avec = (force) =>
    fiche((p) => {
      p.equipement[0].place = "sac";
      p.caracteristiques.force = force;
    });
  const f5 = avec(5);
  assert.equal(f5.attaque.mainsNues, true);
  assert.equal(f5.attaque.nom, "Taloche");
  assert.deepEqual(f5.attaque.degats, [2, 5, 10], "2,5 → 2");
  assert.equal(f5.attaque.de, null);
  assert.deepEqual(avec(3).attaque.degats, [1, 3, 6]);
  assert.deepEqual(avec(4).attaque.degats, [2, 4, 8]);
  // La description de Taloche, [N*{degats}], au niveau 1 puis 2.
  assert.equal(capacite(f5, "Taloche").descriptions[0].texte, "Une taloche qui inflige 2/5/10.");
  const niveau2 = fiche((p) => {
    p.caracteristiques.force = 5;
    p.niveaux = [{ capacite: "Taloche", niveau: 2 }];
  });
  assert.equal(capacite(niveau2, "Taloche").descriptions[0].texte, "Une taloche qui inflige 4/10/20.");
});

test("coût affiché — à la puissance de la capacité : N remplacé ; la variante de sa puissance ; un coût vide vaut 0", () => {
  assert.deepEqual(coutA(INDEX.capacite("Flambage"), 2), { souffle: "10", lien: "0" });
  assert.deepEqual(coutA(INDEX.capacite("Pas chassé"), 3), { souffle: "2", lien: "0" });
  assert.deepEqual(coutA(INDEX.capacite("Fournaise"), 1), { souffle: "1", lien: "1" });
  assert.deepEqual(coutA(INDEX.capacite("Fournaise"), 3), { souffle: "7", lien: "1" });
  assert.deepEqual(coutA(INDEX.capacite("Jet de sel"), 0), { souffle: "X", lien: "0" });
  assert.deepEqual(capacite(fiche(), "Flambage").cout, { souffle: "10", lien: "0" });
  const fournaise = capacite(fiche((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 2 }])), "Fournaise");
  assert.deepEqual([fournaise.niveau, fournaise.cout.souffle, fournaise.descriptions[0].texte], [2, "3", "Brûle trois adversaires à 1 case."]);
});

test("points — coûts 1, 3 et 6 ; plafond de 10 ; reliquat ; niveau 0 et capacités à venir hors du décompte", () => {
  assert.deepEqual(COUT_NIVEAU.slice(1), [1, 3, 6]);
  const f = fiche();
  // Base 2 (Pas chassé, Taloche), Marmiton 1 (Vif), Saucier 4 (Réduction,
  // Flambage, Solo du chef, Maîtrise de l'agile), Fournaise 1 ; Flambage
  // monté au niveau 2 : 3 au lieu de 1.
  assert.deepEqual(f.points, { depenses: 10, recus: 8, plafond: 10, reliquat: 0, depasse: false });
  for (const nom of ["Nez fin", "Dressage minute", "Cendre", "Goûter", "Frappe"]) assert.equal(capacite(f, nom).niveau, 0, nom);
  const sansMontee = fiche((p) => (p.niveaux = []));
  assert.deepEqual([sansMontee.points.depenses, sansMontee.points.reliquat], [8, 2]);
  // Monter Flambage au niveau 3 coûterait 6 : 13 > 10, refusé.
  assert.deepEqual(niveauxPermis(sansMontee, capacite(sansMontee, "Flambage")), [1, 2]);
  assert.deepEqual(niveauxPermis(sansMontee, capacite(sansMontee, "Nez fin")), [0]);
  const trois = fiche((p) => (p.niveaux = [{ capacite: "Flambage", niveau: 3 }]));
  assert.equal(trois.points.depasse, true);
  assert.ok(manques(BANQUE, personnageEssai((p) => (p.niveaux = [{ capacite: "Flambage", niveau: 3 }])), { index: INDEX })[8].length);
});

test("points — des capacités reçues au-delà de 10 : aucune montée possible, et le total réel", () => {
  // Braise (N) au lieu de Cendre, la constellation du Chaudron (Bouillonnement,
  // N), la spatule (Moulinet farineux, N) : 8 − 0 + 1 + 1 + 1 = 11.
  const f = fiche((p) => {
    p.primordial.choix = ["Braise"];
    p.constellation.nom = "Constellation du Chaudron";
    p.equipement.push({ nom: "Spatule souple", choix: [], qualite: null, place: "sac" });
    p.niveaux = [];
  });
  assert.deepEqual([f.points.recus, f.points.depenses, f.points.reliquat], [11, 11, 0]);
  for (const c of f.capacites) assert.ok(niveauxPermis(f, c).length <= 1, `${c.nom} ne peut pas monter`);
});

test("capacité reçue deux fois : une seule capacité, comptée une fois ; ses deux origines dites", () => {
  const f = fiche((p) => {
    p.equipement.push({ nom: "Spatule souple", choix: [], qualite: null, place: "sac" }, { nom: "Louche d'acier", choix: [], qualite: null, place: "sac" });
    p.niveaux = [];
  });
  const moulinets = f.capacites.filter((c) => c.nom === "Moulinet farineux");
  assert.equal(moulinets.length, 1);
  assert.deepEqual(moulinets[0].origines, ["Spatule souple", "Louche d'acier"]);
  assert.equal(f.points.depenses, 9, "8, et une seule fois le Moulinet");
  const frappes = f.capacites.filter((c) => c.nom === "Frappe");
  assert.equal(frappes.length, 1);
  assert.deepEqual(frappes[0].descriptions.map((d) => d.texte), ["Une attaque qui inflige 3/8/20.", "Une attaque qui inflige 8/11/13.", "Une attaque qui inflige 5/10/15."]);
});

test("capacité absente de Capacites : « capacité à venir », hors du décompte", () => {
  const f = fiche((p) => p.equipement.push({ nom: "Poêle en fonte", choix: [], qualite: null, place: "sac" }));
  const omelette = capacite(f, "Omelette fantôme");
  assert.deepEqual([omelette.aVenir, omelette.niveau], [true, null]);
  assert.ok(f.avertissements.some((a) => a.genre === "a_venir" && /Omelette fantôme/.test(a.texte)));
  assert.equal(f.points.depenses, 10);
});

test("groupes — ( a | b ) : exactement une option ; [ a | b ] : zéro, une ou plusieurs ; un choix disparu se signale", () => {
  const saucier = INDEX.bloc("Saucier");
  assert.equal(capacitesDuBloc(saucier, []).manques.length, 2);
  assert.match(capacitesDuBloc(saucier, ["Solo du chef", "Brigade", "Maîtrise du lourd"]).manques[0], /une seule option/);
  assert.deepEqual(capacitesDuBloc(saucier, ["solo du chef", "Maîtrise du lourd"]).manques, [], "comparé sans casse");
  const tablier = INDEX.bloc("Tablier");
  for (const choix of [[], ["Brûlure légère"], ["Brûlure légère", "Doigt pincé"]]) {
    const lu = capacitesDuBloc(tablier, choix);
    assert.deepEqual(lu.manques, []);
    assert.deepEqual(lu.capacites.map((c) => c.nom), choix);
  }
  assert.deepEqual(capacitesDuBloc(saucier, ["Solo du chef", "Maîtrise du lourd", "Fantôme"]).disparus, ["Fantôme"]);
  const f = fiche((p) => p.archetype.choix.push("Fantôme"));
  assert.ok(f.avertissements.some((a) => /« Fantôme » ne figure plus/.test(a.texte)));
});

test("style de combat — une capacité à l'élément « Style de combat » va dans son groupe, et dans l'en-tête", () => {
  const f = fiche();
  assert.deepEqual(f.groupes.style.map((c) => c.nom), ["Solo du chef"]);
  assert.equal(f.style, "Solo du chef");
  assert.deepEqual(f.groupes.archetype.map((c) => c.nom), ["Réduction", "Flambage", "Dressage minute", "Maîtrise de l'agile"]);
  assert.deepEqual(f.groupes.acquises, []);
});

test("tirage — chaque bloc Constellation est atteignable, sans biais", () => {
  const constellations = INDEX.blocsDeType("constellation").map((b) => b.nom);
  assert.equal(constellations.length, 3);
  const suite = (...valeurs) => (tableau) => (tableau[0] = valeurs.shift());
  for (let i = 0; i < 3; i += 1) assert.equal(tirerConstellation(BANQUE, suite(i)), constellations[i]);
  // Les valeurs au-delà du dernier multiple de 3 sont rejetées.
  const limite = Math.floor(2 ** 32 / 7) * 7; // 4 294 967 292
  assert.equal(tirerIndice(7, suite(limite, 2 ** 32 - 1, 9)), 2);
  assert.equal(tirerIndice(7, suite(limite - 1)), (limite - 1) % 7);
  // Et le générateur du navigateur les atteint toutes.
  const vues = new Set();
  for (let i = 0; i < 300; i += 1) vues.add(tirerConstellation(BANQUE));
  assert.deepEqual([...vues].sort(), [...constellations].sort());
});

test("points de lien — la puissance investie dans les capacités du primordial ; sans capacité, 0 et « capacités à venir »", () => {
  assert.deepEqual(fiche().liens.map((l) => [l.nom, l.points]), [["Grand Four", 1]], "Fournaise 1, Cendre 0");
  const braise = fiche((p) => {
    p.primordial.choix = ["Braise"];
    p.niveaux = [{ capacite: "Fournaise", niveau: 2 }];
  });
  assert.equal(braise.liens[0].points, 3, "Fournaise 2 + Braise 1");
  const givre = fiche((p) => (p.primordial = { nom: "Givre éternel", choix: [] }));
  assert.deepEqual([givre.liens[0].points, givre.liens[0].pouvoirs.length, givre.primordial.aVenir], [0, 0, true]);
});

test("niveaux — N de 1 à 3 ; puissance 0 au niveau 0 ; variantes 1, 2, 3 ; une montée impossible est signalée", () => {
  assert.deepEqual(evolution(INDEX.capacite("Flambage")), { niveauCreation: 1, niveauMax: 3, peutEvoluer: true });
  assert.deepEqual(evolution(INDEX.capacite("Nez fin")), { niveauCreation: 0, niveauMax: 0, peutEvoluer: false });
  assert.deepEqual(evolution(INDEX.capacite("Fournaise")), { niveauCreation: 1, niveauMax: 3, peutEvoluer: true });
  const f = fiche((p) => (p.niveaux = [{ capacite: "Nez fin", niveau: 2 }, { capacite: "Inexistante", niveau: 2 }]));
  assert.equal(capacite(f, "Nez fin").niveau, 0);
  assert.ok(f.avertissements.some((a) => /« Nez fin » ne peut pas être au niveau 2/.test(a.texte)));
  assert.ok(f.avertissements.some((a) => /« Inexistante » vise une capacité que le personnage n'a pas/.test(a.texte)));
});

test("banque — sans types (publiée avant la colonne), le créateur le dit ; la fiche imprime la date de la banque", () => {
  const ancienne = { ...BANQUE, blocs: BANQUE.blocs.map(({ type: _type, ...bloc }) => bloc) };
  assert.deepEqual(banqueUtilisable(ancienne), { erreur: MESSAGE_BANQUE_SANS_TYPES });
  assert.equal(MESSAGE_BANQUE_SANS_TYPES, "Le créateur a besoin d'une banque republiée depuis le classeur à jour.");
  assert.deepEqual(banqueUtilisable(BANQUE), { ok: true });
  assert.equal(calculerFiche({ ...BANQUE, publiee_le: "2026-09-29T22:34:00+02:00" }, personnageEssai()).banque.publiee_le, "2026-09-29T22:34:00+02:00");
});

test("suivi — un choix modifié ou disparu depuis l'enregistrement se signale ; une note de conception ne compte pas", () => {
  const p = personnageEssai();
  const releve = relever(INDEX, calculerFiche(BANQUE, p, { index: INDEX }), p);
  assert.ok(releve.some((e) => e.genre === "bloc" && e.nom === "Saucier"));
  assert.ok(releve.some((e) => e.genre === "capacite" && e.nom === "Flambage"));
  assert.deepEqual(changements(INDEX, releve), []);
  const modifiee = structuredClone(BANQUE);
  modifiee.blocs.find((b) => b.nom === "Saucier").notes = "Une autre note de conception.";
  modifiee.capacites.find((c) => c.nom === "Flambage").variantes[0].cout_souffle = "4*N";
  modifiee.blocs = modifiee.blocs.filter((b) => b.nom !== "Maniques");
  const phrases = changements(indexerCreation(modifiee), releve);
  assert.deepEqual(phrases, [
    "Le bloc « Maniques » a disparu de la banque depuis l'enregistrement.",
    "La capacité « Flambage » a changé dans la banque depuis l'enregistrement.",
  ]);
  const f = calculerFiche(modifiee, { ...p, empreintes: releve });
  assert.ok(f.avertissements.some((a) => a.texte === phrases[1]));
});

test("parcours — ce qui manque, étape par étape ; le personnage d'essai est complet", () => {
  assert.deepEqual(manques(BANQUE, personnageEssai(), { index: INDEX })[9], []);
  const vide = manques(BANQUE, personnageEssai((p) => {
    p.identite.nom = " ";
    p.caracteristiques.force = null;
    p.archetype = null;
    p.espece = { nom: "Espèce effacée", choix: [] };
    p.constellation = null;
    p.primordial.choix = [];
  }), { index: INDEX });
  assert.deepEqual(vide[1], ["Donnez un nom au personnage."]);
  assert.deepEqual(vide[2], ["Donnez une valeur de 2 à 6 à : Force."]);
  assert.deepEqual(vide[3], ["Choisissez un archétype."]);
  assert.match(vide[4][0], /« Espèce effacée » n'existe plus/);
  assert.match(vide[5][0], /Tirez la constellation au sort/);
  assert.match(vide[6][0], /Choisir une option parmi : Braise, Cendre/);
  assert.equal(vide[9].length, 6);
  // Un fichier importé peut nommer un bloc d'un autre type.
  const autreType = manques(BANQUE, personnageEssai((p) => (p.archetype = { nom: "Marmiton", choix: [] })), { index: INDEX });
  assert.deepEqual(autreType[3], ["« Marmiton » n'est pas du type Archétype : choisissez un archétype."]);
  const trop = manques(BANQUE, personnageEssai((p) => (p.caracteristiques.force = 6)), { index: INDEX });
  assert.deepEqual(trop[2], ["La somme vaut 38 : il faut 36 (2 de trop)."]);
});

test("relecture — mains nues : les dégâts de la capacité à sa puissance, comme sa description", () => {
  const f = fiche((p) => {
    p.equipement[0].place = "sac";
    p.caracteristiques.force = 5;
    p.niveaux = [{ capacite: "Taloche", niveau: 2 }];
  });
  assert.deepEqual(f.attaque.degats, [4, 10, 20], "[N*{degats}] au niveau 2");
  assert.equal(capacite(f, "Taloche").descriptions[0].texte, "Une taloche qui inflige 4/10/20.");
});

test("relecture — une montée orpheline ne bloque pas l'enregistrement ; un paramètre incalculable se signale ; « capacités à venir »", () => {
  // Flambage monté, puis l'archétype change : la montée ne vise plus rien.
  const orpheline = personnageEssai((p) => {
    p.archetype = { nom: "Pâtissier", choix: ["Brigade", "Maîtrise de l'agile"] };
    p.primordial.choix = ["Braise"];
    p.constellation.nom = "Constellation du Chaudron";
    p.equipement.push({ nom: "Spatule souple", choix: [], qualite: null, place: "sac" });
  });
  const f = calculerFiche(BANQUE, orpheline, { index: INDEX });
  assert.equal(f.points.depasse, true);
  assert.deepEqual(manques(BANQUE, orpheline, { index: INDEX })[8], [], "aucune montée appliquée : rien à retirer");
  // Un paramètre de bloc qui ne se calcule pas : gardé tel quel, et signalé.
  const modifiee = structuredClone(BANQUE);
  modifiee.blocs.find((b) => b.nom === "Couteau d'office").parametres.push({ nom: "chaleur", valeur: "(3)", cible: null });
  modifiee.capacites.find((c) => c.nom === "Émincer").variantes[0].description = "Émince pour {chaleur}.";
  const g = calculerFiche(modifiee, personnageEssai());
  assert.equal(g.capacites.find((c) => c.nom === "Émincer").descriptions[0].texte, "Émince pour (3).");
  assert.ok(g.avertissements.some((a) => a.genre === "expression" && /Couteau d'office.*\(3\)/.test(a.texte)));
  // Un primordial et une constellation sans capacité : « capacités à venir ».
  const givre = fiche((p) => (p.primordial = { nom: "Givre éternel", choix: [] }));
  const aVenir = givre.avertissements.filter((a) => a.genre === "a_venir").map((a) => a.texte);
  assert.deepEqual(aVenir, ["« Constellation du Sablier » : capacités à venir.", "« Givre éternel » : capacités à venir."]);
});

// Lot 2 bis : la place de chaque objet décide de ce qui compte.
test("places — les pièces du pack sont portées ; le bouclier équipé compte, un seul ; rangés, ils ne comptent pas", () => {
  const pack = fiche((p) => {
    p.equipement = [
      { nom: "Maniques", choix: [], qualite: "2", place: "pack" },
      { nom: "Tablier de cuir", choix: [], qualite: "2", place: "pack" },
      { nom: "Toque renforcée", choix: [], qualite: "2", place: "pack" },
    ];
  });
  assert.deepEqual(pack.defense.pieces, ["Maniques", "Tablier de cuir", "Toque renforcée"]);
  assert.deepEqual(pack.armure.zones, { torse: 30, jambe_gauche: 0, jambe_droite: 0, bras_gauche: 15, bras_droit: 15, tete: 5 });
  const range = fiche((p) => p.equipement.forEach((o) => (o.place = "sac")));
  assert.deepEqual([range.defense.pieces, range.bouclier, range.attaque.mainsNues], [[], null, true]);
  const bouclier = fiche();
  assert.deepEqual([bouclier.bouclier.nom, bouclier.bouclier.defense], ["Couvercle de marmite", 8]);
  const deux = fiche((p) => p.equipement.push({ nom: "Couvercle de marmite", choix: [], qualite: "2", place: "equipe" }));
  assert.ok(deux.avertissements.some((a) => /Plusieurs boucliers sont équipés : seul « Couvercle de marmite » compte\./.test(a.texte)));
});

test("places — le parcours signale une place fautive : une arme tenue qui n'en est pas une, un objet équipé qui ne s'équipe pas, deux boucliers", () => {
  const avec = (modifier) => manques(BANQUE, personnageEssai(modifier), { index: INDEX })[7];
  const tablierTenu = avec((p) => {
    p.equipement[0].place = "sac";
    p.equipement[2].place = "arme";
  });
  assert.ok(tablierTenu.includes("« Tablier de cuir » n'est pas une arme : choisissez l'arme tenue dans la liste « Arme »."), tablierTenu.join(" | "));
  assert.ok(avec((p) => (p.equipement[8].place = "equipe")).includes("« Bouillon revigorant » ne s'équipe pas : rangez-le dans le sac."));
  assert.ok(avec((p) => (p.equipement[1].place = "equipe")).includes("« Rouleau de fonte » : une seule arme se tient, celle de la liste « Arme » ; rangez celle-ci."));
  assert.ok(avec((p) => p.equipement.push({ nom: "Couvercle de marmite", choix: [], qualite: "2", place: "equipe" })).includes("Un seul bouclier s'équipe : rangez les autres dans le sac."));
  assert.ok(avec((p) => (p.equipement[1].place = "pack")).includes("« Rouleau de fonte » n'est pas une pièce d'armure : choisissez de nouveau le pack."));
  assert.deepEqual(avec(() => {}), []);
});
