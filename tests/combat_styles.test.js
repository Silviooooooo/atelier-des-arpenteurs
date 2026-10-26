// Contrôles des feuilles de style du simulateur de combat (SPECIFICATION.md,
// § 17 ; l'interface, § 9 ; les jetons, § 10.1 ; le complément du lot 4,
// groupe 2, § 4.1, § 4.8 et § 4.12).
//
// css/combat.css et css/jetons.css y sont lus comme des textes : aucun
// navigateur ne tourne ici, et la mise en page se mesure ailleurs. Ce fichier
// tient ce qu'un texte peut tenir : des jetons seulement (et les trois
// propriétés que js/ecrans/echelle.js écrit sur la bulle), les trois @media,
// les classes, le contour réservé au focus, les quinze couleurs dans les deux
// thèmes et leurs contrastes, les quinze longueurs du groupe 2, les trois
// dispositions, la bulle et son volet, ses lignes, la hachure, le bandeau, les
// segments du journal et le cadre d'un jet. Depuis la relecture de fin du
// groupe 2 : la flèche de la bulle enfin dessinée, la plaque des jetons d'une
// case hachurée, les passifs à 44 px, les lignes plates et seules à 36 px
// (data-ligne, lu aussi dans js/ecrans/combat_action.js), le dé relancé barré
// d'un fond, la marge de défilement du volet. Depuis les captures finales du
// groupe 2 : aucune ligne du journal sautée hors de la vue (sa dernière ligne
// reste vue), le trait pointillé des passifs sous leur nom même, « Passer son
// tour » en rangée plate dans la bulle (.combat-option, lu aussi dans
// js/ecrans/combat_action.js).
//
// Chaque règle est une fonction qui rend la liste des défauts : vide sur la
// feuille du dépôt, non vide sur une feuille fautive écrite ici même. Une
// règle qui ne refuserait rien se verrait donc.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLECHE } from "../js/ecrans/echelle.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const COMBAT = lire("css/combat.css");
const JETONS = lire("css/jetons.css");
const ECHELLE = lire("js/ecrans/echelle.js");

