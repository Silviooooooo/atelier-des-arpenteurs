// L'enregistrement d'un combat sur l'appareil (SPECIFICATION.md, § 17 ;
// § 7.2 pour la clé de table).
//
// Un combat porte des valeurs de la banque, qui ne s'écrit jamais en clair
// sur l'appareil : il se garde donc chiffré par la clé de table, dans une
// base IndexedDB qui lui est propre, un combat par mode (la démonstration ne
// touche jamais le combat réel). Ce module tient trois choses :
//
//   - le chiffrement : chiffrerCombat et dechiffrerCombat, sur le modèle des
//     personnages en ligne (deflate-raw, AES-GCM, vecteur neuf), sans leurs
//     gardes : un combat se chiffre aussi en démonstration ;
//   - le magasin : la base, et son jumeau en mémoire quand IndexedDB manque ;
//   - le gardien : la file des écritures et la révision, qui empêche deux
//     onglets de s'écraser.
//
// Il ne sait rien du combat lui-même : il garde un texte, que la séance
// assemble et relit. Aucune fonction ne lève pour une donnée abîmée : elle
// rend { erreur, code }. Ce que la base rend est une donnée venue d'ailleurs,
// que n'importe quel script du site a pu y poser sans la clé : chaque champ
// est borné avant d'être examiné, et ce qui ne se relirait pas ne s'écrit pas.

import { ITERATIONS_MAX, depuisBase64, versBase64 } from "../securite/chiffrement.js";
import { decompresserBorne, transformer } from "../personnage/format.js";
import { MODES } from "../securite/coffre.js";

export const FORMAT_COMBAT = 1;
// La borne du clair, à l'écriture comme à la lecture : un combat trop gros
// se dit en jouant, et non au rechargement. Douze personnages et soixante
// adversaires approchent 0,7 Mo (mesuré) ; la borne des personnages, 64 Ko,
// ne conviendrait pas.
export const TAILLE_MAX_COMBAT = 8 * 1024 * 1024;
// La révision monte d'un cran à chaque écriture : mille milliards de crans ne
// s'atteignent pas en jouant. Elle est en clair dans l'enregistrement, hors
// de ce que le chiffrement protège : posée plus haut à la main, elle vaut 0
// et l'enregistrement est une donnée abîmée, que « Nouveau combat » remplace.
// Sans cette borne, une révision démesurée ne laissait plus rien s'écrire.
export const REVISION_MAX = 2 ** 40;

const NOM_BASE = "atelier-des-arpenteurs-combat";
const VERSION_BASE = 1;
const ENTREPOT = "combats";
const OCTETS_SEL = 16;
const OCTETS_IV = 12;
const OCTETS_ETIQUETTE = 16;
// Ce qu'un chiffré pèse au plus : le clair compressé et son étiquette. Un
// clair qui se compresse mal ressort à peine plus gros qu'il n'est entré
// (quelques octets par bloc, pour deflate) : 64 Ko de marge le couvrent
// largement. C'est la borne de la lecture, et celle de l'écriture avec elle.
const OCTETS_CHIFFRE_MAX = TAILLE_MAX_COMBAT + 64 * 1024;
const signesDe = (nombreDOctets) => 4 * Math.ceil(nombreDOctets / 3);
// La longueur d'un champ en base64 se juge avant son contenu.
const SIGNES_MAX = { sel: signesDe(OCTETS_SEL), iv: signesDe(OCTETS_IV), chiffre: signesDe(OCTETS_CHIFFRE_MAX) };
// Une classe et sa répétition, sans groupe : un groupe répété fait déborder
// la pile du moteur d'expressions dès quelques mégaoctets, et la lecture
// levait au lieu de rendre « illisible ». Les quatre signes par paquet se
// vérifient par la longueur.
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
// Dans l'ordre de la mission : c'est celui de l'enregistrement écrit.
const CHAMPS = ["mode", "format", "sel", "iterations", "iv", "chiffre", "revision", "enregistre_le"];

