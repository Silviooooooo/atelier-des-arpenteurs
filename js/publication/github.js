// Publication par l'API GitHub (SPECIFICATION.md, § 8).
//
// Lit le fichier publié et son sha, puis l'écrit par PUT, avec un auteur et
// un committer explicites en adresse privée : sans eux, GitHub prendrait
// l'identité du compte, peut-être avec l'adresse personnelle, et l'historique
// public la garderait. Le fichier absent (réponse 404) est la première
// publication, qui s'écrit sans sha.
//
// Le changement du mot de passe de table écrit plusieurs fichiers d'un coup :
// la banque, les personnages en ligne rechiffrés et leur index (§ 8.4). Il
// passe par l'API Git Data : lecture de l'arbre de main, puis un seul commit,
// et la branche avancée sans forcer. Un commit arrivé entre-temps (une
// publication, un personnage rangé par l'automate) fait refuser l'avance :
// tout recommence depuis la lecture.
//
// fetch se passe en paramètre : les contrôles le remplacent par une
// simulation, et n'appellent jamais GitHub. Aucune fonction ne lève
// d'exception pour un refus ou une panne : elles rendent { erreur, code }.

import { CHEMIN_INDEX, FICHIER, TAILLE_MAX_FICHIER } from "../personnage/en_ligne.js";
import { depuisBase64, versBase64 } from "../securite/chiffrement.js";

export const DEPOT = { proprietaire: "Silviooooooo", nom: "atelier-des-arpenteurs", branche: "main" };
export const CHEMIN_BANQUE = "donnees/banque.chiffree.json";
export const IDENTITE = { name: "Silvio Abbaz", email: "26520416+Silviooooooo@users.noreply.github.com" };
export const ADRESSE_DEPOT = `https://api.github.com/repos/${DEPOT.proprietaire}/${DEPOT.nom}`;
export const ADRESSE_BANQUE = `${ADRESSE_DEPOT}/contents/${CHEMIN_BANQUE}`;
// Au-delà, un fichier du commit part en blob à part, plutôt que dans le
// corps de l'arbre : la banque, un gros index.
const TAILLE_MAX_EN_LIGNE = 64 * 1024;
// Les lectures de fichiers de personnages menées ensemble.
const LECTURES_SIMULTANEES = 6;

function entetes(jeton, accept = "application/vnd.github+json") {
  return { Accept: accept, Authorization: `Bearer ${jeton}`, "X-GitHub-Api-Version": "2022-11-28" };
}

async function appeler(fetch, adresse, init) {
  try {
    return { reponse: await fetch(adresse, init) };
  } catch {
    return { erreur: "GitHub ne répond pas : vérifiez la connexion, puis réessayez.", code: "reseau" };
  }
}

