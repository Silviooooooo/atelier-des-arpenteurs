// Contrôles de la préparation du combat, dans un document simulé
// (SPECIFICATION.md, § 17 et § 11 ; mission du lot 4, § 10.7).
//
// La partie se contrôle seule, sur des vues écrites à la main à la forme de
// vuePreparation : ce qu'elle montre, ce que chaque bouton rend à l'écran,
// un bouton inactif qui ne fait rien et dit pourquoi, les nœuds gardés d'un
// rendu à l'autre quand leur vue n'a pas changé, refaits quand elle a
// changé. Les noms viennent de la démonstration. La mise en page se regarde
// dans un vrai navigateur.
//
// Au groupe 2 (contrat du groupe 2, § 8.8, § 9.9, § 9.11 et § 14, É4) : le
// bouton « Ajouter le personnage de démonstration », en démonstration
// seulement, que la liste soit vide, pleine ou attendue ; la zone de sa
// question, qui survit à tout rendu ; la phrase que l'écran passe ; le lien
// de la raison de la rencontre vers #/rencontre ; le focus sans défiler.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_preparation.js");
const SOURCE = readFileSync(new URL("../js/ecrans/combat_preparation.js", import.meta.url), "utf8");

const DEJA = "Ce personnage est déjà dans le combat.";
// La raison d'une rencontre vide, et son lien, à la forme de vuePreparation (contrat du groupe 2, § 8.8).
const COMPOSEZ = "Composez d'abord une rencontre à l'écran Rencontre.";
const LIEN = { avant: "Composez d'abord une rencontre à l'", texte: "écran Rencontre", apres: ".", adresse: "#/rencontre" };
const IL_FAUT = "Il faut au moins un personnage et un adversaire.";
const AJOUTER_LA_DEMONSTRATION = "Ajouter le personnage de démonstration";
// La phrase que l'écran passe quand le personnage de démonstration est gardé (contrat, annexe B, 15).
const GARDE = "Le personnage « Aubépine Crèmebrûlée » est sur cet appareil.";
const EN_DEMONSTRATION = { demonstration: true, phraseDeDemonstration: null };

/** Une vue de préparation, à la forme de vuePreparation ; « retouches » en remplace des morceaux. */
function vueDe(retouches = {}) {
  return {
    personnages: {
      attente: false,
      phrases: [],
      options: [
        { cle: "p-aubepine", nom: "Aubépine Crèmebrûlée", actif: true, raison: null },
        { cle: "p-basile", nom: "Basile Croûton", actif: true, raison: null },
      ],
    },
    adversaires: {
      options: [
        { nom: "Chef de partie", actif: true, raison: null, max: 12 },
        { nom: "Marmiton de corvée", actif: true, raison: null, max: 12 },
      ],
      vide: null,
    },
    rencontre: { actif: false, raison: COMPOSEZ, lien: LIEN },
    quiCommence: [
      { camp: "pj", libelle: "Les PJ", choisi: true, commande: { preparer: { type: "qui_commence", camp: "pj" } } },
      { camp: "adv", libelle: "Les adversaires", choisi: false, commande: { preparer: { type: "qui_commence", camp: "adv" } } },
    ],
    lancer: { actif: false, raison: IL_FAUT },
    absents: null,
    avertissements: [],
    ...retouches,
  };
}

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
      ajouterLaDemonstration: noter("ajouterLaDemonstration"),
    },
  };
}

/** Une préparation posée dans la page, et de quoi la défaire ; « ecran » est la mémoire que l'écran lui passe. */
function monter(vue = vueDe(), ecran = {}) {
  const retirer = installerDom();
  const { appels, actions } = actionsEspionnes();
  const partie = creer(actions);
  document.body.append(partie.noeud);
  if (vue) partie.rendre(vue, ecran);
  return { partie, appels, retirer };
}

/** Les classes des enfants de la section, dans l'ordre du document. */
const ordreDesBlocs = (partie) => partie.noeud.children.map((enfant) => enfant.className || enfant.tagName);
const BLOCS = [
  "H2",
  "combat-preparation-bloc combat-preparation-personnages",
  "combat-preparation-bloc combat-preparation-adversaires",
  "combat-preparation-bloc combat-preparation-rencontre",
  "combat-preparation-bloc combat-preparation-commence",
  "combat-preparation-bloc combat-preparation-lancer",
  "combat-preparation-bloc combat-preparation-notes",
  "combat-case-liste",
];
const BLOCS_EN_DEMONSTRATION = [...BLOCS.slice(0, 2), "combat-preparation-demonstration", ...BLOCS.slice(2)];

/** Relève les nœuds retirés de leur parent : un nœud retiré puis remis perd le focus dans un navigateur. */
function releverLesRetraits(noeuds) {
  const retires = [];
  for (const noeud of noeuds) {
    const retirer = noeud.remove;
    noeud.remove = function retire() {
      if (this.parentNode) retires.push(this);
      return retirer.call(this);
    };
  }
  return retires;
}

const repere = (partie, nom) => partie.noeud.querySelector(`[data-repere=${nom}]`);
const inactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";
/** La raison liée à un bouton : le nœud que nomme son aria-describedby. */
const raisonDe = (partie, bouton) => partie.noeud.querySelector(`#${bouton.getAttribute("aria-describedby")}`);
/** Choisit une option d'une liste, comme le ferait la personne. */
function choisir(liste, rang) {
  liste.value = String(rang);
  liste.declencher("change");
}
function saisir(champ, texte) {
  champ.value = texte;
  champ.declencher("input");
}

