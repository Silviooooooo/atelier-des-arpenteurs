// Le Mode MJ, gardé sur l'appareil (SPECIFICATION.md, § 17.8 ; mission du lot
// 4.3, § 5 ; contrat de la vague 3, D5 et § 4.1).
//
// Un interrupteur, éteint par défaut : éteint, le jeu suit ses règles ;
// allumé, l'écran du combat montre aussi les corrections hors règles. Ce
// n'est pas un événement du combat : le rejeu ne le lit pas. Il se garde dans
// localStorage, clé « atelier.mode-mj », valeur « 1 » quand il est allumé,
// comme la vue d'une fiche (atelier.vue-personnage). Ce module existe à part
// parce que l'écran du combat ne nomme jamais le stockage de l'appareil
// (tests/combat_ecran.test.js) : il lit et écrit par ces deux fonctions.
// Le navigateur peut refuser le stockage (navigation privée) : le Mode MJ est
// alors éteint, et ne se garde pas.
//
// Posé en souche avant le départ de la vague 3 (contrat, § 8.0) ; l'écran ne
// l'appelle pas encore.

export const CLE_MODE_MJ = "atelier.mode-mj";

/** Vrai quand le Mode MJ est allumé sur cet appareil ; faux par défaut, et si le stockage refuse. */
export function lireModeMj() {
  try {
    return globalThis.localStorage?.getItem(CLE_MODE_MJ) === "1";
  } catch {
    return false;
  }
}

/** Garde le Mode MJ sur cet appareil : « 1 » allumé, « 0 » éteint ; sans effet si le stockage refuse. */
export function ecrireModeMj(allume) {
  try {
    globalThis.localStorage?.setItem(CLE_MODE_MJ, allume ? "1" : "0");
  } catch {
    // stockage refusé : le Mode MJ vaut pour la visite, sans se garder
  }
}
