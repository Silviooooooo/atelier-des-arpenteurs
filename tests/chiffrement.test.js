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
  normaliserMotDePasse,
  nouveauSecret,
  ouvrir,
  tirerSel,
  ouvrirAvecMotDePasse,
  versBase64,
} from "../js/securite/chiffrement.js";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";

const MOT_DE_PASSE = "passoire louche marmite écumoire";
const BANQUE = { format: 1, publiee_le: "2026-09-28T14:32:00+02:00", blocs: [{ nom: "Poêle" }], anomalies: [] };
const BANQUE_SUIVANTE = { ...BANQUE, publiee_le: "2026-10-02T09:05:00+02:00", blocs: [{ nom: "Poêle" }, { nom: "Wok" }] };

test("chiffrement — aller-retour, au format 2 du § 7.1", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const fichier = await chiffrer(BANQUE, secret);
  assert.deepEqual(Object.keys(fichier), ["format", "publiee_le", "empreinte", "kdf", "chiffre"]);
  assert.equal(fichier.publiee_le, BANQUE.publiee_le);
  assert.deepEqual(fichier.kdf, { nom: "PBKDF2-SHA256", iterations: ITERATIONS, sel: secret.sel });
  assert.equal(ITERATIONS, 600_000);
  assert.equal(depuisBase64(fichier.kdf.sel).length, 16);
  assert.equal(fichier.chiffre.nom, "AES-GCM");
  assert.equal(depuisBase64(fichier.chiffre.iv).length, 12);
  // Format 2 : l'empreinte est celle des octets chiffrés, étiquette comprise ;
  // celle de la banque en clair n'est plus dans l'en-tête.
  assert.equal(fichier.format, 2);
  assert.equal(fichier.empreinte, await empreinte(depuisBase64(fichier.chiffre.donnees)));
  assert.notEqual(fichier.empreinte, await empreinte(JSON.stringify(BANQUE)));
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
  // Format 2 : un octet changé ne correspond plus à l'empreinte du fichier.
  assert.equal((await dechiffrer(abime, secret.cle)).code, "empreinte");
  assert.equal((await dechiffrer({ ...fichier, empreinte: "sha256:00" }, secret.cle)).code, "empreinte");
  // Un format plus récent que celui de la page : la page est en retard.
  for (const recent of [{ ...fichier, format: 3 }, { ...fichier, format: 7 }]) {
    const resultat = lireEnTete(recent);
    assert.equal(resultat.code, "format_recent");
    assert.match(resultat.erreur, /rechargez la page/);
    assert.equal((await ouvrirAvecMotDePasse(recent, MOT_DE_PASSE)).code, "format_recent");
  }
  for (const inconnu of [null, {}, { ...fichier, format: 0 }, { ...fichier, format: "2" }, { ...fichier, format: 2.5 }, { ...fichier, kdf: { ...fichier.kdf, sel: "pas du base64 !" } }]) {
    assert.equal(lireEnTete(inconnu).code, "format");
    assert.equal((await ouvrirAvecMotDePasse(inconnu, MOT_DE_PASSE)).code, "format");
  }
});

test("chiffrement — un en-tête hors des bornes du § 7.1 donne un message, jamais une exception", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const fichier = await chiffrer(BANQUE, secret);
  const avec = (kdf, chiffre = {}) => ({ ...fichier, kdf: { ...fichier.kdf, ...kdf }, chiffre: { ...fichier.chiffre, ...chiffre } });
  const abimes = {
    "sel d'un signe": avec({ sel: "A" }),
    "sel mal complété": avec({ sel: "AB=" }),
    "sel de 15 octets": avec({ sel: versBase64(new Uint8Array(15)) }),
    "IV d'un signe": avec({}, { iv: "A" }),
    "IV de 11 octets": avec({}, { iv: versBase64(new Uint8Array(11)) }),
    "données de 3 octets": avec({}, { donnees: "AAAA" }),
    "1 itération": avec({ iterations: 1 }),
    "une itération de moins": avec({ iterations: ITERATIONS - 1 }),
    "dix fois trop, plus une": avec({ iterations: 10 * ITERATIONS + 1 }),
    "2^32 itérations": avec({ iterations: 2 ** 32 }),
    "10^12 itérations": avec({ iterations: 1e12 }),
  };
  for (const [cas, abime] of Object.entries(abimes)) {
    assert.equal(lireEnTete(abime).code, "format", cas);
    assert.equal((await ouvrirAvecMotDePasse(abime, MOT_DE_PASSE)).code, "format", cas);
    assert.equal((await ouvrir(abime, secret)).code, "format", cas);
  }
  // Les bornes elles-mêmes passent : une hausse future reste lisible.
  assert.deepEqual(lireEnTete(avec({ iterations: 10 * ITERATIONS })), { sel: fichier.kdf.sel, iterations: 10 * ITERATIONS });
  // Une clé sous le plancher ne chiffre rien.
  await assert.rejects(chiffrer(BANQUE, { ...secret, iterations: 1 }), /itérations/);
});

