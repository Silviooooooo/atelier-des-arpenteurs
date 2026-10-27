// L'écran du simulateur de combat, #/combat (SPECIFICATION.md, § 17, « Le
// simulateur de combat (lot 4) » ; § 7.2 pour l'enregistrement chiffré ;
// contrat du lot 4, groupe 2, § 9 ; complément, § 4 et § 5).
//
// Ce qu'il fait : il assemble les parties de l'écran (le plateau, les fiches
// vivantes, la zone sous la carte, la bulle d'options, la préparation, le
// journal et son bandeau) autour d'une séance, et tient lui-même le reste :
// la barre de titre (« Fin de tour », « Annuler le dernier geste » et sa
// question, « Nouveau combat » et la sienne, le menu « ⋯ »), la ligne de la
// limite des événements, la zone d'avis, le panneau « Fiche complète », la
// liste d'une case, et les deux boutons du journal. Il ne porte aucune règle
// du jeu : chaque rendu demande ses vues au moteur (js/combat/lecture.js),
// chaque clic rend à la séance la commande que la vue portait, puis l'écran
// se redessine.
//
// Pourquoi il existe : c'est le seul module qui garde le combat en mémoire.
// Chaque visite de l'adresse reconstruit la page ; le combat, lui, doit
// rester. La séance et son gardien vivent donc ici, d'une visite à l'autre,
// jusqu'à « Oublier le mot de passe » (oublier()), qui les efface : le combat
// chiffré reste sur l'appareil, illisible sans la clé. La clé de table n'est
// jamais copiée ici : le gardien la lit dans l'état de la page au moment
// d'écrire.
//
// L'ouverture demande trois attentes (les rôles câblés de la banque, la base
// de l'appareil, le combat gardé, rejoué par tranches) : afficher() rend donc
// son nœud tout de suite, avec le titre et une attente, puis le remplit. Une
// suite partie avant un oubli, ou pour un nœud qui a quitté la page, ne
// touche plus à rien. La composition de la rencontre gardée se lit à côté,
// sans que l'ouverture l'attende.
//
// Au groupe 2, tout ce qui se décide pour un geste se fait dans la bulle,
// accrochée à la case de qui joue (sous 56rem, le volet) : l'écran la rend
// avec la case active pour ancre et le cadre pour repère, la replace quand
// elle s'ouvre, et y met le focus quand l'ouverture suit une commande. Un
// clic hors de la bulle, de son onglet et de la carte la ferme ou la réduit
// sans bouger le focus ; Échap ferme d'abord l'infobulle ouverte, puis la
// bulle, et rend le focus au jeton. L'écran ne fait jamais défiler la page
// de lui-même : chaque focus qu'il pose l'est sans défiler, la liste du
// journal défile en elle-même, et seul « Journal ↓ » (montrerLeJournal) fait
// voir le journal, à la demande.
//
// À la vague 3 du lot 4.3 (mission, § 3 à § 5 ; contrat de la vague, § 2.2
// et § 4.3) : au téléphone, la barre du tour (☰, l'état court, « Fin de
// tour » ou « Intervenir… », « MJ », ⋯) prend la place de l'en-tête du site
// (la classe combat-en-jeu, posée hors de la préparation, le dit à la
// feuille de style), les vignettes du camp qui joue passent au-dessus de la
// carte, le journal et les fiches s'ouvrent en plein écran, par-dessus le
// combat (combat_menus.js). Le Mode MJ, gardé sur l'appareil par mode_mj.js,
// est lu à chaque visite et passé à chaque partie ; il n'entre jamais dans
// le combat. L'écran tient la palette (sa source, le choix en cours, où elle
// se montre, et la simulation que ses vues demandent au moteur), le menu du
// MJ, « Intervenir… », « Changer l'équipement… » (la photographie recalculée
// avec la banque ouverte), et le dé en surimpression : chaque dé tiré se
// montre une seconde sur la carte, au centre, ou dans la moitié que la bulle
// laisse libre, par l'une de trois classes, sans aucune mise en forme écrite.
// Les vues viennent de lecture.js, ou d'un service (services.vues), pour que
// les contrôles éprouvent l'écran sur des vues écrites à la main.
//
// Ce que l'écran sait de plus que le combat n'est gardé nulle part : d'où
// vient la cible choisie (la carte, ou la bulle et la zone), la case dont la
// liste est ouverte, la fiche complète montrée, le menu « ⋯ », la question
// ouverte, la phrase du personnage de démonstration gardé, la palette
// ouverte et son choix, le menu ou la feuille ouverts, le dé montré. Un
// rechargement les oublie.

import { indexerAdversaires } from "../adversaire/resolution.js";
import { listeDe } from "../banque/consultation.js";
import { sourceAleatoire } from "../combat/des.js";
import { creerGardien, ouvrirMagasinCombat } from "../combat/enregistrement.js";
import { nomDuFichier, texteDuJournal } from "../combat/journal.js";
// Les vues du combat, sous un nom à elles : « lecture » est déjà celle de la
// fiche complète (js/fiche/lecture.js).
import * as vuesDuCombat from "../combat/lecture.js";
import { appliquer } from "../combat/moteur.js";
import { etatsDeLaBanque, photographierAdversaire, photographierPersonnage } from "../combat/photographie.js";
import { PLAFOND_ADVERSAIRES } from "../combat/regles.js";
import { ecrireAbsents, tableDesRoles } from "../combat/roles.js";
import { creerSeance } from "../combat/seance.js";
import { gesteEnCours } from "../combat/valeurs.js";
import { lecture } from "../fiche/lecture.js";
import { calculerFiche } from "../personnage/calcul.js";
import { personnagesDisponibles } from "../personnage/disponibles.js";
import { accepter } from "../personnage/format.js";
import * as partieAction from "./combat_action.js";
import * as partieBulle from "./combat_bulle.js";
import * as partieFiches from "./combat_fiches.js";
import { creerBandeau, creerListe } from "./combat_journal.js";
// Les parties de la vague 3 du lot 4.3 (contrat de la vague, § 4.1) : les
// menus et les feuilles, la palette, les vignettes.
import * as partieMenus from "./combat_menus.js";
import * as partiePalette from "./combat_palette.js";
import * as partiePlateau from "./combat_plateau.js";
import * as partiePreparation from "./combat_preparation.js";
import * as partieVignettes from "./combat_vignettes.js";
import { el, sansSensForce, telecharger, titre } from "./dom.js";
import { FLECHE, placerBulle } from "./echelle.js";
import { ecrireModeMj, lireModeMj } from "./mode_mj.js";
import { lirePersonnageDeDemonstration, phraseDuPersonnageGarde } from "./partage.js";
import { garderRecu } from "./personnages.js";
import * as rencontre from "./rencontre.js";

const TITRE = "Simulateur de combat";
const QUESTION = "Effacer ce combat et son journal ?";
const JOURNAL_VIDE = "Le combat n'est pas lancé : le journal est vide.";
const BANQUE_CHANGEE = "La banque a changé depuis l'ajout : cette fiche suit la banque du jour.";
const FICHE_INDISPONIBLE = "La fiche complète de ce protagoniste n'est pas disponible.";
// Les textes de cet écran que l'auteur n'a pas écrits : ils restent à lui
// faire confirmer.
const ATTENTE = "Ouverture du combat…";
const ECHEC_DE_L_OUVERTURE = "Le combat n'a pas pu s'ouvrir";
const COPIE_FAITE = "Journal copié.";
const COPIE_REFUSEE = "Copie refusée par le navigateur : le texte du journal est sélectionné ci-dessous, copiez-le à la main.";
const PERSONNAGE_ILLISIBLE = "Ce personnage ne se lit pas.";
const ADVERSAIRE_ILLISIBLE = "Cet adversaire ne se lit pas.";
const HORS_DU_COMBAT = "reste hors du combat.";
// Le personnage de démonstration que l'appareil n'a pas pu garder (contrat
// du groupe 2, § 9.10).
const PAS_GARDE = "Le personnage n'a pas pu être gardé";
// Le signe d'« Annuler le dernier geste » (U+21B6), écrit par son code, et
// caché aux lecteurs d'écran : le libellé seul dit le bouton.
const SIGNE_ANNULER = "\u21b6";
// La barre du téléphone (mission du lot 4.3, § 3) : ☰ (U+2630), qui ouvre les
// entrées du site, et que nomme la navigation qu'il remplace (index.html) ;
// les points de suspension (U+2026) d'« Intervenir… ».
const SIGNE_DU_SITE = "\u2630";
const NAVIGATION = "Navigation principale";
const POINTS = "\u2026";
// Le Mode MJ (mission, § 5 ; contrat de la vague 3, § 6) : son libellé, sa
// marque, ce que la région d'annonce dit quand il change, et la ligne de
// l'en-tête de la carte sur PC (E1). Les deux phrases de l'annonce sont à
// faire confirmer par l'auteur.
const MODE_MJ = "Mode MJ";
const MARQUE_MJ = "MJ";
const MJ_ALLUME = "Mode MJ allumé.";
const MJ_ETEINT = "Mode MJ éteint.";
const CLIC_DROIT = "clic droit sur un jeton : le menu du MJ";
// « Changer l'équipement… » (D14) : quand la photographie ne se refait pas
// (texte à faire confirmer), quand rien ne change, quand une qualité ne
// s'écrit pas comme dans le fichier du personnage (« 2 », « 1,5 », ou rien).
const PAS_ENCORE = "Pas encore possible dans ce simulateur.";
const RIEN_NE_CHANGE = "Aucune valeur ne change.";
const QUALITE_ILLISIBLE = "La qualité est un nombre (« 2 », « 1,5 ») ou rien.";
const MOTIF_QUALITE = /^\d{1,3}(?:,\d{1,2})?$/;
// Le dé en surimpression (mission, § 3, A5 et B2) : une seconde ; sa classe
// d'état d'après le genre de vueDuDe (contrat, § 5.2) ; ses trois places.
const DUREE_DU_DE = 1000;
const ETAT_DU_DE = { reussite: "reussi", echec: "echoue", localisation: "localisation" };
const PLACES_DU_DE = { centre: "combat-surimpression-centre", gauche: "combat-surimpression-gauche", droite: "combat-surimpression-droite" };
// Le menu du MJ sur PC, et ses panneaux (mission, § 4.8, E4 ; vague 4,
// W1 n° 8) : contre le jeton (ou « Modifier… ») qui l'ouvre, à droite
// d'abord, comme la bulle, à la distance de la flèche, son haut un peu
// au-dessus du milieu de l'ancre. Fixé à la fenêtre, il se place dans le
// repère de son coin.
const COTES_DU_MENU = ["droite", "gauche", "dessous", "dessus"];
const POINTE_DU_MENU = 22;
const COIN_DE_LA_FENETRE = Object.freeze({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) });

// Au téléphone, les commandes du volet qui finissent un geste (vague 4,
// R2 n° 9 et C3) : « Terminer » (appliquer), « Laisser passer » (la
// contre-attaque), la blessure choisie. Le geste fini, le volet se referme.
const FINS_DU_GESTE = new Set(["appliquer", "laisser", "blessure"]);

// La largeur sous laquelle l'écran tient sur une colonne : celle de la
// feuille de style (56rem). Le téléphone se juge à elle : les fiches s'y
// replient, la bulle y devient le volet, le jet s'y joue sous la carte.
const ETROIT = "(max-width: 55.99rem)";
// Les jetons qu'une case montre (combat_plateau.js) : trois, et deux sous
// 56rem, où la feuille cache le troisième. Au-delà, son « +k ».
const MONTRES = 3;
const MONTRES_ETROIT = 2;
// Le fichier téléchargé s'ouvre dans les éditeurs de Windows : la marque
// d'ordre des octets leur dit que c'est de l'UTF-8. Elle se fabrique par son
// code : aucun signe invisible ne s'écrit dans les sources.
const MARQUE_D_ORDRE = String.fromCodePoint(0xfeff);
const TYPE_DU_FICHIER = "text/plain;charset=utf-8";

// Les états du gardien qui demandent un geste ou préviennent d'une perte, et
// le bouton de ceux qui en ont un. « garde » et « ecriture », qui alternent à
// chaque clic, n'y sont pas : ils ne s'annoncent jamais.
const GARDES_QUI_PREVIENNENT = { ailleurs: "reprendre", illisible: "nouveau", autre_version: "nouveau", recent: null, memoire: null, sans_cle: null };
const LIBELLES = { reprendre: "Reprendre le combat le plus récent", nouveau: "Nouveau combat" };

// Ce que la bulle reçoit quand on ne joue pas (un combat ouvert ailleurs,
// la préparation) : aucun genre qu'elle montre.
const BULLE_CACHEE = Object.freeze({ genre: "arrete" });

// ─── Les services de la page ────────────────────────────────────────────────

/** La taille de la fenêtre, lue dans la page au moment de la demande. */
function fenetreDeLaPage() {
  const racine = globalThis.document?.documentElement;
  return { largeur: racine?.clientWidth ?? 0, hauteur: racine?.clientHeight ?? 0 };
}

/**
 * Vrai quand le texte du bandeau tient en trois lignes : sa hauteur contre
 * trois fois sa hauteur de ligne. Une hauteur de ligne qui ne se lit pas ne
 * coupe rien : la feuille rogne.
 */
function tientEnTroisLignes(noeud) {
  const ligne = Number.parseFloat(globalThis.getComputedStyle?.(noeud)?.lineHeight);
  if (!Number.isFinite(ligne)) return true;
  return noeud.scrollHeight <= 3 * ligne + 1;
}

/** Prévient à chaque changement de taille du nœud, s'il se peut ; rend de quoi arrêter. */
function surveillerLaTaille(noeud, rappel) {
  if (typeof globalThis.ResizeObserver !== "function") return () => {};
  const observateur = new globalThis.ResizeObserver(() => rappel());
  observateur.observe(noeud);
  return () => observateur.disconnect();
}

const MINUTEUR_DE_LA_PAGE = {
  poser: (faire, ms) => globalThis.setTimeout(faire, ms),
  retirer: (numero) => globalThis.clearTimeout(numero),
};

// ─── La mémoire du module ───────────────────────────────────────────────────

// Le combat, d'une visite à l'autre : { mode, gardien, seance, gardeVue,
// disponibles, lecture, limiteDite }. Nul tant que rien n'est ouvert, et
// après un oubli. limiteDite : l'heure de lancement du combat pour lequel
// l'approche de la limite a été dite, une fois, dans la zone d'avis.
let memoire = null;
// « Oublier » l'avance : une suite asynchrone partie avant lui relit ce
// numéro, et ne touche plus à rien s'il a changé.
let circuit = 0;
// L'ouverture en cours, que plusieurs visites peuvent attendre : jamais deux
// séances ni deux gardiens.
let ouverture = null;
// La dernière visite montée : elle seule suit le gardien et répond aux clics.
let visiteCourante = null;
// Ce que la séance lit au moment d'agir : la clé dans l'état de la page, les
// dés et l'heure dans les services de la visite du moment.
let contexteDuMoment = null;
let servicesDuMoment = null;
// La base de l'appareil s'ouvre une fois par page, à la première visite. Sans
// IndexedDB, son jumeau en mémoire garde le combat chiffré entre deux visites.
let magasinDeLaPage = null;
// Ce que la banque ouverte donne aux photographies : ses rôles câblés, et
// qui de ses adversaires s'ajoute. Par objet banque : une banque republiée
// est un autre objet.
const outilsParBanque = new WeakMap();

function outilsDe(contexte) {
  const { banque, mode } = contexte.etat;
  const outils = banque !== null && typeof banque === "object" ? outilsParBanque.get(banque) : null;
  return outils && outils.mode === mode ? outils : null;
}

const estPret = (contexte) => memoire !== null && memoire.mode === contexte.etat.mode && outilsDe(contexte) !== null;