test("la préparation montre ce que la mission lui donne à porter", () => {
  const { partie, retirer } = monter();
  try {
    const { noeud } = partie;
    assert.equal(noeud.tagName, "SECTION");
    assert.equal(noeud.className, "combat-preparation");
    assert.equal(noeud.getAttribute("aria-label"), "Avant le combat");
    assert.equal(texteDe(noeud.querySelector("h2")), "Avant le combat");
    assert.equal(noeud.querySelectorAll("h1").length, 0, "le titre de l'écran est à la barre");

    const personnages = repere(partie, "personnage");
    assert.equal(personnages.tagName, "SELECT");
    assert.deepEqual([...personnages.querySelectorAll("option")].map(texteDe), ["Aubépine Crèmebrûlée", "Basile Croûton"]);
    assert.equal(texteDe(noeud.querySelector(`label[for=${personnages.id}]`)), "Personnage");

    const adversaires = repere(partie, "adversaire");
    assert.deepEqual([...adversaires.querySelectorAll("option")].map(texteDe), ["Chef de partie", "Marmiton de corvée"]);
    assert.equal(texteDe(noeud.querySelector(`label[for=${adversaires.id}]`)), "Adversaire");
    const nombre = repere(partie, "nombre");
    assert.equal(nombre.value, "1");
    assert.equal(texteDe(noeud.querySelector(`label[for=${nombre.id}]`)), "Exemplaires");

    assert.equal(texteDe(repere(partie, "ajouter-personnage")), "Ajouter");
    assert.equal(texteDe(repere(partie, "ajouter-adversaires")), "Ajouter");
    assert.equal(texteDe(repere(partie, "rencontre")), "Placer la rencontre préparée");
    assert.equal(texteDe(repere(partie, "lancer")), "Lancer le combat");
    const groupe = noeud.querySelector("[role=group]");
    assert.equal(texteDe(groupe.querySelector("span")), "Qui commence");
    assert.equal(groupe.getAttribute("aria-labelledby"), groupe.querySelector("span").id);
    assert.deepEqual([...groupe.querySelectorAll("button")].map(texteDe), ["Les PJ", "Les adversaires"]);

    // Chaque bloc a sa classe, dans l'ordre du document : la feuille de style range « Qui commence » et « Lancer le
    // combat » sur une rangée, comme la barre de la maquette, et donne sa ligne à l'intitulé sur un téléphone.
    assert.deepEqual(
      noeud.children.map((enfant) => enfant.className || enfant.tagName),
      [
        "H2",
        "combat-preparation-bloc combat-preparation-personnages",
        "combat-preparation-bloc combat-preparation-adversaires",
        "combat-preparation-bloc combat-preparation-rencontre",
        "combat-preparation-bloc combat-preparation-commence",
        "combat-preparation-bloc combat-preparation-lancer",
        "combat-preparation-bloc combat-preparation-notes",
        "combat-case-liste",
      ],
    );
    assert.equal(groupe.parentNode.className, "combat-preparation-bloc combat-preparation-commence");
    assert.equal(groupe.className, "combat-ligne");
    assert.equal(groupe.children[0].tagName, "SPAN", "l'intitulé est le premier enfant de sa rangée : c'est lui que la feuille met sur sa ligne");
    assert.equal(repere(partie, "lancer").parentNode.parentNode.className, "combat-preparation-bloc combat-preparation-lancer");

    // Toute classe est du combat, ou une classe commune du site ; aucune ne
    // touche à la carte d'adversaire.
    const communes = ["champ", "bouton", "secondaire", "secondaire-texte", "petit", "message"];
    const classes = [noeud, ...noeud.descendants()].flatMap((element) => element.className.split(/\s+/).filter(Boolean));
    for (const classe of classes) {
      assert.ok(classe.startsWith("combat-") || communes.includes(classe), `classe inattendue : ${classe}`);
      assert.ok(!classe.includes("carte"), `classe inattendue : ${classe}`);
    }
    assert.ok(classes.includes("combat-ligne") && classes.includes("combat-case-liste"));

    for (const bouton of noeud.querySelectorAll("button")) assert.equal(bouton.getAttribute("type"), "button");
    // Aucun bouton ne s'éteint par « disabled » : il sortirait du clavier.
    assert.equal(noeud.querySelectorAll("[disabled]").length, 0);
    // La seule région polie de l'écran est celle des dés, ailleurs.
    assert.equal(noeud.querySelectorAll("[aria-live]").length, 0);
    assert.equal(noeud.querySelectorAll("[role=status]").length, 0);
    assert.equal(noeud.querySelectorAll("[role=alert]").length, 0);
    assert.equal(noeud.querySelectorAll("[data-chargement]").length, 0);
    assert.equal(noeud.querySelectorAll("[data-focus]").length, 0, "data-focus est au panneau d'action");
  } finally {
    retirer();
  }
});

test("la liste « +k » d'une case : un nœud stable, vide, que l'écran remplit", () => {
  const { partie, retirer } = monter(null);
  try {
    const { listeDeCase, noeud } = partie;
    assert.equal(listeDeCase.className, "combat-case-liste");
    assert.equal(listeDeCase.parentNode, noeud);
    assert.equal(noeud.children.at(-1), listeDeCase, "sous le reste de la préparation");
    assert.equal(listeDeCase.childNodes.length, 0, "vide, il s'efface de lui-même");
    const jeton = document.createElement("button");
    listeDeCase.append(jeton);
    partie.rendre(vueDe(), {});
    partie.rendre(vueDe({ lancer: { actif: true, raison: null } }), {});
    assert.equal(noeud.children.at(-1), listeDeCase);
    assert.deepEqual(listeDeCase.children, [jeton], "un rendu n'y touche pas");
  } finally {
    retirer();
  }
});

test("ajouter un personnage : celui de la liste, par sa clé", () => {
  const { partie, appels, retirer } = monter();
  try {
    const ajouter = repere(partie, "ajouter-personnage");
    assert.equal(inactif(ajouter), false);
    assert.equal(raisonDe(partie, ajouter).hidden, true);
    ajouter.click();
    assert.deepEqual(appels, [["ajouterPersonnage", "p-aubepine"]]);
    choisir(repere(partie, "personnage"), 1);
    ajouter.click();
    assert.deepEqual(appels.at(-1), ["ajouterPersonnage", "p-basile"]);
    assert.equal(appels.length, 2);
  } finally {
    retirer();
  }
});

