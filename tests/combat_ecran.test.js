// Contrôles de l'écran assemblé du simulateur de combat (SPECIFICATION.md,
// § 17 et § 11, domaine « Combat » ; § 7.2 pour l'enregistrement) :
// js/ecrans/combat.js, dans le document simulé.
//
// Les quatre parties de l'écran ont chacune leurs contrôles, sur des vues
// écrites à la main. Ici tout est vrai : la banque de la démonstration, ses
// photographies, le moteur, la séance, le gardien et son chiffrement. Seuls
// sont simulés le document, les dés (imposés), l'heure, le presse-papiers, le
// téléchargement et la base de l'appareil. Le combat de référence fictif s'y
// joue du premier clic au dernier, et son journal se compare mot pour mot.
//
// Chaque contrôle ouvre une page neuve (le module, rechargé), pour que la
// mémoire d'un combat ne passe pas de l'un à l'autre : c'est aussi ainsi que
// se joue un rechargement. Les clés se fabriquent à l'exécution : celle de la
// démonstration, de son mot de passe public, et une seconde, tirée au hasard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { indexer } from "../js/banque/consultation.js";
import { PHRASES_DE_GARDE, chiffrerCombat, creerGardien, dechiffrerCombat, magasinCombatIndexedDB, magasinCombatMemoire } from "../js/combat/enregistrement.js";
import { creerSeance } from "../js/combat/seance.js";
import { accepter, lirePersonnage } from "../js/personnage/format.js";
import { CARACTERISTIQUES } from "../js/personnage/regles.js";
import { nouveauSecret, ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { journalAttendu, scenario } from "./outils/combat_reference.js";
import { desImposes } from "./outils/des_imposes.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { fabriqueIndexedDB } from "./outils/indexeddb_simulee.js";
import { adversaireEssai, aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai, pjEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";
import { simulerStockage } from "./outils/stockage_espion.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const SOURCE = lire("js/ecrans/combat.js");
const NOM_BASE = "atelier-des-arpenteurs-combat";

const rencontre = await import("../js/ecrans/rencontre.js");

// La démonstration, telle qu'elle est publiée : sa banque, sa clé, Aubépine.
const { banque: BANQUE, secret: SECRET } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const AUBEPINE = lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage;
// Une autre clé de table : celle d'après un changement de mot de passe.
const AUTRE = await nouveauSecret(crypto.randomUUID());

// 12/10/2026 à 21 h 30, heure de l'appareil : l'heure du combat de référence.
const SOIR = () => new Date(2026, 9, 12, 21, 30);
// Le signe qui renverse le sens de l'écriture, fabriqué par son code : aucun
// signe invisible ne s'écrit dans les sources.
const RENVERSE = String.fromCodePoint(0x202e);
const MARQUE_D_ORDRE = String.fromCodePoint(0xfeff);

const NE_SE_LIT_PLUS = "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).";
const QUESTION = "Effacer ce combat et son journal ?";
const JOURNAL_VIDE = "Le combat n'est pas lancé : le journal est vide.";

// ─── La page, la base, l'appareil ───────────────────────────────────────────

let pages = 0;
/** Le module de l'écran, rechargé : sa mémoire est vide, comme après un rechargement de la page. */
async function pageNeuve() {
  pages += 1;
  return import(`../js/ecrans/combat.js?page=${pages}`);
}

const index = new WeakMap();
function indexDe(banque) {
  if (!index.has(banque)) index.set(banque, indexer(banque));
  return index.get(banque);
}

/** Ce que l'étagère donne à lire, sans rien écrire ; elle compte ses lectures, et peut se faire attendre. */
function etagereDe(personnages, { retard = null } = {}) {
  const journal = { lectures: 0 };
  return {
    journal,
    async lister() {
      journal.lectures += 1;
      if (retard) await retard;
      return { personnages: structuredClone(personnages), illisibles: 0 };
    },
    listerNotes: async () => [],
  };
}

/** Un presse-papiers qui accepte, ou qui refuse. */
function pressePapiers({ refuse = false } = {}) {
  const copies = [];
  return {
    copies,
    navigateur: {
      clipboard: {
        async writeText(texte) {
          if (refuse) throw new Error("Le navigateur refuse.");
          copies.push(texte);
        },
      },
    },
  };
}

// Deux lieux où garder le combat : le magasin en mémoire, et le vrai magasin
// posé sur une IndexedDB simulée. « onglet » ouvre une connexion de plus sur
// la même base ; « gardee » lit l'enveloppe, sans passer par le gardien.
function lieuEnMemoire() {
  const magasin = magasinCombatMemoire();
  return { onglet: async () => magasin, gardee: () => magasin.lire("demo") };
}

function lieuSimule() {
  const fabrique = fabriqueIndexedDB();
  return {
    fabrique,
    async onglet() {
      const retirer = fabrique.installer();
      try {
        return await magasinCombatIndexedDB();
      } finally {
        retirer();
      }
    },
    gardee: async () => fabrique.contenu(NOM_BASE).combats?.demo ?? null,
  };
}

/** Pose un texte dans une base vide, chiffré comme le ferait le gardien. */
async function poserEnBase(lieu, texte, { revision = 3, secret = SECRET, retoucher = (enveloppe) => enveloppe } = {}) {
  const enveloppe = retoucher(await chiffrerCombat(texte, secret, { mode: "demo", revision }));
  const magasin = await lieu.onglet();
  assert.deepEqual(await magasin.ecrireSi(enveloppe, 0), { ecrit: true });
  return enveloppe;
}

/** Ce que la base garde, déchiffré : { texte, revision }, ou null. */
async function lireLaBase(lieu, secret = SECRET) {
  const enveloppe = await lieu.gardee();
  return enveloppe === null ? null : dechiffrerCombat(enveloppe, secret, { mode: "demo" });
}

// Le combat de référence, sur des photographies écrites à la main (leur
// source est nulle) : de quoi poser un combat en base sans passer par l'écran.
const PHOTOS_D_ESSAI = { "Aubépine Crèmebrûlée": aubepineEssai(), "Chef de partie": chefDePartieEssai(), "Marmiton de corvée": marmitonDeCorveeEssai() };
const texteDuCombat = (jusqua, revision, retoucher = (contenu) => contenu) => JSON.stringify(retoucher({ ...versContenu(scenario, PHOTOS_D_ESSAI, { jusqua }).contenu, revision }));

/** Attend qu'une condition soit vraie : une écriture qui finit, une lecture qui revient. */
async function attendre(condition, quoi) {
  for (let essai = 0; essai < 3000; essai += 1) {
    if (condition()) return;
    await laisserFiler(2);
  }
  assert.fail(`toujours pas : ${quoi}`);
}

/**
 * Ouvre l'écran dans le document simulé, comme le fait js/application.js, et
 * attend que le combat soit ouvert. « des » : les valeurs qui tomberont, dans
 * l'ordre, ou une source déjà faite. Rend l'écran et ce que le contrôle peut
 * observer : les téléchargements demandés, la source de dés, l'étagère.
 */
async function ouvrirLEcran(page, { banque = BANQUE, secret = SECRET, magasin, des = [], personnages = [AUBEPINE], etagere = etagereDe(personnages), depot = null, etroit = false, navigateur = pressePapiers().navigateur, pose = true } = {}) {
  const source = Array.isArray(des) ? desImposes(des) : des;
  const telecharges = [];
  // Les largeurs que l'écran demande : il n'a pas d'autre moyen de savoir s'il est sur un téléphone.
  const requetes = new Set();
  const contexte = { etat: { mode: "demo", banque, index: indexDe(banque), secret, etagere, depot } };
  const services = { maintenant: SOIR, media: (requete) => (requetes.add(requete), etroit), telecharger: (...parametres) => telecharges.push(parametres), navigateur };
  // « des: null » : aucun service de dés, comme dans la page.
  if (source !== null) services.des = source;
  if (magasin !== undefined) services.magasin = magasin;
  const ecran = page.afficher(contexte, services);
  if (pose) {
    document.body.replaceChildren(ecran);
    await attendre(() => ecran.querySelector(".attente") === null, "l'ouverture du combat");
    await attendre(() => !texteDe(ecran).includes("Lecture des personnages en ligne"), "la lecture des personnages");
  }
  return { ecran, contexte, services, des: source, telecharges, etagere, requetes };
}

/** Joue un contrôle dans un document simulé, la rencontre vidée, puis range tout. */
function dansUnePage(titre, corps) {
  test(titre, async () => {
    const retirer = installerDom();
    // La rencontre vit dans la mémoire de son module : interrogée pour une
    // autre banque, elle repart de zéro.
    rencontre.exemplaires({}, "");
    const page = await pageNeuve();
    try {
      await corps(page);
    } finally {
      page.oublier();
      retirer();
    }
  });
}

// ─── Lire et actionner l'écran ──────────────────────────────────────────────

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const un = (noeud, selecteur) => {
  const trouves = tous(noeud, selecteur);
  assert.equal(trouves.length, 1, `un seul « ${selecteur} », trouvé ${trouves.length}`);
  return trouves[0];
};
const inactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";
const cliquer = async (bouton) => {
  assert.ok(bouton, "le bouton à cliquer existe");
  await Promise.all(bouton.click());
};
function boutonOu(noeud, convient, quoi) {
  const trouves = tous(noeud, "button").filter(convient);
  assert.equal(trouves.length, 1, `un seul bouton ${quoi}, trouvé ${trouves.length} parmi : ${tous(noeud, "button").map(texteDe).join(" | ")}`);
  return trouves[0];
}
const boutonDit = (noeud, texte) => boutonOu(noeud, (b) => texteDe(b) === texte, `« ${texte} »`);
const boutonCommencant = (noeud, debut) => boutonOu(noeud, (b) => texteDe(b).startsWith(debut), `qui commence par « ${debut} »`);
const repere = (noeud, nom) => un(noeud, `[data-repere=${nom}]`);
/** La raison liée à un bouton inactif, telle qu'un lecteur d'écran la dit. */
const raisonDe = (ecran, bouton) => texteDe(un(ecran, `#${bouton.getAttribute("aria-describedby")}`));

const barre = (ecran) => un(ecran, "header.combat-barre");
const etatDuCombat = (ecran) => texteDe(un(ecran, "p.combat-etat"));
const garde = (ecran) => texteDe(un(ecran, "p.combat-garde"));
const avis = (ecran) => un(ecran, "div.combat-avis");
const corps = (ecran) => un(ecran, ".combat-action-corps");
const titreDuPanneau = (ecran) => texteDe(un(corps(ecran), "h2.combat-qui"));
const annonce = (ecran) => texteDe(un(ecran, "p.combat-annonce"));
const journal = (ecran) => tous(un(ecran, "ol.combat-lignes"), "li").map(texteDe);
const fiche = (ecran, id) => {
  const trouvee = tous(ecran, "details").find((noeud) => noeud.getAttribute("data-id") === id);
  assert.ok(trouvee, `la fiche de ${id}`);
  return trouvee;
};
const fiches = (ecran) => tous(ecran, "details").map((noeud) => [noeud.getAttribute("data-id"), texteDe(un(noeud, ".combat-nom"))]);
const laCase = (ecran, nom) => {
  const trouvee = tous(ecran, ".combat-case").find((noeud) => noeud.getAttribute("data-case") === nom);
  assert.ok(trouvee, `la case ${nom}`);
  return trouvee;
};
/** Les jetons que la carte montre, par case : { D4: ["Marmiton 1", "Marmiton 2"] }. */
const jetons = (ecran) => Object.fromEntries(tous(ecran, ".combat-case").filter((noeud) => tous(noeud, ".combat-jeton").length > 0).map((noeud) => [noeud.getAttribute("data-case"), tous(noeud, ".combat-jeton").map((j) => texteDe(un(j, ".combat-nom-court")))]));
const jeton = (ecran, entier) => boutonOu(un(ecran, ".combat-plateau"), (b) => b.getAttribute("title") === entier, `le jeton de ${entier}`);
/** Les régions qu'un lecteur d'écran dit d'elles-mêmes, et leur texte. */
const regions = (ecran) => [...ecran.descendants()].filter((noeud) => noeud.hasAttribute("aria-live") || ["status", "alert", "log"].includes(noeud.getAttribute("role"))).map((noeud) => [noeud, texteDe(noeud)]);

function saisir(champ, valeur, evenement) {
  champ.value = String(valeur);
  champ.declencher(evenement);
}

/** Choisit une option d'une liste de la préparation, par son nom. */
function choisir(ecran, nomDuRepere, nom) {
  const liste = repere(ecran, nomDuRepere);
  const rang = tous(liste, "option").findIndex((option) => texteDe(option).startsWith(nom));
  assert.ok(rang >= 0, `« ${nom} » est dans la liste « ${nomDuRepere} »`);
  saisir(liste, rang, "change");
}

async function ajouterLePersonnage(ecran, nom) {
  choisir(ecran, "personnage", nom);
  await cliquer(repere(ecran, "ajouter-personnage"));
}

async function ajouterDesAdversaires(ecran, nom, nombre = 1) {
  choisir(ecran, "adversaire", nom);
  saisir(repere(ecran, "nombre"), nombre, "input");
  await cliquer(repere(ecran, "ajouter-adversaires"));
}

/** Déplace un protagoniste par le champ « Case » de sa fiche. */
function poserSur(ecran, id, nomDeCase) {
  saisir(repere(fiche(ecran, id), "case"), nomDeCase, "change");
}

/** La mise en place du combat de référence, par les boutons de la préparation. */
async function preparerLaReference(ecran) {
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(ecran, "Chef de partie", 1);
  await ajouterDesAdversaires(ecran, "Marmiton de corvée", 2);
  for (const [id, nomDeCase] of [
    ["pj1", "C3"],
    ["adv2", "F6"],
    ["adv3", "D4"],
    ["adv4", "D4"],
  ]) {
    poserSur(ecran, id, nomDeCase);
  }
}

const lancerLeCombat = (ecran) => cliquer(repere(ecran, "lancer"));

// ─── Jouer un geste du scénario de référence, par les boutons de l'écran ────

const ENTIERS = { "Aubépine": "Aubépine Crèmebrûlée", "Chef": "Chef de partie", "Marmiton n° 1": "Marmiton de corvée n° 1", "Marmiton n° 2": "Marmiton de corvée n° 2" };
const NOM_DE_CARACTERISTIQUE = Object.fromEntries(CARACTERISTIQUES.map(({ code, nom }) => [code, nom]));
const RANG_DU_DE = { "1er": 1, "2e": 2, "3e": 3 };

/** Le bouton d'une capacité, par son libellé exact (« Frappe », « Pas chassé [1] »). */
const boutonDeCapacite = (ecran, libelle) => boutonOu(corps(ecran), (b) => b.className === "combat-capacite" && b.parentNode.className === "combat-groupe" && texteDe(b.children[0] ?? b) === libelle, `de la capacité « ${libelle} »`);

/** Le dé qui attend son clic, ou null. */
const deACliquer = (ecran) => tous(corps(ecran), "button.combat-de").find((b) => !inactif(b)) ?? null;

/** La saisie dont le bouton porte ce texte : ses champs (le nombre, puis la raison s'il y en a une), et son bouton. */
function saisieDuPanneau(ecran, action) {
  const bouton = boutonOu(corps(ecran), (b) => b.className === "bouton secondaire" && texteDe(b) === action, `de la saisie « ${action} »`);
  return { bouton, champs: tous(bouton.parentNode, "input") };
}
const saisie = saisieDuPanneau;

async function choisirQuiJoue(ecran, entier) {
  if (titreDuPanneau(ecran) === "Qui joue ?") await cliquer(boutonDit(corps(ecran), entier));
  else if (!titreDuPanneau(ecran).startsWith(`${entier} joue `)) {
    // Un autre a encore la main : on en change par « Jouer », sur la fiche.
    const laFiche = tous(ecran, "details").find((noeud) => texteDe(un(noeud, ".combat-nom")) === entier);
    assert.ok(laFiche, `la fiche de ${entier}`);
    await cliquer(repere(laFiche, "jouer"));
  }
  assert.ok(titreDuPanneau(ecran).startsWith(`${entier} joue `), `c'est à ${entier} : ${titreDuPanneau(ecran)}`);
}

/**
 * Joue un geste écrit comme dans le scénario de référence, d'un clic après
 * l'autre. « apresChaqueDe » est appelé après chaque dé cliqué, avec ce que
 * disaient les régions de l'écran juste avant.
 */
async function jouerLeGeste(ecran, geste, { apresChaqueDe = () => {} } = {}) {
  if (geste.finDeTour) return cliquer(boutonDit(barre(ecran), "Fin de tour"));
  await choisirQuiJoue(ecran, ENTIERS[geste.qui]);
  if (geste.passe) return cliquer(boutonDit(corps(ecran), "Passer son tour"));
  await cliquer(boutonDeCapacite(ecran, geste.puissance ? `${geste.joue} [${geste.puissance}]` : geste.joue));
  if (geste.pret) await cliquer(boutonCommencant(un(corps(ecran), ".combat-jet-prete"), "Jet d'attaque"));
  if (geste.contre) await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), ENTIERS[geste.contre]));
  if (geste.vers) {
    await cliquer(boutonDit(un(corps(ecran), ".combat-arrivees"), geste.vers));
    return cliquer(boutonDit(corps(ecran), "Confirmer"));
  }
  for (const code of geste.caracteristiques ?? []) await cliquer(boutonCommencant(un(corps(ecran), ".combat-caracteristiques"), `${NOM_DE_CARACTERISTIQUE[code]} `));
  if (geste.difficulte) await cliquer(boutonCommencant(un(corps(ecran), ".combat-difficultes"), `${geste.difficulte} (`));

  let degatsFixes = false;
  for (let pas = 0; pas < 60; pas += 1) {
    const jet = corps(ecran).querySelector(".combat-jet");
    if (jet === null) break;
    const choix = tous(jet, ".combat-choix button");
    const exploser = choix.find((b) => texteDe(b) === "Faire exploser");
    const relancer = choix.find((b) => texteDe(b).startsWith("Relancer le "));
    if (exploser) {
      await cliquer(exploser);
    } else if (relancer) {
      const place = RANG_DU_DE[texteDe(relancer).slice("Relancer le ".length).split(" ")[0]];
      await cliquer((geste.garde ?? []).includes(place) ? boutonDit(jet, "Garder ce dé") : relancer);
    } else if (geste.degats && !degatsFixes && jet.querySelector(".combat-degats-bases")) {
      const { bouton, champs } = saisie(ecran, "Fixer les dégâts");
      champs[0].value = String(geste.degats.ajuste);
      champs[1].value = geste.degats.raison;
      await cliquer(bouton);
      degatsFixes = true;
    } else if (deACliquer(ecran)) {
      const avant = regions(ecran);
      await cliquer(deACliquer(ecran));
      apresChaqueDe(avant);
    } else {
      break;
    }
  }
  if (geste.esquive) {
    const { bouton, champs } = saisie(ecran, "Pas de côté");
    champs[0].value = String(geste.esquive);
    await cliquer(bouton);
  }
  const appliquer = tous(corps(ecran), "button").find((b) => texteDe(b) === "Appliquer");
  if (appliquer) await cliquer(appliquer);
  return undefined;
}

