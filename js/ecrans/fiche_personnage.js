// La fiche d'un personnage (SPECIFICATION.md, § 15.4 et § 15.5).
//
// Deux vues : la vue lecture, les rubriques empilées pour un téléphone ; la
// vue fiche, le recto et le verso à l'échelle de l'écran, que l'on zoome à
// deux doigts. Le bouton « Imprimer / PDF » imprime toujours le recto puis
// le verso, quelle que soit la vue. La fiche se recalcule avec la banque du
// jour (calcul.js).
//
// Depuis le lot 2 bis : un personnage en ligne s'ouvre aussi (lu du site,
// déchiffré) ; « Modifier » en ouvre une copie de travail ; la qualité des
// objets, 2 à la création, se change ici, objet par objet, et le personnage
// modifié repart en ligne.
//
// Le recto ne déborde jamais : repartition.js répartit les lignes selon les
// places mesurées du modèle ; si le navigateur mesure malgré tout un
// débordement (une police qui manque), une ligne de plus passe au verso.

import { dateLisible } from "../banque/dates.js";
import { feuilles } from "../fiche/feuilles.js";
import { lecture } from "../fiche/lecture.js";
import { PLACES } from "../fiche/repartition.js";
import { calculerFiche } from "../personnage/calcul.js";
import { ErreurPersonnage, verifier } from "../personnage/format.js";
import { ETAPES, banqueUtilisable } from "../personnage/parcours.js";
import { copieDeTravail } from "./creation.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer } from "./dom.js";
import { boutonFichier, panneauTelephone } from "./partage.js";

const LARGEUR_FEUILLE = 794;
// Le motif d'une qualité saisie : celui que format.js vérifie.
const QUALITE = /^\d{1,3}(?:,\d{1,2})?$/;
const MEMOIRE_VUE = "atelier.vue-personnage";

function vueMemorisee() {
  try {
    const vue = localStorage.getItem(MEMOIRE_VUE);
    if (vue === "lecture" || vue === "fiche") return vue;
  } catch {
    // stockage refusé : la vue suit la largeur de l'écran
  }
  return globalThis.matchMedia?.("(min-width: 56rem)").matches ? "fiche" : "lecture";
}

function memoriserVue(vue) {
  try {
    localStorage.setItem(MEMOIRE_VUE, vue);
  } catch {
    // stockage refusé : sans effet
  }
}

/**
 * Réduit les places du recto tant qu'une rubrique déborde, mesure du
 * navigateur faite. Ce sont les rubriques elles-mêmes qui ont la hauteur du
 * modèle et cachent ce qui dépasse : c'est elles qu'on mesure. Une rubrique
 * sans hauteur (fiche pas encore mise en page) ne dit rien.
 */
export function ajuster(conteneur, fiche, places) {
  for (let essai = 0; essai < 8; essai += 1) {
    const rectoNoeud = conteneur.querySelector(".recto");
    if (!rectoNoeud) return places;
    const deborde = (selecteur) => {
      const noeud = rectoNoeud.querySelector(selecteur);
      return Boolean(noeud && noeud.clientHeight > 0 && noeud.scrollHeight > noeud.clientHeight + 1);
    };
    const capacites = deborde(".rubrique-capacites");
    const equipement = deborde(".rubrique-equipement");
    const liens = deborde(".rubrique-liens");
    if (!capacites && !equipement && !liens) return places;
    if (capacites) places.capacites -= 1;
    if (equipement) places.equipement -= 1;
    if (liens) places.pouvoirs -= 1;
    conteneur.replaceChildren(feuilles(fiche, places));
  }
  return places;
}

// Les écouteurs de la fiche affichée : une seule fiche à la fois, et ceux
// de la précédente se retirent (§ 15.5).
let ecouteurs = [];
function ecouter(type, fonction) {
  globalThis.addEventListener?.(type, fonction);
  ecouteurs.push([type, fonction]);
}
function retirerEcouteurs() {
  for (const [type, fonction] of ecouteurs) globalThis.removeEventListener?.(type, fonction);
  ecouteurs = [];
}

function echelle(conteneur) {
  const largeur = conteneur.parentNode?.clientWidth ?? 0;
  const facteur = largeur > 0 ? Math.min(1, largeur / LARGEUR_FEUILLE) : 1;
  conteneur.style?.setProperty("--echelle", String(facteur));
}

async function imprimer(mesurer) {
  // Les polices de la fiche avant l'impression : sinon le PDF prend celles
  // du système. Puis une dernière mesure, avec elles.
  try {
    await Promise.all(["11px Marcellus", "11px 'Alegreya Sans'", "italic 11px 'Alegreya Sans'", "500 11px 'Alegreya Sans'"].map((police) => document.fonts.load(police)));
    await document.fonts.ready;
  } catch {
    // polices indisponibles : l'impression se fait avec celles de secours
  }
  mesurer();
  globalThis.print();
}

