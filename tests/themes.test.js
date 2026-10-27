// Contrôles des thèmes (SPECIFICATION.md, § 9 et § 10.1 ; les polices,
// § 10.2) : le catalogue de js/apparence/themes.js, ses piles de polices et
// la police du journal, puis la feuille css/themes.css, réengendrée par
// outils/themes_css.js et lue comme un texte. Les contrastes et l'aspect se
// mesurent ailleurs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FAMILLES,
  JETONS,
  JETONS_RESERVES,
  PILE_CHASSE_FIXE,
  PILE_SYSTEME,
  POLICES,
  THEMES,
  pileDePolice,
  policeDuJournal,
} from "../js/apparence/themes.js";
import { feuilleDesThemes } from "../outils/themes_css.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const enLF = (texte) => texte.replace(/\r\n/g, "\n");
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Les piles de css/jetons.css, que les thèmes reprennent mot pour mot.
const JETONS_CSS = sansCommentaires(lire("css/jetons.css"));
const POLICE_DU_SYSTEME = JETONS_CSS.match(/--police:\s*([^;]+);/)[1];
const CHASSE_FIXE = JETONS_CSS.match(/--police-chasse-fixe:\s*([^;]+);/)[1];

// Écrits ici, indépendamment du module : les familles, leur ordre et leurs
// noms ; les cinq polices de titre sans empattements ; les familles dont le
// journal prend la police de texte.
const FAMILLES_ATTENDUES = [
  ["défaut", "Par défaut", 2],
  ["fantastique", "Fantastiques", 8],
  ["bordeaux", "Bordeaux", 2],
  ["moderne", "Modernes", 3],
  ["pratique", "Pratiques", 2],
  ["surprise", "Surprises", 3],
  ["jeux", "Inspirés de jeux vidéo", 18],
];
const SANS_EMPATTEMENTS = ["exo", "racing", "pixel", "orbitron", "germania"];
const JOURNAL_EN_TEXTE = ["fantastique", "bordeaux", "surprise", "jeux"];
const ATELIER = ["atelier-clair", "atelier-sombre"];

// Les déclarations d'un bloc, dans l'ordre : [nom, valeur].
const declarations = (corps) =>
  corps
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const deuxPoints = declaration.indexOf(":");
      return [declaration.slice(0, deuxPoints).trim(), declaration.slice(deuxPoints + 1).trim()];
    });

// La feuille en trois parts : ce qui précède @media screen, son contenu, et
// ce qui suit son accolade fermante.
function parts(css) {
  const texte = sansCommentaires(css);
  const debut = texte.indexOf("@media");
  const ouverture = texte.indexOf("{", debut);
  let profondeur = 0;
  let fin = -1;
  for (let i = ouverture; i < texte.length && fin < 0; i += 1) {
    if (texte[i] === "{") profondeur += 1;
    if (texte[i] === "}" && --profondeur === 0) fin = i;
  }
  return { avant: texte.slice(0, debut), media: texte.slice(debut, ouverture).trim(), dedans: texte.slice(ouverture + 1, fin), apres: texte.slice(fin + 1) };
}

const FEUILLE = feuilleDesThemes();
const { avant, media, dedans, apres } = parts(FEUILLE);
const BLOCS = [...dedans.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selecteur, corps]) => [selecteur.trim(), declarations(corps)]);
const blocDe = (code) => BLOCS.find(([selecteur]) => selecteur === `[data-theme="${code}"]`)[1];
const valeurDe = (code, nom) => blocDe(code).find(([cle]) => cle === nom)?.[1];
const THEMES_A_BLOC = THEMES.filter((theme) => !ATELIER.includes(theme.code));

test("feuille — css/themes.css est celle qu'engendre outils/themes_css.js, fins de ligne en LF", () => {
  assert.ok(!FEUILLE.includes("\r"), "la feuille s'engendre en LF");
  assert.equal(enLF(lire("css/themes.css")), enLF(FEUILLE));
  assert.match(FEUILLE, /^\/\* [^]*?engendrée par outils\/themes_css\.js[^]*?\*\/\n/);
});