/** Les dés d'un geste, dans l'ordre où l'écran les demande : la chaîne, puis les d20. */
const desDe = (gestes) => gestes.flatMap((geste) => [...(geste.des ?? []), ...(geste.localisation ?? [])]);

// ─── Le texte du module ─────────────────────────────────────────────────────

test("le module — un en-tête qui dit le pourquoi et le § 17 ; rien de ce que le site interdit", () => {
  const enTete = SOURCE.slice(0, SOURCE.indexOf("import "));
  assert.match(enTete, /^\/\/ L'écran du simulateur de combat/);
  assert.match(enTete, /SPECIFICATION\.md, § 17/);
  assert.match(enTete, /Pourquoi il existe/);

  // Ce que la veille de la page, la politique de sécurité et les règles du
  // site refusent, commentaires compris.
  const INTERDITS = {
    "la marque de chargement que surveille la veille": /data-chargement|Chargement de/,
    "la confirmation du navigateur": /\bconfirm\(|\balert\(|\bprompt\(/,
    "une insertion de HTML": /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
    "une écriture de style": /\.style\s*(?:\?\.|\.|\[|=(?!=))|\bsetProperty\s*\(|\bcssText\b|setAttribute\(\s*["'`]style/,
    "un stockage en clair": /localStorage|sessionStorage|\bcookie\b/i,
    "un écouteur global": /(?:globalThis|window|document|document\.body)\.addEventListener/,
    "un hasard qui n'est pas celui de la source de dés": /Math\.random|getRandomValues/,
    "un bouton sorti de l'ordre du clavier": /\.disabled\s*=|disabled:\s*true/,
    "une copie de la clé de table": /\.cle\b/,
    "le rapprochement de l'écran Personnages, qui range l'appareil": /rapprocher/,
  };
  for (const [quoi, motif] of Object.entries(INTERDITS)) assert.doesNotMatch(SOURCE, motif, quoi);
  // Chaque motif voit la faute qu'il doit voir.
  const FAUTES = {
    "la marque de chargement que surveille la veille": 'el("p", { "data-chargement": true })',
    "la confirmation du navigateur": 'if (confirm("Effacer ?")) effacer();',
    "une insertion de HTML": "noeud.innerHTML = texte;",
    "une écriture de style": 'noeud.style.width = "3px";',
    "un stockage en clair": 'localStorage.setItem("combat", texte);',
    "un écouteur global": 'window.addEventListener("resize", rendre);',
    "un hasard qui n'est pas celui de la source de dés": "const de = 1 + Math.floor(Math.random() * 6);",
    "un bouton sorti de l'ordre du clavier": "bouton.disabled = true;",
    "une copie de la clé de table": "const cle = contexte.etat.secret.cle;",
    "le rapprochement de l'écran Personnages, qui range l'appareil": "const lus = await depot.rapprocher();",
  };
  for (const [quoi, motif] of Object.entries(INTERDITS)) assert.match(FAUTES[quoi], motif, `le motif voit ${quoi}`);

  // Les défauts des services sont ceux de la page : les dés du navigateur, le téléchargement du site.
  assert.match(SOURCE, /des: services\.des \?\? sourceAleatoire\(\)/);
  assert.match(SOURCE, /telecharger: services\.telecharger \?\? telecharger,/);
  assert.match(SOURCE, /import \{[^}]*\btelecharger\b[^}]*\} from "\.\/dom\.js";/);
  assert.match(SOURCE, /services\.magasin \?\? \(magasinDeLaPage \?\?= ouvrirMagasinCombat\(\)\)/);
  // Au groupe 1 : ni « Intervenir… », ni palette, ni menu du clic droit.
  assert.doesNotMatch(SOURCE, /Intervenir|contextmenu|palette/i);

  // Ni signe invisible, ni espace insécable ; des fins de ligne d'un seul genre.
  for (const code of [0xa0, 0x202f, 0xad, 0xfeff, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060]) {
    assert.equal(SOURCE.includes(String.fromCodePoint(code)), false, `le signe U+${code.toString(16)}`);
  }
  const fins = SOURCE.match(/\r?\n/g);
  assert.ok(new Set(fins).size === 1, "des fins de ligne d'un seul genre");
});

// ─── L'ouverture ────────────────────────────────────────────────────────────

dansUnePage("ouverture — afficher() rend son nœud tout de suite : le titre et une attente, puis l'écran ; le titre reste le même nœud", async (page) => {
  const lieu = lieuEnMemoire();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), pose: false });
  // Tout de suite : le titre, et une attente qu'un lecteur d'écran entend.
  assert.equal(ecran.className, "combat ne-pas-imprimer");
  const h1 = un(ecran, "h1");
  assert.equal(texteDe(h1), "Simulateur de combat");
  assert.equal(h1.getAttribute("tabindex"), "-1");
  assert.equal(document.title, "Simulateur de combat — L'Atelier des Arpenteurs");
  const attente = un(ecran, ".attente");
  assert.equal(attente.getAttribute("role"), "status");
  assert.equal(texteDe(attente), "Ouverture du combat…");
  assert.equal(tous(ecran, "[data-chargement]").length, 0, "la veille de la page ne surveille pas cette attente");
  assert.equal(tous(ecran, ".combat-plateau").length, 0, "rien du combat n'est encore là");

  // La page pose l'écran et donne le focus au titre, comme à chaque arrivée.
  document.body.replaceChildren(ecran);
  h1.focus();
  await attendre(() => ecran.querySelector(".attente") === null, "l'ouverture du combat");
  assert.equal(un(ecran, "h1"), h1, "le titre est le même nœud");
  assert.equal(document.activeElement, h1, "le focus n'a pas bougé");
  assert.equal(tous(ecran, "[role=status]").length, 0, "l'attente a quitté la page : elle ne côtoie pas la région d'annonce");
  assert.equal(tous(ecran, "[data-chargement]").length, 0);
  assert.equal(etatDuCombat(ecran), "Préparation");
  // L'ordre du document est celui du téléphone : la carte, la préparation, les camps, puis le journal.
  assert.deepEqual(ecran.children.map((noeud) => noeud.className), ["combat-barre", "combat-aide", "combat-avis", "combat-panneau", "combat-cadre", "combat-journal"]);
  assert.deepEqual(un(ecran, ".combat-cadre").children.map((noeud) => noeud.className), ["combat-plateau", "combat-preparation", "combat-camps"]);
  assert.equal(tous(ecran, ".combat-case").length, 100);
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Un protagoniste ajouté se pose d'office/);
});

dansUnePage("ouverture — un nœud qui a quitté la page n'est pas rempli ; la visite suivante trouve le combat en mémoire, sans attente ni relecture", async (page) => {
  const magasin = magasinCombatMemoire();
  let lectures = 0;
  const compte = { ...magasin, lire: (mode) => ((lectures += 1), magasin.lire(mode)) };
  // Une visite que la page a déjà quittée quand l'ouverture finit.
  const { ecran: quittee } = await ouvrirLEcran(page, { magasin: compte, pose: false });
  document.body.replaceChildren(quittee);
  document.body.replaceChildren();
  await attendre(() => lectures === 1, "la lecture de la base");
  await laisserFiler(20);
  assert.equal(tous(quittee, ".combat-plateau").length, 0, "un nœud hors de la page n'est pas rempli");
  assert.equal(tous(quittee, ".attente").length, 1);

  // La visite suivante : le combat est en mémoire, l'écran se monte aussitôt.
  const { ecran } = await ouvrirLEcran(page, { magasin: compte, pose: false });
  assert.equal(tous(ecran, ".attente").length, 0, "pas d'attente");
  assert.equal(tous(ecran, ".combat-plateau").length, 1);
  document.body.replaceChildren(ecran);
  await attendre(() => !texteDe(ecran).includes("Lecture des personnages"), "la lecture des personnages");
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);

  // Chaque visite reconstruit la page ; le combat, lui, reste.
  const { ecran: revenue } = await ouvrirLEcran(page, { magasin: compte });
  assert.notEqual(revenue, ecran);
  assert.deepEqual(fiches(revenue), [["pj1", "Aubépine Crèmebrûlée"]]);
  assert.equal(lectures, 1, "la base n'est lue qu'à l'ouverture");
  // L'écran d'avant ne répond plus : seule la dernière visite joue.
  await cliquer(repere(fiche(ecran, "pj1"), "retirer"));
  assert.deepEqual(fiches(revenue), [["pj1", "Aubépine Crèmebrûlée"]]);
});

dansUnePage("ouverture — deux visites pendant l'ouverture : une seule lecture ; un oubli pendant la lecture ne remet rien en mémoire", async (page) => {
  const magasin = magasinCombatMemoire();
  await poserEnBase({ onglet: async () => magasin }, texteDuCombat(2, 3));
  let lectures = 0;
  let lacher;
  const retenue = new Promise((resoudre) => {
    lacher = resoudre;
  });
  const lent = { ...magasin, lire: async (mode) => ((lectures += 1), await retenue, magasin.lire(mode)) };

  const { ecran: premiere } = await ouvrirLEcran(page, { magasin: lent, pose: false });
  const { ecran: seconde } = await ouvrirLEcran(page, { magasin: lent, pose: false });
  document.body.replaceChildren(seconde);
  await attendre(() => lectures === 1, "la lecture de la base");
  await laisserFiler(10);
  assert.equal(lectures, 1, "une seule ouverture pour deux visites");
  // « Oublier le mot de passe » pendant la lecture : ce qui revient est jeté.
  page.oublier();
  lacher();
  await laisserFiler(30);
  for (const ecran of [premiere, seconde]) {
    assert.equal(tous(ecran, ".combat-plateau").length, 0, "rien ne s'affiche après l'oubli");
    assert.equal(tous(ecran, "details").length, 0);
  }
  // Rien n'est resté en mémoire : la visite suivante attend, et relit la base.
  const { ecran } = await ouvrirLEcran(page, { magasin: lent, pose: false });
  assert.equal(tous(ecran, ".attente").length, 1);
  document.body.replaceChildren(ecran);
  await attendre(() => ecran.querySelector(".attente") === null, "la seconde ouverture");
  assert.equal(lectures, 2);
  // Le combat gardé se reprend : le combat de référence, après deux gestes.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 6));
});

dansUnePage("ouverture — une ouverture qui échoue le dit, au lieu d'attendre sans fin ; la visite suivante repart de zéro", async (page) => {
  // Un magasin qui ne se donne pas : la promesse que l'écran attend est rejetée.
  const refuse = { then: (_tenir, rejeter) => rejeter(new Error("la base de l'appareil est fermée")) };
  const { ecran } = await ouvrirLEcran(page, { magasin: refuse, pose: false });
  document.body.replaceChildren(ecran);
  await attendre(() => ecran.querySelector(".attente") === null, "la fin de l'attente");
  const message = un(ecran, "p.message");
  assert.equal(message.getAttribute("role"), "alert");
  assert.equal(texteDe(message), "Le combat n'a pas pu s'ouvrir : la base de l'appareil est fermée");
  assert.equal(tous(ecran, ".combat-plateau").length, 0);
  assert.equal(texteDe(un(ecran, "h1")), "Simulateur de combat", "le titre reste");
  // Rien n'est resté de cette ouverture : la suivante, sur un magasin qui répond, aboutit.
  const { ecran: suivante } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  assert.equal(tous(suivante, "p.message").length, 0);
  assert.equal(etatDuCombat(suivante), "Préparation");
});

// ─── La préparation ─────────────────────────────────────────────────────────

dansUnePage("préparation — l'attente des personnages, puis la liste ; un seul appel par ouverture ; des personnages en ligne qui ne se lisent pas", async (page) => {
  let lacher;
  const retard = new Promise((resoudre) => {
    lacher = resoudre;
  });
  const etagere = etagereDe([AUBEPINE], { retard });
  const depot = { lireEnLigne: async () => ({ personnages: [], erreur: "Les personnages en ligne ne répondent pas." }) };
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etagere, depot, pose: false });
  document.body.replaceChildren(ecran);
  await attendre(() => ecran.querySelector(".attente") === null, "l'ouverture du combat");
  // La liste se fait attendre : l'écran le dit, et le reste de la préparation est déjà là.
  const preparation = un(ecran, ".combat-preparation");
  assert.match(texteDe(preparation), /Lecture des personnages en ligne…/);
  assert.equal(tous(preparation, "[data-repere=personnage]").length, 0);
  assert.equal(tous(preparation, "[data-repere=adversaire]").length, 1);
  lacher();
  await attendre(() => !texteDe(preparation).includes("Lecture des personnages"), "la lecture des personnages");
  // Ceux de l'appareil se montrent, avec la phrase de ce qui ne s'est pas lu.
  assert.deepEqual(tous(repere(ecran, "personnage"), "option").map(texteDe), ["Aubépine Crèmebrûlée"]);
  assert.match(texteDe(preparation), /Les personnages en ligne ne répondent pas\./);
  assert.equal(etagere.journal.lectures, 1);

  // Plusieurs rendus plus tard, toujours une seule lecture.
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  assert.equal(etagere.journal.lectures, 1, "un seul appel par ouverture de la préparation");
  // Une nouvelle ouverture de la préparation relit : par une visite, par « Nouveau combat ».
  const { ecran: revenue } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etagere, depot });
  assert.equal(etagere.journal.lectures, 2);
  await cliquer(boutonDit(barre(revenue), "Nouveau combat"));
  await cliquer(boutonDit(barre(revenue), "Effacer"));
  assert.equal(etagere.journal.lectures, 3);
});