test("un personnage qui ne s'ajoute pas : le bouton ne fait rien, et dit pourquoi", () => {
  const refus = "Ne s'ajoute pas : l'arme tenue n'a pas de dé.";
  const { partie, appels, retirer } = monter(
    vueDe({
      personnages: {
        attente: false,
        phrases: [],
        options: [
          { cle: "p-aubepine", nom: "Aubépine Crèmebrûlée", actif: false, raison: DEJA },
          { cle: "p-basile", nom: "Basile Croûton", actif: true, raison: null },
          { cle: "p-colin", nom: "Colin Pané", actif: false, raison: refus },
        ],
      },
    }),
  );
  try {
    const liste = repere(partie, "personnage");
    const ajouter = repere(partie, "ajouter-personnage");
    assert.deepEqual([...liste.querySelectorAll("option")].map(texteDe), ["Aubépine Crèmebrûlée (ne s'ajoute pas)", "Basile Croûton", "Colin Pané (ne s'ajoute pas)"]);
    assert.equal(liste.querySelectorAll("option[disabled]").length, 0, "une option éteinte ne dirait jamais sa raison");
    assert.equal(liste.value, "1", "d'office, le premier qui peut s'ajouter");
    assert.equal(inactif(ajouter), false);

    choisir(liste, 2);
    assert.equal(inactif(ajouter), true);
    assert.equal(texteDe(raisonDe(partie, ajouter)), refus);
    assert.equal(raisonDe(partie, ajouter).hidden, false);
    ajouter.click();
    assert.deepEqual(appels, []);

    choisir(liste, 0);
    assert.equal(texteDe(raisonDe(partie, ajouter)), DEJA);
    ajouter.click();
    assert.deepEqual(appels, []);

    // Dans l'autre sens : le bouton se rallume, la raison s'efface.
    choisir(liste, 1);
    assert.equal(inactif(ajouter), false);
    assert.equal(ajouter.hasAttribute("aria-disabled"), false);
    assert.equal(texteDe(raisonDe(partie, ajouter)), "");
    assert.equal(raisonDe(partie, ajouter).hidden, true);
    ajouter.click();
    assert.deepEqual(appels, [["ajouterPersonnage", "p-basile"]]);
  } finally {
    retirer();
  }
});

test("les personnages en ligne : une attente, puis la liste ; une phrase si la lecture échoue", () => {
  const { partie, appels, retirer } = monter(vueDe({ personnages: { attente: true, phrases: [], options: [] } }));
  try {
    const bloc = partie.noeud.children[1];
    assert.equal(texteDe(bloc), "Lecture des personnages en ligne…");
    assert.equal(repere(partie, "personnage"), null);
    assert.equal(repere(partie, "ajouter-personnage"), null);
    // L'attente ne retient que l'ajout d'un personnage.
    repere(partie, "ajouter-adversaires").click();
    assert.deepEqual(appels, [["ajouterAdversaires", "Chef de partie", 1]]);

    const phrase = "Les personnages en ligne n'ont pas pu être lus : voici ceux de cet appareil.";
    partie.rendre(vueDe({ personnages: { attente: false, phrases: [phrase], options: vueDe().personnages.options } }), {});
    assert.equal(bloc.parentNode, partie.noeud);
    assert.ok(!texteDe(bloc).includes("Lecture des personnages"));
    assert.deepEqual([...repere(partie, "personnage").querySelectorAll("option")].map(texteDe), ["Aubépine Crèmebrûlée", "Basile Croûton"]);
    assert.ok(texteDe(bloc).endsWith(phrase), "la phrase suit la liste");

    partie.rendre(vueDe(), {});
    assert.ok(!texteDe(bloc).includes(phrase));
  } finally {
    retirer();
  }
});

test("sans personnage à ajouter : une phrase, et le chemin de l'écran Personnages", () => {
  const { partie, retirer } = monter(vueDe({ personnages: { attente: false, phrases: [], options: [] } }));
  try {
    const bloc = partie.noeud.children[1];
    assert.equal(texteDe(bloc), "Aucun personnage enregistré à ajouter. Un personnage se crée et s'enregistre à l'écran Personnages.");
    assert.equal(bloc.querySelector("a").getAttribute("href"), "#/personnages");
    assert.equal(repere(partie, "personnage"), null);
    assert.equal(repere(partie, "ajouter-personnage"), null);
  } finally {
    retirer();
  }
});

test("ajouter des adversaires : le nom choisi, et le nombre d'exemplaires", () => {
  const { partie, appels, retirer } = monter();
  try {
    const ajouter = repere(partie, "ajouter-adversaires");
    const nombre = repere(partie, "nombre");
    assert.equal(nombre.getAttribute("type"), "number");
    assert.equal(nombre.getAttribute("min"), "1");
    assert.equal(nombre.getAttribute("max"), "12");
    ajouter.click();
    assert.deepEqual(appels, [["ajouterAdversaires", "Chef de partie", 1]]);
    choisir(repere(partie, "adversaire"), 1);
    saisir(nombre, " 2 ");
    ajouter.click();
    assert.deepEqual(appels.at(-1), ["ajouterAdversaires", "Marmiton de corvée", 2]);
    assert.equal(typeof appels.at(-1)[2], "number");
  } finally {
    retirer();
  }
});

