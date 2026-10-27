// Le combat de référence fictif du simulateur de combat (SPECIFICATION.md,
// § 17, « Le simulateur de combat (lot 4) »).
//
// Aubépine Crèmebrûlée contre le Chef de partie et deux Marmitons de corvée,
// dans la démonstration, sans en changer aucune valeur : le pendant fictif du
// combat de la maquette. Il existe pour que le moteur soit jugé sur un combat
// entier dont le journal et l'état final ont été calculés à la main, avant le
// code, puis recalculés deux fois sans voir le résultat.
//
// CE FICHIER EST UNE TRANSCRIPTION. Le combat est arrêté : rien ici ne se
// compose, ne se recalcule ni ne se « corrige » d'après ce que rend le moteur.
// Un écart entre le moteur et ce fichier est un défaut du moteur, ou une
// lecture à porter devant l'auteur ; jamais une ligne à retoucher ici.
//
// Il ne joue rien : tests/outils/scenario.js traduit `scenario` en événements,
// et tests/combat_reference.test.js compare ce que le moteur en fait à
// `casesDOffice`, à `journalAttendu` et à `etatAttendu`.
//
// Les dés sont bruts, avant tout modificateur, dans l'ordre où ils tombent ;
// quand une règle fait lancer un dé plusieurs fois (désavantage, relance,
// explosion), ses lancers sont à leur place dans la liste. Tous les dés d'une
// liste sont lancés, et aucun autre.

// ─── Le scénario ────────────────────────────────────────────────────────────

// Les choix du joueur que le scénario ne répète pas à chaque geste : il relance
// tout dé qui échoue tant qu'une relance lui reste (sauf aux places de
// `garde`), il fait exploser chaque fois que c'est proposé, il ne change pas
// les dégâts (sauf `degats`), il ne décale aucune face, il ne règle rien à la
// main, et Aubépine refuse le Pas de côté (sauf `esquive`).
//
// Depuis la fin du combat (lot 4.3, mission § 10) : l'étape « Interventions »
// se passe partout (« Appliquer »), et Aubépine laisse passer la
// contre-attaque qui s'offre à elle. Moulinet farineux est Centré : il n'a
// qu'une cible, cochée d'office, Aubépine, et ne se règle pas (gestes 12 et
// 16). Sans le −1 des blessures, qui n'est plus, les jets d'Aubépine d'après
// le geste 12 gagnent +1 : les dés bruts de sept gestes (14, 16, 19, 20, 22,
// 24 et 25) baissent d'autant, pour garder les mêmes réussites et les mêmes
// dégâts. Au geste 22, Aubépine choisit sa blessure, Main brûlée.
//
// Une fin automatique de tour ne s'écrit pas : le moteur la fait de lui-même.
// Les numéros d'étape sont ceux du déroulé arrêté, qui en compte vingt-cinq,
// fins automatiques comprises (étapes 3, 7, 10, 13, 15, 18 et 21).
export const scenario = {
  mode: "demo",
  quiCommence: "pj",
  lanceLe: "2026-10-12T21:30",
  ajouts: [
    ["pj", "Aubépine Crèmebrûlée"],
    ["adversaire", "Chef de partie", 1],
    ["adversaire", "Marmiton de corvée", 2],
  ],
  cases: { "Aubépine": "C3", "Chef": "F6", "Marmiton n° 1": "D4", "Marmiton n° 2": "D4" },
  gestes: [
    // Tour 1, camp des PJ.
    /*  1 */ { qui: "Aubépine", joue: "Frappe", contre: "Marmiton n° 1", des: [6, 9, 8, 2], localisation: [16] },
    /*  2 */ { qui: "Aubépine", joue: "Pas chassé", puissance: 1, vers: "D4" },
    // Tour 1, camp des adversaires.
    /*  4 */ { qui: "Marmiton n° 1", joue: "Frappe", contre: "Aubépine", des: [5, 2], localisation: [13] },
    /*  5 */ { qui: "Chef", joue: "Pas chassé", puissance: 2, vers: "D4" },
    /*  6 */ { qui: "Marmiton n° 2", joue: "Frappe", contre: "Aubépine", des: [3, 7, 5] },
    // Tour 2, camp des PJ.
    /*  8 */ { qui: "Aubépine", joue: "Émincer", contre: "Marmiton n° 1", des: [4, 8, 3], degats: { ajuste: 20, raison: "Émincer" }, localisation: [20] },
    /*  9 */ { qui: "Aubépine", joue: "Taloche", puissance: 1, contre: "Marmiton n° 2", caracteristiques: ["force", "agilite"], des: [7, 3, 5, 8], localisation: [14] },
    // Tour 2, camp des adversaires.
    /* 11 */ { qui: "Chef", joue: "Frappe", contre: "Aubépine", des: [4, 3], localisation: [17], esquive: 3 },
    /* 12 */ { qui: "Marmiton n° 2", joue: "Moulinet farineux", puissance: 1, des: [6, 2, 4, 1], localisation: [12] },
    // Tour 3, camp des PJ.
    /* 14 */ { qui: "Aubépine", joue: "Goûter", caracteristiques: ["sens", "savoir_sauvage"], difficulte: 6, des: [6, 6, 2] },
    // Tour 3, camp des adversaires. À l'étape 16, la face de contre-attaque
    // annule l'attaque, et Aubépine laisse passer la contre-attaque.
    /* 16 */ { qui: "Chef", joue: "Moulinet farineux", puissance: 1, des: [3], localisation: [20] },
    /* 17 */ { qui: "Marmiton n° 2", passe: true },
    // Tour 4, camp des PJ. À l'étape 19, le jet est prêté par l'arme tenue,
    // les dégâts restent « Sans dégâts » (le choix par défaut), et Aubépine
    // garde son deuxième dé alors qu'une relance lui reste.
    /* 19 */ { qui: "Aubépine", joue: "Fournaise", puissance: 1, contre: "Chef", pret: true, des: [8, 4], garde: [2], localisation: [6] },
    /* 20 */ { qui: "Aubépine", joue: "Frappe", contre: "Chef", des: [5] },
    // Tour 4, camp des adversaires. À l'étape 22, la zone blessée d'Aubépine
    // lui fait choisir une capacité du bloc de blessure. À l'étape 23, « Fin
    // de tour » vient du bouton : Marmiton n° 2 n'a rien fait à ce tour.
    /* 22 */ { qui: "Chef", joue: "Frappe", contre: "Aubépine", des: [5, 3], localisation: [16], blessure: "Main brûlée" },
    /* 23 */ { finDeTour: true },
    // Tour 5, camp des PJ : le combat finit pendant ce tour.
    /* 24 */ { qui: "Aubépine", joue: "Frappe", contre: "Marmiton n° 2", des: [4, 7, 3], localisation: [15] },
    /* 25 */ { qui: "Aubépine", joue: "Frappe", contre: "Chef", des: [6, 8, 7], localisation: [13] },
  ],
};

