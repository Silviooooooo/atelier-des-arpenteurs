// Contrôles des écrans des personnages, construits dans un document simulé
// (SPECIFICATION.md, § 15.3, § 15.1 et § 11, domaine Site).
//
// « Mes personnages », le parcours de création en neuf étapes et la
// réception d'un lien. La banque vient du classeur d'essai, fictif ; les
// personnages vivent dans une étagère en mémoire ; fetch est simulé.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { calculerFiche, indexerCreation } from "../js/personnage/calcul.js";
import { codeDuLien, ecrirePersonnage, nouveauPersonnage } from "../js/personnage/format.js";
import { MESSAGE_BANQUE_SANS_TYPES, manques, niveauxPermis } from "../js/personnage/parcours.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const ESSAI = readFileSync(new URL("essais/classeur_essai.xlsx", RACINE));
const { banque: IMPORTEE } = await importerFichier(ESSAI, "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T10:00:00+02:00" };
const INDEX = indexerCreation(BANQUE);
// Une banque publiée avant la colonne « Type » : ses blocs n'ont pas de type.
const SANS_TYPES = { ...BANQUE, blocs: BANQUE.blocs.map(({ type, ...bloc }) => bloc) };
const EMPREINTE = "0123456789abcdef";

const personnages = await import("../js/ecrans/personnages.js");
const creation = await import("../js/ecrans/creation.js");
const reception = await import("../js/ecrans/reception.js");

function contexteDe({ mode = "demo", banque = BANQUE, etagere = creerEtagere(magasinPersonnagesMemoire(), mode) } = {}) {
  const navigations = [];
  return {
    etat: { mode, banque, etagere, chargement: { enveloppe: { empreinte: EMPREINTE } } },
    naviguer: (adresse) => navigations.push(adresse),
    afficher() {},
    navigations,
  };
}

async function attendre(condition, message) {
  for (let i = 0; i < 200; i += 1) {
    if (await condition()) return;
    await laisserFiler(5);
  }
  assert.fail(message);
}

async function montrer(ecran) {
  document.body.replaceChildren(ecran);
  await laisserFiler(10);
  return ecran;
}

const liste = (contexte) => montrer(personnages.afficher(contexte));
const etape = (contexte, id, n) => montrer(creation.afficher(contexte, { ecran: "creation", id, etape: n }));
const saisir = (champ, valeur, type = "input") => {
  champ.value = valeur;
  champ.declencher(type);
};
const cocher = (champ, valeur = true) => {
  champ.checked = valeur;
  champ.declencher("change");
};
const carteDe = (ecran, nom) => ecran.querySelectorAll(".carte-personnage").find((carte) => texteDe(carte.querySelector("h2")) === nom);
const zoneManques = (ecran) => texteDe(ecran.querySelector(".manques"));
const optionsDe = (select) => select.querySelectorAll("option").map((o) => o.getAttribute("value"));
// Le premier message d'erreur : le document simulé ne lit pas [role=alert].
const alerte = (noeud) => noeud.querySelectorAll("[role]").find((e) => e.getAttribute("role") === "alert") ?? null;

// Un fichier choisi dans le sélecteur du navigateur.
const fichier = (texte) => ({ name: "personnage.arpenteur.json", size: Buffer.byteLength(texte), text: async () => texte });

async function garde(contexte, personnage) {
  await contexte.etat.etagere.garder(personnage);
  return personnage;
}

// ─── Mes personnages ────────────────────────────────────────────────────────

test("personnages — « Créer un personnage » garde un brouillon et mène à l'étape 1 (§ 15.3)", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const ecran = await liste(contexte);
    assert.equal(texteDe(ecran.querySelector("h1")), "Personnages");
    assert.match(texteDe(ecran), /Aucun personnage sur cet appareil/);
    await Promise.all(boutons(ecran, "Créer un personnage")[0].click());
    const { personnages: gardes } = await contexte.etat.etagere.lister();
    assert.equal(gardes.length, 1);
    assert.equal(gardes[0].etat, "brouillon");
    assert.equal(gardes[0].mode, "demo");
    assert.deepEqual(contexte.navigations, [`#/personnage/${gardes[0].id}/etape/1`]);

    // La liste montre le brouillon : son état, et de quoi le reprendre.
    const relue = await liste(contexte);
    const carte = carteDe(relue, "Sans nom");
    assert.ok(carte, "un brouillon sans nom s'appelle « Sans nom »");
    assert.match(texteDe(carte), /brouillon, étape 1 sur 9/);
    const liens = carte.querySelectorAll("a").map((a) => [texteDe(a), a.getAttribute("href")]);
    assert.deepEqual(liens, [
      ["Reprendre", `#/personnage/${gardes[0].id}/etape/1`],
      ["Aperçu", `#/personnage/${gardes[0].id}`],
    ]);
    for (const action of ["Enregistrer le fichier", "Ouvrir sur mon téléphone", "Supprimer"]) assert.equal(boutons(carte, action).length, 1, action);
  } finally {
    retirer();
  }
});

