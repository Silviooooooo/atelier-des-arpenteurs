// Le contenu d'une action et la zone sous la carte, au simulateur de combat
// (SPECIFICATION.md, § 17, « Le simulateur de combat (lot 4) » ; contrat du
// lot 4, groupe 2, § 9.5 à § 9.7).
//
// Ce qu'il fait : d'après la vue du panneau (vuePanneau, js/combat/lecture.js),
// il fabrique le contenu d'une action, sans en-tête ni conteneur, que la
// bulle (combat_bulle.js) porte à côté des jetons :
// - la liste (composerListe) : les capacités groupées par origine, une ligne
//   par capacité et par puissance, « Passer son tour », les passifs en pied ;
//   chaque ligne et chaque passif liés à leur infobulle, et l'aperçu qu'un
//   doigt ouvre sous une ligne ;
// - le jet (composerGeste) : les étapes, qui se défend, les rangées du
//   groupe 1, le contexte et ses causes, la défense au choix, les dés et les
//   choix du moment, le texte de la capacité, les réglages à la main.
// Il tient aussi la zone sous la carte (creer) : « Qui joue ? », la fin du
// combat, ou la phrase qui dit que le jet se joue dans la bulle ; sur un
// téléphone, en jeu, elle reste vide : tout se joue dans le volet.
// Chaque bouton émet la commande que la vue lui donne, avec son origine
// ("bulle", "panneau" ou "palette"), chaque saisie complète le gabarit que
// la vue lui donne.
//
// Au lot 4.3 (vague 1), il suit le noyau neuf : les choix du critique et de
// la contre-attaque, la capacité gardée d'attendre, l'étape de la blessure
// (ses capacités, puis un état libre nommé), et des dégâts « ajustés à » la
// valeur calculée, qui ne changent rien. À la vague 3 (contrat, § 3.2 et
// § 4.2), il en dessine les vues : sur PC, le jet entier, comme au groupe 2 ;
// au téléphone, le volet pas à pas, une étape à la fois (la clé etape de la
// vue), sous le fil des étapes (« 1 · Capacité », puis « Cible », « Dés »,
// « Zone et dégâts »), avec son pied (« Appliquer l'effet de… », « Palette », puis « Passer : … » ou
// « Terminer »). S'y ajoutent les interventions, la contre-attaque, le coup
// critique, les passifs non câblés, « Inverser » et « Relancer » sous le
// dernier dé quand la palette est ouverte, plusieurs cibles et leur
// avancement, ce que la blessure a fait. Ce que seul le Mode MJ montre
// (mj: true) ne paraît pas quand il est éteint ; un appui sur un passif, sur
// « Appliquer l'effet de… » ou sur « Palette » ouvre la palette.
//
// Pourquoi il existe : l'écran du combat se partage en parties, pour que
// chacune se contrôle seule, sur des vues écrites à la main. Celle-ci ne
// porte AUCUNE règle du jeu et n'importe que dom.js : ce qui est permis, ce
// qui ne l'est pas et pourquoi, les phrases des causes, les bornes d'une
// saisie, tout vient de la vue ; le moteur revalide chaque événement.
//
// Trois nœuds de la zone sont créés une fois et ne sont jamais refaits : la
// section, la liste d'une case (« +k », que remplit l'écran) et la région
// d'annonce, seule région polie de l'écran, pour les lecteurs d'écran. La
// région n'est pas dans la section : l'écran la pose dans la page dès son
// premier rendu, vide, pour qu'un lecteur d'écran la connaisse avant qu'elle
// parle. La couche des infobulles de la zone, que l'écran crée, vit dans la
// section, après la liste d'une case. Le corps, lui, est refait en entier
// dès que ce qu'il montre change, et seulement alors : un rendu de plus
// (l'enregistrement qui finit, un dé pendant que le jet se joue dans la
// bulle) ne doit pas déplacer le focus. Tout focus posé ici l'est sans faire
// défiler la page.

import { el, enumerer, sansSensForce } from "./dom.js";

// D'où vient un clic fait dans la zone ; la bulle donne le sien ("bulle").
const ORIGINE_DE_LA_ZONE = "panneau";
// Où la cible a été choisie, dit en clair à côté d'elle. Un clic dans la
// bulle vaut un clic dans la zone : « choisie ici ».
const TEXTE_ORIGINE = { plateau: "choisie sur la carte", panneau: "choisie ici", bulle: "choisie ici" };

const CLASSE_ETAPE = { faite: "fait", en_cours: "en-cours" };
// Une cause se lit dans la couleur de la réussite (un avantage) ou de
// l'échec (un désavantage), du point de vue de qui la porte.
const CLASSE_DE_CAUSE = { avantage: "combat-cause-avantage", desavantage: "combat-cause-desavantage" };

// Un dé ne dit jamais son état par la couleur seule : le signe est écrit
// dans le dé, et l'état dans son nom accessible.
const ETATS_DE = {
  reussi: { classe: "reussi", dit: "réussi", signe: "✓" },
  echoue: { classe: "echoue", dit: "échec", signe: "✗" },
  relance: { classe: "relance", dit: "relancé", signe: null },
  a_lancer: { classe: "a-lancer", dit: "à lancer", signe: null },
  a_venir: { classe: "a-venir", dit: "à venir", signe: null },
};

const SIGNE_MOINS = "−";
// Le signe que porte le nombre des avantages et des désavantages (U+24D8),
// écrit par son code ; il est caché aux lecteurs d'écran, que le nom du
// bouton renseigne (« 1 avantage : voir la cause »).
const SIGNE_DE_LA_CAUSE = "\u24d8";
// Ce qui sépare, dans l'infobulle d'une ligne, son titre de son origine :
// un signe fixe de l'écran (« Frappe · Couteau d'office »).
const POINT_DU_TITRE = " · ";
const QUI_JOUE = "Qui joue ?";
const COMBAT_TERMINE = "Combat terminé";
// Sur un grand écran, la zone sous la carte ne dit plus que cela.
const PHRASE_DE_LA_ZONE = "Le jet se joue dans la bulle, à côté des jetons.";
const PASSER = "Passer son tour";
const PASSIFS = "Passifs :";
const DESAVANTAGE = "désavantage";
const INTERVENTION = "intervention";
// Le titre du texte d'une capacité, en pied du jet : celui de la maquette.
const TITRE_DE_LA_DESCRIPTION = "Effets de capacité (mode assisté)";
const REGLAGES = "Réglages à la main";
const REGLAGES_QUAND = "(avant le premier dé)";
const DEFENSE = "Défense :";
// Sous le dé à lancer : « cliquez » sur PC, « touchez » au téléphone
// (mission du lot 4.3, § 6, point 4).
const CLIQUEZ = "cliquez";
const TOUCHEZ = "touchez";
// Le volet du téléphone (contrat de la vague 3, § 4.2, § 6.1 et § 6.2) : le
// chevron (U+203A) entre deux étapes du fil, caché aux lecteurs d'écran, et
// celui de « Changer de capacité » (U+2039), écrits par leur code ; le
// dernier bouton du pied.
const SEPARATEUR_DU_FIL = " \u203a ";
const CHANGER_DE_CAPACITE = "\u2039 Changer de capacité";
const TERMINER = "Terminer";
// L'origine d'un outil de la palette posé sous le dernier dé.
const ORIGINE_DE_LA_PALETTE = "palette";

// Ce que dit une saisie refusée : ces textes ne viennent pas de l'auteur, et
// restent à lui faire confirmer.
const RAISON_REFUSEE = "Une raison est demandée.";

const present = (valeur) => valeur !== null && valeur !== undefined;
const rempli = (texte) => present(texte) && texte !== "";

/** Un nombre tel qu'il s'écrit dans une phrase : « −3 », « 5 ». */
const ecrireNombre = (n) => (n < 0 ? `${SIGNE_MOINS}${Math.abs(n)}` : String(n));

/** Les bornes d'une saisie, en clair : « de 0 à 5 » ; rien si la vue n'en donne pas. */
function ecrireBornes(saisie) {
  return typeof saisie.min === "number" && typeof saisie.max === "number" ? ` (de ${ecrireNombre(saisie.min)} à ${ecrireNombre(saisie.max)})` : "";
}

/** Ce que dit un nombre refusé : « Un nombre entier de 0 à 5 est attendu. » */
function nombreRefuse(saisie) {
  const bornes = typeof saisie.min === "number" && typeof saisie.max === "number" ? ` de ${ecrireNombre(saisie.min)} à ${ecrireNombre(saisie.max)}` : "";
  return `Un nombre entier${bornes} est attendu.`;
}

/**
 * L'entier que porte un champ, ou null s'il n'en porte pas un qui tienne
 * dans les bornes que la vue a données. Le moteur revalide : ceci évite
 * seulement d'émettre ce qu'il refuserait à coup sûr.
 */
