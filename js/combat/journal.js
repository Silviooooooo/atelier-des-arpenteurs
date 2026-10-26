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
// Une fonction par gabarit, toutes exportées, pour que chacun ait son
// contrôle. Celles qui écrivent un segment facultatif (les sources, la
// localisation, les dégâts, les blessures, la mort) rendent null quand il n'y
// a rien à écrire.
//
// Quelques textes ne viennent pas de l'auteur, qui n'a donné de gabarit que
// pour les cas courants : la source « types d'armure mêlés », les dégâts
// directs, le coût en lien non payé seul dans sa parenthèse, une valeur de dé
// passée sous zéro (« −1 ✗ »), les phrases d'annonce d'un dé qui peut
// exploser. Ils restent à lui faire confirmer.

import { CARACTERISTIQUES } from "../personnage/regles.js";
import { degatsFixes, imputerEsquive, localiser, nombreDeD20, reussitesDeLAttaque } from "./degats.js";
import { evaluerEssai, jetFini, modificateurDe, netDe, reussites } from "./jet.js";
import { LETTRES, SIGNES, geler } from "./regles.js";
import { campDe, capaciteDe, faconDe, gesteEnCours, photoDe } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };

// Les points de suspension qui suivent la ligne en cours, par leur code comme
// les signes du journal.
const SUITE = String.fromCodePoint(0x2026);

const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);
const dernier = (liste) => liste[liste.length - 1];

// « 1 réussite », « 2 réussites » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « n° 1 » ; « n° 1 et n° 2 » ; « n° 1, n° 2 et n° 3 ».
const enumerer = (mots) => (mots.length < 2 ? mots.join("") : `${mots.slice(0, -1).join(", ")} et ${dernier(mots)}`);

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// Une valeur de dé, modificateur compris : « 7 », « 0 », « −1 ». Elle passe
// sous zéro dès que les blessures pèsent plus que le dé, et porte alors le
// même moins que le modificateur, jamais le trait d'union d'un nombre
// converti tel quel.
const ecrireValeur = (valeur) => (valeur < 0 ? `${SIGNES.moins}${-valeur}` : `${valeur}`);

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

// ─── Les segments ───────────────────────────────────────────────────────────
//
// Segment = { type, texte, phrase, camp?, jet?, de? } (le contrat du groupe 2,
// § 3.1). Pendant qu'une phrase se fabrique, ses segments n'ont pas encore de
// numéro de phrase : numeroter() le leur donne quand la ligne s'assemble.

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

// « Taloche [1] » : le nom de la capacité, et sa puissance entre crochets
// quand elle évolue.
function nomDeLaCapacite(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const puissance = capacite?.evolue ? ` [${faconDe(etat, geste)?.puissance ?? 0}]` : "";
  return `${capacite?.nom ?? ""}${puissance}`;
}

// « contre » un protagoniste de l'autre camp, « sur » un allié ou sur soi.
const lienALaCible = (etat, geste) => (campDe(etat, geste.cible) === campDe(etat, geste.acteur) ? "sur" : "contre");

// « Aubépine : Fournaise [1] (1 souffle, 1 lien) », sans ce qui suit : le nom
// de qui agit, la capacité et sa puissance, la parenthèse.
function segmentsDuDebut(etat, geste) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const parenthese = capacite ? parentheseDeLOuverture(etat, geste, capacite, faconDe(etat, geste)) : "";
  const segments = pousser(pousserLeNom([], "acteur", etat, geste.acteur), "texte", " : ");
  pousser(segments, "capacite", nomDeLaCapacite(etat, geste));
  return pousser(segments, "texte", parenthese === "" ? "" : ` (${parenthese})`);
}

