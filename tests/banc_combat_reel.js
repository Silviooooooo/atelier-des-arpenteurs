// Banc du simulateur de combat sur le classeur réel (SPECIFICATION.md, § 17
// « Le simulateur de combat (lot 4) », et § 11).
//
//   node tests/banc_combat_reel.js chemin/vers/regles_jdr.xlsx chemin/vers/scenario.json
//
// Les contrôles de node --test ne voient que la démonstration, dont les noms
// sont fictifs. Ce banc rejoue un combat de référence sur le vrai classeur,
// avec ses dés imposés, pour vérifier ce qu'eux ne peuvent pas voir :
// - que chaque rôle câblé y est reconnu par l'empreinte de son nom : la ligne
//   « Câblés absents de la banque » doit être vide ;
// - que les personnages et les adversaires du scénario se photographient, et
//   avec eux chaque adversaire complet du classeur : un texte du classeur qui
//   sortirait des bornes d'une photographie se voit ici, avant de se voir à
//   l'écran ;
// - que le combat joué rend le journal du scénario, ligne à ligne et mot pour
//   mot, et son état final ;
// - que ce combat, tel qu'il serait gardé, se relit et se rejoue à l'identique ;
// - qu'arrêté à un moment que dit le scénario (celui que montre la maquette),
//   il attend le dé et montre l'état qu'on en attend.
//
// Et, depuis le groupe 2 (contrat du groupe, § 14, N7 f ; complément, § 5.3) :
// - que chaque adversaire complet se résout au rang comme à chaque puissance
//   (capacitesA, au rang, égale resoudre), et qu'aucune de ses photographies
//   ne passe les bornes des façons : vingt par capacité, armes et puissances
//   comprises, sans quoi il ne s'ajouterait plus ;
// - que chaque ligne du journal est la concaténation de ses segments, et
//   qu'à chaque événement la ligne en cours débute la ligne que le geste
//   écrira ;
// - que l'offre allégée (le jugement de la seule façon demandée) rend, à
//   chaque état du combat, le verdict du groupe 1, qui jugeait toutes les
//   façons ;
// - la taille du texte que garderait le pire contenu : la plus grosse mise en
//   place que les plafonds permettent, et 15 000 événements du plus long que
//   le moteur accepte.
//
// node --test ne le lance pas : il demande le classeur réel, qui n'entre
// jamais dans le dépôt. Le classeur se lit là où il est ; le banc ne le copie
// pas et n'écrit rien. Il ne garde aucune donnée réelle : le scénario, qui
// porte des noms du classeur, reste hors dépôt, et ce fichier n'en écrit
// aucun.
//
// Un écart n'est pas un échec : l'auteur a pu changer son classeur depuis que
// le scénario a été écrit. Le banc dit chaque écart, et les valeurs de départ
// qui aident à l'expliquer ; il ne corrige rien. Il rend 1 seulement s'il ne
// peut pas jouer le combat (un fichier illisible, une photographie refusée,
// un geste que le moteur refuse), 2 s'il lui manque un argument.
//
// ── Le scénario ─────────────────────────────────────────────────────────────
//
// Un fichier JSON, au format du lecteur de scénario (tests/outils/scenario.js :
// mode, quiCommence, lanceLe, ajouts, cases, gestes), et quatre champs de plus :
// - personnages : les personnages des ajouts « pj », au format du créateur
//   (js/personnage/format.js) ; chacun se retrouve par son nom ;
// - journalAttendu : les lignes du journal, dans l'ordre ;
// - etatAttendu : l'état final, un protagoniste par entrée, dans l'ordre
//   d'ajout (la forme est dite devant ecartsDeLEtat) ;
// - arrets, facultatif : des moments où rejouer le combat pour y regarder ce
//   qu'il attend, chacun { nom, jusqua, … } : « jusqua » est celui du lecteur
//   de scénario, le reste est dit devant ecartsDeLArret.
//
// Les comparaisons sont exportées : le contrôle du combat de référence fictif
// (tests/combat_reference.test.js) emploie les mêmes, et les voit dire un
// écart puis se taire. Ce que le banc compare sur le vrai classeur est ainsi
// tenu par node --test. Les valeurs de départ qu'il écrit (ecrireDepart) le
// sont de même, sur les protagonistes de la démonstration.

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { importerFichier } from "../js/banque/importation.js";
import { TAILLE_MAX_COMBAT, chiffrerCombat } from "../js/combat/enregistrement.js";
import { validerContenu, validerEvenement, validerPhoto } from "../js/combat/forme.js";
import { evaluerEssai } from "../js/combat/jet.js";
import { ligneEnCours } from "../js/combat/journal.js";
import { appliquer, ouvrirCombat, rejouer } from "../js/combat/moteur.js";
import { accepte, boutons, candidats, faconsDe, offre } from "../js/combat/offre.js";
import { photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide } from "../js/combat/preparation.js";
import { BORNES_PHOTO, EVENEMENTS_MAX, LONGUEUR_RAISON, PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES, PLAFOND_PJ, REGLES, ROLES_SANS_BOUTON } from "../js/combat/regles.js";
import { ecrireAbsents, tableDesRoles } from "../js/combat/roles.js";
import { blessuresDe, campDe, courantDe, gesteEnCours, photoDe } from "../js/combat/valeurs.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter } from "../js/personnage/format.js";
import { nouveauSecret } from "../js/securite/chiffrement.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les comparaisons ───────────────────────────────────────────────────────

