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
// La sixième feuille, « Adversaires » (lot 3, § 16), sert aussi à la
// démonstration : deux types et leurs adversaires, un multiplicateur
// décimal, « // » et « aucun », un pack d'armure, une armure naturelle
// globale plus une pièce, deux armes, un rang qui en remplace un autre, une
// zone mal orthographiée. Elle ne porte que trois anomalies, qu'elle
// annonce ; les autres codes de la feuille se déclenchent sur des variantes
// fabriquées au moment de l'essai, pour que la démonstration reste jouable.
// Ses en-têtes ont les noms neufs du lot 5, « CLASSE » et « Localisations »,
// et ses lignes de classe portent « Classe » dans la colonne Nom ; une
// variante aux anciens noms (« Type », « Localisation ») se fabrique au
// moment de l'essai.
//
// Le simulateur de combat (lot 4) y trouve ce qui lui manquait, toujours
// fictif : les éléments Intervention et Passif, en fin d'Eléments ; Passif
// sur douze capacités (Vif, Costaud, Nez fin, Palais d'acier, Réduction,
// Feuilletage, les trois styles de combat et les trois maîtrises),
// Intervention sur deux (Dressage minute, Coup de chalumeau) ; et deux
// capacités du bloc de base, en fin de Capacites : « Pas de côté », une
// intervention au coût X, et « Guetter ». Tout est posé en fin de feuille ou
// dans une cellule existante : aucune ligne ne change de numéro, aucune
// anomalie ne s'ajoute, aucune valeur d'un adversaire ne change.
//
// Au lot 5, ses descriptions écrivent « (s) » ou « (x) » partout où une
// expression précède un nom au pluriel (« Se déplace de [N] case(s). »,
// « Rallume [N] feu(x). ») : decrire les accorde au nombre calculé. Il ne
// porte donc aucune I6, qui se déclenche sur une variante fabriquée dans
// tests/controle.test.js ; le classeur propre s'écrit de même. Seuls des
// mots changent : aucune ligne, aucune valeur d'un adversaire.
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
        ["Nom", "Eléments transmis aux capacités", "Capacités", "Paramètres transmis aux capacités", "Infos", "TYPE"],
        ["Louche d'acier", "Tranchant, Brûlant", "Coup de louche, Moulinet farineux, Jet de sel", "{chaleur:5/10/15}, {distance:0}", "Liste simple", "Arme"],
        ["Carnet de recettes", _, "(Recette secrète | Recette de grand-mère)", _, "Choix obligatoire", "Equipement"],
        ["Tablier", "Épais", "[Brûlure légère | Doigt pincé]", "{epaisseur:40/0/0/0/0/0}", "Ensemble facultatif ; valeur composée", "équipement"],
        [
          "Rouleau à pâtisserie",
          "Brûlant(Coup de louche)",
          "Coup de louche, ( Sauce piquante )",
          "{chaleur:{force}*0,5/{force}/{force}*2}(Coup de louche)",
          "Cibles ; accolades imbriquées ; virgule décimale ; choix d'une seule option",
          "Arme",
        ],
        ["Marmite hurlante", "Collant, brulant", "Sauce piquante, Marmitage, coup de poele", "{chaleur:3}, {sel:2}", "A1 : brulant, coup de poele", "Équipement"],
        ["Poêle en fonte", "Tranchant", "Coup de louche, Omelette fantôme", "{chaleur:1}(Crêpe volante)", "E4 : capacité introuvable, cible introuvable", "Arme"],
        ["Presse-ail", "Mystère", "Coup de louche", _, "E5 : élément introuvable", "Équipement"],
        ["Fouet", _, "Coup de louche, (Recette secrète | Recette de grand-mère", "{chaleur:2", "E6 : parenthèse et accolade jamais fermées", "Équipement"],
        ["Écumoire", _, "Coup de louche", "{distance 3}", "E6 : paramètre sans deux-points", "Équipement"],
        ["Hachoir", "Tranchant", "Coup de louche, Jet de sel", "{distance:0}, {distance:1}(Jet de sel), {distance:2}(Jet de sel)", "E7 : Jet de sel visé deux fois (la distance sans cible est admise)", "Arme"],
        ["Sablier de cuisine", _, "Coup de louche", "{piment:3}", "A2 : aucun élément ne reçoit piment", "Équipement"],
        ["Vaisselier vide", "Tranchant", _, _, "I3 : aucune capacité", "Équipement"],
        ["Livre de cuisine", _, _, "(Recette secrète|Recette de grand-mère)", "A7 : choix hors de la colonne des capacités ; I3", "Équipement"],
        [" Fumoir ", "Fumant", "Soupir, Grimace, Pincée, Épluchage, Coup de louche ", _, "I1 : espaces de bord", " Consommable "],
        ["Louche d'acier", "Tranchant", "Coup de louche", _, "E3 : doublon", "Arme"],
        [_, "Tranchant", "Coup de louche", _, "E2 : ligne sans nom", "Arme"],
        // Le créateur de personnage (lot 2) : un bloc de base, deux espèces,
        // deux archétypes à style et maîtrise au choix, trois constellations,
        // deux primordiaux, des armes des trois types, des armures sur les
        // six zones (deux sur le torse), un bouclier, un consommable.
        ["Gestes de cuisine", "Dégâts(Taloche)", "Pas chassé, Goûter, Taloche, Pas de côté, Guetter", "{degats:{force}*0,5/{force}/{force}*2}(Taloche)", "Bloc de base ; dégâts de mains nues en expression", "Base"],
        ["Marmiton", _, "Vif, Nez fin", _, "Espèce", "Espèce"],
        ["Gâte-sauce", _, "Costaud, Palais d'acier", _, "Espèce", "Espèce"],
        ["Saucier", _, "Réduction, Flambage, Dressage minute, (Solo du chef | Brigade), (Maîtrise du lourd | Maîtrise de l'agile)", _, "Archétype : style et maîtrise au choix", "Archétype"],
        ["Pâtissier", _, "Feuilletage, Glaçage, Coup de chalumeau, (Brigade | Minutie), (Maîtrise de l'agile | Maîtrise du précis)", _, "Archétype : style et maîtrise au choix", "Archetype"],
        ["Constellation du Chaudron", _, "Bouillonnement", _, "Constellation", "Constellation"],
        ["Constellation de la Cuillère", _, "Cuillère d'argent", _, "Constellation", "Constellation"],
        ["Constellation du Sablier", _, _, _, "Constellation sans capacité ; I3", "Constellation"],
        ["Grand Four", _, "Fournaise, (Braise | Cendre)", _, "Primordial : une capacité à trois puissances, un choix", "Primordial"],
        ["Givre éternel", _, _, _, "Primordial sans capacité ; I3", "Primordial"],
        ["Rouleau de fonte", "Arme, Lourde", "Frappe, Choc sourd", "{degats:8/11/13}, {qualite:X}, {portee:0}", "Arme lourde", "Arme"],
        ["Spatule souple", "Arme, Agile", "Frappe, Moulinet farineux", "{degats:5/10/15}, {qualite:X}, {portee:0}", "Arme agile ; Moulinet farineux, comme la louche", "Arme"],
        ["Couteau d'office", "Arme, Précise", "Frappe, Émincer", "{degats:3/8/20}, {qualite:X}, {portee:1}", "Arme précise", "Arme"],
        ["Tablier de cuir", "Armure, Agile", _, "{armure:30/0/0/0/0/0}, {qualite:X}", "Armure du torse ; I3", "Armure"],
        ["Plastron de fonte", "Armure, Lourde", _, "{armure:40/0/0/0/0/0}, {qualite:X}", "Armure du torse, comme le tablier de cuir ; I3", "Armure"],
        ["Guêtres de toile", "Armure, Précise", _, "{armure:0/10/10/0/0/0}, {qualite:X}", "Armure des deux jambes ; I3", "Armure"],
        ["Maniques", "Armure, Agile", _, "{armure:0/0/0/15/15/0}, {qualite:X}", "Armure des deux bras ; I3", "Armure"],
        ["Toque renforcée", "Armure, Agile", _, "{armure:0/0/0/0/0/5}, {qualite:X}", "Armure de la tête ; I3", "Armure"],
        ["Couvercle de marmite", "Qualité", "Se couvrir", "{defense:8}, {qualite:X}", "Bouclier", "Équipement"],
        ["Bouillon revigorant", _, "Boire le bouillon", _, "Consommable", "Consommable"],
        // Les adversaires (lot 3) : une arme et une armure naturelles, que le
        // créateur de personnage ignore. La carapace n'a qu'une valeur : elle
        // couvre toutes les zones.
        ["Pinces de homard", "Arme", "Frappe, Choc sourd", "{degats:4/8/12}, {portee:0}", "Arme naturelle : hors du créateur de personnage", "Arme naturelle"],
        ["Carapace épaisse", "Armure", _, "{armure:30}", "Armure naturelle globale : une seule valeur ; I3", "armure naturelle"],
      ],
    },
    {
      nom: "Eléments",
      prefixe: "x",
      lignes: [
        ["Nom", "Paramètres reçus", "Description"],
        ["Tranchant", _, "Coupe net."],
        ["Brûlant", "{chaleur}", "Brûle de {chaleur} point(s)."],
        ["Distance", "{distance}", "Agit jusqu'à {distance} pas."],
        ["Collant", _, "Englue la cible."],
        ["Épais", "{epaisseur}", "Protège de {epaisseur} point(s)."],
        [" Fumant ", _, "Répand une fumée. (I1 : espaces de bord)"],
        ["Salé", "{sel}", _],
        ["Oublié", _, "A4 : rien ne le porte."],
        ["Tranchant", _, "E3 : doublon."],
        [_, "{poivre}", "E2 : ligne sans nom."],
        ["Arme", _, "Une seule arme en main à la fois."],
        ["Lourde", _, "Arme : Force et Précision. Armure : Force et Sens."],
        ["Agile", _, "Arme : Agilité et Force. Armure : Agilité et Créativité."],
        ["Précise", _, "Arme : Précision et Agilité. Armure : Précision et Empathie."],
        [
          "Armure",
          "{armure}",
          "Octroie [A] point(s) au torse, [B] à la jambe gauche, [C] à la jambe droite, [D] au bras gauche, [E] au bras droit et [F] à la tête. Deux pièces sur une même zone ne s'additionnent pas : la plus élevée l'emporte.",
        ],
        ["Dégâts", "{degats}", "Inflige [A] sur une réussite, [B] sur deux, [C] sur trois."],
        ["Qualité", "{qualite}", "Multipliez {degats}, {defense} et {armure} de ce bloc par [1/3 + {qualite}/3]."],
        ["Portée", "{portee}", "Atteint {portee} case(s)."],
        ["Défense", "{defense}", "Le bouclier encaisse jusqu'à {defense} point(s)."],
        ["Style de combat", _, "Ne s'acquiert qu'à la création."],
        ["Maîtrise", _, "Octroyée par l'archétype."],
        // Le simulateur de combat (lot 4).
        ["Intervention", _, "Se joue pendant le tour adverse."],
        ["Passif", _, "Agit sans action."],
      ],
    },
    {
      nom: "Capacites",
      lignes: [
        ["Nom", "puissance", "Coût en souffle", "Coût en lien", "Éléments propres", "description", "origine"],
        ["Coup de louche", 0, 1, _, "Tranchant", "Frappe pour {chaleur} point(s).", "Liste simple"],
        ["Moulinet farineux", "N", "5*N", 0, _, { riche: ["Tourbillonne ", "[N]", " fois."] }, "Texte enrichi"],
        ["Jet de sel", 0, "X", _, "Distance[2]", "Lance du sel à {distance} pas.\nPuis recommence.", "Élément propre à valeur ; retour à la ligne"],
        ["Sauce piquante", 1, 2, _, "Brûlant", "[N*{chaleur}] point(s).", "Trois puissances"],
        ["Sauce piquante", 2, 3, _, "Brûlant", "[N*{chaleur}] point(s).", _],
        ["Sauce piquante", 3, 4, 1, "Brûlant", "[N*{chaleur}] point(s).", _],
        ["Sauce piquante", 2, 3, _, "Brûlant", "Doublon de puissance.", "E3 : même nom, même puissance"],
        ["Recette secrète", 0, _, _, _, "Un secret de famille.", _],
        ["Recette de grand-mère", 0, _, _, _, "Une tradition.", _],
        ["Brûlure légère", 0, _, _, _, "Un peu chaud.", _],
        ["Doigt pincé", 0, _, _, _, "Aïe.", _],
        [" Marmitage ", "N", "N-1", _, "Collant", "Mijote [N] tour(s).", "I1 : espaces de bord"],
        ["Coup de poêle", 0, 1, _, "Tranchant", "Un coup sonore.", _],
        ["Grimace", 0, _, _, "Inconnu", "Fait peur.", "E5 : élément propre introuvable"],
        ["Soupir", 0, _, _, _, "Invoque {inconnu}.", "A5 : paramètre que rien ne porte"],
        ["Pincée", 0, _, _, _, _, "I2 : description vide"],
        ["Épluchage", 0, _, _, "Tranchant[3", "Épluche.", "E6 : crochet jamais fermé"],
        ["Plat oublié", 0, _, _, _, "Personne ne le sert.", "A3 : rattachée à aucun bloc"],
        [_, 0, 1, _, _, "Ligne sans nom.", "E2"],
        ["Pas chassé", "N", "N-1", 0, _, "Se déplace de [N] case(s).", "Base"],
        ["Goûter", 0, _, _, _, "Fait un jet de caractéristique.", "Base"],
        ["Taloche", "N", _, _, _, "Une taloche qui inflige [N*{degats}].", "Base : mains nues"],
        ["Vif", "N", _, _, "Passif", "Ajoutez [N] aux jets d'agilité.", "Espèce"],
        ["Nez fin", 0, 1, _, "Passif", "Retournez un dé devant un plat douteux.", "Espèce"],
        ["Costaud", "N", _, _, "Passif", "Ajoutez [N] aux jets de force.", "Espèce"],
        ["Palais d'acier", 0, 1, _, "Passif", "Retournez un dé face à un poison.", "Espèce"],
        ["Réduction", "N", _, _, "Passif", "Retire [N] point(s) d'armure par réussite.", "Archétype"],
        ["Flambage", "N", "5*N", _, _, "Multiplie les dégâts par [1+N].", "Archétype"],
        ["Dressage minute", 0, _, _, "Intervention", "Sert un allié avant son tour.", "Archétype"],
        ["Feuilletage", "N", _, _, "Passif", "Pare [N] coup(s) par tour.", "Archétype"],
        ["Glaçage", "N", "5*N", _, _, "Fige la cible pendant [N] tour(s).", "Archétype"],
        ["Coup de chalumeau", 0, 10, _, "Intervention", "Gagne un point de lien.", "Archétype"],
        ["Solo du chef", "N", 0, 0, "Style de combat, Passif", "Seul sur sa case : [N] avantage(s).", "Style de combat"],
        ["Brigade", "N", 0, 0, "Style de combat, Passif", "Avec un allié sur sa case : [N] avantage(s).", "Style de combat"],
        ["Minutie", "N", 0, 0, "Style de combat, Passif", "Contre la même cible : [N] avantage(s).", "Style de combat"],
        ["Maîtrise du lourd", "N", _, _, "Maîtrise, Passif", "Sans désavantage pour [N] capacité(s) d'un objet Lourde, en commençant par la première.", "Maîtrise"],
        ["Maîtrise de l'agile", "N", _, _, "Maîtrise, Passif", "Sans désavantage pour [N] capacité(s) d'un objet Agile, en commençant par la première.", "Maîtrise"],
        ["Maîtrise du précis", "N", _, _, "Maîtrise, Passif", "Sans désavantage pour [N] capacité(s) d'un objet Précise, en commençant par la première.", "Maîtrise"],
        ["Bouillonnement", "N", "2*N", _, _, "Fait bouillir [N] marmite(s).", "Constellation"],
        ["Cuillère d'argent", 0, _, _, _, "Une fois par jour, relance un dé.", "Constellation"],
        ["Fournaise", 1, 1, 1, _, "Réchauffe la case.", "Primordial : trois puissances"],
        ["Fournaise", 2, 3, 1, "Portée[1]", "Brûle trois adversaires à {portee} case.", _],
        ["Fournaise", 3, 7, 1, "Portée[2]", "Aveugle une cible à {portee} case(s).", _],
        ["Braise", "N", _, 1, _, "Rallume [N] feu(x).", "Primordial"],
        ["Cendre", 0, 2, 1, _, "Disparaît dans la fumée.", "Primordial"],
        ["Frappe", 0, _, _, _, "Une attaque qui inflige {degats}.", "Arme"],
        ["Choc sourd", 0, 2, _, _, "La cible perd autant d'attaque que vos réussites.", "Arme"],
        ["Émincer", 0, 4, _, _, "Une réussite de plus si vous en avez une.", "Arme"],
        ["Se couvrir", 0, _, _, _, "Reportez les dommages sur les {defense} point(s) du couvercle.", "Bouclier"],
        ["Boire le bouillon", 0, _, _, _, "Regagnez 5 points de résistance.", "Consommable"],
        // Le simulateur de combat (lot 4) : deux capacités du bloc de base.
        ["Pas de côté", 0, "X", _, "Intervention", "Annulez [X] dégât(s) reçu(s).", "Base : intervention, coût X"],
        [
          "Guetter",
          0,
          _,
          _,
          _,
          "Après un déplacement, ou pour finir son tour : une de vos capacités se joue en intervention jusqu'au prochain tour de votre camp.",
          "Base",
        ],
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
    {
      nom: "Adversaires",
      lignes: [
        ["Nom", "CLASSE", "Localisations", "Nombre  d'actions", "souffle", "Attaque", "Defense", "Équipement", "Capacites", "Infos"],
        ["Classe", "Commis", "Torse(2),\nJambe gauche(12),\nJambre droite(14),\nBras gauche(16),\nBras droit(18),\nTête(20)", 1, 2, 3, 4, _, "Pas chassé", "Classe ; A11 : « Jambre droite » se lit « jambe droite »"],
        ["Classe", "Rôtisseur", _, _, 5, 4, 5, "Spatule souple, Armure agile", "//, Maitrise de l'agile[1]", "Classe ; « // » reprend la liste héritée ; un pack d'armure ; A1 : Maitrise"],
        ["Marmiton de corvée", "Commis/Rôtisseur", _, _, _, _, _, _, _, "Deux types, rien en propre"],
        ["Chef de partie", "Commis/Rôtisseur[1,4]", _, _, _, _, _, _, "//, Maîtrise de l'agile[3], Pas chassé[2]", "Multiplicateur décimal ; deux rangs en remplacent d'autres"],
        ["Plongeur", "Commis / Rôtisseur", _, _, "aucun", _, _, "aucun", _, "« aucun » : ni souffle, ni équipement"],
        [
          "Homard furieux",
          _,
          "Corps(2), Pince gauche(12), Pince droite(15), Tête(18)",
          2,
          4,
          6,
          7,
          "Carapace épaisse, Toque renforcée[3], Pinces de homard, Couteau d'office",
          _,
          "Sans type ; armure naturelle globale plus une pièce ; deux armes",
        ],
        ["Mouette chapardeuse", _, "Corps(2), Aile gauche(14), Aile  droite(17), Tête(20)", 2, _, 2, 3, _, "Frappe, Nez fin", "A15 : Frappe, sans arme pour ses dégâts"],
      ],
    },
  ],
};

