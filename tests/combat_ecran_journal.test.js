// Contrôles du journal du combat et du bandeau « Dernier événement », dans
// un document simulé (SPECIFICATION.md, § 17.7 et § 17.9 ; contrat du lot 4,
// groupe 2, § 3.1, § 8.7, § 9.8 et § 14, É3 ; complément, § 4.4 et § 4.8 ;
// relecture du groupe 2, point à trancher 6) : js/ecrans/combat_journal.js.
//
// La partie se contrôle seule, sur des lignes écrites à la main à la forme du
// contrat (§ 3.1) et des vues du journal écrites ici à la forme de vueJournal
// et de vueBandeau (§ 8.7) : celles de js/combat/lecture.js s'écrivent dans
// un autre lot. Les lignes sont celles du combat de référence fictif,
// découpées comme js/combat/journal.js les découpe ; les noms viennent de la
// démonstration, et des noms d'essai que le contrat permet. Depuis le lot 4.3,
// le combat de référence n'a plus d'explosion ni de signe moins (le −1 des
// blessures n'est plus) : le jet de caractéristique à explosions est écrit à
// la main, tel que le journal l'écrirait.
//
// Ce fichier tient :
// a) chaque segment et sa classe, et rien d'autre de coloré ; le texte des
//    nœuds est celui de la ligne ;
// b) les cadres des jets, un dé d'un seul tenant, sans espace insécable ;
// c) la liste : les lignes neuves seules, les lignes barrées, un autre
//    journal reposé en entier, la dernière ligne montrée ;
// d) le bandeau : caché avant le lancement, sa forme, sa ligne en cours, la
//    vue inchangée qui ne refait rien ;
// e) la coupe, à 2, 3 et 6 phrases, par un budget de signes ; le nom de qui
//    agit gardé, entier, quand rien ne tient ;
// f) la mesure refaite à la largeur seule ; « Journal ↓ » et le clic à la
//    souris, jamais au doigt ;
// g) les noms hostiles et piégés ; h) le module lui-même.
//
// La hauteur réelle de trois lignes, la chasse fixe et le cadre qui suit la
// ligne se regardent dans un vrai navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerDom, texteDe } from "./outils/dom_simule.js";
import { couperLaLigne, creerBandeau, creerListe, ligneEnNoeuds } from "../js/ecrans/combat_journal.js";

const SOURCE = readFileSync(new URL("../js/ecrans/combat_journal.js", import.meta.url), "utf8");
const INSECABLES = [String.fromCodePoint(0xa0), String.fromCodePoint(0x202f)];
const SUITE = String.fromCodePoint(0x2026);
const COUPE = `[${SUITE}]`;

// ─── Les lignes, à la forme du contrat (§ 3.1) ──────────────────────────────

const texte = (contenu) => ({ type: "texte", texte: contenu });
const acteur = (contenu, camp) => ({ type: "acteur", texte: contenu, camp });
const cible = (contenu, camp) => ({ type: "cible", texte: contenu, camp });
const capacite = (contenu) => ({ type: "capacite", texte: contenu });
const lettre = (contenu) => ({ type: "lettre", texte: contenu });
const ajuste = (contenu) => ({ type: "ajuste", texte: contenu });
const mort = (contenu) => ({ type: "mort", texte: contenu });
// Un dé du cadre (jet 0) : sa valeur, une espace, puis « ✓ » (vrai) ou « ✗ »
// (faux) ; null : un dé qui attend encore, sans signe.
function de(rang, valeur, issue, jet = 0) {
  if (issue === null) return [{ type: "texte", texte: valeur, jet, de: rang }];
  return [
    { type: "texte", texte: `${valeur} `, jet, de: rang },
    issue ? { type: "reussi", texte: "✓", jet, de: rang } : { type: "echoue", texte: "✗", jet, de: rang },
  ];
}
// Un séparateur du cadre, hors des dés.
const entre = (contenu = ", ", jet = 0) => ({ type: "texte", texte: contenu, jet });

/**
 * Une ligne du journal : ses phrases, [genre, segments], jointes par une
 * espace qui n'est d'aucune phrase ; « … » à la fin d'une ligne en cours.
 */
function ligne(genre, phrases, { barre = null, enCours = false } = {}) {
  const segments = [];
  phrases.forEach(([, contenu], rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: " ", phrase: null });
    for (const segment of contenu.flat()) segments.push({ ...segment, phrase: rang });
  });
  if (enCours) segments.push({ type: "suite", texte: SUITE, phrase: null });
  const faite = { genre, texte: segments.map((segment) => segment.texte).join(""), segments, phrases: phrases.map(([phrase]) => phrase) };
  if (barre !== null) faite.barre = barre;
  if (enCours) faite.enCours = true;
  return faite;
}

/** La même ligne, telle que vueJournal et vueBandeau la donnent (§ 8.7). */
const vue = (faite, rang = null, barree = false) => ({
  rang,
  genre: faite.genre,
  texte: faite.texte,
  segments: faite.segments,
  phrases: faite.phrases,
  barree,
  barre: faite.genre === "annule" ? faite.barre : null,
});

const LANCEMENT = ligne("cadre", [["lancement", [texte("Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent.")]]]);
const TOUR_1 = ligne("tour", [["tour", [{ type: "tour", texte: "— Tour 1 · camp des PJ —" }]]]);
const PAS_CHASSE = ligne("geste", [["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Pas chassé [1]"), texte(", C3 → D4.")]]]);
const FIN_DU_TOUR = ligne("cadre", [["fin_de_tour", [{ type: "fin_de_tour", texte: "Fin du tour des PJ : ils retrouvent leurs actions." }]]]);
const TOUR_2 = ligne("tour", [["tour", [{ type: "tour", texte: "— Tour 1 · camp des adversaires —" }]]]);
const PASSE = ligne("geste", [["passe", [acteur("Marmiton n° 2", "adv"), texte(" passe son tour.")]]]);
const FIN = ligne("fin", [["fin", [texte("Combat terminé : victoire des PJ.")]]]);

// Deux phrases : une Frappe manquée.
const MANQUEE = ligne("geste", [
  ["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Frappe"), texte(" contre "), cible("Chef", "adv"), texte(".")]],
  ["jet", [texte("d10+1 contre 7 → "), de(0, "6", false), texte(" : aucune réussite, manqué.")]],
]);

// Trois phrases : la Fournaise du tour 4.
const FOURNAISE = ligne("geste", [
  ["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Fournaise [1]"), texte(" (1 souffle, 1 lien) contre "), cible("Chef", "adv"), texte(".")]],
  ["jet", [texte("d10+1 contre 7, 1 avantage → "), de(0, "9", true), entre(), de(1, "5", false), texte(" : 1 réussite, touché.")]],
  ["localisation", [texte("Localisation d20 → 6 : torse.")]],
]);

// Six phrases : l'Émincer qui tue, au tour 2.
const EMINCER = ligne(
  "geste",
  [
    ["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Émincer"), texte(" (4 souffle) contre "), cible("Marmiton n° 1", "adv"), texte(".")]],
    ["sources", [texte("Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent.")]],
    [
      "jet",
      [
        texte("d10+1 contre 5 → "),
        de(0, "5", true),
        entre(),
        de(1, "9", true),
        entre(),
        de(2, "4", false),
        texte(" : 2 réussites, "),
        lettre("B = 8"),
        texte(", ajusté à "),
        ajuste("20"),
        texte(" (Émincer), +2 contre l'armure (Réduction)."),
      ],
    ],
    ["localisation", [texte("Localisation d20 → 20 : tête.")]],
    ["degats", [texte("Armure 5 → 0, endurance 5 → 0, corps 10 → 0.")]],
    ["mort", [mort("Marmiton n° 1 meurt.")]],
  ],
);

