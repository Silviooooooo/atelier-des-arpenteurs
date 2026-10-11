// Les listes : blocs, capacités, éléments, adversaires et leurs types
// (SPECIFICATION.md, § 9 et § 16.6).
//
// Une recherche instantanée sur les noms et les descriptions, sans casse ni
// accents. Sur un téléphone, la liste et la fiche s'affichent l'une après
// l'autre ; sur un grand écran, côte à côte. Le panneau de chaque liste se
// garde d'un écran à l'autre, avec sa recherche, tant que la banque ne
// change pas. Une banque publiée avant le lot 3 n'a pas d'adversaires : leurs
// deux listes le disent, et les autres se consultent comme avant.

import { listeDe, manqueDe } from "../banque/consultation.js";
import { TEXTES, filtrer } from "../banque/recherche.js";
import { CATEGORIES, adresseFiche, adresseListe } from "../routes.js";
import { compte, el, titrer } from "./dom.js";
import * as ficheAdversaire from "./fiche_adversaire.js";
import * as ficheBloc from "./fiche_bloc.js";
import * as ficheCapacite from "./fiche_capacite.js";
import * as ficheElement from "./fiche_element.js";
import * as ficheType from "./fiche_type.js";

const FICHES = { blocs: ficheBloc, capacites: ficheCapacite, elements: ficheElement, adversaires: ficheAdversaire, types: ficheType };
const NOMS = {
  blocs: ["bloc", "blocs"],
  capacites: ["capacité", "capacités"],
  elements: ["élément", "éléments"],
  adversaires: ["adversaire", "adversaires"],
  types: ["type d'adversaire", "types d'adversaires"],
};
const TOUS = { blocs: "Tous les blocs", capacites: "Toutes les capacités", elements: "Tous les éléments", adversaires: "Tous les adversaires", types: "Tous les types" };
// Ce que le champ de recherche annonce (js/banque/recherche.js).
const OU_CHERCHER = {
  blocs: "Nom ou description",
  capacites: "Nom ou description",
  elements: "Nom ou description",
  adversaires: "Nom, type, équipement ou capacité",
  types: "Nom",
};

const panneaux = new Map();
let banqueDesPanneaux = null;

function detail(contexte, categorie, entree) {
  if (categorie === "blocs") return [entree.type, compte(entree.capacites.length, "capacité", "capacités")].filter(Boolean).join(" · ");
  if (categorie === "capacites") {
    const puissances = entree.variantes.map((v) => v.puissance).filter(Boolean);
    return puissances.length > 1 ? `puissances ${puissances.join(", ")}` : puissances.length ? `puissance ${puissances[0]}` : "";
  }
  // Ses types tels qu'il les écrit, multiplicateur compris : « Humain/Brigand[2] ».
  if (categorie === "adversaires") return entree.types || "sans type";
  if (categorie === "types") return compte(contexte.etat.index.adversaires().utilisateurs(entree.nom).length, "adversaire", "adversaires");
  return entree.description;
}

function creerPanneau(contexte, categorie) {
  const entrees = listeDe(contexte.etat.banque, categorie);
  const liste = el("ul", { classe: "liste-entrees" });
  const nombre = el("p", { classe: "secondaire-texte petit", role: "status" });
  const recherche = el("input", {
    type: "search",
    id: `recherche-${categorie}`,
    classe: "champ",
    autocomplete: "off",
    autocapitalize: "none",
    spellcheck: "false",
    placeholder: OU_CHERCHER[categorie],
  });
  const panneau = { noeud: null, courant: null, liens: new Map() };

  const remplir = () => {
    const trouvees = filtrer(entrees, recherche.value, TEXTES[categorie]);
    panneau.liens.clear();
    liste.replaceChildren(
      ...trouvees.map((entree) => {
        const lien = el("a", { href: adresseFiche(categorie, entree.nom) }, el("span", {}, entree.nom), el("span", { classe: "detail" }, detail(contexte, categorie, entree)));
        panneau.liens.set(entree.nom, lien);
        return el("li", {}, lien);
      }),
    );
    nombre.textContent = recherche.value.trim()
      ? `${compte(trouvees.length, NOMS[categorie][0], NOMS[categorie][1])} sur ${entrees.length}`
      : compte(entrees.length, NOMS[categorie][0], NOMS[categorie][1]);
    marquer(panneau, panneau.courant);
  };
  recherche.addEventListener("input", remplir);

  panneau.noeud = el(
    "nav",
    { classe: "navigation-liste", "aria-label": CATEGORIES[categorie].titre },
    el(
      "ul",
      { classe: "onglets" },
      Object.entries(CATEGORIES).map(([autre, { titre }]) =>
        el("li", {}, el("a", { href: adresseListe(autre), "aria-current": autre === categorie ? "page" : null }, titre)),
      ),
    ),
    el("label", { for: `recherche-${categorie}` }, `Rechercher parmi les ${NOMS[categorie][1]}`),
    recherche,
    nombre,
    liste,
  );
  remplir();
  return panneau;
}

function marquer(panneau, nom) {
  panneau.courant = nom;
  for (const [nomLien, lien] of panneau.liens) {
    if (nomLien === nom) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }
}

function panneauDe(contexte, categorie, nom) {
  if (banqueDesPanneaux !== contexte.etat.banque) {
    panneaux.clear();
    banqueDesPanneaux = contexte.etat.banque;
  }
  if (!panneaux.has(categorie)) panneaux.set(categorie, creerPanneau(contexte, categorie));
  const panneau = panneaux.get(categorie);
  marquer(panneau, nom);
  return panneau.noeud;
}

/** L'écran d'une liste, ou d'une fiche avec sa liste à côté. */
export function afficher(contexte, route) {
  const { categorie } = route;
  const avecFiche = route.ecran === "fiche";
  const manque = manqueDe(contexte.etat.banque, categorie);
  let fiche;
  if (avecFiche) fiche = FICHES[categorie].afficher(contexte, route.nom);
  else {
    titrer(CATEGORIES[categorie].titre);
    const aucune = listeDe(contexte.etat.banque, categorie).length === 0;
    fiche = el("p", { classe: "secondaire-texte" }, aucune ? `Cette banque n'a aucun ${NOMS[categorie][0]}.` : `Choisissez ${CATEGORIES[categorie].un} dans la liste.`);
  }
  const panneau = panneauDe(contexte, categorie, avecFiche ? route.nom : null);
  const entete = avecFiche ? null : el("h1", { tabindex: "-1" }, CATEGORIES[categorie].titre);
  // Ce qui manque à la banque se dit une fois, du côté que montre un
  // téléphone : la liste, ou la fiche. Seule la fiche s'imprime (§ 16.6).
  const avis = manque ? el("p", { classe: "message" }, manque) : null;
  return el(
    "div",
    { classe: `consultation${avecFiche ? " avec-fiche" : ""}` },
    el("div", { classe: "panneau-liste ne-pas-imprimer" }, entete, avecFiche ? null : avis, panneau),
    el(
      "div",
      { classe: "panneau-fiche" },
      avecFiche ? el("p", { classe: "retour ne-pas-imprimer" }, el("a", { href: adresseListe(categorie) }, TOUS[categorie])) : null,
      avecFiche ? avis : null,
      fiche,
    ),
  );
}
