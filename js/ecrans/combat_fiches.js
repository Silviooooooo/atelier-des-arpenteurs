// Les fiches vivantes du combat (SPECIFICATION.md, § 17, « Le simulateur de
// combat (lot 4) » ; mission du lot 4, § 5 et § 10.5).
//
// Une fiche par protagoniste, dans la liste de son camp : un volet que son
// nom déplie, avec ce qui change pendant le combat (actions, souffle, corps,
// armure et résistance de chaque zone, lien, passifs câblés) et les boutons
// « Jouer » et « Fiche complète ». C'est l'une des quatre parties de l'écran
// du combat. Elle ne sait rien du jeu : elle montre les vues qu'on lui donne
// (vueFiche, js/combat/lecture.js), où chaque texte arrive écrit et chaque
// bouton avec sa commande, et elle rend la main à l'écran par « actions ».
//
// Ce qu'elle garde pour elle : le texte de chaque vue déjà montrée, pour ne
// refaire que les fiches qui ont changé, et ce que la personne a fait de
// chaque volet (ouvert ou replié), que la mort du protagoniste fait oublier.

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

/** « 1 action », « 0 action », « 2 actions ». */
const accorder = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

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
    el("td", {}, nomDeZone(zone)),
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

function tableDesZones(zones) {
  return el(
    "table",
    { classe: "combat-zones" },
    el("thead", {}, el("tr", {}, ["d20", "Zone", "Armure", "Résistance"].map((titre) => el("th", { scope: "col" }, titre)))),
    el("tbody", {}, zones.map(ligneDeZone)),
  );
}

/**
 * Un passif câblé, ou un effet en cours. Inactif, il le dit en toutes
 * lettres, avec sa raison : la couleur seule ne dit jamais rien.
 */
function ligneDEffet(effet) {
  if (typeof effet === "string") return el("li", {}, effet);
  if (effet.actif !== false) return el("li", {}, effet.texte);
  return el("li", { classe: "eteint" }, effet.texte, effet.raison ? ` (inactif : ${effet.raison})` : " (inactif)");
}