test("le nombre d'exemplaires tient dans ses bornes, des deux côtés", () => {
  const { partie, appels, retirer } = monter(
    vueDe({
      adversaires: {
        options: [
          { nom: "Chef de partie", actif: true, raison: null, max: 3 },
          { nom: "Marmiton de corvée", actif: true, raison: null, max: 1 },
        ],
        vide: null,
      },
    }),
  );
  try {
    const ajouter = repere(partie, "ajouter-adversaires");
    const nombre = repere(partie, "nombre");
    const raison = raisonDe(partie, ajouter);
    for (const texte of ["0", "4", "", "abc", "2,5", "1.5", "-1", "1e1", "99999"]) {
      saisir(nombre, texte);
      assert.equal(inactif(ajouter), true, `« ${texte} » n'est pas un nombre d'exemplaires`);
      assert.equal(texteDe(raison), "Le nombre d'exemplaires va de 1 à 3.");
      assert.equal(raison.hidden, false);
      ajouter.click();
    }
    assert.deepEqual(appels, []);
    for (const [texte, attendu] of [["1", 1], ["3", 3], ["02", 2]]) {
      saisir(nombre, texte);
      assert.equal(inactif(ajouter), false, `« ${texte} » est permis`);
      assert.equal(raison.hidden, true);
      ajouter.click();
      assert.deepEqual(appels.at(-1), ["ajouterAdversaires", "Chef de partie", attendu]);
    }
    assert.equal(appels.length, 3);

    // La borne suit l'adversaire choisi : le nombre saisi, lui, reste.
    saisir(nombre, "2");
    choisir(repere(partie, "adversaire"), 1);
    assert.equal(nombre.getAttribute("max"), "1");
    assert.equal(nombre.value, "2");
    assert.equal(inactif(ajouter), true);
    assert.equal(texteDe(raison), "Un seul exemplaire peut encore s'ajouter.");
    ajouter.click();
    assert.equal(appels.length, 3);
    saisir(nombre, "1");
    ajouter.click();
    assert.deepEqual(appels.at(-1), ["ajouterAdversaires", "Marmiton de corvée", 1]);
  } finally {
    retirer();
  }
});

test("un adversaire qui ne s'ajoute pas : le bouton ne fait rien, et dit pourquoi", () => {
  const plafond = "Le combat a déjà 12 exemplaires de cet adversaire.";
  const incomplet = "Ne s'ajoute pas : cet adversaire est incomplet.";
  const { partie, appels, retirer } = monter(
    vueDe({
      adversaires: {
        options: [
          { nom: "Chef de partie", actif: false, raison: plafond, max: 0 },
          { nom: "Marmiton de corvée", actif: true, raison: null, max: 12 },
          { nom: "Plongeur distrait", actif: false, raison: incomplet, max: 12 },
        ],
        vide: null,
      },
    }),
  );
  try {
    const liste = repere(partie, "adversaire");
    const ajouter = repere(partie, "ajouter-adversaires");
    assert.deepEqual([...liste.querySelectorAll("option")].map(texteDe), ["Chef de partie (ne s'ajoute pas)", "Marmiton de corvée", "Plongeur distrait (ne s'ajoute pas)"]);
    assert.equal(liste.value, "1");
    assert.equal(inactif(ajouter), false);

    choisir(liste, 0);
    assert.equal(inactif(ajouter), true);
    assert.equal(texteDe(raisonDe(partie, ajouter)), plafond, "la raison de la vue passe avant celle du nombre");
    ajouter.click();
    choisir(liste, 2);
    assert.equal(texteDe(raisonDe(partie, ajouter)), incomplet);
    ajouter.click();
    assert.deepEqual(appels, []);

    choisir(liste, 1);
    assert.equal(inactif(ajouter), false);
    ajouter.click();
    assert.deepEqual(appels, [["ajouterAdversaires", "Marmiton de corvée", 1]]);
  } finally {
    retirer();
  }
});

test("une banque sans adversaires : la préparation le dit, sans liste ni bouton", () => {
  const phrase = "Cette banque n'a aucun adversaire.";
  const { partie, retirer } = monter(vueDe({ adversaires: { options: [], vide: phrase } }));
  try {
    const bloc = partie.noeud.children[2];
    assert.equal(texteDe(bloc), phrase);
    assert.equal(repere(partie, "adversaire"), null);
    assert.equal(repere(partie, "nombre"), null);
    assert.equal(repere(partie, "ajouter-adversaires"), null);
    // Dans l'autre sens : avec des adversaires, la phrase n'y est pas.
    partie.rendre(vueDe(), {});
    assert.ok(!texteDe(bloc).includes(phrase));
    assert.notEqual(repere(partie, "adversaire"), null);
  } finally {
    retirer();
  }
});

test("« Placer la rencontre préparée » : inactif tant qu'elle est vide ou qu'un plafond serait dépassé", () => {
  const { partie, appels, retirer } = monter();
  try {
    let placer = repere(partie, "rencontre");
    assert.equal(inactif(placer), true);
    assert.equal(texteDe(raisonDe(partie, placer)), COMPOSEZ);
    assert.equal(raisonDe(partie, placer).hidden, false);
    placer.click();
    assert.deepEqual(appels, []);

    const plafond = "La rencontre porterait le combat au-delà de 60 adversaires.";
    partie.rendre(vueDe({ rencontre: { actif: false, raison: plafond } }), {});
    placer = repere(partie, "rencontre");
    assert.equal(texteDe(raisonDe(partie, placer)), plafond);
    placer.click();
    assert.deepEqual(appels, []);

    partie.rendre(vueDe({ rencontre: { actif: true, raison: null } }), {});
    placer = repere(partie, "rencontre");
    assert.equal(inactif(placer), false);
    assert.equal(raisonDe(partie, placer).hidden, true);
    placer.click();
    assert.deepEqual(appels, [["placerRencontre"]]);
  } finally {
    retirer();
  }
});

