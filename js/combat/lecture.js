// Les vues du combat : ce que l'écran demande au moteur (SPECIFICATION.md,
// § 17 « Le simulateur de combat (lot 4) » ; contrat du lot 4, groupe 2,
// § 2.7 et § 8).
//
// Ce module fabrique, sans rien toucher de la page, les vues que l'écran
// affiche : la barre de titre, le plateau, la fiche vivante d'un
// protagoniste, la bulle d'action (vuePanneau), la préparation, la liste du
// journal (vueJournal) et le bandeau « Dernier événement » (vueBandeau). Une
// vue est un objet prêt à montrer : ses textes sont écrits, ses états nommés.
//
// Il existe pour que l'écran n'écrive aucune règle et ne fasse aucun calcul :
// - chaque élément qu'on peut actionner porte sa « commande » : l'événement à
//   émettre (ou les deux événements d'une case d'arrivée, joués tout ou
//   rien), le protagoniste à choisir, ou l'ordre de préparation ;
// - chaque bouton inactif porte « actif: false » et sa raison ;
// - chaque saisie porte ses bornes et un « gabarit » : l'événement, qu'il ne
//   reste qu'à compléter du nombre saisi et, s'il y a lieu, de sa raison (au
//   lot 4.3, l'état libre d'une blessure se complète d'un nom, « libre ») ;
// - chaque phrase d'écran est écrite ici : la cause d'un avantage, la portée
//   d'une ligne, son coût, la question d'« Annuler le dernier geste ».
//
// Tout ce qui est offert vient de l'offre (js/combat/offre.js), que le moteur
// lit aussi pour juger chaque événement : un bouton montré actif est donc un
// événement que le moteur accepte, et un bouton montré inactif un événement
// qu'il refuse. C'est pourquoi ce module n'importe jamais le moteur, et ne
// change rien à ce qu'on lui donne. Un contrôle tient cette concordance à
// chaque moment d'un combat joué (tests/combat_lecture.test.js).
//
// Ce qu'il impose à ce qu'il rend :
// - une vue ne porte rien d'instable (ni heure, ni compteur) : l'écran
//   compare le texte JSON de deux vues pour savoir quoi redessiner ;
// - le nom court ne sert qu'au journal, aux jetons du plateau et aux phrases
//   qui suivent le journal (l'en-tête d'un jet, les causes) ; partout
//   ailleurs une vue écrit le nom entier ;
// - les noms (protagonistes, capacités, zones, armes, raisons) sont des
//   données hostiles, rendues telles quelles : c'est l'écran qui les pose
//   comme du texte. Aucun nom n'est jamais cherché dans un texte : les lignes
//   barrées se lisent dans les plages des lignes « Annulé », les couleurs et
//   la mort dans les segments du journal.
//
// Au groupe 2 (contrat du groupe, § 2.7, § 8) :
// - la bulle : une ligne par capacité et par puissance (une par façon),
//   chacune avec ses dégâts ou ses cases, son coût, sa raison et son survol
//   (l'origine, la description, la portée, les causes qui ne dépendent pas
//   de la cible, le coût, les cases hachurées) ; les passifs en pied ; un
//   en-tête, qui se défend, et ce qui ferme ou réduit la bulle ; plus de + ni
//   de −, la puissance étant une ligne ;
// - les causes des avantages et des désavantages, une phrase par source,
//   avec l'inversion, la citation du passif et le compte ;
// - « Annuler le dernier geste » dans la barre, avec sa question, et la
//   ligne qui avertit à l'approche de la limite des événements ;
// - le journal en segments : vueJournal et vueBandeau remplacent vueLigne.
//
// Quelques textes ne viennent pas de l'auteur, qui n'a décrit que le panneau
// de la maquette : les phrases du bilan pendant la chaîne, les libellés des
// dégâts à fixer, « Une action est en cours. », et les phrases d'écran que le
// contrat du groupe 2 a dû écrire (son annexe B). Ils restent à lui faire
// confirmer.
//
// À la vague 1 du lot 4.3 (contrat de la vague, § 4, § 11 et § 12), l'écran
// suit le noyau neuf sans en dessiner les vues, qui viendront à la vague 3 :
// - les d20 se lisent sur la grille de la victime (un report la suit), la
//   face de contre-attaque sur celle du jeté ;
// - un jet ne clôt jamais le geste : un manqué et un jet de caractéristique
//   attendent « Terminer » ;
// - à chaque moment neuf, le moindre bouton qui fait continuer : garder ou
//   tenter le critique, laisser passer la contre-attaque, la blessure (une
//   capacité du bloc de blessure, ou un état libre) ; la ligne d'attendre se
//   règle (la capacité gardée) ;
// - une façon Centrée coche ses cibles, au lieu d'en régler une ;
// - « Ajusté à » la valeur calculée ne fait aucun événement, ou défait
//   l'ajustement d'avant (mission du lot, § 6) ;
// - la palette et le menu du MJ ne se montrent pas encore.
//
// À la vague 3 (contrat de la vague, § 3.1 à § 3.5), les vues de l'écran :
// - la barre dit l'état court du téléphone, le camp, et « Intervenir… » ;
// - la bulle porte le volet du téléphone (l'étape, le fil, la consigne) et
//   les étapes neuves du geste : les interventions, la contre-attaque, le
//   critique, les passifs non câblés, « Appliquer l'effet de… », la palette,
//   plusieurs cibles, ce que la blessure a fait ; « Touchez » au doigt ;
// - la fiche et le jeton disent qui a tout joué, les états portés (une
//   pastille, des étiquettes) et « Modifier… » ;
// - les vignettes du téléphone, et le dé en surimpression ;
// - ce que seul le Mode MJ montre porte « mj: true » : aucune vue ne lit le
//   Mode MJ, l'écran cache ce qu'il ne montre pas.

import { CARACTERISTIQUES, deDuJet } from "../personnage/regles.js";
import { circonstances, modificateursDe, passifsDe, sourcesSansCible } from "./circonstances.js";
import { coupsDuGeste, degatsFixes, frapper, lettreDe, lettreDuGeste, localisationsDuGeste, victimeDe } from "./degats.js";
import { faconTenue, jugerEffet, jugerMj, passifDe, refusDeLaBlessure } from "./effets.js";
import { evaluerEssai, lancerDe, modificateurDe, netDe, ouvrirJet, relancesRestantes, reussites } from "./jet.js";
import { deNom, ecrireBilan, ecrireDuree, ecrireSource, ligneDeFin, ligneEnCours, nommerLeGeste } from "./journal.js";
import { acteurCourant, annulation, boutons, candidats, cibles, esquiveOfferte, faconDeLArrivee, modeDeLaFacon, offre, prixDeLEsquive } from "./offre.js";
import { casesEntre, distance } from "./plateau.js";
import { ajouterAdversaires, ajouterPersonnage, peutLancer } from "./preparation.js";
import {
  BORNES_EFFET,
  DIFFICULTES,
  EVENEMENTS_ALERTE,
  EVENEMENTS_MAX,
  LETTRES,
  LONGUEUR_RAISON,
  PLAFOND_ADVERSAIRES,
  PLAFOND_EXEMPLAIRES,
  REUSSITES_MAX,
  SIGNES,
  ecrireEnMilliers,
} from "./regles.js";
import {
  aJoue,
  attaqueDe,
  campDe,
  capaciteDe,
  courantDe,
  defenseDe,
  effetsDurablesDe,
  faconDe,
  gardesDe,
  gesteEnCours,
  nomDeLaSource,
  photoDe,
  vivant,
  vivantsDe,
} from "./valeurs.js";

// La palette et le menu du MJ (contrat de la vague 3, § 3.5) vivent dans un
// module à part, qu'écrit une autre part ; l'écran les lit ici, avec les
// autres vues.
export { vueMenuMj, vuePalette } from "./lecture_mj.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };
const UN_DU_CAMP = { pj: "personnage", adv: "adversaire" };
const POIDS = { lourde: "lourde", agile: "agile", precise: "précise" };
// Le quatrième dé est celui du coup critique tenté.
const RANGS = ["1er dé", "2e dé", "3e dé", "4e dé"];

const ACTION_EN_COURS = "Une action est en cours.";

// Les modes d'un geste qui visent une cible de l'autre camp, et que le PJ
// visé contre par sa défense quand un adversaire les joue.
const MODES_D_ATTAQUE = ["attaque", "jet_prete"];
const MODES_A_JET = ["attaque", "jet_prete", "caracteristique"];

const present = (valeur) => valeur !== null && valeur !== undefined;
const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);
const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);

// « 1 action », « 2 actions » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// Deux morceaux d'une même ligne d'écran, séparés par un point médian.
const enLigne = (...parties) => parties.join(` ${SIGNES.point} `);

// La casse du premier signe seul, sans règle propre à une langue : la même
// vue sort sur tous les appareils.
function minuscule(texte) {
  const [premier = ""] = texte;
  return premier.toLowerCase() + texte.slice(premier.length);
}

function majuscule(texte) {
  const [premier = ""] = texte;
  return premier.toUpperCase() + texte.slice(premier.length);
}

const nomEntier = (etat, id) => etat.noms?.[id]?.entier ?? photoDe(etat, id)?.nom ?? "";

// Le nom court, figé au lancement, celui du journal (« Aubépine »).
const court = (etat, id) => etat.noms?.[id]?.court ?? photoDe(etat, id)?.nom ?? "";

const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });
const gabaritDe = (champ) => ({ evenement: { type: "regler", champ } });

// La raison qu'une saisie propose : le nom de la capacité jouée. Une raison
// tient en LONGUEUR_RAISON signes, sans blanc de bord ni demi-codet isolé ;
// un nom peut être plus long, et porter des demi-codets isolés (une donnée
// hostile). Ils s'ôtent d'abord ; puis, si la coupe tombe au milieu d'un
// signe astral, sa première moitié s'ôte aussi : le moteur accepte ainsi
// toujours la raison proposée, dégâts directs compris.
const raisonDepuis = (nom) => {
  let texte = String(nom ?? "").replace(/\p{Cs}/gu, "").slice(0, LONGUEUR_RAISON);
  if (/[\uD800-\uDBFF]$/.test(texte)) texte = texte.slice(0, -1);
  return texte.trim();
};

// « Taloche [1] » : la puissance ne s'écrit que pour une capacité qui évolue.
const libelleDe = (capacite, facon) => `${capacite.nom}${capacite.evolue && facon !== null ? ` [${facon.puissance}]` : ""}`;

// « contre » un protagoniste de l'autre camp, « sur » un allié ou sur soi :
// la règle de l'ouverture du journal.
const lienALaCible = (etat, geste) => (campDe(etat, geste.cible) === campDe(etat, geste.acteur) ? "sur" : "contre");

// « actions restantes : 1 sur 2 », la fiche et l'en-tête de la bulle.
const actionsRestantes = (courant) => `actions restantes : ${courant.actions} sur ${courant.actionsMax}`;

// « souffle 6/10 » ; « souffle — » sans souffle écrit.
const souffleDit = (courant, photo) => `souffle ${photo?.souffleAbsent ? SIGNES.tiret : `${courant.souffle}/${courant.souffleMax}`}`;

// ─── La barre ───────────────────────────────────────────────────────────────

const AIDES = {
  preparation:
    "Un protagoniste ajouté se pose d'office : un personnage sur la colonne A, un adversaire sur la colonne J. Déplacez-le en le faisant glisser, en touchant son jeton puis une case, ou par le champ « Case » de sa fiche.",
  pj: "Les PJ jouent dans l'ordre de leur choix. Le tour des adversaires commence quand tous ont joué, ou sur « Fin de tour ».",
  adv: "Les adversaires jouent dans l'ordre de votre choix. Le tour des PJ commence quand tous ont joué, ou sur « Fin de tour ».",
  termine: "Le combat est terminé. Le journal se copie et se télécharge toujours.",
};

// La ligne qui avertit, sous la barre, dès EVENEMENTS_ALERTE événements
// (complément, § 5.3 ; contrat du groupe 2, § 4.1).
const LIMITE_PROCHE = `Ce combat approche de sa limite (${ecrireEnMilliers(EVENEMENTS_ALERTE)} événements sur ${ecrireEnMilliers(EVENEMENTS_MAX)}) : copiez ou téléchargez le journal ; au-delà, il faudra en commencer un nouveau.`;

const ANNULER = { evenement: { type: "annuler" } };

/**
 * La question que pose « Annuler le dernier geste » avant de défaire le geste
 * « quoi » (offre.js, annulation) : « Annuler ce geste : Aubépine — Taloche
 * [1] contre Marmiton n° 2 ? Ses dés seront perdus. » (la seconde phrase
 * pour un geste qui a lancé des dés) ; « Annuler ce geste : Aubépine — Pas
 * chassé [1], C3 → D4 ? » ; « Annuler ce geste : Aubépine — passer son
 * tour ? » ; « Annuler la fin du tour des PJ ? ».
 */
export function questionDAnnulation(etat, quoi) {
  if (quoi?.genre === "fin_de_tour") return `Annuler ${nommerLeGeste(etat, quoi)} ?`;
  if (quoi?.genre === "passer") return `Annuler ce geste : ${nommerLeGeste(etat, quoi)} ?`;
  const perdus = (quoi?.geste?.jet ?? null) !== null ? " Ses dés seront perdus." : "";
  return `Annuler ce geste : ${nommerLeGeste(etat, quoi, { detail: true })} ?${perdus}`;
}

// « Annuler le dernier geste » : null avant le lancement ; sinon le bouton,
// actif ou avec sa raison, et la question qu'il pose quand il est actif.
function boutonDAnnulation(etat) {
  const lu = annulation(etat);
  if (lu === null) return null;
  return {
    libelle: "Annuler le dernier geste",
    actif: lu.actif,
    raison: lu.raison,
    commande: ANNULER,
    question: lu.actif ? { texte: questionDAnnulation(etat, lu.quoi), confirmer: "Annuler le geste", garder: "Garder" } : null,
  };
}

// ─── Les interventions ──────────────────────────────────────────────────────
//
// « Intervenir… » (la barre, entre deux gestes) et l'étape « Interventions »
// d'une attaque (le panneau) montrent les mêmes intervenants : ceux de
// l'offre (offre.js, interventions), chacun avec ses options, actives ou non
// avec leur raison (mission du lot 4.3, § 4.1 ; contrat de la vague 3, § 3.1
// et § 3.2). L'esquive n'en est jamais : elle garde son événement.

const PERSONNE_N_INTERVIENT = "Personne ne peut intervenir.";

// Une option : « Dressage minute », « Frappe (en guet) » pour une ligne
// qu'une garde rend jouable ; son texte, son coût (« 1 action · gratuit »),
// et l'événement qui la joue.
function optionDIntervention(etat, qui, { capacite, facon, gardee, actif, raison }) {
  const laCapacite = capaciteDe(etat, qui, capacite);
  const laFacon = element(laCapacite?.facons, facon);
  const libelle = laCapacite === null ? "" : libelleDe(laCapacite, laFacon);
  const cout = coutDeLaLigne(laFacon);
  return {
    cle: `intervention:${qui}:${capacite}:${facon}`,
    libelle: present(gardee) ? `${libelle} (en guet)` : libelle,
    texte: laFacon?.description ?? "",
    cout: cout === null ? compter(1, "action") : enLigne(compter(1, "action"), cout),
    actif,
    raison,
    commande: { evenement: { type: "intervenir", qui, capacite, facon } },
  };
}

// Un intervenant : son nom entier, ses initiales, sa ligne de dessous (« sous »),
// puis ses options. « sous » lit son courant et ses options : la barre écrit
// « 2 actions · Dressage minute », l'étape « 1 action · souffle 5/10 · la
// cible ».
function intervenantVu(etat, { qui, options }, sousDe) {
  const vues = options.map((option) => optionDIntervention(etat, qui, option));
  return { id: qui, nom: nomEntier(etat, qui), initiales: etat.noms?.[qui]?.initiales ?? "?", sous: sousDe(qui, vues), options: vues };
}

