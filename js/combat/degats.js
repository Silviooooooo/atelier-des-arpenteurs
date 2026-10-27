// Les dégâts d'un geste : la lettre que valent ses réussites, la zone que
// touche chaque d20, ce que perdent l'armure, l'endurance et le corps,
// dégrossir, l'esquive, la blessure et la mort (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) »).
//
// Ce module existe pour que les dégâts n'aient qu'un calcul : le moteur les
// applique, le panneau d'action les montre avant « Appliquer », et le journal
// les écrit, tous d'après degatsFixes() et frapper(). Rien n'y est tiré au
// hasard ni gardé : les dégâts d'un geste sont une base (la lettre de ses
// réussites, les dégâts de l'arme prêtée, ou rien) et une suite d'opérations,
// recalculées à chaque lecture. La victime est un paramètre de frapper(),
// jamais la cible du geste : victimeDe() la dit, report compris.
//
// Ce qu'il applique (livret, « Jets d'attaque », « Jets de défense », « Jets
// de localisation », « Armure, endurance et corps », « Ressources », « Coup
// critique ») :
// - en attaque, une réussite vaut A, deux B, trois C, et quatre (le coup
//   critique) encore C ; en défense, aucune réussite laisse passer C, une B,
//   deux A, et trois rien ;
// - sur chaque zone touchée, l'armure perd les dégâts, le reste passe à la
//   endurance, puis au corps, qui n'est pas localisé ; ce qui dépasse 0 de
//   corps se perd ;
// - à 0 de corps, on meurt.
//
// Et les conventions provisoires (§ 12, « Pour le lot 4 ») :
// - la face de contre-attaque se lit sur le dé brut (20 pour un PJ, 1 pour un
//   adversaire) : un décalage ne la crée ni ne l'efface, et elle annule toute
//   l'attaque, même parmi plusieurs dés ; la face décalée reste sur une zone ;
// - dégrossir : l'armure perd N points de plus par réussite de l'attaque,
//   mais ce qui passe à l'endurance reste « les dégâts moins l'armure
//   d'avant le coup » ; chez un adversaire, ses réussites valent 3 moins
//   celles de la défense du PJ ; jamais sans dégâts, ni en dégâts directs, ni
//   sur un coup que l'esquive a annulé ;
// - les dégâts directs vont à l'endurance de la zone (le reste au corps) ou
//   droit au corps, sans toucher l'armure ;
// - l'esquive annule ses points zone après zone, dans l'ordre des dés.
//
// Au groupe 3 (mission, § 4.4, § 4.6 et § 4.10 ; contrat de la vague 1,
// § 5.4, § 5.9 et § 7.2 ; conventions 47, 55 et 60) :
// - l'ordre des dégâts : la lettre ; le critique, qui la double ; l'ajustement
//   à la main, qui remplace la valeur ; les opérations de la palette, dans
//   l'ordre où elles s'appliquent (×k, +N, −N sans passer sous 0, des dégâts
//   directs, qui deviennent la valeur et sa nature) ; l'armure (« +N contre
//   l'armure » et dégrossir, dont le critique double le surplus) ;
//   l'endurance, puis le corps ;
// - reporter : la victime devient un autre ; les d20 se lisent sur sa grille
//   par leur face, la zone choisie comprise si elle existe chez lui, et une
//   face hors de ses zones va à la plus proche. La face de contre-attaque
//   reste celle de la cible visée ;
// - la blessure : un coup qui laisse l'endurance de sa zone à 0 et ôte au
//   moins un point de corps blesse la zone ; une par zone et par geste ;
//   aucune si les coups tuent, ni pour des dégâts directs au corps. Le −1 à
//   chaque jet a disparu : un personnage choisit sa blessure, un adversaire
//   a sa zone « blessée », sans effet calculé.

import { critiqueReussi, reussites } from "./jet.js";
import { REUSSITES_MAX, geler } from "./regles.js";
import { campDe, capaciteDe, courantDe, faconDe, photoDe, vivant } from "./valeurs.js";

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);

// Le coup critique double la lettre et le surplus de dégrossir.
const DOUBLE_DU_CRITIQUE = 2;

