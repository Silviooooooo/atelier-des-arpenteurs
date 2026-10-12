// L'écran du simulateur de combat, #/combat (SPECIFICATION.md, § 17, « Le
// simulateur de combat (lot 4) » ; § 7.2 pour l'enregistrement chiffré).
//
// Ce qu'il fait : il assemble les quatre parties de l'écran (le plateau, les
// fiches vivantes, le panneau d'action, la préparation) autour d'une séance,
// et tient lui-même le reste : la barre de titre, la zone d'avis, le panneau
// « Fiche complète », la liste d'une case, le journal et ses deux boutons.
// Il ne porte aucune règle du jeu : chaque rendu demande ses vues au moteur
// (js/combat/lecture.js), chaque clic rend à la séance la commande que la vue
// portait, puis l'écran se redessine.
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
// de l'appareil, le combat gardé) : afficher() rend donc son nœud tout de
// suite, avec le titre et une attente, puis le remplit. Une suite partie
// avant un oubli, ou pour un nœud qui a quitté la page, ne touche plus à
// rien.
//
// Ce que l'écran sait de plus que le combat n'est gardé nulle part : d'où
// vient la cible choisie (la carte, ou le panneau), la case dont la liste est
// ouverte, la fiche complète montrée, le menu « ⋯ ». Un rechargement les
// oublie.

import { indexerAdversaires } from "../adversaire/resolution.js";
import { listeDe } from "../banque/consultation.js";
import { sourceAleatoire } from "../combat/des.js";
import { creerGardien, ouvrirMagasinCombat } from "../combat/enregistrement.js";
import { nomDuFichier, texteDuJournal } from "../combat/journal.js";
import { vueBarre, vueFiche, vuePanneau, vuePlateau, vuePreparation } from "../combat/lecture.js";
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
import * as partieFiches from "./combat_fiches.js";
import * as partiePlateau from "./combat_plateau.js";
import * as partiePreparation from "./combat_preparation.js";
import { el, sansSensForce, telecharger, titre } from "./dom.js";
import { cadreDeCartes, rencontrePreparee } from "./rencontre.js";

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

// La largeur sous laquelle l'écran tient sur une colonne : celle de la
// feuille de style (56rem), lue ici pour replier les fiches.
const ETROIT = "(max-width: 55.99rem)";
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

// ─── La mémoire du module ───────────────────────────────────────────────────

// Le combat, d'une visite à l'autre : { mode, gardien, seance, gardeVue,
// disponibles, lecture }. Nul tant que rien n'est ouvert, et après un oubli.
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
  const seance = creerSeance({
    gardien,
    des: { lancer: (faces, combien) => servicesDuMoment.des.lancer(faces, combien) },
    maintenant: () => servicesDuMoment.maintenant(),
    mode,
    accepter,
  });
  await seance.ouvrir();
  if (depart !== circuit) return;
  memoire = { mode, gardien, seance, gardeVue: null, disponibles: null, lecture: 0 };
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

// ─── L'écran ────────────────────────────────────────────────────────────────

