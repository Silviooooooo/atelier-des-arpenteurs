// La vue lecture d'un personnage (SPECIFICATION.md, § 15.5).
//
// Les rubriques de la fiche, empilées, lisibles sans zoom sur un téléphone :
// la même fiche calculée (calcul.js) que le recto et le verso, dans les
// styles de l'interface. Le détail de chaque capacité se déplie.

import { dateLisible } from "../banque/dates.js";
import { el } from "../ecrans/dom.js";
import { ORDRE_FICHE_ZONES, SOMME_CARACTERISTIQUES, SOUFFLE_CREATION, TYPES_OBJET, ZONES } from "../personnage/regles.js";

const ZONE = Object.fromEntries(ZONES.map((z) => [z.code, z]));

/** Le coût d'une capacité en une ligne : « 5 souffle », « 1 souffle · 1 lien ». */
export function coutEcrit(cout) {
  if (!cout) return "";
  const parties = [];
  if (cout.souffle !== "0") parties.push(`${cout.souffle} souffle`);
  if (cout.lien !== "0") parties.push(`${cout.lien} lien`);
  return parties.length ? parties.join(" · ") : "0";
}

/** Le niveau d'une capacité : « 2 / 3 », « 0 (n'évolue pas) », « à venir ». */
export function niveauEcrit(capacite) {
  if (capacite.aVenir) return "capacité à venir";
  if (capacite.niveau === 0) return "niveau 0, n'évolue pas";
  return `niveau ${capacite.niveau} / ${capacite.niveauMax}`;
}

const degatsEcrits = (degats) => (degats ? degats.join(" / ") : "—");
const qualiteEcrite = (qualite) => (qualite?.applicable ? `qualité ${qualite.texte}` : "");

/**
 * Comment la constellation a été obtenue, pour le pied de la fiche (lot 2
 * bis) : « constellation saisie à la main », ou le nombre de tirages, que le
 * joueur peut refaire à volonté (« constellation tirée 3 fois »).
 */
export function obtentionEcrite(constellation) {
  if (!constellation) return null;
  if (constellation.saisie) return "constellation saisie à la main";
  return constellation.tirages >= 1 ? `constellation tirée ${constellation.tirages} fois` : null;
}

function section(titre, ...contenu) {
  return el("section", { classe: "lecture-section" }, el("h2", {}, titre), ...contenu);
}

function paires(lignes) {
  return el(
    "dl",
    { classe: "lecture-paires" },
    lignes.filter(Boolean).map(([terme, valeur]) => [el("dt", {}, terme), el("dd", {}, valeur === "" || valeur === null || valeur === undefined ? "—" : valeur)]),
  );
}

function ligneCapacite(capacite) {
  const resume = el(
    "summary",
    {},
    el("span", { classe: "lecture-nom" }, capacite.nom),
    " ",
    el("span", { classe: "detail" }, [niveauEcrit(capacite), capacite.aVenir ? null : coutEcrit(capacite.cout) === "0" ? "sans coût" : coutEcrit(capacite.cout)].filter(Boolean).join(" · ")),
  );
  const details = capacite.aVenir
    ? [el("p", { classe: "secondaire-texte" }, `Absente de la feuille Capacites. Donnée par : ${capacite.origines.join(", ")}.`)]
    : [
        el("p", { classe: "secondaire-texte petit" }, `Donnée par : ${capacite.origines.join(", ")}${capacite.elements.length ? ` · éléments : ${capacite.elements.join(", ")}` : ""}`),
        ...capacite.descriptions.map((d) => el("p", {}, capacite.descriptions.length > 1 ? `${d.source} : ${d.texte}` : d.texte)),
      ];
  return el("li", {}, el("details", {}, resume, ...details));
}

function groupe(titre, capacites, siVide) {
  return [
    el("h3", {}, titre),
    capacites.length ? el("ul", { classe: "lecture-capacites" }, capacites.map(ligneCapacite)) : el("p", { classe: "secondaire-texte" }, siVide),
  ];
}

