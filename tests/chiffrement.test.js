// Contrôles du chiffrement et du coffre (SPECIFICATION.md, § 7 et § 11,
// domaine « Chiffrement »). Le coffre se contrôle ici sur un magasin en
// mémoire ; IndexedDB, que Node n'a pas, s'essaie dans le navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ITERATIONS,
  chiffrer,
  dechiffrer,
  defautDuMotDePasse,
  depuisBase64,
  deriverCle,
  empreinte,
  lireEnTete,
  nouveauSecret,
  ouvrir,
  ouvrirAvecMotDePasse,
} from "../js/securite/chiffrement.js";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";

const MOT_DE_PASSE = "passoire louche marmite écumoire";
const BANQUE = { format: 1, publiee_le: "2026-09-28T14:32:00+02:00", blocs: [{ nom: "Poêle" }], anomalies: [] };
const BANQUE_SUIVANTE = { ...BANQUE, publiee_le: "2026-10-02T09:05:00+02:00", blocs: [{ nom: "Poêle" }, { nom: "Wok" }] };

test("chiffrement — aller-retour, au format du § 7.1", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const fichier = await chiffrer(BANQUE, secret);
  assert.deepEqual(Object.keys(fichier), ["format", "publiee_le", "empreinte", "kdf", "chiffre"]);
  assert.equal(fichier.publiee_le, BANQUE.publiee_le);
  assert.deepEqual(fichier.kdf, { nom: "PBKDF2-SHA256", iterations: ITERATIONS, sel: secret.sel });
  assert.equal(ITERATIONS, 600_000);
  assert.equal(depuisBase64(fichier.kdf.sel).length, 16);
  assert.equal(fichier.chiffre.nom, "AES-GCM");
  assert.equal(depuisBase64(fichier.chiffre.iv).length, 12);
  assert.equal(fichier.empreinte, await empreinte(JSON.stringify(BANQUE)));
  assert.doesNotMatch(JSON.stringify(fichier), /Poêle|blocs/);

  // Un joueur : le mot de passe saisi, le sel lu dans l'en-tête.
  const ouvert = await ouvrirAvecMotDePasse(fichier, MOT_DE_PASSE);
  assert.deepEqual(ouvert.banque, BANQUE);
  assert.equal(ouvert.secret.sel, secret.sel);
  assert.equal(ouvert.secret.cle.extractable, false);
  assert.ok(Number.isInteger(ouvert.secret.duree) && ouvert.secret.duree >= 0);
});

test("chiffrement — un mauvais mot de passe est refusé proprement", async () => {
  const fichier = await chiffrer(BANQUE, await nouveauSecret(MOT_DE_PASSE));
  const refus = await ouvrirAvecMotDePasse(fichier, "passoire louche marmite écumoir");
  assert.equal(refus.code, "mot_de_passe");
  assert.equal(refus.banque, undefined);
  assert.match(refus.erreur, /mot de passe/);
  assert.ok(Number.isInteger(refus.duree));
});

test("chiffrement — un fichier abîmé ou inconnu donne un message, pas une exception", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const fichier = await chiffrer(BANQUE, secret);
  const octets = depuisBase64(fichier.chiffre.donnees);
  octets[0] ^= 1;
  const abime = { ...fichier, chiffre: { ...fichier.chiffre, donnees: Buffer.from(octets).toString("base64") } };
  assert.equal((await dechiffrer(abime, secret.cle)).code, "mot_de_passe");
  assert.equal((await dechiffrer({ ...fichier, empreinte: "sha256:00" }, secret.cle)).code, "empreinte");
  for (const inconnu of [null, {}, { ...fichier, format: 2 }, { ...fichier, kdf: { ...fichier.kdf, sel: "pas du base64 !" } }]) {
    assert.equal(lireEnTete(inconnu).code, "format");
    assert.equal((await ouvrirAvecMotDePasse(inconnu, MOT_DE_PASSE)).code, "format");
  }
});

test("chiffrement — un IV neuf à chaque chiffrement, le sel inchangé", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const [premier, second] = [await chiffrer(BANQUE, secret), await chiffrer(BANQUE, secret)];
  assert.notEqual(premier.chiffre.iv, second.chiffre.iv);
  assert.notEqual(premier.chiffre.donnees, second.chiffre.donnees);
  assert.equal(premier.kdf.sel, second.kdf.sel);
  assert.equal(premier.empreinte, second.empreinte);
});

