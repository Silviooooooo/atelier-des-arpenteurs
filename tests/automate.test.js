// Contrôles de l'automate des personnages en ligne (SPECIFICATION.md,
// § 15.8), lancés hors de GitHub, sur des données d'essai : une simulation
// de l'API GitHub, qui enregistre les appels (commentaires, fermetures,
// verrouillages), et de vrais dépôts git jetables, dans le dossier
// temporaire du système : un dépôt nu pour « origin », le clone de travail
// de l'automate, et le clone de l'auteur, qui publie entre-temps.
//
// Le personnage d'essai s'appelle Aubépine Crèmebrûlée : son nom ne doit
// paraître en clair nulle part, ni dans le dépôt, ni dans un message de
// commit, ni dans un commentaire.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHEMIN_INDEX, TITRE_TICKET, cheminDuPersonnage, chiffrerPersonnage, dechiffrerPersonnage, ecrireTicket, lireFichier, lireIndex, versionDe } from "../js/personnage/en_ligne.js";
import { ETAPES } from "../js/personnage/format.js";
import { chiffrer, nouveauSecret, versBase64 } from "../js/securite/chiffrement.js";
import { ESSAIS_MAX, RAISONS, ROBOT, VARIABLE_DU_JETON, apiGitHub, cheminPermis, gitDans, lireEnvironnement, messageDuCommit, ranger } from "../outils/automate_personnages.js";
import { DATE_ESSAI, personnageEssai } from "./outils/personnage_essai.js";

// Sans les variables GIT_… d'un crochet : depuis le crochet pre-push, un git
// lancé dans un dépôt d'essai écrirait sinon dans le vrai (depot.test.js).
const RACINE = fileURLToPath(new URL("..", import.meta.url));
const ENVIRONNEMENT = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith("GIT_")));
const DEPOT = "Proprietaire/atelier";
const PROPRIETAIRE = { login: "Proprietaire", id: 1001 };
const JETON = "jeton-d-essai";
const ID = "Qx7-aZ_09bcdEFGHijklmn";
const DATE = "2026-09-30T10:21:36.536Z";
const MAINTENANT = new Date("2026-09-30T12:00:00.250Z");
const RANGE_LE = "2026-09-30T12:00:00Z";
const NOM_EN_CLAIR = /Aubépine|Crèmebrûlée|Aubepine|Cremebrulee/i;

function gitEssai(dossier, ...parametres) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...parametres], { cwd: dossier, encoding: "utf8", env: ENVIRONNEMENT, stdio: "pipe" });
}

const secretDeTable = (() => {
  let secret = null;
  return async () => (secret ??= await nouveauSecret("louche marmite passoire"));
})();

// Un personnage enregistré de la banque réelle, comme il part en ligne.
function enregistre(identifiant = ID, modifier = null) {
  return personnageEssai((p) => {
    Object.assign(p, { id: identifiant, mode: "reel", etat: "enregistre", etape: ETAPES, enregistre_le: DATE_ESSAI.toISOString() });
    if (modifier) modifier(p);
  });
}

async function chiffre(identifiant = ID, modifier = null) {
  const resultat = await chiffrerPersonnage(enregistre(identifiant, modifier), await secretDeTable());
  assert.equal(resultat.erreur, undefined, resultat.erreur);
  return resultat;
}

// Un ticket, tel que l'API GitHub le rend.
function ticket(numero, { action = "creer", identifiant = ID, personnage = null, titre = TITRE_TICKET, corps, auteur = PROPRIETAIRE, fusion = false } = {}) {
  const texte = corps !== undefined ? corps : ecrireTicket({ action, identifiant, date: DATE, personnage }).corps;
  assert.ok(corps !== undefined || texte, "ticket d'essai illisible");
  return { number: numero, title: titre, body: texte, user: { login: auteur.login, id: auteur.id, type: "User" }, state: "open", ...(fusion ? { pull_request: { url: "x" } } : {}) };
}

// ─── La simulation de GitHub ────────────────────────────────────────────────

