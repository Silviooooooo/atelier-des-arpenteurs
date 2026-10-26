// Contrôles de l'étape 7 du créateur en vignettes (SPECIFICATION.md, § 15.3 ;
// lot 5) : la ligne des maîtrises en tête ; l'arme tenue et le pack
// d'armure en vignettes radio, chacune avec ses poids, ses paramètres à la
// qualité de la création, ses capacités et leur désavantage, son état de
// maîtrise ; « ✓ tenue », « ✓ porté » ; le pack que la banque ne propose
// pas (A10) ; le lien vers une anomalie ; le choix toujours permis.
//
// L'écran se construit dans un document simulé, sur la banque du classeur
// d'essai, fictif ; la maîtrise elle-même (maitrise.js) a ses contrôles
// dans maitrise.test.js : ici, ce que l'écran en montre. Les cas que la
// démonstration n'a pas (deux poids, une Maîtrise plus haute, trois
// capacités) se fabriquent en mémoire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche, indexerCreation } from "../js/personnage/calcul.js";
import { nouveauPersonnage } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", RACINE)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T10:00:00+02:00" };
const PERMIS = "Une arme ou un pack d'un autre type n'est pas maîtrisé : il reste permis.";

const creation = await import("../js/ecrans/creation.js");

function contexteDe(banque = BANQUE) {
  return {
    etat: { mode: "demo", banque, etagere: creerEtagere(magasinPersonnagesMemoire(), "demo"), chargement: { enveloppe: { empreinte: "0123456789abcdef" } } },
    naviguer() {},
    afficher() {},
  };
}

// L'étape 7 d'un personnage gardé dans l'étagère du contexte.
async function etape7(personnage, banque = BANQUE) {
  const contexte = contexteDe(banque);
  await contexte.etat.etagere.garder(personnage);
  const ecran = creation.afficher(contexte, { ecran: "creation", id: personnage.id, etape: 7 });
  document.body.replaceChildren(ecran);
  await laisserFiler(10);
  return { ecran, relire: () => contexte.etat.etagere.lire(personnage.id) };
}

const cocher = (entree) => {
  entree.checked = true;
  entree.declencher("change");
};
const vignettesDe = (ecran, name) => [...ecran.querySelectorAll(`input[name=${name}]`)].map((entree) => entree.parentNode);
const nomDe = (vignette) => texteDe(vignette.querySelector("label"));
// La vignette d'une arme par son nom : son label porte ensuite ses poids.
const arme = (ecran, nom) => vignettesDe(ecran, "arme").find((v) => nomDe(v) === nom || nomDe(v).startsWith(`${nom} `)) ?? null;
const poids = (vignette) => [...vignette.querySelectorAll(".etiquette-poids")].map(texteDe);
const parametres = (vignette) => [...vignette.querySelectorAll("dt")].map((dt, i) => [texteDe(dt), texteDe(vignette.querySelectorAll("dd")[i])]);
const capacites = (vignette) => texteDe(vignette.querySelector(".vignette-capacites"));
const mention = (vignette) => texteDe(vignette.querySelector(".mention-maitrise"));
const classes = (vignette) => vignette.className.split(" ");
const coche = (vignette) => texteDe(vignette.querySelector(".vignette-coche") ?? { textContent: "" });

// Un bloc de la banque, modifié dans une copie.
function banqueAvec(nom, modifier) {
  const banque = structuredClone(BANQUE);
  modifier(banque.blocs.find((b) => b.nom === nom));
  return banque;
}

test("étape 7 — en tête, la ligne des maîtrises du personnage ; « aucune » sans maîtrise", async () => {
  const retirer = installerDom();
  try {
    let { ecran } = await etape7(personnageEssai());
    const premier = ecran.querySelector(".etape").children[0];
    assert.ok(premier === ecran.querySelector(".ligne-maitrises"), "la ligne vient d'abord");
    assert.equal(texteDe(premier), `Maîtrises d'Aubépine Crèmebrûlée : Maîtrise de l'agile [1]. ${PERMIS}`);
    ({ ecran } = await etape7(personnageEssai((p) => {
      p.identite.nom = "Rôtisseur";
      p.niveaux.push({ capacite: "Maîtrise de l'agile", niveau: 2 });
    })));
    assert.equal(texteDe(ecran.querySelector(".ligne-maitrises")), `Maîtrises de Rôtisseur : Maîtrise de l'agile [2]. ${PERMIS}`);
    ({ ecran } = await etape7(nouveauPersonnage("demo")));
    assert.equal(texteDe(ecran.querySelector(".ligne-maitrises")), `Maîtrises du personnage : aucune. ${PERMIS}`);
  } finally {
    retirer();
  }
});

