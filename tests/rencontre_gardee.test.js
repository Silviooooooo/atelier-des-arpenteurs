// Contrôles de la rencontre gardée (SPECIFICATION.md, § 16.6 et § 7.2 ;
// contrat du lot 4, groupe 2, § 12.1) : l'aller-retour et l'enveloppe
// exacte, le mode à part, chaque borne de la relecture, la clé changée, la
// donnée abîmée, ce que l'écriture refuse, les magasins par mode, rien
// d'ouvert à l'import, et la garde à file d'une place. La base est une
// IndexedDB simulée ; les clés se fabriquent à l'exécution, sans mot de passe.

import { test as controle } from "node:test";
import assert from "node:assert/strict";
import { ITERATIONS, ITERATIONS_MAX, tirerSel, versBase64 } from "../js/securite/chiffrement.js";
import {
  FORMAT_RENCONTRE,
  NOM_BASE_RENCONTRE,
  NOM_MAX,
  PLAFOND_CARTES,
  PLAFOND_EXEMPLAIRES,
  chiffrerRencontre,
  creerGardeRencontre,
  dechiffrerRencontre,
  lireEntrees,
  magasinRencontreIndexedDB,
  magasinRencontreMemoire,
  ouvrirMagasinRencontre,
} from "../js/adversaire/rencontre_gardee.js";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";
import { simulerStockage } from "./outils/stockage_espion.js";

// Une base, une transaction ou une file qui n'aboutit jamais ne doit pas
// laisser un contrôle attendre sans fin : au bout de trente secondes, il
// échoue. Là où l'on sait qu'une casse ferait attendre, l'attente est bornée
// de près.
const test = (titre, corps) => controle(titre, { timeout: 30_000 }, corps);
function borner(promesse, quoi, delai = 5000) {
  let minuterie;
  const limite = new Promise((_, rejeter) => {
    minuterie = setTimeout(() => rejeter(new Error(`${quoi} : rien après ${delai} ms`)), delai);
  });
  return Promise.race([promesse, limite]).finally(() => clearTimeout(minuterie));
}
const tour = () => new Promise((suite) => setTimeout(suite, 0));
async function attendreQue(condition, quoi) {
  await borner(
    (async () => {
      while (!condition()) await tour();
    })(),
    quoi,
  );
}

const CHAMPS = ["mode", "format", "sel", "iterations", "iv", "chiffre", "enregistre_le"];
const EXPORTS = [
  "FORMAT_RENCONTRE",
  "NOM_BASE_RENCONTRE",
  "NOM_MAX",
  "PLAFOND_CARTES",
  "PLAFOND_EXEMPLAIRES",
  "chiffrerRencontre",
  "creerGardeRencontre",
  "dechiffrerRencontre",
  "lireEntrees",
  "magasinRencontreIndexedDB",
  "magasinRencontreMemoire",
  "ouvrirMagasinRencontre",
];
const MAINTENANT = new Date("2026-10-25T08:00:00.000Z");
// La plus longue enveloppe lue : 128 Ko de clair et l'étiquette, en base64.
const SIGNES_CHIFFRE_MAX = 4 * Math.ceil((128 * 1024 + 16) / 3);

// Une clé AES-GCM non extractible, tirée à l'exécution, avec un sel et des
// itérations : la forme d'un secret de table, sans dérivation.
async function secretNeuf({ sel = tirerSel(), iterations = ITERATIONS } = {}) {
  const cle = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { cle, sel, iterations };
}
const SECRET = await secretNeuf();
const AUTRE_SEL = await secretNeuf();
const MEME_SEL_AUTRE_CLE = await secretNeuf({ sel: SECRET.sel, iterations: SECRET.iterations });
const AUTRES_ITERATIONS = { ...SECRET, iterations: SECRET.iterations + 1 };

// Les compositions d'essai, de la démonstration et des noms d'essai permis.
const D1 = [{ nom: "Chef de partie", nombre: 1 }];
const D2 = [
  { nom: "Chef de partie", nombre: 1 },
  { nom: "Marmiton de corvée", nombre: 2 },
];
const D3 = [
  { nom: "Marmiton de corvée", nombre: 12 },
  { nom: "Mouette chapardeuse", nombre: 3 },
  { nom: "Marmiton de corvée bis", nombre: 1 },
];
const NOMS = ["Chef de partie", "Marmiton de corvée", "Mouette chapardeuse", "Marmiton de corvée bis"];
const marmitons = (combien, nombre = 1) => Array.from({ length: combien }, (_, rang) => ({ nom: `Marmiton n° ${rang + 1}`, nombre }));
// Un signe hors du plan de base : deux unités UTF-16, un seul signe.
const ASTRAL = "\u{1F37D}";
const douzes = (combien) => Array.from({ length: combien }, (_, rang) => ({ nom: `Chef de partie ${rang + 1}`, nombre: 12 }));

