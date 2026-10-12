// Contrôles du plateau du combat, dans un document simulé
// (SPECIFICATION.md, § 17 et § 11 ; mission du lot 4, § 10.4 et § 10.7).
//
// La partie se contrôle seule, sur des vues écrites à la main à la forme de
// vuePlateau : ce qu'elle montre, la commande que rend chaque jeton et
// chaque case (et son origine, « plateau »), un jeton inactif qui ne fait
// rien, les trois jetons d'une case et ses « +k », les trois moyens de
// poser avant le lancement, les nœuds gardés d'un rendu à l'autre. Les noms
// viennent de la démonstration. La taille des cases et le glisser-déposer
// se regardent dans un vrai navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_plateau.js");
const SOURCE = readFileSync(new URL("../js/ecrans/combat_plateau.js", import.meta.url), "utf8");

const PROTAGONISTES = {
  pj1: { camp: "pj", entier: "Aubépine Crèmebrûlée", jeton: "Aubépine", initiales: "A" },
  adv2: { camp: "adv", entier: "Chef de partie", jeton: "Chef", initiales: "C" },
  adv3: { camp: "adv", entier: "Marmiton de corvée n° 1", jeton: "Marmiton 1", initiales: "M1" },
  adv4: { camp: "adv", entier: "Marmiton de corvée n° 2", jeton: "Marmiton 2", initiales: "M2" },
  adv5: { camp: "adv", entier: "Marmiton de corvée n° 3", jeton: "Marmiton 3", initiales: "M3" },
  adv6: { camp: "adv", entier: "Marmiton de corvée n° 4", jeton: "Marmiton 4", initiales: "M4" },
  adv7: { camp: "adv", entier: "Marmiton de corvée n° 5", jeton: "Marmiton 5", initiales: "M5" },
};
const CHOISIR = (id) => ({ commande: { choisir: id } });
const CIBLER = (id) => ({ commande: { evenement: { type: "regler", champ: "cible", valeur: id } } });
const ARRIVER = (nomDeCase) => ({
  commande: { evenement: { type: "regler", champ: "arrivee", valeur: nomDeCase } },
  nom: `Case ${nomDeCase} : s'y déplacer`,
});

/**
 * Une vue du plateau, à la forme de vuePlateau. « places » dit la case de
 * chaque protagoniste, dans l'ordre d'ajout ; « jetons » et « cases »
 * retouchent ce qui en découle.
 */
function vueDe({ phase = "combat", places = { pj1: "D4", adv2: "F6", adv3: "D4", adv4: "E5" }, jetons = {}, cases = {} } = {}) {
  const vue = { phase, cases: {}, jetons: {} };
  for (const [id, nomDeCase] of Object.entries(places)) {
    vue.cases[nomDeCase] ??= { jetons: [], active: false, choix: null };
    vue.cases[nomDeCase].jetons.push(id);
    const { camp, entier } = PROTAGONISTES[id];
    const retouche = jetons[id] ?? {};
    const etats = [retouche.marque === "joue" ? "joue" : null, retouche.marque === "cible" ? "ciblé" : null, retouche.mort ? "mort" : null].filter(Boolean);
    vue.jetons[id] = {
      ...PROTAGONISTES[id],
      marque: null,
      mort: false,
      nom: [entier, camp === "pj" ? "personnage" : "adversaire", ...etats, `case ${nomDeCase}`].join(", "),
      choix: null,
      inactif: false,
      ...retouche,
    };
  }
  for (const [nomDeCase, retouche] of Object.entries(cases)) {
    vue.cases[nomDeCase] = { jetons: [], active: false, choix: null, ...vue.cases[nomDeCase], ...retouche };
  }
  return vue;
}

/** Des actions qui notent ce qu'on leur demande ; « suite » se joue à chaque « executer ». */
function actionsEspionnes() {
  const appels = [];
  const espion = { appels, suite: null };
  const noter = (nom) => (...parametres) => {
    appels.push([nom, ...parametres]);
    if (nom === "executer" && espion.suite) espion.suite(...parametres);
  };
  espion.actions = {
    executer: noter("executer"),
    lancerLeDe: noter("lancerLeDe"),
    ajouterPersonnage: noter("ajouterPersonnage"),
    ajouterAdversaires: noter("ajouterAdversaires"),
    placerRencontre: noter("placerRencontre"),
    lancer: noter("lancer"),
    ouvrirFiche: noter("ouvrirFiche"),
    ouvrirCase: noter("ouvrirCase"),
  };
  return espion;
}

/** Un plateau posé dans la page, et de quoi le défaire. */
function monter(vue = vueDe()) {
  const retirer = installerDom();
  const espion = actionsEspionnes();
  const partie = creer(espion.actions);
  document.body.append(partie.noeud);
  if (vue) partie.rendre(vue, {});
  return { partie, appels: espion.appels, espion, retirer };
}

const caseDe = (partie, nom) => partie.noeud.querySelector(`[data-case=${nom}]`);
const jetonsDe = (partie, nom) => [...caseDe(partie, nom).querySelectorAll(".combat-jeton")];
/** Le jeton d'un protagoniste, retrouvé par son nom entier (son titre). */
const jetonDe = (partie, id) => [...partie.noeud.querySelectorAll(".combat-jeton")].find((b) => b.getAttribute("title") === PROTAGONISTES[id].entier) ?? null;
const classesDe = (noeud) => noeud.className.split(/\s+/).filter(Boolean);
const inactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";
const choixDe = (partie, nom) => caseDe(partie, nom).querySelector(".combat-case-choix");
const POSER = (id, nomDeCase) => ["executer", { preparer: { type: "poser", id, case: nomDeCase } }, "plateau"];

/** Compte les écritures faites sur des nœuds, d'ici à l'appel de la fonction rendue. */
function compterLesEcritures(noeuds) {
  let ecritures = 0;
  for (const noeud of noeuds) {
    for (const methode of ["setAttribute", "removeAttribute", "replaceChildren", "append"]) {
      const origine = noeud[methode];
      noeud[methode] = function compte(...parametres) {
        ecritures += 1;
        return origine.apply(this, parametres);
      };
    }
  }
  return () => ecritures;
}