dansUnePage("préparation — ajouter, poser, retirer, qui commence, lancer : chaque bouton, et sa raison quand il est inactif", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  const lancer = () => repere(ecran, "lancer");
  // Rien dans le combat : « Lancer » dit ce qu'il attend, et ne fait rien.
  assert.equal(inactif(lancer()), true);
  assert.equal(raisonDe(ecran, lancer()), "Il faut au moins un personnage et un adversaire.");
  await lancerLeCombat(ecran);
  assert.equal(etatDuCombat(ecran), "Préparation");
  assert.deepEqual(fiches(ecran), []);

  // Un personnage se pose d'office sur la colonne A, et ne s'ajoute qu'une fois.
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
  assert.deepEqual(jetons(ecran), { A1: ["Aubépine"] });
  const ajout = repere(ecran, "ajouter-personnage");
  assert.equal(inactif(ajout), true);
  assert.equal(raisonDe(ecran, ajout), "Ce personnage est déjà dans le combat.");
  await cliquer(ajout);
  assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
  assert.equal(inactif(lancer()), true, "un personnage ne suffit pas");

  // Les adversaires se posent sur la colonne J, les exemplaires d'un même adversaire sur la même case, numérotés.
  await ajouterDesAdversaires(ecran, "Chef de partie", 1);
  assert.equal(inactif(lancer()), false, "un personnage et un adversaire : le combat peut se lancer");
  await ajouterDesAdversaires(ecran, "Marmiton de corvée", 2);
  assert.deepEqual(fiches(ecran), [
    ["pj1", "Aubépine Crèmebrûlée"],
    ["adv2", "Chef de partie"],
    ["adv3", "Marmiton de corvée n° 1"],
    ["adv4", "Marmiton de corvée n° 2"],
  ]);
  assert.deepEqual(jetons(ecran), { A1: ["Aubépine"], J1: ["Chef"], J2: ["Marmiton 1", "Marmiton 2"] });
  // Un nombre hors de ses bornes : le bouton le dit, et n'ajoute rien.
  choisir(ecran, "adversaire", "Marmiton de corvée");
  saisir(repere(ecran, "nombre"), 11, "input");
  assert.equal(inactif(repere(ecran, "ajouter-adversaires")), true);
  assert.equal(raisonDe(ecran, repere(ecran, "ajouter-adversaires")), "Le nombre d'exemplaires va de 1 à 10.");
  await cliquer(repere(ecran, "ajouter-adversaires"));
  assert.equal(fiches(ecran).length, 4);
  saisir(repere(ecran, "nombre"), 1, "input");

  // Le champ « Case » d'une fiche déplace son jeton ; une case illisible ne déplace rien.
  poserSur(ecran, "pj1", "c3");
  poserSur(ecran, "adv3", "D4");
  assert.deepEqual(jetons(ecran), { C3: ["Aubépine"], D4: ["Marmiton 1"], J1: ["Chef"], J2: ["Marmiton 2"] });
  poserSur(ecran, "adv4", "K11");
  assert.deepEqual(jetons(ecran).J2, ["Marmiton 2"]);
  assert.equal(repere(fiche(ecran, "adv4"), "case").getAttribute("aria-invalid"), "true");

  // « Retirer » renumérote : le Marmiton qui reste n'a plus de numéro.
  await cliquer(repere(fiche(ecran, "adv3"), "retirer"));
  assert.deepEqual(fiches(ecran), [
    ["pj1", "Aubépine Crèmebrûlée"],
    ["adv2", "Chef de partie"],
    ["adv4", "Marmiton de corvée"],
  ]);
  assert.deepEqual(jetons(ecran), { C3: ["Aubépine"], J1: ["Chef"], J2: ["Marmiton"] });

  // Rien n'entre au journal avant le lancement.
  assert.deepEqual(journal(ecran), []);

  // « Qui commence » : les PJ d'office, les adversaires si on le règle.
  assert.equal(repere(ecran, "commence-pj").getAttribute("aria-pressed"), "true");
  await cliquer(repere(ecran, "commence-adv"));
  assert.equal(repere(ecran, "commence-adv").getAttribute("aria-pressed"), "true");
  assert.equal(repere(ecran, "commence-pj").getAttribute("aria-pressed"), "false");
  await lancerLeCombat(ecran);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.deepEqual(journal(ecran), ["Combat lancé : 1 personnage contre 2 adversaires. Les adversaires commencent.", "— Tour 1 · camp des adversaires —"]);
  // Le combat lancé, la préparation a laissé la place au panneau d'action, et les fiches n'ont plus ni champ ni « Retirer ».
  assert.deepEqual(un(ecran, ".combat-cadre").children.map((noeud) => noeud.className), ["combat-plateau", "combat-action", "combat-camps"]);
  assert.equal(tous(ecran, "[data-repere=case]").length, 0);
  assert.equal(tous(ecran, "[data-repere=retirer]").length, 0);
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");
  assert.deepEqual(tous(corps(ecran), "button").map(texteDe), ["Chef de partie", "Marmiton de corvée"]);
});

dansUnePage("préparation — qui ne s'ajoute pas le dit ; les câblés absents de la banque se nomment", async (page) => {
  // La démonstration : chaque rôle qu'elle attend a sa capacité, la ligne est absente.
  const temoin = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  assert.doesNotMatch(texteDe(un(temoin.ecran, ".combat-preparation")), /Câblés absents/);
  assert.equal(tous(repere(temoin.ecran, "adversaire"), "option").some((option) => texteDe(option).endsWith("(ne s'ajoute pas)")), false);

  // Une banque retouchée : la capacité de déplacement a changé de nom, un adversaire n'a pas son nombre d'actions.
  const banque = structuredClone(BANQUE);
  banque.capacites.find((capacite) => capacite.nom === "Pas chassé").nom = "Pas glissé";
  banque.adversaires.push({ nom: "Commis égaré", types: "", localisation: "Corps(2)", actions: "", souffle: "3", attaque: "2", defense: "3", equipement: "", capacites: "" });
  // Un personnage dont une caractéristique manque.
  const inacheve = structuredClone(AUBEPINE);
  inacheve.id = "demo-basile-000000000002";
  inacheve.identite.nom = "Basile Croûton";
  inacheve.caracteristiques.force = null;

  const { ecran } = await ouvrirLEcran(await pageNeuve(), { banque, magasin: magasinCombatMemoire(), personnages: [AUBEPINE, inacheve] });
  const preparation = un(ecran, ".combat-preparation");
  assert.match(texteDe(un(preparation, "p.combat-passifs")), /^Câblés absents de la banque : déplacement\.$/);

  assert.deepEqual(tous(repere(ecran, "personnage"), "option").map(texteDe), ["Aubépine Crèmebrûlée", "Basile Croûton (ne s'ajoute pas)"]);
  choisir(ecran, "personnage", "Basile Croûton");
  const ajout = repere(ecran, "ajouter-personnage");
  assert.equal(inactif(ajout), true);
  assert.equal(raisonDe(ecran, ajout), "Ses caractéristiques ne sont pas complètes.");
  await cliquer(ajout);
  assert.deepEqual(fiches(ecran), []);

  assert.ok(tous(repere(ecran, "adversaire"), "option").map(texteDe).includes("Commis égaré (ne s'ajoute pas)"));
  choisir(ecran, "adversaire", "Commis égaré");
  const ajoutAdversaire = repere(ecran, "ajouter-adversaires");
  assert.equal(inactif(ajoutAdversaire), true);
  assert.match(raisonDe(ecran, ajoutAdversaire), /^Ne s'ajoute pas : /);
  await cliquer(ajoutAdversaire);
  assert.deepEqual(fiches(ecran), []);
  // Son voisin, entier, s'ajoute.
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  assert.deepEqual(fiches(ecran), [["adv1", "Plongeur"]]);
});

dansUnePage("préparation — la carte : toucher un jeton puis une case ; la liste « +k » prend en main un jeton caché", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etroit: true });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(ecran, "Marmiton de corvée", 3);
  assert.deepEqual(jetons(ecran), { A1: ["Aubépine"], J1: ["Marmiton 1", "Marmiton 2", "Marmiton 3"] });

  // Toucher le jeton, puis la case : il s'y pose, et le focus reste à lui (c'est la carte qui le donne).
  const aubepine = jeton(ecran, "Aubépine Crèmebrûlée");
  await cliquer(aubepine);
  assert.equal(aubepine.getAttribute("aria-pressed"), "true");
  await cliquer(un(laCase(ecran, "B2"), "button.combat-case-choix"));
  assert.deepEqual(jetons(ecran).B2, ["Aubépine"]);
  assert.equal(repere(fiche(ecran, "pj1"), "case").value, "B2", "la fiche suit");
  assert.equal(document.activeElement, jeton(ecran, "Aubépine Crèmebrûlée"), "l'écran ne déplace pas le focus après une pose venue de la carte");

  // Trois jetons sur J1 : le « +1 » du téléphone ouvre la liste de la case, sous la préparation.
  const liste = un(un(ecran, ".combat-preparation"), ".combat-case-liste");
  assert.equal(liste.children.length, 0);
  const plus = un(laCase(ecran, "J1"), "button.combat-plus-etroit");
  assert.equal(texteDe(plus), "+1");
  assert.equal(tous(laCase(ecran, "J1"), "button.combat-plus-large").length, 0, "trois jetons se voient tous sur un grand écran");
  await cliquer(plus);
  assert.equal(texteDe(un(liste, "h3")), "Case J1");
  assert.equal(document.activeElement, un(liste, "h3"));
  assert.deepEqual(tous(liste, "button").map(texteDe), ["Marmiton de corvée n° 1", "Marmiton de corvée n° 2", "Marmiton de corvée n° 3", "Fermer"]);
  // « Fermer » vide la liste et rend le focus au « +1 ».
  await cliquer(boutonDit(liste, "Fermer"));
  assert.equal(liste.children.length, 0);
  assert.equal(document.activeElement, plus);

  // Un jeton pris dans la liste est en main : chaque autre case s'offre, et il s'y pose.
  await cliquer(plus);
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 3"));
  assert.equal(liste.children.length, 0, "la liste se ferme");
  assert.equal(tous(ecran, "button.combat-case-choix").length, 99);
  await cliquer(un(laCase(ecran, "E5"), "button.combat-case-choix"));
  assert.deepEqual(jetons(ecran), { B2: ["Aubépine"], E5: ["Marmiton 3"], J1: ["Marmiton 1", "Marmiton 2"] });
  assert.equal(tous(ecran, "button.combat-case-choix").length, 0);
  assert.equal(tous(laCase(ecran, "J1"), "button.combat-case-plus").length, 0, "deux jetons : plus de « +k »");

  // Une liste restée ouverte ne suit pas la préparation quand le combat se lance.
  poserSur(ecran, "pj1", "J1");
  await cliquer(un(laCase(ecran, "J1"), "button.combat-plus-etroit"));
  assert.deepEqual(tous(liste, "button").map(texteDe), ["Aubépine Crèmebrûlée", "Marmiton de corvée n° 1", "Marmiton de corvée n° 2", "Fermer"]);
  await lancerLeCombat(ecran);
  assert.equal(liste.isConnected, false, "la préparation a quitté la page");
  assert.equal(un(un(ecran, "section.combat-action"), ".combat-case-liste").children.length, 0);
});

