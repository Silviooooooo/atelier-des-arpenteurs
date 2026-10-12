// Contrôles de l'enregistrement d'un combat (SPECIFICATION.md, § 17 et
// § 7.2) : le chiffrement et son aller-retour, le mode à part, la révision
// entre deux onglets, le mot de passe changé, la donnée abîmée, l'absence
// d'IndexedDB, « Oublier », et rien de la banque en clair sur l'appareil.
// La base est une IndexedDB simulée : c'est le vrai magasin qui est
// contrôlé, pas son jumeau en mémoire. Les clés se fabriquent à l'exécution.

import { test as controle } from "node:test";
import assert from "node:assert/strict";
import { randomFillSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { ITERATIONS_MAX, nouveauSecret, ouvrirAvecMotDePasse, versBase64 } from "../js/securite/chiffrement.js";
import { transformer } from "../js/personnage/format.js";
import {
  FORMAT_COMBAT,
  PHRASES_DE_GARDE,
  REVISION_MAX,
  TAILLE_MAX_COMBAT,
  chiffrerCombat,
  creerGardien,
  dechiffrerCombat,
  magasinCombatIndexedDB,
  magasinCombatMemoire,
  ouvrirMagasinCombat,
  revisionDe,
} from "../js/combat/enregistrement.js";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";
import { simulerStockage } from "./outils/stockage_espion.js";

// Une base, une transaction ou une file qui n'aboutit jamais ne doit pas
// laisser un contrôle attendre sans fin (l'envoi passe par node --test) : au
// bout de trente secondes, il échoue. Le fichier entier en prend vingt.
const test = (titre, corps) => controle(titre, { timeout: 30_000 }, corps);
// Et là où l'on sait qu'une casse ferait attendre, l'attente est bornée de près.
function borner(promesse, quoi, delai = 5000) {
  let minuterie;
  const limite = new Promise((_, rejeter) => {
    minuterie = setTimeout(() => rejeter(new Error(`${quoi} : rien après ${delai} ms`)), delai);
  });
  return Promise.race([promesse, limite]).finally(() => clearTimeout(minuterie));
}

const NOM_BASE = "atelier-des-arpenteurs-combat";
const CHAMPS = ["mode", "format", "sel", "iterations", "iv", "chiffre", "revision", "enregistre_le"];
const MAINTENANT = new Date("2026-10-12T08:00:00.000Z");

// Une dérivation coûte : deux pour tout le fichier. La première est la clé
// de la démonstration, lue avec sa banque ; la seconde, un autre mot de passe.
const ENVELOPPE = JSON.parse(readFileSync(new URL("../essais/banque_demo.chiffree.json", import.meta.url), "utf8"));
const { banque: BANQUE, secret: SECRET } = await ouvrirAvecMotDePasse(ENVELOPPE, MOT_DE_PASSE_DEMO);
const AUTRE = await nouveauSecret("un autre mot de passe de table");

// Le texte d'un combat, tel que la séance l'assemble : il répète sa révision.
const contenu = (revision, evenements = []) =>
  JSON.stringify({ regles: 1, revision, miseEnPlace: { mode: "demo", noms: ["Aubépine Crèmebrûlée", "Chef de partie", "Marmiton de corvée"] }, evenements });
const assembler =
  (evenements = []) =>
  (revision) =>
    contenu(revision, evenements);
const TEXTE = contenu(3, [{ type: "de", valeurs: [7] }]);
const chiffrer = (texte = TEXTE, options = {}) => chiffrerCombat(texte, SECRET, { mode: "demo", revision: 3, maintenant: MAINTENANT, ...options });

// Le magasin du combat, sur une fabrique : un onglet de plus à chaque appel.
async function onglet(fabrique) {
  const retirer = fabrique.installer();
  try {
    return await magasinCombatIndexedDB();
  } finally {
    retirer();
  }
}
const gardee = (fabrique, mode = "demo") => fabrique.contenu(NOM_BASE).combats?.[mode] ?? null;
const texteGarde = async (fabrique, secret = SECRET, mode = "demo") => (await dechiffrerCombat(gardee(fabrique, mode), secret, { mode })).texte;

// Écrit une valeur telle quelle dans la base, sans passer par le module :
// pour y poser une donnée abîmée.
async function poser(fabrique, valeur) {
  const ouverture = fabrique.open(NOM_BASE, 1);
  ouverture.onupgradeneeded = () => ouverture.result.createObjectStore("combats", { keyPath: "mode" });
  const base = await borner(new Promise((resoudre) => (ouverture.onsuccess = () => resoudre(ouverture.result))), "l'ouverture de la base d'essai");
  const t = base.transaction("combats", "readwrite");
  t.objectStore("combats").put(valeur);
  await borner(new Promise((resoudre) => (t.oncomplete = resoudre)), "l'écriture dans la base d'essai");
  base.close();
}

// Un gardien de la démonstration, et ce qu'il annonce.
function gardienDe(magasin, { secret = () => SECRET, mode = "demo" } = {}) {
  const gardien = creerGardien({ magasin, mode, secret, maintenant: () => MAINTENANT });
  const annonces = [];
  gardien.surChangement((etat) => annonces.push(etat));
  return Object.assign(gardien, { annonces });
}

// Un chiffré forgé avec la bonne clé : ce que seul l'auteur d'un combat
// pourrait écrire, mais dont le clair n'est pas ce qu'on attend.
async function forger(clair, { compresser = true, mode = "demo", revision = 3 } = {}) {
  const corps = compresser ? await transformer(clair, new CompressionStream("deflate-raw")) : clair;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const associees = new TextEncoder().encode(`atelier-des-arpenteurs/combat/1/${mode}`);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: associees }, SECRET.cle, corps));
  return { mode, format: 1, sel: SECRET.sel, iterations: SECRET.iterations, iv: versBase64(iv), chiffre: versBase64(chiffre), revision, enregistre_le: MAINTENANT.toISOString() };
}

// ─── Le chiffrement ─────────────────────────────────────────────────────────

test("aller-retour — le format de la mission, dans son ordre ; le texte revient à l'identique, en démonstration comme en mode réel", async () => {
  const e = await chiffrer();
  assert.deepEqual(Object.keys(e), CHAMPS);
  assert.equal(FORMAT_COMBAT, 1);
  assert.deepEqual(
    { mode: e.mode, format: e.format, sel: e.sel, iterations: e.iterations, revision: e.revision, enregistre_le: e.enregistre_le },
    { mode: "demo", format: 1, sel: SECRET.sel, iterations: SECRET.iterations, revision: 3, enregistre_le: "2026-10-12T08:00:00.000Z" },
  );
  assert.match(e.iv, /^[A-Za-z0-9+/]{16}$/, "un vecteur de 12 octets, en base64");
  assert.match(e.chiffre, /^[A-Za-z0-9+/]+={0,2}$/);
  // IndexedDB le garde tel quel : que des textes et des nombres.
  assert.deepEqual(structuredClone(e), e);
  assert.deepEqual(await dechiffrerCombat(e, SECRET, { mode: "demo" }), { texte: TEXTE, revision: 3 });

  // Ni la garde « mode réel » ni la garde « enregistré » du modèle : les deux modes se chiffrent.
  const reel = await chiffrer(TEXTE, { mode: "reel", revision: 8 });
  assert.deepEqual(await dechiffrerCombat(reel, SECRET, { mode: "reel" }), { texte: TEXTE, revision: 8 });

  // Un vecteur neuf à chaque écriture : deux chiffrés du même texte diffèrent.
  const second = await chiffrer();
  assert.notEqual(second.iv, e.iv);
  assert.notEqual(second.chiffre, e.chiffre);

  // La date par défaut est celle de l'instant.
  const avant = Date.now();
  const date = Date.parse((await chiffrerCombat(TEXTE, SECRET, { mode: "demo", revision: 1 })).enregistre_le);
  assert.ok(date >= avant && date <= Date.now());
  // Un texte vide, des signes hors du plan de base : à l'identique aussi.
  for (const texte of ["", "« Solo du chef » — 𝄞 ✓ ✗ →"]) {
    assert.equal((await dechiffrerCombat(await chiffrer(texte), SECRET, { mode: "demo" })).texte, texte);
  }
});

test("chiffrement — un appel mal fait rend une erreur, sans lever", async () => {
  for (const [texte, secret, options] of [
    [TEXTE, SECRET, { mode: "autre", revision: 1 }],
    [TEXTE, SECRET, { mode: "demo", revision: 0 }],
    [TEXTE, SECRET, { mode: "demo", revision: 1.5 }],
    [TEXTE, SECRET, { mode: "demo", revision: REVISION_MAX + 1 }],
    [TEXTE, SECRET, { mode: "demo", revision: Number.MAX_SAFE_INTEGER }],
    [TEXTE, SECRET, { mode: "demo" }],
    [{ regles: 1 }, SECRET, { mode: "demo", revision: 1 }],
    [TEXTE, null, { mode: "demo", revision: 1 }],
    [TEXTE, { sel: SECRET.sel, iterations: SECRET.iterations }, { mode: "demo", revision: 1 }],
    [TEXTE, { ...SECRET, cle: "pas une clé" }, { mode: "demo", revision: 1 }],
    [TEXTE, SECRET, undefined],
  ]) {
    const issue = await chiffrerCombat(texte, secret, options);
    assert.equal(issue.code, "invalide");
    assert.equal(typeof issue.erreur, "string");
  }
  // Désarmé : à sa borne même, la révision se chiffre.
  assert.equal((await chiffrerCombat(TEXTE, SECRET, { mode: "demo", revision: REVISION_MAX })).revision, REVISION_MAX);
});

test("borne — 8 Mo de clair passent, un octet de plus est refusé, à l'écriture comme à la lecture", async () => {
  assert.equal(TAILLE_MAX_COMBAT, 8 * 1024 * 1024);
  const plein = "a".repeat(TAILLE_MAX_COMBAT);
  const e = await chiffrer(plein);
  assert.equal(e.revision, 3);
  assert.equal((await dechiffrerCombat(e, SECRET, { mode: "demo" })).texte.length, TAILLE_MAX_COMBAT);

  const trop = await chiffrer(`${plein}a`);
  assert.equal(trop.code, "trop_gros");
  assert.match(trop.erreur, /dépasse 8 Mo/);
  // La borne compte des octets : des signes de deux octets la passent à moitié prix.
  assert.equal((await chiffrer("é".repeat(TAILLE_MAX_COMBAT / 2))).revision, 3);
  assert.equal((await chiffrer(`${"é".repeat(TAILLE_MAX_COMBAT / 2)}a`)).code, "trop_gros");

  // À la lecture : un chiffré forgé, à la bonne clé, qui se décompresse au-delà.
  const juste = await forger(new Uint8Array(TAILLE_MAX_COMBAT).fill(97));
  assert.equal((await dechiffrerCombat(juste, SECRET, { mode: "demo" })).texte.length, TAILLE_MAX_COMBAT);
  const bombe = await forger(new Uint8Array(TAILLE_MAX_COMBAT + 1).fill(97));
  assert.deepEqual(await dechiffrerCombat(bombe, SECRET, { mode: "demo" }), { erreur: "Le combat gardé ne se déchiffre pas : il est abîmé.", code: "illisible", revision: 3 });
});

