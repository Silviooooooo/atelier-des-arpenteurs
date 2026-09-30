// Contrôles de la fiche imprimable (SPECIFICATION.md, § 15.4, § 15.7 et
// § 11, domaine « Personnage ») : la répartition du recto et son
// débordement, le recto et le verso fabriqués dans un document simulé,
// l'impression, les polices hébergées, le personnage de démonstration. La
// mise en page elle-même se mesure dans un vrai navigateur (§ 15.4).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { importerFichier } from "../js/banque/importation.js";
import { coutRecto, feuilles } from "../js/fiche/feuilles.js";
import { lecture } from "../js/fiche/lecture.js";
import { MINIMUM_CAPACITES, MODELE_CAPACITES, PLACES, repartir } from "../js/fiche/repartition.js";
import { calculerFiche, indexerCreation } from "../js/personnage/calcul.js";
import { ecrirePersonnage, lirePersonnage } from "../js/personnage/format.js";
import { manques } from "../js/personnage/parcours.js";
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
const lignes = (r) => Object.values(r.capacites).reduce((n, g) => n + g.length, 0);

// Une fiche fabriquée : n capacités d'archétype, e objets, p pouvoirs.
function ficheFabriquee({ archetype = 3, objets = 0, pouvoirs = 1, pieces = [] } = {}) {
  const c = (nom) => ({ nom, niveau: 1, niveauMax: 3, cout: { souffle: "0", lien: "0" }, aVenir: false });
  return {
    groupes: {
      espece: [c("E1"), c("E2")],
      archetype: Array.from({ length: archetype }, (_, i) => c(`A${i + 1}`)),
      style: [],
      constellation: [c("C1")],
      acquises: [],
    },
    constellation: { nom: "Ciel", saisie: false },
    equipement: Array.from({ length: objets }, (_, i) => ({ nom: `O${i + 1}`, qualite: { applicable: true, texte: "X" } })),
    liens: [{ nom: "Primordial", points: 2, pouvoirs: Array.from({ length: pouvoirs }, (_, i) => c(`P${i + 1}`)) }],
    defense: { pieces },
  };
}

test("répartition — les places du modèle : neuf lignes de capacités, huit d'équipement, trois pouvoirs", () => {
  assert.deepEqual({ capacites: PLACES.capacites, equipement: PLACES.equipement, pouvoirs: PLACES.pouvoirs }, { capacites: 9, equipement: 8, pouvoirs: 3 });
  assert.equal(MINIMUM_CAPACITES, 9);
  assert.deepEqual(MODELE_CAPACITES, { espece: 2, archetype: 3, style: 1, constellation: 1, acquises: 2 });
  // Un personnage sans rien : les neuf lignes vides du modèle, groupe par groupe.
  const vide = repartir({ ...ficheFabriquee({ archetype: 0 }), groupes: { espece: [], archetype: [], style: [], constellation: [], acquises: [] }, constellation: null });
  assert.deepEqual(Object.fromEntries(Object.entries(vide.capacites).map(([g, l]) => [g, l.length])), MODELE_CAPACITES);
  assert.equal(vide.deborde, false);
});

test("répartition — le personnage de démonstration : les groupes se partagent les neuf lignes ; la constellation sans capacité en tient une", () => {
  const r = repartir(fiche());
  assert.deepEqual(Object.fromEntries(Object.entries(r.capacites).map(([g, l]) => [g, l.length])), { espece: 2, archetype: 4, style: 1, constellation: 1, acquises: 1 });
  assert.equal(r.capacites.constellation[0].aVenirGroupe, true);
  assert.equal(lignes(r), 9);
  // Neuf objets : le neuvième passe au verso.
  assert.equal(r.equipement.length, 8);
  assert.deepEqual(r.suite.equipement.map((o) => o.nom), ["Bouillon revigorant"]);
  // Quatre pièces d'armure : trop long pour le champ, le détail passe au verso.
  assert.deepEqual(r.armure, { texte: "4 pièces, détail au verso", auVerso: true });
  assert.deepEqual(r.suite.armure, ["Tablier de cuir", "Guêtres de toile", "Maniques", "Toque renforcée"]);
  assert.equal(r.deborde, true);
});