/**
 * L'écran #/combat. Rend son nœud tout de suite ; l'ouverture du combat est
 * asynchrone. « services » ne sert qu'aux contrôles : { des, magasin,
 * maintenant, navigateur, telecharger, media }, chacun avec son défaut ; la
 * page n'en passe aucun, et rien dans la page ne permet d'imposer un dé.
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
    },
  };
  if (estPret(contexte)) {
    monter(visite);
    return racine;
  }
  // L'attente quitte la page quand l'écran s'affiche : elle ne côtoie jamais
  // la région d'annonce des dés. Le titre, lui, reste le même nœud : il a pu
  // recevoir le focus à l'arrivée sur l'écran.
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
  let question = false;
  // Pendant une commande, le gardien prévient avant que la séance ait fini :
  // l'écran attend la fin de la commande pour se redessiner.
  let occupe = 0;
  // Ce qui est montré, pour ne réécrire que ce qui change.
  let montree = null;
  let bloqueRendu = null;
  let avisMontre = "null";
  let blocageMontre = "";
  let listeMontree = "";
  let copieMontree = "";
  let journalPose = { combien: 0, premiere: null, derniere: null };
  let commandeDeFin = null;

  const actions = { executer, lancerLeDe, ajouterPersonnage, ajouterAdversaires, placerRencontre, lancer, ouvrirFiche, ouvrirCase };
  const plateau = partiePlateau.creer(actions);
  const fiches = partieFiches.creer(actions);
  const action = partieAction.creer(actions);
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
        if (!estInactif(finDeTour) && commandeDeFin !== null) executer(commandeDeFin, "panneau");
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
        question = false;
        rendreLeMenu();
        nouveau.focus();
      },
    },
    "Annuler",
  );
  // La confirmation se fait dans la page, à la place du bouton : le groupe
  // a la question pour nom, et un lecteur d'écran la dit en y entrant.
  const confirmation = el("div", { classe: "confirmation", role: "group", "aria-labelledby": "combat-question" }, el("p", { id: "combat-question" }, QUESTION), el("div", { classe: "boutons" }, effacer, annuler));
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
  const aide = el("p", { classe: "combat-aide" });
  const zoneDAvis = el("div", { classe: "combat-avis", role: "alert" });
  const panneau = el("section", { classe: "combat-panneau", "aria-label": "Fiche complète" });
  const cadre = el("div", { classe: "combat-cadre" });

  function rendreLeMenu() {
    const ouvert = menuOuvert || question;
    const classe = ouvert ? "combat-autres ouvert" : "combat-autres";
    if (autres.className !== classe) autres.className = classe;
    plus.setAttribute("aria-expanded", String(ouvert));
    const contenu = question ? [confirmation] : [nouveau, raisonDeNouveau];
    if (autres.children.length !== contenu.length || contenu.some((noeud, rang) => autres.children[rang] !== noeud)) autres.replaceChildren(...contenu);
  }

  function demanderUnNouveauCombat() {
    if (perimee() || estInactif(nouveau)) return;
    // Sur un téléphone, le menu reste ouvert : « Annuler » y rend la main au
    // bouton, qui doit se voir.
    menuOuvert = true;
    question = true;
    rendreLeMenu();
    annuler.focus();
  }

  function effacerLeCombat() {
    if (perimee()) return;
    question = false;
    const issue = commander(() => seance.nouveau());
    if (issue.refus) avis = avisDuRefus(issue.refus.message);
    else {
      avis = null;
      cibleChoisie = null;
      caseOuverte = null;
      fermerLaFiche({ focus: false });
      lireLesPersonnages();
    }
    rendreLeMenu();
    rendre({ parCommande: true });
    h1.focus();
  }

  function rendreLaBarre(vue, bloque) {
    poser(etatDuCombat, vue.etat);
    poser(aide, vue.aide);
    const fin = vue.finDeTour;
    commandeDeFin = fin?.commande ?? null;
    finDeTour.hidden = fin === null;
    reglerBouton(finDeTour, raisonDeFin, fin === null || fin.actif === true, fin?.raison ?? null);
    // Un combat ouvert ailleurs se reprend, un combat plus récent ne
    // s'écrase pas : la séance refuserait le combat vide.
    const libre = bloque !== "ailleurs" && bloque !== "recent";
    reglerBouton(nouveau, raisonDeNouveau, libre, libre ? null : gardien.phrase());
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
  // ou d'une autre version), ce bloc prend la place du panneau d'action et
  // dit pourquoi, avec le bouton qui en sort.
  const titreDuBlocage = el("h2", { classe: "combat-qui", tabindex: "-1" });
  const choixDuBlocage = el("div", { classe: "combat-choix" });
  const blocage = { noeud: el("section", { classe: "combat-action", "aria-label": "Combat arrêté" }, titreDuBlocage, choixDuBlocage), listeDeCase: null };

  function rendreLeBlocage(bloque) {
    const bouton = GARDES_QUI_PREVIENNENT[bloque] ?? null;
    const phrase = gardien.phrase();
    const signature = JSON.stringify([phrase, bouton]);
    if (signature === blocageMontre) return;
    blocageMontre = signature;
    poser(titreDuBlocage, phrase);
    choixDuBlocage.replaceChildren(...(bouton ? [boutonDeGarde(bouton)] : []));
  }

  async function reprendre() {
    if (perimee()) return;
    const depart = circuit;
    occupe += 1;
    try {
      await seance.reprendre();
    } finally {
      occupe -= 1;
    }
    if (depart !== circuit || perimee() || !racine.isConnected) return;
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

  // ——— Les commandes des quatre parties ———

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

  function executer(commande, origine = "panneau") {
    if (perimee()) return;
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
    for (const { nom, nombre } of rencontrePreparee(banque)) {
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
    rencontre: rencontrePreparee(banque),
    absents: ecrireAbsents(outils.roles.absents),
  });

  // ——— La liste d'une case (« +k ») ———

  const noeudDeLaCase = (nomDeCase) => [...plateau.noeud.querySelectorAll(".combat-case")].find((noeud) => noeud.getAttribute("data-case") === nomDeCase) ?? null;

  // Des deux « +k » d'une case, la feuille de style n'en montre qu'un,
  // selon la largeur : le focus va à celui qui se voit.
  function focusSurLaCase(nomDeCase) {
    const noeud = noeudDeLaCase(nomDeCase);
    if (noeud === null) return;
    const classe = services.media(ETROIT) === true ? ".combat-plus-etroit" : ".combat-plus-large";
    (noeud.querySelector("[aria-pressed=true]") ?? noeud.querySelector(classe) ?? noeud.querySelector(".combat-case-plus") ?? noeud.querySelector("button"))?.focus();
  }

  const vueDuPlateau = () => vuePlateau(seance.etat(), seance.choisi());

  function fermerLaListe(nomDeCase) {
    caseOuverte = null;
    rendreLaListe(vueDuPlateau());
    focusSurLaCase(nomDeCase);
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
      rendreLaListe(vue);
      focusSurLaCase(nomDeCase);
      return;
    }
    if (jeton.choix === null || jeton.inactif === true) return;
    caseOuverte = null;
    executer(jeton.choix.commande, "panneau");
  }

  function rendreLaListe(vue) {
    const cible = montree?.listeDeCase ?? null;
    const dansLaCase = caseOuverte !== null && Object.hasOwn(vue.cases, caseOuverte) ? vue.cases[caseOuverte].jetons.filter((id) => Object.hasOwn(vue.jetons, id)) : [];
    if (cible === null || dansLaCase.length === 0) caseOuverte = null;
    const avant = vue.phase === "preparation";
    const decrits =
      caseOuverte === null
        ? []
        : dansLaCase.map((id) => {
            const jeton = vue.jetons[id];
            return { id, entier: jeton.entier, nom: jeton.nom, actif: avant || (jeton.choix !== null && jeton.inactif !== true), tenu: avant ? plateau.enMain() === id : null };
          });
    const signature = JSON.stringify([caseOuverte, cible === action.listeDeCase ? "action" : "preparation", decrits]);
    if (signature === listeMontree) return;
    listeMontree = signature;
    for (const noeud of [action.listeDeCase, preparation.listeDeCase]) if (noeud.children.length > 0) noeud.replaceChildren();
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

  function ouvrirCase(nomDeCase) {
    if (perimee() || (montree?.listeDeCase ?? null) === null) return;
    caseOuverte = nomDeCase;
    rendreLaListe(vueDuPlateau());
    montree.listeDeCase.querySelector("h3")?.focus();
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
      const cartes = cadreDeCartes();
      cartes.montrer([{ resolu: appoint.resoudre(appoint.adversaires.get(source.ligne.nom)), numero: seance.etat().noms?.[protagoniste.id]?.exemplaire ?? null }]);
      return [changee, cartes.noeud].filter(Boolean);
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
    (fiche.hasAttribute("open") ? fiche.querySelector("[data-repere=fiche-complete]") : fiche.querySelector("summary"))?.focus();
  }

  function ouvrirFiche(id) {
    if (perimee()) return;
    const protagoniste = seance.miseEnPlace().protagonistes.find((un) => un.id === id) ?? null;
    if (protagoniste === null) return;
    ficheOuverte = id;
    const nom = seance.etat().noms?.[id]?.entier ?? protagoniste.photo.valeurs.nom;
    const tete = el("h2", { tabindex: "-1" }, `Fiche complète : ${nom}`);
    panneau.replaceChildren(tete, el("div", { classe: "boutons" }, el("button", { type: "button", classe: "bouton secondaire", onclick: () => fermerLaFiche() }, "Fermer")), ...contenuDeLaFiche(protagoniste));
    tete.focus();
  }

  // ——— Le journal ———

  const lignesDuJournal = el("ol", { classe: "combat-lignes", tabindex: "0", "aria-label": "Journal du combat" });
  const zoneDeCopie = el("div", { classe: "combat-copie" });
  const boutonCopier = el("button", { type: "button", classe: "bouton secondaire", onclick: () => copier() }, "Copier");
  const boutonTelecharger = el("button", { type: "button", classe: "bouton secondaire", onclick: () => telechargerLeJournal() }, "Télécharger");
  const journal = el("section", { classe: "combat-journal" }, el("div", { classe: "combat-journal-tete" }, el("h2", {}, "Journal"), boutonCopier, boutonTelecharger), lignesDuJournal, zoneDeCopie);

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
    if (perimee() || estInactif(boutonCopier)) return;
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
    if (champ === null) return;
    champ.focus();
    champ.select();
  }

  function telechargerLeJournal() {
    if (perimee() || estInactif(boutonTelecharger)) return;
    services.telecharger(nomDuFichier(seance.etat().lanceLe), `${MARQUE_D_ORDRE}${texteASortir("\r\n")}`, TYPE_DU_FICHIER);
  }

  function rendreLeJournal(etat) {
    const lignes = etat.journal;
    const { combien } = journalPose;
    // Les lignes déjà posées restent ; seules les nouvelles s'ajoutent. Un
    // autre journal (un combat neuf, un combat repris) se repose en entier.
    const suite = lignes.length >= combien && (combien === 0 || (lignes[0] === journalPose.premiere && lignes[combien - 1] === journalPose.derniere));
    if (!suite) lignesDuJournal.replaceChildren();
    const depuis = suite ? combien : 0;
    if (lignes.length > depuis) {
      for (let rang = depuis; rang < lignes.length; rang += 1) {
        const ligne = lignes[rang];
        lignesDuJournal.append(el("li", { classe: ligne.genre === "tour" ? "tour" : ligne.mort === true ? "mort" : null }, ligne.texte));
      }
      // La dernière ligne reste visible.
      lignesDuJournal.scrollTop = lignesDuJournal.scrollHeight;
    }
    if (!suite || lignes.length > depuis) {
      journalPose = { combien: lignes.length, premiere: lignes[0] ?? null, derniere: lignes.at(-1) ?? null };
      // Un texte montré pour une copie à la main ne suit pas le journal : il
      // s'efface dès qu'une ligne s'ajoute.
      retourDeCopie = null;
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

  // ——— Le rendu ———

  function origineDeLaCible(etat) {
    const geste = gesteEnCours(etat);
    if (geste === null || cibleChoisie === null || geste.cible === null) return null;
    return geste.numero === cibleChoisie.numero && geste.cible === cibleChoisie.cible ? cibleChoisie.origine : null;
  }

  // Où va le focus quand la partie montrée change : à la commande qui
  // attend, sinon au titre.
  function focusSurLaPartie() {
    if (montree === action) (action.noeud.querySelector("[data-focus]") ?? h1).focus();
    else if (montree === blocage) titreDuBlocage.focus();
    else h1.focus();
  }

  /**
   * Redessine l'écran d'après le combat du moment. « parCommande » : le rendu
   * suit un geste de la personne, et le focus va à la commande qui attend ;
   * sinon (la première visite, la fin d'une écriture, une lecture qui
   * revient) le focus ne bouge pas.
   */
  function rendre({ parCommande = false } = {}) {
    const etat = seance.etat();
    const choisi = seance.choisi();
    const bloque = seance.bloque();
    bloqueRendu = bloque;
    const enPreparation = etat.phase === "preparation";

    rendreLaBarre(vueBarre(etat), bloque);
    rendreLaGarde();

    const vueDuMoment = vuePlateau(etat, choisi);
    plateau.rendre(vueDuMoment);
    const vues = etat.ordre.map((id) => vueFiche(etat, id, choisi)).filter(Boolean);
    // Les fiches rendent d'elles-mêmes le focus qu'elles portaient : c'est
    // avant le panneau d'action, dont le focus prime.
    fiches.rendre({ pj: vues.filter((vue) => vue.camp === "pj"), adv: vues.filter((vue) => vue.camp !== "pj") }, { etroit: services.media(ETROIT) === true });

    // L'ordre du document est celui du téléphone : la carte, le panneau
    // d'action (ou la préparation), puis les deux camps.
    const aMontrer = bloque !== null ? blocage : enPreparation ? preparation : action;
    const change = aMontrer !== montree;
    let focusPerdu = false;
    if (change) {
      const actif = globalThis.document?.activeElement ?? null;
      focusPerdu = montree !== null && actif !== null && estDans(actif, montree.noeud);
      cadre.replaceChildren(plateau.noeud, aMontrer.noeud, fiches.noeud);
      // Un nœud retiré puis remis dans la page y perd le focus.
      if (!focusPerdu && montree !== null && actif !== null && estDans(actif, cadre)) actif.focus();
      montree = aMontrer;
      // La liste d'une case appartenait à la partie qui vient de céder la place.
      caseOuverte = null;
    }
    // Le panneau d'action se rend même quand il n'est pas montré : sa région
    // d'annonce se vide avec le combat, et ne redit rien d'un combat d'avant.
    const refait = action.rendre(vuePanneau(etat, choisi), { origineDeLaCible: origineDeLaCible(etat) });
    if (aMontrer === preparation) preparation.rendre(vuePreparation(seance.miseEnPlace(), apports()));
    if (bloque !== null) rendreLeBlocage(bloque);

    rendreLaListe(vueDuMoment);
    if (ficheOuverte !== null && !etat.ordre.includes(ficheOuverte)) fermerLaFiche({ focus: false });
    rendreLeJournal(etat);
    rendreAvis();

    if (change && (parCommande || focusPerdu)) focusSurLaPartie();
    else if (parCommande && refait && montree === action) action.noeud.querySelector("[data-focus]")?.focus();
  }

  // ——— L'assemblage ———

  barre.append(etatDuCombat, garde, el("div", { classe: "combat-commandes" }, finDeTour, raisonDeFin, plus, autres));
  racine.append(aide, zoneDAvis, panneau, cadre, journal);
  rendreLeMenu();

  // Une seule visite suit le gardien : celle d'avant se désabonne.
  visiteCourante?.desabonner?.();
  visite.desabonner = gardien.surChangement(() => auChangementDeGarde());
  visiteCourante = visite;

  if (seance.etat().phase === "preparation") lireLesPersonnages();
  rendre();
}
