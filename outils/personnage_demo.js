// Fabrique le personnage de démonstration (SPECIFICATION.md, § 15.7).
//
// Aubépine, la Marmitonne du classeur d'essai : un personnage complet,
// enregistré contre la banque de démonstration, prêt à imprimer. Contenu
// inventé, comme le classeur ; son fichier est le seul JSON en clair que le
// dépôt admet hors package.json (§ 10.3).
//
// Après une régénération de la banque de démonstration, relancer :
//   node outils/personnage_demo.js

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { calculerFiche, indexerCreation } from "../js/personnage/calcul.js";
import { ecrirePersonnage } from "../js/personnage/format.js";
import { relever } from "../js/personnage/suivi.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { DATE_ESSAI, personnageEssai } from "../tests/outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
export const CHEMIN_PERSONNAGE_DEMO = "essais/personnage_demo.arpenteur.json";

/** Le personnage de démonstration, enregistré contre une banque ouverte et son enveloppe. */
export function personnageDemo(banque, enveloppe) {
  const personnage = personnageEssai();
  const index = indexerCreation(banque);
  const fiche = calculerFiche(banque, personnage, { index });
  Object.assign(personnage, {
    etat: "enregistre",
    etape: 9,
    enregistre_le: DATE_ESSAI.toISOString(),
    banque: { empreinte: enveloppe.empreinte, publiee_le: enveloppe.publiee_le },
    empreintes: relever(index, fiche, personnage),
  });
  return personnage;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const enveloppe = JSON.parse(readFileSync(new URL("essais/banque_demo.chiffree.json", racine), "utf8"));
  const { banque, erreur } = await ouvrirAvecMotDePasse(enveloppe, MOT_DE_PASSE_DEMO);
  if (erreur) throw new Error(erreur);
  const cible = new URL(CHEMIN_PERSONNAGE_DEMO, racine);
  writeFileSync(cible, ecrirePersonnage(personnageDemo(banque, enveloppe)));
  console.log(`Écrit : ${fileURLToPath(cible)}`);
}
