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
// Ce que l'écran sait de plus que le combat n'est gardé nulle part : d'où
// vient la cible choisie (la carte, ou la bulle et la zone), la case dont la
// liste est ouverte, la fiche complète montrée, le menu « ⋯ », la question
// ouverte, la phrase du personnage de démonstration gardé. Un rechargement
// les oublie.

import { indexerAdversaires } from "../adversaire/resolution.js";
import { listeDe } from "../banque/consultation.js";
import { sourceAleatoire } from "../combat/des.js";
import { creerGardien, ouvrirMagasinCombat } from "../combat/enregistrement.js";
import { nomDuFichier, texteDuJournal } from "../combat/journal.js";
import { vueBandeau, vueBarre, vueFiche, vueJournal, vuePanneau, vuePlateau, vuePreparation } from "../combat/lecture.js";
import { photographierAdversaire, photographierPersonnage } from "../combat/photographie.js";
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
import * as partiePlateau from "./combat_plateau.js";
import * as partiePreparation from "./combat_preparation.js";
import { el, sansSensForce, telecharger, titre } from "./dom.js";
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

/** Le protagoniste d'une vue de la bulle : elle ne le nomme que dans la commande de « Passer son tour ». */
const protagonisteDe = (vue) => vue?.passer?.commande?.evenement?.qui ?? null;

// ─── L'écran ────────────────────────────────────────────────────────────────

