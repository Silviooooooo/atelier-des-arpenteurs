// Contrôles de la palette et du menu du MJ (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) » ; mission du lot 4.3, § 4.6 à § 4.8 et § 5 ;
// contrat de la vague 3, § 3.6, § 3.7, § 7 et D10 bis) : js/combat/lecture_mj.js.
//
// Ce qu'ils tiennent :
// - la palette : la source par défaut (la capacité jouée), un passif, un état,
//   le MJ, la palette libre ; les sources au choix du Mode MJ ; X ; chaque
//   genre, actif ou avec sa raison, à chaque moment ; chaque sorte de champ
//   (option, nombre, texte, case, cibles) ; l'onglet Durée ; les effets en
//   cours ; l'aperçu « Le journal écrira : … » (rendre, ±N, un état,
//   déplacer par la phrase de l'effet ; un dé et des dégâts par la ligne en
//   cours) ; « Appliquer », actif et refusé ;
// - le menu du MJ : un personnage et un adversaire, inactif pendant un geste,
//   l'aperçu, « Aucune valeur ne change. » ;
// - la simulation de l'écran (apports.simuler) : appelée une fois par rendu,
//   pour la seule commande choisie ; sans elle, l'aperçu est nul ;
// - à plusieurs moments du combat de référence où l'offre annonce « effet »
//   et « mj » : tout élément actif porte un événement que le moteur accepte,
//   tout élément inactif un événement qu'il refuse, et sa raison.
//
// La simulation est ici une fonction écrite à la main, ou appliquer du
// moteur, importé par ce contrôle seul (contrat, D10 bis). Les attendus sont
// écrits d'après la mission, le contrat et le journal, jamais recopiés de ce
// que rend le module. Aucun état du combat ne se compare en entier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as lectureMj from "../js/combat/lecture_mj.js";
import { vueMenuMj, vuePalette } from "../js/combat/lecture_mj.js";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { offre } from "../js/combat/offre.js";
import { casesEntre } from "../js/combat/plateau.js";
import { GENRES_EFFET, SIGNES } from "../js/combat/regles.js";
import { scenario } from "./outils/combat_reference.js";
import { aubepineEssai, capaciteEssai, chefDePartieEssai, etatsEssai, faconEssai, marmitonDeCorveeEssai, miseEnPlaceEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const POINTS = String.fromCodePoint(0x2026);
const FOIS = String.fromCodePoint(0x00d7);
const OUVRANT = String.fromCodePoint(0x00ab);
const FERMANT = String.fromCodePoint(0x00bb);
const { fleche: FLECHE, moins: MOINS, tiret: TIRET, point: POINT } = SIGNES;

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const LE_GESTE_D_ABORD = "Le geste en cours se finit d'abord.";
const ETATS = etatsEssai().blocs;
const FRAPPE = { genre: "capacite", qui: "pj1", capacite: 0 };
const NEZ_FIN = { genre: "capacite", qui: "pj1", capacite: 7 };
const MJ = { genre: "mj" };

const PHOTOS = {
  "Aubépine Crèmebrûlée": aubepineEssai(),
  "Chef de partie": chefDePartieEssai(),
  "Marmiton de corvée": marmitonDeCorveeEssai(),
};

// Le combat de référence, tenu un événement à la fois : TENUS[n] est l'état
// après n événements.
const { contenu: CONTENU } = versContenu(scenario, PHOTOS);
const TENUS = [ouvrirCombat(CONTENU.miseEnPlace)];
for (const evenement of CONTENU.evenements) {
  const { etat, refus } = appliquer(TENUS.at(-1), evenement);
  assert.equal(refus, undefined, refus?.message);
  TENUS.push(etat);
}

const momentDe = (etat) => gesteEnCours(etat)?.moment ?? null;
const rangDe = (predicat, quoi) => {
  const rang = TENUS.findIndex(predicat);
  assert.notEqual(rang, -1, quoi);
  return rang;
};
// Les moments du premier geste d'Aubépine (Frappe contre le Marmiton n° 1,
// adv3), puis ceux qui ne viennent que plus loin.
const parAubepine = (moment) => (etat) => momentDe(etat) === moment && gesteEnCours(etat).acteur === "pj1";
const N_PREPARATION = rangDe((etat) => parAubepine("preparation")(etat) && gesteEnCours(etat).cible !== null, "la préparation, sa cible posée");
const N_JET = rangDe(parAubepine("jet"), "le jet");
const N_BILAN = rangDe(parAubepine("bilan"), "le bilan");
const N_SUITES = rangDe(parAubepine("suites"), "les suites");
const N_ENTRE_DEUX = rangDe((etat) => etat.phase === "combat" && momentDe(etat) === null, "entre deux gestes");
const N_ADVERSE = rangDe((etat) => etat.phase === "combat" && momentDe(etat) === null && etat.tour.camp === "adv", "entre deux gestes, au tour adverse");
const N_PAS_CHASSE = rangDe((etat) => momentDe(etat) === "preparation" && gesteEnCours(etat).acteur === "pj1" && gesteEnCours(etat).capacite === 13, "Pas chassé");
const N_CONTRE = rangDe((etat) => momentDe(etat) === "contre_attaque", "la contre-attaque");
const N_BLESSURE = rangDe((etat) => momentDe(etat) === "blessure", "la blessure");
const PREPARATION = TENUS[N_PREPARATION];
const JET = TENUS[N_JET];
const BILAN = TENUS[N_BILAN];
const SUITES = TENUS[N_SUITES];
const ENTRE_DEUX = TENUS[N_ENTRE_DEUX];
const FINI = TENUS.at(-1);

/** Applique des événements à la suite ; un refus fait échouer le contrôle, avec sa phrase. */
function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements.flat()) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

const accepte = (etat, evenement) => appliquer(etat, evenement).refus === undefined;
const refusDe = (etat, evenement) => appliquer(etat, evenement).refus ?? null;
const simulerSur = (etat) => (evenement) => appliquer(etat, evenement);

const palette = (etat, source, choisi = null, apports = {}) => vuePalette(etat, source, { etats: ETATS, libre: false, choisi, simuler: simulerSur(etat), ...apports });
const genresDe = (vue) => vue.onglets.flatMap((onglet) => onglet.genres);
const genreDe = (vue, genre) => genresDe(vue).find((un) => un.genre === genre);
const champDe = (genreVu, nom) => genreVu.champs.find((champ) => champ.nom === nom);
const dureeDe = (vue) => vue.onglets.find((onglet) => onglet.cle === "duree").champ;
const actifs = (vue) => genresDe(vue).filter((genre) => genre.actif).map((genre) => genre.genre);
const optionsDe = (champ) => champ.options ?? champ.blocs.flatMap((bloc) => bloc.options);

/** Un combat lancé : chaque protagoniste est { photo, case }. */
const combat = (protagonistes) => jouer(ouvrirCombat(miseEnPlaceEssai(protagonistes)), LANCER);

// Toute la vue, parcourue : chaque objet inactif dit sa raison, une phrase
// finie par un point ; chaque objet actif n'en a pas ; aucun champ ne vaut
// undefined.
function verifierLesRaisons(vue, quoi) {
  const visiter = (valeur, chemin) => {
    if (valeur === undefined) assert.fail(`${quoi} : ${chemin} vaut undefined`);
    if (valeur === null || typeof valeur !== "object") return;
    if (!Array.isArray(valeur) && "actif" in valeur) {
      if (valeur.actif) assert.equal(valeur.raison, null, `${quoi} : ${chemin} est actif et porte une raison`);
      else assert.ok(typeof valeur.raison === "string" && valeur.raison.endsWith("."), `${quoi} : ${chemin} est inactif sans raison (${valeur.raison})`);
    }
    for (const [cle, enfant] of Object.entries(valeur)) visiter(enfant, `${chemin}.${cle}`);
  };
  visiter(vue, "vue");
}

