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
import { el } from "../js/ecrans/dom.js";
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
// Un bouton par son nom accessible (aria-label).
const parLibelle = (noeud, libelle) => noeud.querySelectorAll("button").find((b) => b.getAttribute("aria-label") === libelle);
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
    assert.match(texteDe(ecran), /Aucun personnage enregistré.BrouillonsAucun brouillon./);
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
    assert.match(texteDe(ecran), /Aucun personnage enregistré.BrouillonsAucun brouillon./);
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

test("parcours — introuvable, enregistré, banque sans types : un message, pas de parcours", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    let ecran = await etape(contexte, "absent-000000000000001", 1);
    assert.equal(texteDe(ecran.querySelector("h1")), "Personnage introuvable sur cet appareil");
    assert.equal(ecran.querySelector("a").getAttribute("href"), "#/personnages");

    // Un enregistré ne s'ouvre pas en parcours : « Modifier » en fait une copie de travail.
    const enregistre = await garde(contexte, personnageEssai((p) => Object.assign(p, { etat: "enregistre", enregistre_le: "2026-09-29T20:30:00.000Z" })));
    ecran = await etape(contexte, enregistre.id, 3);
    assert.match(texteDe(ecran), /Ce personnage est enregistré : « Modifier » en ouvre une copie de travail/);
    assert.equal(ecran.querySelectorAll("a").find((a) => texteDe(a) === "Ouvrir sa fiche").getAttribute("href"), `#/personnage/${enregistre.id}`);
    assert.equal(ecran.querySelectorAll("input").length, 0);
    assert.equal(boutons(ecran, "Modifier").length, 1);

    const sansTypes = contexteDe({ banque: SANS_TYPES });
    const brouillon = await garde(sansTypes, personnageEssai());
    ecran = await etape(sansTypes, brouillon.id, 3);
    assert.equal(texteDe(alerte(ecran)), MESSAGE_BANQUE_SANS_TYPES);
    assert.equal(ecran.querySelectorAll("input").length, 0);
  } finally {
    retirer();
  }
});

test("parcours — étape 2 : toutes à 2 au départ, + et − de 2 à 6, la somme en direct, « + » arrêté à 36, les dés", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 2);
    const somme = () => texteDe(ecran.querySelector(".somme"));
    const valeur = (code) => texteDe(ecran.querySelector(`#carac-${code}`));
    const plus = (code) => ecran.querySelector(`#carac-${code}-plus`);
    const moins = (code) => ecran.querySelector(`#carac-${code}-moins`);
    assert.equal(somme(), "Somme : 18 / 36 · reste 18 à répartir");
    assert.equal(valeur("force"), "2");
    assert.equal(moins("force").disabled, true, "2 : le minimum");
    assert.equal(plus("force").getAttribute("aria-label"), "Augmenter Force");
    assert.equal(ecran.querySelector("#carac-force").getAttribute("aria-live"), "polite");
    assert.match(texteDe(ecran), /4 → d4 · 6 → d6 · 8 → d8 · 10 → d10 · 12 → d12/);

    for (let i = 0; i < 4; i += 1) plus("force").click();
    assert.equal(valeur("force"), "6");
    assert.equal(plus("force").disabled, true, "6 : le maximum");
    // Le focus passe au bouton voisin quand le sien devient inactif.
    assert.equal(document.activeElement?.id, "carac-force-moins");
    plus("force").click();
    assert.equal(valeur("force"), "6", "au-delà de 6, rien ne change");
    for (let i = 0; i < 3; i += 1) plus("precision").click();
    assert.equal(somme(), "Somme : 25 / 36 · reste 11 à répartir");
    // Lourde : For + Pré = 11 → d10 ; agile : Agi + For = 8 → d8.
    const ligne = (type) => ecran.querySelector(".apercu-des").querySelectorAll("tr").find((tr) => tr.querySelector("th") && texteDe(tr.querySelector("th")) === type);
    assert.deepEqual(ligne("lourde").querySelectorAll("td").map(texteDe), ["d10 (For + Pré)", "d8 (For + Sen)"]);
    assert.deepEqual(ligne("agile").querySelectorAll("td").map(texteDe), ["d8 (Agi + For)", "d4 (Agi + Cré)"]);
    moins("precision").click();
    assert.equal(somme(), "Somme : 24 / 36 · reste 12 à répartir");

    // Jusqu'à 36 : « + » s'arrête partout.
    for (const code of ["agilite", "sens", "culture_neruvienne"]) for (let i = 0; i < 4; i += 1) plus(code).click();
    assert.equal(somme(), "Somme : 36 / 36");
    assert.ok(ecran.querySelectorAll("button").filter((b) => b.id.endsWith("-plus")).every((b) => b.disabled), "« + » inactif à 36");
    await laisserFiler(10);
    const relu = await contexte.etat.etagere.lire(personnage.id);
    assert.deepEqual(
      [relu.caracteristiques.force, relu.caracteristiques.precision, relu.caracteristiques.agilite, relu.caracteristiques.parole],
      [6, 4, 6, 2],
    );
    assert.match(zoneManques(ecran), /Rien ne manque/);
    assert.equal(ecran.querySelectorAll("input").length, 0, "plus de champ de saisie : des boutons");
  } finally {
    retirer();
  }
});

