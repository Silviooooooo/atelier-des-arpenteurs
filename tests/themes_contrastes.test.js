// Contrôles des contrastes des thèmes (SPECIFICATION.md, § 9 et § 10.1) :
// les trente-huit entrées du catalogue de js/apparence/themes.js, mesurées
// paire par paire, la plaque de la vignette « Non maîtrisé », puis l'accord
// des couleurs de css/jetons.css avec les deux entrées « Atelier ».
//
// Les paires, les seuils et la formule sont ceux du contrôle de référence
// qui a validé le catalogue (26/10/2026 : 2 576 mesures, aucun échec),
// recopiés ici, car il ne vit pas dans le dépôt. Ce sont les paires de
// tests/site.test.js pour le site et le combat, plus les jetons neufs ; puis,
// pour les thèmes qui en ont, le texte sur chacun de leurs fonds ornés. Un
// échec signifie une valeur recopiée de travers, pas une palette à refaire.
// Les contrôles de tests/site.test.js, eux, restent sur css/jetons.css.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JETONS_RESERVES, THEMES } from "../js/apparence/themes.js";

const RACINE = new URL("../", import.meta.url);
const JETONS_CSS = readFileSync(new URL("css/jetons.css", RACINE), "utf8");

const COULEUR = /^#[0-9a-f]{6}$/i;

