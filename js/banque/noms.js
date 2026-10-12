// Comparaison des noms (SPECIFICATION.md, § 6.3).
//
// Un renvoi se résout d'abord par le nom exact, puis, à défaut, sans casse,
// sans accents, sans espaces et sans signe invisible : retrouvé de la seconde
// façon, il est résolu mais signalé (A1). Une seule comparaison sert au
// contrôle, aux renvois des fiches et à la résolution des adversaires, pour
// qu'ils ne divergent jamais.
//
// Les signes invisibles (lot 4) : un nom copié d'une page web ou d'un
// traitement de texte peut porter un signe de format que rien ne montre à
// l'écran. Deux noms qui ne diffèrent que par lui sont le même nom pour qui
// lit le classeur : ils se comparent donc sans lui, partout. La banque, elle,
// garde le nom tel qu'il est écrit.

// Les vingt et un signes de format retirés, et eux seuls : le trait d'union
// conditionnel (U+00AD), les espaces et liants sans chasse et les marques de
// sens (U+200B à U+200F), les commandes de sens de l'écriture (U+202A à
// U+202E, U+2066 à U+2069), le liant de mots et les opérateurs invisibles
// (U+2060 à U+2064), la marque d'ordre des octets (U+FEFF). U+2065, non
// attribué, et U+061C n'en sont pas.
const SIGNES_INVISIBLES = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

/** Un texte sans ses signes de format invisibles ; rien d'autre n'y change. */
export function sansSignesInvisibles(texte) {
  return String(texte ?? "").replace(SIGNES_INVISIBLES, "");
}

/**
 * Un nom tel qu'il se compare « exactement » (E3, E16, les fiches) : sans
 * signe invisible, et sans les espaces de bord qu'un tel signe cachait
 * (« Marmiton » suivi d'une espace puis d'un signe reste « Marmiton »).
 */
export function nomCompare(nom) {
  return sansSignesInvisibles(nom).trim();
}

/** La clé d'un nom : sans signe invisible, sans casse, sans accents, sans aucun espace. */
export function cle(nom) {
  return sansSignesInvisibles(nom)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

/**
 * Un répertoire de noms. resoudre(renvoi) rend :
 *   { nom, facon: "exacte" } ou { nom, facon: "approchee" } quand le renvoi
 *   ne diffère que par la casse, les accents, les espaces ou un signe
 *   invisible ;
 *   { nom: null, candidats } sinon, candidats listant les noms de même clé
 *   quand il y en a plusieurs (renvoi ambigu).
 */
export function repertoire(noms) {
  const exacts = new Set();
  const parCle = new Map();
  for (const nom of noms) {
    exacts.add(nom);
    const k = cle(nom);
    if (!parCle.has(k)) parCle.set(k, new Set());
    parCle.get(k).add(nom);
  }
  return {
    resoudre(renvoi) {
      if (exacts.has(renvoi)) return { nom: renvoi, facon: "exacte" };
      const candidats = [...(parCle.get(cle(renvoi)) ?? [])];
      if (candidats.length === 1) return { nom: candidats[0], facon: "approchee" };
      return { nom: null, candidats };
    },
  };
}