// ─── La lettre ──────────────────────────────────────────────────────────────

/**
 * Les réussites de l'attaque, d'après celles du jet : les mêmes quand un PJ
 * attaque (quatre pour un coup critique) ; 3 moins celles de la défense du PJ
 * quand un adversaire attaque (seuls les joueurs lancent des dés). Un jet de
 * caractéristique n'attaque pas : 0.
 */
export function reussitesDeLAttaque(genreDeJet, nombre) {
  if (genreDeJet === "attaque") return nombre;
  if (genreDeJet === "defense") return REUSSITES_MAX - nombre;
  return 0;
}

/**
 * La lettre des dégâts : 0, 1 ou 2 (A, B, C), l'indice dans les trois dégâts
 * d'une arme ; null quand l'attaque ne touche pas (aucune réussite en
 * attaque, trois en défense). Quatre réussites d'attaque (le coup critique)
 * donnent C : le critique double ensuite ses dégâts.
 */
export function lettreDe(genreDeJet, nombre) {
  const touche = reussitesDeLAttaque(genreDeJet, nombre);
  return touche >= 1 ? Math.min(touche, REUSSITES_MAX) - 1 : null;
}

/** La lettre d'un geste, d'après son jet ; null quand il manque, ou sans jet. */
export function lettreDuGeste(etat, geste) {
  const jet = geste?.jet ?? null;
  return jet === null ? null : lettreDe(jet.genre, reussites(jet));
}

// ─── La victime ─────────────────────────────────────────────────────────────

// Les effets du geste qui valent pour la cible en cours (son rang).
const effetsDuRang = (geste) => (Array.isArray(geste?.effets) ? geste.effets : []).filter((effet) => (effet.rang ?? 0) === (geste.rang ?? 0));

/**
 * Celui que frappe un geste : sa cible, ou celui sur qui le dernier
 * « reporter » de la cible en cours a reporté les dégâts. L'esquive et la
 * blessure suivent la victime.
 */
export function victimeDe(geste) {
  let victime = geste?.cible ?? null;
  for (const effet of effetsDuRang(geste)) {
    if (effet.genre === "reporter") victime = effet.sur;
  }
  return victime;
}

// ─── La localisation ────────────────────────────────────────────────────────

// La zone qui porte une face ; hors de toutes, la plus proche, la première à
// égalité (contrat de la vague 1, § 12, choix 5) : des dégâts reportés se
// lisent sur une autre grille. null pour une grille vide.
function zoneDeLaFace(zones, face) {
  const dedans = zones.findIndex(({ debut, fin }) => face >= debut && face <= fin);
  if (dedans !== -1) return dedans;
  let proche = null;
  let ecart = Infinity;
  zones.forEach(({ debut, fin }, indice) => {
    const loin = face < debut ? debut - face : face - fin;
    if (loin < ecart) {
      proche = indice;
      ecart = loin;
    }
  });
  return proche;
}

// La zone d'un d20 qui n'est pas une contre-attaque : celle que la palette a
// choisie, si cette grille l'a, sinon celle de sa face.
function zoneDuD20(zones, face, choisie) {
  const indice = choisie?.zone;
  return Number.isInteger(indice) && indice >= 0 && indice < zones.length ? indice : zoneDeLaFace(zones, face);
}

/**
 * Ce que touche un d20 sur la grille d'un protagoniste (les valeurs de sa
 * photographie). La face de contre-attaque se lit sur le dé brut, quel que
 * soit le décalage, et ne se choisit pas. Sinon la face est le dé décalé, et
 * « zone » l'indice de la zone : celle que la palette a choisie (« choisie »,
 * { zone, source }) si la grille l'a, sinon celle qui porte la face, ou, hors
 * de la grille, la plus proche.
 */
export function localiser(valeursPhoto, brut, decalage = 0, choisie = null) {
  if (brut === valeursPhoto.faceContre) return { contre: true };
  const face = brut + decalage;
  return { contre: false, face, zone: zoneDuD20(valeursPhoto.zones, face, choisie) };
}