// Une défense : le Marmiton attaque, Aubépine lance.
const DEFENSE = ligne("geste", [
  ["ouverture", [acteur("Marmiton n° 1", "adv"), texte(" : "), capacite("Frappe"), texte(" contre "), cible("Aubépine", "pj"), texte(".")]],
  ["sources", [texte("Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent.")]],
  ["jet", [texte("Aubépine lance sa défense, d8+1 contre 4 → "), de(0, "6", true), entre(), de(1, "3", false), texte(" : 1 réussite, Aubépine reçoit "), lettre("B = 10"), texte(".")]],
  ["localisation", [texte("Localisation d20 → 13 : jambe gauche.")]],
  ["degats", [texte("Armure 10 → 0.")]],
]);

// Une relance.
const TALOCHE = ligne("geste", [
  ["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Taloche [1]"), texte(" contre "), cible("Marmiton n° 2", "adv"), texte(".")]],
  ["jet", [texte("d8+1 (Force + Agilité) contre 5, 1 avantage → "), de(0, "8", true), entre(), de(1, "4", false), entre(", relancé "), de(2, "6", true), entre(), de(3, "9", true), texte(" : 3 réussites, "), lettre("C = 8"), texte(", +3 contre l'armure (Réduction).")]],
  ["localisation", [texte("Localisation d20 → 14 : jambe droite.")]],
  ["degats", [texte("Endurance 5 → 0, corps 10 → 7.")]],
  ["blessures", [texte("Blessure (jambe droite), sans effet calculé.")]],
]);

// Un désavantage : les lancers et leur flèche dans le dé.
const DESAVANTAGE = ligne("geste", [
  ["ouverture", [acteur("Aubépine", "pj"), texte(" : "), capacite("Frappe"), texte(" contre "), cible("Marmiton n° 1", "adv"), texte(".")]],
  ["jet", [texte("d10+1 contre 5, 1 désavantage → "), de(0, "7/10 → 7", true), entre(), de(1, "9/3 → 3", false), texte(" : 1 réussite, "), lettre("A = 3"), texte(", +1 contre l'armure (Réduction).")]],
  ["localisation", [texte("Localisation d20 → 16 : bras gauche.")]],
  ["degats", [texte("Armure 15 → 11.")]],
]);

// Un jet de caractéristique, en une phrase, et ses explosions : un d6 contre
// 8, dont la face maximale explose (écrit à la main, hors du combat de
// référence).
const GOUTER = ligne("geste", [
  [
    "jet",
    [
      acteur("Aubépine", "pj"),
      texte(" : "),
      capacite("Goûter"),
      texte(", d6 (Savoir sauvage + Sens) contre 8 (très difficile) → "),
      de(0, "6 explose, + 6 = 12", true),
      entre(),
      de(1, "6 explose, + 2 = 8", true),
      entre(),
      de(2, "2", false),
      texte(" : 2 réussites."),
    ],
  ],
]);

// La ligne en cours de la Taloche, pendant la chaîne : un dé qui attend une
// relance garde son « ✗ ».
const TALOCHE_EN_COURS = ligne(
  "geste",
  [
    ["ouverture", TALOCHE.segments.filter((segment) => segment.phrase === 0)],
    ["jet", [texte("d8+1 (Force + Agilité) contre 5, 1 avantage → "), de(0, "8", true), entre(), de(1, "4", false)]],
  ],
  { enCours: true },
);

// La ligne en cours du Goûter : un dé qui attend d'exploser, sans signe ni somme.
const GOUTER_EN_COURS = ligne(
  "geste",
  [["jet", [acteur("Aubépine", "pj"), texte(" : "), capacite("Goûter"), texte(", d6 (Savoir sauvage + Sens) contre 8 (très difficile) → "), de(0, "6", null)]]],
  { enCours: true },
);

const annulation = (texteDuGeste, barre) => ligne("annule", [["annule", [texte(`Annulé : ${texteDuGeste}.`)]]], { barre });

// ─── Les outils ─────────────────────────────────────────────────────────────

/** Un nœud en arbre lisible : un texte, ou { "balise.classes": [enfants] }. */
function arbre(noeud) {
  return noeud.childNodes.map((enfant) => (enfant.tagName ? { [`${enfant.tagName.toLowerCase()}.${enfant.className}`]: arbre(enfant) } : enfant.textContent));
}

/** Les nœuds d'une ligne, posés dans un paragraphe. */
function poser(noeuds) {
  const boite = document.createElement("p");
  boite.append(...noeuds);
  return boite;
}

const avecDom = (faire) => {
  const retirer = installerDom();
  try {
    return faire();
  } finally {
    retirer();
  }
};

// Ce qui se colore dans un nœud : [classe, texte] de chaque span qui n'est ni
// un cadre ni un dé.
const colores = (noeud) =>
  [...noeud.descendants()].filter((e) => e.tagName === "SPAN" && !["combat-cadre-jet", "combat-de-insecable"].includes(e.className)).map((e) => [e.className, e.textContent]);

/** Une vue du journal à la forme de vueJournal (§ 8.7), qui note chaque « depuis ». */
function vueJournalEssai(appels = []) {
  const vueJournal = (etat, depuis = 0) => {
    appels.push(depuis);
    const journal = etat.journal;
    const lignes = [];
    for (let rang = depuis; rang < journal.length; rang += 1) {
      const une = journal[rang];
      const barree = une.genre !== "annule" && journal.some((autre, k) => k >= depuis && k > rang && autre.genre === "annule" && autre.barre[0] <= rang && rang < autre.barre[1]);
      lignes.push(vue(une, rang, barree));
    }
    return { total: journal.length, lignes };
  };
  return { vueJournal, appels };
}

// La longueur, en signes, du texte que des morceaux donnent : chaque phrase,
// « […] » (3), la première coupée et son « … », une espace entre deux
// morceaux, le « … » d'une ligne en cours.
function longueur(faite, morceaux) {
  const phrase = (k) => [...faite.segments.filter((segment) => segment.phrase === k).map((segment) => segment.texte).join("")].length;
  const parties = morceaux.map((morceau) => (morceau.coupe ? 3 : morceau.jusqua !== undefined ? morceau.jusqua + 1 : phrase(morceau.phrase)));
  const suite = faite.segments.some((segment) => segment.type === "suite") ? 1 : 0;
  return parties.reduce((somme, n) => somme + n, 0) + Math.max(0, parties.length - 1) + suite;
}

/** couperLaLigne sous un budget de signes : la coupe, et chaque essai. */
function couperSous(faite, budget) {
  const essais = [];
  const morceaux = couperLaLigne(faite, (essai) => {
    essais.push(essai);
    return longueur(faite, essai) <= budget;
  });
  return { morceaux, essais };
}

const P = (phrase) => ({ phrase });
const C = { coupe: true };

