// La maîtrise d'un objet, telle que le créateur la montre à l'étape 7
// (SPECIFICATION.md, § 15.3) : le poids d'une arme, les capacités qu'elle
// donne sous un désavantage, son état de maîtrise, celui d'un pack, et la
// ligne des maîtrises du personnage.
//
// Aucune règle neuve : les rangs, les positions et le désavantage sont ceux
// du simulateur de combat (rangsDeMaitrise, positionDans et horsMaitrise de
// js/adversaire/resolution.js), appliqués au personnage comme le fait
// js/combat/photographie.js : les rangs viennent des capacités de Maîtrise
// de sa fiche, à leur niveau, que le personnage tient d'une source qui les
// donne au combat (donneAuCombat de calcul.js : une Maîtrise que seule une
// arme rangée au sac, ou une armure non portée, donnerait ne compte pas) ;
// une capacité se joue avec un désavantage
// quand le rang de maîtrise d'un poids de l'objet n'atteint pas sa position
// dans le bloc. Un objet à deux poids demande les deux maîtrises, comme au
// combat. La maîtrise d'un pack, elle, n'est qu'une convention d'affichage,
// sans effet sur les jets (§ 12) : la Maîtrise de son poids, au niveau 1 au
// moins.
//
// Les mains nues sont « Toujours permis » : c'est l'écran qui le dit, sans
// rien demander ici.

import { horsMaitrise, maitriseDe, positionDans, rangsDeMaitrise } from "../adversaire/resolution.js";
import { cle } from "../banque/noms.js";
import { capacitesDuBloc, donneAuCombat, typesDuBloc } from "./calcul.js";
import { TYPES_OBJET } from "./regles.js";

// La phrase qui suit la liste des maîtrises, quelle qu'elle soit.
const PERMIS = "Une arme ou un pack d'un autre type n'est pas maîtrisé : il reste permis.";

// L'initiale d'un nom qui appelle « d' » : une voyelle, accentuée ou non
// (l'accent se défait en marque, après la lettre).
const VOYELLE = /^[aeiouyæœ]/u;

const lesRangs = (rangs) => (rangs instanceof Map ? rangs : new Map());

/** Les poids d'un objet, d'après ses éléments, rangés lourde, agile, precise : aucun, un, ou deux et plus. */
export function poidsDe(bloc) {
  return Array.isArray(bloc?.elements) ? typesDuBloc(bloc) : [];
}

/**
 * Les capacités de la fiche que le personnage tient au combat : celles dont
 * une source au moins les donne (donneAuCombat), hors celles à venir, comme
 * les maîtrises possédées de la photographie.
 */
function tenuesAuCombat(fiche, index) {
  return (fiche?.capacites ?? []).filter((c) => !c.aVenir && (c.sources ?? []).some((source) => donneAuCombat(index, fiche, source)));
}

/**
 * Les capacités de Maîtrise du personnage, à leur niveau : des { nom,
 * niveau }, dans l'ordre de sa fiche (calculerFiche), celles qu'il tient
 * au combat seulement. index : celui de la banque (indexerCreation), qui
 * dit quelles capacités sont des maîtrises.
 */
export function maitrisesDuPersonnage(fiche, index) {
  return tenuesAuCombat(fiche, index)
    .filter((c) => {
      const capacite = index.capacite(c.nom);
      return Boolean(capacite) && maitriseDe(capacite) !== null;
    })
    .map((c) => ({ nom: c.nom, niveau: Number.isInteger(c.niveau) ? c.niveau : 0 }));
}

/**
 * Le rang de maîtrise de chaque poids : Map(lourde | agile | precise →
 * rang), la forme qu'attend horsMaitrise. Une maîtrise dont le nom ne dit
 * pas son poids ne compte pour aucun (rangsDeMaitrise) ; une maîtrise que
 * le personnage ne tient pas au combat, pour aucun non plus.
 */
