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
import { GRAVITES } from "../js/banque/controle.js";
import { importerFichier } from "../js/banque/importation.js";
import { lireClasseur } from "../js/lecture/xlsx.js";

// Mesure de référence du 28/09/2026 (§ 6.3) : le contrôle doit trouver au
// moins ceci.
const REFERENCE = {
  E4: {
    citations: 12,
    noms: ["Boire", "Enduire arme", "Maîtrise du combat précise", "Représailles", "Savoir acquis", "fureur", "lancer grenade", "redécouverte", "trouvé !"],
  },
  // Depuis le lot 2 bis, un paramètre ciblé à côté du même sans cible est
  // admis : la Hache légère ne doit plus paraître en E7.
  E7: [],
  E7_admis: ["Hache légère"],
  A1: 21,
  A2: ["archetype", "consommable", "defense"],
  A3: ["Maîtrise du combat précis", "Constellation d'Enaël"],
  I1: 15,
};

// État du classeur relevé le 28/09/2026, et sa colonne « Type » le 29/09/2026 (§ 4.1).
const RELEVE = [
  { feuille: "lisez_moi", entetes: null, lignes: 19 },
  {
    feuille: "Blocs",
    entetes: ["Nom", "Type", "Eléments transmis aux capacités", "capacites", "Paramètres transmis aux capacités", "Infos"],
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

// Les noms qu'une famille d'anomalies désigne, tirés de leurs messages
// (controle.js en fixe la forme).
function noms(anomalies, code, motif) {
  return anomalies.filter((a) => a.code === code).map((a) => motif.exec(a.message)?.[1]).filter(Boolean);
}

function comparer(titre, trouves, attendus) {
  const uniques = [...new Set(trouves)];
  const manquants = attendus.filter((nom) => !uniques.includes(nom));
  const enPlus = uniques.filter((nom) => !attendus.includes(nom));
  console.log(`  ${titre} : ${uniques.length} trouvé(s), ${attendus.length} attendu(s) au moins.`);
  if (manquants.length) console.log(`    absents : ${manquants.join(" · ")}`);
  if (enPlus.length) console.log(`    en plus : ${enPlus.join(" · ")}`);
}

async function bancComplet(octets, fichier) {
  const { banque, anomalies, erreur } = await importerFichier(octets, fichier);
  console.log("\nBanc complet — import et contrôle");
  if (erreur) {
    console.log(`  Import impossible : ${erreur}`);
    return;
  }
  if (!banque) {
    console.log("  Import arrêté (E1) :");
    for (const a of anomalies) console.log(`    ${a.message}`);
    return;
  }
  const variantes = banque.capacites.reduce((total, capacite) => total + capacite.variantes.length, 0);
  console.log(
    `  Banque : ${banque.blocs.length} blocs, ${banque.capacites.length} capacités (${variantes} variantes), ` +
      `${banque.elements.length} éléments, ${banque.lisez_moi.length} lignes de lisez_moi ; ${anomalies.length} anomalies.`,
  );

  const citees = noms(anomalies, "E4", /cite la capacité « (.+?) », introuvable/);
  const cibles = noms(anomalies, "E4", /vise la capacité « (.+?) »/);
  const a1 = (genre) => anomalies.filter((a) => a.code === "A1" && a.message.includes(`pour ${genre} «`)).length;
  const reference = {
    E4: `≥ ${REFERENCE.E4.citations} citations, ${REFERENCE.E4.noms.length} noms`,
    E7: `≥ ${REFERENCE.E7.length}`,
    A1: `≥ ${REFERENCE.A1} renvois de capacités`,
    A2: `≥ ${REFERENCE.A2.length} paramètres`,
    A3: `≥ ${REFERENCE.A3.length} capacités`,
    I1: `≥ ${REFERENCE.I1} noms`,
  };
  const mesure = {
    E4: `${citees.length} citations, ${new Set(citees).size} noms ; + ${cibles.length} cible(s)`,
    A1: `${a1("la capacité")} de capacités, ${a1("l'élément")} d'éléments, ${a1("le paramètre")} de paramètres`,
    A2: `${new Set(noms(anomalies, "A2", /transmet le paramètre (.+?), qu'aucun/)).size} paramètres`,
  };
  const lignes = [["code", "gravité", "anomalies", "détail", "référence § 6.3"]];
  for (const code of Object.keys(GRAVITES)) {
    const nombre = anomalies.filter((a) => a.code === code).length;
    lignes.push([code, GRAVITES[code], nombre, mesure[code] ?? "", reference[code] ?? "—"]);
  }
  console.log("");
  tableau(lignes);

  console.log("\nComparaison avec la mesure de référence :");
  comparer("E4, capacités citées introuvables", citees, REFERENCE.E4.noms);
  if (cibles.length) console.log(`    cibles introuvables (hors référence) : ${[...new Set(cibles)].join(" · ")}`);
  const e7 = noms(anomalies, "E7", /Le bloc « (.+?) » transmet/);
  comparer("E7, blocs", e7, REFERENCE.E7);
  const admisSignales = REFERENCE.E7_admis.filter((nom) => e7.includes(nom));
  console.log(`  E7, cas admis (paramètre ciblé à côté du même sans cible) : ${admisSignales.length ? `signalés à tort : ${admisSignales.join(" · ")}` : "aucun signalé"}.`);
  comparer("A2, paramètres sans élément", noms(anomalies, "A2", /transmet le paramètre (.+?), qu'aucun/), REFERENCE.A2);
  comparer("A3, capacités orphelines", noms(anomalies, "A3", /La capacité « (.+?) » n'est rattachée/), REFERENCE.A3);
  console.log(`  A1, renvois de capacités : ${a1("la capacité")} trouvés, ${REFERENCE.A1} attendus au moins.`);
  console.log(`  I1, noms à espaces de bord : ${anomalies.filter((a) => a.code === "I1").length} trouvés, ${REFERENCE.I1} attendus au moins.`);
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
await bancComplet(octets, basename(chemin));
