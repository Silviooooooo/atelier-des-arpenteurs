// Contrôles de l'import (SPECIFICATION.md, § 5.1 et § 6) : la banque tirée
// du classeur d'essai a le format du § 5.1, les colonnes se retrouvent par
// leur en-tête, les valeurs restent des chaînes et le brut garde tout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { ENTETES, avecAdversaires } from "./outils/adversaires_essai.js";
import { CLASSEUR_ESSAI } from "./outils/classeur_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";

const _ = null;
const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));

async function banque() {
  const resultat = await importerFichier(ESSAI, "classeur_essai.xlsx");
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  return resultat.banque;
}

test("import — la banque a le format du § 5.1, avec la source et son empreinte", async () => {
  const b = await banque();
  assert.deepEqual(Object.keys(b), ["format", "sources", "blocs", "capacites", "elements", "types_adversaires", "adversaires", "lisez_moi", "anomalies"]);
  assert.equal(b.format, 1);
  const empreinte = `sha256:${createHash("sha256").update(ESSAI).digest("hex")}`;
  assert.deepEqual(b.sources, [{ classeur: "regles", fichier: "classeur_essai.xlsx", empreinte }]);
  assert.deepEqual([b.blocs.length, b.capacites.length, b.elements.length, b.lisez_moi.length], [39, 52, 23, 5]);
  assert.deepEqual([b.types_adversaires.length, b.adversaires.length], [2, 5]);
});

// La feuille Adversaires (§ 16.1) : une ligne par type ou par adversaire, ses
// cellules gardées en texte, telles qu'écrites, espaces de bord retirés ;
// rien n'y est lu ni calculé à l'import.
test("import — un type d'adversaire et un adversaire : cellules telles qu'écrites, et brut", async () => {
  const b = await banque();
  assert.deepEqual(b.types_adversaires.map((t) => t.nom), ["Commis", "Rôtisseur"]);
  assert.deepEqual(b.adversaires.map((a) => a.nom), ["Marmiton de corvée", "Chef de partie", "Plongeur", "Homard furieux", "Mouette chapardeuse"]);
  // Une ligne de classe porte « Classe » dans la colonne Nom, et son nom dans la colonne Classe.
  assert.deepEqual(b.types_adversaires[1], {
    nom: "Rôtisseur",
    localisation: "",
    actions: "",
    souffle: "5",
    attaque: "4",
    defense: "5",
    equipement: "Spatule souple, Armure agile",
    capacites: "//, Maitrise de l'agile[1]",
    brut: {
      feuille: "Adversaires",
      ligne: 3,
      cellules: {
        Nom: "Classe",
        CLASSE: "Rôtisseur",
        Localisations: "",
        "Nombre  d'actions": "",
        souffle: "5",
        Attaque: "4",
        Defense: "5",
        Équipement: "Spatule souple, Armure agile",
        Capacites: "//, Maitrise de l'agile[1]",
        Infos: "Classe ; « // » reprend la liste héritée ; un pack d'armure ; A1 : Maitrise",
      },
    },
  });
  const chef = b.adversaires[1];
  assert.deepEqual(
    [chef.nom, chef.types, chef.localisation, chef.actions, chef.equipement, chef.capacites, chef.brut.ligne],
    ["Chef de partie", "Commis/Rôtisseur[1,4]", "", "", "", "//, Maîtrise de l'agile[3], Pas chassé[2]", 5],
  );
  // Un type n'a pas de colonne Type à lui : elle porte son nom.
  assert.equal("types" in b.types_adversaires[0], false);
  // Les en-têtes se retrouvent sans casse, accents ni espaces : « Nombre  d'actions », « Defense ».
  assert.deepEqual([b.types_adversaires[0].actions, b.types_adversaires[0].defense], ["1", "4"]);
});

// Les noms neufs du lot 5 (§ 4.1, § 16.1) : « Classe » et « Localisations ».
// Les anciens, « Type » et « Localisation », restent admis : un en-tête se
// cherche sous le nom neuf, puis sous l'ancien.
async function importerVariante(description) {
  const resultat = await importerFichier(fabriquerClasseur(description), "variante.xlsx");
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  return resultat;
}
const e1 = (anomalies) => anomalies.map((a) => [a.code, a.feuille, a.ligne, a.message]);