/** Un bandeau monté, ses services espionnés : tient suit un budget de signes. */
function monterLeBandeau({ budget = Infinity } = {}) {
  const espion = { montrer: 0, mesures: 0, surveilles: [], arrets: 0, budget };
  const bandeau = creerBandeau({
    montrerLeJournal: () => {
      espion.montrer += 1;
    },
    tient: (noeud) => {
      espion.mesures += 1;
      return [...noeud.textContent].length <= espion.budget;
    },
    surveiller: (noeud, rappel) => {
      espion.surveilles.push({ noeud, rappel });
      return () => {
        espion.arrets += 1;
      };
    },
  });
  const partie = (classe) => bandeau.noeud.querySelector(`.${classe}`);
  return { bandeau, espion, texte: partie("combat-bandeau-texte"), entier: partie("combat-bandeau-entier"), bouton: partie("combat-bandeau-journal") };
}

// ─── a) Chaque segment et sa classe ─────────────────────────────────────────

test("chaque segment et sa classe, et rien d'autre de coloré ; le texte des nœuds est celui de la ligne", () => {
  avecDom(() => {
    const emincer = poser(ligneEnNoeuds(vue(EMINCER)));
    assert.equal(emincer.textContent, EMINCER.texte);
    assert.deepEqual(colores(emincer), [
      ["combat-seg-pj", "Aubépine"],
      ["combat-seg-capacite", "Émincer"],
      ["combat-seg-adv", "Marmiton n° 1"],
      ["combat-seg-reussite", "✓"],
      ["combat-seg-reussite", "✓"],
      ["combat-seg-echec", "✗"],
      ["combat-seg-valeur", "B = 8"],
      ["combat-seg-valeur", "20"],
      ["combat-mort", "Marmiton n° 1 meurt."],
    ]);
    // Les sources, la zone, le bilan et le nom répété dans la mort restent
    // du texte : un nœud texte, hors de tout span.
    const textes = emincer.childNodes.filter((enfant) => !enfant.tagName).map((enfant) => enfant.textContent);
    for (const reste of ["Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent.", "Localisation d20 → 20 : tête.", "Armure 5 → 0, endurance 5 → 0, corps 10 → 0.", " (4 souffle) contre ", " : 2 réussites, "]) {
      assert.ok(textes.includes(reste), reste);
    }

    const defense = poser(ligneEnNoeuds(vue(DEFENSE)));
    assert.equal(defense.textContent, DEFENSE.texte);
    assert.deepEqual(colores(defense), [
      ["combat-seg-adv", "Marmiton n° 1"],
      ["combat-seg-capacite", "Frappe"],
      ["combat-seg-pj", "Aubépine"],
      ["combat-seg-reussite", "✓"],
      ["combat-seg-echec", "✗"],
      ["combat-seg-valeur", "B = 10"],
    ]);

    // Les lignes du cadre : « — Tour… — » à l'accent, « Fin du tour… » en
    // retrait, le lancement et la fin sans couleur.
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(TOUR_1)))), [{ "span.combat-seg-tour": ["— Tour 1 · camp des PJ —"] }]);
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(FIN_DU_TOUR)))), [{ "span.combat-seg-fin": ["Fin du tour des PJ : ils retrouvent leurs actions."] }]);
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(LANCEMENT)))), [LANCEMENT.texte]);
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(FIN)))), [FIN.texte]);
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(PASSE)))), [{ "span.combat-seg-adv": ["Marmiton n° 2"] }, " passe son tour."]);

    // L'arbre entier d'une ligne de deux phrases : l'espace qui les joint
    // n'est d'aucune phrase, ni d'aucun span.
    assert.deepEqual(arbre(poser(ligneEnNoeuds(vue(MANQUEE)))), [
      { "span.combat-seg-pj": ["Aubépine"] },
      " : ",
      { "span.combat-seg-capacite": ["Frappe"] },
      " contre ",
      { "span.combat-seg-adv": ["Chef"] },
      ".",
      " ",
      "d10+1 contre 7 → ",
      { "span.combat-cadre-jet": [{ "span.combat-de-insecable": ["6 ", { "span.combat-seg-echec": ["✗"] }] }] },
      " : aucune réussite, manqué.",
    ]);
  });
});

test("un type inconnu, un nom sans camp et la suite d'une ligne en cours restent du texte", () => {
  avecDom(() => {
    const forgee = ligne("geste", [
      [
        "ouverture",
        [
          acteur("Aubépine", "pj"),
          { type: "inconnu", texte: " [inconnu] " },
          { type: "toString", texte: "toString " },
          { type: "constructor", texte: "constructor " },
          { type: "acteur", texte: "Mouette chapardeuse" },
          texte(" et "),
          cible("Marmiton de corvée bis", "neutre"),
          { type: "cible", texte: " ou __proto__", camp: "__proto__" },
          texte("."),
        ],
      ],
    ], { enCours: true });
    const noeuds = ligneEnNoeuds(vue(forgee));
    assert.ok(noeuds.every((noeud) => noeud instanceof Node));
    assert.deepEqual(arbre(poser(noeuds)), [
      { "span.combat-seg-pj": ["Aubépine"] },
      " [inconnu] ",
      "toString ",
      "constructor ",
      "Mouette chapardeuse",
      " et ",
      "Marmiton de corvée bis",
      " ou __proto__",
      ".",
      SUITE,
    ]);
    // Une ligne sans segments ne montre rien : la vue lui en donne toujours.
    assert.deepEqual(ligneEnNoeuds({ texte: "Aubépine", segments: [] }), []);
    assert.deepEqual(ligneEnNoeuds(null), []);
  });
});

// ─── b) Les cadres ──────────────────────────────────────────────────────────

test("les cadres : un par jet, un dé d'un seul tenant par essai, les séparateurs entre eux, aucune espace insécable", () => {
  avecDom(() => {
    const cadreDe = (faite) => arbre(poser(ligneEnNoeuds(vue(faite)))).filter((partie) => typeof partie === "object" && partie["span.combat-cadre-jet"]).map((partie) => partie["span.combat-cadre-jet"]);
    const reussi = (valeur) => ({ "span.combat-de-insecable": [`${valeur} `, { "span.combat-seg-reussite": ["✓"] }] });
    const echoue = (valeur) => ({ "span.combat-de-insecable": [`${valeur} `, { "span.combat-seg-echec": ["✗"] }] });

    assert.deepEqual(cadreDe(MANQUEE), [[echoue("6")]], "un seul dé s'encadre seul");
    assert.deepEqual(cadreDe(EMINCER), [[reussi("5"), ", ", reussi("9"), ", ", echoue("4")]], "trois dés");
    assert.deepEqual(cadreDe(DESAVANTAGE), [[reussi("7/10 → 7"), ", ", echoue("9/3 → 3")]], "le désavantage : ses lancers et sa flèche dans le dé");
    assert.deepEqual(cadreDe(TALOCHE), [[reussi("8"), ", ", echoue("4"), ", relancé ", reussi("6"), ", ", reussi("9")]], "une relance : « relancé » entre deux dés");
    assert.deepEqual(cadreDe(GOUTER), [[reussi("6 explose, + 6 = 12"), ", ", reussi("6 explose, + 2 = 8"), ", ", echoue("2")]], "une explosion : la valeur, l'ajout et la somme dans le même dé");
    assert.deepEqual(cadreDe(GOUTER_EN_COURS), [[{ "span.combat-de-insecable": ["6"] }]], "un dé qui attend : sans signe");

    // Chaque dé insécable porte un seul dé, et le dé de localisation n'est
    // pas encadré.
    const taloche = poser(ligneEnNoeuds(vue(TALOCHE)));
    assert.deepEqual([...taloche.querySelectorAll(".combat-de-insecable")].map((noeud) => noeud.textContent), ["8 ✓", "4 ✗", "6 ✓", "9 ✓"]);
    assert.equal(taloche.querySelectorAll(".combat-cadre-jet").length, 1);
    assert.ok(!taloche.querySelector(".combat-cadre-jet").textContent.includes("Localisation"));
    assert.equal(taloche.textContent, TALOCHE.texte);

    // Deux jets qui se suivent : deux cadres.
    const deux = ligne("geste", [["jet", [texte("→ "), de(0, "7", true, 0), de(0, "3", false, 1), texte(".")]]]);
    assert.deepEqual(cadreDe(deux), [[reussi("7")], [echoue("3")]]);
    // Deux dés qui se suivent dans un même cadre : deux insécables.
    const colles = ligne("geste", [["jet", [texte("→ "), de(0, "7", true), de(1, "3", false), texte(".")]]]);
    assert.deepEqual(cadreDe(colles), [[reussi("7"), echoue("3")]]);

    // La ligne en cours : « … » hors du cadre, en dernier.
    const enCours = poser(ligneEnNoeuds(vue(TALOCHE_EN_COURS)));
    assert.equal(enCours.textContent, TALOCHE_EN_COURS.texte);
    assert.equal(enCours.childNodes.at(-1).textContent, SUITE);
    assert.equal(enCours.childNodes.at(-1).tagName, undefined);

    for (const faite of [EMINCER, DEFENSE, TALOCHE, DESAVANTAGE, GOUTER, GOUTER_EN_COURS, TALOCHE_EN_COURS, MANQUEE, FOURNAISE]) {
      const texteDeLaPage = poser(ligneEnNoeuds(vue(faite))).textContent;
      for (const insecable of INSECABLES) assert.ok(!texteDeLaPage.includes(insecable), faite.texte);
    }
  });
});

