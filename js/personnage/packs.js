// Les packs d'armure (SPECIFICATION.md, § 15.3 ; instruction du lot 2 bis).
//
// Un pack par type d'objet, lourd, agile ou précis : toutes les pièces
// d'armure de ce type, une par zone, équipées d'office. Le livret (« Objet »)
// ne permet pas de porter deux pièces sur une même zone : un type qui en
// compte deux sur une zone n'a pas de pack, et le contrôle de la banque le
// signale (A10). Le créateur et le contrôle partagent cette règle.
//
// Une pièce couvre une zone quand la valeur écrite à ce rang de son
// paramètre armure (sans cible) n'est pas un zéro : le contrôle de la banque
// ne connaît pas les caractéristiques, il lit la valeur telle qu'écrite.

import { cle } from "../banque/noms.js";
import { typeDe } from "../banque/types.js";
import { lireNombre, rangs } from "./expressions.js";
import { PARAMETRES, RANGS, TYPES_OBJET, ZONES } from "./regles.js";

// Le nom du pack, au masculin : « pack lourd ».
export const NOMS_PACK = { lourde: "lourd", agile: "agile", precise: "précis" };

// Le type d'objet d'une pièce : l'élément Lourde, Agile ou Précise sans
// cible, un seul ; sinon null.
function typeDePiece(bloc) {
  const types = Object.entries(TYPES_OBJET)
    .filter(([, t]) => bloc.elements.some((e) => e.nom && !e.cible && cle(e.nom) === cle(t.element)))
    .map(([code]) => code);
  return types.length === 1 ? types[0] : null;
}

/** Les zones qu'une pièce couvre (codes de ZONES), lues dans son paramètre armure. */
export function zonesCouvertes(bloc) {
  const parametre = bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.armure);
  const morceaux = parametre ? rangs(parametre.valeur, RANGS.armure) : null;
  if (!morceaux) return [];
  return ZONES.filter((zone, i) => {
    const ecrit = morceaux[i].trim();
    if (ecrit === "") return false;
    const nombre = lireNombre(ecrit);
    return !(nombre && nombre.n === 0);
  }).map((zone) => zone.code);
}

/**
 * Les packs d'une liste de blocs (les pièces d'armure y sont retenues par
 * leur type de bloc). Rend un pack par type qui a au moins une pièce :
 * { type, nom, pieces: [blocs], conflits: [{ zone, nomZone, pieces: [blocs] }],
 * propose }. propose est faux dès que deux pièces couvrent une même zone.
 */
export function packsDArmure(blocs) {
  const packs = [];
  for (const type of Object.keys(TYPES_OBJET)) {
    const pieces = blocs.filter((bloc) => typeDe(bloc) === "armure" && typeDePiece(bloc) === type);
    if (!pieces.length) continue;
    const conflits = [];
    for (const zone of ZONES) {
      const surZone = pieces.filter((piece) => zonesCouvertes(piece).includes(zone.code));
      if (surZone.length > 1) conflits.push({ zone: zone.code, nomZone: zone.nom, pieces: surZone });
    }
    packs.push({ type, nom: NOMS_PACK[type], pieces, conflits, propose: conflits.length === 0 });
  }
  return packs;
}
