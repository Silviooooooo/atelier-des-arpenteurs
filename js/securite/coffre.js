// Le coffre de l'appareil (SPECIFICATION.md, § 7.2 et § 8.1).
//
// Il garde, jamais le mot de passe lui-même : la clé de table, non
// extractible, avec le sel qui l'a produite et la durée de sa dérivation ; et
// le jeton GitHub de l'auteur. La clé de la banque réelle et celle de la
// démonstration se gardent séparément : garder ou oublier l'une ne touche
// jamais l'autre.
//
// La logique repose sur un magasin à trois opérations (lire, ecrire,
// effacer). Dans la page, c'est IndexedDB ; dans les contrôles, où Node n'a
// pas d'IndexedDB, une simple table en mémoire.

export const MODES = ["reel", "demo"];

function cleDuMode(mode) {
  if (!MODES.includes(mode)) throw new TypeError(`Mode inconnu : ${mode}`);
  return `cle:${mode}`;
}

/** Le coffre, sur un magasin donné. */
export function creerCoffre(magasin) {
  return {
    /** Le secret gardé pour ce mode : { cle, sel, iterations, duree, gardee_le }, ou null. */
    async lireCle(mode) {
      return (await magasin.lire(cleDuMode(mode))) ?? null;
    },
    async garderCle(mode, { cle, sel, iterations, duree }, date = new Date()) {
      if (cle?.extractable !== false) throw new TypeError("Le coffre ne garde qu'une clé non extractible.");
      await magasin.ecrire(cleDuMode(mode), { cle, sel, iterations, duree, gardee_le: date.toISOString() });
    },
    async oublierCle(mode) {
      await magasin.effacer(cleDuMode(mode));
    },
    async lireJeton() {
      return (await magasin.lire("jeton")) ?? null;
    },
    async garderJeton(jeton) {
      await magasin.ecrire("jeton", jeton);
    },
    async oublierJeton() {
      await magasin.effacer("jeton");
    },
  };
}

/** Un magasin en mémoire : pour les contrôles, et quand IndexedDB manque. */
export function magasinMemoire() {
  const table = new Map();
  return {
    durable: false,
    async lire(cle) {
      return table.get(cle);
    },
    async ecrire(cle, valeur) {
      table.set(cle, valeur);
    },
    async effacer(cle) {
      table.delete(cle);
    },
  };
}

function attendre(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/** Le magasin IndexedDB de la page : une base, un seul entrepôt. */
export async function magasinIndexedDB(nom = "atelier-des-arpenteurs") {
  const ouverture = indexedDB.open(nom, 1);
  ouverture.onupgradeneeded = () => ouverture.result.createObjectStore("coffre");
  const base = await attendre(ouverture);
  const transaction = (acces, faire) =>
    new Promise((resoudre, rejeter) => {
      const t = base.transaction("coffre", acces);
      const requete = faire(t.objectStore("coffre"));
      t.oncomplete = () => resoudre(requete.result);
      t.onerror = () => rejeter(t.error);
      t.onabort = () => rejeter(t.error);
    });
  return {
    durable: true,
    lire: (cle) => transaction("readonly", (entrepot) => entrepot.get(cle)),
    ecrire: (cle, valeur) => transaction("readwrite", (entrepot) => entrepot.put(valeur, cle)),
    effacer: (cle) => transaction("readwrite", (entrepot) => entrepot.delete(cle)),
  };
}

/**
 * Ouvre le coffre de l'appareil. Sans IndexedDB (navigation privée de
 * certains navigateurs), le coffre vit en mémoire le temps de la visite :
 * coffre.durable le dit, pour que la page prévienne.
 */
export async function ouvrirCoffre() {
  let magasin;
  try {
    magasin = await magasinIndexedDB();
  } catch {
    magasin = magasinMemoire();
  }
  return { ...creerCoffre(magasin), durable: magasin.durable };
}
