// Différences entre la banque publiée et la banque importée (SPECIFICATION.md,
// § 6.4), et le résumé d'une ligne qui sert de message de commit (§ 8.2).
//
// Blocs, capacités et éléments se reconnaissent à leur nom : un nom changé
// est un retrait suivi d'un ajout. Les champs se comparent sur leur valeur
// lue, si bien que deux écritures de la même notation ne diffèrent pas ; ils
// s'affichent tels que l'auteur les a écrits dans sa cellule (brut), sous le
// nom de sa colonne. Une capacité à plusieurs puissances se compare variante
// par variante.
//
// Les classes d'adversaires et les adversaires (lot 3, § 16) se comparent de
// même : leurs cellules, gardées telles qu'écrites, se comparent sur ce que
// la notation des adversaires y lit. Une banque publiée avant la feuille
// « Adversaires » n'en a aucun : tout y est ajouté.

import { lireListe, lireLocalisation, lireNombreCellule, lireTypes, texteDe } from "../adversaire/notation.js";
import { entreesLisibles } from "../adversaire/resolution.js";
import { dateLisible } from "./dates.js";
import { COLONNES, nomsDEntete } from "./importation.js";
import { cle } from "./noms.js";

const CHAMPS_ADVERSAIRE = ["localisation", "actions", "souffle", "attaque", "defense", "equipement", "capacites"];
const CATEGORIES = {
  blocs: { feuille: "Blocs", champs: ["type", "elements", "capacites", "parametres", "notes"] },
  capacites: { feuille: "Capacites", champs: ["puissance", "cout_souffle", "cout_lien", "elements", "description", "notes"] },
  elements: { feuille: "Eléments", champs: ["parametres_recus", "description"] },
  types_adversaires: { feuille: "Adversaires", champs: CHAMPS_ADVERSAIRE },
  adversaires: { feuille: "Adversaires", champs: ["types", ...CHAMPS_ADVERSAIRE] },
};

// Ce que la notation des adversaires lit dans une cellule (§ 16.1) : deux
// écritures de la même liste, ou « 1 » et « 1,0 », ne diffèrent pas.
const LECTEURS_ADVERSAIRE = {
  types: lireTypes,
  localisation: lireLocalisation,
  actions: lireNombreCellule,
  souffle: lireNombreCellule,
  attaque: lireNombreCellule,
  defense: lireNombreCellule,
  equipement: lireListe,
  capacites: lireListe,
};