// Chaque borne de la relecture, des deux côtés.
const ACCEPTEES = [
  ["une composition vide", []],
  ["60 entrées", marmitons(60)],
  ["un nom d'un signe", [{ nom: "A", nombre: 1 }]],
  ["un nom de 200 signes", [{ nom: "a".repeat(200), nombre: 1 }]],
  ["un nom de 200 signes astraux", [{ nom: ASTRAL.repeat(200), nombre: 1 }]],
  ["les nombres 1 et 12", [{ nom: "Chef de partie", nombre: 1 }, { nom: "Marmiton de corvée", nombre: 12 }]],
  ["60 cartes en tout", douzes(5)],
  ["des noms qui sont aussi des clés d'objet", ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"].map((nom) => ({ nom, nombre: 1 }))],
  ["deux noms qui ne diffèrent que d'une espace", [{ nom: "Chef de partie", nombre: 1 }, { nom: "Chef de partie ", nombre: 1 }]],
];
const REFUSEES = [
  ["61 entrées", marmitons(61)],
  ["un nom vide", [{ nom: "", nombre: 1 }]],
  ["un nom de 201 signes", [{ nom: "a".repeat(201), nombre: 1 }]],
  ["un nom de 201 signes astraux", [{ nom: ASTRAL.repeat(201), nombre: 1 }]],
  ["un nom qui n'est pas un texte", [{ nom: 5, nombre: 1 }]],
  ["le nombre 0", [{ nom: "Chef de partie", nombre: 0 }]],
  ["le nombre 13", [{ nom: "Chef de partie", nombre: 13 }]],
  ["le nombre 1,5", [{ nom: "Chef de partie", nombre: 1.5 }]],
  ["le nombre « 2 »", [{ nom: "Chef de partie", nombre: "2" }]],
  ["le nombre -1", [{ nom: "Chef de partie", nombre: -1 }]],
  ["un nombre nul", [{ nom: "Chef de partie", nombre: null }]],
  ["61 cartes en tout", [...douzes(5), { nom: "Marmiton de corvée", nombre: 1 }]],
  ["un nom répété", [{ nom: "Chef de partie", nombre: 1 }, { nom: "Marmiton de corvée", nombre: 1 }, { nom: "Chef de partie", nombre: 2 }]],
  ["un nom d'objet répété", [{ nom: "constructor", nombre: 1 }, { nom: "constructor", nombre: 1 }]],
  ["une clé « __proto__ »", JSON.parse('[{"nom":"Chef de partie","nombre":1,"__proto__":{}}]')],
  ["une clé « __proto__ » à la place d'une autre", JSON.parse('[{"nom":"Chef de partie","__proto__":1}]')],
  ["une clé de trop", [{ nom: "Chef de partie", nombre: 1, carte: true }]],
  ["une clé qui manque", [{ nom: "Chef de partie" }]],
  ["une entrée en tableau", [["Chef de partie", 1]]],
  ["une entrée nulle", [null]],
  ["un objet au lieu d'un tableau", { nom: "Chef de partie", nombre: 1 }],
  ["un texte", "Chef de partie"],
  ["null", null],
];

const chiffrer = (entrees = D2, options = {}) => chiffrerRencontre(entrees, SECRET, { mode: "demo", maintenant: MAINTENANT, ...options });
const lire = (enveloppe, secret = SECRET, mode = "demo") => dechiffrerRencontre(enveloppe, secret, { mode });

// Une enveloppe scellée à la main, avec la bonne clé et la donnée associée
// que le contrat écrit : ce que seul le possesseur de la clé pourrait
// poser, mais dont le clair n'est pas forcément une composition.
const DONNEE_ASSOCIEE = (mode) => new TextEncoder().encode(`atelier-des-arpenteurs/rencontre/1/${mode}`);
async function sceller(clair, { secret = SECRET, mode = "demo" } = {}) {
  const octetsClairs = typeof clair === "string" ? new TextEncoder().encode(clair) : clair;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: DONNEE_ASSOCIEE(mode) }, secret.cle, octetsClairs));
  return { mode, format: 1, sel: secret.sel, iterations: secret.iterations, iv: versBase64(iv), chiffre: versBase64(chiffre), enregistre_le: MAINTENANT.toISOString() };
}
const deBase64 = (texte) => Buffer.from(texte, "base64");
const ecart = async (promesse) => (await promesse).ecart;

// ─── Le chiffrement ─────────────────────────────────────────────────────────

test("chiffrement — l'aller-retour : l'enveloppe exacte, sept clés dans leur ordre, ni nom ni nombre en clair", async () => {
  assert.equal(FORMAT_RENCONTRE, 1);
  const e = await chiffrer(D3);
  assert.deepEqual(Object.keys(e), CHAMPS);
  assert.deepEqual(
    { mode: e.mode, format: e.format, sel: e.sel, iterations: e.iterations, enregistre_le: e.enregistre_le },
    { mode: "demo", format: 1, sel: SECRET.sel, iterations: SECRET.iterations, enregistre_le: "2026-10-25T08:00:00.000Z" },
  );
  assert.match(e.iv, /^[A-Za-z0-9+/]{16}$/, "un vecteur de 12 octets, en base64");
  assert.match(e.chiffre, /^[A-Za-z0-9+/]+={0,2}$/);
  // Sans compression : le clair et l'étiquette de 16 octets.
  assert.equal(deBase64(e.chiffre).length, new TextEncoder().encode(JSON.stringify(D3)).length + 16);
  // Ni nom ni nombre, ni dans le JSON de l'enveloppe, ni sous son base64.
  const texte = JSON.stringify(e);
  const dessous = deBase64(e.chiffre).toString("latin1") + deBase64(e.chiffre).toString("utf8");
  for (const fuite of [...NOMS, "Marmiton", '"nom', "nombre"]) {
    assert.ok(!texte.includes(fuite), `« ${fuite} » dans l'enveloppe`);
    assert.ok(!dessous.includes(fuite), `« ${fuite} » sous le base64`);
  }
  for (const champ of ["sel", "iv", "chiffre"]) assert.match(e[champ], /^[A-Za-z0-9+/=]+$/, champ);
  // La base la garde telle quelle : que des textes et des nombres.
  assert.deepEqual(structuredClone(e), e);
  assert.deepEqual(JSON.parse(texte), e);

  const relue = await lire(JSON.parse(texte));
  assert.deepEqual(relue, { entrees: D3, ecart: null });
  assert.notEqual(relue.entrees[0], D3[0], "une copie neuve");
  // Les deux modes se chiffrent, chacun lu sous le sien.
  const reel = await chiffrer(D1, { mode: "reel" });
  assert.equal(reel.mode, "reel");
  assert.deepEqual(await lire(reel, SECRET, "reel"), { entrees: D1, ecart: null });
  // Un vecteur neuf à chaque écriture : deux chiffrés de la même composition diffèrent.
  const second = await chiffrer(D3);
  assert.notEqual(second.iv, e.iv);
  assert.notEqual(second.chiffre, e.chiffre);
  // La date par défaut est celle de l'instant.
  const avant = Date.now();
  const date = Date.parse((await chiffrerRencontre(D1, SECRET, { mode: "demo" })).enregistre_le);
  assert.ok(date >= avant && date <= Date.now());
  // La composition vide se garde aussi.
  assert.deepEqual(await lire(await chiffrer([])), { entrees: [], ecart: null });
});

