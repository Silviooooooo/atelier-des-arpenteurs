// Le journal du combat : une ligne par geste fini, au présent, en texte
// simple (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) »).
//
// Ce module écrit tout ce que le simulateur dit d'un combat : les lignes du
// cadre (lancement, tours, fin), la ligne de chaque geste, l'en-tête et le
// texte que l'on copie ou télécharge, et la phrase que la région d'annonce
// donne aux lecteurs d'écran après chaque dé. Il existe pour que ce texte
// n'ait qu'une écriture : le moteur, le rejeu d'un combat gardé, les contrôles
// et le banc le comparent mot pour mot, au signe près.
//
// Ce que cela impose :
// - une ligne est une fonction du geste fini, des noms figés au lancement et
//   des photographies. Elle ne lit aucune valeur courante (souffle, armure,
//   corps) : le geste garde l'avant et l'après de ce qu'il a changé, si bien
//   que la même ligne sort en jeu et au rejeu ;
// - rien ne vient de l'appareil : ni heure, ni langue, ni hasard. L'heure du
//   lancement est une donnée, découpée comme un texte ;
// - les signes (flèche, coche, croix, moins, tiret long, point médian)
//   viennent de SIGNES, par leur code, et toute espace est une espace
//   ordinaire, « n° 1 » et « 23 h 05 » compris ;
// - les noms (protagonistes, capacités, zones, armes, raisons) sont des
//   données hostiles, écrites telles quelles : c'est l'écran qui les désarme,
//   sur le texte entier, au moment de copier ou de télécharger.
//
// Une fonction par gabarit, toutes exportées, pour que chacun ait son
// contrôle. Celles qui écrivent un segment facultatif (les sources, la
// localisation, les dégâts, les blessures, la mort) rendent null quand il n'y
// a rien à écrire.
//
// Quelques textes ne viennent pas de l'auteur, qui n'a donné de gabarit que
// pour les cas courants : la source « types d'armure mêlés », les dégâts
// directs, le coût en lien non payé seul dans sa parenthèse, les phrases
// d'annonce d'un dé qui peut exploser. Ils restent à lui faire confirmer.

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { degatsFixes, imputerEsquive, localiser, nombreDeD20, reussitesDeLAttaque } from "./degats.js";
import { evaluerEssai, jetFini, modificateurDe, netDe, reussites } from "./jet.js";
import { LETTRES, SIGNES } from "./regles.js";
import { campDe, capaciteDe, faconDe, gesteEnCours, photoDe } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);
const dernier = (liste) => liste[liste.length - 1];

// « 1 réussite », « 2 réussites » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « n° 1 » ; « n° 1 et n° 2 » ; « n° 1, n° 2 et n° 3 ».
const enumerer = (mots) => (mots.length < 2 ? mots.join("") : `${mots.slice(0, -1).join(", ")} et ${dernier(mots)}`);

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// La casse du premier signe seul, sans règle propre à une langue : le même
// nom donne la même ligne sur tous les appareils.
function minuscule(texte) {
  const [premier = ""] = texte;
  return premier.toLowerCase() + texte.slice(premier.length);
}

function majuscule(texte) {
  const [premier = ""] = texte;
  return premier.toUpperCase() + texte.slice(premier.length);
}

// Le nom court, figé au lancement (« Aubépine », « Marmiton n° 2 »).
const court = (etat, id) => etat.noms?.[id]?.court ?? photoDe(etat, id)?.nom ?? "";

// Le nom d'une zone de la grille d'un protagoniste, tel que le garde sa
// photographie (celui des personnages quand la zone est reconnue). Une face
// hors de la grille n'a pas de zone : l'offre ne permet pas un tel décalage.
const zoneDe = (etat, id, indice) => photoDe(etat, id)?.zones?.[indice]?.nom ?? "?";

const nomDeCaracteristique = (code) => CARACTERISTIQUES.find((caracteristique) => caracteristique.code === code)?.nom ?? code;

// ─── Le cadre ───────────────────────────────────────────────────────────────

/** « Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent. » */
export function ligneDeLancement(etat) {
  const combien = (camp) => etat.ordre.filter((id) => campDe(etat, id) === camp).length;
  return `Combat lancé : ${compter(combien("pj"), "personnage")} contre ${compter(combien("adv"), "adversaire")}. Les ${CAMPS[etat.quiCommence]} commencent.`;
}

/** « — Tour 1 · camp des PJ — » */
export function ligneDeTour(tour) {
  return `${SIGNES.tiret} Tour ${tour.numero} ${SIGNES.point} camp des ${CAMPS[tour.camp]} ${SIGNES.tiret}`;
}

/** « Fin du tour des adversaires : ils retrouvent leurs actions. » */
export function ligneDeFinDeTour(camp) {
  return `Fin du tour des ${CAMPS[camp]} : ils retrouvent leurs actions.`;
}

/** « Combat terminé : victoire des PJ. » */
export function ligneDeFin(vainqueur) {
  return `Combat terminé : victoire des ${CAMPS[vainqueur]}.`;
}

/** « Marmiton n° 2 passe son tour. » */
export function ligneDePasse(etat, qui) {
  return `${court(etat, qui)} passe son tour.`;
}

// ─── L'ouverture ────────────────────────────────────────────────────────────

// Ce qui suit la capacité, entre parenthèses : l'arme, quand plusieurs armes
// donnent la capacité ou qu'un adversaire à plusieurs armes prête le jet de
// l'une d'elles ; puis le coût payé, s'il n'est pas nul ; puis, après un
// point-virgule, le coût en lien qu'un adversaire ne paie pas.
function parentheseDeLOuverture(etat, geste, capacite, facon) {
  const parties = [];
  const libelle = facon?.libelle ?? null;
  if (libelle !== null && capacite.facons.some((autre) => autre.libelle !== libelle)) parties.push(libelle);
  if (geste.mode === "jet_prete" && campDe(etat, geste.acteur) === "adv") {
    const armes = photoDe(etat, geste.acteur)?.armes ?? [];
    const pretee = armes[geste.armePretee]?.libelle ?? null;
    if (armes.length > 1 && pretee !== null && !parties.includes(pretee)) parties.push(pretee);
  }
  const prix = geste.prix ?? {};
  if (prix.souffle > 0) parties.push(`${prix.souffle} souffle`);
  if (prix.lien > 0) parties.push(`${prix.lien} lien`);

  const suite = prix.lienNonPaye > 0 ? ["coût en lien non payé : un adversaire n'a pas de lien"] : [];
  return [parties.join(", "), ...suite].filter((texte) => texte !== "").join(" ; ");
}

// « Aubépine : Fournaise [1] (1 souffle, 1 lien) », sans ce qui suit.
function debutDuGeste(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  const puissance = capacite?.evolue ? ` [${facon?.puissance ?? 0}]` : "";
  const parenthese = capacite ? parentheseDeLOuverture(etat, geste, capacite, facon) : "";
  return `${court(etat, geste.acteur)} : ${capacite?.nom ?? ""}${puissance}${parenthese === "" ? "" : ` (${parenthese})`}`;
}

// « contre » un protagoniste de l'autre camp, « sur » un allié ou sur soi ;
// rien sans cible.
function cibleDuGeste(etat, geste) {
  if ((geste.cible ?? null) === null) return "";
  const lien = campDe(etat, geste.cible) === campDe(etat, geste.acteur) ? "sur" : "contre";
  return ` ${lien} ${court(etat, geste.cible)}`;
}

/**
 * La première phrase d'un geste : « Aubépine : Émincer (4 souffle) contre
 * Marmiton n° 2. » ; pour un déplacement : « Chef : Pas chassé [2]
 * (1 souffle), F6 → D4. »
 */
export function ecrireOuverture(etat, geste) {
  if (geste.mode === "deplacement") return `${debutDuGeste(etat, geste)}, ${geste.depart} ${SIGNES.fleche} ${geste.arrivee}.`;
  return `${debutDuGeste(etat, geste)}${cibleDuGeste(etat, geste)}.`;
}

// ─── Le jet ─────────────────────────────────────────────────────────────────

