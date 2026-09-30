// Le personnage d'essai et de démonstration (SPECIFICATION.md, § 15.7).
//
// Un Marmiton Saucier, tiré sous la Constellation du Sablier, lié au Grand
// Four, équipé de la batterie de cuisine du classeur d'essai : chaque règle
// du § 15.2 y trouve un cas. Contenu inventé, comme le classeur.

import { nouveauPersonnage } from "../../js/personnage/format.js";

export const DATE_ESSAI = new Date("2026-09-29T20:00:00.000Z");

export function personnageEssai(modifier = null) {
  const p = nouveauPersonnage("demo", DATE_ESSAI);
  Object.assign(p, {
    id: "demo-aubepine-0000000001",
    identite: {
      nom: "Aubépine Crèmebrûlée",
      age: "31 ans",
      description: "Petite, vive, un tablier de cuir roussi et une toque qui a vu des feux.",
      histoire: "Commis d'une auberge du port, elle a quitté les fourneaux le jour où le Grand Four lui a parlé.",
    },
    caracteristiques: { force: 4, agilite: 5, precision: 5, sens: 3, culture_neruvienne: 4, savoir_sauvage: 3, parole: 4, empathie: 4, creativite: 4 },
    espece: { nom: "Marmiton", choix: [] },
    archetype: { nom: "Saucier", choix: ["Solo du chef", "Maîtrise de l'agile"] },
    constellation: { nom: "Constellation du Sablier", choix: [], obtention: "tirage", tirages: 3 },
    primordial: { nom: "Grand Four", choix: ["Cendre"] },
    equipement: [
      { nom: "Couteau d'office", choix: [], qualite: "2", place: "arme" },
      { nom: "Rouleau de fonte", choix: [], qualite: null, place: "sac" },
      { nom: "Tablier de cuir", choix: [], qualite: "2", place: "equipe" },
      { nom: "Plastron de fonte", choix: [], qualite: null, place: "sac" },
      { nom: "Guêtres de toile", choix: [], qualite: null, place: "equipe" },
      { nom: "Maniques", choix: [], qualite: "1", place: "equipe" },
      { nom: "Toque renforcée", choix: [], qualite: "3", place: "equipe" },
      { nom: "Couvercle de marmite", choix: [], qualite: "2", place: "equipe" },
      { nom: "Bouillon revigorant", choix: [], qualite: null, place: "sac" },
    ],
    niveaux: [{ capacite: "Flambage", niveau: 2 }],
  });
  if (modifier) modifier(p);
  return p;
}
