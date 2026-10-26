// Contrôles de la page Apparence (SPECIFICATION.md, § 9 et § 10.1 ; mission
// du lot 5, § 3.7) : js/ecrans/apparence.js, construit dans le document
// simulé (tests/outils/dom_simule.js), auquel s'ajoutent ici les deux
// balises <meta name="theme-color"> d'index.html et document.querySelectorAll,
// qui lui manquent ; un faux localStorage, qui garde des valeurs brutes. Puis
// le bout en bout : js/apparence/theme_initial.js, joué tel quel dans
// node:vm, relit ce que l'écran a gardé. Enfin ce qu'application.js doit à
// l'écran (il s'ouvre sans banque), lu dans son texte, et sa feuille.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { FAMILLES, THEMES } from "../js/apparence/themes.js";
import { afficher } from "../js/ecrans/apparence.js";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const INDEX = lire("index.html");
const TETE = INDEX.slice(INDEX.indexOf("<head>"), INDEX.indexOf("</head>"));
const SCRIPT_INITIAL = lire("js/apparence/theme_initial.js");

const CLE = "atelier.theme";
const AIDE = "Un clic applique le thème à tout le site, aussitôt. Il se garde sur cet appareil : chaque joueur choisit le sien.";
const DESCRIPTION_ATELIER = "Le site d'aujourd'hui, clair ou sombre selon le réglage de l'appareil.";
// Les trente-six thèmes qui s'appliquent par data-theme, et leur ordre dans
// la page : famille après famille, le catalogue dans chacune.
const APPLIQUES = THEMES.filter((theme) => theme.code !== "atelier-clair" && theme.code !== "atelier-sombre");
const ORDRE_PAGE = FAMILLES.flatMap((famille) => APPLIQUES.filter((theme) => theme.famille === famille.code));
const PAR_CODE = new Map(APPLIQUES.map((theme) => [theme.code, theme]));

// Les attributs d'une balise : { nom: valeur }.
const attributsDe = (balise) => Object.fromEntries([...balise.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].slice(1).map(([, nom, valeur]) => [nom.toLowerCase(), valeur ?? ""]));
// Les deux balises theme-color d'index.html, telles qu'écrites.
const TEINTES = [...TETE.matchAll(/<meta\b[^>]*>/g)].map(([balise]) => attributsDe(balise)).filter((meta) => meta.name === "theme-color");
const TEINTES_ATELIER = [
  ["(prefers-color-scheme: light)", "#ffffff"],
  ["(prefers-color-scheme: dark)", "#15171a"],
];

// Un faux localStorage : des valeurs brutes, et le relevé de chaque appel.
function magasin(depart = {}) {
  const valeurs = new Map(Object.entries(depart));
  const appels = [];
  return {
    valeurs,
    appels,
    getItem: (cle) => {
      appels.push(["getItem", cle]);
      return valeurs.has(cle) ? valeurs.get(cle) : null;
    },
    setItem: (cle, valeur) => {
      appels.push(["setItem", cle, valeur]);
      valeurs.set(cle, String(valeur));
    },
    removeItem: (cle) => {
      appels.push(["removeItem", cle]);
      valeurs.delete(cle);
    },
  };
}

/**
 * La page ouverte sur #/apparence : le document simulé, data-theme posé sur
 * <html> si theme n'est pas null, les deux balises theme-color d'index.html,
 * et localStorage, que rend acces (une fonction, qui peut lever). Rend
 * l'écran, <html>, les balises, et fermer, qui remet tout en place.
 */
function ouvrir({ theme = null, acces = () => magasin() } = {}) {
  const retirer = installerDom();
  const avant = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const fermer = () => {
    if (avant) Object.defineProperty(globalThis, "localStorage", avant);
    else delete globalThis.localStorage;
    retirer();
  };
  try {
    const html = document.documentElement;
    if (theme !== null) html.setAttribute("data-theme", theme);
    const tete = document.createElement("head");
    const teintes = TEINTES.map((attributs) => {
      const meta = document.createElement("meta");
      for (const [nom, valeur] of Object.entries(attributs)) meta.setAttribute(nom, valeur);
      tete.append(meta);
      return meta;
    });
    html.append(tete);
    document.querySelectorAll = (selecteur) => html.querySelectorAll(selecteur);
    Object.defineProperty(globalThis, "localStorage", { get: acces, configurable: true });
    const ecran = afficher();
    document.body.append(ecran);
    return { ecran, html, teintes, fermer };
  } catch (erreur) {
    fermer();
    throw erreur;
  }
}

