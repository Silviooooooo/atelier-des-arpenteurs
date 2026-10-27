// Contrôles des menus, des feuilles et des dialogues du combat
// (SPECIFICATION.md, § 17 ; mission du lot 4.3, § 3, § 4.1, § 4.8 et § 5,
// vues A1, A8, F1, F7, F8, F9, F13 ; contrat de la vague 3, § 4.1, § 4.3 et
// § 7, part C1) : js/ecrans/combat_menus.js, puis l'écran assemblé
// (js/ecrans/combat.js) pour ce qu'il en fait.
//
// La première partie éprouve la couche des menus seule, dans le document
// simulé, sur des vues écrites à la main (la forme du contrat, § 3.1 et
// § 3.7) : chaque genre, la feuille qu'il ouvre, ce qu'un appui rend à
// l'écran par « actions », Échap, le voile, ✕, et le focus rendu.
//
// La seconde ouvre l'écran entier sur la banque de la démonstration, comme
// tests/combat_ecran.test.js : la barre du téléphone (☰, l'état court,
// « Intervenir… », « MJ »), ⋯ et le Mode MJ gardé sur l'appareil, le menu du
// MJ (clic droit, appui long, « Modifier… »), « Changer l'équipement… », la
// palette et son cycle de vie, le dé en surimpression, le journal et les
// fiches en plein écran. Un minuteur simulé tient l'appui long, la phrase
// d'une seconde et le dé : rien n'attend une vraie seconde.
//
// Les nœuds se comparent par identité (assert.ok(a === b)), jamais par
// assert.equal sur un nœud ou un état entier (contrat, § 0).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { magasinRencontreMemoire } from "../js/adversaire/rencontre_gardee.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { indexer } from "../js/banque/consultation.js";
import { magasinCombatMemoire } from "../js/combat/enregistrement.js";
import * as lecture from "../js/combat/lecture.js";
import { creer as creerLesMenus } from "../js/ecrans/combat_menus.js";
import { lirePersonnage } from "../js/personnage/format.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { desImposes } from "./outils/des_imposes.js";
import { installerDom, laisserFiler, liensDeNavigation, poserLaNavigation, texteDe } from "./outils/dom_simule.js";
import { simulerStockage } from "./outils/stockage_espion.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const SOURCE = lire("js/ecrans/combat_menus.js");

const FERMER = "Fermer";
const POINTS = String.fromCodePoint(0x2026);
const INTERVENIR = `Intervenir${POINTS}`;
const MENU_EN_MODE_MJ = `Le menu du MJ s'ouvre en Mode MJ (menu ${String.fromCodePoint(0x22ef)}).`;

// ─── Les outils communs ─────────────────────────────────────────────────────

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const un = (noeud, selecteur) => {
  const trouves = tous(noeud, selecteur);
  assert.equal(trouves.length, 1, `un seul « ${selecteur} », trouvé ${trouves.length}`);
  return trouves[0];
};
const cache = (noeud) => noeud.hasAttribute("hidden");
const inactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";
const repere = (noeud, nom) => un(noeud, `[data-repere=${nom}]`);
function boutonOu(noeud, convient, quoi) {
  const trouves = tous(noeud, "button").filter(convient);
  assert.equal(trouves.length, 1, `un seul bouton ${quoi}, trouvé ${trouves.length} parmi : ${tous(noeud, "button").map(texteDe).join(" | ")}`);
  return trouves[0];
}
const boutonDit = (noeud, texte) => boutonOu(noeud, (b) => texteDe(b) === texte, `« ${texte} »`);
const boutonCommencant = (noeud, debut) => boutonOu(noeud, (b) => texteDe(b).startsWith(debut), `qui commence par « ${debut} »`);
/** Le libellé d'une ligne de menu : son premier enfant. */
const libelleDe = (ligne) => texteDe(ligne.children[0] ?? ligne);
const lignesDe = (noeud) => tous(noeud, ".combat-menu-ligne").map(libelleDe);
function memeNoeud(vu, attendu, quoi = "le nœud") {
  assert.ok(vu === attendu, `${quoi} : ${vu?.tagName ?? vu}.${vu?.className ?? ""} au lieu de ${attendu?.tagName ?? attendu}.${attendu?.className ?? ""}`);
}
const focusSur = (attendu, quoi = "le focus") => memeNoeud(globalThis.document.activeElement, attendu, quoi);
/** La raison liée à un bouton inactif : son texte. */
const raisonDe = (racine, bouton) => texteDe(un(racine, `#${bouton.getAttribute("aria-describedby")}`));

/** Un minuteur simulé : ce qui est posé attend qu'on le lance ; « lancer » joue ce qui tombe à ce délai ou avant. */
function minuteurSimule() {
  const poses = new Map();
  let numero = 0;
  return {
    poses,
    poser(faire, ms) {
      numero += 1;
      poses.set(numero, { faire, ms });
      return numero;
    },
    retirer(n) {
      poses.delete(n);
    },
    delais: () => [...poses.values()].map(({ ms }) => ms),
    lancer(jusqua = Infinity) {
      for (const [n, { faire, ms }] of [...poses]) {
        if (ms > jusqua) continue;
        poses.delete(n);
        faire();
      }
    },
  };
}

/** Les actions données à la couche des menus, relevées : chaque appel, dans l'ordre. */
function espionDActions(reponses = {}) {
  const appels = [];
  const actions = new Proxy(
    {},
    {
      get: (_cible, nom) => (...parametres) => {
        appels.push([nom, ...parametres]);
        return typeof reponses[nom] === "function" ? reponses[nom](...parametres) : undefined;
      },
    },
  );
  return { actions, appels, noms: () => appels.map(([nom]) => nom) };
}

/** Échap sur un nœud : rend vrai si quelqu'un l'a pris. */
function echapSur(noeud) {
  let pris = false;
  noeud.declencher("keydown", {
    key: "Escape",
    preventDefault() {
      pris = true;
    },
  });
  return pris;
}

// ─── Des vues écrites à la main (contrat, § 3.1 et § 3.7) ───────────────────

const actifs = { actif: true, raison: null };
const GESTE_EN_COURS = "Le geste en cours se finit d'abord.";

function barreDuTour(camp = "pj", { intervenir = true, actif = true } = {}) {
  return {
    etat: `Tour 2 · camp des ${camp === "pj" ? "PJ" : "adversaires"}`,
    etatCourt: `Tour 2 · ${camp === "pj" ? "PJ" : "adversaires"}`,
    camp,
    intervenir: intervenir
      ? {
          libelle: INTERVENIR,
          place: camp === "pj" ? "menu" : "barre",
          actif,
          raison: actif ? null : "Personne ne peut intervenir.",
          intervenants: actif
            ? [
                {
                  id: "pj1",
                  nom: "Aubépine Crèmebrûlée",
                  initiales: "A",
                  sous: "2 actions · Dressage minute",
                  options: [
                    {
                      cle: "intervention:pj1:4:0",
                      libelle: "Dressage minute",
                      texte: "Sert un allié avant son tour.",
                      cout: "1 action · gratuit",
                      ...actifs,
                      commande: { evenement: { type: "intervenir", qui: "pj1", capacite: 4, facon: 0 } },
                    },
                  ],
                },
              ]
            : [],
        }
      : null,
  };
}

const ETOURDI = { nom: "Étourdi", texte: "Votre prochaine action coûte une action de plus." };

/** Le menu du MJ de Marmiton de corvée n° 2 (adv4) ; « saisies » : celles du panneau, qui font l'aperçu et « Enregistrer ». */
function menuDuMarmiton(saisies = null, { actif = true } = {}) {
  const menu = actif ? actifs : { actif: false, raison: GESTE_EN_COURS };
  const champs = [
    { cle: "attaque", libelle: "Attaque", sous: "4 au départ", valeur: 4, min: 0, max: 999, entree: { champ: "attaque" } },
    { cle: "defense", libelle: "Défense", sous: "4 au départ", valeur: 4, min: 0, max: 999, entree: { champ: "defense" } },
    { cle: "armure:0", libelle: "Torse, armure", sous: "sur 2", valeur: 2, min: 0, max: 999, entree: { champ: "armure", zone: 0 } },
  ];
  const changees = champs.filter((champ) => saisies !== null && Object.hasOwn(saisies, champ.cle) && saisies[champ.cle] !== champ.valeur);
  const evenement = { type: "mj", genre: "valeurs", qui: "adv4", valeurs: changees.map((champ) => ({ ...champ.entree, valeur: saisies[champ.cle] })) };
  return {
    titre: "Marmiton de corvée n° 2",
    sous: "adversaire · D4 · corps 3/10",
    ...menu,
    note: "Ne change que ce combat ; le journal l'écrit.",
    valeurs: {
      libelle: `Modifier une valeur${POINTS}`,
      texte: "attaque, défense, souffle, actions, lien, corps, armure et endurance d'une zone",
      titre: "Modifier — Marmiton de corvée n° 2",
      sous: "pour ce combat seulement",
      ...menu,
      champs,
      gabarit: { evenement: { type: "mj", genre: "valeurs", qui: "adv4" } },
      apercu: changees.length ? `Le journal écrira : MJ : ${changees.map((champ) => `${champ.libelle.toLowerCase()} de Marmiton n° 2 : ${champ.valeur} → ${saisies[champ.cle]}`).join(", ")}.` : null,
      enregistrer: changees.length ? { libelle: "Enregistrer", ...menu, commande: { evenement }, mj: true } : { libelle: "Enregistrer", actif: false, raison: actif ? "Aucune valeur ne change." : GESTE_EN_COURS, commande: null, mj: true },
      mj: true,
    },
    equipement: { libelle: `Changer l'équipement${POINTS}`, texte: "la cellule Équipement", ...menu, mj: true },
    etats: {
      libelle: `Ajouter ou retirer un état${POINTS}`,
      texte: "un état du classeur, ou un état libre",
      titre: "Un état pour Marmiton de corvée n° 2",
      sous: "du classeur, ou libre",
      ...menu,
      blocs: [
        {
          titre: "Condition (bloc du classeur)",
          options: [
            { libelle: ETOURDI.nom, texte: ETOURDI.texte, ...menu, gabarit: { evenement: { type: "mj", genre: "etat", qui: "adv4", ajout: { capacite: { nom: ETOURDI.nom } } } }, mj: true },
            { libelle: "Affamé", texte: "Vous ne regagnez pas de souffle.", actif: false, raison: "Cet état est déjà porté.", gabarit: { evenement: { type: "mj", genre: "etat", qui: "adv4", ajout: { capacite: { nom: "Affamé" } } } }, mj: true },
          ],
        },
      ],
      libre: { libelle: "État libre", aide: "Un nom : « À terre », « Dans la fumée »…", max: 40, ...menu, gabarit: { evenement: { type: "mj", genre: "etat", qui: "adv4", ajout: {} } }, mj: true },
      durees: [
        { valeur: "tour", libelle: "jusqu'au prochain tour des PJ" },
        { valeur: "combat", libelle: "jusqu'à la fin du combat" },
      ],
      source: "Source : le MJ (menu du jeton).",
      portes: [{ libelle: "Affamé", ...menu, commande: { evenement: { type: "mj", genre: "etat", qui: "adv4", retrait: 7 } }, mj: true }],
      mj: true,
    },
    deplacer: { libelle: `Déplacer sans action${POINTS}`, texte: "touchez ensuite la case d'arrivée", exclue: "D4", ...menu, gabarit: { evenement: { type: "mj", genre: "deplacer", qui: "adv4" } }, mj: true },
    retirer: { libelle: "Retirer du combat", ...menu, commande: { evenement: { type: "mj", genre: "retirer", qui: "adv4" } }, mj: true },
    mj: true,
  };
}

/**
 * La couche des menus, posée dans la page à côté d'un bouton qui l'ouvre
 * (l'ancre) ; rendue une première fois avec ces vues.
 */
function couche({ reponses = {}, vues = {}, minuteur = minuteurSimule() } = {}) {
  const espion = espionDActions(reponses);
  const menus = creerLesMenus(espion.actions, { minuteur });
  const ancre = globalThis.document.createElement("button");
  globalThis.document.body.append(ancre, menus.noeud);
  menus.rendre({ barre: barreDuTour(), modeMj: true, etroit: true, menuMj: (id, saisies) => (id === "adv4" ? menuDuMarmiton(saisies) : null), equipement: () => null, ...vues });
  ancre.focus({ preventScroll: true });
  const feuille = un(menus.noeud, "section.combat-feuille");
  const plein = un(menus.noeud, "section.combat-plein");
  const voile = un(menus.noeud, "div.combat-voile");
  const toast = un(menus.noeud, "p.combat-toast");
  return { ...espion, menus, ancre, feuille, plein, voile, toast, minuteur };
}

/** Un contrôle de la couche seule, dans un document simulé neuf. */
function dansUnDocument(titre, corps) {
  test(titre, async () => {
    const retirer = installerDom();
    try {
      await corps();
    } finally {
      retirer();
    }
  });
}

// ─── Le module ──────────────────────────────────────────────────────────────

