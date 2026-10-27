// Le journal du combat : une ligne par geste fini, au présent, en texte
// simple, et les segments typés dont elle est faite (SPECIFICATION.md, § 17.9
// « Le journal »).
//
// Ce module écrit tout ce que le simulateur dit d'un combat : les lignes du
// cadre (lancement, tours, fin), la ligne de chaque geste, la ligne « Annulé »
// d'un geste défait, la ligne qu'un geste payé est en train d'écrire,
// l'en-tête et le texte que l'on copie ou télécharge, et la phrase que la
// région d'annonce donne aux lecteurs d'écran après chaque dé, chaque esquive
// et chaque face décalée. Il existe pour que ce texte n'ait qu'une écriture :
// le moteur, le rejeu d'un combat gardé, les contrôles et le banc le
// comparent mot pour mot, au signe près.
//
// Ce que cela impose :
// - une ligne est une fonction du geste fini, des noms figés au lancement et
//   des photographies. Elle ne lit aucune valeur courante (souffle, armure,
//   corps) : le geste garde l'avant et l'après de ce qu'il a changé, si bien
//   que la même ligne sort en jeu et au rejeu ;
// - rien ne vient de l'appareil : ni heure, ni langue, ni hasard. L'heure du
//   lancement est une donnée, découpée comme un texte ;
// - les signes (flèche, coche, croix, moins, tiret long, point médian)
//   viennent de SIGNES, par leur code, comme les points de suspension de la
//   ligne en cours, et toute espace est une espace ordinaire, « n° 1 » et
//   « 23 h 05 » compris ;
// - les noms (protagonistes, capacités, zones, armes, raisons) sont des
//   données hostiles, écrites telles quelles : c'est l'écran qui les désarme,
//   sur le texte entier, au moment de copier ou de télécharger.
//
// Les segments (groupe 2). Chaque ligne naît en morceaux typés : le nom de
// qui agit, la capacité jouée, le nom de la cible, les dés d'un jet dans leur
// cadre (un dé insécable par essai), la lettre des dégâts, le nombre saisi,
// la mort… L'écran colore et encadre d'après eux, et coupe le bandeau d'après
// les phrases qu'ils désignent, sans jamais relire le texte pour y chercher un
// nom : un nom peut porter « → », « ✓ » ou « contre ». Le texte, lui, ne
// change pas, et ne peut pas s'écarter des segments : chaque gabarit
// fabrique ses segments, et le texte en est la concaténation (la règle d'or).
// Les fonctions qui rendaient du texte au groupe 1 gardent leur nom et leur
// sortie : elles concatènent les mêmes segments.
//
// La fin du combat (groupe 3 ; mission du lot 4.3, § 7 ; contrat de la vague
// 1, § 4, § 5, § 8 et § 10). Une intervention et une contre-attaque
// s'écrivent dans la ligne du geste qu'elles suivent, après la localisation
// (ou le bilan) et avant les dégâts : le geste racine arrive ici avec ses
// gestes emboîtés joints, et chacun y écrit ses phrases, son nom en tête. Le
// coup critique, un dé inversé ou relancé par la palette, « +1 réussite », la
// zone choisie, les opérations de la palette et le report entrent dans les
// phrases d'aujourd'hui ; rendre, ±N, un état et un déplacement sans action
// ont leur phrase, avant le premier dé s'ils valent « pour ce jet », après
// les dégâts et la blessure sinon. Écrivent leur propre ligne : attendre,
// « Intervenir… » hors d'une attaque, chaque cible d'un geste à plusieurs
// cibles, chaque échéance, chaque geste du MJ, chaque effet hors d'un geste.
// Un effet appliqué à un geste ensuite retiré ne s'écrit nulle part : le
// journal n'écrit que des gestes finis. Quand personne n'intervient, rien ne
// s'écrit.
//
// Une fonction par gabarit, toutes exportées, pour que chacun ait son
// contrôle. Celles qui écrivent un segment facultatif (les sources, la
// localisation, les dégâts, les blessures, la mort) rendent null quand il n'y
// a rien à écrire.
//
// Quelques textes ne viennent pas de l'auteur, qui n'a donné de gabarit que
// pour les cas courants : la source « types d'armure mêlés », les dégâts
// directs, le coût en lien non payé seul dans sa parenthèse, une valeur de dé
// passée sous zéro (« −1 ✗ »), les phrases d'annonce d'un dé qui peut
// exploser. Au groupe 3 : la fin d'une attaque en plus, une arme ou une
// qualité retirées par le MJ, une cellule vidée, la garde à côté d'un coût,
// plusieurs sources de « +1 réussite », l'ordre de l'armure et du report dans
// le bilan, la fin d'un état libre, l'annulation d'une valeur de zone, une
// échéance ou une annulation dont la source est le MJ (« Fin de MJ pour
// Aubépine : … », « Annulé : effet de MJ sur Marmiton n° 2. »), « toute la
// case » à la fin du bilan de la première cible (« , toute la case
// (Frappe) »), l'ouverture d'un jet de caractéristique en sa propre phrase
// quand les sources ou un effet « pour ce jet » précèdent son premier dé
// (« Aubépine : Goûter. »). Ils restent à lui faire confirmer.

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { degatsFixes, imputerEsquive, localisationsDuGeste, nombreDeD20, reussitesDeLAttaque, victimeDe } from "./degats.js";
import { critiqueReussi, evaluerEssai, jetFini, modificateurDe, netDe, reussites, reussitesDesPlaces } from "./jet.js";
import { LETTRES, REUSSITES_MAX, SIGNES, geler } from "./regles.js";
import { attaqueDe, campDe, capaciteDe, courantDe, defenseDe, faconDe, gesteEnCours, nomDeLaSource, photoDe } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };

// Les points de suspension qui suivent la ligne en cours, par leur code comme
// les signes du journal ; de même le signe de « ×2 » et les guillemets d'un
// état libre (« « Couvert de farine » »), séparés de lui par une espace
// ordinaire.
const SUITE = String.fromCodePoint(0x2026);
const FOIS = String.fromCodePoint(0x00d7);
const OUVRANT = String.fromCodePoint(0x00ab);
const FERMANT = String.fromCodePoint(0x00bb);

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);
const dernier = (liste) => liste[liste.length - 1];
const liste = (valeur) => (Array.isArray(valeur) ? valeur : []);

// « 1 réussite », « 2 réussites » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « n° 1 » ; « n° 1 et n° 2 » ; « n° 1, n° 2 et n° 3 ».
const enumerer = (mots) => (mots.length < 2 ? mots.join("") : `${mots.slice(0, -1).join(", ")} et ${dernier(mots)}`);

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// Une valeur de dé, modificateur compris : « 7 », « 0 », « −1 ». Elle passe
// sous zéro dès que les modificateurs pèsent plus que le dé, et porte alors
// le même moins que le modificateur, jamais le trait d'union d'un nombre
// converti tel quel.
const ecrireValeur = (valeur) => (valeur < 0 ? `${SIGNES.moins}${-valeur}` : `${valeur}`);

// Un nombre de l'état (une attaque écartée peut passer sous zéro), ou « ? »
// quand il manque : un journal ne lève pas.
const ecrireNombre = (valeur) => (Number.isInteger(valeur) ? ecrireValeur(valeur) : "?");

// « 1er », « 2e », « 4e ».
const ordinal = (place) => (place === 1 ? "1er" : `${place}e`);

// L'élision devant une voyelle, accentuée ou non : « défense d'Aubépine »,
// « attaque de Marmiton n° 3 ». Un h reste entier, faute de savoir s'il est
// muet (comme js/adversaire/lecture.js). Exportée pour les vues (contrat de
// la vague 3 du lot 4.3, § 1) : « Appliquer l'effet d'Étourdi… », « la
// portée 1 de Couteau d'office ».
const VOYELLE = /^[aeiouàâäéèêëîïôöùûüœæ]/iu;
export const deNom = (nom) => (VOYELLE.test(nom) ? `d'${nom}` : `de ${nom}`);

// Un état libre, nommé par le MJ : entre guillemets.
const entreGuillemets = (texte) => `${OUVRANT} ${texte} ${FERMANT}`;

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
// photographie (celui des personnages quand la zone est reconnue). Une zone
// qu'il n'a pas s'écrit « ? » : l'offre ne la permet pas.
const zoneDe = (etat, id, indice) => photoDe(etat, id)?.zones?.[indice]?.nom ?? "?";

// Le nom d'une jauge de lien d'un personnage : son primordial (« Grand Four »).
const jaugeDe = (etat, id, indice) => photoDe(etat, id)?.liens?.[indice]?.nom ?? "?";

const nomDeCaracteristique = (code) => CARACTERISTIQUES.find((caracteristique) => caracteristique.code === code)?.nom ?? code;

// Le coût en lien qu'un adversaire ne paie pas, après le coût et « ; ».
const NON_PAYE = "coût en lien non payé : un adversaire n'a pas de lien";

// ─── Les segments ───────────────────────────────────────────────────────────
//
// Segment = { type, texte, phrase, camp?, jet?, de? } (le contrat du groupe 2,
// § 3.1). Pendant qu'une phrase se fabrique, ses segments n'ont pas encore de
// numéro de phrase : numeroter() le leur donne quand la ligne s'assemble.
// Au groupe 3, deux types de plus : « echeance », la ligne « Fin de … »
// entière, et « mj », le « MJ : » qui ouvre chaque phrase d'un geste du MJ ;
// tous deux s'écrivent comme « Fin du tour… » (mission, § 7).

// Le texte d'une suite de segments : leur concaténation, et rien d'autre.
const texteDe = (segments) => segments.map((segment) => segment.texte).join("");

// Ajoute un segment à une suite en construction, et la rend. Un texte vide ne
// s'écrit pas : un segment n'est jamais vide. Deux segments « texte » qui se
// suivent au même endroit (hors du cadre, entre deux dés du cadre, ou dans un
// même dé) n'en font qu'un.
function pousser(segments, type, texte, champs = {}) {
  if (texte === "") return segments;
  const precedent = dernier(segments);
  if (type === "texte" && precedent?.type === "texte" && precedent.jet === champs.jet && precedent.de === champs.de) {
    segments[segments.length - 1] = { ...precedent, texte: precedent.texte + texte };
  } else {
    segments.push({ type, texte, ...champs });
  }
  return segments;
}

// Ajoute une suite de segments à une autre, en les joignant comme pousser().
const joindre = (segments, autres) => autres.reduce((suite, { type, texte, ...champs }) => pousser(suite, type, texte, champs), segments);

// Un texte seul, en segments : aucun s'il est vide.
const enTexte = (texte) => pousser([], "texte", texte);

// Le nom court d'un protagoniste, en segment « acteur » ou « cible », avec son
// camp. Un identifiant qui n'est pas dans le combat n'a pas de camp : son nom,
// s'il en a un, reste du texte.
function pousserLeNom(segments, type, etat, id) {
  const camp = campDe(etat, id);
  return camp === null ? pousser(segments, "texte", court(etat, id)) : pousser(segments, type, court(etat, id), { camp });
}