const codeDe = (signe) => `U+${signe.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

// Où deux lignes se séparent : le rang du premier signe qui diffère, compté
// de 1, et les deux signes avec leur code. Deux signes qui se ressemblent (un
// trait d'union et un signe moins, une espace et une espace insécable) ne se
// distinguent à l'œil que par là.
function premierEcart(obtenu, attendu) {
  const a = [...obtenu];
  const b = [...attendu];
  let rang = 0;
  while (rang < a.length && rang < b.length && a[rang] === b[rang]) rang += 1;
  const dire = (signes) => (rang < signes.length ? `« ${signes[rang]} », ${codeDe(signes[rang])}` : "la fin de la ligne");
  return `au signe ${rang + 1} (obtenu ${dire(a)} ; attendu ${dire(b)})`;
}

/**
 * Les écarts entre le journal d'un combat et celui qu'on attend, ligne à
 * ligne et mot pour mot. lignes, attendues : des listes de textes. Rend une
 * liste de phrases, vide quand les deux journaux sont les mêmes ; chacune
 * cite sa ligne, comptée de 1, puis ce qui a été obtenu et ce qui était
 * attendu.
 */
export function ecartsDuJournal(lignes, attendues) {
  const ecarts = [];
  for (let rang = 0; rang < Math.max(lignes.length, attendues.length); rang += 1) {
    const obtenu = lignes[rang];
    const attendu = attendues[rang];
    if (obtenu === attendu) continue;
    if (obtenu === undefined) ecarts.push(`ligne ${rang + 1}, absente du journal :\n    attendu : ${attendu}`);
    else if (attendu === undefined) ecarts.push(`ligne ${rang + 1}, en trop dans le journal :\n    obtenu  : ${obtenu}`);
    else ecarts.push(`ligne ${rang + 1}, ${premierEcart(obtenu, attendu)} :\n    obtenu  : ${obtenu}\n    attendu : ${attendu}`);
  }
  return ecarts;
}

// Les nombres d'un protagoniste que l'état attendu peut dire, et comment les
// nommer dans un écart.
const NOMBRES_COMPARES = [
  ["case", "case"],
  ["actions", "actions"],
  ["actionsMax", "actions au plus"],
  ["souffle", "souffle"],
  ["souffleMax", "souffle au plus"],
  ["corps", "corps"],
  ["corpsMax", "corps au plus"],
  ["attaque", "attaque"],
  ["defense", "défense"],
];

const dit = (valeur) => valeur !== null && valeur !== undefined;

/**
 * Les écarts entre l'état d'un combat et l'état attendu. Rend une liste de
 * phrases, vide quand l'état est celui qu'on attend ; chacune nomme le
 * protagoniste, puis ce qui diffère.
 *
 * attendus : un protagoniste par entrée, dans l'ordre d'ajout :
 *   { protagoniste, case, actions, actionsMax, souffle, souffleMax, corps,
 *     corpsMax, attaque, defense, liens, mort, blessures, zones }
 * - protagoniste : son nom court, celui du journal ;
 * - un nombre nul ou absent n'est pas dit, et ne se compare pas (les actions
 *   d'un mort, les blessures d'un adversaire) ;
 * - liens : [{ nom, points, max }], dans l'ordre des jauges ; nul : non dit ;
 * - mort : null pour un vivant, { tour } pour un mort (un tour nul : non dit) ;
 *   absent : non dit ;
 * - blessures : le nombre de zones dont la résistance est à 0 ;
 * - zones : [{ code, armure, armureMax, resistance, resistanceMax }], chacune
 *   retrouvée par son code (ou par « nom », pour une zone que la banque ne
 *   reconnaît pas). Toute zone qui n'y figure pas doit être intacte : armure
 *   et résistance à leur maximum.
 */
export function ecartsDeLEtat(etat, attendus) {
  const ecarts = [];
  if (etat.ordre.length !== attendus.length) ecarts.push(`Le combat compte ${etat.ordre.length} protagoniste(s), l'état attendu ${attendus.length}.`);

  attendus.forEach((attendu, rang) => {
    const qui = attendu.protagoniste;
    const id = etat.ordre.find((un) => etat.noms[un].court === qui);
    if (id === undefined) {
      ecarts.push(`${qui} : absent du combat (noms courts : ${etat.ordre.map((un) => etat.noms[un].court).join(", ")}).`);
      return;
    }
    const courant = etat.protagonistes[id];
    const photo = etat.photos[id];
    const comparer = (quoi, obtenu, voulu) => {
      if (obtenu !== voulu) ecarts.push(`${qui} : ${quoi} ${obtenu}, attendu ${voulu}.`);
    };

    if (etat.ordre[rang] !== id) ecarts.push(`${qui} : au rang ${etat.ordre.indexOf(id) + 1} de l'ordre d'ajout, attendu au rang ${rang + 1}.`);
    for (const [champ, nom] of NOMBRES_COMPARES) {
      if (dit(attendu[champ])) comparer(nom, courant[champ], attendu[champ]);
    }

    if (attendu.mort !== undefined) {
      const sort = (mort) => (mort === null ? "vivant" : `mort${dit(mort.tour) ? ` au tour ${mort.tour}` : ""}`);
      const memeSort = (courant.mort === null) === (attendu.mort === null) && (attendu.mort === null || !dit(attendu.mort.tour) || attendu.mort.tour === courant.mort.tour);
      if (!memeSort) ecarts.push(`${qui} : ${sort(courant.mort)}, attendu ${sort(attendu.mort)}.`);
    }

    if (dit(attendu.blessures)) comparer("blessures", blessuresDe(etat, id), attendu.blessures);

    if (dit(attendu.liens)) {
      comparer("jauges de lien", courant.liens.length, attendu.liens.length);
      attendu.liens.forEach((jauge, indice) => {
        const nom = photo.liens[indice]?.nom;
        if (nom !== jauge.nom) {
          ecarts.push(`${qui} : jauge de lien n° ${indice + 1} « ${nom ?? "aucune"} », attendu « ${jauge.nom} ».`);
          return;
        }
        const { points, max } = courant.liens[indice];
        if (points !== jauge.points || max !== jauge.max) ecarts.push(`${qui} : lien ${jauge.nom} ${points}/${max}, attendu ${jauge.points}/${jauge.max}.`);
      });
    }

    const dites = attendu.zones ?? [];
    const retrouvees = new Set();
    photo.zones.forEach((zone, indice) => {
      const { armure, armureMax, resistance, resistanceMax } = courant.zones[indice];
      const dite = dites.find((une) => (dit(une.code) ? une.code === zone.code : une.nom === zone.nom));
      const ou = `${qui}, ${zone.nom.toLowerCase()}`;
      if (dite === undefined) {
        if (armure !== armureMax || resistance !== resistanceMax) {
          ecarts.push(`${ou} : armure ${armure}/${armureMax}, résistance ${resistance}/${resistanceMax}, attendue intacte.`);
        }
        return;
      }
      retrouvees.add(dite);
      if (armure !== dite.armure || armureMax !== dite.armureMax) ecarts.push(`${ou} : armure ${armure}/${armureMax}, attendu ${dite.armure}/${dite.armureMax}.`);
      if (resistance !== dite.resistance || resistanceMax !== dite.resistanceMax) {
        ecarts.push(`${ou} : résistance ${resistance}/${resistanceMax}, attendu ${dite.resistance}/${dite.resistanceMax}.`);
      }
    });
    for (const dite of dites) {
      if (!retrouvees.has(dite)) ecarts.push(`${qui} : aucune zone « ${dite.code ?? dite.nom} » dans sa grille (${photo.zones.map((zone) => zone.code ?? zone.nom).join(", ")}).`);
    }
  });
  return ecarts;
}

const ecrireUnDe = (de) => (de === null ? "aucun" : `d${de.faces}${de.combien > 1 ? `, ${de.combien} valeurs` : ""}, ${de.motif}, place ${de.place}`);
const ecrireUneChaine = (des) => des.map(({ somme, reussi }) => `${somme} ${reussi ? "✓" : "✗"}`).join(", ") || "aucun dé";