test("chiffrement — un navigateur qui refuse la dérivation donne un message, pas une exception", async () => {
  const fichier = await chiffrer(BANQUE, await nouveauSecret(MOT_DE_PASSE));
  const original = crypto.subtle.deriveKey;
  crypto.subtle.deriveKey = async () => {
    throw new Error("opération refusée");
  };
  try {
    const resultat = await ouvrirAvecMotDePasse(fichier, MOT_DE_PASSE);
    assert.equal(resultat.code, "derivation");
    assert.match(resultat.erreur, /opération refusée/);
  } finally {
    crypto.subtle.deriveKey = original;
  }
});

test("format 2 — l'empreinte des octets chiffrés se vérifie avant de déchiffrer, et change à chaque publication", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const fichier = await chiffrer(BANQUE, secret);
  // Une empreinte fausse : refusée, sans même déchiffrer.
  const fausse = { ...fichier, empreinte: `sha256:${"0".repeat(64)}` };
  assert.equal((await dechiffrer(fausse, secret.cle)).code, "empreinte");
  assert.equal((await ouvrirAvecMotDePasse(fausse, MOT_DE_PASSE)).code, "empreinte");
  // Des octets changés, l'empreinte recalculée : l'étiquette d'AES-GCM les refuse.
  const octets = depuisBase64(fichier.chiffre.donnees);
  octets[0] ^= 1;
  const change = { ...fichier, chiffre: { ...fichier.chiffre, donnees: versBase64(octets) }, empreinte: await empreinte(octets) };
  assert.equal((await dechiffrer(change, secret.cle)).code, "mot_de_passe");
  // La même banque, chiffrée deux fois : deux empreintes. Savoir si le
  // contenu a changé se fait sur le contenu déchiffré, jamais sur elle.
  const second = await chiffrer(BANQUE, secret);
  assert.notEqual(second.empreinte, fichier.empreinte);
  assert.deepEqual((await ouvrir(second, secret)).banque, (await ouvrir(fichier, secret)).banque);
});

// Lot 2 bis : le format 1 ne se lit plus ; un fichier qui l'annonce se dit
// abîmé, avant toute dérivation.
test("format 1 — ne se lit plus : le fichier se dit abîmé ou d'un format inconnu", async () => {
  const fichier = await chiffrer(BANQUE, await nouveauSecret(MOT_DE_PASSE));
  const ancien = { ...fichier, format: 1 };
  assert.deepEqual(lireEnTete(ancien), { erreur: "Le fichier de la banque est abîmé ou d'un format inconnu.", code: "format" });
  assert.equal((await ouvrirAvecMotDePasse(ancien, MOT_DE_PASSE)).code, "format");
  assert.equal((await dechiffrer(ancien, (await ouvrirAvecMotDePasse(fichier, MOT_DE_PASSE)).secret.cle)).code, "format");
});