export const PHRASES_DE_GARDE = Object.freeze({
  garde: "Combat gardé sur cet appareil",
  ecriture: "Enregistrement…",
  memoire: "Ce navigateur ne garde pas le combat",
  ailleurs: "Combat ouvert ailleurs",
  illisible: "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).",
  recent: "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.",
  autre_version: "Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas.",
  sans_cle: "Combat non gardé : le mot de passe de table a changé.",
});

const ERREUR_CLE = "Le combat gardé est chiffré avec une autre clé de table : le mot de passe de table a changé.";
const ERREUR_ABIME = "Le combat gardé ne se déchiffre pas : il est abîmé.";
const ERREUR_TROP_GROS = `Ce combat dépasse ${TAILLE_MAX_COMBAT / (1024 * 1024)} Mo : il n'est plus gardé.`;

// ─── Le chiffrement ─────────────────────────────────────────────────────────

// La donnée associée lie le chiffré à son mode : un enregistrement recopié
// sous l'autre mode ne se déchiffre pas. Elle ne couvre ni la révision ni la
// date, qui restent en clair : la séance répète la révision dans le texte.
const associees = (mode) => new TextEncoder().encode(`atelier-des-arpenteurs/combat/${FORMAT_COMBAT}/${mode}`);

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

const estObjet = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);

/**
 * La révision d'un enregistrement gardé : un entier de 0 à REVISION_MAX,
 * sinon 0 (rien de gardé, ou une révision qui ne se lit pas, ou démesurée).
 * Le déchiffrement, la lecture et l'écriture la lisent toutes par ici : une
 * donnée abîmée jusque dans sa révision reste ainsi remplaçable.
 */
export function revisionDe(enregistrement) {
  const revision = estObjet(enregistrement) ? enregistrement.revision : null;
  return Number.isSafeInteger(revision) && revision >= 0 && revision <= REVISION_MAX ? revision : 0;
}

/**
 * Chiffre le texte d'un combat : l'enregistrement, ou { erreur, code }
 * (« trop_gros » au-delà de la borne ; « invalide » pour un appel mal fait
 * ou une clé qui ne chiffre pas). Ne lève pas.
 */
export async function chiffrerCombat(texte, secret, { mode, revision, maintenant = new Date() } = {}) {
  const { cle, sel, iterations } = secret ?? {};
  if (typeof texte !== "string" || !MODES.includes(mode) || !Number.isSafeInteger(revision) || revision < 1 || revision > REVISION_MAX || !cle) {
    return { erreur: "Ce combat ne peut pas être gardé : la demande est mal faite.", code: "invalide" };
  }
  // Trois octets au plus par unité UTF-16 : au-delà, inutile d'encoder.
  if (texte.length > TAILLE_MAX_COMBAT) return { erreur: ERREUR_TROP_GROS, code: "trop_gros" };
  const clair = new TextEncoder().encode(texte);
  if (clair.length > TAILLE_MAX_COMBAT) return { erreur: ERREUR_TROP_GROS, code: "trop_gros" };
  try {
    const compresse = await transformer(clair, new CompressionStream("deflate-raw"));
    // Ce qui ne se relirait pas ne s'écrit pas : un compressé au-delà de la
    // borne de lecture se dit en jouant, et non au rechargement.
    if (compresse.length + OCTETS_ETIQUETTE > OCTETS_CHIFFRE_MAX) return { erreur: ERREUR_TROP_GROS, code: "trop_gros" };
    const iv = crypto.getRandomValues(new Uint8Array(OCTETS_IV));
    const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associees(mode) }, cle, compresse));
    return { mode, format: FORMAT_COMBAT, sel, iterations, iv: versBase64(iv), chiffre: versBase64(chiffre), revision, enregistre_le: maintenant.toISOString() };
  } catch {
    return { erreur: "Ce combat ne peut pas être gardé : le chiffrement a échoué.", code: "invalide" };
  }
}

