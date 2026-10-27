// La forme de ce qu'un combat garde (SPECIFICATION.md, § 17 « Le simulateur
// de combat (lot 4) ») : un événement, une photographie, un contenu entier.
//
// Un combat gardé se relit d'IndexedDB, déchiffré : c'est une donnée venue
// d'ailleurs, que le moteur rejouerait sans la regarder. Rien n'y est donc
// cru : chaque champ est attendu, typé et borné ici, avant tout rejeu, et un
// champ inconnu est un refus. La même fonction juge une photographie quand
// elle se fabrique et quand elle se relit : ce qui s'est ajouté à un combat
// se reprend toujours.
//
// Ce que ces fonctions ne font pas : dire si un événement est permis à cet
// instant (c'est l'offre, js/combat/offre.js) ni si une valeur tient dans les
// bornes du moment. Ici, un nombre est un entier sûr, un indice un entier sûr
// positif ou nul, et rien de plus ; hors les bornes de la palette et du MJ
// (BORNES_EFFET, BORNES_MJ), qui ne dépendent pas du moment.
//
// Aucune ne lève : elles rendent une copie gelée, aux seuls champs connus, ou
// une phrase. Celle de validerPhoto commence sans majuscule et nomme le
// champ : elle suit « Ne s'ajoute pas : » à la préparation.
//
// Au groupe 2 du lot 4 (le contrat du groupe, § 2.1, § 5.3, § 5.4, § 5.6) :
// l'événement « annuler », sans champ ; le réglage « defense », un type
// d'armure ; la cause d'un désavantage de maîtrise (« maitrise », présente
// exactement quand « desavantage » est vrai) ; les types du dé de défense à
// égalité (« egalite »). Et, à la relecture du groupe (C-15), un texte de la
// photographie ne porte pas plus un demi-codet isolé qu'un caractère de
// contrôle.
//
// Au groupe 3 du lot 4 (le contrat du groupe, § 4 à § 6, § 9) : sept
// événements neufs, « intervenir », « contre_attaquer », « laisser »,
// « critique », « effet » (la palette, un genre par effet, et sa source),
// « blessure » et « mj » (un genre par geste du MJ) ; les réglages « garde »
// (la ligne qu'attendre garde) et « cibles » (plusieurs cibles, autant qu'un
// combat compte de protagonistes au plus : BORNES_EFFET.cibles) ; la capacité
// figée, qu'un état ou une blessure porte au format de la photographie
// (validerCapaciteFigee). Un événement à genres a les champs de son genre, et
// eux seuls.

import { CARACTERISTIQUES } from "../personnage/regles.js";
import {
  BORNES_EFFET,
  BORNES_MJ,
  BORNES_PHOTO,
  CHAMPS_MJ,
  DUREES_EFFET,
  EVENEMENTS_MAX,
  FACES_LOCALISATION,
  FACE_CONTRE,
  GRILLE_PJ,
  IDENTIFIANTS_MAX,
  LETTRES,
  MOTIF_CASE,
  PLAFOND_ADVERSAIRES,
  PLAFOND_EXEMPLAIRES,
  PLAFOND_PJ,
  REGLES,
  RESSOURCES_RENDRE,
  ROLES,
  ROLES_PASSIFS,
  SIGNES,
  TIRAGES_MAX,
  ecrireEnMilliers,
  geler,
  raisonValide,
} from "./regles.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

// Un refus interrompt la lecture là où il naît ; il ne sort jamais de ce
// fichier : chaque fonction exportée l'attrape et rend sa phrase.
class Refus extends Error {}
const refuser = (phrase) => {
  throw new Refus(phrase);
};

/** Ce que rend une fonction exportée quand la lecture échoue, quelle qu'en soit la cause. */
const phraseDe = (echec, defaut) => (echec instanceof Refus ? echec.message : defaut);

const estObjet = (valeur) => {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) return false;
  const prototype = Object.getPrototypeOf(valeur);
  return prototype === Object.prototype || prototype === null;
};

const a = (objet, nom) => Object.prototype.hasOwnProperty.call(objet, nom);

// Un entier s'écrit par ecrireEnMilliers (js/combat/regles.js) : « 9 999 »,
// une espace ordinaire entre les tranches, comme toute phrase du noyau.
const ecrireNombre = ecrireEnMilliers;

/** Vérifie qu'un objet simple porte les champs attendus, et eux seuls (les facultatifs peuvent manquer). */
function champs(donnee, quoi, attendus, facultatifs = []) {
  if (!estObjet(donnee)) refuser(`${quoi} n'est pas un objet simple.`);
  for (const nom of attendus) if (!a(donnee, nom)) refuser(`${quoi} n'a pas de champ « ${nom} ».`);
  for (const nom of Object.keys(donnee)) {
    if (!attendus.includes(nom) && !facultatifs.includes(nom)) refuser(`${quoi} porte un champ inconnu.`);
  }
}

function entier(valeur, quoi, min, max) {
  if (!Number.isSafeInteger(valeur) || valeur < min || valeur > max) {
    refuser(`${quoi} n'est pas un entier de ${ecrireNombre(min)} à ${ecrireNombre(max)}.`);
  }
  return valeur;
}
const nombre = (valeur, quoi) => entier(valeur, quoi, 0, BORNES_PHOTO.nombre);

function booleen(valeur, quoi) {
  if (typeof valeur !== "boolean") refuser(`${quoi} n'est ni vrai ni faux.`);
  return valeur;
}

function parmi(valeur, quoi, permis) {
  if (!permis.includes(valeur)) refuser(`${quoi} n'est pas une valeur connue.`);
  return valeur;
}

function liste(valeur, quoi, max, objets) {
  if (!Array.isArray(valeur)) refuser(`${quoi} n'est pas une liste.`);
  if (valeur.length > max) refuser(`${quoi} compte plus de ${ecrireNombre(max)} ${objets}.`);
  return valeur;
}

// Les deux séparateurs de ligne sont fabriqués par leur code : écrits tels
// quels, ils couperaient la ligne de ce fichier. Un demi-codet isolé (la
// moitié d'un signe astral, seule : \p{Cs}) est refusé comme un caractère de
// contrôle : il ne se voit pas, le JSON l'écrit en six octets, et un nom qui
// n'en serait fait donnerait une raison proposée vide, que le moteur refuse
// (relecture du groupe 2, C-15). Le drapeau « u » lit une paire bien formée
// comme un seul signe, qui n'est pas un demi-codet : une poêle (U+1F373) passe.
const CONTROLE = new RegExp(`[\\p{Cc}\\p{Cs}${String.fromCodePoint(0x2028, 0x2029)}]`, "u");
const BLANCS_DE_LIGNE = /[\n\r\t]/g;

/** Un texte d'une ligne : il entre au journal, qui tient une ligne par geste. */
function ligne(valeur, quoi, min = 1, max = BORNES_PHOTO.ligne) {
  if (typeof valeur !== "string") refuser(`${quoi} n'est pas un texte.`);
  if (CONTROLE.test(valeur)) refuser(`${quoi} porte un retour à la ligne ou un caractère de contrôle.`);
  if (valeur.length < min) refuser(`${quoi} est vide.`);
  if (valeur.length > max) refuser(`${quoi} dépasse ${ecrireNombre(max)} signes.`);
  return valeur;
}

/**
 * Un texte à lignes : la description d'une capacité tient souvent sur
 * plusieurs lignes de sa cellule, et la refuser ferait perdre au rechargement
 * un combat que la préparation avait accepté.
 */
function texte(valeur, quoi) {
  if (typeof valeur !== "string") refuser(`${quoi} n'est pas un texte.`);
  // Chaque blanc de ligne devient une espace, et non rien : ôté, il
  // recollerait les deux moitiés d'un signe astral qu'il sépare, deux
  // demi-codets isolés qui passeraient alors pour un seul signe.
  if (CONTROLE.test(valeur.replace(BLANCS_DE_LIGNE, " "))) refuser(`${quoi} porte un caractère de contrôle.`);
  if (valeur.length > BORNES_PHOTO.texte) refuser(`${quoi} dépasse ${ecrireNombre(BORNES_PHOTO.texte)} signes.`);
  return valeur;
}

