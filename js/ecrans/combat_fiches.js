// Les fiches vivantes du combat (SPECIFICATION.md, § 17, « Le simulateur de
// combat (lot 4) » ; mission du lot 4, § 5 et § 10.5).
//
// Une fiche par protagoniste, dans la liste de son camp : un volet que son
// nom déplie, avec ce qui change pendant le combat (actions, souffle, corps,
// armure et endurance de chaque zone, lien, passifs câblés) et les boutons
// « Jouer » et « Fiche complète ». Avant le lancement, le champ « Case » et
// « Retirer » suivent le volet, hors de lui : ils s'atteignent sans le
// déplier, à toute largeur. C'est l'une des quatre parties de l'écran
// du combat. Elle ne sait rien du jeu : elle montre les vues qu'on lui donne
// (vueFiche, js/combat/lecture.js), où chaque texte arrive écrit et chaque
// bouton avec sa commande, et elle rend la main à l'écran par « actions ».
//
// Ce qu'elle garde pour elle : le texte de chaque vue déjà montrée, pour ne
// refaire que les fiches qui ont changé, et ce que la personne a fait de
// chaque volet (ouvert ou replié), que la mort du protagoniste fait oublier.
//
// Au groupe 2 (contrat du groupe 2, § 8.5, § 9.9 et § 9.11) : l'en-tête
// écrit les actions restantes telles que la vue les dit (« actions
// restantes : 1 sur 2 »), et le focus rendu ne fait jamais défiler la page.
//
// Au lot 4.3, vague 3 (contrat de la vague, § 3.3, § 4.2 et § 5.2) : la fiche
// du camp qui joue prend la couleur de ce qu'il peut encore faire (« a-jouer »,
// « epuise ») ; chaque effet durable porté est une étiquette (son nom, sa
// source, sa durée, sa couleur), qui se déplie sur son texte et « Appliquer
// l'effet de… » (la palette, dans les deux modes) ; en Mode MJ seulement, ✕
// retire un état, et « Modifier… » ouvre le menu du MJ. Un bouton inactif le
// dit (aria-disabled) et dit sa raison ; il n'est jamais éteint.

import { abregerZone } from "../adversaire/carte.js";
import { lireCase } from "../combat/plateau.js";
import { el, sansSensForce } from "./dom.js";

const PREFIXE = "combat-fiche";
const CAMPS = [
  { camp: "pj", titre: "Personnages", vide: "Aucun personnage dans le combat." },
  { camp: "adv", titre: "Adversaires", vide: "Aucun adversaire dans le combat." },
];
// Les seules marques qui deviennent des classes : une marque inconnue de la
// feuille ne s'écrit pas.
const MARQUES = ["joue", "ciblee", "morte"];
const MARQUES_D_ARMURE = ["abimee", "detruite"];
// La classe d'état que prend la fiche du camp qui joue (contrat de la vague
// 3, § 5.2), d'après vueFiche.jeu ; et celles d'une étiquette, d'après sa
// couleur. Une valeur inconnue ne s'écrit pas.
const JEUX = { peut_agir: "a-jouer", epuise: "epuise" };
const COULEURS = ["blessure", "favorable", "alerte"];
const RETIRER = String.fromCodePoint(0x2715);
// Au-delà, une jauge s'écrit en nombres seulement (mission, § 10.5).
const CASES_MAX = 30;
const SOUFFLE_ABSENT = "—";
const CASE_REFUSEE = "Une case s'écrit de A1 à J10.";

/** Vrai quand « noeud » est « ancetre », ou l'un de ses descendants. */
function estDans(noeud, ancetre) {
  for (let courant = noeud; courant; courant = courant.parentNode) {
    if (courant === ancetre) return true;
  }
  return false;
}

/** Les cases d'une jauge : les pleines, puis les vides. */
function cases(valeur, max) {
  return Array.from({ length: max }, (_, i) => el("span", { classe: i < valeur ? "combat-point" : "combat-point vide" }));
}