function lireEntier(texte, min, max) {
  const net = String(texte).trim().replace(SIGNE_MOINS, "-");
  if (!/^[+-]?\d+$/.test(net)) return null;
  const nombre = Number(net);
  if (!Number.isSafeInteger(nombre)) return null;
  if (typeof min === "number" && nombre < min) return null;
  if (typeof max === "number" && nombre > max) return null;
  return nombre === 0 ? 0 : nombre;
}

/**
 * Le gabarit d'une saisie, complété. Deux événements ne rangent pas leur
 * nombre dans « valeur » : l'esquive le veut dans « x », les dégâts dans
 * leur unique opération « ajuster », avec sa raison.
 */
function completer(gabarit, valeur, raison) {
  const evenement = gabarit?.evenement;
  if (!evenement) return null;
  if (evenement.type === "degats") return { evenement: { ...evenement, operations: [{ op: "ajuster", valeur, raison }] } };
  if (evenement.type === "esquive") return { evenement: { ...evenement, x: valeur } };
  return { evenement: raison === null ? { ...evenement, valeur } : { ...evenement, valeur, raison } };
}

// ——— Le contexte d'une composition (r) ———

/** D'où vient un clic : "bulle" ou "panneau" (la zone). */
const origineDe = (r) => r.origine ?? ORIGINE_DE_LA_ZONE;

/**
 * Un identifiant neuf. La bulle et la zone peuvent être dans la page en
 * même temps, chacune avec son compteur : leurs identifiants ne partent pas
 * du même mot.
 */
function identifiant(r, nom) {
  r.compteur = (r.compteur ?? 0) + 1;
  return `${origineDe(r) === "bulle" ? "combat-bulle" : "combat-action"}-${nom}-${r.compteur}`;
}

/** Émet une commande de la vue, avec l'origine du clic. */
function emettre(r, commande, origine = origineDe(r)) {
  if (commande) r.actions.executer(commande, origine);
}

/** Ce que seul le Mode MJ montre (mj: true) ne paraît pas quand il est éteint ; rien d'absent ne paraît. */
const montre = (r, objet) => present(objet) && !(objet.mj === true && r.modeMj !== true);

/** Un enfant d'un parent inactif l'est aussi, avec la raison du parent (contrat, § 3). */
const herite = (parent, enfant) =>
  parent?.actif === false ? { actif: false, raison: parent.raison ?? null } : { actif: enfant.actif !== false, raison: enfant.actif === false ? (enfant.raison ?? null) : null };

/** Hachure les cases que nomme la vue sur la carte ; null les efface. */
function hachurer(r, noms) {
  r.actions.hachurer?.(noms);
}

/**
 * Lie un déclencheur à son infobulle (combat_bulle.js, creerInfobulles) :
 * contenu, une fonction qui la remplit (nulle : les hachures seules) ;
 * hachures, les cases à hachurer pendant qu'elle est ouverte ; cotes, ses
 * côtés (nuls : ceux que la bulle choisit).
 */
function lier(r, declencheur, options) {
  r.lier?.(declencheur, { contenu: null, hachures: null, cotes: null, ...options });
}

/**
 * Pose data-focus sur la commande qui attend, et sur elle seule. La zone
 * relève aussi chaque clé posée (r.cles) : si le réglage qui gardait le
 * focus n'est plus là, elle retrouve sans tout refaire la commande qui
 * attend.
 */
function marquer(r, noeud, cle) {
  if (!present(cle)) return;
  if (r.cles && !r.cles.has(cle)) r.cles.set(cle, noeud);
  if (r.pose || cle !== r.focus) return;
  noeud.setAttribute("data-focus", cle);
  r.pose = true;
}

/**
 * Un réglage qui ne fait pas avancer le geste (une caractéristique sur deux,
 * la défense) : le corps refait, le focus revient au réglage de même clé,
 * et non à la commande qui attend ; on y revient d'un geste.
 */
function surPlace(r, cle, faire) {
  r.garder?.(cle);
  try {
    faire();
  } finally {
    r.garder?.(null);
  }
}

/**
 * Le nom accessible d'un bouton ou d'un dé. Il peut porter un nom venu de la
 * banque (une zone, une arme) : comme tout texte montré, il perd les signes
 * qui commandent le sens de l'écriture.
 */
const nomAccessible = (etiquette) => (present(etiquette) ? sansSensForce(etiquette) : null);

/**
 * Un bouton qui émet sa commande (avec l'origine du clic, ou celle qu'on lui
 * donne), ou qui appelle faire(lui-même) : ouvrir la palette, par exemple.
 * Inactif, il garde le focus (aria-disabled, jamais disabled), ne fait rien,
 * et sa raison, écrite juste après lui, lui est liée. Rend le bouton, puis sa
 * raison s'il en a une.
 */
function bouton(r, { cle = null, classe, contenu, commande = null, actif = true, raison = null, presse, etiquette = null, garde = false, origine = null, faire = null, repere = null }) {
  const inactif = actif === false;
  const idRaison = inactif && rempli(raison) ? identifiant(r, "raison") : null;
  const noeud = el(
    "button",
    {
      type: "button",
      classe,
      "data-repere": present(repere) ? repere : null,
      "aria-pressed": presse === undefined ? null : String(Boolean(presse)),
      "aria-disabled": inactif ? "true" : null,
      "aria-describedby": idRaison,
      "aria-label": nomAccessible(etiquette),
      onclick: () => {
        if (inactif) return;
        if (faire) {
          faire(noeud);
          return;
        }
        if (!commande) return;
        if (garde && present(cle)) surPlace(r, cle, () => emettre(r, commande));
        else emettre(r, commande, origine ?? origineDe(r));
      },
    },
    contenu,
  );
  marquer(r, noeud, cle);
  return [noeud, idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, raison) : null];
}

/**
 * Une saisie : un nombre, sa raison si la vue en demande une, et le bouton
 * qui émet le gabarit complété. Une raison vide ne part jamais : sans elle,
 * seul un nombre nul s'émet (il efface le réglage), sauf pour des dégâts,
 * dont l'opération exige toujours la sienne.
 *
 * Quand la vue donne « sansEffet » ({ valeur, commande }), ce nombre-là
 * n'émet que sa commande, sans raison, ou rien si elle est nulle : des
 * dégâts « ajustés à » la valeur calculée ne changent rien (mission du lot
 * 4.3, § 6).
 *
 * Une saisie refusée ne part pas, et le dit : le champ fautif est marqué
 * (aria-invalid, que la feuille de style montre), une phrase liée aux deux
 * champs dit ce qui est attendu, et le focus va au champ, sans faire défiler
 * la page. Tant que rien n'est refusé, la phrase est vide : un lecteur
 * d'écran lit la description d'un champ même quand elle est cachée. Rend la
 * rangée, puis la phrase.
 */
function saisie(r, { cle, libelle, donnee, action, defaut = "" }) {
  const idRefus = identifiant(r, "refus");
  const refus = el("p", { id: idRefus, classe: "combat-refus", hidden: true });
  const nombre = el("input", {
    type: "number",
    classe: "champ",
    step: "1",
    min: present(donnee.min) ? donnee.min : null,
    max: present(donnee.max) ? donnee.max : null,
    "aria-describedby": idRefus,
  });
  nombre.value = String(donnee.valeur ?? defaut);
  marquer(r, nombre, cle);
  // Seule « raisonParDefaut » demande une raison : depuis la vague 3, tout
  // objet qui porte un gabarit porte aussi « raison », celle qui dit pourquoi
  // il est inactif (null quand il est actif), et l'esquive en est un.
  const veutUneRaison = Object.hasOwn(donnee, "raisonParDefaut");
  const raison = veutUneRaison ? el("input", { type: "text", classe: "champ", "aria-describedby": idRefus }) : null;
  if (raison) raison.value = String(donnee.raison ?? donnee.raisonParDefaut ?? "");

  const refuser = (champ, phrase) => {
    champ.setAttribute("aria-invalid", "true");
    refus.replaceChildren(phrase);
    refus.hidden = false;
    champ.focus({ preventScroll: true });
  };
  const envoyer = () => {
    nombre.removeAttribute("aria-invalid");
    raison?.removeAttribute("aria-invalid");
    refus.replaceChildren();
    refus.hidden = true;
    const valeur = lireEntier(nombre.value, donnee.min, donnee.max);
    if (valeur === null) {
      refuser(nombre, nombreRefuse(donnee));
      return;
    }
    if (present(donnee.sansEffet) && valeur === donnee.sansEffet.valeur) {
      emettre(r, donnee.sansEffet.commande);
      return;
    }
    let dite = null;
    if (raison) {
      dite = raison.value.trim();
      if (dite === "") {
        if (valeur !== 0 || donnee.gabarit?.evenement?.type === "degats") {
          refuser(raison, RAISON_REFUSEE);
          return;
        }
        dite = null;
      }
    }
    emettre(r, completer(donnee.gabarit, valeur, dite));
  };
  const auClavier = (evenement) => {
    if (evenement.key !== "Enter") return;
    evenement.preventDefault();
    envoyer();
  };
  nombre.addEventListener("keydown", auClavier);
  raison?.addEventListener("keydown", auClavier);

  return [
    el(
      "div",
      { classe: "combat-ligne" },
      el("label", {}, `${libelle}${ecrireBornes(donnee)}`, nombre),
      raison ? el("label", {}, "Raison", raison) : null,
      el("button", { type: "button", classe: "bouton secondaire", onclick: envoyer }, action),
    ),
    refus,
  ];
}