// La luminance relative d'une couleur #rrggbb, et le contraste de deux
// couleurs, de 1:1 à 21:1 (WCAG 2), comme le contrôle de référence.
function luminance(hex) {
  const [r, v, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

function contraste(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Les paires : [avant, ses fonds, seuil]. 4,5 pour un texte ; 3 pour un
// trait, un rond ou un bord.
const FONDS_DE_CASE = ["fond", "fond-2", "accent-doux"];
const PAIRES = [
  // Le site.
  ["texte", ["fond", "fond-2", "accent-doux", "combat-pj-doux", "combat-adv-doux", "combat-cadre-jet-fond", "combat-a-jouer-doux"], 4.5],
  ["texte-2", ["fond", "fond-2", "accent-doux", "combat-pj-doux", "combat-adv-doux"], 4.5],
  ["accent", ["fond", "fond-2", "accent-doux", "combat-pj-doux", "combat-adv-doux"], 4.5],
  ["texte-sur-accent", ["accent"], 4.5],
  ["bordure", ["fond", "fond-2"], 3],
  // Le combat : les textes sur les fonds de case, les ronds, les traits.
  ["combat-pj-texte", [...FONDS_DE_CASE, "combat-pj-doux"], 4.5],
  ["combat-adv-texte", [...FONDS_DE_CASE, "combat-adv-doux"], 4.5],
  ["combat-reussite", [...FONDS_DE_CASE, "combat-cadre-jet-fond"], 4.5],
  ["combat-echec", [...FONDS_DE_CASE, "combat-cadre-jet-fond"], 4.5],
  ["combat-alerte", FONDS_DE_CASE, 4.5],
  ["combat-sur-jeton", ["combat-pj", "combat-adv", "combat-mort"], 4.5],
  ["combat-pj", FONDS_DE_CASE, 3],
  ["combat-adv", FONDS_DE_CASE, 3],
  ["combat-mort", FONDS_DE_CASE, 3],
  ["combat-cadre-jet", ["fond", "fond-2", "combat-cadre-jet-fond"], 3],
  ["combat-portee", FONDS_DE_CASE, 3],
  ["combat-portee-bord", FONDS_DE_CASE, 3],
  // Les jetons neufs : les titres (lot 5) ; les vignettes et les fiches du
  // combat (lot 4.3) : qui peut encore agir, un texte et un bord, sur les
  // fonds et son fond doux ; qui a tout joué, un bord et un anneau. Le nom
  // d'un jeton qui a tout joué, en --texte sur --fond-2, est mesuré plus
  // haut avec le texte du site.
  ["couleur-titre", ["fond", "fond-2"], 4.5],
  ["combat-a-jouer", ["fond", "fond-2", "combat-a-jouer-doux"], 4.5],
  ["combat-epuise", ["fond", "fond-2"], 3],
];
// Sur chaque fond orné d'un thème (fonds_ornes) : [avant, seuil].
const PAIRES_ORNEES = [["texte", 4.5], ["texte-2", 4.5], ["accent", 4.5], ["couleur-titre", 4.5], ["bordure", 3]];

// Toutes les mesures d'une liste de thèmes : leur nombre, par seuil, et
// les échecs, un par ligne.
function mesurer(themes) {
  const bilan = { mesures: 0, parSeuil: { 4.5: 0, 3: 0 }, echecs: [] };
  const mesurerUne = (code, avant, fond, nomDuFond, seuil) => {
    bilan.mesures += 1;
    bilan.parSeuil[seuil] = (bilan.parSeuil[seuil] ?? 0) + 1;
    if (!COULEUR.test(avant ?? "") || !COULEUR.test(fond ?? "")) {
      bilan.echecs.push(`${code} : ${nomDuFond}, une valeur n'est pas une couleur #rrggbb`);
      return;
    }
    const mesure = contraste(avant, fond);
    if (!(mesure >= seuil)) bilan.echecs.push(`${code} : ${nomDuFond}, ${mesure.toFixed(2)}:1 < ${seuil}`);
  };
  for (const theme of themes) {
    const j = theme.jetons;
    for (const [avant, fonds, seuil] of PAIRES) {
      for (const fond of fonds) mesurerUne(theme.code, j[avant], j[fond], `--${avant} sur --${fond}`, seuil);
    }
    for (const fond of theme.fonds_ornes ?? []) {
      for (const [avant, seuil] of PAIRES_ORNEES) mesurerUne(theme.code, j[avant], fond, `--${avant} sur le fond orné ${fond}`, seuil);
    }
  }
  return bilan;
}

test("contrastes — la formule : 21:1 du noir au blanc, et les gris qui bordent les deux seuils", () => {
  assert.equal(contraste("#000000", "#ffffff"), 21);
  assert.equal(contraste("#ffffff", "#ffffff"), 1);
  assert.equal(contraste("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(contraste("#777777", "#ffffff").toFixed(2), "4.48");
  assert.equal(contraste("#949494", "#ffffff").toFixed(2), "3.03");
  assert.equal(contraste("#969696", "#ffffff").toFixed(2), "2.96");
  // Les trois canaux, chacun de son poids ; un gris très sombre, sous le
  // coude de la courbe.
  assert.equal(contraste("#ff0000", "#ffffff").toFixed(2), "4.00");
  assert.equal(contraste("#0000ff", "#ffffff").toFixed(2), "8.59");
  assert.equal(contraste("#00ff00", "#000000").toFixed(2), "15.30");
  assert.equal(contraste("#0a0a0a", "#000000").toFixed(2), "1.06");
  // L'ordre des deux couleurs n'y fait rien.
  assert.equal(contraste("#1d5c8f", "#e3edf6"), contraste("#e3edf6", "#1d5c8f"));
});

test("contrastes — les 38 entrées du catalogue : 2 576 mesures, aucun échec", () => {
  assert.equal(THEMES.length, 38);
  assert.equal(THEMES.filter((theme) => (theme.fonds_ornes ?? []).length > 0).length, 4);
  const { mesures, parSeuil, echecs } = mesurer(THEMES);
  assert.deepEqual(echecs, []);
  assert.equal(mesures, 2576);
  // 67 paires par entrée, plus 5 par fond orné (6 en tout) ; une paire qui
  // change de seuil se voit ici.
  assert.deepEqual(parSeuil, { 4.5: 1734, 3: 842 });
});

test("contrastes — un échec fabriqué se voit, au plus près des seuils", () => {
  const copie = () => structuredClone(THEMES);
  const echecsDe = (themes) => mesurer(themes).echecs;
  const clair = (themes) => themes.find((theme) => theme.code === "atelier-clair");

  // Un texte à 4,48:1 sur le blanc échoue ; à 4,54:1, il passe.
  let themes = copie();
  clair(themes).jetons["texte-2"] = "#777777";
  let echecs = echecsDe(themes);
  assert.ok(echecs.includes("atelier-clair : --texte-2 sur --fond, 4.48:1 < 4.5"), echecs.join("\n"));
  assert.ok(echecs.every((echec) => echec.startsWith("atelier-clair : --texte-2 sur ")), echecs.join("\n"));
  themes = copie();
  clair(themes).jetons["texte-2"] = "#767676";
  assert.ok(!echecsDe(themes).some((echec) => echec.startsWith("atelier-clair : --texte-2 sur --fond,")));

  // Un bord à 2,96:1 échoue ; à 3,03:1, il passe.
  themes = copie();
  clair(themes).jetons.bordure = "#969696";
  echecs = echecsDe(themes);
  assert.ok(echecs.includes("atelier-clair : --bordure sur --fond, 2.96:1 < 3"), echecs.join("\n"));
  themes = copie();
  clair(themes).jetons.bordure = "#949494";
  assert.ok(!echecsDe(themes).some((echec) => echec.startsWith("atelier-clair : --bordure sur --fond,")));

  // Un fond orné recopié de travers : le texte s'y perd.
  themes = copie();
  const orne = themes.find((theme) => (theme.fonds_ornes ?? []).length > 0);
  orne.fonds_ornes[0] = orne.jetons.texte;
  echecs = echecsDe(themes);
  assert.ok(echecs.includes(`${orne.code} : --texte sur le fond orné ${orne.jetons.texte}, 1.00:1 < 4.5`), echecs.join("\n"));

  // Un jeton manquant ne passe pas pour une couleur.
  themes = copie();
  delete clair(themes).jetons["couleur-titre"];
  assert.ok(echecsDe(themes).includes("atelier-clair : --couleur-titre sur --fond, une valeur n'est pas une couleur #rrggbb"));
  // Le catalogue lui-même n'a pas bougé.
  assert.deepEqual(echecsDe(THEMES), []);
});

// La vignette « Non maîtrisé » de l'étape 7 (css/personnage.css) : sur ses
// bandes (--hachure-alerte), la couleur d'alerte tomberait sous 4,5:1 dans
// six thèmes clairs, celle des liens (--accent) dans cinq. Ses textes et son
// lien vers les anomalies sont donc sur une plaque --fond-2, où les paires
// ci-dessus les mesurent ; mesurer sur les bandes n'aurait de sens que sans
// plaque.
test("contrastes — la vignette « Non maîtrisé » : le nom, la mention, « (désavantage) » et le lien vers les anomalies sur la plaque --fond-2, que mesurent les paires", () => {
  const css = readFileSync(new URL("css/personnage.css", RACINE), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, corps]) => ({ selecteurs: prelude.split(",").map((s) => s.trim()), corps }));
  const plaques = regles.filter(({ selecteurs, corps }) => selecteurs.every((s) => s.startsWith(".vignette.non-maitrise ")) && /background: var\(--fond-2\);/.test(corps));
  assert.equal(plaques.length, 1);
  assert.deepEqual(plaques[0].selecteurs, [
    ".vignette.non-maitrise .vignette-anomalie",
    ".vignette.non-maitrise .vignette-nom",
    ".vignette.non-maitrise .mention-maitrise",
    ".vignette.non-maitrise .desavantage",
  ]);
  // Les couleurs posées sur la plaque, toutes mesurées sur --fond-2 à 4,5:1 :
  // le nom (--texte-2), la mention et « (désavantage) » (--combat-alerte), le
  // lien (--accent).
  for (const avant of ["texte-2", "combat-alerte", "accent"]) {
    assert.ok(PAIRES.some(([a, fonds, seuil]) => a === avant && fonds.includes("fond-2") && seuil === 4.5), avant);
  }
  // Le lien est dans le paragraphe qui porte la plaque (js/ecrans/creation.js).
  const source = readFileSync(new URL("js/ecrans/creation.js", RACINE), "utf8");
  assert.match(source, /el\("p", \{ classe: "vignette-anomalie" \}, versAnomalie\(/);
});

// Les couleurs de l'écran que déclare une feuille de jetons : le bloc clair
// (:root), puis le sombre, qui le surcharge. Seulement les valeurs #rrggbb,
// hors la fiche de personnage et la carte d'adversaire, qui sont du papier
// et qu'aucun thème ne change (§ 15.4, § 16.5) ; les couleurs calculées
// (color-mix, var()) suivent celles-ci.
function couleursDeJetons(css) {
  const texte = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lireBloc = (bloc) =>
    Object.fromEntries(
      [...bloc.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
        .filter(([, nom]) => !nom.startsWith("fiche-") && !nom.startsWith("carte-"))
        .map(([, nom, valeur]) => [nom, valeur]),
    );
  const debutSombre = texte.indexOf("@media (prefers-color-scheme: dark)");
  const clair = lireBloc(texte.slice(texte.indexOf(":root"), debutSombre));
  return { clair, sombre: { ...clair, ...lireBloc(texte.slice(debutSombre)) } };
}

// Les écarts entre une feuille de jetons et les deux entrées « Atelier » :
// vide quand tout s'accorde.
function ecartsAvecAtelier(css) {
  const couleurs = couleursDeJetons(css);
  const ecarts = [];
  for (const [mode, code] of [["clair", "atelier-clair"], ["sombre", "atelier-sombre"]]) {
    const atelier = THEMES.find((theme) => theme.code === code).jetons;
    for (const [nom, valeur] of Object.entries(couleurs[mode])) {
      if (atelier[nom] !== valeur) ecarts.push(`${mode} : --${nom} vaut ${valeur} dans jetons.css, ${atelier[nom] ?? "rien"} dans ${code}`);
    }
    for (const nom of Object.keys(atelier)) {
      if (!JETONS_RESERVES.includes(nom) && !(nom in couleurs[mode])) ecarts.push(`${mode} : --${nom} de ${code} manque dans jetons.css`);
    }
  }
  return ecarts;
}

test("contrastes — css/jetons.css, clair puis sombre, a les couleurs d'atelier-clair et d'atelier-sombre", () => {
  const { clair, sombre } = couleursDeJetons(JETONS_CSS);
  // Les vingt-huit jetons du catalogue, tous : plus aucun n'est réservé
  // depuis le lot 4.3 ; le sombre les redéclare tous.
  assert.equal(Object.keys(clair).length, 28);
  assert.equal(Object.keys(sombre).length, 28);
  assert.deepEqual(JETONS_RESERVES, []);
  assert.deepEqual(ecartsAvecAtelier(JETONS_CSS), []);
  // Un des trois du jeu en cours ôté de jetons.css, ou changé : chacun se voit.
  assert.ok(JETONS_CSS.includes("  --combat-epuise: #7d838d;\n") || JETONS_CSS.includes("  --combat-epuise: #7d838d;\r\n"));
  assert.deepEqual(ecartsAvecAtelier(JETONS_CSS.replace(/\r?\n {2}--combat-epuise: #7d838d;/, "")), [
    "clair : --combat-epuise de atelier-clair manque dans jetons.css",
  ]);
  assert.deepEqual(ecartsAvecAtelier(JETONS_CSS.replace("--combat-a-jouer-doux: #163222;", "--combat-a-jouer-doux: #183022;")), [
    "sombre : --combat-a-jouer-doux vaut #183022 dans jetons.css, #163222 dans atelier-sombre",
  ]);

  // Une couleur changée, dans un bloc ou dans l'autre, une couleur retirée,
  // une couleur de plus : chacune se voit.
  const changer = (avant, apres) => {
    assert.ok(JETONS_CSS.includes(avant), avant);
    return ecartsAvecAtelier(JETONS_CSS.replace(avant, apres));
  };
  assert.deepEqual(changer("--accent: #1d5c8f;", "--accent: #1d5c90;"), [
    "clair : --accent vaut #1d5c90 dans jetons.css, #1d5c8f dans atelier-clair",
  ]);
  assert.deepEqual(changer("--accent: #7db4e3;", "--accent: #7db4e4;"), [
    "sombre : --accent vaut #7db4e4 dans jetons.css, #7db4e3 dans atelier-sombre",
  ]);
  assert.deepEqual(changer("--couleur-titre: #e6e8eb;", ""), ["sombre : --couleur-titre vaut #1a1c20 dans jetons.css, #e6e8eb dans atelier-sombre"]);
  assert.deepEqual(changer("--couleur-titre: #1a1c20;", "--couleur-titre: var(--texte);"), [
    "clair : --couleur-titre de atelier-clair manque dans jetons.css",
  ]);
  assert.deepEqual(changer("--accent-doux: #e3edf6;", "--accent-doux: #e3edf6;\n  --accent-vif: #2a78b8;"), [
    "clair : --accent-vif vaut #2a78b8 dans jetons.css, rien dans atelier-clair",
    "sombre : --accent-vif vaut #2a78b8 dans jetons.css, rien dans atelier-sombre",
  ]);
});
