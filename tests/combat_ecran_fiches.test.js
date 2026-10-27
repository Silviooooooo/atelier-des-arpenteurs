// Contrôles des fiches vivantes du combat, dans un document simulé
// (SPECIFICATION.md, § 17 et § 11 ; mission du lot 4, § 5 et § 10.5).
//
// La partie se contrôle seule, sur des vues écrites à la main à la forme de
// vueFiche : ce qu'elle montre, ce que chaque bouton rend à l'écran, les
// nœuds gardés d'un rendu à l'autre quand leur vue n'a pas changé, refaits
// quand elle a changé, et la règle des volets (ouverts ou repliés). Les
// noms viennent de la démonstration. La mise en page se regarde dans un vrai
// navigateur.
//
// Au groupe 2 (contrat du groupe 2, § 8.5, § 9.9, § 9.11 et § 14, É4) : les
// actions restantes écrites telles que la vue les dit, et le focus rendu
// sans faire défiler la page.
//
// Au lot 4.3, vague 3 (contrat de la vague, § 3.3, § 4.2, § 5.2 et § 7) : la
// classe de ce que le protagoniste peut encore faire, les étiquettes des
// effets durables (nom, source, durée, couleur ; « Appliquer l'effet de… »
// dans les deux modes, ✕ en Mode MJ seulement, inactif avec sa raison), et
// « Modifier… » en Mode MJ seulement.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutons, installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_fiches.js");
const SOURCE = readFileSync(new URL("../js/ecrans/combat_fiches.js", import.meta.url), "utf8");

const zone = (faces, nombreDeFaces, nom, armure, max, etat = null, resistance = 5) => ({
  faces,
  nombreDeFaces,
  nom,
  armure: { valeur: armure, max, etat },
  resistance: { valeur: resistance, max: 5 },
});

/**
 * Les actions restantes, à la forme de vueFiche(…).actions (contrat du
 * groupe 2, § 8.5) : le texte vient de la vue, la partie ne le calcule pas.
 */
const actionsDe = (reste, max) => ({ reste, max, texte: `actions restantes : ${reste} sur ${max}` });

/** La fiche d'Aubépine, à la forme de vueFiche ; « retouches » en remplace des champs. */
function aubepine(retouches = {}) {
  return {
    id: "pj1",
    camp: "pj",
    initiales: "A",
    nom: "Aubépine Crèmebrûlée",
    sousTitre: "Marmiton · Saucier",
    statut: null,
    marques: [],
    actions: actionsDe(1, 2),
    souffle: { valeur: 3, max: 10, absent: false },
    corps: { valeur: 10, max: 10 },
    zones: [
      zone("1", 1, "Tête", 6, 6),
      zone("2-11", 10, "Torse", 12, 12),
      zone("12-13", 2, "Jambe gauche", 1, 10, "abimee"),
      zone("14-15", 2, "Jambe droite", 0, 10, "detruite", 2),
      zone("16-17", 2, "Bras gauche", 8, 8),
      zone("18-19", 2, "Bras droit", 8, 8),
    ],
    contre: "20 : contre-attaque",
    attaque: "Attaque d10 +1 · Couteau d'office, précise, 3/8/20",
    defense: "Défense d8 +1 · agile, types mêlés",
    bouclier: "Couvercle de marmite : 8 (sans effet)",
    liens: [{ nom: "Grand Four", valeur: 1, max: 2 }],
    passifs: [
      { texte: "Solo du chef : 1 avantage", actif: true, raison: null },
      { texte: "Vif : +1 en agilité", actif: true, raison: null },
      { texte: "Réduction : +1 contre l'armure par réussite", actif: true, raison: null },
    ],
    effets: [],
    jouer: null,
    avant: null,
    jeu: null,
    pastille: null,
    menuMj: null,
    ...retouches,
  };
}

/** La fiche d'un adversaire : ses nombres en une ligne, pas de lien. */
function adversaire(id, nom, initiales, retouches = {}) {
  return {
    id,
    camp: "adv",
    initiales,
    nom,
    sousTitre: "Commis, Rôtisseur ×1,4",
    statut: null,
    marques: [],
    actions: actionsDe(1, 1),
    souffle: { valeur: 5, max: 5, absent: false },
    corps: { valeur: 10, max: 10 },
    zones: [zone("2-19", 18, "Corps", 4, 4), zone("20", 1, "Toque haute", 0, 0)],
    contre: "1 : contre-attaque",
    attaque: "Attaque 5 · Défense 7 · Spatule souple 6/12/19",
    defense: null,
    bouclier: null,
    liens: [],
    passifs: [],
    effets: [],
    jouer: null,
    avant: null,
    jeu: null,
    pastille: null,
    menuMj: null,
    ...retouches,
  };
}

const chef = (retouches) => adversaire("adv2", "Chef de partie", "C", retouches);
const marmiton1 = (retouches) => adversaire("adv3", "Marmiton de corvée n° 1", "M1", retouches);
const marmiton2 = (retouches) => adversaire("adv4", "Marmiton de corvée n° 2", "M2", retouches);

/** Ce que l'écran poserait avant le lancement sur la fiche d'un protagoniste. */
const avantDe = (id, nomDeCase) => ({
  case: nomDeCase,
  poser: { gabarit: { preparer: { type: "poser", id } } },
  retirer: { commande: { preparer: { type: "retirer", id } } },
});

/** Des actions qui notent ce qu'on leur demande. */
function actionsEspionnes() {
  const appels = [];
  const noter = (nom) => (...parametres) => {
    appels.push([nom, ...parametres]);
  };
  return {
    appels,
    actions: {
      executer: noter("executer"),
      lancerLeDe: noter("lancerLeDe"),
      ajouterPersonnage: noter("ajouterPersonnage"),
      ajouterAdversaires: noter("ajouterAdversaires"),
      placerRencontre: noter("placerRencontre"),
      lancer: noter("lancer"),
      ouvrirFiche: noter("ouvrirFiche"),
      ouvrirCase: noter("ouvrirCase"),
      ouvrirPalette: noter("ouvrirPalette"),
      ouvrirMenuMj: noter("ouvrirMenuMj"),
    },
  };
}

/** Les fiches posées dans la page, et de quoi les défaire. */
function monter(vue = { pj: [aubepine()], adv: [chef(), marmiton1(), marmiton2()] }, ecran = { etroit: false }) {
  const retirer = installerDom();
  const { appels, actions } = actionsEspionnes();
  const partie = creer(actions);
  document.body.append(partie.noeud);
  if (vue) partie.rendre(vue, ecran);
  return { partie, appels, retirer };
}

const ficheDe = (partie, id) => partie.noeud.querySelector(`details[data-id=${id}]`);
/** Ce qui suit le volet avant le lancement : le groupe du champ « Case » et de « Retirer ». */
const groupeDe = (partie, id) => partie.noeud.querySelector(`[data-fiche=${id}]`);
const ouverte = (fiche) => fiche.hasAttribute("open");
const repere = (fiche, nom) => fiche.querySelector(`[data-repere=${nom}]`);
const classesDe = (noeud) => noeud.className.split(/\s+/).filter(Boolean);
const textes = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)].map(texteDe);
/** Les cases d'une jauge : combien de pleines, combien de vides. */
function casesDe(noeud) {
  const points = [...noeud.querySelectorAll(".combat-point")];
  const vides = points.filter((point) => classesDe(point).includes("vide")).length;
  return { pleines: points.length - vides, vides };
}
/** La personne ouvre ou replie un volet : le navigateur change l'attribut, puis l'annonce. */
function basculer(fiche, annoncer = true) {
  if (ouverte(fiche)) fiche.removeAttribute("open");
  else fiche.setAttribute("open", "");
  if (annoncer) fiche.declencher("toggle");
}
function saisir(champ, texte) {
  champ.value = texte;
  champ.declencher("change");
}

test("les fiches se rangent par camp, dans l'ordre reçu, avec le compte de chaque camp", () => {
  const { partie, retirer } = monter();
  try {
    const { noeud } = partie;
    assert.equal(noeud.tagName, "DIV");
    assert.equal(noeud.className, "combat-camps");
    const camps = [...noeud.querySelectorAll("section")];
    assert.deepEqual(camps.map((camp) => camp.className), ["combat-camp combat-camp-pj", "combat-camp combat-camp-adv"]);
    assert.deepEqual(camps.map((camp) => camp.getAttribute("aria-label")), ["Personnages", "Adversaires"]);
    assert.deepEqual(textes(noeud, "h2"), ["Personnages · 1", "Adversaires · 3"]);
    assert.deepEqual(textes(noeud, ".combat-compte"), ["· 1", "· 3"]);
    assert.equal(noeud.querySelectorAll("h1").length, 0, "le titre de l'écran est à la barre");
    assert.deepEqual([...camps[0].querySelectorAll("details")].map((fiche) => fiche.getAttribute("data-id")), ["pj1"]);
    assert.deepEqual([...camps[1].querySelectorAll("details")].map((fiche) => fiche.getAttribute("data-id")), ["adv2", "adv3", "adv4"]);
    for (const fiche of noeud.querySelectorAll("details")) assert.equal(classesDe(fiche)[0], "combat-fiche");

    // Un mort se compte à part ; sans mort, le compte ne parle pas de vie.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ marques: ["morte"], statut: "mort au tour 2" }), marmiton2()] }, { etroit: false });
    assert.deepEqual(textes(noeud, ".combat-compte"), ["· 1", "· 2 en vie sur 3"]);
  } finally {
    retirer();
  }
});

