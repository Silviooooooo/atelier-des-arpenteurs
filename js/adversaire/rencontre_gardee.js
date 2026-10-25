// La rencontre gardée sur l'appareil (SPECIFICATION.md, § 16.6 ; § 7.2 pour
// la clé de table ; § 17.8 pour le modèle, l'enregistrement d'un combat).
//
// La composition en cours de l'écran Rencontre, [{ nom, nombre }], survit à
// un rechargement : chiffrée par la clé de table, une par mode, dans une base
// qui lui est propre, jamais celle du combat. Ce n'est pas une bibliothèque de
// rencontres : seule la composition en cours se garde, et la dernière
// écriture l'emporte (ni révision, ni compression). Ce module tient :
//
//   - la relecture : lireEntrees, la même à l'écriture et à la lecture ;
//   - le chiffrement : chiffrerRencontre et dechiffrerRencontre, sur le modèle
//     de js/combat/enregistrement.js ;
//   - les magasins : la base, et son jumeau en mémoire quand elle manque ;
//   - la garde : la file à une place des écritures.
//
// Il ne sait rien de la banque ni de l'écran, et ne tient aucune composition
// en mémoire. Rien ne s'ouvre à l'import. Ce que la base rend est une donnée
// venue d'ailleurs, que n'importe quel script du site a pu y poser sans la
// clé : chaque champ est borné avant d'être examiné, tout écart rend une
// composition vide sans rien lever, et ce qui ne se relirait pas ne s'écrit
// pas. Les petits outils de lecture bornée sont recopiés de l'enregistrement
// du combat : js/adversaire/ n'importe rien de js/combat/.

import { ITERATIONS_MAX, depuisBase64, versBase64 } from "../securite/chiffrement.js";
import { MODES } from "../securite/coffre.js";

// Les plafonds de la rencontre (§ 16.6), que l'écran Rencontre réexporte :
// trois cartes tiennent sur une page A4 ; douze exemplaires d'un adversaire
// en font quatre pages, soixante cartes une vingtaine.
export const PLAFOND_EXEMPLAIRES = 12;
export const PLAFOND_CARTES = 60;
// Le plus long nom relu, en signes (points de code) : un nom plus long ne se
// garde pas.
export const NOM_MAX = 200;
export const FORMAT_RENCONTRE = 1;
export const NOM_BASE_RENCONTRE = "atelier-des-arpenteurs-rencontre";

const VERSION_BASE = 1;
const ENTREPOT = "rencontres";
// La borne du clair, à l'écriture comme à la lecture. Soixante noms de deux
// cents signes, chacun écrit en six octets au pire par le JSON (un signe de
// commande, un demi-caractère astral), n'en font que 72 Ko.
const OCTETS_CLAIR_MAX = 128 * 1024;
const OCTETS_SEL = 16;
const OCTETS_IV = 12;
const OCTETS_ETIQUETTE = 16;
// Sans compression, le chiffré pèse le clair et son étiquette.
const OCTETS_CHIFFRE_MAX = OCTETS_CLAIR_MAX + OCTETS_ETIQUETTE;
const signesDe = (nombreDOctets) => 4 * Math.ceil(nombreDOctets / 3);
// La longueur d'un champ en base64 se juge avant son contenu.
const SIGNES_MAX = { sel: signesDe(OCTETS_SEL), iv: signesDe(OCTETS_IV), chiffre: signesDe(OCTETS_CHIFFRE_MAX) };
// Une classe et sa répétition, sans groupe (voir l'enregistrement du combat) ;
// les quatre signes par paquet se vérifient par la longueur.
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
// Dans l'ordre de l'enveloppe écrite.
const CHAMPS = ["mode", "format", "sel", "iterations", "iv", "chiffre", "enregistre_le"];

const estObjet = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);

// ─── La relecture ───────────────────────────────────────────────────────────

/**
 * La relecture hostile d'une composition, la même à l'écriture et à la
 * lecture : une copie neuve [{ nom, nombre }], ou null au premier écart.
 * Soixante entrées au plus, chacune avec exactement les clés « nom » et
 * « nombre » ; un nom de 1 à 200 signes, jamais répété ; un nombre entier de
 * 1 à 12 ; soixante cartes au plus en tout. Aucun nom ne devient une clé
 * d'objet. Ne lève pas.
 */
