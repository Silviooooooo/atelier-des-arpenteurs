// Contrôles de la maîtrise vue par le créateur (SPECIFICATION.md, § 15.3,
// étape 7) : js/personnage/maitrise.js lit le poids d'un objet, les rangs de
// maîtrise du personnage (ses capacités de Maîtrise, à leur niveau), le
// désavantage de chaque capacité montrée, comme le combat (horsMaitrise de
// js/adversaire/resolution.js), l'état qui s'en déduit, la maîtrise d'un
// pack, et la ligne des maîtrises.
//
// La démonstration d'abord, telle qu'elle est publiée : Aubépine, Maîtrise
// de l'agile au niveau 1. Les cas qu'elle n'a pas (un objet à deux poids, une
// Maîtrise plus haute, aucune Maîtrise, une Maîtrise que porte un objet) se
// fabriquent en mémoire, sur des variantes du personnage, des blocs écrits
// ici ou une copie retouchée de la banque.
//
// Relecture de la vague 5 (V-1) : les maîtrises comptées sont celles que le
// personnage tient d'une source qui les donne au combat (donneAuCombat de
// js/personnage/calcul.js, que la photographie lit aussi) ; chaque sorte de
// source se voit dans les deux sens.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { calculerFiche, donneAuCombat, indexerCreation } from "../js/personnage/calcul.js";
import { capacitesDeLObjet, ligneDesMaitrises, maitriseDeLObjet, maitriseDuPack, maitrisesDuPersonnage, poidsDe, rangsDuPersonnage } from "../js/personnage/maitrise.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(readFileSync(new URL("essais/banque_demo.chiffree.json", racine), "utf8")), MOT_DE_PASSE_DEMO);
const INDEX = indexerCreation(BANQUE);

const PERMIS = "Une arme ou un pack d'un autre type n'est pas maîtrisé : il reste permis.";

// La fiche d'Aubépine, ou d'une variante.
const ficheDe = (modifier = null) => calculerFiche(BANQUE, personnageEssai(modifier), { index: INDEX });
const bloc = (nom) => INDEX.bloc(nom);
// L'état d'un objet de la banque, ses capacités prises sans option choisie.
const etatDe = (nom, rangs, choix = []) => maitriseDeLObjet(capacitesDeLObjet(INDEX, bloc(nom), choix), poidsDe(bloc(nom)), rangs);

// Un objet à deux poids, que la démonstration n'a pas.
const DEUX_POIDS = {
  nom: "Grand hachoir",
  type: "Arme",
  elements: [{ nom: "Arme" }, { nom: "Agile" }, { nom: "Lourde" }],
  capacites: [
    { forme: "simple", nom: "Frappe" },
    { forme: "simple", nom: "Choc sourd" },
  ],
  parametres: [],
};

test("démonstration — Aubépine : la Maîtrise de l'agile au niveau 1, et sa ligne", () => {
  const fiche = ficheDe();
  const maitrises = maitrisesDuPersonnage(fiche, INDEX);
  assert.deepEqual(maitrises, [{ nom: "Maîtrise de l'agile", niveau: 1 }]);
  assert.deepEqual([...rangsDuPersonnage(fiche, INDEX)], [["agile", 1]]);
  assert.equal(ligneDesMaitrises("Aubépine", maitrises), `Maîtrises d'Aubépine : Maîtrise de l'agile [1]. ${PERMIS}`);
  assert.equal(ligneDesMaitrises(fiche.identite.nom, maitrises), `Maîtrises d'Aubépine Crèmebrûlée : Maîtrise de l'agile [1]. ${PERMIS}`);
});

test("poidsDe — d'après les éléments du bloc, rangés lourde, agile, précise ; aucun sans eux", () => {
  assert.deepEqual(poidsDe(bloc("Rouleau de fonte")), ["lourde"]);
  assert.deepEqual(poidsDe(bloc("Spatule souple")), ["agile"]);
  assert.deepEqual(poidsDe(bloc("Couteau d'office")), ["precise"]);
  assert.deepEqual(poidsDe(bloc("Couvercle de marmite")), []);
  assert.deepEqual(poidsDe(bloc("Rouleau à pâtisserie")), []);
  assert.deepEqual(poidsDe(DEUX_POIDS), ["lourde", "agile"]);
  // Un élément qui vise une capacité ne vaut pas pour le bloc ; un bloc absent n'a pas de poids.
  assert.deepEqual(poidsDe({ elements: [{ nom: "Agile", cible: "Frappe" }] }), []);
  assert.deepEqual(poidsDe(null), []);
});

