// La rencontre (SPECIFICATION.md, § 16.6).
//
// Le meneur choisit des adversaires et un nombre d'exemplaires de chacun,
// par des boutons + et −, puis imprime : une carte par exemplaire (§ 16.5),
// numérotée dès qu'il y en a plus d'une du même adversaire, dans l'ordre de
// la liste, sur des pages A4. La composition vit le temps de la visite,
// dans la mémoire de ce module : elle n'est enregistrée nulle part, et
// repart de zéro quand la banque change.
//
// Ce module porte aussi ce que la fiche d'un adversaire partage avec lui :
// le cadre où des cartes se tiennent à l'échelle de l'écran, et
// l'impression, qui attend les polices de la carte.

import { LARGEUR_CARTE, cartes } from "../adversaire/carte.js";
import { defautDe } from "../adversaire/lecture.js";
import { texteDe } from "../adversaire/notation.js";
import { listeDe, manqueDe } from "../banque/consultation.js";
import { filtrer } from "../banque/recherche.js";
import { adresseFiche, adresseListe } from "../routes.js";
import { compte, el, enumerer, sansSensForce, titre } from "./dom.js";
import { tenirALEchelle } from "./echelle.js";

// Trois cartes tiennent sur une page A4 : douze exemplaires d'un adversaire
// en font quatre pages, soixante cartes une vingtaine. L'aperçu fabrique
// chaque carte dans la page, une centaine d'éléments chacune (94 à 121 sur
// la démonstration, lot 3) : au-delà, un téléphone peine, et un doigt resté
// sur « + » imprimerait une rame.
export const PLAFOND_EXEMPLAIRES = 12;
export const PLAFOND_CARTES = 60;

// Les trois faces d'EB Garamond qu'emploie la carte (css/adversaire.css).
const POLICES_CARTE = ["11px 'EB Garamond'", "600 11px 'EB Garamond'", "italic 11px 'EB Garamond'"];

// La composition : le nombre d'exemplaires de chaque adversaire, par son
// nom, et les adversaires déjà résolus. Elle appartient à une banque.
let composition = new Map();
let resolus = new Map();
let banqueDeLaRencontre = null;

function compositionDe(banque) {
  if (banqueDeLaRencontre !== banque) {
    composition = new Map();
    resolus = new Map();
    banqueDeLaRencontre = banque;
  }
  return composition;
}

const total = (choisis) => [...choisis.values()].reduce((somme, nombre) => somme + nombre, 0);

/** Le nombre d'exemplaires d'un adversaire dans la rencontre. */
export function exemplaires(banque, nom) {
  return compositionDe(banque).get(nom) ?? 0;
}

/** Vrai quand la rencontre peut recevoir un exemplaire de plus de cet adversaire. */
export function peutAjouter(banque, nom) {
  const choisis = compositionDe(banque);
  return (choisis.get(nom) ?? 0) < PLAFOND_EXEMPLAIRES && total(choisis) < PLAFOND_CARTES;
}

/** Ajoute un exemplaire, dans la limite des plafonds ; rend vrai s'il est ajouté. */
export function ajouter(banque, nom) {
  if (!peutAjouter(banque, nom)) return false;
  composition.set(nom, exemplaires(banque, nom) + 1);
  return true;
}

function retirer(banque, nom) {
  const nombre = exemplaires(banque, nom);
  if (nombre === 0) return false;
  if (nombre === 1) composition.delete(nom);
  else composition.set(nom, nombre - 1);
  return true;
}

// Un doublon (E16) ne compte qu'une fois : la rencontre prend le premier de
// son nom, comme l'héritage prend le premier type.
function resoudre(contexte, nom) {
  if (!resolus.has(nom)) {
    const resolution = contexte.etat.index.adversaires();
    resolus.set(nom, resolution.resoudre(resolution.adversaires.get(nom)));
  }
  return resolus.get(nom);
}

/**
 * Le cadre où des cartes se tiennent à l'échelle de l'écran : { noeud,
 * montrer(liste), mesurer }, liste étant celle de cartes() (carte.js). Le
 * cadre reste, ses cartes changent : c'est lui qui porte l'échelle, que
 * l'écran fait mesurer de nouveau quand sa hauteur change.
 */
