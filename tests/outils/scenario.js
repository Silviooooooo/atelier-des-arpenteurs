// Le lecteur de scénario du simulateur de combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) », et § 11).
//
// Un combat de contrôle s'écrit comme on le raconte : avec des noms (« Aubépine
// joue Frappe contre Marmiton n° 1 ») et des dés tels qu'ils tombent, avant
// tout modificateur. Le moteur, lui, ne connaît que des événements à indices.
// Ce module traduit l'un en l'autre, et il est le seul à le faire : le combat
// de référence, le banc sur le vrai classeur et la capture de l'écran passent
// tous par versContenu(), si bien qu'un scénario se lit partout de la même
// façon.
//
// Il ne décide de rien : à chaque pas il demande à l'offre du moteur ce qui
// est attendu (un dé et ses faces, un choix, les dégâts, « Appliquer ») et y
// répond avec ce que le scénario a écrit. Les faces d'un dé viennent donc du
// moteur ; le scénario ne donne que des valeurs.
//
// Tous les dés d'une liste sont lancés, et aucun autre : un dé de trop, un dé
// qui manque, une consigne qui ne sert pas ou un événement refusé lèvent, en
// citant le geste. Un scénario qui ne tombe pas juste signale un écart de
// lecture entre celui qui l'a écrit et le moteur.
//
// ── Un scénario ─────────────────────────────────────────────────────────────
//
// { mode, quiCommence, lanceLe,
//   ajouts: [["pj", nom entier], ["adversaire", nom entier, nombre]],
//   cases: { [nom court]: "C3" },      les déplacements d'avant le lancement
//   gestes: [ … ] }
//
// Un geste :
//   { finDeTour: true }                « Fin de tour », par le bouton
//   { annuler: true }                  « Annuler le dernier geste »
//   { qui, passe: true }               « Passer son tour »
//   { qui, joue, … }                   une capacité, par son nom
// « qui », « contre » et « sur » sont des noms courts, ceux du journal. Une
// fin de tour automatique ne s'écrit pas : le moteur la fait de lui-même.
//
// Les champs d'une capacité jouée :
//   puissance, arme      la façon : sa puissance, ou le libellé de l'arme qui
//                        la donne. Sans puissance, un adversaire ne joue que
//                        ses façons de puissance égale à son rang (contrat du
//                        groupe 2, § 5.7) ; sans l'une ni l'autre, un PJ joue
//                        la façon d'office du groupe 1, gardée ici comme
//                        convention de lecture : la plus haute puissance
//                        qu'il peut payer, sinon la plus basse
//   contre, sur          la cible : un adversaire ; un allié ou soi
//   defense              après la cible : le type d'armure du jet de défense
//                        du PJ visé, à égalité de dés (« lourde », « agile »,
//                        « precise »)
//   sansCible            vrai : aucune cible
//   vers                 la case d'arrivée d'un déplacement
//   pret                 vrai, ou le libellé d'une arme : « Jet d'attaque »
//   caracteristiques     un ou deux codes, dans n'importe quel ordre
//   difficulte, x        tels quels
//   main                 { modificateur: [1, "raison"], avantages: [1, "raison"] }
//   des                  les dés de la chaîne, bruts, relances et explosions
//                        à leur place
//   garde                les places (1 à 3) où le dé qui échoue est gardé au
//                        lieu d'être relancé ; partout ailleurs il se relance
//   degats               { base, ajuste, raison, nature } ; la raison est par
//                        défaut le nom de la capacité
//   localisation         les d20, bruts
//   decale               [{ de, valeur, raison }] ; « de » compte de 0
//   esquive              le nombre de dégâts annulés
// « Faire exploser » se choisit toujours.

import { appliquer, gesteEnCours, ouvrirCombat } from "../../js/combat/moteur.js";
import { boutons, offre } from "../../js/combat/offre.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide, poser, reglerQuiCommence } from "../../js/combat/preparation.js";
import { REGLES } from "../../js/combat/regles.js";

const CHAMPS_D_UN_GESTE = [
  "finDeTour",
  "annuler",
  "qui",
  "passe",
  "joue",
  "puissance",
  "arme",
  "contre",
  "sur",
  "defense",
  "sansCible",
  "vers",
  "pret",
  "caracteristiques",
  "difficulte",
  "x",
  "main",
  "des",
  "garde",
  "degats",
  "localisation",
  "decale",
  "esquive",
];

