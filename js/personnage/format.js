// Le personnage : son format, son fichier et son lien (SPECIFICATION.md,
// § 15.1 et § 15.6).
//
// Un personnage garde ses choix, jamais des copies de la banque : des noms,
// des nombres, des textes de joueur. Tout fichier ou lien reçu est une
// donnée hostile : sa taille est bornée (64 Ko décompressés au plus), son
// schéma est vérifié champ par champ, un champ inconnu le fait refuser, et
// rien n'en sort jamais comme HTML. Les noms qu'il porte se cherchent dans
// la banque (calcul.js) : ceux qui ne renvoient à rien sont signalés.
//
// Le lien « Ouvrir sur mon téléphone » porte le personnage dans le fragment
// de l'adresse (#/recevoir/…), qui n'est jamais envoyé à un serveur : son
// texte compressé (deflate), en base64url.

import { CARACTERISTIQUES, CARACTERISTIQUE_MAX, CARACTERISTIQUE_MIN, NIVEAU_MAX, SOMME_CARACTERISTIQUES } from "./regles.js";

export const FORMAT = 1;
export const EXTENSION = ".arpenteur.json";
export const TAILLE_MAX = 64 * 1024;
export const ETAPES = 9;

// Les bornes du schéma : assez larges pour tout personnage, assez courtes
// pour qu'un fichier hostile ne fige rien.
const BORNES = { nom: 120, identite: 120, age: 40, description: 4000, histoire: 12000, choix: 30, objets: 80, niveaux: 80, empreintes: 300 };

export class ErreurPersonnage extends Error {}

const refuser = (message) => {
  throw new ErreurPersonnage(message);
};

/** Un identifiant tiré au hasard : 22 signes base64url (128 bits). */
export function nouvelIdentifiant(aleatoire = (octets) => crypto.getRandomValues(octets)) {
  return versBase64Url(aleatoire(new Uint8Array(16)));
}

/** Un personnage neuf : un brouillon vide, dans un mode. */
export function nouveauPersonnage(mode, maintenant = new Date()) {
  const date = maintenant.toISOString();
  return {
    format: FORMAT,
    id: nouvelIdentifiant(),
    mode,
    etat: "brouillon",
    etape: 1,
    cree_le: date,
    modifie_le: date,
    enregistre_le: null,
    banque: null,
    identite: { nom: "", age: "", description: "", histoire: "" },
    caracteristiques: Object.fromEntries(CARACTERISTIQUES.map((c) => [c.code, null])),
    archetype: null,
    espece: null,
    constellation: null,
    primordial: null,
    equipement: [],
    arme_principale: null,
    bouclier: null,
    niveaux: [],
    empreintes: [],
  };
}

// ─── La vérification ────────────────────────────────────────────────────────

const estObjet = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) && Object.getPrototypeOf(valeur) === Object.prototype;

function champs(valeur, lieu, attendus) {
  if (!estObjet(valeur)) refuser(`${lieu} n'est pas un objet.`);
  const cles = Object.keys(valeur);
  const inconnu = cles.find((k) => !attendus.includes(k));
  if (inconnu !== undefined) refuser(`${lieu} : le champ « ${String(inconnu).slice(0, 40)} » est inconnu.`);
  const absent = attendus.find((k) => !Object.hasOwn(valeur, k));
  if (absent !== undefined) refuser(`${lieu} : le champ « ${absent} » manque.`);
}

// Un texte : une chaîne bornée, sans caractère de contrôle (hors les
// retours à la ligne des textes longs).
function texte(valeur, lieu, max, { lignes = false, vide = true } = {}) {
  if (typeof valeur !== "string") refuser(`${lieu} n'est pas un texte.`);
  if ([...valeur].length > max) refuser(`${lieu} dépasse ${max} signes.`);
  if (!vide && valeur.trim() === "") refuser(`${lieu} est vide.`);
  const interdits = lignes ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if (interdits.test(valeur)) refuser(`${lieu} contient un caractère de contrôle.`);
}

function date(valeur, lieu, { nulle = false } = {}) {
  if (nulle && valeur === null) return;
  texte(valeur, lieu, 40);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(valeur) || Number.isNaN(Date.parse(valeur))) refuser(`${lieu} n'est pas une date.`);
}

