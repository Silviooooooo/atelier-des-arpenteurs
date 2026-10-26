// La fiche d'une classe d'adversaire (SPECIFICATION.md, § 16.6).
//
// Une classe ne se joue pas : elle donne ses valeurs aux adversaires qui la
// citent (§ 16.2). La fiche montre sa ligne telle que la résolution la lit
// (js/adversaire/resolution.js), cellule par cellule : une cellule vide est
// dite « hérite », et « // » en tête d'une liste se dit en clair. Puis les
// adversaires qui l'utilisent. Rien n'y est multiplié ni arrondi : le
// multiplicateur est celui de chaque adversaire.

import { FEUILLE, NOMBRES, ecrireQualite } from "../adversaire/resolution.js";
import { adresseFiche } from "../routes.js";
import { brut, compte, el, enumerer, introuvable, liste, renvoiCasse, section, titre, versAnomalie } from "./dom.js";

const LIBELLES = { actions: "Nombre d'actions", souffle: "Souffle", attaque: "Attaque", defense: "Défense" };

const herite = () => el("p", { classe: "secondaire-texte" }, "hérite");
const note = (texte) => el("span", { classe: "secondaire-texte petit" }, ` — ${texte}`);
const crochets = (texte) => el("span", { classe: "valeur" }, `[${texte}]`);

// Une colonne de liste : « hérite », « aucun », ou ses entrées, précédées
// de ce que dit « // ». Un morceau que la notation n'a pas compris (E6)
// s'affiche tel qu'elle le rapporte, avec son anomalie.
function listeLue(lue, entrees, lieu, aucun) {
  if (lue.genre !== "liste") return herite();
  const lignes = [...entrees, ...lue.defauts.map((defaut) => [defaut, " (", versAnomalie(lieu, "notation non comprise, voir l'anomalie"), ")"])];
  return [
    lue.reprise ? el("p", {}, lignes.length ? "Reprend la liste héritée, et ajoute :" : "Reprend la liste héritée, sans rien ajouter.") : null,
    lignes.length ? liste(lignes) : lue.reprise ? null : el("p", {}, aucun),
  ];
}

function corps(index, type) {
  const lieu = { feuille: FEUILLE, ligne: type.brut?.ligne ?? null };
  const { lue } = index.adversaires().analyser(type, "type");

  let localisation = herite();
  if (lue.localisation.genre === "zones") {
    if (lue.localisation.defauts.length) localisation = el("p", {}, brut(type.localisation, lieu));
    else if (!lue.localisation.zones.length) localisation = el("p", {}, "aucune");
    else {
      localisation = liste(
        lue.localisation.zones.map((zone) => [
          zone.nom,
          zone.debut === zone.fin ? ` : face ${zone.debut}` : ` : faces ${zone.debut} à ${zone.fin}`,
          zone.approchee ? note("reconnue par approximation") : null,
        ]),
      );
    }
  }

  const nombres = NOMBRES.map((champ) => {
    const lu = lue.nombres[champ];
    const valeur = lu.genre === "valeur" ? ecrireQualite(lu.valeur) : lu.genre === "illisible" ? brut(lu.ecrit, lieu) : "hérite";
    return el("div", {}, el("dt", {}, LIBELLES[champ]), el("dd", {}, valeur));
  });

  const objets = (lue.equipement.objets ?? []).map((objet) => {
    if (objet.genre === "absent") return renvoiCasse(objet.nom, lieu);
    const qualite = [" ", crochets(ecrireQualite(objet.qualite)), objet.qualiteEcrite ? null : note("qualité par défaut")];
    if (objet.genre !== "pack") return [el("a", { href: adresseFiche("blocs", objet.nom) }, objet.nom), qualite];
    const pieces = objet.pack.pieces.map((piece) => el("a", { href: adresseFiche("blocs", piece.nom) }, piece.nom));
    return [objet.nom, qualite, ` — ${compte(pieces.length, "pièce", "pièces")} : `, enumerer(pieces)];
  });

  const capacites = (lue.capacites.citees ?? []).map((citee) =>
    citee.capacite ? [el("a", { href: adresseFiche("capacites", citee.nom) }, citee.nom), " ", citee.rang === null ? note("rang par défaut") : crochets(citee.rang)] : renvoiCasse(citee.nom, lieu),
  );

  const anomalies = lieu.ligne ? index.anomaliesDe(lieu.feuille, lieu.ligne) : [];
  return [
    section("Localisation", localisation, null),
    section("Nombres", el("dl", { classe: "couts" }, nombres), null),
    section("Équipement", listeLue(lue.equipement, objets, lieu, "aucun"), null),
    section("Capacités", listeLue(lue.capacites, capacites, lieu, "aucune"), null),
    anomalies.length ? el("p", { classe: "petit" }, versAnomalie(lieu, `${compte(anomalies.length, "anomalie", "anomalies")} sur cette ligne (${FEUILLE}, ligne ${lieu.ligne})`)) : null,
  ];
}

export function afficher(contexte, nom) {
  const { index } = contexte.etat;
  const types = index.entrees("types", nom);
  if (!types.length) return introuvable(index, "types", nom);
  const utilisateurs = index
    .adversaires()
    .utilisateurs(nom)
    .map((adversaire) => el("a", { href: adresseFiche("adversaires", adversaire) }, adversaire));
  // Un doublon de classes du même nom écrit : l'héritage prend la première
  // (§ 16.2). Quand un signe invisible en distingue une (§ 6.3), chacune
  // garde les adversaires qui écrivent son nom : « la première » de la page
  // serait fausse sous l'un des deux noms.
  const heritage = types.every((type) => type.nom === nom) ? "Les adversaires héritent de la première." : "Chaque adversaire hérite de la première dont il écrit le nom exact.";
  return el(
    "article",
    { classe: "fiche" },
    titre(nom),
    el("p", { classe: "secondaire-texte" }, "Classe d'adversaires. Une cellule vide hérite : la valeur vient d'une classe appliquée avant elle, ou de la ligne de l'adversaire."),
    types.length > 1 ? el("p", { classe: "message" }, `Ce nom désigne ${types.length} classes : c'est un doublon (E16), elles se suivent ci-dessous. ${heritage}`) : null,
    types.map((type) => corps(index, type)),
    section("Adversaires qui l'utilisent", liste(utilisateurs), "Aucun adversaire ne l'utilise."),
  );
}
