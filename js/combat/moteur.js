// Le moteur du combat : le réducteur qui, d'un état et d'un événement, fait
// l'état suivant (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) »).
//
// Un combat est une mise en place, puis une suite d'événements, et rien
// d'autre : chaque dé lancé, chaque choix du joueur. Tout le reste (ce que
// vaut chacun, le geste en cours, le journal, l'annonce) se recalcule ici.
// Ce module existe pour que ce calcul n'ait qu'un chemin : l'écran tient
// l'état à jour un événement à la fois (appliquer), et un combat gardé se
// reprend en rejouant les siens par ce même chemin (rejouer). Il retrouve
// alors l'état et le journal au signe près, sans relancer aucun dé.
//
// Trois règles tiennent ce rejeu :
// - appliquer() est pure : elle ne lit ni l'heure, ni le hasard, ni la
//   banque, ni l'écran. Les dés et l'heure du lancement sont dans les
//   événements, les photographies dans la mise en place, et ce qu'un geste
//   tire de la banque (une capacité de blessure, une photographie que le MJ
//   change) entre figé dans son événement ;
// - elle ne modifie rien de ce qu'elle reçoit : elle rend un état neuf, gelé,
//   qui partage avec le précédent tout ce qui n'a pas changé ;
// - elle ne décide pas de ce qui est permis : elle le demande à l'offre
//   (js/combat/offre.js), que lisent aussi les vues. Un événement refusé rend
//   l'état reçu, l'objet même.
//
// Ce qu'il applique (livret, « Tours de jeu », « Temporalité », « Actions de
// jeu », « Combat » ; § 17) :
// - dans un tour, chaque camp joue à son tour, en commençant par celui que
//   désigne le réglage ; le numéro du tour monte quand ce camp rejoue ;
// - le tour d'un camp finit de lui-même quand tous ses vivants ont joué, ou à
//   la demande ; ses protagonistes retrouvent alors toutes leurs actions,
//   qu'ils peuvent dépenser en interventions pendant le tour adverse ;
// - l'action, le souffle et le lien d'un geste se paient d'un coup, au
//   premier dé lancé ou à la confirmation d'une capacité sans jet ;
// - à 0 point de corps, un protagoniste meurt ; quand un camp n'a plus de
//   vivant, le combat est terminé.
//
// Et les conventions provisoires (§ 12, « Pour le lot 4 ») :
// - passer son tour ne coûte rien, et le protagoniste a joué ;
// - une face de contre-attaque annule l'attaque : les d20 restants ne se
//   lancent pas, l'action et le coût de l'attaquant restent payés ;
// - la localisation se fait dès que l'attaque touche, même sans dégâts ;
// - le combat finit sans « Fin du tour » : personne ne retrouve ses actions.
//
// Le geste en cours est le sommet d'une pile (groupe 3 ; contrat de la
// vague 1, § 4) : une intervention jouée dans l'étape « Interventions », ou
// une contre-attaque, s'empile sur le geste qu'elle interrompt, trois étages
// au plus (le geste racine, sa contre-attaque, une intervention). Le geste du
// dessous attend à son moment ; le geste emboîté, fini, le rejoint sans
// écrire de ligne, et le journal dit tout dans la ligne du geste racine. Le
// moment d'un geste ne change que dans avancer(), sur le sommet de la pile :
// préparation, jet, [critique], bilan, localisation, [contre-attaque],
// suites (l'étape « Interventions », puis « Appliquer »), [blessure], fini.
// Un jet ne clôt jamais le geste de lui-même : un manqué ou un jet de
// caractéristique attend « Appliquer », pour que la palette puisse encore
// changer le dernier dé (contrat, § 12, choix 1).
//
// Au groupe 3 encore (mission du lot 4.3, § 4 ; contrat, § 3 à § 6) :
// - attendre se confirme : le protagoniste a joué, et sa garde (un effet
//   durable « guet ») fait de la ligne gardée une intervention jusqu'au
//   prochain tour de son camp ;
// - une façon Centrée vise plusieurs cibles, un jet par cible, le coût payé
//   une fois : chaque cible a sa ligne, sauf la dernière, qui est celle du
//   geste ; une cible morte entre-temps est sautée ; un auteur mort à l'une
//   d'elles ne joue plus, et son geste finit avec elle ;
// - la blessure : une zone sans endurance qui perd du corps se choisit
//   (capacité du bloc de blessure, ajoutée à la photographie, ou état
//   libre) ; un adversaire n'a pas d'étape ;
// - la palette et le MJ s'appliquent dans js/combat/effets.js : le moteur
//   écrit leurs lignes, constate les morts, juge la fin du combat ; les
//   effets durables « tour » s'en vont au début du prochain tour du camp de
//   leur auteur, chacun avec sa ligne, et ceux d'un mort ou d'un retiré, sans
//   ligne, à la fin du geste qui le tue ;
// - un geste retiré sans avoir été payé (« Revenir », une autre capacité,
//   passer, la fin du tour) ne laisse rien derrière lui : la palette n'y a
//   offert que des effets « pour ce jet », et le prix d'un passif payé alors
//   est rendu (contrat, § 12, choix 11).
//
// « Annuler le dernier geste » (groupe 2 ; complément, § 4.10 ; contrat du
// groupe, § 2). Un geste fini (une capacité jouée avec ses dés, un
// déplacement, « Passer son tour », « Fin de tour », avec la mort, la fin du
// combat et les fins de tour automatiques qu'il entraîne) laisse un maillon :
// l'état d'avant lui, sans journal, et la plage des lignes qu'il a écrites.
// « annuler » reprend cet état et y remet le journal courant, qui ne recule
// jamais : une ligne « Annulé » s'y ajoute, et l'écran barre la plage. Les
// maillons forment une liste chaînée gelée, qui partage tout ce qui n'a pas
// changé : annuler coûte comme un clic, et le rejeu reste linéaire. La pile
// ne se garde pas : elle se refait au rejeu, et ne passe jamais par JSON. Au
// groupe 3, le geste racine se défait avec ses gestes emboîtés et les effets
// joués pendant lui ; un geste du MJ et un effet hors d'un geste ont chacun
// leur maillon (contrat, § 10).
//
// Le rejeu (groupe 2 ; contrat, § 4.3, § 4.4 ; relecture du groupe, C-09) :
// un générateur qui rend la main toutes les REJEU_TRANCHE. appliquer()
// recopie le journal une fois par événement qui écrit, et gèle la copie :
// rejouer ainsi N événements recopiait N fois une liste qui s'allonge, un coût
// quadratique. Or le rejeu ne garde aucun état intermédiaire : il ne cède que
// { pas }, et les instantanés de l'annulation n'ont pas de journal. Il passe
// donc par appliquerJournalOuvert(), le chemin même d'appliquer() sans le gel
// du journal, qui laisse la liste ouverte d'un événement à l'autre ; il ne la
// gèle qu'à la fin. Ce chemin n'est pas exporté, et seul le rejeu en garde la
// liste ouverte : appliquer() la gèle aussitôt, et l'écran et la séance n'en
// voient rien. Mesuré dos à dos (Node 24, le poste chargé) : 15 000 passes,
// de 21 à 22 s à moins de 3 s ; 7 499 paires « geste, annuler », de 12 à
// 15 s à un peu plus de 1 s ; la tranche de 1 000 la plus longue, de 3,2 s à
// 0,3 s.

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { circonstances } from "./circonstances.js";
import { basesPermises, blessuresAChoisir, coupsDuGeste, frapper, lettreDuGeste, nombreDeD20, victimeDe } from "./degats.js";
import { appliquerEffet, appliquerMj, echeances, gardeJouable, rendrePrixDesPassifs, sansEffetsDesAbsents } from "./effets.js";
import { validerEvenement } from "./forme.js";
import { critiqueOffert, exploser, garder, garderLeCritique, jetFini, lancerDe, ouvrirJet, relancer, tenterLeCritique } from "./jet.js";
import { annonce, lignes } from "./journal.js";
import { nommer } from "./noms.js";
import {
  accepte,
  attaqueEnPlusDuGeste,
  candidats,
  ciblesDuGeste,
  contreAttaqueOfferte,
  esquiveOfferte,
  faceDeContre,
  modeDeLaFacon,
  prixDeLEsquive,
  prixDuGeste,
  reglages,
} from "./offre.js";
import { REGLES, REJEU_TRANCHE, SANS_ANNULATION, geler } from "./regles.js";
import { campDe, capaciteDe, courantDe, faconDe, gesteEnCours, photoDe, vivant, vivantsDe } from "./valeurs.js";

