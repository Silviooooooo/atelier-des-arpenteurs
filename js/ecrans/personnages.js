// L'écran « Mes personnages » (SPECIFICATION.md, § 15.3 et § 15.1).
//
// Les personnages de l'appareil, dans le mode de la page : créer, reprendre
// un brouillon, ouvrir une fiche, enregistrer le fichier, importer un
// fichier, ouvrir sur le téléphone, supprimer après confirmation. Tout
// fichier importé est une donnée hostile : lireFichierChoisi le borne et le
// vérifie avant que rien ne soit gardé. Les confirmations se font dans la
// page, jamais par window.confirm, que certains navigateurs bloquent.
//
// Sans banque typée, le créateur ne peut ni créer ni ouvrir : la liste
// reste, pour enregistrer le fichier d'un personnage ou le supprimer.

import { dateLisible } from "../banque/dates.js";
import { lirePersonnage, nouveauPersonnage, nouvelIdentifiant } from "../personnage/format.js";
import { ETAPES, banqueUtilisable } from "../personnage/parcours.js";
import { adressePersonnage } from "../routes.js";
import { compte, el, titre } from "./dom.js";
import { boutonFichier, lireFichierChoisi, panneauTelephone } from "./partage.js";

export const PHRASE_NON_DURABLE = "Cet appareil ne garde rien : les personnages disparaîtront à la fermeture de la page. Enregistrez leur fichier.";
const FICHIER_DEMO = "essais/personnage_demo.arpenteur.json";

const nomDe = (personnage) => personnage.identite.nom.trim() || "Sans nom";
const texteErreur = (erreur) => erreur?.message ?? String(erreur);

function demanderDoublon(zone) {
  return new Promise((resoudre) => {
    const repondre = (choix) => {
      zone.replaceChildren();
      resoudre(choix);
    };
    const annuler = el("button", { type: "button", classe: "bouton secondaire", onclick: () => repondre("annuler") }, "Annuler");
    zone.replaceChildren(
      el(
        "div",
        { classe: "confirmation", role: "group", "aria-label": "Personnage déjà présent" },
        el("p", {}, "Ce personnage est déjà sur cet appareil."),
        el(
          "div",
          { classe: "boutons" },
          el("button", { type: "button", classe: "bouton", onclick: () => repondre("remplacer") }, "Remplacer"),
          el("button", { type: "button", classe: "bouton secondaire", onclick: () => repondre("les_deux") }, "Garder les deux"),
          annuler,
        ),
      ),
    );
    annuler.focus();
  });
}

/**
 * Garde un personnage reçu (fichier, lien, démonstration). S'il est déjà
 * sur l'appareil, la zone demande : Remplacer, Garder les deux (sous un
 * nouvel identifiant), ou Annuler. Rend le personnage gardé, ou null.
 */
export async function garderRecu(etagere, personnage, zone) {
  let aGarder = personnage;
  if (await etagere.lire(personnage.id)) {
    const choix = await demanderDoublon(zone);
    if (choix === "annuler") return null;
    if (choix === "les_deux") aGarder = { ...personnage, id: nouvelIdentifiant() };
  }
  await etagere.garder(aGarder);
  return aGarder;
}

function etatDe(personnage) {
  if (personnage.etat === "enregistre") return `enregistré le ${dateLisible(personnage.enregistre_le).slice(0, 10)}`;
  return `brouillon, étape ${personnage.etape} sur ${ETAPES.length}`;
}

function carte(contexte, personnage, { utilisable, dire, rafraichir }) {
  const { etagere, mode } = contexte.etat;
  const nom = nomDe(personnage);
  const zoneTelephone = el("div", {});
  const zoneConfirmation = el("div", {});
  const actions = [];

  if (utilisable) {
    if (personnage.etat === "brouillon") {
      actions.push(el("a", { classe: "bouton", href: adressePersonnage(personnage.id, personnage.etape) }, "Reprendre"));
      actions.push(el("a", { classe: "bouton secondaire", href: adressePersonnage(personnage.id) }, "Aperçu"));
    } else {
      actions.push(el("a", { classe: "bouton", href: adressePersonnage(personnage.id) }, "Ouvrir"));
    }
  }
  const fichier = boutonFichier(personnage);
  fichier.className = `${fichier.className} secondaire`;
  actions.push(fichier);
  if (utilisable) {
    const telephone = el(
      "button",
      {
        type: "button",
        classe: "bouton secondaire",
        "aria-expanded": "false",
        onclick: () => {
          const ouvert = telephone.getAttribute("aria-expanded") === "true";
          telephone.setAttribute("aria-expanded", String(!ouvert));
          zoneTelephone.replaceChildren(...(ouvert ? [] : [panneauTelephone(personnage, { mode })]));
        },
      },
      "Ouvrir sur mon téléphone",
    );
    actions.push(telephone);
  }
  actions.push(
    el(
      "button",
      {
        type: "button",
        classe: "bouton secondaire",
        onclick: () => {
          const annuler = el("button", { type: "button", classe: "bouton secondaire", onclick: () => zoneConfirmation.replaceChildren() }, "Annuler");
          const supprimer = el(
            "button",
            {
              type: "button",
              classe: "bouton",
              onclick: async () => {
                supprimer.disabled = true;
                try {
                  await etagere.effacer(personnage.id);
                  dire(`Le personnage « ${nom} » est supprimé de cet appareil.`);
                } catch (erreur) {
                  dire(`Le personnage n'a pas pu être supprimé : ${texteErreur(erreur)}`, true);
                }
                await rafraichir();
              },
            },
            "Supprimer",
          );
          zoneConfirmation.replaceChildren(
            el(
              "div",
              { classe: "confirmation", role: "group", "aria-label": "Confirmer la suppression" },
              el("p", {}, `Supprimer « ${nom} » de cet appareil ? C'est définitif.`),
              el("div", { classe: "boutons" }, supprimer, annuler),
            ),
          );
          annuler.focus();
        },
      },
      "Supprimer",
    ),
  );

  const origines = [personnage.espece?.nom, personnage.archetype?.nom].filter(Boolean).join(" · ");
  return el(
    "li",
    { classe: "carte-personnage" },
    el("h2", {}, nom),
    el("p", { classe: "secondaire-texte" }, etatDe(personnage)),
    origines ? el("p", {}, origines) : null,
    el("div", { classe: "boutons" }, actions),
    zoneConfirmation,
    zoneTelephone,
  );
}

