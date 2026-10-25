// La bulle d'options du simulateur de combat, son onglet et ses infobulles
// (SPECIFICATION.md, § 17, « Le simulateur de combat (lot 4) » ; contrat du
// lot 4, groupe 2, § 9.3 à § 9.5, § 9.7 et § 9.11 ; complément, § 4.1, § 4.2
// et § 4.9).
//
// Ce qu'il fait :
// - la bulle (creer) : un dialogue non modal accroché à la case de qui joue,
//   juste après la carte. Elle porte un en-tête (le nom entier, ou le geste,
//   puis les actions et le souffle), le contenu d'une action que fabrique
//   combat_action.js (la liste des capacités, ou le jet), ou, pendant le
//   combat, la liste d'une case (« +k ») que l'écran remplit ; puis le bouton
//   qui la ferme, ou la réduit après le premier dé, toujours en dernier pour
//   que Tab sorte après lui. Réduite, elle laisse un onglet contre la case
//   (« Taloche [1] : rouvrir »), qui la rouvre. Sur un téléphone, la feuille
//   de style en fait le volet qui monte du bas : la liste seule, sans flèche ;
//   le jet se joue alors sous la carte (combat_action.js) ;
// - les infobulles (creerInfobulles) : une par déclencheur (une ligne, un
//   passif, le nombre des causes, « Jet d'attaque »), cachée et remplie
//   d'emblée, liée à lui, jamais focalisable, ouverte au survol et au focus,
//   tenue tant que le pointeur est sur elle ou sur lui (WCAG 1.4.13), avec
//   les hachures de sa portée sur la carte. La bulle a les siennes ; l'écran
//   crée celles de la zone sous la carte.
//
// Pourquoi il existe : tout ce qui se décide pour un geste se fait à côté du
// jeton (complément, § 4.1). Ce module ne porte AUCUNE règle du jeu et
// n'importe que dom.js et echelle.js : ce qu'il montre se lit dans la vue du
// panneau (vuePanneau), et chaque bouton émet la commande que la vue lui
// donne, avec l'origine « bulle ».
//
// Sa place (ses trois propriétés CSS et sa flèche) se calcule dans
// echelle.js, seul module qui écrive dans la feuille de style d'un nœud ;
// la bulle n'y écrit rien, elle pose la classe de son côté. Elle se replace
// à son ouverture, quand son protagoniste ou le genre de son contenu change
// (l'écran, à qui rendre le dit, appelle replacer), et quand la fenêtre
// change de taille ; une infobulle se place à sa propre ouverture. Jamais au
// défilement, jamais à un dé : le jet qui grandit défile dans la bulle, et la
// page ne défile jamais. Tout focus posé ici l'est sans faire défiler la page.
//
// Ce qui défile dans la bulle (div.combat-bulle-defile) ne bouge que par une
// seule fonction, montrerDansLaBulle, et par son seul scrollTop : remis en
// haut à chaque ouverture, il amène dans la partie vue ce qui reçoit le focus
// et l'aperçu qui s'ouvre sous une ligne (complément, § 4.1, § 4.5 et § 4.9 ;
// relecture du groupe 2, C-03 : la règle 2 du contrat, § 0.2, l'admet
// désormais à côté de la liste du journal). Le défilement de la page, lui,
// n'est jamais touché.
//
// Le doigt se juge au dernier appui, que l'écran retient sur sa racine
// (dernierAppui) : le focus qui suit un appui du doigt, sur le jeton comme sur
// la ligne, n'ouvre pas d'infobulle (spéc. § 17.7).
//
// Le corps de la bulle n'est refait que si ce qu'il montre change : un rendu
// de plus n'efface ni une saisie en cours, ni le focus. Avant de le refaire,
// la bulle vide ses infobulles et efface les hachures ; la composition
// rouvre ensuite l'aperçu gardé, avec les siennes. Un corps refait sans
// ouverture (un dé, un réglage), alors que le focus y était, le rend à la
// commande qui attend.

import { el, sansSensForce } from "./dom.js";
import { FLECHE, placerBulle, tenirLaBulle } from "./echelle.js";

// D'où vient un clic fait dans la bulle : l'écran le range avec la zone pour
// « choisie ici ».
const ORIGINE = "bulle";

// Ce qui ferme ou réduit la bulle : la croix (U+2715) et le tiret court
// (U+2013), écrits par leur code ; leur nom accessible vient de la vue.
const SIGNE_FERMER = "\u2715";
const SIGNE_REDUIRE = "\u2013";
const LIBELLE_FERMER = "Fermer";
const LIBELLE_REDUIRE = "Réduire";

