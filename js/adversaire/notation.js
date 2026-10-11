// La notation de la feuille « Adversaires » (SPECIFICATION.md, § 16.1).
//
// Chaque fonction lit le texte d'une cellule et rend ce qu'elle y trouve,
// avec ses défauts ; elle ne lève jamais d'exception et ne corrige rien. La
// banque garde les cellules telles qu'écrites (§ 5.1) : c'est ici qu'elles se
// lisent, à l'import pour le contrôle et dans la page pour l'affichage.
//
// Une cellule vide hérite. « aucune » ou « aucun », seul dans la cellule,
// veut dire rien pour une liste et 0 pour un nombre. « // » en tête d'une
// liste reprend la liste héritée et lui ajoute ce qui suit. Les nombres
// s'écrivent avec la virgule décimale, comme partout dans le classeur.

import { cle } from "../banque/noms.js";
import { decouper } from "../banque/notation.js";
import { fraction, lireNombre } from "../personnage/expressions.js";
import { ZONES } from "../personnage/regles.js";

// Les faces du d20 d'une grille d'adversaire : la face 1 est la
// contre-attaque, posée d'office (livret, « Jets de localisation » : un 1
// sur le jet d'attaque du joueur provoque toujours une contre-attaque).
export const FACE_CONTRE_ATTAQUE = 1;
export const PREMIERE_FACE = 2;
export const DERNIERE_FACE = 20;

// Un nom de zone proche d'une des six zones des personnages est reconnu
// jusqu'à cet écart, en lettres (décision de l'auteur, 11/10/2026).
export const ECART_ZONE = 2;

// Le texte d'une cellule, ses blancs réduits : espaces de bord retirés, et
// toute suite de blancs (retours à la ligne compris) ramenée à un espace.
// Les motifs qui suivent ne voient ainsi jamais un long blanc : sur une
// cellule de 32 000 espaces, ils prenaient une seconde (mesuré, lot 3).
const blancsReduits = (texte) => texteDe(texte).replace(/\s+/gu, " ").trim();

/**
 * Le texte d'une cellule. La banque les garde en chaînes (§ 5.1) ; une banque
 * abîmée pourrait porter autre chose, et un objet sans texte ferait lever la
 * conversion : tout ce qui n'est ni une chaîne ni un nombre vaut une cellule
 * vide.
 */
export function texteDe(cellule) {
  if (typeof cellule === "string") return cellule;
  return typeof cellule === "number" && Number.isFinite(cellule) ? String(cellule) : "";
}

// Un texte cité dans un message : coupé au-delà de cette longueur, pour
// qu'un nom démesuré, répété dans chaque anomalie de sa ligne, ne fasse pas
// un rapport démesuré (§ 9 : un nom forgé se cite coupé à 80 signes).
export const LONGUEUR_CITEE = 80;

/** Un texte tel qu'un message le cite : entier, ou ses 80 premiers signes suivis de « … ». */
export function citer(texte) {
  const signes = [...texteDe(texte)];
  return signes.length > LONGUEUR_CITEE ? `${signes.slice(0, LONGUEUR_CITEE).join("")}…` : signes.join("");
}

/** Vrai pour « aucune » ou « aucun », seul dans la cellule, sans casse ni accents. */
export function estAucun(texte) {
  const ecrit = cle(texteDe(texte));
  return ecrit === "aucune" || ecrit === "aucun";
}

/**
 * Une cellule de nombre : { genre: "herite" } pour une cellule vide,
 * { genre: "valeur", valeur } (une fraction exacte ; 0 pour « aucune »), ou
 * { genre: "illisible", ecrit }.
 */
export function lireNombreCellule(texte) {
  const ecrit = texteDe(texte).trim();
  if (ecrit === "") return { genre: "herite" };
  if (estAucun(ecrit)) return { genre: "valeur", valeur: fraction(0) };
  const valeur = lireNombre(ecrit);
  return valeur ? { genre: "valeur", valeur } : { genre: "illisible", ecrit };
}

/**
 * La colonne Type d'un adversaire : « Humain/Brigand[2] ». Rend { types:
 * [noms], multiplicateur: { ecrit, valeur } ou null }, et { defaut } quand
 * la notation ne se lit pas : le multiplicateur n'est permis qu'après le
 * dernier type, entre crochets fermés, et il est strictement positif.
 */
