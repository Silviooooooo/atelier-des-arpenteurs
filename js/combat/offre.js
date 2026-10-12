// L'offre : ce qui est permis à cet instant d'un combat, et pourquoi le reste
// ne l'est pas (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) »).
//
// C'est la seule porte du combat. Le moteur (js/combat/moteur.js) refuse tout
// événement qu'elle n'admet pas ; les vues de l'écran en tirent leurs
// boutons, leurs bornes, et la raison de chaque bouton inactif. Les deux
// lisent la même chose, donc ne peuvent pas diverger : un bouton montré actif
// est un événement que le moteur accepte. C'est pourquoi ce module n'importe
// jamais le moteur, et ne change rien à l'état qu'on lui donne.
//
// Ce qu'elle applique (livret, « Tours de jeu », « Temporalité », « Actions
// de jeu », « Capacités », « Ressources » ; § 17) :
// - dans le camp qui joue, tout vivant qui n'a pas joué peut agir, dans
//   l'ordre qu'on veut ;
// - jouer une capacité coûte une action, son souffle et son lien ; un passif
//   ne se joue pas ; on joue une capacité à la puissance qu'on veut, de 1 à
//   son niveau ;
// - rien ne se paie avant le premier dé, ou avant la confirmation d'une
//   capacité sans jet : jusque-là tout se règle, et tout s'annule ;
// - une cible d'attaque est vivante, du camp adverse, et à portée.
//
// Et les conventions provisoires (§ 12, « Pour le lot 4 ») :
// - un coût négatif vaut 0 (il est figé ainsi dans la photographie) ; la part
//   X d'un coût se choisit de 0 à ce qui reste, la même pour le souffle et
//   pour le lien ; un coût illisible rend la capacité injouable ;
// - le lien d'un PJ se paie sur la jauge du primordial dont vient la
//   capacité, et sur elle seule ; sinon sur une jauge au choix qui suffit ;
//   un adversaire ne paie pas le lien ;
// - une portée absente vaut 0, la même case ; un déplacement à la puissance P
//   mène à une distance de 1 à P ;
// - une seule esquive par attaque, offerte au PJ visé tant qu'il lui reste
//   une action et du souffle, et que les dégâts dépassent 0 ;
// - la face d'un d20 se décale tant que ni l'esquive ni l'application des
//   dégâts n'ont été jouées, et reste sur une zone.
//
// Les refus portent quatre codes : « forme » (l'événement est mal fait),
// « hors_moment » (rien de tel ne s'offre à cet instant), « hors_bornes » (la
// valeur n'est pas de celles qui s'offrent), « interdit » (le bouton existe,
// mais il est inactif : le message est sa raison).

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { circonstances } from "./circonstances.js";
import { basesPermises, bornesDuDecalage, degatsFixes, nombreDeD20 } from "./degats.js";
import { validerEvenement } from "./forme.js";
import { choixDuJet, deAttendu, ouvrirJet } from "./jet.js";
import { casesEntre, distance } from "./plateau.js";
import { BORNE_DEGATS, BORNE_REGLAGE, DIFFICULTES, EVENEMENTS_MAX, FACES_LOCALISATION, ROLES_SANS_BOUTON } from "./regles.js";
import { aJoue, campDe, capaciteDe, courantDe, faconDe, gesteEnCours, photoDe, vivant, vivantsDe } from "./valeurs.js";

// Livret, « Capacités » et « Actions de jeu » : jouer une capacité coûte une
// action, une intervention aussi. Le nombre ne s'écrit qu'ici : le moteur
// paie ce que dit le prix, sans le connaître.
const ACTIONS_D_UN_GESTE = 1;

const MODES_A_JET = ["attaque", "jet_prete", "caracteristique"];
const MODES_D_ATTAQUE = ["attaque", "jet_prete"];
const MODES_A_CIBLE = ["attaque", "jet_prete", "sans_jet"];
const MODES_A_CONFIRMER = ["sans_jet", "deplacement"];
const NATURES = ["normaux", "resistance", "corps"];
const CODES_CARACTERISTIQUES = CARACTERISTIQUES.map((caracteristique) => caracteristique.code);
const VALEURS_DE_DIFFICULTE = Object.keys(DIFFICULTES).map(Number);

const accorder = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);

// ─── Qui joue ───────────────────────────────────────────────────────────────

/**
 * Ceux qui peuvent agir : les vivants du camp qui joue, qui n'ont pas joué
 * (il leur reste une action, et ils n'ont pas passé leur tour), dans l'ordre
 * d'ajout. Personne hors d'un combat lancé et non terminé.
 */
export function candidats(etat) {
  if (etat.phase !== "combat" || etat.tour === null) return [];
  return vivantsDe(etat, etat.tour.camp).filter((id) => !aJoue(etat, id));
}