// Les côtés essayés pour la bulle et son onglet, dans l'ordre du complément
// (§ 4.1) : à droite de la case, puis à gauche, dessous, dessus.
const COTES_DE_LA_BULLE = ["droite", "gauche", "dessous", "dessus"];
// La distance visée entre le bord de ce qui se place et le milieu de son
// ancre, en px (contrat, § 9.3).
const POINTE_DE_LA_BULLE = 60;
const POINTE_DE_L_ONGLET = 22;
const POINTE_D_UNE_INFOBULLE = 14;
// Le temps de grâce d'une infobulle que le pointeur quitte, en ms : il peut
// passer du déclencheur à elle sans qu'elle se ferme.
const GRACE = 300;

// Le nom de la bulle quand elle porte la liste d'une case : le titre de
// cette liste, que l'écran écrit (« Case D4 »).
const ID_DU_TITRE_DE_LA_CASE = "combat-bulle-case-titre";

const present = (valeur) => valeur !== null && valeur !== undefined;
const rempli = (texte) => present(texte) && texte !== "";

/** La taille de la fenêtre, lue dans la page. */
function fenetreDeLaPage() {
  const racine = globalThis.document?.documentElement;
  return { largeur: racine?.clientWidth ?? 0, hauteur: racine?.clientHeight ?? 0 };
}

/** La fenêtre que l'écran a donnée (sa taille, ou de quoi la lire), sinon celle de la page. */
function fenetreDe(ecran) {
  if (typeof ecran?.fenetre === "function") return ecran.fenetre();
  return ecran?.fenetre ?? fenetreDeLaPage();
}

/** La fenêtre telle qu'elle est maintenant, quand elle vient de changer de taille. */
function fenetreFraiche(ecran) {
  return typeof ecran?.fenetre === "function" ? ecran.fenetre() : fenetreDeLaPage();
}

// ——— Les infobulles ———

// Le numéro de la dernière infobulle, commun à toutes les couches : la bulle
// et la zone sont dans la page en même temps, et leurs infobulles ne
// partagent aucun identifiant.
let numeroDInfobulle = 0;

// Le minuteur de la page, lu au moment de l'appel.
const MINUTEUR_DE_LA_PAGE = {
  poser: (faire, ms) => globalThis.setTimeout(faire, ms),
  retirer: (numero) => globalThis.clearTimeout(numero),
};

/**
 * Les côtés de l'infobulle d'une ligne : du côté de la bulle opposé au
 * jeton, puis de l'autre, puis dessous. La bulle à gauche de sa case : à
 * gauche d'abord ; à droite, dessous ou dessus : à droite d'abord.
 */
function cotesDUneLigne(repere) {
  const classes = String(repere.className ?? "").split(/\s+/);
  if (classes.includes("combat-bulle-gauche")) return ["gauche", "droite", "dessous"];
  return ["droite", "gauche", "dessous"];
}

/** L'ancre de l'infobulle d'une ligne : les bords gauche et droit de la bulle, le haut et le bas de la ligne. */
function bordsDeLaLigne(repere, ligne) {
  return {
    getBoundingClientRect() {
      const bulle = repere.getBoundingClientRect();
      const place = ligne.getBoundingClientRect();
      return { left: bulle.left, right: bulle.right, top: place.top, bottom: place.bottom };
    },
  };
}

/**
 * Les infobulles d'une couche. couche : le div.combat-infobulles où elles
 * vivent ; repere : ce sur quoi elles se posent (la bulle, ou la zone sous la
 * carte), un nœud ou une fonction qui le rend, à défaut le parent de la
 * couche ; actions : { hachurer(noms | null) } ; services : { minuteur,
 * fenetre, dernierAppui } (minuteur : { poser(f, ms), retirer(n) } ;
 * fenetre() : { largeur, hauteur } ; dernierAppui() : le genre du dernier
 * appui sur l'écran, « touch », « mouse », « clavier » ou null).
 * Rend { lier, fermer, vider }.
 *
 * lier(declencheur, { contenu, hachures, cotes }) : contenu, une fonction qui
 * rend ses nœuds (nulle, ou qui ne rend rien : les hachures seules, sans
 * infobulle) ; hachures, les cases à hachurer pendant qu'elle est ouverte ;
 * cotes, ses côtés (nuls : ceux d'une ligne, et son ancre est la ligne à la
 * largeur de la bulle ; sinon, son ancre est le déclencheur). Au doigt
 * (pointerType « touch »), ni le survol ni le focus qui suit l'appui n'en
 * ouvrent : c'est l'aperçu qui dit la ligne, avec ses hachures, que
 * l'infobulle effacerait. L'appui peut avoir été fait sur le déclencheur, ou
 * ailleurs sur l'écran (le jeton qui ouvre la bulle) : services.dernierAppui
 * le dit.
 *
 * fermer() (Échap) ferme l'ouverte, sans bouger le focus, et rend vrai s'il
 * y avait quelque chose à voir : son contenu, ou ses seules hachures sur la
 * carte (« Jet d'attaque »). vider() les retire toutes, à chaque corps
 * refait, sans toucher aux hachures : c'est l'appelant qui les efface.
 */
