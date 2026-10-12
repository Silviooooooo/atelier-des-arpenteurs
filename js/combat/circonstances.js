// Les circonstances d'un jet : qui lance, quel dé, contre quoi, avec quels
// modificateurs, quels avantages et quels désavantages, chacun avec sa source
// (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) »).
//
// Ce module existe pour qu'un jet n'ait qu'un calcul : circonstances() sert
// deux fois, à l'aperçu d'avant le premier dé, puis au paiement, où son
// résultat se fige dans le jet. Ce que le joueur a lu avant de lancer est
// donc ce qui s'applique, et rien de ce qui change ensuite ne revient sur un
// jet commencé. Les passifs câblés de la fiche (passifsDe) lisent les mêmes
// tables : une fiche ne peut pas dire « actif » ce que le jet n'applique pas.
//
// Ce qu'il applique (livret, « Avantage et désavantage », « Asymétrie des
// rôles lors des combats », « Ressources » ; § 17 pour les passifs câblés) :
// - seuls les joueurs lancent des dés : quand un adversaire attaque, c'est le
//   PJ visé qui lance sa défense, contre l'attaque de l'adversaire ;
// - le N d'un passif câblé est le niveau de cette capacité chez le PJ, son
//   rang chez l'adversaire ; le niveau du personnage n'entre nulle part.
//
// Et les conventions provisoires (§ 12, « Pour le lot 4 ») :
// - l'inversion : un avantage d'un adversaire devient un désavantage du PJ
//   dans le même jet, et inversement ; la source garde alors le nom de
//   l'adversaire ;
// - le corps-à-corps : l'attaquant et la cible sur la même case ;
// - un allié : un vivant du même camp, autre que soi ;
// - les bonus et malus +N d'un passif ne s'appliquent pas à un adversaire, et
//   ses blessures n'ont pas d'effet calculé ;
// - des types d'armure mêlés donnent 1 désavantage en défense ;
// - un jet prêté ne porte pas le désavantage de maîtrise, ni pour qui le
//   lance, ni par inversion.
//
// L'ordre des modificateurs et celui des sources sont écrits ici, dans des
// tableaux : le journal les cite dans cet ordre, mot pour mot, et aucun ne
// doit dépendre du parcours d'un objet.

import { deDuJet } from "../personnage/regles.js";
import { distance } from "./plateau.js";
import { DIFFICULTES, SIGNES } from "./regles.js";
import { alliesSurLaCase, attaqueDe, blessuresDe, campDe, capaciteDe, courantDe, defenseDe, faconDe, photoDe } from "./valeurs.js";

const manque = (phrase) => ({ manque: phrase });
const CHOISIR_UNE_CIBLE = "Choisissez une cible.";

// Les passifs d'un protagoniste qui portent un rôle, dans l'ordre de sa
// photographie, chacun avec le nom que la banque donne à sa capacité.
function passifsDuRole(etat, id, role) {
  const passifs = photoDe(etat, id)?.passifs ?? [];
  return passifs.filter((passif) => passif.role === role).map(({ capacite, niveau }) => ({ nom: capaciteDe(etat, id, capacite)?.nom ?? null, niveau }));
}

// ─── Les modificateurs ──────────────────────────────────────────────────────

// Les bonus et malus câblés, dans l'ordre où ils entrent dans le jet. Le
// passif « petit » y est deux fois : son bonus de défense, puis son malus de
// Force, qui ne dépend pas de son niveau.
const BONUS = [
  { role: "bonus_force", quand: ({ mobilisees }) => mobilisees.includes("force"), valeur: (niveau) => niveau },
  { role: "bonus_agilite", quand: ({ mobilisees }) => mobilisees.includes("agilite"), valeur: (niveau) => niveau },
  { role: "bonus_precision", quand: ({ mobilisees }) => mobilisees.includes("precision"), valeur: (niveau) => niveau },
  { role: "petit", quand: ({ genre }) => genre === "defense", valeur: (niveau) => niveau },
  { role: "petit", quand: ({ mobilisees }) => mobilisees.includes("force"), valeur: () => -1 },
];