/**
 * Une rangée de choix : son intitulé, puis un bouton par option. C'est un
 * groupe, que son intitulé nomme : un lecteur d'écran dit « Arrivée : » en
 * entrant dans la rangée, et non une suite de boutons sans objet.
 */
function rangee(r, classe, intitule, ...boutons) {
  const id = identifiant(r, "rangee");
  return el("div", { classe, role: "group", "aria-labelledby": id }, el("span", { id }, intitule), boutons);
}

/** Un paragraphe, ou rien pour un texte vide. */
const paragraphe = (texte, classe = null) => (rempli(texte) ? el("p", { classe }, texte) : null);

/**
 * Les phrases des causes : une par source, dans la couleur de son sens,
 * suivie, dans le même paragraphe, de la description de la source entre
 * guillemets quand elle en a une.
 */
function phrasesDesCauses(causes) {
  return (causes ?? []).map((cause) =>
    el("p", { classe: CLASSE_DE_CAUSE[cause.sens] ?? null }, cause.texte, rempli(cause.citation) ? [" ", el("span", { classe: "combat-citation" }, cause.citation)] : null),
  );
}

/**
 * L'infobulle d'une ligne ou d'un passif (vue Survol), dans l'ordre du
 * contrat (§ 9.5) : son titre en gras, puis « · » et son origine s'il en a
 * une, à même l'infobulle ; puis un paragraphe pour sa description, sa
 * portée, chacune de ses causes, son coût. Ce qui est vide n'a pas de
 * paragraphe ; une absence ne s'explique pas. Le « · » est un texte, que
 * append et replaceChildren prennent comme un nœud.
 */
function contenuDuSurvol(survol) {
  if (!survol) return null;
  return [
    el("b", { classe: "combat-infobulle-titre" }, survol.titre ?? ""),
    rempli(survol.origine) ? [POINT_DU_TITRE, el("span", { classe: "combat-sous" }, survol.origine)] : null,
    paragraphe(survol.description),
    paragraphe(survol.portee),
    phrasesDesCauses(survol.causes),
    paragraphe(survol.cout, "combat-infobulle-cout"),
  ]
    .flat()
    .filter(present);
}

// ——— La liste ———

/**
 * L'aperçu d'une ligne, ouvert sous elle au doigt : sa description, sa
 * portée, ses causes, puis « Jouer … », qui la joue. Une ligne inactive y
 * montre sa raison, en clair, au lieu du bouton.
 */
function apercuDeLaLigne(ligne, jouer) {
  const survol = ligne.survol ?? {};
  return el(
    "div",
    { classe: "combat-apercu" },
    paragraphe(survol.description),
    paragraphe(survol.portee),
    phrasesDesCauses(survol.causes),
    ligne.actif === false ? paragraphe(ligne.raison) : el("button", { type: "button", classe: "bouton", onclick: jouer }, ligne.jouer ?? ""),
  );
}

/**
 * Une ligne : une capacité à une puissance. Son bouton porte le libellé, les
 * dégâts (ou les cases d'un déplacement), « désavantage », « intervention »
 * et le coût, présents s'il y a lieu, séparés d'une espace : sans elle, le
 * nom du bouton se lirait d'un seul tenant (« Frappe3/8/20 »).
 *
 * Le doigt se juge à l'appui lui-même (pointerType, noté au pointerdown) :
 * un premier appui ouvre l'aperçu sans rien émettre, un second joue. La
 * souris et Entrée jouent toujours ; Entrée est prise au keydown, pour
 * qu'un appui du doigt fait avant ne la change pas en aperçu.
 */
function ligneDeCapacite(r, ligne, apercus) {
  const inactif = ligne.actif === false;
  const idRaison = inactif && rempli(ligne.raison) ? identifiant(r, "raison") : null;
  const jouer = () => {
    if (!inactif) emettre(r, ligne.commande);
  };
  let appui = null;
  const noeud = el(
    "button",
    {
      type: "button",
      classe: "combat-capacite",
      "data-ligne": ligne.cle,
      "aria-disabled": inactif ? "true" : null,
      "aria-describedby": idRaison,
      onpointerdown: (evenement) => {
        appui = evenement.pointerType ?? null;
      },
      onkeydown: (evenement) => {
        if (evenement.key !== "Enter") return;
        evenement.preventDefault();
        appui = null;
        jouer();
      },
      onclick: () => {
        const auDoigt = appui === "touch";
        appui = null;
        if (auDoigt && apercus.ouvert.cle !== ligne.cle) apercus.ouvrir(ligne.cle);
        else jouer();
      },
    },
    enumerer(
      [
        el("span", {}, ligne.libelle),
        rempli(ligne.degats) ? el("span", { classe: "combat-degats" }, ligne.degats) : null,
        ligne.desavantage ? el("span", { classe: "combat-desavantage" }, DESAVANTAGE) : null,
        ligne.intervention ? el("span", { classe: "combat-intervention" }, INTERVENTION) : null,
        rempli(ligne.cout) ? el("span", { classe: "combat-cout" }, ligne.cout) : null,
      ].filter(present),
      " ",
    ),
  );
  marquer(r, noeud, `ligne:${ligne.cle}`);
  // La raison d'abord, puis l'infobulle : son identifiant suit celui de la raison.
  const option = el("div", { classe: "combat-option" }, noeud, idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, ligne.raison) : null);
  lier(r, noeud, { contenu: () => contenuDuSurvol(ligne.survol), hachures: ligne.survol?.hachures ?? null });
  // La ligne déclare l'aperçu qu'elle ouvre (aria-expanded, aria-controls) tant qu'il est ouvert.
  apercus.places.set(ligne.cle, { place: option, hachures: ligne.survol?.hachures ?? null, fabriquer: () => apercuDeLaLigne(ligne, jouer), declencheur: noeud });
  return option;
}

/**
 * Le pied de la liste : les passifs, séparés par une virgule, chacun
 * focalisable et lié à son infobulle, sans hachure. Au doigt, un appui
 * ouvre son aperçu (le même contenu, sans bouton), un second le referme ;
 * il se pose juste après le pied, à sa place.
 */
function piedDesPassifs(r, passifs, apercus) {
  if (passifs.length === 0) return [];
  const place = el("div", {});
  const noms = passifs.map((passif) => {
    let appui = null;
    const noeud = el(
      "span",
      {
        classe: "combat-passif",
        tabindex: "0",
        onpointerdown: (evenement) => {
          appui = evenement.pointerType ?? null;
        },
        onclick: () => {
          const auDoigt = appui === "touch";
          appui = null;
          if (auDoigt) apercus.basculer(passif.cle);
        },
      },
      passif.libelle,
    );
    lier(r, noeud, { contenu: () => contenuDuSurvol(passif.survol) });
    apercus.places.set(passif.cle, { place, hachures: null, fabriquer: () => el("div", { classe: "combat-apercu" }, contenuDuSurvol(passif.survol)) });
    return noeud;
  });
  return [el("p", { classe: "combat-bulle-pied" }, el("b", {}, PASSIFS), " ", enumerer(noms, ", ")), place];
}

/**
 * Les aperçus d'une composition : un seul ouvert à la fois ; sa clé
 * (r.memoire.apercu) survit à un corps refait : il se rouvre, avec ses
 * hachures, tant que sa ligne est là (rouvrir). Ouvert sous une ligne, il a
 * un identifiant, et la ligne le dit (aria-expanded, aria-controls) jusqu'à
 * ce qu'il se ferme : un lecteur d'écran sait que l'appui a ouvert quelque
 * chose (WCAG 4.1.2) ; un passif ne porte rien. Ouvert, il se montre dans la
 * partie vue de la bulle (r.actions.montrer, que la zone n'a pas).
 */
function apercusDe(r) {
  const memoire = r.memoire ?? {};
  return {
    places: new Map(),
    ouvert: { cle: null, noeud: null, declencheur: null },
    fermer() {
      const { noeud, declencheur } = this.ouvert;
      noeud?.remove();
      declencheur?.removeAttribute("aria-expanded");
      declencheur?.removeAttribute("aria-controls");
      this.ouvert = { cle: null, noeud: null, declencheur: null };
    },
    ouvrir(cle) {
      const apercu = this.places.get(cle);
      if (!apercu) return;
      this.fermer();
      const noeud = apercu.fabriquer();
      const declencheur = apercu.declencheur ?? null;
      if (declencheur !== null) {
        const id = identifiant(r, "apercu");
        noeud.setAttribute("id", id);
        declencheur.setAttribute("aria-expanded", "true");
        declencheur.setAttribute("aria-controls", id);
      }
      apercu.place.append(noeud);
      r.actions?.montrer?.(noeud);
      this.ouvert = { cle, noeud, declencheur };
      memoire.apercu = cle;
      hachurer(r, apercu.hachures);
    },
    basculer(cle) {
      if (this.ouvert.cle !== cle) {
        this.ouvrir(cle);
        return;
      }
      this.fermer();
      memoire.apercu = null;
      hachurer(r, null);
    },
    // L'aperçu gardé se rouvre si sa ligne est là ; sinon, il s'oublie.
    rouvrir() {
      if (!present(memoire.apercu)) return;
      if (this.places.has(memoire.apercu)) this.ouvrir(memoire.apercu);
      else memoire.apercu = null;
    },
  };
}

