// Contrôles des formats des personnages en ligne (SPECIFICATION.md, § 15.8) :
// le ticket, le fichier rangé et l'index, dans les deux sens ; le
// chiffrement sous la clé de table ; les données hostiles.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEMIN_INDEX,
  TAILLE_MAX_TICKET,
  TITRE_TICKET,
  cheminDuPersonnage,
  chiffrerPersonnage,
  dechiffrerPersonnage,
  ecrireFichier,
  ecrireIndex,
  ecrireTicket,
  fichierDuTicket,
  lireFichier,
  lireIndex,
  lireTicket,
  rechiffrer,
  versionDe,
} from "../js/personnage/en_ligne.js";
import { transformer } from "../js/personnage/format.js";
import { nouveauSecret, versBase64 } from "../js/securite/chiffrement.js";
import { DATE_ESSAI, personnageEssai } from "./outils/personnage_essai.js";

const ID = "Qx7-aZ_09bcdEFGHijklmn";
const DATE = "2026-09-30T10:21:36.536Z";
const RANGE = "2026-09-30T10:22:05Z";

// Un personnage enregistré de la banque réelle, comme il part en ligne.
function enregistre(modifier = null) {
  return personnageEssai((p) => {
    Object.assign(p, { id: ID, mode: "reel", etat: "enregistre", etape: 9, enregistre_le: DATE_ESSAI.toISOString() });
    if (modifier) modifier(p);
  });
}

const secretDeTable = (() => {
  let secret = null;
  return async () => (secret ??= await nouveauSecret("louche marmite passoire"));
})();

async function fichierRange(personnage = enregistre()) {
  const secret = await secretDeTable();
  const chiffre = await chiffrerPersonnage(personnage, secret);
  const { corps } = ecrireTicket({ action: "creer", identifiant: personnage.id, date: DATE, personnage: chiffre });
  const { ticket } = lireTicket(corps);
  return fichierDuTicket(ticket, { rangeLe: RANGE, numero: 12 });
}

test("en ligne — aller-retour : chiffré, ticket, fichier rangé, déchiffré, le même personnage", async () => {
  const secret = await secretDeTable();
  const personnage = enregistre();
  const chiffre = await chiffrerPersonnage(personnage, secret);
  assert.deepEqual(Object.keys(chiffre), ["sel", "iv", "contenu"]);
  assert.equal(chiffre.sel, secret.sel);
  const envoi = ecrireTicket({ action: "creer", identifiant: ID, date: DATE, personnage: chiffre });
  assert.equal(envoi.titre, TITRE_TICKET);
  assert.equal(envoi.titre, "personnage");
  // Le corps : une ligne de JSON, sans nom en clair.
  assert.doesNotMatch(envoi.corps, /Aubépine|Crèmebrûlée|Saucier|Marmiton/);
  assert.doesNotMatch(envoi.corps, /\n/);
  const { ticket, erreur } = lireTicket(envoi.corps);
  assert.equal(erreur, undefined, erreur);
  assert.deepEqual(ticket, { format: 1, action: "creer", identifiant: ID, date: DATE, personnage: chiffre });
  // L'automate range le fichier ; la page le relit, puis le déchiffre.
  const texte = ecrireFichier(fichierDuTicket(ticket, { rangeLe: RANGE, numero: 12 }));
  assert.doesNotMatch(texte, /Aubépine|Saucier/);
  const { fichier } = lireFichier(texte, { identifiant: ID });
  assert.deepEqual(Object.keys(fichier), ["format", "identifiant", "depose_le", "range_le", "ticket", "sel", "iv", "contenu"]);
  const ouvert = await dechiffrerPersonnage(fichier, secret);
  assert.equal(ouvert.erreur, undefined, ouvert.erreur);
  assert.deepEqual(ouvert.personnage, personnage);
  // Un IV neuf à chaque chiffrement.
  assert.notEqual((await chiffrerPersonnage(personnage, secret)).iv, chiffre.iv);
  assert.equal(cheminDuPersonnage(ID), `personnages/${ID}.chiffre.json`);
  assert.equal(CHEMIN_INDEX, "personnages/index.json");
  assert.throws(() => cheminDuPersonnage("../index"), TypeError);
});

