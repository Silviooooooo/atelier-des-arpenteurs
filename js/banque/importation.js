// Import du classeur des règles (SPECIFICATION.md, § 5 et § 6).
//
// Transforme les feuilles lues par xlsx.js en banque au format du § 5.1 :
// blocs, capacités regroupées en variantes par puissance, éléments,
// lisez_moi. Chaque ligne garde le texte d'origine de ses cellules (brut),
// pour qu'un lot futur puisse réinterpréter les données sans nouvel import.
// Les colonnes se retrouvent par leur en-tête, jamais par leur position, et
// sans casse, accents ni espaces : l'auteur réordonne ses feuilles.
//
// L'import relève E1, E2, E6, A7 et I1 en lisant les lignes ; controle.js
// relève le reste sur la banque. Rien n'est corrigé : les anomalies voyagent
// avec la banque (§ 5.1).

import { lireClasseur } from "../lecture/xlsx.js";
import { empreinte } from "../securite/chiffrement.js";
import { anomalie, controler, trier } from "./controle.js";
import { cle } from "./noms.js";
import { lireCapacites, lireElements, lireElementsPropres, lireParametres, lireParametresRecus } from "./notation.js";

// En-têtes attendus (§ 4.1), par feuille ; lisez_moi n'en a pas.
export const COLONNES = {
  Blocs: {
    nom: "Nom",
    elements: "Eléments transmis aux capacités",
    capacites: "capacites",
    parametres: "Paramètres transmis aux capacités",
    notes: "Infos",
  },
  Eléments: { nom: "Nom", parametres_recus: "Paramètres reçus", description: "description" },
  Capacites: {
    notes: "origine",
    nom: "Nom",
    puissance: "puissance",
    cout_souffle: "Coût en souffle",
    cout_lien: "Coût en lien",
    elements: "Eléments propres",
    description: "description",
  },
};
const FEUILLES = ["lisez_moi", "Blocs", "Eléments", "Capacites"];

function lettres(indice) {
  let resultat = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) resultat = String.fromCharCode(65 + ((n - 1) % 26)) + resultat;
  return resultat;
}

// Les cellules d'une ligne sous leur en-tête tel qu'écrit ; une cellule sans
// en-tête n'est gardée que si elle porte quelque chose, sous sa colonne.
function cellulesParEntete(ligne, entetes) {
  const cellules = {};
  for (let i = 0; i < Math.max(entetes.length, ligne.cellules.length); i += 1) {
    const valeur = ligne.cellules[i] ?? "";
    const entete = (entetes[i] ?? "").trim();
    if (!entete && valeur === "") continue;
    let cleCellule = entete || `colonne ${lettres(i)}`;
    if (Object.hasOwn(cellules, cleCellule)) cleCellule += ` (colonne ${lettres(i)})`;
    // defineProperty : une colonne « __proto__ » se garde comme les autres,
    // au lieu de toucher au prototype et de disparaître en silence.
    Object.defineProperty(cellules, cleCellule, { value: valeur, enumerable: true, writable: true, configurable: true });
  }
  return cellules;
}

function ouSontLesEspaces(nom) {
  const debut = nom !== nom.trimStart();
  const fin = nom !== nom.trimEnd();
  return debut && fin ? "au début et à la fin" : debut ? "au début" : "à la fin";
}

// Lit les lignes de données d'une feuille à en-têtes : E2 pour une ligne
// sans nom, I1 pour un nom à espaces de bord.
function lignesDeDonnees(nomFeuille, feuille, colonnes, entetes, anomalies) {
  const lignes = [];
  for (const ligne of feuille.lignes) {
    if (ligne.numero === 1 || ligne.cellules.every((cellule) => cellule.trim() === "")) continue;
    const valeur = (champ) => ligne.cellules[colonnes[champ]] ?? "";
    const nomEcrit = valeur("nom");
    const nom = nomEcrit.trim();
    if (nom === "") {
      anomalies.push(anomalie("E2", nomFeuille, ligne.numero, `La ligne ${ligne.numero} n'est pas vide mais n'a pas de nom : elle n'entre pas dans la banque.`));
      continue;
    }
    if (nom !== nomEcrit) {
      anomalies.push(anomalie("I1", nomFeuille, ligne.numero, `Le nom « ${nom} » portait des espaces ${ouSontLesEspaces(nomEcrit)} ; ils sont retirés.`));
    }
    lignes.push({ nom, valeur, ligne: ligne.numero, brut: { feuille: nomFeuille, ligne: ligne.numero, cellules: cellulesParEntete(ligne, entetes) } });
  }
  return lignes;
}

/**
 * Importe un classeur lu par lireClasseur. Rend { banque, anomalies } ; la
 * banque est null quand une feuille ou un en-tête attendu manque (E1).
 * source : { classeur, fichier, empreinte }, recopiée dans banque.sources.
 */