/** Le fil des étapes, au téléphone : « 2 · Cible » pour celle en cours, les autres à leur nom. */
function fil(liste) {
  if (!liste?.length) return null;
  return el(
    "ol",
    { classe: "combat-fil" },
    liste.map((entree, rang) =>
      el(
        "li",
        { classe: CLASSE_ETAPE[entree.etat] ?? null, "aria-current": entree.etat === "en_cours" ? "step" : null },
        rang > 0 ? el("span", { "aria-hidden": "true" }, SEPARATEUR_DU_FIL) : null,
        entree.etat === "en_cours" ? `${rang + 1} · ${entree.nom}` : entree.nom,
      ),
    ),
  );
}

/**
 * La liste des capacités d'un protagoniste (vuePanneau « action » sans
 * geste), sans en-tête ni conteneur : par groupe, son intitulé puis une
 * ligne par capacité et par puissance ; « Passer son tour » ferme le dernier
 * groupe ; les passifs en pied. Au téléphone, le fil et la consigne
 * (« Que fait Aubépine ? ») la précèdent. Rend des nœuds. Ses aperçus :
 * apercusDe.
 */
export function composerListe(r, vue) {
  const apercus = apercusDe(r);

  const passer = vue.passer
    ? el("div", { classe: "combat-option" }, bouton(r, { cle: "passer", classe: "combat-capacite", actif: vue.passer.actif, raison: vue.passer.raison, commande: vue.passer.commande, contenu: PASSER }))
    : null;
  const groupes = vue.groupes ?? [];
  const noeuds = groupes.map((groupe, i) =>
    el(
      "div",
      { classe: "combat-groupe" },
      el("h3", { classe: "combat-groupe-titre" }, groupe.titre),
      (groupe.lignes ?? []).map((ligne) => ligneDeCapacite(r, ligne, apercus)),
      i === groupes.length - 1 ? passer : null,
    ),
  );
  if (passer && groupes.length === 0) noeuds.push(el("div", { classe: "combat-groupe" }, passer));
  noeuds.push(...piedDesPassifs(r, vue.passifs ?? [], apercus));
  if (r.etroit === true) noeuds.unshift(...[fil(vue.fil), paragraphe(vue.consigne, "combat-consigne")].filter(present));

  apercus.rouvrir();
  return noeuds;
}

// ——— Le geste, avant les dés ———

/** « Jet d'attaque » prête le jet d'une arme ; son infobulle n'a que les hachures de sa portée. */
function jetPrete(r, j) {
  const [noeud, raison] = bouton(r, {
    cle: "jet_prete",
    classe: "combat-capacite",
    presse: Boolean(j.presse),
    actif: j.actif,
    raison: j.raison,
    commande: j.commande,
    contenu: present(j.arme) ? `Jet d'attaque (${j.arme})` : "Jet d'attaque",
  });
  lier(r, noeud, { contenu: null, hachures: j.hachures ?? null });
  return el("div", { classe: "combat-ligne combat-jet-prete" }, noeud, raison);
}

function armes(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-armes",
    "Arme :",
    liste.map((arme, i) => bouton(r, { cle: `arme:${i}`, classe: "combat-capacite", presse: Boolean(arme.choisie), commande: arme.commande, contenu: arme.libelle })),
  );
}

/**
 * Les cibles : un bouton par cible possible, d'où vient le choix après la
 * choisie, puis ce que la vue en dit (ciblesDetail : sa case, sa défense,
 * son corps, ou pourquoi elle est hors de portée).
 */
function cibles(r, geste) {
  const liste = geste.cibles ?? [];
  if (liste.length === 0 && !geste.sansCible) return null;
  const origine = TEXTE_ORIGINE[r.origineDeLaCible] ?? null;
  const details = new Map((geste.ciblesDetail ?? []).map((une) => [une.id, une.detail]));
  return rangee(
    r,
    "combat-cibles",
    "Cible :",
    liste.map((cible) => [
      bouton(r, { cle: `cible:${cible.id}`, classe: null, presse: Boolean(cible.choisie), actif: cible.actif, raison: cible.raison, commande: cible.commande, contenu: cible.libelle }),
      cible.choisie && origine ? el("span", { classe: "combat-origine" }, origine) : null,
      rempli(details.get(cible.id)) ? el("span", { classe: "combat-cible-detail" }, details.get(cible.id)) : null,
    ]),
    geste.sansCible ? bouton(r, { cle: "sans_cible", classe: null, presse: Boolean(geste.sansCible.choisie), commande: geste.sansCible.commande, contenu: "Sans cible" }) : null,
  );
}

/**
 * Les cases d'arrivée : les doubles, en boutons de 44 px, des cases de la
 * carte. Chacun porte le nom que la vue donne à sa case (« Case G2 : s'y
 * déplacer »), le même que sur la carte, et sa commande, qui peut porter
 * deux événements (la puissance, puis l'arrivée).
 */
function cases(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-arrivees",
    "Arrivée :",
    liste.map((c) => bouton(r, { cle: `case:${c.case}`, classe: "combat-capacite", presse: Boolean(c.choisie), commande: c.commande, contenu: c.case, etiquette: c.nom ?? null })),
  );
}

/**
 * Les caractéristiques d'un dé au choix. L'événement en veut une ou deux :
 * toucher une caractéristique choisie la retire (sauf la dernière), en
 * toucher une autre l'ajoute, et une troisième repart d'elle seule.
 */
function caracteristiques(r, c) {
  const choisies = c.choisies ?? [];
  const apres = (code) => {
    if (choisies.includes(code)) return choisies.length > 1 ? choisies.filter((autre) => autre !== code) : null;
    return choisies.length < 2 ? [...choisies, code] : [code];
  };
  return rangee(
    r,
    "combat-ligne combat-caracteristiques",
    present(c.de) ? ["Caractéristiques, une ou deux (dé : ", el("b", {}, c.de), ") :"] : "Caractéristiques, une ou deux :",
    (c.options ?? []).map((option) => {
      const valeur = apres(option.code);
      return bouton(r, {
        cle: `caracteristique:${option.code}`,
        classe: "combat-capacite",
        presse: choisies.includes(option.code),
        commande: valeur && c.gabarit?.evenement ? { evenement: { ...c.gabarit.evenement, valeur } } : null,
        contenu: present(option.valeur) ? `${option.nom} ${option.valeur}` : option.nom,
        garde: true,
      });
    }),
  );
}

function difficultes(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-difficultes",
    "Difficulté :",
    liste.map((d) => bouton(r, { cle: `difficulte:${d.valeur}`, classe: "combat-capacite", presse: Boolean(d.choisie), commande: d.commande, contenu: present(d.libelle) ? `${d.valeur} (${d.libelle})` : d.valeur })),
  );
}

function jauges(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-jauges",
    "Lien payé sur :",
    liste.map((jauge, i) => bouton(r, { cle: `jauge:${i}`, classe: "combat-capacite", presse: Boolean(jauge.choisie), commande: jauge.commande, contenu: jauge.nom })),
  );
}

/** La capacité qu'attendre garde : un bouton par ligne de qui attend. */
function gardes(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-gardes",
    "Garder :",
    liste.map((garde, i) => bouton(r, { cle: `garde:${i}`, classe: "combat-capacite", presse: Boolean(garde.choisie), commande: garde.commande, contenu: garde.libelle })),
  );
}

// ——— Le geste du lot 4.3 (vague 3) ———

const CLASSE_D_AVANCEMENT = { ...CLASSE_ETAPE, a_venir: "a-venir" };

/** L'avancement de plusieurs cibles : une entrée par cible, faite, en cours ou à venir, et ce qui s'y est passé. */
function progression(liste) {
  if (!liste?.length) return null;
  return el(
    "ol",
    { classe: "combat-progression" },
    liste.map((entree) =>
      el(
        "li",
        { classe: CLASSE_D_AVANCEMENT[entree.etat] ?? null, "aria-current": entree.etat === "en_cours" ? "step" : null },
        entree.libelle,
        rempli(entree.detail) ? [" ", el("span", { classe: "combat-sous" }, entree.detail)] : null,
      ),
    ),
  );
}

/**
 * « Un jet par cible : 2 cibles » (une façon Centrée en préparation) : sur
 * PC, une phrase ; au téléphone, un bouton qui mène le volet aux dés, sans
 * rien émettre (r.actions.passerAuxDes).
 */
