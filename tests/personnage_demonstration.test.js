// Contrôles du personnage de démonstration partagé (SPECIFICATION.md,
// § 15.7 et § 15.1 ; contrat du lot 4, groupe 2, § 12.4 ; compl. § 5.1).
//
// La lecture du fichier, sans écran : demandée sans cache, une réponse
// refusée, une levée, un corps qui ne se lit pas, un fichier illisible ou de
// l'autre mode, un bon fichier ; le fetch prêté, celui de la page à défaut.
// La phrase du personnage gardé. La question du doublon, dont le focus se
// pose sans défiler quand on le demande, et seulement alors. L'écran
// Personnages qui passe par elles sans changer. fetch est simulé ; les
// personnages sont celui d'essai et le fichier de démonstration du dépôt,
// lu sur le disque ; ils vivent dans une étagère en mémoire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ecrirePersonnage, lirePersonnage } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { el } from "../js/ecrans/dom.js";
import { FICHIER_DEMO, lirePersonnageDeDemonstration, phraseDuPersonnageGarde } from "../js/ecrans/partage.js";
import { afficher, garderRecu } from "../js/ecrans/personnages.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
// Le chemin écrit ici, et non lu dans FICHIER_DEMO : un chemin faux se voit
// au contrôle, sans empêcher les autres de tourner.
const TEXTE_DEMO = readFileSync(new URL("essais/personnage_demo.arpenteur.json", RACINE), "utf8");
const INTROUVABLE = { erreur: "Le personnage de démonstration est introuvable sur ce site." };
const SANS_CACHE = { cache: "no-store" };

// Un fetch simulé : chaque demande relevée ([adresse, init]) ; la fabrique
// rend la réponse, ou lève.
function simuler(fabrique) {
  const demandes = [];
  const fetch = async (adresse, init) => {
    demandes.push([adresse, init]);
    return fabrique();
  };
  return { fetch, demandes };
}

const reponseDe = (texte, status = 200) => () => new Response(texte, { status });

// Une étagère en mémoire, en démonstration, et ce qu'elle garde déjà.
async function etagereAvec(...personnages) {
  const etagere = creerEtagere(magasinPersonnagesMemoire(), "demo");
  for (const personnage of personnages) await etagere.garder(personnage);
  return etagere;
}

const noms = async (etagere) => (await etagere.lister()).personnages.map((p) => p.identite.nom).sort();
const alerte = (noeud) => [...noeud.querySelectorAll("[role]")].find((e) => e.getAttribute("role") === "alert") ?? null;
const statut = (noeud) => [...noeud.querySelectorAll("[role]")].find((e) => e.getAttribute("role") === "status" && e.className === "message") ?? null;

// ─── La lecture ─────────────────────────────────────────────────────────────

test("démonstration — le fichier se demande sans cache ; un bon fichier rend { personnage }, et lui seul", async () => {
  assert.equal(FICHIER_DEMO, "essais/personnage_demo.arpenteur.json");

  const essai = ecrirePersonnage(personnageEssai());
  const { fetch, demandes } = simuler(reponseDe(essai));
  const lu = await lirePersonnageDeDemonstration("demo", { fetch });
  assert.deepEqual(demandes, [[FICHIER_DEMO, SANS_CACHE]], "une demande, sans cache, et rien d'autre dans init");
  assert.deepEqual(Object.keys(lu), ["personnage"]);
  assert.deepEqual(lu.personnage, lirePersonnage(essai, { mode: "demo" }).personnage);

  // Le fichier du dépôt, tel que le site le sert.
  const depot = simuler(reponseDe(TEXTE_DEMO));
  const demo = await lirePersonnageDeDemonstration("demo", { fetch: depot.fetch });
  assert.deepEqual(Object.keys(demo), ["personnage"]);
  assert.equal(demo.personnage.identite.nom, "Aubépine Crèmebrûlée");
  assert.equal(demo.personnage.mode, "demo");
});

test("démonstration — une réponse refusée, une levée, un corps qui ne se lit pas : « introuvable sur ce site »", async () => {
  for (const [cas, fabrique] of [
    ["404", reponseDe("Not Found", 404)],
    ["503, même avec un bon corps", reponseDe(TEXTE_DEMO, 503)],
    [
      "levée",
      () => {
        throw new TypeError("Failed to fetch");
      },
    ],
    [
      "corps qui ne se lit pas",
      () => ({
        ok: true,
        status: 200,
        text: async () => {
          throw new TypeError("network error");
        },
      }),
    ],
  ]) {
    const { fetch, demandes } = simuler(fabrique);
    assert.deepEqual(await lirePersonnageDeDemonstration("demo", { fetch }), INTROUVABLE, cas);
    assert.equal(demandes.length, 1, cas);
  }
});