test("la raison d'une rencontre vide mène à l'écran Rencontre : « écran Rencontre » est un lien vers #/rencontre", () => {
  const { partie, appels, retirer } = monter();
  try {
    let placer = repere(partie, "rencontre");
    const raison = raisonDe(partie, placer);
    assert.equal(inactif(placer), true);
    assert.equal(raison.hidden, false);
    // Lue d'un trait (aria-describedby), c'est le texte entier de la vue.
    assert.equal(raison.textContent, COMPOSEZ);
    // Écrite en trois morceaux, le lien au milieu.
    assert.equal(raison.childNodes.length, 3);
    assert.deepEqual(raison.childNodes.map((morceau) => morceau.textContent), [LIEN.avant, LIEN.texte, LIEN.apres]);
    const liens = [...raison.querySelectorAll("a")];
    assert.equal(liens.length, 1);
    assert.equal(liens[0].getAttribute("href"), "#/rencontre");
    assert.equal(texteDe(liens[0]), "écran Rencontre");
    assert.equal(raison.childNodes[1], liens[0]);
    // Le lien n'est pas le bouton : le bouton inactif ne fait toujours rien.
    placer.click();
    assert.deepEqual(appels, []);

    // Une autre raison, sans lien : du texte seul.
    const plafond = "La rencontre porterait le combat au-delà de 60 adversaires.";
    partie.rendre(vueDe({ rencontre: { actif: false, raison: plafond, lien: null } }), {});
    placer = repere(partie, "rencontre");
    assert.equal(texteDe(raisonDe(partie, placer)), plafond);
    assert.equal(raisonDe(partie, placer).querySelectorAll("a").length, 0);
    // Le bouton actif : ni raison, ni lien.
    partie.rendre(vueDe({ rencontre: { actif: true, raison: null, lien: null } }), {});
    placer = repere(partie, "rencontre");
    assert.equal(raisonDe(partie, placer).hidden, true);
    assert.equal(raisonDe(partie, placer).childNodes.length, 0);
    assert.equal(partie.noeud.querySelectorAll("a[href=\"#/rencontre\"]").length, 0);
    // La rencontre de nouveau vide : le lien revient.
    partie.rendre(vueDe(), {});
    assert.equal(partie.noeud.querySelectorAll("a[href=\"#/rencontre\"]").length, 1);
  } finally {
    retirer();
  }
});

test("en démonstration, « Ajouter le personnage de démonstration » suit les personnages : liste pleine, vide, ou attendue", () => {
  const listes = {
    pleine: vueDe().personnages,
    vide: { attente: false, phrases: [], options: [] },
    attendue: { attente: true, phrases: [], options: [] },
  };
  for (const [nom, personnages] of Object.entries(listes)) {
    const { partie, appels, retirer } = monter(vueDe({ personnages }), EN_DEMONSTRATION);
    try {
      // Un bloc à part, juste après celui des personnages.
      assert.deepEqual(ordreDesBlocs(partie), BLOCS_EN_DEMONSTRATION, nom);
      const bloc = partie.noeud.children[2];
      assert.equal(bloc.tagName, "DIV");
      const bouton = repere(partie, "ajouter-demonstration");
      assert.equal(bouton.parentNode, bloc, nom);
      assert.equal(bouton.tagName, "BUTTON");
      assert.equal(bouton.getAttribute("type"), "button");
      assert.equal(bouton.className, "bouton secondaire");
      assert.equal(texteDe(bouton), AJOUTER_LA_DEMONSTRATION);
      assert.equal(inactif(bouton), false);
      // Sous le bouton, la zone de sa question, vide ; aucune phrase tant que l'écran n'en dit pas.
      const zone = partie.noeud.querySelector(".combat-preparation-question");
      assert.deepEqual(bloc.children, [bouton, zone], nom);
      assert.equal(zone.tagName, "DIV");
      assert.equal(zone.childNodes.length, 0);
      assert.equal(partie.noeud.querySelectorAll(".combat-preparation-phrase").length, 0);
      // Le clic donne la zone à l'écran, qui y ouvre la question ; rien n'entre au combat d'ici.
      bouton.click();
      assert.deepEqual(appels, [["ajouterLaDemonstration", zone]], nom);
      assert.equal(appels[0][1], zone);
    } finally {
      retirer();
    }
  }
  // La phrase « Aucun personnage enregistré… » précède le bloc ; l'attente aussi.
  const { partie, retirer } = monter(vueDe({ personnages: listes.vide }), EN_DEMONSTRATION);
  try {
    assert.ok(texteDe(partie.noeud.children[1]).startsWith("Aucun personnage enregistré à ajouter."));
    assert.equal(texteDe(partie.noeud.children[2]), AJOUTER_LA_DEMONSTRATION);
    partie.rendre(vueDe({ personnages: listes.attendue }), EN_DEMONSTRATION);
    assert.equal(texteDe(partie.noeud.children[1]), "Lecture des personnages en ligne…");
    assert.equal(texteDe(partie.noeud.children[2]), AJOUTER_LA_DEMONSTRATION);
  } finally {
    retirer();
  }
});

test("en mode réel, ni bouton de démonstration, ni zone, ni phrase", () => {
  for (const ecran of [{}, undefined, { demonstration: false, phraseDeDemonstration: GARDE }, { demonstration: "oui", phraseDeDemonstration: GARDE }]) {
    const retirer = installerDom();
    try {
      const { appels, actions } = actionsEspionnes();
      const partie = creer(actions);
      document.body.append(partie.noeud);
      for (const personnages of [vueDe().personnages, { attente: false, phrases: [], options: [] }]) {
        partie.rendre(vueDe({ personnages }), ecran);
        assert.deepEqual(ordreDesBlocs(partie), BLOCS, JSON.stringify(ecran));
        assert.equal(repere(partie, "ajouter-demonstration"), null);
        assert.equal(partie.noeud.querySelectorAll(".combat-preparation-demonstration").length, 0);
        assert.equal(partie.noeud.querySelectorAll(".combat-preparation-question").length, 0);
        assert.equal(partie.noeud.querySelectorAll(".combat-preparation-phrase").length, 0);
        assert.ok(!texteDe(partie.noeud).includes("démonstration"));
      }
      assert.deepEqual(appels, []);
    } finally {
      retirer();
    }
  }
});