export function lireEntrees(valeur) {
  try {
    // La longueur d'abord : un tableau démesuré n'est pas parcouru.
    if (!Array.isArray(valeur) || valeur.length > PLAFOND_CARTES) return null;
    const vus = new Set();
    const entrees = [];
    let somme = 0;
    for (let rang = 0; rang < valeur.length; rang += 1) {
      const entree = valeur[rang];
      if (!estObjet(entree)) return null;
      // Object.keys voit une clé « __proto__ » posée par JSON.parse.
      const cles = Object.keys(entree);
      if (cles.length !== 2 || !cles.includes("nom") || !cles.includes("nombre")) return null;
      const { nom, nombre } = entree;
      // Deux unités UTF-16 au plus par signe : au-delà, inutile de compter.
      if (typeof nom !== "string" || nom.length > 2 * NOM_MAX) return null;
      const signes = [...nom].length;
      if (signes < 1 || signes > NOM_MAX) return null;
      if (!Number.isInteger(nombre) || nombre < 1 || nombre > PLAFOND_EXEMPLAIRES) return null;
      if (vus.has(nom)) return null;
      vus.add(nom);
      somme += nombre;
      if (somme > PLAFOND_CARTES) return null;
      entrees.push({ nom, nombre });
    }
    return entrees;
  } catch {
    return null;
  }
}

// ─── Le chiffrement ─────────────────────────────────────────────────────────

// La donnée associée lie le chiffré à son mode : une enveloppe recopiée sous
// l'autre mode ne se déchiffre pas. Elle ne couvre pas la date, en clair.
const associees = (mode) => new TextEncoder().encode(`atelier-des-arpenteurs/rencontre/${FORMAT_RENCONTRE}/${mode}`);

// Les octets d'un base64 strict de « signesMax » signes au plus, ou null. La
// longueur passe d'abord : un texte démesuré n'est ni parcouru, ni décodé.
function octets(valeur, signesMax) {
  if (typeof valeur !== "string" || valeur.length === 0 || valeur.length > signesMax || valeur.length % 4 !== 0 || !BASE64.test(valeur)) return null;
  try {
    return depuisBase64(valeur);
  } catch {
    return null;
  }
}

// La forme de l'enveloppe, avant toute clé : ses sept clés, elles seules, et
// leurs bornes. Rend ce qu'il faut pour la déchiffrer, lu une seule fois, ou
// null. Peut lever sur un objet hostile : qui l'appelle le rattrape.
function examiner(enveloppe, mode) {
  if (!estObjet(enveloppe)) return null;
  const cles = Object.keys(enveloppe);
  if (cles.length !== CHAMPS.length || !cles.every((cle) => CHAMPS.includes(cle))) return null;
  const { mode: modeLu, format, sel, iterations, iv, chiffre, enregistre_le: date } = enveloppe;
  if (format !== FORMAT_RENCONTRE) return null;
  if (!MODES.includes(mode) || modeLu !== mode) return null;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS_MAX) return null;
  if (octets(sel, SIGNES_MAX.sel)?.length !== OCTETS_SEL) return null;
  const octetsIv = octets(iv, SIGNES_MAX.iv);
  if (octetsIv?.length !== OCTETS_IV) return null;
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) return null;
  const octetsChiffre = octets(chiffre, SIGNES_MAX.chiffre);
  if (octetsChiffre === null || octetsChiffre.length <= OCTETS_ETIQUETTE) return null;
  return { mode, sel, iterations, iv: octetsIv, chiffre: octetsChiffre };
}

// Ce message ne s'affiche nulle part : la garde ne dit rien.
const invalide = () => ({ erreur: "La composition ne peut pas être gardée : la demande est mal faite.", code: "invalide" });

/**
 * Chiffre une composition : l'enveloppe { mode, format: 1, sel, iterations,
 * iv, chiffre, enregistre_le }, ou { erreur, code: "invalide" } pour un mode
 * inconnu, un secret sans clé, des entrées que lireEntrees refuse, un clair
 * trop gros, ou tout ce qui ne se relirait pas. Ne lève pas.
 */
export async function chiffrerRencontre(entrees, secret, options = {}) {
  try {
    const { mode, maintenant = new Date() } = options ?? {};
    const { cle, sel, iterations } = secret ?? {};
    const copie = lireEntrees(entrees);
    if (!MODES.includes(mode) || !cle || copie === null) return invalide();
    const clair = new TextEncoder().encode(JSON.stringify(copie));
    if (clair.length > OCTETS_CLAIR_MAX) return invalide();
    const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
    const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associees(mode) }, cle, clair));
    const enveloppe = { mode, format: FORMAT_RENCONTRE, sel, iterations, iv: versBase64(iv), chiffre: versBase64(chiffre), enregistre_le: maintenant.toISOString() };
    // Ce qui ne se relirait pas ne s'écrit pas : un sel, des itérations ou
    // une date que la lecture refuserait.
    return examiner(enveloppe, mode) === null ? invalide() : enveloppe;
  } catch {
    return invalide();
  }
}