function simulerGitHub(tickets, { pages = 201 } = {}) {
  const etat = new Map(tickets.map((t) => [t.number, { ...t, commentaires: [], locked: false }]));
  const appels = [];
  const base = `/repos/${DEPOT}`;
  const repondre = (status, donnees) => new Response(donnees === undefined ? null : JSON.stringify(donnees), { status, headers: { "Content-Type": "application/json" } });
  async function fetch(adresse, init = {}) {
    const url = new URL(adresse);
    const methode = init.method ?? "GET";
    const corps = init.body === undefined ? null : JSON.parse(init.body);
    appels.push({ methode, chemin: url.pathname, corps });
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(init.headers.Authorization, `Bearer ${JETON}`);
    assert.equal(init.headers["X-GitHub-Api-Version"], "2022-11-28");
    assert.equal(init.headers.Accept, "application/vnd.github+json");
    if (methode === "GET" && url.pathname === `${base}/issues`) {
      assert.equal(url.searchParams.get("state"), "open");
      assert.equal(url.searchParams.get("sort"), "created");
      assert.equal(url.searchParams.get("direction"), "asc");
      const parPage = Number(url.searchParams.get("per_page"));
      const page = Number(url.searchParams.get("page"));
      const createur = url.searchParams.get("creator");
      const ouverts = [...etat.values()].filter((t) => t.state === "open" && (createur === null || t.user?.login === createur)).sort((a, b) => a.number - b.number);
      return repondre(200, ouverts.slice((page - 1) * parPage, page * parPage).map(({ commentaires, locked, ...t }) => t));
    }
    if (methode === "POST" && url.pathname === `${base}/pages/builds`) return repondre(pages, { status: "queued" });
    const trouve = url.pathname.match(/^\/repos\/Proprietaire\/atelier\/issues\/(\d+)(\/comments|\/lock)?$/);
    const cible = trouve && etat.get(Number(trouve[1]));
    if (cible && methode === "POST" && trouve[2] === "/comments") {
      cible.commentaires.push(corps.body);
      return repondre(201, { id: 1 });
    }
    if (cible && methode === "PATCH" && !trouve[2]) {
      Object.assign(cible, { state: corps.state, state_reason: corps.state_reason });
      return repondre(200, {});
    }
    if (cible && methode === "PUT" && trouve[2] === "/lock") {
      Object.assign(cible, { locked: true, lock_reason: corps.lock_reason });
      return repondre(204);
    }
    return repondre(404, { message: "Not Found" });
  }
  return { fetch, appels, etat };
}

// ─── Les dépôts jetables ────────────────────────────────────────────────────

function configurer(depot) {
  for (const [cle, valeur] of [["core.autocrlf", "false"], ["commit.gpgsign", "false"], ["user.name", "Auteur d'essai"], ["user.email", "essai@users.noreply.github.com"]]) gitEssai(depot, "config", cle, valeur);
}

async function banque(sel) {
  const secret = await secretDeTable();
  return `${JSON.stringify(await chiffrer({ publiee_le: "2026-09-30T09:00:00Z", blocs: [] }, { ...secret, sel: sel ?? secret.sel }), null, 2)}\n`;
}

// Le modèle des dépôts, fabriqué une fois : un « origin » avec une banque
// chiffrée et le vrai .gitignore du dépôt (les fichiers de personnages/ y
// sont admis par des exceptions), le clone de l'auteur qui l'a publiée, et
// le clone de travail de l'automate, dont « origin » est un chemin relatif.
// Chaque contrôle en copie un : un appel à git coûte cher sous Windows.
let dossierDuModele = null;
after(() => dossierDuModele && rmSync(dossierDuModele, { recursive: true, force: true }));
const modele = (() => {
  let promesse = null;
  return () => (promesse ??= fabriquerModele());
})();

async function fabriquerModele() {
  const dossier = (dossierDuModele = mkdtempSync(join(tmpdir(), "atelier-automate-modele-")));
  const origine = join(dossier, "origine.git");
  const auteur = join(dossier, "auteur");
  gitEssai(dossier, "init", "--quiet", "--bare", "--initial-branch=main", origine);
  gitEssai(dossier, "init", "--quiet", "--initial-branch=main", auteur);
  configurer(auteur);
  const fichiers = { "index.html": "<!doctype html>\n", ".gitignore": readFileSync(join(RACINE, ".gitignore"), "utf8"), "donnees/banque.chiffree.json": await banque() };
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(join(auteur, dirname(chemin)), { recursive: true });
    writeFileSync(join(auteur, chemin), contenu);
  }
  gitEssai(auteur, "add", "--all");
  gitEssai(auteur, "commit", "--quiet", "-m", "Première publication");
  gitEssai(auteur, "push", "--quiet", origine, "main");
  gitEssai(dossier, "clone", "--quiet", "-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", origine, join(dossier, "travail"));
  gitEssai(join(dossier, "travail"), "remote", "set-url", "origin", "../origine.git");
  return dossier;
}