test("la zone de la question survit à tout rendu : jamais refaite, jamais retirée, et le focus qu'elle tient reste", () => {
  const { partie, appels, retirer } = monter(vueDe(), EN_DEMONSTRATION);
  try {
    const zone = partie.noeud.querySelector(".combat-preparation-question");
    const bloc = zone.parentNode;
    const bouton = repere(partie, "ajouter-demonstration");
    const retraits = releverLesRetraits([zone, bloc, bouton]);
    // L'écran y ouvre la question de garderRecu, et son focus s'y pose.
    const garder = document.createElement("button");
    garder.textContent = "Garder les deux";
    zone.append(garder);
    garder.focus({ preventScroll: true });
    const focus = document.focalisations.length;

    // La liste se relit (un personnage de plus), la phrase paraît, puis change, puis s'en va ;
    // l'attente revient ; la rencontre et le lancement changent.
    const relue = { attente: false, phrases: [], options: [...vueDe().personnages.options, { cle: "p-demo", nom: "Aubépine Fleurdesel", actif: true, raison: null }] };
    partie.rendre(vueDe({ personnages: relue }), EN_DEMONSTRATION);
    partie.rendre(vueDe({ personnages: relue }), { demonstration: true, phraseDeDemonstration: GARDE });
    partie.rendre(vueDe({ personnages: { attente: true, phrases: [], options: [] } }), { demonstration: true, phraseDeDemonstration: GARDE });
    partie.rendre(vueDe({ personnages: relue, rencontre: { actif: true, raison: null, lien: null } }), { demonstration: true, phraseDeDemonstration: "Le personnage « Aubépine Fleurdesel » est sur cet appareil." });
    partie.rendre(vueDe({ lancer: { actif: true, raison: null } }), EN_DEMONSTRATION);

    assert.deepEqual(retraits, [], "ni la zone, ni son bloc, ni le bouton ne quittent la page");
    assert.equal(partie.noeud.querySelector(".combat-preparation-question"), zone);
    assert.equal(bloc.parentNode, partie.noeud);
    assert.equal(partie.noeud.children[2], bloc);
    assert.equal(repere(partie, "ajouter-demonstration"), bouton);
    assert.deepEqual(zone.children, [garder], "la question ouverte est toujours là");
    assert.equal(document.activeElement, garder);
    assert.equal(document.focalisations.length, focus, "personne ne reprend le focus à la question");
    // Le clic donne toujours la même zone.
    bouton.click();
    assert.deepEqual(appels, [["ajouterLaDemonstration", zone]]);
  } finally {
    retirer();
  }
});

test("la phrase de la démonstration : sous la zone quand l'écran en dit une, et elle seule change", () => {
  const { partie, retirer } = monter(vueDe(), EN_DEMONSTRATION);
  try {
    const bloc = partie.noeud.querySelector(".combat-preparation-demonstration");
    const [bouton, zone] = bloc.children;
    partie.rendre(vueDe(), { demonstration: true, phraseDeDemonstration: GARDE });
    const phrase = bloc.querySelector(".combat-preparation-phrase");
    assert.equal(phrase.tagName, "P");
    assert.equal(phrase.className, "combat-preparation-phrase");
    assert.equal(texteDe(phrase), GARDE);
    assert.deepEqual(bloc.children, [bouton, zone, phrase]);
    // Un autre personnage gardé : la même phrase, son texte changé.
    const autre = "Le personnage « Aubépine Fleurdesel » est sur cet appareil.";
    partie.rendre(vueDe(), { demonstration: true, phraseDeDemonstration: autre });
    assert.equal(bloc.querySelector(".combat-preparation-phrase"), phrase);
    assert.equal(texteDe(phrase), autre);
    // Rien à dire : rien d'écrit.
    for (const rien of [null, undefined, ""]) {
      partie.rendre(vueDe(), { demonstration: true, phraseDeDemonstration: rien });
      assert.equal(bloc.querySelectorAll(".combat-preparation-phrase").length, 0);
      assert.deepEqual(bloc.children, [bouton, zone]);
    }
    // Une phrase reste du texte, et ne commande pas le sens de l'écriture.
    const renverse = String.fromCodePoint(0x202e);
    partie.rendre(vueDe(), { demonstration: true, phraseDeDemonstration: `${renverse}<img src=x onerror=alert(1)>` });
    assert.equal(partie.noeud.querySelectorAll("img").length, 0);
    assert.equal(bloc.querySelector(".combat-preparation-phrase").textContent, "<img src=x onerror=alert(1)>");
    // Aucune région d'annonce : la seule de l'écran dit les dés.
    assert.equal(partie.noeud.querySelectorAll("[aria-live]").length, 0);
    assert.equal(partie.noeud.querySelectorAll("[role]").length, 1, "le seul rôle est celui du groupe « Qui commence »");
  } finally {
    retirer();
  }
});

test("« Qui commence » : le camp choisi est marqué, chaque bouton rend sa commande", () => {
  const { partie, appels, retirer } = monter();
  try {
    const vue = vueDe();
    assert.equal(repere(partie, "commence-pj").getAttribute("aria-pressed"), "true");
    assert.equal(repere(partie, "commence-adv").getAttribute("aria-pressed"), "false");
    repere(partie, "commence-adv").click();
    assert.deepEqual(appels, [["executer", vue.quiCommence[1].commande, "panneau"]]);
    repere(partie, "commence-pj").click();
    assert.deepEqual(appels.at(-1), ["executer", vue.quiCommence[0].commande, "panneau"]);

    // La marque suit la vue, pas le clic : c'est la séance qui tranche.
    assert.equal(repere(partie, "commence-pj").getAttribute("aria-pressed"), "true");
    partie.rendre(vueDe({ quiCommence: [{ ...vue.quiCommence[0], choisi: false }, { ...vue.quiCommence[1], choisi: true }] }), {});
    assert.equal(repere(partie, "commence-pj").getAttribute("aria-pressed"), "false");
    assert.equal(repere(partie, "commence-adv").getAttribute("aria-pressed"), "true");
  } finally {
    retirer();
  }
});

test("« Lancer le combat » : inactif avec sa raison, puis il lance", () => {
  const { partie, appels, retirer } = monter();
  try {
    let lancer = repere(partie, "lancer");
    assert.equal(inactif(lancer), true);
    assert.equal(texteDe(raisonDe(partie, lancer)), IL_FAUT);
    lancer.click();
    assert.deepEqual(appels, []);

    partie.rendre(vueDe({ lancer: { actif: true, raison: null } }), {});
    lancer = repere(partie, "lancer");
    assert.equal(inactif(lancer), false);
    assert.equal(texteDe(raisonDe(partie, lancer)), "");
    lancer.click();
    assert.deepEqual(appels, [["lancer"]]);
  } finally {
    retirer();
  }
});