// ─── c) La liste ────────────────────────────────────────────────────────────

test("la liste : les lignes neuves seules, la dernière montrée, le tour marqué", () => {
  avecDom(() => {
    const { vueJournal, appels } = vueJournalEssai();
    const liste = creerListe({ vueJournal });
    assert.equal(liste.noeud.tagName, "OL");
    assert.equal(liste.noeud.className, "combat-lignes");
    assert.equal(liste.noeud.getAttribute("tabindex"), "0");
    assert.equal(liste.noeud.getAttribute("aria-label"), "Journal du combat");

    // Avant le lancement : rien.
    assert.deepEqual(liste.rendre({ journal: [] }), { ajoutees: 0, reposee: false });
    assert.equal(liste.noeud.children.length, 0);

    const journal = [LANCEMENT, TOUR_1, TALOCHE];
    liste.noeud.scrollHeight = 480;
    assert.deepEqual(liste.rendre({ journal }), { ajoutees: 3, reposee: false });
    assert.deepEqual(appels, [0]);
    assert.equal(liste.noeud.scrollTop, 480, "la dernière ligne se montre");
    const premieres = [...liste.noeud.children];
    assert.deepEqual(premieres.map((li) => li.textContent), journal.map((une) => une.texte));
    assert.deepEqual(premieres.map((li) => li.className), ["", "tour", ""]);
    assert.ok(premieres[2].querySelector(".combat-cadre-jet"), "les segments, dans la liste aussi");

    // Deux lignes de plus : elles seules se posent, les autres restent.
    liste.noeud.scrollHeight = 620;
    assert.deepEqual(liste.rendre({ journal: [...journal, PAS_CHASSE, FIN_DU_TOUR] }), { ajoutees: 2, reposee: false });
    assert.deepEqual(appels, [0, 3]);
    assert.equal(liste.noeud.scrollTop, 620);
    assert.deepEqual([...liste.noeud.children].slice(0, 3), premieres);
    assert.equal(liste.noeud.children.length, 5);

    // Rien de neuf : rien ne se pose, rien ne défile.
    liste.noeud.scrollTop = 12;
    assert.deepEqual(liste.rendre({ journal: [...journal, PAS_CHASSE, FIN_DU_TOUR] }), { ajoutees: 0, reposee: false });
    assert.equal(liste.noeud.scrollTop, 12);
    assert.equal(liste.noeud.children.length, 5);
  });
});

test("les lignes barrées : par la plage d'une ligne « Annulé », celles déjà posées comme les neuves, jamais la ligne « Annulé »", () => {
  avecDom(() => {
    const { vueJournal } = vueJournalEssai();
    const liste = creerListe({ vueJournal });
    const journal = [LANCEMENT, TOUR_1, TALOCHE, PAS_CHASSE];
    liste.rendre({ journal });
    const classes = () => [...liste.noeud.children].map((li) => li.className);

    // Une ligne « Annulé » neuve barre les lignes déjà posées de sa plage.
    const annuleLePas = annulation("Aubépine — Pas chassé [1]", [3, 4]);
    const apres = [...journal, annuleLePas];
    assert.deepEqual(liste.rendre({ journal: apres }), { ajoutees: 1, reposee: false });
    assert.deepEqual(classes(), ["", "tour", "", "combat-annulee", ""]);
    assert.equal(liste.noeud.children[4].textContent, "Annulé : Aubépine — Pas chassé [1].");

    // Une plage qui couvre une fin de tour et le tour qui suit : la ligne
    // « tour » garde sa classe, et gagne la barre.
    const suite = [...apres, PAS_CHASSE, FIN_DU_TOUR, TOUR_2];
    liste.rendre({ journal: suite });
    const annuleLaFin = annulation("la fin du tour des PJ", [6, 8]);
    liste.rendre({ journal: [...suite, annuleLaFin] });
    assert.deepEqual(classes(), ["", "tour", "", "combat-annulee", "", "", "combat-annulee", "tour combat-annulee", ""]);

    // Posées d'un coup (un combat repris), les mêmes lignes sont barrées, par
    // la vue.
    const neuve = creerListe({ vueJournal });
    neuve.rendre({ journal: [...suite, annuleLaFin] });
    assert.deepEqual([...neuve.noeud.children].map((li) => li.className), classes());

    // La plage d'une ligne neuve ne barre que des lignes déjà posées, en
    // ignorant ce qui sort du journal ; une ligne « Annulé » ne l'est jamais,
    // même dans la plage d'une autre.
    const bornee = creerListe({ vueJournal });
    const annuleLeLancement = annulation("Aubépine — Pas chassé [1]", [0, 1]);
    bornee.rendre({ journal: [LANCEMENT, annuleLeLancement, TOUR_1] });
    assert.deepEqual([...bornee.noeud.children].map((li) => li.className), ["combat-annulee", "", "tour"]);
    bornee.rendre({ journal: [LANCEMENT, annuleLeLancement, TOUR_1, annulation("Aubépine — passer son tour", [-3, 40])] });
    assert.deepEqual([...bornee.noeud.children].map((li) => li.className), ["combat-annulee", "", "tour combat-annulee", ""]);
    // Le texte copié ne change pas : la barre n'est qu'une classe.
    assert.equal(bornee.noeud.children[0].textContent, LANCEMENT.texte);
  });
});

