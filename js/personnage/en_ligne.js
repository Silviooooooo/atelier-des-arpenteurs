// Les personnages en ligne : leurs formats et leur chiffrement
// (SPECIFICATION.md, § 15.8).
//
// Un personnage enregistré se dépose par un ticket GitHub ; un automate
// (outils/automate_personnages.js) le range dans personnages/<id>.chiffre.json
// et tient personnages/index.json. Trois formats, donc : le corps du ticket,
// le fichier rangé, l'index. Ce module les écrit et les vérifie ; il ne fait
// aucun réseau. La page, l'espace auteur et l'automate le partagent : tous
// vérifient avec les mêmes fonctions.
//
// Le personnage est chiffré avec la clé de table, celle de la banque : son
// texte compressé (deflate), sous AES-GCM, IV neuf, l'identifiant du
// personnage lié au chiffré (données associées) : un chiffré recopié sous un
// autre identifiant ne se déchiffre pas. Le sel de la banque accompagne le
// chiffré : il dit sous quelle clé il a été fait, et donc si un changement
// de mot de passe l'a laissé derrière. Rien n'est en clair sur GitHub :
// l'index ne porte que des identifiants, des dates et des versions.
//
// Tout ce qui se lit ici vient d'ailleurs : c'est une donnée hostile. Tailles
// bornées, champs comptés, base64 strict, dates strictes ; le personnage
// déchiffré passe par le vérificateur de format.js.

import { depuisBase64, versBase64 } from "../securite/chiffrement.js";
import { TAILLE_MAX, decompresserBorne, lirePersonnage, transformer, verifier, versBase64Url } from "./format.js";

export const FORMAT_EN_LIGNE = 1;
export const TITRE_TICKET = "personnage";
export const ACTIONS = ["creer", "remplacer", "supprimer"];
// Le corps d'un ticket GitHub compte 65 536 signes au plus.
export const TAILLE_MAX_TICKET = 64 * 1024;
export const TAILLE_MAX_FICHIER = 96 * 1024;
export const TAILLE_MAX_INDEX = 2 * 1024 * 1024;
export const PERSONNAGES_MAX = 5000;
export const DOSSIER = "personnages";
export const CHEMIN_INDEX = "personnages/index.json";
// L'identifiant du personnage (format.js) : il nomme le fichier.
export const IDENTIFIANT = /^[A-Za-z0-9_-]{16,40}$/;
export const FICHIER = /^personnages\/([A-Za-z0-9_-]{16,40})\.chiffre\.json$/;

// La clé de dépôt : un jeton GitHub à portée fine (permission Issues sur ce
// seul dépôt), que l'auteur saisit et que la banque chiffrée transporte, au
// champ cle_depot (§ 15.8). Sa forme seule se vérifie ici.
const CLE_DEPOT = /^github_pat_[A-Za-z0-9_]{20,255}$/;

/** Vrai si le texte a la forme d'une clé de dépôt (jeton GitHub à portée fine). */
export function cleDepotValide(texte) {
  return typeof texte === "string" && CLE_DEPOT.test(texte);
}

const DATE_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const VERSION = /^[A-Za-z0-9_-]{16}$/;
const OCTETS_SEL = 16;
const OCTETS_IV = 12;
const OCTETS_ETIQUETTE = 16;

/** Le chemin du fichier d'un personnage dans le dépôt. */
export function cheminDuPersonnage(identifiant) {
  if (!IDENTIFIANT.test(identifiant)) throw new TypeError("Identifiant de personnage illisible.");
  return `${DOSSIER}/${identifiant}.chiffre.json`;
}

// ─── Les vérifications communes ─────────────────────────────────────────────

class Refus extends Error {}
const refuser = (message) => {
  throw new Refus(message);
};
const estObjet = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) && Object.getPrototypeOf(valeur) === Object.prototype;

function champs(valeur, lieu, attendus) {
  if (!estObjet(valeur)) refuser(`${lieu} n'est pas un objet.`);
  const cles = Object.keys(valeur);
  const inconnu = cles.find((k) => !attendus.includes(k));
  if (inconnu !== undefined) refuser(`${lieu} : champ inconnu.`);
  if (cles.length !== attendus.length) refuser(`${lieu} : un champ manque.`);
}

