// Les contrôles du créateur au lot 4.3 (mission, § 8) : (a) les paramètres
// d'une vignette de l'étape 7 en rangées souples, un wbr après chaque « / » ;
// (b) les objets sans désavantage d'abord, aux mêmes identifiants, et le
// focus qui revient à la même vignette ; (c) les capacités du seul
// primordial au niveau 0 : la ligne de l'étape 6, la vignette offerte de
// l'étape 8, son acquisition et son retour au niveau 0, ses contrastes ; un
// personnage au format 2 ouvert pour être modifié passe au format 3, un
// personnage neuf y naît.
//
// Le document simulé de tests/outils/dom_simule.js, sur la banque du
// classeur d'essai, fictif ; les cas qu'il n'a pas se fabriquent dans une
// copie, en mémoire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES } from "../js/apparence/themes.js";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche, indexerCreation } from "../js/personnage/calcul.js";
import { FORMAT, nouveauPersonnage } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", RACINE)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T10:00:00+02:00" };
const INDEX = indexerCreation(BANQUE);
const LIGNE_ETAPE_6 = "Les capacités du primordial partent au niveau 0 : le personnage ne les possède pas encore. Il les acquiert à l'étape 8, pour 1 point au niveau 1.";

const creation = await import("../js/ecrans/creation.js");
const personnages = await import("../js/ecrans/personnages.js");

function contexteDe(banque = BANQUE) {
  const navigations = [];
  return {
    etat: { mode: "demo", banque, etagere: creerEtagere(magasinPersonnagesMemoire(), "demo"), chargement: { enveloppe: { empreinte: "0123456789abcdef" } } },
    naviguer: (adresse) => navigations.push(adresse),
    afficher() {},
    navigations,
  };
}

// Une étape d'un personnage déjà gardé dans l'étagère du contexte.
async function etape(contexte, id, n) {
  const ecran = creation.afficher(contexte, { ecran: "creation", id, etape: n });
  document.body.replaceChildren(ecran);
  await laisserFiler(10);
  return ecran;
}

async function ouvrir(personnage, n, banque = BANQUE) {
  const contexte = contexteDe(banque);
  await contexte.etat.etagere.garder(personnage);
  const ecran = await etape(contexte, personnage.id, n);
  return { contexte, ecran, relire: () => contexte.etat.etagere.lire(personnage.id) };
}

// Sous une souris, sur un téléphone, ou rien (un grand écran tactile).
async function avec(matchMedia, faire, options = {}) {
  const retirer = installerDom(options);
  const avant = globalThis.matchMedia;
  globalThis.matchMedia = matchMedia;
  try {
    await faire();
  } finally {
    globalThis.matchMedia = avant;
    retirer();
  }
}
const TELEPHONE = (requete) => ({ matches: requete.includes("max-width") });

const cocher = (entree) => {
  entree.checked = true;
  entree.declencher("change");
};
const classes = (noeud) => noeud.className.split(" ");

// ─── (a) Les paramètres en rangées souples ──────────────────────────────────

const vignetteDArme = (ecran, nom) => [...ecran.querySelectorAll("input[name=arme]")].map((entree) => entree.parentNode).find((v) => texteDe(v.querySelector("label")) === nom || texteDe(v.querySelector("label")).startsWith(`${nom} `)) ?? null;
// Une valeur, morceau par morceau : le texte tel quel, un wbr en « ‸ ».
const morceauxDe = (dd) => dd.childNodes.map((n) => (n.tagName === "WBR" ? "‸" : n.textContent)).join("");