const echouer = (quoi, phrase) => {
  throw new Error(`${quoi} : ${phrase}`);
};

// ─── La mise en place ───────────────────────────────────────────────────────

function parNomCourt(etat, court, quoi) {
  const ids = etat.ordre.filter((id) => etat.noms[id].court === court);
  if (ids.length === 0) echouer(quoi, `personne ne s'appelle « ${court} » (noms courts : ${etat.ordre.map((id) => etat.noms[id].court).join(", ")}).`);
  if (ids.length > 1) echouer(quoi, `plusieurs protagonistes s'appellent « ${court} ».`);
  return ids[0];
}

function mettreEnPlace(scenario, photos) {
  const quoi = "La mise en place";
  const tenir = (rendu) => (rendu.refus ? echouer(quoi, rendu.refus) : rendu);
  const caseDe = (mep, id) => mep.protagonistes.find((protagoniste) => protagoniste.id === id).case;
  let mep = miseEnPlaceVide(scenario.mode);
  const casesDOffice = [];

  for (const [genre, nom, nombre = 1] of scenario.ajouts) {
    if (!Object.hasOwn(photos, nom)) echouer(quoi, `aucune photographie pour « ${nom} ».`);
    if (genre === "pj") {
      const { miseEnPlace, id } = tenir(ajouterPersonnage(mep, photos[nom]));
      mep = miseEnPlace;
      casesDOffice.push(caseDe(mep, id));
    } else if (genre === "adversaire") {
      const { miseEnPlace, ids } = tenir(ajouterAdversaires(mep, Array.from({ length: nombre }, () => photos[nom])));
      mep = miseEnPlace;
      for (const id of ids) casesDOffice.push(caseDe(mep, id));
    } else {
      echouer(quoi, `un ajout est « pj » ou « adversaire », non « ${genre} ».`);
    }
  }

  mep = tenir(reglerQuiCommence(mep, scenario.quiCommence ?? "pj")).miseEnPlace;
  // Les noms courts ne se connaissent qu'une fois tout le monde ajouté : un
  // second exemplaire numérote le premier.
  const nommes = ouvrirCombat(mep);
  for (const [court, nomDeCase] of Object.entries(scenario.cases ?? {})) {
    mep = tenir(poser(mep, parNomCourt(nommes, court, quoi), nomDeCase)).miseEnPlace;
  }
  return { miseEnPlace: mep, casesDOffice };
}

// ─── Un geste ───────────────────────────────────────────────────────────────

// La façon d'office d'un PJ, celle du groupe 1 (règle de lecture d'un
// scénario, non du simulateur, qui n'en a plus) : parmi ses lignes, la plus
// haute puissance qu'il peut payer ; s'il n'en peut payer aucune, la plus
// basse.
function faconDOffice(facons, lignes) {
  const puissance = (ligne) => facons[ligne.facon].puissance;
  const payables = lignes.filter((ligne) => ligne.actif);
  if (payables.length > 0) return payables.reduce((haute, ligne) => (puissance(ligne) > puissance(haute) ? ligne : haute));
  return lignes.reduce((basse, ligne) => (puissance(ligne) < puissance(basse) ? ligne : basse));
}

// La capacité que nomme le scénario, et la façon de la jouer.
function designer(etat, qui, ecrit, quoi) {
  const { capacites } = etat.photos[qui];
  const capacite = capacites.findIndex(({ nom }) => nom === ecrit.joue);
  if (capacite === -1) echouer(quoi, `${etat.noms[qui].court} n'a pas de capacité « ${ecrit.joue} ».`);
  const { facons, niveau: rang } = capacites[capacite];
  const adversaire = etat.protagonistes[qui].camp !== "pj";

  if (ecrit.puissance === undefined && ecrit.arme === undefined) {
    // Ses lignes : un adversaire n'y prend que celles de son rang.
    const lesSiennes = boutons(etat, qui).filter((ligne) => ligne.capacite === capacite && (!adversaire || ligne.facon === null || facons[ligne.facon].puissance === rang));
    if (lesSiennes.length === 0 || lesSiennes[0].facon === null || (adversaire && lesSiennes.length > 1)) {
      echouer(quoi, `« ${ecrit.joue} » a ${lesSiennes.length} bouton(s) jouable(s) : précisez « puissance » ou « arme ».`);
    }
    return { capacite, facon: adversaire ? lesSiennes[0].facon : faconDOffice(facons, lesSiennes).facon };
  }
  const puissanceLue = (facon) => (ecrit.puissance === undefined ? !adversaire || facon.puissance === rang : facon.puissance === ecrit.puissance);
  const trouvees = facons.map((facon, indice) => ({ facon, indice })).filter(({ facon }) => puissanceLue(facon) && (ecrit.arme === undefined || facon.libelle === ecrit.arme));
  if (trouvees.length !== 1) echouer(quoi, `${trouvees.length} façon(s) de « ${ecrit.joue} » répondent à la puissance et à l'arme écrites.`);
  return { capacite, facon: trouvees[0].indice };
}