test("chiffrement — l'enveloppe d'un mode ne se lit pas sous l'autre : sa forme le dit, et recopiée, elle ne se déchiffre pas", async () => {
  const demo = await chiffrer(D2);
  assert.equal(await ecart(lire(demo, SECRET, "reel")), "forme");
  // Recopiée sous l'autre mode, la forme passe : la donnée associée l'arrête.
  assert.equal(await ecart(lire({ ...demo, mode: "reel" }, SECRET, "reel")), "dechiffrement");
  const reel = await chiffrer(D2, { mode: "reel" });
  assert.equal(await ecart(lire({ ...reel, mode: "demo" }, SECRET, "demo")), "dechiffrement");
  // La donnée associée est celle que le contrat écrit, mode compris.
  for (const mode of ["demo", "reel"]) {
    assert.deepEqual(await lire(await sceller(JSON.stringify(D2), { mode }), SECRET, mode), { entrees: D2, ecart: null });
  }
  assert.equal(await ecart(lire({ ...(await sceller(JSON.stringify(D2), { mode: "reel" })), mode: "demo" })), "dechiffrement");
});

// ─── La relecture ───────────────────────────────────────────────────────────

test("relecture — les plafonds et la borne du nom : 12, 60, 200 signes", () => {
  assert.deepEqual([PLAFOND_EXEMPLAIRES, PLAFOND_CARTES, NOM_MAX], [12, 60, 200]);
});

test("relecture — chaque borne de lireEntrees, des deux côtés ; une copie neuve ; aucun nom n'est une clé d'objet", () => {
  for (const [quoi, valeur] of ACCEPTEES) {
    const lue = lireEntrees(valeur);
    assert.deepEqual(lue, valeur, quoi);
    assert.notEqual(lue, valeur, `${quoi} : un tableau neuf`);
    lue.forEach((entree, rang) => {
      assert.notEqual(entree, valeur[rang], `${quoi} : une entrée neuve`);
      assert.deepEqual(Object.keys(entree), ["nom", "nombre"], quoi);
    });
  }
  for (const [quoi, valeur] of REFUSEES) assert.equal(lireEntrees(valeur), null, quoi);
  // Les cas limites, nommés : 200 signes astraux font 400 unités UTF-16.
  assert.equal(ASTRAL.repeat(200).length, 400);
  assert.equal([...ASTRAL.repeat(200)].length, 200);
  // Rien d'autre qu'un tableau : un objet qui en a l'air, des valeurs simples.
  for (const valeur of [undefined, 3, true, {}, { length: 1, 0: { nom: "Chef de partie", nombre: 1 } }]) assert.equal(lireEntrees(valeur), null);
  for (const nombre of [Number.NaN, Number.POSITIVE_INFINITY, true, 12.000001, 0.5]) {
    assert.equal(lireEntrees([{ nom: "Chef de partie", nombre }]), null, String(nombre));
  }
  // La copie ne lie rien : changer ce qui est rendu ne change pas ce qui est lu.
  const source = [{ nom: "Chef de partie", nombre: 2 }];
  const copie = lireEntrees(source);
  copie[0].nombre = 9;
  copie.push({ nom: "Marmiton de corvée", nombre: 1 });
  assert.deepEqual(source, [{ nom: "Chef de partie", nombre: 2 }]);
});

test("relecture — plus de 60 entrées : refusé sans en lire aucune ; un objet hostile rend null sans lever", () => {
  const lus = [];
  const espion = (tableau) =>
    new Proxy(tableau, {
      get(cible, cle, recepteur) {
        if (typeof cle === "string" && /^\d+$/.test(cle)) lus.push(cle);
        return Reflect.get(cible, cle, recepteur);
      },
    });
  assert.equal(lireEntrees(espion(marmitons(61))), null);
  assert.deepEqual(lus, [], "la longueur passe avant les entrées");
  assert.equal(lireEntrees(espion(marmitons(60))).length, 60);
  assert.equal(lus.length, 60, "à 60, chaque entrée est lue une fois");
  assert.equal(lireEntrees(new Array(1_000_000)), null);
  // Une entrée dont la lecture lève, un objet dont les clés lèvent.
  const piege = { nom: "Chef de partie" };
  Object.defineProperty(piege, "nombre", { enumerable: true, get() { throw new Error("piège"); } });
  assert.equal(lireEntrees([piege]), null);
  const hostile = new Proxy({}, { ownKeys() { throw new Error("piège"); } });
  assert.equal(lireEntrees([hostile]), null);
  assert.equal(lireEntrees(new Proxy([], { get() { throw new Error("piège"); } })), null);
});

test("relecture — la même à l'écriture et à la lecture : ce qu'elle refuse ne s'écrit pas et ne se relit pas", async () => {
  for (const [quoi, valeur] of ACCEPTEES) {
    assert.deepEqual(await lire(await chiffrer(valeur)), { entrees: valeur, ecart: null }, quoi);
    assert.deepEqual(await lire(await sceller(JSON.stringify(valeur))), { entrees: valeur, ecart: null }, `${quoi}, scellée à la main`);
  }
  for (const [quoi, valeur] of REFUSEES) {
    const refus = await chiffrer(valeur);
    assert.deepEqual(Object.keys(refus), ["erreur", "code"], quoi);
    assert.equal(refus.code, "invalide", quoi);
    assert.equal(typeof refus.erreur, "string", quoi);
    assert.deepEqual(await lire(await sceller(JSON.stringify(valeur))), { entrees: [], ecart: "contenu" }, `${quoi}, scellée à la main`);
  }
});