test("chiffrement — la clé gardée déchiffre la publication suivante (§ 7.1)", async () => {
  // L'auteur tire le sel avec le mot de passe, et garde son secret.
  const auteur = await nouveauSecret(MOT_DE_PASSE);
  const premiere = await chiffrer(BANQUE, auteur);
  // Un joueur saisit le mot de passe une fois ; son appareil garde la clé.
  const { secret: garde } = await ouvrirAvecMotDePasse(premiere, MOT_DE_PASSE);
  // L'auteur publie de nouveau, avec le secret gardé.
  const seconde = await chiffrer(BANQUE_SUIVANTE, auteur);
  assert.deepEqual((await ouvrir(seconde, garde)).banque, BANQUE_SUIVANTE);
});

test("chiffrement — un sel renouvelé rend la clé gardée inutilisable (relevé du § 7.1)", async () => {
  const premiere = await chiffrer(BANQUE, await nouveauSecret(MOT_DE_PASSE));
  const { secret: garde } = await ouvrirAvecMotDePasse(premiere, MOT_DE_PASSE);
  const autreSel = await nouveauSecret(MOT_DE_PASSE);
  assert.notEqual(autreSel.sel, garde.sel);
  const seconde = await chiffrer(BANQUE_SUIVANTE, autreSel);
  // La clé gardée n'y suffit pas : même mot de passe, autre sel, autre clé.
  assert.equal((await dechiffrer(seconde, garde.cle)).code, "mot_de_passe");
  // La page le voit à l'en-tête, et redemande le mot de passe (§ 7.2).
  assert.equal((await ouvrir(seconde, garde)).code, "sel_change");
  assert.deepEqual((await ouvrirAvecMotDePasse(seconde, MOT_DE_PASSE)).banque, BANQUE_SUIVANTE);
});

test("chiffrement — le même mot de passe, quelle que soit sa saisie, donne la même clé", async () => {
  // « é » en un caractère, puis en deux (e et l'accent aigu combinant), écrits
  // par leur code pour qu'aucun éditeur ne les normalise.
  const [compose, aigu] = [String.fromCharCode(0xe9), String.fromCharCode(0x301)];
  const fichier = await chiffrer(BANQUE, await nouveauSecret(`passoire louche marmite ${compose}cumoire`));
  assert.deepEqual((await ouvrirAvecMotDePasse(fichier, ` passoire louche marmite e${aigu}cumoire `)).banque, BANQUE);
});

test("chiffrement — un mot de passe de table a 20 signes au moins (§ 7.3)", () => {
  assert.equal(defautDuMotDePasse(MOT_DE_PASSE), null);
  assert.equal(defautDuMotDePasse("é".repeat(20)), null);
  assert.match(defautDuMotDePasse("abrasia"), /7 signe/);
  assert.match(defautDuMotDePasse(`  ${"x".repeat(19)}  `), /19 signe/);
});

test("coffre — la clé réelle et la clé de démonstration se gardent séparément", async () => {
  const coffre = creerCoffre(magasinMemoire());
  const reel = await deriverCle(MOT_DE_PASSE, "c2VsIHLDqWVsIGRlIHRhYmxlIQ==");
  const demo = await deriverCle("mot de passe de démonstration", "c2VsIGRlIGTDqW1vbnN0cmF0aW9u");
  assert.equal(await coffre.lireCle("reel"), null);

  await coffre.garderCle("reel", reel);
  await coffre.garderCle("demo", demo);
  assert.equal((await coffre.lireCle("reel")).cle, reel.cle);
  assert.equal((await coffre.lireCle("demo")).cle, demo.cle);
  assert.deepEqual(Object.keys(await coffre.lireCle("demo")), ["cle", "sel", "iterations", "duree", "gardee_le"]);

  await coffre.oublierCle("demo");
  assert.equal(await coffre.lireCle("demo"), null);
  assert.equal((await coffre.lireCle("reel")).sel, reel.sel);

  await coffre.garderCle("demo", demo);
  await coffre.oublierCle("reel");
  assert.equal(await coffre.lireCle("reel"), null);
  assert.equal((await coffre.lireCle("demo")).sel, demo.sel);
  await assert.rejects(coffre.lireCle("autre"), TypeError);
});

test("coffre — ne garde qu'une clé non extractible ; le jeton à part", async () => {
  const coffre = creerCoffre(magasinMemoire());
  const extractible = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  await assert.rejects(coffre.garderCle("reel", { cle: extractible, sel: "c2Vs", iterations: ITERATIONS, duree: 1 }), /non extractible/);
  assert.equal(await coffre.lireCle("reel"), null);

  await coffre.garderCle("reel", await deriverCle(MOT_DE_PASSE, "c2Vs"));
  await coffre.garderJeton("jeton-fictif");
  assert.equal(await coffre.lireJeton(), "jeton-fictif");
  await coffre.oublierCle("reel");
  assert.equal(await coffre.lireJeton(), "jeton-fictif");
  await coffre.oublierJeton();
  assert.equal(await coffre.lireJeton(), null);
});