test("personnages — un personnage enregistré s'ouvre ; « Ouvrir sur mon téléphone » déplie son panneau", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai((p) => Object.assign(p, { etat: "enregistre", enregistre_le: "2026-09-29T20:30:00.000Z" })));
    const ecran = await liste(contexte);
    const carte = carteDe(ecran, "Aubépine Crèmebrûlée");
    assert.match(texteDe(carte), /enregistré le 29\/09\/2026/);
    assert.match(texteDe(carte), /Marmiton · Saucier/);
    assert.deepEqual(carte.querySelectorAll("a").map((a) => [texteDe(a), a.getAttribute("href")]), [["Ouvrir", `#/personnage/${personnage.id}`]]);
    const telephone = boutons(carte, "Ouvrir sur mon téléphone")[0];
    telephone.click();
    assert.equal(telephone.getAttribute("aria-expanded"), "true");
    assert.ok(carte.querySelector(".panneau-telephone"), "le panneau est sous la carte");
    telephone.click();
    assert.equal(carte.querySelector(".panneau-telephone"), null, "un second clic le replie");
    await laisserFiler(20);
  } finally {
    retirer();
  }
});

test("personnages — « Supprimer » ne supprime qu'après confirmation, dans la carte", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai());
    const ecran = await liste(contexte);
    const carte = carteDe(ecran, "Aubépine Crèmebrûlée");
    boutons(carte, "Supprimer")[0].click();
    assert.match(texteDe(carte), /Supprimer « Aubépine Crèmebrûlée » de cet appareil \? C'est définitif\./);
    assert.ok(await contexte.etat.etagere.lire(personnage.id), "rien n'est supprimé au premier clic");

    boutons(carte, "Annuler")[0].click();
    assert.doesNotMatch(texteDe(carte), /C'est définitif/);
    assert.ok(await contexte.etat.etagere.lire(personnage.id), "Annuler ne supprime rien");

    boutons(carte, "Supprimer")[0].click();
    const [, confirmer] = boutons(carte, "Supprimer");
    await Promise.all(confirmer.click());
    assert.equal(await contexte.etat.etagere.lire(personnage.id), null, "supprimé après confirmation");
    assert.match(texteDe(ecran), /Aucun personnage sur cet appareil/);
  } finally {
    retirer();
  }
});

test("personnages — le personnage de démonstration n'est proposé qu'en démonstration ; absent, un message", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    assert.equal(boutons(await liste(contexteDe({ mode: "reel" })), "Ajouter le personnage de démonstration").length, 0, "rien en mode réel");

    const demandes = [];
    let reponse = new Response(ecrirePersonnage(personnageEssai()), { status: 200 });
    globalThis.fetch = async (adresse, init) => {
      demandes.push([adresse, init?.cache]);
      return reponse;
    };
    const contexte = contexteDe();
    const ecran = await liste(contexte);
    const ajouter = boutons(ecran, "Ajouter le personnage de démonstration");
    assert.equal(ajouter.length, 1);
    await Promise.all(ajouter[0].click());
    assert.deepEqual(demandes, [["essais/personnage_demo.arpenteur.json", "no-store"]]);
    assert.equal((await contexte.etat.etagere.lister()).personnages.length, 1);
    assert.ok(carteDe(ecran, "Aubépine Crèmebrûlée"));

    reponse = new Response("Not Found", { status: 404 });
    const sansFichier = contexteDe();
    const autre = await liste(sansFichier);
    await Promise.all(boutons(autre, "Ajouter le personnage de démonstration")[0].click());
    assert.match(texteDe(alerte(autre)), /personnage de démonstration est introuvable/);
    assert.equal((await sansFichier.etat.etagere.lister()).personnages.length, 0);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("personnages — banque sans types : le message, ni création ni ouverture ; la liste reste", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe({ banque: SANS_TYPES });
    await garde(contexte, personnageEssai());
    const ecran = await liste(contexte);
    assert.equal(texteDe(alerte(ecran)), MESSAGE_BANQUE_SANS_TYPES);
    assert.equal(boutons(ecran, "Créer un personnage").length, 0);
    assert.equal(ecran.querySelector("#import-personnage"), null);
    const carte = carteDe(ecran, "Aubépine Crèmebrûlée");
    assert.ok(carte, "la liste reste");
    assert.equal(carte.querySelectorAll("a").length, 0, "ni Reprendre, ni Aperçu, ni Ouvrir");
    assert.equal(boutons(carte, "Enregistrer le fichier").length, 1);
    assert.equal(boutons(carte, "Supprimer").length, 1);
    assert.equal(boutons(carte, "Ouvrir sur mon téléphone").length, 0);
  } finally {
    retirer();
  }
});

