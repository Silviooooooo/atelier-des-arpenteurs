// Les vues de la palette et du menu du MJ (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) » ; mission du lot 4.3, § 4.6 à § 4.8 et § 5 ;
// contrat de la vague 3, § 3.5).
//
// Ce module fabrique, sans rien toucher de la page, les deux vues des outils
// du MJ : la palette (vuePalette), qui applique un effet au nom d'une source,
// et le menu du MJ d'un protagoniste (vueMenuMj). Il existe à part de
// js/combat/lecture.js, qui les réexporte, pour qu'une part de la vague 3 les
// écrive pendant qu'une autre écrit les autres vues. Il suit les règles de
// lecture.js : chaque élément actionnable porte sa commande ou son gabarit,
// avec « actif » et sa raison ; ce que le Mode MJ seul montre porte
// « mj: true » ; la vue ne lit jamais le Mode MJ, ni la page.
//
// Posé en souche avant le départ de la vague 3 (contrat, § 8.0) : les deux
// vues rendent null.

/**
 * La palette (contrat de la vague 3, § 3.5) : null si la source n'existe pas ;
 * sinon { titre, sous, texte, source: { valeur, nom, phrase, phraseMj, choix },
 * x, onglets: [{ cle, libelle, genres, champ }], effetsEnCours, apercu,
 * appliquer: { libelle, actif, raison, commande } | null, fermer }.
 * « source » : { genre: "capacite", qui, capacite } | { genre: "etat", effet }
 * | { genre: "mj" }. « apports » : { etats (etatsDeLaBanque(banque).blocs),
 * libre (ouverte par « Palette »), choisi: { genre, valeurs, x } | null }.
 */
export function vuePalette(etat, source, apports = {}) {
  return null;
}

/**
 * Le menu du MJ d'un protagoniste (contrat de la vague 3, § 3.5) : null pour
 * un mort ou un retiré ; sinon { titre, sous, actif, raison, note, valeurs,
 * equipement, etats, deplacer, retirer }, chaque entrée avec « actif », sa
 * raison et « mj: true ». « apports » : { etats (etatsDeLaBanque(banque).blocs),
 * saisies: { [champ]: valeur } | null }.
 */
export function vueMenuMj(etat, id, apports = {}) {
  return null;
}