export function creerInfobulles({ couche, repere = null, actions = {}, services = {} } = {}) {
  const minuteur = services.minuteur ?? MINUTEUR_DE_LA_PAGE;
  const laFenetre = () => (typeof services.fenetre === "function" ? services.fenetre() : fenetreDeLaPage());
  const leRepere = () => (typeof repere === "function" ? repere() : repere) ?? couche?.parentNode ?? null;
  const hachurer = (noms) => actions.hachurer?.(noms);
  // L'infobulle ouverte (une seule à la fois), et la fermeture qui attend.
  let ouverte = null;
  let attente = null;

  function retirerLAttente() {
    if (attente === null) return;
    minuteur.retirer(attente);
    attente = null;
  }

  function fermerLEntree(entree) {
    if (ouverte !== entree) return;
    retirerLAttente();
    ouverte = null;
    if (entree.noeud !== null) entree.noeud.hidden = true;
    hachurer(null);
  }

  // Placée à son ouverture, montrée : sa taille se mesure.
  function placer(entree) {
    const fond = leRepere();
    if (fond === null) return;
    const cotes = entree.cotes ?? cotesDUneLigne(fond);
    const ancre = entree.cotes ? entree.declencheur : bordsDeLaLigne(fond, entree.declencheur);
    const { cote } = placerBulle(entree.noeud, { ancre, repere: fond, fenetre: laFenetre(), cotes, ecart: FLECHE, pointe: POINTE_D_UNE_INFOBULLE });
    entree.noeud.className = `combat-infobulle combat-infobulle-${cote}`;
  }

  function ouvrir(entree) {
    if (ouverte === entree) {
      retirerLAttente();
      return;
    }
    if (ouverte !== null) fermerLEntree(ouverte);
    ouverte = entree;
    hachurer(entree.hachures);
    if (entree.noeud === null) return;
    entree.noeud.hidden = false;
    placer(entree);
  }

  // Le pointeur est parti, et le déclencheur n'a pas le focus : elle se
  // ferme dans GRACE ms, à moins qu'il revienne sur elle ou sur lui.
  function armer(entree) {
    if (ouverte !== entree || entree.survolee || entree.focalisee) return;
    retirerLAttente();
    attente = minuteur.poser(() => {
      attente = null;
      if (!entree.survolee && !entree.focalisee) fermerLEntree(entree);
    }, GRACE);
  }

  function lier(declencheur, { contenu = null, hachures = null, cotes = null } = {}) {
    const noeuds = typeof contenu === "function" ? [contenu()].flat(Infinity).filter(present) : [];
    let noeud = null;
    if (noeuds.length > 0) {
      numeroDInfobulle += 1;
      const id = `combat-info-${numeroDInfobulle}`;
      noeud = el("div", { classe: "combat-infobulle", role: "tooltip", id, hidden: true }, noeuds);
      couche.append(noeud);
      // Après la raison d'une ligne inactive, que le déclencheur porte déjà.
      const decrit = declencheur.getAttribute("aria-describedby");
      declencheur.setAttribute("aria-describedby", rempli(decrit) ? `${decrit} ${id}` : id);
    }
    const entree = { declencheur, noeud, hachures, cotes, survolee: false, focalisee: false };
    let auDoigt = false;
    declencheur.addEventListener("pointerdown", (evenement) => {
      auDoigt = evenement.pointerType === "touch";
    });
    declencheur.addEventListener("pointerenter", (evenement) => {
      if (evenement.pointerType === "touch") return;
      entree.survolee = true;
      ouvrir(entree);
    });
    declencheur.addEventListener("pointerleave", () => {
      entree.survolee = false;
      armer(entree);
    });
    declencheur.addEventListener("focus", () => {
      if (auDoigt || services.dernierAppui?.() === "touch") {
        auDoigt = false;
        return;
      }
      entree.focalisee = true;
      ouvrir(entree);
    });
    declencheur.addEventListener("blur", () => {
      auDoigt = false;
      entree.focalisee = false;
      if (!entree.survolee) fermerLEntree(entree);
    });
    if (noeud === null) return;
    noeud.addEventListener("pointerenter", () => {
      entree.survolee = true;
      if (ouverte === entree) retirerLAttente();
    });
    noeud.addEventListener("pointerleave", () => {
      entree.survolee = false;
      armer(entree);
    });
  }

  // Les seules hachures d'un déclencheur sans contenu (« Jet d'attaque ») se
  // voient sur la carte : Échap les efface d'abord, comme une infobulle. Une
  // infobulle dont le déclencheur a quitté la page (un corps refait sans
  // vider), ou qui ne montrait rien, ne compte pas : Échap passe à la suite.
  function fermer() {
    const entree = ouverte;
    if (entree === null) return false;
    fermerLEntree(entree);
    return (entree.noeud !== null || (entree.hachures?.length ?? 0) > 0) && entree.declencheur.isConnected !== false;
  }

  function vider() {
    retirerLAttente();
    ouverte = null;
    couche?.replaceChildren();
  }

  return { lier, fermer, vider };
}