export { gesteEnCours } from "./valeurs.js";

const CAMPS = ["pj", "adv"];
const AUTRE_CAMP = { pj: "adv", adv: "pj" };
const CODES_CARACTERISTIQUES = CARACTERISTIQUES.map((caracteristique) => caracteristique.code);

// ─── L'ouverture ────────────────────────────────────────────────────────────

/**
 * L'état d'un combat qui n'est pas lancé, d'après sa mise en place. Il se
 * refait à chaque changement de la préparation : rien n'y est gardé d'un
 * appel à l'autre, et les noms courts se recalculent (« Retirer » renumérote
 * ainsi les exemplaires).
 *
 * Les nombres qui bougeront (case, actions, souffle, corps, zones, liens,
 * attaque, défense) sont recopiés ici de chaque photographie : ensuite, plus
 * rien ne les y relit. L'état ne porte ni la mise en place, ni la source des
 * photographies : seulement leurs valeurs, par référence. Au groupe 3,
 * chacun porte aussi « retire » (le MJ l'a retiré du combat) et « bouclier »
 * (la défense de son bouclier que le MJ a changée ; null, celle de sa
 * photographie).
 */
export function ouvrirCombat(miseEnPlace) {
  const { mode, quiCommence, protagonistes } = miseEnPlace;
  return geler({
    regles: REGLES,
    mode,
    quiCommence,
    phase: "preparation",
    ordre: protagonistes.map(({ id }) => id),
    photos: Object.fromEntries(protagonistes.map(({ id, photo }) => [id, photo.valeurs])),
    noms: nommer(protagonistes.map(({ id, camp, photo }) => ({ id, camp, nom: photo.valeurs.nom }))),
    lanceLe: null,
    tour: null,
    protagonistes: Object.fromEntries(
      protagonistes.map(({ id, camp, case: nomDeCase, photo }) => {
        const { actions, souffle, corps, attaque, defense, zones, liens } = photo.valeurs;
        return [
          id,
          {
            camp,
            case: nomDeCase,
            actions,
            actionsMax: actions,
            souffle,
            souffleMax: souffle,
            corps,
            corpsMax: corps,
            attaque,
            defense,
            zones: zones.map(({ armure, resistance }) => ({ armure, armureMax: armure, resistance, resistanceMax: resistance })),
            // Convention provisoire : la jauge de lien part pleine.
            liens: liens.map(({ points }) => ({ points, max: points })),
            passe: false,
            mort: null,
            retire: false,
            bouclier: null,
          },
        ];
      }),
    ),
    effets: [],
    pile: [],
    journal: [],
    annonce: null,
    vainqueur: null,
    pas: 0,
    // Rien à annuler : l'objet même de regles.js, que partagent les états.
    annulation: SANS_ANNULATION,
  });
}

// ─── Les retouches de l'état ────────────────────────────────────────────────
//
// Chacune rend un état neuf qui partage tout ce qu'elle ne change pas. Aucune
// ne gèle, hors le journal : appliquer() gèle l'état une fois, à la fin.

const changer = (etat, id, champs) => ({ ...etat, protagonistes: { ...etat.protagonistes, [id]: { ...etat.protagonistes[id], ...champs } } });

// Ajoute des lignes au journal, faites par les fabriques de js/combat/journal.js,
// qui les rendent gelées. Une seule recopie par événement (contrat du
// groupe 2, § 4.4) : la liste d'un état rendu est gelée, et la première
// écriture d'un événement la recopie dans une liste neuve, non gelée, que les
// écritures suivantes du même événement prolongent ; appliquer() la gèle en
// surface, une fois, à la fin. Le rejeu, lui, ne la gèle qu'après son dernier
// événement : chacun prolonge la liste du précédent, recopiée une fois pour
// tout le combat, à sa première écriture (C-09). Au groupe 1, chaque écriture
// recopiait et gelait la liste : une passe qui finit le tour la recopiait
// deux fois, et le rejeu de 15 000 passes demandait 13,4 s. Une ligne de plus
// ne fait regarder aucune de celles qui la précèdent : elles sont gelées, et
// geler() ne redescend pas dans ce qui l'est déjà. La recopie s'écrit par
// étalement, que le moteur de JavaScript sait faire vite (mesuré : dix fois
// plus vite que slice()).
function ecrire(etat, ...neuves) {
  if (neuves.length === 0) return etat;
  const prolonge = !Object.isFrozen(etat.journal);
  const journal = prolonge ? etat.journal : [...etat.journal];
  journal.push(...neuves);
  return { ...etat, journal };
}

const poserLeGeste = (etat, geste) => ({ ...etat, pile: [...etat.pile.slice(0, -1), geste] });
const retirerLeGeste = (etat) => ({ ...etat, pile: etat.pile.slice(0, -1) });
const empilerLeGeste = (etat, geste) => ({ ...etat, pile: [...etat.pile, geste] });

// Le geste au sommet, retiré sans avoir été payé (« Revenir », ou un geste
// qui cède la place) : le prix d'un passif payé pendant sa préparation est
// rendu, et ses effets, tous « pour ce jet », s'en vont avec lui (contrat,
// § 12, choix 11) ; l'état redevient celui d'avant lui.
const retirerSansPayer = (etat) => retirerLeGeste(rendrePrixDesPassifs(etat, gesteEnCours(etat)));

// Un geste dont rien n'est payé cède la place : jouer autre chose, passer ou
// finir le tour l'emportent, sans rien dépenser.
const sansGesteNonPaye = (etat) => (gesteEnCours(etat)?.paye === false ? retirerSansPayer(etat) : etat);

// Un effet durable de plus, au bout de etat.effets (contrat, § 3).
const poserUnEffet = (etat, effet) => ({ ...etat, effets: [...etat.effets, effet] });