test("le plateau : cent cases de A1 à J10, leurs repères, la légende", () => {
  const { partie, retirer } = monter();
  try {
    const { noeud } = partie;
    assert.equal(noeud.tagName, "SECTION");
    assert.equal(noeud.className, "combat-plateau");
    assert.equal(noeud.getAttribute("aria-label"), "Carte");
    assert.deepEqual(noeud.children.map((enfant) => enfant.className), ["combat-plateau-tete", "combat-grille", "combat-legende"]);

    // L'en-tête de la maquette : ce qu'est la carte, comment s'y compte une
    // distance ; et, à part, où lire un nom entier (la feuille ne le montre
    // que là où une souris survole).
    const tete = noeud.querySelector(".combat-plateau-tete");
    assert.equal(tete.tagName, "P");
    assert.deepEqual(tete.children.map(texteDe), ["Carte de 10 × 10 cases · une diagonale compte pour une case", "Survolez un jeton pour son nom complet"]);
    assert.deepEqual(tete.children.map((enfant) => enfant.className), ["", "combat-plateau-survol"]);
    for (const balise of ["button", "a", "input"]) assert.equal(tete.querySelectorAll(balise).length, 0, `rien ne s'y actionne : ${balise}`);

    // L'ordre du document est celui que la feuille range : le coin, les dix
    // lettres, puis chaque ligne, son numéro devant ses dix cases.
    const grille = noeud.querySelector(".combat-grille");
    const attendu = ["", ..."ABCDEFGHIJ"];
    for (let ligne = 1; ligne <= 10; ligne += 1) {
      attendu.push(String(ligne));
      for (const lettre of "ABCDEFGHIJ") attendu.push(`case ${lettre}${ligne}`);
    }
    assert.equal(grille.children.length, 121);
    assert.deepEqual(
      grille.children.map((enfant) => (enfant.hasAttribute("data-case") ? `case ${enfant.getAttribute("data-case")}` : texteDe(enfant))),
      attendu,
    );
    const reperes = [...grille.querySelectorAll(".combat-coord")];
    assert.equal(reperes.length, 21);
    // Les repères ne se lisent pas à part : chaque bouton dit déjà sa case.
    assert.ok(reperes.every((repere) => repere.getAttribute("aria-hidden") === "true"));
    const cases = [...grille.querySelectorAll(".combat-case")];
    assert.equal(cases.length, 100);
    assert.equal(new Set(cases.map((c) => c.getAttribute("data-case"))).size, 100);
    assert.ok(cases.every((c) => c.tagName === "DIV"), "une case n'est pas un bouton : elle en contient");

    const legende = [...noeud.querySelectorAll(".combat-legende li")];
    assert.deepEqual(legende.map(texteDe), ["personnage", "adversaire", "joue", "cible", "mort, barré"]);
    assert.deepEqual(legende.map((li) => li.className), ["combat-pj", "combat-adv", "joue", "cible", "mort"]);
    assert.ok(legende.every((li) => li.children.length === 1 && li.children[0].className === "combat-rond"));

    // Toute classe est du combat, ou un état que nomme le contrat ; aucune ne
    // touche à la carte d'adversaire.
    const etats = ["active", "possible", "inactive", "joue", "cible", "mort", "inactif"];
    const classes = [noeud, ...noeud.descendants()].flatMap(classesDe);
    for (const classe of classes) {
      assert.ok(classe.startsWith("combat-") || etats.includes(classe), `classe inattendue : ${classe}`);
      assert.ok(!classe.includes("carte"), `classe inattendue : ${classe}`);
    }
  } finally {
    retirer();
  }
});

test("un jeton est un bouton nommé : nom entier en titre, camp, état et case dans son nom", () => {
  const vue = vueDe({
    jetons: { pj1: { marque: "joue" }, adv2: { marque: "cible" }, adv4: { mort: true } },
    cases: { D4: { active: true } },
  });
  const { partie, retirer } = monter(vue);
  try {
    const aubepine = jetonDe(partie, "pj1");
    assert.equal(aubepine.tagName, "BUTTON");
    assert.equal(aubepine.getAttribute("type"), "button");
    assert.equal(aubepine.getAttribute("title"), "Aubépine Crèmebrûlée", "le titre est le nom entier, pas le nom court");
    assert.equal(aubepine.getAttribute("aria-label"), "Aubépine Crèmebrûlée, personnage, joue, case D4");
    assert.deepEqual(classesDe(aubepine), ["combat-jeton", "combat-pj", "joue"]);
    assert.deepEqual(aubepine.children.map((enfant) => enfant.className), ["combat-rond", "combat-nom-court"]);
    assert.equal(texteDe(aubepine.querySelector(".combat-rond .combat-initiales")), "A");
    assert.equal(texteDe(aubepine.querySelector(".combat-nom-court")), "Aubépine");

    const chef = jetonDe(partie, "adv2");
    assert.equal(chef.getAttribute("title"), "Chef de partie");
    assert.equal(chef.getAttribute("aria-label"), "Chef de partie, adversaire, ciblé, case F6");
    assert.deepEqual(classesDe(chef), ["combat-jeton", "combat-adv", "cible"]);

    const marmiton = jetonDe(partie, "adv3");
    assert.equal(marmiton.getAttribute("title"), "Marmiton de corvée n° 1");
    assert.deepEqual(classesDe(marmiton), ["combat-jeton", "combat-adv"], "sans marque, ni joue ni cible ni mort");
    assert.equal(texteDe(marmiton.querySelector(".combat-initiales")), "M1");
    assert.equal(texteDe(marmiton.querySelector(".combat-nom-court")), "Marmiton 1");
    // Le nom court est en deux morceaux : la case peut couper le nom, jamais
    // le numéro d'exemplaire (vu dans un navigateur : deux Marmitons d'une
    // même case portaient le même nom coupé, « Mar… »).
    const morceaux = (jeton) => jeton.querySelector(".combat-nom-court").children.map((enfant) => [enfant.className, texteDe(enfant)]);
    assert.deepEqual(morceaux(marmiton), [["combat-nom-debut", "Marmiton"], ["combat-nom-numero", "1"]]);
    assert.deepEqual(morceaux(aubepine), [["combat-nom-debut", "Aubépine"]], "sans numéro, un seul morceau");
    assert.equal(marmiton.querySelector(".combat-nom-court").textContent, "Marmiton 1", "lu d'un trait, le nom court garde son espace");

    const mort = jetonDe(partie, "adv4");
    assert.deepEqual(classesDe(mort), ["combat-jeton", "combat-adv", "mort"]);
    assert.equal(mort.getAttribute("aria-label"), "Marmiton de corvée n° 2, adversaire, mort, case E5");

    // Chaque jeton est dans sa case, dans l'ordre de la vue.
    assert.deepEqual(jetonsDe(partie, "D4"), [aubepine, marmiton]);
    assert.deepEqual(jetonsDe(partie, "F6"), [chef]);
    assert.deepEqual(jetonsDe(partie, "E5"), [mort]);
    assert.equal(partie.noeud.querySelectorAll(".combat-jeton").length, 4);

    // La case de qui joue est marquée, et elle seule.
    assert.deepEqual(classesDe(caseDe(partie, "D4")), ["combat-case", "active"]);
    assert.deepEqual(classesDe(caseDe(partie, "F6")), ["combat-case"]);
    assert.deepEqual(classesDe(caseDe(partie, "A1")), ["combat-case"]);

    // Hors de la préparation, un jeton ne se tient pas en main et ne glisse pas.
    for (const jeton of partie.noeud.querySelectorAll(".combat-jeton")) {
      assert.equal(jeton.hasAttribute("aria-pressed"), false);
      assert.equal(jeton.hasAttribute("draggable"), false);
    }
  } finally {
    retirer();
  }
});