// Une écriture qui ne dépend pas de l'ordre des clés : une banque publiée par
// une version antérieure du code se compare sans fausse différence.
function canonique(valeur) {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  if (valeur && typeof valeur === "object") {
    return `{${Object.keys(valeur)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(valeur[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valeur ?? null);
}

// Le texte de la cellule telle qu'écrite, sous le nom neuf de sa colonne,
// puis sous l'ancien (« Type » pour « Classe », § 4.1) ; à défaut, la valeur
// lue. Une banque publiée avant une colonne (le type, § 4.1) n'a rien à
// montrer.
function texteEcrit(ligne, feuille, champ) {
  const cellules = ligne?.brut?.cellules ?? {};
  for (const nom of nomsDEntete(feuille, champ)) {
    const entete = Object.keys(cellules).find((k) => cle(k) === cle(nom));
    if (entete !== undefined) return cellules[entete];
  }
  const valeur = ligne?.[champ];
  if (valeur === undefined) return "";
  return typeof valeur === "string" ? valeur : canonique(valeur);
}

// Un bloc publié avant la colonne « Type » n'a pas de type : il vaut un
// type vide, et un bloc resté sans type n'a pas changé.
const lue = (ligne, champ, feuille) => {
  if (feuille === "Adversaires") {
    // Une cellule fautive ne se lit pas : deux cellules différentes, fautives
    // toutes deux, se liraient pareil. Elle se compare donc aussi sur son
    // texte, blancs réduits.
    const ecrit = texteDe(ligne[champ]);
    const lu = LECTEURS_ADVERSAIRE[champ](ecrit);
    return lu.defaut || lu.defauts?.length ? { lu, ecrit: ecrit.replace(/\s+/gu, " ").trim() } : lu;
  }
  return champ === "type" ? (ligne[champ] ?? "") : ligne[champ];
};

function champsModifies(ancien, nouveau, feuille, champs, variante = null) {
  return champs
    .filter((champ) => canonique(lue(ancien, champ, feuille)) !== canonique(lue(nouveau, champ, feuille)))
    .map((champ) => ({
      champ,
      colonne: COLONNES[feuille][champ],
      variante,
      avant: texteEcrit(ancien, feuille, champ),
      apres: texteEcrit(nouveau, feuille, champ),
    }));
}

// Range une liste par une clé ; deux entrées de même clé (doublon, E3) se
// distinguent par leur rang.
function ranger(liste, clef) {
  const table = new Map();
  const rangs = new Map();
  for (const item of liste) {
    const base = clef(item);
    const rang = (rangs.get(base) ?? 0) + 1;
    rangs.set(base, rang);
    table.set(rang === 1 ? base : `${base} (${rang}e)`, item);
  }
  return table;
}

function comparerVariantes(ancienne, nouvelle) {
  const { feuille, champs } = CATEGORIES.capacites;
  // Une seule variante de part et d'autre : la puissance est un champ comme
  // les autres.
  if (ancienne.variantes.length === 1 && nouvelle.variantes.length === 1) {
    return champsModifies(ancienne.variantes[0], nouvelle.variantes[0], feuille, champs);
  }
  const avant = ranger(ancienne.variantes, (v) => v.puissance);
  const apres = ranger(nouvelle.variantes, (v) => v.puissance);
  const autres = champs.filter((champ) => champ !== "puissance");
  const modifies = [];
  for (const [puissance, variante] of apres) {
    if (!avant.has(puissance)) modifies.push({ champ: "variante", colonne: "puissance", variante: puissance, avant: "", apres: "variante ajoutée" });
    else modifies.push(...champsModifies(avant.get(puissance), variante, feuille, autres, puissance));
  }
  for (const puissance of avant.keys()) {
    if (!apres.has(puissance)) modifies.push({ champ: "variante", colonne: "puissance", variante: puissance, avant: "variante retirée", apres: "" });
  }
  return modifies;
}

function comparerCategorie(categorie, anciens, nouveaux) {
  const { feuille, champs } = CATEGORIES[categorie];
  const avant = ranger(anciens, (item) => item.nom);
  const apres = ranger(nouveaux, (item) => item.nom);
  const resultat = { ajoutes: [], modifies: [], retires: [] };
  for (const [nom, item] of apres) {
    if (!avant.has(nom)) resultat.ajoutes.push(nom);
    else {
      const modifies = categorie === "capacites" ? comparerVariantes(avant.get(nom), item) : champsModifies(avant.get(nom), item, feuille, champs);
      if (modifies.length) resultat.modifies.push({ nom, champs: modifies });
    }
  }
  for (const nom of avant.keys()) if (!apres.has(nom)) resultat.retires.push(nom);
  return resultat;
}

/**
 * Compare la banque publiée (null à la première publication) à la banque
 * importée. Rend, pour les blocs, les capacités, les éléments, les classes
 * d'adversaires et les adversaires, les noms ajoutés et retirés, et les
 * modifications champ par champ ; plus le changement éventuel de lisez_moi,
 * et les totaux de la banque importée. Une banque sans adversaires (publiée
 * avant le lot 3, ou réduite) vaut une banque qui n'en a aucun.
 */
export function comparer(ancienne, nouvelle) {
  const differences = { premiere: ancienne === null };
  // Une liste absente (banque d'avant le lot 3) ou abîmée vaut une liste
  // vide, et une entrée sans nom n'y compte pas : la comparaison reste debout.
  const entrees = (banque, categorie) => entreesLisibles(banque?.[categorie]);
  for (const categorie of Object.keys(CATEGORIES)) {
    differences[categorie] = comparerCategorie(categorie, entrees(ancienne, categorie), entrees(nouvelle, categorie));
  }
  differences.lisez_moi_modifie = ancienne !== null && canonique(ancienne.lisez_moi) !== canonique(nouvelle.lisez_moi);
  differences.totaux = Object.fromEntries(Object.keys(CATEGORIES).map((categorie) => [categorie, entrees(nouvelle, categorie).length]));
  return differences;
}

// Accords : zéro et un au singulier, comme en français.
const NOMS = {
  blocs: ["bloc", "blocs", ""],
  capacites: ["capacité", "capacités", "e"],
  elements: ["élément", "éléments", ""],
  types_adversaires: ["classe d'adversaire", "classes d'adversaires", "e"],
  adversaires: ["adversaire", "adversaires", ""],
};
// À la première publication, les totaux des adversaires ne se disent que
// s'il y en a : un classeur sans feuille Adversaires garde sa phrase.
const TOUJOURS_DITS = ["blocs", "capacites", "elements"];
const compte = (n, [singulier, pluriel]) => `${n} ${n > 1 ? pluriel : singulier}`;
const participe = (n, racine, feminin) => `${racine}${feminin}${n > 1 ? "s" : ""}`;

/**
 * Le résumé d'une ligne, qui devient le message de commit (§ 8.2) :
 * « Publication du classeur des règles — 28/09/2026 14:32 — 3 capacités
 * ajoutées, 2 modifiées, 0 retirée ». Une catégorie sans changement est
 * tue ; une publication malgré des erreurs le dit.
 */
export function resumer(differences, { date, erreurs = 0 }) {
  let contenu;
  if (differences.premiere) {
    contenu = `première publication : ${Object.keys(NOMS)
      .filter((categorie) => TOUJOURS_DITS.includes(categorie) || differences.totaux[categorie] > 0)
      .map((categorie) => compte(differences.totaux[categorie] ?? 0, NOMS[categorie]))
      .join(", ")}`;
  } else {
    const parties = [];
    for (const [categorie, nom] of Object.entries(NOMS)) {
      const { ajoutes, modifies, retires } = differences[categorie] ?? { ajoutes: [], modifies: [], retires: [] };
      if (ajoutes.length + modifies.length + retires.length === 0) continue;
      parties.push(
        `${compte(ajoutes.length, nom)} ${participe(ajoutes.length, "ajouté", nom[2])}, ` +
          `${modifies.length} ${participe(modifies.length, "modifié", nom[2])}, ` +
          `${retires.length} ${participe(retires.length, "retiré", nom[2])}`,
      );
    }
    if (differences.lisez_moi_modifie) parties.push("lisez_moi modifié");
    contenu = parties.length ? parties.join(" ; ") : "aucune différence";
  }
  const malgre = erreurs > 0 ? ` — publiée malgré ${compte(erreurs, ["erreur", "erreurs"])}` : "";
  return `Publication du classeur des règles — ${dateLisible(date)} — ${contenu}${malgre}`;
}
