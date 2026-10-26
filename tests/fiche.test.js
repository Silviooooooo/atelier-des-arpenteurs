// Contrôles de la fiche imprimable (SPECIFICATION.md, § 15.4, § 15.7 et
// § 11, domaine « Personnage ») : le recto et le verso de la spécification
// 1.7 fabriqués dans un document simulé, ce qu'ils écrivent et dans quel
// ordre, le style de combat lu dans la colonne « origine », la silhouette,
// la mesure et ses débordements, l'impression, les polices hébergées, le
// personnage de démonstration. La mise en page elle-même (les zones et leurs
// hauteurs) se mesure dans un vrai navigateur, hors de la suite (§ 15.4).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { POLICES } from "../js/apparence/themes.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { importerFichier } from "../js/banque/importation.js";
import { photographierPersonnage } from "../js/combat/photographie.js";
import { TABLE, tableDesRoles } from "../js/combat/roles.js";
import { avisDeLaFiche, deplacementDe, lireLesRoles, mesurerFiche } from "../js/ecrans/fiche_personnage.js";
import {
  VIGNETTES_POINT,
  capaciteDefinie,
  capacitesDuRecto,
  ceinture,
  coutEntreParentheses,
  elementsNotables,
  feuilles,
  resumeArme,
  resumeArmure,
  resumeBouclier,
} from "../js/fiche/feuilles.js";
import { lecture, reussitesLisibles } from "../js/fiche/lecture.js";
import { CARRES, silhouette } from "../js/fiche/silhouette.js";
import { calculerFiche, capacitesDuBloc, estStyleDeCombat, indexerCreation } from "../js/personnage/calcul.js";
import { ecrirePersonnage, lirePersonnage } from "../js/personnage/format.js";
import { legendeDuGroupe, manques } from "../js/personnage/parcours.js";
import { RESISTANCE_PAR_ZONE, ZONES } from "../js/personnage/regles.js";
import { changements } from "../js/personnage/suivi.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { CHEMIN_PERSONNAGE_DEMO, personnageDemo } from "../outils/personnage_demo.js";
import { installerDom, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", racine)), "classeur_essai.xlsx");
BANQUE.publiee_le = "2026-09-29T22:34:07+02:00";
const INDEX = indexerCreation(BANQUE);
const fiche = (modifier) => calculerFiche(BANQUE, personnageEssai(modifier), { index: INDEX });
// Une banque retouchée en mémoire, et la fiche d'Aubépine avec elle.
function retouchee(retoucher) {
  const banque = structuredClone(BANQUE);
  retoucher(banque);
  return banque;
}
const capaciteDe = (banque, nom) => banque.capacites.find((c) => c.nom === nom);
// Ce que la démonstration nomme pour le déplacement (js/combat/roles.js).
const PAS = "Pas chassé";

// Dans un document simulé : fn reçoit les feuilles d'une fiche.
function avecDom(fn) {
  const retirer = installerDom();
  try {
    return fn();
  } finally {
    retirer();
  }
}
const textes = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)].map(texteDe);
// Le document simulé ne lit qu'un sélecteur à la fois : le compte de plusieurs.
const compte = (noeud, ...selecteurs) => selecteurs.reduce((n, s) => n + noeud.querySelectorAll(s).length, 0);
const classesDe = (noeud) => noeud.className.split(/\s+/).filter(Boolean);

// ─── L'ordre et la présence des rubriques ───────────────────────────────────

test("recto — l'en-tête, les deux colonnes, les liens et le pied, dans cet ordre ; aucune note du modèle d'avant", () => {
  avecDom(() => {
    const recto = feuilles(fiche(), { deplacement: PAS }).querySelector(".recto");
    assert.deepEqual(recto.children.map((e) => classesDe(e).join(".")), ["cadre.cadre-exterieur", "cadre.cadre-interieur", "fiche-entete", "fiche-corps", "rubrique.rubrique-liens", "fiche-pied"]);
    const [gauche, droite] = recto.querySelector(".fiche-corps").children;
    assert.deepEqual(gauche.children.map((e) => classesDe(e)[1]), ["rubrique-caracteristiques", "rubrique-attaque", "rubrique-capacites"]);
    assert.deepEqual(droite.children.map((e) => classesDe(e)[1]), ["rubrique-etat", "rubrique-equipement"]);
    assert.deepEqual(textes(recto, ".rubrique-tete h2"), ["Caractéristiques", "Attaque & défense", "Capacités", "État", "Équipement et ceinture", "Liens primordiaux"]);
    // Les notes ôtées (mission, § 2.11) : aucune ne reste.
    const texte = texteDe(recto);
    for (const note of ["somme 36", "4 → d4", "réussites : 1 → A", "Dé : lourde", "Types mêlés", "Sans armure", "puissance de 1 à 3", "10 à la création", "/ zone", "10 points", "1 pt / semaine", "20 → attaque annulée", "points de lien =", "objet · qualité", "Reliquat", "suite au verso", "Pouvoirs choisis", "constellation tirée"]) {
      assert.ok(!texte.includes(note), note);
    }
    assert.equal(compte(recto, ".rubrique-note", ".legende-primordiaux", ".domaine", ".note"), 0, "ni note ni légende des primordiaux");
    assert.equal(recto.querySelectorAll(".grisee").length, 0, "aucune case grisée");
  });
});

test("verso — l'en-tête, puis un seul bloc « Historique » : le contexte et les réputations, le sac, la constellation, les points d'historique", () => {
  avecDom(() => {
    const verso = feuilles(fiche()).querySelector(".verso");
    assert.deepEqual(verso.children.map((e) => classesDe(e).join(".")), ["verso-entete", "rubrique.rubrique-historique"]);
    assert.deepEqual(verso.querySelector(".verso-entete").children.map(texteDe), ["Les Arpenteurs d’Abrasia", "Aubépine Crèmebrûlée", "— Points d'historique :", ""]);
    assert.ok(verso.querySelector(".verso-entete .trait-points"));
    assert.deepEqual(textes(verso, ".rubrique-tete h2"), ["Historique"]);
    assert.deepEqual(textes(verso, ".vignettes-haut .vignette-verso-titre"), ["Contexte", "Réputations"]);
    const bas = verso.querySelector(".vignettes-bas").children;
    assert.deepEqual(bas.slice(0, 2).map((e) => classesDe(e)[1]), ["vignette-verso-sac", "vignette-verso-constellation"]);
    assert.equal(bas.length, 2 + VIGNETTES_POINT, "les vignettes que la mesure retirera");
    assert.equal(VIGNETTES_POINT, 14);
    assert.deepEqual(textes(bas[2], ".champ-vignette"), ["Évènement :", "Bonus :", "Contexte :"]);
    // Plus de suite du recto, d'armes, de détail des capacités, d'avertissements ni de pied.
    const texte = texteDe(verso);
    for (const ancien of ["Suite du recto", "Armes", "Points de capacité", "Avertissements", "Banque du", "verso"]) assert.ok(!texte.includes(ancien), ancien);
    assert.equal(compte(verso, ".fiche-pied", ".ligne-libre", "table"), 0);
  });
});

test("en-tête — le titre du jeu, l'identité, le style de combat, le niveau, et l'XP laissée vide ; le pied dit la banque", () => {
  avecDom(() => {
    const recto = feuilles(fiche()).querySelector(".recto");
    assert.deepEqual(recto.querySelector(".fiche-marque").children.map(texteDe), ["Les Arpenteurs d’Abrasia", "", "Fiche de personnage"]);
    assert.deepEqual(textes(recto, ".valeur-entete"), ["Aubépine Crèmebrûlée", "Marmiton", "Saucier", "Solo du chef", "1", ""]);
    assert.deepEqual(textes(recto, ".champ-entete .libelle"), ["Nom", "Espèce", "Archétype", "Style de combat", "Niv.", "XP"]);
    assert.ok(recto.querySelector(".champ-xp"));
    assert.equal(texteDe(recto.querySelector(".fiche-pied")), "Banque du 29/09/2026");
    // Les caractéristiques, dans l'ordre du livret, et rien sous la grille.
    assert.deepEqual(textes(recto, ".nom-caracteristique"), ["Force", "Agilité", "Précision", "Parole", "Culture néruvienne", "Savoir sauvage", "Sens", "Empathie", "Créativité"]);
    assert.deepEqual(textes(recto, ".boite-valeur"), ["4", "5", "5", "4", "4", "3", "3", "4", "4"]);
    assert.equal(recto.querySelector(".rubrique-caracteristiques .rubrique-corps").children.length, 1);
  });
});

