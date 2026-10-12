// Les souvenirs de l'appareil, espionnés, pour les contrôles
// (SPECIFICATION.md, § 17 et § 11).
//
// Le combat ne se garde que chiffré, dans sa base, jamais dans
// localStorage : pour le contrôler, il faut voir tout ce qui se lit et
// s'écrit. Cette fonction est recopiée de tests/ecrans_adversaires.test.js,
// qui garde la sienne ; elle y gagne une option, pour poser une vraie
// IndexedDB simulée à la place du bouchon qui ne fait que compter.

/**
 * Pose localStorage, sessionStorage et indexedDB sur globalThis, et rend le
 * journal de ce qui s'y passe : { lus, ecrits, ouvertures, retirer() }.
 * `depart` : ce que localStorage contient déjà. `indexedDB` : une fabrique
 * (tests/outils/indexeddb_simulee.js), dont les ouvertures sont comptées ;
 * sans elle, un bouchon dont rien ne s'ouvre.
 */
export function simulerStockage(depart = {}, { indexedDB = null } = {}) {
  const journal = { lus: [], ecrits: [], ouvertures: 0 };
  const memoire = new Map(Object.entries(depart));
  const avant = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, indexedDB: globalThis.indexedDB };
  const magasin = {
    getItem: (cle) => (journal.lus.push(cle), memoire.get(cle) ?? null),
    setItem: (cle, valeur) => (journal.ecrits.push([cle, valeur]), memoire.set(cle, String(valeur))),
  };
  const base = { open: (...arguments_) => ((journal.ouvertures += 1), indexedDB ? indexedDB.open(...arguments_) : {}) };
  Object.assign(globalThis, { localStorage: magasin, sessionStorage: magasin, indexedDB: base });
  journal.retirer = () => {
    for (const [nom, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete globalThis[nom];
      else globalThis[nom] = valeur;
    }
  };
  return journal;
}