// Les dés d'une liste, pris dans l'ordre : il en manque un, le geste lève.
function pioche(liste, nom, quoi) {
  const valeurs = liste ?? [];
  let pris = 0;
  return {
    prendre(combien, faces) {
      if (pris + combien > valeurs.length) {
        echouer(quoi, `un dé manque dans « ${nom} » : le moteur attend ${combien} d${faces} après ${pris} valeur(s), et la liste n'en a que ${valeurs.length}.`);
      }
      pris += combien;
      return valeurs.slice(pris - combien, pris);
    },
    verifier() {
      if (pris < valeurs.length) echouer(quoi, `${valeurs.length - pris} dé(s) de trop dans « ${nom} » : ${valeurs.slice(pris).join(", ")}.`);
    },
  };
}

// Les réglages d'avant le premier dé, dans l'ordre où le moteur les veut : le
// jet prêté d'abord, puisqu'il change la portée, donc les cibles possibles.
function regler(partie, qui, ecrit, quoi) {
  const { jouer } = partie;
  const campDe = (id) => partie.etat.protagonistes[id].camp;

  if (ecrit.pret !== undefined && ecrit.pret !== false) {
    jouer({ type: "regler", champ: "jet_prete", valeur: true });
    if (typeof ecrit.pret === "string") {
      const arme = partie.etat.photos[qui].armes.findIndex(({ libelle }) => libelle === ecrit.pret);
      if (arme === -1) echouer(quoi, `${partie.etat.noms[qui].court} n'a pas d'arme « ${ecrit.pret} ».`);
      if (gesteEnCours(partie.etat).armePretee !== arme) jouer({ type: "regler", champ: "arme_pretee", valeur: arme });
    }
  }

  if ([ecrit.contre, ecrit.sur, ecrit.sansCible].filter((champ) => champ !== undefined).length > 1) {
    echouer(quoi, "« contre », « sur » et « sansCible » ne vont pas ensemble.");
  }
  if (ecrit.contre !== undefined) {
    const cible = parNomCourt(partie.etat, ecrit.contre, quoi);
    if (campDe(cible) === campDe(qui)) echouer(quoi, `« contre » vise un adversaire, et ${ecrit.contre} est du même camp : écrivez « sur ».`);
    jouer({ type: "regler", champ: "cible", valeur: cible });
  }
  if (ecrit.sur !== undefined) {
    const cible = parNomCourt(partie.etat, ecrit.sur, quoi);
    if (campDe(cible) !== campDe(qui)) echouer(quoi, `« sur » vise un allié ou soi, et ${ecrit.sur} est de l'autre camp : écrivez « contre ».`);
    jouer({ type: "regler", champ: "cible", valeur: cible });
  }
  // Après la cible, qui la remet au défaut.
  if (ecrit.defense !== undefined) jouer({ type: "regler", champ: "defense", valeur: ecrit.defense });

  if (ecrit.vers !== undefined) jouer({ type: "regler", champ: "arrivee", valeur: ecrit.vers });
  if (ecrit.caracteristiques !== undefined) jouer({ type: "regler", champ: "caracteristiques", valeur: ecrit.caracteristiques });
  if (ecrit.difficulte !== undefined) jouer({ type: "regler", champ: "difficulte", valeur: ecrit.difficulte });
  if (ecrit.x !== undefined) jouer({ type: "regler", champ: "x", valeur: ecrit.x });
  for (const champ of ["modificateur", "avantages"]) {
    if (ecrit.main?.[champ] === undefined) continue;
    const [valeur, raison] = ecrit.main[champ];
    jouer({ type: "regler", champ, valeur, raison });
  }
}

