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
// Au groupe 3 (mission, § 4.4 à § 4.6 ; contrat de la vague 1, § 5.2 et
// § 7.1 ; conventions 58 et 60) :
// - le coup critique (livret, « Coup critique ») : un jet d'attaque ou de
//   caractéristique d'un personnage qui finit à trois réussites, avec au moins
//   une relance restante, peut tenter un quatrième dé ; la tentative dépense
//   une relance, le 4e dé se relance et explose comme les autres, et la chaîne
//   finit à la 4e place, réussie ou non. Jamais en défense ;
// - l'inversion (livret, « Dé miroir ») : la valeur gardée du dernier dé de la
//   chaîne (le pire, sous désavantage) devient faces + 1 − valeur, puis le
//   modificateur s'ajoute, et le dé se rejuge. Un dé inversé ne se relance
//   plus et ne s'inverse plus ; il peut exploser ; un essai qui a déjà explosé
//   ne s'inverse pas ;
// - la relance de la palette : un essai de plus à la même place, comme une
//   relance d'avantage, mais hors du compte des avantages (« par: palette ») ;
// - « +1 réussite » : un bonus qui s'ajoute aux places réussies, sans jamais
//   passer trois ; il n'ouvre pas le critique, qui se juge sur les places.
// Ce module ne sait rien des d20 : « jamais après le premier d20 » se juge là
// où le geste se lit (l'offre, les effets).
//
// Les mots : une « place » est la position d'un dé dans la chaîne ; un
// « essai », un lancer à cette place (le dé d'origine, puis chaque relance) ;
// les « tirages », les valeurs brutes d'un essai. Le dernier dé de la chaîne
// est le dernier essai de la dernière place.

import { REUSSITES_MAX, geler } from "./regles.js";

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);

// Ce que le jet attend quand c'est un dé, et le motif qu'il en donne.
const MOTIFS = { de: "chaine", de_relance: "relance", de_explosion: "explosion" };

// La place du 4e dé, celui du coup critique.
const PLACE_DU_CRITIQUE = REUSSITES_MAX + 1;

// Les attentes où le dernier dé lancé est posé : ni une relance ni une
// explosion n'attendent leur dé. La palette n'agit qu'à celles-là.
const DERNIER_DE_POSE = ["de", "choix_relance", "choix_explosion", "fini"];

/**
 * Ouvre un jet d'après ses circonstances (qui lance, quel dé, contre quoi,
 * avec quels modificateurs, avantages et désavantages) : elles se figent ici,
 * et rien de ce qui change ensuite ne revient sur un jet commencé.
 *
 * Trois champs du groupe 3 partent vides : « bonus », les réussites de
 * « +1 réussite » ; « critique », null, « garde » ou « tente » ;
 * « relanceParPalette », vrai pendant que le jet attend le dé d'une relance de
 * la palette, qui ne compte pas parmi celles des avantages.
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
    bonus: 0,
    critique: null,
    relanceParPalette: false,
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
 * Les relances de la palette (« par: palette ») n'en sont pas ; la tentative
 * du critique en dépense une.
 */
export function relancesRestantes(jet) {
  const faites = somme(jet.places.map((place) => place.essais.filter((essai) => essai.par !== "palette").length - 1));
  const choisie = jet.attente === "de_relance" && jet.relanceParPalette !== true ? 1 : 0;
  const critique = jet.critique === "tente" ? 1 : 0;
  return Math.max(0, Math.max(0, netDe(jet)) - faites - choisie - critique);
}

/**
 * Le tirage que garde un essai, brut, avant toute inversion : le pire sous
 * désavantage, sinon le seul. Le journal y lit la valeur d'avant l'inversion.
 */
export function tirageGarde(jet, essai) {
  return netDe(jet) < 0 ? Math.min(...essai.tirages) : essai.tirages[0];
}