// ——— La bulle ———

/**
 * Ce que montre la bulle (contrat, § 9.4) : « case » (la liste d'une case),
 * « jet », « liste », ou null (cachée). Sur un ordinateur : la liste d'une
 * case pendant le combat ; sinon, une action non réduite, son jet s'il y a
 * un geste. Sur un téléphone, le volet : la liste d'une action, sans geste ni
 * case ouverte.
 */
function contenuDe(vue, ecran, reduite) {
  const caseOuverte = present(ecran.caseOuverte) ? ecran.caseOuverte : null;
  const action = vue.genre === "action";
  if (ecran.etroit === true) return action && !vue.geste && caseOuverte === null ? "liste" : null;
  if (caseOuverte !== null && (action || vue.genre === "qui_joue")) return "case";
  if (!action || reduite) return null;
  return vue.geste ? "jet" : "liste";
}

/**
 * Le protagoniste de la vue : elle ne le nomme que dans la commande de
 * « Passer son tour », toujours là quand quelqu'un agit (contrat, § 8.1).
 */
const protagonisteDe = (vue) => vue?.passer?.commande?.evenement?.qui ?? null;

const memoireVide = () => ({ reglagesOuverts: false, apercu: null, causesOuvertes: false });

// Ce qui reçoit le focus par Tab : un bouton, un champ, un résumé, un lien,
// ou ce qui porte un tabindex positif ou nul ; jamais un titre à tabindex -1.
const TABULABLES = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);

function tabulable(element) {
  const rang = element.getAttribute("tabindex");
  if (rang !== null) return Number(rang) >= 0;
  if (element.disabled === true) return false;
  return TABULABLES.has(element.tagName) || (element.tagName === "A" && element.hasAttribute("href"));
}

/** Les éléments montrés d'un nœud, dans l'ordre du document. */
function* elementsMontres(racine) {
  for (const enfant of racine.children) {
    if (enfant.hidden) continue;
    yield enfant;
    yield* elementsMontres(enfant);
  }
}

/** Vrai si rien de tabulable ne précède la cible dans la bulle : Maj+Tab sortirait d'elle vers la carte. */
function rienDeTabulableAvant(racine, cible) {
  for (const element of elementsMontres(racine)) {
    if (element === cible) return true;
    if (tabulable(element)) return false;
  }
  return false;
}

/** La première ligne active (« Passer son tour » compris), ou null. */
function premiereLigneActive(lieu) {
  return [...lieu.querySelectorAll("button.combat-capacite")].find((bouton) => bouton.getAttribute("aria-disabled") !== "true") ?? null;
}

/** Écrit un texte dans un nœud, s'il a changé : sans signe qui commande le sens de l'écriture. */
function ecrire(noeud, texte) {
  const net = sansSensForce(texte ?? "");
  if (noeud.textContent !== net) noeud.replaceChildren(net);
}