// ─── Le module ──────────────────────────────────────────────────────────────

test("module : deux vues ; il n'importe ni n'atteint le moteur, seulement le noyau ; il ne nomme ni la page ni le stockage", () => {
  assert.deepEqual(Object.keys(lectureMj).sort(), ["vueMenuMj", "vuePalette"]);
  const racine = new URL("../", import.meta.url);
  const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
  const importsDe = (source) => [...source.matchAll(/^(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gms)].map((trouve) => trouve[1]);
  const source = lire("js/combat/lecture_mj.js");
  assert.deepEqual(importsDe(source).sort(), ["./degats.js", "./effets.js", "./forme.js", "./journal.js", "./plateau.js", "./regles.js", "./valeurs.js"]);
  // Tout ce qu'il atteint, d'import en import : jamais le moteur (D10 bis).
  const atteints = new Set();
  const visiter = (chemin) => {
    if (atteints.has(chemin)) return;
    atteints.add(chemin);
    for (const importe of importsDe(lire(chemin))) visiter(new URL(importe, new URL(chemin, racine)).href.slice(racine.href.length));
  };
  visiter("js/combat/lecture_mj.js");
  assert.equal(atteints.has("js/combat/moteur.js"), false);
  assert.ok(atteints.has("js/combat/effets.js"), "armé : la visite descend bien dans les imports");
  for (const interdit of ["localStorage", "sessionStorage", "matchMedia", "addEventListener", "window", "Math.random", "Date.now"]) assert.equal(source.includes(interdit), false, interdit);
});

// ─── La palette : la source ─────────────────────────────────────────────────

test("palette : null pour une source qui n'existe pas", () => {
  assert.equal(palette(BILAN, { genre: "capacite", qui: "pj1", capacite: 99 }), null);
  assert.equal(palette(BILAN, { genre: "capacite", qui: "adv9", capacite: 0 }), null);
  assert.equal(palette(BILAN, { genre: "etat", effet: 9999 }), null);
  assert.equal(palette(BILAN, { genre: "inconnu" }), null);
  assert.equal(palette(BILAN, null), null);
  assert.notEqual(palette(BILAN, MJ), null);
});

test("palette : la source par défaut est la capacité jouée ; ses phrases ; les sources au choix du Mode MJ", () => {
  const vue = palette(BILAN, FRAPPE);
  assert.equal(vue.titre, "Effet de Frappe");
  assert.equal(vue.sous, "la palette, au nom de la capacité jouée");
  assert.equal(vue.texte, `Frappe ${TIRET} Une attaque qui inflige 3/8/20.`);
  assert.deepEqual(vue.source.valeur, FRAPPE);
  assert.equal(vue.source.nom, "Frappe");
  assert.equal(vue.source.phrase, "Source : Frappe, la capacité jouée (en Mode MJ, elle se change).");
  assert.equal(vue.source.phraseMj, `Source : Frappe (par défaut) ${POINT} changer`);
  assert.equal(vue.x, null);
  assert.equal(vue.fermer, "Fermer");
  assert.equal(vue.apercu, null);
  assert.equal(vue.appliquer, null);
  // Les capacités de l'auteur (dix-huit), celles de la cible (trois), puis « MJ ».
  const { choix } = vue.source;
  assert.equal(choix.length, 18 + 3 + 1);
  assert.deepEqual([choix[0].libelle, choix[0].choisie, choix[0].actif], ["Frappe (Aubépine)", true, true]);
  assert.deepEqual(choix[0].source, FRAPPE);
  assert.ok(choix.some((un) => un.libelle === "Moulinet farineux (Marmiton n° 1)"));
  assert.deepEqual([choix.at(-1).libelle, choix.at(-1).source], ["MJ", MJ]);
  assert.equal(choix.filter((un) => un.choisie).length, 1);
  assert.ok(choix.every((un) => un.mj === true && un.actif && un.raison === null), "après le paiement, toute source au choix s'applique");
  // Avant le paiement : la capacité jouée et les passifs seuls (effets.js).
  const avant = palette(PREPARATION, FRAPPE).source.choix;
  const raison = "Avant le paiement, la source est la capacité jouée ou un passif.";
  assert.deepEqual(avant.filter((un) => un.actif).map((un) => un.libelle), ["Frappe (Aubépine)", "Maîtrise de l'agile (Aubépine)", "Nez fin (Aubépine)"]);
  assert.ok(avant.filter((un) => !un.actif).every((un) => un.raison === raison));
  assert.equal(avant.at(-1).actif, false);
  // Quand rien n'a prise (un déplacement, avant le paiement), la source n'y est pour rien : chaque genre dit pourquoi.
  const pas = palette(TENUS[N_PAS_CHASSE], { genre: "capacite", qui: "pj1", capacite: 13 }).source.choix;
  assert.ok(pas.every((un) => un.actif && un.raison === null));
});

test("palette : libre (« Palette », Mode MJ) ; au nom d'un passif ; au nom du MJ", () => {
  const libre = palette(BILAN, FRAPPE, null, { libre: true });
  assert.equal(libre.titre, "Palette (Mode MJ)");
  assert.equal(libre.sous, "la source se choisit");
  const passif = palette(PREPARATION, NEZ_FIN);
  assert.equal(passif.titre, "Effet de Nez fin");
  assert.equal(passif.sous, "la palette, au nom de Nez fin");
  assert.equal(passif.texte, `Nez fin ${TIRET} Retournez un dé devant un plat douteux.`);
  assert.equal(passif.source.phrase, "Source : Nez fin (en Mode MJ, elle se change).");
  assert.equal(passif.source.phraseMj, `Source : Nez fin ${POINT} changer`);
  const mj = palette(ENTRE_DEUX, MJ);
  assert.equal(mj.texte, null);
  assert.deepEqual(mj.source.choix.map((un) => un.libelle), ["MJ"], "hors d'un geste, le MJ n'a ni auteur ni cible");
  assert.ok(genresDe(mj).every((genre) => genre.mj === true), "une source « MJ » : tout genre est du Mode MJ");
  assert.ok(genresDe(palette(BILAN, FRAPPE)).every((genre) => genre.mj === false));
});

test("palette : au nom d'un état porté, hors d'un geste ; sa durée se dit de son porteur", () => {
  const etat = jouer(ENTRE_DEUX, { type: "mj", genre: "etat", qui: "adv3", ajout: { capacite: ETATS[1].capacites[0], duree: "combat" } });
  const id = etat.effets.at(-1).id;
  const vue = palette(etat, { genre: "etat", effet: id }, { genre: "attaque", valeurs: {} });
  assert.equal(vue.titre, "Effet d'Étourdi");
  assert.equal(vue.sous, "la palette, au nom d'Étourdi");
  assert.equal(vue.texte, `Étourdi ${TIRET} Votre prochaine action coûte une action de plus.`);
  assert.deepEqual([vue.source.choix[0].libelle, vue.source.choix[0].choisie], ["Étourdi (Marmiton n° 1)", true]);
  assert.ok(vue.source.choix.some((un) => un.libelle === "Frappe (Marmiton n° 1)"), "les capacités de son porteur");
  assert.deepEqual(dureeDe(vue).options.map((option) => option.libelle), ["ce jet", "jusqu'au prochain tour de Marmiton n° 1", "jusqu'à la fin du combat"]);
  // Le MJ, hors d'un geste : le camp qui joue.
  assert.equal(dureeDe(palette(etat, MJ, { genre: "etat", valeurs: {} })).options[1].libelle, "jusqu'au prochain tour des PJ");
});

test("palette : X, pour un passif au coût X : de 0 au plus grand que le juge accepte ; dans le gabarit et la commande", () => {
  const zeste = aubepineEssai((valeurs) => {
    valeurs.capacites.push(capaciteEssai({ nom: "Zeste", groupe: { genre: "capacites", titre: "Saucier" }, facons: [faconEssai({ cout: { souffle: "X", lien: 0 }, description: "Retirez X points.", passif: true, elements: ["Passif"] })] }));
  });
  const depart = combat([
    { photo: zeste, case: "D4" },
    { photo: marmitonDeCorveeEssai(), case: "D4" },
  ]);
  const indice = depart.photos.pj1.capacites.findIndex((capacite) => capacite.nom === "Zeste");
  const etat = jouer(depart, { type: "capacite", qui: "pj1", capacite: 0, facon: 0 }, { type: "regler", champ: "cible", valeur: "adv2" });
  const source = { genre: "capacite", qui: "pj1", capacite: indice };
  const vue = palette(etat, source);
  assert.deepEqual(vue.x, { libelle: "X", min: 0, max: 10, valeur: 0 });
  assert.equal(genreDe(vue, "avantages").gabarit.evenement.x, 0);
  const choisi = palette(etat, source, { genre: "avantages", valeurs: { nombre: 1 }, x: 3 });
  assert.equal(choisi.x.valeur, 3);
  assert.equal(choisi.appliquer.commande.evenement.x, 3);
  assert.ok(choisi.appliquer.actif && accepte(etat, choisi.appliquer.commande.evenement));
  const trop = palette(etat, source, { genre: "avantages", valeurs: { nombre: 1 }, x: 11 });
  assert.deepEqual([trop.appliquer.actif, trop.appliquer.raison], [false, "X ne va que de 0 à 10."]);
  assert.ok(!accepte(etat, trop.appliquer.commande.evenement));
  // Sans X : ni dans la vue, ni dans les gabarits.
  assert.equal(Object.hasOwn(genreDe(palette(etat, FRAPPE), "avantages").gabarit.evenement, "x"), false);
  // Plus de souffle : X ne va que jusqu'à 0, même si la jauge de lien tient un point.
  const sansSouffle = jouer(depart, { type: "mj", genre: "valeurs", qui: "pj1", valeurs: [{ champ: "souffle", valeur: 0 }] }, { type: "capacite", qui: "pj1", capacite: 0, facon: 0 }, { type: "regler", champ: "cible", valeur: "adv2" });
  assert.equal(sansSouffle.protagonistes.pj1.liens[0].points, 1);
  assert.deepEqual(palette(sansSouffle, source).x, { libelle: "X", min: 0, max: 0, valeur: 0 });
});

// ─── La palette : les genres et leurs champs ────────────────────────────────

test("palette : cinq onglets ; les dix-neuf genres, chacun une fois, aux libellés de la maquette", () => {
  const vue = palette(BILAN, FRAPPE);
  assert.deepEqual(
    vue.onglets.map(({ cle, libelle }) => [cle, libelle]),
    [
      ["des", "Dés"],
      ["zone", "Zone"],
      ["degats", "Dégâts"],
      ["cible", "Cible"],
      ["duree", "Durée"],
    ],
  );
  assert.deepEqual(genresDe(vue).map((genre) => genre.genre).sort(), [...GENRES_EFFET].sort());
  assert.deepEqual(vue.onglets[4].genres, []);
  const libelles = Object.fromEntries(genresDe(vue).map((genre) => [genre.genre, genre.libelle]));
  assert.deepEqual(libelles, {
    avantages: "1 avantage, pour ce jet",
    desavantages: "1 désavantage, pour ce jet",
    relancer: "Relancer",
    inverser: "Inverser",
    reussite: "+1 réussite",
    zone: `Choisir la zone${POINTS}`,
    multiplier: `${FOIS}k`,
    ajouter: "+N",
    retrancher: `${MOINS}N`,
    armure: "+N contre l'armure",
    directs: `Directs${POINTS}`,
    reporter: `Reporter sur${POINTS}`,
    toute_la_case: "Toute la case",
    attaque_en_plus: "Attaque en plus",
    rendre: `Rendre N${POINTS}`,
    attaque: "Attaque de la cible",
    defense: "Défense de la cible",
    etat: `Appliquer un état${POINTS}`,
    deplacer: `Déplacer, sans action${POINTS}`,
  });
  assert.equal(genreDe(palette(PREPARATION, FRAPPE, { genre: "avantages", valeurs: { nombre: 2 } }), "avantages").libelle, "2 avantages, pour ce jet");
  // Chaque gabarit : l'événement « effet » de son genre et de sa source.
  for (const genre of genresDe(vue)) assert.deepEqual(genre.gabarit, { evenement: { type: "effet", genre: genre.genre, source: FRAPPE } });
});

test("palette : chaque genre, actif à son moment, sinon avec la raison du juge", () => {
  const raisons = (vue) => Object.fromEntries(genresDe(vue).filter((genre) => !genre.actif).map((genre) => [genre.genre, genre.raison]));
  // Avant le paiement : les effets « pour ce jet » seuls.
  const preparation = palette(PREPARATION, FRAPPE);
  assert.deepEqual(actifs(preparation), ["avantages", "desavantages", "attaque", "defense", "etat"]);
  assert.equal(raisons(preparation).relancer, "Le geste n'est pas encore payé.");
  assert.equal(raisons(preparation).deplacer, "Le geste n'est pas encore payé.");
  assert.equal(raisons(palette(TENUS[N_PAS_CHASSE], { genre: "capacite", qui: "pj1", capacite: 13 })).avantages, "Ce geste ne lance aucun dé.");
  // Un dé lancé.
  const jet = palette(JET, FRAPPE);
  assert.deepEqual(actifs(jet), ["relancer", "inverser", "attaque", "defense", "etat", "deplacer"]);
  assert.deepEqual([raisons(jet).avantages, raisons(jet).reussite, raisons(jet).zone, raisons(jet).multiplier], ["Un dé est déjà lancé.", "Le jet n'est pas fini.", "Aucun d20 lancé.", "Aucuns dégâts calculés."]);
  // Rendre a son moment toujours ; ici, tout est plein.
  assert.equal(raisons(jet).rendre, "Déjà au maximum.");
  // Le bilan, puis les suites.
  assert.ok(actifs(palette(BILAN, FRAPPE)).includes("toute_la_case"));
  const suites = palette(SUITES, FRAPPE);
  assert.ok(actifs(suites).includes("zone"));
  assert.equal(raisons(suites).relancer, "Un d20 est déjà lancé.");
  // Une face de contre-attaque ne se choisit pas : le genre l'emprunte à son option.
  const geste = gesteEnCours(TENUS[N_CONTRE]);
  const contre = palette(TENUS[N_CONTRE], { genre: "capacite", qui: geste.acteur, capacite: geste.capacite });
  assert.equal(raisons(contre).zone, "Une face de contre-attaque ne se choisit pas.");
  assert.equal(champDe(genreDe(contre, "zone"), "de").options[0].raison, "Une face de contre-attaque ne se choisit pas.");
  // Hors d'un geste ; après la fin.
  const entre = palette(ENTRE_DEUX, MJ);
  assert.deepEqual(actifs(entre), ["attaque", "defense", "etat", "deplacer"]);
  assert.equal(raisons(entre).relancer, "Hors d'un geste.");
  assert.ok(genresDe(palette(FINI, MJ)).every((genre) => !genre.actif && genre.raison === "Le combat est terminé."));
});

test("palette : chaque sorte de champ — option (sa case), nombre (ses bornes), texte, case, cibles", () => {
  const vue = palette(BILAN, FRAPPE);
  // ±N : sur qui, la cible d'abord ; N de −20 à 20, jamais 0.
  const attaque = genreDe(vue, "attaque");
  assert.deepEqual(attaque.champs.map((champ) => [champ.nom, champ.sorte]), [
    ["sur", "option"],
    ["n", "nombre"],
  ]);
  const sur = champDe(attaque, "sur");
  assert.equal(sur.valeur, "adv3");
  assert.deepEqual(sur.options.map((option) => [option.valeur, option.libelle, option.case]), BILAN.ordre.map((id) => [id, BILAN.noms[id].entier, BILAN.protagonistes[id].case]));
  assert.deepEqual(champDe(attaque, "n"), { nom: "n", sorte: "nombre", libelle: "N", min: -20, max: 20, exclus: [0], valeur: 1 });
  assert.deepEqual([champDe(genreDe(vue, "avantages"), "nombre").min, champDe(genreDe(vue, "avantages"), "nombre").max], [1, 20]);
  assert.deepEqual([champDe(genreDe(vue, "multiplier"), "k").min, champDe(genreDe(vue, "multiplier"), "k").max], [2, 10]);
  const directs = genreDe(vue, "directs");
  assert.deepEqual([champDe(directs, "n").min, champDe(directs, "n").max], [0, 999]);
  assert.deepEqual(champDe(directs, "nature").options.map((option) => [option.valeur, option.libelle]), [
    ["resistance", "à l'endurance"],
    ["corps", "au corps"],
  ]);
  // Reporter : pas sur la victime, que le juge refuse ; la première active par défaut.
  const reporter = champDe(genreDe(vue, "reporter"), "sur");
  assert.deepEqual(reporter.options.filter((option) => !option.actif).map((option) => [option.valeur, option.raison]), [["adv3", "Les dégâts vont déjà à ce protagoniste."]]);
  assert.equal(reporter.valeur, "pj1");
  // Un état : les blocs de la banque, et un état libre de quarante signes.
  const etat = genreDe(vue, "etat");
  const capacite = champDe(etat, "capacite");
  assert.deepEqual(capacite.blocs.map((bloc) => bloc.titre), ["Blessure (bloc du classeur)", "Condition (bloc du classeur)"]);
  assert.deepEqual(capacite.blocs[1].options[0], { valeur: "1:0", libelle: "Étourdi", texte: "Votre prochaine action coûte une action de plus.", actif: true, raison: null });
  assert.deepEqual(champDe(etat, "libre"), { nom: "libre", sorte: "texte", libelle: "État libre", max: 40, valeur: null });
  // Déplacer : la case d'arrivée, autre que celle du protagoniste choisi.
  const vers = champDe(genreDe(vue, "deplacer"), "vers");
  assert.deepEqual([vers.sorte, vers.exclue, vers.valeur], ["case", BILAN.protagonistes.adv3.case, null]);
  const ailleurs = palette(BILAN, FRAPPE, { genre: "deplacer", valeurs: { sur: "pj1" } });
  assert.equal(champDe(genreDe(ailleurs, "deplacer"), "vers").exclue, BILAN.protagonistes.pj1.case);
  // Toute la case : la cible en cours en tête, cochée ; les autres vivants de sa case.
  const cibles = champDe(genreDe(vue, "toute_la_case"), "cibles");
  assert.equal(cibles.sorte, "cibles");
  assert.deepEqual(cibles.valeur, ["adv3", "adv4"]);
  assert.deepEqual(cibles.options.map((option) => [option.valeur, option.actif, option.dOffice]), [
    ["adv3", true, true],
    ["adv4", true, true],
  ]);
  assert.equal(cibles.options[0].detail, `${BILAN.protagonistes.adv3.case} ${POINT} défense 5 ${POINT} corps 10/10`);
});

test("palette : toute la case ne coche ni l'auteur ni ses alliés ; rendre ne passe pas le maximum", () => {
  const n = rangDe((etat) => parAubepine("bilan")(etat) && etat.protagonistes.pj1.case === etat.protagonistes[gesteEnCours(etat).cible].case, "un bilan d'Aubépine sur la case de sa cible");
  const geste = gesteEnCours(TENUS[n]);
  const cibles = champDe(genreDe(palette(TENUS[n], { genre: "capacite", qui: "pj1", capacite: geste.capacite }), "toute_la_case"), "cibles");
  const aubepine = cibles.options.find((option) => option.valeur === "pj1");
  assert.deepEqual([aubepine.actif, aubepine.raison, aubepine.dOffice], [false, "Le jet contre un allié ou contre soi n'est pas encore écrit dans les règles.", false]);
  assert.equal(cibles.valeur.includes("pj1"), false);
  // Rendre : après un coup reçu, sur Aubépine seule ; chaque ressource pleine dit pourquoi.
  const blesse = rangDe((un) => un.phase === "combat" && momentDe(un) === null && un.protagonistes.pj1.zones.some((zone) => zone.armure < zone.armureMax), "Aubépine entamée");
  const rendre = genreDe(palette(TENUS[blesse], MJ), "rendre");
  assert.equal(rendre.actif, true);
  const qui = champDe(rendre, "sur");
  assert.equal(qui.valeur, "pj1");
  assert.ok(qui.options.filter((option) => !option.actif).every((option) => option.raison === "Déjà au maximum."));
  const ressource = champDe(rendre, "ressource");
  assert.deepEqual(ressource.options[0], { valeur: { sur: "pj1", ressource: "souffle" }, libelle: "Souffle", actif: false, raison: "Déjà au maximum." });
  assert.deepEqual(ressource.options[1].valeur, { sur: "pj1", ressource: "lien", jauge: 0 });
  assert.equal(ressource.options[1].libelle, "Lien de Grand Four");
  assert.equal(ressource.options.at(-1).libelle, "Corps");
  const active = ressource.options.find((option) => option.actif);
  assert.deepEqual(ressource.valeur, active.valeur);
  const zone = TENUS[blesse].photos.pj1.zones[active.valeur.zone].nom;
  assert.equal(active.libelle, `${zone}, ${active.valeur.ressource}`);
  // Un protagoniste est actif s'il a une ressource à rendre, quelle qu'elle soit : au tour adverse, le Marmiton n° 1
  // seul est entamé (son armure), et rendre s'offre, sur lui.
  const adverse = genreDe(palette(TENUS[N_ADVERSE], MJ), "rendre");
  assert.equal(adverse.actif, true);
  assert.deepEqual(champDe(adverse, "sur").options.filter((option) => option.actif).map((option) => option.valeur), ["adv3"]);
  assert.equal(champDe(adverse, "sur").valeur, "adv3");
  assert.equal(champDe(adverse, "ressource").valeur.ressource, "armure");
});

test("palette : l'onglet Durée, celui du genre choisi de l'onglet Cible ; chaque durée, à son moment", () => {
  assert.equal(dureeDe(palette(BILAN, FRAPPE)), null, "aucun genre choisi");
  assert.equal(dureeDe(palette(BILAN, FRAPPE, { genre: "deplacer", valeurs: {} })), null, "déplacer n'a pas de durée");
  assert.equal(dureeDe(palette(BILAN, FRAPPE, { genre: "multiplier", valeurs: {} })), null);
  for (const genre of ["attaque", "defense", "etat"]) assert.equal(champDe(genreDe(palette(BILAN, FRAPPE), genre), "duree"), undefined, `${genre} n'a pas de durée dans ses champs`);
  const lire = (duree) => duree.options.map((option) => [option.valeur, option.libelle, option.actif, option.raison]);
  const avant = dureeDe(palette(PREPARATION, FRAPPE, { genre: "attaque", valeurs: {} }));
  assert.equal(avant.valeur, "jet");
  assert.deepEqual(lire(avant), [
    ["jet", "ce jet", true, null],
    ["tour", "jusqu'au prochain tour d'Aubépine", false, "Le geste n'est pas encore payé."],
    ["combat", "jusqu'à la fin du combat", false, "Le geste n'est pas encore payé."],
  ]);
  const apres = dureeDe(palette(BILAN, FRAPPE, { genre: "etat", valeurs: {} }));
  assert.equal(apres.valeur, "tour");
  assert.deepEqual(lire(apres)[0], ["jet", "ce jet", false, "Un dé est déjà lancé."]);
  assert.equal(dureeDe(palette(BILAN, FRAPPE, { genre: "etat", valeurs: { duree: "combat" } })).valeur, "combat");
  assert.deepEqual(lire(dureeDe(palette(ENTRE_DEUX, MJ, { genre: "defense", valeurs: {} })))[0], ["jet", "ce jet", false, "Hors d'un geste."]);
});

test("palette : les effets en cours — ceux du geste, puis les durables de la source, leur couleur, le ✕ d'un état", () => {
  // Avant le premier dé : deux avantages de Nez fin, pour ce jet.
  const avantages = jouer(PREPARATION, { type: "effet", genre: "avantages", source: NEZ_FIN, nombre: 2 });
  assert.deepEqual(palette(avantages, FRAPPE).effetsEnCours, [{ id: null, genre: "avantages", nom: "2 avantages (Nez fin)", duree: "pour ce jet", couleur: "alerte", retirer: null }]);
  // Au bilan : ×2 sur le geste ; −2 et +1 durables ; un état durable.
  const etat = jouer(
    BILAN,
    { type: "effet", genre: "multiplier", source: FRAPPE, k: 2 },
    { type: "effet", genre: "attaque", source: FRAPPE, sur: "adv3", n: -2, duree: "tour" },
    { type: "effet", genre: "defense", source: FRAPPE, sur: "adv3", n: 1, duree: "combat" },
    { type: "effet", genre: "etat", source: FRAPPE, sur: "adv3", capacite: ETATS[1].capacites[0], duree: "combat" },
  );
  const [ids] = [etat.effets.map((effet) => effet.id)];
  const encours = palette(etat, FRAPPE).effetsEnCours;
  assert.deepEqual(
    encours.map(({ id, genre, nom, duree, couleur }) => [id, genre, nom, duree, couleur]),
    [
      [null, "multiplier", `${FOIS}2 (Frappe)`, "pour ce jet", "alerte"],
      [ids[0], "attaque", `Attaque de Marmiton n° 1 ${MOINS}2 (Frappe)`, "jusqu'au prochain tour d'Aubépine", "alerte"],
      [ids[1], "defense", "Défense de Marmiton n° 1 +1 (Frappe)", "jusqu'à la fin du combat", "favorable"],
      [ids[2], "etat", "Marmiton n° 1 : Étourdi (Frappe)", "jusqu'à la fin du combat", "alerte"],
    ],
  );
  assert.deepEqual([encours[0].retirer, encours[1].retirer, encours[2].retirer], [null, null, null], "ni un effet du geste, ni un ±N ne se retirent");
  const retirer = encours[3].retirer;
  const evenement = { type: "mj", genre: "etat", qui: "adv3", retrait: ids[2] };
  assert.deepEqual(retirer, { libelle: "Retirer l'état Étourdi", actif: false, raison: LE_GESTE_D_ABORD, commande: { evenement }, mj: true });
  assert.ok(!accepte(etat, evenement));
  // Le geste fini : le ✕ s'applique ; les effets du geste s'en sont allés.
  const fini = jouer(etat, CONTENU.evenements.slice(N_BILAN, N_SUITES + 1));
  assert.equal(momentDe(fini), null);
  const apres = palette(fini, FRAPPE).effetsEnCours;
  assert.deepEqual(apres.map((effet) => effet.genre), ["attaque", "defense", "etat"]);
  assert.equal(apres[2].retirer.actif, true);
  assert.ok(accepte(fini, apres[2].retirer.commande.evenement));
  // Une autre source ne montre pas ce que Frappe a posé.
  assert.deepEqual(palette(fini, MJ).effetsEnCours, []);
});

// ─── La palette : l'aperçu et « Appliquer » ─────────────────────────────────

test("palette : l'aperçu hors d'un geste — rendre, ±N, un état, déplacer — est la ligne que le moteur écrira", () => {
  const blesse = TENUS[rangDe((un) => un.phase === "combat" && momentDe(un) === null && un.protagonistes.pj1.zones.some((zone) => zone.armure < zone.armureMax), "Aubépine entamée")];
  const zone = blesse.protagonistes.pj1.zones.findIndex((une) => une.armure < une.armureMax);
  const { armure, armureMax } = blesse.protagonistes.pj1.zones[zone];
  const nomDeZone = blesse.photos.pj1.zones[zone].nom.toLowerCase();
  const cas = [
    [blesse, { genre: "rendre", valeurs: { sur: "pj1", ressource: "armure", zone, n: 1 } }, `Aubépine, ${nomDeZone} : armure ${armure} ${FLECHE} ${Math.min(armureMax, armure + 1)} (MJ).`],
    [ENTRE_DEUX, { genre: "attaque", valeurs: { sur: "adv3", n: -2 } }, `Attaque de Marmiton n° 1 : 4 ${FLECHE} 2 (MJ), jusqu'au prochain tour des PJ.`],
    [ENTRE_DEUX, { genre: "etat", valeurs: { sur: "adv3", libre: "Couvert de farine", duree: "combat" } }, `Marmiton n° 1 : état ${OUVRANT} Couvert de farine ${FERMANT} (MJ), jusqu'à la fin du combat.`],
    [ENTRE_DEUX, { genre: "etat", valeurs: { sur: "adv3", capacite: "1:0" } }, "Marmiton n° 1 : état Étourdi (MJ), jusqu'au prochain tour des PJ."],
    [ENTRE_DEUX, { genre: "deplacer", valeurs: { sur: "adv3", vers: "J3" } }, `Marmiton n° 1 : déplacé, ${ENTRE_DEUX.protagonistes.adv3.case} ${FLECHE} J3, sans action (MJ).`],
  ];
  for (const [etat, choisi, phrase] of cas) {
    const vue = palette(etat, MJ, choisi);
    assert.equal(vue.apercu, `Le journal écrira : ${phrase}`, choisi.genre);
    assert.equal(vue.appliquer.actif, true);
    // Le moteur écrit cette ligne, et pas une autre.
    assert.equal(jouer(etat, vue.appliquer.commande.evenement).journal.at(-1).texte, phrase);
  }
});

test("palette : l'aperçu pendant un geste — la phrase de l'effet ; un dé et des dégâts par la ligne en cours", () => {
  // ±N pour ce jet, avant le premier dé : sa phrase ; la ligne du geste fini la porte.
  const ecart = palette(PREPARATION, FRAPPE, { genre: "attaque", valeurs: { sur: "adv3", n: -2 } });
  const phrase = `Attaque de Marmiton n° 1 : 4 ${FLECHE} 2 (Frappe), pour ce jet.`;
  assert.equal(ecart.apercu, `Le journal écrira : ${phrase}`);
  const fini = jouer(PREPARATION, ecart.appliquer.commande.evenement, CONTENU.evenements.slice(N_PREPARATION, N_SUITES + 1));
  assert.ok(fini.journal.at(-1).texte.includes(phrase), fini.journal.at(-1).texte);
  assert.equal(palette(SUITES, FRAPPE, { genre: "etat", valeurs: { capacite: "1:0", duree: "combat" } }).apercu, "Le journal écrira : Marmiton n° 1 : état Étourdi (Frappe), jusqu'à la fin du combat.");
  assert.equal(palette(SUITES, FRAPPE, { genre: "deplacer", valeurs: { sur: "adv3", vers: "E5" } }).apercu, `Le journal écrira : Marmiton n° 1 : déplacé, D4 ${FLECHE} E5, sans action (Frappe).`);
  // Un dé : la phrase du jet qui change, inachevée.
  const inverse = palette(JET, FRAPPE, { genre: "inverser", valeurs: {} }).apercu;
  assert.ok(inverse.startsWith("Le journal écrira : d10+1 contre 5") && inverse.includes("inversé (Frappe)") && inverse.endsWith(POINTS), inverse);
  // Des dégâts aux suites : la phrase du jet, finie ; au bilan, où la ligne n'a que les réussites : le bilan.
  const auxSuites = palette(SUITES, FRAPPE, { genre: "multiplier", valeurs: { k: 2 } }).apercu;
  assert.ok(auxSuites.includes(`: 1 réussite, A = 3, ${FOIS}2 (Frappe) : 6, +1 contre l'armure (Réduction).`) && !auxSuites.endsWith(POINTS), auxSuites);
  assert.equal(palette(BILAN, FRAPPE, { genre: "multiplier", valeurs: { k: 2 } }).apercu, `Le journal écrira : 1 réussite, A = 3, ${FOIS}2 (Frappe) : 6, +1 contre l'armure (Réduction).`);
  assert.equal(palette(SUITES, FRAPPE, { genre: "zone", valeurs: { de: 0, zone: 0 } }).apercu, `Le journal écrira : Localisation d20 ${FLECHE} 16, zone choisie (Frappe) : torse.`);
  assert.equal(palette(BILAN, FRAPPE, { genre: "toute_la_case", valeurs: {} }).apercu, "Le journal écrira : Aubépine : Frappe contre Marmiton n° 1, cible 1 sur 2.");
  // Rien d'écrit encore : des avantages avant le premier dé, une attaque en plus.
  const avantages = palette(PREPARATION, FRAPPE, { genre: "avantages", valeurs: { nombre: 2 } });
  assert.deepEqual([avantages.apercu, avantages.appliquer.actif], [null, true]);
  assert.equal(palette(BILAN, FRAPPE, { genre: "attaque_en_plus", valeurs: {} }).apercu, null);
});

test("palette : « Appliquer », actif et accepté, ou inactif avec la raison du juge, de la forme, ou de la simulation", () => {
  const actif = palette(ENTRE_DEUX, MJ, { genre: "defense", valeurs: { sur: "adv4", n: 3, duree: "combat" } }).appliquer;
  const evenement = { type: "effet", genre: "defense", source: MJ, sur: "adv4", n: 3, duree: "combat" };
  assert.deepEqual(actif, { libelle: "Appliquer", actif: true, raison: null, commande: { evenement } });
  assert.ok(accepte(ENTRE_DEUX, evenement));
  const lire = (choisi, etat = ENTRE_DEUX, source = MJ) => {
    const { appliquer: bouton } = palette(etat, source, choisi);
    return [bouton.actif, bouton.raison, bouton.commande];
  };
  const plein = lire({ genre: "rendre", valeurs: { sur: "pj1", ressource: "souffle", n: 2 } });
  assert.deepEqual(plein.slice(0, 2), [false, "Déjà au maximum."]);
  assert.equal(refusDe(ENTRE_DEUX, plein[2].evenement).message, "Déjà au maximum.");
  assert.deepEqual(lire({ genre: "deplacer", valeurs: { sur: "adv3" } }), [false, "Touchez la case d'arrivée.", null]);
  assert.deepEqual(lire({ genre: "deplacer", valeurs: { sur: "adv3", vers: ENTRE_DEUX.protagonistes.adv3.case } }).slice(0, 2), [false, "Ce protagoniste est déjà sur cette case."]);
  const zero = lire({ genre: "attaque", valeurs: { sur: "adv3", n: 0 } });
  assert.equal(zero[0], false);
  assert.match(zero[1], /autre que 0\.$/);
  assert.equal(zero[2], null);
  const horsGeste = lire({ genre: "relancer", valeurs: {} });
  assert.deepEqual(horsGeste.slice(0, 2), [false, "Hors d'un geste."]);
  assert.equal(refusDe(ENTRE_DEUX, horsGeste[2].evenement).message, "Hors d'un geste.");
  // La simulation refuse : sa raison.
  const refuse = vuePalette(ENTRE_DEUX, MJ, { etats: ETATS, choisi: { genre: "attaque", valeurs: { sur: "adv3", n: 2 } }, simuler: () => ({ refus: { code: "interdit", message: "Refusé par l'essai." } }) });
  assert.deepEqual([refuse.appliquer.actif, refuse.appliquer.raison, refuse.apercu], [false, "Refusé par l'essai.", null]);
});

test("palette : la simulation, une fois par rendu, pour la seule commande choisie et acceptée ; sans elle, l'aperçu est nul", () => {
  const appels = [];
  const compter = (etat) => (evenement) => {
    appels.push(evenement);
    return appliquer(etat, evenement);
  };
  vuePalette(BILAN, FRAPPE, { etats: ETATS, choisi: null, simuler: compter(BILAN) });
  assert.equal(appels.length, 0, "sans choix");
  vuePalette(BILAN, FRAPPE, { etats: ETATS, choisi: { genre: "multiplier", valeurs: { k: 3 } }, simuler: compter(BILAN) });
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0], { type: "effet", genre: "multiplier", source: FRAPPE, k: 3 });
  vuePalette(BILAN, FRAPPE, { etats: ETATS, choisi: { genre: "avantages", valeurs: {} }, simuler: compter(BILAN) });
  assert.equal(appels.length, 1, "un genre inactif : pas de simulation");
  const surSaCase = vuePalette(BILAN, FRAPPE, { etats: ETATS, choisi: { genre: "deplacer", valeurs: { sur: "adv3", vers: BILAN.protagonistes.adv3.case } }, simuler: compter(BILAN) });
  assert.equal(appels.length, 1, "refusé par le juge : pas de simulation");
  assert.deepEqual([surSaCase.appliquer.actif, surSaCase.appliquer.raison], [false, "Ce protagoniste est déjà sur cette case."]);
  const sans = vuePalette(BILAN, FRAPPE, { etats: ETATS, choisi: { genre: "multiplier", valeurs: { k: 3 } } });
  assert.deepEqual([sans.apercu, sans.appliquer.actif], [null, true]);
});

