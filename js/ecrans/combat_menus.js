// Les menus, les feuilles et les dialogues du combat (SPECIFICATION.md, § 17,
// « Le simulateur de combat (lot 4) » ; mission du lot 4.3, § 3, § 4.1, § 4.8
// et § 5, vues A8, F1, F7, F8, F9, F13 et E4 ; contrat de la vague 3, § 4.1).
//
// Ce qu'il tient : la couche où s'ouvrent, par-dessus le combat, les entrées
// du site (☰), le menu du combat (⋯ : le Mode MJ, « Intervenir… », « Fiches »,
// « Journal », « Nouveau combat »), « Intervenir… », le menu du MJ et ses
// panneaux, la place de la palette, le journal et les fiches en plein écran,
// et la phrase d'une seconde. Il ne porte aucune règle : ce qu'il montre vient
// des vues (js/combat/lecture.js), et chaque choix rend la main à l'écran par
// « actions ».
//
// Posé en souche avant le départ de la vague 3 (contrat, § 8.0) : la couche
// est cachée, et rien ne s'ouvre.

import { el } from "./dom.js";

/**
 * La couche des menus : { noeud, ouvrir(genre, options), fermer(), rendre(vues),
 * ouvert() }. « genre » : "site", "combat", "intervenir", "mj", "valeurs",
 * "etats", "equipement", "palette", "journal", "fiches", "toast". « minuteur » :
 * celui de la page, { poser(faire, ms) → numéro, retirer(numéro) }. ouvert()
 * rend le genre ouvert, ou null.
 */
export function creer(actions, { minuteur = null } = {}) {
  const noeud = el("div", { hidden: true });

  function ouvrir(genre, options = {}) {}

  function fermer() {}

  function rendre(vues = {}) {}

  return { noeud, ouvrir, fermer, rendre, ouvert: () => null };
}