test("personnages — un fichier hostile donne un message, et rien n'est gardé (§ 15.1)", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const ecran = await liste(contexte);
    const entree = ecran.querySelector("#import-personnage");
    assert.equal(entree.getAttribute("accept"), ".json,application/json");
    const hostiles = [
      ["<script>alert(1)</script>", /JSON illisible/],
      [JSON.stringify({ ...personnageEssai(), piege: "<img src=x onerror=alert(1)>" }), /« piege » est inconnu/],
      [ecrirePersonnage(personnageEssai((p) => (p.mode = "reel"))), /créé avec la banque réelle/],
      [`{"a":"${"x".repeat(70 * 1024)}"}`, /dépasse 64 Ko/],
    ];
    for (const [texte, attendu] of hostiles) {
      entree.files = [fichier(texte)];
      await Promise.all(entree.declencher("change"));
      const message = alerte(ecran);
      assert.ok(message, "un message");
      assert.match(texteDe(message), attendu);
      assert.equal(ecran.querySelector("img"), null, "aucune balise insérée");
    }
    assert.equal((await contexte.etat.etagere.lister()).personnages.length, 0, "rien n'est gardé");
  } finally {
    retirer();
  }
});

test("personnages — un fichier déjà présent : Remplacer, Garder les deux ou Annuler, dans la page", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const ecran = await liste(contexte);
    const entree = ecran.querySelector("#import-personnage");
    const importer = async (reponse) => {
      entree.files = [fichier(ecrirePersonnage(personnageEssai()))];
      const promesses = entree.declencher("change");
      if (reponse) {
        await attendre(() => boutons(ecran, reponse).length > 0, "la question n'est pas posée");
        assert.match(texteDe(ecran), /Ce personnage est déjà sur cet appareil\./);
        boutons(ecran, reponse)[0].click();
      }
      await Promise.all(promesses);
      return (await contexte.etat.etagere.lister()).personnages;
    };
    assert.equal((await importer(null)).length, 1, "le premier import est gardé sans question");
    assert.equal((await importer("Annuler")).length, 1);
    assert.equal((await importer("Remplacer")).length, 1);
    const deux = await importer("Garder les deux");
    assert.equal(deux.length, 2);
    assert.notEqual(deux[0].id, deux[1].id, "la copie a un nouvel identifiant");
  } finally {
    retirer();
  }
});

test("personnages — un appareil qui ne garde rien le dit ; les illisibles sont comptés", async () => {
  const retirer = installerDom();
  try {
    const magasin = magasinPersonnagesMemoire();
    await magasin.ecrire("demo", { id: "illisible-00000000001", etat: "inconnu" });
    await magasin.ecrire("demo", { id: "illisible-00000000002" });
    const ecran = await liste(contexteDe({ etagere: creerEtagere(magasin, "demo") }));
    assert.match(texteDe(ecran), /Cet appareil ne garde rien : les personnages disparaîtront à la fermeture de la page\. Enregistrez leur fichier\./);
    assert.match(texteDe(ecran), /2 personnages illisibles sont ignorés\./);
    const durable = { ...creerEtagere(magasinPersonnagesMemoire(), "demo"), durable: true };
    assert.doesNotMatch(texteDe(await liste(contexteDe({ etagere: durable }))), /ne garde rien/);
  } finally {
    retirer();
  }
});

// ─── Le parcours ────────────────────────────────────────────────────────────

