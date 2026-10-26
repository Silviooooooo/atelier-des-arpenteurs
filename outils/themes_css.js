// Engendre css/themes.css depuis le catalogue des thèmes,
// js/apparence/themes.js (SPECIFICATION.md, § 9 et § 10.1 ; les polices,
// § 10.2).
//
// La feuille a trois parts, dans cet ordre : un commentaire de tête ; au
// niveau supérieur, un @font-face par police de titre hébergée pour les
// thèmes (celles dont le fichier n'est pas null) ; puis un seul
// @media screen, qui contient un bloc par thème, hors les deux entrées
// d'Atelier, et les deux classes des pastilles de la vignette « Atelier ».
// L'impression ne voit donc aucun thème, et ne charge aucune de ces polices.
//
// Chaque bloc écrit ses valeurs en toutes lettres, sans var() vers un autre
// jeton : ses couleurs (moins les trois réservées), ses trois polices, la
// graisse des titres, l'arrondi, l'ajustement et color-scheme. Le sélecteur
// est [data-theme="<code>"], sans :root, car une vignette de la page
// Apparence porte elle aussi data-theme ; il gagne sur le :root de
// css/jetons.css parce que la feuille vient après.
//
// css/themes.css est commité ; tests/themes.test.js le réengendre et le
// compare. Après une modification du catalogue, relancer :
//   node outils/themes_css.js

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JETONS, JETONS_RESERVES, POLICES, THEMES, pileDePolice, policeDuJournal } from "../js/apparence/themes.js";

// Les deux entrées du thème par défaut : css/jetons.css les applique déjà,
// sans data-theme ; seules leurs pastilles s'écrivent ici.
export const ATELIER = ["atelier-clair", "atelier-sombre"];

// Les quatre couleurs des pastilles d'une vignette.
export const PASTILLES = ["fond", "accent", "combat-pj", "combat-adv"];

const TETE = `/* Les thèmes (SPECIFICATION.md, § 9 et § 10.1).

   Feuille engendrée par outils/themes_css.js depuis js/apparence/themes.js :
   ne pas la modifier à la main, mais relancer node outils/themes_css.js.

   Les @font-face des polices de titre sont au niveau supérieur ; un
   navigateur ne télécharge une police que si un texte visible l'emploie.
   Tout le reste est à l'écran seulement : l'impression ne change jamais. */
`;

function declarations(paires, retrait) {
  return paires.map(([nom, valeur]) => `${retrait}${nom}: ${valeur};`).join("\n");
}

function policeDeTitre(police) {
  return `@font-face {
${declarations(
  [
    ["font-family", `"${police.famille}"`],
    ["src", `url("../polices/${police.fichier}") format("woff2")`],
    ["font-weight", police.graisse],
    ["font-style", "normal"],
    ["font-display", "swap"],
  ],
  "  ",
)}
}
`;
}

function blocDeTheme(theme) {
  const couleurs = JETONS.filter((jeton) => !JETONS_RESERVES.includes(jeton)).map((jeton) => [`--${jeton}`, theme.jetons[jeton]]);
  return `  [data-theme="${theme.code}"] {
${declarations(
  [
    ...couleurs,
    ["--police", pileDePolice(theme.police)],
    ["--police-titre", pileDePolice(theme.police_titre)],
    ["--police-journal", policeDuJournal(theme)],
    ["--graisse-titre", theme.graisse_titre],
    ["--rayon", theme.rayon],
    ["--ajustement", theme.ajustement],
    ["color-scheme", theme.mode === "sombre" ? "dark" : "light"],
  ],
  "    ",
)}
  }
`;
}

function pastilles(theme) {
  return `  .pastilles-${theme.code} {
${declarations(PASTILLES.map((jeton) => [`--${jeton}`, theme.jetons[jeton]]), "    ")}
  }
`;
}

/** Le texte de css/themes.css, en fins de ligne LF. */
export function feuilleDesThemes() {
  const polices = Object.values(POLICES).filter((police) => police.fichier !== null);
  const blocs = THEMES.filter((theme) => !ATELIER.includes(theme.code)).map(blocDeTheme);
  const atelier = ATELIER.map((code) => pastilles(THEMES.find((theme) => theme.code === code)));
  return [TETE, ...polices.map(policeDeTitre), `@media screen {\n${[...blocs, ...atelier].join("\n")}}\n`].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cible = new URL("../css/themes.css", import.meta.url);
  writeFileSync(cible, feuilleDesThemes());
  console.log(`Écrit : ${fileURLToPath(cible)}`);
}