test("feuille — les 19 @font-face au niveau supérieur, tout le reste dans un seul @media screen", () => {
  assert.equal(media, "@media screen");
  assert.equal((sansCommentaires(FEUILLE).match(/@media/g) ?? []).length, 1);
  assert.equal(apres.trim(), "", "rien après @media screen");
  const polices = [...avant.matchAll(/@font-face\s*\{([^{}]*)\}/g)];
  assert.equal(avant.replace(/@font-face\s*\{[^{}]*\}/g, "").trim(), "", "rien d'autre au niveau supérieur");
  assert.equal(polices.length, 19);
  const attendues = Object.values(POLICES)
    .filter((police) => police.fichier !== null)
    .map((police) => [
      ["font-family", `"${police.famille}"`],
      ["src", `url("../polices/${police.fichier}") format("woff2")`],
      ["font-weight", police.graisse],
      ["font-style", "normal"],
      ["font-display", "swap"],
    ]);
  assert.deepEqual(polices.map(([, corps]) => declarations(corps)), attendues);
  assert.doesNotMatch(dedans, /@font-face/);
});

test("feuille — 36 blocs [data-theme], sans :root ni Atelier, puis les deux classes de pastilles", () => {
  assert.equal(dedans.replace(/[^{}]+\{[^{}]*\}/g, "").trim(), "", "aucune règle imbriquée");
  assert.deepEqual(
    BLOCS.map(([selecteur]) => selecteur),
    [...THEMES_A_BLOC.map((theme) => `[data-theme="${theme.code}"]`), ".pastilles-atelier-clair", ".pastilles-atelier-sombre"],
  );
  assert.equal(THEMES_A_BLOC.length, 36);
  assert.doesNotMatch(sansCommentaires(FEUILLE), /:root/);
  assert.doesNotMatch(FEUILLE, /data-theme="atelier-/);
  for (const code of ATELIER) {
    const theme = THEMES.find((entree) => entree.code === code);
    assert.deepEqual(
      BLOCS.find(([selecteur]) => selecteur === `.pastilles-${code}`)[1],
      ["fond", "accent", "combat-pj", "combat-adv"].map((jeton) => [`--${jeton}`, theme.jetons[jeton]]),
      code,
    );
  }
});

test("feuille — chaque bloc écrit ses 28 couleurs, ses polices et color-scheme en toutes lettres, sans var()", () => {
  // Plus aucun jeton réservé : les trois du jeu en cours (lot 4.3) sont entrés avec les vignettes et les fiches du
  // combat, et chaque thème les écrit.
  const couleurs = JETONS.filter((jeton) => !JETONS_RESERVES.includes(jeton));
  assert.equal(couleurs.length, 28);
  assert.deepEqual(JETONS_RESERVES, []);
  for (const jeton of ["combat-a-jouer", "combat-a-jouer-doux", "combat-epuise"]) {
    assert.equal(FEUILLE.split(`--${jeton}:`).length - 1, THEMES_A_BLOC.length, jeton);
  }
  for (const theme of THEMES_A_BLOC) {
    const bloc = blocDe(theme.code);
    assert.deepEqual(
      bloc.map(([nom]) => nom),
      [...couleurs.map((jeton) => `--${jeton}`), "--police", "--police-titre", "--police-journal", "--graisse-titre", "--rayon", "--ajustement", "color-scheme"],
      theme.code,
    );
    for (const [nom, valeur] of bloc) assert.doesNotMatch(valeur, /var\(/, `${theme.code} ${nom}`);
    for (const jeton of couleurs) assert.equal(valeurDe(theme.code, `--${jeton}`), theme.jetons[jeton], `${theme.code} --${jeton}`);
    assert.equal(valeurDe(theme.code, "color-scheme"), { clair: "light", sombre: "dark" }[theme.mode], theme.code);
    assert.equal(valeurDe(theme.code, "--police"), pileDePolice(theme.police), theme.code);
    assert.equal(valeurDe(theme.code, "--police-titre"), pileDePolice(theme.police_titre), theme.code);
    assert.equal(valeurDe(theme.code, "--graisse-titre"), theme.graisse_titre, theme.code);
    assert.equal(valeurDe(theme.code, "--rayon"), theme.rayon, theme.code);
    assert.equal(valeurDe(theme.code, "--ajustement"), theme.ajustement, theme.code);
  }
});

test("piles — la police du système et la chasse fixe de css/jetons.css, Alegreya Sans, EB Garamond, à empattements ou non", () => {
  assert.equal(pileDePolice("systeme"), POLICE_DU_SYSTEME);
  assert.equal(PILE_SYSTEME, POLICE_DU_SYSTEME);
  assert.equal(PILE_CHASSE_FIXE, CHASSE_FIXE);
  assert.equal(pileDePolice("alegreya"), `"Alegreya Sans", ${POLICE_DU_SYSTEME}`);
  assert.equal(pileDePolice("garamond"), '"EB Garamond", Georgia, "Times New Roman", serif');
  assert.equal(pileDePolice("cinzel"), '"Cinzel", Georgia, serif');
  assert.equal(pileDePolice("exo"), `"Exo 2", ${POLICE_DU_SYSTEME}`);
  for (const cle of SANS_EMPATTEMENTS) assert.equal(pileDePolice(cle), `"${POLICES[cle].famille}", ${POLICE_DU_SYSTEME}`, cle);
  const aEmpattements = Object.keys(POLICES).filter((cle) => !["systeme", "alegreya", "garamond", ...SANS_EMPATTEMENTS].includes(cle));
  assert.equal(aEmpattements.length, 15);
  for (const cle of aEmpattements) assert.equal(pileDePolice(cle), `"${POLICES[cle].famille}", Georgia, serif`, cle);
  assert.throws(() => pileDePolice("inconnue"), /Police inconnue/);
});

test("piles — --police-journal : la police de texte dans quatre familles, la chasse fixe dans les autres", () => {
  const vus = { texte: 0, chasse: 0 };
  for (const theme of THEMES) {
    const enTexte = JOURNAL_EN_TEXTE.includes(theme.famille);
    vus[enTexte ? "texte" : "chasse"] += 1;
    const attendue = enTexte ? pileDePolice(theme.police) : CHASSE_FIXE;
    assert.equal(policeDuJournal(theme), attendue, theme.code);
    if (!ATELIER.includes(theme.code)) assert.equal(valeurDe(theme.code, "--police-journal"), attendue, theme.code);
  }
  assert.deepEqual(vus, { texte: 31, chasse: 7 });
});

test("catalogue — 38 entrées pour 37 thèmes, codes uniques, sept familles dans l'ordre", () => {
  assert.equal(THEMES.length, 38);
  assert.equal(new Set(THEMES.map((theme) => theme.code)).size, 38);
  assert.deepEqual(FAMILLES, FAMILLES_ATTENDUES.map(([code, nom]) => ({ code, nom })));
  for (const theme of THEMES) assert.ok(FAMILLES.some((famille) => famille.code === theme.famille), theme.code);
  assert.deepEqual(
    FAMILLES.map((famille) => THEMES.filter((theme) => theme.famille === famille.code).length),
    FAMILLES_ATTENDUES.map(([, , nombre]) => nombre),
  );
  // Les deux entrées d'Atelier font un seul thème, clair ou sombre selon l'appareil.
  const atelier = THEMES.filter((theme) => theme.famille === "défaut");
  assert.deepEqual(atelier.map((theme) => [theme.code, theme.mode]), [["atelier-clair", "clair"], ["atelier-sombre", "sombre"]]);
  assert.equal(THEMES.length - atelier.length + 1, 37);
});

test("catalogue — chaque entrée : mode, nom, description, 28 couleurs, polices connues", () => {
  assert.equal(JETONS.length, 28);
  for (const theme of THEMES) {
    assert.ok(["clair", "sombre"].includes(theme.mode), theme.code);
    assert.ok(typeof theme.nom === "string" && theme.nom.length > 0, theme.code);
    assert.ok(typeof theme.description === "string" && theme.description.length > 0, theme.code);
    assert.deepEqual(Object.keys(theme.jetons).sort(), [...JETONS].sort(), theme.code);
    for (const [jeton, valeur] of Object.entries(theme.jetons)) assert.match(valeur, /^#[0-9a-f]{6}$/, `${theme.code} ${jeton}`);
    for (const cle of [theme.police, theme.police_titre]) assert.ok(Object.hasOwn(POLICES, cle), `${theme.code} : ${cle}`);
    if (theme.fonds_ornes !== undefined) {
      assert.ok(theme.fonds_ornes.length > 0, theme.code);
      for (const fond of theme.fonds_ornes) assert.match(fond, /^#[0-9a-f]{6}$/, theme.code);
    }
  }
});

test("catalogue — 19 polices hébergées pour les thèmes, chacune dans polices/ au format woff2", () => {
  for (const cle of ["systeme", "alegreya", "garamond", "marcellus"]) assert.equal(POLICES[cle].fichier, null, cle);
  const hebergees = Object.entries(POLICES).filter(([, police]) => police.fichier !== null);
  assert.equal(hebergees.length, 19);
  for (const [cle, police] of hebergees) {
    assert.ok(["400", "700"].includes(police.graisse), cle);
    assert.equal(readFileSync(new URL(`polices/${police.fichier}`, racine)).subarray(0, 4).toString("latin1"), "wOF2", cle);
  }
});