test("étape 7 — l'arme tenue en vignettes radio : « Mains nues » d'abord, puis chaque arme de la banque, sans les armes naturelles ; ni liste ni catalogue", async () => {
  const retirer = installerDom();
  try {
    const { ecran } = await etape7(personnageEssai());
    const armes = vignettesDe(ecran, "arme");
    const index = indexerCreation(BANQUE);
    assert.deepEqual(
      armes.map((v) => texteDe(v.querySelector("label")).replace(/ (lourde|agile|précise)$/, "")),
      ["Mains nues", ...index.blocsDeType("arme").map((b) => b.nom)],
    );
    assert.ok(!armes.some((v) => nomDe(v).startsWith("Pinces de homard")), "une arme naturelle n'est pas une arme tenue");
    assert.ok(armes.every((v) => classes(v).includes("vignette") && v.querySelector("input").getAttribute("type") === "radio"));
    assert.equal(ecran.querySelector("select#arme"), null);
    assert.equal(ecran.querySelector(".catalogue"), null);
    assert.ok(armes[0].parentNode.className.split(" ").includes("vignettes-equipement"), "la grille de l'étape 7");
  } finally {
    retirer();
  }
});

test("étape 7 — une vignette d'arme : son poids en étiquette (deux pour deux poids, aucune sans), ses paramètres à la qualité 2", async () => {
  const retirer = installerDom();
  try {
    let { ecran } = await etape7(personnageEssai());
    assert.deepEqual(poids(arme(ecran, "Spatule souple")), ["agile"]);
    assert.deepEqual(poids(arme(ecran, "Couteau d'office")), ["précise"]);
    assert.deepEqual(poids(arme(ecran, "Rouleau de fonte")), ["lourde"]);
    assert.deepEqual(poids(arme(ecran, "Louche d'acier")), []);
    // Dégâts, Portée, Qualité, dans cet ordre ; la qualité X vaut 2 à la création.
    assert.deepEqual(parametres(arme(ecran, "Spatule souple")), [["Dégâts", "5/10/15"], ["Portée", "0"], ["Qualité", "2"]]);
    assert.deepEqual(parametres(arme(ecran, "Couteau d'office")), [["Dégâts", "3/8/20"], ["Portée", "1"], ["Qualité", "2"]]);
    // Tout autre paramètre, sous le nom de l'élément qui le reçoit, calculé
    // comme la fiche le calcule (contexte, valeursParametre).
    assert.deepEqual(parametres(arme(ecran, "Louche d'acier")).map(([nom]) => nom), ["Brûlant", "Distance"]);
    assert.equal(parametres(arme(ecran, "Louche d'acier"))[1][1], "0");
    // Une valeur que le calcul ne donne pas (X), telle qu'écrite.
    ({ ecran } = await etape7(personnageEssai(), banqueAvec("Louche d'acier", (b) => {
      b.parametres.find((p) => p.nom === "distance").valeur = "X";
    })));
    assert.deepEqual(parametres(arme(ecran, "Louche d'acier"))[1], ["Distance", "X"]);

    // Deux poids : deux étiquettes.
    ({ ecran } = await etape7(personnageEssai(), banqueAvec("Rouleau de fonte", (b) => b.elements.push({ nom: "Agile" }))));
    assert.deepEqual(poids(arme(ecran, "Rouleau de fonte")), ["lourde", "agile"]);

    // Une qualité fixée par la banque : les dégâts sont ceux que la fiche calcule pour l'arme tenue.
    const banque = banqueAvec("Rouleau de fonte", (b) => {
      b.parametres.find((p) => p.nom === "qualite").valeur = "3";
    });
    const tenu = personnageEssai((p) => {
      p.equipement[0] = { nom: "Rouleau de fonte", choix: [], qualite: "2", place: "arme" };
      p.equipement[1] = { nom: "Bouillon revigorant", choix: [], qualite: null, place: "sac" };
    });
    ({ ecran } = await etape7(tenu, banque));
    const fiche = calculerFiche(banque, tenu);
    assert.deepEqual(parametres(arme(ecran, "Rouleau de fonte")), [["Dégâts", fiche.attaque.degats.join("/")], ["Portée", "0"], ["Qualité", "3"]]);
    assert.notEqual(fiche.attaque.degats.join("/"), "8/11/13", "la qualité 3 change les dégâts");
  } finally {
    retirer();
  }
});

