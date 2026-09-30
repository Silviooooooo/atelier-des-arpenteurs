// L'écran « Personnages » (SPECIFICATION.md, § 15.3, § 15.1 et § 15.8).
//
// Depuis le lot 2 bis : tous les personnages en ligne, visibles par tous les
// joueurs qui ont le mot de passe ; à part, ceux de cet appareil : les
// brouillons (et les copies de travail d'un « Modifier »), les envoyés en
// attente de l'automate, les non-envoyés avec « Réessayer ». Créer,
// reprendre, ouvrir, modifier, enregistrer le fichier, importer, ouvrir sur
// le téléphone, supprimer après confirmation. Tout fichier importé est une
// donnée hostile : lireFichierChoisi le borne et le vérifie avant que rien
// ne soit gardé. Les confirmations se font dans la page, jamais par
// window.confirm, que certains navigateurs bloquent.
//
// La démonstration ne dépose rien en ligne : tous ses personnages restent
// sur l'appareil, et la page le dit.
//
// Sans banque typée, le créateur ne peut ni créer ni ouvrir : la liste
// reste, pour enregistrer le fichier d'un personnage ou le supprimer.

import { dateLisible } from "../banque/dates.js";
import { lirePersonnage, nouveauPersonnage, nouvelIdentifiant } from "../personnage/format.js";
import { PHRASE_CLE_CHANGEE } from "../personnage/depot.js";
import { ETAPES, banqueUtilisable } from "../personnage/parcours.js";
import { adressePersonnage } from "../routes.js";
import { copieDeTravail } from "./creation.js";
import { compte, el, titre } from "./dom.js";
import { boutonFichier, lireFichierChoisi, panneauTelephone } from "./partage.js";

export const PHRASE_NON_DURABLE = "Cet appareil ne garde rien : les personnages disparaîtront à la fermeture de la page. Enregistrez leur fichier.";
const FICHIER_DEMO = "essais/personnage_demo.arpenteur.json";

const nomDe = (personnage) => personnage.identite.nom.trim() || "Sans nom";
const texteErreur = (erreur) => erreur?.message ?? String(erreur);
const heure = (iso) => dateLisible(iso);

// Une version, telle que la question la montre : nom, état, date.
const version = (personnage) => `« ${nomDe(personnage)} », ${etatDe(personnage)}, modifié le ${dateLisible(personnage.modifie_le)}`;