// ─── Les tours ──────────────────────────────────────────────────────────────

// Finit le tour du camp qui joue : ses vivants retrouvent toutes leurs
// actions, l'autre camp joue, et le numéro monte quand le camp qui a commencé
// rejoue. Ce qu'un protagoniste a dépensé en interventions pendant le tour
// adverse lui manque donc à son propre tour : ses actions ne remontent qu'ici.
// Au groupe 3, les effets durables « tour » du camp qui reprend la main s'en
// vont (convention 15), chacun avec sa ligne, juste après celle du tour ; la
// ligne d'une échéance se lit sur l'état qui porte encore l'effet.
function finirLeTour(etat) {
  const { numero, camp } = etat.tour;
  const suivant = AUTRE_CAMP[camp];
  const tour = { numero: numero + (suivant === etat.quiCommence ? 1 : 0), camp: suivant };
  const protagonistes = { ...etat.protagonistes };
  for (const id of vivantsDe(etat, camp)) {
    const courant = protagonistes[id];
    if (courant.actions !== courant.actionsMax || courant.passe) protagonistes[id] = { ...courant, actions: courant.actionsMax, passe: false };
  }
  const tourne = ecrire({ ...etat, tour, protagonistes }, lignes.finDeTour(camp), lignes.tour(tour));
  const { etat: echu, parties } = echeances(tourne, suivant);
  return ecrire(echu, ...parties.map((effet) => lignes.echeance(tourne, effet)));
}

// Deux fins de tour d'affilée au plus : quand aucun des deux camps ne peut
// agir (des adversaires sans action face à des PJ qui ont tout dépensé), le
// combat attend « Fin de tour » au lieu de tourner sans fin.
const FINS_D_AFFILEE = 2;

// Le tour d'un camp finit de lui-même quand tous ses vivants ont joué.
function apres(etat) {
  let suivant = etat;
  for (let fins = 0; fins < FINS_D_AFFILEE && candidats(suivant).length === 0; fins += 1) suivant = finirLeTour(suivant);
  return suivant;
}

// La fin d'un geste racine, d'un geste du MJ : les effets portés par un mort
// ou un retiré s'en vont ; puis le combat finit si un camp n'a plus de vivant
// (sans « Fin du tour »), sinon le tour finit de lui-même si tous ont joué.
function conclure(etat) {
  const fini = sansEffetsDesAbsents(etat);
  const vaincu = CAMPS.find((camp) => vivantsDe(fini, camp).length === 0) ?? null;
  if (vaincu === null) return apres(fini);
  const vainqueur = AUTRE_CAMP[vaincu];
  return { ...ecrire(fini, lignes.fin(vainqueur)), phase: "termine", vainqueur };
}

// La mort d'un protagoniste, au tour où elle survient.
const tuer = (etat, id) => changer(etat, id, { mort: { tour: etat.tour.numero } });

// La victime d'un geste meurt si les coups appliqués l'ont mise à 0 de corps.
const constaterLaMort = (etat, geste) => (geste.resultat?.mort === true ? tuer(etat, victimeDe(geste)) : etat);

// ─── Le geste ───────────────────────────────────────────────────────────────

// Comment se joue une capacité, d'après son rôle et sa façon : ce que dit
// l'offre (modeDeLaFacon), que lisent aussi les vues. Le jet prêté, choisi
// par un réglage, ne tient qu'à une capacité qui se joue sans jet.
function modeDe(etat, geste) {
  const mode = modeDeLaFacon(capaciteDe(etat, geste.acteur, geste.capacite), faconDe(etat, geste), campDe(etat, geste.acteur));
  return mode === "sans_jet" && geste.mode === "jet_prete" ? "jet_prete" : mode;
}

// L'arme qui prête son jet, d'office : pour un PJ, celle de sa photographie
// (l'arme tenue, sinon ses mains nues) ; pour un adversaire, sa première
// arme, et « sans arme » (null) s'il n'en a aucune.
function armePreteeDOffice(etat, id) {
  const photo = photoDe(etat, id);
  if (campDe(etat, id) === "pj") return photo.armePretee;
  return photo.armes.length > 0 ? 0 : null;
}

// Une façon Centrée vise d'abord sa première cible (réglée, sinon cochée
// d'office) : le geste la porte en « cible », que lisent le jet et les vues.
// Tout autre geste n'a pas de liste de cibles.
function viserLaCase(etat, geste) {
  const liste = ciblesDuGeste(etat, geste);
  if (liste === null) return geste.cibles === null ? geste : { ...geste, cibles: null };
  const premiere = liste[0] ?? null;
  return geste.cible === premiere ? geste : { ...geste, cible: premiere, defense: null };
}

/**
 * Un geste neuf, au moment de sa préparation, rien payé (contrat, § 4) :
 * « genre » dit ce qu'il est (« geste » : une capacité jouée ; « intervention » ;
 * « contre_attaque »), « parent » le numéro du geste qu'il interrompt (null
 * pour un geste racine). Tous les champs y sont dès l'ouverture, vides.
 */
function ouvrirUnGeste(etat, { qui, capacite, facon, genre = "geste", parent = null, cible = null, gardee = null }) {
  const geste = {
    numero: etat.pas + 1,
    genre,
    acteur: qui,
    capacite,
    facon,
    mode: null,
    moment: "preparation",
    paye: false,
    prix: null,
    cible,
    arrivee: null,
    depart: null,
    x: 0,
    jauge: null,
    caracteristiques: null,
    difficulte: null,
    armePretee: null,
    // Le type du jet de défense à égalité de dés : null, le défaut proposé.
    defense: null,
    reglages: { modificateur: null, avantages: null },
    jet: null,
    degats: null,
    localisation: [],
    interventions: [],
    resultat: null,
    parent,
    // Le groupe 3.
    garde: null,
    gardee,
    cibles: null,
    rang: 0,
    faites: [],
    effets: [],
    passifs: [],
    critique: null,
    contre: null,
    blessures: [],
    attaqueEnPlus: null,
    sourceDeLAttaqueEnPlus: null,
  };
  return viserLaCase(etat, { ...geste, mode: modeDe(etat, geste) });
}

const reglerALaMain = (champ) => (etat, geste, valeur, raison) => ({
  ...geste,
  reglages: { ...geste.reglages, [champ]: valeur === 0 ? null : { valeur, raison } },
});

