// L'automate des personnages en ligne (SPECIFICATION.md, § 15.8).
//
// Lancé par .github/workflows/personnages.yml à l'ouverture d'un ticket, il
// range les personnages déposés : personnages/<id>.chiffre.json, et l'index
// personnages/index.json. Il balaie à chaque passage tous les tickets
// ouverts, pas seulement celui qui l'a éveillé : un passage en attente peut
// être remplacé par le suivant (groupe de concurrence), qui rattrape alors
// ses tickets.
//
// Tout ce qui vient d'un ticket est une donnée hostile. Le ticket d'un
// autre que le propriétaire du dépôt est fermé et verrouillé sans être lu.
// Celui du propriétaire (la clé de dépôt est son jeton) passe par lireTicket
// (en_ligne.js), le même vérificateur que la page. Rien du ticket n'est
// exécuté, ni passé à une commande, ni recopié dans un commentaire ou un
// message de commit : il n'en sort que le fichier validé, sous un chemin
// fait de l'identifiant vérifié. Git s'appelle sans shell, par un tableau
// d'arguments ; avant le commit, chaque chemin indexé est vérifié : seuls
// ceux de personnages/ partent.
//
// Le jeton du workflow ne sert qu'à l'API et à la seule commande git push,
// par l'environnement de celle-ci : il n'est jamais écrit sur le disque, et
// les autres commandes git ne le reçoivent pas. Un envoi fait avec lui ne
// déclenche pas la construction de GitHub Pages : l'automate la demande
// ensuite par l'API (permission pages: write), et à chaque lancement à la
// main, qui rattrape ainsi une demande refusée.
//
// L'API GitHub et git se passent en paramètre : les contrôles les
// remplacent par une simulation de GitHub et par des dépôts jetables
// (tests/automate.test.js), hors de GitHub.
//
// Usage (GitHub Actions) : node outils/automate_personnages.js, avec
// GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_OWNER_ID,
// GITHUB_EVENT_NAME et le jeton dans JETON.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CHEMIN_INDEX, DOSSIER, FICHIER, PERSONNAGES_MAX, TITRE_TICKET, cheminDuPersonnage, ecrireFichier, ecrireIndex, fichierDuTicket, lireFichier, lireTicket } from "../js/personnage/en_ligne.js";
import { CHEMIN_BANQUE } from "../js/publication/github.js";

const RACINE = fileURLToPath(new URL("../", import.meta.url));

// L'identité des commits de l'automate : celle du robot de GitHub Actions,
// en adresse privée GitHub, comme le veut le contrôle des adresses (§ 10.3).
export const ROBOT = { nom: "github-actions[bot]", adresse: "41898282+github-actions[bot]@users.noreply.github.com" };
export const BRANCHE = "main";
export const ESSAIS_MAX = 5;
// Au plus 100 pages de 100 tickets par liste : au-delà (une avalanche de
// tickets d'inconnus), le passage traite les plus anciens, et les suivants
// vident la file. Les tickets du propriétaire ont leur propre liste.
const PAGES_MAX = 100;
// La variable d'environnement qui porte le jeton (le workflow l'y place).
export const VARIABLE_DU_JETON = "JETON";

// Les raisons d'un refus : des phrases fixes. Celles de lireTicket le sont
// aussi (elles ne recopient jamais le contenu reçu), et un contrôle le
// vérifie sur un ticket piégé.
export const RAISONS = {
  titre: "Son titre n'est pas celui d'un dépôt de personnage.",
  sel: "Ce personnage est chiffré avec une autre clé de table que celle de la banque en place : le mot de passe a changé depuis. Enregistrez-le de nouveau depuis l'Atelier.",
  casse: "Son identifiant ne diffère d'un autre personnage que par les majuscules : les deux se confondraient sur un disque Windows.",
  plein: `Le dépôt compte déjà ${PERSONNAGES_MAX} personnages : supprimez-en avant d'en créer.`,
  jeton: "Son identifiant a la forme d'un jeton GitHub.",
  clair: "Le contenu du personnage se lit comme du texte : il n'est pas chiffré.",
};
const commentaireDeRefus = (raison) => `Ce ticket n'a pas été rangé. ${raison}`;

