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

export const ITERATIONS = 600_000;
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
  const clair = new TextEncoder().encode(JSON.stringify(banque));
  const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
  const donnees = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, clair));
  return {
    format: 1,
    publiee_le: banque.publiee_le,
    empreinte: await empreinte(clair),
    kdf: { nom: "PBKDF2-SHA256", iterations, sel },
    chiffre: { nom: "AES-GCM", iv: versBase64(iv), donnees: versBase64(donnees) },
  };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Lit l'en-tête en clair d'un fichier chiffré : { sel, iterations } ou { erreur }. */
export function lireEnTete(enveloppe) {
  const { format, kdf, chiffre } = enveloppe ?? {};
  const abime = { erreur: "Le fichier de la banque est abîmé ou d'un format inconnu.", code: "format" };
  if (format !== 1 || kdf?.nom !== "PBKDF2-SHA256" || chiffre?.nom !== "AES-GCM") return abime;
  if (!Number.isInteger(kdf.iterations) || kdf.iterations < 1) return abime;
  if (![kdf.sel, chiffre.iv, chiffre.donnees].every((valeur) => typeof valeur === "string" && BASE64.test(valeur))) return abime;
  return { sel: kdf.sel, iterations: kdf.iterations };
}

/** Déchiffre avec une clé : { banque } ou { erreur, code }. */
export async function dechiffrer(enveloppe, cle) {
  const enTete = lireEnTete(enveloppe);
  if (enTete.erreur) return enTete;
  let clair;
  try {
    clair = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(enveloppe.chiffre.iv) }, cle, depuisBase64(enveloppe.chiffre.donnees)),
    );
  } catch {
    return { erreur: "Ce mot de passe n'ouvre pas la banque.", code: "mot_de_passe" };
  }
  if ((await empreinte(clair)) !== enveloppe.empreinte) {
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
  const secret = await deriverCle(motDePasse, enTete.sel, enTete.iterations);
  const resultat = await dechiffrer(enveloppe, secret.cle);
  return resultat.erreur ? { ...resultat, duree: secret.duree } : { ...resultat, secret };
}