test("étape 7 — les capacités d'une arme, « (désavantage) » après celles que la maîtrise ne couvre pas, et les cinq états en mots", async () => {
  const retirer = installerDom();
  try {
    let { ecran } = await etape7(personnageEssai());
    // Maîtrise de l'agile [1] : la Spatule souple, partielle.
    const spatule = arme(ecran, "Spatule souple");
    assert.equal(capacites(spatule), "Frappe · Moulinet farineux (désavantage)");
    assert.equal(mention(spatule), "Maîtrise partielle : 1 capacité sur 2");
    assert.ok(!classes(spatule).includes("non-maitrise"), "partielle : sans hachure");
    // Le Couteau d'office et le Rouleau de fonte : non maîtrisés, désavantage partout.
    for (const nom of ["Couteau d'office", "Rouleau de fonte"]) {
      const v = arme(ecran, nom);
      assert.equal(v.querySelectorAll(".desavantage").length, 2, nom);
      assert.equal(mention(v), "⚠ Non maîtrisé", nom);
      assert.ok(classes(v).includes("non-maitrise"), nom);
      assert.equal(v.querySelector(".mention-maitrise span").getAttribute("aria-hidden"), "true", "⚠ caché aux lecteurs d'écran");
    }
    // Sans poids : aucune maîtrise requise, aucun désavantage.
    const louche = arme(ecran, "Louche d'acier");
    assert.equal(mention(louche), "Sans maîtrise requise");
    assert.equal(louche.querySelectorAll(".desavantage").length, 0);
    // Les mains nues : toujours permises ; l'attaque que la fiche calcule sans arme.
    const mains = arme(ecran, "Mains nues");
    assert.equal(mention(mains), "Toujours permis");
    const sansArme = calculerFiche(BANQUE, personnageEssai((p) => p.equipement.splice(0, 1)));
    assert.equal(sansArme.attaque.mainsNues, true);
    assert.deepEqual(parametres(mains), [["Dégâts", sansArme.attaque.degats.join("/")]]);
    assert.equal(capacites(mains), `${sansArme.attaque.nom} (bloc de base)`);

    // Maîtrise de l'agile [2] : maîtrisé.
    ({ ecran } = await etape7(personnageEssai((p) => p.niveaux.push({ capacite: "Maîtrise de l'agile", niveau: 2 }))));
    assert.equal(mention(arme(ecran, "Spatule souple")), "Maîtrisé");
    assert.equal(capacites(arme(ecran, "Spatule souple")), "Frappe · Moulinet farineux");
    // Trois capacités, deux couvertes : le nombre s'accorde.
    const banque = banqueAvec("Spatule souple", (b) => b.capacites.push({ forme: "simple", nom: "Goûter" }));
    ({ ecran } = await etape7(personnageEssai((p) => p.niveaux.push({ capacite: "Maîtrise de l'agile", niveau: 2 })), banque));
    assert.equal(mention(arme(ecran, "Spatule souple")), "Maîtrise partielle : 2 capacités sur 3");
    assert.match(capacites(arme(ecran, "Spatule souple")), /Goûter \(désavantage\)$/);
  } finally {
    retirer();
  }
});

