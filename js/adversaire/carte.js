// La carte d'un adversaire (SPECIFICATION.md, § 16.5).
//
// La carte que le meneur imprime et annote à la table : l'en-tête, la bande
// du d20 avec l'armure et l'endurance de chaque zone, le corps, les
// capacités, puis le nombre d'actions, le souffle, l'attaque et la défense.
// Elle suit la maquette du lot 3 (plans/maquette_adversaires.html, hors
// dépôt), dans css/adversaire.css. Sa hauteur est variable : autant de lignes
// de capacités qu'il en faut, quatre au moins.
//
// Elle affiche l'adversaire résolu (resolution.js) sans rien recalculer, et
// ne dit pas d'où vient une valeur : la provenance (« de Saucier ×2 ») est
// l'affaire de la vue lecture, à l'écran (§ 16.6).

import { compte, el } from "../ecrans/dom.js";
import { coutEcrit } from "../fiche/lecture.js";
import { DERNIERE_FACE, PREMIERE_FACE } from "./notation.js";

export const CLASSE_CARTE = "carte-adversaire";
export const CLASSE_CARTES = "cartes-adversaires";

// La largeur de la carte, celle de css/adversaire.css, et sa mesure en
// pixels CSS (96 par pouce de 25,4 mm) : l'écran en tire l'échelle de la
// carte, comme il le fait des 794 pixels de la fiche (§ 15.5).
export const LARGEUR_CARTE_MM = 190;
export const LARGEUR_CARTE = (LARGEUR_CARTE_MM * 96) / 25.4;

// Les lignes de capacités que la carte montre au moins : des lignes vides
// complètent, où le meneur écrit.
export const LIGNES_MINIMUM = 4;
// Jusqu'à ce nombre de faces, une zone n'a pas la place de son nom.
const FACES_ABREGEES = 2;

/**
 * Le nom d'une zone tel que la carte l'écrit : une zone de deux faces au
 * plus s'abrège en initiales si son nom a plusieurs mots (« Jambe gauche » :
 * « J. g. ») ; un nom d'un seul mot reste entier. Un nombre reste entier
 * aussi : « Patte 12 » s'écrit « P. 12 », et non « P. 1. » comme « Patte 1 ».
 */
export function abregerZone(nom, faces) {
  const mots = String(nom ?? "").trim().split(/\s+/u).filter(Boolean);
  if (faces > FACES_ABREGEES || mots.length < 2) return mots.join(" ");
  return mots.map((mot) => (/^\d+$/u.test(mot) ? mot : `${[...mot][0]}.`)).join(" ");
}

/** Le multiplicateur d'un adversaire, tel qu'il se lit : « ×2 », « ×1,4 ». */
export const ecrireMultiplicateur = (multiplicateur) => `×${multiplicateur}`;

/**
 * Les classes d'un adversaire, telles que la carte les écrit : « Commis,
 * Rôtisseur ×1,4 » ; rien pour un adversaire sans classe. La fiche vivante du
 * simulateur de combat les écrit de même (§ 17) : c'est pourquoi la phrase
 * se fabrique ici, une seule fois.
 */
export function ecrireTypes(resolu) {
  if (!resolu.types.length) return "";
  return `${resolu.types.map((type) => type.nom).join(", ")}${resolu.multiplicateur ? ` ${ecrireMultiplicateur(resolu.multiplicateur)}` : ""}`;
}

/** Le coût d'une capacité sur la carte : « 5 souffle », « 1 souffle · 1 lien » ; rien quand elle ne coûte rien. */
export function ecrireCout(cout) {
  const ecrit = coutEcrit(cout);
  return ecrit === "0" ? "" : ecrit;
}

/**
 * Les dégâts d'une capacité d'arme, entre parenthèses : « (8/16/25) »,
 * « (3/8/20, portée 1) ». Quand plusieurs armes la donnent, chacune précède
 * les siens. Rien pour une capacité sans arme.
 */
export function ecrireDegats(armes) {
  if (!armes?.length) return "";
  const ecrits = armes.map((arme) => `${armes.length > 1 ? `${arme.nom} ` : ""}${arme.degats}${arme.portee ? `, portée ${arme.portee}` : ""}`);
  return `(${ecrits.join(" · ")})`;
}