export function cadreDeCartes() {
  const noeud = el("div", { classe: "cadre-cartes" });
  const mesurer = tenirALEchelle(noeud, LARGEUR_CARTE);
  return {
    noeud,
    mesurer,
    montrer(liste) {
      noeud.replaceChildren(cartes(liste));
      globalThis.requestAnimationFrame?.(mesurer);
    },
  };
}

/**
 * Lance l'impression de la page, où seules les cartes sortent (css). Leurs
 * polices d'abord : sinon le PDF prend celles du système.
 */
export async function imprimerCartes() {
  try {
    await Promise.all(POLICES_CARTE.map((police) => document.fonts.load(police)));
    await document.fonts.ready;
  } catch {
    // polices indisponibles : l'impression se fait avec celles de secours
  }
  globalThis.print();
}

/** L'écran #/rencontre. */
export function afficher(contexte) {
  const { banque } = contexte.etat;
  const adversaires = listeDe(banque, "adversaires");
  const manque = manqueDe(banque, "adversaires");
  if (manque || !adversaires.length) {
    return el(
      "section",
      {},
      titre("Rencontre"),
      el("p", { classe: "message" }, manque ?? "Cette banque n'a aucun adversaire."),
      el("p", { classe: "lien-retour" }, el("a", { href: "#/" }, "Retour à l'accueil")),
    );
  }
  const choisis = compositionDe(banque);
  const cadre = cadreDeCartes();
  const liste = el("ul", { classe: "liste-rencontre" });
  const trouves = el("p", { classe: "secondaire-texte petit", role: "status" });
  const bilan = el("p", { classe: "bilan-rencontre", role: "status", tabindex: "-1" });
  const detail = el("p", { classe: "secondaire-texte" });
  const signalement = el("div", {});
  const imprimer = el("button", { type: "button", classe: "bouton bouton-principal", onclick: () => imprimerCartes() }, "Imprimer / PDF");
  const vider = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => {
        choisis.clear();
        rafraichir();
        // Le bouton devient inactif : le focus va à ce qui dit le résultat.
        bilan.focus();
      },
    },
    "Vider la rencontre",
  );
  const lignes = new Map();

  function rafraichir() {
    const somme = total(choisis);
    for (const [nom, { valeur, moins, plus }] of lignes) {
      const nombre = choisis.get(nom) ?? 0;
      valeur.textContent = String(nombre);
      moins.disabled = nombre === 0;
      plus.disabled = !peutAjouter(banque, nom);
    }
    const retenus = adversaires.filter((adversaire) => choisis.has(adversaire.nom));
    bilan.textContent = somme >= PLAFOND_CARTES ? `${somme} cartes : le plafond d'une rencontre.` : compte(somme, "carte", "cartes");
    detail.textContent = somme ? sansSensForce(`${retenus.map(({ nom }) => `${choisis.get(nom)} × ${nom}`).join(", ")}.`) : "Ajoutez un adversaire avec « + » : sa carte paraît ci-dessous.";
    imprimer.disabled = somme === 0;
    vider.disabled = somme === 0;
    const incertains = retenus.map(({ nom }) => [nom, defautDe(resoudre(contexte, nom))]).filter(([, defaut]) => defaut);
    signalement.replaceChildren(
      ...(incertains.length
        ? [
            el(
              "p",
              { classe: "message" },
              "À vérifier avant d'imprimer : ",
              enumerer(incertains.map(([nom, defaut]) => [el("a", { href: adresseFiche("adversaires", nom) }, nom), ` (${defaut})`])),
              `. ${incertains.length > 1 ? "Ils s'impriment tels qu'ils se résolvent." : "Il s'imprime tel qu'il se résout."}`,
            ),
          ]
        : []),
    );
    // Une carte par exemplaire, dans l'ordre de la liste ; un numéro dès
    // qu'un adversaire en a plus d'une.
    cadre.montrer(
      retenus.flatMap(({ nom }) => {
        const nombre = choisis.get(nom);
        return Array.from({ length: nombre }, (_, i) => ({ resolu: resoudre(contexte, nom), numero: nombre > 1 ? i + 1 : null }));
      }),
    );
  }

  function changer(nom, pas) {
    if (!(pas > 0 ? ajouter(banque, nom) : retirer(banque, nom))) return;
    rafraichir();
    // Un bouton devenu inactif perd le focus : il passe à son voisin.
    const { moins, plus } = lignes.get(nom);
    const [bouton, voisin] = pas > 0 ? [plus, moins] : [moins, plus];
    if (bouton.disabled && !voisin.disabled) voisin.focus();
  }

  adversaires.forEach(({ nom, types }, rang) => {
    const id = `exemplaires-${rang}`;
    const valeur = el("span", { id, classe: "valeur-pas" });
    const moins = el("button", { type: "button", id: `${id}-moins`, classe: "bouton secondaire bouton-pas", "aria-label": `Retirer un exemplaire de ${nom}`, onclick: () => changer(nom, -1) }, "−");
    const plus = el("button", { type: "button", id: `${id}-plus`, classe: "bouton secondaire bouton-pas", "aria-label": `Ajouter un exemplaire de ${nom}`, onclick: () => changer(nom, +1) }, "+");
    const noeud = el(
      "li",
      { classe: "ligne-rencontre" },
      el("span", { classe: "nom-rencontre" }, el("a", { href: adresseFiche("adversaires", nom) }, nom), " ", el("span", { classe: "detail" }, texteDe(types) || "sans type")),
      el("div", { classe: "pas-a-pas" }, moins, valeur, plus),
    );
    lignes.set(nom, { noeud, valeur, moins, plus });
  });

  const recherche = el("input", {
    type: "search",
    id: "recherche-rencontre",
    classe: "champ",
    autocomplete: "off",
    autocapitalize: "none",
    spellcheck: "false",
    placeholder: "Nom, type, équipement ou capacité",
  });
  // Les lignes se gardent, avec leurs boutons : la recherche ne fait que
  // choisir celles qu'elle montre.
  const filtrerLignes = () => {
    const montres = filtrer(adversaires, recherche.value, contexte.etat.index.textesAdversaire);
    liste.replaceChildren(...montres.map(({ nom }) => lignes.get(nom).noeud));
    trouves.textContent = recherche.value.trim() ? `${compte(montres.length, "adversaire", "adversaires")} sur ${adversaires.length}` : compte(adversaires.length, "adversaire", "adversaires");
  };
  recherche.addEventListener("input", filtrerLignes);
  filtrerLignes();
  rafraichir();

  // Tout ce qui n'est pas une carte reste à l'écran : à l'impression,
  // seules les cartes sortent.
  return el(
    "section",
    { classe: "rencontre" },
    el(
      "div",
      { classe: "ne-pas-imprimer" },
      titre("Rencontre"),
      el("label", { for: "recherche-rencontre" }, "Rechercher parmi les adversaires"),
      recherche,
      trouves,
      liste,
      // La liste d'un vrai classeur est longue : le compte des cartes et
      // « Imprimer / PDF » restent au bas de l'écran pendant qu'on la parcourt.
      el("div", { classe: "barre-rencontre" }, bilan, imprimer),
      detail,
      signalement,
      // Le mode d'emploi vient après la liste : sur un téléphone, placé en
      // tête, il poussait les boutons + sous le pli (relecture du lot 3).
      el(
        "p",
        { classe: "secondaire-texte" },
        `L'Atelier imprime une carte par exemplaire, numérotée dès qu'il y en a plus d'une du même adversaire. Jusqu'à ${PLAFOND_EXEMPLAIRES} exemplaires d'un adversaire, et ${PLAFOND_CARTES} cartes en tout. La composition n'est pas enregistrée : elle se perd à la fermeture de la page.`,
      ),
      el("div", { classe: "boutons" }, vider),
      el("p", { classe: "lien-retour" }, el("a", { href: adresseListe("adversaires") }, "Tous les adversaires")),
      el("h2", {}, "Aperçu"),
    ),
    cadre.noeud,
  );
}