/**
 * Une jauge : son nom, ses cases, et toujours son nombre, pour qui ne voit
 * pas les cases. Les espaces séparent les mots pour un lecteur d'écran ; la
 * mise en page les ignore.
 */
function jauge(genre, nom, valeur, max, ecrit = `${valeur}/${max}`) {
  return el("div", { classe: `combat-jauge combat-jauge-${genre}` }, el("span", {}, nom), " ", max <= CASES_MAX ? cases(valeur, max) : null, " ", el("span", {}, ecrit));
}

/** L'armure d'une zone : son maximum tant qu'elle est intacte, puis « 15/20 ». */
function ecrireArmure({ valeur, max, etat }) {
  return etat === null && valeur === max ? String(max) : `${valeur}/${max}`;
}

/** Le nom d'une zone, abrégé comme sur la fiche imprimée d'un adversaire ; son nom entier reste lisible. */
function nomDeZone(zone) {
  const entier = sansSensForce(zone.nom);
  const abrege = abregerZone(entier, zone.nombreDeFaces);
  return abrege === entier ? entier : el("abbr", { title: entier }, abrege);
}

function ligneDeZone(zone) {
  const { resistance } = zone;
  const etat = MARQUES_D_ARMURE.includes(zone.armure.etat) ? zone.armure.etat : null;
  return el(
    "tr",
    {},
    el("td", {}, zone.faces),
    // Le nom de la zone est l'en-tête de sa ligne : un lecteur d'écran le dit
    // avec l'armure et l'endurance.
    el("th", { scope: "row" }, nomDeZone(zone)),
    el("td", { classe: etat }, ecrireArmure(zone.armure)),
    el(
      "td",
      {},
      resistance.max <= CASES_MAX
        ? el("span", { role: "img", "aria-label": `${resistance.valeur} sur ${resistance.max}` }, cases(resistance.valeur, resistance.max))
        : `${resistance.valeur}/${resistance.max}`,
    ),
  );
}

/** La table des zones d'un protagoniste, qu'elle nomme : plusieurs fiches sont ouvertes à la fois. */
function tableDesZones(zones, nom) {
  return el(
    "table",
    { classe: "combat-zones", "aria-label": `Zones : ${sansSensForce(nom)}` },
    el("thead", {}, el("tr", {}, ["d20", "Zone", "Armure", "Endurance"].map((titre) => el("th", { scope: "col" }, titre)))),
    el("tbody", {}, zones.map(ligneDeZone)),
  );
}

/**
 * Un passif câblé. Inactif, il le dit en toutes lettres, avec sa raison : la
 * couleur seule ne dit jamais rien.
 */
function ligneDePassif(passif) {
  if (passif.actif !== false) return el("li", {}, passif.texte);
  return el("li", { classe: "eteint" }, passif.texte, passif.raison ? ` (inactif : ${passif.raison})` : " (inactif)");
}

/**
 * Les actions restantes, en pastilles ; un lecteur d'écran en entend le
 * texte de la vue (« actions restantes : 1 sur 2 »), le même qu'en tête de
 * la bulle. Au-delà de trente, ce texte seul.
 */
function actionsRestantes({ reste, max, texte }) {
  const dit = typeof texte === "string" ? sansSensForce(texte) : "";
  if (max > CASES_MAX) return el("span", { classe: "combat-actions" }, dit);
  return el(
    "span",
    { classe: "combat-actions", role: "img", "aria-label": dit },
    Array.from({ length: max }, (_, i) => el("span", { classe: i < reste ? "combat-pion" : "combat-pion vide" })),
  );
}