test("parcours — chaque étape s'affiche, marque l'étape en cours et dit ce qui manque", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    for (const personnage of [nouveauPersonnage("demo"), personnageEssai()]) {
      await garde(contexte, personnage);
      const attendus = manques(BANQUE, personnage, { index: INDEX });
      for (let n = 1; n <= 9; n += 1) {
        const ecran = await etape(contexte, personnage.id, n);
        assert.match(texteDe(ecran.querySelector("h1")), /^Création — /);
        assert.match(texteDe(ecran), new RegExp(`Étape ${n} sur 9 : `));
        const liens = ecran.querySelector(".etapes").querySelectorAll("a");
        assert.equal(liens.length, 9);
        assert.deepEqual(liens.map((a) => a.getAttribute("aria-current")), liens.map((_, i) => (i + 1 === n ? "step" : null)));
        liens.forEach((a, i) => assert.match(texteDe(a), attendus[i + 1].length ? /à compléter$/ : /complète$/));
        const zone = ecran.querySelector(".manques");
        assert.equal(zone.getAttribute("role"), "status");
        if (attendus[n].length) for (const phrase of attendus[n]) assert.ok(zoneManques(ecran).includes(phrase), `étape ${n} : ${phrase}`);
        else assert.match(zoneManques(ecran), /Rien ne manque à cette étape\./);
        assert.equal(ecran.querySelectorAll("a").filter((a) => texteDe(a) === "Précédent").length, n > 1 ? 1 : 0);
        assert.equal(ecran.querySelectorAll("a").filter((a) => texteDe(a) === "Suivant").length, n < 9 ? 1 : 0);
        assert.equal(ecran.querySelector("[data-chargement]"), null, "la veille des 15 s ne guette pas cet écran");
      }
    }
    // Le nouveau personnage : tout manque sauf les capacités.
    assert.match(zoneManques(await etape(contexte, (await contexte.etat.etagere.lister()).personnages.find((p) => !p.identite.nom).id, 1)), /Donnez un nom au personnage\./);
  } finally {
    retirer();
  }
});

test("parcours — introuvable, enregistré, banque sans types : un message, pas de parcours", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    let ecran = await etape(contexte, "absent-000000000000001", 1);
    assert.equal(texteDe(ecran.querySelector("h1")), "Personnage introuvable sur cet appareil");
    assert.equal(ecran.querySelector("a").getAttribute("href"), "#/personnages");

    const enregistre = await garde(contexte, personnageEssai((p) => Object.assign(p, { etat: "enregistre", enregistre_le: "2026-09-29T20:30:00.000Z" })));
    ecran = await etape(contexte, enregistre.id, 3);
    assert.match(texteDe(ecran), /Ce personnage est enregistré : il n'est plus modifiable ; la progression viendra dans un lot ultérieur\./);
    assert.equal(ecran.querySelector("a").getAttribute("href"), `#/personnage/${enregistre.id}`);
    assert.equal(ecran.querySelectorAll("input").length, 0);

    const sansTypes = contexteDe({ banque: SANS_TYPES });
    const brouillon = await garde(sansTypes, personnageEssai());
    ecran = await etape(sansTypes, brouillon.id, 3);
    assert.equal(texteDe(alerte(ecran)), MESSAGE_BANQUE_SANS_TYPES);
    assert.equal(ecran.querySelectorAll("input").length, 0);
  } finally {
    retirer();
  }
});

test("parcours — étape 1 : le nom saisi est gardé aussitôt, et le titre le reprend", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 1);
    assert.equal(texteDe(ecran.querySelector("h1")), "Création — nouveau personnage");
    const nom = ecran.querySelector("#nom");
    assert.equal(nom.getAttribute("maxlength"), "120");
    assert.equal(ecran.querySelector("#age").getAttribute("maxlength"), "40");
    assert.equal(ecran.querySelector("#description").tagName, "TEXTAREA");
    assert.equal(ecran.querySelector("#histoire").getAttribute("maxlength"), "12000");
    saisir(nom, "Basilic Poivrade");
    saisir(ecran.querySelector("#histoire"), "Une vie\nen deux lignes.");
    await attendre(async () => (await contexte.etat.etagere.lire(personnage.id)).identite.histoire !== "", "le brouillon n'est pas gardé");
    const relu = await contexte.etat.etagere.lire(personnage.id);
    assert.equal(relu.identite.nom, "Basilic Poivrade");
    assert.equal(relu.identite.histoire, "Une vie\nen deux lignes.");
    assert.equal(relu.etape, 1);
    assert.ok(relu.modifie_le >= personnage.modifie_le);
    assert.equal(texteDe(ecran.querySelector("h1")), "Création — Basilic Poivrade");
    assert.match(zoneManques(ecran), /Rien ne manque à cette étape\./);
    assert.match(texteDe(ecran), /Brouillon enregistré à \d\d:\d\d:\d\d/);

    // Un caractère de contrôle : refusé par la vérification du format, rien n'est gardé.
    saisir(nom, "Basilic\u0007");
    assert.match(texteDe(alerte(ecran)), /caractère de contrôle/);
    await laisserFiler(10);
    assert.equal((await contexte.etat.etagere.lire(personnage.id)).identite.nom, "Basilic Poivrade");

    // Reprendre ailleurs : l'étape vue est retenue.
    await etape(contexte, personnage.id, 4);
    await attendre(async () => (await contexte.etat.etagere.lire(personnage.id)).etape === 4, "l'étape vue n'est pas retenue");
  } finally {
    retirer();
  }
});