test("mot de passe changé — un autre sel, ou d'autres itérations : « cle », sans déchiffrer ; la révision est rendue", async () => {
  const e = await chiffrer();
  const attendu = { erreur: "Le combat gardé est chiffré avec une autre clé de table : le mot de passe de table a changé.", code: "cle", revision: 3 };
  assert.deepEqual(await dechiffrerCombat(e, AUTRE, { mode: "demo" }), attendu);
  assert.deepEqual(await dechiffrerCombat(e, { ...SECRET, iterations: SECRET.iterations + 1 }, { mode: "demo" }), attendu);
  // Sans déchiffrer : la bonne clé, sous l'étiquette d'un autre sel, ne lit rien.
  assert.deepEqual(await dechiffrerCombat(e, { ...SECRET, sel: AUTRE.sel }, { mode: "demo" }), attendu);
  assert.deepEqual(await dechiffrerCombat(e, null, { mode: "demo" }), attendu);
  // À l'inverse, le bon sel et les bonnes itérations avec une autre clé : on
  // déchiffre, et c'est une donnée abîmée.
  assert.equal((await dechiffrerCombat(e, { ...SECRET, cle: AUTRE.cle }, { mode: "demo" })).code, "illisible");
  // Une clé relue du coffre est un autre objet : seuls le sel et les itérations comptent.
  assert.equal((await dechiffrerCombat(e, { cle: SECRET.cle, sel: SECRET.sel, iterations: SECRET.iterations, gardee_le: "x" }, { mode: "demo" })).texte, TEXTE);
});

test("donnée abîmée — chaque défaut de l'enregistrement est « illisible », jamais une exception ; intact, il se lit", async () => {
  const e = await chiffrer();
  const autreChiffre = await chiffrer();
  const retourne = (texte) => (texte[0] === "A" ? "B" : "A") + texte.slice(1);
  const sans = (champ) => Object.fromEntries(Object.entries(e).filter(([cle]) => cle !== champ));
  // Un chiffré dont le base64 finit par un remplissage : selon la longueur
  // du texte, il y en a un ou non. On allonge le texte jusqu'à en trouver un.
  let rempli = null;
  for (let ajout = 0; ajout <= 26 && rempli === null; ajout += 1) {
    const candidat = await chiffrer(contenu(3, ["abcdefghijklmnopqrstuvwxyz".slice(0, ajout)]));
    if (candidat.chiffre.endsWith("=")) rempli = candidat;
  }
  assert.ok(rempli, "un chiffré au base64 rempli a été trouvé");
  assert.equal(typeof (await dechiffrerCombat(rempli, SECRET, { mode: "demo" })).texte, "string", "désarmé : avec son remplissage, il se lit");
  const cas = {
    "un signe du chiffré changé": { ...e, chiffre: retourne(e.chiffre) },
    "le vecteur d'un autre chiffrement": { ...e, iv: autreChiffre.iv },
    "le chiffré d'un autre chiffrement": { ...e, chiffre: autreChiffre.chiffre },
    "un champ en plus": { ...e, note: "x" },
    "un champ en moins": sans("enregistre_le"),
    "un champ remplacé par un autre": { ...sans("iv"), vecteur: e.iv },
    "un chiffré vide": { ...e, chiffre: "" },
    "un chiffré qui n'est pas du base64": { ...e, chiffre: "@@@@" },
    "un chiffré mal rempli": { ...e, chiffre: `${e.chiffre.replace(/=+$/, "")}=` },
    // Le décodeur du navigateur l'accepterait : c'est la longueur, multiple de quatre, qui le refuse.
    "un chiffré sans son remplissage": { ...rempli, chiffre: rempli.chiffre.replace(/=+$/, "") },
    "un chiffré réduit à son étiquette": { ...e, chiffre: versBase64(new Uint8Array(16)) },
    "un chiffré qui n'est pas un texte": { ...e, chiffre: [1, 2, 3] },
    "un vecteur trop court": { ...e, iv: versBase64(new Uint8Array(8)) },
    "un sel trop court": { ...e, sel: versBase64(new Uint8Array(8)) },
    "des itérations nulles": { ...e, iterations: 0 },
    "des itérations non entières": { ...e, iterations: 1.5 },
    "des itérations hors borne": { ...e, iterations: ITERATIONS_MAX + 1 },
    "des itérations en texte": { ...e, iterations: String(e.iterations) },
    "une révision nulle": { ...e, revision: 0 },
    "une révision négative": { ...e, revision: -1 },
    "une révision non entière": { ...e, revision: 1.5 },
    "une révision en texte": { ...e, revision: "3" },
    "une révision au-delà de sa borne": { ...e, revision: REVISION_MAX + 1 },
    "une révision démesurée": { ...e, revision: Number.MAX_SAFE_INTEGER },
    "un sel trop long": { ...e, sel: versBase64(new Uint8Array(32)) },
    "un vecteur trop long": { ...e, iv: versBase64(new Uint8Array(24)) },
    "un chiffré plus long que le plus gros combat": { ...e, chiffre: "A".repeat(12 * 1024 * 1024) },
    "une date qui n'en est pas une": { ...e, enregistre_le: "hier" },
    "une date qui n'est pas un texte": { ...e, enregistre_le: 12 },
    "un format nul": { ...e, format: 0 },
    "un format en texte": { ...e, format: "1" },
    "un format non entier": { ...e, format: 1.5 },
    "un mode inconnu": { ...e, mode: "autre" },
    "rien": null,
    "une liste": [e],
    "un texte": JSON.stringify(e),
    "un clair qui n'est pas du deflate": await forger(new TextEncoder().encode(TEXTE), { compresser: false }),
    "un clair qui n'est pas de l'UTF-8": await forger(new Uint8Array([0xff, 0xfe, 0xfd])),
  };
  for (const [nom, enregistrement] of Object.entries(cas)) {
    const issue = await dechiffrerCombat(enregistrement, SECRET, { mode: "demo" });
    assert.equal(issue.code, "illisible", nom);
    assert.equal(issue.erreur, "Le combat gardé ne se déchiffre pas : il est abîmé.", nom);
    assert.equal(issue.revision, revisionDe(enregistrement), nom);
    assert.equal("texte" in issue, false, nom);
  }
  assert.equal((await dechiffrerCombat(cas["une révision en texte"], SECRET, { mode: "demo" })).revision, 0);
  assert.equal((await dechiffrerCombat(cas["une révision démesurée"], SECRET, { mode: "demo" })).revision, 0);
  assert.equal((await dechiffrerCombat(cas["un champ en plus"], SECRET, { mode: "demo" })).revision, 3);
  // Désarmé : le même enregistrement, intact.
  assert.equal((await dechiffrerCombat({ ...e }, SECRET, { mode: "demo" })).texte, TEXTE);
  // Un mode de lecture inconnu : rien ne se lit.
  assert.equal((await dechiffrerCombat(e, SECRET, { mode: "autre" })).code, "illisible");
  assert.equal((await dechiffrerCombat(e, SECRET)).code, "illisible");
});

test("format plus récent — reconnu avant tout autre examen, quelles que soient ses clés", async () => {
  const e = await chiffrer();
  const attendu = { erreur: "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.", code: "format_recent", revision: 7 };
  // Neuf clés, une de moins, un chiffré d'une autre forme : c'est le format qui parle.
  assert.deepEqual(await dechiffrerCombat({ ...e, format: 2, revision: 7, etiquette: "neuve" }, SECRET, { mode: "demo" }), attendu);
  assert.deepEqual(await dechiffrerCombat({ mode: "demo", format: 3, revision: 7, corps: [1, 2] }, AUTRE, { mode: "demo" }), attendu);
  assert.equal((await dechiffrerCombat({ format: 2 }, SECRET, { mode: "demo" })).revision, 0);
  // Désarmé : le format connu, avec une clé de plus, est une donnée abîmée.
  assert.equal((await dechiffrerCombat({ ...e, etiquette: "neuve" }, SECRET, { mode: "demo" })).code, "illisible");
});

// ─── L'enveloppe longue ─────────────────────────────────────────────────────

const ABIME = { erreur: "Le combat gardé ne se déchiffre pas : il est abîmé.", code: "illisible", revision: 3 };
// Ce qu'un chiffré pèse au plus, étiquette comprise : la borne de la lecture.
const OCTETS_CHIFFRE_MAX = TAILLE_MAX_COMBAT + 64 * 1024;

test("enveloppe longue — un chiffré de plusieurs mégaoctets ne fait rien lever : abîmé, il est « illisible » ; sain, il se relit", async () => {
  const e = await chiffrer();
  // Du base64 valide, aux longueurs où l'examen du texte faisait déborder la
  // pile : sous la borne, il est examiné puis ne se déchiffre pas ; au-delà,
  // il est refusé sans être examiné.
  for (const signes of [5 * 1024 * 1024, 8 * 1024 * 1024, 4 * Math.ceil(OCTETS_CHIFFRE_MAX / 3), 12 * 1024 * 1024, 32 * 1024 * 1024]) {
    assert.deepEqual(await dechiffrerCombat({ ...e, chiffre: "A".repeat(signes) }, SECRET, { mode: "demo" }), ABIME, `${signes} signes`);
  }
  // Un combat qui se compresse mal, sous la borne du clair : son chiffré
  // passe les 4,5 Mo où la lecture levait. Il s'écrit, et se relit tel quel.
  const octets = new Uint8Array(6_000_000);
  randomFillSync(octets);
  const texte = versBase64(octets);
  assert.ok(texte.length < TAILLE_MAX_COMBAT);
  const ecrit = await chiffrer(texte);
  assert.ok(ecrit.chiffre.length > 7 * 1024 * 1024, `un chiffré de ${ecrit.chiffre.length} signes`);
  const relu = await dechiffrerCombat(ecrit, SECRET, { mode: "demo" });
  assert.equal(relu.revision, 3);
  assert.ok(relu.texte === texte, "le texte revient à l'identique");
});

// Du deflate fait de blocs vides, puis d'un bloc qui porte le texte : il se
// décompresse en ce texte, quel que soit son poids. « total » est le nombre
// d'octets du tout.
function deflateLeste(total) {
  const ENTETE = 5;
  const vides = Math.floor((total - ENTETE - 1) / ENTETE);
  const texte = "a".repeat(total - ENTETE - vides * ENTETE);
  const corps = new Uint8Array(total);
  for (let rang = 0; rang < vides; rang += 1) corps.set([0x00, 0x00, 0x00, 0xff, 0xff], rang * ENTETE);
  // Le dernier bloc : non compressé lui aussi, sa longueur, puis son complément.
  corps.set([0x01, texte.length, 0x00, 0xff - texte.length, 0xff], vides * ENTETE);
  corps.set(new TextEncoder().encode(texte), (vides + 1) * ENTETE);
  return { corps, texte };
}

