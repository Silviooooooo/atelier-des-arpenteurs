// Le recto et le verso imprimables d'un personnage (SPECIFICATION.md,
// § 15.4).
//
// La fiche de la spécification 1.7, dessinée et mesurée dans la maquette de
// l'auteur (26/10/2026) : sa mise en page, ses jetons et ses polices dans
// css/fiche.css. Le recto a des zones de hauteur fixe (l'arme, l'armure, les
// capacités) et des rubriques qui prennent la place qui reste (l'équipement,
// les liens) ; le verso, un seul bloc « Historique », en vignettes. Rien ne
// passe d'une page à l'autre : ce qui ne tient pas se cache, et l'écran le
// dit (js/ecrans/fiche_personnage.js, qui mesure).

import { dateLisible } from "../banque/dates.js";
import { cle } from "../banque/noms.js";
import { el } from "../ecrans/dom.js";
import { typeObjet } from "../personnage/calcul.js";
import { TYPES_OBJET, ZONES } from "../personnage/regles.js";
import { reussitesLisibles } from "./lecture.js";
import { silhouette } from "./silhouette.js";

// Les éléments propres qui servent au créateur et au calcul, jamais écrits
// sur la fiche ; les autres sont ses « éléments notables » (§ 12).
const ELEMENTS_TUS = new Set(
  ["Style de combat", "Maîtrise", "Espèce", "Archétype", "Primordial", "Arme", "Armure", "Lourde", "Agile", "Précise", "Dégâts", "Qualité", "Défense", "Consommable", "Équipement"].map(cle),
);

// Les vignettes « Évènement » que le verso prépare ; la mesure retire celles
// qui ne tiennent pas, une au moins restant.
export const VIGNETTES_POINT = 14;

// ─── Ce que la fiche écrit ──────────────────────────────────────────────────

/**
 * Les éléments notables d'une capacité : « passif », « JA (parole,
 * empathie) ». La première lettre passe en minuscule, sauf un sigle.
 */