// Ce que les contrôles du dépôt refuseraient ne se range pas : le crochet
// de l'auteur refuserait ensuite chacun de ses envois (tests/depot.test.js).
// Un identifiant qui a la forme d'un jeton GitHub entier (le motif de
// l'interdit 3) ; un contenu qui se lit comme du texte : en clair,
// seulement encodé en base64. Un vrai chiffré, des octets au hasard, n'est
// pour ainsi dire jamais de l'UTF-8 valide sur quelques centaines d'octets
// (depot.test.js fait le même pari pour la banque).
const JETON = /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{36,}/;

function seLitCommeDuTexte(base64) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(base64, "base64"));
    return true;
  } catch {
    return false;
  }
}

// ─── L'API GitHub ───────────────────────────────────────────────────────────

// Les en-têtes de js/publication/github.js (§ 8.2).
function entetes(jeton) {
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${jeton}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
}

/**
 * Le client de l'API GitHub, pour le dépôt « proprietaire/nom ». Chaque
 * méthode lève une erreur (code et motif de GitHub) si l'appel est refusé :
 * le passage s'arrête, et le suivant reprend (tout y est idempotent).
 */
export function apiGitHub({ depot, jeton, fetch = globalThis.fetch, parPage = 100, pagesMax = PAGES_MAX }) {
  const base = `https://api.github.com/repos/${depot}`;
  const appeler = async (methode, chemin, corps, attendus) => {
    const reponse = await fetch(`${base}${chemin}`, { method: methode, headers: entetes(jeton), body: corps === undefined ? undefined : JSON.stringify(corps) });
    if (!attendus.includes(reponse.status)) throw new Error(`GitHub refuse ${methode} ${chemin} : ${reponse.status} ${reponse.statusText}`.trim());
    return reponse;
  };
  return {
    /**
     * Les tickets ouverts, par ordre de création, pages comprises (les
     * demandes de fusion y sont) ; ceux d'un seul auteur si createur est
     * donné. Au plus pagesMax pages : les plus anciens d'abord.
     */
    async ticketsOuverts({ createur = null } = {}) {
      const filtre = createur === null ? "" : `&creator=${encodeURIComponent(createur)}`;
      const tickets = [];
      for (let page = 1; page <= pagesMax; page++) {
        const reponse = await appeler("GET", `/issues?state=open&sort=created&direction=asc&per_page=${parPage}&page=${page}${filtre}`, undefined, [200]);
        const lot = await reponse.json();
        if (!Array.isArray(lot)) throw new Error("GitHub rend une liste de tickets illisible.");
        tickets.push(...lot);
        if (lot.length < parPage) break;
      }
      return tickets;
    },
    async commenter(numero, texte) {
      await appeler("POST", `/issues/${numero}/comments`, { body: texte }, [201]);
    },
    async fermer(numero, raison) {
      await appeler("PATCH", `/issues/${numero}`, { state: "closed", state_reason: raison }, [200]);
    },
    async verrouiller(numero, raison) {
      await appeler("PUT", `/issues/${numero}/lock`, { lock_reason: raison }, [204]);
    },
    /** Demande la construction de GitHub Pages depuis le dernier commit de la branche publiée. */
    async construirePages() {
      await appeler("POST", "/pages/builds", undefined, [201]);
    },
  };
}

// ─── Git ────────────────────────────────────────────────────────────────────

/**
 * git dans le dossier donné, sans shell : git(["status"]) rend la sortie ou
 * lève une erreur. { envoi: true } ajoute le jeton, pour git push seulement,
 * par l'environnement (GIT_CONFIG_*) : ni sur le disque ni dans les arguments.
 * La variable où le workflow a placé le jeton est ôtée de l'environnement de
 * chaque commande : les autres n'en reçoivent rien.
 */