/**
 * La bulle. `actions` : { executer(commande, origine), lancerLeDe(),
 * hachurer(noms | null), focusSurLeJeton(id), focusSurLaCase(nomDeCase),
 * fermerLaCase(), rafraichir() } ; composerListe et composerGeste fabriquent
 * son contenu (combat_action.js) ; dernierAppui() dit le genre du dernier
 * appui sur l'écran, que ses infobulles lisent. Rend { noeud, onglet,
 * listeDeCase, rendre, focaliser, echap, fermerLInfobulle, dehors, auDehors,
 * replacer, oublier }.
 *
 * rendre(vue, ecran) → { montree, ouverture } ; vue : vuePanneau ; ecran :
 * { etroit, caseOuverte, ancre, repere, fenetre, origineDeLaCible } (ancre : la
 * case active ; repere : div.combat-cadre ; fenetre : { largeur, hauteur },
 * ou de quoi la lire). ouverture est vrai quand la bulle paraît, change de
 * protagoniste ou de genre de contenu : l'écran la replace alors, et, si le
 * rendu suit une commande, appelle focaliser().
 *
 * Fermer (la croix, Échap, clic au-dehors), avant le premier dé : la
 * commande de vue.fermeture, depuis la bulle ; la séance joue d'abord
 * « revenir ». Réduire, après : la bulle se cache, l'onglet paraît. La croix
 * et le tiret rendent le focus au jeton ; echap() et auDehors() ne le bougent
 * pas (l'écran, après Échap, le met au jeton). La liste d'une case se ferme
 * comme son bouton « Fermer » : actions.fermerLaCase().
 *
 * fermerLInfobulle() ferme l'infobulle ouverte (ou les seules hachures de
 * « Jet d'attaque »), sans bouger le focus, et rend vrai s'il y avait
 * quelque chose à voir : l'écran la demande à Échap, où que soit le focus.
 *
 * Le geste fini, ou la bulle fermée, la vue dit « Qui joue ? » : le focus va
 * au jeton (l'écran se refait pendant executer, comme au groupe 1). Quand la
 * fenêtre change de taille, l'infobulle ouverte se ferme, l'écran se refait
 * si la largeur a changé (actions.rafraichir : le téléphone se juge à la
 * largeur, que la bulle ne lit pas), puis la bulle se replace.
 *
 * Deux mémoires, reduite et celle du contenu (l'aperçu ouvert, les réglages
 * dépliés, l'explication des causes), remise à zéro quand le geste change ;
 * oublier() les remet à zéro (« Annuler le geste »).
 *
 * Ce qui défile dans la bulle revient en haut à chaque ouverture (et quand
 * l'onglet la rouvre) ; ce qui reçoit le focus, et l'aperçu qui s'ouvre sous
 * une ligne, y sont amenés dans la partie vue (montrerDansLaBulle).
 */