const vignettesDe = (ecran) => [...ecran.querySelectorAll("button")];
const nomDe = (vignette) => texteDe(vignette.querySelector(".vignette-theme-nom"));
const vignetteDe = (ecran, nom) => {
  const trouvees = vignettesDe(ecran).filter((vignette) => nomDe(vignette) === nom);
  assert.equal(trouvees.length, 1, nom);
  return trouvees[0];
};
// [nom, aria-pressed] de chaque vignette pressée, ou dont la valeur n'est ni "true" ni "false".
const pressees = (ecran) => vignettesDe(ecran).map((vignette) => [nomDe(vignette), vignette.getAttribute("aria-pressed")]).filter(([, valeur]) => valeur !== "false");
const teintesDe = (balises) => balises.map((meta) => [meta.getAttribute("media"), meta.getAttribute("content")]);
// Le nom accessible d'un bouton, à peu près : son texte, hors ce qui est
// masqué (hidden) ou décoratif (aria-hidden).
const nomAccessible = (noeud) =>
  noeud.childNodes
    .map((enfant) => {
      if (!enfant.childNodes) return enfant.textContent;
      return enfant.hasAttribute("hidden") || enfant.getAttribute("aria-hidden") === "true" ? "" : nomAccessible(enfant);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

test("apparence — le titre, la ligne d'aide, les sept familles et leur nombre de thèmes, une seule région polie", () => {
  const page = ouvrir();
  try {
    const { ecran } = page;
    assert.equal(texteDe(ecran.querySelector("h1")), "Apparence");
    assert.equal(document.title, "Apparence — L'Atelier des Arpenteurs");
    assert.deepEqual([...ecran.querySelectorAll("p")].map(texteDe).filter((texte) => texte === AIDE), [AIDE], "la ligne d'aide, mot pour mot");
    assert.deepEqual([...ecran.querySelectorAll("h2")].map(texteDe), [
      "Par défaut · 1",
      "Fantastiques · 8",
      "Bordeaux · 2",
      "Modernes · 3",
      "Pratiques · 2",
      "Surprises · 3",
      "Inspirés de jeux vidéo · 18",
    ]);
    // Chaque section porte les vignettes de sa famille, et elles seules.
    const sections = [...ecran.querySelectorAll("section")].filter((section) => section.querySelector("h2"));
    assert.equal(sections.length, FAMILLES.length);
    sections.forEach((section, i) => {
      const attendus = FAMILLES[i].code === "défaut" ? ["Atelier"] : APPLIQUES.filter((theme) => theme.famille === FAMILLES[i].code).map((theme) => theme.nom);
      assert.deepEqual(vignettesDe(section).map(nomDe), attendus, FAMILLES[i].nom);
    });
    const regions = [...ecran.querySelectorAll("[aria-live]")];
    assert.equal(regions.length, 1, "une seule région annoncée");
    assert.equal(regions[0].getAttribute("aria-live"), "polite");
    assert.equal(texteDe(regions[0]), "", "rien d'annoncé avant un clic");
  } finally {
    page.fermer();
  }
});

test("apparence — trente-sept vignettes : data-theme sur trente-six, le nom, quatre pastilles, le mode, la description en title et en description accessible", () => {
  const page = ouvrir();
  try {
    const vignettes = vignettesDe(page.ecran);
    assert.equal(vignettes.length, 37);
    for (const vignette of vignettes) {
      assert.equal(vignette.getAttribute("type"), "button");
      assert.equal(vignette.className, "vignette-theme");
    }
    // « Atelier » d'abord, sans data-theme ; puis les trente-six, chacune le sien.
    assert.equal(vignettes[0].hasAttribute("data-theme"), false);
    assert.deepEqual(vignettes.filter((vignette) => vignette.hasAttribute("data-theme")).map((vignette) => vignette.getAttribute("data-theme")), ORDRE_PAGE.map((theme) => theme.code));
    assert.deepEqual(vignettes.slice(1).map(nomDe), ORDRE_PAGE.map((theme) => theme.nom));

    const description = (vignette) => {
      const id = vignette.getAttribute("aria-describedby");
      const cibles = [...page.ecran.querySelectorAll(`#${id}`)];
      assert.equal(cibles.length, 1, `une seule cible : ${id}`);
      return cibles[0];
    };
    for (const vignette of vignettes.slice(1)) {
      const theme = PAR_CODE.get(vignette.getAttribute("data-theme"));
      assert.equal(texteDe(vignette.querySelector(".vignette-theme-mode")), theme.mode, theme.code);
      assert.ok(["clair", "sombre"].includes(theme.mode), theme.code);
      const groupes = [...vignette.querySelectorAll(".pastilles")];
      assert.equal(groupes.length, 1, theme.code);
      assert.equal(groupes[0].getAttribute("aria-hidden"), "true", "les pastilles sont décoratives");
      assert.deepEqual([...groupes[0].querySelectorAll(".pastille")].map((pastille) => pastille.className), ["pastille pastille-fond", "pastille pastille-accent", "pastille pastille-pj", "pastille pastille-adv"]);
      assert.equal(vignette.getAttribute("title"), theme.description, theme.code);
      const cible = description(vignette);
      assert.equal(texteDe(cible), theme.description, theme.code);
      assert.equal(cible.hasAttribute("hidden"), true, theme.code);
      assert.equal(nomAccessible(vignette), `${theme.nom} ${theme.mode}`, "le nom ne lit ni les pastilles, ni la description");
    }

    const atelier = vignettes[0];
    assert.equal(nomDe(atelier), "Atelier");
    assert.equal(texteDe(atelier.querySelector(".vignette-theme-mode")), "selon l'appareil");
    const groupes = [...atelier.querySelectorAll(".pastilles")];
    assert.deepEqual(groupes.map((groupe) => groupe.className), ["pastilles pastilles-atelier-clair", "pastilles pastilles-atelier-sombre"]);
    for (const groupe of groupes) {
      assert.equal(groupe.getAttribute("aria-hidden"), "true");
      assert.deepEqual([...groupe.querySelectorAll(".pastille")].map((pastille) => pastille.className), ["pastille pastille-fond", "pastille pastille-accent", "pastille pastille-pj", "pastille pastille-adv"]);
    }
    assert.equal(atelier.getAttribute("title"), DESCRIPTION_ATELIER);
    assert.equal(texteDe(description(atelier)), DESCRIPTION_ATELIER);
    assert.equal(nomAccessible(atelier), "Atelier selon l'appareil");
  } finally {
    page.fermer();
  }
});

test("apparence — le thème actuel se lit sur <html> : aria-pressed en chaînes, « Atelier » sans attribut ou pour un code inconnu", () => {
  const cas = [
    [null, "Atelier"],
    ["abrasia", "Abrasia"],
    ["taverne", "Taverne"],
    ["necropole", PAR_CODE.get("necropole").nom],
    // Ni « Atelier » par son code, ni un code inconnu, ni un nom que tout objet porte.
    ["atelier-clair", "Atelier"],
    ["atelier-sombre", "Atelier"],
    ["inconnu", "Atelier"],
    ["Taverne", "Atelier"],
    ["constructor", "Atelier"],
    ["__proto__", "Atelier"],
  ];
  for (const [theme, attendu] of cas) {
    const page = ouvrir({ theme });
    try {
      // Une seule vignette pressée, "true" ; les trente-six autres, "false" (pressees les écarte).
      assert.deepEqual(pressees(page.ecran), [[attendu, "true"]], String(theme));
      // L'écran ne touche à rien en s'ouvrant.
      assert.equal(page.html.getAttribute("data-theme"), theme, String(theme));
      assert.deepEqual(teintesDe(page.teintes), TEINTES_ATELIER, String(theme));
    } finally {
      page.fermer();
    }
  }
});

test("apparence — un clic sur Taverne, puis sur Atelier : l'attribut, la clé brute puis retirée, aria-pressed, les mêmes nœuds, une seule région, les deux theme-color", () => {
  const stockage = magasin({ "atelier.vue-adversaire": "carte" });
  const page = ouvrir({ acces: () => stockage });
  try {
    const { ecran, html } = page;
    const avant = vignettesDe(ecran);
    const titreAvant = ecran.querySelector("h1");
    const region = ecran.querySelector("[aria-live]");
    const memesNoeuds = (moment) => {
      const apres = vignettesDe(ecran);
      assert.equal(apres.length, avant.length, moment);
      apres.forEach((vignette, i) => assert.ok(vignette === avant[i], `${moment} : la vignette ${i} est la même, la page n'est pas redessinée`));
      assert.ok(ecran.querySelector("h1") === titreAvant, moment);
      const regions = [...ecran.querySelectorAll("[aria-live]")];
      assert.equal(regions.length, 1, `${moment} : une seule région`);
      assert.ok(regions[0] === region, `${moment} : la région créée une fois`);
    };

    vignetteDe(ecran, "Taverne").click();
    assert.equal(html.getAttribute("data-theme"), "taverne");
    assert.equal(stockage.valeurs.get(CLE), "taverne", "la valeur brute, sans JSON");
    assert.deepEqual(stockage.appels, [["setItem", CLE, "taverne"]]);
    assert.deepEqual(pressees(ecran), [["Taverne", "true"]]);
    memesNoeuds("Taverne");
    assert.equal(texteDe(region), "Thème Taverne appliqué.");
    const fondTaverne = PAR_CODE.get("taverne").jetons.fond;
    assert.equal(fondTaverne, "#1d1611");
    assert.deepEqual(teintesDe(page.teintes), [
      ["(prefers-color-scheme: light)", fondTaverne],
      ["(prefers-color-scheme: dark)", fondTaverne],
    ]);

    vignetteDe(ecran, "Abrasia").click();
    assert.equal(html.getAttribute("data-theme"), "abrasia");
    assert.equal(stockage.valeurs.get(CLE), "abrasia");
    assert.deepEqual(pressees(ecran), [["Abrasia", "true"]]);
    memesNoeuds("Abrasia");
    assert.equal(texteDe(region), "Thème Abrasia appliqué.");

    vignetteDe(ecran, "Atelier").click();
    assert.equal(html.hasAttribute("data-theme"), false, "« Atelier » retire l'attribut");
    assert.equal(stockage.valeurs.has(CLE), false, "« Atelier » retire la clé");
    assert.deepEqual(stockage.appels.at(-1), ["removeItem", CLE]);
    assert.equal(stockage.valeurs.get("atelier.vue-adversaire"), "carte", "les autres souvenirs restent");
    assert.deepEqual(pressees(ecran), [["Atelier", "true"]]);
    memesNoeuds("Atelier");
    assert.equal(texteDe(region), "Thème Atelier appliqué.");
    assert.deepEqual(teintesDe(page.teintes), TEINTES_ATELIER, "le fond clair au réglage clair, le sombre au sombre");
    // L'écran n'a jamais lu le stockage : le thème actuel vient de <html>.
    assert.equal(stockage.appels.filter(([appel]) => appel === "getItem").length, 0);
  } finally {
    page.fermer();
  }
});

test("apparence — un localStorage qui lève, ou absent, ne casse rien : le thème s'applique pour la visite", () => {
  const refuse = () => {
    throw new Error("stockage refusé");
  };
  const acces = {
    "localStorage lève dès son accès": refuse,
    "setItem et removeItem lèvent": () => ({ getItem: refuse, setItem: refuse, removeItem: refuse }),
    "localStorage indéfini": () => undefined,
  };
  for (const [cas, fonction] of Object.entries(acces)) {
    const page = ouvrir({ acces: fonction });
    try {
      const { ecran, html } = page;
      const region = ecran.querySelector("[aria-live]");
      assert.doesNotThrow(() => vignetteDe(ecran, "Taverne").click(), cas);
      assert.equal(html.getAttribute("data-theme"), "taverne", cas);
      assert.deepEqual(pressees(ecran), [["Taverne", "true"]], cas);
      assert.equal(texteDe(region), "Thème Taverne appliqué.", cas);
      assert.deepEqual(teintesDe(page.teintes).map(([, fond]) => fond), ["#1d1611", "#1d1611"], cas);
      assert.doesNotThrow(() => vignetteDe(ecran, "Atelier").click(), cas);
      assert.equal(html.hasAttribute("data-theme"), false, cas);
      assert.deepEqual(pressees(ecran), [["Atelier", "true"]], cas);
      assert.equal(texteDe(region), "Thème Atelier appliqué.", cas);
      assert.deepEqual(teintesDe(page.teintes), TEINTES_ATELIER, cas);
    } finally {
      page.fermer();
    }
  }
});

// Le rechargement de la page : js/apparence/theme_initial.js, tel quel, dans
// un contexte à part, avec le stockage où l'écran a écrit, et un faux
// document fait de <html> et des deux balises theme-color d'index.html.
function recharger(stockage) {
  const element = (attributs) => {
    const valeurs = new Map(Object.entries(attributs));
    return {
      getAttribute: (nom) => valeurs.get(nom) ?? null,
      setAttribute: (nom, valeur) => void valeurs.set(nom, String(valeur)),
      removeAttribute: (nom) => void valeurs.delete(nom),
    };
  };
  const html = element({ lang: "fr" });
  const teintes = TEINTES.map(element);
  const document = {
    documentElement: html,
    querySelectorAll: (selecteur) => {
      if (selecteur !== 'meta[name="theme-color"]') throw new Error(`Sélecteur non pris en charge par le faux document : ${selecteur}`);
      return teintes;
    },
  };
  vm.runInContext(SCRIPT_INITIAL, vm.createContext({ document, localStorage: stockage }), { filename: "js/apparence/theme_initial.js" });
  return { theme: html.getAttribute("data-theme"), teintes: teintesDe(teintes) };
}

test("apparence — de bout en bout : au rechargement, theme_initial.js relit le thème choisi, « Atelier » aussi", () => {
  assert.deepEqual(TEINTES.map((meta) => [meta.media, meta.content]), TEINTES_ATELIER, "index.html");
  const stockage = magasin();
  const page = ouvrir({ acces: () => stockage });
  try {
    // Chaque vignette, Atelier compris, puis Atelier après un thème : la page
    // rechargée retrouve l'attribut et les deux balises que l'écran a posés.
    const vignettes = vignettesDe(page.ecran);
    for (const vignette of [...vignettes, vignettes[0]]) {
      vignette.click();
      const nom = nomDe(vignette);
      const rechargee = recharger(stockage);
      assert.equal(rechargee.theme, page.html.getAttribute("data-theme"), nom);
      assert.deepEqual(rechargee.teintes, teintesDe(page.teintes), nom);
    }
    // La dernière : « Atelier », sans attribut, les balises d'index.html.
    assert.deepEqual(recharger(stockage), { theme: null, teintes: TEINTES_ATELIER });
    // Et Taverne, nommément.
    vignetteDe(page.ecran, "Taverne").click();
    assert.deepEqual(recharger(stockage), { theme: "taverne", teintes: [["(prefers-color-scheme: light)", "#1d1611"], ["(prefers-color-scheme: dark)", "#1d1611"]] });
  } finally {
    page.fermer();
  }
});

test("apparence — application.js l'importe et l'affiche avant d'attendre la banque, comme l'espace auteur ; l'écran n'écrit pas de JSON", () => {
  const application = lire("js/application.js");
  assert.match(application, /^import \* as apparence from "\.\/ecrans\/apparence\.js";\r?$/m);
  const lignes = application.split(/\r?\n/).map((ligne) => ligne.trim());
  const rang = (texte) => {
    const trouves = lignes.flatMap((ligne, i) => (ligne === texte ? [i] : []));
    assert.equal(trouves.length, 1, texte);
    return trouves[0];
  };
  const route = rang('if (route.ecran === "apparence") return apparence.afficher();');
  const auteur = rang('if (route.ecran === "auteur") return espaceAuteur.afficher(contexte);');
  const chargement = lignes.findIndex((ligne) => ligne.startsWith("if (!etat.chargement)"));
  const banque = rang("if (!etat.banque) return motDePasse.afficher(contexte);");
  assert.ok(chargement > 0);
  assert.equal(route, auteur + 1, "juste après l'espace auteur");
  assert.ok(route < chargement && route < banque, "avant d'attendre la banque");
  assert.equal(application.match(/apparence\.afficher\(/g).length, 1);
  // La valeur gardée est brute : ni JSON, ni les souvenirs d'application.js.
  const source = lire("js/ecrans/apparence.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(source, /JSON|lireMemoire|ecrireMemoire|innerHTML|\.style\b/);
});

test("apparence — la feuille : deux vignettes par ligne, six à partir de 56rem ; le nom dans la police et la couleur de titre du thème ; les quatre pastilles", () => {
  const css = lire("css/ecran.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const regle = (selecteur, depuis = 0) => {
    const debut = css.indexOf(`${selecteur} {`, depuis);
    assert.ok(debut >= 0, selecteur);
    return css.slice(debut, css.indexOf("}", debut));
  };
  assert.match(regle(".vignettes-themes"), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  const large = css.indexOf("@media (min-width: 56rem) {", css.indexOf(".vignettes-themes {"));
  assert.ok(large > 0, "une condition à 56rem, après la règle du téléphone");
  assert.match(regle(".vignettes-themes", large), /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  const nom = regle(".vignette-theme-nom");
  for (const jeton of ["police-titre", "couleur-titre", "graisse-titre"]) assert.ok(nom.includes(`var(--${jeton})`), jeton);
  for (const [classe, jeton] of [["fond", "fond"], ["accent", "accent"], ["pj", "combat-pj"], ["adv", "combat-adv"]]) {
    assert.match(regle(`.pastille-${classe}`), new RegExp(`background: var\\(--${jeton}\\);`), classe);
  }
  assert.match(regle('.vignette-theme[aria-pressed="true"]'), /outline: var\(--trait-epais\) solid;/, "un contour épais");
});