function indice(valeur, quoi) {
  if (!Number.isSafeInteger(valeur) || valeur < 0) refuser(`${quoi} n'est pas un indice.`);
  return valeur;
}

function indiceDans(valeur, quoi, longueur) {
  if (!Number.isSafeInteger(valeur) || valeur < 0 || valeur >= longueur) refuser(`${quoi} ne désigne rien dans sa liste.`);
  return valeur;
}

// ─── Les événements ─────────────────────────────────────────────────────────

const MOTIF_IDENTIFIANT = /^(pj|adv)[1-9]\d{0,4}$/;
const MOTIF_HEURE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d$/;
const CODES_CARACTERISTIQUES = CARACTERISTIQUES.map((caracteristique) => caracteristique.code);

const BASES = ["lettre", "arme", "aucun"];
const NATURES = ["normaux", "resistance", "corps"];

// Les trois types d'objet, dans l'ordre de TYPES_OBJET
// (js/personnage/regles.js) : celui des pièces d'armure, des armes, des
// maîtrises, et des types du dé de défense à égalité, qui s'y rangent.
const POIDS = ["lourde", "agile", "precise"];

function identifiant(valeur, quoi) {
  if (typeof valeur !== "string" || !MOTIF_IDENTIFIANT.test(valeur)) refuser(`${quoi} n'est pas l'identifiant d'un protagoniste.`);
  return valeur;
}

function nomDeCase(valeur, quoi) {
  if (typeof valeur !== "string" || !MOTIF_CASE.test(valeur)) refuser(`${quoi} n'est pas une case, de A1 à J10.`);
  return valeur;
}

function entierSur(valeur, quoi) {
  if (!Number.isSafeInteger(valeur)) refuser(`${quoi} n'est pas un entier.`);
  return valeur;
}

function raison(valeur, quoi) {
  if (!raisonValide(valeur)) refuser(`${quoi} n'est pas une raison valide.`);
  return valeur;
}

/** Une ou deux caractéristiques distinctes, par leur code. */
function codesDistincts(valeur, quoi) {
  if (!Array.isArray(valeur) || valeur.length < 1 || valeur.length > 2 || valeur.some((code) => !CODES_CARACTERISTIQUES.includes(code)) || valeur[0] === valeur[1]) {
    refuser(`${quoi} n'est pas une liste d'une ou deux caractéristiques distinctes.`);
  }
  return [...valeur];
}

/** Plusieurs cibles, dans l'ordre des jets : de 1 à BORNES_EFFET.cibles identifiants, distincts. */
function listeDeCibles(valeur, quoi) {
  if (!Array.isArray(valeur) || valeur.length < 1 || valeur.length > BORNES_EFFET.cibles) {
    refuser(`${quoi} n'est pas une liste de 1 à ${ecrireNombre(BORNES_EFFET.cibles)} cibles.`);
  }
  // Array.from, et non map : un trou de la liste est lu, et refusé.
  const lues = Array.from(valeur, (id) => identifiant(id, `${quoi} : une cible`));
  if (new Set(lues).size !== lues.length) refuser(`${quoi} nomme deux fois la même cible.`);
  return lues;
}

/** La ligne qu'un geste « attendre » garde : une capacité et l'une de ses façons, par leurs indices. */
function ligneGardee(valeur, quoi) {
  champs(valeur, quoi, ["capacite", "facon"]);
  return { capacite: indice(valeur.capacite, `${quoi} : « capacite »`), facon: indice(valeur.facon, `${quoi} : « facon »`) };
}

// Ce que vaut « valeur » pour chaque champ de « regler ». Les deux derniers
// se règlent à la main : ils demandent une raison dès que la valeur n'est pas
// nulle (0 efface le réglage). « defense » choisit le type du jet de défense
// quand deux types d'armure sont à égalité de dés (contrat du groupe 2,
// § 5.4) : un type, sans raison ; le retour au défaut ne se règle pas, il
// suit le changement de cible. Au groupe 3 (contrat du groupe, § 6) :
// « garde », la ligne qu'un geste « attendre » garde, et « cibles », celles
// d'une façon Centrée, dans l'ordre des jets ; ni l'un ni l'autre ne revient
// à vide, et aucun ne prend de raison.
const VALEURS_DE_REGLER = {
  facon: indice,
  jet_prete: booleen,
  arme_pretee: indice,
  cible: (valeur, quoi) => (valeur === null ? null : identifiant(valeur, quoi)),
  arrivee: nomDeCase,
  caracteristiques: codesDistincts,
  difficulte: entierSur,
  x: entierSur,
  jauge: indice,
  defense: (valeur, quoi) => parmi(valeur, quoi, POIDS),
  garde: ligneGardee,
  cibles: listeDeCibles,
  modificateur: entierSur,
  avantages: entierSur,
};
const REGLAGES_A_LA_MAIN = ["modificateur", "avantages"];

/** Une valeur réglée à la main : sa raison est due dès qu'elle n'est pas nulle, et refusée ailleurs. */
function avecRaison(donnee, quoi, evenement, due) {
  if (a(donnee, "raison")) evenement.raison = raison(donnee.raison, `${quoi} : sa raison`);
  else if (due) refuser(`${quoi} demande une raison.`);
  return evenement;
}

// Un type, ses champs, et la lecture qui en fait la copie. Un champ en trop,
// un champ qui manque ou un champ mal typé est un refus.
const SANS_CHAMP = { champs: [], lire: () => ({}) };

// Une ligne jouée : qui, quelle capacité, de quelle façon. Une capacité, et,
// au groupe 3, une intervention (contrat du groupe, § 6.1).
const LIGNE_JOUEE = {
  champs: ["qui", "capacite", "facon"],
  lire: (donnee, quoi) => ({
    qui: identifiant(donnee.qui, `${quoi} : « qui »`),
    capacite: indice(donnee.capacite, `${quoi} : « capacite »`),
    facon: indice(donnee.facon, `${quoi} : « facon »`),
  }),
};

// ─── Le groupe 3 : la palette et le MJ ──────────────────────────────────────

/**
 * Lit une partie par une lecture de la photographie, dont le refus est une
 * phrase sans majuscule, et le rend sous le nom de l'événement.
 */
function sousPartie(quoi, lire) {
  try {
    return lire();
  } catch (echec) {
    if (echec instanceof Refus) refuser(`${quoi} est refusée : ${echec.message}`);
    throw echec;
  }
}

/** L'identifiant d'un effet durable : le pas de l'événement qui l'a posé. */
function idDEffet(valeur, quoi) {
  if (!Number.isSafeInteger(valeur) || valeur < 0) refuser(`${quoi} n'est pas l'identifiant d'un effet.`);
  return valeur;
}

/** Un ±N : de −20 à 20, jamais nul. Le moins s'écrit par son signe, comme au journal. */
function ecart(valeur, quoi) {
  const borne = BORNES_EFFET.ecart;
  if (!Number.isSafeInteger(valeur) || valeur === 0 || valeur < -borne || valeur > borne) {
    refuser(`${quoi} n'est pas un entier de ${SIGNES.moins}${borne} à ${borne}, autre que 0.`);
  }
  return valeur;
}

// Une Source (contrat du groupe 3, § 5) : une capacité d'un protagoniste, par
// son indice dans sa photographie ; un état porté, par l'identifiant de son
// effet durable ; ou le MJ.
const CHAMPS_DE_LA_SOURCE = { capacite: ["qui", "capacite"], etat: ["effet"], mj: [] };