function entier(valeur, lieu, min, max, { nul = false } = {}) {
  if (nul && valeur === null) return;
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) refuser(`${lieu} doit être un entier de ${min} à ${max}${nul ? ", ou rien" : ""}.`);
}

function liste(valeur, lieu, max) {
  if (!Array.isArray(valeur)) refuser(`${lieu} n'est pas une liste.`);
  if (valeur.length > max) refuser(`${lieu} a plus de ${max} éléments.`);
  // IndexedDB garde les trous d'un tableau et ses clés en plus, que JSON
  // n'écrit jamais : une liste lue de l'appareil n'en a pas.
  const cles = Object.keys(valeur);
  if (cles.length !== valeur.length || cles.some((k, i) => k !== String(i))) refuser(`${lieu} est une liste abîmée.`);
}

function choixDe(valeur, lieu, { constellation = false } = {}) {
  if (valeur === null) return;
  champs(valeur, lieu, constellation ? ["nom", "choix", "obtention"] : ["nom", "choix"]);
  texte(valeur.nom, `${lieu}, nom`, BORNES.nom, { vide: false });
  liste(valeur.choix, `${lieu}, choix`, BORNES.choix);
  valeur.choix.forEach((nom, i) => texte(nom, `${lieu}, choix ${i + 1}`, BORNES.nom, { vide: false }));
  if (constellation && valeur.obtention !== "tirage" && valeur.obtention !== "saisie") refuser(`${lieu} : obtenue par « tirage » ou « saisie ».`);
}

/**
 * Vérifie un personnage lu d'un fichier, d'un lien ou de l'appareil.
 * Rend le personnage, ou lève ErreurPersonnage avec la raison.
 */
