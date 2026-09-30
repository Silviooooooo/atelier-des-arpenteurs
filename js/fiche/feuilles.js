// Le recto et le verso imprimables d'un personnage (SPECIFICATION.md,
// § 15.4).
//
// Le recto reproduit le modèle de fiche (plans/modele_fiche_personnage.*,
// hors dépôt) : sa mise en page, ses couleurs, ses polices, ses cadres et
// ses cases, dans css/fiche.css. Il ne déborde jamais sur une seconde page :
// repartition.js décide ce qui y tient, le reste passe au verso sous « Suite
// du recto ». Le verso dit le contexte, l'historique et le détail de toutes
// les capacités et de toutes les armes.

import { dateLisible } from "../banque/dates.js";
import { el, svg } from "../ecrans/dom.js";
import { LEGENDE_PRIMORDIAUX, LOCALISATION_20, ORDRE_FICHE_ZONES, TYPES_OBJET, ZONES } from "../personnage/regles.js";
import { coutEcrit, niveauEcrit } from "./lecture.js";
import { MODELE_CAPACITES, repartir } from "./repartition.js";

const ZONE = Object.fromEntries(ZONES.map((z) => [z.code, z]));
const TITRES_GROUPES = { espece: "Espèce", archetype: "Archétype", style: "Style de combat", constellation: "Constellation de naissance", acquises: "Acquises en progression" };

// ─── Les pièces du modèle ───────────────────────────────────────────────────

