// Contrôles de l'écran assemblé du simulateur de combat (SPECIFICATION.md,
// § 17 et § 11, domaine « Combat » ; § 7.2 pour l'enregistrement ; contrat du
// lot 4, groupe 2, § 9 et § 14 É5) : js/ecrans/combat.js, dans le document
// simulé.
//
// Les parties de l'écran ont chacune leurs contrôles, sur des vues écrites à
// la main. Ici tout est vrai : la banque de la démonstration, ses
// photographies, le moteur, la séance, le gardien et son chiffrement. Seuls
// sont simulés le document, les dés (imposés), l'heure, le presse-papiers, le
// téléchargement, la base de l'appareil et le fichier du personnage de
// démonstration. Le combat de référence fictif s'y joue du premier clic au
// dernier, par la bulle, et son journal se compare mot pour mot.
//
// Un clic s'y joue comme dans un navigateur : il donne le focus au bouton,
// et l'écran le voit d'abord en capture (le clic au-dehors de la bulle), puis
// le bouton. Le document simulé relève chaque focus et chaque scrollIntoView :
// l'écran ne fait jamais défiler la page de lui-même.
//
// Un contrôle déçu échoue en quelques secondes au plus, avec son message :
// chaque attente est bornée (attendre, auPlus), et les nœuds se comparent par
// identité (memeNoeud, focusSur), jamais par assert.equal, qui déroulerait la
// page entière dans son message (relecture du groupe 2, C-07).
//
// Chaque contrôle ouvre une page neuve (le module, rechargé), pour que la
// mémoire d'un combat ne passe pas de l'un à l'autre : c'est aussi ainsi que
// se joue un rechargement. Les clés se fabriquent à l'exécution : celle de la
// démonstration, de son mot de passe public, et une seconde, tirée au hasard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chiffrerRencontre, magasinRencontreMemoire } from "../js/adversaire/rencontre_gardee.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { indexer } from "../js/banque/consultation.js";
import { PHRASES_DE_GARDE, chiffrerCombat, creerGardien, dechiffrerCombat, magasinCombatIndexedDB, magasinCombatMemoire } from "../js/combat/enregistrement.js";
import { EVENEMENTS_ALERTE } from "../js/combat/regles.js";
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
const FICHIER_AUBEPINE = lire("essais/personnage_demo.arpenteur.json");
const AUBEPINE = lirePersonnage(FICHIER_AUBEPINE, { mode: "demo" }).personnage;
// Une autre clé de table : celle d'après un changement de mot de passe.
const AUTRE = await nouveauSecret(crypto.randomUUID());

// 12/10/2026 à 21 h 30, heure de l'appareil : l'heure du combat de référence.
const SOIR = () => new Date(2026, 9, 12, 21, 30);
// Le signe qui renverse le sens de l'écriture, fabriqué par son code : aucun
// signe invisible ne s'écrit dans les sources.
const RENVERSE = String.fromCodePoint(0x202e);
const MARQUE_D_ORDRE = String.fromCodePoint(0xfeff);
// Les signes de l'écran, par leur code.
const ANNULER_LE_DERNIER = `${String.fromCodePoint(0x21b6)} Annuler le dernier geste`;
const POINTS = String.fromCodePoint(0x2026);

const NE_SE_LIT_PLUS = "Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée).";
const QUESTION = "Effacer ce combat et son journal ?";
const JOURNAL_VIDE = "Le combat n'est pas lancé : le journal est vide.";
const PHRASE_DE_LA_ZONE = "Le jet se joue dans la bulle, à côté des jetons.";
const LIMITE = "Ce combat approche de sa limite (13 500 événements sur 15 000) : copiez ou téléchargez le journal ; au-delà, il faudra en commencer un nouveau.";

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

/**
 * L'étagère de l'appareil : elle donne à lire, compte ses lectures, peut se
 * faire attendre ; elle garde aussi ce qu'on lui confie (le personnage de
 * démonstration), et le relève.
 */