/**
 * L'écran #/combat. Rend son nœud tout de suite ; l'ouverture du combat est
 * asynchrone. « services » ne sert qu'aux contrôles, chacun avec son défaut ;
 * la page n'en passe aucun, et rien dans la page ne permet d'imposer un dé :
 * { des, magasin, maintenant, navigateur, telecharger, media, fenetre, tient,
 * surveiller, minuteur, rendreLaMain, magasinRencontre, fetch }.
 * fenetre() rend la taille de la fenêtre ; tient(noeud) dit si le texte du
 * bandeau tient en trois lignes ; surveiller(noeud, rappel) prévient quand
 * sa taille change ; minuteur tient la grâce des infobulles ; rendreLaMain
 * passe à la séance ; magasinRencontre, à la rencontre gardée ; fetch lit le
 * personnage de démonstration.
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
  const enDemonstration = contexte.etat.mode === "demo";

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
  // Ce qui est montré, pour ne réécrire que ce qui change.
  let montree = null;
  let bulleMontree = false;
  let protagonisteMontre = null;
  let bloqueRendu = null;
  let avisMontre = "null";
  let blocageMontre = "";
  let listeMontree = "";
  let copieMontree = "";
  let libelleDAnnulation = null;
  let commandeDeFin = null;
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
  const actions = { executer, lancerLeDe, ajouterPersonnage, ajouterAdversaires, placerRencontre, lancer, ouvrirFiche, ouvrirCase, ajouterLaDemonstration, hachurer };
  const plateau = partiePlateau.creer(actions);
  const fiches = partieFiches.creer(actions);
  // La zone sous la carte a ses infobulles (les causes d'un jet joué sous la
  // carte, sur un téléphone), dans une couche que l'écran crée et qu'elle
  // porte : elles se posent sur elle.
  const coucheDeLaZone = el("div", { classe: "combat-infobulles" });
  const infobullesDeLaZone = partieBulle.creerInfobulles({ couche: coucheDeLaZone, actions: { hachurer }, services: { minuteur: services.minuteur, fenetre: services.fenetre, dernierAppui: () => dernierAppui } });
  const action = partieAction.creer({ executer, lancerLeDe, hachurer }, { lier: infobullesDeLaZone.lier, couche: coucheDeLaZone });
  const bulle = partieBulle.creer(
    { executer, lancerLeDe, hachurer, focusSurLeJeton, focusSurLaCase, fermerLaCase: () => fermerLaListe(caseOuverte), rafraichir },
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
      onclick: () => {
        if (!inactif(finDeTour) && commandeDeFin !== null) executer(commandeDeFin, "panneau");
      },
    },
    "Fin de tour",
  );
  const raisonDeNouveau = el("span", { id: "combat-raison-nouveau", classe: "combat-raison", hidden: true });
  const nouveau = el("button", { type: "button", classe: "bouton secondaire", "aria-describedby": "combat-raison-nouveau", onclick: () => demanderUnNouveauCombat() }, "Nouveau combat");
  const effacer = el("button", { type: "button", classe: "bouton", onclick: () => effacerLeCombat() }, "Effacer");
  const annuler = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => {
        question = null;
        rendreLeMenu();
        nouveau.focus({ preventScroll: true });
      },
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
      onclick: () => {
        question = null;
        rendreLeMenu();
        annulerLeGeste.focus({ preventScroll: true });
      },
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
      "aria-expanded": "false",
      "aria-controls": "combat-autres",
      "aria-label": "Autres commandes",
      onclick: () => {
        menuOuvert = !menuOuvert;
        rendreLeMenu();
      },
    },
    "⋯",
  );
  // À l'approche du plafond des événements, une phrase sous la barre ;
  // cachée quand elle est vide.
  const limite = el("p", { classe: "combat-limite", hidden: true });
  const aide = el("p", { classe: "combat-aide" });
  const zoneDAvis = el("div", { classe: "combat-avis", role: "alert" });
  const panneau = el("section", { classe: "combat-panneau", "aria-label": "Fiche complète" });
  // Le repère de la bulle et de son onglet, placés contre la case active.
  const cadre = el("div", { classe: "combat-cadre" });

  function rendreLeMenu() {
    const ouvert = menuOuvert || question !== null;
    const classe = ouvert ? "combat-autres ouvert" : "combat-autres";
    if (autres.className !== classe) autres.className = classe;
    plus.setAttribute("aria-expanded", String(ouvert));
    const contenu = question === "nouveau" ? [confirmation] : question === "annuler" ? [confirmationDAnnulation] : [annulerLeGeste, raisonDAnnulation, nouveau, raisonDeNouveau];
    if (autres.children.length !== contenu.length || contenu.some((noeud, rang) => autres.children[rang] !== noeud)) autres.replaceChildren(...contenu);
  }

  function demanderUnNouveauCombat() {
    if (perimee() || inactif(nouveau)) return;
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
      lireLesPersonnages();
    }
    rendreLeMenu();
    rendre({ parCommande: true });
    h1.focus({ preventScroll: true });
  }

  // La question se relit au moment du clic, jamais dans une vue d'avant ;
  // le focus va au choix sans risque, « Garder ».
  function demanderLAnnulation() {
    if (perimee() || inactif(annulerLeGeste)) return;
    const vue = vueBarre(seance.etat()).annuler;
    if (!vue?.actif || !vue.question) return;
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
    const vue = vueBarre(seance.etat()).annuler;
    question = null;
    if (vue?.actif === true) {
      cibleChoisie = null;
      caseOuverte = null;
      bulle.oublier();
      sansBougerLeFocus(() => executer(vue.commande, "barre"));
    }
    rendreLeMenu();
    annulerLeGeste.focus({ preventScroll: true });
  }

  function rendreLaBarre(vue, bloque) {
    poser(etatDuCombat, vue.etat);
    poser(aide, vue.aide);
    const fin = vue.finDeTour;
    commandeDeFin = fin?.commande ?? null;
    finDeTour.hidden = fin === null;
    // Quand on ne joue pas (un combat ouvert ailleurs), la séance refuserait
    // la fin du tour sans rien montrer : le bouton est inactif, et dit
    // pourquoi, par la phrase de la barre.
    const joue = bloque === null;
    reglerBouton(finDeTour, raisonDeFin, fin === null || (joue && fin.actif === true), joue ? (fin?.raison ?? null) : gardien.phrase());
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
    // Le combat repris peut en être à sa préparation : elle s'ouvre, et lit
    // ses personnages.
    if (seance.etat().phase === "preparation") lireLesPersonnages();
    rendre({ parCommande: true });
  }

  function auChangementDeGarde() {
    if (perimee() || occupe > 0 || !racine.isConnected) return;
    rendreLaGarde();
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
  // bulle voit qu'elle s'est fermée, et met le focus au jeton.
  function executer(commande, origine = "panneau") {
    if (perimee()) return;
    const avant = origineDuMoment;
    origineDuMoment = origine;
    try {
      apres(
        commander(() => seance.executer(commande)),
        () => {
          // D'où vient la cible : ni l'événement ni l'état ne le disent.
          const evenement = commande?.evenement;
          if (evenement?.type !== "regler" || evenement.champ !== "cible") return;
          const geste = gesteEnCours(seance.etat());
          cibleChoisie = geste === null ? null : { numero: geste.numero, cible: evenement.valeur, origine: origine === "plateau" ? "plateau" : "panneau" };
        },
      );
    } finally {
      origineDuMoment = avant;
    }
  }

  function lancerLeDe() {
    if (perimee()) return;
    apres(commander(() => seance.lancerLeDe()));
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

  const vueDuPlateau = () => vuePlateau(seance.etat(), seance.choisi());

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

  const lieuDuMoment = () => lieuDeLaListe(vuePanneau(seance.etat(), seance.choisi()), estEtroit());

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

  function ouvrirFiche(id) {
    if (perimee()) return;
    const protagoniste = seance.miseEnPlace().protagonistes.find((un) => un.id === id) ?? null;
    if (protagoniste === null) return;
    ficheOuverte = id;
    const nom = seance.etat().noms?.[id]?.entier ?? protagoniste.photo.valeurs.nom;
    const tete = el("h2", { tabindex: "-1" }, `Fiche complète : ${nom}`);
    panneau.replaceChildren(tete, el("div", { classe: "boutons" }, el("button", { type: "button", classe: "bouton secondaire", onclick: () => fermerLaFiche() }, "Fermer")), ...contenuDeLaFiche(protagoniste));
    tete.focus({ preventScroll: true });
  }

  // ——— Le journal, et le bandeau « Dernier événement » ———

  const zoneDeCopie = el("div", { classe: "combat-copie" });
  const boutonCopier = el("button", { type: "button", classe: "bouton secondaire", onclick: () => copier() }, "Copier");
  const boutonTelecharger = el("button", { type: "button", classe: "bouton secondaire", onclick: () => telechargerLeJournal() }, "Télécharger");
  // Le titre reçoit le focus quand on demande le journal (« Journal ↓ »),
  // sans entrer dans l'ordre du clavier.
  const titreDuJournal = el("h2", { id: "combat-journal-titre", tabindex: "-1" }, "Journal");
  // La liste des lignes : elle pose les lignes neuves, barre celles d'un geste
  // annulé, et défile en elle-même jusqu'à la dernière.
  const liste = creerListe({ vueJournal });
  // Une région que son titre nomme : sans nom, une section n'en est pas une.
  const journal = el(
    "section",
    { classe: "combat-journal", "aria-labelledby": "combat-journal-titre" },
    el("div", { classe: "combat-journal-tete" }, titreDuJournal, boutonCopier, boutonTelecharger),
    liste.noeud,
    zoneDeCopie,
  );

  /**
   * Fait voir le journal, à la demande (« Journal ↓ », ou un clic à la souris
   * sur le bandeau) : le seul défilement de la page que l'écran fasse, puis le
   * focus sur son titre, sans défiler de nouveau.
   */
  function montrerLeJournal() {
    if (perimee()) return;
    journal.scrollIntoView({ block: "start" });
    titreDuJournal.focus({ preventScroll: true });
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
      const { ajoutees, reposee } = liste.rendre(etat);
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
    inactifAuClic = ancetreInactif(evenement?.target ?? null);
    if (!bulleMontree) return;
    const cible = evenement?.target ?? null;
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
  function auClavier(evenement) {
    if (evenement?.key !== "Escape" || perimee()) return;
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
    const etat = seance.etat();
    const choisi = seance.choisi();
    const bloque = seance.bloque();
    bloqueRendu = bloque;
    const enPreparation = etat.phase === "preparation";
    const etroit = estEtroit();
    const deplacer = parCommande && immobile === 0;

    const vueDeLaBarre = vueBarre(etat);
    rendreLaBarre(vueDeLaBarre, bloque);
    rendreLaGarde();
    // Après l'état de l'enregistrement : la limite s'ajoute à ce qu'il dit.
    rendreLaLimite(vueDeLaBarre.limite ?? null, etat);

    // Quand on ne joue pas (un combat ouvert ailleurs), la séance refuserait
    // tout : la carte et les fiches montrent le combat sans rien offrir, ni
    // jeton à choisir, ni « Jouer », ni case à changer ; la bulle se cache.
    const arrete = bloque !== null;
    const vueDuMoment = vuePlateau(etat, choisi);
    plateau.rendre(vueDuMoment, { arrete });
    const vues = etat.ordre
      .map((id) => vueFiche(etat, id, choisi))
      .filter(Boolean)
      .map((vue) => (arrete ? { ...vue, jouer: null, avant: null } : vue));
    // Les fiches rendent d'elles-mêmes le focus qu'elles portaient : c'est
    // avant la zone et la bulle, dont le focus prime.
    fiches.rendre({ pj: vues.filter((vue) => vue.camp === "pj"), adv: vues.filter((vue) => vue.camp !== "pj") }, { etroit });

    // L'ordre du document est celui du téléphone : le bandeau, la carte, la
    // bulle et son onglet, la zone sous la carte (ou la préparation, ou le
    // bloc d'arrêt), puis les deux camps.
    const aMontrer = bloque !== null ? blocage : enPreparation ? preparation : action;
    const change = aMontrer !== montree;
    let focusPerdu = false;
    if (change) {
      const actif = globalThis.document?.activeElement ?? null;
      // La bulle et son onglet se cachent quand la zone cède la place : un
      // focus qui y était se perd avec eux.
      focusPerdu = montree !== null && actif !== null && [montree.noeud, bulle.noeud, bulle.onglet].some((noeud) => estDans(actif, noeud));
      cadre.replaceChildren(bandeau.noeud, plateau.noeud, bulle.noeud, bulle.onglet, aMontrer.noeud, fiches.noeud);
      // Un nœud retiré puis remis dans la page y perd le focus.
      if (!focusPerdu && montree !== null && actif !== null && estDans(actif, cadre)) actif.focus({ preventScroll: true });
      montree = aMontrer;
      // La liste d'une case appartenait à la partie qui vient de céder la place.
      caseOuverte = null;
    }
    // La zone se rend même quand elle n'est pas montrée : sa région
    // d'annonce se vide avec le combat, et ne redit rien d'un combat d'avant.
    const vueDuPanneau = vuePanneau(etat, choisi);
    const origine = origineDeLaCible(etat);
    const refait = action.rendre(vueDuPanneau, { etroit, origineDeLaCible: origine });
    if (aMontrer === preparation) preparation.rendre(vuePreparation(seance.miseEnPlace(), apports()), { demonstration: enDemonstration, phraseDeDemonstration });
    if (bloque !== null) rendreLeBlocage(bloque);

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
    });
    bulleMontree = rendu.montree;
    protagonisteMontre = vueDeLaBulle === vueDuPanneau ? protagonisteDe(vueDuPanneau) : null;

    if (ficheOuverte !== null && !etat.ordre.includes(ficheOuverte)) fermerLaFiche({ focus: false });
    rendreLeJournal(etat);
    bandeau.rendre(vueBandeau(etat));
    rendreAvis();
    // La bulle se place sur la carte telle que ce rendu la laisse, après tout
    // ce qui la déplace en changeant de hauteur : le panneau « Fiche
    // complète » et la zone d'avis, au-dessus du cadre ; le bandeau, au-dessus
    // de la carte (le journal, dessous, ne la déplace pas). Placée avant eux,
    // elle restait où la carte était avant qu'ils la poussent : rouverte au
    // rechargement en plein jet, sa flèche visait 61 px plus haut que sa case,
    // la hauteur du bandeau (captures finales du groupe 2, D-2).
    if (rendu.ouverture) bulle.replacer();

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
  // au bout de la barre.
  barre.append(etatDuCombat, el("div", { classe: "combat-commandes" }, finDeTour, raisonDeFin, plus), autres, garde);
  // La région polie est dans la page dès le premier rendu, vide, et reste la
  // seule : un lecteur d'écran la connaît avant qu'elle parle. Elle ne quitte
  // pas la page quand la préparation ou un blocage prend la place de la zone.
  racine.append(limite, aide, zoneDAvis, panneau, cadre, journal, action.annonce);
  rendreLeMenu();
  // Le clic au-dehors se voit en capture ; Échap, sur l'écran entier. Le
  // genre du dernier appui se voit en capture aussi, avant ce qu'il touche :
  // le doigt (ou la souris, le stylet) au pointerdown, le clavier à une
  // touche.
  racine.addEventListener("click", (evenement) => auClicDansLaPage(evenement), true);
  racine.addEventListener("keydown", (evenement) => auClavier(evenement));
  racine.addEventListener(
    "pointerdown",
    (evenement) => {
      dernierAppui = evenement?.pointerType || null;
    },
    true,
  );
  racine.addEventListener(
    "keydown",
    () => {
      dernierAppui = "clavier";
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