test("un camp vide le dit, et la phrase s'efface au premier ajout", () => {
  const { partie, retirer } = monter({ pj: [], adv: [] });
  try {
    const [pj, adv] = [...partie.noeud.querySelectorAll("section")];
    assert.equal(texteDe(pj), "Personnages Aucun personnage dans le combat.");
    assert.equal(texteDe(adv), "Adversaires Aucun adversaire dans le combat.");
    assert.equal(partie.noeud.querySelectorAll("details").length, 0);
    partie.rendre({ pj: [aubepine()], adv: [] }, { etroit: false });
    assert.ok(!texteDe(pj).includes("Aucun personnage"));
    assert.equal(pj.querySelectorAll("details").length, 1);
    assert.equal(texteDe(adv), "Adversaires Aucun adversaire dans le combat.");
    // Et elle revient quand le camp se vide.
    partie.rendre({ pj: [], adv: [] }, { etroit: false });
    assert.equal(texteDe(pj), "Personnages Aucun personnage dans le combat.");
  } finally {
    retirer();
  }
});

test("l'en-tête : la pastille, le nom entier, la ligne, l'état, les actions en pastilles ; rien qui s'actionne", () => {
  const { partie, retirer } = monter({ pj: [aubepine({ statut: "joue", marques: ["joue"] })], adv: [chef(), marmiton1({ sousTitre: "" })] });
  try {
    const resume = ficheDe(partie, "pj1").querySelector("summary");
    assert.deepEqual(
      resume.children.map((enfant) => enfant.className),
      ["combat-pastille", "combat-nom", "combat-sous-ligne", "combat-actions"],
    );
    assert.equal(texteDe(resume.querySelector(".combat-pastille")), "A");
    assert.equal(texteDe(resume.querySelector(".combat-nom")), "Aubépine Crèmebrûlée");
    assert.equal(texteDe(resume.querySelector(".combat-sous")), "Marmiton · Saucier");
    assert.equal(texteDe(resume.querySelector(".combat-statut")), "joue");
    // Sous le nom, une seule ligne : la ligne puis l'état, qui s'y enchaîne
    // (vu dans un navigateur : rangé à part, à droite, l'état élargissait la
    // colonne des actions et coupait en deux le nom d'un mort).
    const sousLeNom = resume.querySelector(".combat-sous-ligne");
    assert.deepEqual(sousLeNom.children.map((enfant) => enfant.className), ["combat-sous", "combat-statut"]);
    assert.equal(texteDe(sousLeNom), "Marmiton · Saucier joue");
    const actions = resume.querySelector(".combat-actions");
    assert.deepEqual(actions.children.map((pion) => pion.className), ["combat-pion", "combat-pion vide"]);
    assert.equal(actions.getAttribute("role"), "img");
    assert.equal(actions.getAttribute("aria-label"), "actions restantes : 1 sur 2");
    // Lu d'un trait, l'en-tête garde ses mots séparés.
    assert.equal(texteDe(resume), "A Aubépine Crèmebrûlée Marmiton · Saucier joue");

    // Sans état ni ligne, ni l'un ni l'autre ne s'écrit.
    const sobre = ficheDe(partie, "adv3").querySelector("summary");
    assert.deepEqual(sobre.children.map((enfant) => enfant.className), ["combat-pastille", "combat-nom", "combat-actions"]);
    assert.equal(texteDe(sobre.querySelector(".combat-nom")), "Marmiton de corvée n° 1");
    assert.equal(sobre.querySelector(".combat-actions").getAttribute("aria-label"), "actions restantes : 1 sur 1");
    assert.equal(texteDe(ficheDe(partie, "adv2").querySelector(".combat-sous")), "Commis, Rôtisseur ×1,4");
    // Un état sans ligne : la ligne sous le nom ne porte que lui.
    partie.rendre({ pj: [aubepine({ statut: "joue", marques: ["joue"] })], adv: [chef(), marmiton1({ sousTitre: "", statut: "a joué" })] }, { etroit: false });
    assert.deepEqual(ficheDe(partie, "adv3").querySelector(".combat-sous-ligne").children.map((enfant) => enfant.className), ["combat-statut"]);

    // Le nom déplie le volet : jamais un bouton, un lien ni un champ dans un en-tête.
    for (const entete of partie.noeud.querySelectorAll("summary")) {
      for (const balise of ["button", "a", "input", "select"]) assert.equal(entete.querySelectorAll(balise).length, 0, balise);
    }
  } finally {
    retirer();
  }
});

test("les actions restantes : le texte de la vue, en pastilles, puis en toutes lettres au-delà de trente", () => {
  const { partie, retirer } = monter({
    pj: [aubepine({ actions: actionsDe(2, 2) })],
    adv: [chef({ actions: actionsDe(0, 1) }), marmiton1({ actions: actionsDe(12, 31) }), marmiton2({ actions: actionsDe(30, 30) })],
  });
  try {
    const pastillesDe = (id) => ficheDe(partie, id).querySelector(".combat-actions");
    assert.equal(pastillesDe("pj1").getAttribute("aria-label"), "actions restantes : 2 sur 2");
    assert.deepEqual(pastillesDe("pj1").children.map((pion) => pion.className), ["combat-pion", "combat-pion"]);
    assert.equal(pastillesDe("adv2").getAttribute("aria-label"), "actions restantes : 0 sur 1");
    assert.deepEqual(pastillesDe("adv2").children.map((pion) => pion.className), ["combat-pion vide"]);
    assert.equal(pastillesDe("adv4").children.length, 30);
    assert.equal(pastillesDe("adv3").children.length, 0);
    assert.equal(texteDe(pastillesDe("adv3")), "actions restantes : 12 sur 31");
    assert.equal(pastillesDe("adv3").hasAttribute("aria-label"), false, "écrit en toutes lettres, il n'a pas besoin d'un nom");
  } finally {
    retirer();
  }
});

