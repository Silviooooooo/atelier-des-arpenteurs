// Les vignettes du combat, au téléphone (SPECIFICATION.md, § 17, « Le
// simulateur de combat (lot 4) » ; mission du lot 4.3, § 3, vues A1 et A7 ;
// contrat de la vague 3, § 3.5 et § 4.1).
//
// Une vignette par protagoniste vivant du camp qui joue : son initiale et son
// nom court, un rond par action restante, en couleur s'il peut encore agir, en
// gris s'il a tout joué ; celle du protagoniste choisi, marquée. Un appui le
// choisit, comme son jeton ; un appui long d'une demi-seconde ouvre le menu du
// MJ en Mode MJ, et dit sinon où il s'ouvre. Elle ne sait rien du jeu : elle
// montre la vue qu'on lui donne (vueVignettes, js/combat/lecture.js) et rend
// la main à l'écran par « actions ».
//
// Ce qu'elle garde pour elle : un bouton par protagoniste, créé une fois puis
// mis à jour sur place (le refaire lui ôterait le focus), le texte de ce que
// chacun montre, et l'appui en cours. Ses états sont des classes (contrat,
// § 5.2), que la feuille colore ; le code n'écrit jamais de mise en forme.

import { el, sansSensForce } from "./dom.js";

const PREFIXE = "combat-vignette";
// Les classes d'état d'une vignette (contrat de la vague 3, § 5.2), d'après
// vueVignettes : « jeu » et « choisie » ; et celles de sa pastille. Une valeur
// inconnue ne s'écrit pas.
const JEUX = { peut_agir: "a-jouer", epuise: "epuise" };
const PASTILLES = ["blessure", "alerte"];
// Au-delà, les actions s'écrivent en nombres seulement, comme sur la fiche.
const RONDS_MAX = 30;
// L'appui long qui ouvre le menu du MJ : une demi-seconde (mission du lot
// 4.3, § 4.8).
const APPUI_LONG = 500;
const MENU_EN_MODE_MJ = `Le menu du MJ s'ouvre en Mode MJ (menu ${String.fromCodePoint(0x22ef)}).`;
// Le minuteur de la page, quand l'écran n'en donne pas.
const MINUTEUR_DE_LA_PAGE = { poser: (faire, ms) => setTimeout(faire, ms), retirer: (numero) => clearTimeout(numero) };

/** Vrai quand deux listes portent les mêmes nœuds, dans le même ordre. */
function memesNoeuds(a, b) {
  return a.length === b.length && a.every((noeud, i) => noeud === b[i]);
}

/** Écrit un attribut, ou le retire quand sa valeur est nulle. */
function attribuer(noeud, nom, valeur) {
  if (valeur === null) noeud.removeAttribute(nom);
  else noeud.setAttribute(nom, valeur);
}

/** Les actions restantes : un rond par action, plein ou vide ; au-delà de trente, le nombre. */
function ronds({ reste, max }) {
  if (!Number.isInteger(max) || max > RONDS_MAX) return el("span", { classe: "combat-actions", "aria-hidden": "true" }, `${reste}/${max}`);
  return el(
    "span",
    { classe: "combat-actions", "aria-hidden": "true" },
    Array.from({ length: Math.max(0, max) }, (_, i) => el("span", { classe: i < reste ? "combat-pion" : "combat-pion vide" })),
  );
}

/**
 * Les vignettes : { noeud, rendre(vue, ecran) }. « actions » : executer(
 * commande, origine), ouvrirMenuMj(id, ancre), dire(texte). « minuteur » : celui
 * de la page, { poser(faire, ms) → numéro, retirer(numéro) }. rendre reçoit
 * vueVignettes (ou null) et { modeMj, arrete }.
 */