test("borne — un chiffré plus lourd que le plus gros combat est refusé avant tout examen, même s'il se déchiffrerait", async () => {
  // Désarmé d'abord : léger, ce deflate lesté se lit.
  const leger = deflateLeste(64 * 1024);
  assert.deepEqual(await dechiffrerCombat(await forger(leger.corps, { compresser: false }), SECRET, { mode: "demo" }), { texte: leger.texte, revision: 3 });
  // À la borne même (8 Mo et 64 Ko, étiquette de 16 octets comprise), il se lit encore.
  const juste = deflateLeste(OCTETS_CHIFFRE_MAX - 16);
  const aLaBorne = await forger(juste.corps, { compresser: false });
  assert.equal(aLaBorne.chiffre.length, 4 * Math.ceil(OCTETS_CHIFFRE_MAX / 3));
  assert.deepEqual(await dechiffrerCombat(aLaBorne, SECRET, { mode: "demo" }), { texte: juste.texte, revision: 3 });
  // Un octet de plus : la bonne clé, un clair de quelques signes, et pourtant « illisible ».
  const trop = deflateLeste(OCTETS_CHIFFRE_MAX - 16 + 1);
  assert.deepEqual(await dechiffrerCombat(await forger(trop.corps, { compresser: false }), SECRET, { mode: "demo" }), ABIME);
});

test("écriture — un compressé qui ne se relirait pas ne s'écrit pas : « trop_gros », dit en jouant et non au rechargement", async () => {
  // Aucun compresseur ne grossit un texte de plus de 64 Ko : celui-ci le fait,
  // pour voir la garde. Il ajoute « leste » octets à ce que rend le vrai.
  const Vrai = globalThis.CompressionStream;
  const reel = (await transformer(new TextEncoder().encode(TEXTE), new Vrai("deflate-raw"))).length;
  let leste = 0;
  globalThis.CompressionStream = class {
    constructor(format) {
      const vrai = new Vrai(format);
      const queue = new TransformStream({
        flush(sortie) {
          if (leste > 0) sortie.enqueue(new Uint8Array(leste));
        },
      });
      this.writable = vrai.writable;
      this.readable = vrai.readable.pipeThrough(queue);
    }
  };
  try {
    // Désarmé : sans lest, le texte s'écrit comme toujours.
    assert.deepEqual(await dechiffrerCombat(await chiffrer(), SECRET, { mode: "demo" }), { texte: TEXTE, revision: 3 });
    // À la borne de la lecture, étiquette comprise : il s'écrit encore.
    leste = OCTETS_CHIFFRE_MAX - 16 - reel;
    const aLaBorne = await chiffrer();
    assert.equal(aLaBorne.chiffre.length, 4 * Math.ceil(OCTETS_CHIFFRE_MAX / 3));
    // Un octet de plus : refusé à l'écriture, par la phrase du combat trop gros.
    leste += 1;
    assert.deepEqual(await chiffrer(), { erreur: "Ce combat dépasse 8 Mo : il n'est plus gardé.", code: "trop_gros" });
  } finally {
    globalThis.CompressionStream = Vrai;
  }
});

test("donnée piégée — un enregistrement dont un champ lève à la lecture est « illisible », sans que rien ne remonte", async () => {
  const e = await chiffrer();
  const piege = (champ) => Object.defineProperty({ ...e }, champ, { enumerable: true, get: () => { throw new RangeError("piège"); } });
  for (const champ of CHAMPS) {
    const issue = await dechiffrerCombat(piege(champ), SECRET, { mode: "demo" });
    assert.equal(issue.code, "illisible", champ);
    assert.equal(issue.erreur, "Le combat gardé ne se déchiffre pas : il est abîmé.", champ);
    // La révision lue avant le piège est rendue ; piégée elle-même, elle vaut 0.
    assert.equal(issue.revision, champ === "revision" ? 0 : 3, champ);
  }
  // Désarmé : le même enregistrement, sans piège.
  assert.equal((await dechiffrerCombat({ ...e }, SECRET, { mode: "demo" })).texte, TEXTE);
});

test("revisionDe — un entier de 0 à sa borne, sinon 0", () => {
  assert.equal(REVISION_MAX, 2 ** 40);
  for (const [enregistrement, attendue] of [
    [{ revision: 4 }, 4],
    [{ revision: 0 }, 0],
    [{ revision: REVISION_MAX }, REVISION_MAX],
    [{ revision: REVISION_MAX + 1 }, 0],
    [{ revision: Number.MAX_SAFE_INTEGER }, 0],
    [{ revision: Number.MAX_SAFE_INTEGER + 1 }, 0],
    [{ revision: -1 }, 0],
    [{ revision: 2.5 }, 0],
    [{ revision: "4" }, 0],
    [{ revision: null }, 0],
    [{}, 0],
    [null, 0],
    [undefined, 0],
    [[4], 0],
    ["4", 0],
  ]) {
    assert.equal(revisionDe(enregistrement), attendue, JSON.stringify(enregistrement));
  }
});

// ─── Le magasin ─────────────────────────────────────────────────────────────

const MAGASINS = {
  "en mémoire": async () => magasinCombatMemoire(),
  "sur IndexedDB": async () => onglet(fabriqueIndexedDB()),
};

for (const [nom, ouvrir] of Object.entries(MAGASINS)) {
  test(`magasin ${nom} — lire, écrire à la révision attendue, le mode à part, les valeurs clonées`, async () => {
    const magasin = await ouvrir();
    assert.equal(await magasin.lire("demo"), null);
    const un = await chiffrer(contenu(1), { revision: 1 });
    const deux = await chiffrer(contenu(2), { revision: 2 });
    assert.deepEqual(await magasin.ecrireSi(un, 0), { ecrit: true });
    assert.deepEqual(await magasin.lire("demo"), un);

    // La révision gardée n'est pas celle qu'on attend : rien ne s'écrit.
    assert.deepEqual(await magasin.ecrireSi(deux, 0), { ecrit: false, gardee: un });
    assert.deepEqual(await magasin.ecrireSi(deux, 2), { ecrit: false, gardee: un });
    assert.deepEqual(await magasin.lire("demo"), un);
    assert.deepEqual(await magasin.ecrireSi(deux, 1), { ecrit: true });
    assert.deepEqual(await magasin.lire("demo"), deux);
    // « Différente », pas « plus récente » : une révision gardée plus basse refuse aussi.
    assert.equal((await magasin.ecrireSi(await chiffrer(contenu(9), { revision: 9 }), 8)).ecrit, false);

    // Un combat par mode : la démonstration ne touche jamais le combat réel.
    assert.equal(await magasin.lire("reel"), null);
    const reel = await chiffrer(contenu(1), { mode: "reel", revision: 1 });
    assert.deepEqual(await magasin.ecrireSi(reel, 0), { ecrit: true });
    assert.deepEqual(await magasin.lire("demo"), deux);
    assert.deepEqual(await magasin.lire("reel"), reel);

    // Cloné à l'entrée et à la sortie.
    const trois = await chiffrer(contenu(3), { revision: 3 });
    await magasin.ecrireSi(trois, 2);
    trois.revision = 50;
    const lu = await magasin.lire("demo");
    assert.equal(lu.revision, 3);
    lu.revision = 60;
    assert.equal((await magasin.lire("demo")).revision, 3);

    await assert.rejects(magasin.lire("autre"), TypeError);
    await assert.rejects(magasin.ecrireSi({ ...un, mode: "autre" }, 0), TypeError);
    await assert.rejects(magasin.ecrireSi(null, 0), TypeError);
  });

  test(`magasin ${nom} — une révision gardée qui ne se lit pas vaut 0 : l'écriture qui attend 0 la remplace`, async () => {
    const magasin = await ouvrir();
    // Le magasin ne juge pas ce qu'on lui donne : une donnée abîmée s'y pose ainsi.
    assert.deepEqual(await magasin.ecrireSi({ mode: "demo", revision: "sept", chiffre: "abîmé" }, 0), { ecrit: true });
    const un = await chiffrer(contenu(1), { revision: 1 });
    assert.equal((await magasin.ecrireSi(un, 7)).ecrit, false);
    assert.deepEqual(await magasin.ecrireSi(un, 0), { ecrit: true });
    assert.deepEqual(await magasin.lire("demo"), un);
  });
}

test("magasin sur IndexedDB — la base de la mission ; lire, comparer et écrire dans une seule transaction", async () => {
  const fabrique = fabriqueIndexedDB();
  const magasin = await onglet(fabrique);
  assert.equal(magasin.durable, true);
  assert.equal(magasinCombatMemoire().durable, false);
  assert.deepEqual(fabrique.contenu(NOM_BASE), { combats: {} });
  const un = await chiffrer(contenu(1), { revision: 1 });
  await magasin.ecrireSi(un, 0);
  // L'entrepôt « combats », avec le mode pour clé.
  assert.deepEqual(fabrique.contenu(NOM_BASE), { combats: { demo: un } });
  assert.deepEqual(fabrique.journal.transactions, [{ base: NOM_BASE, entrepot: "combats", acces: "readwrite" }]);
  // Un refus, lui aussi, tient en une transaction, et n'écrit rien.
  await magasin.ecrireSi(await chiffrer(contenu(5), { revision: 5 }), 4);
  assert.equal(fabrique.journal.transactions.length, 2);
  assert.equal(fabrique.journal.ecritures.length, 1);
  await magasin.lire("demo");
  assert.deepEqual(fabrique.journal.transactions.at(-1), { base: NOM_BASE, entrepot: "combats", acces: "readonly" });

  // Une écriture que le navigateur refuse : la promesse échoue, rien n'est gardé.
  fabrique.pannes.ecritureEchoue = true;
  await assert.rejects(magasin.ecrireSi(await chiffrer(contenu(2), { revision: 2 }), 1));
  fabrique.pannes.ecritureEchoue = false;
  assert.deepEqual(await magasin.lire("demo"), un);
});

test("magasin sur IndexedDB — une montée de version demandée ailleurs : la connexion s'efface, sans la bloquer", async () => {
  const fabrique = fabriqueIndexedDB();
  const magasin = await onglet(fabrique);
  const montee = fabrique.open(NOM_BASE, 2);
  let bloquee = false;
  montee.onblocked = () => (bloquee = true);
  await borner(new Promise((resoudre) => (montee.onsuccess = resoudre)), "la montée de version");
  assert.equal(bloquee, false);
  // La connexion fermée ne lit plus : une promesse qui échoue, pas une exception en l'air.
  await assert.rejects(magasin.lire("demo"));
  await assert.rejects(magasin.ecrireSi(await chiffrer(contenu(1), { revision: 1 }), 0));
});