test("parcours — étape 2 : la somme en direct, les dés, une valeur hors bornes n'est pas gardée", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 2);
    const somme = () => texteDe(ecran.querySelector(".somme"));
    assert.equal(somme(), "Somme : 0 / 36");
    const champ = ecran.querySelector("#carac-force");
    for (const [attribut, valeur] of [["type", "number"], ["min", "2"], ["max", "6"], ["step", "1"], ["inputmode", "numeric"]]) assert.equal(champ.getAttribute(attribut), valeur, attribut);
    assert.match(texteDe(ecran), /4 → d4 · 6 → d6 · 8 → d8 · 10 → d10 · 12 → d12/);

    saisir(champ, "6");
    saisir(ecran.querySelector("#carac-precision"), "5");
    assert.equal(somme(), "Somme : 11 / 36");
    // Lourde : For + Pré = 11 → d10 ; agile : Agi + For, Agi vide → aucun dé.
    const ligne = (type) => ecran.querySelector(".apercu-des").querySelectorAll("tr").find((tr) => tr.querySelector("th") && texteDe(tr.querySelector("th")) === type);
    assert.deepEqual(ligne("lourde").querySelectorAll("td").map(texteDe), ["d10 (For + Pré)", "— (For + Sen)"]);
    assert.deepEqual(ligne("agile").querySelectorAll("td").map(texteDe), ["— (Agi + For)", "— (Agi + Cré)"]);

    saisir(ecran.querySelector("#carac-sens"), "7");
    assert.match(texteDe(ecran), /De 2 à 6 : cette valeur n'est pas gardée\./);
    assert.equal(somme(), "Somme : 11 / 36");
    saisir(champ, "");
    assert.equal(somme(), "Somme : 5 / 36");
    await laisserFiler(10);
    const relu = await contexte.etat.etagere.lire(personnage.id);
    assert.deepEqual([relu.caracteristiques.force, relu.caracteristiques.precision, relu.caracteristiques.sens], [null, 5, null]);
    assert.match(zoneManques(ecran), /Donnez une valeur de 2 à 6 à : Force, Agilité/);
  } finally {
    retirer();
  }
});

test("parcours — étape 3 : archétype, groupes « Style de combat » et « Maîtrise » ; changer vide les choix", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    let ecran = await etape(contexte, personnage.id, 3);
    const radio = (nom) => ecran.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && texteDe(i.parentNode).startsWith(nom));
    cocher(radio("Saucier"));
    const legendes = ecran.querySelectorAll("legend").map(texteDe);
    assert.deepEqual(legendes, ["Archétype", "Style de combat", "Maîtrise"]);
    assert.match(zoneManques(ecran), /Choisir une option parmi : Solo du chef, Brigade\./);
    cocher(radio("Brigade"));
    cocher(radio("Maîtrise du lourd"));
    assert.match(zoneManques(ecran), /Rien ne manque/);
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).archetype, { nom: "Saucier", choix: ["Brigade", "Maîtrise du lourd"] });

    cocher(radio("Pâtissier"));
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).archetype, { nom: "Pâtissier", choix: [] });

    // Un groupe facultatif en cases à cocher ; une option absente est « à venir ».
    const banque = structuredClone(BANQUE);
    const patissier = banque.blocs.find((b) => b.nom === "Pâtissier");
    patissier.capacites.push({ forme: "facultatif", options: ["Glaçage", "Meringue fantôme"] });
    const autre = contexteDe({ banque });
    const brouillon = await garde(autre, personnageEssai((p) => (p.archetype = { nom: "Pâtissier", choix: ["Brigade", "Maîtrise du précis"] })));
    ecran = await etape(autre, brouillon.id, 3);
    const facultatif = ecran.querySelectorAll("fieldset").at(-1);
    assert.equal(texteDe(facultatif.querySelector("legend")), "Facultatif");
    assert.deepEqual(facultatif.querySelectorAll("input").map((i) => i.getAttribute("type")), ["checkbox", "checkbox"]);
    assert.match(texteDe(facultatif), /Meringue fantôme — capacité à venir/);
    cocher(facultatif.querySelectorAll("input")[0]);
    await laisserFiler(10);
    assert.deepEqual((await autre.etat.etagere.lire(brouillon.id)).archetype.choix, ["Brigade", "Maîtrise du précis", "Glaçage"]);
  } finally {
    retirer();
  }
});