test("des initiales de trois signes (« M12 ») portent la classe qui les écrit plus petit ; une ou deux, non ; et la classe suit le jeton", () => {
  const jetonDe = (id, initiales) => ({ camp: "adv", entier: `Marmiton de corvée n° ${id}`, jeton: `Marmiton ${id}`, initiales, marque: null, mort: false, nom: `Marmiton de corvée n° ${id}, adversaire, case D6`, choix: null, inactif: false });
  const vueDe = (douzieme) => ({ phase: "combat", cases: { D6: { jetons: ["a", "b", "c"], active: false, choix: null } }, jetons: { a: jetonDe(1, "M"), b: jetonDe(2, "M2"), c: jetonDe(12, douzieme) } });
  const retirer = installerDom();
  try {
    const partie = creer({ executer() {}, ouvrirCase() {} });
    document.body.append(partie.noeud);
    partie.rendre(vueDe("M12"));
    const initiales = [...partie.noeud.querySelectorAll(".combat-jeton .combat-initiales")];
    assert.deepEqual(initiales.map(texteDe), ["M", "M2", "M12"]);
    assert.deepEqual(initiales.map((noeud) => noeud.className), ["combat-initiales", "combat-initiales", "combat-initiales combat-initiales-longues"]);
    // Le même jeton, renommé : la classe s'en va avec le troisième signe.
    partie.rendre(vueDe("M9"));
    assert.equal(initiales[2].className, "combat-initiales");
    assert.equal(texteDe(initiales[2]), "M9");
  } finally {
    retirer();
  }
});

test("le nom court d'un jeton : seul un numéro final, après une espace, s'en détache", () => {
  const vue = vueDe({
    places: { pj1: "A1", adv2: "B1", adv3: "C1", adv4: "D1", adv5: "E1" },
    jetons: { pj1: { jeton: "R2" }, adv2: { jeton: "Chef de partie 12" }, adv3: { jeton: "Marmiton" }, adv4: { jeton: "7" }, adv5: { jeton: "Marmiton 3 bis" } },
  });
  const { partie, retirer } = monter(vue);
  try {
    const morceaux = (id) => jetonDe(partie, id).querySelector(".combat-nom-court").children.map((enfant) => [enfant.className, enfant.textContent]);
    assert.deepEqual(morceaux("pj1"), [["combat-nom-debut", "R2"]], "un chiffre collé au nom n'est pas un numéro d'exemplaire");
    assert.deepEqual(morceaux("adv2"), [["combat-nom-debut", "Chef de partie"], ["combat-nom-numero", "12"]]);
    assert.deepEqual(morceaux("adv3"), [["combat-nom-debut", "Marmiton"]]);
    assert.deepEqual(morceaux("adv4"), [["combat-nom-debut", "7"]], "un nombre seul est un nom");
    assert.deepEqual(morceaux("adv5"), [["combat-nom-debut", "Marmiton 3 bis"]], "un nombre au milieu reste dans le nom");
    // Dans tous les cas, le texte du nom court est celui de la vue.
    for (const [id, { jeton }] of Object.entries(vue.jetons)) assert.equal(jetonDe(partie, id).querySelector(".combat-nom-court").textContent, jeton, id);
  } finally {
    retirer();
  }
});

