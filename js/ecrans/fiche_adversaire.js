// La fiche d'un adversaire (SPECIFICATION.md, § 16.6).
//
// Un adversaire s'ouvre résolu : ses types appliqués, son multiplicateur,
// son équipement et ses capacités (js/adversaire/resolution.js). Sur un
// grand écran, la carte puis la lecture, où chaque valeur dit d'où elle
// vient, se montrent ensemble (css/ecran.css). Sur un téléphone, deux vues,
// comme pour un personnage (§ 15.5) : la vue lecture, empilée, qui s'ouvre
// d'abord ; la vue carte, la carte à imprimer, à l'échelle de l'écran, que
// le zoom à deux doigts agrandit. Le choix se garde sur l'appareil, à part
// de celui des personnages.
//
// « Imprimer / PDF » sort la seule carte, sans numéro, quelle que soit la
// vue : la carte reste dans la page, masquée à l'écran seulement.

import { defautDe, lecture } from "../adversaire/lecture.js";
import { adresseListe } from "../routes.js";
import { compte, el, introuvable, titre } from "./dom.js";
import { PLAFOND_CARTES, PLAFOND_EXEMPLAIRES, ajouter, cadreDeCartes, exemplaires, imprimerCartes, peutAjouter } from "./rencontre.js";

const MEMOIRE_VUE = "atelier.vue-adversaire";
const VUES = { lecture: "Vue lecture", carte: "Vue carte" };

function vueMemorisee() {
  try {
    const vue = localStorage.getItem(MEMOIRE_VUE);
    if (Object.hasOwn(VUES, vue)) return vue;
  } catch {
    // stockage refusé : la vue lecture
  }
  // Sans choix gardé, la vue lecture : c'est elle qui dit d'où vient chaque
  // valeur. Un grand écran montre les deux, quelle que soit la vue.
  return "lecture";
}

function memoriserVue(vue) {
  try {
    localStorage.setItem(MEMOIRE_VUE, vue);
  } catch {
    // stockage refusé : sans effet
  }
}

export function afficher(contexte, nom) {
  const { banque, index } = contexte.etat;
  const adversaires = index.entrees("adversaires", nom);
  if (!adversaires.length) return introuvable(index, "adversaires", nom);
  const resolus = adversaires.map((adversaire) => index.adversaires().resoudre(adversaire));
  const doublon = resolus.length > 1;

  let vue = vueMemorisee();
  const classeDe = () => `ecran-adversaire vue-${vue}`;
  const racine = el("article", { classe: classeDe() });
  const cadre = cadreDeCartes();
  const boutonsVue = Object.fromEntries(
    Object.entries(VUES).map(([code, libelle]) => [code, el("button", { type: "button", classe: "bouton secondaire", "aria-pressed": String(code === vue), onclick: () => changerVue(code) }, libelle)]),
  );
  function changerVue(nouvelle) {
    vue = nouvelle;
    memoriserVue(vue);
    racine.className = classeDe();
    for (const [code, bouton] of Object.entries(boutonsVue)) bouton.setAttribute("aria-pressed", String(code === vue));
    // Sur un petit écran, la carte est sous les boutons, souvent sous le
    // pli : elle vient à l'écran, sans quoi le geste semblerait sans effet.
    // La lecture, plus haute que l'écran, ne se déplace pas.
    globalThis.requestAnimationFrame?.(() => {
      cadre.mesurer();
      if (vue === "carte") cadre.noeud.scrollIntoView?.({ block: "nearest" });
    });
  }

  // La rencontre vit dans la mémoire de son module : la fiche y ajoute, et
  // dit ce qui s'y trouve déjà.
  const dansLaRencontre = el("p", { classe: "secondaire-texte", role: "status" });
  const versRencontre = el("a", { href: "#/rencontre" }, "Voir la rencontre");
  const ajout = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      onclick: () => {
        ajouter(banque, nom);
        direLaRencontre();
        // Un bouton devenu inactif perd le focus : il passe au lien de la
        // rencontre, comme à son voisin sur l'écran de la rencontre.
        if (ajout.disabled) versRencontre.focus();
      },
    },
    "Ajouter à la rencontre",
  );
  function direLaRencontre() {
    const nombre = exemplaires(banque, nom);
    const dit = nombre ? `${compte(nombre, "exemplaire", "exemplaires")} dans la rencontre` : "Pas encore dans la rencontre";
    ajout.disabled = !peutAjouter(banque, nom);
    dansLaRencontre.textContent = ajout.disabled ? `${dit} : le plafond est atteint (${PLAFOND_EXEMPLAIRES} exemplaires d'un adversaire, ${PLAFOND_CARTES} cartes en tout).` : `${dit}.`;
  }
  direLaRencontre();

  const defauts = resolus.map(defautDe).filter(Boolean);
  cadre.montrer(resolus.map((resolu) => ({ resolu })));

  // Tout ce qui n'est pas la carte reste à l'écran (§ 16.6).
  racine.append(
    el(
      "div",
      { classe: "ne-pas-imprimer" },
      titre(nom),
      doublon ? el("p", { classe: "message" }, `Ce nom désigne ${resolus.length} adversaires : c'est un doublon (E16), ils se suivent ci-dessous. Une rencontre prend le premier.`) : null,
      defauts.length ? el("p", { classe: "message" }, `À vérifier : ${defauts.join(" ; ")}. Il s'affiche et s'imprime tel qu'il se résout.`) : null,
      // Le choix d'une vue n'a lieu que sur un petit écran (css/ecran.css).
      el("div", { classe: "boutons choix-vue" }, boutonsVue.lecture, boutonsVue.carte),
      el("div", { classe: "boutons" }, ajout, el("button", { type: "button", classe: "bouton bouton-principal", onclick: () => imprimerCartes() }, "Imprimer / PDF")),
      dansLaRencontre,
      el("p", { classe: "lien-retour" }, versRencontre, " · ", el("a", { href: adresseListe("types") }, "Types d'adversaires")),
    ),
    el(
      "div",
      { classe: "lectures-adversaire ne-pas-imprimer" },
      resolus.map((resolu) => [doublon ? el("h2", {}, `Ligne ${resolu.ligne}`) : null, lecture(resolu, index)]),
    ),
    cadre.noeud,
  );
  return racine;
}