/**
 * Une source d'avantage ou de désavantage : le nom du passif ; « Émincer hors
 * maîtrise » ; « types d'armure mêlés » ; « à la main : Minutie » ; suivie de
 * « de Marmiton n° 2 » quand elle vient de l'autre protagoniste.
 */
export function ecrireSource(source) {
  const texte = nommerLaSource(source);
  return (source.de ?? null) === null ? texte : `${texte} de ${source.de}`;
}

function nommerLaSource(source) {
  if (source.genre === "maitrise") return `${source.nom} hors maîtrise`;
  if (source.genre === "armure_melee") return "types d'armure mêlés";
  if (source.genre === "main") return `à la main : ${source.nom}`;
  return `${source.nom}`;
}

const compte = (sources) => somme(sources.map((source) => source.nombre));

/**
 * La phrase qui précède un jet où des avantages et des désavantages se
 * rencontrent : « Son avantage (Solo du chef) et son désavantage (Émincer hors
 * maîtrise) s'annulent. » Une source se cite une fois, quel que soit son
 * nombre. null quand le jet n'a pas les deux.
 */
export function ecrireSources(jet) {
  const avantages = compte(jet.avantages);
  const desavantages = compte(jet.desavantages);
  if (avantages === 0 || desavantages === 0) return null;

  const citer = (sources) => sources.map(ecrireSource).join(", ");
  const net = avantages - desavantages;
  const reste = net === 0 ? "s'annulent" : `laissent ${compter(Math.abs(net), net > 0 ? "avantage" : "désavantage")}`;
  return (
    `${avantages === 1 ? "Son avantage" : `Ses ${avantages} avantages`} (${citer(jet.avantages)}) et ` +
    `${desavantages === 1 ? "son désavantage" : `ses ${desavantages} désavantages`} (${citer(jet.desavantages)}) ${reste}.`
  );
}

/** Le dé et son modificateur net, main comprise : « d10 », « d10+1 », « d8−1 ». */
export function ecrireDe(jet) {
  const modificateur = modificateurDe(jet);
  return `d${jet.faces}${modificateur === 0 ? "" : signer(modificateur)}`;
}

/**
 * Une place de la chaîne (un élément de jet.places), valeurs modificateur
 * compris : « 7 ✓ » ; une relance, « 4 ✗, relancé 7 ✓ » ; un dé à
 * désavantage, ses lancers dans l'ordre où ils tombent puis le pire,
 * « 8/4 → 4 ✗ » ; une explosion, « 7 explose, + 6 explose, + 2 = 15 ✓ », où
 * chaque ajout est brut (le modificateur ne compte qu'une fois).
 */
export function ecrirePlace(jet, place) {
  const modificateur = modificateurDe(jet);
  return place.essais
    .map((essai) => {
      const { premier, somme: total, reussi } = evaluerEssai(jet, essai);
      const lancers = essai.tirages.length > 1 ? `${essai.tirages.map((tirage) => tirage + modificateur).join("/")} ${SIGNES.fleche} ` : "";
      const explosions = essai.explosions.length > 0 ? ` explose, ${essai.explosions.map((ajout) => `+ ${ajout}`).join(" explose, ")} = ${total}` : "";
      return `${lancers}${premier}${explosions} ${reussi ? SIGNES.reussi : SIGNES.echoue}`;
    })
    .join(", relancé ");
}

// Le nombre saisi à la main pour les dégâts, et sa raison ; null sans saisie.
const ajustement = (geste) => (geste.degats?.operations ?? []).findLast((operation) => operation.op === "ajuster") ?? null;

/**
 * Le bilan d'un jet, sans son point : « 2 réussites, B = 8, ajusté à 22
 * (Émincer), +2 contre l'armure (Réduction) » ; « aucune réussite, manqué » ;
 * « 1 réussite, Aubépine reçoit B = 12 » ; « 3 réussites, aucun dégât ».
 *
 * Deux nombres s'y écrivent, qu'il ne faut pas confondre : après une lettre,
 * les dégâts de cette lettre, avant toute opération ; après « ajusté à »,
 * « reçoit … (à la main » et « dégâts directs », le nombre saisi.
 */