function sourceDEffet(valeur, quoi) {
  if (!estObjet(valeur) || typeof valeur.genre !== "string" || !a(CHAMPS_DE_LA_SOURCE, valeur.genre)) {
    refuser(`${quoi} n'est ni une capacité, ni un état, ni le MJ.`);
  }
  champs(valeur, quoi, ["genre", ...CHAMPS_DE_LA_SOURCE[valeur.genre]]);
  if (valeur.genre === "capacite") {
    return { genre: "capacite", qui: identifiant(valeur.qui, `${quoi} : « qui »`), capacite: indice(valeur.capacite, `${quoi} : « capacite »`) };
  }
  if (valeur.genre === "etat") return { genre: "etat", effet: idDEffet(valeur.effet, `${quoi} : « effet »`) };
  return { genre: "mj" };
}

// L'armure et l'endurance sont celles d'une zone, le lien celui d'une jauge :
// leur indice est présent exactement là, pour « rendre » comme pour les
// valeurs du MJ.
const A_ZONE = ["armure", "endurance"];

function precision(donnee, quoi, laquelle) {
  const voulue = laquelle === "lien" ? "jauge" : A_ZONE.includes(laquelle) ? "zone" : null;
  for (const nom of ["zone", "jauge"]) {
    if (nom !== voulue && a(donnee, nom)) refuser(`${quoi} ne prend pas de « ${nom} » pour « ${laquelle} ».`);
  }
  if (voulue === null) return {};
  if (!a(donnee, voulue)) refuser(`${quoi} n'a pas de champ « ${voulue} ».`);
  return { [voulue]: indice(donnee[voulue], `${quoi} : « ${voulue} »`) };
}

/** Un état : une capacité figée, ou un nom libre ; l'un des deux, jamais les deux. */
function capaciteOuLibre(donnee, quoi) {
  if (a(donnee, "capacite") === a(donnee, "libre")) refuser(`${quoi} porte « capacite » ou « libre » : l'un des deux.`);
  // Le nom libre est une donnée hostile, comme une raison : il entre au journal.
  if (a(donnee, "libre")) return { libre: ligne(donnee.libre, `${quoi} : « libre »`, 1, BORNES_EFFET.libre) };
  return { capacite: sousPartie(`${quoi} : sa capacité`, () => lireCapaciteFigee(donnee.capacite)) };
}

// Les dégâts directs sont de résistance ou de corps : des dégâts normaux
// n'en sont pas. Un geste du MJ, hors d'un geste, ne dure pas « pour ce jet ».
const NATURES_DIRECTES = ["resistance", "corps"];
const DUREES_DURABLES = DUREES_EFFET.filter((duree) => duree !== "jet");

const sur = (donnee, quoi) => identifiant(donnee.sur, `${quoi} : « sur »`);
const duree = (donnee, quoi, permises = DUREES_EFFET) => parmi(donnee.duree, `${quoi} : « duree »`, permises);
const points = (donnee, quoi, min = 1) => entier(donnee.n, `${quoi} : « n »`, min, BORNES_EFFET.points);

const NOMBRE_DE_DES = { champs: ["nombre"], lire: (donnee, quoi) => ({ nombre: entier(donnee.nombre, `${quoi} : « nombre »`, 1, BORNES_EFFET.nombre) }) };
const OPERATION = { champs: ["n"], lire: (donnee, quoi) => ({ n: points(donnee, quoi) }) };
const ECART = {
  champs: ["sur", "n", "duree"],
  lire: (donnee, quoi) => ({ sur: sur(donnee, quoi), n: ecart(donnee.n, `${quoi} : « n »`), duree: duree(donnee, quoi) }),
};

// Les genres de l'événement « effet » (contrat du groupe 3, § 5.1), dans
// l'ordre de GENRES_EFFET (js/combat/regles.js) : leurs champs et leurs
// bornes. Le moment, la source permise, le prix et les bornes qui dépendent
// de l'état (un maximum, une case autre que la sienne) sont à l'offre.
const GENRES_D_EFFET = {
  avantages: NOMBRE_DE_DES,
  desavantages: NOMBRE_DE_DES,
  relancer: SANS_CHAMP,
  inverser: SANS_CHAMP,
  reussite: SANS_CHAMP,
  zone: {
    champs: ["de", "zone"],
    lire: (donnee, quoi) => ({ de: indice(donnee.de, `${quoi} : « de »`), zone: indice(donnee.zone, `${quoi} : « zone »`) }),
  },
  multiplier: {
    champs: ["k"],
    lire: (donnee, quoi) => ({ k: entier(donnee.k, `${quoi} : « k »`, BORNES_EFFET.facteurMin, BORNES_EFFET.facteurMax) }),
  },
  ajouter: OPERATION,
  retrancher: OPERATION,
  armure: OPERATION,
  directs: {
    champs: ["n", "nature"],
    lire: (donnee, quoi) => ({ n: points(donnee, quoi, 0), nature: parmi(donnee.nature, `${quoi} : « nature »`, NATURES_DIRECTES) }),
  },
  reporter: { champs: ["sur"], lire: (donnee, quoi) => ({ sur: sur(donnee, quoi) }) },
  toute_la_case: { champs: ["cibles"], lire: (donnee, quoi) => ({ cibles: listeDeCibles(donnee.cibles, `${quoi} : « cibles »`) }) },
  attaque_en_plus: SANS_CHAMP,
  rendre: {
    champs: ["sur", "ressource", "n"],
    facultatifs: ["zone", "jauge"],
    lire(donnee, quoi) {
      const ressource = parmi(donnee.ressource, `${quoi} : « ressource »`, RESSOURCES_RENDRE);
      return { sur: sur(donnee, quoi), ressource, n: points(donnee, quoi), ...precision(donnee, quoi, ressource) };
    },
  },
  attaque: ECART,
  defense: ECART,
  etat: {
    champs: ["sur", "duree"],
    facultatifs: ["capacite", "libre"],
    lire: (donnee, quoi) => ({ sur: sur(donnee, quoi), ...capaciteOuLibre(donnee, quoi), duree: duree(donnee, quoi) }),
  },
  deplacer: { champs: ["sur", "vers"], lire: (donnee, quoi) => ({ sur: sur(donnee, quoi), vers: nomDeCase(donnee.vers, `${quoi} : « vers »`) }) },
};

// La qualité d'un objet s'écrit comme dans le fichier du personnage
// (js/personnage/format.js) : « 2 », « 1,5 », ou rien.
const MOTIF_QUALITE = /^\d{1,3}(?:,\d{1,2})?$/;

function qualite(valeur, quoi) {
  if (valeur !== null && (typeof valeur !== "string" || !MOTIF_QUALITE.test(valeur))) refuser(`${quoi} n'est ni une qualité (« 2 », « 1,5 ») ni rien.`);
  return valeur;
}

// Ce qu'un geste « equipement » écrit au journal (contrat du groupe 3,
// § 6.3) : l'arme tenue (nulle : aucune), la qualité d'un objet, ou la
// cellule Équipement d'un adversaire, ses noms dans l'ordre.
const CHAMPS_DU_CHANGEMENT = { arme: ["nom"], qualite: ["objet", "avant", "apres"], cellule: ["noms"] };

function lireChangement(valeur, quoi) {
  if (!estObjet(valeur) || typeof valeur.genre !== "string" || !a(CHAMPS_DU_CHANGEMENT, valeur.genre)) {
    refuser(`${quoi} n'est ni une arme, ni une qualité, ni une cellule.`);
  }
  champs(valeur, quoi, ["genre", ...CHAMPS_DU_CHANGEMENT[valeur.genre]]);
  if (valeur.genre === "arme") return { genre: "arme", nom: valeur.nom === null ? null : ligne(valeur.nom, `${quoi} : « nom »`) };
  if (valeur.genre === "qualite") {
    return {
      genre: "qualite",
      objet: ligne(valeur.objet, `${quoi} : « objet »`),
      avant: qualite(valeur.avant, `${quoi} : « avant »`),
      apres: qualite(valeur.apres, `${quoi} : « apres »`),
    };
  }
  liste(valeur.noms, `${quoi} : « noms »`, BORNES_MJ.noms, "noms");
  return { genre: "cellule", noms: Array.from(valeur.noms, (nom) => ligne(nom, `${quoi} : un nom`)) };
}