// Une copie du modèle, avec d'autres fichiers publiés s'il le faut.
async function preparer(t, fichiers = {}) {
  const dossier = mkdtempSync(join(tmpdir(), "atelier-automate-"));
  t.after(() => rmSync(dossier, { recursive: true, force: true }));
  cpSync(await modele(), dossier, { recursive: true });
  const origine = join(dossier, "origine.git");
  const auteur = join(dossier, "auteur");
  const travail = join(dossier, "travail");
  // L'auteur publie : un commit poussé sur « origin ». L'ajout est forcé :
  // un intrus dans personnages/, que le .gitignore cache, peut arriver sur la
  // branche par le site de GitHub.
  const publier = (chemins, message) => {
    gitEssai(auteur, "pull", "--quiet", "--ff-only", origine, "main");
    for (const [chemin, contenu] of Object.entries(chemins)) {
      mkdirSync(join(auteur, dirname(chemin)), { recursive: true });
      writeFileSync(join(auteur, chemin), contenu);
    }
    gitEssai(auteur, "add", "--all", "--force", "--", ...Object.keys(chemins));
    gitEssai(auteur, "commit", "--quiet", "-m", message);
    gitEssai(auteur, "push", "--quiet", origine, "main");
    return gitEssai(auteur, "rev-parse", "HEAD").trim();
  };
  if (Object.keys(fichiers).length) publier(fichiers, "Des fichiers d'essai");
  return {
    dossier, origine, travail, publier,
    git: gitDans(travail, { environnement: ENVIRONNEMENT }),
    sommet: () => gitEssai(origine, "rev-parse", "main").trim(),
    arbre: () => gitEssai(origine, "ls-tree", "-r", "--name-only", "main").split("\n").filter(Boolean),
    montrer: (chemin) => gitEssai(origine, "show", `main:${chemin}`),
    commit: (ref = "main") => {
      const [an, ae, cn, ce, sujet] = gitEssai(origine, "log", "-1", "--format=%an%x09%ae%x09%cn%x09%ce%x09%s", ref).trim().split("\t");
      return { an, ae, cn, ce, sujet, chemins: gitEssai(origine, "diff-tree", "--no-commit-id", "--name-only", "-r", ref).split("\n").filter(Boolean) };
    },
  };
}

function lancer(depots, simulation, options = {}) {
  return ranger({
    api: apiGitHub({ depot: DEPOT, jeton: JETON, fetch: simulation.fetch, parPage: 2 }),
    git: depots.git,
    racine: depots.travail,
    proprietaire: PROPRIETAIRE,
    maintenant: () => MAINTENANT,
    ...options,
  });
}

// Aucun nom en clair : ni dans les fichiers d'« origin », ni dans les
// messages de commit, ni dans les commentaires.
function sansNomEnClair(depots, simulation) {
  for (const chemin of depots.arbre()) assert.doesNotMatch(depots.montrer(chemin), NOM_EN_CLAIR, chemin);
  assert.doesNotMatch(gitEssai(depots.origine, "log", "--format=%B", "main"), NOM_EN_CLAIR);
  for (const t of simulation.etat.values()) for (const c of t.commentaires) assert.doesNotMatch(c, NOM_EN_CLAIR);
}

const appelsSur = (simulation, numero) => simulation.appels.filter((a) => a.chemin.startsWith(`/repos/${DEPOT}/issues/${numero}`));
const demandesDePages = (simulation) => simulation.appels.filter((a) => a.chemin.endsWith("/pages/builds")).length;

function fermeEtVerrouille(simulation, numero, { raison, verrou, commentaires = 0 }) {
  const t = simulation.etat.get(numero);
  assert.equal(t.state, "closed", `ticket ${numero}`);
  assert.equal(t.state_reason, raison, `ticket ${numero}`);
  assert.equal(t.locked, true, `ticket ${numero}`);
  assert.equal(t.lock_reason, verrou, `ticket ${numero}`);
  assert.equal(t.commentaires.length, commentaires, `ticket ${numero}`);
  return t;
}

// ─── Les contrôles ──────────────────────────────────────────────────────────

test("automate — un ticket « creer » conforme est rangé : le fichier, l'index, un commit du robot dans personnages/ seulement, le ticket fermé et verrouillé", async (t) => {
  const depots = await preparer(t);
  const secret = await secretDeTable();
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() })]);
  const bilan = await lancer(depots, simulation);
  assert.deepEqual(bilan.ranges, [12]);
  assert.deepEqual(bilan.refuses, []);
  assert.deepEqual(bilan.inconnus, []);
  assert.equal(bilan.commit, depots.sommet());
  assert.equal(bilan.pages, "demandee");
  // Le commit : le robot, un message sans nom, les deux seuls chemins.
  const commit = depots.commit();
  assert.deepEqual([commit.an, commit.ae, commit.cn, commit.ce], [ROBOT.nom, ROBOT.adresse, ROBOT.nom, ROBOT.adresse]);
  assert.equal(commit.sujet, "Personnages : ticket n° 12");
  assert.deepEqual(commit.chemins.sort(), [CHEMIN_INDEX, cheminDuPersonnage(ID)].sort());
  // Le fichier rangé se lit, puis se déchiffre avec la clé de table.
  const { fichier, erreur } = lireFichier(depots.montrer(cheminDuPersonnage(ID)), { identifiant: ID });
  assert.equal(erreur, undefined, erreur);
  assert.deepEqual([fichier.ticket, fichier.depose_le, fichier.range_le, fichier.sel], [12, DATE, RANGE_LE, secret.sel]);
  assert.deepEqual((await dechiffrerPersonnage(fichier, secret)).personnage, enregistre());
  // L'index : identifiant, date, version ; rien d'autre.
  assert.deepEqual(lireIndex(depots.montrer(CHEMIN_INDEX)).index.personnages, [{ identifiant: ID, range_le: RANGE_LE, version: versionDe(fichier) }]);
  // Le ticket : fermé comme fait, verrouillé, sans commentaire ; Pages demandée une fois.
  fermeEtVerrouille(simulation, 12, { raison: "completed", verrou: "resolved" });
  assert.equal(demandesDePages(simulation), 1);
  sansNomEnClair(depots, simulation);
});