dansUnePage("préparation — une banque sans adversaires le dit, comme l'écran Rencontre ; un combat gardé s'y joue quand même", async (page) => {
  // Une banque publiée avant la feuille « Adversaires » : ni adversaires, ni types.
  const { types_adversaires: _types, adversaires: _adversaires, ...sansAdversaires } = BANQUE;
  const { ecran } = await ouvrirLEcran(page, { banque: sansAdversaires, magasin: magasinCombatMemoire() });
  const preparation = un(ecran, ".combat-preparation");
  assert.match(texteDe(preparation), /Cette banque n'a aucun adversaire\./);
  assert.equal(tous(preparation, "[data-repere=adversaire]").length, 0);
  assert.equal(tous(preparation, "[data-repere=personnage]").length, 1, "les personnages s'ajoutent toujours");
  assert.equal(inactif(repere(ecran, "lancer")), true);
  // Avec ses adversaires, la banque de la démonstration ne dit rien de tel.
  const temoin = await ouvrirLEcran(await pageNeuve(), { magasin: magasinCombatMemoire() });
  assert.doesNotMatch(texteDe(un(temoin.ecran, ".combat-preparation")), /aucun adversaire\./);

  // Un combat gardé ne doit rien à la banque du jour : ses photographies se suffisent.
  const lieu = lieuEnMemoire();
  await poserEnBase(lieu, texteDuCombat(0, 3));
  const repris = await ouvrirLEcran(await pageNeuve(), { banque: sansAdversaires, magasin: await lieu.onglet(), des: desDe(scenario.gestes.slice(0, 1)) });
  assert.equal(etatDuCombat(repris.ecran), "Tour 1 · camp des PJ");
  await jouerLeGeste(repris.ecran, scenario.gestes[0]);
  assert.deepEqual(journal(repris.ecran), journalAttendu.slice(0, 3));
  assert.deepEqual(repris.des.reste(), []);
});

// ─── La rencontre ───────────────────────────────────────────────────────────

dansUnePage("rencontre — vide, le bouton le dit ; préparée, elle se pose d'un clic, à la suite ; un plafond refuse tout", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  const placer = () => repere(ecran, "rencontre");
  assert.equal(inactif(placer()), true);
  assert.equal(raisonDe(ecran, placer()), "Composez d'abord une rencontre.");
  await cliquer(placer());
  assert.deepEqual(fiches(ecran), []);

  // L'écran Rencontre compose : un Chef de partie, deux Marmitons de corvée.
  assert.equal(rencontre.ajouter(BANQUE, "Marmiton de corvée"), true);
  assert.equal(rencontre.ajouter(BANQUE, "Marmiton de corvée"), true);
  assert.equal(rencontre.ajouter(BANQUE, "Chef de partie"), true);
  const { ecran: revenue } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  const placerIci = () => repere(revenue, "rencontre");
  assert.equal(inactif(placerIci()), false);
  await cliquer(placerIci());
  // Dans l'ordre de la liste de l'écran Rencontre, numérotation comprise.
  assert.deepEqual(fiches(revenue), [
    ["adv1", "Chef de partie"],
    ["adv2", "Marmiton de corvée n° 1"],
    ["adv3", "Marmiton de corvée n° 2"],
  ]);
  assert.deepEqual(jetons(revenue), { J1: ["Chef"], J2: ["Marmiton 1", "Marmiton 2"] });
  assert.equal(avis(revenue).children.length, 0);
  // La rencontre n'est pas touchée : elle se pose de nouveau, à la suite.
  assert.deepEqual([rencontre.exemplaires(BANQUE, "Chef de partie"), rencontre.exemplaires(BANQUE, "Marmiton de corvée")], [1, 2]);
  await cliquer(placerIci());
  assert.deepEqual(fiches(revenue).map(([, nom]) => nom), ["Chef de partie n° 1", "Marmiton de corvée n° 1", "Marmiton de corvée n° 2", "Chef de partie n° 2", "Marmiton de corvée n° 3", "Marmiton de corvée n° 4"]);

  // Douze exemplaires d'un adversaire au plus : quatre fois deux Marmitons de plus passent, la fois d'après est refusée en entier.
  for (let fois = 0; fois < 4; fois += 1) await cliquer(placerIci());
  assert.equal(fiches(revenue).length, 18);
  assert.equal(inactif(placerIci()), true);
  assert.match(raisonDe(revenue, placerIci()), /12/);
  await cliquer(placerIci());
  assert.equal(fiches(revenue).length, 18, "rien ne se pose, pas même le Chef de partie");
});

dansUnePage("rencontre — un adversaire qui ne s'ajoute pas reste hors du combat, les autres se posent, et l'écran dit lequel", async (page) => {
  const banque = structuredClone(BANQUE);
  banque.adversaires.push({ nom: "Commis égaré", types: "", localisation: "Corps(2)", actions: "", souffle: "3", attaque: "2", defense: "3", equipement: "", capacites: "" });
  rencontre.exemplaires({}, "");
  assert.equal(rencontre.ajouter(banque, "Commis égaré"), true);
  assert.equal(rencontre.ajouter(banque, "Plongeur"), true);
  const { ecran } = await ouvrirLEcran(page, { banque, magasin: magasinCombatMemoire() });
  await cliquer(repere(ecran, "rencontre"));
  assert.deepEqual(fiches(ecran), [["adv1", "Plongeur"]]);
  const dit = tous(avis(ecran), "p").map(texteDe);
  assert.equal(dit.length, 1);
  assert.match(dit[0], /^Commis égaré reste hors du combat\. Ne s'ajoute pas : /);
  // L'avis s'efface au geste suivant.
  await cliquer(repere(ecran, "commence-adv"));
  assert.equal(avis(ecran).children.length, 0);
});

// ─── Le combat ──────────────────────────────────────────────────────────────

dansUnePage("combat — le combat de référence, joué à l'écran du premier clic au dernier : la préparation, les tours, la mort, la fin, le journal mot pour mot", async (page) => {
  const lieu = lieuSimule();
  const { ecran, des } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), des: desDe(scenario.gestes) });
  await preparerLaReference(ecran);
  assert.deepEqual(jetons(ecran), { C3: ["Aubépine"], D4: ["Marmiton 1", "Marmiton 2"], F6: ["Chef"] });
  assert.equal(tous(barre(ecran), "button").find((b) => texteDe(b) === "Fin de tour").hidden, true, "pas de « Fin de tour » avant le lancement");

  await lancerLeCombat(ecran);
  // Le lancement : l'état de la barre, « Qui joue ? », le focus sur la commande qui attend.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Les PJ jouent dans l'ordre de leur choix\./);
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");
  assert.equal(document.activeElement, boutonDit(corps(ecran), "Aubépine Crèmebrûlée"));
  assert.equal(annonce(ecran), "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent. — Tour 1 · camp des PJ —");
  const finDeTour = boutonDit(barre(ecran), "Fin de tour");
  assert.equal(finDeTour.hidden, false);
  assert.equal(inactif(finDeTour), false);
  // « Jouer » : sur la fiche du camp qui a la main, et sur elle seule.
  assert.deepEqual(tous(ecran, "[data-repere=jouer]").map((b) => b.getAttribute("aria-label")), ["Jouer : Aubépine Crèmebrûlée"]);

  // Le journal défile jusqu'à sa dernière ligne à chaque ligne qui s'ajoute.
  const lignes = un(ecran, "ol.combat-lignes");
  lignes.scrollHeight = 480;
  lignes.scrollTop = 0;
  const [premiereLigne] = tous(lignes, "li");
  // Le groupe 1 n'a pas d'« Intervenir… » dans sa barre.
  assert.deepEqual(tous(barre(ecran), "button").map(texteDe), ["Fin de tour", "⋯", "Nouveau combat"]);

  // Le premier geste, pas à pas : Aubépine frappe le Marmiton n° 1.
  const premier = scenario.gestes[0];
  let desCliques = 0;
  await jouerLeGeste(ecran, premier, {
    apresChaqueDe(avant) {
      desCliques += 1;
      // Une seule région change de texte après un dé : celle de l'annonce.
      const changees = regions(ecran).filter(([noeud, texte], rang) => avant[rang][0] === noeud && avant[rang][1] !== texte).map(([noeud]) => noeud.className);
      assert.deepEqual(changees, ["combat-annonce"], `après le dé n° ${desCliques}`);
      if (desCliques === 1) {
        assert.equal(annonce(ecran), "1er dé : 7 et 10, on garde 7, réussi.");
        // Le geste est payé : « Fin de tour » attend la fin de l'action, et le dit.
        assert.equal(inactif(finDeTour), true);
        assert.equal(raisonDe(ecran, finDeTour), "Une action est en cours.");
        // L'état de l'enregistrement change, lui, sans rien annoncer.
        assert.equal(garde(ecran), "Enregistrement…");
        assert.equal(document.activeElement, deACliquer(ecran), "le focus va au dé suivant");
      }
      if (desCliques === 2) assert.equal(annonce(ecran), "2e dé : 9 et 3, on garde 3, échec. 1 réussite, A = 3, +1 contre l'armure (Réduction).");
      if (desCliques === 3) {
        assert.equal(annonce(ecran), "Localisation : 16, bras gauche.");
        assert.equal(document.activeElement, boutonDit(corps(ecran), "Appliquer"));
      }
    },
  });
  assert.equal(desCliques, 3, "deux dés de la chaîne, lancés deux fois chacun d'un seul clic, puis le d20");
  assert.equal(avis(ecran).children.length, 0, "ni « Enregistrement… » ni « Combat gardé » ne passent par la zone d'avis");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
  assert.equal(annonce(ecran), journalAttendu[2], "la fin d'un geste s'annonce par sa ligne");
  assert.equal(lignes.scrollTop, 480, "la dernière ligne reste visible");
  assert.equal(tous(lignes, "li")[0], premiereLigne, "les lignes déjà posées restent : seules les nouvelles s'ajoutent");
  assert.equal(titreDuPanneau(ecran), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10");
  assert.equal(inactif(finDeTour), false);
  assert.equal(raisonDe(ecran, finDeTour), "");
  // La fiche du Marmiton touché le montre.
  assert.match(texteDe(fiche(ecran, "adv3")), /11\/15/);

  // Le deuxième geste finit le tour : les adversaires prennent la main.
  await jouerLeGeste(ecran, scenario.gestes[1]);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Les adversaires jouent dans l'ordre de votre choix\./);
  assert.deepEqual(jetons(ecran), { D4: ["Aubépine", "Marmiton 1", "Marmiton 2"], F6: ["Chef"] });
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");
  assert.deepEqual(tous(ecran, "[data-repere=jouer]").map((b) => b.getAttribute("aria-label")), ["Jouer : Chef de partie", "Jouer : Marmiton de corvée n° 1", "Jouer : Marmiton de corvée n° 2"]);

  // Jusqu'au dernier dé du combat : après chacun, une seule région change de texte, celle de l'annonce.
  let desAnnonces = 0;
  const seuleLAnnonce = (avant) => {
    desAnnonces += 1;
    const changees = regions(ecran).filter(([noeud, texte], rang) => avant[rang][0] === noeud && avant[rang][1] !== texte).map(([noeud]) => noeud.className);
    assert.deepEqual(changees, ["combat-annonce"], annonce(ecran));
    assert.notEqual(annonce(ecran), "");
  };

  // Le tour des adversaires, puis le tour 2 jusqu'à la mort du Marmiton n° 1.
  for (const geste of scenario.gestes.slice(2, 6)) await jouerLeGeste(ecran, geste, { apresChaqueDe: seuleLAnnonce });
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 12));
  assert.match(journal(ecran).at(-1), /Marmiton n° 1 meurt\.$/);
  // La mort : le jeton barré, la fiche repliée, le compte du camp, la ligne du journal.
  const mort = jeton(ecran, "Marmiton de corvée n° 1");
  assert.ok(mort.className.split(" ").includes("mort"));
  assert.equal(inactif(mort), true);
  assert.ok(fiche(ecran, "adv3").className.split(" ").includes("morte"));
  assert.equal(fiche(ecran, "adv3").hasAttribute("open"), false, "la fiche d'un mort se replie");
  assert.equal(fiche(ecran, "adv4").hasAttribute("open"), true, "celle d'un vivant reste ouverte");
  assert.match(texteDe(fiche(ecran, "adv3")), /mort au tour 2/);
  assert.match(texteDe(un(ecran, ".combat-camp-adv h2")), /2 en vie sur 3/);
  assert.deepEqual(tous(lignes, "li").filter((li) => li.className === "mort").map(texteDe), [journalAttendu[11]]);
  assert.deepEqual(tous(lignes, "li").filter((li) => li.className === "tour").map(texteDe), ["— Tour 1 · camp des PJ —", "— Tour 1 · camp des adversaires —", "— Tour 2 · camp des PJ —"]);

  // La suite, jusqu'au dernier dé.
  for (const geste of scenario.gestes.slice(6)) await jouerLeGeste(ecran, geste, { apresChaqueDe: seuleLAnnonce });
  assert.deepEqual(journal(ecran), journalAttendu);
  assert.ok(desAnnonces > 30, "plus de trente dés annoncés");
  assert.equal(avis(ecran).children.length, 0, "d'un bout à l'autre du combat, la zone d'avis n'a rien eu à dire");
  assert.deepEqual(des.reste(), [], "tous les dés du scénario sont tombés, et aucun autre");

  // La fin : on ne joue plus, mais le journal se copie et se télécharge toujours.
  assert.equal(etatDuCombat(ecran), "Combat terminé");
  assert.equal(titreDuPanneau(ecran), "Combat terminé : victoire des PJ.");
  assert.equal(tous(corps(ecran), "button").length, 0);
  assert.equal(finDeTour.hidden, true);
  assert.equal(tous(ecran, "[data-repere=jouer]").length, 0);
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Le combat est terminé\./);
  assert.equal(inactif(boutonDit(un(ecran, ".combat-journal"), "Copier")), false);
  assert.equal(inactif(boutonDit(un(ecran, ".combat-journal"), "Télécharger")), false);

  // Ce que la base garde est ce combat, entier : une page neuve le reprend.
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const { ecran: rechargee } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet() });
  assert.deepEqual(journal(rechargee), journalAttendu);
  assert.equal(etatDuCombat(rechargee), "Combat terminé");
});

