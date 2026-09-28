// Chargement de la banque (SPECIFICATION.md, § 7.2, § 8.3 et § 9).
//
// Télécharge le fichier chiffré avec un paramètre unique (?v=<horodatage>),
// que ni le navigateur ni le cache de GitHub Pages ne servent périmé, puis
// l'ouvre avec la clé gardée sur l'appareil, ou avec le mot de passe saisi.
//
// Le mode « démonstration » (?demo=1) lit la banque fictive d'essais/,
// chiffrée avec un mot de passe public, affiché à l'écran ; sa clé se garde
// à part de la clé réelle (coffre.js).

import { lireEnTete, ouvrir, ouvrirAvecMotDePasse } from "../securite/chiffrement.js";

export const CHEMINS = { reel: "donnees/banque.chiffree.json", demo: "essais/banque_demo.chiffree.json" };

/** Le mot de passe de la démonstration. Il n'est pas secret : l'écran l'affiche. */
export const MOT_DE_PASSE_DEMO = "louche passoire marmite fouet";

/** Le mode de la page, d'après la partie « ?… » de son adresse. */
export function modeDe(recherche) {
  return new URLSearchParams(recherche).get("demo") === "1" ? "demo" : "reel";
}

/**
 * Télécharge la banque du mode : { enveloppe }, { absente: true } quand
 * aucune banque n'est publiée (404), ou { erreur }.
 */
export async function telecharger(mode, { fetch = globalThis.fetch, maintenant = Date.now() } = {}) {
  let reponse;
  try {
    reponse = await fetch(`${CHEMINS[mode]}?v=${maintenant}`, { cache: "no-store" });
  } catch {
    return { erreur: "La banque n'a pas pu être téléchargée : vérifiez la connexion, puis rechargez la page." };
  }
  if (reponse.status === 404) return { absente: true };
  if (!reponse.ok) return { erreur: `La banque n'a pas pu être téléchargée (code ${reponse.status}) : rechargez la page dans un moment.` };
  let enveloppe;
  try {
    enveloppe = await reponse.json();
  } catch {
    return { erreur: "Le fichier de la banque est abîmé : ce n'est pas du JSON." };
  }
  const enTete = lireEnTete(enveloppe);
  return enTete.erreur ? { erreur: enTete.erreur } : { enveloppe };
}

/**
 * Ouvre la banque avec la clé gardée pour ce mode : { banque, secret },
 * { motDePasse: "requis" } sans clé gardée, { motDePasse: "change" } quand
 * le mot de passe de table a changé (§ 7.2), ou { erreur }.
 */
export async function ouvrirAvecCoffre(enveloppe, coffre, mode) {
  const garde = await coffre.lireCle(mode);
  if (!garde) return { motDePasse: "requis" };
  const resultat = await ouvrir(enveloppe, garde);
  if (resultat.banque) return { banque: resultat.banque, secret: garde };
  if (resultat.code === "sel_change" || resultat.code === "mot_de_passe") return { motDePasse: "change" };
  return { erreur: resultat.erreur };
}

/**
 * Ouvre la banque avec le mot de passe saisi, et garde la clé sur
 * l'appareil si la personne l'a demandé : { banque, secret } ou { erreur,
 * duree }. secret.duree est la durée de la dérivation.
 */
export async function ouvrirParMotDePasse(enveloppe, motDePasse, { coffre, mode, garder }) {
  const resultat = await ouvrirAvecMotDePasse(enveloppe, motDePasse);
  if (resultat.erreur) return resultat;
  if (garder) await coffre.garderCle(mode, resultat.secret);
  return resultat;
}

/**
 * Demande au navigateur de ne pas effacer les données du site (§ 7.3) :
 * « accordé », « déjà accordé », « refusé » ou « non pris en charge ».
 */
export async function demanderStockageDurable(stockage = globalThis.navigator?.storage) {
  if (typeof stockage?.persist !== "function") return "non pris en charge";
  try {
    if (await stockage.persisted?.()) return "déjà accordé";
    return (await stockage.persist()) ? "accordé" : "refusé";
  } catch {
    return "non pris en charge";
  }
}

/** L'empreinte courte du diagnostic : les 12 premiers chiffres. */
export function empreinteCourte(empreinte) {
  return String(empreinte ?? "").replace(/^sha256:/, "").slice(0, 12);
}