test("démonstration — un fichier illisible ou de l'autre mode : « illisible : » suivi de la raison de format.js", async () => {
  for (const [cas, texte, mode] of [
    ["JSON illisible", "<html>", "demo"],
    ["un champ manquant", JSON.stringify({ format: 2 }), "demo"],
    ["le personnage de démonstration lu hors de la démonstration", TEXTE_DEMO, "reel"],
  ]) {
    const raison = lirePersonnage(texte, { mode }).erreur;
    assert.ok(raison, cas);
    const { fetch } = simuler(reponseDe(texte));
    assert.deepEqual(await lirePersonnageDeDemonstration(mode, { fetch }), { erreur: `Le personnage de démonstration est illisible : ${raison}` }, cas);
  }
});

test("démonstration — sans fetch prêté, celui de la page ; un fetch prêté passe avant lui ; sans fetch du tout, introuvable", async () => {
  const avant = globalThis.fetch;
  try {
    const page = simuler(reponseDe(TEXTE_DEMO));
    globalThis.fetch = page.fetch;
    assert.ok((await lirePersonnageDeDemonstration("demo")).personnage, "sans options");
    assert.ok((await lirePersonnageDeDemonstration("demo", {})).personnage, "options vides");
    assert.deepEqual(page.demandes, [
      [FICHIER_DEMO, SANS_CACHE],
      [FICHIER_DEMO, SANS_CACHE],
    ]);

    const prete = simuler(reponseDe(TEXTE_DEMO));
    assert.ok((await lirePersonnageDeDemonstration("demo", { fetch: prete.fetch })).personnage);
    assert.equal(prete.demandes.length, 1);
    assert.equal(page.demandes.length, 2, "le fetch de la page n'est pas appelé quand un autre est prêté");

    globalThis.fetch = undefined;
    assert.deepEqual(await lirePersonnageDeDemonstration("demo"), INTROUVABLE);
  } finally {
    globalThis.fetch = avant;
  }
});

// ─── La phrase ──────────────────────────────────────────────────────────────

test("démonstration — la phrase du personnage gardé : son nom sans blancs de bord, « Sans nom » à défaut", () => {
  const phrases = [
    [personnageEssai(), "Le personnage « Aubépine Crèmebrûlée » est sur cet appareil."],
    [personnageEssai((p) => (p.identite.nom = "  Aubépine Fleurdesel\t ")), "Le personnage « Aubépine Fleurdesel » est sur cet appareil."],
    [personnageEssai((p) => (p.identite.nom = "")), "Le personnage « Sans nom » est sur cet appareil."],
    [personnageEssai((p) => (p.identite.nom = " \n ")), "Le personnage « Sans nom » est sur cet appareil."],
  ];
  for (const [personnage, attendue] of phrases) {
    const phrase = phraseDuPersonnageGarde(personnage);
    assert.equal(phrase, attendue);
    assert.doesNotMatch(phrase, /[\u00a0\u202f]/, "ni U+00A0 ni U+202F");
  }
});

// ─── La question du doublon ─────────────────────────────────────────────────

test("démonstration — garderRecu : sansDefiler pose le focus de la question sans défiler ; sans l'option, le focus d'avant", async () => {
  const retirer = installerDom();
  try {
    for (const [cas, options, attendues] of [
      ["sansDefiler", [{ sansDefiler: true }], { preventScroll: true }],
      ["sansDefiler faux", [{ sansDefiler: false }], undefined],
      ["options vides", [{}], undefined],
      ["sans options", [], undefined],
    ]) {
      const etagere = await etagereAvec(personnageEssai());
      const zone = el("div", {});
      document.body.replaceChildren(zone);
      const avant = document.focalisations.length;
      const garde = garderRecu(etagere, personnageEssai(), zone, ...options);
      await laisserFiler(10);
      const [annuler] = boutons(zone, "Annuler");
      const relevees = document.focalisations.slice(avant);
      assert.equal(relevees.length, 1, `${cas} : un seul focus`);
      assert.equal(relevees[0].noeud, annuler, `${cas} : sur « Annuler »`);
      assert.deepEqual(relevees[0].options, attendues, cas);
      assert.equal(document.activeElement, annuler, cas);
      annuler.click();
      assert.equal(await garde, null, cas);
    }
    assert.equal(document.defilements.length, 0, "aucun défilement demandé");
  } finally {
    retirer();
  }
});

