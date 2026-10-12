// Contrôles des rôles câblés du simulateur de combat (SPECIFICATION.md, § 17
// et § 11, domaine « Combat ») : le tableau de js/combat/roles.js, la
// reconnaissance d'une capacité par son nom, et la ligne des câblés absents.
//
// Tout se joue sur la banque de démonstration et sur de petites banques
// fabriquées en mémoire. Aucun nom du vrai classeur n'est écrit ici : la
// reconnaissance par empreinte se vérifie sur le banc, hors dépôt. Ce
// fichier tient seulement que les empreintes ont la bonne forme et qu'aucun
// nom de la démonstration ne les produit.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { cle } from "../js/banque/noms.js";
import { ROLES } from "../js/combat/regles.js";
import { TABLE, ecrireAbsents, tableDesRoles } from "../js/combat/roles.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);

const condenser = (texte) => createHash("sha256").update(texte, "utf8").digest("hex");
const banqueDe = (...noms) => ({ capacites: noms.map((nom) => ({ nom })) });
const enObjet = (parCle) => Object.fromEntries(parCle);

// Ce que la démonstration doit câbler : le tableau du § 17, écrit une seconde
// fois, pour qu'une ligne changée dans le module se voie.
const DEMO = {
  "Pas chassé": "deplacement",
  "Goûter": "jet_de_caracteristique",
  "Pas de côté": "esquive",
  "Guetter": "attendre",
  "Costaud": "bonus_force",
  "Vif": "bonus_agilite",
  "Solo du chef": "seul_sur_sa_case",
  "Brigade": "en_meute",
  "Réduction": "degrossir",
};
const SANS_NOM_EN_DEMO = ["passer_son_tour", "jet_de_defense", "bonus_precision", "petit", "esprit_de_corps"];
const LIBELLES = [
  "déplacement", "jet de caractéristique", "esquive", "attendre", "passer son tour", "jet de défense",
  "bonus de Force", "bonus d'Agilité", "bonus de Précision", "petit", "seul sur sa case", "en meute",
  "esprit de corps", "dégrossir",
];

test("le tableau : quatorze rôles, ceux de ROLES moins « mains_nues », dans le même ordre", () => {
  assert.deepEqual(TABLE.map((entree) => entree.role), ROLES.filter((role) => role !== "mains_nues"));
  assert.equal(TABLE.length, 14);
  assert.ok(ROLES.includes("mains_nues"), "le rôle de structure existe, hors du tableau");
  assert.ok(!TABLE.some((entree) => entree.role === "mains_nues"));
  assert.deepEqual(TABLE.map((entree) => entree.libelle), LIBELLES);
  for (const entree of TABLE) assert.deepEqual(Object.keys(entree), ["role", "libelle", "demo", "empreinte"]);
});

test("le tableau : les noms de la démonstration, et « null » là où elle n'en a pas", () => {
  const lus = Object.fromEntries(TABLE.filter((entree) => entree.demo !== null).map((entree) => [entree.demo, entree.role]));
  assert.deepEqual(lus, DEMO);
  assert.deepEqual(TABLE.filter((entree) => entree.demo === null).map((entree) => entree.role), SANS_NOM_EN_DEMO);
  const cles = TABLE.filter((entree) => entree.demo !== null).map((entree) => cle(entree.demo));
  assert.equal(new Set(cles).size, cles.length, "deux rôles ne partagent pas un nom");
});

test("le tableau : aucun rôle sans nom de démonstration ni empreinte", () => {
  for (const entree of TABLE) {
    assert.ok(entree.demo !== null || entree.empreinte, entree.role);
    assert.ok(entree.demo === null || (typeof entree.demo === "string" && entree.demo.trim() === entree.demo && entree.demo !== ""), entree.role);
  }
});

test("le tableau est gelé", () => {
  assert.ok(Object.isFrozen(TABLE));
  for (const entree of TABLE) assert.ok(Object.isFrozen(entree), entree.role);
  assert.throws(() => { TABLE[0].demo = "Autre"; }, TypeError);
  assert.throws(() => { TABLE.push({}); }, TypeError);
});

test("les empreintes : soixante-quatre chiffres hexadécimaux, toutes différentes", () => {
  for (const entree of TABLE) assert.match(entree.empreinte, /^[0-9a-f]{64}$/, entree.role);
  assert.equal(new Set(TABLE.map((entree) => entree.empreinte)).size, TABLE.length);
  // Le motif refuse bien ce qu'il doit refuser : le préfixe de empreinte(),
  // une majuscule, un chiffre de moins.
  for (const fausse of [`sha256:${"a".repeat(64)}`, "A".repeat(64), "a".repeat(63), ""]) assert.doesNotMatch(fausse, /^[0-9a-f]{64}$/);
});