/** Les actions restantes, en pastilles ; un lecteur d'écran en entend le compte. */
function actionsRestantes({ reste, max }) {
  const dit = `${accorder(reste, "action")} sur ${max}`;
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
 * « ecran.etroit » dit qu'on est sur un téléphone. « actions » vient de
 * l'écran : executer(commande, origine) et ouvrirFiche(id).
 */
export function creer(actions) {
  // Les identifiants de la page ne se font jamais d'un identifiant de
  // protagoniste, qui est une donnée.
  let numero = 0;
  /** id → { numero, noeud, resume, corps, texte, ecrit, choix, morte, joue } */
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
    const fiche = { numero, noeud: null, resume: el("summary"), corps: el("div", { classe: `${PREFIXE}-corps` }), texte: null, ecrit: false, choix: null, morte: false, joue: false };
    fiche.noeud = el("details", { classe: PREFIXE, "data-id": id, ontoggle: () => releverLeGeste(fiche) }, fiche.resume, fiche.corps);
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

  /** Avant le lancement : la case du protagoniste, et de quoi le retirer. */
  function faireAvant(fiche, vue) {
    const { avant } = vue;
    const id = `${PREFIXE}-${fiche.numero}-case`;
    const refus = el("p", { id: `${id}-refus`, classe: "secondaire-texte petit", hidden: true }, CASE_REFUSEE);
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
        el("div", {}, el("label", { for: id }, "Case"), champ),
        el(
          "button",
          { type: "button", classe: "bouton secondaire", "data-repere": "retirer", "aria-label": `Retirer : ${sansSensForce(vue.nom)}`, onclick: () => actions.executer(avant.retirer.commande, "panneau") },
          "Retirer",
        ),
      ),
      refus,
    ];
  }

  function faireCorps(fiche, vue) {
    const lignes = [...(vue.effets ?? []), ...vue.passifs];
    return [
      vue.souffle.absent ? jauge("souffle", "Souffle", 0, 0, SOUFFLE_ABSENT) : jauge("souffle", "Souffle", vue.souffle.valeur, vue.souffle.max),
      jauge("corps", "Corps", vue.corps.valeur, vue.corps.max),
      tableDesZones(vue.zones),
      el("p", { classe: "combat-contre" }, vue.contre),
      [vue.attaque, vue.defense, vue.bouclier].filter(Boolean).map((texte) => el("p", { classe: "combat-valeurs" }, texte)),
      vue.liens.map((lien) => jauge("lien", `Lien · ${sansSensForce(lien.nom)}`, lien.valeur, lien.max)),
      lignes.length ? el("ul", { classe: "combat-effets" }, lignes.map(ligneDEffet)) : null,
      faireLesBoutons(fiche, vue),
      vue.avant ? faireAvant(fiche, vue) : null,
    ].flat().filter(Boolean);
  }

  /** « Jouer », quand la fiche peut être choisie : toujours dans le corps, jamais dans l'en-tête. */
  function boutonJouer(vue) {
    if (!vue.jouer) return null;
    return el("button", { type: "button", classe: "bouton", "data-repere": "jouer", "aria-label": `Jouer : ${sansSensForce(vue.nom)}`, onclick: () => actions.executer(vue.jouer.commande, "panneau") }, "Jouer");
  }

  /**
   * La rangée des boutons : « Jouer », puis « Fiche complète ». La fiche en
   * garde les nœuds : « Jouer » paraît et disparaît à chaque geste sur toutes
   * les fiches du camp qui joue, sans que rien d'autre n'y change.
   */
  function faireLesBoutons(fiche, vue) {
    fiche.complete = el(
      "button",
      { type: "button", classe: "bouton secondaire", "data-repere": "fiche-complete", "aria-label": `Fiche complète : ${sansSensForce(vue.nom)}`, onclick: () => actions.ouvrirFiche(vue.id) },
      "Fiche complète",
    );
    fiche.boutons = el("div", { classe: "combat-ligne" }, boutonJouer(vue), fiche.complete);
    return fiche.boutons;
  }

  /**
   * Refait d'une fiche ce dont la vue a changé, et cela seul : son en-tête
   * (l'état, les actions), son corps (les jauges, les zones, les valeurs), ou
   * le seul bouton « Jouer ». Sans ce partage, la fin d'un geste refaisait en
   * entier la fiche de chaque protagoniste du camp, pour un bouton (mesuré :
   * douze à quatorze fiches sur quinze, plus de cent millisecondes au clic).
   */
  function refaire(fiche, vue) {
    const texte = JSON.stringify(vue);
    if (texte === fiche.texte) return;
    fiche.texte = texte;
    const marques = MARQUES.filter((marque) => vue.marques.includes(marque));
    const morte = marques.includes("morte");
    // À sa mort, la fiche se replie quoi qu'en ait fait la personne, qui peut
    // la rouvrir ensuite.
    if (morte && !fiche.morte) fiche.choix = null;
    fiche.morte = morte;
    fiche.joue = marques.includes("joue");
    fiche.noeud.className = [PREFIXE, ...marques].join(" ");

    const tete = JSON.stringify([vue.initiales, vue.nom, vue.sousTitre, vue.statut, vue.actions]);
    if (tete !== fiche.texteDeTete) {
      fiche.texteDeTete = tete;
      fiche.resume.replaceChildren(...faireResume(vue));
    }
    // Le corps ne lit ni l'état, ni les marques, ni les actions : ce sont
    // l'en-tête et les classes qui les montrent.
    const corps = JSON.stringify({ ...vue, statut: undefined, marques: undefined, actions: undefined, jouer: undefined });
    const jouer = JSON.stringify(vue.jouer ?? null);
    if (corps !== fiche.texteDuCorps) {
      fiche.texteDuCorps = corps;
      fiche.texteDeJouer = jouer;
      fiche.corps.replaceChildren(...faireCorps(fiche, vue));
    } else if (jouer !== fiche.texteDeJouer) {
      fiche.texteDeJouer = jouer;
      fiche.boutons.replaceChildren(...[boutonJouer(vue), fiche.complete].filter(Boolean));
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

  function rendreCamp(camp, vues, etroit) {
    for (const vue of vues) {
      if (!fiches.has(vue.id)) fiches.set(vue.id, creerFiche(vue.id));
      const fiche = fiches.get(vue.id);
      releverLeGeste(fiche);
      refaire(fiche, vue);
      deplier(fiche, etroit);
    }
    // Les fiches ne se reposent dans la liste que si la liste a changé : un
    // nœud reposé perd le focus et le défilement.
    const ordre = JSON.stringify(vues.map((vue) => vue.id));
    if (ordre !== camp.ordre) {
      camp.ordre = ordre;
      camp.noeud.replaceChildren(camp.tete, ...(vues.length ? vues.map((vue) => fiches.get(vue.id).noeud) : [camp.vide]));
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
      if (estDans(actif, fiche.noeud)) return { actif, id, camp: camps.find((camp) => estDans(actif, camp.noeud)), repere: actif.getAttribute("data-repere") };
    }
    return null;
  }

  /**
   * Rend le focus à ce qui le portait : au même nœud s'il est encore là, au
   * bouton ou au champ de même rôle si le corps de la fiche a été refait, à
   * l'en-tête de la fiche s'il n'existe plus, au titre du camp si la fiche
   * elle-même a été retirée.
   */
  function rendreLeFocus(avant) {
    if (!avant) return;
    const { document } = globalThis;
    if (estDans(avant.actif, noeud)) {
      if (document.activeElement !== avant.actif) avant.actif.focus();
      return;
    }
    const fiche = fiches.get(avant.id);
    if (!fiche) {
      avant.camp?.tete.focus();
      return;
    }
    const pareil = avant.repere ? fiche.corps.querySelector(`[data-repere=${avant.repere}]`) : null;
    (pareil ?? fiche.resume).focus();
  }

  function rendre(vue, ecran) {
    const avant = focusAvant();
    const etroit = ecran?.etroit === true;
    const presents = new Set();
    for (const camp of camps) {
      const vues = vue[camp.camp] ?? [];
      for (const { id } of vues) presents.add(id);
      rendreCamp(camp, vues, etroit);
    }
    for (const id of [...fiches.keys()]) {
      if (!presents.has(id)) fiches.delete(id);
    }
    rendreLeFocus(avant);
  }

  return { noeud, rendre };
}