/**
 * Ce qui s'ajoute à chaque dé d'un jet que lance ce protagoniste, hors de
 * tout réglage à la main : ses bonus câblés, puis ses blessures (−1 par zone
 * dont la résistance est à 0). « genre » est celui du jet (« attaque »,
 * « defense », « caracteristique ») ; « mobilisees », les caractéristiques
 * qui font son dé. Un nombre nul n'entre pas dans la liste.
 *
 * Rien pour un adversaire : il ne lance aucun dé, et ni ses bonus ni ses
 * blessures ne s'appliquent.
 */
export function modificateursDe(etat, id, { genre = null, mobilisees = [] } = {}) {
  if (campDe(etat, id) !== "pj") return [];
  const jet = { genre, mobilisees: mobilisees ?? [] };
  const liste = [];
  for (const { role, quand, valeur } of BONUS) {
    if (!quand(jet)) continue;
    for (const { nom, niveau } of passifsDuRole(etat, id, role)) {
      const nombre = valeur(niveau);
      if (nombre !== 0) liste.push({ genre: "passif", nom, valeur: nombre });
    }
  }
  const blessures = blessuresDe(etat, id);
  if (blessures > 0) liste.push({ genre: "blessures", nom: null, valeur: -blessures });
  return liste;
}

function modificateurALaMain(geste) {
  const reglage = geste.reglages?.modificateur ?? null;
  return reglage && reglage.valeur !== 0 ? [{ genre: "main", nom: reglage.raison, valeur: reglage.valeur }] : [];
}

// ─── Les avantages et les désavantages ──────────────────────────────────────

// Les trois passifs qui donnent N avantages, dans l'ordre où ils entrent dans
// le jet, et ce que chacun demande :
// - seul : vrai, aucun allié vivant sur la case de son porteur ; faux, au
//   moins un ;
// - sens : le jet où il vaut, vu de son porteur (« attaque » quand il
//   attaque, « defense » quand il se défend) ; null pour les deux ;
// - corpsACorps : l'attaquant et la cible sont sur la même case.
const AVANTAGES = [
  { role: "seul_sur_sa_case", seul: true, sens: null, corpsACorps: true },
  { role: "en_meute", seul: false, sens: "attaque", corpsACorps: false },
  { role: "esprit_de_corps", seul: false, sens: "defense", corpsACorps: false },
];

// Les avantages qu'un protagoniste tire de ses passifs dans ce jet. Pour
// l'adversaire, ce sont eux que l'inversion change en désavantages du PJ.
function avantagesDesPassifs(etat, id, { sens, corpsACorps }) {
  const accompagne = alliesSurLaCase(etat, id).length > 0;
  const sources = [];
  for (const regle of AVANTAGES) {
    if (regle.seul === accompagne) continue;
    if (regle.sens !== null && regle.sens !== sens) continue;
    if (regle.corpsACorps && !corpsACorps) continue;
    for (const { nom, niveau } of passifsDuRole(etat, id, regle.role)) {
      if (niveau > 0) sources.push({ genre: "passif", nom, nombre: niveau });
    }
  }
  return sources;
}

const nomCourt = (etat, id) => etat.noms?.[id]?.court ?? photoDe(etat, id)?.nom ?? null;

/**
 * Les avantages et les désavantages d'un jet d'attaque ou de défense, chacun
 * avec sa source, dans l'ordre écrit : ceux du lanceur (ses passifs, sa
 * maîtrise, ses types d'armure mêlés), ceux de l'autre, inversés, puis la
 * main.
 * - lanceur : le PJ qui lance ; autre : l'adversaire qu'il vise, ou qui
 *   l'attaque ;
 * - genre : « attaque » quand le PJ attaque, « defense » quand il se défend.
 */