test("parcours — étapes 3, 4 et 6 : chaque bloc montre ses capacités décrites au niveau 1 ; dépliées sur grand écran, à déplier sur téléphone", async () => {
  const retirer = installerDom();
  const avant = globalThis.matchMedia;
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai((p) => (p.caracteristiques.force = 5)));
    let ecran = await etape(contexte, personnage.id, 3);
    // Le Saucier est choisi : Réduction, décrite ; ses groupes, plus bas, chacun décrit.
    const saucier = ecran.querySelectorAll(".choix-bloc").find((b) => texteDe(b).startsWith("Saucier"));
    assert.ok(saucier.querySelectorAll("details").length >= 3, "les capacités du Saucier");
    const flambage = ecran.querySelectorAll("details").find((d) => texteDe(d.querySelector("summary")).startsWith("Flambage"));
    assert.ok(flambage, "Flambage décrite");
    assert.match(texteDe(flambage.querySelector("summary")), /niveau 1 · /);
    assert.equal(flambage.getAttribute("open"), "", "grand écran : dépliée");
    // Un bloc non choisi montre aussi ses groupes, décrits.
    const patissier = ecran.querySelectorAll(".choix-bloc").find((b) => texteDe(b).startsWith("Pâtissier"));
    assert.match(texteDe(patissier), /Au choix, une option :/);
    // Les options du groupe choisi, chacune avec sa description.
    const style = ecran.querySelectorAll("fieldset").find((f) => texteDe(f.querySelector("legend")) === "Style de combat");
    assert.equal(style.querySelectorAll(".option-decrite").length, 2);
    assert.ok(style.querySelectorAll("details").length >= 1);
    // Aucune expression ne reste entre crochets là où elle se calcule.
    for (const d of ecran.querySelectorAll(".capacite-texte")) assert.doesNotMatch(texteDe(d), /\[N\]/);

    // Le bloc de base décrit à l'étape 8 ; ici, l'espèce et le primordial.
    ecran = await etape(contexte, personnage.id, 4);
    assert.ok(ecran.querySelectorAll(".choix-bloc").every((b) => b.querySelectorAll("details").length + (/Capacités à venir/.test(texteDe(b)) ? 1 : 0) >= 1));
    ecran = await etape(contexte, personnage.id, 6);
    const four = ecran.querySelectorAll(".choix-bloc").find((b) => texteDe(b).startsWith("Grand Four"));
    assert.ok(four.querySelectorAll("details").some((d) => texteDe(d).startsWith("Fournaise")));
    const givre = ecran.querySelectorAll(".choix-bloc").find((b) => texteDe(b).startsWith("Givre éternel"));
    assert.match(texteDe(givre), /Capacités à venir/);

    // Sur un téléphone, la description se déplie sous le nom.
    globalThis.matchMedia = (requete) => ({ matches: requete.includes("max-width") });
    ecran = await etape(contexte, personnage.id, 3);
    assert.ok(ecran.querySelectorAll("details").length > 0);
    assert.ok(ecran.querySelectorAll("details").every((d) => d.getAttribute("open") === null), "téléphone : repliées");
  } finally {
    globalThis.matchMedia = avant;
    retirer();
  }
});

test("parcours — étape 5 : le tirage se refait à volonté et se compte ; la saisie reste possible", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    let ecran = await etape(contexte, personnage.id, 5);
    assert.match(zoneManques(ecran), /Tirez la constellation au sort/);
    boutons(ecran, "Tirer au sort")[0].click();
    await laisserFiler(10);
    let tiree = (await contexte.etat.etagere.lire(personnage.id)).constellation;
    assert.deepEqual([tiree.obtention, tiree.tirages], ["tirage", 1]);
    assert.ok(INDEX.blocsDeType("constellation").some((b) => b.nom === tiree.nom));
    assert.match(texteDe(ecran.querySelector("#constellation-tiree")), /tirée 1 fois/);
    assert.equal(document.activeElement?.id, "constellation-tiree");
    // « Refaire le tirage » : un tirage de plus, compté.
    assert.equal(boutons(ecran, "Tirer au sort").length, 0);
    boutons(ecran, "Refaire le tirage")[0].click();
    boutons(ecran, "Refaire le tirage")[0].click();
    await laisserFiler(10);
    tiree = (await contexte.etat.etagere.lire(personnage.id)).constellation;
    assert.equal(tiree.tirages, 3);
    assert.match(texteDe(ecran), /tirée 3 fois/);
    ecran = await etape(contexte, personnage.id, 5);
    assert.equal(boutons(ecran, "Refaire le tirage").length, 1, "toujours refaisable après un retour à l'étape");

    // La saisie à la main : marquée comme telle ; le compte des tirages reste.
    saisir(ecran.querySelector("#constellation-saisie"), "Constellation de la Cuillère", "change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).constellation, { nom: "Constellation de la Cuillère", choix: [], obtention: "saisie", tirages: 3 });
    assert.match(texteDe(ecran), /Constellation saisie à la main : Constellation de la Cuillère/);
    boutons(ecran, "Tirer au sort")[0].click();
    await laisserFiler(10);
    assert.equal((await contexte.etat.etagere.lire(personnage.id)).constellation.tirages, 4);
  } finally {
    retirer();
  }
});