function jetsParCible(r, j) {
  if (!j || !rempli(j.libelle)) return null;
  if (r.etroit !== true) return el("p", { classe: "combat-jets-par-cible" }, j.libelle);
  return bouton(r, { cle: "jets_par_cible", classe: "bouton combat-jets-par-cible", contenu: j.libelle, faire: () => r.actions.passerAuxDes?.() });
}

/**
 * Un bouton qui ouvre la palette à un nom (un passif, « Appliquer l'effet
 * de… », « Palette ») ; l'ancre est lui. « Palette » l'ouvre libre (Mode MJ :
 * tout genre, la source au choix). Son repère (data-repere, sa clé) reste le
 * même d'un rendu à l'autre : quand la bulle refait son corps, l'écran y
 * rend le focus au bouton de même repère.
 */
function ouvreLaPalette(r, { cle, classe, contenu, source, actif = true, raison = null, libre = false }) {
  return bouton(r, { cle, classe, contenu, actif, raison, repere: cle, faire: (noeud) => r.actions.ouvrirPalette?.(source, noeud, { libre }) });
}

/** Les passifs non câblés du lanceur du jet en cours (F5) : un bouton chacun, son texte, qui ouvre la palette à son nom. */
function passifsDuJet(r, liste) {
  if (!liste?.length) return null;
  return el(
    "div",
    {},
    liste.map((passif) =>
      ouvreLaPalette(r, {
        cle: passif.cle,
        classe: "combat-passif-bouton",
        contenu: [passif.libelle, rempli(passif.texte) ? [" ", el("span", { classe: "combat-sous" }, passif.texte)] : null],
        source: passif.source,
        actif: passif.actif,
        raison: passif.raison,
      }),
    ),
  );
}

/**
 * « Inverser » et « Relancer » sous le dernier dé (F5), tant que la palette
 * est ouverte : les genres de son onglet Dés, leur actif et leur raison ; un
 * appui émet leur gabarit, complet, depuis la palette.
 */
function outilsDuDe(r, geste) {
  if (!present(geste.dernierDe) || !r.palette) return null;
  const des = (r.palette.onglets ?? []).find((onglet) => onglet.cle === "des");
  const outils = (des?.genres ?? []).filter((genre) => (genre.genre === "inverser" || genre.genre === "relancer") && montre(r, genre));
  if (outils.length === 0) return null;
  return el(
    "div",
    { classe: "combat-de-outils" },
    outils.map((genre) =>
      bouton(r, { cle: `outil:${genre.genre}`, classe: "bouton secondaire", actif: genre.actif, raison: genre.raison, commande: genre.gabarit?.evenement ? { evenement: genre.gabarit.evenement } : null, origine: ORIGINE_DE_LA_PALETTE, contenu: genre.libelle }),
    ),
  );
}

/** Le coup critique possible (F6) : ce que dit le jet, et ce qu'un 4e dé ferait ; ses choix sont ceux du moment. */
function critique(c) {
  if (!c) return null;
  return el("div", { classe: "combat-critique" }, paragraphe(c.texte), paragraphe(c.detail));
}

/**
 * La contre-attaque (F3) : « 20 : contre-attaque ! », la phrase, puis les
 * attaques de l'arme, une ligne par puissance, chacune qui contre-attaque ;
 * « Laisser passer » reste dans les choix du moment.
 */
function contreAttaque(r, c, apercus) {
  if (!c) return null;
  return el(
    "div",
    { classe: "combat-contre-attaque" },
    el("p", {}, el("b", {}, c.titre ?? "")),
    paragraphe(c.texte),
    (c.groupes ?? []).map((groupe) => el("div", { classe: "combat-groupe" }, el("h3", { classe: "combat-groupe-titre" }, groupe.titre), (groupe.lignes ?? []).map((ligne) => ligneDeCapacite(r, ligne, apercus)))),
  );
}

/** L'esquive, au seul attaqué : combien (X), dans les bornes de la vue ; son coût et ce qu'elle annule. */
function esquive(r, e) {
  return [
    rempli(e.cout) || rempli(e.texte) ? el("p", { classe: "combat-sous" }, [e.texte, e.cout].filter(rempli).join(" · ")) : null,
    saisie(r, { cle: "esquive", libelle: `${e.libelle}, X`, donnee: e, action: e.libelle, defaut: e.min ?? "" }),
  ];
}

/**
 * L'étape des interventions (F2, E2) : la tête (ce que fait le coup), puis
 * chaque intervenant (son initiale, son nom, ses actions et son souffle) et
 * ses interventions, chacune avec son coût ; l'esquive sous l'attaqué.
 * « Passer : … » est le dernier bouton du geste (dernierBouton).
 */
function interventions(r, geste) {
  const i = geste.interventions;
  const e = geste.esquive ?? null;
  if (!i) return e ? esquive(r, e) : null;
  let esquivePosee = e === null;
  const intervenants = (i.intervenants ?? []).map((intervenant) => {
    const ici = !esquivePosee && present(e.qui) && e.qui === intervenant.id;
    if (ici) esquivePosee = true;
    return el(
      "div",
      { classe: "combat-intervenant" },
      el("p", {}, rempli(intervenant.initiales) ? [el("span", { "aria-hidden": "true" }, intervenant.initiales), " "] : null, el("b", {}, intervenant.nom ?? ""), rempli(intervenant.sous) ? ` · ${intervenant.sous}` : null),
      ici ? esquive(r, e) : null,
      (intervenant.options ?? []).map((option) => {
        const { actif, raison } = herite(intervenant, option);
        return bouton(r, {
          cle: option.cle,
          classe: "combat-capacite",
          actif,
          raison,
          commande: option.commande,
          contenu: enumerer([el("span", {}, option.libelle), rempli(option.cout) ? el("span", { classe: "combat-cout" }, option.cout) : null, rempli(option.texte) ? el("span", { classe: "combat-sous" }, option.texte) : null].filter(present), " "),
        });
      }),
    );
  });
  return el("div", { classe: "combat-interventions" }, paragraphe(i.tete), intervenants, esquivePosee ? null : esquive(r, e));
}

/**
 * Le dernier bouton du geste : « Passer : … » quand l'étape des
 * interventions est là (il émet la commande d'« Appliquer ») ; sinon
 * « Terminer » au téléphone, le libellé de la vue sur PC.
 */
function dernierBouton(r, geste) {
  if (!geste.appliquer) return null;
  const passer = geste.interventions?.passer ?? null;
  const contenu = rempli(passer) ? passer : r.etroit === true ? TERMINER : (geste.appliquer.libelle ?? "Appliquer");
  return bouton(r, { cle: "appliquer", classe: "bouton", commande: geste.appliquer.commande, contenu });
}

/** « Appliquer l'effet de Frappe… » (Mode MJ ou non), et « Palette » (Mode MJ, au téléphone) : chacun ouvre la palette. */
function ouvertures(r, geste) {
  return [
    geste.appliquerEffet ? ouvreLaPalette(r, { cle: "appliquer_effet", classe: "bouton secondaire", contenu: geste.appliquerEffet.libelle, source: geste.appliquerEffet.source }) : null,
    r.etroit === true && montre(r, geste.palette) ? ouvreLaPalette(r, { cle: "palette", classe: "bouton secondaire", contenu: geste.palette.libelle, source: geste.palette.source, libre: true }) : null,
  ].filter(present);
}

// ——— La blessure ———

/** Ce que dit un nom refusé : « Un nom de 1 à 40 signes est attendu. » */
const nomRefuse = (donnee) => `Un nom de 1 à ${typeof donnee.max === "number" ? donnee.max : 1} signes est attendu.`;

/**
 * Un nom à saisir (un état libre, « Une autre… »), et le bouton qui émet le
 * gabarit de la vue complété de ce nom, dans « libre ». Un nom vide, ou plus
 * long que la borne de la vue, ne part pas, et le dit comme une saisie
 * refusée. Rend la rangée, puis la phrase.
 */
function saisieDUnNom(r, { cle, libelle, donnee, action }) {
  const idRefus = identifiant(r, "refus");
  const refus = el("p", { id: idRefus, classe: "combat-refus", hidden: true });
  const champ = el("input", { type: "text", classe: "champ", maxlength: typeof donnee.max === "number" ? donnee.max : null, "aria-describedby": idRefus });
  marquer(r, champ, cle);
  const envoyer = () => {
    champ.removeAttribute("aria-invalid");
    refus.replaceChildren();
    refus.hidden = true;
    const nom = champ.value.trim();
    if (nom === "" || (typeof donnee.max === "number" && nom.length > donnee.max)) {
      champ.setAttribute("aria-invalid", "true");
      refus.replaceChildren(nomRefuse(donnee));
      refus.hidden = false;
      champ.focus({ preventScroll: true });
      return;
    }
    const evenement = donnee.gabarit?.evenement;
    if (evenement) emettre(r, { evenement: { ...evenement, libre: nom } });
  };
  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key !== "Enter") return;
    evenement.preventDefault();
    envoyer();
  });
  return [el("div", { classe: "combat-ligne" }, el("label", {}, libelle, champ), el("button", { type: "button", classe: "bouton secondaire", onclick: envoyer }, action)), refus];
}