// Le bouton « Intervenir… » : null hors d'un combat en cours ; dans la barre
// au tour adverse, dans le menu ⋯ au tour des PJ ; actif entre deux gestes
// quand quelqu'un du camp qui ne joue pas peut intervenir. Inactif, il ne
// porte aucun intervenant.
function boutonIntervenir(etat, offerts) {
  const place = etat.tour.camp === "adv" ? "barre" : "menu";
  const geste = gesteEnCours(etat);
  const intervenants = geste === null ? (offerts.interventions?.intervenants ?? []) : [];
  const actif = geste === null && offerts.types.includes("intervenir") && intervenants.length > 0;
  const raison = actif ? null : geste !== null ? ACTION_EN_COURS : PERSONNE_N_INTERVIENT;
  const sous = (qui, options) => {
    const courant = courantDe(etat, qui);
    const actives = options.filter((option) => option.actif).map((option) => option.libelle);
    return enLigne(compter(courant.actions, "action"), actives.join(", "));
  };
  return { libelle: `Intervenir${String.fromCodePoint(0x2026)}`, place, actif, raison, intervenants: actif ? intervenants.map((un) => intervenantVu(etat, un, sous)) : [] };
}

/**
 * La barre de titre : l'état du combat (« Préparation », « Tour 2 · camp des
 * PJ », « Combat terminé »), la ligne d'aide de la phase, « Fin de tour »,
 * proposé pendant le combat, inactif au milieu d'une action, « Annuler le
 * dernier geste » (null avant le lancement), et la ligne de la limite des
 * événements (null avant EVENEMENTS_ALERTE). Tous les champs sont dans
 * toutes ses formes.
 *
 * À la vague 3 du lot 4.3 (contrat de la vague, § 3.1) : « etatCourt », l'état
 * que la barre du téléphone écrit (« Tour 2 · PJ », « Tour 2 ·
 * adversaires ») ; « camp », celui qui joue (null hors d'un combat en
 * cours) ; « intervenir », le bouton « Intervenir… » et ses intervenants.
 */
export function vueBarre(etat) {
  const limite = (etat.pas ?? 0) >= EVENEMENTS_ALERTE ? LIMITE_PROCHE : null;
  const annuler = boutonDAnnulation(etat);
  if (etat.phase === "preparation") return { etat: "Préparation", etatCourt: "Préparation", camp: null, aide: AIDES.preparation, finDeTour: null, intervenir: null, annuler, limite };
  if (etat.phase !== "combat" || etat.tour === null) {
    return { etat: "Combat terminé", etatCourt: "Combat terminé", camp: null, aide: AIDES.termine, finDeTour: null, intervenir: null, annuler, limite };
  }
  const offerts = offre(etat);
  const actif = offerts.types.includes("fin_de_tour");
  return {
    etat: `Tour ${etat.tour.numero} ${SIGNES.point} camp des ${CAMPS[etat.tour.camp]}`,
    etatCourt: `Tour ${etat.tour.numero} ${SIGNES.point} ${CAMPS[etat.tour.camp]}`,
    camp: etat.tour.camp,
    aide: AIDES[etat.tour.camp],
    finDeTour: { actif, raison: actif ? null : ACTION_EN_COURS, commande: { evenement: { type: "fin_de_tour" } } },
    intervenir: boutonIntervenir(etat, offerts),
    annuler,
    limite,
  };
}

// ─── Le journal ─────────────────────────────────────────────────────────────

// La phrase unique d'une ligne écrite à la main, sans segments (un état
// fabriqué par un contrôle) : son genre se lit dans celui de la ligne.
const PHRASE_SEULE = { cadre: "lancement", tour: "tour", geste: "ouverture", fin: "fin", annule: "annule" };

// La plage [début, fin) que barre une ligne « Annulé » ; null pour toute
// autre ligne, et pour une plage qui ne se lit pas.
function plageDe(ligne) {
  if (ligne?.genre !== "annule" || !Array.isArray(ligne.barre) || ligne.barre.length !== 2) return null;
  const [debut, fin] = ligne.barre;
  return Number.isInteger(debut) && Number.isInteger(fin) ? [debut, fin] : null;
}

// Une ligne telle que l'écran la montre : { rang, genre, texte, segments,
// phrases, barree, barre }. Ses segments sont ceux du journal, l'objet même ;
// une ligne qui n'en a pas (écrite à la main) en reçoit un seul, son texte.
function ligneVue(ligne, rang, barree) {
  const texte = ligne.texte ?? "";
  const ecrite = Array.isArray(ligne.segments);
  return {
    rang,
    genre: ligne.genre ?? null,
    texte,
    segments: ecrite ? ligne.segments : texte === "" ? [] : [{ type: "texte", texte, phrase: 0 }],
    phrases: Array.isArray(ligne.phrases) ? ligne.phrases : [PHRASE_SEULE[ligne.genre] ?? PHRASE_SEULE.geste],
    barree,
    barre: plageDe(ligne),
  };
}

/**
 * Les lignes du journal, du rang « depuis » au dernier : { total, lignes }.
 * Une ligne est barrée quand une ligne « Annulé » qui la suit la couvre de sa
 * plage ; seules comptent les lignes « Annulé » de rang « depuis » ou plus
 * (celles d'avant ont été montrées), et une ligne « Annulé » ne l'est jamais.
 * Les plages se posent en un passage, par différences : le coût suit le
 * nombre de lignes lues, quel que soit le nombre d'annulations.
 */
export function vueJournal(etat, depuis = 0) {
  const journal = etat.journal ?? [];
  const total = journal.length;
  const debut = Number.isInteger(depuis) ? Math.min(Math.max(depuis, 0), total) : 0;
  const lues = [];
  const ecarts = new Array(total - debut + 1).fill(0);
  for (let rang = debut; rang < total; rang += 1) {
    const ligne = journal[rang];
    lues.push(ligne);
    const plage = plageDe(ligne);
    if (plage === null) continue;
    // Une ligne « Annulé » ne barre que des lignes d'avant elle.
    const de = Math.max(plage[0], debut);
    const a = Math.min(plage[1], rang);
    if (de < a) {
      ecarts[de - debut] += 1;
      ecarts[a - debut] -= 1;
    }
  }
  let couvertes = 0;
  const lignes = lues.map((ligne, k) => {
    couvertes += ecarts[k];
    return ligneVue(ligne, debut + k, couvertes > 0 && ligne.genre !== "annule");
  });
  return { total, lignes };
}

/**
 * Le bandeau « Dernier événement » : null avant le lancement. Pendant un
 * geste payé, la ligne qu'il écrit (journal.js, ligneEnCours), sans rang :
 * { enCours: true, ligne } ; sinon la dernière ligne du journal.
 */
export function vueBandeau(etat) {
  if (etat.phase === "preparation") return null;
  const enCours = ligneEnCours(etat);
  if (enCours !== null) return { enCours: true, ligne: ligneVue(enCours, null, false) };
  const journal = etat.journal ?? [];
  if (journal.length === 0) return null;
  return { enCours: false, ligne: ligneVue(journal[journal.length - 1], journal.length - 1, false) };
}

// ─── Le plateau ─────────────────────────────────────────────────────────────

// Un geste engagé : payé, ou emboîté sur un geste payé (une intervention, une
// contre-attaque). Plus rien ne se choisit alors hors de lui : ni qui joue,
// ni une autre capacité.
const engage = (etat, geste) => geste !== null && (geste.paye === true || (etat.pile?.length ?? 0) > 1);

// Le geste qui se règle encore, tant qu'il attend une cible ou une arrivée :
// c'est pendant ce choix que le plateau marque ce qui se choisit, et écarte
// le reste.
function choixSurLePlateau(etat) {
  const geste = gesteEnCours(etat);
  if (geste === null || geste.moment !== "preparation") return null;
  const offerts = offre(etat).reglages;
  if (Object.hasOwn(offerts, "cible")) return { champ: "cible", options: offerts.cible.options.filter(present) };
  if (Object.hasOwn(offerts, "arrivee")) return { champ: "arrivee", options: offerts.arrivee.options };
  return null;
}

// Ce qu'on dit d'un protagoniste, en un mot ou deux ; null quand il n'y a
// rien à en dire. « A joué » ne vaut que pour le camp dont c'est le tour.
function situationDe(etat, id, acteur) {
  const courant = courantDe(etat, id);
  if (courant.mort !== null) return "mort";
  if (etat.phase !== "combat") return null;
  if (id === acteur) return "joue";
  if (gesteEnCours(etat)?.cible === id) return "cible";
  if (etat.tour !== null && courant.camp === etat.tour.camp && aJoue(etat, id)) return "a_joue";
  return null;
}

const DIT_SUR_LE_JETON = { mort: "mort", joue: "joue", cible: "ciblé", a_joue: "a joué" };

// Ce qu'un vivant du camp qui joue peut encore faire (contrat de la vague 3,
// § 3.3 ; mission du lot 4.3, § 3, les vignettes et B1) : « peut_agir » tant
// qu'il est candidat, et pendant son propre geste (celui du bas de la pile),
// jusqu'à ce que ce geste finisse ; « epuise » quand il a tout joué. null
// pour tout autre, et hors d'un combat en cours.
function jeuDe(etat, id, lesCandidats) {
  if (etat.phase !== "combat" || etat.tour === null || !vivant(etat, id) || campDe(etat, id) !== etat.tour.camp) return null;
  return lesCandidats.includes(id) || etat.pile?.[0]?.acteur === id ? "peut_agir" : "epuise";
}

// La pastille d'un protagoniste qui porte un état (mission du lot 4.3, § 4.7) :
// « blessure » s'il en porte une, sinon « alerte » ; null sans état.
function pastilleDe(etat, id) {
  const portes = effetsDurablesDe(etat, id).filter((effet) => effet.genre === "etat");
  if (portes.length === 0) return null;
  return portes.some((effet) => effet.blessure === true) ? "blessure" : "alerte";
}

const LE_GESTE_D_ABORD = "Le geste en cours se finit d'abord.";

// « Modifier… », le menu du MJ d'un protagoniste (mission du lot 4.3, § 4.8) :
// null pour un mort, un retiré, et hors d'un combat en cours ; inactif
// pendant un geste. Seul le Mode MJ le montre.
function menuMjDe(etat, id, offerts) {
  if (etat.phase !== "combat" || etat.tour === null || !vivant(etat, id)) return null;
  const actif = offerts.mj === true;
  return { libelle: `Modifier${String.fromCodePoint(0x2026)}`, actif, raison: actif ? null : LE_GESTE_D_ABORD, mj: true };
}

// Le nom d'une case d'arrivée possible : le même sur la carte et sur son
// double, dans la bulle ou sous la carte.
const nomDArrivee = (nomDeCase) => `Case ${nomDeCase} : s'y déplacer`;

// La commande d'une case d'arrivée (contrat du groupe 2, § 6.3) : la case
// fait jouer la plus petite puissance qui l'atteint et qui se paie. Quand
// c'est la façon en cours, un seul événement ; sinon deux, la façon puis la
// case, que la séance joue tout ou rien.
function commandeDArrivee(etat, geste, nomDeCase) {
  const facon = faconDeLArrivee(etat, nomDeCase);
  if (facon === null || facon === geste.facon) return regler("arrivee", nomDeCase);
  return { evenements: [regler("facon", facon).evenement, regler("arrivee", nomDeCase).evenement] };
}

/**
 * Le plateau : les seules cases qui portent un jeton ou qui se choisissent,
 * et un jeton par protagoniste.
 * - Une case : { jetons, active, choix }. « active » : la case de qui joue ;
 *   « choix » : { commande, nom } pour une case d'arrivée possible. Dans une
 *   case, celui qui joue vient en tête, puis la cible : au-delà de trois
 *   jetons l'écran n'en montre que les premiers.
 * - Un jeton : { camp, entier, jeton, initiales, marque, mort, nom, choix,
 *   inactif, raison }. « nom » est son nom accessible : nom entier, camp,
 *   état, case. « choix » : { commande } pour qui peut être choisi pour jouer
 *   tant que rien n'est payé, hors d'un choix de cible ou d'arrivée, ou pour
 *   une cible possible.
 * Pendant un choix de cible ou d'arrivée, tout jeton sans choix est
 * « inactif ». Après le premier dé, chaque candidat autre que celui qui joue
 * l'est aussi, avec sa raison : « Une action est en cours. ». Avant le
 * lancement, aucun choix : l'écran déplace lui-même les jetons.
 *
 * À la vague 3 du lot 4.3 (contrat de la vague, § 3.4), un jeton porte aussi
 * « epuise » (un vivant du camp qui joue qui a tout joué : il pâlit),
 * « pastille » (« blessure », « alerte » ou null : l'état qu'il porte) et
 * « menuMj » (« Modifier… », comme sa fiche).
 */
export function vuePlateau(etat, choisi) {
  const acteur = acteurCourant(etat, choisi);
  const geste = gesteEnCours(etat);
  const enChoix = choixSurLePlateau(etat);
  const paye = engage(etat, geste);
  const lesCandidats = candidats(etat);
  const quiPeutJouer = paye ? [] : lesCandidats;
  const quiAttend = paye ? lesCandidats.filter((id) => id !== acteur) : [];
  const offerts = etat.phase === "combat" ? offre(etat) : null;

  const jetons = {};
  const cases = {};
  const laCase = (nom) => {
    if (!Object.hasOwn(cases, nom)) cases[nom] = { jetons: [], active: false, choix: null };
    return cases[nom];
  };

  for (const id of etat.ordre) {
    const courant = courantDe(etat, id);
    const noms = etat.noms?.[id] ?? {};
    const situation = situationDe(etat, id, acteur);
    let choix = null;
    if (enChoix?.champ === "cible" && enChoix.options.includes(id)) choix = { commande: regler("cible", id) };
    else if (enChoix === null && quiPeutJouer.includes(id)) choix = { commande: { choisir: id } };
    const entier = nomEntier(etat, id);
    const attend = quiAttend.includes(id);
    jetons[id] = {
      camp: courant.camp,
      entier,
      jeton: noms.jeton ?? entier,
      initiales: noms.initiales ?? "?",
      marque: situation === "joue" || situation === "cible" ? situation : null,
      mort: courant.mort !== null,
      nom: [entier, UN_DU_CAMP[courant.camp], DIT_SUR_LE_JETON[situation] ?? null, `case ${courant.case}`].filter(present).join(", "),
      choix,
      inactif: (enChoix !== null && choix === null) || attend,
      raison: attend ? ACTION_EN_COURS : null,
      epuise: jeuDe(etat, id, lesCandidats) === "epuise",
      pastille: pastilleDe(etat, id),
      menuMj: offerts === null ? null : menuMjDe(etat, id, offerts),
    };
    laCase(courant.case).jetons.push(id);
  }

  const rangDe = (id) => (jetons[id].marque === "joue" ? 0 : jetons[id].marque === "cible" ? 1 : 2);
  for (const nom of Object.keys(cases)) {
    const rangee = cases[nom].jetons;
    cases[nom].jetons = [0, 1, 2].flatMap((rang) => rangee.filter((id) => rangDe(id) === rang));
  }
  if (acteur !== null && courantDe(etat, acteur) !== null) laCase(courantDe(etat, acteur).case).active = true;
  if (enChoix?.champ === "arrivee") {
    for (const nom of enChoix.options) laCase(nom).choix = { commande: commandeDArrivee(etat, geste, nom), nom: nomDArrivee(nom) };
  }
  return { phase: etat.phase, cases, jetons };
}

// ─── Une fiche vivante ──────────────────────────────────────────────────────

const ecrireFaces = ({ debut, fin }) => (debut === fin ? `${debut}` : `${debut}-${fin}`);

// Le modificateur qu'un PJ ajouterait à chaque dé d'un tel jet, hors de tout
// réglage : ses bonus câblés et ses blessures (« d10 +1 »).
function modificateurAffiche(etat, id, genre, mobilisees) {
  const total = somme(modificateursDe(etat, id, { genre, mobilisees: mobilisees ?? [] }).map((modificateur) => modificateur.valeur));
  return total === 0 ? "" : ` ${signer(total)}`;
}

const ecrireDegats = (degats) => (Array.isArray(degats) ? degats.join("/") : null);