export function verifier(personnage) {
  champs(personnage, "Le personnage", [
    "format", "id", "mode", "etat", "etape", "cree_le", "modifie_le", "enregistre_le", "banque", "identite", "caracteristiques",
    "archetype", "espece", "constellation", "primordial", "equipement", "arme_principale", "bouclier", "niveaux", "empreintes",
  ]);
  if (personnage.format !== FORMAT) {
    if (Number.isInteger(personnage.format) && personnage.format > FORMAT) refuser("Ce personnage vient d'une version plus récente de l'Atelier : rechargez la page.");
    refuser("Ce fichier n'est pas un personnage de l'Atelier (format inconnu).");
  }
  if (typeof personnage.id !== "string" || !/^[A-Za-z0-9_-]{16,40}$/.test(personnage.id)) refuser("L'identifiant du personnage est illisible.");
  if (personnage.mode !== "reel" && personnage.mode !== "demo") refuser("Le mode du personnage est inconnu.");
  if (personnage.etat !== "brouillon" && personnage.etat !== "enregistre") refuser("L'état du personnage est inconnu.");
  entier(personnage.etape, "L'étape", 1, ETAPES);
  date(personnage.cree_le, "La date de création");
  date(personnage.modifie_le, "La date de modification");
  date(personnage.enregistre_le, "La date d'enregistrement", { nulle: true });
  if (personnage.etat === "enregistre" && personnage.enregistre_le === null) refuser("Un personnage enregistré a une date d'enregistrement.");
  if (personnage.banque !== null) {
    champs(personnage.banque, "La banque", ["empreinte", "publiee_le"]);
    texte(personnage.banque.empreinte, "L'empreinte de la banque", 80);
    date(personnage.banque.publiee_le, "La date de la banque", { nulle: true });
  }
  champs(personnage.identite, "L'identité", ["nom", "age", "description", "histoire"]);
  texte(personnage.identite.nom, "Le nom", BORNES.identite);
  texte(personnage.identite.age, "L'âge", BORNES.age);
  texte(personnage.identite.description, "La description", BORNES.description, { lignes: true });
  texte(personnage.identite.histoire, "L'histoire", BORNES.histoire, { lignes: true });
  champs(personnage.caracteristiques, "Les caractéristiques", CARACTERISTIQUES.map((c) => c.code));
  for (const c of CARACTERISTIQUES) entier(personnage.caracteristiques[c.code], c.nom, CARACTERISTIQUE_MIN, CARACTERISTIQUE_MAX, { nul: true });
  choixDe(personnage.archetype, "L'archétype");
  choixDe(personnage.espece, "L'espèce");
  choixDe(personnage.constellation, "La constellation", { constellation: true });
  choixDe(personnage.primordial, "Le primordial");
  liste(personnage.equipement, "L'équipement", BORNES.objets);
  personnage.equipement.forEach((objet, i) => {
    const lieu = `L'objet ${i + 1}`;
    champs(objet, lieu, ["nom", "choix", "qualite", "porte"]);
    texte(objet.nom, `${lieu}, nom`, BORNES.nom, { vide: false });
    liste(objet.choix, `${lieu}, choix`, BORNES.choix);
    objet.choix.forEach((nom, j) => texte(nom, `${lieu}, choix ${j + 1}`, BORNES.nom, { vide: false }));
    if (objet.qualite !== null && (typeof objet.qualite !== "string" || !/^\d{1,3}(?:,\d{1,2})?$/.test(objet.qualite))) refuser(`${lieu} : la qualité est un nombre (« 2 », « 1,5 ») ou rien.`);
    if (typeof objet.porte !== "boolean") refuser(`${lieu} : « porte » est vrai ou faux.`);
  });
  if (personnage.equipement.length === 0) {
    if (personnage.arme_principale !== null || personnage.bouclier !== null) refuser("L'arme principale ou le bouclier désigne un objet absent.");
  } else {
    entier(personnage.arme_principale, "L'arme principale", 0, personnage.equipement.length - 1, { nul: true });
    entier(personnage.bouclier, "Le bouclier", 0, personnage.equipement.length - 1, { nul: true });
  }
  liste(personnage.niveaux, "Les montées", BORNES.niveaux);
  personnage.niveaux.forEach((montee, i) => {
    champs(montee, `La montée ${i + 1}`, ["capacite", "niveau"]);
    texte(montee.capacite, `La montée ${i + 1}, capacité`, BORNES.nom, { vide: false });
    entier(montee.niveau, `La montée ${i + 1}, niveau`, 2, NIVEAU_MAX);
  });
  liste(personnage.empreintes, "Les empreintes", BORNES.empreintes);
  personnage.empreintes.forEach((e, i) => {
    champs(e, `L'empreinte ${i + 1}`, ["genre", "nom", "empreinte"]);
    if (e.genre !== "bloc" && e.genre !== "capacite") refuser(`L'empreinte ${i + 1} : genre inconnu.`);
    texte(e.nom, `L'empreinte ${i + 1}, nom`, BORNES.nom, { vide: false });
    if (typeof e.empreinte !== "string" || !/^[0-9a-f]{14}$/.test(e.empreinte)) refuser(`L'empreinte ${i + 1} est illisible.`);
  });
  // Un personnage enregistré est complet : son nom, ses caractéristiques
  // (somme de 36, livret « Caractéristiques »), et les quatre blocs de la
  // création (livret « Création »). Le reste se vérifie contre la banque,
  // et la fiche le signale.
  if (personnage.etat === "enregistre") {
    const somme = CARACTERISTIQUES.reduce((total, c) => total + (personnage.caracteristiques[c.code] ?? NaN), 0);
    if (personnage.identite.nom.trim() === "") refuser("Un personnage enregistré a un nom.");
    if (somme !== SOMME_CARACTERISTIQUES) refuser(`Un personnage enregistré a ses neuf caractéristiques, pour une somme de ${SOMME_CARACTERISTIQUES}.`);
    for (const [role, nom] of [["archetype", "un archétype"], ["espece", "une espèce"], ["constellation", "une constellation"], ["primordial", "un primordial"]]) {
      if (personnage[role] === null) refuser(`Un personnage enregistré a ${nom}.`);
    }
  }
  return personnage;
}

// ─── Le fichier ─────────────────────────────────────────────────────────────

const octetsDe = (texteSource) => new TextEncoder().encode(texteSource);

/**
 * Lit le texte d'un fichier ou d'un lien. mode : celui de la page ; un
 * personnage de l'autre mode est refusé. Rend { personnage } ou { erreur }.
 */
