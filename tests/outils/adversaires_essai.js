// Des feuilles « Adversaires » fabriquées au moment de l'essai (SPECIFICATION.md,
// § 10.3 et § 16).
//
// La feuille du classeur d'essai sert aussi à la démonstration : elle ne
// porte que trois anomalies. Chaque autre code de la feuille (§ 6.3, E8 à
// E16, A11 à A16, I4, I5, et les codes communs E1, E2, E6, A1, I1) se
// déclenche ici, sur une variante : un socle de trois lignes sans défaut,
// plus la ligne fautive. Chaque cas dit, mot pour mot, les anomalies que la
// feuille doit produire ; tests/adversaires.test.js les vérifie une à une,
// et tests/controle.test.js y prend les codes que le classeur d'essai seul
// ne déclenche pas.

import { CLASSEUR_ESSAI, CLASSEUR_PROPRE } from "./classeur_essai.js";

const _ = null;

export const ENTETES = ["Nom", "Type", "Localisation", "Nombre d'actions", "Souffle", "Attaque", "Défense", "Equipement", "Capacités"];
export const HUMANOIDE = "Torse(2), Jambe gauche(12), Jambe droite(14), Bras gauche(16), Bras droit(18), Tête(20)";

// Lignes 2, 3 et 4 de la feuille : deux types et un adversaire, sans défaut.
export const SOCLE = [
  ["Type", "Commis", HUMANOIDE, 1, 2, 3, 4, _, "Pas chassé"],
  ["Type", "Rôtisseur", _, _, 5, 4, 5, "Spatule souple, Armure agile", "//, Maîtrise de l'agile[1]"],
  ["Marmiton", "Commis/Rôtisseur"],
];

/**
 * Le classeur d'essai, sa feuille Adversaires remplacée par le socle suivi
 * des lignes données (la première est donc la ligne 5). blocs et capacites
 * s'ajoutent à la fin de leur feuille, dans l'ordre de ses colonnes.
 */
export function avecAdversaires(lignes, { blocs = [], capacites = [], socle = true, entetes = ENTETES, base = CLASSEUR_ESSAI } = {}) {
  const description = structuredClone(base);
  const feuille = (nom) => description.feuilles.find((f) => f.nom === nom);
  feuille("Adversaires").lignes = [entetes, ...(socle ? SOCLE : []), ...lignes];
  feuille("Blocs").lignes.push(...blocs);
  feuille("Capacites").lignes.push(...capacites);
  return description;
}

/** Le classeur d'essai sans sa feuille Adversaires (I4). */
export function sansAdversaires(base = CLASSEUR_ESSAI) {
  const description = structuredClone(base);
  description.feuilles = description.feuilles.filter((f) => f.nom !== "Adversaires");
  return description;
}

// Une armure dont le nombre de valeurs ne va à personne, et une autre qui
// ne se calcule pas : colonnes de la feuille Blocs du classeur d'essai.
const JUPE = ["Jupe de mailles", "Armure", _, "{armure:5/5/5}", "E12 : trois valeurs", "Armure"];
const COTTE = ["Cotte hantée", "Armure", _, "{armure:{force}/0/0/0/0/0}", "E14 : une armure qui ne se calcule pas", "Armure"];
const SIX_ZONES = "Écaille A(2), Écaille B(5), Écaille C(8), Écaille D(11), Écaille E(14), Écaille F(17)";
// Une araignée : six zones, dont la seule tête porte un nom de personnage, et
// une armure naturelle à six valeurs, écrite pour elle dans l'ordre du d20.
const ARAIGNEE = "Abdomen(2), Patte avant(8), Patte du milieu(11), Patte arrière(14), Crochets(17), Tête(20)";
const CHITINE = ["Chitine", "Armure", _, "{armure:20/5/5/5/8/10}", "Armure naturelle à six valeurs ; I3", "Armure naturelle"];
// Une arme dont le classeur fixe la qualité, et une capacité à deux
// variantes, sans la puissance 2 : colonnes de Blocs et de Capacites.
const HACHOIR = ["Hachoir béni", "Arme, Agile", "Frappe", "{degats:6/9/12}, {qualite:5}, {portee:0}", "Qualité fixée par le classeur", "Arme"];
const BOND = [["Bond", 1, 1, _, _, "Bondit.", "Variantes 1 et 3, sans la 2"], ["Bond", 3, 3, _, _, "Bondit loin.", _]];

