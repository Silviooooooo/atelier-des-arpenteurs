// Les types de blocs (SPECIFICATION.md, § 4.1 et § 6.3).
//
// Le type d'un bloc est lu dans la colonne « Type » de la feuille Blocs, et
// comparé sans casse, sans accents ni espaces : « Equipement » est
// « Équipement ». Les types reconnus sont ceux que le livret énumère
// (« Système », « Blocs »). Le livret nomme aussi « Style de combat » et
// « Constellation de naissance » : le premier est reconnu, le second vaut
// « Constellation », comme dans le classeur (§ 12). Un bloc sans type (A8)
// ou d'un type inconnu (A9) reste dans la banque, mais le créateur de
// personnage ne le voit pas.

import { cle } from "./noms.js";

/** Les types reconnus, sous leur nom affiché ; chacun avec ses écritures admises. */
export const TYPES = {
  base: { nom: "Base", ecritures: ["Base"] },
  espece: { nom: "Espèce", ecritures: ["Espèce"] },
  archetype: { nom: "Archétype", ecritures: ["Archétype"] },
  style: { nom: "Style de combat", ecritures: ["Style de combat"] },
  constellation: { nom: "Constellation", ecritures: ["Constellation", "Constellation de naissance"] },
  primordial: { nom: "Primordial", ecritures: ["Primordial"] },
  arme: { nom: "Arme", ecritures: ["Arme"] },
  armure: { nom: "Armure", ecritures: ["Armure"] },
  equipement: { nom: "Équipement", ecritures: ["Équipement"] },
  consommable: { nom: "Consommable", ecritures: ["Consommable"] },
  blessure: { nom: "Blessure", ecritures: ["Blessure"] },
  etat: { nom: "État", ecritures: ["État"] },
};

const PAR_CLE = new Map(Object.entries(TYPES).flatMap(([code, { ecritures }]) => ecritures.map((ecriture) => [cle(ecriture), code])));

/**
 * Le code du type d'un bloc (« arme », « espece »…), ou null : bloc sans
 * type, type inconnu, ou banque publiée avant la colonne « Type ».
 */
export function typeDe(bloc) {
  return PAR_CLE.get(cle(bloc?.type ?? "")) ?? null;
}

/** Vrai quand un type est écrit mais inconnu (A9). */
export function typeInconnu(bloc) {
  return typeof bloc?.type === "string" && bloc.type.trim() !== "" && typeDe(bloc) === null;
}

/**
 * Vrai quand la banque a été publiée avant la colonne « Type » : ses blocs
 * n'ont pas de champ type. Le créateur a alors besoin d'une banque
 * republiée ; la consultation, elle, continue.
 */
export function banqueSansTypes(banque) {
  return banque.blocs.length > 0 && banque.blocs.some((bloc) => typeof bloc.type !== "string");
}
