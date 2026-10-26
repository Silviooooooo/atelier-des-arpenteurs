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
// recalculées à chaque lecture. C'est là que se brancheront, au groupe 2, les
// multiplications, les ajouts et le report sur un autre protagoniste : la
// victime est un paramètre de frapper(), jamais la cible du geste.
//
// Ce qu'il applique (livret, « Jets d'attaque », « Jets de défense », « Jets
// de localisation », « Armure, endurance et corps », « Ressources ») :
// - en attaque, une réussite vaut A, deux B, trois C ; en défense, aucune
//   réussite laisse passer C, une B, deux A, et trois rien ;
// - sur chaque zone touchée, l'armure perd les dégâts, le reste passe à la
//   endurance, puis au corps, qui n'est pas localisé ; ce qui dépasse 0 de
//   corps se perd ;
// - une zone dont l'endurance tombe à 0 est une blessure ; à 0 de corps, on
//   meurt.
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

import { reussites } from "./jet.js";
import { REUSSITES_MAX, geler } from "./regles.js";
import { capaciteDe, faconDe, photoDe } from "./valeurs.js";

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);

// ─── La lettre ──────────────────────────────────────────────────────────────

/**
 * Les réussites de l'attaque, d'après celles du jet : les mêmes quand un PJ
 * attaque ; 3 moins celles de la défense du PJ quand un adversaire attaque
 * (seuls les joueurs lancent des dés). Un jet de caractéristique n'attaque
 * pas : 0.
 */
export function reussitesDeLAttaque(genreDeJet, nombre) {
  if (genreDeJet === "attaque") return nombre;
  if (genreDeJet === "defense") return REUSSITES_MAX - nombre;
  return 0;
}

/**
 * La lettre des dégâts : 0, 1 ou 2 (A, B, C), l'indice dans les trois dégâts
 * d'une arme ; null quand l'attaque ne touche pas (aucune réussite en
 * attaque, trois en défense).
 */
export function lettreDe(genreDeJet, nombre) {
  const touche = reussitesDeLAttaque(genreDeJet, nombre);
  return touche >= 1 && touche <= REUSSITES_MAX ? touche - 1 : null;
}

// ─── La localisation ────────────────────────────────────────────────────────

/**
 * Ce que touche un d20 sur la grille d'un protagoniste (les valeurs de sa
 * photographie). La face de contre-attaque se lit sur le dé brut, quel que
 * soit le décalage. Sinon la face est le dé décalé, et « zone » l'indice de
 * la zone qui la porte (null si le décalage l'a sortie de la grille : l'offre
 * ne le permet pas, voir bornesDuDecalage).
 */