// « Attaque d10 +1 · Couteau d'office, précise, 3/8/20 » : le dé de l'arme
// tenue, son modificateur, puis l'arme. Sans arme tenue, le dé se choisit au
// moment du jet.
function attaqueDuPj(etat, id, photo) {
  const tenue = photo.armes.find((arme) => !arme.mainsNues) ?? null;
  if (tenue !== null && tenue.faces !== null) {
    const parties = [tenue.libelle, POIDS[tenue.poids] ?? null, ecrireDegats(tenue.degats)].filter(present);
    return `Attaque d${tenue.faces}${modificateurAffiche(etat, id, "attaque", tenue.caracteristiques)} ${SIGNES.point} ${parties.join(", ")}`;
  }
  const nues = photo.armes.find((arme) => arme.mainsNues) ?? null;
  const suite = nues === null ? "" : ` ${SIGNES.point} ${[nues.libelle, ecrireDegats(nues.degats)].filter(present).join(", ")}`;
  return `Attaque dé au choix${suite}`;
}

// « Défense d8 +1 · agile, types mêlés ».
function defenseDuPj(etat, id, photo) {
  const de = photo.deDefense;
  if (de === null) return null;
  const parties = [POIDS[de.type] ?? null, de.meles ? "types mêlés" : null].filter(present);
  return `Défense d${de.faces}${modificateurAffiche(etat, id, "defense", de.caracteristiques)}${parties.length > 0 ? ` ${SIGNES.point} ${parties.join(", ")}` : ""}`;
}

// « Attaque 5 · Défense 7 · Spatule souple 6/12/19 » : un adversaire ne lance
// rien, ses deux nombres sont des difficultés.
function valeursDeLAdversaire(etat, id, photo) {
  const armes = photo.armes.map((arme) => [arme.libelle, ecrireDegats(arme.degats)].filter(present).join(" "));
  return [`Attaque ${attaqueDe(etat, id).valeur}`, `Défense ${defenseDe(etat, id).valeur}`, ...armes].join(` ${SIGNES.point} `);
}

const etatDeLArmure = ({ armure, armureMax }) => (armure <= 0 && armureMax > 0 ? "detruite" : armure < armureMax ? "abimee" : null);

const STATUTS = { joue: "joue", cible: "ciblé", a_joue: "a joué" };
const MARQUES = { joue: "joue", cible: "ciblee", mort: "morte" };

// ─── Les étiquettes des effets durables ─────────────────────────────────────
//
// Une étiquette par effet durable porté (etat.effets), dans leur ordre
// (mission du lot 4.3, § 4.7 ; contrat de la vague 3, § 3.3, D13) : son nom,
// sa source, sa durée, sa couleur, son texte ; un état seul se retire par le
// MJ (✕, en Mode MJ) et ouvre la palette à son nom (« Appliquer l'effet
// de… », dans les deux modes). Le noyau ne retire ni un ±N, ni une garde, ni
// une attaque en plus : ceux-là n'ont pas de ✕.

const POINTS = String.fromCodePoint(0x2026);
const VALEURS_D_UN_MODIF = { attaque: "Attaque", defense: "Défense" };

// « Étourdi », « Main brûlée », ou le nom libre d'un état.
const nomDUnEtat = (effet) => effet.capacite?.nom ?? effet.libre ?? "";

// La façon d'une capacité figée, ou de la ligne qu'une garde garde.
const descriptionDe = (capacite, facon = null) => {
  const lue = capacite === null ? null : (element(capacite.facons, facon ?? faconTenue(capacite)) ?? null);
  return lue?.description ?? "";
};

// « Appliquer l'effet de Frappe… », « Appliquer l'effet d'Étourdi… ».
const appliquerLEffetDe = (nom) => `Appliquer l'effet ${deNom(nom)}${POINTS}`;

// Le nom, la couleur et le texte de chaque genre d'effet durable (D13 : vert
// pour un ±N positif et pour une garde, rouge pour une blessure, la couleur
// d'alerte pour le reste).
function lireLEffet(etat, effet) {
  if (effet.genre === "etat") {
    return { nom: nomDUnEtat(effet), couleur: effet.blessure === true ? "blessure" : "alerte", texte: effet.capacite ? descriptionDe(effet.capacite) : null };
  }
  if (effet.genre === "modif") {
    return { nom: `${VALEURS_D_UN_MODIF[effet.valeur] ?? ""} ${signer(effet.n)}`, couleur: effet.n > 0 ? "favorable" : "alerte", texte: null };
  }
  if (effet.genre === "guet") {
    const capacite = capaciteDe(etat, effet.porteur, effet.garde?.capacite);
    const facon = element(capacite?.facons, effet.garde?.facon);
    return { nom: `en guet : ${capacite === null ? "" : libelleDe(capacite, facon)}`, couleur: "favorable", texte: facon?.description ?? null };
  }
  return { nom: "attaque en plus", couleur: "alerte", texte: null };
}

// La source d'une étiquette (R n° 16) : pour une blessure, le titre du bloc de
// sa capacité figée ; sinon le nom de la source (« MJ », « Taloche »).
const sourceDeLEtiquette = (etat, effet) => (effet.genre === "etat" && effet.blessure === true ? (effet.capacite?.groupe?.titre ?? null) : nomDeLaSource(etat, effet.source));

// La durée : celle du journal ; une garde court jusqu'au prochain tour du camp
// de son porteur, que l'effet porte.
const dureeDeLEtiquette = (etat, effet) => (effet.genre === "guet" ? ecrireDuree(etat, "tour", null, effet.camp) : ecrireDuree(etat, effet.duree, effet.auteur ?? null, effet.camp ?? null));

function etiquettesDe(etat, id) {
  return effetsDurablesDe(etat, id).map((effet) => {
    const { nom, couleur, texte } = lireLEffet(etat, effet);
    const unEtat = effet.genre === "etat";
    let retirer = null;
    if (unEtat) {
      const verdict = jugerMj(etat, { type: "mj", genre: "etat", qui: id, retrait: effet.id });
      retirer = {
        libelle: `Retirer l'état ${nom}`,
        actif: verdict.ok,
        raison: verdict.ok ? null : verdict.message,
        commande: { evenement: { type: "mj", genre: "etat", qui: id, retrait: effet.id } },
        mj: true,
      };
    }
    return {
      id: effet.id,
      genre: effet.genre,
      nom,
      source: sourceDeLEtiquette(etat, effet),
      duree: dureeDeLEtiquette(etat, effet),
      couleur,
      texte,
      retirer,
      appliquer: unEtat ? { libelle: appliquerLEffetDe(nom), source: { genre: "etat", effet: effet.id } } : null,
    };
  });
}

/**
 * La fiche vivante d'un protagoniste : son en-tête (initiales, nom entier,
 * sous-titre, statut, actions restantes, écrites « actions restantes : 1
 * sur 2 »), ses jauges, la table de ses zones dans l'ordre du d20, ses
 * valeurs d'attaque et de défense, ses jauges de lien (une jauge de taille 0
 * n'y est pas), ses passifs câblés, actifs ou non avec leur raison.
 * « jouer » porte la commande qui le choisit, s'il peut l'être, exactement
 * comme son jeton (vuePlateau) : tant que rien n'est payé, hors d'un choix de
 * cible ou d'arrivée ; celui qui joue n'en a pas. « avant », le champ
 * « Case » et « Retirer » d'avant le lancement. null pour qui n'est pas dans
 * le combat.
 *
 * À la vague 3 du lot 4.3 (contrat de la vague, § 3.3) : « jeu » (« peut_agir »,
 * « epuise », ou null hors du camp qui joue : la couleur de la fiche) ;
 * « effets », une étiquette par effet durable porté ; « pastille » ;
 * « menuMj », « Modifier… » (Mode MJ seulement).
 */
export function vueFiche(etat, id, choisi) {
  const photo = photoDe(etat, id);
  const courant = courantDe(etat, id);
  if (photo === null || courant === null) return null;
  const acteur = acteurCourant(etat, choisi);
  const situation = situationDe(etat, id, acteur);
  const estUnPj = courant.camp === "pj";
  const geste = gesteEnCours(etat);
  const libre = !engage(etat, geste) && choixSurLePlateau(etat) === null;
  const lesCandidats = candidats(etat);

  return {
    id,
    camp: courant.camp,
    initiales: etat.noms?.[id]?.initiales ?? "?",
    nom: nomEntier(etat, id),
    sousTitre: photo.sousTitre,
    statut: situation === "mort" ? `mort au tour ${courant.mort.tour}` : (STATUTS[situation] ?? null),
    marques: Object.hasOwn(MARQUES, situation ?? "") ? [MARQUES[situation]] : [],
    actions: { reste: courant.actions, max: courant.actionsMax, texte: actionsRestantes(courant) },
    souffle: { valeur: courant.souffle, max: courant.souffleMax, absent: photo.souffleAbsent === true },
    corps: { valeur: courant.corps, max: courant.corpsMax },
    zones: photo.zones.map((zone, rang) => {
      const etatDeLaZone = courant.zones[rang];
      return {
        faces: ecrireFaces(zone),
        nombreDeFaces: zone.fin - zone.debut + 1,
        nom: zone.nom,
        armure: { valeur: etatDeLaZone.armure, max: etatDeLaZone.armureMax, etat: etatDeLArmure(etatDeLaZone) },
        resistance: { valeur: etatDeLaZone.resistance, max: etatDeLaZone.resistanceMax },
      };
    }),
    contre: `${photo.faceContre} : contre-attaque`,
    attaque: estUnPj ? attaqueDuPj(etat, id, photo) : valeursDeLAdversaire(etat, id, photo),
    defense: estUnPj ? defenseDuPj(etat, id, photo) : null,
    bouclier: photo.bouclier === null ? null : `${photo.bouclier.nom} : ${photo.bouclier.defense} (sans effet)`,
    liens: photo.liens.map((lien, rang) => ({ nom: lien.nom, valeur: courant.liens[rang].points, max: courant.liens[rang].max })).filter((lien) => lien.max > 0),
    passifs: passifsDe(etat, id).map(({ nom, effet, actif, raison }) => ({ texte: `${nom} : ${effet}`, actif, raison })),
    effets: etiquettesDe(etat, id),
    jouer: libre && id !== acteur && lesCandidats.includes(id) ? { commande: { choisir: id } } : null,
    avant:
      etat.phase === "preparation"
        ? { case: courant.case, poser: { gabarit: { preparer: { type: "poser", id } } }, retirer: { commande: { preparer: { type: "retirer", id } } } }
        : null,
    jeu: jeuDe(etat, id, lesCandidats),
    pastille: pastilleDe(etat, id),
    menuMj: etat.phase === "combat" ? menuMjDe(etat, id, offre(etat)) : null,
  };
}

// ─── Les causes des avantages et des désavantages ───────────────────────────
//
// Une phrase par source (complément, § 4.3 ; contrat du groupe 2, § 8.3),
// tirée de son rôle et de la situation. Le porteur d'une source est celui
// qui en tient le passif, la maîtrise ou l'armure : le lanceur quand la
// source n'est pas inversée (« de » nul), l'autre protagoniste du jet sinon ;
// sa case est la courante. Les phrases qui portent un nom ne s'accordent pas
// avec lui et n'élident rien.

const A_UN_ALLIE = ["en_meute", "esprit_de_corps"];

// La façon d'un passif dont on cite la description : celle de puissance égale
// à son niveau, sinon la dernière.
const faconDuPassif = (capacite) => capacite.facons.find((facon) => facon.puissance === capacite.niveau) ?? capacite.facons[capacite.facons.length - 1] ?? null;

// « Solo du chef [1] » : le nom d'un passif, et son niveau quand il évolue.
const nomDuPassif = (capacite, nom) => `${nom ?? capacite?.nom ?? ""}${capacite?.evolue ? ` [${capacite.niveau}]` : ""}`;

// La phrase d'une source, vue de son porteur. « facon » est celle du geste
// (ou de la ligne survolée) : elle porte la cause de la maîtrise.
function phraseDeLaSource(etat, source, porteur, facon) {
  if (source.genre === "maitrise") {
    const { origine = "", poids = null } = facon?.maitrise ?? {};
    return `${source.nom} hors maîtrise : ${source.nom} vient du ${origine} (${POIDS[poids] ?? ""}), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; ${compter(source.nombre, "désavantage")}.`;
  }
  if (source.genre === "armure_melee") return "Types d'armure mêlés : 1 désavantage en défense.";
  if (source.genre === "main") return `À la main : ${source.nom ?? ""}.`;
  const capacite = capaciteDe(etat, porteur, source.capacite);
  const nom = nomDuPassif(capacite, source.nom);
  const lieu = courantDe(etat, porteur)?.case ?? "";
  if (source.role === "seul_sur_sa_case") return `${nom} : aucun allié de son camp sur sa case (${lieu}) ; ${compter(source.nombre, "avantage")}.`;
  if (A_UN_ALLIE.includes(source.role)) return `${nom} : un allié sur sa case (${lieu}) ; ${compter(source.nombre, "avantage")}.`;
  // Aucun autre rôle ne donne d'avantage (js/combat/circonstances.js) : à
  // défaut, le nom que le journal donne à la source.
  return `${majuscule(ecrireSource({ ...source, de: null }))}.`;
}

// La description d'un passif, entre guillemets, quand elle n'est pas vide ;
// null pour toute autre source.
function citationDe(etat, source, porteur) {
  if (source.genre !== "passif") return null;
  const capacite = capaciteDe(etat, porteur, source.capacite);
  const description = capacite === null ? "" : (faconDuPassif(capacite)?.description ?? "");
  return description === "" ? null : `« ${description} »`;
}

// Une cause : sa phrase, l'inversion qui la suit quand elle vient de l'autre,
// la citation de son passif, et son sens dans le jet (ou vu du porteur).
function causeDe(etat, source, { sens, porteur, lanceur, facon }) {
  let texte = phraseDeLaSource(etat, source, porteur, facon);
  if (present(source.de)) {
    const devient = sens === "desavantage" ? "cet avantage devient un désavantage" : "ce désavantage devient un avantage";
    texte += ` Venu de ${source.de} : ${devient} pour ${court(etat, lanceur)}.`;
  }
  return { texte, citation: citationDe(etat, source, porteur), sens };
}

// « 1 avantage », « 2 désavantages », « avantages et désavantages
// s'annulent » : le net d'un jet ; null quand il n'a rien.
function ecrireNet(jet) {
  const net = netDe(jet);
  if (net !== 0) return compter(Math.abs(net), net > 0 ? "avantage" : "désavantage");
  return jet.avantages.length > 0 && jet.desavantages.length > 0 ? "avantages et désavantages s'annulent" : null;
}

// Le compte, seulement quand avantages et désavantages sont là ensemble.
function compteDuJet(jet) {
  const nombre = (sources) => somme(sources.map((source) => source.nombre));
  if (nombre(jet.avantages) === 0 || nombre(jet.desavantages) === 0) return null;
  const net = netDe(jet);
  if (net === 0) return "Avantages et désavantages s'annulent : aucun ne reste.";
  return `Avantages et désavantages s'annulent : il reste ${compter(Math.abs(net), net > 0 ? "avantage" : "désavantage")}.`;
}

// Les causes d'un jet : null sans source ; sinon le nombre (« 1 avantage »),
// le nom du bouton qui l'explique, une phrase par source (les avantages, puis
// les désavantages, dans l'ordre du jet) et le compte.
function causesDuJet(etat, geste, jet) {
  const nombre = ecrireNet(jet);
  if (nombre === null) return null;
  const autre = jet.lanceur === geste.acteur ? geste.cible : geste.acteur;
  const facon = faconDe(etat, geste);
  const lire = (sens) => (source) => causeDe(etat, source, { sens, porteur: present(source.de) ? autre : jet.lanceur, lanceur: jet.lanceur, facon });
  return {
    nombre,
    nom: `${nombre} : voir la cause`,
    phrases: [...jet.avantages.map(lire("avantage")), ...jet.desavantages.map(lire("desavantage"))],
    compte: compteDuJet(jet),
  };
}

// ─── La bulle : les lignes, les passifs, leurs survols ──────────────────────

// « gratuit », « 4 souffle », « 1 souffle, 1 lien », « X souffle » ; null
// pour un coût illisible (la ligne dit alors pourquoi elle est inactive).
function coutDeLaLigne(facon) {
  if (facon === null || facon.cout === null) return null;
  const { souffle, lien } = facon.cout;
  const parties = [];
  if (souffle === "X" || souffle > 0) parties.push(`${souffle} souffle`);
  if (lien === "X" || lien > 0) parties.push(`${lien} lien`);
  return parties.length > 0 ? parties.join(", ") : "gratuit";
}

