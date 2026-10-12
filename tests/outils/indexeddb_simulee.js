// Une IndexedDB simulée, pour les contrôles (SPECIFICATION.md, § 17 et § 11).
//
// Node n'a pas d'IndexedDB. Sans elle, le contrôle de la révision d'un
// combat ne porterait que sur le jumeau en mémoire du magasin, et ne dirait
// rien du vrai code : or c'est là qu'est le risque (lire, comparer et écrire
// dans une seule transaction, après le chiffrement). Aucune dépendance.
//
// Ce qu'elle fait, et rien de plus :
//   - open(nom, version) : onupgradeneeded à la création ou à la montée,
//     puis onsuccess ; createObjectStore(nom, { keyPath }) pendant la montée
//     seulement ; objectStoreNames.contains ; onversionchange et onblocked
//     quand une autre connexion reste ouverte ; close() ;
//   - transaction(entrepot, acces) : objectStore, oncomplete, onerror,
//     onabort, abort() ; get, put, delete, chacun une demande ;
//   - les valeurs clonées à l'écriture et à la lecture ;
//   - les transactions d'un entrepôt en file, d'une connexion à l'autre :
//     une écriture attend celles qui la précèdent, et les lectures qui la
//     suivent l'attendent ;
//   - une transaction inactive hors de son tour de création et des rappels
//     de ses demandes (TransactionInactiveError) ;
//   - un journal des ouvertures, des transactions et des écritures, et un
//     accès au contenu.
//
// Elle est plus stricte que les navigateurs sur un point, à dessein : la
// transaction devient inactive dès la première attente, même celle d'une
// promesse déjà tenue. Un code qui passe ici passe donc chez eux. Ce
// qu'elle ne fait pas : index, curseurs, getAll, plusieurs entrepôts dans
// une transaction, quotas mesurés. Elle ne remplace pas l'essai dans
// Chromium et dans Firefox.

function erreurNommee(nom, message) {
  const erreur = new Error(`${nom} : ${message}`);
  erreur.name = nom;
  return erreur;
}

const cleValide = (cle) => typeof cle === "string" || (typeof cle === "number" && !Number.isNaN(cle));

/**
 * Une fabrique : ce qui tient lieu de `indexedDB`. Deux connexions ouvertes
 * sur la même fabrique sont deux onglets du même navigateur.
 */
