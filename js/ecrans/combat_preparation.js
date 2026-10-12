// La préparation du combat (SPECIFICATION.md, § 17, « Le simulateur de
// combat (lot 4) » ; mission du lot 4, § 10.7).
//
// Avant le lancement, ce bloc tient la place du panneau d'action : on y
// ajoute un personnage ou des adversaires, on y place la rencontre préparée,
// on y règle qui commence, on y lance le combat, et il nomme les rôles
// câblés que la banque n'a pas. C'est l'une des quatre parties de l'écran
// du combat. Elle ne sait rien du jeu : elle montre la vue qu'on lui donne
// (vuePreparation, js/combat/lecture.js), où chaque bouton arrive avec son
// état et sa raison, et elle rend la main à l'écran par « actions ». Poser
// et déplacer les jetons se fait ailleurs : sur le plateau, et par le champ
// « Case » des fiches.
//
// Ce qu'elle garde pour elle : le personnage et l'adversaire choisis dans
// les listes, le nombre d'exemplaires saisi, et le texte de chaque morceau
// de vue déjà montré, pour ne refaire que ce qui a changé.

import { el, sansSensForce } from "./dom.js";

const TITRE = "Avant le combat";
const PREFIXE = "combat-preparation";
// Les textes de cette partie qui ne viennent pas de la vue.
const ATTENTE = "Lecture des personnages en ligne…";
const AUCUN_PERSONNAGE = "Aucun personnage enregistré à ajouter. Un personnage se crée et s'enregistre à l'écran ";
const NE_S_AJOUTE_PAS = " (ne s'ajoute pas)";
const SANS_CHOIX = "Choisissez d'abord dans la liste.";

/** Vrai quand « noeud » est « ancetre », ou l'un de ses descendants. */
function estDans(noeud, ancetre) {
  for (let courant = noeud; courant; courant = courant.parentNode) {
    if (courant === ancetre) return true;
  }
  return false;
}

/** La phrase d'un nombre d'exemplaires hors de ses bornes. */
function raisonDuNombre(max) {
  return max > 1 ? `Le nombre d'exemplaires va de 1 à ${max}.` : "Un seul exemplaire peut encore s'ajouter.";
}

/** Le nombre saisi, s'il est un entier de 1 à max ; sinon null. */
function nombreSaisi(texte, max) {
  const propre = String(texte).trim();
  if (!/^\d{1,4}$/.test(propre)) return null;
  const nombre = Number(propre);
  return nombre >= 1 && nombre <= max ? nombre : null;
}

/**
 * Un bouton et la raison qui l'accompagne. Inactif, il garde le focus : un
 * bouton éteint par « disabled » sortirait de l'ordre du clavier, et sa
 * raison avec lui. Le clic passe donc toujours, et c'est l'écouteur qui ne
 * fait rien.
 */
function boutonARaison(repere, libelle, classe, auClic) {
  const id = `${PREFIXE}-raison-${repere}`;
  let actif = false;
  const raison = el("p", { id, classe: "secondaire-texte petit", hidden: true });
  const bouton = el(
    "button",
    {
      type: "button",
      classe,
      "data-repere": repere,
      "aria-describedby": id,
      "aria-disabled": "true",
      onclick: () => {
        if (actif) auClic();
      },
    },
    libelle,
  );
  return {
    bouton,
    raison,
    regler(estActif, pourquoi) {
      actif = estActif === true;
      if (actif) bouton.removeAttribute("aria-disabled");
      else bouton.setAttribute("aria-disabled", "true");
      const texte = actif || !pourquoi ? "" : sansSensForce(pourquoi);
      raison.textContent = texte;
      raison.hidden = texte === "";
    },
  };
}

/**
 * La liste d'un choix. Chaque option porte son rang pour valeur : un nom
 * ou une clé venus de la banque ou d'un personnage ne servent jamais
 * d'attribut qu'on relirait.
 */
