// Contrôles des différences et du résumé d'une ligne (SPECIFICATION.md,
// § 6.4, § 8.2 et § 11, domaine « Différences »). Les deux banques viennent
// du classeur propre et d'une variante fabriquée au moment de l'essai.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dateLisible, horodatage } from "../js/banque/dates.js";
import { comparer, resumer } from "../js/banque/differences.js";
import { importerFichier } from "../js/banque/importation.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";
import { CLASSEUR_PROPRE } from "./outils/classeur_essai.js";

const _ = null;
const DATE = new Date(2026, 8, 28, 14, 32);

async function importer(description) {
  const { banque, erreur } = await importerFichier(fabriquerClasseur(description), "classeur.xlsx");
  assert.equal(erreur, undefined, erreur);
  return banque;
}

function variante(modifier) {
  const description = structuredClone(CLASSEUR_PROPRE);
  const feuille = (nom) => description.feuilles.find((f) => f.nom === nom).lignes;
  modifier(feuille);
  return description;
}

// Blocs : Louche, Tablier. Capacites : Coup, Jet, Recette, Tradition,
// Brûlure (puissances 1 et 2), Pincement, Rempart. Eléments : Tranchant,
// Brûlant, Distance, Épais.
const MODIFIEE = variante((feuille) => {
  const blocs = feuille("Blocs");
  blocs[1][2] = "Tranchant,Brûlant(Coup)"; // même lecture, autre écriture
  blocs[1][4] = "{chaleur:3}(Coup), {chaleur:2}(Jet), {distance:0}";
  blocs.splice(2, 1); // Tablier
  blocs.push(["Passoire", "Équipement", _, "Coup", _, _]);
  const capacites = feuille("Capacites");
  capacites[1][6] = "Frappe fort de {chaleur}.";
  capacites[2][2] = "1"; // Jet, de puissance N
  capacites[6][6] = "[N] brûlures vives.";
  capacites.splice(7, 1); // Pincement
  capacites.push([_, "Brûlure", 3, _, _, "Brûlant", "[N] brûlures."], [_, "Écrasement", 0, _, _, _, "Écrase."]);
  feuille("Eléments")[3][2] = "Porte loin, à {distance}.";
  feuille("lisez_moi")[1][1] = "Classeur propre, relu.";
});

test("différences — ajout, modification champ par champ, retrait", async () => {
  const d = comparer(await importer(CLASSEUR_PROPRE), await importer(MODIFIEE));
  assert.equal(d.premiere, false);
  assert.deepEqual(d.blocs, {
    ajoutes: ["Passoire"],
    modifies: [
      {
        nom: "Louche",
        champs: [
          {
            champ: "parametres",
            colonne: "Paramètres transmis aux capacités",
            variante: null,
            avant: "{chaleur:1}(Coup), {chaleur:2}(Jet), {distance:0}",
            apres: "{chaleur:3}(Coup), {chaleur:2}(Jet), {distance:0}",
          },
        ],
      },
    ],
    retires: ["Tablier"],
  });
  assert.deepEqual(d.capacites.ajoutes, ["Écrasement"]);
  assert.deepEqual(d.capacites.retires, ["Pincement"]);
  const parNom = Object.fromEntries(d.capacites.modifies.map(({ nom, champs }) => [nom, champs]));
  assert.deepEqual(Object.keys(parNom), ["Coup", "Jet", "Brûlure"]);
  assert.deepEqual(parNom.Coup, [
    { champ: "description", colonne: "description", variante: null, avant: "Frappe de {chaleur}.", apres: "Frappe fort de {chaleur}." },
  ]);
  // Une seule variante de part et d'autre : la puissance est un champ.
  assert.deepEqual(parNom.Jet, [{ champ: "puissance", colonne: "puissance", variante: null, avant: "N", apres: "1" }]);
  // Plusieurs variantes : elles se comparent puissance par puissance.
  assert.deepEqual(parNom["Brûlure"], [
    { champ: "description", colonne: "description", variante: "2", avant: "[N] brûlures.", apres: "[N] brûlures vives." },
    { champ: "variante", colonne: "puissance", variante: "3", avant: "", apres: "variante ajoutée" },
  ]);
  assert.deepEqual(d.elements, {
    ajoutes: [],
    modifies: [
      {
        nom: "Distance",
        champs: [{ champ: "description", colonne: "description", variante: null, avant: "Porte à {distance}.", apres: "Porte loin, à {distance}." }],
      },
    ],
    retires: [],
  });
  assert.equal(d.lisez_moi_modifie, true);
});

test("différences — l'ordre des lignes et l'écriture d'une même notation ne comptent pas", async () => {
  const reordonnee = variante((feuille) => {
    const blocs = feuille("Blocs");
    [blocs[1], blocs[2]] = [blocs[2], blocs[1]];
    blocs[2][3] = "Coup,Jet,( Recette|Tradition ),[Brûlure|Pincement]";
    const capacites = feuille("Capacites");
    [capacites[5], capacites[6]] = [capacites[6], capacites[5]];
  });
  const d = comparer(await importer(CLASSEUR_PROPRE), await importer(reordonnee));
  for (const categorie of ["blocs", "capacites", "elements"]) {
    assert.deepEqual(d[categorie], { ajoutes: [], modifies: [], retires: [] }, categorie);
  }
  assert.equal(d.lisez_moi_modifie, false);
  assert.equal(resumer(d, { date: DATE }), "Publication du classeur des règles — 28/09/2026 14:32 — aucune différence");
});