test("le module — son en-tête ; dom.js seul ; ni style, ni défilement, ni stockage, ni clé lue ailleurs ; les signes par leur code ; chaque focus sans défiler", () => {
  const enTete = SOURCE.slice(0, SOURCE.indexOf("import "));
  assert.match(enTete, /^\/\/ Les menus, les feuilles et les dialogues du combat/);
  assert.match(enTete, /SPECIFICATION\.md, § 17/);
  assert.match(enTete, /Pourquoi il existe/);
  assert.deepEqual([...SOURCE.matchAll(/^import .* from "(.*)";$/gm)].map(([, chemin]) => chemin), ["./dom.js"]);
  // À la vague 4 : « placer » (W1 n° 8), secours() et aUneBoite (R2 n° 6).
  assert.match(SOURCE, /^export function creer\(actions, \{ minuteur = null, placer = null \} = \{\}\) \{$/m);
  // Puis (relecture des correctifs, C2 et C6) : suspendre(), reprendre() et replacer().
  assert.match(SOURCE, /return \{ noeud, ouvrir, fermer, rendre, suspendre, reprendre, replacer, ouvert: \(\) => genre, secours: \(\) => \(genre === null \? null : ancreDeSecours\) \};/);
  assert.deepEqual([...SOURCE.matchAll(/^export (?:function|const) (\w+)/gm)].map(([, nom]) => nom), ["aUneBoite", "creer"]);
  const INTERDITS = {
    "une écriture de style": /\.style\s*(?:\?\.|\.|\[|=(?!=))|\bsetProperty\s*\(|\bcssText\b|setAttribute\(\s*["'`]style/,
    "un défilement": /scrollIntoView|scrollTo|scrollBy|\.scroll\s*\(|scrollTop\s*=/,
    "un stockage": /localStorage|sessionStorage|\bcookie\b/,
    "une insertion de HTML": /innerHTML|outerHTML|insertAdjacentHTML/,
    "un écouteur global": /(?:globalThis|window|document)\.addEventListener/,
    "un bouton sorti de l'ordre du clavier": /\.disabled\s*=|disabled:\s*true/,
    // Écrire aria-live, jamais ; le lire, oui : la couche épargne la région d'annonce quand elle endort le reste (vague 4, R2 n° 5).
    "une région polie de plus": /["'`]aria-live["'`]\s*[:,]|role: "status"|role: "alert"/,
  };
  for (const [quoi, motif] of Object.entries(INTERDITS)) assert.doesNotMatch(SOURCE, motif, quoi);
  // Chaque focus, sans défiler.
  for (const trouve of SOURCE.matchAll(/\.focus\s*\(/g)) assert.ok(SOURCE.startsWith(".focus({ preventScroll: true })", trouve.index), `ligne ${SOURCE.slice(0, trouve.index).split("\n").length}`);
  // Les signes ✕, −, … et les guillemets, par leur code, dans les chaînes ; ni signe invisible ni espace insécable.
  const code = SOURCE.split("\n").filter((ligne) => !/^\s*(\/\/|\*|\/\*\*)/.test(ligne)).join("\n");
  for (const signe of [0x2715, 0x2212, 0x2026, 0x2014, 0xab, 0xbb, 0xb7]) assert.equal(code.includes(String.fromCodePoint(signe)), false, `U+${signe.toString(16)} écrit tel quel`);
  for (const signe of [0xa0, 0x202f, 0xad, 0xfeff, 0x200b, 0x202e]) assert.equal(SOURCE.includes(String.fromCodePoint(signe)), false, `U+${signe.toString(16)}`);
});

// ─── La couche seule ────────────────────────────────────────────────────────

dansUnDocument("la couche — fermée d'abord : le voile, la feuille, le plein écran et la phrase cachés ; ouvert() rend null", () => {
  const { menus, feuille, plein, voile, toast } = couche();
  assert.equal(menus.ouvert(), null);
  assert.deepEqual([cache(feuille), cache(plein), cache(voile), cache(toast)], [true, true, true, true]);
  // Une feuille est un dialogue modal, que son titre nomme ; ✕ s'appelle « Fermer ».
  assert.deepEqual([feuille.getAttribute("role"), feuille.getAttribute("aria-modal"), feuille.getAttribute("aria-labelledby")], ["dialog", "true", "combat-feuille-titre"]);
  assert.deepEqual([plein.getAttribute("role"), plein.getAttribute("aria-modal"), plein.getAttribute("aria-labelledby")], ["dialog", "true", "combat-plein-titre"]);
  assert.equal(repere(feuille, "fermer").getAttribute("aria-label"), FERMER);
  assert.equal(toast.getAttribute("aria-hidden"), "true", "la phrase d'une seconde ne se lit pas : la région d'annonce la dit");
  // Un genre inconnu n'ouvre rien.
  menus.ouvrir("inconnu", {});
  assert.equal(menus.ouvert(), null);
});

dansUnDocument("⋯ (F13) — « Le combat », l'état court ; l'interrupteur du Mode MJ (role switch, aria-checked, sa phrase) ; « Intervenir… » au tour des PJ ; « Fiches », « Journal », « Nouveau combat » ; la note", () => {
  const { menus, feuille, ancre, voile, appels, noms } = couche({ vues: { modeMj: false } });
  menus.ouvrir("combat", { ancre });
  assert.equal(menus.ouvert(), "combat");
  assert.deepEqual([cache(feuille), cache(voile)], [false, false]);
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Le combat");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "Tour 2 · PJ");
  const interrupteur = un(feuille, ".combat-interrupteur");
  assert.deepEqual([interrupteur.tagName, interrupteur.getAttribute("role"), interrupteur.getAttribute("aria-checked")], ["BUTTON", "switch", "false"]);
  assert.equal(texteDe(un(feuille, `#${interrupteur.getAttribute("aria-labelledby")}`)), "Mode MJ");
  assert.equal(texteDe(un(feuille, `#${interrupteur.getAttribute("aria-describedby")}`)), "Éteint : le jeu suit ses règles ; l'effet d'une capacité s'applique par « Appliquer l'effet de… ».");
  assert.deepEqual(lignesDe(feuille), [INTERVENIR, "Fiches", "Journal", "Nouveau combat"]);
  assert.equal(texteDe(boutonCommencant(feuille, INTERVENIR).children[1]), "le MJ fait intervenir un adversaire");
  assert.ok(texteDe(feuille).endsWith("Le Mode MJ est éteint par défaut, et l'appareil s'en souvient."));
  focusSur(tous(feuille, ".combat-menu-ligne")[0], "le focus à la première ligne");

  // L'interrupteur rend la main à l'écran ; le rendu suivant le dit allumé, et le focus reste sur lui.
  interrupteur.focus({ preventScroll: true });
  interrupteur.click();
  assert.deepEqual(noms(), ["basculerLeModeMj"]);
  menus.rendre({ modeMj: true });
  const allume = un(feuille, ".combat-interrupteur");
  assert.equal(allume.getAttribute("aria-checked"), "true");
  assert.equal(texteDe(un(feuille, `#${allume.getAttribute("aria-describedby")}`)), "Allumé : la palette libre, le menu du MJ (appui long), « Modifier… », choisir la zone, fixer les dégâts.");
  focusSur(allume, "le focus reste sur l'interrupteur refait");

  // « Fiches », « Journal » : l'écran les ouvre ; « Nouveau combat » ferme la feuille, rend le focus à « ⋯ », puis pose sa question.
  boutonDit(feuille, "Fiches").click();
  boutonDit(feuille, "Journal").click();
  boutonDit(feuille, "Nouveau combat").click();
  assert.deepEqual(appels.slice(1).map(([nom, ...parametres]) => [nom, ...parametres]), [["ouvrirFiches", null], ["ouvrirJournal"], ["demanderUnNouveauCombat"]]);
  assert.equal(menus.ouvert(), null);
  focusSur(ancre, "« Nouveau combat » : le focus revient à « ⋯ »");

  // Au tour adverse, « Intervenir… » est dans la barre, pas dans le menu.
  menus.rendre({ barre: barreDuTour("adv") });
  menus.ouvrir("combat", { ancre });
  assert.deepEqual(lignesDe(feuille), ["Fiches", "Journal", "Nouveau combat"]);
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "Tour 2 · adversaires");
});

dansUnDocument("⋯ — ✕, Échap et le voile ferment, et le focus revient à ce qui l'avait ouverte ; « apres » est appelé", () => {
  const { menus, feuille, ancre, voile, appels } = couche();
  let rendus = 0;
  for (const fermer of [() => repere(feuille, "fermer").click(), () => assert.equal(echapSur(menus.noeud), true), () => voile.click()]) {
    menus.ouvrir("combat", { ancre, apres: () => (rendus += 1) });
    assert.equal(menus.ouvert(), "combat");
    fermer();
    assert.equal(menus.ouvert(), null);
    assert.deepEqual([cache(feuille), cache(voile)], [true, true]);
    focusSur(ancre);
  }
  assert.equal(rendus, 3);
  assert.deepEqual(appels, [], "fermer ne demande rien à l'écran");
  // Fermée, Échap n'est pas pris.
  assert.equal(echapSur(menus.noeud), false);
  // Sans ancre donnée, le focus revient à l'élément actif au moment de l'ouverture.
  const autre = globalThis.document.createElement("button");
  globalThis.document.body.append(autre);
  autre.focus({ preventScroll: true });
  menus.ouvrir("combat");
  menus.fermer();
  focusSur(autre);
  // Un nœud qui a quitté la page ne reprend pas le focus.
  menus.ouvrir("combat", { ancre: globalThis.document.createElement("button") });
  const avant = globalThis.document.focalisations.length;
  menus.fermer();
  assert.equal(globalThis.document.focalisations.length, avant);
});

// Mesuré dans Edge (vague 4, M) : l'appui long ouvre le menu du MJ, le voile paraît sous le doigt, et le
// mousedown que le navigateur tire de l'appui y tombait ; son défaut portait le focus sur main#ecran,
// hors de la feuille : Échap n'était plus pris, ni Tab retenu.
dansUnDocument("la couche — un appui sur le voile n'y porte pas le focus : son mousedown est empêché, et rien ne se ferme avant le clic", () => {
  const { menus, voile, ancre } = couche();
  menus.ouvrir("combat", { ancre });
  let empeche = false;
  voile.declencher("mousedown", { preventDefault() { empeche = true; } });
  assert.equal(empeche, true, "le mousedown du voile est empêché");
  assert.equal(menus.ouvert(), "combat", "l'appui seul ne ferme rien");
  voile.click();
  assert.equal(menus.ouvert(), null, "le clic ferme, comme avant");
});

// Mesuré dans Edge (vague 4, M) : un clic sur ce qui ne prend pas le focus dans la feuille (sa phrase, sa marge),
// ou l'appui long quand la feuille monte sous le doigt (320 px), portait le focus sur main#ecran, hors du dialogue,
// et Échap ne la fermait plus. La feuille le prend elle-même (tabindex -1), sans entrer dans l'ordre de Tab.
dansUnDocument("la couche — la feuille prend le focus d'un clic sur ce qui ne le prend pas (tabindex -1), hors de l'ordre de Tab", () => {
  const { menus, feuille, ancre } = couche();
  assert.equal(feuille.getAttribute("tabindex"), "-1");
  menus.ouvrir("combat", { ancre });
  feuille.focus({ preventScroll: true });
  focusSur(feuille);
  // Tab depuis la feuille elle-même mène à sa première commande, et Échap la ferme.
  let retenu = false;
  menus.noeud.declencher("keydown", { key: "Tab", shiftKey: false, preventDefault() { retenu = true; } });
  assert.equal(retenu, true, "Tab est retenu dans la feuille");
  assert.equal(echapSur(menus.noeud), true);
  assert.equal(menus.ouvert(), null);
});

// Relecture finale (R7) : le plein écran restait sans tabindex. Un clic sur le texte d'une fiche (un details,
// hors de son summary et de ses boutons) portait le focus sur main#ecran, hors du dialogue, et Échap ne le
// fermait plus. Il le prend lui aussi (tabindex -1), sans entrer dans l'ordre de Tab.
dansUnDocument("la couche — le plein écran prend lui aussi le focus d'un clic sur ce qui ne le prend pas (tabindex -1), hors de l'ordre de Tab (relecture finale, R7)", () => {
  const { menus, plein, ancre } = couche();
  assert.equal(plein.getAttribute("tabindex"), "-1");
  const texte = globalThis.document.createElement("p");
  menus.ouvrir("fiches", { ancre, titre: "Fiches", contenu: [texte] });
  plein.focus({ preventScroll: true });
  focusSur(plein);
  let retenu = false;
  menus.noeud.declencher("keydown", { key: "Tab", shiftKey: false, preventDefault() { retenu = true; } });
  assert.equal(retenu, true, "Tab est retenu dans le plein écran");
  assert.equal(echapSur(menus.noeud), true);
  assert.equal(menus.ouvert(), null);
  focusSur(ancre, "Échap : le focus revient à ce qui l'avait ouvert");
});

dansUnDocument("☰ — les liens de la navigation du site, relus à l'ouverture, tels quels ; « L'Atelier des Arpenteurs » ; un lien suivi ferme la feuille", () => {
  const { menus, feuille, ancre } = couche();
  poserLaNavigation({ courante: "combat" });
  menus.ouvrir("site", { ancre });
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "L'Atelier des Arpenteurs");
  const liens = tous(feuille, "a.combat-menu-ligne");
  assert.deepEqual(
    liens.map((lien) => [lien.getAttribute("href"), texteDe(lien)]),
    liensDeNavigation().map(({ href, texte }) => [href, texte]),
  );
  assert.equal(liens.length, 10);
  assert.deepEqual(liens.filter((lien) => lien.getAttribute("aria-current") === "page").map(texteDe), ["Combat"]);
  assert.equal(un(feuille, "nav").getAttribute("aria-label"), "L'Atelier des Arpenteurs");
  focusSur(liens[0]);
  liens[2].click();
  assert.equal(menus.ouvert(), null, "le lien suivi, la feuille se ferme");
  // Une navigation changée se relit à la réouverture.
  globalThis.document.querySelector(".navigation a[data-route=blocs]").setAttribute("aria-current", "page");
  globalThis.document.querySelector(".navigation a[data-route=combat]").removeAttribute("aria-current");
  menus.ouvrir("site", { ancre });
  assert.deepEqual(tous(feuille, "a.combat-menu-ligne").filter((lien) => lien.getAttribute("aria-current") === "page").map(texteDe), ["Blocs"]);
});

dansUnDocument("Intervenir… (F1) — « qui intervient ? » ; une ligne par intervention, son texte et son coût ; un appui ferme la feuille et joue la commande ; inactif, sa raison ; sans vue, la feuille se ferme", () => {
  const { menus, feuille, ancre, appels } = couche({ vues: { barre: barreDuTour("adv") } });
  menus.ouvrir("intervenir", { ancre });
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Intervenir");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "qui intervient ? (ceux qui ont encore une action)");
  assert.deepEqual(tous(feuille, "h3").map(texteDe), ["A · Aubépine Crèmebrûlée · 2 actions · Dressage minute"]);
  const option = boutonCommencant(feuille, "Dressage minute");
  assert.equal(texteDe(option), "Dressage minuteSert un allié avant son tour. · 1 action · gratuit");
  assert.equal(option.getAttribute("data-cle"), "intervention:pj1:4:0", "la clé de l'option reste dans la couche");
  assert.ok(texteDe(feuille).endsWith("Puis l'intervention se joue comme un geste : palette, et jet s'il le faut."));
  option.click();
  assert.equal(menus.ouvert(), null);
  assert.deepEqual(appels, [["executer", { evenement: { type: "intervenir", qui: "pj1", capacite: 4, facon: 0 } }, "menu"]]);

  // Inactif : sa raison, et rien à choisir.
  menus.rendre({ barre: barreDuTour("adv", { actif: false }) });
  menus.ouvrir("intervenir", { ancre });
  assert.ok(texteDe(feuille).includes("Personne ne peut intervenir."));
  assert.equal(tous(feuille, ".combat-menu-ligne").length, 0);
  // La barre n'offre plus « Intervenir… » (un combat fini) : la feuille se ferme.
  menus.rendre({ barre: barreDuTour("adv", { intervenir: false }) });
  assert.equal(menus.ouvert(), null);
  focusSur(ancre);
});

dansUnDocument("le menu du MJ (F7) — titre, sous-titre, les cinq entrées et leurs textes, la note ; pendant un geste, tout inactif avec la raison ; il se ferme avec le Mode MJ, ou quand le protagoniste n'en a plus", () => {
  let actif = true;
  let present = true;
  const { menus, feuille, ancre, appels } = couche({ vues: { menuMj: (id, saisies) => (present ? menuDuMarmiton(saisies, { actif }) : null) } });
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Marmiton de corvée n° 2");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "adversaire · D4 · corps 3/10");
  assert.deepEqual(lignesDe(feuille), [`Modifier une valeur${POINTS}`, `Changer l'équipement${POINTS}`, `Ajouter ou retirer un état${POINTS}`, `Déplacer sans action${POINTS}`, "Retirer du combat"]);
  assert.deepEqual(
    tous(feuille, ".combat-menu-ligne").map((ligne) => texteDe(ligne.children[1] ?? ligne)),
    ["attaque, défense, souffle, actions, lien, corps, armure et endurance d'une zone", "la cellule Équipement", "un état du classeur, ou un état libre", "touchez ensuite la case d'arrivée", "Retirer du combat"],
  );
  assert.ok(texteDe(feuille).endsWith("Ne change que ce combat ; le journal l'écrit."));
  assert.equal(feuille.className, "combat-feuille", "au téléphone, une feuille qui monte du bas");
  // Sur PC, le menu d'un jeton (contexte).
  menus.rendre({ etroit: false });
  assert.equal(feuille.className, "combat-feuille combat-menu-contexte");

  // « Retirer du combat » : la feuille se ferme, le focus revient au jeton, la commande part.
  repere(feuille, "mj-retirer").click();
  assert.deepEqual(appels, [["executer", { evenement: { type: "mj", genre: "retirer", qui: "adv4" } }, "menu"]]);
  focusSur(ancre);

  // Pendant un geste : tout inactif, chaque entrée avec la raison ; un appui ne fait rien.
  actif = false;
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.ok(texteDe(un(feuille, ".combat-feuille-corps")).startsWith(GESTE_EN_COURS));
  for (const ligne of tous(feuille, ".combat-menu-ligne")) {
    assert.equal(inactif(ligne), true, libelleDe(ligne));
    assert.equal(raisonDe(feuille, ligne), GESTE_EN_COURS);
    ligne.click();
  }
  assert.equal(appels.length, 1, "rien ne part");
  assert.equal(menus.ouvert(), "mj");
  // Le Mode MJ éteint : le menu se ferme.
  menus.rendre({ modeMj: false });
  assert.equal(menus.ouvert(), null);
  // Rallumé, il se rouvre ; le protagoniste sans menu (mort, retiré) le referme.
  menus.rendre({ modeMj: true });
  actif = true;
  menus.ouvrir("mj", { id: "adv4", ancre });
  present = false;
  menus.rendre({});
  assert.equal(menus.ouvert(), null);
  // Un protagoniste sans menu ne l'ouvre pas.
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.equal(menus.ouvert(), null);
});

dansUnDocument("« Déplacer sans action… » — la feuille se ferme, la carte demande la case (sauf la sienne), nommée ; la phrase « Touchez la case d'arrivée. » ; la case choisie joue le déplacement", () => {
  const { menus, feuille, ancre, appels } = couche();
  menus.ouvrir("mj", { id: "adv4", ancre });
  repere(feuille, "mj-deplacer").click();
  assert.equal(menus.ouvert(), null);
  focusSur(ancre, "le focus revient au jeton");
  assert.deepEqual(appels.map(([nom]) => nom), ["demanderUneCase", "dire"]);
  const [, options, rappel] = appels[0];
  assert.equal(options.exclue, "D4");
  assert.equal(options.nommer("D5"), "Case D5 : y déplacer Marmiton de corvée n° 2");
  assert.deepEqual(appels[1], ["dire", "Touchez la case d'arrivée."]);
  rappel("D5");
  assert.deepEqual(appels[2], ["executer", { evenement: { type: "mj", genre: "deplacer", qui: "adv4", vers: "D5" } }, "menu"]);
});

dansUnDocument("« Modifier une valeur… » (F8) — un champ par valeur, − et + ; la saisie rend l'objet entier à l'écran, qui refait l'aperçu et « Enregistrer » ; « change » marque ce qui diffère ; sans changement, inactif avec sa raison ; « Enregistrer » émet", () => {
  const saisiesVues = [];
  const { menus, feuille, ancre, appels } = couche({
    vues: {
      menuMj: (id, saisies) => {
        saisiesVues.push(saisies);
        return menuDuMarmiton(saisies);
      },
    },
  });
  menus.ouvrir("mj", { id: "adv4", ancre });
  repere(feuille, "mj-valeurs").click();
  assert.equal(menus.ouvert(), "valeurs");
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Modifier — Marmiton de corvée n° 2");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "pour ce combat seulement");
  const rangees = tous(feuille, ".combat-champ-mj");
  assert.deepEqual(rangees.map((rangee) => texteDe(un(rangee, "label"))), ["Attaque4 au départ", "Défense4 au départ", "Torse, armuresur 2"]);
  assert.deepEqual(rangees.map((rangee) => un(rangee, "input").value), ["4", "4", "2"]);
  assert.deepEqual(tous(rangees[1], "button").map((b) => b.getAttribute("aria-label")), ["Moins : Défense", "Plus : Défense"]);
  const enregistrer = () => repere(feuille, "enregistrer");
  assert.equal(inactif(enregistrer()), true);
  assert.equal(raisonDe(feuille, enregistrer()), "Aucune valeur ne change.");
  enregistrer().click();
  assert.deepEqual(appels, [], "inactif, il n'émet rien");

  // La défense à 6, saisie : l'écran reçoit l'objet entier ; la rangée est marquée, l'aperçu et « Enregistrer » suivent.
  const defense = repere(feuille, "valeur-defense");
  defense.focus({ preventScroll: true });
  defense.value = "6";
  defense.declencher("input");
  assert.deepEqual(saisiesVues.at(-1), { defense: 6 });
  assert.deepEqual(rangees.map((rangee) => rangee.className), ["combat-champ-mj", "combat-champ-mj change", "combat-champ-mj"]);
  assert.equal(texteDe(repere(feuille, "apercu")), "Le journal écrira : MJ : défense de Marmiton n° 2 : 4 → 6.");
  assert.equal(inactif(enregistrer()), false);
  focusSur(defense, "le champ garde le focus : rien n'est refait sous lui");
  // « + » sur l'attaque : 5 ; « − » la ramène à 4, sa valeur : plus marquée.
  tous(rangees[0], "button")[1].click();
  assert.deepEqual(saisiesVues.at(-1), { defense: 6, attaque: 5 });
  tous(rangees[0], "button")[0].click();
  assert.deepEqual(saisiesVues.at(-1), { defense: 6 });
  assert.equal(rangees[0].className, "combat-champ-mj");
  // Une saisie qui n'est pas un entier ne compte pas.
  defense.value = "six";
  defense.declencher("input");
  assert.deepEqual(saisiesVues.at(-1), {});
  defense.value = "6";
  defense.declencher("input");
  enregistrer().click();
  assert.equal(menus.ouvert(), null);
  assert.deepEqual(appels, [["executer", { evenement: { type: "mj", genre: "valeurs", qui: "adv4", valeurs: [{ champ: "defense", valeur: 6 }] } }, "menu"]]);
  // « Annuler » ferme sans rien émettre ; la réouverture repart de zéro.
  menus.ouvrir("valeurs", { id: "adv4", ancre });
  assert.equal(repere(feuille, "valeur-defense").value, "4");
  boutonDit(feuille, "Annuler").click();
  assert.equal(menus.ouvert(), null);
  assert.equal(appels.length, 1);
});

dansUnDocument("« Ajouter ou retirer un état… » (F9) — les blocs du classeur, l'état libre, la source et la durée ; « Appliquer {état} » complète la durée ; un état porté se retire ; rien de choisi, inactif avec sa raison", () => {
  const { menus, feuille, ancre, appels } = couche();
  menus.ouvrir("etats", { id: "adv4", ancre });
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Un état pour Marmiton de corvée n° 2");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "du classeur, ou libre");
  assert.deepEqual(tous(feuille, "h3").map(texteDe), ["Condition (bloc du classeur)", "État libre", "Source et durée", "Ses états"]);
  assert.ok(texteDe(feuille).includes("Source : le MJ (menu du jeton)."));
  assert.ok(texteDe(feuille).includes("Un nom : « À terre », « Dans la fumée »…"));
  const appliquer = () => repere(feuille, "appliquer-etat");
  assert.equal(texteDe(appliquer()), "Appliquer");
  assert.equal(inactif(appliquer()), true);
  assert.equal(raisonDe(feuille, appliquer()), "Choisissez un état.");
  // Un état inactif garde sa raison.
  assert.equal(inactif(repere(feuille, "etat-0-1")), true);
  assert.equal(raisonDe(feuille, repere(feuille, "etat-0-1")), "Cet état est déjà porté.");

  // Étourdi, puis « jusqu'à la fin du combat » : marqués sur place.
  repere(feuille, "etat-0-0").click();
  assert.deepEqual([repere(feuille, "etat-0-0").getAttribute("aria-pressed"), repere(feuille, "duree-tour").getAttribute("aria-pressed")], ["true", "true"]);
  assert.equal(texteDe(appliquer()), "Appliquer Étourdi");
  repere(feuille, "duree-combat").click();
  assert.deepEqual([repere(feuille, "duree-tour").getAttribute("aria-pressed"), repere(feuille, "duree-combat").getAttribute("aria-pressed")], ["false", "true"]);
  appliquer().click();
  assert.equal(menus.ouvert(), null);
  assert.deepEqual(appels.at(-1), ["executer", { evenement: { type: "mj", genre: "etat", qui: "adv4", ajout: { capacite: { nom: "Étourdi" }, duree: "combat" } } }, "menu"]);

  // L'état libre : son nom, la durée par défaut (« tour »).
  menus.ouvrir("etats", { id: "adv4", ancre });
  const libre = repere(feuille, "etat-libre");
  assert.equal(libre.getAttribute("maxlength"), "40");
  libre.focus({ preventScroll: true });
  libre.value = " À terre ";
  libre.declencher("input");
  assert.equal(texteDe(appliquer()), "Appliquer À terre");
  focusSur(libre, "le nom libre garde le focus");
  appliquer().click();
  assert.deepEqual(appels.at(-1), ["executer", { evenement: { type: "mj", genre: "etat", qui: "adv4", ajout: { libre: "À terre", duree: "tour" } } }, "menu"]);

  // Un état porté se retire.
  menus.ouvrir("etats", { id: "adv4", ancre });
  boutonDit(feuille, "Retirer l'état Affamé").click();
  assert.deepEqual(appels.at(-1), ["executer", { evenement: { type: "mj", genre: "etat", qui: "adv4", retrait: 7 } }, "menu"]);
  assert.equal(menus.ouvert(), null);
});

dansUnDocument("« Changer l'équipement… » (D14) — un personnage : l'arme tenue parmi ses armes, la qualité de chaque objet ; un adversaire : la cellule ; « Enregistrer » rend le choix à l'écran ; un refus se dit, la feuille reste", () => {
  let reponse = { refus: "La qualité est un nombre (« 2 », « 1,5 ») ou rien." };
  const propositions = {
    pj1: { camp: "pj", armes: [{ valeur: 0, libelle: "Couteau d'office" }, { valeur: 1, libelle: "Rouleau de fonte" }], tenue: 0, objets: [{ rang: 0, nom: "Couteau d'office", qualite: "2" }, { rang: 1, nom: "Rouleau de fonte", qualite: "" }] },
    adv4: { camp: "adv", cellule: "" },
  };
  const menuDe = (id) => ({ ...menuDuMarmiton(), titre: id === "pj1" ? "Aubépine Crèmebrûlée" : "Marmiton de corvée n° 2", equipement: { libelle: `Changer l'équipement${POINTS}`, texte: id === "pj1" ? "l'arme tenue, la qualité des objets" : "la cellule Équipement", ...actifs, mj: true } });
  const { menus, feuille, ancre, appels } = couche({ reponses: { changerLEquipement: () => reponse }, vues: { menuMj: (id) => menuDe(id), equipement: (id) => propositions[id] } });
  menus.ouvrir("mj", { id: "pj1", ancre });
  repere(feuille, "mj-equipement").click();
  assert.equal(menus.ouvert(), "equipement");
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Changer l'équipement — Aubépine Crèmebrûlée");
  const armes = tous(feuille, "button").filter((b) => (b.getAttribute("data-repere") ?? "").startsWith("arme-"));
  assert.deepEqual(armes.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Aucune arme", "false"], ["Couteau d'office", "true"], ["Rouleau de fonte", "false"]]);
  repere(feuille, "arme-1").click();
  const qualite = repere(feuille, "qualite-1");
  qualite.value = "1,5";
  qualite.declencher("input");
  repere(feuille, "enregistrer").click();
  assert.deepEqual(appels.at(-2), ["changerLEquipement", "pj1", { tenue: 1, qualites: { 0: "2", 1: "1,5" } }]);
  // Refusé : la raison se dit, dans la feuille et par l'écran ; la feuille reste ouverte.
  assert.equal(menus.ouvert(), "equipement");
  assert.ok(texteDe(feuille).includes("La qualité est un nombre (« 2 », « 1,5 ») ou rien."));
  assert.deepEqual(appels.slice(-2).map(([nom]) => nom), ["changerLEquipement", "dire"]);
  // Accepté : la feuille se ferme.
  reponse = {};
  repere(feuille, "enregistrer").click();
  assert.equal(menus.ouvert(), null);
  focusSur(ancre);

  // Un adversaire : sa cellule Équipement.
  menus.ouvrir("equipement", { id: "adv4", ancre });
  assert.equal(texteDe(un(feuille, "label")), "Équipement");
  const cellule = repere(feuille, "cellule");
  cellule.value = "Couteau d'office";
  cellule.declencher("input");
  repere(feuille, "enregistrer").click();
  assert.deepEqual(appels.at(-1), ["changerLEquipement", "adv4", { cellule: "Couteau d'office" }]);
  // L'écran ne sait pas d'où repartir : sa raison, et « Annuler » seul.
  propositions.adv4 = { refus: "Pas encore possible dans ce simulateur." };
  menus.ouvrir("equipement", { id: "adv4", ancre });
  assert.ok(texteDe(feuille).includes("Pas encore possible dans ce simulateur."));
  assert.deepEqual(tous(feuille, "button").map(texteDe).slice(1), ["Annuler"]);
});

dansUnDocument("la palette — ni tête ni pied : le voile et la place ; nommée par son titre ; Échap et le voile demandent fermerLaPalette, sans fermer d'eux-mêmes", () => {
  const { menus, feuille, ancre, voile, appels } = couche();
  const palette = globalThis.document.createElement("section");
  const titre = globalThis.document.createElement("h2");
  titre.setAttribute("id", "combat-palette-titre-1");
  titre.setAttribute("tabindex", "-1");
  titre.append("Effet de Frappe");
  palette.append(titre);
  menus.ouvrir("palette", { noeud: palette, nom: "Effet de Frappe", ancre });
  assert.equal(menus.ouvert(), "palette");
  memeNoeud(palette.parentNode, un(feuille, ".combat-feuille-corps"), "la palette, dans la feuille");
  assert.deepEqual([cache(un(feuille, ".combat-feuille-tete")), cache(un(feuille, ".combat-feuille-pied"))], [true, true]);
  assert.equal(feuille.getAttribute("aria-labelledby"), "combat-palette-titre-1");
  focusSur(titre, "le focus au titre de la palette");
  assert.equal(echapSur(menus.noeud), true);
  voile.click();
  assert.deepEqual(appels, [["fermerLaPalette"], ["fermerLaPalette"]]);
  assert.equal(menus.ouvert(), "palette", "l'écran la ferme lui-même");
  menus.fermer({ focus: false });
  assert.equal(palette.parentNode, null, "fermée, la place se vide");
  // Une autre feuille reprend son titre.
  menus.ouvrir("combat", { ancre });
  assert.equal(feuille.getAttribute("aria-labelledby"), "combat-feuille-titre");
  assert.equal(cache(un(feuille, ".combat-feuille-tete")), false);
});

dansUnDocument("le plein écran (A8) — le journal et les fiches : un dialogue modal nommé par son titre, ses outils dans sa tête, son contenu prêté puis rendu ; ✕ et Échap ; le focus revient", () => {
  const { menus, plein, ancre, voile } = couche();
  const maison = globalThis.document.createElement("div");
  const copier = globalThis.document.createElement("button");
  copier.append("Copier");
  const liste = globalThis.document.createElement("ol");
  maison.append(copier, liste);
  globalThis.document.body.append(maison);
  let rendu = 0;
  menus.ouvrir("journal", {
    ancre,
    titre: "Journal",
    outils: [copier],
    contenu: [liste],
    apres: () => {
      rendu += 1;
      maison.append(copier, liste);
    },
  });
  assert.equal(menus.ouvert(), "journal");
  assert.deepEqual([cache(plein), cache(voile)], [false, false]);
  assert.equal(texteDe(un(plein, "#combat-plein-titre")), "Journal");
  memeNoeud(copier.parentNode.parentNode, un(plein, ".combat-plein-tete"), "« Copier », remonté dans la tête");
  memeNoeud(liste.parentNode, plein, "la liste, dans le plein écran");
  focusSur(un(plein, "#combat-plein-titre"));
  assert.equal(echapSur(menus.noeud), true);
  assert.equal(menus.ouvert(), null);
  assert.equal(rendu, 1);
  memeNoeud(liste.parentNode, maison, "la liste, rendue");
  focusSur(ancre);
  menus.ouvrir("fiches", { ancre, titre: "Fiches", contenu: [liste], apres: () => maison.append(liste) });
  assert.equal(texteDe(un(plein, "#combat-plein-titre")), "Fiches");
  repere(plein, "fermer").click();
  assert.equal(menus.ouvert(), null);
  memeNoeud(liste.parentNode, maison);
});

dansUnDocument("une feuille en remplace une autre — ce qui était prêté est rendu, et le focus reviendra à la première ancre", () => {
  const { menus, feuille, ancre } = couche();
  let rendu = 0;
  menus.ouvrir("combat", { ancre, apres: () => (rendu += 1) });
  boutonCommencant(feuille, INTERVENIR).click();
  assert.equal(menus.ouvert(), "intervenir");
  assert.equal(rendu, 1);
  repere(feuille, "fermer").click();
  focusSur(ancre, "le focus revient à « ⋯ », qui avait ouvert la première");
});

dansUnDocument("la phrase d'une seconde — montrée, sans rien fermer ; remplacée par la suivante ; cachée au minuteur", () => {
  const { menus, toast, ancre, minuteur } = couche();
  menus.ouvrir("combat", { ancre });
  menus.ouvrir("toast", { texte: MENU_EN_MODE_MJ });
  assert.equal(menus.ouvert(), "combat", "la phrase ne ferme pas la feuille");
  assert.deepEqual([cache(toast), texteDe(toast)], [false, MENU_EN_MODE_MJ]);
  assert.deepEqual(minuteur.delais(), [1000]);
  menus.ouvrir("toast", { texte: GESTE_EN_COURS });
  assert.deepEqual(minuteur.delais(), [1000], "la suivante remplace la première");
  assert.equal(texteDe(toast), GESTE_EN_COURS);
  minuteur.lancer();
  assert.deepEqual([cache(toast), texteDe(toast)], [true, ""]);
});

// ─── L'écran assemblé ───────────────────────────────────────────────────────

const { banque: BANQUE, secret: SECRET } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const AUBEPINE = lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage;
const INDEX = indexer(BANQUE);
const SOIR = () => new Date(2026, 9, 12, 21, 30);

let pages = 0;
async function pageNeuve() {
  pages += 1;
  return import(`../js/ecrans/combat.js?menus=${pages}`);
}

function etagereDe(personnages) {
  return {
    lister: async () => ({ personnages: structuredClone(personnages), illisibles: 0 }),
    listerNotes: async () => [],
    lire: async (id) => structuredClone(personnages.find((un) => un.id === id) ?? null),
    garder: async () => {},
  };
}

async function attendre(condition, quoi) {
  const limite = Date.now() + 5000;
  do {
    if (condition()) return;
    await laisserFiler(2);
  } while (Date.now() < limite);
  assert.ok(condition(), `toujours pas : ${quoi}`);
}

/** Ouvre l'écran comme js/application.js, dans le document simulé ; rend l'écran, ses services et ce qu'il a téléchargé. */
async function ouvrirLEcran(page, { des = [], etroit = false, minuteur = minuteurSimule(), vues, navigateur } = {}) {
  const telecharges = [];
  const services = {
    des: desImposes(des),
    maintenant: SOIR,
    magasin: magasinCombatMemoire(),
    magasinRencontre: magasinRencontreMemoire(),
    media: () => (typeof etroit === "function" ? etroit() : etroit),
    minuteur,
    telecharger: (...parametres) => telecharges.push(parametres),
    navigateur: navigateur ?? { clipboard: { writeText: async () => {} } },
  };
  if (vues) services.vues = vues;
  const contexte = { etat: { mode: "demo", banque: BANQUE, index: INDEX, secret: SECRET, etagere: etagereDe([AUBEPINE]), depot: null } };
  const ecran = page.afficher(contexte, services);
  globalThis.document.body.replaceChildren(ecran);
  await attendre(() => ecran.querySelector(".attente") === null, "l'ouverture du combat");
  await attendre(() => !texteDe(ecran).includes("Lecture des personnages en ligne"), "la lecture des personnages");
  return { ecran, services, minuteur, telecharges };
}

/** Un clic, comme dans un navigateur : le focus au bouton, la capture de l'écran, puis le bouton. */
async function cliquer(bouton) {
  assert.ok(bouton, "le bouton à cliquer existe");
  globalThis.document.activeElement = bouton;
  let ecran = bouton;
  while (ecran && !(ecran.tagName === "SECTION" && ecran.className.split(" ").includes("combat"))) ecran = ecran.parentNode;
  if (ecran) await Promise.all(ecran.declencher("click", { target: bouton }));
  await Promise.all(bouton.click());
}

function choisir(ecran, nomDuRepere, nom) {
  const liste = repere(ecran, nomDuRepere);
  const rang = tous(liste, "option").findIndex((option) => texteDe(option).startsWith(nom));
  assert.ok(rang >= 0, `« ${nom} » est dans la liste « ${nomDuRepere} »`);
  liste.value = String(rang);
  liste.declencher("change");
}

/** La mise en place du combat de référence (Aubépine en C3, le Chef en F6, les deux Marmitons en D4), puis le lancement. */
async function combatLance(page, { places = {}, ...options } = {}) {
  const ouvert = await ouvrirLEcran(page, options);
  const { ecran } = ouvert;
  choisir(ecran, "personnage", "Aubépine Crèmebrûlée");
  await cliquer(repere(ecran, "ajouter-personnage"));
  for (const [nom, nombre] of [
    ["Chef de partie", 1],
    ["Marmiton de corvée", 2],
  ]) {
    choisir(ecran, "adversaire", nom);
    const champ = repere(ecran, "nombre");
    champ.value = String(nombre);
    champ.declencher("input");
    await cliquer(repere(ecran, "ajouter-adversaires"));
  }
  for (const [id, nomDeCase] of Object.entries({ pj1: "C3", adv2: "F6", adv3: "D4", adv4: "D4", ...places })) {
    const groupe = tous(ecran, ".combat-fiche-avant").find((noeud) => noeud.getAttribute("data-fiche") === id);
    const champ = repere(groupe, "case");
    champ.value = nomDeCase;
    champ.declencher("change");
  }
  await cliquer(repere(ecran, "lancer"));
  return ouvert;
}

/** Joue un contrôle de l'écran dans un document simulé ; « modeMj » : la valeur gardée sur l'appareil (« 1 », « 0 », null : rien). */
function dansUnePage(titre, corps, { modeMj = null } = {}) {
  test(titre, async () => {
    const stockage = simulerStockage(modeMj === null ? {} : { "atelier.mode-mj": modeMj });
    const retirer = installerDom();
    const rencontre = await import("../js/ecrans/rencontre.js");
    rencontre.oublier();
    const page = await pageNeuve();
    try {
      await corps(page, stockage);
    } finally {
      page.oublier();
      retirer();
      stockage.retirer();
    }
  });
}

const barre = (ecran) => un(ecran, "header.combat-barre");
const laBulle = (ecran) => un(ecran, "div.combat-bulle");
const bulleMontree = (ecran) => !cache(laBulle(ecran));
const corps = (ecran) => (bulleMontree(ecran) ? un(laBulle(ecran), ".combat-bulle-defile") : un(ecran, ".combat-action-corps"));
const zone = (ecran) => un(ecran, ".combat-action-corps");
const annonce = (ecran) => texteDe(un(ecran, "p.combat-annonce"));
const journal = (ecran) => tous(ecran, "ol.combat-lignes li").map(texteDe);
const feuilleDe = (ecran) => un(ecran, "section.combat-feuille");
const pleinDe = (ecran) => un(ecran, "section.combat-plein");
const fiche = (ecran, id) => {
  const trouvee = tous(ecran, "details").find((noeud) => noeud.getAttribute("data-id") === id);
  assert.ok(trouvee, `la fiche de ${id}`);
  return trouvee;
};
const jeton = (ecran, entier) => boutonOu(un(ecran, ".combat-plateau"), (b) => (b.getAttribute("title") ?? "").split("\n")[0] === entier, `le jeton de ${entier}`);
const boutonDeCapacite = (ecran, libelle) => boutonOu(corps(ecran), (b) => b.className === "combat-capacite" && b.hasAttribute("data-ligne") && texteDe(b.children[0] ?? b) === libelle, `de la capacité « ${libelle} »`);
const deACliquer = (ecran) => tous(corps(ecran), "button.combat-de").find((b) => !inactif(b)) ?? null;
const surimpression = (ecran) => un(ecran, ".combat-surimpression");
/** La palette, quand elle est dans la page (la bulle ou une feuille la porte) ; sinon null. */
const paletteDe = (ecran) => ecran.querySelector("section.combat-palette");
const paletteMontree = (ecran) => paletteDe(ecran) !== null && !cache(paletteDe(ecran));
/** Le clic droit, comme un navigateur : pointerdown du bouton droit, puis contextmenu ; rend vrai si l'écran a empêché le menu du navigateur. */
function clicDroit(noeud) {
  let empeche = false;
  noeud.declencher("pointerdown", { button: 2, pointerType: "mouse" });
  noeud.declencher("contextmenu", { button: 2, preventDefault: () => (empeche = true) });
  return empeche;
}

/** Qui joue : son jeton. */
async function faireJouer(ecran, entier) {
  await cliquer(jeton(ecran, entier));
  assert.equal(bulleMontree(ecran), true, `la bulle de ${entier}`);
}

/** Aubépine ouvre sa Frappe contre un Marmiton : la cible posée, le premier dé attend. */
async function frappeDAubepine(ecran, cible = "Marmiton de corvée n° 1") {
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), cible));
}

dansUnePage("l'écran — services.vues : les vues viennent du service ; le dé tiré se montre une seconde en surimpression, remplacé par le suivant, sa classe d'état d'après son genre ; jamais de style", async (page) => {
  const appels = [];
  const DES = [
    { titre: "1er dé · d10", valeur: 6, verdict: "✓ réussite", genre: "reussite" },
    { titre: "2e dé · d10", valeur: 9, verdict: "✗ échec", genre: "echec" },
    { titre: "Localisation · d20", valeur: 16, verdict: "torse", genre: "localisation" },
  ];
  const vues = {
    ...lecture,
    vueDuDe: (avant, evenement) => {
      appels.push({ pas: avant.pas, evenement });
      return DES[appels.length - 1] ?? null;
    },
  };
  const { ecran, minuteur } = await combatLance(page, { vues, des: [6, 9, 8, 2, 16] });
  const sur = surimpression(ecran);
  memeNoeud(sur.parentNode.children.at(-1), sur, "la surimpression, dernier enfant de la grille");
  assert.equal(sur.getAttribute("aria-hidden"), "true");
  assert.equal(cache(sur), true, "rien de montré avant le premier dé");
  await frappeDAubepine(ecran);
  await cliquer(deACliquer(ecran));
  assert.equal(appels.length, 1, "vueDuDe, du service, une fois par dé");
  assert.deepEqual(appels[0].evenement.type, "de");
  assert.deepEqual(appels[0].evenement.valeurs, [6, 9], "l'événement du dé : ses faces et ses valeurs, tels que la source les a tirés");
  assert.equal(typeof appels[0].pas, "number", "l'état d'avant le dé");
  assert.deepEqual([cache(sur), sur.className], [false, "combat-surimpression reussi combat-surimpression-centre"]);
  assert.deepEqual(
    sur.children.map((noeud) => [noeud.className, texteDe(noeud)]),
    [
      ["combat-surimpression-titre", "1er dé · d10"],
      ["combat-surimpression-valeur", "6"],
      ["combat-surimpression-verdict", "✓ réussite"],
    ],
  );
  assert.deepEqual(minuteur.delais().filter((ms) => ms === 1000), [1000], "une seconde");
  // Le dé suivant remplace le premier, et son minuteur.
  await cliquer(deACliquer(ecran));
  assert.equal(sur.className, "combat-surimpression echoue combat-surimpression-centre");
  assert.equal(texteDe(sur.children[0]), "2e dé · d10");
  assert.deepEqual(minuteur.delais().filter((ms) => ms === 1000), [1000], "un seul minuteur à la fois");
  minuteur.lancer(1000);
  assert.deepEqual([cache(sur), sur.children.length, sur.className], [true, 0, "combat-surimpression"]);
  assert.equal(sur.style.ecritures.length, 0, "aucun style écrit");
  // Un dé que la vue ne montre pas (null) ne montre rien.
  appels.length = 3;
  while (deACliquer(ecran)) await cliquer(deACliquer(ecran));
  assert.equal(cache(sur), true);
});

dansUnePage("l'écran — le dé sur PC : au centre ; s'il couvre la bulle, dans la moitié de la carte qu'elle laisse libre (lu sur les boîtes) ; au téléphone, toujours au centre", async (page) => {
  const vues = { ...lecture, vueDuDe: () => ({ titre: "1er dé · d10", valeur: 6, verdict: "✓ réussite", genre: "reussite" }) };
  let etroit = false;
  const { ecran } = await combatLance(page, { vues, des: [6, 9, 8, 2, 16, 3, 3, 3], etroit: () => etroit });
  const sur = surimpression(ecran);
  const grille = sur.parentNode;
  grille.rectangle = { left: 0, top: 0, width: 600, height: 600 };
  sur.rectangle = { left: 200, top: 200, width: 200, height: 200 };
  await frappeDAubepine(ecran);
  const bulle = laBulle(ecran);
  // La bulle à droite, sur le dé : il passe à gauche.
  bulle.rectangle = { left: 350, top: 150, width: 300, height: 400 };
  await cliquer(deACliquer(ecran));
  assert.equal(sur.className, "combat-surimpression reussi combat-surimpression-gauche");
  // La bulle à gauche, sur le dé : il passe à droite.
  bulle.rectangle = { left: 0, top: 150, width: 260, height: 400 };
  await cliquer(deACliquer(ecran));
  assert.equal(sur.className, "combat-surimpression reussi combat-surimpression-droite");
  // La bulle loin du dé : au centre.
  bulle.rectangle = { left: 450, top: 0, width: 150, height: 100 };
  await cliquer(deACliquer(ecran));
  assert.equal(sur.className, "combat-surimpression reussi combat-surimpression-centre");
  assert.equal(sur.style.ecritures.length, 0, "trois classes, aucun style");
  // Au téléphone, toujours au centre, la bulle (le volet) fût-elle sur le dé.
  page.oublier();
  etroit = true;
  const { ecran: telephone } = await combatLance(await pageNeuve(), { vues, des: [6, 9], etroit: () => etroit });
  const surLeTelephone = surimpression(telephone);
  surLeTelephone.parentNode.rectangle = { left: 0, top: 0, width: 360, height: 360 };
  surLeTelephone.rectangle = { left: 100, top: 100, width: 160, height: 160 };
  await frappeDAubepine(telephone);
  laBulle(telephone).rectangle = { left: 0, top: 200, width: 360, height: 300 };
  await cliquer(deACliquer(telephone));
  assert.equal(surLeTelephone.className, "combat-surimpression reussi combat-surimpression-centre");
});

dansUnePage("au téléphone — la liste d'une case (« +k »), sous la carte, choisit la cible sans fermer le volet qui porte le geste", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true, places: { pj1: "D4" }, des: [6, 9] });
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  const plus = un(tous(ecran, ".combat-case").find((noeud) => noeud.getAttribute("data-case") === "D4"), "button.combat-plus-etroit");
  await cliquer(plus);
  const liste = un(un(ecran, "section.combat-action"), ".combat-case-liste");
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 2"));
  assert.equal(bulleMontree(ecran), true, "le volet reste ouvert : un choix dans la liste n'est pas un clic au-dehors");
  assert.match(texteDe(un(laBulle(ecran), "h2.combat-bulle-titre")), /^Frappe contre Marmiton de corvée n° 2/);
  assert.ok(deACliquer(ecran), "le dé attend, dans le volet");
});

dansUnePage("l'écran — Entrée sur le jeton de qui joue, après le premier dé : le focus revient à la bulle (mission, § 6, point 6b) ; avant, rien ne bouge", async (page) => {
  const { ecran } = await combatLance(page, { des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  const aubepine = jeton(ecran, "Aubépine Crèmebrûlée");
  const h1 = un(ecran, "h1");
  // Avant le premier dé : le jeton sans choix ne déplace pas le focus.
  h1.focus({ preventScroll: true });
  await cliquer(aubepine);
  assert.ok(globalThis.document.activeElement === aubepine || globalThis.document.activeElement === h1, "avant le premier dé, rien ne va à la bulle");
  await cliquer(deACliquer(ecran));
  h1.focus({ preventScroll: true });
  await cliquer(aubepine);
  assert.ok(laBulle(ecran).contains(globalThis.document.activeElement), "après le premier dé, le focus à la commande qui attend dans la bulle");
});

dansUnePage("la barre du téléphone (A1) — ☰ ouvre les liens de la navigation ; l'état court, en danger au tour adverse ; « Intervenir… » y remplace « Fin de tour », ouvre F1, et l'intervention se joue comme un geste ; la racine est « en jeu »", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  poserLaNavigation({ courante: "combat" });
  assert.equal(ecran.className, "combat ne-pas-imprimer combat-en-jeu");
  const site = un(barre(ecran), "button.combat-site");
  assert.deepEqual([site.getAttribute("aria-label"), site.getAttribute("aria-haspopup"), texteDe(site)], ["Navigation principale", "dialog", String.fromCodePoint(0x2630)]);
  await cliquer(site);
  assert.equal(texteDe(un(feuilleDe(ecran), "#combat-feuille-titre")), "L'Atelier des Arpenteurs");
  assert.deepEqual(tous(feuilleDe(ecran), "a").map(texteDe), liensDeNavigation().map(({ texte }) => texte));
  assert.equal(echapSur(ecran), true, "Échap, sur l'écran, ferme la feuille");
  assert.equal(cache(feuilleDe(ecran)), true);
  focusSur(site, "le focus revient à ☰");

  const court = un(barre(ecran), "p.combat-etat-court");
  assert.deepEqual([texteDe(court), court.className], ["Tour 1 · PJ", "combat-etat-court"]);
  const intervenir = un(barre(ecran), ".combat-commandes button.combat-intervenir");
  const finDeTour = boutonDit(barre(ecran), "Fin de tour");
  assert.deepEqual([cache(intervenir), cache(finDeTour)], [true, false], "au tour des PJ, « Fin de tour »");
  // Aubépine passe son tour : au tour adverse, « Intervenir… » prend la place de « Fin de tour » (qui passe au volet au repos).
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.deepEqual([texteDe(court), court.className], ["Tour 1 · adversaires", "combat-etat-court danger"]);
  assert.deepEqual([cache(intervenir), cache(finDeTour), texteDe(intervenir), inactif(intervenir)], [false, true, INTERVENIR, false]);
  await cliquer(intervenir);
  const feuille = feuilleDe(ecran);
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Intervenir");
  assert.deepEqual(tous(feuille, "h3").map(texteDe).map((t) => t.split(" · ").slice(0, 2).join(" · ")), ["A · Aubépine Crèmebrûlée"]);
  const option = boutonCommencant(feuille, "Dressage minute");
  await cliquer(option);
  assert.equal(cache(feuille), true, "la feuille se ferme");
  assert.equal(bulleMontree(ecran), true, "l'intervention se joue comme un geste, dans le volet");
  assert.match(texteDe(un(laBulle(ecran), "h2.combat-bulle-titre")), /^Dressage minute/);
  // Pendant le geste, « Intervenir… » est inactif, avec sa raison.
  assert.equal(inactif(intervenir), true);
  assert.equal(raisonDe(ecran, intervenir), "Une action est en cours.");
  // « MJ » ne paraît qu'en Mode MJ.
  assert.equal(cache(un(barre(ecran), "span.combat-mj")), true);
});

dansUnePage("la barre sur PC — au tour des PJ, « Intervenir… » dans la rangée des autres commandes (le menu ⋯ du PC), inactif avec sa raison ; au tour adverse, dans la barre, à côté de « Fin de tour »", async (page) => {
  const { ecran } = await combatLance(page);
  const autres = un(barre(ecran), "div.combat-autres");
  const dansLaBarre = un(barre(ecran), ".combat-commandes button.combat-intervenir");
  const duMenu = boutonDit(autres, INTERVENIR);
  assert.equal(cache(dansLaBarre), true);
  assert.equal(inactif(duMenu), true, "aucun adversaire de la démonstration n'a d'intervention");
  assert.equal(raisonDe(ecran, duMenu), "Personne ne peut intervenir.");
  await cliquer(duMenu);
  assert.equal(cache(feuilleDe(ecran)), true, "inactif, il n'ouvre rien");
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.deepEqual([cache(dansLaBarre), inactif(dansLaBarre), cache(boutonDit(barre(ecran), "Fin de tour"))], [false, false, false], "sur PC, les deux");
  assert.equal(tous(autres, "button").filter((b) => texteDe(b) === INTERVENIR).length, 0, "plus dans la rangée");
  await cliquer(dansLaBarre);
  assert.equal(texteDe(un(feuilleDe(ecran), "#combat-feuille-titre")), "Intervenir");
});

dansUnePage("⋯ et le Mode MJ (F13) — la feuille du combat ; l'interrupteur, la clé lue à la visite et écrite à chaque bascule ; la région d'annonce le dit ; « MJ » dans la barre ; sur PC, l'interrupteur de l'en-tête de la carte", async (page, stockage) => {
  const { ecran } = await combatLance(page, { etroit: true });
  assert.deepEqual([...new Set(stockage.lus)], ["atelier.mode-mj"], "lue à la visite");
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  await cliquer(plus);
  const feuille = feuilleDe(ecran);
  assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Le combat");
  assert.equal(texteDe(un(feuille, "p.combat-sous")), "Tour 1 · PJ");
  const interrupteur = () => un(feuille, ".combat-interrupteur");
  assert.equal(interrupteur().getAttribute("aria-checked"), "false", "éteint par défaut");
  await cliquer(interrupteur());
  assert.equal(interrupteur().getAttribute("aria-checked"), "true");
  assert.deepEqual(stockage.ecrits, [["atelier.mode-mj", "1"]]);
  assert.equal(annonce(ecran), "Mode MJ allumé.");
  assert.equal(cache(un(barre(ecran), "span.combat-mj")), false, "« MJ » dans la barre");
  await cliquer(interrupteur());
  assert.deepEqual(stockage.ecrits.at(-1), ["atelier.mode-mj", "0"]);
  assert.equal(annonce(ecran), "Mode MJ éteint.");
  assert.equal(cache(un(barre(ecran), "span.combat-mj")), true);
  // « Journal » et « Fiches » ouvrent le plein écran, à la place de la feuille. « ⋯ », au téléphone, ouvre un dialogue
  // et ne se dit jamais développé (vague 4, R2 n° 15).
  await cliquer(boutonDit(feuille, "Journal"));
  assert.equal(texteDe(un(pleinDe(ecran), "#combat-plein-titre")), "Journal");
  assert.deepEqual([cache(feuille), plus.getAttribute("aria-expanded"), plus.getAttribute("aria-haspopup")], [true, null, "dialog"]);

  // Sur PC, l'interrupteur est dans l'en-tête de la carte, avec la ligne du clic droit quand il est allumé.
  const { ecran: large } = await ouvrirLEcran(await pageNeuve(), {});
  const enTete = un(large, ".combat-plateau-mj");
  const surPc = un(enTete, "button.combat-interrupteur");
  assert.deepEqual([surPc.getAttribute("role"), surPc.getAttribute("aria-checked"), texteDe(surPc)], ["switch", "false", "Mode MJ"]);
  await cliquer(surPc);
  assert.equal(surPc.getAttribute("aria-checked"), "true");
  assert.ok(texteDe(enTete).startsWith("clic droit sur un jeton : le menu du MJ"));
  assert.equal(cache(un(enTete, "span.combat-mj")), false);
  // Une visite suivante relit l'appareil : allumé.
  const { ecran: suivante } = await ouvrirLEcran(await pageNeuve(), {});
  assert.equal(un(suivante, ".combat-plateau-mj button.combat-interrupteur").getAttribute("aria-checked"), "true");
});

dansUnePage("⋯ — un appareil qui refuse le stockage : éteint à la visite, la bascule vaut pour la visite, rien ne lève", async (page) => {
  const avant = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
  };
  try {
    const { ecran } = await ouvrirLEcran(page, {});
    const surPc = un(ecran, ".combat-plateau-mj button.combat-interrupteur");
    assert.equal(surPc.getAttribute("aria-checked"), "false");
    await cliquer(surPc);
    assert.equal(surPc.getAttribute("aria-checked"), "true", "allumé pour la visite");
    assert.equal(annonce(ecran), "Mode MJ allumé.");
  } finally {
    globalThis.localStorage = avant;
  }
});

dansUnePage(
  "le menu du MJ (PC) — le clic droit et « Modifier… » l'ouvrent ; « Modifier une valeur… » : « Enregistrer » émet ; un état ajouté puis retiré ; « Déplacer sans action… » par une case ; « Retirer du combat » ; pendant un geste, sa raison se dit",
  async (page) => {
    const { ecran, minuteur } = await combatLance(page, { des: [6, 9] });
    const marmiton = () => jeton(ecran, "Marmiton de corvée n° 2");
    // Le clic droit : le menu du MJ au lieu de celui du navigateur.
    assert.equal(clicDroit(marmiton()), true);
    const feuille = feuilleDe(ecran);
    assert.equal(cache(feuille), false);
    assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Marmiton de corvée n° 2");
    assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
    // « Modifier une valeur… » : la défense à 6, puis « Enregistrer ».
    await cliquer(repere(feuille, "mj-valeurs"));
    const defense = repere(feuille, "valeur-defense");
    defense.value = String(Number(defense.value) + 2);
    defense.declencher("input");
    assert.match(texteDe(repere(feuille, "apercu")), /^Le journal écrira : MJ : défense de Marmiton n° 2 : \d+ → \d+\.$/);
    await cliquer(repere(feuille, "enregistrer"));
    assert.equal(cache(feuille), true);
    assert.match(journal(ecran).at(-1), /^MJ : défense de Marmiton n° 2 : \d+ → \d+\.$/);

    // « Modifier… » sur sa fiche : un état du classeur, Étourdi, ajouté ; puis retiré.
    const modifier = repere(fiche(ecran, "adv4"), "modifier");
    await cliquer(modifier);
    await cliquer(repere(feuille, "mj-etats"));
    const etourdi = tous(feuille, "button").find((b) => libelleDe(b) === "Étourdi");
    assert.ok(etourdi, "Étourdi, du bloc Condition");
    await cliquer(etourdi);
    await cliquer(repere(feuille, "appliquer-etat"));
    assert.equal(journal(ecran).at(-1), "MJ : état Étourdi sur Marmiton n° 2, jusqu'au prochain tour des PJ.");
    assert.ok(texteDe(fiche(ecran, "adv4")).includes("Étourdi"), "l'étiquette sur la fiche");
    await cliquer(repere(fiche(ecran, "adv4"), "modifier"));
    await cliquer(repere(feuille, "mj-etats"));
    await cliquer(boutonDit(feuille, "Retirer l'état Étourdi"));
    assert.equal(journal(ecran).at(-1), "MJ : état Étourdi retiré de Marmiton n° 2.");

    // L'appui long sur le jeton, au minuteur : « Déplacer sans action… », puis la case D5.
    marmiton().declencher("pointerdown", { button: 0, pointerType: "touch" });
    minuteur.lancer(500);
    assert.equal(cache(feuille), false, "l'appui long ouvre le menu");
    await cliquer(repere(feuille, "mj-deplacer"));
    assert.equal(cache(feuille), true);
    assert.equal(annonce(ecran), "Touchez la case d'arrivée.");
    const versD5 = boutonOu(un(ecran, ".combat-plateau"), (b) => b.getAttribute("aria-label") === "Case D5 : y déplacer Marmiton de corvée n° 2", "la case D5");
    await cliquer(versD5);
    assert.equal(journal(ecran).at(-1), "MJ : Marmiton n° 2, D4 → D5, sans action.");

    // « Retirer du combat ».
    clicDroit(marmiton());
    await cliquer(repere(feuille, "mj-retirer"));
    assert.equal(journal(ecran).at(-1), "MJ : Marmiton n° 2 quitte le combat.");

    // Pendant un geste : le menu ne s'ouvre pas, sa raison se dit (la région d'annonce, et une seconde).
    await frappeDAubepine(ecran);
    clicDroit(jeton(ecran, "Chef de partie"));
    assert.equal(cache(feuille), true);
    assert.equal(annonce(ecran), GESTE_EN_COURS);
    assert.equal(texteDe(un(ecran, "p.combat-toast")), GESTE_EN_COURS);
  },
  { modeMj: "1" },
);

dansUnePage("le menu du MJ — hors Mode MJ : ni clic droit, ni « Modifier… » ; l'appui long dit une seconde où il s'ouvre", async (page) => {
  const { ecran, minuteur } = await combatLance(page);
  assert.equal(clicDroit(jeton(ecran, "Marmiton de corvée n° 2")), false, "le menu du navigateur reste");
  assert.equal(cache(feuilleDe(ecran)), true);
  assert.equal(tous(fiche(ecran, "adv4"), "[data-repere=modifier]").length, 0);
  jeton(ecran, "Marmiton de corvée n° 2").declencher("pointerdown", { button: 0, pointerType: "touch" });
  minuteur.lancer(500);
  assert.equal(cache(feuilleDe(ecran)), true);
  assert.equal(texteDe(un(ecran, "p.combat-toast")), MENU_EN_MODE_MJ);
  assert.equal(annonce(ecran), MENU_EN_MODE_MJ);
  minuteur.lancer(1000);
  assert.equal(cache(un(ecran, "p.combat-toast")), true, "une seconde");
});

dansUnePage(
  "« Changer l'équipement… » (D14) — Aubépine change d'arme tenue, puis la qualité d'un objet ; un Marmiton, sa cellule Équipement : chaque fois, l'événement du MJ porte la photographie et ses changements",
  async (page) => {
    const { ecran } = await combatLance(page);
    const feuille = feuilleDe(ecran);
    await cliquer(repere(fiche(ecran, "pj1"), "modifier"));
    await cliquer(repere(feuille, "mj-equipement"));
    assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Changer l'équipement — Aubépine Crèmebrûlée");
    const armes = tous(feuille, "button").filter((b) => (b.getAttribute("data-repere") ?? "").startsWith("arme-"));
    assert.equal(armes[0].getAttribute("data-repere"), "arme-aucune");
    assert.deepEqual(armes.filter((b) => b.getAttribute("aria-pressed") === "true").map(texteDe), ["Couteau d'office"], "l'arme tenue");
    await cliquer(armes[0]);
    await cliquer(repere(feuille, "enregistrer"));
    assert.equal(cache(feuille), true);
    assert.equal(journal(ecran).at(-1), "MJ : Aubépine ne tient aucune arme.");
    // La qualité d'un objet ; le changement d'avant est bien celui d'où l'on repart.
    await cliquer(repere(fiche(ecran, "pj1"), "modifier"));
    await cliquer(repere(feuille, "mj-equipement"));
    assert.deepEqual(tous(feuille, "button").filter((b) => b.getAttribute("aria-pressed") === "true").map(texteDe), ["Aucune arme"]);
    const toque = tous(feuille, ".combat-champ-mj").find((rangee) => texteDe(un(rangee, "label")) === "Toque renforcée");
    assert.ok(toque, "la Toque renforcée a sa qualité");
    const champ = un(toque, "input");
    assert.equal(champ.value, "3");
    champ.value = "2";
    champ.declencher("input");
    await cliquer(repere(feuille, "enregistrer"));
    assert.equal(journal(ecran).at(-1), "MJ : qualité de Toque renforcée d'Aubépine : 3 → 2.");
    // Une qualité qui ne s'écrit pas : refusée, la feuille reste.
    await cliquer(repere(fiche(ecran, "pj1"), "modifier"));
    await cliquer(repere(feuille, "mj-equipement"));
    const champDeux = un(tous(feuille, ".combat-champ-mj").find((rangee) => texteDe(un(rangee, "label")) === "Toque renforcée"), "input");
    champDeux.value = "deux";
    champDeux.declencher("input");
    await cliquer(repere(feuille, "enregistrer"));
    assert.equal(cache(feuille), false);
    assert.ok(texteDe(feuille).includes("La qualité est un nombre (« 2 », « 1,5 ») ou rien."));
    await cliquer(boutonDit(feuille, "Annuler"));

    // Un Marmiton : sa cellule Équipement, résolue de nouveau.
    await cliquer(repere(fiche(ecran, "adv3"), "modifier"));
    await cliquer(repere(feuille, "mj-equipement"));
    const cellule = repere(feuille, "cellule");
    assert.equal(cellule.value, "");
    cellule.value = "Couteau d'office";
    cellule.declencher("input");
    await cliquer(repere(feuille, "enregistrer"));
    assert.match(journal(ecran).at(-1), /^MJ : équipement de Marmiton n° 1 : .*Couteau d'office.*\.$/);
    // Rien qui change : « Aucune valeur ne change. ».
    await cliquer(repere(fiche(ecran, "adv3"), "modifier"));
    await cliquer(repere(feuille, "mj-equipement"));
    assert.equal(repere(feuille, "cellule").value, "Couteau d'office", "la cellule changée, relue");
    await cliquer(repere(feuille, "enregistrer"));
    assert.ok(texteDe(feuille).includes("Aucune valeur ne change."));
  },
  { modeMj: "1" },
);

dansUnePage("la palette, sur PC hors Mode MJ — « Appliquer l'effet de Frappe… » l'ouvre dans la bulle ; un effet appliqué la replie, le choix à zéro ; « Fermer » aussi ; le focus revient au bouton", async (page) => {
  const { ecran } = await combatLance(page, { des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  assert.equal(paletteMontree(ecran), false, "hors Mode MJ, la palette attend un appui");
  const ouvrir = () => boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`);
  await cliquer(ouvrir());
  assert.equal(paletteMontree(ecran), true);
  const palette = paletteDe(ecran);
  assert.ok(laBulle(ecran).contains(palette), "dans la bulle");
  assert.equal(texteDe(un(palette, "h2")), "Effet de Frappe");
  focusSur(un(palette, "h2"), "le focus au titre de la palette");
  // Un avantage, pour ce jet : choisi, puis appliqué.
  await cliquer(un(palette, "[data-cle=genre:avantages]"));
  const appliquer = un(palette, "[data-cle=appliquer]");
  assert.equal(inactif(appliquer), false);
  await cliquer(appliquer);
  assert.equal(paletteMontree(ecran), false, "appliqué, elle se replie");
  // La bulle a refait son corps en prenant la palette : le focus va au bouton de même repère (data-repere), le nouveau.
  focusSur(ouvrir(), "appliqué, le focus revient au bouton qui l'a ouverte");
  // Rouverte : rien de choisi ; « Fermer » la replie.
  await cliquer(ouvrir());
  assert.equal(un(paletteDe(ecran), "[data-cle=appliquer]").getAttribute("aria-disabled"), "true", "le choix est revenu à zéro");
  await cliquer(un(paletteDe(ecran), "[data-cle=fermer]"));
  assert.equal(paletteMontree(ecran), false);
  // Le bouton refait par la bulle, le focus va à son pareil (un repère, quand la bulle en donne un), sinon à la commande qui attend.
  focusSur(ouvrir(), "« Fermer » rend le focus au bouton");
});

dansUnePage("la palette, sur PC en Mode MJ — la bulle la porte pendant tout geste, sans appui (« Palette (Mode MJ) ») ; elle s'en va avec le geste", async (page) => {
  const { ecran } = await combatLance(page);
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  assert.equal(paletteMontree(ecran), false, "pas de geste, pas de palette");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(paletteMontree(ecran), true, "le geste ouvert, la palette est là");
  assert.ok(laBulle(ecran).contains(paletteDe(ecran)));
  assert.equal(texteDe(un(paletteDe(ecran), "h2")), "Palette (Mode MJ)");
  // « Fermer » n'ôte que le choix : la bulle la garde.
  await cliquer(un(paletteDe(ecran), "[data-cle=fermer]"));
  assert.equal(paletteMontree(ecran), true);
  await cliquer(boutonDit(corps(ecran), "Revenir"));
  assert.equal(paletteMontree(ecran), false, "le geste revenu, la palette s'en va");
}, { modeMj: "1" });

dansUnePage("la palette, au téléphone — une feuille, nommée par son titre ; Échap la replie et rend le focus ; hors d'un geste, l'étiquette d'un état l'ouvre (Mode MJ)", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true, des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  const ouvrir = boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`);
  await cliquer(ouvrir);
  const feuille = feuilleDe(ecran);
  const palette = paletteDe(ecran);
  assert.equal(cache(feuille), false);
  assert.ok(feuille.contains(palette), "la palette, dans une feuille");
  assert.equal(feuille.getAttribute("aria-labelledby"), un(palette, "h2").id);
  ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(cache(feuille), true);
  assert.ok(globalThis.document.activeElement === ouvrir || laBulle(ecran).contains(globalThis.document.activeElement), "le focus revient au volet");
}, { modeMj: "0" });

dansUnePage("la palette, sur PC en Mode MJ — un genre qui dure : sa durée par défaut entre d'elle-même dans le choix, en un seul rendu de l'écran ; « Appliquer » pose l'effet sur la cible, pour ce jet", async (page) => {
  let bandeaux = 0;
  const vues = { ...lecture, vueBandeau: (etat) => ((bandeaux += 1), lecture.vueBandeau(etat)) };
  const { ecran } = await combatLance(page, { vues, des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  const palette = paletteDe(ecran);
  await cliquer(un(palette, "[data-cle=onglet:cible]"));
  const avant = { bandeaux };
  // Le genre choisi, la palette rappelle choisirDansLaPalette pendant son rendu, pour la durée : le rendu qu'elle demande refait tout,
  // et celui qu'il double s'arrête (sans quoi la bulle repassait avec la vue d'avant).
  await cliquer(un(palette, "[data-cle=genre:attaque]"));
  assert.equal(bandeaux - avant.bandeaux, 1, "un seul rendu complet de l'écran");
  assert.equal(un(palette, "[data-cle=appliquer]").getAttribute("aria-disabled"), null, "la durée par défaut posée, « Appliquer » est actif");
  await cliquer(un(palette, "[data-cle=appliquer]"));
  // Avant le premier dé, la durée par défaut est « pour ce jet » : l'effet se lit parmi les effets en cours de la palette.
  assert.deepEqual(tous(un(paletteDe(ecran), "ul.combat-palette-effets"), "li").map(texteDe), ["Attaque de Marmiton n° 1 +1 (Frappe) · pour ce jet"]);
}, { modeMj: "1" });

dansUnePage("la palette, au téléphone en Mode MJ — « Palette » du volet l'ouvre libre (« Palette (Mode MJ) ») ; « Appliquer l'effet de Frappe… » au nom de la capacité jouée ; Échap rend le focus au bouton", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true, des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  await cliquer(boutonDit(corps(ecran), "Palette"));
  assert.equal(cache(feuilleDe(ecran)), false);
  assert.equal(texteDe(un(paletteDe(ecran), "h2")), "Palette (Mode MJ)", "ouverte par « Palette », elle est libre");
  ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(cache(feuilleDe(ecran)), true);
  focusSur(boutonDit(corps(ecran), "Palette"));
  await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
  assert.equal(texteDe(un(paletteDe(ecran), "h2")), "Effet de Frappe", "ouverte à un nom, elle ne l'est pas");
}, { modeMj: "1" });

dansUnePage("la palette, hors d'un geste — « Appliquer l'effet d'Étourdi… », sur l'étiquette d'un état : une feuille sur PC aussi ; « Fermer » la replie", async (page) => {
  const { ecran } = await combatLance(page);
  const feuille = feuilleDe(ecran);
  await cliquer(repere(fiche(ecran, "adv4"), "modifier"));
  await cliquer(repere(feuille, "mj-etats"));
  await cliquer(tous(feuille, "button").find((b) => libelleDe(b) === "Étourdi"));
  await cliquer(repere(feuille, "appliquer-etat"));
  const appliquer = boutonCommencant(fiche(ecran, "adv4"), "Appliquer l'effet d");
  await cliquer(appliquer);
  const palette = paletteDe(ecran);
  assert.equal(cache(feuille), false);
  assert.ok(feuille.contains(palette));
  assert.match(texteDe(un(palette, "h2")), /tourdi/);
  await cliquer(un(palette, "[data-cle=fermer]"));
  assert.equal(cache(feuille), true);
  focusSur(appliquer);
}, { modeMj: "1" });

dansUnePage("le plein écran au téléphone (A8) — la dernière ligne et ⋯ ouvrent le journal, « Copier » et « Télécharger » remontés, tout le journal ; ✕ le rend à la page ; « Fiche » et ⋯ ouvrent les fiches", async (page) => {
  const copies = [];
  const { ecran, telecharges } = await combatLance(page, { etroit: true, navigateur: { clipboard: { writeText: async (texte) => copies.push(texte) } } });
  // « Journal ↓ » (la dernière ligne) : au téléphone, le dialogue, jamais un défilement.
  await cliquer(un(ecran, "button.combat-bandeau-journal"));
  const plein = pleinDe(ecran);
  assert.equal(cache(plein), false);
  assert.deepEqual(globalThis.document.defilements, [], "aucun défilement de la page");
  assert.deepEqual(tous(un(plein, ".combat-plein-tete"), "button").map((b) => b.getAttribute("aria-label") ?? texteDe(b)), ["Copier", "Télécharger", FERMER]);
  assert.ok(plein.contains(un(ecran, "ol.combat-lignes")), "la liste, dans le plein écran");
  focusSur(un(plein, "#combat-plein-titre"));
  await cliquer(boutonDit(plein, "Copier"));
  await laisserFiler(0);
  await cliquer(boutonDit(plein, "Télécharger"));
  assert.equal(copies.length, 1);
  assert.ok(journal(ecran).every((ligne) => copies[0].includes(ligne)), "« Copier » rend tout le journal");
  assert.equal(telecharges.length, 1);
  await cliquer(repere(plein, "fermer"));
  assert.equal(cache(plein), true);
  const zoneDuJournal = un(ecran, "section.combat-journal");
  assert.ok(zoneDuJournal.contains(un(ecran, "ol.combat-lignes")), "la liste rendue à la page");
  assert.deepEqual(tous(un(zoneDuJournal, ".combat-journal-tete"), "button").map(texteDe), ["Copier", "Télécharger"]);
  // ⋯, « Fiches » : les fiches en plein écran ; Échap les rend au cadre, le focus à « ⋯ ».
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  await cliquer(plus);
  await cliquer(boutonDit(feuilleDe(ecran), "Fiches"));
  assert.equal(texteDe(un(plein, "#combat-plein-titre")), "Fiches");
  assert.ok(plein.contains(un(ecran, ".combat-camps")));
  ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(cache(plein), true);
  assert.equal(un(ecran, ".combat-cadre").children.at(-1).className.split(" ")[0], "combat-camps", "les fiches rendues au cadre");
  focusSur(plus);
  // « Fiche », dans le volet : les fiches, le focus à celle de qui joue.
  await faireJouer(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDit(laBulle(ecran), "Fiche"));
  assert.equal(cache(plein), false);
  focusSur(un(fiche(ecran, "pj1"), "summary"));
});

// ─── La vague 4 : le focus, l'écran et le menu du MJ ────────────────────────
//
// Les défauts de la relecture finale (R2, W1), chacun vu avant d'être
// corrigé : la feuille modale qui retient le focus, le focus rendu quand
// l'ancre n'a plus de boîte, la fiche complète et « Jouer » depuis les fiches
// en plein écran, « Terminer » au téléphone, le journal en plein écran sur sa
// dernière ligne, le clic qui suit l'appui long, la bulle qui s'élargit, le
// menu du MJ près du jeton sur PC, « ⋯ » au téléphone et l'état de la garde.

/** Tab (ou Maj+Tab) sur la couche : rend vrai si elle l'a pris. */
function tabSur(noeud, { shift = false } = {}) {
  let pris = false;
  noeud.declencher("keydown", {
    key: "Tab",
    shiftKey: shift,
    preventDefault() {
      pris = true;
    },
  });
  return pris;
}

dansUnDocument("la couche, modale (vague 4, R2 n° 5) — ouverte, le reste de la page est inerte, sauf une région d'annonce ; Tab et Maj+Tab bouclent dans la feuille ou le plein écran ; fermée, plus rien d'inerte", () => {
  const { menus, feuille, plein, ancre } = couche();
  const annonce = globalThis.document.createElement("p");
  annonce.setAttribute("aria-live", "polite");
  const alerte = globalThis.document.createElement("div");
  alerte.setAttribute("role", "alert");
  globalThis.document.body.append(annonce, alerte);
  menus.ouvrir("combat", { ancre });
  assert.equal(ancre.hasAttribute("inert"), true, "ce qui est sous le voile est inerte");
  assert.deepEqual([annonce.hasAttribute("inert"), alerte.hasAttribute("inert"), menus.noeud.hasAttribute("inert")], [false, false, false], "une région d'annonce parle toujours ; la couche reste vivante");
  const prenables = tous(feuille, "button").filter((bouton) => !cache(bouton.parentNode));
  const premier = prenables[0];
  const dernier = prenables.at(-1);
  memeNoeud(premier, repere(feuille, "fermer"), "le premier : ✕");
  memeNoeud(dernier, repere(feuille, "nouveau"), "le dernier : « Nouveau combat »");
  dernier.focus({ preventScroll: true });
  assert.equal(tabSur(menus.noeud), true, "Tab, sur le dernier, est pris");
  focusSur(premier, "Tab, sur le dernier : le premier");
  assert.equal(tabSur(menus.noeud, { shift: true }), true);
  focusSur(dernier, "Maj+Tab, sur le premier : le dernier");
  repere(feuille, "fiches").focus({ preventScroll: true });
  assert.equal(tabSur(menus.noeud), false, "au milieu, Tab suit son cours");
  un(feuille, "#combat-feuille-titre").focus({ preventScroll: true });
  assert.equal(tabSur(menus.noeud, { shift: true }), true);
  focusSur(dernier, "Maj+Tab, sur le titre : le dernier");
  premier.click();
  assert.equal(ancre.hasAttribute("inert"), false, "fermée, plus rien d'inerte");
  focusSur(ancre);
  // Le plein écran boucle de même, de ✕ à son dernier bouton.
  const fin = globalThis.document.createElement("button");
  menus.ouvrir("journal", { titre: "Journal", contenu: [fin], ancre });
  assert.equal(ancre.hasAttribute("inert"), true);
  fin.focus({ preventScroll: true });
  assert.equal(tabSur(menus.noeud), true);
  focusSur(repere(plein, "fermer"));
  menus.fermer();
  assert.equal(ancre.hasAttribute("inert"), false);
});

dansUnDocument("le focus rendu quand l'ancre n'a plus de boîte (vague 4, R2 n° 6) — il va à l'ancre du genre remplacé, gardée à l'ouverture ; l'ancre elle-même quand elle se voit ; secours() la rend à l'écran", () => {
  const { menus, ancre } = couche();
  const fiches = globalThis.document.createElement("div");
  const modifier = globalThis.document.createElement("button");
  fiches.append(modifier);
  // Les fiches prêtées au plein écran ; rendues à la page, la feuille de style les y cache (au téléphone).
  const ouvrirLesFiches = (cachees) =>
    menus.ouvrir("fiches", {
      titre: "Fiches",
      contenu: [fiches],
      ancre,
      apres: () => {
        globalThis.document.body.append(fiches);
        fiches.sansBoite = cachees;
      },
    });
  ouvrirLesFiches(true);
  menus.ouvrir("mj", { id: "adv4", ancre: modifier });
  assert.equal(menus.ouvert(), "mj");
  assert.ok(menus.secours() === ancre, "le secours : l'ancre des fiches remplacées");
  menus.fermer();
  focusSur(ancre, "« Modifier… » caché avec les fiches : le focus va à ce qui les avait ouvertes");
  // Les fiches visibles : le focus revient à « Modifier… ».
  ouvrirLesFiches(false);
  menus.ouvrir("mj", { id: "adv4", ancre: modifier });
  menus.fermer();
  focusSur(modifier, "l'ancre se voit : elle reprend le focus");
  // Un genre ouvert sans en remplacer un autre n'a pas de secours.
  menus.ouvrir("combat", { ancre });
  assert.equal(menus.secours(), null);
  menus.fermer();
});

dansUnDocument("le menu du MJ sur PC (vague 4, W1 n° 8) — placé contre ce qui l'ouvre (placer, que l'écran donne : echelle.js seul écrit le style), ses panneaux aussi ; au téléphone, ou l'ancre sans boîte, la feuille du bas ou le dialogue du milieu", () => {
  const places = [];
  const espion = espionDActions();
  const menus = creerLesMenus(espion.actions, { minuteur: minuteurSimule(), placer: (noeud, ancre) => places.push([noeud, ancre]) });
  const ancre = globalThis.document.createElement("button");
  globalThis.document.body.append(ancre, menus.noeud);
  menus.rendre({ barre: barreDuTour(), modeMj: true, etroit: false, menuMj: (id, saisies) => (id === "adv4" ? menuDuMarmiton(saisies) : null), equipement: () => null });
  const feuille = un(menus.noeud, "section.combat-feuille");
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
  assert.equal(places.length, 1, "placé une fois, à l'ouverture");
  assert.ok(places[0][0] === feuille && places[0][1] === ancre, "la feuille, contre l'ancre");
  repere(feuille, "mj-valeurs").click();
  assert.equal(menus.ouvert(), "valeurs");
  assert.equal(feuille.className, "combat-feuille combat-menu-contexte", "« Modifier une valeur… » : son panneau à côté");
  assert.ok(places.at(-1)[0] === feuille && places.at(-1)[1] === ancre, "contre la même ancre");
  menus.fermer();
  // Au téléphone : la feuille du bas, rien de placé.
  const avant = places.length;
  menus.rendre({ etroit: true });
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.deepEqual([feuille.className, places.length], ["combat-feuille", avant]);
  menus.fermer();
  // Sur PC, une ancre sans boîte : le dialogue du milieu, rien de placé.
  menus.rendre({ etroit: false });
  ancre.sansBoite = true;
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.deepEqual([feuille.className, places.length], ["combat-feuille", avant]);
  menus.fermer();
});

dansUnDocument("la couche — suspendre() efface la feuille ouverte, sans la fermer, le temps qu'une case se choisisse : ni voile, ni inerte, la phrase dite ; reprendre() la rend telle quelle ; remplacée ou fermée entre-temps, rien ne revient (vague 4, C2)", () => {
  const { menus, feuille, voile, ancre, appels } = couche();
  const palette = globalThis.document.createElement("section");
  palette.append(globalThis.document.createElement("h2"));
  const ouvrirLaPalette = () => menus.ouvrir("palette", { noeud: palette, nom: "Effet de Frappe", ancre });
  ouvrirLaPalette();
  assert.equal(ancre.hasAttribute("inert"), true, "sous le voile, la page est inerte");
  assert.equal(menus.suspendre(), true);
  assert.equal(menus.ouvert(), "palette", "rien ne s'est fermé");
  assert.deepEqual([cache(feuille), cache(voile), ancre.hasAttribute("inert")], [true, true, false], "ni feuille, ni voile, ni inerte : la carte se touche et se prend au clavier");
  assert.ok(feuille.contains(palette), "la palette reste dans sa feuille");
  assert.deepEqual(appels.at(-1), ["dire", "Touchez la case d'arrivée."]);
  assert.equal(tabSur(menus.noeud), false, "Tab ne boucle plus dans la feuille effacée");
  assert.equal(menus.suspendre(), false, "une seule fois");
  menus.reprendre();
  assert.deepEqual([menus.ouvert(), cache(feuille), cache(voile), ancre.hasAttribute("inert")], ["palette", false, false, true], "rendue telle quelle");
  // Remplacée pendant le choix : le genre neuf se montre, sous son voile ; reprendre n'y change rien.
  menus.suspendre();
  menus.ouvrir("combat", { ancre });
  menus.reprendre();
  assert.deepEqual([menus.ouvert(), cache(feuille), cache(voile), ancre.hasAttribute("inert")], ["combat", false, false, true]);
  menus.fermer();
  // Fermée pendant le choix : reprendre ne rouvre rien.
  ouvrirLaPalette();
  menus.suspendre();
  menus.fermer({ focus: false });
  menus.reprendre();
  assert.deepEqual([menus.ouvert(), cache(feuille), cache(voile), ancre.hasAttribute("inert")], [null, true, true, false]);
  // Un plein écran ne s'efface pas ; rien d'ouvert non plus.
  assert.equal(menus.suspendre(), false);
  menus.ouvrir("journal", { titre: "Journal", contenu: [], ancre });
  assert.equal(menus.suspendre(), false);
  menus.fermer();
});

dansUnDocument("le menu du MJ sur PC se replace quand la fenêtre change de taille (replacer ; vague 4, C6) — contre la même ancre, « Modifier une valeur… » compris ; au téléphone, l'ancre sans boîte, un autre genre : rien de placé", () => {
  const places = [];
  const espion = espionDActions();
  const menus = creerLesMenus(espion.actions, { minuteur: minuteurSimule(), placer: (noeud, ancre) => places.push([noeud, ancre]) });
  const ancre = globalThis.document.createElement("button");
  globalThis.document.body.append(ancre, menus.noeud);
  menus.rendre({ barre: barreDuTour(), modeMj: true, etroit: false, menuMj: (id, saisies) => (id === "adv4" ? menuDuMarmiton(saisies) : null), equipement: () => null });
  const feuille = un(menus.noeud, "section.combat-feuille");
  menus.replacer();
  assert.equal(places.length, 0, "rien d'ouvert : rien à replacer");
  menus.ouvrir("mj", { id: "adv4", ancre });
  assert.equal(places.length, 1);
  menus.replacer();
  assert.equal(places.length, 2, "replacé");
  assert.ok(places[1][0] === feuille && places[1][1] === ancre, "la feuille, contre la même ancre");
  repere(feuille, "mj-valeurs").click();
  const n = places.length;
  menus.replacer();
  assert.equal(places.length, n + 1, "« Modifier une valeur… » aussi, que rendre() ne redessine pas");
  assert.ok(places.at(-1)[1] === ancre);
  // Passé au téléphone : la feuille du bas, rien de placé ; revenu sur PC, contre l'ancre de nouveau.
  menus.rendre({ etroit: true });
  menus.replacer();
  assert.deepEqual([feuille.className, places.length], ["combat-feuille", n + 1]);
  menus.rendre({ etroit: false });
  menus.replacer();
  assert.deepEqual([feuille.className, places.length], ["combat-feuille combat-menu-contexte", n + 2]);
  // L'ancre sans boîte : le dialogue du milieu.
  ancre.sansBoite = true;
  menus.replacer();
  assert.deepEqual([feuille.className, places.length], ["combat-feuille", n + 2]);
  ancre.sansBoite = false;
  menus.fermer();
  // Un genre qui n'est pas du MJ (⋯) ne se place jamais.
  menus.ouvrir("combat", { ancre });
  menus.replacer();
  assert.deepEqual([feuille.className, places.length], ["combat-feuille", n + 2]);
  menus.fermer();
});

/** Un clic du doigt, comme un navigateur : la capture de l'écran d'abord ; arrêté là (stopPropagation), ce qu'il touche ne l'entend pas. Rend vrai s'il y est arrivé. */
async function toucher(noeud) {
  let ecran = noeud;
  while (ecran && !(ecran.tagName === "SECTION" && ecran.className.split(" ").includes("combat"))) ecran = ecran.parentNode;
  assert.ok(ecran, "dans l'écran");
  let arrete = false;
  await Promise.all(
    ecran.declencher("click", {
      target: noeud,
      stopPropagation() {
        arrete = true;
      },
    }),
  );
  if (arrete) return false;
  await Promise.all(noeud.click());
  return true;
}

/** Un appui long du doigt, au minuteur : pointerdown (la capture de l'écran, puis ce qu'il touche), une demi-seconde, puis pointerup. */
function appuiLong(ecran, noeud, minuteur) {
  ecran.declencher("pointerdown", { target: noeud, pointerType: "touch", button: 0 });
  noeud.declencher("pointerdown", { pointerType: "touch", button: 0 });
  minuteur.lancer(500);
  noeud.declencher("pointerup", { pointerType: "touch", button: 0 });
}

/** Le premier appui d'un geste neuf : la capture de l'écran le voit. */
const appuyer = (ecran, noeud) => ecran.declencher("pointerdown", { target: noeud, pointerType: "touch", button: 0 });

/** Le titre de la feuille ouverte. */
const titreDeLaFeuille = (ecran) => texteDe(un(feuilleDe(ecran), "#combat-feuille-titre"));

const vignetteDe = (ecran, entier) => boutonOu(ecran, (b) => b.className.split(" ")[0] === "combat-vignette" && (b.getAttribute("aria-label") ?? "").startsWith(entier), `la vignette de ${entier}`);

dansUnePage(
  "l'appui long (Mode MJ) qui ouvre le menu avale le clic qui le suit, où qu'il tombe (vague 4, W1 n° 5, R2 n° 11) : le voile ne le referme pas ; l'appui suivant agit, qu'un clic soit venu ou non",
  async (page) => {
    const { ecran, minuteur } = await combatLance(page, { etroit: true });
    const feuille = feuilleDe(ecran);
    const voile = un(ecran, "div.combat-voile");
    // La vignette : le menu s'ouvre, le voile paraît sous le doigt ; le clic qui suit tombe sur lui.
    appuiLong(ecran, vignetteDe(ecran, "Aubépine Crèmebrûlée"), minuteur);
    assert.equal(cache(feuille), false, "l'appui long ouvre le menu");
    assert.equal(await toucher(voile), false, "le clic qui suit l'appui long est avalé");
    assert.equal(cache(feuille), false, "le menu reste ouvert");
    // L'appui suivant touche la première entrée : elle agit.
    appuyer(ecran, repere(feuille, "mj-valeurs"));
    assert.equal(await toucher(repere(feuille, "mj-valeurs")), true);
    assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Modifier — Aubépine Crèmebrûlée");
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    // Le jeton : le menu s'ouvre ; aucun clic ne suit (le navigateur n'en envoie pas toujours) : l'appui suivant agit.
    appuiLong(ecran, jeton(ecran, "Marmiton de corvée n° 2"), minuteur);
    assert.equal(texteDe(un(feuille, "#combat-feuille-titre")), "Marmiton de corvée n° 2");
    appuyer(ecran, repere(feuille, "mj-valeurs"));
    assert.equal(await toucher(repere(feuille, "mj-valeurs")), true, "un appui neuf n'est jamais avalé");
    assert.equal(titreDeLaFeuille(ecran), "Modifier — Marmiton de corvée n° 2");
    // Au clavier aussi : une touche, et rien ne reste à avaler.
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    appuiLong(ecran, jeton(ecran, "Marmiton de corvée n° 2"), minuteur);
    ecran.declencher("keydown", { key: "ArrowDown" });
    assert.equal(await toucher(repere(feuille, "mj-valeurs")), true, "une touche du clavier finit l'attente du clic");
  },
  { modeMj: "1" },
);

dansUnePage("au téléphone, « Fiche complète » depuis les fiches en plein écran (vague 4, R2 n° 2) — elle s'ouvre dans le plein écran, jamais dans la page ; Échap la ferme, et le focus revient à « ⋯ »", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  const panneau = un(ecran, "section.combat-panneau");
  await cliquer(plus);
  await cliquer(boutonDit(feuilleDe(ecran), "Fiches"));
  const plein = pleinDe(ecran);
  await cliquer(repere(fiche(ecran, "pj1"), "fiche-complete"));
  assert.equal(panneau.children.length, 0, "rien dans la page");
  assert.equal(cache(plein), false);
  assert.equal(texteDe(un(plein, "#combat-plein-titre")), "Fiche complète : Aubépine Crèmebrûlée");
  assert.ok(plein.children.length > 1, "la fiche, sous la tête du plein écran");
  focusSur(un(plein, "#combat-plein-titre"));
  ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(cache(plein), true);
  assert.equal(panneau.children.length, 0);
  focusSur(plus, "le focus revient à « ⋯ », qui avait ouvert les fiches");
  assert.equal(un(ecran, ".combat-cadre").children.at(-1).className.split(" ")[0], "combat-camps", "les fiches rendues au cadre");
});

dansUnePage("la fiche complète ouverte dans la page sur PC se ferme quand la fenêtre passe au téléphone (vague 4, R2 n° 2) : la page n'y défile plus", async (page) => {
  let etroit = false;
  const { ecran } = await combatLance(page, { etroit: () => etroit });
  const panneau = un(ecran, "section.combat-panneau");
  await cliquer(repere(fiche(ecran, "pj1"), "fiche-complete"));
  assert.ok(panneau.children.length > 0, "sur PC, dans la page");
  etroit = true;
  await cliquer(vignetteDe(ecran, "Aubépine Crèmebrûlée"));
  assert.equal(panneau.children.length, 0, "au téléphone, plus rien dans la page");
});

dansUnePage("au téléphone, « Jouer » depuis les fiches en plein écran (vague 4, R2 n° 7) — le plein écran se ferme, le volet s'ouvre sur qui joue, et prend le focus", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  await cliquer(un(barre(ecran), "button.combat-plus-bouton"));
  await cliquer(boutonDit(feuilleDe(ecran), "Fiches"));
  await cliquer(repere(fiche(ecran, "pj1"), "jouer"));
  assert.equal(cache(pleinDe(ecran)), true, "le plein écran se ferme");
  assert.equal(un(ecran, ".combat-cadre").children.at(-1).className.split(" ")[0], "combat-camps", "les fiches rendues au cadre");
  assert.equal(vignetteDe(ecran, "Aubépine Crèmebrûlée").getAttribute("aria-pressed"), "true", "Aubépine joue");
  assert.ok(laBulle(ecran).contains(globalThis.document.activeElement), "le focus dans le volet");
});

dansUnePage(
  "au téléphone, le focus rendu par le menu du MJ et la palette ouverts depuis les fiches en plein écran (vague 4, R2 n° 6) — « Modifier… » et « Appliquer l'effet de… » cachés avec les fiches : le focus va à « ⋯ »",
  async (page) => {
    const { ecran } = await combatLance(page, { etroit: true });
    const plus = un(barre(ecran), "button.combat-plus-bouton");
    const camps = un(ecran, ".combat-camps");
    const fichesEnPlein = async () => {
      camps.sansBoite = false;
      await cliquer(plus);
      await cliquer(boutonDit(feuilleDe(ecran), "Fiches"));
    };
    // « Modifier… » : le menu du MJ prend la place des fiches, qui retournent au cadre, où la feuille de style les cache.
    await fichesEnPlein();
    await cliquer(repere(fiche(ecran, "adv4"), "modifier"));
    assert.equal(titreDeLaFeuille(ecran), "Marmiton de corvée n° 2");
    camps.sansBoite = true;
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    assert.equal(cache(feuilleDe(ecran)), true);
    focusSur(plus, "le focus va à « ⋯ », qui avait ouvert les fiches");
    // Un état sur le Marmiton, pour que sa fiche offre « Appliquer l'effet d'Étourdi… ».
    await fichesEnPlein();
    await cliquer(repere(fiche(ecran, "adv4"), "modifier"));
    await cliquer(repere(feuilleDe(ecran), "mj-etats"));
    await cliquer(tous(feuilleDe(ecran), "button").find((b) => libelleDe(b) === "Étourdi"));
    await cliquer(repere(feuilleDe(ecran), "appliquer-etat"));
    // La palette, depuis la fiche en plein écran : Échap la replie.
    await fichesEnPlein();
    await cliquer(boutonCommencant(fiche(ecran, "adv4"), "Appliquer l'effet d"));
    assert.ok(feuilleDe(ecran).contains(paletteDe(ecran)), "la palette, dans une feuille");
    camps.sansBoite = true;
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    assert.equal(cache(feuilleDe(ecran)), true);
    focusSur(plus, "la palette repliée : le focus va à « ⋯ »");
  },
  { modeMj: "1" },
);

dansUnePage(
  "au téléphone, la palette appliquée depuis une fiche en plein écran (vague 4, R2 n° 6) — la commande acceptée la replie (executer, origine « palette ») ; « Appliquer l'effet de… » caché avec les fiches : le focus va à « ⋯ », le secours gardé à l'ouverture",
  async (page) => {
    const { ecran } = await combatLance(page, { etroit: true });
    const plus = un(barre(ecran), "button.combat-plus-bouton");
    const camps = un(ecran, ".combat-camps");
    const fichesEnPlein = async () => {
      camps.sansBoite = false;
      await cliquer(plus);
      await cliquer(boutonDit(feuilleDe(ecran), "Fiches"));
    };
    // Un état sur le Marmiton, pour que sa fiche offre « Appliquer l'effet d'Étourdi… ».
    await fichesEnPlein();
    await cliquer(repere(fiche(ecran, "adv4"), "modifier"));
    await cliquer(repere(feuilleDe(ecran), "mj-etats"));
    await cliquer(tous(feuilleDe(ecran), "button").find((b) => libelleDe(b) === "Étourdi"));
    await cliquer(repere(feuilleDe(ecran), "appliquer-etat"));
    // La palette, depuis la fiche en plein écran : les fiches retournent au cadre, où la feuille de style les cache.
    await fichesEnPlein();
    const ouvreur = boutonCommencant(fiche(ecran, "adv4"), "Appliquer l'effet d");
    await cliquer(ouvreur);
    const palette = paletteDe(ecran);
    assert.ok(feuilleDe(ecran).contains(palette), "la palette, dans une feuille");
    camps.sansBoite = true;
    // Un genre, puis « Appliquer » : la commande passe par executer, qui replie la palette. L'effet appliqué refait la
    // fiche : le bouton qui l'avait ouverte quitte la page, sans pareil dans la bulle.
    const genre = tous(palette, "button").find((b) => (b.getAttribute("data-cle") ?? "").startsWith("genre:") && !inactif(b));
    assert.ok(genre, "un genre à choisir");
    await cliquer(genre);
    const appliquer = un(palette, "[data-cle=appliquer]");
    assert.equal(inactif(appliquer), false, `« Appliquer » actif après « ${texteDe(genre)} »`);
    await cliquer(appliquer);
    assert.equal(paletteMontree(ecran), false, "appliquée, elle se replie");
    assert.equal(cache(feuilleDe(ecran)), true);
    assert.equal(ouvreur.isConnected, false, "la fiche refaite");
    focusSur(plus, "la palette appliquée : le focus va à « ⋯ », qui avait ouvert les fiches");
  },
  { modeMj: "1" },
);

dansUnePage("au téléphone, « Terminer » referme le volet, même quand une action reste (vague 4, R2 n° 9 ; mission, § 3, A6) ; sur PC, la bulle reste sur qui joue", async (page) => {
  const finirLaFrappe = async (ecran) => {
    await frappeDAubepine(ecran);
    for (let pas = 0; pas < 10 && deACliquer(ecran); pas += 1) await cliquer(deACliquer(ecran));
    const dernier = tous(corps(ecran), "button").find((b) => ["Terminer", "Appliquer"].includes(texteDe(b)) || texteDe(b).startsWith("Passer : "));
    assert.ok(dernier, `le dernier bouton du geste : ${tous(corps(ecran), "button").map(texteDe).join(" | ")}`);
    await cliquer(dernier);
  };
  const { ecran } = await combatLance(page, { etroit: true, des: [1, 1, 1, 1, 1, 1] });
  await finirLaFrappe(ecran);
  const aubepine = vignetteDe(ecran, "Aubépine Crèmebrûlée");
  assert.match(aubepine.getAttribute("aria-label"), /actions restantes : 1 sur 2/, "une action reste");
  assert.equal(aubepine.getAttribute("aria-pressed"), "false", "personne n'est plus choisi");
  assert.equal(texteDe(un(laBulle(ecran), "h2.combat-bulle-titre")), "À qui le tour ?", "le volet au repos");
  // Sur PC, rien ne change : la bulle reste sur Aubépine.
  page.oublier();
  const { ecran: large } = await combatLance(await pageNeuve(), { des: [1, 1, 1, 1, 1, 1] });
  await finirLaFrappe(large);
  assert.equal(vignetteDe(large, "Aubépine Crèmebrûlée").getAttribute("aria-pressed"), "true", "Aubépine reste choisie");
  assert.equal(bulleMontree(large), true);
});

dansUnePage("au téléphone, le journal en plein écran s'ouvre sur sa dernière ligne (vague 4, W1 n° 6, R2 n° 10)", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  const lignes = un(ecran, "ol.combat-lignes");
  // Cachée dans la page, la liste n'avait pas de hauteur : sa fin ne se voyait pas.
  lignes.scrollTop = 0;
  lignes.scrollHeight = 4321;
  await cliquer(un(ecran, "button.combat-bandeau-journal"));
  assert.ok(pleinDe(ecran).contains(lignes));
  assert.equal(lignes.scrollTop, 4321, "la liste portée à sa fin");
  assert.deepEqual(globalThis.document.defilements, [], "la page ne défile pas");
});

dansUnePage("sur PC, la bulle qui s'élargit pour la palette se replace (vague 4, W1 n° 4 ; E6, comme en E1) ; repliée, elle se replace encore", async (page) => {
  const { ecran } = await combatLance(page, { des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  const bulle = laBulle(ecran);
  const places = () => bulle.style.ecritures.filter(([nom]) => nom === "--bulle-gauche").length;
  const avant = places();
  await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
  assert.ok(bulle.className.split(" ").includes("combat-bulle-large"), "la bulle s'élargit");
  assert.ok(places() > avant, "élargie, elle se replace");
  const large = places();
  await cliquer(un(paletteDe(ecran), "[data-cle=fermer]"));
  assert.ok(!bulle.className.split(" ").includes("combat-bulle-large"));
  assert.ok(places() > large, "repliée, elle se replace");
});

dansUnePage(
  "sur PC, le menu du MJ s'ouvre près du jeton, et « Modifier une valeur… » à côté (vague 4, W1 n° 8 ; mission, § 4.8, E4) : la place écrite par echelle.js",
  async (page) => {
    const { ecran } = await combatLance(page);
    const marmiton = jeton(ecran, "Marmiton de corvée n° 2");
    marmiton.rectangle = { left: 600, top: 300, width: 40, height: 40 };
    const feuille = feuilleDe(ecran);
    feuille.rectangle = { left: 0, top: 0, width: 320, height: 280 };
    const px = (nom) => Number.parseInt(feuille.style.getPropertyValue(nom), 10);
    assert.equal(clicDroit(marmiton), true);
    assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
    // À droite du jeton, contre lui (la flèche d'écart), à sa hauteur, dans la fenêtre (1 280 × 800).
    assert.equal(px("--bulle-gauche"), 648);
    assert.ok(px("--bulle-haut") <= 300 && px("--bulle-haut") + 280 >= 340, `à la hauteur du jeton : ${px("--bulle-haut")}`);
    feuille.rectangle = { left: 0, top: 0, width: 472, height: 600 };
    await cliquer(repere(feuille, "mj-valeurs"));
    assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
    assert.equal(px("--bulle-gauche"), 648, "son panneau, à côté du jeton");
    assert.ok(px("--bulle-haut") + 600 <= 800 - 16, "dans la fenêtre");
  },
  { modeMj: "1" },
);

dansUnePage("« ⋯ » (vague 4, R2 n° 15 et W1 n° 14) — au téléphone, il ouvre un dialogue (aria-haspopup), sans rien de développé ; la feuille dit en tête l'état de la garde, que la barre ne montre plus ; le reste de l'écran est inerte, sauf la région d'annonce ; sur PC, la rangée qu'il développe", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  const aria = () => ["aria-haspopup", "aria-controls", "aria-expanded"].map((nom) => plus.getAttribute(nom));
  assert.deepEqual(aria(), ["dialog", null, null]);
  await cliquer(plus);
  assert.deepEqual(aria(), ["dialog", null, null], "ouvert, rien n'est développé : un dialogue l'est");
  const feuille = feuilleDe(ecran);
  const garde = texteDe(un(barre(ecran), "p.combat-garde"));
  assert.ok(garde !== "", "la garde a sa phrase");
  assert.equal(texteDe(un(feuille, ".combat-feuille-corps").children[0]), garde, "en tête de la feuille");
  assert.equal(un(ecran, ".combat-cadre").hasAttribute("inert"), true, "sous le voile, la carte et le volet sont inertes");
  assert.equal(un(ecran, "p.combat-annonce").hasAttribute("inert"), false, "la région d'annonce parle");
  assert.equal(barre(ecran).hasAttribute("inert"), true);
  await cliquer(repere(feuille, "fermer"));
  assert.equal(un(ecran, ".combat-cadre").hasAttribute("inert"), false);
  focusSur(plus);
  // Sur PC : il développe la rangée des autres commandes.
  page.oublier();
  const { ecran: large } = await combatLance(await pageNeuve(), {});
  const surPc = un(barre(large), "button.combat-plus-bouton");
  assert.deepEqual(["aria-haspopup", "aria-controls", "aria-expanded"].map((nom) => surPc.getAttribute(nom)), [null, "combat-autres", "false"]);
});

// ─── Relecture des correctifs de la vague 4 (C2 à C6) ───────────────────────

const laCaseDe = (ecran, nom) => {
  const trouvee = tous(ecran, ".combat-case").find((noeud) => noeud.getAttribute("data-case") === nom);
  assert.ok(trouvee, `la case ${nom}`);
  return trouvee;
};
const casesOffertes = (ecran) => tous(ecran, "button.combat-case-choix");
const toastDe = (ecran) => texteDe(un(ecran, "p.combat-toast"));

/** « Déplacer, sans action » dans l'onglet Cible de la palette ouverte, puis « Case d'arrivée ». */
async function demanderLaCaseDArrivee(ecran) {
  await cliquer(un(paletteDe(ecran), "[data-cle=onglet:cible]"));
  await cliquer(un(paletteDe(ecran), "[data-cle=genre:deplacer]"));
  await cliquer(un(paletteDe(ecran), "[data-cle=champ:vers]"));
}

dansUnePage(
  "« Déplacer, sans action » de la palette en feuille (vague 4, C2) — « Case d'arrivée » efface la feuille : ni voile, ni carte inerte, la phrase dite, le focus sur une case ; la case touchée revient dans la palette, qui reparaît, le focus sur « Case d'arrivée D5 » ; Échap la rend, sans case ; au téléphone, et sur PC hors d'un geste",
  async (page) => {
    // Au téléphone : la palette d'« Appliquer l'effet de Frappe… », dans une feuille, le geste payé (un dé lancé).
    const { ecran } = await combatLance(page, { etroit: true, des: [6, 9, 8] });
    await frappeDAubepine(ecran);
    await cliquer(deACliquer(ecran));
    await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
    const feuille = feuilleDe(ecran);
    const voile = un(ecran, "div.combat-voile");
    const cadre = un(ecran, ".combat-cadre");
    const vers = () => un(paletteDe(ecran), "[data-cle=champ:vers]");
    assert.ok(feuille.contains(paletteDe(ecran)), "la palette, dans une feuille");
    await demanderLaCaseDArrivee(ecran);
    assert.deepEqual([cache(feuille), cache(voile), cadre.hasAttribute("inert")], [true, true, false], "ni feuille, ni voile, ni carte inerte : la case se touche, et se prend au clavier");
    assert.equal(toastDe(ecran), "Touchez la case d'arrivée.");
    assert.ok(casesOffertes(ecran).length > 0, "les cases s'offrent");
    focusSur(casesOffertes(ecran)[0], "le focus sur la première case offerte");
    // La case D5 touchée : la palette la reçoit, sa feuille reparaît, le focus sur le bouton qui l'avait demandée.
    await cliquer(un(laCaseDe(ecran, "D5"), "button.combat-case-choix"));
    assert.deepEqual([cache(feuille), cache(voile), cadre.hasAttribute("inert")], [false, false, true], "la feuille revient, sous son voile");
    assert.equal(casesOffertes(ecran).length, 0, "la demande est finie");
    assert.equal(texteDe(vers()), "Case d'arrivée D5");
    focusSur(vers(), "le focus sur « Case d'arrivée D5 »");
    assert.equal(inactif(un(paletteDe(ecran), "[data-cle=appliquer]")), false, "« Appliquer » est actif");
    // Échap pendant le choix : la feuille revient, la case d'avant gardée, et la carte n'offre plus rien.
    await cliquer(vers());
    assert.equal(cache(feuille), true);
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    assert.deepEqual([cache(feuille), cache(voile), cadre.hasAttribute("inert"), casesOffertes(ecran).length], [false, false, true, 0]);
    assert.equal(texteDe(vers()), "Case d'arrivée D5");
    focusSur(vers(), "Échap : le focus revient au bouton");
    // Une autre feuille ouverte pendant le choix (« ⋯ ») : la palette lui cède la place, et la demande finit avec elle.
    await cliquer(vers());
    await cliquer(un(barre(ecran), "button.combat-plus-bouton"));
    assert.deepEqual([titreDeLaFeuille(ecran), paletteMontree(ecran), casesOffertes(ecran).length], ["Le combat", false, 0], "la demande finit avec la feuille de la palette");
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });

    // Sur PC, hors d'un geste : la palette d'un état, dans une feuille ; la même chose.
    page.oublier();
    const { ecran: large } = await combatLance(await pageNeuve());
    const feuilleLarge = feuilleDe(large);
    await cliquer(repere(fiche(large, "adv4"), "modifier"));
    await cliquer(repere(feuilleLarge, "mj-etats"));
    await cliquer(tous(feuilleLarge, "button").find((b) => libelleDe(b) === "Étourdi"));
    await cliquer(repere(feuilleLarge, "appliquer-etat"));
    await cliquer(boutonCommencant(fiche(large, "adv4"), "Appliquer l'effet d"));
    assert.ok(feuilleLarge.contains(paletteDe(large)), "sur PC, hors d'un geste, une feuille");
    await demanderLaCaseDArrivee(large);
    assert.deepEqual([cache(feuilleLarge), un(large, ".combat-cadre").hasAttribute("inert")], [true, false]);
    await cliquer(un(laCaseDe(large, "E5"), "button.combat-case-choix"));
    assert.equal(cache(feuilleLarge), false);
    assert.equal(texteDe(un(paletteDe(large), "[data-cle=champ:vers]")), "Case d'arrivée E5");
    focusSur(un(paletteDe(large), "[data-cle=champ:vers]"));

    // Sur PC, pendant un geste, la palette dans la bulle : la case se demande sans rien effacer ; « Fermer » y met fin.
    page.oublier();
    const { ecran: geste } = await combatLance(await pageNeuve(), { des: [6, 9, 8] });
    await frappeDAubepine(geste);
    await cliquer(deACliquer(geste));
    await cliquer(boutonDit(corps(geste), `Appliquer l'effet de Frappe${POINTS}`));
    assert.ok(laBulle(geste).contains(paletteDe(geste)), "dans la bulle");
    await demanderLaCaseDArrivee(geste);
    assert.ok(casesOffertes(geste).length > 0);
    await cliquer(un(paletteDe(geste), "[data-cle=fermer]"));
    assert.equal(casesOffertes(geste).length, 0, "la palette fermée, la carte n'offre plus rien");
  },
  { modeMj: "1" },
);