test("import — la feuille Adversaires aux anciens noms s'importe à l'identique, hors brut.cellules et sources", async () => {
  const ancienne = structuredClone(CLASSEUR_ESSAI);
  const lignes = ancienne.feuilles.find((feuille) => feuille.nom === "Adversaires").lignes;
  assert.deepEqual(lignes[0].slice(0, 3), ["Nom", "CLASSE", "Localisations"]);
  lignes[0].splice(1, 2, "Type", "Localisation");
  for (const ligne of lignes.filter((l) => l?.[0] === "Classe")) ligne[0] = "Type";
  const neuve = await banque();
  const { banque: lue, anomalies } = await importerVariante(ancienne);
  const sansCellules = (b) => {
    const copie = structuredClone(b);
    delete copie.sources;
    for (const entree of [...copie.types_adversaires, ...copie.adversaires]) delete entree.brut.cellules;
    return copie;
  };
  assert.deepEqual(sansCellules(lue), sansCellules(neuve));
  assert.deepEqual(anomalies, neuve.anomalies);
  // Le brut garde l'en-tête tel qu'il est écrit.
  const rotisseur = lue.types_adversaires.find((t) => t.nom === "Rôtisseur").brut.cellules;
  assert.deepEqual([rotisseur.Nom, rotisseur.Type, rotisseur.Localisation], ["Type", "Rôtisseur", ""]);
});

test("import — une ligne de classe porte « Classe » ou « Type » dans la colonne Nom, sans casse, sous l'un ou l'autre en-tête", async () => {
  for (const entete of ["Classe", "Type"]) {
    const entetes = ENTETES.map((e) => (e === "Type" ? entete : e));
    const { banque: b } = await importerVariante(avecAdversaires([["CLASSE", "Mitron", "Corps(2)", 1, 1, 1, 1], ["classe", "Gâte-pâte", _, 2], ["A", "Mitron/Gâte-pâte"]], { entetes }));
    assert.deepEqual(b.types_adversaires.map((t) => t.nom), ["Commis", "Rôtisseur", "Mitron", "Gâte-pâte"], entete);
    assert.deepEqual(b.adversaires.map((a) => [a.nom, a.types]), [["Marmiton", "Commis/Rôtisseur"], ["A", "Mitron/Gâte-pâte"]], entete);
  }
});

test("import — E1 : sans « Classe » ni « Type », sans « Localisations » ni « Localisation », l'import s'arrête et dit l'ancien nom", async () => {
  const sans = (...retires) => ENTETES.map((e) => (retires.includes(e) ? "Notes" : e));
  const classe = "L'en-tête « Classe » est introuvable dans la feuille Adversaires (l'ancien nom « Type » est aussi admis) : l'import s'arrête.";
  const zones = "L'en-tête « Localisations » est introuvable dans la feuille Adversaires (l'ancien nom « Localisation » est aussi admis) : l'import s'arrête.";
  for (const [retires, attendues] of [
    [["Type"], [classe]],
    [["Localisation"], [zones]],
    [["Type", "Localisation"], [classe, zones]],
  ]) {
    const { banque: b, anomalies } = await importerVariante(avecAdversaires([], { entetes: sans(...retires) }));
    assert.equal(b, null);
    assert.deepEqual(e1(anomalies), attendues.map((message) => ["E1", "Adversaires", 1, message]), retires.join(", "));
  }
});

test("import — le nom neuf l'emporte sur l'ancien quand la feuille porte les deux", async () => {
  // « Type » et « Localisation » sont ici des colonnes de notes, avant les colonnes neuves.
  const entetes = ["Nom", "Type", "Localisation", "Nombre d'actions", "Souffle", "Attaque", "Défense", "Equipement", "Capacités", "Classe", "Localisations"];
  const ligne = (nom, notes, classe, zones) => [nom, notes, notes, 1, 1, 1, 1, _, _, classe, zones];
  const { banque: b } = await importerVariante(avecAdversaires([ligne("Classe", "note", "Mitron", "Corps(2)"), ligne("A", "note", "Mitron", _)], { entetes, socle: false }));
  assert.deepEqual(b.types_adversaires.map((t) => [t.nom, t.localisation]), [["Mitron", "Corps(2)"]]);
  assert.deepEqual(b.adversaires.map((a) => [a.nom, a.types, a.localisation]), [["A", "Mitron", ""]]);
});

