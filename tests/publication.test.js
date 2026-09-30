// Contrôles de la publication (SPECIFICATION.md, § 8.2, § 8.4 et § 11,
// domaine « Publication »). GitHub est simulé : fetch est remplacé par une
// fonction qui tient le fichier publié (ou tout le dépôt, pour l'API Git
// Data) en mémoire et note chaque requête. Le fetch global lève une
// exception, pour qu'aucun appel réel ne passe inaperçu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ADRESSE_BANQUE,
  ADRESSE_DEPOT,
  CHEMIN_BANQUE,
  IDENTITE,
  ecrireCommit,
  ecrirePublication,
  lireDepot,
  lirePublication,
  publier,
  publierParCommit,
  texteDeLaBanque,
} from "../js/publication/github.js";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { CHEMIN_INDEX, cheminDuPersonnage, chiffrerPersonnage, dechiffrerPersonnage, ecrireFichier, ecrireIndex, ecrireTicket, fichierDuTicket, lireFichier, lireIndex, lireTicket, versionDe } from "../js/personnage/en_ligne.js";
import { inventaire } from "../js/publication/personnages.js";
import { preparerChangement, preparerPublication, preparerReprise } from "../js/publication/preparation.js";
import { ITERATIONS, chiffrer, depuisBase64, deriverCle, nouveauSecret, ouvrir, ouvrirAvecMotDePasse, tirerSel, versBase64 } from "../js/securite/chiffrement.js";
import { DATE_ESSAI, personnageEssai } from "./outils/personnage_essai.js";

globalThis.fetch = () => {
  throw new Error("Appel réel à GitHub interdit dans les contrôles.");
};

const JETON = "jeton-fictif-de-controle";
const ANCIENNE = { format: 1, publiee_le: "2026-09-28T14:32:00+02:00", empreinte: "sha256:aa", kdf: {}, chiffre: {} };
const NOUVELLE = { format: 1, publiee_le: "2026-10-02T09:05:00+02:00", empreinte: "sha256:bb", kdf: {}, chiffre: {} };
const MESSAGE = "Publication du classeur des règles — 02/10/2026 09:05 — 1 bloc ajouté, 0 modifié, 0 retiré";

const texte = (base64) => new TextDecoder().decode(depuisBase64(base64));
const reponse = (statut, corps) => new Response(typeof corps === "string" ? corps : JSON.stringify(corps), { status: statut });

