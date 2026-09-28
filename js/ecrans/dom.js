// Fabrique des éléments de la page (SPECIFICATION.md, § 10.1).
//
// Aucune donnée n'y entre comme HTML : chaque texte devient un nœud texte,
// chaque attribut passe par setAttribute. Une cellule de classeur qui
// contiendrait du HTML s'affiche donc telle quelle, et ne s'exécute jamais.

import { CATEGORIES, adresseAnomalies, adresseFiche } from "../routes.js";

/**
 * el("a", { href: "#/", classe: "marque", onclick: f }, "texte", noeud…).
 * Un attribut null, undefined ou false est omis ; true s'écrit vide.
 */
export function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (nom === "classe") noeud.className = valeur;
    else if (nom.startsWith("on") && typeof valeur === "function") noeud.addEventListener(nom.slice(2), valeur);
    else noeud.setAttribute(nom, valeur === true ? "" : String(valeur));
  }
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    noeud.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return noeud;
}

/** Le titre de l'onglet du navigateur. */
export function titrer(texte) {
  const nom = "L'Atelier des Arpenteurs";
  document.title = texte && texte !== nom ? `${texte} — ${nom}` : nom;
}

/** Un titre de premier niveau, qui reçoit le focus au changement d'écran. */
export function titre(texte) {
  titrer(texte);
  return el("h1", { tabindex: "-1" }, texte);
}

/** Un nombre et son nom, accordé : « 1 bloc », « 0 bloc », « 3 blocs ». */
export function compte(nombre, singulier, pluriel) {
  return `${nombre} ${nombre > 1 ? pluriel : singulier}`;
}

/**
 * Un renvoi vers une fiche : un lien si le nom se résout, sinon le texte
 * barré, suivi d'un lien vers l'anomalie de la ligne qui le porte (§ 9).
 */
export function renvoi(index, categorie, nom, lieu, texte = null) {
  const trouve = index.resoudre(categorie, nom);
  if (trouve) return el("a", { href: adresseFiche(categorie, trouve) }, texte ?? trouve);
  return el(
    "span",
    {},
    el("s", { classe: "renvoi-casse" }, texte ?? nom),
    " (",
    el("a", { href: adresseAnomalies(lieu.feuille, lieu.ligne) }, "introuvable, voir l'anomalie"),
    ")",
  );
}

/** Une liste de nœuds séparés par des virgules. */
export function enumerer(noeuds, separateur = ", ") {
  return noeuds.flatMap((noeud, i) => (i === 0 ? [noeud] : [separateur, noeud]));
}

/** Un lien vers les anomalies d'une ligne. */
export function versAnomalie(lieu, texte = "voir l'anomalie") {
  return el("a", { href: adresseAnomalies(lieu.feuille, lieu.ligne) }, texte);
}

/** Un morceau que la notation n'a pas compris (E6, A7) : tel qu'écrit, avec son anomalie. */
export function brut(texte, lieu) {
  return el("span", {}, el("span", { classe: "valeur" }, texte), " (", versAnomalie(lieu, "notation non comprise, voir l'anomalie"), ")");
}

/** Une fiche demandée par un nom qui n'existe pas ; le nom approché s'il y en a un. */
export function introuvable(index, categorie, nom) {
  const proche = index.resoudre(categorie, nom);
  return el(
    "article",
    { classe: "fiche" },
    titre(nom),
    el("p", { classe: "message" }, `Rien ne porte ce nom parmi les ${CATEGORIES[categorie].titre.toLowerCase()}.`),
    proche && proche !== nom ? el("p", {}, "Vouliez-vous dire ", el("a", { href: adresseFiche(categorie, proche) }, proche), " ?") : null,
  );
}

/** Une section de fiche : un titre, puis son contenu, ou une phrase quand il est vide. */
export function section(intitule, contenu, siVide) {
  const vide = contenu === null || (Array.isArray(contenu) && contenu.length === 0);
  if (vide && siVide === null) return null;
  return el("section", {}, el("h2", {}, intitule), vide ? el("p", { classe: "secondaire-texte" }, siVide) : contenu);
}

/** Les notes de conception, en retrait (§ 9). */
export function notes(texte) {
  return texte && texte.trim() ? el("div", { classe: "notes" }, el("p", { classe: "petit" }, "Notes de conception"), texte) : null;
}

/** Une liste à puces, ou null si elle est vide. */
export function liste(items) {
  return items.length ? el("ul", {}, items.map((item) => el("li", {}, item))) : null;
}
