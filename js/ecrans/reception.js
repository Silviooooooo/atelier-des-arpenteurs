// Un personnage reçu par lien (SPECIFICATION.md, § 15.1).
//
// Le lien « Ouvrir sur mon téléphone » porte le personnage dans le fragment
// de l'adresse (#/recevoir/<code>), que n'importe qui peut forger : le code
// est une donnée hostile, que lireCode borne et vérifie champ par champ ;
// un personnage de l'autre mode (réel, démonstration) est refusé. L'écran
// montre un aperçu, et ne garde rien sans « Enregistrer sur cet appareil ».

import { lecture } from "../fiche/lecture.js";
import { calculerFiche, indexerCreation } from "../personnage/calcul.js";
import { lireCode } from "../personnage/format.js";
import { banqueUtilisable } from "../personnage/parcours.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer } from "./dom.js";
import { PHRASE_NON_DURABLE, garderRecu } from "./personnages.js";

const texteErreur = (erreur) => erreur?.message ?? String(erreur);
const versLaListe = () => el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Personnages"));

function refuser(entete, contenu, message) {
  entete.textContent = "Lien refusé";
  titrer("Lien refusé");
  contenu.replaceChildren(el("p", { classe: "message", role: "alert" }, message), versLaListe());
}

function montrer(contexte, contenu, personnage) {
  const { banque, etagere } = contexte.etat;
  const verdict = banqueUtilisable(banque);
  const zoneDoublon = el("div", {});
  const zoneMessage = el("div", {});
  const enregistrer = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      onclick: async () => {
        enregistrer.disabled = true;
        zoneMessage.replaceChildren();
        try {
          const garde = await garderRecu(etagere, personnage, zoneDoublon);
          if (garde) {
            contexte.naviguer(adressePersonnage(garde.id));
            return;
          }
        } catch (erreur) {
          zoneMessage.replaceChildren(el("p", { classe: "message", role: "alert" }, `Le personnage n'a pas pu être enregistré : ${texteErreur(erreur)}`));
        }
        enregistrer.disabled = false;
      },
    },
    "Enregistrer sur cet appareil",
  );
  // replaceChildren écrirait « null » : les parties absentes sont retirées.
  contenu.replaceChildren(
    ...[
      el("p", {}, "Ce personnage est arrivé par un lien : il n'est pas encore sur cet appareil."),
      etagere.durable ? null : el("p", { classe: "message" }, PHRASE_NON_DURABLE),
      el("div", { classe: "boutons" }, enregistrer),
      zoneDoublon,
      zoneMessage,
      verdict.erreur ? el("p", { classe: "message", role: "alert" }, verdict.erreur) : lecture(calculerFiche(banque, personnage, { index: indexerCreation(banque) })),
    ].filter(Boolean),
  );
}

/** L'écran d'un personnage reçu par lien. */
export function afficher(contexte, route) {
  const entete = titre("Personnage reçu");
  const contenu = el("div", {}, el("p", { classe: "attente", role: "status" }, "Lecture du personnage…"));
  lireCode(route.code, { mode: contexte.etat.mode })
    .then((lu) => (lu.erreur ? refuser(entete, contenu, lu.erreur) : montrer(contexte, contenu, lu.personnage)))
    .catch((erreur) => refuser(entete, contenu, `Ce lien n'a pas pu être lu : ${texteErreur(erreur)}`));
  return el("section", { classe: "reception" }, entete, contenu);
}
