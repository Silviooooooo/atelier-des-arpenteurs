// La chaîne d'un jet : les réussites, l'avantage, le désavantage et le dé
// explosif (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) »).
//
// Tout jet du combat (attaque, défense, caractéristique) suit la même chaîne
// (livret, « Jets ») : un dé réussi fait lancer le suivant, jusqu'à trois
// réussites, et le premier échec l'arrête. Ce module tient cette chaîne et
// rien d'autre : il ne sait ni qui lance, ni pourquoi, ni ce que valent les
// réussites. Il existe pour que le moteur, le journal et l'écran lisent les
// mêmes totaux : aucun n'est gardé, tous se recalculent ici (evaluerEssai).
//
// Il ne tire aucun dé : chaque valeur brute lui est donnée, et le même jet
// rejoué avec les mêmes valeurs repasse par les mêmes attentes.
//
// Trois conventions provisoires s'y appliquent (§ 12, « Pour le lot 4 ») :
// - le désavantage pèse sur chaque dé de la chaîne : avec k désavantages
//   nets, chaque dé se lance k + 1 fois et l'on garde le pire ;
// - l'avantage donne k relances pour tout le jet : un dé qui échoue se
//   relance ou se garde, au choix du joueur, et la relance le remplace ;
// - le dé explosif : la face maximale s'entend modificateurs compris, le
//   modificateur ne compte qu'une fois, et le dé explose tant qu'il montre sa
//   face maximale et que la somme reste sous la difficulté. Sous désavantage,
//   seul le dé gardé explose.
//
// Les mots : une « place » est la position d'un dé dans la chaîne ; un
// « essai », un lancer à cette place (le dé d'origine, puis chaque relance) ;
// les « tirages », les valeurs brutes d'un essai.

import { REUSSITES_MAX, geler } from "./regles.js";

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);

// Ce que le jet attend quand c'est un dé, et le motif qu'il en donne.
const MOTIFS = { de: "chaine", de_relance: "relance", de_explosion: "explosion" };

/**
 * Ouvre un jet d'après ses circonstances (qui lance, quel dé, contre quoi,
 * avec quels modificateurs, avantages et désavantages) : elles se figent ici,
 * et rien de ce qui change ensuite ne revient sur un jet commencé.
 */
export function ouvrirJet(circonstances) {
  const { genre, lanceur, faces, caracteristiques, mobilisees, difficulte, libelle, modificateurs, avantages, desavantages } = circonstances;
  return geler({
    genre,
    lanceur,
    faces,
    caracteristiques: caracteristiques ? [...caracteristiques] : null,
    mobilisees: [...(mobilisees ?? [])],
    difficulte,
    libelle: libelle ?? null,
    modificateurs: (modificateurs ?? []).map((modificateur) => ({ ...modificateur })),
    avantages: (avantages ?? []).map((avantage) => ({ ...avantage })),
    desavantages: (desavantages ?? []).map((desavantage) => ({ ...desavantage })),
    attente: "de",
    places: [],
  });
}

/** La somme des modificateurs : elle s'ajoute à chaque dé de la chaîne. */
export function modificateurDe(jet) {
  return somme(jet.modificateurs.map((modificateur) => modificateur.valeur));
}

/**
 * Le compte net : les avantages moins les désavantages (livret, « Avantage
 * et désavantage » : ils s'annulent, seule la différence reste). Positif,
 * ce sont des relances ; négatif, des lancers de plus à chaque dé.
 */
export function netDe(jet) {
  return somme(jet.avantages.map((avantage) => avantage.nombre)) - somme(jet.desavantages.map((desavantage) => desavantage.nombre));
}

/**
 * Les relances qui restent au joueur. Une relance est dépensée dès qu'elle
 * est choisie : pendant que le jet attend son dé, elle ne compte déjà plus.
 */
export function relancesRestantes(jet) {
  const faites = somme(jet.places.map((place) => place.essais.length - 1));
  const choisie = jet.attente === "de_relance" ? 1 : 0;
  return Math.max(0, Math.max(0, netDe(jet)) - faites - choisie);
}

/**
 * Ce que vaut un essai. Rien de ceci n'est gardé dans le jet.
 * - garde : le tirage retenu, brut (le pire, sous désavantage) ;
 * - premier : ce tirage, modificateur compris ;
 * - somme : avec ses explosions, brutes (le modificateur ne compte qu'une fois) ;
 * - reussi : la somme égale ou dépasse la difficulté ;
 * - explosible : le dé montre sa face maximale et la somme reste sous la
 *   difficulté. La face montrée est celle de la dernière explosion, sinon le
 *   tirage gardé.
 */
export function evaluerEssai(jet, essai) {
  const garde = netDe(jet) < 0 ? Math.min(...essai.tirages) : essai.tirages[0];
  const premier = garde + modificateurDe(jet);
  const total = premier + somme(essai.explosions);
  const montree = essai.explosions.length > 0 ? essai.explosions[essai.explosions.length - 1] : garde;
  return {
    garde,
    premier,
    somme: total,
    reussi: total >= jet.difficulte,
    explosible: montree === jet.faces && total < jet.difficulte,
  };
}