export function gitDans(racine, { environnement = process.env, jeton = null } = {}) {
  const { [VARIABLE_DU_JETON]: _jeton, ...sansJeton } = environnement;
  return (parametres, { envoi = false, identite = false } = {}) => {
    const env = { ...sansJeton, GIT_TERMINAL_PROMPT: "0" };
    if (identite) Object.assign(env, { GIT_AUTHOR_NAME: ROBOT.nom, GIT_AUTHOR_EMAIL: ROBOT.adresse, GIT_COMMITTER_NAME: ROBOT.nom, GIT_COMMITTER_EMAIL: ROBOT.adresse });
    if (envoi && jeton) {
      const entete = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${jeton}`).toString("base64")}`;
      Object.assign(env, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: entete });
    }
    return execFileSync("git", ["-c", "core.quotePath=false", ...parametres], { cwd: racine, encoding: "utf8", env, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  };
}

/** Vrai si le chemin est l'un de ceux que l'automate peut commiter. */
export function cheminPermis(chemin) {
  return chemin === CHEMIN_INDEX || FICHIER.test(chemin);
}

// ─── Le passage ─────────────────────────────────────────────────────────────

/** Vrai si le ticket vient du propriétaire du dépôt (login, et numéro de compte s'il est connu). */
export function estDuProprietaire(ticket, proprietaire) {
  const auteur = ticket?.user;
  if (!auteur || typeof auteur.login !== "string" || auteur.login !== proprietaire.login) return false;
  return proprietaire.id == null || auteur.id === proprietaire.id;
}

// Le ticket du propriétaire, lu : { ticket } ou { raison }.
function lireEnvoi(ticket) {
  if (ticket.title !== TITRE_TICKET) return { raison: RAISONS.titre };
  const lu = lireTicket(ticket.body);
  if (lu.erreur) return { raison: lu.erreur };
  if (JETON.test(lu.ticket.identifiant)) return { raison: RAISONS.jeton };
  if (lu.ticket.personnage && seLitCommeDuTexte(lu.ticket.personnage.contenu)) return { raison: RAISONS.clair };
  return { ticket: lu.ticket };
}

// Le sel de la banque en place : celui de la clé de table.
function selDeLaBanque(racine) {
  let sel;
  try {
    sel = JSON.parse(readFileSync(join(racine, CHEMIN_BANQUE), "utf8"))?.kdf?.sel;
  } catch {
    sel = undefined;
  }
  if (typeof sel !== "string" || sel === "") throw new Error(`${CHEMIN_BANQUE} est absente ou illisible : aucun personnage ne peut être rangé.`);
  return sel;
}

// Les fichiers de personnages/, lus : Map(identifiant en minuscules → fichier).
// Tout ce qui n'a pas sa place arrête le passage : l'auteur doit le voir.
function lirePresents(racine) {
  const presents = new Map();
  const dossier = join(racine, DOSSIER);
  if (!existsSync(dossier)) return presents;
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = `${DOSSIER}/${entree.name}`;
    if (chemin === CHEMIN_INDEX && entree.isFile()) continue;
    const trouve = FICHIER.exec(chemin);
    if (!trouve || !entree.isFile()) throw new Error(`${chemin} n'a pas sa place dans ${DOSSIER}/ : retirez-le, puis relancez l'automate.`);
    const lu = lireFichier(readFileSync(join(racine, chemin), "utf8"), { identifiant: trouve[1] });
    if (lu.erreur) throw new Error(`${chemin} est illisible (${lu.erreur}) : réparez-le ou retirez-le, puis relancez l'automate.`);
    const cle = trouve[1].toLowerCase();
    if (presents.has(cle)) throw new Error(`${chemin} ne diffère d'un autre personnage que par les majuscules : retirez l'un des deux.`);
    presents.set(cle, lu.fichier);
  }
  return presents;
}

// Le même chiffré : sel, IV et contenu.
const memeChiffre = (fichier, { sel, iv, contenu }) => fichier !== undefined && fichier.sel === sel && fichier.iv === iv && fichier.contenu === contenu;

/**
 * Applique les tickets du propriétaire à l'arbre de travail. L'état final de
 * chaque personnage se calcule d'abord, ticket après ticket ; puis il se
 * compare aux fichiers lus au début du passage, sur la branche : seul ce qui
 * diffère s'écrit ou s'efface. Des tickets rejoués (v1 puis v2, déjà rangés)
 * ne réécrivent donc rien, pas même la date de rangement. L'index se
 * régénère ensuite. Rend { ranges, refuses }.
 */