// La première phrase d'un geste, en segments : le début, puis la cible (son
// nom, avec son camp) ou, pour un déplacement, le départ et l'arrivée.
function segmentsDeLOuverture(etat, geste) {
  const segments = segmentsDuDebut(etat, geste);
  if (geste.mode === "deplacement") return pousser(segments, "texte", `, ${geste.depart} ${SIGNES.fleche} ${geste.arrivee}.`);
  if ((geste.cible ?? null) !== null) pousserLeNom(pousser(segments, "texte", ` ${lienALaCible(etat, geste)} `), "cible", etat, geste.cible);
  return pousser(segments, "texte", ".");
}

/**
 * La première phrase d'un geste : « Aubépine : Émincer (4 souffle) contre
 * Marmiton n° 2. » ; pour un déplacement : « Chef : Pas chassé [2]
 * (1 souffle), F6 → D4. »
 */
export function ecrireOuverture(etat, geste) {
  return texteDe(segmentsDeLOuverture(etat, geste));
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

// Un essai, en un dé insécable (de: k) du cadre (jet: 0) : ses lancers et la
// flèche du désavantage, sa valeur, ses explosions et leur somme, une espace,
// puis « ✓ » ou « ✗ », qui ne vivent que là. « inacheve » l'écrit tel qu'il
// est quand il attend une explosion : sans somme ni signe, qui changeront.
function segmentsDeLEssai(jet, essai, de, inacheve) {
  const modificateur = modificateurDe(jet);
  const { premier, somme: total, reussi } = evaluerEssai(jet, essai);
  const lancers = essai.tirages.length > 1 ? `${essai.tirages.map((tirage) => ecrireValeur(tirage + modificateur)).join("/")} ${SIGNES.fleche} ` : "";
  const explosions = essai.explosions.length > 0 ? ` explose, ${essai.explosions.map((ajout) => `+ ${ajout}`).join(" explose, ")}` : "";
  const valeur = `${lancers}${ecrireValeur(premier)}${explosions}`;
  if (inacheve) return [{ type: "texte", texte: valeur, jet: 0, de }];
  const addition = essai.explosions.length > 0 ? ` = ${ecrireValeur(total)}` : "";
  return [
    { type: "texte", texte: `${valeur}${addition} `, jet: 0, de },
    reussi ? { type: "reussi", texte: SIGNES.reussi, jet: 0, de } : { type: "echoue", texte: SIGNES.echoue, jet: 0, de },
  ];
}

// Une place de la chaîne : ses essais, joints par « , relancé », séparateur
// du cadre qui n'est d'aucun dé. Ses dés se comptent à partir de « premier ».
function segmentsDeLaPlace(jet, place, premier, inacheve = false) {
  const segments = [];
  place.essais.forEach((essai, rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: ", relancé ", jet: 0 });
    segments.push(...segmentsDeLEssai(jet, essai, premier + rang, inacheve && rang === place.essais.length - 1));
  });
  return segments;
}