test("automate — « remplacer » réécrit le fichier et change la version ; des tickets repassés ne changent rien ; « supprimer » l'efface, l'index reste, vide ; supprimer un absent ne gêne pas ; un passage sans ticket ne commite rien", async (t) => {
  const depots = await preparer(t);
  const creation = ticket(12, { personnage: await chiffre() });
  await lancer(depots, simulerGitHub([creation]));
  const avant = lireFichier(depots.montrer(cheminDuPersonnage(ID)), { identifiant: ID }).fichier;

  const envoi = ticket(13, { action: "remplacer", personnage: await chiffre(ID, (p) => (p.identite.age = "32 ans")) });
  const remplacement = simulerGitHub([envoi]);
  assert.deepEqual((await lancer(depots, remplacement)).ranges, [13]);
  const apres = lireFichier(depots.montrer(cheminDuPersonnage(ID)), { identifiant: ID }).fichier;
  assert.equal(apres.ticket, 13);
  assert.notEqual(apres.iv, avant.iv);
  const [entree] = lireIndex(depots.montrer(CHEMIN_INDEX)).index.personnages;
  assert.equal(entree.version, versionDe(apres));
  assert.notEqual(entree.version, versionDe(avant));
  assert.equal((await dechiffrerPersonnage(apres, await secretDeTable())).personnage.identite.age, "32 ans");
  fermeEtVerrouille(remplacement, 13, { raison: "completed", verrou: "resolved" });

  // Idempotent : les passages précédents ont envoyé, puis n'ont pas fermé ;
  // les deux tickets reviennent, plus tard : la création (v1), puis le
  // remplacement (v2), déjà sur la branche. Le passage aboutit à ce qu'elle
  // porte : rien ne change, pas même la date, rien ne part ; ils se ferment.
  const sommet = depots.sommet();
  const repasse = simulerGitHub([creation, envoi]);
  const bilanRepasse = await lancer(depots, repasse, { maintenant: () => new Date("2026-10-01T08:00:00Z") });
  assert.deepEqual([bilanRepasse.ranges, bilanRepasse.commit, bilanRepasse.pages], [[12, 13], null, null]);
  assert.equal(depots.sommet(), sommet);
  const inchange = lireFichier(depots.montrer(cheminDuPersonnage(ID)), { identifiant: ID }).fichier;
  assert.deepEqual([inchange.range_le, inchange.ticket], [RANGE_LE, 13]);
  assert.equal(demandesDePages(repasse), 0);
  fermeEtVerrouille(repasse, 12, { raison: "completed", verrou: "resolved" });
  fermeEtVerrouille(repasse, 13, { raison: "completed", verrou: "resolved" });

  const suppression = simulerGitHub([ticket(14, { action: "supprimer" }), ticket(15, { action: "supprimer", identifiant: "AbsentAbsentAbsent0001" })]);
  const bilan = await lancer(depots, suppression);
  assert.deepEqual(bilan.ranges, [14, 15]);
  assert.equal(depots.commit().sujet, "Personnages : tickets n° 14, 15");
  assert.deepEqual(depots.arbre().filter((c) => c.startsWith("personnages/")), [CHEMIN_INDEX]);
  assert.deepEqual(lireIndex(depots.montrer(CHEMIN_INDEX)).index.personnages, []);
  fermeEtVerrouille(suppression, 14, { raison: "completed", verrou: "resolved" });
  fermeEtVerrouille(suppression, 15, { raison: "completed", verrou: "resolved" });

  const vide = await lancer(depots, simulerGitHub([]));
  assert.equal(vide.commit, null);
  assert.equal(depots.sommet(), bilan.commit);
});