// La qualité des objets, que le MJ fixe (2 à la création) : un champ par
// objet dont la qualité n'est pas fixée par le classeur. Enregistrer garde
// le personnage sur l'appareil et, en ligne, le redépose.
function qualites(contexte, personnage, fiche, zone) {
  const modifiables = fiche.equipement.filter((o) => o.qualite.applicable && !o.qualite.fixee);
  if (!modifiables.length) return null;
  const message = el("div", {});
  const champs = modifiables.map((o) => {
    const id = `qualite-${o.rang}`;
    const entree = el("input", { type: "text", id, classe: "champ champ-court", inputmode: "decimal", pattern: "\\d{1,3}(,\\d{1,2})?", maxlength: 6, autocomplete: "off" });
    entree.value = personnage.equipement[o.rang].qualite ?? "";
    return { rang: o.rang, entree, noeud: el("div", {}, el("label", { for: id }, o.nom), entree) };
  });
  const dire = (texte, erreur = false) => message.replaceChildren(el("p", { classe: "message", role: erreur ? "alert" : "status" }, texte));
  const enregistrer = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      onclick: async () => {
        const copie = structuredClone(personnage);
        for (const { rang, entree } of champs) {
          const texte = entree.value.trim();
          if (texte !== "" && !QUALITE.test(texte)) {
            dire(`« ${copie.equipement[rang].nom} » : un nombre comme 2 ou 1,5, ou rien pour X.`, true);
            entree.focus();
            return;
          }
          copie.equipement[rang].qualite = texte === "" ? null : texte;
        }
        copie.modifie_le = new Date().toISOString();
        enregistrer.disabled = true;
        try {
          verifier(copie);
          await contexte.etat.etagere.garder(copie);
        } catch (erreur) {
          if (!(erreur instanceof ErreurPersonnage)) throw erreur;
          enregistrer.disabled = false;
          dire(`Les qualités n'ont pas pu être gardées : ${erreur.message}`, true);
          return;
        }
        const depot = contexte.etat.depot;
        const envoi = depot && copie.etat === "enregistre" && contexte.etat.mode === "reel" ? await depot.envoyer(copie, { action: "remplacer" }) : null;
        afficherPersonnage(contexte, copie, zone);
        const suite = envoi ? (envoi.envoye ? " Il part en ligne : visible par tous d'ici quelques minutes." : ` Non envoyé : ${envoi.erreur}`) : "";
        zone.querySelector(".qualites-message")?.replaceChildren(el("p", { classe: "message", role: "status" }, `Les qualités sont gardées.${suite}`));
      },
    },
    "Enregistrer les qualités",
  );
  return el(
    "details",
    { classe: "qualites ne-pas-imprimer" },
    el("summary", {}, "Qualité des objets"),
    el("p", { classe: "secondaire-texte petit" }, "2 à la création ; le MJ la fixe ensuite. Un nombre comme 2 ou 1,5 ; vide : X."),
    champs.map((c) => c.noeud),
    el("div", { classe: "boutons" }, enregistrer),
    message,
  );
}