// « Coût : 1 action, aucun souffle », « Coût : 1 action, 4 souffle, 1 lien » ;
// un adversaire ne paie pas le lien, et le survol le dit.
function coutDuSurvol(facon, camp) {
  if (facon === null || facon.cout === null) return "Coût : illisible";
  const { souffle, lien } = facon.cout;
  const avecLien = lien === "X" || lien > 0;
  const parties = ["1 action", souffle === 0 ? "aucun souffle" : `${souffle} souffle`, ...(avecLien ? [`${lien} lien`] : [])];
  const nonPaye = avecLien && camp !== "pj" ? " ; coût en lien non payé : un adversaire n'a pas de lien" : "";
  return `Coût : ${parties.join(", ")}${nonPaye}`;
}

// La portée d'une ligne, en clair, selon le mode du geste qu'elle ouvre.
function porteeDite(mode, facon) {
  if (mode === "attaque") {
    const portee = facon.portee ?? 0;
    if (portee === 0) return "Portée 0 : sa case seule, hachurée sur la carte.";
    if (portee === 1) return "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte.";
    return `Portée ${portee} : sa case et les cases à ${portee} de distance au plus, hachurées sur la carte.`;
  }
  if (mode === "deplacement") return `Arrivée : les cases à une distance de 1 à ${facon.puissance}, hachurées sur la carte.`;
  if (mode === "caracteristique") return "Sans cible";
  if (mode === "sans_jet") return "Cible au choix, sans condition de portée";
  return null;
}

// Les cases hachurées d'une ligne, depuis la case de son porteur : une
// attaque, de 0 à sa portée ; un déplacement, de 1 à sa puissance ; rien
// d'autre ne se hachure.
function hachuresDeLaLigne(mode, facon, depart, hachures) {
  if (mode === "attaque") return hachures(depart, 0, facon.portee ?? 0);
  if (mode === "deplacement") return hachures(depart, 1, facon.puissance);
  return [];
}

// L'origine qu'un survol écrit après le titre : pour un PJ, l'arme qui donne
// la façon, sinon le titre de son groupe ; l'arme des mains nues porte le nom
// de sa capacité (« Taloche · Taloche ») : c'est donc le titre du groupe
// (« Taloche · Gestes de cuisine »). Pour un adversaire, le libellé de la
// façon (son arme), sinon rien.
function origineDe(photo, capacite, facon, camp) {
  if (camp !== "pj") return facon?.libelle ?? null;
  const arme = facon === null ? null : element(photo.armes, facon.arme);
  return arme && !arme.mainsNues ? arme.libelle : capacite.groupe.titre;
}

// Le survol d'une ligne (contrat du groupe 2, § 8.2).
function survolDeLaLigne(etat, acteur, indice, rang, hachures) {
  const photo = photoDe(etat, acteur);
  const capacite = photo.capacites[indice];
  const facon = element(capacite.facons, rang);
  const camp = campDe(etat, acteur);
  if (facon === null) {
    return { titre: capacite.nom, origine: origineDe(photo, capacite, null, camp), description: "", portee: null, causes: [], cout: coutDuSurvol(null, camp), hachures: [] };
  }
  const mode = modeDeLaFacon(capacite, facon, camp);
  const { avantages, desavantages } = sourcesSansCible(etat, acteur, indice, rang);
  const lire = (sens) => (source) => causeDe(etat, source, { sens, porteur: acteur, lanceur: acteur, facon });
  return {
    titre: capacite.nom,
    origine: origineDe(photo, capacite, facon, camp),
    description: facon.description ?? "",
    portee: porteeDite(mode, facon),
    causes: [...avantages.map(lire("avantage")), ...desavantages.map(lire("desavantage"))],
    cout: coutDuSurvol(facon, camp),
    hachures: hachuresDeLaLigne(mode, facon, courantDe(etat, acteur)?.case ?? null, hachures),
  };
}

// Ce qu'une ligne montre après son libellé : les dégâts d'une attaque, les
// cases d'un déplacement.
function degatsDeLaLigne(mode, facon) {
  if (mode === "attaque") return ecrireDegats(facon.degats);
  if (mode === "deplacement") return compter(facon.puissance, "case");
  return null;
}

// Les lignes de qui joue, une par façon que l'offre lui donne (offre.js,
// boutons), chacune avec le groupe où elle se range. Une fois le geste
// engagé (payé, ou emboîté), plus aucune ne se joue.
function lignesVues(etat, acteur, geste, hachures) {
  const photo = photoDe(etat, acteur);
  const camp = campDe(etat, acteur);
  const paye = engage(etat, geste);
  return boutons(etat, acteur).map((offert) => {
    const capacite = photo.capacites[offert.capacite];
    const facon = element(capacite.facons, offert.facon);
    let { actif, raison } = offert;
    if (paye && facon !== null) {
      actif = false;
      raison = ACTION_EN_COURS;
    }
    const mode = facon === null ? null : modeDeLaFacon(capacite, facon, camp);
    const groupe = camp !== "pj" && facon !== null && facon.arme !== null ? { genre: "arme", titre: element(photo.armes, facon.arme)?.libelle ?? capacite.groupe.titre } : capacite.groupe;
    const libelle = libelleDe(capacite, facon);
    return {
      groupe,
      ligne: {
        cle: `${offert.capacite}:${offert.facon ?? ""}`,
        libelle,
        degats: facon === null ? null : degatsDeLaLigne(mode, facon),
        desavantage: facon?.desavantage === true,
        intervention: facon?.intervention === true,
        cout: coutDeLaLigne(facon),
        choisi: geste !== null && facon !== null && geste.capacite === offert.capacite && geste.facon === offert.facon,
        actif,
        raison,
        commande: facon === null ? null : { evenement: { type: "capacite", qui: acteur, capacite: offert.capacite, facon: offert.facon } },
        jouer: `Jouer ${libelle}`,
        survol: survolDeLaLigne(etat, acteur, offert.capacite, offert.facon, hachures),
      },
    };
  });
}

// Les groupes de la bulle. Un PJ : un groupe s'ouvre quand le genre ou le
// titre change, dans l'ordre de ses capacités. Un adversaire : un groupe par
// arme, avec les façons qu'elle donne, puis « Capacités » ; une capacité que
// donnent deux armes a une ligne sous chacune.
function grouper(vues, parArme) {
  const groupes = [];
  for (const { groupe, ligne } of vues) {
    const meme = (un) => un.genre === groupe.genre && un.titre === groupe.titre;
    let cible = parArme ? (groupes.find(meme) ?? null) : groupes.length > 0 && meme(groupes[groupes.length - 1]) ? groupes[groupes.length - 1] : null;
    if (cible === null) {
      cible = { genre: groupe.genre, titre: groupe.titre, lignes: [] };
      groupes.push(cible);
    }
    cible.lignes.push(ligne);
  }
  return groupes.map(({ titre, lignes }) => ({ titre, lignes }));
}

// Les passifs du pied de la bulle : les capacités dont toutes les façons sont
// passives, chacune avec son niveau quand elle évolue, et son survol.
function passifsVus(etat, acteur) {
  const photo = photoDe(etat, acteur);
  const camp = campDe(etat, acteur);
  const passifs = [];
  photo.capacites.forEach((capacite, indice) => {
    if (capacite.facons.length === 0 || !capacite.facons.every((facon) => facon.passif)) return;
    const facon = faconDuPassif(capacite);
    passifs.push({
      cle: `passif:${indice}`,
      libelle: nomDuPassif(capacite, capacite.nom),
      survol: { titre: capacite.nom, origine: origineDe(photo, capacite, facon, camp), description: facon?.description ?? "", portee: null, causes: [], cout: "Passif : ne se joue pas", hachures: [] },
    });
  });
  return passifs;
}

// ─── La bulle : les étapes ──────────────────────────────────────────────────

const nomDuJet = (etat, geste) => (geste?.mode === "caracteristique" ? "Jet de caractéristique" : campDe(etat, geste?.acteur) === "pj" ? "Jet d'attaque" : "Jet de défense");

// Les étapes d'un geste, et le rang de celle qui est en cours. Aux suites,
// « Interventions » est en cours tant que l'étape offre quelqu'un (le geste
// vu porte « interventions »), sinon « Dégâts » (contrat de la vague 3,
// § 3.2, R n° 14).
function etapesDe(etat, acteur, geste, offerts, vu) {
  const jet = geste === null ? (campDe(etat, acteur) === "pj" ? "Jet d'attaque" : "Jet de défense") : nomDuJet(etat, geste);
  const entieres = ["Capacité", "Cible", jet, "Localisation", "Interventions", "Dégâts"];
  if (geste === null) return { noms: entieres, enCours: 0 };
  if (geste.mode === "deplacement") return { noms: ["Capacité", "Arrivée"], enCours: 1 };
  if (geste.mode === "sans_jet") return { noms: ["Capacité", "Cible"], enCours: 1 };
  if (geste.mode === "caracteristique") return { noms: ["Capacité", jet], enCours: 1 };
  if (geste.mode === "attendre") return { noms: ["Capacité", "Garde"], enCours: 1 };
  // Les moments neufs se rangent sous les étapes d'aujourd'hui : le critique
  // sous le jet, la contre-attaque sous la localisation, la blessure sous les
  // dégâts.
  const parMoment = {
    preparation: offerts.pret?.ok ? 2 : 1,
    jet: 2,
    critique: 2,
    bilan: 2,
    localisation: 3,
    contre_attaque: 3,
    suites: (vu?.interventions ?? null) !== null ? 4 : 5,
  };
  return { noms: entieres, enCours: parMoment[geste.moment] ?? 5 };
}

function etapesVues(etat, acteur, geste, offerts, vu) {
  const { noms, enCours } = etapesDe(etat, acteur, geste, offerts, vu);
  return noms.map((nom, rang) => ({ nom, etat: rang < enCours ? "faite" : rang === enCours ? "en_cours" : "a_venir" }));
}

// ─── La bulle : le volet du téléphone ───────────────────────────────────────
//
// Au téléphone, le volet montre une étape à la fois (mission du lot 4.3, § 3 ;
// contrat de la vague 3, § 3.2, D8, R n° 26) : « etape » dit laquelle (0, la
// capacité ; 1, ce qui se règle ; 2, les dés ; 3, la zone et les dégâts), et
// « fil » la suite des étapes du geste, l'une en cours.

// L'étape que montre le volet, d'après le moment du geste. En préparation,
// un geste sans jet reste à 1 (sa cible, « Confirmer »), et une façon
// Centrée aussi tant qu'elle vise deux cibles ou plus (« Un jet par cible »
// y passe aux dés) ; une seule cible cochée en fait une attaque ordinaire
// (mission du lot 4.3, § 4.9) : un jet passe à 2 dès qu'il est prêt.
const ETAPE_DU_MOMENT = { jet: 2, critique: 2, bilan: 3, localisation: 3, contre_attaque: 3, suites: 3, blessure: 3 };

function etapeDuVolet(etat, geste, offerts) {
  if (geste === null) return 0;
  if (geste.moment !== "preparation") return ETAPE_DU_MOMENT[geste.moment] ?? 3;
  if (!MODES_A_JET.includes(geste.mode)) return 1;
  if (Object.hasOwn(offerts.reglages, "cibles") && jetsParCibleDe(etat, geste, offerts) !== null) return 1;
  return offerts.pret.ok ? 2 : 1;
}

// Les entrées du fil, selon le mode du geste ; sans geste, celles d'une
// attaque. « Dés » se dit « Défense » quand le lanceur est le PJ visé (un
// adversaire attaque).
function entreesDuFil(etat, acteur, geste) {
  const mode = geste?.mode ?? "attaque";
  if (mode === "deplacement") return [["Capacité", 0], ["Arrivée", 1]];
  if (mode === "sans_jet") return [["Capacité", 0], ["Cible", 1]];
  if (mode === "attendre") return [["Capacité", 0], ["Garde", 1]];
  if (mode === "caracteristique") return [["Capacité", 0], ["Dés", 2]];
  const des = campDe(etat, geste?.acteur ?? acteur) === "pj" ? "Dés" : "Défense";
  return [["Capacité", 0], ["Cible", 1], [des, 2], ["Zone et dégâts", 3]];
}

// L'entrée en cours est celle de la plus grande étape qui ne dépasse pas
// celle du volet ; avant elle « faite », après elle « a_venir ».
function filDe(etat, acteur, geste, etape) {
  const entrees = entreesDuFil(etat, acteur, geste);
  let enCours = 0;
  entrees.forEach(([, pas], rang) => {
    if (pas <= etape) enCours = rang;
  });
  return entrees.map(([nom, pas], rang) => ({ nom, etape: pas, etat: rang < enCours ? "faite" : rang === enCours ? "en_cours" : "a_venir" }));
}

// « (portée 0 : sa case) », « (portée 1 : sa case et les huit voisines) »,
// « (portée 3 : à 3 cases au plus) ».
function porteeDeLaConsigne(portee) {
  if (portee === 0) return "(portée 0 : sa case)";
  if (portee === 1) return "(portée 1 : sa case et les huit voisines)";
  return `(portée ${portee} : à ${portee} cases au plus)`;
}

// La portée d'une attaque : celle de la façon jouée ; pour un jet prêté,
// celle de l'arme prêtée, 0 sans arme (comme offre.js).
const porteeDuGeste = (etat, geste, facon) => (geste.mode === "jet_prete" ? (armePreteeDe(etat, geste)?.portee ?? 0) : (facon?.portee ?? 0));

// La consigne en tête du volet : sans geste, « Que fait Aubépine ? » ; une
// cible à choisir, « Contre qui ? » et la portée ; une façon Centrée, « Toute
// la case D4 : qui est visé ? » ; attendre, la capacité à garder. null
// ailleurs, et pour une capacité sans jet, dont la cible n'a pas de portée.
function consigneDe(etat, acteur, geste, offerts) {
  if (geste === null) return `Que fait ${court(etat, acteur)} ?`;
  if (geste.moment !== "preparation") return null;
  if (Object.hasOwn(offerts.reglages, "cibles")) return `Toute la case ${courantDe(etat, geste.acteur)?.case ?? ""} : qui est visé ?`;
  if (Object.hasOwn(offerts.reglages, "garde")) {
    return `Quelle capacité garder pour le tour adverse ? Elle s'y jouera en intervention, jusqu'au prochain tour des ${CAMPS[campDe(etat, geste.acteur)] ?? ""}.`;
  }
  if (Object.hasOwn(offerts.reglages, "cible") && MODES_D_ATTAQUE.includes(geste.mode)) return `Contre qui ? ${porteeDeLaConsigne(porteeDuGeste(etat, geste, faconDe(etat, geste)))}`;
  return null;
}

// ─── La bulle : le geste ────────────────────────────────────────────────────

// Le jet d'un geste : celui qui s'est figé au premier dé ; avant, celui qui
// se figerait à cet instant (il suit la cible et les réglages) ; null tant
// qu'il manque de quoi l'ouvrir.
function jetDe(etat, geste) {
  if (geste.jet) return geste.jet;
  if (!MODES_A_JET.includes(geste.mode)) return null;
  const lues = circonstances(etat, geste);
  return lues.manque ? null : ouvrirJet(lues);
}

const nomDeCaracteristique = (code) => CARACTERISTIQUES.find((caracteristique) => caracteristique.code === code)?.nom ?? code;

// « +1 (Vif) », « −2 (blessures) », « +1 (à la main : Minutie) ».
function ecrireModificateur({ genre, nom, valeur }) {
  const source = genre === "blessures" ? "blessures" : genre === "main" ? `à la main : ${nom}` : `${nom}`;
  return `${signer(valeur)} (${source})`;
}

const DIFFICULTE_DITE = { attaque: "sa défense", defense: "son attaque" };

// Le type d'armure du jet de défense, au choix tant que l'offre le règle :
// « Défense : » et une option par type à égalité de dés.
function defenseVue(offerte) {
  if (!offerte) return null;
  return {
    libelle: "Défense :",
    options: offerte.options.map((code) => ({ code, libelle: POIDS[code] ?? code, choisie: code === offerte.valeur, commande: regler("defense", code) })),
  };
}