export function elementsNotables(elements) {
  return elements
    .map((element) => {
      const lu = String(element).match(/^([^[]+)(?:\[(.*)\])?$/);
      return lu ? { nom: lu[1].trim(), valeur: lu[2] ?? "" } : { nom: String(element), valeur: "" };
    })
    .filter((element) => !ELEMENTS_TUS.has(cle(element.nom)))
    .map(({ nom, valeur }) => `${/^.\p{Ll}/u.test(nom) ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom}${valeur ? ` (${valeur})` : ""}`);
}

/** Le coût d'une capacité : « 1 », « 0 · 1 lien », « 0 · 3 liens » ; un souffle vide vaut 0. */
export function coutEntreParentheses(cout) {
  if (!cout) return "";
  const souffle = cout.souffle === "" || cout.souffle === null || cout.souffle === undefined ? "0" : String(cout.souffle);
  const lien = cout.lien === "" || cout.lien === null || cout.lien === undefined || cout.lien === "0" ? null : String(cout.lien);
  return lien ? `${souffle} · ${lien} ${lien === "1" ? "lien" : "liens"}` : souffle;
}

/** La ligne ARME : « nom (A/B/C), type, dé », puis la portée s'il y en a une. */
export function resumeArme(attaque) {
  const parties = [`${attaque.nom}${attaque.degats ? ` (${attaque.degats.join("/")})` : ""}`];
  // Sans type ou sans dé (un brouillon, les mains nues), ni l'un ni l'autre.
  if (attaque.typeObjet && attaque.de) parties.push(TYPES_OBJET[attaque.typeObjet].nom, attaque.de.de);
  if (attaque.portee && attaque.portee !== "0") parties.push(`portée ${attaque.portee}`);
  return parties.join(", ");
}

// Le type d'une pièce portée, par son code ; null pour une pièce sans type.
const typeDe = (objet) => typeObjet(objet.bloc).type ?? null;
const nomDuType = (type) => (type ? TYPES_OBJET[type].nom : "sans type");
// Les types des pièces, rangés lourde, agile, précise, puis « sans type ».
const ORDRE_TYPES = [...Object.keys(TYPES_OBJET), null];
const typesRanges = (pieces) => ORDRE_TYPES.filter((type) => pieces.some((piece) => typeDe(piece) === type));

/** La ligne ARMURE : « lourde (40,20,20,20,20,10), d12 », « aucune, d10 ». */
export function resumeArmure(fiche) {
  const pieces = fiche.equipement.filter((o) => o.porte);
  const de = fiche.defense.de?.de ?? null;
  const types = pieces.length ? `${typesRanges(pieces).map(nomDuType).join(" et ")} (${ZONES.map((z) => fiche.armure.zones[z.code] ?? 0).join(",")})` : "aucune";
  return [types, de].filter(Boolean).join(", ");
}

/** La ligne BOUCLIER : « nom (défense) ». */
export function resumeBouclier(bouclier) {
  const defense = bouclier.defense ?? bouclier.defenseBrute;
  return defense === null || defense === undefined || defense === "" ? bouclier.nom : `${bouclier.nom} (${defense})`;
}

// Les capacités que donne l'objet de ce rang (rôle « equipement »).
const capacitesDeLObjet = (fiche, rang) => fiche.capacites.filter((c) => c.role === "equipement" && c.sources.some((s) => s.rang === rang));

// ─── Les pièces de la fiche ─────────────────────────────────────────────────

/** Des cases à cocher : cochées, puis vides. */
function cases(nombre, { cochees = 0, taille = "petite", teinteesDes = Infinity } = {}) {
  return Array.from({ length: nombre }, (_, i) =>
    el("span", { classe: ["case", `case-${taille}`, i < cochees ? "cochee" : null, i >= teinteesDes ? "teintee" : null].filter(Boolean).join(" "), "aria-hidden": "true" }),
  );
}

/** Une ligne à remplir : un trait, et sa valeur s'il y en a une. */
function trait(valeur, classe = "") {
  const texte = valeur === null || valeur === undefined ? "" : String(valeur);
  return el("span", { classe: `trait ${classe}`.trim(), title: texte || null }, el("span", { classe: "trait-texte" }, texte));
}

function etiquette(texte, classe = "") {
  return el("span", { classe: `libelle ${classe}`.trim() }, texte);
}

function rubrique(classe, titre, ...contenu) {
  return el("section", { classe: `rubrique ${classe}` }, el("header", { classe: "rubrique-tete" }, el("h2", {}, titre)), el("div", { classe: "rubrique-corps" }, ...contenu));
}

/**
 * La description d'une capacité pour un objet ({ nom, rang }) : celle de son
 * rang (deux objets de même nom, de qualités différentes, ont chacun la
 * leur), sinon celle de son nom, sinon la première ; sans objet, la première.
 */
function descriptionDe(capacite, objet = null) {
  if (!objet) return capacite.descriptions[0];
  return capacite.descriptions.find((d) => d.rang === objet.rang) ?? capacite.descriptions.find((d) => d.source === objet.nom) ?? capacite.descriptions[0];
}

/**
 * Une capacité définie : ses cases de puissance à gauche (aucune à la
 * puissance 0 ni pour une capacité à venir), son nom, son coût, ses
 * éléments notables, puis sa définition. objet : l'objet ({ nom, rang })
 * dont la description compte, ou rien pour la première.
 */
export function capaciteDefinie(capacite, objet = null) {
  const description = descriptionDe(capacite, objet);
  const nombre = capacite.aVenir ? 0 : (capacite.niveauMax ?? 0);
  const cout = capacite.aVenir ? "" : coutEntreParentheses(capacite.cout);
  const notables = elementsNotables(capacite.elements ?? []);
  const texte = capacite.aVenir ? "" : reussitesLisibles(description?.texte ?? "");
  return el(
    "p",
    { classe: "capacite-definie" },
    nombre > 0 ? el("span", { classe: "cases-puissance" }, cases(nombre, { cochees: capacite.niveau ?? 0 })) : null,
    el("span", { classe: "capacite-definie-nom" }, capacite.nom),
    cout !== "" ? [" ", el("span", { classe: "capacite-definie-cout" }, `(${cout})`)] : null,
    notables.length ? [" ", el("span", { classe: "capacite-definie-elements" }, notables.join(", "))] : null,
    capacite.aVenir ? [" ", el("span", { classe: "capacite-definie-a-venir" }, "— à venir")] : texte ? [" ", el("span", { classe: "capacite-definie-texte" }, `— ${texte}`)] : null,
  );
}

// ─── Le recto ───────────────────────────────────────────────────────────────

function entete(fiche) {
  const champ = (classe, valeur, texte) => el("div", { classe: `champ-entete ${classe}` }, trait(valeur, "valeur-entete"), etiquette(texte));
  return el(
    "header",
    { classe: "fiche-entete" },
    el(
      "div",
      { classe: "fiche-marque" },
      el("p", { classe: "fiche-nom-jeu" }, "Les Arpenteurs d’Abrasia"),
      el("span", { classe: "fiche-filet" }, el("span", { classe: "filet" }), el("span", { classe: "losange" }), el("span", { classe: "filet" })),
      el("span", { classe: "fiche-genre" }, "Fiche de personnage"),
    ),
    el(
      "div",
      { classe: "fiche-identite" },
      champ("champ-nom", fiche.identite.nom, "Nom"),
      champ("champ-espece", fiche.espece, "Espèce"),
      champ("champ-archetype", fiche.archetype, "Archétype"),
      champ("champ-style", fiche.style, "Style de combat"),
      champ("champ-niveau", fiche.niveau, "Niv."),
      // L'expérience s'écrit à la main.
      champ("champ-xp", "", "XP"),
    ),
  );
}

function caracteristiques(fiche) {
  return rubrique(
    "rubrique-caracteristiques",
    "Caractéristiques",
    el(
      "div",
      { classe: "grille-caracteristiques" },
      fiche.caracteristiques.map((c) => el("div", { classe: "caracteristique-fiche" }, el("span", { classe: "nom-caracteristique" }, c.nom), el("span", { classe: "boite-valeur" }, c.valeur ?? ""))),
    ),
  );
}

function ligneEquipee(classe, titre, resume) {
  return el("div", { classe: `ligne-equipee ${classe}` }, el("span", { classe: "titre-ad" }, titre), el("span", { classe: "resume-equipe", title: resume || null }, resume), trait("", "trait-libre"));
}

function attaqueDefense(fiche) {
  const { attaque, bouclier } = fiche;
  const deLArme = attaque.mainsNues ? [] : capacitesDeLObjet(fiche, attaque.rang).map((c) => capaciteDefinie(c, attaque));
  // Une capacité que donnent deux pièces portées, de même description, ne
  // s'écrit qu'une fois : la zone n'a que quatre lignes.
  const vues = new Set();
  const deLArmure = fiche.equipement
    .filter((o) => o.porte)
    .flatMap((o) => capacitesDeLObjet(fiche, o.rang).map((c) => ({ c, o, cle: `${c.nom}\n${descriptionDe(c, o)?.texte ?? ""}` })))
    .filter(({ cle }) => !vues.has(cle) && vues.add(cle))
    .map(({ c, o }) => capaciteDefinie(c, o));
  const duBouclier = bouclier
    ? [ligneEquipee("ligne-bouclier", "Bouclier", resumeBouclier(bouclier)), capacitesDeLObjet(fiche, bouclier.rang).map((c) => capaciteDefinie(c, bouclier))]
    : [];
  return rubrique(
    "rubrique-attaque",
    "Attaque & défense",
    ligneEquipee("ligne-arme", "Arme", resumeArme(attaque)),
    el("div", { classe: "zone-capacites zone-arme" }, deLArme),
    el("span", { classe: "separation-ad", "aria-hidden": "true" }),
    ligneEquipee("ligne-armure", "Armure", resumeArmure(fiche)),
    el("div", { classe: "zone-capacites zone-armure" }, deLArmure, duBouclier),
  );
}

/**
 * Les capacités du bloc « Capacités », dans l'ordre du calcul : celles de
 * l'espèce et de l'archétype (style et maîtrise compris), puis la capacité
 * de déplacement du bloc de base, que l'écran nomme (le rôle « deplacement »
 * du combat, § 17). Les autres capacités du bloc de base ne s'écrivent pas.
 */
export function capacitesDuRecto(fiche, deplacement = null) {
  const propres = fiche.capacites.filter((c) => c.role === "espece" || c.role === "archetype");
  const pas = deplacement ? fiche.capacites.filter((c) => c.role === "base" && cle(c.nom) === cle(deplacement)) : [];
  return [...propres, ...pas];
}

function capacites(fiche, deplacement) {
  return rubrique("rubrique-capacites", "Capacités", el("div", { classe: "liste-capacites" }, capacitesDuRecto(fiche, deplacement).map((c) => capaciteDefinie(c))));
}

function etat(fiche) {
  const { souffle, corps } = fiche.ressources;
  return rubrique(
    "rubrique-etat",
    "État",
    el("div", { classe: "ligne-etat ligne-souffle" }, etiquette("Souffle"), trait("", "trait-libre"), el("span", { classe: "souffle-max" }, `/ ${souffle}`)),
    silhouette(fiche.armure.zones),
    el("div", { classe: "ligne-etat ligne-corps" }, etiquette("Corps"), el("div", { classe: "rang-cases" }, cases(corps, { taille: "corps", teinteesDes: 5 }))),
    el("div", { classe: "blessures-etat" }, etiquette("Blessures & états"), el("span", { classe: "ligne-libre" }), el("span", { classe: "ligne-libre" })),
  );
}

/**
 * Ce que le personnage porte et a sous la main (places arme, pack, équipé),
 * dans l'ordre de son équipement : les pièces portées regroupées par type
 * sur une ligne, à la place de la première ; les autres objets un par ligne,
 * avec leurs capacités, sauf l'arme tenue et le bouclier, dont les capacités
 * sont sous l'attaque et la défense. Le sac passe au verso.
 */
export function ceinture(fiche) {
  const { attaque, bouclier } = fiche;
  const pieces = fiche.equipement.filter((o) => o.porte);
  const objets = [];
  const typesVus = new Set();
  for (const o of fiche.equipement.filter((x) => x.place !== "sac")) {
    if (o.porte) {
      const type = typeDe(o);
      if (typesVus.has(type)) continue;
      typesVus.add(type);
      objets.push({ nom: `Armure ${nomDuType(type)} (${pieces.filter((p) => typeDe(p) === type).map((p) => p.nom).join(", ")})`, capacites: [] });
      continue;
    }
    const ailleurs = (!attaque.mainsNues && o.rang === attaque.rang) || o.rang === bouclier?.rang;
    objets.push({ nom: o.nom, capacites: ailleurs ? [] : capacitesDeLObjet(fiche, o.rang).map((c) => ({ capacite: c, objet: { nom: o.nom, rang: o.rang } })) });
  }
  return objets;
}

function equipement(fiche) {
  return rubrique(
    "rubrique-equipement",
    "Équipement et ceinture",
    ceinture(fiche).map((o) => el("div", { classe: "objet-ceinture" }, el("span", { classe: "objet-nom" }, o.nom), o.capacites.map(({ capacite, objet }) => capaciteDefinie(capacite, objet)))),
  );
}

function colonneLien(lien) {
  return el(
    "div",
    { classe: "colonne-lien" },
    el(
      "div",
      { classe: "ligne-primordial" },
      el("span", { classe: "titre-primordial" }, "Primordial"),
      trait(lien?.nom ?? "", "nom-primordial"),
      etiquette("Lien", "petite"),
      el("span", { classe: "cases-lien" }, cases(8, { cochees: lien?.points ?? 0, taille: "lien" })),
    ),
    el("p", { classe: "domaine-primordial" }, lien?.domaine ?? ""),
    (lien?.pouvoirs ?? []).map((c) => capaciteDefinie(c)),
  );
}

function liens(fiche) {
  const [premier = null, second = null] = fiche.liens;
  return rubrique("rubrique-liens", "Liens primordiaux", el("div", { classe: "colonnes-liens" }, colonneLien(premier), el("span", { classe: "separateur-liens" }), colonneLien(second)));
}

function pied(fiche) {
  return el("p", { classe: "fiche-pied" }, fiche.banque.publiee_le ? `Banque du ${dateLisible(fiche.banque.publiee_le).slice(0, 10)}` : "");
}

/**
 * Le recto. deplacement : le nom de la capacité de déplacement du bloc de
 * base, ou rien ; serrees : les définitions resserrées (classe
 * definitions-serrees), quand une zone déborde.
 */
export function recto(fiche, { deplacement = null, serrees = false } = {}) {
  return el(
    "section",
    { classe: serrees ? "feuille recto definitions-serrees" : "feuille recto", "aria-label": "Recto de la fiche" },
    el("span", { classe: "cadre cadre-exterieur", "aria-hidden": "true" }),
    el("span", { classe: "cadre cadre-interieur", "aria-hidden": "true" }),
    entete(fiche),
    el(
      "div",
      { classe: "fiche-corps" },
      el("div", { classe: "colonne colonne-gauche" }, caracteristiques(fiche), attaqueDefense(fiche), capacites(fiche, deplacement)),
      el("div", { classe: "colonne colonne-droite" }, etat(fiche), equipement(fiche)),
    ),
    liens(fiche),
    pied(fiche),
  );
}

// ─── Le verso ───────────────────────────────────────────────────────────────

function vignette(classe, titre, ...contenu) {
  return el("article", { classe: `vignette-verso ${classe}` }, titre ? el("h3", { classe: "vignette-verso-titre" }, titre) : null, ...contenu);
}

function point() {
  return vignette("vignette-verso-point", null, ["Évènement :", "Bonus :", "Contexte :"].map((champ) => el("p", { classe: "champ-vignette" }, champ)));
}

/** Le verso : le contexte, les réputations, le sac à dos, la constellation et les points d'historique. */
export function verso(fiche) {
  const { identite } = fiche;
  const constellation = fiche.constellation;
  const deLaConstellation = fiche.capacites.filter((c) => c.role === "constellation");
  return el(
    "section",
    { classe: "feuille verso", "aria-label": "Verso de la fiche" },
    el(
      "header",
      { classe: "verso-entete" },
      el("p", { classe: "fiche-nom-jeu" }, "Les Arpenteurs d’Abrasia"),
      el("span", { classe: "fiche-genre" }, identite.nom || "Personnage"),
      etiquette("— Points d'historique :", "points-historique"),
      trait("", "trait-points"),
    ),
    el(
      "section",
      { classe: "rubrique rubrique-historique" },
      el("header", { classe: "rubrique-tete" }, el("h2", {}, "Historique")),
      el(
        "div",
        { classe: "rubrique-corps" },
        el(
          "div",
          { classe: "vignettes-haut" },
          vignette(
            "vignette-verso-contexte",
            "Contexte",
            // Un champ que le joueur n'a pas rempli reste vide, sans tiret.
            el("dl", { classe: "paires-verso" }, [["Nom", identite.nom], ["Âge", identite.age], ["Description", identite.description], ["Histoire", identite.histoire]].map(([t, v]) => [el("dt", {}, t), el("dd", {}, v || "")])),
          ),
          vignette("vignette-verso-reputations", "Réputations"),
        ),
        el(
          "div",
          { classe: "vignettes-bas" },
          vignette(
            "vignette-verso-sac",
            "Sac à dos",
            fiche.equipement.filter((o) => o.place === "sac").map((o) => el("p", { classe: "objet-sac" }, o.nom)),
          ),
          vignette(
            "vignette-verso-constellation",
            "Constellation de naissance",
            constellation
              ? [
                  el("p", { classe: "nom-constellation" }, constellation.nom),
                  deLaConstellation.length ? deLaConstellation.map((c) => capaciteDefinie(c)) : el("p", { classe: "capacite-definie-a-venir" }, "Capacités à venir."),
                ]
              : null,
          ),
          Array.from({ length: VIGNETTES_POINT }, point),
        ),
      ),
    ),
  );
}

/** Le recto puis le verso, prêts à imprimer ; options : celles du recto. */
export function feuilles(fiche, options = {}) {
  return el("div", { classe: "feuilles" }, recto(fiche, options), verso(fiche));
}
