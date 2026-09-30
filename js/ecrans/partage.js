// Enregistrer, importer et envoyer un personnage (SPECIFICATION.md, § 15.1).
//
// Le fichier *.arpenteur.json se fabrique et se lit sur l'appareil ; le
// lien « Ouvrir sur mon téléphone » porte le personnage dans le fragment de
// l'adresse, qui n'est jamais envoyé au serveur. Le code QR est hors lot.
// Tout fichier reçu se vérifie avant d'être lu en entier : sa taille
// d'abord, puis son schéma (format.js).

import { TAILLE_MAX, adresseDuLien, codeDuLien, ecrirePersonnage, lirePersonnage, nomDeFichier } from "../personnage/format.js";
import { el, telecharger } from "./dom.js";

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