test("capacitesDeLObjet — la position de chaque capacité dans son bloc, comme au combat", () => {
  assert.deepEqual(capacitesDeLObjet(INDEX, bloc("Spatule souple")), [
    { nom: "Frappe", position: 1 },
    { nom: "Moulinet farineux", position: 2 },
  ]);
  // Un groupe ne donne que ses options choisies, à la position du groupe.
  assert.deepEqual(capacitesDeLObjet(INDEX, bloc("Rouleau à pâtisserie")), [{ nom: "Coup de louche", position: 1 }]);
  assert.deepEqual(capacitesDeLObjet(INDEX, bloc("Rouleau à pâtisserie"), ["Sauce piquante"]), [
    { nom: "Coup de louche", position: 1 },
    { nom: "Sauce piquante", position: 2 },
  ]);
  assert.deepEqual(capacitesDeLObjet(INDEX, null), []);
});

test("les états — démonstration : partielle (agile), non (précise, lourde), sans (aucun poids)", () => {
  const rangs = rangsDuPersonnage(ficheDe(), INDEX);
  // Maîtrise de l'agile [1] : la première capacité de la Spatule souple seulement.
  assert.deepEqual(etatDe("Spatule souple", rangs), { etat: "partielle", n: 2, k: 1, horsMaitrise: [false, true] });
  assert.deepEqual(etatDe("Couteau d'office", rangs), { etat: "non", n: 2, k: 0, horsMaitrise: [true, true] });
  assert.deepEqual(etatDe("Rouleau de fonte", rangs), { etat: "non", n: 2, k: 0, horsMaitrise: [true, true] });
  assert.deepEqual(etatDe("Couvercle de marmite", rangs), { etat: "sans", n: 1, k: 1, horsMaitrise: [false] });
  assert.deepEqual(etatDe("Rouleau à pâtisserie", new Map()), { etat: "sans", n: 1, k: 1, horsMaitrise: [false] });
});

test("les états — une Maîtrise plus haute couvre plus de capacités ; une autre Maîtrise, un autre poids", () => {
  const haute = rangsDuPersonnage(ficheDe((p) => p.niveaux.push({ capacite: "Maîtrise de l'agile", niveau: 2 })), INDEX);
  assert.deepEqual([...haute], [["agile", 2]]);
  assert.deepEqual(etatDe("Spatule souple", haute), { etat: "maitrise", n: 2, k: 2, horsMaitrise: [false, false] });
  // Un Pâtissier, Maîtrise du précis [1] : le Couteau d'office devient partiel, la Spatule souple non maîtrisée.
  const patissier = ficheDe((p) => {
    p.archetype = { nom: "Pâtissier", choix: ["Brigade", "Maîtrise du précis"] };
  });
  const rangs = rangsDuPersonnage(patissier, INDEX);
  assert.deepEqual(maitrisesDuPersonnage(patissier, INDEX), [{ nom: "Maîtrise du précis", niveau: 1 }]);
  assert.deepEqual(etatDe("Couteau d'office", rangs), { etat: "partielle", n: 2, k: 1, horsMaitrise: [false, true] });
  assert.equal(etatDe("Spatule souple", rangs).etat, "non");
});

test("les états — les positions seules suffisent, et la liste vide d'un objet pesé est maîtrisée", () => {
  const rangs = new Map([["agile", 1]]);
  assert.deepEqual(maitriseDeLObjet([1, 2], ["agile"], rangs), { etat: "partielle", n: 2, k: 1, horsMaitrise: [false, true] });
  // Une capacité dont aucune entrée ne donne la position ne se joue pas avec un désavantage (horsMaitrise).
  assert.deepEqual(maitriseDeLObjet([{ position: null }], ["lourde"], rangs), { etat: "maitrise", n: 1, k: 1, horsMaitrise: [false] });
  assert.deepEqual(maitriseDeLObjet([], ["lourde"], rangs), { etat: "maitrise", n: 0, k: 0, horsMaitrise: [] });
  assert.deepEqual(maitriseDeLObjet([1], ["agile"], undefined), { etat: "non", n: 1, k: 0, horsMaitrise: [true] });
});