test("étape 7 (a) — chaque paire de paramètres dans un div.parametre (dl > div > dt + dd), un wbr après chaque « / » de la valeur", async () => {
  await avec(undefined, async () => {
    const { ecran } = await ouvrir(personnageEssai(), 7);
    const listes = [...ecran.querySelectorAll("dl")];
    assert.ok(listes.length > 5, "une liste par vignette d'arme");
    for (const dl of listes) {
      assert.ok(classes(dl).includes("vignette-parametres"));
      assert.ok(dl.children.length > 0);
      for (const paire of dl.children) {
        assert.deepEqual([paire.tagName, paire.className, paire.children.map((e) => e.tagName)], ["DIV", "parametre", ["DT", "DD"]]);
      }
    }
    const spatule = vignetteDArme(ecran, "Spatule souple");
    const valeurs = [...spatule.querySelectorAll(".parametre dd")];
    // « 5/10/15 » : un wbr après chaque barre, aucun ailleurs ; le texte ne change pas.
    assert.deepEqual(valeurs.map(morceauxDe), ["5/‸10/‸15", "0", "2"]);
    assert.deepEqual(valeurs.map(texteDe), ["5/10/15", "0", "2"]);
    assert.equal(spatule.querySelectorAll("wbr").length, 2);
    // Les mains nues aussi ; la valeur à barres d'un paramètre hors RANGS (§ 9.2), jointe par « / ».
    const mains = vignetteDArme(ecran, "Mains nues");
    assert.match(morceauxDe(mains.querySelector(".parametre dd")), /^\d+\/‸\d+\/‸\d+$/);
    const louche = vignetteDArme(ecran, "Louche d'acier");
    const brulant = [...louche.querySelectorAll(".parametre")].find((p) => texteDe(p.querySelector("dt")) === "Brûlant");
    assert.equal(morceauxDe(brulant.querySelector("dd")), "5/‸10/‸15");
  });
});