// Les segments d'une phrase, numérotés : le numéro suit le texte.
const numeroter = (segments, phrase) => segments.map(({ type, texte, ...champs }) => ({ type, texte, phrase, ...champs }));

// Une ligne entière, gelée : ses phrases jointes par une espace qui n'est
// d'aucune phrase ; « … » à la fin de la ligne en cours, sans espace avant.
function assembler(genre, phrases, champs = {}, { suite = false } = {}) {
  const segments = [];
  phrases.forEach((phrase, rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: " ", phrase: null });
    segments.push(...phrase.segments);
  });
  if (suite) segments.push({ type: "suite", texte: SUITE, phrase: null });
  return geler({ genre, texte: texteDe(segments), segments, phrases: phrases.map((phrase) => phrase.genre), ...champs });
}

// Une ligne d'une seule phrase, faite d'un seul segment.
const ligneDUnTenant = (genre, phrase, type, texte) => assembler(genre, [{ genre: phrase, segments: numeroter(pousser([], type, texte), 0) }]);

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

// « Marmiton n° 2 passe son tour. » : le nom de qui passe, puis le reste.
const segmentsDeLaPasse = (etat, qui) => pousser(pousserLeNom([], "acteur", etat, qui), "texte", " passe son tour.");

/** « Marmiton n° 2 passe son tour. » */
export function ligneDePasse(etat, qui) {
  return texteDe(segmentsDeLaPasse(etat, qui));
}

// ─── Les sources des effets ─────────────────────────────────────────────────

// Le nom de la source d'un effet : sa capacité, l'état porté (sa capacité
// figée ou son texte libre), ou « MJ » ; « ? » pour une source qui n'est plus.
const nomDeSource = (etat, source) => nomDeLaSource(etat, source) ?? "?";

// Ce qu'un effet écrit entre parenthèses : sa source, puis le prix d'un passif
// payant, souffle puis lien, comme le coût d'un geste (« Nez fin, 1 souffle ») ;
// pour un adversaire, le lien qu'il ne paie pas, après « ; ».
function sourceEtPrix(etat, effet) {
  const prix = effet?.prix ?? null;
  const parties = [nomDeSource(etat, effet?.source)];
  if (prix?.souffle > 0) parties.push(`${prix.souffle} souffle`);
  if (prix?.lien > 0) parties.push(`${prix.lien} lien`);
  return [parties.join(", "), ...(prix?.lienNonPaye > 0 ? [NON_PAYE] : [])].join(" ; ");
}

// Les effets qu'un geste a reçus pour sa cible en cours (son rang), dans
// l'ordre où ils se sont appliqués ; ceux d'une cible finie sont dans sa ligne.
const effetsDuRang = (geste) => liste(geste?.effets).filter((effet) => (effet?.rang ?? 0) === (geste.rang ?? 0));
const effetsDeGenre = (geste, ...genres) => effetsDuRang(geste).filter((effet) => genres.includes(effet.genre));

// ─── L'ouverture ────────────────────────────────────────────────────────────

// Ce qui suit le nom de qui agit : « : » pour un geste, « intervient : » pour
// une intervention (dans l'étape, ou « Intervenir… »), « contre-attaque : »
// pour une contre-attaque.
const VERBES = { intervention: " intervient : ", contre_attaque: " contre-attaque : " };
const verbeDe = (geste) => (Object.hasOwn(VERBES, geste.genre ?? "") ? VERBES[geste.genre] : " : ");

// Le nom de la capacité qui garde la ligne qu'une intervention joue
// (« Guetter ») : la source de l'effet « guet » qui la garde, et, s'il n'est
// plus là, la capacité « attendre » de qui la joue.
function nomDeLaGarde(etat, geste) {
  const guet = liste(etat.effets).find((effet) => effet.id === geste.gardee) ?? null;
  if (guet !== null) return nomDeSource(etat, guet.source);
  return liste(photoDe(etat, geste.acteur)?.capacites).find((capacite) => capacite.role === "attendre")?.nom ?? "?";
}

// Ce qui suit la capacité, entre parenthèses : l'arme, quand plusieurs armes
// donnent la capacité ou qu'un adversaire à plusieurs armes prête le jet de
// l'une d'elles ; puis le coût payé, s'il n'est pas nul (l'action d'une
// intervention ou d'une contre-attaque d'abord), la garde d'une capacité
// gardée ; puis, après un point-virgule, le coût en lien qu'un adversaire ne
// paie pas, et l'attaque en plus. Un geste à plusieurs cibles ne dit son coût
// que sur la ligne de la première.
function parentheseDeLOuverture(etat, geste, capacite, facon) {
  const parties = [];
  const libelle = facon?.libelle ?? null;
  if (libelle !== null && capacite.facons.some((autre) => autre.libelle !== libelle)) parties.push(libelle);
  if (geste.mode === "jet_prete" && campDe(etat, geste.acteur) === "adv") {
    const armes = photoDe(etat, geste.acteur)?.armes ?? [];
    const pretee = armes[geste.armePretee]?.libelle ?? null;
    if (armes.length > 1 && pretee !== null && !parties.includes(pretee)) parties.push(pretee);
  }
  const premiere = (geste.rang ?? 0) === 0;
  const prix = premiere ? (geste.prix ?? {}) : {};
  if (Object.hasOwn(VERBES, geste.genre ?? "") && prix.actions > 0) parties.push(compter(prix.actions, "action"));
  if (prix.souffle > 0) parties.push(`${prix.souffle} souffle`);
  if (prix.lien > 0) parties.push(`${prix.lien} lien`);
  if ((geste.gardee ?? null) !== null) parties.push(`gardée par ${nomDeLaGarde(etat, geste)}`);

  const suite = [];
  if (prix.lienNonPaye > 0) suite.push(NON_PAYE);
  if (premiere && (geste.attaqueEnPlus ?? null) !== null) suite.push(`attaque en plus : ${nomDeSource(etat, geste.sourceDeLAttaqueEnPlus)}`);
  return [parties.join(", "), ...suite].filter((texte) => texte !== "").join(" ; ");
}

// « Taloche [1] » : le nom d'une capacité, et sa puissance entre crochets
// quand elle évolue ; « ligne » est { capacite, facon }.
function nomDeLaLigne(etat, qui, ligne) {
  const capacite = capaciteDe(etat, qui, ligne?.capacite);
  const puissance = capacite?.evolue ? ` [${capacite.facons[ligne.facon]?.puissance ?? 0}]` : "";
  return `${capacite?.nom ?? ""}${puissance}`;
}

// « Taloche [1] » : la capacité que joue le geste.
function nomDeLaCapacite(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const puissance = capacite?.evolue ? ` [${faconDe(etat, geste)?.puissance ?? 0}]` : "";
  return `${capacite?.nom ?? ""}${puissance}`;
}

// « contre » un protagoniste de l'autre camp, « sur » un allié ou sur soi.
const lienALaCible = (etat, geste) => (campDe(etat, geste.cible) === campDe(etat, geste.acteur) ? "sur" : "contre");

// « Aubépine : Fournaise [1] (1 souffle, 1 lien) », sans ce qui suit : le nom
// de qui agit, son verbe, la capacité et sa puissance, la parenthèse.
function segmentsDuDebut(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const parenthese = capacite ? parentheseDeLOuverture(etat, geste, capacite, faconDe(etat, geste)) : "";
  const segments = pousser(pousserLeNom([], "acteur", etat, geste.acteur), "texte", verbeDe(geste));
  pousser(segments, "capacite", nomDeLaCapacite(etat, geste));
  return pousser(segments, "texte", parenthese === "" ? "" : ` (${parenthese})`);
}

// La première phrase d'un geste, en segments : le début, puis la cible (son
// nom, avec son camp, et son rang parmi plusieurs) ; pour un déplacement, le
// départ et l'arrivée ; pour attendre, la ligne gardée et son échéance.
function segmentsDeLOuverture(etat, geste) {
  const segments = segmentsDuDebut(etat, geste);
  if (geste.mode === "deplacement") return pousser(segments, "texte", `, ${geste.depart} ${SIGNES.fleche} ${geste.arrivee}.`);
  if (geste.mode === "attendre") {
    return pousser(segments, "texte", `, garde ${nomDeLaLigne(etat, geste.acteur, geste.garde)} jusqu'au prochain tour des ${CAMPS[campDe(etat, geste.acteur)] ?? ""}.`);
  }
  if ((geste.cible ?? null) !== null) pousserLeNom(pousser(segments, "texte", ` ${lienALaCible(etat, geste)} `), "cible", etat, geste.cible);
  const cibles = liste(geste.cibles);
  if (cibles.length > 1) pousser(segments, "texte", `, cible ${(geste.rang ?? 0) + 1} sur ${cibles.length}`);
  return pousser(segments, "texte", ".");
}

/**
 * La première phrase d'un geste : « Aubépine : Émincer (4 souffle) contre
 * Marmiton n° 2. » ; pour un déplacement : « Chef : Pas chassé [2]
 * (1 souffle), F6 → D4. » Au groupe 3 : « Marmiton n° 2 intervient :
 * Frappe (1 action) contre Aubépine. » ; « Aubépine : Guetter, garde Taloche [1]
 * jusqu'au prochain tour des PJ. » ; « Aubépine : Frappe (attaque en plus :
 * Flambage) contre Marmiton n° 2. » ; « Aubépine : Émincer (4 souffle) contre
 * Marmiton n° 2, cible 1 sur 2. »
 */
export function ecrireOuverture(etat, geste) {
  return texteDe(segmentsDeLOuverture(etat, geste));
}

// ─── Le jet ─────────────────────────────────────────────────────────────────