export function rangsDuPersonnage(fiche, index) {
  const possedees = tenuesAuCombat(fiche, index).map((c) => ({ capacite: index.capacite(c.nom), rang: c.niveau }));
  return rangsDeMaitrise(possedees);
}

/**
 * Les capacités qu'un objet donne avec ces options choisies, chacune avec sa
 * position dans le bloc : des { nom, position }. La position se lit comme au
 * combat (positionDans) : une entrée simple par son nom, un groupe par ses
 * options choisies ; null si aucune entrée ne la donne.
 */
export function capacitesDeLObjet(index, bloc, choix = []) {
  if (!Array.isArray(bloc?.capacites)) return [];
  const nomResolu = (nom) => index.capacite(nom)?.nom ?? nom;
  const choisies = new Set((choix ?? []).map(cle));
  return capacitesDuBloc(bloc, choix).capacites.map(({ nom }) => {
    const vise = nomResolu(nom);
    const position = positionDans(bloc, (entree) => {
      if (entree?.forme === "simple") return nomResolu(entree.nom) === vise;
      return Array.isArray(entree?.options) && entree.options.some((option) => choisies.has(cle(option)) && nomResolu(option) === vise);
    });
    return { nom, position };
  });
}

/**
 * L'état de maîtrise d'un objet : { etat, n, k, horsMaitrise }. capacites :
 * les capacités montrées, chacune { position } (capacitesDeLObjet), ou sa
 * position seule ; poids : poidsDe(bloc) ; rangs : rangsDuPersonnage.
 * horsMaitrise dit, capacité par capacité, si elle se joue avec un
 * désavantage ; n compte les capacités montrées, k celles que la maîtrise
 * couvre. etat : « sans » pour un objet sans poids ; sinon « maitrise » si
 * k = n, « non » si k = 0, « partielle » entre les deux.
 */
export function maitriseDeLObjet(capacites, poids, rangs) {
  const codes = Array.isArray(poids) ? poids : [];
  // Ce que horsMaitrise lit d'un bloc : les éléments de ses poids.
  const porteur = { elements: codes.map((code) => ({ nom: TYPES_OBJET[code]?.element ?? null })) };
  const liste = Array.isArray(capacites) ? capacites : [];
  const hors = liste.map((capacite) => horsMaitrise(porteur, capacite !== null && typeof capacite === "object" ? capacite.position : capacite, lesRangs(rangs)));
  const n = hors.length;
  const k = hors.filter((h) => !h).length;
  let etat;
  if (codes.length === 0) etat = "sans";
  else if (k === n) etat = "maitrise";
  else if (k === 0) etat = "non";
  else etat = "partielle";
  return { etat, n, k, horsMaitrise: hors };
}

/** La maîtrise d'un pack, pour l'affichage seulement : « maitrise » avec la Maîtrise de son poids au niveau 1 au moins, « non » sinon. */
export function maitriseDuPack(poids, rangs) {
  return (lesRangs(rangs).get(poids) ?? 0) >= 1 ? "maitrise" : "non";
}

/**
 * La ligne des maîtrises, en tête de l'étape 7 : « Maîtrises d'Aubépine :
 * Maîtrise de l'agile [1]. » puis la phrase qui dit qu'un autre type reste
 * permis. « d' » devant une voyelle, accentuée ou non, « de » sinon ;
 * « aucune » sans maîtrise. maitrises : des { nom, niveau }
 * (maitrisesDuPersonnage).
 */
export function ligneDesMaitrises(nom, maitrises) {
  const ecrit = String(nom ?? "").trim();
  let de;
  if (!ecrit) de = "du personnage";
  else de = VOYELLE.test(ecrit.normalize("NFD").toLowerCase()) ? `d'${ecrit}` : `de ${ecrit}`;
  const liste = Array.isArray(maitrises) && maitrises.length ? maitrises.map((m) => `${m.nom} [${Number.isInteger(m.niveau) ? m.niveau : 0}]`).join(", ") : "aucune";
  return `Maîtrises ${de} : ${liste}. ${PERMIS}`;
}
