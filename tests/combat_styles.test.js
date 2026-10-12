// Contrôles des feuilles de style du simulateur de combat (SPECIFICATION.md,
// § 17 ; l'interface, § 9 ; les jetons, § 10.1).
//
// css/combat.css et css/jetons.css y sont lus comme des textes : aucun
// navigateur ne tourne ici, et la mise en page se mesure ailleurs. Ce fichier
// tient ce qu'un texte peut tenir : des jetons seulement, les deux largeurs
// des @media, les classes, le contour réservé au focus, les onze couleurs
// dans les deux thèmes et leurs contrastes, les trois dispositions.
//
// Chaque règle est une fonction qui rend la liste des défauts : vide sur la
// feuille du dépôt, non vide sur une feuille fautive écrite ici même. Une
// règle qui ne refuserait rien se verrait donc.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const COMBAT = lire("css/combat.css");
const JETONS = lire("css/jetons.css");

const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const lignesDe = (css) => sansCommentaires(css).split(/\r?\n/);

// Les jetons d'un thème : le clair, puis le sombre qui le surcharge (la
// lecture même de tests/site.test.js).
function jetons(css, theme) {
  const lireBloc = (bloc) => Object.fromEntries([...bloc.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, nom, valeur]) => [nom, valeur.trim()]));
  const debutSombre = css.indexOf("@media (prefers-color-scheme: dark)");
  const clair = lireBloc(css.slice(css.indexOf(":root"), debutSombre));
  return theme === "clair" ? clair : { ...clair, ...lireBloc(css.slice(debutSombre)) };
}
const sombresSeuls = (css) => jetons(`:root {} ${css.slice(css.indexOf("@media (prefers-color-scheme: dark)"))}`, "sombre");