test("automate — un ticket non conforme du propriétaire, même piégé (shell, chemins), est fermé et verrouillé avec sa raison ; rien n'est écrit ni exécuté", async (t) => {
  const depots = await preparer(t);
  const bon = await chiffre();
  const valide = JSON.parse(ecrireTicket({ action: "creer", identifiant: ID, date: DATE, personnage: bon }).corps);
  const piege = "$(touch pirate) `touch pirate` ; touch pirate | touch pirate && touch pirate";
  const cas = [
    [20, { corps: "{ pas du JSON" }, /n'est pas du JSON/],
    [21, { titre: "Personnage", personnage: bon }, new RegExp(RAISONS.titre.slice(0, 20))],
    [22, { titre: `personnage ${piege}`, personnage: bon }, new RegExp(RAISONS.titre.slice(0, 20))],
    [23, { corps: JSON.stringify({ ...valide, identifiant: "../../.github/workflows/x" }) }, /identifiant du ticket est illisible/],
    [24, { corps: JSON.stringify({ ...valide, identifiant: piege }) }, /identifiant du ticket est illisible/],
    [25, { corps: JSON.stringify({ ...valide, personnage: { ...bon, contenu: "A".repeat(70_000) } }) }, /dépasse 64 Ko/],
    [26, { corps: JSON.stringify({ ...valide, personnage: { ...bon, contenu: `${bon.contenu.slice(0, -4)}!!!!` } }) }, /contenu chiffré est illisible/],
    [27, { personnage: { ...bon, sel: versBase64(new Uint8Array(16).fill(3)) } }, /autre clé de table/],
    [28, { corps: null }, /illisible/],
    [29, { corps: JSON.stringify({ ...valide, MARQUEUR: `${piege} ../../../etc/passwd` }) }, /champ inconnu/],
    [30, { corps: `../../../../etc/passwd\n${piege}` }, /n'est pas du JSON/],
    // Ce que les contrôles du dépôt refuseraient ensuite : un identifiant en
    // forme de jeton (fabriqué ici, comme dans depot.test.js), un contenu en clair.
    [31, { corps: JSON.stringify({ ...valide, identifiant: "ghp_" + "A1b2".repeat(9) }) }, /forme d'un jeton GitHub/],
    [32, { personnage: { ...bon, contenu: Buffer.from(JSON.stringify({ nom: "Aubépine Crèmebrûlée", age: "31 ans" })).toString("base64") } }, /se lit comme du texte/],
  ];
  const simulation = simulerGitHub(cas.map(([numero, options]) => ticket(numero, options)));
  const avant = depots.sommet();
  const bilan = await lancer(depots, simulation);
  assert.deepEqual(bilan.ranges, []);
  assert.deepEqual(bilan.refuses.map((r) => r.numero), cas.map(([numero]) => numero));
  assert.equal(bilan.commit, null);
  assert.equal(bilan.pages, null);
  assert.equal(depots.sommet(), avant, "rien n'est envoyé");
  assert.equal(demandesDePages(simulation), 0);
  assert.equal(existsSync(join(depots.travail, "personnages")), false, "rien n'est écrit");
  assert.equal(gitEssai(depots.travail, "status", "--porcelain", "--ignored"), "");
  for (const [numero, , raison] of cas) {
    const [commentaire] = fermeEtVerrouille(simulation, numero, { raison: "not_planned", verrou: "resolved", commentaires: 1 }).commentaires;
    assert.match(commentaire, /^Ce ticket n'a pas été rangé\. /, `ticket ${numero}`);
    assert.match(commentaire, raison, `ticket ${numero}`);
    // Rien du ticket n'est recopié dans le commentaire.
    assert.doesNotMatch(commentaire, /pirate|MARQUEUR|etc\/passwd|\.github|\$\(|`|@/, `ticket ${numero}`);
  }
  // Aucune commande n'a été lancée : pas de fichier « pirate », nulle part.
  const partout = (dossier) => readdirSync(dossier, { withFileTypes: true, recursive: true }).map((e) => e.name);
  assert.equal(partout(depots.dossier).includes("pirate"), false);
  assert.equal(existsSync(join(process.cwd(), "pirate")), false);
});

test("automate — un identifiant qui ne diffère que par la casse, d'un fichier présent ou d'un autre ticket du passage, est refusé", async (t) => {
  const depots = await preparer(t);
  await lancer(depots, simulerGitHub([ticket(12, { personnage: await chiffre() })]));
  const present = depots.montrer(cheminDuPersonnage(ID));
  const autre = "Zz9-AAAAbbbbCCCCddddEE";
  const simulation = simulerGitHub([
    ticket(30, { identifiant: ID.toLowerCase(), personnage: await chiffre(ID.toLowerCase()) }),
    ticket(31, { identifiant: autre, personnage: await chiffre(autre) }),
    ticket(32, { identifiant: autre.toLowerCase(), personnage: await chiffre(autre.toLowerCase()) }),
    ticket(33, { action: "supprimer", identifiant: ID.toUpperCase() }),
  ]);
  const bilan = await lancer(depots, simulation);
  assert.deepEqual(bilan.ranges, [31]);
  assert.deepEqual(bilan.refuses, [30, 32, 33].map((numero) => ({ numero, raison: RAISONS.casse })));
  assert.deepEqual(depots.arbre().filter((c) => c.startsWith("personnages/")).sort(), [cheminDuPersonnage(autre), cheminDuPersonnage(ID), CHEMIN_INDEX].sort());
  assert.equal(depots.montrer(cheminDuPersonnage(ID)), present, "le fichier présent n'a pas bougé");
  for (const numero of [30, 32, 33]) assert.match(fermeEtVerrouille(simulation, numero, { raison: "not_planned", verrou: "resolved", commentaires: 1 }).commentaires[0], /majuscules/);
});

test("automate — le ticket d'un inconnu est fermé et verrouillé, sans commentaire ni fichier ; une demande de fusion est ignorée", async (t) => {
  const depots = await preparer(t);
  const bon = await chiffre();
  const simulation = simulerGitHub([
    ticket(40, { personnage: bon, auteur: { login: "Curieux", id: 2002 } }),
    // Le même login, un autre compte (un nom repris après un renommage).
    ticket(41, { personnage: bon, auteur: { login: "Proprietaire", id: 9999 } }),
    ticket(42, { personnage: bon, fusion: true }),
    { number: 43, title: TITRE_TICKET, body: null, user: null, state: "open" },
  ]);
  const avant = depots.sommet();
  const bilan = await lancer(depots, simulation);
  assert.deepEqual(bilan.inconnus, [40, 41, 43]);
  assert.deepEqual(bilan.ranges, []);
  assert.deepEqual(bilan.refuses, []);
  assert.equal(bilan.commit, null);
  assert.equal(depots.sommet(), avant);
  // Un dépôt sans personnage ni ticket rangé ne reçoit pas d'index.
  assert.equal(depots.arbre().some((c) => c.startsWith("personnages/")), false);
  for (const numero of [40, 41, 43]) fermeEtVerrouille(simulation, numero, { raison: "not_planned", verrou: "off-topic" });
  assert.deepEqual(appelsSur(simulation, 42), []);
  assert.equal(simulation.etat.get(42).state, "open");
});

test("automate — une avalanche de tickets d'inconnus ne repousse pas ceux du propriétaire ; au-delà de la limite, les plus anciens se ferment, les autres au passage suivant", async (t) => {
  const depots = await preparer(t);
  const curieux = { login: "Curieux", id: 2002 };
  const simulation = simulerGitHub([...[1, 2, 3, 4, 5, 6].map((numero) => ticket(numero, { corps: "x", auteur: curieux })), ticket(7, { personnage: await chiffre() })]);
  // Deux pages de deux tickets par liste : la limite, en petit.
  const api = apiGitHub({ depot: DEPOT, jeton: JETON, fetch: simulation.fetch, parPage: 2, pagesMax: 2 });
  const bilan = await lancer(depots, simulation, { api });
  assert.deepEqual([bilan.ranges, bilan.inconnus], [[7], [1, 2, 3, 4]]);
  fermeEtVerrouille(simulation, 7, { raison: "completed", verrou: "resolved" });
  for (const numero of [1, 2, 3, 4]) fermeEtVerrouille(simulation, numero, { raison: "not_planned", verrou: "off-topic" });
  assert.deepEqual([5, 6].map((numero) => simulation.etat.get(numero).state), ["open", "open"]);
  const suite = await lancer(depots, simulation, { api });
  assert.deepEqual([suite.ranges, suite.inconnus, suite.commit], [[], [5, 6], null]);
  for (const numero of [5, 6]) fermeEtVerrouille(simulation, numero, { raison: "not_planned", verrou: "off-topic" });
});

test("automate — un envoi refusé (l'auteur a publié entre-temps) : l'automate repart de la branche et réussit au second essai", async (t) => {
  const depots = await preparer(t);
  let envois = 0;
  let publie = null;
  const git = (parametres, options) => {
    if (parametres[0] === "push" && ++envois === 1) publie = depots.publier({ "js/nouveau.js": "// publié entre-temps\n" }, "Publication de l'auteur");
    return depots.git(parametres, options);
  };
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() })]);
  const bilan = await lancer(depots, simulation, { git });
  assert.equal(envois, 2);
  assert.deepEqual(bilan.ranges, [12]);
  assert.equal(bilan.commit, depots.sommet());
  assert.equal(gitEssai(depots.origine, "rev-parse", "main~1").trim(), publie, "le commit du robot suit celui de l'auteur");
  assert.ok(depots.arbre().includes("js/nouveau.js"));
  assert.deepEqual(depots.commit().chemins.sort(), [CHEMIN_INDEX, cheminDuPersonnage(ID)].sort());
  assert.equal(appelsSur(simulation, 12).filter((a) => a.methode === "PATCH").length, 1);
  fermeEtVerrouille(simulation, 12, { raison: "completed", verrou: "resolved" });
});

test("automate — au nouvel essai, les tickets sont rejugés : une banque republiée entre-temps sous un autre sel rend le personnage périmé", async (t) => {
  const depots = await preparer(t);
  // La nouvelle banque se fabrique d'avance : git est synchrone.
  const nouvelle = await banque(versBase64(new Uint8Array(16).fill(5)));
  let envois = 0;
  const git = (parametres, options) => {
    if (parametres[0] === "push" && ++envois === 1) depots.publier({ "donnees/banque.chiffree.json": nouvelle }, "Changement du mot de passe");
    return depots.git(parametres, options);
  };
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() })]);
  const bilan = await lancer(depots, simulation, { git });
  assert.equal(envois, 1, "rien à envoyer au second essai");
  assert.deepEqual(bilan.ranges, []);
  assert.deepEqual(bilan.refuses, [{ numero: 12, raison: RAISONS.sel }]);
  assert.equal(bilan.commit, null);
  assert.equal(depots.arbre().some((c) => c.startsWith("personnages/")), false);
  assert.match(fermeEtVerrouille(simulation, 12, { raison: "not_planned", verrou: "resolved", commentaires: 1 }).commentaires[0], /autre clé de table/);
});

test("automate — cinq envois refusés : le passage s'arrête, aucun ticket du propriétaire n'est fermé ; ceux des inconnus le sont", async (t) => {
  const depots = await preparer(t);
  let envois = 0;
  const git = (parametres, options) => {
    if (parametres[0] === "push") {
      envois++;
      throw Object.assign(new Error("refus simulé"), { stderr: "! [rejected] HEAD -> main (fetch first)" });
    }
    return depots.git(parametres, options);
  };
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() }), ticket(13, { auteur: { login: "Curieux", id: 2 }, corps: "x" })]);
  const avant = depots.sommet();
  await assert.rejects(lancer(depots, simulation, { git }), /refusé 5 fois de suite/);
  assert.equal(envois, ESSAIS_MAX);
  assert.equal(depots.sommet(), avant);
  assert.deepEqual(appelsSur(simulation, 12), []);
  assert.equal(demandesDePages(simulation), 0);
  // Le ticket d'un inconnu ne dépend pas du dépôt : il se ferme quand même.
  fermeEtVerrouille(simulation, 13, { raison: "not_planned", verrou: "off-topic" });
});

test("automate — un fichier présent illisible, un intrus dans personnages/, ou un .gitignore qui cache les fichiers rangés, arrête le passage sans rien commiter ni fermer", async (t) => {
  for (const [fichiers, attendu] of [
    [{ [cheminDuPersonnage(ID)]: "{ abîmé\n" }, /personnages\/Qx7-aZ_09bcdEFGHijklmn\.chiffre\.json est illisible/],
    [{ "personnages/notes.txt": "une note\n" }, /personnages\/notes\.txt n'a pas sa place/],
    // git add sauterait sans rien dire les fichiers cachés : rien ne
    // partirait, et le ticket se fermerait « fait ».
    [{ ".gitignore": "*.json\n" }, /ne peuvent être indexés/],
  ]) {
    const depots = await preparer(t, fichiers);
    const simulation = simulerGitHub([ticket(12, { personnage: await chiffre("AutreIdentifiant000001") })]);
    const avant = depots.sommet();
    await assert.rejects(lancer(depots, simulation), attendu);
    assert.equal(depots.sommet(), avant);
    assert.deepEqual(simulation.appels.filter((a) => a.methode !== "GET"), []);
  }
});

test("automate — seuls des chemins de personnages/ partent : un autre chemin indexé arrête le passage avant l'envoi", async (t) => {
  const depots = await preparer(t);
  let envois = 0;
  const git = (parametres, options) => {
    if (parametres[0] === "push") envois++;
    const sortie = depots.git(parametres, options);
    // Un défaut simulé : un fichier hors de personnages/ se glisse dans l'index.
    if (parametres[0] === "add") {
      mkdirSync(join(depots.travail, "js"), { recursive: true });
      writeFileSync(join(depots.travail, "js/intrus.js"), "// intrus\n");
      depots.git(["add", "js/intrus.js"]);
    }
    return sortie;
  };
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() })]);
  const avant = depots.sommet();
  await assert.rejects(lancer(depots, simulation, { git }), /hors de personnages\/ seraient commités/);
  assert.equal(envois, 0);
  assert.equal(depots.sommet(), avant);
  assert.deepEqual(simulation.appels.filter((a) => a.methode !== "GET"), []);
  // Les seules formes permises.
  assert.deepEqual(
    [cheminDuPersonnage(ID), CHEMIN_INDEX, "personnages/x.json", "personnages/sous/index.json", "js/intrus.js", `personnages/${ID}.chiffre.json/x`, "Personnages/index.json"].map(cheminPermis),
    [true, true, false, false, false, false, false],
  );
});

test("automate — le jeton ne passe qu'à l'envoi, par l'environnement, jamais sur le disque ; Pages refusée, le ticket se ferme quand même et le bilan le dit ; lancé à la main, l'automate redemande Pages", async (t) => {
  const depots = await preparer(t);
  const jeton = "jeton-d-essai-du-poste";
  // Comme sur GitHub Actions : le workflow place le jeton dans l'environnement du processus.
  const git = gitDans(depots.travail, { environnement: { ...ENVIRONNEMENT, [VARIABLE_DU_JETON]: jeton }, jeton });
  const cle = "http.https://github.com/.extraheader";
  const attendu = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${jeton}`).toString("base64")}`;
  assert.equal(git(["config", "--get", cle], { envoi: true }).trim(), attendu);
  assert.throws(() => git(["config", "--get", cle]), "hors de l'envoi, git ne le voit pas");
  // La variable du workflow n'atteint aucune commande git, pas même l'envoi :
  // un alias (ou un crochet) qui lirait l'environnement n'y trouve rien.
  const voir = ["-c", `alias.voir=!echo "[$${VARIABLE_DU_JETON}]"`, "voir"];
  assert.equal(git(voir).trim(), "[]");
  assert.equal(git(voir, { envoi: true }).trim(), "[]");
  const simulation = simulerGitHub([ticket(12, { personnage: await chiffre() })], { pages: 403 });
  const bilan = await lancer(depots, simulation, { git });
  const configuration = readFileSync(join(depots.travail, ".git", "config"), "utf8");
  assert.equal(configuration.includes(jeton), false);
  assert.equal(configuration.includes(Buffer.from(`x-access-token:${jeton}`).toString("base64")), false);
  // Pages refusée : l'envoi est fait, le ticket se ferme, le bilan le dit.
  assert.match(bilan.pages, /^refusée : .*403/);
  assert.equal(bilan.commit, depots.sommet());
  fermeEtVerrouille(simulation, 12, { raison: "completed", verrou: "resolved" });
  // Le passage suivant n'a rien à commiter : sans rien demander d'ordinaire,
  // il redemande Pages quand l'auteur le lance à la main.
  const ordinaire = simulerGitHub([]);
  assert.deepEqual([(await lancer(depots, ordinaire, { git })).pages, demandesDePages(ordinaire)], [null, 0]);
  const aLaMain = simulerGitHub([]);
  const relance = await lancer(depots, aLaMain, { git, reconstruire: true });
  assert.deepEqual([relance.commit, relance.pages, demandesDePages(aLaMain)], [null, "demandee", 1]);
});

test("automate — l'API : en-têtes, toutes les pages de tickets, ceux d'un auteur, une limite sans arrêt, un refus de GitHub arrête", async () => {
  const tickets = [1, 2, 3, 4, 5].map((numero) => ticket(numero, { corps: "x", auteur: numero === 4 ? PROPRIETAIRE : { login: "Curieux", id: 2 } }));
  const simulation = simulerGitHub(tickets);
  const api = apiGitHub({ depot: DEPOT, jeton: JETON, fetch: simulation.fetch, parPage: 2 });
  assert.deepEqual((await api.ticketsOuverts()).map((t) => t.number), [1, 2, 3, 4, 5]);
  assert.equal(simulation.appels.length, 3);
  assert.deepEqual((await api.ticketsOuverts({ createur: "Proprietaire" })).map((t) => t.number), [4]);
  const quatre = simulerGitHub(tickets.slice(0, 4));
  await apiGitHub({ depot: DEPOT, jeton: JETON, fetch: quatre.fetch, parPage: 2 }).ticketsOuverts();
  assert.equal(quatre.appels.length, 3, "une page vide clôt la liste");
  // Au-delà de la limite, les plus anciens, sans erreur : les passages suivants vident la file.
  const limite = simulerGitHub(tickets);
  assert.deepEqual((await apiGitHub({ depot: DEPOT, jeton: JETON, fetch: limite.fetch, parPage: 2, pagesMax: 2 }).ticketsOuverts()).map((t) => t.number), [1, 2, 3, 4]);
  assert.equal(limite.appels.length, 2);
  const panne = apiGitHub({ depot: DEPOT, jeton: JETON, fetch: async () => new Response("{}", { status: 500, statusText: "Internal Server Error" }) });
  await assert.rejects(panne.ticketsOuverts(), /500/);
  await assert.rejects(panne.fermer(1, "completed"), /500/);
  const illisible = apiGitHub({ depot: DEPOT, jeton: JETON, fetch: async () => new Response("{}", { status: 200 }) });
  await assert.rejects(illisible.ticketsOuverts(), /illisible/);
});

test("automate — l'environnement de GitHub Actions, et un message de commit sans nom", () => {
  const bon = { GITHUB_REPOSITORY: "Proprietaire/atelier", GITHUB_REPOSITORY_OWNER: "Proprietaire", GITHUB_REPOSITORY_OWNER_ID: "1001", GITHUB_EVENT_NAME: "issues", JETON: "x" };
  assert.deepEqual(lireEnvironnement(bon), { depot: "Proprietaire/atelier", proprietaire: { login: "Proprietaire", id: 1001 }, jeton: "x", reconstruire: false });
  assert.deepEqual(lireEnvironnement({ ...bon, GITHUB_REPOSITORY_OWNER_ID: undefined }).proprietaire, { login: "Proprietaire", id: null });
  // Lancé à la main : la construction de Pages est redemandée.
  assert.equal(lireEnvironnement({ ...bon, GITHUB_EVENT_NAME: "workflow_dispatch" }).reconstruire, true);
  for (const faute of [{ GITHUB_REPOSITORY: undefined }, { GITHUB_REPOSITORY_OWNER: "Autre" }, { GITHUB_REPOSITORY: "a/b/c" }, { GITHUB_REPOSITORY_OWNER_ID: "abc" }, { JETON: "" }]) {
    assert.equal(typeof lireEnvironnement({ ...bon, ...faute }).erreur, "string", JSON.stringify(faute));
  }
  assert.equal(messageDuCommit([12]), "Personnages : ticket n° 12");
  assert.equal(messageDuCommit([12, 14]), "Personnages : tickets n° 12, 14");
  assert.equal(messageDuCommit([]), "Personnages : index régénéré");
});