test("jamais un bouton dans un bouton, ni un bouton éteint par « disabled »", () => {
  const places = { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4", adv5: "D4", adv6: "E5" };
  const vues = [
    vueDe({ places, jetons: { pj1: { marque: "joue", inactif: true }, adv6: { inactif: true } }, cases: { D4: { active: true }, E5: { choix: ARRIVER("E5") }, C3: { choix: ARRIVER("C3") } } }),
    vueDe({ phase: "preparation", places }),
  ];
  for (const vue of vues) {
    const { partie, retirer } = monter(vue);
    try {
      if (vue.phase === "preparation") jetonDe(partie, "pj1").click();
      const boutons = [...partie.noeud.querySelectorAll("button")];
      assert.ok(boutons.length > 6);
      for (const bouton of boutons) {
        assert.equal(bouton.getAttribute("type"), "button");
        assert.equal(bouton.disabled, false, "un bouton inactif garde le focus : aria-disabled");
        assert.equal(bouton.querySelectorAll("button").length, 0, "un bouton dans un bouton");
        assert.ok(classesDe(bouton.parentNode).includes("combat-case"), "tout bouton du plateau est l'enfant direct d'une case");
      }
      // Dans une case : le bouton de la case, puis ses jetons, puis les « +k ».
      const rangs = (nom) => caseDe(partie, nom).children.map((enfant) => classesDe(enfant)[0]);
      assert.deepEqual(rangs("E5"), ["combat-case-choix", "combat-jeton"]);
      if (vue.phase === "combat") assert.deepEqual(rangs("D4"), ["combat-jeton", "combat-jeton", "combat-jeton", "combat-case-plus", "combat-case-plus"]);
    } finally {
      retirer();
    }
  }
});

test("trois jetons par case au plus, puis « +k » : un compte au-delà de deux, un autre au-delà de trois", () => {
  const dans = (nombre) => Object.fromEntries(["pj1", "adv2", "adv3", "adv4", "adv5", "adv6", "adv7"].slice(0, nombre).map((id) => [id, "D4"]));
  const attendus = { 1: [1, null, null], 2: [2, null, null], 3: [3, "+1", null], 4: [3, "+2", "+1"], 5: [3, "+3", "+2"], 7: [3, "+5", "+4"] };
  for (const [nombre, [montres, etroit, large]] of Object.entries(attendus)) {
    const { partie, appels, retirer } = monter(vueDe({ places: dans(Number(nombre)) }));
    try {
      const laCase = caseDe(partie, "D4");
      assert.equal(jetonsDe(partie, "D4").length, montres, `${nombre} dans la case`);
      // Les premiers de la vue, dans son ordre.
      assert.deepEqual(jetonsDe(partie, "D4").map((b) => b.getAttribute("title")), Object.keys(dans(Number(nombre))).slice(0, 3).map((id) => PROTAGONISTES[id].entier));
      const plusEtroit = laCase.querySelector(".combat-case-plus.combat-plus-etroit");
      const plusLarge = laCase.querySelector(".combat-case-plus.combat-plus-large");
      assert.equal(plusEtroit ? texteDe(plusEtroit) : null, etroit, `${nombre} dans la case, sous 56rem`);
      assert.equal(plusLarge ? texteDe(plusLarge) : null, large, `${nombre} dans la case, à partir de 56rem`);
      assert.equal(laCase.querySelectorAll(".combat-case-plus").length, [etroit, large].filter(Boolean).length);
      for (const plus of [plusEtroit, plusLarge].filter(Boolean)) {
        assert.equal(plus.getAttribute("aria-label"), `Case D4 : ${nombre} protagonistes, voir la liste`);
        plus.click();
        assert.deepEqual(appels.pop(), ["ouvrirCase", "D4"]);
      }
      assert.deepEqual(appels, []);
    } finally {
      retirer();
    }
  }
});

test("dans une case pleine, ceux qu'on peut choisir passent devant et les morts derrière : un mort ne cache pas un vivant", () => {
  const titres = (partie, nom) => jetonsDe(partie, nom).map((b) => b.getAttribute("title"));
  const noms = (...ids) => ids.map((id) => PROTAGONISTES[id].entier);
  const tous = { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4" };
  // Vu dans un navigateur : après la mort du Marmiton n° 1, la case D4 montrait
  // Aubépine, le Chef et le mort ; le Marmiton n° 2, qu'on pouvait cibler,
  // était derrière « +1 ».
  const cibles = vueDe({ places: tous, jetons: { pj1: { marque: "joue", inactif: true }, adv2: { choix: CIBLER("adv2") }, adv3: { mort: true, inactif: true }, adv4: { choix: CIBLER("adv4") } } });
  const { partie, appels, retirer } = monter(cibles);
  try {
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv2", "adv4"));
    jetonDe(partie, "adv4").click();
    assert.deepEqual(appels, [["executer", CIBLER("adv4").commande, "plateau"]], "le vivant qu'on peut cibler se touche sur la carte");
    assert.equal(jetonDe(partie, "adv3"), null, "le mort est derrière « +1 »");
    assert.equal(texteDe(caseDe(partie, "D4").querySelector(".combat-plus-large")), "+1");

    // La cible choisie reste devant ceux qu'on peut encore choisir (l'ordre de la vue) ; le mort reste dernier.
    partie.rendre(vueDe({ places: { pj1: "D4", adv4: "D4", adv2: "D4", adv3: "D4" }, jetons: { pj1: { marque: "joue", inactif: true }, adv4: { marque: "cible", choix: CIBLER("adv4") }, adv2: { choix: CIBLER("adv2") }, adv3: { mort: true, inactif: true } } }), {});
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv4", "adv2"));

    // Au repos (« Qui joue ? »), un vivant passe devant un mort, même sans rien à choisir.
    partie.rendre(vueDe({ places: tous, jetons: { adv2: { mort: true }, adv3: { mort: true } } }), {});
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv4", "adv2"));
    // À trois dans la case, tous se voient : le mort en dernier.
    partie.rendre(vueDe({ places: { pj1: "D4", adv3: "D4", adv4: "D4" }, jetons: { adv3: { mort: true } } }), {});
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv4", "adv3"));
    // Et rien d'autre ne bouge : au tour des adversaires, ceux qui peuvent
    // jouer ne passent pas devant le personnage. Un jeton ne saute pas d'une
    // ligne à l'autre à chaque tour.
    partie.rendre(vueDe({ places: { pj1: "D4", adv3: "D4", adv4: "D4" }, jetons: { adv3: { choix: CHOISIR("adv3") }, adv4: { choix: CHOISIR("adv4") } } }), {});
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv3", "adv4"));
    // Un jeton écarté qui porterait un choix ne passe pas devant : il ne se choisit pas.
    partie.rendre(vueDe({ places: tous, jetons: { adv4: { choix: CIBLER("adv4"), inactif: true } } }), {});
    assert.deepEqual(titres(partie, "D4"), noms("pj1", "adv2", "adv3"));
  } finally {
    retirer();
  }

  // Avant le lancement, rien ne se range : l'ordre d'ajout.
  const avant = monter(vueDe({ phase: "preparation", places: tous, jetons: { adv3: { mort: true } } }));
  try {
    assert.deepEqual(titres(avant.partie, "D4"), noms("pj1", "adv2", "adv3"));
  } finally {
    avant.retirer();
  }
});

test("« +k » suit la case : il paraît, change et s'en va avec les jetons", () => {
  const { partie, retirer } = monter(vueDe({ places: { pj1: "D4", adv2: "D4" } }));
  try {
    assert.equal(caseDe(partie, "D4").querySelectorAll(".combat-case-plus").length, 0);
    partie.rendre(vueDe({ places: { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4" } }), {});
    assert.deepEqual([...caseDe(partie, "D4").querySelectorAll(".combat-case-plus")].map(texteDe), ["+2", "+1"]);
    assert.equal(jetonsDe(partie, "D4").length, 3);
    partie.rendre(vueDe({ places: { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4", adv5: "D4" } }), {});
    assert.deepEqual([...caseDe(partie, "D4").querySelectorAll(".combat-case-plus")].map(texteDe), ["+3", "+2"]);
    partie.rendre(vueDe({ places: { pj1: "D4", adv2: "D4", adv3: "E5", adv4: "E5", adv5: "E5" } }), {});
    assert.equal(caseDe(partie, "D4").querySelectorAll(".combat-case-plus").length, 0);
    assert.deepEqual([...caseDe(partie, "E5").querySelectorAll(".combat-case-plus")].map(texteDe), ["+1"]);
    assert.equal(partie.noeud.querySelectorAll(".combat-jeton").length, 5);
  } finally {
    retirer();
  }
});

test("un jeton qu'on peut choisir rend sa commande, avec l'origine « plateau » ; les autres ne font rien", () => {
  const vue = vueDe({
    jetons: { pj1: { choix: CHOISIR("pj1") }, adv2: { choix: CIBLER("adv2") }, adv3: { inactif: true }, adv4: { mort: true } },
  });
  const { partie, appels, retirer } = monter(vue);
  try {
    assert.equal(inactif(jetonDe(partie, "pj1")), false);
    jetonDe(partie, "pj1").click();
    assert.deepEqual(appels, [["executer", { choisir: "pj1" }, "plateau"]]);
    jetonDe(partie, "adv2").click();
    assert.deepEqual(appels[1], ["executer", { evenement: { type: "regler", champ: "cible", valeur: "adv2" } }, "plateau"]);
    assert.equal(appels.length, 2);

    // Écarté par la vue : marqué, inactif, et son clic ne rend rien.
    const ecarte = jetonDe(partie, "adv3");
    assert.ok(classesDe(ecarte).includes("inactif"));
    assert.equal(inactif(ecarte), true);
    ecarte.click();
    // Sans choix, sans être écarté (un mort, quelqu'un qui a joué) : un
    // bouton nommé qui ne fait rien, et qui le dit.
    const mort = jetonDe(partie, "adv4");
    assert.ok(!classesDe(mort).includes("inactif"));
    assert.equal(inactif(mort), true);
    mort.click();
    assert.equal(appels.length, 2);

    // Un jeton à la fois écarté et porteur d'une commande reste inactif.
    partie.rendre(vueDe({ jetons: { adv3: { inactif: true, choix: CIBLER("adv3") } } }), {});
    jetonDe(partie, "adv3").click();
    assert.equal(appels.length, 2);
    // Et il redevient actif dès que la vue le dit.
    partie.rendre(vueDe({ jetons: { adv3: { choix: CIBLER("adv3") } } }), {});
    assert.equal(inactif(jetonDe(partie, "adv3")), false);
    assert.ok(!classesDe(jetonDe(partie, "adv3")).includes("inactif"));
    jetonDe(partie, "adv3").click();
    assert.equal(appels.length, 3);
    assert.deepEqual(appels[2][1], { evenement: { type: "regler", champ: "cible", valeur: "adv3" } });
  } finally {
    retirer();
  }
});

test("une case d'arrivée possible est un bouton nommé, qui rend sa commande ; les autres cases sont écartées", () => {
  const sans = vueDe({ jetons: { pj1: { marque: "joue" } }, cases: { D4: { active: true } } });
  const avec = vueDe({
    jetons: { pj1: { marque: "joue", inactif: true }, adv2: { inactif: true }, adv3: { inactif: true }, adv4: { inactif: true } },
    cases: { D4: { active: true }, E5: { choix: ARRIVER("E5") }, C3: { choix: ARRIVER("C3") } },
  });
  const { partie, appels, retirer } = monter(sans);
  try {
    // Sans choix ouvert : aucune case possible, aucune écartée.
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.possible").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.inactive").length, 0);

    partie.rendre(avec, {});
    assert.deepEqual([...partie.noeud.querySelectorAll(".combat-case.possible")].map((c) => c.getAttribute("data-case")), ["C3", "E5"]);
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 2);
    const bouton = choixDe(partie, "E5");
    assert.equal(bouton.tagName, "BUTTON");
    assert.equal(bouton.getAttribute("aria-label"), "Case E5 : s'y déplacer");
    assert.equal(texteDe(bouton), "", "le bouton d'une case n'a que son nom accessible");
    // Le bouton de la case vient avant ses jetons : il passe sous eux.
    assert.equal(caseDe(partie, "E5").children[0], bouton);
    assert.equal(caseDe(partie, "E5").children[1], jetonDe(partie, "adv4"));
    // La case de qui joue garde sa marque ; les 97 autres sont écartées.
    assert.deepEqual(classesDe(caseDe(partie, "D4")), ["combat-case", "active"]);
    assert.deepEqual(classesDe(caseDe(partie, "E5")), ["combat-case", "possible"]);
    assert.deepEqual(classesDe(caseDe(partie, "F6")), ["combat-case", "inactive"]);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.inactive").length, 97);

    bouton.click();
    assert.deepEqual(appels, [["executer", { evenement: { type: "regler", champ: "arrivee", valeur: "E5" } }, "plateau"]]);
    // Le jeton écarté de la case possible ne prend pas le clic à sa place.
    jetonDe(partie, "adv4").click();
    assert.equal(appels.length, 1);

    // Le choix fermé : tout revient.
    partie.rendre(sans, {});
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.possible").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.inactive").length, 0);
    assert.deepEqual(classesDe(caseDe(partie, "E5")), ["combat-case"]);
  } finally {
    retirer();
  }
});

test("à l'ouverture d'un choix de cible, les jetons hors de portée deviennent inactifs sans que leur case ni leur marque changent", () => {
  const avant = vueDe({ jetons: { pj1: { marque: "joue" } }, cases: { D4: { active: true } } });
  const pendant = vueDe({
    jetons: { pj1: { marque: "joue", inactif: true }, adv2: { inactif: true }, adv3: { choix: CIBLER("adv3") }, adv4: { inactif: true } },
    cases: { D4: { active: true } },
  });
  const { partie, appels, retirer } = monter(avant);
  try {
    const noeuds = Object.fromEntries(["pj1", "adv2", "adv3", "adv4"].map((id) => [id, jetonDe(partie, id)]));
    const enfantsDe = (nom) => [...caseDe(partie, nom).children];
    const enfants = { D4: enfantsDe("D4"), E5: enfantsDe("E5"), F6: enfantsDe("F6") };
    assert.ok(Object.values(noeuds).every((noeud) => !classesDe(noeud).includes("inactif")));

    partie.rendre(pendant, {});
    for (const id of ["pj1", "adv2", "adv3", "adv4"]) assert.equal(jetonDe(partie, id), noeuds[id], `${id} : le même bouton, mis à jour sur place`);
    for (const nom of ["D4", "E5", "F6"]) assert.deepEqual(enfantsDe(nom), enfants[nom], `${nom} : les mêmes enfants`);
    // Hors de portée : inactifs, à leur place, leur marque intacte.
    assert.deepEqual(classesDe(noeuds.adv2), ["combat-jeton", "combat-adv", "inactif"]);
    assert.deepEqual(classesDe(noeuds.adv4), ["combat-jeton", "combat-adv", "inactif"]);
    assert.deepEqual(classesDe(noeuds.pj1), ["combat-jeton", "combat-pj", "joue", "inactif"]);
    assert.equal(noeuds.adv2.getAttribute("aria-label"), "Chef de partie, adversaire, case F6");
    assert.equal(inactif(noeuds.adv2), true);
    // À portée : choisissable, et sa case n'est pas écartée.
    assert.deepEqual(classesDe(noeuds.adv3), ["combat-jeton", "combat-adv"]);
    assert.equal(inactif(noeuds.adv3), false);
    assert.deepEqual(classesDe(caseDe(partie, "D4")), ["combat-case", "active"]);
    assert.deepEqual(classesDe(caseDe(partie, "F6")), ["combat-case", "inactive"], "une case qui n'offre aucune cible est écartée");
    assert.deepEqual(classesDe(caseDe(partie, "E5")), ["combat-case", "inactive"]);
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0, "un choix de cible ne rend aucune case choisissable");
    noeuds.adv2.click();
    assert.deepEqual(appels, []);
    noeuds.adv3.click();
    assert.deepEqual(appels, [["executer", { evenement: { type: "regler", champ: "cible", valeur: "adv3" } }, "plateau"]]);

    // Une cible seule sur sa case : cette case n'est pas écartée non plus.
    partie.rendre(vueDe({ jetons: { pj1: { marque: "joue", inactif: true }, adv2: { choix: CIBLER("adv2") }, adv3: { inactif: true }, adv4: { inactif: true } }, cases: { D4: { active: true } } }), {});
    assert.deepEqual(classesDe(caseDe(partie, "F6")), ["combat-case"]);
    assert.deepEqual(classesDe(noeuds.adv3), ["combat-jeton", "combat-adv", "inactif"]);

    // Le choix fermé : plus personne n'est inactif, toujours sans rien refaire.
    partie.rendre(avant, {});
    for (const id of ["pj1", "adv2", "adv3", "adv4"]) {
      assert.equal(jetonDe(partie, id), noeuds[id]);
      assert.ok(!classesDe(noeuds[id]).includes("inactif"));
    }
    assert.equal(partie.noeud.querySelectorAll(".combat-case.inactive").length, 0);
  } finally {
    retirer();
  }
});

test("la cible choisie porte sa marque, et la perd", () => {
  const { partie, retirer } = monter(vueDe({ jetons: { adv3: { marque: "cible" } } }));
  try {
    const marmiton = jetonDe(partie, "adv3");
    assert.deepEqual(classesDe(marmiton), ["combat-jeton", "combat-adv", "cible"]);
    assert.equal(marmiton.getAttribute("aria-label"), "Marmiton de corvée n° 1, adversaire, ciblé, case D4");
    partie.rendre(vueDe(), {});
    assert.deepEqual(classesDe(marmiton), ["combat-jeton", "combat-adv"]);
    assert.equal(marmiton.getAttribute("aria-label"), "Marmiton de corvée n° 1, adversaire, case D4");
    // Une marque inconnue ne devient jamais une classe.
    partie.rendre(vueDe({ jetons: { adv3: { marque: "combat-pj mort" } } }), {});
    assert.deepEqual(classesDe(marmiton), ["combat-jeton", "combat-adv"]);
  } finally {
    retirer();
  }
});

test("d'un rendu à l'autre : rien ne s'écrit quand la vue n'a pas changé, et seul change ce dont la vue a changé", () => {
  const depart = () => vueDe({ jetons: { pj1: { marque: "joue", choix: CHOISIR("pj1") } }, cases: { D4: { active: true } } });
  const { partie, retirer } = monter(depart());
  try {
    const tous = [partie.noeud, ...partie.noeud.descendants()];
    const noeuds = Object.fromEntries(["pj1", "adv2", "adv3", "adv4"].map((id) => [id, jetonDe(partie, id)]));
    let ecritures = compterLesEcritures(tous);
    // Une vue neuve, au contenu identique : des objets neufs, aucun changement.
    partie.rendre(depart(), {});
    partie.rendre(JSON.parse(JSON.stringify(depart())), {});
    assert.equal(ecritures(), 0, "une vue identique ne touche à rien");
    assert.deepEqual([partie.noeud, ...partie.noeud.descendants()], tous);

    // Un seul jeton change : lui seul est récrit, ni les autres ni sa case.
    const autres = [noeuds.pj1, noeuds.adv3, noeuds.adv4, ...[...partie.noeud.querySelectorAll(".combat-case")]];
    ecritures = compterLesEcritures(autres);
    const duChef = compterLesEcritures([noeuds.adv2]);
    partie.rendre(vueDe({ jetons: { pj1: { marque: "joue", choix: CHOISIR("pj1") }, adv2: { marque: "cible" } }, cases: { D4: { active: true } } }), {});
    assert.equal(ecritures(), 0, "les jetons et les cases dont la vue n'a pas changé ne sont pas récrits");
    assert.ok(duChef() > 0, "le jeton dont la vue a changé est récrit");
    assert.deepEqual(classesDe(noeuds.adv2), ["combat-jeton", "combat-adv", "cible"]);
    assert.equal(jetonDe(partie, "adv2"), noeuds.adv2);

    // Une case seule change (elle devient celle de qui joue) : ses jetons restent.
    // Sa liste d'enfants n'est pas récrite non plus : un bouton retiré puis
    // remis perdrait le focus.
    const desJetons = compterLesEcritures(Object.values(noeuds));
    const deLaCase = compterLesEcritures([caseDe(partie, "F6")]);
    partie.rendre(vueDe({ jetons: { pj1: { marque: "joue", choix: CHOISIR("pj1") }, adv2: { marque: "cible" } }, cases: { D4: { active: true }, F6: { active: true } } }), {});
    assert.deepEqual(classesDe(caseDe(partie, "F6")), ["combat-case", "active"]);
    assert.equal(desJetons(), 0);
    assert.equal(deLaCase(), 0, "la classe de la case change, pas ses enfants");
  } finally {
    retirer();
  }
});

test("un jeton qui se déplace change de case ; un jeton retiré quitte la page", () => {
  const { partie, retirer } = monter(vueDe());
  try {
    const chef = jetonDe(partie, "adv2");
    partie.rendre(vueDe({ places: { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "E5" } }), {});
    assert.equal(jetonDe(partie, "adv2"), chef, "le même bouton, déplacé");
    assert.equal(chef.parentNode, caseDe(partie, "D4"));
    assert.deepEqual(jetonsDe(partie, "D4").map((b) => b.getAttribute("title")), ["Aubépine Crèmebrûlée", "Chef de partie", "Marmiton de corvée n° 1"]);
    assert.equal(jetonsDe(partie, "F6").length, 0);
    assert.equal(chef.getAttribute("aria-label"), "Chef de partie, adversaire, case D4");

    partie.rendre(vueDe({ places: { pj1: "D4", adv3: "D4", adv4: "E5" } }), {});
    assert.equal(jetonDe(partie, "adv2"), null);
    assert.equal(chef.parentNode, null);
    assert.equal(partie.noeud.querySelectorAll(".combat-jeton").length, 3);
    // Il revient : un jeton, et un seul.
    partie.rendre(vueDe(), {});
    assert.equal(partie.noeud.querySelectorAll(".combat-jeton").length, 4);
    assert.equal(jetonsDe(partie, "F6").length, 1);

    // Un identifiant de la case que la vue ne décrit pas ne montre rien.
    const boiteuse = vueDe();
    boiteuse.cases.F6.jetons.push("adv99", "__proto__");
    partie.rendre(boiteuse, {});
    assert.equal(jetonsDe(partie, "F6").length, 1);
    assert.equal(caseDe(partie, "F6").querySelectorAll(".combat-case-plus").length, 0);
  } finally {
    retirer();
  }
});

test("avant le lancement : toucher un jeton le prend en main, toucher une case l'y pose", () => {
  const { partie, appels, retirer } = monter(vueDe({ phase: "preparation", places: { pj1: "A1", adv2: "J1", adv3: "J2", adv4: "J2" } }));
  try {
    // Au repos : chaque jeton se prend, aucune case ne se choisit.
    const aubepine = jetonDe(partie, "pj1");
    for (const jeton of partie.noeud.querySelectorAll(".combat-jeton")) {
      assert.equal(jeton.getAttribute("aria-pressed"), "false");
      assert.equal(inactif(jeton), false);
    }
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(partie.enMain(), null);

    aubepine.click();
    assert.deepEqual(appels, [], "prendre en main ne demande rien à l'écran");
    assert.equal(partie.enMain(), "pj1");
    assert.equal(jetonDe(partie, "pj1"), aubepine, "le même bouton : il garde le focus");
    assert.equal(aubepine.getAttribute("aria-pressed"), "true");
    assert.equal(inactif(aubepine), false);
    // Sa case est marquée ; les 99 autres deviennent des boutons nommés.
    assert.deepEqual(classesDe(caseDe(partie, "A1")), ["combat-case", "active"]);
    assert.equal(choixDe(partie, "A1"), null);
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 99);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.possible").length, 99);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.inactive").length, 0);
    assert.equal(choixDe(partie, "E5").getAttribute("aria-label"), "Case E5 : y poser Aubépine Crèmebrûlée");
    // Les autres jetons s'effacent : une case occupée se choisit comme une autre.
    const chef = jetonDe(partie, "adv2");
    assert.equal(inactif(chef), true);
    assert.ok(classesDe(chef).includes("inactif"));
    assert.equal(chef.getAttribute("aria-pressed"), "false");
    chef.click();
    assert.equal(partie.enMain(), "pj1", "toucher un autre jeton ne change pas de main");
    assert.deepEqual(appels, []);
    assert.equal(choixDe(partie, "J2").getAttribute("aria-label"), "Case J2 : y poser Aubépine Crèmebrûlée");

    choixDe(partie, "J2").click();
    assert.deepEqual(appels, [POSER("pj1", "J2")]);
    assert.equal(partie.enMain(), null, "la main est vide dès l'ordre donné");
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(aubepine.getAttribute("aria-pressed"), "false");
    assert.equal(inactif(chef), false);
    assert.ok(!classesDe(chef).includes("inactif"));
    assert.deepEqual(classesDe(caseDe(partie, "A1")), ["combat-case"]);
  } finally {
    retirer();
  }
});

test("avant le lancement : toucher de nouveau le jeton tenu le repose, sans rien demander", () => {
  const { partie, appels, retirer } = monter(vueDe({ phase: "preparation" }));
  try {
    const chef = jetonDe(partie, "adv2");
    chef.click();
    assert.equal(partie.enMain(), "adv2");
    assert.equal(choixDe(partie, "A1").getAttribute("aria-label"), "Case A1 : y poser Chef de partie");
    chef.click();
    assert.equal(partie.enMain(), null);
    assert.equal(chef.getAttribute("aria-pressed"), "false");
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.active").length, 0);
    // La main vide, un autre jeton se prend.
    jetonDe(partie, "pj1").click();
    assert.equal(partie.enMain(), "pj1");
    assert.equal(chef.getAttribute("aria-pressed"), "false");
    assert.deepEqual(appels, []);
  } finally {
    retirer();
  }
});

test("avant le lancement : le jeton posé suit l'écran qui redessine, et reçoit le focus", () => {
  const places = { pj1: "A1", adv2: "J1" };
  const { partie, espion, appels, retirer } = monter(vueDe({ phase: "preparation", places }));
  try {
    // L'écran redessine pendant « executer », comme le fait la séance.
    espion.suite = (commande) => {
      assert.equal(partie.enMain(), null, "l'écran trouve le plateau au repos");
      partie.rendre(vueDe({ phase: "preparation", places: { ...places, [commande.preparer.id]: commande.preparer.case } }), {});
    };
    const aubepine = jetonDe(partie, "pj1");
    aubepine.click();
    const bouton = choixDe(partie, "C3");
    bouton.focus();
    bouton.click();
    assert.deepEqual(appels, [POSER("pj1", "C3")]);
    assert.equal(aubepine.parentNode, caseDe(partie, "C3"));
    assert.equal(aubepine.getAttribute("aria-label"), "Aubépine Crèmebrûlée, personnage, case C3");
    assert.equal(bouton.parentNode, null, "le bouton de la case a quitté la page");
    assert.equal(document.activeElement, aubepine, "le focus ne reste pas sur un bouton retiré");
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
  } finally {
    retirer();
  }
});

test("avant le lancement : faire glisser un jeton sur une case l'y pose", () => {
  const { partie, appels, retirer } = monter(vueDe({ phase: "preparation", places: { pj1: "A1", adv2: "J1" } }));
  try {
    const aubepine = jetonDe(partie, "pj1");
    assert.equal(aubepine.getAttribute("draggable"), "true");
    assert.equal(jetonDe(partie, "adv2").getAttribute("draggable"), "true");

    // Rien ne glisse : la case n'accepte aucun dépôt, et n'en fait rien.
    const survolSansJeton = { evite: false };
    caseDe(partie, "C3").declencher("dragover", { preventDefault: () => (survolSansJeton.evite = true) });
    assert.equal(survolSansJeton.evite, false, "un fichier venu d'ailleurs garde son sort ordinaire");
    const depotSansJeton = { evite: false };
    caseDe(partie, "C3").declencher("drop", { preventDefault: () => (depotSansJeton.evite = true) });
    assert.equal(depotSansJeton.evite, false);
    assert.deepEqual(appels, []);

    // Le jeton part : la donnée qui l'accompagne est son identifiant, jamais un nom.
    const donnees = [];
    const transfert = { effectAllowed: "", setData: (type, valeur) => donnees.push([type, valeur]) };
    aubepine.declencher("dragstart", { dataTransfer: transfert });
    assert.deepEqual(donnees, [["text/plain", "pj1"]]);
    assert.equal(transfert.effectAllowed, "move");
    assert.equal(partie.enMain(), null, "glisser n'est pas prendre en main");
    const survol = { evite: false };
    caseDe(partie, "C3").declencher("dragover", { preventDefault: () => (survol.evite = true) });
    assert.equal(survol.evite, true, "la case accepte le dépôt");
    const depot = { evite: false };
    caseDe(partie, "C3").declencher("drop", { preventDefault: () => (depot.evite = true) });
    assert.equal(depot.evite, true);
    assert.deepEqual(appels, [POSER("pj1", "C3")]);

    // Le dépôt a fini le geste : un second dépôt ne pose rien.
    caseDe(partie, "E5").declencher("drop");
    assert.equal(appels.length, 1);

    // Un glisser abandonné (dragend) ne laisse rien derrière lui.
    aubepine.declencher("dragstart", { dataTransfer: transfert });
    aubepine.declencher("dragend");
    caseDe(partie, "E5").declencher("drop");
    assert.equal(appels.length, 1);

    // Déposé sur sa propre case : rien à demander.
    aubepine.declencher("dragstart", {});
    caseDe(partie, "A1").declencher("drop");
    assert.equal(appels.length, 1);

    // Un jeton déposé sur une case occupée s'y pose aussi.
    jetonDe(partie, "adv2").declencher("dragstart", { dataTransfer: transfert });
    caseDe(partie, "A1").declencher("drop");
    assert.deepEqual(appels[1], POSER("adv2", "A1"));
    assert.equal(appels.length, 2);
  } finally {
    retirer();
  }
});

test("le combat lancé : plus rien ne se prend en main ni ne glisse", () => {
  const { partie, appels, retirer } = monter(vueDe({ phase: "preparation" }));
  try {
    const aubepine = jetonDe(partie, "pj1");
    aubepine.click();
    assert.equal(partie.enMain(), "pj1");
    // Le lancement vide la main.
    partie.rendre(vueDe(), {});
    assert.equal(partie.enMain(), null);
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.equal(partie.noeud.querySelectorAll(".combat-case.active").length, 0);
    assert.equal(aubepine.hasAttribute("aria-pressed"), false);
    assert.equal(aubepine.hasAttribute("draggable"), false);
    assert.equal(inactif(aubepine), true, "sans commande, le jeton ne fait rien");
    aubepine.click();
    assert.equal(partie.enMain(), null);
    assert.equal(partie.prendre("pj1"), false);
    assert.equal(partie.enMain(), null);

    // Un glisser forcé est refusé, et son dépôt ne pose rien.
    const depart = { evite: false };
    aubepine.declencher("dragstart", { preventDefault: () => (depart.evite = true) });
    assert.equal(depart.evite, true);
    const survol = { evite: false };
    caseDe(partie, "C3").declencher("dragover", { preventDefault: () => (survol.evite = true) });
    assert.equal(survol.evite, false);
    caseDe(partie, "C3").declencher("drop");
    assert.deepEqual(appels, []);

    // Un glisser commencé avant le lancement ne pose rien après lui.
    partie.rendre(vueDe({ phase: "preparation" }), {});
    aubepine.declencher("dragstart", {});
    partie.rendre(vueDe(), {});
    caseDe(partie, "C3").declencher("drop");
    assert.deepEqual(appels, []);
    for (const phase of ["combat", "termine"]) {
      partie.rendre(vueDe({ phase }), {});
      assert.equal(partie.noeud.querySelectorAll("[draggable]").length, 0, phase);
      assert.equal(partie.noeud.querySelectorAll("[aria-pressed]").length, 0, phase);
    }
  } finally {
    retirer();
  }
});

test("« prendre » : la liste « +k » de l'écran prend un jeton en main sans passer par la grille", () => {
  const places = { pj1: "D4", adv2: "D4", adv3: "D4", adv4: "D4", adv5: "D4" };
  const { partie, appels, retirer } = monter(null);
  try {
    assert.equal(partie.prendre("pj1"), false, "sans vue, rien ne se prend");
    partie.rendre(vueDe({ phase: "preparation", places }), {});
    assert.equal(partie.prendre("adv99"), false, "un inconnu ne se prend pas");
    assert.equal(partie.enMain(), null);

    // Le cinquième de la case ne se voit pas : il se prend quand même.
    assert.equal(jetonDe(partie, "adv5"), null);
    assert.equal(partie.prendre("adv5"), true);
    assert.equal(partie.enMain(), "adv5");
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 99);
    assert.equal(choixDe(partie, "E5").getAttribute("aria-label"), "Case E5 : y poser Marmiton de corvée n° 3");
    assert.ok(jetonsDe(partie, "D4").every(inactif));
    choixDe(partie, "E5").click();
    assert.deepEqual(appels, [POSER("adv5", "E5")]);

    // « prendre(null) » vide la main.
    assert.equal(partie.prendre("pj1"), true);
    assert.equal(jetonDe(partie, "pj1").getAttribute("aria-pressed"), "true");
    assert.equal(partie.prendre(null), true);
    assert.equal(partie.enMain(), null);
    assert.equal(jetonDe(partie, "pj1").getAttribute("aria-pressed"), "false");
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);

    // Le jeton tenu est retiré du combat : la main se vide d'elle-même.
    assert.equal(partie.prendre("adv2"), true);
    partie.rendre(vueDe({ phase: "preparation", places: { pj1: "D4", adv3: "D4" } }), {});
    assert.equal(partie.enMain(), null);
    assert.equal(partie.noeud.querySelectorAll(".combat-case-choix").length, 0);
    assert.ok(jetonsDe(partie, "D4").every((jeton) => !inactif(jeton)));
  } finally {
    retirer();
  }
});

