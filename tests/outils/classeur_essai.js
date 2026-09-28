// Description du classeur d'essai (SPECIFICATION.md, § 10.3).
//
// Contenu inventé : une batterie de cuisine en guise d'arsenal, qui ne
// reprend rien du classeur réel. Les quatre feuilles en ont la structure
// (lisez_moi sans en-têtes et sa ligne 1 vide, puis Blocs, Eléments,
// Capacites), avec des en-têtes écrits autrement (casse, accents, ordre des
// colonnes) : l'import les retrouve par leur nom. Chaque forme de notation du
// § 6.2 y figure, et chaque anomalie du § 6.3 s'y déclenche ; une ligne
// fautive l'annonce dans sa colonne de notes, que le programme n'interprète
// jamais. E1, qui arrête l'import, se déclenche sur des variantes fabriquées
// au moment de l'essai.
//
// La feuille « Eléments » est écrite en XML préfixé (x:row…). Une cinquième
// feuille, que l'import ignore, porte les formes de cellule qu'un classeur
// peut contenir même quand Excel ne les écrit pas.
//
// Après une modification, réécrire essais/classeur_essai.xlsx :
//   node tests/outils/classeur_essai.js

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fabriquerClasseur } from "./fabrique_classeur.js";

const _ = null;

export const CLASSEUR_ESSAI = {
  feuilles: [
    {
      nom: "lisez_moi",
      lignes: [
        _,
        ["Syntaxe", "Un bloc transmet un paramètre sous la forme {nom:valeur}."],
        [_, "Une capacité invoque un paramètre sous la forme {nom}."],
        [_, "Un choix obligatoire s'écrit (a | b), un ensemble facultatif [a | b]."],
        ["nb", "La colonne Infos et la colonne origine n'ont aucune valeur légale."],
        [_, "Ce classeur est fictif : il sert aux contrôles de l'Atelier."],
      ],
    },
    {
      nom: "Blocs",
      lignes: [
        ["Nom", "Eléments transmis aux capacités", "Capacités", "Paramètres transmis aux capacités", "Infos"],
        ["Louche d'acier", "Tranchant, Brûlant", "Coup de louche, Moulinet farineux, Jet de sel", "{chaleur:5/10/15}, {distance:0}", "Liste simple"],
        ["Carnet de recettes", _, "(Recette secrète | Recette de grand-mère)", _, "Choix obligatoire"],
        ["Tablier", "Épais", "[Brûlure légère | Doigt pincé]", "{epaisseur:40/0/0/0/0/0}", "Ensemble facultatif ; valeur composée"],
        [
          "Rouleau à pâtisserie",
          "Brûlant(Coup de louche)",
          "Coup de louche, ( Sauce piquante )",
          "{chaleur:{force}*0,5/{force}/{force}*2}(Coup de louche)",
          "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
        ],
        ["Marmite hurlante", "Collant, brulant", "Sauce piquante, Marmitage, coup de poele", "{chaleur:3}, {sel:2}", "A1 : brulant, coup de poele"],
        ["Poêle en fonte", "Tranchant", "Coup de louche, Omelette fantôme", "{chaleur:1}(Crêpe volante)", "E4 : capacité introuvable, cible introuvable"],
        ["Presse-ail", "Mystère", "Coup de louche", _, "E5 : élément introuvable"],
        ["Fouet", _, "Coup de louche, (Recette secrète | Recette de grand-mère", "{chaleur:2", "E6 : parenthèse et accolade jamais fermées"],
        ["Écumoire", _, "Coup de louche", "{distance 3}", "E6 : paramètre sans deux-points"],
        ["Hachoir", "Tranchant", "Coup de louche, Jet de sel", "{distance:0}, {distance:1}(Jet de sel)", "E7 : Jet de sel reçoit deux distances"],
        ["Sablier de cuisine", _, "Coup de louche", "{piment:3}", "A2 : aucun élément ne reçoit piment"],
        ["Vaisselier vide", "Tranchant", _, _, "A6 : aucune capacité"],
        ["Livre de cuisine", _, _, "(Recette secrète|Recette de grand-mère)", "A6 ; A7 : choix hors de la colonne des capacités"],
        [" Fumoir ", "Fumant", "Soupir, Grimace, Pincée, Épluchage, Coup de louche ", _, "I1 : espaces de bord"],
        ["Louche d'acier", "Tranchant", "Coup de louche", _, "E3 : doublon"],
        [_, "Tranchant", "Coup de louche", _, "E2 : ligne sans nom"],
      ],
    },
    {
      nom: "Eléments",
      prefixe: "x",
      lignes: [
        ["Nom", "Paramètres reçus", "Description"],
        ["Tranchant", _, "Coupe net."],
        ["Brûlant", "{chaleur}", "Brûle de {chaleur} points."],
        ["Distance", "{distance}", "Agit jusqu'à {distance} pas."],
        ["Collant", _, "Englue la cible."],
        ["Épais", "{epaisseur}", "Protège de {epaisseur} points."],
        [" Fumant ", _, "Répand une fumée. (I1 : espaces de bord)"],
        ["Salé", "{sel}", _],
        ["Oublié", _, "A4 : rien ne le porte."],
        ["Tranchant", _, "E3 : doublon."],
        [_, "{poivre}", "E2 : ligne sans nom."],
      ],
    },
    {
      nom: "Capacites",
      lignes: [
        ["Nom", "puissance", "Coût en souffle", "Coût en lien", "Éléments propres", "description", "origine"],
        ["Coup de louche", 0, 1, _, "Tranchant", "Frappe pour {chaleur} points.", "Liste simple"],
        ["Moulinet farineux", "N", "5*N", 0, _, { riche: ["Tourbillonne ", "[N]", " fois."] }, "Texte enrichi"],
        ["Jet de sel", 0, "X", _, "Distance[2]", "Lance du sel à {distance} pas.\nPuis recommence.", "Élément propre à valeur ; retour à la ligne"],
        ["Sauce piquante", 1, 2, _, "Brûlant", "[N*{chaleur}] points.", "Trois puissances"],
        ["Sauce piquante", 2, 3, _, "Brûlant", "[N*{chaleur}] points.", _],
        ["Sauce piquante", 3, 4, 1, "Brûlant", "[N*{chaleur}] points.", _],
        ["Sauce piquante", 2, 3, _, "Brûlant", "Doublon de puissance.", "E3 : même nom, même puissance"],
        ["Recette secrète", 0, _, _, _, "Un secret de famille.", _],
        ["Recette de grand-mère", 0, _, _, _, "Une tradition.", _],
        ["Brûlure légère", 0, _, _, _, "Un peu chaud.", _],
        ["Doigt pincé", 0, _, _, _, "Aïe.", _],
        [" Marmitage ", "N", "N-1", _, "Collant", "Mijote [N] tours.", "I1 : espaces de bord"],
        ["Coup de poêle", 0, 1, _, "Tranchant", "Un coup sonore.", _],
        ["Grimace", 0, _, _, "Inconnu", "Fait peur.", "E5 : élément propre introuvable"],
        ["Soupir", 0, _, _, _, "Invoque {inconnu}.", "A5 : paramètre que rien ne porte"],
        ["Pincée", 0, _, _, _, _, "I2 : description vide"],
        ["Épluchage", 0, _, _, "Tranchant[3", "Épluche.", "E6 : crochet jamais fermé"],
        ["Plat oublié", 0, _, _, _, "Personne ne le sert.", "A3 : rattachée à aucun bloc"],
        [_, 0, 1, _, _, "Ligne sans nom.", "E2"],
      ],
    },
    {
      nom: "Formes de cellules",
      lignes: [
        ["Forme", "Cellule"],
        ["texte enrichi, annotation phonétique", { riche: ["Texte ", "enrichi", " en trois morceaux."], phonetique: "ふりがな" }],
        ["texte en ligne", { enLigne: "Écrit en ligne, sans chaîne partagée." }],
        ["retour à la ligne", "Deux lignes :\nla seconde."],
        ["retour chariot", "Retour chariot :\r\nfin."],
        ["« _x » écrit par l'auteur", "Écrire _x0041_ tel quel."],
        ["espaces de bord", "  gardés  "],
        ["formule", { formule: 'CONCATENATE("for","mule")', texte: "formule" }],
        ["booléens", { booleen: true }, { booleen: false }],
        ["erreur", { erreur: "#N/A" }],
        ["nombres", 0.5, 10, 1234.5678, -3, 0.1 + 0.2],
        _,
        ["colonne lointaine", ...Array(26).fill(_), "colonne AB"],
      ],
    },
  ],
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cible = fileURLToPath(new URL("../../essais/classeur_essai.xlsx", import.meta.url));
  writeFileSync(cible, fabriquerClasseur(CLASSEUR_ESSAI));
  console.log(`Écrit : ${cible}`);
}