test("étape 7 — les packs en vignettes : « Aucun pack », puis un par type, ses pièces, leurs zones et leur armure à la qualité 2, la maîtrise de son poids", async () => {
  const retirer = installerDom();
  try {
    const { ecran } = await etape7(personnageEssai());
    const packs = vignettesDe(ecran, "pack");
    assert.deepEqual(packs.map(nomDe), ["Aucun pack", "Pack lourd", "Pack agile", "Pack précis"]);
    assert.deepEqual(packs.map((v) => v.querySelector("input").id), ["pack-aucun", "pack-lourde", "pack-agile", "pack-precise"]);
    const [aucun, lourd, agile, precis] = packs;
    assert.equal(aucun.querySelector(".mention-maitrise"), null);
    assert.deepEqual([...agile.querySelectorAll(".pieces-pack li")].map(texteDe), ["Maniques bras gauche 15, bras droit 15", "Tablier de cuir torse 30", "Toque renforcée tête 5"]);
    assert.deepEqual([...lourd.querySelectorAll(".pieces-pack li")].map(texteDe), ["Plastron de fonte torse 40"]);
    assert.deepEqual([...precis.querySelectorAll(".pieces-pack li")].map(texteDe), ["Guêtres de toile jambe gauche 10, jambe droite 10"]);
    // Maîtrise de l'agile [1] : le pack agile maîtrisé, les autres non.
    assert.equal(mention(agile), "Maîtrisé");
    assert.ok(!classes(agile).includes("non-maitrise"));
    for (const v of [lourd, precis]) {
      assert.equal(mention(v), "⚠ Non maîtrisé");
      assert.ok(classes(v).includes("non-maitrise"));
    }
    // Une pièce sans autre anomalie qu'une information (I3, bloc sans capacité) n'a pas de lien.
    assert.equal(agile.querySelector(".vignette-anomalie"), null);
  } finally {
    retirer();
  }
});

test("étape 7 — un pack que la banque ne propose pas (A10) : une vignette inactive, avec sa raison, sans état", async () => {
  const retirer = installerDom();
  try {
    const banque = structuredClone(BANQUE);
    const tablier = banque.blocs.find((b) => b.nom === "Tablier de cuir");
    banque.blocs.push({ ...structuredClone(tablier), nom: "Brassière de cuir", parametres: tablier.parametres.map((p) => (p.nom === "armure" ? { ...p, valeur: "10/0/0/15/0/0" } : p)) });
    const { ecran } = await etape7(personnageEssai(), banque);
    const agile = ecran.querySelector("#pack-agile").parentNode;
    assert.equal(ecran.querySelector("#pack-agile").disabled, true);
    assert.ok(classes(agile).includes("inactive"));
    assert.match(texteDe(agile.querySelector(".raison-inactive")), /^non proposé : torse couvert par Brassière de cuir et Tablier de cuir ; bras gauche couvert par Brassière de cuir et Maniques$/);
    assert.equal(agile.querySelector(".mention-maitrise"), null);
    assert.equal(ecran.querySelector("#pack-lourde").disabled, false);
  } finally {
    retirer();
  }
});

test("étape 7 — la vignette choisie : « ✓ tenue », « ✓ porté » ; le choix reste permis, maîtrisé ou non", async () => {
  const retirer = installerDom();
  try {
    const { ecran, relire } = await etape7(nouveauPersonnage("demo"));
    // Au départ : les mains nues et aucun pack, ✓ seul.
    assert.equal(coche(arme(ecran, "Mains nues")), "✓");
    assert.equal(coche(ecran.querySelector("#pack-aucun").parentNode), "✓");
    // Sans maîtrise : tout est permis, hors le pack que la banque ne propose pas.
    assert.ok(vignettesDe(ecran, "arme").every((v) => !v.querySelector("input").disabled));
    assert.ok(vignettesDe(ecran, "pack").every((v) => !v.querySelector("input").disabled));
    // Une arme non maîtrisée se prend ; sa vignette porte « ✓ tenue », et garde son état.
    assert.equal(mention(arme(ecran, "Rouleau de fonte")), "⚠ Non maîtrisé");
    cocher(arme(ecran, "Rouleau de fonte").querySelector("input"));
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement, [{ nom: "Rouleau de fonte", choix: [], qualite: "2", place: "arme" }]);
    const rouleau = arme(ecran, "Rouleau de fonte");
    assert.ok(classes(rouleau).includes("choisie") && classes(rouleau).includes("non-maitrise"));
    assert.equal(coche(rouleau), "✓ tenue");
    assert.equal(rouleau.querySelector(".vignette-coche").getAttribute("aria-hidden"), "true");
    assert.ok(document.activeElement === rouleau.querySelector("input"), "le focus reste sur la vignette");
    assert.equal(coche(arme(ecran, "Mains nues")), "");
    // Sous les vignettes, l'arme tenue décrite.
    assert.equal(texteDe(ecran.querySelector(".bloc-choisi h4")), "Rouleau de fonte");
    // Un pack non maîtrisé se porte ; sa vignette porte « ✓ porté ».
    cocher(ecran.querySelector("#pack-lourde"));
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement.filter((o) => o.place === "pack").map((o) => o.nom), ["Plastron de fonte"]);
    assert.equal(coche(ecran.querySelector("#pack-lourde").parentNode), "✓ porté");
    assert.equal(coche(ecran.querySelector("#pack-aucun").parentNode), "");
    // Revenir aux mains nues pose l'arme.
    cocher(arme(ecran, "Mains nues").querySelector("input"));
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement.map((o) => o.place), ["pack"]);
  } finally {
    retirer();
  }
});