async function preparerLOuverture(contexte, services, depart, enCours) {
  const { banque, mode } = contexte.etat;
  if (outilsDe(contexte) === null) {
    const roles = await tableDesRoles(banque, mode);
    if (depart !== circuit) return;
    outilsParBanque.set(banque, { mode, roles, resolution: null, adversaires: null });
  }
  if (memoire !== null && memoire.mode !== mode) {
    memoire.gardien.oublier();
    memoire = null;
  }
  if (memoire !== null) return;
  const magasin = await (services.magasin ?? (magasinDeLaPage ??= ouvrirMagasinCombat()));
  if (depart !== circuit) return;
  const gardien = creerGardien({
    magasin,
    mode,
    secret: () => contexteDuMoment?.etat?.secret ?? null,
    maintenant: () => servicesDuMoment.maintenant(),
  });
  // Un oubli pendant la lecture doit atteindre ce gardien-ci aussi.
  enCours.gardien = gardien;
  // Le rejeu d'un combat gardé rend la main entre deux tranches : la séance
  // attend rendreLaMain (la tâche suivante du navigateur, à défaut).
  const seance = creerSeance({
    gardien,
    des: { lancer: (faces, combien) => servicesDuMoment.des.lancer(faces, combien) },
    maintenant: () => servicesDuMoment.maintenant(),
    mode,
    accepter,
    rendreLaMain: services.rendreLaMain,
  });
  await seance.ouvrir();
  if (depart !== circuit) return;
  memoire = { mode, gardien, seance, gardeVue: null, disponibles: null, lecture: 0, limiteDite: null };
}

function ouvrir(contexte, services) {
  if (ouverture === null) {
    const enCours = { gardien: null, promesse: null };
    enCours.promesse = preparerLOuverture(contexte, services, circuit, enCours).finally(() => {
      if (ouverture === enCours) ouverture = null;
    });
    ouverture = enCours;
  }
  return ouverture.promesse;
}

// Une ouverture déjà partie a pu l'être pour une autre banque (republiée
// entre-temps) : on repart alors une fois pour celle-ci.
async function attendreLOuverture(contexte, services) {
  const depart = circuit;
  for (let essai = 0; essai < 2 && !estPret(contexte); essai += 1) {
    await ouvrir(contexte, services);
    if (depart !== circuit) return false;
  }
  return estPret(contexte);
}

/**
 * « Oublier le mot de passe » (§ 7.2) : le combat quitte la mémoire, et une
 * ouverture en cours n'y remettra rien. La base n'est pas touchée : le combat
 * chiffré y reste, illisible sans la clé.
 */
export function oublier() {
  circuit += 1;
  visiteCourante?.desabonner?.();
  visiteCourante = null;
  ouverture?.gardien?.oublier();
  ouverture = null;
  memoire?.gardien.oublier();
  memoire = null;
  contexteDuMoment = null;
  servicesDuMoment = null;
}

// ─── Les petits outils de la page ───────────────────────────────────────────

/** Vrai quand « noeud » est « ancetre », ou l'un de ses descendants. */
function estDans(noeud, ancetre) {
  for (let courant = noeud; courant; courant = courant.parentNode) {
    if (courant === ancetre) return true;
  }
  return false;
}

// Un texte ne se réécrit que s'il a changé : un nœud réécrit perd sa
// sélection, et une région d'alerte se redirait.
function poser(noeud, texte) {
  const propre = sansSensForce(texte ?? "");
  if (noeud.textContent !== propre) noeud.textContent = propre;
}

/**
 * Rend un bouton actif ou inactif. Inactif, il reste dans l'ordre du clavier
 * (aria-disabled, jamais disabled) : sa raison, écrite à côté de lui, lui est
 * liée, et c'est son écouteur qui ne fait rien.
 */
function reglerBouton(bouton, raison, actif, pourquoi) {
  if (actif) bouton.removeAttribute("aria-disabled");
  else bouton.setAttribute("aria-disabled", "true");
  const texte = actif || !pourquoi ? "" : pourquoi;
  poser(raison, texte);
  raison.hidden = texte === "";
}

const estInactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";

const nomDe = (personnage) => String(personnage?.identite?.nom ?? "").trim() || "Sans nom";

// Une donnée que la banque ou l'appareil a abîmée ne doit pas laisser une
// page blanche : la photographie qui lèverait devient un refus.
function photographier(faire, phrase) {
  try {
    return faire();
  } catch {
    return { refus: phrase };
  }
}

// De même, un bloc de blessure qui ne se lit pas ne propose aucune capacité :
// l'étape « La blessure » garde l'état libre.
function blocDeBlessure(banque) {
  try {
    return etatsDeLaBanque(banque).blessure;
  } catch {
    return [];
  }
}

// Les blocs d'états du classeur (F9), que la palette et le menu du MJ
// proposent ; aucun si la banque ne les lit pas.
function blocsDEtats(banque) {
  try {
    return etatsDeLaBanque(banque).blocs ?? [];
  } catch {
    return [];
  }
}

/**
 * Ce que les vues de la palette et du menu du MJ demandent au moteur
 * (contrat de la vague 3, D10 bis) : l'état d'après un événement, sur l'état
 * montré, { etat }, ou son refus, { refus }.
 */
const simulateurDe = (etat) => (evenement) => {
  const rendu = appliquer(etat, evenement);
  return rendu.refus ? { refus: rendu.refus } : { etat: rendu.etat };
};

