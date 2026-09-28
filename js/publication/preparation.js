// La préparation d'une publication (SPECIFICATION.md, § 6.4, § 7 et § 8.2).
//
// Ce que l'espace auteur montre avant de publier, et ce qu'il écrit : la
// banque publiée déchiffrée avec le secret gardé, les différences, le résumé
// d'une ligne qui sert de message de commit, et la nouvelle banque, datée
// puis chiffrée sous ce même secret. github.publier appelle cette
// préparation à chaque lecture, y compris après un sha périmé.

import { horodatage } from "../banque/dates.js";
import { comparer, resumer } from "../banque/differences.js";
import { chiffrer, ouvrir } from "../securite/chiffrement.js";

// La banque datée, ses champs dans l'ordre du § 5.1 ; une banque déjà
// publiée perd son ancienne date.
function dater(banque, date) {
  const { format, publiee_le: _ancienne, ...reste } = banque;
  return { format, publiee_le: horodatage(date), ...reste };
}

/**
 * publiee : { sha, enveloppe } lu sur GitHub, enveloppe null à la première
 * publication ; banque : la banque importée ; secret : { cle, sel,
 * iterations } du mot de passe de table, ou null s'il reste à saisir.
 * Rend { ancienne, banque, differences, message, enveloppe, erreurs }, ou
 * { erreur, code } : « bloquante » (E1), « nouveau_mot_de_passe » (première
 * publication), « mot_de_passe_requis », « sel_change ».
 */
export async function preparerPublication({ publiee, banque, secret, date = new Date() }) {
  if (!banque || banque.anomalies.some((anomalie) => anomalie.gravite === "bloquante")) {
    return { code: "bloquante", erreur: "Le classeur ne peut pas être publié : une feuille ou un en-tête attendu manque (E1)." };
  }
  if (!secret) {
    return publiee.enveloppe
      ? { code: "mot_de_passe_requis", erreur: "Saisissez le mot de passe de table pour comparer avec la banque publiée." }
      : { code: "nouveau_mot_de_passe", erreur: "Première publication : choisissez le mot de passe de table." };
  }
  let ancienne = null;
  if (publiee.enveloppe) {
    const ouverte = await ouvrir(publiee.enveloppe, secret);
    if (ouverte.erreur) return ouverte.code === "mot_de_passe" ? { ...ouverte, code: "sel_change" } : ouverte;
    ancienne = ouverte.banque;
  }
  const nouvelle = dater(banque, date);
  const differences = comparer(ancienne, nouvelle);
  const erreurs = nouvelle.anomalies.filter((anomalie) => anomalie.gravite === "erreur").length;
  const message = resumer(differences, { date, erreurs });
  return { ancienne, banque: nouvelle, differences, message, enveloppe: await chiffrer(nouvelle, secret), erreurs };
}

/**
 * Le changement de mot de passe, en une action (§ 7.3) : la banque publiée,
 * déchiffrée avec l'ancien secret, est republiée sous le nouveau.
 */
export async function preparerChangement({ publiee, ancien, nouveau, date = new Date() }) {
  if (!publiee.enveloppe) {
    return { code: "absente", erreur: "Aucune banque n'est publiée : le mot de passe se choisit à la première publication." };
  }
  if (!ancien) return { code: "mot_de_passe_requis", erreur: "Saisissez d'abord l'ancien mot de passe de table." };
  const ouverte = await ouvrir(publiee.enveloppe, ancien);
  if (ouverte.erreur) return ouverte.code === "mot_de_passe" ? { ...ouverte, code: "sel_change" } : ouverte;
  const banque = dater(ouverte.banque, date);
  const differences = comparer(ouverte.banque, banque);
  const message = `${resumer(differences, { date })} — nouveau mot de passe de table`;
  return { ancienne: ouverte.banque, banque, differences, message, enveloppe: await chiffrer(banque, nouveau), erreurs: 0 };
}