function etagereDe(personnages, { retard = null, garderLeve = null } = {}) {
  const journal = { lectures: 0, gardes: [] };
  const tenus = structuredClone(personnages);
  return {
    journal,
    async lister() {
      journal.lectures += 1;
      if (retard) await retard;
      return { personnages: structuredClone(tenus), illisibles: 0 };
    },
    listerNotes: async () => [],
    async lire(id) {
      const trouve = tenus.find((personnage) => personnage.id === id);
      return trouve ? structuredClone(trouve) : null;
    },
    async garder(personnage) {
      if (garderLeve) throw new Error(garderLeve);
      journal.gardes.push(personnage.id);
      const rang = tenus.findIndex((tenu) => tenu.id === personnage.id);
      if (rang >= 0) tenus[rang] = structuredClone(personnage);
      else tenus.push(structuredClone(personnage));
    },
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

/** Le fichier du personnage de démonstration, servi par un fetch simulé : chaque demande relevée. */
function serveur({ statut = 200, texte = FICHIER_AUBEPINE } = {}) {
  const demandes = [];
  return {
    demandes,
    fetch: async (adresse, init) => {
      demandes.push([adresse, init]);
      return new Response(texte, { status: statut });
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
const contenuDuCombat = (jusqua) => versContenu(scenario, PHOTOS_D_ESSAI, { jusqua }).contenu;
const texteDuCombat = (jusqua, revision, retoucher = (contenu) => contenu) => JSON.stringify(retoucher({ ...contenuDuCombat(jusqua), revision }));

/**
 * Un combat long qui n'écrit rien après son lancement : Aubépine ouvre sa
 * Frappe et revient, autant de fois qu'il faut pour compter « combien »
 * événements, lancement compris.
 */
function texteDuLongCombat(combien, revision = 3) {
  const [lancer, ouvrirLaFrappe] = contenuDuCombat(1).evenements;
  assert.deepEqual([lancer.type, ouvrirLaFrappe.type], ["lancer", "capacite"]);
  const allerRetour = Array.from({ length: combien - 1 }, (_rien, rang) => (rang % 2 === 0 ? ouvrirLaFrappe : { type: "revenir" }));
  return JSON.stringify({ ...contenuDuCombat(0), evenements: [lancer, ...allerRetour], revision });
}

const ATTENTE_MAX = 5000;
/** Attend qu'une condition soit vraie : une écriture qui finit, une lecture qui revient. */
async function attendre(condition, quoi) {
  // Bornée au temps, non au nombre d'essais : une minuterie de 2 ms en dure une quinzaine sous Windows, et
  // 3 000 essais y faisaient 47 s par attente déçue. Ce qu'on attend ici arrive en quelques millisecondes.
  const limite = Date.now() + ATTENTE_MAX;
  do {
    if (condition()) return;
    await laisserFiler(2);
  } while (Date.now() < limite);
  if (condition()) return;
  assert.fail(`toujours pas : ${quoi}`);
}

/** Attend une promesse (un clic, une écriture), au plus ATTENTE_MAX ms : passé ce temps, le contrôle échoue, avec son message. */
async function auPlus(promesse, quoi) {
  let minuterie = null;
  const delai = new Promise((_tenue, rompue) => {
    minuterie = setTimeout(() => rompue(new assert.AssertionError({ message: `toujours pas, après ${ATTENTE_MAX} ms : ${quoi}` })), ATTENTE_MAX);
  });
  try {
    return await Promise.race([promesse, delai]);
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Ouvre l'écran dans le document simulé, comme le fait js/application.js, et
 * attend que le combat soit ouvert. « des » : les valeurs qui tomberont, dans
 * l'ordre, ou une source déjà faite. « etroit » : la largeur demandée (un
 * booléen, ou une fonction relue à chaque demande). Les autres options sont
 * des services passés tels quels (fenetre, tient, surveiller, minuteur,
 * rendreLaMain, fetch). Rend l'écran et ce que le contrôle peut observer :
 * les téléchargements demandés, la source de dés, l'étagère.
 */
async function ouvrirLEcran(
  page,
  {
    banque = BANQUE,
    secret = SECRET,
    magasin,
    des = [],
    personnages = [AUBEPINE],
    etagere = etagereDe(personnages),
    depot = null,
    etroit = false,
    navigateur = pressePapiers().navigateur,
    horloge = SOIR,
    pose = true,
    magasinRencontre = magasinRencontreMemoire(),
    ...autres
  } = {},
) {
  const source = Array.isArray(des) ? desImposes(des) : des;
  const telecharges = [];
  // Les largeurs que l'écran demande : il n'a pas d'autre moyen de savoir s'il est sur un téléphone.
  const requetes = new Set();
  const contexte = { etat: { mode: "demo", banque, index: indexDe(banque), secret, etagere, depot } };
  const services = { telecharger: (...parametres) => telecharges.push(parametres), ...autres };
  // « des: null », « navigateur: null », « horloge: null », « etroit: null », « magasinRencontre: null » : aucun service de ce nom, comme dans la page.
  if (etroit !== null) services.media = (requete) => (requetes.add(requete), typeof etroit === "function" ? etroit() : etroit);
  if (navigateur !== null) services.navigateur = navigateur;
  if (horloge !== null) services.maintenant = horloge;
  if (source !== null) services.des = source;
  if (magasin !== undefined) services.magasin = magasin;
  if (magasinRencontre !== null) services.magasinRencontre = magasinRencontre;
  const ecran = page.afficher(contexte, services);
  if (pose) {
    document.body.replaceChildren(ecran);
    await attendre(() => ecran.querySelector(".attente") === null, "l'ouverture du combat");
    await attendre(() => !texteDe(ecran).includes("Lecture des personnages en ligne"), "la lecture des personnages");
  }
  return { ecran, contexte, services, des: source, telecharges, etagere, requetes };
}

/** Joue un contrôle dans un document simulé, la rencontre oubliée, puis range tout. focusFidele : focus() y déclenche blur et focus. */
function dansUnePage(titre, corps, { focusFidele = false } = {}) {
  test(titre, async () => {
    const retirer = installerDom({ focusFidele });
    // La rencontre vit dans la mémoire de son module : elle repart de zéro.
    rencontre.oublier();
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
const cache = (noeud) => noeud.hasAttribute("hidden");
/** L'écran qui porte un nœud : section.combat. */
const ecranDe = (noeud) => {
  for (let courant = noeud; courant; courant = courant.parentNode) if (courant.tagName === "SECTION" && courant.className.split(" ").includes("combat")) return courant;
  return null;
};
/**
 * Un clic, comme dans un navigateur : le bouton prend le focus (Chromium et
 * Firefox le donnent au bouton cliqué), l'écran voit le clic en capture, puis
 * le bouton le reçoit.
 */
const cliquer = async (bouton) => {
  assert.ok(bouton, "le bouton à cliquer existe");
  globalThis.document.activeElement = bouton;
  const ecran = ecranDe(bouton);
  if (ecran) await auPlus(Promise.all(ecran.declencher("click", { target: bouton })), "la fin du clic, vu en capture");
  await auPlus(Promise.all(bouton.click()), `la fin du clic sur « ${texteDe(bouton)} »`);
};
/** Le même clic, sans attendre ce qu'il lance : « Ajouter le personnage de démonstration » attend la réponse à sa question. */
const cliquerSansAttendre = (bouton) => {
  globalThis.document.activeElement = bouton;
  const ecran = ecranDe(bouton);
  if (ecran) ecran.declencher("click", { target: bouton });
  bouton.click();
};
/** Un clic sur ce qui n'est pas un bouton (un fond, un titre) : seul l'écran, en capture, le voit. */
const cliquerSur = (ecran, noeud) => Promise.all(ecran.declencher("click", { target: noeud }));
/** Échap, là où est le focus ; rend vrai si l'écran l'a pris. */
function echap(ecran) {
  let pris = false;
  ecran.declencher("keydown", {
    key: "Escape",
    target: globalThis.document.activeElement,
    preventDefault() {
      pris = true;
    },
  });
  return pris;
}
function boutonOu(noeud, convient, quoi) {
  const trouves = tous(noeud, "button").filter(convient);
  assert.equal(trouves.length, 1, `un seul bouton ${quoi}, trouvé ${trouves.length} parmi : ${tous(noeud, "button").map(texteDe).join(" | ")}`);
  return trouves[0];
}
const boutonDit = (noeud, texte) => boutonOu(noeud, (b) => texteDe(b) === texte, `« ${texte} »`);
const boutonCommencant = (noeud, debut) => boutonOu(noeud, (b) => texteDe(b).startsWith(debut), `qui commence par « ${debut} »`);
const repere = (noeud, nom) => un(noeud, `[data-repere=${nom}]`);
/** La raison liée à un bouton inactif : son texte. Elle se voit : un texte caché ne dirait rien à qui regarde l'écran. */
const raisonDe = (ecran, bouton) => {
  const raison = un(ecran, `#${bouton.getAttribute("aria-describedby")}`);
  if (texteDe(raison) !== "") assert.equal(cache(raison), false, "la raison d'un bouton inactif se voit");
  return texteDe(raison);
};

const barre = (ecran) => un(ecran, "header.combat-barre");
const etatDuCombat = (ecran) => texteDe(un(ecran, "p.combat-etat"));
const garde = (ecran) => texteDe(un(ecran, "p.combat-garde"));
const avis = (ecran) => un(ecran, "div.combat-avis");
const cadre = (ecran) => un(ecran, ".combat-cadre");
/** Ce que porte le cadre, dans l'ordre : la première classe de chacun. */
const formeDuCadre = (ecran) => cadre(ecran).children.map((noeud) => noeud.className.split(" ")[0]);
/** La partie qui tient la place sous la carte : la zone, la préparation ou le bloc d'arrêt. */
const sousLaCarte = (ecran) => cadre(ecran).children[4];
const laBulle = (ecran) => un(ecran, "div.combat-bulle");
const onglet = (ecran) => un(ecran, "button.combat-onglet");
const bulleMontree = (ecran) => !cache(laBulle(ecran));
/** Le nom de la bulle : « Aubépine Crèmebrûlée : ses actions ». */
const nomDeLaBulle = (ecran) => laBulle(ecran).getAttribute("aria-label");
const zone = (ecran) => un(ecran, ".combat-action-corps");
/** Là où se joue l'action : la bulle (le volet sur un téléphone) quand elle est montrée, sinon la zone sous la carte. */
const corps = (ecran) => (bulleMontree(ecran) ? un(laBulle(ecran), ".combat-bulle-defile") : zone(ecran));
/** Le titre de la zone sous la carte : « Qui joue ? », le vainqueur, le jet sur un téléphone. */
const titreDeLaZone = (ecran) => texteDe(un(zone(ecran), "h2.combat-qui"));
/** L'en-tête de ce qui se joue : celui de la bulle, sinon celui du jet sous la carte. */
function enTete(ecran) {
  if (bulleMontree(ecran)) return [texteDe(un(laBulle(ecran), "h2.combat-bulle-titre")), texteDe(un(laBulle(ecran), "p.combat-bulle-sous"))];
  return [titreDeLaZone(ecran), ...tous(zone(ecran), "p.combat-sous").map(texteDe)];
}
const annonce = (ecran) => texteDe(un(ecran, "p.combat-annonce"));
const journal = (ecran) => tous(un(ecran, "ol.combat-lignes"), "li").map(texteDe);
const fiche = (ecran, id) => {
  const trouvee = tous(ecran, "details").find((noeud) => noeud.getAttribute("data-id") === id);
  assert.ok(trouvee, `la fiche de ${id}`);
  return trouvee;
};
/** Ce qui suit la fiche avant le lancement, hors du volet : le groupe du champ « Case » et de « Retirer ». */
const groupe = (ecran, id) => {
  const trouve = tous(ecran, ".combat-fiche-avant").find((noeud) => noeud.getAttribute("data-fiche") === id);
  assert.ok(trouve, `le groupe « Case » et « Retirer » de ${id}`);
  return trouve;
};
const fiches = (ecran) => tous(ecran, "details").map((noeud) => [noeud.getAttribute("data-id"), texteDe(un(noeud, ".combat-nom"))]);
const laCase = (ecran, nom) => {
  const trouvee = tous(ecran, ".combat-case").find((noeud) => noeud.getAttribute("data-case") === nom);
  assert.ok(trouvee, `la case ${nom}`);
  return trouvee;
};
/** Les jetons que la carte montre, par case : { D4: ["Marmiton 1", "Marmiton 2"] }. */
const jetons = (ecran) => Object.fromEntries(tous(ecran, ".combat-case").filter((noeud) => tous(noeud, ".combat-jeton").length > 0).map((noeud) => [noeud.getAttribute("data-case"), tous(noeud, ".combat-jeton").map((j) => texteDe(un(j, ".combat-nom-court")))]));
/** Le jeton d'un protagoniste, par la première ligne de son titre (la seconde dit sa raison, s'il en a une). */
const jeton = (ecran, entier) => boutonOu(un(ecran, ".combat-plateau"), (b) => (b.getAttribute("title") ?? "").split("\n")[0] === entier, `le jeton de ${entier}`);
/** Les régions qu'un lecteur d'écran dit d'elles-mêmes, et leur texte. */
const regions = (ecran) => [...ecran.descendants()].filter((noeud) => noeud.hasAttribute("aria-live") || ["status", "alert", "log"].includes(noeud.getAttribute("role"))).map((noeud) => [noeud, texteDe(noeud)]);
/** Les focus posés depuis un relevé, qui n'ont pas demandé à ne pas défiler : leur balise. */
const focusQuiDefilent = (depuis = 0) => document.focalisations.slice(depuis).filter(({ options }) => options?.preventScroll !== true).map(({ noeud }) => `${noeud.tagName}.${noeud.className}`);

// Les nœuds se comparent par identité, et se disent en peu de mots. Un assert.equal raté entre deux nœuds déroule
// toute la page dans son message, puis compare ligne à ligne ce qu'il a déroulé : mesuré sur l'écran en préparation,
// 15 à 25 s et 0,4 Mo de message pour un seul échec ; en plein combat, plus d'une minute et des Go (relecture du
// groupe 2, C-07 : les casses É5-18 et É5-28 attendaient sans borne). Ici, un échec se dit tout de suite, en une ligne.
/** Un nœud en peu de mots : sa balise, ses classes, le début de son texte. */
const decrire = (noeud) =>
  noeud === null || noeud === undefined ? String(noeud) : typeof noeud.tagName !== "string" ? JSON.stringify(String(noeud.textContent ?? noeud)) : `${noeud.tagName.toLowerCase()}${noeud.className ? `.${noeud.className.split(/\s+/).join(".")}` : ""} « ${texteDe(noeud).slice(0, 60)} »`;
/** Ce nœud-là, et nul autre. */
function memeNoeud(vu, attendu, quoi = "le nœud") {
  if (vu !== attendu) assert.fail(`${quoi} : ${decrire(vu)} au lieu de ${decrire(attendu)}`);
}
/** Un autre nœud que celui-là. */
function autreNoeud(vu, ancien, quoi = "le nœud") {
  if (vu === ancien) assert.fail(`${quoi} : toujours ${decrire(vu)}`);
}
/** Ces nœuds-là, dans cet ordre. */
function memesNoeuds(vus, attendus, quoi = "les nœuds") {
  const liste = [...vus];
  if (liste.length !== attendus.length || liste.some((noeud, rang) => noeud !== attendus[rang])) assert.fail(`${quoi} : [${liste.map(decrire).join(", ")}] au lieu de [${attendus.map(decrire).join(", ")}]`);
}
/** Le focus sur ce nœud-là. */
const focusSur = (attendu, quoi = "le focus") => memeNoeud(document.activeElement, attendu, quoi);
/** Les scrollIntoView demandés, chacun dit par son nœud et ses options. */
const defilementsDits = () => document.defilements.map(({ noeud, options }) => ({ noeud: decrire(noeud), options }));

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
  saisir(repere(groupe(ecran, id), "case"), nomDeCase, "change");
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

/** La ligne d'une capacité, par son libellé exact (« Frappe », « Pas chassé [1] »). */
const boutonDeCapacite = (ecran, libelle) => boutonOu(corps(ecran), (b) => b.className === "combat-capacite" && b.hasAttribute("data-ligne") && texteDe(b.children[0] ?? b) === libelle, `de la capacité « ${libelle} »`);
/** La première ligne active de la liste : la commande qui attend. */
const premiereLigne = (ecran) => tous(corps(ecran), "button.combat-capacite").find((b) => b.hasAttribute("data-ligne") && !inactif(b)) ?? null;

/** Le dé qui attend son clic, ou null. */
const deACliquer = (ecran) => tous(corps(ecran), "button.combat-de").find((b) => !inactif(b)) ?? null;

/** La saisie dont le bouton porte ce texte : ses champs (le nombre, puis la raison s'il y en a une), et son bouton. */
function saisieDuPanneau(ecran, action) {
  const bouton = boutonOu(corps(ecran), (b) => b.className === "bouton secondaire" && texteDe(b) === action, `de la saisie « ${action} »`);
  return { bouton, champs: tous(bouton.parentNode, "input") };
}
const saisie = saisieDuPanneau;

/** Fait jouer un protagoniste : « Qui joue ? » s'il le propose, sinon « Jouer » sur sa fiche. La bulle s'ouvre sur ses actions. */
async function choisirQuiJoue(ecran, entier) {
  const nom = `${entier} : ses actions`;
  if (bulleMontree(ecran) && nomDeLaBulle(ecran) === nom) return;
  if (tous(zone(ecran), "h2.combat-qui").map(texteDe).includes("Qui joue ?")) await cliquer(boutonDit(zone(ecran), entier));
  else {
    // Un autre a encore la main : on en change par « Jouer », sur la fiche.
    const laFiche = tous(ecran, "details").find((noeud) => texteDe(un(noeud, ".combat-nom")) === entier);
    assert.ok(laFiche, `la fiche de ${entier}`);
    await cliquer(repere(laFiche, "jouer"));
  }
  assert.equal(bulleMontree(ecran), true, `la bulle de ${entier} est montrée`);
  assert.equal(nomDeLaBulle(ecran), nom);
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
    // La contre-attaque qui s'offre se laisse passer (lot 4.3).
    const laisser = choix.find((b) => texteDe(b) === "Laisser passer");
    if (exploser) {
      await cliquer(exploser);
    } else if (laisser) {
      await cliquer(laisser);
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
  // « Appliquer » les dégâts ; « Terminer » un manqué ou un jet de
  // caractéristique, qui ne clôt plus le geste de lui-même (lot 4.3).
  const appliquer = tous(corps(ecran), "button").find((b) => texteDe(b) === "Appliquer" || texteDe(b) === "Terminer");
  if (appliquer) await cliquer(appliquer);
  // La blessure se choisit après les dégâts, parmi les capacités du bloc de blessure.
  if (geste.blessure) await cliquer(boutonDit(un(corps(ecran), ".combat-blessure"), geste.blessure));
  return undefined;
}

/** Les dés d'un geste, dans l'ordre où l'écran les demande : la chaîne, puis les d20. */
const desDe = (gestes) => gestes.flatMap((geste) => [...(geste.des ?? []), ...(geste.localisation ?? [])]);

/** La fenêtre qui change de taille : l'écouteur « resize » que la bulle a posé, relevé. */
function guetterLaFenetre() {
  const avant = { ajouter: globalThis.addEventListener, retirer: globalThis.removeEventListener };
  const ecoutes = [];
  globalThis.addEventListener = (type, f) => ecoutes.push([type, f]);
  globalThis.removeEventListener = (type, f) => {
    const rang = ecoutes.findIndex(([t, g]) => t === type && g === f);
    if (rang >= 0) ecoutes.splice(rang, 1);
  };
  return {
    ecoutes,
    redimensionner(largeur) {
      globalThis.document.documentElement.clientWidth = largeur;
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

// ─── Le texte du module ─────────────────────────────────────────────────────

test("le module — un en-tête qui dit le pourquoi et le § 17 ; rien de ce que le site interdit", () => {
  const enTeteDuModule = SOURCE.slice(0, SOURCE.indexOf("import "));
  assert.match(enTeteDuModule, /^\/\/ L'écran du simulateur de combat/);
  assert.match(enTeteDuModule, /SPECIFICATION\.md, § 17/);
  assert.match(enTeteDuModule, /Pourquoi il existe/);
  assert.match(enTeteDuModule, /groupe 2, § 9/);

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
  // Au groupe 2, les parties neuves (contrat, § 1) : la bulle, le journal, la démonstration partagée, la rencontre gardée.
  for (const module of ["./combat_bulle.js", "./combat_journal.js", "./partage.js", "./personnages.js", "./rencontre.js"]) assert.match(SOURCE, new RegExp(`from "${module.replace(".", "\\.")}";`), module);
  assert.match(SOURCE, /import \{ garderRecu \} from "\.\/personnages\.js";/);
  assert.doesNotMatch(SOURCE, /vueLigne/, "vueLigne a disparu (contrat, § 8.7)");
  // Le clic au-dehors se voit en capture, sur l'écran ; Échap aussi.
  assert.match(SOURCE, /racine\.addEventListener\("click", \(evenement\) => auClicDansLaPage\(evenement\), true\);/);
  assert.match(SOURCE, /racine\.addEventListener\("keydown", /);
  // Ni « Intervenir… », ni palette, ni menu du clic droit : au groupe 3.
  assert.doesNotMatch(SOURCE, /Intervenir|contextmenu|palette/i);

  // Ni signe invisible, ni espace insécable ; des fins de ligne d'un seul genre.
  for (const code of [0xa0, 0x202f, 0xad, 0xfeff, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x21b6]) {
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
  memeNoeud(un(ecran, "h1"), h1, "le titre est le même nœud");
  focusSur(h1, "le focus n'a pas bougé");
  assert.equal(tous(ecran, "[role=status]").length, 0, "l'attente a quitté la page : elle ne côtoie pas la région d'annonce");
  assert.equal(tous(ecran, "[data-chargement]").length, 0);
  assert.equal(etatDuCombat(ecran), "Préparation");
  // L'arbre du contrat (§ 9.1), dans l'ordre du téléphone : la barre, la limite, l'aide, l'avis, la fiche complète, le cadre, le journal, puis la région polie.
  assert.deepEqual(ecran.children.map((noeud) => noeud.className), ["combat-barre", "combat-limite", "combat-aide", "combat-avis", "combat-panneau", "combat-cadre", "combat-journal", "combat-annonce"]);
  assert.equal(cache(un(ecran, "p.combat-limite")), true, "la limite est cachée tant qu'elle est vide");
  // La région polie est là dès le premier rendu, vide : un lecteur d'écran la connaît avant qu'elle parle.
  const region = un(ecran, "p.combat-annonce");
  assert.deepEqual([region.getAttribute("aria-live"), region.parentNode, region.childNodes.length], ["polite", ecran, 0]);
  // La barre, dans l'ordre du téléphone : l'état et les commandes sur une ligne, ce que « ⋯ » ouvre, puis l'enregistrement.
  assert.deepEqual(barre(ecran).children.map((noeud) => noeud.className || noeud.tagName), ["H1", "combat-etat", "combat-commandes", "combat-autres", "combat-garde"]);
  // Le journal est une région que son titre nomme ; le titre reçoit le focus sans entrer dans l'ordre du clavier.
  const zoneDuJournal = un(ecran, "section.combat-journal");
  const titreDuJournal = un(ecran, `#${zoneDuJournal.getAttribute("aria-labelledby")}`);
  assert.deepEqual([titreDuJournal.tagName, texteDe(titreDuJournal), titreDuJournal.getAttribute("tabindex")], ["H2", "Journal", "-1"]);
  assert.deepEqual(un(zoneDuJournal, ".combat-journal-tete").children.map((noeud) => texteDe(noeud)), ["Journal", "Copier", "Télécharger"]);
  // Sa hauteur est limitée et il défile : la liste de ses lignes s'atteint au clavier.
  const lignes = un(zoneDuJournal, "ol.combat-lignes");
  assert.deepEqual([lignes.getAttribute("tabindex"), lignes.getAttribute("aria-label")], ["0", "Journal du combat"]);
  // Le cadre : le bandeau, la carte, la bulle et son onglet juste après elle, la préparation, puis les camps.
  assert.deepEqual(formeDuCadre(ecran), ["combat-bandeau", "combat-plateau", "combat-bulle", "combat-onglet", "combat-preparation", "combat-camps"]);
  assert.deepEqual([cache(un(ecran, "div.combat-bandeau")), cache(laBulle(ecran)), cache(onglet(ecran))], [true, true, true], "avant le lancement, ni bandeau, ni bulle, ni onglet");
  assert.equal(laBulle(ecran).getAttribute("role"), "dialog");
  assert.equal(laBulle(ecran).hasAttribute("aria-modal"), false, "un dialogue non modal");
  assert.equal(tous(ecran, ".combat-case").length, 100);
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Un protagoniste ajouté se pose d'office/);
  // « Annuler le dernier geste » n'est pas montré avant le lancement.
  assert.equal(cache(un(barre(ecran), "button.combat-annuler-geste")), true);
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
  autreNoeud(revenue, ecran, "une visite, un nœud neuf");
  assert.deepEqual(fiches(revenue), [["pj1", "Aubépine Crèmebrûlée"]]);
  assert.equal(lectures, 1, "la base n'est lue qu'à l'ouverture");
  // L'écran d'avant ne répond plus : seule la dernière visite joue.
  await cliquer(repere(groupe(ecran, "pj1"), "retirer"));
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
    assert.equal(tous(ecran, "p.message").length, 0, "un oubli n'est pas un échec de l'ouverture : l'écran d'avant n'est plus touché");
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

dansUnePage("ouverture — un combat gardé de plus de mille événements : l'attente dure tout le rejeu, qui rend la main par tranches de mille", async (page) => {
  const lieu = lieuEnMemoire();
  await poserEnBase(lieu, texteDuLongCombat(2500));
  // Chaque tranche rend la main : le contrôle retient la deuxième, et regarde l'écran pendant ce temps.
  let tranches = 0;
  let lacher = null;
  const rendreLaMain = () => {
    tranches += 1;
    if (tranches !== 2) return Promise.resolve();
    return new Promise((resoudre) => {
      lacher = resoudre;
    });
  };
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), pose: false, rendreLaMain });
  document.body.replaceChildren(ecran);
  await attendre(() => lacher !== null, "la deuxième tranche du rejeu");
  assert.equal(texteDe(un(ecran, ".attente")), "Ouverture du combat…", "« Ouverture du combat… » pendant tout le rejeu");
  assert.equal(tous(ecran, ".combat-plateau").length, 0, "rien n'est installé avant la fin du rejeu");
  lacher();
  await attendre(() => ecran.querySelector(".attente") === null, "la fin du rejeu");
  assert.equal(tranches, 2, "2 500 événements : la main rendue ⌊2 500 / 1 000⌋ fois");
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 2), "rien n'est écrit après le lancement");
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
  assert.equal(repere(groupe(ecran, "adv4"), "case").getAttribute("aria-invalid"), "true");

  // « Retirer » renumérote : le Marmiton qui reste n'a plus de numéro.
  await cliquer(repere(groupe(ecran, "adv3"), "retirer"));
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
  // Le combat lancé, la préparation a laissé la place à la zone sous la carte, et les fiches n'ont plus ni champ ni « Retirer ».
  assert.deepEqual(formeDuCadre(ecran), ["combat-bandeau", "combat-plateau", "combat-bulle", "combat-onglet", "combat-action", "combat-camps"]);
  assert.equal(tous(ecran, "[data-repere=case]").length, 0);
  assert.equal(tous(ecran, "[data-repere=retirer]").length, 0);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  assert.deepEqual(tous(zone(ecran), "button").map(texteDe), ["Chef de partie", "Marmiton de corvée"]);
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
  assert.equal(repere(groupe(ecran, "pj1"), "case").value, "B2", "la fiche suit");
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "l'écran ne déplace pas le focus après une pose venue de la carte");
  assert.equal(cache(laBulle(ecran)), true, "avant le lancement, la bulle ne s'ouvre pas");

  // Trois jetons sur J1 : le « +1 » du téléphone ouvre la liste de la case, sous la préparation.
  const liste = un(un(ecran, ".combat-preparation"), ".combat-case-liste");
  assert.equal(liste.children.length, 0);
  const plus = un(laCase(ecran, "J1"), "button.combat-plus-etroit");
  assert.equal(texteDe(plus), "+1");
  assert.equal(tous(laCase(ecran, "J1"), "button.combat-plus-large").length, 0, "trois jetons se voient tous sur un grand écran");
  await cliquer(plus);
  assert.equal(texteDe(un(liste, "h3")), "Case J1");
  focusSur(un(liste, "h3"));
  assert.deepEqual(tous(liste, "button").map(texteDe), ["Marmiton de corvée n° 1", "Marmiton de corvée n° 2", "Marmiton de corvée n° 3", "Fermer"]);
  assert.equal(tous(laBulle(ecran), ".combat-case-liste").length, 0, "avant le lancement, la liste reste sous la préparation, jamais dans la bulle");
  // « Fermer » vide la liste et rend le focus au « +1 ».
  await cliquer(boutonDit(liste, "Fermer"));
  assert.equal(liste.children.length, 0);
  focusSur(plus);

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

dansUnePage("rencontre — vide, le bouton le dit et mène à l'écran Rencontre ; préparée, elle se pose d'un clic, à la suite ; un plafond refuse tout", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  const placer = () => repere(ecran, "rencontre");
  assert.equal(inactif(placer()), true);
  // La raison du complément (§ 5.2), dont « écran Rencontre » est un lien vers #/rencontre, jamais un bouton.
  assert.equal(raisonDe(ecran, placer()), "Composez d'abord une rencontre à l'écran Rencontre.");
  const lien = un(un(ecran, `#${placer().getAttribute("aria-describedby")}`), "a");
  assert.deepEqual([lien.getAttribute("href"), texteDe(lien)], ["#/rencontre", "écran Rencontre"]);
  await cliquer(placer());
  assert.deepEqual(fiches(ecran), []);

  // L'écran Rencontre compose, après l'ouverture de celui-ci : un Chef de partie, deux Marmitons de corvée.
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

dansUnePage("rencontre — une banque republiée, de mêmes noms, garde la rencontre composée : le bouton reste actif", async (page) => {
  assert.equal(rencontre.ajouter(BANQUE, "Marmiton de corvée"), true);
  // La banque republiée (ou rechargée) : un autre objet, les mêmes noms. Le bouton grisé de l'auteur venait de là.
  const republiee = { ...BANQUE, publiee_le: "2026-11-02T09:00:00+01:00" };
  const { ecran } = await ouvrirLEcran(page, { banque: republiee, magasin: magasinCombatMemoire() });
  assert.equal(inactif(repere(ecran, "rencontre")), false, "une banque republiée garde la rencontre");
  await cliquer(repere(ecran, "rencontre"));
  assert.deepEqual(fiches(ecran), [["adv1", "Marmiton de corvée"]]);
});

dansUnePage("rencontre — une composition déjà gardée sur l'appareil : lue sans que l'ouverture l'attende, elle rend le bouton actif", async (page) => {
  // La composition gardée, chiffrée par la clé de table, comme l'écran Rencontre l'aurait écrite.
  const magasinRencontre = magasinRencontreMemoire();
  await magasinRencontre.ecrire(await chiffrerRencontre([{ nom: "Chef de partie", nombre: 1 }, { nom: "Marmiton de corvée", nombre: 2 }], SECRET, { mode: "demo", maintenant: SOIR() }));
  let lacher;
  const retenue = new Promise((resoudre) => {
    lacher = resoudre;
  });
  const lent = { ...magasinRencontre, lire: async (mode) => (await retenue, magasinRencontre.lire(mode)) };
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), magasinRencontre: lent });
  // L'écran est ouvert : la lecture de la rencontre ne l'a pas retenu.
  assert.equal(etatDuCombat(ecran), "Préparation");
  assert.equal(inactif(repere(ecran, "rencontre")), true, "la lecture n'est pas finie");
  lacher();
  await attendre(() => !inactif(repere(ecran, "rencontre")), "la lecture de la composition gardée");
  await cliquer(repere(ecran, "rencontre"));
  assert.deepEqual(fiches(ecran), [
    ["adv1", "Chef de partie"],
    ["adv2", "Marmiton de corvée n° 1"],
    ["adv3", "Marmiton de corvée n° 2"],
  ]);
});

dansUnePage("rencontre — un adversaire qui ne s'ajoute pas reste hors du combat, les autres se posent, et l'écran dit lequel", async (page) => {
  const banque = structuredClone(BANQUE);
  banque.adversaires.push({ nom: "Commis égaré", types: "", localisation: "Corps(2)", actions: "", souffle: "3", attaque: "2", defense: "3", equipement: "", capacites: "" });
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

// ─── Le personnage de démonstration ─────────────────────────────────────────

dansUnePage("démonstration — « Ajouter le personnage de démonstration » : le fichier lu sans cache, la question sans défiler, gardé, la liste relue ; rien n'entre au combat", async (page) => {
  const site = serveur();
  const { ecran, etagere } = await ouvrirLEcran(page, { magasin: await lieuSimule().onglet(), fetch: site.fetch });
  assert.equal(etagere.journal.lectures, 1);
  const bloc = un(ecran, ".combat-preparation-demonstration");
  const bouton = repere(bloc, "ajouter-demonstration");
  assert.equal(texteDe(bouton), "Ajouter le personnage de démonstration");
  const question = un(bloc, ".combat-preparation-question");
  const focusAvant = document.focalisations.length;
  cliquerSansAttendre(bouton);
  // Le fichier de la démonstration, relu à chaque fois.
  await attendre(() => question.children.length > 0, "la question du doublon");
  assert.deepEqual(site.demandes, [["essais/personnage_demo.arpenteur.json", { cache: "no-store" }]]);
  // Aubépine est déjà sur l'appareil : la question s'ouvre sous le bouton, le focus sur « Annuler », sans défiler.
  assert.match(texteDe(question), /^Ce personnage est déjà sur cet appareil\./);
  assert.deepEqual(tous(question, "button").map(texteDe), ["Remplacer", "Garder les deux", "Annuler"]);
  focusSur(boutonDit(question, "Annuler"));
  assert.deepEqual(focusQuiDefilent(focusAvant), [], "la question prend le focus sans faire défiler la page");
  assert.deepEqual(defilementsDits(), []);

  // « Garder les deux » : un second exemplaire est gardé, sa phrase se dit sous le bouton, la liste se relit.
  await cliquer(boutonDit(question, "Garder les deux"));
  await attendre(() => tous(bloc, "p.combat-preparation-phrase").length === 1, "la phrase du personnage gardé");
  assert.equal(texteDe(un(bloc, "p.combat-preparation-phrase")), "Le personnage « Aubépine Crèmebrûlée » est sur cet appareil.");
  assert.equal(etagere.journal.gardes.length, 1);
  assert.notEqual(etagere.journal.gardes[0], AUBEPINE.id, "gardé sous un nouvel identifiant");
  await attendre(() => tous(repere(ecran, "personnage"), "option").length === 2, "la liste relue");
  assert.equal(etagere.journal.lectures, 2);
  memeNoeud(un(ecran, ".combat-preparation-question"), question, "la zone de la question est restée le même nœud");
  // Le personnage n'entre pas au combat d'office.
  assert.deepEqual(fiches(ecran), []);
  assert.deepEqual(jetons(ecran), {});
  assert.equal(avis(ecran).children.length, 0);

  // « Annuler » : rien n'est gardé, aucune phrase neuve.
  cliquerSansAttendre(bouton);
  await attendre(() => question.children.length > 0, "la seconde question");
  await cliquer(boutonDit(question, "Annuler"));
  await laisserFiler(10);
  assert.equal(etagere.journal.gardes.length, 1);
  assert.deepEqual(fiches(ecran), []);
});

dansUnePage("démonstration — un fichier introuvable (404), une étagère qui refuse : la zone d'avis le dit, rien n'est gardé", async (page) => {
  const absent = serveur({ statut: 404, texte: "introuvable" });
  const { ecran, etagere } = await ouvrirLEcran(page, { magasin: await lieuSimule().onglet(), fetch: absent.fetch, personnages: [] });
  cliquerSansAttendre(repere(ecran, "ajouter-demonstration"));
  await attendre(() => avis(ecran).children.length > 0, "l'avis du fichier introuvable");
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), ["Le personnage de démonstration est introuvable sur ce site."]);
  assert.deepEqual(etagere.journal.gardes, []);
  assert.equal(tous(ecran, "p.combat-preparation-phrase").length, 0);

  // Une étagère qui lève en gardant (quota) : la phrase de l'écran, avec la raison.
  const { ecran: second } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieuSimule().onglet(), fetch: serveur().fetch, etagere: etagereDe([], { garderLeve: "quota dépassé" }) });
  cliquerSansAttendre(repere(second, "ajouter-demonstration"));
  await attendre(() => avis(second).children.length > 0, "l'avis de l'étagère qui refuse");
  assert.deepEqual(tous(avis(second), "p").map(texteDe), ["Le personnage n'a pas pu être gardé : quota dépassé"]);
  assert.equal(tous(second, "p.combat-preparation-phrase").length, 0);
  assert.deepEqual(fiches(second), []);
});

dansUnePage("démonstration — sans question : le personnage absent de l'appareil s'y garde d'un clic, et se montre dans la liste ; il s'ajoute ensuite comme les autres", async (page) => {
  const { ecran, etagere } = await ouvrirLEcran(page, { magasin: await lieuSimule().onglet(), fetch: serveur().fetch, personnages: [] });
  assert.match(texteDe(un(ecran, ".combat-preparation")), /Aucun personnage enregistré à ajouter/);
  // Le bloc de la démonstration est là, même sans personnage à ajouter.
  cliquerSansAttendre(repere(ecran, "ajouter-demonstration"));
  await attendre(() => tous(ecran, "p.combat-preparation-phrase").length === 1, "la phrase du personnage gardé");
  assert.deepEqual(etagere.journal.gardes, [AUBEPINE.id]);
  await attendre(() => tous(ecran, "[data-repere=personnage]").length === 1, "la liste relue");
  assert.deepEqual(tous(repere(ecran, "personnage"), "option").map(texteDe), ["Aubépine Crèmebrûlée"]);
  assert.deepEqual(fiches(ecran), [], "rien n'entre au combat d'office");
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(fiches(ecran), [["pj1", "Aubépine Crèmebrûlée"]]);
});

// ─── Le combat ──────────────────────────────────────────────────────────────

dansUnePage("combat — le combat de référence, joué par la bulle du premier clic au dernier : la préparation, les tours, la mort, la fin, le journal mot pour mot, sans jamais défiler", async (page) => {
  const lieu = lieuSimule();
  const { ecran, des } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), des: desDe(scenario.gestes) });
  await preparerLaReference(ecran);
  assert.deepEqual(jetons(ecran), { C3: ["Aubépine"], D4: ["Marmiton 1", "Marmiton 2"], F6: ["Chef"] });
  assert.equal(tous(barre(ecran), "button").find((b) => texteDe(b) === "Fin de tour").hidden, true, "pas de « Fin de tour » avant le lancement");

  await lancerLeCombat(ecran);
  // Le lancement : l'état de la barre, « Qui joue ? », le focus sur la commande qui attend.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Les PJ jouent dans l'ordre de leur choix\./);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  focusSur(boutonDit(zone(ecran), "Aubépine Crèmebrûlée"));
  assert.equal(annonce(ecran), "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent. — Tour 1 · camp des PJ —");
  const finDeTour = boutonDit(barre(ecran), "Fin de tour");
  assert.equal(finDeTour.hidden, false);
  assert.equal(inactif(finDeTour), false);
  // Le bouton principal de la barre (mission § 10.3) : lui seul n'est pas « secondaire ».
  assert.equal(finDeTour.className, "bouton");
  assert.deepEqual(tous(barre(ecran), "button").filter((b) => b !== finDeTour).map((b) => b.className.split(" ").includes("secondaire")), [true, true, true]);
  // « Jouer » : sur la fiche du camp qui a la main, et sur elle seule.
  assert.deepEqual(tous(ecran, "[data-repere=jouer]").map((b) => b.getAttribute("aria-label")), ["Jouer : Aubépine Crèmebrûlée"]);

  // Le journal défile jusqu'à sa dernière ligne à chaque ligne qui s'ajoute.
  const lignes = un(ecran, "ol.combat-lignes");
  lignes.scrollHeight = 480;
  lignes.scrollTop = 0;
  const [premiereLigneDuJournal] = tous(lignes, "li");
  // Le groupe 1 n'a pas d'« Intervenir… » dans sa barre ; le groupe 2 y ajoute « Annuler le dernier geste ».
  assert.deepEqual(tous(barre(ecran), "button").map(texteDe), ["Fin de tour", "⋯", ANNULER_LE_DERNIER, "Nouveau combat"]);

  // Le premier geste, pas à pas : Aubépine frappe le Marmiton n° 1, dans la bulle.
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
        focusSur(deACliquer(ecran), "le focus va au dé suivant, dans la bulle");
        assert.equal(bulleMontree(ecran), true, "le jet se joue dans la bulle");
        assert.equal(texteDe(zone(ecran)), PHRASE_DE_LA_ZONE);
      }
      if (desCliques === 2) assert.equal(annonce(ecran), "2e dé : 9 et 3, on garde 3, échec. 1 réussite, A = 3, +1 contre l'armure (Réduction).");
      if (desCliques === 3) {
        assert.equal(annonce(ecran), "Localisation : 16, bras gauche.");
        focusSur(boutonDit(corps(ecran), "Appliquer"));
      }
    },
  });
  assert.equal(desCliques, 3, "deux dés de la chaîne, lancés deux fois chacun d'un seul clic, puis le d20");
  assert.equal(avis(ecran).children.length, 0, "ni « Enregistrement… » ni « Combat gardé » ne passent par la zone d'avis");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
  assert.equal(annonce(ecran), journalAttendu[2], "la fin d'un geste s'annonce par sa ligne");
  assert.equal(lignes.scrollTop, 480, "la dernière ligne reste visible");
  memeNoeud(tous(lignes, "li")[0], premiereLigneDuJournal, "les lignes déjà posées restent : seules les nouvelles s'ajoutent");
  // Aubépine peut encore agir : la bulle revient à sa liste, le focus sur la première ligne active.
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 1 sur 2 · souffle 10/10"]);
  focusSur(premiereLigne(ecran));
  assert.equal(inactif(finDeTour), false);
  assert.equal(raisonDe(ecran, finDeTour), "");
  // La fiche du Marmiton touché le montre.
  assert.match(texteDe(fiche(ecran, "adv3")), /11\/15/);

  // Le deuxième geste finit le tour : les adversaires prennent la main ; la bulle se ferme, le focus va au jeton d'Aubépine.
  await jouerLeGeste(ecran, scenario.gestes[1]);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Les adversaires jouent dans l'ordre de votre choix\./);
  assert.deepEqual(jetons(ecran), { D4: ["Aubépine", "Marmiton 1", "Marmiton 2"], F6: ["Chef"] });
  assert.equal(bulleMontree(ecran), false);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "le geste fini, la bulle fermée : le focus au jeton");
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
  // La mort : la fiche repliée, le compte du camp, la ligne du journal. La
  // case D4 porte quatre protagonistes et n'en montre que trois : les
  // vivants d'abord. Le mort est derrière « +1 » (vu dans un navigateur : il
  // tenait la place du Marmiton n° 2, qu'on pouvait encore cibler).
  assert.deepEqual(jetons(ecran).D4, ["Aubépine", "Chef", "Marmiton 2"]);
  assert.equal(tous(ecran, ".combat-jeton").filter((j) => j.className.split(" ").includes("mort")).length, 0);
  assert.equal(texteDe(un(ecran, ".combat-plus-large")), "+1");
  assert.ok(fiche(ecran, "adv3").className.split(" ").includes("morte"));
  assert.equal(fiche(ecran, "adv3").hasAttribute("open"), false, "la fiche d'un mort se replie");
  assert.equal(fiche(ecran, "adv4").hasAttribute("open"), true, "celle d'un vivant reste ouverte");
  assert.match(texteDe(fiche(ecran, "adv3")), /mort au tour 2/);
  assert.match(texteDe(un(ecran, ".combat-camp-adv h2")), /2 en vie sur 3/);
  // Au journal, seule la phrase de la mort est en évidence, pas la ligne entière : elle la finit, et la ligne se lit mot pour mot.
  const mortes = tous(lignes, ".combat-mort");
  assert.deepEqual(mortes.map((noeud) => [noeud.tagName, texteDe(noeud)]), [["SPAN", "Marmiton n° 1 meurt."]]);
  assert.equal(texteDe(mortes[0].parentNode), journalAttendu[11]);
  memeNoeud(mortes[0].parentNode.childNodes.at(-1), mortes[0], "le mort en dernier");
  assert.deepEqual(tous(lignes, "li").map((li) => li.className).filter((classe) => classe !== "" && classe !== "tour"), [], "aucune ligne n'est marquée en entier");
  // La liste de la case, dans la bulle d'Aubépine, qui peut encore agir : les morts viennent en dernier, comme sur la carte.
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  await cliquer(un(ecran, ".combat-plus-large"));
  const listeDeD4 = un(laBulle(ecran), ".combat-case-liste");
  assert.deepEqual(tous(listeDeD4, "button").map(texteDe), ["Aubépine Crèmebrûlée", "Chef de partie", "Marmiton de corvée n° 2", "Marmiton de corvée n° 1", "Fermer"]);
  assert.equal(laBulle(ecran).getAttribute("aria-labelledby"), un(listeDeD4, "h3").id, "la liste d'une case se nomme par son titre");
  await cliquer(boutonDit(listeDeD4, "Fermer"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions", "« Fermer » rend à la bulle ce qu'elle montrait");
  focusSur(premiereLigne(ecran));
  assert.deepEqual(tous(lignes, "li").filter((li) => li.className === "tour").map(texteDe), ["— Tour 1 · camp des PJ —", "— Tour 1 · camp des adversaires —", "— Tour 2 · camp des PJ —"]);

  // La suite, jusqu'au dernier dé.
  for (const geste of scenario.gestes.slice(6)) await jouerLeGeste(ecran, geste, { apresChaqueDe: seuleLAnnonce });
  assert.deepEqual(journal(ecran), journalAttendu);
  assert.ok(desAnnonces > 30, "plus de trente dés annoncés");
  assert.equal(avis(ecran).children.length, 0, "d'un bout à l'autre du combat, la zone d'avis n'a rien eu à dire");
  assert.deepEqual(des.reste(), [], "tous les dés du scénario sont tombés, et aucun autre");
  // D'un bout à l'autre, l'écran n'a jamais fait défiler la page : aucun scrollIntoView, chaque focus sans défiler.
  assert.deepEqual(defilementsDits(), [], "aucun scrollIntoView");
  assert.ok(document.focalisations.length > 40, `${document.focalisations.length} focus posés`);
  assert.deepEqual(focusQuiDefilent(), [], "chaque focus est posé sans faire défiler la page");

  // La fin : on ne joue plus, mais le journal se copie et se télécharge toujours.
  assert.equal(etatDuCombat(ecran), "Combat terminé");
  assert.equal(bulleMontree(ecran), false);
  assert.equal(titreDeLaZone(ecran), "Combat terminé : victoire des PJ.");
  assert.equal(tous(zone(ecran), "button").length, 0);
  assert.equal(finDeTour.hidden, true);
  assert.equal(tous(ecran, "[data-repere=jouer]").length, 0);
  assert.match(texteDe(un(ecran, "p.combat-aide")), /^Le combat est terminé\./);
  // Les morts se voient dès que la case a de la place : Aubépine, seule en vie, puis deux jetons barrés.
  assert.deepEqual(jetons(ecran).D4, ["Aubépine", "Chef", "Marmiton 1"]);
  const mort = jeton(ecran, "Marmiton de corvée n° 1");
  assert.ok(mort.className.split(" ").includes("mort"));
  assert.equal(inactif(mort), true);
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

  // Par son jeton : « choisie sur la carte » ; un clic sur la carte ne ferme pas la bulle, et le focus va à la commande qui attend.
  await cliquer(jeton(ecran, "Marmiton de corvée n° 2"));
  assert.equal(bulleMontree(ecran), true, "un clic dans la carte n'est pas un clic au-dehors");
  assert.deepEqual(cibleChoisie(), ["Marmiton de corvée n° 2"]);
  assert.deepEqual(origines(), [["choisie sur la carte", "combat-cibles"]]);
  assert.ok(jeton(ecran, "Marmiton de corvée n° 2").className.split(" ").includes("cible"));
  focusSur(deACliquer(ecran), "la cible choisie sur la carte : le focus au dé, dans la bulle");
  // Par son bouton : « choisie ici ».
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  assert.deepEqual(cibleChoisie(), ["Marmiton de corvée n° 1"]);
  assert.deepEqual(origines(), [["choisie ici", "combat-cibles"]]);
  // « Revenir » avant le premier dé : rien n'est dépensé, et l'origine ne suit pas le geste suivant.
  await cliquer(boutonDit(corps(ecran), "Revenir"));
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 2 sur 2 · souffle 10/10"]);
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.deepEqual(origines(), []);
  await cliquer(jeton(ecran, "Marmiton de corvée n° 1"));
  assert.deepEqual(origines(), [["choisie sur la carte", "combat-cibles"]]);
  assert.deepEqual(aucun.reste(), [], "aucun dé n'a été demandé");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

  // Un rechargement avant le premier dé : le geste est là, sa cible aussi, rien n'est payé ;
  // mais ni l'événement ni l'état ne disent d'où venait le clic. La bulle montre le jet, sans prendre le focus.
  const focusAvant = document.focalisations.length;
  const { ecran: rechargee, des: debut } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet(), des: [6, 9] });
  assert.equal(etatDuCombat(rechargee), "Tour 1 · camp des PJ");
  assert.deepEqual(enTete(rechargee), ["Frappe contre Marmiton de corvée n° 1", "Aubépine · action 1 sur 2 · souffle 10/10"]);
  assert.equal(document.focalisations.length, focusAvant, "une ouverture n'est pas une commande : le focus ne bouge pas");
  assert.deepEqual(ciblesChoisies(rechargee), ["Marmiton de corvée n° 1"]);
  assert.deepEqual(originesDe(rechargee), [], "après un rechargement, rien ne dit d'où venait la cible");
  // Le premier dé : le geste est payé. La rangée « Cible : » reste montrée, avec la seule cible choisie, qui ne se change plus. La page se recharge là.
  await cliquer(deACliquer(rechargee));
  assert.deepEqual(debut.reste(), []);
  assert.deepEqual(enTete(rechargee), ["Frappe contre Marmiton de corvée n° 1", "Aubépine · action 1 sur 2 · souffle 10/10"]);
  const pendantLeJet = tous(un(corps(rechargee), ".combat-cibles"), "button");
  assert.deepEqual(pendantLeJet.map((b) => [texteDe(b), b.getAttribute("aria-pressed"), inactif(b)]), [["Marmiton de corvée n° 1", "true", true]]);
  assert.equal(raisonDe(rechargee, pendantLeJet[0]), "Une action est en cours.");
  await cliquer(pendantLeJet[0]);
  assert.deepEqual(debut.reste(), []);
  assert.equal(avis(rechargee).children.length, 0, "le bouton inactif ne demande rien");
  await attendre(() => garde(rechargee) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");

  // La page neuve n'a que les dés qui restent à lancer : un dé déjà lancé qu'elle relancerait la ferait lever.
  const { ecran: reprise, des: suite } = await ouvrirLEcran(await pageNeuve(), { magasin: await lieu.onglet(), des: [8, 2, 16] });
  assert.deepEqual(enTete(reprise), ["Frappe contre Marmiton de corvée n° 1", "Aubépine · action 1 sur 2 · souffle 10/10"]);
  const chaine = tous(corps(reprise), "button.combat-de");
  assert.equal(inactif(chaine[0]), true, "le premier dé est lancé : il ne se clique plus");
  assert.match(chaine[0].getAttribute("aria-label"), /^1er dé : 7 .*réussi$/);
  memeNoeud(deACliquer(reprise), chaine[1], "c'est le deuxième dé qui attend");
  assert.deepEqual(journal(reprise), journalAttendu.slice(0, 2), "la ligne ne s'écrit qu'une fois le geste fini");
  assert.deepEqual(suite.reste(), [8, 2, 16], "ouvrir l'écran ne lance aucun dé");
  // Le geste se finit comme s'il n'avait pas été coupé.
  await cliquer(deACliquer(reprise));
  await cliquer(deACliquer(reprise));
  await cliquer(boutonDit(corps(reprise), "Appliquer"));
  assert.deepEqual(journal(reprise), journalAttendu.slice(0, 3));
  assert.deepEqual(suite.reste(), []);
});

dansUnePage("combat — sur un téléphone, la liste « +k » d'une case reste sous la carte : la commande du jeton, « choisie ici » ; un jeton sans choix ne fait rien ; « Fermer »", async (page) => {
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
  assert.deepEqual(enTete(ecran), ["Chef de partie", "actions restantes : 1 sur 1 · souffle 7/7"]);
  assert.equal(tous(fiche(ecran, "adv2"), "[data-repere=jouer]").length, 0, "celui qui joue n'a plus de « Jouer »");
  await cliquer(jeton(ecran, "Marmiton de corvée n° 2"));
  assert.deepEqual(enTete(ecran), ["Marmiton de corvée n° 2", "actions restantes : 1 sur 1 · souffle 5/5"]);
  // Aubépine, dont ce n'est pas le tour, ne se choisit pas : son jeton ne fait rien.
  assert.equal(inactif(jeton(ecran, "Aubépine Crèmebrûlée")), true);
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.deepEqual(enTete(ecran), ["Marmiton de corvée n° 2", "actions restantes : 1 sur 1 · souffle 5/5"]);
  // Revenir à « Qui joue ? » : le Marmiton n° 2 passe son tour.
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");

  // Rien n'est en cours : la liste choisit qui joue.
  await cliquer(plus());
  assert.equal(texteDe(un(liste, "h3")), "Case D4");
  assert.equal(bulleMontree(ecran), false, "sur un téléphone, la liste reste sous la carte");
  const dansLaListe = () => tous(liste, "button").map((b) => [texteDe(b), inactif(b)]);
  assert.deepEqual(dansLaListe(), [
    ["Aubépine Crèmebrûlée", true],
    ["Marmiton de corvée n° 1", false],
    ["Marmiton de corvée n° 2", true],
    ["Fermer", false],
  ]);
  // Le Marmiton n° 2 a joué : son bouton ne fait rien non plus.
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 2"));
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  // Aubépine ne joue pas pendant le tour des adversaires : son bouton ne fait rien.
  await cliquer(boutonDit(liste, "Aubépine Crèmebrûlée"));
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  assert.equal(liste.children.length, 5, "la liste reste ouverte");
  await cliquer(boutonDit(liste, "Marmiton de corvée n° 1"));
  assert.deepEqual(enTete(ecran), ["Marmiton de corvée n° 1", "actions restantes : 1 sur 1 · souffle 5/5"]);
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
  memesNoeuds(tous(corps(ecran), ".combat-origine"), [], "un jeton écarté ne se choisit pas");
  await cliquer(boutonDit(liste, "Aubépine Crèmebrûlée"));
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
  assert.equal(liste.children.length, 0);

  // « Fermer » vide la liste sans rien choisir, et rend le focus au « +1 ».
  await cliquer(plus());
  await cliquer(boutonDit(liste, "Fermer"));
  assert.equal(liste.children.length, 0);
  focusSur(plus());
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
});

dansUnePage("combat — ce que le combat de référence ne joue pas : une ligne par puissance, les réglages à la main, un refus du moteur, les dégâts directs, la face décalée, deux armes, sans arme, X", async (page) => {
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

  // La puissance : une ligne par puissance, chacune avec son coût ; ni + ni −.
  assert.equal(texteDe(boutonDeCapacite(ecran, "Flambage [2]")), "Flambage [2] 10 souffle");
  assert.equal(texteDe(boutonDeCapacite(ecran, "Flambage [1]")), "Flambage [1] 5 souffle");
  assert.equal(tous(laBulle(ecran), "button").filter((b) => /puissance/.test(b.getAttribute("aria-label") ?? "")).length, 0, "plus de boutons + et −");
  await cliquer(boutonDeCapacite(ecran, "Flambage [1]"));
  assert.match(texteDe(un(corps(ecran), ".combat-description")), /par 2\.$/);
  // Une capacité sans jet : sa cible est facultative, et « Confirmer » la paie.
  assert.equal(boutonDit(corps(ecran), "Sans cible").getAttribute("aria-pressed"), "true");
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(journal(ecran).at(-1), "Aubépine : Flambage [1] (5 souffle).");
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 1 sur 2 · souffle 5/10"]);

  // Les réglages à la main, avant le premier dé : le contexte du jet les montre.
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée"));
  await regler("Régler le modificateur", 2, "Inspiration");
  await regler("Régler les avantages", 1, "Minutie");
  const contexte = texteDe(un(corps(ecran), ".combat-contexte"));
  // Le dé nu, puis chaque modificateur avec sa source, une seule fois : « d10+3 » devant eux se lisait d10+3+3.
  assert.match(contexte, /Dé d10 \(Précision \d \+ Agilité \d\) \+1 \(Vif\) \+2 \(à la main : Inspiration\) · difficulté /);
  assert.doesNotMatch(contexte, /d10\+/);
  // Le pied du jet : le texte de la capacité, toujours, puis les réglages à la main tant qu'ils existent.
  assert.deepEqual(un(corps(ecran), ".combat-des").children.map((bloc) => bloc.className), ["combat-contexte", "combat-jet", "combat-assiste", "combat-reglages"]);
  // Le nombre des avantages porte sa cause : la main en est une.
  const cause = un(corps(ecran), "button.combat-cause");
  assert.equal(cause.getAttribute("aria-label"), "1 avantage : voir la cause");
  assert.ok(tous(un(corps(ecran), ".combat-cause-explication"), "p").map(texteDe).includes("À la main : Minutie."));
  for (let lance = 0; lance < 3; lance += 1) await cliquer(deACliquer(ecran));
  // Pendant le jet : plus de réglage, et la cible, choisie par son bouton, reste montrée avec son origine.
  assert.deepEqual(un(corps(ecran), ".combat-des").children.map((bloc) => bloc.className), ["combat-contexte", "combat-jet", "combat-assiste"]);
  assert.deepEqual(tous(un(corps(ecran), ".combat-cibles"), "button").map((b) => [texteDe(b), b.getAttribute("aria-pressed"), inactif(b)]), [["Marmiton de corvée", "true", true]]);
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
  // Trois réussites et un avantage encore là : le coup critique s'offre (lot 4.3). On garde C.
  assert.deepEqual(tous(un(corps(ecran), ".combat-jet"), ".combat-choix button").map(texteDe), ["Garder C = 20", "Tenter le critique"]);
  await cliquer(boutonDit(corps(ecran), "Garder C = 20"));
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

  // Le tour des adversaires. Le Homard furieux a deux armes : la capacité qu'elles donnent toutes deux a une ligne sous chacune.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  await choisirQuiJoue(ecran, "Homard furieux");
  assert.deepEqual(tous(corps(ecran), ".combat-groupe").map((groupeDeLignes) => [texteDe(un(groupeDeLignes, "h3")), tous(groupeDeLignes, "button").map((b) => texteDe(b.children[0] ?? b))]), [
    ["Pinces de homard", ["Frappe", "Choc sourd"]],
    ["Couteau d'office", ["Frappe", "Émincer", "Passer son tour"]],
  ]);
  await cliquer(boutonOu(tous(corps(ecran), ".combat-groupe")[0], (b) => texteDe(b).startsWith("Frappe"), "Frappe, par les pinces"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Aubépine Crèmebrûlée"));
  assert.deepEqual(enTete(ecran), ["Frappe contre Aubépine Crèmebrûlée", "Homard · action 1 sur 2 · souffle 4/4"]);
  assert.equal(texteDe(un(corps(ecran), "p.combat-defenseur")), "Aubépine lance sa défense · souffle 5/10");
  for (let lance = 0; lance < 3; lance += 1) await cliquer(deACliquer(ecran));
  // Aucun dégât : le geste attend « Terminer » (lot 4.3).
  await cliquer(boutonDit(corps(ecran), "Terminer"));
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
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 1 sur 2 · souffle 3/10"]);
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
  await auPlus(gardien.repos(), "la fin des écritures du gardien");

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
  await cliquer(boutonDit(corps(second), "Terminer"));
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
    // Le hasard décide de la suite : le dé réussit et la chaîne continue, ou il échoue et
    // l'attaque est manquée ; l'annonce dit le dé, puis, manqué, le bilan (le geste attend
    // « Terminer » depuis le lot 4.3).
    const dit = /^1er dé : (\d+) et (\d+), on garde (\d+), (?:réussi|échec\. Aucune réussite, manqué)\.$/.exec(annonce(ecran));
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

dansUnePage("téléphone — seule la fiche de qui joue est ouverte ; le menu « ⋯ » porte « Annuler le dernier geste » et « Nouveau combat »", async (page) => {
  const ouvertes = (ecran) => tous(ecran, "details").filter((noeud) => noeud.hasAttribute("open")).map((noeud) => noeud.getAttribute("data-id"));
  const { ecran, requetes } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), etroit: true });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  assert.deepEqual(ouvertes(ecran), [], "personne ne joue encore");
  // Qui joue se choisit par son jeton, comme par son nom ; le volet s'ouvre sur ses actions.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 2 sur 2 · souffle 10/10"]);
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
  assert.deepEqual(tous(autres, "button").map(texteDe), [ANNULER_LE_DERNIER, "Nouveau combat"]);
  assert.equal(boutonDit(barre(ecran), "Fin de tour").parentNode.className, "combat-commandes");
  // L'état, puis « Fin de tour » et « ⋯ », ce que « ⋯ » ouvre, puis l'enregistrement : l'ordre du document est celui du téléphone.
  assert.deepEqual(tous(un(barre(ecran), ".combat-commandes"), "button").map(texteDe), ["Fin de tour", "⋯"], "le menu n'est pas dans la rangée des commandes : l'ouvrir ne les déplace pas");
  assert.deepEqual(barre(ecran).children.map((noeud) => noeud.className || noeud.tagName), ["H1", "combat-etat", "combat-commandes", "combat-autres", "combat-garde"]);
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
  const zoneDuJournal = un(ecran, ".combat-journal");
  const copier = boutonDit(zoneDuJournal, "Copier");
  const telecharger = boutonDit(zoneDuJournal, "Télécharger");
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
  assert.doesNotMatch(texteDe(zoneDuJournal), /le journal est vide/);
  await jouerLeGeste(ecran, scenario.gestes[0]);

  const enTeteDuTexte = ["Simulateur de combat — L'Atelier des Arpenteurs", "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)", "Personnages : Aubépine Crèmebrûlée", "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2", ""];
  const attendu = [...enTeteDuTexte, ...journalAttendu.slice(0, 3)];
  await cliquer(copier);
  assert.deepEqual(presse.copies, [attendu.join("\n")]);
  assert.equal(presse.copies[0].includes("\r"), false, "le texte copié est en fins de ligne simples");
  assert.match(texteDe(un(zoneDuJournal, ".combat-copie")), /^Journal copié\.$/);
  assert.equal(tous(zoneDuJournal, "textarea").length, 0);
  // Le focus reste sur « Copier » : la phrase se dit par la seule région polie, que le dé suivant remplacera.
  assert.equal(annonce(ecran), "Journal copié.");
  assert.equal(regions(ecran).filter(([noeud]) => noeud.getAttribute("aria-live") === "polite" || noeud.getAttribute("role") === "status").length, 1);

  await cliquer(telecharger);
  assert.deepEqual(telecharges, [["combat-2026-10-12-21h30.txt", `${MARQUE_D_ORDRE}${attendu.join("\r\n")}`, "text/plain;charset=utf-8"]]);
  assert.equal(telecharges[0][1].replaceAll("\r\n", "").includes("\n"), false, "le fichier n'a que des fins de ligne de Windows");

  // Le retour de la copie s'efface dès qu'une ligne s'ajoute au journal.
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Pas chassé [1]"));
  assert.match(texteDe(un(zoneDuJournal, ".combat-copie")), /^Journal copié\.$/, "un geste en cours n'y touche pas");
  assert.equal(annonce(ecran), "Journal copié.", "tant que le combat n'a rien à dire");
  await cliquer(boutonDit(un(corps(ecran), ".combat-arrivees"), "D4"));
  await cliquer(boutonDit(corps(ecran), "Confirmer"));
  assert.equal(un(zoneDuJournal, ".combat-copie").children.length, 0);
  assert.match(annonce(ecran), /^Aubépine : Pas chassé \[1\], C3 → D4\./, "l'annonce suivante du combat la remplace");
});

dansUnePage("journal — le presse-papiers qui refuse, ou qui manque : le texte se sélectionne dans un champ, pour une copie à la main", async (page) => {
  for (const navigateur of [pressePapiers({ refuse: true }).navigateur, {}]) {
    const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: magasinCombatMemoire(), navigateur });
    await preparerLaReference(ecran);
    await lancerLeCombat(ecran);
    const zoneDuJournal = un(ecran, ".combat-journal");
    // Le champ n'existe pas encore : la sélection se guette sur tous les champs du document.
    const prototype = Object.getPrototypeOf(zoneDuJournal);
    const selectionnes = [];
    const selectionner = prototype.select;
    prototype.select = function select() {
      selectionnes.push(this);
    };
    try {
      await cliquer(boutonDit(zoneDuJournal, "Copier"));
    } finally {
      prototype.select = selectionner;
    }
    const champ = un(zoneDuJournal, "textarea");
    assert.equal(champ.value, ["Simulateur de combat — L'Atelier des Arpenteurs", "Combat lancé le 12/10/2026 à 21 h 30 (démonstration)", "Personnages : Aubépine Crèmebrûlée", "Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2", "", ...journalAttendu.slice(0, 2)].join("\n"));
    assert.equal(champ.hasAttribute("readonly"), true);
    assert.ok((champ.getAttribute("aria-label") ?? "").trim() !== "", "le champ a un nom");
    memesNoeuds(selectionnes, [champ], "le texte est sélectionné");
    focusSur(champ);
    assert.equal(document.focalisations.at(-1).options?.preventScroll, true, "sans défiler");
    assert.match(texteDe(un(zoneDuJournal, `#${champ.getAttribute("aria-describedby")}`)), /^Copie refusée par le navigateur/);
    assert.doesNotMatch(texteDe(zoneDuJournal), /Journal copié/);
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
  await cliquer(boutonDit(corps(ecran), "Terminer"));

  // Rien du nom n'est devenu un élément, et le signe qui renverse l'écriture ne s'affiche nulle part : ni au journal, ni au bandeau, ni dans la bulle.
  assert.equal(tous(ecran, "img").length, 0);
  assert.equal(tous(ecran, "[onerror]").length, 0);
  assert.equal(texteDe(un(fiche(ecran, "adv2"), ".combat-nom")), VISIBLE);
  assert.equal(jeton(ecran, VISIBLE).getAttribute("title"), VISIBLE);
  assert.equal(texteDe(ecran).includes(RENVERSE), false);
  for (const noeud of ecran.descendants()) {
    for (const nom of ["title", "aria-label"]) assert.equal((noeud.getAttribute(nom) ?? "").includes(RENVERSE), false, `${nom} de ${noeud.tagName}`);
  }
  assert.match(journal(ecran).at(-1), /^Aubépine : Frappe contre <img\. .*manqué\.$/);
  assert.match(texteDe(un(ecran, ".combat-bandeau-entier")), /^Aubépine : Frappe contre <img\. /);

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

test("journal — les segments neufs du lot 4.3 : une échéance et un geste du MJ se lisent comme la fin d'un tour ; qui intervient se nomme au milieu de la ligne, dans la couleur de son camp", async () => {
  const retirer = installerDom();
  try {
    const { ligneEnNoeuds } = await import("../js/ecrans/combat_journal.js");
    // Des textes d'essai : seuls les types et le camp comptent ici, la phrase est celle du journal (js/combat/journal.js).
    const noeuds = ligneEnNoeuds({
      segments: [
        { type: "acteur", texte: "Chef", camp: "adv", phrase: 0 },
        { type: "texte", texte: " : Frappe. ", phrase: 0 },
        { type: "acteur", texte: "Aubépine", camp: "pj", phrase: 1 },
        { type: "texte", texte: " intervient. ", phrase: 1 },
        { type: "echeance", texte: "Une échéance.", phrase: 2 },
        { type: "texte", texte: " ", phrase: null },
        { type: "mj", texte: "Un geste du MJ.", phrase: 3 },
      ],
    });
    assert.deepEqual(
      noeuds.filter((noeud) => noeud.tagName === "SPAN").map((noeud) => [noeud.className, texteDe(noeud)]),
      [["combat-seg-adv", "Chef"], ["combat-seg-pj", "Aubépine"], ["combat-seg-fin", "Une échéance."], ["combat-seg-fin", "Un geste du MJ."]],
    );
  } finally {
    retirer();
  }
});

dansUnePage("journal — la dernière ligne reste visible en revenant sur l'écran avec le combat en mémoire, quand la page ne pose le nœud qu'après l'avoir reçu", async (page) => {
  const { ecran, contexte, services } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  assert.equal(journal(ecran).length, 2);

  // Une autre visite (retour d'une fiche de la banque) : le combat est en mémoire, afficher() monte l'écran tout de
  // suite, et la page pose son nœud aussitôt après, dans le même tour, comme js/application.js. Hors de la page, un
  // nœud n'a pas de mise en page : la liste ne se pose qu'une fois le nœud dans la page, pour défiler jusqu'à sa fin.
  const revenue = page.afficher(contexte, services);
  assert.equal(revenue.isConnected, false);
  assert.equal(etatDuCombat(revenue), "Tour 1 · camp des PJ", "l'écran est monté tout de suite");
  document.body.replaceChildren(revenue);
  // Ce que le navigateur donne une fois le nœud posé : une hauteur, et le journal à sa première ligne.
  const lignes = un(revenue, "ol.combat-lignes");
  lignes.scrollHeight = 960;
  lignes.scrollTop = 0;
  await laisserFiler();
  assert.equal(journal(revenue).length, 2);
  assert.equal(lignes.scrollTop, 960, "le journal se rouvre sur sa dernière ligne");

  // Une visite que la page ne pose jamais, ou qu'une autre a remplacée entre-temps, ne règle rien.
  const jamaisPosee = page.afficher(contexte, services);
  const delaissees = un(jamaisPosee, "ol.combat-lignes");
  delaissees.scrollHeight = 960;
  delaissees.scrollTop = 0;
  await laisserFiler();
  assert.equal(delaissees.scrollTop, 0);
  const remplacee = page.afficher(contexte, services);
  const derniere = page.afficher(contexte, services);
  document.body.replaceChildren(remplacee, derniere);
  for (const noeud of [remplacee, derniere]) Object.assign(un(noeud, "ol.combat-lignes"), { scrollHeight: 960, scrollTop: 0 });
  await laisserFiler();
  assert.deepEqual([un(remplacee, "ol.combat-lignes").scrollTop, un(derniere, "ol.combat-lignes").scrollTop], [0, 960], "seule la dernière visite suit le combat");
});

dansUnePage("enregistrement — la clé de table est relue à chaque écriture, jamais gardée : changée pendant la visite, l'écriture suivante la suit ; retirée, plus rien ne s'écrit", async (page) => {
  const lieu = lieuSimule();
  const { ecran, contexte } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  const finDeLEcriture = () => attendre(() => garde(ecran) !== PHRASES_DE_GARDE.ecriture, "la fin de l'écriture");
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await finDeLEcriture();
  const premiere = await lieu.gardee();
  assert.equal(premiere.sel, SECRET.sel);
  assert.equal(JSON.parse((await lireLaBase(lieu, SECRET)).texte).miseEnPlace.protagonistes.length, 1);

  // Le mot de passe de table change pendant la visite : l'état de la page porte une autre clé. C'est le même
  // contexte que l'écran a reçu, comme dans la page ; l'écran n'est ni rouvert, ni prévenu.
  assert.notEqual(AUTRE.sel, SECRET.sel);
  contexte.etat.secret = AUTRE;
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  await finDeLEcriture();
  assert.equal(garde(ecran), PHRASES_DE_GARDE.garde);
  const seconde = await lieu.gardee();
  assert.equal(seconde.revision, premiere.revision + 1);
  assert.equal(seconde.sel, AUTRE.sel, "l'écriture suit la clé du moment");
  assert.equal((await lireLaBase(lieu, SECRET)).code, "cle", "la clé d'avant ne le lit plus");
  assert.equal(JSON.parse((await lireLaBase(lieu, AUTRE)).texte).miseEnPlace.protagonistes.length, 2);

  // La clé quitte l'état de la page : rien ne s'écrit, la barre le dit, et le combat continue en mémoire.
  contexte.etat.secret = null;
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.sans_cle, "le refus d'écrire sans clé");
  assert.equal(garde(ecran), "Combat non gardé : le mot de passe de table a changé.");
  await laisserFiler(20);
  assert.deepEqual(await lieu.gardee(), seconde, "l'enregistrement n'a pas bougé");
  assert.equal(fiches(ecran).length, 3);
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
  // La région d'annonce reste dans la page quand la préparation prend la place de la zone : c'est le même nœud.
  const regionDAnnonce = un(ecran, "p.combat-annonce");
  assert.match(texteDe(regionDAnnonce), /^Combat lancé : 1 personnage contre 3 adversaires\./);

  const autres = un(barre(ecran), "div.combat-autres");
  const nouveau = boutonDit(autres, "Nouveau combat");
  assert.equal(tous(ecran, ".confirmation").length, 0);
  await cliquer(nouveau);
  // La question se pose dans la page, à la place des boutons ; rien n'est encore effacé.
  const question = un(autres, ".confirmation");
  assert.equal(question.getAttribute("role"), "group");
  assert.equal(texteDe(un(question, "p")), QUESTION);
  assert.equal(un(question, "p").id, question.getAttribute("aria-labelledby"), "la question est le nom du groupe : un lecteur d'écran la dit");
  assert.deepEqual(tous(autres, "button").map(texteDe), ["Effacer", "Annuler"]);
  focusSur(boutonDit(autres, "Annuler"), "le focus va au choix sans risque");
  assert.equal(autres.className, "combat-autres ouvert", "sur un téléphone, la question se voit");
  assert.equal(journal(ecran).length, 2);

  await cliquer(boutonDit(autres, "Annuler"));
  assert.equal(tous(ecran, ".confirmation").length, 0);
  focusSur(nouveau);
  assert.equal(autres.className, "combat-autres ouvert", "sur un téléphone, le menu reste ouvert : le bouton qui reprend le focus se voit");
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
  assert.equal(cache(un(ecran, "div.combat-bandeau")), true, "le bandeau se cache avec le combat");
  assert.equal(texteDe(regionDAnnonce), "", "la région d'annonce ne redit rien du combat d'avant");
  memeNoeud(un(ecran, "p.combat-annonce"), regionDAnnonce, "elle reste dans la page, vide, et reste la seule");
  memeNoeud(regionDAnnonce.parentNode, ecran, "la région, dans l'écran");
  // Le menu « ⋯ » se referme avec la question : sur un téléphone, « Nouveau combat » restait affiché sous la barre du combat neuf.
  assert.deepEqual([un(barre(ecran), "button.combat-plus-bouton").getAttribute("aria-expanded"), autres.className], ["false", "combat-autres"]);
  assert.deepEqual(tous(autres, "button").map(texteDe), [ANNULER_LE_DERNIER, "Nouveau combat"]);
  assert.equal(cache(boutonDit(autres, ANNULER_LE_DERNIER)), true, "avant le lancement, « Annuler le dernier geste » se cache");
  assert.deepEqual(formeDuCadre(ecran), ["combat-bandeau", "combat-plateau", "combat-bulle", "combat-onglet", "combat-preparation", "combat-camps"]);
  focusSur(un(ecran, "h1"));
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
  memeNoeud(un(ecran, "p.combat-annonce"), regionDAnnonce, "et c'est encore le même nœud qui le dit");
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
  focusSur(tous(panneau, "h2")[0], "le focus va au titre du panneau");
  assert.equal(tous(panneau, "h2")[0].getAttribute("tabindex"), "-1", "un titre ne reçoit le focus que s'il le peut, sans entrer dans l'ordre du clavier");
  assert.equal(tous(panneau, "h1").length, 0, "un seul titre de premier niveau dans la page");
  assert.equal(tous(panneau, ".lecture").length, 1);
  assert.equal(texteDe(un(panneau, ".lecture-titre")), "Aubépine Crèmebrûlée");
  assert.doesNotMatch(texteDe(panneau), /La banque a changé/);
  await cliquer(boutonDit(panneau, "Fermer"));
  assert.equal(panneau.children.length, 0);
  focusSur(repere(fiche(ecran, "pj1"), "fiche-complete"), "le focus revient au bouton");

  // L'adversaire : sa carte, avec son numéro d'exemplaire.
  await cliquer(repere(fiche(ecran, "adv4"), "fiche-complete"));
  assert.equal(texteDe(tous(panneau, "h2")[0]), "Fiche complète : Marmiton de corvée n° 2");
  const carte = un(panneau, "article.carte-adversaire");
  assert.equal(texteDe(un(carte, ".carte-nom")), "Marmiton de corvée n° 2");
  // Le cadre de la carte se mesure sur ce qui le contient : un nœud sans classe, donc sans remplissage, et non le panneau lui-même.
  const cadreDeLaCarte = un(panneau, ".cadre-cartes");
  assert.deepEqual([cadreDeLaCarte.parentNode.tagName, cadreDeLaCarte.parentNode.className, cadreDeLaCarte.parentNode.parentNode], ["DIV", "", panneau]);
  assert.equal(tous(panneau, ".lecture").length, 0);
  assert.doesNotMatch(texteDe(panneau), /La banque a changé/);
  // La banque d'appoint de cette carte n'est pas passée par l'écran Rencontre : sa composition est entière.
  assert.equal(rencontre.exemplaires(BANQUE, "Plongeur"), 1);
  // Retirer le protagoniste ferme sa fiche.
  await cliquer(repere(groupe(ecran, "adv4"), "retirer"));
  assert.equal(panneau.children.length, 0);
  // Une fiche repliée : à « Fermer », c'est son en-tête qui reçoit le focus.
  await cliquer(repere(fiche(ecran, "adv2"), "fiche-complete"));
  fiche(ecran, "adv2").removeAttribute("open");
  await cliquer(boutonDit(panneau, "Fermer"));
  focusSur(un(fiche(ecran, "adv2"), "summary"));

  // Le personnage a été retouché sur l'appareil depuis son ajout (un autre nom, la même clé) : la liste de la
  // préparation le montre tel qu'il est aujourd'hui, mais sa fiche complète se calcule du personnage photographié.
  const retouche = { ...AUBEPINE, identite: { ...AUBEPINE.identite, nom: "Aubépine Meringuée" } };
  const { ecran: plusTard } = await ouvrirLEcran(page, { magasin, personnages: [retouche] });
  assert.equal(tous(repere(plusTard, "personnage"), "option").some((option) => texteDe(option).startsWith("Aubépine Meringuée")), true, "l'appareil tient le personnage retouché");
  assert.deepEqual(fiches(plusTard)[0], ["pj1", "Aubépine Crèmebrûlée"]);
  await cliquer(repere(fiche(plusTard, "pj1"), "fiche-complete"));
  assert.equal(texteDe(un(un(plusTard, "section.combat-panneau"), ".lecture-titre")), "Aubépine Crèmebrûlée", "le personnage photographié, pas celui que l'appareil tient aujourd'hui");
  assert.doesNotMatch(texteDe(un(plusTard, "section.combat-panneau")), /Meringuée/);

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
  for (const noeud of [un(ecran, "p.combat-etat"), un(ecran, "p.combat-garde"), un(ecran, "p.combat-limite")]) {
    assert.equal(noeud.hasAttribute("role"), false);
    assert.equal(noeud.hasAttribute("aria-live"), false);
  }
  // Avant le lancement, la zone d'avis, et déjà la région d'annonce des dés, vide : entrée dans la page avec le panneau, déjà pleine, sa première annonce pouvait ne pas être dite.
  assert.deepEqual(regions(ecran).map(([noeud, texte]) => [noeud.className, texte]), [["combat-avis", ""], ["combat-annonce", ""]]);
  const regionDesDes = un(ecran, "p.combat-annonce");

  for (const ajouter of [() => ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée"), () => ajouterDesAdversaires(ecran, "Plongeur", 1), () => lancerLeCombat(ecran)]) {
    await ajouter();
    assert.equal(garde(ecran), "Enregistrement…");
    assert.equal(avis(ecran).children.length, 0);
    await attendre(() => garde(ecran) !== "Enregistrement…", "la fin de l'écriture");
    assert.equal(garde(ecran), "Combat gardé sur cet appareil");
    assert.equal(avis(ecran).children.length, 0);
  }
  // Le combat lancé, c'est le même nœud qui parle : la seule région polie de l'écran, bandeau et bulle compris.
  memesNoeuds(regions(ecran).filter(([noeud]) => noeud.getAttribute("aria-live") === "polite" || noeud.getAttribute("role") === "status").map(([noeud]) => noeud), [regionDesDes], "la seule région polie");
  assert.match(texteDe(regionDesDes), /^Combat lancé : 1 personnage contre 1 adversaire\./);
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

dansUnePage("enregistrement — « Combat ouvert ailleurs » : on ne joue plus, le bloc d'arrêt le dit ; « Reprendre le combat le plus récent »", async (page) => {
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
  await auPlus(gardien.repos(), "la fin des écritures du gardien");
  const gardee = await lieu.gardee();

  // Ici, rien ne le dit encore : c'est l'écriture du geste suivant qui le découvre.
  assert.equal(avis(ecran).children.length, 0);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(avis(ecran).children.length, 0, "le clic est joué en mémoire");
  assert.equal(tous(corps(ecran), ".combat-cibles").length, 1);
  await attendre(() => garde(ecran) === "Combat ouvert ailleurs", "le refus de l'écriture");
  // L'état passe par la zone d'avis, avec son bouton ; la zone sous la carte cède la place au bloc d'arrêt, et la bulle se cache.
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), ["Combat ouvert ailleurs"]);
  assert.deepEqual(tous(avis(ecran), "button").map(texteDe), ["Reprendre le combat le plus récent"]);
  assert.deepEqual(formeDuCadre(ecran), ["combat-bandeau", "combat-plateau", "combat-bulle", "combat-onglet", "combat-action", "combat-camps"]);
  const bloc = sousLaCarte(ecran);
  assert.equal(bloc.getAttribute("aria-label"), "Combat arrêté");
  assert.deepEqual([bulleMontree(ecran), cache(onglet(ecran))], [false, true]);
  assert.equal(texteDe(un(bloc, "h2")), "Combat ouvert ailleurs");
  assert.deepEqual(tous(bloc, "button").map(texteDe), ["Reprendre le combat le plus récent"]);
  // Le focus était dans la bulle, qui vient de se cacher sans qu'on ait rien cliqué : il va au bloc qui remplace la zone.
  focusSur(un(bloc, "h2"), "le focus n'est pas perdu avec la bulle");
  // « Nouveau combat » écraserait le combat de l'autre onglet : il est inactif, et le dit.
  const nouveau = boutonDit(barre(ecran), "Nouveau combat");
  assert.equal(inactif(nouveau), true);
  assert.equal(raisonDe(ecran, nouveau), "Combat ouvert ailleurs");
  await cliquer(nouveau);
  assert.equal(tous(ecran, ".confirmation").length, 0);

  // « Fin de tour » et « Annuler le dernier geste » ne joueraient rien : ils sont inactifs eux aussi, et le disent par la même phrase.
  const fin = boutonDit(barre(ecran), "Fin de tour");
  assert.equal(inactif(fin), true);
  assert.equal(raisonDe(ecran, fin), "Combat ouvert ailleurs");
  const annulerLeGeste = boutonDit(barre(ecran), ANNULER_LE_DERNIER);
  assert.equal(inactif(annulerLeGeste), true);
  assert.equal(raisonDe(ecran, annulerLeGeste), "Combat ouvert ailleurs");

  // La carte montre le combat sans rien offrir : aucun jeton ne porte de commande, aucun n'est écarté par un choix, aucune case ne se choisit.
  const surLaCarte = tous(ecran, ".combat-jeton");
  assert.equal(surLaCarte.length, 4);
  for (const pose of surLaCarte) {
    assert.equal(inactif(pose), true, pose.getAttribute("title"));
    assert.equal(pose.className.split(" ").includes("inactif"), false, pose.getAttribute("title"));
  }
  assert.equal(tous(ecran, ".combat-case-choix").length, 0);
  assert.equal(tous(ecran, ".combat-case").filter((noeud) => /possible|inactive/.test(noeud.className)).length, 0);
  // Les fiches non plus : ni « Jouer », ni rien d'autre que « Fiche complète ».
  assert.equal(tous(ecran, "[data-repere=jouer]").length, 0);
  assert.deepEqual([...new Set(tous(un(ecran, ".combat-camps"), "button").map(texteDe))], ["Fiche complète"]);

  // On ne joue plus : un clic est refusé, rien ne change, rien ne s'écrit, et l'avis ne se redit pas.
  const dit = un(avis(ecran), "p");
  const avant = journal(ecran);
  await cliquer(fin);
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  await cliquer(jeton(ecran, "Marmiton de corvée n° 1"));
  assert.deepEqual(journal(ecran), avant);
  assert.equal(bulleMontree(ecran), false);
  memeNoeud(un(avis(ecran), "p"), dit, "le même nœud : un lecteur d'écran ne l'entend qu'une fois");
  await laisserFiler(30);
  assert.deepEqual(await lieu.gardee(), gardee, "la base garde le combat de l'autre onglet");

  // « Reprendre » : l'écran montre le combat le plus récent, et l'on rejoue.
  await cliquer(boutonDit(bloc, "Reprendre le combat le plus récent"));
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la reprise");
  assert.equal(avis(ecran).children.length, 0);
  assert.deepEqual(formeDuCadre(ecran), ["combat-bandeau", "combat-plateau", "combat-bulle", "combat-onglet", "combat-action", "combat-camps"]);
  assert.equal(sousLaCarte(ecran).getAttribute("aria-label"), "Action en cours");
  assert.deepEqual(journal(ecran), [...journalAttendu.slice(0, 2), "Aubépine passe son tour.", "Fin du tour des PJ : ils retrouvent leurs actions.", "— Tour 1 · camp des adversaires —"]);
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.equal(inactif(boutonDit(barre(ecran), "Nouveau combat")), false);
  assert.equal(inactif(boutonDit(barre(ecran), "Fin de tour")), false, "le combat repris, « Fin de tour » rejoue");
  // La carte et les fiches offrent de nouveau : les adversaires, qui ont la main, se choisissent.
  assert.deepEqual(tous(ecran, ".combat-jeton").filter((pose) => !inactif(pose)).map((pose) => pose.getAttribute("title")).sort(), ["Chef de partie", "Marmiton de corvée n° 1", "Marmiton de corvée n° 2"]);
  assert.equal(tous(ecran, "[data-repere=jouer]").length, 3);
  await cliquer(boutonDit(zone(ecran), "Chef de partie"));
  assert.deepEqual(enTete(ecran), ["Chef de partie", "actions restantes : 1 sur 1 · souffle 7/7"]);
  // Et l'on écrit de nouveau : le geste suivant monte la révision de l'autre onglet.
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(garde(ecran), "Enregistrement…");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "l'écriture d'après la reprise");
  assert.equal(avis(ecran).children.length, 0);
  assert.equal((await lieu.gardee()).revision, gardee.revision + 1);

  // Une seconde fois, sans geste ouvert : un troisième onglet reprend le combat et revient sur la Frappe du Chef ;
  // ici, « Revenir » le découvre. Rien n'est en cours : sans le blocage, les deux Marmitons se choisiraient par leur
  // jeton et par « Jouer ». Bloqués, ni la carte ni les fiches ne l'offrent.
  const troisieme = creerGardien({ magasin: await lieu.onglet(), mode: "demo", secret: () => SECRET });
  const tiers = creerSeance({ gardien: troisieme, des: desImposes([]), maintenant: SOIR, mode: "demo", accepter });
  assert.deepEqual(await tiers.ouvrir(), { issue: "repris" });
  assert.deepEqual(tiers.jouer({ type: "revenir" }), {});
  await auPlus(troisieme.repos(), "la fin des écritures du troisième onglet");
  await cliquer(boutonDit(corps(ecran), "Revenir"));
  await attendre(() => garde(ecran) === "Combat ouvert ailleurs", "le second refus de l'écriture");
  assert.equal(tous(ecran, ".combat-jeton").length, 4);
  memesNoeuds(tous(ecran, ".combat-jeton").filter((pose) => !inactif(pose)), [], "aucun jeton ne porte de commande");
  assert.equal(tous(ecran, "[data-repere=jouer]").length, 0, "aucune fiche n'offre « Jouer »");
  assert.deepEqual([...new Set(tous(un(ecran, ".combat-camps"), "button").map(texteDe))], ["Fiche complète"]);
  // Repris, le combat offre de nouveau : le Chef joue encore, les deux Marmitons se choisissent.
  await cliquer(boutonDit(sousLaCarte(ecran), "Reprendre le combat le plus récent"));
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la seconde reprise");
  assert.equal(tous(ecran, ".combat-jeton").filter((pose) => !inactif(pose)).length, 3);
  assert.ok(tous(ecran, "[data-repere=jouer]").length >= 2);
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
    // Rien ne se reprend ; la phrase est dans la barre, passe par l'avis, et le bloc d'arrêt la dit avec son bouton.
    assert.equal(garde(ecran), NE_SE_LIT_PLUS, cas);
    assert.deepEqual(fiches(ecran), []);
    assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [NE_SE_LIT_PLUS]);
    assert.deepEqual(tous(avis(ecran), "button").map(texteDe), ["Nouveau combat"]);
    const bloc = sousLaCarte(ecran);
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
  const bloc = sousLaCarte(ecran);
  assert.equal(texteDe(un(bloc, "h2")), RECENT);
  assert.equal(tous(bloc, "button").length, 0);
  const nouveau = boutonDit(barre(ecran), "Nouveau combat");
  assert.equal(inactif(nouveau), true);
  assert.equal(raisonDe(ecran, nouveau), RECENT);
  await cliquer(nouveau);
  assert.equal(tous(ecran, ".confirmation").length, 0);
  await laisserFiler(30);
  assert.deepEqual(await lieu.gardee(), posee, "le combat plus récent n'est pas écrasé");

  // Un contenu d'une autre version des règles (la 2, d'avant le lot 5, la version courante étant la 3) : il se dit, ne se rejoue pas, et se remplace.
  const AUTRE_VERSION = "Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas.";
  const autre = lieuSimule();
  await poserEnBase(autre, texteDuCombat(2, 3, (contenu) => ({ ...contenu, regles: 2, effets: [] })));
  const { ecran: second } = await ouvrirLEcran(await pageNeuve(), { magasin: await autre.onglet() });
  assert.equal(garde(second), AUTRE_VERSION);
  assert.deepEqual(tous(avis(second), "p").map(texteDe), [AUTRE_VERSION]);
  assert.deepEqual(tous(avis(second), "button").map(texteDe), ["Nouveau combat"]);
  assert.deepEqual(fiches(second), []);
  await cliquer(boutonDit(sousLaCarte(second), "Nouveau combat"));
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

// ─── Ce que la mise à l'épreuve a ajouté ────────────────────────────────────

dansUnePage("les services — sans service, « Copier » passe par le presse-papiers du navigateur, le combat se date à l'heure du moment, et la largeur se demande à la page", async (page) => {
  // La page ne passe aucun service : le presse-papiers est celui du navigateur, l'heure celle de l'appareil, la largeur celle de la fenêtre.
  const presse = pressePapiers();
  const propre = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: presse.navigateur, configurable: true, writable: true });
  const mediaDAvant = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  const demandees = new Set();
  let telephone = true;
  globalThis.matchMedia = (requete) => (demandees.add(requete), { matches: telephone });
  try {
    const { ecran, telecharges } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), navigateur: null, horloge: null, etroit: null });
    await preparerLaReference(ecran);
    const avant = new Date();
    await lancerLeCombat(ecran);
    const apres = new Date();
    // Sur un téléphone, personne ne jouant encore, aucune fiche n'est ouverte ; sur un grand écran, toutes le sont.
    const ouvertes = (noeud) => tous(noeud, "details").filter((uneFiche) => uneFiche.hasAttribute("open")).length;
    assert.deepEqual([...demandees], ["(max-width: 55.99rem)"]);
    assert.equal(ouvertes(ecran), 0);
    const zoneDuJournal = un(ecran, ".combat-journal");
    await cliquer(boutonDit(zoneDuJournal, "Copier"));
    assert.equal(presse.copies.length, 1, "la copie est allée au presse-papiers du navigateur");
    assert.match(presse.copies[0], /^Simulateur de combat — L'Atelier des Arpenteurs\nCombat lancé le /);
    assert.equal(tous(zoneDuJournal, "textarea").length, 0, "aucun champ de repli");
    // Le fichier porte la date et l'heure locales du lancement : combat-AAAA-MM-JJ-HHhMM.txt.
    const deux = (nombre) => String(nombre).padStart(2, "0");
    const nomA = (date) => `combat-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}-${deux(date.getHours())}h${deux(date.getMinutes())}.txt`;
    await cliquer(boutonDit(zoneDuJournal, "Télécharger"));
    assert.equal(telecharges.length, 1);
    assert.ok([nomA(avant), nomA(apres)].includes(telecharges[0][0]), `${telecharges[0][0]} : l'heure du lancement, ${nomA(avant)}`);
    // Une autre visite, la fenêtre élargie.
    telephone = false;
    assert.equal(ouvertes((await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), navigateur: null, horloge: null, etroit: null })).ecran), 4);
  } finally {
    if (propre) Object.defineProperty(globalThis, "navigator", propre);
    else delete globalThis.navigator;
    if (mediaDAvant) Object.defineProperty(globalThis, "matchMedia", mediaDAvant);
    else delete globalThis.matchMedia;
  }
});