// Ce que chaque champ de « regler » change au geste en préparation.
const REGLAGES = {
  facon(etat, geste, valeur) {
    const regle = { ...geste, facon: valeur };
    const mode = modeDe(etat, regle);
    return { ...regle, mode, armePretee: mode === "jet_prete" ? geste.armePretee : null };
  },
  jet_prete(etat, geste, valeur) {
    if (valeur === (geste.mode === "jet_prete")) return geste;
    return { ...geste, mode: valeur ? "jet_prete" : "sans_jet", armePretee: valeur ? armePreteeDOffice(etat, geste.acteur) : null };
  },
  arme_pretee: (etat, geste, valeur) => ({ ...geste, armePretee: valeur }),
  // Une autre cible, un autre dé de défense : la défense choisie retombe au
  // défaut proposé (contrat du groupe 2, § 5.4).
  cible: (etat, geste, valeur) => ({ ...geste, cible: valeur, defense: null }),
  defense: (etat, geste, valeur) => ({ ...geste, defense: valeur }),
  arrivee: (etat, geste, valeur) => ({ ...geste, arrivee: valeur }),
  // Rangées dans l'ordre des neuf caractéristiques, quel que soit l'ordre du
  // choix : le jet, le journal et les vues lisent la même liste.
  caracteristiques: (etat, geste, valeur) => ({ ...geste, caracteristiques: CODES_CARACTERISTIQUES.filter((code) => valeur.includes(code)) }),
  difficulte: (etat, geste, valeur) => ({ ...geste, difficulte: valeur }),
  x: (etat, geste, valeur) => ({ ...geste, x: valeur }),
  jauge: (etat, geste, valeur) => ({ ...geste, jauge: valeur }),
  modificateur: reglerALaMain("modificateur"),
  avantages: reglerALaMain("avantages"),
  // Le groupe 3 : la ligne qu'attendre garde ; les cibles d'une façon
  // Centrée, dans l'ordre des jets (viserLaCase pose la première).
  garde: (etat, geste, valeur) => ({ ...geste, garde: valeur }),
  cibles: (etat, geste, valeur) => ({ ...geste, cibles: [...valeur] }),
};

// Ce qu'un réglage peut rendre caduc, et la valeur qui l'efface. La jauge
// passe avant X, qu'elle borne.
const A_REVALIDER = [
  ["cible", null],
  ["cibles", null],
  ["defense", null],
  ["arrivee", null],
  ["caracteristiques", null],
  ["jauge", null],
  ["x", 0],
];

const tient = (reglage, valeur) => {
  if (!reglage) return false;
  if (reglage.options) return Array.isArray(valeur) ? valeur.every((un) => reglage.options.includes(un)) : reglage.options.includes(valeur);
  return valeur >= reglage.min && valeur <= reglage.max;
};

// La cible ne se règle pas toujours : une façon Centrée la tient de ses
// cibles, une contre-attaque vise l'attaquant. Elle ne se revalide alors pas.
const cibleReglable = (etat, geste) => geste.genre !== "contre_attaque" && ciblesDuGeste(etat, geste) === null;

// Après un réglage, ce que le geste portait et que l'offre ne permet plus se
// retire : une cible que la nouvelle portée n'atteint pas, une arrivée trop
// lointaine pour la nouvelle puissance, un X que le nouveau coût ne porte
// plus, des cibles qu'une façon qui n'est plus Centrée n'a plus.
function revalider(etat, geste) {
  let revu = geste;
  for (const [champ, vide] of A_REVALIDER) {
    if (revu[champ] === vide || (champ === "cible" && !cibleReglable(etat, revu))) continue;
    if (!tient(reglages(poserLeGeste(etat, revu))[champ], revu[champ])) revu = { ...revu, [champ]: vide };
  }
  return viserLaCase(etat, revu);
}

// Les cibles d'une façon Centrée se figent au premier dé (contrat, § 4.4) :
// plusieurs, elles se jouent dans l'ordre, la première en cours ; une seule,
// c'est une attaque ordinaire, sans liste.
function figerLesCibles(etat, geste) {
  const liste = ciblesDuGeste(etat, geste);
  if (liste === null) return geste;
  return { ...geste, cible: liste[0], cibles: liste.length > 1 ? [...liste] : null, rang: 0 };
}

// Paie le prix du geste, d'un coup : les actions, le souffle, et le lien sur
// la jauge que dit le prix. Le prix reste dans le geste : le journal le dit.
// Une attaque en plus (contrat, § 5.5) se consomme ici : son effet durable
// s'en va, et le geste en garde l'identifiant et la source.
function payer(etat, geste) {
  const prix = prixDuGeste(etat, geste);
  const enPlus = attaqueEnPlusDuGeste(etat, geste);
  const courant = courantDe(etat, geste.acteur);
  const liens = prix.jauge === null ? courant.liens : courant.liens.map((jauge, indice) => (indice === prix.jauge ? { ...jauge, points: jauge.points - prix.lien } : jauge));
  const paye = changer(etat, geste.acteur, { actions: courant.actions - prix.actions, souffle: courant.souffle - prix.souffle, liens });
  return {
    etat: enPlus === null ? paye : { ...paye, effets: paye.effets.filter((effet) => effet !== enPlus) },
    geste: { ...geste, paye: true, prix, attaqueEnPlus: enPlus?.id ?? null, sourceDeLAttaqueEnPlus: enPlus?.source ?? null },
  };
}

// La garde d'attendre (contrat, § 6.2) : le protagoniste a joué, et un effet
// durable « guet » fait de la ligne gardée une intervention jusqu'au prochain
// tour de son camp.
function guetter(etat, geste) {
  const qui = geste.acteur;
  const camp = campDe(etat, qui);
  const guet = {
    id: etat.pas + 1,
    genre: "guet",
    porteur: qui,
    auteur: qui,
    camp,
    duree: "tour",
    source: { genre: "capacite", qui, capacite: geste.capacite },
    garde: geste.garde,
  };
  return poserUnEffet(changer(etat, qui, { passe: true }), guet);
}

// ─── La fin d'un geste ──────────────────────────────────────────────────────

// Les champs propres à une cible : ils passent dans « faites » quand elle est
// finie, et repartent vides pour la suivante (contrat, § 4.3).
const CHAMPS_D_UNE_CIBLE = {
  jet: null,
  degats: null,
  localisation: [],
  interventions: [],
  resultat: null,
  critique: null,
  contre: null,
  blessures: [],
  passifs: [],
  defense: null,
};

// La prochaine cible d'un geste à plusieurs cibles, après celle en cours : la
// première qui vit encore et que le jet peut viser. -1 s'il n'y en a plus, ou
// si l'auteur du geste est mort à cette cible (une contre-attaque ou une
// intervention l'a tué) : un mort ne joue plus (§ 17.3), son geste finit là.
function cibleSuivante(etat, geste) {
  if (geste.cibles === null) return -1;
  if (!vivant(etat, geste.acteur)) return -1;
  for (let rang = geste.rang + 1; rang < geste.cibles.length; rang += 1) {
    const cible = geste.cibles[rang];
    if (vivant(etat, cible) && !circonstances(etat, { ...geste, ...CHAMPS_D_UNE_CIBLE, cible }).manque) return rang;
  }
  return -1;
}

// Une cible finie avant la dernière (contrat, § 4.3) : sa ligne s'écrit, sa
// victime meurt si son corps est à 0, ce qui lui est propre passe dans
// « faites », et le jet de la cible suivante s'ouvre aussitôt, sans rien
// payer.
function passerALaCible(etat, geste, rang) {
  const fini = sansEffetsDesAbsents(constaterLaMort(ecrire(etat, lignes.geste(etat, geste)), geste));
  const faite = {
    rang: geste.rang,
    cible: geste.cible,
    ...Object.fromEntries(Object.keys(CHAMPS_D_UNE_CIBLE).map((champ) => [champ, geste[champ]])),
    effets: geste.effets.filter((effet) => (effet.rang ?? 0) === geste.rang),
  };
  const suivante = {
    ...geste,
    ...CHAMPS_D_UNE_CIBLE,
    faites: [...geste.faites, faite],
    effets: geste.effets.filter((effet) => (effet.rang ?? 0) !== geste.rang),
    rang,
    cible: geste.cibles[rang],
    moment: "jet",
  };
  return poserLeGeste(fini, { ...suivante, jet: ouvrirJet(circonstances(fini, suivante)) });
}

