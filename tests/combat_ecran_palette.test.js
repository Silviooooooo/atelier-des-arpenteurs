// Contrôles de la palette du combat (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat » ; mission du lot 4.3, § 4.5 et § 4.6, vues F4, E1 et E6 ;
// contrat de la vague 3, § 3.6, § 4.1 et § 7) : js/ecrans/combat_palette.js,
// dans le document simulé, sur des vues écrites à la main dans la forme de
// vuePalette (contrat, § 3.6).
//
// Le module ne porte aucune règle : ces contrôles vérifient qu'il montre ce
// que dit la vue (ses onglets, ses genres, chaque sorte de champ, l'aperçu,
// les effets en cours), qu'il remonte chaque choix à l'écran
// (choisirDansLaPalette), qu'il émet « Appliquer » depuis la palette, et que
// ce que seul le Mode MJ montre ne paraît pas sans lui. Le banc tient la place
// de l'écran : à chaque choix, il rend la vue de ce choix (son aperçu, son
// « Appliquer »), comme combat.js le fera. Les nœuds se comparent par
// identité, jamais par assert.equal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutons, installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_palette.js");

// ——— L'outillage ———

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const leBouton = (noeud, debut) => {
  const trouves = boutons(noeud, debut);
  assert.equal(trouves.length, 1, `un seul bouton « ${debut} », trouvé ${trouves.length}`);
  return trouves[0];
};
const forme = (n) => `${n.tagName.toLowerCase()}.${n.className}`;
const presse = (bouton) => bouton.getAttribute("aria-pressed");
const raisonDe = (noeud, bouton) => texteDe(noeud.querySelector(`#${bouton.getAttribute("aria-describedby")}`));
function memeNoeud(vu, attendu, quoi = "le nœud") {
  if (vu !== attendu) assert.fail(`${quoi} : ${vu?.tagName ?? vu} au lieu de ${attendu?.tagName ?? attendu}`);
}
const JET_CONTRE_UN_ALLIE = "Le jet contre un allié ou contre soi n'est pas encore écrit dans les règles.";

// ——— La vue, écrite à la main dans la forme du contrat (§ 3.6) ———

const FRAPPE = { genre: "capacite", qui: "pj1", capacite: 0 };
const sur = (valeur = null) => ({
  nom: "sur",
  sorte: "option",
  libelle: "Sur",
  valeur,
  options: [
    { valeur: "adv5", libelle: "Marmiton de corvée n° 3", case: "D4", actif: true, raison: null },
    { valeur: "pj1", libelle: "Aubépine Crèmebrûlée", case: "D4", actif: true, raison: null },
  ],
});
const nombre = (nom, libelle, min, max, valeur = null, exclus) => ({ nom, sorte: "nombre", libelle, valeur, min, max, ...(exclus ? { exclus } : {}) });
const genre = (nom, libelle, champs = [], autres = {}) => ({ genre: nom, libelle, actif: true, raison: null, mj: false, champs, gabarit: { evenement: { type: "effet", genre: nom, source: FRAPPE } }, ...autres });

