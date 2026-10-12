// Ce que les fiches affichent (SPECIFICATION.md, § 5.2, § 9 et § 16.6).
//
// Un index de la banque, calculé une fois : les renvois résolus comme le
// contrôle les résout (exactement, puis sans casse, accents, espaces ni
// signe invisible, § 6.3), « octroyée par » pour une capacité, « porté par »
// pour un élément, le nom affiché d'un paramètre (§ 5.2), et les anomalies
// de chaque ligne.
// Il reprend les définitions du contrôle, et n'en ajoute aucune : une
// capacité est octroyée par les blocs qui la citent dans leur colonne des
// capacités (A3) ; un élément est porté par les blocs et les capacités qui le
// citent, et par les blocs qui transmettent un paramètre qu'il reçoit (A4).
//
// Depuis le lot 3, il range aussi les adversaires et leurs types, et garde
// leur index de résolution (js/adversaire/resolution.js) : les écrans
// affichent un adversaire résolu, sans le résoudre à chaque affichage.

import { banqueSansAdversaires, entreesLisibles, indexerAdversaires } from "../adversaire/resolution.js";
import { cle, nomCompare, repertoire } from "./noms.js";
import { TEXTES } from "./recherche.js";

// La liste de la banque que montre chaque catégorie de la consultation
// (js/routes.js). Les types d'adversaires vivent sous « types_adversaires » :
// « types » tout court désigne déjà les types de bloc (§ 4.1).
const LISTES = { blocs: "blocs", capacites: "capacites", elements: "elements", adversaires: "adversaires", types: "types_adversaires" };

// Une banque publiée avant le lot 3 n'a ni adversaires ni types : la
// consultation du reste continue, et les écrans des adversaires le disent.
export const MESSAGE_BANQUE_SANS_ADVERSAIRES = "Les adversaires ont besoin d'une banque republiée depuis le classeur à jour.";

/** Ce qui manque à la banque pour montrer une catégorie, en une phrase, ou null. */
export function manqueDe(banque, categorie) {
  return (categorie === "adversaires" || categorie === "types") && banqueSansAdversaires(banque) ? MESSAGE_BANQUE_SANS_ADVERSAIRES : null;
}

/** Les entrées d'une catégorie ; aucune quand la banque n'a pas cette liste. */
export function entreesDe(banque, categorie) {
  const liste = banque[LISTES[categorie]];
  // Les adversaires et leurs types se lisent comme la résolution les lit :
  // ce qui n'est pas une entrée (banque abîmée) n'entre pas dans la liste.
  if (categorie === "adversaires" || categorie === "types") return entreesLisibles(liste);
  return Array.isArray(liste) ? liste : [];
}

/** Ce que montre la liste d'une catégorie : une entrée par nom, dans l'ordre alphabétique français. */
export function listeDe(banque, categorie) {
  const vus = new Set();
  return entreesDe(banque, categorie)
    .filter((entree) => !vus.has(entree.nom) && vus.add(entree.nom))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}

function ajouter(table, cleTable, valeur) {
  if (!table.has(cleTable)) table.set(cleTable, []);
  if (!table.get(cleTable).includes(valeur)) table.get(cleTable).push(valeur);
}

function parNom(liste, nomDe = (entree) => entree.nom) {
  const table = new Map();
  for (const entree of liste) ajouter(table, nomDe(entree), entree);
  return table;
}

