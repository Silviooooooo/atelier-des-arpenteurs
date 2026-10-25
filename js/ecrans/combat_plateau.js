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
  ["mort", "mort, barré"],
  ["portee", "portée de la capacité survolée"],
];
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
 * prendre(id), enMain(), hachurer(noms) }.
 *
 * « actions » vient de l'écran : executer(commande, origine), toujours avec
 * l'origine "plateau", et ouvrirCase(nomDeCase) pour la liste « +k ».
 * « prendre » et « enMain » servent à cette liste, que l'écran tient : avant
 * le lancement, elle prend un jeton en main sans passer par la grille.
 * « hachurer » sert aux infobulles et à l'aperçu d'une ligne (contrat du
 * groupe 2, § 9.5).
 */
export function creer(actions) {
  let vue = null;
  // Vrai quand on ne joue pas : la carte ne porte alors aucune commande.
  let arrete = false;
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
  const legende = el(
    "ul",
    { classe: "combat-legende" },
    LEGENDE.map(([classe, texte]) => el("li", { classe }, el("span", { classe: "combat-rond" }), texte)),
  );
  const tete = el("p", { classe: "combat-plateau-tete" }, el("span", {}, EN_TETE), " ", el("span", { classe: "combat-plateau-survol" }, AU_SURVOL));
  const noeud = el("section", { classe: "combat-plateau", "aria-label": TITRE }, tete, grille, legende, raison);

  /**
   * Montre la vue. De la mémoire de l'écran, le plateau ne lit que
   * « arrete » (on ne joue pas : rien ne s'offre) ; ce qu'il a en main, il le
   * tient lui-même.
   */
  function rendre(vueNeuve, ecran) {
    vue = vueNeuve;
    arrete = ecran?.arrete === true;
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

  return { noeud, rendre, prendre, enMain: () => enMain, hachurer };
}