const AVANTAGES = genre("avantages", "Avantages, pour ce jet", [nombre("nombre", "k", 1, 5, 1)], { actif: false, raison: "Aucun dé lancé." });
const INVERSER = genre("inverser", "Inverser");
const REUSSITE = genre("reussite", "+1 réussite", [], { actif: false, raison: "Le jet compte déjà trois réussites." });
const ZONE = genre("zone", "Choisir la zone", [
  { nom: "de", sorte: "option", libelle: "d20", valeur: 0, options: [{ valeur: 0, libelle: "d20 : 15", actif: true, raison: null }] },
  { nom: "zone", sorte: "option", libelle: "Zone", valeur: null, options: [{ valeur: 0, libelle: "Torse", actif: true, raison: null }, { valeur: 2, libelle: "Jambe droite", actif: true, raison: null }] },
]);
const MULTIPLIER = genre("multiplier", "×k", [nombre("k", "k", 2, 10, 2)]);
const RENDRE = genre("rendre", "Rendre N", [
  {
    nom: "ressource",
    sorte: "option",
    libelle: "Rendre",
    valeur: null,
    options: [
      { valeur: { sur: "pj1", ressource: "souffle" }, libelle: "Souffle d'Aubépine", actif: true, raison: null },
      { valeur: { sur: "pj1", ressource: "endurance", zone: 2 }, libelle: "Endurance de la jambe droite", actif: false, raison: "Déjà au maximum." },
    ],
  },
  nombre("n", "N", 1, 10, 1),
]);
const TOUTE_LA_CASE = genre("toute_la_case", "Toute la case", [
  {
    nom: "cibles",
    sorte: "cibles",
    libelle: "Toute la case D4",
    valeur: null,
    options: [
      { valeur: "adv4", libelle: "Marmiton de corvée n° 2", detail: "D4 · défense 5 · corps 10/10", actif: true, raison: null, dOffice: true },
      { valeur: "adv5", libelle: "Marmiton de corvée n° 3", detail: "D4 · défense 5 · corps 10/10", actif: true, raison: null, dOffice: true },
      { valeur: "pj1", libelle: "Aubépine Crèmebrûlée", detail: "D4 · corps 10/10", actif: false, raison: JET_CONTRE_UN_ALLIE, dOffice: false },
    ],
  },
]);
const ATTAQUE = genre("attaque", "Attaque de la cible", [sur("adv5"), nombre("n", "N", -5, 5, -2, [0])]);
const ETAT = genre("etat", "Appliquer un état", [
  sur("adv5"),
  { nom: "capacite", sorte: "option", libelle: "État", valeur: null, blocs: [{ titre: "Condition (bloc du classeur)", options: [{ valeur: "0:0", libelle: "Étourdi", texte: "Une condition.", actif: true, raison: null }, { valeur: "0:1", libelle: "En nage", texte: "Une condition.", actif: true, raison: null }] }] },
  { nom: "libre", sorte: "texte", libelle: "État libre", valeur: null, max: 40 },
]);
const DEPLACER = genre("deplacer", "Déplacer, sans action", [sur("adv5"), { nom: "vers", sorte: "case", libelle: "Case d'arrivée", valeur: null, exclue: "D4" }]);
const DUREE = {
  nom: "duree",
  sorte: "option",
  libelle: "Durée",
  valeur: "tour",
  options: [
    { valeur: "jet", libelle: "ce jet", actif: true, raison: null },
    { valeur: "tour", libelle: "jusqu'au prochain tour d'Aubépine", actif: true, raison: null },
    { valeur: "combat", libelle: "jusqu'à la fin du combat", actif: true, raison: null },
  ],
};
// Les genres de l'onglet Cible qui ont une durée (contrat, § 3.6) : déplacer n'en a pas.
const DE_LA_CIBLE = ["attaque", "defense", "etat"];
const RETIRER = { libelle: "Retirer l'état Étourdi", actif: true, raison: null, commande: { evenement: { type: "mj", genre: "etat", qui: "adv5", retrait: "e3" } }, mj: true };

/** La palette au nom de Frappe (F4) ; avec un choix, ce que l'écran rend : l'aperçu, « Appliquer », la Durée d'un genre de l'onglet Cible. */
const vuePalette = (choisi = null, champs = {}) => ({
  titre: "Effet de Frappe",
  sous: "la palette, au nom de la capacité jouée",
  texte: "Frappe — Une attaque qui inflige 3/8/20.",
  source: {
    valeur: FRAPPE,
    nom: "Frappe",
    phrase: "Source : Frappe, la capacité jouée (en Mode MJ, elle se change).",
    phraseMj: "Source : Frappe (par défaut) · changer",
    choix: [
      { libelle: "Frappe (Aubépine)", source: FRAPPE, choisie: true, actif: true, raison: null },
      { libelle: "MJ", source: { genre: "mj" }, choisie: false, actif: true, raison: null },
    ],
  },
  x: null,
  onglets: [
    { cle: "des", libelle: "Dés", genres: [AVANTAGES, INVERSER, REUSSITE] },
    { cle: "zone", libelle: "Zone", genres: [ZONE] },
    { cle: "degats", libelle: "Dégâts", genres: [MULTIPLIER, RENDRE, TOUTE_LA_CASE] },
    { cle: "cible", libelle: "Cible", genres: [ATTAQUE, ETAT, DEPLACER] },
    { cle: "duree", libelle: "Durée", genres: [], champ: choisi && DE_LA_CIBLE.includes(choisi.genre) ? DUREE : null },
  ],
  effetsEnCours: [
    { id: null, genre: "multiplier", nom: "×2 (Flambage)", duree: "pour ce jet", couleur: "favorable", retirer: null },
    { id: "e3", genre: "etat", nom: "Étourdi", duree: "jusqu'au prochain tour des PJ", couleur: "alerte", retirer: RETIRER },
  ],
  apercu: choisi ? `Le journal écrira : ${choisi.genre}.` : null,
  appliquer: choisi ? { libelle: "Appliquer", actif: true, raison: null, commande: { evenement: { type: "effet", genre: choisi.genre, source: FRAPPE, ...choisi.valeurs, ...(choisi.x === null ? {} : { x: choisi.x }) } } } : null,
  fermer: "Fermer",
  ...champs,
});