export function ecrireBilan(etat, geste) {
  const { jet } = geste;
  const nombre = reussites(jet);
  const tete = nombre === 0 ? "aucune réussite" : compter(nombre, "réussite");
  if (jet.genre === "caracteristique") return tete;

  const enDefense = jet.genre === "defense";
  if (reussitesDeLAttaque(jet.genre, nombre) === 0) return `${tete}, ${enDefense ? "aucun dégât" : "manqué"}`;

  const fixes = degatsFixes(etat, geste);
  const saisie = ajustement(geste);
  const directs = fixes.nature !== "normaux";
  const lettre = fixes.lettre === null ? "" : `${LETTRES[fixes.lettre]} = ${fixes.deBase}`;
  const recoit = enDefense ? `${court(etat, jet.lanceur)} reçoit ` : "";

  // Une défense contre une attaque sans dégâts propres, aux dégâts saisis :
  // ce que reçoit le PJ est le nombre saisi, et la phrase le dit d'un trait,
  // sans « ajusté à ».
  if (fixes.base === "aucun" && enDefense && saisie !== null && !directs) return `${tete}, ${recoit}${saisie.valeur} (à la main : ${saisie.raison})`;

  let suite = "touché";
  if (fixes.base === "lettre") suite = `${recoit}${lettre}`;
  if (fixes.base === "arme") suite = `touché, dégâts de l'arme : ${lettre}`;
  if (saisie !== null && directs) suite += `, dégâts directs ${fixes.nature === "corps" ? "au corps" : "à la résistance"} : ${saisie.valeur} (${saisie.raison})`;
  else if (saisie !== null) suite += `, ajusté à ${saisie.valeur} (${saisie.raison})`;
  if (fixes.surplus !== 0) suite += `, +${fixes.surplus} contre l'armure (${fixes.sourceDuSurplus})`;
  return `${tete}, ${suite}`;
}

// Ce qui suit la difficulté, entre parenthèses : son libellé (jet de
// caractéristique), puis le modificateur réglé à la main.
function parentheseDeLaDifficulte(jet) {
  const reglages = jet.modificateurs.filter((modificateur) => modificateur.genre === "main").map(({ valeur, nom }) => `${signer(valeur)} à la main : ${nom}`);
  const parties = [...(jet.libelle ? [jet.libelle] : []), ...reglages];
  return parties.length === 0 ? "" : ` (${parties.join(", ")})`;
}

// Le reste net d'avantages ou de désavantages, sans nommer de source. La main
// seule s'y dit, et seulement quand la phrase des sources ne l'a pas déjà
// nommée : en entier si tout le net vient d'elle, pour sa part sinon.
function netDuJet(jet) {
  const net = netDe(jet);
  if (net === 0) return "";
  const texte = `, ${compter(Math.abs(net), net > 0 ? "avantage" : "désavantage")}`;
  if (ecrireSources(jet) !== null) return texte;
  const main = (net > 0 ? jet.avantages : jet.desavantages).find((source) => source.genre === "main");
  if (!main) return texte;
  return `${texte} (${main.nombre === Math.abs(net) ? "" : `dont ${main.nombre} `}à la main : ${main.nom})`;
}

/**
 * La phrase du jet : « d10+1 contre 5, 1 désavantage → 7/10 → 7 ✓, 9/3 → 3 ✗ :
 * 1 réussite, A = 3, +1 contre l'armure (Réduction). » Quand un adversaire
 * attaque, c'est le PJ visé qui lance : « Aubépine lance sa défense, d8+1
 * contre 5 → … ». Les caractéristiques d'un dé au choix s'écrivent dans
 * l'ordre où le jet les garde, que le moteur a rangé.
 */