/**
 * Les bornes du décalage qui laissent la face d'un d20 sur une zone : de la
 * première face de la première zone à la dernière de la dernière (1 à 19 sur
 * un PJ, 2 à 20 sur un adversaire). Une photographie n'a ni trou ni
 * chevauchement dans sa grille (js/combat/forme.js).
 */
export function bornesDuDecalage(valeursPhoto, brut) {
  const { zones } = valeursPhoto;
  return { min: zones[0].debut - brut, max: zones[zones.length - 1].fin - brut };
}

// L'arme qui prête son jet à un geste ; null quand il se fait « sans arme ».
function armePreteeDe(etat, geste) {
  const armes = photoDe(etat, geste.acteur)?.armes ?? [];
  const indice = geste.armePretee;
  return (Number.isInteger(indice) ? armes[indice] : null) ?? null;
}

/**
 * Le nombre de d20 de localisation d'un geste qui touche : celui de la façon
 * jouée pour une attaque ; celui de l'arme prêtée pour un jet prêté, un seul
 * sans arme. Jamais moins d'un ; aucun pour un geste sans jet d'attaque.
 */
export function nombreDeD20(etat, geste) {
  if (geste.mode === "attaque") return Math.max(1, faconDe(etat, geste)?.locMultiple ?? 1);
  if (geste.mode === "jet_prete") return Math.max(1, armePreteeDe(etat, geste)?.locMultiple ?? 1);
  return 0;
}

/**
 * Les d20 lancés d'un geste, dans l'ordre, chacun { contre: true } ou
 * { contre: false, face, zone } : la face de contre-attaque est celle de la
 * cible visée (le jeté) ; la zone se lit sur la grille de la victime
 * (victimeDe), la zone choisie par la palette comprise. Le journal et le
 * panneau les lisent ici, report compris.
 */
export function localisationsDuGeste(etat, geste) {
  const jete = photoDe(etat, geste.cible);
  const victime = photoDe(etat, victimeDe(geste));
  if (jete === null || victime === null) return [];
  return (geste.localisation ?? []).map(({ brut, decalage, choisie }) => {
    if (brut === jete.faceContre) return { contre: true };
    const face = brut + (decalage?.valeur ?? 0);
    return { contre: false, face, zone: zoneDuD20(victime.zones, face, choisie ?? null) };
  });
}

// ─── Fixer les dégâts ───────────────────────────────────────────────────────

// Les trois dégâts de l'arme qui prête son jet ; null sans arme, ou si elle
// n'en a pas.
const degatsDeLArmePretee = (etat, geste) => armePreteeDe(etat, geste)?.degats ?? null;

/**
 * Les bases de dégâts qu'un geste peut prendre, la première étant celle par
 * défaut :
 * - une attaque aux dégâts lisibles : « lettre », le rang de ses réussites ;
 * - une attaque dont les dégâts ne se lisent pas : « aucun » ;
 * - un jet prêté : « aucun » (« Sans dégâts »), puis « arme » (« Dégâts de
 *   l'arme ») si l'arme prêtée a des dégâts.
 * Un geste sans jet d'attaque n'en a aucune.
 */
export function basesPermises(etat, geste) {
  if (geste.mode === "attaque") return (faconDe(etat, geste)?.degats ?? null) === null ? ["aucun"] : ["lettre"];
  if (geste.mode === "jet_prete") return degatsDeLArmePretee(etat, geste) === null ? ["aucun"] : ["aucun", "arme"];
  return [];
}

// Dégrossir : N points de plus contre l'armure par réussite de l'attaque, N
// étant le niveau du premier passif de l'attaquant qui porte ce rôle. Il
// compte les réussites du jet, jamais un ajustement à la main ; le coup
// critique double son surplus (trois réussites, doublées).
function degrossir(etat, geste, { base, nature, valeur, attaque, critique }) {
  const rien = { surplus: 0, sourceDuSurplus: null };
  if ((base !== "lettre" && base !== "arme") || nature !== "normaux" || valeur <= 0) return rien;
  const passif = (photoDe(etat, geste.acteur)?.passifs ?? []).find(({ role }) => role === "degrossir") ?? null;
  if (passif === null) return rien;
  const surplus = passif.niveau * Math.min(attaque, REUSSITES_MAX) * (critique ? DOUBLE_DU_CRITIQUE : 1);
  return surplus > 0 ? { surplus, sourceDuSurplus: capaciteDe(etat, geste.acteur, passif.capacite)?.nom ?? null } : rien;
}