// ─── Le menu du MJ ──────────────────────────────────────────────────────────

const menu = (etat, id, saisies = null, apports = {}) => vueMenuMj(etat, id, { etats: ETATS, saisies, simuler: simulerSur(etat), ...apports });

test("menu du MJ : un personnage — ses entrées, ses valeurs, ses états, la phrase de chacune", () => {
  const vue = menu(ENTRE_DEUX, "pj1");
  const { case: laCase } = ENTRE_DEUX.protagonistes.pj1;
  assert.deepEqual([vue.titre, vue.sous, vue.actif, vue.raison, vue.mj], ["Aubépine Crèmebrûlée", `personnage ${POINT} ${laCase} ${POINT} corps 10/10`, true, null, true]);
  assert.equal(vue.note, "Ne change que ce combat ; le journal l'écrit.");
  const { valeurs } = vue;
  assert.deepEqual([valeurs.libelle, valeurs.texte, valeurs.titre, valeurs.sous, valeurs.actif, valeurs.mj], [
    `Modifier une valeur${POINTS}`,
    "attaque, défense, souffle, actions, lien, corps, armure et endurance d'une zone",
    `Modifier ${TIRET} Aubépine Crèmebrûlée`,
    "pour ce combat seulement",
    true,
    true,
  ]);
  const zones = ENTRE_DEUX.photos.pj1.zones;
  assert.deepEqual(
    valeurs.champs.map((champ) => champ.cle),
    ["souffle", "souffleMax", "actions", "actionsMax", "lien:0", "corps", ...zones.flatMap((zone, rang) => [`armure:${rang}`, `endurance:${rang}`]), "bouclier"],
    "ni attaque ni défense chez un personnage",
  );
  const champ = (cle) => valeurs.champs.find((un) => un.cle === cle);
  assert.deepEqual(champ("lien:0"), { cle: "lien:0", libelle: "Lien de Grand Four", sous: "sur 1", valeur: 1, min: 0, max: 999, entree: { champ: "lien", jauge: 0 } });
  assert.deepEqual([champ("corps").libelle, champ("corps").sous], ["Corps", "sur 10"]);
  assert.deepEqual([champ("actions").sous, champ("souffle").libelle], ["maximum 2", "Souffle"]);
  assert.deepEqual([champ("armure:1").libelle, champ("endurance:1").libelle, champ("endurance:1").entree], [`${zones[1].nom}, armure`, `${zones[1].nom}, endurance`, { champ: "endurance", zone: 1 }]);
  assert.deepEqual([champ("bouclier").libelle, champ("bouclier").sous, champ("bouclier").valeur], ["Défense du bouclier", "8 au départ", 8]);
  assert.deepEqual(valeurs.gabarit, { evenement: { type: "mj", genre: "valeurs", qui: "pj1" } });
  assert.deepEqual([vue.equipement.libelle, vue.equipement.texte, vue.equipement.actif], [`Changer l'équipement${POINTS}`, "l'arme tenue, la qualité des objets", true]);
  const { etats } = vue;
  assert.deepEqual([etats.libelle, etats.texte, etats.titre, etats.sous, etats.source], [`Ajouter ou retirer un état${POINTS}`, "un état du classeur, ou un état libre", "Un état pour Aubépine Crèmebrûlée", "du classeur, ou libre", "Source : le MJ (menu du jeton)."]);
  assert.deepEqual(etats.blocs.map((bloc) => [bloc.titre, bloc.options.map((option) => option.libelle)]), [
    ["Blessure (bloc du classeur)", ["Cheville tordue", "Main brûlée", "Côtes froissées"]],
    ["Condition (bloc du classeur)", ["Étourdi", "En nage", "Affamé"]],
  ]);
  assert.deepEqual(etats.blocs[1].options[0].gabarit, { evenement: { type: "mj", genre: "etat", qui: "pj1", ajout: { capacite: ETATS[1].capacites[0] } } });
  assert.equal(etats.blocs[1].options[0].texte, "Votre prochaine action coûte une action de plus.");
  assert.deepEqual([etats.libre.libelle, etats.libre.aide, etats.libre.max], ["État libre", `Un nom : ${OUVRANT} À terre ${FERMANT}, ${OUVRANT} Dans la fumée ${FERMANT}${POINTS}`, 40]);
  assert.deepEqual(etats.durees, [
    { valeur: "tour", libelle: "jusqu'au prochain tour des PJ" },
    { valeur: "combat", libelle: "jusqu'à la fin du combat" },
  ]);
  assert.deepEqual(etats.portes, []);
  assert.deepEqual([vue.deplacer.libelle, vue.deplacer.texte, vue.deplacer.exclue], [`Déplacer sans action${POINTS}`, "touchez ensuite la case d'arrivée", laCase]);
  assert.deepEqual(vue.retirer, { libelle: "Retirer du combat", actif: true, raison: null, commande: { evenement: { type: "mj", genre: "retirer", qui: "pj1" } }, mj: true });
  verifierLesRaisons(vue, "menu de pj1");
});