export function ecrireJet(etat, geste) {
  const { jet } = geste;
  const prefixe = jet.genre === "defense" ? `${court(etat, jet.lanceur)} lance sa défense, ` : "";
  const caracteristiques = jet.caracteristiques ? ` (${jet.caracteristiques.map(nomDeCaracteristique).join(" + ")})` : "";
  const places = jet.places.map((place) => ecrirePlace(jet, place)).join(", ");
  return (
    `${prefixe}${ecrireDe(jet)}${caracteristiques} contre ${jet.difficulte}${parentheseDeLaDifficulte(jet)}${netDuJet(jet)} ` +
    `${SIGNES.fleche} ${places} : ${ecrireBilan(etat, geste)}.`
  );
}

// ─── La localisation, les interventions, les dégâts ─────────────────────────

// Les d20 lancés d'un geste, lus sur la grille de sa cible.
function d20DuGeste(etat, geste) {
  const victime = photoDe(etat, geste.cible);
  if (victime === null) return [];
  return (geste.localisation ?? []).map(({ brut, decalage }) => ({ brut, decalage: decalage ?? null, ...localiser(victime, brut, decalage?.valeur ?? 0) }));
}

// Un d20 : « 14 : jambe droite » ; décalé, « 14, décalée à 12 (Minutie) :
// jambe gauche » ; la face de contre-attaque se lit sur le dé brut.
function ecrireD20(etat, geste, { brut, decalage, contre, face, zone }, separateur) {
  if (contre) return `${brut}${separateur}contre-attaque, l'attaque est annulée`;
  const decalee = decalage !== null && decalage.valeur !== 0 ? `, décalée à ${face} (${decalage.raison})` : "";
  return `${brut}${decalee}${separateur}${minuscule(zoneDe(etat, geste.cible, zone))}`;
}

/**
 * « Localisation d20 → 14 : jambe droite. » ; avec plusieurs dés,
 * « Localisation 2 d20 → 6 : torse ; 13 : jambe gauche. » Le nombre est celui
 * des d20 du geste ; les dés écrits sont ceux qui ont été lancés (une face de
 * contre-attaque arrête les suivants). null tant qu'aucun d20 n'est lancé.
 */
export function ecrireLocalisation(etat, geste) {
  const lances = d20DuGeste(etat, geste);
  if (lances.length === 0) return null;
  const nombre = nombreDeD20(etat, geste);
  return `Localisation ${nombre > 1 ? `${nombre} ` : ""}d20 ${SIGNES.fleche} ${lances.map((d20) => ecrireD20(etat, geste, d20, " : ")).join(" ; ")}.`;
}

/**
 * « Aubépine intervient : Pas de côté (1 action, 3 souffle), 12 → 9. » Dès
 * que le geste a plusieurs d20, chaque coup qu'elle change porte sa zone :
 * « …, torse 10 → 0, jambe gauche 10 → 8. » L'intervention est l'une de
 * celles du geste : ce qu'elle annule s'impute après celles qui la précèdent.
 */
export function ecrireIntervention(etat, geste, intervention) {
  const annule = (une) => (une.effet?.genre === "annuler" ? une.effet.x : 0);
  const toutes = geste.interventions ?? [];
  const rang = toutes.indexOf(intervention);
  const deja = somme(toutes.slice(0, Math.max(0, rang)).map(annule));

  const { avant: entiers } = degatsFixes(etat, geste);
  const avantElle = imputerEsquive(entiers, deja);
  const apresElle = imputerEsquive(entiers, deja + annule(intervention));
  const plusieurs = nombreDeD20(etat, geste) > 1;
  const coups = d20DuGeste(etat, geste)
    .map(({ zone }, coup) => ({ zone, avant: avantElle[coup], apres: apresElle[coup] }))
    .filter(({ avant, apres }) => avant !== apres)
    .map(({ zone, avant, apres }) => `${plusieurs ? `${minuscule(zoneDe(etat, geste.cible, zone))} ` : ""}${avant} ${SIGNES.fleche} ${apres}`);

  const nom = capaciteDe(etat, intervention.qui, intervention.capacite)?.nom ?? "";
  const prix = `${compter(intervention.prix?.actions ?? 0, "action")}, ${intervention.prix?.souffle ?? 0} souffle`;
  return `${court(etat, intervention.qui)} intervient : ${nom} (${prix})${coups.map((coup) => `, ${coup}`).join("")}.`;
}

