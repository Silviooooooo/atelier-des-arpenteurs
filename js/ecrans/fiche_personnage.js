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
// Depuis la spécification 1.7 : rien ne passe d'une page à l'autre. Chaque
// mesure refait les feuilles et lit ce qui déborde : une zone du recto qui
// déborde fait resserrer ses définitions ; au verso, les vignettes
// « Évènement » de trop se retirent. Ce qui déborde encore se dit dans la
// barre de l'écran, jamais sur le papier. Le bloc « Capacités » écrit la
// capacité de déplacement du bloc de base, que la table des rôles du combat
// reconnaît (js/combat/roles.js) : l'écran l'attend une fois.

import { dateLisible } from "../banque/dates.js";
import { cle } from "../banque/noms.js";
import { tableDesRoles } from "../combat/roles.js";
import { feuilles } from "../fiche/feuilles.js";
import { lecture } from "../fiche/lecture.js";
import { calculerFiche } from "../personnage/calcul.js";
import { ErreurPersonnage, verifier } from "../personnage/format.js";
import { ETAPES, banqueUtilisable } from "../personnage/parcours.js";
import { copieDeTravail } from "./creation.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer } from "./dom.js";
import { poserEchelle } from "./echelle.js";
import { boutonFichier, panneauTelephone } from "./partage.js";

// La largeur de la feuille, celle de css/fiche.css : l'échelle de la vue
// fiche s'en tire (echelle.js).
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

// Ce que la mesure lit, par son nom à l'écran : au recto, les zones de
// hauteur fixe et les deux rubriques qui prennent la place qui reste ; au
// verso, les vignettes qui portent un texte.
export const ZONES_MESUREES = [
  [".zone-arme", "la zone de l'arme"],
  [".zone-armure", "la zone de l'armure"],
  [".liste-capacites", "les capacités"],
  [".rubrique-equipement", "l'équipement"],
  [".rubrique-liens", "les liens primordiaux"],
];
export const VIGNETTES_MESUREES = [
  [".vignette-verso-contexte", "Contexte"],
  [".vignette-verso-sac", "Sac à dos"],
  [".vignette-verso-constellation", "Constellation de naissance"],
];

// Un nœud déborde quand son contenu dépasse sa boîte de plus d'un pixel ; un
// nœud sans hauteur (la fiche pas encore mise en page) ne dit rien.
const deborde = (noeud) => Boolean(noeud && noeud.clientHeight > 0 && noeud.scrollHeight > noeud.clientHeight + 1);

/**
 * Mesure la fiche, une fois mise en page : refait les feuilles, sans rien
 * garder d'une mesure à l'autre, puis lit ce qui déborde. Une zone du recto
 * qui déborde fait refaire le recto aux définitions resserrées ; au verso,
 * les vignettes « Évènement » se retirent tant que leur grille déborde, une
 * au moins restant. Rend { serrees, recto, verso, points } : recto et verso
 * nomment ce qui déborde encore ; points, les vignettes « Évènement » gardées.
 */
export function mesurerFiche(conteneur, fiche, options = {}) {
  const lire = (cote, liste) => liste.filter(([selecteur]) => deborde(conteneur.querySelector(`${cote} ${selecteur}`))).map(([, nom]) => nom);
  conteneur.replaceChildren(feuilles(fiche, { ...options, serrees: false }));
  let serrees = false;
  let recto = lire(".recto", ZONES_MESUREES);
  if (recto.length) {
    serrees = true;
    conteneur.replaceChildren(feuilles(fiche, { ...options, serrees }));
    recto = lire(".recto", ZONES_MESUREES);
  }
  const grille = conteneur.querySelector(".verso .vignettes-bas");
  const points = [...conteneur.querySelectorAll(".verso .vignette-verso-point")];
  while (deborde(grille) && points.length > 1) points.pop().remove();
  return { serrees, recto, verso: lire(".verso", VIGNETTES_MESUREES), points: points.length };
}