test("« actions restantes : 1 sur 2 » : l'en-tête écrit le texte de la vue tel quel, et « 1 action sur 2 » ne s'écrit plus nulle part", () => {
  // Un texte que les nombres ne donneraient pas : la partie le recopie, elle ne le refait pas.
  const dit = "actions restantes : 7 sur 9";
  const { partie, retirer } = monter({
    pj: [aubepine({ actions: { reste: 1, max: 2, texte: dit } })],
    adv: [chef({ actions: { reste: 12, max: 31, texte: dit } })],
  });
  try {
    assert.equal(ficheDe(partie, "pj1").querySelector(".combat-actions").getAttribute("aria-label"), dit);
    assert.deepEqual(ficheDe(partie, "pj1").querySelector(".combat-actions").children.map((pion) => pion.className), ["combat-pion", "combat-pion vide"], "les pastilles suivent les nombres");
    assert.equal(texteDe(ficheDe(partie, "adv2").querySelector(".combat-actions")), dit);
    // Le texte change seul : l'en-tête se refait.
    partie.rendre({ pj: [aubepine({ actions: { reste: 1, max: 2, texte: "actions restantes : 1 sur 2" } })], adv: [chef()] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1").querySelector(".combat-actions").getAttribute("aria-label"), "actions restantes : 1 sur 2");
    // Nulle part l'ancienne forme, ni dans un texte ni dans un attribut.
    const ecrit = [partie.noeud, ...partie.noeud.descendants()].map((noeud) => [...noeud.attributs.values()].join(" ")).join(" ") + partie.noeud.textContent;
    assert.doesNotMatch(ecrit, /\d+ actions? sur \d+/);
  } finally {
    retirer();
  }
  assert.doesNotMatch(SOURCE, /action sur|\baccorder\(/, "le module ne fabrique plus le compte des actions");
});

test("le souffle et le corps : en cases avec leur nombre, en nombres seuls au-delà de trente, « — » sans souffle", () => {
  const { partie, retirer } = monter({
    pj: [aubepine()],
    adv: [
      chef({ souffle: { valeur: 0, max: 0, absent: true } }),
      marmiton1({ souffle: { valeur: 28, max: 31, absent: false }, corps: { valeur: 4, max: 30 } }),
      marmiton2({ souffle: { valeur: 0, max: 0, absent: false } }),
    ],
  });
  try {
    const jauges = (id) => [...ficheDe(partie, id).querySelectorAll(".combat-jauge")];
    const [souffle, corps] = jauges("pj1");
    assert.equal(texteDe(souffle), "Souffle 3/10");
    assert.deepEqual(casesDe(souffle), { pleines: 3, vides: 7 });
    assert.equal(texteDe(corps), "Corps 10/10");
    assert.deepEqual(casesDe(corps), { pleines: 10, vides: 0 });

    // Trente : encore des cases. Trente et un : le nombre seul.
    const [gros, juste] = jauges("adv3");
    assert.equal(texteDe(gros), "Souffle 28/31");
    assert.deepEqual(casesDe(gros), { pleines: 0, vides: 0 });
    assert.equal(texteDe(juste), "Corps 4/30");
    assert.deepEqual(casesDe(juste), { pleines: 4, vides: 26 });

    // Un souffle absent n'est pas un souffle de zéro.
    assert.equal(texteDe(jauges("adv2")[0]), "Souffle —");
    assert.deepEqual(casesDe(jauges("adv2")[0]), { pleines: 0, vides: 0 });
    assert.equal(texteDe(jauges("adv4")[0]), "Souffle 0/0");
  } finally {
    retirer();
  }
});

test("la table des zones : les faces, le nom abrégé, l'armure signalée dès qu'elle baisse, l'endurance en cases, la contre-attaque en pied", () => {
  const { partie, retirer } = monter();
  try {
    const fiche = ficheDe(partie, "pj1");
    const table = fiche.querySelector("table");
    assert.equal(table.className, "combat-zones");
    assert.deepEqual(textes(table, "thead th"), ["d20", "Zone", "Armure", "Endurance"]);
    for (const titre of table.querySelectorAll("thead th")) assert.equal(titre.getAttribute("scope"), "col");
    const lignes = [...table.querySelectorAll("tbody tr")];
    // Le nom de la zone est l'en-tête de sa ligne : un lecteur d'écran le dit avec l'armure et l'endurance.
    for (const ligne of lignes) {
      assert.deepEqual(ligne.children.map((cellule) => cellule.tagName), ["TD", "TH", "TD", "TD"]);
      assert.equal(ligne.children[1].getAttribute("scope"), "row");
    }
    // La table porte le nom de son protagoniste : plusieurs fiches sont ouvertes à la fois.
    assert.equal(table.getAttribute("aria-label"), "Zones : Aubépine Crèmebrûlée");
    assert.equal(ficheDe(partie, "adv2").querySelector("table").getAttribute("aria-label"), "Zones : Chef de partie");
    assert.deepEqual(
      lignes.map((ligne) => ligne.children.slice(0, 3).map(texteDe)),
      [
        ["1", "Tête", "6"],
        ["2-11", "Torse", "12"],
        ["12-13", "J. g.", "1/10"],
        ["14-15", "J. d.", "0/10"],
        ["16-17", "B. g.", "8"],
        ["18-19", "B. d.", "8"],
      ],
    );
    // Intacte : rien. Baissée : signalée. À zéro : signalée autrement.
    assert.deepEqual(lignes.map((ligne) => ligne.children[2].className), ["", "", "abimee", "detruite", "", ""]);
    // Le nom entier d'une zone abrégée reste lisible ; un nom non abrégé n'a pas d'abréviation.
    assert.equal(lignes[2].querySelector("abbr").getAttribute("title"), "Jambe gauche");
    assert.equal(lignes[0].querySelectorAll("abbr").length, 0);
    assert.equal(lignes[1].querySelectorAll("abbr").length, 0);

    // L'endurance : cinq cases, et leur compte pour qui ne les voit pas.
    const resistance = lignes.map((ligne) => ligne.children[3]);
    assert.deepEqual(casesDe(resistance[0]), { pleines: 5, vides: 0 });
    assert.deepEqual(casesDe(resistance[3]), { pleines: 2, vides: 3 });
    assert.equal(resistance[0].querySelector("[role=img]").getAttribute("aria-label"), "5 sur 5");
    assert.equal(resistance[3].querySelector("[role=img]").getAttribute("aria-label"), "2 sur 5");

    assert.equal(texteDe(fiche.querySelector(".combat-contre")), "20 : contre-attaque");

    // Un adversaire a sa grille à lui : toutes ses zones, et sa face de contre-attaque.
    const adverse = ficheDe(partie, "adv2");
    assert.deepEqual(
      [...adverse.querySelectorAll("tbody tr")].map((ligne) => ligne.children.slice(0, 3).map(texteDe)),
      [
        ["2-19", "Corps", "4"],
        ["20", "T. h.", "0"],
      ],
    );
    assert.equal(texteDe(adverse.querySelector(".combat-contre")), "1 : contre-attaque");
  } finally {
    retirer();
  }
});

test("l'attaque, la défense et le bouclier s'écrivent tels que la vue les donne ; un adversaire n'a qu'une ligne", () => {
  const { partie, retirer } = monter();
  try {
    assert.deepEqual(textes(ficheDe(partie, "pj1"), ".combat-valeurs"), [
      "Attaque d10 +1 · Couteau d'office, précise, 3/8/20",
      "Défense d8 +1 · agile, types mêlés",
      "Couvercle de marmite : 8 (sans effet)",
    ]);
    assert.deepEqual(textes(ficheDe(partie, "adv2"), ".combat-valeurs"), ["Attaque 5 · Défense 7 · Spatule souple 6/12/19"]);
    // Sans bouclier, pas de ligne vide.
    partie.rendre({ pj: [aubepine({ bouclier: null })], adv: [] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1").querySelectorAll(".combat-valeurs").length, 2);
  } finally {
    retirer();
  }
});

test("le lien : une jauge par primordial ; sans lien, aucune", () => {
  const { partie, retirer } = monter({ pj: [aubepine({ liens: [{ nom: "Grand Four", valeur: 1, max: 2 }, { nom: "Vieux Levain", valeur: 3, max: 3 }] })], adv: [chef()] });
  try {
    const jauges = [...ficheDe(partie, "pj1").querySelectorAll(".combat-jauge")];
    assert.deepEqual(jauges.map(texteDe), ["Souffle 3/10", "Corps 10/10", "Lien · Grand Four 1/2", "Lien · Vieux Levain 3/3"]);
    // Chaque jauge dit son genre à la feuille : le souffle a sa couleur, et
    // les trois se rangent de même (le nom, les cases, le nombre à droite).
    assert.deepEqual(
      jauges.map((jauge) => jauge.className),
      ["combat-jauge combat-jauge-souffle", "combat-jauge combat-jauge-corps", "combat-jauge combat-jauge-lien", "combat-jauge combat-jauge-lien"],
    );
    for (const jauge of jauges) {
      assert.equal(jauge.children[0].tagName, "SPAN", "le nom d'abord");
      assert.equal(jauge.children.at(-1).tagName, "SPAN", "le nombre en dernier");
      assert.equal(jauge.children.at(-1).className, "", "le nombre n'est pas une case");
    }
    assert.deepEqual(casesDe(jauges[2]), { pleines: 1, vides: 1 });
    assert.deepEqual(casesDe(jauges[3]), { pleines: 3, vides: 0 });
    assert.deepEqual(textes(ficheDe(partie, "adv2"), ".combat-jauge"), ["Souffle 5/5", "Corps 10/10"]);
  } finally {
    retirer();
  }
});

test("un passif câblé s'affiche actif, ou inactif avec sa raison écrite ; il devient actif quand un allié arrive", () => {
  const brigade = (actif) => ({ texte: "Brigade : 1 avantage en attaque", actif, raison: actif ? null : "aucun allié sur sa case" });
  const { partie, retirer } = monter({ pj: [aubepine()], adv: [chef(), marmiton1({ passifs: [brigade(false)] }), marmiton2()] });
  try {
    const lignesDe = (id) => [...ficheDe(partie, id).querySelectorAll(".combat-effets li")];
    assert.deepEqual(lignesDe("pj1").map(texteDe), ["Solo du chef : 1 avantage", "Vif : +1 en agilité", "Réduction : +1 contre l'armure par réussite"]);
    assert.deepEqual(lignesDe("pj1").map((ligne) => ligne.className), ["", "", ""]);
    // Inactif : la classe pour l'œil, les mots pour tous.
    assert.deepEqual(lignesDe("adv3").map(texteDe), ["Brigade : 1 avantage en attaque (inactif : aucun allié sur sa case)"]);
    assert.deepEqual(lignesDe("adv3").map((ligne) => ligne.className), ["eteint"]);
    // Sans passif ni effet, pas de liste vide.
    assert.equal(ficheDe(partie, "adv2").querySelectorAll(".combat-effets").length, 0);

    // Un allié arrive sur la case : seule la vue du passif change, la fiche suit.
    const voisine = ficheDe(partie, "adv4").querySelector(".combat-fiche-corps").children[0];
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ passifs: [brigade(true)] }), marmiton2()] }, { etroit: false });
    assert.deepEqual(lignesDe("adv3").map(texteDe), ["Brigade : 1 avantage en attaque"]);
    assert.deepEqual(lignesDe("adv3").map((ligne) => ligne.className), [""]);
    assert.equal(ficheDe(partie, "adv4").querySelector(".combat-fiche-corps").children[0], voisine, "la fiche voisine n'est pas refaite");

    // Et il s'éteint quand l'allié s'en va ; un passif inactif sans raison le dit quand même.
    partie.rendre({ pj: [aubepine({ passifs: [{ texte: "Solo du chef : 1 avantage", actif: false, raison: "un allié sur sa case" }] })], adv: [chef(), marmiton1({ passifs: [{ ...brigade(false), raison: null }] }), marmiton2()] }, { etroit: false });
    assert.deepEqual(lignesDe("pj1").map(texteDe), ["Solo du chef : 1 avantage (inactif : un allié sur sa case)"]);
    assert.deepEqual(lignesDe("adv3").map(texteDe), ["Brigade : 1 avantage en attaque (inactif)"]);
  } finally {
    retirer();
  }
});

// ─── La vague 3 du lot 4.3 : les étiquettes, « Modifier… », la couleur ──────

const ACTION_EN_COURS = "Le geste en cours se finit d'abord.";

/** Une étiquette à la forme de vueFiche(…).effets (contrat de la vague 3, § 3.3). */
function etiquette(id, genre, nom, couleur, retouches = {}) {
  const unEtat = genre === "etat";
  return {
    id,
    genre,
    nom,
    source: "MJ",
    duree: "jusqu'au prochain tour des PJ",
    couleur,
    texte: unEtat ? "Perd sa prochaine action." : null,
    retirer: unEtat
      ? { libelle: `Retirer l'état ${nom}`, actif: true, raison: null, commande: { evenement: { type: "mj", genre: "etat", qui: "adv2", retrait: id } }, mj: true }
      : null,
    appliquer: unEtat ? { libelle: `Appliquer l'effet d'${nom}…`, source: { genre: "etat", effet: id } } : null,
    ...retouches,
  };
}

const ETOURDI = etiquette(12, "etat", "Étourdi", "alerte");
const MAIN_BRULEE = etiquette(88, "etat", "Main brûlée", "blessure", {
  source: "Blessure",
  duree: "jusqu'à la fin du combat",
  texte: "Désavantage avec une arme précise.",
  appliquer: { libelle: "Appliquer l'effet de Main brûlée…", source: { genre: "etat", effet: 88 } },
});
const DEFENSE_PLUS_UN = etiquette(20, "modif", "Défense +1", "favorable", { source: "Nez fin" });
const ATTAQUE_MOINS_DEUX = etiquette(21, "modif", "Attaque −2", "alerte", { source: "Choc sourd" });
const EN_GUET = etiquette(30, "guet", "en guet : Frappe", "favorable", { source: "Guetter", texte: "Une attaque qui inflige 3/8/20." });
const EN_PLUS = etiquette(31, "attaque_en_plus", "attaque en plus", "alerte", { source: "Flambage", duree: "jusqu'au prochain tour d'Aubépine" });
const MODIFIER = { libelle: "Modifier…", actif: true, raison: null, mj: true };