// Les genres de l'événement « mj » (contrat du groupe 3, § 6.3). Qui est
// vivant, ce qui change vraiment, un maximum sous la valeur courante : c'est
// l'offre qui le juge.
const GENRES_DU_MJ = {
  valeurs: {
    champs: ["valeurs"],
    lire(donnee, quoi) {
      if (!Array.isArray(donnee.valeurs) || donnee.valeurs.length < 1 || donnee.valeurs.length > BORNES_MJ.valeurs) {
        refuser(`${quoi} : « valeurs » n'est pas une liste de 1 à ${ecrireNombre(BORNES_MJ.valeurs)} valeurs.`);
      }
      const vues = new Set();
      const valeurs = Array.from(donnee.valeurs, (entree, rang) => {
        const laquelle = `${quoi} : la valeur n° ${rang + 1}`;
        champs(entree, laquelle, ["champ", "valeur"], ["zone", "jauge"]);
        const champ = parmi(entree.champ, `${laquelle} : « champ »`, CHAMPS_MJ);
        const lue = { champ, ...precision(entree, laquelle, champ), valeur: entier(entree.valeur, `${laquelle} : « valeur »`, 0, BORNES_MJ.valeur) };
        // Deux entrées pour la même valeur : aucune ne dirait laquelle compte.
        const cle = `${champ} ${lue.zone ?? ""} ${lue.jauge ?? ""}`;
        if (vues.has(cle)) refuser(`${laquelle} change une valeur déjà changée.`);
        vues.add(cle);
        return lue;
      });
      return { valeurs };
    },
  },
  equipement: {
    champs: ["photo", "changements"],
    lire(donnee, quoi) {
      // L'identifiant dit le camp (« qui » est déjà lu) : les valeurs se lisent
      // comme celles d'une photographie de ce camp, à l'ajout.
      const camp = donnee.qui.startsWith("pj") ? "pj" : "adv";
      const photo = sousPartie(`${quoi} : sa photographie`, () => lireValeurs(donnee.photo, camp));
      if (!Array.isArray(donnee.changements) || donnee.changements.length < 1 || donnee.changements.length > BORNES_MJ.changements) {
        refuser(`${quoi} : « changements » n'est pas une liste de 1 à ${ecrireNombre(BORNES_MJ.changements)} changements.`);
      }
      return { photo, changements: Array.from(donnee.changements, (changement, rang) => lireChangement(changement, `${quoi} : le changement n° ${rang + 1}`)) };
    },
  },
  etat: {
    champs: [],
    facultatifs: ["ajout", "retrait"],
    lire(donnee, quoi) {
      if (a(donnee, "ajout") === a(donnee, "retrait")) refuser(`${quoi} porte « ajout » ou « retrait » : l'un des deux.`);
      if (a(donnee, "retrait")) return { retrait: idDEffet(donnee.retrait, `${quoi} : « retrait »`) };
      const dit = `${quoi} : son ajout`;
      champs(donnee.ajout, dit, ["duree"], ["capacite", "libre"]);
      return { ajout: { ...capaciteOuLibre(donnee.ajout, dit), duree: duree(donnee.ajout, dit, DUREES_DURABLES) } };
    },
  },
  deplacer: { champs: ["vers"], lire: (donnee, quoi) => ({ vers: nomDeCase(donnee.vers, `${quoi} : « vers »`) }) },
  retirer: SANS_CHAMP,
};

const EVENEMENTS = {
  lancer: {
    champs: ["le"],
    lire(donnee, quoi) {
      if (typeof donnee.le !== "string" || !MOTIF_HEURE.test(donnee.le)) refuser(`${quoi} : son heure ne s'écrit pas « AAAA-MM-JJTHH:MM ».`);
      return { le: donnee.le };
    },
  },
  capacite: LIGNE_JOUEE,
  regler: {
    champs: ["champ", "valeur"],
    facultatifs: ["raison"],
    lire(donnee, quoi) {
      if (typeof donnee.champ !== "string" || !a(VALEURS_DE_REGLER, donnee.champ)) refuser(`${quoi} : son champ n'est pas un réglage connu.`);
      const dit = `${quoi} « ${donnee.champ} »`;
      const valeur = VALEURS_DE_REGLER[donnee.champ](donnee.valeur, `${dit} : sa valeur`);
      if (!REGLAGES_A_LA_MAIN.includes(donnee.champ)) {
        if (a(donnee, "raison")) refuser(`${dit} ne prend pas de raison.`);
        return { champ: donnee.champ, valeur };
      }
      return avecRaison(donnee, dit, { champ: donnee.champ, valeur }, valeur !== 0);
    },
  },
  revenir: SANS_CHAMP,
  confirmer: SANS_CHAMP,
  de: {
    champs: ["faces", "valeurs"],
    lire(donnee, quoi) {
      const faces = entier(donnee.faces, `${quoi} : « faces »`, 2, BORNES_PHOTO.faces);
      if (!Array.isArray(donnee.valeurs) || donnee.valeurs.length === 0) refuser(`${quoi} : « valeurs » n'est pas une liste d'au moins un dé.`);
      // Avant d'en lire une seule : un dé ne se lance pas plus de TIRAGES_MAX fois.
      if (donnee.valeurs.length > TIRAGES_MAX) refuser(`${quoi} : « valeurs » compte plus de ${ecrireNombre(TIRAGES_MAX)} tirages.`);
      return { faces, valeurs: donnee.valeurs.map((valeur) => entier(valeur, `${quoi} : une valeur`, 1, faces)) };
    },
  },
  relancer: SANS_CHAMP,
  garder: SANS_CHAMP,
  exploser: SANS_CHAMP,
  degats: {
    champs: ["base", "operations", "nature"],
    lire(donnee, quoi) {
      const base = parmi(donnee.base, `${quoi} : « base »`, BASES);
      // Au groupe 1, la seule opération est « ajuster », une fois au plus.
      if (!Array.isArray(donnee.operations) || donnee.operations.length > 1) refuser(`${quoi} : « operations » n'est pas une liste d'une opération au plus.`);
      const operations = donnee.operations.map((operation) => {
        champs(operation, `${quoi} : son opération`, ["op", "valeur", "raison"]);
        if (operation.op !== "ajuster") refuser(`${quoi} : son opération n'est pas « ajuster ».`);
        return {
          op: "ajuster",
          valeur: entierSur(operation.valeur, `${quoi} : la valeur de son opération`),
          raison: raison(operation.raison, `${quoi} : la raison de son opération`),
        };
      });
      return { base, operations, nature: parmi(donnee.nature, `${quoi} : « nature »`, NATURES) };
    },
  },
  decaler: {
    champs: ["de", "valeur"],
    facultatifs: ["raison"],
    lire(donnee, quoi) {
      const evenement = { de: indice(donnee.de, `${quoi} : « de »`), valeur: entierSur(donnee.valeur, `${quoi} : sa valeur`) };
      return avecRaison(donnee, quoi, evenement, evenement.valeur !== 0);
    },
  },
  esquive: {
    champs: ["x"],
    lire: (donnee, quoi) => ({ x: entierSur(donnee.x, `${quoi} : « x »`) }),
  },
  appliquer: SANS_CHAMP,
  passer: {
    champs: ["qui"],
    lire: (donnee, quoi) => ({ qui: identifiant(donnee.qui, `${quoi} : « qui »`) }),
  },
  fin_de_tour: SANS_CHAMP,
  // Défait le dernier geste fini depuis le lancement (contrat du groupe 2,
  // § 2.1) : il entre au contenu et compte pour la borne comme les autres.
  annuler: SANS_CHAMP,
  // Le groupe 3 (contrat du groupe, § 6) : une intervention, la
  // contre-attaque jouée ou laissée, le critique tenté ou gardé.
  intervenir: LIGNE_JOUEE,
  contre_attaquer: {
    champs: ["capacite", "facon"],
    lire: (donnee, quoi) => ({ capacite: indice(donnee.capacite, `${quoi} : « capacite »`), facon: indice(donnee.facon, `${quoi} : « facon »`) }),
  },
  laisser: SANS_CHAMP,
  critique: { champs: ["tenter"], lire: (donnee, quoi) => ({ tenter: booleen(donnee.tenter, `${quoi} : « tenter »`) }) },
  // Un effet de la palette : sa source, et les champs de son genre. Un X ne
  // se paie que par une capacité (un passif au coût X, contrat du groupe 3,
  // § 5) : toute autre source ne coûte rien.
  effet: {
    genres: GENRES_D_EFFET,
    champs: ["source"],
    facultatifs: ["x"],
    lire(donnee, quoi) {
      const source = sourceDEffet(donnee.source, `${quoi} : sa source`);
      if (!a(donnee, "x")) return { source };
      if (source.genre !== "capacite") refuser(`${quoi} : seule une capacité prend un « x ».`);
      if (!Number.isSafeInteger(donnee.x) || donnee.x < 0) refuser(`${quoi} : « x » n'est pas un entier positif ou nul.`);
      return { source, x: donnee.x };
    },
  },
  // La blessure d'un personnage (contrat du groupe 3, § 5.9) : une capacité
  // du bloc de blessure, figée, ou un état libre.
  blessure: { champs: [], facultatifs: ["capacite", "libre"], lire: capaciteOuLibre },
  mj: {
    genres: GENRES_DU_MJ,
    champs: ["qui"],
    lire: (donnee, quoi) => ({ qui: identifiant(donnee.qui, `${quoi} : « qui »`) }),
  },
};

