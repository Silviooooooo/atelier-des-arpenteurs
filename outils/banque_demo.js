// Fabrique la banque de démonstration (SPECIFICATION.md, § 9).
//
// Elle vient du classeur d'essai, fictif, par le vrai code d'import, de
// contrôle et de préparation de la publication, chiffrée avec le mot de
// passe de démonstration, qui est public. Elle se range dans essais/, jamais
// dans donnees/ : la première vraie publication restera une première
// publication.
//
// Le sel de la banque existante se garde, comme pour la banque réelle
// (§ 7.1) : la clé qu'un appareil d'essai a gardée reste valable.
//
// Après une modification du classeur d'essai ou de l'import, relancer :
//   node outils/banque_demo.js

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { importerFichier } from "../js/banque/importation.js";
import { preparerPublication } from "../js/publication/preparation.js";
import { deriverCle, lireEnTete, nouveauSecret } from "../js/securite/chiffrement.js";

const racine = new URL("../", import.meta.url);
const classeur = new URL("essais/classeur_essai.xlsx", racine);
const cible = new URL("essais/banque_demo.chiffree.json", racine);

const { banque, erreur } = await importerFichier(readFileSync(classeur), "classeur_essai.xlsx");
if (erreur) throw new Error(erreur);

let secret = await nouveauSecret(MOT_DE_PASSE_DEMO);
if (existsSync(cible)) {
  const enTete = lireEnTete(JSON.parse(readFileSync(cible, "utf8")));
  if (!enTete.erreur) secret = await deriverCle(MOT_DE_PASSE_DEMO, enTete.sel, enTete.iterations);
}

const preparation = await preparerPublication({ publiee: { enveloppe: null }, banque, secret });
if (preparation.erreur) throw new Error(preparation.erreur);
writeFileSync(cible, `${JSON.stringify(preparation.enveloppe, null, 2)}\n`);
console.log(`Écrit : ${fileURLToPath(cible)}`);
console.log(`${preparation.message} ; ${banque.anomalies.length} anomalies ; dérivation : ${secret.duree} ms.`);