dansUnePage("« Fin de tour » — inactif pendant un geste, il dit pourquoi, et son clic ne demande rien au combat", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des: desDe(scenario.gestes.slice(0, 1)) });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  const fin = boutonDit(barre(ecran), "Fin de tour");
  assert.equal(inactif(fin), false);
  // Après chaque dé du premier geste, tant que le geste n'est pas fini : le bouton, sa raison, puis un clic.
  const vus = [];
  await jouerLeGeste(ecran, scenario.gestes[0], {
    apresChaqueDe() {
      if (corps(ecran).querySelector(".combat-jet") === null) return;
      const avant = [etatDuCombat(ecran), enTete(ecran), journal(ecran).length];
      const vu = { inactif: inactif(fin), horsDuClavier: fin.hasAttribute("disabled"), raison: raisonDe(ecran, fin) };
      fin.click();
      vus.push({ ...vu, bouge: JSON.stringify([etatDuCombat(ecran), enTete(ecran), journal(ecran).length]) !== JSON.stringify(avant), avis: avis(ecran).children.length });
    },
  });
  assert.ok(vus.length >= 1, "le geste a lancé au moins un dé");
  for (const vu of vus) {
    // Le bouton reste dans l'ordre du clavier, inactif, sa raison à côté de lui ; le clic n'est pas allé jusqu'au combat : rien ne bouge, aucun refus ne s'affiche.
    assert.equal(vu.inactif, true);
    assert.equal(vu.horsDuClavier, false);
    assert.notEqual(vu.raison, "");
    assert.equal(vu.bouge, false);
    assert.equal(vu.avis, 0, "aucun refus ne s'affiche");
  }
  // Le geste fini, le journal est celui du combat de référence : le clic n'a rien dérangé.
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
  assert.equal(inactif(fin), false);
});