test("import — E2 : une classe sans nom cite l'en-tête tel qu'il est écrit dans le classeur", async () => {
  for (const entete of ["CLASSE", "Type"]) {
    const entetes = ENTETES.map((e) => (e === "Type" ? entete : e));
    const { anomalies } = await importerVariante(avecAdversaires([["Classe", _, "Corps(2)"]], { entetes }));
    assert.deepEqual(
      anomalies.filter((a) => a.code === "E2" && a.feuille === "Adversaires").map((a) => [a.feuille, a.ligne, a.message]),
      [["Adversaires", 5, `La ligne 5 définit une classe sans nom (colonne ${entete} vide) : elle n'entre pas dans la banque.`]],
    );
  }
});

test("import — un bloc : éléments, capacités, paramètres, notes et brut", async () => {
  const bloc = (await banque()).blocs.find((b) => b.nom === "Rouleau à pâtisserie");
  assert.deepEqual(bloc, {
    nom: "Rouleau à pâtisserie",
    type: "Arme",
    elements: [{ nom: "Brûlant", cible: "Coup de louche" }],
    capacites: [
      { forme: "simple", nom: "Coup de louche" },
      { forme: "choix", options: ["Sauce piquante"] },
    ],
    parametres: [{ nom: "chaleur", valeur: "{force}*0,5/{force}/{force}*2", cible: "Coup de louche" }],
    notes: "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
    brut: {
      feuille: "Blocs",
      ligne: 5,
      cellules: {
        Nom: "Rouleau à pâtisserie",
        "Eléments transmis aux capacités": "Brûlant(Coup de louche)",
        Capacités: "Coup de louche, ( Sauce piquante )",
        "Paramètres transmis aux capacités": "{chaleur:{force}*0,5/{force}/{force}*2}(Coup de louche)",
        Infos: "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
        TYPE: "Arme",
      },
    },
  });
});

test("import — capacités : une variante par ligne, retrouvée malgré l'ordre et l'écriture des en-têtes", async () => {
  const b = await banque();
  const sauce = b.capacites.find((c) => c.nom === "Sauce piquante");
  assert.deepEqual(sauce.variantes.map((v) => v.puissance), ["1", "2", "3", "2"]);
  const { brut, ...troisieme } = sauce.variantes[2];
  assert.deepEqual(troisieme, {
    puissance: "3",
    cout_souffle: "4",
    cout_lien: "1",
    elements: [{ nom: "Brûlant" }],
    description: "[N*{chaleur}] point(s).",
    notes: "",
  });
  assert.equal(brut.ligne, 7);
  assert.equal(brut.cellules["Éléments propres"], "Brûlant");
});