test("les effets en cours : une étiquette par effet, dans l'ordre de la vue, son nom, sa source et sa durée, la classe de sa couleur ; avant les passifs", () => {
  const { partie, retirer } = monter({
    pj: [aubepine({ effets: [MAIN_BRULEE, DEFENSE_PLUS_UN, EN_GUET], passifs: [{ texte: "Vif : +1 en agilité", actif: true, raison: null }] })],
    adv: [chef({ effets: [ETOURDI, ATTAQUE_MOINS_DEUX, EN_PLUS, { ...ETOURDI, id: 13, couleur: "inconnue" }] })],
  });
  try {
    const pj = ficheDe(partie, "pj1");
    assert.deepEqual(textes(pj, ".combat-etiquette summary"), ["Main brûlée · Blessure · jusqu'à la fin du combat", "en guet : Frappe · Guetter · jusqu'au prochain tour des PJ"]);
    assert.deepEqual(
      [...pj.querySelectorAll(".combat-etiquette")].map((noeud) => noeud.className),
      ["combat-etiquette blessure", "combat-etiquette favorable", "combat-etiquette favorable"],
    );
    // Sans texte ni « Appliquer », une étiquette ne se déplie pas : son texte seul.
    assert.equal(texteDe(pj.querySelectorAll(".combat-etiquette")[1]), "Défense +1 · Nez fin · jusqu'au prochain tour des PJ");
    assert.equal(pj.querySelectorAll(".combat-etiquette")[1].querySelector("details"), null);
    assert.equal(pj.querySelector(".combat-etiquettes").getAttribute("aria-label"), "Effets en cours : Aubépine Crèmebrûlée");
    // Les étiquettes viennent avant les passifs, dans une autre liste.
    const corps = [...pj.querySelector(`.${"combat-fiche"}-corps`).children].map((enfant) => enfant.className);
    assert.ok(corps.indexOf("combat-etiquettes") < corps.indexOf("combat-effets"), corps.join(", "));
    assert.deepEqual(textes(pj, ".combat-effets li"), ["Vif : +1 en agilité"]);
    // Les quatre genres, trois couleurs ; une couleur inconnue ne devient pas une classe.
    const chefNoeud = ficheDe(partie, "adv2");
    assert.deepEqual(
      [...chefNoeud.querySelectorAll(".combat-etiquette")].map((noeud) => noeud.className),
      ["combat-etiquette alerte", "combat-etiquette alerte", "combat-etiquette alerte", "combat-etiquette"],
    );
    assert.deepEqual(
      [...chefNoeud.querySelectorAll(".combat-etiquette")].map((noeud) => texteDe(noeud.querySelector("summary") ?? noeud)),
      ["Étourdi · MJ · jusqu'au prochain tour des PJ", "Attaque −2 · Choc sourd · jusqu'au prochain tour des PJ", "attaque en plus · Flambage · jusqu'au prochain tour d'Aubépine", "Étourdi · MJ · jusqu'au prochain tour des PJ"],
    );
  } finally {
    retirer();
  }
});

test("une étiquette se déplie sur son texte et « Appliquer l'effet de… », dans les deux modes : la palette s'ouvre à son nom, près du bouton", () => {
  for (const modeMj of [false, true]) {
    const { partie, appels, retirer } = monter({ pj: [aubepine({ effets: [MAIN_BRULEE] })], adv: [chef({ effets: [ETOURDI] })] }, { etroit: false, modeMj });
    try {
      const deplie = ficheDe(partie, "adv2").querySelector(".combat-etiquette details");
      assert.ok(deplie, `Mode MJ ${modeMj} : l'étiquette se déplie`);
      assert.equal(texteDe(deplie.querySelector("p")), "Perd sa prochaine action.");
      const appliquer = deplie.querySelector("button");
      assert.equal(texteDe(appliquer), "Appliquer l'effet d'Étourdi…");
      // Rien ne s'actionne dans la ligne qui déplie l'étiquette.
      assert.equal(deplie.querySelector("summary").querySelectorAll("button").length, 0);
      appliquer.click();
      assert.equal(appels.at(-1)[0], "ouvrirPalette");
      assert.deepEqual(appels.at(-1)[1], { genre: "etat", effet: 12 });
      assert.ok(appels.at(-1)[2] === appliquer, "l'ancre est le bouton");
      ficheDe(partie, "pj1").querySelector(".combat-etiquette details button").click();
      assert.deepEqual(appels.at(-1).slice(0, 2), ["ouvrirPalette", { genre: "etat", effet: 88 }]);
    } finally {
      retirer();
    }
  }
});

test("✕ ne paraît qu'en Mode MJ, sur un état seul ; il émet sa commande ; inactif pendant un geste, il le dit et ne fait rien", () => {
  const vue = { pj: [aubepine({ effets: [DEFENSE_PLUS_UN, EN_GUET] })], adv: [chef({ effets: [ETOURDI, EN_PLUS] })] };
  const eteint = monter(vue, { etroit: false, modeMj: false });
  try {
    assert.deepEqual(boutons(eteint.partie.noeud, "✕"), [], "hors Mode MJ, aucun ✕");
    assert.equal([...eteint.partie.noeud.querySelectorAll("button")].some((bouton) => (bouton.getAttribute("aria-label") ?? "").startsWith("Retirer l'état")), false);
  } finally {
    eteint.retirer();
  }
  const { partie, appels, retirer } = monter(vue, { etroit: false, modeMj: true });
  try {
    const croix = boutons(partie.noeud, "✕");
    assert.equal(croix.length, 1, "un seul état porté : un seul ✕ ; ni un ±N, ni une garde, ni une attaque en plus");
    assert.equal(croix[0].getAttribute("aria-label"), "Retirer l'état Étourdi");
    assert.equal(croix[0].getAttribute("aria-disabled"), null);
    croix[0].click();
    assert.deepEqual(appels.at(-1), ["executer", { evenement: { type: "mj", genre: "etat", qui: "adv2", retrait: 12 } }, "panneau"]);

    // Pendant un geste : inactif, sa raison le suit, et un appui ne fait rien.
    const avant = appels.length;
    partie.rendre({ pj: vue.pj, adv: [chef({ effets: [{ ...ETOURDI, retirer: { ...ETOURDI.retirer, actif: false, raison: ACTION_EN_COURS } }, EN_PLUS] })] }, { etroit: false, modeMj: true });
    const inactif = boutons(partie.noeud, "✕")[0];
    assert.equal(inactif.getAttribute("aria-disabled"), "true");
    assert.equal(inactif.hasAttribute("disabled") || inactif.disabled === true, false, "jamais éteint");
    const raison = partie.noeud.querySelector(`#${inactif.getAttribute("aria-describedby")}`);
    assert.equal(texteDe(raison), ACTION_EN_COURS);
    assert.equal(raison.className, "combat-raison");
    inactif.click();
    assert.equal(appels.length, avant, "un ✕ inactif n'émet rien");
  } finally {
    retirer();
  }
});

test("« Modifier… » : en Mode MJ seulement ; il ouvre le menu du MJ près du bouton ; inactif pendant un geste, avec sa raison ; jamais pour un mort", () => {
  const vue = (menuMj) => ({ pj: [aubepine({ menuMj })], adv: [chef({ menuMj }), marmiton1({ menuMj: null, marques: ["morte"] })] });
  const eteint = monter(vue(MODIFIER), { etroit: false, modeMj: false });
  try {
    assert.deepEqual(boutons(eteint.partie.noeud, "Modifier"), [], "hors Mode MJ, « Modifier… » ne paraît pas");
  } finally {
    eteint.retirer();
  }
  const { partie, appels, retirer } = monter(vue(MODIFIER), { etroit: false, modeMj: true });
  try {
    const modifier = repere(ficheDe(partie, "adv2"), "modifier");
    assert.equal(texteDe(modifier), "Modifier…");
    assert.equal(modifier.className, "bouton secondaire combat-modifier");
    assert.equal(modifier.getAttribute("aria-label"), "Modifier… : Chef de partie");
    assert.equal(repere(ficheDe(partie, "adv3"), "modifier"), null, "un mort n'a pas de menu du MJ");
    // Il suit « Fiche complète », dans la même rangée.
    assert.deepEqual(modifier.parentNode.children.map((enfant) => enfant.getAttribute("data-repere")), ["fiche-complete", "modifier"]);
    modifier.click();
    assert.deepEqual(appels.at(-1).slice(0, 2), ["ouvrirMenuMj", "adv2"]);
    assert.ok(appels.at(-1)[2] === modifier, "l'ancre est le bouton");

    // Pendant un geste : la rangée seule est refaite ; le bouton dit sa raison et ne fait rien.
    const corps = ficheDe(partie, "adv2").querySelector(".combat-fiche-corps").children[0];
    const avant = appels.length;
    partie.rendre(vue({ ...MODIFIER, actif: false, raison: ACTION_EN_COURS }), { etroit: false, modeMj: true });
    assert.ok(ficheDe(partie, "adv2").querySelector(".combat-fiche-corps").children[0] === corps, "le corps garde ses nœuds");
    const inactif = repere(ficheDe(partie, "adv2"), "modifier");
    assert.equal(inactif.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(partie.noeud.querySelector(`#${inactif.getAttribute("aria-describedby")}`)), ACTION_EN_COURS);
    inactif.click();
    assert.equal(appels.length, avant);
    // Le Mode MJ éteint : le bouton s'en va.
    partie.rendre(vue(MODIFIER), { etroit: false, modeMj: false });
    assert.equal(repere(ficheDe(partie, "adv2"), "modifier"), null);
  } finally {
    retirer();
  }
});