test("parcours — étape 7 : l'arme tenue d'office, le pack d'armure, tous les objets au sac, qualité 2 ; deux pièces sur une zone refusées", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    let ecran = await etape(contexte, personnage.id, 7);
    const relire = () => contexte.etat.etagere.lire(personnage.id);
    // L'arme : une liste, « mains nues » d'abord ; la choisir l'équipe.
    assert.equal(texteDe(ecran.querySelector("#arme").querySelector("option")), "Aucune : mains nues");
    saisir(ecran.querySelector("#arme"), "Couteau d'office", "change");
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement, [{ nom: "Couteau d'office", choix: [], qualite: "2", place: "arme" }]);
    assert.ok(ecran.querySelectorAll("details").some((d) => texteDe(d).startsWith("Émincer")), "les capacités de l'arme, décrites");
    // Changer d'arme la remplace.
    saisir(ecran.querySelector("#arme"), "Spatule souple", "change");
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement.map((o) => [o.nom, o.place]), [["Spatule souple", "arme"]]);

    // Les packs : agile (tablier, maniques, toque), lourd (plastron), précis (guêtres).
    const packs = ecran.querySelectorAll("input[name=pack]");
    assert.deepEqual(packs.map((p) => p.id), ["pack-aucun", "pack-lourde", "pack-agile", "pack-precise"]);
    assert.ok(packs.every((p) => !p.disabled));
    cocher(ecran.querySelector("#pack-agile"));
    await laisserFiler(10);
    let relu = await relire();
    assert.deepEqual(
      relu.equipement.filter((o) => o.place === "pack").map((o) => [o.nom, o.qualite]),
      [["Maniques", "2"], ["Tablier de cuir", "2"], ["Toque renforcée", "2"]],
    );
    assert.equal(ecran.querySelector("#pack-agile").checked, true);
    // Un autre pack remplace le premier.
    cocher(ecran.querySelector("#pack-lourde"));
    await laisserFiler(10);
    assert.deepEqual((await relire()).equipement.filter((o) => o.place === "pack").map((o) => o.nom), ["Plastron de fonte"]);

    // Tous les objets : rangés dans le sac, qualité 2.
    saisir(ecran.querySelector("#objet-a-ajouter"), "Tablier de cuir", "change");
    boutons(ecran, "Ajouter")[0].click();
    saisir(ecran.querySelector("#objet-a-ajouter"), "Couvercle de marmite", "change");
    boutons(ecran, "Ajouter")[0].click();
    saisir(ecran.querySelector("#objet-a-ajouter"), "Rouleau de fonte", "change");
    boutons(ecran, "Ajouter")[0].click();
    await laisserFiler(10);
    relu = await relire();
    assert.deepEqual(relu.equipement.slice(-3).map((o) => [o.nom, o.qualite, o.place]), [
      ["Tablier de cuir", "2", "sac"],
      ["Couvercle de marmite", "2", "sac"],
      ["Rouleau de fonte", "2", "sac"],
    ]);
    // Le tablier ne se porte pas : le plastron du pack couvre déjà le torse.
    parLibelle(ecran, "Porter Tablier de cuir").click();
    await laisserFiler(10);
    assert.match(texteDe(alerte(ecran)), /« Tablier de cuir » ne se porte pas : torse déjà couvert par « Plastron de fonte »/);
    assert.equal((await relire()).equipement.find((o) => o.nom === "Tablier de cuir").place, "sac");
    // Le bouclier s'équipe ; le rouleau se prend en main, la spatule retourne au sac.
    parLibelle(ecran, "Équiper Couvercle de marmite").click();
    parLibelle(ecran, "Prendre en main Rouleau de fonte").click();
    await laisserFiler(10);
    relu = await relire();
    assert.deepEqual(relu.equipement.map((o) => [o.nom, o.place]), [
      ["Spatule souple", "sac"],
      ["Plastron de fonte", "pack"],
      ["Tablier de cuir", "sac"],
      ["Couvercle de marmite", "equipe"],
      ["Rouleau de fonte", "arme"],
    ]);
    assert.equal(texteDe(ecran.querySelector("#arme").querySelectorAll("option").find((o) => o.getAttribute("selected") !== null)), "Rouleau de fonte", "la liste « Arme » montre l'arme tenue");
    assert.match(zoneManques(ecran), /Rien ne manque/);
    // Aucun champ de qualité à la création.
    assert.equal(ecran.querySelectorAll("input").filter((i) => /qualite/.test(i.id)).length, 0);
    // Sans pack, la pièce se porte.
    cocher(ecran.querySelector("#pack-aucun"));
    parLibelle(ecran, "Porter Tablier de cuir").click();
    await laisserFiler(10);
    assert.equal((await relire()).equipement.find((o) => o.nom === "Tablier de cuir").place, "equipe");
    // Choisir le pack agile renvoie au sac la pièce portée seule sur le torse.
    cocher(ecran.querySelector("#pack-agile"));
    await laisserFiler(10);
    assert.equal((await relire()).equipement.find((o) => o.nom === "Tablier de cuir" && o.place !== "pack").place, "sac");
    ecran = await etape(contexte, personnage.id, 7);
    assert.equal(ecran.querySelector("#pack-agile").checked, true);
  } finally {
    retirer();
  }
});

test("parcours — étape 7 : un type d'armure à deux pièces sur une zone n'a pas de pack (A10) : proposé inactif, avec la raison", async () => {
  const retirer = installerDom();
  try {
    const banque = structuredClone(BANQUE);
    const tablier = banque.blocs.find((b) => b.nom === "Tablier de cuir");
    banque.blocs.push({ ...structuredClone(tablier), nom: "Brassière de cuir", parametres: tablier.parametres.map((p) => (p.nom === "armure" ? { ...p, valeur: "10/0/0/15/0/0" } : p)) });
    const contexte = contexteDe({ banque });
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 7);
    assert.equal(ecran.querySelector("#pack-agile").disabled, true);
    assert.equal(ecran.querySelector("#pack-lourde").disabled, false);
    assert.match(texteDe(ecran.querySelector("#pack-agile").parentNode), /non proposé : torse couvert par Brassière de cuir et Tablier de cuir ; bras gauche couvert par Brassière de cuir et Maniques/);
  } finally {
    retirer();
  }
});