// ─── Le déchiffrement ───────────────────────────────────────────────────────

test("déchiffrement — autre sel : cle ; autres itérations : cle ; autre clé : dechiffrement ; pas de secret : cle", async () => {
  const e = await chiffrer(D2);
  assert.deepEqual(await lire(e, AUTRE_SEL), { entrees: [], ecart: "cle" });
  assert.deepEqual(await lire(e, AUTRES_ITERATIONS), { entrees: [], ecart: "cle" });
  assert.deepEqual(await lire(e, MEME_SEL_AUTRE_CLE), { entrees: [], ecart: "dechiffrement" });
  for (const secret of [null, undefined, {}, { cle: null, sel: SECRET.sel, iterations: SECRET.iterations }, { sel: SECRET.sel, iterations: SECRET.iterations }]) {
    // Appelé tel quel : l'aide « lire » prendrait le secret d'essai à la place d'undefined.
    assert.deepEqual(await dechiffrerRencontre(e, secret, { mode: "demo" }), { entrees: [], ecart: "cle" }, JSON.stringify(secret) ?? "undefined");
  }
  const hostile = new Proxy({}, { get() { throw new Error("piège"); } });
  assert.deepEqual(await lire(e, hostile), { entrees: [], ecart: "cle" });
  // Un chiffré retouché d'un octet ne se déchiffre pas.
  const octets = deBase64(e.chiffre);
  octets[3] ^= 1;
  assert.equal(await ecart(lire({ ...e, chiffre: octets.toString("base64") })), "dechiffrement");
  // Une clé qui ne déchiffre pas, à ce sel et à ces itérations.
  assert.equal(await ecart(lire(e, { cle: true, sel: SECRET.sel, iterations: SECRET.iterations })), "dechiffrement");
});

test("déchiffrement — absente, forme, contenu ; rien ne lève, si long ou si mal fait que soit ce qu'on lui donne", async () => {
  const e = await chiffrer(D2);
  for (const rien of [null, undefined]) assert.deepEqual(await lire(rien), { entrees: [], ecart: "absente" });
  const sansCle = Object.fromEntries(Object.entries(e).filter(([champ]) => champ !== "enregistre_le"));
  // La date n'est jugée que par sa forme, celle de toISOString : Date.parse
  // lit ce texte de dix millions de signes et plus, un commentaire entre
  // parenthèses lui étant permis (relecture du groupe 2, C-23).
  const dateDemesuree = `Oct 25 2026 (${"x".repeat(10_000_000)})`;
  assert.equal(Number.isNaN(Date.parse(dateDemesuree)), false, "Date.parse la lit");
  const formes = [
    ["un texte", "enveloppe"],
    ["un nombre", 3],
    ["un tableau", [e]],
    ["une clé de trop", { ...e, revision: 1 }],
    ["une clé qui manque", sansCle],
    ["une clé remplacée", { ...sansCle, revision: e.enregistre_le }],
    ["le format 2", { ...e, format: 2 }],
    ["le format « 1 »", { ...e, format: "1" }],
    ["un mode inconnu", { ...e, mode: "autre" }],
    ["des itérations nulles", { ...e, iterations: 0 }],
    ["des itérations au-delà de leur borne", { ...e, iterations: ITERATIONS_MAX + 1 }],
    ["des itérations décimales", { ...e, iterations: 1.5 }],
    ["des itérations écrites", { ...e, iterations: String(e.iterations) }],
    ["un sel de 15 octets", { ...e, sel: versBase64(new Uint8Array(15)) }],
    ["un sel de 17 octets", { ...e, sel: versBase64(new Uint8Array(17)) }],
    ["un sel qui n'est pas du base64", { ...e, sel: "*".repeat(24) }],
    ["un vecteur de 11 octets", { ...e, iv: versBase64(new Uint8Array(11)) }],
    ["un vecteur de 13 octets", { ...e, iv: versBase64(new Uint8Array(13)) }],
    ["un vecteur vide", { ...e, iv: "" }],
    ["un chiffré de 16 octets, l'étiquette seule", { ...e, chiffre: versBase64(new Uint8Array(16)) }],
    ["un chiffré de 200 000 signes", { ...e, chiffre: "A".repeat(200_000) }],
    ["un chiffré d'un paquet de trop", { ...e, chiffre: "A".repeat(SIGNES_CHIFFRE_MAX + 4) }],
    ["200 000 signes qui ne sont pas du base64", { ...e, chiffre: "!".repeat(200_000) }],
    ["un chiffré qui n'est pas un texte", { ...e, chiffre: [1, 2, 3] }],
    ["une date qui n'en est pas une", { ...e, enregistre_le: "pas une date" }],
    ["une date en nombre", { ...e, enregistre_le: 42 }],
    ["une date que Date.parse lit, de dix millions de signes et plus", { ...e, enregistre_le: dateDemesuree }],
    ["une date que Date.parse lit, écrite en mots", { ...e, enregistre_le: "Oct 25 2026" }],
    ["une date que Date.parse lit, sans ses millièmes", { ...e, enregistre_le: "2026-10-25T08:00:00Z" }],
    ["une date à la forme de toISOString, que Date.parse ne lit pas", { ...e, enregistre_le: "2026-13-45T99:99:99.999Z" }],
  ];
  for (const [quoi, valeur] of formes) assert.deepEqual(await lire(valeur), { entrees: [], ecart: "forme" }, quoi);
  // Lue sous un mode inconnu, ou sans mode, une enveloppe n'a pas de forme.
  assert.equal(await ecart(lire({ ...e, mode: "autre" }, SECRET, "autre")), "forme");
  assert.equal(await ecart(dechiffrerRencontre(e, SECRET)), "forme");
  assert.equal(await ecart(dechiffrerRencontre(e, SECRET, null)), "forme");
  // Les deux formes de toISOString passent : l'année en quatre chiffres, ou signée en six.
  for (const date of ["2026-10-25T08:00:00.000Z", "+020000-01-01T00:00:00.000Z", "-000001-01-01T00:00:00.000Z"]) {
    assert.deepEqual(await lire({ ...e, enregistre_le: date }), { entrees: D2, ecart: null }, date);
  }
  // Les bornes elles-mêmes passent la forme : la clé ou le déchiffrement les arrêtent.
  assert.equal(await ecart(lire({ ...e, iterations: ITERATIONS_MAX })), "cle");
  assert.equal(await ecart(lire({ ...e, iterations: 1 })), "cle");
  assert.equal(await ecart(lire({ ...e, chiffre: "A".repeat(SIGNES_CHIFFRE_MAX) })), "dechiffrement");
  assert.equal(await ecart(lire({ ...e, chiffre: versBase64(new Uint8Array(17)) })), "dechiffrement");
  // Des objets hostiles : rien ne lève.
  const piege = { ...e };
  Object.defineProperty(piege, "chiffre", { enumerable: true, get() { throw new Error("piège"); } });
  assert.equal(await ecart(lire(piege)), "forme");
  assert.equal(await ecart(lire(new Proxy({}, { ownKeys() { throw new Error("piège"); } }))), "forme");
  assert.equal(await ecart(dechiffrerRencontre(e, SECRET, new Proxy({}, { get() { throw new Error("piège"); } }))), "forme");

  // Le contenu : ni UTF-8, ni JSON, ni une composition.
  const contenus = [
    ["des octets qui ne sont pas de l'UTF-8", new Uint8Array([0xff, 0xfe, 0x5b, 0x5d])],
    ["un JSON valide, sauf un octet qui n'est pas de l'UTF-8", new Uint8Array([...new TextEncoder().encode('[{"nom":"Chef'), 0xff, ...new TextEncoder().encode('","nombre":1}]')])],
    ["pas du JSON", "Chef de partie × 2"],
    ["un JSON entamé", "[{"],
    ["une entrée seule", JSON.stringify(D1[0])],
    ["null", "null"],
  ];
  for (const [quoi, clair] of contenus) assert.deepEqual(await lire(await sceller(clair)), { entrees: [], ecart: "contenu" }, quoi);
  // Chaque refus rend une composition vide qui lui est propre.
  const [un, deux] = [await lire(null), await lire(null)];
  assert.notEqual(un.entrees, deux.entrees);
});

