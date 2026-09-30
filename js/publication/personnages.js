// Les personnages en ligne, vus de l'espace auteur (SPECIFICATION.md, § 8.4
// et § 15.8) : leur rechiffrement au changement du mot de passe de table,
// l'inventaire de ceux qu'une autre clé a chiffrés, et leur reprise avec un
// ancien mot de passe.
//
// Aucun réseau : github.lireDepot lit les fichiers, github.publierParCommit
// écrit le commit. Ce module vérifie chaque fichier (lireFichier), le
// rechiffre sans le lire (rechiffrer : le contenu compressé passe d'une clé à
// l'autre, l'identifiant toujours lié), puis régénère l'index. Un fichier
// qu'il ne peut pas rechiffrer est laissé tel quel, et compté : rien ne se
// perd, et l'écran le dit.

import { CHEMIN_INDEX, ecrireFichier, ecrireIndex, lireFichier, lireIndex, rechiffrer } from "../personnage/en_ligne.js";
import { deriverCle, normaliserMotDePasse } from "../securite/chiffrement.js";

// Les fichiers lus par lireDepot, vérifiés : { lus, illisibles }.
function verifier(personnages) {
  const lus = [];
  const illisibles = [];
  for (const { identifiant, chemin, texte, erreur } of personnages) {
    const lu = erreur ? { erreur } : lireFichier(texte, { identifiant });
    if (lu.erreur) illisibles.push(identifiant);
    else lus.push({ identifiant, chemin, fichier: lu.fichier });
  }
  return { lus, illisibles };
}

/**
 * Ce qu'ouvre la banque publiée, de sel sel, parmi les personnages lus, sans
 * rien déchiffrer : { total, aJour, autreCle, illisibles } ; aJour est un
 * nombre, les deux derniers des listes d'identifiants.
 */
export function inventaire(personnages, sel) {
  const { lus, illisibles } = verifier(personnages);
  const autreCle = lus.filter(({ fichier }) => fichier.sel !== sel).map(({ identifiant }) => identifiant);
  return { total: personnages.length, aJour: lus.length - autreCle.length, autreCle, illisibles };
}

// L'entrée d'index d'un fichier illisible se garde telle quelle : ecrireIndex
// prend des fichiers, et la version d'une entrée est l'IV du fichier en
// base64url, qui redevient donc un IV.
const commeFichier = ({ identifiant, range_le, version }) => ({ identifiant, range_le, iv: version.replace(/-/g, "+").replace(/_/g, "/") });

// L'index régénéré : { texte } ou { erreur }.
function regenererIndex(fichiers, illisibles, index) {
  const anciennes = new Map((lireIndex(index ?? "").index?.personnages ?? []).map((entree) => [entree.identifiant, entree]));
  const gardees = illisibles.filter((identifiant) => anciennes.has(identifiant)).map((identifiant) => commeFichier(anciennes.get(identifiant)));
  try {
    return { texte: ecrireIndex([...fichiers, ...gardees]) };
  } catch (erreur) {
    return { erreur: `L'index des personnages ne peut pas être régénéré : ${erreur.message}` };
  }
}

/**
 * Rechiffre sous la clé nouveau les personnages lus par lireDepot.
 * clesDe(fichier) rend les clés à essayer, dans l'ordre, en fonctions (une
 * dérivation ne se fait qu'au besoin) ; aucune : le fichier est d'une autre
 * clé, laissé. Rend { fichiers, rechiffres, aJour, autreCle, echecs,
 * illisibles } ou { erreur, code } : fichiers, les textes à écrire
 * (personnages rechiffrés, puis l'index, s'il y a des personnages ou un
 * index) ; les autres, des identifiants. echecs : les fichiers qu'aucune clé
 * essayée n'ouvre.
 */
async function rechiffrerLes({ personnages, index, nouveau, clesDe }) {
  const { lus, illisibles } = verifier(personnages);
  const bilan = { fichiers: [], rechiffres: [], aJour: [], autreCle: [], echecs: [], illisibles };
  const pourIndex = [];
  for (const { identifiant, chemin, fichier } of lus) {
    let final = fichier;
    const cles = fichier.sel === nouveau.sel ? null : clesDe(fichier);
    if (!cles) bilan.aJour.push(identifiant);
    else if (!cles.length) bilan.autreCle.push(identifiant);
    else {
      let chiffre = null;
      for (const cle of cles) {
        const essai = await rechiffrer(identifiant, fichier, await cle(), nouveau);
        if (!essai.erreur) {
          chiffre = essai;
          break;
        }
      }
      if (chiffre) {
        // Ses autres champs restent : dates de dépôt et de rangement, ticket.
        final = { ...fichier, ...chiffre };
        bilan.fichiers.push({ chemin, texte: ecrireFichier(final) });
        bilan.rechiffres.push(identifiant);
      } else bilan.echecs.push(identifiant);
    }
    pourIndex.push(final);
  }
  if (personnages.length || index !== null) {
    const regenere = regenererIndex(pourIndex, illisibles, index);
    if (regenere.erreur) return { erreur: regenere.erreur, code: "index" };
    bilan.fichiers.push({ chemin: CHEMIN_INDEX, texte: regenere.texte });
  }
  return bilan;
}

/**
 * Au changement du mot de passe de table : tout ce que l'ancienne clé a
 * chiffré passe sous la nouvelle. Un personnage d'une autre clé (un mot de
 * passe plus ancien encore) est laissé, et compté dans autreCle.
 */
export function rechiffrerPourChangement({ personnages = [], index = null, ancien, nouveau }) {
  return rechiffrerLes({ personnages, index, nouveau, clesDe: (fichier) => (fichier.sel === ancien.sel ? [async () => ancien] : []) });
}

/**
 * La reprise : les personnages qu'un ancien mot de passe a chiffrés passent
 * sous la clé de la banque publiée (secret). La clé de chaque sel se dérive
 * du mot de passe saisi, en minuscules puis, si elle diffère, sous sa forme
 * exacte (celle d'avant le lot 2 bis), comme ouvrirAvecMotDePasse ; une
 * seule fois par sel et par forme (cles, qu'on garde d'un essai à l'autre).
 * Le fichier ne dit pas son nombre d'itérations : c'est celui de la banque.
 */
export function reprendre({ personnages = [], index = null, motDePasse, secret, cles = new Map() }) {
  const exacte = motDePasse.normalize("NFC").trim();
  const formes = exacte === normaliserMotDePasse(motDePasse) ? [true] : [true, false];
  const deriver = (sel, minuscules) => {
    const cle = `${minuscules ? "minuscules" : "exacte"}:${sel}`;
    if (!cles.has(cle)) cles.set(cle, deriverCle(motDePasse, sel, secret.iterations, { minuscules }));
    return cles.get(cle);
  };
  return rechiffrerLes({ personnages, index, nouveau: secret, clesDe: (fichier) => formes.map((minuscules) => () => deriver(fichier.sel, minuscules)) });
}