function lireEvenement(donnee) {
  if (!estObjet(donnee)) refuser("Un événement est un objet simple.");
  if (typeof donnee.type !== "string" || !a(EVENEMENTS, donnee.type)) refuser("Le type de l'événement n'est pas connu.");
  const definition = EVENEMENTS[donnee.type];
  const quoi = `L'événement « ${donnee.type} »`;
  if (!definition.genres) {
    champs(donnee, quoi, ["type", ...definition.champs], definition.facultatifs ?? []);
    return { type: donnee.type, ...definition.lire(donnee, quoi) };
  }
  // Un événement à genres (« effet », « mj ») : ses champs, puis ceux de son
  // genre, et eux seuls. Les siens se lisent d'abord : le genre peut s'en
  // servir (le camp de « qui »).
  if (!a(donnee, "genre")) refuser(`${quoi} n'a pas de champ « genre ».`);
  if (typeof donnee.genre !== "string" || !a(definition.genres, donnee.genre)) refuser(`${quoi} : son genre n'est pas connu.`);
  const genre = definition.genres[donnee.genre];
  const dit = `${quoi} « ${donnee.genre} »`;
  champs(donnee, dit, ["type", "genre", ...definition.champs, ...genre.champs], [...(definition.facultatifs ?? []), ...(genre.facultatifs ?? [])]);
  const communs = definition.lire(donnee, dit);
  return { type: donnee.type, genre: donnee.genre, ...communs, ...genre.lire(donnee, dit) };
}

/**
 * Un événement du combat : son type, ses champs, leurs types, et rien de
 * trop. Rend { evenement }, une copie gelée, ou { erreur }, une phrase.
 */
export function validerEvenement(donnee) {
  try {
    return { evenement: geler(lireEvenement(donnee)) };
  } catch (echec) {
    return { erreur: phraseDe(echec, "L'événement ne se lit pas.") };
  }
}

// ─── Les photographies ──────────────────────────────────────────────────────

const CAMPS = ["pj", "adv"];
const CODES_ZONES = GRILLE_PJ.map((zone) => zone.code);
const GENRES_DE_GROUPE = ["arme", "archetype", "espece", "style", "constellation", "primordial", "objet", "base", "capacites"];
const ABSENTE = "absente de la banque";

const CHAMPS_PHOTO = ["camp", "publiee_le", "source", "valeurs", "avertissements"];
const CHAMPS_VALEURS = [
  "identifiant", "nom", "sousTitre", "actions", "souffle", "corps", "souffleAbsent", "zones", "faceContre", "caracteristiques",
  "attaque", "defense", "deDefense", "armes", "armePretee", "bouclier", "liens", "passifs", "capacites",
];
const CHAMPS_ZONE = ["nom", "ecrit", "code", "debut", "fin", "armure", "resistance"];
const CHAMPS_ARME = ["nom", "libelle", "poids", "faces", "caracteristiques", "degats", "portee", "locMultiple", "mainsNues"];
const CHAMPS_CAPACITE = ["nom", "role", "niveau", "evolue", "groupe", "lien", "inactive", "facons"];
const CHAMPS_FACON = [
  "puissance", "arme", "libelle", "cout", "description", "elements", "passif", "intervention", "attaque", "degats", "portee", "locMultiple", "desavantage",
  "maitrise",
];
const CHAMPS_DE_DEFENSE = ["faces", "type", "caracteristiques", "meles", "egalite"];

// La source ne sert qu'à « Fiche complète » : le noyau n'en lit rien. Elle
// n'est donc pas examinée champ par champ, mais elle doit passer par JSON à
// l'identique, comme tout ce qui se garde ; la profondeur est bornée parce
// qu'un contenu forgé très imbriqué ferait déborder la pile de cette copie.
const PROFONDEUR_SOURCE = 64;

function copieSimple(valeur, quoi, profondeur = 0) {
  if (valeur === null || typeof valeur === "string" || typeof valeur === "boolean") return valeur;
  if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;
  if (profondeur >= PROFONDEUR_SOURCE) refuser(`${quoi} est trop imbriquée.`);
  if (Array.isArray(valeur)) return Array.from(valeur, (element) => copieSimple(element, quoi, profondeur + 1));
  if (!estObjet(valeur)) refuser(`${quoi} porte autre chose que des données simples.`);
  const copie = {};
  for (const nom of Object.keys(valeur)) {
    // Écrit par affectation, ce nom changerait le prototype de la copie.
    if (nom === "__proto__") refuser(`${quoi} porte un champ interdit.`);
    copie[nom] = copieSimple(valeur[nom], quoi, profondeur + 1);
  }
  return copie;
}

function lireSource(donnee, camp, accepter) {
  if (donnee === null) return null;
  const quoi = "la source de la photographie";
  if (camp === "pj") {
    champs(donnee, quoi, ["personnage"]);
    if (!estObjet(donnee.personnage)) refuser("le personnage de la source n'est pas un objet simple.");
    // Sans de quoi le vérifier, un personnage venu d'ailleurs ne passe pas :
    // « Fiche complète » l'afficherait avec les fonctions du site.
    if (typeof accepter !== "function") refuser("le personnage de la source ne peut pas être vérifié.");
    try {
      accepter(copieSimple(donnee.personnage, quoi));
    } catch (echec) {
      if (echec instanceof Refus) throw echec;
      refuser("le personnage de la source est refusé.");
    }
    return { personnage: copieSimple(donnee.personnage, quoi) };
  }
  champs(donnee, quoi, ["ligne", "types", "resolu"]);
  if (!estObjet(donnee.ligne) || !estObjet(donnee.resolu) || !Array.isArray(donnee.types) || !donnee.types.every(estObjet)) {
    refuser(`${quoi} n'a pas la forme d'un adversaire : sa ligne, celles de ses types, sa résolution.`);
  }
  const copie = copieSimple({ ligne: donnee.ligne, types: donnee.types, resolu: donnee.resolu }, quoi);
  // La copie est faite de données simples : son JSON s'écrit sans surprise,
  // et sa longueur est celle que le combat gardera.
  if (JSON.stringify(copie).length > BORNES_PHOTO.source) refuser(`${quoi} dépasse ${ecrireNombre(BORNES_PHOTO.source)} signes.`);
  return copie;
}

