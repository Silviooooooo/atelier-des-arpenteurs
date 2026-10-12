// Le plateau du combat : les cases et les distances (SPECIFICATION.md, § 17
// « Le simulateur de combat (lot 4) »).
//
// La carte du combat fait 10 × 10 cases, de A1 à J10. Ce module dit ce qu'est
// une case, à quelle distance deux cases se trouvent, lesquelles sont à
// portée, et où un nouveau protagoniste se pose de lui-même. Il existe pour
// que la portée d'une attaque, l'arrivée d'un déplacement et la pose d'office
// lisent la même distance. Dans le code, la carte s'appelle « le plateau » :
// « carte » y désigne déjà la carte d'adversaire (§ 16.5).
//
// Une case se désigne partout par son nom (« D4 ») : c'est lui qui est gardé
// avec le combat, et un nom se compare d'un simple « === ».

import { COLONNES, COTE, MOTIF_CASE } from "./regles.js";

/**
 * Le nom d'une case tel qu'il se garde (« D4 »), d'après ce qu'une personne a
 * saisi : les blancs de bord et la casse sont tolérés. null si ce n'est pas
 * une case du plateau.
 */
export function lireCase(texte) {
  if (typeof texte !== "string") return null;
  const nom = texte.trim().toUpperCase();
  return MOTIF_CASE.test(nom) ? nom : null;
}

/**
 * La colonne et la ligne d'une case, de 0 à 9 chacune ; null pour ce qui
 * n'est pas le nom exact d'une case (une donnée gardée peut être forgée).
 */
export function coordonnees(nomDeCase) {
  if (typeof nomDeCase !== "string" || !MOTIF_CASE.test(nomDeCase)) return null;
  return { colonne: COLONNES.indexOf(nomDeCase[0]), ligne: Number(nomDeCase.slice(1)) - 1 };
}

const nomDe = (colonne, ligne) => `${COLONNES[colonne]}${ligne + 1}`;

/**
 * La distance entre deux cases. Convention provisoire acceptée par l'auteur
 * le 11/10/2026 : une diagonale compte pour une case (Tchebychev) ; 0, c'est
 * la même case.
 *
 * Une case qui n'en est pas une est à une distance infinie : rien n'est à sa
 * portée, et aucune comparaison ne lève.
 */
export function distance(a, b) {
  const depart = coordonnees(a);
  const arrivee = coordonnees(b);
  if (!depart || !arrivee) return Infinity;
  return Math.max(Math.abs(depart.colonne - arrivee.colonne), Math.abs(depart.ligne - arrivee.ligne));
}

/**
 * Les cases situées à une distance de min à max, bornes comprises, dans
 * l'ordre A1, A2 … A10, B1 … J10 : l'écran et les contrôles comptent sur cet
 * ordre, qui ne dépend d'aucun parcours d'objet.
 */
export function casesEntre(nomDeCase, min, max) {
  const cases = [];
  if (!coordonnees(nomDeCase)) return cases;
  for (let colonne = 0; colonne < COTE; colonne += 1) {
    for (let ligne = 0; ligne < COTE; ligne += 1) {
      const nom = nomDe(colonne, ligne);
      const ecart = distance(nomDeCase, nom);
      if (ecart >= min && ecart <= max) cases.push(nom);
    }
  }
  return cases;
}

// Un PJ part de la colonne A et va vers la droite ; un adversaire part de la
// colonne J et va vers la gauche : les deux camps se font face.
const SENS = { pj: 1, adv: -1 };

/**
 * La case où un ajout se pose de lui-même : un PJ sur la colonne A, à la
 * première ligne libre en partant de 1 ; un adversaire sur la colonne J ; une
 * colonne pleine passe à sa voisine (B, puis C… ; I, puis H…). Une case est
 * libre quand personne n'y est : « occupees » donne les cases de tous les
 * protagonistes, des deux camps.
 *
 * Un nouvel exemplaire d'un adversaire déjà présent rejoint les siens :
 * « caseDesSiens » est alors rendue telle quelle, même occupée.
 *
 * null pour un camp inconnu, ou si aucune case n'est libre.
 */
export function caseDOffice(camp, occupees, caseDesSiens = null) {
  if (!Object.hasOwn(SENS, camp)) return null;
  if (caseDesSiens !== null) return coordonnees(caseDesSiens) ? caseDesSiens : null;
  const prises = new Set(occupees);
  const sens = SENS[camp];
  for (let pas = 0; pas < COTE; pas += 1) {
    const colonne = sens === 1 ? pas : COTE - 1 - pas;
    for (let ligne = 0; ligne < COTE; ligne += 1) {
      const nom = nomDe(colonne, ligne);
      if (!prises.has(nom)) return nom;
    }
  }
  return null;
}
