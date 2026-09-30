// La préparation d'une publication (SPECIFICATION.md, § 6.4, § 7, § 8.2 et
// § 8.4).
//
// Ce que l'espace auteur montre avant de publier, et ce qu'il écrit : la
// banque publiée déchiffrée avec le secret gardé, les différences, le résumé
// d'une ligne qui sert de message de commit, et la nouvelle banque, datée
// puis chiffrée sous ce même secret. github.publier appelle cette
// préparation à chaque lecture, y compris après un sha périmé.
//
// La clé de dépôt des personnages voyage dans la banque chiffrée, au champ
// cle_depot (§ 8.4) : l'auteur la garde, la remplace ou la retire, et la
// préparation dit ce qu'il advient d'elle, pour l'écran de confirmation. Le
// message de commit, public, n'en dit rien.
//
// Au changement du mot de passe, les personnages en ligne sont rechiffrés
// avec la banque, pour un seul commit (github.publierParCommit).

import { dateLisible, horodatage } from "../banque/dates.js";
import { comparer, resumer } from "../banque/differences.js";
import { cleDepotValide } from "../personnage/en_ligne.js";
import { chiffrer, ouvrir } from "../securite/chiffrement.js";
import { rechiffrerPourChangement, reprendre } from "./personnages.js";

const GARDER = { action: "garder" };

// La banque datée, ses champs dans l'ordre du § 5.1, et la clé de dépôt en
// dernier, seulement si elle a une valeur. Une banque déjà publiée perd son
// ancienne date, et sa clé : c'est la décision de l'auteur qui la remet.
function dater(banque, date, cleDepot = null) {
  const { format, publiee_le: _ancienne, cle_depot: _cle, ...reste } = banque;
  const datee = { format, publiee_le: horodatage(date), ...reste };
  if (cleDepot !== null) datee.cle_depot = cleDepot;
  return datee;
}

const refusDeLaCle = (erreur) => ({ code: "cle_depot", erreur });
const CLE_SAISIE_INVALIDE = "La clé de dépôt saisie n'a pas la forme d'un jeton GitHub à portée fine (« github_pat_… ») : rien n'est publié.";
// Les deux clés ont la même forme, et se créent sur le même écran de GitHub :
// la clé GitHub de l'auteur (Contents) partirait chez tous les joueurs.
const CLE_SAISIE_AUTEUR =
  "La clé de dépôt saisie est la clé GitHub de l'auteur, qui peut écrire dans le dépôt : elle ne doit jamais partir dans la banque. Créez une clé à part, permission Issues seule : rien n'est publié.";

// Le refus d'une clé saisie, dit avant le mot de passe, ou null.
function refusDeLaSaisie(decision, jetonAuteur) {
  if (decision?.action !== "remplacer") return null;
  if (!cleDepotValide(decision.valeur)) return refusDeLaCle(CLE_SAISIE_INVALIDE);
  return jetonAuteur && decision.valeur === jetonAuteur ? refusDeLaCle(CLE_SAISIE_AUTEUR) : null;
}

/**
 * La clé de dépôt que portera la nouvelle banque : { valeur, sort } ou
 * { erreur, code: "cle_depot" }. ancienne : la banque publiée déchiffrée, ou
 * null ; decision : { action: "garder" }, { action: "remplacer", valeur } ou
 * { action: "retirer" } ; jetonAuteur : la clé GitHub de l'auteur, que la
 * clé de dépôt ne doit jamais être. sort : « ajoutee », « remplacee »,
 * « retiree », « gardee » ou « absente ». Une clé de forme invalide, ou qui
 * est la clé de l'auteur, ne part jamais, même déjà publiée.
 */