// GitHub simulé : le fichier publié, ou null ; chaque requête est notée.
// avantReponse(requete, github) permet de changer le fichier entre la
// lecture et l'écriture, comme le ferait un autre appareil.
function simulerGithub({ fichier = null, jeton = JETON, avantReponse = null } = {}) {
  const github = { fichier, requetes: [], compteur: 0 };
  github.fetch = async (adresse, init = {}) => {
    const requete = { adresse, methode: init.method ?? "GET", entetes: init.headers ?? {}, cache: init.cache, corps: init.body ? JSON.parse(init.body) : null };
    github.requetes.push(requete);
    if (avantReponse) await avantReponse(requete, github);
    if (requete.entetes.Authorization !== `Bearer ${jeton}`) return reponse(401, { message: "Bad credentials" });
    if (adresse.split("?")[0] !== ADRESSE_BANQUE) return reponse(404, { message: "Not Found" });
    if (requete.methode === "GET") {
      if (!github.fichier) return reponse(404, { message: "Not Found" });
      if (requete.entetes.Accept === "application/vnd.github.raw+json") return reponse(200, github.fichier.texte);
      if (github.fichier.gros) return reponse(200, { sha: github.fichier.sha, encoding: "none", content: "" });
      // GitHub coupe le base64 en lignes de 60 signes.
      const base64 = versBase64(new TextEncoder().encode(github.fichier.texte)).replace(/.{60}/g, "$&\n");
      return reponse(200, { sha: github.fichier.sha, encoding: "base64", content: base64 });
    }
    const { sha, content } = requete.corps;
    if (github.fichier && !sha) return reponse(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
    if (github.fichier && sha !== github.fichier.sha) return reponse(409, { message: `is at ${github.fichier.sha} but expected ${sha}` });
    github.compteur += 1;
    const cree = !github.fichier;
    github.fichier = { sha: `sha-${github.compteur}`, texte: texte(content) };
    return reponse(cree ? 201 : 200, { content: { sha: github.fichier.sha }, commit: { sha: `commit-${github.compteur}` } });
  };
  return github;
}

const fichierPublie = (enveloppe, sha = "sha-publie") => ({ sha, texte: `${JSON.stringify(enveloppe, null, 2)}\n` });

// Un circuit qui note ce qu'on lui fait préparer et confirmer.
function circuit(github, { confirmer = () => true } = {}) {
  const notes = { preparees: [], confirmees: [] };
  const resultat = publier({
    jeton: JETON,
    fetch: github.fetch,
    preparer: async (publiee) => {
      notes.preparees.push(publiee);
      return { enveloppe: NOUVELLE, message: MESSAGE };
    },
    confirmer: async (preparation, { essai }) => {
      notes.confirmees.push(essai);
      return confirmer(essai);
    },
  });
  return { resultat, notes };
}

test("publication — première publication : réponse 404, écriture sans sha", async () => {
  const github = simulerGithub();
  const { resultat, notes } = circuit(github);
  assert.deepEqual(await resultat, { sha: "sha-1", commit: "commit-1", preparation: { enveloppe: NOUVELLE, message: MESSAGE } });
  assert.deepEqual(notes.preparees, [{ sha: null, enveloppe: null }]);
  assert.deepEqual(github.requetes.map((r) => r.methode), ["GET", "PUT"]);
  assert.equal(Object.hasOwn(github.requetes[1].corps, "sha"), false);
  assert.deepEqual(JSON.parse(github.fichier.texte), NOUVELLE);
});

test("publication — mise à jour : le sha lu accompagne l'écriture", async () => {
  const github = simulerGithub({ fichier: fichierPublie(ANCIENNE) });
  const { resultat, notes } = circuit(github);
  assert.equal((await resultat).commit, "commit-1");
  assert.deepEqual(notes.preparees, [{ sha: "sha-publie", enveloppe: ANCIENNE }]);
  assert.equal(github.requetes[1].corps.sha, "sha-publie");
  assert.deepEqual(JSON.parse(github.fichier.texte), NOUVELLE);
});

test("publication — adresses, en-têtes et corps de la requête", async () => {
  const github = simulerGithub({ fichier: fichierPublie(ANCIENNE) });
  await circuit(github).resultat;
  const [lecture, ecriture] = github.requetes;
  assert.equal(ADRESSE_BANQUE, "https://api.github.com/repos/Silviooooooo/atelier-des-arpenteurs/contents/donnees/banque.chiffree.json");
  assert.equal(lecture.adresse, `${ADRESSE_BANQUE}?ref=main`);
  assert.equal(lecture.cache, "no-store");
  assert.equal(ecriture.adresse, ADRESSE_BANQUE);
  for (const { entetes } of [lecture, ecriture]) {
    assert.equal(entetes.Authorization, `Bearer ${JETON}`);
    assert.equal(entetes.Accept, "application/vnd.github+json");
    assert.equal(entetes["X-GitHub-Api-Version"], "2022-11-28");
  }
  assert.equal(ecriture.entetes["Content-Type"], "application/json");
  assert.deepEqual(Object.keys(ecriture.corps).sort(), ["author", "branch", "committer", "content", "message", "sha"]);
  assert.equal(ecriture.corps.message, MESSAGE);
  assert.equal(ecriture.corps.branch, "main");
  assert.equal(texte(ecriture.corps.content), `${JSON.stringify(NOUVELLE, null, 2)}\n`);
});

test("publication — auteur et committer explicites, en adresse privée (§ 8.2)", async () => {
  const github = simulerGithub();
  await circuit(github).resultat;
  const { author, committer } = github.requetes[1].corps;
  assert.deepEqual(author, IDENTITE);
  assert.deepEqual(committer, IDENTITE);
  assert.deepEqual(Object.keys(IDENTITE), ["name", "email"]);
  assert.equal(IDENTITE.name, "Silvio Abbaz");
  assert.match(IDENTITE.email, /^\d+\+Silviooooooo@users\.noreply\.github\.com$/);
});

test("publication — sha périmé : rechargement, nouvelles différences, nouvelle confirmation", async () => {
  // Un autre appareil publie entre la lecture et la première écriture.
  let fait = false;
  const github = simulerGithub({
    fichier: fichierPublie(ANCIENNE),
    avantReponse: (requete, g) => {
      if (requete.methode === "PUT" && !fait) {
        fait = true;
        g.fichier = fichierPublie({ ...ANCIENNE, empreinte: "sha256:ailleurs" }, "sha-ailleurs");
      }
    },
  });
  const { resultat, notes } = circuit(github);
  assert.equal((await resultat).commit, "commit-1");
  assert.deepEqual(github.requetes.map((r) => r.methode), ["GET", "PUT", "GET", "PUT"]);
  assert.deepEqual(notes.preparees.map((p) => p.sha), ["sha-publie", "sha-ailleurs"]);
  assert.equal(notes.preparees[1].enveloppe.empreinte, "sha256:ailleurs");
  assert.deepEqual(notes.confirmees, [1, 2]);
  assert.equal(github.requetes[3].corps.sha, "sha-ailleurs");

  // La seconde confirmation refusée : rien n'est écrit.
  const autre = simulerGithub({
    fichier: fichierPublie(ANCIENNE),
    avantReponse: (requete, g) => {
      if (requete.methode === "PUT" && g.fichier.sha === "sha-publie") g.fichier = fichierPublie(ANCIENNE, "sha-ailleurs");
    },
  });
  const annule = circuit(autre, { confirmer: (essai) => essai === 1 });
  assert.deepEqual(await annule.resultat, { annulee: true });
  assert.deepEqual(autre.requetes.map((r) => r.methode), ["GET", "PUT", "GET"]);
  assert.equal(autre.fichier.sha, "sha-ailleurs");
});

test("publication — première publication doublée par un autre appareil : 422, puis mise à jour", async () => {
  const github = simulerGithub({
    avantReponse: (requete, g) => {
      if (requete.methode === "PUT" && !g.fichier && !requete.corps.sha) g.fichier = fichierPublie(ANCIENNE, "sha-ailleurs");
    },
  });
  const { resultat, notes } = circuit(github);
  assert.equal((await resultat).commit, "commit-1");
  assert.deepEqual(notes.preparees.map((p) => p.sha), [null, "sha-ailleurs"]);
  assert.equal(github.requetes[3].corps.sha, "sha-ailleurs");
});

test("publication — une clé refusée (401) arrête tout, avec un message", async () => {
  const github = simulerGithub({ fichier: fichierPublie(ANCIENNE), jeton: "autre-jeton" });
  const { resultat, notes } = circuit(github);
  const refus = await resultat;
  assert.equal(refus.code, "jeton");
  assert.match(refus.erreur, /GitHub refuse la clé.*401, Bad credentials/);
  assert.deepEqual(notes.preparees, []);
  assert.deepEqual(github.requetes.map((r) => r.methode), ["GET"]);
  // Révoquée entre la lecture et l'écriture.
  const ecrit = await ecrirePublication({ jeton: "revoque", enveloppe: NOUVELLE, sha: "sha-publie", message: MESSAGE, fetch: simulerGithub().fetch });
  assert.equal(ecrit.code, "jeton");
});

test("publication — droits insuffisants, réseau absent, JSON illisible : un message", async () => {
  const interdit = async () => reponse(403, { message: "Resource not accessible by personal access token" });
  const ecrit = await ecrirePublication({ jeton: JETON, enveloppe: NOUVELLE, sha: null, message: MESSAGE, fetch: interdit });
  assert.equal(ecrit.code, "droits");
  assert.match(ecrit.erreur, /Contents.*403, Resource not accessible/);

  const panne = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.equal((await lirePublication({ jeton: JETON, fetch: panne })).code, "reseau");
  assert.equal((await ecrirePublication({ jeton: JETON, enveloppe: NOUVELLE, sha: null, message: MESSAGE, fetch: panne })).code, "reseau");

  const abime = simulerGithub({ fichier: { sha: "sha-publie", texte: "{ pas du JSON" } });
  assert.equal((await lirePublication({ jeton: JETON, fetch: abime.fetch })).code, "format");
});

test("publication — une réponse de GitHub qui n'est pas du JSON : un message ; une écriture faite reste faite", async () => {
  // Un portail captif, ou une réponse coupée : 200, mais du HTML.
  const portail = async () => new Response("<html>Connectez-vous au réseau</html>", { status: 200 });
  const lu = await lirePublication({ jeton: JETON, fetch: portail });
  assert.equal(lu.code, "format");
  assert.match(lu.erreur, /GitHub/);
  // Le fichier est écrit (201), mais le corps de la réponse est perdu.
  const coupee = async (adresse, init = {}) => (init.method === "PUT" ? new Response("", { status: 201 }) : reponse(404, { message: "Not Found" }));
  const ecrit = await ecrirePublication({ jeton: JETON, enveloppe: NOUVELLE, sha: null, message: MESSAGE, fetch: coupee });
  assert.equal(ecrit.erreur, undefined, "l'écriture a eu lieu : ce n'est pas une erreur");
  assert.deepEqual(ecrit, { sha: null, commit: null });
});

test("publication — trois refus 422 : le message final garde le motif de GitHub", async () => {
  const refus = async (adresse, init = {}) => (init.method === "PUT" ? reponse(422, { message: "author.email is invalid" }) : reponse(404, { message: "Not Found" }));
  const resultat = await publier({ jeton: JETON, fetch: refus, preparer: async () => ({ enveloppe: NOUVELLE, message: MESSAGE }), confirmer: async () => true });
  assert.equal(resultat.code, "sha_perime");
  assert.match(resultat.erreur, /GitHub : 422, author.email is invalid/);
});

test("publication — au-delà d'un mégaoctet, le contenu se relit en brut", async () => {
  const github = simulerGithub({ fichier: { ...fichierPublie(ANCIENNE), gros: true } });
  assert.deepEqual(await lirePublication({ jeton: JETON, fetch: github.fetch }), { sha: "sha-publie", enveloppe: ANCIENNE });
  assert.deepEqual(github.requetes.map((r) => r.entetes.Accept), ["application/vnd.github+json", "application/vnd.github.raw+json"]);
});

// La préparation : ce que l'espace auteur montre, puis écrit (§ 6.4, § 8.2).

const ESSAI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));
const MOT_DE_PASSE = "passoire louche marmite écumoire";
const DATE = new Date(2026, 8, 28, 14, 32);

test("préparation — première publication, puis mise à jour sous le même secret", async () => {
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const premiere = await preparerPublication({ publiee: { sha: null, enveloppe: null }, banque, secret, date: DATE });
  assert.equal(premiere.ancienne, null);
  assert.equal(premiere.erreurs, 15);
  assert.equal(premiere.message, "Publication du classeur des règles — 28/09/2026 14:32 — première publication : 35 blocs, 44 capacités, 20 éléments — publiée malgré 15 erreurs");
  assert.deepEqual(Object.keys(premiere.banque).slice(0, 3), ["format", "publiee_le", "sources"]);
  assert.equal(premiere.enveloppe.publiee_le, premiere.banque.publiee_le);
  assert.deepEqual((await ouvrirAvecMotDePasse(premiere.enveloppe, MOT_DE_PASSE)).banque, premiere.banque);

  const plusTard = new Date(2026, 9, 2, 9, 5);
  const seconde = await preparerPublication({ publiee: { sha: "sha-1", enveloppe: premiere.enveloppe }, banque, secret, date: plusTard });
  assert.deepEqual(seconde.ancienne, premiere.banque);
  assert.match(seconde.message, /— 02\/10\/2026 09:05 — aucune différence — publiée malgré 15 erreurs$/);
  assert.equal(seconde.enveloppe.kdf.sel, premiere.enveloppe.kdf.sel);
  assert.notEqual(seconde.banque.publiee_le, premiere.banque.publiee_le);
});