/**
 * Ce que le coup a changé, et cela seul, dans l'ordre armure, résistance,
 * corps : « Armure 5 → 0, résistance 5 → 0, corps 10 → 0. » Dès que le geste
 * a plusieurs d20, chaque coup porte sa zone : « Torse : armure 30 → 19.
 * Jambe gauche : armure 15 → 4. » null si rien n'a changé.
 */
export function ecrireDegats(etat, geste) {
  const plusieurs = nombreDeD20(etat, geste) > 1;
  const phrases = [];
  for (const coup of geste.resultat?.coups ?? []) {
    const changements = [
      ["armure", coup.armure],
      ["résistance", coup.resistance],
      ["corps", coup.corps],
    ]
      .filter(([, [avant, apres]]) => avant !== apres)
      .map(([nom, [avant, apres]]) => `${nom} ${avant} ${SIGNES.fleche} ${apres}`)
      .join(", ");
    if (changements === "") continue;
    phrases.push(plusieurs ? `${majuscule(zoneDe(etat, geste.cible, coup.zone))} : ${changements}.` : `${majuscule(changements)}.`);
  }
  return phrases.length === 0 ? null : phrases.join(" ");
}

/**
 * Une phrase par zone dont la résistance tombe à 0, dans l'ordre des dés :
 * « Blessure (jambe gauche) : −1 à ses jets. » pour un PJ, le nombre étant
 * celui de ses blessures après ce coup ; « Blessure (jambe droite), sans effet
 * calculé. » pour un adversaire. null sans blessure, ou si le coup tue.
 */
export function ecrireBlessures(etat, geste) {
  const { resultat } = geste;
  if (!resultat || resultat.mort) return null;
  const pj = campDe(etat, geste.cible) === "pj";
  const phrases = resultat.coups
    .filter((coup) => coup.blessure)
    .map((coup) => {
      const zone = minuscule(zoneDe(etat, geste.cible, coup.zone));
      return pj ? `Blessure (${zone}) : ${SIGNES.moins}${coup.blessures} à ses jets.` : `Blessure (${zone}), sans effet calculé.`;
    });
  return phrases.length === 0 ? null : phrases.join(" ");
}

/** « Marmiton n° 2 meurt. » ; null si le coup ne tue pas. */
export function ecrireMort(etat, geste) {
  return geste.resultat?.mort ? `${court(etat, geste.cible)} meurt.` : null;
}

// ─── La ligne d'un geste ────────────────────────────────────────────────────

/**
 * Les phrases de la ligne d'un geste fini, dans l'ordre : l'ouverture ; puis,
 * pour un geste à jet d'attaque, la phrase des sources, le jet, la
 * localisation, les interventions, les dégâts, les blessures, la mort. Un jet
 * de caractéristique tient en une phrase, l'ouverture et le jet joints par
 * une virgule.
 */
export function segmentsDuGeste(etat, geste) {
  const avecJet = (geste.jet ?? null) !== null;
  if (geste.mode === "caracteristique" && avecJet) return [`${debutDuGeste(etat, geste)}, ${ecrireJet(etat, geste)}`];
  if ((geste.mode !== "attaque" && geste.mode !== "jet_prete") || !avecJet) return [ecrireOuverture(etat, geste)];
  return [
    ecrireOuverture(etat, geste),
    ecrireSources(geste.jet),
    ecrireJet(etat, geste),
    ecrireLocalisation(etat, geste),
    ...(geste.interventions ?? []).map((intervention) => ecrireIntervention(etat, geste, intervention)),
    ecrireDegats(etat, geste),
    ecrireBlessures(etat, geste),
    ecrireMort(etat, geste),
  ].filter((segment) => segment !== null);
}

/** La ligne de journal d'un geste fini : ses phrases, jointes par une espace. */
export function ligneDuGeste(etat, geste) {
  return segmentsDuGeste(etat, geste).join(" ");
}

// ─── Les annonces ───────────────────────────────────────────────────────────