test("parcours — étape 8 : seules les capacités qui peuvent évoluer, avec + et − et leur description avant et après ; + inactif sans assez de points", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai((p) => (p.niveaux = [])));
    let ecran = await etape(contexte, personnage.id, 8);
    const fiche = calculerFiche(BANQUE, personnage, { index: INDEX });
    assert.match(texteDe(ecran), new RegExp(`Points dépensés : ${fiche.points.depenses} / 10 · reliquat : ${fiche.points.reliquat}`));
    const evolutives = fiche.capacites.filter((c) => !c.aVenir && c.peutEvoluer && c.niveauCreation >= 1);
    const lignes = ecran.querySelectorAll(".capacite-ligne");
    assert.deepEqual(lignes.map((l) => texteDe(l.querySelector("strong"))), evolutives.map((c) => c.nom));
    assert.ok(!lignes.some((l) => /niveau 0/.test(texteDe(l.querySelector(".valeur-pas")))), "aucune capacité de niveau 0");
    assert.ok(fiche.capacites.some((c) => c.niveau === 0), "le personnage en a pourtant");
    evolutives.forEach((capacite, i) => {
      const permis = niveauxPermis(fiche, capacite);
      assert.equal(lignes[i].querySelector(`#niveau-${i}-plus`).disabled, !permis.includes(capacite.niveau + 1), capacite.nom);
      assert.equal(lignes[i].querySelector(`#niveau-${i}-moins`).disabled, true, "au niveau de départ");
      // Avant et après l'évolution, décrites.
      const resumes = lignes[i].querySelectorAll("summary").map(texteDe);
      assert.match(resumes[0], /^Avant l'évolution niveau 1 · /);
      assert.match(resumes[1], /^Après l'évolution niveau 2 · /);
    });

    const ligne = (nom) => ecran.querySelectorAll(".capacite-ligne").find((l) => texteDe(l.querySelector("strong")) === nom);
    const plus = (nom) => ligne(nom).querySelectorAll("button").find((b) => b.id.endsWith("-plus"));
    const moins = (nom) => ligne(nom).querySelectorAll("button").find((b) => b.id.endsWith("-moins"));
    plus("Flambage").click();
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, [{ capacite: "Flambage", niveau: 2 }]);
    assert.match(texteDe(ecran), /Points dépensés : 10 \/ 10 · reliquat : 0/);
    assert.match(texteDe(ligne("Flambage").querySelectorAll("summary")[1]), /^Après l'évolution \(choisie\) niveau 2 · /);
    // Le reliquat épuisé : « + » inactif partout, avec la raison.
    for (const l of ecran.querySelectorAll(".capacite-ligne")) assert.equal(l.querySelectorAll("button").find((b) => b.id.endsWith("-plus")).disabled, true, texteDe(l.querySelector("strong")));
    assert.match(texteDe(ligne("Réduction")), /il manque 2 point\(s\)/);
    moins("Flambage").click();
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, []);

    // Des capacités reçues au-delà de 10 points (un Saucier enrichi, dans une
    // copie de la banque) : les capacités montrées, aucun « + » actif.
    const banque = structuredClone(BANQUE);
    banque.blocs.find((b) => b.nom === "Saucier").capacites.push(...["Costaud", "Glaçage", "Feuilletage", "Moulinet farineux"].map((nom) => ({ forme: "simple", nom })));
    const riche = contexteDe({ banque });
    const brouillon = await garde(riche, personnageEssai((p) => (p.niveaux = [])));
    const ficheRiche = calculerFiche(banque, brouillon, { index: indexerCreation(banque) });
    assert.ok(ficheRiche.points.recus > 10, `reçues : ${ficheRiche.points.recus}`);
    ecran = await etape(riche, brouillon.id, 8);
    assert.match(texteDe(ecran), new RegExp(`Les capacités reçues valent déjà ${ficheRiche.points.recus} points : aucune montée n'est possible\\.`));
    assert.ok(ecran.querySelectorAll(".capacite-ligne").length > 0, "montrées même sans assez de points");
    assert.ok(ecran.querySelectorAll("button").filter((b) => b.id.endsWith("-plus")).every((b) => b.disabled));
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
    assert.match(texteDe(ecran), /le personnage reste modifiable : « Modifier », sur sa fiche, rouvre ce parcours\./);
    assert.equal(boutons(ecran, "Enregistrer sous un autre nom").length, 0, "un nouveau personnage n'a pas d'original");
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

test("parcours — « Modifier » : une copie de travail ; « Enregistrer » remplace l'original, « Enregistrer sous un autre nom » en fait un autre", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const etagere = contexte.etat.etagere;
    const original = await garde(contexte, personnageEssai((p) => Object.assign(p, { etat: "enregistre", etape: 9, enregistre_le: "2026-09-29T20:30:00.000Z" })));
    const modifierDepuis = async () => {
      const ecran = await etape(contexte, original.id, 1);
      await Promise.all(boutons(ecran, "Modifier")[0].click());
      await laisserFiler(10);
      return contexte.navigations.at(-1).match(/^#\/personnage\/([A-Za-z0-9_-]+)\/etape\/1$/)[1];
    };
    const idCopie = await modifierDepuis();
    assert.notEqual(idCopie, original.id);
    const copie = await etagere.lire(idCopie);
    assert.equal(copie.etat, "brouillon");
    assert.deepEqual((await etagere.lireNote(idCopie)).remplace, original.id);
    assert.equal((await etagere.lire(original.id)).etat, "enregistre", "l'original ne change pas");
    // « Modifier » de nouveau reprend la même copie.
    assert.equal(await modifierDepuis(), idCopie);

    let ecran = await etape(contexte, idCopie, 1);
    assert.match(texteDe(ecran.querySelector("h1")), /^Modification — /);
    assert.match(texteDe(ecran), /Copie de travail de « Aubépine Crèmebrûlée »/);
    saisir(ecran.querySelector("#age"), "32 ans");
    await laisserFiler(10);
    assert.equal((await etagere.lire(original.id)).identite.age, "31 ans", "l'original attend l'enregistrement");

    // « Enregistrer » : l'original est remplacé, la copie disparaît.
    ecran = await etape(contexte, idCopie, 9);
    assert.match(texteDe(ecran), /« Enregistrer » remplace « Aubépine Crèmebrûlée »/);
    await Promise.all(boutons(ecran, "Enregistrer")[0].click());
    await laisserFiler(10);
    const remplace = await etagere.lire(original.id);
    assert.deepEqual([remplace.etat, remplace.identite.age, remplace.enregistre_le, remplace.cree_le], ["enregistre", "32 ans", original.enregistre_le, original.cree_le]);
    assert.equal(await etagere.lire(idCopie), null);
    assert.equal(await etagere.lireNote(idCopie), null);
    assert.equal(contexte.navigations.at(-1), `#/personnage/${original.id}`);

    // « Enregistrer sous un autre nom » : un nouveau personnage ; l'original reste.
    const idDeux = await modifierDepuis();
    ecran = await etape(contexte, idDeux, 9);
    const nom = ecran.querySelector("#autre-nom");
    assert.equal(nom.value, "Aubépine Crèmebrûlée (copie)");
    saisir(nom, "aubépine crèmebrûlée");
    await Promise.all(boutons(ecran, "Enregistrer sous un autre nom")[0].click());
    assert.match(texteDe(alerte(ecran)), /est le nom de l'original : choisissez-en un autre/);
    saisir(nom, "Bourrache Crèmebrûlée");
    await Promise.all(boutons(ecran, "Enregistrer sous un autre nom")[0].click());
    await laisserFiler(10);
    const autre = await etagere.lire(idDeux);
    assert.deepEqual([autre.etat, autre.identite.nom], ["enregistre", "Bourrache Crèmebrûlée"]);
    assert.equal((await etagere.lire(original.id)).identite.nom, "Aubépine Crèmebrûlée");
    assert.equal(await etagere.lireNote(idDeux), null);
    assert.equal((await etagere.lister()).personnages.length, 2);
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

test("relecture — changer d'archétype efface la montée d'une capacité perdue", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai());
    const ecran = await etape(contexte, personnage.id, 3);
    const patissier = ecran.querySelectorAll("input[type=radio][name=archetype]").find((r) => texteDe(r.parentNode).startsWith("Pâtissier"));
    patissier.declencher("change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, [], "Flambage n'est plus possédée");
  } finally {
    retirer();
  }
});

test("relecture — la question du doublon montre les deux versions, et dit quand la reçue est un brouillon ou plus ancienne", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    await garde(contexte, personnageEssai((p) => Object.assign(p, { etat: "enregistre", enregistre_le: "2026-09-30T10:00:00.000Z", modifie_le: "2026-09-30T10:00:00.000Z" })));
    const zone = el("div", {});
    document.body.replaceChildren(zone);
    const vieux = personnageEssai((p) => (p.modifie_le = "2026-09-01T10:00:00.000Z"));
    const garde2 = personnages.garderRecu(contexte.etat.etagere, vieux, zone);
    await laisserFiler(10);
    const texte = texteDe(zone);
    assert.match(texte, /Le remplacer est définitif/);
    assert.match(texte, /Sur l'appareil : « Aubépine Crèmebrûlée », enregistré le 30\/09\/2026/);
    assert.match(texte, /Reçu : « Aubépine Crèmebrûlée », brouillon, étape 1 sur 9/);
    assert.match(texte, /La version reçue est un brouillon, celle de l'appareil est enregistrée\./);
    assert.match(texte, /La version reçue est plus ancienne que celle de l'appareil\./);
    boutons(zone, "Annuler")[0].click();
    assert.equal(await garde2, null);
    assert.equal((await contexte.etat.etagere.lire(vieux.id)).etat, "enregistre");
  } finally {
    retirer();
  }
});

test("relecture — sur un téléphone, les étapes viennent après le contenu ; les liens de retour ont leur cible ; le focus suit l'objet", async () => {
  const retirer = installerDom();
  const avant = globalThis.matchMedia;
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, personnageEssai());
    const ordre = (ecran) => ecran.children[1].children.map((e) => e.tagName + (e.className ? `.${e.className.split(" ")[0]}` : ""));
    let ecran = await etape(contexte, personnage.id, 2);
    assert.equal(ordre(ecran)[0], "NAV.navigation-etapes", "grand écran : en tête");
    globalThis.matchMedia = (requete) => ({ matches: requete.includes("max-width") });
    ecran = await etape(contexte, personnage.id, 2);
    const telephone = ordre(ecran);
    assert.equal(telephone[0], "H2");
    assert.ok(telephone.indexOf("NAV.navigation-etapes") > telephone.indexOf("DIV.boutons"), "téléphone : après « Suivant »");
    assert.ok(ecran.querySelector(".lien-retour").querySelector("a"));
    globalThis.matchMedia = avant;
    // Étape 7 : après « Ajouter », le focus va au nouvel objet ; après
    // « Retirer », à l'objet suivant.
    ecran = await etape(contexte, personnage.id, 7);
    const liste = ecran.querySelector("#objet-a-ajouter");
    saisir(liste, "Spatule souple", "change");
    boutons(ecran, "Ajouter")[0].click();
    await laisserFiler(10);
    assert.equal(document.activeElement?.id, "objet-9-titre");
    assert.match(texteDe(document.activeElement), /Spatule souple/);
    boutons(ecran, "Retirer")[2].click();
    await laisserFiler(10);
    assert.equal(document.activeElement?.id, "objet-3-titre");
  } finally {
    globalThis.matchMedia = avant;
    retirer();
  }
});

// ─── Les personnages en ligne (lot 2 bis) ───────────────────────────────────

// Un dépôt simulé : ce qu'il rend et ce qu'on lui demande.
function faussePorte({ raison = null, vue = null } = {}) {
  const appels = [];
  return {
    appels,
    raison,
    phraseEnregistrement: raison ?? "Enregistré, le personnage part en ligne : visible par tous d'ici quelques minutes.",
    async envoyer(personnage, options) {
      appels.push(["envoyer", personnage.id, options.action]);
      return { envoye: true, ticket: 5 };
    },
    async supprimer(id) {
      appels.push(["supprimer", id]);
      return { envoye: true };
    },
    async reessayer(id) {
      appels.push(["reessayer", id]);
      return { envoye: true };
    },
    async rapprocher() {
      return vue;
    },
    async lire() {
      return null;
    },
  };
}

test("personnages — en ligne : ceux du site, à part ceux de l'appareil ; « Supprimer » pour tous ; « Réessayer » ; la raison d'un dépôt fermé", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe({ mode: "reel", etagere: creerEtagere(magasinPersonnagesMemoire(), "reel") });
    const enLigne = personnageEssai((p) => Object.assign(p, { id: "AAAAAAAAAAAAAAAAAAAAAA", mode: "reel", etat: "enregistre", enregistre_le: "2026-09-30T10:00:00.000Z" }));
    const attente = { ...structuredClone(enLigne), id: "BBBBBBBBBBBBBBBBBBBBBB", identite: { ...enLigne.identite, nom: "Bourrache" } };
    const nonEnvoye = { ...structuredClone(enLigne), id: "CCCCCCCCCCCCCCCCCCCCCC", identite: { ...enLigne.identite, nom: "Cerfeuil" } };
    const depot = faussePorte({
      vue: {
        enLigne: [enLigne],
        attente: [{ personnage: attente, note: { depot: { etat: "envoye", action: "creer", ticket: 5, date: "2026-09-30T11:58:00.000Z", erreur: null } } }],
        nonEnvoyes: [{ personnage: nonEnvoye, note: { depot: { etat: "non_envoye", action: "creer", ticket: null, date: "2026-09-30T11:58:00.000Z", erreur: "Pas de réseau : le personnage reste sur cet appareil, « non envoyé »." } } }],
        brouillons: [],
        illisibles: 0,
        ancienneCle: 2,
      },
    });
    contexte.etat.depot = depot;
    const ecran = await liste(contexte);
    const rubriques = ecran.querySelectorAll(".titre-rubrique").map(texteDe);
    assert.deepEqual(rubriques, ["En ligne", "Sur cet appareil : non envoyés", "Brouillons"]);
    assert.match(texteDe(carteDe(ecran, "Bourrache")), /visible par tous d'ici quelques minutes/);
    assert.match(texteDe(carteDe(ecran, "Aubépine Crèmebrûlée")), /en ligne · enregistré le 30\/09\/2026/);
    assert.match(texteDe(carteDe(ecran, "Cerfeuil")), /non envoyé : Pas de réseau/);
    assert.match(texteDe(ecran), /2 personnages en ligne sont chiffrés avec une ancienne clé de table : l'auteur doit les rechiffrer\./);
    // Réessayer.
    await Promise.all(boutons(carteDe(ecran, "Cerfeuil"), "Réessayer")[0].click());
    assert.deepEqual(depot.appels.at(-1), ["reessayer", "CCCCCCCCCCCCCCCCCCCCCC"]);
    // Supprimer pour tous, après confirmation.
    const carte = carteDe(ecran, "Aubépine Crèmebrûlée");
    boutons(carte, "Supprimer")[0].click();
    assert.match(texteDe(carte), /Supprimer « Aubépine Crèmebrûlée » pour tous les joueurs \? L'historique de GitHub garde chaque version : l'auteur peut la restaurer\./);
    await Promise.all(boutons(carte, "Supprimer")[1].click());
    assert.deepEqual(depot.appels.at(-1), ["supprimer", "AAAAAAAAAAAAAAAAAAAAAA"]);
    // « Modifier » sur un personnage en ligne : une copie de travail sur l'appareil.
    await Promise.all(boutons(carteDe(ecran, "Bourrache"), "Modifier")[0].click());
    await laisserFiler(10);
    const idCopie = contexte.navigations.at(-1).match(/^#\/personnage\/([A-Za-z0-9_-]+)\/etape\/1$/)[1];
    assert.equal((await contexte.etat.etagere.lireNote(idCopie)).remplace, "BBBBBBBBBBBBBBBBBBBBBB");

    // La démonstration le dit ; un dépôt fermé aussi.
    const demo = contexteDe();
    demo.etat.depot = faussePorte({ raison: "La démonstration ne dépose rien en ligne : ses personnages restent sur cet appareil.", vue: { enLigne: [], attente: [], nonEnvoyes: [], brouillons: [], illisibles: 0, ancienneCle: 0 } });
    assert.match(texteDe(await liste(demo)), /La démonstration ne dépose rien en ligne/);
  } finally {
    retirer();
  }
});

test("parcours — enregistrer dépose en ligne : « creer » pour un nouveau, « remplacer » pour une copie de travail ; l'étape 9 le dit", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const depot = faussePorte();
    contexte.etat.depot = depot;
    const personnage = await garde(contexte, personnageEssai());
    let ecran = await etape(contexte, personnage.id, 9);
    assert.match(texteDe(ecran), /visible par tous d'ici quelques minutes/);
    await Promise.all(boutons(ecran, "Enregistrer")[0].click());
    await laisserFiler(10);
    assert.deepEqual(depot.appels, [["envoyer", personnage.id, "creer"]]);
    // Modifier, puis Enregistrer : « remplacer », sous l'identifiant de l'original.
    ecran = await etape(contexte, personnage.id, 1);
    await Promise.all(boutons(ecran, "Modifier")[0].click());
    await laisserFiler(10);
    const idCopie = contexte.navigations.at(-1).match(/^#\/personnage\/([A-Za-z0-9_-]+)\/etape\/1$/)[1];
    ecran = await etape(contexte, idCopie, 9);
    await Promise.all(boutons(ecran, "Enregistrer")[0].click());
    await laisserFiler(10);
    assert.deepEqual(depot.appels.at(-1), ["envoyer", personnage.id, "remplacer"]);
  } finally {
    retirer();
  }
});

// ─── La relecture finale du lot 2 bis ───────────────────────────────────────

test("relecture — étape 8 : après « + », le focus reste sur « + » tant qu'il est actif ; les descriptions gardent leur état", async () => {
  const retirer = installerDom();
  const avant = globalThis.matchMedia;
  try {
    globalThis.matchMedia = (requete) => ({ matches: requete.includes("max-width") });
    const contexte = contexteDe();
    // Un personnage neuf : le seul bloc de base, 2 points dépensés, 8 de reliquat.
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 8);
    const ligne = () => ecran.querySelectorAll(".capacite-ligne").find((l) => texteDe(l.querySelector("strong")) === "Taloche");
    const plus = () => ligne().querySelectorAll("button").find((b) => b.id.endsWith("-plus"));
    // Sur téléphone, repliées ; le joueur déplie « Après l'évolution ».
    const apres = () => ligne().querySelectorAll("details")[1];
    assert.equal(apres().getAttribute("open"), null);
    apres().setAttribute("open", "");
    plus().click();
    await laisserFiler(10);
    assert.match(texteDe(ligne().querySelector(".valeur-pas")), /niveau 2/);
    assert.equal(plus().disabled, false, "le niveau 3 reste permis");
    assert.equal(document.activeElement?.id, plus().id, "le focus reste sur « + »");
    assert.notEqual(apres().getAttribute("open"), null, "la description dépliée le reste");
  } finally {
    globalThis.matchMedia = avant;
    retirer();
  }
});

test("relecture — étape 5 : « — choisir — » ne défait ni la constellation ni le compte des tirages", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 5);
    boutons(ecran, "Tirer au sort")[0].click();
    boutons(ecran, "Refaire le tirage")[0].click();
    boutons(ecran, "Refaire le tirage")[0].click();
    saisir(ecran.querySelector("#constellation-saisie"), "Constellation de la Cuillère", "change");
    saisir(ecran.querySelector("#constellation-saisie"), "", "change");
    await laisserFiler(10);
    assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).constellation, { nom: "Constellation de la Cuillère", choix: [], obtention: "saisie", tirages: 3 });
    boutons(ecran, "Tirer au sort")[0].click();
    await laisserFiler(10);
    assert.equal((await contexte.etat.etagere.lire(personnage.id)).constellation.tirages, 4);
  } finally {
    retirer();
  }
});

