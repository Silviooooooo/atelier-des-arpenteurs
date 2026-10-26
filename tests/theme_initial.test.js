// Contrôles du thème au premier affichage (SPECIFICATION.md, § 9 et
// § 10.1) : js/apparence/theme_initial.js, sa table comparée au catalogue
// de js/apparence/themes.js, son exécution telle quelle dans un contexte à
// part (node:vm), avec un faux localStorage et un faux document fait des
// balises <meta> d'index.html, puis sa place dans la page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { THEMES } from "../js/apparence/themes.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const SCRIPT = lire("js/apparence/theme_initial.js");
const INDEX = lire("index.html");
const TETE = INDEX.slice(INDEX.indexOf("<head>"), INDEX.indexOf("</head>"));

const CLE = "atelier.theme";
// Les trente-six thèmes qui s'appliquent par data-theme : tous, sauf les
// deux entrées « Atelier ».
const APPLIQUES = THEMES.filter((theme) => theme.code !== "atelier-clair" && theme.code !== "atelier-sombre");

// Les attributs d'une balise : { nom: valeur }.
const attributsDe = (balise) => Object.fromEntries([...balise.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].slice(1).map(([, nom, valeur]) => [nom.toLowerCase(), valeur ?? ""]));

// Un faux document : <html>, et les balises <meta> du <head> d'index.html,
// avec leurs attributs. Il ne comprend que « meta », suivi ou non de
// conditions [nom] ou [nom="valeur"] : un autre sélecteur lève une erreur,
// au lieu de ne rien trouver.
function fauxDocument() {
  const element = (balise, attributs) => {
    const valeurs = new Map(Object.entries(attributs));
    return {
      tagName: balise.toUpperCase(),
      valeurs,
      getAttribute: (nom) => valeurs.get(nom) ?? null,
      hasAttribute: (nom) => valeurs.has(nom),
      setAttribute: (nom, valeur) => void valeurs.set(nom, String(valeur)),
      removeAttribute: (nom) => void valeurs.delete(nom),
    };
  };
  const metas = [...TETE.matchAll(/<meta\b[^>]*>/g)].map(([balise]) => element("meta", attributsDe(balise)));
  const querySelectorAll = (selecteur) => {
    const forme = /^meta((?:\[[\w-]+(?:="[^"]*")?\])*)$/.exec(selecteur);
    if (!forme) throw new Error(`Sélecteur non pris en charge par le faux document : ${selecteur}`);
    const conditions = [...forme[1].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map(([, nom, valeur]) => [nom, valeur]);
    return metas.filter((meta) => conditions.every(([nom, valeur]) => (valeur === undefined ? meta.hasAttribute(nom) : meta.getAttribute(nom) === valeur)));
  };
  return {
    documentElement: element("html", { lang: "fr" }),
    metas,
    querySelectorAll,
    querySelector: (selecteur) => querySelectorAll(selecteur)[0] ?? null,
  };
}

// Un stockage qui garde des valeurs brutes, et relève les clés lues.
const stockage = (valeurs, lues = []) => () => ({
  getItem: (cle) => {
    lues.push(cle);
    return Object.hasOwn(valeurs, cle) ? valeurs[cle] : null;
  },
});

// La page ouverte, le script exécuté tel quel : ce que deviennent <html> et
// les balises <meta>. acces : ce que rend la lecture de localStorage (une
// fonction, qui peut lever) ; sans acces, localStorage n'existe pas.
function ouvrir(acces) {
  const document = fauxDocument();
  const contexte = vm.createContext({ document });
  if (acces) vm.runInContext('(acces) => Object.defineProperty(globalThis, "localStorage", { get: acces, configurable: true })', contexte)(acces);
  const nomsAvant = Object.getOwnPropertyNames(contexte);
  vm.runInContext(SCRIPT, contexte, { filename: "js/apparence/theme_initial.js" });
  return {
    theme: document.documentElement.getAttribute("data-theme"),
    // [media, content] de chaque balise theme-color, dans l'ordre de la page.
    teintes: document.metas.filter((meta) => meta.getAttribute("name") === "theme-color").map((meta) => [meta.getAttribute("media"), meta.getAttribute("content")]),
    // Toutes les balises <meta>, hors theme-color, telles quelles.
    autres: document.metas.filter((meta) => meta.getAttribute("name") !== "theme-color").map((meta) => Object.fromEntries(meta.valeurs)),
    nomsAvant,
    contexte,
  };
}

// La page en « Atelier », telle que l'écrit index.html.
const ATELIER = ouvrir(stockage({}));
const AUTRES_METAS = [...TETE.matchAll(/<meta\b[^>]*>/g)].map(([balise]) => attributsDe(balise)).filter((meta) => meta.name !== "theme-color");

test("thème initial — la table : le fond des trente-six thèmes appliqués, code pour code, dans l'ordre du catalogue", () => {
  assert.equal(THEMES.length, 38);
  assert.equal(APPLIQUES.length, 36);
  const table = [...SCRIPT.matchAll(/\["([^"]*)", "([^"]*)"\]/g)].map(([, code, fond]) => [code, fond]);
  assert.deepEqual(table, APPLIQUES.map((theme) => [theme.code, theme.jetons.fond]));
  for (const [, fond] of table) assert.match(fond, /^#[0-9a-f]{6}$/);
  assert.ok(!SCRIPT.includes('"atelier-clair"') && !SCRIPT.includes('"atelier-sombre"'), "« Atelier » n'est jamais appliqué par data-theme");
});

test("thème initial — un code connu pose data-theme sur <html> et son fond dans les deux balises theme-color", () => {
  assert.deepEqual(ATELIER.teintes, [
    ["(prefers-color-scheme: light)", "#ffffff"],
    ["(prefers-color-scheme: dark)", "#15171a"],
  ]);
  for (const theme of APPLIQUES) {
    const lues = [];
    const page = ouvrir(stockage({ [CLE]: theme.code, theme: "neon" }, lues));
    assert.deepEqual(lues, [CLE], theme.code);
    assert.equal(page.theme, theme.code);
    assert.deepEqual(page.teintes, [
      ["(prefers-color-scheme: light)", theme.jetons.fond],
      ["(prefers-color-scheme: dark)", theme.jetons.fond],
    ], theme.code);
    assert.deepEqual(page.autres, AUTRES_METAS, theme.code);
  }
});

test("thème initial — une valeur absente, inconnue ou illisible laisse la page en « Atelier »", () => {
  const intacte = (page, cas) => {
    assert.equal(page.theme, null, cas);
    assert.deepEqual(page.teintes, ATELIER.teintes, cas);
    assert.deepEqual(page.autres, AUTRES_METAS, cas);
  };
  intacte(ATELIER, "clé absente");
  // Ni « Atelier », ni la casse, ni une espace, ni du JSON (la valeur est
  // brute), ni un nom que tout objet porte.
  for (const valeur of ["", "inconnu", "atelier-clair", "atelier-sombre", "atelier", "Taverne", "TAVERNE", " taverne", "taverne ", '"taverne"', "toString", "constructor", "__proto__", "hasOwnProperty"]) {
    intacte(ouvrir(stockage({ [CLE]: valeur })), `« ${valeur} »`);
  }
  // Le thème gardé sous une autre clé ne compte pas.
  intacte(ouvrir(stockage({ "atelier.themes": "taverne", "atelier-theme": "taverne", theme: "taverne" })), "autre clé");
  // Un stockage dont la lecture lève, un stockage refusé dès son accès, pas
  // de stockage du tout.
  intacte(ouvrir(() => ({ getItem: () => { throw new Error("lecture refusée"); } })), "getItem lève");
  intacte(ouvrir(() => { throw new Error("stockage refusé"); }), "localStorage lève");
  intacte(ouvrir(() => undefined), "localStorage indéfini");
  intacte(ouvrir(null), "localStorage absent");
});

test("thème initial — un script classique, sans import ni export, qui ne laisse aucun nom dans la page", () => {
  const sansCommentaires = SCRIPT.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(sansCommentaires, /\b(?:import|export)\b/);
  // Un module ne se compile pas en script classique : celui-ci, si.
  assert.doesNotThrow(() => new vm.Script(SCRIPT));
  // Aucune propriété ajoutée à l'objet global…
  const page = ouvrir(stockage({ [CLE]: "taverne" }));
  assert.deepEqual(Object.getOwnPropertyNames(page.contexte), page.nomsAvant);
  // … ni aucune déclaration de premier niveau, que deux scripts classiques
  // partageraient : une seconde exécution dans la même page passe.
  assert.doesNotThrow(() => vm.runInContext(SCRIPT, page.contexte));
  assert.deepEqual(Object.getOwnPropertyNames(page.contexte), page.nomsAvant);
});

test("thème initial — index.html le charge juste avant css/jetons.css, après la politique de sécurité et les deux theme-color, sans defer, async ni type=\"module\"", () => {
  const balise = '<script src="js/apparence/theme_initial.js"></script>';
  assert.equal(INDEX.split(balise).length, 2, "une seule fois, et sous cette forme exacte");
  // Les balises du <head>, dans l'ordre.
  const tete = [...TETE.matchAll(/<(meta|link|script|title)\b[^>]*>/g)].map(([texte, nom]) => ({ nom, texte, attributs: attributsDe(texte) }));
  const rang = tete.findIndex(({ nom, attributs }) => nom === "script" && attributs.src === "js/apparence/theme_initial.js");
  assert.ok(rang > 0, "dans le <head>");
  assert.deepEqual(Object.keys(tete[rang].attributs), ["src"], "ni defer, ni async, ni type");
  // Juste avant css/jetons.css, que css/themes.css suit aussitôt.
  assert.equal(tete[rang + 1].texte, '<link rel="stylesheet" href="css/jetons.css">');
  assert.equal(tete[rang + 2].texte, '<link rel="stylesheet" href="css/themes.css">');
  // Après la politique de sécurité et les deux theme-color ; avant toute
  // autre feuille et tout autre script.
  const rangs = (condition) => tete.flatMap((element, i) => (condition(element) ? [i] : []));
  const securite = rangs(({ attributs }) => attributs["http-equiv"] === "Content-Security-Policy");
  const teintes = rangs(({ attributs }) => attributs.name === "theme-color");
  assert.equal(securite.length, 1);
  assert.equal(teintes.length, 2);
  for (const i of [...securite, ...teintes]) assert.ok(i < rang, tete[i].texte);
  for (const i of rangs(({ nom, attributs }) => nom === "script" || attributs.rel === "stylesheet")) assert.ok(i >= rang, tete[i].texte);
});