function cleDeDepot(ancienne, decision, jetonAuteur = null) {
  const publiee = ancienne?.cle_depot ?? null;
  let valeur;
  if (decision?.action === "garder") valeur = publiee;
  else if (decision?.action === "remplacer") valeur = decision.valeur;
  else if (decision?.action === "retirer") valeur = null;
  else return refusDeLaCle("La décision sur la clé de dépôt est inconnue : rien n'est publié.");
  if (valeur !== null && !cleDepotValide(valeur)) {
    return refusDeLaCle(
      decision.action === "garder"
        ? "La clé de dépôt de la banque publiée n'a pas la forme d'un jeton GitHub à portée fine : remplacez-la ou retirez-la, puis publiez."
        : CLE_SAISIE_INVALIDE,
    );
  }
  if (valeur !== null && jetonAuteur && valeur === jetonAuteur) {
    return refusDeLaCle(
      decision.action === "garder"
        ? "La clé de dépôt de la banque publiée est la clé GitHub de l'auteur, qui peut écrire dans le dépôt : retirez-la, puis publiez ; révoquez-la ensuite sur GitHub, et créez-en une autre."
        : CLE_SAISIE_AUTEUR,
    );
  }
  let sort;
  if (valeur === null) sort = publiee === null ? "absente" : "retiree";
  else if (publiee === null) sort = "ajoutee";
  else sort = publiee === valeur ? "gardee" : "remplacee";
  return { valeur, sort };
}

/**
 * publiee : { sha, enveloppe } lu sur GitHub, enveloppe null à la première
 * publication ; banque : la banque importée ; secret : { cle, sel,
 * iterations } du mot de passe de table, ou null s'il reste à saisir ; cle :
 * la décision sur la clé de dépôt (gardée par défaut) ; jetonAuteur : la clé
 * GitHub de l'auteur, qui ne doit jamais devenir la clé de dépôt.
 * Rend { ancienne, banque, differences, message, enveloppe, erreurs,
 * cle_depot }, ou { erreur, code } : « bloquante » (E1),
 * « nouveau_mot_de_passe » (première publication), « mot_de_passe_requis »,
 * « sel_change », « cle_depot ».
 */
export async function preparerPublication({ publiee, banque, secret, date = new Date(), cle = GARDER, jetonAuteur = null }) {
  if (!banque || banque.anomalies.some((anomalie) => anomalie.gravite === "bloquante")) {
    return { code: "bloquante", erreur: "Le classeur ne peut pas être publié : une feuille ou un en-tête attendu manque (E1)." };
  }
  // Une clé saisie de travers se dit avant le mot de passe.
  const saisie = refusDeLaSaisie(cle, jetonAuteur);
  if (saisie) return saisie;
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
  const depot = cleDeDepot(ancienne, cle, jetonAuteur);
  if (depot.erreur) return depot;
  const nouvelle = dater(banque, date, depot.valeur);
  const differences = comparer(ancienne, nouvelle);
  const erreurs = nouvelle.anomalies.filter((anomalie) => anomalie.gravite === "erreur").length;
  const message = resumer(differences, { date, erreurs });
  return { ancienne, banque: nouvelle, differences, message, enveloppe: await chiffrer(nouvelle, secret), erreurs, cle_depot: depot.sort };
}

const personnages = (n) => `${n} ${n > 1 ? "personnages rechiffrés" : "personnage rechiffré"}`;

/**
 * Le changement de mot de passe, en une action (§ 7.3, § 8.4) : la banque
 * publiée, déchiffrée avec l'ancien secret, est republiée sous le nouveau, et
 * les personnages en ligne que l'ancien chiffrait sont rechiffrés sous le
 * nouveau. publiee : l'état lu par github.lireDepot ({ enveloppe,
 * personnages, index }), ou { sha, enveloppe } sans personnages ; cle et
 * jetonAuteur, comme pour preparerPublication.
 * Rend, en plus de ce que rend preparerPublication, fichiers (les
 * personnages rechiffrés et l'index, à écrire avec la banque) et personnages
 * ({ total, rechiffres, aJour, autreCle, echecs, illisibles }, identifiants).
 */