test("menu du MJ : un adversaire — son attaque et sa défense, l'aperçu, « Aucune valeur ne change. »", () => {
  const vue = menu(ENTRE_DEUX, "adv3", { defense: 6 });
  assert.equal(vue.titre, "Marmiton de corvée n° 1");
  assert.equal(vue.sous, `adversaire ${POINT} ${ENTRE_DEUX.protagonistes.adv3.case} ${POINT} corps 10/10`);
  assert.deepEqual(vue.valeurs.champs.slice(0, 2).map(({ cle, libelle, sous, valeur }) => [cle, libelle, sous, valeur]), [
    ["attaque", "Attaque", "4 au départ", 4],
    ["defense", "Défense", "5 au départ", 5],
  ]);
  assert.equal(vue.valeurs.champs.some((champ) => champ.cle.startsWith("lien") || champ.cle === "bouclier"), false);
  assert.equal(vue.equipement.texte, "la cellule Équipement");
  assert.equal(vue.valeurs.apercu, `Le journal écrira : MJ : défense de Marmiton n° 1 : 5 ${FLECHE} 6.`);
  const evenement = { type: "mj", genre: "valeurs", qui: "adv3", valeurs: [{ champ: "defense", valeur: 6 }] };
  assert.deepEqual(vue.valeurs.enregistrer, { libelle: "Enregistrer", actif: true, raison: null, commande: { evenement }, mj: true });
  assert.equal(jouer(ENTRE_DEUX, evenement).journal.at(-1).texte, `MJ : défense de Marmiton n° 1 : 5 ${FLECHE} 6.`);
  // Rien qui change : ni saisie, ni saisie égale à la valeur.
  for (const saisies of [null, {}, { defense: 5 }]) {
    const rien = menu(ENTRE_DEUX, "adv3", saisies).valeurs;
    assert.deepEqual([rien.enregistrer.actif, rien.enregistrer.raison, rien.enregistrer.commande, rien.apercu], [false, "Aucune valeur ne change.", null, null]);
  }
  const hors = menu(ENTRE_DEUX, "adv3", { defense: 1000 }).valeurs.enregistrer;
  assert.deepEqual([hors.actif, hors.commande], [false, null]);
  assert.match(hors.raison, /999/);
  // Deux valeurs, dont une zone : une phrase chacune.
  const deux = menu(ENTRE_DEUX, "adv3", { attaque: 2, "armure:0": 0 }).valeurs;
  assert.equal(deux.apercu, `Le journal écrira : MJ : attaque de Marmiton n° 1 : 4 ${FLECHE} 2. MJ : Marmiton n° 1, torse : armure 30 ${FLECHE} 0.`);
  // La simulation : une fois, pour « Enregistrer » seul.
  const appels = [];
  vueMenuMj(ENTRE_DEUX, "adv3", { etats: ETATS, saisies: { defense: 6 }, simuler: (un) => appels.push(un) && appliquer(ENTRE_DEUX, un) });
  vueMenuMj(ENTRE_DEUX, "adv3", { etats: ETATS, saisies: null, simuler: (un) => appels.push(un) && appliquer(ENTRE_DEUX, un) });
  assert.equal(appels.length, 1);
  assert.equal(menu(ENTRE_DEUX, "adv3", { defense: 6 }, { simuler: null }).valeurs.apercu, null);
  verifierLesRaisons(vue, "menu de adv3");
});