test("relecture — étape 7 : les armes et l'objet choisi décrits avant d'être pris ; un refus dit près de l'objet, le focus sur lui", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const personnage = await garde(contexte, nouveauPersonnage("demo"));
    const ecran = await etape(contexte, personnage.id, 7);
    const catalogue = ecran.querySelector(".catalogue");
    assert.match(texteDe(catalogue.querySelector("summary")), /^Les \d+ armes et ce qu'elles donnent$/);
    assert.ok(catalogue.querySelectorAll(".capacite-texte").some((p) => /inflige 3\/8\/20/.test(texteDe(p))), "le couteau d'office, décrit");
    // L'objet choisi se décrit avant « Ajouter ».
    saisir(ecran.querySelector("#objet-a-ajouter"), "Bouillon revigorant", "change");
    assert.match(texteDe(ecran.querySelector(".apercu-objet")), /Boire le bouillon/);
    // « Ajouter » sans choix : le refus sous le bouton, le focus sur lui.
    saisir(ecran.querySelector("#objet-a-ajouter"), "", "change");
    boutons(ecran, "Ajouter")[0].click();
    assert.equal(texteDe(document.activeElement), "Choisissez d'abord un objet dans la liste.");
    // « Porter » refusé : le refus dans la carte de l'objet.
    ecran.querySelector("#pack-agile").checked = true;
    ecran.querySelector("#pack-agile").declencher("change");
    await laisserFiler(10);
    saisir(ecran.querySelector("#objet-a-ajouter"), "Plastron de fonte", "change");
    boutons(ecran, "Ajouter")[0].click();
    await laisserFiler(10);
    parLibelle(ecran, "Porter Plastron de fonte").click();
    const carte = ecran.querySelectorAll(".objet").find((c) => texteDe(c.querySelector("h4")).startsWith("Plastron de fonte"));
    assert.match(texteDe(alerte(carte)), /ne se porte pas : torse déjà couvert par « Tablier de cuir »/);
    assert.equal(document.activeElement, alerte(carte));
  } finally {
    retirer();
  }
});