/** Une case à cocher du modèle : cochée, grisée, teintée, ou vide. */
function cases(nombre, { cochees = 0, grisees = Infinity, teintees = Infinity, taille = "moyenne" } = {}) {
  return Array.from({ length: nombre }, (_, i) =>
    el("span", {
      classe: ["case", `case-${taille}`, i < cochees ? "cochee" : null, i >= grisees ? "grisee" : null, i >= teintees ? "teintee" : null].filter(Boolean).join(" "),
      "aria-hidden": "true",
    }),
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

function rubrique(classe, titre, sousTitre, ...contenu) {
  return el(
    "section",
    { classe: `rubrique ${classe}` },
    el("header", { classe: "rubrique-tete" }, el("h2", {}, ...[titre].flat()), el("span", { classe: "rubrique-note" }, sousTitre)),
    el("div", { classe: "rubrique-corps" }, ...contenu),
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
    ),
  );
}

function caracteristiques(fiche) {
  return rubrique(
    "rubrique-caracteristiques",
    "Caractéristiques",
    "somme 36 · de 2 à 6",
    el(
      "div",
      { classe: "grille-caracteristiques" },
      fiche.caracteristiques.map((c) => el("div", { classe: "caracteristique" }, el("span", { classe: "nom-caracteristique" }, c.nom), el("span", { classe: "boite-valeur" }, c.valeur ?? ""))),
    ),
    el(
      "div",
      { classe: "pied-rubrique" },
      el("span", { classe: "note" }, "Somme des 2 carac. (×2 si une seule), arrondie au pair inférieur :"),
      el("span", { classe: "table-des" }, "4 → d4 · 6 → d6 · 8 → d8 · 10 → d10 · 12 → d12"),
    ),
  );
}

function attaqueDefense(fiche, repartition) {
  const { attaque, defense, bouclier } = fiche;
  const degats = attaque.degats ?? [null, null, null];
  const ligne = (...enfants) => el("div", { classe: "ligne-ad" }, ...enfants);
  return rubrique(
    "rubrique-attaque",
    "Attaque & défense",
    "réussites : 1 → A · 2 → B · 3 → C",
    el(
      "div",
      { classe: "bloc-ad" },
      ligne(el("span", { classe: "titre-ad" }, "Attaque"), etiquette("Arme"), trait(attaque.nom, "large"), etiquette("Dé"), trait(attaque.de?.de ?? "", "de")),
      ligne(
        el("span", { classe: "titre-ad" }),
        etiquette("Dégâts"),
        trait(degats[0], "rang"),
        el("span", { classe: "barre" }, "/"),
        trait(degats[1], "rang"),
        el("span", { classe: "barre" }, "/"),
        trait(degats[2], "rang"),
        etiquette("Portée"),
        trait(attaque.portee, "portee"),
        etiquette("Qualité"),
        trait(attaque.qualite?.applicable ? attaque.qualite.texte : "", "large"),
      ),
      el("span", { classe: "note" }, "Dé : lourde For+Pré · agile Agi+For · précise Pré+Agi"),
    ),
    el(
      "div",
      { classe: "bloc-ad bloc-defense" },
      ligne(el("span", { classe: "titre-ad" }, "Défense"), etiquette("Armure"), trait(repartition.armure.texte, "large"), etiquette("Dé"), trait(defense.de?.de ?? "", "de")),
      ligne(
        el("span", { classe: "titre-ad" }),
        etiquette("Défense"),
        trait(bouclier ? (bouclier.defense ?? bouclier.defenseBrute) : "", "defense"),
        etiquette("Bouclier"),
        trait(bouclier?.nom ?? "", "large"),
        etiquette("Qualité"),
        trait(bouclier?.qualite?.applicable ? bouclier.qualite.texte : "", "qualite"),
      ),
      el(
        "span",
        { classe: "note" },
        noteDefense(defense),
      ),
    ),
  );
}

// La note sous la défense : la légende du modèle, ou ce que le livret dit
// du dé quand les types se mêlent ou quand aucune pièce n'est portée.
function noteDefense(defense) {
  const type = defense.type ? TYPES_OBJET[defense.type].nom : "";
  if (defense.meles) return `Types mêlés : dé ${type}, désavantage sans la maîtrise de toutes les pièces`;
  if (!defense.pieces.length && defense.de) return `Sans armure : dé ${type}, le plus avantageux des trois`;
  return "Dé : lourde For+Sen · agile Agi+Cré · précise Pré+Emp";
}

function ligneCapacite(l) {
  if (l.vide) return el("div", { classe: "ligne-capacite" }, trait("", "nom-capacite"), el("span", { classe: "cases-puissance" }, cases(3, { taille: "petite" })), trait("", "cout"));
  if (l.aVenirGroupe) return el("div", { classe: "ligne-capacite" }, trait(`${l.nom} — capacités à venir`, "nom-capacite a-venir"), el("span", { classe: "cases-puissance" }, cases(3, { taille: "petite", grisees: 0 })), trait("", "cout"));
  const cout = l.aVenir ? "" : coutRecto(l.cout);
  return el(
    "div",
    { classe: "ligne-capacite" },
    trait(l.aVenir ? `${l.nom} — à venir` : l.nom, `nom-capacite${l.aVenir ? " a-venir" : ""}`),
    el("span", { classe: "cases-puissance" }, cases(3, { taille: "petite", cochees: l.niveau ?? 0, grisees: l.aVenir ? 0 : (l.niveauMax ?? 3) })),
    trait(cout, "cout"),
  );
}

/** Le coût dans sa colonne étroite : le souffle, et le lien s'il y en a. */
export function coutRecto(cout) {
  if (!cout) return "";
  return cout.lien !== "0" ? `${cout.souffle}·${cout.lien}L` : cout.souffle;
}

function capacites(fiche, repartition) {
  const groupes = Object.keys(MODELE_CAPACITES).map((g) =>
    el(
      "div",
      { classe: "groupe-capacites" },
      el(
        "div",
        { classe: "titre-groupe" },
        el("span", {}, TITRES_GROUPES[g]),
        g === "constellation" && fiche.constellation && fiche.groupes.constellation.length ? el("span", { classe: "precision-groupe" }, fiche.constellation.nom) : null,
        repartition.suite.capacites.some((s) => s.groupe === g) ? el("span", { classe: "precision-groupe" }, "suite au verso") : null,
        el("span", { classe: "regle" }),
      ),
      repartition.capacites[g].map(ligneCapacite),
    ),
  );
  const reliquat = fiche.points.reliquat;
  return rubrique(
    "rubrique-capacites",
    ["Capacités", el("span", { classe: "reliquat" }, `Reliquat : ${reliquat} point${reliquat > 1 ? "s" : ""}`)],
    "puissance de 1 à 3",
    el("div", { classe: "entete-colonnes" }, el("span", { classe: "vide-flexible" }), el("span", { classe: "col-pui" }, "Pui."), el("span", { classe: "col-cout" }, "Coût")),
    groupes,
  );
}

function souffle(fiche) {
  const max = fiche.ressources.souffle;
  return rubrique(
    "rubrique-souffle",
    "Souffle",
    "10 à la création · +1 par point d'historique",
    el("div", { classe: "souffle-max" }, etiquette("Max"), trait(max, "max")),
    el("div", { classe: "souffle-cases" }, el("div", { classe: "rang-cases" }, cases(10, { taille: "souffle", grisees: max })), el("div", { classe: "rang-cases" }, cases(10, { taille: "souffle", grisees: Math.max(0, max - 10) }))),
  );
}

function silhouette() {
  return svg(
    "svg",
    { viewBox: "0 0 88 202", classe: "silhouette", role: "img", "aria-label": "Silhouette de localisation : tête, torse, bras et jambes" },
    svg(
      "g",
      { classe: "silhouette-formes" },
      svg("ellipse", { cx: 44, cy: 22, rx: 14, ry: 16 }),
      svg("rect", { x: 39, y: 35, width: 10, height: 10, rx: 3 }),
      svg("rect", { x: 22, y: 44, width: 44, height: 66, rx: 8 }),
      svg("rect", { x: 6, y: 47, width: 13, height: 72, rx: 6.5 }),
      svg("rect", { x: 69, y: 47, width: 13, height: 72, rx: 6.5 }),
      svg("rect", { x: 24, y: 113, width: 19, height: 84, rx: 8 }),
      svg("rect", { x: 45, y: 113, width: 19, height: 84, rx: 8 }),
    ),
  );
}

function armure(fiche) {
  return rubrique(
    "rubrique-armure",
    "Armure & résistance",
    `${fiche.ressources.resistance} / zone`,
    silhouette(),
    el(
      "div",
      { classe: "table-zones" },
      el("div", { classe: "zone zone-tete" }, el("span", { classe: "col-zone" }, "Zone"), el("span", { classe: "col-d20" }, "d20"), el("span", { classe: "col-arm" }, "Arm."), el("span", { classe: "col-resist" }, "Résist.")),
      ORDRE_FICHE_ZONES.map((code) =>
        el(
          "div",
          { classe: "zone" },
          el("span", { classe: "col-zone nom-zone" }, ZONE[code].abrege),
          el("span", { classe: "col-d20 d20" }, ZONE[code].d20),
          el("span", { classe: "col-arm" }, trait(fiche.armure.zones[code], "arm")),
          el("span", { classe: "col-resist cases-resistance" }, cases(fiche.ressources.resistance, { taille: "resistance" })),
        ),
      ),
      el("div", { classe: "zone-pied" }, el("span", { classe: "note" }, LOCALISATION_20)),
    ),
  );
}

function corps(fiche) {
  return rubrique(
    "rubrique-sante",
    "Corps & blessures",
    `${fiche.ressources.corps} points`,
    el(
      "div",
      { classe: "points-corps" },
      etiquette("Points de corps"),
      el("div", { classe: "rang-cases" }, cases(fiche.ressources.corps, { taille: "corps", teintees: 5 })),
      el("span", { classe: "note" }, "1 pt / semaine (1 à 5) · 1 pt / mois (6 à 10)"),
    ),
    el("div", { classe: "blessures" }, etiquette("Blessures & états"), el("span", { classe: "ligne-libre" }), el("span", { classe: "ligne-libre" }), el("span", { classe: "ligne-libre" })),
  );
}

function equipement(repartition) {
  return rubrique(
    "rubrique-equipement",
    "Équipement",
    "objet · qualité",
    el(
      "div",
      { classe: "lignes-equipement" },
      repartition.equipement.map((o) => el("div", { classe: "ligne-objet" }, trait(o.vide ? "" : o.nom, "nom-objet"), trait(o.vide ? "" : o.qualite, "qualite-objet"))),
    ),
  );
}

function colonneLien(lien) {
  const pouvoirs = lien?.pouvoirs ?? [{ vide: true }, { vide: true }, { vide: true }];
  return el(
    "div",
    { classe: "colonne-lien" },
    el(
      "div",
      { classe: "ligne-primordial" },
      el("span", { classe: "titre-primordial" }, "Primordial"),
      trait(lien ? (lien.aVenir ? `${lien.nom} — capacités à venir` : lien.nom) : "", "nom-primordial"),
      etiquette("Lien", "petite"),
      el("span", { classe: "cases-lien" }, cases(8, { taille: "lien", grisees: lien ? lien.points : Infinity })),
    ),
    el("div", { classe: "entete-pouvoirs" }, el("span", { classe: "vide-flexible libelle petite" }, "Pouvoirs choisis"), el("span", { classe: "col-pui libelle petite" }, "Pui.")),
    pouvoirs.map((p) =>
      el(
        "div",
        { classe: "ligne-pouvoir" },
        trait(p.vide ? "" : p.aVenir ? `${p.nom} — à venir` : p.nom, "nom-pouvoir"),
        el("span", { classe: "cases-puissance" }, cases(3, { taille: "petite", cochees: p.niveau ?? 0, grisees: p.vide ? Infinity : p.aVenir ? 0 : (p.niveauMax ?? 3) })),
      ),
    ),
  );
}

function liens(repartition) {
  const [premier, second] = repartition.liens;
  return rubrique(
    "rubrique-liens",
    "Liens primordiaux",
    "points de lien = puissance investie dans les capacités du primordial",
    el("div", { classe: "colonnes-liens" }, colonneLien(premier), el("span", { classe: "separateur-liens" }), colonneLien(second)),
    el(
      "div",
      { classe: "legende-primordiaux" },
      [LEGENDE_PRIMORDIAUX.slice(0, 5), LEGENDE_PRIMORDIAUX.slice(5)].map((rang) =>
        el(
          "span",
          { classe: "note" },
          rang.flatMap(([nom, domaine], i) => [i ? " · " : "", `${nom} `, el("span", { classe: "domaine" }, domaine)]),
        ),
      ),
    ),
  );
}

function pied(fiche) {
  const parties = [fiche.banque.publiee_le ? `Banque du ${dateLisible(fiche.banque.publiee_le).slice(0, 10)}` : null, fiche.constellation?.saisie ? "constellation saisie à la main" : null];
  return el("p", { classe: "fiche-pied" }, parties.filter(Boolean).join(" · "));
}

/** Le recto : le modèle de fiche, rempli. */
export function recto(fiche, repartition = repartir(fiche)) {
  return el(
    "section",
    { classe: "feuille recto", "aria-label": "Recto de la fiche" },
    el("span", { classe: "cadre cadre-exterieur", "aria-hidden": "true" }),
    el("span", { classe: "cadre cadre-interieur", "aria-hidden": "true" }),
    entete(fiche),
    el(
      "div",
      { classe: "fiche-corps" },
      el("div", { classe: "colonne colonne-gauche" }, caracteristiques(fiche), attaqueDefense(fiche, repartition), capacites(fiche, repartition)),
      el("div", { classe: "colonne colonne-droite" }, souffle(fiche), armure(fiche), corps(fiche), equipement(repartition)),
    ),
    liens(repartition),
    pied(fiche),
  );
}

// ─── Le verso ───────────────────────────────────────────────────────────────

function sectionVerso(titre, ...contenu) {
  return el("section", { classe: "rubrique rubrique-verso" }, el("header", { classe: "rubrique-tete" }, el("h2", {}, titre)), el("div", { classe: "rubrique-corps" }, ...contenu));
}

function suiteDuRecto(fiche, repartition) {
  const { suite } = repartition;
  if (!repartition.deborde) return null;
  const lignes = [
    ...suite.capacites.map((l) => `${TITRES_GROUPES[l.groupe]} : ${l.nom}${l.aVenir ? " (à venir)" : ""}${l.niveau ? `, niveau ${l.niveau}` : ""}${l.cout ? `, coût ${coutEcrit(l.cout)}` : ""}`),
    ...suite.pouvoirs.map((p) => `${p.primordial} : ${p.nom}${p.niveau ? `, niveau ${p.niveau}` : ""}`),
    ...suite.equipement.map((o) => `Équipement : ${o.nom}${o.qualite ? `, qualité ${o.qualite}` : ""}`),
    suite.armure.length ? `Armure portée : ${suite.armure.join(", ")}` : null,
  ].filter(Boolean);
  return sectionVerso("Suite du recto", el("ul", { classe: "liste-verso" }, lignes.map((l) => el("li", {}, l))));
}

function detailCapacite(c) {
  return el(
    "article",
    { classe: "detail-capacite" },
    el("p", { classe: "detail-titre" }, el("strong", {}, c.nom), el("span", { classe: "detail-niveau" }, ` — ${niveauEcrit(c)}${c.aVenir ? "" : ` · coût ${coutEcrit(c.cout)}`}`)),
    el("p", { classe: "detail-origine" }, `${c.origines.join(", ")}${c.elements.length ? ` · ${c.elements.join(", ")}` : ""}`),
    c.aVenir ? el("p", { classe: "detail-texte" }, "Capacité à venir : absente de la feuille Capacites.") : c.descriptions.map((d) => el("p", { classe: "detail-texte" }, c.descriptions.length > 1 ? `${d.source} : ${d.texte}` : d.texte)),
  );
}

/** Le verso : contexte, historique, détail des capacités et des armes. */
export function verso(fiche, repartition = repartir(fiche)) {
  const { identite } = fiche;
  const armes = fiche.armes;
  return el(
    "section",
    { classe: "feuille verso", "aria-label": "Verso de la fiche" },
    el(
      "header",
      { classe: "fiche-marque verso-marque" },
      el("p", { classe: "fiche-nom-jeu" }, "Les Arpenteurs d’Abrasia"),
      el("span", { classe: "fiche-filet" }, el("span", { classe: "filet" }), el("span", { classe: "losange" }), el("span", { classe: "filet" })),
      el("span", { classe: "fiche-genre" }, `${identite.nom || "Personnage"} — verso`),
    ),
    suiteDuRecto(fiche, repartition),
    el(
      "div",
      { classe: "verso-haut" },
      sectionVerso(
        "Contexte",
        el(
          "dl",
          { classe: "paires-verso" },
          [["Nom", identite.nom], ["Âge", identite.age], ["Description", identite.description], ["Histoire", identite.histoire]].map(([t, v]) => [el("dt", {}, t), el("dd", {}, v || "—")]),
        ),
      ),
      sectionVerso(
        "Historique",
        el("p", { classe: "note" }, "Un point d'historique dépensé : une phrase, écrite ici."),
        Array.from({ length: 6 }, () => el("span", { classe: "ligne-libre" })),
      ),
    ),
    sectionVerso(
      "Armes",
      armes.length
        ? el(
            "table",
            { classe: "table-verso" },
            el("thead", {}, el("tr", {}, ["Arme", "Type", "Dé", "Dégâts", "Portée", "Qualité"].map((t) => el("th", { scope: "col" }, t)))),
            el(
              "tbody",
              {},
              armes.map((a) =>
                el(
                  "tr",
                  {},
                  el("td", {}, a.nom, a.rang === fiche.attaque.rang && !fiche.attaque.mainsNues ? " (principale)" : ""),
                  el("td", {}, a.typeObjet ? TYPES_OBJET[a.typeObjet].nom : "—"),
                  el("td", {}, a.de?.de ?? "—"),
                  el("td", {}, a.degats ? a.degats.join(" / ") : a.degatsBruts || "—"),
                  el("td", {}, a.portee || "—"),
                  el("td", {}, a.qualite.applicable ? a.qualite.texte : "—"),
                ),
              ),
            ),
          )
        : el("p", {}, `Aucune arme : ${fiche.attaque.nom}, dégâts ${fiche.attaque.degats ? fiche.attaque.degats.join(" / ") : "—"}, dé vide (aucune règle ne le donne).`),
    ),
    sectionVerso(
      "Capacités",
      el(
        "p",
        { classe: "points-verso" },
        `Points de capacité : ${fiche.points.depenses} / ${fiche.points.plafond} (reçus : ${fiche.points.recus}) · reliquat : ${fiche.points.reliquat} point${fiche.points.reliquat > 1 ? "s" : ""}.`,
      ),
      el("div", { classe: "details-capacites" }, fiche.capacites.map(detailCapacite)),
    ),
    fiche.avertissements.length || fiche.manques.length
      ? sectionVerso("Avertissements", el("ul", { classe: "liste-verso" }, [...fiche.manques, ...fiche.avertissements.map((a) => a.texte)].map((t) => el("li", {}, t))))
      : null,
    pied(fiche),
  );
}

/** Le recto puis le verso, prêts à imprimer. */
export function feuilles(fiche, places) {
  const repartition = repartir(fiche, places);
  return el("div", { classe: "feuilles" }, recto(fiche, repartition), verso(fiche, repartition));
}