// Le contexte du jet : le dé, ses modificateurs, la difficulté, les causes de
// ses avantages et désavantages, la défense au choix. Avant le premier dé, il
// porte aussi les deux réglages à la main. Le dé s'y écrit nu (« d8 ») : ses
// modificateurs le suivent, chacun une fois, avec sa source. Écrit « d8+1 »
// devant « +1 (Vif) », il se lisait d8+1+1.
function contexteVu(etat, geste, capacite, jet, offerts) {
  const aLaMain = (champ) => {
    const offert = offerts.reglages[champ];
    return {
      valeur: offert.valeur,
      raison: geste.reglages?.[champ]?.raison ?? null,
      min: offert.min,
      max: offert.max,
      raisonParDefaut: raisonDepuis(capacite.nom),
      gabarit: gabaritDe(champ),
    };
  };
  // Les réglages à la main ne se montrent qu'en Mode MJ (mission du lot 4.3, § 5).
  const reglages = Object.hasOwn(offerts.reglages, "modificateur") ? { modificateur: aLaMain("modificateur"), avantages: aLaMain("avantages"), mj: true } : null;
  const defense = defenseVue(offerts.reglages.defense);

  if (jet === null) return { de: null, detail: null, modificateurs: [], difficulte: null, causes: null, defense, reglages };
  const valeurs = photoDe(etat, jet.lanceur)?.caracteristiques ?? {};
  return {
    de: `d${jet.faces}`,
    detail: jet.mobilisees.map((code) => `${nomDeCaracteristique(code)} ${valeurs[code] ?? "?"}`).join(" + "),
    modificateurs: jet.modificateurs.map(ecrireModificateur),
    difficulte: `${jet.difficulte}, ${jet.libelle ?? DIFFICULTE_DITE[jet.genre]}`,
    causes: causesDuJet(etat, geste, jet),
    defense,
    reglages,
  };
}

// Le détail d'un dé lancé : « 8 + 1 » ; sous désavantage, « 8/4 → 4 + 1 » ;
// avec ses explosions, brutes, « 6 + 1 + 3 ». null quand la valeur dit tout.
function detailDeLEssai(jet, essai, { garde }) {
  const modificateur = modificateurDe(jet);
  const parties = [`${garde}`];
  if (modificateur !== 0) parties.push(`${modificateur < 0 ? SIGNES.moins : "+"} ${Math.abs(modificateur)}`);
  for (const ajout of essai.explosions) parties.push(`+ ${ajout}`);
  const lancers = essai.tirages.length > 1 ? `${essai.tirages.join("/")} ${SIGNES.fleche} ` : "";
  return lancers === "" && parties.length === 1 ? null : `${lancers}${parties.join(" ")}`;
}

// La chaîne : une entrée par dé lancé (le dé d'origine d'une place, puis
// chacune de ses relances), le dé à lancer, puis les places à venir. Un dé
// qui montre sa face maximale sous la difficulté n'est ni réussi ni échoué :
// il reste « à lancer », et c'est lui qu'on clique pour le faire exploser.
function chaineVue(jet) {
  const de = `d${jet.faces}`;
  const entrees = [];
  const derniere = jet.places.length - 1;
  const explose = jet.attente === "choix_explosion" || jet.attente === "de_explosion";
  jet.places.forEach((place, rang) => {
    place.essais.forEach((essai, numero) => {
      const evalue = evaluerEssai(jet, essai);
      const enJeu = rang === derniere && numero === place.essais.length - 1;
      let etat = evalue.reussi ? "reussi" : "echoue";
      if (numero < place.essais.length - 1 || (enJeu && jet.attente === "de_relance")) etat = "relance";
      else if (enJeu && explose) etat = "a_lancer";
      entrees.push({ titre: numero === 0 ? RANGS[rang] : "relance", etat, valeur: evalue.somme, detail: detailDeLEssai(jet, essai, evalue) });
    });
  });
  if (jet.attente === "de_relance") entrees.push({ titre: "relance", etat: "a_lancer", de });
  if (jet.attente === "de") entrees.push({ titre: RANGS[jet.places.length], etat: "a_lancer", de });
  if (jet.attente !== "fini") {
    for (let rang = jet.places.length + (jet.attente === "de" ? 1 : 0); rang < REUSSITES_MAX; rang += 1) entrees.push({ titre: RANGS[rang], etat: "a_venir", de });
  }
  return entrees;
}

// Ce que dit le bilan pendant la chaîne, selon ce que le jet attend. La
// relance reprend la tête, comme sur la maquette : « 1 réussite pour
// l'instant. Avantage dépensé : … ». Une relance de la palette ne dépense
// aucun avantage (jet.relanceParPalette) : elle ne le dit donc pas.
//
// Au téléphone, le geste est un toucher (mission du lot 4.3, § 6, point 4) :
// la même phrase s'écrit avec « touchez » (bilanAuDoigt). Le verbe est un
// argument : rien n'est jamais cherché ni remplacé dans un texte, qui peut
// porter un nom.
const VERBES = { clic: { tete: "Cliquez sur", suite: "cliquez sur" }, doigt: { tete: "Touchez", suite: "touchez" } };

const BILANS_DU_JET = {
  de: (jet, tete, verbe) => `${tete} ${verbe.tete} le d${jet.faces} pour lancer le ${RANGS[jet.places.length]}.`,
  choix_relance: (jet, tete) => `${tete} Le ${RANGS[jet.places.length - 1]} échoue : il reste ${compter(relancesRestantes(jet), "avantage")}.`,
  de_relance: (jet, tete, verbe) => {
    const clic = `${verbe.suite} le d${jet.faces} pour relancer le ${RANGS[jet.places.length - 1]}.`;
    return `${tete} ${jet.relanceParPalette === true ? majuscule(clic) : `Avantage dépensé : ${clic}`}`;
  },
  choix_explosion: (jet) => `Le ${RANGS[jet.places.length - 1]} montre sa face maximale sans atteindre la difficulté : il peut exploser.`,
  de_explosion: (jet, tete, verbe) => `${verbe.tete} le d${jet.faces} pour faire exploser le ${RANGS[jet.places.length - 1]}.`,
};

function bilanVu(etat, geste, jet, offerts, verbe = VERBES.clic) {
  if (geste.moment === "preparation") {
    if (!offerts.pret.ok) return offerts.pret.manque;
    if (offerts.de === null) return null;
    const plusieurs = offerts.de.combien > 1 ? ` Il se lance ${offerts.de.combien} fois : le pire est gardé.` : "";
    return `${verbe.tete} le d${offerts.de.faces} pour lancer le ${RANGS[0]}.${plusieurs}`;
  }
  if (jet === null) return null;
  if (geste.moment === "jet") {
    const nombre = reussites(jet);
    const tete = nombre === 0 ? "Aucune réussite pour l'instant." : `${compter(nombre, "réussite")} pour l'instant.`;
    return Object.hasOwn(BILANS_DU_JET, jet.attente) ? BILANS_DU_JET[jet.attente](jet, tete, verbe) : tete;
  }
  return `${majuscule(ecrireBilan(etat, geste))}.`;
}

// L'arme qui prête son jet ; null quand il se fait « sans arme ».
const armePreteeDe = (etat, geste) => element(photoDe(etat, geste.acteur)?.armes, geste.armePretee);

// Les trois dégâts que le geste lit : ceux de la façon jouée pour une
// attaque, ceux de l'arme prêtée pour un jet prêté.
function tarifDe(etat, geste, facon) {
  if (geste.mode === "attaque") return facon.degats ?? null;
  if (geste.mode === "jet_prete") return armePreteeDe(etat, geste)?.degats ?? null;
  return null;
}

// Les rangs de dégâts, le rang atteint en évidence, puis dégrossir. En
// attaque, le rang monte avec les réussites ; en défense il descend, et ne se
// connaît qu'à la fin de la chaîne.
function lettresVues(etat, geste, facon, jet) {
  const tarif = tarifDe(etat, geste, facon);
  if (tarif === null) return null;
  const enDefense = campDe(etat, geste.acteur) !== "pj";
  const fini = geste.moment !== "preparation" && geste.moment !== "jet";
  const atteinte = jet !== null && jet.places.length > 0 && (fini || !enDefense) ? lettreDe(enDefense ? "defense" : "attaque", reussites(jet)) : null;
  const lignes = [0, 1, 2, 3].map((nombre) => {
    const lettre = lettreDe(enDefense ? "defense" : "attaque", nombre);
    if (lettre === null) return enDefense ? { texte: `${nombre} : aucun dégât` } : null;
    const tete = nombre === 0 ? "aucune réussite" : nombre === 1 ? "1 réussite" : `${nombre}`;
    return lettre === atteinte ? { texte: `${tete} : ${tarif[lettre]}`, atteinte: true } : { texte: `${tete} : ${tarif[lettre]}` };
  });
  const degrossir = passifsDe(etat, geste.acteur).find((passif) => passif.role === "degrossir" && passif.niveau > 0) ?? null;
  if (degrossir !== null) lignes.push({ texte: `${degrossir.nom} : ${degrossir.effet}` });
  return lignes.filter(present);
}

const LIBELLES_DE_NATURE = { normaux: "Dégâts normaux", resistance: "Directs, à l'endurance", corps: "Directs, au corps" };

// Les dégâts à fixer, à la fin du jet : la base, un nombre et sa raison, la
// nature. Choisir une base retire le nombre saisi ; des dégâts directs
// exigent un nombre et une raison, que la commande d'une nature porte donc
// toujours (à défaut, les dégâts du moment et le nom de la capacité).
//
// Le nombre saisi est l'ajustement à la main, qui vient après la lettre et
// le critique, avant la palette (contrat de la vague 1, § 12, choix 3) : la
// saisie montre donc la valeur ajustée, sinon la valeur calculée. « Ajusté
// à » la valeur calculée ne change rien (mission du lot, § 6 ; contrat, § 11) :
// en dégâts normaux, « sansEffet » dit ce nombre, et ce qu'il émet : rien,
// ou, s'il y avait un ajustement, des dégâts sans opération, qui le défont.
function degatsVus(etat, geste, capacite, facon, offerts) {
  if (offerts.degats === null) return null;
  const fixes = degatsFixes(etat, geste);
  const operations = (geste.degats?.operations ?? []).map(({ op, valeur, raison }) => ({ op, valeur, raison }));
  const saisi = operations.findLast((operation) => operation.op === "ajuster") ?? null;
  const raisonParDefaut = raisonDepuis(capacite.nom);
  const commande = (base, lesOperations, nature) => ({ evenement: { type: "degats", base, operations: lesOperations, nature } });
  const calculee = fixes.etapes.find((etape) => etape.genre === "critique")?.resultat ?? fixes.deBase;
  const nature = geste.degats?.nature ?? "normaux";
  const lettre = lettreDe(geste.jet.genre, reussites(geste.jet));
  const chiffrer = (tarif) => (tarif !== null && lettre !== null ? ` (${LETTRES[lettre]} = ${tarif[lettre]})` : "");
  const libelles = {
    lettre: `Dégâts du rang${chiffrer(facon.degats ?? null)}`,
    arme: `Dégâts de l'arme${chiffrer(armePreteeDe(etat, geste)?.degats ?? null)}`,
    aucun: "Sans dégâts",
  };
  // Ajuster ce que la règle a calculé est au Mode MJ ; saisir des dégâts que
  // la règle ne donne pas (base « aucun », dégâts illisibles) reste dans les
  // deux modes (mission du lot 4.3, § 5 ; contrat de la vague 3, § 3.2).
  const parLaRegle = fixes.base !== "aucun";
  return {
    bases: offerts.degats.bases.map((base) => ({ libelle: libelles[base], choisie: fixes.base === base, commande: commande(base, [], "normaux") })),
    saisie: {
      valeur: saisi?.valeur ?? calculee,
      raison: saisi?.raison ?? null,
      raisonParDefaut,
      min: 0,
      max: offerts.degats.max,
      gabarit: { evenement: { type: "degats", base: fixes.base, nature } },
      sansEffet: nature === "normaux" ? { valeur: calculee, commande: saisi === null ? null : commande(fixes.base, [], nature) } : null,
      mj: parLaRegle,
    },
    natures: offerts.degats.natures.map((nature) => {
      const directs = saisi !== null ? [saisi] : [{ op: "ajuster", valeur: Math.min(fixes.valeur, offerts.degats.max), raison: raisonParDefaut }];
      return { libelle: LIBELLES_DE_NATURE[nature], choisie: fixes.nature === nature, commande: commande(fixes.base, nature === "normaux" ? operations : directs, nature), mj: true };
    }),
  };
}

// Les d20 lancés, chacun avec sa face, sa zone, et le décalage qu'on peut
// encore lui donner. La zone se lit sur la grille de la victime (un report la
// suit), la face de contre-attaque sur celle du jeté (degats.js,
// localisationsDuGeste).
function localisationVue(etat, geste, offerts) {
  const victime = photoDe(etat, victimeDe(geste));
  const lus = localisationsDuGeste(etat, geste);
  if (victime === null || lus.length === 0) return null;
  return geste.localisation.map(({ brut, decalage }, rang) => {
    const lu = lus[rang];
    if (lu.contre) return { brut, face: brut, zone: "contre-attaque", decaler: null };
    const borne = offerts.decalages.find((un) => un.de === rang) ?? null;
    return {
      brut,
      face: lu.face,
      zone: minuscule(element(victime.zones, lu.zone)?.nom ?? "?"),
      decaler:
        borne === null
          ? null
          : {
              valeur: decalage?.valeur ?? null,
              raison: decalage?.raison ?? null,
              min: borne.min,
              max: borne.max,
              raisonParDefaut: raisonDepuis(capaciteDe(etat, geste.acteur, geste.capacite)?.nom),
              gabarit: { evenement: { type: "decaler", de: rang } },
              mj: true,
            },
    };
  });
}

// Le détail des dégâts, avant « Appliquer » : ce que chaque coup changerait
// à la victime, esquive comprise. Les coups frappent une copie : rien n'est
// appliqué.
function detailVu(etat, geste) {
  const victime = photoDe(etat, victimeDe(geste));
  const courant = courantDe(etat, victimeDe(geste));
  if (victime === null || courant === null) return null;
  const change = ([avant, apres], mot) => (avant === apres ? null : `${mot} ${avant} ${SIGNES.fleche} ${apres}`);
  return frapper(courant, coupsDuGeste(etat, geste)).coups.map((coup) => {
    const parties = [change(coup.armure, "armure"), change(coup.resistance, "endurance"), change(coup.corps, "corps")].filter(present);
    return { zone: element(victime.zones, coup.zone)?.nom ?? "?", texte: parties.length > 0 ? parties.join(", ") : "aucun dégât" };
  });
}

// « Jet d'attaque » : le bouton qui prête à une capacité sans jet celui d'une
// arme. Il dit quelle arme : celle qui est prêtée ; sinon celle qui le serait.
// Ses hachures sont la portée de cette arme, de 0 à sa portée ; aucune sans
// arme.
function jetPreteVu(etat, geste, offerts, hachures) {
  if (!Object.hasOwn(offerts.reglages, "jet_prete")) return null;
  const photo = photoDe(etat, geste.acteur);
  const presse = geste.mode === "jet_prete";
  const rang = presse ? geste.armePretee : campDe(etat, geste.acteur) === "pj" ? photo.armePretee : photo.armes.length > 0 ? 0 : null;
  const arme = element(photo.armes, rang);
  return {
    presse,
    actif: true,
    raison: null,
    commande: regler("jet_prete", !presse),
    arme: arme?.libelle ?? "sans arme",
    hachures: arme === null ? [] : hachures(courantDe(etat, geste.acteur)?.case ?? null, 0, arme.portee ?? 0),
  };
}

function caracteristiquesVues(etat, geste, offerts) {
  if (!Object.hasOwn(offerts.reglages, "caracteristiques")) return null;
  const valeurs = photoDe(etat, geste.acteur)?.caracteristiques ?? {};
  const choisies = [...(geste.caracteristiques ?? [])];
  const de = choisies.length === 0 ? null : deDuJet(valeurs[choisies[0]], valeurs[choisies[choisies.length - 1]]);
  return {
    choisies,
    de: de?.de ?? null,
    gabarit: gabaritDe("caracteristiques"),
    options: CARACTERISTIQUES.filter(({ code }) => offerts.reglages.caracteristiques.options.includes(code)).map(({ code, nom }) => ({ code, nom, valeur: valeurs[code] ?? null })),
  };
}

// La cible d'une contre-attaque est l'attaquant, posée à l'empilement : elle
// ne se règle pas (contrat de la vague 1, § 4.2).
const CIBLE_POSEE = "La cible de ce geste est déjà posée.";