test("menu du MJ : pendant un geste, tout est inactif, « Le geste en cours se finit d'abord. », et le moteur le refuse", () => {
  const vue = menu(BILAN, "adv3", { defense: 6 });
  const entrees = [vue, vue.valeurs, vue.valeurs.enregistrer, vue.equipement, vue.etats, vue.etats.libre, ...vue.etats.blocs.flatMap((bloc) => bloc.options), vue.deplacer, vue.retirer];
  for (const entree of entrees) assert.deepEqual([entree.actif, entree.raison, entree.mj], [false, LE_GESTE_D_ABORD, true]);
  assert.equal(vue.valeurs.apercu, null);
  assert.equal(refusDe(BILAN, vue.retirer.commande.evenement).message, LE_GESTE_D_ABORD);
  assert.equal(refusDe(BILAN, vue.valeurs.enregistrer.commande.evenement).message, LE_GESTE_D_ABORD);
  assert.equal(refusDe(BILAN, { ...vue.etats.blocs[1].options[0].gabarit.evenement, ajout: { capacite: ETATS[1].capacites[0], duree: "tour" } }).message, LE_GESTE_D_ABORD);
  verifierLesRaisons(vue, "menu pendant un geste");
});

test("menu du MJ : null pour un mort, un retiré, un inconnu ; un état porté se retire", () => {
  const mort = FINI.ordre.find((id) => FINI.protagonistes[id].mort !== null);
  assert.equal(menu(FINI, mort), null);
  const retire = jouer(ENTRE_DEUX, menu(ENTRE_DEUX, "adv4").retirer.commande.evenement);
  assert.equal(menu(retire, "adv4"), null);
  assert.equal(menu(ENTRE_DEUX, "adv9"), null);
  // L'état ajouté par le menu, puis retiré par lui.
  const gabarit = menu(ENTRE_DEUX, "adv3").etats.blocs[1].options[0].gabarit.evenement;
  const porte = jouer(ENTRE_DEUX, { ...gabarit, ajout: { ...gabarit.ajout, duree: "tour" } });
  const [une] = menu(porte, "adv3").etats.portes;
  const id = porte.effets.at(-1).id;
  assert.deepEqual(une, { libelle: "Étourdi", actif: true, raison: null, commande: { evenement: { type: "mj", genre: "etat", qui: "adv3", retrait: id } }, mj: true });
  assert.equal(jouer(porte, une.commande.evenement).effets.length, 0);
  // L'état libre et le déplacement, gabarits complétés comme l'écran le fait.
  const libre = menu(ENTRE_DEUX, "adv3").etats.libre.gabarit.evenement;
  assert.ok(accepte(ENTRE_DEUX, { ...libre, ajout: { libre: "À terre", duree: "combat" } }));
  const deplacer = menu(ENTRE_DEUX, "adv3").deplacer;
  assert.ok(accepte(ENTRE_DEUX, { ...deplacer.gabarit.evenement, vers: casesEntre(deplacer.exclue, 1, 1)[0] }));
});