// Les opérations de la palette sur la valeur, dans l'ordre où elles
// s'appliquent (mission, § 4.6) : chacune rend la valeur et la nature d'après
// elle. « directs » remplace la valeur et dit la nature.
const OPERATIONS = {
  multiplier: (valeur, nature, effet) => ({ valeur: valeur * effet.k, nature, operande: effet.k }),
  ajouter: (valeur, nature, effet) => ({ valeur: valeur + effet.n, nature, operande: effet.n }),
  retrancher: (valeur, nature, effet) => ({ valeur: Math.max(0, valeur - effet.n), nature, operande: effet.n }),
  directs: (valeur, nature, effet) => ({ valeur: effet.n, nature: effet.nature, operande: effet.n }),
};

/**
 * Les dégâts d'un geste qui a touché, tels qu'ils sont fixés à cet instant,
 * pour la cible en cours (convention 55) :
 * - base, nature : ce que le joueur a fixé (sinon la base par défaut, en
 *   dégâts normaux), la nature devenant celle des dégâts directs de la
 *   palette s'il y en a ;
 * - lettre : 0, 1 ou 2 (A, B, C) ; null pour la base « aucun » ;
 * - deBase : les dégâts de cette lettre, avant toute opération (0 pour la
 *   base « aucun ») ;
 * - critique : le 4e dé a réussi (le coup critique, même sans dégâts) ;
 * - etapes : ce qui a changé la valeur après la lettre, dans l'ordre suivi,
 *   chacune { genre, valeur, resultat, source } : « critique » (valeur 2),
 *   « ajuster » (sa raison en plus, source null), puis « multiplier »,
 *   « ajouter », « retrancher », « directs » (sa nature en plus), la source
 *   étant celle de l'effet ;
 * - valeur : après tout cela ;
 * - avant : un nombre par d20 qui touche une zone, avant les interventions ;
 *   les dégâts s'appliquent en entier à chaque zone, même deux fois à la même ;
 * - total : leur somme, la borne de l'esquive ;
 * - parCoup : ce qu'il en reste après l'esquive ;
 * - surplus, sourceDuSurplus : dégrossir, doublé par le critique (0 et null
 *   s'il ne s'applique pas) ;
 * - armure : les « +N contre l'armure » de la palette, { n, source }, dans
 *   l'ordre ; contreLArmure : ce que l'armure perd de plus à chaque coup,
 *   dégrossir et eux ensemble ;
 * - victime : celui que frappent ces dégâts (victimeDe).
 */
