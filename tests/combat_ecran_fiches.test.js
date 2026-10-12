// Contrôles des fiches vivantes du combat, dans un document simulé
// (SPECIFICATION.md, § 17 et § 11 ; mission du lot 4, § 5 et § 10.5).
//
// La partie se contrôle seule, sur des vues écrites à la main à la forme de
// vueFiche : ce qu'elle montre, ce que chaque bouton rend à l'écran, les
// nœuds gardés d'un rendu à l'autre quand leur vue n'a pas changé, refaits
// quand elle a changé, et la règle des volets (ouverts ou repliés). Les
// noms viennent de la démonstration. La mise en page se regarde dans un vrai
// navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_fiches.js");
const SOURCE = readFileSync(new URL("../js/ecrans/combat_fiches.js", import.meta.url), "utf8");

const zone = (faces, nombreDeFaces, nom, armure, max, etat = null, resistance = 5) => ({
  faces,
  nombreDeFaces,
  nom,
  armure: { valeur: armure, max, etat },
  resistance: { valeur: resistance, max: 5 },
});

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
    actions: { reste: 1, max: 2 },
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
    actions: { reste: 1, max: 1 },
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
      ["combat-pastille", "combat-nom", "combat-sous", "combat-statut", "combat-actions"],
    );
    assert.equal(texteDe(resume.querySelector(".combat-pastille")), "A");
    assert.equal(texteDe(resume.querySelector(".combat-nom")), "Aubépine Crèmebrûlée");
    assert.equal(texteDe(resume.querySelector(".combat-sous")), "Marmiton · Saucier");
    assert.equal(texteDe(resume.querySelector(".combat-statut")), "joue");
    const actions = resume.querySelector(".combat-actions");
    assert.deepEqual(actions.children.map((pion) => pion.className), ["combat-pion", "combat-pion vide"]);
    assert.equal(actions.getAttribute("role"), "img");
    assert.equal(actions.getAttribute("aria-label"), "1 action sur 2");
    // Lu d'un trait, l'en-tête garde ses mots séparés.
    assert.equal(texteDe(resume), "A Aubépine Crèmebrûlée Marmiton · Saucier joue");

    // Sans état ni ligne, ni l'un ni l'autre ne s'écrit.
    const sobre = ficheDe(partie, "adv3").querySelector("summary");
    assert.deepEqual(sobre.children.map((enfant) => enfant.className), ["combat-pastille", "combat-nom", "combat-actions"]);
    assert.equal(texteDe(sobre.querySelector(".combat-nom")), "Marmiton de corvée n° 1");
    assert.equal(sobre.querySelector(".combat-actions").getAttribute("aria-label"), "1 action sur 1");
    assert.equal(texteDe(ficheDe(partie, "adv2").querySelector(".combat-sous")), "Commis, Rôtisseur ×1,4");

    // Le nom déplie le volet : jamais un bouton, un lien ni un champ dans un en-tête.
    for (const entete of partie.noeud.querySelectorAll("summary")) {
      for (const balise of ["button", "a", "input", "select"]) assert.equal(entete.querySelectorAll(balise).length, 0, balise);
    }
  } finally {
    retirer();
  }
});

