// Bancs sur le classeur réel (SPECIFICATION.md, § 6.3).
//
//   node tests/banc_classeur_reel.js chemin/vers/regles_jdr.xlsx
//
// Le classeur se lit là où il est : le banc ne le copie pas et n'écrit rien.
// Il affiche des comptes et des en-têtes, à côté de l'état relevé au § 4.1.
// node --test ne le lance pas : il demande le classeur réel, qui n'entre
// jamais dans le dépôt.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { lireClasseur } from "../js/lecture/xlsx.js";

// État du classeur relevé le 28/09/2026 (§ 4.1).
const RELEVE = [
  { feuille: "lisez_moi", entetes: null, lignes: 19 },
  {
    feuille: "Blocs",
    entetes: ["Nom", "Eléments transmis aux capacités", "capacites", "Paramètres transmis aux capacités", "Infos"],
    lignes: 67,
  },
  { feuille: "Eléments", entetes: ["Nom", "Paramètres reçus", "description"], lignes: 19 },
  {
    feuille: "Capacites",
    entetes: ["origine", "Nom", "puissance", "Coût en souffle", "Coût en lien", "Eléments propres", "description"],
    lignes: 71,
    noms: 69,
  },
];

function tableau(lignes) {
  const largeurs = lignes[0].map((_, colonne) => Math.max(...lignes.map((ligne) => String(ligne[colonne]).length)));
  for (const ligne of lignes) console.log("  " + ligne.map((cellule, colonne) => String(cellule).padEnd(largeurs[colonne])).join("   "));
}

function ecart(mesure, reference) {
  return mesure === reference ? "—" : `${mesure > reference ? "+" : ""}${mesure - reference}`;
}

function bancDeLecture(classeur) {
  console.log(`Feuilles : ${classeur.feuilles.map((feuille) => feuille.nom).join(" · ")}`);
  const lignes = [["feuille", "lignes non vides", "§ 4.1", "écart"]];
  const remarques = [];
  for (const releve of RELEVE) {
    const feuille = classeur.feuilles.find((f) => f.nom === releve.feuille);
    if (!feuille) {
      lignes.push([releve.feuille, "absente", releve.lignes, "?"]);
      continue;
    }
    // Les feuilles à en-têtes les portent en ligne 1, qui ne compte pas.
    const donnees = feuille.lignes.filter((ligne) => !releve.entetes || ligne.numero !== 1);
    const blanches = donnees.filter((ligne) => ligne.cellules.every((cellule) => cellule.trim() === "")).length;
    if (blanches) remarques.push(`${releve.feuille} : ${blanches} ligne(s) faites seulement d'espaces`);
    let mesure = `${donnees.length}`;
    let reference = `${releve.lignes}`;
    let difference = ecart(donnees.length, releve.lignes);
    if (releve.noms) {
      const colonne = feuille.lignes.find((ligne) => ligne.numero === 1)?.cellules.indexOf("Nom") ?? -1;
      const noms = new Set(donnees.map((ligne) => (ligne.cellules[colonne] ?? "").trim()).filter(Boolean)).size;
      mesure += `, ${noms} noms`;
      reference += `, ${releve.noms} noms`;
      if (noms !== releve.noms) difference += ` (noms ${ecart(noms, releve.noms)})`;
    }
    lignes.push([releve.feuille, mesure, reference, difference]);
  }
  console.log("\nLignes, hors ligne d'en-têtes :");
  tableau(lignes);
  for (const remarque of remarques) console.log(`  ${remarque}`);

  console.log("\nEn-têtes (ligne 1), comparés au § 4.1 :");
  for (const releve of RELEVE.filter((r) => r.entetes)) {
    const feuille = classeur.feuilles.find((f) => f.nom === releve.feuille);
    const entetes = feuille?.lignes.find((ligne) => ligne.numero === 1)?.cellules ?? [];
    const manquants = releve.entetes.filter((entete) => !entetes.includes(entete));
    const enPlus = entetes.filter((entete) => entete !== "" && !releve.entetes.includes(entete));
    const memeOrdre = entetes.filter((entete) => releve.entetes.includes(entete)).join("|") === releve.entetes.join("|");
    const verdict = [
      manquants.length ? `absents : ${manquants.join(" · ")}` : "",
      enPlus.length ? `en plus : ${enPlus.join(" · ")}` : "",
      !manquants.length && !memeOrdre ? "ordre changé (sans effet : les colonnes se retrouvent par leur en-tête)" : "",
    ].filter(Boolean);
    console.log(`  ${releve.feuille} : ${verdict.length ? verdict.join(" ; ") : "conformes"}`);
  }
}

const chemin = process.argv[2];
if (!chemin) {
  console.error("Usage : node tests/banc_classeur_reel.js chemin/vers/regles_jdr.xlsx");
  process.exit(2);
}
const octets = readFileSync(chemin);
const classeur = await lireClasseur(octets);
console.log(`Banc de lecture — ${basename(chemin)}, ${octets.length.toLocaleString("fr-FR")} octets`);
if (classeur.erreur) {
  console.log(`Lecture impossible : ${classeur.erreur}`);
  process.exit(1);
}
bancDeLecture(classeur);