/**
 * Les écarts d'un combat arrêté en cours de route avec ce qu'on attend de ce
 * moment. Rend une liste de phrases, vide quand tout y est.
 *
 * arret : ce qu'on attend, chaque champ facultatif :
 * - lignes : le nombre de lignes déjà écrites ; elles sont les premières de
 *   journalAttendu, mot pour mot ;
 * - cible : le nom court de la cible du geste en cours (null : aucune) ;
 * - chaine : les dés déjà lancés du jet en cours, un par place, tels qu'ils
 *   comptent : [{ somme, reussi }], modificateurs compris ;
 * - de : le dé que le combat attend, { faces, combien, motif, place }, ou
 *   null s'il n'en attend pas ;
 * - etatAttendu : l'état de ce moment, comme pour ecartsDeLEtat.
 */
export function ecartsDeLArret(etat, arret, journalAttendu) {
  const ecarts = [];
  const geste = gesteEnCours(etat);
  if (dit(arret.lignes)) {
    ecarts.push(
      ...ecartsDuJournal(
        etat.journal.map((ligne) => ligne.texte),
        journalAttendu.slice(0, arret.lignes),
      ),
    );
  }
  if (arret.cible !== undefined) {
    const cible = dit(geste?.cible) ? etat.noms[geste.cible].court : null;
    if (cible !== arret.cible) ecarts.push(`La cible du geste en cours : ${cible ?? "aucune"}, attendu ${arret.cible ?? "aucune"}.`);
  }
  if (arret.chaine !== undefined) {
    const lances = (geste?.jet?.places ?? []).map((place) => evaluerEssai(geste.jet, place.essais.at(-1)));
    if (ecrireUneChaine(lances) !== ecrireUneChaine(arret.chaine)) ecarts.push(`Les dés du jet en cours : ${ecrireUneChaine(lances)}, attendu ${ecrireUneChaine(arret.chaine)}.`);
  }
  if (arret.de !== undefined) {
    const aLancer = offre(etat).de;
    if (ecrireUnDe(aLancer) !== ecrireUnDe(arret.de)) ecarts.push(`Le dé à lancer : ${ecrireUnDe(aLancer)}, attendu ${ecrireUnDe(arret.de)}.`);
  }
  if (dit(arret.etatAttendu)) ecarts.push(...ecartsDeLEtat(etat, arret.etatAttendu));
  return ecarts;
}

// ─── Le journal en segments et la ligne en cours (groupe 2) ─────────────────

const texteDes = (segments) => segments.map((segment) => segment.texte).join("");
const SUITE = String.fromCodePoint(0x2026);

/**
 * Les lignes d'un journal qui ne sont pas la concaténation de leurs segments
 * (la règle d'or du contrat du groupe 2, § 3.1), ou dont un segment est vide.
 * Rend une liste de phrases, vide quand toutes le sont.
 */
export function ecartsDesSegments(journal) {
  const ecarts = [];
  journal.forEach((ligne, rang) => {
    const segments = Array.isArray(ligne.segments) ? ligne.segments : [];
    if (texteDes(segments) !== ligne.texte) ecarts.push(`ligne ${rang + 1}, ses segments ne redonnent pas son texte :\n    texte    : ${ligne.texte}\n    segments : ${texteDes(segments)}`);
    else if (segments.some((segment) => segment.texte === "")) ecarts.push(`ligne ${rang + 1} : un segment vide.`);
  });
  return ecarts;
}

// Les gestes finis, chacun à l'événement qui l'a fini : un maillon neuf sur la
// pile d'annulation, comparée par identité de ses maillons.
function finsDeGeste(etats) {
  const fins = [];
  for (let n = 1; n < etats.length; n += 1) {
    const maillon = etats[n].annulation?.pile ?? null;
    if (maillon !== null && maillon !== (etats[n - 1].annulation?.pile ?? null)) fins.push({ n, maillon });
  }
  return fins;
}

/**
 * Pour une suite d'états tenus un événement à la fois (etats[n], l'état après
 * n événements), les moments où la ligne en cours n'est pas le début exact de
 * la ligne que le geste écrira, suivi de « … » (contrat du groupe 2, § 3.4).
 * Rend { ecarts, enCours } : les phrases, et le nombre d'états qui ont une
 * ligne en cours. « lire » est la fonction qui la donne (celle du journal,
 * par défaut).
 */
export function ecartsDeLaLigneEnCours(etats, { lire = ligneEnCours } = {}) {
  const fins = finsDeGeste(etats);
  const ecarts = [];
  let enCours = 0;
  etats.forEach((etat, n) => {
    const ligne = lire(etat);
    if (ligne === null) return;
    enCours += 1;
    const fin = fins.find((une) => une.n > n);
    const finale = fin === undefined ? null : etats[fin.n].journal[fin.maillon.plage[0]];
    const debut = ligne.texte.endsWith(SUITE) ? ligne.texte.slice(0, -SUITE.length) : null;
    const derniere = ligne.segments?.at(-1);
    if (finale === null) ecarts.push(`après ${n} événement(s) : une ligne en cours, et aucun geste ne finit ensuite.`);
    else if (debut === null || derniere?.type !== "suite" || derniere.texte !== SUITE || derniere.phrase !== null) ecarts.push(`après ${n} événement(s) : la ligne en cours ne finit pas par « ${SUITE} », hors phrase :\n    ${ligne.texte}`);
    else if (!finale.texte.startsWith(debut) || texteDes(ligne.segments) !== ligne.texte) ecarts.push(`après ${n} événement(s) : la ligne en cours ne débute pas la ligne du geste :\n    en cours : ${ligne.texte}\n    finale   : ${finale.texte}`);
  });
  return { ecarts, enCours };
}

// ─── L'offre allégée, contre le jugement du groupe 1 (groupe 2) ─────────────
//
// Le jugement du groupe 1, recopié de tests/combat_offre_allegee.test.js (qui
// le recopie de js/combat/offre.js au commit a61a7e7, la fin du groupe 1),
// sans rien y changer que les noms : il ne sert qu'à juger le jugement neuf.
// Un fichier de contrôles ne s'importe pas d'ici : ses contrôles se
// lanceraient avec le banc.

const OUI = { ok: true };
const refusDuGroupe1 = (code, message) => ({ ok: false, code, message });

function faconDOfficeDuGroupe1(capacite, jugees) {
  const jouables = jugees.filter(({ facon }) => !capacite.facons[facon].passif);
  const puissance = ({ facon }) => capacite.facons[facon].puissance;
  const payables = jouables.filter(({ actif }) => actif);
  if (payables.length > 0) return payables.reduce((haute, jugee) => (puissance(jugee) > puissance(haute) ? jugee : haute));
  return jouables.reduce((basse, jugee) => (puissance(jugee) < puissance(basse) ? jugee : basse));
}

function boutonsDuGroupe1(etat, id) {
  const photo = photoDe(etat, id);
  if (photo === null) return [];
  const parFacon = campDe(etat, id) !== "pj";
  const liste = [];
  photo.capacites.forEach((capacite, indice) => {
    if (ROLES_SANS_BOUTON.includes(capacite.role)) return;
    if (capacite.facons.length === 0) {
      liste.push({ capacite: indice, facon: null, actif: false, raison: capacite.inactive ?? "absente de la banque" });
      return;
    }
    if (capacite.facons.every((facon) => facon.passif)) return;
    const jugees = faconsDe(etat, id, indice);
    for (const { facon, actif, raison } of parFacon ? jugees : [faconDOfficeDuGroupe1(capacite, jugees)]) {
      liste.push({ capacite: indice, facon, actif, raison });
    }
  });
  return liste;
}