/**
 * La palette dans la page, menée comme le fera l'écran : chaque choix part
 * à choisirDansLaPalette, et l'écran rend la vue de ce choix (banc.vue),
 * dans les mêmes conditions (etroit, modeMj). Relève les appels.
 */
function monter({ etroit = false, modeMj = false, vue = vuePalette } = {}) {
  const retirer = installerDom();
  const banc = { appels: [], ecran: { etroit, modeMj }, vue, suivre: true };
  const actions = {
    executer: (commande, origine) => banc.appels.push({ executer: commande, origine }),
    choisirDansLaPalette: (choisi) => {
      banc.appels.push({ choisi });
      if (banc.suivre) palette.rendre(banc.vue(choisi), banc.ecran);
    },
    changerLaSource: (source) => banc.appels.push({ source }),
    fermerLaPalette: () => banc.appels.push({ fermer: true }),
    demanderUneCase: (options, rappel) => banc.appels.push({ demanderUneCase: options, rappel }),
  };
  const palette = creer(actions);
  globalThis.document.body.append(palette.noeud);
  const rendre = (laVue = banc.vue(null), ecran = {}) => {
    banc.ecran = { etroit, modeMj, ...ecran };
    palette.rendre(laVue, banc.ecran);
  };
  return Object.assign(banc, palette, { palette, rendre, retirer, choix: () => banc.appels.filter((appel) => appel.choisi).map((appel) => appel.choisi) });
}

function avecLaPalette(faire, options) {
  const monte = monter(options);
  try {
    faire(monte);
  } finally {
    monte.retirer();
  }
}

const onglet = (noeud, libelle) => tous(noeud, "[role=tab]").find((tab) => texteDe(tab) === libelle);
const panneau = (noeud) => noeud.querySelector("[role=tabpanel]");

// ——— Les contrôles ———

test("palette — cachée sans vue ; montrée, le nœud porte tout : titre, sous-titre, texte, phrase de la source, onglets, corps, effets en cours, aperçu, pied « Fermer » et « Appliquer » (inactif tant que rien n'est choisi)", () => {
  avecLaPalette(({ noeud, rendre, palette }) => {
    assert.equal(forme(noeud), "section.combat-palette");
    assert.equal(noeud.hidden, true, "cachée avant tout rendu");
    assert.equal(palette.choisi(), null);
    rendre();
    assert.equal(noeud.hidden, false);
    const titre = noeud.querySelector("h2");
    assert.equal(texteDe(titre), "Effet de Frappe");
    assert.equal(noeud.getAttribute("aria-labelledby"), titre.id, "la section se nomme par son titre");
    assert.equal(titre.getAttribute("tabindex"), "-1");
    memeOrdreDe(noeud.children.map(forme), ["h2.", "p.combat-sous", "p.combat-palette-texte", "p.", "div.combat-palette-onglets", "div.", "h3.", "ul.combat-palette-effets", "div.combat-pied"]);
    assert.equal(texteDe(noeud.querySelector(".combat-palette-texte")), "Frappe — Une attaque qui inflige 3/8/20.");
    assert.equal(texteDe(noeud.children[3]), "Source : Frappe, la capacité jouée (en Mode MJ, elle se change).");
    assert.deepEqual(tous(noeud.querySelector(".combat-palette-onglets"), "button").map(texteDe), ["Dés", "Zone", "Dégâts", "Cible", "Durée"]);
    assert.equal(texteDe(noeud.children[6]), "Effets en cours");
    assert.deepEqual(tous(noeud, ".combat-palette-effets li").map(texteDe), ["×2 (Flambage) · pour ce jet", "Étourdi · jusqu'au prochain tour des PJ"]);
    assert.equal(noeud.querySelector(".combat-palette-apercu"), null, "pas d'aperçu sans choix");
    const pied = noeud.querySelector(".combat-pied");
    memeNoeud(pied, noeud.children.at(-1), "le pied, en dernier");
    assert.deepEqual(tous(pied, "button").map((b) => [texteDe(b), b.getAttribute("aria-disabled")]), [["Fermer", null], ["Appliquer", "true"]]);
    // Un rendu égal ne refait rien ; null la cache, et la vide.
    const avant = noeud.querySelector("h2");
    rendre();
    memeNoeud(noeud.querySelector("h2"), avant, "un rendu égal");
    palette.rendre(null);
    assert.equal(noeud.hidden, true);
    assert.equal(noeud.children.length, 0);
  });
});

/** Deux listes de textes égales, dites en une ligne si elles diffèrent. */
function memeOrdreDe(vus, attendus) {
  if (JSON.stringify(vus) !== JSON.stringify(attendus)) assert.fail(`${JSON.stringify(vus)} au lieu de ${JSON.stringify(attendus)}`);
}