// Les cibles d'une façon Centrée (contrat de la vague 1, § 4.4) : les vivants
// de la case de son auteur, chacun actif ou non avec sa raison, ceux qu'elle
// coche d'office enfoncés tant que rien n'est réglé. Un appui coche ou
// décoche ; la dernière cochée ne se décoche pas, une liste vide n'étant pas
// un réglage.
function ciblesCochees(etat, reglage) {
  const cochees = reglage.valeur ?? reglage.dOffice;
  return reglage.vivants.map(({ id, actif, raison }) => {
    const choisie = cochees.includes(id);
    const apres = choisie ? cochees.filter((autre) => autre !== id) : [...cochees, id];
    return { id, libelle: nomEntier(etat, id), choisie, actif, raison, commande: apres.length === 0 ? null : regler("cibles", apres) };
  });
}

// Les cibles du geste. Tant qu'il se règle : celles qu'il pourrait viser,
// possibles ou non, chacune avec sa raison (une façon Centrée : celles
// qu'elle coche). Une fois payé, ou quand sa cible est posée d'avance : la
// seule cible, enfoncée et inactive. La rangée « Cible : » reste ainsi montrée
// pendant le jet, comme sur la maquette, sans rien offrir : le moteur
// refuserait d'en changer.
function ciblesVues(etat, geste, offerts) {
  const enPreparation = geste.moment === "preparation";
  if (enPreparation && Object.hasOwn(offerts.reglages, "cibles")) return ciblesCochees(etat, offerts.reglages.cibles);
  if (enPreparation && Object.hasOwn(offerts.reglages, "cible")) {
    return cibles(etat).map(({ id, possible, raison }) => ({ id, libelle: nomEntier(etat, id), choisie: geste.cible === id, actif: possible, raison, commande: regler("cible", id) }));
  }
  if (!present(geste.cible)) return [];
  return [{ id: geste.cible, libelle: nomEntier(etat, geste.cible), choisie: true, actif: false, raison: enPreparation ? CIBLE_POSEE : ACTION_EN_COURS, commande: regler("cible", geste.cible) }];
}

const LIBELLES_DE_CHOIX = {
  relancer: (jet) => `Relancer le ${RANGS[jet.places.length - 1]}`,
  garder: () => "Garder ce dé",
  exploser: () => "Faire exploser",
};

// Les choix du moment : ceux de la chaîne ; garder ou tenter le coup
// critique (mission du lot, § 4.4 : « Garder C = 8 », pour un jet sans
// lettre « Garder 3 réussites », puis « Tenter le critique ») ; laisser passer
// la contre-attaque (§ 4.3). Les lignes de la contre-attaque viendront avec
// les vues de son étape (vague 3) : « Laisser passer » suffit à continuer.
function choixVus(etat, geste, offerts) {
  const choix = offerts.choix.map((cle) => ({ cle, libelle: LIBELLES_DE_CHOIX[cle](geste.jet), commande: { evenement: { type: cle } } }));
  if (offerts.types.includes("critique")) {
    const { lettre, deBase } = degatsFixes(etat, geste);
    const garder = lettre === null ? `Garder ${compter(REUSSITES_MAX, "réussite")}` : `Garder ${LETTRES[lettre]} = ${deBase}`;
    choix.push({ cle: "critique_garde", libelle: garder, commande: { evenement: { type: "critique", tenter: false } } });
    choix.push({ cle: "critique_tente", libelle: "Tenter le critique", commande: { evenement: { type: "critique", tenter: true } } });
  }
  if (offerts.types.includes("laisser")) choix.push({ cle: "laisser", libelle: "Laisser passer", commande: { evenement: { type: "laisser" } } });
  return choix;
}

// La capacité qu'attendre garde (contrat de la vague 1, § 6.2) : un bouton
// par ligne de qui attend, sauf celles d'attendre ; on en choisit une.
function gardesVues(etat, geste, offerts) {
  const reglage = offerts.reglages.garde ?? null;
  if (reglage === null) return null;
  const garde = geste.garde ?? null;
  return reglage.options.map(({ capacite, facon }) => {
    const laCapacite = capaciteDe(etat, geste.acteur, capacite);
    return {
      libelle: libelleDe(laCapacite, element(laCapacite.facons, facon)),
      choisie: garde?.capacite === capacite && garde?.facon === facon,
      commande: regler("garde", { capacite, facon }),
    };
  });
}

const SANS_BLOC_DE_BLESSURE = "La banque n'a pas de bloc de blessure.";
const UNE_AUTRE = `Une autre${String.fromCodePoint(0x2026)}`;

// L'étape « La blessure » (mission du lot, § 4.10) : la zone blessée de la
// victime ; les capacités du bloc de blessure, figées, que l'écran apporte de
// la banque (photographie.js, etatsDeLaBanque), chacune active ou non avec sa
// raison (effets.js, refusDeLaBlessure) ; puis « Une autre… », un état libre
// nommé à la main (BORNES_EFFET.libre signes au plus). Le geste ne finit
// qu'avec ce choix, une zone après l'autre. Ce que le coup a fait viendra
// avec les vues de l'étape (vague 3).
function blessureVue(etat, geste, offerts, capacites) {
  if (offerts.blessure === null) return null;
  const victime = victimeDe(geste);
  const zone = element(photoDe(etat, victime)?.zones, offerts.blessure.zone)?.nom ?? "?";
  return {
    titre: `Blessure : ${court(etat, victime)}, ${minuscule(zone)}`,
    detail: detailDeLaBlessure(etat, geste, offerts.blessure.zone),
    options: capacites.map((capacite, rang) => {
      const raison = refusDeLaBlessure(etat, capacite);
      return {
        cle: `blessure:${rang}`,
        libelle: capacite.nom,
        description: faconDuPassif(capacite)?.description ?? "",
        actif: raison === null,
        raison,
        commande: { evenement: { type: "blessure", capacite } },
      };
    }),
    vide: capacites.length === 0 ? SANS_BLOC_DE_BLESSURE : null,
    libre: { libelle: UNE_AUTRE, max: BORNES_EFFET.libre, gabarit: { evenement: { type: "blessure" } } },
  };
}

// Ce que le coup a fait à la zone blessée (mission du lot 4.3, § 4.10) : « C =
// 10 : armure 2 → 0, endurance 5 → 0, corps 10 → 7. », le premier coup qui
// l'a blessée, dans l'ordre des dés. Le nombre est celui que le coup a porté
// (toute opération et l'esquive comprises), pour que les pertes qui suivent
// s'y additionnent ; il suit sa lettre, ou « dégâts » sans lettre. null si
// aucun coup ne l'a blessée.
function detailDeLaBlessure(etat, geste, zone) {
  const coups = geste.resultat?.coups ?? [];
  const rang = coups.findIndex((coup) => coup.blessure === true && coup.zone === zone);
  if (rang < 0) return null;
  const coup = coups[rang];
  const changements = [
    ["armure", coup.armure],
    ["endurance", coup.resistance],
    ["corps", coup.corps],
  ]
    .filter(([, paire]) => Array.isArray(paire) && paire[0] !== paire[1])
    .map(([nom, [avant, apres]]) => `${nom} ${avant} ${SIGNES.fleche} ${apres}`);
  const fixes = degatsFixes(etat, geste);
  const porte = fixes.parCoup[rang] ?? fixes.valeur;
  const degats = fixes.lettre === null ? `${porte} dégâts` : `${LETTRES[fixes.lettre]} = ${porte}`;
  return `${degats} : ${changements.join(", ")}.`;
}

// ─── Le geste : les étapes neuves du lot 4.3 ────────────────────────────────

// Les d20 lancés : { zone, face } chacun, la zone écrite en minuscule
// (« jambe droite »), une face de contre-attaque « contre-attaque » sur son
// dé brut.
function zonesDesD20(etat, geste) {
  const victime = photoDe(etat, victimeDe(geste));
  return localisationsDuGeste(etat, geste).map((lu, rang) => {
    if (lu.contre) return { zone: "contre-attaque", face: geste.localisation[rang]?.brut ?? "?" };
    return { zone: minuscule(element(victime?.zones, lu.zone)?.nom ?? "?"), face: lu.face };
  });
}

// « jambe droite (d20 → 15) ».
const zoneEtFace = ({ zone, face }) => `${zone} (d20 ${SIGNES.fleche} ${face})`;

// Les phrases de D9 (mission du lot 4.3, § 4.3) : la contre-attaque que la
// cible précédente n'a pas pu jouer, dite au-dessus de la cible suivante tant
// que son jet n'a aucun dé. Le geste fini, la région d'annonce et le journal
// la disent seuls.
function avisDe(etat, geste) {
  const faites = Array.isArray(geste.faites) ? geste.faites : [];
  if (faites.length === 0 || (geste.jet?.places?.length ?? 0) > 0) return null;
  const precedente = faites[faites.length - 1];
  const contre = precedente.contre ?? null;
  if (contre === null || contre.statut !== "impossible") return null;
  const jete = court(etat, precedente.cible);
  if (contre.raison === "action") return `${jete} n'a plus d'action : pas de contre-attaque.`;
  if (contre.raison === "portee") {
    return `${court(etat, geste.acteur)} est à ${compter(contre.distance ?? 0, "case")}, au-delà de la portée ${contre.portee ?? 0} ${deNom(contre.arme ?? "?")} : pas de contre-attaque.`;
  }
  return `${jete} n'a aucune arme : pas de contre-attaque.`;
}

// Le détail de chaque cible, dans l'ordre des cibles : sa case, puis ce que
// son jet opposera (« défense 5 », ou, quand le PJ visé lance sa défense,
// « lance sa défense ») et son corps ; hors de portée, la distance.
function ciblesDetailDe(etat, geste, offerts, cibles) {
  const depart = courantDe(etat, geste.acteur)?.case ?? null;
  const facon = faconDe(etat, geste);
  const attaque = MODES_D_ATTAQUE.includes(geste.mode);
  const portee = porteeDuGeste(etat, geste, facon);
  // La portée ne se juge pas pour une façon Centrée (mission du lot 4.3, § 4.9).
  const centree = (geste.cibles ?? null) !== null || Object.hasOwn(offerts.reglages, "cibles");
  const camp = campDe(etat, geste.acteur);
  return cibles.map(({ id }) => {
    const courant = courantDe(etat, id);
    const lieu = courant?.case ?? "?";
    const ecart = depart === null || courant === null ? 0 : distance(depart, courant.case);
    let detail;
    if (!vivant(etat, id)) detail = enLigne(lieu, "mort");
    else if (attaque && !centree && geste.moment === "preparation" && ecart > portee) detail = enLigne(lieu, `hors de portée : à ${compter(ecart, "case")}`);
    else {
      // Le jet n'oppose rien à un allié de l'auteur, ni à l'auteur (une façon Centrée les montre, inactifs).
      const adverse = attaque && campDe(etat, id) !== camp;
      const oppose = !adverse ? null : campDe(etat, id) === "pj" ? "lance sa défense" : `défense ${defenseDe(etat, id).valeur}`;
      detail = [lieu, oppose, `corps ${courant.corps}/${courant.corpsMax}`].filter(present).join(` ${SIGNES.point} `);
    }
    return { id, initiales: etat.noms?.[id]?.initiales ?? "?", detail };
  });
}

// Les cibles d'une façon Centrée, cochées ou figées : celles qu'elle coche
// encore (en préparation), ou celles que le moteur a figées.
function ciblesDeLaCase(etat, geste, offerts) {
  if (geste.moment === "preparation") {
    const reglage = offerts.reglages.cibles ?? null;
    return reglage === null ? null : (reglage.valeur ?? reglage.dOffice);
  }
  return Array.isArray(geste.cibles) ? geste.cibles : null;
}

// « Un jet par cible : 2 cibles », une façon Centrée en préparation, deux
// cibles cochées ou plus.
function jetsParCibleDe(etat, geste, offerts) {
  if (geste.moment !== "preparation") return null;
  const cochees = ciblesDeLaCase(etat, geste, offerts);
  return cochees === null || cochees.length < 2 ? null : { libelle: `Un jet par cible : ${compter(cochees.length, "cible")}` };
}

// L'ordre des jets d'un geste à plusieurs cibles (mission du lot 4.3, § 4.9) :
// « 1 · Marmiton n° 2 », chacune faite, en cours ou à venir, avec ce qu'elle a
// donné ou ce qu'elle attend. null pour une seule cible.
function progressionDe(etat, geste, offerts, jet) {
  const liste = ciblesDeLaCase(etat, geste, offerts);
  if (liste === null || liste.length < 2) return null;
  const enPreparation = geste.moment === "preparation";
  const faites = Array.isArray(geste.faites) ? geste.faites : [];
  return liste.map((id, rang) => {
    const libelle = `${rang + 1} ${SIGNES.point} ${court(etat, id)}`;
    if (enPreparation || rang > (geste.rang ?? 0)) return { libelle, etat: "a_venir", detail: null };
    if (rang === (geste.rang ?? 0)) {
      const quoi = jet === null ? null : jet.genre === "defense" ? `jet de défense, attaque ${jet.difficulte}` : `jet d'attaque, défense ${jet.difficulte}`;
      return { libelle, etat: "en_cours", detail: quoi === null ? null : `en cours : ${quoi}` };
    }
    const faite = faites.find((une) => une.rang === rang) ?? null;
    if (faite === null || (faite.jet ?? null) === null) return { libelle, etat: "faite", detail: null };
    const lu = { ...geste, ...faite };
    const zones = zonesDesD20(etat, lu).map(({ zone }) => zone);
    return { libelle, etat: "faite", detail: [`fait : ${ecrireBilan(etat, lu)}`, ...zones].join(", ") };
  });
}

// Le rang, dans la chaîne, du dernier dé lancé, tant qu'il est posé (ni une
// relance ni une explosion n'attendent leur dé) : celui qu'inverser ou
// relancer toucherait. null sinon.
const ATTENTES_DU_DE_POSE = ["de", "choix_relance", "choix_explosion", "fini"];

function dernierDeDe(jet) {
  if (jet === null || jet.places.length === 0 || !ATTENTES_DU_DE_POSE.includes(jet.attente)) return null;
  return somme(jet.places.map((place) => place.essais.length)) - 1;
}

// Le lanceur du jet du geste : celui du jet figé, ou de celui qui se
// figerait ; avant la cible, l'acteur s'il est un PJ (un adversaire ne lance
// jamais de dés). null pour un geste sans jet.
function lanceurDe(etat, geste, jet) {
  if (!MODES_A_JET.includes(geste.mode)) return null;
  if (jet !== null) return jet.lanceur;
  return campDe(etat, geste.acteur) === "pj" ? geste.acteur : null;
}

// Pourquoi un passif non câblé ne s'applique pas (« Ce passif a déjà servi
// pour ce jet. », ou la raison de son prix), lu par effets.js sur un effet
// qui a toujours prise : ±N sur son porteur, de durée « jet » avant le
// paiement, « tour » après. Seul le refus « interdit » est la raison du
// bouton ; le moment et les bornes de chaque genre se lisent dans la palette.
function raisonDuPassif(etat, geste, source) {
  const duree = geste.moment === "preparation" ? "jet" : "tour";
  const verdict = jugerEffet(etat, { type: "effet", genre: "attaque", source, sur: source.qui, n: 1, duree });
  return verdict.ok || verdict.code !== "interdit" ? null : verdict.message;
}

// Les boutons des passifs non câblés du lanceur (mission du lot 4.3, § 4.5) :
// « Nez fin · 1 souffle », « Maîtrise de l'agile · gratuit », dès
// l'ouverture du geste ; un appui ouvre la palette à leur nom.
function passifsDuJet(etat, geste, jet) {
  const qui = lanceurDe(etat, geste, jet);
  if (qui === null) return [];
  const photo = photoDe(etat, qui);
  const boutonsVus = [];
  (photo?.capacites ?? []).forEach((capacite, indice) => {
    const source = { genre: "capacite", qui, capacite: indice };
    const passif = passifDe(etat, source);
    if (passif === null) return;
    const facon = passif.capacite.facons[passif.facon];
    const raison = raisonDuPassif(etat, geste, source);
    boutonsVus.push({
      cle: `passif:${qui}:${indice}`,
      qui,
      libelle: enLigne(capacite.nom, coutDeLaLigne(facon) ?? "coût illisible"),
      texte: facon.description ?? "",
      actif: raison === null,
      raison,
      source,
    });
  });
  return boutonsVus;
}