function jugementDuGroupe1(etat, { qui, capacite, facon }) {
  if (courantDe(etat, qui) === null) return refusDuGroupe1("hors_bornes", "Ce protagoniste n'est pas dans le combat.");
  if (!candidats(etat).includes(qui)) return refusDuGroupe1("interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
  const bouton = boutonsDuGroupe1(etat, qui).find((un) => un.capacite === capacite);
  if (!bouton) return refusDuGroupe1("hors_bornes", "Cette capacité ne se joue pas.");
  if (bouton.facon === null) return refusDuGroupe1("interdit", bouton.raison);
  const jugee = faconsDe(etat, qui, capacite)[facon];
  if (!jugee) return refusDuGroupe1("hors_bornes", "Cette capacité ne se joue pas de cette façon.");
  return jugee.actif ? OUI : refusDuGroupe1("interdit", jugee.raison);
}

// La porte d'avant les juges, qui n'a pas changé : la forme, puis la colonne.
function avantLesJuges(etat, evenement) {
  if (validerEvenement(evenement).erreur) return "forme";
  const geste = gesteEnCours(etat);
  return etat.phase === "combat" && (geste === null || geste.moment === "preparation") ? null : "hors_moment";
}

/**
 * Compare, sur un état, le jugement de l'événement « capacite » (« juger »,
 * celui de l'offre par défaut) à celui du groupe 1 : pour chaque
 * protagoniste (et un inconnu), chaque capacité et chaque façon de −1 à la
 * longueur de leur liste. Rend { ecarts, verdicts } : les phrases, et le
 * nombre de verdicts comparés.
 */
export function ecartsDeLOffreAllegee(etat, { juger = accepte, quoi = "cet état" } = {}) {
  const ecarts = [];
  let verdicts = 0;
  for (const qui of [...etat.ordre, "pj99"]) {
    const capacites = photoDe(etat, qui)?.capacites ?? [];
    for (let capacite = -1; capacite <= capacites.length; capacite += 1) {
      const facons = capacites[capacite]?.facons.length ?? 1;
      for (let facon = -1; facon <= facons; facon += 1) {
        const evenement = { type: "capacite", qui, capacite, facon };
        const neuf = juger(etat, evenement);
        const porte = avantLesJuges(etat, evenement);
        const ancien = porte === null ? jugementDuGroupe1(etat, validerEvenement(evenement).evenement) : { ok: false, code: porte };
        verdicts += 1;
        const memes = porte === null ? isDeepStrictEqual(neuf, ancien) : neuf.ok === false && neuf.code === porte;
        if (!memes) ecarts.push(`${quoi}, ${JSON.stringify(evenement)} : ${JSON.stringify(neuf)}, au groupe 1 ${JSON.stringify(ancien)}.`);
      }
    }
  }
  return { ecarts, verdicts };
}

// ─── Les puissances et les bornes des façons (groupe 2) ─────────────────────

/**
 * Les écarts entre la résolution d'un adversaire à son rang (resoudre) et ses
 * capacités à chaque puissance (capacitesA) : au rang, la même capacité ;
 * une capacité absente de la banque, ou au-delà de son rang, n'en a aucune.
 * resolution : ce que rend indexerAdversaires() ; ligne : celle de
 * l'adversaire ; nom : celui que disent les écarts. Rend { ecarts, comparees }.
 */
export function ecartsDeCapacitesA(resolution, ligne, nom = ligne?.nom ?? "?") {
  const resolu = resolution.resoudre(ligne);
  const ecarts = [];
  let comparees = 0;
  const parPuissance = new Map();
  const aPuissance = (puissance) => {
    if (!parPuissance.has(puissance)) parPuissance.set(puissance, resolution.capacitesA(ligne, puissance));
    return parPuissance.get(puissance);
  };
  resolu.capacites.forEach((capacite, k) => {
    const dit = `${nom}, ${capacite.nom}`;
    if (aPuissance(1).length !== resolu.capacites.length) return;
    if (capacite.absente) {
      if (aPuissance(1)[k] !== null) ecarts.push(`${dit} : absente de la banque, et résolue à la puissance 1.`);
      return;
    }
    comparees += 1;
    if (capacite.rang >= 1 && !isDeepStrictEqual(aPuissance(capacite.rang)[k], capacite)) ecarts.push(`${dit} : à son rang (${capacite.rang}), capacitesA ne rend pas la capacité de resoudre.`);
    if (aPuissance(capacite.rang + 1)[k] !== null) ecarts.push(`${dit} : résolue au-delà de son rang (${capacite.rang}).`);
  });
  if (aPuissance(1).length !== resolu.capacites.length) ecarts.push(`${nom} : capacitesA rend ${aPuissance(1).length} entrée(s), resoudre ${resolu.capacites.length}.`);
  return { ecarts, comparees };
}

/**
 * Ce qu'une photographie compte de façons, face aux bornes (BORNES_PHOTO) :
 * { parCapacite, capacite, enTout, deplacements }, « capacite » étant le nom
 * de celle qui en compte le plus.
 */
export function bornesDesFacons(photo) {
  const capacites = photo.valeurs.capacites;
  const plus = capacites.reduce((haute, capacite) => (haute === null || capacite.facons.length > haute.facons.length ? capacite : haute), null);
  return {
    parCapacite: plus?.facons.length ?? 0,
    capacite: plus?.nom ?? null,
    enTout: capacites.reduce((total, capacite) => total + capacite.facons.length, 0),
    deplacements: capacites.reduce((total, capacite) => total + (capacite.role === "deplacement" ? capacite.facons.length : 0), 0),
  };
}

// ─── L'affichage ────────────────────────────────────────────────────────────

const dire = (...lignes) => console.log(lignes.join("\n"));
const titre = (texte) => dire("", texte);
const milliers = (nombre) => String(nombre).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const accorder = (nombre, un, plusieurs) => `${nombre} ${nombre > 1 ? plusieurs : un}`;

function tableau(lignes) {
  const largeurs = lignes[0].map((_, colonne) => Math.max(...lignes.map((ligne) => String(ligne[colonne]).length)));
  for (const ligne of lignes) dire(`  ${ligne.map((cellule, colonne) => String(cellule).padEnd(largeurs[colonne])).join("   ").trimEnd()}`);
}

// Les faces d'une zone, comme le site les écrit : « 2-11 », « 20 ».
const ecrireFaces = ({ debut, fin }) => (debut === fin ? `${debut}` : `${debut}-${fin}`);

// Les valeurs de départ d'un protagoniste, telles que le classeur les donne
// aujourd'hui : c'est par elles qu'un écart s'explique (une armure, un dé,
// des dégâts ou une grille qui ne sont plus ceux du jour où le scénario a été
// écrit). Chaque zone porte ses faces : sans elles, une localisation du
// journal ne se recalculerait pas d'après cette sortie. Exportée, comme les
// comparaisons : un contrôle la tient sur la démonstration.
export function ecrireDepart({ camp, valeurs, avertissements }) {
  const arme = ({ libelle, poids, faces, degats, portee, locMultiple }) =>
    [libelle, poids, faces === null ? null : `d${faces}`, degats === null ? "sans dégâts lisibles" : degats.join("/"), `portée ${portee}`, locMultiple > 1 ? `${locMultiple} d20` : null].filter(Boolean).join(", ");
  const jet =
    camp === "pj"
      ? `défense d${valeurs.deDefense.faces} (${valeurs.deDefense.type}${valeurs.deDefense.meles ? ", types mêlés" : ""})`
      : `attaque ${valeurs.attaque}, défense ${valeurs.defense}`;
  const cables = valeurs.passifs.map(({ role, niveau }) => `${role} [${niveau}]${niveau === 0 ? " (niveau 0 : sans effet)" : ""}`);
  const roles = valeurs.capacites.filter((capacite) => capacite.role !== null && !valeurs.passifs.some((passif) => valeurs.capacites[passif.capacite] === capacite));
  return [
    `  ${valeurs.nom} — ${accorder(valeurs.actions, "action", "actions")}, souffle ${valeurs.souffleAbsent ? "absent" : valeurs.souffle}, corps ${valeurs.corps} ; ${jet}`,
    `      armes : ${valeurs.armes.map(arme).join(" · ") || "aucune"}`,
    `      zones, dans l'ordre du d20 (faces : armure) : ${valeurs.zones.map((zone) => `${zone.nom.toLowerCase()} ${ecrireFaces(zone)} : ${zone.armure}`).join(", ")} ; face de contre-attaque : ${valeurs.faceContre}`,
    `      passifs câblés : ${cables.join(", ") || "aucun"} ; autres rôles : ${roles.map((capacite) => `${capacite.role} [${capacite.niveau}]`).join(", ") || "aucun"}`,
    ...avertissements.map((avertissement) => `      avertissement : ${avertissement}`),
  ];
}

function ecrireEtat(etat) {
  const lignes = [["protagoniste", "case", "actions", "souffle", "corps", "zones touchées"]];
  for (const id of etat.ordre) {
    const courant = etat.protagonistes[id];
    const touchees = etat.photos[id].zones
      .map((zone, indice) => ({ nom: zone.nom.toLowerCase(), ...courant.zones[indice] }))
      .filter((zone) => zone.armure !== zone.armureMax || zone.resistance !== zone.resistanceMax)
      .map((zone) => `${zone.nom} : armure ${zone.armure}/${zone.armureMax}${zone.resistance !== zone.resistanceMax ? `, résistance ${zone.resistance}/${zone.resistanceMax}` : ""}`);
    lignes.push([
      etat.noms[id].court,
      courant.case,
      courant.mort === null ? `${courant.actions}/${courant.actionsMax}` : `mort (tour ${courant.mort.tour})`,
      `${courant.souffle}/${courant.souffleMax}`,
      courant.corps,
      touchees.join(" ; ") || "—",
    ]);
  }
  tableau(lignes);
}

// ─── Le pire contenu (groupe 2) ─────────────────────────────────────────────
//
// Le texte gardé d'un combat est sa mise en place et ses événements (§ 17.8).
// Le pire : douze personnages (ceux du scénario, recopiés sous d'autres
// identifiants), soixante adversaires (les cinq plus lourds du classeur,
// douze fois chacun), puis le lancement, une capacité ouverte, et jusqu'au
// plafond le plus long des événements que le moteur accepte sans fin : un
// modificateur réglé à la main, sa raison au plus long. Deux raisons : celle
// d'un clavier (des signes de trois octets, tirés au hasard pour que la
// compression ne les réduise guère), et celle d'un contenu forgé (des
// demi-codets isolés, que JSON écrit en six signes chacun).

// Un générateur à graine écrite : la mesure se refait à l'identique.
function hasardDe(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}

const RAISONS = {
  clavier: (hasard) => Array.from({ length: LONGUEUR_RAISON }, () => String.fromCodePoint(0x4e00 + Math.floor(hasard() * 0x5000))).join(""),
  forgee: (hasard) => Array.from({ length: LONGUEUR_RAISON }, () => String.fromCharCode(0xd800 + Math.floor(hasard() * 0x400))).join(""),
};

// La plus grosse mise en place que permettent les plafonds, ou { refus }.
function laPlusGrosseMiseEnPlace(mode, personnages, adversaires) {
  let miseEnPlace = miseEnPlaceVide(mode);
  const poser = (issue) => {
    if (issue.refus) throw new Error(issue.refus);
    miseEnPlace = issue.miseEnPlace;
  };
  try {
    for (let rang = 0; rang < PLAFOND_PJ && personnages.length > 0; rang += 1) {
      const modele = personnages[rang % personnages.length];
      const copie = structuredClone(modele);
      copie.valeurs.identifiant = `${modele.valeurs.identifiant} (banc ${rang + 1})`;
      const lue = validerPhoto(copie, { accepter });
      if (lue.erreur) throw new Error(lue.erreur);
      poser(ajouterPersonnage(miseEnPlace, lue.photo));
    }
    const lourds = [...adversaires].sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length);
    for (const photo of lourds) {
      const places = PLAFOND_ADVERSAIRES - miseEnPlace.protagonistes.filter((protagoniste) => protagoniste.camp === "adv").length;
      if (places === 0) break;
      poser(ajouterAdversaires(miseEnPlace, Array.from({ length: Math.min(PLAFOND_EXEMPLAIRES, places) }, () => photo)));
    }
  } catch (echec) {
    return { refus: echec.message };
  }
  return { miseEnPlace };
}