test("absence d'IndexedDB — le magasin se replie en mémoire : sans indexedDB, ouverture qui lève, qui échoue, qui est bloquée", async () => {
  // Node, tel quel, n'a pas d'IndexedDB.
  assert.equal(typeof globalThis.indexedDB, "undefined");
  assert.equal((await ouvrirMagasinCombat()).durable, false);

  const fabrique = fabriqueIndexedDB();
  const retirer = fabrique.installer();
  try {
    fabrique.pannes.ouvertureLeve = true;
    assert.equal((await ouvrirMagasinCombat()).durable, false);
    fabrique.pannes.ouvertureLeve = false;
    fabrique.pannes.ouvertureEchoue = true;
    assert.equal((await ouvrirMagasinCombat()).durable, false);
    fabrique.pannes.ouvertureEchoue = false;
    // Désarmée : la même fabrique ouvre la base.
    assert.equal((await ouvrirMagasinCombat()).durable, true);
  } finally {
    retirer();
  }
  // Un autre onglet bloque l'ouverture : en mémoire aussi, sans attendre sans fin.
  globalThis.indexedDB = {
    open() {
      const ouverture = {};
      setTimeout(() => ouverture.onblocked?.(), 0);
      return ouverture;
    },
  };
  try {
    assert.equal((await borner(ouvrirMagasinCombat(), "l'ouverture bloquée")).durable, false);
  } finally {
    delete globalThis.indexedDB;
  }
});

test("absence d'IndexedDB — le gardien dit « Ce navigateur ne garde pas le combat », et le combat vit en mémoire", async () => {
  const magasin = await ouvrirMagasinCombat();
  const gardien = gardienDe(magasin);
  assert.equal(gardien.etat(), "memoire");
  assert.deepEqual(await gardien.charger(), { vide: true });
  gardien.garder(assembler(["a"]));
  assert.equal(gardien.etat(), "memoire");
  await gardien.repos();
  assert.equal(gardien.etat(), "memoire");
  assert.equal(gardien.phrase(), "Ce navigateur ne garde pas le combat");
  assert.deepEqual(gardien.annonces, [], "l'état n'a jamais changé");
  // Le temps de la visite, le combat se relit : l'écran qui se reconstruit le retrouve.
  assert.deepEqual(await gardienDe(magasin).charger(), { texte: contenu(1, ["a"]), revision: 1 });
});

// ─── Le gardien ─────────────────────────────────────────────────────────────

test("gardien — rien de gardé, puis l'aller-retour : le texte porte la révision de son enregistrement, un autre onglet le relit", async () => {
  const fabrique = fabriqueIndexedDB();
  const gardien = gardienDe(await onglet(fabrique));
  // Avant tout chargement, la révision connue est 0 : sur une base qui garde
  // déjà un combat, l'écriture est refusée, et rien n'est écrasé.
  const occupee = fabriqueIndexedDB();
  const dejaLa = await chiffrer(contenu(2), { revision: 2 });
  await poser(occupee, dejaLa);
  const presse = gardienDe(await onglet(occupee));
  presse.garder(assembler(["sans avoir chargé"]));
  await presse.repos();
  assert.equal(presse.etat(), "ailleurs");
  assert.deepEqual(gardee(occupee), dejaLa);
  // Sur une base vide, elle passe : c'est la révision 1.
  const vide = fabriqueIndexedDB();
  const direct = gardienDe(await onglet(vide));
  direct.garder(assembler(["sans avoir chargé"]));
  await direct.repos();
  assert.equal(direct.etat(), "garde");
  assert.equal(await texteGarde(vide), contenu(1, ["sans avoir chargé"]));

  assert.deepEqual(await gardien.charger(), { vide: true });
  assert.equal(gardien.etat(), "garde");
  assert.equal(gardien.phrase(), "Combat gardé sur cet appareil");
  gardien.garder(assembler(["a"]));
  assert.equal(gardien.etat(), "ecriture");
  assert.equal(gardien.phrase(), "Enregistrement…");
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.deepEqual(gardien.annonces, ["ecriture", "garde"]);

  const e = gardee(fabrique);
  assert.deepEqual(Object.keys(e), CHAMPS);
  assert.deepEqual([e.mode, e.format, e.sel, e.iterations, e.revision, e.enregistre_le], ["demo", 1, SECRET.sel, SECRET.iterations, 1, MAINTENANT.toISOString()]);
  assert.equal(await texteGarde(fabrique), contenu(1, ["a"]));

  // Chaque écriture augmente la révision.
  for (const n of [2, 3, 4]) {
    gardien.garder(assembler(["a", n]));
    await gardien.repos();
    assert.equal(gardee(fabrique).revision, n);
    assert.equal(await texteGarde(fabrique), contenu(n, ["a", n]));
  }
  assert.deepEqual(await gardienDe(await onglet(fabrique)).charger(), { texte: contenu(4, ["a", 4]), revision: 4 });
  // Le mode réel, lui, n'a rien reçu.
  assert.deepEqual(await gardienDe(await onglet(fabrique), { mode: "reel" }).charger(), { vide: true });
  assert.throws(() => creerGardien({ magasin: magasinCombatMemoire(), mode: "autre", secret: () => SECRET }), TypeError);
});

test("mode à part — la démonstration et le mode réel gardent chacun leur combat ; recopié sous l'autre mode, un combat ne se lit pas", async () => {
  const fabrique = fabriqueIndexedDB();
  const demo = gardienDe(await onglet(fabrique));
  const reel = gardienDe(await onglet(fabrique), { mode: "reel" });
  await demo.charger();
  await reel.charger();
  demo.garder(assembler(["démonstration"]));
  await demo.repos();
  demo.garder(assembler(["démonstration", "suite"]));
  await demo.repos();
  assert.equal(gardee(fabrique, "reel"), null);
  reel.garder(assembler(["réel"]));
  await reel.repos();
  assert.equal(gardee(fabrique, "demo").revision, 2);
  assert.equal(gardee(fabrique, "reel").revision, 1);
  assert.equal(await texteGarde(fabrique, SECRET, "reel"), contenu(1, ["réel"]));
  assert.equal(await texteGarde(fabrique, SECRET, "demo"), contenu(2, ["démonstration", "suite"]));

  // L'enregistrement de la démonstration, recopié sous le mode réel : la
  // donnée associée ne concorde plus.
  await poser(fabrique, { ...gardee(fabrique, "demo"), mode: "reel" });
  const lecteur = gardienDe(await onglet(fabrique), { mode: "reel" });
  assert.equal((await lecteur.charger()).code, "illisible");
  assert.equal(lecteur.etat(), "illisible");
  // Désarmé : la démonstration, elle, se relit toujours.
  assert.equal((await gardienDe(await onglet(fabrique)).charger()).revision, 2);
});

// Un magasin qui compte ce qu'on lui demande, et qui peut traîner.
// Attend qu'une lecture ou une écriture lente soit partie, sans attendre sans
// fin : si elle ne part jamais, le contrôle échoue au lieu de tourner.
async function unFeu(vu) {
  for (const limite = Date.now() + 5000; vu.lacher.length === 0 && Date.now() < limite; ) await new Promise((resoudre) => setTimeout(resoudre, 1));
  assert.ok(vu.lacher.length > 0, "la lecture ou l'écriture attendue n'est jamais partie");
}

function espionner(magasin, { lent = false } = {}) {
  const vu = { enCours: 0, ensemble: 0, ecritures: [], lectures: 0, lacher: [] };
  const attendreLeFeu = () => (lent ? new Promise((resoudre) => vu.lacher.push(resoudre)) : null);
  return Object.assign(vu, {
    magasin: {
      durable: magasin.durable,
      async lire(mode) {
        vu.lectures += 1;
        const lu = await magasin.lire(mode);
        await attendreLeFeu();
        return lu;
      },
      async ecrireSi(enregistrement, attendue) {
        vu.enCours += 1;
        vu.ensemble = Math.max(vu.ensemble, vu.enCours);
        try {
          await attendreLeFeu();
          const issue = await magasin.ecrireSi(enregistrement, attendue);
          vu.ecritures.push([enregistrement.revision, attendue, issue.ecrit]);
          return issue;
        } finally {
          vu.enCours -= 1;
        }
      },
    },
  });
}

test("garder — rien de lourd dans le tour de l'appel : le texte s'assemble un tour plus tard, et les demandes venues entre-temps ne font qu'une écriture", async () => {
  const fabrique = fabriqueIndexedDB();
  const vu = espionner(await onglet(fabrique));
  let lectures = 0;
  const gardien = gardienDe(vu.magasin, { secret: () => ((lectures += 1), SECRET) });
  await gardien.charger();
  const apresChargement = lectures;
  const assembles = [];
  const demande = (n) => (revision) => (assembles.push(n), contenu(revision, [n]));

  gardien.garder(demande(1));
  // Dans le tour de l'appel, la file est prise et « Enregistrement… » se dit ;
  // mais ni la clé n'est lue, ni le texte assemblé, ni rien encodé.
  assert.equal(gardien.etat(), "ecriture");
  assert.deepEqual(gardien.annonces, ["ecriture"]);
  assert.deepEqual(assembles, []);
  assert.equal(lectures, apresChargement);
  // Ni dans les microtâches de ce tour : elles passent avant que l'écouteur
  // d'un clic ait rendu la main à la page.
  for (let fois = 0; fois < 100; fois += 1) await Promise.resolve();
  assert.deepEqual(assembles, [], "rien ne part dans les microtâches du clic");
  assert.equal(lectures, apresChargement);

  // Deux demandes de plus avant le départ : une seule écriture, celle de la dernière.
  gardien.garder(demande(2));
  gardien.garder(demande(3));
  await gardien.repos();
  assert.deepEqual(assembles, [3]);
  assert.equal(lectures, apresChargement + 1);
  assert.deepEqual(vu.ecritures, [[1, 0, true]]);
  assert.equal(await texteGarde(fabrique), contenu(1, [3]));
  assert.deepEqual(gardien.annonces, ["ecriture", "garde"], "une seule alternance pour toute la rafale");
});

test("file — une seule place : jamais deux écritures à la fois, et la dernière demande remplace celle qui attendait", async () => {
  const fabrique = fabriqueIndexedDB();
  const vu = espionner(await onglet(fabrique), { lent: true });
  const gardien = gardienDe(vu.magasin);
  const chargement = gardien.charger();
  await unFeu(vu);
  vu.lacher.shift()();
  await chargement;
  const assembles = [];
  const demande = (n) => (revision) => (assembles.push(n), contenu(revision, [n]));

  // La première part, et attend dans la base ; neuf autres arrivent pendant qu'elle écrit.
  gardien.garder(demande(1));
  await unFeu(vu);
  for (let n = 2; n <= 10; n += 1) gardien.garder(demande(n));
  await new Promise((suite) => setTimeout(suite, 20));
  assert.deepEqual(assembles, [1], "rien d'autre ne s'assemble tant que la première écrit");
  assert.equal(vu.enCours, 1);
  assert.equal(vu.lacher.length, 1, "ni ne part vers la base");
  // Elle finit : des neuf autres, seule la dernière est écrite, après elle.
  vu.lacher.shift()();
  await unFeu(vu);
  assert.deepEqual(assembles, [1, 10]);
  // Une demande de plus pendant cette seconde écriture : elle attend son tour, elle aussi.
  gardien.garder(demande(11));
  vu.lacher.shift()();
  await unFeu(vu);
  vu.lacher.shift()();
  await gardien.repos();
  assert.deepEqual(assembles, [1, 10, 11]);
  assert.deepEqual(vu.ecritures, [
    [1, 0, true],
    [2, 1, true],
    [3, 2, true],
  ]);
  assert.equal(vu.ensemble, 1, "jamais deux écritures à la fois");
  assert.equal(await texteGarde(fabrique), contenu(3, [11]));
  assert.deepEqual(gardien.annonces, ["ecriture", "garde"], "une seule alternance pour toute la file");
});