/**
 * L'étape « La blessure » : son titre (« Blessure : Aubépine, bras
 * gauche »), ce que le coup a fait (« C = 10 : armure 2 → 0, … »), une
 * option par capacité du bloc de blessure, chacune suivie de son texte, la
 * phrase d'une banque sans bloc, puis l'état libre. Une option est une
 * rangée de choix, jamais une .combat-option, qui a l'aspect de « Passer son
 * tour ».
 */
function blessure(r, b) {
  return el(
    "div",
    { classe: "combat-blessure" },
    el("p", { classe: "combat-blessure-titre" }, b.titre ?? ""),
    paragraphe(b.detail, "combat-blessure-detail"),
    (b.options ?? []).map((option) =>
      el(
        "div",
        { classe: "combat-choix" },
        bouton(r, { cle: option.cle, classe: "combat-capacite", actif: option.actif, raison: option.raison, commande: option.commande, contenu: option.libelle }),
        paragraphe(option.description, "combat-sous"),
      ),
    ),
    paragraphe(b.vide),
    b.libre ? saisieDUnNom(r, { cle: "blessure:libre", libelle: b.libre.libelle ?? "", donnee: b.libre, action: "Choisir" }) : null,
  );
}

// ——— Le contexte du jet ———

/**
 * Le nombre des avantages et des désavantages, et sa cause. Le bouton porte
 * le nombre et le signe (caché aux lecteurs d'écran, que son nom renseigne) ;
 * son survol et son focus ouvrent l'infobulle des causes, dessous ou
 * dessus. Au doigt, un appui montre ou cache l'explication sous la ligne
 * (aria-expanded) ; au clavier aussi, pour que le bouton fasse ce que son
 * état annonce ; à la souris, l'infobulle suffit. Ouverte, elle le reste
 * tant que le geste ne change pas (r.memoire.causesOuvertes).
 */
function causes(r, c) {
  const memoire = r.memoire ?? {};
  const ouvertes = memoire.causesOuvertes === true;
  const phrases = () => [...phrasesDesCauses(c.phrases), paragraphe(c.compte)].filter(present);
  const explication = el("div", { classe: "combat-cause-explication", hidden: !ouvertes }, phrases());
  let appui = null;
  const declencheur = el(
    "button",
    {
      type: "button",
      classe: "combat-cause",
      "aria-label": nomAccessible(c.nom),
      "aria-expanded": String(ouvertes),
      onpointerdown: (evenement) => {
        appui = evenement.pointerType ?? null;
      },
      onclick: () => {
        const souris = appui === "mouse";
        appui = null;
        if (souris) return;
        const montrer = explication.hidden;
        explication.hidden = !montrer;
        declencheur.setAttribute("aria-expanded", String(montrer));
        memoire.causesOuvertes = montrer;
      },
    },
    c.nombre,
    " ",
    el("span", { classe: "combat-cause-signe", "aria-hidden": "true" }, SIGNE_DE_LA_CAUSE),
  );
  lier(r, declencheur, { contenu: phrases, cotes: ["dessous", "dessus"] });
  return [el("p", {}, declencheur), explication];
}

/**
 * Le type de défense au choix (à égalité de dés, jusqu'au premier dé) :
 * une liste, dont chaque option porte son code ; le changement émet la
 * commande de l'option choisie, et le focus y revient.
 */
function defense(r, d) {
  const id = identifiant(r, "defense");
  const options = d.options ?? [];
  const liste = el(
    "select",
    {
      id,
      classe: "champ",
      onchange: () => {
        const choisie = options.find((option) => option.code === liste.value) ?? null;
        if (choisie?.commande) surPlace(r, "defense", () => emettre(r, choisie.commande));
      },
    },
    options.map((option) => el("option", { value: option.code, selected: Boolean(option.choisie) }, option.libelle)),
  );
  const choisie = options.find((option) => option.choisie);
  if (choisie) liste.value = choisie.code;
  marquer(r, liste, "defense");
  return el("div", { classe: "combat-defense" }, el("label", { for: id }, d.libelle ?? DEFENSE), liste);
}

/**
 * Le contexte : le dé nu, puis ses modificateurs, chacun avec sa source, à
 * sa suite et sans séparateur, comme sur la maquette (« Dé d8 (Force 4 +
 * Agilité 5) +1 (Vif) »), puis la difficulté ; les causes ; la défense.
 */
function contexte(r, c) {
  if (!c) return null;
  const jet = [];
  const modificateurs = c.modificateurs ?? [];
  if (present(c.de)) jet.push(["Dé ", el("b", {}, c.de), present(c.detail) ? ` (${c.detail})` : null, modificateurs.map((modificateur) => ` ${modificateur}`)]);
  else for (const modificateur of modificateurs) jet.push(modificateur);
  if (present(c.difficulte)) jet.push(["difficulté ", el("b", {}, c.difficulte)]);
  const lignes = [jet.length ? el("p", {}, enumerer(jet, " · ")) : null, c.causes ? causes(r, c.causes) : null, c.defense ? defense(r, c.defense) : null].flat().filter(present);
  return lignes.length ? el("div", { classe: "combat-contexte" }, lignes) : null;
}

// ——— Les dés ———

/** Un dé : son titre, sa valeur (ou son type tant qu'il n'est pas lancé), son détail. Seul le dé à lancer agit. */
function de(r, { titre, valeur, detail, classe, etiquette, aLancer }) {
  const noeud = el(
    "button",
    {
      type: "button",
      classe: classe ? `combat-de ${classe}` : "combat-de",
      "aria-label": nomAccessible(etiquette),
      "aria-disabled": aLancer ? null : "true",
      onclick: () => {
        if (aLancer) r.actions.lancerLeDe();
      },
    },
    present(titre) ? el("span", { classe: "combat-de-titre" }, titre) : null,
    el("span", { classe: "combat-de-valeur" }, valeur ?? ""),
    rempli(detail) ? el("span", { classe: "combat-de-detail" }, detail) : null,
  );
  if (aLancer) marquer(r, noeud, "de");
  return noeud;
}

/** Ce que dit le dé à lancer : « touchez » au téléphone, « cliquez » sinon. */
const invite = (r) => (r.etroit === true ? TOUCHEZ : CLIQUEZ);

/** Le dé qu'attend le moteur, quand aucune entrée de la chaîne ne le montre. */
function deALancer(r, titre, aLancer) {
  return de(r, { titre, valeur: aLancer.libelle, detail: invite(r), classe: ETATS_DE.a_lancer.classe, etiquette: `${titre} : lancer le ${aLancer.libelle}`, aLancer: true });
}

function chaine(r, geste, dansLaChaine) {
  const entrees = geste.chaine ?? [];
  if (entrees.length === 0 && !dansLaChaine) return null;
  // Une seule entrée « à lancer » agit, et seulement si le moteur attend un dé.
  const attendue = geste.aLancer ? entrees.findIndex((entree) => entree.etat === "a_lancer") : -1;
  const des = entrees.map((entree, i) => {
    const etat = ETATS_DE[entree.etat] ?? { classe: "", dit: "", signe: null };
    const agit = i === attendue;
    const lance = present(entree.valeur);
    let detail = entree.detail ?? null;
    if (etat.signe) detail = [detail, etat.signe].filter(present).join(" ");
    else if (entree.etat === "relance") detail = etat.dit;
    else if (agit) detail = invite(r);
    const dit = [lance ? `${entree.valeur}${present(entree.detail) ? ` (${entree.detail})` : ""}` : entree.de, etat.dit].filter(rempli).join(", ");
    return de(r, { titre: entree.titre, valeur: lance ? entree.valeur : entree.de, detail, classe: etat.classe, etiquette: `${entree.titre} : ${dit}`, aLancer: agit });
  });
  if (dansLaChaine && attendue === -1) des.push(deALancer(r, "Dé", geste.aLancer));
  return el("div", { classe: "combat-chaine" }, des);
}

/** Les rangs de dégâts, l'atteint en évidence ; puis celui du coup critique (« critique : 16 »), s'il y en a un. */
function lettres(liste, rangCritique = null) {
  return el(
    "ul",
    { classe: "combat-lettres" },
    liste.map((lettre) => el("li", { classe: lettre.atteinte ? "atteinte" : null }, lettre.texte)),
    rempli(rangCritique) ? el("li", {}, rangCritique) : null,
  );
}

/** Les dégâts : la base, la nature et la saisie ; ce que seul le Mode MJ montre ne paraît pas quand il est éteint. */
function degats(r, d) {
  const noeuds = [];
  // L'indice d'une nature reste celui de la vue : sa clé ne change pas avec le Mode MJ.
  const natures = (d.natures ?? []).map((nature, i) => [nature, i]).filter(([nature]) => montre(r, nature));
  if (d.bases?.length) noeuds.push(rangee(r, "combat-ligne combat-degats-bases", "Dégâts :", d.bases.map((base, i) => bouton(r, { cle: `degats:base:${i}`, classe: "combat-capacite", presse: Boolean(base.choisie), commande: base.commande, contenu: base.libelle }))));
  if (natures.length) noeuds.push(rangee(r, "combat-ligne combat-degats-natures", "Nature :", natures.map(([nature, i]) => bouton(r, { cle: `degats:nature:${i}`, classe: "combat-capacite", presse: Boolean(nature.choisie), commande: nature.commande, contenu: nature.libelle }))));
  if (montre(r, d.saisie)) noeuds.push(saisie(r, { cle: "degats:saisie", libelle: "Dégâts à la main", donnee: d.saisie, action: "Fixer les dégâts" }));
  return noeuds;
}