/**
 * Celui qui joue, vu de l'écran : l'acteur du geste en cours ; sinon celui
 * qu'on a choisi, tant qu'il peut encore agir ; sinon personne.
 */
export function acteurCourant(etat, choisi) {
  const geste = gesteEnCours(etat);
  if (geste !== null) return geste.acteur;
  return candidats(etat).includes(choisi) ? choisi : null;
}

// ─── Le prix ────────────────────────────────────────────────────────────────

const ABSENTE = "absente de la banque";
const COUT_ILLISIBLE = "coût illisible dans la banque";
const AUCUNE_CASE = "aucune case à sa portée";
const PASSIF = "Passif à cette puissance.";
const PLUS_D_ACTION = "Plus d'action à ce tour.";

// Le coût d'une façon, sa part X remplacée ; null s'il est illisible.
function coutDe(facon, x) {
  if (facon.cout === null) return null;
  const chiffrer = (part) => (part === "X" ? x : part);
  return { souffle: chiffrer(facon.cout.souffle), lien: chiffrer(facon.cout.lien) };
}

// La jauge qui paie le lien d'une capacité d'un PJ, si elle suffit : celle du
// primordial dont vient la capacité, et elle seule ; sinon celle qu'il a
// choisie ; sinon la première qui suffit. null si aucune ne paie.
function jaugeDuLien(courant, capacite, besoin, choisie) {
  const suffit = (indice) => (element(courant.liens, indice)?.points ?? -1) >= besoin;
  if (capacite.lien !== null) return suffit(capacite.lien) ? capacite.lien : null;
  if (choisie !== null && suffit(choisie)) return choisie;
  const premiere = courant.liens.findIndex((_, indice) => suffit(indice));
  return premiere === -1 ? null : premiere;
}

// Ce qui reste de lien pour une capacité : sur sa jauge attitrée, ou sur la
// plus pleine quand elle n'en a pas ; 0 sans jauge.
function resteDeLien(courant, capacite) {
  if (capacite.lien !== null) return element(courant.liens, capacite.lien)?.points ?? 0;
  return Math.max(0, ...courant.liens.map((jauge) => jauge.points));
}

// Les cases où mène un déplacement, depuis une case : à une distance de 1 à
// sa puissance.
const casesDuDeplacement = (depart, facon) => casesEntre(depart, 1, facon?.puissance ?? 0);

// Pourquoi une façon ne se joue pas, ou null si elle se paie. L'ordre des
// raisons est celui où l'écran les dit : ce qui tient à la capacité d'abord
// (la banque, puis un déplacement qui ne mène nulle part), ce qui tient au
// moment ensuite (l'action, le souffle, le lien).
function empechement(etat, id, capacite, facon, { x = 0, jauge = null } = {}) {
  if (facon.passif) return PASSIF;
  const cout = coutDe(facon, x);
  if (cout === null) return COUT_ILLISIBLE;
  const courant = courantDe(etat, id);
  // Un déplacement à la puissance 0 (une capacité de déplacement qui
  // n'évolue pas) n'offre aucune case : son bouton le dit, au lieu d'ouvrir
  // un geste sans issue.
  if (capacite.role === "deplacement" && casesDuDeplacement(courant?.case ?? null, facon).length === 0) return AUCUNE_CASE;
  if (courant === null || courant.actions < ACTIONS_D_UN_GESTE) return PLUS_D_ACTION;
  if (cout.souffle > courant.souffle) return `Pas assez de souffle : ${accorder(cout.souffle, "demandé")}, ${accorder(courant.souffle, "restant")}.`;
  // Un adversaire ne paie pas le lien : rien ne peut lui en manquer.
  if (courant.camp === "pj" && cout.lien > 0 && jaugeDuLien(courant, capacite, cout.lien, jauge) === null) {
    return `Pas assez de lien : ${accorder(cout.lien, "demandé")}, ${accorder(resteDeLien(courant, capacite), "restant")}.`;
  }
  return null;
}

/**
 * Le prix d'un geste, tel qu'il se paiera d'un coup au premier dé ou à la
 * confirmation : { actions, souffle, lien, jauge, lienNonPaye }. « jauge » est
 * l'indice de la jauge qui paie le lien d'un PJ (null sans lien à payer, ou
 * si aucune ne suffit) ; « lienNonPaye », le lien qu'un adversaire ne paie
 * pas, et que le journal dit. null si le coût est illisible.
 */