export function creer(actions, { composerListe, composerGeste, dernierAppui = null }) {
  const titre = el("h2", { classe: "combat-bulle-titre", tabindex: "-1" });
  const sous = el("p", { classe: "combat-bulle-sous" });
  const tete = el("div", { classe: "combat-bulle-tete" }, titre, sous);
  const listeDeCase = el("div", { classe: "combat-case-liste" });
  const defile = el("div", { classe: "combat-bulle-defile" });
  const couche = el("div", { classe: "combat-infobulles" });
  const poignee = el("span", { classe: "combat-bulle-poignee", "aria-hidden": "true" });
  const fermer = el("button", { type: "button", classe: "combat-bulle-fermer", "aria-label": LIBELLE_FERMER, onclick: () => surLeBoutonFermer() }, SIGNE_FERMER);
  const noeud = el("div", { classe: "combat-bulle", role: "dialog", hidden: true, onkeydown: (evenement) => auClavier(evenement) }, tete, defile, couche, fermer);
  const onglet = el("button", { type: "button", classe: "combat-onglet", hidden: true, onclick: () => rouvrir() });

  const memoire = memoireVide();
  let derniereVue = null;
  let dernierEcran = {};
  let reduite = false;
  // Ce que la bulle montre (« liste », « jet », « case », ou null), et pour qui.
  let contenuMontre = null;
  let cleMontree = null;
  // La signature du corps, la clé du geste (pour la mémoire), le côté posé.
  let rendue = null;
  let gesteGarde = null;
  let cote = null;
  let etroitMontre = false;
  // La clé du réglage qui garde le focus, le temps que l'écran redessine.
  let gardee = null;
  // La largeur de la fenêtre au dernier changement de taille, et l'écouteur
  // de la fenêtre, posé au premier rendu : la bulle se replace tant qu'elle
  // est dans la page, et l'écran se refait quand la largeur change, la bulle
  // montrée ou non.
  let largeurVue = null;
  let tenue = false;

  const infobulles = creerInfobulles({
    couche,
    repere: noeud,
    actions: { hachurer: (noms) => actions.hachurer?.(noms) },
    services: { fenetre: () => fenetreDe(dernierEcran), dernierAppui },
  });

  const garder = (cle) => {
    gardee = cle;
  };

  // Ce que le contenu émet passe par ici : le geste fini, la bulle cachée et
  // la vue qui dit « Qui joue ? », le focus va au jeton de qui jouait.
  function executerPuisSuivre(commande, origine = ORIGINE) {
    const etaitMontree = contenuMontre !== null;
    const qui = protagonisteDe(derniereVue);
    actions.executer(commande, origine);
    if (etaitMontree && contenuMontre === null && derniereVue?.genre === "qui_joue") actions.focusSurLeJeton?.(qui);
  }

  /**
   * Le seul défilement de la bulle : celui de ce qui défile en elle, par son
   * scrollTop, jamais celui de la page. duHaut le remet en haut (une
   * ouverture) ; un nœud qu'il porte et que la partie vue ne montre pas
   * entier y est amené, par le plus court : le haut d'abord s'il est plus
   * grand qu'elle.
   */
  function montrerDansLaBulle(noeud, { duHaut = false } = {}) {
    if (duHaut) defile.scrollTop = 0;
    if (!noeud || !defile.contains(noeud)) return;
    const vue = defile.getBoundingClientRect();
    const boite = noeud.getBoundingClientRect();
    if (boite.top < vue.top) defile.scrollTop -= vue.top - boite.top;
    else if (boite.bottom > vue.bottom) defile.scrollTop += Math.min(boite.bottom - vue.bottom, boite.top - vue.top);
  }

  const actionsDuContenu = {
    executer: (commande, origine) => executerPuisSuivre(commande, origine),
    lancerLeDe: () => actions.lancerLeDe?.(),
    hachurer: (noms) => actions.hachurer?.(noms),
    // L'aperçu qui s'ouvre sous une ligne se montre dans la partie vue.
    montrer: (noeud) => montrerDansLaBulle(noeud),
  };

  const classes = () =>
    ["combat-bulle", contenuMontre === "jet" ? "combat-bulle-jet" : null, cote !== null ? `combat-bulle-${cote}` : null].filter(present).join(" ");

  // La poignée du volet n'est dans la bulle que sous 56rem.
  function poserLaPoignee(etroit) {
    if (etroit === etroitMontre) return;
    etroitMontre = etroit;
    noeud.replaceChildren(...(etroit ? [poignee] : []), tete, defile, couche, fermer);
  }

  // Le nom du dialogue : celui de la vue ; la liste d'une case, son titre.
  function nommer() {
    if (contenuMontre === "case") {
      const titreDeLaCase = listeDeCase.querySelector("h3");
      if (titreDeLaCase !== null && !titreDeLaCase.id) titreDeLaCase.setAttribute("id", ID_DU_TITRE_DE_LA_CASE);
      noeud.removeAttribute("aria-label");
      noeud.setAttribute("aria-labelledby", titreDeLaCase?.id || ID_DU_TITRE_DE_LA_CASE);
      return;
    }
    noeud.removeAttribute("aria-labelledby");
    noeud.setAttribute("aria-label", sansSensForce(derniereVue?.nom ?? ""));
  }

  // Un corps refait sans ouverture (un dé, un réglage) rend le focus qu'il
  // avait à la commande qui attend ; à une ouverture, c'est l'écran qui le
  // pose, une fois la bulle placée.
  function refaireLeCorps(vue, contenu, ouverture) {
    const avaitLeFocus = !ouverture && defile.contains(globalThis.document?.activeElement ?? null);
    // Avant la composition, qui rouvre l'aperçu gardé et repose ses hachures.
    infobulles.vider();
    actions.hachurer?.(null);
    if (contenu === "case") {
      defile.replaceChildren(listeDeCase);
    } else {
      const r = {
        actions: actionsDuContenu,
        origine: ORIGINE,
        origineDeLaCible: dernierEcran.origineDeLaCible ?? null,
        focus: gardee ?? vue.focus ?? null,
        garder,
        pose: false,
        compteur: 0,
        lier: infobulles.lier,
        memoire,
        cles: new Map(),
      };
      const noeuds = (contenu === "jet" ? composerGeste : composerListe)(r, vue);
      // Le réglage gardé n'est plus dans le corps refait : le focus va, comme
      // toujours, à la commande qui attend.
      if (!r.pose && gardee !== null && r.cles.has(vue.focus ?? null)) {
        r.cles.get(vue.focus).setAttribute("data-focus", vue.focus);
        r.pose = true;
      }
      defile.replaceChildren(...[noeuds].flat(Infinity).filter(present));
    }
    if (avaitLeFocus) focaliser();
  }

  function cacher() {
    if (contenuMontre !== null) {
      infobulles.vider();
      actions.hachurer?.(null);
      defile.replaceChildren();
    }
    contenuMontre = null;
    cleMontree = null;
    rendue = null;
    cote = null;
    noeud.className = classes();
    noeud.hidden = true;
  }

  function rendre(vue, ecran = {}) {
    derniereVue = vue;
    dernierEcran = ecran ?? {};
    if (largeurVue === null) largeurVue = fenetreFraiche(dernierEcran).largeur;
    if (!tenue) {
      tenirLaBulle(noeud, quandLaFenetreChange);
      tenue = true;
    }
    const etroit = dernierEcran.etroit === true;
    if (vue.fermeture?.genre !== "reduire") reduite = false;
    const cleDuGeste = vue.genre === "action" ? JSON.stringify([vue.nom ?? "", vue.geste ? "jet" : "liste"]) : null;
    if (cleDuGeste !== gesteGarde) {
      gesteGarde = cleDuGeste;
      Object.assign(memoire, memoireVide());
    }
    poserLaPoignee(etroit);
    if (etroit) cote = null;

    const contenu = contenuDe(vue, dernierEcran, reduite);
    let ouverture = false;
    if (contenu === null) cacher();
    else {
      const cle = JSON.stringify([contenu, contenu === "case" ? dernierEcran.caseOuverte : (vue.nom ?? "")]);
      ouverture = cle !== cleMontree;
      cleMontree = cle;
      contenuMontre = contenu;
      noeud.hidden = false;
      noeud.className = classes();
      nommer();
      tete.hidden = contenu === "case";
      ecrire(titre, vue.entete?.titre);
      ecrire(sous, vue.entete?.sous);
      sous.hidden = !rempli(vue.entete?.sous);
      const parReduction = contenu !== "case" && vue.fermeture?.genre === "reduire";
      ecrire(fermer, parReduction ? SIGNE_REDUIRE : SIGNE_FERMER);
      fermer.setAttribute("aria-label", parReduction ? (vue.fermeture.libelle ?? LIBELLE_REDUIRE) : contenu === "case" ? LIBELLE_FERMER : (vue.fermeture?.libelle ?? LIBELLE_FERMER));
      // La signature de ce que montre le corps : un rendu égal ne le refait pas.
      const signature = JSON.stringify([contenu, contenu === "case" ? dernierEcran.caseOuverte : { ...vue, annonce: undefined }, contenu === "jet" ? (dernierEcran.origineDeLaCible ?? null) : null]);
      if (signature !== rendue) {
        rendue = signature;
        refaireLeCorps(vue, contenu, ouverture);
      }
      // Ouverte, elle se lit du haut : un défilement d'avant cacherait sa
      // première ligne, qui va recevoir le focus.
      if (ouverture) montrerDansLaBulle(null, { duHaut: true });
    }

    const ongletMontre = !etroit && vue.genre === "action" && reduite;
    onglet.hidden = !ongletMontre;
    if (ongletMontre) ecrire(onglet, vue.fermeture?.onglet);
    return { montree: contenu !== null, ouverture };
  }

  // La place de la bulle, ou de l'onglet, contre la case active, dans le
  // repère du cadre. Sous 56rem, la feuille place le volet.
  function placer(fenetre) {
    if (dernierEcran.etroit === true) return;
    const ancre = dernierEcran.ancre ?? null;
    const repere = dernierEcran.repere ?? null;
    if (ancre === null || repere === null) return;
    if (contenuMontre !== null) {
      infobulles.fermer();
      nommer();
      // La colonne voisine de la case reste libre : l'écart vaut le côté d'une case, plus la flèche.
      const ecart = Math.round(ancre.getBoundingClientRect().width) + FLECHE;
      cote = placerBulle(noeud, { ancre, repere, fenetre, cotes: COTES_DE_LA_BULLE, ecart, pointe: POINTE_DE_LA_BULLE }).cote;
      noeud.className = classes();
    }
    if (!onglet.hidden) placerBulle(onglet, { ancre, repere, fenetre, cotes: COTES_DE_LA_BULLE, ecart: FLECHE, pointe: POINTE_DE_L_ONGLET });
  }

  function replacer() {
    placer(fenetreDe(dernierEcran));
  }

  function quandLaFenetreChange() {
    infobulles.fermer();
    const largeur = fenetreFraiche(dernierEcran).largeur;
    if (largeur !== largeurVue) {
      largeurVue = largeur;
      actions.rafraichir?.();
    }
    placer(fenetreFraiche(dernierEcran));
  }

  /** Le focus dans la bulle : la commande qui attend, sinon la première ligne active, sinon le titre. */
  function focaliser() {
    if (contenuMontre === null) return false;
    nommer();
    const titreDuContenu = (contenuMontre === "case" ? listeDeCase.querySelector("h3") : null) ?? titre;
    const cible = defile.querySelector("[data-focus]") ?? premiereLigneActive(defile) ?? titreDuContenu;
    cible.focus({ preventScroll: true });
    // Sans défiler la page, mais la commande qui attend se voit dans la bulle.
    montrerDansLaBulle(cible);
    return true;
  }

  // Réduite après le premier dé : la bulle se cache, l'onglet paraît contre la case.
  function reduire() {
    if (derniereVue?.genre !== "action" || derniereVue.fermeture?.genre !== "reduire") return false;
    reduite = true;
    rendre(derniereVue, dernierEcran);
    replacer();
    return true;
  }

  // L'onglet rouvre la bulle, la replace, et met le focus sur la commande qui attend.
  function rouvrir() {
    if (!reduite || derniereVue === null) return;
    reduite = false;
    rendre(derniereVue, dernierEcran);
    replacer();
    montrerDansLaBulle(null, { duHaut: true });
    focaliser();
  }

  // Fermer ou réduire, sans bouger le focus (Échap, clic au-dehors).
  function fermerOuReduire() {
    if (contenuMontre === null) return null;
    if (contenuMontre === "case") {
      actions.fermerLaCase?.();
      return "fermee";
    }
    const fermeture = derniereVue?.fermeture ?? null;
    if (fermeture?.genre === "fermer") {
      actions.executer(fermeture.commande, ORIGINE);
      return "fermee";
    }
    if (fermeture?.genre === "reduire" && reduire()) return "reduite";
    return null;
  }

  // La croix ferme, le tiret réduit ; le focus va au jeton.
  function surLeBoutonFermer() {
    if (contenuMontre === "case") {
      actions.fermerLaCase?.();
      return;
    }
    const fermeture = derniereVue?.fermeture ?? null;
    if (fermeture?.genre === "fermer") executerPuisSuivre(fermeture.commande, ORIGINE);
    else if (fermeture?.genre === "reduire" && reduire()) actions.focusSurLeJeton?.(protagonisteDe(derniereVue));
  }

  // Maj+Tab depuis le premier élément de la bulle revient au jeton ; pour la
  // liste d'une case, au « +k » qui l'a ouverte, qui en tient lieu. Sans
  // protagoniste ni case, l'appui n'est pas pris : le navigateur fait. Tab
  // après la croix sort de la bulle, qui reste ouverte : ni piège ni modale.
  function auClavier(evenement) {
    if (evenement.key !== "Tab" || evenement.shiftKey !== true) return;
    if (!rienDeTabulableAvant(noeud, evenement.target)) return;
    if (contenuMontre === "case" && present(dernierEcran.caseOuverte)) {
      evenement.preventDefault();
      actions.focusSurLaCase?.(dernierEcran.caseOuverte);
      return;
    }
    const qui = protagonisteDe(derniereVue);
    if (qui === null) return;
    evenement.preventDefault();
    actions.focusSurLeJeton?.(qui);
  }

  /** Échap : l'infobulle d'abord, puis la bulle (fermée ou réduite) ; rien si elle est cachée. */
  function echap() {
    if (infobulles.fermer()) return "infobulle";
    return fermerOuReduire();
  }

  /** L'infobulle ouverte, ou les seules hachures de « Jet d'attaque » : fermées sans bouger le focus ; vrai s'il y avait à voir. */
  const fermerLInfobulle = () => infobulles.fermer();

  /** Vrai pour un nœud hors de la bulle et de son onglet, la bulle montrée. */
  const dehors = (cible) => contenuMontre !== null && !noeud.contains(cible) && !onglet.contains(cible);

  /** Un clic hors de la bulle, de son onglet et de la carte : elle se ferme ou se réduit ; le focus reste. */
  function auDehors() {
    fermerOuReduire();
  }

  function oublier() {
    reduite = false;
    gardee = null;
    rendue = null;
    Object.assign(memoire, memoireVide());
    infobulles.fermer();
  }

  return { noeud, onglet, listeDeCase, rendre, focaliser, echap, fermerLInfobulle, dehors, auDehors, replacer, oublier };
}