/**
 * Une source d'avantage ou de désavantage : le nom du passif ; « Émincer hors
 * maîtrise » ; « types d'armure mêlés » ; « à la main : Minutie » ; suivie de
 * « de Marmiton n° 2 » quand elle vient de l'autre protagoniste. Celle d'un
 * effet de la palette (« effet ») est le nom de sa source.
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

// Le signe d'un essai, en segment de son dé.
const signeDuDe = (reussi) => (reussi ? ["reussi", SIGNES.reussi] : ["echoue", SIGNES.echoue]);

// Un essai, en un dé insécable (de: k) du cadre (jet: 0) : « tete » (le
// « 4e dé » du critique), ses lancers et la flèche du désavantage, sa valeur,
// ses explosions et leur somme, une espace, puis « ✓ » ou « ✗ », qui ne vivent
// que là. Un dé inversé dit d'abord sa valeur d'avant et son signe, puis
// « inversé », sa source et la flèche (« 3 ✗ inversé (MJ) → 8 ✓ »).
// « inacheve » l'écrit tel qu'il est quand il attend une explosion : sans
// somme ni signe, qui changeront.
function segmentsDeLEssai(jet, essai, de, inacheve, { tete = "", inversion = "?" } = {}) {
  const dans = { jet: 0, de };
  const modificateur = modificateurDe(jet);
  const { premier, somme: total, reussi } = evaluerEssai(jet, essai);
  const lancers = essai.tirages.length > 1 ? `${essai.tirages.map((tirage) => ecrireValeur(tirage + modificateur)).join("/")} ${SIGNES.fleche} ` : "";
  const segments = pousser([], "texte", `${tete}${lancers}`, dans);
  if (essai.inverse === true) {
    const avant = evaluerEssai(jet, { ...essai, inverse: false, explosions: [] });
    pousser(segments, "texte", `${ecrireValeur(avant.premier)} `, dans);
    pousser(segments, ...signeDuDe(avant.reussi), dans);
    pousser(segments, "texte", ` inversé (${inversion}) ${SIGNES.fleche} `, dans);
  }
  const explosions = essai.explosions.length > 0 ? ` explose, ${essai.explosions.map((ajout) => `+ ${ajout}`).join(" explose, ")}` : "";
  const valeur = `${ecrireValeur(premier)}${explosions}`;
  if (inacheve) return pousser(segments, "texte", valeur, dans);
  const addition = essai.explosions.length > 0 ? ` = ${ecrireValeur(total)}` : "";
  pousser(segments, "texte", `${valeur}${addition} `, dans);
  return pousser(segments, ...signeDuDe(reussi), dans);
}

// Les sources des dés que la palette a touchés, prises dans l'ordre des dés :
// le k-ième dé inversé du jet l'a été par le k-ième effet « inverser » de son
// rang, de même pour les relances. Sans effet (un geste écrit à la main), « ? ».
function sourcesDesDes(etat, effets) {
  const suivante = (genre) => {
    const siens = effets.filter((effet) => effet.genre === genre);
    let rang = 0;
    return () => {
      const effet = siens[rang] ?? null;
      rang += 1;
      return effet === null ? "?" : sourceEtPrix(etat, effet);
    };
  };
  return { inversion: suivante("inverser"), relance: suivante("relancer") };
}

// Une place de la chaîne : ses essais, joints par « , relancé », séparateur
// du cadre qui n'est d'aucun dé ; une relance de la palette dit sa source
// (« , relancé (Minutie) »). Ses dés se comptent à partir de
// « premier ».
function segmentsDeLaPlace(jet, place, premier, inacheve = false, { tete = "", sources = sourcesDesDes(null, []) } = {}) {
  const segments = [];
  place.essais.forEach((essai, rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: essai.par === "palette" ? `, relancé (${sources.relance()}) ` : ", relancé ", jet: 0 });
    const inversion = essai.inverse === true ? sources.inversion() : "?";
    joindre(segments, segmentsDeLEssai(jet, essai, premier + rang, inacheve && rang === place.essais.length - 1, { tete: rang === 0 ? tete : "", inversion }));
  });
  return segments;
}

// Les dés d'un jet, dans leur cadre : les places jointes par « , », hors des
// dés ; un dé par essai, compté depuis le premier essai du jet ; la place du
// critique ouvre son premier dé par « 4e dé ». « enCours » laisse inachevé le
// dernier essai qui attend une explosion.
function segmentsDuCadre(jet, enCours = false, sources = sourcesDesDes(null, [])) {
  const explosionEnAttente = enCours && (jet.attente === "choix_explosion" || jet.attente === "de_explosion");
  const segments = [];
  let de = 0;
  jet.places.forEach((place, rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: ", ", jet: 0 });
    const tete = rang === REUSSITES_MAX ? `${ordinal(rang + 1)} dé ` : "";
    joindre(segments, segmentsDeLaPlace(jet, place, de, explosionEnAttente && rang === jet.places.length - 1, { tete, sources }));
    de += place.essais.length;
  });
  return segments;
}

/**
 * Une place de la chaîne (un élément de jet.places), valeurs modificateur
 * compris : « 7 ✓ » ; une relance, « 4 ✗, relancé 7 ✓ » ; un dé à
 * désavantage, ses lancers dans l'ordre où ils tombent puis le pire,
 * « 8/4 → 4 ✗ » ; une explosion, « 7 explose, + 6 explose, + 2 = 15 ✓ », où
 * chaque ajout est brut (le modificateur ne compte qu'une fois). Une valeur
 * passée sous zéro porte le moins de SIGNES : « 0/−1 → −1 ✗ », « −2 explose,
 * + 1 = −1 ✗ ». Sans le geste, la source d'un dé que la palette a touché
 * s'écrit « ? ».
 */
export function ecrirePlace(jet, place) {
  return texteDe(segmentsDeLaPlace(jet, place, 0));
}

// Le nombre saisi à la main pour les dégâts, et sa raison ; null sans saisie.
const ajustement = (geste) => (geste.degats?.operations ?? []).findLast((operation) => operation.op === "ajuster") ?? null;

// « dont 1 par Émincer » : les réussites que « +1 réussite » a ajoutées, et
// leurs sources dans l'ordre ; deux sources, « 1 par Émincer, 1 par MJ » ; la
// même deux fois, « 2 par MJ ». Celles qui passeraient trois ne comptent pas :
// les premières sources portent les réussites qui restent.
function reussitesAjoutees(etat, geste, bonus) {
  const comptes = [];
  for (const effet of effetsDeGenre(geste, "reussite").slice(0, bonus)) {
    const nom = sourceEtPrix(etat, effet);
    const deja = comptes.find((un) => un.nom === nom);
    if (deja) deja.nombre += 1;
    else comptes.push({ nom, nombre: 1 });
  }
  return comptes.map(({ nom, nombre }) => `${nombre} par ${nom}`).join(", ");
}

// Ce qui ouvre tout bilan : « aucune réussite », « 1 réussite », « 2 réussites » ;
// « 3 réussites (dont 1 par Émincer) » ; « coup critique ».
function reussitesDuBilan(etat, geste) {
  const { jet } = geste;
  if (critiqueReussi(jet)) return "coup critique";
  const nombre = reussites(jet);
  const tete = nombre === 0 ? "aucune réussite" : compter(nombre, "réussite");
  const ajoutees = nombre > reussitesDesPlaces(jet) ? reussitesAjoutees(etat, geste, nombre - reussitesDesPlaces(jet)) : "";
  return ajoutees === "" ? tete : `${tete} (dont ${ajoutees})`;
}

// Les opérations de la palette sur les dégâts (mission, § 7) : chacune avec sa
// source, puis le résultat qu'elle laisse ; des dégâts directs, leur nombre et
// leur destination.
const OPERATIONS = ["multiplier", "ajouter", "retrancher", "directs"];

function ecrireOperation(etape, source) {
  if (etape.genre === "multiplier") return `, ${FOIS}${etape.valeur} (${source}) : ${etape.resultat}`;
  if (etape.genre === "ajouter") return `, +${etape.valeur} (${source}) : ${etape.resultat}`;
  if (etape.genre === "retrancher") return `, ${SIGNES.moins}${etape.valeur} (${source}) : ${etape.resultat}`;
  return `, dégâts directs ${etape.nature === "corps" ? "au corps" : "à l'endurance"} : ${etape.valeur} (${source})`;
}

// Ce que la palette ajoute au bilan, dans cet ordre : ses opérations, dans
// l'ordre où elles se sont appliquées (degatsFixes les suit, et la k-ième étape
// d'un genre de la palette est le k-ième effet) ; dégrossir ; chaque « +N
// contre l'armure » ; chaque report.
function segmentsDeLaPalette(etat, geste, fixes) {
  const effets = effetsDeGenre(geste, ...OPERATIONS);
  const operations = fixes.etapes.filter((etape) => OPERATIONS.includes(etape.genre));
  const textes = operations.map((etape, rang) => ecrireOperation(etape, effets[rang] ? sourceEtPrix(etat, effets[rang]) : nomDeSource(etat, etape.source)));
  if (fixes.surplus !== 0) textes.push(`, +${fixes.surplus} contre l'armure (${fixes.sourceDuSurplus})`);
  for (const effet of effetsDeGenre(geste, "armure")) textes.push(`, +${effet.n} contre l'armure (${sourceEtPrix(etat, effet)})`);
  for (const effet of effetsDeGenre(geste, "reporter")) textes.push(`, reportés sur ${court(etat, effet.sur)} (${sourceEtPrix(etat, effet)})`);
  return enTexte(textes.join(""));
}

// « Toute la case » (mission, § 4.6 et § 4.9) : à la fin du bilan de la
// première cible, avec sa source et le prix d'un passif, comme les autres
// parenthèses d'effet : « , toute la case (Frappe) ». Elle s'écrit même si la
// palette fait ensuite manquer le jet : les cibles restent. Gabarit à
// confirmer.
const ecrireTouteLaCase = (etat, geste) => effetsDeGenre(geste, "toute_la_case").map((effet) => `, toute la case (${sourceEtPrix(etat, effet)})`).join("");

// Le bilan en segments : du texte, sauf chaque « {L} = {v} » (lettre) et le
// seul nombre qui suit « ajusté à » (ajuste) ; « toute la case » le finit.
function segmentsDuBilan(etat, geste) {
  const tete = reussitesDuBilan(etat, geste);
  if (geste.jet.genre === "caracteristique") return enTexte(tete);
  return pousser(segmentsDesDegats(etat, geste, tete), "texte", ecrireTouteLaCase(etat, geste));
}

// Le bilan d'une attaque, d'une défense ou d'un jet prêté, sans « toute la
// case » : ses réussites (« tete »), puis ce qu'elles font.
function segmentsDesDegats(etat, geste, tete) {
  const { jet } = geste;
  const enDefense = jet.genre === "defense";
  if (reussitesDeLAttaque(jet.genre, reussites(jet)) === 0) return enTexte(`${tete}, ${enDefense ? "aucun dégât" : "manqué"}`);

  const fixes = degatsFixes(etat, geste);
  const saisie = ajustement(geste);
  // Les dégâts directs à la main : la nature de l'événement « degats » ; ceux
  // de la palette disent la leur parmi ses opérations.
  const directs = (geste.degats?.nature ?? "normaux") !== "normaux";
  const lettre = fixes.lettre === null ? "" : `${LETTRES[fixes.lettre]} = ${fixes.deBase}`;
  const recoit = enDefense ? `${court(etat, jet.lanceur)} reçoit ` : "";

  // Une défense contre une attaque sans dégâts propres, aux dégâts saisis :
  // ce que reçoit le PJ est le nombre saisi, et la phrase le dit d'un trait,
  // sans « ajusté à ».
  if (fixes.base === "aucun" && enDefense && saisie !== null && !directs) {
    return joindre(enTexte(`${tete}, ${recoit}${saisie.valeur} (à la main : ${saisie.raison})`), segmentsDeLaPalette(etat, geste, fixes));
  }

  const segments = enTexte(`${tete}, `);
  if (fixes.base === "lettre") pousser(pousser(segments, "texte", recoit), "lettre", lettre);
  else if (fixes.base === "arme") pousser(pousser(segments, "texte", "touché, dégâts de l'arme : "), "lettre", lettre);
  else pousser(segments, "texte", "touché");
  // Le coup critique double la lettre, avant tout le reste.
  const double = fixes.etapes.find((etape) => etape.genre === "critique") ?? null;
  if (double !== null) pousser(segments, "texte", `, doublés : ${double.resultat}`);
  if (saisie !== null && directs) pousser(segments, "texte", `, dégâts directs ${geste.degats.nature === "corps" ? "au corps" : "à l'endurance"} : ${saisie.valeur} (${saisie.raison})`);
  else if (saisie !== null) pousser(pousser(pousser(segments, "texte", ", ajusté à "), "ajuste", `${saisie.valeur}`), "texte", ` (${saisie.raison})`);
  return joindre(segments, segmentsDeLaPalette(etat, geste, fixes));
}