test("en ligne — seul un personnage enregistré, de la banque réelle, se chiffre pour partir", async () => {
  const secret = await secretDeTable();
  assert.match((await chiffrerPersonnage(enregistre((p) => Object.assign(p, { etat: "brouillon" })), secret)).erreur, /enregistré/);
  assert.match((await chiffrerPersonnage(enregistre((p) => (p.mode = "demo")), secret)).erreur, /démonstration/);
  assert.match((await chiffrerPersonnage(enregistre((p) => (p.id = "court")), secret)).erreur, /ne peut pas partir/);
});

test("en ligne — le ticket « supprimer » ne porte aucun personnage ; « creer » et « remplacer » en portent un", async () => {
  const chiffre = await chiffrerPersonnage(enregistre(), await secretDeTable());
  const supprimer = ecrireTicket({ action: "supprimer", identifiant: ID, date: DATE, personnage: chiffre });
  assert.deepEqual(JSON.parse(supprimer.corps), { format: 1, action: "supprimer", identifiant: ID, date: DATE });
  assert.equal(lireTicket(supprimer.corps).ticket.action, "supprimer");
  assert.match(lireTicket(JSON.stringify({ format: 1, action: "supprimer", identifiant: ID, date: DATE, personnage: chiffre })).erreur, /champ inconnu/);
  assert.match(lireTicket(JSON.stringify({ format: 1, action: "creer", identifiant: ID, date: DATE })).erreur, /manque/);
  assert.equal(lireTicket(JSON.stringify({ format: 1, action: "remplacer", identifiant: ID, date: DATE, personnage: chiffre })).ticket.action, "remplacer");
  // Des blancs autour du corps, qu'un éditeur ajouterait, ne gênent pas.
  assert.equal(lireTicket(`\n ${supprimer.corps} \r\n`).ticket.identifiant, ID);
});

test("en ligne — un ticket hostile est refusé, avec une raison, jamais une exception", async () => {
  const chiffre = await chiffrerPersonnage(enregistre(), await secretDeTable());
  const base = { format: 1, action: "creer", identifiant: ID, date: DATE, personnage: chiffre };
  const cas = {
    "pas du JSON": "{ format: 1",
    "un tableau": "[]",
    "null": "null",
    "champ en plus": JSON.stringify({ ...base, nom: "Aubépine" }),
    "prototype": `{"__proto__":{"x":1},${JSON.stringify(base).slice(1)}`,
    "format 2": JSON.stringify({ ...base, format: 2 }),
    "format texte": JSON.stringify({ ...base, format: "1" }),
    "action inconnue": JSON.stringify({ ...base, action: "effacer" }),
    "identifiant trop court": JSON.stringify({ ...base, identifiant: "abc" }),
    "identifiant avec un point": JSON.stringify({ ...base, identifiant: "../../index.chiffre" }),
    "identifiant avec une barre": JSON.stringify({ ...base, identifiant: "aaaaaaaa/bbbbbbbbbbbb" }),
    "date locale": JSON.stringify({ ...base, date: "2026-09-30T12:21:36+02:00" }),
    "date impossible": JSON.stringify({ ...base, date: "2026-02-30T10:00:00Z" }),
    "date texte": JSON.stringify({ ...base, date: "hier" }),
    "sel court": JSON.stringify({ ...base, personnage: { ...chiffre, sel: versBase64(new Uint8Array(15)) } }),
    "iv long": JSON.stringify({ ...base, personnage: { ...chiffre, iv: versBase64(new Uint8Array(16)) } }),
    "contenu vide": JSON.stringify({ ...base, personnage: { ...chiffre, contenu: "" } }),
    "contenu court": JSON.stringify({ ...base, personnage: { ...chiffre, contenu: versBase64(new Uint8Array(16)) } }),
    "base64 sans remplissage": JSON.stringify({ ...base, personnage: { ...chiffre, contenu: chiffre.contenu.replace(/=+$/, "") + (chiffre.contenu.endsWith("=") ? "" : "A") } }),
    "base64url": JSON.stringify({ ...base, personnage: { ...chiffre, iv: "____________AAAA" } }),
    "champ du chiffré en plus": JSON.stringify({ ...base, personnage: { ...chiffre, nom: "x" } }),
    "signe non ASCII": JSON.stringify({ ...base, date: "2026-09-30T10:21:36.536Z" }).replace("creer", "créer"),
    "trop gros": JSON.stringify({ ...base, personnage: { ...chiffre, contenu: "A".repeat(TAILLE_MAX_TICKET) } }),
    "pas un texte": 42,
  };
  for (const [nom, corps] of Object.entries(cas)) {
    const lu = lireTicket(corps);
    assert.equal(lu.ticket, undefined, nom);
    assert.equal(typeof lu.erreur, "string", nom);
  }
});