test("débordement — le recto ne dépasse jamais ses places ; chaque groupe garde une ligne ; le reste passe au verso, dans l'ordre", () => {
  const r = repartir(ficheFabriquee({ archetype: 9, objets: 12, pouvoirs: 5, pieces: ["Casque"] }));
  assert.equal(lignes(r), 9, "jamais plus que les places");
  assert.equal(r.capacites.espece.length >= 1 && r.capacites.constellation.length >= 1, true, "chaque groupe qui a une capacité en garde une ligne");
  assert.deepEqual(r.capacites.constellation.map((l) => l.nom), ["C1"]);
  assert.deepEqual(r.suite.capacites.map((l) => [l.groupe, l.nom]), [["archetype", "A7"], ["archetype", "A8"], ["archetype", "A9"]]);
  assert.equal(r.equipement.length, 8);
  assert.deepEqual(r.suite.equipement.map((o) => o.nom), ["O9", "O10", "O11", "O12"]);
  assert.equal(r.liens[0].pouvoirs.length, 3);
  assert.deepEqual(r.suite.pouvoirs.map((p) => p.nom), ["P4", "P5"]);
  assert.deepEqual(r.armure, { texte: "Casque", auVerso: false });
  // Le navigateur mesure un débordement : une place de moins, une ligne de plus au verso.
  const moins = repartir(ficheFabriquee({ archetype: 9 }), { ...PLACES, capacites: 8 });
  assert.equal(lignes(moins), 8);
  assert.equal(moins.suite.capacites.length, 4);
  // Sous le minimum de lignes, aucun débordement.
  assert.equal(repartir(ficheFabriquee({ archetype: 4 })).deborde, false);
});