dansUnePage("préparation — le combat lancé, revenir sur l'écran ne relit pas les personnages : un appel par ouverture de la préparation, aucun pendant le combat", async (page) => {
  const magasin = magasinCombatMemoire();
  const etagere = etagereDe([AUBEPINE]);
  let enLigne = 0;
  const depot = { lireEnLigne: async () => ((enLigne += 1), { personnages: [], erreur: null }) };
  const { ecran } = await ouvrirLEcran(page, { magasin, etagere, depot });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  const lus = [etagere.journal.lectures, enLigne];
  assert.equal(lus[0], 1);
  // Le combat est en cours : la préparation n'est plus à l'écran, et personne ne s'ajoute.
  const { ecran: revenue } = await ouvrirLEcran(page, { magasin, etagere, depot });
  await laisserFiler(20);
  assert.equal(etatDuCombat(revenue), "Tour 1 · camp des PJ");
  assert.equal(tous(revenue, ".combat-preparation").length, 0);
  assert.deepEqual([etagere.journal.lectures, enLigne], lus, "ni l'appareil ni les personnages en ligne ne sont relus");
});

dansUnePage("enregistrement — « Reprendre le combat le plus récent » trouve un combat qui ne se lit plus : l'écran le dit, avec « Nouveau combat »", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const gardee = await lieu.gardee();
  // Ailleurs, le mot de passe de table a changé, et le combat a été écrit avec la clé nouvelle.
  const posee = await chiffrerCombat(texteDuCombat(2, gardee.revision + 1), AUTRE, { mode: "demo", revision: gardee.revision + 1 });
  assert.deepEqual(await (await lieu.onglet()).ecrireSi(posee, gardee.revision), { ecrit: true });
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  await attendre(() => garde(ecran) === "Combat ouvert ailleurs", "le refus de l'écriture");
  await cliquer(boutonDit(avis(ecran), "Reprendre le combat le plus récent"));
  await attendre(() => garde(ecran) === NE_SE_LIT_PLUS, "la reprise");
  await laisserFiler(20);
  // L'état nouveau passe par la zone d'avis, avec son bouton : la reprise ne l'efface pas.
  assert.equal(garde(ecran), NE_SE_LIT_PLUS);
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [NE_SE_LIT_PLUS]);
  assert.deepEqual(tous(avis(ecran), "button").map(texteDe), ["Nouveau combat"]);
  const bloc = sousLaCarte(ecran);
  assert.equal(texteDe(un(bloc, "h2")), NE_SE_LIT_PLUS);
  assert.deepEqual(tous(bloc, "button").map(texteDe), ["Nouveau combat"]);
  assert.equal(tous(bloc, ".attente").length, 0, "la reprise finie, l'attente a quitté le bloc");
  await laisserFiler(20);
  assert.deepEqual(await lieu.gardee(), posee, "rien n'est écrit par-dessus");
});