test("un autre journal se repose en entier : premier objet changé, dernier objet changé, journal plus court", () => {
  avecDom(() => {
    const { vueJournal, appels } = vueJournalEssai();
    const liste = creerListe({ vueJournal });
    const journal = [LANCEMENT, TOUR_1, TALOCHE];
    liste.rendre({ journal });
    const avant = [...liste.noeud.children];

    // Un combat repris : un autre premier objet, au même texte.
    const repris = [{ ...LANCEMENT }, TOUR_1, TALOCHE, PAS_CHASSE];
    liste.noeud.scrollHeight = 300;
    assert.deepEqual(liste.rendre({ journal: repris }), { ajoutees: 4, reposee: true });
    assert.equal(appels.at(-1), 0);
    assert.equal(liste.noeud.children.length, 4);
    assert.ok([...liste.noeud.children].every((li) => !avant.includes(li)), "tout est reposé");
    assert.equal(liste.noeud.scrollTop, 300);

    // Le dernier objet posé a changé.
    const autre = [repris[0], TOUR_1, TALOCHE, { ...PAS_CHASSE }, FIN_DU_TOUR];
    assert.deepEqual(liste.rendre({ journal: autre }), { ajoutees: 5, reposee: true });
    assert.deepEqual([...liste.noeud.children].map((li) => li.textContent), autre.map((une) => une.texte));

    // Un combat neuf : le journal vide.
    assert.deepEqual(liste.rendre({ journal: [] }), { ajoutees: 0, reposee: true });
    assert.equal(liste.noeud.children.length, 0);
    assert.deepEqual(liste.rendre({ journal: [] }), { ajoutees: 0, reposee: false });
    assert.deepEqual(liste.rendre({ journal: [LANCEMENT] }), { ajoutees: 1, reposee: false });
  });
});

// ─── d) Le bandeau ──────────────────────────────────────────────────────────

test("le bandeau : caché avant le lancement, ni bouton ni région, son étiquette, le texte caché aux lecteurs d'écran et la ligne entière", () => {
  avecDom(() => {
    const { bandeau, espion, texte: coupe, entier, bouton } = monterLeBandeau();
    const { noeud } = bandeau;
    assert.equal(noeud.tagName, "DIV");
    assert.equal(noeud.className, "combat-bandeau");
    assert.equal(noeud.hidden, true, "caché avant le lancement");
    assert.deepEqual(
      noeud.children.map((enfant) => `${enfant.tagName.toLowerCase()}.${enfant.className}`),
      ["span.combat-bandeau-etiquette", "div.combat-bandeau-texte", "span.combat-bandeau-entier", "button.bouton secondaire combat-bandeau-journal"],
    );
    assert.equal(texteDe(noeud.querySelector(".combat-bandeau-etiquette")), "Dernier événement");
    assert.equal(coupe.getAttribute("aria-hidden"), "true");
    assert.equal(entier.getAttribute("aria-hidden"), null);
    assert.equal(bouton.getAttribute("type"), "button");
    assert.equal(bouton.textContent, `Journal ${String.fromCodePoint(0x2193)}`);
    for (const attribut of ["role", "aria-live", "tabindex", "aria-label"]) assert.equal(noeud.getAttribute(attribut), null, attribut);
    assert.equal(noeud.querySelectorAll("button").length, 1, "un seul bouton, « Journal ↓ »");
    assert.equal(noeud.querySelectorAll("a").length, 0, "jamais un lien : « #… » changerait la route");
    assert.equal(espion.surveilles.length, 1);
    assert.equal(espion.surveilles[0].noeud, coupe, "la mesure porte sur le texte coupé");

    // rendre(null) : rien ne change, rien ne se mesure.
    bandeau.rendre(null);
    assert.equal(noeud.hidden, true);
    assert.equal(espion.mesures, 0);

    // La dernière ligne du journal.
    bandeau.rendre({ enCours: false, ligne: vue(EMINCER, 11) });
    assert.equal(noeud.hidden, false);
    assert.equal(noeud.className, "combat-bandeau");
    assert.equal(noeud.getAttribute("title"), EMINCER.texte);
    assert.equal(entier.textContent, EMINCER.texte);
    assert.equal(coupe.textContent, EMINCER.texte);
    assert.deepEqual(arbre(coupe), arbre(poser(ligneEnNoeuds(vue(EMINCER)))), "avec ses couleurs et ses cadres");
    assert.equal(espion.mesures, 1);

    // La même vue : rien ne se refait.
    const posee = coupe.childNodes[0];
    bandeau.rendre({ enCours: false, ligne: vue(EMINCER, 11) });
    assert.equal(espion.mesures, 1);
    assert.equal(coupe.childNodes[0], posee);

    // La ligne en cours : bordée de l'alerte, son « … » en dernier.
    bandeau.rendre({ enCours: true, ligne: vue(TALOCHE_EN_COURS) });
    assert.equal(noeud.className, "combat-bandeau combat-bandeau-en-cours");
    assert.equal(noeud.getAttribute("title"), TALOCHE_EN_COURS.texte);
    assert.equal(entier.textContent, TALOCHE_EN_COURS.texte);
    assert.equal(coupe.textContent, TALOCHE_EN_COURS.texte);
    assert.equal(espion.mesures, 2);

    // Le geste fini : sa ligne définitive, sans l'alerte.
    bandeau.rendre({ enCours: false, ligne: vue(TALOCHE, 12) });
    assert.equal(noeud.className, "combat-bandeau");
    assert.equal(coupe.textContent, TALOCHE.texte);

    // Un combat neuf le cache ; la même ligne, ensuite, le remontre.
    bandeau.rendre(null);
    assert.equal(noeud.hidden, true);
    bandeau.rendre({ enCours: false, ligne: vue(TALOCHE, 12) });
    assert.equal(noeud.hidden, false);
    assert.equal(coupe.textContent, TALOCHE.texte);
    assert.equal(espion.montrer, 0, "rien ne mène au journal de lui-même");
  });
});

// ─── e) La coupe ────────────────────────────────────────────────────────────

test("la coupe à six phrases : la première et le jet d'abord, puis la fin, de la dernière vers le jet", () => {
  // Les longueurs : 52, 82, 107, 29, 44 et 20 signes ; 339 en tout.
  const essaiDe = (budget) => couperSous(EMINCER, budget).morceaux;
  assert.deepEqual(essaiDe(339), [P(0), P(1), P(2), P(3), P(4), P(5)], "tout tient");
  assert.deepEqual(essaiDe(338), [P(0), C, P(2), P(3), P(4), P(5)], "les sources ôtées seules");
  assert.deepEqual(essaiDe(259), [P(0), C, P(2), C, P(4), P(5)]);
  assert.deepEqual(essaiDe(200), [P(0), C, P(2), C, P(5)], "la mort, phrase finale, avant les dégâts");
  assert.deepEqual(essaiDe(170), [P(0), C, P(2), C], "la première et le jet, seuls");

  // Les essais, dans l'ordre : toutes, le minimum, puis de la fin vers le jet,
  // jusqu'au premier qui ne tient pas.
  assert.deepEqual(couperSous(EMINCER, 200).essais, [
    [P(0), P(1), P(2), P(3), P(4), P(5)],
    [P(0), C, P(2), C],
    [P(0), C, P(2), C, P(5)],
    [P(0), C, P(2), C, P(4), P(5)],
  ]);

  // Le premier qui ne tient pas arrête la remontée, même si un plus long
  // tiendrait.
  const sansLesDegatsSeuls = couperLaLigne(EMINCER, (morceaux) => {
    const gardees = new Set(morceaux.filter((morceau) => morceau.phrase !== undefined).map((morceau) => morceau.phrase));
    return morceaux.some((morceau) => morceau.coupe) && !(gardees.has(4) && !gardees.has(3));
  });
  assert.deepEqual(sansLesDegatsSeuls, [P(0), C, P(2), C, P(5)]);
});