/** Le geste en cours, mené jusqu'à ce que rien ne reste à jouer : chaque dé ; « Laisser passer » ; « Passer : … » ; la blessure nommée. */
async function menerLeGeste(ecran, { blessure = null, laisser = true } = {}) {
  for (let pas = 0; pas < 20; pas += 1) {
    const boutons = tous(corps(ecran), "button");
    const laisserPasser = laisser ? boutons.find((b) => texteDe(b) === "Laisser passer") : null;
    const passer = boutons.find((b) => texteDe(b).startsWith("Passer : "));
    const choix = blessure === null ? null : boutons.find((b) => texteDe(b) === blessure);
    if (deACliquer(ecran)) await cliquer(deACliquer(ecran));
    else if (laisserPasser) await cliquer(laisserPasser);
    else if (passer) await cliquer(passer);
    else if (choix) await cliquer(choix);
    else return;
  }
  assert.fail("le geste ne finit pas");
}

const aubepinePressee = (ecran) => vignetteDe(ecran, "Aubépine Crèmebrûlée").getAttribute("aria-pressed");
const titreDuVolet = (ecran) => texteDe(un(laBulle(ecran), "h2.combat-bulle-titre"));

dansUnePage(
  "au téléphone, le geste fini par « Laisser passer », par le d20 de contre-attaque, ou par la blessure choisie referme le volet, comme « Terminer », même quand une action reste (vague 4, C3) ; sur PC, la bulle reste sur qui joue",
  async (page) => {
    // Aubépine frappe le Chef, sur sa case : 1 réussite, d20 → 1, la face de contre-attaque ; elle la laisse passer.
    const { ecran } = await combatLance(page, { etroit: true, places: { adv2: "C3" }, des: [9, 1, 1] });
    await frappeDAubepine(ecran, "Chef de partie");
    await menerLeGeste(ecran);
    assert.match(journal(ecran).at(-1), /ne contre-attaque pas/, "laissée passer");
    assert.match(vignetteDe(ecran, "Aubépine Crèmebrûlée").getAttribute("aria-label"), /actions restantes : 1 sur 2/, "une action reste");
    assert.deepEqual([aubepinePressee(ecran), titreDuVolet(ecran)], ["false", "À qui le tour ?"], "« Laisser passer » : le volet au repos");

    // Le Chef à une case : la face de contre-attaque, sans contre-attaque possible, finit le geste au d20.
    page.oublier();
    const { ecran: auDe } = await combatLance(await pageNeuve(), { etroit: true, places: { adv2: "D4", adv3: "F6", adv4: "F6" }, des: [9, 9, 1, 1, 1] });
    await frappeDAubepine(auDe, "Chef de partie");
    await menerLeGeste(auDe, { laisser: false });
    assert.match(journal(auDe).at(-1), /contre-attaque, l'attaque est annulée/);
    assert.deepEqual([aubepinePressee(auDe), titreDuVolet(auDe)], ["false", "À qui le tour ?"], "le d20 qui finit le geste : le volet au repos");

    // Au tour adverse, le MJ donne deux actions au Chef, qui frappe Aubépine au bras gauche : la blessure finit le geste.
    page.oublier();
    const { ecran: blesse } = await combatLance(await pageNeuve(), { etroit: true, places: { adv2: "C3" }, des: [1, 16] });
    await cliquer(boutonDit(barre(blesse), "Fin de tour"));
    await cliquer(repere(fiche(blesse, "adv2"), "modifier"));
    await cliquer(repere(feuilleDe(blesse), "mj-valeurs"));
    for (const [champ, valeur] of [["actionsMax", "2"], ["actions", "2"]]) {
      const saisie = repere(feuilleDe(blesse), `valeur-${champ}`);
      saisie.value = valeur;
      saisie.declencher("input");
    }
    await cliquer(repere(feuilleDe(blesse), "enregistrer"));
    await cliquer(jeton(blesse, "Chef de partie"));
    await cliquer(boutonDeCapacite(blesse, "Frappe"));
    await cliquer(boutonDit(un(corps(blesse), ".combat-cibles"), "Aubépine Crèmebrûlée"));
    await menerLeGeste(blesse, { blessure: "Cheville tordue" });
    assert.match(journal(blesse).at(-1), /Cheville tordue/);
    const chef = vignetteDe(blesse, "Chef de partie");
    assert.match(chef.getAttribute("aria-label"), /actions restantes : 1 sur 2/, "une action reste au Chef");
    assert.equal(chef.getAttribute("aria-pressed"), "false", "la blessure choisie : le volet au repos");

    // Sur PC, rien ne change : « Laisser passer », et la bulle reste sur Aubépine.
    page.oublier();
    const { ecran: large } = await combatLance(await pageNeuve(), { places: { adv2: "C3" }, des: [9, 1, 1] });
    await frappeDAubepine(large, "Chef de partie");
    await menerLeGeste(large);
    assert.match(journal(large).at(-1), /ne contre-attaque pas/);
    assert.equal(bulleMontree(large), true, "sur PC, la bulle reste sur qui joue");
  },
  { modeMj: "1" },
);

dansUnePage(
  "l'appui long qui a ouvert le menu du MJ n'arme rien sur la vignette ni sur le jeton (vague 4, C4) : Échap, puis Entrée sur eux (un clic sans pointerdown) choisit ; seul le clic qui suit l'appui est avalé",
  async (page) => {
    const { ecran, minuteur } = await combatLance(page, { etroit: true });
    const vignette = vignetteDe(ecran, "Aubépine Crèmebrûlée");
    appuiLong(ecran, vignette, minuteur);
    assert.equal(cache(feuilleDe(ecran)), false, "l'appui long ouvre le menu");
    assert.equal(await toucher(un(ecran, "div.combat-voile")), false, "le clic qui suit l'appui est avalé");
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    focusSur(vignette, "Échap : le focus revient à la vignette");
    ecran.declencher("keydown", { key: "Enter" });
    assert.equal(await toucher(vignette), true);
    assert.equal(vignette.getAttribute("aria-pressed"), "true", "Entrée sur la vignette choisit Aubépine");

    // Sur PC, le jeton, à la souris : de même.
    page.oublier();
    const { ecran: large, minuteur: leMinuteur } = await combatLance(await pageNeuve());
    const aubepine = jeton(large, "Aubépine Crèmebrûlée");
    large.declencher("pointerdown", { target: aubepine, pointerType: "mouse", button: 0 });
    aubepine.declencher("pointerdown", { pointerType: "mouse", button: 0 });
    leMinuteur.lancer(500);
    aubepine.declencher("pointerup", { pointerType: "mouse", button: 0 });
    assert.equal(cache(feuilleDe(large)), false, "l'appui long ouvre le menu");
    assert.equal(await toucher(un(large, "div.combat-voile")), false, "le clic qui suit l'appui est avalé");
    large.declencher("keydown", { key: "Escape", preventDefault() {} });
    focusSur(aubepine, "Échap : le focus revient au jeton");
    large.declencher("keydown", { key: "Enter" });
    assert.equal(await toucher(aubepine), true);
    assert.equal(bulleMontree(large), true, "Entrée sur le jeton choisit Aubépine : sa bulle s'ouvre");
  },
  { modeMj: "1" },
);

dansUnePage(
  "sur PC, « Modifier une valeur… » après le menu d'un jeton bas se mesure libre de la hauteur du menu (vague 4, C5) : il remonte et tient sur toute sa hauteur",
  async (page) => {
    const { ecran } = await combatLance(page);
    const marmiton = jeton(ecran, "Marmiton de corvée n° 2");
    marmiton.rectangle = { left: 600, top: 600, width: 40, height: 40 };
    const feuille = feuilleDe(ecran);
    // La hauteur mesurée suit --bulle-hauteur, comme le max-height de la feuille de style.
    let naturelle = 280;
    Object.defineProperty(feuille, "rectangle", {
      configurable: true,
      get: () => {
        const borne = Number.parseInt(feuille.style.getPropertyValue("--bulle-hauteur"), 10);
        return { left: 0, top: 0, width: 472, height: Number.isFinite(borne) ? Math.min(naturelle, borne) : naturelle };
      },
    });
    const px = (nom) => Number.parseInt(feuille.style.getPropertyValue(nom), 10);
    assert.equal(clicDroit(marmiton), true);
    assert.deepEqual([px("--bulle-haut"), px("--bulle-hauteur")], [504, 280], "le menu, collé au bas de la fenêtre (1 280 × 800)");
    naturelle = 600;
    await cliquer(repere(feuille, "mj-valeurs"));
    assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
    assert.deepEqual([px("--bulle-haut"), px("--bulle-hauteur")], [184, 600], "le panneau remonte, et tient sur ses 600 px");
  },
  { modeMj: "1" },
);

/** La fenêtre qui change de taille : les écouteurs « resize » posés pendant le contrôle, relevés, puis rendus. */
function guetterLaFenetre() {
  const avant = { ajouter: globalThis.addEventListener, retirer: globalThis.removeEventListener };
  const ecoutes = [];
  globalThis.addEventListener = (type, f) => ecoutes.push([type, f]);
  globalThis.removeEventListener = (type, f) => {
    const rang = ecoutes.findIndex(([t, g]) => t === type && g === f);
    if (rang >= 0) ecoutes.splice(rang, 1);
  };
  return {
    redimensionner({ largeur, hauteur } = {}) {
      const page = globalThis.document.documentElement;
      if (largeur !== undefined) page.clientWidth = largeur;
      if (hauteur !== undefined) page.clientHeight = hauteur;
      for (const [type, f] of [...ecoutes]) if (type === "resize") f();
    },
    retirer() {
      if (avant.ajouter === undefined) delete globalThis.addEventListener;
      else globalThis.addEventListener = avant.ajouter;
      if (avant.retirer === undefined) delete globalThis.removeEventListener;
      else globalThis.removeEventListener = avant.retirer;
    },
  };
}

dansUnePage(
  "sur PC, le menu du MJ et « Modifier une valeur… » se replacent quand la fenêtre change de taille, ou de hauteur seule (vague 4, C6) : contre le jeton, que la carte a déplacé",
  async (page) => {
    const fenetre = guetterLaFenetre();
    try {
      const { ecran } = await combatLance(page);
      const marmiton = jeton(ecran, "Marmiton de corvée n° 2");
      marmiton.rectangle = { left: 600, top: 300, width: 40, height: 40 };
      const feuille = feuilleDe(ecran);
      feuille.rectangle = { left: 0, top: 0, width: 320, height: 280 };
      const gauche = () => Number.parseInt(feuille.style.getPropertyValue("--bulle-gauche"), 10);
      assert.equal(clicDroit(marmiton), true);
      assert.equal(gauche(), 648);
      // La hauteur seule change (le zoom, une barre qui paraît) : la carte a déplacé le jeton.
      marmiton.rectangle = { left: 300, top: 300, width: 40, height: 40 };
      fenetre.redimensionner({ hauteur: 700 });
      assert.equal(gauche(), 348, "le menu suit le jeton");
      // « Modifier une valeur… », puis la largeur change.
      feuille.rectangle = { left: 0, top: 0, width: 472, height: 400 };
      await cliquer(repere(feuille, "mj-valeurs"));
      assert.equal(gauche(), 348);
      marmiton.rectangle = { left: 200, top: 250, width: 40, height: 40 };
      fenetre.redimensionner({ largeur: 1000 });
      assert.equal(feuille.className, "combat-feuille combat-menu-contexte");
      assert.equal(gauche(), 248, "le panneau suit le jeton");
    } finally {
      fenetre.retirer();
    }
  },
  { modeMj: "1" },
);

// ─── Relecture finale (R1 à R5) ─────────────────────────────────────────────

/** Au téléphone, la palette d'« Appliquer l'effet de Frappe… », dans une feuille, le geste payé (un dé lancé) : rend l'écran. */
async function paletteEnFeuille(page, des = [6, 9, 8]) {
  const { ecran } = await combatLance(page, { etroit: true, des });
  await frappeDAubepine(ecran);
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
  assert.ok(feuilleDe(ecran).contains(paletteDe(ecran)), "la palette, dans une feuille");
  return ecran;
}

dansUnePage(
  "au téléphone, la palette remplacée par ⋯ pendant le choix d'une case est oubliée : elle ne remonte pas au rendu suivant (relecture finale, R1)",
  async (page) => {
    // Au téléphone : « Case d'arrivée », puis ⋯, refermé par Échap ; puis un dé du volet, qui refait l'écran.
    const ecran = await paletteEnFeuille(page, [6, 9, 8, 7]);
    await demanderLaCaseDArrivee(ecran);
    const plus = un(barre(ecran), "button.combat-plus-bouton");
    await cliquer(plus);
    assert.equal(titreDeLaFeuille(ecran), "Le combat");
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    focusSur(plus, "Échap : le focus revient à ⋯");
    await cliquer(deACliquer(ecran));
    assert.deepEqual([cache(feuilleDe(ecran)), paletteMontree(ecran), casesOffertes(ecran).length], [true, false, 0], "le dé lancé, la palette ne remonte pas");
  },
  { modeMj: "1" },
);

dansUnePage(
  "sur PC, hors d'un geste, la palette remplacée par le menu du MJ pendant le choix d'une case est oubliée : elle ne remonte pas au rendu suivant (relecture finale, R1)",
  async (page) => {
    // La palette d'Étourdi ; le menu du MJ d'un jeton pendant le choix, refermé par Échap ; puis un clic sur un jeton.
    const { ecran: large } = await combatLance(page);
    const feuilleLarge = feuilleDe(large);
    await cliquer(repere(fiche(large, "adv4"), "modifier"));
    await cliquer(repere(feuilleLarge, "mj-etats"));
    await cliquer(tous(feuilleLarge, "button").find((b) => libelleDe(b) === "Étourdi"));
    await cliquer(repere(feuilleLarge, "appliquer-etat"));
    await cliquer(boutonCommencant(fiche(large, "adv4"), "Appliquer l'effet d"));
    await demanderLaCaseDArrivee(large);
    assert.equal(cache(feuilleLarge), true);
    assert.equal(clicDroit(jeton(large, "Chef de partie")), true);
    assert.deepEqual([cache(feuilleLarge), paletteMontree(large), casesOffertes(large).length], [false, false, 0], "le menu du MJ remplace la palette");
    large.declencher("keydown", { key: "Escape", preventDefault() {} });
    await cliquer(jeton(large, "Aubépine Crèmebrûlée"));
    assert.equal(bulleMontree(large), true, "la bulle d'Aubépine s'ouvre");
    assert.deepEqual([cache(feuilleLarge), paletteMontree(large), casesOffertes(large).length], [true, false, 0], "la palette d'Étourdi ne remonte pas");
  },
  { modeMj: "1" },
);

dansUnePage(
  "la feuille de la palette effacée pour une case, l'écran passé sur PC pendant le geste : la case ne l'est plus, et la palette passe dans la bulle, son choix gardé, sans être oubliée (relecture finale, R1)",
  async (page) => {
    let etroit = true;
    const { ecran } = await combatLance(page, { etroit: () => etroit, des: [6, 9, 8, 7, 5, 4] });
    await frappeDAubepine(ecran);
    await cliquer(deACliquer(ecran));
    await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
    await demanderLaCaseDArrivee(ecran);
    assert.equal(cache(feuilleDe(ecran)), true);
    // La fenêtre s'élargit (une tablette tournée) ; le rendu suivant, un dé, puis un autre.
    etroit = false;
    await cliquer(deACliquer(ecran));
    assert.ok(laBulle(ecran).contains(paletteDe(ecran)) && paletteMontree(ecran), "la palette, dans la bulle");
    assert.equal(casesOffertes(ecran).length, 0, "la case n'est plus demandée");
    await cliquer(deACliquer(ecran));
    assert.equal(paletteMontree(ecran), true);
    assert.equal(un(paletteDe(ecran), "[data-cle=genre:deplacer]").getAttribute("aria-pressed"), "true", "son choix gardé : « Déplacer, sans action »");
  },
  { modeMj: "1" },
);

dansUnePage(
  "rouvrir la palette pendant que sa feuille est effacée pour une case (relecture finale, R2) : la demande finit, la feuille revient sous son voile, le focus sur son titre ; la case suivante se pose",
  async (page) => {
    const ecran = await paletteEnFeuille(page);
    await demanderLaCaseDArrivee(ecran);
    assert.equal(cache(feuilleDe(ecran)), true);
    // « Appliquer l'effet de Frappe… » du volet, touché de nouveau.
    await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
    assert.deepEqual([cache(feuilleDe(ecran)), cache(un(ecran, "div.combat-voile")), un(ecran, ".combat-cadre").hasAttribute("inert"), casesOffertes(ecran).length], [false, false, true, 0], "la feuille revient, et la carte n'offre plus rien");
    focusSur(un(paletteDe(ecran), "h2"), "le focus sur le titre de la palette");
    // La palette rouverte marche : la case demandée se pose.
    await demanderLaCaseDArrivee(ecran);
    await cliquer(un(laCaseDe(ecran, "D5"), "button.combat-case-choix"));
    assert.equal(texteDe(un(paletteDe(ecran), "[data-cle=champ:vers]")), "Case d'arrivée D5");
  },
  { modeMj: "1" },
);

/** Sur PC, la palette d'« Appliquer l'effet de Frappe… », dans la bulle, le geste payé (un dé lancé) : rend l'écran. */
async function paletteDansLaBulle(page) {
  const { ecran } = await combatLance(page, { des: [6, 9, 8] });
  await frappeDAubepine(ecran);
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
  assert.ok(laBulle(ecran).contains(paletteDe(ecran)), "dans la bulle");
  return ecran;
}

dansUnePage(
  "sur PC, pendant un geste, la case que la palette de la bulle demande ne l'est plus quand « Appliquer » replie la palette (relecture finale, R3)",
  async (page) => {
    const ecran = await paletteDansLaBulle(page);
    // « vers » posé (D5), puis redemandé ; « Appliquer » replie la palette.
    await demanderLaCaseDArrivee(ecran);
    await cliquer(un(laCaseDe(ecran, "D5"), "button.combat-case-choix"));
    await cliquer(un(paletteDe(ecran), "[data-cle=champ:vers]"));
    assert.ok(casesOffertes(ecran).length > 0, "la case est redemandée");
    await cliquer(un(paletteDe(ecran), "[data-cle=appliquer]"));
    assert.equal(casesOffertes(ecran).length, 0, "« Appliquer » : la carte n'offre plus rien");
  },
  { modeMj: "1" },
);

dansUnePage(
  "sur PC, pendant un geste, la case que la palette de la bulle demande ne l'est plus quand le Mode MJ s'éteint (relecture finale, R3)",
  async (page) => {
    // La palette du geste, que la bulle porte d'elle-même en Mode MJ (sans « Appliquer l'effet de… ») : sa case demandée, puis le Mode MJ éteint par l'interrupteur de la carte.
    const { ecran } = await combatLance(page, { des: [6, 9, 8] });
    await frappeDAubepine(ecran);
    await cliquer(deACliquer(ecran));
    assert.ok(laBulle(ecran).contains(paletteDe(ecran)) && paletteMontree(ecran), "la palette du geste, dans la bulle");
    await demanderLaCaseDArrivee(ecran);
    assert.ok(casesOffertes(ecran).length > 0, "la case est demandée");
    await cliquer(tous(ecran, "button.combat-interrupteur").find((b) => b.getAttribute("aria-checked") === "true"));
    assert.equal(paletteMontree(ecran), false, "le Mode MJ éteint : la palette se replie");
    assert.equal(casesOffertes(ecran).length, 0, "le Mode MJ éteint : la carte n'offre plus rien");
  },
  { modeMj: "1" },
);

dansUnePage(
  "sur PC, pendant un geste, la case que la palette de la bulle demande ne l'est plus quand une autre source est choisie (relecture finale, R3) : le choix repart de zéro",
  async (page) => {
    const { ecran } = await combatLance(page, { des: [6, 9, 8] });
    await frappeDAubepine(ecran);
    await cliquer(deACliquer(ecran));
    assert.ok(laBulle(ecran).contains(paletteDe(ecran)) && paletteMontree(ecran), "la palette du geste, dans la bulle");
    await demanderLaCaseDArrivee(ecran);
    assert.ok(casesOffertes(ecran).length > 0, "la case est demandée");
    await cliquer(un(paletteDe(ecran), "[data-cle=source:changer]"));
    const autre = tous(paletteDe(ecran), "button").find((b) => /^source:\d+$/.test(b.getAttribute("data-cle") ?? "") && b.getAttribute("aria-pressed") === "false" && !inactif(b));
    assert.ok(autre, "une autre source");
    await cliquer(autre);
    assert.equal(paletteMontree(ecran), true, "la palette reste, à l'autre source");
    assert.equal(casesOffertes(ecran).length, 0, "l'autre source : la carte n'offre plus rien");
  },
  { modeMj: "1" },
);

dansUnePage(
  "sur PC, pendant un geste, la case que la palette de la bulle demande ne l'est plus quand « Appliquer l'effet de… » la rouvre, son choix à zéro (relecture finale, R3)",
  async (page) => {
    const { ecran } = await combatLance(page, { des: [6, 9, 8] });
    await frappeDAubepine(ecran);
    await cliquer(deACliquer(ecran));
    assert.ok(laBulle(ecran).contains(paletteDe(ecran)) && paletteMontree(ecran), "la palette du geste, dans la bulle");
    await demanderLaCaseDArrivee(ecran);
    assert.ok(casesOffertes(ecran).length > 0, "la case est demandée");
    await cliquer(boutonDit(corps(ecran), `Appliquer l'effet de Frappe${POINTS}`));
    assert.equal(paletteMontree(ecran), true, "la palette, rouverte");
    assert.equal(casesOffertes(ecran).length, 0, "rouverte : la carte n'offre plus rien");
  },
  { modeMj: "1" },
);

dansUnePage(
  "au téléphone, le d20 qui finit le geste referme le volet et rend le focus au jeton de qui jouait, comme « Terminer » (relecture finale, R4)",
  async (page) => {
    // Le Chef à une case : la face de contre-attaque, sans contre-attaque possible, finit le geste au d20.
    const { ecran } = await combatLance(page, { etroit: true, places: { adv2: "D4", adv3: "F6", adv4: "F6" }, des: [9, 9, 1, 1, 1] });
    await frappeDAubepine(ecran, "Chef de partie");
    await menerLeGeste(ecran, { laisser: false });
    assert.match(journal(ecran).at(-1), /contre-attaque, l'attaque est annulée/);
    assert.deepEqual([aubepinePressee(ecran), titreDuVolet(ecran)], ["false", "À qui le tour ?"]);
    focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "le d20 : le focus sur le jeton d'Aubépine");
  },
  { modeMj: "1" },
);

dansUnePage(
  "le bouton qui a demandé la case reprend le focus quand le toucher ne le lui a pas donné, comme sous Safari (relecture finale, R5) : la palette dit sa clé à l'écran ; la case touchée, puis Échap",
  async (page) => {
    const ecran = await paletteEnFeuille(page);
    const feuille = feuilleDe(ecran);
    const vers = () => un(paletteDe(ecran), "[data-cle=champ:vers]");
    await cliquer(un(paletteDe(ecran), "[data-cle=onglet:cible]"));
    await cliquer(un(paletteDe(ecran), "[data-cle=genre:deplacer]"));
    // Sous Safari, un bouton touché ne prend pas le focus : il va au premier ancêtre qui le prend, la feuille (tabindex -1).
    feuille.focus({ preventScroll: true });
    assert.equal(await toucher(vers()), true);
    assert.equal(cache(feuille), true, "la feuille s'efface");
    assert.equal(await toucher(un(laCaseDe(ecran, "D5"), "button.combat-case-choix")), true);
    assert.equal(texteDe(vers()), "Case d'arrivée D5");
    focusSur(vers(), "la case touchée : le focus sur « Case d'arrivée D5 »");
    feuille.focus({ preventScroll: true });
    assert.equal(await toucher(vers()), true);
    ecran.declencher("keydown", { key: "Escape", preventDefault() {} });
    assert.equal(cache(feuille), false);
    focusSur(vers(), "Échap : le focus sur « Case d'arrivée D5 »");
  },
  { modeMj: "1" },
);