function sourcesDuJet(etat, geste, { genre, lanceur, autre }) {
  const avantages = [];
  const desavantages = [];
  const corpsACorps = distance(courantDe(etat, lanceur).case, courantDe(etat, autre).case) === 0;
  // Le désavantage de maîtrise ne vaut que pour une attaque jouée pour
  // elle-même : un jet prêté ne le porte pas.
  const horsMaitrise = geste.mode === "attaque" && faconDe(etat, geste)?.desavantage === true;
  const jouee = capaciteDe(etat, geste.acteur, geste.capacite)?.nom ?? null;
  const deLAutre = nomCourt(etat, autre);

  for (const source of avantagesDesPassifs(etat, lanceur, { sens: genre, corpsACorps })) avantages.push({ ...source, de: null });
  if (genre === "attaque" && horsMaitrise) desavantages.push({ genre: "maitrise", nom: jouee, nombre: 1, de: null });
  if (genre === "defense" && photoDe(etat, lanceur)?.deDefense?.meles === true) desavantages.push({ genre: "armure_melee", nom: null, nombre: 1, de: null });

  const sensDeLAutre = genre === "attaque" ? "defense" : "attaque";
  for (const source of avantagesDesPassifs(etat, autre, { sens: sensDeLAutre, corpsACorps })) desavantages.push({ ...source, de: deLAutre });
  if (genre === "defense" && horsMaitrise) avantages.push({ genre: "maitrise", nom: jouee, nombre: 1, de: deLAutre });

  ajouterLaMain(geste, avantages, desavantages);
  return { avantages, desavantages };
}

// Le réglage à la main : k avantages s'il est positif, |k| désavantages s'il
// est négatif, avec sa raison pour source.
function ajouterLaMain(geste, avantages, desavantages) {
  const reglage = geste.reglages?.avantages ?? null;
  if (!reglage || reglage.valeur === 0) return;
  (reglage.valeur > 0 ? avantages : desavantages).push({ genre: "main", nom: reglage.raison, nombre: Math.abs(reglage.valeur), de: null });
}

// ─── Le dé ──────────────────────────────────────────────────────────────────

// Le dé au choix : une ou deux caractéristiques du PJ, que le geste porte
// déjà rangées (livret, « Jets » : la somme de deux caractéristiques, ou le
// double d'une seule, arrondie au pair inférieur).
function deAuChoix(photo, geste) {
  const codes = geste.caracteristiques;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 2) return manque("Choisissez une ou deux caractéristiques.");
  const caracteristiques = photo?.caracteristiques ?? null;
  const valeurs = codes.map((code) => (caracteristiques !== null && typeof code === "string" && Object.hasOwn(caracteristiques, code) ? caracteristiques[code] : null));
  const de = valeurs.length === 1 ? deDuJet(valeurs[0]) : deDuJet(valeurs[0], valeurs[1]);
  if (de === null) return manque("Ces caractéristiques ne donnent aucun dé.");
  return { faces: de.faces, caracteristiques: [...codes], mobilisees: [...codes] };
}

// Le dé d'une arme : le sien s'il est fixe ; au choix pour les mains nues,
// et pour une attaque qu'aucune arme ne donne.
function deDeLArme(photo, indice, geste) {
  const arme = Number.isInteger(indice) ? (photo?.armes?.[indice] ?? null) : null;
  if (arme !== null && arme.faces !== null) return { faces: arme.faces, caracteristiques: null, mobilisees: [...arme.caracteristiques] };
  return deAuChoix(photo, geste);
}

// ─── Les circonstances ──────────────────────────────────────────────────────