test("la ligne des câblés absents et les avertissements des photographies", () => {
  const absents = "Câblés absents de la banque : petit, esprit de corps.";
  const avertissements = ["Aubépine Crèmebrûlée : la portée de « Jet de sel » ne se calcule pas, elle vaut 0.", "Chef de partie : le souffle est absent, il vaut 0."];
  const { partie, retirer } = monter();
  try {
    const bloc = partie.noeud.children[6];
    assert.equal(bloc.childNodes.length, 0, "rien à dire : rien d'écrit");
    assert.ok(!texteDe(partie.noeud).includes("Câblés absents"));

    partie.rendre(vueDe({ absents, avertissements }), {});
    assert.equal(texteDe(bloc.querySelector("p")), absents);
    assert.deepEqual([...bloc.querySelectorAll("li")].map(texteDe), avertissements);

    partie.rendre(vueDe({ absents }), {});
    assert.equal(texteDe(bloc), absents);
    assert.equal(bloc.querySelectorAll("ul").length, 0);

    partie.rendre(vueDe({ avertissements: avertissements.slice(0, 1) }), {});
    assert.equal(bloc.querySelectorAll("p").length, 0);
    assert.deepEqual([...bloc.querySelectorAll("li")].map(texteDe), avertissements.slice(0, 1));
  } finally {
    retirer();
  }
});

test("une vue qui n'a pas changé ne refait aucun nœud ; une vue qui a changé ne refait que son bloc", () => {
  const { partie, retirer } = monter();
  try {
    const noms = ["personnage", "ajouter-personnage", "adversaire", "nombre", "ajouter-adversaires", "rencontre", "commence-pj", "commence-adv", "lancer"];
    const releve = () => Object.fromEntries(noms.map((nom) => [nom, repere(partie, nom)]));
    const avant = releve();
    const blocs = [...partie.noeud.children];

    // La même vue, dans un objet neuf.
    partie.rendre(vueDe(), {});
    for (const nom of noms) assert.equal(repere(partie, nom), avant[nom], `${nom} est gardé`);

    // Seul « Lancer » change.
    partie.rendre(vueDe({ lancer: { actif: true, raison: null } }), {});
    assert.notEqual(repere(partie, "lancer"), avant.lancer, "le bouton est refait");
    assert.equal(avant.lancer.isConnected, false);
    for (const nom of noms.filter((n) => n !== "lancer")) assert.equal(repere(partie, nom), avant[nom], `${nom} est gardé`);

    // Seule la liste des personnages change.
    const milieu = releve();
    partie.rendre(vueDe({ lancer: { actif: true, raison: null }, personnages: { attente: false, phrases: [], options: [{ cle: "p-basile", nom: "Basile Croûton", actif: true, raison: null }] } }), {});
    assert.notEqual(repere(partie, "personnage"), milieu.personnage);
    assert.notEqual(repere(partie, "ajouter-personnage"), milieu["ajouter-personnage"]);
    for (const nom of noms.filter((n) => !n.includes("personnage"))) assert.equal(repere(partie, nom), milieu[nom], `${nom} est gardé`);

    // Les blocs eux-mêmes, et leur ordre, ne bougent jamais.
    assert.deepEqual([...partie.noeud.children], blocs);
    assert.equal(partie.noeud.querySelectorAll("[data-repere=lancer]").length, 1);
  } finally {
    retirer();
  }
});

test("ce que la personne a choisi se garde quand une liste se refait", () => {
  const { partie, retirer } = monter();
  try {
    choisir(repere(partie, "personnage"), 1);
    choisir(repere(partie, "adversaire"), 1);
    saisir(repere(partie, "nombre"), "3");

    // Les listes changent : un personnage de plus en tête, un plafond qui baisse.
    const vue = vueDe();
    partie.rendre(
      vueDe({
        personnages: { attente: false, phrases: [], options: [{ cle: "p-anis", nom: "Anis Étoilé", actif: true, raison: null }, ...vue.personnages.options] },
        adversaires: { options: vue.adversaires.options.map((option) => ({ ...option, max: 9 })), vide: null },
      }),
      {},
    );
    assert.equal(repere(partie, "personnage").value, "2", "Basile, à son nouveau rang");
    assert.equal(repere(partie, "adversaire").value, "1");
    assert.equal(repere(partie, "nombre").value, "3");
    assert.equal(repere(partie, "nombre").getAttribute("max"), "9");
    assert.equal(inactif(repere(partie, "ajouter-adversaires")), false);
  } finally {
    retirer();
  }
});

test("un personnage ajouté quitte le choix : la liste passe au suivant qui peut s'ajouter", () => {
  const { partie, appels, retirer } = monter();
  try {
    repere(partie, "ajouter-personnage").click();
    const vue = vueDe();
    partie.rendre(vueDe({ personnages: { attente: false, phrases: [], options: [{ ...vue.personnages.options[0], actif: false, raison: DEJA }, vue.personnages.options[1]] } }), {});
    assert.equal(repere(partie, "personnage").value, "1");
    assert.equal(inactif(repere(partie, "ajouter-personnage")), false);
    repere(partie, "ajouter-personnage").click();
    assert.deepEqual(appels, [["ajouterPersonnage", "p-aubepine"], ["ajouterPersonnage", "p-basile"]]);

    // Plus personne à ajouter : la liste reste, le bouton dit pourquoi.
    partie.rendre(vueDe({ personnages: { attente: false, phrases: [], options: vue.personnages.options.map((option) => ({ ...option, actif: false, raison: DEJA })) } }), {});
    assert.equal(repere(partie, "personnage").value, "0");
    assert.equal(inactif(repere(partie, "ajouter-personnage")), true);
    assert.equal(texteDe(raisonDe(partie, repere(partie, "ajouter-personnage"))), DEJA);
    repere(partie, "ajouter-personnage").click();
    assert.equal(appels.length, 2);
  } finally {
    retirer();
  }
});

