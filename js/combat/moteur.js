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
//   événements, les photographies dans la mise en place ;
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
// Le geste en cours est le sommet d'une pile, profonde de 1 au groupe 1 : au
// groupe 2, une intervention ou une contre-attaque s'empilera sur le geste
// qu'elle interrompt. Le moment d'un geste ne change que dans avancer().

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { circonstances } from "./circonstances.js";
import { basesPermises, coupsDuGeste, frapper, lettreDe, localiser, nombreDeD20 } from "./degats.js";
import { validerEvenement } from "./forme.js";
import { exploser, garder, jetFini, lancerDe, ouvrirJet, relancer, reussites } from "./jet.js";
import { annonce, ligneDeFin, ligneDeFinDeTour, ligneDeLancement, ligneDePasse, ligneDeTour, ligneDuGeste } from "./journal.js";
import { nommer } from "./noms.js";
import { accepte, candidats, esquiveOfferte, prixDeLEsquive, prixDuGeste, reglages } from "./offre.js";
import { REGLES, geler } from "./regles.js";
import { campDe, capaciteDe, courantDe, faconDe, gesteEnCours, photoDe, vivantsDe } from "./valeurs.js";

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
 * photographies : seulement leurs valeurs, par référence.
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
  });
}

// ─── Les retouches de l'état ────────────────────────────────────────────────
//
// Chacune rend un état neuf qui partage tout ce qu'elle ne change pas. Aucune
// ne gèle, hors le journal : appliquer() gèle l'état une fois, à la fin.

const changer = (etat, id, champs) => ({ ...etat, protagonistes: { ...etat.protagonistes, [id]: { ...etat.protagonistes[id], ...champs } } });

// Ajoute des lignes au journal. Une ligne est gelée quand elle naît, et la
// liste neuve l'est en surface, ici même : geler() ne redescend pas dans ce
// qui est déjà gelé, et une ligne de plus ne fait donc regarder aucune de
// celles qui la précèdent. Laissée à appliquer(), la liste neuve était
// reparcourue ligne à ligne à chaque événement, et le rejeu d'un combat gardé
// coûtait comme le carré de sa longueur. Les lignes d'avant sont celles d'un
// état que le moteur a rendu : elles sont gelées. La recopie reste, une par
// ajout ; elle s'écrit par étalement, que le moteur de JavaScript sait faire
// vite sur une liste gelée (mesuré : dix fois plus vite que slice()).
function ecrire(etat, ...lignes) {
  return { ...etat, journal: Object.freeze([...etat.journal, ...lignes.map(geler)]) };
}

const poserLeGeste = (etat, geste) => ({ ...etat, pile: [...etat.pile.slice(0, -1), geste] });
const retirerLeGeste = (etat) => ({ ...etat, pile: etat.pile.slice(0, -1) });

// Un geste dont rien n'est payé cède la place : jouer autre chose, passer ou
// finir le tour l'emportent, sans rien dépenser.
const sansGesteNonPaye = (etat) => (gesteEnCours(etat)?.paye === false ? retirerLeGeste(etat) : etat);

// ─── Les tours ──────────────────────────────────────────────────────────────