// Les dégâts que fixe le scénario : ce qu'il n'écrit pas garde la valeur du
// moment (la base par défaut, des dégâts normaux).
function degatsEcrits(etat, ecrit) {
  const { base, ajuste, raison, nature } = ecrit.degats;
  const geste = gesteEnCours(etat);
  const nom = etat.photos[geste.acteur].capacites[geste.capacite].nom;
  return {
    type: "degats",
    base: base ?? geste.degats.base,
    operations: ajuste === undefined ? [] : [{ op: "ajuster", valeur: ajuste, raison: raison ?? nom }],
    nature: nature ?? "normaux",
  };
}

/**
 * Joue une capacité : « capacite », les réglages, puis ce que l'offre attend,
 * tant que le geste est ouvert. S'arrête, sans le finir, une fois lancés
 * « desPermis » dés et faits les choix du jet qui les suivent. Rend vrai si
 * le geste est allé au bout.
 */
function jouerUneCapacite(partie, ecrit, quoi, desPermis) {
  const { jouer } = partie;
  const qui = parNomCourt(partie.etat, ecrit.qui, quoi);
  jouer({ type: "capacite", qui, ...designer(partie.etat, qui, ecrit, quoi) });
  regler(partie, qui, ecrit, quoi);

  const des = pioche(ecrit.des, "des", quoi);
  const d20 = pioche(ecrit.localisation, "localisation", quoi);
  const gardes = new Set(ecrit.garde ?? []);
  const faits = { degats: ecrit.degats === undefined, decale: ecrit.decale === undefined, esquive: ecrit.esquive === undefined };
  let lances = 0;

  while (gesteEnCours(partie.etat) !== null) {
    const offert = offre(partie.etat);
    if (offert.choix.includes("exploser")) {
      jouer({ type: "exploser" });
    } else if (offert.choix.includes("relancer")) {
      const place = gesteEnCours(partie.etat).jet.places.length;
      jouer({ type: gardes.delete(place) ? "garder" : "relancer" });
    } else if (lances >= desPermis) {
      // Les dés permis sont lancés, et les choix du jet qui les suivaient
      // sont faits : on s'arrête là, en plein geste.
      return false;
    } else if (offert.types.includes("confirmer")) {
      jouer({ type: "confirmer" });
    } else if (offert.degats !== null && !faits.degats) {
      // Les dégâts se fixent à la fin du jet, avant le premier d20.
      jouer(degatsEcrits(partie.etat, ecrit));
      faits.degats = true;
    } else if (offert.de !== null) {
      const { faces, combien, motif } = offert.de;
      jouer({ type: "de", faces, valeurs: (motif === "localisation" ? d20 : des).prendre(combien, faces) });
      lances += 1;
    } else if (offert.types.includes("appliquer")) {
      if (!faits.decale) {
        for (const { de, valeur, raison } of ecrit.decale) jouer(raison === undefined ? { type: "decaler", de, valeur } : { type: "decaler", de, valeur, raison });
        faits.decale = true;
      }
      if (!faits.esquive) {
        jouer({ type: "esquive", x: ecrit.esquive });
        faits.esquive = true;
      }
      jouer({ type: "appliquer" });
    } else {
      echouer(quoi, `le geste n'avance plus${offert.pret?.manque ? ` : ${offert.pret.manque}` : "."}`);
    }
  }

  des.verifier();
  d20.verifier();
  for (const [consigne, faite] of Object.entries(faits)) {
    if (!faite) echouer(quoi, `« ${consigne} » est écrit, mais le geste a fini sans que le moteur l'offre.`);
  }
  if (gardes.size > 0) echouer(quoi, `aucun dé n'était à garder à la place ${[...gardes].join(", ")}.`);
  return true;
}