dansUnePage("enregistrement — pendant le rejeu de « Reprendre le combat le plus récent », le bloc d'arrêt montre la phrase d'attente de l'ouverture, sans rôle, au lieu de son bouton : la région d'annonce reste la seule région polie", async (page) => {
  const lieu = lieuSimule();
  // La reprise rend la main entre deux tranches : le contrôle retient la première, et regarde l'écran pendant ce temps.
  let retenir = false;
  let lacher = null;
  let tranches = 0;
  const rendreLaMain = () => {
    tranches += 1;
    if (!retenir) return Promise.resolve();
    return new Promise((resoudre) => {
      lacher = resoudre;
    });
  };
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), rendreLaMain });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const gardee = await lieu.gardee();
  // Ailleurs, un combat de 1 500 événements a été écrit par-dessus.
  const posee = await chiffrerCombat(texteDuLongCombat(1500, gardee.revision + 1), SECRET, { mode: "demo", revision: gardee.revision + 1 });
  assert.deepEqual(await (await lieu.onglet()).ecrireSi(posee, gardee.revision), { ecrit: true });
  await ajouterDesAdversaires(ecran, "Plongeur", 1);
  await attendre(() => garde(ecran) === "Combat ouvert ailleurs", "le refus de l'écriture");
  const bloc = sousLaCarte(ecran);
  assert.deepEqual(tous(bloc, "button").map(texteDe), ["Reprendre le combat le plus récent"]);
  retenir = true;
  tranches = 0;
  const reprise = cliquer(boutonDit(bloc, "Reprendre le combat le plus récent"));
  await attendre(() => lacher !== null, "la première tranche du rejeu");
  const attente = un(bloc, "p.attente");
  // La phrase de l'ouverture, sans rôle : la région d'annonce des dés est dans la page, et reste la seule région polie (compl. § 4.1).
  assert.deepEqual([attente.getAttribute("role"), texteDe(attente)], [null, "Ouverture du combat…"]);
  const polies = regions(ecran).filter(([noeud]) => noeud.getAttribute("aria-live") === "polite" || ["status", "log"].includes(noeud.getAttribute("role")));
  assert.deepEqual(polies.map(([noeud]) => noeud.className), ["combat-annonce"], "pendant la reprise, une seule région polie");
  assert.equal(tous(bloc, "button").length, 0, "le bouton cède la place à l'attente");
  assert.equal(texteDe(un(bloc, "h2")), "Combat ouvert ailleurs", "le bloc garde sa phrase");
  retenir = false;
  lacher();
  await auPlus(reprise, "la fin de la reprise");
  await attendre(() => etatDuCombat(ecran) === "Tour 1 · camp des PJ", "le combat repris");
  assert.equal(tranches, 1, "1 500 événements : la main rendue une fois");
  assert.equal(sousLaCarte(ecran).getAttribute("aria-label"), "Action en cours");
  assert.equal(tous(ecran, ".attente").length, 0, "l'attente a quitté la page");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 2));
});

