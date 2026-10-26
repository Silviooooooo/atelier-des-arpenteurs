// La page « Apparence » : le choix du thème (SPECIFICATION.md, § 9 et
// § 10.1 ; mission du lot 5, § 3.7).
//
// Une section par famille, dans l'ordre de FAMILLES, et un bouton-vignette
// par thème. La vignette d'un thème porte elle-même data-theme="<code>" :
// css/themes.css la dessine dans ses couleurs et sa police de titre. Celle
// d'« Atelier », le thème par défaut, n'en porte pas : elle se dessine dans
// le thème de la page, et montre les pastilles de ses deux variantes, la
// claire et la sombre, qui suivent le réglage de l'appareil.
//
// Un clic applique le thème aussitôt (data-theme sur <html>, retiré pour
// « Atelier »), le garde sur l'appareil, met à jour aria-pressed des
// vignettes sans redessiner la page, l'annonce dans une seule région polie,
// et donne son fond aux deux balises <meta name="theme-color">, la couleur de
// la barre du navigateur. Au rechargement, js/apparence/theme_initial.js
// relit ce qui est gardé, avant le premier dessin.
//
// L'écran s'ouvre sans la banque, comme l'espace auteur : il ne lit que le
// catalogue (js/apparence/themes.js).

import { FAMILLES, THEMES } from "../apparence/themes.js";
import { el, titre } from "./dom.js";

// La clé du thème gardé : celle que relit js/apparence/theme_initial.js.
// Sa valeur est le code brut (« taverne »), sans JSON : ni lireMemoire ni
// ecrireMemoire d'application.js, qui écrivent du JSON, ne servent donc ici.
const CLE_THEME = "atelier.theme";

const AIDE = "Un clic applique le thème à tout le site, aussitôt. Il se garde sur cet appareil : chaque joueur choisit le sien.";

// Les deux entrées d'« Atelier » donnent les valeurs de css/jetons.css et ne
// s'appliquent jamais par data-theme ; les trente-six autres, si.
const CLAIR = THEMES.find((theme) => theme.code === "atelier-clair");
const SOMBRE = THEMES.find((theme) => theme.code === "atelier-sombre");
const APPLIQUES = THEMES.filter((theme) => theme !== CLAIR && theme !== SOMBRE);
// Une Map : un nom que tout objet porte (« constructor ») n'y est pas un code.
const PAR_CODE = new Map(APPLIQUES.map((theme) => [theme.code, theme]));

// « Atelier », une vignette à elle seule, sans code : son choix retire
// l'attribut et la clé.
const ATELIER = {
  code: null,
  nom: "Atelier",
  famille: CLAIR.famille,
  mode: "selon l'appareil",
  description: "Le site d'aujourd'hui, clair ou sombre selon le réglage de l'appareil.",
};

// Les trente-sept choix, « Atelier » d'abord, puis le catalogue dans son ordre.
const CHOIX = [ATELIER, ...APPLIQUES];

// Les quatre pastilles d'une vignette : le jeton que chacune montre.
const PASTILLES = [["fond", "fond"], ["accent", "accent"], ["pj", "combat-pj"], ["adv", "combat-adv"]];

/** Le thème actuel : le code que porte <html>, ou null pour « Atelier », que vaut aussi un code inconnu. */
function themeActuel() {
  const code = document.documentElement.getAttribute("data-theme");
  return PAR_CODE.has(code) ? code : null;
}

// Le thème appliqué à toute la page : css/themes.css lit l'attribut.
function appliquer(code) {
  const racine = document.documentElement;
  if (code === null) racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", code);
}

// Le thème gardé sur cet appareil ; « Atelier » retire la clé.
function garder(code) {
  try {
    if (code === null) localStorage.removeItem(CLE_THEME);
    else localStorage.setItem(CLE_THEME, code);
  } catch {
    // Stockage refusé (navigation privée, réglage du navigateur) : le thème
    // vaut pour cette visite, sans autre effet.
  }
}

// La couleur de la barre du navigateur : le fond du thème choisi dans les
// deux balises ; pour « Atelier », le fond clair dans la balise du réglage
// clair, le sombre dans celle du réglage sombre, comme les écrit index.html.
function teinter(code) {
  for (const balise of document.querySelectorAll('meta[name="theme-color"]')) {
    const sombre = (balise.getAttribute("media") ?? "").includes("dark");
    const fond = code === null ? (sombre ? SOMBRE : CLAIR).jetons.fond : PAR_CODE.get(code).jetons.fond;
    balise.setAttribute("content", fond);
  }
}

// Les quatre pastilles, décoratives : le nom et le mode disent le thème.
function pastilles(classe = null) {
  return el(
    "span",
    { classe: classe ? `pastilles ${classe}` : "pastilles", "aria-hidden": "true" },
    PASTILLES.map(([nom]) => el("span", { classe: `pastille pastille-${nom}` })),
  );
}

// Une vignette : le nom, les pastilles, le mode ; la description en title et
// en description accessible (un texte masqué, que le nom du bouton ne lit pas).
function vignette(choix, actuel, choisir) {
  const description = `description-theme-${choix.code ?? "atelier"}`;
  const couleurs = choix.code === null ? [pastilles("pastilles-atelier-clair"), pastilles("pastilles-atelier-sombre")] : [pastilles()];
  return el(
    "button",
    {
      type: "button",
      classe: "vignette-theme",
      "data-theme": choix.code,
      // el() écrit true comme un attribut vide, et omet false : la chaîne.
      "aria-pressed": String(choix.code === actuel),
      title: choix.description,
      "aria-describedby": description,
      onclick: () => choisir(choix),
    },
    el("span", { classe: "vignette-theme-nom" }, choix.nom),
    couleurs,
    el("span", { classe: "vignette-theme-mode" }, choix.mode),
    el("span", { id: description, hidden: true }, choix.description),
  );
}

/** L'écran #/apparence. */
export function afficher() {
  const actuel = themeActuel();
  // La seule région polie de la page, créée une fois : chaque clic en
  // change le texte.
  const annonce = el("p", { classe: "secondaire-texte", "aria-live": "polite" });
  const vignettes = [];

  function choisir(choix) {
    appliquer(choix.code);
    garder(choix.code);
    // Les mêmes vignettes, sans redessiner la page : le focus reste où il est.
    for (const [code, bouton] of vignettes) bouton.setAttribute("aria-pressed", String(code === choix.code));
    annonce.textContent = `Thème ${choix.nom} appliqué.`;
    teinter(choix.code);
  }

  const sections = FAMILLES.map((famille) => {
    const membres = CHOIX.filter((choix) => choix.famille === famille.code);
    const boutons = membres.map((choix) => {
      const bouton = vignette(choix, actuel, choisir);
      vignettes.push([choix.code, bouton]);
      return bouton;
    });
    return el(
      "section",
      { classe: "famille-themes" },
      el("h2", {}, famille.nom, el("span", { classe: "secondaire-texte" }, ` · ${membres.length}`)),
      el("div", { classe: "vignettes-themes" }, boutons),
    );
  });

  return el("section", { classe: "apparence" }, titre("Apparence"), el("p", { classe: "secondaire-texte" }, AIDE), annonce, sections);
}