/**
 * Les cas fautifs : { code, cas, description, attendues }. attendues liste
 * toutes les anomalies de la feuille Adversaires, dans l'ordre du rapport :
 * [code, ligne, message].
 */
export const FAUTES = [
  {
    code: "E8",
    cas: "un type cité introuvable ; l'adversaire, sans rien d'hérité, n'est pas en plus dit incomplet",
    description: avecAdversaires([["Fantôme", "Spectre"]]),
    attendues: [["E8", 5, "L'adversaire « Fantôme » cite le type « Spectre », introuvable parmi les types de la feuille Adversaires."]],
  },
  {
    code: "E9",
    cas: "multiplicateur ailleurs qu'après le dernier type, crochet non fermé, multiplicateur nul, négatif ; un nom de type à barre oblique",
    description: avecAdversaires([["A", "Commis[2]/Rôtisseur"], ["B", "Commis[2"], ["C", "Commis[0]"], ["D", "Commis[-2]"], ["E", "Commis//Rôtisseur"], ["Type", "Mi/Cuit", "Corps(2)", 1, 1, 1, 1]]),
    attendues: [
      ["E9", 5, "L'adversaire « A » : la colonne Type, « Commis[2]/Rôtisseur », ne se lit pas : le multiplicateur n'est permis qu'une fois, après le dernier type."],
      ["E9", 6, "L'adversaire « B » : la colonne Type, « Commis[2 », ne se lit pas : crochet « [ » jamais fermé."],
      ["E9", 7, "L'adversaire « C » : la colonne Type, « Commis[0] », ne se lit pas : le multiplicateur est nul."],
      ["E9", 8, "L'adversaire « D » : la colonne Type, « Commis[-2] », ne se lit pas : le multiplicateur « -2 » n'est pas un nombre positif."],
      ["E9", 9, "L'adversaire « E » : la colonne Type, « Commis//Rôtisseur », ne se lit pas : un nom de type manque."],
      // Un nom de type à barre oblique : aucun adversaire ne pourrait le citer, et aucun ne l'utilise.
      ["E9", 10, "Le type « Mi/Cuit » porte « / » ou un crochet dans son nom : la colonne Type d'un adversaire ne pourrait pas le citer."],
      ["I5", 10, "Le type « Mi/Cuit » n'est utilisé par aucun adversaire."],
    ],
  },
  {
    code: "E10",
    cas: "face hors de 2 à 20, deux zones sur une face, faces non couvertes, face 1, forme non reconnue",
    description: avecAdversaires([
      ["A", _, "Torse(2), Tête(21)", 1, 1, 1, 1],
      ["B", _, "Torse(2), Tête(2)", 1, 1, 1, 1],
      ["C", _, "Torse(5), Tête(18)", 1, 1, 1, 1],
      ["D", _, "Torse(1), Tête(18)", 1, 1, 1, 1],
      ["E", _, "Torse 2", 1, 1, 1, 1],
      ["F", _, "Torse(3)", 1, 1, 1, 1],
    ]),
    attendues: [
      ["E10", 5, "L'adversaire « A » : localisation invalide : « Tête » commence sur la face 21, hors de 2 à 20."],
      ["E10", 6, "L'adversaire « B » : localisation invalide : « Torse » et « Tête » commencent sur la même face, 2."],
      ["E10", 7, "L'adversaire « C » : localisation invalide : aucune zone ne couvre les faces 2 à 4."],
      ["E10", 8, "L'adversaire « D » : localisation invalide : « Torse » commence sur la face 1, qui est la contre-attaque."],
      ["E10", 9, "L'adversaire « E » : localisation invalide : « Torse 2 » ne s'écrit pas Nom(face)."],
      ["E10", 10, "L'adversaire « F » : localisation invalide : aucune zone ne couvre la face 2."],
    ],
  },
  {
    code: "E11",
    cas: "un objet qui n'est ni un bloc, ni un pack",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, "Fourchette magique"]]),
    attendues: [["E11", 5, "L'adversaire « A » cite l'objet « Fourchette magique », introuvable : ni un bloc, ni un pack d'armure (Armure lourde, Armure agile, Armure précise)."]],
  },
  {
    code: "E11",
    cas: "un pack dont aucune pièce n'existe",
    description: avecAdversaires([["Type", "Marmiton", "Corps(2), Tête(18)", 1, 2, 3, 4, "Armure agile", "Coup"], ["Apprenti", "Marmiton"]], { socle: false, base: CLASSEUR_PROPRE }),
    attendues: [["E11", 2, "Le type « Marmiton » cite le pack « Armure agile », mais aucun bloc de type Armure ne porte l'élément Agile."]],
  },
  {
    code: "E12",
    cas: "une armure à trois valeurs sur un adversaire à six zones",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, "Jupe de mailles"]], { blocs: [JUPE] }),
    attendues: [["E12", 5, "L'adversaire « A » porte « Jupe de mailles », dont l'armure a 3 valeurs : il en faut 1, 6, ou autant que ses zones (6)."]],
  },
  {
    code: "E13",
    cas: "une capacité introuvable",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, _, "Coup de pied retourné"]]),
    attendues: [["E13", 5, "L'adversaire « A » cite la capacité « Coup de pied retourné », introuvable dans Capacites."]],
  },
  {
    code: "E14",
    cas: "un nombre, une qualité, un rang, une armure illisibles ; un point au lieu de la virgule ; un rang sans variante ; des dégâts qui débordent",
    description: avecAdversaires(
      [
        ["A", "Commis", _, "beaucoup"],
        ["B", "Commis", _, _, _, _, _, "Spatule souple[fine]"],
        ["C", "Commis", _, _, _, _, _, _, "Pas chassé[deux]"],
        ["D", "Commis", _, _, _, _, _, _, "Pas chassé[0]"],
        ["E", "Commis", _, _, _, _, _, "Cotte hantée"],
        ["F", "Commis", _, _, "1.5"],
        ["G", _, "Corps(2)", 1, 1, "fort", 3],
        ["H", "Commis", _, _, _, _, _, "Hachoir béni[fin]"],
        ["I", "Commis", _, _, _, _, _, _, "Bond[2]"],
        ["J", "Commis", _, _, _, _, _, "Spatule souple[999999999,999999]"],
      ],
      { blocs: [COTTE, HACHOIR], capacites: BOND },
    ),
    attendues: [
      ["E14", 5, "L'adversaire « A » : le nombre d'actions, « beaucoup », n'est pas un nombre lisible."],
      ["E14", 6, "L'adversaire « B » : la qualité de « Spatule souple », « fine », n'est pas un nombre lisible ; elle vaut 2."],
      ["E14", 7, "L'adversaire « C » : le rang de « Pas chassé », « deux », n'est pas un entier lisible ; il vaut 1."],
      ["E14", 8, "L'adversaire « D » : le rang de « Pas chassé », « 0 », n'est pas un rang ; il vaut 1."],
      ["E14", 9, "L'adversaire « E » porte « Cotte hantée », dont l'armure, « {force}/0/0/0/0/0 », ne se calcule pas."],
      ["E14", 10, "L'adversaire « F » : le souffle, « 1.5 », n'est pas un nombre lisible."],
      // Une attaque illisible est signalée une fois : pas d'adversaire « incomplet » en plus.
      ["E14", 11, "L'adversaire « G » : l'attaque, « fort », n'est pas un nombre lisible."],
      // Le bloc fixe sa qualité à 5 : c'est elle qui vaut, pas 2.
      ["E14", 12, "L'adversaire « H » : la qualité de « Hachoir béni », « fin », n'est pas un nombre lisible ; elle vaut 5."],
      ["E14", 13, "L'adversaire « I » : « Bond » n'a pas de variante de puissance 2 ; son coût et sa description ne se lisent pas."],
      // Des dégâts qui débordent ne sont pas une « capacité d'arme sans arme » (A15) : l'arme est là.
      ["E14", 14, "L'adversaire « J » porte « Spatule souple », dont les dégâts, « 5/10/15 », ne se calculent pas à la qualité 1000000000."],
    ],
  },
  {
    code: "E15",
    cas: "sans attaque ; sans rien ; une localisation « aucune »",
    description: avecAdversaires([["A", _, "Corps(2)", 1, 1, _, 3], ["B"], ["C", "Commis", "aucune"]]),
    attendues: [
      ["E15", 5, "L'adversaire « A » est incomplet une fois l'héritage appliqué : sans attaque."],
      ["E15", 6, "L'adversaire « B » est incomplet une fois l'héritage appliqué : sans localisation, sans attaque, sans défense."],
      ["E15", 7, "L'adversaire « C » est incomplet une fois l'héritage appliqué : sans localisation."],
    ],
  },
  {
    code: "E16",
    cas: "deux types de même nom, deux adversaires de même nom",
    description: avecAdversaires([["Type", "Commis", _, 2], ["Marmiton", "Commis"]]),
    attendues: [
      ["E16", 5, "Le type « Commis » est déjà défini ligne 2."],
      ["E16", 6, "L'adversaire « Marmiton » est déjà défini ligne 4."],
    ],
  },
  {
    code: "A1",
    cas: "un type, un bloc et une capacité cités à la casse ou aux accents près",
    description: avecAdversaires([["A", "commis/ROTISSEUR", _, _, _, _, _, "//, couteau d'office", "//, pas chasse"]]),
    attendues: [
      ["A1", 5, "L'adversaire « A » cite « commis » pour le type « Commis » : seules la casse, les accents ou les espaces diffèrent."],
      ["A1", 5, "L'adversaire « A » cite « ROTISSEUR » pour le type « Rôtisseur » : seules la casse, les accents ou les espaces diffèrent."],
      ["A1", 5, "L'adversaire « A » cite « couteau d'office » pour le bloc « Couteau d'office » : seules la casse, les accents ou les espaces diffèrent."],
      ["A1", 5, "L'adversaire « A » cite « pas chasse » pour la capacité « Pas chassé » : seules la casse, les accents ou les espaces diffèrent."],
    ],
  },
  {
    code: "A11",
    cas: "une zone reconnue par approximation ; dans un type, elle se dit une fois, à sa ligne",
    description: avecAdversaires([["Type", "Mitron", "Torse(2), Jambre droite(14)", 1, 1, 1, 1], ["A", "Mitron"], ["B", "Mitron"], ["C", "Mitron[2]"]]),
    attendues: [["A11", 5, "Le type « Mitron » : la zone « Jambre droite » est reconnue par approximation comme « Jambe droite »."]],
  },
  {
    code: "A12",
    cas: "une armure à six valeurs dont une valeur ne trouve pas sa zone : elle ne couvre rien, ou, sur six zones, tout se pose dans l'ordre du d20",
    description: avecAdversaires(
      [
        ["A", _, "Corps(2), Queue(15)", 1, 1, 1, 1, "Tablier de cuir"],
        ["B", _, SIX_ZONES, 1, 1, 1, 1, "Tablier de cuir"],
        // Une seule zone nommée suffit pour que la toque se pose ; les maniques, elles, n'ont pas leurs bras.
        ["C", _, "Corps(2), Tête(18)", 1, 1, 1, 1, "Maniques, Toque renforcée"],
        ["D", _, ARAIGNEE, 1, 1, 1, 1, "Chitine"],
      ],
      { blocs: [CHITINE] },
    ),
    attendues: [
      ["A12", 5, "L'adversaire « A » porte « Tablier de cuir », une armure à six valeurs, sans avoir la zone torse : cette valeur ne couvre rien."],
      ["A12", 6, "L'adversaire « B » porte « Tablier de cuir », une armure à six valeurs, sans avoir la zone torse : ses six valeurs sont posées dans l'ordre du d20."],
      ["A12", 7, "L'adversaire « C » porte « Maniques », une armure à six valeurs, sans avoir les zones bras gauche et bras droit : ces valeurs ne couvrent rien."],
      ["A12", 8, "L'adversaire « D » porte « Chitine », une armure à six valeurs, sans avoir les zones torse, jambe gauche, jambe droite, bras gauche et bras droit : ses six valeurs sont posées dans l'ordre du d20."],
    ],
  },
  {
    code: "A13",
    cas: "un rang au-delà du maximum",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, _, "Pas chassé[5]"]]),
    attendues: [["A13", 5, "L'adversaire « A » donne le rang 5 à « Pas chassé », au-delà de son maximum : il est ramené à 3."]],
  },
  {
    code: "A14",
    cas: "un rang donné à une capacité qui n'évolue pas",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, _, "Goûter[2]"]]),
    attendues: [["A14", 5, "L'adversaire « A » donne le rang 2 à « Goûter », qui n'évolue pas : il est ignoré."]],
  },
  {
    code: "A15",
    cas: "une capacité d'arme sans arme",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, _, "Frappe"]]),
    attendues: [["A15", 5, "L'adversaire « A » a la capacité « Frappe », qui invoque {degats}, sans arme pour lui donner ses dégâts."]],
  },
  {
    code: "A16",
    cas: "un adversaire qui porte le nom d'un type",
    description: avecAdversaires([["Commis", "Commis"]]),
    attendues: [["A16", 5, "L'adversaire « Commis » porte le nom d'un type, défini ligne 2."]],
  },
  {
    code: "I4",
    cas: "la feuille absente",
    description: sansAdversaires(),
    attendues: [["I4", null, "La feuille « Adversaires » est absente : la banque n'a pas d'adversaires."]],
  },
  {
    code: "I5",
    cas: "un type que rien n'utilise",
    description: avecAdversaires([["Type", "Plongeur", _, _, 1]]),
    attendues: [["I5", 5, "Le type « Plongeur » n'est utilisé par aucun adversaire."]],
  },
  {
    code: "E2",
    cas: "une ligne sans nom, un type sans nom",
    description: avecAdversaires([[_, "Commis"], ["Type", _, "Corps(2)"]]),
    attendues: [
      ["E2", 5, "La ligne 5 n'est pas vide mais n'a pas de nom : elle n'entre pas dans la banque."],
      ["E2", 6, "La ligne 6 définit un type sans nom (colonne Type vide) : elle n'entre pas dans la banque."],
    ],
  },
  {
    code: "E6",
    cas: "un crochet jamais fermé, « // » ailleurs qu'en tête",
    description: avecAdversaires([["A", "Commis", _, _, _, _, _, "Spatule souple[2", "Pas chassé, //"]]),
    attendues: [
      ["E6", 5, "L'adversaire « A », colonne « Equipement » : « Spatule souple[2 » : crochet « [ » jamais fermé."],
      ["E6", 5, "L'adversaire « A », colonne « Capacités » : « // » : « // » ne se place qu'en tête de la liste."],
    ],
  },
  {
    code: "I1",
    cas: "des espaces de bord à un nom d'adversaire, à un nom de type",
    description: avecAdversaires([[" Sommelier ", "Commis"], ["Type", "Saucier ", _, 1], ["Second", "Saucier/Commis"]]),
    attendues: [
      ["I1", 5, "Le nom « Sommelier » portait des espaces au début et à la fin ; ils sont retirés."],
      ["I1", 6, "Le nom « Saucier » portait des espaces à la fin ; ils sont retirés."],
    ],
  },
];