// ─── Les cases d'office ─────────────────────────────────────────────────────

// Où chaque ajout se pose avant d'être déplacé, dans l'ordre des ajouts :
// Aubépine, le Chef, puis les deux Marmitons, exemplaires d'un même adversaire
// et donc sur la même case.
export const casesDOffice = ["A1", "J1", "J2", "J2"];

// ─── Le journal attendu ─────────────────────────────────────────────────────

// Trente-six lignes, comparées mot pour mot. Le texte ne porte aucune espace
// insécable (« n° 1 » s'écrit avec une espace ordinaire). Depuis le lot 4.3,
// il ne porte plus aucun signe moins : les cinq qu'il avait (U+2212, jamais le
// trait d'union) venaient du −1 des blessures.
//
// Au lot 5, le livret du 25/10/2026 a changé deux choses, et la mission a
// redonné ces lignes mot pour mot : « endurance » au lieu de « résistance »
// (lignes 12, 13, 17, 31 et 35), et l'ordre des caractéristiques, qui range
// celles d'un dé au choix (ligne 20, « Savoir sauvage + Sens »).
//
// Au lot 4.3, la mission (§ 10) a redonné huit lignes mot pour mot, et rien
// d'autre : la fin du −1 des blessures (lignes 17, 20, 23, 27, 28, 31, 34 et
// 35), la contre-attaque laissée (ligne 23), et la blessure choisie (ligne 31).
export const journalAttendu = [
  "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent.",
  "— Tour 1 · camp des PJ —",
  "Aubépine : Frappe contre Marmiton n° 1. d10+1 contre 5, 1 désavantage → 7/10 → 7 ✓, 9/3 → 3 ✗ : 1 réussite, A = 3, +1 contre l'armure (Réduction). Localisation d20 → 16 : bras gauche. Armure 15 → 11.",
  "Aubépine : Pas chassé [1], C3 → D4.",
  "Fin du tour des PJ : ils retrouvent leurs actions.",
  "— Tour 1 · camp des adversaires —",
  "Marmiton n° 1 : Frappe contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 4 → 6 ✓, 3 ✗ : 1 réussite, Aubépine reçoit B = 10. Localisation d20 → 13 : jambe gauche. Armure 10 → 0.",
  "Chef : Pas chassé [2] (1 souffle), F6 → D4.",
  "Marmiton n° 2 : Frappe contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 4 → 4 ✓, 8 ✓, 6 ✓ : 3 réussites, aucun dégât.",
  "Fin du tour des adversaires : ils retrouvent leurs actions.",
  "— Tour 2 · camp des PJ —",
  "Aubépine : Émincer (4 souffle) contre Marmiton n° 1. Son avantage (Solo du chef) et son désavantage (Émincer hors maîtrise) s'annulent. d10+1 contre 5 → 5 ✓, 9 ✓, 4 ✗ : 2 réussites, B = 8, ajusté à 20 (Émincer), +2 contre l'armure (Réduction). Localisation d20 → 20 : tête. Armure 5 → 0, endurance 5 → 0, corps 10 → 0. Marmiton n° 1 meurt.",
  "Aubépine : Taloche [1] contre Marmiton n° 2. d8+1 (Force + Agilité) contre 5, 1 avantage → 8 ✓, 4 ✗, relancé 6 ✓, 9 ✓ : 3 réussites, C = 8, +3 contre l'armure (Réduction). Localisation d20 → 14 : jambe droite. Endurance 5 → 0, corps 10 → 7. Blessure (jambe droite), sans effet calculé.",
  "Fin du tour des PJ : ils retrouvent leurs actions.",
  "— Tour 2 · camp des adversaires —",
  "Chef : Frappe contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 5 → 5 ✓, 4 ✗ : 1 réussite, Aubépine reçoit B = 12. Localisation d20 → 17 : bras gauche. Aubépine intervient : Pas de côté (1 action, 3 souffle), 12 → 9. Armure 10 → 1.",
  "Marmiton n° 2 : Moulinet farineux [1] (5 souffle) contre Aubépine. Ses 2 avantages (Solo du chef, Moulinet farineux hors maîtrise de Marmiton n° 2) et son désavantage (types d'armure mêlés) laissent 1 avantage. Aubépine lance sa défense, d8+1 contre 4, 1 avantage → 7 ✓, 3 ✗, relancé 5 ✓, 2 ✗ : 2 réussites, Aubépine reçoit A = 5. Localisation d20 → 12 : jambe gauche. Endurance 5 → 0.",
  "Fin du tour des adversaires : ils retrouvent leurs actions.",
  "— Tour 3 · camp des PJ —",
  "Aubépine : Goûter, d6 (Savoir sauvage + Sens) contre 6 (compliqué) → 6 ✓, 6 ✓, 2 ✗ : 2 réussites.",
  "Fin du tour des PJ : ils retrouvent leurs actions.",
  "— Tour 3 · camp des adversaires —",
  "Chef : Moulinet farineux [1] (5 souffle) contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 5 → 4 ✗ : aucune réussite, Aubépine reçoit C = 19. Localisation d20 → 20 : contre-attaque, l'attaque est annulée. Aubépine ne contre-attaque pas.",
  "Marmiton n° 2 passe son tour.",
  "Fin du tour des adversaires : ils retrouvent leurs actions.",
  "— Tour 4 · camp des PJ —",
  "Aubépine : Fournaise [1] (1 souffle, 1 lien) contre Chef. d10+1 contre 7, 1 avantage → 9 ✓, 5 ✗ : 1 réussite, touché. Localisation d20 → 6 : torse.",
  "Aubépine : Frappe contre Chef. Son avantage (Solo du chef) et son désavantage (Frappe hors maîtrise) s'annulent. d10+1 contre 7 → 6 ✗ : aucune réussite, manqué.",
  "Fin du tour des PJ : ils retrouvent leurs actions.",
  "— Tour 4 · camp des adversaires —",
  "Chef : Frappe contre Aubépine. Son avantage (Solo du chef) et son désavantage (types d'armure mêlés) s'annulent. Aubépine lance sa défense, d8+1 contre 5 → 6 ✓, 4 ✗ : 1 réussite, Aubépine reçoit B = 12. Localisation d20 → 16 : bras gauche. Armure 1 → 0, endurance 5 → 0, corps 10 → 4. Blessure (bras gauche) : Main brûlée.",
  "Fin du tour des adversaires : ils retrouvent leurs actions.",
  "— Tour 5 · camp des PJ —",
  "Aubépine : Frappe contre Marmiton n° 2. Son avantage (Solo du chef) et son désavantage (Frappe hors maîtrise) s'annulent. d10+1 contre 5 → 5 ✓, 8 ✓, 4 ✗ : 2 réussites, B = 8, +2 contre l'armure (Réduction). Localisation d20 → 15 : jambe droite. Corps 7 → 0. Marmiton n° 2 meurt.",
  "Aubépine : Frappe contre Chef. Son avantage (Solo du chef) et son désavantage (Frappe hors maîtrise) s'annulent. d10+1 contre 7 → 7 ✓, 9 ✓, 8 ✓ : 3 réussites, C = 20, +3 contre l'armure (Réduction). Localisation d20 → 13 : jambe gauche. Endurance 5 → 0, corps 10 → 0. Chef meurt.",
  "Combat terminé : victoire des PJ.",
];

