// Le plateau du combat (SPECIFICATION.md, § 17, « Le simulateur de combat
// (lot 4) » ; mission du lot 4, § 10.4 et § 10.7).
//
// C'est la carte de 10 × 10 cases, ses jetons et sa légende : l'une des
// quatre parties de l'écran du combat. Elle ne sait rien du jeu : elle montre
// la vue qu'on lui donne (vuePlateau, js/combat/lecture.js), où chaque jeton
// et chaque case qu'on peut choisir arrive avec son nom et sa commande, et
// elle rend la main à l'écran par « actions ». Elle existe à part pour que
// les cent cases ne se créent qu'une fois, et que seul change ce dont la vue
// a changé.
//
// Avant le lancement, la vue ne porte aucun choix : c'est ici qu'on déplace
// un jeton. Trois moyens mènent au même ordre, « poser » : toucher le jeton
// puis une case, le faire glisser, ou le champ « Case » de sa fiche (qui est
// à la partie des fiches). Le glisser-déposer n'est jamais le seul moyen : il
// n'existe ni au clavier ni au doigt.
//
// Quand on ne joue pas (un combat ouvert ailleurs), l'écran le dit : la carte
// montre alors le combat sans rien offrir. Aucun jeton ne porte de commande,
// aucune case ne se choisit, rien ne se prend en main : un clic que la séance
// refuserait ne s'offre pas.
//
// Au groupe 2 (contrat du groupe 2, § 8.5 et § 9.9 ; complément, § 4.2), la
// carte hachure la portée de la capacité survolée : « hachurer », que l'écran
// passe à la bulle et à ses infobulles, pose la classe « portee » sur les
// cases qu'on lui nomme, et ne récrit que les cases dont la marque change.
// Un jeton peut aussi porter une raison (« Une action est en cours. ») : son
// titre la dit sur une seconde ligne, et un lecteur d'écran l'entend par un
// texte caché, celui du jeton focalisé ou survolé.
//
// Ce qu'elle garde pour elle : le jeton « en main », le jeton qu'on fait
// glisser, les cases hachurées, le jeton dont le texte caché dit la raison,
// et le texte de ce que montre chaque case et chaque jeton.
//
// Au lot 4.3, vague 3 (contrat de la vague, § 3.4, § 4.2 et § 5.2) :
// - un jeton pâlit quand son protagoniste a tout joué (« epuise »), et porte
//   une pastille quand il porte un état (« blessure » ou « alerte ») ;
// - le menu du MJ : en Mode MJ, le clic droit l'ouvre près du jeton ; l'appui
//   long d'une demi-seconde aussi, au minuteur de la page ; hors Mode MJ, le
//   clic droit garde le menu du navigateur, et l'appui long dit où le trouver.
//   Un menu inactif dit sa raison ;
// - un jeton actionné sans choix le dit à l'écran (« jetonSansChoix ») : après
//   le premier dé, Entrée sur le jeton de qui joue rend le focus à la bulle ;
// - la légende dit « a tout joué », et, au téléphone, « portée de la
//   capacité choisie » ;
// - « demanderUneCase » fait choisir une case (un déplacement du MJ ou de la
//   palette), nommée par qui la demande ; Échap ou « finirLaDemande » y met
//   fin ;
// - deux places que l'écran remplit, que le plateau crée une fois et ne
//   touche plus : « surimpression », le dé tiré, dernier enfant de la grille
//   et caché aux lecteurs d'écran ; « emplacementMj », dans l'en-tête, où
//   l'écran pose l'interrupteur du Mode MJ.

import { el, sansSensForce } from "./dom.js";
import { COLONNES, COTE } from "../combat/regles.js";

