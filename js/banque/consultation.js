// Ce que les fiches affichent (SPECIFICATION.md, § 5.2 et § 9).
//
// Un index de la banque, calculé une fois : les renvois résolus comme le
// contrôle les résout (exactement, puis sans casse, accents ni espaces,
// § 6.3), « octroyée par » pour une capacité, « porté par » pour un élément,
// le nom affiché d'un paramètre (§ 5.2), et les anomalies de chaque ligne.
// Il reprend les définitions du contrôle, et n'en ajoute aucune : une
// capacité est octroyée par les blocs qui la citent dans leur colonne des
// capacités (A3) ; un élément est porté par les blocs et les capacités qui le
// citent, et par les blocs qui transmettent un paramètre qu'il reçoit (A4).

import { cle, repertoire } from "./noms.js";

function ajouter(table, cleTable, valeur) {
  if (!table.has(cleTable)) table.set(cleTable, []);
  if (!table.get(cleTable).includes(valeur)) table.get(cleTable).push(valeur);
}

function parNom(liste) {
  const table = new Map();
  for (const entree of liste) ajouter(table, entree.nom, entree);
  return table;
}

export function indexer(banque) {
  const tables = { blocs: parNom(banque.blocs), capacites: parNom(banque.capacites), elements: parNom(banque.elements) };
  const repertoires = Object.fromEntries(Object.entries(tables).map(([categorie, table]) => [categorie, repertoire(table.keys())]));

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

  return {
    resoudre,
    /** Les entrées de ce nom exact (plusieurs en cas de doublon, E3). */
    entrees: (categorie, nom) => tables[categorie].get(nom) ?? [],
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