test("étape 7 (a) — la feuille : la liste n'est plus une grille ; chaque paire, une rangée souple ; le nom se coupe comme la vignette, la valeur après une barre seulement", () => {
  const css = lire("css/personnage.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\r\n/g, "\n");
  const corps = (selecteur) => {
    const debut = css.indexOf(`\n${selecteur} {`);
    assert.notEqual(debut, -1, selecteur);
    return css.slice(debut, css.indexOf("}", debut));
  };
  const liste = corps(".vignette-parametres");
  assert.doesNotMatch(liste, /display: grid|grid-template-columns/);
  for (const declaration of ["display: flex;", "flex-wrap: wrap;", "column-gap: var(--espace-2);"]) assert.ok(corps(".vignette-parametres .parametre").includes(declaration), declaration);
  for (const declaration of ["flex: 1 1 auto;", "min-width: 0;"]) assert.ok(corps(".vignette-parametres dt").includes(declaration), declaration);
  assert.doesNotMatch(corps(".vignette-parametres dt"), /overflow-wrap/, "le nom garde la coupe de la vignette");
  const valeur = corps(".vignette-parametres dd");
  for (const declaration of ["flex: 0 1 auto;", "margin-left: auto;", "max-width: 100%;", "text-align: end;", "overflow-wrap: break-word;"]) assert.ok(valeur.includes(declaration), declaration);
  // La vignette coupe partout (ecran.css) : le nom en hérite.
  assert.match(lire("css/ecran.css").replace(/\r\n/g, "\n"), /\n\.vignette \{[^}]*overflow-wrap: anywhere;/);
});

// ─── (b) Les objets sans désavantage d'abord ────────────────────────────────

const ARMES = INDEX.blocsDeType("arme").map((b) => b.nom);
const idDArme = (nom) => `arme-${ARMES.indexOf(nom)}`;
const entreesDArme = (ecran) => [...ecran.querySelectorAll("input[name=arme]")];

test("étape 7 (b) — une arme non maîtrisée qui précède une arme maîtrisée dans la banque vient après elle, aux mêmes identifiants", async () => {
  await avec(undefined, async () => {
    // Le couteau (précis, non maîtrisé) précède la spatule (agile) dans la banque.
    assert.ok(ARMES.indexOf("Couteau d'office") < ARMES.indexOf("Spatule souple"));
    const maitre = personnageEssai((p) => p.niveaux.push({ capacite: "Maîtrise de l'agile", niveau: 2 }));
    const { ecran } = await ouvrir(maitre, 7);
    const ids = entreesDArme(ecran).map((e) => e.id);
    assert.equal(texteDe(vignetteDArme(ecran, "Spatule souple").querySelector(".mention-maitrise")), "Maîtrisé");
    assert.ok(ids.indexOf(idDArme("Spatule souple")) < ids.indexOf(idDArme("Couteau d'office")), ids.join(" "));
    // Chaque vignette garde l'identifiant de son indice dans la banque.
    for (const entree of entreesDArme(ecran).slice(1)) assert.equal(entree.id, idDArme(texteDe(entree.parentNode.querySelector("label")).replace(/ (lourde|agile|précise)$/, "")));
    assert.equal(ids[0], "arme-aucune", "les mains nues d'abord");
    // Sans poids (« Sans maîtrise requise ») et maîtrisée : un même rang, dans l'ordre de la banque.
    assert.deepEqual(ids, ["arme-aucune", ...["Hachoir", "Louche d'acier", "Poêle en fonte", "Rouleau à pâtisserie", "Spatule souple", "Couteau d'office", "Rouleau de fonte"].map(idDArme)]);
    assert.equal(texteDe(vignetteDArme(ecran, "Hachoir").querySelector(".mention-maitrise")), "Sans maîtrise requise");
    // Maîtrise de l'agile [1] : la spatule, partielle, passe après les armes sans désavantage.
    const { ecran: partielle } = await ouvrir(personnageEssai(), 7);
    const ordre = entreesDArme(partielle).map((e) => e.id);
    assert.ok(ordre.indexOf(idDArme("Hachoir")) < ordre.indexOf(idDArme("Spatule souple")));
    assert.ok(ordre.indexOf(idDArme("Spatule souple")) < ordre.indexOf(idDArme("Couteau d'office")));
  });
});

test("étape 7 (b) — l'ordre suit l'état à chaque rendu ; le focus revient à la même vignette, qui garde son identifiant", async () => {
  await avec(
    undefined,
    async () => {
      const { ecran, relire } = await ouvrir(nouveauPersonnage("demo"), 7);
      cocher(ecran.querySelector(`#${idDArme("Rouleau de fonte")}`));
      await laisserFiler(10);
      assert.equal((await relire()).equipement[0].nom, "Rouleau de fonte");
      const focalisee = document.activeElement;
      assert.equal(focalisee.id, idDArme("Rouleau de fonte"));
      assert.ok(focalisee === ecran.querySelector(`#${idDArme("Rouleau de fonte")}`), "l'entrée de la vignette refaite");
      assert.ok(classes(focalisee.parentNode).includes("choisie"));
    },
    { focusFidele: true },
  );
});

test("étape 7 (b) — les packs : « Aucun pack », les maîtrisés, les autres, puis ceux que la banque ne propose pas ; chacun sous l'identifiant de son type", async () => {
  await avec(undefined, async () => {
    const ids = (ecran) => [...ecran.querySelectorAll("input[name=pack]")].map((e) => e.id);
    let { ecran } = await ouvrir(personnageEssai(), 7);
    assert.deepEqual(ids(ecran), ["pack-aucun", "pack-agile", "pack-lourde", "pack-precise"]);
    // Le pack agile, maîtrisé mais non proposé (deux pièces sur le torse) : en dernier, inactif.
    const banque = structuredClone(BANQUE);
    const tablier = banque.blocs.find((b) => b.nom === "Tablier de cuir");
    banque.blocs.push({ ...structuredClone(tablier), nom: "Brassière de cuir" });
    ({ ecran } = await ouvrir(personnageEssai(), 7, banque));
    assert.deepEqual(ids(ecran), ["pack-aucun", "pack-lourde", "pack-precise", "pack-agile"]);
    assert.equal(ecran.querySelector("#pack-agile").disabled, true);
  });
});

test("étape 7 (b) — « Tous les objets » : les armes dans l'ordre de leurs vignettes, les pièces maîtrisées d'abord, les autres objets dans l'ordre de la banque", async () => {
  await avec(undefined, async () => {
    const { ecran } = await ouvrir(personnageEssai(), 7);
    const rubriques = Object.fromEntries([...ecran.querySelectorAll("optgroup")].map((g) => [g.getAttribute("label"), [...g.querySelectorAll("option")].map((o) => o.getAttribute("value"))]));
    const vignettes = entreesDArme(ecran).slice(1).map((e) => ARMES[Number(e.id.slice("arme-".length))]);
    assert.deepEqual(rubriques.Armes, vignettes);
    assert.deepEqual(rubriques.Armes.slice(-2), ["Couteau d'office", "Rouleau de fonte"], "les non maîtrisées en dernier");
    // Maîtrise de l'agile [1] : les pièces agiles, puis la précise et la lourde.
    assert.deepEqual(rubriques["Pièces d'armure"], ["Maniques", "Tablier de cuir", "Toque renforcée", "Guêtres de toile", "Plastron de fonte"]);
    assert.deepEqual(rubriques["Équipement"], INDEX.blocsDeType("equipement").map((b) => b.nom));
    assert.deepEqual(rubriques.Consommables, INDEX.blocsDeType("consommable").map((b) => b.nom));
    // Une pièce sans poids va avec les maîtrisées.
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Guêtres de toile").elements = banque.blocs.find((b) => b.nom === "Guêtres de toile").elements.filter((e) => !/^pr[ée]cise$/i.test(e.nom ?? ""));
    const { ecran: sansPoids } = await ouvrir(personnageEssai(), 7, banque);
    const pieces = [...[...sansPoids.querySelectorAll("optgroup")].find((g) => g.getAttribute("label") === "Pièces d'armure").querySelectorAll("option")].map((o) => o.getAttribute("value"));
    assert.deepEqual(pieces, ["Guêtres de toile", "Maniques", "Tablier de cuir", "Toque renforcée", "Plastron de fonte"]);
  });
});

// ─── (c) Les capacités du primordial au niveau 0 ────────────────────────────

test("étape 6 (c) — sous les vignettes, la ligne du niveau 0, mot pour mot ; à l'étape 6 seulement", async () => {
  await avec(undefined, async () => {
    const contexte = contexteDe();
    const personnage = personnageEssai();
    await contexte.etat.etagere.garder(personnage);
    let ecran = await etape(contexte, personnage.id, 6);
    const lignes = [...ecran.querySelectorAll("p")].filter((p) => texteDe(p) === LIGNE_ETAPE_6);
    assert.equal(lignes.length, 1);
    // Après le fieldset des vignettes, avant le bloc choisi.
    const parties = ecran.querySelector(".etape").children;
    const rang = (noeud) => parties.indexOf(noeud);
    assert.equal(rang(lignes[0]), rang(ecran.querySelector("fieldset.groupe-vignettes")) + 1);
    assert.equal(rang(ecran.querySelector(".bloc-choisi")), rang(lignes[0]) + 1);
    for (const n of [3, 4, 5]) {
      ecran = await etape(contexte, personnage.id, n);
      assert.doesNotMatch(texteDe(ecran), /partent au niveau 0/, `étape ${n}`);
    }
  });
});

const vignetteDe = (ecran, nom) => [...ecran.querySelectorAll(".vignette-capacite")].find((v) => texteDe(v.querySelector(".capacite-nom")) === nom) ?? null;
const boutonDe = (vignette, fin) => [...vignette.querySelectorAll("button")].find((b) => b.id.endsWith(fin)) ?? null;
const raisonDe = (vignette) => texteDe(vignette.querySelector(".vignette-capacite-pied p"));
const compteur = (ecran) => texteDe(ecran.querySelector(".compteur-points"));
const suivantDe = (vignette) => [...vignette.querySelectorAll("button")].find((b) => texteDe(b).startsWith("Niveau suivant")) ?? null;
const sansMontee = (p) => (p.niveaux = []);

test("étape 8 (c) — Fournaise offerte : au niveau 0, non acquise, après les capacités du primordial, avec « + », la raison mot pour mot, ni coût, ni effet, ni « amélioré »", async () => {
  await avec(undefined, async () => {
    const { ecran } = await ouvrir(personnageEssai(sansMontee), 8);
    assert.equal(compteur(ecran), "Points dépensés : 7 / 10 reliquat : 3");
    const noms = [...ecran.querySelectorAll(".vignette-capacite .capacite-nom")].map(texteDe);
    // Après Cendre, reçue du même primordial ; avant le bloc de base (Pas chassé).
    assert.equal(noms.indexOf("Fournaise"), noms.indexOf("Cendre") + 1);
    assert.equal(noms.indexOf("Pas chassé"), noms.indexOf("Fournaise") + 1);
    const fournaise = vignetteDe(ecran, "Fournaise");
    assert.ok(classes(fournaise).includes("non-acquise"));
    assert.ok(!classes(fournaise).includes("amelioree"));
    assert.equal(fournaise.querySelector(".mention-amelioree"), null);
    assert.equal(texteDe(fournaise.querySelector(".vignette-capacite-tete .detail")), "Grand Four · primordial");
    assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 0");
    assert.equal(fournaise.querySelector(".cout-capacite"), null, "aucun coût au niveau 0");
    assert.equal(fournaise.querySelector(".vignette-capacite-effet"), null, "aucun effet au niveau 0");
    assert.equal(raisonDe(fournaise), "Niveau 0 : pas encore acquise. Niveau 1 : 1 point.");
    assert.deepEqual([boutonDe(fournaise, "-moins").disabled, boutonDe(fournaise, "-plus").disabled], [true, false]);
    assert.equal(boutonDe(fournaise, "-plus").getAttribute("aria-describedby"), fournaise.querySelector(".vignette-capacite-pied p").id);
    // L'identifiant : l'indice de Fournaise dans la feuille Capacites.
    assert.equal(boutonDe(fournaise, "-plus").id, `niveau-${BANQUE.capacites.findIndex((c) => c.nom === "Fournaise")}-plus`);
    // Cendre (puissance 0) : reçue au niveau 0, comme avant.
    const cendre = vignetteDe(ecran, "Cendre");
    assert.ok(!classes(cendre).includes("non-acquise"));
    assert.equal(raisonDe(cendre), "Niveau 0 : cette capacité n'évolue pas.");
    // La fiche ne la tient pas : ni dans capacites, ni sur la vue lecture de l'étape 9.
    const fiche = calculerFiche(BANQUE, personnageEssai(sansMontee));
    assert.deepEqual([fiche.capacites.some((c) => c.nom === "Fournaise"), fiche.offertes.map((o) => o.nom)], [false, ["Fournaise"]]);
    const { ecran: recapitulatif } = await ouvrir(personnageEssai(sansMontee), 9);
    assert.doesNotMatch(texteDe(recapitulatif.querySelector(".lecture")), /Fournaise/);
  });
});

test("étape 8 (c) — un primordial dont aucune capacité n'est acquise : l'offerte à la place du primordial, après l'espèce, l'archétype et la constellation, avant le bloc de base", async () => {
  await avec(undefined, async () => {
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Grand Four").capacites = [{ forme: "simple", nom: "Fournaise" }];
    const personnage = personnageEssai((p) => {
      p.niveaux = [];
      p.primordial = { nom: "Grand Four", choix: [] };
    });
    const fiche = calculerFiche(banque, personnage);
    assert.equal(fiche.capacites.filter((c) => c.groupe === "primordial").length, 0, "aucune capacité du primordial dans la fiche");
    const { ecran } = await ouvrir(personnage, 8, banque);
    const noms = [...ecran.querySelectorAll(".vignette-capacite .capacite-nom")].map(texteDe);
    const avant = fiche.capacites.filter((c) => ["espece", "archetype", "constellation"].includes(c.role)).at(-1).nom;
    assert.deepEqual(noms.slice(noms.indexOf(avant), noms.indexOf(avant) + 3), [avant, "Fournaise", "Pas chassé"]);
  });
});

test("étape 8 (c) — une offerte qui est un style de combat : après les capacités du groupe « style », non après celles du primordial", async () => {
  await avec(undefined, async () => {
    const banque = structuredClone(BANQUE);
    for (const variante of banque.capacites.find((c) => c.nom === "Fournaise").variantes) variante.notes = "Style de combat";
    const fiche = calculerFiche(banque, personnageEssai(sansMontee));
    assert.deepEqual(fiche.offertes.map((o) => [o.nom, o.groupe]), [["Fournaise", "style"]]);
    const { ecran } = await ouvrir(personnageEssai(sansMontee), 8, banque);
    const noms = [...ecran.querySelectorAll(".vignette-capacite .capacite-nom")].map(texteDe);
    assert.equal(noms.indexOf("Fournaise"), noms.indexOf("Solo du chef") + 1);
  });
});

test("étape 8 (c) — « il manque N point(s) », accordé, quand le reliquat ne suffit pas", async () => {
  await avec(undefined, async () => {
    for (const [ajouts, attendu] of [
      [["Costaud"], "Niveau 0 : pas encore acquise. Niveau 1 : il manque 1 point."],
      [["Costaud", "Glaçage"], "Niveau 0 : pas encore acquise. Niveau 1 : il manque 2 points."],
    ]) {
      const banque = structuredClone(BANQUE);
      banque.blocs.find((b) => b.nom === "Saucier").capacites.push(...ajouts.map((nom) => ({ forme: "simple", nom })));
      const { ecran } = await ouvrir(personnageEssai((p) => (p.niveaux = [{ capacite: "Flambage", niveau: 2 }])), 8, banque);
      const fournaise = vignetteDe(ecran, "Fournaise");
      assert.equal(raisonDe(fournaise), attendu);
      assert.equal(boutonDe(fournaise, "-plus").disabled, true);
    }
  });
});

test("étape 8 (c) — « Niveau suivant ▸ » d'une offerte : « Acquérir au niveau 1 », le coût et la description du niveau 1, rien en rouge ni rien de barré", async () => {
  await avec(undefined, async () => {
    const { ecran } = await ouvrir(personnageEssai(sansMontee), 8);
    const fournaise = vignetteDe(ecran, "Fournaise");
    const bulle = fournaise.querySelector(".infobulle-niveau");
    assert.deepEqual([...bulle.children].map(texteDe), ["Acquérir au niveau 1", "après progression · 1 point de plus (reliquat 3 → 2)", "Coût : 1 souffle · 1 lien", "Réchauffe la case."]);
    assert.equal(bulle.querySelectorAll(".difference").length, 0);
    assert.equal(bulle.querySelectorAll("s").length, 0);
    assert.equal(bulle.querySelector(".comparaison-legende"), null);
    suivantDe(fournaise).click();
    assert.equal(bulle.hidden, false);
  });
  await avec(
    TELEPHONE,
    async () => {
      const { ecran, relire } = await ouvrir(personnageEssai(sansMontee), 8);
      suivantDe(vignetteDe(ecran, "Fournaise")).click();
      const volet = ecran.querySelector(".volet-niveau");
      assert.equal(texteDe(volet.querySelector(".volet-niveau-titre")), "Acquérir au niveau 1");
      const passer = [...volet.querySelectorAll("button")][1];
      assert.deepEqual([texteDe(passer), passer.disabled], ["Passer au niveau 1", false]);
      passer.click();
      await laisserFiler(10);
      assert.deepEqual((await relire()).niveaux, [{ capacite: "Fournaise", niveau: 1 }]);
    },
    { focusFidele: true },
  );
});

test("étape 8 (c) — « + » acquiert Fournaise au niveau 1 (1 point), puis au niveau 2 (3 points) ; « − » la rend au niveau 0, et sa montée disparaît ; le focus la suit", async () => {
  await avec(
    undefined,
    async () => {
      const { ecran, relire } = await ouvrir(personnageEssai(sansMontee), 8);
      const id = `niveau-${BANQUE.capacites.findIndex((c) => c.nom === "Fournaise")}`;
      boutonDe(vignetteDe(ecran, "Fournaise"), "-plus").click();
      await laisserFiler(10);
      assert.deepEqual((await relire()).niveaux, [{ capacite: "Fournaise", niveau: 1 }]);
      assert.equal(compteur(ecran), "Points dépensés : 8 / 10 reliquat : 2");
      let fournaise = vignetteDe(ecran, "Fournaise");
      assert.ok(!classes(fournaise).includes("non-acquise"));
      assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 1");
      assert.equal(texteDe(fournaise.querySelector(".cout-capacite")), "coût : 1 souffle · 1 lien");
      assert.equal(texteDe(fournaise.querySelector(".vignette-capacite-effet")), "Réchauffe la case.");
      assert.equal(raisonDe(fournaise), "Niveau 2 : 2 points de plus.");
      assert.equal(boutonDe(fournaise, "-moins").disabled, false, "elle peut revenir au niveau 0");
      // Acquise, elle a quitté la fin du groupe : à sa place, avant Cendre ; le focus l'y a suivie.
      const noms = [...ecran.querySelectorAll(".vignette-capacite .capacite-nom")].map(texteDe);
      assert.ok(noms.indexOf("Fournaise") < noms.indexOf("Cendre"));
      assert.ok(document.activeElement === boutonDe(fournaise, "-plus"));
      assert.equal(document.activeElement.id, `${id}-plus`);

      boutonDe(fournaise, "-plus").click();
      await laisserFiler(10);
      assert.deepEqual((await relire()).niveaux, [{ capacite: "Fournaise", niveau: 2 }]);
      assert.equal(compteur(ecran), "Points dépensés : 10 / 10 reliquat : 0");
      fournaise = vignetteDe(ecran, "Fournaise");
      assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 2");

      boutonDe(fournaise, "-moins").click();
      await laisserFiler(10);
      boutonDe(vignetteDe(ecran, "Fournaise"), "-moins").click();
      await laisserFiler(10);
      assert.deepEqual((await relire()).niveaux, [], "revenue au niveau 0, sa montée disparaît");
      fournaise = vignetteDe(ecran, "Fournaise");
      assert.ok(classes(fournaise).includes("non-acquise"));
      assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 0");
      assert.equal(compteur(ecran), "Points dépensés : 7 / 10 reliquat : 3");
      // « − » est inactif au niveau 0 : le focus va au « + » de la même vignette.
      assert.ok(document.activeElement === boutonDe(fournaise, "-plus"));
    },
    { focusFidele: true },
  );
});

test("étape 8 (c) — une capacité à seule variante 1 : offerte, « + » jusqu'au niveau 1, puis « Niveau maximal atteint. », et « − » la rend au niveau 0", async () => {
  await avec(undefined, async () => {
    const banque = structuredClone(BANQUE);
    const capacite = banque.capacites.find((c) => c.nom === "Fournaise");
    capacite.variantes = [{ ...capacite.variantes.find((v) => v.puissance.trim() === "1"), puissance: "1" }];
    const { ecran, relire } = await ouvrir(personnageEssai(sansMontee), 8, banque);
    let fournaise = vignetteDe(ecran, "Fournaise");
    assert.ok(classes(fournaise).includes("non-acquise"));
    assert.equal(raisonDe(fournaise), "Niveau 0 : pas encore acquise. Niveau 1 : 1 point.");
    assert.ok(suivantDe(fournaise), "le niveau 1 se lit");
    boutonDe(fournaise, "-plus").click();
    await laisserFiler(10);
    assert.deepEqual((await relire()).niveaux, [{ capacite: "Fournaise", niveau: 1 }]);
    fournaise = vignetteDe(ecran, "Fournaise");
    assert.equal(raisonDe(fournaise), "Niveau maximal atteint.");
    assert.deepEqual([boutonDe(fournaise, "-plus").disabled, boutonDe(fournaise, "-moins").disabled, suivantDe(fournaise)], [true, false, null]);
    boutonDe(fournaise, "-moins").click();
    await laisserFiler(10);
    assert.deepEqual((await relire()).niveaux, []);
    assert.ok(classes(vignetteDe(ecran, "Fournaise")).includes("non-acquise"));
  });
});

test("étape 8 (c) — une capacité que donnent l'espèce et le primordial est reçue, comme avant ; aucune offerte, aucune vignette non acquise", async () => {
  await avec(undefined, async () => {
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Marmiton").capacites.push({ forme: "simple", nom: "Fournaise" });
    const { ecran } = await ouvrir(personnageEssai(sansMontee), 8, banque);
    assert.equal(ecran.querySelectorAll(".vignette-capacite.non-acquise").length, 0);
    const fournaise = vignetteDe(ecran, "Fournaise");
    assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 1");
    assert.equal(boutonDe(fournaise, "-moins").disabled, true, "reçue au niveau 1");
    assert.equal(compteur(ecran), "Points dépensés : 8 / 10 reliquat : 2");
  });
});

test("étape 3 (c) — Fournaise acquise, puis reçue d'un archétype qui la donne aussi : sa montée au niveau 1, qui ne monte plus rien, s'efface", async () => {
  await avec(undefined, async () => {
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Pâtissier").capacites.push({ forme: "simple", nom: "Fournaise" });
    const { ecran, relire } = await ouvrir(personnageEssai(), 3, banque);
    const patissier = [...ecran.querySelectorAll("input[name=archetype]")].find((r) => texteDe(r.parentNode).startsWith("Pâtissier"));
    patissier.declencher("change");
    await laisserFiler(10);
    assert.deepEqual((await relire()).niveaux, [], "Flambage n'est plus possédée ; Fournaise est reçue au niveau 1");
    const fiche = calculerFiche(banque, await relire());
    assert.deepEqual(fiche.avertissements.filter((a) => /Fournaise/.test(a.texte)), []);
  });
});

test("étape 8 (c) — la classe non-acquise : le nom en --texte-2, sur le --fond-2 de la vignette, mesuré à 4,5:1 au moins dans les 38 thèmes", () => {
  const css = lire("css/personnage.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\r\n/g, "\n");
  const debut = css.indexOf("\n.vignette-capacite.non-acquise .capacite-nom {");
  assert.notEqual(debut, -1);
  assert.match(css.slice(debut, css.indexOf("}", debut)), /color: var\(--texte-2\);/);
  assert.match(lire("css/ecran.css").replace(/\r\n/g, "\n"), /\n\.vignette \{[^}]*background: var\(--fond-2\);/);
  // La formule de WCAG 2, celle de tests/themes_contrastes.test.js.
  const luminance = (hex) => {
    const [r, v, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * v + 0.0722 * b;
  };
  const contraste = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  assert.equal(contraste("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(THEMES.length, 38);
  const couleur = /^#[0-9a-f]{6}$/i;
  assert.ok(THEMES.every((theme) => couleur.test(theme.jetons["texte-2"] ?? "") && couleur.test(theme.jetons["fond-2"] ?? "")), "deux jetons que chaque thème donne");
  const echecs = THEMES.filter((theme) => !(contraste(theme.jetons["texte-2"], theme.jetons["fond-2"]) >= 4.5)).map((theme) => theme.code);
  assert.deepEqual(echecs, []);
});

// ─── Le format 3 ────────────────────────────────────────────────────────────

// Le personnage d'essai tel qu'un appareil le gardait au format 2 : Fournaise
// au niveau 1 sans montée (une montée allait de 2 à 3).
const auFormat2 = (modifier = null) =>
  personnageEssai((p) => {
    p.format = 2;
    p.niveaux = [{ capacite: "Flambage", niveau: 2 }];
    modifier?.(p);
  });

test("format 3 — un brouillon au format 2 ouvert dans le créateur passe au format 3 : Fournaise y garde son niveau 1 par une montée, les points ne changent pas, la date non plus", async () => {
  await avec(undefined, async () => {
    const lu = auFormat2();
    const avant = calculerFiche(BANQUE, lu);
    const { ecran, relire, contexte } = await ouvrir(lu, 8);
    const garde = await relire();
    assert.equal(garde.format, 3);
    assert.deepEqual(garde.niveaux, [{ capacite: "Flambage", niveau: 2 }, { capacite: "Fournaise", niveau: 1 }]);
    assert.equal(garde.modifie_le, lu.modifie_le);
    assert.equal(compteur(ecran), `Points dépensés : ${avant.points.depenses} / 10 reliquat : ${avant.points.reliquat}`);
    assert.equal(texteDe(vignetteDe(ecran, "Fournaise").querySelector(".valeur-pas")), "niveau 1");
    assert.equal(ecran.querySelectorAll(".vignette-capacite.non-acquise").length, 0);
    // Un changement le garde au format 3 ; l'enregistrement aussi.
    boutonDe(vignetteDe(ecran, "Flambage"), "-moins").click();
    await laisserFiler(10);
    assert.deepEqual([(await relire()).format, (await relire()).niveaux], [3, [{ capacite: "Fournaise", niveau: 1 }]]);
    const recapitulatif = await etape(contexte, lu.id, 9);
    await Promise.all(boutons(recapitulatif, "Enregistrer")[0].click());
    await laisserFiler(10);
    assert.deepEqual([(await relire()).etat, (await relire()).format], ["enregistre", 3]);
  });
});

test("format 3 — « Modifier » un personnage enregistré au format 2 : la copie de travail passe au format 3, l'original reste au format 2 jusqu'à l'enregistrement, qui le remplace au format 3", async () => {
  await avec(undefined, async () => {
    const original = auFormat2((p) => Object.assign(p, { etat: "enregistre", etape: 9, enregistre_le: "2026-09-29T20:30:00.000Z" }));
    const contexte = contexteDe();
    const etagere = contexte.etat.etagere;
    await etagere.garder(original);
    let ecran = await etape(contexte, original.id, 1);
    await Promise.all(boutons(ecran, "Modifier")[0].click());
    await laisserFiler(10);
    const idCopie = contexte.navigations.at(-1).match(/^#\/personnage\/([A-Za-z0-9_-]+)\/etape\/1$/)[1];
    ecran = await etape(contexte, idCopie, 1);
    assert.equal((await etagere.lire(idCopie)).format, 3);
    assert.equal((await etagere.lire(original.id)).format, 2, "l'original attend l'enregistrement");
    ecran = await etape(contexte, idCopie, 9);
    await Promise.all(boutons(ecran, "Enregistrer")[0].click());
    await laisserFiler(10);
    const remplace = await etagere.lire(original.id);
    assert.deepEqual([remplace.etat, remplace.format, remplace.niveaux], ["enregistre", 3, [{ capacite: "Flambage", niveau: 2 }, { capacite: "Fournaise", niveau: 1 }]]);
  });
});

test("format 3 — un personnage neuf naît au format 3 (« Créer un personnage »), et le créateur l'y garde", async () => {
  await avec(undefined, async () => {
    assert.equal(FORMAT, 3);
    const contexte = contexteDe();
    const liste = personnages.afficher(contexte);
    document.body.replaceChildren(liste);
    await laisserFiler(10);
    await Promise.all(boutons(liste, "Créer un personnage")[0].click());
    const [{ id }] = (await contexte.etat.etagere.lister()).personnages;
    const neuf = await contexte.etat.etagere.lire(id);
    assert.equal(neuf.format, 3);
    const ecran = await etape(contexte, neuf.id, 6);
    cocher(ecran.querySelector("input[name=primordial]"));
    await laisserFiler(10);
    assert.equal((await contexte.etat.etagere.lire(neuf.id)).format, 3);
  });
});