test("chiffrement — l'écriture refuse ce qui ne se relirait pas, sans lever", async () => {
  const refuse = async (promesse, quoi) => {
    const issue = await promesse;
    assert.equal(issue.code, "invalide", quoi);
    assert.deepEqual(Object.keys(issue), ["erreur", "code"], quoi);
  };
  await refuse(chiffrer(D2, { mode: "autre" }), "un mode inconnu");
  await refuse(chiffrerRencontre(D2, SECRET), "sans options");
  await refuse(chiffrerRencontre(D2, SECRET, null), "des options nulles");
  for (const secret of [null, undefined, {}, { cle: null, sel: SECRET.sel, iterations: SECRET.iterations }]) {
    await refuse(chiffrerRencontre(D2, secret, { mode: "demo" }), `le secret ${JSON.stringify(secret)}`);
  }
  // Une clé qui chiffre, avec un sel, des itérations ou une date que la lecture refuserait.
  for (const [quoi, secret] of [
    ["un sel court", { ...SECRET, sel: versBase64(new Uint8Array(15)) }],
    ["un sel qui n'est pas du base64", { ...SECRET, sel: "pas du base64, ce sel" }],
    ["des itérations nulles", { ...SECRET, iterations: 0 }],
    ["des itérations au-delà de leur borne", { ...SECRET, iterations: ITERATIONS_MAX + 1 }],
    ["des itérations écrites", { ...SECRET, iterations: "600000" }],
  ]) {
    await refuse(chiffrerRencontre(D2, secret, { mode: "demo" }), quoi);
  }
  await refuse(chiffrer(D2, { maintenant: new Date(Number.NaN) }), "une date invalide");
  await refuse(chiffrer(D2, { maintenant: "2026-10-25" }), "une date en texte");
  // Une clé qui ne chiffre pas.
  const dechiffreSeulement = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  await refuse(chiffrerRencontre(D2, { ...SECRET, cle: dechiffreSeulement }, { mode: "demo" }), "une clé qui ne fait que déchiffrer");
  await refuse(chiffrerRencontre(D2, { ...SECRET, cle: true }, { mode: "demo" }), "une clé qui n'en est pas une");

  // Le plus gros clair d'une composition valide : soixante noms de deux cents
  // demi-caractères astraux isolés, que le JSON écrit en six octets chacun
  // (« \ud800 »). Il passe la borne du clair, et se relit à l'identique.
  const lourde = Array.from({ length: 60 }, (_, rang) => ({ nom: String.fromCharCode(0xd800 + rang).repeat(200), nombre: 1 }));
  assert.equal([...lourde[0].nom].length, 200);
  assert.ok(new TextEncoder().encode(JSON.stringify(lourde)).length > 64 * 1024, "plus de 64 Ko de clair");
  const e = await chiffrer(lourde);
  assert.deepEqual(Object.keys(e), CHAMPS);
  assert.deepEqual(await lire(e), { entrees: lourde, ecart: null });
});

// ─── Les magasins ───────────────────────────────────────────────────────────