function afficherPersonnage(contexte, personnage, zone, { enLigne = false } = {}) {
  const { banque, mode } = contexte.etat;
  const fiche = calculerFiche(banque, personnage);
  const places = { ...PLACES };
  titrer(personnage.identite.nom || "Personnage");
  let vue = vueMemorisee();
  const racine = el("div", { classe: `ecran-personnage vue-${vue}` });
  const impression = el("div", { classe: "impression" }, feuilles(fiche));
  const cadreImpression = el("div", { classe: "cadre-feuilles" }, impression);
  const telephone = el("div", { classe: "ne-pas-imprimer" });
  const boutonsVue = {
    lecture: el("button", { type: "button", classe: "bouton secondaire", "aria-pressed": String(vue === "lecture") }, "Vue lecture"),
    fiche: el("button", { type: "button", classe: "bouton secondaire", "aria-pressed": String(vue === "fiche") }, "Vue fiche"),
  };
  const changerVue = (nouvelle) => {
    vue = nouvelle;
    memoriserVue(vue);
    racine.className = `ecran-personnage vue-${vue}`;
    for (const [nom, bouton] of Object.entries(boutonsVue)) bouton.setAttribute("aria-pressed", String(nom === vue));
    globalThis.requestAnimationFrame?.(() => mesurer());
  };
  boutonsVue.lecture.addEventListener("click", () => changerVue("lecture"));
  boutonsVue.fiche.addEventListener("click", () => changerVue("fiche"));
  let panneauOuvert = false;
  const boutonTelephone = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      "aria-expanded": "false",
      onclick: () => {
        panneauOuvert = !panneauOuvert;
        boutonTelephone.setAttribute("aria-expanded", String(panneauOuvert));
        telephone.replaceChildren(panneauOuvert ? panneauTelephone(personnage, { mode }) : "");
      },
    },
    "Ouvrir sur mon téléphone",
  );

  const etat =
    personnage.etat === "enregistre"
      ? `Enregistré le ${dateLisible(personnage.enregistre_le).slice(0, 10)}`
      : `Brouillon, étape ${personnage.etape} sur ${ETAPES.length} : la fiche n'est pas définitive.`;
  const modifier =
    personnage.etat === "enregistre"
      ? el(
          "button",
          {
            type: "button",
            classe: "bouton",
            onclick: async () => {
              modifier.disabled = true;
              try {
                contexte.naviguer(adressePersonnage(await copieDeTravail(contexte.etat.etagere, personnage), 1));
              } catch (erreur) {
                modifier.disabled = false;
                zone.querySelector(".qualites-message")?.replaceChildren(el("p", { classe: "message", role: "alert" }, `La copie de travail n'a pas pu être créée : ${erreur.message}`));
              }
            },
          },
          "Modifier",
        )
      : null;
  racine.append(
    el(
      "div",
      { classe: "barre-personnage ne-pas-imprimer" },
      titre(personnage.identite.nom || "Personnage sans nom"),
      el("p", { classe: "secondaire-texte" }, enLigne ? `${etat} · en ligne` : etat),
      el(
        "div",
        { classe: "actions" },
        boutonsVue.lecture,
        boutonsVue.fiche,
        el("button", { type: "button", classe: "bouton bouton-principal", onclick: () => imprimer(mesurer) }, "Imprimer / PDF"),
        boutonFichier(personnage),
        boutonTelephone,
        personnage.etat === "brouillon" ? el("a", { classe: "bouton", href: adressePersonnage(personnage.id, personnage.etape) }, "Reprendre la création") : null,
        modifier,
        el("a", { href: "#/personnages" }, "Tous les personnages"),
      ),
      telephone,
      el("div", { classe: "qualites-message" }),
      qualites(contexte, personnage, fiche, zone),
    ),
    el("div", { classe: "vue-lecture-contenu ne-pas-imprimer" }, lecture(fiche)),
    cadreImpression,
  );
  zone.replaceChildren(racine);
  // La mesure demande la page affichée, et ses polices chargées ; en vue
  // lecture, la fiche reste mise en page, invisible, et se mesure aussi.
  function mesurer() {
    if (!impression.isConnected) {
      retirerEcouteurs();
      return;
    }
    ajuster(impression, fiche, places);
    if (vue === "fiche") echelle(impression);
  }
  retirerEcouteurs();
  if (globalThis.requestAnimationFrame && document.fonts?.ready) {
    requestAnimationFrame(mesurer);
    document.fonts.ready.then(mesurer).catch(() => {});
    ecouter("resize", mesurer);
    ecouter("beforeprint", mesurer);
  }
}

/** L'écran #/personnage/<id>. */
export function afficher(contexte, route) {
  const zone = el("section", { classe: "zone-personnage" }, el("p", { classe: "attente", role: "status" }, "Lecture du personnage…"));
  const utilisable = banqueUtilisable(contexte.etat.banque);
  if (utilisable.erreur) {
    return el("section", {}, titre("Personnage"), el("p", { classe: "message", role: "alert" }, utilisable.erreur), el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Tous les personnages")));
  }
  contexte.etat.etagere
    .lire(route.id)
    .then(async (local) => {
      // Sur l'appareil d'abord ; sinon, en ligne (§ 15.8).
      const enLigne = local ? null : ((await contexte.etat.depot?.lire(route.id)) ?? null);
      const personnage = local ?? enLigne;
      if (!personnage) {
        zone.replaceChildren(titre("Personnage introuvable"), el("p", { classe: "message" }, "Ce personnage n'est ni sur cet appareil, ni en ligne."), el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Tous les personnages")));
        return;
      }
      afficherPersonnage(contexte, personnage, zone, { enLigne: Boolean(enLigne) });
    })
    .catch((erreur) => {
      zone.replaceChildren(el("p", { classe: "message", role: "alert" }, `Ce personnage n'a pas pu s'ouvrir : ${erreur?.message ?? String(erreur)}`));
    });
  return zone;
}
