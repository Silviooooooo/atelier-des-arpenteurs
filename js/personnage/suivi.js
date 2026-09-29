// Ce qui a changé dans la banque depuis l'enregistrement d'un personnage
// (SPECIFICATION.md, § 15.1).
//
// Un personnage garde ses choix, pas des copies : pour savoir qu'un choix a
// été modifié depuis, il garde de chacun une empreinte courte de son
// contenu de règle (type, éléments, capacités, paramètres d'un bloc ;
// variantes d'une capacité), sans les notes de conception ni la ligne du
// classeur, qui changent sans changer la règle. L'empreinte sert à voir un
// changement, pas à protéger un secret : un hachage rapide, non
// cryptographique, sur 53 bits, suffit, et ne permet pas de retrouver le
// contenu.

import { cle } from "../banque/noms.js";

// cyrb53 : un hachage de chaîne sur 53 bits, rapide et bien réparti.
function cyrb53(texte) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Une écriture qui ne dépend pas de l'ordre des clés.
function canonique(valeur) {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  if (valeur && typeof valeur === "object") {
    return `{${Object.keys(valeur)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(valeur[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valeur ?? null);
}

const regleDuBloc = (bloc) => ({ type: bloc.type ?? "", elements: bloc.elements, capacites: bloc.capacites, parametres: bloc.parametres });
const regleDeLaCapacite = (capacite) =>
  capacite.variantes.map((v) => ({ puissance: v.puissance, cout_souffle: v.cout_souffle, cout_lien: v.cout_lien, elements: v.elements, description: v.description }));

/** L'empreinte d'un contenu de règle : 14 chiffres hexadécimaux. */
export function empreinte(contenu) {
  return cyrb53(canonique(contenu)).toString(16).padStart(14, "0");
}

/** L'empreinte d'un bloc ou d'une capacité de la banque. */
export function empreinteDe(genre, objet) {
  return empreinte(genre === "bloc" ? regleDuBloc(objet) : regleDeLaCapacite(objet));
}

/**
 * Relève les empreintes des choix d'un personnage : les blocs choisis et
 * les capacités qu'il possède, tels que la fiche les a résolus.
 */
export function relever(index, fiche, personnage) {
  const releve = [];
  const vus = new Set();
  const ajouter = (genre, objet) => {
    const k = `${genre}:${cle(objet.nom)}`;
    if (vus.has(k)) return;
    vus.add(k);
    releve.push({ genre, nom: objet.nom, empreinte: empreinteDe(genre, objet) });
  };
  for (const role of ["espece", "archetype", "constellation", "primordial"]) {
    const bloc = personnage[role]?.nom ? index.bloc(personnage[role].nom) : null;
    if (bloc) ajouter("bloc", bloc);
  }
  for (const objet of personnage.equipement ?? []) {
    const bloc = index.bloc(objet.nom);
    if (bloc) ajouter("bloc", bloc);
  }
  for (const capacite of fiche.capacites) {
    const trouvee = capacite.aVenir ? null : index.capacite(capacite.nom);
    if (trouvee) ajouter("capacite", trouvee);
  }
  return releve;
}

/** Les choix disparus ou modifiés depuis le relevé : des phrases. */
export function changements(index, releve) {
  const phrases = [];
  for (const { genre, nom, empreinte: avant } of releve ?? []) {
    const objet = genre === "bloc" ? index.bloc(nom) : index.capacite(nom);
    const quoi = genre === "bloc" ? "Le bloc" : "La capacité";
    if (!objet) phrases.push(`${quoi} « ${nom} » a disparu de la banque depuis l'enregistrement.`);
    else if (empreinteDe(genre, objet) !== avant) phrases.push(`${quoi} « ${nom} » a changé dans la banque depuis l'enregistrement.`);
  }
  return phrases;
}
