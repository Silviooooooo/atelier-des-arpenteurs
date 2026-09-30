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

import { MODES } from "../securite/coffre.js";
import { ErreurPersonnage, verifier } from "./format.js";

const NOM_BASE = "atelier-des-arpenteurs-personnages";

function verifierMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Mode inconnu : ${mode}`);
}

/** Un magasin en mémoire : pour les contrôles, et quand IndexedDB manque. */
export function magasinPersonnagesMemoire() {
  const tables = { reel: new Map(), demo: new Map() };
  return {
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

/** Le magasin IndexedDB : une base, un entrepôt par mode. */
export async function magasinPersonnagesIndexedDB(nom = NOM_BASE) {
  const ouverture = indexedDB.open(nom, 1);
  ouverture.onupgradeneeded = () => {
    for (const mode of MODES) ouverture.result.createObjectStore(mode, { keyPath: "id" });
  };
  const base = await attendre(ouverture);
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
  };
}

/**
 * L'étagère des personnages d'un mode, sur un magasin. Tout ce qu'elle rend
 * est vérifié ; un personnage illisible est compté, jamais montré.
 */
export function creerEtagere(magasin, mode) {
  verifierMode(mode);
  const lisible = (personnage) => {
    try {
      verifier(personnage);
      return personnage.mode === mode;
    } catch (erreur) {
      if (erreur instanceof ErreurPersonnage) return false;
      throw erreur;
    }
  };
  return {
    mode,
    durable: magasin.durable,
    /** { personnages, illisibles } : les plus récents d'abord. */
    async lister() {
      const tous = (await magasin.lister(mode)) ?? [];
      const personnages = tous.filter(lisible).sort((a, b) => b.modifie_le.localeCompare(a.modifie_le));
      return { personnages, illisibles: tous.length - personnages.length };
    },
    /** Le personnage de cet identifiant, ou null (absent ou illisible). */
    async lire(id) {
      const trouve = await magasin.lire(mode, id);
      return trouve && lisible(trouve) ? trouve : null;
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
  };
}

/** Ouvre l'étagère de l'appareil pour un mode ; en mémoire sans IndexedDB. */
export async function ouvrirEtagere(mode) {
  let magasin;
  try {
    magasin = await magasinPersonnagesIndexedDB();
  } catch {
    magasin = magasinPersonnagesMemoire();
  }
  return creerEtagere(magasin, mode);
}
