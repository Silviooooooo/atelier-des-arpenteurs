// Enregistrer, importer et envoyer un personnage (SPECIFICATION.md, § 15.1).
//
// Le fichier *.arpenteur.json se fabrique et se lit sur l'appareil ; le
// lien « Ouvrir sur mon téléphone » porte le personnage dans le fragment de
// l'adresse, qui n'est jamais envoyé au serveur. Le code QR est hors lot.
// Tout fichier reçu se vérifie avant d'être lu en entier : sa taille
// d'abord, puis son schéma (format.js).
//
// Le personnage de démonstration (§ 15.7) se lit ici, sans écran : l'écran
// Personnages et la préparation du combat le partagent (contrat du lot 4,
// groupe 2, § 12.4). La lecture n'écrit rien ; c'est garderRecu
// (personnages.js) qui le garde, et sa phrase se fabrique ici.

import { TAILLE_MAX, adresseDuLien, codeDuLien, ecrirePersonnage, lirePersonnage, nomDeFichier } from "../personnage/format.js";
import { el, telecharger } from "./dom.js";

/** Le fichier du personnage de démonstration, servi avec le site (§ 15.7). */
export const FICHIER_DEMO = "essais/personnage_demo.arpenteur.json";

/**
 * Lit le personnage de démonstration. Rend { personnage } ou { erreur } ;
 * le fichier se relit à chaque fois, sans cache ; fetch se prête, celui de
 * la page à défaut.
 */
export async function lirePersonnageDeDemonstration(mode, { fetch = globalThis.fetch } = {}) {
  let texte;
  try {
    const reponse = await fetch(FICHIER_DEMO, { cache: "no-store" });
    if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
    texte = await reponse.text();
  } catch {
    return { erreur: "Le personnage de démonstration est introuvable sur ce site." };
  }
  const lu = lirePersonnage(texte, { mode });
  if (lu.erreur) return { erreur: `Le personnage de démonstration est illisible : ${lu.erreur}` };
  return { personnage: lu.personnage };
}

/** La phrase d'un personnage gardé sur l'appareil, « Sans nom » à défaut de nom. */
export function phraseDuPersonnageGarde(personnage) {
  const nom = String(personnage?.identite?.nom ?? "").trim() || "Sans nom";
  return `Le personnage « ${nom} » est sur cet appareil.`;
}

/** Le bouton « Enregistrer le fichier ». */
export function boutonFichier(personnage) {
  return el(
    "button",
    { type: "button", classe: "bouton", onclick: () => telecharger(nomDeFichier(personnage), ecrirePersonnage(personnage)) },
    "Enregistrer le fichier",
  );
}

/**
 * Lit un fichier choisi par la personne. Rend { personnage } ou { erreur } ;
 * un fichier de plus de 64 Ko n'est pas même lu.
 */
export async function lireFichierChoisi(fichier, mode) {
  if (!fichier) return { erreur: "Aucun fichier choisi." };
  if (fichier.size > TAILLE_MAX) return { erreur: `Ce fichier dépasse ${TAILLE_MAX / 1024} Ko : ce n'est pas un personnage de l'Atelier.` };
  let texte;
  try {
    texte = await fichier.text();
  } catch {
    return { erreur: "Ce fichier n'a pas pu être lu." };
  }
  return lirePersonnage(texte, { mode });
}

/**
 * Le panneau « Ouvrir sur mon téléphone » : le lien, un bouton qui le copie,
 * et le partage du système quand l'appareil en a un.
 */
export function panneauTelephone(personnage, { mode, emplacement = globalThis.location, navigateur = globalThis.navigator } = {}) {
  const etat = el("p", { classe: "secondaire-texte petit", role: "status" }, "Préparation du lien…");
  const champ = el("input", { type: "text", classe: "champ", readonly: true, "aria-label": "Lien vers le personnage", spellcheck: "false" });
  const copier = el("button", { type: "button", classe: "bouton", disabled: true }, "Copier le lien");
  const partager = navigateur?.share ? el("button", { type: "button", classe: "bouton", disabled: true }, "Partager…") : null;
  const panneau = el(
    "section",
    { classe: "panneau-telephone" },
    el("h2", {}, "Ouvrir sur mon téléphone"),
    el(
      "p",
      {},
      "Le lien porte tout le personnage dans l'adresse elle-même, sans serveur. Envoyez-le-vous (courriel, messagerie), ouvrez-le sur le téléphone, puis « Enregistrer sur cet appareil ». Le téléphone demandera le mot de passe de table s'il ne l'a pas encore.",
    ),
    champ,
    el("div", { classe: "actions" }, copier, partager),
    etat,
  );
  codeDuLien(personnage)
    .then((code) => {
      const adresse = adresseDuLien(code, { origine: emplacement.origin, chemin: emplacement.pathname, mode });
      champ.value = adresse;
      copier.disabled = false;
      if (partager) partager.disabled = false;
      etat.textContent = `Lien prêt : ${adresse.length.toLocaleString("fr-FR")} signes.`;
      copier.addEventListener("click", async () => {
        try {
          await navigateur.clipboard.writeText(adresse);
          etat.textContent = "Lien copié.";
        } catch {
          champ.select?.();
          etat.textContent = "Copie refusée par le navigateur : sélectionnez le lien et copiez-le.";
        }
      });
      partager?.addEventListener("click", () => {
        navigateur.share({ title: personnage.identite.nom || "Personnage", url: adresse }).catch(() => {});
      });
    })
    .catch((erreur) => {
      etat.textContent = `Le lien n'a pas pu être préparé : ${erreur?.message ?? String(erreur)}`;
    });
  return panneau;
}