const dernierEssai = (place) => place.essais[place.essais.length - 1];

/** Le nombre de places réussies : une place vaut par son dernier essai. */
export function reussites(jet) {
  return jet.places.filter((place) => evaluerEssai(jet, dernierEssai(place)).reussi).length;
}

/** Vrai quand la chaîne est finie : trois réussites, un échec gardé, ou un échec sans relance. */
export function jetFini(jet) {
  return jet.attente === "fini";
}

/**
 * Le dé que le jet attend, ou null s'il attend un choix ou s'il est fini.
 * « combien » vaut k + 1 pour un dé de la chaîne sous k désavantages nets ;
 * une relance et une explosion se lancent une seule fois. « place » va de 1
 * à 3.
 */
export function deAttendu(jet) {
  const motif = MOTIFS[jet.attente];
  if (!motif) return null;
  const nouvelle = jet.attente === "de";
  return {
    faces: jet.faces,
    combien: nouvelle ? 1 + Math.max(0, -netDe(jet)) : 1,
    motif,
    place: jet.places.length + (nouvelle ? 1 : 0),
  };
}

/**
 * Les choix offerts au joueur. Quand un dé peut exploser, « exploser » est la
 * seule suite : la relance ne se propose qu'à un dé qui a fini d'exploser.
 */
export function choixDuJet(jet) {
  if (jet.attente === "choix_explosion") return ["exploser"];
  if (jet.attente === "choix_relance") return ["relancer", "garder"];
  return [];
}

const refuser = (code, message) => ({ refus: { code, message } });
const horsMoment = (message) => refuser("hors_moment", message);

// Après un dé : ce que le dernier essai de la dernière place fait attendre.
function attenteApres(jet) {
  const essai = evaluerEssai(jet, dernierEssai(jet.places[jet.places.length - 1]));
  if (essai.explosible) return "choix_explosion";
  if (essai.reussi) return reussites(jet) >= REUSSITES_MAX ? "fini" : "de";
  return relancesRestantes(jet) > 0 ? "choix_relance" : "fini";
}

/**
 * Donne ses valeurs brutes au dé attendu : un dé de plus dans la chaîne (une
 * valeur, ou k + 1 sous k désavantages), le dé d'une relance, ou celui d'une
 * explosion. Refuse, sans rien changer, hors d'une attente de dé, ou si les
 * valeurs ne sont pas celles d'un tel dé.
 */
export function lancerDe(jet, valeurs) {
  const attendu = deAttendu(jet);
  if (!attendu) return horsMoment("Ce jet n'attend pas de dé.");
  const { faces, combien } = attendu;
  const valides =
    Array.isArray(valeurs) && valeurs.length === combien && valeurs.every((valeur) => Number.isSafeInteger(valeur) && valeur >= 1 && valeur <= faces);
  if (!valides) {
    return refuser("hors_bornes", `Ce dé attend ${combien === 1 ? "une valeur" : `${combien} valeurs`} de 1 à ${faces}.`);
  }

  const places = [...jet.places];
  if (jet.attente === "de") {
    places.push({ essais: [{ tirages: [...valeurs], explosions: [] }] });
  } else {
    const place = places[places.length - 1];
    const essais = [...place.essais];
    if (jet.attente === "de_relance") {
      essais.push({ tirages: [...valeurs], explosions: [] });
    } else {
      const essai = essais[essais.length - 1];
      essais[essais.length - 1] = { tirages: essai.tirages, explosions: [...essai.explosions, valeurs[0]] };
    }
    places[places.length - 1] = { essais };
  }
  // L'attente d'après se lit sur le jet tel qu'il sera : la relance en cours
  // n'y est plus « choisie », elle est faite.
  const lance = { ...jet, attente: "de", places };
  return { jet: geler({ ...lance, attente: attenteApres(lance) }) };
}

/** Dépense une relance sur le dé qui vient d'échouer : le jet attend le dé de la relance. */
export function relancer(jet) {
  if (jet.attente !== "choix_relance") return horsMoment("Aucun dé ne se relance à cet instant.");
  return { jet: geler({ ...jet, attente: "de_relance" }) };
}

/** Garde le dé qui vient d'échouer : la chaîne s'arrête là. */
export function garder(jet) {
  if (jet.attente !== "choix_relance") return horsMoment("Aucun dé n'est à garder à cet instant.");
  return { jet: geler({ ...jet, attente: "fini" }) };
}

/** Fait exploser le dé : le jet attend un lancer de plus du même dé. */
export function exploser(jet) {
  if (jet.attente !== "choix_explosion") return horsMoment("Aucun dé n'explose à cet instant.");
  return { jet: geler({ ...jet, attente: "de_explosion" }) };
}