test("révision — deux onglets : celui qui trouve une autre révision que la sienne n'écrase rien, le dit, et reprend le plus récent", async () => {
  const fabrique = fabriqueIndexedDB();
  const a = gardienDe(await onglet(fabrique));
  const b = gardienDe(await onglet(fabrique));
  await a.charger();
  a.garder(assembler(["A1"]));
  await a.repos();
  a.garder(assembler(["A1", "A2"]));
  await a.repos();
  assert.deepEqual(await b.charger(), { texte: contenu(2, ["A1", "A2"]), revision: 2 });
  a.garder(assembler(["A1", "A2", "A3"]));
  await a.repos();

  // B, en retard d'une révision, joue : rien ne s'écrit.
  b.garder(assembler(["A1", "A2", "B3"]));
  await b.repos();
  assert.equal(b.etat(), "ailleurs");
  assert.equal(b.phrase(), "Combat ouvert ailleurs");
  assert.deepEqual(b.annonces, ["ecriture", "ailleurs"]);
  assert.equal(gardee(fabrique).revision, 3);
  assert.equal(await texteGarde(fabrique), contenu(3, ["A1", "A2", "A3"]));
  // Tant qu'il n'a pas repris, il n'écrit plus : pas même une transaction.
  const transactions = fabrique.journal.transactions.length;
  b.garder(assembler(["A1", "A2", "B3", "B4"]));
  await b.repos();
  assert.equal(b.etat(), "ailleurs");
  assert.equal(fabrique.journal.transactions.length, transactions);
  assert.equal(a.etat(), "garde", "l'onglet à jour n'en sait rien");

  // « Reprendre le combat le plus récent », puis jouer : B écrit, à la suite.
  assert.deepEqual(await b.reprendre(), { texte: contenu(3, ["A1", "A2", "A3"]), revision: 3 });
  assert.equal(b.etat(), "garde");
  b.garder(assembler(["A1", "A2", "A3", "B4"]));
  await b.repos();
  assert.equal(gardee(fabrique).revision, 4);

  // À son tour, A est en retard.
  a.garder(assembler(["A1", "A2", "A3", "A4"]));
  await a.repos();
  assert.equal(a.etat(), "ailleurs");
  assert.equal(await texteGarde(fabrique), contenu(4, ["A1", "A2", "A3", "B4"]));

  // Deux onglets à jour qui écrivent en même temps : un seul passe.
  await a.reprendre();
  a.garder(assembler(["de A"]));
  b.garder(assembler(["de B"]));
  await Promise.all([a.repos(), b.repos()]);
  assert.deepEqual([a.etat(), b.etat()].sort(), ["ailleurs", "garde"]);
  assert.equal(gardee(fabrique).revision, 5);
  const gagnant = a.etat() === "garde" ? "de A" : "de B";
  assert.equal(await texteGarde(fabrique), contenu(5, [gagnant]));
  // Du début à la fin : aucune écriture n'a eu sa lecture dans une autre transaction.
  const ecritures = fabrique.journal.transactions.filter((t) => t.acces === "readwrite").length;
  assert.equal(ecritures, 8, "une transaction par écriture tentée, refus compris");
  assert.equal(fabrique.journal.ecritures.length, 5);
});

test("révision — elle ne redescend pas : un combat vide s'écrit à la révision suivante, et l'onglet ancien ne l'écrase pas", async () => {
  const fabrique = fabriqueIndexedDB();
  const a = gardienDe(await onglet(fabrique));
  const b = gardienDe(await onglet(fabrique));
  await a.charger();
  for (const n of [1, 2, 3]) {
    a.garder(assembler([n]));
    await a.repos();
  }
  await b.charger();
  // « Nouveau combat » dans A : un combat vide, à la révision 4.
  a.garder(assembler([]));
  await a.repos();
  assert.equal(gardee(fabrique).revision, 4);
  // B, resté sur l'ancien combat, joue : le combat neuf n'est pas écrasé.
  b.garder(assembler([1, 2, 3, "B"]));
  await b.repos();
  assert.equal(b.etat(), "ailleurs");
  assert.equal(await texteGarde(fabrique), contenu(4, []));
});

test("clé — relue à chaque écriture : un mot de passe changé pendant la visite rechiffre le combat sous la clé neuve", async () => {
  const fabrique = fabriqueIndexedDB();
  let courant = SECRET;
  let lectures = 0;
  const gardien = gardienDe(await onglet(fabrique), { secret: () => ((lectures += 1), courant) });
  await gardien.charger();
  const apresChargement = lectures;
  gardien.garder(assembler(["a"]));
  await gardien.repos();
  assert.equal(lectures, apresChargement + 1);
  assert.equal(gardee(fabrique).sel, SECRET.sel);

  courant = AUTRE;
  gardien.garder(assembler(["a", "b"]));
  await gardien.repos();
  assert.equal(lectures, apresChargement + 2);
  assert.equal(gardee(fabrique).sel, AUTRE.sel);
  assert.equal(gardee(fabrique).revision, 2);
  assert.equal(await texteGarde(fabrique, AUTRE), contenu(2, ["a", "b"]));
  assert.equal((await dechiffrerCombat(gardee(fabrique), SECRET, { mode: "demo" })).code, "cle");

  // La clé disparaît pendant la visite : rien ne s'écrit, le combat reste en mémoire.
  courant = null;
  gardien.garder(assembler(["a", "b", "c"]));
  await gardien.repos();
  assert.equal(gardien.etat(), "sans_cle");
  assert.equal(gardien.phrase(), "Combat non gardé : le mot de passe de table a changé.");
  assert.equal(gardee(fabrique).revision, 2);
  courant = { sel: AUTRE.sel, iterations: AUTRE.iterations };
  gardien.garder(assembler(["a", "b", "c"]));
  await gardien.repos();
  assert.equal(gardien.etat(), "sans_cle");
  // Elle revient : l'écriture suivante porte tout le combat.
  courant = AUTRE;
  gardien.garder(assembler(["a", "b", "c", "d"]));
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.equal(await texteGarde(fabrique, AUTRE), contenu(3, ["a", "b", "c", "d"]));
});

test("mot de passe changé — à l'ouverture, le combat ne se lit plus ; « Nouveau combat » s'écrit au-dessus, sous la clé du jour", async () => {
  const fabrique = fabriqueIndexedDB();
  const ancien = gardienDe(await onglet(fabrique));
  await ancien.charger();
  for (const n of [1, 2, 3]) {
    ancien.garder(assembler([n]));
    await ancien.repos();
  }
  const avant = gardee(fabrique);

  const gardien = gardienDe(await onglet(fabrique), { secret: () => AUTRE });
  assert.deepEqual(await gardien.charger(), { erreur: "Le combat gardé est chiffré avec une autre clé de table : le mot de passe de table a changé.", code: "cle" });
  assert.equal(gardien.etat(), "illisible");
  assert.equal(gardien.phrase(), "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).");
  assert.deepEqual(gardien.annonces, ["illisible"]);
  assert.deepEqual(gardee(fabrique), avant, "l'ancien reste, illisible");

  gardien.garder(assembler([]));
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.equal(gardee(fabrique).revision, 4);
  assert.equal(await texteGarde(fabrique, AUTRE), contenu(4, []));
  // Désarmé : avec la clé d'origine, le même enregistrement se lisait.
  assert.equal((await dechiffrerCombat(avant, SECRET, { mode: "demo" })).texte, contenu(3, [3]));
});

test("donnée abîmée — à l'ouverture, « illisible » ; rien n'est touché avant « Nouveau combat », qui s'écrit toujours", async () => {
  const fabrique = fabriqueIndexedDB();
  const e = await chiffrer(contenu(6), { revision: 6 });
  const abime = { ...e, chiffre: `${e.chiffre[0] === "A" ? "B" : "A"}${e.chiffre.slice(1)}` };
  await poser(fabrique, abime);
  const gardien = gardienDe(await onglet(fabrique));
  assert.deepEqual(await gardien.charger(), { erreur: "Le combat gardé ne se déchiffre pas : il est abîmé.", code: "illisible" });
  assert.equal(gardien.etat(), "illisible");
  assert.equal(gardien.phrase(), PHRASES_DE_GARDE.illisible);
  assert.deepEqual(gardee(fabrique), abime);
  assert.equal(fabrique.journal.ecritures.length, 1, "la seule écriture est celle qui a posé la donnée");
  gardien.garder(assembler([]));
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.equal(gardee(fabrique).revision, 7);
  assert.deepEqual(await gardienDe(await onglet(fabrique)).charger(), { texte: contenu(7, []), revision: 7 });
});

test("donnée abîmée — une révision qui ne se lit pas, ou démesurée, vaut 0 : « Nouveau combat » s'écrit à la révision 1, puis se relit", async () => {
  // Les deux dernières : un enregistrement sain en tout, sauf sa révision,
  // posée à la main au-delà de sa borne (elle est en clair, hors de ce que
  // le chiffrement protège). Sans la borne, plus rien ne s'écrivait par-dessus.
  const sain = await chiffrer(contenu(6), { revision: 6 });
  for (const abime of [
    { mode: "demo", format: 1, revision: "sept", chiffre: "…" },
    { mode: "demo", revision: -3 },
    { mode: "demo" },
    { ...sain, revision: Number.MAX_SAFE_INTEGER },
    { ...sain, revision: REVISION_MAX + 1 },
  ]) {
    const fabrique = fabriqueIndexedDB();
    await poser(fabrique, abime);
    const gardien = gardienDe(await onglet(fabrique));
    assert.equal((await gardien.charger()).code, "illisible");
    assert.equal(gardien.etat(), "illisible");
    gardien.garder(assembler([]));
    await gardien.repos();
    // Sans la règle commune, l'écriture serait refusée, puis « Reprendre »
    // relirait la même donnée, sans issue.
    assert.equal(gardien.etat(), "garde");
    assert.equal(gardee(fabrique).revision, 1);
    assert.deepEqual(await gardienDe(await onglet(fabrique)).charger(), { texte: contenu(1, []), revision: 1 });
  }
});

test("révision — à sa borne, elle repart de 1 : un enregistrement posé là ne rend pas le combat ingardable", async () => {
  // Un combat forgé avec la bonne clé, à la borne exacte et un cran dessous : il se lit.
  for (const [posee, suivantes] of [
    [REVISION_MAX, [1, 2]],
    [REVISION_MAX - 1, [REVISION_MAX, 1]],
  ]) {
    const fabrique = fabriqueIndexedDB();
    await poser(fabrique, await chiffrer(contenu(posee, ["gardé"]), { revision: posee }));
    const vu = espionner(await onglet(fabrique));
    const gardien = gardienDe(vu.magasin);
    assert.deepEqual(await gardien.charger(), { texte: contenu(posee, ["gardé"]), revision: posee });
    for (const [rang, attendue] of suivantes.entries()) {
      gardien.garder(assembler(["gardé", rang]));
      await gardien.repos();
      assert.equal(gardien.etat(), "garde", `après ${posee}, la révision ${attendue} s'écrit`);
      assert.equal(gardee(fabrique).revision, attendue);
      assert.equal(await texteGarde(fabrique), contenu(attendue, ["gardé", rang]));
    }
    // Chaque écriture attendait la révision gardée, exactement : la comparaison n'est pas levée.
    assert.deepEqual(vu.ecritures, [[suivantes[0], posee, true], [suivantes[1], suivantes[0], true]]);
    assert.deepEqual(await gardienDe(await onglet(fabrique)).charger(), { texte: contenu(suivantes[1], ["gardé", 1]), revision: suivantes[1] });
  }
});