// ─── La concordance, à quelques moments du combat de référence ──────────────

// L'événement d'un genre de la palette, tel que l'écran le complète : son
// gabarit, la valeur de chaque champ (le tuple de « rendre » étalé ; un état
// de la banque par sa capacité figée ; une case voisine pour l'arrivée), et la
// durée de l'onglet Durée. « remplace » : { nom, valeur } d'un champ.
function evenementDuGenre(etat, vue, source, genreVu, remplace = null) {
  const evenement = { ...genreVu.gabarit.evenement };
  for (const champ of genreVu.champs) {
    let valeur = remplace?.nom === champ.nom ? remplace.valeur : champ.valeur;
    if (champ.nom === "ressource") {
      Object.assign(evenement, valeur);
      continue;
    }
    if (champ.nom === "capacite") {
      if (Object.hasOwn(evenement, "libre")) continue;
      const [bloc, rang] = valeur.split(":").map(Number);
      valeur = ETATS[bloc].capacites[rang];
    }
    // L'écran demande une case autre que celle du protagoniste choisi.
    if (champ.nom === "vers" && valeur === null) valeur = casesEntre(etat.protagonistes[evenement.sur].case, 1, 1)[0];
    if (champ.nom === "libre" && valeur === null) continue;
    if (champ.sorte === "nombre" && Array.isArray(champ.exclus) && champ.exclus.includes(valeur)) valeur = champ.min;
    evenement[champ.nom] = valeur;
  }
  if (["attaque", "defense", "etat"].includes(genreVu.genre)) evenement.duree = dureeDe(palette(etat, source, { genre: genreVu.genre, valeurs: {} })).valeur;
  return evenement;
}