// Le lancement, puis la première capacité qui offre un modificateur réglé à
// la main : { etat, evenements, champ, reglage }, ou null.
function ouvrirUnReglage(miseEnPlace) {
  const lancer = { type: "lancer", le: "2026-10-25T12:00" };
  const lance = appliquer(ouvrirCombat(miseEnPlace), lancer).etat;
  for (const qui of candidats(lance)) {
    for (const bouton of boutons(lance, qui)) {
      if (!bouton.actif) continue;
      const ouvre = { type: "capacite", qui, capacite: bouton.capacite, facon: bouton.facon };
      const rendu = appliquer(lance, ouvre);
      const reglage = rendu.refus ? null : offre(rendu.etat).reglages?.modificateur;
      if (reglage?.raison) return { etat: rendu.etat, evenements: [lancer, ouvre], champ: "modificateur", reglage };
    }
  }
  return null;
}

const octetsDe = (texte) => new TextEncoder().encode(texte).length;
const enMo = (octets) => `${(octets / (1024 * 1024)).toFixed(2).replace(".", ",")} Mo`;

async function mesurerLePireContenu(mode, photosDuScenario, photosDuClasseur) {
  const lignes = [];
  const ecarts = [];
  const personnages = Object.values(photosDuScenario).filter((photo) => photo.camp === "pj");
  const mise = laPlusGrosseMiseEnPlace(mode, personnages, photosDuClasseur);
  if (mise.refus) {
    lignes.push(`  ÉCART : la plus grosse mise en place ne se fait pas : ${mise.refus}`);
    ecarts.push(mise.refus);
    return { lignes, ecarts };
  }
  const { miseEnPlace } = mise;
  const camps = (camp) => miseEnPlace.protagonistes.filter((protagoniste) => protagoniste.camp === camp).length;
  lignes.push(`  La mise en place : ${accorder(camps("pj"), "personnage", "personnages")}, ${accorder(camps("adv"), "adversaire", "adversaires")} ; ${enMo(octetsDe(JSON.stringify(miseEnPlace)))} en JSON.`);
  const ouvert = ouvrirUnReglage(miseEnPlace);
  if (ouvert === null) {
    lignes.push("  ÉCART : aucune capacité de ce combat n'offre de modificateur réglé à la main.");
    ecarts.push("aucun modificateur");
    return { lignes, ecarts };
  }
  const secret = await nouveauSecret(crypto.randomUUID());
  for (const [genre, raison] of Object.entries(RAISONS)) {
    const hasard = hasardDe(20261025);
    const { min } = ouvert.reglage;
    const evenements = [...ouvert.evenements];
    while (evenements.length < EVENEMENTS_MAX) evenements.push({ type: "regler", champ: ouvert.champ, valeur: evenements.length % 2 === 0 ? min : min + 1, raison: raison(hasard) });
    const dit = genre === "clavier" ? "Raisons d'un clavier" : "Raisons forgées (demi-codets isolés)";
    // Le moteur accepte-t-il cet événement ? Le premier se juge sur l'état ouvert.
    const premier = appliquer(ouvert.etat, evenements[2]);
    if (premier.refus) {
      lignes.push(`  ${dit} : le moteur refuse l'événement (${premier.refus.message}).`);
      continue;
    }
    const texte = JSON.stringify({ regles: REGLES, revision: 1, miseEnPlace, evenements });
    const octets = octetsDe(texte);
    const chiffre = await chiffrerCombat(texte, secret, { mode, revision: 1 });
    const garde = chiffre.erreur ? `ne se garderait pas (${chiffre.erreur})` : `se garde : ${enMo(Math.ceil((chiffre.chiffre.length * 3) / 4))} chiffrés`;
    lignes.push(`  ${dit} : ${milliers(evenements.length)} événements, ${enMo(octets)} de texte (la borne : ${enMo(TAILLE_MAX_COMBAT)}) ; il ${garde}.`);
    if (genre === "clavier") {
      const debut = performance.now();
      const rejoue = rejouer({ regles: REGLES, revision: 1, miseEnPlace, evenements });
      const duree = Math.round(performance.now() - debut);
      if (rejoue.erreur) {
        lignes.push(`  ÉCART : ce contenu ne se rejoue pas, à l'événement n° ${rejoue.erreur.pas} : ${rejoue.erreur.message}`);
        ecarts.push(rejoue.erreur.message);
      } else lignes.push(`  Il se rejoue en entier, en ${milliers(duree)} ms sous Node (une mesure, à titre indicatif).`);
      if (chiffre.erreur) ecarts.push(`le pire contenu d'un clavier ne se garde pas : ${chiffre.erreur}`);
    }
  }
  return { lignes, ecarts };
}