test("enveloppe longue — à l'ouverture, un chiffré démesuré est « illisible » ; « Nouveau combat » s'écrit par-dessus", async () => {
  const sain = await chiffrer(contenu(6), { revision: 6 });
  for (const signes of [5 * 1024 * 1024, 12 * 1024 * 1024]) {
    const fabrique = fabriqueIndexedDB();
    const longue = { ...sain, chiffre: "A".repeat(signes) };
    await poser(fabrique, longue);
    const gardien = gardienDe(await onglet(fabrique));
    assert.deepEqual(await gardien.charger(), { erreur: "Le combat gardé ne se déchiffre pas : il est abîmé.", code: "illisible" }, `${signes} signes`);
    assert.equal(gardien.etat(), "illisible");
    assert.equal(gardien.phrase(), PHRASES_DE_GARDE.illisible);
    assert.equal(gardee(fabrique).chiffre.length, signes, "rien n'est touché avant « Nouveau combat »");
    gardien.garder(assembler([]));
    await gardien.repos();
    assert.equal(gardien.etat(), "garde");
    assert.equal(gardee(fabrique).revision, 7);
    assert.deepEqual(await gardienDe(await onglet(fabrique)).charger(), { texte: contenu(7, []), revision: 7 });
  }
});

test("charger — une levée du déchiffrement ne remonte pas : le combat gardé est « illisible », et reste remplaçable", async () => {
  const fabrique = fabriqueIndexedDB();
  await poser(fabrique, await chiffrer(contenu(6, ["gardé"]), { revision: 6 }));
  // Un secret dont la lecture lève : rien, dans le déchiffrement, ne s'y attend.
  const casse = { cle: SECRET.cle, iterations: SECRET.iterations };
  Object.defineProperty(casse, "sel", { enumerable: true, get: () => { throw new RangeError("Maximum call stack size exceeded"); } });
  await assert.rejects(dechiffrerCombat(gardee(fabrique), casse, { mode: "demo" }), RangeError, "armé : le déchiffrement, seul, lève bien");

  let courant = casse;
  const gardien = gardienDe(await onglet(fabrique), { secret: () => courant });
  assert.deepEqual(await gardien.charger(), { erreur: "Le combat gardé ne se déchiffre pas : il est abîmé.", code: "illisible" });
  assert.equal(gardien.etat(), "illisible");
  assert.equal(gardien.phrase(), PHRASES_DE_GARDE.illisible);
  assert.deepEqual(gardien.annonces, ["illisible"]);
  assert.equal(gardee(fabrique).revision, 6, "rien n'est touché");
  // « Nouveau combat » s'écrit au-dessus de la révision gardée, que le gardien a lue malgré la levée.
  courant = SECRET;
  gardien.garder(assembler([]));
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.equal(gardee(fabrique).revision, 7);
  assert.equal(await texteGarde(fabrique), contenu(7, []));

  // Désarmé : avec un secret sain, le même enregistrement se relisait.
  const autre = fabriqueIndexedDB();
  await poser(autre, await chiffrer(contenu(6, ["gardé"]), { revision: 6 }));
  assert.deepEqual(await gardienDe(await onglet(autre)).charger(), { texte: contenu(6, ["gardé"]), revision: 6 });
});

test("format plus récent — une enveloppe de format 2 à neuf clés : « rechargez la page », et rien ne s'écrit par-dessus", async () => {
  const fabrique = fabriqueIndexedDB();
  const futur = { ...(await chiffrer(contenu(7), { revision: 7 })), format: 2, etiquette: "neuve" };
  assert.equal(Object.keys(futur).length, 9);
  await poser(fabrique, futur);
  const gardien = gardienDe(await onglet(fabrique));
  assert.deepEqual(await gardien.charger(), { erreur: "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.", code: "format_recent" });
  assert.equal(gardien.etat(), "recent");
  assert.equal(gardien.phrase(), "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.");
  const transactions = fabrique.journal.transactions.length;
  gardien.garder(assembler([]));
  await gardien.repos();
  // La séance ne peut pas non plus le rendre remplaçable.
  gardien.declarer("illisible");
  gardien.garder(assembler([]));
  await gardien.repos();
  assert.equal(gardien.etat(), "recent");
  assert.deepEqual(gardee(fabrique), futur);
  assert.equal(fabrique.journal.transactions.length, transactions);
  // Désarmé : au format connu, la même enveloppe à neuf clés est abîmée, et se remplace.
  await poser(fabrique, { ...futur, format: 1 });
  const present = gardienDe(await onglet(fabrique));
  assert.equal((await present.charger()).code, "illisible");
  present.garder(assembler([]));
  await present.repos();
  assert.equal(gardee(fabrique).revision, 8);
});

test("sans clé — la banque ouverte sans clé de table : rien ne se déchiffre ni ne s'écrit, et la phrase dit s'il y avait un combat", async () => {
  const fabrique = fabriqueIndexedDB();
  for (const secret of [() => null, () => undefined, () => ({ sel: SECRET.sel, iterations: SECRET.iterations })]) {
    const vide = gardienDe(await onglet(fabrique), { secret });
    assert.deepEqual(await vide.charger(), { erreur: "Combat non gardé : le mot de passe de table a changé.", code: "sans_cle" });
    assert.equal(vide.etat(), "sans_cle");
    assert.equal(vide.phrase(), "Combat non gardé : le mot de passe de table a changé.");
    vide.garder(assembler(["en mémoire"]));
    await vide.repos();
    assert.equal(gardee(fabrique), null);
  }

  const e = await chiffrer(contenu(2), { revision: 2 });
  await poser(fabrique, e);
  let courant = null;
  const gardien = gardienDe(await onglet(fabrique), { secret: () => courant });
  assert.deepEqual(await gardien.charger(), { erreur: "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).", code: "sans_cle" });
  assert.equal(gardien.etat(), "sans_cle");
  assert.equal(gardien.phrase(), PHRASES_DE_GARDE.illisible);
  // La clé revient pendant la visite : le combat gardé n'a pas été lu, il
  // n'est donc pas écrasé par celui de la mémoire.
  courant = SECRET;
  gardien.garder(assembler(["en mémoire"]));
  await gardien.repos();
  gardien.declarer("illisible");
  gardien.garder(assembler(["en mémoire"]));
  await gardien.repos();
  assert.equal(gardien.etat(), "sans_cle");
  assert.deepEqual(gardee(fabrique), e);
  // Un nouveau chargement, la clé revenue : le combat se reprend.
  assert.deepEqual(await gardien.charger(), { texte: contenu(2), revision: 2 });
  assert.equal(gardien.etat(), "garde");
});

test("déclarer — la séance dit qu'un texte déchiffré ne se reprend pas ; « Nouveau combat » le remplace", async () => {
  for (const [declare, phrase] of [
    ["illisible", "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée)."],
    ["autre_version", "Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas."],
  ]) {
    const fabrique = fabriqueIndexedDB();
    await poser(fabrique, await chiffrer("ceci n'est pas un combat", { revision: 5 }));
    const gardien = gardienDe(await onglet(fabrique));
    assert.deepEqual(await gardien.charger(), { texte: "ceci n'est pas un combat", revision: 5 });
    assert.equal(gardien.etat(), "garde");
    gardien.declarer(declare);
    assert.equal(gardien.etat(), declare);
    assert.equal(gardien.phrase(), phrase);
    assert.deepEqual(gardien.annonces, [declare]);
    assert.equal(gardee(fabrique).revision, 5, "déclarer n'écrit rien");
    gardien.garder(assembler([]));
    await gardien.repos();
    assert.equal(gardien.etat(), "garde");
    assert.equal(await texteGarde(fabrique), contenu(6, []));
  }
  const gardien = gardienDe(magasinCombatMemoire());
  for (const etat of ["garde", "ailleurs", "recent", "memoire", "sans_cle", "ecriture", "", undefined]) {
    assert.throws(() => gardien.declarer(etat), TypeError);
  }
});

test("écriture qui échoue — quota, combat trop gros, assemblage qui lève, base fermée : « ne garde pas le combat », et plus aucune écriture", async () => {
  const pannes = {
    "le navigateur refuse l'écriture": (fabrique) => {
      fabrique.pannes.ecritureEchoue = true;
      return assembler(["b"]);
    },
    "le combat dépasse la borne": () => () => "a".repeat(TAILLE_MAX_COMBAT + 1),
    "l'assemblage lève": () => () => {
      throw new Error("panne");
    },
    "l'assemblage ne rend pas un texte": () => () => ({ regles: 1 }),
    "la base s'est fermée": async (fabrique) => {
      const montee = fabrique.open(NOM_BASE, 2);
      await borner(new Promise((resoudre) => (montee.onsuccess = resoudre)), "la montée de version");
      return assembler(["b"]);
    },
  };
  for (const [nom, armer] of Object.entries(pannes)) {
    const fabrique = fabriqueIndexedDB();
    const gardien = gardienDe(await onglet(fabrique));
    await gardien.charger();
    gardien.garder(assembler(["a"]));
    await gardien.repos();
    const avant = gardee(fabrique);
    gardien.annonces.length = 0;

    gardien.garder(await armer(fabrique));
    await gardien.repos();
    assert.equal(gardien.etat(), "memoire", nom);
    assert.equal(gardien.phrase(), "Ce navigateur ne garde pas le combat", nom);
    // La file est prise dès la demande, et le texte assemblé un tour plus tard :
    // « Enregistrement… » paraît d'abord, même quand c'est l'assemblage qui échoue.
    assert.deepEqual(gardien.annonces, ["ecriture", "memoire"], nom);
    assert.deepEqual(gardee(fabrique), avant, `${nom} : l'écriture d'avant reste`);
    // La panne levée, le gardien n'écrit plus : le combat continue en mémoire.
    fabrique.pannes.ecritureEchoue = false;
    const transactions = fabrique.journal.transactions.length;
    gardien.garder(assembler(["a", "c"]));
    await gardien.repos();
    assert.equal(gardien.etat(), "memoire", nom);
    assert.equal(fabrique.journal.transactions.length, transactions, nom);
  }
});

test("lecture qui échoue — la base ne se lit pas : le combat part de rien, en mémoire, et rien ne s'y écrit", async () => {
  const ecrits = [];
  const magasin = {
    durable: true,
    lire: () => Promise.reject(new Error("base fermée")),
    ecrireSi: async (e) => (ecrits.push(e), { ecrit: true }),
  };
  const gardien = gardienDe(magasin);
  assert.deepEqual(await gardien.charger(), { vide: true });
  assert.equal(gardien.etat(), "memoire");
  gardien.garder(assembler(["a"]));
  await gardien.repos();
  assert.deepEqual(ecrits, []);
});