function demanderDoublon(zone, present, recu) {
  // Remplacer une version enregistrée par un brouillon, ou par plus ancien,
  // se dit en clair : c'est définitif (relecture du lot 2).
  const risques = [
    present.etat === "enregistre" && recu.etat === "brouillon" ? "La version reçue est un brouillon, celle de l'appareil est enregistrée." : null,
    Date.parse(recu.modifie_le) < Date.parse(present.modifie_le) ? "La version reçue est plus ancienne que celle de l'appareil." : null,
  ].filter(Boolean);
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
        el("p", {}, "Ce personnage est déjà sur cet appareil. Le remplacer est définitif."),
        el("ul", {}, el("li", {}, `Sur l'appareil : ${version(present)}.`), el("li", {}, `Reçu : ${version(recu)}.`)),
        risques.map((texte) => el("p", { classe: "message", role: "alert" }, texte)),
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
  const present = await etagere.lire(personnage.id);
  if (present) {
    const choix = await demanderDoublon(zone, present, personnage);
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

// La phrase d'état d'une carte, selon d'où vient le personnage.
function situation(genre, { personnage, note, original, enRetard, demo, plusAncienne, enLigne }) {
  if (genre === "en_ligne") return `en ligne · ${etatDe(personnage)}`;
  if (genre === "attente") return `envoyé le ${heure(note.depot.date)} : visible par tous d'ici quelques minutes`;
  if (genre === "brouillon") {
    const nomOriginal = original ? nomDe(original) : note?.nom;
    return nomOriginal ? `copie de travail de « ${nomOriginal} » · ${etatDe(personnage)}` : etatDe(personnage);
  }
  if (demo) return `sur cet appareil · ${etatDe(personnage)}`;
  if (plusAncienne) return `copie de cet appareil, plus ancienne que la version en ligne · modifiée le ${dateLisible(personnage.modifie_le)}`;
  if (enRetard) return `envoyé le ${heure(note.depot.date)}, toujours pas en ligne`;
  if (note?.depot?.erreur) return `non envoyé : ${note.depot.erreur}`;
  if (enLigne) return `modifié sur cet appareil, pas encore envoyé · ${etatDe(personnage)}`;
  return `sur cet appareil seulement · ${etatDe(personnage)}`;
}

// Une suppression pour tous qui n'est pas partie, ou qui tarde : la carte
// se montre même quand le personnage en ligne ne se lit plus (son nom vient
// alors de la note).
function carteSuppression(contexte, entree, { dire, rafraichir }) {
  const { etagere, mode, depot } = contexte.etat;
  const { personnage, note, enRetard } = entree;
  const nom = personnage ? nomDe(personnage) : (note.nom ?? `personnage ${note.id.slice(0, 8)}`);
  const actions = [];
  if (mode === "reel") {
    const reessayer = el(
      "button",
      {
        type: "button",
        classe: "bouton",
        onclick: async () => {
          reessayer.disabled = true;
          const resultat = await depot.reessayer(note.id);
          dire(resultat.envoye ? `La suppression de « ${nom} » part en ligne : effective d'ici quelques minutes.` : resultat.erreur, !resultat.envoye);
          await rafraichir();
        },
      },
      "Réessayer la suppression",
    );
    actions.push(reessayer);
  }
  actions.push(
    el(
      "button",
      {
        type: "button",
        classe: "bouton secondaire",
        onclick: async () => {
          await etagere.garderNote(note.id, { depot: null });
          dire(`La suppression de « ${nom} » est abandonnée.`);
          await rafraichir();
        },
      },
      "Garder en ligne",
    ),
  );
  return el(
    "li",
    { classe: "carte-personnage" },
    el("h2", {}, nom),
    el("p", { classe: "secondaire-texte" }, enRetard ? "suppression envoyée, sans effet encore" : `suppression non envoyée : ${note.depot.erreur ?? "raison inconnue"}`),
    el("div", { classe: "boutons" }, actions),
  );
}

/**
 * Une carte de personnage. genre : « en_ligne », « attente »,
 * « non_envoye », « brouillon ». outils : { utilisable, dire, rafraichir }.
 */
function carte(contexte, genre, entree, { utilisable, dire, rafraichir }) {
  if (entree.suppression) return carteSuppression(contexte, entree, { dire, rafraichir });
  const { etagere, mode, depot } = contexte.etat;
  const { personnage, note } = entree;
  const nom = nomDe(personnage);
  const zoneTelephone = el("div", {});
  const zoneConfirmation = el("div", {});
  const actions = [];

  const confirmer = (question, libelle, agir) => {
    const annuler = el("button", { type: "button", classe: "bouton secondaire", onclick: () => zoneConfirmation.replaceChildren() }, "Annuler");
    const valider = el(
      "button",
      {
        type: "button",
        classe: "bouton",
        onclick: async () => {
          valider.disabled = true;
          try {
            await agir();
          } catch (erreur) {
            dire(`${libelle} n'a pas abouti : ${texteErreur(erreur)}`, true);
          }
          await rafraichir();
        },
      },
      libelle,
    );
    zoneConfirmation.replaceChildren(el("div", { classe: "confirmation", role: "group", "aria-label": `Confirmer : ${libelle}` }, el("p", {}, question), el("div", { classe: "boutons" }, valider, annuler)));
    annuler.focus();
  };

  if (utilisable) {
    if (personnage.etat === "brouillon") {
      actions.push(el("a", { classe: "bouton", href: adressePersonnage(personnage.id, personnage.etape) }, "Reprendre"));
      actions.push(el("a", { classe: "bouton secondaire", href: adressePersonnage(personnage.id) }, "Aperçu"));
    } else {
      actions.push(el("a", { classe: "bouton", href: adressePersonnage(personnage.id) }, "Ouvrir"));
      const modifier = el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          onclick: async () => {
            modifier.disabled = true;
            try {
              contexte.naviguer(adressePersonnage(await copieDeTravail(etagere, personnage), 1));
            } catch (erreur) {
              modifier.disabled = false;
              dire(`La copie de travail n'a pas pu être créée : ${texteErreur(erreur)}`, true);
            }
          },
        },
        "Modifier",
      );
      actions.push(modifier);
    }
  }
  // « Réessayer » : un dépôt non envoyé, ou envoyé mais toujours pas en
  // ligne. Une version en ligne plus récente arrête l'envoi : il faut alors
  // le vouloir expressément, ou retirer la copie de l'appareil.
  if (genre === "non_envoye" && mode === "reel" && personnage.etat === "enregistre") {
    const envoyer = (forcer) => (note?.depot ? depot.reessayer(personnage.id, { forcer }) : depot.envoyer(personnage, { action: "creer", forcer }));
    const conclure = async (resultat) => {
      dire(resultat.envoye ? `« ${nom} » est parti en ligne : visible par tous d'ici quelques minutes.` : resultat.erreur, !resultat.envoye);
      await rafraichir();
    };
    const reessayer = el(
      "button",
      {
        type: "button",
        classe: "bouton",
        onclick: async () => {
          reessayer.disabled = true;
          const resultat = await envoyer(false);
          if (resultat.plusAncienne) {
            reessayer.disabled = false;
            confirmer(`Une version plus récente de « ${nom} » est en ligne. L'envoyer quand même la remplacera pour tous ; « Retirer de l'appareil » garde la version en ligne.`, "Envoyer quand même", async () => {
              const force = await envoyer(true);
              dire(force.envoye ? `« ${nom} » est parti en ligne : visible par tous d'ici quelques minutes.` : force.erreur, !force.envoye);
            });
            return;
          }
          await conclure(resultat);
        },
      },
      note?.depot ? "Réessayer" : "Envoyer en ligne",
    );
    actions.push(reessayer);
    if (entree.plusAncienne) {
      actions.push(
        el(
          "button",
          {
            type: "button",
            classe: "bouton secondaire",
            onclick: async () => {
              await etagere.effacer(personnage.id);
              await etagere.garderNote(personnage.id, { depot: null });
              dire(`La copie de « ${nom} » a quitté cet appareil ; la version en ligne reste.`);
              await rafraichir();
            },
          },
          "Retirer de l'appareil",
        ),
      );
    }
  }
  {
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
    // Supprimer : de l'appareil seulement (brouillon, non envoyé), ou pour
    // tous (en ligne, envoyé) par un ticket, l'historique de GitHub gardant
    // chaque version.
    const pourTous = mode === "reel" && (genre === "en_ligne" || genre === "attente");
    actions.push(
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          onclick: () =>
            confirmer(
              pourTous
                ? `Supprimer « ${nom} » pour tous les joueurs ? L'historique de GitHub garde chaque version : l'auteur peut la restaurer.`
                : `Supprimer « ${nom} » de cet appareil ? C'est définitif.`,
              "Supprimer",
              async () => {
                if (pourTous) {
                  const resultat = await depot.supprimer(personnage.id, { nom });
                  await etagere.effacer(personnage.id);
                  dire(resultat.envoye ? `La suppression de « ${nom} » part en ligne : effective d'ici quelques minutes.` : resultat.erreur, !resultat.envoye);
                } else {
                  await etagere.effacer(personnage.id);
                  await etagere.garderNote(personnage.id, null);
                  dire(`Le personnage « ${nom} » est supprimé de cet appareil.`);
                }
              },
            ),
        },
        "Supprimer",
      ),
    );
  }

  const origines = [personnage.espece?.nom, personnage.archetype?.nom].filter(Boolean).join(" · ");
  return el(
    "li",
    { classe: "carte-personnage" },
    el("h2", {}, nom),
    el("p", { classe: "secondaire-texte" }, situation(genre, entree)),
    origines ? el("p", {}, origines) : null,
    el("div", { classe: "boutons" }, actions),
    zoneConfirmation,
    zoneTelephone,
  );
}