test("un objet à deux poids demande les deux maîtrises, comme au combat", () => {
  const capacites = capacitesDeLObjet(INDEX, DEUX_POIDS);
  const etat = (rangs) => maitriseDeLObjet(capacites, poidsDe(DEUX_POIDS), new Map(rangs));
  assert.deepEqual(etat([["agile", 2]]), { etat: "non", n: 2, k: 0, horsMaitrise: [true, true] });
  assert.deepEqual(etat([["agile", 2], ["lourde", 1]]), { etat: "partielle", n: 2, k: 1, horsMaitrise: [false, true] });
  assert.deepEqual(etat([["agile", 1], ["lourde", 2]]), { etat: "partielle", n: 2, k: 1, horsMaitrise: [false, true] });
  assert.deepEqual(etat([["agile", 2], ["lourde", 2]]), { etat: "maitrise", n: 2, k: 2, horsMaitrise: [false, false] });
});

test("la maîtrise d'un pack : la Maîtrise de son poids, au niveau 1 au moins", () => {
  const rangs = rangsDuPersonnage(ficheDe(), INDEX);
  assert.equal(maitriseDuPack("agile", rangs), "maitrise");
  assert.equal(maitriseDuPack("lourde", rangs), "non");
  assert.equal(maitriseDuPack("precise", rangs), "non");
  assert.equal(maitriseDuPack("agile", new Map([["agile", 0]])), "non");
  assert.equal(maitriseDuPack("lourde", new Map([["lourde", 3]])), "maitrise");
  assert.equal(maitriseDuPack("agile", undefined), "non");
});

test("sans Maîtrise : aucune dans la ligne, rien de couvert", () => {
  const fiche = ficheDe((p) => {
    p.archetype.choix = ["Solo du chef"];
  });
  const maitrises = maitrisesDuPersonnage(fiche, INDEX);
  assert.deepEqual(maitrises, []);
  assert.equal(rangsDuPersonnage(fiche, INDEX).size, 0);
  assert.equal(ligneDesMaitrises("Aubépine", maitrises), `Maîtrises d'Aubépine : aucune. ${PERMIS}`);
  assert.equal(etatDe("Spatule souple", rangsDuPersonnage(fiche, INDEX)).etat, "non");
  assert.equal(maitriseDuPack("agile", rangsDuPersonnage(fiche, INDEX)), "non");
});

test("donneAuCombat — un bloc de ce que le personnage est, s'il existe ; l'arme tenue seule ; une armure portée ; le bouclier qui compte ; tout autre objet, où qu'il soit", () => {
  const fiche = ficheDe();
  const donne = (role, nom, rang = null, f = fiche) => donneAuCombat(INDEX, f, { role, nom, rang });
  // Les blocs d'Aubépine, et le bloc de base : ils donnent s'ils existent.
  for (const [role, nom] of [["espece", "Marmiton"], ["archetype", "Saucier"], ["constellation", "Constellation du Sablier"], ["primordial", "Grand Four"], ["base", "Gestes de cuisine"]]) {
    assert.equal(donne(role, nom), true, role);
    assert.equal(donne(role, "Bloc disparu"), false, `${role}, bloc absent`);
  }
  assert.equal(donne("inconnu", "Marmiton"), false, "un rôle qui n'en est pas un");
  // L'arme tenue donne ; une arme rangée au sac, non ; aux mains nues, aucune.
  assert.equal(donne("equipement", "Couteau d'office", 0), true);
  assert.equal(donne("equipement", "Rouleau de fonte", 1), false);
  const mainsNues = ficheDe((p) => {
    p.equipement[0].place = "sac";
  });
  assert.equal(mainsNues.attaque.mainsNues, true);
  assert.equal(donne("equipement", "Couteau d'office", 0, mainsNues), false);
  // Une armure portée donne ; au sac, non.
  assert.equal(donne("equipement", "Tablier de cuir", 2), true);
  assert.equal(donne("equipement", "Plastron de fonte", 3), false);
  // Le bouclier équipé donne ; au sac, ou second équipé, non.
  assert.equal(donne("equipement", "Couvercle de marmite", 7), true);
  const auSac = ficheDe((p) => {
    p.equipement[7].place = "sac";
  });
  assert.equal(donne("equipement", "Couvercle de marmite", 7, auSac), false);
  const deux = ficheDe((p) => p.equipement.push({ nom: "Couvercle de marmite", choix: [], qualite: "2", place: "equipe" }));
  assert.equal(donne("equipement", "Couvercle de marmite", 7, deux), true);
  assert.equal(donne("equipement", "Couvercle de marmite", 9, deux), false);
  // Tout autre objet donne où qu'il soit : le bouillon, au sac comme équipé.
  assert.equal(donne("equipement", "Bouillon revigorant", 8), true);
  const equipe = ficheDe((p) => {
    p.equipement[8].place = "equipe";
  });
  assert.equal(donne("equipement", "Bouillon revigorant", 8, equipe), true);
  // Un objet absent de la banque, ou un rang sans objet, ne donne rien.
  const absent = ficheDe((p) => p.equipement.push({ nom: "Objet disparu", choix: [], qualite: null, place: "sac" }));
  assert.equal(donne("equipement", "Objet disparu", 9, absent), false);
  assert.equal(donne("equipement", "Couteau d'office", 42), false);
});