function eprouverLaPalette(etat, source, quoi) {
  const vue = palette(etat, source);
  verifierLesRaisons(vue, quoi);
  let eprouves = 0;
  const attendre = (evenement, actif, qui) => {
    const refus = refusDe(etat, evenement);
    eprouves += 1;
    if (actif) assert.equal(refus, null, `${qui} : actif, et refusé (${refus?.message}) : ${JSON.stringify(evenement)}`);
    else assert.notEqual(refus, null, `${qui} : inactif, et accepté : ${JSON.stringify(evenement)}`);
  };
  for (const genre of genresDe(vue)) {
    const qui = `${quoi}, ${genre.genre}`;
    attendre(evenementDuGenre(etat, vue, source, genre), genre.actif, qui);
    if (!genre.actif) continue;
    for (const champ of genre.champs) {
      if (champ.sorte === "nombre") {
        for (const borne of [champ.min, champ.max]) attendre(evenementDuGenre(etat, vue, source, genre, { nom: champ.nom, valeur: borne }), true, `${qui}, ${champ.nom} = ${borne}`);
        continue;
      }
      if (champ.sorte !== "option" && champ.sorte !== "cibles") continue;
      // Rendre : un protagoniste est actif s'il a une ressource à rendre ; ses ressources se lisent en le choisissant.
      if (genre.genre === "rendre" && champ.nom === "sur") {
        for (const option of champ.options) {
          const choisi = genreDe(palette(etat, source, { genre: "rendre", valeurs: { sur: option.valeur } }), "rendre");
          const ressources = champDe(choisi, "ressource").options;
          assert.equal(ressources.some((une) => une.actif), option.actif, `${qui}, sur = ${option.valeur}`);
          for (const une of ressources) attendre(evenementDuGenre(etat, vue, source, choisi, { nom: "ressource", valeur: une.valeur }), une.actif, `${qui}, ${JSON.stringify(une.valeur)}`);
        }
        continue;
      }
      for (const [rang, option] of optionsDe(champ).entries()) {
        if (champ.sorte === "cibles" && rang === 0) continue;
        const valeur = champ.sorte === "cibles" ? [champ.options[0].valeur, option.valeur] : option.valeur;
        attendre(evenementDuGenre(etat, vue, source, genre, { nom: champ.nom, valeur }), option.actif, `${qui}, ${champ.nom} = ${JSON.stringify(option.valeur)}`);
      }
    }
  }
  return eprouves;
}