// Les dés d'un jet, dans leur cadre : les places jointes par « , », hors des
// dés ; un dé par essai, compté depuis le premier essai du jet. « enCours »
// laisse inachevé le dernier essai qui attend une explosion.
function segmentsDuCadre(jet, enCours = false) {
  const explosionEnAttente = enCours && (jet.attente === "choix_explosion" || jet.attente === "de_explosion");
  const segments = [];
  let de = 0;
  jet.places.forEach((place, rang) => {
    if (rang > 0) segments.push({ type: "texte", texte: ", ", jet: 0 });
    segments.push(...segmentsDeLaPlace(jet, place, de, explosionEnAttente && rang === jet.places.length - 1));
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
 * + 1 = −1 ✗ ».
 */
export function ecrirePlace(jet, place) {
  return texteDe(segmentsDeLaPlace(jet, place, 0));
}

// Le nombre saisi à la main pour les dégâts, et sa raison ; null sans saisie.
const ajustement = (geste) => (geste.degats?.operations ?? []).findLast((operation) => operation.op === "ajuster") ?? null;

// Ce qui ouvre tout bilan : « aucune réussite », « 1 réussite », « 2 réussites ».
function reussitesDuBilan(jet) {
  const nombre = reussites(jet);
  return nombre === 0 ? "aucune réussite" : compter(nombre, "réussite");
}

// Le bilan en segments : du texte, sauf chaque « {L} = {v} » (lettre) et le
// seul nombre qui suit « ajusté à » (ajuste).
function segmentsDuBilan(etat, geste) {
  const { jet } = geste;
  const tete = reussitesDuBilan(jet);
  if (jet.genre === "caracteristique") return enTexte(tete);

  const enDefense = jet.genre === "defense";
  if (reussitesDeLAttaque(jet.genre, reussites(jet)) === 0) return enTexte(`${tete}, ${enDefense ? "aucun dégât" : "manqué"}`);

  const fixes = degatsFixes(etat, geste);
  const saisie = ajustement(geste);
  const directs = fixes.nature !== "normaux";
  const lettre = fixes.lettre === null ? "" : `${LETTRES[fixes.lettre]} = ${fixes.deBase}`;
  const recoit = enDefense ? `${court(etat, jet.lanceur)} reçoit ` : "";

  // Une défense contre une attaque sans dégâts propres, aux dégâts saisis :
  // ce que reçoit le PJ est le nombre saisi, et la phrase le dit d'un trait,
  // sans « ajusté à ».
  if (fixes.base === "aucun" && enDefense && saisie !== null && !directs) return enTexte(`${tete}, ${recoit}${saisie.valeur} (à la main : ${saisie.raison})`);

  const segments = enTexte(`${tete}, `);
  if (fixes.base === "lettre") pousser(pousser(segments, "texte", recoit), "lettre", lettre);
  else if (fixes.base === "arme") pousser(pousser(segments, "texte", "touché, dégâts de l'arme : "), "lettre", lettre);
  else pousser(segments, "texte", "touché");
  if (saisie !== null && directs) pousser(segments, "texte", `, dégâts directs ${fixes.nature === "corps" ? "au corps" : "à l'endurance"} : ${saisie.valeur} (${saisie.raison})`);
  else if (saisie !== null) pousser(pousser(pousser(segments, "texte", ", ajusté à "), "ajuste", `${saisie.valeur}`), "texte", ` (${saisie.raison})`);
  if (fixes.surplus !== 0) pousser(segments, "texte", `, +${fixes.surplus} contre l'armure (${fixes.sourceDuSurplus})`);
  return segments;
}

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
  segments.push(...segmentsDuCadre(jet, jusqua === "cadre"));
  if (jusqua === "cadre") return segments;
  if (jusqua === "reussites") return pousser(segments, "texte", ` : ${reussitesDuBilan(jet)}`);
  return pousser(joindre(pousser(segments, "texte", " : "), segmentsDuBilan(etat, geste)), "texte", ".");
}

/**
 * La phrase du jet : « d10+1 contre 5, 1 désavantage → 7/10 → 7 ✓, 9/3 → 3 ✗ :
 * 1 réussite, A = 3, +1 contre l'armure (Réduction). » Quand un adversaire
 * attaque, c'est le PJ visé qui lance : « Aubépine lance sa défense, d8+1
 * contre 5 → … ». Les caractéristiques d'un dé au choix s'écrivent dans
 * l'ordre où le jet les garde, que le moteur a rangé.
 */
export function ecrireJet(etat, geste) {
  return texteDe(segmentsDuJet(etat, geste));
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

// « Localisation d20 → », « Localisation 2 d20 → » : le nombre est celui des
// d20 du geste, écrit à partir de deux.
const enteteDeLocalisation = (etat, geste) => {
  const nombre = nombreDeD20(etat, geste);
  return `Localisation ${nombre > 1 ? `${nombre} ` : ""}d20 ${SIGNES.fleche} `;
};

/**
 * « Localisation d20 → 14 : jambe droite. » ; avec plusieurs dés,
 * « Localisation 2 d20 → 6 : torse ; 13 : jambe gauche. » Le nombre est celui
 * des d20 du geste ; les dés écrits sont ceux qui ont été lancés (une face de
 * contre-attaque arrête les suivants). null tant qu'aucun d20 n'est lancé.
 */
export function ecrireLocalisation(etat, geste) {
  const lances = d20DuGeste(etat, geste);
  if (lances.length === 0) return null;
  return `${enteteDeLocalisation(etat, geste)}${lances.map((d20) => ecrireD20(etat, geste, d20, " : ")).join(" ; ")}.`;
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
 * Ce que le coup a changé, et cela seul, dans l'ordre armure, endurance,
 * corps : « Armure 5 → 0, endurance 5 → 0, corps 10 → 0. » Dès que le geste
 * a plusieurs d20, chaque coup porte sa zone : « Torse : armure 30 → 19.
 * Jambe gauche : armure 15 → 4. » null si rien n'a changé.
 */
export function ecrireDegats(etat, geste) {
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
    phrases.push(plusieurs ? `${majuscule(zoneDe(etat, geste.cible, coup.zone))} : ${changements}.` : `${majuscule(changements)}.`);
  }
  return phrases.length === 0 ? null : phrases.join(" ");
}

/**
 * Une phrase par zone dont l'endurance tombe à 0, dans l'ordre des dés :
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

// Une phrase faite d'un texte, ou aucune si le texte est nul.
const phraseDeTexte = (genre, texte) => (texte === null ? [] : [{ genre, segments: enTexte(texte) }]);

// Le jet de caractéristique tient en une phrase : le début de l'ouverture,
// puis le jet, joints par une virgule.
const phraseDeCaracteristique = (etat, geste, jusqua = null) => ({
  genre: "jet",
  segments: joindre(pousser(segmentsDuDebut(etat, geste), "texte", ", "), segmentsDuJet(etat, geste, jusqua)),
});

// Ce que la ligne d'un geste dit avant ses suites : pour une attaque,
// l'ouverture et la phrase des sources ; rien pour un jet de
// caractéristique, dont l'ouverture est dans la phrase du jet.
function phrasesDeTete(etat, geste) {
  if (geste.mode === "caracteristique") return [];
  return [{ genre: "ouverture", segments: segmentsDeLOuverture(etat, geste) }, ...phraseDeTexte("sources", ecrireSources(geste.jet))];
}

// La phrase du jet, entière ou arrêtée plus tôt (voir segmentsDuJet).
const phraseDuJet = (etat, geste, jusqua = null) =>
  geste.mode === "caracteristique" ? phraseDeCaracteristique(etat, geste, jusqua) : { genre: "jet", segments: segmentsDuJet(etat, geste, jusqua) };

// Les phrases d'une ligne de geste, sans leur numéro.
function phrasesBrutes(etat, geste) {
  const avecJet = (geste.jet ?? null) !== null;
  if (geste.mode === "caracteristique" && avecJet) return [phraseDeCaracteristique(etat, geste)];
  if ((geste.mode !== "attaque" && geste.mode !== "jet_prete") || !avecJet) return [{ genre: "ouverture", segments: segmentsDeLOuverture(etat, geste) }];
  const mort = ecrireMort(etat, geste);
  return [
    ...phrasesDeTete(etat, geste),
    phraseDuJet(etat, geste),
    ...phraseDeTexte("localisation", ecrireLocalisation(etat, geste)),
    ...(geste.interventions ?? []).map((intervention) => ({ genre: "intervention", segments: enTexte(ecrireIntervention(etat, geste, intervention)) })),
    ...phraseDeTexte("degats", ecrireDegats(etat, geste)),
    ...phraseDeTexte("blessures", ecrireBlessures(etat, geste)),
    ...(mort === null ? [] : [{ genre: "mort", segments: pousser([], "mort", mort) }]),
  ];
}

// Des phrases brutes, numérotées dans leur ordre.
const numeroterLesPhrases = (phrases) => phrases.map(({ genre, segments }, rang) => ({ genre, segments: numeroter(segments, rang) }));

/**
 * Les phrases de la ligne d'un geste fini, dans l'ordre, chacune avec son
 * genre et ses segments : l'ouverture ; puis, pour un geste à jet d'attaque,
 * la phrase des sources, le jet, la localisation, les interventions, les
 * dégâts, les blessures, la mort. Un jet de caractéristique tient en une
 * phrase, « jet », l'ouverture et le jet joints par une virgule.
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

// Les phrases que le geste payé a déjà écrites pour de bon, la dernière
// pouvant n'être qu'un début ; null quand il n'y a rien à montrer.
function phrasesEnCours(etat, geste) {
  if (geste.mode !== "attaque" && geste.mode !== "jet_prete" && geste.mode !== "caracteristique") return null;
  const tete = phrasesDeTete(etat, geste);
  if (geste.moment === "jet") return [...tete, phraseDuJet(etat, geste, "cadre")];
  if (geste.moment === "bilan") return [...tete, phraseDuJet(etat, geste, "reussites")];
  if (geste.moment !== "localisation" && geste.moment !== "suites") return null;

  // Le premier d20 a fermé le bilan : le jet est écrit en entier. Tant
  // qu'une face peut se décaler, la localisation s'arrête au premier dé brut.
  const jusquAuJet = [...tete, phraseDuJet(etat, geste)];
  const lances = d20DuGeste(etat, geste);
  if (lances.length === 0) return jusquAuJet;
  const interventions = geste.interventions ?? [];
  if (geste.moment === "localisation" || interventions.length === 0) {
    return [...jusquAuJet, { genre: "localisation", segments: enTexte(`${enteteDeLocalisation(etat, geste)}${lances[0].brut}`) }];
  }
  return [
    ...jusquAuJet,
    ...phraseDeTexte("localisation", ecrireLocalisation(etat, geste)),
    ...interventions.map((intervention) => ({ genre: "intervention", segments: enTexte(ecrireIntervention(etat, geste, intervention)) })),
  ];
}

/**
 * La ligne que le geste en cours écrira, telle qu'on la sait déjà : son début
 * exact, suivi de « … » (un segment « suite », hors phrase, sans espace
 * avant). null sans geste, avant le paiement, et pour un geste sans jet.
 *
 * Elle n'écrit que ce qui ne peut plus changer : pendant la chaîne,
 * l'ouverture, les sources et le jet jusqu'au dernier dé lancé (un dé qui
 * attend d'exploser, sans signe ni somme) ; au bilan, les réussites seules ;
 * à la localisation, et aux suites avant l'esquive, le jet entier et le
 * premier d20 brut ; après l'esquive, la localisation entière et
 * l'intervention.
 */
export function ligneEnCours(etat) {
  const geste = gesteEnCours(etat);
  if (geste === null || geste.paye !== true || (geste.jet ?? null) === null) return null;
  const phrases = phrasesEnCours(etat, geste);
  return phrases === null ? null : assembler("geste", numeroterLesPhrases(phrases), { enCours: true }, { suite: true });
}

// ─── L'annulation ───────────────────────────────────────────────────────────

/**
 * Le nom d'un geste défait, ou à défaire (quoi : { genre: "capacite", geste },
 * { genre: "passer", qui } ou { genre: "fin_de_tour", camp }) :
 * « Aubépine — Taloche [1] », « Aubépine — passer son tour », « la fin du
 * tour des PJ ». Avec « detail », une capacité dit aussi sa cible, comme son
 * ouverture (« … contre Marmiton n° 2 »), ou, pour un déplacement, son départ
 * et son arrivée (« Aubépine — Pas chassé [1], C3 → D4 »).
 */
export function nommerLeGeste(etat, quoi, { detail = false } = {}) {
  if (quoi?.genre === "passer") return `${court(etat, quoi.qui)} ${SIGNES.tiret} passer son tour`;
  if (quoi?.genre === "fin_de_tour") return `la fin du tour des ${CAMPS[quoi.camp]}`;
  const geste = quoi?.genre === "capacite" ? (quoi.geste ?? null) : null;
  if (geste === null) return "";
  const tete = `${court(etat, geste.acteur)} ${SIGNES.tiret} ${nomDeLaCapacite(etat, geste)}`;
  if (!detail) return tete;
  if (geste.mode === "deplacement") return `${tete}, ${geste.depart} ${SIGNES.fleche} ${geste.arrivee}`;
  return (geste.cible ?? null) === null ? tete : `${tete} ${lienALaCible(etat, geste)} ${court(etat, geste.cible)}`;
}

// ─── Les lignes, fabriquées ─────────────────────────────────────────────────

/**
 * Les fabriques des lignes du journal : chacune rend une ligne gelée,
 * { genre, texte, segments, phrases, mort?, barre? }, dont les segments
 * redonnent le texte au signe près. C'est par elles que le moteur écrit.
 *
 * - lancement(etat), tour(tour), finDeTour(camp), fin(vainqueur) : le cadre ;
 * - passe(etat, qui) : « Marmiton n° 2 passe son tour. » ;
 * - geste(etat, geste) : la ligne d'un geste fini, « mort: true » quand sa
 *   victime meurt ;
 * - annulation(etat, quoi, plage) : « Annulé : Aubépine — Taloche [1]. »,
 *   qui ne réécrit aucune ligne : sa « barre » est la plage [début, fin) des
 *   lignes du geste défait, que l'écran barre.
 */
export const lignes = Object.freeze({
  lancement: (etat) => ligneDUnTenant("cadre", "lancement", "texte", ligneDeLancement(etat)),
  tour: (tour) => ligneDUnTenant("tour", "tour", "tour", ligneDeTour(tour)),
  finDeTour: (camp) => ligneDUnTenant("cadre", "fin_de_tour", "fin_de_tour", ligneDeFinDeTour(camp)),
  fin: (vainqueur) => ligneDUnTenant("fin", "fin", "texte", ligneDeFin(vainqueur)),
  passe: (etat, qui) => assembler("geste", [{ genre: "passe", segments: numeroter(segmentsDeLaPasse(etat, qui), 0) }]),
  geste: (etat, geste) => assembler("geste", phrasesDuGeste(etat, geste), geste.resultat?.mort === true ? { mort: true } : {}),
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

const ordinal = (place) => (place === 1 ? "1er" : `${place}e`);

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

// Le bilan que dit la fin d'une chaîne qui touche. C'est une phrase : elle
// commence par une majuscule (« Aucune réussite, Aubépine reçoit C = 19. »).
// Les dégâts se fixent après elle, à l'étape du bilan : elle dit ce que le
// jet a décidé (les réussites, la lettre et ses dégâts), et rien de dégâts
// qui ne sont pas fixés. Une attaque sans dégâts propres, tant qu'aucun
// nombre n'est saisi, n'annonce donc que ses réussites : « touché » dirait
// qu'elle n'en fait pas, alors qu'ils restent à saisir.
function annoncerLeBilan(etat, geste) {
  const aSaisir = degatsFixes(etat, geste).base === "aucun" && ajustement(geste) === null;
  return `${majuscule(aSaisir ? reussitesDuBilan(geste.jet) : ecrireBilan(etat, geste))}.`;
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
 * change, la fin du combat, une annulation), ce sont elles, à la suite. Sinon
 * parlent :
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

  // Une chaîne finie dans un geste qui ne l'est pas : l'attaque touche (un jet
  // manqué aurait fini le geste, et écrit sa ligne), le bilan suit donc.
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