/**
 * Le bilan d'un jet, sans son point : « 2 réussites, B = 8, ajusté à 22
 * (Émincer), +2 contre l'armure (Réduction) » ; « aucune réussite, manqué » ;
 * « 1 réussite, Aubépine reçoit B = 12 » ; « 3 réussites, aucun dégât ». Au
 * groupe 3 : « coup critique, C = 8, doublés : 16 » ; « 3 réussites (dont 1
 * par Émincer), C = 13 » ; « 2 réussites, B = 8, ×2 (Flambage) : 16, +2
 * contre l'armure (Minutie), reportés sur Chef (Nez fin) ».
 *
 * Deux nombres s'y écrivent, qu'il ne faut pas confondre : après une lettre,
 * les dégâts de cette lettre, avant toute opération ; après « ajusté à »,
 * « reçoit … (à la main » et « dégâts directs », le nombre saisi.
 */
export function ecrireBilan(etat, geste) {
  return texteDe(segmentsDuBilan(etat, geste));
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

// Ce qui précède le cadre : qui lance sa défense, le dé et ses
// caractéristiques, la difficulté et sa parenthèse, le net, la flèche. Rien
// n'y bouge une fois le jet ouvert.
function avantLeCadre(etat, jet) {
  const prefixe = jet.genre === "defense" ? `${court(etat, jet.lanceur)} lance sa défense, ` : "";
  const caracteristiques = jet.caracteristiques ? ` (${jet.caracteristiques.map(nomDeCaracteristique).join(" + ")})` : "";
  return `${prefixe}${ecrireDe(jet)}${caracteristiques} contre ${jet.difficulte}${parentheseDeLaDifficulte(jet)}${netDuJet(jet)} ${SIGNES.fleche} `;
}

// La phrase du jet, en segments. « jusqua » l'arrête plus tôt, pour la ligne
// en cours : « cadre » après le dernier dé lancé, « reussites » après le
// compte des réussites (les dégâts peuvent encore changer).
function segmentsDuJet(etat, geste, jusqua = null) {
  const { jet } = geste;
  const segments = enTexte(avantLeCadre(etat, jet));
  joindre(segments, segmentsDuCadre(jet, jusqua === "cadre", sourcesDesDes(etat, effetsDuRang(geste))));
  if (jusqua === "cadre") return segments;
  if (jusqua === "reussites") return pousser(segments, "texte", ` : ${reussitesDuBilan(etat, geste)}`);
  return pousser(joindre(pousser(segments, "texte", " : "), segmentsDuBilan(etat, geste)), "texte", ".");
}

/**
 * La phrase du jet : « d10+1 contre 5, 1 désavantage → 7/10 → 7 ✓, 9/3 → 3 ✗ :
 * 1 réussite, A = 3, +1 contre l'armure (Réduction). » Quand un adversaire
 * attaque, c'est le PJ visé qui lance : « Aubépine lance sa défense, d8+1
 * contre 5 → … ». Les caractéristiques d'un dé au choix s'écrivent dans
 * l'ordre où le jet les garde, que le moteur a rangé. Au groupe 3, le cadre
 * porte le 4e dé du critique (« 7 ✓, 4e dé 6 ✓ »), un dé inversé (« 3 ✗
 * inversé (Nez fin, 1 souffle) → 8 ✓ ») et une relance de la palette (« 4 ✗,
 * relancé (Minutie) 6 ✓ »).
 */
export function ecrireJet(etat, geste) {
  return texteDe(segmentsDuJet(etat, geste));
}

// ─── La localisation, les interventions, les dégâts ─────────────────────────

// Les d20 lancés d'un geste (contrat, § 5.3 et § 5.4), dans l'ordre : le dé
// brut, son décalage, la zone que la palette a choisie, et ce qu'en lit
// localisationsDuGeste, report compris : la face de contre-attaque du jeté, ou
// la face et la zone sur la grille de la victime.
function d20DuGeste(etat, geste) {
  return localisationsDuGeste(etat, geste).map((lu, rang) => {
    const { brut, decalage = null, choisie = null } = geste.localisation[rang];
    return { rang, brut, decalage, choisie: lu.contre || choisie?.zone !== lu.zone ? null : choisie, ...lu };
  });
}

// La source d'une zone choisie : le dernier effet « zone » du rang sur ce
// d20 (son prix compris), sinon la source que garde le d20.
function sourceDuChoix(etat, geste, { rang, choisie }) {
  const effet = effetsDeGenre(geste, "zone").findLast((un) => un.de === rang) ?? null;
  return effet === null ? nomDeSource(etat, choisie.source) : sourceEtPrix(etat, effet);
}

// Un d20 : « 14 : jambe droite » ; décalé, « 14, décalée à 12 (Minutie) :
// jambe gauche » ; sa zone choisie, « 14, zone choisie (MJ) : torse » ; la
// face de contre-attaque se lit sur le dé brut. La zone est celle de la
// victime.
function ecrireD20(etat, geste, d20, separateur) {
  const { brut, decalage, choisie, contre, face, zone } = d20;
  if (contre) return `${brut}${separateur}contre-attaque, l'attaque est annulée`;
  const decalee = decalage !== null && decalage.valeur !== 0 ? `, décalée à ${face} (${decalage.raison})` : "";
  const choix = choisie === null ? "" : `, zone choisie (${sourceDuChoix(etat, geste, d20)})`;
  return `${brut}${decalee}${choix}${separateur}${minuscule(zoneDe(etat, victimeDe(geste), zone))}`;
}

// « Localisation d20 → », « Localisation 2 d20 → » : le nombre est celui des
// d20 du geste, écrit à partir de deux.
const enteteDeLocalisation = (etat, geste) => {
  const nombre = nombreDeD20(etat, geste);
  return `Localisation ${nombre > 1 ? `${nombre} ` : ""}d20 ${SIGNES.fleche} `;
};

/**
 * « Localisation d20 → 14 : jambe droite. » ; avec plusieurs dés,
 * « Localisation 2 d20 → 6 : torse ; 13 : jambe gauche. » ; une zone choisie
 * par la palette, « Localisation d20 → 14, zone choisie (Minutie) : torse. »
 * Le nombre est celui des d20 du geste ; les dés écrits sont ceux qui ont été
 * lancés (une face de contre-attaque arrête les suivants). null tant qu'aucun
 * d20 n'est lancé.
 */
export function ecrireLocalisation(etat, geste) {
  const lances = d20DuGeste(etat, geste);
  if (lances.length === 0) return null;
  return `${enteteDeLocalisation(etat, geste)}${lances.map((d20) => ecrireD20(etat, geste, d20, " : ")).join(" ; ")}.`;
}

// L'esquive : « Aubépine intervient : Pas de côté (1 action, 3 souffle),
// 12 → 9. » (voir ecrireIntervention).
function ecrireEsquive(etat, geste, intervention) {
  const annule = (une) => (une.effet?.genre === "annuler" ? une.effet.x : 0);
  const toutes = liste(geste.interventions);
  const rang = toutes.indexOf(intervention);
  const deja = somme(toutes.slice(0, Math.max(0, rang)).map(annule));

  const { avant: entiers } = degatsFixes(etat, geste);
  const avantElle = imputerEsquive(entiers, deja);
  const apresElle = imputerEsquive(entiers, deja + annule(intervention));
  const plusieurs = nombreDeD20(etat, geste) > 1;
  const victime = victimeDe(geste);
  const coups = d20DuGeste(etat, geste)
    .filter((d20) => !d20.contre)
    .map(({ zone }, coup) => ({ zone, avant: avantElle[coup], apres: apresElle[coup] }))
    .filter(({ avant, apres }) => avant !== apres)
    .map(({ zone, avant, apres }) => `${plusieurs ? `${minuscule(zoneDe(etat, victime, zone))} ` : ""}${avant} ${SIGNES.fleche} ${apres}`);

  const nom = capaciteDe(etat, intervention.qui, intervention.capacite)?.nom ?? "";
  const prix = `${compter(intervention.prix?.actions ?? 0, "action")}, ${intervention.prix?.souffle ?? 0} souffle`;
  return `${court(etat, intervention.qui)} intervient : ${nom} (${prix})${coups.map((coup) => `, ${coup}`).join("")}.`;
}

/**
 * Une intervention du geste, en texte. L'esquive : « Aubépine intervient : Pas
 * de côté (1 action, 3 souffle), 12 → 9. » Dès que le geste a plusieurs d20,
 * chaque coup qu'elle change porte sa zone : « …, torse 10 → 0, jambe gauche
 * 10 → 8. » L'esquive est l'une de celles du geste : ce qu'elle annule
 * s'impute après celles qui la précèdent. Une intervention jouée
 * ({ geste }) : ses phrases, comme dans la ligne (« Aubépine intervient :
 * Frappe (1 action) contre Aubépine. … »).
 */
export function ecrireIntervention(etat, geste, intervention) {
  if ((intervention?.geste ?? null) === null) return ecrireEsquive(etat, geste, intervention);
  return phrasesDuBloc(etat, intervention.geste, { emboite: true, nommer: false })
    .map((phrase) => texteDe(phrase.segments))
    .join(" ");
}

/**
 * Ce que le coup a changé, et cela seul, dans l'ordre armure, endurance,
 * corps : « Armure 5 → 0, endurance 5 → 0, corps 10 → 0. » Dès que le geste
 * a plusieurs d20, chaque coup porte sa zone : « Torse : armure 30 → 19.
 * Jambe gauche : armure 15 → 4. » null si rien n'a changé.
 *
 * Au groupe 3, les dégâts appliqués à un autre que la cible (un report), et
 * tous ceux d'une ligne qui en a deux bilans (« nommer », une intervention ou
 * une contre-attaque qui fait des dégâts), commencent par le nom de qui les
 * reçoit : « Chef : armure 8 → 0, endurance 5 → 3. » ; sur plusieurs zones,
 * « Chef, torse : … ». Les zones sont celles de la victime.
 */
export function ecrireDegats(etat, geste, { nommer = false } = {}) {
  const victime = victimeDe(geste);
  const avecNom = nommer === true || victime !== (geste.cible ?? null);
  const plusieurs = nombreDeD20(etat, geste) > 1;
  const phrases = [];
  for (const coup of geste.resultat?.coups ?? []) {
    const changements = [
      ["armure", coup.armure],
      ["endurance", coup.resistance],
      ["corps", coup.corps],
    ]
      .filter(([, [avant, apres]]) => avant !== apres)
      .map(([nom, [avant, apres]]) => `${nom} ${avant} ${SIGNES.fleche} ${apres}`)
      .join(", ");
    if (changements === "") continue;
    const zone = zoneDe(etat, victime, coup.zone);
    if (avecNom) phrases.push(`${court(etat, victime)}${plusieurs ? `, ${minuscule(zone)}` : ""} : ${changements}.`);
    else phrases.push(plusieurs ? `${majuscule(zone)} : ${changements}.` : `${majuscule(changements)}.`);
  }
  return phrases.length === 0 ? null : phrases.join(" ");
}

// Le nom d'un état : sa capacité figée, ou son texte libre entre guillemets.
const nomDeLEtat = ({ capacite = null, libre = null } = {}) => capacite?.nom ?? entreGuillemets(libre ?? "");

/**
 * Une phrase par zone blessée, dans l'ordre des dés (mission, § 4.10) : pour
 * un PJ, la blessure choisie, « Blessure (bras gauche) : Main brûlée. », ou
 * un état libre, « Blessure (bras gauche) : « Doigt entaillé » (état libre). » ;
 * pour un adversaire, « Blessure (jambe droite), sans effet calculé. ». null
 * sans blessure, ou si le coup tue. La victime est celle des coups.
 */
export function ecrireBlessures(etat, geste) {
  const { resultat } = geste;
  if (!resultat || resultat.mort) return null;
  const victime = victimeDe(geste);
  const zone = (indice) => minuscule(zoneDe(etat, victime, indice));
  const phrases =
    campDe(etat, victime) === "pj"
      ? liste(geste.blessures).map((blessure) => `Blessure (${zone(blessure.zone)}) : ${blessure.capacite ? blessure.capacite.nom : `${nomDeLEtat(blessure)} (état libre)`}.`)
      : liste(resultat.coups)
          .filter((coup) => coup.blessure)
          .map((coup) => `Blessure (${zone(coup.zone)}), sans effet calculé.`);
  return phrases.length === 0 ? null : phrases.join(" ");
}

/** « Marmiton n° 2 meurt. » ; null si le coup ne tue pas. C'est la victime qui meurt. */
export function ecrireMort(etat, geste) {
  return geste.resultat?.mort ? `${court(etat, victimeDe(geste))} meurt.` : null;
}

// ─── La contre-attaque ──────────────────────────────────────────────────────

// Pourquoi le jeté ne peut pas contre-attaquer (contrat, § 6.4).
function raisonDuRefus(etat, geste, contre) {
  if (contre.raison === "action") return "plus d'action";
  if (contre.raison === "portee") return `${court(etat, geste.acteur)} est hors de portée ${deNom(contre.arme ?? "?")}`;
  return "aucune arme";
}

/**
 * La contre-attaque que le jeté n'a pas jouée, après la localisation qui
 * annule : « Aubépine ne contre-attaque pas. » ; « Aubépine ne peut pas
 * contre-attaquer : Marmiton n° 3 est hors de portée de Couteau d'office. » ;
 * « … : plus d'action. » ; « … : aucune arme. ». null sans contre-attaque, et
 * pour une contre-attaque jouée, qui écrit ses propres phrases.
 */
export function ecrireContre(etat, geste) {
  const contre = geste.contre ?? null;
  if (contre === null || contre.statut === "jouee") return null;
  const jete = court(etat, geste.cible);
  return contre.statut === "laissee" ? `${jete} ne contre-attaque pas.` : `${jete} ne peut pas contre-attaquer : ${raisonDuRefus(etat, geste, contre)}.`;
}

// ─── Les effets ─────────────────────────────────────────────────────────────

/**
 * La durée d'un effet : « pour ce jet », « jusqu'à la fin du combat », ou
 * « jusqu'au prochain tour d'Aubépine », son auteur (convention 15) ; sans
 * auteur (le MJ hors d'un geste), « jusqu'au prochain tour des PJ », le camp
 * qui jouait.
 */
export function ecrireDuree(etat, duree, auteur = null, camp = null) {
  if (duree === "jet") return "pour ce jet";
  if (duree === "combat") return "jusqu'à la fin du combat";
  return auteur === null ? `jusqu'au prochain tour des ${CAMPS[camp] ?? ""}` : `jusqu'au prochain tour ${deNom(court(etat, auteur))}`;
}

const dureeDe = (etat, effet) => ecrireDuree(etat, effet.duree, effet.auteur ?? null, effet.camp ?? null);

// Rendre : « Aubépine : souffle 4 → 7 (Minutie). » ; armure et
// endurance avec leur zone, « Aubépine, torse : endurance 2 → 5 (…). » ; le
// lien avec son primordial, « Aubépine : lien de Grand Four 0 → 1 (…). »
function ecrireRendre(etat, effet) {
  const dansUneZone = effet.ressource === "armure" || effet.ressource === "endurance";
  const qui = `${court(etat, effet.sur)}${dansUneZone ? `, ${minuscule(zoneDe(etat, effet.sur, effet.zone))}` : ""}`;
  const quoi = effet.ressource === "lien" ? `lien ${deNom(jaugeDe(etat, effet.sur, effet.jauge))}` : effet.ressource;
  return `${qui} : ${quoi} ${ecrireNombre(effet.avant)} ${SIGNES.fleche} ${ecrireNombre(effet.apres)} (${sourceEtPrix(etat, effet)}).`;
}

// ±N : chez un adversaire, sa valeur avant et après (« Attaque de Marmiton
// n° 3 : 4 → 2 (Taloche), … ») ; chez un personnage, N à chaque dé
// (« Défense d'Aubépine : −1 à chaque dé (Cheville tordue), … »). « valeurs »,
// [avant, après], quand l'effet ne les porte pas (hors d'un geste, lues sur
// l'état d'avant et d'après).
function ecrireEcart(etat, effet, valeurs = null) {
  const tete = `${effet.genre === "attaque" ? "Attaque" : "Défense"} ${deNom(court(etat, effet.sur))} : `;
  const fin = `(${sourceEtPrix(etat, effet)}), ${dureeDe(etat, effet)}.`;
  if (campDe(etat, effet.sur) === "pj") return `${tete}${signer(effet.n)} à chaque dé ${fin}`;
  const [avant, apres] = Number.isInteger(effet.avant) && Number.isInteger(effet.apres) ? [effet.avant, effet.apres] : (valeurs ?? [null, null]);
  return `${tete}${ecrireNombre(avant)} ${SIGNES.fleche} ${ecrireNombre(apres)} ${fin}`;
}

// Un état : « Marmiton n° 2 : état Étourdi (Taloche), jusqu'au prochain
// tour d'Aubépine. » ; libre, « Aubépine : état « Couvert de farine » (MJ),
// … ».
const ecrireEtat = (etat, effet) => `${court(etat, effet.sur)} : état ${nomDeLEtat(effet)} (${sourceEtPrix(etat, effet)}), ${dureeDe(etat, effet)}.`;

// Déplacer : « Marmiton n° 2 : déplacé, D4 → D5, sans action (Taloche). »
const ecrireDeplacement = (etat, effet) =>
  `${court(etat, effet.sur)} : déplacé, ${effet.depart ?? "?"} ${SIGNES.fleche} ${effet.vers}, sans action (${sourceEtPrix(etat, effet)}).`;

// Les effets qui ont leur phrase, et le genre de cette phrase ; les autres
// s'écrivent dans le jet, la localisation ou le bilan (« toute la case » à la
// fin du bilan de la première cible), ou dans la ligne de l'attaque qui la
// prend (l'attaque en plus).
const PHRASES_D_EFFET = {
  rendre: { genre: "effet", ecrire: ecrireRendre },
  attaque: { genre: "effet", ecrire: ecrireEcart },
  defense: { genre: "effet", ecrire: ecrireEcart },
  etat: { genre: "etat", ecrire: ecrireEtat },
  deplacer: { genre: "effet", ecrire: ecrireDeplacement },
};

/**
 * La phrase d'un effet (mission, § 7) : rendre, ±N, un état, un déplacement
 * sans action ; null pour un effet qui n'a pas la sienne. « valeurs » :
 * l'attaque ou la défense d'un adversaire, avant et après, quand l'effet ne
 * les porte pas.
 */
export function ecrireEffet(etat, effet, valeurs = null) {
  return Object.hasOwn(PHRASES_D_EFFET, effet?.genre ?? "") ? PHRASES_D_EFFET[effet.genre].ecrire(etat, effet, valeurs) : null;
}

// Les phrases d'effet d'un geste : « avant », celles « pour ce jet », qui ne
// s'appliquent qu'avant le premier dé ; « apres », les autres.
function phrasesDEffets(etat, geste, quand) {
  return effetsDuRang(geste)
    .filter((effet) => Object.hasOwn(PHRASES_D_EFFET, effet.genre) && (effet.duree === "jet") === (quand === "avant"))
    .map((effet) => ({ genre: PHRASES_D_EFFET[effet.genre].genre, segments: enTexte(ecrireEffet(etat, effet)) }));
}

// ─── L'échéance ─────────────────────────────────────────────────────────────

// L'attaque ou la défense d'un adversaire autour du départ de cet effet. L'état
// lu porte encore tous les effets qui partent à cette échéance (contrat, § 3) :
// ceux qui le précèdent dans etat.effets, partis avant lui, ne comptent plus.
function valeursALEcheance(etat, effet) {
  const lue = (effet.valeur === "attaque" ? attaqueDe : defenseDe)(etat, effet.porteur).valeur;
  if (lue === null) return [null, null];
  const effets = liste(etat.effets);
  const partis = effets
    .slice(0, Math.max(0, effets.indexOf(effet)))
    .filter((autre) => autre.genre === "modif" && autre.porteur === effet.porteur && autre.valeur === effet.valeur && autre.duree === "tour" && autre.camp === effet.camp);
  const avant = lue - somme(partis.map((autre) => autre.n));
  return [avant, avant - effet.n];
}

/**
 * La ligne d'une échéance (convention 15), juste après « — Tour … — », lue
 * sur l'état qui porte encore l'effet : « Fin de Taloche pour Marmiton
 * n° 3 : attaque 2 → 4. » ; « Fin de Cheville tordue pour Aubépine : plus de
 * −1 à chaque dé de défense. » ; « Fin de l'état Étourdi pour Marmiton
 * n° 2. » ; « Fin de Guetter pour Aubépine : Taloche [1] n'est plus
 * gardée. » ; « Fin de Flambage pour Aubépine : plus d'attaque en plus. »
 */
export function ecrireEcheance(etat, effet) {
  const porteur = court(etat, effet.porteur);
  if (effet.genre === "etat") return `Fin de l'état ${nomDeLEtat(effet)} pour ${porteur}.`;
  const tete = `Fin ${deNom(nomDeSource(etat, effet.source))} pour ${porteur}`;
  if (effet.genre === "guet") return `${tete} : ${nomDeLaLigne(etat, effet.porteur, effet.garde)} n'est plus gardée.`;
  if (effet.genre === "attaque_en_plus") return `${tete} : plus d'attaque en plus.`;
  const valeur = effet.valeur === "attaque" ? "attaque" : "défense";
  if (campDe(etat, effet.porteur) === "pj") return `${tete} : plus de ${signer(effet.n)} à chaque dé ${deNom(valeur)}.`;
  const [avant, apres] = valeursALEcheance(etat, effet);
  return `${tete} : ${valeur} ${ecrireNombre(avant)} ${SIGNES.fleche} ${ecrireNombre(apres)}.`;
}

// ─── Le MJ ──────────────────────────────────────────────────────────────────

// Le nom des valeurs que change « Modifier une valeur… » (mission, § 7) ; le
// lien, l'armure et l'endurance se nomment avec leur jauge ou leur zone.
const NOMS_DES_VALEURS = {
  attaque: "attaque",
  defense: "défense",
  souffle: "souffle",
  souffleMax: "souffle maximum",
  actions: "actions",
  actionsMax: "actions maximum",
  corps: "corps",
  bouclier: "défense du bouclier",
};

const enZone = (champ) => champ === "armure" || champ === "endurance";

// Une valeur d'un protagoniste, lue sur un état : le courant, et, pour le
// bouclier, sa photographie quand le MJ ne l'a pas changé.
function lireLaValeur(etat, qui, { champ, zone, jauge }) {
  const courant = courantDe(etat, qui);
  if (courant === null) return null;
  if (champ === "lien") return courant.liens?.[jauge]?.points ?? null;
  if (champ === "armure") return courant.zones?.[zone]?.armure ?? null;
  if (champ === "endurance") return courant.zones?.[zone]?.resistance ?? null;
  if (champ === "bouclier") return courant.bouclier ?? photoDe(etat, qui)?.bouclier?.defense ?? null;
  return courant[champ] ?? null;
}

// Le nom d'une valeur et de son protagoniste : « défense de Marmiton n° 2 »,
// « lien de Grand Four d'Aubépine » ; d'une zone, « Aubépine, torse :
// armure ».
function nommerLaValeur(etat, qui, { champ, zone, jauge }) {
  if (enZone(champ)) return `${court(etat, qui)}, ${minuscule(zoneDe(etat, qui, zone))} : ${champ}`;
  const nom = champ === "lien" ? `lien ${deNom(jaugeDe(etat, qui, jauge))}` : (NOMS_DES_VALEURS[champ] ?? champ);
  return `${nom} ${deNom(court(etat, qui))}`;
}

// La phrase d'une valeur changée, sans « MJ : » : « défense de Marmiton
// n° 2 : 4 → 6. » ; « Aubépine, torse : armure 10 → 4. » ; null si elle n'a
// pas changé.
function phraseDeValeur(avant, apres, qui, entree) {
  const [a, b] = [lireLaValeur(avant, qui, entree), lireLaValeur(apres, qui, entree)];
  if (a === b) return null;
  const separateur = enZone(entree.champ) ? " " : " : ";
  return `${nommerLaValeur(avant, qui, entree)}${separateur}${ecrireNombre(a)} ${SIGNES.fleche} ${ecrireNombre(b)}.`;
}

// Un maximum descendu sous la valeur courante l'entraîne (contrat, § 6.3) :
// la valeur entraînée a sa phrase, après celle du maximum, si le MJ ne l'a
// pas posée lui-même.
const ENTRAINEES = { souffleMax: "souffle", actionsMax: "actions" };

function phrasesDesValeurs(avant, apres, { qui, valeurs }) {
  const entrees = liste(valeurs);
  return entrees.flatMap((entree) => {
    const entrainee = ENTRAINEES[entree.champ] ?? null;
    const aussi = entrainee !== null && !entrees.some((autre) => autre.champ === entrainee) ? [{ champ: entrainee }] : [];
    return [entree, ...aussi].map((une) => phraseDeValeur(avant, apres, qui, une)).filter((phrase) => phrase !== null);
  });
}

// Un changement d'équipement, sans « MJ : » : l'arme tenue, la qualité d'un
// objet, la cellule Équipement d'un adversaire.
function phraseDuChangement(etat, qui, changement) {
  const nom = court(etat, qui);
  if (changement.genre === "arme") return changement.nom === null ? `${nom} ne tient aucune arme.` : `${nom} tient ${changement.nom}.`;
  if (changement.genre === "qualite") {
    return `qualité ${deNom(changement.objet)} ${deNom(nom)} : ${changement.avant ?? "aucune"} ${SIGNES.fleche} ${changement.apres ?? "aucune"}.`;
  }
  const noms = liste(changement.noms);
  return `équipement ${deNom(nom)} : ${noms.length === 0 ? "aucun" : noms.join(", ")}.`;
}

// Ce que chaque geste du MJ écrit, une phrase par chose changée, chacune sans
// son « MJ : ». « avant » est l'état d'avant le geste, « apres » celui d'après.
const ECRITS_DU_MJ = {
  valeurs: phrasesDesValeurs,
  equipement: (avant, apres, { qui, changements }) => liste(changements).map((changement) => phraseDuChangement(avant, qui, changement)),
  etat(avant, apres, { qui, ajout, retrait }) {
    if (retrait === undefined) return [`état ${nomDeLEtat(ajout)} sur ${court(avant, qui)}, ${ecrireDuree(avant, ajout?.duree, null, avant.tour?.camp)}.`];
    const parti = liste(avant.effets).find((effet) => effet.id === retrait) ?? {};
    return [`état ${nomDeLEtat(parti)} retiré ${deNom(court(avant, qui))}.`];
  },
  deplacer: (avant, apres, { qui, vers }) => [`${court(avant, qui)}, ${courantDe(avant, qui)?.case ?? "?"} ${SIGNES.fleche} ${vers}, sans action.`],
  retirer: (avant, apres, { qui }) => [`${court(avant, qui)} quitte le combat.`],
};

/**
 * Les phrases d'un geste du MJ (mission, § 4.8 et § 7), chacune ouverte par
 * « MJ : » : « MJ : défense de Marmiton n° 2 : 4 → 6. » ; « MJ : Aubépine,
 * torse : armure 10 → 4. » ; « MJ : Aubépine tient Couteau d'office. » ;
 * « MJ : qualité de Couvercle de marmite d'Aubépine : 2 → 3. » ; « MJ :
 * équipement de Marmiton n° 2 : Spatule souple. » ; « MJ : état
 * Étourdi sur Marmiton n° 2, jusqu'à la fin du combat. » ; « MJ : état
 * Étourdi retiré de Marmiton n° 2. » ; « MJ : Marmiton n° 2, D4 → D5, sans
 * action. » ; « MJ : Marmiton n° 2 quitte le combat. » Une phrase par valeur
 * changée ; aucune valeur changée (ce que l'offre refuse), le nom du geste.
 */
export function phrasesDuMj(avant, apres, evenement) {
  const ecrites = Object.hasOwn(ECRITS_DU_MJ, evenement?.genre ?? "") ? ECRITS_DU_MJ[evenement.genre](avant, apres, evenement) : [];
  return (ecrites.length === 0 ? [`${nommerLeGesteDuMj(avant, evenement)}.`] : ecrites).map((phrase) => `MJ : ${phrase}`);
}

// Le nom d'un geste du MJ, pour sa ligne « Annulé » : « défense de Marmiton
// n° 2 » (une valeur), « valeurs de … » (plusieurs), « équipement de … »,
// « état de … », « déplacement de … », « retrait de … ».
function nommerLeGesteDuMj(etat, evenement) {
  const qui = court(etat, evenement?.qui);
  const valeurs = liste(evenement?.valeurs);
  if (evenement?.genre === "valeurs") return valeurs.length === 1 ? nommerLaValeur(etat, evenement.qui, valeurs[0]) : `valeurs ${deNom(qui)}`;
  if (evenement?.genre === "equipement") return `équipement ${deNom(qui)}`;
  if (evenement?.genre === "etat") return `état ${deNom(qui)}`;
  if (evenement?.genre === "deplacer") return `déplacement ${deNom(qui)}`;
  return `retrait ${deNom(qui)}`;
}

// ─── La ligne d'un geste ────────────────────────────────────────────────────

// Une phrase faite d'un texte, ou aucune si le texte est nul.
const phraseDeTexte = (genre, texte) => (texte === null ? [] : [{ genre, segments: enTexte(texte) }]);

// Le genre de la première phrase d'un geste : le sien pour un geste racine ;
// « intervention » ou « contre_attaque » pour un geste emboîté.
const genreDeTete = (geste, contexte, defaut) => (contexte.emboite ? (geste.genre ?? defaut) : defaut);

// Ce qui vient avant le premier dé, après l'ouverture (mission, § 7) : la
// phrase des sources, puis les effets « pour ce jet ».
const phrasesAvantLeJet = (etat, geste) => [...phraseDeTexte("sources", ecrireSources(geste.jet)), ...phrasesDEffets(etat, geste, "avant")];

// Le jet de caractéristique tient en une phrase : le début de l'ouverture,
// puis le jet, joints par une virgule. Quand une phrase vient avant son
// premier dé (les sources, un effet « pour ce jet »), le début fait sa propre
// phrase, close par un point, et le jet suit : « Aubépine : Goûter.
// Aubépine : état Étourdi (Goûter), pour ce jet. d8 (Sens) contre 6
// (compliqué) → … ». Ce gabarit reste à confirmer.
const debutAPart = (etat, geste) => geste.mode === "caracteristique" && phrasesAvantLeJet(etat, geste).length > 0;

const phraseDeCaracteristique = (etat, geste, contexte, jusqua = null) => ({
  genre: genreDeTete(geste, contexte, "jet"),
  segments: joindre(pousser(segmentsDuDebut(etat, geste), "texte", ", "), segmentsDuJet(etat, geste, jusqua)),
});

// Ce que la ligne d'un geste dit avant son jet : pour une attaque,
// l'ouverture, la phrase des sources, et les effets « pour ce jet » ; pour un
// jet de caractéristique, rien, son ouverture est dans la phrase du jet, sauf
// quand une phrase vient avant son premier dé : son début, puis elle.
function phrasesDeTete(etat, geste, contexte) {
  if (geste.mode !== "caracteristique") return [{ genre: genreDeTete(geste, contexte, "ouverture"), segments: segmentsDeLOuverture(etat, geste) }, ...phrasesAvantLeJet(etat, geste)];
  if (!debutAPart(etat, geste)) return [];
  return [{ genre: genreDeTete(geste, contexte, "ouverture"), segments: pousser(segmentsDuDebut(etat, geste), "texte", ".") }, ...phrasesAvantLeJet(etat, geste)];
}

// La phrase du jet, entière ou arrêtée plus tôt (voir segmentsDuJet).
const phraseDuJet = (etat, geste, contexte, jusqua = null) =>
  geste.mode === "caracteristique" && !debutAPart(etat, geste) ? phraseDeCaracteristique(etat, geste, contexte, jusqua) : { genre: "jet", segments: segmentsDuJet(etat, geste, jusqua) };

// Le geste et ceux qui s'y sont emboîtés, dans l'ordre de la ligne : sa
// contre-attaque jouée, ses interventions jouées, et ce qui s'est emboîté en
// elles.
function gestesDeLaLigne(geste) {
  const emboites = [...(geste.contre?.statut === "jouee" ? [geste.contre.geste] : []), ...liste(geste.interventions).flatMap((une) => (une?.geste ? [une.geste] : []))];
  return [geste, ...emboites.flatMap(gestesDeLaLigne)];
}

// Deux bilans de dégâts dans une ligne : chaque phrase de dégâts appliqués
// commence alors par le nom de qui les reçoit.
const nommerDansLaLigne = (etat, geste) => gestesDeLaLigne(geste).filter((un) => ecrireDegats(etat, un) !== null).length > 1;

// La contre-attaque, après la localisation qui annule : ses phrases, si elle
// est jouée ; sinon la phrase qui dit qu'elle ne l'est pas.
function phrasesDeLaContreAttaque(etat, geste, contexte) {
  const contre = geste.contre ?? null;
  if (contre === null) return [];
  if (contre.statut === "jouee") return phrasesDuBloc(etat, contre.geste, { ...contexte, emboite: true });
  return phraseDeTexte("contre_attaque", ecrireContre(etat, geste));
}

// Les interventions, dans leur ordre : l'esquive en une phrase ; une
// intervention jouée, ses phrases.
function phrasesDesInterventions(etat, geste, contexte) {
  return liste(geste.interventions).flatMap((intervention) =>
    intervention?.geste
      ? phrasesDuBloc(etat, intervention.geste, { ...contexte, emboite: true })
      : [{ genre: "intervention", segments: enTexte(ecrireEsquive(etat, geste, intervention)) }],
  );
}

// Les phrases d'un geste et de ce qui s'y emboîte, sans leur numéro.
// « contexte » : emboite (un geste emboîté : son nom en tête de sa phrase,
// qui prend son genre), nommer (les dégâts commencent par le nom de qui les
// reçoit). « arret » l'arrête plus tôt, pour la ligne en cours :
// « emboites », après la contre-attaque et les interventions ; « degats »,
// après les dégâts appliqués.
function phrasesDuBloc(etat, geste, contexte, { arret = null } = {}) {
  const avecJet = (geste.jet ?? null) !== null;
  if (geste.mode === "caracteristique" && avecJet) return [...phrasesDeTete(etat, geste, contexte), phraseDuJet(etat, geste, contexte), ...phrasesDEffets(etat, geste, "apres")];
  const ouverture = { genre: genreDeTete(geste, contexte, "ouverture"), segments: segmentsDeLOuverture(etat, geste) };
  if ((geste.mode !== "attaque" && geste.mode !== "jet_prete") || !avecJet) return [ouverture, ...phrasesDEffets(etat, geste, "avant"), ...phrasesDEffets(etat, geste, "apres")];

  const jusquAuxEmboites = [
    ...phrasesDeTete(etat, geste, contexte),
    phraseDuJet(etat, geste, contexte),
    ...phraseDeTexte("localisation", ecrireLocalisation(etat, geste)),
    ...phrasesDeLaContreAttaque(etat, geste, contexte),
    ...phrasesDesInterventions(etat, geste, contexte),
  ];
  if (arret === "emboites") return jusquAuxEmboites;
  const degats = [...jusquAuxEmboites, ...phraseDeTexte("degats", ecrireDegats(etat, geste, { nommer: contexte.nommer }))];
  if (arret === "degats") return degats;
  const mort = ecrireMort(etat, geste);
  return [
    ...degats,
    ...phraseDeTexte("blessures", ecrireBlessures(etat, geste)),
    ...phrasesDEffets(etat, geste, "apres"),
    ...(mort === null ? [] : [{ genre: "mort", segments: pousser([], "mort", mort) }]),
  ];
}

// Les phrases d'une ligne de geste, sans leur numéro.
const phrasesBrutes = (etat, geste) => phrasesDuBloc(etat, geste, { emboite: false, nommer: nommerDansLaLigne(etat, geste) });

// Des phrases brutes, numérotées dans leur ordre.
const numeroterLesPhrases = (phrases) => phrases.map(({ genre, segments }, rang) => ({ genre, segments: numeroter(segments, rang) }));

/**
 * Les phrases de la ligne d'un geste fini, dans l'ordre, chacune avec son
 * genre et ses segments : l'ouverture ; puis, pour un geste à jet d'attaque,
 * la phrase des sources, les effets « pour ce jet », le jet, la
 * localisation, la contre-attaque et les interventions (les phrases de chaque
 * geste emboîté, la première de son genre), les dégâts, les blessures, les
 * autres effets, la mort. Un jet de caractéristique tient en une phrase,
 * « jet », l'ouverture et le jet joints par une virgule ; quand la phrase des
 * sources ou un effet « pour ce jet » précède son premier dé, son ouverture
 * a sa phrase, puis viennent celles-là, puis le jet.
 */
export function phrasesDuGeste(etat, geste) {
  return numeroterLesPhrases(phrasesBrutes(etat, geste));
}

/**
 * Les phrases de la ligne d'un geste fini, en texte, chacune finie par un
 * point (voir phrasesDuGeste).
 */
export function segmentsDuGeste(etat, geste) {
  return phrasesDuGeste(etat, geste).map((phrase) => texteDe(phrase.segments));
}

/** La ligne de journal d'un geste fini : ses phrases, jointes par une espace. */
export function ligneDuGeste(etat, geste) {
  return segmentsDuGeste(etat, geste).join(" ");
}

// ─── La ligne en cours ──────────────────────────────────────────────────────

// Les phrases que le geste au sommet de la pile a déjà écrites pour de bon, la
// dernière pouvant n'être qu'un début ; null quand il n'y a rien à montrer.
function phrasesEnCoursDuGeste(etat, geste, contexte) {
  if (geste.mode !== "attaque" && geste.mode !== "jet_prete" && geste.mode !== "caracteristique") return null;
  const tete = phrasesDeTete(etat, geste, contexte);
  if (geste.moment === "jet" || geste.moment === "critique") return [...tete, phraseDuJet(etat, geste, contexte, "cadre")];
  if (geste.moment === "bilan") return [...tete, phraseDuJet(etat, geste, contexte, "reussites")];
  if (geste.moment === "contre_attaque") return phrasesDuBloc(etat, geste, contexte, { arret: "emboites" });
  if (geste.moment === "blessure") return phrasesDuBloc(etat, geste, contexte, { arret: "degats" });
  if (geste.moment !== "localisation" && geste.moment !== "suites") return null;

  // Le premier d20 a fermé le bilan : le jet est écrit en entier. Tant
  // qu'une face peut se décaler, la localisation s'arrête au premier dé brut ;
  // après une intervention, elle s'écrit entière, puis les interventions. Un
  // jet qui ne touche pas, ou de caractéristique, attend « Appliquer » sans
  // d20 (groupe 3) : comme au bilan, ses réussites seules.
  const lances = d20DuGeste(etat, geste);
  const jouees = liste(geste.interventions).length > 0;
  if (!jouees && lances.length === 0) return [...tete, phraseDuJet(etat, geste, contexte, "reussites")];
  if (!jouees) return [...tete, phraseDuJet(etat, geste, contexte), { genre: "localisation", segments: enTexte(`${enteteDeLocalisation(etat, geste)}${lances[0].brut}`) }];
  return phrasesDuBloc(etat, geste, contexte, { arret: "emboites" });
}

// Les phrases de la ligne en cours : celles des gestes du dessous de la pile,
// jusqu'à ce qui s'y est déjà emboîté, puis celles du geste au sommet s'il est
// payé et a un jet.
function phrasesEnCours(etat, pile) {
  const sommet = dernier(pile);
  const contexte = { nommer: nommerDansLaLigne(etat, pile[0]) };
  const enHaut = sommet.paye === true && (sommet.jet ?? null) !== null ? phrasesEnCoursDuGeste(etat, sommet, { ...contexte, emboite: pile.length > 1 }) : null;
  if (pile.length === 1) return enHaut;
  const dessous = pile.slice(0, -1).flatMap((geste, rang) => phrasesDuBloc(etat, geste, { ...contexte, emboite: rang > 0 }, { arret: "emboites" }));
  return [...dessous, ...(enHaut ?? [])];
}

/**
 * La ligne que le geste en cours écrira, telle qu'on la sait déjà : son début
 * exact, suivi de « … » (un segment « suite », hors phrase, sans espace
 * avant). null sans geste, avant le paiement du geste racine, et pour un
 * geste racine sans jet.
 *
 * Elle n'écrit que ce qui ne peut plus changer : pendant la chaîne (et au
 * choix du critique), l'ouverture, les sources et le jet jusqu'au dernier dé
 * lancé (un dé qui attend d'exploser, sans signe ni somme) ; au bilan, et
 * aux suites d'un jet qui ne touche pas ou de caractéristique, les
 * réussites seules ; à la localisation, et aux suites avant toute
 * intervention, le jet entier et le premier d20 brut ; après une
 * intervention, la localisation entière et les interventions ; à la
 * contre-attaque, la localisation qui annule ; au choix d'une blessure, les
 * dégâts appliqués. Un geste emboîté (une intervention, une contre-attaque)
 * prolonge la ligne de son geste racine : ce que celui-ci a écrit, puis ses
 * propres phrases.
 */
export function ligneEnCours(etat) {
  const pile = liste(etat?.pile);
  const racine = pile[0] ?? null;
  if (racine === null || racine.paye !== true || (racine.jet ?? null) === null) return null;
  const phrases = phrasesEnCours(etat, pile);
  return phrases === null || phrases.length === 0 ? null : assembler("geste", numeroterLesPhrases(phrases), { enCours: true }, { suite: true });
}

// ─── L'annulation ───────────────────────────────────────────────────────────

/**
 * Le nom d'un geste défait, ou à défaire (quoi : { genre: "capacite", geste },
 * { genre: "passer", qui } ou { genre: "fin_de_tour", camp } ; au groupe 3,
 * { genre: "mj", evenement } et { genre: "effet", effet }) :
 * « Aubépine — Taloche [1] », « Aubépine — passer son tour », « la fin du
 * tour des PJ », « MJ — défense de Marmiton n° 2 », « effet de Minutie sur
 * Aubépine ». Avec « detail », une capacité dit aussi sa cible,
 * comme son ouverture (« … contre Marmiton n° 2 »), ou, pour un déplacement,
 * son départ et son arrivée (« Aubépine — Pas chassé [1], C3 → D4 »). Un
 * geste emboîté se défait avec son geste racine, sous le nom de celui-ci.
 */
export function nommerLeGeste(etat, quoi, { detail = false } = {}) {
  if (quoi?.genre === "passer") return `${court(etat, quoi.qui)} ${SIGNES.tiret} passer son tour`;
  if (quoi?.genre === "fin_de_tour") return `la fin du tour des ${CAMPS[quoi.camp]}`;
  if (quoi?.genre === "mj") return `MJ ${SIGNES.tiret} ${nommerLeGesteDuMj(etat, quoi.evenement)}`;
  if (quoi?.genre === "effet") return `effet ${deNom(nomDeSource(etat, quoi.effet?.source))}${(quoi.effet?.sur ?? null) === null ? "" : ` sur ${court(etat, quoi.effet.sur)}`}`;
  const geste = quoi?.genre === "capacite" ? (quoi.geste ?? null) : null;
  if (geste === null) return "";
  const tete = `${court(etat, geste.acteur)} ${SIGNES.tiret} ${nomDeLaCapacite(etat, geste)}`;
  if (!detail) return tete;
  if (geste.mode === "deplacement") return `${tete}, ${geste.depart} ${SIGNES.fleche} ${geste.arrivee}`;
  return (geste.cible ?? null) === null ? tete : `${tete} ${lienALaCible(etat, geste)} ${court(etat, geste.cible)}`;
}

// ─── Les lignes, fabriquées ─────────────────────────────────────────────────

// Les valeurs d'un ±N hors d'un geste, lues sur l'état d'avant et d'après
// l'effet ; null pour un autre effet.
function valeursDeLEcart(avant, apres, effet) {
  if (effet?.genre !== "attaque" && effet?.genre !== "defense") return null;
  const lire = effet.genre === "attaque" ? attaqueDe : defenseDe;
  return [lire(avant, effet.sur).valeur, lire(apres, effet.sur).valeur];
}

// La ligne d'un geste du MJ : une phrase par chose changée, chacune ouverte
// par un segment « mj », « MJ : ».
function ligneDuMj(avant, apres, evenement) {
  const phrases = phrasesDuMj(avant, apres, evenement).map((phrase, rang) => ({
    genre: "mj",
    segments: numeroter(pousser(pousser([], "mj", "MJ : "), "texte", phrase.slice("MJ : ".length)), rang),
  }));
  return assembler("geste", phrases);
}

// La ligne d'un effet hors d'un geste : sa phrase.
function ligneDeLEffet(avant, apres, effet) {
  const texte = ecrireEffet(avant, effet, valeursDeLEcart(avant, apres, effet)) ?? `${majuscule(nommerLeGeste(avant, { genre: "effet", effet }))}.`;
  return assembler("geste", [{ genre: PHRASES_D_EFFET[effet?.genre]?.genre ?? "effet", segments: numeroter(enTexte(texte), 0) }]);
}

/**
 * Les fabriques des lignes du journal : chacune rend une ligne gelée,
 * { genre, texte, segments, phrases, mort?, barre? }, dont les segments
 * redonnent le texte au signe près. C'est par elles que le moteur écrit.
 *
 * - lancement(etat), tour(tour), finDeTour(camp), fin(vainqueur) : le cadre ;
 * - passe(etat, qui) : « Marmiton n° 2 passe son tour. » ;
 * - geste(etat, geste) : la ligne d'un geste fini (le geste racine et ce qui
 *   s'y est emboîté, ou une cible finie d'un geste à plusieurs cibles),
 *   « mort: true » quand l'un de ses coups tue ;
 * - echeance(etat, effet) : « Fin de … », lue sur l'état qui porte encore
 *   l'effet (genre « cadre ») ;
 * - mj(avant, apres, evenement) : « MJ : … », une phrase par chose changée ;
 * - effet(avant, apres, effet) : un effet hors d'un geste, sa phrase ;
 * - annulation(etat, quoi, plage) : « Annulé : Aubépine — Taloche [1]. »,
 *   « Annulé : MJ — défense de Marmiton n° 2. », « Annulé : effet de Minutie
 *   sur Aubépine. », qui ne réécrit aucune ligne : sa « barre »
 *   est la plage [début, fin) des lignes du geste défait, que l'écran barre.
 *   Une échéance ne s'annule pas seule : elle suit la fin de tour.
 */
export const lignes = Object.freeze({
  lancement: (etat) => ligneDUnTenant("cadre", "lancement", "texte", ligneDeLancement(etat)),
  tour: (tour) => ligneDUnTenant("tour", "tour", "tour", ligneDeTour(tour)),
  finDeTour: (camp) => ligneDUnTenant("cadre", "fin_de_tour", "fin_de_tour", ligneDeFinDeTour(camp)),
  fin: (vainqueur) => ligneDUnTenant("fin", "fin", "texte", ligneDeFin(vainqueur)),
  passe: (etat, qui) => assembler("geste", [{ genre: "passe", segments: numeroter(segmentsDeLaPasse(etat, qui), 0) }]),
  geste: (etat, geste) => assembler("geste", phrasesDuGeste(etat, geste), gestesDeLaLigne(geste).some((un) => un.resultat?.mort === true) ? { mort: true } : {}),
  echeance: (etat, effet) => ligneDUnTenant("cadre", "echeance", "echeance", ecrireEcheance(etat, effet)),
  mj: ligneDuMj,
  effet: ligneDeLEffet,
  annulation: (etat, quoi, plage) => assembler("annule", [{ genre: "annule", segments: numeroter(enTexte(`Annulé : ${nommerLeGeste(etat, quoi)}.`), 0) }], { barre: [plage[0], plage[1]] }),
});

// ─── Les annonces ───────────────────────────────────────────────────────────

// Les lignes que l'événement a écrites au journal. Le compte des lignes
// d'avant les donne exactement. Sans lui, l'état d'après ne laisse voir que la
// queue du journal : tout pour un lancement, depuis la ligne du geste pour un
// geste fini, depuis la dernière fin de tour pour une fin de tour demandée
// (celle-là seule quand une fin automatique l'a suivie), la ligne « Annulé »
// pour une annulation.
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
    case "annuler":
      return depuis("annule");
    case "confirmer":
    case "de":
    case "garder":
    case "appliquer":
      return gesteEnCours(etat) === null ? depuis("geste") : [];
    default:
      return [];
  }
}