test("préparation — le mot de passe à choisir, à saisir, ou changé ; E1 refusé", async () => {
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const vide = { sha: null, enveloppe: null };
  assert.equal((await preparerPublication({ publiee: vide, banque, secret: null })).code, "nouveau_mot_de_passe");
  const premiere = await preparerPublication({ publiee: vide, banque, secret: await nouveauSecret(MOT_DE_PASSE) });
  const publiee = { sha: "sha-1", enveloppe: premiere.enveloppe };
  assert.equal((await preparerPublication({ publiee, banque, secret: null })).code, "mot_de_passe_requis");
  assert.equal((await preparerPublication({ publiee, banque, secret: await nouveauSecret(MOT_DE_PASSE) })).code, "sel_change");
  const bloquee = { ...banque, anomalies: [{ gravite: "bloquante", code: "E1", feuille: "Blocs", ligne: null, message: "…" }] };
  assert.equal((await preparerPublication({ publiee, banque: bloquee, secret: null })).code, "bloquante");
  assert.equal((await preparerPublication({ publiee, banque: null, secret: null })).code, "bloquante");
});

test("préparation — le changement de mot de passe republie la banque publiée", async () => {
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const ancien = await nouveauSecret(MOT_DE_PASSE);
  const nouveau = await nouveauSecret("un nouveau mot de passe de table");
  const premiere = await preparerPublication({ publiee: { enveloppe: null }, banque, secret: ancien, date: DATE });
  const publiee = { sha: "sha-1", enveloppe: premiere.enveloppe };
  const changement = await preparerChangement({ publiee, ancien, nouveau, date: new Date(2026, 9, 2, 9, 5) });
  assert.equal(changement.message, "Publication du classeur des règles — 02/10/2026 09:05 — aucune différence — nouveau mot de passe de table");
  assert.equal(changement.enveloppe.kdf.sel, nouveau.sel);
  // La banque republiée prend la date du changement, pas celle de sa publication.
  assert.notEqual(changement.enveloppe.publiee_le, premiere.enveloppe.publiee_le);
  assert.match(changement.banque.publiee_le, /^2026-10-02T09:05:00/);
  assert.equal((await ouvrir(changement.enveloppe, ancien)).code, "sel_change");
  const relue = await ouvrirAvecMotDePasse(changement.enveloppe, "un nouveau mot de passe de table");
  assert.deepEqual({ ...relue.banque, publiee_le: null }, { ...premiere.banque, publiee_le: null });
  assert.equal(relue.banque.publiee_le, changement.banque.publiee_le);
  assert.equal((await preparerChangement({ publiee: { enveloppe: null }, ancien, nouveau })).code, "absente");
  assert.equal((await preparerChangement({ publiee, ancien: null, nouveau })).code, "mot_de_passe_requis");
});

test("circuit complet — import, préparation, publication simulée, lecture par un joueur", async () => {
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const secret = await nouveauSecret(MOT_DE_PASSE);
  const github = simulerGithub();
  const publication = await publier({
    jeton: JETON,
    fetch: github.fetch,
    preparer: (publiee) => preparerPublication({ publiee, banque, secret, date: DATE }),
    confirmer: async () => true,
  });
  assert.equal(publication.commit, "commit-1");
  // Un joueur lit le fichier écrit, avec le mot de passe transmis.
  const lu = await ouvrirAvecMotDePasse(JSON.parse(github.fichier.texte), MOT_DE_PASSE);
  assert.deepEqual(lu.banque, publication.preparation.banque);
  assert.equal(github.requetes[1].corps.message, publication.preparation.message);
});

// — La clé de dépôt des personnages, et le rechiffrement des personnages en
// ligne au changement du mot de passe (§ 8.4)

// Une clé de dépôt fictive, fabriquée à l'exécution : aucun fichier suivi ne
// porte de chaîne qui ait la forme d'un jeton GitHub (tests/depot.test.js).
const cleFictive = (signe) => `github_pat_${signe.repeat(82)}`;
const ANCIEN_MDP = "passoire louche marmite";
const NOUVEAU_MDP = "écumoire fouet tamis";
const DATE_CHANGEMENT = new Date(2026, 9, 2, 9, 5);
// Une banque réduite : de quoi comparer et chiffrer, vite.
const BANQUE_REDUITE = { format: 1, sources: [], blocs: [], capacites: [], elements: [], lisez_moi: [], anomalies: [] };

const secrets = (() => {
  let tenus = null;
  return async () =>
    (tenus ??= { ancien: await nouveauSecret(ANCIEN_MDP), nouveau: await nouveauSecret(NOUVEAU_MDP), autre: await nouveauSecret("un mot de passe plus ancien encore") });
})();

const banqueChiffree = (secret, supplement = {}) => chiffrer({ ...BANQUE_REDUITE, publiee_le: "2026-09-28T14:32:00+02:00", ...supplement }, secret);

test("clé de dépôt — ajoutée, gardée d'une publication à l'autre, remplacée, retirée", async () => {
  const { ancien: secret } = await secrets();
  const [premiere, seconde] = [cleFictive("A"), cleFictive("B")];
  const preparer = (enveloppe, cle) => preparerPublication({ publiee: { sha: enveloppe ? "sha-publie" : null, enveloppe }, banque: BANQUE_REDUITE, secret, date: DATE, cle });
  const relue = async (preparation) => (await ouvrirAvecMotDePasse(preparation.enveloppe, ANCIEN_MDP)).banque;

  const ajoutee = await preparer(null, { action: "remplacer", valeur: premiere });
  assert.equal(ajoutee.cle_depot, "ajoutee");
  assert.equal(ajoutee.banque.cle_depot, premiere);
  assert.equal(Object.keys(ajoutee.banque).at(-1), "cle_depot", "en fin de banque");
  assert.equal((await relue(ajoutee)).cle_depot, premiere, "la banque chiffrée la porte");

  // Sans décision, la clé publiée est gardée.
  const gardee = await preparer(ajoutee.enveloppe);
  assert.equal(gardee.cle_depot, "gardee");
  assert.equal((await relue(gardee)).cle_depot, premiere);

  const remplacee = await preparer(gardee.enveloppe, { action: "remplacer", valeur: seconde });
  assert.equal(remplacee.cle_depot, "remplacee");
  assert.equal((await relue(remplacee)).cle_depot, seconde);
  // La même clé, saisie de nouveau : rien ne change.
  assert.equal((await preparer(remplacee.enveloppe, { action: "remplacer", valeur: seconde })).cle_depot, "gardee");

  const retiree = await preparer(remplacee.enveloppe, { action: "retirer" });
  assert.equal(retiree.cle_depot, "retiree");
  assert.equal(Object.hasOwn(retiree.banque, "cle_depot"), false, "le champ n'existe que s'il a une valeur");
  assert.equal(Object.hasOwn(await relue(retiree), "cle_depot"), false);
  assert.equal((await preparer(retiree.enveloppe)).cle_depot, "absente");
  assert.equal((await preparer(retiree.enveloppe, { action: "retirer" })).cle_depot, "absente");

  // Seule la décision de l'auteur la met dans la banque : un champ venu
  // avec la banque importée ne passe pas.
  const importee = await preparerPublication({ publiee: { enveloppe: null }, banque: { ...BANQUE_REDUITE, cle_depot: seconde }, secret, date: DATE });
  assert.equal(importee.cle_depot, "absente");
  assert.equal(Object.hasOwn(importee.banque, "cle_depot"), false);
  // Le message de commit, public, n'en dit rien.
  assert.equal(ajoutee.message, importee.message);
  assert.match(remplacee.message, /— aucune différence$/);
});