/**
 * Ce que vaut un essai. Rien de ceci n'est gardé dans le jet.
 * - garde : le tirage retenu, brut (le pire, sous désavantage) ; inversé
 *   (« inverse »), faces + 1 − ce tirage ;
 * - premier : ce tirage, modificateur compris ;
 * - somme : avec ses explosions, brutes (le modificateur ne compte qu'une fois) ;
 * - reussi : la somme égale ou dépasse la difficulté ;
 * - explosible : le dé montre sa face maximale et la somme reste sous la
 *   difficulté. La face montrée est celle de la dernière explosion, sinon le
 *   tirage gardé (inversé s'il l'est).
 */
export function evaluerEssai(jet, essai) {
  const tire = tirageGarde(jet, essai);
  const garde = essai.inverse === true ? jet.faces + 1 - tire : tire;
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
export function reussitesDesPlaces(jet) {
  return jet.places.filter((place) => evaluerEssai(jet, dernierEssai(place)).reussi).length;
}

/** Vrai quand le 4e dé, celui du coup critique, a réussi. */
export function critiqueReussi(jet) {
  return jet.critique === "tente" && jet.places.length >= PLACE_DU_CRITIQUE && evaluerEssai(jet, dernierEssai(jet.places[PLACE_DU_CRITIQUE - 1])).reussi;
}

/**
 * Les réussites du jet : ses places réussies et ses « +1 réussite », jamais
 * plus de trois ; quatre pour un coup critique réussi.
 */
export function reussites(jet) {
  if (critiqueReussi(jet)) return PLACE_DU_CRITIQUE;
  return Math.min(REUSSITES_MAX, reussitesDesPlaces(jet) + (jet.bonus ?? 0));
}

/** Vrai quand la chaîne est finie : trois réussites, un échec gardé, ou un échec sans relance. */
export function jetFini(jet) {
  return jet.attente === "fini";
}

/**
 * Le dé que le jet attend, ou null s'il attend un choix ou s'il est fini.
 * « combien » vaut k + 1 pour un dé de la chaîne sous k désavantages nets ;
 * une relance et une explosion se lancent une seule fois. « place » va de 1
 * à 3, et à 4 pour le dé du critique.
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

// La chaîne s'arrête sur une réussite à trois réussites ; pendant la
// tentative du critique, à la 4e place, réussie ou non.
const chaineFinie = (jet) => (jet.critique === "tente" ? jet.places.length >= PLACE_DU_CRITIQUE : reussites(jet) >= REUSSITES_MAX);

// Après un dé : ce que le dernier essai de la dernière place fait attendre.
// Un dé inversé qui échoue ne se relance pas : la chaîne s'arrête.
function attenteApres(jet) {
  const dernier = dernierEssai(jet.places[jet.places.length - 1]);
  const essai = evaluerEssai(jet, dernier);
  if (essai.explosible) return "choix_explosion";
  if (essai.reussi) return chaineFinie(jet) ? "fini" : "de";
  return relancesRestantes(jet) > 0 && dernier.inverse !== true ? "choix_relance" : "fini";
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
      // La relance de la palette se marque : elle ne compte pas parmi celles
      // des avantages.
      essais.push(jet.relanceParPalette === true ? { tirages: [...valeurs], explosions: [], par: "palette" } : { tirages: [...valeurs], explosions: [] });
    } else {
      // L'explosion garde ce que l'essai porte (« inverse », « par »).
      const essai = essais[essais.length - 1];
      essais[essais.length - 1] = { ...essai, explosions: [...essai.explosions, valeurs[0]] };
    }
    places[places.length - 1] = { essais };
  }
  // L'attente d'après se lit sur le jet tel qu'il sera : la relance en cours
  // n'y est plus « choisie », elle est faite.
  const lance = { ...jet, attente: "de", places, relanceParPalette: false };
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

// ─── Le coup critique ───────────────────────────────────────────────────────

/**
 * Vrai quand le critique s'offre (livret, « Coup critique » ; convention 6) :
 * le jet d'un personnage (« camp », celui du lanceur) est fini, c'est une
 * attaque (le PJ attaque) ou un jet de caractéristique, jamais une défense ;
 * ses places comptent trois réussites (« +1 réussite » n'y entre pas) ; le
 * critique n'est ni gardé ni tenté ; il reste au moins une relance.
 */
export function critiqueOffert(jet, camp = "pj") {
  return (
    camp === "pj" &&
    jetFini(jet) &&
    (jet.genre === "attaque" || jet.genre === "caracteristique") &&
    reussitesDesPlaces(jet) === REUSSITES_MAX &&
    (jet.critique ?? null) === null &&
    relancesRestantes(jet) >= 1
  );
}

/**
 * « Tenter le critique » : une relance se dépense, et le jet attend le 4e dé.
 * La chaîne suit ensuite ses règles (relances restantes, explosion) et finit
 * à la 4e place.
 */
export function tenterLeCritique(jet) {
  if (!critiqueOffert(jet)) return horsMoment("Le critique ne se tente pas à cet instant.");
  return { jet: geler({ ...jet, critique: "tente", attente: "de" }) };
}

/** « Garder » : le jet reste à trois réussites, et le critique ne s'offre plus. */
export function garderLeCritique(jet) {
  if (!critiqueOffert(jet)) return horsMoment("Aucun critique n'est à garder à cet instant.");
  return { jet: geler({ ...jet, critique: "garde" }) };
}

// ─── La palette : inverser, relancer, +1 réussite ───────────────────────────

// Le dernier dé de la chaîne, s'il est posé : null avant le premier dé, ou
// quand une relance ou une explosion attend son dé.
function dernierDePose(jet) {
  if (jet.places.length === 0 || !DERNIER_DE_POSE.includes(jet.attente)) return null;
  return dernierEssai(jet.places[jet.places.length - 1]);
}

/** Vrai quand le dernier dé de la chaîne s'inverse : posé, ni inversé, ni explosé. */
export function inversable(jet) {
  const essai = dernierDePose(jet);
  return essai !== null && essai.inverse !== true && essai.explosions.length === 0;
}

/** Vrai quand le dernier dé de la chaîne se relance par la palette : posé, et pas inversé. */
export function relancable(jet) {
  const essai = dernierDePose(jet);
  return essai !== null && essai.inverse !== true;
}

/** Vrai quand la palette peut relancer ou inverser le dernier dé. */
export function dernierDeOffert(jet) {
  return inversable(jet) || relancable(jet);
}

/**
 * Inverse le dernier dé de la chaîne (livret, « Dé miroir ») : sa valeur
 * gardée devient faces + 1 − valeur, le modificateur s'y ajoute, et il se
 * rejuge. L'attente se recalcule : un échec devenu réussite poursuit la
 * chaîne (ou la finit), une face maximale sous la difficulté peut exploser,
 * une réussite devenue échec finit la chaîne.
 */
export function inverserDernier(jet) {
  if (!inversable(jet)) return horsMoment("Ce dé ne s'inverse pas.");
  const places = [...jet.places];
  const essais = [...places[places.length - 1].essais];
  essais[essais.length - 1] = { ...essais[essais.length - 1], inverse: true };
  places[places.length - 1] = { essais };
  const inverse = { ...jet, attente: "de", places };
  return { jet: geler({ ...inverse, attente: attenteApres(inverse) }) };
}

/**
 * Relance le dernier dé de la chaîne par la palette : le jet attend le dé de
 * la relance, qui se lance comme celle d'un avantage, sans en dépenser.
 */
export function relancerParPalette(jet) {
  if (!relancable(jet)) return horsMoment("Ce dé ne se relance pas.");
  return { jet: geler({ ...jet, attente: "de_relance", relanceParPalette: true }) };
}

/** « +1 réussite » : sur un jet fini qui compte moins de trois réussites. */
export function ajouterReussite(jet) {
  if (!jetFini(jet)) return horsMoment("Le jet n'est pas fini.");
  if (reussites(jet) >= REUSSITES_MAX) return horsMoment("Le jet compte déjà trois réussites.");
  return { jet: geler({ ...jet, bonus: (jet.bonus ?? 0) + 1 }) };
}