export function degatsFixes(etat, geste) {
  const fixes = geste.degats ?? { base: basesPermises(etat, geste)[0] ?? "aucun", operations: [], nature: "normaux" };
  const { base } = fixes;
  const genreDeJet = geste.jet?.genre ?? null;
  const nombre = geste.jet ? reussites(geste.jet) : 0;
  const critique = geste.jet ? critiqueReussi(geste.jet) : false;

  const tarif = base === "lettre" ? (faconDe(etat, geste)?.degats ?? null) : base === "arme" ? degatsDeLArmePretee(etat, geste) : null;
  const lettre = base === "aucun" ? null : lettreDe(genreDeJet, nombre);
  const deBase = tarif !== null && lettre !== null ? tarif[lettre] : 0;
  const etapes = [];
  let valeur = deBase;
  let nature = fixes.nature;

  // Le critique double la lettre, avant toute opération : pas sans dégâts.
  if (critique && tarif !== null && lettre !== null) {
    valeur *= DOUBLE_DU_CRITIQUE;
    etapes.push({ genre: "critique", valeur: DOUBLE_DU_CRITIQUE, resultat: valeur, source: null });
  }
  for (const operation of fixes.operations ?? []) {
    if (operation.op !== "ajuster") continue;
    valeur = operation.valeur;
    etapes.push({ genre: "ajuster", valeur: operation.valeur, resultat: valeur, source: null, raison: operation.raison ?? null });
  }
  const armure = [];
  for (const effet of effetsDuRang(geste)) {
    if (effet.genre === "armure") armure.push({ n: effet.n, source: effet.source ?? null });
    if (!Object.hasOwn(OPERATIONS, effet.genre)) continue;
    const fait = OPERATIONS[effet.genre](valeur, nature, effet);
    valeur = fait.valeur;
    nature = fait.nature;
    const etape = { genre: effet.genre, valeur: fait.operande, resultat: valeur, source: effet.source ?? null };
    etapes.push(effet.genre === "directs" ? { ...etape, nature } : etape);
  }

  const avant = localisationsDuGeste(etat, geste)
    .filter((d20) => !d20.contre)
    .map(() => valeur);
  const annules = somme((geste.interventions ?? []).filter((intervention) => intervention.effet?.genre === "annuler").map((intervention) => intervention.effet.x));
  const degrossi = degrossir(etat, geste, { base, nature, valeur, attaque: reussitesDeLAttaque(genreDeJet, nombre), critique });

  return {
    base,
    lettre,
    deBase,
    valeur,
    nature,
    avant,
    parCoup: imputerEsquive(avant, annules),
    total: somme(avant),
    ...degrossi,
    critique,
    etapes,
    armure,
    contreLArmure: degrossi.surplus + somme(armure.map((plus) => plus.n)),
    victime: victimeDe(geste),
  };
}

// ─── L'esquive ──────────────────────────────────────────────────────────────

/**
 * Ce qui reste de chaque coup une fois x dégâts annulés : l'esquive s'impute
 * coup après coup, dans l'ordre des dés. imputerEsquive([12, 12], 15) rend
 * [0, 9].
 */
export function imputerEsquive(parCoup, x) {
  let reste = Math.max(0, x);
  return parCoup.map((degats) => {
    const annule = Math.min(reste, Math.max(0, degats));
    reste -= annule;
    return degats - annule;
  });
}

// ─── Frapper ────────────────────────────────────────────────────────────────

/**
 * Les coups d'un geste, prêts pour frapper() : un par d20, dans l'ordre des
 * dés, { zone, degats, surplus, nature }, les dégâts étant ceux d'après
 * l'esquive, et le surplus tout ce que l'armure perd de plus (dégrossir et
 * « +N contre l'armure »). Aucun coup si l'un des d20 montre la face de
 * contre-attaque : elle annule toute l'attaque. Les zones sont celles de la
 * victime (victimeDe).
 */
export function coupsDuGeste(etat, geste) {
  const d20 = localisationsDuGeste(etat, geste);
  if (d20.some((un) => un.contre)) return [];
  const { parCoup, contreLArmure, nature } = degatsFixes(etat, geste);
  return d20.map(({ zone }, rang) => ({ zone, degats: parCoup[rang], surplus: contreLArmure, nature }));
}

const sansEndurance = (zones) => zones.filter((zone) => zone.resistance <= 0).length;

/**
 * Applique des coups à l'état courant d'une victime, dans l'ordre des dés, et
 * rend { courant, coups, mort } sans rien changer à ce qu'il a reçu.
 *
 * Chaque coup est { zone, degats, surplus, nature } :
 * - nature « normaux » : l'armure de la zone perd les dégâts et le surplus
 *   (dégrossir, « +N contre l'armure ») ; ce qui passe à l'endurance est
 *   « les dégâts moins l'armure d'avant le coup », puis le reste passe au
 *   corps ;
 * - nature « resistance » : l'endurance de la zone, puis le corps ;
 * - nature « corps » : le corps seul ;
 * - des dégâts de 0 ou moins n'enlèvent rien, pas même le surplus.
 * Deux coups sur la même zone se suivent : le second part de ce qu'a laissé
 * le premier. Le corps est commun à toutes les zones.
 *
 * Chaque coup rendu dit ce qui a changé : { zone, armure: [avant, après],
 * resistance: [avant, après], corps: [avant, après], blessure, blessures,
 * corpsPerdu }.
 * - « corpsPerdu » : ce coup a ôté au moins un point de corps ;
 * - « blessure » (mission, § 4.10 ; convention 47) : ce coup laisse
 *   l'endurance de sa zone à 0 et ôte du corps, et c'est le premier de ces
 *   coups pour sa zone ; jamais en nature « corps », ni quand la victime
 *   finit à 0 de corps (le coup tue) ;
 * - « blessures » : le nombre de zones sans endurance après lui (il ne pèse
 *   plus sur aucun jet).
 * « mort » : le corps est à 0.
 *
 * Le courant rendu est neuf et gelé, et partage les zones qui n'ont pas
 * changé ; si rien n'a changé, c'est le courant reçu.
 */