export function indexer(banque) {
  const tables = Object.fromEntries(Object.keys(LISTES).map((categorie) => [categorie, parNom(entreesDe(banque, categorie))]));
  const repertoires = Object.fromEntries(Object.entries(tables).map(([categorie, table]) => [categorie, repertoire(table.keys())]));
  // Les entrées que le contrôle tient pour un doublon (E3, E16) : de même
  // nom une fois les signes invisibles retirés. Une table à part : celles
  // des renvois gardent les noms tels que la banque les écrit.
  const homonymes = Object.fromEntries(Object.keys(LISTES).map((categorie) => [categorie, parNom(entreesDe(banque, categorie), (entree) => nomCompare(entree.nom))]));
  let resolution = null;
  const adversaires = () => (resolution ??= indexerAdversaires(banque));
  // Ce qu'un adversaire porte une fois résolu, pour la recherche : résolu
  // une seule fois, à la première recherche qui le demande.
  const textesResolus = new Map();
  const textesAdversaire = (adversaire) => {
    if (!textesResolus.has(adversaire)) {
      const resolu = adversaires().resoudre(adversaire);
      const portes = [...resolu.types, ...resolu.equipement, ...resolu.maitrises, ...resolu.capacites].map((entree) => entree.nom);
      const pieces = resolu.equipement.flatMap((objet) => (objet.genre === "pack" ? objet.pieces : []));
      textesResolus.set(adversaire, [...TEXTES.adversaires(adversaire), ...portes, ...pieces]);
    }
    return textesResolus.get(adversaire);
  };

  /** Le nom qu'un renvoi désigne dans la catégorie, ou null : renvoi cassé ou ambigu. */
  const resoudre = (categorie, nom) => repertoires[categorie].resoudre(nom).nom ?? null;

  const receveurs = new Map();
  for (const element of banque.elements) {
    for (const recu of element.parametres_recus) if (typeof recu === "string") ajouter(receveurs, cle(recu), element.nom);
  }

  const octroi = new Map();
  const portes = new Map();
  const porter = (element, genre, nom) => {
    if (!portes.has(element)) portes.set(element, { blocs: [], capacites: [] });
    if (!portes.get(element)[genre].includes(nom)) portes.get(element)[genre].push(nom);
  };
  for (const bloc of banque.blocs) {
    for (const capacite of bloc.capacites) {
      const noms = capacite.forme === "simple" ? [capacite.nom] : capacite.forme ? capacite.options : [];
      for (const nom of noms) {
        const trouve = resoudre("capacites", nom);
        const deja = octroi.get(trouve)?.some((o) => o.bloc === bloc.nom && o.forme === capacite.forme);
        if (trouve && !deja) ajouter(octroi, trouve, { bloc: bloc.nom, forme: capacite.forme });
      }
    }
    for (const element of bloc.elements) {
      const trouve = element.nom ? resoudre("elements", element.nom) : null;
      if (trouve) porter(trouve, "blocs", bloc.nom);
    }
    for (const parametre of bloc.parametres) {
      if (parametre.nom) for (const element of receveurs.get(cle(parametre.nom)) ?? []) porter(element, "blocs", bloc.nom);
    }
  }
  for (const capacite of banque.capacites) {
    for (const variante of capacite.variantes) {
      for (const element of variante.elements) {
        const trouve = element.nom ? resoudre("elements", element.nom) : null;
        if (trouve) porter(trouve, "capacites", capacite.nom);
      }
    }
  }

  const lieu = (feuille, ligne) => `${feuille}:${ligne}`;
  const anomaliesParLigne = new Map();
  for (const anomalie of banque.anomalies) if (anomalie.ligne) ajouter(anomaliesParLigne, lieu(anomalie.feuille, anomalie.ligne), anomalie);
  const lignes = new Map();
  for (const bloc of banque.blocs) lignes.set(lieu("Blocs", bloc.brut.ligne), { categorie: "blocs", nom: bloc.nom });
  for (const element of banque.elements) lignes.set(lieu("Eléments", element.brut.ligne), { categorie: "elements", nom: element.nom });
  for (const capacite of banque.capacites) {
    for (const variante of capacite.variantes) lignes.set(lieu("Capacites", variante.brut.ligne), { categorie: "capacites", nom: capacite.nom });
  }
  // La feuille Adversaires porte deux sortes de lignes : un type, un adversaire.
  for (const categorie of ["types", "adversaires"]) {
    for (const entree of entreesDe(banque, categorie)) lignes.set(lieu("Adversaires", entree.brut?.ligne), { categorie, nom: entree.nom });
  }

  return {
    resoudre,
    /**
     * Les entrées de ce nom : plusieurs en cas de doublon (E3 ou E16), que
     * les fiches comptent comme le contrôle. Viennent d'abord celles qui
     * portent le nom tel qu'il est écrit (la première est celle que
     * prennent les renvois exacts), puis celles qui n'en diffèrent que par
     * un signe invisible. Aucune quand rien ne porte ce nom exact : une
     * adresse forgée d'un signe invisible reste une fiche introuvable.
     */
    entrees: (categorie, nom) => {
      const exactes = tables[categorie].get(nom);
      if (!exactes) return [];
      const autres = homonymes[categorie].get(nomCompare(nom)).filter((entree) => entree.nom !== nom);
      return autres.length ? [...exactes, ...autres] : exactes;
    },
    /** L'index de résolution des adversaires (§ 16.2), fait à la première demande, gardé ensuite. */
    adversaires,
    /**
     * Les textes où chercher un adversaire (js/banque/recherche.js) : ce
     * qu'il écrit dans sa ligne, et ce qu'il porte une fois résolu, hérité
     * de ses types ou donné par son équipement (§ 16.6).
     */
    textesAdversaire,
    /** Les blocs qui citent la capacité, avec la forme de la citation. */
    octroyeePar: (capacite) => octroi.get(capacite) ?? [],
    /** Les blocs et les capacités qui portent l'élément. */
    portePar: (element) => portes.get(element) ?? { blocs: [], capacites: [] },
    /** Le nom affiché d'un paramètre : l'élément qui le reçoit, sinon son nom brut (§ 5.2). */
    nomAffiche: (parametre) => receveurs.get(cle(parametre))?.[0] ?? parametre,
    /** Les anomalies d'une ligne d'une feuille. */
    anomaliesDe: (feuille, ligne) => anomaliesParLigne.get(lieu(feuille, ligne)) ?? [],
    /** L'entrée qu'occupe une ligne d'une feuille : { categorie, nom }, ou null. */
    entreeDeLigne: (feuille, ligne) => lignes.get(lieu(feuille, ligne)) ?? null,
  };
}