test("recto — le modèle rempli : en-tête, caractéristiques, attaque, défense, capacités, reliquat, souffle, armure, corps, équipement, liens", () => {
  const retirer = installerDom();
  try {
    const f = fiche();
    const noeud = feuilles(f);
    const recto = noeud.querySelector(".recto");
    assert.deepEqual([...recto.querySelectorAll(".valeur-entete")].map(texteDe), ["Aubépine Crèmebrûlée", "Marmiton", "Saucier", "Solo du chef", "1"]);
    assert.deepEqual([...recto.querySelectorAll(".boite-valeur")].map(texteDe), ["4", "5", "5", "3", "4", "3", "4", "4", "4"]);
    const attaque = texteDe(recto.querySelector(".rubrique-attaque"));
    assert.match(attaque, /Couteau d'office/);
    assert.match(attaque, /d10/);
    assert.match(attaque, /Types mêlés : dé agile, désavantage sans la maîtrise de toutes les pièces/);
    assert.match(texteDe(recto.querySelector(".rubrique-capacites").querySelector("h2")), /Reliquat : 0 point/);
    assert.equal(recto.querySelectorAll(".ligne-capacite").length, 9);
    // Les cases de puissance cochées jusqu'au niveau ; grisées au-delà du maximum.
    const cases = (nom) => {
      const ligne = [...recto.querySelectorAll(".ligne-capacite")].find((l) => texteDe(l).startsWith(nom));
      return [...ligne.querySelectorAll(".case")].map((c) => (c.className.includes("cochee") ? "x" : c.className.includes("grisee") ? "-" : "o")).join("");
    };
    assert.equal(cases("Flambage"), "xxo");
    assert.equal(cases("Vif"), "xoo");
    assert.equal(cases("Nez fin"), "---", "niveau 0 : n'évolue pas");
    // La colonne coût : le souffle, et le lien s'il y en a.
    assert.equal(texteDe([...recto.querySelectorAll(".ligne-capacite")].find((l) => texteDe(l).startsWith("Flambage")).querySelector(".cout")), "10");
    assert.equal(coutRecto({ souffle: "1", lien: "1" }), "1·1L");
    // Souffle : dix cases, dix grisées au-delà du maximum.
    const souffle = [...recto.querySelectorAll(".case-souffle")];
    assert.equal(souffle.length, 20);
    assert.equal(souffle.filter((c) => c.className.includes("grisee")).length, 10);
    assert.match(texteDe(recto.querySelector(".rubrique-souffle")), /10 à la création · \+1 par point d'historique/);
    assert.doesNotMatch(texteDe(recto), /5 par niveau/);
    // Armure par zone, dans l'ordre du modèle ; cinq cases de résistance.
    assert.deepEqual([...recto.querySelectorAll(".trait.arm")].map(texteDe), ["6", "30", "10", "10", "10", "10"]);
    assert.equal(recto.querySelectorAll(".case-resistance").length, 30);
    // Corps : dix cases, les cinq dernières teintées.
    assert.equal([...recto.querySelectorAll(".case-corps")].filter((c) => c.className.includes("teintee")).length, 5);
    assert.equal(recto.querySelectorAll(".ligne-objet").length, 8);
    // Liens : le primordial lié, un point de lien, le reste grisé ; la légende des huit.
    const lien = recto.querySelectorAll(".colonne-lien")[0];
    assert.match(texteDe(lien), /Grand Four/);
    assert.equal([...lien.querySelectorAll(".case-lien")].filter((c) => !c.className.includes("grisee")).length, 1);
    assert.match(texteDe(recto.querySelector(".legende-primordiaux")), /Derkat vengeance · Enaël savoir · Ithilvion choix · Kalester endurance · Neru équilibre/);
    assert.match(texteDe(recto.querySelector(".legende-primordiaux")), /Makith noirceur · Kouvîmäar protection · Sillybir pardon/);
    assert.equal(texteDe(recto.querySelector(".fiche-pied")), "Banque du 29/09/2026 · constellation tirée 3 fois", "le pied dit le nombre de tirages (lot 2 bis)");
  } finally {
    retirer();
  }
});

test("recto — la constellation saisie à la main se dit en pied de page ; sans arme, les mains nues et un dé vide", () => {
  const retirer = installerDom();
  try {
    const f = fiche((p) => {
      p.constellation.obtention = "saisie";
      p.equipement[0].place = "sac";
    });
    const recto = feuilles(f).querySelector(".recto");
    assert.equal(texteDe(recto.querySelector(".fiche-pied")), "Banque du 29/09/2026 · constellation saisie à la main");
    const attaque = recto.querySelector(".rubrique-attaque");
    assert.equal(texteDe(attaque.querySelector(".trait.large")), "Taloche");
    assert.equal(texteDe(attaque.querySelector(".trait.de")), "");
    assert.deepEqual([...attaque.querySelectorAll(".trait.rang")].map(texteDe), ["2", "4", "8"]);
  } finally {
    retirer();
  }
});

test("verso — suite du recto, contexte, historique, toutes les armes, toutes les capacités, points et avertissements", () => {
  const retirer = installerDom();
  try {
    const f = fiche((p) => p.equipement.push({ nom: "Poêle en fonte", choix: [], qualite: null, place: "sac" }));
    const verso = feuilles(f).querySelector(".verso");
    const texte = texteDe(verso);
    assert.match(texte, /Suite du recto/);
    assert.match(texte, /Équipement : Bouillon revigorant/);
    assert.match(texte, /Armure portée : Tablier de cuir, Guêtres de toile, Maniques, Toque renforcée/);
    assert.match(texte, /Commis d'une auberge du port/);
    assert.ok(verso.querySelectorAll(".ligne-libre").length >= 6, "des lignes vides pour l'historique");
    assert.equal(verso.querySelector(".table-verso").querySelector("tbody").querySelectorAll("tr").length, f.armes.length);
    assert.equal(verso.querySelectorAll(".detail-capacite").length, f.capacites.length, "toutes les capacités, base et équipement compris");
    assert.match(texte, /Taloche — niveau 1 \/ 3 · coût 0/);
    assert.match(texte, /Une taloche qui inflige 2\/4\/8\./);
    assert.match(texte, /Omelette fantôme — capacité à venir/);
    assert.match(texte, /Points de capacité : 10 \/ 10 \(reçus : 8\) · reliquat : 0 point/);
    assert.match(texte, /Avertissements/);
  } finally {
    retirer();
  }
});

test("fiche — un nom qui contient du HTML reste du texte", () => {
  const retirer = installerDom();
  try {
    const f = fiche((p) => (p.identite.nom = '<img src=x onerror="alert(1)">'));
    const noeud = feuilles(f);
    assert.equal(texteDe(noeud.querySelector(".valeur-entete")), '<img src=x onerror="alert(1)">');
    assert.equal(noeud.querySelectorAll("img").length, 0);
  } finally {
    retirer();
  }
});

test("impression — A4 sans marge, couleurs gardées, le recto seul sur la première page, le verso ensuite", () => {
  const css = lire("css/fiche.css");
  assert.match(css, /@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
  assert.match(css, /@page verso\s*\{/);
  assert.match(css, /print-color-adjust:\s*exact/);
  const impression = css.slice(css.indexOf("@media print"));
  assert.match(impression, /\.feuille\.recto\s*\{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*break-after:\s*page;/);
  assert.match(impression, /\.feuille\.verso\s*\{[^}]*page:\s*verso;/);
  // Firefox met le document en page à la largeur de la première page, sans
  // marge : le verso, à marges, a sa largeur propre.
  assert.match(impression, /\.feuille\.verso\s*\{[^}]*width:\s*182mm;/);
  assert.match(impression, /\.ne-pas-imprimer\s*\{\s*display:\s*none !important;/);
  // Le recto a la taille du modèle, et ne laisse rien dépasser.
  assert.match(css, /\.feuille\.recto\s*\{[^}]*height:\s*1123px;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.feuille\s*\{[^}]*width:\s*794px;/);
  // Les couleurs de la fiche viennent des jetons ; aucune couleur écrite en dur.
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(sansCommentaires, /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
  for (const [, famille] of sansCommentaires.matchAll(/font-family:\s*([^;]+);/g)) {
    assert.ok(/^var\(--police-fiche(?:-titre)?\)$/.test(famille) || /^"(?:Marcellus|Alegreya Sans)"$/.test(famille), famille);
  }
});

test("polices — Marcellus et Alegreya Sans hébergées dans le dépôt, avec leur licence OFL ; rien d'autre", () => {
  const css = lire("css/fiche.css");
  const appels = [...css.matchAll(/url\("\.\.\/polices\/([^"]+)"\)/g)].map(([, f]) => f);
  assert.deepEqual(appels.sort(), ["AlegreyaSans-Bold.woff2", "AlegreyaSans-Italic.woff2", "AlegreyaSans-Medium.woff2", "AlegreyaSans-Regular.woff2", "Marcellus-Regular.woff2"]);
  assert.equal([...css.matchAll(/url\(/g)].length, appels.length, "aucune autre adresse");
  const fichiers = readdirSync(new URL("polices/", racine)).sort();
  assert.deepEqual(fichiers, [...appels.sort(), "OFL-AlegreyaSans.txt", "OFL-Marcellus.txt"].sort());
  for (const police of appels) assert.equal(readFileSync(new URL(`polices/${police}`, racine)).subarray(0, 4).toString("latin1"), "wOF2", police);
  for (const licence of ["OFL-AlegreyaSans.txt", "OFL-Marcellus.txt"]) assert.match(lire(`polices/${licence}`), /SIL Open Font License, Version 1\.1/);
  // La page les permet par sa politique de sécurité, et ne charge que la feuille de la fiche.
  assert.match(lire("index.html"), /font-src 'self';/);
  assert.match(lire("index.html"), /<link rel="stylesheet" href="css\/fiche\.css">/);
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
  assert.match(lirePersonnage(texte, { mode: "reel" }).erreur, /créé dans la démonstration/);
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
  // Le verso garde la couleur du papier, même sans « imprimer les arrière-plans ».
  assert.match(impression, /body \{[^}]*print-color-adjust: exact;/);
  assert.match(impression, /\.feuille\.verso \{[^}]*background: var\(--fiche-papier\);/);
});

test("relecture — la feuille ne coupe pas les mots comme l'interface ; la vue lecture dit qu'une capacité se déplie, et un coût nul", () => {
  assert.match(lire("css/fiche.css"), /\.feuille \{[^}]*overflow-wrap: normal;/);
  assert.match(lire("css/personnage.css"), /\.lecture-capacites summary::before \{\s*content: "▸";/);
  assert.match(lire("css/personnage.css"), /details\[open\] > summary::before \{\s*content: "▾";/);
  const retirer = installerDom();
  try {
    const noeud = lecture(fiche());
    const vif = [...noeud.querySelectorAll("summary")].find((s) => texteDe(s).startsWith("Vif"));
    assert.equal(texteDe(vif), "Vif niveau 1 / 3 · sans coût");
  } finally {
    retirer();
  }
});

test("relecture — recto : primordial sans capacité, « capacités à venir » sur sa ligne ; « suite au verso » pour l'équipement et les pouvoirs", () => {
  const retirer = installerDom();
  try {
    const givre = feuilles(fiche((p) => (p.primordial = { nom: "Givre éternel", choix: [] }))).querySelector(".recto");
    const colonne = givre.querySelectorAll(".colonne-lien")[0];
    assert.equal(texteDe(colonne.querySelector(".nom-primordial")), "Givre éternel");
    assert.equal(texteDe(colonne.querySelectorAll(".nom-pouvoir")[0]), "capacités à venir");
    assert.ok(colonne.querySelectorAll(".nom-pouvoir")[0].className.includes("a-venir"));
    // Neuf objets : l'équipement le dit au recto.
    assert.match(texteDe(feuilles(fiche()).querySelector(".rubrique-equipement")), /objet · qualité · suite au verso/);
    assert.doesNotMatch(texteDe(feuilles(fiche((p) => p.equipement.pop())).querySelector(".rubrique-equipement")), /suite au verso/);
    // Quatre pouvoirs : le quatrième au verso, et la colonne le dit.
    const f = fiche();
    f.liens[0].pouvoirs = ["A", "B", "C", "D"].map((nom) => ({ nom, niveau: 1, niveauMax: 3, aVenir: false }));
    assert.match(texteDe(feuilles(f).querySelectorAll(".colonne-lien")[0]), /Pouvoirs choisis · suite au verso/);
  } finally {
    retirer();
  }
});