// « Appliquer l'effet de Frappe… » (mission du lot 4.3, § 5) : la capacité
// jouée sans rôle câblé, dès que sa cible est posée (ou sans cible), jusqu'à
// la fin du geste.
function appliquerEffetDe(capacite, facon, geste) {
  if (capacite.role !== null) return null;
  if (MODES_D_ATTAQUE.includes(geste.mode) && !present(geste.cible)) return null;
  return { libelle: appliquerLEffetDe(capacite.nom), texte: facon.description ?? "", source: { genre: "capacite", qui: geste.acteur, capacite: geste.capacite } };
}

// L'étape « Interventions » (mission du lot 4.3, § 4.1 ; contrat de la vague
// 3, § 3.2) : null hors de l'étape et quand personne ne peut intervenir (ni
// intervenant, ni esquive) ; sinon sa tête, ses intervenants, et « Passer »,
// qui émet « Appliquer ».
function interventionsDe(etat, geste, offerts) {
  const offertes = geste.moment === "suites" ? (offerts.interventions ?? null) : null;
  if (offertes === null || (offertes.intervenants.length === 0 && offertes.esquive === null)) return null;
  const touche = lettreDuGeste(etat, geste) !== null;
  let tete = "Le coup manque. Avant de finir, qui intervient ?";
  if (touche) {
    const fixes = degatsFixes(etat, geste);
    const lettre = fixes.lettre === null ? [] : [`${LETTRES[fixes.lettre]} = ${fixes.deBase}`];
    tete = `Le coup porte : ${[...lettre, ...zonesDesD20(etat, geste).map(zoneEtFace)].join(", ")}. Avant les dégâts, qui intervient ?`;
  }
  const sous = (qui) => {
    const courant = courantDe(etat, qui);
    return [compter(courant.actions, "action"), souffleDit(courant, photoDe(etat, qui)), qui === geste.cible ? "la cible" : null].filter(present).join(` ${SIGNES.point} `);
  };
  return {
    tete,
    intervenants: offertes.intervenants.map((un) => intervenantVu(etat, un, sous)),
    passer: touche ? "Passer : appliquer les dégâts" : "Passer : terminer",
  };
}

// « Aucune intervention possible. » : aux suites d'une attaque dont l'étape
// n'offre rien (mission du lot 4.3, § 4.1, choix 3 de l'auteur).
const AUCUNE_INTERVENTION = "Aucune intervention possible.";

function aucuneInterventionDe(geste, offerts) {
  const offertes = geste.moment === "suites" ? (offerts.interventions ?? null) : null;
  return offertes !== null && offertes.intervenants.length === 0 && offertes.esquive === null ? AUCUNE_INTERVENTION : null;
}

// Le titre du groupe d'une arme : « Couteau d'office (précise) ».
const titreDeLArme = (arme) => (arme === null ? "" : POIDS[arme.poids] ? `${arme.libelle} (${POIDS[arme.poids]})` : arme.libelle);

// L'étape « Contre-attaque » (mission du lot 4.3, § 4.3) : son titre (la face
// du d20), sa phrase, et une ligne par façon d'attaque de l'arme du jeté (un
// adversaire : un groupe par arme), chacune jouable ou non avec sa raison.
// « Laisser passer » reste parmi les choix.
function contreDe(etat, geste, offerts, hachures) {
  if (geste.moment !== "contre_attaque" || offerts.contre === null) return null;
  const defenseur = geste.cible;
  const photo = photoDe(etat, defenseur);
  const courant = courantDe(etat, defenseur);
  const groupes = [];
  for (const { capacite, facon, actif, raison } of offerts.contre.options) {
    const laCapacite = photo.capacites[capacite];
    const laFacon = laCapacite.facons[facon];
    const arme = element(photo.armes, laFacon.arme);
    const titre = titreDeLArme(arme);
    let groupe = groupes.find((un) => un.rang === laFacon.arme) ?? null;
    if (groupe === null) {
      groupe = { rang: laFacon.arme, titre, lignes: [] };
      groupes.push(groupe);
    }
    const libelle = libelleDe(laCapacite, laFacon);
    groupe.lignes.push({
      cle: `contre:${capacite}:${facon}`,
      libelle,
      degats: ecrireDegats(laFacon.degats),
      desavantage: laFacon.desavantage === true,
      intervention: laFacon.intervention === true,
      cout: coutDeLaLigne(laFacon),
      choisi: false,
      actif,
      raison,
      commande: { evenement: { type: "contre_attaquer", capacite, facon } },
      jouer: `Jouer ${libelle}`,
      survol: survolDeLaLigne(etat, defenseur, capacite, facon, hachures),
    });
  }
  const premiere = offerts.contre.options.find((option) => option.actif) ?? offerts.contre.options[0] ?? null;
  const arme = premiere === null ? null : element(photo.armes, photo.capacites[premiere.capacite].facons[premiere.facon].arme);
  const face = geste.localisation[geste.localisation.length - 1]?.brut ?? "?";
  const portee = arme === null ? "" : `, à la portée ${arme.portee ?? 0} ${deNom(arme.libelle)}`;
  return {
    titre: `${face} : contre-attaque !`,
    texte: `L'attaque est annulée. ${court(etat, defenseur)} peut contre-attaquer ${court(etat, geste.acteur)}${portee}. Une action ; il en reste ${courant.actions}.`,
    groupes: groupes.map(({ titre, lignes }) => ({ titre, lignes })),
  };
}

// Le coup critique double les dégâts de la lettre (mission du lot 4.3, § 4.4 ;
// js/combat/degats.js, qui les double).
const DOUBLE_DU_CRITIQUE = 2;

// Le moment du coup critique (mission du lot 4.3, § 4.4) : « Trois réussites,
// et 1 avantage non dépensé. », ce que ferait un 4e dé réussi, et le rang
// « critique : 16 » sous les rangs quand il double des dégâts.
function critiqueDe(etat, geste, offerts) {
  if (geste.moment !== "critique" || !offerts.types.includes("critique")) return null;
  const restants = relancesRestantes(geste.jet);
  const { lettre, deBase } = degatsFixes(etat, geste);
  const double = deBase * DOUBLE_DU_CRITIQUE;
  return {
    texte: `Trois réussites, et ${compter(restants, "avantage")} non dépensé${restants > 1 ? "s" : ""}.`,
    detail: lettre === null ? "Un 4e dé réussi fait un coup critique." : `Un 4e dé réussi double les dégâts : ${LETTRES[lettre]} = ${deBase} ${SIGNES.fleche} ${double}.`,
    rang: lettre === null ? null : `critique : ${double}`,
  };
}

// Le geste en cours, tel que la bulle le montre : ce qui se règle, le
// contexte du jet, la chaîne, le bilan, puis les choix du moment.
// « blessures » : les capacités du bloc de blessure (vuePanneau).
function gesteVu(etat, geste, offerts, hachures, blessures) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  if (capacite === null || facon === null) return null;
  const photo = photoDe(etat, geste.acteur);
  const enPreparation = geste.moment === "preparation";
  // Une façon Centrée porte déjà sa première cible cochée (moteur.js,
  // viserLaCase) : son jet se lit comme celui d'une cible réglée.
  const jet = jetDe(etat, geste);
  const aJet = MODES_A_JET.includes(geste.mode);
  const reglables = offerts.reglages;
  const offert = (champ) => Object.hasOwn(reglables, champ);
  const esquive = esquiveOfferte(etat);
  // Un jet ne clôt jamais le geste (contrat de la vague 1, § 12, choix 1) :
  // un manqué et un jet de caractéristique attendent « Terminer », sans dégâts.
  const terminer = lettreDuGeste(etat, geste) === null;
  const cibles = ciblesVues(etat, geste, offerts);
  const bilan = bilanVu(etat, geste, jet, offerts);
  const garde = geste.mode === "attendre" && present(geste.garde) ? capaciteDe(etat, geste.acteur, geste.garde.capacite) : null;

  return {
    description: facon.description,
    jetPrete: jetPreteVu(etat, geste, offerts, hachures),
    armes: offert("arme_pretee") ? reglables.arme_pretee.options.map((rang) => ({ libelle: photo.armes[rang].libelle, choisie: geste.armePretee === rang, commande: regler("arme_pretee", rang) })) : null,
    cibles,
    sansCible: offert("cible") && reglables.cible.options.includes(null) ? { choisie: geste.cible === null, commande: regler("cible", null) } : null,
    cases: offert("arrivee") ? reglables.arrivee.options.map((nom) => ({ case: nom, nom: nomDArrivee(nom), choisie: geste.arrivee === nom, commande: commandeDArrivee(etat, geste, nom) })) : null,
    caracteristiques: caracteristiquesVues(etat, geste, offerts),
    difficultes: offert("difficulte")
      ? Object.keys(DIFFICULTES)
          .map(Number)
          .filter((valeur) => valeur >= reglables.difficulte.min && valeur <= reglables.difficulte.max)
          .map((valeur) => ({ valeur, libelle: DIFFICULTES[valeur], choisie: geste.difficulte === valeur, commande: regler("difficulte", valeur) }))
      : null,
    x: offert("x") ? { valeur: reglables.x.valeur, min: reglables.x.min, max: reglables.x.max, gabarit: gabaritDe("x") } : null,
    jauges: offert("jauge") ? reglables.jauge.options.map((rang) => ({ nom: photo.liens[rang].nom, choisie: reglables.jauge.valeur === rang, commande: regler("jauge", rang) })) : null,
    gardes: gardesVues(etat, geste, offerts),
    contexte: aJet ? contexteVu(etat, geste, capacite, jet, offerts) : null,
    chaine: jet === null ? [] : chaineVue(jet),
    aLancer: offerts.de === null ? null : { faces: offerts.de.faces, combien: offerts.de.combien, libelle: `d${offerts.de.faces}`, motif: offerts.de.motif },
    bilan,
    lettres: lettresVues(etat, geste, facon, jet),
    choix: choixVus(etat, geste, offerts),
    degats: degatsVus(etat, geste, capacite, facon, offerts),
    localisation: localisationVue(etat, geste, offerts),
    esquive:
      esquive === null
        ? null
        : {
            libelle: capaciteDe(etat, victimeDe(geste), esquive.capacite)?.nom ?? "",
            qui: victimeDe(geste),
            cout: `${compter(prixDeLEsquive(1).actions, "action")} + X souffle`,
            texte: "annule X dégâts, X souffle",
            min: esquive.min,
            max: esquive.max,
            gabarit: { evenement: { type: "esquive" } },
            actif: true,
            raison: null,
          },
    detail: geste.moment === "suites" ? detailVu(etat, geste) : null,
    blessure: blessureVue(etat, geste, offerts, blessures),
    appliquer: offerts.types.includes("appliquer") ? { libelle: terminer ? "Terminer" : "Appliquer", commande: { evenement: { type: "appliquer" } } } : null,
    // Attendre se confirme par « Garder Frappe » (contrat de la vague 3, § 3.2).
    confirmer:
      enPreparation && !aJet
        ? {
            libelle: geste.mode !== "attendre" ? "Confirmer" : garde === null ? "Garder" : `Garder ${libelleDe(garde, element(garde.facons, geste.garde.facon))}`,
            actif: offerts.pret.ok,
            raison: offerts.pret.ok ? null : offerts.pret.manque,
            commande: { evenement: { type: "confirmer" } },
          }
        : null,
    revenir: enPreparation ? { commande: { evenement: { type: "revenir" } } } : null,
    // La vague 3 du lot 4.3 (contrat de la vague, § 3.2).
    bilanAuDoigt: bilan === null ? null : bilanVu(etat, geste, jet, offerts, VERBES.doigt),
    avis: avisDe(etat, geste),
    ciblesDetail: ciblesDetailDe(etat, geste, offerts, cibles),
    jetsParCible: jetsParCibleDe(etat, geste, offerts),
    progression: progressionDe(etat, geste, offerts, jet),
    dernierDe: dernierDeDe(jet),
    passifs: passifsDuJet(etat, geste, jet),
    appliquerEffet: appliquerEffetDe(capacite, facon, geste),
    palette: { libelle: "Palette", source: { genre: "capacite", qui: geste.acteur, capacite: geste.capacite }, mj: true },
    interventions: interventionsDe(etat, geste, offerts),
    aucuneIntervention: aucuneInterventionDe(geste, offerts),
    contre: contreDe(etat, geste, offerts, hachures),
    critique: critiqueDe(etat, geste, offerts),
  };
}

// La commande qui attend, pendant un geste : c'est là que l'écran pose le
// focus. null : le titre de la bulle.
function focusDe(geste, vu, offerts) {
  if (vu === null) return null;
  if (vu.aLancer !== null) return "de";
  if (vu.choix.length > 0) return `choix:${vu.choix[0].cle}`;
  if (vu.appliquer !== null) return "appliquer";
  if (vu.blessure !== null) return vu.blessure.options.find((option) => option.actif)?.cle ?? "blessure:libre";
  if (geste.moment !== "preparation") return null;
  if (offerts.pret.ok) return vu.confirmer !== null ? "confirmer" : null;
  if (vu.cases !== null && !vu.cases.some((une) => une.choisie)) return vu.cases.length > 0 ? `case:${vu.cases[0].case}` : null;
  if (vu.gardes !== null && !vu.gardes.some((une) => une.choisie)) return vu.gardes.length > 0 ? "garde:0" : null;
  const possible = vu.cibles.find((cible) => cible.actif) ?? null;
  if (["attaque", "jet_prete"].includes(geste.mode) && !vu.cibles.some((cible) => cible.choisie && cible.actif)) return possible === null ? null : `cible:${possible.id}`;
  if (vu.caracteristiques !== null && vu.caracteristiques.choisies.length === 0) return `caracteristique:${vu.caracteristiques.options[0]?.code ?? ""}`;
  if (vu.difficultes !== null && !vu.difficultes.some((une) => une.choisie)) return `difficulte:${vu.difficultes[0]?.valeur ?? ""}`;
  return null;
}

// Sans geste : la première ligne active ; à défaut « Passer son tour » s'il
// se peut ; sinon le titre.
function focusDeLaListe(groupes, passer) {
  const premiere = groupes.flatMap((groupe) => groupe.lignes).find((ligne) => ligne.actif) ?? null;
  if (premiere !== null) return `ligne:${premiere.cle}`;
  return passer.actif ? "passer" : null;
}

// L'en-tête de la bulle. Sans geste : le nom entier, puis « actions
// restantes : 1 sur 2 · souffle 6/10 ». Avec un geste : son libellé, suivi de
// sa cible dès qu'elle est choisie (« Taloche [1] contre Marmiton de corvée
// n° 2 » ; un déplacement et un jet de caractéristique, le libellé seul),
// puis « Aubépine · dernière action · souffle 6/10 » : l'action que coûte le
// geste, comptée avant le paiement, et le souffle courant.
function enteteDe(etat, acteur, geste) {
  const courant = courantDe(etat, acteur);
  const photo = photoDe(etat, acteur);
  const capacite = geste === null ? null : capaciteDe(etat, acteur, geste.capacite);
  const facon = geste === null ? null : faconDe(etat, geste);
  if (capacite === null || facon === null) return { titre: nomEntier(etat, acteur), sous: enLigne(actionsRestantes(courant), souffleDit(courant, photo)) };
  const libelle = libelleDe(capacite, facon);
  // Un déplacement et un jet de caractéristique n'ont jamais de cible.
  const seul = !present(geste.cible);
  const avant = courant.actions + (geste.paye === true ? (geste.prix?.actions ?? 0) : 0);
  const action = avant === 1 ? "dernière action" : `action ${courant.actionsMax - avant + 1} sur ${courant.actionsMax}`;
  return {
    titre: seul ? libelle : `${libelle} ${lienALaCible(etat, geste)} ${nomEntier(etat, geste.cible)}`,
    sous: enLigne(court(etat, acteur), action, souffleDit(courant, photo)),
  };
}

// Qui se défend : quand un adversaire attaque un PJ, « Aubépine lance sa
// défense · souffle 6/10 » ; null sinon.
function defenseurDe(etat, geste) {
  if (geste === null || campDe(etat, geste.acteur) !== "adv" || !MODES_D_ATTAQUE.includes(geste.mode) || campDe(etat, geste.cible) !== "pj") return null;
  return enLigne(`${court(etat, geste.cible)} lance sa défense`, souffleDit(courantDe(etat, geste.cible), photoDe(etat, geste.cible)));
}