// ─── Le banc ────────────────────────────────────────────────────────────────

function lireScenario(chemin) {
  const scenario = JSON.parse(readFileSync(chemin, "utf8"));
  for (const champ of ["ajouts", "gestes", "journalAttendu", "etatAttendu"]) {
    if (!Array.isArray(scenario[champ])) throw new Error(`le champ « ${champ} » manque, ou n'est pas une liste.`);
  }
  if (scenario.mode !== "reel" && scenario.mode !== "demo") throw new Error("le champ « mode » vaut « reel » ou « demo ».");
  return scenario;
}

// Les photographies des ajouts du scénario, par nom entier. Un personnage
// passe par accepter(), comme tout personnage lu d'un fichier.
function photographierLesAjouts(scenario, monde) {
  const photos = {};
  const refus = [];
  for (const [genre, nom] of scenario.ajouts) {
    let rendu;
    if (genre === "pj") {
      const personnage = (scenario.personnages ?? []).find((un) => un?.identite?.nom === nom);
      if (!personnage) rendu = { refus: "le scénario ne porte pas ce personnage (champ « personnages »)." };
      else {
        try {
          rendu = photographierPersonnage(monde.banque, accepter(structuredClone(personnage)), { index: monde.index, roles: monde.roles });
        } catch (echec) {
          rendu = { refus: `le personnage n'est pas accepté : ${echec.message}` };
        }
      }
    } else {
      rendu = photographierAdversaire(monde.adversaires, nom, { banque: monde.banque, roles: monde.roles });
    }
    if (rendu.refus) refus.push(`  ${nom} : ${rendu.refus}`);
    else photos[nom] = rendu.photo;
  }
  return { photos, refus };
}

// Chaque adversaire complet du classeur se photographie : c'est validerPhoto
// qui juge, la fonction même qui relira un combat gardé. Un adversaire
// incomplet ne s'ajoute pas à un combat : il se compte, sans plus. Pour
// chacun, sa résolution à chaque puissance est comparée à celle du rang, et
// ses façons comptées face aux bornes.
function photographierToutLeClasseur(monde) {
  let complets = 0;
  const incomplets = [];
  const refus = [];
  const photos = [];
  const puissances = { comparees: 0, ecarts: [] };
  for (const [nom, ligne] of monde.adversaires.adversaires) {
    if (!monde.adversaires.resoudre(ligne).complet) {
      incomplets.push(nom);
      continue;
    }
    complets += 1;
    const { ecarts, comparees } = ecartsDeCapacitesA(monde.adversaires, ligne, nom);
    puissances.comparees += comparees;
    puissances.ecarts.push(...ecarts);
    const rendu = photographierAdversaire(monde.adversaires, nom, { banque: monde.banque, roles: monde.roles });
    if (rendu.refus) refus.push(`  ${nom} : ${rendu.refus}`);
    else photos.push(rendu.photo);
  }
  return { complets, incomplets, refus, photos, puissances };
}