// La forme de l'enregistrement : ses huit clés, elles seules, et leurs bornes.
function formeValide(e, mode) {
  if (!estObjet(e)) return false;
  const cles = Object.keys(e);
  if (cles.length !== CHAMPS.length || CHAMPS.some((champ) => !Object.hasOwn(e, champ))) return false;
  if (e.format !== FORMAT_COMBAT || !MODES.includes(mode) || e.mode !== mode) return false;
  // Une révision au-delà de sa borne vaut 0 (revisionDe) : l'enregistrement
  // qui la porte est abîmé, et se remplace à la révision 1.
  if (!Number.isSafeInteger(e.revision) || e.revision < 1 || e.revision > REVISION_MAX) return false;
  if (!Number.isInteger(e.iterations) || e.iterations < 1 || e.iterations > ITERATIONS_MAX) return false;
  if (octets(e.sel, SIGNES_MAX.sel)?.length !== OCTETS_SEL || octets(e.iv, SIGNES_MAX.iv)?.length !== OCTETS_IV) return false;
  if (typeof e.enregistre_le !== "string" || Number.isNaN(Date.parse(e.enregistre_le))) return false;
  const chiffre = octets(e.chiffre, SIGNES_MAX.chiffre);
  return chiffre !== null && chiffre.length > OCTETS_ETIQUETTE;
}

// L'examen d'un enregistrement, avant toute clé : sa révision, et l'issue
// qu'il impose s'il ne peut pas être déchiffré (null s'il le peut). Rien de
// ce qu'il porte ne le fait lever : une forme qui ne s'examine pas est une
// donnée abîmée, et se dit comme telle.
function examiner(enregistrement, mode) {
  let revision = 0;
  try {
    revision = revisionDe(enregistrement);
    // Avant toute autre vérification : un format futur peut avoir ajouté ou
    // retiré une clé. Le dire « illisible » offrirait « Nouveau combat », qui
    // l'écraserait.
    if (estObjet(enregistrement) && Number.isInteger(enregistrement.format) && enregistrement.format > FORMAT_COMBAT) {
      return { revision, issue: { erreur: PHRASES_DE_GARDE.recent, code: "format_recent", revision } };
    }
    if (formeValide(enregistrement, mode)) return { revision, issue: null };
  } catch {
    // Dit ci-dessous, avec la révision lue jusque-là.
  }
  return { revision, issue: { erreur: ERREUR_ABIME, code: "illisible", revision } };
}

/**
 * Déchiffre un enregistrement : { texte, revision }, ou { erreur, code,
 * revision }. « format_recent » : l'onglet est en retard sur le site ;
 * « cle » : le mot de passe de table a changé ; « illisible » : tout le
 * reste. La révision est rendue même avec une erreur, pour écrire au-dessus.
 *
 * Rien de ce que porte l'enregistrement ne la fait lever, si long ou si mal
 * fait soit-il. Un secret qui ne se lit pas n'est pas une donnée abîmée :
 * c'est le gardien qui le rattrape.
 */
export async function dechiffrerCombat(enregistrement, secret, { mode } = {}) {
  const { revision, issue } = examiner(enregistrement, mode);
  if (issue !== null) return issue;
  const abime = { erreur: ERREUR_ABIME, code: "illisible", revision };
  const { cle, sel, iterations } = secret ?? {};
  // Sans déchiffrer : deux lectures de la même clé donnent deux objets, et
  // une clé ne se reconnaît donc qu'à son sel et à ses itérations.
  if (enregistrement.sel !== sel || enregistrement.iterations !== iterations) return { erreur: ERREUR_CLE, code: "cle", revision };
  try {
    const compresse = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(enregistrement.iv), additionalData: associees(mode) }, cle, depuisBase64(enregistrement.chiffre)),
    );
    // decompresserBorne lève sur ce qui n'est pas du deflate, et ne borne
    // rien si on ne lui donne pas de borne.
    const clair = await decompresserBorne(compresse, TAILLE_MAX_COMBAT);
    if (!clair) return abime;
    return { texte: new TextDecoder("utf-8", { fatal: true }).decode(clair), revision };
  } catch {
    return abime;
  }
}

