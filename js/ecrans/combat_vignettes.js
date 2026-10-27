// Les vignettes du combat, au téléphone (SPECIFICATION.md, § 17, « Le
// simulateur de combat (lot 4) » ; mission du lot 4.3, § 3, vues A1 et A7 ;
// contrat de la vague 3, § 3.5 et § 4.1).
//
// Une vignette par protagoniste vivant du camp qui joue : son initiale et son
// nom court, un rond par action restante, en couleur s'il peut encore agir, en
// gris s'il a tout joué ; celle du protagoniste choisi, marquée. Un appui le
// choisit, comme son jeton ; un appui long d'une demi-seconde ouvre le menu du
// MJ en Mode MJ, et dit sinon où il s'ouvre. Elle ne sait rien du jeu : elle
// montre la vue qu'on lui donne (vueVignettes, js/combat/lecture.js) et rend
// la main à l'écran par « actions ».
//
// Posé en souche avant le départ de la vague 3 (contrat, § 8.0) : le nœud est
// caché, et rendre ne fait rien.

import { el } from "./dom.js";

/**
 * Les vignettes : { noeud, rendre(vue, ecran) }. « actions » : executer(
 * commande, origine), ouvrirMenuMj(id, ancre), dire(texte). « minuteur » : celui
 * de la page, { poser(faire, ms) → numéro, retirer(numéro) }. rendre reçoit
 * vueVignettes (ou null) et { modeMj, arrete }.
 */
export function creer(actions, { minuteur = null } = {}) {
  const noeud = el("div", { hidden: true });

  function rendre(vue, ecran = {}) {}

  return { noeud, rendre };
}