// Les ajouts du lot 4 au classeur d'essai (§ 10.3), pour le simulateur de
// combat : mot pour mot, car la banque de démonstration en est tirée
// (tests/site.test.js), et le simulateur les lit dans la démonstration.
test("import — les ajouts du simulateur de combat : deux éléments, Passif et Intervention sur leurs capacités, deux capacités du bloc de base", async () => {
  const b = await banque();
  const element = (nom) => {
    const { brut, ...reste } = b.elements.find((e) => e.nom === nom);
    return { ...reste, ligne: brut.ligne };
  };
  assert.deepEqual(element("Intervention"), { nom: "Intervention", parametres_recus: [], description: "Se joue pendant le tour adverse.", ligne: 23 });
  assert.deepEqual(element("Passif"), { nom: "Passif", parametres_recus: [], description: "Agit sans action.", ligne: 24 });
  // Les capacités qui portent chacun des deux éléments, dans l'ordre de la feuille : douze passifs, trois interventions ;
  // depuis la fin du combat (lot 4.3), les six capacités d'état, passives, suivent en fin de feuille.
  const portent = (nom) => b.capacites.filter((c) => c.variantes.some((v) => v.elements.some((e) => e.nom === nom))).map((c) => c.nom);
  assert.deepEqual(portent("Passif"), [
    "Vif", "Nez fin", "Costaud", "Palais d'acier", "Réduction", "Feuilletage",
    "Solo du chef", "Brigade", "Minutie", "Maîtrise du lourd", "Maîtrise de l'agile", "Maîtrise du précis",
    "Cheville tordue", "Main brûlée", "Côtes froissées", "Étourdi", "En nage", "Affamé",
  ]);
  assert.deepEqual(portent("Intervention"), ["Dressage minute", "Coup de chalumeau", "Pas de côté"]);
  // Un style de combat et une maîtrise gardent leur élément d'avant, devant le nouveau.
  const elements = (nom) => b.capacites.find((c) => c.nom === nom).variantes.map((v) => v.elements);
  for (const style of ["Solo du chef", "Brigade", "Minutie"]) assert.deepEqual(elements(style), [[{ nom: "Style de combat" }, { nom: "Passif" }]], style);
  for (const maitrise of ["Maîtrise du lourd", "Maîtrise de l'agile", "Maîtrise du précis"]) assert.deepEqual(elements(maitrise), [[{ nom: "Maîtrise" }, { nom: "Passif" }]], maitrise);
  assert.deepEqual(elements("Vif"), [[{ nom: "Passif" }]]);
  assert.deepEqual(elements("Coup de chalumeau"), [[{ nom: "Intervention" }]]);
  // Le bloc de base donne les deux capacités nouvelles, après les trois d'avant, sans changer de ligne.
  const gestes = b.blocs.find((bloc) => bloc.nom === "Gestes de cuisine");
  assert.deepEqual([gestes.type, gestes.brut.ligne], ["Base", 18]);
  assert.deepEqual(gestes.capacites, ["Pas chassé", "Goûter", "Taloche", "Pas de côté", "Guetter"].map((nom) => ({ forme: "simple", nom })));
  // Les deux capacités, cellule par cellule, en fin de feuille.
  const variantes = (nom) => b.capacites.find((c) => c.nom === nom).variantes.map(({ brut, notes, ...variante }) => ({ ...variante, ligne: brut.ligne }));
  assert.deepEqual(variantes("Pas de côté"), [
    { puissance: "0", cout_souffle: "X", cout_lien: "", elements: [{ nom: "Intervention" }], description: "Annulez [X] dégât(s) reçu(s).", ligne: 52 },
  ]);
  assert.deepEqual(variantes("Guetter"), [
    {
      puissance: "0",
      cout_souffle: "",
      cout_lien: "",
      elements: [],
      description: "Après un déplacement, ou pour finir son tour : une de vos capacités se joue en intervention jusqu'au prochain tour de votre camp.",
      ligne: 53,
    },
  ]);
  // Posés en fin de feuille : les dernières lignes d'Eléments et de Capacites, et aucune anomalie sur elles. La fin du
  // combat (lot 4.3) a posé après elles un élément et six capacités.
  assert.deepEqual([b.elements.at(-2).nom, b.capacites.at(-7).nom], ["Passif", "Guetter"]);
  assert.deepEqual(b.anomalies.filter((a) => (a.feuille === "Eléments" && a.ligne >= 23) || (a.feuille === "Capacites" && a.ligne >= 52)), []);
});

test("import — les ajouts de la fin du combat (lot 4.3) : l'élément Centré, deux blocs de type État, leurs six capacités, en fin de feuille", async () => {
  const b = await banque();
  const { brut, ...centre } = b.elements.find((e) => e.nom === "Centré");
  assert.deepEqual({ ...centre, ligne: brut.ligne }, { nom: "Centré", parametres_recus: [], description: "Touche toute la case de son auteur.", ligne: 25 });
  assert.deepEqual(b.capacites.find((c) => c.nom === "Moulinet farineux").variantes.map((v) => v.elements), [[{ nom: "Centré" }]]);
  // Les deux blocs, en fin de Blocs : un ensemble facultatif chacun.
  const bloc = (nom) => {
    const { type, capacites, elements, parametres, brut: { ligne } } = b.blocs.find((un) => un.nom === nom);
    return { type, capacites, elements, parametres, ligne };
  };
  assert.deepEqual(bloc("Blessure"), { type: "État", capacites: [{ forme: "facultatif", options: ["Cheville tordue", "Main brûlée", "Côtes froissées"] }], elements: [], parametres: [], ligne: 40 });
  assert.deepEqual(bloc("Condition"), { type: "État", capacites: [{ forme: "facultatif", options: ["Étourdi", "En nage", "Affamé"] }], elements: [], parametres: [], ligne: 41 });
  assert.deepEqual(b.blocs.slice(-2).map((un) => un.nom), ["Blessure", "Condition"]);
  // Les six capacités, cellule par cellule : puissance 0, sans coût, passives, origine « État ».
  const textes = {
    "Cheville tordue": "Vos déplacements coûtent une action de plus.",
    "Main brûlée": "Désavantage avec une arme précise.",
    "Côtes froissées": "Vos interventions coûtent 1 souffle de plus.",
    "Étourdi": "Votre prochaine action coûte une action de plus.",
    "En nage": "Vos jets de défense ont un désavantage.",
    "Affamé": "Vous ne regagnez pas de souffle.",
  };
  assert.deepEqual(
    b.capacites.slice(-6).map(({ nom, variantes }) => [nom, variantes.map(({ brut, ...variante }) => ({ ...variante, ligne: brut.ligne }))]),
    Object.entries(textes).map(([nom, description], rang) => [nom, [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [{ nom: "Passif" }], description, notes: "État", ligne: 54 + rang }]]),
  );
  // Aucune anomalie sur les lignes neuves.
  assert.deepEqual(b.anomalies.filter((a) => (a.feuille === "Eléments" && a.ligne >= 25) || (a.feuille === "Capacites" && a.ligne >= 54) || (a.feuille === "Blocs" && a.ligne >= 40)), []);
});

