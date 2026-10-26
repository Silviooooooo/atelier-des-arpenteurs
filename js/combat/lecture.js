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
//   reste qu'à compléter du nombre saisi et, s'il y a lieu, de sa raison ;
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

import { CARACTERISTIQUES, deDuJet } from "../personnage/regles.js";
import { circonstances, modificateursDe, passifsDe, sourcesSansCible } from "./circonstances.js";
import { coupsDuGeste, degatsFixes, frapper, lettreDe, localiser } from "./degats.js";
import { evaluerEssai, modificateurDe, netDe, ouvrirJet, relancesRestantes, reussites } from "./jet.js";
import { ecrireBilan, ecrireSource, ligneDeFin, ligneEnCours, nommerLeGeste } from "./journal.js";
import { acteurCourant, annulation, boutons, candidats, cibles, esquiveOfferte, faconDeLArrivee, modeDeLaFacon, offre } from "./offre.js";
import { casesEntre } from "./plateau.js";
import { ajouterAdversaires, ajouterPersonnage, peutLancer } from "./preparation.js";
import {
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
import { aJoue, attaqueDe, campDe, capaciteDe, courantDe, defenseDe, faconDe, gesteEnCours, photoDe } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };
const UN_DU_CAMP = { pj: "personnage", adv: "adversaire" };
const POIDS = { lourde: "lourde", agile: "agile", precise: "précise" };
const RANGS = ["1er dé", "2e dé", "3e dé"];

const ACTION_EN_COURS = "Une action est en cours.";

// Les modes d'un geste qui visent une cible de l'autre camp, et que le PJ
// visé contre par sa défense quand un adversaire les joue.
const MODES_D_ATTAQUE = ["attaque", "jet_prete"];

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

/**
 * La barre de titre : l'état du combat (« Préparation », « Tour 2 · camp des
 * PJ », « Combat terminé »), la ligne d'aide de la phase, « Fin de tour »,
 * proposé pendant le combat, inactif au milieu d'une action, « Annuler le
 * dernier geste » (null avant le lancement), et la ligne de la limite des
 * événements (null avant EVENEMENTS_ALERTE). Tous les champs sont dans
 * toutes ses formes.
 */