test("les actions restantes s'accordent, et passent aux nombres au-delà de trente", () => {
  const { partie, retirer } = monter({
    pj: [aubepine({ actions: { reste: 2, max: 2 } })],
    adv: [chef({ actions: { reste: 0, max: 1 } }), marmiton1({ actions: { reste: 12, max: 31 } }), marmiton2({ actions: { reste: 30, max: 30 } })],
  });
  try {
    const actionsDe = (id) => ficheDe(partie, id).querySelector(".combat-actions");
    assert.equal(actionsDe("pj1").getAttribute("aria-label"), "2 actions sur 2");
    assert.deepEqual(actionsDe("pj1").children.map((pion) => pion.className), ["combat-pion", "combat-pion"]);
    assert.equal(actionsDe("adv2").getAttribute("aria-label"), "0 action sur 1");
    assert.deepEqual(actionsDe("adv2").children.map((pion) => pion.className), ["combat-pion vide"]);
    assert.equal(actionsDe("adv4").children.length, 30);
    assert.equal(actionsDe("adv3").children.length, 0);
    assert.equal(texteDe(actionsDe("adv3")), "12 actions sur 31");
  } finally {
    retirer();
  }
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

test("la table des zones : les faces, le nom abrégé, l'armure signalée dès qu'elle baisse, la résistance en cases, la contre-attaque en pied", () => {
  const { partie, retirer } = monter();
  try {
    const fiche = ficheDe(partie, "pj1");
    const table = fiche.querySelector("table");
    assert.equal(table.className, "combat-zones");
    assert.deepEqual(textes(table, "thead th"), ["d20", "Zone", "Armure", "Résistance"]);
    for (const titre of table.querySelectorAll("thead th")) assert.equal(titre.getAttribute("scope"), "col");
    const lignes = [...table.querySelectorAll("tbody tr")];
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

    // La résistance : cinq cases, et leur compte pour qui ne les voit pas.
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

test("les effets en cours viennent avant les passifs, dans la même liste", () => {
  const { partie, retirer } = monter({
    pj: [aubepine({ effets: [{ texte: "Défense 4 (5 − 1)", actif: true, raison: null }], passifs: [{ texte: "Vif : +1 en agilité", actif: true, raison: null }] })],
    adv: [chef({ effets: ["Étourdi"] })],
  });
  try {
    assert.deepEqual(textes(ficheDe(partie, "pj1"), ".combat-effets li"), ["Défense 4 (5 − 1)", "Vif : +1 en agilité"]);
    assert.deepEqual(textes(ficheDe(partie, "adv2"), ".combat-effets li"), ["Étourdi"]);
  } finally {
    retirer();
  }
});

test("« Jouer » n'existe que sur une fiche qu'on peut choisir, et rend sa commande ; il paraît quand seule la vue a changé", () => {
  const { partie, appels, retirer } = monter();
  try {
    // Le tour des PJ : aucune fiche d'adversaire ne propose de jouer.
    for (const id of ["pj1", "adv2", "adv3", "adv4"]) assert.equal(repere(ficheDe(partie, id), "jouer"), null, id);
    const corpsDe = (id) => ficheDe(partie, id).querySelector(".combat-fiche-corps");
    const avant = { adv2: corpsDe("adv2").children[0], adv4: corpsDe("adv4").children[0], pj1: corpsDe("pj1").children[0] };

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
    assert.notEqual(corpsDe("adv2").children[0], avant.adv2, "vue changée : fiche refaite");
    // Le bouton est dans le corps, jamais dans l'en-tête.
    assert.equal(bouton.parentNode.parentNode, corpsDe("adv2"));

    assert.deepEqual(appels, []);
    bouton.click();
    assert.deepEqual(appels, [["executer", { choisir: "adv2" }, "panneau"]]);
    repere(ficheDe(partie, "adv3"), "jouer").click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "adv3" }, "panneau"]);

    // Il disparaît quand la fiche ne peut plus être choisie.
    partie.rendre({ pj: [aubepine()], adv: [chef(), marmiton1({ jouer: jouer("adv3") }), marmiton2()] }, { etroit: false });
    assert.equal(repere(ficheDe(partie, "adv2"), "jouer"), null);
    assert.ok(repere(ficheDe(partie, "adv3"), "jouer"));
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
  const mort = { marques: ["morte"], statut: "mort au tour 2", actions: { reste: 0, max: 1 } };
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

test("avant le lancement, chaque fiche porte le champ « Case » et « Retirer » ; après, ni l'un ni l'autre", () => {
  const { partie, appels, retirer } = monter({ pj: [aubepine({ avant: avantDe("pj1", "A1") })], adv: [chef({ avant: avantDe("adv2", "J1") })] });
  try {
    const fiche = ficheDe(partie, "pj1");
    const champ = repere(fiche, "case");
    assert.equal(champ.tagName, "INPUT");
    assert.equal(champ.className, "champ");
    assert.equal(champ.value, "A1");
    const libelle = fiche.querySelector("label");
    assert.equal(texteDe(libelle), "Case");
    assert.equal(libelle.getAttribute("for"), champ.id);
    assert.equal(repere(ficheDe(partie, "adv2"), "case").value, "J1");
    // Deux champs, deux identifiants : aucun ne se fait de l'identifiant du protagoniste.
    assert.notEqual(repere(ficheDe(partie, "adv2"), "case").id, champ.id);
    assert.ok(!champ.id.includes("pj1"));

    const bouton = repere(fiche, "retirer");
    assert.equal(texteDe(bouton), "Retirer");
    assert.equal(bouton.getAttribute("aria-label"), "Retirer : Aubépine Crèmebrûlée");
    bouton.click();
    assert.deepEqual(appels, [["executer", { preparer: { type: "retirer", id: "pj1" } }, "panneau"]]);
    repere(ficheDe(partie, "adv2"), "retirer").click();
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "retirer", id: "adv2" } }, "panneau"]);

    // Le combat lancé : la vue n'a plus « avant », la fiche non plus.
    partie.rendre({ pj: [aubepine()], adv: [chef()] }, { etroit: false });
    for (const id of ["pj1", "adv2"]) {
      assert.equal(repere(ficheDe(partie, id), "case"), null);
      assert.equal(repere(ficheDe(partie, id), "retirer"), null);
      assert.equal(ficheDe(partie, id).querySelectorAll("input").length, 0);
    }
  } finally {
    retirer();
  }
});

test("le champ « Case » pose le protagoniste sur une case lue ; une saisie qui n'est pas une case ne part pas, et le dit", () => {
  const { partie, appels, retirer } = monter({ pj: [aubepine({ avant: avantDe("pj1", "A1") })], adv: [chef({ avant: avantDe("adv2", "J1") })] });
  try {
    const champ = repere(ficheDe(partie, "pj1"), "case");
    const refus = partie.noeud.querySelector(`#${champ.getAttribute("aria-describedby")}`);
    assert.equal(texteDe(refus), "Une case s'écrit de A1 à J10.");
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
    saisir(repere(ficheDe(partie, "adv2"), "case"), "i9");
    assert.deepEqual(appels.at(-1), ["executer", { preparer: { type: "poser", id: "adv2", case: "I9" } }, "panneau"]);
  } finally {
    retirer();
  }
});

test("le champ « Case » suit la case du protagoniste, et une saisie en cours survit à un rendu qui ne le concerne pas", () => {
  const vue = (casePj, caseAdv = "J1") => ({ pj: [aubepine({ avant: avantDe("pj1", casePj) })], adv: [chef({ avant: avantDe("adv2", caseAdv) })] });
  const { partie, retirer } = monter(vue("A1"));
  try {
    const champ = repere(ficheDe(partie, "pj1"), "case");
    champ.value = "zz";
    // Le Chef est déplacé sur le plateau : la fiche d'Aubépine n'est pas refaite.
    partie.rendre(vue("A1", "H3"), { etroit: false });
    assert.equal(repere(ficheDe(partie, "pj1"), "case"), champ);
    assert.equal(champ.value, "zz");
    assert.equal(repere(ficheDe(partie, "adv2"), "case").value, "H3");
    // Aubépine est déplacée à son tour : son champ le montre.
    partie.rendre(vue("C3", "H3"), { etroit: false });
    assert.equal(repere(ficheDe(partie, "pj1"), "case").value, "C3");
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
    const champ = repere(ficheDe(partie, "pj1"), "case");
    champ.focus();
    partie.rendre(vue("A1"), { etroit: false });
    assert.equal(document.activeElement, champ);

    // La fiche est refaite (la case a changé) : le focus passe au champ neuf.
    partie.rendre(vue("D4"), { etroit: false });
    const neuf = repere(ficheDe(partie, "pj1"), "case");
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
    repere(ficheDe(partie, "adv2"), "retirer").focus();
    partie.rendre(vue("A1", []), { etroit: false });
    const titre = partie.noeud.querySelector(".combat-camp-adv h2");
    assert.equal(document.activeElement, titre);
    assert.equal(titre.getAttribute("tabindex"), "-1");

    // Un focus tenu hors des fiches n'est jamais pris.
    const ailleurs = document.createElement("button");
    document.body.append(ailleurs);
    ailleurs.focus();
    partie.rendre(vue("B2"), { etroit: false });
    assert.equal(document.activeElement, ailleurs);
  } finally {
    retirer();
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
    assert.equal(repere(fiche, "retirer").getAttribute("aria-label"), `Retirer : ${propre}`);
    assert.equal(repere(fiche, "fiche-complete").getAttribute("aria-label"), `Fiche complète : ${propre}`);
    assert.ok(!partie.noeud.textContent.includes(force));
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
  assert.ok(!/["'`]disabled["'`]\s*[:,]/.test(SOURCE), "jamais disabled");
  assert.ok(!/addEventListener\(/.test(SOURCE), "aucun écouteur global : chaque écouteur passe par el()");
  assert.ok(!SOURCE.includes(String.fromCodePoint(0xa0)) && !SOURCE.includes(String.fromCodePoint(0x202f)), "aucune espace insécable");
  assert.match(SOURCE, /^\/\/ Les fiches vivantes du combat \(SPECIFICATION\.md, § 17/);
  // « carte » ne nomme que la fiche imprimée d'un adversaire : ici, le seul chemin de l'import.
  assert.deepEqual(SOURCE.match(/[^\s"]*carte[^\s"]*/gi), ["../adversaire/carte.js"]);
});