test("fiche — un nom qui contient du HTML reste du texte", () => {
  avecDom(() => {
    const noeud = feuilles(fiche((p) => (p.identite.nom = '<img src=x onerror="alert(1)">')));
    assert.equal(texteDe(noeud.querySelector(".valeur-entete")), '<img src=x onerror="alert(1)">');
    assert.equal(texteDe(noeud.querySelector(".verso-entete .fiche-genre")), '<img src=x onerror="alert(1)">');
    assert.equal(noeud.querySelectorAll("img").length, 0);
  });
});

// ─── Attaque et défense ─────────────────────────────────────────────────────

test("ARME — « nom (A/B/C), type, dé », la portée sauf vide ou 0 ; sans type ou sans dé, ni l'un ni l'autre ; mains nues", () => {
  const f = fiche();
  assert.equal(resumeArme(f.attaque), "Couteau d'office (3/8/20), précise, d10, portée 1");
  const louche = { nom: "Louche", degats: [1, 2, 3], typeObjet: "lourde", de: { de: "d6" }, portee: "0" };
  assert.equal(resumeArme(louche), "Louche (1/2/3), lourde, d6");
  assert.equal(resumeArme({ ...louche, portee: "" }), "Louche (1/2/3), lourde, d6");
  assert.equal(resumeArme({ ...louche, portee: "2 ou 3" }), "Louche (1/2/3), lourde, d6, portée 2 ou 3");
  // Un brouillon (caractéristiques incomplètes) : pas de dé, donc pas de type.
  assert.equal(resumeArme({ ...louche, de: null, portee: "2" }), "Louche (1/2/3), portée 2");
  assert.equal(resumeArme({ ...louche, typeObjet: null }), "Louche (1/2/3)");
  assert.equal(resumeArme({ ...louche, degats: null }), "Louche, lourde, d6");
  // Sans arme tenue : les mains nues du bloc de base, leurs dégâts, ni type ni dé.
  const nues = fiche((p) => (p.equipement[0].place = "sac"));
  assert.equal(resumeArme(nues.attaque), "Taloche (2/4/8)");
  avecDom(() => {
    const recto = feuilles(nues).querySelector(".recto");
    assert.equal(texteDe(recto.querySelector(".ligne-arme .resume-equipe")), "Taloche (2/4/8)");
    assert.equal(recto.querySelector(".zone-arme").children.length, 0, "aucune capacité d'arme");
    // L'arme rangée passe au sac, au verso.
    assert.ok(textes(feuilles(nues).querySelector(".verso"), ".objet-sac").includes("Couteau d'office"));
  });
});

test("ARMURE — « types (six valeurs), dé » : types mêlés joints par « et », pièce sans type, aucune armure ; BOUCLIER et ses capacités", () => {
  const f = fiche();
  assert.equal(resumeArmure(f), "agile et précise (30,10,10,10,10,6), d8");
  // Aucune pièce portée : « aucune », et le plus avantageux des trois dés.
  const nue = fiche((p) => p.equipement.forEach((o) => ["Tablier de cuir", "Guêtres de toile", "Maniques", "Toque renforcée"].includes(o.nom) && (o.place = "sac")));
  assert.equal(resumeArmure(nue), "aucune, d8");
  // Une seule pièce lourde.
  const lourde = fiche((p) => p.equipement.forEach((o) => (o.place = o.nom === "Plastron de fonte" ? "pack" : o.place === "equipe" && o.nom !== "Couvercle de marmite" ? "sac" : o.place)));
  assert.match(resumeArmure(lourde), /^lourde \(\d+,\d+,\d+,\d+,\d+,\d+\), d\d+$/);
  // Une pièce sans type compte comme « sans type », après les trois types ; sans dé, rien après.
  const piece = (nom, elements) => ({ nom, porte: true, place: "equipe", bloc: { nom, elements: elements.map((e) => ({ nom: e })), parametres: [] } });
  const fabriquee = {
    equipement: [piece("Bure", []), piece("Cotte", ["Armure", "Lourde"])],
    armure: { zones: { torse: 12, jambe_gauche: 0, jambe_droite: 0, bras_gauche: 4, bras_droit: 4, tete: 0 } },
    defense: { de: null },
  };
  assert.equal(resumeArmure(fabriquee), "lourde et sans type (12,0,0,4,4,0)");
  // Le bouclier : son nom et sa défense après qualité, puis ses capacités, dans la zone de l'armure.
  assert.equal(resumeBouclier(f.bouclier), "Couvercle de marmite (8)");
  assert.equal(resumeBouclier({ nom: "Planche", defense: null, defenseBrute: "" }), "Planche");
  avecDom(() => {
    const zone = feuilles(f).querySelector(".zone-armure");
    assert.equal(texteDe(zone.querySelector(".ligne-bouclier .resume-equipe")), "Couvercle de marmite (8)");
    assert.ok(zone.querySelector(".ligne-bouclier .trait-libre"), "un trait libre au bout");
    assert.deepEqual(textes(zone, ".capacite-definie"), ["Se couvrir (0) — Reportez les dommages sur les 8 points du couvercle."]);
    const arme = feuilles(f).querySelector(".zone-arme");
    assert.deepEqual(textes(arme, ".capacite-definie"), ["Frappe (0) — Une attaque qui inflige 3/8/20.", "Émincer (4) — Une réussite de plus si vous en avez une."]);
    // Sans bouclier, ni sa ligne ni ses capacités.
    const sans = feuilles(fiche((p) => (p.equipement[7].place = "sac"))).querySelector(".zone-armure");
    assert.equal(compte(sans, ".ligne-bouclier", ".capacite-definie"), 0);
    // Une capacité que donnent deux pièces portées, de même description : une seule fois.
    const deuxPieces = retouchee((b) => {
      for (const nom of ["Tablier de cuir", "Toque renforcée"]) b.blocs.find((x) => x.nom === nom).capacites.push({ forme: "simple", nom: "Doigt pincé" });
    });
    const partagee = feuilles(calculerFiche(deuxPieces, personnageEssai())).querySelector(".zone-armure");
    assert.deepEqual(textes(partagee, ".capacite-definie").filter((t) => t.startsWith("Doigt pincé")), ["Doigt pincé (0) — Aïe."]);
  });
});

test("objets de même nom — chacun sa description, celle de sa qualité : l'arme tenue, et non l'homonyme du sac", () => {
  // Le même couteau deux fois : de qualité 2 au sac (rang 0), de qualité 3 en main (rang 1).
  const f = fiche((p) => {
    p.equipement[0].qualite = "3";
    p.equipement.unshift({ nom: "Couteau d'office", choix: [], qualite: "2", place: "sac" });
  });
  assert.equal(f.attaque.rang, 1);
  const frappe = f.capacites.find((c) => c.nom === "Frappe");
  assert.deepEqual(frappe.descriptions.filter((d) => d.source === "Couteau d'office").map((d) => [d.rang, d.texte]), [[0, "Une attaque qui inflige 3/8/20."], [1, `Une attaque qui inflige ${f.attaque.degats.join("/")}.`]]);
  assert.notEqual(f.attaque.degats.join("/"), "3/8/20");
  avecDom(() => {
    const arme = feuilles(f).querySelector(".zone-arme");
    assert.equal(textes(arme, ".capacite-definie")[0], `Frappe (0) — Une attaque qui inflige ${f.attaque.degats.join("/")}.`);
  });
});

// ─── Les capacités ──────────────────────────────────────────────────────────

