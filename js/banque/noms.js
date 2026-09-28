// Comparaison des noms (SPECIFICATION.md, § 6.3).
//
// Un renvoi se résout d'abord par le nom exact, puis, à défaut, sans casse,
// sans accents et sans espaces : retrouvé de la seconde façon, il est résolu
// mais signalé (A1). Une seule comparaison sert au contrôle, aux renvois des
// fiches et à la recherche, pour qu'ils ne divergent jamais.

/** La clé d'un nom : sans casse, sans accents, sans aucun espace. */
export function cle(nom) {
  return String(nom ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

/**
 * Un répertoire de noms. resoudre(renvoi) rend :
 *   { nom, facon: "exacte" } ou { nom, facon: "approchee" } quand le renvoi
 *   ne diffère que par la casse, les accents ou les espaces ;
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