dansUnePage("combat — la cible : « choisie sur la carte », « choisie ici » ; un rechargement en plein geste retrouve le moment, sans relancer un dé ni redire l'origine", async (page) => {
  const lieu = lieuSimule();
  const { ecran, des: aucun } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), des: [] });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  const originesDe = (noeud) => tous(corps(noeud), ".combat-origine").map((origine) => [texteDe(origine), origine.parentNode.className]);
  const ciblesChoisies = (noeud) => tous(un(corps(noeud), ".combat-cibles"), "button").filter((b) => b.getAttribute("aria-pressed") === "true").map(texteDe);
  const origines = () => originesDe(ecran);
  const cibleChoisie = () => ciblesChoisies(ecran);
  assert.deepEqual(origines(), [], "aucune cible, aucune origine");
  // Le Chef de partie est hors de portée : ni son jeton ni son bouton ne le choisissent.
  assert.equal(inactif(jeton(ecran, "Chef de partie")), true);
  const chef = boutonDit(un(corps(ecran), ".combat-cibles"), "Chef de partie");
  assert.equal(inactif(chef), true);
  assert.match(raisonDe(ecran, chef), /^hors de portée/);
  await cliquer(jeton(ecran, "Chef de partie"));
  await cliquer(chef);
  assert.deepEqual(cibleChoisie(), []);

  // Par son jeton : « choisie sur la carte ».
  await cliquer(jeton(ecran, "Marmiton de corvée n° 2"));
  assert.deepEqual(cibleChoisie(), ["Marmiton de corvée n° 2"]);
  assert.deepEqual(origines(), [["choisie sur la carte", "combat-cibles"]]);
  assert.ok(jeton(ecran, "Marmiton de corvée n° 2").className.split(" ").includes("cible"));
  // Par son bouton : « choisie ici ».
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  assert.deepEqual(cibleChoisie(), ["Marmiton de corvée n° 1"]);
  assert.deepEqual(origines(), [["choisie ici", "combat-cibles"]]);
  // « Revenir » avant le premier dé : rien n'est dépensé, et l'origine ne suit pas le geste suivant.
  await cliquer(boutonDit(corps(ecran), "Revenir"));
  assert.equal(titreDuPanneau(ecran), "Aubépine Crèmebrûlée joue — 2 actions sur 2, souffle 10");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.deepEqual(origines(), []);
  await cliquer(jeton(ecran, "Marmiton de corvée n° 1"));
  assert.deepEqual(origines(), [["choisie sur la carte", "combat-cibles"]]);
  assert.deepEqual(aucun.reste(), [], "aucun dé n'a été demandé");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

  // Un rechargement avant le premier dé : le geste est là, sa cible aussi, rien n'est payé ;
  // mais ni l'événement ni l'état ne disent d'où venait le clic.
  const { ecran: rechargee, des: debut } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet(), des: [6, 9] });
  assert.equal(etatDuCombat(rechargee), "Tour 1 · camp des PJ");
  assert.equal(titreDuPanneau(rechargee), "Aubépine Crèmebrûlée joue — 2 actions sur 2, souffle 10");
  assert.deepEqual(ciblesChoisies(rechargee), ["Marmiton de corvée n° 1"]);
  assert.deepEqual(originesDe(rechargee), [], "après un rechargement, rien ne dit d'où venait la cible");
  // Le premier dé : le geste est payé, et ses cibles ne se montrent plus. La page se recharge là.
  await cliquer(deACliquer(rechargee));
  assert.deepEqual(debut.reste(), []);
  assert.equal(titreDuPanneau(rechargee), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10");
  assert.equal(tous(corps(rechargee), ".combat-cibles").length, 0);
  await attendre(() => garde(rechargee) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

  // La page neuve n'a que les dés qui restent à lancer : un dé déjà lancé qu'elle relancerait la ferait lever.
  const { ecran: reprise, des: suite } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet(), des: [8, 2, 16] });
  assert.equal(titreDuPanneau(reprise), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10");
  const chaine = tous(corps(reprise), "button.combat-de");
  assert.equal(inactif(chaine[0]), true, "le premier dé est lancé : il ne se clique plus");
  assert.match(chaine[0].getAttribute("aria-label"), /^1er dé : 7 .*réussi$/);
  assert.equal(deACliquer(reprise), chaine[1], "c'est le deuxième dé qui attend");
  assert.deepEqual(journal(reprise), journalAttendu.slice(0, 2), "la ligne ne s'écrit qu'une fois le geste fini");
  assert.deepEqual(suite.reste(), [8, 2, 16], "ouvrir l'écran ne lance aucun dé");
  // Le geste se finit comme s'il n'avait pas été coupé.
  await cliquer(deACliquer(reprise));
  await cliquer(deACliquer(reprise));
  await cliquer(boutonDit(corps(reprise), "Appliquer"));
  assert.deepEqual(journal(reprise), journalAttendu.slice(0, 3));
  assert.deepEqual(suite.reste(), []);
});

dansUnePage("combat — la liste « +k » d'une case : la commande du jeton, « choisie ici » ; un jeton sans choix ne fait rien ; « Fermer »", async (page) => {
  const gestes = scenario.gestes.slice(0, 2);
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des: desDe(gestes), etroit: true });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  for (const geste of gestes) await jouerLeGeste(ecran, geste);
  // Aubépine a rejoint les deux Marmitons : trois jetons sur D4, dont un derrière « +1 » sur un téléphone.
  const liste = un(un(ecran, "section.combat-action"), ".combat-case-liste");
  const plus = () => un(laCase(ecran, "D4"), "button.combat-plus-etroit");
  assert.equal(texteDe(plus()), "+1");

  // Qui joue se choisit aussi par « Jouer », sur sa fiche, et par son jeton ; on en change tant que rien n'est payé.
  await cliquer(repere(fiche(ecran, "adv2"), "jouer"));
  assert.equal(titreDuPanneau(ecran), "Chef de partie joue — 1 action sur 1, souffle 7");
  assert.equal(tous(fiche(ecran, "adv2"), "[data-repere=jouer]").length, 0, "celui qui joue n'a plus de « Jouer »");
  await cliquer(jeton(ecran, "Marmiton de corvée n° 2"));
  assert.equal(titreDuPanneau(ecran), "Marmiton de corvée n° 2 joue — 1 action sur 1, souffle 5");
  // Aubépine, dont ce n'est pas le tour, ne se choisit pas : son jeton ne fait rien.
  assert.equal(inactif(jeton(ecran, "Aubépine Crèmebrûlée")), true);
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.equal(titreDuPanneau(ecran), "Marmiton de corvée n° 2 joue — 1 action sur 1, souffle 5");
  // Revenir à « Qui joue ? » : le Marmiton n° 2 passe son tour.
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");

  // Rien n'est en cours : la liste choisit qui joue.
  await cliquer(plus());
  assert.equal(texteDe(un(liste, "h3")), "Case D4");
  const dansLaListe = () => tous(liste, "button").map((b) => [texteDe(b), inactif(b)]);
  assert.deepEqual(dansLaListe(), [
    ["Aubépine Crèmebrûlée", true],
    ["Marmiton de corvée n° 1", false],
    ["Marmiton de corvée n° 2", true],
    ["Fermer", false],
  ]);
  // Le Marmiton n° 2 a joué : son bouton ne fait rien non plus.
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 2"));
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");
  // Aubépine ne joue pas pendant le tour des adversaires : son bouton ne fait rien.
  await cliquer(boutonDit(liste, "Aubépine Crèmebrûlée"));
  assert.equal(titreDuPanneau(ecran), "Qui joue ?");
  assert.equal(liste.children.length, 5, "la liste reste ouverte");
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 1"));
  assert.equal(titreDuPanneau(ecran), "Marmiton de corvée n° 1 joue — 1 action sur 1, souffle 5");
  assert.equal(liste.children.length, 0, "un choix fait, la liste se ferme");

  // Pendant le choix d'une cible : seule la cible possible s'y choisit, et c'est un choix du panneau.
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(plus());
  assert.deepEqual(dansLaListe(), [
    ["Marmiton de corvée n° 1", true],
    ["Aubépine Crèmebrûlée", false],
    ["Marmiton de corvée n° 2", true],
    ["Fermer", false],
  ]);
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 2"));
  assert.deepEqual(tous(corps(ecran), ".combat-origine"), [], "un jeton écarté ne se choisit pas");
  await cliquer(boutonDit(liste, "Aubépine Crèmebrûlée"));
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
  assert.equal(liste.children.length, 0);

  // « Fermer » vide la liste sans rien choisir, et rend le focus au « +1 ».
  await cliquer(plus());
  await cliquer(boutonDit(liste, "Fermer"));
  assert.equal(liste.children.length, 0);
  assert.equal(document.activeElement, plus());
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
});

dansUnePage("combat — ce que le combat de référence ne joue pas : la puissance, les réglages à la main, un refus du moteur, les dégâts directs, la face décalée, deux armes, sans arme, X", async (page) => {
  // Aubépine, un Marmiton de corvée, le Homard furieux (deux armes) et la Mouette chapardeuse (aucune), tous sur A1.
  const { ecran, des } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des: [5, 6, 7, 14, 8, 8, 8, 1, 12] });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  for (const nom of ["Marmiton de corvée", "Homard furieux", "Mouette chapardeuse"]) await ajouterDesAdversaires(ecran, nom, 1);
  for (const id of ["adv2", "adv3", "adv4"]) poserSur(ecran, id, "A1");
  await lancerLeCombat(ecran);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  const regler = async (action, valeur, raison) => {
    const { bouton, champs } = saisieDuPanneau(ecran, action);
    champs[0].value = String(valeur);
    if (raison !== undefined) champs[1].value = raison;
    await cliquer(bouton);
  };

  // La puissance : le bouton, le coût et la description la suivent.
  await cliquer(boutonDeCapacite(ecran, "Flambage [2]"));
  assert.equal(texteDe(boutonDeCapacite(ecran, "Flambage [2]")), "Flambage [2] 10 souffle");
  assert.match(texteDe(un(corps(ecran), ".combat-description")), /par 3\.$/);
  await cliquer(boutonOu(corps(ecran), (b) => b.getAttribute("aria-label") === "Baisser la puissance", "« − »"));
  assert.equal(texteDe(boutonDeCapacite(ecran, "Flambage [1]")), "Flambage [1] 5 souffle");
  assert.match(texteDe(un(corps(ecran), ".combat-description")), /par 2\.$/);
  // Une capacité sans jet : sa cible est facultative, et « Confirmer » la paie.
  assert.equal(boutonDit(corps(ecran), "Sans cible").getAttribute("aria-pressed"), "true");
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(journal(ecran).at(-1), "Aubépine : Flambage [1] (5 souffle).");
  assert.equal(titreDuPanneau(ecran), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 5");

  // Les réglages à la main, avant le premier dé : le contexte du jet les montre.
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée"));
  await regler("Régler le modificateur", 2, "Inspiration");
  await regler("Régler les avantages", 1, "Minutie");
  const contexte = texteDe(un(corps(ecran), ".combat-contexte"));
  assert.match(contexte, /Dé d10\+3 /);
  assert.match(contexte, /\+2 \(à la main : Inspiration\)/);
  assert.match(contexte, /1 avantage · Avantages : Solo du chef, à la main : Minutie · Désavantages : Frappe hors maîtrise/);
  for (let lance = 0; lance < 3; lance += 1) await cliquer(deACliquer(ecran));
  assert.match(texteDe(un(corps(ecran), "p.combat-bilan")), /^3 réussites, C = 20/);

  // Une raison que le moteur refuse (81 signes) : le refus se dit dans la zone d'avis, et rien ne change.
  await regler("Fixer les dégâts", 7, "x".repeat(81));
  assert.equal(tous(avis(ecran), "p").length, 1);
  assert.match(texteDe(avis(ecran)), /raison/);
  assert.equal(tous(avis(ecran), "button").length, 0);
  assert.match(texteDe(un(corps(ecran), "p.combat-bilan")), /^3 réussites, C = 20, \+3 contre l'armure \(Réduction\)\.$/);
  // Des dégâts directs, au corps : la nature d'abord, puis le nombre et sa raison. L'avis s'efface au geste accepté.
  await cliquer(boutonDit(corps(ecran), "Directs, au corps"));
  assert.equal(avis(ecran).children.length, 0);
  await regler("Fixer les dégâts", 4, "Coup bas");
  assert.match(texteDe(un(corps(ecran), "p.combat-bilan")), /dégâts directs au corps : 4 \(Coup bas\)\.$/);
  // La face décalée, avec sa raison : le détail des dégâts suit la zone.
  await cliquer(deACliquer(ecran));
  assert.match(texteDe(un(corps(ecran), ".combat-detail")), /^Jambe droite : corps 10 → 6$/);
  await regler("Décaler", -2, "Minutie");
  assert.match(texteDe(un(corps(ecran), ".combat-detail")), /^Jambe gauche : corps 10 → 6$/);
  await cliquer(boutonDit(corps(ecran), "Appliquer"));
  const frappe = journal(ecran).at(-3);
  assert.match(frappe, /^Aubépine : Frappe contre Marmiton\. /);
  assert.match(frappe, /d10\+3 contre 5 \(\+2 à la main : Inspiration\), 1 avantage → 8 ✓, 9 ✓, 10 ✓ : 3 réussites, C = 20, dégâts directs au corps : 4 \(Coup bas\)\./);
  assert.match(frappe, /Localisation d20 → 14, décalée à 12 \(Minutie\) : jambe gauche\. Corps 10 → 6\.$/);

  // Le tour des adversaires. Le Homard furieux a deux armes : la capacité qu'elles donnent toutes deux a un bouton sous chacune.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  await choisirQuiJoue(ecran, "Homard furieux");
  assert.deepEqual(tous(corps(ecran), ".combat-groupe").map((groupe) => [texteDe(un(groupe, "h3")), tous(groupe, "button").map((b) => texteDe(b.children[0] ?? b))]), [
    ["Pinces de homard", ["Frappe", "Choc sourd"]],
    ["Couteau d'office", ["Frappe", "Émincer", "Passer son tour"]],
  ]);
  await cliquer(boutonOu(tous(corps(ecran), ".combat-groupe")[0], (b) => texteDe(b).startsWith("Frappe"), "Frappe, par les pinces"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Aubépine Crèmebrûlée"));
  assert.match(texteDe(un(corps(ecran), ".combat-contexte")), /^Jet de défense · Frappe contre Aubépine Crèmebrûlée/);
  for (let lance = 0; lance < 3; lance += 1) await cliquer(deACliquer(ecran));
  assert.match(journal(ecran).at(-1), /^Homard : Frappe \(Pinces de homard\) contre Aubépine\. .* : 3 réussites, aucun dégât\.$/);

  // La Mouette chapardeuse n'a pas d'arme : le jet se prête « sans arme », et les dégâts se saisissent à la main.
  await choisirQuiJoue(ecran, "Mouette chapardeuse");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  const prete = boutonCommencant(un(corps(ecran), ".combat-jet-prete"), "Jet d'attaque");
  assert.equal(texteDe(prete), "Jet d'attaque (sans arme)");
  await cliquer(prete);
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Aubépine Crèmebrûlée"));
  await regler("Régler le modificateur", -3, "Vent");
  await cliquer(deACliquer(ecran));
  await regler("Fixer les dégâts", 4, "Frappe");
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), "Appliquer"));
  assert.match(journal(ecran).at(-1), /^Mouette : Frappe contre Aubépine\. .*aucune réussite, Aubépine reçoit 4 \(à la main : Frappe\)\. Localisation d20 → 12 : jambe gauche\. Armure 10 → 6\.$/);
  assert.deepEqual(des.reste(), []);

  // « Fin de tour », puis une intervention jouée à son propre tour : X se choisit, et se paie.
  await cliquer(boutonDit(barre(ecran), "Fin de tour"));
  assert.equal(etatDuCombat(ecran), "Tour 2 · camp des PJ");
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonOu(corps(ecran), (b) => b.className === "combat-capacite" && texteDe(b).startsWith("Pas de côté"), "« Pas de côté »"));
  await regler("Régler X", 2);
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(journal(ecran).at(-1), "Aubépine : Pas de côté (2 souffle).");
  assert.equal(titreDuPanneau(ecran), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 3");
});

