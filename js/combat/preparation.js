// La mise en place d'un combat, avant son lancement (SPECIFICATION.md, § 17
// « Le simulateur de combat (lot 4) »).
//
// Avant « Lancer le combat », on ajoute des personnages et des adversaires,
// on les pose, on les déplace, on les retire, et l'on dit quel camp commence.
// Rien de cela n'est un événement ni n'entre au journal : seule la mise en
// place change, par les fonctions de ce module, qui en rendent chaque fois
// une neuve. Il existe pour que les plafonds du combat, la pose d'office et
// la fabrique des identifiants ne s'écrivent qu'une fois, hors de l'écran.
//
// Une mise en place : { mode, quiCommence, compteur, protagonistes }, où
// chaque protagoniste est { id, camp, case, photo }, dans l'ordre d'ajout.
// L'identifiant est fabriqué : « pj » ou « adv », puis le numéro que donne le
// compteur, qui ne redescend jamais (un identifiant ne resert pas, même après
// un retrait). Le numéro d'exemplaire n'est pas gardé : noms.js le recalcule,
// et « Retirer » renumérote donc de lui-même.
//
// Chaque fonction rend { miseEnPlace, … } ou { refus }, où « refus » est la
// phrase à montrer. Ce qui est rendu est gelé, photographies comprises (elles
// le sont déjà quand elles viennent du simulateur).

import { caseDOffice, lireCase } from "./plateau.js";
import { PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES, PLAFOND_PJ, geler } from "./regles.js";

const CAMPS = ["pj", "adv"];

const estUnePhoto = (photo, camp) => photo !== null && typeof photo === "object" && photo.camp === camp && photo.valeurs !== null && typeof photo.valeurs === "object";

const occupees = (protagonistes) => protagonistes.map((protagoniste) => protagoniste.case);

const refuser = (phrase) => ({ refus: phrase });

/** La mise en place d'un combat neuf : personne, et les PJ commencent (décision de l'auteur). */
export function miseEnPlaceVide(mode) {
  return geler({ mode, quiCommence: "pj", compteur: 0, protagonistes: [] });
}

/**
 * Ajoute un personnage, posé d'office sur la colonne A. Un PJ ne s'ajoute
 * qu'une fois : il se reconnaît à l'identifiant de son personnage, non à son
 * nom, que deux personnages peuvent partager.
 */
export function ajouterPersonnage(mep, photo) {
  if (!estUnePhoto(photo, "pj")) return refuser("Ce n'est pas un personnage.");
  const presents = mep.protagonistes.filter((protagoniste) => protagoniste.camp === "pj");
  if (presents.some((protagoniste) => protagoniste.photo.valeurs.identifiant === photo.valeurs.identifiant)) {
    return refuser("Ce personnage est déjà dans le combat.");
  }
  if (presents.length >= PLAFOND_PJ) return refuser(`${PLAFOND_PJ} personnages au plus dans un combat.`);
  const nomDeCase = caseDOffice("pj", occupees(mep.protagonistes));
  if (nomDeCase === null) return refuser("Aucune case n'est libre sur la carte.");
  const compteur = mep.compteur + 1;
  const id = `pj${compteur}`;
  return { miseEnPlace: geler({ ...mep, compteur, protagonistes: [...mep.protagonistes, { id, camp: "pj", case: nomDeCase, photo }] }), id };
}

/**
 * Ajoute des adversaires, une photographie par exemplaire, dans l'ordre
 * donné. C'est tout ou rien : si un plafond serait dépassé, aucun ne
 * s'ajoute (une rencontre ne se pose pas à moitié).
 *
 * Les exemplaires d'un adversaire sont ceux dont le nom est exactement le
 * même. Le premier se pose d'office sur la colonne J ; chacun des suivants
 * rejoint la case du premier exemplaire encore présent, où qu'on l'ait
 * déplacé depuis.
 */
export function ajouterAdversaires(mep, photos) {
  if (!Array.isArray(photos) || !photos.every((photo) => estUnePhoto(photo, "adv"))) return refuser("Ce n'est pas un adversaire.");
  const presents = mep.protagonistes.filter((protagoniste) => protagoniste.camp === "adv");
  if (presents.length + photos.length > PLAFOND_ADVERSAIRES) return refuser(`${PLAFOND_ADVERSAIRES} adversaires au plus dans un combat.`);
  const exemplaires = new Map();
  for (const nom of [...presents.map((protagoniste) => protagoniste.photo.valeurs.nom), ...photos.map((photo) => photo.valeurs.nom)]) {
    exemplaires.set(nom, (exemplaires.get(nom) ?? 0) + 1);
    if (exemplaires.get(nom) > PLAFOND_EXEMPLAIRES) return refuser(`${PLAFOND_EXEMPLAIRES} exemplaires au plus d'un même adversaire.`);
  }

  const protagonistes = [...mep.protagonistes];
  const ids = [];
  let compteur = mep.compteur;
  for (const photo of photos) {
    const premier = protagonistes.find((protagoniste) => protagoniste.camp === "adv" && protagoniste.photo.valeurs.nom === photo.valeurs.nom);
    const nomDeCase = caseDOffice("adv", occupees(protagonistes), premier ? premier.case : null);
    if (nomDeCase === null) return refuser("Aucune case n'est libre sur la carte.");
    compteur += 1;
    const id = `adv${compteur}`;
    ids.push(id);
    protagonistes.push({ id, camp: "adv", case: nomDeCase, photo });
  }
  return { miseEnPlace: geler({ ...mep, compteur, protagonistes }), ids };
}

const INCONNU = "Ce protagoniste n'est pas dans le combat.";

/** Retire un protagoniste. Le compteur ne redescend pas : son identifiant ne resservira pas. */
export function retirer(mep, id) {
  if (!mep.protagonistes.some((protagoniste) => protagoniste.id === id)) return refuser(INCONNU);
  return { miseEnPlace: geler({ ...mep, protagonistes: mep.protagonistes.filter((protagoniste) => protagoniste.id !== id) }) };
}

/**
 * Pose un protagoniste sur une case, librement : plusieurs peuvent partager
 * la même. Le nom de la case est lu comme une saisie (« d4 » vaut « D4 »).
 */
export function poser(mep, id, nomDeCase) {
  if (!mep.protagonistes.some((protagoniste) => protagoniste.id === id)) return refuser(INCONNU);
  const lue = lireCase(nomDeCase);
  if (lue === null) return refuser("Cette case n'est pas sur la carte : elles vont de A1 à J10.");
  return {
    miseEnPlace: geler({ ...mep, protagonistes: mep.protagonistes.map((protagoniste) => (protagoniste.id === id ? { ...protagoniste, case: lue } : protagoniste)) }),
  };
}

/** Dit quel camp commence : « pj » ou « adv ». */
export function reglerQuiCommence(mep, camp) {
  if (!CAMPS.includes(camp)) return refuser("Le camp qui commence est celui des PJ ou celui des adversaires.");
  return { miseEnPlace: geler({ ...mep, quiCommence: camp }) };
}

/** « Lancer le combat » demande au moins un PJ et un adversaire. */
export function peutLancer(mep) {
  const aUn = (camp) => mep.protagonistes.some((protagoniste) => protagoniste.camp === camp);
  return CAMPS.every(aUn) ? { ok: true } : { ok: false, raison: "Il faut au moins un personnage et un adversaire." };
}