export function prixDuGeste(etat, geste) {
  const capacite = capaciteDe(etat, geste?.acteur, geste?.capacite);
  const facon = faconDe(etat, geste);
  const courant = courantDe(etat, geste?.acteur);
  if (capacite === null || facon === null || courant === null) return null;
  const cout = coutDe(facon, geste.x);
  if (cout === null) return null;
  if (courant.camp !== "pj") return { actions: ACTIONS_D_UN_GESTE, souffle: cout.souffle, lien: 0, jauge: null, lienNonPaye: cout.lien };
  const jauge = cout.lien > 0 ? jaugeDuLien(courant, capacite, cout.lien, geste.jauge) : null;
  return { actions: ACTIONS_D_UN_GESTE, souffle: cout.souffle, lien: cout.lien, jauge, lienNonPaye: 0 };
}

/**
 * Le prix d'une esquive de x points : une action, et x de souffle (convention
 * provisoire : le livret, « Ressources », la dit sans action).
 */
export function prixDeLEsquive(x) {
  return { actions: ACTIONS_D_UN_GESTE, souffle: x };
}

// ─── Les boutons ────────────────────────────────────────────────────────────

/**
 * Les façons d'une capacité, chacune avec ce qu'on peut en faire :
 * { facon, actif, raison }. Une façon se joue si elle n'est pas passive, que
 * son coût se lit, et que le protagoniste peut la payer (une action, le
 * souffle, le lien), la part X du coût comptée pour 0.
 */
export function faconsDe(etat, id, capacite) {
  const laCapacite = capaciteDe(etat, id, capacite);
  if (laCapacite === null) return [];
  return laCapacite.facons.map((facon, indice) => {
    const raison = empechement(etat, id, laCapacite, facon);
    return { facon: indice, actif: raison === null, raison };
  });
}

// La façon que joue d'office le bouton d'un PJ (règle d'interface) : la plus
// haute puissance qu'il peut payer, parmi celles qui ne sont pas passives ;
// s'il n'en peut payer aucune, la plus basse, et le bouton est inactif.
function faconDOffice(capacite, jugees) {
  const jouables = jugees.filter(({ facon }) => !capacite.facons[facon].passif);
  const puissance = ({ facon }) => capacite.facons[facon].puissance;
  const payables = jouables.filter(({ actif }) => actif);
  if (payables.length > 0) return payables.reduce((haute, jugee) => (puissance(jugee) > puissance(haute) ? jugee : haute));
  return jouables.reduce((basse, jugee) => (puissance(jugee) < puissance(basse) ? jugee : basse));
}

/**
 * Les boutons de capacité d'un protagoniste, dans l'ordre de sa
 * photographie : { capacite, facon, actif, raison }. Un PJ a un bouton par
 * capacité, qui porte sa façon d'office ; un adversaire, un par façon (une
 * par arme qui donne la capacité).
 *
 * N'ont pas de bouton : une capacité dont toutes les façons sont passives, et
 * celles dont le simulateur tient lui-même le rôle (passer son tour, le jet
 * de défense, attendre). Une capacité absente de la banque garde le sien,
 * inactif et sans façon.
 */
export function boutons(etat, id) {
  const photo = photoDe(etat, id);
  if (photo === null) return [];
  const parFacon = campDe(etat, id) !== "pj";
  const liste = [];
  photo.capacites.forEach((capacite, indice) => {
    if (ROLES_SANS_BOUTON.includes(capacite.role)) return;
    if (capacite.facons.length === 0) {
      liste.push({ capacite: indice, facon: null, actif: false, raison: capacite.inactive ?? ABSENTE });
      return;
    }
    if (capacite.facons.every((facon) => facon.passif)) return;
    const jugees = faconsDe(etat, id, indice);
    for (const { facon, actif, raison } of parFacon ? jugees : [faconDOffice(capacite, jugees)]) {
      liste.push({ capacite: indice, facon, actif, raison });
    }
  });
  return liste;
}

// ─── Le geste en préparation ────────────────────────────────────────────────

// Le geste qui se règle encore : rien n'en est payé.
function enPreparation(etat) {
  const geste = gesteEnCours(etat);
  return geste !== null && geste.moment === "preparation" ? geste : null;
}

// L'arme qui prête son jet ; null quand il se fait « sans arme ».
const armePreteeDe = (etat, geste) => element(photoDe(etat, geste.acteur)?.armes, geste.armePretee);

// La portée d'une attaque : celle de la façon jouée ; pour un jet prêté,
// celle de l'arme prêtée, 0 sans arme.
function porteeDe(etat, geste) {
  if (geste.mode === "jet_prete") return armePreteeDe(etat, geste)?.portee ?? 0;
  return faconDe(etat, geste)?.portee ?? 0;
}