/** L'écran « Personnages ». */
export function afficher(contexte) {
  const { etagere, mode, banque, depot } = contexte.etat;
  const verdict = banqueUtilisable(banque);
  const utilisable = !verdict.erreur;
  const zoneMessage = el("div", {});
  const zoneDoublon = el("div", {});
  const liste = el("div", {}, el("p", { classe: "attente", role: "status" }, "Lecture des personnages…"));

  const dire = (texte, erreur = false) => zoneMessage.replaceChildren(el("p", { classe: "message", role: erreur ? "alert" : "status" }, texte));

  const section = (intitule, genre, entrees, vide) =>
    el(
      "section",
      { classe: "rubrique-personnages" },
      el("h2", { classe: "titre-rubrique" }, intitule),
      entrees.length
        ? el("ul", { classe: "personnages-liste" }, entrees.map((entree) => carte(contexte, entree.genre ?? genre, entree, { utilisable, dire, rafraichir })))
        : el("p", { classe: "secondaire-texte" }, vide),
    );

  const rafraichir = async () => {
    let lu;
    try {
      lu = depot ? await depot.rapprocher() : null;
      if (!lu) {
        const { personnages, illisibles } = await etagere.lister();
        const notes = (await etagere.listerNotes?.()) ?? [];
        const noteDe = new Map(notes.map((n) => [n.id, n]));
        lu = {
          enLigne: [],
          attente: [],
          brouillons: personnages.filter((p) => p.etat === "brouillon").map((p) => ({ personnage: p, note: noteDe.get(p.id) })),
          nonEnvoyes: personnages.filter((p) => p.etat === "enregistre").map((p) => ({ personnage: p, note: noteDe.get(p.id), demo: mode !== "reel" })),
          illisibles,
          ancienneCle: 0,
        };
      }
    } catch (erreur) {
      liste.replaceChildren(el("p", { classe: "message", role: "alert" }, `Les personnages n'ont pas pu être lus : ${texteErreur(erreur)}`));
      return;
    }
    // L'original d'une copie de travail, pour la nommer.
    const tous = [...lu.enLigne, ...lu.attente.map((e) => e.personnage), ...lu.nonEnvoyes.map((e) => e.personnage)];
    for (const b of lu.brouillons) if (b.note?.remplace) b.original = tous.find((p) => p.id === b.note.remplace) ?? null;
    const parties = [];
    if (mode === "reel") {
      parties.push(
        section(
          "En ligne",
          "en_ligne",
          [...lu.attente.map((e) => ({ ...e, genre: "attente" })), ...lu.enLigne.map((p) => ({ personnage: p }))],
          lu.erreur ? "Les personnages en ligne ne se lisent pas pour l'instant." : "Aucun personnage en ligne.",
        ),
      );
      if (lu.erreur) parties.push(el("p", { classe: "message", role: "alert" }, lu.erreur));
      // Un fichier du sel de la banque en place que la page ne lit pas : c'est
      // la page qui tient l'ancienne clé (un changement pendant la visite).
      if (lu.cleChangee) parties.push(el("p", { classe: "message", role: "alert" }, `${PHRASE_CLE_CHANGEE} (${compte(lu.cleChangee, "personnage en ligne attend", "personnages en ligne attendent")} la nouvelle clé.)`));
      if (lu.ancienneCle) parties.push(el("p", { classe: "message" }, `${compte(lu.ancienneCle, "personnage en ligne est chiffré", "personnages en ligne sont chiffrés")} avec une ancienne clé de table : l'auteur doit les rechiffrer.`));
    }
    parties.push(section(mode === "reel" ? "Sur cet appareil : non envoyés" : "Sur cet appareil", "non_envoye", lu.nonEnvoyes, mode === "reel" ? "Aucun personnage en attente d'envoi." : "Aucun personnage enregistré."));
    parties.push(section("Brouillons", "brouillon", lu.brouillons, "Aucun brouillon."));
    if (lu.illisibles) parties.push(el("p", { classe: "secondaire-texte" }, `${compte(lu.illisibles, "personnage illisible est ignoré", "personnages illisibles sont ignorés")}.`));
    liste.replaceChildren(...parties);
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
    etagere.bloquee ? el("p", { classe: "message", role: "alert" }, etagere.bloquee) : etagere.durable ? null : el("p", { classe: "message" }, PHRASE_NON_DURABLE),
    depot?.raison ? el("p", { classe: "message" }, depot.raison) : null,
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