test("un nom hostile reste du texte, et ne commande pas le sens de l'écriture", () => {
  const balise = "<img src=x onerror=alert(1)>";
  const renverse = String.fromCodePoint(0x202e);
  const vue = vueDe({ phase: "preparation", places: { pj1: "A1", adv2: "J1" } });
  Object.assign(vue.jetons.pj1, {
    entier: `Aubépine ${balise}${renverse}"]`,
    jeton: `Aubépine${renverse} ${balise}`,
    initiales: `A${renverse}<`,
    nom: `Aubépine ${balise}${renverse}"], personnage, case A1`,
  });
  const { partie, retirer } = monter(vue);
  try {
    const aubepine = jetonsDe(partie, "A1")[0];
    assert.equal(aubepine.getAttribute("title"), `Aubépine ${balise}"]`);
    assert.equal(aubepine.getAttribute("aria-label"), `Aubépine ${balise}"], personnage, case A1`);
    assert.equal(texteDe(aubepine.querySelector(".combat-initiales")), "A<");
    assert.equal(texteDe(aubepine.querySelector(".combat-nom-court")), `Aubépine ${balise}`);
    assert.equal(partie.noeud.querySelectorAll("img").length, 0);
    aubepine.click();
    assert.equal(choixDe(partie, "E5").getAttribute("aria-label"), `Case E5 : y poser Aubépine ${balise}"]`);
    assert.equal(partie.noeud.querySelectorAll("img").length, 0);
    const texte = [partie.noeud, ...partie.noeud.descendants()].map((noeud) => `${noeud.getAttribute("title")}${noeud.getAttribute("aria-label")}`).join("") + partie.noeud.textContent;
    assert.ok(!texte.includes(renverse));
  } finally {
    retirer();
  }
});