// Le nom de la région, tel qu'il se lit à l'écran : dans le code, cette
// grille s'appelle le plateau.
const TITRE = "Carte";
// Une case montre trois jetons au plus. Sous 56rem, la feuille de style
// cache le troisième : d'où deux « +k », dont elle ne montre qu'un.
const MONTRES = 3;
const MONTRES_ETROIT = 2;
// Au-delà de deux signes (« M12 », à partir du dixième exemplaire d'un
// adversaire), des initiales ne tiennent plus dans le rond d'un téléphone à
// la taille des autres : une classe les signale à la feuille de style.
const INITIALES_COURTES = 2;
const LEGENDE = [
  ["combat-pj", "personnage"],
  ["combat-adv", "adversaire"],
  ["joue", "joue"],
  ["cible", "cible"],
  ["epuise", "a tout joué"],
  ["mort", "mort, barré"],
  ["portee", "portée de la capacité survolée"],
];
// Au téléphone, la portée hachurée est celle de la capacité touchée
// (mission du lot 4.3, § 6, point 4).
const PORTEE_AU_DOIGT = "portée de la capacité choisie";
// Les pastilles qu'un jeton peut porter (contrat de la vague 3, § 5.2).
const PASTILLES = ["blessure", "alerte"];
// L'appui long qui ouvre le menu du MJ : une demi-seconde (mission du lot
// 4.3, § 4.8).
const APPUI_LONG = 500;
const MENU_EN_MODE_MJ = `Le menu du MJ s'ouvre en Mode MJ (menu ${String.fromCodePoint(0x22ef)}).`;
// Le minuteur de la page, quand l'écran n'en donne pas.
const MINUTEUR_DE_LA_PAGE = { poser: (faire, ms) => setTimeout(faire, ms), retirer: (numero) => clearTimeout(numero) };
// Le texte caché qui dit la raison d'un jeton : un seul pour la carte, que
// chaque jeton à raison nomme par aria-describedby.
const RAISON = "combat-plateau-raison";
// L'en-tête de la carte, tel que sur la maquette : ce qu'elle est et comment
// s'y compte une distance ; puis, pour qui a une souris, où lire un nom
// entier (le titre de chaque jeton).
const EN_TETE = "Carte de 10 × 10 cases · une diagonale compte pour une case";
const AU_SURVOL = "Survolez un jeton pour son nom complet";

/**
 * Le nom court d'un jeton, en deux morceaux : le nom, que la case peut
 * couper, et le numéro d'exemplaire qui le finit (« Marmiton 2 »), qu'elle ne
 * coupe jamais. Sans lui, deux exemplaires d'une même case porteraient le
 * même nom coupé. C'est de l'affichage : le nom court vient de la vue.
 */
function morceauxDuNom(nomCourt) {
  const lu = /^(.*\S)\s+(\d+)$/su.exec(nomCourt);
  const debut = el("span", { classe: "combat-nom-debut" }, lu ? lu[1] : nomCourt);
  return lu ? [debut, " ", el("span", { classe: "combat-nom-numero" }, lu[2])] : [debut];
}

const possede = (objet, nom) => Object.prototype.hasOwnProperty.call(objet, nom);

/** La raison que la vue donne à un jeton, ou null. */
const raisonDe = (jeton) => (typeof jeton.raison === "string" && jeton.raison !== "" ? jeton.raison : null);

/** Vrai quand deux listes portent les mêmes nœuds, dans le même ordre. */
function memesNoeuds(a, b) {
  return a.length === b.length && a.every((noeud, i) => noeud === b[i]);
}

/** Écrit un attribut, ou le retire quand sa valeur est nulle. */
function attribuer(noeud, nom, valeur) {
  if (valeur === null) noeud.removeAttribute(nom);
  else noeud.setAttribute(nom, valeur);
}

/**
 * La partie « plateau » de l'écran du combat : { noeud, rendre(vue, ecran),
 * prendre(id), enMain(), hachurer(noms), surimpression, emplacementMj,
 * demanderUneCase(options, rappel), finirLaDemande() }.
 *
 * « actions » vient de l'écran : executer(commande, origine), toujours avec
 * l'origine "plateau", et ouvrirCase(nomDeCase) pour la liste « +k ».
 * « prendre » et « enMain » servent à cette liste, que l'écran tient : avant
 * le lancement, elle prend un jeton en main sans passer par la grille.
 * « hachurer » sert aux infobulles et à l'aperçu d'une ligne (contrat du
 * groupe 2, § 9.5). À la vague 3 : ouvrirMenuMj(id, ancre), dire(texte) et
 * jetonSansChoix(id). « minuteur » est celui de la page, { poser(faire, ms) →
 * n, retirer(n) }.
 */