export function importerClasseur(classeur, source = null) {
  const anomalies = [];
  const feuilles = {};
  for (const nom of FEUILLES) {
    const feuille = classeur.feuilles.find((f) => cle(f.nom) === cle(nom));
    if (feuille) feuilles[nom] = feuille;
    else anomalies.push(anomalie("E1", nom, null, `La feuille « ${nom} » est introuvable : l'import s'arrête.`));
  }
  const colonnes = {};
  const entetes = {};
  for (const [nom, attendus] of Object.entries(COLONNES)) {
    if (!feuilles[nom]) continue;
    entetes[nom] = feuilles[nom].lignes.find((ligne) => ligne.numero === 1)?.cellules ?? [];
    colonnes[nom] = {};
    for (const [champ, entete] of Object.entries(attendus)) {
      colonnes[nom][champ] = entetes[nom].findIndex((cellule) => cle(cellule) === cle(entete));
      if (colonnes[nom][champ] === -1) {
        anomalies.push(anomalie("E1", nom, 1, `L'en-tête « ${entete} » est introuvable dans la feuille ${nom} : l'import s'arrête.`));
      }
    }
  }
  if (anomalies.length) return { banque: null, anomalies: trier(anomalies) };

  // Les anomalies de notation reçoivent leur lieu : feuille, ligne, colonne.
  const noter = (resultat, feuille, ligne, sujet, champ) => {
    const colonne = entetes[feuille][colonnes[feuille][champ]];
    for (const { code, message } of resultat.anomalies) anomalies.push(anomalie(code, feuille, ligne, `${sujet}, colonne « ${colonne} » : ${message}.`));
    return resultat.valeurs;
  };
  const lignes = (feuille) => lignesDeDonnees(feuille, feuilles[feuille], colonnes[feuille], entetes[feuille], anomalies);

  const blocs = lignes("Blocs").map(({ nom, valeur, ligne, brut }) => {
    const sujet = `Le bloc « ${nom} »`;
    return {
      nom,
      elements: noter(lireElements(valeur("elements")), "Blocs", ligne, sujet, "elements"),
      capacites: noter(lireCapacites(valeur("capacites")), "Blocs", ligne, sujet, "capacites"),
      parametres: noter(lireParametres(valeur("parametres")), "Blocs", ligne, sujet, "parametres"),
      notes: valeur("notes"),
      brut,
    };
  });

  const elements = lignes("Eléments").map(({ nom, valeur, ligne, brut }) => ({
    nom,
    parametres_recus: noter(lireParametresRecus(valeur("parametres_recus")), "Eléments", ligne, `L'élément « ${nom} »`, "parametres_recus"),
    description: valeur("description"),
    brut,
  }));

  // Une capacité à plusieurs puissances occupe plusieurs lignes de même nom :
  // une variante par ligne (§ 5.1).
  const capacitesParNom = new Map();
  for (const { nom, valeur, ligne, brut } of lignes("Capacites")) {
    if (!capacitesParNom.has(nom)) capacitesParNom.set(nom, { nom, variantes: [] });
    capacitesParNom.get(nom).variantes.push({
      puissance: valeur("puissance").trim(),
      cout_souffle: valeur("cout_souffle").trim(),
      cout_lien: valeur("cout_lien").trim(),
      elements: noter(lireElementsPropres(valeur("elements")), "Capacites", ligne, `La capacité « ${nom} »`, "elements"),
      description: valeur("description"),
      notes: valeur("notes"),
      brut,
    });
  }

  // lisez_moi : colonne A = rubrique, B = texte, tels qu'écrits (§ 4.1).
  const lisezMoi = feuilles.lisez_moi.lignes
    .filter((ligne) => (ligne.cellules[0] ?? "").trim() !== "" || (ligne.cellules[1] ?? "").trim() !== "")
    .map((ligne) => ({ rubrique: (ligne.cellules[0] ?? "").trim(), texte: ligne.cellules[1] ?? "" }));

  const banque = {
    format: 1,
    sources: source ? [source] : [],
    blocs,
    capacites: [...capacitesParNom.values()],
    elements,
    lisez_moi: lisezMoi,
    anomalies: [],
  };
  banque.anomalies = trier([...anomalies, ...controler(banque)]);
  return { banque, anomalies: banque.anomalies };
}

/**
 * Lit, importe et contrôle un fichier de classeur des règles. Rend
 * { banque, anomalies } comme importerClasseur, ou { erreur } quand le
 * fichier n'est pas un classeur lisible.
 */
export async function importerFichier(octets, fichier) {
  const classeur = await lireClasseur(octets);
  if (classeur.erreur) return { erreur: classeur.erreur };
  return importerClasseur(classeur, { classeur: "regles", fichier, empreinte: await empreinte(octets) });
}