test("la coupe : la première phrase coupée par « … », en unités entières, puis par mots, puis par points de code d'un nom", () => {
  // Six phrases : le minimum fait 168 signes ; sous lui, la première se
  // coupe, suivie de « […] », du jet et de « […] » (117 signes de plus).
  const coupe = (budget) => couperSous(EMINCER, budget).morceaux;
  assert.deepEqual(coupe(140), [{ phrase: 0, jusqua: 21 }, C, P(2), C], "« Aubépine : Émincer (4… » : par mots");
  assert.deepEqual(coupe(125), [{ phrase: 0, jusqua: 8 }, C, P(2), C], "« Aubépine… » : le nom entier, « : » ne tient pas");
  // Sous 125, le nom de qui agit ne se coupe pas : voir le contrôle « quand
  // même le minimum ne tient pas ».

  // Deux phrases (30 et 47 signes) : la première et le jet sont toutes les
  // phrases ; rien n'est ôté, aucune coupe « […] ».
  const manquee = (budget) => couperSous(MANQUEE, budget).morceaux;
  assert.deepEqual(manquee(78), [P(0), P(1)]);
  assert.deepEqual(manquee(77), [{ phrase: 0, jusqua: 28 }, P(1)], "« … contre Che… »");
  assert.deepEqual(manquee(72), [{ phrase: 0, jusqua: 17 }, P(1)], "« contre » ne tient pas : « Aubépine : Frappe… »");
  assert.deepEqual(manquee(62), [{ phrase: 0, jusqua: 13 }, P(1)], "« Aubépine : Fr… »");

  // Trois phrases (57, 59 et 29) : la localisation ôtée, puis la première
  // coupée dans le nom de la cible.
  const fournaise = (budget) => couperSous(FOURNAISE, budget).morceaux;
  assert.deepEqual(fournaise(147), [P(0), P(1), P(2)]);
  assert.deepEqual(fournaise(146), [P(0), P(1), C]);
  assert.deepEqual(fournaise(121), [P(0), P(1), C]);
  assert.deepEqual(fournaise(120), [{ phrase: 0, jusqua: 55 }, P(1), C]);

  // Une phrase seule, celle d'un jet de caractéristique : coupée, jamais dans
  // un dé (le deuxième dé, à 97 signes, ne tient pas entier en 102).
  assert.deepEqual(couperSous(GOUTER, 137).morceaux, [P(0)]);
  assert.deepEqual(couperSous(GOUTER, 103).morceaux, [{ phrase: 0, jusqua: 97 }]);
  assert.deepEqual(couperSous(GOUTER, 116).morceaux, [{ phrase: 0, jusqua: 97 }]);
  assert.deepEqual(couperSous(GOUTER, 117).morceaux, [{ phrase: 0, jusqua: 97 }], "un dé ne se sépare pas de son signe");
  assert.deepEqual(couperSous(GOUTER, 118).morceaux, [{ phrase: 0, jusqua: 117 }]);
  assert.deepEqual(couperSous(GOUTER, 119).morceaux, [{ phrase: 0, jusqua: 117 }], "un séparateur du cadre ne se coupe pas");

  // Une ligne sans phrase n'a rien à couper.
  assert.deepEqual(couperLaLigne({ segments: [], phrases: [] }, () => false), []);
});

test("le bandeau coupé à 2, 3 et 6 phrases : « […] » entouré d'une espace, le « … » de la ligne en cours en dernier, aucun dé coupé", () => {
  avecDom(() => {
    const montrer = (faite, budget, enCours = false) => {
      const { bandeau, texte: coupe, entier } = monterLeBandeau({ budget });
      bandeau.rendre({ enCours, ligne: vue(faite) });
      assert.equal(entier.textContent, faite.texte, "la ligne entière, pour les lecteurs d'écran");
      assert.equal(bandeau.noeud.getAttribute("title"), faite.texte);
      return coupe;
    };

    const six = montrer(EMINCER, 200);
    assert.equal(
      six.textContent,
      `Aubépine : Émincer (4 souffle) contre Marmiton n° 1. ${COUPE} d10+1 contre 5 → 5 ✓, 9 ✓, 4 ✗ : 2 réussites, B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction). ${COUPE} Marmiton n° 1 meurt.`,
    );
    assert.deepEqual([...six.querySelectorAll(".combat-bandeau-coupe")].map((noeud) => noeud.textContent), [COUPE, COUPE]);
    assert.equal(six.querySelectorAll(".combat-cadre-jet").length, 1);
    assert.equal(six.querySelectorAll(".combat-de-insecable").length, 3);
    assert.deepEqual(colores(six).filter(([classe]) => classe !== "combat-bandeau-coupe").map(([, contenu]) => contenu), ["Aubépine", "Émincer", "Marmiton n° 1", "✓", "✓", "✗", "B = 8", "20", "Marmiton n° 1 meurt."]);

    const coupee = montrer(EMINCER, 140);
    assert.equal(coupee.textContent, `Aubépine : Émincer (4${SUITE} ${COUPE} d10+1 contre 5 → 5 ✓, 9 ✓, 4 ✗ : 2 réussites, B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction). ${COUPE}`);
    const trois = montrer(FOURNAISE, 120);
    assert.equal(trois.textContent, `Aubépine : Fournaise [1] (1 souffle, 1 lien) contre Che${SUITE} d10+1 contre 7, 1 avantage → 9 ✓, 5 ✗ : 1 réussite, touché. ${COUPE}`);
    assert.deepEqual(arbre(trois).slice(4, 7), [{ "span.combat-seg-adv": ["Che"] }, SUITE, " "], "un nom coupé garde sa couleur");

    const deux = montrer(MANQUEE, 72);
    assert.equal(deux.textContent, `Aubépine : Frappe${SUITE} d10+1 contre 7 → 6 ✗ : aucune réussite, manqué.`);
    assert.equal(deux.querySelectorAll(".combat-bandeau-coupe").length, 0);

    // Le jet de caractéristique : le deuxième dé ne tient pas, il part entier.
    const gouter = montrer(GOUTER, 103);
    assert.equal(gouter.textContent, `Aubépine : Goûter, d6 (Savoir sauvage + Sens) contre 8 (très difficile) → 6 explose, + 6 = 12 ✓, ${SUITE}`);
    assert.deepEqual([...gouter.querySelectorAll(".combat-de-insecable")].map((noeud) => noeud.textContent), ["6 explose, + 6 = 12 ✓"]);

    // La ligne en cours : son « … » reste en dernier, après la coupe.
    const enCours = montrer(TALOCHE_EN_COURS, 80, true);
    assert.equal(enCours.textContent, `Aubépine : Taloche [1]${SUITE} d8+1 (Force + Agilité) contre 5, 1 avantage → 8 ✓, 4 ✗${SUITE}`);
    assert.equal(enCours.childNodes.at(-1).textContent, SUITE);
    const localisation = ligne("geste", [...EMINCER.phrases.slice(0, 4).map((genre, k) => [genre, EMINCER.segments.filter((segment) => segment.phrase === k)])], { enCours: true });
    const apresLeJet = montrer(localisation, 175, true);
    assert.equal(apresLeJet.textContent.endsWith(`(Réduction). ${COUPE}${SUITE}`), true, apresLeJet.textContent);
  });
});