function listeDeChoix(repere, intitule, options, rang, auChangement) {
  const id = `${PREFIXE}-${repere}`;
  const liste = el(
    "select",
    { id, classe: "champ", "data-repere": repere, onchange: auChangement },
    options.map((option, i) => el("option", { value: String(i) }, option.actif ? option.nom : `${option.nom}${NE_S_AJOUTE_PAS}`)),
  );
  // La valeur d'une liste ne se pose qu'une fois ses options en place.
  liste.value = String(rang);
  return { liste, noeud: el("div", {}, el("label", { for: id }, intitule), liste) };
}

/** Le rang de l'option gardée si elle peut encore s'ajouter ; sinon celui de la première qui le peut. */
function rangGarde(options, estLeChoix) {
  const garde = options.findIndex((option) => option.actif && estLeChoix(option));
  if (garde >= 0) return garde;
  return Math.max(0, options.findIndex((option) => option.actif));
}

/**
 * La partie « préparation » de l'écran du combat : { noeud, rendre(vue),
 * listeDeCase }.
 *
 * « actions » vient de l'écran : ajouterPersonnage(cle),
 * ajouterAdversaires(nom, nombre), placerRencontre(), lancer(), et
 * executer(commande, origine) pour ce qui n'a pas besoin de photographie.
 * « listeDeCase » est le nœud, jamais refait, où l'écran écrit la liste
 * « +k » d'une case.
 */