// ─── Le magasin ─────────────────────────────────────────────────────────────

function verifierMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Mode inconnu : ${mode}`);
}

// Ce que décide une écriture, dans la base comme en mémoire : la révision
// gardée doit être celle qu'on attend, exactement. « Plus récente »
// laisserait un onglet ancien écraser un combat neuf.
const attendu = (gardee, attendue) => revisionDe(gardee) === attendue;

/** Un magasin en mémoire : pour les contrôles, et quand IndexedDB manque. */
export function magasinCombatMemoire() {
  const combats = new Map();
  const lu = (mode) => (combats.has(mode) ? structuredClone(combats.get(mode)) : null);
  return {
    durable: false,
    async lire(mode) {
      verifierMode(mode);
      return lu(mode);
    },
    async ecrireSi(enregistrement, attendue) {
      verifierMode(enregistrement?.mode);
      const copie = structuredClone(enregistrement);
      const gardee = lu(copie.mode);
      if (!attendu(gardee, attendue)) return { ecrit: false, gardee };
      combats.set(copie.mode, copie);
      return { ecrit: true };
    },
  };
}

function attendre(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/** Le magasin IndexedDB : une base, un entrepôt, un combat par mode. */
export async function magasinCombatIndexedDB(nom = NOM_BASE) {
  const ouverture = indexedDB.open(nom, VERSION_BASE);
  ouverture.onupgradeneeded = () => {
    const base = ouverture.result;
    if (!base.objectStoreNames.contains(ENTREPOT)) base.createObjectStore(ENTREPOT, { keyPath: "mode" });
  };
  // À la version 1, rien ne peut bloquer la création. Les deux gardes sont
  // posées dès maintenant, pour le jour d'une version 2 : un onglet resté
  // sur l'ancienne ferait attendre la montée sans fin (relecture du lot 2 bis).
  const bloquee = new Promise((_, rejeter) => {
    ouverture.onblocked = () => rejeter(new Error("La base du combat est bloquée par un autre onglet."));
  });
  const base = await Promise.race([attendre(ouverture), bloquee]);
  base.onversionchange = () => base.close();
  // Tout se demande dans le tour où la transaction naît, ou dans le rappel
  // d'une de ses demandes : une transaction ne survit pas à une attente.
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
    // Lire, comparer et écrire dans une seule transaction d'écriture : le
    // navigateur les met en file d'un onglet à l'autre. En deux
    // transactions, l'autre onglet écrirait entre les deux.
    async ecrireSi(enregistrement, attendue) {
      verifierMode(enregistrement?.mode);
      return transaction("readwrite", (entrepot) => {
        let issue = null;
        const lecture = entrepot.get(enregistrement.mode);
        lecture.onsuccess = () => {
          const gardee = lecture.result ?? null;
          if (!attendu(gardee, attendue)) {
            issue = { ecrit: false, gardee };
            return;
          }
          entrepot.put(enregistrement);
          issue = { ecrit: true };
        };
        return () => issue;
      });
    },
  };
}

/**
 * Ouvre le magasin du combat ; en mémoire sans IndexedDB, ou si la base ne
 * s'ouvre pas. Jamais à l'import du module : l'écran l'appelle.
 */
export async function ouvrirMagasinCombat() {
  try {
    return await magasinCombatIndexedDB();
  } catch {
    return magasinCombatMemoire();
  }
}

// ─── Le gardien ─────────────────────────────────────────────────────────────

// Une attente d'un tour de la boucle d'événements : ce qui suit ne s'exécute
// ni dans l'appel en cours, ni dans ses microtâches (elles passent avant que
// l'écouteur d'un clic ait rendu la main à la page).
const auTourSuivant = () =>
  new Promise((suite) => {
    setTimeout(suite, 0);
  });

/**
 * Le gardien du combat d'un mode : il relit l'enregistrement, garde le
 * combat après chaque événement, et dit où il en est.
 *
 * `secret` est une fonction : le gardien ne tient aucune copie de la clé
 * (§ 7.2) et la relit à chaque écriture, car le mot de passe peut changer
 * pendant la visite. `garder(assembler)` reçoit de quoi fabriquer le texte
 * à une révision donnée : le texte porte sa révision, que le gardien seul
 * connaît. Il ne fait rien de lourd dans le tour de l'appel : l'assembleur
 * est appelé au départ de l'écriture, un tour plus tard au plus tôt, et lit
 * donc le combat de ce moment-là.
 */
export function creerGardien({ magasin, mode, secret, maintenant = () => new Date() }) {
  verifierMode(mode);
  const rappels = new Set();
  let connue = 0; // la révision gardée, telle que ce gardien la connaît
  let situation = "garde";
  // Faux quand rien ne doit s'écrire : après un oubli, une panne, un combat
  // ouvert ailleurs, plus récent ou non lu. Avant tout chargement, la
  // révision connue est 0 : l'écriture ne passe que si la base est vide.
  let pret = true;
  let circuit = 0; // l'oubli l'avance : une suite partie avant lui ne touche plus à rien
  let attente = null; // la file, à une seule place
  let enCours = null; // la promesse des écritures en cours
  let gardeIllisible = false; // sans clé : y a-t-il un combat gardé, qu'on ne lit pas ?
  let dernier = null;

  const etat = () => {
    if (situation !== "garde") return situation;
    if (!magasin.durable) return "memoire";
    return enCours ? "ecriture" : "garde";
  };
  const phrase = () => (situation === "sans_cle" && gardeIllisible ? PHRASES_DE_GARDE.illisible : PHRASES_DE_GARDE[etat()]);

  function signaler() {
    const courant = `${etat()}\n${phrase()}`;
    if (courant === dernier) return;
    dernier = courant;
    for (const rappel of [...rappels]) rappel(etat());
  }
  dernier = `${etat()}\n${phrase()}`;

  // Une écriture qui échoue, un combat trop gros : le combat continue en
  // mémoire, et plus rien ne s'écrit.
  function tomberEnPanne() {
    situation = "memoire";
    pret = false;
    attente = null;
  }

  async function ecrire(assembler, depart) {
    const lu = secret();
    if (!lu?.cle) {
      // La clé reviendra peut-être : le combat est entier en mémoire, et
      // l'écriture suivante le portera tout entier.
      situation = "sans_cle";
      gardeIllisible = false;
      return;
    }
    // À sa borne, la révision repart de 1 : seul un enregistrement posé à la
    // main l'y porte, et sans ce retour plus rien ne s'écrirait par-dessus.
    // L'écriture attend toujours la révision connue, exactement.
    const revision = connue < REVISION_MAX ? connue + 1 : 1;
    let enregistrement;
    try {
      enregistrement = await chiffrerCombat(assembler(revision), lu, { mode, revision, maintenant: maintenant() });
    } catch {
      enregistrement = { erreur: true };
    }
    if (depart !== circuit) return;
    if (enregistrement.erreur) return tomberEnPanne();
    // Le chiffrement est fait : la transaction peut s'ouvrir.
    let issue;
    try {
      issue = await magasin.ecrireSi(enregistrement, connue);
    } catch {
      if (depart === circuit) tomberEnPanne();
      return;
    }
    if (depart !== circuit) return;
    if (issue.ecrit) {
      connue = revision;
      situation = "garde";
    } else {
      situation = "ailleurs";
      pret = false;
      attente = null;
    }
  }

  async function vider(depart) {
    while (attente && depart === circuit) {
      const assembler = attente;
      attente = null;
      await ecrire(assembler, depart);
    }
  }

  function garder(assembler) {
    if (!pret) return;
    // La demande remplace celle qui attendait : le texte est cumulatif, la
    // dernière écriture contient les précédentes.
    attente = assembler;
    if (enCours) return;
    const depart = circuit;
    // La file est prise tout de suite, et « Enregistrement… » se dit ; le
    // travail, lui, part au tour suivant. Parti dans l'appel, il assemblait
    // le texte du combat, l'encodait et ouvrait la compression dans
    // l'écouteur même du clic, avant que l'écran soit à jour (6 à 7 ms
    // mesurées dans un navigateur). Les demandes venues entre-temps ne font
    // qu'une écriture.
    const tour = auTourSuivant()
      .then(() => vider(depart))
      .finally(() => {
        if (enCours === tour) enCours = null;
        signaler();
      });
    enCours = tour;
    signaler();
  }

  async function repos() {
    while (enCours) await enCours;
  }

  const OUBLIE = Object.freeze({ erreur: PHRASES_DE_GARDE.sans_cle, code: "sans_cle" });

  async function charger() {
    const depart = circuit;
    attente = null;
    await repos();
    if (depart !== circuit) return OUBLIE;
    pret = false;
    let garde;
    try {
      garde = await magasin.lire(mode);
    } catch {
      if (depart !== circuit) return OUBLIE;
      // La base ne se lit pas : on ne sait pas ce qu'elle garde, on n'y
      // écrit donc rien.
      tomberEnPanne();
      signaler();
      return { vide: true };
    }
    if (depart !== circuit) return OUBLIE;
    const lu = secret();
    if (!lu?.cle) {
      situation = "sans_cle";
      gardeIllisible = garde !== null;
      signaler();
      return { erreur: phrase(), code: "sans_cle" };
    }
    if (garde === null) {
      connue = 0;
      situation = "garde";
      pret = true;
      signaler();
      return { vide: true };
    }
    let issue;
    try {
      issue = await dechiffrerCombat(garde, lu, { mode });
    } catch {
      // Le déchiffrement ne lève pas pour une donnée abîmée ; s'il lève quand
      // même, le combat gardé ne se lit pas, et doit rester remplaçable. Une
      // levée qui remonterait d'ici laisserait l'écran sans combat ni bouton,
      // à chaque visite.
      issue = { erreur: ERREUR_ABIME, code: "illisible", revision: revisionDe(garde) };
    }
    if (depart !== circuit) return OUBLIE;
    connue = issue.revision;
    if (issue.code === "format_recent") {
      situation = "recent";
    } else {
      // Illisible, le combat gardé se remplace : « Nouveau combat » écrit
      // au-dessus de sa révision.
      situation = issue.erreur ? "illisible" : "garde";
      pret = true;
    }
    signaler();
    return issue.erreur ? { erreur: issue.erreur, code: issue.code } : { texte: issue.texte, revision: issue.revision };
  }

  return {
    charger,
    /** « Reprendre le combat le plus récent » : relit ce que la base garde. */
    reprendre: charger,
    garder,
    /** La séance y dit qu'un texte déchiffré ne se reprend pas. */
    declarer(nouvelle) {
      if (nouvelle !== "illisible" && nouvelle !== "autre_version") throw new TypeError(`État inconnu : ${nouvelle}`);
      // Un combat d'une version plus récente, ou qu'on n'a pas pu lire, ne
      // devient pas remplaçable parce que la séance le dit.
      if (!pret) return;
      situation = nouvelle;
      signaler();
    },
    etat,
    /** La phrase de la barre de titre, pour l'état du moment. */
    phrase,
    /** Rend de quoi se désabonner. */
    surChangement(rappel) {
      rappels.add(rappel);
      return () => rappels.delete(rappel);
    },
    repos,
    /**
     * « Oublier le mot de passe » : plus rien de ce gardien ne s'écrit, et
     * un chargement en cours ne rend rien. La base n'est pas touchée : le
     * combat chiffré y reste, illisible sans la clé.
     */
    oublier() {
      circuit += 1;
      attente = null;
      connue = 0;
      pret = false;
      gardeIllisible = false;
      situation = "garde";
      // enCours reste : l'écriture déjà partie finit seule, sans rien
      // retenir, et un chargement qui suivrait l'attend.
      signaler();
    },
  };
}