export function lireTypes(texte) {
  const ecrit = blancsReduits(texte);
  // « aucun » : aucun type, comme une cellule vide. Un adversaire n'hérite
  // de ses types que par cette colonne : il n'y a rien d'autre à effacer.
  if (ecrit === "" || estAucun(ecrit)) return { types: [], multiplicateur: null };
  const illisible = (defaut) => ({ types: [], multiplicateur: null, defaut });
  const ouvrants = [...ecrit].filter((signe) => signe === "[").length;
  const fermants = [...ecrit].filter((signe) => signe === "]").length;
  let corps = ecrit;
  let multiplicateur = null;
  if (ouvrants || fermants) {
    const ouvre = ecrit.indexOf("[");
    const ferme = ecrit.indexOf("]");
    if (ouvre === -1) return illisible("crochet « ] » sans « [ » qui l'ouvre");
    if (ferme === -1) return illisible("crochet « [ » jamais fermé");
    if (ouvrants > 1 || fermants > 1 || ferme < ouvre || ferme !== ecrit.length - 1) {
      return illisible("le multiplicateur n'est permis qu'une fois, après le dernier type");
    }
    const interieur = ecrit.slice(ouvre + 1, ferme).trim();
    if (interieur === "") return illisible("le multiplicateur est vide");
    const valeur = lireNombre(interieur);
    if (!valeur) return illisible(`le multiplicateur « ${citer(interieur)} » n'est pas un nombre positif`);
    if (valeur.n <= 0) return illisible("le multiplicateur est nul");
    corps = ecrit.slice(0, ouvre);
    multiplicateur = { ecrit: interieur, valeur };
  }
  const types = corps.split("/").map((nom) => nom.trim().replace(/\s+/gu, " "));
  if (types.some((nom) => nom === "")) return illisible("un nom de type manque");
  return { types, multiplicateur };
}

// La distance d'édition entre deux textes : le nombre de lettres à ajouter,
// retirer ou remplacer pour passer de l'un à l'autre.
function ecart(a, b) {
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= b.length; j += 1) {
      courante.push(Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    precedente = courante;
  }
  return precedente[b.length];
}

/**
 * La zone des personnages qu'un nom désigne : { code, approchee } ou null.
 * Le nom se compare sans casse, accents ni espaces ; à défaut, un nom à
 * deux lettres d'écart au plus d'une seule des six zones est reconnu, et
 * signalé (A11) : « Jambre droite » se lit « jambe droite ».
 */
export function reconnaitreZone(nom) {
  const ecrit = cle(nom);
  const exacte = ZONES.find((zone) => cle(zone.nom) === ecrit);
  if (exacte) return { code: exacte.code, approchee: false };
  const proches = ZONES.map((zone) => ({ zone, ecart: ecart(ecrit, cle(zone.nom)) })).filter((p) => p.ecart <= ECART_ZONE);
  if (!proches.length) return null;
  const moindre = Math.min(...proches.map((p) => p.ecart));
  const meilleures = proches.filter((p) => p.ecart === moindre);
  return meilleures.length === 1 ? { code: meilleures[0].zone.code, approchee: true } : null;
}

/**
 * La colonne Localisation : « Torse(2), Jambe gauche(12), … », la première
 * face de chaque zone. Rend { genre: "herite" }, ou { genre: "zones", zones,
 * defauts } : les zones rangées par leur première face, chacune { nom, code,
 * approchee, debut, fin }, la dernière allant jusqu'à 20. Dès qu'un défaut
 * existe (face hors de 2 à 20, deux zones sur une face, faces non
 * couvertes, forme non reconnue), la grille n'est pas rendue : zones est
 * vide. « aucune » rend une grille vide, sans défaut.
 */