test("étape 7 — un objet que la banque signale d'une anomalie garde sa vignette, avec le lien vers elle", async () => {
  const retirer = installerDom();
  try {
    const { ecran } = await etape7(personnageEssai());
    const poele = arme(ecran, "Poêle en fonte");
    assert.ok(poele, "la vignette reste");
    const ligne = BANQUE.blocs.find((b) => b.nom === "Poêle en fonte").brut.ligne;
    const nombre = BANQUE.anomalies.filter((a) => a.feuille === "Blocs" && a.ligne === ligne && a.gravite !== "information").length;
    assert.ok(nombre > 0, "le classeur d'essai signale la poêle");
    const lien = poele.querySelector(".vignette-anomalie a");
    assert.equal(lien.getAttribute("href"), `#/anomalies/Blocs/${ligne}`);
    assert.equal(texteDe(lien), `Poêle en fonte : ${nombre} anomalie${nombre > 1 ? "s" : ""} sur sa ligne (Blocs, ligne ${ligne})`);
    assert.ok(poele.querySelector(".mention-maitrise"), "et ce qu'on en sait");
  } finally {
    retirer();
  }
});

test("étape 7 — des identifiants uniques ; chaque label, chaque aria-describedby désigne un élément de la page", async () => {
  const retirer = installerDom();
  try {
    for (const personnage of [nouveauPersonnage("demo"), personnageEssai()]) {
      const { ecran } = await etape7(personnage);
      const ids = [...ecran.querySelectorAll("[id]")].map((e) => e.id);
      assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
      for (const label of ecran.querySelectorAll("label")) assert.ok(ids.includes(label.getAttribute("for")), texteDe(label));
      for (const e of ecran.querySelectorAll("[aria-describedby]")) assert.ok(ids.includes(e.getAttribute("aria-describedby")), e.id);
    }
  } finally {
    retirer();
  }
});

test("étape 7 — la feuille : « Non maîtrisé » en tirets et hachures, la plaque, les couleurs des états, quatre colonnes à partir de 56rem", () => {
  const css = readFileSync(new URL("css/personnage.css", RACINE), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\r\n/g, "\n");
  const corps = (selecteur) => {
    const debut = css.indexOf(`\n${selecteur} {`);
    assert.notEqual(debut, -1, selecteur);
    return css.slice(debut, css.indexOf("}", debut));
  };
  const non = corps(".vignette.non-maitrise");
  assert.match(non, /border: calc\(2 \* var\(--trait\)\) dashed var\(--combat-alerte\);/);
  assert.ok(non.includes("background: repeating-linear-gradient(135deg, var(--hachure-alerte) 0 var(--hachure-large), var(--fond-2) 0 calc(2 * var(--hachure-large)));"));
  assert.match(corps(".vignette.non-maitrise .vignette-nom,\n.vignette.non-maitrise .mention-maitrise,\n.vignette.non-maitrise .desavantage"), /background: var\(--fond-2\);/);
  assert.match(corps(".vignette.non-maitrise .vignette-nom"), /color: var\(--texte-2\);/);
  assert.match(corps(".maitrise-maitrise,\n.maitrise-permis"), /color: var\(--combat-reussite\);/);
  assert.match(corps(".maitrise-partielle,\n.maitrise-non"), /color: var\(--combat-alerte\);/);
  const media = css.slice(css.lastIndexOf("\n@media (min-width: 56rem) {"));
  assert.match(media, /\.creation \.vignettes\.vignettes-equipement \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
});
