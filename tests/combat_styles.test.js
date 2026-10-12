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
    // « :where(.combat) » en part aussi, sans rien peser (la police, plus bas).
    if (!/^(?:\.combat(?![\w])|\.combat-[a-z]|:where\(\.combat\) [a-z]|#ecran:has\(> \.combat\)$)/.test(selecteur)) defauts.push(`règle hors de l'écran du combat : ${selecteur}`);
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
  refuse(":where(.fiche) button { margin: 0; }", /hors de l'écran du combat/);
  refuse(":where(button) { margin: 0; }", /hors de l'écran du combat/);
  assert.deepEqual(defautsDesClasses(".combat { margin: 0; }\n.combat-fiche.joue summary::after,\n.combat-copie .champ { margin: 0; }\n:where(.combat) button { font: inherit; }"), []);
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
    // Ce que le regard dans un navigateur a fait ajouter (la maquette).
    "combat-raison", "combat-plateau-tete", "combat-plateau-survol", "combat-nom-debut", "combat-nom-numero", "combat-qui-suite", "combat-description",
    "combat-sous-ligne", "combat-jauge-souffle",
    // Ce que la mesure des cases a fait ajouter (des initiales de trois signes, rognées par le rond).
    "combat-initiales-longues",
    // Ce que la relecture de fin de groupe a fait ajouter.
    "combat-assiste", "combat-mort", "combat-refus", "combat-fiche-avant", "combat-preparation-commence", "combat-preparation-lancer",
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
  // Le contour du focus est de la couleur d'accent, comme la marque de celui qui joue et d'un jeton tenu en main : sur
  // eux, il ne se voyait pas (mesuré dans un navigateur : aucun pixel ne changeait de 3:1). Un anneau de la couleur des
  // initiales, dans le rond, le montre.
  for (const marque of [".combat-jeton.joue", ".combat-jeton[aria-pressed=\"true\"]"]) {
    assert.equal(valeur(COMBAT, marque, "border-color"), "var(--accent)", marque);
    assert.equal(valeur(COMBAT, `${marque}:focus-visible .combat-rond`, "box-shadow"), "inset 0 0 0 calc(var(--trait) * 2) currentColor", marque);
  }
  // Cet anneau l'emporte sur le rond creux d'un jeton écarté, et rien ne l'efface après lui.
  const rang = (selecteur) => selecteursDe(COMBAT).findIndex((regle) => regle.selecteur === selecteur);
  assert.ok(pese(poids(".combat-jeton.joue:focus-visible .combat-rond")) > pese(poids(".combat-pj.inactif .combat-rond")));
  assert.ok(rang(".combat-jeton.joue:focus-visible .combat-rond") > rang(".combat-jeton.mort .combat-rond"));

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
  // Pendant un choix, une case d'arrivée possible est marquée : un trait discontinu d'accent (mission § 10.4).
  assert.match(valeur(COMBAT, ".combat-case.possible", "border"), /dashed var\(--accent\)$/);
  // L'armure : signalée dès qu'elle baisse, en rouge à 0 (mission § 10.5).
  assert.equal(valeur(COMBAT, ".combat-zones .abimee", "color"), "var(--combat-alerte)");
  assert.equal(valeur(COMBAT, ".combat-zones .detruite", "color"), "var(--combat-echec)");
  for (const etat of ["abimee", "detruite"]) assert.equal(valeur(COMBAT, `.combat-zones .${etat}`, "font-weight"), "var(--graisse-forte)", etat);
  // Le rang de dégâts atteint, en évidence (mission § 10.6) : sa bordure et sa couleur, que les autres rangs n'ont pas.
  assert.match(valeur(COMBAT, ".combat-lettres li.atteinte", "border"), /solid var\(--combat-reussite\)$/);
  assert.equal(valeur(COMBAT, ".combat-lettres li.atteinte", "color"), "var(--combat-reussite)");
  assert.equal(valeur(COMBAT, ".combat-lettres li", "color"), "var(--texte-2)");
  assert.match(valeur(COMBAT, ".combat-lettres li", "border"), /solid var\(--bordure\)$/);

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
  // La barre du téléphone, comme la maquette : l'état, « Fin de tour » et « ⋯ » sur une ligne, les commandes au bout ;
  // ce que « ⋯ » ouvre sur sa rangée, sous lui ; l'état de l'enregistrement sur la sienne.
  assert.equal(valeur(COMBAT, ".combat-barre", "flex-wrap"), "wrap");
  assert.equal(valeur(COMBAT, ".combat-commandes", "flex"), "0 1 auto");
  assert.equal(valeur(COMBAT, ".combat-commandes", "margin-left"), "auto");
  assert.equal(valeur(COMBAT, ".combat-autres", "flex"), "1 1 100%");
  assert.equal(valeur(COMBAT, ".combat-autres", "justify-content"), "flex-end");
  assert.equal(valeur(COMBAT, ".combat-garde", "flex"), "1 1 100%");
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
    assert.match(tailles[1], /^(?:\d+cqi|min\(var\(--taille-petite\), (?:\d+cqi|max\(calc\(var\(--taille-petite\) \* 0\.7\), \d+cqi\))\))$/);
  }
  // À partir de 56rem, le nom court fait 15 % du côté de la case, comme sur la maquette (10,5 px dans une case de 72),
  // jamais plus que le petit texte du site, ni moins que ses sept dixièmes. À 20 %, presque tous les noms étaient coupés
  // (mesuré : 44 jetons sur 46 à 1 440 px). Le rond et le « +k » suivent la même mesure.
  const MESURE = "min(var(--taille-petite), max(calc(var(--taille-petite) * 0.7), 15cqi))";
  assert.equal(valeur(COMBAT, ".combat-jeton", "font-size", MEDIA_56), MESURE);
  assert.equal(valeur(COMBAT, ".combat-grille .combat-rond", "width", MEDIA_56), MESURE);
  assert.equal(valeur(COMBAT, ".combat-plus-large", "font-size", MEDIA_56), MESURE);
  // Le plancher : 9,8 px, que le texte de la carte ne passe pas.
  assert.equal(Math.round(parseFloat(jetons(JETONS, "clair")["taille-petite"]) * 16 * 0.7 * 10) / 10, 9.8);
  assert.equal((sansCommentaires(COMBAT).match(/\d+cqi/g) ?? []).filter((mesure) => mesure === "20cqi").length, 0, "plus aucune mesure à 20 % de la case");
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
  // Le nom court se coupe, jamais le numéro d'exemplaire qui le finit.
  assert.equal(valeur(COMBAT, ".combat-nom-court", "display", MEDIA_56), "flex");
  assert.equal(valeur(COMBAT, ".combat-nom-court", "min-width", MEDIA_56), "0");
  assert.equal(valeur(COMBAT, ".combat-nom-court", "white-space", MEDIA_56), "nowrap");
  assert.equal(valeur(COMBAT, ".combat-nom-debut", "text-overflow", MEDIA_56), "ellipsis");
  assert.equal(valeur(COMBAT, ".combat-nom-debut", "overflow", MEDIA_56), "hidden");
  assert.equal(valeur(COMBAT, ".combat-nom-debut", "min-width", MEDIA_56), "0");
  assert.equal(valeur(COMBAT, ".combat-nom-numero", "flex", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-nom-numero", "overflow", MEDIA_56), null);
  assert.equal(valeur(COMBAT, ".combat-grille .combat-initiales", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton", "display", MEDIA_56), "flex");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton ~ .combat-jeton", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-etroit", "display", MEDIA_56), "none");
  assert.equal(valeur(COMBAT, ".combat-plus-large", "display", MEDIA_56), "block");
  // Le « +k » large ne prend aucune ligne aux trois jetons, ni aucune largeur
  // aux deux premiers : il partage la troisième ligne avec le troisième.
  assert.equal(valeur(COMBAT, ".combat-plus-large", "grid-column", MEDIA_56), "2");
  assert.equal(valeur(COMBAT, ".combat-plus-large", "grid-row", MEDIA_56), "3");
  assert.equal(valeur(COMBAT, ".combat-jeton", "grid-column", MEDIA_56), "1 / -1");
  assert.equal(valeur(COMBAT, ".combat-jeton ~ .combat-jeton ~ .combat-jeton", "grid-column", MEDIA_56), "1");
  assert.equal(valeur(COMBAT, ".combat-case", "grid-template-columns", MEDIA_56), "minmax(0, 1fr) auto");
  // Le bouton d'une case qu'on choisit la couvre, sous ses jetons : jamais un bouton dans un bouton.
  assert.equal(valeur(COMBAT, ".combat-case-choix", "position"), "absolute");
  assert.equal(valeur(COMBAT, ".combat-case-choix", "inset"), "0");
  assert.equal(valeur(COMBAT, ".combat-jeton", "z-index"), "1");
  // Les seuls positionnements absolus, avec la raison d'un bouton inactif et la région d'annonce.
  assert.deepEqual(selecteursDe(COMBAT).filter((regle) => /position:\s*(?:absolute|fixed|sticky)/.test(regle.corps)).map((regle) => regle.selecteur), [".combat-case-choix", ".combat-raison", ".combat-annonce"]);
  // L'en-tête de la carte ; sa seconde phrase ne se montre que là où une souris survole.
  assert.equal(valeur(COMBAT, ".combat-plateau-tete", "display"), "flex");
  assert.equal(valeur(COMBAT, ".combat-plateau-tete", "flex-wrap"), "wrap");
  assert.equal(valeur(COMBAT, ".combat-plateau-survol", "display"), "none");
  assert.equal(valeur(COMBAT, ".combat-plateau-survol", "display", MEDIA_56), "inline");
});

// ——— La cascade : ce qu'un navigateur a montré ———

// Le poids d'un sélecteur : [identifiants, classes, balises]. « :where(…) »
// ne pèse rien ; « :has(…) », « :is(…) » et « :not(…) » pèsent ce qu'ils
// contiennent ; une autre pseudo-classe et un attribut pèsent une classe.
function poids(selecteur) {
  const texte = selecteur.replace(/:where\([^()]*\)/g, " ").replace(/:(?:has|is|not)\(/g, " (").replace(/\[[^\]]*\]/g, "[a]");
  const identifiants = (texte.match(/#[\w-]+/g) ?? []).length;
  const classes = (texte.match(/\.[\w-]+|\[a\]|(?<!:):(?!:)[\w-]+/g) ?? []).length;
  const balises = (texte.replace(/#[\w-]+|\.[\w-]+|\[a\]|::?[\w-]+(?:\([^()]*\))?/g, " ").match(/[a-z][\w-]*/gi) ?? []).length + (texte.match(/::[\w-]+/g) ?? []).length;
  return [identifiants, classes, balises];
}
const pese = ([a, b, c]) => a * 10000 + b * 100 + c;
const POLICE = /^(?:font|font-size|font-weight|font-family|line-height)$/;
// Une règle générale : son sujet est une balise qui s'actionne, sans classe.
const GENERALE = /(?:^|[\s>+~])(?:button|select|textarea|input)$/;

/**
 * Les règles générales qui règlent la police en pesant autant qu'une classe.
 * Une telle règle l'emporte sur « .combat-de », « .combat-jeton » ou
 * « .bouton », qui ne pèsent qu'une classe : la taille, la graisse et
 * l'interligne qu'elles se donnent sont alors perdus, sans bruit.
 */
function policesEcrasees(css) {
  return selecteursDe(css)
    .filter((regle) => GENERALE.test(regle.selecteur) && declarations(regle.corps).some(([propriete]) => POLICE.test(propriete)))
    .filter((regle) => pese(poids(regle.selecteur)) >= pese([0, 1, 0]))
    .map((regle) => regle.selecteur);
}

test("combat.css — aucune règle générale ne l'emporte sur la police d'une classe : un dé, un jeton et un bouton gardent leur taille, leur graisse et leur interligne", () => {
  // Les poids, sur des sélecteurs de la feuille.
  assert.deepEqual(poids(".combat button"), [0, 1, 1]);
  assert.deepEqual(poids(":where(.combat) button"), [0, 0, 1]);
  assert.deepEqual(poids(".combat-de"), [0, 1, 0]);
  assert.deepEqual(poids(".combat-cibles button[aria-pressed=\"true\"]"), [0, 2, 1]);
  assert.deepEqual(poids(".combat-fiche[open] summary::after"), [0, 2, 2]);
  assert.deepEqual(poids("#ecran:has(> .combat)"), [1, 1, 0]);
  assert.deepEqual(poids(".combat-jeton ~ .combat-jeton ~ .combat-jeton"), [0, 3, 0]);
  assert.deepEqual(poids(".combat-coord:nth-child(n + 12)"), [0, 2, 0]);

  assert.deepEqual(policesEcrasees(COMBAT), []);
  // La feuille telle qu'elle a été vue dans Edge 155 et Firefox 143 : « font:
  // inherit » sous « .combat button » rendait à un dé 16 px sur 24 (ses
  // étiquettes sortaient de 6 px en haut et en bas), et à un jeton de même.
  assert.deepEqual(policesEcrasees(".combat button,\n.combat select {\n  min-height: var(--cible-tactile);\n  font: inherit;\n}"), [".combat button", ".combat select"]);
  assert.deepEqual(policesEcrasees(".combat-grille button {\n  min-width: 0;\n  font: inherit;\n}"), [".combat-grille button"]);
  assert.deepEqual(policesEcrasees(".combat-choix > button { line-height: 1; }"), [".combat-choix > button"]);
  assert.deepEqual(policesEcrasees(".combat input { font-size: var(--taille-petite); }"), [".combat input"]);
  // Ce qui ne pèse rien, ou qui ne touche pas à la police, passe.
  assert.deepEqual(policesEcrasees(":where(.combat) button { font: inherit; }\n.combat button { min-height: var(--cible-tactile); }\n.combat-cibles button { color: var(--texte); }"), []);

  // La police du site arrive par une règle qui ne pèse rien, pour les quatre balises.
  for (const balise of ["button", "select", "textarea", "input"]) assert.equal(valeur(COMBAT, `:where(.combat) ${balise}`, "font"), "inherit", balise);
  // Et ce que le dé et le jeton se donnent est bien écrit sur leur seule classe.
  assert.equal(valeur(COMBAT, ".combat-de", "line-height"), "1");
  assert.equal(valeur(COMBAT, ".combat-de", "font-weight"), "var(--graisse-forte)");
  assert.equal(valeur(COMBAT, ".combat-jeton", "line-height"), "1");
  assert.equal(valeur(COMBAT, ".combat-case-plus", "line-height"), "1");
});

// ——— Un bouton inactif, une saisie refusée : ils se voient ———

test("combat.css — un bouton du site rendu inactif n'a pas l'aspect d'un bouton actif ; une saisie refusée se voit ; aucune opacité", () => {
  // « Fin de tour » pendant un geste, « Lancer le combat », « Ajouter », « Copier », « Confirmer », un pas de la
  // puissance : comme une capacité inactive, trait discontinu, fond transparent, texte gris. Dans un navigateur, seul
  // le curseur changeait (0 pixel sur 6 292).
  const inactif = ".combat .bouton[aria-disabled=\"true\"]";
  for (const [propriete, attendue] of [["border-style", "dashed"], ["border-color", "var(--bordure)"], ["background", "transparent"], ["color", "var(--texte-2)"]]) {
    assert.equal(valeur(COMBAT, inactif, propriete), attendue, propriete);
    if (propriete !== "border-color") assert.equal(valeur(COMBAT, ".combat-capacite[aria-disabled=\"true\"]", propriete), attendue, `une capacité inactive : ${propriete}`);
  }
  // La règle l'emporte sur les deux boutons du site, le principal et le secondaire (css/ecran.css).
  for (const duSite of [".bouton", ".bouton.secondaire"]) assert.ok(pese(poids(inactif)) > pese(poids(duSite)), duSite);
  assert.deepEqual(declarations(regles(COMBAT).find((regle) => regle.selecteur === inactif).corps).map(([propriete]) => propriete).filter((propriete) => /opacity|filter/.test(propriete)), []);
  // Son texte et son trait tiennent leur contraste, sur les deux fonds et dans les deux thèmes.
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(JETONS, theme);
    for (const fond of ["fond", "fond-2"]) {
      assert.ok(contraste(j["texte-2"], j[fond]) >= 4.5, `${theme} : le texte sur --${fond}`);
      assert.ok(contraste(j.bordure, j[fond]) >= 3, `${theme} : le trait sur --${fond}`);
    }
  }
  // La cible choisie, que le jet rend inactive, n'est pas un choix écarté : son nom garde la couleur du texte, après la règle des inactifs.
  const choisie = ".combat-cibles button[aria-pressed=\"true\"][aria-disabled=\"true\"]";
  assert.equal(valeur(COMBAT, choisie, "color"), "var(--texte)");
  const rang = (selecteur) => selecteursDe(COMBAT).findIndex((regle) => regle.selecteur === selecteur);
  assert.ok(rang(choisie) > rang(".combat-cibles button[aria-disabled=\"true\"]"));
  assert.ok(pese(poids(choisie)) > pese(poids(".combat-cibles button[aria-disabled=\"true\"]")));

  // Une saisie refusée : le champ prend le rouge de l'échec, sans changer de taille ; sa phrase aussi.
  assert.equal(valeur(COMBAT, ".combat [aria-invalid=\"true\"]", "border-color"), "var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat [aria-invalid=\"true\"]", "box-shadow"), "inset 0 0 0 var(--trait) var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat [aria-invalid=\"true\"]", "border-width"), null, "le champ ne change pas de taille");
  assert.equal(valeur(COMBAT, ".combat-refus", "color"), "var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat-refus", "display"), null, "cachée par son attribut tant que rien n'est refusé");
});

// ——— La raison d'un bouton inactif ———

test("combat.css — la raison d'un bouton inactif ne s'écrit pas à côté de lui : elle se lit sous sa rangée au survol et au focus", () => {
  assert.equal(valeur(COMBAT, ".combat-raison", "display"), "none");
  assert.equal(valeur(COMBAT, ".combat-raison", "position"), "absolute");
  assert.equal(valeur(COMBAT, ".combat-raison", "top"), "100%");
  assert.equal(valeur(COMBAT, ".combat-raison", "max-width"), "100%");
  // Elle se lit sur le fond, dans la couleur du texte : pas une couleur de second rang.
  assert.equal(valeur(COMBAT, ".combat-raison", "background"), "var(--fond)");
  assert.equal(valeur(COMBAT, ".combat-raison", "color"), "var(--texte)");
  // Au survol (souris, doigt) et au focus (clavier, doigt) du bouton qui la précède.
  for (const etat of ["hover", "focus"]) assert.equal(valeur(COMBAT, `.combat [aria-disabled="true"]:${etat} + .combat-raison`, "display"), "block", etat);
  // Chaque rangée qui porte un bouton à raison la tient sous elle.
  for (const rangee of [".combat-commandes", ".combat-autres", ".combat-groupe", ".combat-cibles", ".combat-choix", ".combat-ligne"]) {
    assert.equal(valeur(COMBAT, rangee, "position"), "relative", rangee);
  }
  // Sur un grand écran, celle de « Fin de tour » se range sous lui, au bout de la barre (vu : elle paraissait sous « Nouveau combat »).
  assert.equal(valeur(COMBAT, ".combat-commandes > .combat-raison", "right", MEDIA_56), "0");
  assert.equal(valeur(COMBAT, ".combat-commandes > .combat-raison", "left", MEDIA_56), "auto");
  // Rien d'autre ne la montre : ni une règle sans survol ni focus, ni un affichage dans un @media.
  const montrent = (css) => selecteursDe(css).filter((regle) => /\.combat-raison$/.test(regle.selecteur) && /display:\s*(?!none)[a-z]/.test(regle.corps)).map((regle) => regle.selecteur);
  assert.deepEqual(montrent(COMBAT), [".combat [aria-disabled=\"true\"]:hover + .combat-raison", ".combat [aria-disabled=\"true\"]:focus + .combat-raison"]);
  assert.deepEqual(montrent(".combat-raison { display: none; }\n.combat-groupe .combat-raison { display: inline; }"), [".combat-groupe .combat-raison"]);
});

// ——— La barre, les fiches, le panneau : la maquette ———

test("combat.css — comme sur la maquette : « Fin de tour » ferme la barre ; l'état suit la ligne sous le nom ; les jauges, la résistance, le texte de la capacité", () => {
  // La barre : sur un grand écran, tout sur une ligne ; l'enregistrement, puis, au bout, « Nouveau combat » devant
  // « Fin de tour », bouton principal. Le document, lui, garde l'ordre du téléphone.
  assert.equal(valeur(COMBAT, ".combat-autres", "order", MEDIA_56), "1");
  assert.equal(valeur(COMBAT, ".combat-commandes", "order", MEDIA_56), "2");
  assert.equal(valeur(COMBAT, ".combat-commandes", "margin-left", MEDIA_56), "0");
  // L'état de l'enregistrement prend la place libre et pousse les boutons au bout ; ce qui passe à la ligne, vers 56rem,
  // reste à droite (vu à 900 px : « Fin de tour » tombait seul à gauche, sous le titre), et le titre reste à gauche.
  assert.equal(valeur(COMBAT, ".combat-garde", "flex", MEDIA_56), "1 1 auto");
  assert.equal(valeur(COMBAT, ".combat-barre", "justify-content", MEDIA_56), "flex-end");
  assert.equal(valeur(COMBAT, ".combat-etat", "margin-right", MEDIA_56), "auto");
  assert.equal(valeur(COMBAT, ".combat-barre", "justify-content"), null);
  assert.equal(valeur(COMBAT, ".combat-garde", "order", MEDIA_56), null);
  for (const selecteur of [".combat-autres", ".combat-commandes", ".combat-garde"]) assert.equal(valeur(COMBAT, selecteur, "order"), null, selecteur);

  // L'en-tête d'une fiche : deux lignes, et l'état dans la seconde, à la suite.
  assert.equal(valeur(COMBAT, ".combat-fiche summary", "grid-template-areas"), "\"pastille nom actions repli\" \"pastille sous sous repli\"");
  assert.equal(valeur(COMBAT, ".combat-sous-ligne", "grid-area"), "sous");
  // Le point qui les sépare tient à la ligne : un état passé à la ligne ne commence pas par un point.
  assert.equal(valeur(COMBAT, ".combat-sous:not(:last-child)::after", "content"), "\" ·\"");
  assert.equal(valeur(COMBAT, ".combat-statut", "white-space"), "nowrap");
  assert.ok(!selecteursDe(COMBAT).some((regle) => /\.combat-statut/.test(regle.selecteur) && /grid-area|justify-self/.test(regle.corps)), "l'état n'a plus de place à lui");
  // Un mort n'a plus d'action à montrer.
  assert.equal(valeur(COMBAT, ".combat-fiche.morte .combat-actions", "display"), "none");

  // Une jauge : le nom, des cases qui se partagent la largeur, le nombre à droite.
  assert.equal(valeur(COMBAT, ".combat-jauge", "display"), "flex");
  assert.equal(valeur(COMBAT, ".combat-jauge", "flex-wrap"), null);
  assert.equal(valeur(COMBAT, ".combat-jauge > :first-child", "min-width"), "var(--largeur-etiquette)");
  assert.equal(valeur(COMBAT, ".combat-jauge > :last-child", "margin-left"), "auto");
  assert.equal(valeur(COMBAT, ".combat-point", "flex"), "1 1 0");
  assert.equal(valeur(COMBAT, ".combat-jauge-souffle .combat-point", "background"), "var(--accent)");
  assert.equal(valeur(COMBAT, ".combat-jauge .combat-point.vide", "background"), "transparent");
  // La résistance : une case intacte est vide, une case perdue est pleine.
  assert.equal(valeur(COMBAT, ".combat-zones .combat-point", "background"), "transparent");
  assert.equal(valeur(COMBAT, ".combat-zones .combat-point.vide", "background"), "var(--combat-echec)");
  // La table : l'armure rangée à droite, les noms abrégés sans soulignement.
  assert.equal(valeur(COMBAT, ".combat-zones td:nth-child(3)", "text-align"), "right");
  assert.equal(valeur(COMBAT, ".combat-zones abbr", "text-decoration"), "none");

  // Le titre du panneau : la suite plus bas que le nom.
  assert.equal(valeur(COMBAT, ".combat-qui-suite", "font-weight"), "normal");
  assert.equal(valeur(COMBAT, ".combat-qui-suite", "color"), "var(--texte-2)");
  // Le texte de la capacité, dans son cadre.
  assert.match(valeur(COMBAT, ".combat-description", "border"), /solid var\(--separateur\)$/);
  assert.equal(valeur(COMBAT, ".combat-description", "background"), "var(--fond)");
  // Un dé grandit avec ce qu'il porte, jamais en deçà de son carré.
  assert.equal(valeur(COMBAT, ".combat-chaine .combat-de", "width"), "auto");
  for (const cadre of [null, MEDIA_56]) assert.equal(valeur(COMBAT, ".combat-chaine .combat-de", "min-width", cadre), valeur(COMBAT, ".combat-de", "width", cadre), `${cadre}`);
  // Ses trois lignes (14, 24 et 14 px) y tiennent : 68 px sur un téléphone (à 60, elles touchaient le bord), 76 au-delà, comme la maquette.
  const definis = jetons(JETONS, "clair");
  const cote = (cadre) => {
    const [, espace] = valeur(COMBAT, ".combat-de", "height", cadre).match(/^calc\(var\(--cible-tactile\) \+ var\(--(espace-\d)\)\)$/);
    return parseFloat(definis["cible-tactile"]) + parseFloat(definis[espace]) * 16;
  };
  assert.equal(cote(null), 68);
  assert.equal(cote(MEDIA_56), 76);

  // Une rangée : son intitulé se centre sur ses boutons ; un nombre n'en prend pas toute la largeur.
  assert.equal(valeur(COMBAT, ".combat-ligne > span", "align-self"), "center");
  assert.equal(enRem(valeur(COMBAT, ".combat input[type=\"number\"]", "width"), definis), 6);
  // La préparation : son lien vers les personnages est une cible de 44 px.
  assert.equal(valeur(COMBAT, ".combat-preparation a", "min-height"), "var(--cible-tactile)");
  assert.equal(valeur(COMBAT, ".combat-preparation a", "display"), "inline-flex");
});

// ——— Ce que la relecture de fin de groupe a montré ———

test("combat.css — le dé relancé garde le rouge de son échec ; au journal, la seule phrase de la mort ; la place de la barre de défilement", () => {
  // Un dé relancé est toujours un échec : il en garde le rouge, en trait discontinu ; sa valeur, grisée, reste barrée.
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-color"), "var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-color"), valeur(COMBAT, ".combat-de.echoue", "border-color"));
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-style"), "dashed");
  assert.equal(valeur(COMBAT, ".combat-de.relance", "color"), "var(--texte-2)");
  assert.equal(valeur(COMBAT, ".combat-de.relance .combat-de-valeur", "text-decoration"), "line-through");

  // Au journal, la phrase de la mort seule est en évidence, comme sur la maquette : aucune règle ne colore une ligne entière.
  assert.equal(valeur(COMBAT, ".combat-lignes .combat-mort", "color"), "var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat-lignes .combat-mort", "font-weight"), "var(--graisse-forte)");
  assert.deepEqual(selecteursDe(COMBAT).filter((regle) => /^\.combat-lignes li\.mort\b/.test(regle.selecteur)).map((regle) => regle.selecteur), []);
  // Dans Firefox, la barre de défilement se pose sur le contenu : le journal lui laisse sa place, à droite.
  assert.equal(valeur(COMBAT, ".combat-lignes", "padding"), "0 var(--espace-3) 0 0");
});

test("combat.css — la préparation : « Qui commence » sur sa ligne puis ses deux options ; à 56rem, avec « Lancer le combat » au bout de sa rangée", () => {
  // Sur un téléphone, l'intitulé prend sa ligne : ses deux options restent ensemble.
  assert.equal(valeur(COMBAT, ".combat-preparation-commence .combat-ligne > span", "flex"), "0 0 100%");
  assert.equal(valeur(COMBAT, ".combat-preparation-commence .combat-ligne > span", "flex", MEDIA_56), "0 0 auto");
  assert.equal(valeur(COMBAT, ".combat-ligne", "flex-wrap"), "wrap");
  // Rien de la barre de la maquette sous 56rem : les blocs s'y empilent.
  assert.equal(valeur(COMBAT, ".combat-preparation", "display"), null);
  // À 56rem : chaque bloc sur sa rangée, sauf ces deux-là, le second poussé au bout.
  assert.equal(valeur(COMBAT, ".combat-preparation", "display", MEDIA_56), "flex");
  assert.equal(valeur(COMBAT, ".combat-preparation", "flex-wrap", MEDIA_56), "wrap");
  assert.equal(valeur(COMBAT, ".combat-preparation > *", "flex", MEDIA_56), "0 0 100%");
  assert.equal(valeur(COMBAT, ".combat-preparation > .combat-preparation-commence", "flex", MEDIA_56), "1 1 auto");
  assert.equal(valeur(COMBAT, ".combat-preparation > .combat-preparation-lancer", "flex", MEDIA_56), "0 1 auto");
  assert.equal(valeur(COMBAT, ".combat-preparation > .combat-preparation-lancer", "margin-left", MEDIA_56), "auto");
  assert.equal(valeur(COMBAT, ".combat-preparation-lancer .combat-ligne", "justify-content", MEDIA_56), "flex-end");
  // Ces deux règles pèsent plus que celle de tous les blocs, qu'elles suivent.
  for (const bloc of ["commence", "lancer"]) assert.ok(pese(poids(`.combat-preparation > .combat-preparation-${bloc}`)) > pese(poids(".combat-preparation > *")), bloc);
});

test("combat.css — les réglages à la main entre le contexte et les dés dans le document ; à 56rem, la grille les range à droite, sous le texte de la capacité", () => {
  // Sous 56rem : une colonne, dans l'ordre du document ; aucun placement.
  assert.equal(valeur(COMBAT, ".combat-des", "grid-template-columns"), "minmax(0, 1fr)");
  for (const bloc of [".combat-contexte", ".combat-jet", ".combat-reglages", ".combat-assiste"]) {
    assert.equal(valeur(COMBAT, bloc, "min-width"), "0", bloc);
    for (const propriete of ["grid-column", "grid-row", "order"]) assert.equal(valeur(COMBAT, bloc, propriete), null, `${bloc} ${propriete}`);
  }
  // À 56rem : les dés à gauche, la place de la palette à droite.
  assert.equal(valeur(COMBAT, ".combat-des", "grid-template-columns", MEDIA_56), "minmax(0, 2fr) minmax(0, 1fr)");
  // Le contexte a sa rangée, les dés la rangée souple : le texte de la capacité, qui la traverse, n'écarte jamais le contexte des dés.
  assert.equal(valeur(COMBAT, ".combat-des", "grid-template-rows", MEDIA_56), "auto 1fr auto");
  assert.equal(valeur(COMBAT, ".combat-des", "row-gap", MEDIA_56), "0");
  assert.deepEqual([valeur(COMBAT, ".combat-contexte", "grid-column", MEDIA_56), valeur(COMBAT, ".combat-contexte", "grid-row", MEDIA_56)], ["1", "1"]);
  assert.deepEqual([valeur(COMBAT, ".combat-jet", "grid-column", MEDIA_56), valeur(COMBAT, ".combat-jet", "grid-row", MEDIA_56)], ["1", "2 / span 2"]);
  for (const bloc of [".combat-reglages", ".combat-assiste"]) {
    assert.equal(valeur(COMBAT, bloc, "grid-column", MEDIA_56), "2", bloc);
    assert.match(valeur(COMBAT, bloc, "border-left", MEDIA_56), /solid var\(--separateur\)$/, bloc);
  }
  assert.equal(valeur(COMBAT, ".combat-assiste", "grid-row", MEDIA_56), "1 / span 2");
  // Seuls à droite, les réglages prennent toute la hauteur ; sous le texte de la capacité, la dernière rangée.
  assert.equal(valeur(COMBAT, ".combat-reglages", "grid-row", MEDIA_56), "1 / span 3");
  assert.equal(valeur(COMBAT, ".combat-des:has(> .combat-assiste) > .combat-reglages", "grid-row", MEDIA_56), "3");
  assert.ok(pese(poids(".combat-des:has(> .combat-assiste) > .combat-reglages")) > pese(poids(".combat-reglages")));
});

test("combat.css — les fiches : le nom d'une zone, en-tête de sa ligne ; « Case » et « Retirer » sous la fiche ; à 200 %, la table défile dans la fiche", () => {
  // Le nom d'une zone est un en-tête de ligne, et se lit comme le texte ; les en-têtes de colonne restent en gris.
  assert.equal(valeur(COMBAT, ".combat-zones tbody th", "color"), "var(--texte)");
  assert.equal(valeur(COMBAT, ".combat-zones th", "color"), "var(--texte-2)");
  assert.ok(pese(poids(".combat-zones tbody th")) > pese(poids(".combat-zones th")));
  assert.equal(valeur(COMBAT, ".combat-zones th", "font-weight"), "normal");
  // Avec le texte à 200 % sur un téléphone, la table défile dans la fiche, non la page.
  assert.equal(valeur(COMBAT, ".combat-fiche-corps", "overflow-x"), "auto");
  // Avant le lancement, le groupe du champ « Case » prolonge le cadre de la fiche, hors du volet ; son champ ne prend pas la rangée.
  assert.equal(valeur(COMBAT, ".combat-fiche:has(+ .combat-fiche-avant)", "margin-bottom"), "0");
  assert.match(valeur(COMBAT, ".combat-fiche-avant", "border"), /solid var\(--separateur\)$/);
  assert.equal(valeur(COMBAT, ".combat-fiche-avant", "border-top"), "0");
  assert.equal(valeur(COMBAT, ".combat-fiche-avant", "background"), valeur(COMBAT, ".combat-fiche", "background"));
  assert.equal(valeur(COMBAT, ".combat-fiche-avant", "display"), null, "toujours visible : rien ne le cache");
  assert.equal(enRem(valeur(COMBAT, ".combat-fiche-avant .champ", "width"), jetons(JETONS, "clair")), 6);
  assert.equal(valeur(COMBAT, ".combat-fiche-avant .champ", "margin-bottom"), "0");
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
  // Vide, le journal quitte la page : une liste sans hauteur ne garde pas un arrêt du clavier (vu avant le lancement).
  assert.equal(valeur(COMBAT, ".combat-lignes:empty", "display"), "none");
  for (const vide of [".combat-avis:empty", ".combat-panneau:empty", ".combat-case-liste:empty", ".combat-copie:empty"]) assert.equal(valeur(COMBAT, vide, "display"), "none", vide);
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