test("relecture — une copie de travail dont l'original ne se lit pas pour l'instant le remplace quand même, par son identifiant", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe();
    const depot = faussePorte();
    depot.chercher = async () => ({ erreur: "Pas de réseau : les personnages en ligne ne se lisent pas." });
    contexte.etat.depot = depot;
    const original = personnageEssai((p) => Object.assign(p, { id: "AAAAAAAAAAAAAAAAAAAAAA", etat: "enregistre", enregistre_le: "2026-09-29T20:30:00.000Z" }));
    const copie = await garde(contexte, { ...structuredClone(original), id: "BBBBBBBBBBBBBBBBBBBBBB", etat: "brouillon", etape: 9 });
    await contexte.etat.etagere.garderNote(copie.id, { remplace: original.id, nom: original.identite.nom });
    const ecran = await etape(contexte, copie.id, 9);
    assert.match(texteDe(ecran.querySelector("h1")), /^Modification — /);
    assert.match(texteDe(ecran), /« Enregistrer » remplace « Aubépine Crèmebrûlée »/);
    await Promise.all(boutons(ecran, "Enregistrer")[0].click());
    await laisserFiler(10);
    assert.deepEqual(depot.appels.at(-1), ["envoyer", original.id, "remplacer"]);
    const enregistre = await contexte.etat.etagere.lire(original.id);
    assert.deepEqual([enregistre.etat, enregistre.cree_le, enregistre.enregistre_le], ["enregistre", original.cree_le, original.enregistre_le]);
    assert.equal(await contexte.etat.etagere.lire(copie.id), null);
  } finally {
    retirer();
  }
});

