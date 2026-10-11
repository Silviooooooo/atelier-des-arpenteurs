// Recherche instantanée dans les listes (SPECIFICATION.md, § 9).
//
// Elle porte sur les noms et les descriptions, sans casse ni accents :
// « epee » trouve « Épée longue », « coeur » trouve « Cœur ». Chaque mot de la
// recherche doit se trouver quelque part, dans n'importe quel ordre.

const LIGATURES = { "œ": "oe", "æ": "ae", "’": "'", "ʼ": "'" };

/** Le texte tel que la recherche le compare. */
export function pourRecherche(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[œæ’ʼ]/g, (signe) => LIGATURES[signe])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Les textes où chercher, pour chaque catégorie de la consultation. Un
 * adversaire se cherche aussi par ses types, son équipement et ses
 * capacités, tels qu'il les écrit dans sa ligne ; les écrans y ajoutent ce
 * qu'il porte une fois résolu, hérité de ses types ou donné par son
 * équipement (textesAdversaire, js/banque/consultation.js).
 */
export const TEXTES = {
  blocs: (bloc) => [bloc.nom],
  capacites: (capacite) => [capacite.nom, ...capacite.variantes.map((variante) => variante.description)],
  elements: (element) => [element.nom, element.description],
  adversaires: (adversaire) => [adversaire.nom, adversaire.types, adversaire.equipement, adversaire.capacites],
  types: (type) => [type.nom],
};

/** Les entrées dont les textes contiennent chaque mot de la recherche. */
export function filtrer(entrees, recherche, textes) {
  const mots = pourRecherche(recherche).split(" ").filter(Boolean);
  if (mots.length === 0) return entrees;
  return entrees.filter((entree) => {
    // Une banque forgée peut porter autre chose qu'un texte dans une
    // cellule : il ne se cherche pas, et ne fait rien lever.
    const texte = pourRecherche(textes(entree).filter((morceau) => typeof morceau === "string").join(" "));
    return mots.every((mot) => texte.includes(mot));
  });
}