/** Vrai quand deux nœuds de la page se chevauchent, d'après leurs boîtes. */
function chevauche(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Le protagoniste d'une vue de la bulle : elle ne le nomme que dans la commande de « Passer son tour ». */
const protagonisteDe = (vue) => vue?.passer?.commande?.evenement?.qui ?? null;

// ─── L'écran ────────────────────────────────────────────────────────────────

/**
 * L'écran #/combat. Rend son nœud tout de suite ; l'ouverture du combat est
 * asynchrone. « services » ne sert qu'aux contrôles, chacun avec son défaut ;
 * la page n'en passe aucun, et rien dans la page ne permet d'imposer un dé :
 * { des, magasin, maintenant, navigateur, telecharger, media, fenetre, tient,
 * surveiller, minuteur, rendreLaMain, magasinRencontre, fetch, vues }.
 * fenetre() rend la taille de la fenêtre ; tient(noeud) dit si le texte du
 * bandeau tient en trois lignes ; surveiller(noeud, rappel) prévient quand
 * sa taille change ; minuteur tient la grâce des infobulles, l'appui long et
 * le dé d'une seconde ; rendreLaMain passe à la séance ; magasinRencontre, à
 * la rencontre gardée ; fetch lit le personnage de démonstration ; vues
 * remplace les vues de lecture.js (contrat de la vague 3, § 4.3).
 */
export function afficher(contexte, services = {}) {
  contexteDuMoment = contexte;
  servicesDuMoment = {
    des: services.des ?? sourceAleatoire(),
    maintenant: services.maintenant ?? (() => new Date()),
  };
  const h1 = titre(TITRE);
  const barre = el("header", { classe: "combat-barre" }, h1);
  const racine = el("section", { classe: "combat ne-pas-imprimer" }, barre);
  const visite = {
    contexte,
    racine,
    barre,
    h1,
    desabonner: null,
    services: {
      navigateur: services.navigateur ?? globalThis.navigator,
      telecharger: services.telecharger ?? telecharger,
      media: services.media ?? ((requete) => globalThis.matchMedia?.(requete)?.matches ?? false),
      fenetre: services.fenetre ?? fenetreDeLaPage,
      tient: services.tient ?? tientEnTroisLignes,
      surveiller: services.surveiller ?? surveillerLaTaille,
      minuteur: services.minuteur ?? MINUTEUR_DE_LA_PAGE,
      magasinRencontre: services.magasinRencontre,
      fetch: services.fetch,
      vues: services.vues ?? vuesDuCombat,
    },
  };
  if (estPret(contexte)) {
    monter(visite);
    return racine;
  }
  // L'attente quitte la page quand l'écran s'affiche : elle ne côtoie jamais
  // la région d'annonce des dés. Le titre, lui, reste le même nœud : il a pu
  // recevoir le focus à l'arrivée sur l'écran. Elle reste pendant tout le
  // rejeu du combat gardé, qui rend la main par tranches.
  const attente = el("p", { classe: "attente", role: "status" }, ATTENTE);
  racine.append(attente);
  const depart = circuit;
  attendreLOuverture(contexte, services)
    .then((pret) => {
      if (depart !== circuit || !racine.isConnected) return;
      attente.remove();
      if (pret) monter(visite);
      else racine.append(el("p", { classe: "message", role: "alert" }, `${ECHEC_DE_L_OUVERTURE}.`));
    })
    .catch((erreur) => {
      if (depart !== circuit || !racine.isConnected) return;
      attente.remove();
      racine.append(el("p", { classe: "message", role: "alert" }, `${ECHEC_DE_L_OUVERTURE} : ${erreur?.message ?? String(erreur)}`));
    });
  return racine;
}

// Monte l'écran d'une visite sur le combat en mémoire : ses nœuds se créent
// une fois, puis rendre() ne refait que ce dont la vue a changé.
function monter(visite) {
  const m = memoire;
  const { seance, gardien } = m;
  const { contexte, racine, barre, h1, services } = visite;
  // La banque de la visite : une banque republiée fait une autre visite.
  const { banque } = contexte.etat;
  const outils = outilsDe(contexte);
  const resolution = () => (outils.resolution ??= contexte.etat.index?.adversaires?.() ?? indexerAdversaires(banque));
  // Les capacités du bloc de blessure, figées une fois par banque, que
  // l'étape « La blessure » propose (lot 4.3).
  const blessures = () => (outils.blessures ??= blocDeBlessure(banque));
  // Les blocs d'états du classeur (F9), figés une fois par banque.
  const etatsDuClasseur = () => (outils.etats ??= blocsDEtats(banque));
  const enDemonstration = contexte.etat.mode === "demo";
  // Les vues : celles de lecture.js, ou celles qu'un contrôle écrit à la main.
  const { vues } = services;
  // Le Mode MJ, lu à chaque visite (mode_mj.js) ; il n'entre jamais dans le
  // combat, que le rejeu refait de même, allumé ou éteint.
  let modeMj = lireModeMj();

  // Après un oubli, ou quand une autre visite a pris la suite, les boutons
  // de celle-ci ne font plus rien.
  const perimee = () => memoire !== m || visiteCourante !== visite;

  // Ce que l'écran sait de plus que le combat (jamais gardé).
  let avis = null; // { lignes, bouton }
  let cibleChoisie = null; // { numero, cible, origine }
  let caseOuverte = null;
  let ficheOuverte = null;
  let retourDeCopie = null; // "faite", ou { texte } quand le presse-papiers refuse
  let menuOuvert = false;
  // La question ouverte dans la barre : « nouveau » (« Nouveau combat »),
  // « annuler » (« Annuler le dernier geste »), ou null.
  let question = null;
  let phraseDeDemonstration = null;
  // Pendant une commande, le gardien prévient avant que la séance ait fini :
  // l'écran attend la fin de la commande pour se redessiner.
  let occupe = 0;
  // Pendant un clic au-dehors, un Échap ou une annulation, la commande jouée
  // ne déplace pas le focus : celui qui l'a demandée le pose lui-même, ou le
  // laisse où il est.
  let immobile = 0;
  // D'où vient la commande en cours : un choix fait sur la carte rend le
  // focus à la commande qui attend dans la bulle (la règle du groupe 1).
  let origineDuMoment = null;
  // « Reprendre le combat le plus récent » en cours : le bloc d'arrêt montre
  // l'attente au lieu de son bouton.
  let reprises = 0;
  let enReprise = false;
  // L'élément inactif (aria-disabled) que le clic en cours a touché, retenu
  // à la capture : le clic au-dehors qui ferme la bulle redessine la barre
  // avant que le bouton l'entende, et un bouton montré inactif ne fait rien
  // (compl. § 4.10 ; spéc. § 17.7), même redevenu actif entre-temps.
  let inactifAuClic = null;
  // Le genre du dernier appui sur l'écran (« touch », « mouse », « pen »,
  // « clavier »), vu en capture : un focus qui suit un appui du doigt n'ouvre
  // pas d'infobulle, que l'appui ait touché la ligne ou le jeton (compl.
  // § 4.2, « Au doigt » ; spéc. § 17.7).
  let dernierAppui = null;
  // L'appui long a ouvert le menu du MJ : le clic qui le suit s'avale
  // (avalerLeClicSuivant).
  let clicAAvaler = false;
  // Ce qui est montré, pour ne réécrire que ce qui change.
  let montree = null;
  let bulleMontree = false;
  // La bulle montrée porte la palette (sur PC, élargie).
  let bulleLarge = false;
  let protagonisteMontre = null;
  let bloqueRendu = null;
  let avisMontre = "null";
  let blocageMontre = "";
  let listeMontree = "";
  let copieMontree = "";
  let libelleDAnnulation = null;
  let commandeDeFin = null;
  // La palette ouverte : { source, libre, ancre, choisi, geste, parDefaut },
  // ou null. « geste » : le numéro du geste pendant lequel elle s'est
  // ouverte (null hors d'un geste) ; elle se ferme quand il finit.
  // « parDefaut » : celle que la bulle porte d'elle-même sur PC, en Mode MJ,
  // pendant tout geste (contrat de la vague 3, § 4.3).
  let paletteOuverte = null;
  // Un appui vient d'ouvrir la palette : sa feuille peut prendre la place
  // d'une autre (les fiches en plein écran, au téléphone).
  let paletteAOuvrir = false;
  // Le compte des passes de rendre(). Pendant la sienne, la palette peut
  // rappeler choisirDansLaPalette (la durée par défaut entre dans son
  // choix, une fois), qui refait tout l'écran ; la passe ainsi doublée
  // s'arrête là, sans repasser sur la bulle, le journal et les menus avec
  // la vue d'avant.
  let passes = 0;
  // Les fiches prêtées au plein écran (téléphone) : le cadre ne les reprend
  // qu'à la fermeture.
  let fichesEnPlein = false;
  // Une case demandée à la carte (« Déplacer sans action… », la case d'un
  // effet) : Échap y met fin.
  let demandeEnCours = false;
  // Demandée par la palette d'une feuille, qui s'est effacée le temps du
  // choix (vague 4, C2) : { cle }, celle du bouton qui l'a demandée, où le
  // focus revient quand la feuille reparaît ; sinon null.
  let caseDeLaPalette = null;
  // Demandée par la palette de la bulle (PC, pendant un geste), qui reste
  // montrée : la palette repliée autrement que par « Fermer » (le geste fini,
  // « Appliquer », le Mode MJ éteint), ou partie à une autre source, la case
  // ne l'est plus (relecture finale, R3).
  let caseDeLaBulle = false;
  // Le dé montré en surimpression : le numéro de son minuteur.
  let deMontre = null;
  // Ce que la bulle montrait au dernier rendu : « reduire » après le premier
  // dé (vuePanneau.fermeture).
  let fermetureMontree = null;
  // Qui a posé la question de la barre : au téléphone, le focus lui revient.
  let retourDeLaQuestion = null;
  // Ce que « Changer l'équipement… » a changé pendant cette visite du
  // combat : le personnage ou la ligne d'où la photographie a été refaite,
  // par protagoniste (la mémoire du combat les garde, jusqu'à un nouveau).
  m.equipements ??= new Map();
  // Revenu sur l'écran avec le combat en mémoire, ce nœud n'est pas encore
  // dans la page : la liste du journal ne se pose qu'une fois qu'il y est,
  // pour défiler jusqu'à sa dernière ligne.
  let journalEnAttente = !racine.isConnected;

  const sansBougerLeFocus = (faire) => {
    immobile += 1;
    try {
      return faire();
    } finally {
      immobile -= 1;
    }
  };

  /** Le premier élément inactif (aria-disabled="true") de la cible d'un clic jusqu'à la racine de l'écran ; sinon null. */
  function ancetreInactif(noeud) {
    for (let courant = noeud; courant; courant = courant.parentNode) {
      if (courant.getAttribute?.("aria-disabled") === "true") return courant;
      if (courant === racine) return null;
    }
    return null;
  }

  /** Un bouton inactif : il l'est, ou il l'était quand le clic en cours l'a touché. */
  const inactif = (bouton) => estInactif(bouton) || inactifAuClic === bouton;

  const hachurer = (noms) => plateau.hachurer(noms);
  // Les actions que l'écran donne à ses parties ; à la vague 3 (contrat,
  // § 4.3), la palette, le menu du MJ, le plein écran, la case demandée, le
  // jeton sans choix, la phrase d'une seconde, et ce que le volet au repos
  // offre (l'annulation, la fin du tour, le menu du combat).
  const actions = {
    executer,
    lancerLeDe,
    ajouterPersonnage,
    ajouterAdversaires,
    placerRencontre,
    lancer,
    ouvrirFiche,
    ouvrirCase,
    ajouterLaDemonstration,
    hachurer,
    ouvrirPalette,
    changerLaSource,
    choisirDansLaPalette,
    fermerLaPalette,
    ouvrirMenuMj,
    ouvrirJournal,
    ouvrirFiches,
    ouvrirMenuDuCombat,
    demanderUneCase,
    jetonSansChoix,
    dire,
    demanderLAnnulation,
    finDeTour: terminerLeTour,
    avalerLeClicSuivant,
  };
  const plateau = partiePlateau.creer(actions, { minuteur: services.minuteur });
  const fiches = partieFiches.creer(actions);
  const vignettes = partieVignettes.creer(actions, { minuteur: services.minuteur });
  const palette = partiePalette.creer(actions);
  // La couche des menus et des feuilles : ses saisies et les clés de ses
  // options restent en elle ; elle rend la main par ces actions.
  const menus = partieMenus.creer(
    { executer, basculerLeModeMj, ouvrirFiches, ouvrirJournal, demanderUnNouveauCombat, demanderUneCase, dire, fermerLaPalette, changerLEquipement },
    { minuteur: services.minuteur, placer: placerLeMenu },
  );
  // La zone sous la carte a ses infobulles (les causes d'un jet joué sous la
  // carte, sur un téléphone), dans une couche que l'écran crée et qu'elle
  // porte : elles se posent sur elle.
  const coucheDeLaZone = el("div", { classe: "combat-infobulles" });
  const infobullesDeLaZone = partieBulle.creerInfobulles({ couche: coucheDeLaZone, actions: { hachurer }, services: { minuteur: services.minuteur, fenetre: services.fenetre, dernierAppui: () => dernierAppui } });
  const action = partieAction.creer({ executer, lancerLeDe, hachurer }, { lier: infobullesDeLaZone.lier, couche: coucheDeLaZone });
  const bulle = partieBulle.creer(
    {
      executer,
      lancerLeDe,
      hachurer,
      focusSurLeJeton,
      focusSurLaCase,
      fermerLaCase: () => fermerLaListe(caseOuverte),
      rafraichir,
      // La fenêtre a changé de taille : le menu du MJ se replace aussi (C6).
      replacerLeMenu: () => menus.replacer(),
      ouvrirPalette,
      ouvrirFiches,
      ouvrirJournal,
      demanderLAnnulation,
      finDeTour: terminerLeTour,
      ouvrirMenuDuCombat,
    },
    { composerListe: partieAction.composerListe, composerGeste: partieAction.composerGeste, dernierAppui: () => dernierAppui },
  );
  const preparation = partiePreparation.creer(actions);

  // ——— La barre de titre ———

  // Deux textes simples, sans rôle : l'état du combat redirait le changement
  // de tour, celui de l'enregistrement change deux fois par clic, et tous
  // deux couvriraient l'annonce du dé.
  const etatDuCombat = el("p", { classe: "combat-etat" });
  const garde = el("p", { classe: "combat-garde" });
  const raisonDeFin = el("span", { id: "combat-raison-fin-de-tour", classe: "combat-raison", hidden: true });
  const finDeTour = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      "aria-describedby": "combat-raison-fin-de-tour",
      hidden: true,
      onclick: () => terminerLeTour(),
    },
    "Fin de tour",
  );

  // « Fin de tour », depuis la barre ou le volet au repos (A7).
  function terminerLeTour() {
    if (!perimee() && !inactif(finDeTour) && commandeDeFin !== null) executer(commandeDeFin, "panneau");
  }

  // La barre du téléphone (mission du lot 4.3, § 3, A1) : ☰, qui ouvre les
  // entrées du site ; l'état court (« Tour 2 · PJ »), en danger au tour
  // adverse ; « Intervenir… » au tour adverse ; « MJ » quand le Mode MJ est
  // allumé. Pendant le tour des PJ, « Intervenir… » est dans le menu : la
  // feuille ⋯ au téléphone, la rangée des autres commandes sur PC.
  const boutonDuSite = el(
    "button",
    { type: "button", classe: "bouton secondaire combat-site", "aria-label": NAVIGATION, "aria-haspopup": "dialog", onclick: () => ouvrirLeSite() },
    el("span", { "aria-hidden": "true" }, SIGNE_DU_SITE),
  );
  const etatCourt = el("p", { classe: "combat-etat-court" });
  const raisonDIntervenir = el("span", { id: "combat-raison-intervenir", classe: "combat-raison", hidden: true });
  const intervenir = el(
    "button",
    { type: "button", classe: "bouton secondaire combat-intervenir", "aria-describedby": "combat-raison-intervenir", "aria-haspopup": "dialog", hidden: true, onclick: () => ouvrirIntervenir(intervenir) },
    `Intervenir${POINTS}`,
  );
  const raisonDIntervenirDuMenu = el("span", { id: "combat-raison-intervenir-menu", classe: "combat-raison", hidden: true });
  const intervenirDuMenu = el(
    "button",
    { type: "button", classe: "bouton secondaire combat-intervenir", "aria-describedby": "combat-raison-intervenir-menu", "aria-haspopup": "dialog", hidden: true, onclick: () => ouvrirIntervenir(intervenirDuMenu) },
    `Intervenir${POINTS}`,
  );
  const marqueMj = el("span", { classe: "combat-mj", hidden: true }, MARQUE_MJ);

  function ouvrirLeSite() {
    if (perimee()) return;
    menus.ouvrir("site", { ancre: boutonDuSite });
  }

  // « Intervenir… » (F1) : la feuille relit la barre à chaque rendu ; un
  // bouton inactif ne l'ouvre pas, sa raison se lit à côté de lui.
  function ouvrirIntervenir(bouton) {
    if (perimee() || inactif(bouton)) return;
    menus.ouvrir("intervenir", { ancre: bouton });
  }
  const raisonDeNouveau = el("span", { id: "combat-raison-nouveau", classe: "combat-raison", hidden: true });
  const nouveau = el("button", { type: "button", classe: "bouton secondaire", "aria-describedby": "combat-raison-nouveau", onclick: () => demanderUnNouveauCombat() }, "Nouveau combat");
  const effacer = el("button", { type: "button", classe: "bouton", onclick: () => effacerLeCombat() }, "Effacer");
  const annuler = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => finirLaQuestion(nouveau),
    },
    "Annuler",
  );
  // La confirmation se fait dans la page, à la place du bouton : le groupe
  // a la question pour nom, et un lecteur d'écran la dit en y entrant.
  const confirmation = el("div", { classe: "confirmation", role: "group", "aria-labelledby": "combat-question" }, el("p", { id: "combat-question" }, QUESTION), el("div", { classe: "boutons" }, effacer, annuler));

  // « Annuler le dernier geste » (compl. § 4.10) : caché avant le lancement,
  // inactif avec sa raison ; son clic pose sa question dans la page, comme
  // « Nouveau combat ».
  const raisonDAnnulation = el("span", { id: "combat-raison-annuler", classe: "combat-raison", hidden: true });
  const annulerLeGeste = el("button", {
    type: "button",
    classe: "bouton secondaire combat-annuler-geste",
    "aria-describedby": "combat-raison-annuler",
    hidden: true,
    onclick: () => demanderLAnnulation(),
  });
  const questionDAnnulation = el("p", { id: "combat-question-annuler" });
  const confirmerLAnnulation = el("button", { type: "button", classe: "bouton", onclick: () => annulerLeDernierGeste() });
  const garderLeGeste = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => finirLaQuestion(annulerLeGeste),
    },
  );
  const confirmationDAnnulation = el(
    "div",
    { classe: "confirmation", role: "group", "aria-labelledby": "combat-question-annuler" },
    questionDAnnulation,
    el("div", { classe: "boutons" }, confirmerLAnnulation, garderLeGeste),
  );

  const autres = el("div", { id: "combat-autres", classe: "combat-autres" });
  const plus = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire combat-plus-bouton",
      "aria-label": "Autres commandes",
      onclick: () => ouvrirMenuDuCombat(),
    },
    "⋯",
  );

  /**
   * « ⋯ » : au téléphone, la feuille du combat (F13 : le Mode MJ,
   * « Intervenir… » au tour des PJ, « Fiches », « Journal », « Nouveau
   * combat ») ; sur PC, où la feuille de style le cache, la rangée des autres
   * commandes s'ouvre et se ferme.
   */
  function ouvrirMenuDuCombat() {
    if (perimee()) return;
    if (estEtroit()) {
      menus.ouvrir("combat", { ancre: plus, apres: () => rendreLeMenu() });
      rendreLeMenu();
      return;
    }
    menuOuvert = !menuOuvert;
    rendreLeMenu();
  }
  // À l'approche du plafond des événements, une phrase sous la barre ;
  // cachée quand elle est vide.
  const limite = el("p", { classe: "combat-limite", hidden: true });
  const aide = el("p", { classe: "combat-aide" });
  const zoneDAvis = el("div", { classe: "combat-avis", role: "alert" });
  const panneau = el("section", { classe: "combat-panneau", "aria-label": "Fiche complète" });
  // Le repère de la bulle et de son onglet, placés contre la case active.
  const cadre = el("div", { classe: "combat-cadre" });

  // « ⋯ » dit ce qu'il ouvre (vague 4, R2 n° 15) : au téléphone, un
  // dialogue (la feuille du combat), sans rien qu'il développe ; sur PC, la
  // rangée des autres commandes, qu'il développe ou replie.
  function rendreLeMenu() {
    const ouvert = menuOuvert || question !== null;
    const classe = ouvert ? "combat-autres ouvert" : "combat-autres";
    if (autres.className !== classe) autres.className = classe;
    const etroit = estEtroit();
    const attributs = { "aria-haspopup": etroit ? "dialog" : null, "aria-controls": etroit ? null : "combat-autres", "aria-expanded": etroit ? null : String(ouvert) };
    for (const [nom, valeur] of Object.entries(attributs)) {
      if (valeur === null) plus.removeAttribute(nom);
      else if (plus.getAttribute(nom) !== valeur) plus.setAttribute(nom, valeur);
    }
    // « Intervenir… » n'y est que pendant le tour des PJ, quand la vue l'offre.
    const intervention = intervenirDuMenu.hidden ? [] : [intervenirDuMenu, raisonDIntervenirDuMenu];
    const contenu = question === "nouveau" ? [confirmation] : question === "annuler" ? [confirmationDAnnulation] : [annulerLeGeste, raisonDAnnulation, nouveau, raisonDeNouveau, ...intervention];
    if (autres.children.length !== contenu.length || contenu.some((noeud, rang) => autres.children[rang] !== noeud)) autres.replaceChildren(...contenu);
  }

  /**
   * La question de la barre se ferme (« Annuler », « Garder ») : sur PC, le
   * focus va au bouton qui l'avait posée. Au téléphone, où « ⋯ » ouvre la
   * feuille du combat, la rangée ne s'ouvre que pour une question et se
   * referme avec elle ; le focus revient à ce qui l'avait posée (le volet au
   * repos, ou « ⋯ »).
   */
  function finirLaQuestion(bouton) {
    question = null;
    const retour = retourDeLaQuestion;
    retourDeLaQuestion = null;
    if (estEtroit()) {
      menuOuvert = false;
      rendreLeMenu();
      (retour?.isConnected && retour !== bouton ? retour : plus).focus({ preventScroll: true });
      return;
    }
    rendreLeMenu();
    bouton.focus({ preventScroll: true });
  }

  function demanderUnNouveauCombat() {
    if (perimee() || inactif(nouveau)) return;
    retourDeLaQuestion = globalThis.document?.activeElement ?? null;
    // Sur un téléphone, le menu reste ouvert : « Annuler » y rend la main au
    // bouton, qui doit se voir.
    menuOuvert = true;
    question = "nouveau";
    rendreLeMenu();
    annuler.focus({ preventScroll: true });
  }

  function effacerLeCombat() {
    if (perimee()) return;
    question = null;
    // Le menu se referme avec la question : sur un téléphone, « Nouveau
    // combat » restait affiché sous la barre du combat neuf.
    menuOuvert = false;
    const issue = commander(() => seance.nouveau());
    if (issue.refus) avis = avisDuRefus(issue.refus.message);
    else {
      avis = null;
      cibleChoisie = null;
      caseOuverte = null;
      bulle.oublier();
      fermerLaFiche({ focus: false });
      oublierLeCombatMontre();
      lireLesPersonnages();
    }
    retourDeLaQuestion = null;
    rendreLeMenu();
    rendre({ parCommande: true });
    h1.focus({ preventScroll: true });
  }

  // La question se relit au moment du clic, jamais dans une vue d'avant ;
  // le focus va au choix sans risque, « Garder ».
  function demanderLAnnulation() {
    if (perimee() || inactif(annulerLeGeste)) return;
    const vue = vues.vueBarre(seance.etat()).annuler;
    if (!vue?.actif || !vue.question) return;
    retourDeLaQuestion = globalThis.document?.activeElement ?? null;
    menuOuvert = true;
    question = "annuler";
    rendreLaQuestion(vue.question);
    rendreLeMenu();
    garderLeGeste.focus({ preventScroll: true });
  }

  function rendreLaQuestion(vue) {
    poser(questionDAnnulation, vue.texte);
    poser(confirmerLAnnulation, vue.confirmer);
    poser(garderLeGeste, vue.garder);
  }

  // « Annuler le geste » : la commande de la vue, depuis la barre. Personne
  // n'est plus choisi : la bulle se ferme, ce que l'écran savait du geste
  // s'oublie, et le focus revient au bouton, sans défiler. Sur un téléphone,
  // « ⋯ » reste ouvert : le bouton s'y voit.
  function annulerLeDernierGeste() {
    if (perimee()) return;
    const vue = vues.vueBarre(seance.etat()).annuler;
    question = null;
    if (vue?.actif === true) {
      cibleChoisie = null;
      caseOuverte = null;
      bulle.oublier();
      sansBougerLeFocus(() => executer(vue.commande, "barre"));
    }
    finirLaQuestion(annulerLeGeste);
  }

  // « Intervenir… », dans la barre ou dans le menu : caché sans vue, sinon
  // actif ou inactif avec sa raison. Caché, sa raison se tait.
  function reglerIntervenir(bouton, raison, vue) {
    bouton.hidden = vue === null;
    if (vue === null) {
      reglerBouton(bouton, raison, true, null);
      return;
    }
    poser(bouton, vue.libelle ?? `Intervenir${POINTS}`);
    reglerBouton(bouton, raison, vue.actif === true, vue.raison ?? null);
  }

  function rendreLaBarre(vue, bloque) {
    poser(etatDuCombat, vue.etat);
    poser(etatCourt, vue.etatCourt ?? vue.etat);
    const classeCourte = vue.camp === "adv" ? "combat-etat-court danger" : "combat-etat-court";
    if (etatCourt.className !== classeCourte) etatCourt.className = classeCourte;
    poser(aide, vue.aide);
    marqueMj.hidden = !modeMj;
    // Quand on ne joue pas (un combat ouvert ailleurs), la séance refuserait
    // la fin du tour sans rien montrer : le bouton est inactif, et dit
    // pourquoi, par la phrase de la barre. « Intervenir… » ne s'y offre pas.
    const joue = bloque === null;
    const vueDIntervenir = joue ? (vue.intervenir ?? null) : null;
    reglerIntervenir(intervenir, raisonDIntervenir, vueDIntervenir?.place === "barre" ? vueDIntervenir : null);
    reglerIntervenir(intervenirDuMenu, raisonDIntervenirDuMenu, vueDIntervenir?.place === "menu" ? vueDIntervenir : null);
    const fin = vue.finDeTour;
    commandeDeFin = fin?.commande ?? null;
    // Au téléphone, pendant le tour adverse, « Intervenir… » prend sa place
    // dans la barre : « Fin de tour » est alors dans le volet au repos (A7).
    finDeTour.hidden = fin === null || (estEtroit() && !intervenir.hidden);
    reglerBouton(finDeTour, raisonDeFin, fin === null || (joue && fin.actif === true), joue ? (fin?.raison ?? null) : gardien.phrase());
    // Caché, il garde son état (le volet au repos le relit), mais sa raison se tait.
    if (finDeTour.hidden) raisonDeFin.hidden = true;
    // Un combat ouvert ailleurs se reprend, un combat plus récent ne
    // s'écrase pas : la séance refuserait le combat vide.
    const libre = bloque !== "ailleurs" && bloque !== "recent";
    reglerBouton(nouveau, raisonDeNouveau, libre, libre ? null : gardien.phrase());

    // « Annuler le dernier geste » : son signe, une espace, son libellé.
    const vueDAnnulation = vue.annuler ?? null;
    annulerLeGeste.hidden = vueDAnnulation === null;
    if (vueDAnnulation !== null && vueDAnnulation.libelle !== libelleDAnnulation) {
      libelleDAnnulation = vueDAnnulation.libelle;
      annulerLeGeste.replaceChildren(el("span", { classe: "combat-signe", "aria-hidden": "true" }, SIGNE_ANNULER), " ", sansSensForce(libelleDAnnulation));
    }
    reglerBouton(annulerLeGeste, raisonDAnnulation, vueDAnnulation === null || (joue && vueDAnnulation.actif === true), joue ? (vueDAnnulation?.raison ?? null) : gardien.phrase());
    // Une question ouverte se ferme quand il n'y a plus rien à annuler.
    if (question === "annuler") {
      if (joue && vueDAnnulation?.actif === true && vueDAnnulation.question) rendreLaQuestion(vueDAnnulation.question);
      else question = null;
    }
    rendreLeMenu();
  }

  // ——— La limite des événements ———

  /**
   * À 13 500 événements, la phrase de la vue sous la barre ; elle passe une
   * fois par la zone d'avis, pour ce combat-ci : la mémoire du combat retient
   * l'heure de lancement de celui pour lequel elle a été dite.
   */
  function rendreLaLimite(phrase, etat) {
    poser(limite, phrase ?? "");
    limite.hidden = phrase === null || phrase === undefined;
    if (limite.hidden || m.limiteDite === etat.lanceLe) return;
    m.limiteDite = etat.lanceLe;
    avis = avis === null ? { lignes: [phrase], bouton: null } : { ...avis, lignes: [...avis.lignes, phrase] };
  }

  // ——— L'enregistrement, et la zone d'avis ———

  const boutonDeGarde = (genre) => el("button", { type: "button", classe: "bouton", onclick: () => (genre === "reprendre" ? reprendre() : demanderUnNouveauCombat()) }, LIBELLES[genre]);

  const avisDeGarde = () => ({ lignes: [gardien.phrase()], bouton: GARDES_QUI_PREVIENNENT[gardien.etat()] ?? null });

  // Bloquée, la séance refuse tout par la phrase de la barre : l'avis garde
  // alors son bouton, et ne se redit pas.
  const avisDuRefus = (message) => (seance.bloque() !== null ? avisDeGarde() : { lignes: [message], bouton: null });

  /**
   * L'état de l'enregistrement : sa phrase reste dans la barre ; un état qui
   * prévient passe une fois par la zone d'avis, à son arrivée. « Une fois »
   * se compte sur le combat en mémoire, non sur la visite : revenir sur
   * l'écran ne le redit pas.
   */
  function rendreLaGarde() {
    const etatDeGarde = gardien.etat();
    poser(garde, gardien.phrase());
    if (etatDeGarde === m.gardeVue) return;
    m.gardeVue = etatDeGarde;
    if (Object.hasOwn(GARDES_QUI_PREVIENNENT, etatDeGarde)) avis = avisDeGarde();
  }

  function rendreAvis() {
    const texte = JSON.stringify(avis);
    if (texte === avisMontre) return;
    avisMontre = texte;
    zoneDAvis.replaceChildren(...(avis === null ? [] : [...avis.lignes.map((ligne) => el("p", {}, ligne)), avis.bouton ? boutonDeGarde(avis.bouton) : null].filter(Boolean)));
  }

  // Quand on ne joue pas (un combat ouvert ailleurs, gardé mais illisible,
  // ou d'une autre version), ce bloc prend la place de la zone sous la carte
  // et dit pourquoi, avec le bouton qui en sort. Pendant « Reprendre le combat
  // le plus récent », la phrase d'attente de l'ouverture remplace son bouton,
  // sans rôle : la région d'annonce des dés, déjà dans la page, reste la
  // seule région polie de l'écran (compl. § 4.1).
  const titreDuBlocage = el("h2", { classe: "combat-qui", tabindex: "-1" });
  const choixDuBlocage = el("div", { classe: "combat-choix" });
  const blocage = { noeud: el("section", { classe: "combat-action", "aria-label": "Combat arrêté" }, titreDuBlocage, choixDuBlocage) };

  function rendreLeBlocage(bloque) {
    const bouton = GARDES_QUI_PREVIENNENT[bloque] ?? null;
    const phrase = gardien.phrase();
    const signature = JSON.stringify([phrase, bouton, enReprise]);
    if (signature === blocageMontre) return;
    blocageMontre = signature;
    poser(titreDuBlocage, phrase);
    if (enReprise) choixDuBlocage.replaceChildren(el("p", { classe: "attente" }, ATTENTE));
    else choixDuBlocage.replaceChildren(...(bouton ? [boutonDeGarde(bouton)] : []));
  }

  async function reprendre() {
    if (perimee()) return;
    const depart = circuit;
    reprises += 1;
    const numero = reprises;
    enReprise = true;
    if (seance.bloque() !== null) rendreLeBlocage(seance.bloque());
    occupe += 1;
    let issue = null;
    try {
      ({ issue } = await seance.reprendre());
    } finally {
      occupe -= 1;
      if (numero === reprises) enReprise = false;
    }
    if (depart !== circuit || perimee() || !racine.isConnected) return;
    // Une reprise plus récente a pris la place de celle-ci : c'est elle qui
    // redessinera.
    if (issue === "abandonne") return;
    avis = null;
    cibleChoisie = null;
    caseOuverte = null;
    fermerLaFiche({ focus: false });
    oublierLeCombatMontre();
    // Le combat repris peut en être à sa préparation : elle s'ouvre, et lit
    // ses personnages.
    if (seance.etat().phase === "preparation") lireLesPersonnages();
    rendre({ parCommande: true });
  }

  function auChangementDeGarde() {
    if (perimee() || occupe > 0 || !racine.isConnected) return;
    rendreLaGarde();
    menus.rendre({ garde: garde.textContent });
    // Seul un blocage qui arrive ou qui cesse change autre chose que la
    // barre et l'avis : le reste de l'écran ne se recalcule pas à chaque
    // écriture.
    if (seance.bloque() !== bloqueRendu) rendre();
    else rendreAvis();
  }

  // ——— Les commandes des parties ———

  function apres(issue, suite = null) {
    if (issue?.refus) avis = avisDuRefus(issue.refus.message);
    else {
      avis = null;
      suite?.();
    }
    rendre({ parCommande: true });
  }

  function commander(faire) {
    occupe += 1;
    try {
      return faire();
    } finally {
      occupe -= 1;
    }
  }

  // L'écran se refait pendant l'appel, comme au groupe 1 : c'est là que la
  // bulle voit qu'elle s'est fermée, et met le focus au jeton. Une commande de
  // la palette acceptée la replie, son choix repart de zéro, et le focus
  // revient à ce qui l'avait ouverte (contrat de la vague 3, § 4.3).
  //
  // À la vague 4, au téléphone : « Jouer » dans les fiches en plein écran
  // (le seul « choisir » qu'elles offrent) ferme le plein écran, et le volet,
  // qui s'ouvre sur qui joue, prend le focus (R2 n° 7) ; « Terminer » qui
  // finit le geste referme le volet, même quand une action reste (mission,
  // § 3, A6 ; R2 n° 9). Sur PC, rien ne change. De même quand le geste
  // finit par « Laisser passer » ou par la blessure choisie (C3 ; le d20
  // aussi, dans lancerLeDe) ; pas par « Confirmer », qui rend la bulle à sa
  // liste (spéc. § 17.7).
  function executer(commande, origine = "panneau") {
    if (perimee()) return;
    const avant = origineDuMoment;
    origineDuMoment = origine;
    let repliee = null;
    const objet = commande !== null && typeof commande === "object";
    const jouerDepuisLesFiches = fichesEnPlein && objet && Object.hasOwn(commande, "choisir");
    const terminer = origine === "bulle" && estEtroit() && objet && FINS_DU_GESTE.has(commande.evenement?.type) && gesteEnCours(seance.etat()) !== null;
    const secours = menus.ouvert() === "palette" ? menus.secours() : null;
    try {
      const issue = commander(() => seance.executer(commande));
      if (!issue?.refus && origine === "palette" && paletteOuverte !== null) {
        repliee = paletteOuverte;
        paletteOuverte = null;
      }
      if (!issue?.refus && jouerDepuisLesFiches) menus.fermer({ focus: false });
      if (!issue?.refus && terminer && gesteEnCours(seance.etat()) === null && seance.choisi() !== null) commander(() => seance.executer({ choisir: null }));
      apres(issue, () => {
        // D'où vient la cible : ni l'événement ni l'état ne le disent.
        const evenement = commande?.evenement;
        if (evenement?.type !== "regler" || evenement.champ !== "cible") return;
        const geste = gesteEnCours(seance.etat());
        cibleChoisie = geste === null ? null : { numero: geste.numero, cible: evenement.valeur, origine: origine === "plateau" ? "plateau" : "panneau" };
      });
    } finally {
      origineDuMoment = avant;
    }
    if (repliee !== null && !repliee.parDefaut && immobile === 0) rendreLeFocusDeLaPalette(repliee.ancre, secours);
  }

  /**
   * Le dé que le moteur attend. Autour du lancer, l'écran retient l'état
   * d'avant et l'événement du dé (la source de dés, enveloppée le temps de
   * l'appel), puis montre le dé une seconde sur la carte (vueDuDe). Au
   * téléphone, le dé du volet (origine « bulle ») qui finit le geste (la
   * face de contre-attaque quand nul ne peut contre-attaquer) referme le
   * volet, comme « Terminer » (vague 4, C3).
   */
  function lancerLeDe(origine = "panneau") {
    if (perimee()) return;
    const avant = seance.etat();
    const fermerLeVolet = origine === "bulle" && estEtroit() && gesteEnCours(avant) !== null;
    const duMoment = servicesDuMoment;
    const source = duMoment.des;
    let tire = null;
    duMoment.des = {
      lancer: (faces, combien) => {
        const valeurs = source.lancer(faces, combien);
        tire = { type: "de", faces, valeurs };
        return valeurs;
      },
    };
    let issue = null;
    try {
      issue = commander(() => seance.lancerLeDe());
    } finally {
      duMoment.des = source;
    }
    if (!issue?.refus && fermerLeVolet && gesteEnCours(seance.etat()) === null && seance.choisi() !== null) commander(() => seance.executer({ choisir: null }));
    apres(issue);
    if (!issue?.refus && tire !== null && !perimee()) montrerLeDe(vues.vueDuDe(avant, tire));
  }

  function lancer() {
    if (perimee()) return;
    apres(commander(() => seance.lancer()));
  }

  const refuser = (message) => apres({ refus: { message } });

  function ajouterPersonnage(cle) {
    if (perimee()) return;
    const trouve = m.disponibles?.lu.personnages.find(({ personnage }) => personnage?.id === cle) ?? null;
    if (trouve === null) return refuser(PERSONNAGE_ILLISIBLE);
    const { photo, refus } = photographier(() => photographierPersonnage(banque, trouve.personnage, { index: resolution().index, roles: outils.roles }), PERSONNAGE_ILLISIBLE);
    if (refus) return refuser(refus);
    return apres(commander(() => seance.preparer({ type: "ajouter_personnage", photo })));
  }

  const photoDeLAdversaire = (nom) => photographier(() => photographierAdversaire(resolution(), nom, { banque, roles: outils.roles }), ADVERSAIRE_ILLISIBLE);

  function ajouterAdversaires(nom, nombre) {
    if (perimee()) return;
    const { photo, refus } = photoDeLAdversaire(nom);
    if (refus) return refuser(refus);
    // La partie borne déjà le nombre ; la préparation refuse le reste. Au-delà
    // du plafond, une photographie de plus suffit à le lui faire dire.
    const combien = Number.isInteger(nombre) && nombre >= 1 ? Math.min(nombre, PLAFOND_ADVERSAIRES + 1) : 0;
    // Chaque exemplaire a sa photographie : la séance garde la copie de chacune.
    return apres(commander(() => seance.preparer({ type: "ajouter_adversaires", photos: Array.from({ length: combien }, () => photo) })));
  }

  // La rencontre se pose d'un seul ordre, tout ou rien pour les plafonds ;
  // un adversaire qui ne s'ajoute pas est laissé, et l'écran dit lequel.
  function placerRencontre() {
    if (perimee()) return;
    const photos = [];
    const laisses = [];
    for (const { nom, nombre } of rencontre.rencontrePreparee(banque)) {
      const { photo, refus } = photoDeLAdversaire(nom);
      if (refus) laisses.push(`${nom} ${HORS_DU_COMBAT} ${refus}`);
      else for (let exemplaire = 0; exemplaire < nombre; exemplaire += 1) photos.push(photo);
    }
    apres(
      commander(() => seance.preparer({ type: "ajouter_adversaires", photos })),
      () => {
        if (laisses.length > 0) avis = { lignes: laisses, bouton: null };
      },
    );
  }

  // ——— La préparation : ce que l'écran apporte de la banque et de l'appareil ———

  // Un seul appel par ouverture de la préparation. La liste d'avant reste
  // montrée pendant la lecture ; sans liste, la préparation dit l'attente.
  function lireLesPersonnages() {
    const depart = circuit;
    m.lecture += 1;
    const numero = m.lecture;
    const { etagere, depot } = contexte.etat;
    personnagesDisponibles({ etagere, depot })
      .then((lu) => {
        if (depart !== circuit || memoire !== m || numero !== m.lecture) return;
        m.disponibles = { lu, banque: null, options: [] };
        if (!perimee() && racine.isConnected) rendre();
      })
      .catch(() => {});
  }

  // Qui s'ajoute, et sinon pourquoi : chaque personnage lu est photographié
  // une fois par banque, non à chaque rendu.
  function optionsDesPersonnages() {
    const lus = m.disponibles;
    if (lus === null) return null;
    if (lus.banque !== banque) {
      lus.banque = banque;
      lus.options = lus.lu.personnages.map(({ personnage, source }) => {
        const { photo, refus } = photographier(() => photographierPersonnage(banque, personnage, { index: resolution().index, roles: outils.roles }), PERSONNAGE_ILLISIBLE);
        return { cle: personnage?.id, nom: photo?.valeurs.nom ?? nomDe(personnage), source, refus: refus ?? null };
      });
    }
    return lus.options;
  }

  function adversairesDeLaBanque() {
    outils.adversaires ??= listeDe(banque, "adversaires").map(({ nom }) => ({ nom, refus: photoDeLAdversaire(nom).refus ?? null }));
    return outils.adversaires;
  }

  const apports = () => ({
    personnages: optionsDesPersonnages(),
    phrases: m.disponibles?.lu.phrases ?? [],
    adversaires: adversairesDeLaBanque(),
    rencontre: rencontre.rencontrePreparee(banque),
    absents: ecrireAbsents(outils.roles.absents),
  });

  /**
   * « Ajouter le personnage de démonstration » (compl. § 5.1), dans la
   * préparation : le fichier se lit comme sur l'écran Personnages, puis
   * l'appareil le garde. Sa question s'ouvre dans la zone que la préparation
   * lui donne, sans faire défiler la page. Gardé, sa phrase se dit sous le
   * bouton et la liste des personnages se relit ; il n'entre pas au combat :
   * on l'y ajoute comme les autres.
   */
  async function ajouterLaDemonstration(zone) {
    if (perimee() || !enDemonstration) return;
    const depart = circuit;
    const enCours = () => depart === circuit && !perimee() && racine.isConnected;
    const lu = await lirePersonnageDeDemonstration("demo", { fetch: services.fetch });
    if (!enCours()) return;
    if (lu.erreur) {
      avis = { lignes: [lu.erreur], bouton: null };
      rendreAvis();
      return;
    }
    let gardePar = null;
    try {
      gardePar = await garderRecu(contexte.etat.etagere, lu.personnage, zone, { sansDefiler: true });
    } catch (erreur) {
      if (!enCours()) return;
      avis = { lignes: [`${PAS_GARDE} : ${erreur?.message ?? String(erreur)}`], bouton: null };
      rendreAvis();
      return;
    }
    if (!enCours() || gardePar === null) return;
    phraseDeDemonstration = phraseDuPersonnageGarde(gardePar);
    rendre();
    lireLesPersonnages();
  }

  // ——— La liste d'une case (« +k ») ———

  // Les cases de la carte ne changent jamais de nœud : elles se trouvent une
  // fois par leur nom.
  let casesParNom = null;
  const noeudDeLaCase = (nomDeCase) => {
    casesParNom ??= new Map([...plateau.noeud.querySelectorAll(".combat-case")].map((noeud) => [noeud.getAttribute("data-case"), noeud]));
    return casesParNom.get(nomDeCase) ?? null;
  };

  const estEtroit = () => services.media(ETROIT) === true;

  // Des deux « +k » d'une case, la feuille de style n'en montre qu'un,
  // selon la largeur : le focus va à celui qui se voit.
  function focusSurLaCase(nomDeCase) {
    const noeud = noeudDeLaCase(nomDeCase);
    if (noeud === null) return;
    const classe = estEtroit() ? ".combat-plus-etroit" : ".combat-plus-large";
    (noeud.querySelector("[aria-pressed=true]") ?? noeud.querySelector(classe) ?? noeud.querySelector(".combat-case-plus") ?? noeud.querySelector("button"))?.focus({ preventScroll: true });
  }

  const vueDuPlateau = () => vues.vuePlateau(seance.etat(), seance.choisi());

  /** Le jeton d'un protagoniste sur la carte, s'il se voit à cette largeur ; sinon null. */
  function jetonDe(id, vue = vueDuPlateau()) {
    if (id === null || id === undefined || !Object.hasOwn(vue.jetons, id)) return { jeton: null, nomDeCase: null };
    const nomDeCase = Object.keys(vue.cases).find((nom) => vue.cases[nom].jetons.includes(id)) ?? null;
    const laCase = nomDeCase === null ? null : noeudDeLaCase(nomDeCase);
    if (laCase === null) return { jeton: null, nomDeCase };
    // Le jeton porte le nom accessible que la vue lui donne.
    const nom = sansSensForce(vue.jetons[id].nom);
    const montres = [...laCase.querySelectorAll(".combat-jeton")];
    const rang = montres.findIndex((noeud) => noeud.getAttribute("aria-label") === nom);
    return { jeton: rang >= 0 && rang < (estEtroit() ? MONTRES_ETROIT : MONTRES) ? montres[rang] : null, nomDeCase };
  }

  /** Le focus au jeton d'un protagoniste ; s'il ne se voit pas, au « +k » de sa case. */
  function focusSurLeJeton(id) {
    if (perimee() || id === null || id === undefined) return;
    const { jeton, nomDeCase } = jetonDe(id);
    if (jeton !== null) jeton.focus({ preventScroll: true });
    else if (nomDeCase !== null) focusSurLaCase(nomDeCase);
  }

  /**
   * Où se pose la liste d'une case : sous la préparation avant le lancement ;
   * pendant le combat, dans la bulle sur un grand écran, quand elle peut la
   * montrer (quelqu'un agit, ou l'on choisit qui joue) ; sinon dans la zone
   * sous la carte, qui la garde sur un téléphone.
   */
  function lieuDeLaListe(vue, etroit) {
    if (montree === preparation) return preparation.listeDeCase;
    if (montree !== action) return null;
    if (!etroit && (vue.genre === "action" || vue.genre === "qui_joue")) return bulle.listeDeCase;
    return action.listeDeCase;
  }

  const lieuDuMoment = () => lieuDeLaListe(vues.vuePanneau(seance.etat(), seance.choisi()), estEtroit());

  // La liste se ferme par son bouton « Fermer », par la croix de la bulle,
  // par Échap ou par un clic au-dehors. Dans la bulle, celle-ci rend ce
  // qu'elle montrait avant, ou se ferme si elle ne s'était ouverte que pour
  // elle ; le focus va à la commande qui attend, ou au « +k ». Après un clic
  // au-dehors, il reste où il est.
  function fermerLaListe(nomDeCase) {
    if (perimee() || nomDeCase === null || nomDeCase === undefined) return;
    const dansLaBulle = lieuDuMoment() === bulle.listeDeCase;
    caseOuverte = null;
    if (dansLaBulle) {
      rendre();
      if (immobile > 0) return;
      if (bulleMontree) bulle.focaliser();
      else focusSurLaCase(nomDeCase);
      return;
    }
    rendreLaListe(vueDuPlateau(), lieuDuMoment());
    if (immobile === 0) focusSurLaCase(nomDeCase);
  }

  // Le choix fait dans la liste est un choix du panneau : « choisie ici ».
  // La commande se relit au moment du clic, jamais dans une vue d'avant.
  function choisirDansLaListe(id, nomDeCase) {
    if (perimee()) return;
    const vue = vueDuPlateau();
    const jeton = Object.hasOwn(vue.jetons, id) ? vue.jetons[id] : null;
    if (jeton === null) return;
    if (vue.phase === "preparation") {
      // Avant le lancement, le jeton est pris en main : il se pose ensuite
      // sur la carte.
      caseOuverte = null;
      plateau.prendre(id);
      rendreLaListe(vue, lieuDuMoment());
      focusSurLaCase(nomDeCase);
      return;
    }
    if (jeton.choix === null || jeton.inactif === true) return;
    caseOuverte = null;
    executer(jeton.choix.commande, "panneau");
  }

  function rendreLaListe(vue, cible) {
    const presents = caseOuverte !== null && Object.hasOwn(vue.cases, caseOuverte) ? vue.cases[caseOuverte].jetons.filter((id) => Object.hasOwn(vue.jetons, id)) : [];
    // Les morts viennent en dernier, comme sur la carte : on ouvre la liste
    // pour choisir, et un mort ne se choisit pas.
    const dansLaCase = [...presents.filter((id) => vue.jetons[id].mort !== true), ...presents.filter((id) => vue.jetons[id].mort === true)];
    if (cible === null || dansLaCase.length === 0) caseOuverte = null;
    const avant = vue.phase === "preparation";
    const decrits =
      caseOuverte === null
        ? []
        : dansLaCase.map((id) => {
            const jeton = vue.jetons[id];
            return { id, entier: jeton.entier, nom: jeton.nom, actif: avant || (jeton.choix !== null && jeton.inactif !== true), tenu: avant ? plateau.enMain() === id : null };
          });
    const lieu = cible === bulle.listeDeCase ? "bulle" : cible === action.listeDeCase ? "zone" : "preparation";
    const signature = JSON.stringify([caseOuverte, lieu, decrits]);
    if (signature === listeMontree) return;
    listeMontree = signature;
    for (const noeud of [bulle.listeDeCase, action.listeDeCase, preparation.listeDeCase]) if (noeud.children.length > 0) noeud.replaceChildren();
    if (caseOuverte === null) return;
    const nomDeCase = caseOuverte;
    cible.replaceChildren(
      el("h3", { tabindex: "-1" }, `Case ${nomDeCase}`),
      ...decrits.map((jeton) =>
        el(
          "button",
          {
            type: "button",
            "aria-label": sansSensForce(jeton.nom),
            "aria-disabled": jeton.actif ? null : "true",
            "aria-pressed": jeton.tenu === null ? null : String(jeton.tenu),
            onclick: () => choisirDansLaListe(jeton.id, nomDeCase),
          },
          jeton.entier,
        ),
      ),
      el("button", { type: "button", classe: "bouton secondaire", onclick: () => fermerLaListe(nomDeCase) }, "Fermer"),
    );
  }

  // « +k » : la liste de la case. Dans la bulle, elle s'ouvre (ou prend la
  // place de ce qu'elle montrait) et reçoit le focus une fois placée.
  function ouvrirCase(nomDeCase) {
    if (perimee()) return;
    const lieu = lieuDuMoment();
    if (lieu === null) return;
    caseOuverte = nomDeCase;
    if (lieu === bulle.listeDeCase) {
      rendre();
      if (bulleMontree) bulle.focaliser();
      return;
    }
    rendreLaListe(vueDuPlateau(), lieu);
    lieu.querySelector("h3")?.focus({ preventScroll: true });
  }

  // ——— « Fiche complète » ———

  const ficheVivante = (id) => [...fiches.noeud.querySelectorAll("details")].find((noeud) => noeud.getAttribute("data-id") === id) ?? null;

  // La fiche se calcule depuis la photographie, avec la banque ouverte : le
  // personnage tel qu'il a été lu ; pour un adversaire, sa ligne et celles de
  // ses types, posées dans une banque d'appoint. Cette banque d'appoint ne
  // passe jamais par l'écran Rencontre, qui viderait sa composition.
  function contenuDeLaFiche(protagoniste) {
    const { photo } = protagoniste;
    const source = photo.source;
    if (source === null || typeof source !== "object") return [el("p", { classe: "message" }, FICHE_INDISPONIBLE)];
    const changee = (photo.publiee_le ?? null) !== (banque.publiee_le ?? null) ? el("p", { classe: "message" }, BANQUE_CHANGEE) : null;
    try {
      if (photo.camp === "pj") return [changee, lecture(calculerFiche(banque, source.personnage, { index: resolution().index }))].filter(Boolean);
      const appoint = indexerAdversaires({ ...banque, adversaires: [source.ligne], types_adversaires: source.types }, resolution().index);
      const cartes = rencontre.cadreDeCartes();
      cartes.montrer([{ resolu: appoint.resoudre(appoint.adversaires.get(source.ligne.nom)), numero: seance.etat().noms?.[protagoniste.id]?.exemplaire ?? null }]);
      // L'échelle de la carte se mesure sur la largeur de ce qui la contient,
      // remplissage compris : dans le panneau lui-même, qui en a un, elle
      // dépassait son cadre de 16 px sur un téléphone. Un nœud sans
      // remplissage lui donne la largeur vraiment disponible.
      return [changee, el("div", {}, cartes.noeud)].filter(Boolean);
    } catch {
      return [el("p", { classe: "message" }, FICHE_INDISPONIBLE)];
    }
  }

  function fermerLaFiche({ focus = true } = {}) {
    const id = ficheOuverte;
    ficheOuverte = null;
    if (panneau.children.length > 0) panneau.replaceChildren();
    if (!focus || id === null) return;
    // La fiche vivante a pu être refaite entre-temps : son bouton se cherche
    // maintenant. Repliée, c'est son en-tête qui reçoit le focus.
    const fiche = ficheVivante(id);
    if (fiche === null) return;
    (fiche.hasAttribute("open") ? fiche.querySelector("[data-repere=fiche-complete]") : fiche.querySelector("summary"))?.focus({ preventScroll: true });
  }

  // Au téléphone (vague 4, R2 n° 2), la fiche complète s'ouvre en plein
  // écran, à la place de ce qui y était (les fiches) : jamais dans la page,
  // qui ne défile plus pendant un tour (mission, § 3). ✕ ou Échap la ferment,
  // et le focus revient à ce qui avait ouvert les fiches.
  function ouvrirFiche(id) {
    if (perimee()) return;
    const protagoniste = seance.miseEnPlace().protagonistes.find((un) => un.id === id) ?? null;
    if (protagoniste === null) return;
    const nom = seance.etat().noms?.[id]?.entier ?? protagoniste.photo.valeurs.nom;
    if (estEtroit()) {
      fermerLaFiche({ focus: false });
      menus.ouvrir("fiches", { titre: `Fiche complète : ${nom}`, contenu: contenuDeLaFiche(protagoniste) });
      return;
    }
    ficheOuverte = id;
    const tete = el("h2", { tabindex: "-1" }, `Fiche complète : ${nom}`);
    panneau.replaceChildren(tete, el("div", { classe: "boutons" }, el("button", { type: "button", classe: "bouton secondaire", onclick: () => fermerLaFiche() }, "Fermer")), ...contenuDeLaFiche(protagoniste));
    tete.focus({ preventScroll: true });
  }

  /**
   * « Fiche » (le volet), « Fiches » (le volet au repos, ⋯) : au téléphone,
   * les fiches s'ouvrent en plein écran, par-dessus le combat (A8), et le
   * focus va à la fiche demandée ; sur PC, où elles sont dans la page, le
   * focus va à celle-ci, sans faire défiler.
   */
  function ouvrirFiches(id = null) {
    if (perimee()) return;
    if (estEtroit()) {
      fichesEnPlein = true;
      menus.ouvrir("fiches", {
        titre: "Fiches",
        contenu: [fiches.noeud],
        apres: () => {
          fichesEnPlein = false;
          if (!perimee()) cadre.append(fiches.noeud);
        },
      });
    }
    const fiche = id === null ? null : ficheVivante(id);
    fiche?.querySelector("summary")?.focus({ preventScroll: true });
  }

  // ——— Le journal, et le bandeau « Dernier événement » ———

  const zoneDeCopie = el("div", { classe: "combat-copie" });
  const boutonCopier = el("button", { type: "button", classe: "bouton secondaire", onclick: () => copier() }, "Copier");
  const boutonTelecharger = el("button", { type: "button", classe: "bouton secondaire", onclick: () => telechargerLeJournal() }, "Télécharger");
  // Le titre reçoit le focus quand on demande le journal (« Journal ↓ »),
  // sans entrer dans l'ordre du clavier.
  const titreDuJournal = el("h2", { id: "combat-journal-titre", tabindex: "-1" }, "Journal");
  // La liste des lignes : elle pose les lignes neuves, barre celles d'un geste
  // annulé, et défile en elle-même jusqu'à la dernière ; à l'écran, les 500
  // dernières, puis « Lignes précédentes » (mission du lot 4.3, § 6).
  const liste = creerListe({ vueJournal: vues.vueJournal, parPage: 500 });
  // « Lignes précédentes » : 500 lignes de plus, au-dessus de celles
  // montrées ; caché tant qu'aucune ligne ne précède celles-là.
  const boutonPrecedentes = el("button", { type: "button", classe: "bouton secondaire combat-precedentes", hidden: true, onclick: () => lignesPrecedentes() }, "Lignes précédentes");
  const teteDuJournal = el("div", { classe: "combat-journal-tete" }, titreDuJournal, boutonCopier, boutonTelecharger);
  // Une région que son titre nomme : sans nom, une section n'en est pas une.
  const journal = el("section", { classe: "combat-journal", "aria-labelledby": "combat-journal-titre" }, teteDuJournal, boutonPrecedentes, liste.noeud, zoneDeCopie);

  /**
   * « Lignes précédentes » : la liste pose au-dessus les 500 lignes qui
   * précèdent, la ligne lue gardée à sa place. Quand plus rien ne les
   * précède, le bouton se cache, et le focus, qu'il avait, va à la liste.
   */
  function lignesPrecedentes() {
    if (perimee()) return;
    const { restantes } = liste.precedentes();
    boutonPrecedentes.hidden = restantes === 0;
    if (restantes === 0) liste.noeud.focus({ preventScroll: true });
  }

  /**
   * Fait voir le journal, à la demande (« Journal ↓ », ou un clic à la souris
   * sur le bandeau) : sur PC, le seul défilement de la page que l'écran
   * fasse, puis le focus sur son titre, sans défiler de nouveau. Au
   * téléphone, où la page ne défile plus, le journal s'ouvre en plein écran
   * (contrat de la vague 3, D4).
   */
  function montrerLeJournal() {
    if (perimee()) return;
    if (estEtroit()) return ouvrirLeJournalEnPlein();
    journal.scrollIntoView({ block: "start" });
    titreDuJournal.focus({ preventScroll: true });
  }

  /**
   * Le journal en plein écran (A8) : la liste, la zone de copie, « Copier »
   * et « Télécharger » remontés dans sa tête, prêtés le temps de
   * l'ouverture ; ✕ ou Échap les rendent à la page. Cachée dans la page, la
   * liste n'avait pas de hauteur : montrée, elle descend à sa dernière ligne
   * (vague 4, W1 n° 6, R2 n° 10).
   */
  function ouvrirLeJournalEnPlein() {
    menus.ouvrir("journal", {
      titre: "Journal",
      outils: [boutonCopier, boutonTelecharger],
      contenu: [boutonPrecedentes, liste.noeud, zoneDeCopie],
      apres: () => {
        teteDuJournal.append(boutonCopier, boutonTelecharger);
        journal.append(boutonPrecedentes, liste.noeud, zoneDeCopie);
      },
    });
    liste.allerALaFin();
  }

  /** « Journal » (le volet au repos, ⋯) : comme « Journal ↓ ». */
  function ouvrirJournal() {
    montrerLeJournal();
  }

  const bandeau = creerBandeau({ montrerLeJournal, tient: services.tient, surveiller: services.surveiller });

  // Le texte qui sort de l'écran perd les signes qui commandent le sens de
  // l'écriture, d'un seul geste, sur le texte entier : le journal du combat,
  // lui, garde les noms tels qu'écrits.
  const texteASortir = (finDeLigne) => sansSensForce(texteDuJournal(seance.etat(), finDeLigne));

  function rendreLaZoneDeCopie(lance) {
    const signature = lance ? JSON.stringify(retourDeCopie) : "vide";
    if (signature === copieMontree) return null;
    copieMontree = signature;
    if (!lance) {
      zoneDeCopie.replaceChildren(el("p", { id: "combat-raison-journal", classe: "secondaire-texte petit" }, JOURNAL_VIDE));
      return null;
    }
    if (retourDeCopie === null) {
      zoneDeCopie.replaceChildren();
      return null;
    }
    if (retourDeCopie === "faite") {
      zoneDeCopie.replaceChildren(el("p", { classe: "secondaire-texte petit" }, COPIE_FAITE));
      return null;
    }
    const champ = el("textarea", { classe: "champ", readonly: true, rows: "8", "aria-label": "Texte du journal", "aria-describedby": "combat-copie-refusee" });
    // La valeur d'un champ ne se pose qu'une fois le champ créé.
    champ.value = retourDeCopie.texte;
    zoneDeCopie.replaceChildren(el("p", { id: "combat-copie-refusee", classe: "secondaire-texte petit" }, COPIE_REFUSEE), champ);
    return champ;
  }

  async function copier() {
    if (perimee() || inactif(boutonCopier)) return;
    const texte = texteASortir("\n");
    let faite = false;
    try {
      const pressePapiers = services.navigateur?.clipboard;
      if (typeof pressePapiers?.writeText === "function") {
        await pressePapiers.writeText(texte);
        faite = true;
      }
    } catch {
      // le navigateur refuse (permission, page non sûre) : le champ de repli
    }
    if (perimee() || !racine.isConnected) return;
    retourDeCopie = faite ? "faite" : { texte };
    const champ = rendreLaZoneDeCopie(true);
    // Le focus reste sur « Copier » : la phrase montrée se dit aussi, par la
    // seule région polie de l'écran. Le dé suivant la remplace.
    if (faite) action.dire(COPIE_FAITE);
    if (champ === null) return;
    champ.focus({ preventScroll: true });
    champ.select();
  }

  function telechargerLeJournal() {
    if (perimee() || inactif(boutonTelecharger)) return;
    services.telecharger(nomDuFichier(seance.etat().lanceLe), `${MARQUE_D_ORDRE}${texteASortir("\r\n")}`, TYPE_DU_FICHIER);
  }

  function rendreLeJournal(etat) {
    // Les lignes déjà posées restent ; seules les nouvelles s'ajoutent. Un
    // autre journal (un combat neuf, un combat repris) se repose en entier.
    if (!journalEnAttente) {
      const { ajoutees, reposee, restantes } = liste.rendre(etat);
      boutonPrecedentes.hidden = restantes === 0;
      // Un texte montré pour une copie à la main ne suit pas le journal : il
      // s'efface dès qu'une ligne s'ajoute.
      if (ajoutees > 0 || reposee) retourDeCopie = null;
    }
    // Sans heure de lancement, ni en-tête ni nom de fichier ne s'écrivent.
    const lance = etat.lanceLe !== null;
    for (const bouton of [boutonCopier, boutonTelecharger]) {
      if (lance) {
        bouton.removeAttribute("aria-disabled");
        bouton.removeAttribute("aria-describedby");
      } else {
        bouton.setAttribute("aria-disabled", "true");
        bouton.setAttribute("aria-describedby", "combat-raison-journal");
      }
    }
    rendreLaZoneDeCopie(lance);
  }

  // ——— La bulle : le clic au-dehors, Échap ———

  // Un clic hors de la bulle, de son onglet et de la carte la ferme (avant
  // le premier dé) ou la réduit (après) ; le focus reste où il est. Le clic
  // se voit en capture, avant que ce qu'il touche ait agi : l'élément
  // inactif qu'il touche est retenu d'abord, car fermer la bulle redessine
  // la barre, et peut rendre actif un bouton qui ne l'était pas au clic.
  function auClicDansLaPage(evenement) {
    if (perimee()) return;
    // Le clic qui suit l'appui long n'atteint pas ce qu'il touche.
    if (clicAAvaler) {
      clicAAvaler = false;
      evenement?.preventDefault?.();
      evenement?.stopPropagation?.();
      return;
    }
    inactifAuClic = ancetreInactif(evenement?.target ?? null);
    if (!bulleMontree) return;
    const cible = evenement?.target ?? null;
    // Une feuille, un menu ou un plein écran est par-dessus le combat : un
    // clic en eux n'est pas un clic au-dehors de la bulle. Au téléphone, où
    // le volet porte tout le geste, la liste d'une case (« +k ») reste sous
    // la carte : y choisir une cible n'est pas non plus un clic au-dehors.
    if (cible !== null && (menus.noeud.contains(cible) || action.listeDeCase.contains(cible))) return;
    if (!bulle.dehors(cible) || plateau.noeud.contains(cible)) return;
    sansBougerLeFocus(() => bulle.auDehors());
  }

  /** Vrai si le nœud est l'un des « +k » de cette case. */
  const estUnPlusDe = (noeud, nomDeCase) => noeud !== null && nomDeCase !== null && [...(noeudDeLaCase(nomDeCase)?.querySelectorAll(".combat-case-plus") ?? [])].includes(noeud);

  // Échap ferme d'abord l'infobulle ouverte, de la zone ou de la bulle, où
  // que soit le focus, sans le bouger (compl. § 4.1 ; WCAG 1.4.13) ; sinon,
  // la bulle montrée et le focus en elle, sur son jeton ou sur le « +k » qui
  // en tient lieu (celui de la case du protagoniste quand son jeton ne se
  // voit pas, celui de la case dont la liste est ouverte), la bulle se ferme
  // ou se réduit, et le focus va au jeton (au « +k » pour la liste d'une
  // case). Sinon, Échap n'est pas pris.
  //
  // À la vague 3, avant tout cela : une feuille, un menu ou un plein écran
  // ouvert se ferme (la palette, par fermerLaPalette, qui rend le focus à ce
  // qui l'avait ouverte) ; puis une case demandée à la carte ne l'est plus.
  function auClavier(evenement) {
    if (evenement?.key !== "Escape" || perimee() || evenement.defaultPrevented === true) return;
    // La case que la palette d'une feuille demande : Échap y met fin, et la
    // feuille effacée revient (vague 4, C2).
    if (caseDeLaPalette !== null) {
      evenement.preventDefault?.();
      const reprise = caseDeLaPalette;
      finirLaDemande();
      reprendreLaPalette(reprise);
      return;
    }
    if (menus.ouvert() !== null) {
      evenement.preventDefault?.();
      if (menus.ouvert() === "palette") fermerLaPalette();
      else menus.fermer();
      return;
    }
    if (demandeEnCours) {
      evenement.preventDefault?.();
      demandeEnCours = false;
      caseDeLaBulle = false;
      plateau.finirLaDemande();
      return;
    }
    if (infobullesDeLaZone.fermer() || (bulleMontree && bulle.fermerLInfobulle())) {
      evenement.preventDefault?.();
      return;
    }
    if (!bulleMontree) return;
    const actif = globalThis.document?.activeElement ?? null;
    const qui = protagonisteMontre;
    const laCase = lieuDuMoment() === bulle.listeDeCase ? caseOuverte : null;
    const { jeton: sonJeton, nomDeCase: saCase } = jetonDe(qui);
    const surSonJeton = actif !== null && sonJeton !== null && actif === sonJeton;
    const surUnPlus = estUnPlusDe(actif, laCase) || (sonJeton === null && estUnPlusDe(actif, saCase));
    if (!surSonJeton && !surUnPlus && !bulle.noeud.contains(actif)) return;
    const issue = sansBougerLeFocus(() => bulle.echap());
    if (issue === null) return;
    evenement.preventDefault?.();
    if (issue === "infobulle") return;
    if (laCase !== null) focusSurLaCase(laCase);
    else focusSurLeJeton(qui);
  }

  // La largeur de la fenêtre a changé : le téléphone se juge à elle.
  function rafraichir() {
    if (!perimee() && racine.isConnected) rendre();
  }

  // ——— Le Mode MJ ———

  // Sur PC, dans l'en-tête de la carte (E1) : la ligne du clic droit, que
  // seul le Mode MJ allumé montre, l'interrupteur, et « MJ » quand il l'est.
  const aideDuClicDroit = el("span", { hidden: true }, CLIC_DROIT);
  const interrupteurMj = el("button", { type: "button", role: "switch", classe: "bouton secondaire combat-interrupteur", "aria-checked": String(modeMj), onclick: () => basculerLeModeMj() }, MODE_MJ);
  const marqueMjDeLaCarte = el("span", { classe: "combat-mj", hidden: true }, MARQUE_MJ);

  function rendreLeModeMj() {
    if (interrupteurMj.getAttribute("aria-checked") !== String(modeMj)) interrupteurMj.setAttribute("aria-checked", String(modeMj));
    aideDuClicDroit.hidden = !modeMj;
    marqueMjDeLaCarte.hidden = !modeMj;
  }

  /**
   * L'interrupteur (dans ⋯ au téléphone, dans l'en-tête de la carte sur PC) :
   * le Mode MJ change, l'appareil s'en souvient, la région d'annonce le dit,
   * et l'écran se refait. Éteint, la palette libre se replie, et le menu du
   * MJ se ferme (combat_menus.js le voit au rendu).
   */
  function basculerLeModeMj() {
    if (perimee()) return;
    modeMj = !modeMj;
    ecrireModeMj(modeMj);
    if (!modeMj && paletteOuverte?.libre === true) paletteOuverte = null;
    action.dire(modeMj ? MJ_ALLUME : MJ_ETEINT);
    rendre();
  }

  /** La phrase d'une seconde (contrat, § 4.3) : la région d'annonce la dit, la couche des menus la montre. */
  function dire(texte) {
    if (perimee() || texte === null || texte === undefined || texte === "") return;
    action.dire(texte);
    menus.ouvrir("toast", { texte });
  }

  // ——— La palette ———

  /**
   * Ouvre la palette au nom d'une source : « Appliquer l'effet de… », un
   * passif, « Palette » (Mode MJ ; « libre »), l'étiquette d'un état.
   * « ancre » est ce qui l'ouvre : le focus y revient quand elle se replie.
   */
  function ouvrirPalette(source, ancre = null, { libre = false } = {}) {
    if (perimee() || source === null || source === undefined) return;
    // Rouverte pendant qu'une case se choisit pour elle (un appui de plus sur
    // « Appliquer l'effet de… », « Palette », un passif) : son choix repart
    // de zéro, et la case ne l'est plus ; sa feuille effacée revient sous son
    // voile (relecture finale, R2 et R3).
    const effacee = caseDeLaPalette !== null && menus.ouvert() === "palette";
    if (effacee || caseDeLaBulle) finirLaDemande();
    if (effacee) menus.reprendre();
    const geste = gesteEnCours(seance.etat());
    paletteOuverte = { source, libre: libre === true, ancre: ancre ?? globalThis.document?.activeElement ?? null, choisi: null, geste: geste?.numero ?? null, parDefaut: false };
    paletteAOuvrir = true;
    rendre();
    // Dans la bulle (PC, pendant un geste), le focus va à son titre ; une
    // feuille le pose elle-même, sauf celle qui revient.
    if (paletteOuverte !== null && (effacee || menus.ouvert() !== "palette")) palette.noeud.querySelector("h2")?.focus({ preventScroll: true });
  }

  /** Une autre source (Mode MJ) : la place et l'ancre restent, le choix repart de zéro, et la case qu'il demandait ne l'est plus. */
  function changerLaSource(source) {
    if (perimee() || paletteOuverte === null || source === null || source === undefined) return;
    if (caseDeLaBulle) finirLaDemande();
    paletteOuverte = { ...paletteOuverte, source, choisi: null, parDefaut: false };
    rendre();
  }

  /** Chaque choix de la palette : sa vue se refait (l'aperçu, « Appliquer »). */
  function choisirDansLaPalette(choisi) {
    if (perimee() || paletteOuverte === null) return;
    paletteOuverte = { ...paletteOuverte, choisi: choisi ?? null };
    rendre();
  }

  /**
   * « Fermer », Échap, le voile : la palette se replie, et le focus revient à
   * ce qui l'avait ouverte. Sur PC, en Mode MJ, pendant un geste, la bulle
   * reprend d'elle-même celle du geste, son choix à zéro. La case qu'elle
   * demandait ne l'est plus : la carte cesse de l'offrir (vague 4, C2) ;
   * rendreLaPalette y veille, comme pour toute palette repliée (relecture
   * finale, R3), et la case du menu du MJ n'en dépend plus.
   */
  function fermerLaPalette() {
    if (perimee() || paletteOuverte === null) return;
    const { ancre } = paletteOuverte;
    const secours = menus.ouvert() === "palette" ? menus.secours() : null;
    paletteOuverte = null;
    rendre();
    rendreLeFocusDeLaPalette(ancre, secours);
  }

  // L'ancre a pu être refaite entre-temps (la bulle refait son corps) : le
  // focus va à son pareil, celui qui porte le même repère (data-repere),
  // quand elle en a un ; sinon à la commande qui attend dans la bulle. À la
  // vague 4 (R2 n° 6) : une ancre sans boîte (« Appliquer l'effet de… »
  // d'une fiche rendue à la page, que la feuille de style cache au
  // téléphone), ou partie sans pareil dans la bulle (la fiche refaite par
  // l'effet appliqué), cède la place au secours, l'ancre du genre que la
  // palette a remplacé (« ⋯ », « Fiche »), s'il se voit.
  function rendreLeFocusDeLaPalette(ancre, secours = null) {
    const nom = ancre?.getAttribute?.("data-repere") ?? null;
    const pareil = ancre?.isConnected ? ancre : nom === null ? null : ([...bulle.noeud.querySelectorAll("[data-repere]")].find((noeud) => noeud.getAttribute("data-repere") === nom) ?? null);
    if (!partieMenus.aUneBoite(pareil) && partieMenus.aUneBoite(secours)) secours.focus({ preventScroll: true });
    else if (pareil !== null) pareil.focus({ preventScroll: true });
    else if (bulleMontree) bulle.focaliser();
  }

  /**
   * La palette du rendu (contrat, § 4.3, son cycle de vie) : celle d'un
   * geste se ferme quand il finit ; sur PC, en Mode MJ, pendant tout geste,
   * la bulle porte celle de geste.palette sans attendre d'appui. Au
   * téléphone, et hors d'un geste, elle est une feuille (combat_menus.js) ;
   * sur PC, pendant un geste, la bulle la porte en colonne. Rend sa vue, ou
   * null.
   */
  function rendreLaPalette(etat, geste, vueDuPanneau, { etroit, arrete }) {
    const numero = geste?.numero ?? null;
    if (paletteOuverte !== null && (arrete || paletteOuverte.geste !== numero || (paletteOuverte.parDefaut && (etroit || !modeMj)))) paletteOuverte = null;
    // Celle de la bulle repliée autrement que par « Fermer » (ici, ou avant ce
    // rendu : « Appliquer », le Mode MJ éteint) : la case qu'elle demandait ne
    // l'est plus, avant que la palette du geste renaisse (relecture finale, R3).
    if (paletteOuverte === null && caseDeLaBulle) finirLaDemande();
    const sourceDuGeste = vueDuPanneau.geste?.palette?.source ?? null;
    if (paletteOuverte === null && !arrete && !etroit && modeMj && numero !== null && sourceDuGeste !== null) {
      paletteOuverte = { source: sourceDuGeste, libre: true, ancre: null, choisi: null, geste: numero, parDefaut: true };
    }
    const vue = paletteOuverte === null ? null : (vues.vuePalette(etat, paletteOuverte.source, { etats: etatsDuClasseur(), libre: paletteOuverte.libre, choisi: paletteOuverte.choisi, simuler: simulateurDe(etat) }) ?? null);
    if (vue === null) paletteOuverte = null;
    palette.rendre(vue, { etroit, modeMj });
    const enFeuille = vue !== null && (etroit || numero === null);
    const aOuvrir = paletteAOuvrir;
    paletteAOuvrir = false;
    // Une autre feuille a pris sa place (le plein écran, un menu) : la
    // palette ne la chasse pas d'elle-même ; seul un appui qui l'ouvre le fait.
    if (enFeuille && menus.ouvert() !== "palette" && menus.ouvert() !== null && !aOuvrir) {
      paletteOuverte = null;
      palette.rendre(null, { etroit, modeMj });
      return null;
    }
    // Sa feuille fermée, ou remplacée, pendant qu'une case se choisit pour
    // elle : la demande finit avec elle (C2), et la palette s'oublie, comme
    // remplacée ; sans quoi le rendu suivant la rouvrait, avec son choix
    // d'avant (relecture finale, R1).
    if (enFeuille && menus.ouvert() !== "palette") menus.ouvrir("palette", { noeud: palette.noeud, nom: vue.titre, ancre: paletteOuverte.ancre, apres: () => quitterLaFeuilleEffacee() });
    else if (!enFeuille && menus.ouvert() === "palette") {
      // Passée dans la bulle (la fenêtre élargie pendant un geste) : la case
      // ne l'est plus, mais la palette reste, son choix gardé.
      if (caseDeLaPalette !== null) finirLaDemande();
      menus.fermer({ focus: false });
    }
    return vue;
  }

  // ——— Le menu du MJ, la case demandée, le jeton sans choix ———

  /**
   * Le menu du MJ d'un protagoniste (le clic droit, l'appui long,
   * « Modifier… ») : rien hors Mode MJ ; pendant un geste, sa raison se dit
   * une seconde ; sinon, il s'ouvre, et le focus reviendra à « ancre ».
   */
  function ouvrirMenuMj(id, ancre = null) {
    if (perimee() || !modeMj) return;
    const vue = vues.vueMenuMj(seance.etat(), id, { etats: etatsDuClasseur(), saisies: null, simuler: null }) ?? null;
    if (vue === null) return;
    if (vue.actif === false) {
      dire(vue.raison);
      return;
    }
    menus.ouvrir("mj", { id, ancre: ancre ?? globalThis.document?.activeElement ?? null });
  }

  /**
   * Sur PC, le menu du MJ et ses panneaux (« Modifier une valeur… »), contre
   * ce qui les ouvre (mission, § 4.8, E4 ; vague 4, W1 n° 8) : la couche des
   * menus le demande, montré et rempli ; echelle.js écrit la place, comme
   * celle de la bulle. Le même nœud sert au menu et à ses panneaux : il se
   * mesure libre de la hauteur du placement d'avant (libre ; vague 4, C5).
   */
  function placerLeMenu(feuille, ancre) {
    placerBulle(feuille, { ancre, repere: COIN_DE_LA_FENETRE, fenetre: services.fenetre(), cotes: COTES_DU_MENU, ecart: FLECHE, pointe: POINTE_DU_MENU, libre: true });
  }

  /**
   * L'appui long qui vient d'ouvrir le menu du MJ (vague 4, W1 n° 5, R2
   * n° 11) : au relâcher, le navigateur envoie un clic là où était le doigt,
   * sur ce qui vient d'y paraître (le voile, qui refermait le menu, ou une
   * entrée, qu'il choisissait). Ce clic-là s'avale, une fois, où qu'il
   * tombe ; un appui neuf, ou une touche, finit l'attente.
   */
  function avalerLeClicSuivant() {
    if (!perimee() && menus.ouvert() !== null) clicAAvaler = true;
  }

  /**
   * Une case à choisir sur la carte (« Déplacer sans action… », la case d'un
   * effet) ; Échap y met fin. Demandée par la palette d'une feuille (au
   * téléphone ; sur PC, hors d'un geste), la feuille s'efface le temps du
   * choix : sous son voile, la carte était inerte, et Tab bouclait dans la
   * feuille (vague 4, C2). La phrase d'une seconde dit quoi toucher, et le
   * focus va à la première case offerte. La case touchée, la palette la
   * reçoit, puis la feuille revient, le focus sur le bouton qui l'avait
   * demandée ; Échap la rend de même, sans case. Ce bouton, la palette le
   * nomme (options.cleDuBouton) : sous Safari, un bouton touché ne prend
   * pas le focus (relecture finale, R5) ; activeElement reste un repli.
   */
  function demanderUneCase(options, rappel) {
    if (perimee()) return;
    const parLaFeuille = menus.ouvert() === "palette" && paletteOuverte !== null;
    const cle = parLaFeuille ? (options?.cleDuBouton ?? globalThis.document?.activeElement?.getAttribute?.("data-cle") ?? null) : null;
    demandeEnCours = true;
    const demandee = plateau.demanderUneCase(options, (nomDeCase) => {
      demandeEnCours = false;
      caseDeLaBulle = false;
      const reprise = caseDeLaPalette;
      caseDeLaPalette = null;
      if (perimee()) return;
      rappel?.(nomDeCase);
      if (reprise !== null) reprendreLaPalette(reprise);
    });
    caseDeLaBulle = !parLaFeuille && paletteOuverte !== null && demandee !== false;
    if (!parLaFeuille || demandee === false || !menus.suspendre()) return;
    caseDeLaPalette = { cle };
    plateau.noeud.querySelector(".combat-case-choix")?.focus({ preventScroll: true });
  }

  /** La case demandée ne l'est plus (Échap, la palette fermée) : la carte cesse de l'offrir. */
  function finirLaDemande() {
    demandeEnCours = false;
    caseDeLaPalette = null;
    caseDeLaBulle = false;
    plateau.finirLaDemande();
  }

  /** La feuille de la palette fermée, ou remplacée, pendant qu'elle est effacée pour une case : la demande finit, et la palette s'oublie (relecture finale, R1). */
  function quitterLaFeuilleEffacee() {
    if (caseDeLaPalette === null) return;
    finirLaDemande();
    paletteOuverte = null;
  }

  /** La feuille de la palette, effacée le temps d'une case, revient ; le focus va au bouton qui l'avait demandée, sinon au titre. */
  function reprendreLaPalette({ cle }) {
    if (perimee() || menus.ouvert() !== "palette") return;
    menus.reprendre();
    const bouton = cle === null ? null : ([...palette.noeud.querySelectorAll("[data-cle]")].find((element) => element.getAttribute("data-cle") === cle) ?? null);
    (bouton ?? palette.noeud.querySelector("h2"))?.focus({ preventScroll: true });
  }

  /**
   * Un jeton sans choix actionné (Entrée, après le premier dé) : si c'est
   * celui du protagoniste que la bulle montre, le focus y revient (mission,
   * § 6, point 6b).
   */
  function jetonSansChoix(id) {
    if (perimee() || id === null || id === undefined) return;
    if (bulleMontree && id === protagonisteMontre && fermetureMontree === "reduire") bulle.focaliser();
  }

  // Un combat neuf ou repris : ce que l'écran montrait de l'ancien s'oublie.
  function oublierLeCombatMontre() {
    paletteOuverte = null;
    m.equipements.clear();
    menus.fermer({ focus: false });
    montrerLeDe(null);
  }

  // ——— Le dé en surimpression ———

  /**
   * Montre un dé tiré une seconde sur la carte (mission, § 3, A5 et B2) : son
   * titre, sa valeur, son verdict ; la classe d'état d'après son genre ; au
   * centre, ou, sur PC, dans la moitié de la carte que la bulle laisse libre
   * s'il devait la couvrir (lu sur les boîtes). Un dé suivant le remplace.
   * Rien d'écrit en style : trois classes de position.
   */
  function montrerLeDe(vue) {
    const noeud = plateau.surimpression;
    if (deMontre !== null) {
      services.minuteur.retirer(deMontre);
      deMontre = null;
    }
    if (vue === null || vue === undefined) {
      cacherLeDe();
      return;
    }
    const classes = (place) => ["combat-surimpression", ETAT_DU_DE[vue.genre] ?? null, PLACES_DU_DE[place]].filter(Boolean).join(" ");
    noeud.className = classes("centre");
    noeud.replaceChildren(
      el("p", { classe: "combat-surimpression-titre" }, vue.titre ?? ""),
      el("p", { classe: "combat-surimpression-valeur" }, String(vue.valeur ?? "")),
      el("p", { classe: "combat-surimpression-verdict" }, vue.verdict ?? ""),
    );
    noeud.hidden = false;
    const place = placeDuDe(noeud);
    if (place !== "centre") noeud.className = classes(place);
    deMontre = services.minuteur.poser(() => {
      deMontre = null;
      if (!perimee()) cacherLeDe();
    }, DUREE_DU_DE);
  }

  function cacherLeDe() {
    const noeud = plateau.surimpression;
    noeud.hidden = true;
    if (noeud.childNodes.length > 0) noeud.replaceChildren();
    if (noeud.className !== "combat-surimpression") noeud.className = "combat-surimpression";
  }

  // Au téléphone, toujours au centre. Sur PC, le dé posé au centre couvre-t-il
  // la bulle ? Il passe alors au centre de la moitié de la carte qu'elle
  // laisse libre : la gauche si la bulle est à droite du milieu, sinon la
  // droite.
  function placeDuDe(noeud) {
    if (estEtroit() || !bulleMontree) return "centre";
    const de = noeud.getBoundingClientRect();
    const boite = bulle.noeud.getBoundingClientRect();
    const carte = noeud.parentNode?.getBoundingClientRect?.() ?? null;
    if (carte === null || de.width <= 0 || boite.width <= 0 || !chevauche(de, boite)) return "centre";
    return boite.left + boite.width / 2 >= carte.left + carte.width / 2 ? "gauche" : "droite";
  }

  // ——— « Changer l'équipement… » (D14) ———

  /** Le protagoniste tel qu'il a été ajouté : sa photographie et sa source. */
  const ajoute = (id) => seance.miseEnPlace().protagonistes.find((un) => un.id === id) ?? null;

  // Les armes et l'armure des zones d'une photographie : ce que
  // l'équipement change, et à quoi l'écran reconnaît d'où il repart.
  const traitsDEquipement = (valeurs) => JSON.stringify([valeurs?.armes ?? null, (valeurs?.zones ?? []).map((zone) => zone?.armure ?? null)]);

  /**
   * D'où repartir pour changer l'équipement d'un protagoniste : le
   * personnage (ou la ligne) que ce combat montre, si l'écran le connaît —
   * celui de l'ajout, ou celui de son dernier changement ici. Un équipement
   * changé avant un rechargement ne se relit pas : null.
   */
  function sourceDEquipement(id) {
    const protagoniste = ajoute(id);
    const source = protagoniste?.photo?.source ?? null;
    if (source === null || typeof source !== "object") return null;
    const camp = protagoniste.photo.camp;
    const courante = traitsDEquipement(seance.etat().photos?.[id] ?? null);
    const change = m.equipements.get(id) ?? null;
    if (change !== null && courante === traitsDEquipement(change.valeurs)) return { camp, source: change.source, types: source.types };
    if (courante === traitsDEquipement(protagoniste.photo.valeurs)) return { camp, source: camp === "pj" ? source.personnage : source.ligne, types: source.types };
    return null;
  }

  /** Ce que la feuille propose : l'arme tenue et la qualité de chaque objet (un personnage), la cellule Équipement (un adversaire). */
  function propositionDEquipement(id) {
    const lue = sourceDEquipement(id);
    if (lue === null || lue.source === null || typeof lue.source !== "object") return { refus: PAS_ENCORE };
    if (lue.camp !== "pj") return { camp: "adv", cellule: String(lue.source.equipement ?? "") };
    try {
      const fiche = calculerFiche(banque, lue.source, { index: resolution().index });
      const objets = (lue.source.equipement ?? []).map((objet, rang) => ({ rang, nom: String(objet?.nom ?? ""), qualite: objet?.qualite ?? "" }));
      const armes = (fiche.equipement ?? []).filter((objet) => objet.type === "arme").map((objet) => ({ valeur: objet.rang, libelle: String(objet.nom ?? "") }));
      const tenue = (lue.source.equipement ?? []).findIndex((objet) => objet?.place === "arme");
      return { camp: "pj", armes, tenue: armes.some((arme) => arme.valeur === tenue) ? tenue : null, objets };
    } catch {
      return { refus: PAS_ENCORE };
    }
  }

  /**
   * « Enregistrer » : la photographie recalculée avec la banque ouverte (le
   * personnage par photographierPersonnage, la ligne par
   * photographierAdversaire), puis l'événement du MJ, qui porte ses valeurs et
   * ce qui a changé. Rend { refus } (que la feuille dit), ou {}.
   */
  function changerLEquipement(id, choix) {
    if (perimee()) return {};
    const lue = sourceDEquipement(id);
    if (lue === null) return { refus: PAS_ENCORE };
    const fait = lue.camp === "pj" ? equipementDuPersonnage(lue.source, choix) : equipementDeLAdversaire(lue, choix);
    if (fait.refus) return { refus: fait.refus };
    const issue = commander(() => seance.executer({ evenement: { type: "mj", genre: "equipement", qui: id, photo: fait.photo.valeurs, changements: fait.changements } }));
    if (issue?.refus) return { refus: issue.refus.message };
    m.equipements.set(id, { source: fait.source, valeurs: seance.etat().photos?.[id] ?? fait.photo.valeurs });
    apres(issue);
    return {};
  }

  // Le personnage changé : l'arme tenue (celle qu'on ne tient plus rejoint
  // le sac : une seule arme se tient, format 2), puis la qualité de chaque
  // objet, écrite comme dans son fichier.
  function equipementDuPersonnage(origine, choix) {
    const personnage = structuredClone(origine);
    const objets = Array.isArray(personnage.equipement) ? personnage.equipement : [];
    const changements = [];
    const avant = objets.findIndex((objet) => objet?.place === "arme");
    const tenue = Number.isInteger(choix?.tenue) && objets[choix.tenue] ? choix.tenue : null;
    if (tenue !== (avant >= 0 ? avant : null)) {
      if (avant >= 0) objets[avant].place = "sac";
      if (tenue !== null) objets[tenue].place = "arme";
      changements.push({ genre: "arme", nom: tenue === null ? null : String(objets[tenue].nom) });
    }
    for (const [rang, objet] of objets.entries()) {
      const saisie = choix?.qualites?.[rang];
      if (saisie === undefined || saisie === null) continue;
      const nouvelle = String(saisie).trim() === "" ? null : String(saisie).trim();
      if (nouvelle === (objet.qualite ?? null)) continue;
      if (nouvelle !== null && !MOTIF_QUALITE.test(nouvelle)) return { refus: QUALITE_ILLISIBLE };
      changements.push({ genre: "qualite", objet: String(objet.nom), avant: objet.qualite ?? null, apres: nouvelle });
      objet.qualite = nouvelle;
    }
    if (changements.length === 0) return { refus: RIEN_NE_CHANGE };
    const { photo, refus } = photographier(() => photographierPersonnage(banque, personnage, { index: resolution().index, roles: outils.roles }), PERSONNAGE_ILLISIBLE);
    if (refus) return { refus };
    return { source: personnage, photo, changements };
  }

  // L'adversaire changé : sa ligne, la cellule Équipement récrite, résolue de
  // nouveau avec ses types, dans une banque d'appoint (comme sa fiche
  // complète) ; le changement porte les noms de son équipement, dans l'ordre.
  function equipementDeLAdversaire({ source: ligne, types }, choix) {
    const cellule = String(choix?.cellule ?? "").trim();
    if (cellule === String(ligne?.equipement ?? "").trim()) return { refus: RIEN_NE_CHANGE };
    const neuve = { ...ligne, equipement: cellule };
    const { photo, refus } = photographier(() => {
      const appoint = indexerAdversaires({ ...banque, adversaires: [neuve], types_adversaires: types ?? [] }, resolution().index);
      return photographierAdversaire(appoint, neuve.nom, { banque, roles: outils.roles });
    }, ADVERSAIRE_ILLISIBLE);
    if (refus) return { refus };
    const noms = (photo.source?.resolu?.equipement ?? []).map((objet) => String(objet?.nom ?? ""));
    return { source: neuve, photo, changements: [{ genre: "cellule", noms }] };
  }

  // ——— Le rendu ———

  function origineDeLaCible(etat) {
    const geste = gesteEnCours(etat);
    if (geste === null || cibleChoisie === null || geste.cible === null) return null;
    return geste.numero === cibleChoisie.numero && geste.cible === cibleChoisie.cible ? cibleChoisie.origine : null;
  }

  // Où va le focus quand la partie montrée change : à la commande qui
  // attend (dans la bulle si elle est ouverte), sinon au titre.
  function focusSurLaPartie() {
    if (montree === action) {
      if (bulleMontree && bulle.focaliser()) return;
      (action.noeud.querySelector("[data-focus]") ?? h1).focus({ preventScroll: true });
    } else if (montree === blocage) titreDuBlocage.focus({ preventScroll: true });
    else h1.focus({ preventScroll: true });
  }

  /**
   * Redessine l'écran d'après le combat du moment. « parCommande » : le rendu
   * suit un geste de la personne, et le focus va à la commande qui attend ;
   * sinon (la première visite, la fin d'une écriture, une lecture qui
   * revient, la fenêtre qui change de largeur) le focus ne bouge pas.
   */
  function rendre({ parCommande = false } = {}) {
    passes += 1;
    const passe = passes;
    const etat = seance.etat();
    const choisi = seance.choisi();
    const bloque = seance.bloque();
    bloqueRendu = bloque;
    const enPreparation = etat.phase === "preparation";
    const etroit = estEtroit();
    const deplacer = parCommande && immobile === 0;
    // Hors de la préparation, la racine le dit à la feuille de style : au
    // téléphone, l'en-tête du site cède sa place à la barre du tour (D2).
    const classeDeLaRacine = enPreparation ? "combat ne-pas-imprimer" : "combat ne-pas-imprimer combat-en-jeu";
    if (racine.className !== classeDeLaRacine) racine.className = classeDeLaRacine;

    const vueDeLaBarre = vues.vueBarre(etat);
    rendreLaBarre(vueDeLaBarre, bloque);
    rendreLaGarde();
    // Après l'état de l'enregistrement : la limite s'ajoute à ce qu'il dit.
    rendreLaLimite(vueDeLaBarre.limite ?? null, etat);
    rendreLeModeMj();

    // Quand on ne joue pas (un combat ouvert ailleurs), la séance refuserait
    // tout : la carte et les fiches montrent le combat sans rien offrir, ni
    // jeton à choisir, ni « Jouer », ni case à changer ; la bulle se cache.
    const arrete = bloque !== null;
    const vueDuMoment = vues.vuePlateau(etat, choisi);
    plateau.rendre(vueDuMoment, { arrete, modeMj, etroit });
    vignettes.rendre(vues.vueVignettes(etat, choisi), { modeMj, arrete });
    const vuesDesFiches = etat.ordre
      .map((id) => vues.vueFiche(etat, id, choisi))
      .filter(Boolean)
      .map((vue) => (arrete ? { ...vue, jouer: null, avant: null } : vue));
    // Les fiches rendent d'elles-mêmes le focus qu'elles portaient : c'est
    // avant la zone et la bulle, dont le focus prime.
    fiches.rendre({ pj: vuesDesFiches.filter((vue) => vue.camp === "pj"), adv: vuesDesFiches.filter((vue) => vue.camp !== "pj") }, { etroit, modeMj });

    // L'ordre du document est celui du téléphone : le bandeau, les
    // vignettes, la carte, la bulle et son onglet, la zone sous la carte (ou
    // la préparation, ou le bloc d'arrêt), puis les deux camps (sauf quand
    // ils sont prêtés au plein écran).
    const aMontrer = bloque !== null ? blocage : enPreparation ? preparation : action;
    const change = aMontrer !== montree;
    let focusPerdu = false;
    if (change) {
      const actif = globalThis.document?.activeElement ?? null;
      // La bulle et son onglet se cachent quand la zone cède la place : un
      // focus qui y était se perd avec eux.
      focusPerdu = montree !== null && actif !== null && [montree.noeud, bulle.noeud, bulle.onglet].some((noeud) => estDans(actif, noeud));
      cadre.replaceChildren(bandeau.noeud, vignettes.noeud, plateau.noeud, bulle.noeud, bulle.onglet, aMontrer.noeud, ...(fichesEnPlein ? [] : [fiches.noeud]));
      // Un nœud retiré puis remis dans la page y perd le focus.
      if (!focusPerdu && montree !== null && actif !== null && estDans(actif, cadre)) actif.focus({ preventScroll: true });
      montree = aMontrer;
      // La liste d'une case appartenait à la partie qui vient de céder la place.
      caseOuverte = null;
    }
    // La zone se rend même quand elle n'est pas montrée : sa région
    // d'annonce se vide avec le combat, et ne redit rien d'un combat d'avant.
    // Le bloc de blessure ne se lit dans la banque qu'au premier geste qui
    // en demande une.
    const geste = gesteEnCours(etat);
    const vueDuPanneau = vues.vuePanneau(etat, choisi, { blessures: geste?.moment === "blessure" ? blessures() : [] });
    fermetureMontree = vueDuPanneau.fermeture?.genre ?? null;
    const origine = origineDeLaCible(etat);
    const refait = action.rendre(vueDuPanneau, { etroit, origineDeLaCible: origine });
    if (aMontrer === preparation) preparation.rendre(vues.vuePreparation(seance.miseEnPlace(), apports()), { demonstration: enDemonstration, phraseDeDemonstration });
    if (bloque !== null) rendreLeBlocage(bloque);

    // La palette (contrat de la vague 3, § 4.3), avant la bulle qui la porte.
    const vueDeLaPalette = rendreLaPalette(etat, geste, vueDuPanneau, { etroit, arrete });
    if (passe !== passes) return;
    const paletteDansLaBulle = vueDeLaPalette !== null && !etroit && geste !== null;

    // La liste d'une case se remplit avant que la bulle se rende : elle
    // mesure sa taille pour se placer.
    const lieu = lieuDeLaListe(vueDuPanneau, etroit);
    rendreLaListe(vueDuMoment, lieu);
    const caseDeLaBulle = lieu === bulle.listeDeCase ? caseOuverte : null;
    const vueDeLaBulle = arrete || montree !== action ? BULLE_CACHEE : vueDuPanneau;
    const caseActive = Object.keys(vueDuMoment.cases).find((nom) => vueDuMoment.cases[nom].active === true) ?? null;
    const rendu = bulle.rendre(vueDeLaBulle, {
      etroit,
      caseOuverte: caseDeLaBulle,
      ancre: noeudDeLaCase(caseDeLaBulle ?? caseActive),
      repere: cadre,
      fenetre: services.fenetre,
      origineDeLaCible: origine,
      // La bulle s'arrête sous le bandeau, relu au moment de la placer.
      plafond: () => bandeau.noeud.getBoundingClientRect().bottom,
      modeMj,
      palette: paletteDansLaBulle ? palette.noeud : null,
      vuePalette: geste !== null ? vueDeLaPalette : null,
      repos: { annuler: vueDeLaBarre.annuler ?? null, finDeTour: vueDeLaBarre.finDeTour ?? null },
    });
    bulleMontree = rendu.montree;
    protagonisteMontre = vueDeLaBulle === vueDuPanneau ? protagonisteDe(vueDuPanneau) : null;
    // La bulle qui prend la palette s'élargit (combat-bulle-large), celle
    // qui la quitte se resserre : sa place est à refaire (vague 4, W1 n° 4 ;
    // E6, comme en E1, où la palette est là dès l'ouverture).
    const largeurChangee = bulleMontree && paletteDansLaBulle !== bulleLarge;
    bulleLarge = bulleMontree && paletteDansLaBulle;

    // Au téléphone, la fiche complète n'est jamais dans la page (R2 n° 2) :
    // celle qu'une fenêtre plus large y avait ouverte se ferme.
    if (ficheOuverte !== null && (etroit || !etat.ordre.includes(ficheOuverte))) fermerLaFiche({ focus: false });
    rendreLeJournal(etat);
    bandeau.rendre(vues.vueBandeau(etat));
    rendreAvis();
    // Ce qui est ouvert par-dessus le combat suit ce rendu : la feuille du
    // combat, « Intervenir… », le menu du MJ (qui se ferme avec le Mode MJ).
    menus.rendre({
      barre: vueDeLaBarre,
      modeMj,
      etroit,
      menuMj: (id, saisies) => vues.vueMenuMj(seance.etat(), id, { etats: etatsDuClasseur(), saisies, simuler: simulateurDe(seance.etat()) }),
      equipement: (id) => propositionDEquipement(id),
      // En tête du menu ⋯, l'état de l'enregistrement, que la barre du
      // téléphone ne montre plus (W1 n° 14).
      garde: garde.textContent,
    });
    // La bulle se place sur la carte telle que ce rendu la laisse, après tout
    // ce qui la déplace en changeant de hauteur : le panneau « Fiche
    // complète » et la zone d'avis, au-dessus du cadre ; le bandeau, au-dessus
    // de la carte (le journal, dessous, ne la déplace pas). Placée avant eux,
    // elle restait où la carte était avant qu'ils la poussent : rouverte au
    // rechargement en plein jet, sa flèche visait 61 px plus haut que sa case,
    // la hauteur du bandeau (captures finales du groupe 2, D-2).
    if (rendu.ouverture || largeurChangee) bulle.replacer();

    if (change && (deplacer || focusPerdu)) focusSurLaPartie();
    else if (deplacer) {
      // La bulle qui s'ouvre, ou un choix fait sur la carte : le focus va à
      // la commande qui attend dans la bulle. Sinon, la règle du groupe 1 :
      // la zone refaite le rend à la sienne.
      if (bulleMontree && (rendu.ouverture || origineDuMoment === "plateau")) bulle.focaliser();
      else if (refait && montree === action) action.noeud.querySelector("[data-focus]")?.focus({ preventScroll: true });
    }
  }

  // ——— L'assemblage ———

  // L'ordre du document est celui du téléphone : l'état, « Fin de tour » et
  // « ⋯ » sur une ligne, comme la maquette ; ce que « ⋯ » ouvre dessous, sur
  // sa propre rangée (dans celle des commandes, il les faisait passer à la
  // ligne en s'ouvrant) ; puis l'état de l'enregistrement, sur la sienne. À
  // partir de 56rem, la feuille de style range tout sur une ligne,
  // « Annuler le dernier geste » et « Nouveau combat » puis « Fin de tour »
  // au bout de la barre. À la vague 3, au téléphone (A1) : ☰ en tête, l'état
  // court à la place de l'état, puis « Intervenir… » ou « Fin de tour »,
  // « MJ » et « ⋯ » ; la feuille de style montre l'un ou l'autre selon la
  // largeur.
  barre.append(
    boutonDuSite,
    etatDuCombat,
    etatCourt,
    el("div", { classe: "combat-commandes" }, intervenir, raisonDIntervenir, finDeTour, raisonDeFin, marqueMj, plus),
    autres,
    garde,
  );
  // Le dé en surimpression n'est montré qu'une seconde : caché d'ici là.
  plateau.surimpression.hidden = true;
  // L'interrupteur du Mode MJ, sur PC : dans l'en-tête de la carte (E1).
  plateau.emplacementMj.append(aideDuClicDroit, interrupteurMj, marqueMjDeLaCarte);
  // La région polie est dans la page dès le premier rendu, vide, et reste la
  // seule : un lecteur d'écran la connaît avant qu'elle parle. Elle ne quitte
  // pas la page quand la préparation ou un blocage prend la place de la zone.
  // La couche des menus et des feuilles vient en dernier : par-dessus tout.
  racine.append(limite, aide, zoneDAvis, panneau, cadre, journal, action.annonce, menus.noeud);
  rendreLeMenu();
  // Le clic au-dehors se voit en capture ; Échap, sur l'écran entier. Le
  // genre du dernier appui se voit en capture aussi, avant ce qu'il touche :
  // le doigt (ou la souris, le stylet) au pointerdown, le clavier à une
  // touche. L'un et l'autre finissent l'attente du clic à avaler : il ne
  // suit que l'appui long qui a ouvert le menu.
  racine.addEventListener("click", (evenement) => auClicDansLaPage(evenement), true);
  racine.addEventListener("keydown", (evenement) => auClavier(evenement));
  racine.addEventListener(
    "pointerdown",
    (evenement) => {
      dernierAppui = evenement?.pointerType || null;
      clicAAvaler = false;
    },
    true,
  );
  racine.addEventListener(
    "keydown",
    () => {
      dernierAppui = "clavier";
      clicAAvaler = false;
    },
    true,
  );

  // Une seule visite suit le gardien : celle d'avant se désabonne.
  visiteCourante?.desabonner?.();
  visite.desabonner = gardien.surChangement(() => auChangementDeGarde());
  visiteCourante = visite;

  if (seance.etat().phase === "preparation") lireLesPersonnages();
  // La composition gardée de la rencontre se lit à la première visite, sans
  // que l'écran l'attende ; si elle change ce que la préparation montre,
  // l'écran se redessine.
  const depart = circuit;
  rencontre
    .charger(contexte, { magasin: services.magasinRencontre })
    .then((changee) => {
      if (!changee || depart !== circuit || perimee() || !racine.isConnected) return;
      if (seance.etat().phase === "preparation") rendre();
    })
    .catch(() => {});
  rendre();
  // Revenu sur l'écran avec le combat en mémoire, ce nœud n'est pas encore
  // dans la page : la page l'y pose juste après, dans le même tour. Hors de
  // la page, la liste ne défilerait pas : elle se pose une fois le tour fini,
  // si le nœud est dans la page, sinon au rendu suivant.
  if (journalEnAttente) {
    queueMicrotask(() => {
      journalEnAttente = false;
      if (!perimee() && racine.isConnected) rendreLeJournal(seance.etat());
    });
  }
}