// Les lignes que l'événement a écrites au journal. Le compte des lignes
// d'avant les donne exactement. Sans lui, l'état d'après ne laisse voir que la
// queue du journal : tout pour un lancement, depuis la ligne du geste pour un
// geste fini, depuis la dernière fin de tour pour une fin de tour demandée
// (celle-là seule quand une fin automatique l'a suivie).
function lignesEcrites(etat, evenement, lignesAvant) {
  const journal = etat.journal ?? [];
  if (Number.isInteger(lignesAvant)) return journal.slice(Math.max(0, lignesAvant));
  const depuis = (genre) => {
    const rang = journal.findLastIndex((ligne) => ligne.genre === genre);
    return rang === -1 ? [] : journal.slice(rang);
  };
  switch (evenement.type) {
    case "lancer":
      return journal;
    case "passer":
      return depuis("geste");
    case "fin_de_tour":
      return depuis("cadre");
    case "confirmer":
    case "de":
    case "garder":
    case "appliquer":
      return gesteEnCours(etat) === null ? depuis("geste") : [];
    default:
      return [];
  }
}

const ordinal = (place) => (place === 1 ? "1er" : `${place}e`);

// Le dé qui vient de tomber dans la chaîne : « 1er dé : 9, réussi. » ; sous
// désavantage, « 2e dé : 8 et 4, on garde 4, échec. » ; une explosion, « Le dé
// explose : 6 plus 3, 9, réussi. » Les valeurs sont dites modificateur
// compris, comme au journal.
function annoncerLeDe(jet) {
  const essai = dernier(dernier(jet.places).essais);
  const { premier, somme: total, reussi, explosible } = evaluerEssai(jet, essai);
  const question = jet.attente === "choix_relance" ? " Relancer ou garder ?" : "";
  if (essai.explosions.length > 0) {
    const issue = explosible ? "il peut encore exploser" : reussi ? "réussi" : "échec";
    return `Le dé explose : ${[premier, ...essai.explosions].join(" plus ")}, ${total}, ${issue}.${question}`;
  }
  const modificateur = modificateurDe(jet);
  const valeurs = essai.tirages.length > 1 ? `${enumerer(essai.tirages.map((tirage) => `${tirage + modificateur}`))}, on garde ${premier}` : `${premier}`;
  const issue = explosible ? "il peut exploser" : reussi ? "réussi" : "échec";
  return `${ordinal(jet.places.length)} dé : ${valeurs}, ${issue}.${question}`;
}

/**
 * Ce que la région d'annonce dit après un événement, ou null s'il n'y a rien
 * à dire. C'est le moteur qui en fait l'annonce de l'état.
 *
 * - etat : l'état d'après l'événement, journal compris ;
 * - geste : le geste que l'événement a fait avancer, tel qu'il est après lui ;
 *   null pour un événement sans geste ;
 * - lignesAvant : le nombre de lignes du journal avant l'événement (voir
 *   lignesEcrites pour ce qui se passe sans lui).
 *
 * Si l'événement a écrit des lignes (un geste fini, « passer », un tour qui
 * change, la fin du combat), ce sont elles, à la suite. Sinon, seuls un dé
 * lancé et un dé gardé parlent : le dé de la chaîne qui vient de tomber,
 * suivi du bilan quand il la finit ; le bilan seul pour un dé gardé ; un d20,
 * « Localisation : 12, jambe gauche. »
 */
export function annonce(etat, geste, evenement, lignesAvant = null) {
  const lignes = lignesEcrites(etat, evenement, lignesAvant);
  if (lignes.length > 0) return lignes.map((ligne) => ligne.texte).join(" ");
  const jet = geste?.jet ?? null;
  if (jet === null || (evenement.type !== "de" && evenement.type !== "garder")) return null;

  // Dès qu'un d20 est lancé, la chaîne est finie : le dé de l'événement est
  // le dernier d20.
  const lances = d20DuGeste(etat, geste);
  if (lances.length > 0) return `Localisation : ${ecrireD20(etat, geste, dernier(lances), ", ")}.`;

  // Une chaîne finie dans un geste qui ne l'est pas : l'attaque touche (un jet
  // manqué aurait fini le geste, et écrit sa ligne), le bilan suit donc.
  const phrases = [];
  if (evenement.type === "de" && jet.places.length > 0) phrases.push(annoncerLeDe(jet));
  if (jetFini(jet)) phrases.push(`${ecrireBilan(etat, geste)}.`);
  return phrases.length === 0 ? null : phrases.join(" ");
}