test("parcours — étape 5 : le tirage est figé ; la saisie reste modifiable", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    let ecran = await etape(contexte, personnage.id, 5);
    assert.match(zoneManques(ecran), /Tirez la constellation au sort/);
    boutons(ecran, "Tirer au sort")[0].click();
    await laisserFiler(10);
    const tiree = (await contexte.etat.etagere.lire(personnage.id)).constellation;
    assert.equal(tiree.obtention, "tirage");
    assert.ok(INDEX.blocsDeType("constellation").some((b) => b.nom === tiree.nom));
    assert.match(texteDe(ecran), /Le tirage est figé : il ne se refait pas et ne se change pas\./);
    assert.equal(boutons(ecran, "Tirer au sort").length, 0);
    assert.equal(ecran.querySelector("#constellation-saisie"), null);
    ecran = await etape(contexte, personnage.id, 5);
    assert.equal(boutons(ecran, "Tirer au sort").length, 0, "figé après un retour à l'étape");

    const autre = await garde(contexte, nouveauPersonnage("demo"));
    ecran = await etape(contexte, autre.id, 5);
    saisir(ecran.querySelector("#constellation-saisie"), "Constellation du Chaudron", "change");
    saisir(ecran.querySelector("#constellation-saisie"), "Constellation de la Cuillère", "change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(autre.id)).constellation, { nom: "Constellation de la Cuillère", choix: [], obtention: "saisie" });
    assert.equal(boutons(ecran, "Tirer au sort").length, 1, "la saisie ne fige rien");
  } finally {
    retirer();
  }
});

test("parcours — étape 7 : objets, qualité, deux armures sur une zone signalées, « Retirer » recale les rôles", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai());
    let ecran = await etape(contexte, personnage.id, 7);
    const rubriques = ecran.querySelector("#objet-a-ajouter").querySelectorAll("optgroup").map((g) => g.getAttribute("label"));
    assert.deepEqual(rubriques, ["Armes", "Armures", "Équipement", "Consommables"]);
    assert.match(zoneManques(ecran), /Rien ne manque/);
    assert.deepEqual(optionsDe(ecran.querySelector("#arme-principale")), ["", "0", "1"], "mains nues et les deux armes");
    assert.deepEqual(optionsDe(ecran.querySelector("#bouclier")), ["", "7"], "aucun, et le couvercle");
    assert.equal(texteDe(ecran.querySelector("#arme-principale").querySelector("option")), "Aucune : mains nues");

    // Le plastron, porté avec le tablier : deux pièces sur le torse.
    cocher(ecran.querySelector("#objet-3-porte"));
    assert.match(zoneManques(ecran), /Torse : Tablier de cuir et Plastron de fonte couvrent la même zone/);

    // La qualité : un nombre, ou rien pour X ; une saisie fautive n'est pas gardée.
    const qualite = ecran.querySelector("#objet-1-qualite");
    assert.equal(qualite.getAttribute("pattern"), "\\d{1,3}(,\\d{1,2})?");
    saisir(qualite, "1,5");
    saisir(qualite, "abc");
    assert.match(texteDe(ecran), /cette valeur n'est pas gardée/);
    await laisserFiler(10);
    assert.equal((await contexte.etat.etagere.lire(personnage.id)).equipement[1].qualite, "1,5");

    // Retirer le couteau (rang 0) : l'arme principale se perd, le bouclier recule.
    boutons(ecran.querySelectorAll(".objet")[0], "Retirer")[0].click();
    await laisserFiler(10);
    let relu = await contexte.etat.etagere.lire(personnage.id);
    assert.equal(relu.equipement.length, 8);
    assert.deepEqual([relu.arme_principale, relu.bouclier], [null, 6]);

    // Ajouter une arme, puis la choisir comme arme principale.
    saisir(ecran.querySelector("#objet-a-ajouter"), "Spatule souple", "change");
    boutons(ecran, "Ajouter")[0].click();
    saisir(ecran.querySelector("#arme-principale"), "8", "change");
    await laisserFiler(10);
    relu = await contexte.etat.etagere.lire(personnage.id);
    assert.deepEqual(relu.equipement.at(-1), { nom: "Spatule souple", choix: [], qualite: null, porte: false });
    assert.equal(relu.arme_principale, 8);
    ecran = await etape(contexte, personnage.id, 7);
    assert.equal(ecran.querySelectorAll(".objet").length, 9);
  } finally {
    retirer();
  }
});