/**
 * La partie « fiches » de l'écran du combat : { noeud, rendre(vue, ecran) }.
 *
 * « vue » est { pj: [vueFiche…], adv: [vueFiche…] }, dans l'ordre du combat ;
 * « ecran.etroit » dit qu'on est sur un téléphone, « ecran.modeMj » que le
 * Mode MJ est allumé. « actions » vient de l'écran : executer(commande,
 * origine), ouvrirFiche(id), et, à la vague 3, ouvrirPalette(source, ancre)
 * et ouvrirMenuMj(id, ancre).
 */
export function creer(actions) {
  // Les identifiants de la page ne se font jamais d'un identifiant de
  // protagoniste, qui est une donnée.
  let numero = 0;
  /** id → { numero, noeud, resume, corps, avant, texte, ecrit, choix, morte, joue } */
  const fiches = new Map();

  const camps = CAMPS.map(({ camp, titre, vide }) => {
    const nombre = el("span", { classe: "combat-compte" });
    // Le titre reçoit le focus quand la fiche qui le portait est retirée.
    const tete = el("h2", { tabindex: "-1" }, titre, " ", nombre);
    return {
      camp,
      tete,
      nombre,
      vide: el("p", { classe: "secondaire-texte petit" }, vide),
      ordre: null,
      noeud: el("section", { classe: `combat-camp combat-camp-${camp}`, "aria-label": titre }, tete),
    };
  });
  const noeud = el("div", { classe: "combat-camps" }, camps.map((camp) => camp.noeud));

  const estOuverte = (fiche) => fiche.noeud.hasAttribute("open");

  /**
   * Le geste de la personne se reconnaît à ceci : le volet n'est pas dans
   * l'état que la partie lui a écrit en dernier. Un navigateur n'annonce un
   * volet déplié qu'un instant après le clic : un rendu peut passer avant
   * l'annonce, et c'est pourquoi le rendu relève le geste lui aussi.
   */
  function releverLeGeste(fiche) {
    const trouve = estOuverte(fiche);
    if (trouve === fiche.ecrit) return;
    fiche.choix = trouve;
    fiche.ecrit = trouve;
  }

  function creerFiche(id) {
    numero += 1;
    const fiche = { numero, noeud: null, resume: el("summary"), corps: el("div", { classe: `${PREFIXE}-corps` }), avant: null, texte: null, ecrit: false, choix: null, morte: false, joue: false };
    fiche.noeud = el("details", { classe: PREFIXE, "data-id": id, ontoggle: () => releverLeGeste(fiche) }, fiche.resume, fiche.corps);
    // Ce qui suit le volet avant le lancement : un groupe au nom du
    // protagoniste, toujours visible, que le volet soit ouvert ou replié.
    fiche.avant = el("div", { classe: `${PREFIXE}-avant`, role: "group", "data-fiche": id });
    return fiche;
  }

  /**
   * L'en-tête : rien qui s'actionne n'y loge, puisque tout l'en-tête déplie
   * le volet. Un lecteur d'écran le lit d'un trait : les espaces y séparent
   * les mots, et la mise en page les ignore.
   */
  function faireResume(vue) {
    // Sous le nom, une seule ligne : l'espèce et l'archétype (ou les types),
    // puis l'état, qui s'y enchaîne comme sur la maquette. Sans l'un ni
    // l'autre, la ligne ne s'écrit pas.
    const sousLeNom = [
      vue.sousTitre ? el("span", { classe: "combat-sous" }, vue.sousTitre) : null,
      vue.statut ? el("span", { classe: "combat-statut" }, vue.statut) : null,
    ].filter(Boolean);
    return [
      el("span", { classe: "combat-pastille", "aria-hidden": "true" }, vue.initiales),
      el("span", { classe: "combat-nom" }, vue.nom),
      sousLeNom.length ? el("span", { classe: "combat-sous-ligne" }, sousLeNom.flatMap((partie, rang) => (rang === 0 ? [partie] : [" ", partie]))) : null,
      actionsRestantes(vue.actions),
    ]
      .filter(Boolean)
      .flatMap((partie) => [partie, " "]);
  }

  /**
   * Avant le lancement : la case du protagoniste, et de quoi le retirer, sur
   * une rangée. Sur un téléphone, où les fiches sont repliées tant que
   * personne ne joue, le champ est le double de 44 px du plateau : il ne
   * demande pas de déplier la fiche.
   */
  function faireAvant(fiche, vue) {
    const { avant } = vue;
    const id = `${PREFIXE}-${fiche.numero}-case`;
    const refus = el("p", { id: `${id}-refus`, classe: "combat-refus", hidden: true }, CASE_REFUSEE);
    const champ = el("input", {
      type: "text",
      id,
      classe: "champ",
      "data-repere": "case",
      "aria-describedby": `${id}-refus`,
      autocomplete: "off",
      autocapitalize: "characters",
      spellcheck: "false",
      maxlength: "8",
      size: "4",
      onchange: () => {
        const lue = lireCase(champ.value);
        refus.hidden = lue !== null;
        if (lue === null) {
          champ.setAttribute("aria-invalid", "true");
          return;
        }
        champ.removeAttribute("aria-invalid");
        champ.value = lue;
        if (lue !== avant.case) actions.executer({ preparer: { ...avant.poser.gabarit.preparer, case: lue } }, "panneau");
      },
    });
    // La valeur d'un champ ne se pose qu'une fois le champ créé.
    champ.value = avant.case ?? "";
    return [
      el(
        "div",
        { classe: "combat-ligne" },
        el("label", { for: id }, "Case"),
        champ,
        el(
          "button",
          { type: "button", classe: "bouton secondaire", "data-repere": "retirer", "aria-label": `Retirer : ${sansSensForce(vue.nom)}`, onclick: () => actions.executer(avant.retirer.commande, "panneau") },
          "Retirer",
        ),
      ),
      refus,
    ];
  }

  /**
   * Un bouton qui peut être inactif (contrat de la vague 3, § 3) : il le dit
   * par aria-disabled, et sa raison le suit, liée par aria-describedby ; il
   * n'est jamais éteint, et un appui sur lui ne fait rien. Son identifiant de
   * page se fait du numéro de la fiche, jamais d'un identifiant de
   * protagoniste.
   */
  function boutonAvecRaison(fiche, repere, { classe, contenu, etiquette = null, actif, raison, faire }) {
    const inactif = actif === false;
    const idRaison = inactif && raison ? `${PREFIXE}-${fiche.numero}-${repere}-raison` : null;
    const noeud = el(
      "button",
      {
        type: "button",
        classe,
        "data-repere": repere,
        "aria-disabled": inactif ? "true" : null,
        "aria-describedby": idRaison,
        "aria-label": etiquette === null ? null : sansSensForce(etiquette),
        onclick: () => {
          if (!inactif) faire(noeud);
        },
      },
      contenu,
    );
    return [noeud, idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, raison) : null];
  }

  /**
   * Une étiquette (mission du lot 4.3, § 4.7 ; contrat de la vague 3, § 3.3) :
   * son nom, sa source et sa durée, dans la couleur de la vue. Elle se déplie
   * sur son texte et « Appliquer l'effet de… », qui ouvre la palette à son nom
   * (dans les deux modes) ; ✕ la retire, en Mode MJ seulement. Rien de ce qui
   * s'actionne n'est dans la ligne qui la déplie.
   */
  function faireEtiquette(fiche, effet, rang, modeMj) {
    const couleur = COULEURS.includes(effet.couleur) ? effet.couleur : null;
    const tete = [effet.nom, effet.source, effet.duree].filter(Boolean).join(" · ");
    const appliquer = effet.appliquer ?? null;
    let boutonAppliquer = null;
    if (appliquer) {
      boutonAppliquer = el(
        "button",
        { type: "button", classe: "bouton secondaire petit", "data-repere": `appliquer-${rang}`, onclick: () => actions.ouvrirPalette(appliquer.source, boutonAppliquer) },
        appliquer.libelle,
      );
    }
    const deplie = effet.texte || appliquer ? el("details", {}, el("summary", {}, tete), effet.texte ? el("p", {}, effet.texte) : null, boutonAppliquer) : el("span", {}, tete);
    const retirer = effet.retirer && (effet.retirer.mj !== true || modeMj) ? effet.retirer : null;
    return el(
      "li",
      { classe: ["combat-etiquette", couleur].filter(Boolean).join(" ") },
      deplie,
      retirer
        ? boutonAvecRaison(fiche, `retirer-etat-${rang}`, {
            classe: "bouton secondaire petit",
            contenu: RETIRER,
            etiquette: retirer.libelle,
            actif: retirer.actif,
            raison: retirer.raison,
            faire: () => actions.executer(retirer.commande, "panneau"),
          })
        : null,
    );
  }

  function faireCorps(fiche, vue, modeMj) {
    const etiquettes = Array.isArray(vue.effets) ? vue.effets : [];
    return [
      vue.souffle.absent ? jauge("souffle", "Souffle", 0, 0, SOUFFLE_ABSENT) : jauge("souffle", "Souffle", vue.souffle.valeur, vue.souffle.max),
      jauge("corps", "Corps", vue.corps.valeur, vue.corps.max),
      tableDesZones(vue.zones, vue.nom),
      el("p", { classe: "combat-contre" }, vue.contre),
      [vue.attaque, vue.defense, vue.bouclier].filter(Boolean).map((texte) => el("p", { classe: "combat-valeurs" }, texte)),
      vue.liens.map((lien) => jauge("lien", `Lien · ${sansSensForce(lien.nom)}`, lien.valeur, lien.max)),
      etiquettes.length ? el("ul", { classe: "combat-etiquettes", "aria-label": `Effets en cours : ${sansSensForce(vue.nom)}` }, etiquettes.map((effet, rang) => faireEtiquette(fiche, effet, rang, modeMj))) : null,
      vue.passifs.length ? el("ul", { classe: "combat-effets" }, vue.passifs.map(ligneDePassif)) : null,
      faireLesBoutons(fiche, vue, modeMj),
    ].flat().filter(Boolean);
  }

  /** « Jouer », quand la fiche peut être choisie : toujours dans le corps, jamais dans l'en-tête. */
  function boutonJouer(vue) {
    if (!vue.jouer) return null;
    return el("button", { type: "button", classe: "bouton", "data-repere": "jouer", "aria-label": `Jouer : ${sansSensForce(vue.nom)}`, onclick: () => actions.executer(vue.jouer.commande, "panneau") }, "Jouer");
  }

  /**
   * « Modifier… », le menu du MJ de ce protagoniste : en Mode MJ seulement,
   * pour le clavier comme pour la souris (mission du lot 4.3, § 4.8).
   */
  function boutonModifier(fiche, vue, modeMj) {
    const menu = vue.menuMj ?? null;
    if (menu === null || (menu.mj === true && !modeMj)) return null;
    return boutonAvecRaison(fiche, "modifier", {
      classe: "bouton secondaire combat-modifier",
      contenu: menu.libelle,
      etiquette: `${menu.libelle} : ${vue.nom}`,
      actif: menu.actif,
      raison: menu.raison,
      faire: (bouton) => actions.ouvrirMenuMj(vue.id, bouton),
    });
  }

  /**
   * La rangée des boutons : « Jouer », « Fiche complète », puis « Modifier… »
   * en Mode MJ. La fiche en garde les nœuds : « Jouer » paraît et disparaît à
   * chaque geste sur toutes les fiches du camp qui joue, sans que rien
   * d'autre n'y change.
   */
  function faireLesBoutons(fiche, vue, modeMj) {
    fiche.complete = el(
      "button",
      { type: "button", classe: "bouton secondaire", "data-repere": "fiche-complete", "aria-label": `Fiche complète : ${sansSensForce(vue.nom)}`, onclick: () => actions.ouvrirFiche(vue.id) },
      "Fiche complète",
    );
    fiche.modifier = boutonModifier(fiche, vue, modeMj);
    fiche.boutons = el("div", { classe: "combat-ligne" }, boutonJouer(vue), fiche.complete, fiche.modifier);
    return fiche.boutons;
  }

  /**
   * Refait d'une fiche ce dont la vue a changé, et cela seul : son en-tête
   * (l'état, les actions), son corps (les jauges, les zones, les valeurs), ou
   * le seul bouton « Jouer ». Sans ce partage, la fin d'un geste refaisait en
   * entier la fiche de chaque protagoniste du camp, pour un bouton (mesuré :
   * douze à quatorze fiches sur quinze, plus de cent millisecondes au clic).
   */
  function refaire(fiche, vue, modeMj) {
    const texte = JSON.stringify([vue, modeMj]);
    if (texte === fiche.texte) return;
    fiche.texte = texte;
    const marques = MARQUES.filter((marque) => vue.marques.includes(marque));
    const morte = marques.includes("morte");
    // À sa mort, la fiche se replie quoi qu'en ait fait la personne, qui peut
    // la rouvrir ensuite.
    if (morte && !fiche.morte) fiche.choix = null;
    fiche.morte = morte;
    fiche.joue = marques.includes("joue");
    fiche.noeud.className = [PREFIXE, ...marques, Object.hasOwn(JEUX, vue.jeu ?? "") ? JEUX[vue.jeu] : null].filter(Boolean).join(" ");

    const tete = JSON.stringify([vue.initiales, vue.nom, vue.sousTitre, vue.statut, vue.actions]);
    if (tete !== fiche.texteDeTete) {
      fiche.texteDeTete = tete;
      fiche.resume.replaceChildren(...faireResume(vue));
    }
    // Le corps ne lit ni l'état, ni les marques, ni les actions, ni ce que
    // le protagoniste peut encore faire : ce sont l'en-tête et les classes qui
    // les montrent. Ni la case d'avant le lancement, qui a son groupe : un
    // jeton déplacé ne refait pas la fiche. « Jouer » et « Modifier… », qui
    // changent à chaque geste, ne refont que leur rangée.
    const corps = JSON.stringify({ ...vue, statut: undefined, marques: undefined, actions: undefined, jouer: undefined, avant: undefined, jeu: undefined, menuMj: undefined, modeMj });
    const boutons = JSON.stringify([vue.jouer ?? null, vue.menuMj ?? null, modeMj]);
    if (corps !== fiche.texteDuCorps) {
      fiche.texteDuCorps = corps;
      fiche.texteDeJouer = boutons;
      fiche.corps.replaceChildren(...faireCorps(fiche, vue, modeMj));
    } else if (boutons !== fiche.texteDeJouer) {
      fiche.texteDeJouer = boutons;
      fiche.modifier = boutonModifier(fiche, vue, modeMj);
      fiche.boutons.replaceChildren(...[boutonJouer(vue), fiche.complete, fiche.modifier].flat().filter(Boolean));
    }
    const avant = JSON.stringify(vue.avant ? [vue.avant, vue.nom] : null);
    if (avant !== fiche.texteDAvant) {
      fiche.texteDAvant = avant;
      if (vue.avant) {
        fiche.avant.setAttribute("aria-label", sansSensForce(vue.nom));
        fiche.avant.replaceChildren(...faireAvant(fiche, vue));
      } else {
        fiche.avant.replaceChildren();
      }
    }
  }

  /** Ouvre ou replie le volet, à chaque rendu, que la fiche ait été refaite ou non. */
  function deplier(fiche, etroit) {
    let ouverte = true;
    if (fiche.choix !== null) ouverte = fiche.choix;
    else if (fiche.morte) ouverte = false;
    else if (etroit) ouverte = fiche.joue;
    if (ouverte !== estOuverte(fiche)) {
      if (ouverte) fiche.noeud.setAttribute("open", "");
      else fiche.noeud.removeAttribute("open");
    }
    fiche.ecrit = ouverte;
  }

  function rendreCamp(camp, vues, etroit, modeMj) {
    for (const vue of vues) {
      if (!fiches.has(vue.id)) fiches.set(vue.id, creerFiche(vue.id));
      const fiche = fiches.get(vue.id);
      releverLeGeste(fiche);
      refaire(fiche, vue, modeMj);
      deplier(fiche, etroit);
    }
    // Les fiches ne se reposent dans la liste que si la liste a changé : un
    // nœud reposé perd le focus et le défilement. Avant le lancement, chaque
    // volet est suivi de son groupe « Case » et « Retirer ».
    const ordre = JSON.stringify(vues.map((vue) => [vue.id, Boolean(vue.avant)]));
    if (ordre !== camp.ordre) {
      camp.ordre = ordre;
      const noeudsDe = (vue) => {
        const fiche = fiches.get(vue.id);
        return vue.avant ? [fiche.noeud, fiche.avant] : [fiche.noeud];
      };
      camp.noeud.replaceChildren(camp.tete, ...(vues.length ? vues.flatMap(noeudsDe) : [camp.vide]));
    }
    const morts = vues.filter((vue) => vue.marques.includes("morte")).length;
    const ecrit = vues.length === 0 ? "" : morts === 0 ? `· ${vues.length}` : `· ${vues.length - morts} en vie sur ${vues.length}`;
    if (camp.nombre.textContent !== ecrit) camp.nombre.textContent = ecrit;
  }

  /** Où était le focus avant le rendu, s'il était dans les fiches. */
  function focusAvant() {
    const actif = globalThis.document?.activeElement;
    if (!actif || !estDans(actif, noeud)) return null;
    for (const [id, fiche] of fiches) {
      if (estDans(actif, fiche.noeud) || estDans(actif, fiche.avant)) return { actif, id, camp: camps.find((camp) => estDans(actif, camp.noeud)), repere: actif.getAttribute("data-repere") };
    }
    return null;
  }

  /**
   * Rend le focus à ce qui le portait : au même nœud s'il est encore là, au
   * bouton ou au champ de même rôle si le corps de la fiche a été refait, à
   * l'en-tête de la fiche s'il n'existe plus, au titre du camp si la fiche
   * elle-même a été retirée. Jamais en faisant défiler la page (compl.
   * § 4.5) : une fiche refaite au geste d'un autre ne déplace pas la vue.
   */
  function rendreLeFocus(avant) {
    if (!avant) return;
    const { document } = globalThis;
    if (estDans(avant.actif, noeud)) {
      if (document.activeElement !== avant.actif) avant.actif.focus({ preventScroll: true });
      return;
    }
    const fiche = fiches.get(avant.id);
    if (!fiche) {
      avant.camp?.tete.focus({ preventScroll: true });
      return;
    }
    const pareil = avant.repere ? (fiche.corps.querySelector(`[data-repere=${avant.repere}]`) ?? fiche.avant.querySelector(`[data-repere=${avant.repere}]`)) : null;
    (pareil ?? fiche.resume).focus({ preventScroll: true });
  }

  function rendre(vue, ecran) {
    const avant = focusAvant();
    const etroit = ecran?.etroit === true;
    const modeMj = ecran?.modeMj === true;
    const presents = new Set();
    for (const camp of camps) {
      const vues = vue[camp.camp] ?? [];
      for (const { id } of vues) presents.add(id);
      rendreCamp(camp, vues, etroit, modeMj);
    }
    for (const id of [...fiches.keys()]) {
      if (!presents.has(id)) fiches.delete(id);
    }
    rendreLeFocus(avant);
  }

  return { noeud, rendre };
}
