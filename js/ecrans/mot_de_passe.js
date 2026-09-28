// L'écran du mot de passe (SPECIFICATION.md, § 7.2 et § 9).
//
// Un champ, « se souvenir sur cet appareil » coché par défaut, et une
// attente pendant la dérivation de la clé, qui peut durer sur un téléphone.
// En démonstration, le mot de passe, public, est affiché avec un bouton qui
// le recopie dans le champ.

import { MOT_DE_PASSE_DEMO } from "../banque/chargement.js";
import { el, titre } from "./dom.js";

// Laisse le navigateur afficher l'attente avant le calcul de la clé. Une
// fenêtre cachée ou masquée ne peint pas, et requestAnimationFrame y attend
// indéfiniment : un délai court prend alors le relais (relevé du 28/09/2026).
export function laisserPeindre() {
  return new Promise((resoudre) => {
    requestAnimationFrame(() => setTimeout(resoudre, 0));
    setTimeout(resoudre, 100);
  });
}

export function afficher(contexte) {
  const { etat } = contexte;
  const champ = el("input", {
    type: "password",
    id: "mot-de-passe",
    classe: "champ",
    autocomplete: "current-password",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: "false",
    required: true,
  });
  const garder = el("input", { type: "checkbox", id: "garder", checked: true });
  const message = el("p", { classe: "message", role: "alert", hidden: true });
  const attente = el(
    "p",
    { classe: "attente", hidden: true, role: "status" },
    "Déverrouillage en cours : l'appareil calcule la clé, ce qui peut prendre quelques secondes.",
  );
  const bouton = el("button", { type: "submit", classe: "bouton" }, "Ouvrir la banque");

  const formulaire = el(
    "form",
    {
      classe: "formulaire",
      onsubmit: async (evenement) => {
        evenement.preventDefault();
        if (champ.value.trim() === "") return;
        bouton.disabled = true;
        message.hidden = true;
        attente.hidden = false;
        formulaire.setAttribute("aria-busy", "true");
        await laisserPeindre();
        const resultat = await contexte.deverrouiller(champ.value, garder.checked);
        formulaire.removeAttribute("aria-busy");
        attente.hidden = true;
        bouton.disabled = false;
        if (resultat.erreur) {
          message.textContent = resultat.code === "mot_de_passe" ? "Ce mot de passe n'ouvre pas la banque. Vérifiez-le, puis réessayez." : resultat.erreur;
          message.hidden = false;
          champ.select();
          return;
        }
        contexte.afficher();
      },
    },
    el("label", { for: "mot-de-passe" }, "Mot de passe de table"),
    champ,
    el("label", { classe: "case", for: "garder" }, garder, "Se souvenir sur cet appareil"),
    el("div", { classe: "boutons" }, bouton),
    attente,
    message,
  );

  const demo =
    etat.mode === "demo"
      ? el(
          "div",
          { classe: "mot-de-passe-demo" },
          el("p", {}, "Mot de passe de démonstration, public : ", el("span", { classe: "valeur" }, MOT_DE_PASSE_DEMO)),
          el(
            "button",
            {
              type: "button",
              classe: "bouton secondaire",
              onclick: () => {
                champ.value = MOT_DE_PASSE_DEMO;
                champ.focus();
              },
            },
            "Remplir le champ",
          ),
        )
      : null;

  return el(
    "section",
    {},
    titre("Mot de passe"),
    etat.motDePasse === "change"
      ? el("p", { classe: "message" }, "Le mot de passe de table a changé : saisissez le nouveau.")
      : el("p", {}, "La banque est chiffrée. Saisissez le mot de passe de table qu'on vous a transmis ; il suffit de le saisir une fois par appareil."),
    demo,
    formulaire,
  );
}