test("parcours — étape 8 : les niveaux proposés sont ceux que permet niveauxPermis ; revenir au niveau 1 retire la montée", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai((p) => (p.niveaux = [])));
    const ecran = await etape(contexte, personnage.id, 8);
    const fiche = calculerFiche(BANQUE, personnage, { index: INDEX });
    assert.match(texteDe(ecran), new RegExp(`Points dépensés : ${fiche.points.depenses} / 10 · reliquat : ${fiche.points.reliquat}`));
    const lignes = ecran.querySelectorAll(".capacite-ligne");
    assert.equal(lignes.length, fiche.capacites.length);
    fiche.capacites.forEach((capacite, i) => {
      const permis = niveauxPermis(fiche, capacite);
      const select = lignes[i].querySelector("select");
      if (permis.length > 1) assert.deepEqual(optionsDe(select).map(Number), permis, capacite.nom);
      else assert.equal(select, null, capacite.nom);
    });
    assert.ok(fiche.capacites.some((c) => niveauxPermis(fiche, c).length > 1), "au moins une montée possible");

    const flambage = () => ecran.querySelectorAll(".capacite-ligne").find((l) => texteDe(l).startsWith("Flambage")).querySelector("select");
    saisir(flambage(), "2", "change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, [{ capacite: "Flambage", niveau: 2 }]);
    assert.match(texteDe(ecran), /Points dépensés : 10 \/ 10 · reliquat : 0/);
    saisir(flambage(), "1", "change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, []);

    // Des capacités reçues au-delà de 10 points (un Saucier enrichi, dans une
    // copie de la banque), et une capacité à venir (la Poêle en fonte).
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Saucier").capacites.push(...["Costaud", "Glaçage", "Feuilletage", "Moulinet farineux"].map((nom) => ({ forme: "simple", nom })));
    const riche = contexteDe({ banque });
    const brouillon = await garde(
      riche,
      personnageEssai((p) => {
        p.niveaux = [];
        p.equipement.push({ nom: "Poêle en fonte", choix: [], qualite: null, porte: false });
      }),
    );
    const ficheRiche = calculerFiche(banque, brouillon, { index: indexerCreation(banque) });
    assert.ok(ficheRiche.points.recus > 10, `reçues : ${ficheRiche.points.recus}`);
    const autre = await etape(riche, brouillon.id, 8);
    assert.match(texteDe(autre), new RegExp(`Les capacités reçues valent déjà ${ficheRiche.points.recus} points : aucune montée n'est possible\\.`));
    assert.equal(autre.querySelectorAll("select").length, 0, "aucune montée proposée");
    assert.match(texteDe(autre), /Omelette fantôme.*capacité à venir, hors du décompte/);
  } finally {
    retirer();
  }
});

test("parcours — étape 9 : « Enregistrer » inactif tant qu'il manque quelque chose, puis le personnage enregistré avec ses empreintes", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai((p) => (p.identite.nom = "")));
    let ecran = await etape(contexte, personnage.id, 9);
    let [enregistrer] = boutons(ecran, "Enregistrer");
    assert.equal(enregistrer.disabled, true);
    const raison = ecran.querySelector(`#${enregistrer.getAttribute("aria-describedby")}`);
    assert.match(texteDe(raison), /Inactif tant qu'il manque quelque chose/);
    assert.match(zoneManques(ecran), /Identité : Donnez un nom au personnage\./);
    assert.match(texteDe(ecran), /Après l'enregistrement, le personnage n'est plus modifiable\./);
    assert.ok(ecran.querySelector(".lecture"), "le récapitulatif est la vue lecture");

    ecran = await etape(contexte, personnage.id, 1);
    saisir(ecran.querySelector("#nom"), "Aubépine Crèmebrûlée");
    await laisserFiler(10);
    ecran = await etape(contexte, personnage.id, 9);
    [enregistrer] = boutons(ecran, "Enregistrer");
    assert.equal(enregistrer.disabled, false);
    await Promise.all(enregistrer.click());
    const relu = await contexte.etat.etagere.lire(personnage.id);
    assert.equal(relu.etat, "enregistre");
    assert.ok(relu.enregistre_le);
    assert.deepEqual(relu.banque, { empreinte: EMPREINTE, publiee_le: BANQUE.publiee_le });
    assert.ok(relu.empreintes.length > 0, "les empreintes des choix");
    assert.ok(relu.empreintes.some((e) => e.genre === "bloc" && e.nom === "Saucier"));
    assert.ok(relu.empreintes.some((e) => e.genre === "capacite" && e.nom === "Flambage"));
    assert.equal(contexte.navigations.at(-1), `#/personnage/${personnage.id}`);
  } finally {
    retirer();
  }
});