/** Vrai si le texte est une date UTC stricte (2026-09-30T10:21:36.536Z). */
export function estDateUtc(valeur) {
  return typeof valeur === "string" && DATE_UTC.test(valeur) && !Number.isNaN(Date.parse(valeur)) && new Date(valeur).toISOString().slice(0, 19) === valeur.slice(0, 19);
}

// Les octets d'un base64 strict, ou null.
function octets(valeur) {
  if (typeof valeur !== "string" || valeur.length === 0 || !BASE64.test(valeur)) return null;
  try {
    return depuisBase64(valeur);
  } catch {
    return null;
  }
}

// Le chiffré d'un personnage : { sel, iv, contenu }, bornes du § 7.1.
function verifierChiffre(chiffre, lieu) {
  champs(chiffre, lieu, ["sel", "iv", "contenu"]);
  if (octets(chiffre.sel)?.length !== OCTETS_SEL) refuser(`${lieu} : le sel n'est pas de ${OCTETS_SEL} octets en base64.`);
  if (octets(chiffre.iv)?.length !== OCTETS_IV) refuser(`${lieu} : l'IV n'est pas de ${OCTETS_IV} octets en base64.`);
  const contenu = octets(chiffre.contenu);
  if (!contenu || contenu.length <= OCTETS_ETIQUETTE) refuser(`${lieu} : le contenu chiffré est illisible ou trop court.`);
}

function lireJson(texte, taille, quoi) {
  if (typeof texte !== "string") refuser(`${quoi} est illisible.`);
  if (texte.length > taille) refuser(`${quoi} dépasse ${Math.round(taille / 1024)} Ko.`);
  // Le JSON de ces trois formats n'a que des signes ASCII imprimables et des
  // blancs : identifiants, dates, base64.
  if (!/^[\x20-\x7e\t\r\n]*$/.test(texte)) refuser(`${quoi} contient des signes inattendus.`);
  try {
    return JSON.parse(texte);
  } catch {
    refuser(`${quoi} n'est pas du JSON.`);
  }
}

function attraper(faire) {
  try {
    return faire();
  } catch (erreur) {
    if (erreur instanceof Refus) return { erreur: erreur.message };
    throw erreur;
  }
}

// ─── Le chiffrement ─────────────────────────────────────────────────────────

// Les données associées : l'identifiant, lié au chiffré.
const associees = (identifiant) => new TextEncoder().encode(`atelier-des-arpenteurs/personnage/${FORMAT_EN_LIGNE}/${identifiant}`);

/**
 * Chiffre un personnage enregistré avec le secret de table { cle, sel }.
 * Rend { sel, iv, contenu }, ou { erreur } s'il ne peut pas partir.
 */
export async function chiffrerPersonnage(personnage, { cle, sel }) {
  let texte;
  try {
    verifier(personnage);
    if (personnage.etat !== "enregistre") return { erreur: "Seul un personnage enregistré se dépose en ligne." };
    if (personnage.mode !== "reel") return { erreur: "La démonstration ne dépose rien en ligne." };
    texte = JSON.stringify(personnage);
  } catch (erreur) {
    return { erreur: `Ce personnage ne peut pas partir : ${erreur.message}` };
  }
  const clair = new TextEncoder().encode(texte);
  if (clair.length > TAILLE_MAX) return { erreur: `Ce personnage dépasse ${TAILLE_MAX / 1024} Ko.` };
  const compresse = await transformer(clair, new CompressionStream("deflate-raw"));
  const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associees(personnage.id) }, cle, compresse));
  return { sel, iv: versBase64(iv), contenu: versBase64(chiffre) };
}

// Déchiffre le contenu compressé : les octets, ou null.
async function ouvrirContenu(identifiant, chiffre, cle) {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(chiffre.iv), additionalData: associees(identifiant) }, cle, depuisBase64(chiffre.contenu)));
  } catch {
    return null;
  }
}

/**
 * Déchiffre le personnage d'un fichier rangé (lu par lireFichier) avec le
 * secret de table. Rend { personnage } ou { erreur, code } : « cle » si le
 * fichier est d'une autre clé (un ancien mot de passe), « illisible » sinon.
 */
