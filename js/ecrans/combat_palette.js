// La palette du combat (SPECIFICATION.md, § 17, « Le simulateur de combat
// (lot 4) » ; mission du lot 4.3, § 4.5 et § 4.6, vues F4, E1 et E6 ; contrat
// de la vague 3, § 3.5 et § 4.1).
//
// Ce qu'elle montre : les effets qu'une source peut appliquer, rangés en cinq
// onglets (Dés, Zone, Dégâts, Cible, Durée), la ligne que le journal écrira,
// puis « Fermer » et « Appliquer ». Au téléphone, l'écran la pose dans une
// feuille qui monte du bas ; sur PC, la bulle la porte en colonne, à droite
// des dés. Elle ne porte aucune règle : chaque genre, chaque option, chaque
// borne et chaque raison viennent de la vue (vuePalette, js/combat/lecture.js) ;
// ce qu'on y choisit remonte à l'écran, qui redemande la vue.
//
// Posé en souche avant le départ de la vague 3 (contrat, § 8.0) : le nœud est
// caché, rendre ne fait rien, et rien n'est choisi.

import { el } from "./dom.js";

/**
 * La palette : { noeud, rendre(vue, ecran), choisi() }. « actions » :
 * executer(commande, origine), choisirDansLaPalette(choisi),
 * changerLaSource(source), fermerLaPalette(), demanderUneCase(options,
 * rappel). rendre reçoit vuePalette (ou null) et { etroit, modeMj } ;
 * choisi() rend { genre, valeurs, x }, ou null.
 */
export function creer(actions) {
  const noeud = el("div", { hidden: true });

  function rendre(vue, ecran = {}) {}

  return { noeud, rendre, choisi: () => null };
}