// Ce qui ferme la bulle : « Fermer » tant que rien n'est payé (rien n'est
// dépensé, l'écran revient d'abord sur le geste) ; « Réduire » après le
// premier dé, en un onglet qui la rouvre.
function fermetureDe(etat, geste) {
  if (!engage(etat, geste)) return { genre: "fermer", libelle: "Fermer", commande: { choisir: null } };
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const libelle = capacite === null ? "" : libelleDe(capacite, faconDe(etat, geste));
  return { genre: "reduire", libelle: "Réduire", onglet: `${libelle} : rouvrir` };
}

const PANNEAU_VIDE = {
  candidats: [],
  nom: null,
  entete: null,
  defenseur: null,
  fermeture: null,
  etapes: [],
  groupes: [],
  passer: null,
  passifs: [],
  geste: null,
  vainqueur: null,
  focus: null,
  camp: null,
  etape: null,
  fil: [],
  consigne: null,
};

/**
 * La bulle d'action (contrat du groupe 2, § 8.1). « genre » dit ce qu'elle
 * montre :
 * - « preparation » : rien, l'écran montre la préparation à sa place ;
 * - « qui_joue » : un bouton par protagoniste qui peut encore agir ;
 * - « action » : son nom (« Aubépine Crèmebrûlée : ses actions »), son
 *   en-tête, qui se défend, ce qui la ferme ou la réduit, les étapes, les
 *   lignes groupées par origine, « Passer son tour », les passifs, puis le
 *   geste en cours ;
 * - « termine » : la phrase de la victoire.
 * « annonce » est ce que dit la région d'annonce ; « focus », la commande qui
 * attend. Les cases hachurées d'un même départ, d'un même minimum et d'un
 * même maximum ne se calculent qu'une fois par vue.
 *
 * « apports » est ce que l'écran sait de la banque, que le combat ne garde
 * pas : « blessures », les capacités figées du bloc de blessure
 * (js/combat/photographie.js, etatsDeLaBanque), que l'étape « La blessure »
 * propose ; aucune par défaut.
 *
 * À la vague 3 du lot 4.3 (contrat de la vague, § 3.2) : « camp » (celui qui
 * joue), « etape » et « fil » (le volet du téléphone), « consigne » (la
 * question en tête du volet) ; le geste porte les étapes neuves.
 */
export function vuePanneau(etat, choisi, apports = {}) {
  const annonce = etat.annonce ?? null;
  if (etat.phase === "preparation") return { genre: "preparation", ...PANNEAU_VIDE, annonce };
  if (etat.phase !== "combat") return { genre: "termine", ...PANNEAU_VIDE, annonce, vainqueur: present(etat.vainqueur) ? ligneDeFin(etat.vainqueur) : null };

  const acteur = acteurCourant(etat, choisi);
  const courant = courantDe(etat, acteur);
  const photo = photoDe(etat, acteur);
  if (acteur === null || courant === null || photo === null) {
    const liste = candidats(etat).map((id) => ({ id, nom: nomEntier(etat, id), commande: { choisir: id } }));
    return { genre: "qui_joue", ...PANNEAU_VIDE, annonce, candidats: liste, focus: liste.length > 0 ? `candidat:${liste[0].id}` : null, camp: etat.tour?.camp ?? null };
  }

  const calculees = new Map();
  const hachures = (depart, min, max) => {
    const cle = `${depart}|${min}|${max}`;
    if (!calculees.has(cle)) calculees.set(cle, casesEntre(depart, min, max));
    return [...calculees.get(cle)];
  };

  const geste = gesteEnCours(etat);
  const offerts = offre(etat);
  const libre = offerts.types.includes("passer") && candidats(etat).includes(acteur);
  const vu = geste === null ? null : gesteVu(etat, geste, offerts, hachures, Array.isArray(apports?.blessures) ? apports.blessures : []);
  const groupes = grouper(lignesVues(etat, acteur, geste, hachures), courant.camp !== "pj");
  const passer = { actif: libre, raison: libre ? null : ACTION_EN_COURS, commande: { evenement: { type: "passer", qui: acteur } } };
  const etape = etapeDuVolet(etat, geste, offerts);
  return {
    genre: "action",
    candidats: [],
    nom: `${nomEntier(etat, acteur)} : ses actions`,
    entete: enteteDe(etat, acteur, geste),
    defenseur: defenseurDe(etat, geste),
    fermeture: fermetureDe(etat, geste),
    etapes: etapesVues(etat, acteur, geste, offerts, vu),
    groupes,
    passer,
    passifs: passifsVus(etat, acteur),
    geste: vu,
    annonce,
    vainqueur: null,
    focus: geste === null ? focusDeLaListe(groupes, passer) : focusDe(geste, vu, offerts),
    camp: etat.tour?.camp ?? null,
    etape,
    fil: filDe(etat, acteur, geste, etape),
    consigne: consigneDe(etat, acteur, geste, offerts),
  };
}

// ─── La préparation ─────────────────────────────────────────────────────────

const LIBELLES_DE_CAMP = { pj: "Les PJ", adv: "Les adversaires" };
const BANQUE_SANS_ADVERSAIRE = "Cette banque n'a aucun adversaire.";
// La raison d'une rencontre vide (complément, § 5.2), et le lien qu'elle
// porte vers l'écran Rencontre : ses trois morceaux redonnent la raison.
const LIEN_VERS_LA_RENCONTRE = { avant: "Composez d'abord une rencontre à l'", texte: "écran Rencontre", apres: ".", adresse: "#/rencontre" };
const RENCONTRE_VIDE = `${LIEN_VERS_LA_RENCONTRE.avant}${LIEN_VERS_LA_RENCONTRE.texte}${LIEN_VERS_LA_RENCONTRE.apres}`;

// De quoi demander à la préparation ce qu'elle refuserait, sans photographie :
// elle ne lit d'un ajout que le camp, l'identifiant et le nom. Ses phrases de
// refus (déjà présent, plafonds) ne s'écrivent ainsi qu'une fois, chez elle.
const sondeDePersonnage = (cle, nom) => ({ camp: "pj", valeurs: { identifiant: cle, nom } });
const sondeDAdversaire = (nom) => ({ camp: "adv", valeurs: { identifiant: null, nom } });

/**
 * La préparation, d'après la mise en place et ce que l'écran apporte de la
 * banque et de l'appareil (« apports ») :
 * - personnages : ceux qu'on peut ajouter, chacun actif ou non avec sa raison
 *   (il ne s'ajoute pas, il est déjà dans le combat, le plafond est atteint) ;
 *   « attente » tant que leur lecture est en cours ;
 * - adversaires : de même, avec « max », les exemplaires encore possibles ;
 *   « vide », la phrase d'une banque sans adversaire ;
 * - rencontre : « Placer la rencontre préparée », inactif si elle est vide ou
 *   si elle dépasserait un plafond ; « lien », la raison d'une rencontre vide
 *   en trois morceaux, celui du milieu menant à l'écran Rencontre ;
 * - quiCommence, lancer, la ligne des câblés absents, et les avertissements
 *   des photographies posées.
 */
export function vuePreparation(miseEnPlace, apports) {
  const adversairesPresents = miseEnPlace.protagonistes.filter((protagoniste) => protagoniste.camp === "adv");
  const refusDe = (rendu) => rendu.refus ?? null;

  const personnages = (apports.personnages ?? []).map(({ cle, nom, refus }) => {
    const raison = refus ?? refusDe(ajouterPersonnage(miseEnPlace, sondeDePersonnage(cle, nom)));
    return { cle, nom, actif: raison === null, raison };
  });

  const adversaires = (apports.adversaires ?? []).map(({ nom, refus }) => {
    const exemplaires = adversairesPresents.filter((protagoniste) => protagoniste.photo.valeurs.nom === nom).length;
    const max = Math.max(0, Math.min(PLAFOND_ADVERSAIRES - adversairesPresents.length, PLAFOND_EXEMPLAIRES - exemplaires));
    const raison = refus ?? refusDe(ajouterAdversaires(miseEnPlace, [sondeDAdversaire(nom)]));
    return { nom, actif: raison === null, raison, max };
  });

  // Un adversaire de la rencontre qui ne s'ajoute pas est laissé : l'écran le
  // dit. Seuls ceux qui se poseraient comptent pour les plafonds.
  const posables = (apports.rencontre ?? []).filter(({ nom }) => (apports.adversaires ?? []).some((adversaire) => adversaire.nom === nom && !present(adversaire.refus)));
  const sondes = posables.flatMap(({ nom, nombre }) => Array.from({ length: Math.max(0, Math.min(nombre, PLAFOND_ADVERSAIRES + 1)) }, () => sondeDAdversaire(nom)));
  const vide = (apports.rencontre ?? []).length === 0;
  const raisonDeLaRencontre = vide ? RENCONTRE_VIDE : refusDe(ajouterAdversaires(miseEnPlace, sondes));

  const lancement = peutLancer(miseEnPlace);
  const avertissements = [];
  for (const { photo } of miseEnPlace.protagonistes) {
    for (const avertissement of photo.avertissements ?? []) {
      const texte = `${photo.valeurs.nom} ${SIGNES.tiret} ${avertissement}`;
      if (!avertissements.includes(texte)) avertissements.push(texte);
    }
  }

  return {
    personnages: { attente: !present(apports.personnages), phrases: [...(apports.phrases ?? [])], options: personnages },
    adversaires: { options: adversaires, vide: (apports.adversaires ?? []).length === 0 ? BANQUE_SANS_ADVERSAIRE : null },
    rencontre: { actif: raisonDeLaRencontre === null, raison: raisonDeLaRencontre, lien: vide ? { ...LIEN_VERS_LA_RENCONTRE } : null },
    quiCommence: ["pj", "adv"].map((camp) => ({ camp, libelle: LIBELLES_DE_CAMP[camp], choisi: miseEnPlace.quiCommence === camp, commande: { preparer: { type: "qui_commence", camp } } })),
    lancer: { actif: lancement.ok, raison: lancement.ok ? null : lancement.raison },
    absents: apports.absents ?? null,
    avertissements,
  };
}

// ─── Les vignettes et le dé en surimpression (vague 3 du lot 4.3) ───────────

// « en guet : Frappe » : les lignes que ses gardes gardent ; null sans garde.
function gardeDite(etat, id) {
  const gardees = gardesDe(etat, id).map((effet) => {
    const capacite = capaciteDe(etat, id, effet.garde?.capacite);
    return capacite === null ? "" : libelleDe(capacite, element(capacite.facons, effet.garde?.facon));
  });
  return gardees.length === 0 ? null : `en guet : ${gardees.join(", ")}`;
}

/**
 * Les vignettes du téléphone (mission du lot 4.3, § 3 ; contrat de la vague
 * 3, § 3.5) : null hors d'un combat en cours ; sinon { camp, vignettes: [{
 * id, initiales, nom, etiquette, actions: { reste, max, texte }, jeu,
 * choisie, garde, pastille, choix, inactif, raison, menuMj }] }, un vivant du
 * camp qui joue par vignette, dans l'ordre d'ajout ; « choix », « inactif »
 * et « raison » sont ceux de son jeton (vuePlateau), quels qu'ils soient.
 * « nom » est le nom court (« Aubépine ») ; « etiquette », son nom
 * accessible : le nom entier, ses actions restantes, sa garde.
 */
export function vueVignettes(etat, choisi) {
  if (etat.phase !== "combat" || etat.tour === null) return null;
  const { jetons } = vuePlateau(etat, choisi);
  const acteur = acteurCourant(etat, choisi);
  const lesCandidats = candidats(etat);
  const vignettes = vivantsDe(etat, etat.tour.camp).map((id) => {
    const courant = courantDe(etat, id);
    const jeton = jetons[id];
    const garde = gardeDite(etat, id);
    const actions = { reste: courant.actions, max: courant.actionsMax, texte: actionsRestantes(courant) };
    return {
      id,
      initiales: etat.noms?.[id]?.initiales ?? "?",
      nom: court(etat, id),
      etiquette: [nomEntier(etat, id), actions.texte, garde].filter(present).join(", "),
      actions,
      jeu: jeuDe(etat, id, lesCandidats),
      choisie: id === acteur,
      garde,
      pastille: jeton.pastille,
      choix: jeton.choix,
      inactif: jeton.inactif,
      raison: jeton.raison,
      menuMj: jeton.menuMj,
    };
  });
  return { camp: etat.tour.camp, vignettes };
}

// « d8+1 », « d10 », « d8−1 » : le dé et son modificateur, d'un trait.
function deEtModificateur(jet) {
  const modificateur = modificateurDe(jet);
  return `d${jet.faces}${modificateur === 0 ? "" : signer(modificateur)}`;
}

const DESAVANTAGE = " (désavantage)";

// Un d20 de localisation : sa zone sur la grille de la victime, ou la face de
// contre-attaque du jeté (degats.js, localisationsDuGeste).
function d20Vu(avant, geste, valeurs) {
  const brut = valeurs[0];
  const lu = localisationsDuGeste(avant, { ...geste, localisation: [...geste.localisation, { brut, decalage: null }] }).at(-1) ?? null;
  if (lu === null) return null;
  const titre = `Localisation ${SIGNES.point} d20`;
  if (lu.contre) return { titre, valeur: `${brut}`, verdict: "contre-attaque", genre: "localisation" };
  const zone = element(photoDe(avant, victimeDe(geste))?.zones, lu.zone)?.nom ?? "?";
  return { titre, valeur: `${brut}`, verdict: minuscule(zone), genre: "localisation" };
}

/**
 * Le dé en surimpression (mission du lot 4.3, § 3, A5 et B2 ; contrat de la
 * vague 3, § 3.5) : l'événement « de » que la séance vient de jouer, lu sur
 * l'état d'avant, sans le moteur : le jet d'avant reçoit ses valeurs par
 * jet.js (lancerDe), un d20 se lit sur la grille de la victime. null pour
 * tout autre événement, ou un dé que l'état d'avant n'attendait pas ; sinon
 * { titre: "1er dé · d8+1" (« relance · … », « explosion · … », « 4e dé ·
 * critique », « Localisation · d20 », « (désavantage) » sous désavantage),
 * valeur: "8" (le dé gardé, son modificateur et ses explosions compris),
 * verdict: "✓ réussite" | "✗ échec" | "✓ coup critique" | "peut exploser" |
 * la zone | "contre-attaque", genre: "reussite" | "echec" | "localisation" }.
 */
export function vueDuDe(avant, evenement) {
  if (evenement?.type !== "de" || !Array.isArray(evenement.valeurs) || evenement.valeurs.length === 0) return null;
  const geste = gesteEnCours(avant);
  if (geste === null) return null;
  const offert = offre(avant).de;
  if (offert === null || offert.faces !== evenement.faces) return null;
  if (offert.motif === "localisation") return d20Vu(avant, geste, evenement.valeurs);
  const jet = jetDe(avant, geste);
  const lance = jet === null ? null : lancerDe(jet, evenement.valeurs);
  if (lance === null || lance.refus) return null;
  const apres = lance.jet;
  const place = apres.places[apres.places.length - 1];
  const essai = evaluerEssai(apres, place.essais[place.essais.length - 1]);
  const de = deEtModificateur(apres);
  const critique = apres.critique === "tente" && apres.places.length > REUSSITES_MAX;
  let titre;
  if (offert.motif === "relance") titre = `relance ${SIGNES.point} ${de}`;
  else if (offert.motif === "explosion") titre = `explosion ${SIGNES.point} ${de}`;
  else if (critique) titre = `${RANGS[REUSSITES_MAX]} ${SIGNES.point} critique`;
  else titre = `${RANGS[apres.places.length - 1]} ${SIGNES.point} ${de}`;
  if (evenement.valeurs.length > 1) titre += DESAVANTAGE;
  let verdict = essai.reussi ? `${SIGNES.reussi} réussite` : `${SIGNES.echoue} échec`;
  let genre = essai.reussi ? "reussite" : "echec";
  if (essai.explosible) {
    verdict = "peut exploser";
    genre = "localisation";
  } else if (essai.reussi && critique) verdict = `${SIGNES.reussi} coup critique`;
  return { titre, valeur: `${essai.somme}`, verdict, genre };
}