test("quand même le minimum ne tient pas, la première phrase garde le nom de qui agit, entier, suivi de « … » ; sans lui, la règle première", () => {
  // Six phrases : sous 125 signes, même « Aubépine… » suivi de « […] », du
  // jet et de « […] » ne tient pas. Le nom reste, et la feuille rogne.
  const coupe = (budget) => couperSous(EMINCER, budget).morceaux;
  assert.deepEqual(coupe(120), [{ phrase: 0, jusqua: 8 }, C, P(2), C], "« Aubépine… » : le nom de qui agit ne se coupe pas");
  assert.deepEqual(coupe(100), [{ phrase: 0, jusqua: 8 }, C, P(2), C], "rien ne tient : « Aubépine… » reste, et la feuille rogne");
  assert.deepEqual(coupe(0), [{ phrase: 0, jusqua: 8 }, C, P(2), C]);
  const essaisCoupes = couperSous(EMINCER, 100).essais.flat().filter((morceau) => morceau.jusqua !== undefined);
  assert.ok(essaisCoupes.length > 0 && essaisCoupes.every((morceau) => morceau.jusqua >= 8), "aucun essai ne descend sous le nom");

  // Deux phrases, une défense (qui agit est un adversaire), une passe et un
  // jet de caractéristique : chacune s'ouvre sur qui agit, et le garde.
  assert.deepEqual(couperSous(MANQUEE, 50).morceaux, [{ phrase: 0, jusqua: 8 }, P(1)]);
  assert.deepEqual(couperSous(DEFENSE, 10).morceaux, [{ phrase: 0, jusqua: 13 }, C, P(2), C], "« Marmiton n° 1… »");
  assert.deepEqual(couperSous(PASSE, 5).morceaux, [{ phrase: 0, jusqua: 13 }]);
  assert.deepEqual(couperSous(GOUTER, 10).morceaux, [{ phrase: 0, jusqua: 8 }]);

  // Une ligne sans qui agit garde la règle première : par mots, et, si rien
  // ne tient, rien n'en reste.
  assert.deepEqual(couperSous(LANCEMENT, 20).morceaux, [{ phrase: 0, jusqua: 16 }], "« Combat lancé : 1… »");
  assert.deepEqual(couperSous(LANCEMENT, 0).morceaux, [{ phrase: 0, jusqua: 0 }]);

  // Au bandeau, par la mesure donnée : « Aubépine… » en tête, dans sa
  // couleur ; le texte dépasse le budget, la feuille le rogne.
  avecDom(() => {
    const montrer = (faite, budget, enCours = false) => {
      const { bandeau, texte: coupee } = monterLeBandeau({ budget });
      bandeau.rendre({ enCours, ligne: vue(faite) });
      return coupee;
    };
    const emincer = montrer(EMINCER, 100);
    assert.equal(emincer.textContent, `Aubépine${SUITE} ${COUPE} d10+1 contre 5 → 5 ✓, 9 ✓, 4 ✗ : 2 réussites, B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction). ${COUPE}`);
    assert.ok([...emincer.textContent].length > 100, "le minimum ne tient pas : la feuille rogne");
    assert.deepEqual(arbre(emincer).slice(0, 3), [{ "span.combat-seg-pj": ["Aubépine"] }, SUITE, " "], "le nom gardé garde sa couleur");

    const defense = montrer(DEFENSE, 10);
    assert.deepEqual(arbre(defense).slice(0, 4), [{ "span.combat-seg-adv": ["Marmiton n° 1"] }, SUITE, " ", { "span.combat-bandeau-coupe": [COUPE] }]);

    // La ligne en cours : le nom en tête, son « … » toujours en dernier.
    const enCours = montrer(TALOCHE_EN_COURS, 10, true);
    assert.equal(enCours.textContent, `Aubépine${SUITE} d8+1 (Force + Agilité) contre 5, 1 avantage → 8 ✓, 4 ✗${SUITE}`);
    assert.equal(enCours.childNodes.at(-1).textContent, SUITE);

    assert.equal(montrer(LANCEMENT, 0).textContent, SUITE, "sans qui agit, rien ne reste");
  });
});

// ─── f) La mesure, et le clic ───────────────────────────────────────────────

test("la coupe se refait à chaque ligne neuve et quand la largeur change, jamais pour la hauteur seule", () => {
  avecDom(() => {
    const { bandeau, espion, texte: coupe } = monterLeBandeau({ budget: 200 });
    const { rappel } = espion.surveilles[0];
    document.body.append(bandeau.noeud);

    // Sans ligne, un changement de taille ne mesure rien.
    coupe.rectangle = { width: 300, height: 60 };
    rappel();
    assert.equal(espion.mesures, 0);

    bandeau.rendre({ enCours: false, ligne: vue(EMINCER, 11) });
    const apresLaLigne = espion.mesures;
    assert.ok(apresLaLigne > 0);
    assert.ok(coupe.textContent.includes(COUPE));

    // La même largeur, une autre hauteur : rien.
    coupe.rectangle = { width: 300, height: 72 };
    rappel();
    assert.equal(espion.mesures, apresLaLigne);

    // Une autre largeur : la coupe se refait, à la mesure d'aujourd'hui.
    espion.budget = 1000;
    coupe.rectangle = { width: 520, height: 72 };
    rappel();
    assert.ok(espion.mesures > apresLaLigne);
    assert.equal(coupe.textContent, EMINCER.texte);
    const apresLaLargeur = espion.mesures;
    rappel();
    assert.equal(espion.mesures, apresLaLargeur, "la largeur est comparée à la précédente");

    // Caché, il ne se recoupe pas.
    bandeau.rendre(null);
    coupe.rectangle = { width: 0, height: 0 };
    rappel();
    assert.equal(espion.mesures, apresLaLargeur);

    // Retiré de la page, il cesse de surveiller.
    assert.equal(espion.arrets, 0);
    bandeau.noeud.remove();
    rappel();
    assert.equal(espion.arrets, 1);
  });
});

test("un bandeau construit hors de la page garde sa surveillance jusqu'à y entrer", () => {
  avecDom(() => {
    const { bandeau, espion, texte: coupe } = monterLeBandeau({ budget: 200 });
    const { rappel } = espion.surveilles[0];
    bandeau.rendre({ enCours: false, ligne: vue(EMINCER, 11) });
    rappel();
    assert.equal(espion.arrets, 0, "pas encore posé : il attend");
    document.body.append(bandeau.noeud);
    const avant = espion.mesures;
    coupe.rectangle = { width: 410, height: 60 };
    rappel();
    assert.ok(espion.mesures > avant);
  });
});

test("« Journal ↓ » et un clic à la souris sur le bandeau mènent au journal ; un doigt, jamais", () => {
  avecDom(() => {
    const { bandeau, espion, texte: coupe, bouton } = monterLeBandeau();
    const { noeud } = bandeau;
    bandeau.rendre({ enCours: false, ligne: vue(EMINCER, 11) });

    bouton.click();
    assert.equal(espion.montrer, 1, "« Journal ↓ »");
    // Le clic du bouton remonte au bandeau : il n'y compte pas deux fois.
    noeud.declencher("pointerdown", { pointerType: "mouse", target: bouton });
    noeud.declencher("click", { target: bouton });
    assert.equal(espion.montrer, 1);

    // Un clic à la souris sur le texte.
    noeud.declencher("pointerdown", { pointerType: "mouse", target: coupe });
    noeud.declencher("click", { target: coupe });
    assert.equal(espion.montrer, 2);

    // Au doigt, au stylet : rien.
    for (const appui of ["touch", "pen"]) {
      noeud.declencher("pointerdown", { pointerType: appui, target: coupe });
      noeud.declencher("click", { target: coupe });
    }
    assert.equal(espion.montrer, 2);

    // Un clic sans appui noté, ou après un clic déjà compté : rien.
    noeud.declencher("click", { target: coupe });
    noeud.declencher("pointerdown", { pointerType: "mouse", target: coupe });
    noeud.declencher("click", { target: coupe });
    noeud.declencher("click", { target: coupe });
    assert.equal(espion.montrer, 3);
  });
});