/**
 * Les protagonistes qu'un geste en préparation pourrait viser, dans l'ordre
 * d'ajout, chacun { id, possible, raison } :
 * - une attaque ou un jet prêté : ceux de l'autre camp ; possible s'il est
 *   vivant et à portée (distance de Tchebychev) ;
 * - une capacité sans jet : tous ; possible s'il est vivant, sans condition
 *   de portée.
 * Vide pour tout autre geste, et dès que le geste est payé.
 */
export function cibles(etat) {
  const geste = enPreparation(etat);
  if (geste === null || !MODES_A_CIBLE.includes(geste.mode)) return [];
  const attaque = MODES_D_ATTAQUE.includes(geste.mode);
  const camp = campDe(etat, geste.acteur);
  const depart = courantDe(etat, geste.acteur)?.case ?? null;
  const portee = porteeDe(etat, geste);
  return etat.ordre
    .filter((id) => !attaque || campDe(etat, id) !== camp)
    .map((id) => {
      let raison = null;
      if (!vivant(etat, id)) raison = "mort";
      else if (attaque) {
        const ecart = distance(depart, courantDe(etat, id).case);
        if (ecart > portee) raison = `hors de portée : ${accorder(ecart, "case")}, portée ${portee}`;
      }
      return { id, possible: raison === null, raison };
    });
}

/**
 * Les cases où peut mener un déplacement en préparation : à une distance de 1
 * à sa puissance, dans l'ordre A1, A2 … J10. Plusieurs protagonistes tiennent
 * sur une case. Vide pour tout autre geste.
 */
export function arrivees(etat) {
  const geste = enPreparation(etat);
  if (geste === null || geste.mode !== "deplacement") return [];
  return casesDuDeplacement(courantDe(etat, geste.acteur)?.case ?? null, faconDe(etat, geste));
}

// Vrai quand le dé du geste se fait d'une ou deux caractéristiques au choix :
// un jet de caractéristique ; une attaque ou un jet prêté d'un PJ dont l'arme
// n'a pas de dé (les mains nues, ou pas d'arme du tout).
function deAuChoix(etat, geste) {
  if (geste.mode === "caracteristique") return true;
  if (!MODES_D_ATTAQUE.includes(geste.mode) || campDe(etat, geste.acteur) !== "pj") return false;
  const arme = geste.mode === "jet_prete" ? armePreteeDe(etat, geste) : element(photoDe(etat, geste.acteur)?.armes, faconDe(etat, geste)?.arme ?? null);
  return arme === null || arme.faces === null;
}

// La borne de X : le plus petit des restes des ressources dont le coût porte
// X (le souffle ; la jauge qui paie le lien d'un PJ). null quand rien ne le
// porte : X ne se règle pas.
function borneDeX(courant, capacite, facon, geste) {
  const { cout } = facon;
  if (cout === null) return null;
  const restes = [];
  if (cout.souffle === "X") restes.push(courant.souffle);
  if (cout.lien === "X" && courant.camp === "pj") {
    const jauge = jaugeDuLien(courant, capacite, geste.x, geste.jauge);
    restes.push(jauge === null ? 0 : courant.liens[jauge].points);
  }
  return restes.length === 0 ? null : Math.min(...restes);
}

// Les jauges entre lesquelles un PJ choisit : seulement pour une capacité qui
// ne vient pas d'un primordial, quand plusieurs suffisent.
function jaugesAuChoix(courant, capacite, facon, geste) {
  if (courant.camp !== "pj" || capacite.lien !== null || facon.cout === null || facon.cout.lien === 0) return [];
  const besoin = coutDe(facon, geste.x).lien;
  const suffisantes = courant.liens.map((jauge, indice) => (jauge.points >= besoin ? indice : null)).filter((indice) => indice !== null);
  return suffisantes.length > 1 ? suffisantes : [];
}

const reglageALaMain = (reglage) => ({ valeur: reglage?.valeur ?? 0, min: -BORNE_REGLAGE, max: BORNE_REGLAGE, raison: true });

/**
 * Les réglages offerts au geste en préparation, par champ de l'événement
 * « regler » : { valeur, options?, min?, max?, raison? }. « valeur » est ce
 * qui est réglé à cet instant ; « options », les valeurs permises (pour les
 * caractéristiques : les codes entre lesquels on en choisit une ou deux) ;
 * « min » et « max », les bornes ; « raison », vrai quand le champ en demande
 * une. Rien hors d'un geste en préparation.
 */