/** Trois nombres, un par lettre, ou rien. */
function lireDegats(valeur, quoi) {
  if (valeur === null) return null;
  if (!Array.isArray(valeur) || valeur.length !== LETTRES.length) refuser(`${quoi} ne sont pas ${LETTRES.length} nombres.`);
  return valeur.map((degat) => nombre(degat, `${quoi} : l'un d'eux`));
}

/** Les caractéristiques d'un dé : une ou deux, la même pouvant compter double. */
function lireMobilisees(valeur, quoi) {
  if (!Array.isArray(valeur) || valeur.length < 1 || valeur.length > 2 || valeur.some((code) => !CODES_CARACTERISTIQUES.includes(code))) {
    refuser(`${quoi} ne sont pas une ou deux caractéristiques connues.`);
  }
  return [...valeur];
}

/**
 * Les types d'armure dont le dé de défense est à égalité avec celui du type
 * retenu (contrat du groupe 2, § 5.4) : vide, ou deux à trois types
 * distincts, rangés lourde, agile, précise, dont le type retenu.
 */
function lireEgalite(valeur, type) {
  const quoi = "l'égalité de la défense";
  liste(valeur, quoi, POIDS.length, "types");
  if (valeur.length === 0) return [];
  const rangs = valeur.map((code) => POIDS.indexOf(code));
  const ranges = rangs.every((rang, k) => rang >= 0 && (k === 0 || rang > rangs[k - 1]));
  if (valeur.length < 2) refuser(`${quoi} n'est ni vide, ni de deux types au moins.`);
  if (!ranges) refuser(`${quoi} n'est pas faite de types distincts, rangés lourde, agile, précise.`);
  if (!valeur.includes(type)) refuser(`${quoi} ne compte pas le type retenu.`);
  return [...valeur];
}

const lireFaces = (valeur, quoi) => entier(valeur, quoi, 2, BORNES_PHOTO.faces);
const lireLocMultiple = (valeur, quoi) => entier(valeur, quoi, 1, BORNES_PHOTO.des);

/**
 * Les zones : toutes les faces du d20, sauf celle de la contre-attaque, sans
 * trou ni chevauchement. La localisation trouve ainsi toujours une zone, même
 * sur un contenu forgé.
 */
function lireZones(donnee, faceContre) {
  liste(donnee, "la liste des zones", BORNES_PHOTO.zones, "zones");
  if (donnee.length === 0) refuser("la liste des zones est vide.");
  const premiere = faceContre === 1 ? 2 : 1;
  const derniere = faceContre === FACES_LOCALISATION ? FACES_LOCALISATION - 1 : FACES_LOCALISATION;
  let attendue = premiere;
  const zones = donnee.map((zone, rang) => {
    const quoi = `la zone n° ${rang + 1}`;
    champs(zone, quoi, CHAMPS_ZONE);
    const lue = {
      nom: ligne(zone.nom, `le nom de ${quoi}`),
      ecrit: ligne(zone.ecrit, `le nom écrit de ${quoi}`),
      code: zone.code === null ? null : parmi(zone.code, `le code de ${quoi}`, CODES_ZONES),
      debut: entier(zone.debut, `la première face de ${quoi}`, 1, FACES_LOCALISATION),
      fin: entier(zone.fin, `la dernière face de ${quoi}`, 1, FACES_LOCALISATION),
      armure: nombre(zone.armure, `l'armure de ${quoi}`),
      resistance: nombre(zone.resistance, `la résistance de ${quoi}`),
    };
    if (lue.debut !== attendue) {
      refuser(rang === 0 ? `la grille des zones ne commence pas à la face ${premiere}.` : `la grille des zones a un trou ou un chevauchement avant ${quoi}.`);
    }
    if (lue.fin < lue.debut) refuser(`${quoi} finit avant de commencer.`);
    attendue = lue.fin + 1;
    return lue;
  });
  if (attendue !== derniere + 1) refuser(`la grille des zones ne finit pas à la face ${derniere}.`);
  return zones;
}

function lireArmes(donnee) {
  return liste(donnee, "la liste des armes", BORNES_PHOTO.armes, "armes").map((arme, rang) => {
    const quoi = `l'arme n° ${rang + 1}`;
    champs(arme, quoi, CHAMPS_ARME);
    // Un dé fixe a ses faces et ses caractéristiques ; un dé au choix, ou
    // l'arme d'un adversaire, qui ne lance rien, n'a ni les unes ni les autres.
    if ((arme.faces === null) !== (arme.caracteristiques === null)) refuser(`${quoi} a un dé sans caractéristiques, ou l'inverse.`);
    return {
      nom: ligne(arme.nom, `le nom de ${quoi}`),
      libelle: ligne(arme.libelle, `le libellé de ${quoi}`),
      poids: arme.poids === null ? null : parmi(arme.poids, `le poids de ${quoi}`, POIDS),
      faces: arme.faces === null ? null : lireFaces(arme.faces, `le dé de ${quoi}`),
      caracteristiques: arme.caracteristiques === null ? null : lireMobilisees(arme.caracteristiques, `les caractéristiques de ${quoi}`),
      degats: lireDegats(arme.degats, `les dégâts de ${quoi}`),
      portee: nombre(arme.portee, `la portée de ${quoi}`),
      locMultiple: lireLocMultiple(arme.locMultiple, `le nombre de d20 de ${quoi}`),
      mainsNues: booleen(arme.mainsNues, `« mainsNues » de ${quoi}`),
    };
  });
}

function lireCout(donnee, quoi) {
  if (donnee === null) return null;
  champs(donnee, quoi, ["souffle", "lien"]);
  const part = (valeur, nom) => (valeur === "X" ? "X" : nombre(valeur, `${quoi} en ${nom}`));
  return { souffle: part(donnee.souffle, "souffle"), lien: part(donnee.lien, "lien") };
}

/**
 * La cause d'un désavantage de maîtrise (contrat du groupe 2, § 5.3) : l'objet
 * qui donne la capacité, sinon son bloc, et son type. Elle ne sert qu'à la
 * phrase de cause : présente exactement quand la façon porte un désavantage,
 * nulle sinon.
 */
function lireMaitrise(valeur, quoi, desavantage) {
  if ((valeur !== null) !== desavantage) refuser(`${quoi} n'a pas la maîtrise que veut « desavantage ».`);
  if (valeur === null) return null;
  const deLaMaitrise = `de la maîtrise de ${quoi}`;
  champs(valeur, `la maîtrise de ${quoi}`, ["origine", "poids"]);
  return { origine: ligne(valeur.origine, `l'origine ${deLaMaitrise}`), poids: parmi(valeur.poids, `le poids ${deLaMaitrise}`, POIDS) };
}

function lireFacon(donnee, quoi, deLaCapacite, armes) {
  champs(donnee, quoi, CHAMPS_FACON);
  const lue = {
    puissance: nombre(donnee.puissance, `la puissance de ${quoi}`),
    arme: donnee.arme === null ? null : indiceDans(donnee.arme, `l'arme de ${quoi}`, armes),
    libelle: donnee.libelle === null ? null : ligne(donnee.libelle, `le libellé de ${quoi}`),
    cout: lireCout(donnee.cout, `le coût de ${quoi}`),
    description: texte(donnee.description, `la description ${deLaCapacite}`),
    elements: liste(donnee.elements, `la liste des éléments ${deLaCapacite}`, BORNES_PHOTO.elements, "éléments").map((element) => ligne(element, `un élément ${deLaCapacite}`)),
    passif: booleen(donnee.passif, `« passif » de ${quoi}`),
    intervention: booleen(donnee.intervention, `« intervention » de ${quoi}`),
    attaque: booleen(donnee.attaque, `« attaque » de ${quoi}`),
    degats: lireDegats(donnee.degats, `les dégâts de ${quoi}`),
    portee: nombre(donnee.portee, `la portée de ${quoi}`),
    locMultiple: lireLocMultiple(donnee.locMultiple, `le nombre de d20 de ${quoi}`),
    desavantage: booleen(donnee.desavantage, `« desavantage » de ${quoi}`),
  };
  // Après les autres champs, pour que les refus gardent leur ordre.
  lue.maitrise = lireMaitrise(donnee.maitrise, quoi, lue.desavantage);
  return lue;
}