function appliquer(racine, envois, rangeLe) {
  const initiaux = lirePresents(racine);
  const etat = new Map(initiaux);
  const touches = new Map();
  const ranges = [];
  const refuses = [];
  let sel = null;
  for (const { numero, ticket, raison } of envois) {
    if (raison) {
      refuses.push({ numero, raison });
      continue;
    }
    const { identifiant, action } = ticket;
    const cle = identifiant.toLowerCase();
    // Le même identifiant à la casse près, mais pas à la lettre : un fichier
    // présent, ou un ticket déjà rangé dans ce passage.
    const voisin = etat.get(cle)?.identifiant ?? touches.get(cle);
    if (voisin !== undefined && voisin !== identifiant) {
      refuses.push({ numero, raison: RAISONS.casse });
      continue;
    }
    if (action === "supprimer") {
      etat.delete(cle);
    } else {
      sel ??= selDeLaBanque(racine);
      if (ticket.personnage.sel !== sel) {
        refuses.push({ numero, raison: RAISONS.sel });
        continue;
      }
      if (!etat.has(cle) && etat.size >= PERSONNAGES_MAX) {
        refuses.push({ numero, raison: RAISONS.plein });
        continue;
      }
      // Le même chiffré qu'à présent ne change rien ; celui de la branche
      // rétablit son fichier tel quel ; un autre fait un nouveau fichier.
      if (!memeChiffre(etat.get(cle), ticket.personnage)) {
        etat.set(cle, memeChiffre(initiaux.get(cle), ticket.personnage) ? initiaux.get(cle) : fichierDuTicket(ticket, { rangeLe, numero }));
      }
    }
    touches.set(cle, identifiant);
    ranges.push(numero);
  }
  // Ce qui diffère de la branche : un fichier effacé, ou un nouveau.
  for (const [cle, fichier] of initiaux) if (!etat.has(cle)) rmSync(join(racine, cheminDuPersonnage(fichier.identifiant)));
  for (const [cle, fichier] of etat) {
    if (initiaux.get(cle) === fichier) continue;
    mkdirSync(join(racine, DOSSIER), { recursive: true });
    writeFileSync(join(racine, cheminDuPersonnage(fichier.identifiant)), ecrireFichier(fichier));
  }
  // L'index, tiré des fichiers présents. Un dossier sans personnage ni index
  // reste sans index.
  const cheminIndex = join(racine, CHEMIN_INDEX);
  if (etat.size > 0 || existsSync(cheminIndex)) {
    const texte = ecrireIndex(etat.values());
    if (!existsSync(cheminIndex) || readFileSync(cheminIndex, "utf8") !== texte) {
      mkdirSync(join(racine, DOSSIER), { recursive: true });
      writeFileSync(cheminIndex, texte);
    }
  }
  return { ranges, refuses };
}