test("phrases — celles de la mission et des arbitrages, mot pour mot ; les changements s'annoncent une fois", async () => {
  assert.deepEqual(PHRASES_DE_GARDE, {
    garde: "Combat gardé sur cet appareil",
    ecriture: "Enregistrement…",
    memoire: "Ce navigateur ne garde pas le combat",
    ailleurs: "Combat ouvert ailleurs",
    illisible: "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).",
    recent: "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.",
    autre_version: "Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas.",
    sans_cle: "Combat non gardé : le mot de passe de table a changé.",
  });
  assert.ok(Object.isFrozen(PHRASES_DE_GARDE));
  const insecables = [0x00a0, 0x202f].map((code) => String.fromCodePoint(code));
  for (const phrase of Object.values(PHRASES_DE_GARDE)) assert.ok(!insecables.some((signe) => phrase.includes(signe)), phrase);

  // Un abonné qui se retire n'entend plus rien ; rien ne s'annonce sans changement.
  const fabrique = fabriqueIndexedDB();
  const gardien = creerGardien({ magasin: await onglet(fabrique), mode: "demo", secret: () => SECRET });
  const entendus = [];
  const retirer = gardien.surChangement((etat) => entendus.push(etat));
  await gardien.charger();
  assert.deepEqual(entendus, [], "rien de gardé : l'état reste « garde »");
  gardien.garder(assembler(["a"]));
  await gardien.repos();
  assert.deepEqual(entendus, ["ecriture", "garde"]);
  retirer();
  gardien.garder(assembler(["a", "b"]));
  await gardien.repos();
  assert.deepEqual(entendus, ["ecriture", "garde"]);
  // Sans horloge donnée : celle de l'instant.
  assert.ok(Math.abs(Date.parse(gardee(fabrique).enregistre_le) - Date.now()) < 60_000);
});

// ─── « Oublier le mot de passe » ────────────────────────────────────────────

test("oublier — pendant une lecture lente : le chargement parti avant l'oubli ne rend rien, et rien ne s'écrit ensuite", async () => {
  const fabrique = fabriqueIndexedDB();
  await poser(fabrique, await chiffrer(contenu(4, ["gardé"]), { revision: 4 }));
  const avant = gardee(fabrique);

  // Désarmé d'abord : la même lecture lente, sans oubli, rend le combat.
  const temoin = espionner(await onglet(fabrique), { lent: true });
  const sansOubli = gardienDe(temoin.magasin);
  const lecture = sansOubli.charger();
  await unFeu(temoin);
  temoin.lacher.shift()();
  assert.deepEqual(await lecture, { texte: contenu(4, ["gardé"]), revision: 4 });

  const vu = espionner(await onglet(fabrique), { lent: true });
  const gardien = gardienDe(vu.magasin);
  const chargement = gardien.charger();
  await unFeu(vu);
  gardien.oublier();
  vu.lacher.shift()();
  const issue = await chargement;
  assert.equal("texte" in issue, false, "le combat ne revient pas en mémoire");
  assert.equal("vide" in issue, false, "et l'écran n'en commence pas un neuf par-dessus");
  assert.equal(issue.code, "sans_cle");
  // Le gardien a oublié la révision : il n'écrit plus.
  gardien.garder(assembler(["après l'oubli"]));
  await borner(gardien.repos(), "le repos du gardien après l'oubli");
  assert.equal(vu.ecritures.length, 0);
  assert.deepEqual(gardee(fabrique), avant, "le combat chiffré reste dans la base");

  // Le mot de passe ressaisi dans la même visite : le combat se relit.
  const reprise = gardien.charger();
  await unFeu(vu);
  vu.lacher.shift()();
  assert.deepEqual(await reprise, { texte: contenu(4, ["gardé"]), revision: 4 });
});

test("oublier — la file se vide : l'écriture en attente ne part pas, celle qui se chiffrait n'atteint pas la base", async () => {
  const fabrique = fabriqueIndexedDB();
  const vu = espionner(await onglet(fabrique));
  const gardien = gardienDe(vu.magasin);
  await gardien.charger();
  gardien.garder(assembler(["a"]));
  await gardien.repos();

  // Deux demandes : la seconde arrive pendant que la première se chiffre, et
  // « entre » se glisse juste après elle.
  async function deuxDemandes(leGardien, assembles, entre = () => {}) {
    await new Promise((partie) => {
      leGardien.garder((revision) => (assembles.push("première"), partie(), contenu(revision, ["a", "b"])));
    });
    leGardien.garder((revision) => (assembles.push("seconde"), contenu(revision, ["a", "b", "c"])));
    entre();
    await leGardien.repos();
  }

  const assembles = [];
  await deuxDemandes(gardien, assembles, () => gardien.oublier());
  await new Promise((resoudre) => setTimeout(resoudre, 20));
  assert.deepEqual(assembles, ["première"], "la demande en attente n'a pas été assemblée");
  assert.deepEqual(vu.ecritures, [[1, 0, true]], "aucune écriture après l'oubli");
  assert.equal(await texteGarde(fabrique), contenu(1, ["a"]));
  gardien.garder(assembler(["encore"]));
  await gardien.repos();
  assert.equal(vu.ecritures.length, 1);

  // Une demande qui n'est pas encore partie ne part pas non plus après l'oubli.
  const patient = gardienDe(await onglet(fabrique));
  await patient.charger();
  const partis = [];
  patient.garder((revision) => (partis.push("jamais"), contenu(revision, ["a", "z"])));
  patient.oublier();
  await patient.repos();
  await new Promise((resoudre) => setTimeout(resoudre, 20));
  assert.deepEqual(partis, []);
  assert.equal(await texteGarde(fabrique), contenu(1, ["a"]));

  // Désarmé : sans oubli, les deux mêmes demandes s'écrivent, l'une après l'autre.
  const autre = gardienDe(await onglet(fabrique));
  await autre.charger();
  const ecrites = [];
  await deuxDemandes(autre, ecrites);
  assert.deepEqual(ecrites, ["première", "seconde"]);
  assert.equal(await texteGarde(fabrique), contenu(3, ["a", "b", "c"]));
});

test("oublier — pendant une écriture lente : son issue n'est pas retenue, et le gardien ne garde aucune clé", async () => {
  const fabrique = fabriqueIndexedDB();
  const vu = espionner(await onglet(fabrique), { lent: true });
  let lectures = 0;
  const gardien = gardienDe(vu.magasin, { secret: () => ((lectures += 1), SECRET) });
  const chargement = gardien.charger();
  await unFeu(vu);
  vu.lacher.shift()();
  await chargement;
  gardien.garder(assembler(["a"]));
  await unFeu(vu);
  // L'écriture est partie vers la base ; l'oubli arrive.
  gardien.oublier();
  const apresOubli = lectures;
  vu.lacher.shift()();
  await gardien.repos();
  gardien.garder(assembler(["a", "b"]));
  await borner(gardien.repos(), "le repos du gardien après l'oubli");
  assert.equal(lectures, apresOubli, "après l'oubli, la clé n'est plus demandée");
  assert.equal(vu.ecritures.length, 1);
  assert.deepEqual(gardien.annonces.at(-1), "garde");
});

// ─── Rien en clair ──────────────────────────────────────────────────────────