/**
 * Les deux classes qui placent une case sur la bande du d20 : sa première
 * face et son étendue (css/adversaire.css). Elles ne se fabriquent que
 * d'entiers vérifiés, sinon null : une banque se publie malgré ses erreurs
 * (§ 6.3), et une classe sans règle laisserait la case se placer seule.
 */
export function classesDePlace(debut, faces) {
  const entiers = Number.isInteger(debut) && Number.isInteger(faces);
  return entiers && debut >= PREMIERE_FACE && faces >= 1 && debut + faces - 1 <= DERNIERE_FACE ? `debut-${debut} etendue-${faces}` : null;
}

// Des morceaux d'une ligne, séparés. Le séparateur se refabrique à chaque
// fois : un même nœud, ajouté deux fois, ne ferait que changer de place.
const entre = (morceaux, separateur) => morceaux.flatMap((morceau, i) => (i === 0 ? [morceau] : [separateur(), morceau]));
const espace = () => " ";

const decor = (classe) => el("span", { classe, "aria-hidden": "true" });

function tete(resolu, numero) {
  return el(
    "div",
    { classe: "carte-tete" },
    decor("carte-losange"),
    el("span", { classe: "carte-genre" }, "Adversaire"),
    el("span", { classe: "carte-nom" }, resolu.nom, numero === null ? null : [" ", el("span", { classe: "carte-numero" }, `n° ${numero}`)]),
    decor("carte-filet"),
    decor("carte-losange"),
  );
}

function caseDeZone(zone, rangee, valeur) {
  const place = classesDePlace(zone.debut, zone.faces);
  if (!place) return null;
  return el(
    "div",
    { classe: `carte-zone rangee-${rangee} ${place}${zone.faces === 1 ? " etroite" : ""}` },
    el("span", { classe: "carte-nom-zone" }, abregerZone(zone.nom, zone.faces)),
    el("span", { classe: "carte-valeur" }, valeur),
  );
}

// La bande du d20 : une grille de vingt et une colonnes, l'étiquette de la
// rangée puis les vingt faces. La face 1 est la contre-attaque, d'office,
// sur les trois rangées ; les zones se partagent les faces 2 à 20.
function bande(resolu) {
  const etiquette = (rangee, texte) => el("div", { classe: `carte-etiquette rangee-${rangee}` }, texte);
  return el(
    "div",
    { classe: "carte-bande" },
    el("div", { classe: "carte-coin" }),
    Array.from({ length: DERNIERE_FACE }, (_, i) => el("div", { classe: "carte-face" }, i + 1)),
    el("div", { classe: "carte-contre" }, el("span", {}, "Contre-attaque")),
    etiquette("armure", "Armure"),
    resolu.zones.map((zone) => caseDeZone(zone, "armure", zone.armure)),
    etiquette("resistance", "Endurance"),
    resolu.zones.map((zone) => caseDeZone(zone, "resistance", zone.resistance)),
    etiquette("corps", "Corps"),
    el(
      "div",
      { classe: `carte-corps rangee-corps ${classesDePlace(PREMIERE_FACE, DERNIERE_FACE - PREMIERE_FACE + 1)}` },
      Array.from({ length: resolu.corps }, () => decor("carte-case")),
      el("span", { classe: "carte-valeur" }, resolu.corps),
    ),
  );
}

// La première ligne des capacités : les classes, les maîtrises, l'équipement.
// Un segment sans rien s'omet, avec son libellé ; null quand tous manquent.
function resume(resolu) {
  const segments = [];
  if (resolu.types.length) segments.push(["Classes", ecrireTypes(resolu)]);
  if (resolu.maitrises.length) {
    segments.push(["Maîtrises", entre(resolu.maitrises.map((maitrise) => [maitrise.nom, " ", el("span", { classe: "carte-rang" }, `[${maitrise.rang}]`)]), () => ", ")]);
  }
  if (resolu.equipement.length) {
    const objets = resolu.equipement.map((objet) => {
      if (objet.genre === "absent") return [objet.nom, " ", el("span", { classe: "carte-precision" }, "(introuvable)")];
      const pieces = objet.genre === "pack" ? [" ", el("span", { classe: "carte-precision" }, `(${compte(objet.pieces.length, "pièce", "pièces")})`)] : null;
      return [`${objet.nom} [${objet.qualite}]`, pieces];
    });
    segments.push(["Équipement", entre(objets, () => " · ")]);
  }
  if (!segments.length) return null;
  const ecrits = segments.map(([libelle, contenu]) => [el("span", { classe: "carte-libelle" }, libelle), " ", contenu]);
  return el("div", { classe: "carte-ligne carte-resume" }, entre(ecrits, () => [" ", el("span", { classe: "carte-separateur" }, "—"), " "]));
}

