// La fiche d'une capacité (SPECIFICATION.md, § 9).
//
// Ses variantes par puissance, avec leurs coûts, leurs éléments propres et
// leur description ; puis « octroyée par » : les blocs qui la citent dans
// leur colonne des capacités (§ 6.3, A3).

import { adresseFiche } from "../routes.js";
import { brut, el, enumerer, introuvable, liste, notes, renvoi, section, titre } from "./dom.js";

function variante(index, v) {
  const lieu = { feuille: "Capacites", ligne: v.brut.ligne };
  const couts = [
    ["Coût en souffle", v.cout_souffle],
    ["Coût en lien", v.cout_lien],
  ].filter(([, valeur]) => valeur !== "");
  const propres = v.elements.map((element) =>
    element.brut !== undefined
      ? brut(element.brut, lieu)
      : [renvoi(index, "elements", element.nom, lieu), element.valeur ? el("span", { classe: "valeur" }, `[${element.valeur}]`) : null],
  );
  return el(
    "section",
    { classe: "variante" },
    el("h2", {}, `Puissance ${v.puissance || "—"}`),
    couts.length ? el("dl", { classe: "couts" }, couts.map(([terme, valeur]) => el("div", {}, el("dt", {}, terme), el("dd", {}, valeur)))) : null,
    propres.length ? el("p", {}, "Éléments propres : ", enumerer(propres)) : null,
    v.description.trim() ? el("p", { classe: "description" }, v.description) : el("p", { classe: "secondaire-texte" }, "Pas de description."),
    notes(v.notes),
  );
}

export function afficher(contexte, nom) {
  const { index } = contexte.etat;
  const [capacite] = index.entrees("capacites", nom);
  if (!capacite) return introuvable(index, "capacites", nom);
  const octroi = index.octroyeePar(nom).map(({ bloc, forme }) => [
    el("a", { href: adresseFiche("blocs", bloc) }, bloc),
    forme === "choix" ? " (au choix)" : forme === "facultatif" ? " (facultatif)" : null,
  ]);
  return el(
    "article",
    { classe: "fiche" },
    titre(nom),
    capacite.variantes.map((v) => variante(index, v)),
    section("Octroyée par", liste(octroi), "Aucun bloc ne l'octroie."),
  );
}
