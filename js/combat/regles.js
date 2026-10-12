// Les constantes du simulateur de combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) »).
//
// Tout le noyau du combat (js/combat/) lit ses nombres et ses mots ici, pour
// qu'aucune règle ne s'écrive deux fois : chaque constante cite la section du
// livret (« Principe jdr abrasia »), la décision de l'auteur ou la convention
// provisoire (§ 12, « Pour le lot 4 ») qui la fonde. Ce fichier n'importe
// rien : il est la racine du graphe du noyau, et js/adversaire/resolution.js
// y prend le nom du paramètre « loc_multiple » sans créer de cycle.
//
// Les nombres propres à un protagoniste (résistance 5, corps 10, souffle 10)
// ne sont pas ici : ils viennent de sa fiche ou de sa résolution, figés dans
// sa photographie.

// La version des règles du rejeu. Un combat gardé se recalcule en rejouant
// ses événements : toute correction qui change un nombre, un mot du journal
// ou un moment la fait monter, et un combat d'une autre version ne se reprend
// pas.
export const REGLES = 1;

// Décision de l'auteur : la carte fait 10 × 10 cases, colonnes A à J, lignes
// 1 à 10. Une case s'écrit « D4 ».
export const COTE = 10;
export const COLONNES = "ABCDEFGHIJ";
export const MOTIF_CASE = /^[A-J](?:10|[1-9])$/;

// Décision de l'auteur : 12 PJ et 60 adversaires au plus dans un combat, 12
// exemplaires au plus d'un même adversaire (les plafonds de l'écran
// Rencontre, § 16.6). La borne des événements est celle de l'enregistrement :
// au-delà, un combat gardé ne se relirait plus, donc le jeu la tient aussi.
export const PLAFOND_PJ = 12;
export const PLAFOND_ADVERSAIRES = 60;
export const PLAFOND_EXEMPLAIRES = 12;
export const EVENEMENTS_MAX = 20000;

// Livret, « Actions de jeu » : un personnage a « habituellement » deux
// actions par tour.
export const ACTIONS_PJ = 2;

// Livret, « Jets » : une réussite fait lancer le dé suivant, jusqu'à trois.
export const REUSSITES_MAX = 3;

// Livret, « Jets de localisation » : un d20. La face 20 d'un PJ annule
// l'attaque ; celle d'un adversaire est la face 1 (convention provisoire :
// le livret ne le dit que pour le PJ ; § 16.1 pour la grille des adversaires).
export const FACES_LOCALISATION = 20;
export const FACE_CONTRE = { pj: 20, adv: 1 };

// Livret, « Jets de localisation » : la grille des personnages, dans l'ordre
// du d20. Elle répète les valeurs « d20 » de ZONES (js/personnage/regles.js),
// qui les écrit en texte et dans l'ordre de l'élément Armure : un contrôle
// tient les deux égales.
export const GRILLE_PJ = [
  { code: "tete", debut: 1, fin: 1 },
  { code: "torse", debut: 2, fin: 11 },
  { code: "jambe_gauche", debut: 12, fin: 13 },
  { code: "jambe_droite", debut: 14, fin: 15 },
  { code: "bras_gauche", debut: 16, fin: 17 },
  { code: "bras_droit", debut: 18, fin: 19 },
];

// Livret, « Jets d'attaque » : les dégâts d'une arme ont trois valeurs, A
// pour une réussite, B pour deux, C pour trois.
export const LETTRES = ["A", "B", "C"];

// Livret, « Difficultés » : le tableau, mot pour mot, en minuscules parce
// que le journal les écrit au milieu d'une phrase (« contre 6 (compliqué) »).
// Le livret ne nomme ni 1, ni ce qui dépasse 10.
export const DIFFICULTES = {
  2: "extrêmement facile",
  3: "très facile",
  4: "facile",
  5: "moyen",
  6: "compliqué",
  7: "difficile",
  8: "très difficile",
  9: "extrêmement difficile",
  10: "quasi impossible",
};

// Classeur, feuille Eléments : les éléments que lit le combat. Ils se
// comparent par cle(), jamais tels quels.
export const ELEMENTS_COMBAT = {
  intervention: "Intervention",
  passif: "Passif",
  degats: "Dégâts",
  portee: "Portée",
  locMultiple: "Localisation multiple",
  centre: "Centré",
};

// Le paramètre qui dit combien de d20 de localisation lance une capacité.
// contexte() le rend déjà, sans que PARAMETRES (js/personnage/regles.js) le
// connaisse.
export const PARAMETRE_LOC = "loc_multiple";