// Ce que tout magasin tient : une composition par mode, en copie, et le mode
// vérifié.
async function controlerMagasin(magasin, quoi) {
  assert.deepEqual(Object.keys(magasin).sort(), ["durable", "ecrire", "effacer", "lire"], quoi);
  assert.equal(await magasin.lire("demo"), null, quoi);
  const demo = await chiffrer(D2);
  const reel = await chiffrer(D3, { mode: "reel" });
  await magasin.ecrire(demo);
  await magasin.ecrire(reel);
  assert.deepEqual(await magasin.lire("demo"), demo, quoi);
  assert.deepEqual(await magasin.lire("reel"), reel, quoi);
  // Lu et écrit en copie : ce qu'on tient ne change pas ce qui est gardé.
  const lu = await magasin.lire("demo");
  lu.chiffre = "abîmé";
  demo.chiffre = "abîmé aussi";
  assert.deepEqual(await lire(await magasin.lire("demo")), { entrees: D2, ecart: null }, quoi);
  // Sans condition : la dernière écriture l'emporte, même plus ancienne.
  const ancienne = await chiffrer(D1, { maintenant: new Date("2020-01-01T00:00:00.000Z") });
  await magasin.ecrire(ancienne);
  assert.deepEqual(await magasin.lire("demo"), ancienne, quoi);
  // Effacer un mode ne touche pas l'autre.
  await magasin.effacer("demo");
  assert.equal(await magasin.lire("demo"), null, quoi);
  assert.deepEqual(await magasin.lire("reel"), reel, quoi);
  await magasin.effacer("demo");
  await magasin.effacer("reel");
  assert.equal(await magasin.lire("reel"), null, quoi);
  // Un mode inconnu est une faute d'appel.
  await assert.rejects(magasin.lire("autre"), TypeError);
  await assert.rejects(magasin.ecrire({ ...demo, mode: "autre" }), TypeError);
  await assert.rejects(magasin.ecrire(null), TypeError);
  await assert.rejects(magasin.effacer(undefined), TypeError);
}

test("magasins — la mémoire : une composition par mode, en copie ; la dernière écriture l'emporte", async () => {
  const magasin = magasinRencontreMemoire();
  assert.equal(magasin.durable, false);
  await controlerMagasin(magasin, "mémoire");
});

test("magasins — la base : la sienne, version 1, entrepôt « rencontres », le mode pour clé ; jamais celle du combat", async () => {
  assert.equal(NOM_BASE_RENCONTRE, "atelier-des-arpenteurs-rencontre");
  const fabrique = fabriqueIndexedDB();
  const retirer = fabrique.installer();
  let magasin;
  try {
    magasin = await borner(magasinRencontreIndexedDB(), "l'ouverture de la base");
  } finally {
    retirer();
  }
  assert.equal(magasin.durable, true);
  await controlerMagasin(magasin, "base");
  const demo = await chiffrer(D2);
  const reel = await chiffrer(D3, { mode: "reel" });
  await magasin.ecrire(demo);
  await magasin.ecrire(reel);
  assert.deepEqual(fabrique.contenu(NOM_BASE_RENCONTRE), { rencontres: { demo, reel } });
  assert.deepEqual(fabrique.contenu("atelier-des-arpenteurs-combat"), {});
  assert.ok(fabrique.journal.transactions.every(({ base, entrepot }) => base === NOM_BASE_RENCONTRE && entrepot === "rencontres"));
  // La base est à la version 1 : une ouverture à la version 1 n'a rien à monter.
  const ouverture = fabrique.open(NOM_BASE_RENCONTRE, 1);
  let montee = false;
  ouverture.onupgradeneeded = () => {
    montee = true;
  };
  const base = await borner(
    new Promise((resoudre, rejeter) => {
      ouverture.onsuccess = () => resoudre(ouverture.result);
      ouverture.onerror = () => rejeter(ouverture.error);
    }),
    "l'ouverture à la version 1",
  );
  assert.equal(base.version, 1);
  assert.equal(montee, false);
  assert.ok(base.objectStoreNames.contains("rencontres"));
  base.close();
  // Un autre nom, pour qui en a besoin.
  const autre = fabrique.installer();
  try {
    const essai = await magasinRencontreIndexedDB("rencontre-d-essai");
    await essai.ecrire(demo);
    assert.deepEqual(Object.keys(fabrique.contenu("rencontre-d-essai").rencontres), ["demo"]);
  } finally {
    autre();
  }
});

test("magasins — rien ne s'ouvre à l'import ; la base si elle s'ouvre, sinon la mémoire ; rien dans les souvenirs de la page", async () => {
  const fabrique = fabriqueIndexedDB();
  const journal = simulerStockage({}, { indexedDB: fabrique });
  try {
    const module = await import("../js/adversaire/rencontre_gardee.js?instance=import");
    assert.equal(journal.ouvertures, 0, "l'import n'ouvre aucune base");
    assert.deepEqual(Object.keys(module).sort(), [...EXPORTS].sort());
    const magasin = await borner(module.ouvrirMagasinRencontre(), "l'ouverture du magasin");
    assert.equal(magasin.durable, true);
    assert.equal(journal.ouvertures, 1);
    const garde = module.creerGardeRencontre({ magasin, mode: "demo", secret: () => SECRET, maintenant: () => MAINTENANT });
    assert.equal(journal.ouvertures, 1, "la garde n'ouvre rien");
    garde.garder(D2);
    await borner(garde.repos(), "la garde");
    assert.deepEqual(await garde.charger(), { entrees: D2, ecart: null });
    garde.effacer();
    await borner(garde.repos(), "l'effacement");
    assert.deepEqual(await garde.charger(), { entrees: [], ecart: "absente" });
    assert.equal(journal.ouvertures, 1);
    assert.deepEqual([journal.lus, journal.ecrits], [[], []]);
    // Ce qui s'est écrit dans la base : des enveloppes, sans aucun nom.
    assert.ok(fabrique.journal.ecritures.length > 0);
    for (const { base, valeur } of fabrique.journal.ecritures) {
      assert.equal(base, NOM_BASE_RENCONTRE);
      assert.deepEqual(Object.keys(valeur), CHAMPS);
      for (const nom of NOMS) assert.ok(!JSON.stringify(valeur).includes(nom), nom);
    }
  } finally {
    journal.retirer();
  }
  // Sans base dans le navigateur, ou une base qui ne s'ouvre pas : la mémoire.
  assert.equal(globalThis.indexedDB, undefined);
  assert.equal((await ouvrirMagasinRencontre()).durable, false);
  const enPanne = fabriqueIndexedDB();
  const retirer = enPanne.installer();
  try {
    enPanne.pannes.ouvertureLeve = true;
    assert.equal((await ouvrirMagasinRencontre()).durable, false);
    enPanne.pannes.ouvertureLeve = false;
    enPanne.pannes.ouvertureEchoue = true;
    assert.equal((await borner(ouvrirMagasinRencontre(), "la base qui ne s'ouvre pas")).durable, false);
    enPanne.pannes.ouvertureEchoue = false;
    assert.equal((await borner(ouvrirMagasinRencontre(), "la base rétablie")).durable, true);
  } finally {
    retirer();
  }
});

