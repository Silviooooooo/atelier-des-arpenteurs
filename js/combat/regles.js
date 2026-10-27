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
// Les nombres propres à un protagoniste (endurance 5, corps 10, souffle 10)
// ne sont pas ici : ils viennent de sa fiche ou de sa résolution, figés dans
// sa photographie.

// La version des règles du rejeu. Un combat gardé se recalcule en rejouant
// ses événements : toute correction qui change un nombre, un mot du journal
// ou un moment la fait monter, et un combat d'une autre version ne se reprend
// pas. Décision de l'auteur (25/10/2026) : 2 au groupe 2 du lot 4 (l'événement
// « annuler », la puissance au choix des adversaires, la défense à égalité) ;
// 3 au lot 5 : l'endurance et l'ordre des caractéristiques ; 4 au groupe 3 du
// lot 4 (mission du groupe, § 0, point 6) : les interventions, attendre, la
// contre-attaque, le coup critique, la palette et ses effets, les états, le
// menu du MJ, plusieurs cibles, et la blessure du livret du 25/10, qui ôte le
// −1 à ses jets ; sept événements neufs, des moments neufs et des nombres qui
// changent : un combat d'avant ne se rejouerait pas à l'identique. Un combat
// gardé d'avant (version 1, 2 ou 3) se dit « commencé avec une autre version
// du simulateur ».
export const REGLES = 4;

// Décision de l'auteur : la carte fait 10 × 10 cases, colonnes A à J, lignes
// 1 à 10. Une case s'écrit « D4 ».
export const COTE = 10;
export const COLONNES = "ABCDEFGHIJ";
export const MOTIF_CASE = /^[A-J](?:10|[1-9])$/;

// Décision de l'auteur : 12 PJ et 60 adversaires au plus dans un combat, 12
// exemplaires au plus d'un même adversaire (les plafonds de l'écran
// Rencontre, § 16.6).
export const PLAFOND_PJ = 12;
export const PLAFOND_ADVERSAIRES = 60;
export const PLAFOND_EXEMPLAIRES = 12;

// La borne des événements est celle de l'enregistrement : au-delà, un combat
// gardé ne se relirait plus, donc le jeu la tient aussi. Elle borne surtout
// l'ouverture de l'écran, qui rejoue tout le combat.
//
// Décision de l'auteur (25/10/2026) : 15 000, quelle que soit la mesure. Au
// groupe 1, elle était de 5 000, fixée d'après la mesure (12/10/2026, Node
// 24 : 5 000 événements du genre le plus cher en 4,7 s, parce que l'offre
// jugeait alors chaque façon de qui jouait). Trois changements la portent
// au groupe 2 : l'offre ne juge plus que la façon demandée (compl. § 5.3) ;
// le journal n'est recopié qu'une fois par événement, et non deux (le rejeu
// de 15 000 passes demandait 13,4 s, coût quadratique) ; le rejeu rend la
// main au navigateur toutes les REJEU_TRANCHE. À EVENEMENTS_ALERTE (90 %),
// l'écran avertit une fois ; le 15 001e événement est refusé.
export const EVENEMENTS_MAX = 15000;
export const EVENEMENTS_ALERTE = 13500;
export const REJEU_TRANCHE = 1000;

/**
 * Un entier écrit à la française, par tranches de trois chiffres séparées
 * d'une espace ordinaire (U+0020) : « 15 000 ». Aucun texte du noyau ne porte
 * d'espace insécable, et rien n'est demandé à l'appareil, dont la langue
 * changerait le séparateur. Les phrases des bornes s'écrivent par lui :
 * « Ce combat a atteint 15 000 événements : commencez-en un nouveau. »
 */
