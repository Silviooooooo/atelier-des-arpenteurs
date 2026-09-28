// La fiche d'un bloc (SPECIFICATION.md, § 9).
//
// Ses éléments et ses capacités en liens (« au choix : … », « facultatif :
// … »), ses paramètres sous leur nom affiché (§ 5.2), et ses notes de
// conception en retrait. Un renvoi cassé se barre et mène à son anomalie ;
// un morceau que la notation n'a pas compris s'affiche tel qu'écrit.

import { brut, el, enumerer, introuvable, liste, notes, renvoi, section, titre, versAnomalie } from "./dom.js";

function corps(index, bloc) {
  const lieu = { feuille: "Blocs", ligne: bloc.brut.ligne };
  const elements = bloc.elements.map((element) =>
    element.brut !== undefined
      ? brut(element.brut, lieu)
      : [renvoi(index, "elements", element.nom, lieu), element.cible ? [" pour ", renvoi(index, "capacites", element.cible, lieu)] : null],
  );
  const capacites = bloc.capacites.map((capacite) => {
    if (capacite.brut !== undefined) return brut(capacite.brut, lieu);
    if (capacite.forme === "simple") return renvoi(index, "capacites", capacite.nom, lieu);
    const options = capacite.options.map((option) => renvoi(index, "capacites", option, lieu));
    return capacite.forme === "choix" ? ["Au choix : ", enumerer(options, " ou ")] : ["Facultatif : ", enumerer(options)];
  });
  const parametres = bloc.parametres.map((parametre) =>
    parametre.brut !== undefined
      ? brut(parametre.brut, lieu)
      : [
          el("span", { classe: "valeur" }, `${index.nomAffiche(parametre.nom)}[${parametre.valeur}]`),
          parametre.cible ? [" pour ", renvoi(index, "capacites", parametre.cible, lieu)] : null,
          el("span", { classe: "secondaire-texte petit" }, ` — transmis comme {${parametre.nom}:${parametre.valeur}}`),
        ],
  );
  const anomalies = index.anomaliesDe(lieu.feuille, lieu.ligne);
  return [
    section("Éléments", liste(elements), "Aucun élément."),
    section("Capacités", liste(capacites), "Aucune capacité."),
    section("Paramètres", liste(parametres), "Aucun paramètre."),
    notes(bloc.notes),
    anomalies.length
      ? el("p", { classe: "petit" }, versAnomalie(lieu, `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} sur cette ligne (Blocs, ligne ${lieu.ligne})`))
      : null,
  ];
}

export function afficher(contexte, nom) {
  const { index } = contexte.etat;
  const blocs = index.entrees("blocs", nom);
  if (!blocs.length) return introuvable(index, "blocs", nom);
  return el(
    "article",
    { classe: "fiche" },
    titre(nom),
    blocs.length > 1 ? el("p", { classe: "message" }, `Ce nom désigne ${blocs.length} blocs : c'est un doublon (E3), ils se suivent ci-dessous.`) : null,
    blocs.map((bloc) => corps(index, bloc)),
  );
}