// Le dé qui vient de tomber dans la chaîne : « 1er dé : 9, réussi. » ; sous
// désavantage, « 2e dé : 8 et 4, on garde 4, échec. » ; une explosion, « Le dé
// explose : 6 plus 3, 9, réussi. » Les valeurs sont dites modificateur
// compris, comme au journal, et une valeur passée sous zéro y porte le même
// moins : « 1er dé : −1, échec. »
function annoncerLeDe(jet) {
  const essai = dernier(dernier(jet.places).essais);
  const { premier, somme: total, reussi, explosible } = evaluerEssai(jet, essai);
  const question = jet.attente === "choix_relance" ? " Relancer ou garder ?" : "";
  if (essai.explosions.length > 0) {
    const issue = explosible ? "il peut encore exploser" : reussi ? "réussi" : "échec";
    return `Le dé explose : ${[ecrireValeur(premier), ...essai.explosions].join(" plus ")}, ${ecrireValeur(total)}, ${issue}.${question}`;
  }
  const modificateur = modificateurDe(jet);
  const valeurs = essai.tirages.length > 1 ? `${enumerer(essai.tirages.map((tirage) => ecrireValeur(tirage + modificateur)))}, on garde ${ecrireValeur(premier)}` : ecrireValeur(premier);
  const issue = explosible ? "il peut exploser" : reussi ? "réussi" : "échec";
  return `${ordinal(jet.places.length)} dé : ${valeurs}, ${issue}.${question}`;
}