export function fabriqueIndexedDB() {
  const bases = new Map(); // nom → { nom, version, entrepots: Map(nom → { keyPath, lignes: Map }), connexions: Set, files: Map }
  const journal = { ouvertures: 0, transactions: [], ecritures: [] };
  // Les pannes qu'un contrôle arme : l'ouverture qui lève, celle qui
  // échoue, l'écriture que le navigateur refuse (quota).
  const pannes = { ouvertureLeve: false, ouvertureEchoue: false, ecritureEchoue: false };
  const plusTard = (faire) => setTimeout(faire, 0);

  // Une lecture part dès que rien d'écrit ne la précède ; une écriture,
  // quand plus rien ne la précède.
  function avancer(file) {
    while (file.length > 0 && file[0].finie) file.shift();
    for (const [rang, t] of file.entries()) {
      if (t.finie) continue;
      const premiere = file.slice(0, rang).every((autre) => autre.finie);
      if (t.acces === "readwrite") {
        if (premiere && !t.demarree) t.demarrer();
        return;
      }
      if (!t.demarree) t.demarrer();
    }
  }

  function ouvrirTransaction(base, nomEntrepot, acces) {
    const entrepot = base.entrepots.get(nomEntrepot);
    if (!entrepot) throw erreurNommee("NotFoundError", `pas d'entrepôt « ${nomEntrepot} »`);
    if (acces !== "readonly" && acces !== "readwrite") throw new TypeError(`Accès inconnu : ${acces}`);
    if (!base.files.has(nomEntrepot)) base.files.set(nomEntrepot, []);
    const file = base.files.get(nomEntrepot);
    journal.transactions.push({ base: base.nom, entrepot: nomEntrepot, acces });

    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const suivi = { acces, demarree: false, finie: false, demarrer: null };
    let active = true; // le tour de création, puis chaque rappel d'une demande
    const demandes = []; // celles qui attendent leur tour
    let avant = null; // l'entrepôt au démarrage, pour un abandon
    queueMicrotask(() => {
      active = false;
    });

    function clore(rappel) {
      suivi.finie = true;
      active = false;
      demandes.length = 0;
      plusTard(() => {
        rappel();
        avancer(file);
      });
    }

    function abandonner(erreur) {
      if (avant) entrepot.lignes = avant;
      t.error = erreur;
      clore(() => t.onabort?.({ target: t }));
    }

    function suivante() {
      if (suivi.finie) return;
      const demande = demandes.shift();
      if (!demande) return clore(() => t.oncomplete?.({ target: t }));
      plusTard(() => {
        if (suivi.finie) return;
        const { requete, faire } = demande;
        let rappel;
        try {
          requete.result = faire();
          rappel = requete.onsuccess;
        } catch (erreur) {
          requete.error = erreur;
          rappel = requete.onerror;
        }
        active = true;
        try {
          rappel?.({ target: requete });
        } finally {
          active = false;
        }
        if (suivi.finie) return;
        // Une demande qui échoue remonte à la transaction, qui s'abandonne.
        if (requete.error) {
          t.onerror?.({ target: requete });
          return abandonner(requete.error);
        }
        suivante();
      });
    }

    suivi.demarrer = () => {
      suivi.demarree = true;
      if (acces === "readwrite") avant = new Map([...entrepot.lignes].map(([cle, valeur]) => [cle, structuredClone(valeur)]));
      suivante();
    };
    file.push(suivi);
    plusTard(() => avancer(file));

    function demander(faire) {
      if (suivi.finie || !active) throw erreurNommee("TransactionInactiveError", "la transaction n'est pas active.");
      const requete = { result: undefined, error: null, onsuccess: null, onerror: null, transaction: t };
      demandes.push({ requete, faire });
      return requete;
    }
    const exigerEcriture = () => {
      if (suivi.finie || !active) throw erreurNommee("TransactionInactiveError", "la transaction n'est pas active.");
      if (acces !== "readwrite") throw erreurNommee("ReadOnlyError", "la transaction ne fait que lire.");
    };

    t.objectStore = (nom) => {
      if (suivi.finie) throw erreurNommee("InvalidStateError", "la transaction est finie.");
      if (nom !== nomEntrepot) throw erreurNommee("NotFoundError", `« ${nom} » n'est pas dans la transaction.`);
      return {
        name: nomEntrepot,
        keyPath: entrepot.keyPath,
        get: (cle) => demander(() => (entrepot.lignes.has(cle) ? structuredClone(entrepot.lignes.get(cle)) : undefined)),
        put(valeur, cleDonnee) {
          exigerEcriture();
          const copie = structuredClone(valeur);
          const cle = entrepot.keyPath === null ? cleDonnee : copie?.[entrepot.keyPath];
          if (!cleValide(cle)) throw erreurNommee("DataError", "la valeur ne porte pas de clé valide.");
          return demander(() => {
            if (pannes.ecritureEchoue) throw erreurNommee("QuotaExceededError", "le navigateur refuse l'écriture.");
            entrepot.lignes.set(cle, copie);
            journal.ecritures.push({ base: base.nom, entrepot: nomEntrepot, cle, valeur: structuredClone(copie) });
            return cle;
          });
        },
        delete(cle) {
          exigerEcriture();
          return demander(() => void entrepot.lignes.delete(cle));
        },
      };
    };
    t.abort = () => {
      if (suivi.finie) throw erreurNommee("InvalidStateError", "la transaction est finie.");
      abandonner(null);
    };
    return t;
  }

  function open(nom, version = 1) {
    journal.ouvertures += 1;
    if (pannes.ouvertureLeve) throw erreurNommee("SecurityError", "le navigateur interdit IndexedDB.");
    const ouverture = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    const echouer = (erreur) => {
      ouverture.error = erreur;
      ouverture.onerror?.({ target: ouverture });
    };

    function aboutir(base) {
      const ancienne = base.version;
      let enMontee = version > ancienne;
      let fermee = false;
      const connexion = {
        name: nom,
        get version() {
          return base.version;
        },
        objectStoreNames: { contains: (entrepot) => base.entrepots.has(entrepot) },
        createObjectStore(entrepot, { keyPath = null } = {}) {
          if (!enMontee) throw erreurNommee("InvalidStateError", "hors d'une montée de version.");
          if (base.entrepots.has(entrepot)) throw erreurNommee("ConstraintError", `l'entrepôt « ${entrepot} » existe déjà.`);
          base.entrepots.set(entrepot, { keyPath, lignes: new Map() });
        },
        transaction(noms, acces = "readonly") {
          if (fermee) throw erreurNommee("InvalidStateError", "la connexion est fermée.");
          const liste = Array.isArray(noms) ? noms : [noms];
          if (liste.length !== 1) throw new Error("La simulation ne fait qu'un entrepôt par transaction.");
          return ouvrirTransaction(base, liste[0], acces);
        },
        close() {
          fermee = true;
          base.connexions.delete(connexion);
          for (const reprise of base.enAttente.splice(0)) plusTard(reprise);
        },
        onversionchange: null,
      };
      base.connexions.add(connexion);
      ouverture.result = connexion;
      if (enMontee) {
        base.version = version;
        ouverture.onupgradeneeded?.({ target: ouverture, oldVersion: ancienne, newVersion: version });
      }
      enMontee = false;
      ouverture.onsuccess?.({ target: ouverture });
    }

    plusTard(() => {
      if (pannes.ouvertureEchoue) return echouer(erreurNommee("UnknownError", "la base ne s'ouvre pas."));
      if (!bases.has(nom)) bases.set(nom, { nom, version: 0, entrepots: new Map(), connexions: new Set(), files: new Map(), enAttente: [] });
      const base = bases.get(nom);
      if (version < base.version) return echouer(erreurNommee("VersionError", `la base est à la version ${base.version}.`));
      if (version === base.version || base.connexions.size === 0) return aboutir(base);
      // Une montée, alors que d'autres connexions sont ouvertes : chacune est
      // prévenue ; s'il en reste une, la demande est bloquée, et attend.
      for (const autre of [...base.connexions]) autre.onversionchange?.({ target: autre, oldVersion: base.version, newVersion: version });
      if (base.connexions.size === 0) return aboutir(base);
      ouverture.onblocked?.({ target: ouverture, oldVersion: base.version, newVersion: version });
      const reprendre = () => {
        if (base.connexions.size === 0) aboutir(base);
        else base.enAttente.push(reprendre);
      };
      base.enAttente.push(reprendre);
    });
    return ouverture;
  }

  return {
    open,
    journal,
    pannes,
    /** Ce que garde une base : { entrepôt: { clé: valeur } }, en copie. */
    contenu(nomBase) {
      const base = bases.get(nomBase);
      if (!base) return {};
      return Object.fromEntries([...base.entrepots].map(([nom, entrepot]) => [nom, Object.fromEntries([...entrepot.lignes].map(([cle, valeur]) => [cle, structuredClone(valeur)]))]));
    },
    /** Pose la fabrique à la place de `indexedDB` ; rend de quoi la retirer. */
    installer() {
      const avant = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
      Object.defineProperty(globalThis, "indexedDB", { value: this, configurable: true, writable: true });
      return () => {
        if (avant) Object.defineProperty(globalThis, "indexedDB", avant);
        else delete globalThis.indexedDB;
      };
    },
  };
}
