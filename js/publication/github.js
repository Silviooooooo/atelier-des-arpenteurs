// Publication par l'API GitHub (SPECIFICATION.md, § 8).
//
// Lit le fichier publié et son sha, puis l'écrit par PUT, avec un auteur et
// un committer explicites en adresse privée : sans eux, GitHub prendrait
// l'identité du compte, peut-être avec l'adresse personnelle, et l'historique
// public la garderait. Le fichier absent (réponse 404) est la première
// publication, qui s'écrit sans sha.
//
// fetch se passe en paramètre : les contrôles le remplacent par une
// simulation, et n'appellent jamais GitHub. Aucune fonction ne lève
// d'exception pour un refus ou une panne : elles rendent { erreur, code }.

import { depuisBase64, versBase64 } from "../securite/chiffrement.js";

export const DEPOT = { proprietaire: "Silviooooooo", nom: "atelier-des-arpenteurs", branche: "main" };
export const CHEMIN_BANQUE = "donnees/banque.chiffree.json";
export const IDENTITE = { name: "Silvio Abbaz", email: "26520416+Silviooooooo@users.noreply.github.com" };
export const ADRESSE_BANQUE = `https://api.github.com/repos/${DEPOT.proprietaire}/${DEPOT.nom}/contents/${CHEMIN_BANQUE}`;

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

// Le motif que donne GitHub, recopié pour le diagnostic.
async function refus(reponse) {
  let motif = "";
  try {
    motif = (await reponse.json()).message ?? "";
  } catch {
    // une réponse sans JSON : le code suffit
  }
  const detail = ` (GitHub : ${reponse.status}${motif ? `, ${motif}` : ""})`;
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
  const fichier = await lu.reponse.json();
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
    content: versBase64(new TextEncoder().encode(`${JSON.stringify(enveloppe, null, 2)}\n`)),
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
    return { code: "sha_perime", erreur: "La banque a été publiée entre-temps depuis un autre appareil." };
  }
  if (!ecrit.reponse.ok) return refus(ecrit.reponse);
  const resultat = await ecrit.reponse.json();
  return { sha: resultat.content?.sha ?? null, commit: resultat.commit?.sha ?? null };
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
  for (let essai = 1; essai <= essais; essai += 1) {
    const publiee = await lirePublication({ jeton, fetch });
    if (publiee.erreur) return publiee;
    const preparation = await preparer(publiee);
    if (preparation.erreur) return preparation;
    if (!(await confirmer(preparation, { essai }))) return { annulee: true };
    const ecrit = await ecrirePublication({ jeton, fetch, sha: publiee.sha, enveloppe: preparation.enveloppe, message: preparation.message });
    if (ecrit.code !== "sha_perime") return ecrit.erreur ? ecrit : { ...ecrit, preparation };
  }
  return { code: "sha_perime", erreur: `La banque a changé sur GitHub à chacun des ${essais} essais : réessayez dans un moment.` };
}