test("palette — les onglets (tablist, tab, tabpanel) : le premier qui offre un genre actif s'ouvre ; un autre s'ouvre d'un appui ; l'onglet se garde quand la source change, et repart quand la palette se rouvre ; Durée : sa phrase sans genre de l'onglet Cible, ses options avec", () => {
  avecLaPalette(({ noeud, rendre, palette, appels }) => {
    rendre();
    const liste = noeud.querySelector(".combat-palette-onglets");
    assert.equal(liste.getAttribute("role"), "tablist");
    const des = onglet(noeud, "Dés");
    assert.equal(des.getAttribute("aria-selected"), "true", "Dés : Inverser y est actif");
    assert.equal(panneau(noeud).getAttribute("aria-labelledby"), des.id);
    assert.equal(des.getAttribute("aria-controls"), panneau(noeud).id);
    assert.deepEqual(tous(panneau(noeud), ".combat-palette-groupe").map((g) => g.children[0]).map((b) => [texteDe(b), b.getAttribute("aria-disabled")]), [["Avantages, pour ce jet", "true"], ["Inverser", null], ["+1 réussite", "true"]]);
    // Un autre onglet : son corps.
    onglet(noeud, "Cible").click();
    assert.equal(onglet(noeud, "Cible").getAttribute("aria-selected"), "true");
    assert.deepEqual(tous(panneau(noeud), ".combat-palette-groupe").map((g) => texteDe(g.children[0])), ["Attaque de la cible", "Appliquer un état", "Déplacer, sans action"]);
    // La source change (Mode MJ) : la vue d'une autre source, l'onglet ouvert reste.
    rendre(vuePalette(null, { titre: "Palette (Mode MJ)" }));
    assert.equal(onglet(noeud, "Cible").getAttribute("aria-selected"), "true");
    // Rouverte : le premier qui offre.
    palette.rendre(null);
    rendre();
    assert.equal(onglet(noeud, "Dés").getAttribute("aria-selected"), "true");
    // Aucun genre actif nulle part : le premier.
    rendre(vuePalette(null, { onglets: [{ cle: "zone", libelle: "Zone", genres: [{ ...ZONE, actif: false, raison: "Aucun d20 lancé." }] }, { cle: "duree", libelle: "Durée", genres: [], champ: null }] }));
    assert.equal(onglet(noeud, "Zone").getAttribute("aria-selected"), "true");

    // Durée, sans genre choisi dans l'onglet Cible : sa phrase.
    palette.rendre(null);
    rendre();
    onglet(noeud, "Durée").click();
    assert.equal(texteDe(panneau(noeud)), "La durée se choisit pour un effet de l'onglet Cible.");
    // Un genre de l'onglet Cible choisi : la Durée offre ses options, la choisie part dans les valeurs.
    onglet(noeud, "Cible").click();
    leBouton(panneau(noeud), "Attaque de la cible").click();
    onglet(noeud, "Durée").click();
    // La valeur par défaut de la Durée est entrée d'elle-même dans le choix, qui est reparti une fois.
    assert.deepEqual(appels.slice(-2).map((appel) => appel.choisi.valeurs), [{ sur: "adv5", n: -2 }, { sur: "adv5", n: -2, duree: "tour" }]);
    assert.deepEqual(tous(panneau(noeud), "button").map((b) => [texteDe(b), presse(b)]), [["ce jet", "false"], ["jusqu'au prochain tour d'Aubépine", "true"], ["jusqu'à la fin du combat", "false"]]);
    leBouton(panneau(noeud), "jusqu'à la fin du combat").click();
    assert.deepEqual(appels.at(-1).choisi, { genre: "attaque", valeurs: { sur: "adv5", n: -2, duree: "combat" }, x: null });
    assert.equal(presse(leBouton(panneau(noeud), "jusqu'à la fin du combat")), "true");
  });
});

