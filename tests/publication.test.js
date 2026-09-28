// Contrôles de la publication (SPECIFICATION.md, § 8.2 et § 11, domaine
// « Publication »). GitHub est simulé : fetch est remplacé par une fonction
// qui tient le fichier publié en mémoire et note chaque requête. Le fetch
// global lève une exception, pour qu'aucun appel réel ne passe inaperçu.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ADRESSE_BANQUE, IDENTITE, ecrirePublication, lirePublication, publier } from "../js/publication/github.js";
import { depuisBase64, versBase64 } from "../js/securite/chiffrement.js";

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

test("publication — au-delà d'un mégaoctet, le contenu se relit en brut", async () => {
  const github = simulerGithub({ fichier: { ...fichierPublie(ANCIENNE), gros: true } });
  assert.deepEqual(await lirePublication({ jeton: JETON, fetch: github.fetch }), { sha: "sha-publie", enveloppe: ANCIENNE });
  assert.deepEqual(github.requetes.map((r) => r.entetes.Accept), ["application/vnd.github+json", "application/vnd.github.raw+json"]);
});