const vide = (ecart) => ({ entrees: [], ecart });

/**
 * Déchiffre une enveloppe : { entrees, ecart }. `ecart` vaut null, ou, avec
 * une composition vide : « absente » (rien de gardé), « forme » (clés,
 * format, mode, itérations, longueurs, date), « cle » (le sel ou les
 * itérations d'un autre secret, ou pas de secret), « dechiffrement »,
 * « contenu » (ni UTF-8, ni JSON, ou refusé par lireEntrees). Ne lève jamais,
 * si long ou si mal fait que soit ce qu'elle reçoit.
 */
export async function dechiffrerRencontre(enveloppe, secret, options = {}) {
  if (enveloppe === null || enveloppe === undefined) return vide("absente");
  let forme;
  try {
    forme = examiner(enveloppe, options?.mode);
  } catch {
    forme = null;
  }
  if (forme === null) return vide("forme");
  let cle;
  try {
    const lu = secret ?? {};
    cle = lu.cle;
    // Sans déchiffrer : deux lectures de la même clé donnent deux objets, et
    // une clé ne se reconnaît donc qu'à son sel et à ses itérations.
    if (!cle || lu.sel !== forme.sel || lu.iterations !== forme.iterations) return vide("cle");
  } catch {
    return vide("cle");
  }
  let clair;
  try {
    clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: forme.iv, additionalData: associees(forme.mode) }, cle, forme.chiffre);
  } catch {
    return vide("dechiffrement");
  }
  try {
    const entrees = lireEntrees(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clair)));
    return entrees === null ? vide("contenu") : { entrees, ecart: null };
  } catch {
    return vide("contenu");
  }
}

// ─── Les magasins ───────────────────────────────────────────────────────────

function verifierMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Mode inconnu : ${mode}`);
}

/** Un magasin en mémoire : pour les contrôles, et quand la base manque. */
export function magasinRencontreMemoire() {
  const rencontres = new Map();
  return {
    durable: false,
    async lire(mode) {
      verifierMode(mode);
      return rencontres.has(mode) ? structuredClone(rencontres.get(mode)) : null;
    },
    async ecrire(enveloppe) {
      verifierMode(enveloppe?.mode);
      rencontres.set(enveloppe.mode, structuredClone(enveloppe));
    },
    async effacer(mode) {
      verifierMode(mode);
      rencontres.delete(mode);
    },
  };
}

function attendre(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/**
 * Le magasin de la base : une base à elle, un entrepôt, une composition par
 * mode. L'écriture remplace sans condition : la dernière l'emporte.
 */
export async function magasinRencontreIndexedDB(nom = NOM_BASE_RENCONTRE) {
  const ouverture = indexedDB.open(nom, VERSION_BASE);
  ouverture.onupgradeneeded = () => {
    const base = ouverture.result;
    if (!base.objectStoreNames.contains(ENTREPOT)) base.createObjectStore(ENTREPOT, { keyPath: "mode" });
  };
  // À la version 1, rien ne peut bloquer la création ; la garde est posée
  // pour le jour d'une version 2, comme pour la base du combat.
  const bloquee = new Promise((_, rejeter) => {
    ouverture.onblocked = () => rejeter(new Error("La base de la rencontre est bloquée par un autre onglet."));
  });
  const base = await Promise.race([attendre(ouverture), bloquee]);
  base.onversionchange = () => base.close();
  // Tout se demande dans le tour où la transaction naît : une transaction ne
  // survit pas à une attente.
  const transaction = (acces, faire) =>
    new Promise((resoudre, rejeter) => {
      const t = base.transaction(ENTREPOT, acces);
      const issue = faire(t.objectStore(ENTREPOT));
      t.oncomplete = () => resoudre(issue());
      t.onerror = () => rejeter(t.error);
      t.onabort = () => rejeter(t.error);
    });
  return {
    durable: true,
    async lire(mode) {
      verifierMode(mode);
      return transaction("readonly", (entrepot) => {
        const lecture = entrepot.get(mode);
        return () => lecture.result ?? null;
      });
    },
    async ecrire(enveloppe) {
      verifierMode(enveloppe?.mode);
      return transaction("readwrite", (entrepot) => {
        entrepot.put(enveloppe);
        return () => undefined;
      });
    },
    async effacer(mode) {
      verifierMode(mode);
      return transaction("readwrite", (entrepot) => {
        entrepot.delete(mode);
        return () => undefined;
      });
    },
  };
}

/**
 * Ouvre le magasin de la rencontre ; en mémoire sans base, ou si la base ne
 * s'ouvre pas. Jamais à l'import du module : l'écran l'appelle.
 */
export async function ouvrirMagasinRencontre() {
  try {
    return await magasinRencontreIndexedDB();
  } catch {
    return magasinRencontreMemoire();
  }
}

// ─── La garde ───────────────────────────────────────────────────────────────

// Une attente d'un tour de la boucle d'événements : ce qui suit ne s'exécute
// ni dans l'appel en cours, ni dans ses microtâches (elles passent avant que
// l'écouteur d'un clic ait rendu la main à la page).
const auTourSuivant = () =>
  new Promise((suite) => {
    setTimeout(suite, 0);
  });

/**
 * La garde de la composition d'un mode : { charger, garder, effacer,
 * oublier, repos }.
 *
 * `secret` est une fonction : la garde ne tient aucune copie de la clé
 * (§ 7.2) et la relit à chaque écriture, car le mot de passe peut changer
 * pendant la visite. `garder(entrees)` et `effacer()` passent par une file
 * à une place : la demande suivante remplace celle qui attendait, le travail
 * part au tour suivant, et deux écritures ne se croisent jamais. Sans clé,
 * rien ne s'écrit ni ne s'efface, et rien ne se dit. `charger()` attend la
 * file, puis lit ; il ne rejette jamais. `oublier()` vide la place ;
 * `repos()` attend la file.
 */
export function creerGardeRencontre({ magasin, mode, secret, maintenant = () => new Date() }) {
  verifierMode(mode);
  if (typeof secret !== "function") throw new TypeError("La garde de la rencontre relit sa clé : le secret se donne par une fonction.");
  // La file, à une place : la dernière composition contient les précédentes,
  // et « Vider la rencontre » rend vaine l'écriture qu'il suit.
  const PLACES = 1;
  const file = [];
  let enCours = null; // le tour qui vide la file

  // La clé de ce moment, relue à chaque fois ; une lecture qui lève vaut
  // « pas de clé ».
  const cleDuMoment = () => {
    try {
      return secret();
    } catch {
      return null;
    }
  };

  async function travailler(demande) {
    const lu = cleDuMoment();
    // Sans clé, rien ne s'écrit ni ne s'efface : la clé reviendra peut-être,
    // et le geste suivant portera la composition entière.
    if (!lu?.cle) return;
    try {
      if (demande.genre === "effacer") {
        await magasin.effacer(mode);
        return;
      }
      const enveloppe = await chiffrerRencontre(demande.entrees, lu, { mode, maintenant: maintenant() });
      if (!enveloppe.erreur) await magasin.ecrire(enveloppe);
    } catch {
      // Une base qui lève : rien ne se dit, la composition reste dans la
      // mémoire de l'écran, et le geste suivant réessaie.
    }
  }

  async function vider() {
    while (file.length > 0) await travailler(file.shift());
  }

  function lancer() {
    if (enCours || file.length === 0) return;
    const tour = auTourSuivant()
      .then(vider)
      .catch(() => {})
      .finally(() => {
        enCours = null;
        // Une demande venue pendant la fin du tour n'attend pas le geste suivant.
        lancer();
      });
    enCours = tour;
  }

  function demander(demande) {
    file.push(demande);
    if (file.length > PLACES) file.splice(0, file.length - PLACES);
    lancer();
  }

  async function repos() {
    while (enCours) await enCours;
  }

  async function charger() {
    // Une écriture partie avant la lecture est lue avec ce qu'elle écrit.
    await repos();
    let enveloppe;
    try {
      enveloppe = await magasin.lire(mode);
    } catch {
      return { entrees: [], ecart: "base" };
    }
    return dechiffrerRencontre(enveloppe, cleDuMoment(), { mode });
  }

  return {
    charger,
    /** Garde la composition, copiée dans l'appel même. */
    garder(entrees) {
      demander({ genre: "garder", entrees: lireEntrees(entrees) });
    },
    /** « Vider la rencontre » : la composition gardée s'efface. */
    effacer() {
      demander({ genre: "effacer" });
    },
    /**
     * « Oublier le mot de passe » : la demande qui attendait ne part pas. La
     * base n'est pas touchée : la composition chiffrée y reste, illisible
     * sans la clé.
     */
    oublier() {
      file.length = 0;
    },
    repos,
  };
}