test("le module : il n'écrit ni HTML ni style, n'importe que dom.js et deux constantes, et n'ouvre aucune région d'annonce", () => {
  const imports = [...SOURCE.matchAll(/^\s*import\s+([^;]*?)\s+from\s+"([^"]+)";/gm)].map(([, quoi, chemin]) => [quoi, chemin]);
  assert.deepEqual(imports, [
    ["{ el, sansSensForce }", "./dom.js"],
    ["{ COLONNES, COTE }", "../combat/regles.js"],
  ]);
  assert.ok(!/\bimport\s*\(/.test(SOURCE), "aucun import dynamique");
  for (const interdit of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", ".style", "cssText", "confirm(", "alert(", "data-chargement", "Chargement de", "aria-live", "role: \"status\"", "localStorage", "indexedDB", "addEventListener", "getData("]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans le plateau`);
  }
  assert.ok(!/["'`]disabled["'`]\s*[:,]/.test(SOURCE), "un bouton inactif garde le focus : aria-disabled, jamais disabled");
  assert.ok(!SOURCE.includes(String.fromCodePoint(0xa0)) && !SOURCE.includes(String.fromCodePoint(0x202f)), "aucune espace insécable");
  assert.match(SOURCE, /^\/\/ Le plateau du combat \(SPECIFICATION\.md, § 17/);
  // « Carte » est le nom de la région à l'écran ; aucune classe ne le porte.
  assert.ok(!/["'`. ]combat-[\w-]*carte/i.test(SOURCE) && !/carte-/i.test(SOURCE), "aucune classe en « carte »");
});