export async function dechiffrerPersonnage(fichier, { cle, sel }, { mode = "reel" } = {}) {
  if (fichier.sel !== sel) return { erreur: "Ce personnage est chiffré avec une autre clé de table : l'auteur doit le rechiffrer.", code: "cle" };
  const compresse = await ouvrirContenu(fichier.identifiant, fichier, cle);
  if (!compresse) return { erreur: "Ce personnage ne se déchiffre pas : il est abîmé.", code: "illisible" };
  let texte;
  try {
    const clair = await decompresserBorne(compresse, TAILLE_MAX);
    if (!clair) return { erreur: `Ce personnage dépasse ${TAILLE_MAX / 1024} Ko une fois décompressé.`, code: "illisible" };
    texte = new TextDecoder("utf-8", { fatal: true }).decode(clair);
  } catch {
    return { erreur: "Ce personnage ne se décompresse pas : il est abîmé.", code: "illisible" };
  }
  const lu = lirePersonnage(texte, { mode });
  if (lu.erreur) return { erreur: lu.erreur, code: "illisible" };
  if (lu.personnage.id !== fichier.identifiant) return { erreur: "Ce personnage ne porte pas l'identifiant de son fichier.", code: "illisible" };
  if (lu.personnage.etat !== "enregistre") return { erreur: "Ce personnage en ligne n'est pas enregistré.", code: "illisible" };
  return { personnage: lu.personnage };
}

/**
 * Rechiffre le chiffré d'un personnage sous une nouvelle clé, sans le lire
 * (changement du mot de passe de table). Rend { sel, iv, contenu } ou { erreur }.
 */
export async function rechiffrer(identifiant, chiffre, ancien, nouveau) {
  if (chiffre.sel !== ancien.sel) return { erreur: "Ce personnage n'est pas chiffré avec l'ancienne clé." };
  const compresse = await ouvrirContenu(identifiant, chiffre, ancien.cle);
  if (!compresse) return { erreur: "Ce personnage ne se déchiffre pas avec l'ancienne clé." };
  const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
  const contenu = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associees(identifiant) }, nouveau.cle, compresse));
  return { sel: nouveau.sel, iv: versBase64(iv), contenu: versBase64(contenu) };
}

// ─── Le ticket ──────────────────────────────────────────────────────────────

/**
 * Lit le corps d'un ticket : { ticket: { format, action, identifiant, date,
 * personnage? } } ou { erreur }. personnage (le chiffré) accompagne « creer »
 * et « remplacer », jamais « supprimer ».
 */
export function lireTicket(corps) {
  return attraper(() => {
    const ticket = lireJson(typeof corps === "string" ? corps.trim() : corps, TAILLE_MAX_TICKET, "Le ticket");
    const avecPersonnage = estObjet(ticket) && ticket.action !== "supprimer";
    champs(ticket, "Le ticket", avecPersonnage ? ["format", "action", "identifiant", "date", "personnage"] : ["format", "action", "identifiant", "date"]);
    if (ticket.format !== FORMAT_EN_LIGNE) refuser("Le ticket n'est pas d'un format connu.");
    if (!ACTIONS.includes(ticket.action)) refuser("L'action du ticket est inconnue.");
    if (typeof ticket.identifiant !== "string" || !IDENTIFIANT.test(ticket.identifiant)) refuser("L'identifiant du ticket est illisible.");
    if (!estDateUtc(ticket.date)) refuser("La date du ticket n'est pas une date UTC.");
    if (avecPersonnage) verifierChiffre(ticket.personnage, "Le personnage du ticket");
    return { ticket };
  });
}

/**
 * Le ticket à déposer : { titre, corps }, vérifié par lireTicket avant de
 * partir, ou { erreur } (un personnage trop gros pour un ticket).
 */
export function ecrireTicket({ action, identifiant, date, personnage = null }) {
  const ticket = { format: FORMAT_EN_LIGNE, action, identifiant, date };
  if (action !== "supprimer") ticket.personnage = personnage;
  const corps = JSON.stringify(ticket);
  if (corps.length > TAILLE_MAX_TICKET) {
    return { erreur: `Ce personnage, compressé et chiffré, dépasse ${TAILLE_MAX_TICKET / 1024} Ko : il ne peut pas partir en ligne. Raccourcissez son histoire.` };
  }
  const lu = lireTicket(corps);
  return lu.erreur ? lu : { titre: TITRE_TICKET, corps };
}

// ─── Le fichier rangé ───────────────────────────────────────────────────────

const CHAMPS_FICHIER = ["format", "identifiant", "depose_le", "range_le", "ticket", "sel", "iv", "contenu"];