test("la fiche du camp qui joue prend la classe de ce qu'il peut encore faire : « a-jouer », « epuise » ; aucune hors du camp qui joue", () => {
  const { partie, retirer } = monter({ pj: [aubepine({ jeu: "peut_agir", marques: ["joue"] })], adv: [chef({ jeu: null }), marmiton1({ jeu: "inconnu" })] });
  try {
    assert.equal(ficheDe(partie, "pj1").className, "combat-fiche joue a-jouer");
    assert.equal(ficheDe(partie, "adv2").className, "combat-fiche");
    assert.equal(ficheDe(partie, "adv3").className, "combat-fiche", "un jeu inconnu ne devient pas une classe");
    const corps = ficheDe(partie, "pj1").querySelector(".combat-fiche-corps").children[0];
    partie.rendre({ pj: [aubepine({ jeu: "epuise" })], adv: [chef(), marmiton1()] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1").className, "combat-fiche epuise");
    assert.ok(ficheDe(partie, "pj1").querySelector(".combat-fiche-corps").children[0] === corps, "la couleur change sans refaire le corps");
  } finally {
    retirer();
  }
});

test("« Jouer » n'existe que sur une fiche qu'on peut choisir, et rend sa commande ; il paraît et disparaît sans que le corps de la fiche soit refait", () => {
  const { partie, appels, retirer } = monter();
  try {
    // Le tour des PJ : aucune fiche d'adversaire ne propose de jouer.
    for (const id of ["pj1", "adv2", "adv3", "adv4"]) assert.equal(repere(ficheDe(partie, id), "jouer"), null, id);
    const corpsDe = (id) => ficheDe(partie, id).querySelector(".combat-fiche-corps");
    const avant = { adv2: corpsDe("adv2").children[0], adv4: corpsDe("adv4").children[0], pj1: corpsDe("pj1").children[0] };
    const tableDuChef = ficheDe(partie, "adv2").querySelector("table");
    const nomDuChef = ficheDe(partie, "adv2").querySelector(".combat-nom");
    const completeDuChef = repere(ficheDe(partie, "adv2"), "fiche-complete");

    // La fin du tour : rien n'a changé chez les adversaires, sinon leur vue.
    const jouer = (id) => ({ commande: { choisir: id } });
    partie.rendre({ pj: [aubepine()], adv: [chef({ jouer: jouer("adv2") }), marmiton1({ jouer: jouer("adv3") }), marmiton2()] }, { etroit: false });
    const bouton = repere(ficheDe(partie, "adv2"), "jouer");
    assert.equal(bouton.tagName, "BUTTON");
    assert.equal(bouton.getAttribute("type"), "button");
    assert.equal(texteDe(bouton), "Jouer");
    assert.equal(bouton.getAttribute("aria-label"), "Jouer : Chef de partie");
    assert.ok(repere(ficheDe(partie, "adv3"), "jouer"));
    // La fiche qui ne peut pas jouer n'a pas de bouton, et n'a pas été refaite.
    assert.equal(repere(ficheDe(partie, "adv4"), "jouer"), null);
    assert.equal(corpsDe("adv4").children[0], avant.adv4, "vue inchangée : nœuds gardés");
    assert.equal(corpsDe("pj1").children[0], avant.pj1, "vue inchangée : nœuds gardés");
    // La fiche qui peut maintenant jouer ne gagne qu'un bouton : ni son
    // en-tête, ni ses jauges, ni sa table ne sont refaits. À la fin de chaque
    // geste, c'est le cas de toutes les fiches du camp qui joue.
    assert.equal(corpsDe("adv2").children[0], avant.adv2, "seul « Jouer » a changé : le corps n'est pas refait");
    assert.equal(ficheDe(partie, "adv2").querySelector("table"), tableDuChef);
    assert.equal(ficheDe(partie, "adv2").querySelector(".combat-nom"), nomDuChef);
    assert.equal(repere(ficheDe(partie, "adv2"), "fiche-complete"), completeDuChef);
    // Le bouton est dans le corps, jamais dans l'en-tête, devant « Fiche complète ».
    assert.equal(bouton.parentNode.parentNode, corpsDe("adv2"));
    assert.deepEqual(bouton.parentNode.children.map(texteDe), ["Jouer", "Fiche complète"]);

    assert.deepEqual(appels, []);
    bouton.click();
    assert.deepEqual(appels, [["executer", { choisir: "adv2" }, "panneau"]]);
    repere(ficheDe(partie, "adv3"), "jouer").click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "adv3" }, "panneau"]);

    // Il disparaît quand la fiche ne peut plus être choisie, toujours sans rien refaire d'autre.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ jouer: jouer("adv3") }), marmiton2()] }, { etroit: false });
    assert.equal(repere(ficheDe(partie, "adv2"), "jouer"), null);
    assert.ok(repere(ficheDe(partie, "adv3"), "jouer"));
    assert.equal(corpsDe("adv2").children[0], avant.adv2);
    assert.deepEqual(completeDuChef.parentNode.children.map(texteDe), ["Fiche complète"]);

    // Une commande qui change sous le même bouton est bien celle qui part.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ jouer: { commande: { choisir: "autre" } } }), marmiton2()] }, { etroit: false });
    repere(ficheDe(partie, "adv3"), "jouer").click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "autre" }, "panneau"]);
  } finally {
    retirer();
  }
});

test("rien ne s'actionne dans un en-tête, même sur une fiche qu'on peut choisir dès son premier rendu, ni avant le lancement", () => {
  // Mission § 10.5 : le volet se déplie au clic sur le nom ; arbitrage § 7.6 :
  // jamais un bouton dans un en-tête. L'en-tête ne se refait pas quand
  // « Jouer » paraît : c'est au premier rendu qu'un bouton s'y glisserait.
  const jouer = (id) => ({ commande: { choisir: id } });
  const { partie, retirer } = monter({
    pj: [aubepine({ jouer: jouer("pj1"), avant: avantDe("pj1", "D4") })],
    adv: [chef({ jouer: jouer("adv2") }), marmiton1({ avant: avantDe("adv3", "E5") })],
  });
  try {
    const entetes = [...partie.noeud.querySelectorAll("summary")];
    assert.equal(entetes.length, 3);
    for (const entete of entetes) {
      for (const balise of ["button", "a", "input", "select", "textarea"]) assert.equal(entete.querySelectorAll(balise).length, 0, balise);
    }
    // Les boutons existent bien, ailleurs : dans le corps, et dans le groupe d'avant le lancement.
    for (const id of ["pj1", "adv2"]) {
      const bouton = repere(ficheDe(partie, id), "jouer");
      assert.equal(bouton.parentNode.parentNode, ficheDe(partie, id).querySelector(".combat-fiche-corps"), id);
    }
    assert.equal(repere(ficheDe(partie, "adv3"), "jouer"), null);
    assert.ok(repere(groupeDe(partie, "pj1"), "retirer"));
  } finally {
    retirer();
  }
});