test("palette — un genre : son bouton, enfoncé quand il est choisi ; inactif, sa raison, et rien ne part ; choisi, le choix part à l'écran avec les valeurs par défaut de la vue, et ses champs paraissent ; un genre inactif éteint ses champs ; un genre réservé au MJ ne paraît pas sans lui", () => {
  avecLaPalette(({ noeud, rendre, palette, appels }) => {
    rendre();
    const avantages = leBouton(panneau(noeud), "Avantages");
    assert.equal(raisonDe(noeud, avantages), "Aucun dé lancé.");
    avantages.click();
    assert.deepEqual(appels, [], "inactif, rien ne part");
    leBouton(panneau(noeud), "Inverser").click();
    assert.deepEqual(appels, [{ choisi: { genre: "inverser", valeurs: {}, x: null } }]);
    assert.deepEqual(palette.choisi(), { genre: "inverser", valeurs: {}, x: null });
    assert.equal(presse(leBouton(panneau(noeud), "Inverser")), "true");
    // Le choix rendu par l'écran : l'aperçu, et « Appliquer » actif.
    assert.equal(texteDe(noeud.querySelector(".combat-palette-apercu")), "Le journal écrira : inverser.");
    assert.equal(leBouton(noeud.querySelector(".combat-pied"), "Appliquer").getAttribute("aria-disabled"), null);
    // Le même genre, de nouveau : rien ne repart.
    leBouton(panneau(noeud), "Inverser").click();
    assert.equal(appels.length, 1);
    // Un genre à valeurs par défaut : elles partent avec lui.
    onglet(noeud, "Dégâts").click();
    leBouton(panneau(noeud), "×k").click();
    assert.deepEqual(appels.at(-1).choisi, { genre: "multiplier", valeurs: { k: 2 }, x: null });
    assert.equal(tous(panneau(noeud), "input[type=number]").length, 1, "les champs du genre choisi, seuls");

    // Le genre choisi devient inactif (un dé de plus) : ses champs s'éteignent, avec sa raison.
    rendre(vuePalette(palette.choisi(), { onglets: [{ cle: "degats", libelle: "Dégâts", genres: [{ ...MULTIPLIER, actif: false, raison: "Aucuns dégâts calculés." }] }] }));
    const k = panneau(noeud).querySelector("input[type=number]");
    assert.equal(k.getAttribute("aria-disabled"), "true");
    assert.ok(texteDe(panneau(noeud)).includes("Aucuns dégâts calculés."));
    const avant = appels.length;
    k.value = "3";
    k.declencher("change");
    assert.equal(appels.length, avant, "un champ éteint ne remonte rien");

    // Réservé au MJ : caché sans lui, montré avec.
    const mj = { ...INVERSER, mj: true, libelle: "Inverser (MJ)" };
    rendre(vuePalette(null, { onglets: [{ cle: "des", libelle: "Dés", genres: [mj, REUSSITE] }] }));
    assert.equal(boutons(panneau(noeud), "Inverser").length, 0);
    rendre(vuePalette(null, { onglets: [{ cle: "des", libelle: "Dés", genres: [mj, REUSSITE] }] }), { modeMj: true });
    assert.equal(boutons(panneau(noeud), "Inverser (MJ)").length, 1);
  });
});