export function reglages(etat) {
  const geste = enPreparation(etat);
  if (geste === null) return {};
  const { acteur, mode } = geste;
  const capacite = capaciteDe(etat, acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  const courant = courantDe(etat, acteur);
  const photo = photoDe(etat, acteur);
  if (capacite === null || facon === null || courant === null || photo === null) return {};
  const offerts = {};

  if (capacite.facons.length > 1) {
    offerts.facon = { valeur: geste.facon, options: faconsDe(etat, acteur, geste.capacite).filter(({ actif }) => actif).map((jugee) => jugee.facon) };
  }
  if (mode === "sans_jet" || mode === "jet_prete") offerts.jet_prete = { valeur: mode === "jet_prete", options: [false, true] };
  // Un PJ prête le jet de son arme tenue ; seul un adversaire qui en a
  // plusieurs choisit laquelle.
  if (mode === "jet_prete" && courant.camp !== "pj" && photo.armes.length > 1) {
    offerts.arme_pretee = { valeur: geste.armePretee, options: photo.armes.map((_, indice) => indice) };
  }
  if (MODES_A_CIBLE.includes(mode)) {
    const possibles = cibles(etat)
      .filter(({ possible }) => possible)
      .map(({ id }) => id);
    offerts.cible = { valeur: geste.cible, options: mode === "sans_jet" ? [null, ...possibles] : possibles };
  }
  if (mode === "deplacement") offerts.arrivee = { valeur: geste.arrivee, options: arrivees(etat) };
  if (deAuChoix(etat, geste)) offerts.caracteristiques = { valeur: geste.caracteristiques, options: [...CODES_CARACTERISTIQUES] };
  if (mode === "caracteristique") {
    offerts.difficulte = { valeur: geste.difficulte, min: Math.min(...VALEURS_DE_DIFFICULTE), max: Math.max(...VALEURS_DE_DIFFICULTE) };
  }
  const borne = borneDeX(courant, capacite, facon, geste);
  if (borne !== null) offerts.x = { valeur: geste.x, min: 0, max: borne };
  const jauges = jaugesAuChoix(courant, capacite, facon, geste);
  if (jauges.length > 0) offerts.jauge = { valeur: jaugeDuLien(courant, capacite, coutDe(facon, geste.x).lien, geste.jauge), options: jauges };
  if (MODES_A_JET.includes(mode)) {
    offerts.modificateur = reglageALaMain(geste.reglages.modificateur);
    offerts.avantages = reglageALaMain(geste.reglages.avantages);
  }
  return offerts;
}

const AUCUN_GESTE_A_REGLER = "Aucun geste n'est en préparation.";
const CHOISIR_UNE_CIBLE = "Choisissez une cible.";
const CHOISIR_UNE_ARRIVEE = "Choisissez une case d'arrivée.";

// Ce qui manque à un geste en préparation pour se jouer, ou null.
function ceQuiManque(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  if (capacite === null || facon === null) return "Cette capacité ne se joue pas.";
  if (geste.mode === "deplacement" && !arrivees(etat).includes(geste.arrivee)) return CHOISIR_UNE_ARRIVEE;
  if (MODES_D_ATTAQUE.includes(geste.mode) && !cibles(etat).some(({ id, possible }) => possible && id === geste.cible)) return CHOISIR_UNE_CIBLE;
  if (MODES_A_JET.includes(geste.mode)) {
    const { manque } = circonstances(etat, geste);
    if (manque) return manque;
  }
  return empechement(etat, geste.acteur, capacite, facon, { x: geste.x, jauge: geste.jauge });
}

/**
 * Dit si le geste en préparation peut se jouer : tout ce qu'il demande est là
 * (la cible d'une attaque, l'arrivée d'un déplacement, les caractéristiques
 * et la difficulté d'un jet) et son prix se paie, part X comprise. Sinon,
 * « manque » est la phrase à montrer.
 */
export function pret(etat) {
  const geste = enPreparation(etat);
  if (geste === null) return { ok: false, manque: AUCUN_GESTE_A_REGLER };
  const manque = ceQuiManque(etat, geste);
  return manque === null ? { ok: true } : { ok: false, manque };
}

// ─── Les suites d'une attaque ───────────────────────────────────────────────

const esquiveJouee = (geste) => geste.interventions.some((intervention) => intervention.effet?.genre === "annuler");

// Le geste dont les d20 sont tous lancés, et dont les dégâts ne sont pas
// encore appliqués.
function auxSuites(etat) {
  const geste = gesteEnCours(etat);
  return geste !== null && geste.moment === "suites" && geste.resultat === null ? geste : null;
}

/**
 * L'esquive, quand elle est offerte : { min, max, capacite }, où « capacite »
 * est l'indice, chez le PJ visé, de la capacité qui en porte le rôle. Elle
 * l'est avant « Appliquer », au PJ qui va recevoir des dégâts, s'il lui reste
 * une action et du souffle, et une seule fois par attaque. x points de
 * souffle annulent x dégâts : de 1 au plus petit du souffle et du total des
 * dégâts. null sinon : le souffle d'un adversaire n'annule rien.
 */
export function esquiveOfferte(etat) {
  const geste = auxSuites(etat);
  if (geste === null || esquiveJouee(geste)) return null;
  const victime = geste.cible;
  const courant = courantDe(etat, victime);
  if (courant === null || courant.camp !== "pj") return null;
  const capacite = (photoDe(etat, victime)?.capacites ?? []).findIndex(({ role }) => role === "esquive");
  if (capacite === -1) return null;
  const max = Math.min(courant.souffle, degatsFixes(etat, geste).total);
  if (courant.actions < prixDeLEsquive(1).actions || max < 1) return null;
  return { min: 1, max, capacite };
}

// Les décalages offerts, un par d20 lancé : { de, min, max }. Plus aucun dès
// qu'une esquive est jouée.
function decalagesOfferts(etat) {
  const geste = auxSuites(etat);
  const grille = geste === null ? null : photoDe(etat, geste.cible);
  if (grille === null || esquiveJouee(geste)) return [];
  return geste.localisation.map(({ brut }, de) => ({ de, ...bornesDuDecalage(grille, brut) }));
}

// ─── Le dé attendu ──────────────────────────────────────────────────────────

const d20 = (geste) => ({ faces: FACES_LOCALISATION, combien: 1, motif: "localisation", place: geste.localisation.length + 1 });

// Le dé que le combat attend, selon le moment du geste. En préparation, c'est
// le premier dé du jet, et seulement si le geste est prêt : ses circonstances
// sont celles qui se figeront au paiement.
const DE_ATTENDU = {
  preparation(etat, geste) {
    if (!MODES_A_JET.includes(geste.mode) || ceQuiManque(etat, geste) !== null) return null;
    return deAttendu(ouvrirJet(circonstances(etat, geste)));
  },
  jet: (etat, geste) => deAttendu(geste.jet),
  bilan: (etat, geste) => d20(geste),
  localisation: (etat, geste) => (geste.localisation.length < nombreDeD20(etat, geste) ? d20(geste) : null),
};

function deOffert(etat, geste) {
  if (geste === null || !Object.hasOwn(DE_ATTENDU, geste.moment)) return null;
  return DE_ATTENDU[geste.moment](etat, geste);
}

// ─── L'offre ────────────────────────────────────────────────────────────────

const IL_FAUT_DEUX_CAMPS = "Il faut au moins un personnage et un adversaire.";

// Le lancement demande au moins un PJ et un adversaire. C'est la règle de
// peutLancer() (js/combat/preparation.js), relue ici sur l'état : l'offre ne
// voit pas la mise en place.
const peutSeLancer = (etat) => ["pj", "adv"].every((camp) => vivantsDe(etat, camp).length > 0);

// La table « quel événement est valide à quel moment » : une colonne par
// phase du combat, puis par moment du geste en cours. Un type absent de sa
// colonne est refusé, « hors_moment ».
const TABLE = {
  avant: ["lancer"],
  sans_geste: ["capacite", "passer", "fin_de_tour"],
  preparation: ["capacite", "regler", "revenir", "confirmer", "de", "passer", "fin_de_tour"],
  jet: ["de", "relancer", "garder", "exploser"],
  bilan: ["de", "degats"],
  localisation: ["de"],
  suites: ["decaler", "esquive", "appliquer"],
  termine: [],
};

function colonneDe(etat) {
  if (etat.phase === "preparation") return "avant";
  if (etat.phase !== "combat") return "termine";
  const geste = gesteEnCours(etat);
  if (geste === null) return "sans_geste";
  return Object.hasOwn(TABLE, geste.moment) ? geste.moment : "termine";
}

// Dans sa colonne, un type ne s'offre que si un événement de ce type peut
// être accepté : c'est ce que « types » dit aux vues.
const S_OFFRE = {
  lancer: ({ etat }) => peutSeLancer(etat),
  capacite: ({ etat }) => candidats(etat).length > 0,
  passer: ({ etat }) => candidats(etat).length > 0,
  regler: ({ offerts }) => Object.keys(offerts.reglages).length > 0,
  confirmer: ({ geste, offerts }) => MODES_A_CONFIRMER.includes(geste.mode) && offerts.pret.ok,
  de: ({ offerts }) => offerts.de !== null,
  relancer: ({ offerts }) => offerts.choix.includes("relancer"),
  garder: ({ offerts }) => offerts.choix.includes("garder"),
  exploser: ({ offerts }) => offerts.choix.includes("exploser"),
  decaler: ({ offerts }) => offerts.decalages.length > 0,
  esquive: ({ offerts }) => offerts.esquive !== null,
};

/**
 * Tout ce qui s'offre à cet instant :
 * - types : les types d'événement dont un au moins serait accepté ;
 * - de : le dé attendu, { faces, combien, motif, place }, ou null ; « motif »
 *   vaut « chaine », « relance », « explosion » ou « localisation » ;
 * - choix : [], ["exploser"] ou ["relancer", "garder"] ;
 * - pret : pour un geste en préparation, { ok } ou { ok: false, manque } ;
 * - reglages : les champs de « regler » offerts ;
 * - degats : pendant le bilan d'une attaque qui a touché, { bases, natures,
 *   max } ;
 * - decalages : un par d20 lancé, { de, min, max }, tant qu'aucune esquive
 *   n'est jouée ;
 * - esquive : { min, max, capacite }, ou null.
 */
export function offre(etat) {
  const geste = gesteEnCours(etat);
  const colonne = colonneDe(etat);
  const offerts = {
    types: [],
    de: deOffert(etat, geste),
    choix: colonne === "jet" ? choixDuJet(geste.jet) : [],
    pret: colonne === "preparation" ? pret(etat) : null,
    reglages: reglages(etat),
    degats: colonne === "bilan" ? { bases: basesPermises(etat, geste), natures: [...NATURES], max: BORNE_DEGATS } : null,
    decalages: decalagesOfferts(etat),
    esquive: esquiveOfferte(etat),
  };
  offerts.types = TABLE[colonne].filter((type) => !Object.hasOwn(S_OFFRE, type) || S_OFFRE[type]({ etat, geste, offerts }));
  return offerts;
}

// ─── Le jugement d'un événement ─────────────────────────────────────────────

const OUI = Object.freeze({ ok: true });
const refuser = (code, message) => ({ ok: false, code, message });
const horsMoment = (message) => refuser("hors_moment", message);
const horsBornes = (message) => refuser("hors_bornes", message);
const interdit = (message) => refuser("interdit", message);

const INCONNU = "Ce protagoniste n'est pas dans le combat.";
const NE_PEUT_PAS_JOUER = "Ce protagoniste ne peut pas jouer à cet instant.";

// Pourquoi un type n'est pas de sa colonne.
function raisonHorsMoment(colonne, type) {
  if (colonne === "termine") return "Le combat est terminé.";
  if (type === "lancer") return "Le combat est déjà lancé.";
  if (colonne === "avant") return "Le combat n'est pas lancé.";
  if (colonne === "sans_geste") return "Aucun geste n'est en cours.";
  if (TABLE.sans_geste.includes(type)) return "Le geste en cours se finit d'abord.";
  return "Le geste en cours n'en est pas là.";
}

function jugerCandidat(etat, qui) {
  if (courantDe(etat, qui) === null) return horsBornes(INCONNU);
  return candidats(etat).includes(qui) ? OUI : interdit(NE_PEUT_PAS_JOUER);
}

// Une valeur de « regler » contre ce qu'offre son champ.
function jugerValeur(etat, { champ, valeur }, reglage) {
  if (champ === "caracteristiques") {
    return valeur.every((code) => reglage.options.includes(code)) ? OUI : horsBornes("Cette caractéristique n'existe pas.");
  }
  if (champ === "facon" && !reglage.options.includes(valeur)) {
    // Une puissance qu'on ne peut pas payer est un bouton inactif, elle aussi.
    const geste = gesteEnCours(etat);
    const jugee = faconsDe(etat, geste.acteur, geste.capacite)[valeur];
    return jugee ? interdit(jugee.raison) : horsBornes("Cette capacité ne se joue pas de cette façon.");
  }
  if (champ === "cible" && !reglage.options.includes(valeur)) {
    // Un jeton hors de portée est un bouton inactif : sa raison est le message.
    const vise = cibles(etat).find(({ id }) => id === valeur);
    return vise ? interdit(vise.raison) : horsBornes("Ce protagoniste ne peut pas être la cible de ce geste.");
  }
  if (reglage.options) return reglage.options.includes(valeur) ? OUI : horsBornes("Cette valeur n'est pas de celles qui s'offrent.");
  return valeur >= reglage.min && valeur <= reglage.max ? OUI : horsBornes(`Cette valeur ne va que de ${reglage.min} à ${reglage.max}.`);
}

// Ce que chaque type demande de plus, une fois dans sa colonne.
const JUGES = {
  lancer: (etat) => (peutSeLancer(etat) ? OUI : interdit(IL_FAUT_DEUX_CAMPS)),

  capacite(etat, { qui, capacite, facon }) {
    const candidat = jugerCandidat(etat, qui);
    if (!candidat.ok) return candidat;
    const bouton = boutons(etat, qui).find((un) => un.capacite === capacite);
    if (!bouton) return horsBornes("Cette capacité ne se joue pas.");
    if (bouton.facon === null) return interdit(bouton.raison);
    const jugee = faconsDe(etat, qui, capacite)[facon];
    if (!jugee) return horsBornes("Cette capacité ne se joue pas de cette façon.");
    return jugee.actif ? OUI : interdit(jugee.raison);
  },

  regler(etat, evenement) {
    const offerts = reglages(etat);
    if (!Object.hasOwn(offerts, evenement.champ)) return horsMoment("Ce réglage ne s'offre pas à ce geste.");
    return jugerValeur(etat, evenement, offerts[evenement.champ]);
  },

  confirmer(etat) {
    if (!MODES_A_CONFIRMER.includes(gesteEnCours(etat).mode)) return horsMoment("Ce geste se joue par un dé, non par une confirmation.");
    const { ok, manque } = pret(etat);
    return ok ? OUI : interdit(manque);
  },

  de(etat, { faces, valeurs }) {
    const geste = gesteEnCours(etat);
    if (enPreparation(etat) !== null) {
      if (!MODES_A_JET.includes(geste.mode)) return horsMoment("Ce geste ne lance aucun dé.");
      const { ok, manque } = pret(etat);
      if (!ok) return interdit(manque);
    }
    const attendu = deOffert(etat, geste);
    if (attendu === null) return horsMoment("Aucun dé n'est attendu à cet instant.");
    if (faces !== attendu.faces) return horsBornes(`Le dé attendu est un d${attendu.faces}.`);
    if (valeurs.length !== attendu.combien) {
      return horsBornes(`Ce dé attend ${attendu.combien === 1 ? "une valeur" : `${attendu.combien} valeurs`} de 1 à ${attendu.faces}.`);
    }
    return OUI;
  },

  relancer: (etat) => (choixDuJet(gesteEnCours(etat).jet).includes("relancer") ? OUI : horsMoment("Aucun dé ne se relance à cet instant.")),
  garder: (etat) => (choixDuJet(gesteEnCours(etat).jet).includes("garder") ? OUI : horsMoment("Aucun dé n'est à garder à cet instant.")),
  exploser: (etat) => (choixDuJet(gesteEnCours(etat).jet).includes("exploser") ? OUI : horsMoment("Aucun dé n'explose à cet instant.")),

  degats(etat, { base, operations, nature }) {
    if (!basesPermises(etat, gesteEnCours(etat)).includes(base)) return horsBornes("Cette base de dégâts ne s'offre pas à ce geste.");
    const [operation = null] = operations;
    if (nature !== "normaux" && operation === null) return horsBornes("Des dégâts directs demandent un nombre et une raison.");
    if (operation !== null && (operation.valeur < 0 || operation.valeur > BORNE_DEGATS)) return horsBornes(`Les dégâts vont de 0 à ${BORNE_DEGATS}.`);
    return OUI;
  },

  decaler(etat, { de, valeur }) {
    const offerts = decalagesOfferts(etat);
    if (offerts.length === 0) return horsMoment("La face ne se décale plus une fois l'esquive jouée.");
    const borne = offerts.find((un) => un.de === de);
    if (!borne) return horsBornes("Ce dé de localisation n'a pas été lancé.");
    return valeur >= borne.min && valeur <= borne.max ? OUI : horsBornes("La face décalée doit rester sur une zone.");
  },

  esquive(etat, { x }) {
    const offerte = esquiveOfferte(etat);
    if (offerte === null) return horsMoment("L'esquive ne s'offre pas à cet instant.");
    return x >= offerte.min && x <= offerte.max ? OUI : horsBornes(`L'esquive annule de ${offerte.min} à ${offerte.max} dégâts.`);
  },

  passer: (etat, { qui }) => jugerCandidat(etat, qui),
};

const COMBAT_PLEIN = `Ce combat a atteint ${String(EVENEMENTS_MAX).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} événements : commencez-en un nouveau.`;

/**
 * Dit si un événement est accepté à cet instant : { ok: true }, ou
 * { ok: false, code, message }. Elle ne lève jamais, quoi qu'on lui donne
 * pour événement : un combat gardé se rejoue par elle, et il a pu être forgé.
 *
 * La borne du combat passe avant tout : un événement de plus se garderait, et
 * le combat entier serait refusé à sa relecture.
 */
export function accepte(etat, evenement) {
  if (etat.pas >= EVENEMENTS_MAX) return horsBornes(COMBAT_PLEIN);
  const lu = validerEvenement(evenement);
  if (lu.erreur) return refuser("forme", lu.erreur);
  const { type } = lu.evenement;
  const colonne = colonneDe(etat);
  if (!TABLE[colonne].includes(type)) return horsMoment(raisonHorsMoment(colonne, type));
  return Object.hasOwn(JUGES, type) ? JUGES[type](etat, lu.evenement) : OUI;
}