function eprouverLeMenu(etat, id, quoi) {
  const vue = menu(etat, id, { souffle: 0 });
  verifierLesRaisons(vue, quoi);
  const voulu = (evenement, actif, qui) => assert.equal(refusDe(etat, evenement) === null, actif, `${qui} : ${JSON.stringify(evenement)}`);
  voulu(vue.retirer.commande.evenement, vue.retirer.actif, `${quoi}, retirer`);
  voulu({ ...vue.deplacer.gabarit.evenement, vers: casesEntre(vue.deplacer.exclue, 1, 1)[0] }, vue.deplacer.actif, `${quoi}, déplacer`);
  for (const option of vue.etats.blocs.flatMap((bloc) => bloc.options)) voulu({ ...option.gabarit.evenement, ajout: { ...option.gabarit.evenement.ajout, duree: "tour" } }, option.actif, `${quoi}, ${option.libelle}`);
  voulu({ ...vue.etats.libre.gabarit.evenement, ajout: { libre: "À terre", duree: "combat" } }, vue.etats.libre.actif, `${quoi}, état libre`);
  if (vue.valeurs.enregistrer.commande !== null) voulu(vue.valeurs.enregistrer.commande.evenement, vue.valeurs.enregistrer.actif, `${quoi}, enregistrer`);
}

test("concordance : aux moments où l'offre annonce « effet » et « mj », tout actif est accepté par le moteur, tout inactif refusé", (t) => {
  const rangs = [N_ENTRE_DEUX, N_PREPARATION, N_JET, N_BILAN, N_SUITES, N_ADVERSE, N_ADVERSE + 2, N_CONTRE, N_BLESSURE];
  let eprouves = 0;
  let effets = 0;
  let mj = 0;
  for (const rang of rangs) {
    const etat = TENUS[rang];
    const { types } = offre(etat);
    const geste = gesteEnCours(etat);
    if (types.includes("effet")) effets += 1;
    if (types.includes("mj")) mj += 1;
    const sources = geste === null ? [MJ] : [{ genre: "capacite", qui: geste.acteur, capacite: geste.capacite }, MJ];
    for (const source of sources) eprouves += eprouverLaPalette(etat, source, `état ${rang}, source ${JSON.stringify(source)}`);
    for (const id of etat.ordre) if (vueMenuMj(etat, id, {}) !== null) eprouverLeMenu(etat, id, `état ${rang}, menu de ${id}`);
  }
  assert.equal(effets, rangs.length, "l'offre annonce « effet » à chacun de ces moments");
  assert.ok(mj >= 2, "et « mj » entre deux gestes");
  assert.ok(eprouves > 500, `${eprouves} événements éprouvés`);
  t.diagnostic(`${eprouves} événements de la palette éprouvés, à ${rangs.length} moments`);
});