// Le plus haut compte de façons parmi des photographies, face à sa borne.
function direLesBornes(photos) {
  const comptes = photos.map((photo) => ({ nom: photo.valeurs.nom, ...bornesDesFacons(photo) }));
  const plusHaut = (champ) => comptes.reduce((haut, compte) => (haut === null || compte[champ] > haut[champ] ? compte : haut), null);
  const lignes = [];
  for (const [champ, borne, dit] of [
    ["parCapacite", BORNES_PHOTO.facons, "façons pour une capacité"],
    ["enTout", BORNES_PHOTO.faconsEnTout, "façons en tout"],
    ["deplacements", BORNES_PHOTO.deplacements, "façons de déplacement"],
  ]) {
    const haut = plusHaut(champ);
    if (haut === null) continue;
    const ou = champ === "parCapacite" ? `${haut.nom}, ${haut.capacite}` : haut.nom;
    lignes.push(`  Au plus ${haut[champ]} ${dit} (${ou}) ; la borne : ${borne}.`);
  }
  return lignes;
}

// Joue le scénario. S'il ne se joue pas jusqu'au bout, rend aussi le combat
// arrêté avant le geste qui échoue : son journal dit jusqu'où tout allait.
function jouer(scenario, photos) {
  try {
    return versContenu(scenario, photos);
  } catch (echec) {
    for (let gestes = scenario.gestes.length - 1; gestes >= 0; gestes -= 1) {
      try {
        return { ...versContenu(scenario, photos, { jusqua: gestes }), echec: echec.message, gestes };
      } catch {
        // Ce geste-là ne se joue pas non plus : on recule encore.
      }
    }
    return { echec: echec.message, gestes: 0, etat: null, contenu: null };
  }
}

// Le combat tel qu'il serait gardé : passé par JSON, jugé par validerContenu,
// puis rejoué. Rend une phrase.
function relire(contenu, etat, mode) {
  const texte = JSON.stringify(contenu);
  const taille = `${milliers(Math.ceil(new TextEncoder().encode(texte).length / 1024))} Ko`;
  const lu = validerContenu(JSON.parse(texte), { mode, revision: contenu.revision, accepter });
  if (lu.erreur) return `ÉCART : le combat gardé (${taille}) serait refusé à la relecture : ${lu.erreur}`;
  if (lu.autreVersion) return `ÉCART : le combat gardé (${taille}) se dirait d'une autre version des règles.`;
  const rejoue = rejouer(lu.contenu);
  if (rejoue.erreur) return `ÉCART : le combat gardé (${taille}) ne se rejoue pas, à l'événement n° ${rejoue.erreur.pas} : ${rejoue.erreur.message}`;
  // La pile d'annulation ne passe jamais par JSON : l'état se compare sans
  // elle, et la pile par le nombre de ses maillons (contrat du groupe 2, § 0.2).
  const sansAnnulation = ({ annulation, ...reste }) => reste;
  const maillons = (un) => {
    let nombre = 0;
    for (let maillon = un.annulation?.pile ?? null; maillon !== null; maillon = maillon.precedent) nombre += 1;
    return nombre;
  };
  if (JSON.stringify(sansAnnulation(rejoue.etat)) !== JSON.stringify(sansAnnulation(etat)) || maillons(rejoue.etat) !== maillons(etat)) {
    return `ÉCART : le combat gardé (${taille}) se rejoue, mais ne retrouve pas l'état du combat joué.`;
  }
  return `Le combat gardé (${accorder(contenu.evenements.length, "événement", "événements")}, ${taille}) se relit et se rejoue à l'identique.`;
}