const enumeration = (noms) => (noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}` : noms[0]);

/**
 * Ce que l'écran dit de la fiche, hors impression : ce qui déborde encore
 * (mesure, ou null avant la première), et la capacité de déplacement que la
 * fiche n'a pas pu écrire (roles).
 */
export function avisDeLaFiche(mesure, roles) {
  const avis = [];
  if (roles.erreur) avis.push(`Le déplacement ne s'écrit pas sur la fiche : les rôles des capacités ne se lisent pas (${roles.erreur}).`);
  else if (!roles.deplacement) avis.push("Le déplacement ne s'écrit pas sur la fiche : aucune capacité du bloc de base n'a le rôle « deplacement ».");
  if (mesure?.recto.length) {
    avis.push(`Recto : ${enumeration(mesure.recto)} ${mesure.recto.length > 1 ? "débordent" : "déborde"}, même aux définitions resserrées ; ce qui dépasse ne s'imprime pas.`);
  }
  if (mesure?.verso.length) {
    const noms = mesure.verso.map((nom) => `« ${nom} »`);
    avis.push(`Verso : ${noms.length > 1 ? "les vignettes" : "la vignette"} ${enumeration(noms)} ${noms.length > 1 ? "débordent" : "déborde"} ; ce qui dépasse ne s'imprime pas.`);
  }
  return avis;
}

/**
 * La capacité de déplacement d'une banque, pour la fiche : la table des
 * rôles du combat, attendue une fois. Rend { parCle } ou { erreur }.
 */
export async function lireLesRoles(banque, mode) {
  try {
    const { parCle } = await tableDesRoles(banque, mode);
    return { parCle };
  } catch (erreur) {
    return { erreur: erreur?.message ?? String(erreur) };
  }
}