// Un geste racine fini (la dernière de ses cibles) : sa ligne entre au
// journal, il quitte la pile, sa victime meurt si son corps est à 0 ; puis le
// combat finit si un camp n'a plus de vivant, sinon le tour finit de lui-même
// si tous ont joué. La ligne du geste porte « mort: true » quand sa victime
// meurt.
function finirLeGeste(etat, geste) {
  return conclure(constaterLaMort(retirerLeGeste(ecrire(etat, lignes.geste(etat, geste))), geste));
}

// Un geste emboîté fini (contrat, § 4.3) : il quitte la pile sans écrire de
// ligne et rejoint le geste du dessous, une intervention parmi ses
// interventions, une contre-attaque comme sa contre-attaque jouée ; sa
// victime meurt à cet instant si son corps est à 0. La fin du combat ne se
// juge qu'à la fin du geste racine.
function joindreAuDessous(etat, geste) {
  const sans = sansEffetsDesAbsents(constaterLaMort(retirerLeGeste(etat), geste));
  const dessous = gesteEnCours(sans);
  const joint = geste.genre === "contre_attaque" ? { ...dessous, contre: { statut: "jouee", geste } } : { ...dessous, interventions: [...dessous.interventions, { geste }] };
  return poserLeGeste(sans, joint);
}

// ─── Les moments ────────────────────────────────────────────────────────────

const FINI = Object.freeze({ moment: "fini" });

// Un jet fini mène au bilan s'il touche (les dégâts posés : la base par
// défaut, sans opération), sinon aux suites, où un manqué attend
// « Appliquer » : un jet ne clôt jamais le geste de lui-même.
function suiteDuJet(etat, geste) {
  if (lettreDuGeste(etat, geste) === null) return { moment: "suites", pose: { degats: null } };
  return { moment: "bilan", pose: { degats: { base: basesPermises(etat, geste)[0] ?? "aucun", operations: [], nature: "normaux" } } };
}

// Après un jet fini : l'étape du critique s'il s'offre au PJ qui lance
// (contrat, § 7.1), sinon la suite du jet.
function apresLeJet(etat, geste) {
  if (geste.critique === null && critiqueOffert(geste.jet, campDe(etat, geste.jet.lanceur))) return { moment: "critique" };
  return suiteDuJet(etat, geste);
}

// Un moment qui se relit d'après le jet (contrat, § 4.1) : la palette a pu le
// changer. Un jet rouvert y retourne, ses dégâts retombés ; un jet fini mène
// où il mène désormais. null s'il reste où il est.
function relire(etat, geste) {
  if (!jetFini(geste.jet)) return { moment: "jet", pose: { degats: null } };
  const suite = apresLeJet(etat, geste);
  return suite.moment === geste.moment ? null : suite;
}

// Les suites se relisent tant que rien n'y est joué : ni d20, ni
// intervention, ni esquive.
const relisible = (geste) => geste.localisation.length === 0 && geste.interventions.length === 0;

// La face de contre-attaque annule le coup (convention 12). Un geste racine
// joué comme une capacité ouvre la contre-attaque du jeté s'il le peut ;
// sinon la raison reste au geste, que le journal dit. Un geste emboîté
// n'ouvre rien : sa propre face l'annule, sans plus.
function apresLaFace(etat, geste) {
  if (geste.genre !== "geste") return FINI;
  const offerte = contreAttaqueOfferte(etat);
  if (offerte.possible) return { moment: "contre_attaque" };
  const { raison, arme, portee, distance } = offerte;
  return { ...FINI, pose: { contre: { statut: "impossible", raison, arme, portee, distance } } };
}

// Le moment qui suit celui du geste au sommet de la pile, { moment, pose? },
// ou null s'il attend un choix.
function momentSuivant(etat, geste) {
  switch (geste.moment) {
    case "preparation":
      // Payé sans jet (une capacité sans jet, un déplacement, attendre) :
      // c'est fini.
      if (!geste.paye) return null;
      return geste.jet === null ? FINI : { moment: "jet" };
    case "jet":
      return jetFini(geste.jet) ? apresLeJet(etat, geste) : null;
    case "critique":
      if (geste.critique === "garde") return suiteDuJet(etat, geste);
      if (geste.critique === "tente") return { moment: "jet" };
      return relire(etat, geste);
    case "bilan":
      return geste.localisation.length > 0 ? { moment: "localisation" } : relire(etat, geste);
    case "localisation":
      if (faceDeContre(etat, geste)) return apresLaFace(etat, geste);
      return geste.localisation.length >= nombreDeD20(etat, geste) ? { moment: "suites" } : null;
    case "contre_attaque":
      return geste.contre !== null ? FINI : null;
    case "suites":
      if (geste.resultat !== null) return blessuresAChoisir(etat, geste).length > 0 ? { moment: "blessure" } : FINI;
      return relisible(geste) ? relire(etat, geste) : null;
    case "blessure":
      return blessuresAChoisir(etat, geste).length === 0 ? FINI : null;
    default:
      return null;
  }
}

/**
 * Fait passer le geste au sommet de la pile au moment suivant tant qu'il
 * n'attend aucun choix, et le finit quand il est fini. C'est le seul endroit
 * où le moment d'un geste change : les réducteurs posent ce que l'événement
 * apporte (un dé, un prix payé, des dégâts appliqués), et le moment s'en
 * déduit ici. Un geste emboîté fini rejoint le dessous, qui reprend à son
 * tour ; une cible finie avant la dernière ouvre le jet de la suivante.
 *
 * Rend { etat, geste, racine } : « geste » est celui que l'événement a fait
 * avancer, tel qu'il est après lui (encore sur la pile, ou fini), ou null ;
 * « racine », le geste racine quand l'événement l'a fini, sinon null.
 */
function avancer(depart) {
  let etat = depart;
  let geste = gesteEnCours(etat);
  let agi = geste;
  while (geste !== null) {
    const suite = momentSuivant(etat, geste);
    if (suite === null) break;
    const avance = { ...geste, ...suite.pose, moment: suite.moment };
    if (agi === geste) agi = avance;
    if (avance.moment !== "fini") {
      geste = avance;
      etat = poserLeGeste(etat, geste);
      continue;
    }
    const pose = poserLeGeste(etat, avance);
    if (pose.pile.length > 1) {
      etat = joindreAuDessous(pose, avance);
      geste = gesteEnCours(etat);
      continue;
    }
    // La cible suivante se cherche une fois la victime de celle-ci morte : une
    // cible que ce coup a tuée (un report) est sautée.
    const rang = cibleSuivante(constaterLaMort(pose, avance), avance);
    if (rang !== -1) {
      etat = passerALaCible(pose, avance, rang);
      return { etat, geste: agi, racine: null };
    }
    return { etat: finirLeGeste(pose, avance), geste: agi, racine: avance };
  }
  return { etat, geste: agi, racine: null };
}