test("un état qui change seul (« a joué », les actions, une marque) ne refait que l'en-tête ; le corps garde ses nœuds", () => {
  const { partie, retirer } = monter();
  try {
    const fiche = ficheDe(partie, "adv2");
    const table = fiche.querySelector("table");
    const jauge = fiche.querySelector(".combat-jauge");
    const nom = fiche.querySelector(".combat-nom");
    partie.rendre({ pj: [aubepine()], adv: [chef({ statut: "a joué", marques: [], actions: actionsDe(0, 1) }), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(texteDe(fiche.querySelector(".combat-statut")), "a joué");
    assert.equal(fiche.querySelector(".combat-actions").getAttribute("aria-label"), "actions restantes : 0 sur 1");
    assert.notEqual(fiche.querySelector(".combat-nom"), nom, "l'en-tête est refait");
    assert.equal(fiche.querySelector("table"), table, "le corps ne l'est pas");
    assert.equal(fiche.querySelector(".combat-jauge"), jauge);
    // Une marque seule : ni l'en-tête ni le corps, la classe suffit.
    const nomRefait = fiche.querySelector(".combat-nom");
    partie.rendre({ pj: [aubepine()], adv: [chef({ statut: "a joué", marques: ["ciblee"], actions: actionsDe(0, 1) }), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(fiche.className, "combat-fiche ciblee");
    assert.equal(fiche.querySelector(".combat-nom"), nomRefait);
    assert.equal(fiche.querySelector("table"), table);
    // Le corps qui change (elle perd du corps) se refait, lui.
    partie.rendre({ pj: [aubepine()], adv: [chef({ statut: "a joué", marques: ["ciblee"], actions: actionsDe(0, 1), corps: { valeur: 4, max: 10 } }), marmiton1(), marmiton2()] }, { etroit: false });
    assert.notEqual(fiche.querySelector("table"), table);
    assert.equal(texteDe(fiche.querySelectorAll(".combat-jauge")[1]), "Corps 4/10");
  } finally {
    retirer();
  }
});

test("« Fiche complète » est sur chaque fiche, et demande à l'écran celle de son protagoniste", () => {
  const { partie, appels, retirer } = monter();
  try {
    for (const id of ["pj1", "adv2", "adv3", "adv4"]) {
      const bouton = repere(ficheDe(partie, id), "fiche-complete");
      assert.equal(texteDe(bouton), "Fiche complète");
      assert.equal(bouton.getAttribute("type"), "button");
      bouton.click();
      assert.deepEqual(appels.at(-1), ["ouvrirFiche", id]);
    }
    assert.equal(appels.length, 4);
    assert.equal(repere(ficheDe(partie, "adv3"), "fiche-complete").getAttribute("aria-label"), "Fiche complète : Marmiton de corvée n° 1");
  } finally {
    retirer();
  }
});

test("d'un rendu à l'autre : une vue égale garde ses nœuds, même refaite à neuf ; une vue changée les refait, et le volet reste le même", () => {
  const { partie, retirer } = monter();
  try {
    const fiche = ficheDe(partie, "pj1");
    const resume = fiche.querySelector("summary");
    const nom = resume.querySelector(".combat-nom");
    const table = fiche.querySelector("table");
    // Des objets neufs au contenu identique : rien ne bouge.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1"), fiche);
    assert.equal(fiche.querySelector(".combat-nom"), nom);
    assert.equal(fiche.querySelector("table"), table);

    // Elle perd du souffle : son contenu est refait, pas le volet ni son en-tête.
    partie.rendre({ pj: [aubepine({ souffle: { valeur: 0, max: 10, absent: false }, statut: "ciblé", marques: ["ciblee"] })], adv: [chef(), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1"), fiche);
    assert.equal(fiche.querySelector("summary"), resume);
    assert.notEqual(fiche.querySelector(".combat-nom"), nom);
    assert.notEqual(fiche.querySelector("table"), table);
    assert.equal(texteDe(fiche.querySelector(".combat-jauge")), "Souffle 0/10");
    assert.equal(texteDe(fiche.querySelector(".combat-statut")), "ciblé");
    assert.equal(fiche.className, "combat-fiche ciblee");
    assert.equal(fiche.querySelectorAll("summary").length, 1);
    assert.equal(fiche.querySelectorAll("table").length, 1);
  } finally {
    retirer();
  }
});

test("les marques deviennent des classes, et elles seules", () => {
  const { partie, retirer } = monter({
    pj: [aubepine({ marques: ["joue"] })],
    adv: [chef({ marques: ["ciblee"] }), marmiton1({ marques: ["morte"] }), marmiton2({ marques: ["joue", "inconnue", "combat-jeton"] })],
  });
  try {
    assert.equal(ficheDe(partie, "pj1").className, "combat-fiche joue");
    assert.equal(ficheDe(partie, "adv2").className, "combat-fiche ciblee");
    assert.equal(ficheDe(partie, "adv3").className, "combat-fiche morte");
    assert.equal(ficheDe(partie, "adv4").className, "combat-fiche joue");
    // Une marque qui s'en va emporte sa classe.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ marques: ["morte"] }), marmiton2()] }, { etroit: false });
    assert.equal(ficheDe(partie, "pj1").className, "combat-fiche");
    assert.equal(ficheDe(partie, "adv2").className, "combat-fiche");
  } finally {
    retirer();
  }
});

test("sur un grand écran les fiches sont ouvertes, sauf celle d'un mort", () => {
  const { partie, retirer } = monter({ pj: [aubepine({ marques: ["joue"] })], adv: [chef(), marmiton1({ marques: ["morte"], statut: "mort au tour 2" }), marmiton2({ marques: ["ciblee"] })] });
  try {
    assert.deepEqual(["pj1", "adv2", "adv3", "adv4"].map((id) => ouverte(ficheDe(partie, id))), [true, true, false, true]);
    assert.equal(ficheDe(partie, "pj1").getAttribute("open"), "");
  } finally {
    retirer();
  }
});

test("sur un téléphone, seule la fiche de qui joue est ouverte, et le volet suit qui joue", () => {
  const etroit = { etroit: true };
  const { partie, retirer } = monter({ pj: [aubepine({ marques: ["joue"] })], adv: [chef(), marmiton1(), marmiton2({ marques: ["ciblee"] })] }, etroit);
  try {
    const etats = () => ["pj1", "adv2", "adv3", "adv4"].map((id) => ouverte(ficheDe(partie, id)));
    assert.deepEqual(etats(), [true, false, false, false]);
    // Personne ne joue (la préparation, « Qui joue ? ») : toutes repliées.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(), marmiton2()] }, etroit);
    assert.deepEqual(etats(), [false, false, false, false]);
    // Le Chef joue : sa fiche s'ouvre, celle d'Aubépine reste repliée.
    partie.rendre({ pj: [aubepine()], adv: [chef({ marques: ["joue"] }), marmiton1(), marmiton2()] }, etroit);
    assert.deepEqual(etats(), [false, true, false, false]);
    // La largeur se relit à chaque rendu, même si aucune vue n'a changé.
    partie.rendre({ pj: [aubepine()], adv: [chef({ marques: ["joue"] }), marmiton1(), marmiton2()] }, { etroit: false });
    assert.deepEqual(etats(), [true, true, true, true]);
    partie.rendre({ pj: [aubepine()], adv: [chef({ marques: ["joue"] }), marmiton1(), marmiton2()] }, etroit);
    assert.deepEqual(etats(), [false, true, false, false]);
    // Sans mémoire d'écran, c'est un grand écran.
    partie.rendre({ pj: [aubepine()], adv: [chef({ marques: ["joue"] }), marmiton1(), marmiton2()] });
    assert.deepEqual(etats(), [true, true, true, true]);
  } finally {
    retirer();
  }
});

test("le choix de la personne se garde d'un rendu à l'autre, dans les deux sens, que la fiche soit refaite ou non", () => {
  const etroit = { etroit: true };
  const vue = (retouches = {}) => ({ pj: [aubepine({ marques: ["joue"], ...retouches })], adv: [chef(), marmiton1(), marmiton2()] });
  const { partie, retirer } = monter(vue(), etroit);
  try {
    const etats = () => ["pj1", "adv2", "adv3", "adv4"].map((id) => ouverte(ficheDe(partie, id)));
    assert.deepEqual(etats(), [true, false, false, false]);
    // Elle replie la fiche de qui joue, et ouvre celle du Chef.
    basculer(ficheDe(partie, "pj1"));
    basculer(ficheDe(partie, "adv2"));
    assert.deepEqual(etats(), [false, true, false, false]);
    partie.rendre(vue(), etroit);
    assert.deepEqual(etats(), [false, true, false, false], "vue inchangée");
    partie.rendre(vue({ souffle: { valeur: 1, max: 10, absent: false } }), etroit);
    assert.deepEqual(etats(), [false, true, false, false], "fiche refaite");
    // Même sur un grand écran, où tout s'ouvrirait.
    partie.rendre(vue(), { etroit: false });
    assert.deepEqual(etats(), [false, true, true, true]);
    // Elle revient sur son choix : c'est le dernier geste qui compte.
    basculer(ficheDe(partie, "pj1"));
    partie.rendre(vue(), etroit);
    assert.deepEqual(etats(), [true, true, false, false]);

    // Un volet que la partie ouvre elle-même n'est pas un choix : il se replie quand la règle change.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ marques: ["joue"] }), marmiton2()] }, etroit);
    assert.deepEqual(etats(), [true, true, true, false]);
    ficheDe(partie, "adv3").declencher("toggle");
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(), marmiton2({ marques: ["joue"] })] }, etroit);
    assert.deepEqual(etats(), [true, true, false, true]);
  } finally {
    retirer();
  }
});

test("un geste que le navigateur n'a pas encore annoncé est déjà un choix au rendu suivant", () => {
  const { partie, retirer } = monter();
  try {
    // Le clic a replié le volet ; le rendu passe avant l'annonce du navigateur.
    basculer(ficheDe(partie, "adv2"), false);
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(ouverte(ficheDe(partie, "adv2")), false);
    ficheDe(partie, "adv2").declencher("toggle");
    partie.rendre({ pj: [aubepine({ statut: "joue", marques: ["joue"] })], adv: [chef(), marmiton1(), marmiton2()] }, { etroit: false });
    assert.equal(ouverte(ficheDe(partie, "adv2")), false);
    assert.equal(ouverte(ficheDe(partie, "adv3")), true);
  } finally {
    retirer();
  }
});

test("à sa mort une fiche se replie, même ouverte par la personne ; rouverte ensuite, elle le reste", () => {
  const etroit = { etroit: true };
  const mort = { marques: ["morte"], statut: "mort au tour 2", actions: actionsDe(0, 1) };
  const { partie, retirer } = monter({ pj: [aubepine({ marques: ["joue"] })], adv: [chef(), marmiton1(), marmiton2()] }, etroit);
  try {
    // La personne a ouvert la fiche du Marmiton qu'elle vise.
    basculer(ficheDe(partie, "adv3"));
    partie.rendre({ pj: [aubepine({ marques: ["joue"] })], adv: [chef(), marmiton1({ marques: ["ciblee"], statut: "ciblé" }), marmiton2()] }, etroit);
    assert.equal(ouverte(ficheDe(partie, "adv3")), true, "son choix tient tant que le Marmiton vit");

    // Il meurt : son choix s'oublie, la fiche se replie.
    partie.rendre({ pj: [aubepine({ marques: ["joue"] })], adv: [chef(), marmiton1(mort), marmiton2()] }, etroit);
    const morte = ficheDe(partie, "adv3");
    assert.equal(ouverte(morte), false);
    assert.equal(morte.className, "combat-fiche morte");
    assert.equal(texteDe(morte.querySelector(".combat-statut")), "mort au tour 2");
    assert.equal(texteDe(morte.querySelector(".combat-sous-ligne")), "Commis, Rôtisseur ×1,4 mort au tour 2", "l'état suit la ligne, sous le nom");
    morte.declencher("toggle");
    // Elle reste repliée aux rendus suivants, sur un grand écran aussi.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(mort), marmiton2()] }, { etroit: false });
    assert.equal(ouverte(morte), false);
    assert.deepEqual(["pj1", "adv2", "adv4"].map((id) => ouverte(ficheDe(partie, id))), [true, true, true]);

    // On la rouvre si on le veut, et elle le reste, refaite ou non.
    basculer(morte);
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1(mort), marmiton2()] }, { etroit: false });
    assert.equal(ouverte(morte), true);
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ ...mort, sousTitre: "Commis" }), marmiton2()] }, etroit);
    assert.equal(ouverte(morte), true);
  } finally {
    retirer();
  }
});

test("une fiche fermée par la personne sur un grand écran se replie encore à sa mort, et un vivant fermé le reste", () => {
  const { partie, retirer } = monter();
  try {
    basculer(ficheDe(partie, "adv2"));
    basculer(ficheDe(partie, "adv3"));
    basculer(ficheDe(partie, "adv3"));
    // Le Marmiton, rouvert à la main, meurt : il se replie quand même.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ marques: ["morte"], statut: "mort au tour 1" }), marmiton2()] }, { etroit: false });
    assert.deepEqual(["adv2", "adv3", "adv4"].map((id) => ouverte(ficheDe(partie, id))), [false, false, true]);
  } finally {
    retirer();
  }
});

