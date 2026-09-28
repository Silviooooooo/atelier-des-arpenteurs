// La fiche d'un élément (SPECIFICATION.md, § 9).
//
// Ses paramètres reçus et sa description ; puis « porté par » : les blocs
// et les capacités qui le citent, et les blocs qui transmettent un
// paramètre qu'il reçoit (§ 6.3, A4).

import { adresseFiche } from "../routes.js";
import { brut, el, introuvable, liste, section, titre } from "./dom.js";

function corps(element) {
  const lieu = { feuille: "Eléments", ligne: element.brut.ligne };
  const recus = element.parametres_recus.map((recu) => (typeof recu === "string" ? el("span", { classe: "valeur" }, `{${recu}}`) : brut(recu.brut, lieu)));
  return [
    section("Paramètres reçus", liste(recus), "Aucun paramètre reçu."),
    section(
      "Description",
      element.description.trim() ? el("p", { classe: "description" }, element.description) : null,
      "Pas de description.",
    ),
  ];
}

export function afficher(contexte, nom) {
  const { index } = contexte.etat;
  const elements = index.entrees("elements", nom);
  if (!elements.length) return introuvable(index, "elements", nom);
  const { blocs, capacites } = index.portePar(nom);
  const liens = (categorie, noms) => noms.map((autre) => el("a", { href: adresseFiche(categorie, autre) }, autre));
  return el(
    "article",
    { classe: "fiche" },
    titre(nom),
    elements.length > 1 ? el("p", { classe: "message" }, `Ce nom désigne ${elements.length} éléments : c'est un doublon (E3), ils se suivent ci-dessous.`) : null,
    elements.map(corps),
    el(
      "section",
      {},
      el("h2", {}, "Porté par"),
      blocs.length + capacites.length === 0 ? el("p", { classe: "secondaire-texte" }, "Rien ne le porte.") : null,
      blocs.length ? [el("h3", {}, "Blocs"), liste(liens("blocs", blocs))] : null,
      capacites.length ? [el("h3", {}, "Capacités"), liste(liens("capacites", capacites))] : null,
    ),
  );
}