test("palette — chaque sorte de champ : une option (et le tuple de « rendre », étalé dans les valeurs) ; un nombre dans ses bornes, jamais une valeur exclue ; l'état du classeur par blocs, ou un état libre, l'un ou l'autre ; une case par demanderUneCase ; les cibles de toute la case", () => {
  avecLaPalette(({ noeud, rendre, appels }) => {
    rendre();
    const dernier = () => appels.filter((appel) => appel.choisi).at(-1).choisi;
    // Une option : la zone d'un d20.
    onglet(noeud, "Zone").click();
    leBouton(panneau(noeud), "Choisir la zone").click();
    assert.deepEqual(dernier(), { genre: "zone", valeurs: { de: 0 }, x: null });
    leBouton(panneau(noeud), "Jambe droite").click();
    assert.deepEqual(dernier().valeurs, { de: 0, zone: 2 });
    assert.equal(presse(leBouton(panneau(noeud), "Jambe droite")), "true");

    // « Rendre » : l'option est un tuple, qui s'étale ; l'inactive dit pourquoi.
    onglet(noeud, "Dégâts").click();
    leBouton(panneau(noeud), "Rendre N").click();
    assert.deepEqual(dernier().valeurs, { n: 1 });
    leBouton(panneau(noeud), "Souffle").click();
    assert.deepEqual(dernier().valeurs, { n: 1, sur: "pj1", ressource: "souffle" });
    assert.equal(presse(leBouton(panneau(noeud), "Souffle")), "true");
    const pleine = leBouton(panneau(noeud), "Endurance");
    assert.equal(raisonDe(noeud, pleine), "Déjà au maximum.");

    // Un nombre : ±N, de −5 à 5, jamais 0 ; hors de ses bornes, ou exclu, rien ne part, et la phrase le dit.
    onglet(noeud, "Cible").click();
    leBouton(panneau(noeud), "Attaque de la cible").click();
    assert.deepEqual(dernier(), { genre: "attaque", valeurs: { sur: "adv5", n: -2, duree: "tour" }, x: null });
    const cases = tous(panneau(noeud), ".combat-palette-groupe button").filter((b) => texteDe(b).startsWith("Marmiton de corvée n° 3"));
    assert.equal(texteDe(cases[0]), "Marmiton de corvée n° 3 D4", "chaque option de « sur » dit sa case");
    let n = panneau(noeud).querySelector("input[type=number]");
    assert.deepEqual([n.getAttribute("min"), n.getAttribute("max"), n.value], ["-5", "5", "-2"]);
    const combien = appels.length;
    for (const refuse of ["0", "6", "x"]) {
      n = panneau(noeud).querySelector("input[type=number]");
      n.value = refuse;
      n.declencher("change");
    }
    assert.equal(appels.length, combien, "rien ne part");
    assert.equal(n.getAttribute("aria-invalid"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${n.getAttribute("aria-describedby")}`)), "Un nombre entier de −5 à 5, sauf 0, est attendu.");
    n.value = "3";
    n.declencher("keydown", { key: "Enter", preventDefault() {} });
    assert.deepEqual(dernier().valeurs, { sur: "adv5", n: 3, duree: "tour" });

    // Un état : du classeur, par blocs ; ou libre ; l'un ou l'autre.
    leBouton(panneau(noeud), "Appliquer un état").click();
    assert.equal(texteDe(panneau(noeud).querySelector("h4")), "Condition (bloc du classeur)");
    leBouton(panneau(noeud), "Étourdi").click();
    assert.deepEqual(dernier().valeurs, { sur: "adv5", duree: "tour", capacite: "0:0" });
    const libre = panneau(noeud).querySelector("input[type=text]");
    assert.equal(libre.getAttribute("maxlength"), "40");
    libre.value = "  À terre ";
    libre.declencher("change");
    assert.deepEqual(dernier().valeurs, { sur: "adv5", duree: "tour", libre: "À terre" });
    leBouton(panneau(noeud), "En nage").click();
    assert.deepEqual(dernier().valeurs, { sur: "adv5", duree: "tour", capacite: "0:1" });

    // Une case : demanderUneCase, la case du protagoniste exclue, le nom de chaque case ; le rappel pose « vers ».
    leBouton(panneau(noeud), "Déplacer").click();
    leBouton(panneau(noeud), "Case d'arrivée").click();
    const demande = appels.at(-1).demanderUneCase;
    assert.equal(demande.exclue, "D4");
    assert.equal(demande.nommer("D5"), "Case D5 : y déplacer Marmiton de corvée n° 3");
    appels.at(-1).rappel("D5");
    assert.deepEqual(dernier().valeurs, { sur: "adv5", vers: "D5" });
    assert.equal(texteDe(leBouton(panneau(noeud), "Case d'arrivée")), "Case d'arrivée D5");

    // Les cibles de toute la case (F10) : la cible en cours en tête, cochée et fixe ; d'office les adversaires ; l'alliée, inactive, dit pourquoi.
    onglet(noeud, "Dégâts").click();
    leBouton(panneau(noeud), "Toute la case").click();
    assert.deepEqual(dernier().valeurs, { cibles: ["adv4", "adv5"] });
    const coches = tous(panneau(noeud), "[role=checkbox]");
    assert.deepEqual(coches.map((b) => [texteDe(b), b.getAttribute("aria-checked"), b.getAttribute("aria-disabled")]), [
      ["Marmiton de corvée n° 2 D4 · défense 5 · corps 10/10", "true", "true"],
      ["Marmiton de corvée n° 3 D4 · défense 5 · corps 10/10", "true", null],
      ["Aubépine Crèmebrûlée D4 · corps 10/10", "false", "true"],
    ]);
    assert.equal(raisonDe(noeud, coches[2]), JET_CONTRE_UN_ALLIE);
    assert.equal(texteDe(panneau(noeud).querySelector(".combat-jets-par-cible")), "Un jet par cible : 2 cibles");
    const avant = appels.length;
    coches[0].click();
    coches[2].click();
    assert.equal(appels.length, avant, "la première, fixe, et l'alliée ne bougent pas");
    tous(panneau(noeud), "[role=checkbox]")[1].click();
    assert.deepEqual(dernier().valeurs, { cibles: ["adv4"] });
    assert.equal(panneau(noeud).querySelector(".combat-jets-par-cible"), null, "une seule cible : une attaque ordinaire");
  });
});

test("palette — X (un passif au coût X) : saisi avant le genre, il entre dans le choix ; changé après, le choix repart ; sans X dans la vue, Choisi.x vaut null", () => {
  avecLaPalette(({ noeud, rendre, appels, palette }) => {
    const avecX = (choisi = null) => vuePalette(choisi, { x: { libelle: "X", min: 0, max: 4, valeur: choisi?.x ?? 0 } });
    rendre(avecX());
    const x = () => noeud.querySelector("label input[type=number]");
    assert.deepEqual([x().getAttribute("min"), x().getAttribute("max"), x().value], ["0", "4", "0"]);
    x().value = "3";
    x().declencher("change");
    assert.deepEqual(appels, [], "aucun genre encore : rien ne part");
    leBouton(panneau(noeud), "Inverser").click();
    assert.deepEqual(appels.at(-1).choisi, { genre: "inverser", valeurs: {}, x: 3 });
    // L'écran rend la vue de ce choix.
    rendre(avecX(palette.choisi()));
    x().value = "1";
    x().declencher("change");
    assert.deepEqual(appels.at(-1).choisi, { genre: "inverser", valeurs: {}, x: 1 });
    x().value = "5";
    x().declencher("change");
    assert.equal(appels.length, 2, "au-delà de la borne, rien ne part");
  }, { vue: (choisi) => vuePalette(choisi, { x: { libelle: "X", min: 0, max: 4, valeur: choisi?.x ?? 0 } }) });
});

test("palette — la source : sa phrase hors Mode MJ ; en Mode MJ, la phrase du MJ et les sources au choix, qui changent la source par l'écran ; la choisie ne fait rien", () => {
  avecLaPalette(({ noeud, rendre, appels }) => {
    rendre();
    assert.equal(texteDe(noeud.children[3]), "Source : Frappe, la capacité jouée (en Mode MJ, elle se change).");
    assert.equal(boutons(noeud, "MJ").length, 0, "hors Mode MJ, pas de source au choix");
    rendre(undefined, { modeMj: true });
    assert.equal(texteDe(noeud.children[3]), "Source : Frappe (par défaut) · changer");
    const groupe = noeud.children[4];
    assert.equal(groupe.getAttribute("role"), "group");
    assert.equal(groupe.getAttribute("aria-labelledby"), noeud.children[3].id);
    assert.deepEqual(tous(groupe, "button").map((b) => [texteDe(b), presse(b)]), [["Frappe (Aubépine)", "true"], ["MJ", "false"]]);
    leBouton(groupe, "Frappe").click();
    leBouton(groupe, "MJ").click();
    assert.deepEqual(appels, [{ source: { genre: "mj" } }]);
  });
});

test("palette — « Appliquer » émet la commande de la vue depuis la palette ; « Fermer » appelle fermerLaPalette ; une vue sans « Appliquer » dit que le choix est remis à zéro ; la croix d'un effet en cours le retire, en Mode MJ seulement", () => {
  avecLaPalette(({ noeud, rendre, appels, palette }) => {
    rendre();
    leBouton(noeud.querySelector(".combat-pied"), "Appliquer").click();
    assert.deepEqual(appels, [], "rien de choisi : rien ne part");
    leBouton(panneau(noeud), "Inverser").click();
    leBouton(noeud.querySelector(".combat-pied"), "Appliquer").click();
    assert.deepEqual(appels.at(-1), { executer: { evenement: { type: "effet", genre: "inverser", source: FRAPPE } }, origine: "palette" });
    // L'effet accepté, l'écran remet le choix à zéro : sa vue n'a plus d'« Appliquer ».
    rendre(vuePalette(null));
    assert.equal(palette.choisi(), null);
    assert.equal(presse(leBouton(panneau(noeud), "Inverser")), "false");
    // Un « Appliquer » refusé par la vue : inactif, sa raison.
    rendre(vuePalette({ genre: "inverser", valeurs: {}, x: null }, { appliquer: { libelle: "Appliquer", actif: false, raison: "Ce dé est déjà inversé.", commande: null } }));
    const appliquer = leBouton(noeud.querySelector(".combat-pied"), "Appliquer");
    assert.equal(raisonDe(noeud, appliquer), "Ce dé est déjà inversé.");
    leBouton(noeud.querySelector(".combat-pied"), "Fermer").click();
    assert.deepEqual(appels.at(-1), { fermer: true });

    // La croix d'un état en cours : en Mode MJ seulement, nommée par la vue, émise depuis la palette.
    assert.equal(tous(noeud, ".combat-palette-effets button").length, 0);
    rendre(undefined, { modeMj: true });
    const croix = tous(noeud, ".combat-palette-effets button");
    assert.equal(croix.length, 1, "un état seul a la sienne");
    assert.equal(croix[0].getAttribute("aria-label"), "Retirer l'état Étourdi");
    assert.equal(croix[0].textContent, String.fromCodePoint(0x2715));
    croix[0].click();
    assert.deepEqual(appels.at(-1), { executer: RETIRER.commande, origine: "palette" });
  });
});

test("palette — refaite pendant une saisie, le focus revient au champ de même clé, sans défiler ; au téléphone comme sur PC, elle porte sa tête et son pied ; un nom hostile reste du texte", () => {
  avecLaPalette(({ noeud, rendre }) => {
    rendre();
    onglet(noeud, "Cible").click();
    leBouton(panneau(noeud), "Attaque de la cible").click();
    const n = panneau(noeud).querySelector("input[type=number]");
    n.focus({ preventScroll: true });
    n.value = "4";
    n.declencher("change");
    const neuf = panneau(noeud).querySelector("input[type=number]");
    assert.notEqual(neuf, n, "refaite : la vue du choix a changé");
    memeNoeud(globalThis.document.activeElement, neuf, "le focus, au champ de même clé");
    assert.deepEqual(globalThis.document.focalisations.at(-1).options, { preventScroll: true });
  });
  avecLaPalette(
    ({ noeud, rendre }) => {
      rendre();
      assert.equal(texteDe(noeud.querySelector("h2")), "Effet de Frappe");
      assert.deepEqual(tous(noeud.querySelector(".combat-pied"), "button").map(texteDe), ["Fermer", "Appliquer"]);
    },
    { etroit: true },
  );
  avecLaPalette(({ noeud, rendre }) => {
    const balise = "<img src=x onerror=alert(1)>";
    const renverse = String.fromCodePoint(0x202e);
    rendre(vuePalette(null, { titre: `${renverse}${balise}`, texte: balise, effetsEnCours: [{ id: null, genre: "etat", nom: balise, duree: balise, couleur: "alerte", retirer: null }], onglets: [{ cle: "des", libelle: balise, genres: [genre("inverser", `${renverse}${balise}`)] }] }));
    assert.equal(tous(noeud, "img").length, 0);
    assert.equal(texteDe(noeud.querySelector("h2")), balise);
    assert.equal(noeud.textContent.includes(renverse), false);
  });
});

test("combat_palette.js — dom.js seul ; sa signature ; tout focus sans défiler, aucun défilement ; ni style, ni HTML inséré, ni écouteur global ; ni disabled, ni région ; ses classes, celles du contrat ; ses signes par leur code ; son en-tête dit le § 17 et le contrat", () => {
  const source = readFileSync(new URL("../js/ecrans/combat_palette.js", import.meta.url), "utf8");
  const entete = source.slice(0, source.search(/^import /m));
  assert.match(entete, /SPECIFICATION\.md, § 17/);
  assert.match(entete, /contrat\r?\n?\/?\/? ?de la vague 3, § 3\.6 et § 4\.1/);
  assert.deepEqual([...source.matchAll(/^import .* from "(.*)";\r?$/gm)].map(([, chemin]) => chemin), ["./dom.js"]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.match(source, /^export function creer\(actions\) \{/m);
  assert.deepEqual([...source.matchAll(/^export /gm)].length, 1, "un seul export");
  const focus = [...source.matchAll(/\.focus\(([^)]*)\)/g)].map(([, options]) => options);
  assert.ok(focus.length > 0);
  for (const options of focus) assert.equal(options, "{ preventScroll: true }");
  assert.doesNotMatch(source, /scrollIntoView|scrollTo\b|scrollBy|window\.scroll|scrollTop\s*=/);
  assert.doesNotMatch(source, /\.style\b|\bstyle\s*[:=]|setAttribute\(\s*["']style|cssText|setProperty/);
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write/);
  assert.doesNotMatch(source, /\b(?:window|globalThis|document)\s*\.\s*addEventListener/);
  assert.doesNotMatch(source, /aria-live|role\s*[:=]\s*["'](?:status|alert)|\bdisabled\s*:/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|matchMedia|lecture_mj|\.\.\/combat\//, "aucune règle, aucune vue, aucun stockage : la vue vient de l'écran");
  // Ses classes : celles du contrat (§ 5.1), et celles du site et du combat d'avant.
  const classes = [...source.matchAll(/classe(?:: |\s*=\s*)"([^"]+)"/g)].flatMap(([, liste]) => liste.split(" "));
  const PERMISES = new Set(["combat-palette", "combat-palette-texte", "combat-palette-onglets", "combat-palette-groupe", "combat-palette-apercu", "combat-palette-effets", "combat-pied", "combat-jets-par-cible", "combat-cible-detail", "combat-capacite", "combat-sous", "combat-raison", "combat-refus", "bouton", "secondaire", "champ"]);
  assert.deepEqual(classes.filter((classe) => !PERMISES.has(classe)), []);
  for (const code of [0xa0, 0x202f, 0x2715, 0x2212]) assert.equal(source.includes(String.fromCodePoint(code)), false, `U+${code.toString(16)} par son code`);
  assert.ok(source.includes(`"${"\\"}u2715"`), "la croix écrite par son code");
});