function duJetDeCaracteristique(etat, geste) {
  const lanceur = geste.acteur;
  if (campDe(etat, lanceur) !== "pj") return manque("Seul un personnage lance un jet de caractéristique.");
  const de = deAuChoix(photoDe(etat, lanceur), geste);
  if (de.manque) return de;
  const { difficulte } = geste;
  if (!Number.isInteger(difficulte) || !Object.hasOwn(DIFFICULTES, difficulte)) return manque("Choisissez une difficulté.");

  // Ni passif d'avantage, ni maîtrise : un jet de caractéristique n'est ni
  // une attaque ni une défense. Seule la main lui en donne.
  const avantages = [];
  const desavantages = [];
  ajouterLaMain(geste, avantages, desavantages);
  return {
    genre: "caracteristique",
    lanceur,
    faces: de.faces,
    caracteristiques: de.caracteristiques,
    mobilisees: de.mobilisees,
    difficulte,
    libelle: DIFFICULTES[difficulte],
    modificateurs: [...modificateursDe(etat, lanceur, { genre: "caracteristique", mobilisees: de.mobilisees }), ...modificateurALaMain(geste)],
    avantages,
    desavantages,
  };
}

function dUneAttaque(etat, geste) {
  const { acteur, cible } = geste;
  const campDeLActeur = campDe(etat, acteur);
  const campDeLaCible = campDe(etat, cible);
  if (campDeLActeur === null || campDeLaCible === null || campDeLActeur === campDeLaCible) return manque(CHOISIR_UNE_CIBLE);
  const facon = faconDe(etat, geste);
  if (facon === null) return manque("Cette capacité ne se joue pas.");

  // Seuls les joueurs lancent des dés : le PJ est le lanceur des deux côtés.
  const attaqueDuPj = campDeLActeur === "pj";
  const genre = attaqueDuPj ? "attaque" : "defense";
  const lanceur = attaqueDuPj ? acteur : cible;
  const autre = attaqueDuPj ? cible : acteur;
  const photo = photoDe(etat, lanceur);

  let de;
  if (attaqueDuPj) {
    de = deDeLArme(photo, geste.mode === "jet_prete" ? geste.armePretee : facon.arme, geste);
    if (de.manque) return de;
  } else {
    const deDefense = photo?.deDefense ?? null;
    if (deDefense === null) return manque(CHOISIR_UNE_CIBLE);
    de = { faces: deDefense.faces, caracteristiques: null, mobilisees: [...deDefense.caracteristiques] };
  }

  const difficulte = attaqueDuPj ? defenseDe(etat, autre).valeur : attaqueDe(etat, autre).valeur;
  if (difficulte === null) return manque(CHOISIR_UNE_CIBLE);

  return {
    genre,
    lanceur,
    faces: de.faces,
    caracteristiques: de.caracteristiques,
    mobilisees: de.mobilisees,
    difficulte,
    libelle: null,
    modificateurs: [...modificateursDe(etat, lanceur, { genre, mobilisees: de.mobilisees }), ...modificateurALaMain(geste)],
    ...sourcesDuJet(etat, geste, { genre, lanceur, autre }),
  };
}

/**
 * De quoi ouvrir le jet d'un geste (ouvrirJet, js/combat/jet.js) : genre,
 * lanceur, faces, caracteristiques, mobilisees, difficulte, libelle,
 * modificateurs, avantages, desavantages. Ou { manque } : la phrase qui dit
 * ce qu'il reste à choisir avant de lancer.
 *
 * - Une attaque ou un jet prêté d'un PJ : il lance le dé de son arme (ou un
 *   dé au choix, à mains nues) contre la défense de sa cible.
 * - Une attaque ou un jet prêté d'un adversaire : le PJ visé lance sa
 *   défense contre l'attaque de l'adversaire.
 * - Un jet de caractéristique : le PJ lance un dé au choix contre la
 *   difficulté qu'il a choisie.
 * Tout autre geste ne lance aucun dé.
 */
export function circonstances(etat, geste) {
  if (geste.mode === "caracteristique") return duJetDeCaracteristique(etat, geste);
  if (geste.mode === "attaque" || geste.mode === "jet_prete") return dUneAttaque(etat, geste);
  return manque("Ce geste ne lance aucun dé.");
}