test("avant le lancement, chaque fiche porte le champ « Case » et « Retirer », hors du volet : ils s'atteignent sans le déplier ; après, ni l'un ni l'autre", () => {
  // Sur un téléphone, avant le lancement, personne ne joue : toutes les fiches sont repliées.
  const { partie, appels, retirer } = monter({ pj: [aubepine({ avant: avantDe("pj1", "A1") })], adv: [chef({ avant: avantDe("adv2", "J1") })] }, { etroit: true });
  try {
    const fiche = ficheDe(partie, "pj1");
    assert.equal(ouverte(fiche), false);
    // Le champ et le bouton ne sont pas dans le volet, qui les cacherait replié : ils le suivent, dans un groupe au nom du protagoniste.
    assert.equal(fiche.querySelectorAll("input").length, 0);
    assert.equal(repere(fiche, "retirer"), null);
    const groupe = groupeDe(partie, "pj1");
    assert.deepEqual([groupe.tagName, groupe.className, groupe.getAttribute("role"), groupe.getAttribute("aria-label")], ["DIV", "combat-fiche-avant", "group", "Aubépine Crèmebrûlée"]);
    const camp = partie.noeud.querySelector(".combat-camp-pj");
    assert.deepEqual(camp.children, [camp.querySelector("h2"), fiche, groupe], "le groupe suit son volet dans la liste du camp");
    assert.deepEqual(partie.noeud.querySelector(".combat-camp-adv").children.map((enfant) => enfant.tagName), ["H2", "DETAILS", "DIV"]);
    for (let ancetre = groupe; ancetre; ancetre = ancetre.parentNode) assert.notEqual(ancetre.tagName, "DETAILS", "jamais dans un volet");

    const champ = repere(groupe, "case");
    assert.equal(champ.tagName, "INPUT");
    assert.equal(champ.className, "champ");
    assert.equal(champ.value, "A1");
    const libelle = groupe.querySelector("label");
    assert.equal(texteDe(libelle), "Case");
    assert.equal(libelle.getAttribute("for"), champ.id);
    // Le champ et son bouton tiennent sur une rangée.
    assert.equal(champ.parentNode.className, "combat-ligne");
    assert.equal(repere(groupe, "retirer").parentNode, champ.parentNode);
    assert.equal(repere(groupeDe(partie, "adv2"), "case").value, "J1");
    assert.equal(groupeDe(partie, "adv2").getAttribute("aria-label"), "Chef de partie");
    // Deux champs, deux identifiants : aucun ne se fait de l'identifiant du protagoniste.
    assert.notEqual(repere(groupeDe(partie, "adv2"), "case").id, champ.id);
    assert.ok(!champ.id.includes("pj1"));

    const bouton = repere(groupe, "retirer");
    assert.equal(texteDe(bouton), "Retirer");
    assert.equal(bouton.getAttribute("aria-label"), "Retirer : Aubépine Crèmebrûlée");
    bouton.click();
    assert.deepEqual(appels, [["executer", { preparer: { type: "retirer", id: "pj1" } }, "panneau"]]);
    repere(groupeDe(partie, "adv2"), "retirer").click();
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "retirer", id: "adv2" } }, "panneau"]);

    // Sur un grand écran aussi, un volet replié par la personne laisse le champ en vue.
    partie.rendre({ pj: [aubepine({ avant: avantDe("pj1", "A1") })], adv: [chef({ avant: avantDe("adv2", "J1") })] }, { etroit: false });
    basculer(ficheDe(partie, "adv2"));
    assert.equal(ouverte(ficheDe(partie, "adv2")), false);
    assert.equal(repere(groupeDe(partie, "adv2"), "case").isConnected, true);

    // Le combat lancé : la vue n'a plus « avant », et le groupe quitte la page.
    partie.rendre({ pj: [aubepine()], adv: [chef()] }, { etroit: false });
    assert.equal(partie.noeud.querySelectorAll(".combat-fiche-avant").length, 0);
    assert.equal(partie.noeud.querySelectorAll("input").length, 0);
    assert.equal(partie.noeud.querySelectorAll("[data-repere=retirer]").length, 0);
    for (const nom of ["pj", "adv"]) assert.deepEqual(partie.noeud.querySelector(`.combat-camp-${nom}`).children.map((enfant) => enfant.tagName), ["H2", "DETAILS"]);
  } finally {
    retirer();
  }
});

test("le champ « Case » pose le protagoniste sur une case lue ; une saisie qui n'est pas une case ne part pas, et le dit", () => {
  const { partie, appels, retirer } = monter({ pj: [aubepine({ avant: avantDe("pj1", "A1") })], adv: [chef({ avant: avantDe("adv2", "J1") })] });
  try {
    const champ = repere(groupeDe(partie, "pj1"), "case");
    const refus = partie.noeud.querySelector(`#${champ.getAttribute("aria-describedby")}`);
    assert.equal(texteDe(refus), "Une case s'écrit de A1 à J10.");
    assert.equal(refus.parentNode, groupeDe(partie, "pj1"), "le refus est dans le groupe, hors du volet");
    assert.equal(refus.hidden, true);

    // La casse et les blancs de bord sont tolérés ; la case part telle que le plateau la nomme.
    saisir(champ, "  d4 ");
    assert.deepEqual(appels, [["executer", { preparer: { type: "poser", id: "pj1", case: "D4" } }, "panneau"]]);
    assert.equal(champ.value, "D4");
    assert.equal(champ.hasAttribute("aria-invalid"), false);
    saisir(champ, "J10");
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "poser", id: "pj1", case: "J10" } }, "panneau"]);
    assert.equal(appels.length, 2);

    // Hors de la carte, ou pas une case : rien ne part.
    for (const faux of ["K1", "A11", "A0", "", "4D", "A1 B2"]) {
      saisir(champ, faux);
      assert.equal(appels.length, 2, `« ${faux} »`);
      assert.equal(champ.getAttribute("aria-invalid"), "true", `« ${faux} »`);
      assert.equal(refus.hidden, false, `« ${faux} »`);
      assert.equal(champ.value, faux, "la saisie refusée reste à corriger");
    }
    // Corrigée, la saisie part et le refus s'efface.
    saisir(champ, "b2");
    assert.equal(appels.length, 3);
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "poser", id: "pj1", case: "B2" } }, "panneau"]);
    assert.equal(champ.hasAttribute("aria-invalid"), false);
    assert.equal(refus.hidden, true);

    // La case où il est déjà : rien à poser.
    saisir(champ, "a1");
    assert.equal(appels.length, 3);
    assert.equal(champ.value, "A1");

    // Chaque champ pose son protagoniste, pas un autre.
    saisir(repere(groupeDe(partie, "adv2"), "case"), "i9");
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "poser", id: "adv2", case: "I9" } }, "panneau"]);
  } finally {
    retirer();
  }
});

test("le champ « Case » suit la case du protagoniste, et une saisie en cours survit à un rendu qui ne le concerne pas", () => {
  const vue = (casePj, caseAdv = "J1") => ({ pj: [aubepine({ avant: avantDe("pj1", casePj) })], adv: [chef({ avant: avantDe("adv2", caseAdv) })] });
  const { partie, retirer } = monter(vue("A1"));
  try {
    const champ = repere(groupeDe(partie, "pj1"), "case");
    champ.value = "zz";
    const tables = { pj1: ficheDe(partie, "pj1").querySelector("table"), adv2: ficheDe(partie, "adv2").querySelector("table") };
    // Le Chef est déplacé sur le plateau : le groupe d'Aubépine n'est pas refait.
    partie.rendre(vue("A1", "H3"), { etroit: false });
    assert.equal(repere(groupeDe(partie, "pj1"), "case"), champ);
    assert.equal(champ.value, "zz");
    assert.equal(repere(groupeDe(partie, "adv2"), "case").value, "H3");
    // Aubépine est déplacée à son tour : son champ le montre.
    partie.rendre(vue("C3", "H3"), { etroit: false });
    assert.equal(repere(groupeDe(partie, "pj1"), "case").value, "C3");
    // Un jeton déplacé ne refait que son groupe : le corps des fiches garde ses nœuds.
    for (const id of ["pj1", "adv2"]) assert.equal(ficheDe(partie, id).querySelector("table"), tables[id], id);
  } finally {
    retirer();
  }
});

test("un protagoniste retiré emporte sa fiche ; les autres gardent la leur, et l'ordre reçu fait foi", () => {
  const { partie, retirer } = monter();
  try {
    const gardees = { adv2: ficheDe(partie, "adv2"), adv4: ficheDe(partie, "adv4") };
    const table = gardees.adv4.querySelector("table");
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton2()] }, { etroit: false });
    const adverses = [...partie.noeud.querySelectorAll(".combat-camp-adv details")];
    assert.deepEqual(adverses.map((fiche) => fiche.getAttribute("data-id")), ["adv2", "adv4"]);
    assert.equal(adverses[0], gardees.adv2);
    assert.equal(adverses[1], gardees.adv4);
    assert.equal(adverses[1].querySelector("table"), table, "une fiche qui reste n'est pas refaite");
    assert.equal(ficheDe(partie, "adv3"), null);

    // Un ajout se range où la vue le dit, et le titre du camp reste en tête.
    partie.rendre({ pj: [aubepine()], adv: [marmiton1(), chef(), marmiton2()] }, { etroit: false });
    const camp = partie.noeud.querySelector(".combat-camp-adv");
    assert.deepEqual(camp.children.map((enfant) => enfant.tagName), ["H2", "DETAILS", "DETAILS", "DETAILS"]);
    assert.deepEqual([...camp.querySelectorAll("details")].map((fiche) => fiche.getAttribute("data-id")), ["adv3", "adv2", "adv4"]);
    assert.equal(ficheDe(partie, "adv2"), gardees.adv2);
    // Le volet de celui qui revient ne se souvient de rien : il est neuf.
    assert.equal(ouverte(ficheDe(partie, "adv3")), true);
  } finally {
    retirer();
  }
});