// Repart de la branche distante, telle qu'elle est maintenant.
function repartir(git) {
  git(["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${BRANCHE}:refs/remotes/origin/${BRANCHE}`]);
  git(["reset", "--hard", "--quiet", `refs/remotes/origin/${BRANCHE}`]);
  git(["clean", "-f", "-d", "-x", "--quiet", "--", `${DOSSIER}/`]);
}

// Indexe personnages/ et rend les chemins indexés, tous vérifiés. Un dossier
// vide et non suivi n'a rien à indexer (git add le refuserait).
//
// git add saute sans rien dire ce qu'exclut le .gitignore de la branche :
// un fichier écrit mais caché ne partirait pas, et son ticket se fermerait
// « fait ». Après l'ajout, rien de personnages/ ne doit donc différer de
// l'index (ni caché, ni non suivi, ni modifié) ; sinon le passage s'arrête.
function indexer(git, racine) {
  const dossier = join(racine, DOSSIER);
  const present = existsSync(dossier) && readdirSync(dossier).length > 0;
  if (present || git(["ls-files", "-z", "--", `${DOSSIER}/`]) !== "") git(["add", "--all", "--", `${DOSSIER}/`]);
  const restes = git(["status", "--porcelain=v1", "-z", "--ignored=matching", "--untracked-files=all", "--", `${DOSSIER}/`])
    .split("\0")
    .filter((entree) => /^.[^ ] /.test(entree));
  if (restes.length) throw new Error(`Des fichiers de ${DOSSIER}/ ne peuvent être indexés (${restes.length}), le .gitignore de la branche les cache peut-être : le passage s'arrête, rien n'est envoyé.`);
  const chemins = git(["diff", "--cached", "--name-only", "--no-renames", "-z"]).split("\0").filter(Boolean);
  const horsDossier = chemins.filter((chemin) => !cheminPermis(chemin));
  if (horsDossier.length) throw new Error(`Des chemins hors de ${DOSSIER}/ seraient commités (${horsDossier.length}) : le passage s'arrête, rien n'est envoyé.`);
  return chemins;
}

/** Le message du commit : des numéros de tickets, aucun nom. */
export function messageDuCommit(numeros) {
  return numeros.length ? `Personnages : ticket${numeros.length > 1 ? "s" : ""} n° ${numeros.join(", ")}` : "Personnages : index régénéré";
}

/** La date de l'automate : UTC, à la seconde. */
export function dateDeRangement(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// La partie git d'un passage. Chaque essai repart de la branche distante :
// la banque (son sel) et les fichiers présents y sont relus, et les tickets
// rejugés. Rend { bilan, commit } ; lève une erreur si le passage s'arrête.
function rangerDansLeDepot({ git, racine, envois, maintenant, essais }) {
  for (let essai = 1; ; essai++) {
    repartir(git);
    const bilan = appliquer(racine, envois, dateDeRangement(maintenant()));
    if (indexer(git, racine).length === 0) return { bilan, commit: null };
    git(["commit", "--quiet", "-m", messageDuCommit(bilan.ranges)], { identite: true });
    try {
      git(["push", "--quiet", "origin", `HEAD:refs/heads/${BRANCHE}`], { envoi: true });
      return { bilan, commit: git(["rev-parse", "HEAD"]).trim() };
    } catch (erreur) {
      // Un commit arrivé entre-temps : on refait tout depuis la branche.
      if (essai >= essais) throw new Error(`L'envoi est refusé ${essais} fois de suite : le passage s'arrête, et les tickets du propriétaire restent ouverts. Dernier refus : ${String(erreur.stderr ?? erreur.message).trim()}`);
    }
  }
}

/**
 * Un passage de l'automate. api : le client de apiGitHub ; git : celui de
 * gitDans ; racine : l'arbre de travail, clone de la branche publiée ;
 * proprietaire : { login, id? } ; reconstruire : demander la construction de
 * Pages même sans commit (un lancement à la main). Rend le bilan : { ranges,
 * refuses, inconnus, commit, pages }, des numéros de tickets et des raisons
 * fixes.
 */
export async function ranger({ api, git, racine, proprietaire, maintenant = () => new Date(), essais = ESSAIS_MAX, reconstruire = false }) {
  if (typeof proprietaire?.login !== "string" || proprietaire.login === "") throw new TypeError("Le propriétaire du dépôt est inconnu.");
  // Deux listes : les tickets du propriétaire, qu'aucune avalanche de
  // tickets d'inconnus ne peut repousser au-delà de la limite, et tous les
  // ouverts, pour fermer ceux des inconnus.
  const parNumero = new Map();
  for (const ticket of [...(await api.ticketsOuverts({ createur: proprietaire.login })), ...(await api.ticketsOuverts())]) {
    if (Number.isSafeInteger(ticket?.number) && ticket.number > 0 && !ticket.pull_request) parNumero.set(ticket.number, ticket);
  }
  const ouverts = [...parNumero.values()].sort((a, b) => a.number - b.number);
  const inconnus = ouverts.filter((ticket) => !estDuProprietaire(ticket, proprietaire)).map((ticket) => ticket.number);
  const envois = ouverts.filter((ticket) => estDuProprietaire(ticket, proprietaire)).map((ticket) => ({ numero: ticket.number, ...lireEnvoi(ticket) }));

  // Les tickets des inconnus ne dépendent pas du dépôt : ils se ferment
  // même si la partie git s'arrête, mais après ceux du propriétaire, qui
  // passent d'abord quand l'API rationne les appels.
  const fermerLesInconnus = async () => {
    for (const numero of inconnus) {
      await api.fermer(numero, "not_planned");
      await api.verrouiller(numero, "off-topic");
    }
  };
  let bilan;
  let commit;
  try {
    ({ bilan, commit } = rangerDansLeDepot({ git, racine, envois, maintenant, essais }));
  } catch (erreur) {
    // L'arrêt de la partie git prime : un refus de l'API en fermant les
    // inconnus ne le masque pas (le passage suivant les reprendra).
    await fermerLesInconnus().catch(() => {});
    throw erreur;
  }

  // Après l'envoi seulement : Pages, puis les tickets.
  let pages = null;
  if (commit || reconstruire) {
    try {
      await api.construirePages();
      pages = "demandee";
    } catch (erreur) {
      pages = `refusée : ${erreur.message}`;
    }
  }
  for (const numero of bilan.ranges) {
    await api.fermer(numero, "completed");
    await api.verrouiller(numero, "resolved");
  }
  for (const { numero, raison } of bilan.refuses) {
    await api.commenter(numero, commentaireDeRefus(raison));
    await api.fermer(numero, "not_planned");
    await api.verrouiller(numero, "resolved");
  }
  await fermerLesInconnus();
  return { ranges: bilan.ranges, refuses: bilan.refuses, inconnus, commit, pages };
}

// ─── Le point d'entrée ──────────────────────────────────────────────────────

/**
 * Lit l'environnement de GitHub Actions : { depot, proprietaire, jeton,
 * reconstruire } ou { erreur }. reconstruire : lancé à la main.
 */
export function lireEnvironnement(env) {
  const depot = env.GITHUB_REPOSITORY ?? "";
  const login = env.GITHUB_REPOSITORY_OWNER ?? "";
  const id = env.GITHUB_REPOSITORY_OWNER_ID ? Number(env.GITHUB_REPOSITORY_OWNER_ID) : null;
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(depot) || depot.split("/")[0] !== login) return { erreur: "GITHUB_REPOSITORY ou GITHUB_REPOSITORY_OWNER manque ou est illisible : l'automate se lance depuis GitHub Actions." };
  if (id !== null && !(Number.isSafeInteger(id) && id > 0)) return { erreur: "GITHUB_REPOSITORY_OWNER_ID est illisible." };
  if (!env[VARIABLE_DU_JETON]) return { erreur: `Le jeton du workflow manque (${VARIABLE_DU_JETON}).` };
  return { depot, proprietaire: { login, id }, jeton: env[VARIABLE_DU_JETON], reconstruire: env.GITHUB_EVENT_NAME === "workflow_dispatch" };
}

async function principal() {
  const lu = lireEnvironnement(process.env);
  if (lu.erreur) {
    console.error(lu.erreur);
    process.exitCode = 1;
    return;
  }
  const bilan = await ranger({
    api: apiGitHub({ depot: lu.depot, jeton: lu.jeton }),
    git: gitDans(RACINE, { jeton: lu.jeton }),
    racine: RACINE,
    proprietaire: lu.proprietaire,
    reconstruire: lu.reconstruire,
  });
  const liste = (numeros) => (numeros.length ? `n° ${numeros.join(", ")}` : "aucun");
  console.log(`Rangés : ${liste(bilan.ranges)}. Refusés : ${liste(bilan.refuses.map((r) => r.numero))}. D'un inconnu : ${liste(bilan.inconnus)}.`);
  console.log(bilan.commit ? `Commit ${bilan.commit.slice(0, 7)} envoyé.` : "Rien à commiter.");
  if (bilan.pages) console.log(bilan.pages === "demandee" ? "Construction de Pages demandée." : `Construction de Pages ${bilan.pages}.`);
  // Sans construction de Pages, les joueurs ne verraient rien : le passage
  // est marqué en échec, pour que l'auteur le voie, et le relance à la main.
  if (bilan.pages !== null && bilan.pages !== "demandee") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erreur) => {
    console.error(erreur.message);
    process.exitCode = 1;
  });
}