test("les empreintes : aucune n'est celle d'un nom de la démonstration", () => {
  const empreintes = new Set(TABLE.map((entree) => entree.empreinte));
  const fictifs = [...Object.keys(DEMO), ...BANQUE.capacites.map((capacite) => capacite.nom)];
  assert.ok(fictifs.length > 40, "la banque de démonstration a bien été lue");
  for (const nom of fictifs) {
    assert.ok(!empreintes.has(condenser(cle(nom))), `l'empreinte d'un rôle est celle du nom fictif « ${nom} »`);
    assert.ok(!empreintes.has(condenser(nom)), `l'empreinte d'un rôle est celle du nom fictif « ${nom} », tel qu'écrit`);
  }
  // Le condensat de ce contrôle est bien celui qu'on croit (vecteur connu du
  // SHA-256) : sans cela, la comparaison ci-dessus ne prouverait rien.
  assert.equal(condenser("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("en démonstration, chaque rôle se reconnaît par son nom, et rien d'autre", async () => {
  const { parCle, absents } = await tableDesRoles(BANQUE, "demo");
  assert.ok(parCle instanceof Map);
  assert.deepEqual(enObjet(parCle), Object.fromEntries(Object.entries(DEMO).map(([nom, role]) => [cle(nom), role])));
  assert.deepEqual(absents, []);
  assert.equal(ecrireAbsents(absents), null);
  // Taloche est l'attaque à mains nues de la démonstration : son rôle ne
  // vient pas de ce tableau.
  assert.equal(parCle.get(cle("Taloche")), undefined);
  assert.equal(parCle.get(cle("Coup de louche")), undefined);
});

test("le nom se compare par cle() : casse, accents, espaces et signe invisible n'y changent rien", async () => {
  const invisible = String.fromCodePoint(0x200b);
  const { parCle } = await tableDesRoles(banqueDe("  PAS  CHASSE ", `Gou${invisible}ter`, "pas de cote"), "demo");
  assert.deepEqual(enObjet(parCle), { paschasse: "deplacement", gouter: "jet_de_caracteristique", pasdecote: "esquive" });
  // Une lettre de plus ou de moins, et ce n'est plus le nom.
  const voisins = await tableDesRoles(banqueDe("Pas chassés", "Goûte", "Pas de côté 2", "Le Vif"), "demo");
  assert.equal(voisins.parCle.size, 0);
});

test("en mode réel, aucun nom de la démonstration ne câble une capacité", async () => {
  const reel = await tableDesRoles(BANQUE, "reel");
  assert.equal(reel.parCle.size, 0);
  assert.deepEqual(reel.absents, LIBELLES);
  // La même banque, lue en démonstration, est bien câblée : c'est le mode
  // seul qui fait la différence.
  assert.equal((await tableDesRoles(BANQUE, "demo")).parCle.size, Object.keys(DEMO).length);
  const fabriquee = banqueDe(...Object.keys(DEMO));
  assert.equal((await tableDesRoles(fabriquee, "reel")).parCle.size, 0);
  assert.equal((await tableDesRoles(fabriquee, "demo")).parCle.size, Object.keys(DEMO).length);
});

test("un nom qui recopie une empreinte ne câble rien, dans aucun mode", async () => {
  const banque = banqueDe(...TABLE.map((entree) => entree.empreinte), ...TABLE.map((entree) => `sha256:${entree.empreinte}`));
  assert.equal((await tableDesRoles(banque, "reel")).parCle.size, 0);
  assert.equal((await tableDesRoles(banque, "demo")).parCle.size, 0);
});

test("les absents : les libellés des rôles attendus que la banque ne porte pas, dans l'ordre du tableau", async () => {
  const tous = Object.keys(DEMO);
  assert.deepEqual((await tableDesRoles(banqueDe(...tous), "demo")).absents, []);
  const sans = (...retires) => banqueDe(...tous.filter((nom) => !retires.includes(nom)));
  assert.deepEqual((await tableDesRoles(sans("Costaud"), "demo")).absents, ["bonus de Force"]);
  // Donnés à l'envers, ils sortent dans l'ordre du tableau.
  const deux = await tableDesRoles(sans("Brigade", "Costaud"), "demo");
  assert.deepEqual(deux.absents, ["bonus de Force", "en meute"]);
  assert.equal(ecrireAbsents(deux.absents), "Câblés absents de la banque : bonus de Force, en meute.");
  assert.ok(Object.isFrozen(deux.absents));
  // Un rôle sans nom en démonstration n'y est jamais absent ; en mode réel,
  // il est attendu comme les autres.
  const vide = await tableDesRoles(banqueDe(), "demo");
  assert.deepEqual(vide.absents, LIBELLES.filter((libelle, i) => TABLE[i].demo !== null));
  assert.equal(vide.absents.length, 9);
  for (const role of SANS_NOM_EN_DEMO) assert.ok(!vide.absents.includes(TABLE.find((entree) => entree.role === role).libelle), role);
  assert.deepEqual((await tableDesRoles(banqueDe(), "reel")).absents, LIBELLES);
});

test("la phrase des absents : une ligne, ou rien", () => {
  assert.equal(ecrireAbsents([]), null);
  assert.equal(ecrireAbsents(undefined), null);
  assert.equal(ecrireAbsents(["petit"]), "Câblés absents de la banque : petit.");
  assert.equal(ecrireAbsents(["déplacement", "esquive", "dégrossir"]), "Câblés absents de la banque : déplacement, esquive, dégrossir.");
  const tout = ecrireAbsents(LIBELLES);
  assert.ok(tout.startsWith("Câblés absents de la banque : déplacement, ") && tout.endsWith(", dégrossir."));
  assert.doesNotMatch(tout, /[\n\r]|\p{Zs}(?<! )/u, "une seule ligne, sans espace insécable");
});

test("une banque sans capacités, ou aux noms illisibles, ne câble rien et ne lève pas", async () => {
  for (const banque of [{}, { capacites: null }, { capacites: "Vif" }, { capacites: [null, {}, { nom: null }, { nom: "" }, { nom: "   " }, { nom: 12 }] }]) {
    const { parCle, absents } = await tableDesRoles(banque, "demo");
    assert.equal(parCle.size, 0);
    assert.equal(absents.length, 9);
  }
  // À côté d'entrées illisibles, un nom lisible se reconnaît toujours ; et
  // un nom écrit deux fois ne compte qu'une fois.
  const { parCle } = await tableDesRoles({ capacites: [null, { nom: "Vif" }, {}, { nom: "VIF" }] }, "demo");
  assert.deepEqual(enObjet(parCle), { vif: "bonus_agilite" });
});

test("le résultat se mémorise par banque et par mode", async () => {
  const banque = banqueDe("Vif", "Brigade");
  const premiere = tableDesRoles(banque, "demo");
  assert.ok(premiere instanceof Promise);
  assert.equal(await premiere, await tableDesRoles(banque, "demo"), "le même objet au second appel");
  assert.notEqual(await tableDesRoles(banque, "reel"), await premiere, "un autre par mode");
  assert.equal((await tableDesRoles(banque, "reel")).parCle.size, 0);
  // Une banque republiée est un autre objet : rien de l'ancienne ne lui reste.
  const republiee = banqueDe("Vif");
  const seconde = await tableDesRoles(republiee, "demo");
  assert.notEqual(seconde, await premiere);
  assert.deepEqual(enObjet(seconde.parCle), { vif: "bonus_agilite" });
  assert.deepEqual(enObjet((await premiere).parCle), { vif: "bonus_agilite", brigade: "en_meute" });
});

test("un mode inconnu ou une banque absente sont refusés", async () => {
  for (const mode of [undefined, null, "", "Demo", "réel", "toString", "__proto__"]) {
    await assert.rejects(tableDesRoles(banqueDe("Vif"), mode), TypeError, String(mode));
  }
  for (const banque of [undefined, null, "banque", 3]) await assert.rejects(tableDesRoles(banque, "demo"), TypeError);
  await assert.doesNotReject(tableDesRoles(banqueDe("Vif"), "demo"));
  await assert.doesNotReject(tableDesRoles(banqueDe("Vif"), "reel"));
});

test("le module n'importe que la comparaison des noms et le condensat, et n'exporte que le contrat", async () => {
  const source = lire("js/combat/roles.js");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";/gmu)].map((trouve) => trouve[1]);
  assert.deepEqual(imports, ["../banque/noms.js", "../securite/chiffrement.js"]);
  assert.doesNotMatch(source, /\bimport\(/u);
  assert.deepEqual(Object.keys(await import("../js/combat/roles.js")).sort(), ["TABLE", "ecrireAbsents", "tableDesRoles"]);
  // Les seules suites de soixante-quatre chiffres hexadécimaux du module sont
  // les quatorze empreintes du tableau.
  assert.deepEqual(source.match(/[0-9a-f]{64}/gu), TABLE.map((entree) => entree.empreinte));
});