export function creer(actions, { minuteur = MINUTEUR_DE_LA_PAGE } = {}) {
  let vue = null;
  // Vrai quand on ne joue pas : la carte ne porte alors aucune commande.
  let arrete = false;
  // Ce que l'écran dit de lui : le Mode MJ, et le téléphone (la légende).
  let modeMj = false;
  let etroit = false;
  // L'appui en cours sur un jeton ({ id, numero } de son minuteur) ; le jeton
  // dont l'appui long vient d'ouvrir le menu du MJ (ou de dire sa phrase) :
  // le clic qui suit (« avaler ») et le clic droit d'un téléphone
  // (« parLAppui ») n'y ajoutent rien.
  let appui = null;
  let avaler = null;
  let parLAppui = null;
  // La case que l'écran demande : { exclue, nommer, rappel }, ou null.
  let demande = null;
  // Le jeton touché, qui attend sa case ; et celui qu'on fait glisser.
  let enMain = null;
  let glisse = null;
  // La case de chaque jeton, d'après la dernière vue.
  let caseDe = new Map();
  // Les cases hachurées : la portée de la capacité survolée.
  let hachures = new Set();
  // Le jeton dont le texte caché dit la raison : le dernier focalisé ou
  // survolé parmi ceux qui en ont une.
  let raisonMontree = null;
  const cases = new Map();
  const jetons = new Map();
  const raison = el("span", { id: RAISON, classe: "combat-raison", hidden: true });

  const preparation = () => vue !== null && vue.phase === "preparation" && !arrete;

  /**
   * Pose un jeton, avant le lancement. La main se vide d'abord : l'écran
   * redessine pendant « executer », et doit trouver le plateau au repos.
   */
  function poser(id, nomDeCase) {
    enMain = null;
    if (caseDe.get(id) !== nomDeCase) actions.executer({ preparer: { type: "poser", id, case: nomDeCase } }, "plateau");
    dessiner();
    // Le bouton de la case vient de quitter la page, et le focus avec lui :
    // il va au jeton posé, s'il se voit. Sans défiler (compl. § 4.5).
    const pose = jetons.get(id);
    if (pose && pose.noeud.parentNode) pose.noeud.focus({ preventScroll: true });
  }

  /** Écrit dans le texte caché la raison d'un jeton, s'il en a une. */
  function montrerLaRaison(fiche) {
    const texte = fiche.etat === null ? null : fiche.etat.raison;
    if (texte === null) return;
    raisonMontree = fiche.id;
    const propre = sansSensForce(texte);
    if (raison.textContent !== propre) raison.replaceChildren(propre);
  }

  function auClicDuJeton(fiche) {
    // Le clic qui suit l'appui long qui a ouvert le menu du MJ : déjà servi.
    if (avaler === fiche.id) {
      avaler = null;
      return;
    }
    if (fiche.etat === null) return;
    if (preparation()) {
      if (!fiche.etat.agit) return;
      enMain = enMain === fiche.id ? null : fiche.id;
      dessiner();
      return;
    }
    if (fiche.etat.commande !== null) {
      actions.executer(fiche.etat.commande, "plateau");
      return;
    }
    // Un jeton sans choix : l'écran sait s'il rend le focus à la bulle
    // (mission du lot 4.3, § 6, point 6b). Quand on ne joue pas, rien.
    if (!arrete) actions.jetonSansChoix?.(fiche.id);
  }

  /**
   * Le menu du MJ d'un jeton (mission du lot 4.3, § 4.8) : en Mode MJ, il
   * s'ouvre près du jeton, ou dit pourquoi il ne s'ouvre pas (un geste en
   * cours) ; hors Mode MJ, l'appui long dit où le trouver. Rien pour un jeton
   * sans menu (un mort, avant le lancement), ni quand on ne joue pas. Rend
   * vrai s'il l'a ouvert.
   */
  function ouvrirLeMenu(fiche) {
    const menu = fiche.etat?.menuMj ?? null;
    if (menu === null) return false;
    if (!modeMj) actions.dire?.(MENU_EN_MODE_MJ);
    else if (menu.actif === false) actions.dire?.(menu.raison);
    else {
      actions.ouvrirMenuMj?.(fiche.id, fiche.noeud);
      return true;
    }
    return false;
  }

  function finirLAppui() {
    if (appui === null) return;
    minuteur.retirer(appui.numero);
    appui = null;
  }

  // L'appui se pose au pointerdown du bouton principal, et s'oublie au
  // pointerup, au pointercancel et au pointerleave (contrat de la vague 3,
  // § 4.2). L'appui long qui aboutit avale le clic qui le suit, et le clic
  // droit qu'un téléphone envoie après lui. Le menu ouvert, ce clic tombe
  // sur ce qui vient de paraître sous le doigt (le voile, une entrée), et
  // non sur le jeton : l'écran l'avale, où qu'il tombe (vague 4, W1 n° 5,
  // R2 n° 11). Le jeton n'avale alors rien lui-même : il avalerait le clic
  // suivant, une touche Entrée sur lui, menu fermé (C4). Sans menu ouvert
  // (la phrase, la raison), ou sans l'écran (une partie montée seule), c'est
  // lui qui avale le clic qui suit l'appui.
  function auDebutDeLAppui(fiche, evenement) {
    finirLAppui();
    avaler = null;
    parLAppui = null;
    if ((evenement?.button ?? 0) !== 0 || (fiche.etat?.menuMj ?? null) === null) return;
    appui = {
      id: fiche.id,
      numero: minuteur.poser(() => {
        appui = null;
        parLAppui = fiche.id;
        if (ouvrirLeMenu(fiche) && typeof actions.avalerLeClicSuivant === "function") actions.avalerLeClicSuivant();
        else avaler = fiche.id;
      }, APPUI_LONG),
    };
  }

  // Le clic droit : en Mode MJ seulement, le menu du MJ au lieu de celui du
  // navigateur ; hors Mode MJ, rien ne change.
  function auClicDroit(fiche, evenement) {
    if (!modeMj || (fiche.etat?.menuMj ?? null) === null) return;
    evenement.preventDefault();
    finirLAppui();
    if (parLAppui === fiche.id) {
      parLAppui = null;
      return;
    }
    ouvrirLeMenu(fiche);
  }

  function auClicDeLaCase(fiche) {
    const choix = fiche.etat === null ? null : fiche.etat.choix;
    if (!choix) return;
    if (choix.demandee === true && demande !== null) {
      // La demande finit d'abord : l'écran redessine pendant le rappel.
      const { rappel } = demande;
      demande = null;
      dessiner();
      rappel(fiche.nom);
      return;
    }
    if (preparation()) poser(choix.commande.preparer.id, fiche.nom);
    else actions.executer(choix.commande, "plateau");
  }

  /**
   * Un jeton : un bouton créé une fois, puis mis à jour sur place. Le
   * refaire lui ôterait le focus à chaque clic, puisqu'un clic change sa
   * marque.
   */
  function creerJeton(id) {
    const fiche = {
      id,
      texte: null,
      etat: null,
      initiales: el("span", { classe: "combat-initiales" }),
      nomCourt: el("span", { classe: "combat-nom-court" }),
      pastille: null,
    };
    fiche.rond = el("span", { classe: "combat-rond" }, fiche.initiales);
    fiche.noeud = el(
      "button",
      {
        type: "button",
        classe: "combat-jeton",
        onclick: () => auClicDuJeton(fiche),
        oncontextmenu: (evenement) => auClicDroit(fiche, evenement),
        onpointerdown: (evenement) => auDebutDeLAppui(fiche, evenement),
        onpointerup: finirLAppui,
        onpointercancel: finirLAppui,
        onpointerleave: finirLAppui,
        // Le texte caché dit la raison du jeton focalisé ou survolé.
        onfocus: () => montrerLaRaison(fiche),
        onpointerenter: () => montrerLaRaison(fiche),
        ondragstart: (evenement) => {
          if (!preparation()) {
            evenement.preventDefault();
            return;
          }
          glisse = id;
          // Firefox ne commence un glisser que si une donnée l'accompagne.
          // C'est l'identifiant fabriqué par le combat, jamais un nom : ce
          // texte peut se déposer hors de la page.
          if (evenement.dataTransfer) {
            evenement.dataTransfer.effectAllowed = "move";
            evenement.dataTransfer.setData("text/plain", id);
          }
        },
        ondragend: () => {
          glisse = null;
        },
      },
      fiche.rond,
      fiche.nomCourt,
    );
    return fiche;
  }

  /**
   * Une case : son nœud ne change jamais. Le bouton qui la rend choisissable
   * et ses deux « +k » sont ses enfants, à côté des jetons : jamais un bouton
   * dans un bouton.
   */
  function creerCase(nom) {
    const fiche = { nom, texte: null, etat: null, enfants: [], choix: null, plusEtroit: null, plusLarge: null };
    fiche.noeud = el("div", {
      classe: "combat-case",
      "data-case": nom,
      // Sans ce refus, le navigateur n'accepte aucun dépôt. Il ne se fait
      // que pour un jeton parti d'ici : un fichier ou un texte venu
      // d'ailleurs garde son sort ordinaire.
      ondragover: (evenement) => {
        if (glisse !== null) evenement.preventDefault();
      },
      ondrop: (evenement) => {
        if (glisse === null) return;
        evenement.preventDefault();
        const id = glisse;
        glisse = null;
        if (preparation() && possede(vue.jetons, id)) poser(id, nom);
      },
    });
    return fiche;
  }

  function boutonPlus(fiche, classe) {
    return el("button", { type: "button", classe: `combat-case-plus ${classe}`, onclick: () => actions.ouvrirCase(fiche.nom) });
  }

  /** Ce que montre un jeton, d'après sa vue et d'après la main. */
  function decrireJeton(id) {
    const v = vue.jetons[id];
    const avant = preparation();
    const tenu = avant && enMain === id;
    // Tant qu'un jeton est en main, les autres s'effacent : toucher une case
    // occupée y pose le jeton tenu, au lieu de changer de jeton.
    const ecarte = avant && enMain !== null && !tenu;
    // Quand on ne joue pas, aucun choix n'est ouvert : rien n'est écarté.
    const inactif = !arrete && (v.inactif === true || ecarte);
    const commande = !avant && !inactif && !arrete && v.choix ? v.choix.commande : null;
    return {
      camp: v.camp === "pj" ? "pj" : "adv",
      entier: String(v.entier),
      jeton: String(v.jeton),
      initiales: String(v.initiales),
      nom: String(v.nom),
      marque: v.marque === "joue" || v.marque === "cible" ? v.marque : null,
      mort: v.mort === true,
      inactif,
      // La raison d'un jeton inactif pendant une action (contrat du groupe 2,
      // § 8.5). Quand on ne joue pas, rien n'est écarté : elle ne se dit pas.
      raison: avant || arrete ? null : raisonDe(v),
      tenu: avant ? tenu : null,
      agit: avant ? !ecarte : commande !== null,
      commande,
      // La vague 3 : qui a tout joué pâlit ; l'état porté, une pastille ; le
      // menu du MJ, que rien n'offre quand on ne joue pas.
      epuise: !avant && v.epuise === true,
      pastille: PASTILLES.includes(v.pastille) ? v.pastille : null,
      menuMj: avant || arrete ? null : (v.menuMj ?? null),
    };
  }

  function montrerJeton(fiche, etat) {
    const texte = JSON.stringify(etat);
    if (texte === fiche.texte) return;
    fiche.texte = texte;
    fiche.etat = etat;
    const classes = ["combat-jeton", `combat-${etat.camp}`];
    if (etat.marque) classes.push(etat.marque);
    if (etat.mort) classes.push("mort");
    if (etat.inactif) classes.push("inactif");
    if (etat.epuise) classes.push("epuise");
    fiche.noeud.className = classes.join(" ");
    // La pastille d'un état porté : un enfant du jeton, qu'un lecteur d'écran
    // n'entend pas (la fiche dit chaque état), et qui ne paraît qu'avec lui.
    const pastille = etat.pastille === null ? null : (fiche.pastille ??= el("span", { "aria-hidden": "true" }));
    if (pastille !== null) pastille.className = `combat-pastille-etat ${etat.pastille}`;
    const enfants = [fiche.rond, fiche.nomCourt, pastille].filter(Boolean);
    if (!memesNoeuds(enfants, fiche.noeud.children)) fiche.noeud.replaceChildren(...enfants);
    // Le titre et le nom accessible s'affichent ou se lisent : comme tout
    // texte montré, ils perdent les signes qui commandent le sens. Une
    // raison s'écrit sur une seconde ligne du titre, et se lit par le texte
    // caché de la carte.
    const titre = etat.raison === null ? etat.entier : `${etat.entier}\n${etat.raison}`;
    fiche.noeud.setAttribute("title", sansSensForce(titre));
    fiche.noeud.setAttribute("aria-label", sansSensForce(etat.nom));
    attribuer(fiche.noeud, "aria-describedby", etat.raison === null ? null : RAISON);
    if (fiche.id === raisonMontree) montrerLaRaison(fiche);
    attribuer(fiche.noeud, "aria-pressed", etat.tenu === null ? null : String(etat.tenu));
    // Un jeton qui n'a rien à offrir reste un bouton, et garde le focus :
    // son nom dit qui est là.
    attribuer(fiche.noeud, "aria-disabled", etat.agit ? null : "true");
    attribuer(fiche.noeud, "draggable", etat.tenu === null ? null : "true");
    const initiales = sansSensForce(etat.initiales);
    fiche.initiales.className = [...initiales].length > INITIALES_COURTES ? "combat-initiales combat-initiales-longues" : "combat-initiales";
    fiche.initiales.replaceChildren(initiales);
    fiche.nomCourt.replaceChildren(...morceauxDuNom(sansSensForce(etat.jeton)));
  }

  function montrerCase(fiche, etat) {
    const texte = JSON.stringify(etat);
    if (texte === fiche.texte) return;
    fiche.texte = texte;
    fiche.etat = etat;
    const classes = ["combat-case"];
    if (etat.active) classes.push("active");
    if (etat.choix) classes.push("possible");
    if (etat.inactive) classes.push("inactive");
    if (etat.portee) classes.push("portee");
    fiche.noeud.className = classes.join(" ");

    const enfants = [];
    if (etat.choix) {
      fiche.choix ??= el("button", {
        type: "button",
        classe: "combat-case-choix",
        onclick: () => auClicDeLaCase(fiche),
        // Échap met fin à une case demandée (contrat de la vague 3, § 4.2).
        onkeydown: (evenement) => {
          if (evenement.key === "Escape" && demande !== null) finirLaDemande();
        },
      });
      fiche.choix.setAttribute("aria-label", sansSensForce(etat.choix.nom));
      enfants.push(fiche.choix);
    }
    for (const id of etat.montres) {
      if (!jetons.has(id)) jetons.set(id, creerJeton(id));
      enfants.push(jetons.get(id).noeud);
    }
    const voir = `Case ${fiche.nom} : ${etat.combien} protagonistes, voir la liste`;
    if (etat.combien > MONTRES_ETROIT) {
      fiche.plusEtroit ??= boutonPlus(fiche, "combat-plus-etroit");
      fiche.plusEtroit.replaceChildren(`+${etat.combien - MONTRES_ETROIT}`);
      fiche.plusEtroit.setAttribute("aria-label", voir);
      enfants.push(fiche.plusEtroit);
    }
    if (etat.combien > MONTRES) {
      fiche.plusLarge ??= boutonPlus(fiche, "combat-plus-large");
      fiche.plusLarge.replaceChildren(`+${etat.combien - MONTRES}`);
      fiche.plusLarge.setAttribute("aria-label", voir);
      enfants.push(fiche.plusLarge);
    }
    // Un nœud retiré puis remis perd le focus : la liste ne se réécrit que
    // si elle a changé.
    if (!memesNoeuds(enfants, fiche.enfants)) {
      fiche.enfants = enfants;
      fiche.noeud.replaceChildren(...enfants);
    }
  }

  function dessiner() {
    if (vue === null) return;
    const avant = preparation();
    if (!avant || enMain === null || !possede(vue.jetons, enMain)) enMain = null;

    // La vue met en tête qui joue, puis la cible. Pour le reste, les morts
    // passent derrière les vivants ; et dans une case qui ne peut pas tout
    // montrer, ceux qu'on peut choisir passent devant. Sans cela un mort
    // tenait la place d'un vivant qu'on pouvait cibler, caché derrière
    // « +1 ». Rien d'autre ne change à l'ordre de la vue : un jeton ne saute
    // pas d'une ligne à l'autre à chaque tour. Avant le lancement, rien ne
    // se range.
    const rangDe = (id, pleine) => {
      const jeton = vue.jetons[id];
      if (jeton.marque === "joue") return 0;
      if (jeton.marque === "cible") return 1;
      if (pleine && jeton.choix && jeton.inactif !== true) return 2;
      return jeton.mort === true ? 4 : 3;
    };
    const ranger = (ids) =>
      avant
        ? ids
        : ids
            .map((id, place) => ({ id, place, rang: rangDe(id, ids.length > MONTRES) }))
            .sort((a, b) => a.rang - b.rang || a.place - b.place)
            .map(({ id }) => id);
    const connus = (nom) => (possede(vue.cases, nom) ? ranger(vue.cases[nom].jetons.filter((id) => possede(vue.jetons, id))) : []);
    caseDe = new Map();
    for (const nom of cases.keys()) for (const id of connus(nom)) caseDe.set(id, nom);
    const caseTenue = enMain === null ? null : (caseDe.get(enMain) ?? null);
    // La vue marque les jetons qu'un choix écarte, pas les cases : une case
    // est écartée quand un choix est ouvert et qu'elle n'y offre rien. Un
    // jeton inactif qui porte une raison n'est pas écarté par un choix : il
    // attend la fin d'une action en cours.
    const ecarteParUnChoix = (jeton) => jeton.inactif === true && raisonDe(jeton) === null;
    const enChoix = !avant && !arrete && (Object.values(vue.jetons).some(ecarteParUnChoix) || Object.values(vue.cases).some((c) => c.choix));

    const montres = new Set();
    for (const fiche of cases.values()) {
      const v = possede(vue.cases, fiche.nom) ? vue.cases[fiche.nom] : null;
      const ids = connus(fiche.nom);
      let choix = null;
      if (avant) {
        if (enMain !== null && fiche.nom !== caseTenue) {
          choix = { nom: `Case ${fiche.nom} : y poser ${vue.jetons[enMain].entier}`, commande: { preparer: { type: "poser", id: enMain, case: fiche.nom } } };
        }
      } else if (demande !== null && !arrete) {
        // Une case demandée par l'écran : toute case, sauf l'exclue, nommée
        // par qui la demande.
        if (fiche.nom !== demande.exclue) choix = { nom: String(demande.nommer(fiche.nom)), commande: null, demandee: true };
      } else if (v && v.choix && !arrete) {
        choix = { nom: String(v.choix.nom), commande: v.choix.commande };
      }
      const active = (v !== null && v.active === true) || (caseTenue !== null && fiche.nom === caseTenue);
      const etat = {
        active,
        inactive: enChoix && !active && choix === null && !ids.some((id) => vue.jetons[id].choix),
        portee: hachures.has(fiche.nom),
        choix,
        montres: ids.slice(0, MONTRES),
        combien: ids.length,
      };
      montrerCase(fiche, etat);
      for (const id of etat.montres) {
        montres.add(id);
        montrerJeton(jetons.get(id), decrireJeton(id));
      }
    }
    // Un jeton qui ne se voit plus (retiré, ou passé derrière « +k ») est
    // oublié : il sera recréé s'il reparaît.
    for (const id of [...jetons.keys()]) if (!montres.has(id)) jetons.delete(id);
  }

  const coord = (texte) => el("div", { classe: "combat-coord", "aria-hidden": "true" }, texte);
  // L'ordre du document est celui que la feuille de style range : le coin,
  // les dix lettres, puis chaque ligne, son numéro devant ses dix cases.
  const grille = el("div", { classe: "combat-grille" }, coord(""), [...COLONNES].map((lettre) => coord(lettre)));
  for (let ligne = 1; ligne <= COTE; ligne += 1) {
    grille.append(coord(String(ligne)));
    for (const lettre of COLONNES) {
      const fiche = creerCase(`${lettre}${ligne}`);
      cases.set(fiche.nom, fiche);
      grille.append(fiche.noeud);
    }
  }
  // Le dé tiré, au-dessus des cases (contrat de la vague 3, § 4.2, R n° 40) :
  // créé une fois, dernier enfant de la grille ; l'écran le remplit et lui
  // pose ses classes, le plateau n'y touche plus.
  const surimpression = el("div", { classe: "combat-surimpression", "aria-hidden": "true" });
  grille.append(surimpression);
  const portee = el("li", { classe: "portee" }, el("span", { classe: "combat-rond" }), LEGENDE.at(-1)[1]);
  const legende = el(
    "ul",
    { classe: "combat-legende" },
    LEGENDE.slice(0, -1).map(([classe, texte]) => el("li", { classe }, el("span", { classe: "combat-rond" }), texte)),
    portee,
  );
  // La place de l'interrupteur du Mode MJ, sur PC : l'écran l'y pose.
  const emplacementMj = el("span", { classe: "combat-plateau-mj" });
  const tete = el("p", { classe: "combat-plateau-tete" }, el("span", {}, EN_TETE), " ", el("span", { classe: "combat-plateau-survol" }, AU_SURVOL), emplacementMj);
  const noeud = el("section", { classe: "combat-plateau", "aria-label": TITRE }, tete, grille, legende, raison);

  /**
   * Montre la vue. De la mémoire de l'écran, le plateau ne lit que
   * « arrete » (on ne joue pas : rien ne s'offre), « modeMj » (le menu du MJ)
   * et « etroit » (la légende du téléphone) ; ce qu'il a en main, il le
   * tient lui-même.
   */
  function rendre(vueNeuve, ecran) {
    vue = vueNeuve;
    arrete = ecran?.arrete === true;
    modeMj = ecran?.modeMj === true;
    if (etroit !== (ecran?.etroit === true)) {
      etroit = ecran?.etroit === true;
      portee.replaceChildren(portee.children[0], etroit ? PORTEE_AU_DOIGT : LEGENDE.at(-1)[1]);
    }
    if (arrete) finirLAppui();
    dessiner();
  }

  /**
   * Fait choisir une case (contrat de la vague 3, § 4.2) : chaque case, sauf
   * « exclue », devient un bouton nommé par « nommer(nomDeCase) » ; un appui
   * met fin à la demande, puis appelle « rappel(nomDeCase) ». Échap, ou
   * « finirLaDemande », y met fin sans rien appeler. Avant le lancement, et
   * quand on ne joue pas, rien ne se demande. Rend vrai si la case est
   * demandée (vague 4, C2 : l'écran efface alors la feuille qui la demande).
   */
  function demanderUneCase({ exclue = null, nommer }, rappel) {
    if (vue === null || preparation() || arrete) return false;
    demande = { exclue, nommer, rappel };
    dessiner();
    return true;
  }

  function finirLaDemande() {
    if (demande === null) return;
    demande = null;
    dessiner();
  }

  /**
   * Prend un jeton en main, ou vide la main (null), avant le lancement. Rend
   * vrai si c'est fait.
   */
  function prendre(id) {
    if (!preparation()) return false;
    if (id !== null && !possede(vue.jetons, id)) return false;
    enMain = id;
    dessiner();
    return true;
  }

  /**
   * Hachure les cases nommées (« A1 » … « J10 », la portée de la capacité
   * survolée), ou n'en hachure aucune (null). Seules les cases dont la
   * marque change sont récrites : un survol ne refait rien d'autre, et un
   * jeton qui a le focus le garde. Les hachures tiennent d'un rendu à
   * l'autre, jusqu'à ce qu'on les efface : c'est l'infobulle qui sait quand
   * le survol cesse.
   */
  function hachurer(noms) {
    hachures = new Set(Array.isArray(noms) ? noms.map(String) : []);
    dessiner();
  }

  return { noeud, rendre, prendre, enMain: () => enMain, hachurer, surimpression, emplacementMj, demanderUneCase, finirLaDemande };
}