// ─── g) Les noms ────────────────────────────────────────────────────────────

// Des noms qui portent ce qu'un écran tenté de relire le texte y chercherait :
// le nom d'essai du groupe 1, et un nom qui imite une ligne « Annulé », une
// capacité à sa puissance, la suite d'une ligne en cours et la coupe.
const BRULOT = "Brûlot → ✓ contre tous";
const PIEGE = `Annulé : Mouette chapardeuse — [1] ${SUITE} ${COUPE} .`;

test("des noms piégés restent entiers dans leur segment, et rien de ce qu'ils portent ne compte", () => {
  avecDom(() => {
    const piegee = ligne("geste", [
      ["ouverture", [acteur(BRULOT, "pj"), texte(" : "), capacite("Taloche [1]"), texte(" contre "), cible(PIEGE, "adv"), texte(".")]],
      ["jet", [texte("d8 contre 5 → "), de(0, "4", false), texte(" : aucune réussite, manqué.")]],
    ]);
    const posee = poser(ligneEnNoeuds(vue(piegee)));
    assert.equal(posee.textContent, piegee.texte);
    assert.deepEqual(colores(posee), [
      ["combat-seg-pj", BRULOT],
      ["combat-seg-capacite", "Taloche [1]"],
      ["combat-seg-adv", PIEGE],
      ["combat-seg-echec", "✗"],
    ]);
    assert.equal(posee.querySelectorAll(".combat-seg-reussite").length, 0, "le « ✓ » d'un nom n'est pas un dé");

    // Au bandeau : tout tient, aucune coupe, quoi que dise le nom.
    const { bandeau, texte: coupe } = monterLeBandeau();
    bandeau.rendre({ enCours: false, ligne: vue(piegee, 4) });
    assert.equal(coupe.textContent, piegee.texte);
    assert.equal(coupe.querySelectorAll(".combat-bandeau-coupe").length, 0);
    // Coupé, le nom de la cible se coupe par ses points de code, comme tout
    // nom ; son « … » et son « […] » restent dans son segment.
    const large = monterLeBandeau({ budget: 130 });
    large.bandeau.rendre({ enCours: false, ligne: vue(piegee, 4) });
    const debut = [...PIEGE].slice(0, 40).join("");
    assert.equal(large.texte.textContent, `${BRULOT} : Taloche [1] contre ${debut}${SUITE} d8 contre 5 → 4 ✗ : aucune réussite, manqué.`);
    assert.deepEqual(colores(large.texte)[2], ["combat-seg-adv", debut]);
    assert.equal(large.texte.querySelectorAll(".combat-bandeau-coupe").length, 0);
    // Serré, le nom de qui agit reste entier, quoi qu'il porte (« → »,
    // « ✓ », « contre ») : la coupe le prend par son segment.
    const serre = monterLeBandeau({ budget: 60 });
    serre.bandeau.rendre({ enCours: false, ligne: vue(piegee, 4) });
    assert.equal(serre.texte.querySelectorAll(".combat-bandeau-coupe").length, 0);
    assert.equal(serre.texte.textContent, `${BRULOT}${SUITE} d8 contre 5 → 4 ✗ : aucune réussite, manqué.`);
  });
});

test("un nom hostile reste du texte, et ne commande pas le sens de l'écriture", () => {
  avecDom(() => {
    const balise = "<img src=x onerror=alert(1)>";
    const renverse = String.fromCodePoint(0x202e);
    // Le nom vient aussi dans un segment « texte » : une source d'un autre
    // protagoniste le cite.
    const hostile = ligne("geste", [
      ["ouverture", [acteur(`Aubépine ${balise}${renverse}`, "pj"), texte(" : "), capacite(`Frappe${renverse}`), texte(" contre "), cible("Chef", "adv"), texte(".")]],
      ["sources", [texte(`Son avantage (Solo du chef de Chef${renverse}) et son désavantage (types d'armure mêlés de Aubépine ${balise}${renverse}) s'annulent.`)]],
    ]);
    const attendu = hostile.texte.replaceAll(renverse, "");
    const posee = poser(ligneEnNoeuds(vue(hostile)));
    assert.equal(posee.textContent, attendu);
    assert.equal(posee.querySelectorAll("img").length, 0);

    const { bandeau, texte: coupe, entier } = monterLeBandeau();
    bandeau.rendre({ enCours: false, ligne: vue(hostile, 2) });
    assert.equal(coupe.textContent, attendu);
    assert.equal(entier.textContent, attendu);
    assert.equal(bandeau.noeud.getAttribute("title"), attendu);
    assert.equal(bandeau.noeud.querySelectorAll("img").length, 0);

    const { vueJournal } = vueJournalEssai();
    const liste = creerListe({ vueJournal });
    liste.rendre({ journal: [hostile] });
    assert.equal(liste.noeud.textContent, attendu);
  });
});

// ─── h) Le module ───────────────────────────────────────────────────────────

test("le module : dom.js seul, ni HTML ni style, aucun défilement de la page, une seule écriture de scrollTop", () => {
  const imports = [...SOURCE.matchAll(/^\s*import\s+([^;]*?)\s+from\s+"([^"]+)";/gm)].map(([, quoi, chemin]) => [quoi, chemin]);
  assert.deepEqual(imports, [["{ el, sansSensForce }", "./dom.js"]]);
  assert.ok(!/\bimport\s*\(/.test(SOURCE), "aucun import dynamique");
  const exports = [...SOURCE.matchAll(/^export\s+(?:function|const)\s+(\w+)/gm)].map(([, nom]) => nom).sort();
  assert.deepEqual(exports, ["couperLaLigne", "creerBandeau", "creerListe", "ligneEnNoeuds"]);
  for (const interdit of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", ".style", "cssText", "getComputedStyle", "aria-live", "localStorage", "indexedDB", ".focus(", "scrollIntoView", "scrollBy", "window.scroll", "ResizeObserver", "matchMedia"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans le journal`);
  }
  assert.doesNotMatch(SOURCE, /\bstyle\s*[:=]|setAttribute\(\s*["'`]style/, "aucun style écrit par le code");
  assert.doesNotMatch(SOURCE, /scrollTo\b/, "ni scrollTo");
  assert.equal(SOURCE.match(/scrollTop\s*=[^=]/g)?.length, 1, "un seul scrollTop =, celui de la liste du journal");
  // Le texte d'une ligne ne se relit jamais pour y chercher un nom.
  assert.doesNotMatch(SOURCE, /\.texte\.(?:split|indexOf|includes|match|search|replace|startsWith|endsWith)\(/);
  for (const insecable of INSECABLES) assert.ok(!SOURCE.includes(insecable), "aucune espace insécable écrite telle quelle");
  assert.match(SOURCE, /^\/\/ Le journal du combat et le bandeau « Dernier événement »/);
  assert.match(SOURCE, /SPECIFICATION\.md, § 17/);
});