test("import — les valeurs restent des chaînes, telles qu'écrites", async () => {
  const b = await banque();
  const variante = (nom) => b.capacites.find((c) => c.nom === nom).variantes[0];
  assert.deepEqual([variante("Moulinet farineux").puissance, variante("Moulinet farineux").cout_souffle], ["N", "5*N"]);
  assert.equal(variante("Moulinet farineux").description, "Tourbillonne [N] fois.");
  assert.equal(variante("Jet de sel").cout_souffle, "X");
  assert.deepEqual(variante("Jet de sel").elements, [{ nom: "Distance", valeur: "2" }]);
  assert.equal(variante("Jet de sel").description, "Lance du sel à {distance} pas.\nPuis recommence.");
  assert.equal(variante("Coup de louche").puissance, "0");
});

test("import — éléments : paramètres reçus, description telle qu'écrite", async () => {
  const b = await banque();
  const { brut, ...sale } = b.elements.find((e) => e.nom === "Salé");
  assert.deepEqual(sale, { nom: "Salé", parametres_recus: ["sel"], description: "" });
  assert.deepEqual(brut.cellules, { Nom: "Salé", "Paramètres reçus": "{sel}", Description: "" });
});

test("import — noms sans espaces de bord ; le nom d'origine reste dans le brut", async () => {
  const b = await banque();
  const fumoir = b.blocs.find((bloc) => bloc.nom === "Fumoir");
  assert.equal(fumoir.brut.cellules.Nom, " Fumoir ");
  assert.ok(b.capacites.some((c) => c.nom === "Marmitage"));
});

test("import — lisez_moi : rubrique et texte tels qu'écrits", async () => {
  assert.deepEqual((await banque()).lisez_moi, [
    { rubrique: "Syntaxe", texte: "Un bloc transmet un paramètre sous la forme {nom:valeur}." },
    { rubrique: "", texte: "Une capacité invoque un paramètre sous la forme {nom}." },
    { rubrique: "", texte: "Un choix obligatoire s'écrit (a | b), un ensemble facultatif [a | b]." },
    { rubrique: "nb", texte: "La colonne Infos et la colonne origine n'ont aucune valeur légale." },
    { rubrique: "", texte: "Ce classeur est fictif : il sert aux contrôles de l'Atelier." },
  ]);
});

test("import — une ligne sans nom n'entre pas ; une feuille en plus est ignorée", async () => {
  const b = await banque();
  assert.ok([...b.blocs, ...b.elements, ...b.capacites].every((objet) => objet.nom));
  assert.ok(!JSON.stringify(b).includes("Formes de cellules"));
});

test("import — une colonne nommée « __proto__ » ou « constructor » reste dans le brut", async () => {
  const description = structuredClone(CLASSEUR_ESSAI);
  const blocs = description.feuilles.find((feuille) => feuille.nom === "Blocs");
  blocs.lignes[0].push("__proto__", "constructor");
  blocs.lignes[1].push("PROTO", "CONSTRUCTEUR");
  const { banque } = await importerFichier(fabriquerClasseur(description), "variante.xlsx");
  const cellules = banque.blocs.find((bloc) => bloc.nom === "Louche d'acier").brut.cellules;
  assert.equal(Object.hasOwn(cellules, "__proto__"), true, "la colonne __proto__ n'est pas avalée");
  assert.equal(cellules.__proto__, "PROTO");
  assert.equal(cellules.constructor, "CONSTRUCTEUR");
  assert.equal(Object.getPrototypeOf(cellules), Object.prototype, "aucune pollution");
  assert.match(JSON.stringify(banque), /"__proto__":"PROTO"/);
});

test("import — un fichier illisible donne un message, pas une exception", async () => {
  const resultat = await importerFichier(Buffer.from("Nom;Capacités"), "notes.csv");
  assert.deepEqual(Object.keys(resultat), ["erreur"]);
  assert.match(resultat.erreur, /pas une archive ZIP/);
});