// Les propriétés que placerBulle écrit sur la bulle, son onglet et les
// infobulles (js/ecrans/echelle.js, la seule écriture de style du code) : lues
// dans son corps, jusqu'à la première accolade fermante en début de ligne. La
// feuille les lit sans les déclarer dans jetons.css.
function proprietesDePlacerBulle(source) {
  const debut = source.indexOf("export function placerBulle(");
  if (debut < 0) return [];
  const fin = source.indexOf("\n}", debut);
  return [...source.slice(debut, fin < 0 ? undefined : fin).matchAll(/setProperty\(\s*"--([\w-]+)"/g)].map(([, nom]) => nom);
}
const DE_LA_BULLE = proprietesDePlacerBulle(ECHELLE);

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
const MEDIA_SOURIS = "@media (pointer: fine)";
// Le rang d'une règle dans la feuille (son premier sélecteur exact, hors @media ou dans le cadre donné), -1 sans elle.
const rangDe = (css, selecteur, cadre = null) => selecteursDe(css).findIndex((regle) => regle.selecteur === selecteur && regle.cadre === cadre);

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

test("combat.css — des jetons seulement : ni couleur, ni longueur, ni police en dur, hors des largeurs des @media ; les --bulle-* de placerBulle admises, sans repli", () => {
  // Les trois propriétés de la place de la bulle (contrat § 9.3), lues dans echelle.js ; jetons.css n'en déclare aucune.
  assert.deepEqual(DE_LA_BULLE, ["bulle-gauche", "bulle-haut", "bulle-fleche"]);
  assert.deepEqual(Object.keys(jetons(JETONS, "sombre")).filter((nom) => nom.startsWith("bulle-")), []);
  for (const nom of DE_LA_BULLE) assert.ok(COMBAT.includes(`var(--${nom})`), `--${nom} n'est pas lue par la feuille`);
  assert.deepEqual(proprietesDePlacerBulle("export function placerBulle(n) {\n  n.style.setProperty(\"--bulle-x\", \"1px\");\n}\nexport function autre(n) {\n  n.style.setProperty(\"--hors\", \"1px\");\n}\n"), ["bulle-x"]);
  assert.deepEqual(proprietesDePlacerBulle("export function poserEchelle(n) {}\n"), []);
  const definis = new Set([...Object.keys(jetons(JETONS, "clair")), ...DE_LA_BULLE]);
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
  // Une autre propriété de la bulle que celles que placerBulle écrit, ou l'une d'elles lue avec un repli.
  refuse(".combat-bulle { left: var(--bulle-x); }", /--bulle-x n'est pas défini dans jetons\.css/);
  refuse(".combat-bulle { left: var(--bulle-gauche, 0); }", /--bulle-gauche lu avec une valeur de repli/);
  assert.deepEqual(valeursEnDur(".combat-bulle {\n  top: var(--bulle-haut);\n  left: var(--bulle-gauche);\n}", definis), []);
  assert.match(valeursEnDur(".combat-bulle { left: var(--bulle-gauche); }", new Set(Object.keys(jetons(JETONS, "clair")))).join("\n"), /--bulle-gauche n'est pas défini/);
  refuse("@import \"autre.css\";", /téléchargée/);
  // Les pièges du contrôle du site (tests/site.test.js) sont refusés ici aussi.
  refuse("@container (min-width: 40rem) {\n  .combat-x { display: none; }\n}", /valeur écrite en dur/);
  refuse("@media\n  (min-width: 80rem) {\n  .combat-x { display: none; }\n}", /valeur écrite en dur/);
  refuse("#face-contre { display: none; }", /couleur écrite en dur/);
  // Ce que la feuille emploie et qui n'est pas une longueur passe.
  assert.deepEqual(valeursEnDur(".combat-x {\n  grid-template-columns: var(--espace-4) repeat(10, minmax(0, 1fr));\n  font-size: min(var(--taille-petite), 20cqi);\n  width: 70%;\n  aspect-ratio: 1 / 1;\n}", definis), []);
});

// ——— Les trois @media ———

function defautsDesCadres(css) {
  const defauts = [];
  const arobases = lignesDe(css)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.includes("@"));
  const attendues = [`${MEDIA_56} {`, `${MEDIA_80} {`, `${MEDIA_SOURIS} {`];
  if (JSON.stringify(arobases) !== JSON.stringify(attendues)) defauts.push(`règles @ : ${JSON.stringify(arobases)}`);
  return defauts;
}

test("combat.css — trois @media, à 56rem, à 80rem, puis sous une souris, chacun sur une ligne, dans cet ordre ; aucune autre règle @", () => {
  assert.deepEqual(defautsDesCadres(COMBAT), []);
  const base = ".combat-x { display: none; }\n";
  const trois = `${base}${MEDIA_56} {\n${base}}\n${MEDIA_80} {\n${base}}\n${MEDIA_SOURIS} {\n${base}}\n`;
  assert.deepEqual(defautsDesCadres(trois), []);
  for (const fautive of [
    base,
    `${base}${MEDIA_56} {\n${base}}\n${MEDIA_80} {\n${base}}\n`,
    trois.replace("56rem", "44rem"),
    trois.replace("80rem", "79.99rem"),
    trois.replace("(pointer: fine)", "(pointer: coarse)"),
    trois.replace("(pointer: fine)", "(hover: hover)"),
    // Un quatrième @media.
    `${trois}@media (max-width: 700px) {\n${base}}\n`,
    `${trois}${MEDIA_SOURIS} {\n${base}}\n`,
    `${trois}@container (min-width: 40rem) {\n${base}}\n`,
    `${trois}@supports (display: grid) {\n${base}}\n`,
    `${trois}@media print {\n${base}}\n`,
    trois.replace(`${MEDIA_80} {`, "@media\n  (min-width: 80rem) {"),
    trois.replace(`${MEDIA_SOURIS} {`, "@media\n  (pointer: fine) {"),
    `${MEDIA_80} {\n${base}}\n${MEDIA_56} {\n${base}}\n${MEDIA_SOURIS} {\n${base}}\n`,
    `${MEDIA_SOURIS} {\n${base}}\n${MEDIA_56} {\n${base}}\n${MEDIA_80} {\n${base}}\n`,
  ]) {
    assert.notDeepEqual(defautsDesCadres(fautive), [], fautive);
  }
  // Chaque cadre porte des règles : la feuille n'a pas trois coquilles vides.
  for (const cadre of [MEDIA_56, MEDIA_80, MEDIA_SOURIS]) assert.ok(regles(COMBAT).some((regle) => regle.cadre === cadre), cadre);
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
// Les états du contrat (§ 7.9), écrits en classes de plus ; au groupe 2, la
// portée de la capacité survolée, sur une case et dans la légende.
const ETATS = new Set([
  "ouvert", "active", "possible", "inactive", "joue", "cible", "mort", "inactif", "fait", "en-cours", "reussi", "echoue", "relance", "a-lancer", "a-venir",
  "atteinte", "ciblee", "morte", "vide", "eteint", "tour", "abimee", "detruite",
  "portee",
]);

// Les classes du groupe 1 qui ont une règle.
const CLASSES_DU_GROUPE_1 = [
  "combat", "combat-barre", "combat-etat", "combat-garde", "combat-commandes", "combat-plus-bouton", "combat-autres", "combat-aide", "combat-avis", "combat-panneau",
  "combat-cadre", "combat-plateau", "combat-grille", "combat-coord", "combat-case", "combat-case-choix", "combat-jeton", "combat-pj", "combat-adv", "combat-rond",
  "combat-initiales", "combat-nom-court", "combat-case-plus", "combat-plus-large", "combat-plus-etroit", "combat-legende", "combat-action", "combat-preparation",
  "combat-qui", "combat-etapes", "combat-groupe", "combat-groupe-titre", "combat-capacite", "combat-degats", "combat-cout", "combat-desavantage", "combat-passifs",
  "combat-cibles", "combat-origine", "combat-des", "combat-jet", "combat-contexte", "combat-chaine", "combat-de", "combat-bilan", "combat-lettres", "combat-choix",
  "combat-reglages", "combat-case-liste", "combat-annonce", "combat-camps", "combat-camp", "combat-camp-pj", "combat-camp-adv", "combat-compte", "combat-fiche",
  "combat-pastille", "combat-nom", "combat-sous", "combat-statut", "combat-actions", "combat-pion", "combat-fiche-corps", "combat-jauge", "combat-point",
  "combat-zones", "combat-contre", "combat-valeurs", "combat-effets", "combat-journal", "combat-journal-tete", "combat-lignes", "combat-copie",
  "combat-ligne", "combat-de-titre", "combat-de-detail", "combat-de-valeur",
  // Ce que le regard dans un navigateur a fait ajouter (la maquette).
  "combat-raison", "combat-plateau-tete", "combat-plateau-survol", "combat-nom-debut", "combat-nom-numero", "combat-description",
  "combat-sous-ligne", "combat-jauge-souffle",
  // Ce que la mesure des cases a fait ajouter (des initiales de trois signes, rognées par le rond).
  "combat-initiales-longues",
  // Ce que la relecture de fin de groupe a fait ajouter.
  "combat-assiste", "combat-mort", "combat-refus", "combat-fiche-avant", "combat-preparation-commence", "combat-preparation-lancer",
];

// Les classes nouvelles du groupe 2 (contrat § 10.2, liste close).
const CLASSES_DU_GROUPE_2 = [
  // La bulle.
  "combat-bulle", "combat-bulle-jet", "combat-bulle-droite", "combat-bulle-gauche", "combat-bulle-dessous", "combat-bulle-dessus", "combat-bulle-poignee",
  "combat-bulle-tete", "combat-bulle-titre", "combat-bulle-sous", "combat-bulle-defile", "combat-bulle-pied", "combat-bulle-fermer", "combat-onglet",
  // Les lignes, les infobulles, les causes.
  "combat-option", "combat-intervention", "combat-passif", "combat-apercu", "combat-infobulles", "combat-infobulle", "combat-infobulle-droite",
  "combat-infobulle-gauche", "combat-infobulle-dessous", "combat-infobulle-dessus", "combat-infobulle-titre", "combat-infobulle-cout", "combat-citation",
  "combat-cause", "combat-cause-signe", "combat-cause-explication", "combat-cause-avantage", "combat-cause-desavantage", "combat-defense", "combat-defenseur",
  "combat-action-phrase",
  // Le bandeau, le journal.
  "combat-bandeau", "combat-bandeau-en-cours", "combat-bandeau-etiquette", "combat-bandeau-texte", "combat-bandeau-entier", "combat-bandeau-journal",
  "combat-bandeau-coupe", "combat-seg-pj", "combat-seg-adv", "combat-seg-capacite", "combat-seg-reussite", "combat-seg-echec", "combat-seg-valeur",
  "combat-seg-fin", "combat-seg-tour", "combat-cadre-jet", "combat-de-insecable", "combat-annulee",
  // La barre, la préparation.
  "combat-annuler-geste", "combat-signe", "combat-limite", "combat-preparation-demonstration", "combat-preparation-question", "combat-preparation-phrase",
];

// Les classes de la feuille hors des listes : une classe nouvelle sans place au contrat, ou une classe qui a quitté le code.
function classesHorsDesListes(css) {
  const connues = new Set([...CLASSES_DU_GROUPE_1, ...CLASSES_DU_GROUPE_2, ...ETATS, ...CLASSES_DU_SITE]);
  const classes = new Set(selecteursDe(css).flatMap((regle) => [...regle.selecteur.matchAll(/\.([\w-]+)/g)].map(([, classe]) => classe)));
  return [...classes].filter((classe) => !connues.has(classe));
}

function defautsDesClasses(css) {
  const defauts = [];
  for (const { selecteur } of selecteursDe(css)) {
    // Chaque règle part de l'écran du combat : elle ne touche rien d'autre.
    // « :where(.combat) » en part aussi, sans rien peser (la police, plus bas).
    // La racine, seule à porter la marge de défilement de la page, tant que le
    // volet est montré, et sous ce seul sélecteur.
    if (!/^(?:\.combat(?![\w])|\.combat-[a-z]|:where\(\.combat\) [a-z]|#ecran:has\(> \.combat\)$|html:has\(\.combat-bulle:not\(\[hidden\]\)\)$)/.test(selecteur)) defauts.push(`règle hors de l'écran du combat : ${selecteur}`);
    for (const [, classe] of selecteur.matchAll(/\.([\w-]+)/g)) {
      if (/carte/.test(classe)) defauts.push(`classe en « carte » : ${selecteur}`);
      else if (classe !== "combat" && !classe.startsWith("combat-") && !CLASSES_DU_SITE.has(classe) && !ETATS.has(classe)) defauts.push(`classe inconnue .${classe} : ${selecteur}`);
    }
  }
  return defauts;
}

test("combat.css — chaque règle part d'une classe « combat » (la racine seule, tant que le volet est montré) ; aucune classe hors de combat-, des états du contrat et des classes communes ; aucun nom en « carte »", () => {
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
  // La racine n'est admise que sous le sélecteur du volet montré, et pour elle-même.
  refuse("html { scroll-padding-bottom: var(--hauteur-volet); }", /hors de l'écran du combat : html$/);
  refuse("html:has(.fiche) { scroll-padding-bottom: var(--hauteur-volet); }", /hors de l'écran du combat/);
  refuse(":root:has(.combat-bulle:not([hidden])) { scroll-padding-bottom: var(--hauteur-volet); }", /hors de l'écran du combat/);
  refuse("html:has(.combat-bulle:not([hidden])) .fiche { margin: 0; }", /hors de l'écran du combat/);
  assert.deepEqual(defautsDesClasses(".combat { margin: 0; }\n.combat-fiche.joue summary::after,\n.combat-copie .champ { margin: 0; }\n:where(.combat) button { font: inherit; }\nhtml:has(.combat-bulle:not([hidden])) { scroll-padding-bottom: var(--hauteur-volet); }"), []);
  // La racine que vise la largeur, les nœuds du contrat (§ 7.9) et les classes nouvelles du groupe 2 (contrat § 10.2) :
  // chacune a sa règle ; « combat-qui-suite » a quitté le code avec les pas de la puissance.
  const classes = new Set(selecteursDe(COMBAT).flatMap((regle) => [...regle.selecteur.matchAll(/\.([\w-]+)/g)].map(([, classe]) => classe)));
  for (const attendue of [...CLASSES_DU_GROUPE_1, ...CLASSES_DU_GROUPE_2, "portee"]) assert.ok(classes.has(attendue), `.${attendue} n'a aucune règle`);
  assert.equal(new Set(CLASSES_DU_GROUPE_2).size, 59);
  assert.ok(!classes.has("combat-qui-suite"), ".combat-qui-suite a quitté le code");
  // La liste est close : aucune classe hors d'elle, ni d'un nom nouveau, ni d'un nom parti.
  assert.deepEqual(classesHorsDesListes(COMBAT), []);
  assert.deepEqual(classesHorsDesListes(".combat-qui-suite { color: var(--texte-2); }\n.combat-bulle-corps { margin: 0; }"), ["combat-qui-suite", "combat-bulle-corps"]);
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
  // La légende, sous la carte, montre chaque marque telle que la carte la trace (mission § 10.4).
  assert.match(valeur(COMBAT, ".combat-legende .cible .combat-rond", "border"), /dashed var\(--combat-adv\)$/);
  assert.equal(valeur(COMBAT, ".combat-legende .joue .combat-rond", "border-color"), "var(--accent)");
  assert.equal(valeur(COMBAT, ".combat-legende .joue .combat-rond", "background"), valeur(COMBAT, ".combat-jeton.joue", "background"));
  assert.equal(valeur(COMBAT, ".combat-legende .mort .combat-rond", "background"), valeur(COMBAT, ".combat-jeton.mort .combat-rond", "background"));
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

// ——— Les quinze couleurs ———

// Mission § 10.9, puis le complément du groupe 2, § 4.12 (les quatre
// dernières) : [jeton, clair, sombre].
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
  ["combat-portee", "#d9534f", "#e8776e"],
  ["combat-portee-bord", "#c8372d", "#f19a92"],
  // Le même gris dans les deux thèmes, redéclaré en sombre.
  ["combat-cadre-jet", "#7d838d", "#7d838d"],
  ["combat-cadre-jet-fond", "#ffffff", "#262a30"],
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

test("jetons.css — les quinze couleurs du combat, dans les deux thèmes, exactement ; --largeur-combat ; aucun nom en « carte » ; rien de plus", () => {
  assert.equal(COULEURS.length, 15);
  assert.deepEqual(defautsDesCouleurs(JETONS), []);
  const refuse = (css, motif) => assert.match(defautsDesCouleurs(css).join("\n"), motif);
  // Une couleur de trop, en clair puis en sombre ; une des quatre nouvelles changée ; la valeur sombre du cadre ôtée
  // (elle vaut la claire, mais se redéclare : le bloc sombre porte les quinze).
  refuse(JETONS.replace("--combat-cadre-jet-fond: #ffffff;", "--combat-cadre-jet-fond: #ffffff;\n  --combat-portee-fond: #fbe3e1;"), /jetons du combat, thème clair : .*combat-portee-fond/);
  refuse(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #262a30;\n    --combat-hachure: #e8776e;"), /jetons du combat, thème sombre : .*combat-hachure/);
  refuse(JETONS.replace("--combat-portee: #d9534f;", "--combat-portee: #d9534e;"), /--combat-portee clair : #d9534e/);
  refuse(JETONS.replace("--combat-portee-bord: #f19a92;", "--combat-portee-bord: #c8372d;"), /--combat-portee-bord sombre : #c8372d/);
  refuse(JETONS.replace(/\r?\n {4}--combat-cadre-jet: #7d838d;/, ""), /--combat-cadre-jet sombre : undefined/);
  refuse(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #ffffff;"), /--combat-cadre-jet-fond sombre : #ffffff/);
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

// ——— Les longueurs du groupe 2 ———

// Contrat § 10.1 : [jeton, valeur], au bloc clair, sans « combat » dans leur
// nom. La dernière sert au créateur en vignettes (css/ecran.css). À la
// relecture de fin du groupe : la hauteur de la bulle en pixels (la fenêtre
// moins 32 px, compl. § 4.1, que « 2rem » ne vaut qu'à la taille de texte par
// défaut). Aux captures finales : la hauteur d'attente d'une ligne du journal
// est partie avec sa règle (D-1), et l'écart entre le nom d'un passif et son
// trait pointillé, une part de la taille de son texte, est venu (D-3).
const LONGUEURS = [
  ["largeur-bulle", "20rem"],
  ["largeur-bulle-jet", "29.5rem"],
  ["largeur-infobulle", "18rem"],
  ["hauteur-bulle-max", "calc(100vh - 32px)"],
  ["hauteur-volet", "45%"],
  ["ligne-souris", "36px"],
  ["fleche-bulle", "8px"],
  ["taille-de-jet", "4rem"],
  ["hachure-trait", "3px"],
  ["hachure-pas", "9px"],
  ["hachure-angle", "135deg"],
  ["rayon-cadre", "4px"],
  ["marge-cadre", "3px"],
  ["decalage-soulignement", "0.2em"],
  ["largeur-vignette", "180px"],
];

function defautsDesLongueurs(css, feuille) {
  const defauts = [];
  const clair = jetons(css, "clair");
  const sombre = sombresSeuls(css);
  for (const [nom, attendue] of LONGUEURS) {
    if (clair[nom] !== attendue) defauts.push(`--${nom} : ${clair[nom]}`);
    if (nom in sombre) defauts.push(`--${nom} redéclaré dans le thème sombre`);
    if (/combat/.test(nom)) defauts.push(`--${nom} porte « combat »`);
    if (nom !== "largeur-vignette" && !feuille.includes(`var(--${nom})`)) defauts.push(`--${nom} ne sert pas dans css/combat.css`);
  }
  // La place de la bulle n'est pas un jeton : echelle.js l'écrit sur elle.
  for (const nom of Object.keys(clair)) if (nom.startsWith("bulle-")) defauts.push(`--${nom} déclaré dans jetons.css`);
  // La flèche de la feuille est celle que calculerPlace suppose.
  if (clair["fleche-bulle"] !== `${FLECHE}px`) defauts.push(`--fleche-bulle (${clair["fleche-bulle"]}) diffère de FLECHE (${FLECHE})`);
  return defauts;
}

test("jetons.css — les quinze longueurs du groupe 2, au bloc clair, sans « combat » dans leur nom ; aucune --bulle-* ; --fleche-bulle égale FLECHE (js/ecrans/echelle.js)", () => {
  assert.equal(FLECHE, 8);
  assert.equal(LONGUEURS.length, 15);
  assert.deepEqual(defautsDesLongueurs(JETONS, COMBAT), []);
  const refuse = (css, motif, feuille = COMBAT) => assert.match(defautsDesLongueurs(css, feuille).join("\n"), motif);
  // La hauteur de la bulle écrite d'après une taille de texte : 2rem ne vaut 32 px qu'à 16 px le rem.
  refuse(JETONS.replace("--hauteur-bulle-max: calc(100vh - 32px);", "--hauteur-bulle-max: calc(100vh - var(--espace-6));"), /--hauteur-bulle-max : calc\(100vh - var\(--espace-6\)\)/);
  // L'écart du soulignement d'un passif : une part de la taille de son texte, ni absente ni inemployée.
  refuse(JETONS.replace("--decalage-soulignement: 0.2em;", "--decalage-soulignement: 12px;"), /--decalage-soulignement : 12px/);
  refuse(JETONS.replace(/\r?\n {2}--decalage-soulignement: [^;]+;/, ""), /--decalage-soulignement : undefined/);
  refuse(JETONS, /--decalage-soulignement ne sert pas/, COMBAT.replaceAll("var(--decalage-soulignement)", "var(--trait)"));
  refuse(JETONS.replace("--fleche-bulle: 8px;", "--fleche-bulle: 9px;"), /--fleche-bulle : 9px[\s\S]*diffère de FLECHE \(8\)/);
  refuse(JETONS.replace("--ligne-souris: 36px;", "--ligne-souris: 44px;"), /--ligne-souris : 44px/);
  refuse(JETONS.replace("--largeur-vignette: 180px;", ""), /--largeur-vignette : undefined/);
  refuse(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #262a30;\n    --hauteur-volet: 60%;"), /--hauteur-volet redéclaré dans le thème sombre/);
  refuse(JETONS.replace("--marge-cadre: 3px;", "--marge-cadre: 3px;\n  --bulle-gauche: 0px;"), /--bulle-gauche déclaré dans jetons\.css/);
  refuse(JETONS, /--taille-de-jet ne sert pas/, COMBAT.replaceAll("var(--taille-de-jet)", "var(--cible-tactile)"));
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
  // Dans le cadre d'un jet : ✓, ✗ et les chiffres.
  ["combat-reussite", "combat-cadre-jet-fond"],
  ["combat-echec", "combat-cadre-jet-fond"],
  ["texte", "combat-cadre-jet-fond"],
];
// Les ronds et les traits, à 3:1 : au groupe 2, le bord du cadre d'un jet sur les deux fonds et sur le sien ; les traits
// de la hachure et le bord d'une case hachurée sur les trois fonds d'une case.
const PAIRES_DE_TRAIT = [
  ...["combat-pj", "combat-adv", "combat-mort", "accent"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])),
  ["bordure", "fond"],
  ["bordure", "fond-2"],
  ...["fond", "fond-2", "combat-cadre-jet-fond"].map((fond) => ["combat-cadre-jet", fond]),
  ...["combat-portee", "combat-portee-bord"].flatMap((avant) => FONDS_DE_CASE.map((fond) => [avant, fond])),
];
// Les contrastes du contrat (§ 10.1), remesurés : [thème, avant, fond, mesure arrondie au centième].
const CONTRASTES_DU_CONTRAT = [
  ["clair", "combat-portee", "fond", "3.96"], ["clair", "combat-portee", "accent-doux", "3.34"], ["clair", "combat-portee", "fond-2", "3.60"],
  ["sombre", "combat-portee", "fond", "6.24"], ["sombre", "combat-portee", "accent-doux", "4.77"],
  ["clair", "combat-portee-bord", "fond", "5.20"], ["clair", "combat-portee-bord", "accent-doux", "4.38"],
  ["sombre", "combat-portee-bord", "fond", "8.36"], ["sombre", "combat-portee-bord", "accent-doux", "6.39"],
  ["clair", "combat-cadre-jet", "fond-2", "3.47"], ["clair", "combat-cadre-jet", "combat-cadre-jet-fond", "3.82"],
  ["sombre", "combat-cadre-jet", "fond-2", "4.18"], ["sombre", "combat-cadre-jet", "combat-cadre-jet-fond", "3.78"],
  ["clair", "combat-reussite", "combat-cadre-jet-fond", "5.38"], ["sombre", "combat-reussite", "combat-cadre-jet-fond", "6.61"],
  ["clair", "combat-echec", "combat-cadre-jet-fond", "6.54"], ["sombre", "combat-echec", "combat-cadre-jet-fond", "5.01"],
  ["clair", "texte", "combat-cadre-jet-fond", "17.06"], ["sombre", "texte", "combat-cadre-jet-fond", "11.75"],
];

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
  // Au groupe 2 : une hachure trop pâle sur le fond doux d'une case, un fond de cadre sombre qui avale son bord et son ✗.
  assert.match(contrastesFaibles(JETONS.replace("--combat-portee: #d9534f;", "--combat-portee: #e8776e;")).join("\n"), /clair : --combat-portee sur --accent-doux, 2\.\d\d:1 sous 3/);
  const fondAbime = contrastesFaibles(JETONS.replace("--combat-cadre-jet-fond: #262a30;", "--combat-cadre-jet-fond: #3a3f46;")).join("\n");
  assert.match(fondAbime, /sombre : --combat-echec sur --combat-cadre-jet-fond, \d\.\d\d:1 sous 4\.5/);
  assert.match(fondAbime, /sombre : --combat-cadre-jet sur --combat-cadre-jet-fond, \d\.\d\d:1 sous 3/);
  // Les mesures du contrat, au centième.
  for (const [theme, avant, fond, mesure] of CONTRASTES_DU_CONTRAT) {
    const j = jetons(JETONS, theme);
    assert.equal(contraste(j[avant], j[fond]).toFixed(2), mesure, `${theme} : --${avant} sur --${fond}`);
  }

  // --combat-mort est une couleur de rond : comme texte sur le second fond, elle ne tient pas 4,5:1 (arbitrage § 7.3).
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(JETONS, theme);
    assert.ok(contraste(j["combat-mort"], j["fond-2"]) < 4.5, theme);
  }
  // La feuille n'écrit donc de texte qu'avec des couleurs mesurées ci-dessus, ou avec le texte du site. Le nom en
  // tête de la bulle prend la couleur des titres (lot 5) : en Atelier, celle du texte ; un thème la fait mesurer avec
  // ses autres jetons.
  for (const theme of ["clair", "sombre"]) assert.equal(jetons(JETONS, theme)["couleur-titre"], jetons(JETONS, theme).texte, theme);
  const permises = new Set(["texte", "texte-2", "accent", "texte-sur-accent", "couleur-titre", "combat-pj-texte", "combat-adv-texte", "combat-sur-jeton", "combat-reussite", "combat-echec", "combat-alerte"].map((nom) => `var(--${nom})`));
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
  // Chacun des quinze jetons sert, et chacun est mesuré, comme couleur ou comme fond.
  for (const [nom] of COULEURS) assert.ok(COMBAT.includes(`var(--${nom})`), `--${nom} ne sert à rien`);
  const mesures = new Set([...PAIRES_DE_TEXTE, ...PAIRES_DE_TRAIT].flat());
  assert.deepEqual(COULEURS.map(([nom]) => nom).filter((nom) => !mesures.has(nom)), []);
});

// ——— Les trois dispositions ———

test("combat.css — une colonne ; à 56rem le bandeau, le plateau et l'action à gauche, les camps à droite ; à 80rem les PJ, le bandeau et le plateau, les adversaires", () => {
  // Moins de 56rem : une colonne, dans l'ordre du document. Le cadre est le repère de la bulle et de son onglet.
  assert.equal(valeur(COMBAT, ".combat-cadre", "display"), "grid");
  assert.equal(valeur(COMBAT, ".combat-cadre", "position"), "relative");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas"), null);
  for (const [selecteur, propriete] of selecteursDe(COMBAT).filter((regle) => regle.cadre === null).flatMap((regle) => declarations(regle.corps).map(([propriete]) => [regle.selecteur, propriete]))) {
    assert.ok(propriete !== "order", `${selecteur} : l'ordre est celui du document`);
    if (/^\.combat-(?:bandeau|plateau|action|preparation|camps|camp-pj|camp-adv)$/.test(selecteur)) assert.notEqual(propriete, "grid-area", selecteur);
  }
  // De 56 à 80rem : le bandeau au-dessus de la carte, sur la largeur de sa colonne.
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas", MEDIA_56), "\"bandeau camps\" \"plateau camps\" \"action camps\"");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-rows", MEDIA_56), "auto auto 1fr");
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-columns", MEDIA_56), "minmax(0, 2fr) minmax(0, 1fr)");
  assert.equal(valeur(COMBAT, ".combat-bandeau", "grid-area", MEDIA_56), "bandeau");
  assert.equal(valeur(COMBAT, ".combat-plateau", "grid-area", MEDIA_56), "plateau");
  assert.equal(valeur(COMBAT, ".combat-action", "grid-area", MEDIA_56), "action");
  assert.equal(valeur(COMBAT, ".combat-preparation", "grid-area", MEDIA_56), "action");
  assert.equal(valeur(COMBAT, ".combat-camps", "grid-area", MEDIA_56), "camps");
  // 80rem et plus : l'enveloppe des camps s'efface, chacun prend sa colonne.
  assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-areas", MEDIA_80), "\"pj bandeau adv\" \"pj plateau adv\" \"pj action adv\"");
  // La bulle et l'onglet, posés, n'ont pas de cellule.
  for (const cadre of [null, MEDIA_56, MEDIA_80]) for (const posee of [".combat-bulle", ".combat-onglet"]) assert.equal(valeur(COMBAT, posee, "grid-area", cadre), null, `${cadre} ${posee}`);
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
  // Mission § 10.2 : une colonne, puis deux, puis trois ; autant de colonnes que de zones sur une ligne.
  for (const [cadre, nombre] of [[null, 1], [MEDIA_56, 2], [MEDIA_80, 3]]) {
    assert.equal(valeur(COMBAT, ".combat-cadre", "grid-template-columns", cadre).match(/minmax\(/g).length, nombre, `${cadre} : ${nombre} colonne(s)`);
    const zones = valeur(COMBAT, ".combat-cadre", "grid-template-areas", cadre);
    if (zones !== null) for (const ligne of zones.match(/"[^"]*"/g)) assert.equal(ligne.replace(/"/g, "").trim().split(/\s+/).length, nombre, `${cadre} : ${ligne}`);
  }
  // À 80rem, la carte et le panneau d'action tiennent la colonne du milieu, la plus large.
  const [gauche, milieu, droite] = valeur(COMBAT, ".combat-cadre", "grid-template-columns", MEDIA_80).match(/\d+(?=fr)/g).map(Number);
  assert.ok(milieu > gauche && milieu > droite && gauche === droite, "les deux listes de part et d'autre, de même largeur");
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
  // Les seuls positionnements absolus, avec la raison d'un bouton inactif, la région d'annonce et la ligne entière du
  // bandeau ; au groupe 2, le volet (fixé à la fenêtre), puis, posés, la bulle, son ✕, son onglet, les infobulles et
  // leurs flèches.
  assert.deepEqual(
    selecteursDe(COMBAT)
      .filter((regle) => /position:\s*(?:absolute|fixed|sticky)/.test(regle.corps))
      .map((regle) => `${regle.cadre ?? ""} ${regle.selecteur} ${regle.corps.match(/position:\s*([\w-]+)/)[1]}`.trim()),
    [
      ".combat-case-choix absolute",
      ".combat-bulle fixed",
      ".combat-bulle-fermer absolute",
      ".combat-onglet absolute",
      ".combat-infobulle absolute",
      ".combat-infobulle::before absolute",
      ".combat-infobulle::after absolute",
      ".combat-raison absolute",
      ".combat-annonce absolute",
      ".combat-bandeau-entier absolute",
      `${MEDIA_56} .combat-bulle absolute`,
      `${MEDIA_56} .combat-bulle::before absolute`,
      `${MEDIA_56} .combat-bulle::after absolute`,
    ],
  );
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
  for (const rangee of [".combat-commandes", ".combat-autres", ".combat-groupe", ".combat-cibles", ".combat-choix", ".combat-ligne", ".combat-option"]) {
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

test("combat.css — comme sur la maquette : « Fin de tour » ferme la barre ; l'état suit la ligne sous le nom ; les jauges, l'endurance, le texte de la capacité", () => {
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
  // Le point qui les sépare tient à la ligne : un état passé à la ligne ne commence pas par un point. Il n'est que
  // là : l'origine d'une capacité, dans une infobulle (« b · span.combat-sous », suivis de la description), n'en reçoit pas.
  assert.equal(valeur(COMBAT, ".combat-sous-ligne .combat-sous:not(:last-child)::after", "content"), "\" ·\"");
  assert.deepEqual(selecteursDe(COMBAT).filter((regle) => /\.combat-sous\b[^\s]*::after/.test(regle.selecteur) && !regle.selecteur.startsWith(".combat-sous-ligne ")).map((regle) => regle.selecteur), []);
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
  // L'endurance : une case intacte est vide, une case perdue est pleine.
  assert.equal(valeur(COMBAT, ".combat-zones .combat-point", "background"), "transparent");
  assert.equal(valeur(COMBAT, ".combat-zones .combat-point.vide", "background"), "var(--combat-echec)");
  // La table : l'armure rangée à droite, les noms abrégés sans soulignement.
  assert.equal(valeur(COMBAT, ".combat-zones td:nth-child(3)", "text-align"), "right");
  assert.equal(valeur(COMBAT, ".combat-zones abbr", "text-decoration"), "none");

  // Le titre du jet sous la carte (téléphone) : qui le joue, plus bas, dans le second gris.
  assert.equal(valeur(COMBAT, ".combat-qui + .combat-sous", "font-size"), "var(--taille-petite)");
  assert.equal(valeur(COMBAT, ".combat-sous", "color"), "var(--texte-2)");
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

// Un dé relancé : sa valeur barrée d'un fond, de la couleur du dé, centré sur sa largeur ; aucun text-decoration sur elle.
function defautsDuDeRelance(css) {
  const defauts = [];
  const relancee = ".combat-de.relance .combat-de-valeur";
  for (const [propriete, attendue] of [["width", "fit-content"], ["margin-inline", "auto"], ["background", "linear-gradient(currentColor, currentColor) center / 100% var(--trait) no-repeat"]]) {
    const lue = valeur(css, relancee, propriete);
    if (lue !== attendue) defauts.push(`${relancee} { ${propriete}: ${lue} } au lieu de ${attendue}`);
  }
  for (const regle of selecteursDe(css)) {
    if (!/\.combat-de-valeur$/.test(regle.selecteur)) continue;
    for (const [propriete, v] of declarations(regle.corps)) if (/^text-decoration/.test(propriete)) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} }`);
  }
  return defauts;
}

test("combat.css — le dé relancé garde le rouge de son échec ; au journal, la seule phrase de la mort ; la place de la barre de défilement", () => {
  // Un dé relancé est toujours un échec : il en garde le rouge, en trait discontinu ; sa valeur, grisée, reste barrée.
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-color"), "var(--combat-echec)");
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-color"), valeur(COMBAT, ".combat-de.echoue", "border-color"));
  assert.equal(valeur(COMBAT, ".combat-de.relance", "border-style"), "dashed");
  assert.equal(valeur(COMBAT, ".combat-de.relance", "color"), "var(--texte-2)");
  // La barre est un fond, un trait à mi-hauteur sur la largeur de la valeur, de sa couleur grisée, sans nœud de plus :
  // Firefox ne barrait pas, par text-decoration, la valeur, bloc d'un bouton souple (relecture de fin du groupe 2).
  assert.deepEqual(defautsDuDeRelance(COMBAT), []);
  const feuille = COMBAT.replaceAll("\r\n", "\n");
  const remplacer = (cherche, remplace) => {
    assert.equal(feuille.split(cherche).length, 2, `fragment absent ou répété : ${cherche}`);
    return feuille.replace(cherche, () => remplace);
  };
  const refuse = (css, motif) => assert.match(defautsDuDeRelance(css).join("\n"), motif);
  // La feuille d'avant : text-decoration, que Firefox ne dessinait pas.
  refuse(remplacer("  background: linear-gradient(currentColor, currentColor) center / 100% var(--trait) no-repeat;", "  text-decoration: line-through;"), /background: null[\s\S]*\{ text-decoration: line-through \}/);
  // La valeur sur toute la largeur du dé : le trait la dépasserait.
  refuse(remplacer("  width: fit-content;", "  width: auto;"), /width: auto/);
  refuse(remplacer("  margin-inline: auto;\n  background: linear-gradient", "  background: linear-gradient"), /margin-inline: null/);

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

// Un passif du pied de la bulle, qu'un appui du doigt ouvre : une cible de 44 px, à la souris comme au doigt (spéc. § 9 ;
// le complément n'amende la règle que pour les lignes, § 4.1). Rien ne la rabaisse, dans aucun cadre.
function defautsDuPassif(css) {
  const defauts = [];
  for (const [propriete, attendue] of [["display", "inline-flex"], ["align-items", "center"], ["min-height", "var(--cible-tactile)"]]) {
    const lue = valeur(css, ".combat-passif", propriete);
    if (lue !== attendue) defauts.push(`.combat-passif { ${propriete}: ${lue} } au lieu de ${attendue}`);
  }
  for (const regle of selecteursDe(css)) {
    if (!/\.combat-passif\b/.test(regle.selecteur) || (regle.cadre === null && regle.selecteur === ".combat-passif")) continue;
    for (const [propriete, v] of declarations(regle.corps)) if (/^(?:display|min-height|height|max-height)$/.test(propriete)) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} } : le passif perd ses 44 px`);
  }
  return defauts;
}

test("combat.css — toute cible fait 44 px, hors les cases (et les lignes de la bulle sous une souris, plus bas), les passifs compris ; le journal est limité à 18rem, à 24rem sur un grand écran, et défile", () => {
  assert.equal(jetons(JETONS, "clair")["cible-tactile"], "44px");
  for (const selecteur of [".combat button", ".combat select", ".combat textarea", ".combat input", ".combat label", ".combat-fiche summary", ".combat-reglages summary", ".combat-capacite", ".combat-bulle .combat-capacite", ".combat-cibles button", ".combat-case-liste button", ".combat-passif"]) {
    assert.equal(valeur(COMBAT, selecteur, "min-height"), "var(--cible-tactile)", selecteur);
  }
  // Les passifs : 21 px de haut jusqu'à la relecture de fin du groupe 2 ; désormais 44, sans @media de plus.
  assert.deepEqual(defautsDuPassif(COMBAT), []);
  const feuille = COMBAT.replaceAll("\r\n", "\n");
  const refusePassif = (css, motif) => assert.match(defautsDuPassif(css).join("\n"), motif);
  assert.equal(feuille.split(".combat-passif {\n  display: inline-flex;\n  align-items: center;\n  min-height: var(--cible-tactile);\n").length, 2);
  refusePassif(feuille.replace(".combat-passif {\n  display: inline-flex;\n  align-items: center;\n  min-height: var(--cible-tactile);\n", ".combat-passif {\n"), /\.combat-passif \{ display: null \}[\s\S]*\{ min-height: null \}/);
  refusePassif(`${feuille}\n.combat-bulle-pied .combat-passif {\n  min-height: 0;\n}\n`, /\.combat-bulle-pied \.combat-passif \{ min-height: 0 \} : le passif perd ses 44 px/);
  refusePassif(feuille.replace("@media (pointer: fine) {\n", "@media (pointer: fine) {\n  .combat-passif {\n    min-height: var(--ligne-souris);\n  }\n\n"), /@media \(pointer: fine\) \.combat-passif \{ min-height: var\(--ligne-souris\) \}/);
  assert.equal(valeur(COMBAT, ".combat button", "min-width"), "var(--cible-tactile)");
  // Un dé est plus grand qu'une cible, dans les deux sens.
  for (const cadre of [null, MEDIA_56]) {
    for (const propriete of ["width", "height"]) assert.match(valeur(COMBAT, ".combat-de", propriete, cadre), /^calc\(var\(--cible-tactile\) \+ var\(--espace-\d\)\)$/, `${cadre} ${propriete}`);
  }
  // Rien d'autre que le plateau ne redescend sous 44 px.
  const rabaisses = (css) => selecteursDe(css).filter((regle) => declarations(regle.corps).some(([propriete, v]) => /^min-(?:width|height)$/.test(propriete) && v === "0") && /button|input|select|summary|capacite|passif|\.combat-de\b/.test(regle.selecteur)).map((regle) => regle.selecteur);
  assert.deepEqual(rabaisses(COMBAT), [".combat input[type=\"checkbox\"]", ".combat input[type=\"radio\"]", ".combat-grille button"]);
  assert.deepEqual(rabaisses(".combat-choix button { min-height: 0; }"), [".combat-choix button"]);
  assert.deepEqual(rabaisses(".combat-bulle-pied .combat-passif { min-height: 0; }"), [".combat-bulle-pied .combat-passif"]);

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
  assert.equal(valeur(COMBAT, ".combat-lignes", "font-family"), "var(--police-journal)");
  // La police du journal vient du thème (lot 5) ; celle d'Atelier reste la chasse fixe.
  assert.equal(definis["police-journal"], "var(--police-chasse-fixe)");
});

// ——— Le groupe 2 : la bulle, ses lignes, la hachure, le bandeau, le journal ———

// La feuille du dépôt aux fins de ligne simples, pour y écrire des feuilles fautives.
const FEUILLE = COMBAT.replaceAll("\r\n", "\n");
// Remplace un fragment présent une fois exactement : une feuille fautive qui ne changerait rien se verrait.
function casser(css, cherche, remplace) {
  assert.equal(css.split(cherche).length, 2, `fragment absent ou répété : ${cherche}`);
  return css.replace(cherche, () => remplace);
}
// Ce qui manque à une feuille : [sélecteur, propriété, valeur attendue, cadre].
const ecarts = (css, attendues) =>
  attendues.filter(([selecteur, propriete, attendue, cadre]) => valeur(css, selecteur, propriete, cadre) !== attendue).map(([selecteur, propriete, attendue, cadre]) => `${cadre ?? ""} ${selecteur} { ${propriete}: ${valeur(css, selecteur, propriete, cadre)} } au lieu de ${attendue}`.trim());

// Contrat § 10.3, la bulle.
const ATTENDUES_DE_LA_BULLE = [
  // Sous 56rem, le volet : fixé au bas de la fenêtre, sur toute sa largeur, 45 % de sa hauteur au plus ; une colonne
  // souple, qui défile en elle-même ; sa poignée.
  [".combat-bulle", "position", "fixed", null],
  [".combat-bulle", "left", "0", null],
  [".combat-bulle", "right", "0", null],
  [".combat-bulle", "bottom", "0", null],
  [".combat-bulle", "max-height", "var(--hauteur-volet)", null],
  [".combat-bulle", "display", "flex", null],
  [".combat-bulle", "flex-direction", "column", null],
  [".combat-bulle", "overflow", "visible", null],
  [".combat-bulle", "background", "var(--fond)", null],
  [".combat-bulle-poignee", "display", "block", null],
  [".combat-bulle-defile", "overflow-y", "auto", null],
  [".combat-bulle-defile", "min-height", "0", null],
  // À 56rem, posée sur le cadre par les propriétés de placerBulle : 20rem pour la liste, 29,5rem pour le jet, jamais
  // plus que le cadre ; au-delà de la hauteur de la fenêtre moins 32 px, elle défile.
  [".combat-bulle", "position", "absolute", MEDIA_56],
  [".combat-bulle", "left", "var(--bulle-gauche)", MEDIA_56],
  [".combat-bulle", "top", "var(--bulle-haut)", MEDIA_56],
  [".combat-bulle", "right", "auto", MEDIA_56],
  [".combat-bulle", "bottom", "auto", MEDIA_56],
  [".combat-bulle", "width", "min(var(--largeur-bulle), 100%)", MEDIA_56],
  [".combat-bulle", "max-height", "var(--hauteur-bulle-max)", MEDIA_56],
  [".combat-bulle", "border", "var(--trait) solid var(--bordure)", MEDIA_56],
  [".combat-bulle-jet", "width", "min(var(--largeur-bulle-jet), 100%)", MEDIA_56],
  [".combat-bulle-poignee", "display", "none", MEDIA_56],
  // L'onglet et les infobulles, posés de même, à toute largeur.
  [".combat-onglet", "position", "absolute", null],
  [".combat-onglet", "left", "var(--bulle-gauche)", null],
  [".combat-onglet", "top", "var(--bulle-haut)", null],
  [".combat-infobulle", "position", "absolute", null],
  [".combat-infobulle", "left", "var(--bulle-gauche)", null],
  [".combat-infobulle", "top", "var(--bulle-haut)", null],
  [".combat-infobulle", "width", "var(--largeur-infobulle)", null],
  [".combat-infobulle", "background", "var(--fond)", null],
  [".combat-infobulle", "border", "var(--trait) solid var(--bordure)", null],
  // Leur couche ne se positionne pas : le repère est la bulle, ou la zone sous la carte.
  [".combat-infobulles", "position", "static", null],
  [".combat-action", "position", "relative", null],
  // L'attribut hidden l'emporte sur ce qui montre la bulle, l'onglet, l'infobulle et le bandeau.
  [".combat-bulle[hidden]", "display", "none", null],
  [".combat-onglet[hidden]", "display", "none", null],
  [".combat-infobulle[hidden]", "display", "none", null],
  [".combat-bandeau[hidden]", "display", "none", null],
];

// La flèche, deux triangles de bordures : pour chaque côté, le bord puis le fond, collés à la face qui regarde l'ancre,
// placés le long d'elle par la propriété de la flèche. Celle de la bulle n'existe qu'à 56rem.
//
// Relecture de fin du groupe 2 : celle de la bulle ne se dessinait jamais. Son raccourci « border », à 56rem, venait
// après les règles de côté, au même poids, et remettait les quatre couleurs transparentes. Ses bords transparents se
// posent donc hors des @media, avant les côtés ; à 56rem, le style et la largeur seuls ; et, après la première règle
// de côté, aucune règle de la flèche ne repose une couleur de bord (le raccourci, border-color, ceux d'un côté).
const FACES = { droite: "right", gauche: "left", dessous: "bottom", dessus: "top" };
const POSE_UNE_COULEUR_DE_BORD = /^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?$/;
function defautsDesFleches(css) {
  const defauts = [];
  for (const porteur of ["bulle", "infobulle"]) {
    for (const [cote, face] of Object.entries(FACES)) {
      const [avant, apres] = ["before", "after"].map((pseudo) => `.combat-${porteur}-${cote}::${pseudo}`);
      if (valeur(css, avant, `border-${face}-color`) !== "var(--bordure)") defauts.push(`${avant} : le triangle du bord`);
      if (valeur(css, apres, `border-${face}-color`) !== "var(--fond)") defauts.push(`${apres} : le triangle du fond`);
      if (valeur(css, avant, face) !== "100%") defauts.push(`${avant} : ${face} ${valeur(css, avant, face)}`);
      if (valeur(css, apres, face) !== "calc(100% - var(--trait))") defauts.push(`${apres} : ${face} ${valeur(css, apres, face)}`);
      const long = face === "right" || face === "left" ? "top" : "left";
      for (const pseudo of [avant, apres]) if (!/var\(--bulle-fleche\)/.test(valeur(css, pseudo, long) ?? "")) defauts.push(`${pseudo} : ${long} sans la propriété de la flèche`);
    }
  }
  // L'infobulle : un raccourci, transparent, avant ses côtés.
  for (const pseudo of [".combat-infobulle::before", ".combat-infobulle::after"]) {
    if (valeur(css, pseudo, "content") !== "\"\"") defauts.push(`${pseudo} : sans contenu`);
    if (valeur(css, pseudo, "border") !== "var(--fleche-bulle) solid transparent") defauts.push(`${pseudo} : ${valeur(css, pseudo, "border")}`);
  }
  // La bulle : ses bords transparents hors des @media, avant ses côtés ; à 56rem, son contenu, le style et la largeur.
  const liste = selecteursDe(css);
  const premierCote = (porteur) => liste.findIndex((regle) => Object.keys(FACES).some((cote) => regle.selecteur === `.combat-${porteur}-${cote}::before` || regle.selecteur === `.combat-${porteur}-${cote}::after`));
  for (const pseudo of [".combat-bulle::before", ".combat-bulle::after"]) {
    const rang = rangDe(css, pseudo);
    const cote = premierCote("bulle");
    if (valeur(css, pseudo, "border-color") !== "transparent") defauts.push(`${pseudo} : ses bords ne sont pas transparents`);
    else if (!(rang >= 0 && (cote < 0 || rang < cote))) defauts.push(`${pseudo} : ses bords transparents ne précèdent pas les règles de côté`);
    if (valeur(css, pseudo, "content") !== null) defauts.push(`${pseudo} : une flèche au volet`);
    if (valeur(css, pseudo, "content", MEDIA_56) !== "\"\"") defauts.push(`${pseudo} : sans contenu à 56rem`);
    if (valeur(css, pseudo, "border-style", MEDIA_56) !== "solid") defauts.push(`${pseudo} : border-style ${valeur(css, pseudo, "border-style", MEDIA_56)} à 56rem`);
    if (valeur(css, pseudo, "border-width", MEDIA_56) !== "var(--fleche-bulle)") defauts.push(`${pseudo} : border-width ${valeur(css, pseudo, "border-width", MEDIA_56)} à 56rem`);
  }
  // Après la première règle de côté, rien ne repose une couleur de bord sur la flèche, dans aucun cadre.
  for (const porteur of ["bulle", "infobulle"]) {
    const cote = premierCote(porteur);
    liste.forEach((regle, rang) => {
      if (cote < 0 || rang <= cote || (regle.selecteur !== `.combat-${porteur}::before` && regle.selecteur !== `.combat-${porteur}::after`)) return;
      for (const [propriete] of declarations(regle.corps)) {
        if (POSE_UNE_COULEUR_DE_BORD.test(propriete)) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} : ${propriete} après les règles de côté, qui en efface la couleur`);
      }
    });
  }
  for (const regle of selecteursDe(css)) {
    if (/bulle|infobulle/.test(regle.selecteur) && /::(?:before|after)$/.test(regle.selecteur) && declarations(regle.corps).some(([propriete]) => /^(?:transform|box-shadow|rotate)$/.test(propriete))) defauts.push(`${regle.selecteur} : une flèche tournée ou ombrée`);
  }
  return defauts;
}

test("combat.css — la bulle : le volet sous 56rem ; à 56rem posée sur le cadre par les trois propriétés de placerBulle ; ses flèches, deux triangles de bordures ; l'onglet et les infobulles posés de même ; l'attribut hidden l'emporte", () => {
  assert.deepEqual(ecarts(COMBAT, ATTENDUES_DE_LA_BULLE), []);
  assert.deepEqual(defautsDesFleches(COMBAT), []);
  // La largeur du jet suit celle de la liste, dans le même cadre : elle l'emporte.
  assert.ok(rangDe(COMBAT, ".combat-bulle-jet", MEDIA_56) > rangDe(COMBAT, ".combat-bulle", MEDIA_56));
  // Ce qui cache pèse plus que ce qui montre, et ne fait que cacher.
  for (const montre of [".combat-bulle", ".combat-onglet", ".combat-infobulle", ".combat-bandeau"]) assert.ok(pese(poids(`${montre}[hidden]`)) > pese(poids(montre)), montre);
  // Une règle dont le sujet est caché ne fait que cacher (la racine, tant que le volet n'est pas caché, est un autre sujet).
  const cachesQuiMontrent = (css) => selecteursDe(css).filter((regle) => /\[hidden\]$/.test(regle.selecteur) && !/^\s*display:\s*none;\s*$/.test(regle.corps)).map((regle) => regle.selecteur);
  assert.deepEqual(cachesQuiMontrent(COMBAT), []);
  assert.deepEqual(cachesQuiMontrent(casser(FEUILLE, ".combat-bandeau[hidden] {\n  display: none;", ".combat-bandeau[hidden] {\n  display: none; visibility: hidden;")), [".combat-bulle[hidden]", ".combat-onglet[hidden]", ".combat-infobulle[hidden]", ".combat-bandeau[hidden]"]);
  assert.deepEqual(cachesQuiMontrent("html:has(.combat-bulle:not([hidden])) { scroll-padding-bottom: var(--hauteur-volet); }"), []);
  // Le ✕ (ou « – »), dernier du document, se pose dans le coin de la bulle : son en-tête lui laisse sa place.
  assert.equal(valeur(COMBAT, ".combat-bulle-fermer", "position"), "absolute");
  assert.match(valeur(COMBAT, ".combat-bulle-tete", "padding"), /calc\(var\(--cible-tactile\) \+ var\(--espace-\d\)\)/);
  // Le nom en tête de la bulle, et du volet qu'elle devient : un titre du thème (lot 5), comme ceux des écrans.
  for (const [propriete, attendue] of [["font-family", "var(--police-titre)"], ["color", "var(--couleur-titre)"], ["font-weight", "var(--graisse-titre)"], ["font-synthesis-weight", "none"], ["font-size-adjust", "none"]]) {
    assert.equal(valeur(COMBAT, ".combat-bulle-titre", propriete), attendue, propriete);
  }

  // Armé : des feuilles fautives.
  const fautive = (css, motif) => assert.match([...ecarts(css, ATTENDUES_DE_LA_BULLE), ...defautsDesFleches(css)].join("\n"), motif);
  fautive(casser(FEUILLE, "  position: fixed;\n", "  position: absolute;\n"), /\.combat-bulle \{ position: absolute \} au lieu de fixed/);
  fautive(casser(FEUILLE, "  max-height: var(--hauteur-volet);", "  max-height: 60%;"), /max-height: 60%/);
  fautive(casser(FEUILLE, "    left: var(--bulle-gauche);\n    width: min(var(--largeur-bulle), 100%);", "    left: var(--bulle-x);\n    width: min(var(--largeur-bulle), 100%);"), /@media \(min-width: 56rem\) \.combat-bulle \{ left: var\(--bulle-x\) \}/);
  fautive(casser(FEUILLE, "    width: min(var(--largeur-bulle-jet), 100%);", "    width: var(--largeur-bulle-jet);"), /\.combat-bulle-jet \{ width: var\(--largeur-bulle-jet\) \}/);
  fautive(casser(FEUILLE, ".combat-bulle[hidden],\n", ""), /\.combat-bulle\[hidden\] \{ display: null \}/);
  fautive(casser(FEUILLE, "  overflow: visible;\n", "  overflow: auto;\n"), /\.combat-bulle \{ overflow: auto \}/);
  fautive(`${FEUILLE}\n.combat-bulle-droite::before {\n  transform: rotate(45deg);\n}\n`, /\.combat-bulle-droite::before : une flèche tournée/);
  fautive(`${FEUILLE}\n.combat-bulle::before {\n  content: "";\n}\n`, /\.combat-bulle::before : une flèche au volet/);
  fautive(casser(FEUILLE, "  border-right-color: var(--fond);", "  border-right-color: var(--fond-2);"), /\.combat-bulle-droite::after : le triangle du fond/);
  fautive(casser(FEUILLE, "  bottom: calc(100% - var(--trait));", "  bottom: 100%;"), /\.combat-infobulle-dessous::after : bottom 100%/);

  // La flèche de la bulle (relecture de fin du groupe 2). La feuille d'avant : le raccourci à 56rem, après les côtés.
  const transparents = ".combat-bulle::before,\n.combat-bulle::after {\n  border-color: transparent;\n}\n\n";
  const aCinquanteSix = "    border-style: solid;\n    border-width: var(--fleche-bulle);";
  const davant = casser(casser(FEUILLE, transparents, ""), aCinquanteSix, "    border: var(--fleche-bulle) solid transparent;");
  fautive(davant, /@media \(min-width: 56rem\) \.combat-bulle::before : border après les règles de côté[\s\S]*@media \(min-width: 56rem\) \.combat-bulle::after : border après les règles de côté/);
  fautive(davant, /\.combat-bulle::before : ses bords ne sont pas transparents/);
  // Le raccourci seul remis ; les bords transparents ôtés ; posés après les côtés ; une couleur d'un côté reposée.
  fautive(casser(FEUILLE, aCinquanteSix, "    border: var(--fleche-bulle) solid transparent;"), /\.combat-bulle::after : border-style null à 56rem/);
  fautive(casser(FEUILLE, transparents, ""), /\.combat-bulle::after : ses bords ne sont pas transparents/);
  const apres = `${casser(FEUILLE, transparents, "")}\n${transparents}`;
  fautive(apres, /\.combat-bulle::before : ses bords transparents ne précèdent pas les règles de côté/);
  fautive(apres, /^\.combat-bulle::after : border-color après les règles de côté/m);
  fautive(`${FEUILLE}\n.combat-bulle::after {\n  border-top-color: transparent;\n}\n`, /\.combat-bulle::after : border-top-color après les règles de côté/);
  fautive(`${FEUILLE}\n.combat-infobulle::before {\n  border-color: var(--fond);\n}\n`, /\.combat-infobulle::before : border-color après les règles de côté/);
  fautive(casser(FEUILLE, "    border-width: var(--fleche-bulle);", "    border-width: var(--trait);"), /\.combat-bulle::before : border-width var\(--trait\) à 56rem/);
  // Ce qui ne repose aucune couleur passe : la largeur, le style.
  assert.deepEqual(defautsDesFleches(`${FEUILLE}\n.combat-bulle::before {\n  border-width: var(--fleche-bulle);\n  border-style: solid;\n}\n`), []);
});

// Contrat § 10.3, les lignes de la bulle : 44 px au doigt, 36 sous une souris, pour elles seules. Une ligne est une
// capacité à une puissance, seule à porter data-ligne (relecture de fin du groupe 2) : « Passer son tour » et les rangées
// du jet, qui sont aussi des .combat-capacite de la bulle, gardent leurs 44 px.
const LIGNE = ".combat-bulle .combat-capacite[data-ligne]";
function defautsDesLignes(css) {
  const defauts = [];
  if (valeur(css, ".combat-bulle .combat-capacite", "min-height") !== "var(--cible-tactile)") defauts.push("une ligne de la bulle, au doigt : pas 44 px");
  if (valeur(css, LIGNE, "min-height", MEDIA_SOURIS) !== "var(--ligne-souris)") defauts.push("une ligne de la bulle, sous une souris : pas 36 px");
  for (const regle of selecteursDe(css)) {
    for (const [propriete, v] of declarations(regle.corps)) {
      const souris = /var\(--ligne-souris\)/.test(v);
      const permise = regle.cadre === MEDIA_SOURIS && regle.selecteur === LIGNE && propriete === "min-height";
      if (souris && !permise) defauts.push(`36 px hors des lignes de la bulle : ${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} }`);
      if (regle.cadre === MEDIA_SOURIS && !permise) defauts.push(`sous une souris, autre chose que les lignes de la bulle : ${regle.selecteur} { ${propriete}: ${v} }`);
    }
  }
  return defauts;
}

test("combat.css — les lignes de la bulle (data-ligne) : 44 px au doigt, 36 px sous une souris (pointer: fine), pour elles seules ; « Passer son tour », les rangées du jet et toute autre cible gardent leurs 44 px", () => {
  assert.deepEqual(defautsDesLignes(COMBAT), []);
  assert.equal(jetons(JETONS, "clair")["ligne-souris"], "36px");
  // La règle des lignes pèse plus que celle de tous les boutons de l'écran, et que les 44 px des capacités de la bulle.
  assert.ok(pese(poids(".combat-bulle .combat-capacite")) > pese(poids(".combat button")));
  assert.ok(pese(poids(LIGNE)) > pese(poids(".combat-bulle .combat-capacite")));
  const refuse = (css, motif) => assert.match(defautsDesLignes(css).join("\n"), motif);
  // La feuille d'avant : 36 px pour toute capacité de la bulle, « Passer son tour » et les rangées du jet compris.
  const souris = "@media (pointer: fine) {\n  .combat-bulle .combat-capacite[data-ligne] {";
  const davant = casser(FEUILLE, souris, "@media (pointer: fine) {\n  .combat-bulle .combat-capacite {");
  refuse(davant, /sous une souris : pas 36 px/);
  refuse(davant, /36 px hors des lignes de la bulle : @media \(pointer: fine\) \.combat-bulle \.combat-capacite \{/);
  // 36 px hors de la bulle : une capacité du panneau, un bouton quelconque, au doigt.
  refuse(casser(FEUILLE, souris, "@media (pointer: fine) {\n  .combat-capacite {"), /36 px hors des lignes de la bulle : @media \(pointer: fine\) \.combat-capacite/);
  refuse(casser(FEUILLE, ".combat button {\n  min-width: var(--cible-tactile);", ".combat button {\n  min-height: var(--ligne-souris);\n  min-width: var(--cible-tactile);"), /36 px hors des lignes de la bulle : \.combat button/);
  refuse(casser(FEUILLE, ".combat-bulle .combat-capacite {\n  width: 100%;\n  min-height: var(--cible-tactile);", ".combat-bulle .combat-capacite {\n  width: 100%;\n  min-height: var(--ligne-souris);"), /au doigt : pas 44 px/);
  refuse(casser(FEUILLE, "    min-height: var(--ligne-souris);\n  }\n}", "    min-height: var(--ligne-souris);\n  }\n\n  .combat-bulle-fermer {\n    min-width: 0;\n  }\n}"), /sous une souris, autre chose que les lignes de la bulle : \.combat-bulle-fermer/);
});

// Les lignes seules portent data-ligne : dans le texte de js/ecrans/combat_action.js, hors des commentaires, le mot ne
// paraît que dans ligneDeCapacite (de sa signature à l'accolade fermante en début de ligne), et il y paraît.
const ACTION = lire("js/ecrans/combat_action.js");
function defautsDuMarqueurDesLignes(source) {
  const texte = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  const debut = texte.indexOf("function ligneDeCapacite(");
  const fin = debut < 0 ? -1 : texte.indexOf("\n}", debut);
  if (debut < 0 || fin < 0) return ["ligneDeCapacite introuvable"];
  const defauts = [];
  const vus = [...texte.matchAll(/data-ligne/g)].map((trouve) => trouve.index);
  if (!vus.some((i) => i > debut && i < fin)) defauts.push("ligneDeCapacite ne pose pas data-ligne");
  for (const i of vus) {
    if (i > debut && i < fin) continue;
    const ligne = texte.slice(texte.lastIndexOf("\n", i) + 1, texte.indexOf("\n", i) < 0 ? undefined : texte.indexOf("\n", i)).trim();
    defauts.push(`data-ligne hors de ligneDeCapacite : ${ligne}`);
  }
  return defauts;
}

test("combat_action.js — data-ligne ne marque que les lignes de la bulle (une capacité à une puissance) : « Passer son tour » et « Jet d'attaque » ne le portent pas", () => {
  assert.deepEqual(defautsDuMarqueurDesLignes(ACTION), []);
  const source = "function ligneDeCapacite(r, ligne) {\n  return el(\"button\", { classe: \"combat-capacite\", \"data-ligne\": ligne.cle });\n}\n\nfunction jetPrete(r, j) {\n  const [noeud] = bouton(r, {\n    cle: \"jet_prete\",\n    classe: \"combat-capacite\",\n  });\n  return noeud;\n}\n";
  assert.deepEqual(defautsDuMarqueurDesLignes(source), []);
  const refuse = (texte, motif) => assert.match(defautsDuMarqueurDesLignes(texte).join("\n"), motif);
  // data-ligne ajouté à « Jet d'attaque » : il prendrait les 36 px des lignes.
  refuse(source.replace("    cle: \"jet_prete\",", "    cle: \"jet_prete\", \"data-ligne\": \"jet\","), /data-ligne hors de ligneDeCapacite : cle: "jet_prete", "data-ligne": "jet",/);
  refuse(source.replace(", \"data-ligne\": ligne.cle", ""), /ligneDeCapacite ne pose pas data-ligne/);
  refuse(source.replace("function ligneDeCapacite(", "function uneLigne("), /ligneDeCapacite introuvable/);
  // Un commentaire qui le nomme ne compte pas.
  assert.deepEqual(defautsDuMarqueurDesLignes(`// Les lignes portent data-ligne.\n/* La feuille lit [data-ligne]. */\n${source}  // data-ligne\n`), []);
  // Le lecteur prend bien le corps de la fonction, jusqu'à son accolade en début de ligne, aux fins de ligne du dépôt.
  assert.deepEqual(defautsDuMarqueurDesLignes(source.replaceAll("\n", "\r\n")), []);
  assert.match(defautsDuMarqueurDesLignes(`${source}\nconst x = { "data-ligne": 1 };\n`).join("\n"), /data-ligne hors de ligneDeCapacite : const x/);
});

// Les lignes de la bulle, des rangées plates (maquette, vue 1, là où le complément se tait) : ni bord ni fond au repos,
// aucun écart vertical entre deux lignes d'un groupe ; au survol et au focus, le fond doux et un trait d'accent en dedans.
// Une ligne inactive garde l'aspect d'un bouton inactif du site : son trait discontinu, visible, sans fond, en gris ; elle
// ne s'éclaire pas au survol.
const LIGNE_INACTIVE = `${LIGNE}[aria-disabled="true"]`;
const LIGNE_ECLAIREE = [`${LIGNE}:not([aria-disabled="true"]):hover`, `${LIGNE}:not([aria-disabled="true"]):focus-visible`];
function defautsDesLignesPlates(css) {
  const defauts = ecarts(css, [
    [LIGNE, "border-color", "transparent", null],
    [LIGNE, "background", "transparent", null],
    [LIGNE_INACTIVE, "border-color", "var(--bordure)", null],
    [".combat-bulle .combat-groupe", "row-gap", "0", null],
    ...LIGNE_ECLAIREE.flatMap((selecteur) => [
      [selecteur, "background", "var(--accent-doux)", null],
      [selecteur, "box-shadow", "inset 0 0 0 var(--trait) var(--accent)", null],
    ]),
  ]);
  // Le bord de la ligne existe au repos (sa largeur et son style viennent de .combat-capacite) : rien ne l'ôte, rien ne
  // l'écarte de sa voisine, et la règle de l'inactive l'emporte sur celle du repos.
  for (const regle of selecteursDe(css)) {
    if (!regle.selecteur.startsWith(LIGNE) && regle.selecteur !== ".combat-bulle .combat-capacite" && regle.selecteur !== ".combat-option") continue;
    for (const [propriete, v] of declarations(regle.corps)) {
      if (/^(?:border|border-width|border-style|border-top|border-bottom|margin|margin-top|margin-bottom|margin-block)$/.test(propriete)) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} }`);
    }
  }
  if (!(pese(poids(LIGNE_INACTIVE)) > pese(poids(LIGNE)))) defauts.push("la ligne inactive ne l'emporte pas sur la ligne au repos");
  for (const eclairee of LIGNE_ECLAIREE) if (!(pese(poids(eclairee)) > pese(poids(LIGNE)))) defauts.push(`${eclairee} ne l'emporte pas sur le repos`);
  // Ce que la ligne au repos et l'inactive posent ne touche pas l'aspect d'une capacité inactive : ni le style du trait,
  // ni la couleur du texte ; le fond du repos est le sien, transparent.
  for (const selecteur of [LIGNE, LIGNE_INACTIVE]) {
    for (const cadre of [null, MEDIA_56, MEDIA_80, MEDIA_SOURIS]) {
      for (const propriete of ["border-style", "color", "opacity"]) if (valeur(css, selecteur, propriete, cadre) !== null) defauts.push(`${[cadre, selecteur].filter(Boolean).join(" ")} { ${propriete}: ${valeur(css, selecteur, propriete, cadre)} } : l'aspect d'une ligne inactive change`);
    }
  }
  if (valeur(css, LIGNE_INACTIVE, "background") !== null) defauts.push(`${LIGNE_INACTIVE} { background: ${valeur(css, LIGNE_INACTIVE, "background")} } : l'aspect d'une ligne inactive change`);
  return defauts;
}

test("combat.css — les lignes de la bulle sont des rangées plates : ni bord ni fond au repos, aucun écart entre elles ; au survol et au focus, le fond doux et un trait d'accent en dedans ; l'inactive garde son trait discontinu", () => {
  assert.deepEqual(defautsDesLignesPlates(COMBAT), []);
  // L'inactive : le trait discontinu, le fond transparent et le gris d'une capacité inactive, que rien ne change pour
  // une ligne (le contrôle « un bouton du site rendu inactif n'a pas l'aspect d'un bouton actif », plus haut).
  for (const [propriete, attendue] of [["border-style", "dashed"], ["background", "transparent"], ["color", "var(--texte-2)"]]) {
    assert.equal(valeur(COMBAT, ".combat-capacite[aria-disabled=\"true\"]", propriete), attendue, propriete);
  }
  assert.equal(valeur(COMBAT, ".combat .bouton[aria-disabled=\"true\"]", "border-color"), valeur(COMBAT, LIGNE_INACTIVE, "border-color"));
  const refuse = (css, motif) => assert.match(defautsDesLignesPlates(css).join("\n"), motif);
  refuse(`${FEUILLE}\n${LIGNE_INACTIVE} {\n  color: var(--texte);\n}\n`, /\[aria-disabled="true"\] \{ color: var\(--texte\) \} : l'aspect d'une ligne inactive change/);
  // La feuille d'avant : des boutons encadrés, chacun séparé du suivant.
  const repos = `${LIGNE} {\n  border-color: transparent;\n  background: transparent;\n}\n\n`;
  refuse(casser(FEUILLE, repos, ""), /\[data-ligne\] \{ border-color: null \} au lieu de transparent/);
  refuse(casser(FEUILLE, ".combat-bulle .combat-groupe {\n  row-gap: 0;\n}\n\n", ""), /\.combat-bulle \.combat-groupe \{ row-gap: null \}/);
  refuse(casser(FEUILLE, `${LIGNE} {\n  border-color: transparent;`, `${LIGNE} {\n  border-color: var(--bordure);`), /\{ border-color: var\(--bordure\) \} au lieu de transparent/);
  // Le bord ôté : l'inactive perdrait son trait discontinu.
  refuse(casser(FEUILLE, `${LIGNE} {\n  border-color: transparent;`, `${LIGNE} {\n  border: 0;\n  border-color: transparent;`), /\[data-ligne\] \{ border: 0 \}/);
  // L'inactive sans trait visible, ou éclairée au survol.
  refuse(casser(FEUILLE, `${LIGNE_INACTIVE} {`, `${LIGNE}[aria-disabled="false"] {`), /\[aria-disabled="true"\] \{ border-color: null \}/);
  refuse(casser(FEUILLE, `${LIGNE}:not([aria-disabled="true"]):hover,`, `${LIGNE}:hover,`), /:not\(\[aria-disabled="true"\]\):hover \{ background: null \}/);
  refuse(casser(FEUILLE, `${LIGNE}:not([aria-disabled="true"]):focus-visible {`, `${LIGNE}:not([aria-disabled="true"]):focus {`), /:focus-visible \{ background: null \}/);
  refuse(casser(FEUILLE, "  box-shadow: inset 0 0 0 var(--trait) var(--accent);\n}\n\n.combat-bulle .combat-cout", "  box-shadow: 0 0 0 var(--trait) var(--accent);\n}\n\n.combat-bulle .combat-cout"), /box-shadow: 0 0 0 var\(--trait\) var\(--accent\) \} au lieu de inset/);
  // Un écart entre deux lignes, par une marge.
  refuse(`${FEUILLE}\n.combat-option {\n  margin-bottom: var(--espace-1);\n}\n`, /\.combat-option \{ margin-bottom: var\(--espace-1\) \}/);
});

// Le nom d'un passif, souligné d'un trait pointillé sous le texte même (maquette, vue 1). Posé en border-bottom sur sa
// boîte de 44 px (relecture de fin du groupe 2, C-16), le trait tombait une douzaine de pixels sous le nom (captures
// finales, D-3). Le trait, du gris du second texte et d'un trait d'épaisseur, s'écarte du nom de --decalage-soulignement ;
// avec la couleur du texte, il dit qu'un passif s'ouvre : jamais la couleur seule. Aucune règle d'un passif ne lui rend un
// bord ni ne change son soulignement, dans aucun cadre ; sa boîte de 44 px reste (defautsDuPassif, plus haut).
const PASSIF_SOULIGNE = [
  [".combat-passif", "color", "var(--texte)", null],
  [".combat-passif", "text-decoration", "underline dotted var(--texte-2)", null],
  [".combat-passif", "text-decoration-thickness", "var(--trait)", null],
  [".combat-passif", "text-underline-offset", "var(--decalage-soulignement)", null],
];
function defautsDuSoulignementDuPassif(css) {
  const defauts = ecarts(css, PASSIF_SOULIGNE);
  for (const regle of selecteursDe(css)) {
    // Un passif, sujet de la règle, avec ou sans pseudo-classe (.combat-passifs, de la préparation, est un autre nœud).
    if (!/\.combat-passif(?::[\w-]+(?:\([^()]*\))?)*$/.test(regle.selecteur)) continue;
    const ou = [regle.cadre, regle.selecteur].filter(Boolean).join(" ");
    const principale = regle.cadre === null && regle.selecteur === ".combat-passif";
    for (const [propriete, v] of declarations(regle.corps)) {
      if (/^border(?!-radius$)/.test(propriete)) defauts.push(`${ou} { ${propriete}: ${v} } : un bord sur le passif, loin de son nom`);
      else if (!principale && /^text-(?:decoration|underline)/.test(propriete)) defauts.push(`${ou} { ${propriete}: ${v} } : le soulignement du passif change`);
    }
  }
  return defauts;
}

test("combat.css — le nom d'un passif est souligné d'un trait pointillé sous le texte même, écarté d'un jeton ; aucun bord sur sa boîte de 44 px", () => {
  assert.deepEqual(defautsDuSoulignementDuPassif(COMBAT), []);
  // Le trait a changé de place, non la boîte : ses 44 px tiennent, sans @media de plus.
  assert.deepEqual(defautsDuPassif(COMBAT), []);
  assert.equal(valeur(COMBAT, ".combat-passif", "min-height"), "var(--cible-tactile)");
  // L'écart suit la taille du texte ; le trait est du second texte, qui tient 4,5:1 sur le fond de la bulle (mesuré plus haut).
  assert.equal(jetons(JETONS, "clair")["decalage-soulignement"], "0.2em");
  assert.ok(PAIRES_DE_TEXTE.some(([avant, fond]) => avant === "texte-2" && fond === "fond"));
  const refuse = (css, motif) => assert.match(defautsDuSoulignementDuPassif(css).join("\n"), motif);
  // La feuille d'avant : le trait en bordure de la boîte de 44 px.
  const trait = "  text-decoration: underline dotted var(--texte-2);\n  text-decoration-thickness: var(--trait);\n  text-underline-offset: var(--decalage-soulignement);\n";
  const boite = ".combat-passif {\n  display: inline-flex;\n  align-items: center;\n  min-height: var(--cible-tactile);\n";
  const davant = casser(casser(FEUILLE, trait, ""), boite, `${boite}  border-bottom: var(--trait) dotted var(--texte-2);\n`);
  refuse(davant, /\.combat-passif \{ text-decoration: null \} au lieu de underline dotted var\(--texte-2\)/);
  refuse(davant, /^\.combat-passif \{ border-bottom: var\(--trait\) dotted var\(--texte-2\) \} : un bord sur le passif/m);
  // Le trait gardé, un bord en plus ; un bord rendu par une autre règle, au pied ; le soulignement effacé au survol.
  refuse(casser(FEUILLE, boite, `${boite}  border-bottom: var(--trait) dotted var(--texte-2);\n`), /\.combat-passif \{ border-bottom: .* : un bord sur le passif/);
  refuse(`${FEUILLE}\n.combat-bulle-pied .combat-passif {\n  border-block-end: var(--trait) dotted var(--texte-2);\n}\n`, /\.combat-bulle-pied \.combat-passif \{ border-block-end: .* : un bord sur le passif/);
  refuse(`${FEUILLE}\n@media (pointer: fine) {\n  .combat-passif:hover {\n    text-decoration: none;\n  }\n}\n`, /@media \(pointer: fine\) \.combat-passif:hover \{ text-decoration: none \} : le soulignement du passif change/);
  // Un trait plein, effacé, sans écart, d'une autre épaisseur.
  refuse(casser(FEUILLE, "  text-decoration: underline dotted var(--texte-2);", "  text-decoration: underline solid var(--texte-2);"), /text-decoration: underline solid var\(--texte-2\) \} au lieu de underline dotted/);
  refuse(casser(FEUILLE, "  text-decoration: underline dotted var(--texte-2);", "  text-decoration: none;"), /text-decoration: none \} au lieu de underline dotted/);
  refuse(casser(FEUILLE, "  text-underline-offset: var(--decalage-soulignement);", "  text-underline-offset: auto;"), /text-underline-offset: auto \} au lieu de var\(--decalage-soulignement\)/);
  refuse(casser(FEUILLE, "  text-decoration-thickness: var(--trait);", "  text-decoration-thickness: var(--trait-epais);"), /text-decoration-thickness: var\(--trait-epais\) \}/);
  // Le lecteur : border-radius n'est pas un bord ; .combat-passifs n'est pas un passif.
  assert.deepEqual(defautsDuSoulignementDuPassif(`${FEUILLE}\n.combat-passif {\n  border-radius: var(--rayon);\n}\n\n.combat-passifs {\n  border-bottom: var(--trait) solid var(--bordure);\n}\n`), []);
});

// « Passer son tour », dans la bulle : une rangée plate comme les lignes (maquette, vue 1 ; captures finales du groupe 2,
// D-4, après C-20), sans bord ni fond au repos, le fond doux et le trait d'accent en dedans au survol et au focus. Ses
// règles ne posent que ces couleurs, hors de tout cadre : ses 44 px (C-05 : il ne porte pas data-ligne, la règle de la
// souris ne le touche pas) et le trait discontinu de l'inactif viennent des capacités ; inactif, il garde l'aspect d'un
// bouton inactif du site et ne s'éclaire pas. Hors de la bulle, rien ne le vise. Il est, dans js/ecrans/combat_action.js,
// le seul bouton d'une .combat-option sans data-ligne (defautsDesOptions, plus bas).
const PASSER = ".combat-bulle .combat-option > .combat-capacite:not([data-ligne])";
const PASSER_INACTIF = `${PASSER}[aria-disabled="true"]`;
const PASSER_ECLAIRE = [`${PASSER}:not([aria-disabled="true"]):hover`, `${PASSER}:not([aria-disabled="true"]):focus-visible`];
function defautsDePasserEnRangee(css) {
  const defauts = ecarts(css, [
    [PASSER, "border-color", "transparent", null],
    [PASSER, "background", "transparent", null],
    [PASSER_INACTIF, "border-color", "var(--bordure)", null],
    ...PASSER_ECLAIRE.flatMap((selecteur) => [
      [selecteur, "background", "var(--accent-doux)", null],
      [selecteur, "box-shadow", "inset 0 0 0 var(--trait) var(--accent)", null],
    ]),
  ]);
  for (const regle of selecteursDe(css)) {
    const ou = [regle.cadre, regle.selecteur].filter(Boolean).join(" ");
    if (/\.combat-capacite:not\(\[data-ligne\]\)/.test(regle.selecteur) && !regle.selecteur.startsWith(PASSER)) defauts.push(`${ou} : « Passer son tour » visé hors de la bulle`);
    if (!regle.selecteur.startsWith(PASSER)) continue;
    if (regle.cadre !== null) defauts.push(`${ou} : « Passer son tour » change dans un cadre`);
    for (const [propriete, v] of declarations(regle.corps)) if (!/^(?:border-color|background|box-shadow)$/.test(propriete)) defauts.push(`${ou} { ${propriete}: ${v} } : plus que les couleurs d'une rangée`);
  }
  // L'inactif et l'éclairé l'emportent sur le repos ; le repos, sur le bord et le fond des capacités, et sur une capacité inactive.
  if (!(pese(poids(PASSER_INACTIF)) > pese(poids(PASSER)))) defauts.push("« Passer son tour » inactif ne l'emporte pas sur le repos");
  for (const eclaire of PASSER_ECLAIRE) if (!(pese(poids(eclaire)) > pese(poids(PASSER)))) defauts.push(`${eclaire} ne l'emporte pas sur le repos`);
  for (const sous of [".combat-capacite", ".combat-bulle .combat-capacite", ".combat-capacite[aria-disabled=\"true\"]"]) if (!(pese(poids(PASSER)) > pese(poids(sous)))) defauts.push(`${PASSER} ne l'emporte pas sur ${sous}`);
  return defauts;
}

test("combat.css — « Passer son tour », dans la bulle, est une rangée plate comme les lignes ; il garde ses 44 px et, inactif, l'aspect d'un bouton inactif", () => {
  assert.deepEqual(defautsDePasserEnRangee(COMBAT), []);
  // Ses 44 px : la règle des capacités de la bulle ; celle de la souris ne vise que data-ligne.
  assert.equal(valeur(COMBAT, ".combat-bulle .combat-capacite", "min-height"), "var(--cible-tactile)");
  assert.deepEqual(defautsDesLignes(COMBAT), []);
  // Inactif : le trait discontinu, le fond transparent et le gris d'une capacité inactive ; le gris du trait d'un bouton
  // inactif du site, comme une ligne inactive.
  for (const [propriete, attendue] of [["border-style", "dashed"], ["background", "transparent"], ["color", "var(--texte-2)"]]) {
    assert.equal(valeur(COMBAT, ".combat-capacite[aria-disabled=\"true\"]", propriete), attendue, propriete);
  }
  assert.equal(valeur(COMBAT, PASSER_INACTIF, "border-color"), valeur(COMBAT, ".combat .bouton[aria-disabled=\"true\"]", "border-color"));
  assert.equal(valeur(COMBAT, PASSER_INACTIF, "border-color"), valeur(COMBAT, LIGNE_INACTIVE, "border-color"));
  const refuse = (css, motif) => assert.match(defautsDePasserEnRangee(css).join("\n"), motif);
  // La feuille d'avant : un bouton encadré entre les rangées plates.
  const repos = `${PASSER} {\n  border-color: transparent;\n  background: transparent;\n}\n\n`;
  const inactif = `${PASSER_INACTIF} {\n  border-color: var(--bordure);\n}\n\n`;
  const eclaire = `${PASSER_ECLAIRE[0]},\n${PASSER_ECLAIRE[1]} {\n  background: var(--accent-doux);\n  box-shadow: inset 0 0 0 var(--trait) var(--accent);\n}\n\n`;
  refuse(casser(casser(casser(FEUILLE, repos, ""), inactif, ""), eclaire, ""), /:not\(\[data-ligne\]\) \{ border-color: null \} au lieu de transparent[\s\S]*:focus-visible \{ box-shadow: null \}/);
  // Un bord ou un fond au repos ; l'inactif sans trait visible ; éclairé inactif, ou au focus de la souris.
  refuse(casser(FEUILLE, `${PASSER} {\n  border-color: transparent;`, `${PASSER} {\n  border-color: var(--bordure);`), /:not\(\[data-ligne\]\) \{ border-color: var\(--bordure\) \} au lieu de transparent/);
  refuse(casser(FEUILLE, `${PASSER} {\n  border-color: transparent;\n  background: transparent;`, `${PASSER} {\n  border-color: transparent;\n  background: var(--fond);`), /:not\(\[data-ligne\]\) \{ background: var\(--fond\) \} au lieu de transparent/);
  refuse(casser(FEUILLE, `${PASSER_INACTIF} {\n  border-color: var(--bordure);`, `${PASSER_INACTIF} {\n  border-color: transparent;`), /\[aria-disabled="true"\] \{ border-color: transparent \} au lieu de var\(--bordure\)/);
  refuse(casser(FEUILLE, `${PASSER_ECLAIRE[0]},`, `${PASSER}:hover,`), /:not\(\[aria-disabled="true"\]\):hover \{ background: null \}/);
  refuse(casser(FEUILLE, `${PASSER_ECLAIRE[1]} {`, `${PASSER}:not([aria-disabled="true"]):focus {`), /:focus-visible \{ background: null \}/);
  refuse(casser(FEUILLE, eclaire, eclaire.replace("inset 0 0 0", "0 0 0")), /:hover \{ box-shadow: 0 0 0 var\(--trait\) var\(--accent\) \} au lieu de inset/);
  // Plus que des couleurs : les 36 px des lignes, un style de trait ; une règle dans un cadre ; hors de la bulle.
  refuse(casser(FEUILLE, `${PASSER} {\n  border-color: transparent;\n  background: transparent;`, `${PASSER} {\n  border-color: transparent;\n  background: transparent;\n  min-height: var(--ligne-souris);`), /\{ min-height: var\(--ligne-souris\) \} : plus que les couleurs d'une rangée/);
  refuse(`${FEUILLE}\n${PASSER_INACTIF} {\n  border-style: solid;\n}\n`, /\[aria-disabled="true"\] \{ border-style: solid \} : plus que les couleurs d'une rangée/);
  refuse(`${FEUILLE}\n@media (min-width: 56rem) {\n  ${PASSER} {\n    background: var(--fond-2);\n  }\n}\n`, /^@media \(min-width: 56rem\) \.combat-bulle .* : « Passer son tour » change dans un cadre/m);
  refuse(`${FEUILLE}\n.combat-option > .combat-capacite:not([data-ligne]) {\n  background: transparent;\n}\n`, /^\.combat-option > \.combat-capacite:not\(\[data-ligne\]\) : « Passer son tour » visé hors de la bulle/m);
});

// Le sélecteur de « Passer son tour » tient à la forme de la liste : dans js/ecrans/combat_action.js, hors des
// commentaires, « combat-option » ne s'écrit que dans ligneDeCapacite (une ligne, qui porte data-ligne) et sur la ligne
// qui fabrique « Passer son tour » (cle: "passer"), qui l'écrit bien. Aucune rangée du jet n'en prend l'aspect.
function defautsDesOptions(source) {
  const texte = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  const debut = texte.indexOf("function ligneDeCapacite(");
  const fin = debut < 0 ? -1 : texte.indexOf("\n}", debut);
  if (debut < 0 || fin < 0) return ["ligneDeCapacite introuvable"];
  const defauts = [];
  let passer = 0;
  for (const trouve of texte.matchAll(/combat-option(?![\w-])/g)) {
    const i = trouve.index;
    if (i > debut && i < fin) continue;
    const coupe = texte.indexOf("\n", i);
    const ligne = texte.slice(texte.lastIndexOf("\n", i) + 1, coupe < 0 ? undefined : coupe).trim();
    if (/\bcle: "passer"/.test(ligne)) passer += 1;
    else defauts.push(`une .combat-option hors des lignes et de « Passer son tour » : ${ligne}`);
  }
  if (passer !== 1) defauts.push(`« Passer son tour » dans ${passer} .combat-option au lieu d'une`);
  return defauts;
}

test("combat_action.js — une .combat-option ne tient qu'une ligne ou « Passer son tour » : la rangée plate de « Passer son tour » ne vise que lui", () => {
  assert.deepEqual(defautsDesOptions(ACTION), []);
  const source = "function ligneDeCapacite(r, ligne) {\n  return el(\"div\", { classe: \"combat-option\" }, el(\"button\", { classe: \"combat-capacite\", \"data-ligne\": ligne.cle }));\n}\n\nfunction composerListe(r, vue) {\n  const passer = el(\"div\", { classe: \"combat-option\" }, bouton(r, { cle: \"passer\", classe: \"combat-capacite\" }));\n  return passer;\n}\n";
  assert.deepEqual(defautsDesOptions(source), []);
  assert.deepEqual(defautsDesOptions(source.replaceAll("\n", "\r\n")), []);
  const refuse = (texte, motif) => assert.match(defautsDesOptions(texte).join("\n"), motif);
  // « Passer son tour » hors d'une .combat-option : la feuille ne le viserait plus.
  refuse(source.replace("{ classe: \"combat-option\" }, bouton(", "{ classe: \"combat-groupe\" }, bouton("), /« Passer son tour » dans 0 \.combat-option au lieu d'une/);
  // Une rangée du jet dans une .combat-option : elle prendrait l'aspect de « Passer son tour ».
  refuse(`${source}\nfunction rangee(r) {\n  return el("div", { classe: "combat-option combat-degats-bases" }, bouton(r, { cle: "degats:base:0", classe: "combat-capacite" }));\n}\n`, /hors des lignes et de « Passer son tour » : return el\("div", \{ classe: "combat-option combat-degats-bases" \}/);
  refuse(source.replace("function ligneDeCapacite(", "function uneLigne("), /ligneDeCapacite introuvable/);
  // Un commentaire qui la nomme ne compte pas ; « combat-options » n'est pas elle.
  assert.deepEqual(defautsDesOptions(`// Une .combat-option par ligne.\n/* combat-option */\n${source}const autre = "combat-options";\n`), []);
});

// Contrat § 10.3, la hachure.
const HACHURE = "repeating-linear-gradient(var(--hachure-angle), var(--combat-portee) 0 var(--hachure-trait), transparent var(--hachure-trait) var(--hachure-pas))";
function defautsDeLaHachure(css) {
  const defauts = [];
  if (valeur(css, ".combat-case.portee", "background-image") !== HACHURE) defauts.push(`la hachure : ${valeur(css, ".combat-case.portee", "background-image")}`);
  if (valeur(css, ".combat-case.portee", "border-color") !== "var(--combat-portee-bord)") defauts.push("le bord d'une case hachurée");
  const rang = rangDe(css, ".combat-case.portee");
  for (const apres of [".combat-case.active", ".combat-case.possible"]) if (!(rang >= 0 && rang < rangDe(css, apres))) defauts.push(`la hachure n'est pas avant ${apres}`);
  // Une règle d'état qui la suit ne pose que la couleur du fond : le raccourci l'effacerait (la case de qui joue, à la
  // portée 0, resterait sans hachure).
  for (const regle of selecteursDe(css).slice(rang + 1)) {
    if (/^\.combat-case(?:\.[\w-]+|:[\w-]+)+$/.test(regle.selecteur) && declarations(regle.corps).some(([propriete]) => propriete === "background" || propriete === "background-image")) defauts.push(`${regle.selecteur} efface la hachure`);
  }
  if (valeur(css, ".combat-legende .portee .combat-rond", "background-image") !== HACHURE) defauts.push("la légende sans la hachure");
  if (valeur(css, ".combat-legende .portee .combat-rond", "border-color") !== "var(--combat-portee-bord)") defauts.push("la légende sans le bord");
  return defauts;
}

test("combat.css — la hachure de la portée : 3 px sur 9 à 135°, sous les jetons, avant .active et .possible, que rien n'efface ; la légende de même", () => {
  assert.deepEqual(defautsDeLaHachure(COMBAT), []);
  assert.deepEqual(["hachure-trait", "hachure-pas", "hachure-angle"].map((nom) => jetons(JETONS, "clair")[nom]), ["3px", "9px", "135deg"]);
  const refuse = (css, motif) => assert.match(defautsDeLaHachure(css).join("\n"), motif);
  // La hachure après .active : le bord de qui joue ne l'emporterait plus.
  const bloc = FEUILLE.match(/\.combat-case\.portee \{[^}]*\}\n\n/)[0];
  const deplacee = casser(casser(FEUILLE, bloc, ""), ".combat-case.possible {\n  border: var(--trait) dashed var(--accent);\n}\n\n", `.combat-case.possible {\n  border: var(--trait) dashed var(--accent);\n}\n\n${bloc}`);
  refuse(deplacee, /la hachure n'est pas avant \.combat-case\.active/);
  refuse(casser(FEUILLE, "  background-color: var(--accent-doux);\n}", "  background: var(--accent-doux);\n}"), /\.combat-case\.active efface la hachure/);
  refuse(casser(FEUILLE, ".combat-case.portee {\n  background-image: repeating-linear-gradient(var(--hachure-angle)", ".combat-case.portee {\n  background-image: repeating-linear-gradient(var(--hachure-pas)"), /la hachure : repeating-linear-gradient\(var\(--hachure-pas\)/);
  refuse(casser(FEUILLE, "  border-color: var(--combat-portee-bord);\n  border-radius: calc(var(--rayon) / 2);", "  border-radius: calc(var(--rayon) / 2);"), /la légende sans le bord/);
});

// Sur une case hachurée, une plaque du fond sous un jeton et sous le « +k » (relecture de fin du groupe 2 : le texte à
// même les traits tombait à 2,34:1 en sombre, les ronds à 1,02:1). Hors le jeton de qui joue ou tenu en main, qui garde
// la sienne. Leur texte, --texte, tient 4,5:1 sur --fond dans les deux thèmes.
const PLAQUES = [".combat-case.portee .combat-jeton:not(.joue):not([aria-pressed=\"true\"])", ".combat-case.portee .combat-case-plus"];
function defautsDeLaPlaque(css, jetonsCss) {
  const defauts = [];
  for (const plaque of PLAQUES) if (valeur(css, plaque, "background-color") !== "var(--fond)") defauts.push(`${plaque} : sans la plaque du fond`);
  // Elle l'emporte sur le fond transparent du jeton et du « +k ».
  for (const [plaque, sous] of [[PLAQUES[0], ".combat-jeton"], [PLAQUES[1], ".combat-case-plus"]]) if (!(pese(poids(plaque)) > pese(poids(sous)))) defauts.push(`${plaque} ne l'emporte pas sur ${sous}`);
  // Aucune autre plaque, qui couvrirait la marque de qui joue ou d'un jeton tenu en main.
  for (const regle of selecteursDe(css)) {
    if (!/^\.combat-case\.portee \./.test(regle.selecteur) || PLAQUES.includes(regle.selecteur)) continue;
    defauts.push(`une autre règle sur une case hachurée : ${regle.selecteur}`);
  }
  for (const marque of [".combat-jeton.joue", ".combat-jeton[aria-pressed=\"true\"]"]) if (valeur(css, marque, "background") !== "var(--accent-doux)") defauts.push(`${marque} sans sa plaque, l'accent doux`);
  // Ce qui se lit sur la plaque est le texte du site.
  for (const porteur of [".combat-jeton", ".combat-case-plus"]) if (valeur(css, porteur, "color") !== "var(--texte)") defauts.push(`${porteur} : ${valeur(css, porteur, "color")} sur la plaque`);
  for (const theme of ["clair", "sombre"]) {
    const j = jetons(jetonsCss, theme);
    const mesure = contraste(j.texte, j.fond);
    if (!(mesure >= 4.5)) defauts.push(`${theme} : --texte sur --fond, ${mesure.toFixed(2)}:1 sous 4,5`);
  }
  return defauts;
}

test("combat.css — sur une case hachurée, une plaque du fond sous les jetons et le « +k », hors de qui joue ; --texte y tient 4,5:1 dans les deux thèmes", () => {
  assert.deepEqual(defautsDeLaPlaque(COMBAT, JETONS), []);
  // Sans plaque, le texte et les ronds se dessinaient sur la hachure : sous 4,5:1 pour le texte en sombre, sous 3:1 pour un rond.
  const sombre = jetons(JETONS, "sombre");
  assert.equal(contraste(sombre.texte, sombre["combat-portee"]).toFixed(2), "2.34");
  assert.ok(contraste(sombre["combat-adv"], sombre["combat-portee"]) < 3);
  const refuse = (css, motif, jetonsCss = JETONS) => assert.match(defautsDeLaPlaque(css, jetonsCss).join("\n"), motif);
  // La feuille d'avant : aucune plaque.
  const bloc = `${PLAQUES[0]},\n${PLAQUES[1]} {\n  background-color: var(--fond);\n}\n\n`;
  refuse(casser(FEUILLE, bloc, ""), /\.combat-jeton:not\(\.joue\):not\(\[aria-pressed="true"\]\) : sans la plaque du fond[\s\S]*\.combat-case-plus : sans la plaque du fond/);
  refuse(casser(FEUILLE, `${PLAQUES[1]} {\n  background-color: var(--fond);`, `${PLAQUES[1]} {\n  background-color: transparent;`), /\.combat-case-plus : sans la plaque du fond/);
  // La plaque sur le jeton de qui joue : elle couvrirait sa marque.
  refuse(casser(FEUILLE, `${PLAQUES[0]},`, ".combat-case.portee .combat-jeton,"), /une autre règle sur une case hachurée : \.combat-case\.portee \.combat-jeton$/m);
  // Un texte qui ne tiendrait pas sur la plaque.
  refuse(FEUILLE, /sombre : --texte sur --fond/, JETONS.replace("--texte: #e6e8eb;", "--texte: #3a3f46;"));
  refuse(casser(FEUILLE, ".combat-case-plus {\n  position: relative;\n  z-index: 1;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: var(--texte);", ".combat-case-plus {\n  position: relative;\n  z-index: 1;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: var(--combat-mort);"), /\.combat-case-plus : var\(--combat-mort\) sur la plaque/);
});

// Le volet, non modal, peut couvrir ce qui a le focus (WCAG 2.4.11) : tant qu'il est montré, la page garde en bas une
// marge de défilement de sa hauteur au plus (le jeton de sa hauteur), par la feuille seule. À 56rem, la bulle posée n'en
// demande aucune. Rien d'autre ne pose de marge de défilement, et la racine ne porte rien d'autre.
const RACINE_DU_VOLET = "html:has(.combat-bulle:not([hidden]))";
function defautsDeLaMargeDuVolet(css) {
  const defauts = [];
  const hauteur = valeur(css, ".combat-bulle", "max-height");
  if (hauteur !== "var(--hauteur-volet)") defauts.push(`le volet : max-height ${hauteur}`);
  if (valeur(css, RACINE_DU_VOLET, "scroll-padding-bottom") !== hauteur) defauts.push(`${RACINE_DU_VOLET} { scroll-padding-bottom: ${valeur(css, RACINE_DU_VOLET, "scroll-padding-bottom")} } : pas la hauteur du volet`);
  if (valeur(css, RACINE_DU_VOLET, "scroll-padding-bottom", MEDIA_56) !== "auto") defauts.push(`${MEDIA_56} ${RACINE_DU_VOLET} { scroll-padding-bottom: ${valeur(css, RACINE_DU_VOLET, "scroll-padding-bottom", MEDIA_56)} } : la bulle posée garde la marge`);
  for (const regle of selecteursDe(css)) {
    for (const [propriete, v] of declarations(regle.corps)) {
      const marge = /^scroll-(?:padding|margin)/.test(propriete);
      if (regle.selecteur === RACINE_DU_VOLET ? propriete !== "scroll-padding-bottom" : marge) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} }`);
    }
  }
  return defauts;
}

test("combat.css — tant que le volet est montré, la page garde en bas une marge de défilement de sa hauteur ; à 56rem, aucune", () => {
  assert.deepEqual(defautsDeLaMargeDuVolet(COMBAT), []);
  const refuse = (css, motif) => assert.match(defautsDeLaMargeDuVolet(css).join("\n"), motif);
  // La feuille d'avant : aucune marge.
  refuse(casser(FEUILLE, `${RACINE_DU_VOLET} {\n  scroll-padding-bottom: var(--hauteur-volet);\n}\n\n`, ""), /\{ scroll-padding-bottom: null \} : pas la hauteur du volet/);
  refuse(casser(FEUILLE, "  scroll-padding-bottom: var(--hauteur-volet);", "  scroll-padding-bottom: var(--espace-6);"), /\{ scroll-padding-bottom: var\(--espace-6\) \} : pas la hauteur du volet/);
  refuse(casser(FEUILLE, "    scroll-padding-bottom: auto;", "    scroll-padding-bottom: var(--hauteur-volet);"), /la bulle posée garde la marge/);
  // Une marge posée ailleurs, ou autre chose posé sur la racine.
  refuse(`${FEUILLE}\n.combat-fiche {\n  scroll-margin-bottom: var(--hauteur-volet);\n}\n`, /^\.combat-fiche \{ scroll-margin-bottom: var\(--hauteur-volet\) \}$/m);
  refuse(`${FEUILLE}\n${RACINE_DU_VOLET} {\n  overflow: hidden;\n}\n`, /\{ overflow: hidden \}$/m);
});

// Contrat § 10.3, le bandeau.
const ATTENDUES_DU_BANDEAU = [
  [".combat-bandeau", "background", "var(--fond-2)", null],
  [".combat-bandeau", "border-left", "var(--trait-epais) solid var(--accent)", null],
  [".combat-bandeau-en-cours", "border-left-color", "var(--combat-alerte)", null],
  [".combat-bandeau-texte", "font-family", "var(--police-journal)", null],
  [".combat-bandeau-texte", "line-height", "var(--interligne)", null],
  [".combat-bandeau-texte", "overflow", "hidden", null],
  [".combat-bandeau-etiquette", "display", "none", null],
  [".combat-bandeau-etiquette", "display", "block", MEDIA_56],
  [".combat-bandeau", "grid-area", "bandeau", MEDIA_56],
];
function defautsDuBandeau(css) {
  const defauts = ecarts(css, ATTENDUES_DU_BANDEAU);
  if (!(rangDe(css, ".combat-bandeau-en-cours") > rangDe(css, ".combat-bandeau"))) defauts.push("la bordure du geste en cours ne l'emporte pas");
  // Trois lignes au plus : trois fois l'interligne de sa propre taille de texte.
  const hauteur = valeur(css, ".combat-bandeau-texte", "max-height");
  const [, taille, lignes] = (hauteur ?? "").match(/^calc\(var\(--([\w-]+)\) \* var\(--interligne\) \* (\d+)\)$/) ?? [];
  if (lignes !== "3" || `var(--${taille})` !== valeur(css, ".combat-bandeau-texte", "font-size")) defauts.push(`trois lignes au plus : ${hauteur}`);
  // La ligne entière, cachée à la vue par le procédé de l'annonce, et lue.
  for (const propriete of ["position", "width", "height", "margin", "overflow", "clip-path", "white-space"]) {
    if (valeur(css, ".combat-bandeau-entier", propriete) !== valeur(css, ".combat-annonce", propriete)) defauts.push(`la ligne entière : ${propriete}`);
  }
  for (const propriete of ["display", "visibility"]) if (valeur(css, ".combat-bandeau-entier", propriete) !== null) defauts.push(`la ligne entière n'est plus lue : ${propriete}`);
  return defauts;
}

test("combat.css — le bandeau : le second fond, la bordure de l'accent, de l'alerte en cours ; chasse fixe, trois lignes au plus ; la ligne entière cachée comme l'annonce ; l'étiquette cachée sous 56rem", () => {
  assert.deepEqual(defautsDuBandeau(COMBAT), []);
  const refuse = (css, motif) => assert.match(defautsDuBandeau(css).join("\n"), motif);
  refuse(casser(FEUILLE, "var(--interligne) * 3)", "var(--interligne) * 4)"), /trois lignes au plus : calc\(var\(--taille-petite\) \* var\(--interligne\) \* 4\)/);
  refuse(casser(FEUILLE, ".combat-bandeau-etiquette {\n  display: none;", ".combat-bandeau-etiquette {\n  display: block;"), /\.combat-bandeau-etiquette \{ display: block \} au lieu de none/);
  refuse(`${casser(FEUILLE, ".combat-annonce,\n.combat-bandeau-entier {", ".combat-annonce {")}\n.combat-bandeau-entier {\n  display: none;\n}\n`, /la ligne entière : position[\s\S]*n'est plus lue : display/);
  refuse(casser(FEUILLE, ".combat-bandeau-en-cours {\n  border-left-color: var(--combat-alerte);", ".combat-bandeau-en-cours {\n  border-left-color: var(--accent);"), /border-left-color: var\(--accent\) \} au lieu de var\(--combat-alerte\)/);
});

// Contrat § 10.3, le journal et le bandeau (le tableau du complément, § 4.8), le cadre d'un jet, les lignes barrées, les
// causes ; la phrase de la limite.
const ATTENDUES_DU_JOURNAL = [
  [".combat-seg-pj", "color", "var(--combat-pj-texte)"],
  [".combat-seg-pj", "font-weight", "var(--graisse-forte)"],
  [".combat-seg-adv", "color", "var(--combat-adv-texte)"],
  [".combat-seg-adv", "font-weight", "var(--graisse-forte)"],
  [".combat-seg-capacite", "color", "var(--accent)"],
  [".combat-seg-tour", "color", "var(--accent)"],
  [".combat-seg-reussite", "color", "var(--combat-reussite)"],
  [".combat-seg-echec", "color", "var(--combat-echec)"],
  [".combat-seg-valeur", "color", "var(--combat-alerte)"],
  [".combat-seg-valeur", "font-weight", "var(--graisse-forte)"],
  [".combat-lignes .combat-mort", "color", "var(--combat-echec)"],
  [".combat-bandeau .combat-mort", "color", "var(--combat-echec)"],
  [".combat-bandeau .combat-mort", "font-weight", "var(--graisse-forte)"],
  [".combat-seg-fin", "font-style", "italic"],
  [".combat-seg-fin", "color", "var(--texte-2)"],
  [".combat-cadre-jet", "border", "var(--trait) solid var(--combat-cadre-jet)"],
  [".combat-cadre-jet", "background", "var(--combat-cadre-jet-fond)"],
  [".combat-cadre-jet", "border-radius", "var(--rayon-cadre)"],
  [".combat-cadre-jet", "padding", "0 var(--marge-cadre)"],
  [".combat-cadre-jet", "box-decoration-break", "clone"],
  [".combat-cadre-jet", "-webkit-box-decoration-break", "clone"],
  [".combat-de-insecable", "white-space", "nowrap"],
  [".combat-annulee", "text-decoration", "line-through"],
  [".combat-cause-avantage", "color", "var(--combat-reussite)"],
  [".combat-cause-desavantage", "color", "var(--combat-echec)"],
  [".combat-limite", "color", "var(--combat-alerte)"],
].map(([selecteur, propriete, attendue]) => [selecteur, propriete, attendue, null]);
function defautsDuJournal(css) {
  const defauts = ecarts(css, ATTENDUES_DU_JOURNAL);
  // Ce qui se colore, et rien d'autre : un segment ne porte qu'une couleur, une graisse ou un italique.
  for (const regle of selecteursDe(css)) {
    if (!/\.combat-seg-[\w-]+$/.test(regle.selecteur)) continue;
    for (const [propriete] of declarations(regle.corps)) if (!/^(?:color|font-weight|font-style)$/.test(propriete)) defauts.push(`${regle.selecteur} : ${propriete}`);
  }
  return defauts;
}

test("combat.css — le journal et le bandeau : les segments colorés, et rien d'autre ; le cadre d'un jet, qui suit la ligne ; un dé insécable ; les lignes barrées ; les causes ; la limite", () => {
  assert.deepEqual(defautsDuJournal(COMBAT), []);
  const refuse = (css, motif) => assert.match(defautsDuJournal(css).join("\n"), motif);
  refuse(casser(FEUILLE, "  -webkit-box-decoration-break: clone;\n", ""), /-webkit-box-decoration-break: null/);
  refuse(casser(FEUILLE, ".combat-seg-pj {\n  color: var(--combat-pj-texte);\n  font-weight: var(--graisse-forte);", ".combat-seg-pj {\n  color: var(--combat-pj-texte);"), /\.combat-seg-pj \{ font-weight: null \}/);
  refuse(casser(FEUILLE, ".combat-seg-reussite {\n  color: var(--combat-reussite);", ".combat-seg-reussite {\n  color: var(--combat-reussite);\n  background: var(--combat-pj-doux);"), /\.combat-seg-reussite : background/);
  refuse(casser(FEUILLE, ".combat-de-insecable {\n  white-space: nowrap;", ".combat-de-insecable {\n  white-space: normal;"), /\.combat-de-insecable \{ white-space: normal \}/);
  refuse(casser(FEUILLE, "  border: var(--trait) solid var(--combat-cadre-jet);", "  border: var(--trait) solid var(--bordure);"), /\.combat-cadre-jet \{ border: var\(--trait\) solid var\(--bordure\) \}/);
});

// La dernière ligne du journal reste vue (compl. § 4.5 : la liste « défile en elle-même pour montrer sa dernière
// ligne » ; spéc. § 17.7). Une ligne sautée hors de la vue (content-visibility) n'a, tant qu'elle n'a pas été vue, que la
// hauteur d'attente de contain-intrinsic-size : la liste se calait au bout sur ces hauteurs, puis, le journal amené dans
// la fenêtre, les lignes reprenaient la leur, et la dernière tombait de 252 à 2 667 px sous la partie vue, dans Edge et
// dans Firefox (captures finales du groupe 2, D-1). La feuille n'en pose donc nulle part : sur une ligne, par quelque
// sélecteur qui l'atteigne, comme sur la liste ou ce qui la contient, l'effet serait le même. Le jeton de la hauteur
// d'attente est parti avec la règle.
const SAUTE_HORS_DE_LA_VUE = /^(?:content-visibility|contain-intrinsic-(?:size|width|height|block-size|inline-size))$/;
function defautsDuJournalVu(css, jetonsCss) {
  const defauts = [];
  for (const regle of selecteursDe(css)) {
    for (const [propriete, v] of declarations(regle.corps)) {
      if (SAUTE_HORS_DE_LA_VUE.test(propriete)) defauts.push(`${[regle.cadre, regle.selecteur].filter(Boolean).join(" ")} { ${propriete}: ${v} } : la dernière ligne du journal ne resterait pas vue`);
    }
  }
  if ("hauteur-ligne-journal" in jetons(jetonsCss, "clair")) defauts.push("--hauteur-ligne-journal déclaré dans jetons.css : la hauteur d'attente d'une ligne du journal");
  return defauts;
}

test("combat.css — la dernière ligne du journal reste vue : ni content-visibility ni contain-intrinsic-size, sur ses lignes ni ailleurs dans la feuille ; plus de jeton de hauteur d'attente", () => {
  assert.deepEqual(defautsDuJournalVu(COMBAT, JETONS), []);
  const refuse = (css, motif, jetonsCss = JETONS) => assert.match(defautsDuJournalVu(css, jetonsCss).join("\n"), motif);
  // La règle des lignes d'avant les captures finales (C-08), et son jeton.
  const ligne = ".combat-lignes li {\n  padding: var(--espace-1) 0;\n  border-bottom: var(--trait) solid var(--separateur);\n  overflow-wrap: anywhere;\n";
  refuse(casser(FEUILLE, ligne, `${ligne}  content-visibility: auto;\n  contain-intrinsic-size: auto var(--hauteur-ligne-journal);\n`), /^\.combat-lignes li \{ content-visibility: auto \} : [^\n]*\n\.combat-lignes li \{ contain-intrinsic-size: auto var\(--hauteur-ligne-journal\) \}/m);
  refuse(FEUILLE, /--hauteur-ligne-journal déclaré dans jetons\.css/, JETONS.replace("--marge-cadre: 3px;", "--marge-cadre: 3px;\n  --hauteur-ligne-journal: calc(var(--taille-petite) * var(--interligne));"));
  // L'une sans l'autre ; sur la liste ; sur une ligne d'un tour, dans un cadre ; sur une ligne annulée.
  refuse(casser(FEUILLE, ligne, `${ligne}  contain-intrinsic-size: auto var(--espace-6);\n`), /^\.combat-lignes li \{ contain-intrinsic-size: auto var\(--espace-6\) \}/m);
  refuse(casser(FEUILLE, ".combat-lignes {\n  max-height", ".combat-lignes {\n  content-visibility: auto;\n  max-height"), /^\.combat-lignes \{ content-visibility: auto \}/m);
  refuse(`${FEUILLE}\n@media (min-width: 56rem) {\n  .combat-lignes li.tour {\n    content-visibility: auto;\n  }\n}\n`, /^@media \(min-width: 56rem\) \.combat-lignes li\.tour \{ content-visibility: auto \}/m);
  refuse(`${FEUILLE}\n.combat-annulee {\n  contain-intrinsic-height: auto var(--espace-6);\n}\n`, /^\.combat-annulee \{ contain-intrinsic-height: auto var\(--espace-6\) \}/m);
  // Le texte d'un commentaire ne compte pas : la feuille dit pourquoi elle n'en pose pas.
  assert.deepEqual(defautsDuJournalVu("/* Sautée hors de la vue (content-visibility: auto;) */\n.combat-lignes li {\n  overflow-wrap: anywhere;\n}\n", JETONS), []);
});

// Contrat § 10.3 : ni transform, ni filter, ni container-type sur .combat et .combat-cadre (ni rien qui ferait d'eux le
// repère d'un élément fixé à la fenêtre : le volet s'y accrocherait).
const FONT_UN_REPERE = /^(?:transform|translate|rotate|scale|filter|backdrop-filter|perspective|container|container-type|contain|will-change|content-visibility)$/;
function defautsDuRepere(css) {
  return selecteursDe(css)
    .filter((regle) => [".combat", ".combat-cadre", "#ecran:has(> .combat)"].includes(regle.selecteur))
    .flatMap((regle) => declarations(regle.corps).filter(([propriete]) => FONT_UN_REPERE.test(propriete)).map(([propriete, v]) => `${regle.cadre ?? ""} ${regle.selecteur} { ${propriete}: ${v} }`.trim()));
}

test("combat.css — ni transform, ni filter, ni container-type sur .combat et .combat-cadre : le volet reste fixé à la fenêtre", () => {
  assert.deepEqual(defautsDuRepere(COMBAT), []);
  assert.deepEqual(defautsDuRepere(`${FEUILLE}\n.combat-cadre {\n  transform: translateZ(0);\n}\n`), [".combat-cadre { transform: translateZ(0) }"]);
  assert.deepEqual(defautsDuRepere(casser(FEUILLE, "@media (min-width: 80rem) {\n", "@media (min-width: 80rem) {\n  .combat {\n    container-type: inline-size;\n  }\n\n")), ["@media (min-width: 80rem) .combat { container-type: inline-size }"]);
  assert.deepEqual(defautsDuRepere(".combat-cadre { filter: none; }\n.combat-case { container-type: size; }"), [".combat-cadre { filter: none }"]);
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