/**
 * Ce que décale une saisie, sans équivoque : le dé tiré, puis, s'il a déjà
 * été décalé, la face qu'il vaut maintenant, puis la zone de cette face.
 * « Décaler le dé 14 : jambe gauche », « Décaler le dé 14 : face 16, bras
 * gauche ». Écrit « Décaler le 14 (bras gauche) », un dé déjà décalé se
 * lisait comme si le 14 tombait sur le bras.
 */
function libelleDuDecalage(coup) {
  const face = coup.face ?? coup.brut;
  const lu = [present(face) && face !== coup.brut ? `face ${face}` : null, coup.zone].filter(present).join(", ");
  return `Décaler le dé ${coup.brut}${lu === "" ? "" : ` : ${lu}`}`;
}

/** Les d20 lancés, celui qu'on attend, puis le décalage de chaque face qui peut l'être. */
function localisation(r, geste, d20Attendu) {
  const liste = geste.localisation ?? [];
  if (liste.length === 0 && !d20Attendu) return [];
  const des = liste.map((coup) => {
    const face = coup.face ?? coup.brut;
    const decale = present(coup.brut) && coup.brut !== face;
    const dite = [face, decale ? `dé ${coup.brut}` : null, coup.zone].filter(present).join(", ");
    // Un dé décalé montre aussi ce qu'il a tiré : sa valeur est la face décalée.
    return de(r, { titre: decale ? `d20 : ${coup.brut}` : "d20", valeur: face, detail: coup.zone ?? null, classe: "", etiquette: `Localisation : ${dite}`, aLancer: false });
  });
  if (d20Attendu) des.push(deALancer(r, "Localisation", geste.aLancer));
  const decalages = liste.map((coup, i) => (montre(r, coup.decaler) ? saisie(r, { cle: `decaler:${i}`, libelle: libelleDuDecalage(coup), donnee: coup.decaler, action: "Décaler" }) : null));
  return [el("div", { classe: "combat-chaine combat-localisation" }, des), decalages];
}

function detail(liste) {
  return el("ul", { classe: "combat-detail" }, liste.map((ligne) => el("li", {}, present(ligne.zone) ? `${ligne.zone} : ${ligne.texte}` : ligne.texte)));
}

/**
 * Les réglages à la main, avant le premier dé : repliés sous leur intitulé,
 * ils se déplient d'un clic. Leur état se garde le temps du geste
 * (r.memoire.reglagesOuverts) : un dé refait le corps sans les refermer.
 */
function reglages(r, vus) {
  const memoire = r.memoire ?? {};
  const details = el(
    "details",
    {
      classe: "combat-reglages",
      open: memoire.reglagesOuverts === true,
      ontoggle: () => {
        memoire.reglagesOuverts = details.hasAttribute("open");
      },
    },
    el("summary", {}, REGLAGES, " ", el("span", { classe: "combat-sous" }, REGLAGES_QUAND)),
    vus.modificateur ? saisie(r, { cle: "reglage:modificateur", libelle: "Modificateur de chaque dé", donnee: vus.modificateur, action: "Régler le modificateur", defaut: 0 }) : null,
    vus.avantages ? saisie(r, { cle: "reglage:avantages", libelle: `Avantages (+) ou désavantages (${SIGNE_MOINS})`, donnee: vus.avantages, action: "Régler les avantages", defaut: 0 }) : null,
  );
  return details;
}

function etapes(liste) {
  if (!liste?.length) return null;
  return el(
    "ol",
    { classe: "combat-etapes" },
    liste.map((etape) => el("li", { classe: CLASSE_ETAPE[etape.etat] ?? null, "aria-current": etape.etat === "en_cours" ? "step" : null }, etape.nom)),
  );
}

/**
 * Les morceaux d'un geste, chacun fabriqué à la demande : sur PC, tous sont
 * montrés ensemble ; au téléphone, chaque étape prend les siens.
 */
function morceaux(r, vue, geste, apercus) {
  const aLancer = geste.aLancer ?? null;
  const d20Attendu = Boolean(aLancer) && aLancer.motif === "localisation";
  const dansLaChaine = Boolean(aLancer) && !d20Attendu;
  const bilan = r.etroit === true && rempli(geste.bilanAuDoigt) ? geste.bilanAuDoigt : geste.bilan;
  // Un morceau se fabrique quand il se montre : un bouton fabriqué marque
  // le focus (marquer), même s'il ne paraissait pas.
  const choix = () => (geste.choix ?? []).map((c) => bouton(r, { cle: `choix:${c.cle}`, classe: "bouton", commande: c.commande, contenu: c.libelle }));
  return {
    avis: () => paragraphe(geste.avis, "combat-geste-avis"),
    aucuneIntervention: () => paragraphe(geste.aucuneIntervention, "combat-geste-avis"),
    defenseur: () => (rempli(vue.defenseur) ? el("p", { classe: "combat-defenseur" }, vue.defenseur) : null),
    jetPrete: () => (geste.jetPrete ? jetPrete(r, geste.jetPrete) : null),
    armes: () => (geste.armes?.length ? armes(r, geste.armes) : null),
    cibles: () => cibles(r, geste),
    progression: () => progression(geste.progression),
    jetsParCible: () => jetsParCible(r, geste.jetsParCible),
    cases: () => (geste.cases?.length ? cases(r, geste.cases) : null),
    caracteristiques: () => (geste.caracteristiques ? caracteristiques(r, geste.caracteristiques) : null),
    difficultes: () => (geste.difficultes?.length ? difficultes(r, geste.difficultes) : null),
    x: () => (geste.x ? saisie(r, { cle: "x", libelle: "X", donnee: geste.x, action: "Régler X", defaut: 0 }) : null),
    jauges: () => (geste.jauges?.length ? jauges(r, geste.jauges) : null),
    gardes: () => (geste.gardes?.length ? gardes(r, geste.gardes) : null),
    contexte: () => contexte(r, geste.contexte),
    reglages: () => (montre(r, geste.contexte?.reglages) ? reglages(r, geste.contexte.reglages) : null),
    chaine: () => chaine(r, geste, dansLaChaine),
    outils: () => outilsDuDe(r, geste),
    passifs: () => passifsDuJet(r, geste.passifs),
    bilan: () => (rempli(bilan) ? el("p", { classe: "combat-bilan" }, bilan) : null),
    lettres: () => (geste.lettres?.length ? lettres(geste.lettres, geste.critique?.rang ?? null) : null),
    critique: () => critique(geste.critique),
    choix: () => (geste.choix?.length ? el("div", { classe: "combat-choix" }, choix()) : null),
    degats: () => (geste.degats ? degats(r, geste.degats) : null),
    localisation: () => localisation(r, geste, d20Attendu),
    contre: () => contreAttaque(r, geste.contre, apercus),
    interventions: () => interventions(r, geste),
    detail: () => (geste.detail?.length ? detail(geste.detail) : null),
    blessure: () => (geste.blessure ? blessure(r, geste.blessure) : null),
    confirmer: () => (geste.confirmer ? bouton(r, { cle: "confirmer", classe: "bouton", actif: geste.confirmer.actif, raison: geste.confirmer.raison, commande: geste.confirmer.commande, contenu: geste.confirmer.libelle ?? "Confirmer" }) : null),
    revenir: (libelle) => (geste.revenir ? bouton(r, { cle: "revenir", classe: "bouton secondaire", commande: geste.revenir.commande, contenu: libelle }) : null),
    dernier: () => dernierBouton(r, geste),
    ouvertures: () => ouvertures(r, geste),
  };
}

/**
 * Le jet sur PC, dans l'ordre de la vue 2 bis : l'avis de la cible
 * précédente ; les étapes ; qui se défend ; les rangées du groupe 1 (les
 * cibles et ce qu'on en sait, leur avancement, la capacité gardée
 * d'attendre) ; puis, ensemble, le contexte, les dés (la chaîne, les outils
 * de la palette sous le dernier dé, les passifs, le bilan, les rangs, le
 * critique, les choix du moment, les dégâts, la face, la ligne qui dit
 * qu'aucune intervention n'est possible, la contre-attaque, les
 * interventions et l'esquive, le détail, la blessure, puis « Passer : … » ou
 * « Appliquer », « Confirmer », « Revenir »), « Appliquer l'effet de… », et
 * le pied : le texte de la capacité, toujours (mode assisté), et les
 * réglages à la main tant qu'ils existent, en Mode MJ.
 */