// La formule de tests/site.test.js.
function contraste(a, b) {
  const luminance = (hex) => {
    const [r, v, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * v + 0.0722 * bl;
  };
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

// Les règles d'une feuille : [{ cadre, selecteur, corps }], où « cadre » est
// la ligne @media qui l'entoure, ou null.
function regles(css) {
  const texte = sansCommentaires(css);
  const liste = [];
  const lireBlocs = (source, cadre) => {
    let position = 0;
    while (position < source.length) {
      const ouvre = source.indexOf("{", position);
      if (ouvre < 0) break;
      let profondeur = 1;
      let ferme = ouvre + 1;
      for (; ferme < source.length && profondeur > 0; ferme += 1) {
        if (source[ferme] === "{") profondeur += 1;
        if (source[ferme] === "}") profondeur -= 1;
      }
      const tete = source.slice(position, ouvre).trim().replace(/\s+/g, " ");
      const corps = source.slice(ouvre + 1, ferme - 1);
      if (tete.startsWith("@")) lireBlocs(corps, tete);
      else liste.push({ cadre, selecteur: tete, corps });
      position = ferme;
    }
  };
  lireBlocs(texte, null);
  return liste;
}
const declarations = (corps) =>
  corps
    .split(";")
    .map((morceau) => morceau.trim())
    .filter(Boolean)
    .map((morceau) => {
      const coupe = morceau.indexOf(":");
      return [morceau.slice(0, coupe).trim(), morceau.slice(coupe + 1).trim().replace(/\s+/g, " ")];
    });
const selecteursDe = (css) => regles(css).flatMap((regle) => regle.selecteur.split(/\s*,\s*/).map((selecteur) => ({ ...regle, selecteur })));
// La valeur d'une propriété pour un sélecteur exact, hors @media ou dans le cadre donné.
function valeur(css, selecteur, propriete, cadre = null) {
  const trouvees = selecteursDe(css)
    .filter((regle) => regle.selecteur === selecteur && regle.cadre === cadre)
    .flatMap((regle) => declarations(regle.corps))
    .filter(([nom]) => nom === propriete);
  return trouvees.length ? trouvees[trouvees.length - 1][1] : null;
}

const MEDIA_56 = "@media (min-width: 56rem)";
const MEDIA_80 = "@media (min-width: 80rem)";

// ——— Des jetons seulement ———

function valeursEnDur(css, definis) {
  const defauts = [];
  const texte = sansCommentaires(css);
  for (const brute of lignesDe(css)) {
    const ligne = brute.trim();
    if (ligne.startsWith("@media")) continue;
    if (/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(ligne)) defauts.push(`couleur écrite en dur : ${ligne}`);
    if (/:.*\b(?:white|black|red|green|blue|gr[ae]y|silver|orange|yellow|maroon|navy)\b/i.test(ligne)) defauts.push(`couleur nommée : ${ligne}`);
    // Le motif du site, puis plus strict : toute unité, hors les proportions
    // (%, fr) et la part de la case (cqi).
    if (/\d(?:px|rem|em|vh|vw|pt|ms|s)\b/.test(ligne)) defauts.push(`valeur écrite en dur : ${ligne}`);
    else if (/\d(?!fr\b|cqi\b)[a-z]+\b/i.test(ligne)) defauts.push(`unité écrite en dur : ${ligne}`);
    if (/font-family:/.test(ligne) && !/font-family:\s*var\(--/.test(ligne)) defauts.push(`police écrite en dur : ${ligne}`);
    if (/!important/.test(ligne)) defauts.push(`!important : ${ligne}`);
    if (/^--[\w-]+\s*:/.test(ligne)) defauts.push(`jeton déclaré hors de jetons.css : ${ligne}`);
  }
  for (const [, nom, suite] of texte.matchAll(/var\(--([\w-]+)\s*([,)])/g)) {
    if (suite === ",") defauts.push(`--${nom} lu avec une valeur de repli`);
    else if (!definis.has(nom)) defauts.push(`--${nom} n'est pas défini dans jetons.css`);
  }
  if (/@font-face|@import|url\(/.test(texte)) defauts.push("police ou ressource téléchargée");
  return defauts;
}

test("combat.css — des jetons seulement : ni couleur, ni longueur, ni police en dur, hors des largeurs des @media", () => {
  const definis = new Set(Object.keys(jetons(JETONS, "clair")));
  assert.deepEqual(valeursEnDur(COMBAT, definis), []);
  const refuse = (css, motif) => assert.match(valeursEnDur(css, definis).join("\n"), motif, css);
  refuse(".combat-x { color: #1e7a3c; }", /couleur écrite en dur/);
  refuse(".combat-x { background: rgba(0, 0, 0, 0.5); }", /couleur écrite en dur/);
  refuse(".combat-x { color: color-mix(in srgb, red, blue); }", /couleur écrite en dur/);
  refuse(".combat-x { color: white; }", /couleur nommée/);
  refuse(".combat-x { box-shadow: 0 0 0 1.5px var(--accent); }", /valeur écrite en dur/);
  refuse(".combat-x { font-size: 0.75rem; }", /valeur écrite en dur/);
  refuse(".combat-x { transition: opacity 0.2s; }", /valeur écrite en dur/);
  refuse(".combat-x { height: 100dvh; }", /unité écrite en dur/);
  refuse(".combat-x { min-width: 2ch; }", /unité écrite en dur/);
  refuse(".combat-x { font-family: ui-monospace, monospace; }", /police écrite en dur/);
  refuse(".combat-x { display: none !important; }", /!important/);
  refuse(".combat-x {\n  --combat-cote: 100%;\n}", /jeton déclaré hors de jetons\.css/);
  refuse(".combat-x { width: var(--combat-cote, 100%); }", /valeur de repli/);
  refuse(".combat-x { width: var(--combat-inconnu); }", /n'est pas défini/);
  refuse("@import \"autre.css\";", /téléchargée/);
  // Les pièges du contrôle du site (tests/site.test.js) sont refusés ici aussi.
  refuse("@container (min-width: 40rem) {\n  .combat-x { display: none; }\n}", /valeur écrite en dur/);
  refuse("@media\n  (min-width: 80rem) {\n  .combat-x { display: none; }\n}", /valeur écrite en dur/);
  refuse("#face-contre { display: none; }", /couleur écrite en dur/);
  // Ce que la feuille emploie et qui n'est pas une longueur passe.
  assert.deepEqual(valeursEnDur(".combat-x {\n  grid-template-columns: var(--espace-4) repeat(10, minmax(0, 1fr));\n  font-size: min(var(--taille-petite), 20cqi);\n  width: 70%;\n  aspect-ratio: 1 / 1;\n}", definis), []);
});

// ——— Les deux @media ———

function defautsDesCadres(css) {
  const defauts = [];
  const arobases = lignesDe(css)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.includes("@"));
  const attendues = [`${MEDIA_56} {`, `${MEDIA_80} {`];
  if (JSON.stringify(arobases) !== JSON.stringify(attendues)) defauts.push(`règles @ : ${JSON.stringify(arobases)}`);
  return defauts;
}

test("combat.css — deux @media, à 56rem et 80rem, chacun sur une ligne ; aucune autre règle @", () => {
  assert.deepEqual(defautsDesCadres(COMBAT), []);
  const base = ".combat-x { display: none; }\n";
  const deux = `${base}${MEDIA_56} {\n${base}}\n${MEDIA_80} {\n${base}}\n`;
  assert.deepEqual(defautsDesCadres(deux), []);
  for (const fautive of [
    base,
    `${base}${MEDIA_56} {\n${base}}\n`,
    deux.replace("56rem", "44rem"),
    deux.replace("80rem", "79.99rem"),
    `${deux}@media (max-width: 700px) {\n${base}}\n`,
    `${deux}@container (min-width: 40rem) {\n${base}}\n`,
    `${deux}@supports (display: grid) {\n${base}}\n`,
    `${deux}@media print {\n${base}}\n`,
    deux.replace(`${MEDIA_80} {`, "@media\n  (min-width: 80rem) {"),
    `${MEDIA_80} {\n${base}}\n${MEDIA_56} {\n${base}}\n`,
  ]) {
    assert.notDeepEqual(defautsDesCadres(fautive), [], fautive);
  }
  // Chaque cadre porte des règles : la feuille n'a pas deux coquilles vides.
  for (const cadre of [MEDIA_56, MEDIA_80]) assert.ok(regles(COMBAT).some((regle) => regle.cadre === cadre), cadre);
});

// ——— La largeur de l'écran ———

test("combat.css — #ecran:has(> .combat) élargit la page à --largeur-combat (90rem), et c'est le seul identifiant", () => {
  assert.equal(valeur(COMBAT, "#ecran:has(> .combat)", "max-width"), "var(--largeur-combat)");
  assert.equal(jetons(JETONS, "clair")["largeur-combat"], "90rem");
  assert.equal(jetons(JETONS, "sombre")["largeur-combat"], "90rem");
  assert.equal(valeur(".combat { max-width: var(--largeur-combat); }", "#ecran:has(> .combat)", "max-width"), null);
  const identifiants = (css) => selecteursDe(css).flatMap((regle) => regle.selecteur.match(/#[\w-]+/g) ?? []);
  assert.deepEqual(identifiants(COMBAT), ["#ecran"]);
  assert.deepEqual(identifiants("#ecran:has(> .combat) { top: 0; }\n#journal .combat-x { top: 0; }"), ["#ecran", "#journal"]);
});

// ——— Les classes ———

// Les classes du site que l'écran réemploie, et que la feuille peut nommer
// sous une classe du combat.
const CLASSES_DU_SITE = new Set(["bouton", "champ"]);
// Les états du contrat (§ 7.9), écrits en classes de plus.
const ETATS = new Set([
  "ouvert", "active", "possible", "inactive", "joue", "cible", "mort", "inactif", "fait", "en-cours", "reussi", "echoue", "relance", "a-lancer", "a-venir",
  "atteinte", "ciblee", "morte", "vide", "eteint", "tour", "abimee", "detruite",
]);

function defautsDesClasses(css) {
  const defauts = [];
  for (const { selecteur } of selecteursDe(css)) {
    // Chaque règle part de l'écran du combat : elle ne touche rien d'autre.
    if (!/^(?:\.combat(?![\w])|\.combat-[a-z]|#ecran:has\(> \.combat\)$)/.test(selecteur)) defauts.push(`règle hors de l'écran du combat : ${selecteur}`);
    for (const [, classe] of selecteur.matchAll(/\.([\w-]+)/g)) {
      if (/carte/.test(classe)) defauts.push(`classe en « carte » : ${selecteur}`);
      else if (classe !== "combat" && !classe.startsWith("combat-") && !CLASSES_DU_SITE.has(classe) && !ETATS.has(classe)) defauts.push(`classe inconnue .${classe} : ${selecteur}`);
    }
  }
  return defauts;
}

test("combat.css — chaque règle part d'une classe « combat » ; aucune classe hors de combat-, des états du contrat et des classes communes ; aucun nom en « carte »", () => {
  assert.deepEqual(defautsDesClasses(COMBAT), []);
  const refuse = (css, motif) => assert.match(defautsDesClasses(css).join("\n"), motif, css);
  refuse(".fiche { margin: 0; }", /hors de l'écran du combat/);
  refuse("button { margin: 0; }", /hors de l'écran du combat/);
  refuse(".joue { margin: 0; }", /hors de l'écran du combat/);
  refuse(".combattant { margin: 0; }", /hors de l'écran du combat/);
  refuse("#ecran { margin: 0; }", /hors de l'écran du combat/);
  refuse(".combat-x,\n.etapes { margin: 0; }", /hors de l'écran du combat/);
  refuse(".combat-x .etapes { margin: 0; }", /classe inconnue \.etapes/);
  refuse(".combat-x.choisie { margin: 0; }", /classe inconnue \.choisie/);
  refuse(".combat-carte { margin: 0; }", /classe en « carte »/);
  refuse(".combat .carte-adversaire { margin: 0; }", /classe en « carte »/);
  assert.deepEqual(defautsDesClasses(".combat { margin: 0; }\n.combat-fiche.joue summary::after,\n.combat-copie .champ { margin: 0; }"), []);
  // La racine que vise la largeur, et quelques nœuds du contrat (§ 7.9).
  const classes = new Set(selecteursDe(COMBAT).flatMap((regle) => [...regle.selecteur.matchAll(/\.([\w-]+)/g)].map(([, classe]) => classe)));
  for (const attendue of [
    "combat", "combat-barre", "combat-etat", "combat-garde", "combat-commandes", "combat-plus-bouton", "combat-autres", "combat-aide", "combat-avis", "combat-panneau",
    "combat-cadre", "combat-plateau", "combat-grille", "combat-coord", "combat-case", "combat-case-choix", "combat-jeton", "combat-pj", "combat-adv", "combat-rond",
    "combat-initiales", "combat-nom-court", "combat-case-plus", "combat-plus-large", "combat-plus-etroit", "combat-legende", "combat-action", "combat-preparation",
    "combat-qui", "combat-etapes", "combat-groupe", "combat-groupe-titre", "combat-capacite", "combat-degats", "combat-cout", "combat-desavantage", "combat-passifs",
    "combat-cibles", "combat-origine", "combat-des", "combat-jet", "combat-contexte", "combat-chaine", "combat-de", "combat-bilan", "combat-lettres", "combat-choix",
    "combat-reglages", "combat-case-liste", "combat-annonce", "combat-camps", "combat-camp", "combat-camp-pj", "combat-camp-adv", "combat-compte", "combat-fiche",
    "combat-pastille", "combat-nom", "combat-sous", "combat-statut", "combat-actions", "combat-pion", "combat-fiche-corps", "combat-jauge", "combat-point",
    "combat-zones", "combat-contre", "combat-valeurs", "combat-effets", "combat-journal", "combat-journal-tete", "combat-lignes", "combat-copie",
  ]) {
    assert.ok(classes.has(attendue), `.${attendue} n'a aucune règle`);
  }
});

// ——— Le contour, réservé au focus ; la marque de la cible ———

function contoursHorsDuFocus(css) {
  return selecteursDe(css)
    .filter((regle) => declarations(regle.corps).some(([propriete]) => propriete.startsWith("outline")))
    .filter((regle) => !/:focus(?:-visible)?$/.test(regle.selecteur))
    .map((regle) => regle.selecteur);
}

test("combat.css — aucun outline hors du focus ; la cible est une bordure rouge discontinue ; aucune opacité", () => {
  assert.deepEqual(contoursHorsDuFocus(COMBAT), []);
  assert.deepEqual(contoursHorsDuFocus(".combat-jeton.cible { outline: var(--trait) dashed var(--combat-adv); }"), [".combat-jeton.cible"]);
  assert.deepEqual(contoursHorsDuFocus(".combat-case:focus-within .combat-jeton { outline-offset: 0; }"), [".combat-case:focus-within .combat-jeton"]);
  assert.deepEqual(contoursHorsDuFocus(".combat-grille :focus-visible { outline-offset: 0; }"), []);
  // Le focus reste visible dans une case, qui coupe ce qui la dépasse : il se trace en dedans.
  assert.equal(valeur(COMBAT, ".combat-case", "overflow"), "hidden");
  assert.equal(valeur(COMBAT, ".combat-grille :focus-visible", "outline-offset"), "calc(var(--trait) * -2)");
  assert.ok(!selecteursDe(COMBAT).some((regle) => /focus/.test(regle.selecteur) && /\.combat-(?:jeton|case|capacite|de)\b/.test(regle.selecteur) && /outline:\s*none/.test(regle.corps)), "un focus effacé");

  // Mission § 10.4 : la cible choisie, un trait rouge discontinu.
  assert.equal(valeur(COMBAT, ".combat-jeton.cible", "border-style"), "dashed");
  assert.equal(valeur(COMBAT, ".combat-jeton.cible", "border-color"), "var(--combat-adv)");
  assert.match(valeur(COMBAT, ".combat-cibles button[aria-pressed=\"true\"]", "border"), /dashed var\(--combat-adv\)$/);
  assert.match(valeur(COMBAT, ".combat-fiche.ciblee", "border"), /dashed var\(--combat-adv\)$/);
  // Celui qui joue, et sa case, sont entourés de l'accent.
  assert.equal(valeur(COMBAT, ".combat-jeton.joue", "border-color"), "var(--accent)");
  assert.equal(valeur(COMBAT, ".combat-case.active", "border-color"), "var(--accent)");
  // La bordure d'un jeton existe au repos : une marque ne déplace rien.
  assert.match(valeur(COMBAT, ".combat-jeton", "border"), /solid transparent$/);

  // Arbitrage § 7.3 : aucune opacité, qui ferait tomber un contraste.
  const opacites = (css) => selecteursDe(css).filter((regle) => declarations(regle.corps).some(([propriete]) => propriete === "opacity" || propriete === "filter")).map((regle) => regle.selecteur);
  assert.deepEqual(opacites(COMBAT), []);
  assert.deepEqual(opacites(".combat-fiche.morte { opacity: var(--opacite-inactif); }"), [".combat-fiche.morte"]);
});

// ——— Les onze couleurs ———

// Mission § 10.9 : [jeton, clair, sombre].
const COULEURS = [
  ["combat-pj", "#1e7a3c", "#3fae62"],
  ["combat-pj-doux", "#e2f2e7", "#163222"],
  ["combat-pj-texte", "#1e7a3c", "#9ee0b4"],
  ["combat-adv", "#b3261e", "#e66b61"],
  ["combat-adv-doux", "#fbe3e1", "#3a1c1a"],
  ["combat-adv-texte", "#b3261e", "#f2aaa3"],
  ["combat-sur-jeton", "#ffffff", "#0b1722"],
  ["combat-mort", "#6b717b", "#7d838d"],
  ["combat-reussite", "#1e7a3c", "#5cc38a"],
  ["combat-echec", "#b3261e", "#e8776e"],
  ["combat-alerte", "#8a5300", "#e6a85a"],
];

function defautsDesCouleurs(css) {
  const defauts = [];
  const clair = jetons(css, "clair");
  const sombre = sombresSeuls(css);
  for (const [nom, valeurClaire, valeurSombre] of COULEURS) {
    if (clair[nom] !== valeurClaire) defauts.push(`--${nom} clair : ${clair[nom]}`);
    if (sombre[nom] !== valeurSombre) defauts.push(`--${nom} sombre : ${sombre[nom]}`);
  }
  const attendus = COULEURS.map(([nom]) => nom);
  for (const [theme, bloc] of [["clair", clair], ["sombre", sombre]]) {
    const duCombat = Object.keys(bloc).filter((nom) => /combat/.test(nom) && nom !== "largeur-combat");
    if (JSON.stringify(duCombat) !== JSON.stringify(attendus)) defauts.push(`jetons du combat, thème ${theme} : ${duCombat.join(", ")}`);
    for (const nom of duCombat) if (/carte/.test(nom)) defauts.push(`jeton en « carte » : --${nom}`);
  }
  if (clair["largeur-combat"] !== "90rem") defauts.push(`--largeur-combat : ${clair["largeur-combat"]}`);
  if ("largeur-combat" in sombre) defauts.push("--largeur-combat n'a pas de valeur sombre");
  return defauts;
}

test("jetons.css — les onze couleurs du combat, dans les deux thèmes, exactement ; --largeur-combat ; aucun nom en « carte » ; rien de plus", () => {
  assert.deepEqual(defautsDesCouleurs(JETONS), []);
  const refuse = (css, motif) => assert.match(defautsDesCouleurs(css).join("\n"), motif);
  // Les deux valeurs de la maquette que la mission corrige, en sombre.
  refuse(JETONS.replace("--combat-adv: #e66b61;", "--combat-adv: #e0574d;"), /--combat-adv sombre : #e0574d/);
  refuse(JETONS.replace("--combat-sur-jeton: #0b1722;", "--combat-sur-jeton: #ffffff;"), /--combat-sur-jeton sombre : #ffffff/);
  refuse(JETONS.replace("--combat-pj: #1e7a3c;", "--combat-pj: #1e7a3d;"), /--combat-pj clair : #1e7a3d/);
  // Un jeton sans valeur sombre, un jeton de trop, un nom en « carte ».
  refuse(JETONS.replace(/\s*--combat-alerte: #e6a85a;/, ""), /--combat-alerte sombre : undefined/);
  refuse(JETONS.replace("--combat-alerte: #8a5300;", "--combat-alerte: #8a5300;\n  --combat-fond-3: #262a30;"), /jetons du combat, thème clair/);
  refuse(JETONS.replace("--combat-alerte: #e6a85a;", "--combat-alerte: #e6a85a;\n    --combat-carte-fond: #1a1d21;"), /jeton en « carte » : --combat-carte-fond/);
  refuse(JETONS.replace("--largeur-combat: 90rem;", "--largeur-combat: 72rem;"), /--largeur-combat : 72rem/);
  // Les contrôles voisins (tests/carte.test.js) : aucun jeton sombre en « carte », aucun jeton neuf qui commence par « carte- ».
  assert.deepEqual(Object.keys(sombresSeuls(JETONS)).filter((nom) => /carte/.test(nom) && nom !== "largeur-carte"), []);
  assert.doesNotMatch(JETONS, /@font-face|@import|url\(/);
});

// ——— Les contrastes ———

const FONDS_DE_CASE = ["fond", "fond-2", "accent-doux"];
// Le texte, à 4,5:1 : [avant, fond].
const PAIRES_DE_TEXTE = [
  ["combat-pj-texte", "combat-pj-doux"],
  ["combat-adv-texte", "combat-adv-doux"],
  ...["combat-pj-texte", "combat-adv-texte", "combat-reussite", "combat-echec", "combat-alerte"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])),
  ["combat-sur-jeton", "combat-pj"],
  ["combat-sur-jeton", "combat-adv"],
  ["combat-sur-jeton", "combat-mort"],
  ["texte-2", "fond"],
  ["texte-2", "fond-2"],
  ["accent", "fond-2"],
  ["accent", "accent-doux"],
  ["texte-sur-accent", "accent"],
];
// Les ronds et les traits, à 3:1.
const PAIRES_DE_TRAIT = [...["combat-pj", "combat-adv", "combat-mort", "accent"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])), ["bordure", "fond"], ["bordure", "fond-2"]];

function contrastesFaibles(css) {
  const defauts = [];
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(css, theme);
    for (const [paires, seuil] of [[PAIRES_DE_TEXTE, 4.5], [PAIRES_DE_TRAIT, 3]]) {
      for (const [avant, fond] of paires) {
        const mesure = contraste(j[avant], j[fond]);
        if (!(mesure >= seuil)) defauts.push(`${theme} : --${avant} sur --${fond}, ${mesure.toFixed(2)}:1 sous ${seuil}`);
      }
    }
  }
  return defauts;
}

// Les jetons qu'une feuille emploie comme couleur de texte.
const couleursDeTexte = (css) => [...new Set(selecteursDe(css).flatMap((regle) => declarations(regle.corps).filter(([propriete]) => propriete === "color").map(([, v]) => v)))];

test("jetons.css — le texte du combat contraste d'au moins 4,5:1, ses ronds et ses traits de 3:1, dans les deux thèmes", () => {
  assert.deepEqual(contrastesFaibles(JETONS), []);
  // Les deux valeurs de la maquette, en sombre : des initiales blanches sur le vert ne tiennent pas.
  assert.match(contrastesFaibles(JETONS.replace("--combat-sur-jeton: #0b1722;", "--combat-sur-jeton: #ffffff;")).join("\n"), /sombre : --combat-sur-jeton sur --combat-pj, 2\.8\d:1 sous 4\.5/);
  assert.match(contrastesFaibles(JETONS.replace("--combat-mort: #6b717b;", "--combat-mort: #9aa0a8;")).join("\n"), /clair : --combat-mort sur --fond/);
  assert.match(contrastesFaibles(JETONS.replace("--combat-alerte: #8a5300;", "--combat-alerte: #c98a1e;")).join("\n"), /clair : --combat-alerte sur --fond/);

  // --combat-mort est une couleur de rond : comme texte sur le second fond, elle ne tient pas 4,5:1 (arbitrage § 7.3).
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(JETONS, theme);
    assert.ok(contraste(j["combat-mort"], j["fond-2"]) < 4.5, theme);
  }
  // La feuille n'écrit donc de texte qu'avec des couleurs mesurées ci-dessus, ou avec le texte du site.
  const permises = new Set(["texte", "texte-2", "accent", "texte-sur-accent", "combat-pj-texte", "combat-adv-texte", "combat-sur-jeton", "combat-reussite", "combat-echec", "combat-alerte"].map((nom) => `var(--${nom})`));
  assert.deepEqual(couleursDeTexte(COMBAT).filter((couleur) => !permises.has(couleur)), []);
  assert.deepEqual(couleursDeTexte(".combat-fiche.morte .combat-nom { color: var(--combat-mort); }").filter((couleur) => !permises.has(couleur)), ["var(--combat-mort)"]);
  // Le texte d'un mort : le second gris, barré.
  assert.equal(valeur(COMBAT, ".combat-fiche.morte .combat-nom", "color"), "var(--texte-2)");
  assert.equal(valeur(COMBAT, ".combat-fiche.morte .combat-nom", "text-decoration"), "line-through");
  assert.equal(valeur(COMBAT, ".combat-jeton.mort .combat-nom-court", "color"), "var(--texte-2)");
  assert.equal(valeur(COMBAT, ".combat-jeton.mort .combat-nom-court", "text-decoration"), "line-through");
  assert.match(valeur(COMBAT, ".combat-jeton.mort .combat-rond", "background"), /var\(--combat-mort\)$/);
  // Vert pour les PJ, rouge pour les adversaires ; les initiales dans leur couleur.
  assert.equal(valeur(COMBAT, ".combat-pj .combat-rond", "background"), "var(--combat-pj)");
  assert.equal(valeur(COMBAT, ".combat-adv .combat-rond", "background"), "var(--combat-adv)");
  assert.equal(valeur(COMBAT, ".combat-rond", "color"), "var(--combat-sur-jeton)");
  // Chacun des onze jetons sert.
  for (const [nom] of COULEURS) assert.ok(COMBAT.includes(`var(--${nom})`), `--${nom} ne sert à rien`);
});

// ——— Les trois dispositions ———

test("combat.css — une colonne ; à 56rem le plateau et l'action à gauche, les camps à droite ; à 80rem les PJ, le plateau, les adversaires", () => {
  // Moins de 56rem : une colonne, dans l'ordre du document.
  assert.equal(valeur(COMBAT, ".combat-cadre", "display"), "grid");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas"), null);
  for (const [selecteur, propriete] of selecteursDe(COMBAT).filter((regle) => regle.cadre === null).flatMap((regle) => declarations(regle.corps).map(([propriete]) => [regle.selecteur, propriete]))) {
    assert.ok(propriete !== "order", `${selecteur} : l'ordre est celui du document`);
    if (/^\.combat-(?:plateau|action|preparation|camps|camp-pj|camp-adv)$/.test(selecteur)) assert.notEqual(propriete, "grid-area", selecteur);
  }
  // De 56 à 80rem.
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas", MEDIA_56), "\"plateau camps\" \"action camps\"");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-columns", MEDIA_56), "minmax(0, 2fr) minmax(0, 1fr)");
  assert.equal(valeur(COMBAT, ".combat-plateau", "grid-area", MEDIA_56), "plateau");
  assert.equal(valeur(COMBAT, ".combat-action", "grid-area", MEDIA_56), "action");
  assert.equal(valeur(COMBAT, ".combat-preparation", "grid-area", MEDIA_56), "action");
  assert.equal(valeur(COMBAT, ".combat-camps", "grid-area", MEDIA_56), "camps");
  // 80rem et plus : l'enveloppe des camps s'efface, chacun prend sa colonne.
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas", MEDIA_80), "\"pj plateau adv\" \"pj action adv\"");
  assert.equal(valeur(COMBAT, ".combat-camps", "display", MEDIA_80), "contents");
  assert.equal(valeur(COMBAT, ".combat-camp-pj", "grid-area", MEDIA_80), "pj");
  assert.equal(valeur(COMBAT, ".combat-camp-adv", "grid-area", MEDIA_80), "adv");
  // Le journal reste hors du cadre, sur toute la largeur : aucune zone ne le place.
  assert.ok(!selecteursDe(COMBAT).some((regle) => regle.selecteur === ".combat-journal" && /grid-area/.test(regle.corps)));
  // Aucune colonne ne peut être élargie par ce qu'elle contient.
  for (const cadre of [null, MEDIA_56, MEDIA_80]) {
    const colonnes = valeur(COMBAT, ".combat-cadre", "grid-template-columns", cadre);
    assert.deepEqual(colonnes.match(/minmax\(0, \d+fr\)/g).join(" "), colonnes, `${cadre}`);
  }
  // La barre : sur un téléphone, « ⋯ » ouvre les autres boutons ; à 56rem ils sont là.
  assert.equal(valeur(COMBAT, ".combat-autres", "display"), "none");
  assert.equal(valeur(COMBAT, ".combat-autres.ouvert", "display"), "flex");
  assert.equal(valeur(COMBAT, ".combat-autres", "display", MEDIA_56), "flex");
  assert.equal(valeur(COMBAT, ".combat-plus-bouton", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-bouton", "display"), null);
  // L'état de l'enregistrement reste visible sur un téléphone (arbitrage § 7.7).
  assert.ok(!selecteursDe(COMBAT).some((regle) => regle.selecteur === ".combat-garde" && /display:\s*none/.test(regle.corps)));
});

// ——— Le plateau ———

test("combat.css — le plateau : des pistes que rien n'élargit, des cases qui coupent, des jetons mesurés sur la case ; deux jetons puis « +k » sous 56rem, trois au-delà", () => {
  // Dix cases égales après la bande des repères ; un carré.
  for (const cadre of [null, MEDIA_56]) {
    for (const propriete of ["grid-template-columns", "grid-template-rows"]) {
      assert.match(valeur(COMBAT, ".combat-grille", propriete, cadre), /^var\(--espace-\d\) repeat\(10, minmax\(0, 1fr\)\)$/, `${cadre} ${propriete}`);
    }
    assert.equal(valeur(COMBAT, ".combat-grille", "grid-template-columns", cadre).split(" ")[0], valeur(COMBAT, ".combat-grille", "grid-template-rows", cadre).split(" ")[0]);
  }
  assert.equal(valeur(COMBAT, ".combat-grille", "aspect-ratio"), "1 / 1");
  // Les repères de ligne restent en première colonne, et les cases se rangent dessous, quel que soit l'ordre du document.
  assert.equal(valeur(COMBAT, ".combat-grille", "grid-auto-flow"), "row dense");
  assert.equal(valeur(COMBAT, ".combat-coord:nth-child(n + 12)", "grid-column"), "1");
  // Aucune case ne déborde : ni sa largeur ni sa hauteur ne dépendent de ce qu'elle porte.
  for (const [propriete, attendue] of [["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"], ["container-type", "size"], ["position", "relative"]]) {
    assert.equal(valeur(COMBAT, ".combat-case", propriete), attendue, propriete);
  }
  assert.ok(!selecteursDe(COMBAT).some((regle) => /^\.combat-case(?:\.[\w-]+)?$/.test(regle.selecteur) && /overflow:\s*visible|padding/.test(regle.corps)));
  // Les cases sont l'exception aux 44 px (mission § 10.4).
  assert.equal(valeur(COMBAT, ".combat-grille button", "min-height"), "0");
  assert.equal(valeur(COMBAT, ".combat-grille button", "min-width"), "0");
  // Un jeton se mesure sur sa case, jamais sur une longueur fixe ; une valeur d'attente précède, pour un navigateur qui ignore l'unité.
  for (const [selecteur, cadre] of [[".combat-jeton", null], [".combat-plus-etroit", null], [".combat-jeton", MEDIA_56], [".combat-plus-large", MEDIA_56]]) {
    const tailles = selecteursDe(COMBAT).filter((regle) => regle.selecteur === selecteur && regle.cadre === cadre).flatMap((regle) => declarations(regle.corps)).filter(([propriete]) => propriete === "font-size").map(([, v]) => v);
    assert.equal(tailles.length, 2, `${selecteur} ${cadre}`);
    assert.equal(tailles[0], "var(--taille-petite)");
    assert.match(tailles[1], /^(?:\d+cqi|min\(var\(--taille-petite\), \d+cqi\))$/);
  }
  assert.equal(valeur(COMBAT, ".combat-rond", "width"), "100%");
  assert.equal(valeur(COMBAT, ".combat-rond", "aspect-ratio"), "1 / 1");
  assert.equal(valeur(COMBAT, ".combat-rond", "border-radius"), "50%");
  // Sous 56rem : les initiales dans le rond, le nom court caché ; deux jetons, puis le « +k » étroit.
  assert.equal(valeur(COMBAT, ".combat-nom-court", "display"), "none");
  assert.equal(valeur(COMBAT, ".combat-case", "grid-template-columns"), "repeat(2, minmax(0, 1fr))");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton", "display"), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-large", "display"), "none");
  assert.notEqual(valeur(COMBAT, ".combat-plus-etroit", "display"), "none");
  // À partir de 56rem : le nom court à côté du rond, les initiales cachées ; trois jetons, puis le « +k » large.
  assert.equal(valeur(COMBAT, ".combat-nom-court", "display", MEDIA_56), "block");
  assert.equal(valeur(COMBAT, ".combat-nom-court", "text-overflow", MEDIA_56), "ellipsis");
  assert.equal(valeur(COMBAT, ".combat-grille .combat-initiales", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton", "display", MEDIA_56), "flex");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton ~ .combat-jeton", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-etroit", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-large", "display", MEDIA_56), "block");
  // Le « +k » large ne prend aucune ligne aux trois jetons.
  assert.equal(valeur(COMBAT, ".combat-plus-large", "grid-column", MEDIA_56), "2");
  assert.equal(valeur(COMBAT, ".combat-plus-large", "grid-row", MEDIA_56), "1 / span 3");
  // Le bouton d'une case qu'on choisit la couvre, sous ses jetons : jamais un bouton dans un bouton.
  assert.equal(valeur(COMBAT, ".combat-case-choix", "position"), "absolute");
  assert.equal(valeur(COMBAT, ".combat-case-choix", "inset"), "0");
  assert.equal(valeur(COMBAT, ".combat-jeton", "z-index"), "1");
  // Le seul positionnement absolu, avec la région d'annonce.
  assert.deepEqual(selecteursDe(COMBAT).filter((regle) => /position:\s*(?:absolute|fixed|sticky)/.test(regle.corps)).map((regle) => regle.selecteur), [".combat-case-choix", ".combat-annonce"]);
});

// ——— Les cibles de 44 px, le journal ———

// La valeur d'un calcul fait de jetons, en rem : « calc(var(--espace-6) * 9) ».
function enRem(expression, definis) {
  const [, nom, facteur] = expression.match(/^calc\(var\(--([\w-]+)\) \* (\d+)\)$/) ?? [];
  const [, nombre] = (definis[nom] ?? "").match(/^([\d.]+)rem$/) ?? [];
  return nombre === undefined ? null : Number(nombre) * Number(facteur);
}

test("combat.css — toute cible fait 44 px, hors les cases ; le journal est limité à 18rem, à 24rem sur un grand écran, et défile", () => {
  assert.equal(jetons(JETONS, "clair")["cible-tactile"], "44px");
  for (const selecteur of [".combat button", ".combat select", ".combat textarea", ".combat input", ".combat label", ".combat-fiche summary", ".combat-capacite", ".combat-cibles button", ".combat-case-liste button"]) {
    assert.equal(valeur(COMBAT, selecteur, "min-height"), "var(--cible-tactile)", selecteur);
  }
  assert.equal(valeur(COMBAT, ".combat button", "min-width"), "var(--cible-tactile)");
  // Un dé est plus grand qu'une cible, dans les deux sens.
  for (const cadre of [null, MEDIA_56]) {
    for (const propriete of ["width", "height"]) assert.match(valeur(COMBAT, ".combat-de", propriete, cadre), /^calc\(var\(--cible-tactile\) \+ var\(--espace-\d\)\)$/, `${cadre} ${propriete}`);
  }
  // Rien d'autre que le plateau ne redescend sous 44 px.
  const rabaisses = (css) => selecteursDe(css).filter((regle) => declarations(regle.corps).some(([propriete, v]) => /^min-(?:width|height)$/.test(propriete) && v === "0") && /button|input|select|summary|capacite|\.combat-de\b/.test(regle.selecteur)).map((regle) => regle.selecteur);
  assert.deepEqual(rabaisses(COMBAT), [".combat input[type=\"checkbox\"]", ".combat input[type=\"radio\"]", ".combat-grille button"]);
  assert.deepEqual(rabaisses(".combat-choix button { min-height: 0; }"), [".combat-choix button"]);

  // Mission § 10.8.
  const definis = jetons(JETONS, "clair");
  assert.equal(enRem(valeur(COMBAT, ".combat-lignes", "max-height"), definis), 18);
  assert.equal(enRem(valeur(COMBAT, ".combat-lignes", "max-height", MEDIA_56), definis), 24);
  assert.equal(valeur(COMBAT, ".combat-lignes", "max-height", MEDIA_80), null);
  assert.equal(valeur(COMBAT, ".combat-lignes", "overflow"), "auto");
  assert.equal(enRem("calc(var(--espace-6) * 10)", definis), 20);
  assert.equal(enRem("20rem", definis), null);
  assert.equal(valeur(COMBAT, ".combat-lignes", "font-family"), "var(--police-chasse-fixe)");
});

// ——— Les textes des deux feuilles ———

test("combat.css et jetons.css — un en-tête qui dit le pourquoi et le § 17 ; aucun signe invisible, aucune espace insécable ; des fins de ligne d'un seul genre", () => {
  assert.match(COMBAT, /^\/\* Le simulateur de combat \(SPECIFICATION\.md, § 17/);
  assert.match(JETONS, /Le simulateur de combat \(§ 17\)/);
  const INVISIBLES = new RegExp(`[${[0xad, 0xa0, 0x202f, 0xfeff].map((code) => String.fromCodePoint(code)).join("")}${String.fromCodePoint(0x200b)}-${String.fromCodePoint(0x200f)}${String.fromCodePoint(0x202a)}-${String.fromCodePoint(0x202e)}${String.fromCodePoint(0x2060)}-${String.fromCodePoint(0x2064)}${String.fromCodePoint(0x2066)}-${String.fromCodePoint(0x2069)}]`, "u");
  for (const [nom, texte] of [["css/combat.css", COMBAT], ["css/jetons.css", JETONS], ["tests/combat_styles.test.js", lire("tests/combat_styles.test.js")]]) {
    assert.doesNotMatch(texte, INVISIBLES, nom);
    const windows = (texte.match(/\r\n/g) ?? []).length;
    const toutes = (texte.match(/\n/g) ?? []).length;
    assert.ok(windows === 0 || windows === toutes, `${nom} mêle deux fins de ligne`);
  }
  assert.match(`a${String.fromCodePoint(0x200b)}b`, INVISIBLES);
  assert.match(`a${String.fromCodePoint(0xa0)}b`, INVISIBLES);
  assert.doesNotMatch("a → b ✓ ✗ − · — « »", INVISIBLES);
});