export async function preparerChangement({ publiee, ancien, nouveau, date = new Date(), cle = GARDER, jetonAuteur = null }) {
  if (!publiee.enveloppe) {
    return { code: "absente", erreur: "Aucune banque n'est publiée : le mot de passe se choisit à la première publication." };
  }
  const saisie = refusDeLaSaisie(cle, jetonAuteur);
  if (saisie) return saisie;
  if (!ancien) return { code: "mot_de_passe_requis", erreur: "Saisissez d'abord l'ancien mot de passe de table." };
  const ouverte = await ouvrir(publiee.enveloppe, ancien);
  if (ouverte.erreur) return ouverte.code === "mot_de_passe" ? { ...ouverte, code: "sel_change" } : ouverte;
  const depot = cleDeDepot(ouverte.banque, cle, jetonAuteur);
  if (depot.erreur) return depot;
  const banque = dater(ouverte.banque, date, depot.valeur);
  const liste = publiee.personnages ?? [];
  const rechiffrement = await rechiffrerPourChangement({ personnages: liste, index: publiee.index ?? null, ancien, nouveau });
  if (rechiffrement.erreur) return rechiffrement;
  const { fichiers, ...bilan } = rechiffrement;
  const differences = comparer(ouverte.banque, banque);
  const compteur = bilan.rechiffres.length ? `, ${personnages(bilan.rechiffres.length)}` : "";
  const message = `${resumer(differences, { date })} — nouveau mot de passe de table${compteur}`;
  return {
    ancienne: ouverte.banque,
    banque,
    differences,
    message,
    enveloppe: await chiffrer(banque, nouveau),
    erreurs: 0,
    cle_depot: depot.sort,
    personnages: { total: liste.length, ...bilan },
    fichiers,
  };
}

/**
 * La reprise des personnages en ligne qu'un ancien mot de passe a chiffrés
 * (§ 8.4) : ils passent sous la clé de la banque publiée, que secret doit
 * ouvrir, pour un seul commit sans la banque. publiee : l'état lu par
 * github.lireDepot ; cles : les clés déjà dérivées de motDePasse, gardées
 * d'un essai à l'autre. Rend { message, fichiers, personnages } ou
 * { erreur, code } : rien ne s'écrit si aucun personnage ne se reprend.
 */
export async function preparerReprise({ publiee, secret, motDePasse, cles = new Map(), date = new Date() }) {
  if (!publiee.enveloppe) return { code: "absente", erreur: "Aucune banque n'est publiée : il n'y a rien à rechiffrer." };
  if (!secret) return { code: "mot_de_passe_requis", erreur: "Ouvrez d'abord la banque avec le mot de passe de table actuel." };
  // La clé de la banque publiée se vérifie sur la banque elle-même : un
  // personnage rechiffré sous une autre clé ne s'ouvrirait plus pour personne.
  const ouverte = await ouvrir(publiee.enveloppe, secret);
  if (ouverte.code === "sel_change") {
    return { ...ouverte, erreur: "Le mot de passe de table a changé sur GitHub depuis l'ouverture de la banque sur cet appareil : rechargez la page, puis recommencez." };
  }
  if (ouverte.erreur) return ouverte;
  const liste = publiee.personnages ?? [];
  const reprise = await reprendre({ personnages: liste, index: publiee.index ?? null, motDePasse, secret, cles });
  if (reprise.erreur) return reprise;
  const { fichiers, ...bilan } = reprise;
  const restants = bilan.echecs.length;
  if (!bilan.rechiffres.length && !restants) {
    return { code: "rien", erreur: "Aucun personnage en ligne n'est à rechiffrer : tous s'ouvrent avec le mot de passe de table actuel." };
  }
  if (!bilan.rechiffres.length) {
    return { code: "mot_de_passe", erreur: restants > 1 ? `Ce mot de passe n'ouvre aucun des ${restants} personnages à rechiffrer.` : "Ce mot de passe n'ouvre pas le personnage à rechiffrer." };
  }
  const message = `Rechiffrement des personnages en ligne — ${dateLisible(date)} — ${personnages(bilan.rechiffres.length)} sous le mot de passe de table actuel`;
  return { message, fichiers, personnages: { total: liste.length, ...bilan } };
}