// Le bilan que dit la fin d'une chaîne. C'est une phrase : elle commence par
// une majuscule (« Aucune réussite, Aubépine reçoit C = 19. »). Les dégâts se
// fixent après elle, à l'étape du bilan : elle dit ce que le jet a décidé (les
// réussites, la lettre et ses dégâts), et rien de dégâts qui ne sont pas
// fixés. Une attaque sans dégâts propres, tant qu'aucun nombre n'est saisi,
// n'annonce donc que ses réussites : « touché » dirait qu'elle n'en fait pas,
// alors qu'ils restent à saisir.
function annoncerLeBilan(etat, geste) {
  const aSaisir = degatsFixes(etat, geste).base === "aucun" && ajustement(geste) === null;
  return `${majuscule(aSaisir ? reussitesDuBilan(etat, geste) : ecrireBilan(etat, geste))}.`;
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
 * change, la fin du combat, une annulation, un geste du MJ, un effet hors
 * d'un geste), ce sont elles, à la suite. Sinon parlent :
 * - un dé lancé et un dé gardé : le dé de la chaîne qui vient de tomber,
 *   suivi du bilan quand il la finit ; le bilan seul pour un dé gardé ; un
 *   d20, « Localisation : 12, jambe gauche. » ;
 * - une esquive et une face décalée, qui changent ce que le coup fera avant
 *   « Appliquer » : chacune se dit par la phrase que le journal en écrira,
 *   celle de l'intervention (« Aubépine intervient : Pas de côté (1 action,
 *   3 souffle), 12 → 9. ») et celle de la localisation (« Localisation d20 →
 *   14, décalée à 12 (Minutie) : jambe gauche. »).
 */
