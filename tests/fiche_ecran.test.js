// Contrôles de l'étagère, des adresses, du partage et de l'écran de la
// fiche d'un personnage (SPECIFICATION.md, § 15.1, § 15.3, § 15.5, § 10.1
// et § 11, domaine « Personnage »), dans un document simulé.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { svg } from "../js/ecrans/dom.js";
import { lireFichierChoisi, panneauTelephone } from "../js/ecrans/partage.js";
import { TAILLE_MAX, lireCode } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { adressePersonnage, lireRoute } from "../js/routes.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", racine)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T22:34:07+02:00" };
const fichePersonnage = await import("../js/ecrans/fiche_personnage.js");

test("étagère — réel et démonstration séparés ; les plus récents d'abord ; un personnage illisible est compté, jamais rendu", async () => {
  const magasin = magasinPersonnagesMemoire();
  const demo = creerEtagere(magasin, "demo");
  const reel = creerEtagere(magasin, "reel");
  const a = personnageEssai((p) => (p.modifie_le = "2026-09-29T10:00:00.000Z"));
  const b = personnageEssai((p) => {
    p.id = "demo-second-000000000001";
    p.modifie_le = "2026-09-29T12:00:00.000Z";
  });
  await demo.garder(a);
  await demo.garder(b);
  assert.deepEqual((await demo.lister()).personnages.map((p) => p.id), [b.id, a.id]);
  assert.deepEqual(await reel.lister(), { personnages: [], illisibles: 0 });
  assert.equal(await reel.lire(a.id), null);
  await assert.rejects(reel.garder(a), /n'est pas de ce mode/);
  await assert.rejects(demo.garder({ ...a, pirate: 1 }), /le champ « pirate » est inconnu/);
  // Une donnée abîmée sur l'appareil (l'origine est partagée, § 7.3).
  await magasin.ecrire("demo", { id: "abime-00000000000000", format: 1, pirate: true });
  assert.deepEqual(await demo.lister().then((l) => [l.personnages.length, l.illisibles]), [2, 1]);
  assert.equal(await demo.lire("abime-00000000000000"), null);
  // Un personnage de démonstration posé dans l'entrepôt réel : illisible pour le réel.
  await magasin.ecrire("reel", a);
  assert.equal(await reel.lire(a.id), null);
  assert.deepEqual(await reel.lister().then((l) => [l.personnages.length, l.illisibles]), [0, 1]);
  await demo.effacer(a.id);
  assert.deepEqual((await demo.lister()).personnages.map((p) => p.id), [b.id]);
  assert.throws(() => creerEtagere(magasin, "admin"), /Mode inconnu/);
});

test("adresses — la liste, la fiche, les étapes 1 à 9, le lien reçu ; rien d'autre", () => {
  const id = "demo-aubepine-0000000001";
  assert.deepEqual(lireRoute("#/personnages"), { ecran: "personnages" });
  assert.deepEqual(lireRoute(`#/personnage/${id}`), { ecran: "personnage", id });
  assert.deepEqual(lireRoute(`#/personnage/${id}/etape/9`), { ecran: "creation", id, etape: 9 });
  assert.deepEqual(lireRoute("#/recevoir/abc-_9"), { ecran: "recevoir", code: "abc-_9" });
  for (const adresse of [`#/personnage/${id}/etape/0`, `#/personnage/${id}/etape/10`, "#/personnage/court", "#/personnage/__proto__", "#/recevoir/a%20b", "#/recevoir/", `#/personnage/${id}/autre`]) {
    assert.equal(lireRoute(adresse).ecran, "introuvable", adresse);
  }
  assert.equal(adressePersonnage(id), `#/personnage/${id}`);
  assert.equal(adressePersonnage(id, 3), `#/personnage/${id}/etape/3`);
});

test("dom — svg() : des formes et leur géométrie, jamais de gestionnaire, de style ni d'adresse", () => {
  const retirer = installerDom();
  try {
    const forme = svg("rect", { x: 1, y: 2, width: 3, height: 4, classe: "a" });
    assert.equal(forme.getAttribute("width"), "3");
    assert.equal(forme.getAttribute("class"), "a");
    for (const [balise, attributs] of [["script", {}], ["foreignObject", {}], ["a", {}], ["rect", { onclick: "x" }], ["rect", { style: "fill:red" }], ["rect", { href: "#" }], ["rect", { "xlink:href": "#" }]]) {
      assert.throws(() => svg(balise, attributs), /(?:non|pas) permis/, `${balise} ${JSON.stringify(attributs)}`);
    }
  } finally {
    retirer();
  }
});

test("partage — un fichier de plus de 64 Ko n'est pas même lu ; le lien garde le mode, et se relit", async () => {
  let lu = false;
  const gros = { size: TAILLE_MAX + 1, text: async () => ((lu = true), "") };
  assert.match((await lireFichierChoisi(gros, "demo")).erreur, /dépasse 64 Ko/);
  assert.equal(lu, false, "le fichier n'est pas lu");
  assert.match((await lireFichierChoisi(null, "demo")).erreur, /Aucun fichier/);
  const bon = { size: 10, text: async () => JSON.stringify(personnageEssai()) };
  assert.equal((await lireFichierChoisi(bon, "demo")).personnage.id, "demo-aubepine-0000000001");
  const retirer = installerDom();
  try {
    const presse = [];
    const panneau = panneauTelephone(personnageEssai(), {
      mode: "demo",
      emplacement: { origin: "https://silviooooooo.github.io", pathname: "/atelier-des-arpenteurs/" },
      navigateur: { clipboard: { writeText: async (t) => presse.push(t) } },
    });
    await laisserFiler(50);
    const adresse = panneau.querySelector("input").value;
    assert.match(adresse, /^https:\/\/silviooooooo\.github\.io\/atelier-des-arpenteurs\/\?demo=1#\/recevoir\/[A-Za-z0-9_-]+$/);
    assert.equal((await lireCode(adresse.split("#/recevoir/")[1], { mode: "demo" })).personnage.identite.nom, "Aubépine Crèmebrûlée");
    await Promise.all(panneau.querySelectorAll("button")[0].click());
    assert.deepEqual(presse, [adresse]);
    assert.match(texteDe(panneau), /Lien copié/);
  } finally {
    retirer();
  }
});

function contexteDe(etagere, banque = BANQUE) {
  return { etat: { mode: "demo", banque, etagere, chargement: { enveloppe: { empreinte: "x" } } }, naviguer() {}, afficher() {} };
}

test("écran de la fiche — vues lecture et fiche, « Imprimer / PDF », le recto et le verso toujours prêts à imprimer", async () => {
  const retirer = installerDom();
  globalThis.localStorage = { getItem: () => "lecture", setItem: () => {} };
  try {
    const etagere = creerEtagere(magasinPersonnagesMemoire(), "demo");
    await etagere.garder(personnageEssai());
    const ecran = fichePersonnage.afficher(contexteDe(etagere), { ecran: "personnage", id: "demo-aubepine-0000000001" });
    document.body.replaceChildren(ecran);
    await laisserFiler(20);
    assert.equal(texteDe(ecran.querySelector("h1")), "Aubépine Crèmebrûlée");
    const racine = ecran.querySelector(".ecran-personnage");
    assert.ok(racine.className.includes("vue-lecture"));
    const boutonsTextes = ecran.querySelectorAll("button").map(texteDe);
    for (const b of ["Vue lecture", "Vue fiche", "Imprimer / PDF", "Enregistrer le fichier", "Ouvrir sur mon téléphone"]) assert.ok(boutonsTextes.includes(b), b);
    assert.match(texteDe(ecran), /Reprendre la création/, "un brouillon se reprend");
    // En vue lecture, le recto et le verso sont là, pour l'impression.
    assert.ok(ecran.querySelector(".impression .recto"));
    assert.ok(ecran.querySelector(".impression .verso"));
    assert.ok(ecran.querySelector(".barre-personnage").className.includes("ne-pas-imprimer"));
    const vueFiche = ecran.querySelectorAll("button").find((b) => texteDe(b) === "Vue fiche");
    vueFiche.click();
    assert.ok(racine.className.includes("vue-fiche"));
    assert.equal(vueFiche.getAttribute("aria-pressed"), "true");
  } finally {
    delete globalThis.localStorage;
    retirer();
  }
});

test("écran de la fiche — introuvable sur l'appareil ; banque sans types : le message, et rien d'autre", async () => {
  const retirer = installerDom();
  try {
    const etagere = creerEtagere(magasinPersonnagesMemoire(), "demo");
    const absent = fichePersonnage.afficher(contexteDe(etagere), { ecran: "personnage", id: "demo-absent-000000000001" });
    document.body.replaceChildren(absent);
    await laisserFiler(20);
    assert.match(texteDe(absent), /Personnage introuvable/);
    const sansTypes = { ...BANQUE, blocs: BANQUE.blocs.map(({ type: _type, ...bloc }) => bloc) };
    const ecran = fichePersonnage.afficher(contexteDe(etagere, sansTypes), { ecran: "personnage", id: "demo-absent-000000000001" });
    assert.match(texteDe(ecran), /Le créateur a besoin d'une banque republiée depuis le classeur à jour\./);
  } finally {
    retirer();
  }
});

test("relecture — la mesure du recto lit les rubriques elles-mêmes, et une rubrique sans hauteur ne dit rien", () => {
  const { ajuster } = fichePersonnage;
  // Un recto dont le navigateur donnerait les hauteurs.
  const recto = (hauteurs) => ({
    querySelector: (selecteur) => (Object.hasOwn(hauteurs, selecteur) ? { clientHeight: hauteurs[selecteur][0], scrollHeight: hauteurs[selecteur][1] } : null),
  });
  let rendus = [];
  const conteneur = (suite) => ({
    querySelector: () => suite.shift() ?? null,
    replaceChildren: (noeud) => rendus.push(noeud),
  });
  const retirer = installerDom();
  try {
    const f = { groupes: { espece: [], archetype: [], style: [], constellation: [], acquises: [] }, constellation: null, equipement: [], liens: [], defense: { pieces: [] }, identite: { nom: "" }, caracteristiques: [], capacites: [], armes: [], attaque: {}, points: {}, ressources: {}, armure: { zones: {} }, avertissements: [], manques: [], banque: {} };
    // Les corps débordent mais pas les rubriques : rien.
    const sain = { ".rubrique-capacites": [319, 319], ".rubrique-equipement": [199, 199], ".rubrique-liens": [198, 198], ".rubrique-capacites .rubrique-corps": [300, 381] };
    rendus = [];
    assert.deepEqual(ajuster(conteneur([recto(sain)]), f, { capacites: 9, equipement: 8, pouvoirs: 3 }), { capacites: 9, equipement: 8, pouvoirs: 3 });
    assert.equal(rendus.length, 0);
    // La rubrique des capacités déborde : une place de moins, puis plus rien.
    const deborde = { ...sain, ".rubrique-capacites": [319, 381] };
    rendus = [];
    const places = ajuster(conteneur([recto(deborde), recto(sain)]), f, { capacites: 9, equipement: 8, pouvoirs: 3 });
    assert.deepEqual(places, { capacites: 8, equipement: 8, pouvoirs: 3 });
    assert.equal(rendus.length, 1);
    // Une fiche pas encore mise en page (hauteur nulle) : rien.
    rendus = [];
    ajuster(conteneur([recto({ ".rubrique-capacites": [0, 40] })]), f, { capacites: 9, equipement: 8, pouvoirs: 3 });
    assert.equal(rendus.length, 0);
  } finally {
    retirer();
  }
});

test("relecture — une fiche affichée remplace les écouteurs de la précédente", async () => {
  const retirer = installerDom();
  const poses = [];
  const avant = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame, fonts: document.fonts };
  globalThis.addEventListener = (type, f) => poses.push([type, f]);
  globalThis.removeEventListener = (type, f) => poses.splice(poses.findIndex(([t, g]) => t === type && g === f), 1);
  globalThis.requestAnimationFrame = () => 0;
  document.fonts = { ready: new Promise(() => {}), load: async () => [] };
  try {
    const etagere = creerEtagere(magasinPersonnagesMemoire(), "demo");
    await etagere.garder(personnageEssai());
    for (let i = 0; i < 3; i += 1) {
      const ecran = fichePersonnage.afficher(contexteDe(etagere), { ecran: "personnage", id: "demo-aubepine-0000000001" });
      document.body.replaceChildren(ecran);
      await laisserFiler(20);
    }
    assert.deepEqual(poses.map(([type]) => type).sort(), ["beforeprint", "resize"]);
  } finally {
    Object.assign(globalThis, { addEventListener: avant.add, removeEventListener: avant.remove, requestAnimationFrame: avant.raf });
    retirer();
  }
});