// Le JSON d'une réponse, ou null : un portail captif répond en HTML, et une
// connexion coupée laisse un corps vide.
async function lireJson(reponse) {
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

// Le motif que donne GitHub, recopié pour le diagnostic.
async function motifDe(reponse) {
  const motif = (await lireJson(reponse))?.message ?? "";
  return `GitHub : ${reponse.status}${motif ? `, ${motif}` : ""}`;
}

async function refus(reponse) {
  const detail = ` (${await motifDe(reponse)})`;
  if (reponse.status === 401) {
    return { code: "jeton", erreur: `GitHub refuse la clé : elle est fausse, expirée ou révoquée. Saisissez-en une nouvelle.${detail}` };
  }
  if (reponse.status === 403 || reponse.status === 404) {
    return {
      code: "droits",
      erreur: `La clé GitHub n'a pas le droit d'écrire ici : il lui faut, sur le seul dépôt ${DEPOT.nom}, la permission « Contents » en lecture et écriture.${detail}`,
    };
  }
  return { code: "github", erreur: `GitHub a refusé la demande.${detail}` };
}

function reponseIllisible(statut) {
  return { code: "format", erreur: `La réponse de GitHub est illisible : vérifiez la connexion (un réseau public demande parfois de s'identifier), puis réessayez. (GitHub : ${statut})` };
}

/** Le texte du fichier de la banque, tel qu'il s'écrit : JSON indenté, retour à la ligne final (§ 8.2). */
export function texteDeLaBanque(enveloppe) {
  return `${JSON.stringify(enveloppe, null, 2)}\n`;
}

/**
 * Lit le fichier publié : { sha, enveloppe }, ou { sha: null, enveloppe:
 * null } quand il n'existe pas encore (première publication), ou { erreur }.
 */
export async function lirePublication({ jeton, fetch = globalThis.fetch }) {
  const adresse = `${ADRESSE_BANQUE}?ref=${DEPOT.branche}`;
  // cache: "no-store" : un sha gardé par le navigateur serait périmé.
  const lu = await appeler(fetch, adresse, { headers: entetes(jeton), cache: "no-store" });
  if (!lu.reponse) return lu;
  if (lu.reponse.status === 404) return { sha: null, enveloppe: null };
  if (!lu.reponse.ok) return refus(lu.reponse);
  const fichier = await lireJson(lu.reponse);
  if (!fichier) return reponseIllisible(lu.reponse.status);
  let texte;
  if (fichier.encoding === "base64" && fichier.content) {
    texte = new TextDecoder().decode(depuisBase64(fichier.content.replace(/\s/g, "")));
  } else {
    // Au-delà d'un mégaoctet, l'API ne donne le contenu qu'en brut.
    const brut = await appeler(fetch, adresse, { headers: entetes(jeton, "application/vnd.github.raw+json"), cache: "no-store" });
    if (!brut.reponse) return brut;
    if (!brut.reponse.ok) return refus(brut.reponse);
    texte = await brut.reponse.text();
  }
  try {
    return { sha: fichier.sha, enveloppe: JSON.parse(texte) };
  } catch {
    return { code: "format", erreur: "Le fichier publié sur GitHub n'est pas du JSON lisible." };
  }
}

/**
 * Écrit le fichier chiffré par PUT : { sha, commit } ou { erreur, code }.
 * sha est celui du fichier lu, null à la première publication. Le code
 * « sha_perime » dit qu'une autre publication est passée entre-temps.
 */
export async function ecrirePublication({ jeton, enveloppe, sha, message, fetch = globalThis.fetch }) {
  const corps = {
    message,
    content: versBase64(new TextEncoder().encode(texteDeLaBanque(enveloppe))),
    branch: DEPOT.branche,
    author: IDENTITE,
    committer: IDENTITE,
  };
  if (sha) corps.sha = sha;
  const ecrit = await appeler(fetch, ADRESSE_BANQUE, {
    method: "PUT",
    headers: { ...entetes(jeton), "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!ecrit.reponse) return ecrit;
  // 409 : le sha ne correspond plus. 422 sans sha : le fichier est apparu
  // depuis la lecture, par une première publication faite ailleurs.
  if (ecrit.reponse.status === 409 || (ecrit.reponse.status === 422 && !sha)) {
    return { code: "sha_perime", erreur: "La banque a été publiée entre-temps depuis un autre appareil.", motif: await motifDe(ecrit.reponse) };
  }
  if (!ecrit.reponse.ok) return refus(ecrit.reponse);
  // Le statut dit que l'écriture a eu lieu, même si le corps est perdu.
  const resultat = await lireJson(ecrit.reponse);
  return { sha: resultat?.content?.sha ?? null, commit: resultat?.commit?.sha ?? null };
}

/**
 * Le circuit de publication (§ 8.2). Lit le fichier publié, le fait
 * préparer (déchiffrer l'ancienne banque, refaire les différences, chiffrer
 * la nouvelle), demande confirmation, puis écrit. Un refus pour sha périmé
 * recommence tout : rechargement, nouvelles différences, nouvelle
 * confirmation.
 *
 *   preparer({ sha, enveloppe }) → { enveloppe, message, … } ou { erreur }
 *   confirmer(preparation, { essai }) → vrai pour publier
 *
 * Rend { sha, commit, preparation }, { annulee: true } ou { erreur, code }.
 */
export async function publier({ jeton, preparer, confirmer, fetch = globalThis.fetch, essais = 3 }) {
  let dernier = null;
  for (let essai = 1; essai <= essais; essai += 1) {
    const publiee = await lirePublication({ jeton, fetch });
    if (publiee.erreur) return publiee;
    const preparation = await preparer(publiee);
    if (preparation.erreur) return preparation;
    if (!(await confirmer(preparation, { essai }))) return { annulee: true };
    const ecrit = await ecrirePublication({ jeton, fetch, sha: publiee.sha, enveloppe: preparation.enveloppe, message: preparation.message });
    if (ecrit.code !== "sha_perime") return ecrit.erreur ? ecrit : { ...ecrit, preparation };
    dernier = ecrit.motif;
  }
  // Le motif du dernier refus : un 422 peut aussi venir d'une autre cause.
  return { code: "sha_perime", erreur: `La banque a changé sur GitHub à chacun des ${essais} essais : réessayez dans un moment. (Dernier refus : ${dernier})` };
}

// ─── L'API Git Data : un commit de plusieurs fichiers (§ 8.4) ───────────────

// Un sha de Git : 40 signes hexadécimaux (64 pour un dépôt en SHA-256).
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const estSha = (valeur) => typeof valeur === "string" && SHA.test(valeur);
const inattendue = (quoi) => ({ code: "format", erreur: `La réponse de GitHub est inattendue (${quoi}) : réessayez dans un moment.` });

// Un appel de l'API qui rend du JSON : { json } ou { erreur, code }.
async function appelerJson(fetch, adresse, init) {
  const appel = await appeler(fetch, adresse, init);
  if (!appel.reponse) return appel;
  if (!appel.reponse.ok) return refus(appel.reponse);
  const json = await lireJson(appel.reponse);
  if (json === null || typeof json !== "object") return reponseIllisible(appel.reponse.status);
  return { json };
}

// Le texte d'un blob : { texte } ou { erreur, code }. Seul un fichier reçu
// entier dont les octets ne sont pas de l'UTF-8 porte le code « contenu » :
// c'est le fichier qui est abîmé. Une réponse illisible, coupée ou
// inattendue garde le code « format » : c'est la lecture qui a échoué, et un
// nouvel essai la réussira peut-être.
async function lireBlob(lire, sha) {
  const lu = await lire(`git/blobs/${sha}`);
  if (lu.erreur) return lu;
  if (lu.json.encoding !== "base64" || typeof lu.json.content !== "string") return inattendue("un fichier sans contenu");
  let octets;
  try {
    octets = depuisBase64(lu.json.content.replace(/\s/g, ""));
  } catch {
    return inattendue("un fichier mal encodé");
  }
  try {
    return { texte: new TextDecoder("utf-8", { fatal: true }).decode(octets) };
  } catch {
    return { code: "contenu", erreur: "Ce fichier n'est pas du texte UTF-8." };
  }
}

/**
 * Lit l'état de main par l'API Git Data : la référence, le commit, son arbre
 * complet, puis la banque publiée, les fichiers des personnages en ligne et
 * leur index. Rend { commit, arbre, sha, enveloppe, personnages, index }, ou
 * { erreur, code }. Sans banque publiée, sha et enveloppe valent null.
 * personnages : [{ identifiant, chemin, texte }], ou { identifiant, chemin,
 * erreur } pour un fichier trop gros, ou reçu entier mais qui n'est pas du
 * texte ; index : son texte (vide s'il n'est pas du texte), ou null s'il
 * manque. Un arbre tronqué (GitHub n'en donne qu'une partie) est une erreur :
 * un personnage omis resterait sous l'ancienne clé. Une réponse illisible sur
 * un seul fichier aussi : un personnage que la lecture a manqué resterait
 * sous l'ancienne clé, alors qu'un nouvel essai l'aurait rechiffré.
 */
export async function lireDepot({ jeton, fetch = globalThis.fetch }) {
  const lire = (chemin, init = {}) => appelerJson(fetch, `${ADRESSE_DEPOT}/${chemin}`, { headers: entetes(jeton), ...init });
  // Seule la référence change : elle se lit sans cache. Commits, arbres et
  // blobs se désignent par leur empreinte, et ne changent jamais.
  const ref = await lire(`git/ref/heads/${DEPOT.branche}`, { cache: "no-store" });
  if (ref.erreur) return ref;
  const commit = ref.json.object?.sha;
  if (!estSha(commit)) return inattendue("la branche");
  const lu = await lire(`git/commits/${commit}`);
  if (lu.erreur) return lu;
  const arbre = lu.json.tree?.sha;
  if (!estSha(arbre)) return inattendue("le commit");
  const liste = await lire(`git/trees/${arbre}?recursive=1`);
  if (liste.erreur) return liste;
  if (liste.json.truncated) {
    return { code: "arbre_tronque", erreur: "GitHub n'a donné qu'une partie des fichiers du dépôt : rien n'est écrit, pour ne laisser aucun personnage derrière." };
  }
  if (!Array.isArray(liste.json.tree)) return inattendue("l'arbre");
  const blobs = new Map();
  for (const entree of liste.json.tree) {
    if (entree?.type === "blob" && typeof entree.path === "string" && estSha(entree.sha)) blobs.set(entree.path, entree);
  }

  let enveloppe = null;
  const banque = blobs.get(CHEMIN_BANQUE);
  if (banque) {
    const texte = await lireBlob(lire, banque.sha);
    const illisible = { code: "format", erreur: "Le fichier publié sur GitHub n'est pas du JSON lisible." };
    if (texte.erreur) return texte.code === "contenu" ? illisible : texte;
    try {
      enveloppe = JSON.parse(texte.texte);
    } catch {
      return illisible;
    }
  }

  // Un index abîmé se régénère ; une lecture manquée arrête tout.
  let index = null;
  if (blobs.has(CHEMIN_INDEX)) {
    const texte = await lireBlob(lire, blobs.get(CHEMIN_INDEX).sha);
    if (texte.erreur && texte.code !== "contenu") return texte;
    index = texte.texte ?? "";
  }

  // Un fichier de personnage abîmé ne bloque rien : il est laissé tel quel,
  // et compté. Une panne, un refus ou une réponse illisible arrêtent tout.
  const chemins = [...blobs.keys()].filter((chemin) => FICHIER.test(chemin)).sort();
  const personnages = [];
  for (let debut = 0; debut < chemins.length; debut += LECTURES_SIMULTANEES) {
    const lus = await Promise.all(
      chemins.slice(debut, debut + LECTURES_SIMULTANEES).map(async (chemin) => {
        const [, identifiant] = chemin.match(FICHIER);
        if (blobs.get(chemin).size > TAILLE_MAX_FICHIER) return { identifiant, chemin, erreur: `Le fichier dépasse ${TAILLE_MAX_FICHIER / 1024} Ko.` };
        const texte = await lireBlob(lire, blobs.get(chemin).sha);
        if (!texte.erreur) return { identifiant, chemin, texte: texte.texte };
        return texte.code === "contenu" ? { identifiant, chemin, erreur: texte.erreur } : { arret: texte };
      }),
    );
    const arret = lus.find((lu) => lu.arret);
    if (arret) return arret.arret;
    personnages.push(...lus);
  }
  return { commit, arbre, sha: banque?.sha ?? null, enveloppe, personnages, index };
}

// La requête d'avance est partie, et la connexion est tombée avant la
// réponse : GitHub a pu avancer la branche. Relue sans cache, elle le dit :
// sur le commit écrit, c'est un succès ; ailleurs, la panne (rien n'est
// écrit). Sans relecture, on ne sait pas, et l'écran doit le dire : au
// changement du mot de passe, la banque serait peut-être déjà sous le
// nouveau.
async function avanceSansReponse({ jeton, fetch, commit, panne }) {
  const relue = await appelerJson(fetch, `${ADRESSE_DEPOT}/git/ref/heads/${DEPOT.branche}`, { headers: entetes(jeton), cache: "no-store" });
  if (relue.erreur) {
    return { code: "incertain", erreur: "GitHub ne répond plus depuis l'envoi : le commit a peut-être été écrit. Rechargez la page, puis vérifiez avant de recommencer." };
  }
  return relue.json.object?.sha === commit ? { commit } : panne;
}

/**
 * Écrit un seul commit de plusieurs fichiers sur main, par-dessus le commit
 * lu (parent) et son arbre (base). fichiers : [{ chemin, texte }]. Rend
 * { commit } ou { erreur, code }. L'auteur et le committer sont explicites,
 * comme au PUT (§ 8.2). La branche n'avance que si elle est encore au
 * parent : sinon (422, ou 409), le code « avance_refusee » dit qu'un autre
 * commit est passé entre-temps ; le commit préparé reste orphelin, et GitHub
 * l'oubliera. Une avance restée sans réponse a pu se faire : la branche,
 * relue, le dit ; si la relecture échoue aussi, le code « incertain » dit
 * que l'issue est inconnue.
 */
export async function ecrireCommit({ jeton, parent, base, fichiers, message, fetch = globalThis.fetch }) {
  const ecriture = { ...entetes(jeton), "Content-Type": "application/json" };
  const poster = (chemin, corps) => appelerJson(fetch, `${ADRESSE_DEPOT}/${chemin}`, { method: "POST", headers: ecriture, body: JSON.stringify(corps) });
  const entrees = [];
  for (const { chemin, texte } of fichiers) {
    if (texte.length <= TAILLE_MAX_EN_LIGNE) {
      entrees.push({ path: chemin, mode: "100644", type: "blob", content: texte });
      continue;
    }
    const blob = await poster("git/blobs", { content: versBase64(new TextEncoder().encode(texte)), encoding: "base64" });
    if (blob.erreur) return blob;
    if (!estSha(blob.json.sha)) return inattendue("un fichier écrit");
    entrees.push({ path: chemin, mode: "100644", type: "blob", sha: blob.json.sha });
  }
  const arbre = await poster("git/trees", { base_tree: base, tree: entrees });
  if (arbre.erreur) return arbre;
  if (!estSha(arbre.json.sha)) return inattendue("l'arbre écrit");
  const commit = await poster("git/commits", { message, tree: arbre.json.sha, parents: [parent], author: IDENTITE, committer: IDENTITE });
  if (commit.erreur) return commit;
  if (!estSha(commit.json.sha)) return inattendue("le commit écrit");
  const avance = await appeler(fetch, `${ADRESSE_DEPOT}/git/refs/heads/${DEPOT.branche}`, {
    method: "PATCH",
    headers: ecriture,
    body: JSON.stringify({ sha: commit.json.sha, force: false }),
  });
  if (!avance.reponse) return avanceSansReponse({ jeton, fetch, commit: commit.json.sha, panne: avance });
  if (avance.reponse.status === 422 || avance.reponse.status === 409) {
    return { code: "avance_refusee", erreur: "Le dépôt a changé sur GitHub entre-temps.", motif: await motifDe(avance.reponse) };
  }
  if (!avance.reponse.ok) return refus(avance.reponse);
  // Le statut dit que la branche a avancé, même si le corps est perdu.
  return { commit: commit.json.sha };
}

/**
 * Le circuit d'un commit de plusieurs fichiers (§ 8.4) : lit l'état de main,
 * le fait préparer, demande confirmation, puis écrit un seul commit. Un refus
 * d'avance recommence tout, trois fois au plus : relecture, nouvelle
 * préparation (un personnage rangé entre-temps est pris aussi), nouvelle
 * confirmation.
 *
 *   preparer(depot) → { enveloppe?, fichiers?, message, … } ou { erreur }
 *   confirmer(preparation, { essai }) → vrai pour écrire
 *
 * La banque (preparation.enveloppe), s'il y en a une, part avec les fichiers
 * de la préparation. Rend { commit, preparation }, { annulee: true } ou
 * { erreur, code }.
 */
export async function publierParCommit({ jeton, preparer, confirmer, fetch = globalThis.fetch, essais = 3 }) {
  let dernier = null;
  for (let essai = 1; essai <= essais; essai += 1) {
    const depot = await lireDepot({ jeton, fetch });
    if (depot.erreur) return depot;
    const preparation = await preparer(depot);
    if (preparation.erreur) return preparation;
    if (!(await confirmer(preparation, { essai }))) return { annulee: true };
    const fichiers = [...(preparation.enveloppe ? [{ chemin: CHEMIN_BANQUE, texte: texteDeLaBanque(preparation.enveloppe) }] : []), ...(preparation.fichiers ?? [])];
    if (!fichiers.length) return { code: "rien", erreur: "Il n'y a rien à écrire." };
    const ecrit = await ecrireCommit({ jeton, fetch, parent: depot.commit, base: depot.arbre, fichiers, message: preparation.message });
    if (ecrit.code !== "avance_refusee") return ecrit.erreur ? ecrit : { ...ecrit, preparation };
    dernier = ecrit.motif;
  }
  return { code: "avance_refusee", erreur: `Le dépôt a changé sur GitHub à chacun des ${essais} essais : réessayez dans un moment. (Dernier refus : ${dernier})` };
}