export function annonce(etat, geste, evenement, lignesAvant = null) {
  const lignes = lignesEcrites(etat, evenement, lignesAvant);
  if (lignes.length > 0) return lignes.map((ligne) => ligne.texte).join(" ");
  const jet = geste?.jet ?? null;
  if (jet === null) return null;

  if (evenement.type === "esquive") {
    const jouee = dernier(geste.interventions ?? []) ?? null;
    return jouee === null ? null : ecrireIntervention(etat, geste, jouee);
  }
  if (evenement.type === "decaler") return ecrireLocalisation(etat, geste);
  if (evenement.type !== "de" && evenement.type !== "garder") return null;

  // Dès qu'un d20 est lancé, la chaîne est finie : le dé de l'événement est
  // le dernier d20.
  const lances = d20DuGeste(etat, geste);
  if (lances.length > 0) return `Localisation : ${ecrireD20(etat, geste, dernier(lances), ", ")}.`;

  // Une chaîne finie dans un geste qui ne l'est pas : le bilan suit (un jet
  // manqué attend « Appliquer », au groupe 3, et le dit aussi).
  const phrases = [];
  if (evenement.type === "de" && jet.places.length > 0) phrases.push(annoncerLeDe(jet));
  if (jetFini(jet)) phrases.push(annoncerLeBilan(etat, geste));
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
 * n'est pas suivie d'une fin de ligne. Les lignes y sont leur seul texte :
 * ni segments, ni barre.
 */
export function texteDuJournal(etat, finDeLigne = "\n") {
  return [...enTete(etat), "", ...(etat.journal ?? []).map((ligne) => ligne.texte)].join(finDeLigne);
}