/** L'écran « Mes personnages ». */
export function afficher(contexte) {
  const { etagere, mode, banque } = contexte.etat;
  const verdict = banqueUtilisable(banque);
  const utilisable = !verdict.erreur;
  const zoneMessage = el("div", {});
  const zoneDoublon = el("div", {});
  const liste = el("div", {}, el("p", { classe: "attente", role: "status" }, "Lecture des personnages…"));

  const dire = (texte, erreur = false) => zoneMessage.replaceChildren(el("p", { classe: "message", role: erreur ? "alert" : "status" }, texte));

  const rafraichir = async () => {
    let lu;
    try {
      lu = await etagere.lister();
    } catch (erreur) {
      liste.replaceChildren(el("p", { classe: "message", role: "alert" }, `Les personnages de cet appareil n'ont pas pu être lus : ${texteErreur(erreur)}`));
      return;
    }
    const { personnages, illisibles } = lu;
    liste.replaceChildren(
      personnages.length
        ? el("ul", { classe: "personnages-liste" }, personnages.map((p) => carte(contexte, p, { utilisable, dire, rafraichir })))
        : el("p", { classe: "secondaire-texte" }, "Aucun personnage sur cet appareil."),
      illisibles ? el("p", { classe: "secondaire-texte" }, `${compte(illisibles, "personnage illisible est ignoré", "personnages illisibles sont ignorés")}.`) : null,
    );
  };

  // Un personnage lu (fichier ou démonstration) : gardé, doublon compris.
  const accueillir = async (personnage) => {
    try {
      const garde = await garderRecu(etagere, personnage, zoneDoublon);
      if (garde) dire(`Le personnage « ${nomDe(garde)} » est sur cet appareil.`);
    } catch (erreur) {
      dire(`Le personnage n'a pas pu être gardé : ${texteErreur(erreur)}`, true);
    }
    await rafraichir();
  };

  const creer = async () => {
    const personnage = nouveauPersonnage(mode);
    try {
      await etagere.garder(personnage);
    } catch (erreur) {
      dire(`Le personnage n'a pas pu être créé : ${texteErreur(erreur)}`, true);
      return;
    }
    contexte.naviguer(adressePersonnage(personnage.id, 1));
  };

  const importer = async (evenement) => {
    const entree = evenement.target;
    const lu = await lireFichierChoisi(entree.files?.[0], mode);
    entree.value = "";
    if (lu.erreur) {
      dire(lu.erreur, true);
      return;
    }
    await accueillir(lu.personnage);
  };

  const ajouterDemo = async () => {
    let texte;
    try {
      const reponse = await fetch(FICHIER_DEMO, { cache: "no-store" });
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      texte = await reponse.text();
    } catch {
      dire("Le personnage de démonstration est introuvable sur ce site.", true);
      return;
    }
    const lu = lirePersonnage(texte, { mode });
    if (lu.erreur) {
      dire(`Le personnage de démonstration est illisible : ${lu.erreur}`, true);
      return;
    }
    await accueillir(lu.personnage);
  };

  rafraichir();

  return el(
    "section",
    { classe: "personnages" },
    titre("Personnages"),
    verdict.erreur ? el("p", { classe: "message", role: "alert" }, verdict.erreur) : null,
    etagere.durable ? null : el("p", { classe: "message" }, PHRASE_NON_DURABLE),
    utilisable
      ? [
          el(
            "div",
            { classe: "boutons" },
            el("button", { type: "button", classe: "bouton", onclick: creer }, "Créer un personnage"),
            mode === "demo" ? el("button", { type: "button", classe: "bouton secondaire", onclick: ajouterDemo }, "Ajouter le personnage de démonstration") : null,
          ),
          el(
            "div",
            { classe: "formulaire" },
            el("label", { for: "import-personnage" }, "Importer un fichier"),
            el("input", { type: "file", id: "import-personnage", classe: "champ", accept: ".json,application/json", onchange: importer }),
          ),
        ]
      : null,
    zoneDoublon,
    zoneMessage,
    liste,
  );
}
