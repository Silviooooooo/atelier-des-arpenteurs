// Chiffrement de la banque (SPECIFICATION.md, § 7).
//
// PBKDF2-SHA256, à 600 000 itérations, dérive du mot de passe de table une
// clé AES-GCM de 256 bits, non extractible. Le sel se tire avec le mot de
// passe et se garde jusqu'au suivant : la clé qu'un appareil a gardée
// déchiffre ainsi toutes les publications faites avec ce mot de passe
// (§ 7.1). L'IV, lui, est neuf à chaque chiffrement. Tout passe par
// WebCrypto, le même dans la page et dans Node.
//
// Un mot de passe faux ou un fichier abîmé ne lèvent jamais d'exception :
// les fonctions rendent { erreur, code }, avec un message à afficher.
//
// Le format 2 (groupe 4) : l'empreinte de l'en-tête est celle des octets
// chiffrés, étiquette comprise ; elle ne dit plus rien du contenu, même à
// qui en a lu une version. La page écrit le format 2 et lit encore le
// format 1, où l'empreinte était celle de la banque en clair, jusqu'au
// groupe qui suivra une publication réelle au format 2 (§ 7.1).

export const ITERATIONS = 600_000;
export const FORMAT = 2;
const FORMATS_LUS = [1, 2];
// À la lecture, un en-tête peut annoncer plus (une hausse future), jamais
// moins, ni un nombre qui ferait patienter des heures (§ 7.1).
export const ITERATIONS_MAX = 10 * ITERATIONS;
export const LONGUEUR_MINIMALE = 20;
const OCTETS_SEL = 16;
const OCTETS_IV = 12;

// btoa et atob travaillent sur des chaînes d'octets ; on les découpe pour ne
// pas dépasser le nombre d'arguments d'un appel.
export function versBase64(octets) {
  let binaire = "";
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000));
  }
  return btoa(binaire);
}

export function depuisBase64(texte) {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/** Empreinte SHA-256 d'un texte ou d'octets, sous la forme « sha256:… ». */
export async function empreinte(donnees) {
  const octets = typeof donnees === "string" ? new TextEncoder().encode(donnees) : donnees;
  const condense = new Uint8Array(await crypto.subtle.digest("SHA-256", octets));
  return `sha256:${Array.from(condense, (octet) => octet.toString(16).padStart(2, "0")).join("")}`;
}

// Le même mot de passe doit donner la même clé sur tous les appareils : un
// « é » peut s'y écrire en un ou deux caractères, et un clavier de téléphone
// ajoute volontiers une espace en fin de mot.
function normaliser(motDePasse) {
  return motDePasse.normalize("NFC").trim();
}

/** Rend null si le mot de passe de table est acceptable, sinon un message (§ 7.3). */
export function defautDuMotDePasse(motDePasse) {
  const longueur = [...normaliser(motDePasse)].length;
  if (longueur < LONGUEUR_MINIMALE) {
    return `Le mot de passe compte ${longueur} signe(s) : il en faut ${LONGUEUR_MINIMALE} au moins. Une phrase de quatre ou cinq mots tirés au hasard résiste ; un mot seul se trouve en quelques secondes.`;
  }
  return null;
}

/** Tire un sel neuf : seulement avec un nouveau mot de passe de table. */
export function tirerSel() {
  return versBase64(crypto.getRandomValues(new Uint8Array(OCTETS_SEL)));
}

/**
 * Dérive la clé de table. Rend le secret { cle, sel, iterations, duree } :
 * la clé non extractible, le sel qui l'a produite, et la durée de la
 * dérivation en millisecondes, que le diagnostic affiche.
 */
export async function deriverCle(motDePasse, sel, iterations = ITERATIONS) {
  const debut = performance.now();
  const materiau = await crypto.subtle.importKey("raw", new TextEncoder().encode(normaliser(motDePasse)), "PBKDF2", false, ["deriveKey"]);
  const cle = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: depuisBase64(sel), iterations },
    materiau,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { cle, sel, iterations, duree: Math.round(performance.now() - debut) };
}

/** Le secret d'un nouveau mot de passe de table, avec un sel neuf. */
export function nouveauSecret(motDePasse) {
  return deriverCle(motDePasse, tirerSel());
}

/**
 * Chiffre la banque en clair avec le secret gardé, sous un IV neuf. Rend le
 * fichier du § 7.1. La banque porte déjà sa date de publication.
 */
export async function chiffrer(banque, { cle, sel, iterations }) {
  if (typeof banque.publiee_le !== "string") throw new TypeError("La banque à chiffrer n'a pas de date de publication.");
  if (!(iterations >= ITERATIONS && iterations <= ITERATIONS_MAX)) throw new RangeError(`Une clé de ${iterations} itérations ne chiffre pas : il en faut ${ITERATIONS} au moins.`);
  const clair = new TextEncoder().encode(JSON.stringify(banque));
  const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
  const donnees = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, clair));
  return {
    format: FORMAT,
    publiee_le: banque.publiee_le,
    empreinte: await empreinte(donnees),
    kdf: { nom: "PBKDF2-SHA256", iterations, sel },
    chiffre: { nom: "AES-GCM", iv: versBase64(iv), donnees: versBase64(donnees) },
  };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