// ─── Les réducteurs ─────────────────────────────────────────────────────────
//
// Un par type d'événement. L'offre a déjà accepté l'événement : aucun ne
// revérifie ce qu'elle a jugé.

const REDUCTEURS = {
  lancer(etat, { le }) {
    const tour = { numero: 1, camp: etat.quiCommence };
    const lance = { ...etat, phase: "combat", lanceLe: le, tour };
    // Un camp qui commence sans pouvoir agir (des adversaires sans action)
    // voit son tour finir dès le lancement.
    return apres(ecrire(lance, lignes.lancement(lance), lignes.tour(tour)));
  },

  capacite(etat, { qui, capacite, facon }) {
    const libre = sansGesteNonPaye(etat);
    return empilerLeGeste(libre, ouvrirUnGeste(etat, { qui, capacite, facon }));
  },

  // Une intervention (contrat, § 6.1) : dans l'étape « Interventions », un
  // geste emboîté sur celui du dessous ; entre deux gestes (« Intervenir… »),
  // un geste racine. Une ligne gardée garde l'identifiant de sa garde.
  intervenir(etat, { qui, capacite, facon }) {
    const dessous = gesteEnCours(etat);
    const intervention = faconDe(etat, { acteur: qui, capacite, facon })?.intervention === true;
    const gardee = intervention ? null : (gardeJouable(etat, qui, capacite, facon)?.id ?? null);
    return empilerLeGeste(etat, ouvrirUnGeste(etat, { qui, capacite, facon, genre: "intervention", parent: dessous?.numero ?? null, gardee }));
  },

  // La contre-attaque du jeté (contrat, § 6.4) : un geste emboîté, qui vise
  // l'attaquant du dessous, déjà posé.
  contre_attaquer(etat, { capacite, facon }) {
    const dessous = gesteEnCours(etat);
    return empilerLeGeste(etat, ouvrirUnGeste(etat, { qui: dessous.cible, capacite, facon, genre: "contre_attaque", parent: dessous.numero, cible: dessous.acteur }));
  },

  laisser: (etat) => poserLeGeste(etat, { ...gesteEnCours(etat), contre: { statut: "laissee" } }),

  critique(etat, { tenter }) {
    const geste = gesteEnCours(etat);
    const { jet } = tenter ? tenterLeCritique(geste.jet) : garderLeCritique(geste.jet);
    return poserLeGeste(etat, { ...geste, jet, critique: tenter ? "tente" : "garde" });
  },

  regler(etat, { champ, valeur, raison }) {
    return poserLeGeste(etat, revalider(etat, REGLAGES[champ](etat, gesteEnCours(etat), valeur, raison)));
  },

  revenir: (etat) => retirerSansPayer(etat),

  confirmer(etat) {
    const { etat: paye, geste } = payer(etat, gesteEnCours(etat));
    if (geste.mode === "attendre") return poserLeGeste(guetter(paye, geste), geste);
    if (geste.mode !== "deplacement") return poserLeGeste(paye, geste);
    const depart = courantDe(paye, geste.acteur).case;
    return poserLeGeste(changer(paye, geste.acteur, { case: geste.arrivee }), { ...geste, depart });
  },

  de(etat, { valeurs }) {
    const geste = gesteEnCours(etat);
    if (!geste.paye) {
      // Le premier dé paie, et fige les circonstances du jet : ce que le
      // joueur a lu avant de lancer est ce qui s'applique. Les cibles d'une
      // façon Centrée se figent avec lui.
      const vise = figerLesCibles(etat, geste);
      const jet = ouvrirJet(circonstances(etat, vise));
      const { etat: paye, geste: lance } = payer(etat, vise);
      return poserLeGeste(paye, { ...lance, jet: lancerDe(jet, valeurs).jet });
    }
    if (!jetFini(geste.jet)) return poserLeGeste(etat, { ...geste, jet: lancerDe(geste.jet, valeurs).jet });
    return poserLeGeste(etat, { ...geste, localisation: [...geste.localisation, { brut: valeurs[0], decalage: null }] });
  },

  relancer: (etat) => poserLeGeste(etat, { ...gesteEnCours(etat), jet: relancer(gesteEnCours(etat).jet).jet }),
  garder: (etat) => poserLeGeste(etat, { ...gesteEnCours(etat), jet: garder(gesteEnCours(etat).jet).jet }),
  exploser: (etat) => poserLeGeste(etat, { ...gesteEnCours(etat), jet: exploser(gesteEnCours(etat).jet).jet }),

  degats: (etat, { base, operations, nature }) => poserLeGeste(etat, { ...gesteEnCours(etat), degats: { base, operations, nature } }),

  decaler(etat, { de, valeur, raison }) {
    const geste = gesteEnCours(etat);
    const decalage = valeur === 0 ? null : { valeur, raison };
    return poserLeGeste(etat, { ...geste, localisation: geste.localisation.map((d20, rang) => (rang === de ? { ...d20, decalage } : d20)) });
  },

  esquive(etat, { x }) {
    const geste = gesteEnCours(etat);
    const qui = victimeDe(geste);
    const { capacite } = esquiveOfferte(etat);
    // L'esquive se paie tout de suite, sur le PJ visé : l'action qu'il y
    // dépense lui manquera à son propre tour.
    const prix = prixDeLEsquive(x);
    const courant = courantDe(etat, qui);
    const paye = changer(etat, qui, { actions: courant.actions - prix.actions, souffle: courant.souffle - prix.souffle });
    return poserLeGeste(paye, { ...geste, interventions: [...geste.interventions, { qui, capacite, prix, effet: { genre: "annuler", x } }] });
  },

  // Applique les dégâts (« Appliquer ») ; un manqué, un jet de
  // caractéristique ou un geste sans d20 n'a aucun coup : il finit sans rien
  // changer.
  appliquer(etat) {
    const geste = gesteEnCours(etat);
    const courant = courantDe(etat, victimeDe(geste));
    const coups = geste.localisation.length === 0 || courant === null ? [] : coupsDuGeste(etat, geste);
    if (coups.length === 0) return poserLeGeste(etat, { ...geste, resultat: { coups: [], mort: false } });
    const { courant: frappe, coups: rendus, mort } = frapper(courant, coups);
    const touche = { ...etat, protagonistes: { ...etat.protagonistes, [victimeDe(geste)]: frappe } };
    return poserLeGeste(touche, { ...geste, resultat: { coups: rendus, mort } });
  },

  // La blessure d'un personnage, pour la première zone qui l'attend
  // (contrat, § 5.9) : une capacité du bloc de blessure, figée dans
  // l'événement, rejoint sa photographie pour ce combat, et un effet durable
  // « etat » la montre jusqu'à la fin du combat ; un état libre, nommé par le
  // MJ, n'est que l'effet. L'effet porte la zone blessée.
  blessure(etat, { capacite = null, libre = null }) {
    const geste = gesteEnCours(etat);
    const victime = victimeDe(geste);
    const [zone] = blessuresAChoisir(etat, geste);
    const photo = photoDe(etat, victime);
    const commun = { id: etat.pas + 1, genre: "etat", porteur: victime, auteur: geste.acteur, camp: campDe(etat, geste.acteur), duree: "combat", blessure: true, zone };
    let blesse;
    if (capacite !== null) {
      const indice = photo.capacites.length;
      const prolonge = { ...etat, photos: { ...etat.photos, [victime]: { ...photo, capacites: [...photo.capacites, capacite] } } };
      blesse = poserUnEffet(prolonge, { ...commun, source: { genre: "capacite", qui: victime, capacite: indice }, capacite, libre: null });
    } else {
      blesse = poserUnEffet(etat, { ...commun, source: { genre: "mj" }, capacite: null, libre });
    }
    return poserLeGeste(blesse, { ...geste, blessures: [...geste.blessures, { zone, capacite, libre }] });
  },

  passer(etat, { qui }) {
    const passe = changer(sansGesteNonPaye(etat), qui, { passe: true });
    return apres(ecrire(passe, lignes.passe(passe, qui)));
  },

  fin_de_tour: (etat) => apres(finirLeTour(sansGesteNonPaye(etat))),

  // Un geste du MJ (contrat, § 6.3) : js/combat/effets.js l'applique ; sa
  // ligne s'écrit, un corps mis à 0 tue, et la fin du combat se juge.
  mj(etat, evenement) {
    const { etat: applique } = appliquerMj(etat, evenement);
    const ecrit = ecrire(applique, lignes.mj(etat, applique, evenement));
    const courant = courantDe(ecrit, evenement.qui);
    return conclure(courant.mort === null && courant.corps <= 0 ? tuer(ecrit, evenement.qui) : ecrit);
  },

  // Reprend l'état d'avant le dernier geste fini, sans son journal : le
  // journal courant y revient, avec la ligne « Annulé », et le maillon quitte
  // la pile. L'offre a jugé qu'il y en a un, et qu'aucun geste n'est en
  // cours. appliquer() pose ensuite le pas et l'annonce : ni l'un ni le
  // journal ne reculent.
  annuler(etat) {
    const maillon = etat.annulation.pile;
    const repris = { ...maillon.avant, journal: etat.journal, annonce: etat.annonce, annulation: { attente: null, pile: maillon.precedent } };
    return ecrire(repris, lignes.annulation(etat, maillon.quoi, maillon.plage));
  },
};