// ─── Les passifs câblés, pour la fiche ──────────────────────────────────────

const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// Ce que dit la fiche de chaque passif câblé : son effet, d'après son niveau.
const EFFETS = {
  bonus_force: (niveau) => `+${niveau} en force`,
  bonus_agilite: (niveau) => `+${niveau} en agilité`,
  bonus_precision: (niveau) => `+${niveau} en précision`,
  petit: (niveau) => `+${niveau} en défense, ${SIGNES.moins}1 en force`,
  seul_sur_sa_case: (niveau) => compter(niveau, "avantage"),
  en_meute: (niveau) => `${compter(niveau, "avantage")} en attaque`,
  esprit_de_corps: (niveau) => `${compter(niveau, "avantage")} en défense`,
  degrossir: (niveau) => `+${niveau} contre l'armure par réussite`,
};

// Au niveau 0, un passif câblé ne fait rien (§ 12, « Pour le lot 4 ») : sa
// fiche ne dit pas « +0 », elle le dit inactif, « niveau 0 ». Seul reste ce
// qui ne dépend pas du niveau : le −1 de Force du rôle « petit ». C'est la
// table des bonus qui le dit, celle que lit le jet.
const SANS_EFFET = "sans effet";
const NIVEAU_NUL = "niveau 0";
const EFFETS_AU_NIVEAU_NUL = { petit: `${SIGNES.moins}1 en force` };
const joueAuNiveauNul = (role) => BONUS.some((bonus) => bonus.role === role && bonus.valeur(0) !== 0);

// Pourquoi un passif ne joue pas, ou null s'il joue. Hors d'un jet, seule la
// case se regarde : le corps-à-corps et le sens du jet se jugent au jet.
function raisonDuRepos(role, { adversaire, accompagne }) {
  if (BONUS.some((bonus) => bonus.role === role)) return adversaire ? "ne s'applique pas à un adversaire" : null;
  const regle = AVANTAGES.find((avantage) => avantage.role === role);
  if (!regle || regle.seul !== accompagne) return null;
  return regle.seul ? "un allié sur sa case" : "aucun allié sur sa case";
}

/**
 * Les passifs câblés d'un protagoniste, dans l'ordre de sa photographie, pour
 * sa fiche : { capacite, nom, role, niveau, effet, actif, raison }. « raison »
 * dit pourquoi un passif inactif ne joue pas (« niveau 0 », « aucun allié sur
 * sa case », « un allié sur sa case », « ne s'applique pas à un adversaire ») ;
 * elle est null quand il est actif.
 *
 * Au niveau 0, l'effet s'écrit « sans effet », et le passif est inactif,
 * « niveau 0 », avant toute autre raison : rien ne le rendrait actif. Le rôle
 * « petit » garde son −1 de Force, seul écrit alors.
 */
export function passifsDe(etat, id) {
  const passifs = photoDe(etat, id)?.passifs ?? [];
  const situation = { adversaire: campDe(etat, id) !== "pj", accompagne: alliesSurLaCase(etat, id).length > 0 };
  return passifs
    .filter((passif) => Object.hasOwn(EFFETS, passif.role))
    .map(({ capacite, role, niveau }) => {
      const commun = { capacite, nom: capaciteDe(etat, id, capacite)?.nom ?? null, role, niveau };
      const nul = !(niveau > 0);
      if (nul && !joueAuNiveauNul(role)) return { ...commun, effet: SANS_EFFET, actif: false, raison: NIVEAU_NUL };
      const raison = raisonDuRepos(role, situation);
      const effet = nul && Object.hasOwn(EFFETS_AU_NIVEAU_NUL, role) ? EFFETS_AU_NIVEAU_NUL[role] : EFFETS[role](niveau);
      return { ...commun, effet, actif: raison === null, raison };
    });
}