test("clé de dépôt — une forme invalide ne part jamais, et le refus ne recopie pas la saisie", async () => {
  const { ancien: secret, nouveau } = await secrets();
  const classique = `ghp_${"x".repeat(36)}`;
  const invalides = ["", "   ", "pas une clé", classique, `${cleFictive("x")} `, `github_pat_${"x".repeat(10)}`, `github_pat_${"x".repeat(40)}!`, 42, null];
  for (const valeur of invalides) {
    // Refusée avant le mot de passe, et après.
    for (const s of [null, secret]) {
      const refus = await preparerPublication({ publiee: { enveloppe: null }, banque: BANQUE_REDUITE, secret: s, cle: { action: "remplacer", valeur } });
      assert.equal(refus.code, "cle_depot", String(valeur));
      assert.equal(refus.enveloppe, undefined);
      if (typeof valeur === "string" && valeur.trim()) assert.equal(refus.erreur.includes(valeur.trim()), false, "le message ne recopie pas la saisie");
    }
  }
  // Une clé publiée de forme invalide ne se garde pas ; elle se remplace ou se retire.
  const publiee = { sha: "sha-publie", enveloppe: await banqueChiffree(secret, { cle_depot: "pas une clé de dépôt" }) };
  const gardee = await preparerPublication({ publiee, banque: BANQUE_REDUITE, secret });
  assert.equal(gardee.code, "cle_depot");
  assert.match(gardee.erreur, /banque publiée.*remplacez-la ou retirez-la/);
  assert.equal((await preparerPublication({ publiee, banque: BANQUE_REDUITE, secret, cle: { action: "retirer" } })).cle_depot, "retiree");
  assert.equal((await preparerPublication({ publiee, banque: BANQUE_REDUITE, secret, cle: { action: "remplacer", valeur: cleFictive("C") } })).cle_depot, "remplacee");
  assert.equal((await preparerPublication({ publiee, banque: BANQUE_REDUITE, secret, cle: { action: "effacer" } })).code, "cle_depot");
  // Au changement de mot de passe aussi.
  assert.equal((await preparerChangement({ publiee, ancien: secret, nouveau })).code, "cle_depot");
  assert.equal((await preparerChangement({ publiee, ancien: secret, nouveau, cle: { action: "remplacer", valeur: classique } })).code, "cle_depot");
  assert.equal((await preparerChangement({ publiee, ancien: secret, nouveau, cle: { action: "retirer" } })).cle_depot, "retiree");
});