test("capacités — l'espèce et l'archétype (style et maîtrise compris), puis le déplacement nommé par l'écran ; rien d'autre du bloc de base", () => {
  const f = fiche();
  const noms = (liste) => liste.map((c) => c.nom);
  assert.deepEqual(noms(capacitesDuRecto(f, PAS)), ["Vif", "Nez fin", "Réduction", "Flambage", "Dressage minute", "Solo du chef", "Maîtrise de l'agile", "Pas chassé"]);
  // Sans nom de déplacement, aucune capacité du bloc de base ; la casse n'y fait rien.
  assert.deepEqual(noms(capacitesDuRecto(f)), noms(capacitesDuRecto(f, PAS)).slice(0, -1));
  assert.deepEqual(noms(capacitesDuRecto(f, "PAS CHASSE")), noms(capacitesDuRecto(f, PAS)));
  for (const base of ["Goûter", "Taloche", "Pas de côté", "Guetter"]) assert.ok(!noms(capacitesDuRecto(f, PAS)).includes(base), base);
  avecDom(() => {
    const liste = feuilles(f, { deplacement: PAS }).querySelector(".liste-capacites");
    assert.equal(liste.children.length, 8);
    assert.equal(compte(liste, ".titre-groupe", ".ligne-capacite", ".trait"), 0, "ni titre de groupe ni ligne imprimée");
    // La constellation au verso, le primordial aux liens, les objets à l'attaque, à la défense et à la ceinture.
    for (const ailleurs of ["Fournaise", "Cendre", "Frappe", "Se couvrir"]) assert.ok(!texteDe(liste).includes(ailleurs), ailleurs);
  });
});

test("déplacement — par le rôle « deplacement » de la table des rôles, jamais par un nom écrit dans la fiche ; sinon, l'écran le dit", async () => {
  const f = fiche();
  const roles = await lireLesRoles(BANQUE, "demo");
  assert.equal(deplacementDe(f, roles), PAS);
  // Un nom changé dans la banque : le rôle ne se reconnaît plus, la fiche s'écrit sans.
  const renommee = retouchee((b) => {
    capaciteDe(b, PAS).nom = "Pas glissé";
    b.blocs.find((bloc) => bloc.capacites.some((c) => c.nom === PAS)).capacites.find((c) => c.nom === PAS).nom = "Pas glissé";
  });
  const sansPas = calculerFiche(renommee, personnageEssai());
  assert.ok(sansPas.capacites.some((c) => c.nom === "Pas glissé" && c.role === "base"));
  assert.equal(deplacementDe(sansPas, await lireLesRoles(renommee, "demo")), null);
  assert.deepEqual(avisDeLaFiche(null, { parCle: new Map(), deplacement: null }), ["Le déplacement ne s'écrit pas sur la fiche : aucune capacité du bloc de base n'a le rôle « deplacement »."]);
  // La table des rôles en échec : la fiche s'écrit sans, et l'écran dit pourquoi.
  const echec = await lireLesRoles(BANQUE, "inconnu");
  assert.match(echec.erreur, /Mode inconnu/);
  assert.equal(deplacementDe(f, echec), null);
  assert.deepEqual(avisDeLaFiche(null, { ...echec, deplacement: null }), [`Le déplacement ne s'écrit pas sur la fiche : les rôles des capacités ne se lisent pas (${echec.erreur}).`]);
  // Par empreinte, comme le vrai classeur : un tableau fabriqué à l'exécution.
  const { empreinte } = await import("../js/securite/chiffrement.js");
  const marque = (await empreinte("paschasse")).slice("sha256:".length);
  const parEmpreinte = await tableDesRoles(BANQUE, "reel", TABLE.map((e) => (e.role === "deplacement" ? { ...e, empreinte: marque } : e)));
  assert.equal(deplacementDe(f, { parCle: parEmpreinte.parCle }), PAS);
  assert.deepEqual(avisDeLaFiche(null, { parCle: roles.parCle, deplacement: PAS }), []);
});

test("capacité définie — ses cases (puissance maximale, cochées jusqu'au niveau ; aucune à 0 ni à venir), son coût, ses éléments notables, sa définition", () => {
  const f = fiche();
  const de = (nom) => f.capacites.find((c) => c.nom === nom);
  avecDom(() => {
    const cases = (noeud) => [...noeud.querySelectorAll(".case")].map((c) => (classesDe(c).includes("cochee") ? "x" : "o")).join("");
    const flambage = capaciteDefinie(de("Flambage"));
    assert.equal(cases(flambage), "xxo", "niveau 2 sur 3");
    assert.equal(texteDe(flambage), "Flambage (10) — Multiplie les dégâts par 3.");
    assert.equal(cases(capaciteDefinie(de("Vif"))), "xoo");
    assert.equal(capaciteDefinie(de("Nez fin")).querySelectorAll(".case").length, 0, "puissance 0 : aucune case");
    assert.equal(texteDe(capaciteDefinie(de("Vif"))), "Vif (0) passif — Ajoutez 1 aux jets d'agilité.");
    // Les éléments structurels ne s'écrivent pas (Style de combat, Maîtrise).
    assert.equal(texteDe(capaciteDefinie(de("Solo du chef"))), "Solo du chef (0) passif — Seul sur sa case : 1 avantage.");
    assert.equal(texteDe(capaciteDefinie(de("Dressage minute"))), "Dressage minute (0) intervention — Sert un allié avant son tour.");
    assert.equal(texteDe(capaciteDefinie(de("Maîtrise de l'agile")).querySelector(".capacite-definie-elements")), "passif");
    // Le nom en gras, le coût, les éléments, la définition : chacun sa classe.
    assert.deepEqual(capaciteDefinie(de("Vif")).children.map((e) => classesDe(e)[0]), ["cases-puissance", "capacite-definie-nom", "capacite-definie-cout", "capacite-definie-elements", "capacite-definie-texte"]);
    // Une capacité à venir : ni case, ni coût, « — à venir ».
    const aVenir = capaciteDefinie({ nom: "Omelette fantôme", aVenir: true, niveau: null, niveauMax: null, cout: null, elements: [], descriptions: [] });
    assert.equal(texteDe(aVenir), "Omelette fantôme — à venir");
    assert.equal(aVenir.querySelectorAll(".case").length, 0);
    assert.ok(aVenir.querySelector(".capacite-definie-a-venir"));
    // La description propre à l'objet : par son rang, sinon par son nom, sinon la première.
    const double = { nom: "Frappe", aVenir: false, niveau: 0, niveauMax: 0, cout: { souffle: "0", lien: "0" }, elements: [], descriptions: [{ source: "Louche", rang: 0, texte: "Un." }, { source: "Rouleau", rang: 1, texte: "Deux." }, { source: "Louche", rang: 4, texte: "Trois." }] };
    assert.equal(texteDe(capaciteDefinie(double, { nom: "Rouleau", rang: 1 })), "Frappe (0) — Deux.");
    assert.equal(texteDe(capaciteDefinie(double, { nom: "Louche", rang: 4 })), "Frappe (0) — Trois.", "deux objets de même nom : le rang les sépare");
    assert.equal(texteDe(capaciteDefinie(double, { nom: "Rouleau", rang: 9 })), "Frappe (0) — Deux.");
    assert.equal(texteDe(capaciteDefinie(double, { nom: "Écumoire", rang: 9 })), "Frappe (0) — Un.");
    assert.equal(texteDe(capaciteDefinie(double)), "Frappe (0) — Un.");
  });
  // Le coût : le souffle (vide : 0), et le lien s'il n'est pas nul.
  assert.equal(coutEntreParentheses({ souffle: "1", lien: "0" }), "1");
  assert.equal(coutEntreParentheses({ souffle: "", lien: "" }), "0");
  assert.equal(coutEntreParentheses({ souffle: "0", lien: "1" }), "0 · 1 lien");
  assert.equal(coutEntreParentheses({ souffle: "", lien: "3" }), "0 · 3 liens");
  assert.equal(coutEntreParentheses({ souffle: "X", lien: "0" }), "X");
  assert.equal(coutEntreParentheses(null), "");
  // Les éléments notables : en minuscule sauf un sigle, une valeur entre parenthèses, les structurels ôtés.
  assert.deepEqual(
    elementsNotables(["Passif", "JA[parole, empathie]", "Distance[2]", "Style de combat", "Maîtrise", "Espèce", "Archétype", "Primordial", "Arme", "Armure", "Lourde", "Agile", "Précise", "Dégâts", "Qualité", "Défense", "Consommable", "Équipement", "équipement", "STYLE DE COMBAT", "Intervention"]),
    ["passif", "JA (parole, empathie)", "distance (2)", "intervention"],
  );
});