// ─── L'en-tête, le texte, le fichier ────────────────────────────────────────

// L'heure du lancement, telle que l'événement « lancer » la porte : l'heure
// murale de l'appareil qui a lancé, déjà écrite. Elle se découpe sans jamais
// passer par une date, qui dépendrait du fuseau de l'appareil qui relit.
const MOTIF_HEURE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** « 2026-10-11T23:05 » s'écrit « 11/10/2026 à 23 h 05 » ; avant dix heures, « à 9 h 05 ». Vide si l'heure ne se lit pas. */
export function ecrireHeure(le) {
  const lue = typeof le === "string" ? MOTIF_HEURE.exec(le) : null;
  if (lue === null) return "";
  const [, annee, mois, jour, heure, minute] = lue;
  return `${jour}/${mois}/${annee} à ${Number(heure)} h ${minute}`;
}

/**
 * Le nom du fichier téléchargé : « combat-2026-10-11-23h05.txt ». Seuls les
 * chiffres d'une heure bien formée y entrent : un nom de fichier ne se
 * compose jamais d'un texte qu'on n'a pas découpé soi-même.
 */
export function nomDuFichier(le) {
  const lue = typeof le === "string" ? MOTIF_HEURE.exec(le) : null;
  if (lue === null) return "combat.txt";
  const [, annee, mois, jour, heure, minute] = lue;
  return `combat-${annee}-${mois}-${jour}-${heure}h${minute}.txt`;
}

// Les adversaires de l'en-tête : chacun une fois, dans l'ordre du premier
// ajout, suivi des numéros de ses exemplaires (« Marmiton de corvée n° 1 et
// n° 2 »). Les exemplaires d'un adversaire portent exactement le même nom.
function adversairesDeLEnTete(etat) {
  const groupes = [];
  for (const id of etat.ordre) {
    if (campDe(etat, id) !== "adv") continue;
    const nom = photoDe(etat, id)?.nom ?? "";
    let groupe = groupes.find((autre) => autre.nom === nom);
    if (!groupe) {
      groupe = { nom, numeros: [] };
      groupes.push(groupe);
    }
    const exemplaire = etat.noms?.[id]?.exemplaire ?? null;
    if (exemplaire !== null) groupe.numeros.push(`n° ${exemplaire}`);
  }
  return groupes.map(({ nom, numeros }) => (numeros.length === 0 ? nom : `${nom} ${enumerer(numeros)}`));
}

/**
 * Les quatre lignes qui ouvrent le texte copié ou téléchargé : le titre,
 * l'heure du lancement (suivie de « (démonstration) » en démonstration), les
 * personnages et les adversaires, par leur nom entier.
 */
export function enTete(etat) {
  const personnages = etat.ordre.filter((id) => campDe(etat, id) === "pj").map((id) => photoDe(etat, id)?.nom ?? "");
  return [
    `Simulateur de combat ${SIGNES.tiret} L'Atelier des Arpenteurs`,
    `Combat lancé le ${ecrireHeure(etat.lanceLe)}${etat.mode === "demo" ? " (démonstration)" : ""}`,
    `Personnages : ${personnages.join(", ")}`,
    `Adversaires : ${adversairesDeLEnTete(etat).join(" ; ")}`,
  ];
}

/**
 * Le texte du journal, à copier (fins de ligne « \n ») ou à télécharger
 * (« \r\n ») : l'en-tête, une ligne vide, puis les lignes. La dernière ligne
 * n'est pas suivie d'une fin de ligne.
 */
export function texteDuJournal(etat, finDeLigne = "\n") {
  return [...enTete(etat), "", ...(etat.journal ?? []).map((ligne) => ligne.texte)].join(finDeLigne);
}