// Les rôles câblés : ce que le simulateur sait faire d'une capacité, reconnue
// par son nom au moment de la photographie et nulle part ailleurs
// (js/combat/roles.js). Les quatorze premiers sont le tableau du § 17 ; le
// dernier est un rôle de structure : la capacité que vise le paramètre
// « degats » du bloc de base.
export const ROLES = [
  "deplacement",
  "jet_de_caracteristique",
  "esquive",
  "attendre",
  "passer_son_tour",
  "jet_de_defense",
  "bonus_force",
  "bonus_agilite",
  "bonus_precision",
  "petit",
  "seul_sur_sa_case",
  "en_meute",
  "esprit_de_corps",
  "degrossir",
  "mains_nues",
];

// Les huit passifs dont l'effet se calcule (proposition acceptée par l'auteur
// le 11/10/2026). Les maîtrises n'en sont pas : leur effet est figé dans le
// désavantage de chaque façon.
export const ROLES_PASSIFS = [
  "bonus_force",
  "bonus_agilite",
  "bonus_precision",
  "petit",
  "seul_sur_sa_case",
  "en_meute",
  "esprit_de_corps",
  "degrossir",
];

// Passer son tour est un bouton du simulateur, le jet de défense est
// automatique, et attendre est du groupe 2 : la capacité de la banque qui
// porte l'un de ces rôles n'a pas de bouton à elle.
export const ROLES_SANS_BOUTON = ["passer_son_tour", "jet_de_defense", "attendre"];

// Les signes du journal, donnés par leur code : le journal se compare mot
// pour mot, et un éditeur qui remplacerait l'un d'eux par son voisin (un
// tiret pour un moins) passerait inaperçu à l'œil. Toutes les espaces du
// journal sont des U+0020.
export const SIGNES = {
  reussi: String.fromCodePoint(0x2713),
  echoue: String.fromCodePoint(0x2717),
  fleche: String.fromCodePoint(0x2192),
  moins: String.fromCodePoint(0x2212),
  tiret: String.fromCodePoint(0x2014),
  point: String.fromCodePoint(0x00b7),
};

// Les bornes des saisies à la main : un modificateur ou un compte d'avantages
// de −20 à +20, des dégâts de 0 à 999, une raison de 80 signes.
export const BORNE_REGLAGE = 20;
export const BORNE_DEGATS = 999;
export const LONGUEUR_RAISON = 80;

// Les bornes d'une photographie, vues à sa fabrication comme à sa relecture
// (js/combat/forme.js) : « ligne » pour un texte d'une ligne, « texte » pour
// un texte à lignes, « nombre » pour tout entier, « des » pour les d20 d'une
// localisation, « faces » pour un dé ; les autres bornent une liste.
export const BORNES_PHOTO = {
  ligne: 200,
  texte: 4000,
  nombre: 9999,
  des: 20,
  faces: 100,
  capacites: 200,
  facons: 20,
  armes: 40,
  zones: 19,
  liens: 20,
  elements: 40,
  avertissements: 200,
};

// Les caractères de contrôle, et les deux séparateurs de ligne qu'Unicode
// range ailleurs : une raison entre au journal, qui tient une ligne par
// geste, et dans le fichier téléchargé. Les deux séparateurs sont fabriqués
// par leur code : écrits tels quels, ils couperaient la ligne de ce fichier.
const CONTROLE = new RegExp(`[\\p{Cc}${String.fromCodePoint(0x2028, 0x2029)}]`, "u");

/**
 * Une raison saisie à la main : de 1 à LONGUEUR_RAISON signes, sans blanc de
 * bord ni caractère de contrôle. C'est le moteur qui la vérifie, pas l'écran :
 * elle est une donnée hostile comme une autre.
 */
export function raisonValide(texte) {
  return (
    typeof texte === "string" &&
    texte.length >= 1 &&
    texte.length <= LONGUEUR_RAISON &&
    texte === texte.trim() &&
    !CONTROLE.test(texte)
  );
}

const estSimple = (valeur) => {
  if (Array.isArray(valeur)) return true;
  const prototype = Object.getPrototypeOf(valeur);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Gèle en profondeur un objet simple ou un tableau, et le rend. Toute autre
 * valeur est rendue telle quelle.
 *
 * Ce qui est déjà gelé n'est pas reparcouru : un état partage avec le
 * précédent tout ce qui n'a pas changé, et un clic ne doit pas coûter le
 * parcours du combat entier. Il ne faut donc jamais geler à la main
 * (Object.freeze) un objet dont une partie ne l'est pas encore : geler() le
 * croirait fini.
 */
export function geler(valeur) {
  if (valeur === null || typeof valeur !== "object" || Object.isFrozen(valeur) || !estSimple(valeur)) return valeur;
  Object.freeze(valeur);
  for (const nom of Object.keys(valeur)) geler(valeur[nom]);
  return valeur;
}

for (const constante of [FACE_CONTRE, GRILLE_PJ, LETTRES, DIFFICULTES, ELEMENTS_COMBAT, ROLES, ROLES_PASSIFS, ROLES_SANS_BOUTON, SIGNES, BORNES_PHOTO]) {
  geler(constante);
}