dansUnePage("combat — le lien se paie sur une jauge au choix ; un adversaire à deux armes choisit celle qui prête son jet", async (page) => {
  // La démonstration n'a pas de personnage à deux jauges : un combat est posé en base, sur un
  // personnage écrit à la main, dont une capacité coûte du lien sans jauge attitrée.
  const lieu = lieuEnMemoire();
  const gardien = creerGardien({ magasin: await lieu.onglet(), mode: "demo", secret: () => SECRET });
  const posee = creerSeance({ gardien, des: desImposes([]), maintenant: SOIR, mode: "demo", accepter });
  const aDeuxJauges = pjEssai((valeurs) => {
    valeurs.liens.push({ nom: "Vieux Fourneau", points: 1 });
    valeurs.capacites.find((capacite) => capacite.nom === "Fournaise").lien = null;
  });
  assert.deepEqual(posee.preparer({ type: "ajouter_personnage", photo: aDeuxJauges }), {});
  assert.deepEqual(posee.preparer({ type: "ajouter_adversaires", photos: [adversaireEssai()] }), {});
  assert.deepEqual(posee.lancer(), {});
  await gardien.repos();

  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await choisirQuiJoue(ecran, "Aubépine");
  await cliquer(boutonDeCapacite(ecran, "Fournaise [1]"));
  const jauges = () => tous(un(corps(ecran), ".combat-jauges"), "button").map((b) => [texteDe(b), b.getAttribute("aria-pressed")]);
  assert.deepEqual(jauges(), [
    ["Grand Four", "true"],
    ["Vieux Fourneau", "false"],
  ]);
  await cliquer(boutonDit(un(corps(ecran), ".combat-jauges"), "Vieux Fourneau"));
  assert.deepEqual(jauges(), [
    ["Grand Four", "false"],
    ["Vieux Fourneau", "true"],
  ]);
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(journal(ecran).at(-1), "Aubépine : Fournaise [1] (1 souffle, 1 lien).");
  // La fiche montre la jauge qui a payé, et celle qui est restée pleine.
  assert.match(texteDe(fiche(ecran, "pj1")), /Lien · Grand Four\s*2\/2.*Lien · Vieux Fourneau\s*0\/1/);

  // Le Homard furieux a deux armes ; on lui donne ici une capacité sans jet, qu'il joue avec le jet d'une arme.
  const banque = structuredClone(BANQUE);
  banque.adversaires.find((adversaire) => adversaire.nom === "Homard furieux").capacites = "Dressage minute";
  const { ecran: second } = await ouvrirLEcran(await pageNeuve(), { banque, magasin: magasinCombatMemoire(), des: [8, 8, 8] });
  await ajouterLePersonnage(second, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(second, "Homard furieux", 1);
  poserSur(second, "adv2", "A1");
  await lancerLeCombat(second);
  await cliquer(boutonDit(barre(second), "Fin de tour"));
  await choisirQuiJoue(second, "Homard furieux");
  await cliquer(boutonDeCapacite(second, "Dressage minute"));
  assert.equal(tous(corps(second), ".combat-armes").length, 0, "sans jet, aucune arme à choisir");
  await cliquer(boutonDit(un(corps(second), ".combat-jet-prete"), "Jet d'attaque (Pinces de homard)"));
  const armes = () => tous(un(corps(second), ".combat-armes"), "button").map((b) => [texteDe(b), b.getAttribute("aria-pressed")]);
  assert.deepEqual(armes(), [
    ["Pinces de homard", "true"],
    ["Couteau d'office", "false"],
  ]);
  await cliquer(boutonDit(un(corps(second), ".combat-armes"), "Couteau d'office"));
  assert.deepEqual(armes(), [
    ["Pinces de homard", "false"],
    ["Couteau d'office", "true"],
  ]);
  assert.equal(texteDe(un(un(corps(second), ".combat-jet-prete"), "button")), "Jet d'attaque (Couteau d'office)");
  await cliquer(boutonDit(un(corps(second), ".combat-cibles"), "Aubépine Crèmebrûlée"));
  for (let lance = 0; lance < 3; lance += 1) await cliquer(deACliquer(second));
  assert.match(journal(second).at(-1), /^Homard : Dressage minute \(Couteau d'office\) contre Aubépine\. .* : 3 réussites, aucun dégât\.$/);
});

dansUnePage("les dés — sans service, l'écran les tire du générateur du navigateur ; seul le service des contrôles en impose", async (page) => {
  // Le générateur, observé. Un dé se tire dans un mot de 32 bits (js/combat/des.js) ; le vecteur
  // d'un chiffrement, lui, est fait d'octets, et ne se compte pas ici.
  let tires = 0;
  const generateur = crypto.getRandomValues;
  crypto.getRandomValues = function getRandomValues(tampon) {
    if (tampon instanceof Uint32Array) tires += 1;
    return generateur.call(crypto, tampon);
  };
  try {
    const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), secret: null, des: null });
    await preparerLaReference(ecran);
    await lancerLeCombat(ecran);
    await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
    await cliquer(boutonDeCapacite(ecran, "Frappe"));
    await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
    assert.equal(tires, 0, "aucun dé n'est tiré avant le clic sur le dé");
    await cliquer(deACliquer(ecran));
    // Un désavantage : le dé se lance deux fois, d'un seul clic.
    assert.ok(tires >= 2, `${tires} tirage(s)`);
    // Le hasard décide de la suite : le dé réussit et la chaîne continue (l'annonce dit le dé),
    // ou il échoue et l'attaque est manquée (l'annonce est alors la ligne du journal).
    const dit = /^1er dé : (\d+) et (\d+), on garde (\d+), réussi\.$/.exec(annonce(ecran)) ?? /, 1 désavantage → (\d+)\/(\d+) → (\d+) ✗ : aucune réussite, manqué\.$/.exec(annonce(ecran));
    assert.ok(dit, annonce(ecran));
    const [premier, second, gardee] = dit.slice(1).map(Number);
    // Un d10, plus 1 : chaque valeur va de 2 à 11, et l'on garde la pire.
    for (const valeur of [premier, second]) assert.ok(valeur >= 2 && valeur <= 11, `la valeur ${valeur}`);
    assert.equal(gardee, Math.min(premier, second));
  } finally {
    delete crypto.getRandomValues;
  }
  assert.equal(crypto.getRandomValues, generateur);
});

dansUnePage("téléphone — seule la fiche de qui joue est ouverte ; le menu « ⋯ » porte « Nouveau combat »", async (page) => {
  const ouvertes = (ecran) => tous(ecran, "details").filter((noeud) => noeud.hasAttribute("open")).map((noeud) => noeud.getAttribute("data-id"));
  const { ecran, requetes } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etroit: true });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  assert.deepEqual(ouvertes(ecran), [], "personne ne joue encore");
  // Qui joue se choisit par son jeton, comme par son nom.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.equal(titreDuPanneau(ecran), "Aubépine Crèmebrûlée joue — 2 actions sur 2, souffle 10");
  assert.deepEqual(ouvertes(ecran), ["pj1"]);
  // La largeur se demande au navigateur, sous le seuil de la feuille de style (56rem).
  assert.deepEqual([...requetes], ["(max-width: 55.99rem)"]);

  // Le menu : fermé d'abord, il s'ouvre et se referme ; « Fin de tour » reste dehors.
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  const autres = un(barre(ecran), "div.combat-autres");
  assert.equal(texteDe(plus), "⋯");
  assert.equal(plus.getAttribute("aria-label"), "Autres commandes");
  assert.equal(plus.getAttribute("aria-controls"), autres.id);
  assert.deepEqual([plus.getAttribute("aria-expanded"), autres.className], ["false", "combat-autres"]);
  assert.deepEqual(tous(autres, "button").map(texteDe), ["Nouveau combat"]);
  assert.equal(boutonDit(barre(ecran), "Fin de tour").parentNode.className, "combat-commandes");
  await cliquer(plus);
  assert.deepEqual([plus.getAttribute("aria-expanded"), autres.className], ["true", "combat-autres ouvert"]);
  await cliquer(plus);
  assert.deepEqual([plus.getAttribute("aria-expanded"), autres.className], ["false", "combat-autres"]);

  // Sur un grand écran, toutes les fiches des vivants sont ouvertes.
  const { ecran: large } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etroit: false });
  assert.deepEqual(ouvertes(large), ["pj1", "adv2", "adv3", "adv4"]);
});

// ─── Le journal qui sort de l'écran ─────────────────────────────────────────

dansUnePage("journal — « Copier » et « Télécharger » : inactifs avant le lancement ; l'en-tête, le texte, les fins de ligne, le nom du fichier", async (page) => {
  const presse = pressePapiers();
  const { ecran, telecharges } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), navigateur: presse.navigateur, des: desDe(scenario.gestes.slice(0, 1)) });
  const zone = un(ecran, ".combat-journal");
  const copier = boutonDit(zone, "Copier");
  const telecharger = boutonDit(zone, "Télécharger");
  await preparerLaReference(ecran);
  // Avant le lancement : ni en-tête ni nom de fichier ne s'écrivent, et les deux boutons le disent.
  for (const bouton of [copier, telecharger]) {
    assert.equal(inactif(bouton), true);
    assert.equal(raisonDe(ecran, bouton), JOURNAL_VIDE);
    await cliquer(bouton);
  }
  assert.deepEqual(presse.copies, []);
  assert.deepEqual(telecharges, []);

  await lancerLeCombat(ecran);
  for (const bouton of [copier, telecharger]) {
    assert.equal(inactif(bouton), false);
    assert.equal(bouton.hasAttribute("aria-describedby"), false);
  }
  assert.doesNotMatch(texteDe(zone), /le journal est vide/);
  await jouerLeGeste(ecran, scenario.gestes[0]);

  const enTete = ["Simulateur de combat — L'Atelier des Arpenteurs", "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)", "Personnages : Aubépine Crèmebrûlée", "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2", ""];
  const attendu = [...enTete, ...journalAttendu.slice(0, 3)];
  await cliquer(copier);
  assert.deepEqual(presse.copies, [attendu.join("\n")]);
  assert.equal(presse.copies[0].includes("\r"), false, "le texte copié est en fins de ligne simples");
  assert.match(texteDe(un(zone, ".combat-copie")), /^Journal copié\.$/);
  assert.equal(tous(zone, "textarea").length, 0);

  await cliquer(telecharger);
  assert.deepEqual(telecharges, [["combat-2026-10-12-21h30.txt", `${MARQUE_D_ORDRE}${attendu.join("\r\n")}`, "text/plain;charset=utf-8"]]);
  assert.equal(telecharges[0][1].replaceAll("\r\n", "").includes("\n"), false, "le fichier n'a que des fins de ligne de Windows");

  // Le retour de la copie s'efface dès qu'une ligne s'ajoute au journal.
  await cliquer(boutonDeCapacite(ecran, "Pas chassé [1]"));
  assert.match(texteDe(un(zone, ".combat-copie")), /^Journal copié\.$/, "un geste en cours n'y touche pas");
  await cliquer(boutonDit(un(corps(ecran), ".combat-arrivees"), "D4"));
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(un(zone, ".combat-copie").children.length, 0);
});

dansUnePage("journal — le presse-papiers qui refuse, ou qui manque : le texte se sélectionne dans un champ, pour une copie à la main", async (page) => {
  for (const navigateur of [pressePapiers({ refuse: true }).navigateur, {}]) {
    const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: magasinCombatMemoire(), navigateur });
    await preparerLaReference(ecran);
    await lancerLeCombat(ecran);
    const zone = un(ecran, ".combat-journal");
    // Le champ n'existe pas encore : la sélection se guette sur tous les champs du document.
    const prototype = Object.getPrototypeOf(zone);
    const selectionnes = [];
    const selectionner = prototype.select;
    prototype.select = function select() {
      selectionnes.push(this);
    };
    try {
      await cliquer(boutonDit(zone, "Copier"));
    } finally {
      prototype.select = selectionner;
    }
    const champ = un(zone, "textarea");
    assert.equal(champ.value, ["Simulateur de combat — L'Atelier des Arpenteurs", "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)", "Personnages : Aubépine Crèmebrûlée", "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2", "", ...journalAttendu.slice(0, 2)].join("\n"));
    assert.equal(champ.hasAttribute("readonly"), true);
    assert.deepEqual(selectionnes, [champ], "le texte est sélectionné");
    assert.equal(document.activeElement, champ);
    assert.match(texteDe(un(zone, `#${champ.getAttribute("aria-describedby")}`)), /^Copie refusée par le navigateur/);
    assert.doesNotMatch(texteDe(zone), /Journal copié/);
  }
});

dansUnePage("un nom hostile reste du texte : à l'écran, dans le journal, et sans son signe de sens dans ce qui sort", async (page) => {
  const HOSTILE = `<img src=x onerror=alert(1)>${RENVERSE} Chef`;
  const banque = structuredClone(BANQUE);
  banque.adversaires.find((adversaire) => adversaire.nom === "Chef de partie").nom = HOSTILE;
  const presse = pressePapiers();
  const { ecran, telecharges } = await ouvrirLEcran(page, { banque, magasin: magasinCombatMemoire(), navigateur: presse.navigateur, des: [1] });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(ecran, "<img", 1);
  poserSur(ecran, "adv2", "A1");
  await lancerLeCombat(ecran);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  const VISIBLE = "<img src=x onerror=alert(1)> Chef";
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), VISIBLE));
  await cliquer(deACliquer(ecran));

  // Rien du nom n'est devenu un élément, et le signe qui renverse l'écriture ne s'affiche nulle part.
  assert.equal(tous(ecran, "img").length, 0);
  assert.equal(tous(ecran, "[onerror]").length, 0);
  assert.equal(texteDe(un(fiche(ecran, "adv2"), ".combat-nom")), VISIBLE);
  assert.equal(jeton(ecran, VISIBLE).getAttribute("title"), VISIBLE);
  assert.equal(texteDe(ecran).includes(RENVERSE), false);
  for (const noeud of ecran.descendants()) {
    for (const nom of ["title", "aria-label"]) assert.equal((noeud.getAttribute(nom) ?? "").includes(RENVERSE), false, `${nom} de ${noeud.tagName}`);
  }
  assert.match(journal(ecran).at(-1), /^Aubépine : Frappe contre <img\. .*manqué\.$/);

  // Ce qui sort de l'écran : le nom y est, sans son signe de sens.
  await cliquer(boutonDit(un(ecran, ".combat-journal"), "Copier"));
  await cliquer(boutonDit(un(ecran, ".combat-journal"), "Télécharger"));
  for (const texte of [presse.copies[0], telecharges[0][1]]) {
    assert.ok(texte.includes(`Adversaires : ${VISIBLE}`), "le nom entier, écrit tel quel");
    assert.equal(texte.includes(RENVERSE), false, "sans le signe qui renverse l'écriture");
  }
  // « Fiche complète » le montre de même.
  await cliquer(repere(fiche(ecran, "adv2"), "fiche-complete"));
  assert.equal(tous(ecran, "img").length, 0);
  assert.equal(texteDe(tous(ecran, ".combat-panneau h2")[0]), `Fiche complète : ${VISIBLE}`);
});