function ligneCapacite(capacite) {
  const nom = el("span", { classe: "carte-nom-capacite" }, capacite.nom);
  if (capacite.absente) return el("div", { classe: "carte-ligne" }, nom, " ", el("span", { classe: "carte-absente" }, "introuvable dans Capacites"));
  const morceaux = [nom];
  if (capacite.evolue) morceaux.push(el("span", { classe: "carte-rang" }, `[${capacite.rang}]`));
  const degats = ecrireDegats(capacite.armes);
  if (degats) morceaux.push(el("span", { classe: "carte-degats" }, degats));
  const cout = ecrireCout(capacite.cout);
  if (cout) morceaux.push(el("span", { classe: "carte-cout" }, cout));
  if (capacite.desavantage.length) {
    morceaux.push(el("span", { classe: "carte-desavantage" }, "désavantage"));
    // Le désavantage ne vient que de certains des blocs qui la donnent : lesquels.
    if (!capacite.desavantageEntier) morceaux.push(el("span", { classe: "carte-precision" }, `(${capacite.desavantage.join(", ")})`));
  }
  const descriptions = capacite.descriptions.filter((description) => description.texte);
  for (const { source, texte } of descriptions) {
    morceaux.push(el("span", { classe: "carte-description" }, descriptions.length > 1 && source ? `— ${source} : ${texte}` : `— ${texte}`));
  }
  return el("div", { classe: "carte-ligne" }, entre(morceaux, espace));
}

function capacites(resolu) {
  const vides = Math.max(0, LIGNES_MINIMUM - resolu.capacites.length);
  return el(
    "div",
    { classe: "carte-capacites" },
    el("div", { classe: "carte-titre" }, "Capacités"),
    resume(resolu),
    resolu.capacites.map(ligneCapacite),
    Array.from({ length: vides }, () => el("div", { classe: "carte-ligne carte-ligne-vide" })),
  );
}

// La colonne de droite. Une valeur que rien ne donne (null) laisse sa place
// vide : le meneur l'écrit à la main.
function nombres(resolu) {
  const valeur = (lu) => el("span", { classe: "carte-valeur" }, lu?.valeur ?? "");
  const nombre = (classe, libelle, lu) => el("div", { classe: `carte-nombre ${classe}` }, libelle, valeur(lu));
  const carre = (classe, libelle, lu) => el("div", { classe: `carte-carre ${classe}` }, el("span", { classe: "carte-libelle" }, libelle), valeur(lu));
  return el(
    "div",
    { classe: "carte-droite" },
    nombre("carte-actions", "Nombre d'actions : ", resolu.actions),
    nombre("carte-souffle", "Souffle : ", resolu.souffle),
    el("div", { classe: "carte-carres" }, carre("carte-attaque", "Attaque", resolu.attaque), carre("carte-defense", "Défense", resolu.defense)),
  );
}

/**
 * La carte d'un adversaire résolu. numero : son numéro d'exemplaire dans une
 * rencontre (« n° 2 »), ou null quand il est seul de son nom.
 */
export function carte(resolu, { numero = null } = {}) {
  return el("article", { classe: CLASSE_CARTE }, tete(resolu, numero), bande(resolu), el("div", { classe: "carte-bas" }, capacites(resolu), nombres(resolu)));
}

/**
 * Les cartes d'une rencontre, l'une sous l'autre, dans l'ordre donné :
 * liste de { resolu, numero }. C'est ce conteneur qui se met à l'échelle à
 * l'écran (--echelle) et qui porte la mise en page de l'impression : une
 * carte seule s'y place aussi.
 */
export function cartes(liste) {
  return el("div", { classe: CLASSE_CARTES }, liste.map(({ resolu, numero = null }) => carte(resolu, { numero })));
}