// Finit le tour du camp qui joue : ses vivants retrouvent toutes leurs
// actions, l'autre camp joue, et le numéro monte quand le camp qui a commencé
// rejoue. Ce qu'un protagoniste a dépensé en interventions pendant le tour
// adverse lui manque donc à son propre tour : ses actions ne remontent qu'ici.
function finirLeTour(etat) {
  const { numero, camp } = etat.tour;
  const suivant = AUTRE_CAMP[camp];
  const tour = { numero: numero + (suivant === etat.quiCommence ? 1 : 0), camp: suivant };
  const protagonistes = { ...etat.protagonistes };
  for (const id of vivantsDe(etat, camp)) {
    const courant = protagonistes[id];
    if (courant.actions !== courant.actionsMax || courant.passe) protagonistes[id] = { ...courant, actions: courant.actionsMax, passe: false };
  }
  return ecrire({ ...etat, tour, protagonistes }, { genre: "cadre", texte: ligneDeFinDeTour(camp) }, { genre: "tour", texte: ligneDeTour(tour) });
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

// ─── Le geste ───────────────────────────────────────────────────────────────

// Celui que frappe un geste. Au groupe 2, un report de dégâts la changera
// ici, sans toucher à frapper(), qui reçoit sa victime.
const victimeDe = (geste) => geste.cible;

// Comment se joue une capacité, d'après son rôle et sa façon. Un adversaire
// qui porte la capacité du jet de caractéristique la joue sans jet : seuls
// les joueurs lancent des dés. Le jet prêté ne tient qu'à une capacité qui
// n'est pas une attaque.
function modeDe(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  if (capacite?.role === "deplacement") return "deplacement";
  if (capacite?.role === "jet_de_caracteristique" && campDe(etat, geste.acteur) === "pj") return "caracteristique";
  if (faconDe(etat, geste)?.attaque === true) return "attaque";
  return geste.mode === "jet_prete" ? "jet_prete" : "sans_jet";
}

// L'arme qui prête son jet, d'office : pour un PJ, celle de sa photographie
// (l'arme tenue, sinon ses mains nues) ; pour un adversaire, sa première
// arme, et « sans arme » (null) s'il n'en a aucune.
function armePreteeDOffice(etat, id) {
  const photo = photoDe(etat, id);
  if (campDe(etat, id) === "pj") return photo.armePretee;
  return photo.armes.length > 0 ? 0 : null;
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
  cible: (etat, geste, valeur) => ({ ...geste, cible: valeur }),
  arrivee: (etat, geste, valeur) => ({ ...geste, arrivee: valeur }),
  // Rangées dans l'ordre des neuf caractéristiques, quel que soit l'ordre du
  // choix : le jet, le journal et les vues lisent la même liste.
  caracteristiques: (etat, geste, valeur) => ({ ...geste, caracteristiques: CODES_CARACTERISTIQUES.filter((code) => valeur.includes(code)) }),
  difficulte: (etat, geste, valeur) => ({ ...geste, difficulte: valeur }),
  x: (etat, geste, valeur) => ({ ...geste, x: valeur }),
  jauge: (etat, geste, valeur) => ({ ...geste, jauge: valeur }),
  modificateur: reglerALaMain("modificateur"),
  avantages: reglerALaMain("avantages"),
};

// Ce qu'un réglage peut rendre caduc, et la valeur qui l'efface. La jauge
// passe avant X, qu'elle borne.
const A_REVALIDER = [
  ["cible", null],
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

// Après un réglage, ce que le geste portait et que l'offre ne permet plus se
// retire : une cible que la nouvelle portée n'atteint pas, une arrivée trop
// lointaine pour la nouvelle puissance, un X que le nouveau coût ne porte
// plus.
function revalider(etat, geste) {
  let revu = geste;
  for (const [champ, vide] of A_REVALIDER) {
    if (revu[champ] === vide) continue;
    if (!tient(reglages(poserLeGeste(etat, revu))[champ], revu[champ])) revu = { ...revu, [champ]: vide };
  }
  return revu;
}

// Paie le prix du geste, d'un coup : les actions, le souffle, et le lien sur
// la jauge que dit le prix. Le prix reste dans le geste : le journal le dit.
function payer(etat, geste) {
  const prix = prixDuGeste(etat, geste);
  const courant = courantDe(etat, geste.acteur);
  const liens = prix.jauge === null ? courant.liens : courant.liens.map((jauge, indice) => (indice === prix.jauge ? { ...jauge, points: jauge.points - prix.lien } : jauge));
  return {
    etat: changer(etat, geste.acteur, { actions: courant.actions - prix.actions, souffle: courant.souffle - prix.souffle, liens }),
    geste: { ...geste, paye: true, prix },
  };
}

// Finit un geste : sa ligne entre au journal, il quitte la pile, sa victime
// meurt si son corps est à 0 ; puis le combat finit si un camp n'a plus de
// vivant (sans « Fin du tour »), sinon le tour finit de lui-même si tous ont
// joué.
function finirLeGeste(etat, geste) {
  const morte = geste.resultat?.mort === true ? victimeDe(geste) : null;
  const ligne = { genre: "geste", texte: ligneDuGeste(etat, geste) };
  if (morte !== null) ligne.mort = true;
  let fini = retirerLeGeste(ecrire(etat, ligne));
  if (morte !== null) fini = changer(fini, morte, { mort: { tour: fini.tour.numero } });
  const vaincu = CAMPS.find((camp) => vivantsDe(fini, camp).length === 0) ?? null;
  if (vaincu === null) return apres(fini);
  const vainqueur = AUTRE_CAMP[vaincu];
  return { ...ecrire(fini, { genre: "fin", texte: ligneDeFin(vainqueur) }), phase: "termine", vainqueur };
}

// Vrai quand le dernier d20 lancé montre la face de contre-attaque de la
// cible : elle se lit sur le dé brut.
function contreAttaque(etat, geste) {
  const dernier = geste.localisation[geste.localisation.length - 1];
  return localiser(photoDe(etat, geste.cible), dernier.brut).contre === true;
}

/**
 * Fait passer le geste en cours au moment suivant tant qu'il n'attend aucun
 * choix, et le finit quand il est fini. C'est le seul endroit où le moment
 * d'un geste change : les réducteurs posent ce que l'événement apporte (un
 * dé, un prix payé, des dégâts appliqués), et le moment s'en déduit ici.
 *
 * Rend { etat, geste } : « geste » est celui que l'événement a fait avancer,
 * tel qu'il est après lui (encore sur la pile, ou fini), ou null.
 */
function avancer(depart) {
  let etat = depart;
  let geste = gesteEnCours(etat);
  while (geste !== null) {
    let moment = null;
    let pose = null;
    switch (geste.moment) {
      case "preparation":
        // Payé sans jet (une capacité sans jet, un déplacement) : c'est fini.
        if (geste.paye) moment = geste.jet === null ? "fini" : "jet";
        break;
      case "jet":
        if (!jetFini(geste.jet)) break;
        // Un jet de caractéristique, une attaque manquée et une défense à
        // trois réussites n'ont pas de lettre : rien ne suit.
        if (lettreDe(geste.jet.genre, reussites(geste.jet)) === null) {
          moment = "fini";
        } else {
          moment = "bilan";
          pose = { degats: { base: basesPermises(etat, geste)[0] ?? "aucun", operations: [], nature: "normaux" } };
        }
        break;
      case "bilan":
        if (geste.localisation.length > 0) moment = "localisation";
        break;
      case "localisation":
        if (contreAttaque(etat, geste)) moment = "fini";
        else if (geste.localisation.length >= nombreDeD20(etat, geste)) moment = "suites";
        break;
      case "suites":
        if (geste.resultat !== null) moment = "fini";
        break;
      case "fini":
        return { etat: finirLeGeste(etat, geste), geste };
      default:
        break;
    }
    if (moment === null) break;
    geste = { ...geste, ...pose, moment };
    etat = poserLeGeste(etat, geste);
  }
  return { etat, geste };
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
    return apres(ecrire(lance, { genre: "cadre", texte: ligneDeLancement(lance) }, { genre: "tour", texte: ligneDeTour(tour) }));
  },

  capacite(etat, { qui, capacite, facon }) {
    const libre = sansGesteNonPaye(etat);
    const geste = {
      numero: etat.pas + 1,
      acteur: qui,
      capacite,
      facon,
      mode: null,
      moment: "preparation",
      paye: false,
      prix: null,
      cible: null,
      arrivee: null,
      depart: null,
      x: 0,
      jauge: null,
      caracteristiques: null,
      difficulte: null,
      armePretee: null,
      reglages: { modificateur: null, avantages: null },
      jet: null,
      degats: null,
      localisation: [],
      interventions: [],
      resultat: null,
      parent: null,
    };
    return { ...libre, pile: [...libre.pile, { ...geste, mode: modeDe(etat, geste) }] };
  },

  regler(etat, { champ, valeur, raison }) {
    return poserLeGeste(etat, revalider(etat, REGLAGES[champ](etat, gesteEnCours(etat), valeur, raison)));
  },

  revenir: (etat) => retirerLeGeste(etat),

  confirmer(etat) {
    const { etat: paye, geste } = payer(etat, gesteEnCours(etat));
    if (geste.mode !== "deplacement") return poserLeGeste(paye, geste);
    const depart = courantDe(paye, geste.acteur).case;
    return poserLeGeste(changer(paye, geste.acteur, { case: geste.arrivee }), { ...geste, depart });
  },

  de(etat, { valeurs }) {
    const geste = gesteEnCours(etat);
    if (!geste.paye) {
      // Le premier dé paie, et fige les circonstances du jet : ce que le
      // joueur a lu avant de lancer est ce qui s'applique.
      const jet = ouvrirJet(circonstances(etat, geste));
      const { etat: paye, geste: lance } = payer(etat, geste);
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

  appliquer(etat) {
    const geste = gesteEnCours(etat);
    const victime = victimeDe(geste);
    const { courant, coups, mort } = frapper(courantDe(etat, victime), coupsDuGeste(etat, geste));
    const frappe = { ...etat, protagonistes: { ...etat.protagonistes, [victime]: courant } };
    return poserLeGeste(frappe, { ...geste, resultat: { coups, mort } });
  },

  passer(etat, { qui }) {
    const passe = changer(sansGesteNonPaye(etat), qui, { passe: true });
    return apres(ecrire(passe, { genre: "geste", texte: ligneDePasse(passe, qui) }));
  },

  fin_de_tour: (etat) => apres(finirLeTour(sansGesteNonPaye(etat))),
};

// ─── Appliquer, rejouer ─────────────────────────────────────────────────────

/**
 * Applique un événement à un état, et rend { etat }, ou { etat, refus }.
 *
 * Elle ne lève jamais, quel que soit l'événement. Un événement refusé rend
 * l'état reçu, l'objet même, et « refus » : { code, message } (les quatre
 * codes sont ceux de l'offre). Sinon l'état rendu est neuf, gelé en
 * profondeur, et partage avec le précédent tout ce qui n'a pas changé.
 *
 * L'annonce (ce que dit la région d'annonce de l'écran) suit : quand
 * l'événement n'a rien à dire, celle d'avant reste, l'objet même.
 */
export function appliquer(etat, evenement) {
  const verdict = accepte(etat, evenement);
  if (!verdict.ok) return { etat, refus: { code: verdict.code, message: verdict.message } };
  // La copie gelée de l'événement, aux seuls champs connus : c'est elle que
  // le geste garde (les opérations des dégâts, par exemple).
  const lu = validerEvenement(evenement).evenement;
  const { etat: suivant, geste } = avancer(REDUCTEURS[lu.type](etat, lu));
  const pas = etat.pas + 1;
  const texte = annonce(suivant, geste, lu, etat.journal.length);
  return { etat: geler({ ...suivant, annonce: texte === null ? etat.annonce : { pas, texte }, pas }) };
}

const VERSION_INCONNUE = "Ce combat a été commencé avec une autre version des règles.";
const CONTENU_ILLISIBLE = "Le contenu de ce combat ne se lit pas.";

/**
 * Refait l'état d'un combat gardé : ouvrirCombat() sur sa mise en place, puis
 * appliquer() pour chacun de ses événements, par le chemin même du jeu. Rend
 * { etat }, ou { erreur: { pas, code, message } } au premier refus (« pas »
 * est le numéro de l'événement refusé, 0 pour le contenu lui-même) : la suite
 * n'est jamais tronquée en silence, un combat qui ne se rejoue pas est une
 * donnée abîmée.
 *
 * Le contenu a déjà été jugé pour sa forme (validerContenu, js/combat/forme.js).
 */
export function rejouer(contenu) {
  if (contenu?.regles !== REGLES) return { erreur: { pas: 0, code: "forme", message: VERSION_INCONNUE } };
  if (!Array.isArray(contenu.evenements)) return { erreur: { pas: 0, code: "forme", message: CONTENU_ILLISIBLE } };
  let etat;
  try {
    etat = ouvrirCombat(contenu.miseEnPlace);
  } catch {
    return { erreur: { pas: 0, code: "forme", message: CONTENU_ILLISIBLE } };
  }
  for (const [rang, evenement] of contenu.evenements.entries()) {
    const { etat: suivant, refus } = appliquer(etat, evenement);
    if (refus) return { erreur: { pas: rang + 1, ...refus } };
    etat = suivant;
  }
  return { etat };
}