function jouerUnGeste(partie, ecrit, quoi, desPermis) {
  for (const champ of Object.keys(ecrit)) {
    if (!CHAMPS_D_UN_GESTE.includes(champ)) echouer(quoi, `le champ « ${champ} » n'existe pas.`);
  }
  if (ecrit.finDeTour) {
    partie.jouer({ type: "fin_de_tour" });
    return true;
  }
  if (ecrit.annuler) {
    partie.jouer({ type: "annuler" });
    return true;
  }
  if (ecrit.passe) {
    partie.jouer({ type: "passer", qui: parNomCourt(partie.etat, ecrit.qui, quoi) });
    return true;
  }
  return jouerUneCapacite(partie, ecrit, quoi, desPermis);
}

// ─── Le scénario entier ─────────────────────────────────────────────────────

// Où s'arrêter : après tant de gestes, ou en plein geste.
function lireLArret(jusqua, nombre) {
  if (jusqua === null || jusqua === undefined) return { entiers: nombre, des: null };
  if (Number.isInteger(jusqua) && jusqua >= 0 && jusqua <= nombre) return { entiers: jusqua, des: null };
  const { geste, des } = jusqua ?? {};
  if (Number.isInteger(geste) && geste >= 1 && geste <= nombre && Number.isInteger(des) && des >= 0) return { entiers: geste - 1, des };
  throw new Error(`« jusqua » est un nombre de gestes (de 0 à ${nombre}), ou { geste, des } : le numéro d'un geste et le nombre de dés lancés avant de s'arrêter.`);
}

/**
 * Traduit un scénario en contenu de combat, en le jouant par le moteur.
 *
 * - photos : { [nom entier]: photographie }, une par nom des ajouts (les
 *   exemplaires d'un adversaire partagent la leur).
 * - jusqua : par défaut, tout le scénario. Un nombre : s'arrêter après tant
 *   de gestes. { geste, des } : jouer les gestes d'avant, puis celui-là (ils
 *   se comptent de 1) jusqu'à ce que « des » dés soient lancés, chaîne et d20
 *   confondus. Les choix du jet qui suivent ce dé (relancer, garder, faire
 *   exploser) sont faits, et rien d'autre : ni dégâts fixés, ni esquive, ni
 *   « Appliquer ». À 0, le geste est réglé, et rien n'est payé. Un geste que
 *   ce dé finit, ou qui n'en lance pas tant, lève : on ne s'y arrête pas.
 *
 * Rend { contenu, etat, casesDOffice } :
 * - contenu : { regles, revision: 1, miseEnPlace, evenements }, ce qu'un
 *   combat garde ;
 * - etat : l'état du moteur après le dernier événement ;
 * - casesDOffice : la case où chaque ajout s'est posé de lui-même, dans
 *   l'ordre des ajouts, avant les déplacements de « cases ».
 */
export function versContenu(scenario, photos, { jusqua } = {}) {
  const { miseEnPlace, casesDOffice } = mettreEnPlace(scenario, photos);
  const evenements = [];
  let quoi = "Le lancement";
  const partie = {
    etat: ouvrirCombat(miseEnPlace),
    jouer(evenement) {
      const { etat, refus } = appliquer(partie.etat, evenement);
      if (refus) echouer(quoi, `l'événement ${JSON.stringify(evenement)} est refusé (${refus.code}) : ${refus.message}`);
      evenements.push(evenement);
      partie.etat = etat;
    },
  };

  partie.jouer({ type: "lancer", le: scenario.lanceLe });
  const arret = lireLArret(jusqua, scenario.gestes.length);
  const genre = (ecrit) => (ecrit.passe ? "passe" : ecrit.finDeTour ? "fin de tour" : ecrit.annuler ? "annuler" : null);
  const nommer = (rang, ecrit) => `Geste n° ${rang + 1} (${[ecrit.qui, ecrit.joue ?? genre(ecrit)].filter(Boolean).join(", ")})`;

  for (let rang = 0; rang < arret.entiers; rang += 1) {
    quoi = nommer(rang, scenario.gestes[rang]);
    jouerUnGeste(partie, scenario.gestes[rang], quoi, Infinity);
  }
  if (arret.des !== null) {
    const ecrit = scenario.gestes[arret.entiers];
    quoi = nommer(arret.entiers, ecrit);
    if (jouerUnGeste(partie, ecrit, quoi, arret.des)) echouer(quoi, `le geste a fini avant qu'on s'y arrête (${arret.des} dé(s) demandé(s)).`);
  }

  return { contenu: { regles: REGLES, revision: 1, miseEnPlace, evenements }, etat: partie.etat, casesDOffice };
}