test("rangsDuPersonnage, maitrisesDuPersonnage — seule compte la Maîtrise qu'une source donne au combat, comme dans la photographie", () => {
  // Une Maîtrise du lourd, que donne un objet d'une copie retouchée de la banque.
  const donneePar = (objet) => {
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === objet).capacites.push({ forme: "simple", nom: "Maîtrise du lourd" });
    const index = indexerCreation(banque);
    return (modifier = null) => {
      const fiche = calculerFiche(banque, personnageEssai(modifier), { index });
      return { maitrises: maitrisesDuPersonnage(fiche, index), rangs: [...rangsDuPersonnage(fiche, index)] };
    };
  };
  const AGILE = { maitrises: [{ nom: "Maîtrise de l'agile", niveau: 1 }], rangs: [["agile", 1]] };
  const ET_LOURD = { maitrises: [...AGILE.maitrises, { nom: "Maîtrise du lourd", niveau: 1 }], rangs: [["agile", 1], ["lourde", 1]] };
  // Une arme : rangée au sac, rien ; tenue, elle compte.
  const rouleau = donneePar("Rouleau de fonte");
  assert.deepEqual(rouleau(), AGILE, "le rouleau au sac");
  assert.deepEqual(
    rouleau((p) => {
      p.equipement[0].place = "sac";
      p.equipement[1].place = "arme";
    }),
    ET_LOURD,
    "le rouleau tenu",
  );
  // Une armure : au sac, rien ; portée, elle compte.
  const plastron = donneePar("Plastron de fonte");
  assert.deepEqual(plastron(), AGILE, "le plastron au sac");
  assert.deepEqual(
    plastron((p) => {
      p.equipement[3].place = "equipe";
    }),
    ET_LOURD,
    "le plastron porté",
  );
  // Le bouclier : équipé, elle compte ; au sac, rien.
  const couvercle = donneePar("Couvercle de marmite");
  assert.deepEqual(couvercle(), ET_LOURD, "le couvercle équipé");
  assert.deepEqual(
    couvercle((p) => {
      p.equipement[7].place = "sac";
    }),
    AGILE,
    "le couvercle au sac",
  );
  // Tout autre objet : où qu'il soit, elle compte.
  assert.deepEqual(donneePar("Bouillon revigorant")(), ET_LOURD, "le bouillon au sac");
});

test("la ligne des maîtrises : « d' » devant une voyelle, accentuée ou non, « de » sinon ; virgules et crochets", () => {
  const agile = [{ nom: "Maîtrise de l'agile", niveau: 1 }];
  assert.equal(ligneDesMaitrises("Écumoire", agile), `Maîtrises d'Écumoire : Maîtrise de l'agile [1]. ${PERMIS}`);
  assert.equal(ligneDesMaitrises("écumoire", agile), `Maîtrises d'écumoire : Maîtrise de l'agile [1]. ${PERMIS}`);
  assert.equal(ligneDesMaitrises("Omelette", agile), `Maîtrises d'Omelette : Maîtrise de l'agile [1]. ${PERMIS}`);
  assert.equal(ligneDesMaitrises("Rôtisseur", agile), `Maîtrises de Rôtisseur : Maîtrise de l'agile [1]. ${PERMIS}`);
  assert.equal(ligneDesMaitrises("Marmiton", []), `Maîtrises de Marmiton : aucune. ${PERMIS}`);
  assert.equal(
    ligneDesMaitrises(" Aubépine ", [
      { nom: "Maîtrise de l'agile", niveau: 1 },
      { nom: "Maîtrise du lourd", niveau: 2 },
    ]),
    `Maîtrises d'Aubépine : Maîtrise de l'agile [1], Maîtrise du lourd [2]. ${PERMIS}`,
  );
  // Sans nom encore : le personnage.
  assert.equal(ligneDesMaitrises("  ", agile), `Maîtrises du personnage : Maîtrise de l'agile [1]. ${PERMIS}`);
});