// « numero » la nomme tant que son nom n'est pas lu : « la capacité n° 3 »,
// ou « la capacité figée ».
function lireCapacite(donnee, numero, armes, liens) {
  champs(donnee, numero, CHAMPS_CAPACITE);
  const nom = ligne(donnee.nom, `le nom de ${numero}`);
  // Le nom est lu : il peut maintenant se citer.
  const quoi = `« ${nom} »`;
  champs(donnee.groupe, `le groupe de ${quoi}`, ["genre", "titre"]);
  if (donnee.inactive !== null && donnee.inactive !== ABSENTE) refuser(`« inactive » de ${quoi} n'est pas une valeur connue.`);
  liste(donnee.facons, `la liste des façons de ${quoi}`, BORNES_PHOTO.facons, "façons");
  // Une capacité absente de la banque n'a aucune façon ; toute autre en a au
  // moins une, que le noyau lit sans la chercher.
  if ((donnee.inactive === null) !== donnee.facons.length > 0) refuser(`${quoi} n'a pas le nombre de façons que veut « inactive ».`);
  return {
    nom,
    role: donnee.role === null ? null : parmi(donnee.role, `le rôle de ${quoi}`, ROLES),
    niveau: nombre(donnee.niveau, `le niveau de ${quoi}`),
    evolue: booleen(donnee.evolue, `« evolue » de ${quoi}`),
    groupe: {
      genre: parmi(donnee.groupe.genre, `le genre du groupe de ${quoi}`, GENRES_DE_GROUPE),
      titre: ligne(donnee.groupe.titre, `le titre du groupe de ${quoi}`),
    },
    lien: donnee.lien === null ? null : indiceDans(donnee.lien, `la jauge de lien de ${quoi}`, liens),
    inactive: donnee.inactive,
    facons: donnee.facons.map((facon, k) => lireFacon(facon, `la façon n° ${k + 1} de ${quoi}`, `de ${quoi}`, armes)),
  };
}

/**
 * Une capacité figée (contrat du groupe 3, § 5.1, § 9) : une capacité d'un
 * bloc d'état ou de blessure, que l'événement porte au format de la
 * photographie pour que le rejeu ne lise jamais la banque. Elle se lit comme
 * une capacité de photographie, sans arme ni jauge où renvoyer (« arme » et
 * « lien » nuls) ; elle n'a pas de rôle câblé, qui ne se reconnaît qu'à la
 * photographie, et n'est jamais absente de la banque, d'où elle vient.
 */
function lireCapaciteFigee(donnee) {
  const capacite = lireCapacite(donnee, "la capacité figée", 0, 0);
  if (capacite.role !== null) refuser(`« ${capacite.nom} » porte un rôle câblé : une capacité figée n'en a pas.`);
  if (capacite.inactive !== null) refuser(`« ${capacite.nom} » est dite absente de la banque.`);
  return capacite;
}

/**
 * Une capacité figée, seule : ce que l'écran vérifie avant de la mettre dans
 * un événement. Rend { capacite }, une copie gelée, ou { erreur } : une phrase
 * sans majuscule, qui nomme le champ.
 */
export function validerCapaciteFigee(donnee) {
  try {
    return { capacite: geler(lireCapaciteFigee(donnee)) };
  } catch (echec) {
    return { erreur: phraseDe(echec, "la capacité figée ne se lit pas.") };
  }
}

function lireValeurs(donnee, camp) {
  champs(donnee, "la liste des valeurs", CHAMPS_VALEURS);
  const pj = camp === "pj";
  const nul = (valeur, quoi) => (valeur === null ? null : refuser(`${quoi} n'est pas vide, pour ${pj ? "un personnage" : "un adversaire"}.`));

  const souffle = nombre(donnee.souffle, "le souffle");
  if (booleen(donnee.souffleAbsent, "« souffleAbsent »") && souffle !== 0) refuser("le souffle est dit absent, et n'est pas nul.");
  if (donnee.faceContre !== FACE_CONTRE[camp]) refuser("la face de contre-attaque n'est pas celle de son camp.");

  let caracteristiques = null;
  if (pj) {
    champs(donnee.caracteristiques, "la liste des caractéristiques", CODES_CARACTERISTIQUES);
    caracteristiques = Object.fromEntries(CODES_CARACTERISTIQUES.map((code) => [code, nombre(donnee.caracteristiques[code], `la caractéristique « ${code} »`)]));
  } else nul(donnee.caracteristiques, "la liste des caractéristiques");

  let deDefense = null;
  if (pj) {
    champs(donnee.deDefense, "le dé de défense", CHAMPS_DE_DEFENSE);
    deDefense = {
      faces: lireFaces(donnee.deDefense.faces, "le dé de défense"),
      type: parmi(donnee.deDefense.type, "le type de la défense", POIDS),
      caracteristiques: lireMobilisees(donnee.deDefense.caracteristiques, "les caractéristiques de la défense"),
      meles: booleen(donnee.deDefense.meles, "« meles » de la défense"),
    };
    deDefense.egalite = lireEgalite(donnee.deDefense.egalite, deDefense.type);
  } else nul(donnee.deDefense, "le dé de défense");

  const armes = lireArmes(donnee.armes);

  let bouclier = null;
  if (donnee.bouclier !== null) {
    champs(donnee.bouclier, "le bouclier", ["nom", "defense"]);
    bouclier = { nom: ligne(donnee.bouclier.nom, "le nom du bouclier"), defense: nombre(donnee.bouclier.defense, "la défense du bouclier") };
  }

  const liens = liste(donnee.liens, "la liste des jauges de lien", BORNES_PHOTO.liens, "jauges").map((jauge, rang) => {
    const quoi = `la jauge de lien n° ${rang + 1}`;
    champs(jauge, quoi, ["nom", "points"]);
    return { nom: ligne(jauge.nom, `le nom de ${quoi}`), points: nombre(jauge.points, `les points de ${quoi}`) };
  });

  const capacites = liste(donnee.capacites, "la photographie", BORNES_PHOTO.capacites, "capacités").map((capacite, rang) =>
    lireCapacite(capacite, `la capacité n° ${rang + 1}`, armes.length, liens.length),
  );

  // Les façons se comptent aussi ensemble : l'offre les juge toutes à chaque
  // capacité jouée, et calcule pour celles de déplacement les cases où elles
  // mènent. Ce que la borne de chaque liste laisse passer, mis bout à bout,
  // ferait durer des minutes le rejeu d'un combat forgé.
  const faconsEnTout = capacites.reduce((total, capacite) => total + capacite.facons.length, 0);
  if (faconsEnTout > BORNES_PHOTO.faconsEnTout) refuser(`la photographie compte plus de ${ecrireNombre(BORNES_PHOTO.faconsEnTout)} façons.`);
  const deplacements = capacites.reduce((total, capacite) => total + (capacite.role === "deplacement" ? capacite.facons.length : 0), 0);
  if (deplacements > BORNES_PHOTO.deplacements) refuser(`les capacités de déplacement comptent plus de ${ecrireNombre(BORNES_PHOTO.deplacements)} façons.`);

  const passifs = liste(donnee.passifs, "la liste des passifs câblés", capacites.length, "passifs").map((passif, rang) => {
    const du = `du passif câblé n° ${rang + 1}`;
    champs(passif, `le passif câblé n° ${rang + 1}`, ["capacite", "role", "niveau"]);
    return {
      capacite: indiceDans(passif.capacite, `la capacité ${du}`, capacites.length),
      role: parmi(passif.role, `le rôle ${du}`, ROLES_PASSIFS),
      niveau: nombre(passif.niveau, `le niveau ${du}`),
    };
  });

  return {
    identifiant: pj ? ligne(donnee.identifiant, "l'identifiant du personnage") : nul(donnee.identifiant, "l'identifiant"),
    nom: ligne(donnee.nom, "le nom"),
    sousTitre: ligne(donnee.sousTitre, "le sous-titre", 0),
    actions: nombre(donnee.actions, "le nombre d'actions"),
    souffle,
    corps: nombre(donnee.corps, "le corps"),
    souffleAbsent: donnee.souffleAbsent,
    zones: lireZones(donnee.zones, donnee.faceContre),
    faceContre: donnee.faceContre,
    caracteristiques,
    attaque: pj ? nul(donnee.attaque, "l'attaque") : nombre(donnee.attaque, "l'attaque"),
    defense: pj ? nul(donnee.defense, "la défense") : nombre(donnee.defense, "la défense"),
    deDefense,
    armes,
    armePretee: donnee.armePretee === null ? null : pj ? indiceDans(donnee.armePretee, "l'arme prêtée", armes.length) : nul(donnee.armePretee, "l'arme prêtée"),
    bouclier,
    liens,
    passifs,
    capacites,
  };
}

