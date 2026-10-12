// Contrôles de l'IndexedDB simulée (SPECIFICATION.md, § 17 et § 11) : chaque
// propriété sur laquelle s'appuient les contrôles de l'enregistrement d'un
// combat, vue dans les deux sens. Une simulation qui laisserait écrire après
// une attente, ou deux écritures se croiser, rendrait ces contrôles muets.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";
import { simulerStockage } from "./outils/stockage_espion.js";

const attendre = (requete) =>
  new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
const finDe = (t) =>
  new Promise((resoudre, rejeter) => {
    t.oncomplete = () => resoudre("finie");
    t.onabort = () => rejeter(t.error ?? new Error("abandonnée"));
  });
const tours = (n = 5) => new Promise((resoudre) => setTimeout(resoudre, n));

// Une base à un entrepôt « combats », à clé en ligne, comme celle du combat.
async function ouvrir(fabrique, { nom = "essai", version = 1, creer = (base) => base.createObjectStore("combats", { keyPath: "mode" }) } = {}) {
  const ouverture = fabrique.open(nom, version);
  ouverture.onupgradeneeded = () => creer(ouverture.result);
  return attendre(ouverture);
}
const ecrire = (base, valeur) => {
  const t = base.transaction("combats", "readwrite");
  t.objectStore("combats").put(valeur);
  return finDe(t);
};
const lire = (base, cle) => {
  const t = base.transaction("combats", "readonly");
  const requete = t.objectStore("combats").get(cle);
  return finDe(t).then(() => requete.result);
};

test("ouverture — la création passe par onupgradeneeded, une fois ; l'entrepôt ne se crée que pendant la montée", async () => {
  const fabrique = fabriqueIndexedDB();
  const montees = [];
  const ouverture = fabrique.open("essai", 1);
  ouverture.onupgradeneeded = (evenement) => {
    montees.push([evenement.oldVersion, evenement.newVersion]);
    assert.equal(ouverture.result.objectStoreNames.contains("combats"), false);
    ouverture.result.createObjectStore("combats", { keyPath: "mode" });
    assert.throws(() => ouverture.result.createObjectStore("combats", { keyPath: "mode" }), { name: "ConstraintError" });
  };
  const base = await attendre(ouverture);
  assert.deepEqual(montees, [[0, 1]]);
  assert.equal(base.version, 1);
  assert.equal(base.objectStoreNames.contains("combats"), true);
  assert.equal(base.objectStoreNames.contains("autre"), false);
  assert.throws(() => base.createObjectStore("apres", {}), { name: "InvalidStateError" });

  // Une seconde connexion à la même version : aucune montée.
  const seconde = fabrique.open("essai", 1);
  let remontee = false;
  seconde.onupgradeneeded = () => (remontee = true);
  await attendre(seconde);
  assert.equal(remontee, false);
  assert.equal(fabrique.journal.ouvertures, 2);
  // Une version plus ancienne que la base : la demande échoue.
  await assert.rejects(attendre(fabrique.open("essai", 0)), { name: "VersionError" });
});

test("ouverture — rien n'aboutit dans le tour de la demande : les rappels se posent après open()", async () => {
  const fabrique = fabriqueIndexedDB();
  const ouverture = fabrique.open("essai", 1);
  assert.equal(ouverture.result, undefined);
  ouverture.onupgradeneeded = () => ouverture.result.createObjectStore("combats", { keyPath: "mode" });
  assert.equal((await attendre(ouverture)).name, "essai");
});

test("valeurs — clonées à l'écriture et à la lecture ; la clé vient de la valeur ; get d'une clé absente rend undefined", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);
  const valeur = { mode: "demo", liste: [1, 2] };
  await ecrire(base, valeur);
  valeur.liste.push(3);
  const lue = await lire(base, "demo");
  assert.deepEqual(lue, { mode: "demo", liste: [1, 2] });
  lue.liste.push(9);
  assert.deepEqual(await lire(base, "demo"), { mode: "demo", liste: [1, 2] });
  assert.equal(await lire(base, "reel"), undefined);

  // Sans clé dans la valeur, ou avec une valeur qui ne se clone pas : refus.
  const t = base.transaction("combats", "readwrite");
  assert.throws(() => t.objectStore("combats").put({ sans: "clé" }), { name: "DataError" });
  assert.throws(() => t.objectStore("combats").put({ mode: "demo", f: () => {} }), { name: "DataCloneError" });
  await finDe(t);

  // delete retire ; une clé hors ligne se donne à part.
  const autre = await ouvrir(fabrique, { nom: "hors-ligne", creer: (b) => b.createObjectStore("combats") });
  const u = autre.transaction("combats", "readwrite");
  u.objectStore("combats").put({ a: 1 }, "k");
  await finDe(u);
  assert.deepEqual(await lire(autre, "k"), { a: 1 });
  const v = autre.transaction("combats", "readwrite");
  v.objectStore("combats").delete("k");
  await finDe(v);
  assert.equal(await lire(autre, "k"), undefined);
});