test("le choix d'un volet ne passe pas à un autre protagoniste qui reprendrait l'identifiant", () => {
  const { partie, retirer } = monter();
  try {
    basculer(ficheDe(partie, "adv3"));
    assert.equal(ouverte(ficheDe(partie, "adv3")), false);
    partie.rendre({ pj: [aubepine()], adv: [chef()] }, { etroit: false });
    partie.rendre({ pj: [aubepine()], adv: [chef(), adversaire("adv3", "Plongeur distrait", "P")] }, { etroit: false });
    assert.equal(ouverte(ficheDe(partie, "adv3")), true);
    assert.equal(texteDe(ficheDe(partie, "adv3").querySelector(".combat-nom")), "Plongeur distrait");
  } finally {
    retirer();
  }
});

test("le focus : il reste où il est quand rien ne change, suit le bouton de même rôle d'une fiche refaite, et ne se perd pas avec une fiche retirée", () => {
  const vue = (casePj, adverses = [chef({ avant: avantDe("adv2", "J1") })]) => ({ pj: [aubepine({ avant: avantDe("pj1", casePj) })], adv: adverses });
  const { partie, retirer } = monter(vue("A1"));
  try {
    // Rien ne change : le champ garde le focus, et c'est le même nœud.
    const champ = repere(groupeDe(partie, "pj1"), "case");
    champ.focus();
    partie.rendre(vue("A1"), { etroit: false });
    assert.equal(document.activeElement, champ);

    // Le groupe est refait (la case a changé) : le focus passe au champ neuf.
    partie.rendre(vue("D4"), { etroit: false });
    const neuf = repere(groupeDe(partie, "pj1"), "case");
    assert.notEqual(neuf, champ);
    assert.equal(document.activeElement, neuf);
    assert.equal(neuf.isConnected, true);

    // Le bouton qui portait le focus n'existe plus : l'en-tête de sa fiche le reçoit.
    partie.rendre({ pj: [aubepine({ jouer: { commande: { choisir: "pj1" } } })], adv: [chef()] }, { etroit: false });
    repere(ficheDe(partie, "pj1"), "jouer").focus();
    partie.rendre({ pj: [aubepine({ marques: ["joue"], statut: "joue" })], adv: [chef()] }, { etroit: false });
    assert.equal(document.activeElement, ficheDe(partie, "pj1").querySelector("summary"));

    // « Retirer » : la fiche s'en va, le titre de son camp reçoit le focus.
    partie.rendre(vue("A1"), { etroit: false });
    repere(groupeDe(partie, "adv2"), "retirer").focus();
    partie.rendre(vue("A1", []), { etroit: false });
    const titre = partie.noeud.querySelector(".combat-camp-adv h2");
    assert.equal(document.activeElement, titre);
    assert.equal(titre.getAttribute("tabindex"), "-1");

    // Le groupe « Case » s'en va (le combat se lance, ou l'on ne joue plus) pendant que son champ a le focus :
    // l'en-tête de la fiche le reçoit, et non un champ qui a quitté la page.
    partie.rendre(vue("A1"), { etroit: false });
    repere(groupeDe(partie, "pj1"), "case").focus();
    partie.rendre({ pj: [aubepine()], adv: [chef()] }, { etroit: false });
    assert.equal(document.activeElement, ficheDe(partie, "pj1").querySelector("summary"));
    assert.equal(document.activeElement.isConnected, true);
    assert.equal(groupeDe(partie, "pj1"), null);

    // Un focus tenu hors des fiches n'est jamais pris.
    const ailleurs = document.createElement("button");
    document.body.append(ailleurs);
    ailleurs.focus();
    partie.rendre(vue("B2"), { etroit: false });
    assert.equal(document.activeElement, ailleurs);

    // Les cinq focus du contrôle n'ont pas d'options ; les cinq que la
    // partie a rendus (le champ neuf, l'en-tête trois fois, le titre du
    // camp) se posent sans faire défiler la page (compl. § 4.5).
    const rendus = document.focalisations.filter((focalisation) => focalisation.options !== undefined);
    assert.equal(document.focalisations.length, 10);
    assert.deepEqual(rendus.map((focalisation) => focalisation.noeud.tagName), ["INPUT", "SUMMARY", "SUMMARY", "H2", "SUMMARY"]);
    assert.deepEqual(rendus.map((focalisation) => focalisation.options), Array(5).fill({ preventScroll: true }));
    assert.equal(document.defilements.length, 0);
  } finally {
    retirer();
  }
});

test("le focus ne fait jamais défiler la page : chaque focus du module porte preventScroll, et rien ne défile", () => {
  // Contrat du groupe 2, § 0.2 (règle 2) et § 9.11.
  const focus = SOURCE.match(/\.focus\([^)]*\)/g) ?? [];
  assert.equal(focus.length, 3, "le même nœud, le titre du camp, le bouton de même rôle ou l'en-tête");
  assert.deepEqual([...new Set(focus)], [".focus({ preventScroll: true })"]);
  for (const interdit of ["scrollIntoView", "scrollTo", "scrollBy", "window.scroll", "scrollTop"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans les fiches`);
  }
});

test("un nom hostile reste du texte : ni balise, ni sens d'écriture forcé, ni identifiant de page", () => {
  const force = String.fromCodePoint(0x202e);
  const hostile = `<b onclick="x">Chef</b>${force} de partie`;
  const propre = '<b onclick="x">Chef</b> de partie';
  const { partie, appels, retirer } = monter({
    pj: [aubepine({ liens: [{ nom: `Grand${force} Four`, valeur: 1, max: 1 }], zones: [zone("1-19", 19, `Tête${force} <i>`, 2, 2)] })],
    adv: [adversaire('x"] , [data-id="pj1', hostile, "<", { avant: avantDe('x"] , [data-id="pj1', "J1"), jouer: { commande: { choisir: "adv9" } } })],
  });
  try {
    const fiche = partie.noeud.querySelector(".combat-camp-adv details");
    assert.equal(fiche.getAttribute("data-id"), 'x"] , [data-id="pj1');
    assert.equal(texteDe(fiche.querySelector(".combat-nom")), propre);
    assert.equal(texteDe(fiche.querySelector(".combat-pastille")), "<");
    assert.equal(fiche.querySelectorAll("b").length, 0);
    assert.equal(partie.noeud.querySelectorAll("i").length, 0);
    assert.equal(repere(fiche, "jouer").getAttribute("aria-label"), `Jouer : ${propre}`);
    const groupe = partie.noeud.querySelector(".combat-camp-adv .combat-fiche-avant");
    assert.equal(repere(groupe, "retirer").getAttribute("aria-label"), `Retirer : ${propre}`);
    assert.equal(groupe.getAttribute("aria-label"), propre);
    assert.equal(groupe.getAttribute("data-fiche"), 'x"] , [data-id="pj1');
    assert.equal(repere(fiche, "fiche-complete").getAttribute("aria-label"), `Fiche complète : ${propre}`);
    assert.equal(fiche.querySelector("table").getAttribute("aria-label"), `Zones : ${propre}`);
    assert.ok(!partie.noeud.textContent.includes(force));
    // Aucun attribut ne garde le signe : ni un nom accessible, ni un titre.
    assert.deepEqual([...partie.noeud.descendants()].flatMap((noeud) => [...noeud.attributs].filter(([, valeur]) => valeur.includes(force)).map(([nom]) => `${noeud.tagName}@${nom}`)), []);
    assert.equal(texteDe(partie.noeud.querySelectorAll(".combat-jauge")[2]), "Lien · Grand Four 1/1");
    // L'identifiant repart tel quel dans la commande, et nulle part dans un identifiant de page.
    repere(fiche, "fiche-complete").click();
    assert.deepEqual(appels.at(-1), ["ouvrirFiche", 'x"] , [data-id="pj1']);
    for (const noeud of partie.noeud.querySelectorAll("[id]")) assert.match(noeud.id, /^combat-fiche-\d+-case(?:-refus)?$/);
  } finally {
    retirer();
  }
});

test("le texte du module : ses seuls imports, aucun mot interdit, aucun bouton éteint", () => {
  const imports = [...SOURCE.matchAll(/^\s*import\b[^;]*?from\s+"([^"]+)";/gm)].map(([, chemin]) => chemin);
  assert.deepEqual(imports, ["../adversaire/carte.js", "../combat/plateau.js", "./dom.js"]);
  assert.match(SOURCE, /import \{ abregerZone \} from "\.\.\/adversaire\/carte\.js";/);
  assert.match(SOURCE, /import \{ lireCase \} from "\.\.\/combat\/plateau\.js";/);
  assert.ok(!/\bimport\s*\(/.test(SOURCE), "aucun import dynamique");
  for (const interdit of ["innerHTML", "outerHTML", "insertAdjacent", ".style", "cssText", "confirm(", "Chargement de", "data-chargement", "localStorage", "indexedDB", "matchMedia", "classList", "closest(", "insertBefore"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans les fiches`);
  }
  // Mission § 10.9 : le code n'écrit aucun style, pas même par un attribut.
  assert.doesNotMatch(SOURCE, /\bstyle\s*[:=]|setAttribute\(\s*["'`]style/, "aucun style écrit par le code");
  assert.ok(!/["'`]disabled["'`]\s*[:,]/.test(SOURCE), "jamais disabled");
  assert.ok(!/addEventListener\(/.test(SOURCE), "aucun écouteur global : chaque écouteur passe par el()");
  assert.ok(!SOURCE.includes(String.fromCodePoint(0xa0)) && !SOURCE.includes(String.fromCodePoint(0x202f)), "aucune espace insécable");
  assert.match(SOURCE, /^\/\/ Les fiches vivantes du combat \(SPECIFICATION\.md, § 17/);
  // « carte » ne nomme que la fiche imprimée d'un adversaire : ici, le seul chemin de l'import.
  assert.deepEqual(SOURCE.match(/[^\s"]*carte[^\s"]*/gi), ["../adversaire/carte.js"]);
});