// ─── La garde ───────────────────────────────────────────────────────────────

// Un magasin en mémoire, espionné : ce qui s'y lit, s'y écrit, s'y efface,
// combien d'écritures sont en cours à la fois, et une retenue que chaque
// écriture attend quand elle est posée.
function espionner(magasin = magasinRencontreMemoire()) {
  const compte = { lire: 0, ecrire: 0, effacer: 0, enCours: 0, auPlus: 0 };
  let retenue = null;
  const suivre = async (nom, faire) => {
    compte[nom] += 1;
    compte.enCours += 1;
    compte.auPlus = Math.max(compte.auPlus, compte.enCours);
    try {
      if (retenue) await retenue;
      return await faire();
    } finally {
      compte.enCours -= 1;
    }
  };
  return {
    compte,
    retenir() {
      let lacher;
      retenue = new Promise((suite) => {
        lacher = suite;
      });
      return () => {
        retenue = null;
        lacher();
      };
    },
    magasin: {
      durable: magasin.durable,
      lire(mode) {
        compte.lire += 1;
        return magasin.lire(mode);
      },
      ecrire: (enveloppe) => suivre("ecrire", () => magasin.ecrire(enveloppe)),
      effacer: (mode) => suivre("effacer", () => magasin.effacer(mode)),
    },
    gardee: async (mode = "demo", secret = SECRET) => dechiffrerRencontre(await magasin.lire(mode), secret, { mode }),
  };
}
const gardeDe = (magasin, { secret = () => SECRET, mode = "demo", maintenant = () => MAINTENANT } = {}) => creerGardeRencontre({ magasin, mode, secret, maintenant });

test("garde — trois garder font une écriture, la dernière ; garder puis effacer : rien ; effacer puis garder : la composition", async () => {
  const espion = espionner();
  const garde = gardeDe(espion.magasin);
  assert.deepEqual(Object.keys(garde).sort(), ["charger", "effacer", "garder", "oublier", "repos"]);
  garde.garder(D1);
  garde.garder(D2);
  garde.garder(D3);
  await borner(garde.repos(), "la file");
  assert.equal(espion.compte.ecrire, 1, "une seule écriture");
  assert.deepEqual(await espion.gardee(), { entrees: D3, ecart: null });

  const vide = espionner();
  const autre = gardeDe(vide.magasin);
  autre.garder(D1);
  autre.effacer();
  await borner(autre.repos(), "la file");
  assert.equal(vide.compte.ecrire, 0, "rien ne s'écrit");
  assert.deepEqual(await vide.gardee(), { entrees: [], ecart: "absente" });

  autre.effacer();
  autre.garder(D2);
  await borner(autre.repos(), "la file");
  assert.deepEqual([vide.compte.ecrire, vide.compte.effacer], [1, 1]);
  assert.deepEqual(await vide.gardee(), { entrees: D2, ecart: null });
  // Effacer efface ce qui était gardé, et l'autre mode reste.
  const reel = gardeDe(vide.magasin, { mode: "reel" });
  reel.garder(D3);
  await borner(reel.repos(), "la file du mode réel");
  autre.effacer();
  await borner(autre.repos(), "l'effacement");
  assert.deepEqual(await vide.gardee(), { entrees: [], ecart: "absente" });
  assert.deepEqual(await vide.gardee("reel"), { entrees: D3, ecart: null });
  assert.deepEqual(await reel.charger(), { entrees: D3, ecart: null });
});

test("garde — le travail part au tour suivant ; deux écritures ne se croisent jamais", async () => {
  const espion = espionner();
  let lectures = 0;
  const garde = gardeDe(espion.magasin, {
    secret: () => {
      lectures += 1;
      return SECRET;
    },
  });
  garde.garder(D1);
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
  assert.deepEqual([lectures, espion.compte.ecrire], [0, 0], "rien dans l'appel ni dans ses microtâches");
  await borner(garde.repos(), "la file");
  assert.deepEqual([lectures, espion.compte.ecrire], [1, 1]);

  // Une écriture retenue : les demandes venues pendant elle attendent qu'elle finisse.
  const lacher = espion.retenir();
  garde.garder(D2);
  await attendreQue(() => espion.compte.ecrire === 2, "la deuxième écriture");
  garde.garder(D1);
  garde.garder(D3);
  for (let i = 0; i < 50 && espion.compte.ecrire === 2; i += 1) await tour();
  assert.equal(espion.compte.ecrire, 2, "la suivante attend celle qui est en cours");
  lacher();
  await borner(garde.repos(), "la file relâchée");
  assert.equal(espion.compte.ecrire, 3);
  assert.equal(espion.compte.auPlus, 1, "jamais deux écritures à la fois");
  assert.deepEqual(await espion.gardee(), { entrees: D3, ecart: null });
});

