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
// téléphone, le jet lui-même, sous la carte, sans bouton pour fermer.
// Chaque bouton émet la commande que la vue lui donne, avec son origine
// ("bulle" ou "panneau"), chaque saisie complète le gabarit que la vue lui
// donne.
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
// bulle) ne doit ni effacer une saisie en cours, ni déplacer le focus. Tout
// focus posé ici l'est sans faire défiler la page.

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
function emettre(r, commande) {
  if (commande) r.actions.executer(commande, origineDe(r));
}

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
 * Un bouton qui émet sa commande. Inactif, il garde le focus (aria-disabled,
 * jamais disabled), ne fait rien, et sa raison, écrite juste après lui, lui
 * est liée. Rend le bouton, puis sa raison s'il en a une.
 */
function bouton(r, { cle = null, classe, contenu, commande = null, actif = true, raison = null, presse, etiquette = null, garde = false }) {
  const inactif = actif === false;
  const idRaison = inactif && rempli(raison) ? identifiant(r, "raison") : null;
  const noeud = el(
    "button",
    {
      type: "button",
      classe,
      "aria-pressed": presse === undefined ? null : String(Boolean(presse)),
      "aria-disabled": inactif ? "true" : null,
      "aria-describedby": idRaison,
      "aria-label": nomAccessible(etiquette),
      onclick: () => {
        if (inactif || !commande) return;
        if (garde && present(cle)) surPlace(r, cle, () => emettre(r, commande));
        else emettre(r, commande);
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
  const veutUneRaison = Object.hasOwn(donnee, "raisonParDefaut") || Object.hasOwn(donnee, "raison");
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
 * La liste des capacités d'un protagoniste (vuePanneau « action » sans
 * geste), sans en-tête ni conteneur : par groupe, son intitulé puis une
 * ligne par capacité et par puissance ; « Passer son tour » ferme le dernier
 * groupe ; les passifs en pied. Rend des nœuds.
 *
 * Un seul aperçu à la fois ; sa clé (r.memoire.apercu) survit à un corps
 * refait : il se rouvre, avec ses hachures, tant que sa ligne est là. Ouvert
 * sous une ligne, il a un identifiant, et la ligne le dit (aria-expanded,
 * aria-controls) jusqu'à ce qu'il se ferme : un lecteur d'écran sait que
 * l'appui a ouvert quelque chose (WCAG 4.1.2) ; un passif ne porte rien.
 * Ouvert, il se montre dans la partie vue de la bulle (r.actions.montrer,
 * que la zone n'a pas).
 */
export function composerListe(r, vue) {
  const memoire = r.memoire ?? {};
  const apercus = {
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
  };

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

  if (present(memoire.apercu)) {
    if (apercus.places.has(memoire.apercu)) apercus.ouvrir(memoire.apercu);
    else memoire.apercu = null;
  }
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

function cibles(r, geste) {
  const liste = geste.cibles ?? [];
  if (liste.length === 0 && !geste.sansCible) return null;
  const origine = TEXTE_ORIGINE[r.origineDeLaCible] ?? null;
  return rangee(
    r,
    "combat-cibles",
    "Cible :",
    liste.map((cible) => [
      bouton(r, { cle: `cible:${cible.id}`, classe: null, presse: Boolean(cible.choisie), actif: cible.actif, raison: cible.raison, commande: cible.commande, contenu: cible.libelle }),
      cible.choisie && origine ? el("span", { classe: "combat-origine" }, origine) : null,
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

/** Le dé qu'attend le moteur, quand aucune entrée de la chaîne ne le montre. */
function deALancer(r, titre, aLancer) {
  return de(r, { titre, valeur: aLancer.libelle, detail: "cliquez", classe: ETATS_DE.a_lancer.classe, etiquette: `${titre} : lancer le ${aLancer.libelle}`, aLancer: true });
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
    else if (agit) detail = "cliquez";
    const dit = [lance ? `${entree.valeur}${present(entree.detail) ? ` (${entree.detail})` : ""}` : entree.de, etat.dit].filter(rempli).join(", ");
    return de(r, { titre: entree.titre, valeur: lance ? entree.valeur : entree.de, detail, classe: etat.classe, etiquette: `${entree.titre} : ${dit}`, aLancer: agit });
  });
  if (dansLaChaine && attendue === -1) des.push(deALancer(r, "Dé", geste.aLancer));
  return el("div", { classe: "combat-chaine" }, des);
}

function lettres(liste) {
  return el("ul", { classe: "combat-lettres" }, liste.map((lettre) => el("li", { classe: lettre.atteinte ? "atteinte" : null }, lettre.texte)));
}

function degats(r, d) {
  const noeuds = [];
  if (d.bases?.length) noeuds.push(rangee(r, "combat-ligne combat-degats-bases", "Dégâts :", d.bases.map((base, i) => bouton(r, { cle: `degats:base:${i}`, classe: "combat-capacite", presse: Boolean(base.choisie), commande: base.commande, contenu: base.libelle }))));
  if (d.natures?.length) noeuds.push(rangee(r, "combat-ligne combat-degats-natures", "Nature :", d.natures.map((nature, i) => bouton(r, { cle: `degats:nature:${i}`, classe: "combat-capacite", presse: Boolean(nature.choisie), commande: nature.commande, contenu: nature.libelle }))));
  if (d.saisie) noeuds.push(saisie(r, { cle: "degats:saisie", libelle: "Dégâts à la main", donnee: d.saisie, action: "Fixer les dégâts" }));
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
  const decalages = liste.map((coup, i) => (coup.decaler ? saisie(r, { cle: `decaler:${i}`, libelle: libelleDuDecalage(coup), donnee: coup.decaler, action: "Décaler" }) : null));
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
 * Le jet d'un geste (vuePanneau « action » avec geste), sans en-tête ni
 * conteneur, dans l'ordre de la vue 2 bis, qui est aussi celui du
 * téléphone : les étapes ; qui se défend ; les rangées du groupe 1 ; puis,
 * ensemble, le contexte, les dés (la chaîne, le bilan, les rangs, les choix
 * du moment, les dégâts, la face, l'esquive, le détail, « Appliquer »,
 * « Confirmer », « Revenir ») et le pied : le texte de la capacité, toujours
 * (mode assisté : c'est au joueur d'en appliquer l'effet), et les réglages à
 * la main tant qu'ils existent. Rend des nœuds.
 */
export function composerGeste(r, vue) {
  const geste = vue.geste ?? null;
  if (geste === null) return [];
  const aLancer = geste.aLancer ?? null;
  const d20Attendu = Boolean(aLancer) && aLancer.motif === "localisation";
  const dansLaChaine = Boolean(aLancer) && !d20Attendu;

  const choix = (geste.choix ?? []).map((c) => bouton(r, { cle: `choix:${c.cle}`, classe: "bouton", commande: c.commande, contenu: c.libelle }));
  const fins = [
    geste.appliquer ? bouton(r, { cle: "appliquer", classe: "bouton", commande: geste.appliquer.commande, contenu: geste.appliquer.libelle ?? "Appliquer" }) : null,
    geste.confirmer ? bouton(r, { cle: "confirmer", classe: "bouton", actif: geste.confirmer.actif, raison: geste.confirmer.raison, commande: geste.confirmer.commande, contenu: geste.confirmer.libelle ?? "Confirmer" }) : null,
    geste.revenir ? bouton(r, { cle: "revenir", classe: "bouton secondaire", commande: geste.revenir.commande, contenu: "Revenir" }) : null,
  ].filter(present);

  const jet = el(
    "div",
    { classe: "combat-jet" },
    chaine(r, geste, dansLaChaine),
    rempli(geste.bilan) ? el("p", { classe: "combat-bilan" }, geste.bilan) : null,
    geste.lettres?.length ? lettres(geste.lettres) : null,
    choix.length ? el("div", { classe: "combat-choix" }, choix) : null,
    geste.degats ? degats(r, geste.degats) : null,
    localisation(r, geste, d20Attendu),
    geste.esquive ? saisie(r, { cle: "esquive", libelle: `${geste.esquive.libelle}, X`, donnee: geste.esquive, action: geste.esquive.libelle, defaut: geste.esquive.min ?? "" }) : null,
    geste.detail?.length ? detail(geste.detail) : null,
    fins.length ? el("div", { classe: "combat-choix" }, fins) : null,
  );
  const assiste = el("div", { classe: "combat-assiste" }, el("h3", {}, TITRE_DE_LA_DESCRIPTION), el("p", { classe: "combat-description" }, geste.description ?? ""));

  return [
    etapes(vue.etapes),
    rempli(vue.defenseur) ? el("p", { classe: "combat-defenseur" }, vue.defenseur) : null,
    geste.jetPrete ? jetPrete(r, geste.jetPrete) : null,
    geste.armes?.length ? armes(r, geste.armes) : null,
    cibles(r, geste),
    geste.cases?.length ? cases(r, geste.cases) : null,
    geste.caracteristiques ? caracteristiques(r, geste.caracteristiques) : null,
    geste.difficultes?.length ? difficultes(r, geste.difficultes) : null,
    geste.x ? saisie(r, { cle: "x", libelle: "X", donnee: geste.x, action: "Régler X", defaut: 0 }) : null,
    geste.jauges?.length ? jauges(r, geste.jauges) : null,
    el("div", { classe: "combat-des" }, contexte(r, geste.contexte), jet, assiste, geste.contexte?.reglages ? reglages(r, geste.contexte.reglages) : null),
  ]
    .flat(Infinity)
    .filter(present);
}

// ——— La zone sous la carte ———

/**
 * Ce que montre la zone : « vide » (la préparation, ou le volet ouvert sur
 * un téléphone), « qui_joue », « termine », « phrase » (le jet se joue dans
 * la bulle), « geste » (le jet, sous la carte, sur un téléphone).
 */
function modeDe(vue, etroit) {
  if (vue.genre === "qui_joue" || vue.genre === "termine") return vue.genre;
  if (vue.genre !== "action") return "vide";
  if (!etroit) return "phrase";
  return vue.geste ? "geste" : "vide";
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
  if (mode === "geste") {
    // Le jet sous la carte, avec l'en-tête de la bulle, mais sans ce qui la
    // ferme ou la réduit : il n'y a rien à fermer.
    const tete = titre(vue.entete?.titre ?? "");
    return { tete, noeuds: [tete, rempli(vue.entete?.sous) ? el("p", { classe: "combat-sous" }, vue.entete.sous) : null, composerGeste(r, vue)] };
  }
  return { tete: null, noeuds: [] };
}

/**
 * La zone sous la carte. `actions` : { executer(commande, origine),
 * lancerLeDe(), hachurer(noms | null) }. `lier` lie un déclencheur à son
 * infobulle ; `couche`, où vivent les infobulles de la zone, que l'écran
 * crée et que la zone porte dans sa section. Rend { noeud, rendre(vue,
 * ecran), listeDeCase, annonce, dire(texte), couche } ; `ecran` : { etroit,
 * origineDeLaCible } (origineDeLaCible : "plateau", "panneau", "bulle" ou
 * rien). `rendre` dit vrai quand il a refait le corps : l'écran ne repose le
 * focus (sur [data-focus]) que dans ce cas. `annonce` est la région polie,
 * que l'écran pose dans la page ; `dire` y écrit ce que l'écran a à dire
 * lui-même (« Journal copié. »), et l'annonce suivante du combat le remplace.
 *
 * La mémoire de la zone (les réglages dépliés, l'explication des causes
 * montrée) est remise à zéro quand le geste change : un autre protagoniste,
 * ou un geste qui finit.
 *
 * Avant de refaire son corps, la zone vide elle-même sa couche (les
 * infobulles du corps d'avant) et, si elle montrait un jet, efface les
 * hachures : les liens du corps neuf se posent ensuite, pendant le rendu.
 * L'écran ne vide donc pas cette couche après un rendu.
 */
export function creer(actions, { lier: lierDeLaZone = null, couche = null } = {}) {
  const corps = el("div", { classe: "combat-action-corps" });
  const listeDeCase = el("div", { classe: "combat-case-liste" });
  const annonce = el("p", { classe: "combat-annonce", "aria-live": "polite" });
  const noeud = el("section", { classe: "combat-action", "aria-label": "Action en cours" }, corps, listeDeCase, couche);
  const memoire = { reglagesOuverts: false, apercu: null, causesOuvertes: false };
  let rendue = null;
  let montre = null;
  let gesteMontre = null;
  let pasAnnonce = null;
  // La clé du réglage qui garde le focus, le temps que l'écran redessine.
  let gardee = null;
  const garder = (cle) => {
    gardee = cle;
  };

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
    const etroit = ecran?.etroit === true;
    const origine = ecran?.origineDeLaCible ?? null;
    const cleDuGeste = vue.genre === "action" && vue.geste ? (vue.nom ?? "") : null;
    if (cleDuGeste !== gesteMontre) {
      gesteMontre = cleDuGeste;
      Object.assign(memoire, { reglagesOuverts: false, apercu: null, causesOuvertes: false });
    }
    // La signature de ce que montre le corps : la phrase de la bulle ne se
    // refait pas à chaque dé.
    const mode = modeDe(vue, etroit);
    const signature = JSON.stringify([mode, mode === "vide" || mode === "phrase" ? null : { ...vue, annonce: undefined }, mode === "geste" ? origine : null]);
    if (signature === rendue) return false;
    rendue = signature;
    // Les infobulles et les hachures du corps d'avant partent avec lui.
    couche?.replaceChildren();
    if (montre === "geste") actions.hachurer?.(null);
    montre = mode;

    const r = { actions, origine: ORIGINE_DE_LA_ZONE, origineDeLaCible: origine, focus: gardee ?? vue.focus ?? null, garder, pose: false, compteur: 0, lier: lierDeLaZone, memoire, cles: new Map() };
    const { tete, noeuds } = composerLaZone(r, vue, mode);
    // Le réglage gardé n'est plus dans le corps refait : le focus va, comme
    // toujours, à la commande qui attend ; à défaut, au titre.
    if (!r.pose && gardee !== null && r.cles.has(vue.focus ?? null)) {
      r.cles.get(vue.focus).setAttribute("data-focus", vue.focus);
      r.pose = true;
    }
    if (!r.pose && tete) tete.setAttribute("data-focus", "titre");
    corps.replaceChildren(...[noeuds].flat(Infinity).filter(present));
    return true;
  }

  function dire(texte) {
    annonce.replaceChildren(sansSensForce(texte ?? ""));
  }

  return { noeud, rendre, listeDeCase, annonce, dire, couche };
}