// Un effet de la palette (contrat, § 5) : js/combat/effets.js l'applique.
// Pendant un geste, il y reste (le journal le dit dans la ligne du geste) ;
// hors d'un geste, sa ligne s'écrit. Rend { etat, effet }, l'effet tel
// qu'appliqué, que garde le maillon de l'annulation.
function reduireLEffet(etat, evenement) {
  const { etat: applique, effet } = appliquerEffet(etat, evenement);
  if (gesteEnCours(etat) !== null) return { etat: applique, effet };
  return { etat: ecrire(applique, lignes.effet(etat, applique, effet)), effet };
}

// ─── L'annulation ───────────────────────────────────────────────────────────

// L'état d'avant un geste, tel que l'annulation le reprendra : une copie de
// surface, gelée, qui partage tout avec son état, sans journal ni annonce, ni
// pile d'annulation (le maillon qui le porte sait la sienne).
const instantane = (etat) => geler({ ...etat, journal: null, annulation: null, annonce: null });

// Un maillon de plus sur la pile : le geste défait se nomme par « quoi » ;
// « plage » est [début, fin) des lignes qu'il a écrites, contiguës.
const empiler = (pile, avant, quoi, plage) => geler({ attente: null, pile: { avant, quoi, plage, precedent: pile } });

// Ce qui engage un geste racine encore non payé : son premier dé, sa
// confirmation, ou un premier effet de la palette qui s'y applique (un passif
// peut s'y payer, une ressource s'y rendre).
const ENGAGENT = ["de", "confirmer", "effet"];

/**
 * L'annulation de l'état d'après un événement accepté (contrat du groupe 2,
 * § 2.3 ; contrat de la vague 1, § 10) :
 * - « passer » et « fin_de_tour » sont des gestes à eux seuls : un maillon,
 *   pris de l'état d'avant eux, le geste non payé qu'ils retirent ôté ; de
 *   même un geste du MJ, et un effet hors d'un geste ;
 * - ce qui engage le geste racine (le bas de la pile) met de côté l'état
 *   d'avant ce geste (« attente »), et le rang de la première ligne qu'il
 *   écrira (« debut ») : tout ce qui suit se défera d'un coup, ses gestes
 *   emboîtés, ses effets et ses cibles compris ; s'il s'en va sans avoir été
 *   payé, l'attente s'oublie ;
 * - l'événement après lequel le geste racine est fini (sa mort, la fin du
 *   combat et les fins de tour qu'il entraîne comprises) en fait un maillon,
 *   dont la plage court de « debut » à la fin du journal : un geste à
 *   plusieurs cibles écrit ses lignes en plusieurs événements ;
 * - tout autre événement la laisse telle quelle, l'objet même. Ni le
 *   lancement ni ses suites ne se défont.
 *
 * « lignesAvant » est la longueur du journal avant l'événement, lue avant le
 * réducteur : au rejeu, l'état reçu et l'état d'après partagent la même liste
 * ouverte, et la longueur de la première serait déjà celle de la seconde.
 * « fin » est ce qu'a rendu l'événement : { racine, effet }.
 */
function suivreLAnnulation(etat, lu, suivant, fin, lignesAvant) {
  const courante = etat.annulation ?? SANS_ANNULATION;
  const plage = (debut) => [debut, suivant.journal.length];
  if (lu.type === "passer") return empiler(courante.pile, instantane(sansGesteNonPaye(etat)), { genre: "passer", qui: lu.qui }, plage(lignesAvant));
  if (lu.type === "fin_de_tour") return empiler(courante.pile, instantane(sansGesteNonPaye(etat)), { genre: "fin_de_tour", camp: etat.tour.camp }, plage(lignesAvant));
  if (lu.type === "mj") return empiler(courante.pile, instantane(etat), { genre: "mj", evenement: lu }, plage(lignesAvant));
  // Un geste racine qui s'en va sans avoir été payé (« Revenir », une autre
  // capacité) ne laisse rien à défaire : l'état d'avant lui, qu'un premier
  // effet avait mis de côté, s'oublie (contrat, § 12, choix 11).
  if (courante.attente !== null && (lu.type === "capacite" || (lu.type === "revenir" && etat.pile.length === 1))) {
    return courante.pile === null ? SANS_ANNULATION : geler({ attente: null, pile: courante.pile });
  }
  const racine = etat.pile[0] ?? null;
  if (racine === null) {
    return lu.type === "effet" ? empiler(courante.pile, instantane(etat), { genre: "effet", effet: fin.effet }, plage(lignesAvant)) : courante;
  }
  const engage = racine.paye === false && (racine.effets ?? []).length === 0 && ENGAGENT.includes(lu.type);
  const attente = engage ? instantane({ ...etat, pile: [] }) : courante.attente;
  const debut = engage ? lignesAvant : (courante.debut ?? lignesAvant);
  if (fin.racine !== null) return empiler(courante.pile, attente, { genre: "capacite", geste: fin.racine }, plage(debut));
  return attente === courante.attente ? courante : geler({ attente, debut, pile: courante.pile });
}