test("réussites — « //effet 1/effet 2/effet 3// » s'écrit « 1 → effet 1 · 2 → effet 2 · 3 → effet 3 », sur la fiche comme en vue lecture", () => {
  assert.equal(reussitesLisibles("Détecte. //Dit si faux/ Dit la part /Dit le vrai// Fin."), "Détecte. 1 → Dit si faux · 2 → Dit la part · 3 → Dit le vrai Fin.");
  assert.equal(reussitesLisibles("Deux fois //a/b// puis //c//."), "Deux fois 1 → a · 2 → b puis 1 → c.");
  assert.equal(reussitesLisibles("Rien de tel, une seule barre / ici."), "Rien de tel, une seule barre / ici.");
  assert.equal(reussitesLisibles(null), "");
  const banque = retouchee((b) => (capaciteDe(b, "Vif").variantes[0].description = "Esquive. //Recule/Recule de [N] case(s)/Disparaît//"));
  const f = calculerFiche(banque, personnageEssai());
  avecDom(() => {
    const vif = [...feuilles(f).querySelectorAll(".liste-capacites .capacite-definie")].find((p) => texteDe(p).startsWith("Vif"));
    assert.equal(texteDe(vif), "Vif (0) passif — Esquive. 1 → Recule · 2 → Recule de 1 case · 3 → Disparaît");
    const lu = [...lecture(f).querySelectorAll("details")].find((d) => texteDe(d.querySelector("summary")).startsWith("Vif"));
    assert.match(texteDe(lu), /Esquive\. 1 → Recule · 2 → Recule de 1 case · 3 → Disparaît/);
    assert.doesNotMatch(texteDe(lu), /\/\//);
  });
});

// ─── Le style de combat ─────────────────────────────────────────────────────

test("style — la colonne « origine » dit le style de combat, au calcul, au créateur et au combat ; l'élément propre ne dit plus rien", async () => {
  const solo = (b) => capaciteDe(b, "Solo du chef");
  assert.equal(estStyleDeCombat(solo(BANQUE)), true);
  assert.equal(fiche().style, "Solo du chef");
  // L'origine sans l'élément : toujours un style.
  const parOrigine = retouchee((b) => solo(b).variantes.forEach((v) => (v.elements = v.elements.filter((e) => e.nom !== "Style de combat"))));
  // L'élément sans l'origine : plus un style, une capacité d'archétype.
  const parElement = retouchee((b) => solo(b).variantes.forEach((v) => (v.notes = "Liste simple")));
  // L'origine écrite autrement : comparée par cle().
  const autrement = retouchee((b) => solo(b).variantes.forEach((v) => (v.notes = "  style DE combat ")));
  assert.equal(calculerFiche(parOrigine, personnageEssai()).style, "Solo du chef");
  assert.equal(calculerFiche(autrement, personnageEssai()).style, "Solo du chef");
  const sansStyle = calculerFiche(parElement, personnageEssai());
  assert.equal(sansStyle.style, "");
  assert.deepEqual(sansStyle.groupes.style, []);
  assert.ok(sansStyle.groupes.archetype.some((c) => c.nom === "Solo du chef"));
  // Deux styles : la fiche écrit le premier, et le dit.
  const deux = calculerFiche(retouchee((b) => (capaciteDe(b, "Réduction").variantes[0].notes = "Style de combat")), personnageEssai());
  assert.equal(deux.style, "Réduction");
  assert.ok(deux.avertissements.some((a) => a.texte === "Plusieurs styles de combat (« Réduction », « Solo du chef ») : la fiche écrit le premier."));
  avecDom(() => assert.equal(texteDe(feuilles(deux).querySelector(".champ-style .valeur-entete")), "Réduction"));
  // Une capacité du personnage, d'où qu'elle vienne : celle de l'espèce aussi (mission, § 2.2).
  const parEspece = retouchee((b) => (capaciteDe(b, "Vif").variantes[0].notes = "Style de combat"));
  const vif = calculerFiche(parEspece, personnageEssai());
  assert.equal(vif.style, "Vif");
  assert.deepEqual(vif.groupes.style.map((c) => c.nom), ["Vif", "Solo du chef"]);
  assert.ok(!vif.groupes.espece.some((c) => c.nom === "Vif"));
  // Le créateur : l'intitulé du groupe de choix.
  const groupeDesStyles = (banque) => {
    const index = indexerCreation(banque);
    const saucier = banque.blocs.find((b) => b.nom === "Saucier");
    return legendeDuGroupe(index, capacitesDuBloc(saucier).groupes.find((g) => g.options.includes("Solo du chef")));
  };
  assert.equal(groupeDesStyles(BANQUE), "Style de combat");
  assert.equal(groupeDesStyles(parOrigine), "Style de combat");
  assert.notEqual(groupeDesStyles(parElement), "Style de combat");
  // Le combat : le groupe de la capacité dans le panneau d'action.
  const groupe = async (banque, nom = "Solo du chef") => {
    const index = indexerCreation(banque);
    const { photo, refus } = photographierPersonnage(banque, personnageEssai(), { index, roles: await tableDesRoles(banque, "demo") });
    assert.equal(refus, undefined, refus);
    const { genre, titre } = photo.valeurs.capacites.find((c) => c.nom === nom).groupe;
    return `${genre} : ${titre}`;
  };
  assert.equal(await groupe(BANQUE), "style : Style de combat");
  assert.equal(await groupe(parOrigine), "style : Style de combat");
  assert.equal(await groupe(parElement), "archetype : Saucier");
  assert.equal(await groupe(BANQUE, "Vif"), "espece : Marmiton");
  assert.equal(await groupe(parEspece, "Vif"), "style : Style de combat");
});

// ─── La colonne de droite ───────────────────────────────────────────────────

test("état — souffle et son maximum, la silhouette et ses six zones, le corps et ses cases teintées, blessures et états ; aucune note", () => {
  avecDom(() => {
    const etat = feuilles(fiche()).querySelector(".rubrique-etat .rubrique-corps");
    assert.deepEqual(etat.children.map((e) => e.tagName === "SVG" ? "svg" : classesDe(e).join(".")), ["ligne-etat.ligne-souffle", "svg", "ligne-etat.ligne-corps", "blessures-etat"]);
    assert.equal(texteDe(etat.querySelector(".ligne-souffle")), "Souffle/ 10");
    assert.ok(etat.querySelector(".ligne-souffle .trait-libre"));
    const corps = [...etat.querySelectorAll(".case-corps")];
    assert.equal(corps.length, 10);
    assert.deepEqual(corps.map((c) => classesDe(c).includes("teintee")), [false, false, false, false, false, true, true, true, true, true]);
    assert.equal(texteDe(etat.querySelector(".blessures-etat")), "Blessures & états");
    assert.equal(etat.querySelectorAll(".blessures-etat .ligne-libre").length, 2);
  });
});

test("silhouette — le dessin de l'auteur tel quel, et par-dessus six carrés : nom, faces du d20 (la tête au-dessus), armure, cinq cases d'endurance", () => {
  avecDom(() => {
    const zones = { torse: 30, jambe_gauche: 10, jambe_droite: 11, bras_gauche: 12, bras_droit: 13, tete: 6 };
    const dessin = silhouette(zones);
    assert.equal(dessin.getAttribute("viewBox"), "0 0 479 604");
    assert.equal(dessin.getAttribute("class"), "silhouette-zones");
    assert.equal(dessin.getAttribute("role"), "img");
    const forme = dessin.querySelector("path");
    assert.equal(forme.getAttribute("class"), "forme-silhouette");
    assert.equal(forme.getAttribute("transform"), "translate(0 8)");
    // Le premier tracé de localisation.svg (26/10/2026), signe pour signe : son empreinte.
    assert.equal(createHash("sha256").update(forme.getAttribute("d")).digest("hex"), "4e7029832167cf2f81f4e71c538dd7755058b94947a3ab27ce5ccc3355333aa2");
    const carres = dessin.querySelectorAll("g");
    assert.deepEqual(Object.keys(CARRES), ["tete", "torse", "bras_droit", "bras_gauche", "jambe_droite", "jambe_gauche"]);
    assert.equal(carres.length, 6);
    const ZONE = Object.fromEntries(ZONES.map((z) => [z.code, z]));
    Object.keys(CARRES).forEach((code, i) => {
      const g = carres[i];
      const { x, y } = CARRES[code];
      const cadre = g.querySelector(".cadre-zone");
      assert.deepEqual(["x", "y", "width", "height"].map((a) => cadre.getAttribute(a)), [String(x + 1.5), String(y + 1.5), "89", "89"], code);
      const endurance = g.querySelectorAll(".case-endurance");
      assert.equal(endurance.length, RESISTANCE_PAR_ZONE);
      assert.deepEqual([endurance[0].getAttribute("x"), endurance[0].getAttribute("y"), endurance[0].getAttribute("width"), endurance[0].getAttribute("height")], [(x + 3).toFixed(1), String(y + 71.5), (86 / RESISTANCE_PAR_ZONE).toFixed(1), "17.5"]);
      const armure = g.querySelector(".valeur-armure");
      assert.deepEqual([armure.getAttribute("x"), armure.getAttribute("y"), texteDe(armure)], [String(x + 8), String(y + 21), String(zones[code])]);
      const noms = [...g.querySelectorAll(".nom-zone-svg")];
      if (code === "tete") {
        assert.deepEqual(noms.map(texteDe), ["Tête : 1"]);
        assert.equal(noms[0].getAttribute("y"), String(y - 8));
      } else {
        assert.deepEqual(noms.map(texteDe), [ZONE[code].abrege, ZONE[code].d20]);
        assert.deepEqual(noms.map((n) => n.getAttribute("y")), [String(y - 8), String(y + 115)]);
      }
      // Les textes du torse, sur la forme, prennent leur propre couleur.
      assert.equal(noms.every((n) => n.getAttribute("class").includes("sur-silhouette")), code === "torse", code);
    });
    // Les faces du livret : jambe gauche 12-13, jambe droite 14-15.
    assert.equal(texteDe(carres[5]).includes("12-13"), true);
    assert.equal(texteDe(carres[4]).includes("14-15"), true);
  });
});

test("ceinture — ce que le personnage porte et a sous la main : les pièces regroupées par type à la place de la première, les autres objets et leurs capacités ; le sac au verso", () => {
  const f = fiche();
  assert.deepEqual(ceinture(f).map((o) => o.nom), ["Couteau d'office", "Armure agile (Tablier de cuir, Maniques, Toque renforcée)", "Armure précise (Guêtres de toile)", "Couvercle de marmite"]);
  // L'arme tenue et le bouclier gardent leurs capacités sous l'attaque et la défense.
  assert.deepEqual(ceinture(f).map((o) => o.capacites.length), [0, 0, 0, 0]);
  // Un objet équipé qui n'est ni arme, ni armure, ni bouclier : ses capacités sous lui.
  const bouillon = fiche((p) => (p.equipement[8].place = "equipe"));
  const objet = ceinture(bouillon).find((o) => o.nom === "Bouillon revigorant");
  assert.deepEqual(objet.capacites.map(({ capacite, objet: source }) => [capacite.nom, source.nom, source.rang]), [["Boire le bouillon", "Bouillon revigorant", 8]]);
  avecDom(() => {
    const noeud = feuilles(bouillon);
    const objets = noeud.querySelectorAll(".rubrique-equipement .objet-ceinture");
    assert.deepEqual([...objets].map((o) => texteDe(o.querySelector(".objet-nom"))), ["Couteau d'office", "Armure agile (Tablier de cuir, Maniques, Toque renforcée)", "Armure précise (Guêtres de toile)", "Couvercle de marmite", "Bouillon revigorant"]);
    assert.equal(texteDe(objets[4].querySelector(".capacite-definie")), "Boire le bouillon (0) — Regagnez 5 points de résistance.");
    assert.equal(compte(noeud, ".rubrique-equipement .trait", ".rubrique-equipement .ligne-libre"), 0, "aucune ligne libre imprimée");
    assert.doesNotMatch(texteDe(noeud.querySelector(".rubrique-equipement")), /qualité|X\b/);
    // Le sac à dos, au verso : un nom par ligne, sans définition.
    const sac = feuilles(f).querySelector(".vignette-verso-sac");
    assert.deepEqual(textes(sac, ".objet-sac"), ["Rouleau de fonte", "Plastron de fonte", "Bouillon revigorant"]);
    assert.equal(sac.querySelectorAll(".capacite-definie").length, 0);
  });
  // Deux pièces d'un même type, séparées par un autre objet : une seule ligne, à la place de la première.
  const melee = fiche((p) => p.equipement.splice(3, 0, p.equipement.splice(7, 1)[0]));
  assert.deepEqual(ceinture(melee).map((o) => o.nom), ["Couteau d'office", "Armure agile (Tablier de cuir, Maniques, Toque renforcée)", "Couvercle de marmite", "Armure précise (Guêtres de toile)"]);
});

// ─── Les liens primordiaux ──────────────────────────────────────────────────

test("liens — le primordial, ses points cochés sur huit cases jamais grisées, son domaine (la colonne Infos), ses capacités ; la seconde colonne vide", () => {
  const f = fiche();
  assert.equal(f.liens[0].domaine, "Chaleur, cuisson, appétit");
  avecDom(() => {
    const [premiere, seconde] = feuilles(f).querySelectorAll(".colonne-lien");
    assert.equal(texteDe(premiere.querySelector(".nom-primordial")), "Grand Four");
    assert.equal(texteDe(premiere.querySelector(".domaine-primordial")), "Chaleur, cuisson, appétit");
    const cases = [...premiere.querySelectorAll(".case-lien")];
    assert.equal(cases.length, 8);
    assert.equal(cases.filter((c) => classesDe(c).includes("cochee")).length, f.liens[0].points);
    assert.equal(f.liens[0].points, 1);
    assert.deepEqual(textes(premiere, ".capacite-definie"), ["Fournaise (1 · 1 lien) — Réchauffe la case.", "Cendre (2 · 1 lien) — Disparaît dans la fumée."]);
    assert.equal(texteDe(seconde.querySelector(".nom-primordial")), "");
    assert.equal(texteDe(seconde.querySelector(".domaine-primordial")), "");
    assert.equal(seconde.querySelectorAll(".case-lien").length, 8);
    assert.equal(compte(seconde, ".cochee", ".capacite-definie"), 0);
    assert.doesNotMatch(texteDe(feuilles(f).querySelector(".rubrique-liens")), /Pouvoirs choisis/);
    assert.equal(compte(feuilles(f), ".legende-primordiaux", ".domaine"), 0, "plus de légende des primordiaux");
  });
  // Givre éternel : son domaine, sans capacité ; un domaine se lit sans ses espaces de bord.
  const givre = fiche((p) => (p.primordial = { nom: "Givre éternel", choix: [] }));
  assert.equal(givre.liens[0].domaine, "Froid, patience, conservation");
  const espaces = calculerFiche(retouchee((b) => (b.blocs.find((x) => x.nom === "Grand Four").notes = "  Chaleur\n")), personnageEssai());
  assert.equal(espaces.liens[0].domaine, "Chaleur");
  // Sans primordial : deux colonnes vides.
  avecDom(() => {
    const vides = feuilles(fiche((p) => (p.primordial = null))).querySelectorAll(".colonne-lien");
    assert.equal(vides.length, 2);
    assert.equal(texteDe(vides[0].querySelector(".nom-primordial")), "");
  });
});

// ─── Le verso ───────────────────────────────────────────────────────────────

test("verso — le contexte (un champ vide reste vide, sans tiret), la constellation et ses capacités, ou « Capacités à venir. », ou rien", () => {
  avecDom(() => {
    const plein = feuilles(fiche()).querySelector(".vignette-verso-contexte");
    assert.deepEqual(textes(plein, "dt"), ["Nom", "Âge", "Description", "Histoire"]);
    assert.deepEqual(textes(plein, "dd").slice(0, 2), ["Aubépine Crèmebrûlée", "31 ans"]);
    const vide = feuilles(fiche((p) => Object.assign(p.identite, { age: "", description: "", histoire: "" }))).querySelector(".vignette-verso-contexte");
    assert.deepEqual(textes(vide, "dd"), ["Aubépine Crèmebrûlée", "", "", ""]);
    assert.doesNotMatch(texteDe(vide), /—/);
    // La constellation : son nom, puis « Capacités à venir. » (le Sablier n'en a pas).
    const sablier = feuilles(fiche()).querySelector(".vignette-verso-constellation");
    assert.equal(texteDe(sablier), "Constellation de naissanceConstellation du SablierCapacités à venir.");
    const chaudron = feuilles(fiche((p) => (p.constellation = { nom: "Constellation du Chaudron", choix: [], obtention: "tirage", tirages: 1 }))).querySelector(".vignette-verso-constellation");
    assert.equal(texteDe(chaudron.querySelector(".nom-constellation")), "Constellation du Chaudron");
    assert.ok(chaudron.querySelectorAll(".capacite-definie").length >= 1);
    // Sans constellation : la vignette garde son titre et reste vide.
    const sans = feuilles(fiche((p) => (p.constellation = null))).querySelector(".vignette-verso-constellation");
    assert.equal(texteDe(sans), "Constellation de naissance");
    // Sans nom : « Personnage » dans l'en-tête du verso.
    assert.equal(texteDe(feuilles(fiche((p) => (p.identite.nom = ""))).querySelector(".verso-entete .fiche-genre")), "Personnage");
  });
});

// ─── La mesure ──────────────────────────────────────────────────────────────

// Un conteneur dont un contrôle donne les hauteurs : hauteurs(selecteur,
// serrees, noeud) rend [clientHeight, scrollHeight] (scrollHeight peut être
// une fonction), ou rien pour un nœud sans hauteur.
function conteneurMesure(hauteurs) {
  const racine = document.createElement("div");
  const rendus = [];
  const serrees = () => classesDe(racine.querySelector(".recto")).includes("definitions-serrees");
  return {
    racine,
    rendus,
    replaceChildren(noeud) {
      rendus.push(noeud);
      racine.replaceChildren(noeud);
    },
    querySelector(selecteur) {
      const noeud = racine.querySelector(selecteur);
      const h = noeud ? hauteurs(selecteur, serrees(), noeud) : null;
      if (h) Object.defineProperties(noeud, { clientHeight: { value: h[0], configurable: true }, scrollHeight: { get: typeof h[1] === "function" ? h[1] : () => h[1], configurable: true } });
      return noeud;
    },
    querySelectorAll: (selecteur) => racine.querySelectorAll(selecteur),
  };
}

test("mesure — chaque mesure refait les feuilles ; une zone qui déborde resserre les définitions (definitions-serrees), et ce qui déborde encore se nomme", () => {
  avecDom(() => {
    const f = fiche();
    // Rien de mis en page : une seule fabrication, rien ne déborde, toutes les vignettes.
    const rien = conteneurMesure(() => null);
    assert.deepEqual(mesurerFiche(rien, f), { serrees: false, recto: [], verso: [], points: VIGNETTES_POINT });
    assert.equal(rien.rendus.length, 1);
    // La zone de l'arme déborde, mais plus une fois resserrée : la classe, et rien à dire.
    const arme = conteneurMesure((s, serrees) => (s === ".recto .zone-arme" ? [80, serrees ? 80 : 95] : [100, 100]));
    assert.deepEqual(mesurerFiche(arme, f), { serrees: true, recto: [], verso: [], points: VIGNETTES_POINT });
    assert.equal(arme.rendus.length, 2);
    assert.ok(classesDe(arme.racine.querySelector(".recto")).includes("definitions-serrees"));
    // Un pixel de plus ne compte pas ; une zone sans hauteur (pas encore mise en page) ne dit rien.
    assert.equal(mesurerFiche(conteneurMesure((s) => (s === ".recto .zone-arme" ? [80, 81] : null)), f).serrees, false);
    assert.equal(mesurerFiche(conteneurMesure((s) => (s === ".recto .zone-arme" ? [0, 40] : null)), f).serrees, false);
    // Les capacités et les liens débordent même resserrés : nommés, dans l'ordre.
    const toujours = conteneurMesure((s) => ([".recto .liste-capacites", ".recto .rubrique-liens"].includes(s) ? [300, 340] : [100, 100]));
    const mesure = mesurerFiche(toujours, f);
    assert.deepEqual(mesure.recto, ["les capacités", "les liens primordiaux"]);
    assert.deepEqual(avisDeLaFiche(mesure, { parCle: new Map(), deplacement: PAS }), ["Recto : les capacités et les liens primordiaux débordent, même aux définitions resserrées ; ce qui dépasse ne s'imprime pas."]);
    assert.deepEqual(avisDeLaFiche({ recto: ["l'équipement"], verso: [] }, { deplacement: PAS }), ["Recto : l'équipement déborde, même aux définitions resserrées ; ce qui dépasse ne s'imprime pas."]);
    // Chaque zone se mesure : l'armure, l'équipement.
    for (const [selecteur, nom] of [[".zone-armure", "la zone de l'armure"], [".rubrique-equipement", "l'équipement"], [".zone-arme", "la zone de l'arme"]]) {
      assert.deepEqual(mesurerFiche(conteneurMesure((s) => (s === `.recto ${selecteur}` ? [50, 90] : null)), f).recto, [nom], selecteur);
    }
  });
});

test("mesure — au verso, les vignettes « Évènement » se retirent tant que la grille déborde, une au moins ; une vignette qui déborde se dit ; rien ne reste d'une mesure à l'autre", () => {
  avecDom(() => {
    const f = fiche();
    const points = (c) => c.racine.querySelectorAll(".vignette-verso-point").length;
    // Une grille de 300 pixels ; chaque vignette en demande 50 de plus que les 100 du reste.
    const grille = conteneurMesure((s, _serrees, noeud) => (s === ".verso .vignettes-bas" ? [300, () => 100 + 50 * noeud.querySelectorAll(".vignette-verso-point").length] : null));
    assert.equal(mesurerFiche(grille, f).points, 4);
    assert.equal(points(grille), 4);
    // Une grille qui déborde toujours : une vignette reste.
    const pleine = conteneurMesure((s) => (s === ".verso .vignettes-bas" ? [300, 900] : null));
    assert.equal(mesurerFiche(pleine, f).points, 1);
    // Le contexte et le sac débordent : l'écran les nomme, hors impression.
    const contexte = conteneurMesure((s) => ([".verso .vignette-verso-contexte", ".verso .vignette-verso-sac"].includes(s) ? [360, 500] : null));
    const mesure = mesurerFiche(contexte, f);
    assert.deepEqual(mesure.verso, ["Contexte", "Sac à dos"]);
    assert.deepEqual(avisDeLaFiche(mesure, { deplacement: PAS }), ["Verso : les vignettes « Contexte » et « Sac à dos » débordent ; ce qui dépasse ne s'imprime pas."]);
    assert.deepEqual(avisDeLaFiche({ recto: [], verso: ["Constellation de naissance"] }, { deplacement: PAS }), ["Verso : la vignette « Constellation de naissance » déborde ; ce qui dépasse ne s'imprime pas."]);
    // Le même conteneur, mesuré de nouveau sans débordement : ni classe ni retrait ne restent.
    let deborde = true;
    const changeant = conteneurMesure((s, serrees, noeud) => {
      if (!deborde) return [100, 100];
      if (s === ".recto .zone-arme") return [80, 95];
      if (s === ".verso .vignettes-bas") return [300, () => 100 + 50 * noeud.querySelectorAll(".vignette-verso-point").length];
      return [100, 100];
    });
    assert.deepEqual(mesurerFiche(changeant, f), { serrees: true, recto: ["la zone de l'arme"], verso: [], points: 4 });
    deborde = false;
    assert.deepEqual(mesurerFiche(changeant, f), { serrees: false, recto: [], verso: [], points: VIGNETTES_POINT });
    assert.ok(!classesDe(changeant.racine.querySelector(".recto")).includes("definitions-serrees"));
    assert.equal(points(changeant), VIGNETTES_POINT);
  });
});

test("mesure — la page ne s'écrit pas de style : une classe, et des nœuds retirés", () => {
  for (const fichier of ["js/fiche/feuilles.js", "js/fiche/silhouette.js", "js/ecrans/fiche_personnage.js"]) {
    const source = lire(fichier);
    // Le motif du contrôle des écritures de style du combat (combat_ecran.test.js) ; fiche.style est une donnée.
    assert.doesNotMatch(source, /\.style\s*(?:\?\.|\.|\[|=(?!=))|\bsetProperty\s*\(|\bcssText\b|setAttribute\(\s*["'`]style|classList/, fichier);
  }
});

// ─── L'impression, les couleurs, les polices ────────────────────────────────

test("impression — deux pages A4 sans marge, le recto puis le verso, chacun sa page entière ; couleurs gardées, venues des jetons", () => {
  const css = lire("css/fiche.css");
  assert.match(css, /@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
  assert.doesNotMatch(css, /@page\s+verso|page:\s*verso/, "plus de page nommée pour le verso");
  assert.equal([...css.matchAll(/@page/g)].length, 1);
  assert.match(css, /print-color-adjust:\s*exact/);
  const impression = css.slice(css.indexOf("@media print"));
  assert.match(impression, /\.feuille\.recto,\s*\.feuille\.verso\s*\{[^}]*width:\s*210mm;[^}]*height:\s*297mm;/);
  assert.match(impression, /\.feuille\.recto\s*\{\s*break-after:\s*page;/);
  assert.match(impression, /\.ne-pas-imprimer\s*\{\s*display:\s*none !important;/);
  // Deux pages de la taille d'un A4, qui ne laissent rien dépasser.
  for (const page of ["recto", "verso"]) assert.match(css, new RegExp(`\\.feuille\\.${page}\\s*\\{[^}]*height:\\s*1123px;[^}]*overflow:\\s*hidden;`), page);
  assert.match(css, /\.feuille\s*\{[^}]*width:\s*794px;[^}]*padding:\s*28px;/);
  assert.match(css, /\.feuille \.cadre-exterieur\s*\{\s*inset:\s*14px;/);
  assert.match(css, /\.feuille \.cadre-interieur\s*\{\s*inset:\s*18px;/);
  // Les zones fixes se comptent en lignes de référence, qui ne changent jamais ; seul le texte se resserre.
  assert.match(css, /--ligne-reference:\s*calc\(10\.5px \* 1\.27\);/);
  assert.match(css, /\.feuille\.definitions-serrees\s*\{\s*--taille-definition:\s*9\.5px;\s*\}/);
  for (const [zone, lignes] of [["\\.zone-capacites", 6], ["\\.zone-capacites\\.zone-armure", 4], ["\\.liste-capacites", 17]]) {
    assert.match(css, new RegExp(`\\.feuille ${zone}\\s*\\{[^}]*height:\\s*calc\\(${lignes} \\* var\\(--ligne-reference\\)`), zone);
  }
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /--ligne-definition|height:[^;]*--taille-definition/);
  // Les couleurs de la fiche viennent des jetons ; aucune couleur écrite en dur.
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(sansCommentaires, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
  for (const [, famille] of sansCommentaires.matchAll(/font-family:\s*([^;]+);/g)) {
    assert.ok(/^var\(--police-fiche(?:-titre)?\)$/.test(famille) || /^"(?:Marcellus|Alegreya Sans)"$/.test(famille), famille);
  }
  // Toutes les règles de la feuille visent la fiche (ou l'impression de la page).
  for (const [, selecteurs] of sansCommentaires.replace(/@media print\s*\{[\s\S]*$/, "").matchAll(/(?:^|\})\s*([^\s@{}][^{}]*)\{/g)) {
    for (const s of selecteurs.split(",").map((x) => x.trim())) assert.ok(/^\.feuilles?\b/.test(s), s);
  }
});

test("couleurs — le noir et blanc de la maquette dans jetons.css, dont la couleur sur la silhouette ; aucun thème ne lit ni ne redéclare les jetons de la fiche", () => {
  const jetons = lire("css/jetons.css");
  const valeur = (nom) => jetons.match(new RegExp(`${nom}:\\s*([^;]+);`))?.[1];
  assert.equal(valeur("--fiche-papier"), "#ffffff");
  assert.equal(valeur("--fiche-encre"), "#111111");
  assert.equal(valeur("--fiche-titre"), "#111111");
  assert.equal(valeur("--fiche-bandeau"), "#e9e9e9");
  assert.equal(valeur("--fiche-silhouette"), "#d4d4d4");
  assert.equal(valeur("--fiche-sur-silhouette"), "#111111");
  assert.equal([...jetons.matchAll(/--fiche-[a-z0-9-]+:/g)].length, 21, "une seule déclaration de chaque jeton");
  assert.doesNotMatch(jetons, /--fiche-silhouette-trait|--fiche-case-grisee/, "plus de jeton qu'aucune règle ne lit");
  // Chaque jeton déclaré est lu par la feuille de la fiche.
  for (const [, jeton] of jetons.matchAll(/(--fiche-[a-z0-9-]+):/g)) assert.ok(lire("css/fiche.css").includes(`var(${jeton})`), jeton);
  for (const feuille of readdirSync(new URL("css/", racine)).filter((f) => f.endsWith(".css") && !["fiche.css", "jetons.css"].includes(f))) {
    assert.doesNotMatch(lire(`css/${feuille}`), /--fiche-/, feuille);
  }
  assert.doesNotMatch(lire("js/apparence/themes.js"), /--fiche-|fiche-/);
  // Les jetons que la feuille lit sont tous déclarés.
  for (const [, jeton] of lire("css/fiche.css").matchAll(/var\((--fiche-[a-z0-9-]+)\)/g)) assert.ok(valeur(jeton), jeton);
});

test("polices — les trois du papier et les dix-neuf des thèmes hébergées dans le dépôt, avec leur licence OFL ; rien d'autre", () => {
  // Chaque papier appelle ses polices depuis sa feuille : la fiche de
  // personnage (§ 15.4), la carte d'adversaire (§ 16.5). Les polices de
  // titre des thèmes, celles du catalogue dont le fichier n'est pas null,
  // depuis la feuille engendrée (§ 10.2).
  const deTheme = Object.values(POLICES).filter((police) => police.fichier !== null).map((police) => police.fichier);
  assert.equal(deTheme.length, 19);
  const attendues = {
    "css/fiche.css": ["AlegreyaSans-Bold.woff2", "AlegreyaSans-Italic.woff2", "AlegreyaSans-Medium.woff2", "AlegreyaSans-Regular.woff2", "Marcellus-Regular.woff2"],
    "css/adversaire.css": ["EBGaramond-Italic.woff2", "EBGaramond-Variable.woff2"],
    "css/themes.css": [...deTheme].sort(),
  };
  // Une licence par famille : « Cinzel-Bold.woff2 » a « OFL-Cinzel.txt ».
  const licences = ["OFL-AlegreyaSans.txt", "OFL-EBGaramond.txt", "OFL-Marcellus.txt", ...deTheme.map((fichier) => `OFL-${fichier.replace(/-(?:Regular|Bold)\.woff2$/, "")}.txt`)];
  assert.equal(new Set(licences).size, 22);
  // Trois feuilles seulement déclarent des polices.
  const declarent = readdirSync(new URL("css/", racine), { recursive: true })
    .map((fichier) => `css/${String(fichier).replaceAll("\\", "/")}`)
    .filter((feuille) => feuille.endsWith(".css") && /@font-face/.test(lire(feuille)));
  assert.deepEqual(declarent.sort(), Object.keys(attendues).sort());
  for (const [feuille, polices] of Object.entries(attendues)) {
    const css = lire(feuille);
    const appels = [...css.matchAll(/url\("\.\.\/polices\/([^"]+)"\)/g)].map(([, f]) => f);
    assert.deepEqual(appels.sort(), polices, feuille);
    assert.equal([...css.matchAll(/url\(/g)].length, appels.length, `${feuille} : aucune autre adresse`);
  }
  const appels = Object.values(attendues).flat();
  assert.equal(appels.length, 26);
  const fichiers = readdirSync(new URL("polices/", racine)).sort();
  assert.deepEqual(fichiers, [...appels, ...licences].sort());
  for (const police of appels) assert.equal(readFileSync(new URL(`polices/${police}`, racine)).subarray(0, 4).toString("latin1"), "wOF2", police);
  for (const licence of licences) assert.match(lire(`polices/${licence}`), /SIL Open Font License, Version 1\.1/);
  // La page les permet par sa politique de sécurité, et lie les deux feuilles
  // du papier ; le lien de css/themes.css se vérifie avec l'ordre des feuilles.
  assert.match(lire("index.html"), /font-src 'self';/);
  for (const feuille of ["css/fiche.css", "css/adversaire.css"]) assert.ok(lire("index.html").includes(`<link rel="stylesheet" href="${feuille}">`), feuille);
});

test("démonstration — le personnage fourni vient de l'outil, est complet, et sans changement contre la banque de démonstration", async () => {
  assert.ok(existsSync(new URL(CHEMIN_PERSONNAGE_DEMO, racine)));
  // Git pour Windows peut l'extraire en fins de ligne CRLF (core.autocrlf).
  const texte = lire(CHEMIN_PERSONNAGE_DEMO).replace(/\r\n/g, "\n");
  const { personnage, erreur } = lirePersonnage(texte, { mode: "demo" });
  assert.equal(erreur, undefined, erreur);
  assert.equal(personnage.etat, "enregistre");
  const enveloppe = JSON.parse(lire("essais/banque_demo.chiffree.json"));
  const { banque } = await ouvrirAvecMotDePasse(enveloppe, MOT_DE_PASSE_DEMO);
  assert.equal(texte, ecrirePersonnage(personnageDemo(banque, enveloppe)), "personnage périmé : relancer node outils/personnage_demo.js");
  const index = indexerCreation(banque);
  assert.deepEqual(changements(index, personnage.empreintes), []);
  assert.deepEqual(manques(banque, personnage, { index })[9], []);
  // Il suit ses dix-neuf capacités, dont les deux que le bloc de base donne depuis le lot 4 (§ 15.7).
  const suivies = personnage.empreintes.filter((e) => e.genre === "capacite").map((e) => e.nom);
  assert.equal(suivies.length, 19);
  assert.deepEqual(suivies.slice(9, 14), ["Pas chassé", "Goûter", "Taloche", "Pas de côté", "Guetter"]);
  assert.match(lirePersonnage(texte, { mode: "reel" }).erreur, /créé dans la démonstration/);
  // La banque de démonstration dit les domaines des deux primordiaux (spécification 1.7).
  assert.deepEqual(["Grand Four", "Givre éternel"].map((nom) => banque.blocs.find((b) => b.nom === nom).notes), ["Chaleur, cuisson, appétit", "Froid, patience, conservation"]);
});

test("relecture — impression depuis la vue lecture : la fiche n'est masquée qu'à l'écran, et l'impression la rétablit", () => {
  const personnage = lire("css/personnage.css");
  const ecran = personnage.slice(personnage.indexOf("@media screen"));
  assert.match(ecran, /^@media screen \{\s*\.ecran-personnage\.vue-lecture \.cadre-feuilles \{/);
  // Hors de @media screen, rien ne masque le cadre de la fiche.
  const horsEcran = personnage.replace(/@media screen \{[\s\S]*?\n\}/, "");
  assert.doesNotMatch(horsEcran, /cadre-feuilles[^{]*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/);
  const impression = lire("css/fiche.css").slice(lire("css/fiche.css").indexOf("@media print"));
  assert.match(impression, /\.cadre-feuilles \{\s*display: block !important;\s*height: auto !important;[\s\S]*?visibility: visible !important;/);
  // Les deux pages gardent la couleur du papier, même sans « imprimer les arrière-plans ».
  assert.match(impression, /body \{[^}]*background: var\(--fiche-papier\);[^}]*print-color-adjust: exact;/);
  assert.match(lire("css/fiche.css"), /\.feuille \{[^}]*background: var\(--fiche-papier\);/);
});

test("relecture — la feuille ne coupe pas les mots comme l'interface, ni ne prend la taille ou l'interligne des titres d'un thème ; la vue lecture dit qu'une capacité se déplie, et un coût nul", () => {
  const css = lire("css/fiche.css");
  assert.match(css, /\.feuille \{[^}]*overflow-wrap: normal;/);
  assert.match(css, /\.feuille \{[^}]*font-size: 16px;/);
  assert.match(css, /\.feuille h2,\s*\.feuille h3 \{\s*line-height: inherit;/);
  assert.match(lire("css/personnage.css"), /\.lecture-capacites summary::before \{\s*content: "▸";/);
  assert.match(lire("css/personnage.css"), /details\[open\] > summary::before \{\s*content: "▾";/);
  avecDom(() => {
    const noeud = lecture(fiche());
    const vif = [...noeud.querySelectorAll("summary")].find((s) => texteDe(s).startsWith("Vif"));
    assert.equal(texteDe(vif), "Vif niveau 1 / 3 · sans coût");
  });
});

test("relecture — aucune classe de la fiche n'est prise par une autre feuille du site (vignette, objet, caracteristique, capacite-nom…)", () => {
  const source = lire("js/fiche/feuilles.js") + lire("js/fiche/silhouette.js");
  const classes = new Set();
  for (const [, a, b] of source.matchAll(/classe: (?:`([^`]*)`|"([^"]*)")/g)) for (const c of (a ?? b).replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (c) classes.add(c);
  for (const c of ["case-petite", "case-corps", "case-lien", "cochee", "teintee", "definitions-serrees", "ligne-arme", "ligne-armure", "ligne-bouclier", "sur-silhouette"]) classes.add(c);
  // Et toutes celles que vise la feuille de la fiche, hors l'impression, qui vise la page.
  const feuille = lire("css/fiche.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)/g, "").replace(/@media print\s*\{[\s\S]*$/, "");
  const deLaFeuille = new Set([...feuille.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(([, c]) => c));
  for (const c of deLaFeuille) classes.add(c);
  assert.ok(deLaFeuille.has("trait-libre") && deLaFeuille.has("petite") && deLaFeuille.has("vignette-verso-sac"), "les classes de la feuille sont lues");
  assert.ok(classes.size > 100, `${classes.size} classes`);
  // Les classes du papier d'avant le lot 5, déjà mesurées (§ 15.4), qu'une
  // autre feuille ne vise que dans son propre cadre (.formulaire .case, .case input).
  const communes = new Set(["case", "feuille", "feuilles"]);
  const autres = readdirSync(new URL("css/", racine)).filter((f) => f.endsWith(".css") && !["fiche.css"].includes(f));
  for (const feuille of autres) {
    const css = lire(`css/${feuille}`).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const c of classes) {
      if (communes.has(c)) continue;
      assert.doesNotMatch(css, new RegExp(`\\.${c.replace(/-/g, "\\-")}(?![-\\w])`), `${feuille} vise .${c}`);
    }
  }
  for (const prise of ["vignette", "objet", "forme", "libre", "compacte", "caracteristique", "capacite-nom", "capacite-texte"]) assert.ok(!classes.has(prise), prise);
});