// Un classeur propre, fabriqué au moment de l'essai : il ne doit déclencher
// aucune anomalie. Il garde des formes délicates, que le contrôle doit
// accepter : deux paramètres de même nom à cibles différentes, un élément
// porté par le seul paramètre qu'il reçoit, des variantes de puissance.
export const CLASSEUR_PROPRE = {
  feuilles: [
    { nom: "lisez_moi", lignes: [_, ["Syntaxe", "Classeur propre : aucune anomalie attendue."]] },
    {
      nom: "Blocs",
      lignes: [
        ["Nom", "Type", "Eléments transmis aux capacités", "capacites", "Paramètres transmis aux capacités", "Infos"],
        ["Louche", "Arme", "Tranchant, Brûlant(Coup)", "Coup, Jet, (Recette | Tradition), [Brûlure | Pincement]", "{chaleur:1}(Coup), {chaleur:2}(Jet), {distance:0}", "Propre"],
        ["Tablier", "Armure", _, "Rempart", "{epaisseur:40/0/0}", _],
      ],
    },
    {
      nom: "Eléments",
      lignes: [
        ["Nom", "Paramètres reçus", "description"],
        ["Tranchant", _, "Coupe."],
        ["Brûlant", "{chaleur}", "Brûle de {chaleur}."],
        ["Distance", "{distance}", "Porte à {distance}."],
        ["Épais", "{epaisseur}", "Protège de {epaisseur}."],
      ],
    },
    {
      nom: "Capacites",
      lignes: [
        ["origine", "Nom", "puissance", "Coût en souffle", "Coût en lien", "Eléments propres", "description"],
        [_, "Coup", 0, 1, _, "Tranchant", "Frappe de {chaleur}."],
        [_, "Jet", "N", "5*N", _, _, "Lance à {distance}, [N*{chaleur}] point(s)."],
        [_, "Recette", 0, _, _, _, "Un secret."],
        [_, "Tradition", 0, _, _, _, "Une habitude."],
        [_, "Brûlure", 1, _, _, "Brûlant", "[N] brûlure."],
        [_, "Brûlure", 2, _, _, "Brûlant", "[N] brûlure(s)."],
        [_, "Pincement", 0, _, _, _, "Pince."],
        [_, "Rempart", 0, _, 1, "Épais[2]", "Protège de {epaisseur}."],
      ],
    },
    {
      nom: "Adversaires",
      lignes: [
        ["Nom", "Classe", "Localisations", "Nombre d'actions", "Souffle", "Attaque", "Défense", "Equipement", "Capacités"],
        ["Classe", "Marmiton", "Corps(2), Tête(18)", 1, 2, 3, 4, "Louche", "Coup"],
        ["Apprenti", "Marmiton[1,5]", _, _, _, _, _, _, "//, Jet[2]"],
      ],
    },
  ],
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cible = fileURLToPath(new URL("../../essais/classeur_essai.xlsx", import.meta.url));
  writeFileSync(cible, fabriquerClasseur(CLASSEUR_ESSAI));
  console.log(`Écrit : ${cible}`);
}