test("démonstration — garderRecu sans défiler : pas de doublon, gardé sans question ; sinon la question dans la zone donnée, et chaque réponse", async () => {
  const retirer = installerDom();
  try {
    // Aucun doublon : gardé tout de suite, sans question ni focus.
    {
      const etagere = await etagereAvec();
      const zone = el("div", {});
      document.body.replaceChildren(zone);
      const avant = document.focalisations.length;
      const recu = personnageEssai();
      assert.equal(await garderRecu(etagere, recu, zone, { sansDefiler: true }), recu);
      assert.equal(zone.children.length, 0, "aucune question");
      assert.equal(document.focalisations.length, avant, "aucun focus");
      assert.deepEqual(await noms(etagere), ["Aubépine Crèmebrûlée"]);
    }

    // Un doublon : la question s'ouvre dans la zone donnée.
    const questionner = async () => {
      const etagere = await etagereAvec(personnageEssai());
      const zone = el("div", {});
      document.body.replaceChildren(zone);
      const recu = personnageEssai((p) => (p.identite.nom = "Aubépine Fleurdesel"));
      const garde = garderRecu(etagere, recu, zone, { sansDefiler: true });
      await laisserFiler(10);
      return { etagere, zone, recu, garde };
    };

    let question = await questionner();
    assert.deepEqual([...question.zone.querySelectorAll("button")].map(texteDe), ["Remplacer", "Garder les deux", "Annuler"]);
    assert.match(texteDe(question.zone), /Ce personnage est déjà sur cet appareil\. Le remplacer est définitif\./);
    boutons(question.zone, "Garder les deux")[0].click();
    const lesDeux = await question.garde;
    assert.notEqual(lesDeux.id, question.recu.id, "« Garder les deux » : un nouvel identifiant");
    assert.equal(lesDeux.identite.nom, "Aubépine Fleurdesel");
    assert.equal(question.zone.children.length, 0, "la question se ferme");
    assert.deepEqual(await noms(question.etagere), ["Aubépine Crèmebrûlée", "Aubépine Fleurdesel"]);

    question = await questionner();
    boutons(question.zone, "Remplacer")[0].click();
    const remplace = await question.garde;
    assert.equal(remplace.id, question.recu.id, "« Remplacer » : le même identifiant");
    assert.equal(question.zone.children.length, 0, "la question se ferme");
    assert.deepEqual(await noms(question.etagere), ["Aubépine Fleurdesel"]);

    question = await questionner();
    boutons(question.zone, "Annuler")[0].click();
    assert.equal(await question.garde, null, "« Annuler » : rien de gardé");
    assert.equal(question.zone.children.length, 0, "la question se ferme");
    assert.deepEqual(await noms(question.etagere), ["Aubépine Crèmebrûlée"], "rien n'est écrit");
  } finally {
    retirer();
  }
});

// ─── L'écran Personnages ────────────────────────────────────────────────────

function contexteDe(etagere) {
  return { etat: { mode: "demo", banque: { blocs: [] }, etagere }, naviguer() {}, afficher() {} };
}

async function montrer(contexte) {
  const ecran = afficher(contexte);
  document.body.replaceChildren(ecran);
  await laisserFiler(10);
  return ecran;
}

test("démonstration — l'écran Personnages passe par la lecture partagée sans changer : la question, son focus d'avant, la phrase, l'alerte", async () => {
  const retirer = installerDom();
  const avant = globalThis.fetch;
  try {
    const page = simuler(reponseDe(TEXTE_DEMO));
    globalThis.fetch = page.fetch;
    const contexte = contexteDe(await etagereAvec(personnageEssai()));
    const ecran = await montrer(contexte);
    const focus = document.focalisations.length;
    const clic = boutons(ecran, "Ajouter le personnage de démonstration")[0].click();
    await laisserFiler(10);
    assert.deepEqual(page.demandes, [[FICHIER_DEMO, SANS_CACHE]]);

    // Le même identifiant : la question, et son focus d'avant (sans option).
    const relevees = document.focalisations.slice(focus);
    assert.equal(relevees.length, 1);
    assert.equal(relevees[0].noeud, boutons(ecran, "Annuler")[0]);
    assert.equal(relevees[0].options, undefined, "l'écran Personnages garde le focus d'avant");
    boutons(ecran, "Garder les deux")[0].click();
    await Promise.all(clic);
    await laisserFiler(10);
    assert.equal(texteDe(statut(ecran)), "Le personnage « Aubépine Crèmebrûlée » est sur cet appareil.");
    assert.deepEqual(await noms(contexte.etat.etagere), ["Aubépine Crèmebrûlée", "Aubépine Crèmebrûlée"]);

    // Le fichier absent : l'alerte, mot pour mot, et rien de gardé.
    globalThis.fetch = simuler(reponseDe("Not Found", 404)).fetch;
    const sansFichier = contexteDe(await etagereAvec());
    const autre = await montrer(sansFichier);
    await Promise.all(boutons(autre, "Ajouter le personnage de démonstration")[0].click());
    assert.equal(texteDe(alerte(autre)), INTROUVABLE.erreur);
    assert.deepEqual(await noms(sansFichier.etat.etagere), []);
  } finally {
    globalThis.fetch = avant;
    retirer();
  }
});

test("démonstration — personnages.js ne lit plus le fichier lui-même : il passe par partage.js", () => {
  const source = readFileSync(new URL("js/ecrans/personnages.js", RACINE), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/, "aucun fetch dans l'écran");
  assert.doesNotMatch(source, /personnage_demo\.arpenteur\.json|FICHIER_DEMO/, "le chemin du fichier a quitté l'écran");
  assert.match(source, /import \{[^}]*\blirePersonnageDeDemonstration\b[^}]*\} from "\.\/partage\.js";/);
  assert.match(source, /import \{[^}]*\bphraseDuPersonnageGarde\b[^}]*\} from "\.\/partage\.js";/);
});
