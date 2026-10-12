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
// Ce qu'elle garde pour elle : le jeton « en main », le jeton qu'on fait
// glisser, et le texte de ce que montre chaque case et chaque jeton.

import { el, sansSensForce } from "./dom.js";
import { COLONNES, COTE } from "../combat/regles.js";

// Le nom de la région, tel qu'il se lit à l'écran : dans le code, cette
// grille s'appelle le plateau.
const TITRE = "Carte";
// Une case montre trois jetons au plus. Sous 56rem, la feuille de style
// cache le troisième : d'où deux « +k », dont elle ne montre qu'un.
const MONTRES = 3;
const MONTRES_ETROIT = 2;
const LEGENDE = [
  ["combat-pj", "personnage"],
  ["combat-adv", "adversaire"],
  ["joue", "joue"],
  ["cible", "cible"],
  ["mort", "mort, barré"],
];

const possede = (objet, nom) => Object.prototype.hasOwnProperty.call(objet, nom);

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
 * La partie « plateau » de l'écran du combat : { noeud, rendre(vue),
 * prendre(id), enMain() }.
 *
 * « actions » vient de l'écran : executer(commande, origine), toujours avec
 * l'origine "plateau", et ouvrirCase(nomDeCase) pour la liste « +k ».
 * « prendre » et « enMain » servent à cette liste, que l'écran tient : avant
 * le lancement, elle prend un jeton en main sans passer par la grille.
 */
export function creer(actions) {
  let vue = null;
  // Le jeton touché, qui attend sa case ; et celui qu'on fait glisser.
  let enMain = null;
  let glisse = null;
  // La case de chaque jeton, d'après la dernière vue.
  let caseDe = new Map();
  const cases = new Map();
  const jetons = new Map();

  const preparation = () => vue !== null && vue.phase === "preparation";

  /**
   * Pose un jeton, avant le lancement. La main se vide d'abord : l'écran
   * redessine pendant « executer », et doit trouver le plateau au repos.
   */
  function poser(id, nomDeCase) {
    enMain = null;
    if (caseDe.get(id) !== nomDeCase) actions.executer({ preparer: { type: "poser", id, case: nomDeCase } }, "plateau");
    dessiner();
    // Le bouton de la case vient de quitter la page, et le focus avec lui :
    // il va au jeton posé, s'il se voit.
    const pose = jetons.get(id);
    if (pose && pose.noeud.parentNode) pose.noeud.focus();
  }

  function auClicDuJeton(fiche) {
    if (fiche.etat === null || !fiche.etat.agit) return;
    if (preparation()) {
      enMain = enMain === fiche.id ? null : fiche.id;
      dessiner();
      return;
    }
    actions.executer(fiche.etat.commande, "plateau");
  }

  function auClicDeLaCase(fiche) {
    const choix = fiche.etat === null ? null : fiche.etat.choix;
    if (!choix) return;
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
    };
    fiche.noeud = el(
      "button",
      {
        type: "button",
        classe: "combat-jeton",
        onclick: () => auClicDuJeton(fiche),
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
      el("span", { classe: "combat-rond" }, fiche.initiales),
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
    const inactif = v.inactif === true || ecarte;
    const commande = !avant && !inactif && v.choix ? v.choix.commande : null;
    return {
      camp: v.camp === "pj" ? "pj" : "adv",
      entier: String(v.entier),
      jeton: String(v.jeton),
      initiales: String(v.initiales),
      nom: String(v.nom),
      marque: v.marque === "joue" || v.marque === "cible" ? v.marque : null,
      mort: v.mort === true,
      inactif,
      tenu: avant ? tenu : null,
      agit: avant ? !ecarte : commande !== null,
      commande,
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
    fiche.noeud.className = classes.join(" ");
    // Le titre et le nom accessible s'affichent ou se lisent : comme tout
    // texte montré, ils perdent les signes qui commandent le sens.
    fiche.noeud.setAttribute("title", sansSensForce(etat.entier));
    fiche.noeud.setAttribute("aria-label", sansSensForce(etat.nom));
    attribuer(fiche.noeud, "aria-pressed", etat.tenu === null ? null : String(etat.tenu));
    // Un jeton qui n'a rien à offrir reste un bouton, et garde le focus :
    // son nom dit qui est là.
    attribuer(fiche.noeud, "aria-disabled", etat.agit ? null : "true");
    attribuer(fiche.noeud, "draggable", etat.tenu === null ? null : "true");
    fiche.initiales.replaceChildren(sansSensForce(etat.initiales));
    fiche.nomCourt.replaceChildren(sansSensForce(etat.jeton));
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
    fiche.noeud.className = classes.join(" ");

    const enfants = [];
    if (etat.choix) {
      fiche.choix ??= el("button", { type: "button", classe: "combat-case-choix", onclick: () => auClicDeLaCase(fiche) });
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

    const connus = (nom) => (possede(vue.cases, nom) ? vue.cases[nom].jetons.filter((id) => possede(vue.jetons, id)) : []);
    caseDe = new Map();
    for (const nom of cases.keys()) for (const id of connus(nom)) caseDe.set(id, nom);
    const caseTenue = enMain === null ? null : (caseDe.get(enMain) ?? null);
    // La vue marque les jetons qu'un choix écarte, pas les cases : une case
    // est écartée quand un choix est ouvert et qu'elle n'y offre rien.
    const enChoix = !avant && (Object.values(vue.jetons).some((jeton) => jeton.inactif === true) || Object.values(vue.cases).some((c) => c.choix));

    const montres = new Set();
    for (const fiche of cases.values()) {
      const v = possede(vue.cases, fiche.nom) ? vue.cases[fiche.nom] : null;
      const ids = connus(fiche.nom);
      let choix = null;
      if (avant) {
        if (enMain !== null && fiche.nom !== caseTenue) {
          choix = { nom: `Case ${fiche.nom} : y poser ${vue.jetons[enMain].entier}`, commande: { preparer: { type: "poser", id: enMain, case: fiche.nom } } };
        }
      } else if (v && v.choix) {
        choix = { nom: String(v.choix.nom), commande: v.choix.commande };
      }
      const active = (v !== null && v.active === true) || (caseTenue !== null && fiche.nom === caseTenue);
      const etat = {
        active,
        inactive: enChoix && !active && choix === null && !ids.some((id) => vue.jetons[id].choix),
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
  const legende = el(
    "ul",
    { classe: "combat-legende" },
    LEGENDE.map(([classe, texte]) => el("li", { classe }, el("span", { classe: "combat-rond" }), texte)),
  );
  const noeud = el("section", { classe: "combat-plateau", "aria-label": TITRE }, grille, legende);

  /**
   * Montre la vue. Le second argument que l'écran passe à chaque partie (sa
   * mémoire) n'est pas lu ici : le plateau tient lui-même ce qu'il a en main.
   */
  function rendre(vueNeuve) {
    vue = vueNeuve;
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

  return { noeud, rendre, prendre, enMain: () => enMain };
}