dansUnePage("oublier() — pendant une écriture : ce qui était parti avec la clé oubliée ne s'écrit plus", async (page) => {
  const lieu = lieuSimule();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await attendre(() => garde(ecran) === PHRASES_DE_GARDE.garde, "la fin de l'écriture");
  const gardee = await lieu.gardee();
  // « Oublier le mot de passe » tombe au moment où l'écriture suivante chiffre : la clé est déjà lue, rien n'est encore en base.
  const subtil = crypto.subtle;
  const chiffrer = subtil.encrypt;
  let chiffrements = 0;
  subtil.encrypt = function encrypt(...parametres) {
    chiffrements += 1;
    page.oublier();
    return chiffrer.apply(subtil, parametres);
  };
  try {
    await ajouterDesAdversaires(ecran, "Plongeur", 1);
    await attendre(() => chiffrements > 0, "le chiffrement de l'écriture");
    await laisserFiler(60);
  } finally {
    delete subtil.encrypt;
  }
  assert.equal(crypto.subtle.encrypt, chiffrer);
  assert.equal(chiffrements, 1);
  assert.deepEqual(await lieu.gardee(), gardee, "la base garde l'écriture d'avant l'oubli");
});

dansUnePage("« Nouveau combat » — pendant la préparation : le bouton cliqué quitte la page, le focus va au titre", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire() });
  await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDit(barre(ecran), "Nouveau combat"));
  const effacer = boutonDit(barre(ecran), "Effacer");
  effacer.focus();
  await cliquer(effacer);
  assert.deepEqual(fiches(ecran), []);
  assert.equal(etatDuCombat(ecran), "Préparation");
  assert.equal(effacer.isConnected, false);
  focusSur(un(ecran, "h1"), "le focus n'est pas perdu avec la question");
});

dansUnePage("la liste d'une case — avant le lancement elle dit quel jeton est tenu ; « Fermer » rend le focus au « +k » qui se voit à cette largeur", async (page) => {
  for (const etroit of [true, false]) {
    const { ecran } = await ouvrirLEcran(await pageNeuve(), { magasin: magasinCombatMemoire(), etroit });
    await ajouterLePersonnage(ecran, "Aubépine Crèmebrûlée");
    await ajouterDesAdversaires(ecran, "Marmiton de corvée", 3);
    poserSur(ecran, "pj1", "J1");
    // Quatre jetons sur J1 : la case porte ses deux « +k », celui du téléphone (deux jetons montrés) et celui du grand écran (trois).
    const duTelephone = un(laCase(ecran, "J1"), "button.combat-plus-etroit");
    const duGrandEcran = un(laCase(ecran, "J1"), "button.combat-plus-large");
    assert.deepEqual([texteDe(duTelephone), texteDe(duGrandEcran)], ["+2", "+1"]);
    const visible = etroit ? duTelephone : duGrandEcran;
    const liste = un(un(ecran, ".combat-preparation"), ".combat-case-liste");
    await cliquer(visible);
    const noms = tous(liste, "button").map(texteDe).filter((nom) => nom !== "Fermer");
    assert.equal(noms.length, 4);
    // Personne n'est en main : chaque bouton de la liste le dit.
    assert.deepEqual(tous(liste, "button").filter((b) => texteDe(b) !== "Fermer").map((b) => b.getAttribute("aria-pressed")), ["false", "false", "false", "false"]);
    await cliquer(boutonDit(liste, "Fermer"));
    focusSur(un(laCase(ecran, "J1"), etroit ? "button.combat-plus-etroit" : "button.combat-plus-large"), etroit ? "sur un téléphone" : "sur un grand écran");
    // Un jeton pris sur la carte, puis la liste rouverte : elle dit lequel est tenu.
    const premier = tous(laCase(ecran, "J1"), ".combat-jeton")[0];
    await cliquer(premier);
    assert.equal(premier.getAttribute("aria-pressed"), "true");
    const tenu = premier.getAttribute("title");
    await cliquer(un(laCase(ecran, "J1"), etroit ? "button.combat-plus-etroit" : "button.combat-plus-large"));
    assert.deepEqual(tous(liste, "button").filter((b) => texteDe(b) !== "Fermer").map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), noms.map((nom) => [nom, String(nom === tenu)]));
  }
});

// ─── Au groupe 2 : la bulle ─────────────────────────────────────────────────

/** Le combat de référence lancé, sur un grand écran ; tous sur D4 si « serres » (quatre jetons : un « +1 » sur un grand écran). */
async function combatLance(page, { serres = false, des = [], ...options } = {}) {
  const ouvert = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des, ...options });
  await preparerLaReference(ouvert.ecran);
  if (serres) for (const id of ["pj1", "adv2"]) poserSur(ouvert.ecran, id, "D4");
  await lancerLeCombat(ouvert.ecran);
  return ouvert;
}

dansUnePage("la bulle — « Qui joue ? », le jeton et « Jouer » l'ouvrent contre la case, placée, nommée, le focus à sa première ligne ; ✕ la ferme et rend le focus au jeton", async (page) => {
  const { ecran } = await combatLance(page);
  const bulle = laBulle(ecran);
  assert.equal(bulleMontree(ecran), false, "personne ne joue : la bulle est cachée");
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");

  // « Qui joue ? » : la bulle s'ouvre sur les actions d'Aubépine, placée contre sa case, le focus sur sa première ligne active.
  const ecrituresAvant = bulle.style.ecritures.length;
  await cliquer(boutonDit(zone(ecran), "Aubépine Crèmebrûlée"));
  assert.equal(bulleMontree(ecran), true);
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 2 sur 2 · souffle 10/10"]);
  assert.equal(texteDe(zone(ecran)), PHRASE_DE_LA_ZONE, "la zone sous la carte ne dit plus que la phrase");
  focusSur(premiereLigne(ecran));
  assert.equal(document.activeElement.getAttribute("data-ligne"), "0:0", "la première ligne : Frappe");
  assert.deepEqual(bulle.style.ecritures.slice(ecrituresAvant).map(([nom]) => nom), ["--bulle-gauche", "--bulle-haut", "--bulle-fleche"], "placée une fois, à son ouverture");
  assert.ok(bulle.className.split(" ").some((classe) => /^combat-bulle-(droite|gauche|dessous|dessus)$/.test(classe)), bulle.className);
  assert.ok(un(laCase(ecran, "C3"), ".combat-jeton").className.split(" ").includes("joue"));
  // Un rendu qui ne change pas ce qu'elle montre ne la replace pas.
  const ecritures = bulle.style.ecritures.length;
  await cliquer(boutonDit(un(ecran, ".combat-journal"), "Télécharger"));
  assert.equal(bulle.style.ecritures.length, ecritures);

  // ✕ : « Fermer », la croix en dernier ; elle ferme, rien n'est dépensé, et le focus va au jeton.
  await cliquer(boutonDit(zone(ecran), "Aubépine Crèmebrûlée"));
  const fermer = un(bulle, "button.combat-bulle-fermer");
  memeNoeud(bulle.children.at(-1), fermer, "la croix est le dernier élément de la bulle");
  assert.equal(fermer.getAttribute("aria-label"), "Fermer");
  await cliquer(fermer);
  assert.equal(bulleMontree(ecran), false);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "le focus au jeton");

  // Le jeton l'ouvre de même ; « Jouer », sur la fiche, aussi.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  focusSur(premiereLigne(ecran));
  await cliquer(un(bulle, "button.combat-bulle-fermer"));
  await cliquer(repere(fiche(ecran, "pj1"), "jouer"));
  assert.equal(bulleMontree(ecran), true);
  focusSur(premiereLigne(ecran));
  // Un jeton de l'autre camp, hors d'un choix de cible, n'ouvre rien.
  await cliquer(un(bulle, "button.combat-bulle-fermer"));
  await cliquer(jeton(ecran, "Chef de partie"));
  assert.equal(bulleMontree(ecran), false);
  assert.deepEqual(focusQuiDefilent(), [], "chaque focus sans défiler");
});

dansUnePage("la bulle — le clic au-dehors la ferme sans bouger le focus ; un clic dans la carte, dans la bulle ou sur l'onglet ne la ferme pas ; après le premier dé, il la réduit", async (page) => {
  const { ecran } = await combatLance(page, { des: [6, 9, 8, 2, 16] });
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  const focusDansLaBulle = document.activeElement;
  // Dans la carte, sur une case : la bulle reste.
  await cliquerSur(ecran, laCase(ecran, "H8"));
  assert.equal(bulleMontree(ecran), true, "un clic dans la carte n'est pas au-dehors");
  // Dans la bulle elle-même : elle reste.
  await cliquerSur(ecran, un(laBulle(ecran), "h2.combat-bulle-titre"));
  assert.equal(bulleMontree(ecran), true);
  // Au-dehors (le titre du journal) : elle se ferme, rien n'est dépensé, et le focus ne bouge pas.
  const focusAvant = document.focalisations.length;
  await cliquerSur(ecran, un(ecran, "#combat-journal-titre"));
  assert.equal(bulleMontree(ecran), false);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  focusSur(focusDansLaBulle, "le focus reste où il était");
  assert.equal(document.focalisations.length, focusAvant, "aucun focus posé par le clic au-dehors");
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 2), "fermer avant le premier dé ne dépense rien");

  // La bulle cachée, un clic au-dehors ne fait rien.
  await cliquerSur(ecran, un(ecran, "#combat-journal-titre"));
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");

  // Après le premier dé : un clic au-dehors réduit la bulle en un onglet, contre la case ; le focus ne bouge pas.
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  await cliquer(deACliquer(ecran));
  assert.equal(un(laBulle(ecran), "button.combat-bulle-fermer").getAttribute("aria-label"), "Réduire");
  assert.equal(texteDe(un(laBulle(ecran), "button.combat-bulle-fermer")), String.fromCodePoint(0x2013));
  const focusPendantLeJet = document.activeElement;
  const ecrituresDeLOnglet = onglet(ecran).style.ecritures.length;
  await cliquerSur(ecran, un(ecran, "p.combat-aide"));
  assert.equal(bulleMontree(ecran), false, "réduite");
  assert.equal(cache(onglet(ecran)), false, "l'onglet paraît");
  assert.equal(texteDe(onglet(ecran)), "Frappe : rouvrir");
  assert.ok(onglet(ecran).style.ecritures.length > ecrituresDeLOnglet, "l'onglet se place contre la case");
  focusSur(focusPendantLeJet);
  // Un clic sur l'onglet n'est pas au-dehors : il rouvre la bulle, le focus sur la commande qui attend.
  await cliquer(onglet(ecran));
  assert.equal(bulleMontree(ecran), true);
  assert.equal(cache(onglet(ecran)), true);
  focusSur(deACliquer(ecran), "le focus au dé qui attend");
  // Le geste se finit dans la bulle rouverte.
  await cliquer(deACliquer(ecran));
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), "Appliquer"));
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
});