test("en ligne — un personnage trop gros pour un ticket ne part pas, avec une raison", () => {
  const enorme = { sel: versBase64(new Uint8Array(16)), iv: versBase64(new Uint8Array(12)), contenu: versBase64(new Uint8Array(50_000)) };
  assert.match(ecrireTicket({ action: "creer", identifiant: ID, date: DATE, personnage: enorme }).erreur, /dépasse 64 Ko : il ne peut pas partir en ligne. Raccourcissez son histoire./);
});

test("en ligne — un chiffré recopié sous un autre identifiant, ou d'une autre clé, ne se lit pas", async () => {
  const secret = await secretDeTable();
  const fichier = await fichierRange();
  const autreId = "AutreIdentifiant000001";
  const deplace = lireFichier(ecrireFichier({ ...fichier, identifiant: autreId }), { identifiant: autreId }).fichier;
  assert.equal((await dechiffrerPersonnage(deplace, secret)).code, "illisible");
  // Le fichier doit porter l'identifiant de son chemin.
  assert.match(lireFichier(ecrireFichier(fichier), { identifiant: autreId }).erreur, /identifiant de son chemin/);
  const autreCle = await nouveauSecret("louche marmite passoire");
  assert.equal((await dechiffrerPersonnage(fichier, autreCle)).code, "cle");
  // Même sel annoncé, mais une autre clé : illisible, jamais une exception.
  assert.equal((await dechiffrerPersonnage(fichier, { ...autreCle, sel: fichier.sel })).code, "illisible");
});

test("en ligne — le contenu déchiffré est une donnée hostile : borné, vérifié, du bon identifiant, enregistré", async () => {
  const secret = await secretDeTable();
  // Un chiffré fabriqué avec la vraie clé, pour tout ce que la page doit refuser.
  const forger = async (texteOuOctets, identifiant = ID) => {
    const clair = typeof texteOuOctets === "string" ? new TextEncoder().encode(texteOuOctets) : texteOuOctets;
    const compresse = await transformer(clair, new CompressionStream("deflate-raw"));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const donnees = { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`atelier-des-arpenteurs/personnage/1/${identifiant}`) };
    const contenu = new Uint8Array(await crypto.subtle.encrypt(donnees, secret.cle, compresse));
    return { format: 1, identifiant, depose_le: DATE, range_le: RANGE, ticket: 3, sel: secret.sel, iv: versBase64(iv), contenu: versBase64(contenu) };
  };
  const bombe = await forger(new Uint8Array(200 * 1024).fill(0x20));
  assert.match((await dechiffrerPersonnage(bombe, secret)).erreur, /dépasse 64 Ko une fois décompressé/);
  assert.equal((await dechiffrerPersonnage(await forger('{"format":1}'), secret)).code, "illisible");
  assert.equal((await dechiffrerPersonnage(await forger(new Uint8Array([0xff, 0xfe, 0x00])), secret)).code, "illisible");
  const autre = enregistre((p) => (p.id = "AutreIdentifiant000001"));
  assert.match((await dechiffrerPersonnage(await forger(JSON.stringify(autre)), secret)).erreur, /identifiant de son fichier/);
  const brouillon = enregistre((p) => Object.assign(p, { etat: "brouillon" }));
  assert.match((await dechiffrerPersonnage(await forger(JSON.stringify(brouillon)), secret)).erreur, /n'est pas enregistré/);
  const demo = enregistre((p) => (p.mode = "demo"));
  assert.match((await dechiffrerPersonnage(await forger(JSON.stringify(demo)), secret)).erreur, /démonstration/);
  assert.deepEqual((await dechiffrerPersonnage(await forger(JSON.stringify(enregistre())), secret)).personnage, enregistre());
});