// ─── La réception d'un lien ─────────────────────────────────────────────────

const recevoir = (contexte, code) => montrer(reception.afficher(contexte, { ecran: "recevoir", code }));

test("réception — un lien valide : l'aperçu, puis « Enregistrer sur cet appareil » et la fiche", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = personnageEssai();
    const ecran = reception.afficher(contexte, { ecran: "recevoir", code: await codeDuLien(personnage) });
    assert.match(texteDe(ecran), /Lecture du personnage…/);
    assert.equal(ecran.querySelector("[data-chargement]"), null);
    await montrer(ecran);
    await attendre(() => ecran.querySelector(".lecture"), "l'aperçu n'arrive pas");
    assert.equal(texteDe(ecran.querySelector("h1")), "Personnage reçu");
    assert.match(texteDe(ecran.querySelector(".lecture")), /Aubépine Crèmebrûlée/);
    assert.equal(await contexte.etat.etagere.lire(personnage.id), null, "rien n'est gardé sans le demander");
    await Promise.all(boutons(ecran, "Enregistrer sur cet appareil")[0].click());
    assert.ok(await contexte.etat.etagere.lire(personnage.id));
    assert.deepEqual(contexte.navigations, [`#/personnage/${personnage.id}`]);

    // Le même lien, rouvert : la question du doublon, puis Remplacer.
    const encore = await recevoir(contexte, await codeDuLien(personnageEssai((p) => (p.identite.age = "32 ans"))));
    await attendre(() => encore.querySelector(".lecture"), "l'aperçu n'arrive pas");
    const promesses = boutons(encore, "Enregistrer sur cet appareil")[0].click();
    await attendre(() => boutons(encore, "Remplacer").length, "la question n'est pas posée");
    assert.match(texteDe(encore), /Ce personnage est déjà sur cet appareil\./);
    boutons(encore, "Remplacer")[0].click();
    await Promise.all(promesses);
    assert.equal((await contexte.etat.etagere.lire(personnage.id)).identite.age, "32 ans");
    assert.equal((await contexte.etat.etagere.lister()).personnages.length, 1);
  } finally {
    retirer();
  }
});

test("réception — un lien de l'autre mode, un lien abîmé : un message et le lien vers « Personnages »", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const reel = personnageEssai((p) => (p.mode = "reel"));
    for (const [code, attendu] of [
      [await codeDuLien(reel), /créé avec la banque réelle : ouvrez-le hors de la démonstration/],
      ["abc", /Ce lien est abîmé/],
      ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", /Ce lien est abîmé/],
    ]) {
      const ecran = await recevoir(contexte, code);
      await attendre(() => alerte(ecran), "le refus ne s'affiche pas");
      assert.match(texteDe(alerte(ecran)), attendu);
      assert.equal(texteDe(ecran.querySelector("h1")), "Lien refusé");
      assert.equal(ecran.querySelector("a").getAttribute("href"), "#/personnages");
      assert.equal(boutons(ecran, "Enregistrer").length, 0);
    }
    assert.equal((await contexte.etat.etagere.lister()).personnages.length, 0);

    // Banque sans types : son message, sans aperçu ; l'enregistrement reste possible.
    const sansTypes = contexteDe({ banque: SANS_TYPES });
    const ecran = await recevoir(sansTypes, await codeDuLien(personnageEssai()));
    await attendre(() => alerte(ecran), "le message ne s'affiche pas");
    assert.equal(texteDe(alerte(ecran)), MESSAGE_BANQUE_SANS_TYPES);
    assert.equal(ecran.querySelector(".lecture"), null);
    assert.equal(boutons(ecran, "Enregistrer sur cet appareil").length, 1);
  } finally {
    retirer();
  }
});

test("écrans des personnages — aucun data-chargement, aucune insertion de HTML, aucun window.confirm", () => {
  for (const chemin of ["js/ecrans/personnages.js", "js/ecrans/creation.js", "js/ecrans/reception.js"]) {
    const source = readFileSync(new URL(chemin, RACINE), "utf8");
    assert.doesNotMatch(source, /data-chargement/, chemin);
    assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML|confirm\()/, chemin);
  }
});
