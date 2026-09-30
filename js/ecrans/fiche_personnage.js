// La fiche d'un personnage (SPECIFICATION.md, § 15.4 et § 15.5).
//
// Deux vues : la vue lecture, les rubriques empilées pour un téléphone ; la
// vue fiche, le recto et le verso à l'échelle de l'écran, que l'on zoome à
// deux doigts. Le bouton « Imprimer / PDF » imprime toujours le recto puis
// le verso, quelle que soit la vue. La fiche se recalcule avec la banque du
// jour (calcul.js).
//
// Le recto ne déborde jamais : repartition.js répartit les lignes selon les
// places mesurées du modèle ; si le navigateur mesure malgré tout un
// débordement (une police qui manque), une ligne de plus passe au verso.

import { dateLisible } from "../banque/dates.js";
import { feuilles } from "../fiche/feuilles.js";
import { lecture } from "../fiche/lecture.js";
import { PLACES } from "../fiche/repartition.js";
import { calculerFiche } from "../personnage/calcul.js";
import { banqueUtilisable } from "../personnage/parcours.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer } from "./dom.js";
import { boutonFichier, panneauTelephone } from "./partage.js";

const LARGEUR_FEUILLE = 794;
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

/** Les places du recto, réduites tant qu'une rubrique déborde (mesure du navigateur). */
function ajuster(conteneur, fiche) {
  const places = { ...PLACES };
  for (let essai = 0; essai < 8; essai += 1) {
    const rectoNoeud = conteneur.querySelector(".recto");
    if (!rectoNoeud || typeof rectoNoeud.getBoundingClientRect !== "function") return;
    const deborde = (selecteur) => {
      const noeud = rectoNoeud.querySelector(selecteur);
      return noeud && noeud.scrollHeight > noeud.clientHeight + 1;
    };
    const capacites = deborde(".rubrique-capacites .rubrique-corps");
    const equipement = deborde(".rubrique-equipement .rubrique-corps");
    const liens = deborde(".rubrique-liens .rubrique-corps");
    if (!capacites && !equipement && !liens) return;
    if (capacites) places.capacites -= 1;
    if (equipement) places.equipement -= 1;
    if (liens) places.pouvoirs -= 1;
    conteneur.replaceChildren(feuilles(fiche, places));
  }
}

function echelle(conteneur) {
  const largeur = conteneur.parentNode?.clientWidth ?? 0;
  const facteur = largeur > 0 ? Math.min(1, largeur / LARGEUR_FEUILLE) : 1;
  conteneur.style?.setProperty("--echelle", String(facteur));
}

async function imprimer() {
  // Les polices de la fiche avant l'impression : sinon le PDF prend celles
  // du système.
  try {
    await Promise.all(["11px Marcellus", "11px 'Alegreya Sans'", "italic 11px 'Alegreya Sans'", "500 11px 'Alegreya Sans'"].map((police) => document.fonts.load(police)));
    await document.fonts.ready;
  } catch {
    // polices indisponibles : l'impression se fait avec celles de secours
  }
  globalThis.print();
}

function afficherPersonnage(contexte, personnage, zone) {
  const { banque, mode } = contexte.etat;
  const fiche = calculerFiche(banque, personnage);
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
    if (vue === "fiche") globalThis.requestAnimationFrame?.(() => echelle(impression));
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
      : `Brouillon, étape ${personnage.etape} sur 9 : la fiche n'est pas définitive.`;
  racine.append(
    el(
      "div",
      { classe: "barre-personnage ne-pas-imprimer" },
      titre(personnage.identite.nom || "Personnage sans nom"),
      el("p", { classe: "secondaire-texte" }, etat),
      el(
        "div",
        { classe: "actions" },
        boutonsVue.lecture,
        boutonsVue.fiche,
        el("button", { type: "button", classe: "bouton bouton-principal", onclick: () => imprimer() }, "Imprimer / PDF"),
        boutonFichier(personnage),
        boutonTelephone,
        personnage.etat === "brouillon" ? el("a", { classe: "bouton", href: adressePersonnage(personnage.id, personnage.etape) }, "Reprendre la création") : null,
        el("a", { href: "#/personnages" }, "Tous les personnages"),
      ),
      telephone,
    ),
    el("div", { classe: "vue-lecture-contenu ne-pas-imprimer" }, lecture(fiche)),
    cadreImpression,
  );
  zone.replaceChildren(racine);
  // La mesure demande la page affichée, et ses polices chargées.
  const mesurer = () => {
    ajuster(impression, fiche);
    if (vue === "fiche") echelle(impression);
  };
  if (globalThis.requestAnimationFrame && document.fonts?.ready) {
    requestAnimationFrame(mesurer);
    document.fonts.ready.then(mesurer).catch(() => {});
    globalThis.addEventListener?.("resize", () => vue === "fiche" && echelle(impression));
  }
}

/** L'écran #/personnage/<id>. */
export function afficher(contexte, route) {
  const zone = el("section", { classe: "zone-personnage" }, el("p", { classe: "attente", role: "status" }, "Lecture du personnage…"));
  const utilisable = banqueUtilisable(contexte.etat.banque);
  if (utilisable.erreur) {
    return el("section", {}, titre("Personnage"), el("p", { classe: "message", role: "alert" }, utilisable.erreur), el("p", {}, el("a", { href: "#/personnages" }, "Tous les personnages")));
  }
  contexte.etat.etagere
    .lire(route.id)
    .then((personnage) => {
      if (!personnage) {
        zone.replaceChildren(titre("Personnage introuvable"), el("p", { classe: "message" }, "Ce personnage n'est pas sur cet appareil."), el("p", {}, el("a", { href: "#/personnages" }, "Tous les personnages")));
        return;
      }
      afficherPersonnage(contexte, personnage, zone);
    })
    .catch((erreur) => {
      zone.replaceChildren(el("p", { classe: "message", role: "alert" }, `Ce personnage n'a pas pu s'ouvrir : ${erreur?.message ?? String(erreur)}`));
    });
  return zone;
}