test("clé de dépôt — la clé GitHub de l'auteur n'entre jamais dans la banque", async () => {
  const { ancien: secret, nouveau } = await secrets();
  // Les deux clés sont des jetons à portée fine : la même forme.
  const jetonAuteur = cleFictive("J");
  const vide = { enveloppe: null };
  const preparer = (options) => preparerPublication({ banque: BANQUE_REDUITE, jetonAuteur, ...options });
  const saisie = { action: "remplacer", valeur: jetonAuteur };
  // Saisie comme clé de dépôt : refusée avant le mot de passe, et après.
  for (const s of [null, secret]) {
    const refus = await preparer({ publiee: vide, secret: s, cle: saisie });
    assert.equal(refus.code, "cle_depot");
    assert.match(refus.erreur, /est la clé GitHub de l'auteur, qui peut écrire dans le dépôt.*permission Issues seule/);
    assert.equal(refus.erreur.includes(jetonAuteur), false, "le message ne recopie pas la clé");
    assert.equal(refus.enveloppe, undefined);
  }
  assert.equal((await preparer({ publiee: vide, secret, cle: { action: "remplacer", valeur: cleFictive("K") } })).cle_depot, "ajoutee", "une autre clé passe");
  // Déjà dans la banque publiée : elle ne se garde pas, elle se retire.
  const publiee = { sha: "sha-publie", enveloppe: await banqueChiffree(secret, { cle_depot: jetonAuteur }) };
  const gardee = await preparer({ publiee, secret });
  assert.equal(gardee.code, "cle_depot");
  assert.match(gardee.erreur, /banque publiée.*clé GitHub de l'auteur.*révoquez-la/);
  assert.equal(gardee.erreur.includes(jetonAuteur), false);
  assert.equal((await preparer({ publiee, secret, cle: { action: "retirer" } })).cle_depot, "retiree");
  assert.equal((await preparer({ publiee, secret, cle: { action: "remplacer", valeur: cleFictive("K") } })).cle_depot, "remplacee");
  // Au changement de mot de passe, de même.
  const changer = (cle) => preparerChangement({ publiee, ancien: secret, nouveau, jetonAuteur, cle });
  assert.equal((await changer()).code, "cle_depot");
  assert.equal((await preparerChangement({ publiee, ancien: null, nouveau, jetonAuteur, cle: saisie })).code, "cle_depot", "avant le mot de passe");
  assert.equal((await changer({ action: "retirer" })).cle_depot, "retiree");
});

// GitHub simulé pour l'API Git Data : blobs, arbres, commits et référence de
// main, en mémoire, avec des sha hexadécimaux. Chaque requête est notée ;
// avantReponse(requete, depot) laisse un autre acteur (l'automate, un autre
// appareil) commiter entre deux requêtes, par depot.commiterAilleurs.
function simulerDepot({ fichiers = {}, jeton = JETON, avantReponse = null, tronque = false } = {}) {
  const depot = { requetes: [], blobs: new Map(), arbres: new Map(), commits: new Map(), ref: null };
  let compteur = 0;
  const hache = (texte) => createHash("sha1").update(texte).digest("hex");
  const blob = (contenu) => {
    const sha = hache(`blob ${contenu}`);
    depot.blobs.set(sha, contenu);
    return sha;
  };
  const arbre = (table) => {
    compteur += 1;
    const sha = hache(`arbre ${compteur}`);
    depot.arbres.set(sha, table);
    return sha;
  };
  const commit = (arbreSha, parents, corps) => {
    compteur += 1;
    const sha = hache(`commit ${compteur}`);
    depot.commits.set(sha, { arbre: arbreSha, parents, ...corps });
    return sha;
  };
  const arbreDe = (commitSha) => depot.arbres.get(depot.commits.get(commitSha).arbre);
  const changer = (table, changements) => {
    const nouvelle = new Map(table);
    for (const [chemin, contenu] of Object.entries(changements)) {
      if (contenu === null) nouvelle.delete(chemin);
      else nouvelle.set(chemin, blob(contenu));
    }
    return nouvelle;
  };
  depot.ref = commit(arbre(changer(new Map(), fichiers)), [], { message: "Premier commit" });
  depot.fichiers = () => Object.fromEntries([...arbreDe(depot.ref)].map(([chemin, sha]) => [chemin, depot.blobs.get(sha)]));
  depot.commiterAilleurs = (changements, message = "Personnage rangé") => {
    depot.ref = commit(arbre(changer(arbreDe(depot.ref), changements)), [depot.ref], { message });
  };
  const octets = (contenu) => new TextEncoder().encode(contenu);
  depot.fetch = async (adresse, init = {}) => {
    const requete = { adresse, methode: init.method ?? "GET", entetes: init.headers ?? {}, cache: init.cache, corps: init.body ? JSON.parse(init.body) : null };
    depot.requetes.push(requete);
    if (avantReponse) await avantReponse(requete, depot);
    if (requete.entetes.Authorization !== `Bearer ${jeton}`) return reponse(401, { message: "Bad credentials" });
    const prefixe = `${ADRESSE_DEPOT}/git/`;
    if (!adresse.startsWith(prefixe)) return reponse(404, { message: "Not Found" });
    const [chemin, parametres] = adresse.slice(prefixe.length).split("?");
    const [genre, ...reste] = chemin.split("/");
    const cible = reste.join("/");
    const { corps } = requete;
    switch (`${requete.methode} ${genre}`) {
      case "GET ref":
        if (cible === "heads/main") return reponse(200, { ref: "refs/heads/main", object: { type: "commit", sha: depot.ref } });
        break;
      case "GET commits":
        if (depot.commits.has(cible)) return reponse(200, { sha: cible, tree: { sha: depot.commits.get(cible).arbre } });
        break;
      case "GET trees": {
        if (!depot.arbres.has(cible) || parametres !== "recursive=1") break;
        const entrees = [];
        const dossiers = new Set();
        for (const [p, sha] of depot.arbres.get(cible)) {
          const morceaux = p.split("/");
          for (let i = 1; i < morceaux.length; i += 1) dossiers.add(morceaux.slice(0, i).join("/"));
          entrees.push({ path: p, mode: "100644", type: "blob", sha, size: octets(depot.blobs.get(sha)).length });
        }
        for (const d of dossiers) entrees.push({ path: d, mode: "040000", type: "tree", sha: hache(`dossier ${d}`) });
        return reponse(200, { sha: cible, tree: entrees, truncated: tronque });
      }
      case "GET blobs":
        if (depot.blobs.has(cible)) {
          // GitHub coupe le base64 en lignes de 60 signes.
          const contenu = versBase64(octets(depot.blobs.get(cible))).replace(/.{60}/g, "$&\n");
          return reponse(200, { sha: cible, encoding: "base64", content: contenu, size: octets(depot.blobs.get(cible)).length });
        }
        break;
      case "POST blobs":
        return reponse(201, { sha: blob(corps.encoding === "base64" ? new TextDecoder().decode(depuisBase64(corps.content)) : corps.content) });
      case "POST trees": {
        if (!depot.arbres.has(corps.base_tree)) return reponse(422, { message: "Invalid tree" });
        const table = new Map(depot.arbres.get(corps.base_tree));
        for (const entree of corps.tree) {
          if (entree.mode !== "100644" || entree.type !== "blob") return reponse(422, { message: "Invalid tree entry" });
          if (entree.content !== undefined) table.set(entree.path, blob(entree.content));
          else if (depot.blobs.has(entree.sha)) table.set(entree.path, entree.sha);
          else return reponse(422, { message: "Invalid sha" });
        }
        return reponse(201, { sha: arbre(table) });
      }
      case "POST commits":
        if (!depot.arbres.has(corps.tree) || !corps.parents.every((p) => depot.commits.has(p))) return reponse(422, { message: "Invalid commit" });
        return reponse(201, { sha: commit(corps.tree, corps.parents, { message: corps.message, author: corps.author, committer: corps.committer }) });
      case "PATCH refs":
        if (cible !== "heads/main" || !depot.commits.has(corps.sha)) break;
        if (!corps.force && !depot.commits.get(corps.sha).parents.includes(depot.ref)) return reponse(422, { message: "Update is not a fast forward" });
        depot.ref = corps.sha;
        return reponse(200, { ref: "refs/heads/main", object: { type: "commit", sha: corps.sha } });
    }
    return reponse(404, { message: "Not Found" });
  };
  return depot;
}

const DEPOSE = "2026-09-30T10:21:36.536Z";
const RANGE = "2026-09-30T10:22:05Z";
const ID_A = "PersonnageAlpha000001";
const ID_B = "PersonnageBravo000002";
const ID_C = "PersonnageCharlie00003";
const ID_D = "PersonnageDelta000004";
const ID_E = "PersonnageEcho0000005";

// Un personnage enregistré de la banque réelle, sous un identifiant donné.
const enregistre = (identifiant) =>
  personnageEssai((p) => Object.assign(p, { id: identifiant, mode: "reel", etat: "enregistre", etape: 9, enregistre_le: DATE_ESSAI.toISOString() }));

// Le fichier qu'aurait rangé l'automate, chiffré sous secret.
async function fichierRange(identifiant, secret, numero = 7) {
  const chiffre = await chiffrerPersonnage(enregistre(identifiant), secret);
  assert.equal(chiffre.erreur, undefined, chiffre.erreur);
  const { corps } = ecrireTicket({ action: "creer", identifiant, date: DEPOSE, personnage: chiffre });
  return fichierDuTicket(lireTicket(corps).ticket, { rangeLe: RANGE, numero });
}

// Les fichiers d'un dépôt : une page, la banque, des personnages rangés et
// leur index.
function fichiersDuDepot(enveloppe, ranges, { index = true } = {}) {
  const fichiers = { "index.html": "<!doctype html>\n", [CHEMIN_BANQUE]: texteDeLaBanque(enveloppe) };
  for (const fichier of ranges) fichiers[cheminDuPersonnage(fichier.identifiant)] = ecrireFichier(fichier);
  if (index) fichiers[CHEMIN_INDEX] = ecrireIndex(ranges);
  return fichiers;
}

// Les écritures faites au dépôt simulé : « MÉTHODE /chemin ».
const ecrituresDe = (depot) => depot.requetes.filter((r) => r.methode !== "GET").map((r) => `${r.methode} ${r.adresse.slice(ADRESSE_DEPOT.length)}`);
const COMMIT = ["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main"];

// Le fichier rangé d'un personnage, relu dans le dépôt.
const relireFichier = (fichiers, identifiant) => lireFichier(fichiers[cheminDuPersonnage(identifiant)], { identifiant }).fichier;

test("clé de dépôt — jamais dans le message de commit, ni en clair dans une requête", async () => {
  const { ancien, nouveau } = await secrets();
  const [premiere, seconde] = [cleFictive("K"), cleFictive("L")];
  const github = simulerGithub({ fichier: fichierPublie(await banqueChiffree(ancien)) });
  const publication = await publier({
    jeton: JETON,
    fetch: github.fetch,
    preparer: (publiee) => preparerPublication({ publiee, banque: BANQUE_REDUITE, secret: ancien, date: DATE, cle: { action: "remplacer", valeur: premiere } }),
    confirmer: async () => true,
  });
  assert.equal(publication.preparation.cle_depot, "ajoutee");
  assert.deepEqual(github.requetes.map((r) => r.methode), ["GET", "PUT"], "la publication ordinaire garde son PUT d'un seul fichier");
  const ecriture = github.requetes[1];
  assert.doesNotMatch(ecriture.corps.message, /github_pat_|K{10}|clé|dépôt/i);
  assert.equal(JSON.stringify(ecriture.corps).includes(premiere), false);
  assert.equal(texte(ecriture.corps.content).includes(premiere), false, "le fichier écrit ne la porte que chiffrée");
  const publiee = JSON.parse(github.fichier.texte);
  assert.equal((await ouvrirAvecMotDePasse(publiee, ANCIEN_MDP)).banque.cle_depot, premiere);

  // Au changement de mot de passe, par l'API Git Data.
  const depot = simulerDepot({ fichiers: fichiersDuDepot(publiee, [await fichierRange(ID_A, ancien)]) });
  const changement = await publierParCommit({
    jeton: JETON,
    fetch: depot.fetch,
    preparer: (lu) => preparerChangement({ publiee: lu, ancien, nouveau, date: DATE_CHANGEMENT, cle: { action: "remplacer", valeur: seconde } }),
    confirmer: async () => true,
  });
  assert.equal(changement.preparation.cle_depot, "remplacee");
  for (const requete of depot.requetes) {
    const ecrite = JSON.stringify(requete);
    assert.equal(ecrite.includes(premiere) || ecrite.includes(seconde), false, requete.adresse);
  }
  assert.doesNotMatch(changement.preparation.message, /github_pat_|clé|dépôt/i);
  assert.equal((await ouvrirAvecMotDePasse(JSON.parse(depot.fichiers()[CHEMIN_BANQUE]), NOUVEAU_MDP)).banque.cle_depot, seconde);
});

test("changement — un seul commit : la banque, les personnages rechiffrés et l'index régénéré (§ 8.4)", async () => {
  const { ancien, nouveau } = await secrets();
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const cle = cleFictive("D");
  const publiee = await preparerPublication({ publiee: { enveloppe: null }, banque, secret: ancien, date: DATE, cle: { action: "remplacer", valeur: cle } });
  const a = await fichierRange(ID_A, ancien, 3);
  const b = await fichierRange(ID_B, ancien, 4);
  const depot = simulerDepot({ fichiers: fichiersDuDepot(publiee.enveloppe, [a, b]) });
  const depart = depot.ref;
  const arbreDepart = depot.commits.get(depart).arbre;
  const confirmees = [];
  const resultat = await publierParCommit({
    jeton: JETON,
    fetch: depot.fetch,
    preparer: (lu) => preparerChangement({ publiee: lu, ancien, nouveau, date: DATE_CHANGEMENT }),
    confirmer: async (preparation, { essai }) => {
      confirmees.push({ essai, rechiffres: preparation.personnages.rechiffres });
      return true;
    },
  });
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  assert.deepEqual(confirmees, [{ essai: 1, rechiffres: [ID_A, ID_B] }], "la confirmation connaît les personnages rechiffrés");

  // La lecture : la branche sans cache, son commit, l'arbre complet, les fichiers.
  const lectures = depot.requetes.filter((r) => r.methode === "GET");
  assert.equal(lectures[0].adresse, `${ADRESSE_DEPOT}/git/ref/heads/main`);
  assert.equal(lectures[0].cache, "no-store");
  assert.equal(lectures[1].adresse, `${ADRESSE_DEPOT}/git/commits/${depart}`);
  assert.equal(lectures[2].adresse, `${ADRESSE_DEPOT}/git/trees/${arbreDepart}?recursive=1`);
  for (const { entetes } of depot.requetes) {
    assert.equal(entetes.Authorization, `Bearer ${JETON}`);
    assert.equal(entetes["X-GitHub-Api-Version"], "2022-11-28");
  }

  // Un seul commit : la banque en blob (elle dépasse 64 Ko), l'arbre, le
  // commit, puis l'avance de la branche, sans forcer. Aucun PUT.
  assert.deepEqual(ecrituresDe(depot), ["POST /git/blobs", ...COMMIT]);
  const [, arbre, commit, avance] = depot.requetes.filter((r) => r.methode !== "GET");
  assert.equal(arbre.corps.base_tree, arbreDepart);
  assert.deepEqual(arbre.corps.tree.map((e) => e.path).sort(), [CHEMIN_BANQUE, CHEMIN_INDEX, cheminDuPersonnage(ID_A), cheminDuPersonnage(ID_B)].sort());
  assert.deepEqual(commit.corps.parents, [depart]);
  assert.deepEqual(commit.corps.author, IDENTITE);
  assert.deepEqual(commit.corps.committer, IDENTITE);
  assert.equal(commit.corps.message, "Publication du classeur des règles — 02/10/2026 09:05 — aucune différence — nouveau mot de passe de table, 2 personnages rechiffrés");
  assert.deepEqual(avance.corps, { sha: resultat.commit, force: false });
  assert.equal(depot.ref, resultat.commit);
  assert.equal(depot.commits.size, 2, "un seul commit de plus");

  const apres = depot.fichiers();
  assert.equal(apres["index.html"], "<!doctype html>\n", "le reste du dépôt ne bouge pas");
  const relue = await ouvrirAvecMotDePasse(JSON.parse(apres[CHEMIN_BANQUE]), NOUVEAU_MDP);
  assert.equal(relue.banque.cle_depot, cle, "la clé de dépôt suit la banque");
  assert.equal(resultat.preparation.cle_depot, "gardee");
  const versions = [];
  for (const avant of [a, b]) {
    const fichier = relireFichier(apres, avant.identifiant);
    assert.deepEqual((await dechiffrerPersonnage(fichier, nouveau)).personnage, enregistre(avant.identifiant), "déchiffrable avec la nouvelle clé");
    assert.equal((await dechiffrerPersonnage(fichier, ancien)).code, "cle", "plus avec l'ancienne");
    // Ses autres champs restent.
    const garde = ({ sel: _sel, iv: _iv, contenu: _contenu, ...reste }) => reste;
    assert.deepEqual(garde(fichier), garde(avant));
    assert.notEqual(versionDe(fichier), versionDe(avant));
    versions.push(versionDe(fichier));
  }
  assert.deepEqual(lireIndex(apres[CHEMIN_INDEX]).index.personnages.map((e) => e.version), versions, "l'index porte les versions nouvelles");
  assert.deepEqual(resultat.preparation.personnages, { total: 2, rechiffres: [ID_A, ID_B], aJour: [], autreCle: [], echecs: [], illisibles: [] });
});

test("changement — un refus d'avance relance tout, et rechiffre aussi le personnage rangé entre-temps", async () => {
  const { ancien, nouveau } = await secrets();
  const enveloppe = await banqueChiffree(ancien);
  const a = await fichierRange(ID_A, ancien);
  const c = await fichierRange(ID_C, ancien, 9);
  let range = false;
  const depot = simulerDepot({
    fichiers: fichiersDuDepot(enveloppe, [a]),
    avantReponse: (requete, d) => {
      // L'automate range un personnage entre la lecture et l'avance.
      if (requete.methode === "PATCH" && !range) {
        range = true;
        d.commiterAilleurs({ [cheminDuPersonnage(ID_C)]: ecrireFichier(c), [CHEMIN_INDEX]: ecrireIndex([a, c]) });
      }
    },
  });
  const confirmees = [];
  const preparer = (lu) => preparerChangement({ publiee: lu, ancien, nouveau, date: DATE_CHANGEMENT });
  const resultat = await publierParCommit({
    jeton: JETON,
    fetch: depot.fetch,
    preparer,
    confirmer: async (preparation, { essai }) => {
      confirmees.push([essai, preparation.personnages.rechiffres.length]);
      return true;
    },
  });
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  assert.deepEqual(confirmees, [
    [1, 1],
    [2, 2],
  ]);
  assert.deepEqual(ecrituresDe(depot), [...COMMIT, ...COMMIT]);
  const apres = depot.fichiers();
  for (const identifiant of [ID_A, ID_C]) {
    assert.deepEqual((await dechiffrerPersonnage(relireFichier(apres, identifiant), nouveau)).personnage, enregistre(identifiant), identifiant);
  }
  assert.deepEqual(lireIndex(apres[CHEMIN_INDEX]).index.personnages.map((e) => e.identifiant), [ID_A, ID_C]);
  const parent = depot.commits.get(depot.ref).parents[0];
  assert.equal(depot.commits.get(parent).message, "Personnage rangé", "le commit suit celui de l'automate");

  // Refusée à chaque essai : un message, avec le motif du dernier refus.
  let autres = 0;
  const encombre = simulerDepot({
    fichiers: fichiersDuDepot(enveloppe, [a]),
    avantReponse: (requete, d) => {
      if (requete.methode === "PATCH") d.commiterAilleurs({ [`autre-${(autres += 1)}.txt`]: "ailleurs" }, "Ailleurs");
    },
  });
  const echec = await publierParCommit({ jeton: JETON, fetch: encombre.fetch, preparer, confirmer: async () => true });
  assert.equal(echec.code, "avance_refusee");
  assert.match(echec.erreur, /à chacun des 3 essais.*422, Update is not a fast forward/);
  assert.equal(encombre.commits.get(encombre.ref).message, "Ailleurs", "rien d'écrit sur main");

  // La confirmation refusée au second essai : rien ne s'écrit.
  let refuse = false;
  const annule = simulerDepot({
    fichiers: fichiersDuDepot(enveloppe, [a]),
    avantReponse: (requete, d) => {
      if (requete.methode === "PATCH" && !refuse) {
        refuse = true;
        d.commiterAilleurs({ "autre.txt": "ailleurs" });
      }
    },
  });
  const arrete = await publierParCommit({ jeton: JETON, fetch: annule.fetch, preparer, confirmer: async (preparation, { essai }) => essai === 1 });
  assert.deepEqual(arrete, { annulee: true });
  assert.deepEqual(ecrituresDe(annule), COMMIT);
});

test("changement — un personnage d'une autre clé, ou illisible, est laissé tel quel et compté", async () => {
  const { ancien, nouveau, autre } = await secrets();
  const enveloppe = await banqueChiffree(ancien);
  const a = await fichierRange(ID_A, ancien);
  const b = await fichierRange(ID_B, autre);
  // Le bon sel, mais le chiffré d'un autre identifiant : il ne s'ouvre pas.
  const recopie = { ...(await fichierRange(ID_A, ancien)), identifiant: ID_C };
  const ancienIndex = ecrireIndex([a, b, recopie, { identifiant: ID_D, range_le: RANGE, iv: versBase64(new Uint8Array(12)) }]);
  const fichiers = {
    ...fichiersDuDepot(enveloppe, [a, b, recopie], { index: false }),
    [cheminDuPersonnage(ID_D)]: "{ abîmé",
    [cheminDuPersonnage(ID_E)]: "x".repeat(100 * 1024),
    [CHEMIN_INDEX]: ancienIndex,
  };
  const depot = simulerDepot({ fichiers });
  const resultat = await publierParCommit({
    jeton: JETON,
    fetch: depot.fetch,
    preparer: (lu) => preparerChangement({ publiee: lu, ancien, nouveau, date: DATE_CHANGEMENT }),
    confirmer: async () => true,
  });
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  assert.deepEqual(resultat.preparation.personnages, { total: 5, rechiffres: [ID_A], aJour: [], autreCle: [ID_B], echecs: [ID_C], illisibles: [ID_D, ID_E] });
  assert.match(resultat.preparation.message, /nouveau mot de passe de table, 1 personnage rechiffré$/);
  // Le fichier trop gros ne se télécharge même pas.
  assert.equal(depot.requetes.filter((r) => r.adresse.includes("/git/blobs/")).length, 6, "la banque, l'index et quatre personnages");
  // Seuls la banque, le personnage rechiffré et l'index s'écrivent.
  const arbre = depot.requetes.find((r) => r.adresse.endsWith("/git/trees"));
  assert.deepEqual(arbre.corps.tree.map((e) => e.path).sort(), [CHEMIN_BANQUE, CHEMIN_INDEX, cheminDuPersonnage(ID_A)].sort());
  const apres = depot.fichiers();
  for (const identifiant of [ID_B, ID_C, ID_D, ID_E]) assert.equal(apres[cheminDuPersonnage(identifiant)], fichiers[cheminDuPersonnage(identifiant)], identifiant);
  // L'index : le rechiffré à sa nouvelle version, les autres à l'ancienne ;
  // l'entrée du fichier illisible est gardée, et aucune n'est inventée.
  const versions = (texteIndex) => Object.fromEntries(lireIndex(texteIndex).index.personnages.map((e) => [e.identifiant, e.version]));
  const [avant, maintenant] = [versions(ancienIndex), versions(apres[CHEMIN_INDEX])];
  assert.deepEqual(Object.keys(maintenant), [ID_A, ID_B, ID_C, ID_D]);
  assert.notEqual(maintenant[ID_A], avant[ID_A]);
  for (const identifiant of [ID_B, ID_C, ID_D]) assert.equal(maintenant[identifiant], avant[identifiant], identifiant);
});

test("changement — arbre tronqué, clé refusée, droits, réseau, réponse illisible : un message, rien d'écrit", async () => {
  const { ancien, nouveau } = await secrets();
  const fichiers = fichiersDuDepot(await banqueChiffree(ancien), [await fichierRange(ID_A, ancien)]);
  const preparer = (lu) => preparerChangement({ publiee: lu, ancien, nouveau });
  const circuitSur = (fetch) => publierParCommit({ jeton: JETON, fetch, preparer, confirmer: async () => true });

  const tronque = simulerDepot({ fichiers, tronque: true });
  const coupe = await circuitSur(tronque.fetch);
  assert.equal(coupe.code, "arbre_tronque");
  assert.match(coupe.erreur, /rien n'est écrit/);
  assert.deepEqual(ecrituresDe(tronque), []);

  const autreJeton = simulerDepot({ fichiers, jeton: "autre-jeton" });
  assert.equal((await circuitSur(autreJeton.fetch)).code, "jeton");

  // Lecture permise, écriture refusée : la permission Contents est citée.
  const lecteur = simulerDepot({ fichiers });
  const interdit = async (adresse, init = {}) => ((init.method ?? "GET") === "GET" ? lecteur.fetch(adresse, init) : reponse(403, { message: "Resource not accessible by personal access token" }));
  const droits = await circuitSur(interdit);
  assert.equal(droits.code, "droits");
  assert.match(droits.erreur, /« Contents ».*403, Resource not accessible/);

  const panne = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.equal((await circuitSur(panne)).code, "reseau");
  const portail = async () => new Response("<html>Connectez-vous au réseau</html>", { status: 200 });
  assert.equal((await circuitSur(portail)).code, "format");
  assert.equal((await lireDepot({ jeton: JETON, fetch: async () => reponse(200, { object: { sha: "../../x" } }) })).code, "format", "un sha qui n'en est pas un");

  // 409 vaut refus d'avance ; une avance faite au corps perdu reste faite.
  const sha = (signe) => signe.repeat(40);
  const commun = { jeton: JETON, parent: sha("a"), base: sha("b"), fichiers: [{ chemin: "x.json", texte: "{}\n" }], message: "m" };
  const conflit = async (adresse, init = {}) => (init.method === "PATCH" ? reponse(409, { message: "Reference cannot be updated" }) : reponse(201, { sha: sha("c") }));
  const refus = await ecrireCommit({ ...commun, fetch: conflit });
  assert.equal(refus.code, "avance_refusee");
  assert.match(refus.motif, /409, Reference cannot be updated/);
  const perdu = async (adresse, init = {}) => (init.method === "PATCH" ? new Response("", { status: 200 }) : reponse(201, { sha: sha("d") }));
  assert.deepEqual(await ecrireCommit({ ...commun, fetch: perdu }), { commit: sha("d") });
});

test("changement — une réponse de GitHub illisible sur un fichier arrête tout ; seul un fichier reçu entier et abîmé est laissé", async () => {
  const { ancien, nouveau } = await secrets();
  const [a, b] = [await fichierRange(ID_A, ancien), await fichierRange(ID_B, ancien)];
  const fichiers = fichiersDuDepot(await banqueChiffree(ancien), [a, b]);
  const preparer = (lu) => preparerChangement({ publiee: lu, ancien, nouveau });
  // Le dépôt simulé, où la lecture du fichier au chemin donné reçoit une
  // autre réponse que celle de GitHub.
  const surFichier = (chemin, reponseDuBlob) => {
    const depot = simulerDepot({ fichiers });
    const fetch = async (adresse, init = {}) => {
      const sha = /\/git\/blobs\/([0-9a-f]{40})$/.exec(adresse)?.[1];
      return sha && depot.blobs.get(sha) === fichiers[chemin] ? reponseDuBlob() : depot.fetch(adresse, init);
    };
    return { depot, circuit: () => publierParCommit({ jeton: JETON, fetch, preparer, confirmer: async () => true }) };
  };

  // La lecture a échoué, pas le fichier : un nouvel essai le rechiffrera.
  // Rien ne s'écrit, ni la banque sous le nouveau mot de passe.
  const pannes = {
    "un portail captif": () => new Response("<html>Connectez-vous au réseau</html>", { status: 200 }),
    "un corps coupé": () => new Response('{"sha":"', { status: 200 }),
    "un fichier sans contenu": () => reponse(200, { encoding: "none", content: "" }),
    "un base64 abîmé": () => reponse(200, { encoding: "base64", content: "@@@@" }),
  };
  for (const chemin of [cheminDuPersonnage(ID_B), CHEMIN_INDEX]) {
    for (const [cas, panne] of Object.entries(pannes)) {
      const { depot, circuit } = surFichier(chemin, panne);
      const resultat = await circuit();
      assert.equal(resultat.code, "format", `${chemin}, ${cas}`);
      assert.match(resultat.erreur, /La réponse de GitHub est/, `${chemin}, ${cas}`);
      assert.deepEqual(ecrituresDe(depot), [], `${chemin}, ${cas} : rien d'écrit`);
    }
  }

  // Un fichier reçu entier qui ne se décode pas : c'est lui qui est abîmé.
  // Un personnage est laissé et compté, son entrée d'index gardée ; un index
  // se régénère.
  const nonUtf8 = () => reponse(200, { encoding: "base64", content: versBase64(new Uint8Array([0xff, 0xfe, 0x7b])) });
  const personnageAbime = surFichier(cheminDuPersonnage(ID_B), nonUtf8);
  const laisse = await personnageAbime.circuit();
  assert.equal(laisse.erreur, undefined, laisse.erreur);
  assert.deepEqual([laisse.preparation.personnages.rechiffres, laisse.preparation.personnages.illisibles], [[ID_A], [ID_B]]);
  assert.deepEqual(lireIndex(personnageAbime.depot.fichiers()[CHEMIN_INDEX]).index.personnages.map((e) => e.identifiant), [ID_A, ID_B]);
  const indexAbime = surFichier(CHEMIN_INDEX, nonUtf8);
  const regenere = await indexAbime.circuit();
  assert.equal(regenere.erreur, undefined, regenere.erreur);
  assert.deepEqual(regenere.preparation.personnages.rechiffres, [ID_A, ID_B]);
  assert.deepEqual(lireIndex(indexAbime.depot.fichiers()[CHEMIN_INDEX]).index.personnages.map((e) => e.identifiant), [ID_A, ID_B]);
  // La banque reçue entière mais abîmée : un message, rien d'écrit.
  const banqueAbimee = surFichier(CHEMIN_BANQUE, nonUtf8);
  const refus = await banqueAbimee.circuit();
  assert.equal(refus.code, "format");
  assert.match(refus.erreur, /Le fichier publié sur GitHub n'est pas du JSON lisible/);
  assert.deepEqual(ecrituresDe(banqueAbimee.depot), []);
});

test("changement — la requête d'avance restée sans réponse : la branche relue dit si le commit est passé", async () => {
  const { ancien, nouveau } = await secrets();
  const fichiers = fichiersDuDepot(await banqueChiffree(ancien), [await fichierRange(ID_A, ancien)]);
  const preparer = (lu) => preparerChangement({ publiee: lu, ancien, nouveau });
  // La connexion tombe pendant l'avance, que GitHub a faite (passee) ou non ;
  // la relecture de la branche répond (relue), ou tombe aussi.
  const coupure = async ({ passee, relue }) => {
    const depot = simulerDepot({ fichiers });
    const depart = depot.ref;
    let coupee = false;
    const fetch = async (adresse, init = {}) => {
      if (init.method === "PATCH") {
        coupee = true;
        if (passee) await depot.fetch(adresse, init);
        throw new TypeError("Failed to fetch");
      }
      if (coupee && !relue) throw new TypeError("Failed to fetch");
      return depot.fetch(adresse, init);
    };
    const resultat = await publierParCommit({ jeton: JETON, fetch, preparer, confirmer: async () => true });
    return { depot, depart, resultat };
  };

  // L'avance a eu lieu : c'est un succès, et rien ne recommence.
  const faite = await coupure({ passee: true, relue: true });
  assert.equal(faite.resultat.erreur, undefined, faite.resultat.erreur);
  assert.equal(faite.resultat.commit, faite.depot.ref);
  assert.deepEqual(faite.resultat.preparation.personnages.rechiffres, [ID_A]);
  const relecture = faite.depot.requetes.at(-1);
  assert.equal(relecture.adresse, `${ADRESSE_DEPOT}/git/ref/heads/main`);
  assert.equal(relecture.cache, "no-store", "la branche se relit sans cache");
  assert.equal(faite.depot.commits.size, 2, "un seul commit de plus");

  // Elle n'a pas eu lieu : la panne, et main n'a pas bougé.
  const ratee = await coupure({ passee: false, relue: true });
  assert.equal(ratee.resultat.code, "reseau");
  assert.equal(ratee.depot.ref, ratee.depart);

  // La relecture tombe aussi : l'issue est inconnue, et le message le dit.
  for (const passee of [true, false]) {
    const inconnue = await coupure({ passee, relue: false });
    assert.equal(inconnue.resultat.code, "incertain", `avance ${passee ? "faite" : "pas faite"}`);
    assert.match(inconnue.resultat.erreur, /a peut-être été écrit/);
  }
});

test("reprise — l'ancien mot de passe rechiffre les personnages laissés, en un seul commit sans la banque (§ 8.4)", async () => {
  const { nouveau: actuel, autre } = await secrets();
  const VIEUX = "Vieux Chaudron Cabossé";
  // Le même ancien mot de passe, sous deux sels : dérivé en minuscules, et
  // sous sa forme exacte (celle d'une banque d'avant le lot 2 bis).
  const enMinuscules = await deriverCle(VIEUX, tirerSel(), ITERATIONS);
  const exact = await deriverCle(VIEUX, tirerSel(), ITERATIONS, { minuscules: false });
  const enveloppe = await banqueChiffree(actuel);
  const [a, b, c, d, e] = [
    await fichierRange(ID_A, actuel),
    await fichierRange(ID_B, enMinuscules),
    await fichierRange(ID_C, exact),
    await fichierRange(ID_D, autre),
    await fichierRange(ID_E, enMinuscules),
  ];
  let automate = null;
  const depot = simulerDepot({
    fichiers: fichiersDuDepot(enveloppe, [a, b, c, d]),
    avantReponse: (requete, dd) => {
      if (requete.methode === "PATCH" && automate) {
        automate(dd);
        automate = null;
      }
    },
  });
  const avant = depot.fichiers();

  // L'inventaire, sans rien écrire ni déchiffrer.
  const lu = await lireDepot({ jeton: JETON, fetch: depot.fetch });
  assert.deepEqual(inventaire(lu.personnages, actuel.sel), { total: 4, aJour: 1, autreCle: [ID_B, ID_C, ID_D], illisibles: [] });
  assert.deepEqual(ecrituresDe(depot), []);

  const reprise = (motDePasse, cles, secret = actuel, fetch = depot.fetch) =>
    publierParCommit({ jeton: JETON, fetch, preparer: (l) => preparerReprise({ publiee: l, secret, motDePasse, cles, date: DATE_CHANGEMENT }), confirmer: async () => true });

  // Un faux ancien mot de passe : rien ne s'écrit.
  const faux = await reprise("pas le bon mot de passe", new Map());
  assert.equal(faux.code, "mot_de_passe");
  assert.match(faux.erreur, /n'ouvre aucun des 3 personnages/);
  assert.deepEqual(ecrituresDe(depot), []);

  // Le bon : un personnage rangé pendant la reprise est pris aussi, et chaque
  // clé ne se dérive qu'une fois par sel et par forme.
  automate = (dd) => dd.commiterAilleurs({ [cheminDuPersonnage(ID_E)]: ecrireFichier(e), [CHEMIN_INDEX]: ecrireIndex([a, b, c, d, e]) });
  const cles = new Map();
  const resultat = await reprise(VIEUX, cles);
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  assert.deepEqual(ecrituresDe(depot), [...COMMIT, ...COMMIT]);
  assert.equal(cles.size, 5, "B en minuscules ; C en minuscules puis exacte ; D sous les deux formes, en vain");
  assert.deepEqual(resultat.preparation.personnages, { total: 5, rechiffres: [ID_B, ID_C, ID_E], aJour: [ID_A], autreCle: [], echecs: [ID_D], illisibles: [] });
  assert.equal(resultat.preparation.message, "Rechiffrement des personnages en ligne — 02/10/2026 09:05 — 3 personnages rechiffrés sous le mot de passe de table actuel");
  const arbre = depot.requetes.filter((r) => r.adresse.endsWith("/git/trees")).at(-1);
  assert.deepEqual(arbre.corps.tree.map((x) => x.path).sort(), [CHEMIN_INDEX, cheminDuPersonnage(ID_B), cheminDuPersonnage(ID_C), cheminDuPersonnage(ID_E)].sort(), "sans la banque");
  const apres = depot.fichiers();
  for (const identifiant of [ID_B, ID_C, ID_E]) {
    assert.deepEqual((await dechiffrerPersonnage(relireFichier(apres, identifiant), actuel)).personnage, enregistre(identifiant), identifiant);
  }
  for (const chemin of [CHEMIN_BANQUE, cheminDuPersonnage(ID_A), cheminDuPersonnage(ID_D)]) assert.equal(apres[chemin], avant[chemin], chemin);
  assert.deepEqual(inventaire((await lireDepot({ jeton: JETON, fetch: depot.fetch })).personnages, actuel.sel).autreCle, [ID_D]);

  // Plus rien que ce mot de passe ouvre ; rien à reprendre ; une banque qui a
  // changé de mot de passe entre-temps ; aucune clé ouverte.
  assert.equal((await reprise(VIEUX, new Map())).code, "mot_de_passe");
  const seul = simulerDepot({ fichiers: fichiersDuDepot(enveloppe, [a]) });
  assert.equal((await reprise(VIEUX, new Map(), actuel, seul.fetch)).code, "rien");
  const change = await reprise(VIEUX, new Map(), autre);
  assert.equal(change.code, "sel_change");
  assert.match(change.erreur, /rechargez la page/);
  assert.equal((await reprise(VIEUX, new Map(), null)).code, "mot_de_passe_requis");
  assert.deepEqual(ecrituresDe(depot), [...COMMIT, ...COMMIT]);
});