// ─── « Nouveau combat », « Fiche complète », « Oublier » ────────────────────

dansUnePage("« Nouveau combat » — la confirmation dans la page ; « Annuler » ne touche à rien ; « Effacer » repart de zéro, à la révision suivante", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const avant = await lireLaBase(lieu);
  assert.equal(JSON.parse(avant.texte).evenements.length, 1);
  // La région d'annonce quitte la page avec le panneau d'action : on la tient ici pour la relire.
  const regionDAnnonce = un(ecran, "p.combat-annonce");
  assert.match(texteDe(regionDAnnonce), /^Combat lancé : 1 personnage contre 3 adversaires\./);

  const autres = un(barre(ecran), "div.combat-autres");
  const nouveau = boutonDit(autres, "Nouveau combat");
  assert.equal(tous(ecran, ".confirmation").length, 0);
  await cliquer(nouveau);
  // La question se pose dans la page, à la place du bouton ; rien n'est encore effacé.
  const question = un(autres, ".confirmation");
  assert.equal(question.getAttribute("role"), "group");
  assert.equal(texteDe(un(question, "p")), QUESTION);
  assert.equal(un(question, "p").id, question.getAttribute("aria-labelledby"), "la question est le nom du groupe : un lecteur d'écran la dit");
  assert.deepEqual(tous(autres, "button").map(texteDe), ["Effacer", "Annuler"]);
  assert.equal(document.activeElement, boutonDit(autres, "Annuler"), "le focus va au choix sans risque");
  assert.equal(autres.className, "combat-autres ouvert", "sur un téléphone, la question se voit");
  assert.equal(journal(ecran).length, 2);

  await cliquer(boutonDit(autres, "Annuler"));
  assert.equal(tous(ecran, ".confirmation").length, 0);
  assert.equal(document.activeElement, nouveau);
  assert.equal(journal(ecran).length, 2);
  assert.equal(fiches(ecran).length, 4);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");

  await cliquer(nouveau);
  await cliquer(boutonDit(autres, "Effacer"));
  // Tout repart de zéro : la préparation, aucun protagoniste, un journal vide.
  assert.equal(tous(ecran, ".confirmation").length, 0);
  assert.equal(etatDuCombat(ecran), "Préparation");
  assert.deepEqual(fiches(ecran), []);
  assert.deepEqual(jetons(ecran), {});
  assert.deepEqual(journal(ecran), []);
  assert.equal(texteDe(regionDAnnonce), "", "la région d'annonce ne redit rien du combat d'avant");
  assert.equal(regionDAnnonce.isConnected, false);
  assert.deepEqual(un(ecran, ".combat-cadre").children.map((noeud) => noeud.className), ["combat-plateau", "combat-preparation", "combat-camps"]);
  assert.equal(document.activeElement, un(ecran, "h1"));
  assert.equal(inactif(boutonDit(un(ecran, ".combat-journal"), "Copier")), true);
  // La base garde le combat vide, à une révision plus haute : elle ne redescend jamais.
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const apres = await lireLaBase(lieu);
  assert.ok(apres.revision > avant.revision, `${apres.revision} > ${avant.revision}`);
  const contenu = JSON.parse(apres.texte);
  assert.deepEqual([contenu.miseEnPlace.protagonistes, contenu.evenements], [[], []]);
  // Le combat neuf se joue : un autre lancement s'annonce.
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  await lancerLeCombat(ecran);
  assert.equal(annonce(ecran), "Combat lancé : 1 personnage contre 1 adversaire. Les PJ commencent. — Tour 1 · camp des PJ —");
});

dansUnePage("« Fiche complète » — le personnage et l'adversaire, d'après leur photographie ; « Fermer » rend le focus ; la banque qui a changé se dit", async (page) => {
  const magasin = magasinCombatMemoire();
  // Une rencontre est en préparation sur l'écran Rencontre : la fiche complète ne doit pas y toucher.
  assert.equal(rencontre.ajouter(BANQUE, "Plongeur"), true);
  const { ecran } = await ouvrirLEcran(page, { magasin });
  await preparerLaReference(ecran);
  const panneau = un(ecran, "section.combat-panneau");
  assert.equal(panneau.getAttribute("aria-label"), "Fiche complète");
  assert.equal(panneau.children.length, 0);

  // Le personnage : sa vue lecture, calculée sur le personnage photographié.
  await cliquer(repere(fiche(ecran, "pj1"), "fiche-complete"));
  assert.equal(texteDe(tous(panneau, "h2")[0]), "Fiche complète : Aubépine Crèmebrûlée");
  assert.equal(document.activeElement, tous(panneau, "h2")[0], "le focus va au titre du panneau");
  assert.equal(tous(panneau, "h1").length, 0, "un seul titre de premier niveau dans la page");
  assert.equal(tous(panneau, ".lecture").length, 1);
  assert.equal(texteDe(un(panneau, ".lecture-titre")), "Aubépine Crèmebrûlée");
  assert.doesNotMatch(texteDe(panneau), /La banque a changé/);
  await cliquer(boutonDit(panneau, "Fermer"));
  assert.equal(panneau.children.length, 0);
  assert.equal(document.activeElement, repere(fiche(ecran, "pj1"), "fiche-complete"), "le focus revient au bouton");

  // L'adversaire : sa carte, avec son numéro d'exemplaire.
  await cliquer(repere(fiche(ecran, "adv4"), "fiche-complete"));
  assert.equal(texteDe(tous(panneau, "h2")[0]), "Fiche complète : Marmiton de corvée n° 2");
  const carte = un(panneau, "article.carte-adversaire");
  assert.equal(texteDe(un(carte, ".carte-nom")), "Marmiton de corvée n° 2");
  assert.equal(tous(panneau, ".lecture").length, 0);
  assert.doesNotMatch(texteDe(panneau), /La banque a changé/);
  // La banque d'appoint de cette carte n'est pas passée par l'écran Rencontre : sa composition est entière.
  assert.equal(rencontre.exemplaires(BANQUE, "Plongeur"), 1);
  // Retirer le protagoniste ferme sa fiche.
  await cliquer(repere(fiche(ecran, "adv4"), "retirer"));
  assert.equal(panneau.children.length, 0);
  // Une fiche repliée : à « Fermer », c'est son en-tête qui reçoit le focus.
  await cliquer(repere(fiche(ecran, "adv2"), "fiche-complete"));
  fiche(ecran, "adv2").removeAttribute("open");
  await cliquer(boutonDit(panneau, "Fermer"));
  assert.equal(document.activeElement, un(fiche(ecran, "adv2"), "summary"));

  // La banque republiée, où le Chef de partie n'est plus : le combat ne bouge pas, sa carte se
  // calcule toujours de sa ligne photographiée, et la fiche dit qu'elle suit la banque du jour.
  const republiee = { ...BANQUE, publiee_le: "2026-11-02T09:00:00+01:00", adversaires: BANQUE.adversaires.filter((adversaire) => adversaire.nom !== "Chef de partie") };
  const { ecran: apres } = await ouvrirLEcran(page, { banque: republiee, magasin });
  assert.equal(tous(repere(apres, "adversaire"), "option").some((option) => texteDe(option).startsWith("Chef de partie")), false, "la banque du jour n'a plus cet adversaire");
  assert.deepEqual(fiches(apres), [
    ["pj1", "Aubépine Crèmebrûlée"],
    ["adv2", "Chef de partie"],
    ["adv3", "Marmiton de corvée"],
  ]);
  const panneauApres = un(apres, "section.combat-panneau");
  await cliquer(repere(fiche(apres, "pj1"), "fiche-complete"));
  assert.match(texteDe(panneauApres), /La banque a changé depuis l'ajout : cette fiche suit la banque du jour\./);
  assert.equal(texteDe(un(panneauApres, ".lecture-titre")), "Aubépine Crèmebrûlée");
  await cliquer(repere(fiche(apres, "adv2"), "fiche-complete"));
  assert.match(texteDe(panneauApres), /La banque a changé depuis l'ajout : cette fiche suit la banque du jour\./);
  assert.equal(texteDe(un(un(panneauApres, "article.carte-adversaire"), ".carte-nom")), "Chef de partie");
});

dansUnePage("« Fiche complète » — une photographie sans source le dit, sans rien inventer", async (page) => {
  const lieu = lieuEnMemoire();
  await poserEnBase(lieu, texteDuCombat(0, 3));
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  await cliquer(repere(fiche(ecran, "adv2"), "fiche-complete"));
  const panneau = un(ecran, "section.combat-panneau");
  assert.equal(texteDe(un(panneau, "h2")), "Fiche complète : Chef de partie");
  assert.equal(texteDe(un(panneau, "p.message")), "La fiche complète de ce protagoniste n'est pas disponible.");
  assert.equal(tous(panneau, ".carte-adversaire").length, 0);
});

dansUnePage("oublier() — le combat quitte la mémoire, l'écran d'avant ne répond plus, le combat chiffré reste ; rien en clair sur l'appareil", async (page) => {
  const lieu = lieuSimule();
  // Tout ce que l'appareil lit et écrit hors de la base du combat est noté.
  const stockage = simulerStockage();
  try {
    const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), des: desDe(scenario.gestes.slice(0, 1)) });
    await preparerLaReference(ecran);
    await lancerLeCombat(ecran);
    await jouerLeGeste(ecran, scenario.gestes[0]);
    await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

    // Rien en clair : la base ne garde que l'enveloppe, et rien n'est allé ailleurs.
    const enveloppe = await lieu.gardee();
    assert.deepEqual(Object.keys(enveloppe), ["mode", "format", "sel", "iterations", "iv", "chiffre", "revision", "enregistre_le"]);
    const ecrit = JSON.stringify(lieu.fabrique.contenu(NOM_BASE));
    for (const mot of ["Aubépine", "Marmiton", "Chef de partie", "Frappe", "Réduction", "evenements", "miseEnPlace"]) assert.equal(ecrit.includes(mot), false, `« ${mot} » en clair dans la base`);
    assert.ok((await lireLaBase(lieu)).texte.includes("Marmiton de corvée"), "le chiffré, lui, porte le combat");
    assert.deepEqual([stockage.lus, stockage.ecrits], [[], []], "ni localStorage ni sessionStorage ne sont touchés");

    // « Oublier le mot de passe » : la page appelle oublier().
    page.oublier();
    // L'écran encore affiché ne répond plus, et ne lève pas.
    await cliquer(boutonDit(barre(ecran), "Fin de tour"));
    await cliquer(repere(fiche(ecran, "pj1"), "fiche-complete"));
    assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
    assert.equal(un(ecran, "section.combat-panneau").children.length, 0);
    assert.deepEqual(await lieu.gardee(), enveloppe, "la base n'est pas touchée");

    // Sans la clé, le combat gardé ne se lit pas : rien ne revient en mémoire.
    const sansCle = await ouvrirLEcran(page, { magasin: await lieu.onglet(), secret: null });
    assert.deepEqual(fiches(sansCle.ecran), []);
    assert.equal(garde(sansCle.ecran), NE_SE_LIT_PLUS);
    page.oublier();
    // La clé ressaisie, il se reprend : la mémoire avait bien été vidée, et le chiffré était resté.
    const revenue = await ouvrirLEcran(page, { magasin: await lieu.onglet(), pose: false });
    assert.equal(tous(revenue.ecran, ".attente").length, 1, "le combat n'était plus en mémoire");
    document.body.replaceChildren(revenue.ecran);
    await attendre(() => revenue.ecran.querySelector(".attente") === null, "la réouverture");
    assert.deepEqual(journal(revenue.ecran), journalAttendu.slice(0, 3));
    assert.deepEqual(await lieu.gardee(), enveloppe);
  } finally {
    stockage.retirer();
  }
});

// ─── Les états de l'enregistrement ──────────────────────────────────────────

dansUnePage("enregistrement — « Enregistrement… » puis « Combat gardé sur cet appareil » : deux textes sans rôle, qui ne passent jamais par la zone d'avis", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  // Une base vide, qui garde : rien à annoncer.
  assert.equal(garde(ecran), "Combat gardé sur cet appareil");
  assert.equal(avis(ecran).getAttribute("role"), "alert");
  assert.equal(avis(ecran).children.length, 0);
  for (const noeud of [un(ecran, "p.combat-etat"), un(ecran, "p.combat-garde")]) {
    assert.equal(noeud.hasAttribute("role"), false);
    assert.equal(noeud.hasAttribute("aria-live"), false);
  }
  assert.deepEqual(regions(ecran).map(([noeud]) => noeud.className), ["combat-avis"], "avant le lancement, la seule région est la zone d'avis");

  for (const ajouter of [() => ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée"), () => ajouterDesAdversaires(ecran, "Plongeur", 1), () => lancerLeCombat(ecran)]) {
    await ajouter();
    assert.equal(garde(ecran), "Enregistrement…");
    assert.equal(avis(ecran).children.length, 0);
    await attendre(() => garde(ecran) !== "Enregistrement…", "la fin de l'écriture");
    assert.equal(garde(ecran), "Combat gardé sur cet appareil");
    assert.equal(avis(ecran).children.length, 0);
  }
  // Le combat lancé, la région d'annonce des dés s'ajoute : c'est la seule région polie.
  assert.deepEqual(regions(ecran).filter(([noeud]) => noeud.getAttribute("aria-live") === "polite" || noeud.getAttribute("role") === "status").map(([noeud]) => noeud.className), ["combat-annonce"]);
  // Chaque écriture a monté la révision.
  assert.equal((await lireLaBase(lieu)).revision >= 3, true);
});

