// Lecture d'un classeur .xlsx (SPECIFICATION.md, § 6.1).
//
// Rend les feuilles de calcul du classeur, dans leur ordre, chacune avec ses
// lignes non vides et leur numéro dans Excel. Chaque cellule y est une chaîne,
// au plus près de ce qu'Excel affiche : un texte enrichi réduit à son texte,
// les retours à la ligne gardés, un nombre sans décimale inutile. Rien n'est
// interprété ici : en-têtes et notation relèvent de l'import (§ 6.2).
//
// lireClasseur ne lève jamais d'exception : un fichier illisible donne
// { erreur } avec un message clair, jamais une page blanche.

import { ErreurZip, lireArchive } from "./zip.js";
import { ErreurXml, attribut, enfants, lireXml, premier, texte } from "./xml.js";

class ErreurClasseur extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurClasseur";
  }
}

// Signature des documents composés de Microsoft : un classeur chiffré par
// Excel, ou l'ancien format .xls.
const DOCUMENT_COMPOSE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function decoderTexte(octets, chemin) {
  try {
    if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(octets);
    if (octets[0] === 0xfe && octets[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(octets);
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    throw new ErreurClasseur(`Le classeur est abîmé : « ${chemin} » n'est pas un texte lisible.`);
  }
}

async function lirePartie(archive, chemin) {
  const texteXml = decoderTexte(await archive.lire(chemin), chemin);
  try {
    return lireXml(texteXml);
  } catch (erreur) {
    if (erreur instanceof ErreurXml) throw new ErreurClasseur(`Le classeur est abîmé : « ${chemin} » a un XML illisible (${erreur.message}).`);
    throw erreur;
  }
}

// Chemin d'une partie désignée par une relation, depuis le dossier de la
// partie qui la cite ; une cible qui commence par « / » part de la racine.
function resoudre(dossier, cible) {
  const morceaux = [];
  for (const morceau of (cible.startsWith("/") ? cible.slice(1) : dossier + cible).split("/")) {
    if (morceau === "..") morceaux.pop();
    else if (morceau !== "." && morceau !== "") morceaux.push(morceau);
  }
  return morceaux.join("/");
}

async function lireRelations(archive, partie) {
  const barre = partie.lastIndexOf("/");
  const dossier = partie.slice(0, barre + 1);
  const chemin = `${dossier}_rels/${partie.slice(barre + 1)}.rels`;
  const relations = new Map();
  if (!archive.contient(chemin)) return relations;
  for (const relation of enfants(await lirePartie(archive, chemin), "Relationship")) {
    if (attribut(relation, "TargetMode") === "External") continue;
    relations.set(attribut(relation, "Id"), {
      type: attribut(relation, "Type") ?? "",
      cible: resoudre(dossier, attribut(relation, "Target") ?? ""),
    });
  }
  return relations;
}

function relationDeType(relations, fin) {
  return [...relations.values()].find((relation) => relation.type.endsWith(fin)) ?? null;
}

// Excel écrit « _xHHHH_ » les caractères qu'XML ne sait pas porter (le retour
// chariot notamment) ; « _x005F_ » protège un « _x » écrit par l'auteur.
function desechapper(chaine) {
  return chaine.replace(/_x([0-9A-Fa-f]{4})_/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

// Texte enrichi : les <t> directs et ceux des <r>, dans l'ordre ; les
// annotations phonétiques <rPh> sont ignorées.
function texteRiche(element) {
  let resultat = "";
  for (const enfant of element.enfants) {
    if (typeof enfant === "string") continue;
    if (enfant.local === "t") resultat += texte(enfant);
    else if (enfant.local === "r") for (const morceau of enfants(enfant, "t")) resultat += texte(morceau);
  }
  return desechapper(resultat);
}

// Excel affiche au plus 15 chiffres significatifs ; String retire ensuite
// toute décimale inutile (10, jamais 10.0).
function nombre(brut) {
  const valeur = Number(brut);
  if (brut.trim() === "" || !Number.isFinite(valeur)) return brut;
  return String(Number(valeur.toPrecision(15)));
}

function valeurCellule(cellule, chaines) {
  const type = attribut(cellule, "t") ?? "n";
  if (type === "inlineStr") {
    const enLigne = premier(cellule, "is");
    return enLigne ? texteRiche(enLigne) : "";
  }
  const v = premier(cellule, "v");
  if (!v) return "";
  const brut = texte(v);
  switch (type) {
    case "s": {
      const indice = /^\d+$/.test(brut.trim()) ? Number(brut) : -1;
      if (indice < 0 || indice >= chaines.length) {
        throw new ErreurClasseur(`Le classeur est abîmé : la cellule ${attribut(cellule, "r") ?? "?"} renvoie à une chaîne partagée absente.`);
      }
      return chaines[indice];
    }
    case "str":
      return desechapper(brut);
    case "b":
      return brut.trim() === "1" ? "VRAI" : "FAUX";
    case "n":
      return nombre(brut);
    default:
      // « e » (erreur de formule, comme #N/A) et « d » (date ISO) : tels quels.
      return brut;
  }
}

function indiceColonne(reference) {
  const lettres = /^([A-Za-z]{1,3})\d*$/.exec(reference ?? "")?.[1];
  if (!lettres) return null;
  let indice = 0;
  for (const lettre of lettres.toUpperCase()) indice = indice * 26 + (lettre.charCodeAt(0) - 64);
  return indice - 1;
}

function lireLignes(feuille, chaines) {
  const donnees = premier(feuille, "sheetData");
  const lignes = [];
  let numeroPrecedent = 0;
  for (const ligne of donnees ? enfants(donnees, "row") : []) {
    const r = attribut(ligne, "r");
    const numero = /^\d+$/.test(r ?? "") ? Number(r) : numeroPrecedent + 1;
    numeroPrecedent = numero;
    const cellules = [];
    let colonnePrecedente = -1;
    for (const cellule of enfants(ligne, "c")) {
      const colonne = indiceColonne(attribut(cellule, "r")) ?? colonnePrecedente + 1;
      colonnePrecedente = colonne;
      const valeur = valeurCellule(cellule, chaines);
      if (valeur !== "") cellules[colonne] = valeur;
    }
    if (cellules.length) lignes.push({ numero, cellules: Array.from(cellules, (valeur) => valeur ?? "") });
  }
  return lignes;
}

async function lireFeuilles(archive) {
  const racine = relationDeType(await lireRelations(archive, ""), "/officeDocument");
  const cheminClasseur = racine?.cible ?? "xl/workbook.xml";
  if (!archive.contient(cheminClasseur)) {
    throw new ErreurClasseur("Ce fichier n'est pas un classeur Excel : son classeur (workbook.xml) est introuvable.");
  }
  const relations = await lireRelations(archive, cheminClasseur);
  const partieChaines = relationDeType(relations, "/sharedStrings");
  const chaines = partieChaines ? enfants(await lirePartie(archive, partieChaines.cible), "si").map(texteRiche) : [];

  const classeur = await lirePartie(archive, cheminClasseur);
  const feuilles = [];
  for (const feuille of enfants(premier(classeur, "sheets") ?? { enfants: [] }, "sheet")) {
    // Seules les feuilles de calcul ont des cellules ; une feuille graphique
    // n'a rien à lire.
    const relation = relations.get(attribut(feuille, "id"));
    if (!relation?.type.endsWith("/worksheet")) continue;
    feuilles.push({ nom: attribut(feuille, "name") ?? "", lignes: lireLignes(await lirePartie(archive, relation.cible), chaines) });
  }
  return feuilles;
}

/**
 * Lit un classeur .xlsx (octets : Uint8Array ou ArrayBuffer).
 * Rend { feuilles: [{ nom, lignes: [{ numero, cellules: [chaîne, …] }] }] },
 * la cellule d'indice 0 étant la colonne A ; ou { erreur } avec un message
 * clair pour l'auteur.
 */
export async function lireClasseur(donnees) {
  try {
    const octets = donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees);
    if (DOCUMENT_COMPOSE.every((octet, i) => octets[i] === octet)) {
      return {
        erreur:
          "Ce classeur est protégé par un mot de passe, ou enregistré à l'ancien format .xls. " +
          "Dans Excel, enregistrez-le au format .xlsx, sans mot de passe.",
      };
    }
    return { feuilles: await lireFeuilles(lireArchive(octets)) };
  } catch (erreur) {
    if (erreur instanceof ErreurZip) return { erreur: `Ce fichier n'est pas un classeur .xlsx lisible : ${erreur.message}.` };
    if (erreur instanceof ErreurClasseur) return { erreur: erreur.message };
    return { erreur: `Lecture du classeur impossible : ${erreur?.message ?? String(erreur)}.` };
  }
}