// ─── Appliquer, rejouer ─────────────────────────────────────────────────────

// Gèle en profondeur l'état d'après un événement, hors sa liste du journal,
// que geler() figerait en passant : chaque autre champ par geler(), qui ne
// reparcourt pas ce qui l'est déjà, puis l'objet, en surface. regles.js
// défend de geler ainsi à la main un objet dont une partie ne l'est pas
// encore (geler() le croirait fini) : l'état fait ici ne sort donc jamais du
// moteur tant que sa liste reste ouverte. appliquer() la gèle aussitôt, le
// rejeu après son dernier événement.
function gelerHorsDuJournal(etat) {
  for (const [champ, valeur] of Object.entries(etat)) if (champ !== "journal") geler(valeur);
  return Object.freeze(etat);
}

/**
 * Ce que fait appliquer(), la liste du journal laissée ouverte : { etat }, ou
 * { etat, refus }. L'état rendu est gelé en profondeur, hors cette liste, que
 * l'événement suivant prolongera au lieu de la recopier (voir ecrire). Non
 * exporté : appliquer() la gèle aussitôt, et seul le rejeu, qui ne garde
 * aucun état intermédiaire, la laisse ouverte d'un événement à l'autre.
 */
function appliquerJournalOuvert(etat, evenement) {
  const verdict = accepte(etat, evenement);
  if (!verdict.ok) return { etat, refus: { code: verdict.code, message: verdict.message } };
  // La copie gelée de l'événement, aux seuls champs connus : c'est elle que
  // le geste garde (les opérations des dégâts, par exemple).
  const lu = validerEvenement(evenement).evenement;
  // Lue avant le réducteur : au rejeu, l'état reçu et l'état d'après
  // partagent la liste ouverte, dont la longueur ne dit plus, ensuite, où
  // l'événement a commencé d'écrire (la plage d'un maillon, l'annonce).
  const lignesAvant = etat.journal.length;
  const { etat: reduit, effet = null } = lu.type === "effet" ? reduireLEffet(etat, lu) : { etat: REDUCTEURS[lu.type](etat, lu) };
  const { etat: suivant, geste, racine } = avancer(reduit);
  const annulation = lu.type === "annuler" ? suivant.annulation : suivreLAnnulation(etat, lu, suivant, { racine, effet }, lignesAvant);
  const pas = etat.pas + 1;
  const texte = annonce(suivant, geste, lu, lignesAvant);
  return { etat: gelerHorsDuJournal({ ...suivant, annonce: texte === null ? etat.annonce : { pas, texte }, pas, annulation }) };
}

/**
 * Applique un événement à un état, et rend { etat }, ou { etat, refus }.
 *
 * Elle ne lève jamais, quel que soit l'événement. Un événement refusé rend
 * l'état reçu, l'objet même, et « refus » : { code, message } (les quatre
 * codes sont ceux de l'offre). Sinon l'état rendu est neuf, gelé en
 * profondeur, et partage avec le précédent tout ce qui n'a pas changé.
 *
 * L'annonce (ce que dit la région d'annonce de l'écran) suit : quand
 * l'événement n'a rien à dire, celle d'avant reste, l'objet même. De même
 * l'annulation (voir suivreLAnnulation) et le journal, quand l'événement n'y
 * écrit rien.
 *
 * Une recopie du journal par événement qui écrit (contrat du groupe 2,
 * § 4.4) : la liste reçue est gelée, sa première écriture la recopie, et la
 * liste neuve se gèle ici.
 */
export function appliquer(etat, evenement) {
  const rendu = appliquerJournalOuvert(etat, evenement);
  // La liste neuve du journal, gelée en surface, une fois : ses lignes le sont
  // déjà, et geler() ne la reparcourt donc pas.
  if (rendu.refus === undefined) Object.freeze(rendu.etat.journal);
  return rendu;
}

const VERSION_INCONNUE = "Ce combat a été commencé avec une autre version des règles.";
const CONTENU_ILLISIBLE = "Le contenu de ce combat ne se lit pas.";

/**
 * Refait l'état d'un combat gardé, en rendant la main (contrat du groupe 2,
 * § 4.3) : ouvrirCombat() sur sa mise en place, puis chacun de ses
 * événements, par le chemin même du jeu. Un générateur pur : il cède
 * { pas } après chaque tranche de « tranche » événements (le nombre de ceux
 * déjà appliqués), et celui qui le mène rend la main au navigateur entre
 * deux. Il rend { etat }, ou { erreur: { pas, code, message } } au premier
 * refus (« pas » est le numéro de l'événement refusé, 0 pour le contenu
 * lui-même) : la suite n'est jamais tronquée en silence, un combat qui ne se
 * rejoue pas est une donnée abîmée.
 *
 * Linéaire (compl. § 4.10 ; relecture du groupe 2, C-09) : il applique
 * chaque événement par appliquerJournalOuvert(), comme appliquer() mais sans
 * geler la liste du journal, que l'événement suivant prolonge ; elle n'est
 * recopiée qu'à la première écriture, et gelée après le dernier événement.
 * Aucun état intermédiaire n'en sort : il ne cède que { pas }, et un refus
 * ne rend que l'erreur. L'état rendu est celui qu'appliquer() aurait fait,
 * pas à pas, gelé en profondeur.
 *
 * Le contenu a déjà été jugé pour sa forme (validerContenu, js/combat/forme.js).
 */
export function* rejeu(contenu, tranche = REJEU_TRANCHE) {
  if (contenu?.regles !== REGLES) return { erreur: { pas: 0, code: "forme", message: VERSION_INCONNUE } };
  if (!Array.isArray(contenu.evenements)) return { erreur: { pas: 0, code: "forme", message: CONTENU_ILLISIBLE } };
  let etat;
  try {
    etat = ouvrirCombat(contenu.miseEnPlace);
  } catch {
    return { erreur: { pas: 0, code: "forme", message: CONTENU_ILLISIBLE } };
  }
  for (const [rang, evenement] of contenu.evenements.entries()) {
    const { etat: suivant, refus } = appliquerJournalOuvert(etat, evenement);
    if (refus) return { erreur: { pas: rang + 1, ...refus } };
    etat = suivant;
    if ((rang + 1) % tranche === 0) yield { pas: rang + 1 };
  }
  // La liste du journal, ouverte depuis sa première écriture, gelée une fois,
  // en surface : ses lignes le sont déjà.
  Object.freeze(etat.journal);
  return { etat };
}

/**
 * Le même rejeu, d'une traite : { etat }, ou { erreur: { pas, code, message } }
 * (voir rejeu).
 */
export function rejouer(contenu) {
  const suite = rejeu(contenu);
  let etape = suite.next();
  while (!etape.done) etape = suite.next();
  return etape.value;
}