/** La vue lecture d'une fiche calculée. */
export function lecture(fiche) {
  const { identite, attaque, defense, bouclier } = fiche;
  const autres = fiche.capacites.filter((c) => c.groupe === null);
  const constellationVide = fiche.constellation && fiche.groupes.constellation.length === 0;

  return el(
    "div",
    { classe: "lecture" },
    el(
      "header",
      { classe: "lecture-entete" },
      el("p", { classe: "lecture-titre" }, identite.nom || "Sans nom"),
      el("p", { classe: "secondaire-texte" }, [fiche.espece, fiche.archetype, fiche.style, `niveau ${fiche.niveau}`].filter(Boolean).join(" · ")),
    ),

    section(
      "Caractéristiques",
      el(
        "ul",
        { classe: "lecture-caracteristiques" },
        fiche.caracteristiques.map((c) => el("li", {}, el("span", {}, c.nom), el("strong", {}, c.valeur ?? "—"))),
      ),
      el("p", { classe: "secondaire-texte petit" }, `Somme ${fiche.somme} sur ${SOMME_CARACTERISTIQUES}.`),
      paires([
        ["Dé d'attaque", Object.entries(TYPES_OBJET).map(([code, t]) => `${t.nom} ${fiche.des.attaque[code]?.de ?? "—"}`).join(" · ")],
        ["Dé de défense", Object.entries(TYPES_OBJET).map(([code, t]) => `${t.nom} ${fiche.des.defense[code]?.de ?? "—"}`).join(" · ")],
      ]),
    ),

    section(
      "Attaque",
      paires([
        ["Arme", attaque.nom],
        ["Dé", attaque.de?.de ?? (attaque.mainsNues ? "vide : aucune règle ne le donne" : "—")],
        ["Dégâts", degatsEcrits(attaque.degats)],
        ["Portée", attaque.portee],
        ["Qualité", attaque.qualite?.applicable ? attaque.qualite.texte : ""],
      ]),
    ),

    section(
      "Défense",
      paires([
        ["Armure", defense.pieces.length ? defense.pieces.join(", ") : "aucune"],
        ["Dé", defense.de ? `${defense.de.de} (${TYPES_OBJET[defense.type].nom})` : "—"],
        defense.mention ? ["", defense.mention] : null,
        ["Bouclier", bouclier ? `${bouclier.nom}, défense ${bouclier.defense ?? bouclier.defenseBrute}${bouclier.qualite?.applicable ? `, ${qualiteEcrite(bouclier.qualite)}` : ""}` : "aucun"],
      ]),
    ),

    section(
      "Armure et résistance",
      el(
        "table",
        { classe: "lecture-zones" },
        el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Zone"), el("th", { scope: "col" }, "d20"), el("th", { scope: "col" }, "Armure"), el("th", { scope: "col" }, "Résistance"))),
        el(
          "tbody",
          {},
          ORDRE_FICHE_ZONES.map((code) =>
            el("tr", {}, el("th", { scope: "row" }, ZONE[code].nom), el("td", {}, ZONE[code].d20), el("td", {}, fiche.armure.zones[code]), el("td", {}, fiche.ressources.resistance)),
          ),
        ),
      ),
    ),

    section(
      "Ressources",
      paires([
        ["Souffle", `${fiche.ressources.souffle} (${SOUFFLE_CREATION} à la création, +1 par point d'historique)`],
        ["Corps", fiche.ressources.corps],
      ]),
    ),

    section(
      "Capacités",
      el("p", { classe: "lecture-points" }, `Points de capacité : ${fiche.points.depenses} / ${fiche.points.plafond} · reliquat : ${fiche.points.reliquat} point${fiche.points.reliquat > 1 ? "s" : ""}`),
      groupe("Espèce", fiche.groupes.espece, "Aucune."),
      groupe("Archétype", fiche.groupes.archetype, "Aucune."),
      groupe("Style de combat", fiche.groupes.style, "Aucune."),
      constellationVide
        ? [el("h3", {}, "Constellation de naissance"), el("p", {}, `${fiche.constellation.nom} — capacités à venir`)]
        : groupe("Constellation de naissance", fiche.groupes.constellation, "Aucune."),
      groupe("Acquises en progression", fiche.groupes.acquises, "Aucune à la création."),
      groupe("Bloc de base et équipement", autres, "Aucune."),
    ),

    section(
      "Liens primordiaux",
      fiche.liens.length
        ? fiche.liens.map((lien) => [
            paires([
              ["Primordial", lien.nom],
              ["Points de lien", lien.points],
            ]),
            lien.pouvoirs.length ? el("ul", { classe: "lecture-capacites" }, lien.pouvoirs.map(ligneCapacite)) : el("p", {}, "Capacités à venir."),
          ])
        : el("p", { classe: "secondaire-texte" }, "Aucun primordial lié."),
    ),

    section(
      "Équipement",
      fiche.equipement.length
        ? el(
            "ul",
            {},
            fiche.equipement.map((o) =>
              el("li", {}, o.nom, " ", el("span", { classe: "detail" }, [qualiteEcrite(o.qualite), o.porte ? "portée" : "", o.rang === attaque.rang && !attaque.mainsNues ? "arme principale" : "", o.rang === bouclier?.rang ? "bouclier" : ""].filter(Boolean).join(" · "))),
            ),
          )
        : el("p", { classe: "secondaire-texte" }, "Aucun objet."),
    ),

    section(
      "Contexte",
      paires([
        ["Âge", identite.age],
        ["Description", identite.description],
        ["Histoire", identite.histoire],
      ]),
    ),

    fiche.manques.length || fiche.avertissements.length
      ? section(
          "À vérifier",
          el("ul", { classe: "lecture-avertissements" }, [...fiche.manques, ...fiche.avertissements.map((a) => a.texte)].map((texte) => el("li", {}, texte))),
        )
      : null,

    el(
      "p",
      { classe: "secondaire-texte petit" },
      [fiche.banque.publiee_le ? `Banque du ${dateLisible(fiche.banque.publiee_le).slice(0, 10)}` : null, obtentionEcrite(fiche.constellation)].filter(Boolean).join(" · "),
    ),
  );
}