async function banc([cheminClasseur, cheminScenario]) {
  if (!cheminClasseur || !cheminScenario) {
    console.error("Usage : node tests/banc_combat_reel.js chemin/vers/regles_jdr.xlsx chemin/vers/scenario.json");
    return 2;
  }
  let octets;
  let scenario;
  try {
    octets = readFileSync(cheminClasseur);
    scenario = lireScenario(cheminScenario);
  } catch (echec) {
    dire(`Lecture impossible : ${echec.message}`);
    return 1;
  }
  dire(`Banc du combat — ${basename(cheminClasseur)}, ${milliers(octets.length)} octets ; scénario ${basename(cheminScenario)}, mode « ${scenario.mode} »`);

  const { banque, anomalies, erreur } = await importerFichier(octets, basename(cheminClasseur));
  if (erreur || !banque) {
    dire(`Import impossible : ${erreur ?? (anomalies ?? []).map((anomalie) => anomalie.message).join(" ")}`);
    return 1;
  }
  const index = indexerCreation(banque);
  const monde = { banque, index, roles: await tableDesRoles(banque, scenario.mode), adversaires: indexerAdversaires(banque, index) };
  const ecarts = [];

  titre("1. Les rôles câblés");
  const absents = ecrireAbsents(monde.roles.absents);
  dire(`  ${accorder(monde.roles.parCle.size, "nom de la banque porte un rôle câblé", "noms de la banque portent un rôle câblé")}.`);
  if (absents === null) dire("  Câblés absents de la banque : aucun. La ligne est vide.");
  else {
    dire(`  ${absents}`, "  ÉCART : cette ligne doit être vide. Un nom a changé dans le classeur, ou l'empreinte d'un rôle n'est plus la sienne.");
    ecarts.push(absents);
  }

  titre("2. Les protagonistes du scénario, tels que le classeur les donne");
  const { photos, refus } = photographierLesAjouts(scenario, monde);
  for (const photo of Object.values(photos)) dire(...ecrireDepart(photo));
  if (refus.length) dire("  Ne se photographient pas :", ...refus);

  titre("3. Tous les adversaires complets du classeur");
  const tous = photographierToutLeClasseur(monde);
  dire(
    `  ${accorder(tous.complets, "adversaire complet", "adversaires complets")}, ${tous.complets - tous.refus.length} photographié(s) ; ` +
      `${accorder(tous.incomplets.length, "incomplet, qui ne s'ajoute pas à un combat", "incomplets, qui ne s'ajoutent pas à un combat")}${tous.incomplets.length ? ` (${tous.incomplets.join(", ")})` : ""}.`,
  );
  if (tous.refus.length) {
    dire("  ÉCART : des adversaires complets ne se photographient pas :", ...tous.refus);
    ecarts.push(...tous.refus);
  }
  // Les puissances (groupe 2) : chaque capacité résolue à son rang par capacitesA comme par resoudre.
  dire(`  Les puissances : ${accorder(tous.puissances.comparees, "capacité comparée", "capacités comparées")}, à leur rang et au-delà : ${tous.puissances.ecarts.length ? accorder(tous.puissances.ecarts.length, "écart", "écarts") : "aucun écart"}.`);
  if (tous.puissances.ecarts.length) {
    dire(...tous.puissances.ecarts.map((ecart) => `  ÉCART : ${ecart}`));
    ecarts.push(...tous.puissances.ecarts);
  }
  // Les bornes des façons : une capacité de plus de vingt façons ne s'ajouterait plus (elle serait dans les refus).
  dire(...direLesBornes(tous.photos));
  const parLesBornes = tous.refus.filter((un) => un.includes("façons"));
  if (parLesBornes.length) dire(`  Dont ${accorder(parLesBornes.length, "refusé", "refusés")} pour une borne des façons.`);

  titre("4. Le combat");
  if (refus.length) {
    dire("  Le combat ne se joue pas : il lui manque une photographie.");
    return 1;
  }
  const joue = jouer(scenario, photos);
  const lignes = joue.etat ? joue.etat.journal.map((ligne) => ligne.texte) : [];
  const attendues = joue.echec === undefined ? scenario.journalAttendu : scenario.journalAttendu.slice(0, lignes.length);
  lignes.forEach((ligne, rang) => dire(`  ${String(rang + 1).padStart(3)} ${ligne === scenario.journalAttendu[rang] ? "=" : "≠"} ${ligne}`));
  const duJournal = ecartsDuJournal(lignes, attendues);
  if (joue.echec !== undefined) {
    dire("", `  Le combat ne se joue pas jusqu'au bout : ${accorder(joue.gestes, "geste joué", "gestes joués")} sur ${scenario.gestes.length}.`, `  ${joue.echec}`);
    if (duJournal.length) dire("", `  Jusque-là, ${accorder(duJournal.length, "ligne s'écarte", "lignes s'écartent")} du journal attendu :`, ...duJournal.map((ecart) => `  ${ecart}`));
    return 1;
  }

  titre("5. Le journal, comparé à celui du scénario");
  dire(`  ${accorder(lignes.length, "ligne", "lignes")}, ${scenario.journalAttendu.length} attendue(s) : ${duJournal.length ? accorder(duJournal.length, "écart", "écarts") : "aucun écart, mot pour mot"}.`);
  if (duJournal.length) dire(...duJournal.map((ecart) => `  ${ecart}`));
  ecarts.push(...duJournal);
  // Les segments et la ligne en cours (groupe 2), sur le combat tenu un événement à la fois.
  const etats = [ouvrirCombat(joue.contenu.miseEnPlace)];
  for (const evenement of joue.contenu.evenements) etats.push(appliquer(etats.at(-1), evenement).etat);
  const desSegments = ecartsDesSegments(joue.etat.journal);
  dire(`  Les segments : ${desSegments.length ? accorder(desSegments.length, "ligne s'écarte", "lignes s'écartent") : "chaque ligne est la concaténation des siens"}.`);
  if (desSegments.length) dire(...desSegments.map((ecart) => `  ÉCART : ${ecart}`));
  ecarts.push(...desSegments);
  const enCours = ecartsDeLaLigneEnCours(etats);
  dire(`  La ligne en cours, à chaque événement : ${accorder(enCours.enCours, "état", "états")} en ont une ; ${enCours.ecarts.length ? accorder(enCours.ecarts.length, "écart", "écarts") : "chacune débute la ligne de son geste"}.`);
  if (enCours.ecarts.length) dire(...enCours.ecarts.map((ecart) => `  ÉCART : ${ecart}`));
  ecarts.push(...enCours.ecarts);

  titre("6. L'état final, comparé à celui du scénario");
  ecrireEtat(joue.etat);
  const deLEtat = ecartsDeLEtat(joue.etat, scenario.etatAttendu);
  dire(`  ${deLEtat.length ? accorder(deLEtat.length, "écart", "écarts") : "Aucun écart"}${deLEtat.length ? " :" : "."}`);
  if (deLEtat.length) dire(...deLEtat.map((ecart) => `    ${ecart}`));
  ecarts.push(...deLEtat);

  titre("7. Le combat gardé");
  const relu = relire(joue.contenu, joue.etat, scenario.mode);
  dire(`  ${relu}`);
  if (relu.startsWith("ÉCART")) ecarts.push(relu);

  const arrets = Array.isArray(scenario.arrets) ? scenario.arrets : [];
  if (arrets.length) titre("8. Le combat, arrêté aux moments que dit le scénario");
  for (const arret of arrets) {
    let arrete;
    try {
      arrete = versContenu(scenario, photos, { jusqua: arret.jusqua }).etat;
    } catch (echec) {
      dire(`  ${arret.nom} : ÉCART, le combat ne s'y arrête pas. ${echec.message}`);
      ecarts.push(echec.message);
      continue;
    }
    const duMoment = ecartsDeLArret(arrete, arret, scenario.journalAttendu);
    dire(`  ${arret.nom} : ${duMoment.length ? `${accorder(duMoment.length, "écart", "écarts")}.` : "aucun écart."}`);
    dire(`  Dé à lancer : ${ecrireUnDe(offre(arrete).de)} ; ${accorder(arrete.journal.length, "ligne", "lignes")} au journal.`);
    ecrireEtat(arrete);
    if (duMoment.length) dire(...duMoment.map((ecart) => `    ${ecart}`));
    ecarts.push(...duMoment);
  }

  titre("9. L'offre allégée, à chaque état du combat, contre le jugement du groupe 1");
  const deLOffre = { ecarts: [], verdicts: 0 };
  etats.forEach((etat, n) => {
    const { ecarts: ici, verdicts } = ecartsDeLOffreAllegee(etat, { quoi: n === 0 ? "la préparation" : `après ${n} événement(s)` });
    deLOffre.verdicts += verdicts;
    deLOffre.ecarts.push(...ici);
  });
  dire(`  ${milliers(deLOffre.verdicts)} verdicts sur ${accorder(etats.length, "état", "états")} : ${deLOffre.ecarts.length ? accorder(deLOffre.ecarts.length, "écart", "écarts") : "le même verdict, objet pour objet"}.`);
  if (deLOffre.ecarts.length) dire(...deLOffre.ecarts.slice(0, 20).map((ecart) => `  ÉCART : ${ecart}`));
  ecarts.push(...deLOffre.ecarts);

  titre(`10. Le pire contenu : la plus grosse mise en place, et ${milliers(EVENEMENTS_MAX)} événements du plus long`);
  const pire = await mesurerLePireContenu(scenario.mode, photos, tous.photos);
  dire(...pire.lignes);
  ecarts.push(...pire.ecarts);

  titre(
    ecarts.length
      ? `Bilan : ${accorder(ecarts.length, "écart", "écarts")}. Un écart n'est pas un échec : le classeur a pu changer depuis que le scénario a été écrit. Chacun est à expliquer, d'après les valeurs de départ du point 2 ; rien n'est à corriger dans les données.`
      : "Bilan : le banc retrouve le scénario, sans écart.",
  );
  return 0;
}

// Le banc ne se lance que demandé par son nom : importé par un contrôle, ce
// fichier ne donne que ses comparaisons.
function lanceParSonNom() {
  if (!process.argv[1]) return false;
  const ici = fileURLToPath(import.meta.url);
  const lance = resolve(process.argv[1]);
  return process.platform === "win32" ? ici.toLowerCase() === lance.toLowerCase() : ici === lance;
}

if (lanceParSonNom()) process.exitCode = await banc(process.argv.slice(2));