export function creer(actions, { minuteur = null } = {}) {
  const leMinuteur = minuteur ?? MINUTEUR_DE_LA_PAGE;
  const noeud = el("div", { classe: "combat-vignettes", hidden: true });
  // Les identifiants de la page ne se font jamais d'un identifiant de
  // protagoniste, qui est une donnée.
  let numero = 0;
  /** id → { id, numero, noeud, texte, etat } */
  const vignettes = new Map();
  let modeMj = false;
  let arrete = false;
  // L'appui en cours ({ id, numero } de son minuteur) ; la vignette dont
  // l'appui long vient d'ouvrir le menu du MJ (ou de dire sa phrase) : le
  // clic qui suit (« avaler ») et le clic droit d'un téléphone
  // (« parLAppui ») n'y ajoutent rien.
  let appui = null;
  let avaler = null;
  let parLAppui = null;

  /** Le menu du MJ : ouvert en Mode MJ, sa raison s'il est inactif ; hors Mode MJ, la phrase. Rend vrai s'il l'a ouvert. */
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
    leMinuteur.retirer(appui.numero);
    appui = null;
  }

  // L'appui se pose au pointerdown du bouton principal, et s'oublie au
  // pointerup, au pointercancel et au pointerleave (contrat, § 4.2). Le
  // menu ouvert, le clic qui suit tombe sur ce qui vient de paraître sous
  // le doigt (le voile, une entrée), et non sur la vignette : l'écran
  // l'avale, où qu'il tombe (vague 4, W1 n° 5, R2 n° 11). La vignette
  // n'avale alors rien elle-même : ce clic ne lui arrive pas, et elle
  // avalerait le suivant, une touche Entrée sur elle, menu fermé (C4).
  // Sans menu ouvert (la phrase, la raison), ou sans l'écran (une partie
  // montée seule), c'est elle qui avale le clic qui suit l'appui.
  function auDebutDeLAppui(fiche, evenement) {
    finirLAppui();
    avaler = null;
    parLAppui = null;
    if (arrete || (evenement?.button ?? 0) !== 0 || (fiche.etat?.menuMj ?? null) === null) return;
    appui = {
      id: fiche.id,
      numero: leMinuteur.poser(() => {
        appui = null;
        parLAppui = fiche.id;
        if (ouvrirLeMenu(fiche) && typeof actions.avalerLeClicSuivant === "function") actions.avalerLeClicSuivant();
        else avaler = fiche.id;
      }, APPUI_LONG),
    };
  }

  // Le clic droit d'un téléphone suit l'appui long : en Mode MJ, il ne montre
  // pas le menu du navigateur, et n'ouvre pas le menu du MJ une seconde fois.
  function auClicDroit(fiche, evenement) {
    if (arrete || !modeMj || (fiche.etat?.menuMj ?? null) === null) return;
    evenement.preventDefault();
    finirLAppui();
    if (parLAppui === fiche.id) {
      parLAppui = null;
      return;
    }
    ouvrirLeMenu(fiche);
  }

  // L'appui court choisit le protagoniste, comme son jeton : la commande de
  // la vue (« choisir », ou le réglage d'une cible pendant son choix).
  function auClic(fiche) {
    if (avaler === fiche.id) {
      avaler = null;
      return;
    }
    const etat = fiche.etat;
    if (etat === null || arrete || etat.inactif === true || !etat.choix) return;
    actions.executer(etat.choix.commande, "vignette");
  }

  function creerVignette(id) {
    numero += 1;
    const fiche = { id, numero, texte: null, etat: null };
    fiche.noeud = el("button", {
      type: "button",
      classe: PREFIXE,
      onclick: () => auClic(fiche),
      oncontextmenu: (evenement) => auClicDroit(fiche, evenement),
      onpointerdown: (evenement) => auDebutDeLAppui(fiche, evenement),
      onpointerup: finirLAppui,
      onpointercancel: finirLAppui,
      onpointerleave: finirLAppui,
    });
    fiche.raison = el("span", { id: `${PREFIXE}-${numero}-raison`, classe: "combat-raison" });
    return fiche;
  }

  /** Refait une vignette dont la vue a changé, sur place. */
  function montrer(fiche, vue) {
    const texte = JSON.stringify([vue, modeMj, arrete]);
    if (texte === fiche.texte) return;
    fiche.texte = texte;
    fiche.etat = vue;
    const classes = [PREFIXE];
    if (Object.hasOwn(JEUX, vue.jeu ?? "")) classes.push(JEUX[vue.jeu]);
    if (vue.choisie === true) classes.push("choisie");
    fiche.noeud.className = classes.join(" ");
    // Le nom accessible est l'étiquette de la vue : le nom entier, les
    // actions restantes, la garde. Ce qui se voit se tait.
    fiche.noeud.setAttribute("aria-label", sansSensForce(vue.etiquette ?? vue.nom ?? ""));
    attribuer(fiche.noeud, "aria-pressed", String(vue.choisie === true));
    // Inactive, elle le dit, et dit sa raison ; jamais éteinte. Quand on ne
    // joue pas, rien ne s'offre, sans raison.
    const agit = !arrete && vue.inactif !== true && Boolean(vue.choix);
    const raison = !arrete && vue.inactif === true && typeof vue.raison === "string" && vue.raison !== "" ? sansSensForce(vue.raison) : null;
    attribuer(fiche.noeud, "aria-disabled", agit ? null : "true");
    attribuer(fiche.noeud, "aria-describedby", raison === null ? null : fiche.raison.id);
    fiche.raison.replaceChildren(raison ?? "");
    const pastille = PASTILLES.includes(vue.pastille) ? el("span", { classe: `combat-pastille-etat ${vue.pastille}`, "aria-hidden": "true" }) : null;
    const enfants = [
      el("span", { classe: "combat-rond", "aria-hidden": "true" }, vue.initiales ?? "?"),
      ronds(vue.actions ?? { reste: 0, max: 0 }),
      el("span", { classe: "combat-vignette-nom", "aria-hidden": "true" }, vue.nom ?? ""),
      vue.garde ? el("span", { classe: "combat-vignette-garde", "aria-hidden": "true" }, vue.garde) : null,
      pastille,
    ];
    fiche.noeud.replaceChildren(...enfants.filter(Boolean));
  }

  /**
   * Montre la vue : null la cache ; sinon une vignette par protagoniste, dans
   * l'ordre reçu. Ne reposent dans la liste que celles qui ont changé de
   * place : un bouton reposé perd le focus.
   */
  function rendre(vue, ecran = {}) {
    modeMj = ecran?.modeMj === true;
    arrete = ecran?.arrete === true;
    if (arrete) finirLAppui();
    const liste = vue === null || vue === undefined || !Array.isArray(vue.vignettes) ? null : vue.vignettes;
    if (liste === null) {
      noeud.hidden = true;
      if (noeud.childNodes.length > 0) noeud.replaceChildren();
      vignettes.clear();
      return;
    }
    noeud.hidden = false;
    const presents = new Set();
    const enfants = [];
    for (const une of liste) {
      if (!vignettes.has(une.id)) vignettes.set(une.id, creerVignette(une.id));
      const fiche = vignettes.get(une.id);
      presents.add(une.id);
      montrer(fiche, une);
      enfants.push(fiche.noeud);
      if (fiche.raison.textContent !== "") enfants.push(fiche.raison);
    }
    for (const id of [...vignettes.keys()]) if (!presents.has(id)) vignettes.delete(id);
    if (!memesNoeuds(enfants, noeud.children)) noeud.replaceChildren(...enfants);
  }

  return { noeud, rendre };
}