dansUnePage("la bulle — Échap ferme d'abord l'infobulle, sans bouger le focus, puis la bulle, et rend le focus au jeton ; ailleurs, Échap n'est pas pris ; après le premier dé, il la réduit", async (page) => {
  const { ecran } = await combatLance(page, { des: [6, 9] });
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  const frappe = premiereLigne(ecran);
  // Le focus sur la ligne ouvre son infobulle.
  frappe.declencher("focus");
  const ouvertes = () => tous(laBulle(ecran), "div.combat-infobulle").filter((noeud) => !cache(noeud));
  assert.equal(ouvertes().length, 1, "l'infobulle de la ligne est ouverte");
  assert.ok(tous(ecran, ".combat-case").some((noeud) => noeud.className.split(" ").includes("portee")), "les hachures de sa portée");
  // Échap : l'infobulle se ferme, le focus ne bouge pas, la bulle reste.
  const focusAvant = document.focalisations.length;
  assert.equal(echap(ecran), true);
  assert.equal(ouvertes().length, 0);
  assert.equal(tous(ecran, ".combat-case").filter((noeud) => noeud.className.split(" ").includes("portee")).length, 0, "les hachures s'effacent avec elle");
  assert.equal(bulleMontree(ecran), true);
  assert.equal(document.focalisations.length, focusAvant, "le focus n'a pas bougé");
  // Un second Échap ferme la bulle, et rend le focus au jeton.
  assert.equal(echap(ecran), true);
  assert.equal(bulleMontree(ecran), false);
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"));

  // Le focus sur le jeton : Échap ferme aussi la bulle montrée.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  jeton(ecran, "Aubépine Crèmebrûlée").focus({ preventScroll: true });
  assert.equal(echap(ecran), true);
  assert.equal(bulleMontree(ecran), false);

  // Le focus ailleurs (le titre de la page) : Échap n'est pas pris, la bulle reste.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  un(ecran, "h1").focus({ preventScroll: true });
  assert.equal(echap(ecran), false, "Échap n'est pas pris");
  assert.equal(bulleMontree(ecran), true);
  // La bulle cachée, Échap n'est pas pris non plus.
  await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));
  assert.equal(echap(ecran), false);

  // Après le premier dé, Échap réduit la bulle, et rend le focus au jeton.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  await cliquer(deACliquer(ecran));
  assert.equal(echap(ecran), true);
  assert.equal(bulleMontree(ecran), false);
  assert.equal(texteDe(onglet(ecran)), "Frappe : rouvrir");
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"));
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 2), "réduire ne défait rien : le geste attend");
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("la bulle — « +k » ouvre la liste de la case dans la bulle même, nommée par son titre ; « Fermer » la ferme (focus au « +k ») ou rend ce qu'elle montrait ; un jeton choisi y met ses options ; un autre jeton du camp", async (page) => {
  const { ecran } = await combatLance(page, { serres: true });
  // Quatre jetons sur D4 : un « +1 » sur un grand écran.
  const plus = () => un(laCase(ecran, "D4"), "button.combat-plus-large");
  assert.equal(texteDe(plus()), "+1");
  const liste = () => un(laBulle(ecran), ".combat-case-liste");

  // Personne ne joue : la bulle s'ouvre pour la liste seule, placée contre la case, le focus à son titre.
  await cliquer(plus());
  assert.equal(bulleMontree(ecran), true);
  assert.equal(texteDe(un(liste(), "h3")), "Case D4");
  assert.equal(laBulle(ecran).getAttribute("aria-labelledby"), "combat-bulle-case-titre");
  assert.equal(un(liste(), "h3").id, "combat-bulle-case-titre");
  assert.equal(laBulle(ecran).hasAttribute("aria-label"), false);
  focusSur(un(liste(), "h3"));
  assert.equal(un(un(ecran, "section.combat-action"), ".combat-case-liste").children.length, 0, "sur un grand écran, la zone ne la porte pas");
  assert.deepEqual(tous(liste(), "button").map((b) => [texteDe(b), inactif(b)]), [
    ["Aubépine Crèmebrûlée", false],
    ["Chef de partie", true],
    ["Marmiton de corvée n° 1", true],
    ["Marmiton de corvée n° 2", true],
    ["Fermer", false],
  ]);
  // « Fermer » : la bulle, ouverte pour elle seule, se ferme ; le focus va au « +1 ».
  await cliquer(boutonDit(liste(), "Fermer"));
  assert.equal(bulleMontree(ecran), false);
  focusSur(plus());
  // Échap sur la liste : de même, le focus au « +1 ».
  await cliquer(plus());
  assert.equal(echap(ecran), true);
  assert.equal(bulleMontree(ecran), false);
  focusSur(plus());

  // Un jeton choisi dans la liste : ses options prennent la place, le focus à la première ligne.
  await cliquer(plus());
  await cliquer(boutonDit(liste(), "Aubépine Crèmebrûlée"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  assert.equal(tous(laBulle(ecran), ".combat-case-liste").length, 0, "la liste a quitté la bulle");
  focusSur(premiereLigne(ecran));
  // La bulle montrée : la liste prend sa place, puis « Fermer » rend ce qu'elle montrait.
  await cliquer(plus());
  assert.equal(texteDe(un(liste(), "h3")), "Case D4");
  assert.deepEqual([cache(un(laBulle(ecran), ".combat-bulle-tete")), laBulle(ecran).getAttribute("aria-labelledby")], [true, "combat-bulle-case-titre"]);
  await cliquer(boutonDit(liste(), "Fermer"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  assert.equal(bulleMontree(ecran), true);
  focusSur(premiereLigne(ecran));
  // Un clic au-dehors, la liste ouverte : elle se ferme, la bulle rend ce qu'elle montrait, le focus ne bouge pas.
  await cliquer(plus());
  const focusSurLaListe = document.activeElement;
  await cliquerSur(ecran, un(ecran, "p.combat-aide"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  focusSur(focusSurLaListe);

  // Pendant un choix de cible : la liste dans la bulle choisit la cible, « choisie ici ».
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(plus());
  await cliquer(boutonDit(liste(), "Marmiton de corvée n° 2"));
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
  assert.deepEqual(tous(corps(ecran), ".combat-origine").map(texteDe), ["choisie ici"]);
  focusSur(deACliquer(ecran), "le focus au dé qui attend");
  await cliquer(boutonDit(corps(ecran), "Revenir"));

  // Le tour des adversaires : un autre jeton du camp ouvre sa bulle à la place.
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  await cliquer(repere(fiche(ecran, "adv2"), "jouer"));
  assert.equal(nomDeLaBulle(ecran), "Chef de partie : ses actions");
  await cliquer(plus());
  await cliquer(boutonDit(liste(), "Marmiton de corvée n° 1"));
  assert.equal(nomDeLaBulle(ecran), "Marmiton de corvée n° 1 : ses actions");
  focusSur(premiereLigne(ecran));
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("la bulle — un autre jeton du camp ouvre la sienne ; le geste fini, elle revient à la liste, ou se ferme et rend le focus au jeton", async (page) => {
  const gestes = scenario.gestes.slice(0, 4);
  const { ecran } = await combatLance(page, { des: desDe(gestes) });
  for (const geste of gestes.slice(0, 2)) await jouerLeGeste(ecran, geste);
  // Le tour des adversaires : le Chef, puis un autre jeton de son camp.
  await cliquer(jeton(ecran, "Chef de partie"));
  assert.equal(nomDeLaBulle(ecran), "Chef de partie : ses actions");
  const ecritures = laBulle(ecran).style.ecritures.length;
  await cliquer(jeton(ecran, "Marmiton de corvée n° 1"));
  assert.equal(nomDeLaBulle(ecran), "Marmiton de corvée n° 1 : ses actions");
  assert.ok(laBulle(ecran).style.ecritures.length > ecritures, "un autre protagoniste : la bulle se replace");
  focusSur(premiereLigne(ecran));
  // Le geste du Marmiton n° 1 : sa seule action dépensée, la bulle se ferme et le focus va à son jeton.
  await jouerLeGeste(ecran, gestes[2]);
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 7));
  assert.equal(bulleMontree(ecran), false);
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  focusSur(jeton(ecran, "Marmiton de corvée n° 1"));
  // Le Chef joue Pas chassé [2] : un déplacement se confirme, et la bulle se ferme de même. Quatre jetons sur D4,
  // personne ne joue : le Chef y est le troisième montré, et se voit sur un grand écran.
  await jouerLeGeste(ecran, gestes[3]);
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 8));
  assert.equal(bulleMontree(ecran), false);
  memeNoeud(tous(laCase(ecran, "D4"), ".combat-jeton")[2], jeton(ecran, "Chef de partie"), "le Chef, troisième montré");
  focusSur(jeton(ecran, "Chef de partie"));
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("la bulle — fermée, elle rend le focus au jeton s'il se voit à cette largeur, sinon au « +k » qui le cache", async () => {
  for (const etroit of [false, true]) {
    const { ecran } = await combatLance(await pageNeuve(), { serres: true, etroit });
    const quand = etroit ? "sur un téléphone" : "sur un grand écran";
    await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
    await cliquer(boutonDit(corps(ecran), "Passer son tour"));
    assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
    // Quatre jetons sur D4, les trois adversaires devant : le Marmiton n° 2 est le troisième. Un grand écran en
    // montre trois ; sous 56rem, la feuille n'en montre que deux.
    await cliquer(repere(fiche(ecran, "adv4"), "jouer"));
    assert.equal(nomDeLaBulle(ecran), "Marmiton de corvée n° 2 : ses actions", quand);
    await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));
    assert.equal(bulleMontree(ecran), false);
    memeNoeud(tous(laCase(ecran, "D4"), ".combat-jeton")[2], jeton(ecran, "Marmiton de corvée n° 2"), `${quand} : le Marmiton n° 2, troisième`);
    focusSur(etroit ? un(laCase(ecran, "D4"), "button.combat-plus-etroit") : jeton(ecran, "Marmiton de corvée n° 2"), quand);
  }
});

dansUnePage("la bulle — Maj+Tab depuis sa première ligne revient au jeton ; Tab après ✕ sort de la bulle, qui reste ouverte", async (page) => {
  const { ecran } = await combatLance(page);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  const bulle = laBulle(ecran);
  let empeche = false;
  bulle.declencher("keydown", {
    key: "Tab",
    shiftKey: true,
    target: premiereLigne(ecran),
    preventDefault() {
      empeche = true;
    },
  });
  assert.equal(empeche, true);
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "le focus au jeton");
  assert.equal(bulleMontree(ecran), true, "la bulle reste ouverte : ni piège ni modale");
  // Tab, depuis ✕ : rien n'est retenu, le navigateur sort de la bulle.
  empeche = false;
  bulle.declencher("keydown", {
    key: "Tab",
    target: un(bulle, "button.combat-bulle-fermer"),
    preventDefault() {
      empeche = true;
    },
  });
  assert.equal(empeche, false);
  assert.equal(bulleMontree(ecran), true);
});

// La bulle se place sur la carte telle que le rendu la laisse (captures
// finales du groupe 2, D-2). Rouverte au rechargement en plein jet, elle
// pointait 61 px au-dessus de sa case, la hauteur du bandeau : placée avant
// que le bandeau et la zone d'avis se rendent, elle restait où la carte était
// avant qu'ils la poussent.
//
// Le document simulé ne met rien en page : ces boîtes prêtées font ce que
// fait la feuille. Le cadre commence sous la barre, une ligne plus bas pour
// la phrase de la limite montrée et pour chaque paragraphe de la zone d'avis ;
// dans le cadre, la carte descend sous le bandeau montré ; chaque case fait
// 60 px de côté, comptée depuis A1 ; la bulle a sa taille (celle du jet, plus
// grande) ; rien d'autre n'a de boîte. Chaque boîte se lit quand le code la
// demande : elle bouge quand le bandeau ou l'avis paraît, comme dans la page.
const BOITES = { cadre: { gauche: 40, haut: 100, largeur: 1200, hauteur: 1400 }, ligneAuDessus: 48, bandeau: 62, cote: 60, liste: { width: 320, height: 400 }, jet: { width: 472, height: 520 } };
// La marge de calculerPlace (js/ecrans/echelle.js) : « entière » se juge à elle.
const MARGE_DE_LA_FENETRE = 16;

/** La première classe d'un nœud : ce qu'il est dans l'écran. */
const premiereClasse = (noeud) => String(noeud?.className ?? "").split(" ")[0];
const enfantDe = (noeud, classe) => noeud?.children.find((enfant) => premiereClasse(enfant) === classe) ?? null;

function boiteDuCadre(noeud) {
  const ecran = noeud.parentNode;
  const limite = enfantDe(ecran, "combat-limite");
  const lignes = (limite !== null && !limite.hidden ? 1 : 0) + (enfantDe(ecran, "combat-avis")?.children.length ?? 0);
  return { left: BOITES.cadre.gauche, top: BOITES.cadre.haut + lignes * BOITES.ligneAuDessus, width: BOITES.cadre.largeur, height: BOITES.cadre.hauteur };
}

function boiteDeLaCase(noeud) {
  let leCadre = noeud.parentNode;
  while (leCadre && premiereClasse(leCadre) !== "combat-cadre") leCadre = leCadre.parentNode;
  if (!leCadre) return null;
  const bandeau = enfantDe(leCadre, "combat-bandeau");
  const nom = noeud.getAttribute("data-case");
  const colonne = nom.codePointAt(0) - "A".codePointAt(0);
  const rangee = Number(nom.slice(1)) - 1;
  const { left, top } = boiteDuCadre(leCadre);
  const pousse = bandeau !== null && !bandeau.hidden ? BOITES.bandeau : 0;
  return { left: left + colonne * BOITES.cote, top: top + pousse + rangee * BOITES.cote, width: BOITES.cote, height: BOITES.cote };
}

function boitePretee(noeud) {
  const classes = String(noeud.className ?? "").split(" ");
  if (classes[0] === "combat-cadre") return boiteDuCadre(noeud);
  if (classes[0] === "combat-case") return boiteDeLaCase(noeud);
  if (classes[0] === "combat-bulle") return { left: 0, top: 0, ...(classes.includes("combat-bulle-jet") ? BOITES.jet : BOITES.liste) };
  return null;
}

/** Prête ces boîtes à chaque élément que la page créera désormais : son « rectangle » se lit au moment où on le demande. */
function preterLesBoites() {
  const creer = document.createElement;
  document.createElement = (balise) => {
    const noeud = creer(balise);
    Object.defineProperty(noeud, "rectangle", { configurable: true, get: () => boitePretee(noeud) });
    return noeud;
  };
}

/**
 * Ce que vise la bulle, lu dans ce que le code a écrit (--bulle-haut,
 * --bulle-fleche, relatifs au cadre), contre les boîtes de la fin du rendu :
 * l'écart de la pointe de sa flèche au milieu de la case, et si elle est
 * entière dans la fenêtre.
 */
function viseeDeLaBulle(ecran, nomDeCase) {
  const bulle = laBulle(ecran);
  const px = (nom) => {
    const valeur = bulle.style.getPropertyValue(nom);
    assert.match(valeur, /^-?\d+px$/, `${nom} : « ${valeur} »`);
    return Number.parseInt(valeur, 10);
  };
  const duCadre = cadre(ecran).getBoundingClientRect();
  const visee = laCase(ecran, nomDeCase).getBoundingClientRect();
  const taille = bulle.getBoundingClientRect();
  const { clientWidth, clientHeight } = document.documentElement;
  const gauche = duCadre.left + px("--bulle-gauche");
  const haut = duCadre.top + px("--bulle-haut");
  return {
    ecartDeLaFleche: px("--bulle-haut") + px("--bulle-fleche") - ((visee.top + visee.bottom) / 2 - duCadre.top),
    entiere: gauche >= MARGE_DE_LA_FENETRE && gauche + taille.width <= clientWidth - MARGE_DE_LA_FENETRE && haut >= MARGE_DE_LA_FENETRE && haut + taille.height <= clientHeight - MARGE_DE_LA_FENETRE,
  };
}

dansUnePage("la bulle — rouverte d'elle-même au rechargement en plein jet, elle se place après le bandeau qui paraît au même rendu : sa flèche vise le milieu de la case que le bandeau a poussée ; un dé ne la replace pas (captures finales, D-2)", async (page) => {
  const lieu = lieuSimule();
  // Le combat de référence gardé en plein premier geste, deux dés lancés : la Frappe d'Aubépine, sur C3.
  await poserEnBase(lieu, texteDuCombat({ geste: 1, des: 2 }, 3));
  preterLesBoites();
  const { ecran, des } = await ouvrirLEcran(page, { magasin: await lieu.onglet(), des: [8] });
  const bulle = laBulle(ecran);
  assert.equal(bulleMontree(ecran), true, "la bulle se rouvre d'elle-même");
  assert.ok(bulle.className.split(" ").includes("combat-bulle-jet"), `sur le jet : ${bulle.className}`);
  assert.ok(un(laCase(ecran, "C3"), ".combat-jeton").className.split(" ").includes("joue"), "C3 est la case de qui joue");
  assert.equal(cache(un(ecran, "div.combat-bandeau")), false, "le bandeau paraît au même rendu, au-dessus de la carte");
  assert.deepEqual(bulle.style.ecritures.map(([nom]) => nom), ["--bulle-gauche", "--bulle-haut", "--bulle-fleche"], "placée une fois, au rendu qui l'ouvre");
  assert.ok(bulle.className.split(" ").includes("combat-bulle-droite"), bulle.className);
  assert.deepEqual(viseeDeLaBulle(ecran, "C3"), { ecartDeLaFleche: 0, entiere: true }, "la flèche vise le milieu de la case, sous le bandeau ; placée avant lui, l'écart valait sa hauteur");
  // Le dé suivant refait le corps de la bulle sans la replacer : jamais à un dé (contrat, § 9.3).
  await cliquer(deACliquer(ecran));
  assert.deepEqual(des.reste(), [], "le troisième dé est tombé");
  assert.equal(bulleMontree(ecran), true);
  assert.equal(bulle.style.ecritures.length, 3, "un dé ne replace pas la bulle");
});

dansUnePage("la bulle — rouverte au rechargement à 13 500 événements, elle se place après la zone d'avis qui dit la limite au même rendu : entière dans la fenêtre, sa flèche au milieu de la case", async (page) => {
  const lieu = lieuSimule();
  // Le long combat finit sur la Frappe d'Aubépine ouverte : le jet attend, et la limite se dit à l'ouverture.
  await poserEnBase(lieu, texteDuLongCombat(EVENEMENTS_ALERTE + 2));
  preterLesBoites();
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  const bulle = laBulle(ecran);
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [LIMITE], "la limite, dite dans la zone d'avis au même rendu : elle pousse le cadre");
  assert.equal(bulleMontree(ecran), true, "la bulle se rouvre d'elle-même");
  assert.ok(bulle.className.split(" ").includes("combat-bulle-jet"), `sur le jet : ${bulle.className}`);
  assert.deepEqual(bulle.style.ecritures.map(([nom]) => nom), ["--bulle-gauche", "--bulle-haut", "--bulle-fleche"], "placée une fois, au rendu qui l'ouvre");
  assert.deepEqual(viseeDeLaBulle(ecran, "C3"), { ecartDeLaFleche: 0, entiere: true }, "placée après l'avis, la bulle tient dans la fenêtre ; avant lui, l'avis la poussait sous son bord");
});

// ─── Au groupe 2 : le journal, le bandeau ───────────────────────────────────

// Les corrections de la relecture du groupe 2 (C-01, C-02, C-06, C-14).

dansUnePage("la bulle — la liste d'une case : Maj+Tab depuis son premier jeton rend le focus au « +k » qui l'a ouverte, l'appui pris ; Échap depuis ce « +k » la ferme ; ouverte pendant une action, de même, sans passer par le jeton de l'acteur", async (page) => {
  const { ecran } = await combatLance(page, { serres: true });
  // Quatre jetons sur D4 : un « +1 » sur un grand écran.
  const plus = () => un(laCase(ecran, "D4"), "button.combat-plus-large");
  const liste = () => un(laBulle(ecran), ".combat-case-liste");
  const majTab = (cible) => {
    let empeche = false;
    laBulle(ecran).declencher("keydown", {
      key: "Tab",
      shiftKey: true,
      target: cible,
      preventDefault() {
        empeche = true;
      },
    });
    return empeche;
  };

  // Depuis « Qui joue ? » : personne ne joue, la bulle s'ouvre pour la liste seule.
  await cliquer(plus());
  assert.equal(majTab(tous(liste(), "button")[0]), true, "l'appui est pris, et non avalé");
  focusSur(plus(), "Maj+Tab rend le focus au « +k » de la case");
  assert.equal(bulleMontree(ecran), true, "la bulle reste ouverte");
  // Échap depuis ce « +k » : la liste se ferme, le focus y reste.
  assert.equal(echap(ecran), true, "Échap est pris depuis le « +k »");
  assert.equal(bulleMontree(ecran), false);
  focusSur(plus(), "le focus au « +k »");

  // Pendant l'action d'Aubépine : la liste prend la place de la sienne ; Maj+Tab mène au « +k », non au jeton d'Aubépine.
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(plus());
  assert.equal(majTab(tous(liste(), "button")[0]), true);
  focusSur(plus(), "pendant une action aussi, le « +k » qui l'a ouverte");
  assert.equal(echap(ecran), true);
  assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions", "la bulle rend ce qu'elle montrait");
  assert.equal(tous(laBulle(ecran), ".combat-case-liste").length, 0);
  focusSur(plus());
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("la bulle — Échap ferme l'infobulle d'une ligne survolée même quand le focus est hors de la bulle, sans le bouger ; les seules hachures de « Jet d'attaque » s'effacent au premier Échap, la bulle se ferme au second", async (page) => {
  const { ecran } = await combatLance(page);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  const portees = () => tous(ecran, ".combat-case").filter((noeud) => noeud.className.split(" ").includes("portee")).length;
  // « Taloche [1] » survolée à la souris, le focus sur le résumé de la fiche d'Aubépine.
  const taloche = boutonDeCapacite(ecran, "Taloche [1]");
  const id = taloche.getAttribute("aria-describedby").split(" ").find((nom) => nom.startsWith("combat-info-"));
  const info = un(laBulle(ecran), `#${id}`);
  taloche.declencher("pointerenter", { pointerType: "mouse" });
  assert.equal(cache(info), false, "le survol l'ouvre");
  const resume = un(fiche(ecran, "pj1"), "summary");
  resume.focus({ preventScroll: true });
  const focusAvant = document.focalisations.length;
  assert.equal(echap(ecran), true, "Échap est pris");
  assert.equal(cache(info), true, "l'infobulle se ferme");
  assert.equal(portees(), 0, "ses hachures avec elle");
  assert.equal(bulleMontree(ecran), true, "la bulle reste");
  focusSur(resume, "le focus ne bouge pas");
  assert.equal(document.focalisations.length, focusAvant);

  // Fournaise [1] : le jet se prête ; « Jet d'attaque » survolé ne montre que ses hachures. Le focus est dans la bulle.
  await cliquer(boutonDeCapacite(ecran, "Fournaise [1]"));
  const pret = boutonCommencant(un(corps(ecran), ".combat-jet-prete"), "Jet d'attaque");
  pret.declencher("pointerenter", { pointerType: "mouse" });
  assert.ok(portees() > 0, "les hachures de la portée de l'arme");
  assert.ok(laBulle(ecran).contains(document.activeElement), "le focus est dans la bulle");
  const focusDansLaBulle = document.activeElement;
  assert.equal(echap(ecran), true);
  assert.equal(portees(), 0, "le premier Échap efface les hachures");
  assert.equal(bulleMontree(ecran), true, "et laisse la bulle");
  focusSur(focusDansLaBulle, "sans bouger le focus");
  assert.equal(echap(ecran), true);
  assert.equal(bulleMontree(ecran), false, "le second ferme la bulle");
  focusSur(jeton(ecran, "Aubépine Crèmebrûlée"), "le focus au jeton");
});

dansUnePage("« Annuler le dernier geste » — inactif pendant un geste non payé (« Revenez d'abord… »), son clic ne demande rien, même quand le clic au-dehors, qui ferme la bulle, le rend actif ; le focus reste sur lui", async (page) => {
  const { ecran } = await combatLance(page, { des: desDe(scenario.gestes.slice(0, 1)) });
  const bouton = () => un(barre(ecran), "button.combat-annuler-geste");
  await jouerLeGeste(ecran, scenario.gestes[0]);
  assert.equal(inactif(bouton()), false, "un geste à défaire");
  const ouvrirLaFrappe = async () => {
    await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
    await cliquer(boutonDeCapacite(ecran, "Frappe"));
    assert.equal(inactif(bouton()), true);
    assert.equal(raisonDe(ecran, bouton()), "Revenez d'abord sur le geste en cours.");
    assert.equal(bulleMontree(ecran), true);
  };
  await ouvrirLaFrappe();
  await cliquer(bouton());
  assert.equal(tous(ecran, ".confirmation").length, 0, "un bouton montré inactif n'ouvre pas sa question");
  assert.equal(bulleMontree(ecran), false, "le clic, hors de la bulle et de la carte, la ferme (compl. § 4.1)");
  focusSur(bouton(), "le focus reste sur le bouton");
  assert.equal(inactif(bouton()), false, "la bulle fermée, il redevient actif");

  // Le clic touche son signe « ↶ » : c'est le bouton, inactif, qui a été touché.
  await ouvrirLaFrappe();
  globalThis.document.activeElement = bouton();
  await auPlus(Promise.all(ecran.declencher("click", { target: un(bouton(), "span.combat-signe") })), "le clic, vu en capture");
  await auPlus(Promise.all(bouton().click()), "le clic sur le bouton");
  assert.equal(tous(ecran, ".confirmation").length, 0, "par son signe non plus");
  assert.equal(bulleMontree(ecran), false);
  // Actif, son clic pose la question, comme avant.
  await cliquer(bouton());
  assert.equal(tous(ecran, ".confirmation").length, 1);
});

dansUnePage(
  "la bulle — ouverte par un appui du doigt sur le jeton, le focus sur sa première ligne n'ouvre ni infobulle ni hachure, sur un téléphone (le volet) comme au-delà de 56rem ; ouverte au clavier, Entrée sur le jeton, il l'ouvre (focus fidèle)",
  async () => {
    for (const etroit of [true, false]) {
      const { ecran } = await combatLance(await pageNeuve(), { etroit });
      const quand = etroit ? "sous 56rem, le volet" : "à 56rem et plus, la bulle";
      const montrees = () => tous(laBulle(ecran), "div.combat-infobulle").filter((noeud) => !cache(noeud)).length;
      const portees = () => tous(ecran, ".combat-case").filter((noeud) => noeud.className.split(" ").includes("portee")).length;
      // L'appui du doigt sur le jeton, puis son clic.
      ecran.declencher("pointerdown", { pointerType: "touch", target: jeton(ecran, "Aubépine Crèmebrûlée") });
      await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
      assert.equal(bulleMontree(ecran), true, quand);
      focusSur(premiereLigne(ecran), `${quand} : le focus à la première ligne`);
      assert.equal(montrees(), 0, `${quand} : aucune infobulle au doigt`);
      assert.equal(portees(), 0, `${quand} : aucune hachure au doigt`);
      await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));
      assert.equal(bulleMontree(ecran), false);
      // Entrée sur le jeton : le clavier.
      ecran.declencher("keydown", { key: "Enter", target: jeton(ecran, "Aubépine Crèmebrûlée"), preventDefault() {} });
      await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
      focusSur(premiereLigne(ecran), `${quand} : au clavier, le focus à la première ligne`);
      assert.equal(montrees(), 1, `${quand} : au clavier, l'infobulle de la première ligne`);
      assert.ok(portees() > 0, `${quand} : et ses hachures`);
    }
  },
  { focusFidele: true },
);

dansUnePage("le bandeau — caché avant le lancement ; la dernière ligne ; pendant un geste, sa ligne en cours ; « Journal ↓ » et le clic à la souris montrent le journal, seul défilement de l'écran", async (page) => {
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des: desDe(scenario.gestes.slice(0, 1)) });
  await preparerLaReference(ecran);
  const bandeau = un(ecran, "div.combat-bandeau");
  assert.equal(cache(bandeau), true, "avant le lancement, il n'est pas montré");
  await lancerLeCombat(ecran);
  assert.equal(cache(bandeau), false);
  memeNoeud(bandeau.parentNode, cadre(ecran), "le bandeau, dans le cadre");
  assert.equal(bandeau.className, "combat-bandeau");
  assert.equal(texteDe(un(bandeau, ".combat-bandeau-etiquette")), "Dernier événement");
  assert.equal(texteDe(un(bandeau, ".combat-bandeau-texte")), journalAttendu[1]);
  assert.equal(un(bandeau, ".combat-bandeau-texte").getAttribute("aria-hidden"), "true", "le texte coupé est caché aux lecteurs d'écran");
  assert.equal(texteDe(un(bandeau, ".combat-bandeau-entier")), journalAttendu[1], "la ligne entière le suit, cachée à la vue");
  assert.equal(bandeau.getAttribute("title"), journalAttendu[1]);
  // Ni bouton, ni région.
  assert.equal(bandeau.hasAttribute("role"), false);
  assert.equal(bandeau.hasAttribute("aria-live"), false);

  // Pendant un geste, après le premier dé seulement : la ligne en cours, le début de celle qui s'écrira, suivi de « … ».
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  assert.equal(bandeau.className, "combat-bandeau", "avant le premier dé, la dernière ligne du journal");
  await cliquer(deACliquer(ecran));
  assert.equal(bandeau.className, "combat-bandeau combat-bandeau-en-cours");
  const enCours = texteDe(un(bandeau, ".combat-bandeau-entier"));
  assert.ok(enCours.endsWith(POINTS), enCours);
  assert.ok(journalAttendu[2].startsWith(enCours.slice(0, -1)), `« ${enCours} » débute la ligne qui s'écrira`);
  assert.ok(tous(bandeau, ".combat-cadre-jet").length >= 1, "les dés du jet, encadrés");
  await cliquer(deACliquer(ecran));
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), "Appliquer"));
  assert.equal(bandeau.className, "combat-bandeau", "le geste fini, sa ligne définitive la remplace");
  assert.equal(texteDe(un(bandeau, ".combat-bandeau-entier")), journalAttendu[2]);

  // « Journal ↓ » : un bouton, jamais un lien ; le journal se montre, et son titre reçoit le focus, sans défiler de nouveau.
  const versLeJournal = un(bandeau, "button.combat-bandeau-journal");
  assert.equal(texteDe(versLeJournal), `Journal ${String.fromCodePoint(0x2193)}`);
  assert.deepEqual(defilementsDits(), []);
  await cliquer(versLeJournal);
  const zoneDuJournal = un(ecran, "section.combat-journal");
  assert.deepEqual(defilementsDits(), [{ noeud: decrire(zoneDuJournal), options: { block: "start" } }]);
  memeNoeud(document.defilements[0].noeud, zoneDuJournal, "le journal se montre");
  focusSur(un(ecran, "#combat-journal-titre"));
  assert.deepEqual(document.focalisations.at(-1).options, { preventScroll: true });
  assert.equal(bulleMontree(ecran), false, "un clic hors de la bulle l'a fermée");
  // Un clic à la souris sur le reste du bandeau fait de même ; au doigt, rien : un doigt qui balaie la page n'y saute pas.
  const texte = un(bandeau, ".combat-bandeau-texte");
  bandeau.declencher("pointerdown", { pointerType: "touch" });
  bandeau.declencher("click", { target: texte });
  assert.equal(document.defilements.length, 1, "au doigt, rien");
  bandeau.declencher("pointerdown", { pointerType: "mouse" });
  bandeau.declencher("click", { target: texte });
  assert.equal(document.defilements.length, 2, "à la souris, le journal");
  focusSur(un(ecran, "#combat-journal-titre"));
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("le bandeau — trois lignes au plus : la mesure de l'écran (tient), refaite quand la largeur change (surveiller) ; chaque morceau ôté devient « […] »", async (page) => {
  // La mesure, prêtée : un budget de signes, que le contrôle change ; la surveillance, relevée.
  let budget = 1000;
  const mesures = [];
  const surveilles = [];
  const tient = (noeud) => (mesures.push(noeud), texteDe(noeud).length <= budget);
  const surveiller = (noeud, rappel) => {
    surveilles.push({ noeud, rappel });
    return () => {};
  };
  const { ecran } = await ouvrirLEcran(page, { magasin: magasinCombatMemoire(), des: desDe(scenario.gestes.slice(0, 1)), tient, surveiller });
  await preparerLaReference(ecran);
  await lancerLeCombat(ecran);
  const bandeau = un(ecran, "div.combat-bandeau");
  const texte = un(bandeau, ".combat-bandeau-texte");
  assert.deepEqual(surveilles.map(({ noeud }) => noeud), [texte], "l'écran surveille la taille du texte du bandeau");
  assert.ok(mesures.length > 0 && mesures.every((noeud) => noeud === texte), "la mesure porte sur le texte du bandeau");
  await jouerLeGeste(ecran, scenario.gestes[0]);
  assert.equal(texteDe(texte), journalAttendu[2], "tout tient : la ligne entière");
  assert.equal(tous(texte, ".combat-bandeau-coupe").length, 0);

  // La largeur change (le budget avec elle) : la coupe se refait, la première phrase et celle du jet gardées.
  budget = 150;
  texte.rectangle = { left: 0, top: 0, width: 320, height: 60 };
  surveilles[0].rappel();
  assert.ok(tous(texte, ".combat-bandeau-coupe").length >= 1, texteDe(texte));
  assert.ok(texteDe(texte).length <= 150, texteDe(texte));
  assert.match(texteDe(texte), /^Aubépine : Frappe contre Marmiton n° 1\./);
  assert.ok(texteDe(texte).includes("[…]"));
  // La ligne entière reste pour les lecteurs d'écran et le titre.
  assert.equal(texteDe(un(bandeau, ".combat-bandeau-entier")), journalAttendu[2]);
  assert.equal(bandeau.getAttribute("title"), journalAttendu[2]);
  // La même largeur : rien ne se refait.
  const avant = mesures.length;
  surveilles[0].rappel();
  assert.equal(mesures.length, avant, "la mesure ne se refait qu'à une largeur neuve");
});