export function frapper(courant, coups) {
  const zones = [...courant.zones];
  let corps = courant.corps;
  const rendus = [];
  const blessees = new Set();

  for (const { zone: indice, degats, surplus = 0, nature = "normaux" } of coups) {
    const zone = Number.isInteger(indice) && indice >= 0 && indice < zones.length ? zones[indice] : null;
    const depart = { armure: zone?.armure ?? 0, resistance: zone?.resistance ?? 0, corps };
    const arrivee = { ...depart };

    if (zone !== null && degats > 0) {
      if (nature === "corps") {
        arrivee.corps = Math.max(0, depart.corps - degats);
      } else {
        let passe = degats;
        if (nature !== "resistance") {
          arrivee.armure = Math.max(0, depart.armure - (degats + surplus));
          // Le surplus ne passe jamais à l'endurance : elle reçoit les dégâts
          // moins l'armure d'avant le coup.
          passe = Math.max(0, degats - depart.armure);
        }
        arrivee.resistance = Math.max(0, depart.resistance - passe);
        arrivee.corps = Math.max(0, depart.corps - Math.max(0, passe - depart.resistance));
      }
      if (arrivee.armure !== depart.armure || arrivee.resistance !== depart.resistance) {
        zones[indice] = { ...zone, armure: arrivee.armure, resistance: arrivee.resistance };
      }
      corps = arrivee.corps;
    }

    const corpsPerdu = arrivee.corps < depart.corps;
    const blessure = zone !== null && nature !== "corps" && arrivee.resistance === 0 && corpsPerdu && !blessees.has(indice);
    if (blessure) blessees.add(indice);
    rendus.push({
      zone: indice,
      armure: [depart.armure, arrivee.armure],
      resistance: [depart.resistance, arrivee.resistance],
      corps: [depart.corps, arrivee.corps],
      blessure,
      blessures: sansEndurance(zones),
      corpsPerdu,
    });
  }

  // Aucune blessure si les coups tuent.
  const mort = corps <= 0;
  const change = corps !== courant.corps || zones.some((zone, rang) => zone !== courant.zones[rang]);
  return {
    courant: change ? geler({ ...courant, corps, zones }) : courant,
    coups: geler(mort ? rendus.map((rendu) => ({ ...rendu, blessure: false })) : rendus),
    mort,
  };
}

// ─── La blessure ────────────────────────────────────────────────────────────

/**
 * Les zones blessées qu'un personnage doit encore choisir pour ce geste
 * (contrat, § 5.9) : celles des coups appliqués (geste.resultat) qui
 * blessent, dans l'ordre des dés, moins celles déjà dans geste.blessures.
 * [] pour un adversaire (sa zone est « blessée », sans étape), avant les
 * coups, ou si la victime est morte (ou retirée).
 */
export function blessuresAChoisir(etat, geste) {
  const victime = victimeDe(geste);
  if (campDe(etat, victime) !== "pj" || !vivant(etat, victime) || courantDe(etat, victime).corps <= 0) return [];
  const choisies = new Set((geste.blessures ?? []).map((blessure) => blessure.zone));
  const zones = [];
  for (const coup of geste.resultat?.coups ?? []) {
    if (coup.blessure === true && !choisies.has(coup.zone) && !zones.includes(coup.zone)) zones.push(coup.zone);
  }
  return zones;
}