export function lireLocalisation(texte) {
  const ecrit = blancsReduits(texte);
  if (ecrit === "") return { genre: "herite" };
  if (estAucun(ecrit)) return { genre: "zones", zones: [], defauts: [] };
  const defauts = [];
  const lues = [];
  for (const { texte: morceau, defaut } of decouper(ecrit, ",")) {
    const forme = defaut ? null : /^([^()[\]{}|]+?)\s*\(\s*([^()[\]{}|]*?)\s*\)$/su.exec(morceau);
    if (!forme) {
      defauts.push(`« ${citer(morceau)} » ne s'écrit pas Nom(face)`);
      continue;
    }
    const nom = forme[1].trim().replace(/\s+/gu, " ");
    if (!/^\d{1,3}$/.test(forme[2])) {
      defauts.push(`« ${citer(nom)} » : « ${citer(forme[2])} » n'est pas une face du d20`);
      continue;
    }
    const face = Number(forme[2]);
    if (face === FACE_CONTRE_ATTAQUE) defauts.push(`« ${citer(nom)} » commence sur la face 1, qui est la contre-attaque`);
    else if (face < PREMIERE_FACE || face > DERNIERE_FACE) defauts.push(`« ${citer(nom)} » commence sur la face ${face}, hors de ${PREMIERE_FACE} à ${DERNIERE_FACE}`);
    else lues.push({ nom, face });
  }
  lues.sort((a, b) => a.face - b.face);
  for (let i = 1; i < lues.length; i += 1) {
    if (lues[i].face === lues[i - 1].face) defauts.push(`« ${citer(lues[i - 1].nom)} » et « ${citer(lues[i].nom)} » commencent sur la même face, ${lues[i].face}`);
  }
  if (!defauts.length && lues.length === 0) defauts.push("aucune zone n'y est écrite");
  if (!defauts.length && lues[0].face !== PREMIERE_FACE) {
    const derniere = lues[0].face - 1;
    defauts.push(derniere === PREMIERE_FACE ? `aucune zone ne couvre la face ${PREMIERE_FACE}` : `aucune zone ne couvre les faces ${PREMIERE_FACE} à ${derniere}`);
  }
  if (defauts.length) return { genre: "zones", zones: [], defauts };
  const zones = lues.map((zone, i) => {
    const reconnue = reconnaitreZone(zone.nom);
    return {
      nom: zone.nom,
      code: reconnue?.code ?? null,
      approchee: reconnue?.approchee ?? false,
      debut: zone.face,
      fin: i + 1 < lues.length ? lues[i + 1].face - 1 : DERNIERE_FACE,
    };
  });
  return { genre: "zones", zones, defauts: [] };
}

/**
 * Une colonne de liste, Equipement ou Capacités : des noms, chacun avec un
 * nombre éventuel entre crochets (la qualité d'un objet, le rang d'une
 * capacité). Rend { genre: "herite" }, ou { genre: "liste", reprise,
 * entrees, defauts } : reprise est vrai quand la liste commence par « // » ;
 * chaque entrée est { nom, crochet } (crochet : le texte entre crochets, ou
 * null). Une entrée illisible n'entre pas dans la liste, et laisse un défaut.
 */
export function lireListe(texte) {
  let ecrit = blancsReduits(texte);
  if (ecrit === "") return { genre: "herite" };
  if (estAucun(ecrit)) return { genre: "liste", reprise: false, entrees: [], defauts: [] };
  const reprise = ecrit.startsWith("//");
  if (reprise) ecrit = ecrit.slice(2).replace(/^\s*,/u, "");
  const entrees = [];
  const defauts = [];
  for (const { texte: morceau, defaut } of decouper(ecrit, ",")) {
    if (defaut) {
      defauts.push(`« ${citer(morceau)} » : ${defaut}`);
      continue;
    }
    if (morceau.startsWith("//")) {
      defauts.push(`« ${citer(morceau)} » : « // » ne se place qu'en tête de la liste`);
      continue;
    }
    const forme = /^([^()[\]{}|]+?)\s*(?:\[([^()[\]{}|]*)\])?$/su.exec(morceau);
    if (!forme) {
      defauts.push(`« ${citer(morceau)} » : forme non reconnue`);
      continue;
    }
    entrees.push({ nom: forme[1].trim().replace(/\s+/gu, " "), crochet: forme[2] === undefined ? null : forme[2].trim() });
  }
  return { genre: "liste", reprise, entrees, defauts };
}