// ─── Au groupe 2 : « Annuler le dernier geste » ─────────────────────────────

dansUnePage("annuler — le bouton et ses trois raisons ; la question dans la page, « Garder » ; « Annuler le geste » défait le geste, le focus revient au bouton ; la ligne « Annulé », les lignes barrées ; jusqu'au lancement", async (page) => {
  const presse = pressePapiers();
  // La Frappe de référence, puis une seconde, qui touche (9 et 9), manque son second dé (1 et 1), puis tombe au torse (16).
  const { ecran } = await combatLance(page, { des: [...desDe(scenario.gestes.slice(0, 1)), 9, 9, 1, 1, 16], navigateur: presse.navigateur });
  const autres = un(barre(ecran), "div.combat-autres");
  const bouton = () => un(barre(ecran), "button.combat-annuler-geste");
  const barrees = () => tous(un(ecran, "ol.combat-lignes"), "li").map((li) => li.className.split(" ").includes("combat-annulee"));
  // Le bouton : « ↶ » caché aux lecteurs d'écran, une espace, le libellé ; à gauche de « Nouveau combat ».
  assert.equal(cache(bouton()), false, "montré dès le lancement");
  assert.deepEqual(tous(autres, "button").map(texteDe), [ANNULER_LE_DERNIER, "Nouveau combat"]);
  const signe = un(bouton(), "span.combat-signe");
  assert.deepEqual([signe.getAttribute("aria-hidden"), texteDe(signe)], ["true", String.fromCodePoint(0x21b6)]);
  assert.equal(bouton().className, "bouton secondaire combat-annuler-geste");
  // Rien à annuler depuis le lancement : inactif, avec sa raison ; son clic ne demande rien. Cette raison passe avant les deux autres.
  assert.equal(inactif(bouton()), true);
  assert.equal(raisonDe(ecran, bouton()), "Rien à annuler depuis le lancement.");
  await cliquer(bouton());
  assert.equal(tous(ecran, ".confirmation").length, 0);
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(raisonDe(ecran, bouton()), "Rien à annuler depuis le lancement.");
  await cliquer(boutonDit(corps(ecran), "Revenir"));

  // La Frappe de référence, jouée : le bouton s'active.
  await jouerLeGeste(ecran, scenario.gestes[0]);
  assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
  assert.match(texteDe(fiche(ecran, "adv3")), /11\/15/);
  assert.equal(inactif(bouton()), false);
  assert.equal(raisonDe(ecran, bouton()), "");
  // Un geste en cours, non payé : « Revenez d'abord… » ; payé : « Terminez d'abord… ».
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(corps(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  assert.equal(inactif(bouton()), true);
  assert.equal(raisonDe(ecran, bouton()), "Revenez d'abord sur le geste en cours.");
  await cliquer(deACliquer(ecran));
  assert.equal(raisonDe(ecran, bouton()), "Terminez d'abord le geste en cours.");
  await cliquer(deACliquer(ecran));
  await cliquer(deACliquer(ecran));
  await cliquer(boutonDit(corps(ecran), "Appliquer"));
  // La seconde Frappe a dépensé la dernière action d'Aubépine : le tour des PJ s'est fini de lui-même.
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  assert.equal(journal(ecran).length, 6);
  assert.equal(inactif(bouton()), false);

  // Son clic pose la question dans la page, à la place des boutons ; le focus sur « Garder ».
  await cliquer(bouton());
  const question = un(autres, ".confirmation");
  assert.equal(question.getAttribute("role"), "group");
  assert.equal(question.getAttribute("aria-labelledby"), "combat-question-annuler");
  assert.equal(texteDe(un(question, "#combat-question-annuler")), "Annuler ce geste : Aubépine — Frappe contre Marmiton n° 1 ? Ses dés seront perdus.");
  assert.deepEqual(tous(question, "button").map((b) => [texteDe(b), b.className]), [
    ["Annuler le geste", "bouton"],
    ["Garder", "bouton secondaire"],
  ]);
  focusSur(boutonDit(question, "Garder"));
  // « Garder » : rien ne change, le focus revient au bouton.
  await cliquer(boutonDit(question, "Garder"));
  assert.equal(tous(ecran, ".confirmation").length, 0);
  focusSur(bouton());
  assert.equal(journal(ecran).length, 6);

  // « Annuler le geste » : tout redevient ce qu'il était avant la seconde Frappe, fin du tour comprise ; le journal, lui, gagne sa ligne.
  await cliquer(bouton());
  await cliquer(boutonDit(un(autres, ".confirmation"), "Annuler le geste"));
  assert.equal(tous(ecran, ".confirmation").length, 0);
  focusSur(bouton(), "le focus revient au bouton « Annuler le dernier geste »");
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  assert.equal(journal(ecran).at(-1), "Annulé : Aubépine — Frappe.");
  assert.equal(annonce(ecran), "Annulé : Aubépine — Frappe.");
  assert.equal(bulleMontree(ecran), false, "personne n'est choisi : la bulle est fermée");
  assert.equal(titreDeLaZone(ecran), "Qui joue ?");
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 1 sur 2 · souffle 10/10"], "il lui reste l'action d'avant la seconde Frappe");
  await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));
  // Les lignes du geste (la Frappe, la fin du tour, le tour) sont barrées à l'écran ; la ligne « Annulé » ne l'est pas.
  assert.deepEqual(barrees(), [false, false, false, true, true, true, false]);
  // On le presse de nouveau : la Frappe de référence se défait à son tour, jusqu'au lancement.
  assert.equal(inactif(bouton()), false);
  await cliquer(bouton());
  assert.equal(texteDe(un(autres, "#combat-question-annuler")), "Annuler ce geste : Aubépine — Frappe contre Marmiton n° 1 ? Ses dés seront perdus.");
  await cliquer(boutonDit(un(autres, ".confirmation"), "Annuler le geste"));
  assert.deepEqual(barrees(), [false, false, true, true, true, true, false, false]);
  assert.doesNotMatch(texteDe(fiche(ecran, "adv3")), /11\/15/, "l'armure du Marmiton est rendue");
  // Il n'y a plus rien à annuler : le lancement ne se défait pas.
  assert.equal(inactif(bouton()), true);
  assert.equal(raisonDe(ecran, bouton()), "Rien à annuler depuis le lancement.");
  focusSur(bouton());
  await choisirQuiJoue(ecran, "Aubépine Crèmebrûlée");
  assert.deepEqual(enTete(ecran), ["Aubépine Crèmebrûlée", "actions restantes : 2 sur 2 · souffle 10/10"]);
  // Le texte copié garde toutes les lignes, sans barre.
  await cliquer(boutonDit(un(ecran, ".combat-journal"), "Copier"));
  assert.ok(presse.copies[0].endsWith(["Annulé : Aubépine — Frappe.", "Annulé : Aubépine — Frappe."].join("\n")));
  assert.ok(presse.copies[0].includes(journalAttendu[2]));
  assert.deepEqual(focusQuiDefilent(), []);
});

dansUnePage("annuler — une question ouverte se ferme quand il n'y a plus rien à annuler ; « Passer son tour » et la fin du tour se défont ; sur un téléphone, « ⋯ » reste ouvert", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  const autres = un(barre(ecran), "div.combat-autres");
  const plus = un(barre(ecran), "button.combat-plus-bouton");
  const bouton = () => un(barre(ecran), "button.combat-annuler-geste");
  // Aubépine passe son tour : le tour des PJ finit de lui-même.
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  await cliquer(boutonDit(corps(ecran), "Passer son tour"));
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des adversaires");
  // Sur un téléphone, le bouton est dans « ⋯ ».
  await cliquer(plus);
  assert.equal(autres.className, "combat-autres ouvert");
  await cliquer(bouton());
  assert.equal(texteDe(un(autres, "#combat-question-annuler")), "Annuler ce geste : Aubépine — passer son tour ?");
  // Pendant la question, un geste commence (le Chef choisit une capacité) : plus rien à annuler, la question se ferme.
  await cliquer(repere(fiche(ecran, "adv2"), "jouer"));
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  assert.equal(tous(ecran, ".confirmation").length, 0, "la question s'est fermée");
  assert.equal(raisonDe(ecran, bouton()), "Revenez d'abord sur le geste en cours.");
  await cliquer(boutonDit(corps(ecran), "Revenir"));
  await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));

  // « Annuler le geste » : la passe et la fin de tour qu'elle a entraînée se défont ; « ⋯ » reste ouvert, le bouton s'y voit.
  await cliquer(bouton());
  await cliquer(boutonDit(un(autres, ".confirmation"), "Annuler le geste"));
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
  assert.equal(journal(ecran).at(-1), "Annulé : Aubépine — passer son tour.");
  assert.deepEqual(tous(un(ecran, "ol.combat-lignes"), "li").map((li) => li.className.split(" ").includes("combat-annulee")), [false, false, true, true, true, false], "la passe, la fin du tour et le tour, barrés");
  assert.equal(autres.className, "combat-autres ouvert", "« ⋯ » reste ouvert sur un téléphone");
  focusSur(bouton());
  // « Fin de tour » se défait de même.
  await cliquer(boutonDit(barre(ecran), "Fin de tour"));
  await cliquer(bouton());
  assert.equal(texteDe(un(autres, "#combat-question-annuler")), "Annuler la fin du tour des PJ ?");
  await cliquer(boutonDit(un(autres, ".confirmation"), "Annuler le geste"));
  assert.equal(journal(ecran).at(-1), "Annulé : la fin du tour des PJ.");
  assert.equal(etatDuCombat(ecran), "Tour 1 · camp des PJ");
});

// ─── Au groupe 2 : la limite des événements ─────────────────────────────────

dansUnePage("limite — à 13 500 événements, la phrase sous la barre, et une fois par combat dans la zone d'avis", async (page) => {
  assert.equal(EVENEMENTS_ALERTE, 13500);
  const lieu = lieuSimule();
  await poserEnBase(lieu, texteDuLongCombat(EVENEMENTS_ALERTE + 1));
  const { ecran } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  const limite = un(ecran, "p.combat-limite");
  assert.equal(cache(limite), false);
  assert.equal(texteDe(limite), LIMITE);
  memeNoeud(ecran.children[ecran.children.indexOf(limite) - 1], barre(ecran), "sous la barre de titre");
  assert.deepEqual(tous(avis(ecran), "p").map(texteDe), [LIMITE], "dite une fois dans la zone d'avis");
  // Le geste suivant efface l'avis ; la phrase reste sous la barre, et ne se redit pas.
  await cliquer(boutonDit(zone(ecran), "Aubépine Crèmebrûlée"));
  assert.equal(avis(ecran).children.length, 0);
  assert.equal(texteDe(limite), LIMITE);
  await cliquer(un(laBulle(ecran), "button.combat-bulle-fermer"));
  assert.equal(avis(ecran).children.length, 0, "pas une seconde fois pour ce combat");
  // Une autre visite, le même combat en mémoire : elle ne se redit pas.
  const { ecran: revenue } = await ouvrirLEcran(page, { magasin: await lieu.onglet() });
  assert.equal(texteDe(un(revenue, "p.combat-limite")), LIMITE);
  assert.equal(avis(revenue).children.length, 0);

  // Sous 13 500, rien.
  const court = lieuSimule();
  await poserEnBase(court, texteDuLongCombat(EVENEMENTS_ALERTE - 1));
  const { ecran: sous } = await ouvrirLEcran(await pageNeuve(), { magasin: await court.onglet() });
  assert.equal(cache(un(sous, "p.combat-limite")), true);
  assert.equal(texteDe(un(sous, "p.combat-limite")), "");
  assert.equal(avis(sous).children.length, 0);
});

// ─── Au groupe 2 : le téléphone ─────────────────────────────────────────────

dansUnePage("téléphone — le volet porte la liste seule ; « Jouer » le ferme et le jet se joue sous la carte, sans ✕ ; la fenêtre élargie, le jet passe dans la bulle", async (page) => {
  const fenetre = guetterLaFenetre();
  try {
    let largeur = 390;
    globalThis.document.documentElement.clientWidth = largeur;
    const { ecran } = await combatLance(page, { etroit: () => largeur < 896, des: desDe(scenario.gestes.slice(0, 1)) });
    // Le volet : la liste seule, avec sa poignée, ✕ en dernier.
    await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
    const bulle = laBulle(ecran);
    assert.equal(bulleMontree(ecran), true);
    assert.deepEqual(bulle.children.map((noeud) => noeud.className.split(" ")[0]), ["combat-bulle-poignee", "combat-bulle-tete", "combat-bulle-defile", "combat-infobulles", "combat-bulle-fermer"]);
    assert.equal(un(bulle, ".combat-bulle-poignee").getAttribute("aria-hidden"), "true");
    focusSur(premiereLigne(ecran));
    assert.equal(zone(ecran).children.length, 0, "le volet ouvert, la zone sous la carte est vide");
    // « Jouer » (la ligne) : le volet se ferme, le jet se joue sous la carte, avec l'en-tête de la bulle, sans ✕ ni « – ».
    await cliquer(boutonDeCapacite(ecran, "Frappe"));
    assert.equal(bulleMontree(ecran), false);
    assert.deepEqual(enTete(ecran), ["Frappe", "Aubépine · action 1 sur 2 · souffle 10/10"]);
    assert.equal(tous(sousLaCarte(ecran), "button.combat-bulle-fermer").length, 0);
    assert.ok(tous(zone(ecran), ".combat-cibles button").length > 0, "les doubles des cibles, sous la carte");
    await cliquer(boutonDit(un(zone(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
    focusSur(deACliquer(ecran), "le focus au dé, sous la carte");
    await cliquer(deACliquer(ecran));
    assert.equal(bulleMontree(ecran), false, "après le premier dé, le jet reste sous la carte");

    // La fenêtre s'élargit : l'écran se refait à la largeur, et le jet passe dans la bulle, réductible.
    largeur = 1280;
    fenetre.redimensionner(1280);
    assert.equal(bulleMontree(ecran), true, "sur un grand écran, le jet se joue dans la bulle");
    assert.equal(tous(bulle, ".combat-bulle-poignee").length, 0, "plus de poignée");
    assert.equal(texteDe(zone(ecran)), PHRASE_DE_LA_ZONE);
    assert.equal(un(bulle, "button.combat-bulle-fermer").getAttribute("aria-label"), "Réduire");
    // Le geste se finit dans la bulle.
    await cliquer(deACliquer(ecran));
    await cliquer(deACliquer(ecran));
    await cliquer(boutonDit(corps(ecran), "Appliquer"));
    assert.deepEqual(journal(ecran), journalAttendu.slice(0, 3));
    // Puis de nouveau étroite : la liste d'Aubépine, dans le volet.
    largeur = 390;
    fenetre.redimensionner(390);
    assert.equal(tous(bulle, ".combat-bulle-poignee").length, 1);
    assert.equal(nomDeLaBulle(ecran), "Aubépine Crèmebrûlée : ses actions");
    assert.deepEqual(focusQuiDefilent(), []);
    assert.deepEqual(defilementsDits(), []);
  } finally {
    fenetre.retirer();
  }
});

dansUnePage("téléphone — sous la carte, Échap ferme l'infobulle d'une cause, sans bouger le focus ; l'écran ne pose aucun écouteur global", async (page) => {
  const { ecran } = await combatLance(page, { etroit: true });
  await cliquer(jeton(ecran, "Aubépine Crèmebrûlée"));
  await cliquer(boutonDeCapacite(ecran, "Frappe"));
  await cliquer(boutonDit(un(zone(ecran), ".combat-cibles"), "Marmiton de corvée n° 1"));
  // Le nombre des avantages et des désavantages, sous la carte : son focus ouvre l'infobulle de ses causes.
  const cause = un(zone(ecran), "button.combat-cause");
  cause.declencher("focus");
  const ouvertes = () => tous(sousLaCarte(ecran), "div.combat-infobulle").filter((noeud) => !cache(noeud));
  assert.equal(ouvertes().length, 1, "l'infobulle de la cause, dans la couche de la zone");
  assert.equal(ouvertes()[0].parentNode.className, "combat-infobulles");
  const focusAvant = document.focalisations.length;
  assert.equal(echap(ecran), true);
  assert.equal(ouvertes().length, 0);
  assert.equal(document.focalisations.length, focusAvant, "le focus ne bouge pas");
  // Rien d'autre à fermer : la bulle est cachée, Échap n'est plus pris.
  assert.equal(echap(ecran), false);
});

// ─── Au groupe 2 : les services de la page ──────────────────────────────────

test("les services — leurs défauts sont ceux de la page : la fenêtre du document, la hauteur de ligne, ResizeObserver, setTimeout ; la séance reçoit rendreLaMain, la rencontre son magasin", () => {
  assert.match(SOURCE, /fenetre: services\.fenetre \?\? fenetreDeLaPage,/);
  assert.match(SOURCE, /tient: services\.tient \?\? tientEnTroisLignes,/);
  assert.match(SOURCE, /surveiller: services\.surveiller \?\? surveillerLaTaille,/);
  assert.match(SOURCE, /minuteur: services\.minuteur \?\? MINUTEUR_DE_LA_PAGE,/);
  assert.match(SOURCE, /rendreLaMain: services\.rendreLaMain,/);
  assert.match(SOURCE, /\.charger\(contexte, \{ magasin: services\.magasinRencontre \}\)/);
  assert.match(SOURCE, /documentElement[\s\S]{0,80}clientWidth[\s\S]{0,40}clientHeight/);
  assert.match(SOURCE, /noeud\.scrollHeight <= 3 \* ligne \+ 1/);
  assert.match(SOURCE, /getComputedStyle\?\.\(noeud\)\?\.lineHeight/);
  assert.match(SOURCE, /new globalThis\.ResizeObserver\(/);
  assert.match(SOURCE, /globalThis\.setTimeout\(faire, ms\)/);
  assert.match(SOURCE, /lirePersonnageDeDemonstration\("demo", \{ fetch: services\.fetch \}\)/);
  assert.match(SOURCE, /garderRecu\(contexte\.etat\.etagere, lu\.personnage, zone, \{ sansDefiler: true \}\)/);
});