export function lirePersonnage(texteSource, { mode }) {
  try {
    if (typeof texteSource !== "string") refuser("Ce fichier est illisible.");
    if (octetsDe(texteSource).length > TAILLE_MAX) refuser(`Ce fichier dépasse ${TAILLE_MAX / 1024} Ko : ce n'est pas un personnage de l'Atelier.`);
    let donnees;
    try {
      donnees = JSON.parse(texteSource);
    } catch {
      refuser("Ce fichier n'est pas un personnage de l'Atelier (JSON illisible).");
    }
    const personnage = verifier(donnees);
    if (personnage.mode !== mode) {
      refuser(
        personnage.mode === "reel"
          ? "Ce personnage a été créé avec la banque réelle : ouvrez-le hors de la démonstration."
          : "Ce personnage a été créé dans la démonstration : ouvrez-le dans la démonstration (adresse terminée par ?demo=1).",
      );
    }
    return { personnage };
  } catch (erreur) {
    if (erreur instanceof ErreurPersonnage) return { erreur: erreur.message };
    return { erreur: `Ce personnage est illisible : ${erreur?.message ?? String(erreur)}` };
  }
}

/** Le texte du fichier d'un personnage, vérifié. */
export function ecrirePersonnage(personnage) {
  return `${JSON.stringify(verifier(personnage), null, 2)}\n`;
}

/** Un nom de fichier sûr : le nom du personnage, sans signe réservé. */
export function nomDeFichier(personnage) {
  const base = personnage.identite.nom
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 60);
  return `${base || "personnage"}${EXTENSION}`;
}

// ─── Le lien ────────────────────────────────────────────────────────────────

/** Octets → base64url, sans remplissage. */
export function versBase64Url(octets) {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → octets, ou null. */
export function depuisBase64Url(texteSource) {
  if (typeof texteSource !== "string" || !/^[A-Za-z0-9_-]*$/.test(texteSource) || texteSource.length % 4 === 1) return null;
  try {
    const binaire = atob(texteSource.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texteSource.length % 4)) % 4));
    return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function transformer(octets, flux) {
  const lecteur = new Blob([octets]).stream().pipeThrough(flux).getReader();
  const morceaux = [];
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
  }
  return new Uint8Array(await new Blob(morceaux).arrayBuffer());
}

/** Le code d'un personnage pour son lien : son fichier compressé, en base64url. */
export async function codeDuLien(personnage) {
  return versBase64Url(await transformer(octetsDe(JSON.stringify(verifier(personnage))), new CompressionStream("deflate-raw")));
}

// Décompresse en s'arrêtant dès que la borne est passée. L'entrée passe
// par tranches d'un kilo-octet, une à la demande : sinon Chromium
// décompresse tout le code avant la première lecture, soit une soixantaine
// de mégaoctets pour un lien forgé (relecture du lot 2).
async function decompresserBorne(octets, borne) {
  let position = 0;
  const entree = new ReadableStream(
    {
      pull(controleur) {
        if (position >= octets.length) {
          controleur.close();
          return;
        }
        controleur.enqueue(octets.slice(position, position + 1024));
        position += 1024;
      },
    },
    { highWaterMark: 0 },
  );
  const lecteur = entree.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > borne) {
      await lecteur.cancel().catch(() => {});
      return null;
    }
    morceaux.push(value);
  }
  return new Uint8Array(await new Blob(morceaux).arrayBuffer());
}

/** Lit le code d'un lien. Rend { personnage } ou { erreur }. */
export async function lireCode(code, { mode }) {
  const octets = depuisBase64Url(code);
  // Compressé, un personnage de 64 Ko ne peut pas dépasser 64 Ko.
  if (!octets || octets.length === 0 || octets.length > TAILLE_MAX) return { erreur: "Ce lien est abîmé : il ne contient pas de personnage lisible." };
  let texteSource;
  try {
    const clair = await decompresserBorne(octets, TAILLE_MAX);
    if (!clair) return { erreur: `Ce lien dépasse ${TAILLE_MAX / 1024} Ko une fois décompressé : il est refusé.` };
    texteSource = new TextDecoder("utf-8", { fatal: true }).decode(clair);
  } catch {
    return { erreur: "Ce lien est abîmé : il ne contient pas de personnage lisible." };
  }
  return lirePersonnage(texteSource, { mode });
}

/** L'adresse complète du lien : la page, son mode, et le code dans le fragment. */
export function adresseDuLien(code, { origine, chemin, mode }) {
  return `${origine}${chemin}${mode === "demo" ? "?demo=1" : ""}#/recevoir/${code}`;
}