test("transaction — entrepôt inconnu, accès inconnu, écriture en lecture seule, connexion fermée", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);
  assert.throws(() => base.transaction("ailleurs", "readonly"), { name: "NotFoundError" });
  assert.throws(() => base.transaction("combats", "versionchange"), TypeError);
  const t = base.transaction("combats");
  assert.throws(() => t.objectStore("ailleurs"), { name: "NotFoundError" });
  assert.throws(() => t.objectStore("combats").put({ mode: "demo" }), { name: "ReadOnlyError" });
  assert.throws(() => t.objectStore("combats").delete("demo"), { name: "ReadOnlyError" });
  await finDe(t);
  assert.throws(() => t.objectStore("combats"), { name: "InvalidStateError" });
  assert.throws(() => t.abort(), { name: "InvalidStateError" });
  base.close();
  assert.throws(() => base.transaction("combats", "readonly"), { name: "InvalidStateError" });
});

test("transaction inactive — active dans son tour de création et dans un rappel ; plus après une attente", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);

  // Dans le tour de création : plusieurs demandes passent.
  const t = base.transaction("combats", "readwrite");
  const entrepot = t.objectStore("combats");
  entrepot.put({ mode: "demo", revision: 1 });
  const lecture = entrepot.get("demo");
  // Dans le rappel d'une demande : on écrit encore.
  lecture.onsuccess = () => entrepot.put({ mode: "demo", revision: lecture.result.revision + 1 });
  await finDe(t);
  assert.equal((await lire(base, "demo")).revision, 2);
  // Finie, elle ne prend plus rien.
  assert.throws(() => entrepot.get("demo"), { name: "TransactionInactiveError" });

  // Après une attente, même d'une promesse déjà tenue : inactive. C'est le
  // piège d'un chiffrement fait dans la transaction.
  const u = base.transaction("combats", "readwrite");
  const magasin = u.objectStore("combats");
  const fin = finDe(u);
  await Promise.resolve();
  assert.throws(() => magasin.put({ mode: "demo", revision: 99 }), { name: "TransactionInactiveError" });
  assert.throws(() => magasin.get("demo"), { name: "TransactionInactiveError" });
  assert.throws(() => magasin.delete("demo"), { name: "TransactionInactiveError" });
  assert.equal(await fin, "finie");
  assert.equal((await lire(base, "demo")).revision, 2);

  // Hors du rappel d'une demande, après lui : inactive aussi.
  const v = base.transaction("combats", "readwrite");
  const tardif = v.objectStore("combats");
  const lue = await attendre(tardif.get("demo"));
  assert.equal(lue.revision, 2);
  assert.throws(() => tardif.put({ mode: "demo", revision: 3 }), { name: "TransactionInactiveError" });
});

test("file — une écriture attend celle qui la précède, d'une connexion à l'autre : lire puis écrire ne se croisent pas", async () => {
  const fabrique = fabriqueIndexedDB();
  const a = await ouvrir(fabrique);
  const b = await ouvrir(fabrique);
  await ecrire(a, { mode: "demo", compte: 0 });
  const ordre = [];
  // Chaque « onglet » lit le compte, puis l'augmente, dans une transaction.
  const augmenter = (base, nom) => {
    const t = base.transaction("combats", "readwrite");
    const entrepot = t.objectStore("combats");
    const lecture = entrepot.get("demo");
    lecture.onsuccess = () => {
      ordre.push(`${nom} lit ${lecture.result.compte}`);
      entrepot.put({ mode: "demo", compte: lecture.result.compte + 1 });
    };
    return finDe(t).then(() => ordre.push(`${nom} a fini`));
  };
  await Promise.all([augmenter(a, "A"), augmenter(b, "B"), augmenter(a, "A2")]);
  assert.deepEqual(ordre, ["A lit 0", "A a fini", "B lit 1", "B a fini", "A2 lit 2", "A2 a fini"]);
  assert.equal((await lire(a, "demo")).compte, 3);

  // En deux transactions (lire, puis écrire), les onglets se croisent : la
  // simulation le montre, c'est ce que la transaction unique évite.
  const naif = async (base) => {
    const lu = await lire(base, "demo");
    await ecrire(base, { mode: "demo", compte: lu.compte + 1 });
  };
  await Promise.all([naif(a), naif(b)]);
  assert.equal((await lire(a, "demo")).compte, 4, "deux augmentations, une seule gardée");
});

