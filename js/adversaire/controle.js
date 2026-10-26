// Le contrôle de la feuille « Adversaires » (SPECIFICATION.md, § 6.3 et § 16).
//
// Il ne lit rien lui-même : il résout chaque adversaire avec le module de
// la page (resolution.js) et range ses constats en anomalies. Ce que le
// rapport annonce est donc ce que l'écran montrera. Il y ajoute ce qui ne
// se voit qu'entre les lignes : deux classes ou deux adversaires de même nom
// (E16), une classe et un adversaire de même nom (A16), une classe que rien
// n'utilise (I5). L'import, lui, relève la feuille absente (I4), les lignes
// sans nom (E2) et les espaces de bord (I1).
//
// Un constat d'une classe se range à la ligne de la classe, une seule fois, même
// quand dix adversaires en héritent ; ce qui ne se voit qu'une fois
// l'héritage appliqué (E12, E15, A12, A15) se range à la ligne de
// l'adversaire.
//
// « De même nom » (E16, A16) s'entend comme pour E3 : exactement, une fois
// les signes invisibles retirés (js/banque/noms.js). Le message cite le nom
// tel qu'il est écrit.

import { nomCompare } from "../banque/noms.js";
import { citer } from "./notation.js";
import { FEUILLE, entreesLisibles, indexerAdversaires } from "./resolution.js";

/** Les constats de la feuille Adversaires d'une banque : [{ code, ligne, message }]. */
export function constatsDesAdversaires(banque) {
  const types = entreesLisibles(banque.types_adversaires);
  const adversaires = entreesLisibles(banque.adversaires);
  if (!types.length && !adversaires.length) return [];
  const index = indexerAdversaires(banque);
  const constats = [];
  // Une boucle, et non un étalement en arguments : une liste forgée de plus
  // de cent mille constats ferait déborder la pile d'appels.
  const garder = (liste) => {
    for (const constat of liste) if (constat.code) constats.push(constat);
  };
  const ligneDe = (entree) => entree.brut?.ligne ?? null;

  const typesVus = new Map();
  for (const type of types) {
    const premier = typesVus.get(nomCompare(type.nom));
    if (premier) constats.push({ code: "E16", ligne: ligneDe(type), message: `La classe « ${citer(type.nom)} » est déjà définie ligne ${ligneDe(premier)}.` });
    else typesVus.set(nomCompare(type.nom), type);
    garder(index.analyser(type, "type").constats);
    if (!premier && index.utilisateurs(type.nom).length === 0) {
      constats.push({ code: "I5", ligne: ligneDe(type), message: `La classe « ${citer(type.nom)} » n'est utilisée par aucun adversaire.` });
    }
  }

  const adversairesVus = new Map();
  for (const adversaire of adversaires) {
    const premier = adversairesVus.get(nomCompare(adversaire.nom));
    if (premier) constats.push({ code: "E16", ligne: ligneDe(adversaire), message: `L'adversaire « ${citer(adversaire.nom)} » est déjà défini ligne ${ligneDe(premier)}.` });
    else adversairesVus.set(nomCompare(adversaire.nom), adversaire);
    const homonyme = typesVus.get(nomCompare(adversaire.nom));
    if (homonyme) {
      constats.push({ code: "A16", ligne: ligneDe(adversaire), message: `L'adversaire « ${citer(adversaire.nom)} » porte le nom d'une classe, définie ligne ${ligneDe(homonyme)}.` });
    }
    garder(index.analyser(adversaire, "adversaire").constats);
    garder(index.resoudre(adversaire).constatsDeResolution);
  }
  return constats;
}

export { FEUILLE };