function lirePhoto(donnee, accepter) {
  champs(donnee, "la photographie", CHAMPS_PHOTO);
  const camp = parmi(donnee.camp, "le camp", CAMPS);
  return {
    camp,
    publiee_le: donnee.publiee_le === null ? null : ligne(donnee.publiee_le, "la date de la banque"),
    source: lireSource(donnee.source, camp, accepter),
    valeurs: lireValeurs(donnee.valeurs, camp),
    avertissements: liste(donnee.avertissements, "la photographie", BORNES_PHOTO.avertissements, "avertissements").map((avertissement, rang) =>
      texte(avertissement, `l'avertissement n° ${rang + 1}`),
    ),
  };
}

/**
 * Une photographie : ses champs, ses bornes (BORNES_PHOTO), ses indices, sa
 * grille. « accepter » est la fonction de js/personnage/format.js, par
 * laquelle repasse le personnage d'une source ; le noyau, qui ne lit jamais la
 * source, n'en a pas besoin pour une photographie sans source.
 *
 * Rend { photo }, une copie gelée, ou { erreur } : une phrase sans majuscule,
 * qui nomme le champ (« la description de « Jet de sel » dépasse 4 000
 * signes. »).
 */
export function validerPhoto(donnee, options) {
  try {
    return { photo: geler(lirePhoto(donnee, options?.accepter)) };
  } catch (echec) {
    return { erreur: phraseDe(echec, "la photographie ne se lit pas.") };
  }
}

// ─── Le contenu ─────────────────────────────────────────────────────────────

function lireMiseEnPlace(donnee, mode, accepter) {
  champs(donnee, "La mise en place", ["mode", "quiCommence", "compteur", "protagonistes"]);
  if (typeof mode !== "string" || donnee.mode !== mode) refuser("La mise en place n'est pas celle de ce mode.");
  const quiCommence = parmi(donnee.quiCommence, "Le camp qui commence", CAMPS);
  // Au-delà, un identifiant aurait un chiffre de trop : le protagoniste ajouté
  // ensuite ne pourrait rien jouer, et le combat ne se relirait plus.
  const compteur = entier(donnee.compteur, "Le compteur des identifiants", 0, IDENTIFIANTS_MAX);
  liste(donnee.protagonistes, "La mise en place", PLAFOND_PJ + PLAFOND_ADVERSAIRES, "protagonistes");

  const vus = new Set();
  const personnages = new Set();
  const exemplaires = new Map();
  const comptes = { pj: 0, adv: 0 };
  const protagonistes = donnee.protagonistes.map((protagoniste, rang) => {
    const quoi = `Le protagoniste n° ${rang + 1}`;
    champs(protagoniste, quoi, ["id", "camp", "case", "photo"]);
    const id = identifiant(protagoniste.id, `L'identifiant du protagoniste n° ${rang + 1}`);
    const camp = parmi(protagoniste.camp, `Le camp de « ${id} »`, CAMPS);
    // Un identifiant dit son camp et son numéro : il ne resert jamais, et le
    // compteur, qui ne redescend pas, a dépassé tous ceux qui existent.
    if (!id.startsWith(camp)) refuser(`L'identifiant « ${id} » n'est pas celui de son camp.`);
    if (Number(id.slice(camp.length)) > compteur) refuser(`L'identifiant « ${id} » dépasse le compteur.`);
    if (vus.has(id)) refuser(`L'identifiant « ${id} » sert deux fois.`);
    vus.add(id);
    const lue = validerPhoto(protagoniste.photo, { accepter });
    if (lue.erreur) refuser(`La photographie de « ${id} » est refusée : ${lue.erreur}`);
    if (lue.photo.camp !== camp) refuser(`La photographie de « ${id} » n'est pas de son camp.`);
    comptes[camp] += 1;
    if (camp === "pj") {
      if (personnages.has(lue.photo.valeurs.identifiant)) refuser(`Le personnage de « ${id} » est deux fois dans le combat.`);
      personnages.add(lue.photo.valeurs.identifiant);
    } else {
      const combien = (exemplaires.get(lue.photo.valeurs.nom) ?? 0) + 1;
      if (combien > PLAFOND_EXEMPLAIRES) refuser(`Le combat compte plus de ${PLAFOND_EXEMPLAIRES} exemplaires d'un même adversaire.`);
      exemplaires.set(lue.photo.valeurs.nom, combien);
    }
    return { id, camp, case: nomDeCase(protagoniste.case, `La case de « ${id} »`), photo: lue.photo };
  });
  if (comptes.pj > PLAFOND_PJ) refuser(`Le combat compte plus de ${PLAFOND_PJ} personnages.`);
  if (comptes.adv > PLAFOND_ADVERSAIRES) refuser(`Le combat compte plus de ${PLAFOND_ADVERSAIRES} adversaires.`);
  return { mode: donnee.mode, quiCommence, compteur, protagonistes };
}

function lireContenu(donnee, mode, revision, accepter) {
  champs(donnee, "Le contenu", ["regles", "revision", "miseEnPlace", "evenements"]);
  if (donnee.regles !== REGLES) refuser("La version des règles du contenu ne se lit pas.");
  // La révision est répétée dans le chiffré : la donnée associée au
  // chiffrement ne couvre que le mode, et une enveloppe pourrait sinon en
  // habiller une autre.
  if (!Number.isSafeInteger(donnee.revision) || donnee.revision < 0 || donnee.revision !== revision) {
    refuser("La révision du contenu n'est pas celle de son enveloppe.");
  }
  const miseEnPlace = lireMiseEnPlace(donnee.miseEnPlace, mode, accepter);
  liste(donnee.evenements, "Le combat", EVENEMENTS_MAX, "événements");
  const evenements = donnee.evenements.map((evenement, rang) => {
    const lu = validerEvenement(evenement);
    if (lu.erreur) refuser(`L'événement n° ${rang + 1} est refusé : ${lu.erreur}`);
    return lu.evenement;
  });
  return { regles: donnee.regles, revision: donnee.revision, miseEnPlace, evenements };
}

/**
 * Le contenu déchiffré d'un combat gardé, avant tout rejeu. « mode » est celui
 * de la visite, « revision » celle de l'enveloppe, « accepter » la fonction de
 * js/personnage/format.js.
 *
 * Rend { contenu }, une copie gelée ; ou { autreVersion: { regles } }, quand
 * le combat suit une autre version des règles : ce n'est pas une donnée
 * abîmée, et rien d'autre n'en est examiné, parce qu'une autre version peut
 * avoir ajouté un champ ; ou { erreur }, une phrase.
 */
export function validerContenu(donnee, options) {
  try {
    if (estObjet(donnee) && Number.isSafeInteger(donnee.regles) && donnee.regles !== REGLES) return { autreVersion: geler({ regles: donnee.regles }) };
    return { contenu: geler(lireContenu(donnee, options?.mode, options?.revision, options?.accepter)) };
  } catch (echec) {
    return { erreur: phraseDe(echec, "Le contenu ne se lit pas.") };
  }
}