test("file — une lecture demandée après une écriture la voit ; deux lectures passent ensemble", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);
  const ecriture = ecrire(base, { mode: "demo", revision: 7 });
  const lecture = lire(base, "demo");
  assert.equal((await lecture).revision, 7);
  await ecriture;

  const ordre = [];
  const t1 = base.transaction("combats", "readonly");
  const t2 = base.transaction("combats", "readonly");
  const r1 = t1.objectStore("combats").get("demo");
  r1.onsuccess = () => {
    ordre.push("1 lit");
    t1.objectStore("combats").get("demo").onsuccess = () => ordre.push("1 relit");
  };
  t2.objectStore("combats").get("demo").onsuccess = () => ordre.push("2 lit");
  await Promise.all([finDe(t1), finDe(t2)]);
  assert.deepEqual(ordre, ["1 lit", "2 lit", "1 relit"]);
});

test("abandon — abort() défait les écritures de la transaction, et libère la file", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);
  await ecrire(base, { mode: "demo", revision: 1 });
  const t = base.transaction("combats", "readwrite");
  const entrepot = t.objectStore("combats");
  entrepot.put({ mode: "demo", revision: 2 }).onsuccess = () => t.abort();
  let finie = false;
  t.oncomplete = () => (finie = true);
  await new Promise((resoudre) => (t.onabort = resoudre));
  assert.equal(finie, false);
  assert.equal((await lire(base, "demo")).revision, 1);
  await ecrire(base, { mode: "demo", revision: 3 });
  assert.equal((await lire(base, "demo")).revision, 3);
});

test("pannes — l'écriture refusée remonte à la demande, à la transaction, puis l'abandonne ; désarmée, elle passe", async () => {
  const fabrique = fabriqueIndexedDB();
  const base = await ouvrir(fabrique);
  await ecrire(base, { mode: "demo", revision: 1 });
  fabrique.pannes.ecritureEchoue = true;
  const t = base.transaction("combats", "readwrite");
  const vus = [];
  const requete = t.objectStore("combats").put({ mode: "demo", revision: 2 });
  requete.onerror = () => vus.push(`demande : ${requete.error.name}`);
  t.onerror = () => vus.push("transaction : erreur");
  t.oncomplete = () => vus.push("finie");
  await new Promise((resoudre) => (t.onabort = resoudre));
  vus.push(`abandonnée : ${t.error.name}`);
  assert.deepEqual(vus, ["demande : QuotaExceededError", "transaction : erreur", "abandonnée : QuotaExceededError"]);
  assert.equal((await lire(base, "demo")).revision, 1);
  fabrique.pannes.ecritureEchoue = false;
  await ecrire(base, { mode: "demo", revision: 2 });
  assert.equal((await lire(base, "demo")).revision, 2);
});

test("pannes — l'ouverture qui lève, celle qui échoue ; désarmées, elle aboutit", async () => {
  const fabrique = fabriqueIndexedDB();
  fabrique.pannes.ouvertureLeve = true;
  assert.throws(() => fabrique.open("essai", 1), { name: "SecurityError" });
  fabrique.pannes.ouvertureLeve = false;
  fabrique.pannes.ouvertureEchoue = true;
  await assert.rejects(attendre(fabrique.open("essai", 1)), { name: "UnknownError" });
  fabrique.pannes.ouvertureEchoue = false;
  assert.equal((await ouvrir(fabrique)).version, 1);
  assert.equal(fabrique.journal.ouvertures, 3);
});