test("relecture — la liste dit qu'un autre onglet bloque la base des personnages", async () => {
  const retirer = installerDom();
  try {
    const etagere = { ...creerEtagere(magasinPersonnagesMemoire(), "demo"), bloquee: "Un autre onglet de l'Atelier, ouvert sur une version précédente, bloque la mise à jour des personnages de cet appareil : fermez-le, puis rechargez cette page." };
    const ecran = await liste(contexteDe({ etagere }));
    assert.match(texteDe(alerte(ecran)), /Un autre onglet de l'Atelier/);
    assert.doesNotMatch(texteDe(ecran), /Cet appareil ne garde rien/);
  } finally {
    retirer();
  }
});

test("relecture — la liste : la clé changée pendant la visite, une suppression illisible, une copie plus ancienne", async () => {
  const retirer = installerDom();
  try {
    const contexte = contexteDe({ mode: "reel", etagere: creerEtagere(magasinPersonnagesMemoire(), "reel") });
    const ancienne = personnageEssai((p) => Object.assign(p, { id: "CCCCCCCCCCCCCCCCCCCCCC", mode: "reel", etat: "enregistre", enregistre_le: "2026-09-30T10:00:00.000Z" }));
    await contexte.etat.etagere.garder(ancienne);
    const appels = [];
    let force = null;
    contexte.etat.depot = {
      raison: null,
      phraseEnregistrement: "",
      async envoyer(p, options) {
        appels.push(["envoyer", p.id, options.forcer]);
        if (!options.forcer) return { envoye: false, erreur: "Une version plus récente de ce personnage est en ligne : l'envoyer la remplacerait.", plusAncienne: true };
        force = p.id;
        return { envoye: true };
      },
      async reessayer(id) {
        appels.push(["reessayer", id]);
        return { envoye: true };
      },
      async rapprocher() {
        return {
          enLigne: [],
          attente: [],
          nonEnvoyes: [
            ...((await contexte.etat.etagere.lire(ancienne.id)) ? [{ personnage: await contexte.etat.etagere.lire(ancienne.id), note: undefined, plusAncienne: true }] : []),
            { personnage: null, note: { id: "DDDDDDDDDDDDDDDDDDDDDD", nom: "Cerfeuil", depot: { etat: "non_envoye", action: "supprimer", ticket: null, date: "2026-09-30T11:00:00.000Z", erreur: "Pas de réseau" } }, suppression: true },
          ],
          brouillons: [],
          illisibles: 0,
          ancienneCle: 0,
          cleChangee: 3,
        };
      },
    };
    const ecran = await liste(contexte);
    assert.match(texteDe(ecran), /Le mot de passe de table a changé : rechargez la page et saisissez le nouveau\. \(3 personnages en ligne attendent la nouvelle clé\.\)/);
    assert.doesNotMatch(texteDe(ecran), /l'auteur doit les rechiffrer/);
    // La suppression dont le personnage ne se lit plus : son nom vient de la note.
    const suppression = carteDe(ecran, "Cerfeuil");
    assert.match(texteDe(suppression), /suppression non envoyée : Pas de réseau/);
    await Promise.all(boutons(suppression, "Réessayer la suppression")[0].click());
    assert.deepEqual(appels.at(-1), ["reessayer", "DDDDDDDDDDDDDDDDDDDDDD"]);
    // La copie plus ancienne : dite telle, l'envoi demande confirmation.
    const copie = carteDe(await liste(contexte), "Aubépine Crèmebrûlée");
    assert.match(texteDe(copie), /copie de cet appareil, plus ancienne que la version en ligne/);
    await Promise.all(boutons(copie, "Envoyer en ligne")[0].click());
    await laisserFiler(10);
    assert.match(texteDe(copie), /Une version plus récente de « Aubépine Crèmebrûlée » est en ligne\. L'envoyer quand même la remplacera pour tous/);
    assert.equal(force, null, "rien n'est parti sans confirmation");
    await Promise.all(boutons(copie, "Envoyer quand même")[0].click());
    await laisserFiler(10);
    assert.equal(force, ancienne.id);
    // « Retirer de l'appareil » : la copie s'en va, la version en ligne reste.
    const encore = carteDe(await liste(contexte), "Aubépine Crèmebrûlée");
    await Promise.all(boutons(encore, "Retirer de l'appareil")[0].click());
    await laisserFiler(10);
    assert.equal(await contexte.etat.etagere.lire(ancienne.id), null);
  } finally {
    retirer();
  }
});