/** Le nom de la capacité de déplacement que la fiche écrit, ou null. */
export function deplacementDe(fiche, roles) {
  if (!roles.parCle) return null;
  return fiche.capacites.find((c) => c.role === "base" && !c.aVenir && roles.parCle.get(cle(c.nom)) === "deplacement")?.nom ?? null;
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

// Les cinq polices du papier, demandées : document.fonts.ready seul peut se
// tenir avant que la page n'en ait réclamé aucune (relecture de la fiche).
const POLICES_FICHE = ["11px Marcellus", "11px 'Alegreya Sans'", "italic 11px 'Alegreya Sans'", "500 11px 'Alegreya Sans'", "700 11px 'Alegreya Sans'"];
async function chargerPolices() {
  await Promise.all(POLICES_FICHE.map((police) => document.fonts.load(police)));
  await document.fonts.ready;
}

async function imprimer(mesurer) {
  // Les polices de la fiche avant l'impression : sinon le PDF prend celles
  // du système. Puis une dernière mesure, avec elles.
  try {
    await chargerPolices();
  } catch {
    // polices indisponibles : l'impression se fait avec celles de secours
  }
  mesurer();
  globalThis.print();
}

// La qualité des objets, que le MJ fixe (2 à la création) : un champ par
// objet dont la qualité n'est pas fixée par le classeur. Enregistrer garde
// le personnage sur l'appareil et, en ligne, le redépose.
function qualites(contexte, personnage, fiche, zone, roles) {
  const modifiables = fiche.equipement.filter((o) => o.qualite.applicable && !o.qualite.fixee);
  if (!modifiables.length) return null;
  const message = el("div", { classe: "qualites-resultat" });
  const doubles = (nom) => fiche.equipement.filter((autre) => autre.nom === nom).length > 1;
  const champs = modifiables.map((o) => {
    const id = `qualite-${o.rang}`;
    const libelle = doubles(o.nom) ? `${o.nom} (objet ${o.rang + 1})` : o.nom;
    const entree = el("input", { type: "text", id, classe: "champ champ-court", inputmode: "decimal", pattern: "\\d{1,3}(,\\d{1,2})?", maxlength: 6, autocomplete: "off" });
    entree.value = personnage.equipement[o.rang].qualite ?? "";
    return { rang: o.rang, entree, noeud: el("div", {}, el("label", { for: id }, libelle), entree) };
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
        afficherPersonnage(contexte, copie, zone, { roles });
        const suite = envoi ? (envoi.envoye ? " Il part en ligne : visible par tous d'ici quelques minutes." : ` Non envoyé : ${envoi.erreur}`) : "";
        const panneau = zone.querySelector(".qualites");
        panneau?.setAttribute("open", "");
        const confirmation = el("p", { classe: "message", role: "status", tabindex: "-1" }, `Les qualités sont gardées.${suite}`);
        panneau?.querySelector(".qualites-resultat")?.replaceChildren(confirmation);
        confirmation.focus();
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

function afficherPersonnage(contexte, personnage, zone, { enLigne = false, roles }) {
  const { banque, mode } = contexte.etat;
  const fiche = calculerFiche(banque, personnage);
  const deplacement = deplacementDe(fiche, roles);
  titrer(personnage.identite.nom || "Personnage");
  let vue = vueMemorisee();
  const racine = el("div", { classe: `ecran-personnage vue-${vue}` });
  const impression = el("div", { classe: "impression" }, feuilles(fiche, { deplacement }));
  // Ce que la mesure et les rôles disent, hors impression ; le texte ne se
  // récrit que s'il change.
  const avis = el("div", { classe: "avis-fiche", role: "status" });
  let avisEcrits = null;
  const dire = (mesure) => {
    const lignes = avisDeLaFiche(mesure, { ...roles, deplacement });
    if (avisEcrits === lignes.join("\n")) return;
    avisEcrits = lignes.join("\n");
    avis.replaceChildren(...lignes.map((ligne) => el("p", { classe: "message" }, ligne)));
  };
  dire(null);
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
      avis,
      el("div", { classe: "qualites-message" }),
      qualites(contexte, personnage, fiche, zone, roles),
    ),
    el("div", { classe: "vue-lecture-contenu ne-pas-imprimer" }, lecture(fiche)),
    cadreImpression,
  );
  zone.replaceChildren(racine);
  // La mesure demande la page affichée ; elle tourne au premier dessin,
  // puis ses polices chargées. En vue lecture, la fiche reste mise en page,
  // invisible, et se mesure aussi.
  function mesurer() {
    if (!impression.isConnected) {
      retirerEcouteurs();
      return;
    }
    dire(mesurerFiche(impression, fiche, { deplacement }));
    if (vue === "fiche") poserEchelle(impression, LARGEUR_FEUILLE);
  }
  retirerEcouteurs();
  if (globalThis.requestAnimationFrame && document.fonts?.ready) {
    requestAnimationFrame(mesurer);
    chargerPolices().then(mesurer).catch(() => {});
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
      const cherche = local ? null : ((await contexte.etat.depot?.chercher?.(route.id)) ?? null);
      if (cherche?.erreur) {
        // La lecture a échoué (réseau, ancienne clé) : le dire, sans parler
        // de personnage introuvable (relecture du lot 2 bis).
        const reessayer = el("button", { type: "button", classe: "bouton", onclick: () => contexte.afficher() }, "Réessayer");
        zone.replaceChildren(titre("Personnage en ligne"), el("p", { classe: "message", role: "alert" }, `Ce personnage ne se lit pas pour l'instant : ${cherche.erreur}`), el("div", { classe: "boutons" }, reessayer), el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Tous les personnages")));
        return;
      }
      const enLigne = cherche?.personnage ?? null;
      const personnage = local ?? enLigne;
      if (!personnage) {
        zone.replaceChildren(titre("Personnage introuvable"), el("p", { classe: "message" }, "Ce personnage n'est ni sur cet appareil, ni en ligne."), el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Tous les personnages")));
        return;
      }
      // La table des rôles, attendue une fois : elle nomme la capacité de
      // déplacement que la fiche écrit.
      const roles = await lireLesRoles(contexte.etat.banque, contexte.etat.mode);
      // Une autre fiche a pu s'ouvrir pendant l'attente : celle-ci, quittée,
      // ne touche pas à ses écouteurs.
      if (!zone.isConnected) return;
      afficherPersonnage(contexte, personnage, zone, { enLigne: Boolean(enLigne), roles });
    })
    .catch((erreur) => {
      zone.replaceChildren(el("p", { classe: "message", role: "alert" }, `Ce personnage n'a pas pu s'ouvrir : ${erreur?.message ?? String(erreur)}`));
    });
  return zone;
}