test("montée — une connexion ouverte est prévenue ; si elle reste, la demande est bloquée jusqu'à sa fermeture", async () => {
  const fabrique = fabriqueIndexedDB();
  const ancienne = await ouvrir(fabrique);
  const vus = [];
  ancienne.onversionchange = (evenement) => vus.push(`prévenue : ${evenement.oldVersion} → ${evenement.newVersion}`);
  const montee = fabrique.open("essai", 2);
  montee.onblocked = () => vus.push("bloquée");
  montee.onupgradeneeded = () => vus.push("montée");
  const aboutie = attendre(montee);
  await tours();
  assert.deepEqual(vus, ["prévenue : 1 → 2", "bloquée"]);
  ancienne.close();
  assert.equal((await aboutie).version, 2);
  assert.deepEqual(vus, ["prévenue : 1 → 2", "bloquée", "montée"]);

  // Une connexion qui se ferme quand on la prévient ne bloque rien.
  const polie = await ouvrir(fabrique, { version: 2 });
  polie.onversionchange = () => polie.close();
  // Le rappel reçoit aussi la connexion par son événement.
  (await aboutie).onversionchange = (evenement) => evenement.target.close();
  const suivante = fabrique.open("essai", 3);
  let bloquee = false;
  suivante.onblocked = () => (bloquee = true);
  assert.equal((await attendre(suivante)).version, 3);
  assert.equal(bloquee, false);
});

test("journal — les transactions et les écritures se notent ; le contenu se lit en copie", async () => {
  const fabrique = fabriqueIndexedDB();
  assert.deepEqual(fabrique.contenu("essai"), {});
  const base = await ouvrir(fabrique);
  assert.deepEqual(fabrique.contenu("essai"), { combats: {} });
  await ecrire(base, { mode: "demo", revision: 1 });
  await lire(base, "demo");
  assert.deepEqual(fabrique.journal.transactions, [
    { base: "essai", entrepot: "combats", acces: "readwrite" },
    { base: "essai", entrepot: "combats", acces: "readonly" },
  ]);
  assert.deepEqual(fabrique.journal.ecritures, [{ base: "essai", entrepot: "combats", cle: "demo", valeur: { mode: "demo", revision: 1 } }]);
  const contenu = fabrique.contenu("essai");
  contenu.combats.demo.revision = 50;
  assert.equal(fabrique.contenu("essai").combats.demo.revision, 1);
  // Une écriture abandonnée reste au journal des écritures tentées, pas dans le contenu.
  const t = base.transaction("combats", "readwrite");
  t.objectStore("combats").put({ mode: "reel", revision: 1 }).onsuccess = () => t.abort();
  await new Promise((resoudre) => (t.onabort = resoudre));
  assert.equal(fabrique.journal.ecritures.length, 2);
  assert.deepEqual(Object.keys(fabrique.contenu("essai").combats), ["demo"]);
});

test("installer — pose la fabrique à la place d'indexedDB, puis la retire", async () => {
  assert.equal(typeof globalThis.indexedDB, "undefined");
  const fabrique = fabriqueIndexedDB();
  const retirer = fabrique.installer();
  assert.equal(globalThis.indexedDB, fabrique);
  retirer();
  assert.equal(typeof globalThis.indexedDB, "undefined");
});

test("espion — localStorage et sessionStorage notent ce qui se lit et s'écrit ; les ouvertures se comptent, avec ou sans fabrique", async () => {
  assert.equal(typeof globalThis.localStorage, "undefined");
  const journal = simulerStockage({ theme: "sombre" });
  try {
    assert.equal(localStorage.getItem("theme"), "sombre");
    assert.equal(localStorage.getItem("absent"), null);
    sessionStorage.setItem("note", 3);
    assert.equal(localStorage.getItem("note"), "3");
    assert.deepEqual(journal.lus, ["theme", "absent", "note"]);
    assert.deepEqual(journal.ecrits, [["note", 3]]);
    // Sans fabrique : un bouchon, dont rien ne s'ouvre.
    assert.deepEqual(indexedDB.open("essai", 1), {});
    assert.equal(journal.ouvertures, 1);
  } finally {
    journal.retirer();
  }
  assert.equal(typeof globalThis.localStorage, "undefined");
  assert.equal(typeof globalThis.sessionStorage, "undefined");
  assert.equal(typeof globalThis.indexedDB, "undefined");

  const fabrique = fabriqueIndexedDB();
  const avec = simulerStockage({}, { indexedDB: fabrique });
  try {
    const ouverture = indexedDB.open("essai", 1);
    ouverture.onupgradeneeded = () => ouverture.result.createObjectStore("combats", { keyPath: "mode" });
    const base = await attendre(ouverture);
    await ecrire(base, { mode: "demo", revision: 1 });
    assert.equal(avec.ouvertures, 1);
    assert.deepEqual(avec.lus, []);
    assert.deepEqual(avec.ecrits, []);
    assert.equal(fabrique.contenu("essai").combats.demo.revision, 1);
  } finally {
    avec.retirer();
  }
  assert.equal(typeof globalThis.indexedDB, "undefined");
});