function composerLeJet(m) {
  const fins = [m.dernier(), m.confirmer(), m.revenir("Revenir")].filter(present);
  const jet = el(
    "div",
    { classe: "combat-jet" },
    ["chaine", "outils", "passifs", "bilan", "lettres", "critique", "choix", "degats", "localisation", "aucuneIntervention", "contre", "interventions", "detail", "blessure"].map((nom) => m[nom]()),
    fins.length ? el("div", { classe: "combat-choix" }, fins) : null,
  );
  const ouvertures = m.ouvertures();
  return [
    m.avis(),
    ...["defenseur", "jetPrete", "armes", "cibles", "progression", "jetsParCible", "cases", "caracteristiques", "difficultes", "x", "jauges", "gardes"].map((nom) => m[nom]()),
    el("div", { classe: "combat-des" }, m.contexte(), jet, ouvertures.length ? el("div", { classe: "combat-pied" }, ouvertures) : null, m.assiste(), m.reglages()),
  ];
}

/**
 * Le volet du téléphone (contrat de la vague 3, § 4.2) : au-dessus de tout,
 * l'avis de la cible précédente (et, à l'étape 3, la ligne qui dit
 * qu'aucune intervention n'est possible) ; le fil ; la consigne en tête de
 * l'étape 1 ; le contenu de l'étape montrée (r.etapeVue : celle de la vue,
 * ou les dés après « Un jet par cible ») ; puis le pied : « Appliquer
 * l'effet de… », « Palette » (Mode MJ), et le dernier bouton.
 *  - 1 : la cible et ce qu'on en sait, l'avancement, « Un jet par cible »,
 *    l'arrivée, les caractéristiques, la difficulté, la capacité gardée, X,
 *    la jauge, le jet prêté, l'arme, « Changer de capacité » (son chevron devant), « Confirmer » ;
 *  - 2 : qui se défend, le contexte (et les réglages, en Mode MJ), la
 *    chaîne et les outils sous le dernier dé, le bilan au doigt, les rangs,
 *    le critique, les choix du moment, les passifs, l'avancement ;
 *  - 3 : la face, les dégâts, la contre-attaque, les choix du moment, les
 *    interventions et l'esquive, le détail, la blessure.
 */
function composerLeVolet(r, vue, m) {
  const etape = r.etapeVue ?? vue.etape ?? 1;
  const parEtape = {
    1: ["cibles", "progression", "jetsParCible", "cases", "caracteristiques", "difficultes", "gardes", "x", "jauges", "jetPrete", "armes"],
    2: ["defenseur", "contexte", "reglages", "chaine", "outils", "bilan", "lettres", "critique", "choix", "passifs", "progression"],
    3: ["localisation", "degats", "contre", "choix", "interventions", "detail", "blessure"],
  };
  const contenu = (parEtape[etape] ?? []).map((nom) => m[nom]());
  if (etape === 1) contenu.push(m.revenir(CHANGER_DE_CAPACITE), m.confirmer());
  const pied = [...m.ouvertures(), m.dernier()].filter(present);
  return [
    m.avis(),
    etape === 3 ? m.aucuneIntervention() : null,
    fil(vue.fil),
    etape <= 1 ? paragraphe(vue.consigne, "combat-consigne") : null,
    contenu,
    pied.length ? el("div", { classe: "combat-pied" }, pied) : null,
  ];
}

/**
 * Le jet d'un geste (vuePanneau « action » avec geste), sans en-tête ni
 * conteneur : sur PC, le jet entier (composerLeJet) ; au téléphone
 * (r.etroit), le volet pas à pas (composerLeVolet). Rend des nœuds ; les
 * aperçus d'une contre-attaque se rouvrent comme ceux de la liste.
 */
export function composerGeste(r, vue) {
  const geste = vue.geste ?? null;
  if (geste === null) return [];
  const apercus = apercusDe(r);
  const m = morceaux(r, vue, geste, apercus);
  m.assiste = () => el("div", { classe: "combat-assiste" }, el("h3", {}, TITRE_DE_LA_DESCRIPTION), el("p", { classe: "combat-description" }, geste.description ?? ""));
  const noeuds = (r.etroit === true ? composerLeVolet(r, vue, m) : [etapes(vue.etapes), composerLeJet(m)]).flat(Infinity).filter(present);
  apercus.rouvrir();
  return noeuds;
}

// ——— La zone sous la carte ———

/**
 * Ce que montre la zone : « vide » (la préparation ; au téléphone, toujours :
 * le volet porte tout, contrat de la vague 3, § 4.2), « qui_joue »,
 * « termine », « phrase » (le jet se joue dans la bulle).
 */
function modeDe(vue, etroit) {
  if (etroit) return "vide";
  if (vue.genre === "qui_joue" || vue.genre === "termine") return vue.genre;
  return vue.genre === "action" ? "phrase" : "vide";
}

/** Le corps de la zone, et son titre (où va le focus quand aucune commande n'attend). */
function composerLaZone(r, vue, mode) {
  const titre = (texte) => el("h2", { classe: "combat-qui", tabindex: "-1" }, texte);
  if (mode === "qui_joue") {
    const tete = titre(QUI_JOUE);
    const candidats = (vue.candidats ?? []).map((candidat) => bouton(r, { cle: `candidat:${candidat.id}`, classe: "bouton secondaire", commande: candidat.commande, contenu: candidat.nom }));
    return { tete, noeuds: [tete, candidats.length ? el("div", { classe: "combat-choix" }, candidats) : null] };
  }
  if (mode === "termine") {
    const tete = titre(vue.vainqueur ?? COMBAT_TERMINE);
    return { tete, noeuds: [tete] };
  }
  if (mode === "phrase") return { tete: null, noeuds: [el("p", { classe: "combat-action-phrase" }, PHRASE_DE_LA_ZONE)] };
  return { tete: null, noeuds: [] };
}

/**
 * La zone sous la carte. `actions` : { executer(commande, origine),
 * lancerLeDe(), hachurer(noms | null) }. `lier` lie un déclencheur à son
 * infobulle ; `couche`, où vivent les infobulles de la zone, que l'écran
 * crée et que la zone porte dans sa section. Rend { noeud, rendre(vue,
 * ecran), listeDeCase, annonce, dire(texte), couche } ; `ecran` : { etroit }
 * (au téléphone, la zone reste vide). `rendre` dit vrai quand il a refait le
 * corps : l'écran ne repose le focus (sur [data-focus]) que dans ce cas.
 * `annonce` est la région polie, que l'écran pose dans la page ; `dire` y
 * écrit ce que l'écran a à dire lui-même (« Journal copié. »), et l'annonce
 * suivante du combat le remplace.
 *
 * Avant de refaire son corps, la zone vide elle-même sa couche (les
 * infobulles du corps d'avant) : les liens du corps neuf se posent ensuite,
 * pendant le rendu. L'écran ne vide donc pas cette couche après un rendu.
 */
export function creer(actions, { lier: lierDeLaZone = null, couche = null } = {}) {
  const corps = el("div", { classe: "combat-action-corps" });
  const listeDeCase = el("div", { classe: "combat-case-liste" });
  const annonce = el("p", { classe: "combat-annonce", "aria-live": "polite" });
  const noeud = el("section", { classe: "combat-action", "aria-label": "Action en cours" }, corps, listeDeCase, couche);
  let rendue = null;
  let pasAnnonce = null;

  // Un lecteur d'écran redit ce qui change dans la région : elle ne change
  // donc que lorsque le pas de l'annonce change, jamais à chaque rendu.
  function annoncer(dite) {
    if (!dite) {
      if (pasAnnonce !== null) annonce.replaceChildren();
      pasAnnonce = null;
      return;
    }
    if (dite.pas === pasAnnonce) return;
    pasAnnonce = dite.pas;
    annonce.replaceChildren(sansSensForce(dite.texte ?? ""));
  }

  function rendre(vue, ecran = {}) {
    annoncer(vue.annonce ?? null);
    // La signature de ce que montre le corps : la phrase de la bulle ne se
    // refait pas à chaque dé.
    const mode = modeDe(vue, ecran?.etroit === true);
    const signature = JSON.stringify([mode, mode === "vide" || mode === "phrase" ? null : { ...vue, annonce: undefined }]);
    if (signature === rendue) return false;
    rendue = signature;
    // Les infobulles du corps d'avant partent avec lui.
    couche?.replaceChildren();

    const r = { actions, origine: ORIGINE_DE_LA_ZONE, focus: vue.focus ?? null, pose: false, compteur: 0, lier: lierDeLaZone, memoire: {}, cles: new Map() };
    const { tete, noeuds } = composerLaZone(r, vue, mode);
    // Aucune commande n'attend : le focus va au titre.
    if (!r.pose && tete) tete.setAttribute("data-focus", "titre");
    corps.replaceChildren(...[noeuds].flat(Infinity).filter(present));
    return true;
  }

  function dire(texte) {
    annonce.replaceChildren(sansSensForce(texte ?? ""));
  }

  return { noeud, rendre, listeDeCase, annonce, dire, couche };
}