// L'étiquette d'AES-GCM compte 16 octets : des données chiffrées ne sont
// jamais plus courtes.
const OCTETS_ETIQUETTE = 16;

// Le nombre d'octets d'un texte base64 complet, ou null s'il ne se décode pas.
function octetsBase64(texte) {
  if (typeof texte !== "string" || !BASE64.test(texte) || texte.length % 4 !== 0) return null;
  try {
    return depuisBase64(texte).length;
  } catch {
    return null;
  }
}

/**
 * Lit l'en-tête en clair d'un fichier chiffré : { sel, iterations } ou { erreur }.
 * Hors des bornes du § 7.1 (itérations, sel de 16 octets, IV de 12, données
 * plus longues que l'étiquette), le fichier est abîmé : un message, jamais
 * une exception plus loin.
 */
export function lireEnTete(enveloppe) {
  const { format, kdf, chiffre } = enveloppe ?? {};
  const abime = { erreur: "Le fichier de la banque est abîmé ou d'un format inconnu.", code: "format" };
  // Un format plus récent que celui de la page : l'onglet est en retard sur
  // le site, recharger suffit (revue du groupe 4).
  if (Number.isInteger(format) && format > FORMAT) {
    return { erreur: "Cette banque vient d'une version plus récente de l'Atelier : rechargez la page.", code: "format_recent" };
  }
  if (!FORMATS_LUS.includes(format) || kdf?.nom !== "PBKDF2-SHA256" || chiffre?.nom !== "AES-GCM") return abime;
  if (!Number.isInteger(kdf.iterations) || kdf.iterations < ITERATIONS || kdf.iterations > ITERATIONS_MAX) return abime;
  if (octetsBase64(kdf.sel) !== OCTETS_SEL || octetsBase64(chiffre.iv) !== OCTETS_IV) return abime;
  const donnees = chiffre.donnees;
  if (typeof donnees !== "string" || !BASE64.test(donnees) || donnees.length % 4 !== 0 || donnees.length < (OCTETS_ETIQUETTE / 3) * 4) return abime;
  return { sel: kdf.sel, iterations: kdf.iterations };
}

/**
 * Format 2 : l'empreinte des octets chiffrés, vérifiable sans clé, dès le
 * téléchargement. Rend null si elle est juste (ou au format 1), sinon
 * { erreur, code }. L'en-tête doit avoir passé lireEnTete.
 */
export async function verifierEmpreinte(enveloppe) {
  if (enveloppe.format !== 2) return null;
  if ((await empreinte(depuisBase64(enveloppe.chiffre.donnees))) === enveloppe.empreinte) return null;
  return { erreur: "Le fichier de la banque est abîmé : il ne correspond pas à son empreinte.", code: "empreinte" };
}

/** Déchiffre avec une clé : { banque } ou { erreur, code }. */
export async function dechiffrer(enveloppe, cle) {
  const enTete = lireEnTete(enveloppe);
  if (enTete.erreur) return enTete;
  // Format 2 : l'empreinte se vérifie sur le fichier, avant de déchiffrer.
  const faussee = await verifierEmpreinte(enveloppe);
  if (faussee) return faussee;
  const donnees = depuisBase64(enveloppe.chiffre.donnees);
  let clair;
  try {
    clair = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(enveloppe.chiffre.iv) }, cle, donnees));
  } catch {
    return { erreur: "Ce mot de passe n'ouvre pas la banque.", code: "mot_de_passe" };
  }
  // Format 1 : l'empreinte était celle de la banque en clair.
  if (enveloppe.format === 1 && (await empreinte(clair)) !== enveloppe.empreinte) {
    return { erreur: "La banque déchiffrée ne correspond pas à son empreinte.", code: "empreinte" };
  }
  try {
    return { banque: JSON.parse(new TextDecoder().decode(clair)) };
  } catch {
    return { erreur: "La banque déchiffrée est illisible.", code: "format" };
  }
}

/**
 * Déchiffre avec le secret gardé sur l'appareil. Un sel ou un nombre
 * d'itérations différents de ceux de la banque publiée signifient que le mot
 * de passe de table a changé : la page doit le redemander (§ 7.2).
 */
export async function ouvrir(enveloppe, { cle, sel, iterations }) {
  const enTete = lireEnTete(enveloppe);
  if (enTete.erreur) return enTete;
  if (enTete.sel !== sel || enTete.iterations !== iterations) {
    return { erreur: "Le mot de passe de table a changé : saisissez le nouveau.", code: "sel_change" };
  }
  return dechiffrer(enveloppe, cle);
}

/** Dérive la clé du mot de passe saisi avec le sel de la banque publiée, puis l'ouvre. */
export async function ouvrirAvecMotDePasse(enveloppe, motDePasse) {
  const enTete = lireEnTete(enveloppe);
  if (enTete.erreur) return enTete;
  let secret;
  try {
    secret = await deriverCle(motDePasse, enTete.sel, enTete.iterations);
  } catch (erreur) {
    // Les bornes de l'en-tête sont vérifiées : reste un navigateur qui refuse.
    return { erreur: `La clé n'a pas pu être calculée sur cet appareil (${erreur.message}).`, code: "derivation" };
  }
  const resultat = await dechiffrer(enveloppe, secret.cle);
  return resultat.erreur ? { ...resultat, duree: secret.duree } : { ...resultat, secret };
}