/** Le fichier rangé d'un ticket « creer » ou « remplacer » : son objet. */
export function fichierDuTicket(ticket, { rangeLe, numero }) {
  return {
    format: FORMAT_EN_LIGNE,
    identifiant: ticket.identifiant,
    depose_le: ticket.date,
    range_le: rangeLe,
    ticket: numero,
    sel: ticket.personnage.sel,
    iv: ticket.personnage.iv,
    contenu: ticket.personnage.contenu,
  };
}

/** Le texte d'un fichier rangé, vérifié. */
export function ecrireFichier(fichier) {
  const texte = `${JSON.stringify(fichier, null, 2)}\n`;
  const lu = lireFichier(texte, { identifiant: fichier.identifiant });
  if (lu.erreur) throw new TypeError(lu.erreur);
  return texte;
}

/**
 * Lit un fichier rangé : { fichier } ou { erreur }. identifiant : celui que
 * donne son chemin ; le fichier doit le porter.
 */
export function lireFichier(texte, { identifiant }) {
  return attraper(() => {
    const fichier = lireJson(texte, TAILLE_MAX_FICHIER, "Le fichier du personnage");
    champs(fichier, "Le fichier du personnage", CHAMPS_FICHIER);
    if (fichier.format !== FORMAT_EN_LIGNE) refuser("Le fichier du personnage n'est pas d'un format connu.");
    if (fichier.identifiant !== identifiant || !IDENTIFIANT.test(identifiant)) refuser("Le fichier du personnage ne porte pas l'identifiant de son chemin.");
    if (!estDateUtc(fichier.depose_le) || !estDateUtc(fichier.range_le)) refuser("Les dates du fichier du personnage sont illisibles.");
    if (!Number.isSafeInteger(fichier.ticket) || fichier.ticket < 1) refuser("Le numéro de ticket du fichier est illisible.");
    verifierChiffre({ sel: fichier.sel, iv: fichier.iv, contenu: fichier.contenu }, "Le fichier du personnage");
    return { fichier };
  });
}

// ─── L'index ────────────────────────────────────────────────────────────────

/** La version d'un fichier rangé : son IV, en base64url. Elle change à chaque chiffrement. */
export function versionDe(fichier) {
  return versBase64Url(depuisBase64(fichier.iv));
}

/** Le texte de l'index, de fichiers rangés : identifiants, dates, versions ; aucun nom. */
export function ecrireIndex(fichiers) {
  const index = {
    format: FORMAT_EN_LIGNE,
    personnages: [...fichiers]
      .sort((a, b) => (a.identifiant < b.identifiant ? -1 : a.identifiant > b.identifiant ? 1 : 0))
      .map((f) => ({ identifiant: f.identifiant, range_le: f.range_le, version: versionDe(f) })),
  };
  const texte = `${JSON.stringify(index, null, 2)}\n`;
  const lu = lireIndex(texte);
  if (lu.erreur) throw new TypeError(lu.erreur);
  return texte;
}

/** Lit l'index : { index } ou { erreur }. */
export function lireIndex(texte) {
  return attraper(() => {
    const index = lireJson(texte, TAILLE_MAX_INDEX, "L'index des personnages");
    champs(index, "L'index des personnages", ["format", "personnages"]);
    if (index.format !== FORMAT_EN_LIGNE) refuser("L'index des personnages n'est pas d'un format connu.");
    if (!Array.isArray(index.personnages) || index.personnages.length > PERSONNAGES_MAX) refuser("La liste de l'index est illisible.");
    const vus = new Set();
    index.personnages.forEach((entree, i) => {
      champs(entree, `L'entrée ${i + 1} de l'index`, ["identifiant", "range_le", "version"]);
      if (typeof entree.identifiant !== "string" || !IDENTIFIANT.test(entree.identifiant)) refuser(`L'entrée ${i + 1} de l'index a un identifiant illisible.`);
      if (!estDateUtc(entree.range_le)) refuser(`L'entrée ${i + 1} de l'index a une date illisible.`);
      if (typeof entree.version !== "string" || !VERSION.test(entree.version)) refuser(`L'entrée ${i + 1} de l'index a une version illisible.`);
      // Deux identifiants qui ne diffèrent que par la casse se confondraient
      // sur un disque insensible à la casse (le clone de l'auteur, sous
      // Windows) : l'index n'en admet qu'un.
      const cleCasse = entree.identifiant.toLowerCase();
      if (vus.has(cleCasse)) refuser(`L'identifiant « ${entree.identifiant} » paraît deux fois dans l'index, à la casse près.`);
      vus.add(cleCasse);
    });
    return { index };
  });
}
