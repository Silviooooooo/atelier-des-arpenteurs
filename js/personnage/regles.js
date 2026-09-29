// Les règles chiffrées du personnage (SPECIFICATION.md, § 15.2).
//
// Elles vivent dans le code, par décision de l'auteur (29/09/2026), et
// chacune cite la section du livret des règles (« Principe jdr abrasia »)
// ou l'élément du classeur qui la fonde. Le livret fait foi, puis le
// classeur, puis le modèle de fiche. Aucune règle n'est inventée ici : ce
// que les sources ne disent pas est inscrit au § 12 et laissé vide.

import { cle } from "../banque/noms.js";

// Livret, « Éléments de personnage », « Caractéristiques » : neuf
// caractéristiques, de 2 à 6, pour une somme de 36. Les abréviations sont
// celles du modèle de fiche.
export const CARACTERISTIQUES = [
  { code: "force", nom: "Force", abrege: "For" },
  { code: "agilite", nom: "Agilité", abrege: "Agi" },
  { code: "precision", nom: "Précision", abrege: "Pré" },
  { code: "sens", nom: "Sens", abrege: "Sen" },
  { code: "culture_neruvienne", nom: "Culture néruvienne", abrege: "Cul" },
  { code: "savoir_sauvage", nom: "Savoir sauvage", abrege: "Sav" },
  { code: "parole", nom: "Parole", abrege: "Par" },
  { code: "empathie", nom: "Empathie", abrege: "Emp" },
  { code: "creativite", nom: "Créativité", abrege: "Cré" },
];
export const CARACTERISTIQUE_MIN = 2;
export const CARACTERISTIQUE_MAX = 6;
export const SOMME_CARACTERISTIQUES = 36;

// Le nom d'une caractéristique invoquée entre accolades ({force},
// {culture néruvienne}, {culture_neruvienne}) : comparé sans casse, accents,
// espaces ni soulignés.
const cleCaracteristique = (nom) => cle(nom).replace(/_/g, "");
const PAR_NOM = new Map(CARACTERISTIQUES.flatMap((c) => [[cleCaracteristique(c.nom), c.code], [cleCaracteristique(c.code), c.code]]));

/** Le code de la caractéristique qu'un nom désigne, ou null. */
export function caracteristique(nom) {
  return PAR_NOM.get(cleCaracteristique(nom)) ?? null;
}

// Livret, « Types de dés » : d2, d4, d6, d8, d10, d12, d20, d100 ; et
// « Caractéristiques » : la somme de deux caractéristiques (ou le double
// d'une seule), arrondie au nombre pair inférieur ou égal, donne le dé.
export const DES = [4, 6, 8, 10, 12];

/** Le dé d'un jet sur une ou deux caractéristiques : { somme, faces, de: "d8" }, ou null. */
export function deDuJet(a, b = a) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  const somme = a + b;
  const faces = somme - (somme % 2);
  return DES.includes(faces) ? { somme, faces, de: `d${faces}` } : null;
}

// Les trois types d'objet, portés par les éléments Lourde, Agile, Précise
// (classeur, feuille Eléments) ; livret, « Jets d'attaque » et « Jets de
// défense » : les caractéristiques de chaque type.
export const TYPES_OBJET = {
  lourde: { nom: "lourde", element: "Lourde", attaque: ["force", "precision"], defense: ["force", "sens"] },
  agile: { nom: "agile", element: "Agile", attaque: ["agilite", "force"], defense: ["agilite", "creativite"] },
  precise: { nom: "précise", element: "Précise", attaque: ["precision", "agilite"], defense: ["precision", "empathie"] },
};

// Les six zones. L'ordre des six valeurs d'une armure est celui de
// l'élément Armure du classeur : torse, jambe gauche, jambe droite, bras
// gauche, bras droit, tête. Les valeurs du d20 sont celles de la grille
// des PJ (livret, « Jets de localisation »). L'ordre d'affichage est celui
// du modèle de fiche.
export const ZONES = [
  { code: "torse", nom: "Torse", abrege: "Torse", d20: "2-11" },
  { code: "jambe_gauche", nom: "Jambe gauche", abrege: "Jambe g.", d20: "12-13" },
  { code: "jambe_droite", nom: "Jambe droite", abrege: "Jambe d.", d20: "14-15" },
  { code: "bras_gauche", nom: "Bras gauche", abrege: "Bras g.", d20: "16-17" },
  { code: "bras_droit", nom: "Bras droit", abrege: "Bras d.", d20: "18-19" },
  { code: "tete", nom: "Tête", abrege: "Tête", d20: "1" },
];
export const ORDRE_FICHE_ZONES = ["tete", "torse", "bras_gauche", "bras_droit", "jambe_gauche", "jambe_droite"];
// Livret, « Jets de localisation » : sur 20, l'attaque est annulée.
export const LOCALISATION_20 = "20 → attaque annulée, contre-attaque.";

// Livret, « Ressources » : 10 points de souffle à la création, un de plus
// par point d'historique (aucun à la création) ; 10 points de corps ; 5
// points de résistance par partie du corps ; l'armure selon l'équipement.
export const SOUFFLE_CREATION = 10;
export const CORPS = 10;
export const RESISTANCE_PAR_ZONE = 5;

// Livret, « Capacités » : la puissance part de 1 et monte jusqu'à 3 ;
// « Création » : 10 points de capacité, hors capacités de niveau 0, au coût
// de la progression ; « Progression » : 1 point pour une capacité, 2 de
// plus pour le niveau 2, 3 de plus pour le niveau 3.
export const NIVEAU_MAX = 3;
export const POINTS_CREATION = 10;
export const COUT_NIVEAU = [0, 1, 3, 6];

// Livret, « Niveau » : le personnage est de niveau 1 à sa création.
export const NIVEAU_PERSONNAGE = 1;

// Les éléments et paramètres du classeur que le calcul lit, par leur nom.
// Classeur, élément Qualité : {degats}, {defense} et {armure} multipliés
// par 1/3 + {qualite}/3. Élément Armure : six valeurs. Élément Dégâts :
// A/B/C, les rangs d'une attaque (livret, « Jets d'attaque »).
export const ELEMENTS = {
  arme: "Arme",
  armure: "Armure",
  qualite: "Qualité",
  style: "Style de combat",
  maitrise: "Maîtrise",
};
export const PARAMETRES = { degats: "degats", armure: "armure", defense: "defense", qualite: "qualite", portee: "portee" };
export const RANGS = { degats: 3, armure: 6 };
export const PARAMETRES_QUALIFIES = ["degats", "defense", "armure"];

// La légende des huit primordiaux et de leurs domaines, reproduite du
// modèle de fiche (décision de l'auteur, 29/09/2026) : le livret n'en dit
// rien, et la colonne Infos du classeur n'a pas de valeur légale.
export const LEGENDE_PRIMORDIAUX = [
  ["Derkat", "vengeance"],
  ["Enaël", "savoir"],
  ["Ithilvion", "choix"],
  ["Kalester", "endurance"],
  ["Neru", "équilibre"],
  ["Makith", "noirceur"],
  ["Kouvîmäar", "protection"],
  ["Sillybir", "pardon"],
];