test("le focus suit le bouton quand son bloc se refait, et ne bouge pas sinon", () => {
  const { partie, retirer } = monter();
  try {
    const avant = repere(partie, "ajouter-personnage");
    avant.focus();
    const vue = vueDe();
    partie.rendre(vueDe({ personnages: { attente: false, phrases: [], options: [{ ...vue.personnages.options[0], actif: false, raison: DEJA }, vue.personnages.options[1]] } }), {});
    const apres = repere(partie, "ajouter-personnage");
    assert.notEqual(apres, avant);
    assert.equal(document.activeElement, apres, "le focus est rendu au bouton de même rôle");
    // Sans faire défiler la page (compl. § 4.5).
    assert.deepEqual(document.focalisations.at(-1), { noeud: apres, options: { preventScroll: true } });

    // Un autre bloc se refait : le focus reste où il est.
    partie.rendre(vueDe({ lancer: { actif: true, raison: null }, personnages: { attente: false, phrases: [], options: [{ ...vue.personnages.options[0], actif: false, raison: DEJA }, vue.personnages.options[1]] } }), {});
    assert.equal(document.activeElement, apres);

    // Un focus hors de la préparation n'y est jamais ramené.
    const dehors = document.createElement("button");
    document.body.append(dehors);
    dehors.focus();
    partie.rendre(vueDe(), {});
    assert.equal(document.activeElement, dehors);

    // Le bouton inactif garde le focus : c'est là que sa raison se lit.
    const lancer = repere(partie, "lancer");
    lancer.focus();
    partie.rendre(vueDe({ lancer: { actif: false, raison: "Il manque un adversaire." } }), {});
    assert.equal(document.activeElement, repere(partie, "lancer"));
    assert.equal(inactif(document.activeElement), true);
    assert.deepEqual(document.focalisations.at(-1), { noeud: repere(partie, "lancer"), options: { preventScroll: true } });
    assert.equal(document.defilements.length, 0);
  } finally {
    retirer();
  }
});

test("le focus ne fait jamais défiler la page : chaque focus du module porte preventScroll, et rien ne défile", () => {
  // Contrat du groupe 2, § 0.2 (règle 2) et § 9.11.
  const focus = SOURCE.match(/\.focus\([^)]*\)/g) ?? [];
  assert.ok(focus.length > 0, "le module rend le focus au bouton de même rôle");
  assert.deepEqual([...new Set(focus)], [".focus({ preventScroll: true })"]);
  for (const interdit of ["scrollIntoView", "scrollTo", "scrollBy", "window.scroll", "scrollTop"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans la préparation`);
  }
});

test("un nom hostile reste du texte, et ne retourne pas la ligne", () => {
  const retourne = String.fromCodePoint(0x202e);
  const balise = "<img src=x onerror=alert(1)>";
  const { partie, appels, retirer } = monter(
    vueDe({
      personnages: { attente: false, phrases: [`${balise} illisible`], options: [{ cle: `cle"]${balise}`, nom: `${retourne}Aubépine ${balise}`, actif: true, raison: null }] },
      adversaires: { options: [{ nom: `Marmiton ${balise}${retourne}`, actif: false, raison: `${retourne}refus ${balise}`, max: 12 }], vide: null },
      absents: `Câblés absents de la banque : ${balise}.`,
      avertissements: [`${retourne}${balise}`],
    }),
  );
  try {
    const { noeud } = partie;
    assert.equal(noeud.querySelectorAll("img").length, 0);
    assert.ok(!noeud.textContent.includes(retourne), "le signe qui commande le sens de l'écriture ne s'affiche pas");
    assert.equal(texteDe(repere(partie, "personnage").querySelector("option")), `Aubépine ${balise}`);
    assert.equal(texteDe(raisonDe(partie, repere(partie, "ajouter-adversaires"))), `refus ${balise}`);
    // Ni la clé ni le nom ne servent d'attribut : les options portent leur rang.
    for (const option of noeud.querySelectorAll("option")) assert.match(option.getAttribute("value"), /^\d+$/);
    for (const element of noeud.descendants()) {
      for (const [nom, valeur] of element.attributs) assert.ok(!valeur.includes("<"), `${nom} ne porte aucune donnée`);
    }
    // La clé, elle, part telle qu'elle est écrite.
    repere(partie, "ajouter-personnage").click();
    assert.deepEqual(appels, [["ajouterPersonnage", `cle"]${balise}`]]);
  } finally {
    retirer();
  }
});

test("le module : il n'écrit ni HTML ni style, n'importe que dom.js, et n'ouvre aucune région d'annonce", () => {
  const imports = [...SOURCE.matchAll(/^\s*import\b[^;]*?from\s+"([^"]+)";/gm)].map(([, chemin]) => chemin);
  assert.deepEqual(imports, ["./dom.js"], "une partie de l'écran n'importe rien du moteur");
  assert.ok(!/\bimport\s*\(/.test(SOURCE), "aucun import dynamique");
  for (const interdit of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", ".style", "cssText", "confirm(", "alert(", "data-chargement", "Chargement de", "aria-live", "role: \"status\"", "localStorage", "indexedDB", "addEventListener"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans la préparation`);
  }
  // Mission § 10.9 : le code n'écrit aucun style, pas même par un attribut.
  assert.doesNotMatch(SOURCE, /\bstyle\s*[:=]|setAttribute\(\s*["'`]style/, "aucun style écrit par le code");
  assert.ok(!/["'`]disabled["'`]\s*[:,]/.test(SOURCE), "un bouton inactif garde le focus : aria-disabled, jamais disabled");
  assert.ok(!SOURCE.includes(String.fromCodePoint(0xa0)) && !SOURCE.includes(String.fromCodePoint(0x202f)), "aucune espace insécable");
  assert.match(SOURCE, /^\/\/ La préparation du combat \(SPECIFICATION\.md, § 17/);
  assert.ok(!/carte/i.test(SOURCE), "« carte » ne nomme que la carte d'adversaire");
});