export function localiser(valeursPhoto, brut, decalage = 0) {
  if (brut === valeursPhoto.faceContre) return { contre: true };
  const face = brut + decalage;
  const zone = valeursPhoto.zones.findIndex(({ debut, fin }) => face >= debut && face <= fin);
  return { contre: false, face, zone: zone === -1 ? null : zone };
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

// Les d20 lancés d'un geste, chacun localisé sur la grille de sa cible.
function d20Localises(etat, geste) {
  const victime = photoDe(etat, geste.cible);
  if (victime === null) return [];
  return (geste.localisation ?? []).map(({ brut, decalage }) => localiser(victime, brut, decalage?.valeur ?? 0));
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
// compte les réussites du jet, jamais un ajustement à la main.
function degrossir(etat, geste, { base, nature, valeur, attaque }) {
  const rien = { surplus: 0, sourceDuSurplus: null };
  if ((base !== "lettre" && base !== "arme") || nature !== "normaux" || valeur <= 0) return rien;
  const passif = (photoDe(etat, geste.acteur)?.passifs ?? []).find(({ role }) => role === "degrossir") ?? null;
  if (passif === null) return rien;
  const surplus = passif.niveau * attaque;
  return surplus > 0 ? { surplus, sourceDuSurplus: capaciteDe(etat, geste.acteur, passif.capacite)?.nom ?? null } : rien;
}

/**
 * Les dégâts d'un geste qui a touché, tels qu'ils sont fixés à cet instant :
 * - base, nature : ce que le joueur a fixé (sinon la base par défaut, en
 *   dégâts normaux) ;
 * - lettre : 0, 1 ou 2 (A, B, C) ; null pour la base « aucun » ;
 * - deBase : les dégâts de cette lettre, avant toute opération (0 pour la
 *   base « aucun ») ;
 * - valeur : après les opérations (« ajuster » remplace) ;
 * - avant : un nombre par d20 qui touche une zone, avant les interventions ;
 *   les dégâts s'appliquent en entier à chaque zone, même deux fois à la même ;
 * - total : leur somme, la borne de l'esquive ;
 * - parCoup : ce qu'il en reste après l'esquive ;
 * - surplus, sourceDuSurplus : dégrossir (0 et null s'il ne s'applique pas).
 */
export function degatsFixes(etat, geste) {
  const fixes = geste.degats ?? { base: basesPermises(etat, geste)[0] ?? "aucun", operations: [], nature: "normaux" };
  const { base, nature } = fixes;
  const genreDeJet = geste.jet?.genre ?? null;
  const nombre = geste.jet ? reussites(geste.jet) : 0;

  const tarif = base === "lettre" ? (faconDe(etat, geste)?.degats ?? null) : base === "arme" ? degatsDeLArmePretee(etat, geste) : null;
  const lettre = base === "aucun" ? null : lettreDe(genreDeJet, nombre);
  const deBase = tarif !== null && lettre !== null ? tarif[lettre] : 0;
  let valeur = deBase;
  for (const operation of fixes.operations ?? []) {
    if (operation.op === "ajuster") valeur = operation.valeur;
  }

  const avant = d20Localises(etat, geste)
    .filter((d20) => !d20.contre)
    .map(() => valeur);
  const annules = somme((geste.interventions ?? []).filter((intervention) => intervention.effet?.genre === "annuler").map((intervention) => intervention.effet.x));

  return {
    base,
    lettre,
    deBase,
    valeur,
    nature,
    avant,
    parCoup: imputerEsquive(avant, annules),
    total: somme(avant),
    ...degrossir(etat, geste, { base, nature, valeur, attaque: reussitesDeLAttaque(genreDeJet, nombre) }),
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
 * l'esquive. Aucun coup si l'un des d20 montre la face de contre-attaque :
 * elle annule toute l'attaque.
 */
export function coupsDuGeste(etat, geste) {
  const d20 = d20Localises(etat, geste);
  if (d20.some((un) => un.contre)) return [];
  const { parCoup, surplus, nature } = degatsFixes(etat, geste);
  return d20.map(({ zone }, rang) => ({ zone, degats: parCoup[rang], surplus, nature }));
}

const blessees = (zones) => zones.filter((zone) => zone.resistance <= 0).length;

/**
 * Applique des coups à l'état courant d'une victime, dans l'ordre des dés, et
 * rend { courant, coups, mort } sans rien changer à ce qu'il a reçu.
 *
 * Chaque coup est { zone, degats, surplus, nature } :
 * - nature « normaux » : l'armure de la zone perd les dégâts et le surplus de
 *   dégrossir ; ce qui passe à l'endurance est « les dégâts moins l'armure
 *   d'avant le coup », puis le reste passe au corps ;
 * - nature « resistance » : l'endurance de la zone, puis le corps ;
 * - nature « corps » : le corps seul ;
 * - des dégâts de 0 ou moins n'enlèvent rien, pas même le surplus.
 * Deux coups sur la même zone se suivent : le second part de ce qu'a laissé
 * le premier. Le corps est commun à toutes les zones.
 *
 * Chaque coup rendu dit ce qui a changé : { zone, armure: [avant, après],
 * resistance: [avant, après], corps: [avant, après], blessure, blessures }.
 * « blessure » : ce coup fait tomber l'endurance de la zone à 0 ;
 * « blessures » : le nombre de zones à 0 d'endurance après lui. « mort » :
 * le corps est à 0.
 *
 * Le courant rendu est neuf et gelé, et partage les zones qui n'ont pas
 * changé ; si rien n'a changé, c'est le courant reçu.
 */
export function frapper(courant, coups) {
  const zones = [...courant.zones];
  let corps = courant.corps;
  const rendus = [];

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
          // Le surplus de dégrossir ne passe jamais à l'endurance : elle
          // reçoit les dégâts moins l'armure d'avant le coup.
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

    rendus.push({
      zone: indice,
      armure: [depart.armure, arrivee.armure],
      resistance: [depart.resistance, arrivee.resistance],
      corps: [depart.corps, arrivee.corps],
      blessure: depart.resistance > 0 && arrivee.resistance === 0,
      blessures: blessees(zones),
    });
  }

  const change = corps !== courant.corps || zones.some((zone, rang) => zone !== courant.zones[rang]);
  return {
    courant: change ? geler({ ...courant, corps, zones }) : courant,
    coups: geler(rendus),
    mort: corps <= 0,
  };
}
