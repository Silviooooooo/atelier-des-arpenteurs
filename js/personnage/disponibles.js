// Les personnages qu'on peut ajouter à un combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) », et § 15.8 pour les personnages en ligne).
//
// L'écran Personnages rapproche l'appareil et le site par depot.rapprocher(),
// qui range en passant : il efface de l'appareil la copie qu'une version en
// ligne a rattrapée, et les notes devenues sans objet. Ouvrir la préparation
// d'un combat ne doit rien changer à l'appareil. Ce module refait donc le
// rapprochement en lecture seule : il ne lit que la liste de l'étagère, ses
// notes, et les personnages en ligne.
//
// La règle est celle de l'auteur pour le simulateur, plus simple que celle de
// l'écran Personnages : un personnage par identifiant ; sa version la plus
// récente, et à égalité celle en ligne ; jamais un brouillon ; jamais un
// personnage dont l'appareil a demandé la suppression, envoyée ou non. Une
// copie plus ancienne que la version en ligne, que l'écran Personnages montre
// à part, ne se propose donc pas ici.

import { PHRASE_CLE_CHANGEE } from "./depot.js";

const PHRASE_EN_LIGNE = "Les personnages en ligne ne se lisent pas pour l'instant.";

const nomDe = (personnage) => String(personnage?.identite?.nom ?? "").trim() || "Sans nom";
const dateDe = (personnage) => Date.parse(personnage?.modifie_le);
const compte = (nombre, singulier, pluriel) => `${nombre} ${nombre > 1 ? pluriel : singulier}`;
const raisonDe = (erreur) => erreur?.message ?? String(erreur);

/**
 * Les personnages à proposer, triés par nom : [{ personnage, source }], source
 * valant « appareil » ou « en_ligne ». locaux : les personnages de l'étagère ;
 * notes : ses notes ; enLigne : les personnages lus du site. Fonction pure :
 * elle ne modifie rien de ce qu'on lui donne.
 */
export function retenir(locaux, notes, enLigne) {
  const supprimes = new Set((notes ?? []).filter((note) => note?.depot?.action === "supprimer").map((note) => note.id));
  const retenus = new Map();
  for (const personnage of enLigne ?? []) {
    if (!personnage || supprimes.has(personnage.id) || retenus.has(personnage.id)) continue;
    retenus.set(personnage.id, { personnage, source: "en_ligne" });
  }
  for (const personnage of locaux ?? []) {
    if (!personnage || personnage.etat !== "enregistre" || supprimes.has(personnage.id)) continue;
    const present = retenus.get(personnage.id);
    // Strictement plus récent : à égalité, c'est la version en ligne qui reste.
    if (!present || dateDe(personnage) > dateDe(present.personnage)) retenus.set(personnage.id, { personnage, source: "appareil" });
  }
  return [...retenus.values()].sort(
    (a, b) => nomDe(a.personnage).localeCompare(nomDe(b.personnage), "fr", { sensitivity: "base" }) || (a.personnage.id < b.personnage.id ? -1 : a.personnage.id > b.personnage.id ? 1 : 0),
  );
}

/**
 * Lit, sans rien écrire, les personnages qu'on peut ajouter à un combat :
 * { personnages, phrases }. personnages : ce que rend retenir() ; phrases :
 * ce qui n'a pas pu se lire, dit comme sur l'écran Personnages. Quand les
 * personnages en ligne ne se lisent pas, la liste montre ceux de l'appareil.
 * depot peut manquer : seul l'appareil est alors lu. Ne lève pas.
 */
export async function personnagesDisponibles({ etagere, depot = null }) {
  const phrases = [];
  let locaux = [];
  let notes = [];
  let illisibles = 0;
  try {
    const lus = await etagere.lister();
    locaux = lus.personnages ?? [];
    illisibles = lus.illisibles ?? 0;
    notes = (await etagere.listerNotes?.()) ?? [];
  } catch (erreur) {
    // Sans les notes, une suppression demandée ne se verrait pas : rien de
    // l'appareil n'est alors proposé.
    locaux = [];
    notes = [];
    phrases.push(`Les personnages de cet appareil n'ont pas pu être lus : ${raisonDe(erreur)}`);
  }

  let enLigne = [];
  if (depot) {
    try {
      const lu = await depot.lireEnLigne();
      enLigne = lu.erreur ? [] : (lu.personnages ?? []);
      if (lu.erreur) phrases.push(lu.erreur);
      // Un fichier du sel de la banque en place que la page ne lit pas : c'est
      // la page qui tient l'ancienne clé.
      if (lu.cleChangee) phrases.push(`${PHRASE_CLE_CHANGEE} (${compte(lu.cleChangee, "personnage en ligne attend", "personnages en ligne attendent")} la nouvelle clé.)`);
      if (lu.ancienneCle) phrases.push(`${compte(lu.ancienneCle, "personnage en ligne est chiffré", "personnages en ligne sont chiffrés")} avec une ancienne clé de table : l'auteur doit les rechiffrer.`);
      illisibles += lu.illisibles ?? 0;
    } catch {
      phrases.push(PHRASE_EN_LIGNE);
    }
  }
  if (illisibles) phrases.push(`${compte(illisibles, "personnage illisible est ignoré", "personnages illisibles sont ignorés")}.`);
  return { personnages: retenir(locaux, notes, enLigne), phrases };
}
