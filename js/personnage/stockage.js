// Les personnages gardés sur l'appareil (SPECIFICATION.md, § 15.1).
//
// Une base IndexedDB à part du coffre, qui ne garde que des clés (§ 7.2) :
// « atelier-des-arpenteurs-personnages », avec deux entrepôts, « reel » et
// « demo » : un personnage de démonstration ne se mêle jamais aux
// personnages réels. Sans IndexedDB, les personnages vivent en mémoire le
// temps de la visite, et la page le dit.
//
// Ce qui se lit de l'appareil se vérifie comme un fichier reçu : l'origine
// du site est partagée par les sites GitHub Pages du compte (§ 7.3).
//
// Le lot 2 bis ajoute un troisième entrepôt, « notes » (version 2 de la
// base) : ce que l'appareil sait d'un personnage hors de son format, par
// mode et par identifiant. remplace : l'original d'une copie de travail
// (« Modifier ») ; nom : le nom de cet original, ou du personnage dont la
// suppression attend, pour le dire même quand il ne se lit plus ; depot :
// l'état de son dépôt en ligne (§ 15.8). Une note
// illisible s'ignore.

import { MODES } from "../securite/coffre.js";
import { ErreurPersonnage, accepter, verifier } from "./format.js";

const NOM_BASE = "atelier-des-arpenteurs-personnages";
const VERSION_BASE = 2;
const IDENTIFIANT = /^[A-Za-z0-9_-]{16,40}$/;
const ETATS_DEPOT = ["non_envoye", "envoye"];
const ACTIONS_DEPOT = ["creer", "remplacer", "supprimer"];
const cleDeNote = (mode, id) => `${mode}/${id}`;

/**
 * Une note lue de l'appareil, vérifiée : { cle, mode, id, remplace, nom, depot },
 * ou null. depot : null, ou { etat, action, ticket, date, erreur }.
 */
export function verifierNote(note) {
  const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const texteCourt = (v, max) => typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  if (!estObjet(note) || !MODES.includes(note.mode) || typeof note.id !== "string" || !IDENTIFIANT.test(note.id) || note.cle !== cleDeNote(note.mode, note.id)) return null;
  if (note.remplace !== null && (typeof note.remplace !== "string" || !IDENTIFIANT.test(note.remplace))) return null;
  const nom = note.nom ?? null;
  if (nom !== null && !texteCourt(nom, 120)) return null;
  const d = note.depot;
  if (d !== null) {
    if (!estObjet(d) || !ETATS_DEPOT.includes(d.etat) || !ACTIONS_DEPOT.includes(d.action)) return null;
    if (d.ticket !== null && !(Number.isSafeInteger(d.ticket) && d.ticket > 0)) return null;
    if (!texteCourt(d.date, 40) || Number.isNaN(Date.parse(d.date))) return null;
    if (d.erreur !== null && !texteCourt(d.erreur, 400)) return null;
  }
  return { cle: note.cle, mode: note.mode, id: note.id, remplace: note.remplace, nom, depot: d === null ? null : { etat: d.etat, action: d.action, ticket: d.ticket, date: d.date, erreur: d.erreur } };
}

function verifierMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Mode inconnu : ${mode}`);
}

/** Un magasin en mémoire : pour les contrôles, et quand IndexedDB manque. */
export function magasinPersonnagesMemoire() {
  const tables = { reel: new Map(), demo: new Map() };
  const notes = new Map();
  return {
    async listerNotes(mode) {
      return [...notes.values()].filter((n) => n?.mode === mode).map((n) => structuredClone(n));
    },
    async ecrireNote(note) {
      notes.set(note.cle, structuredClone(note));
    },
    async effacerNote(cle) {
      notes.delete(cle);
    },
    durable: false,
    async lister(mode) {
      return [...tables[mode].values()].map((p) => structuredClone(p));
    },
    async lire(mode, id) {
      const trouve = tables[mode].get(id);
      return trouve ? structuredClone(trouve) : undefined;
    },
    async ecrire(mode, personnage) {
      tables[mode].set(personnage.id, structuredClone(personnage));
    },
    async effacer(mode, id) {
      tables[mode].delete(id);
    },
  };
}

function attendre(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/** Le magasin IndexedDB : une base, un entrepôt par mode, et les notes. */
export async function magasinPersonnagesIndexedDB(nom = NOM_BASE) {
  const ouverture = indexedDB.open(nom, VERSION_BASE);
  // De la version 1 à la 2, seul l'entrepôt des notes s'ajoute : les
  // personnages gardés restent.
  ouverture.onupgradeneeded = () => {
    const base = ouverture.result;
    for (const mode of MODES) if (!base.objectStoreNames.contains(mode)) base.createObjectStore(mode, { keyPath: "id" });
    if (!base.objectStoreNames.contains("notes")) base.createObjectStore("notes", { keyPath: "cle" });
  };
  // Un autre onglet ouvert sur l'ancienne version garde sa connexion : la
  // montée attendrait sans fin, et la page avec elle (relecture du lot 2 bis).
  const bloquee = new Promise((_, rejeter) => {
    ouverture.onblocked = () => rejeter(new ErreurBaseBloquee());
  });
  const base = await Promise.race([attendre(ouverture), bloquee]);
  // Une montée future, demandée par un autre onglet : celui-ci s'efface.
  base.onversionchange = () => base.close();
  const transaction = (mode, acces, faire) =>
    new Promise((resoudre, rejeter) => {
      const t = base.transaction(mode, acces);
      const requete = faire(t.objectStore(mode));
      t.oncomplete = () => resoudre(requete.result);
      t.onerror = () => rejeter(t.error);
      t.onabort = () => rejeter(t.error);
    });
  return {
    durable: true,
    lister: (mode) => transaction(mode, "readonly", (entrepot) => entrepot.getAll()),
    lire: (mode, id) => transaction(mode, "readonly", (entrepot) => entrepot.get(id)),
    ecrire: (mode, personnage) => transaction(mode, "readwrite", (entrepot) => entrepot.put(personnage)),
    effacer: (mode, id) => transaction(mode, "readwrite", (entrepot) => entrepot.delete(id)),
    listerNotes: async (mode) => ((await transaction("notes", "readonly", (entrepot) => entrepot.getAll())) ?? []).filter((n) => n?.mode === mode),
    ecrireNote: (note) => transaction("notes", "readwrite", (entrepot) => entrepot.put(note)),
    effacerNote: (cle) => transaction("notes", "readwrite", (entrepot) => entrepot.delete(cle)),
  };
}

/**
 * L'étagère des personnages d'un mode, sur un magasin. Tout ce qu'elle rend
 * est vérifié ; un personnage illisible est compté, jamais montré.
 */
export function creerEtagere(magasin, mode) {
  verifierMode(mode);
  // Le personnage gardé, converti s'il est au format 1 (format.js, migrer),
  // ou null s'il est illisible ou d'un autre mode.
  const lisible = (personnage) => {
    try {
      const accepte = accepter(personnage);
      return accepte.mode === mode ? accepte : null;
    } catch (erreur) {
      if (erreur instanceof ErreurPersonnage) return null;
      throw erreur;
    }
  };
  const date = (personnage) => Date.parse(personnage.modifie_le);
  return {
    mode,
    durable: magasin.durable,
    /** { personnages, illisibles } : les plus récents d'abord. */
    async lister() {
      const tous = (await magasin.lister(mode)) ?? [];
      const personnages = tous.map(lisible).filter(Boolean).sort((a, b) => date(b) - date(a));
      return { personnages, illisibles: tous.length - personnages.length };
    },
    /** Le personnage de cet identifiant, ou null (absent ou illisible). */
    async lire(id) {
      const trouve = await magasin.lire(mode, id);
      return trouve ? lisible(trouve) : null;
    },
    /** Garde un personnage de ce mode, vérifié. */
    async garder(personnage) {
      verifier(personnage);
      if (personnage.mode !== mode) throw new ErreurPersonnage("Ce personnage n'est pas de ce mode.");
      await magasin.ecrire(mode, personnage);
    },
    async effacer(id) {
      await magasin.effacer(mode, id);
    },
    /** Les notes lisibles de ce mode. */
    async listerNotes() {
      return ((await magasin.listerNotes?.(mode)) ?? []).map(verifierNote).filter(Boolean);
    },
    /** La note d'un personnage, ou null. */
    async lireNote(id) {
      return (await this.listerNotes()).find((n) => n.id === id) ?? null;
    },
    /**
     * Complète la note d'un personnage ({ remplace }, { nom }, { depot }) ; null
     * l'efface. Une note qui ne dit plus rien s'efface aussi.
     */
    async garderNote(id, changement) {
      if (!IDENTIFIANT.test(String(id))) throw new TypeError("Identifiant illisible.");
      const cleNote = cleDeNote(mode, id);
      if (changement === null) return magasin.effacerNote?.(cleNote);
      const actuelle = (await this.lireNote(id)) ?? { cle: cleNote, mode, id, remplace: null, nom: null, depot: null };
      const note = verifierNote({ ...actuelle, ...changement, cle: cleNote, mode, id });
      if (!note) throw new TypeError("Note illisible.");
      if (note.remplace === null && note.depot === null) return magasin.effacerNote?.(cleNote);
      return magasin.ecrireNote?.(note);
    },
  };
}

/** La base des personnages attend qu'un autre onglet de l'Atelier se ferme. */
export class ErreurBaseBloquee extends Error {
  constructor() {
    super("Un autre onglet de l'Atelier, ouvert sur une version précédente, bloque la mise à jour des personnages de cet appareil : fermez-le, puis rechargez cette page.");
  }
}

/**
 * Ouvre l'étagère de l'appareil pour un mode ; en mémoire sans IndexedDB.
 * Une base bloquée par un autre onglet : en mémoire aussi, et l'étagère le
 * dit (bloquee), pour que la page le dise à son tour.
 */
export async function ouvrirEtagere(mode) {
  let magasin;
  let bloquee = null;
  try {
    magasin = await magasinPersonnagesIndexedDB();
  } catch (erreur) {
    if (erreur instanceof ErreurBaseBloquee) bloquee = erreur.message;
    magasin = magasinPersonnagesMemoire();
  }
  return { ...creerEtagere(magasin, mode), bloquee };
}