test("garde — la clé se relit à chaque écriture ; sans clé, rien ne s'écrit ni ne s'efface", async () => {
  const espion = espionner();
  let courant = SECRET;
  const garde = gardeDe(espion.magasin, { secret: () => courant });
  garde.garder(D1);
  // Changée dans le même tour : c'est la clé du moment de l'écriture qui compte.
  courant = AUTRE_SEL;
  await borner(garde.repos(), "la file");
  assert.equal((await espion.magasin.lire("demo")).sel, AUTRE_SEL.sel);
  assert.deepEqual(await espion.gardee("demo", AUTRE_SEL), { entrees: D1, ecart: null });
  courant = SECRET;
  garde.garder(D2);
  await borner(garde.repos(), "la file");
  assert.equal((await espion.magasin.lire("demo")).sel, SECRET.sel);
  assert.deepEqual(await garde.charger(), { entrees: D2, ecart: null });

  // Sans clé : ni écriture, ni effacement ; la lecture dit « cle ».
  const avant = await espion.magasin.lire("demo");
  for (const sans of [null, undefined, {}, { sel: SECRET.sel, iterations: SECRET.iterations }]) {
    courant = sans;
    garde.garder(D3);
    await borner(garde.repos(), "la file sans clé");
    garde.effacer();
    await borner(garde.repos(), "l'effacement sans clé");
    assert.deepEqual(await espion.magasin.lire("demo"), avant, JSON.stringify(sans) ?? "undefined");
    assert.deepEqual(await garde.charger(), { entrees: [], ecart: "cle" });
  }
  assert.deepEqual([espion.compte.ecrire, espion.compte.effacer], [2, 0]);
  // Une lecture de la clé qui lève vaut « pas de clé ».
  const levee = gardeDe(espion.magasin, {
    secret: () => {
      throw new Error("pas de clé");
    },
  });
  levee.garder(D3);
  levee.effacer();
  await borner(levee.repos(), "la file");
  assert.deepEqual(await levee.charger(), { entrees: [], ecart: "cle" });
  assert.deepEqual([espion.compte.ecrire, espion.compte.effacer], [2, 0]);
  // La clé revenue, le geste suivant écrit.
  courant = SECRET;
  garde.garder(D3);
  await borner(garde.repos(), "la file");
  assert.deepEqual(await garde.charger(), { entrees: D3, ecart: null });
});

test("garde — charger attend la file et ne rejette jamais ; oublier vide la place ; la composition copiée dans l'appel", async () => {
  const espion = espionner();
  const garde = gardeDe(espion.magasin);
  assert.deepEqual(await garde.charger(), { entrees: [], ecart: "absente" });
  // Une écriture demandée juste avant la lecture est lue.
  garde.garder(D2);
  assert.deepEqual(await borner(garde.charger(), "la lecture"), { entrees: D2, ecart: null });
  // La date est celle de la garde.
  assert.equal((await espion.magasin.lire("demo")).enregistre_le, MAINTENANT.toISOString());

  // Oublier : la demande qui attendait ne part pas ; ce qui est gardé reste.
  garde.garder(D3);
  garde.oublier();
  await borner(garde.repos(), "la file");
  assert.equal(espion.compte.ecrire, 1);
  assert.deepEqual(await espion.gardee(), { entrees: D2, ecart: null });
  garde.effacer();
  garde.oublier();
  await borner(garde.repos(), "la file");
  assert.deepEqual(await espion.gardee(), { entrees: D2, ecart: null });

  // La composition est copiée dans l'appel : la changer ensuite ne change rien.
  const liste = [{ nom: "Chef de partie", nombre: 1 }];
  garde.garder(liste);
  liste[0].nombre = 7;
  liste.push({ nom: "Marmiton de corvée", nombre: 1 });
  await borner(garde.repos(), "la file");
  assert.deepEqual(await garde.charger(), { entrees: [{ nom: "Chef de partie", nombre: 1 }], ecart: null });
  // Une composition que la relecture refuse ne s'écrit pas.
  garde.garder(marmitons(61));
  await borner(garde.repos(), "la file");
  assert.deepEqual(await garde.charger(), { entrees: [{ nom: "Chef de partie", nombre: 1 }], ecart: null });

  // Une base qui lève, à la lecture : « base », sans rejeter ; à l'écriture : rien ne remonte.
  const enPanne = {
    durable: true,
    lire: () => {
      throw new Error("la base ne se lit pas");
    },
    ecrire: async () => {
      throw new Error("la base refuse l'écriture");
    },
    effacer: async () => {
      throw new Error("la base refuse l'effacement");
    },
  };
  const panne = gardeDe(enPanne);
  assert.deepEqual(await panne.charger(), { entrees: [], ecart: "base" });
  assert.deepEqual(await gardeDe({ ...enPanne, lire: async () => Promise.reject(new Error("rejet")) }).charger(), { entrees: [], ecart: "base" });
  panne.garder(D1);
  panne.effacer();
  await borner(panne.repos(), "la file en panne");
  panne.garder(D1);
  await borner(panne.repos(), "la file en panne");
  // Une donnée abîmée dans la base : une forme, sans lever.
  const abimee = magasinRencontreMemoire();
  await abimee.ecrire({ mode: "demo", chiffre: "Chef de partie" });
  assert.deepEqual(await gardeDe(abimee).charger(), { entrees: [], ecart: "forme" });

  // Une faute d'appel se dit à la création.
  assert.throws(() => creerGardeRencontre({ magasin: abimee, mode: "autre", secret: () => SECRET }), TypeError);
  assert.throws(() => creerGardeRencontre({ magasin: abimee, mode: "demo", secret: SECRET }), TypeError);
});