export function vueBarre(etat) {
  const limite = (etat.pas ?? 0) >= EVENEMENTS_ALERTE ? LIMITE_PROCHE : null;
  const annuler = boutonDAnnulation(etat);
  if (etat.phase === "preparation") return { etat: "Préparation", aide: AIDES.preparation, finDeTour: null, annuler, limite };
  if (etat.phase !== "combat" || etat.tour === null) return { etat: "Combat terminé", aide: AIDES.termine, finDeTour: null, annuler, limite };
  const actif = offre(etat).types.includes("fin_de_tour");
  return {
    etat: `Tour ${etat.tour.numero} ${SIGNES.point} camp des ${CAMPS[etat.tour.camp]}`,
    aide: AIDES[etat.tour.camp],
    finDeTour: { actif, raison: actif ? null : ACTION_EN_COURS, commande: { evenement: { type: "fin_de_tour" } } },
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
 */
export function vuePlateau(etat, choisi) {
  const acteur = acteurCourant(etat, choisi);
  const geste = gesteEnCours(etat);
  const enChoix = choixSurLePlateau(etat);
  const paye = geste !== null && geste.paye === true;
  const quiPeutJouer = paye ? [] : candidats(etat);
  const quiAttend = paye ? candidats(etat).filter((id) => id !== acteur) : [];

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
 */
export function vueFiche(etat, id, choisi) {
  const photo = photoDe(etat, id);
  const courant = courantDe(etat, id);
  if (photo === null || courant === null) return null;
  const acteur = acteurCourant(etat, choisi);
  const situation = situationDe(etat, id, acteur);
  const estUnPj = courant.camp === "pj";
  const geste = gesteEnCours(etat);
  const libre = (geste === null || geste.paye !== true) && choixSurLePlateau(etat) === null;

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
    effets: [],
    jouer: libre && id !== acteur && candidats(etat).includes(id) ? { commande: { choisir: id } } : null,
    avant:
      etat.phase === "preparation"
        ? { case: courant.case, poser: { gabarit: { preparer: { type: "poser", id } } }, retirer: { commande: { preparer: { type: "retirer", id } } } }
        : null,
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
// boutons), chacune avec le groupe où elle se range. Une fois le geste payé,
// plus aucune ne se joue.
function lignesVues(etat, acteur, geste, hachures) {
  const photo = photoDe(etat, acteur);
  const camp = campDe(etat, acteur);
  const paye = geste !== null && geste.paye === true;
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

// Les étapes d'un geste, et le rang de celle qui est en cours.
function etapesDe(etat, acteur, geste, offerts) {
  const jet = geste === null ? (campDe(etat, acteur) === "pj" ? "Jet d'attaque" : "Jet de défense") : nomDuJet(etat, geste);
  const entieres = ["Capacité", "Cible", jet, "Localisation", "Interventions", "Dégâts"];
  if (geste === null) return { noms: entieres, enCours: 0 };
  if (geste.mode === "deplacement") return { noms: ["Capacité", "Arrivée"], enCours: 1 };
  if (geste.mode === "sans_jet") return { noms: ["Capacité", "Cible"], enCours: 1 };
  if (geste.mode === "caracteristique") return { noms: ["Capacité", jet], enCours: 1 };
  const parMoment = {
    preparation: offerts.pret?.ok ? 2 : 1,
    jet: 2,
    bilan: 2,
    localisation: 3,
    suites: offerts.esquive !== null ? 4 : 5,
  };
  return { noms: entieres, enCours: parMoment[geste.moment] ?? 5 };
}

function etapesVues(etat, acteur, geste, offerts) {
  const { noms, enCours } = etapesDe(etat, acteur, geste, offerts);
  return noms.map((nom, rang) => ({ nom, etat: rang < enCours ? "faite" : rang === enCours ? "en_cours" : "a_venir" }));
}

// ─── La bulle : le geste ────────────────────────────────────────────────────

// Le jet d'un geste : celui qui s'est figé au premier dé ; avant, celui qui
// se figerait à cet instant (il suit la cible et les réglages) ; null tant
// qu'il manque de quoi l'ouvrir.
function jetDe(etat, geste) {
  if (geste.jet) return geste.jet;
  if (!["attaque", "jet_prete", "caracteristique"].includes(geste.mode)) return null;
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
  const reglages = Object.hasOwn(offerts.reglages, "modificateur") ? { modificateur: aLaMain("modificateur"), avantages: aLaMain("avantages") } : null;
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
// l'instant. Avantage dépensé : … ».
const BILANS_DU_JET = {
  de: (jet, tete) => `${tete} Cliquez sur le d${jet.faces} pour lancer le ${RANGS[jet.places.length]}.`,
  choix_relance: (jet, tete) => `${tete} Le ${RANGS[jet.places.length - 1]} échoue : il reste ${compter(relancesRestantes(jet), "avantage")}.`,
  de_relance: (jet, tete) => `${tete} Avantage dépensé : cliquez sur le d${jet.faces} pour relancer le ${RANGS[jet.places.length - 1]}.`,
  choix_explosion: (jet) => `Le ${RANGS[jet.places.length - 1]} montre sa face maximale sans atteindre la difficulté : il peut exploser.`,
  de_explosion: (jet) => `Cliquez sur le d${jet.faces} pour faire exploser le ${RANGS[jet.places.length - 1]}.`,
};

function bilanVu(etat, geste, jet, offerts) {
  if (geste.moment === "preparation") {
    if (!offerts.pret.ok) return offerts.pret.manque;
    if (offerts.de === null) return null;
    const plusieurs = offerts.de.combien > 1 ? ` Il se lance ${offerts.de.combien} fois : le pire est gardé.` : "";
    return `Cliquez sur le d${offerts.de.faces} pour lancer le ${RANGS[0]}.${plusieurs}`;
  }
  if (jet === null) return null;
  if (geste.moment === "jet") {
    const nombre = reussites(jet);
    const tete = nombre === 0 ? "Aucune réussite pour l'instant." : `${compter(nombre, "réussite")} pour l'instant.`;
    return Object.hasOwn(BILANS_DU_JET, jet.attente) ? BILANS_DU_JET[jet.attente](jet, tete) : tete;
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
function degatsVus(etat, geste, capacite, facon, offerts) {
  if (offerts.degats === null) return null;
  const fixes = degatsFixes(etat, geste);
  const operations = (geste.degats?.operations ?? []).map(({ op, valeur, raison }) => ({ op, valeur, raison }));
  const saisi = operations.findLast((operation) => operation.op === "ajuster") ?? null;
  const raisonParDefaut = raisonDepuis(capacite.nom);
  const commande = (base, lesOperations, nature) => ({ evenement: { type: "degats", base, operations: lesOperations, nature } });
  const lettre = lettreDe(geste.jet.genre, reussites(geste.jet));
  const chiffrer = (tarif) => (tarif !== null && lettre !== null ? ` (${LETTRES[lettre]} = ${tarif[lettre]})` : "");
  const libelles = {
    lettre: `Dégâts du rang${chiffrer(facon.degats ?? null)}`,
    arme: `Dégâts de l'arme${chiffrer(armePreteeDe(etat, geste)?.degats ?? null)}`,
    aucun: "Sans dégâts",
  };
  return {
    bases: offerts.degats.bases.map((base) => ({ libelle: libelles[base], choisie: fixes.base === base, commande: commande(base, [], "normaux") })),
    saisie: {
      valeur: fixes.valeur,
      raison: saisi?.raison ?? null,
      raisonParDefaut,
      min: 0,
      max: offerts.degats.max,
      gabarit: { evenement: { type: "degats", base: fixes.base, nature: fixes.nature } },
    },
    natures: offerts.degats.natures.map((nature) => {
      const directs = saisi !== null ? [saisi] : [{ op: "ajuster", valeur: Math.min(fixes.valeur, offerts.degats.max), raison: raisonParDefaut }];
      return { libelle: LIBELLES_DE_NATURE[nature], choisie: fixes.nature === nature, commande: commande(fixes.base, nature === "normaux" ? operations : directs, nature) };
    }),
  };
}

// Les d20 lancés, chacun avec sa face, sa zone, et le décalage qu'on peut
// encore lui donner.
function localisationVue(etat, geste, offerts) {
  const victime = photoDe(etat, geste.cible);
  if (victime === null || geste.localisation.length === 0) return null;
  return geste.localisation.map(({ brut, decalage }, rang) => {
    const lu = localiser(victime, brut, decalage?.valeur ?? 0);
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
            },
    };
  });
}

// Le détail des dégâts, avant « Appliquer » : ce que chaque coup changerait,
// esquive comprise. Les coups frappent une copie : rien n'est appliqué.
function detailVu(etat, geste) {
  const victime = photoDe(etat, geste.cible);
  const courant = courantDe(etat, geste.cible);
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

// Les cibles du geste. Tant qu'il se règle : celles qu'il pourrait viser,
// possibles ou non, chacune avec sa raison. Une fois payé : la seule cible
// choisie, enfoncée et inactive. La rangée « Cible : » reste ainsi montrée
// pendant le jet, comme sur la maquette, sans rien offrir : le moteur
// refuserait d'en changer.
function ciblesVues(etat, geste) {
  if (geste.moment === "preparation") {
    return cibles(etat).map(({ id, possible, raison }) => ({ id, libelle: nomEntier(etat, id), choisie: geste.cible === id, actif: possible, raison, commande: regler("cible", id) }));
  }
  if (!present(geste.cible)) return [];
  return [{ id: geste.cible, libelle: nomEntier(etat, geste.cible), choisie: true, actif: false, raison: ACTION_EN_COURS, commande: regler("cible", geste.cible) }];
}

const LIBELLES_DE_CHOIX = {
  relancer: (jet) => `Relancer le ${RANGS[jet.places.length - 1]}`,
  garder: () => "Garder ce dé",
  exploser: () => "Faire exploser",
};

// Le geste en cours, tel que la bulle le montre : ce qui se règle, le
// contexte du jet, la chaîne, le bilan, puis les choix du moment.
function gesteVu(etat, geste, offerts, hachures) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  if (capacite === null || facon === null) return null;
  const photo = photoDe(etat, geste.acteur);
  const enPreparation = geste.moment === "preparation";
  const jet = jetDe(etat, geste);
  const aJet = ["attaque", "jet_prete", "caracteristique"].includes(geste.mode);
  const reglables = offerts.reglages;
  const offert = (champ) => Object.hasOwn(reglables, champ);
  const esquive = esquiveOfferte(etat);

  return {
    description: facon.description,
    jetPrete: jetPreteVu(etat, geste, offerts, hachures),
    armes: offert("arme_pretee") ? reglables.arme_pretee.options.map((rang) => ({ libelle: photo.armes[rang].libelle, choisie: geste.armePretee === rang, commande: regler("arme_pretee", rang) })) : null,
    cibles: ciblesVues(etat, geste),
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
    contexte: aJet ? contexteVu(etat, geste, capacite, jet, offerts) : null,
    chaine: jet === null ? [] : chaineVue(jet),
    aLancer: offerts.de === null ? null : { faces: offerts.de.faces, combien: offerts.de.combien, libelle: `d${offerts.de.faces}`, motif: offerts.de.motif },
    bilan: bilanVu(etat, geste, jet, offerts),
    lettres: lettresVues(etat, geste, facon, jet),
    choix: offerts.choix.map((cle) => ({ cle, libelle: LIBELLES_DE_CHOIX[cle](geste.jet), commande: { evenement: { type: cle } } })),
    degats: degatsVus(etat, geste, capacite, facon, offerts),
    localisation: localisationVue(etat, geste, offerts),
    esquive: esquive === null ? null : { libelle: capaciteDe(etat, geste.cible, esquive.capacite)?.nom ?? "", min: esquive.min, max: esquive.max, gabarit: { evenement: { type: "esquive" } } },
    detail: geste.moment === "suites" ? detailVu(etat, geste) : null,
    appliquer: offerts.types.includes("appliquer") ? { libelle: "Appliquer", commande: { evenement: { type: "appliquer" } } } : null,
    confirmer:
      enPreparation && !aJet ? { libelle: "Confirmer", actif: offerts.pret.ok, raison: offerts.pret.ok ? null : offerts.pret.manque, commande: { evenement: { type: "confirmer" } } } : null,
    revenir: enPreparation ? { commande: { evenement: { type: "revenir" } } } : null,
  };
}

// La commande qui attend, pendant un geste : c'est là que l'écran pose le
// focus. null : le titre de la bulle.
function focusDe(geste, vu, offerts) {
  if (vu === null) return null;
  if (vu.aLancer !== null) return "de";
  if (vu.choix.length > 0) return `choix:${vu.choix[0].cle}`;
  if (vu.appliquer !== null) return "appliquer";
  if (geste.moment !== "preparation") return null;
  if (offerts.pret.ok) return vu.confirmer !== null ? "confirmer" : null;
  if (vu.cases !== null && !vu.cases.some((une) => une.choisie)) return vu.cases.length > 0 ? `case:${vu.cases[0].case}` : null;
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
  if (geste === null || geste.paye !== true) return { genre: "fermer", libelle: "Fermer", commande: { choisir: null } };
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const libelle = capacite === null ? "" : libelleDe(capacite, faconDe(etat, geste));
  return { genre: "reduire", libelle: "Réduire", onglet: `${libelle} : rouvrir` };
}

const PANNEAU_VIDE = { candidats: [], nom: null, entete: null, defenseur: null, fermeture: null, etapes: [], groupes: [], passer: null, passifs: [], geste: null, vainqueur: null, focus: null };

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
 */
export function vuePanneau(etat, choisi) {
  const annonce = etat.annonce ?? null;
  if (etat.phase === "preparation") return { genre: "preparation", ...PANNEAU_VIDE, annonce };
  if (etat.phase !== "combat") return { genre: "termine", ...PANNEAU_VIDE, annonce, vainqueur: present(etat.vainqueur) ? ligneDeFin(etat.vainqueur) : null };

  const acteur = acteurCourant(etat, choisi);
  const courant = courantDe(etat, acteur);
  const photo = photoDe(etat, acteur);
  if (acteur === null || courant === null || photo === null) {
    const liste = candidats(etat).map((id) => ({ id, nom: nomEntier(etat, id), commande: { choisir: id } }));
    return { genre: "qui_joue", ...PANNEAU_VIDE, annonce, candidats: liste, focus: liste.length > 0 ? `candidat:${liste[0].id}` : null };
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
  const vu = geste === null ? null : gesteVu(etat, geste, offerts, hachures);
  const groupes = grouper(lignesVues(etat, acteur, geste, hachures), courant.camp !== "pj");
  const passer = { actif: libre, raison: libre ? null : ACTION_EN_COURS, commande: { evenement: { type: "passer", qui: acteur } } };
  return {
    genre: "action",
    candidats: [],
    nom: `${nomEntier(etat, acteur)} : ses actions`,
    entete: enteteDe(etat, acteur, geste),
    defenseur: defenseurDe(etat, geste),
    fermeture: fermetureDe(etat, geste),
    etapes: etapesVues(etat, acteur, geste, offerts),
    groupes,
    passer,
    passifs: passifsVus(etat, acteur),
    geste: vu,
    annonce,
    vainqueur: null,
    focus: geste === null ? focusDeLaListe(groupes, passer) : focusDe(geste, vu, offerts),
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