// ─── L'état final attendu ───────────────────────────────────────────────────

// L'état final arrêté, mis en valeurs, dans l'ordre d'ajout. Un protagoniste
// se nomme par son nom court, une zone par son code (celle que la banque écrit
// « Jambre droite » est reconnue : son code est « jambe_droite »).
//
// `null` veut dire « non dit » : l'état arrêté ne donne ni les actions d'un
// mort, ni les blessures d'un adversaire (elles sont sans effet calculé). Le
// contrôle ne compare pas ce qui est nul ; il ne le déduit pas non plus.
//
// `blessures` (lot 4.3) : les blessures que porte un personnage, dans l'ordre
// où elles sont venues, chacune { nom, zone, duree } : la capacité du bloc de
// blessure choisie (ou l'état libre), le code de la zone blessée, et sa durée
// (« combat » : jusqu'à la fin du combat). Une zone dont l'endurance est à 0
// n'est plus une blessure : il faut qu'un coup y ôte du corps.
//
// `zones` porte chaque zone dont l'état arrêté donne les valeurs. Toute zone
// qui n'y figure pas est intacte : armure et endurance à leur maximum.
//
// Aubépine garde 0 action sur 2 : le combat finit pendant son tour, sans « Fin
// du tour », et personne ne retrouve ses actions.
export const etatAttendu = [
  {
    protagoniste: "Aubépine",
    case: "D4",
    actions: 0,
    actionsMax: 2,
    souffle: 2,
    souffleMax: 10,
    liens: [{ nom: "Grand Four", points: 0, max: 1 }],
    corps: 4,
    corpsMax: 10,
    mort: null,
    blessures: [{ nom: "Main brûlée", zone: "bras_gauche", duree: "combat" }],
    zones: [
      { code: "jambe_gauche", armure: 0, armureMax: 10, resistance: 0, resistanceMax: 5 },
      { code: "bras_gauche", armure: 0, armureMax: 10, resistance: 0, resistanceMax: 5 },
      { code: "tete", armure: 6, armureMax: 6, resistance: 5, resistanceMax: 5 },
      { code: "torse", armure: 30, armureMax: 30, resistance: 5, resistanceMax: 5 },
      { code: "jambe_droite", armure: 10, armureMax: 10, resistance: 5, resistanceMax: 5 },
      { code: "bras_droit", armure: 10, armureMax: 10, resistance: 5, resistanceMax: 5 },
    ],
  },
  {
    protagoniste: "Chef",
    case: "D4",
    actions: null,
    actionsMax: null,
    souffle: 1,
    souffleMax: 7,
    liens: [],
    corps: 0,
    corpsMax: 10,
    mort: { tour: 5 },
    blessures: null,
    // Le torse a été touché sans dégâts à l'étape 19 : il doit rester entier.
    zones: [
      { code: "jambe_gauche", armure: 0, armureMax: 0, resistance: 0, resistanceMax: 5 },
      { code: "torse", armure: 38, armureMax: 38, resistance: 5, resistanceMax: 5 },
    ],
  },
  {
    protagoniste: "Marmiton n° 1",
    case: "D4",
    actions: null,
    actionsMax: null,
    souffle: 5,
    souffleMax: 5,
    liens: [],
    corps: 0,
    corpsMax: 10,
    mort: { tour: 2 },
    blessures: null,
    zones: [
      { code: "bras_gauche", armure: 11, armureMax: 15, resistance: 5, resistanceMax: 5 },
      { code: "tete", armure: 0, armureMax: 5, resistance: 0, resistanceMax: 5 },
    ],
  },
  {
    protagoniste: "Marmiton n° 2",
    case: "D4",
    actions: null,
    actionsMax: null,
    souffle: 0,
    souffleMax: 5,
    liens: [],
    corps: 0,
    corpsMax: 10,
    mort: { tour: 5 },
    blessures: null,
    zones: [
      { code: "jambe_droite", armure: 0, armureMax: 0, resistance: 0, resistanceMax: 5 },
    ],
  },
];