test("différences — le type d'un bloc se compare ; publié avant la colonne « Type », il vaut un type vide", async () => {
  const propre = await importer(CLASSEUR_PROPRE);
  const retype = variante((feuille) => {
    feuille("Blocs")[1][1] = "Équipement";
  });
  const d = comparer(propre, await importer(retype));
  assert.deepEqual(d.blocs.modifies, [
    { nom: "Louche", champs: [{ champ: "type", colonne: "Type", variante: null, avant: "Arme", apres: "Équipement" }] },
  ]);
  // Une banque publiée avant la colonne : ses blocs n'ont pas de type.
  const ancienne = { ...propre, blocs: propre.blocs.map(({ type: _type, ...bloc }) => ({ ...bloc, brut: { ...bloc.brut, cellules: { Nom: bloc.nom } } })) };
  const avantType = comparer(ancienne, propre);
  assert.deepEqual(
    avantType.blocs.modifies.map(({ nom, champs }) => [nom, champs.map((c) => [c.champ, c.avant, c.apres])]),
    [["Louche", [["type", "", "Arme"]]], ["Tablier", [["type", "", "Armure"]]]],
  );
  const sansType = { ...propre, blocs: propre.blocs.map((bloc) => ({ ...bloc, type: "" })) };
  const aucun = comparer({ ...ancienne }, { ...sansType, blocs: sansType.blocs.map((b, i) => ({ ...b, brut: ancienne.blocs[i].brut })) });
  assert.deepEqual(aucun.blocs.modifies, []);
});

test("différences — deux entrées de même nom se distinguent par leur rang", () => {
  const vide = { capacites: [], elements: [], lisez_moi: [] };
  const bloc = (notes) => ({ nom: "Louche", elements: [], capacites: [], parametres: [], notes });
  const d = comparer({ ...vide, blocs: [bloc("a"), bloc("b")] }, { ...vide, blocs: [bloc("a"), bloc("c"), bloc("d")] });
  assert.deepEqual(d.blocs.ajoutes, ["Louche (3e)"]);
  assert.deepEqual(d.blocs.modifies, [{ nom: "Louche (2e)", champs: [{ champ: "notes", colonne: "Infos", variante: null, avant: "b", apres: "c" }] }]);
  assert.deepEqual(d.blocs.retires, []);
});

test("différences — le résumé d'une ligne, message de commit (§ 8.2)", async () => {
  const propre = await importer(CLASSEUR_PROPRE);
  const d = comparer(propre, await importer(MODIFIEE));
  assert.equal(
    resumer(d, { date: DATE }),
    "Publication du classeur des règles — 28/09/2026 14:32 — 1 bloc ajouté, 1 modifié, 1 retiré ; " +
      "1 capacité ajoutée, 3 modifiées, 1 retirée ; 0 élément ajouté, 1 modifié, 0 retiré ; lisez_moi modifié",
  );
  // L'exemple du § 8.2, et les accords au pluriel.
  const vide = { ajoutes: [], modifies: [], retires: [] };
  const exemple = { premiere: false, blocs: vide, elements: vide, lisez_moi_modifie: false };
  exemple.capacites = { ajoutes: ["a", "b", "c"], modifies: ["d", "e"], retires: [] };
  assert.equal(resumer(exemple, { date: DATE }), "Publication du classeur des règles — 28/09/2026 14:32 — 3 capacités ajoutées, 2 modifiées, 0 retirée");
  exemple.blocs = { ajoutes: [], modifies: [], retires: ["a", "b"] };
  assert.match(resumer(exemple, { date: DATE }), /— 0 bloc ajouté, 0 modifié, 2 retirés ; 3 capacités/);
  // La première publication, et une publication malgré des erreurs.
  const premiere = comparer(null, propre);
  assert.equal(premiere.premiere, true);
  assert.deepEqual(premiere.blocs.ajoutes, ["Louche", "Tablier"]);
  assert.equal(
    resumer(premiere, { date: DATE, erreurs: 1 }),
    "Publication du classeur des règles — 28/09/2026 14:32 — première publication : 2 blocs, 7 capacités, 4 éléments — publiée malgré 1 erreur",
  );
  assert.match(resumer(premiere, { date: DATE, erreurs: 12 }), /— publiée malgré 12 erreurs$/);
});

test("dates — horodatage à l'heure locale avec son décalage, date lisible", () => {
  const date = new Date(2026, 8, 28, 14, 32, 5);
  const texte = horodatage(date);
  assert.match(texte, /^2026-09-28T14:32:05[+-]\d\d:\d\d$/);
  assert.equal(new Date(texte).getTime(), date.getTime());
  assert.equal(dateLisible(date), "28/09/2026 14:32");
  assert.equal(dateLisible(texte), "28/09/2026 14:32");
  assert.equal(dateLisible("pas une date"), "pas une date");
});