export function creer(actions) {
  // Ce que la personne a choisi dans les listes : gardé ici, puisque les
  // listes se refont quand leur vue change.
  const choix = { personnage: null, adversaire: null, nombre: "1" };

  const blocs = {};
  for (const nom of ["personnages", "adversaires", "rencontre", "quiCommence", "lancer", "notes"]) {
    blocs[nom] = { noeud: el("div", { classe: `${PREFIXE}-bloc` }), texte: null };
  }
  const listeDeCase = el("div", { classe: "combat-case-liste" });
  const noeud = el(
    "section",
    { classe: PREFIXE, "aria-label": TITRE },
    el("h2", {}, TITRE),
    blocs.personnages.noeud,
    blocs.adversaires.noeud,
    blocs.rencontre.noeud,
    blocs.quiCommence.noeud,
    blocs.lancer.noeud,
    blocs.notes.noeud,
    listeDeCase,
  );

  /** Refait un bloc si le morceau de vue qu'il montre a changé. */
  function refaire(bloc, vue, fabriquer) {
    const texte = JSON.stringify(vue);
    if (texte === bloc.texte) return;
    bloc.texte = texte;
    bloc.noeud.replaceChildren(...fabriquer(vue));
  }

  function fairePersonnages(vue) {
    const phrases = vue.phrases.map((phrase) => el("p", { classe: "secondaire-texte petit" }, phrase));
    // L'attente n'est pas une région d'annonce : l'écran n'en a qu'une, et
    // elle dit les dés.
    if (vue.attente) return [el("p", { classe: "secondaire-texte" }, ATTENTE), ...phrases];
    if (vue.options.length === 0) {
      return [el("p", { classe: "secondaire-texte" }, AUCUN_PERSONNAGE, el("a", { href: "#/personnages" }, "Personnages"), "."), ...phrases];
    }
    const ajout = boutonARaison("ajouter-personnage", "Ajouter", "bouton secondaire", () => {
      actions.ajouterPersonnage(vue.options[Number(choisi.liste.value)].cle);
    });
    const suivre = () => {
      const option = vue.options[Number(choisi.liste.value)];
      choix.personnage = option?.cle ?? null;
      ajout.regler(option?.actif === true, option ? option.raison : SANS_CHOIX);
    };
    const choisi = listeDeChoix(
      "personnage",
      "Personnage",
      vue.options,
      rangGarde(vue.options, (option) => option.cle === choix.personnage),
      suivre,
    );
    suivre();
    return [el("div", { classe: "combat-ligne" }, choisi.noeud, ajout.bouton), ajout.raison, ...phrases];
  }

  function faireAdversaires(vue) {
    if (vue.vide) return [el("p", { classe: "message" }, vue.vide)];
    if (vue.options.length === 0) return [];
    const idNombre = `${PREFIXE}-nombre`;
    const nombre = el("input", {
      type: "number",
      id: idNombre,
      classe: "champ",
      "data-repere": "nombre",
      inputmode: "numeric",
      min: "1",
      step: "1",
      autocomplete: "off",
      oninput: () => {
        choix.nombre = String(nombre.value);
        suivre();
      },
    });
    nombre.value = choix.nombre;
    const optionChoisie = () => vue.options[Number(choisi.liste.value)];
    const ajout = boutonARaison("ajouter-adversaires", "Ajouter", "bouton secondaire", () => {
      const option = optionChoisie();
      const combien = nombreSaisi(nombre.value, option.max);
      if (combien !== null) actions.ajouterAdversaires(option.nom, combien);
    });
    function suivre() {
      const option = optionChoisie();
      choix.adversaire = option?.nom ?? null;
      if (!option) return ajout.regler(false, SANS_CHOIX);
      nombre.setAttribute("max", String(Math.max(1, option.max)));
      if (!option.actif) return ajout.regler(false, option.raison);
      if (nombreSaisi(nombre.value, option.max) === null) return ajout.regler(false, raisonDuNombre(option.max));
      return ajout.regler(true, null);
    }
    const choisi = listeDeChoix(
      "adversaire",
      "Adversaire",
      vue.options,
      rangGarde(vue.options, (option) => option.nom === choix.adversaire),
      suivre,
    );
    suivre();
    return [
      el("div", { classe: "combat-ligne" }, choisi.noeud, el("div", {}, el("label", { for: idNombre }, "Exemplaires"), nombre), ajout.bouton),
      ajout.raison,
    ];
  }

  function faireRencontre(vue) {
    const placer = boutonARaison("rencontre", "Placer la rencontre préparée", "bouton secondaire", () => actions.placerRencontre());
    placer.regler(vue.actif, vue.raison);
    return [el("div", { classe: "combat-ligne" }, placer.bouton), placer.raison];
  }

  function faireQuiCommence(vue) {
    const id = `${PREFIXE}-qui-commence`;
    return [
      el(
        "div",
        { classe: "combat-ligne", role: "group", "aria-labelledby": id },
        el("span", { id }, "Qui commence"),
        vue.map((camp) =>
          el(
            "button",
            {
              type: "button",
              classe: "bouton secondaire",
              "data-repere": `commence-${camp.camp}`,
              "aria-pressed": camp.choisi ? "true" : "false",
              onclick: () => actions.executer(camp.commande, "panneau"),
            },
            camp.libelle,
          ),
        ),
      ),
    ];
  }

  function faireLancer(vue) {
    const lancer = boutonARaison("lancer", "Lancer le combat", "bouton", () => actions.lancer());
    lancer.regler(vue.actif, vue.raison);
    return [el("div", { classe: "combat-ligne" }, lancer.bouton), lancer.raison];
  }

  function faireNotes({ absents, avertissements }) {
    return [
      absents ? el("p", { classe: "combat-passifs" }, absents) : null,
      avertissements.length ? el("ul", { classe: "secondaire-texte petit" }, avertissements.map((avertissement) => el("li", {}, avertissement))) : null,
    ].filter(Boolean);
  }

  /**
   * Montre la vue. Le second argument que l'écran passe à chaque partie
   * (sa mémoire) n'est pas lu ici : la préparation n'en dépend pas.
   */
  function rendre(vue) {
    // Un bloc refait emporte le focus avec lui : on note où il était, pour
    // le rendre au bouton ou au champ de même rôle.
    const avant = globalThis.document?.activeElement;
    const repere = avant && estDans(avant, noeud) ? avant.getAttribute("data-repere") : null;

    refaire(blocs.personnages, vue.personnages, fairePersonnages);
    refaire(blocs.adversaires, vue.adversaires, faireAdversaires);
    refaire(blocs.rencontre, vue.rencontre, faireRencontre);
    refaire(blocs.quiCommence, vue.quiCommence, faireQuiCommence);
    refaire(blocs.lancer, vue.lancer, faireLancer);
    refaire(blocs.notes, { absents: vue.absents ?? null, avertissements: vue.avertissements ?? [] }, faireNotes);

    if (repere && !estDans(globalThis.document.activeElement, noeud)) {
      noeud.querySelector(`[data-repere=${repere}]`)?.focus();
    }
  }

  return { noeud, rendre, listeDeCase };
}