export function ecrireEnMilliers(nombre) {
  return String(nombre).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// L'annulation d'un combat qui n'a rien à défaire (contrat du groupe 2,
// § 2.2) : ni geste payé en attente, ni maillon. L'ouverture du combat la
// pose, et une lecture qui ne trouve pas de champ « annulation » la lit ainsi.
// La pile qui s'y empile ne passe jamais par JSON. Gelée en fin de fichier,
// comme les autres constantes : tous les états la partagent.
export const SANS_ANNULATION = { attente: null, pile: null };

// Un identifiant de protagoniste est « pj » ou « adv », puis cinq chiffres au
// plus (le motif de js/combat/forme.js). Le compteur qui les numérote ne
// redescend jamais : arrivé là, plus personne ne s'ajoute à ce combat, car un
// sixième chiffre ferait un protagoniste que le moteur refuserait à chaque
// geste, et un combat qui ne se relirait plus.
export const IDENTIFIANTS_MAX = 99999;

// Un dé sous k désavantages nets se lance k + 1 fois (js/combat/jet.js) :
// l'événement « de » porte alors k + 1 tirages. La main n'en règle que
// BORNE_REGLAGE, et les passifs d'un adversaire quelques-uns : cent tirages
// laissent 99 désavantages nets. Sans borne, un seul événement d'un combat
// forgé portait des millions de valeurs, lues une à une avant tout refus.
export const TIRAGES_MAX = 100;

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

// Passer son tour est un bouton du simulateur, et le jet de défense est
// automatique : la capacité de la banque qui porte l'un de ces rôles n'a pas
// de bouton à elle. Attendre a le sien depuis le groupe 3 (contrat du groupe,
// § 6.2) : il se règle (la capacité gardée), puis se confirme.
export const ROLES_SANS_BOUTON = ["passer_son_tour", "jet_de_defense"];

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
// localisation, « faces » pour un dé ; les autres bornent une liste, hors
// les trois dernières.
//
// « faconsEnTout » et « deplacements » bornent ce que la bulle calcule à
// chaque clic : elle montre chaque façon de chaque capacité de celui qui
// joue, avec son verdict, et calcule pour chaque façon de déplacement les
// cases où elle mène. Depuis le groupe 2, l'offre ne juge plus, à chaque
// événement « capacite », que la façon demandée (compl. § 5.3) : le rejeu
// n'en dépend plus. Au groupe 1, qui jugeait tout à chaque événement, une
// photographie forgée aux seules bornes des listes (200 capacités de 20
// façons) coûtait de 4 à 30 millisecondes par événement (mesuré). Les bornes
// restent inchangées (compl. § 5.3).
// - « faconsEnTout » : les façons d'un protagoniste, toutes capacités
//   confondues. Une capacité de personnage en a trois au plus (son niveau,
//   NIVEAU_MAX de js/personnage/regles.js), et une photographie deux cents
//   capacités : six cents.
// - « deplacements » : les façons de ses capacités de déplacement, toutes
//   ensemble. Il n'en a qu'une, donc vingt façons au plus.
//
// « source » : la source d'un adversaire (sa ligne, celles de ses types, sa
// résolution), comptée en signes de son JSON. Elle ne sert qu'à « Fiche
// complète », qui la recalcule en entier. La plus grosse du classeur réel en
// compte 6 278, celle de la démonstration 5 529 (mesuré le 12/10/2026).
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
  faconsEnTout: 600,
  deplacements: 20,
  source: 200000,
};

// La palette (groupe 3 du lot 4 ; contrat du groupe, § 5.1) : les genres de
// l'événement « effet », dans l'ordre de son tableau. Les dés (avantages,
// désavantages, relancer, inverser, +1 réussite), la zone d'un d20, les
// dégâts (multiplier, ajouter, retrancher, armure, directs, reporter, toute
// la case, une attaque en plus), puis la cible (rendre, ±N en attaque ou en
// défense, un état, déplacer).
export const GENRES_EFFET = [
  "avantages",
  "desavantages",
  "relancer",
  "inverser",
  "reussite",
  "zone",
  "multiplier",
  "ajouter",
  "retrancher",
  "armure",
  "directs",
  "reporter",
  "toute_la_case",
  "attaque_en_plus",
  "rendre",
  "attaque",
  "defense",
  "etat",
  "deplacer",
];

// Combien de temps dure un ±N ou un état (mission du groupe 3, § 4.6 : à
// l'onglet Cible seul). « jet » : les jets du geste qui le porte ; « tour » :
// jusqu'au prochain tour du camp de son auteur ; « combat » : jusqu'à la fin.
// Hors d'un geste, et pour le MJ, « jet » ne se choisit pas.
export const DUREES_EFFET = ["jet", "tour", "combat"];

// Ce que « rendre » rend, sans passer le maximum (contrat du groupe 3,
// § 5.6) : l'armure et l'endurance d'une zone, le lien d'une jauge.
export const RESSOURCES_RENDRE = ["souffle", "lien", "armure", "endurance", "corps"];