test("chiffrement — un IV neuf à chaque chiffrement, le sel inchangé", async () => {
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const [premier, second] = [await chiffrer(BANQUE, secret), await chiffrer(BANQUE, secret)];
  assert.notEqual(premier.chiffre.iv, second.chiffre.iv);
  assert.notEqual(premier.chiffre.donnees, second.chiffre.donnees);
  assert.equal(premier.kdf.sel, second.kdf.sel);
  // Format 2 : l'empreinte suit les octets chiffrés, donc l'IV.
  assert.notEqual(premier.empreinte, second.empreinte);
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

test("chiffrement — un mot de passe de table a 8 signes au moins, sans autre exigence (§ 7.3)", () => {
  assert.equal(defautDuMotDePasse(MOT_DE_PASSE), null);
  assert.equal(defautDuMotDePasse("é".repeat(8)), null);
  // Ni chiffre, ni majuscule, ni signe exigés.
  assert.equal(defautDuMotDePasse("marmites"), null);
  assert.match(defautDuMotDePasse("abrasia"), /7 signe\(s\) : il en faut 8 au moins/);
  assert.match(defautDuMotDePasse(`  ${"x".repeat(7)}  `), /7 signe/);
  assert.match(defautDuMotDePasse("abrasia"), /Deux ou trois mots sans rapport, collés/);
});

// Lot 2 bis : insensible aux majuscules, à la publication comme à la saisie.
test("mot de passe — normalisé en minuscules après NFC et espaces de bord : même clé, quelle que soit la casse", async () => {
  const [compose, aigu] = [String.fromCharCode(0xe9), String.fromCharCode(0x301)];
  assert.equal(normaliserMotDePasse(`  Passoire LOUCHE ${compose}cumoire `), `passoire louche ${compose}cumoire`);
  assert.equal(normaliserMotDePasse(`E${aigu}CUMOIRE`), `${compose}cumoire`);
  // « İ » (I pointé) devient « i » suivi du point combinant, puis NFC.
  assert.equal(normaliserMotDePasse("İ"), "i̇".normalize("NFC"));
  const fichier = await chiffrer(BANQUE, await nouveauSecret("Passoire Louche Marmite"));
  for (const saisie of ["passoire louche marmite", "PASSOIRE LOUCHE MARMITE", " pAssoire louche Marmite "]) {
    assert.deepEqual((await ouvrirAvecMotDePasse(fichier, saisie)).banque, BANQUE, saisie);
  }
  // Deux dérivations de casses différentes donnent la même clé.
  const sel = tirerSel();
  const [a, b] = [await deriverCle("Marmite Fouet", sel), await deriverCle("marmite fouet", sel)];
  assert.deepEqual((await dechiffrer(await chiffrer(BANQUE, a), b.cle)).banque, BANQUE);
});

// La banque chiffrée avant le lot 2 bis l'a été sous la forme exacte : elle
// reste lisible avec le mot de passe tel qu'il se saisissait, jusqu'au
// prochain changement de mot de passe (§ 7.1).
test("mot de passe — une banque chiffrée sous la forme exacte (avant le lot 2 bis) reste lisible", async () => {
  const sel = tirerSel();
  const ancienne = await deriverCle("Passoire Louche", sel, ITERATIONS, { minuscules: false });
  const fichier = await chiffrer(BANQUE, ancienne);
  const ouvert = await ouvrirAvecMotDePasse(fichier, "Passoire Louche");
  assert.deepEqual(ouvert.banque, BANQUE);
  // La clé rendue est celle de la banque : elle republie sous la même forme.
  assert.deepEqual((await dechiffrer(await chiffrer(BANQUE_SUIVANTE, ouvert.secret), ancienne.cle)).banque, BANQUE_SUIVANTE);
  // Tant que cette banque est en place, la casse compte encore.
  assert.equal((await ouvrirAvecMotDePasse(fichier, "passoire louche")).code, "mot_de_passe");
  // Un mot de passe faux se dit faux après les deux essais.
  assert.equal((await ouvrirAvecMotDePasse(fichier, "Passoire Faux")).code, "mot_de_passe");
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

test("coffre — ne garde qu'une clé AES-GCM, non extractible, et rien d'autre", async () => {
  const coffre = creerCoffre(magasinMemoire());
  const hmac = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  for (const faux of [{ extractable: false }, { extractable: false, algorithm: { name: "AES-GCM" } }, hmac]) {
    await assert.rejects(coffre.garderCle("reel", { cle: faux, sel: "c2Vs", iterations: ITERATIONS, duree: 1 }), /non extractible/);
  }
  assert.equal(await coffre.lireCle("reel"), null);
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