dansUnePage("enregistrement — sans IndexedDB : « Ce navigateur ne garde pas le combat », dit une fois ; la base ne s'ouvre qu'à la première visite", async () => {
  // Un navigateur sans IndexedDB du tout : l'écran ouvre son magasin lui-même, et retombe sur la mémoire.
  assert.equal(globalThis.indexedDB, undefined);
  const sansBase = await ouvrirLEcran(await pageNeuve());
  assert.equal(garde(sansBase.ecran), "Ce navigateur ne garde pas le combat");

  // Un navigateur qui interdit IndexedDB (navigation privée) : de même, et l'ouverture se compte.
  const fabrique = fabriqueIndexedDB();
  fabrique.pannes.ouvertureLeve = true;
  const stockage = simulerStockage({}, { indexedDB: fabrique });
  // Sans base, la barre ne dit pas quand une écriture finit : on guette le chiffrement, sa seule vraie attente.
  const subtil = crypto.subtle;
  const chiffrer = subtil.encrypt;
  const chiffrements = { enCours: 0, finis: 0 };
  subtil.encrypt = function encrypt(...parametres) {
    chiffrements.enCours += 1;
    return chiffrer.apply(subtil, parametres).finally(() => {
      chiffrements.enCours -= 1;
      chiffrements.finis += 1;
    });
  };
  try {
    // La page se charge sous l'espion : le module, à lui seul, n'ouvre rien.
    const page = await pageNeuve();
    assert.equal(stockage.ouvertures, 0, "charger le module n'ouvre rien");
    const { ecran } = await ouvrirLEcran(page);
    assert.equal(stockage.ouvertures, 1);
    assert.equal(garde(ecran), "Ce navigateur ne garde pas le combat");
    // L'état prévient d'une perte : il passe par la zone d'avis, sans bouton.
    assert.deepEqual(tous(avis(ecran), "p").map(texteDe), ["Ce navigateur ne garde pas le combat"]);
    assert.equal(tous(avis(ecran), "button").length, 0);
    // On joue, en mémoire ; l'avis s'efface au premier geste, la phrase reste dans la barre.
    // (Le compte des chiffrements repart d'ici : seul celui de ce geste est attendu plus bas.)
    chiffrements.finis = 0;
    await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
    assert.equal(avis(ecran).children.length, 0);
    assert.equal(garde(ecran), "Ce navigateur ne garde pas le combat");

    // Une autre visite : le combat est là, et l'état ne se redit pas.
    const { ecran: revenue } = await ouvrirLEcran(page);
    assert.deepEqual(fiches(revenue), [["pj1", "Aubépine Crèmebrûlée"]]);
    assert.equal(garde(revenue), "Ce navigateur ne garde pas le combat");
    assert.equal(avis(revenue).children.length, 0, "dit une fois, à son arrivée");
    assert.equal(stockage.ouvertures, 1, "une seule ouverture par page");

    // « Oublier le mot de passe », puis la clé ressaisie : le magasin de la page tenait le combat
    // chiffré, comme l'aurait tenu la base. Il se reprend, sans rouvrir quoi que ce soit.
    await attendre(() => chiffrements.finis > 0 && chiffrements.enCours === 0, "la fin de l'écriture");
    await laisserFiler(5);
    page.oublier();
    const apresOubli = await ouvrirLEcran(page, { pose: false });
    assert.equal(tous(apresOubli.ecran, ".attente").length, 1, "le combat n'était plus en mémoire");
    document.body.replaceChildren(apresOubli.ecran);
    await attendre(() => apresOubli.ecran.querySelector(".attente") === null, "la réouverture");
    assert.deepEqual(fiches(apresOubli.ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
    assert.equal(stockage.ouvertures, 1);
    assert.deepEqual([stockage.lus, stockage.ecrits], [[], []]);
    page.oublier();
  } finally {
    delete subtil.encrypt;
    stockage.retirer();
  }
  assert.equal(crypto.subtle.encrypt, chiffrer);
});

dansUnePage("enregistrement — une écriture qui échoue : le combat continue en mémoire, et l'écran le dit une fois", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const gardee = await lieu.gardee();
  // Le navigateur refuse l'écriture suivante (quota).
  lieu.fabrique.pannes.ecritureEchoue = true;
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  assert.equal(avis(ecran).children.length, 0, "rien à dire tant que l'écriture n'a pas échoué");
  await attendre(() => garde(ecran) === "Ce navigateur ne garde pas le combat", "l'échec de l'écriture");
  const dit = un(avis(ecran), "p");
  assert.equal(texteDe(dit), "Ce navigateur ne garde pas le combat");
  // Le combat continue : l'ajout est resté, et le suivant passe.
  assert.deepEqual(fiches(ecran).map(([id]) => id), ["pj1", "adv2"]);
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  assert.deepEqual(fiches(ecran).map(([id]) => id), ["pj1", "adv2", "adv3"]);
  assert.equal(avis(ecran).children.length, 0);
  assert.equal(garde(ecran), "Ce navigateur ne garde pas le combat");
  await laisserFiler(30);
  assert.deepEqual(await lieu.gardee(), gardee, "il reste en base l'écriture d'avant");
});

dansUnePage("enregistrement — « Combat ouvert ailleurs » : on ne joue plus, le panneau le dit ; « Reprendre le combat le plus récent »", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

  // Un autre onglet reprend le même combat, et y joue : Aubépine passe son tour.
  const gardien = creerGardien({ magasin: await lieu.onglet(), mode: "demo", secret: () => SECRET });
  const ailleurs = creerSeance({ gardien, des: desImposes([]), maintenant: SOIR, mode: "demo", accepter });
  assert.deepEqual(await ailleurs.ouvrir(), { issue: "repris" });
  assert.deepEqual(ailleurs.jouer({ type: "passer", qui: "pj1" }), {});
  await gardien.repos();
  const gardee = await lieu.gardee();

  // Ici, rien ne le dit encore : c'est l'écriture du geste suivant qui le découvre.
  assert.equal(avis(ecran).children.length, 0);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(avis(ecran).children.length, 0, "le clic est joué en mémoire");
  assert.equal(tous(corps(ecran), ".combat-cibles").length, 1);
  await attendre(() => garde(ecran) === "Combat ouvert ailleurs", "le refus de l'écriture");
  // L'état passe par la zone d'avis, avec son bouton ; le panneau d'action cède la place, et le dit.
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), ["Combat ouvert ailleurs"]);
  assert.deepEqual(tous(avis(ecran), "button").map(texteDe), ["Reprendre le combat le plus récent"]);
  assert.deepEqual(un(ecran, ".combat-cadre").children.map((noeud) => noeud.getAttribute("aria-label")), ["Carte", "Combat arrêté", null]);
  const bloc = un(ecran, ".combat-cadre").children[1];
  assert.equal(texteDe(un(bloc, "h2")), "Combat ouvert ailleurs");
  assert.deepEqual(tous(bloc, "button").map(texteDe), ["Reprendre le combat le plus récent"]);
  // « Nouveau combat » écraserait le combat de l'autre onglet : il est inactif, et le dit.
  const nouveau = boutonDit(barre(ecran), "Nouveau combat");
  assert.equal(inactif(nouveau), true);
  assert.equal(raisonDe(ecran, nouveau), "Combat ouvert ailleurs");
  await cliquer(nouveau);
  assert.equal(tous(ecran, ".confirmation").length, 0);

  // On ne joue plus : un clic est refusé, rien ne change, rien ne s'écrit, et l'avis ne se redit pas.
  const dit = un(avis(ecran), "p");
  const avant = journal(ecran);
  await cliquer(boutonDit(barre(ecran), "Fin de tour"));
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.deepEqual(journal(ecran), avant);
  assert.equal(un(avis(ecran), "p"), dit, "le même nœud : un lecteur d'écran ne l'entend qu'une fois");
  await laisserFiler(30);
  assert.deepEqual(await lieu.gardee(), gardee, "la base garde le combat de l'autre onglet");

  // « Reprendre » : l'écran montre le combat le plus récent, et l'on rejoue.
  await cliquer(boutonDit(bloc, "Reprendre le combat le plus récent"));
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la reprise");
  assert.equal(avis(ecran).children.length, 0);
  assert.deepEqual(un(ecran, ".combat-cadre").children.map((noeud) => noeud.className), ["combat-plateau", "combat-action", "combat-camps"]);
  assert.deepEqual(journal(ecran), [...journalAttendu.slice(0, 2), "Aubépine passe son tour.", "Fin du tour des PJ : ils retrouvent leurs actions.", "— Tour 1 · camp des adversaires —"]);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.equal(inactif(boutonDit(barre(ecran), "Nouveau combat")), false);
  await cliquer(boutonDit(corps(ecran), "Chef de partie"));
  assert.equal(titreDuPanneau(ecran), "Chef de partie joue — 1 action sur 1, souffle 7");
  // Et l'on écrit de nouveau : le geste suivant monte la révision de l'autre onglet.
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(garde(ecran), "Enregistrement…");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "l'écriture d'après la reprise");
  assert.equal(avis(ecran).children.length, 0);
  assert.equal((await lieu.gardee()).revision, gardee.revision + 1);
});

dansUnePage("enregistrement — le mot de passe changé, la donnée abîmée : « ne se lit plus », puis « Nouveau combat »", async () => {
  const abimer = (enveloppe) => ({ ...enveloppe, chiffre: `${enveloppe.chiffre.slice(0, -8)}AAAAAAA=` });
  for (const [cas, secret, retoucher] of [
    ["chiffré par une autre clé", AUTRE, (enveloppe) => enveloppe],
    ["abîmé", SECRET, abimer],
  ]) {
    const lieu = lieuSimule();
    const posee = await poserEnBase(lieu, texteDuCombat(2, 7), { revision: 7, secret, retoucher });
    const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet() });
    // Rien ne se reprend ; la phrase est dans la barre, passe par l'avis, et le panneau la dit avec son bouton.
    assert.equal(garde(ecran), NE_SE_LIT_PLUS, cas);
    assert.deepEqual(fiches(ecran), []);
    assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [NE_SE_LIT_PLUS]);
    assert.deepEqual(tous(avis(ecran), "button").map(texteDe), ["Nouveau combat"]);
    const bloc = un(ecran, ".combat-cadre").children[1];
    assert.equal(bloc.getAttribute("aria-label"), "Combat arrêté");
    assert.equal(texteDe(un(bloc, "h2")), NE_SE_LIT_PLUS);
    assert.equal(tous(ecran, ".combat-preparation").length, 0, "on ne prépare rien par-dessus un combat qui ne se lit pas");
    assert.deepEqual(await lieu.gardee(), posee);

    // « Nouveau combat », par le bouton de l'avis : la même confirmation, puis la préparation.
    await cliquer(boutonDit(avis(ecran), "Nouveau combat"));
    assert.equal(texteDe(un(un(ecran, ".confirmation"), "p")), QUESTION);
    assert.deepEqual(await lieu.gardee(), posee, "rien n'est écrit avant la confirmation");
    await cliquer(boutonDit(barre(ecran), "Effacer"));
    assert.equal(tous(ecran, ".combat-preparation").length, 1);
    assert.equal(avis(ecran).children.length, 0);
    await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "l'écriture du combat neuf");
    // Le combat neuf s'écrit au-dessus de l'ancien, avec la clé du jour.
    const neuf = await lireLaBase(lieu);
    assert.equal(neuf.revision, 8, cas);
    assert.deepEqual(JSON.parse(neuf.texte).evenements, []);
    await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
    assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
  }
});

dansUnePage("enregistrement — une version plus récente de l'Atelier : rien ne s'écrit ; une autre version du simulateur : « Nouveau combat »", async () => {
  // L'enveloppe d'un format à venir, une clé de plus : ce n'est pas une donnée abîmée.
  const RECENT = "Ce combat vient d'une version plus récente de l'Atelier : rechargez la page.";
  const lieu = lieuSimule();
  const posee = await poserEnBase(lieu, texteDuCombat(2, 3), { retoucher: (enveloppe) => ({ ...enveloppe, format: 2, nouveaute: true }) });
  const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet() });
  assert.equal(garde(ecran), RECENT);
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [RECENT]);
  assert.equal(tous(avis(ecran), "button").length, 0, "aucun bouton : il faut recharger");
  const bloc = un(ecran, ".combat-cadre").children[1];
  assert.equal(texteDe(un(bloc, "h2")), RECENT);
  assert.equal(tous(bloc, "button").length, 0);
  const nouveau = boutonDit(barre(ecran), "Nouveau combat");
  assert.equal(inactif(nouveau), true);
  assert.equal(raisonDe(ecran, nouveau), RECENT);
  await cliquer(nouveau);
  assert.equal(tous(ecran, ".confirmation").length, 0);
  await laisserFiler(30);
  assert.deepEqual(await lieu.gardee(), posee, "le combat plus récent n'est pas écrasé");

  // Un contenu d'une autre version des règles : il se dit, ne se rejoue pas, et se remplace.
  const AUTRE_VERSION = "Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas.";
  const autre = lieuSimule();
  await poserEnBase(autre, texteDuCombat(2, 3, (contenu) => ({ ...contenu, regles: 2, effets: [] })));
  const { ecran: second } = await ouvrirLEcran(await pageNeuve(), { magasin: await autre.onglet() });
  assert.equal(garde(second), AUTRE_VERSION);
  assert.deepEqual(tous(avis(second), "p").map(texteDe), [AUTRE_VERSION]);
  assert.deepEqual(tous(avis(second), "button").map(texteDe), ["Nouveau combat"]);
  assert.deepEqual(fiches(second), []);
  await cliquer(boutonDit(un(second, ".combat-cadre").children[1], "Nouveau combat"));
  await cliquer(boutonDit(barre(second), "Effacer"));
  await attendre(() => garde(second) === PHRASES_DE_GARDE.garde, "l'écriture du combat neuf");
  assert.equal((await lireLaBase(autre)).revision, 4);
  assert.equal(tous(second, ".combat-preparation").length, 1);
});

dansUnePage("enregistrement — sans clé : le combat vit en mémoire, rien ne se lit ni ne s'écrit ; la phrase dépend de ce que la base garde", async () => {
  // La banque est ouverte, mais la clé de table n'est plus en mémoire (le mot de passe a changé pendant la visite).
  const SANS_CLE = "Combat non gardé : le mot de passe de table a changé.";
  const vide = lieuSimule();
  const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: await vide.onglet(), secret: null });
  assert.equal(garde(ecran), SANS_CLE);
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [SANS_CLE]);
  assert.equal(tous(avis(ecran), "button").length, 0);
  // On joue quand même, en mémoire.
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
  assert.equal(avis(ecran).children.length, 0, "dit une fois");
  assert.equal(garde(ecran), SANS_CLE);
  await laisserFiler(30);
  assert.equal(await vide.gardee(), null, "rien ne s'écrit sans clé");

  // Avec un combat gardé, que l'on ne peut pas lire : la phrase du combat qui ne se lit plus, sans bouton, et il n'est pas écrasé.
  const pleine = lieuSimule();
  const posee = await poserEnBase(pleine, texteDuCombat(2, 3));
  const { ecran: second } = await ouvrirLEcran(await pageNeuve(), { magasin: await pleine.onglet(), secret: null });
  assert.equal(garde(second), NE_SE_LIT_PLUS);
  assert.deepEqual(tous(avis(second), "p").map(texteDe), [NE_SE_LIT_PLUS]);
  assert.equal(tous(avis(second), "button").length, 0);
  assert.equal(tous(second, ".combat-preparation").length, 1, "la préparation reste : on joue en mémoire");
  await ajouterLePersonnage(second, "Aubépine Crèmebrûlée");
  assert.deepEqual(fiches(second), [["pj1", "Aubépine Crèmebrûlée"]]);
  await laisserFiler(30);
  assert.deepEqual(await pleine.gardee(), posee);
});