// Le menu du MJ (mission du groupe 3, § 4.8 ; contrat, § 6.3) : ses gestes,
// et les valeurs que « Modifier une valeur… » change. L'armure et
// l'endurance sont celles d'une zone, le lien celui d'une jauge, la défense
// du bouclier celle du bouclier qu'il porte.
export const GENRES_MJ = ["valeurs", "equipement", "etat", "deplacer", "retirer"];
export const CHAMPS_MJ = ["attaque", "defense", "souffle", "souffleMax", "actions", "actionsMax", "lien", "corps", "armure", "endurance", "bouclier"];

// Les bornes de la palette (contrat du groupe 3, § 5.1, § 6), vues à la
// forme de l'événement (js/combat/forme.js), parce qu'elles ne dépendent pas
// du moment : celles qui en dépendent (le maximum d'une ressource, une
// réussite de plus que trois) sont à l'offre.
// - « nombre » : avantages ou désavantages pour ce jet, de 1 à 20, comme la
//   main (BORNE_REGLAGE).
// - « facteurMin », « facteurMax » : multiplier les dégâts, × 2 à × 10.
// - « points » : ajouter, retrancher, l'armure en plus, rendre, de 1 à 999 ;
//   des dégâts directs, de 0 à 999, comme la main (BORNE_DEGATS).
// - « ecart » : un ±N, de −20 à 20, jamais 0 (BORNE_REGLAGE).
// - « libre » : le nom d'un état libre, 40 signes au plus (mission, § 4.7).
// - « cibles » : plusieurs cibles, distinctes, au réglage d'une façon Centrée
//   comme à « toute la case » : de 1 au plafond des protagonistes d'un combat
//   (PJ et adversaires), et non plus 12, puisqu'une case peut tous les tenir
//   (contrat, § 6 ; § 12, choix 13).
export const BORNES_EFFET = {
  nombre: BORNE_REGLAGE,
  facteurMin: 2,
  facteurMax: 10,
  points: BORNE_DEGATS,
  ecart: BORNE_REGLAGE,
  libre: 40,
  cibles: PLAFOND_PJ + PLAFOND_ADVERSAIRES,
};

// Les bornes d'un geste du MJ (contrat du groupe 3, § 6.3).
// - « valeurs » : un geste « valeurs » change de 1 à 20 valeurs, chacune de
//   0 à 999 (« valeur », BORNE_DEGATS).
// - « changements », « noms » : ce qu'un geste « equipement » écrit au
//   journal (l'arme tenue, la qualité d'un objet, la cellule Équipement d'un
//   adversaire), et les noms de cette cellule. Le contrat ne les borne pas ;
//   quarante, comme les armes d'une photographie (BORNES_PHOTO.armes) : un
//   événement forgé n'en porte pas des millions.
export const BORNES_MJ = {
  valeurs: 20,
  valeur: BORNE_DEGATS,
  changements: 40,
  noms: 40,
};

// Les caractères de contrôle, et les deux séparateurs de ligne qu'Unicode
// range ailleurs : une raison entre au journal, qui tient une ligne par
// geste, et dans le fichier téléchargé. Les deux séparateurs sont fabriqués
// par leur code : écrits tels quels, ils couperaient la ligne de ce fichier.
const CONTROLE = new RegExp(`[\\p{Cc}${String.fromCodePoint(0x2028, 0x2029)}]`, "u");

/**
 * Une raison saisie à la main : de 1 à LONGUEUR_RAISON signes, sans blanc de
 * bord, ni caractère de contrôle, ni demi-codet isolé (la moitié d'un signe
 * astral, seule : le JSON l'écrit en six octets, et un journal qui en serait
 * fait dépasserait la borne de l'enregistrement). Un signe astral entier
 * compte deux unités. C'est le moteur qui la vérifie, pas l'écran : elle est
 * une donnée hostile comme une autre.
 */
export function raisonValide(texte) {
  return (
    typeof texte === "string" &&
    texte.length >= 1 &&
    texte.length <= LONGUEUR_RAISON &&
    texte === texte.trim() &&
    !CONTROLE.test(texte) &&
    !/\p{Cs}/u.test(texte)
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

for (const constante of [
  FACE_CONTRE,
  GRILLE_PJ,
  LETTRES,
  DIFFICULTES,
  ELEMENTS_COMBAT,
  ROLES,
  ROLES_PASSIFS,
  ROLES_SANS_BOUTON,
  SIGNES,
  BORNES_PHOTO,
  SANS_ANNULATION,
  GENRES_EFFET,
  DUREES_EFFET,
  RESSOURCES_RENDRE,
  GENRES_MJ,
  CHAMPS_MJ,
  BORNES_EFFET,
  BORNES_MJ,
]) {
  geler(constante);
}