test("en ligne — le fichier rangé hostile est refusé", async () => {
  const fichier = await fichierRange();
  const cas = {
    "champ en plus": { ...fichier, nom: "Aubépine" },
    "sans ticket": (({ ticket, ...reste }) => reste)(fichier),
    "ticket nul": { ...fichier, ticket: 0 },
    "ticket texte": { ...fichier, ticket: "12" },
    "date locale": { ...fichier, range_le: "2026-09-30T12:22:05+02:00" },
    "format 2": { ...fichier, format: 2 },
    "sel abîmé": { ...fichier, sel: "sel" },
  };
  for (const [nom, objet] of Object.entries(cas)) assert.match(lireFichier(JSON.stringify(objet), { identifiant: ID }).erreur ?? "", /./, nom);
  assert.match(lireFichier("x".repeat(100 * 1024), { identifiant: ID }).erreur, /dépasse/);
  assert.throws(() => ecrireFichier({ ...fichier, nom: "x" }), TypeError);
});

test("en ligne — l'index : identifiants, dates, versions, rien d'autre ; aucun nom en clair", async () => {
  const premier = await fichierRange();
  const second = { ...(await fichierRange(enregistre((p) => (p.id = "AAAAAAAAAAAAAAAAAAAAAA")))), range_le: "2026-09-30T11:00:00Z" };
  const texte = ecrireIndex([premier, second]);
  const { index } = lireIndex(texte);
  // Trié par identifiant.
  assert.deepEqual(index.personnages.map((e) => e.identifiant), ["AAAAAAAAAAAAAAAAAAAAAA", ID]);
  for (const entree of index.personnages) assert.deepEqual(Object.keys(entree), ["identifiant", "range_le", "version"]);
  assert.equal(index.personnages[1].version, versionDe(premier));
  assert.doesNotMatch(texte, /Aubépine|Crèmebrûlée|Saucier|Marmiton|Grand Four/);
  // La version suit l'IV : un rechiffrement la change.
  assert.notEqual(versionDe(premier), versionDe(await fichierRange()));
  const cas = {
    "un nom": { format: 1, personnages: [{ identifiant: ID, range_le: RANGE, version: "AAAAAAAAAAAAAAAA", nom: "Aubépine" }] },
    "doublon par la casse": {
      format: 1,
      personnages: [
        { identifiant: "abcdefghijklmnopqrstuv", range_le: RANGE, version: "AAAAAAAAAAAAAAAA" },
        { identifiant: "ABCDEFGHIJKLMNOPQRSTUV", range_le: RANGE, version: "AAAAAAAAAAAAAAAA" },
      ],
    },
    "version abîmée": { format: 1, personnages: [{ identifiant: ID, range_le: RANGE, version: "court" }] },
    "pas une liste": { format: 1, personnages: {} },
    "champ en plus": { format: 1, personnages: [], noms: [] },
  };
  for (const [nom, objet] of Object.entries(cas)) assert.equal(typeof lireIndex(JSON.stringify(objet)).erreur, "string", nom);
  assert.deepEqual(lireIndex(ecrireIndex([])).index, { format: 1, personnages: [] });
});

test("en ligne — le rechiffrement passe un personnage de l'ancienne clé à la nouvelle, sans le lire", async () => {
  const ancien = await secretDeTable();
  const nouveau = await nouveauSecret("un tout autre mot de passe");
  const fichier = await fichierRange();
  const chiffre = await rechiffrer(ID, fichier, ancien, nouveau);
  assert.equal(chiffre.sel, nouveau.sel);
  assert.notEqual(chiffre.iv, fichier.iv);
  const rechiffre = { ...fichier, ...chiffre };
  assert.deepEqual((await dechiffrerPersonnage(rechiffre, nouveau)).personnage, enregistre());
  assert.equal((await dechiffrerPersonnage(rechiffre, ancien)).code, "cle");
  // Une autre clé que l'ancienne ne rechiffre rien.
  assert.match((await rechiffrer(ID, rechiffre, ancien, nouveau)).erreur, /ancienne clé/);
  assert.match((await rechiffrer(ID, fichier, { ...nouveau, sel: fichier.sel }, nouveau)).erreur, /ne se déchiffre pas/);
});