// Les valeurs longues et propres à la banque : des textes d'au moins douze
// signes qui portent une espace ou un accent. Des mots courts paraîtraient
// par hasard dans du base64, et « sel » est le nom d'un champ.
function valeursLongues(donnee, trouvees = new Set()) {
  if (typeof donnee === "string") {
    if (donnee.length >= 12 && /[ à-ÿ]/.test(donnee) && !/["\\\n\r\t]/.test(donnee)) trouvees.add(donnee);
  } else if (donnee && typeof donnee === "object") {
    for (const valeur of Object.values(donnee)) valeursLongues(valeur, trouvees);
  }
  return trouvees;
}
// Tout ce qu'une donnée porte de texte, clés comprises, mis bout à bout.
function textesDe(donnee, morceaux = []) {
  if (typeof donnee === "string") morceaux.push(donnee);
  else if (Array.isArray(donnee)) for (const valeur of donnee) textesDe(valeur, morceaux);
  else if (donnee && typeof donnee === "object") {
    for (const [cle, valeur] of Object.entries(donnee)) {
      morceaux.push(cle);
      textesDe(valeur, morceaux);
    }
  }
  return morceaux;
}
const fuites = (donnee, valeurs) => {
  const tout = textesDe(donnee).join("\n");
  return [...valeurs].filter((valeur) => tout.includes(valeur));
};

test("rien en clair — aucune valeur de la banque dans la base du combat ni dans localStorage ; le module n'ouvre rien à l'import", async () => {
  const valeurs = valeursLongues(BANQUE);
  assert.ok(valeurs.size >= 100, `la démonstration donne assez de valeurs à chercher (${valeurs.size})`);
  // Un combat qui porte toute la banque : chacune de ses valeurs est dans le clair.
  const charge = (revision, evenements) => JSON.stringify({ regles: 1, revision, miseEnPlace: { mode: "demo", banque: BANQUE }, evenements });
  assert.equal(fuites({ texte: charge(1, []) }, valeurs).length, valeurs.size, "armé : le clair, lui, porte toutes les valeurs");

  const fabrique = fabriqueIndexedDB();
  const journal = simulerStockage({}, { indexedDB: fabrique });
  try {
    await import("../js/combat/enregistrement.js?instance=rien-en-clair");
    assert.equal(journal.ouvertures, 0, "l'import n'ouvre aucune base");
    const magasin = await ouvrirMagasinCombat();
    assert.equal(magasin.durable, true);
    assert.equal(journal.ouvertures, 1);

    const gardien = gardienDe(magasin);
    await gardien.charger();
    for (const evenements of [[], [{ type: "de", valeurs: [7] }], [{ type: "de", valeurs: [7] }, { type: "regler", raison: [...valeurs][0] }]]) {
      gardien.garder((revision) => charge(revision, evenements));
      await gardien.repos();
    }
    // Le combat réel, dans la même base, et un combat que la clé du jour ne lit plus.
    const reel = gardienDe(await ouvrirMagasinCombat(), { mode: "reel" });
    await reel.charger();
    reel.garder((revision) => charge(revision, []));
    await reel.repos();
    const change = gardienDe(await ouvrirMagasinCombat(), { secret: () => AUTRE });
    await change.charger();
    change.garder((revision) => charge(revision, []));
    await change.repos();
    assert.equal(gardien.etat(), "garde");
    assert.equal(change.etat(), "garde");

    // Ce que la base garde, et tout ce qui y a été écrit, même remplacé depuis.
    const base = fabrique.contenu(NOM_BASE);
    assert.deepEqual(Object.keys(base), ["combats"]);
    assert.deepEqual(Object.keys(base.combats).sort(), ["demo", "reel"]);
    assert.equal(fabrique.journal.ecritures.length, 5);
    assert.deepEqual(fuites(base, valeurs), []);
    assert.deepEqual(fuites(fabrique.journal.ecritures, valeurs), []);
    // Plus fort : hors du mode, la base ne porte que du base64, des noms de
    // champ et une date. Aucun texte n'y a d'espace ni d'accent.
    for (const { valeur } of fabrique.journal.ecritures) {
      assert.deepEqual(Object.keys(valeur), CHAMPS);
      for (const texte of textesDe(valeur)) assert.match(texte, /^[A-Za-z0-9+/=_:.-]*$/);
    }
    // Le texte se retrouve pourtant, entier, avec la clé : celle du jour
    // pour la démonstration, que le dernier gardien a rechiffrée.
    for (const [mode, secret] of [["reel", SECRET], ["demo", AUTRE]]) {
      const relu = JSON.parse(await texteGarde(fabrique, secret, mode));
      assert.deepEqual(relu.miseEnPlace.banque, BANQUE);
      assert.equal(relu.revision, gardee(fabrique, mode).revision);
    }

    // Jamais dans localStorage ni dans sessionStorage : rien ne s'y lit, rien ne s'y écrit.
    assert.deepEqual(journal.lus, []);
    assert.deepEqual(journal.ecrits, []);
    // Ni par le jumeau en mémoire, quand IndexedDB manque.
    const memoire = gardienDe(magasinCombatMemoire());
    await memoire.charger();
    memoire.garder((revision) => charge(revision, []));
    await memoire.repos();
    assert.deepEqual([journal.lus, journal.ecrits, journal.ouvertures], [[], [], 3]);
  } finally {
    journal.retirer();
  }
});

test("rien en clair — le jumeau en mémoire ne tient, lui aussi, que du chiffré", async () => {
  const valeurs = valeursLongues(BANQUE);
  const magasin = magasinCombatMemoire();
  const gardien = gardienDe(magasin);
  await gardien.charger();
  gardien.garder((revision) => JSON.stringify({ regles: 1, revision, miseEnPlace: { mode: "demo", banque: BANQUE }, evenements: [] }));
  await gardien.repos();
  const garde = await magasin.lire("demo");
  assert.deepEqual(Object.keys(garde), CHAMPS);
  assert.deepEqual(fuites(garde, valeurs), []);
  assert.deepEqual(JSON.parse((await dechiffrerCombat(garde, SECRET, { mode: "demo" })).texte).miseEnPlace.banque, BANQUE);
});

// ─── Ce que la mise à l'épreuve a montré sans contrôle ──────────────────────

// Un magasin à la main : ses écritures attendent qu'on les lâche, et rendent
// ce que « issues » leur dicte, dans l'ordre (une fonction lève ou répond ;
// faute d'issue dictée, l'écriture va au fond). Le fond se remplace.
function magasinTenu({ issues = [] } = {}) {
  const tenu = { fond: magasinCombatMemoire(), lectures: 0, ecritures: [], lacher: [] };
  return Object.assign(tenu, {
    magasin: {
      durable: true,
      async lire(mode) {
        tenu.lectures += 1;
        return tenu.fond.lire(mode);
      },
      async ecrireSi(enregistrement, attendue) {
        tenu.ecritures.push([enregistrement.revision, attendue]);
        const dictee = issues.shift();
        await new Promise((resoudre) => tenu.lacher.push(resoudre));
        return dictee ? dictee() : tenu.fond.ecrireSi(enregistrement, attendue);
      },
    },
  });
}
// Attend qu'une écriture soit partie vers le magasin, sans attendre sans fin.
async function ecritureEnVol(tenu) {
  await unFeu(tenu);
  assert.equal(tenu.lacher.length, 1, "une écriture est en vol");
}
const laisserPasser = () => new Promise((resoudre) => setTimeout(resoudre, 20));

test("oublier — pendant une écriture que la base refusera : le refus n'est pas retenu, « Combat ouvert ailleurs » ne paraît pas", async () => {
  const refus = () => ({ ecrit: false, gardee: { revision: 9 } });

  // Désarmé d'abord : sans oubli, le même refus dit « Combat ouvert ailleurs ».
  const temoin = magasinTenu({ issues: [refus] });
  const sansOubli = gardienDe(temoin.magasin);
  await sansOubli.charger();
  sansOubli.garder(assembler(["a"]));
  await ecritureEnVol(temoin);
  temoin.lacher.shift()();
  await sansOubli.repos();
  assert.equal(sansOubli.etat(), "ailleurs");

  const tenu = magasinTenu({ issues: [refus] });
  const gardien = gardienDe(tenu.magasin);
  await gardien.charger();
  gardien.garder(assembler(["a"]));
  await ecritureEnVol(tenu);
  gardien.oublier();
  tenu.lacher.shift()();
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.equal(gardien.phrase(), "Combat gardé sur cet appareil");
  assert.equal(gardien.annonces.includes("ailleurs"), false, "l'issue d'une écriture partie avant l'oubli ne touche plus à rien");
});

test("écriture qui échoue — la demande qui attendait derrière elle ne part pas", async () => {
  const tenu = magasinTenu({
    issues: [
      () => {
        throw new Error("quota dépassé");
      },
    ],
  });
  const gardien = gardienDe(tenu.magasin);
  await gardien.charger();
  const assembles = [];
  gardien.garder((revision) => (assembles.push("première"), contenu(revision, ["a"])));
  await ecritureEnVol(tenu);
  gardien.garder((revision) => (assembles.push("seconde"), contenu(revision, ["a", "b"])));
  tenu.lacher.shift()();
  // Si la seconde partait malgré tout, elle attendrait ici : on la lâche.
  await laisserPasser();
  for (const lacher of tenu.lacher.splice(0)) lacher();
  await gardien.repos();
  assert.deepEqual(assembles, ["première"], "après la panne, plus rien ne s'assemble");
  assert.deepEqual(tenu.ecritures, [[1, 0]], "ni ne part vers la base");
  assert.equal(gardien.etat(), "memoire");
  assert.equal(await tenu.fond.lire("demo"), null);
});

test("charger — pendant une écriture en vol : la lecture attend qu'elle ait fini, et lit ce qu'elle a écrit", async () => {
  const tenu = magasinTenu();
  const gardien = gardienDe(tenu.magasin);
  assert.deepEqual(await gardien.charger(), { vide: true });
  assert.equal(tenu.lectures, 1);
  gardien.garder(assembler(["a"]));
  await ecritureEnVol(tenu);

  const chargement = gardien.charger();
  await laisserPasser();
  assert.equal(tenu.lectures, 1, "la base n'est pas relue tant que l'écriture n'a pas fini");
  tenu.lacher.shift()();
  assert.deepEqual(await chargement, { texte: contenu(1, ["a"]), revision: 1 }, "le gardien relit sa propre écriture, pas la base d'avant elle");
  assert.equal(tenu.lectures, 2);

  // Il repart de la révision lue : sa propre écriture ne lui fait pas dire « ailleurs ».
  gardien.garder(assembler(["a", "b"]));
  await ecritureEnVol(tenu);
  tenu.lacher.shift()();
  await gardien.repos();
  assert.equal(gardien.etat(), "garde");
  assert.deepEqual(tenu.ecritures, [
    [1, 0],
    [2, 1],
  ]);
  assert.equal(revisionDe(await tenu.fond.lire("demo")), 2);
});

test("oublier — pendant la lecture lente d'une base vide : le chargement ne rend pas un combat vide, et rien ne s'écrit ensuite", async () => {
  const fabrique = fabriqueIndexedDB();

  // Désarmé d'abord : la même lecture lente, sans oubli, trouve la base vide.
  const temoin = espionner(await onglet(fabrique), { lent: true });
  const sansOubli = gardienDe(temoin.magasin);
  const lecture = sansOubli.charger();
  await unFeu(temoin);
  temoin.lacher.shift()();
  assert.deepEqual(await lecture, { vide: true });

  const vu = espionner(await onglet(fabrique), { lent: true });
  const gardien = gardienDe(vu.magasin);
  const chargement = gardien.charger();
  await unFeu(vu);
  gardien.oublier();
  vu.lacher.shift()();
  const issue = await chargement;
  assert.equal("vide" in issue, false, "l'écran ne commence pas un combat gardé après l'oubli");
  assert.equal(issue.code, "sans_cle");
  gardien.garder(assembler(["après l'oubli"]));
  await laisserPasser();
  for (const lacher of vu.lacher.splice(0)) lacher();
  await gardien.repos();
  assert.equal(vu.ecritures.length, 0);
  assert.equal(gardee(fabrique), null, "la base reste vide");
});

test("charger — une base retrouvée vide : la révision connue retombe à 0, et le combat s'y garde de nouveau", async () => {
  const tenu = magasinTenu();
  const gardien = gardienDe(tenu.magasin);
  await gardien.charger();
  for (const evenements of [["a"], ["a", "b"]]) {
    gardien.garder(assembler(evenements));
    await ecritureEnVol(tenu);
    tenu.lacher.shift()();
    await gardien.repos();
  }
  assert.equal(revisionDe(await tenu.fond.lire("demo")), 2);

  // Les données du site ont été effacées : la base ne garde plus rien.
  tenu.fond = magasinCombatMemoire();
  assert.deepEqual(await gardien.reprendre(), { vide: true });
  assert.equal(gardien.etat(), "garde");
  gardien.garder(assembler(["neuf"]));
  await ecritureEnVol(tenu);
  tenu.lacher.shift()();
  await gardien.repos();
  assert.equal(gardien.etat(), "garde", "rien de gardé : l'écriture attend la révision 0, et passe");
  assert.deepEqual(tenu.ecritures.at(-1), [1, 0]);
  assert.equal((await dechiffrerCombat(await tenu.fond.lire("demo"), SECRET, { mode: "demo" })).texte, contenu(1, ["neuf"]));
});

test("oublier — pendant le déchiffrement : le combat lu avant l'oubli ne revient pas en mémoire, et rien ne s'écrit ensuite", async () => {
  const fabrique = fabriqueIndexedDB();
  await poser(fabrique, await chiffrer(contenu(4, ["gardé"]), { revision: 4 }));
  const avant = gardee(fabrique);
  // Le gardien demande la clé juste après avoir lu la base, juste avant de
  // déchiffrer : l'oubli se glisse là.
  let oublierIci = false;
  const vu = espionner(await onglet(fabrique));
  const gardien = gardienDe(vu.magasin, {
    secret: () => {
      if (oublierIci) {
        oublierIci = false;
        gardien.oublier();
      }
      return SECRET;
    },
  });
  // Désarmé d'abord : sans oubli, le même chargement rend le combat.
  assert.deepEqual(await gardien.charger(), { texte: contenu(4, ["gardé"]), revision: 4 });

  oublierIci = true;
  const issue = await gardien.charger();
  assert.equal(oublierIci, false, "l'oubli a bien eu lieu pendant le chargement");
  assert.equal("texte" in issue, false, "le combat ne revient pas en mémoire");
  assert.equal(issue.code, "sans_cle");
  gardien.garder(assembler(["après l'oubli"]));
  await gardien.repos();
  assert.equal(vu.ecritures.length, 0);
  assert.deepEqual(gardee(fabrique), avant, "le combat chiffré reste dans la base");
});
