// Contrôles des écrans, construits dans un document simulé
// (SPECIFICATION.md, § 9 et § 11, domaine Site).
//
// Le bouton « Publier » de l'espace auteur, toujours présent, et la raison
// qu'il porte tant qu'il est inactif ; la veille du chargement ; l'aide pour
// l'écran d'accueil. Aucun appel réel à GitHub : fetch est simulé.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";
import { importerFichier } from "../js/banque/importation.js";
import { CHEMIN_INDEX, cheminDuPersonnage, chiffrerPersonnage, dechiffrerPersonnage, ecrireFichier, ecrireIndex, ecrireTicket, fichierDuTicket, lireFichier, lireTicket } from "../js/personnage/en_ligne.js";
import { CHEMIN_BANQUE, texteDeLaBanque } from "../js/publication/github.js";
import { chiffrer, nouveauSecret, ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { DATE_ESSAI, personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const ESSAI = readFileSync(new URL("essais/classeur_essai.xlsx", RACINE));
const DEMO = JSON.parse(lire("essais/banque_demo.chiffree.json"));

const RAISONS = {
  demo: "Démonstration : rien n'est publié.",
  cle: "Clé GitHub absente : saisissez-la d'abord.",
  importer: "Importez d'abord un classeur.",
  comparer: "Comparez d'abord.",
  cocher: "Cochez la case « Je publie en connaissance de cause ».",
};

// Chaque état part d'un espace auteur neuf : son état vit dans le module.
let instance = 0;
async function espaceAuteur(etat, publiee = () => {}) {
  instance += 1;
  const module = await import(`../js/ecrans/espace_auteur.js?instance=${instance}`);
  const contexte = { etat, publiee };
  const ecran = module.afficher(contexte);
  document.body.replaceChildren(ecran);
  await laisserFiler();
  return { ecran, module };
}

// Le bouton « Publier » (ou « Republier… ») et sa raison, lus dans l'écran.
function publier(ecran) {
  const trouves = [...boutons(ecran, "Publier"), ...boutons(ecran, "Republier")];
  assert.equal(trouves.length, 1, "un seul bouton « Publier »");
  const [bouton] = trouves;
  const raison = ecran.querySelector(`#${bouton.getAttribute("aria-describedby")}`);
  assert.ok(raison, "la raison est reliée au bouton par aria-describedby");
  assert.ok(bouton.parentNode.parentNode.className.includes("barre-publication"), "le bouton est dans la barre de publication");
  return { bouton, raison: raison.hidden ? null : texteDe(raison) };
}

async function importer(ecran) {
  const entree = ecran.querySelector("#classeur");
  entree.files = [{ name: "classeur_essai.xlsx", arrayBuffer: async () => ESSAI.buffer.slice(ESSAI.byteOffset, ESSAI.byteOffset + ESSAI.byteLength) }];
  await Promise.all(entree.declencher("change"));
  await laisserFiler();
}

test("espace auteur — le bouton « Publier » est toujours là, et dit pourquoi il est inactif (§ 9)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    // Démonstration : avant l'import, puis après « Comparer » (l'essai 8).
    let { ecran } = await espaceAuteur({ mode: "demo", coffre: creerCoffre(magasinMemoire()), chargement: { enveloppe: DEMO }, secret: null });
    assert.equal(publier(ecran).raison, RAISONS.demo);
    assert.equal(publier(ecran).bouton.disabled, true);

    // Clé GitHub absente : la saisie de la clé, et le bouton inactif.
    ({ ecran } = await espaceAuteur({ mode: "reel", coffre: creerCoffre(magasinMemoire()), chargement: { absente: true }, secret: null }));
    assert.ok(ecran.querySelector("#jeton"), "la saisie de la clé");
    assert.match(texteDe(ecran), /Expiration : un an/, "un jeton valable un an (§ 8.1)");
    assert.equal(publier(ecran).raison, RAISONS.cle);
    assert.equal(publier(ecran).bouton.disabled, true);

    // Clé gardée, aucun classeur importé.
    const coffre = creerCoffre(magasinMemoire());
    await coffre.garderJeton("jeton-fictif-de-controle");
    const secret = await nouveauSecret("une phrase de controle assez longue");
    ({ ecran } = await espaceAuteur({ mode: "reel", coffre, chargement: { absente: true }, secret }));
    assert.equal(publier(ecran).raison, RAISONS.importer);
    assert.equal(publier(ecran).bouton.disabled, true);
    const comparer = boutons(ecran, "Comparer")[0];
    assert.equal(comparer.disabled, true);

    // Classeur importé, pas encore comparé.
    await importer(ecran);
    assert.equal(publier(ecran).raison, RAISONS.comparer);
    assert.equal(publier(ecran).bouton.disabled, true);

    // Comparé : le classeur d'essai a des erreurs, la case est à cocher.
    // GitHub simulé : aucun fichier publié (404), et aucune écriture permise.
    const requetes = [];
    globalThis.fetch = async (adresse, init = {}) => {
      requetes.push(init.method ?? "GET");
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    };
    boutons(ecran, "Comparer")[0].click();
    for (let i = 0; i < 50 && !ecran.querySelector("#connaissance"); i += 1) await laisserFiler(20);
    assert.equal(publier(ecran).raison, RAISONS.cocher);
    assert.equal(publier(ecran).bouton.disabled, true);
    const coche = ecran.querySelector("#connaissance");
    coche.checked = true;
    coche.declencher("change");
    assert.equal(publier(ecran).raison, null, "coché : plus de raison");
    assert.equal(publier(ecran).bouton.disabled, false);
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);
    assert.deepEqual(requetes, ["GET"], "rien n'a été écrit");
    assert.equal(publier(ecran).raison, RAISONS.comparer);

    // Démonstration, classeur importé et comparé : toujours inactif (essai 8).
    ({ ecran } = await espaceAuteur({ mode: "demo", coffre: creerCoffre(magasinMemoire()), chargement: { enveloppe: DEMO }, secret: null }));
    await importer(ecran);
    assert.equal(publier(ecran).raison, RAISONS.demo);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — la barre de publication reste à l'écran (§ 9)", () => {
  const ecran = lire("css/ecran.css");
  const regle = ecran.match(/\.barre-publication\s*\{([^}]*)\}/);
  assert.ok(regle, "règle .barre-publication");
  assert.match(regle[1], /position:\s*sticky/);
  assert.match(regle[1], /bottom:\s*0/);
  assert.match(regle[1], /background:\s*var\(--fond\)/, "un fond opaque");
});

// La veille : un script classique, exécuté tel quel dans un contexte à
// part, sur un écran qui montre encore un chargement ou non.
function veiller({ chargement }) {
  const retirer = installerDom();
  const ecran = document.createElement("main");
  ecran.setAttribute("id", "ecran");
  const contenu = document.createElement(chargement ? "p" : "h1");
  if (chargement) contenu.setAttribute("data-chargement", "");
  contenu.append(chargement ? "Chargement de l'Atelier…" : "L'Atelier des Arpenteurs");
  ecran.append(contenu);
  document.body.replaceChildren(ecran);
  const planifies = [];
  const recharges = [];
  vm.runInNewContext(lire("js/veille.js"), {
    document,
    setTimeout: (fonction, delai) => planifies.push({ fonction, delai }),
    location: { reload: () => recharges.push(true) },
  });
  return { ecran, planifies, recharges, retirer };
}

test("chargement — au bout de 15 secondes, « Mise à jour en cours » et « Recharger » (§ 9)", () => {
  const index = lire("index.html");
  // La veille se charge en script classique, avant les modules.
  const veille = index.indexOf('<script src="js/veille.js" defer></script>');
  assert.ok(veille > 0, "index.html charge js/veille.js en script classique, différé");
  assert.ok(veille < index.indexOf('<script type="module"'), "avant les modules");
  // Chaque « Chargement » de la page porte data-chargement.
  const chargements = [...`${index}\n${lire("js/application.js")}`.matchAll(/^.*Chargement de .*$/gm)].map(([ligne]) => ligne);
  assert.ok(chargements.length >= 2);
  for (const ligne of chargements) assert.match(ligne, /data-chargement/, ligne.trim());

  // Resté sur « Chargement » : le message et le bouton.
  const essai = veiller({ chargement: true });
  try {
    assert.equal(essai.planifies.length, 1);
    assert.equal(essai.planifies[0].delai, 15_000);
    essai.planifies[0].fonction();
    assert.equal(texteDe(essai.ecran.querySelector("p")), "Mise à jour en cours : rechargez dans quelques minutes.");
    const [recharger] = boutons(essai.ecran, "Recharger");
    assert.ok(recharger, "le bouton « Recharger »");
    recharger.click();
    assert.equal(essai.recharges.length, 1);
  } finally {
    essai.retirer();
  }
});

test("chargement — la veille ne touche pas à une page chargée", () => {
  const essai = veiller({ chargement: false });
  try {
    essai.planifies[0].fonction();
    assert.equal(texteDe(essai.ecran), "L'Atelier des Arpenteurs");
    assert.equal(boutons(essai.ecran, "Recharger").length, 0);
  } finally {
    essai.retirer();
  }
});

test("accueil — l'aide dit d'ajouter l'Atelier depuis son accueil (§ 9)", async () => {
  const retirer = installerDom();
  try {
    const accueil = await import("../js/ecrans/accueil.js");
    const contexte = {
      etat: { mode: "reel", chargement: { absente: true }, coffre: creerCoffre(magasinMemoire()), derivation: null, stockage: null },
      dernierePublication: () => null,
      stockageMemorise: () => null,
    };
    const ecran = accueil.afficherSansBanque(contexte);
    document.body.replaceChildren(ecran);
    await laisserFiler();
    const aide = ecran.querySelector(".aide-ecran-accueil");
    assert.ok(aide, "l'aide est sur l'accueil");
    assert.match(texteDe(aide), /depuis cet accueil de l'Atelier/);
    assert.match(texteDe(aide), /depuis une fiche/);
  } finally {
    retirer();
  }
});

// — La revue de sécurité du groupe 3 : les secrets dans les écrans

const PHRASE = "une phrase de controle assez longue";
const JETON = "jeton-fictif-de-controle";

// GitHub simulé, en lecture seule : le fichier publié (ou 404), et chaque
// méthode notée ; une écriture est refusée, et se verrait. Avec ecriture, le
// PUT est accepté, et son corps gardé (github.ecrit).
function simulerGithub(enveloppe = null, { ecriture = false } = {}) {
  const github = { methodes: [], ecrit: null };
  github.fetch = async (adresse, init = {}) => {
    const methode = init.method ?? "GET";
    github.methodes.push(methode);
    if (methode === "PUT" && ecriture) {
      github.ecrit = JSON.parse(init.body);
      return new Response(JSON.stringify({ content: { sha: "sha-ecrit" }, commit: { sha: "c".repeat(40) } }), { status: 200 });
    }
    if (methode !== "GET") return new Response(JSON.stringify({ message: "écriture interdite dans ce contrôle" }), { status: 403 });
    if (!enveloppe) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    const content = Buffer.from(JSON.stringify(enveloppe)).toString("base64");
    return new Response(JSON.stringify({ sha: "sha-publie", encoding: "base64", content }), { status: 200 });
  };
  return github;
}

async function attendre(condition, message) {
  for (let i = 0; i < 200; i += 1) {
    if (condition()) return;
    await laisserFiler(10);
  }
  assert.fail(message);
}

const differencesAffichees = (ecran) => texteDe(ecran).includes("Différences avec la banque publiée");
const formulaireDe = (ecran, id) => ecran.querySelectorAll("form").find((f) => f.querySelector(`#${id}`));

async function soumettre(formulaire) {
  await Promise.allSettled(formulaire.declencher("submit"));
  await laisserFiler();
}

// Un espace auteur réel, clé GitHub gardée, devant une banque publiée
// chiffrée sous PHRASE (et sa clé gardée), ou devant aucune banque.
async function espaceReel({ publiee = true, garder, coffre = creerCoffre(magasinMemoire()) } = {}) {
  const secret = await nouveauSecret(PHRASE);
  const { banque } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const enveloppe = publiee ? await chiffrer({ ...banque, publiee_le: "2026-09-28T14:32:00+02:00" }, secret) : null;
  await coffre.garderJeton(JETON);
  if (publiee) await coffre.garderCle("reel", secret);
  const etat = { mode: "reel", coffre, chargement: enveloppe ? { enveloppe } : { absente: true }, secret: publiee ? secret : null, garder };
  const github = simulerGithub(enveloppe);
  globalThis.fetch = github.fetch;
  const { ecran, module } = await espaceAuteur(etat);
  await importer(ecran);
  return { ecran, module, etat, coffre, github, secret };
}

async function comparer(ecran) {
  boutons(ecran, "Comparer")[0].click();
  await attendre(() => differencesAffichees(ecran) || ecran.querySelector("#mdp-auteur") || ecran.querySelector("[role=alert]"), "la comparaison n'aboutit pas");
}

test("espace auteur — après « Oublier le mot de passe », rien ne se déchiffre sans ressaisie (§ 7.2)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const { ecran, module, etat, coffre, github, secret } = await espaceReel();
    await comparer(ecran);
    assert.ok(differencesAffichees(ecran), "comparée avec la clé gardée");
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);

    // L'oubli, comme le fait l'accueil : le coffre, puis la copie en mémoire.
    await coffre.oublierCle("reel");
    etat.secret = null;
    await comparer(ecran);
    assert.ok(ecran.querySelector("#mdp-auteur"), "le mot de passe est redemandé");
    assert.equal(differencesAffichees(ecran), false, "rien n'est déchiffré");

    // Une confirmation en attente disparaît avec l'oubli de l'espace auteur.
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);
    etat.secret = secret;
    await comparer(ecran);
    assert.ok(differencesAffichees(ecran), "comparée de nouveau");
    module.oublier();
    await laisserFiler(20);
    assert.equal(differencesAffichees(ecran), false, "les différences déchiffrées ne restent pas à l'écran");
    assert.deepEqual([...new Set(github.methodes)], ["GET"], "rien n'a été écrit");
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
  // L'accueil appelle bien cet oubli de l'espace auteur.
  assert.match(lire("js/application.js"), /async oublier\(\) \{[^}]*espaceAuteur\.oublier\(\)/);
});

test("espace auteur — un oubli pendant la comparaison ne laisse ni clé ni différences", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    // Un coffre lent : il lit la clé gardée, puis l'oubli arrive avant
    // qu'il ne la rende.
    const coffre = creerCoffre(magasinMemoire());
    let lecture = null;
    const lent = {
      ...coffre,
      lireCle: async (mode) => {
        const cle = await coffre.lireCle(mode);
        await new Promise((resoudre) => {
          lecture = resoudre;
        });
        return cle;
      },
    };
    const { ecran, module, etat, github } = await espaceReel({ coffre: lent });
    etat.secret = null;
    boutons(ecran, "Comparer")[0].click();
    await attendre(() => lecture, "la clé gardée n'est pas lue");
    await coffre.oublierCle("reel");
    module.oublier();
    lecture();
    await laisserFiler(100);
    assert.equal(etat.secret, null, "la clé lue avant l'oubli ne revient pas en mémoire");
    assert.equal(differencesAffichees(ecran), false, "rien n'est déchiffré à l'écran");
    assert.deepEqual([...new Set(github.methodes)], ["GET"]);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — un oubli pendant la lecture de GitHub ne laisse aucune attente", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const { ecran, module } = await espaceReel();
    // GitHub répond lentement : l'oubli arrive avant sa réponse.
    let liberer;
    const porte = new Promise((resoudre) => {
      liberer = resoudre;
    });
    const simule = globalThis.fetch;
    globalThis.fetch = async (...parametres) => {
      await porte;
      return simule(...parametres);
    };
    boutons(ecran, "Comparer")[0].click();
    await laisserFiler(10);
    module.oublier();
    liberer();
    await laisserFiler(100);
    assert.equal(texteDe(ecran).includes("Calcul des différences"), false, "aucune attente orpheline");
    assert.equal(differencesAffichees(ecran), false);
    assert.equal(publier(ecran).raison, RAISONS.comparer);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — « Oublier la clé GitHub » annule la publication en attente", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const { ecran, github } = await espaceReel();
    await comparer(ecran);
    assert.ok(differencesAffichees(ecran));
    boutons(ecran, "Oublier la clé GitHub")[0].click();
    await laisserFiler(20);
    assert.ok(ecran.querySelector("#jeton"), "la clé est redemandée");
    ecran.querySelector("#jeton").value = "un-autre-jeton-fictif";
    await soumettre(formulaireDe(ecran, "jeton"));
    await laisserFiler(20);
    assert.equal(differencesAffichees(ecran), false, "la confirmation de l'ancien circuit ne revient pas");
    assert.equal(publier(ecran).raison, RAISONS.comparer);
    assert.deepEqual([...new Set(github.methodes)], ["GET"], "aucune écriture avec le jeton oublié");
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — la clé n'est gardée sur l'appareil que si « Se souvenir » l'a permis (§ 7.2)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    for (const [garder, gardee] of [
      [false, false],
      [undefined, true],
    ]) {
      // Première publication : le mot de passe de table se choisit ici.
      const { ecran, etat, coffre } = await espaceReel({ publiee: false, garder });
      await comparer(ecran);
      ecran.querySelector("#mdp-auteur").value = PHRASE;
      ecran.querySelector("#mdp-auteur-2").value = PHRASE;
      await soumettre(formulaireDe(ecran, "mdp-auteur"));
      await attendre(() => ecran.querySelector("#connaissance"), "la confirmation n'arrive pas");
      assert.ok(etat.secret, "la clé vit en mémoire");
      assert.equal((await coffre.lireCle("reel")) !== null, gardee, `garder : ${garder}`);
    }
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
  assert.match(lire("js/application.js"), /etat\.garder = garder/, "le choix de l'écran du mot de passe est retenu");
});

test("espace auteur — une erreur inattendue dans le formulaire donne un message, jamais une attente sans fin", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const coffre = creerCoffre(magasinMemoire());
    const casse = {
      ...coffre,
      garderCle: async () => {
        throw new Error("quota dépassé");
      },
    };
    const { ecran } = await espaceReel({ publiee: false, coffre: casse });
    await comparer(ecran);
    ecran.querySelector("#mdp-auteur").value = PHRASE;
    ecran.querySelector("#mdp-auteur-2").value = PHRASE;
    await soumettre(formulaireDe(ecran, "mdp-auteur"));
    await attendre(() => texteDe(ecran).includes("quota dépassé"), "l'erreur ne s'affiche pas");
    assert.notEqual(publier(ecran).raison, "Calcul de la clé…");
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("mot de passe — sans IndexedDB, l'écran dit que rien n'est gardé ; une erreur donne un message", async () => {
  const retirer = installerDom();
  globalThis.requestAnimationFrame = () => 0;
  try {
    const motDePasse = await import("../js/ecrans/mot_de_passe.js");
    const recus = [];
    const ecranPour = (durable, deverrouiller) =>
      motDePasse.afficher({ etat: { mode: "reel", motDePasse: "requis", coffre: { ...creerCoffre(magasinMemoire()), durable } }, deverrouiller, afficher() {} });

    const durable = ecranPour(true, async () => ({ erreur: "non", code: "mot_de_passe" }));
    assert.equal(durable.querySelector("#garder")?.checked, true, "« Se souvenir » coché par défaut");

    const memoire = ecranPour(false, async (mot, garder) => {
      recus.push(garder);
      return { erreur: "non", code: "mot_de_passe" };
    });
    assert.equal(memoire.querySelector("#garder"), null, "pas de case : rien ne peut être gardé");
    assert.match(texteDe(memoire), /Cet appareil ne garde rien : le mot de passe sera redemandé à la prochaine visite\./);
    memoire.querySelector("#mot-de-passe").value = PHRASE;
    await soumettre(memoire.querySelector("form"));
    await laisserFiler(150);
    assert.deepEqual(recus, [false]);

    const casse = ecranPour(true, async () => {
      throw new Error("quota dépassé");
    });
    casse.querySelector("#mot-de-passe").value = PHRASE;
    await soumettre(casse.querySelector("form"));
    await laisserFiler(150);
    const message = casse.querySelector(".message[role]");
    assert.equal(message.hidden, false, "le message s'affiche");
    assert.match(texteDe(message), /quota dépassé/);
    assert.equal(casse.querySelector(".attente").hidden, true, "l'attente s'arrête");
  } finally {
    delete globalThis.requestAnimationFrame;
    retirer();
  }
});

test("mot de passe — l'Atelier s'ouvre sans attendre la réponse sur le stockage durable (§ 9)", () => {
  // Firefox demande l'accord de la personne : tant qu'elle n'a pas répondu,
  // la promesse de navigator.storage.persist() reste en suspens (relevé du
  // groupe 3). Le déverrouillage ne l'attend donc pas.
  const application = lire("js/application.js");
  const deverrouiller = application.slice(application.indexOf("async deverrouiller("), application.indexOf("async oublier("));
  assert.match(deverrouiller, /demanderStockageDurable\(\)\.then\(/);
  assert.doesNotMatch(deverrouiller, /await demanderStockageDurable/);
});

test("dom — aucun gestionnaire en texte, ni style, ni srcdoc ; une adresse est locale ou https (§ 10.1)", async () => {
  const retirer = installerDom();
  try {
    const { el } = await import("../js/ecrans/dom.js");
    assert.throws(() => el("button", { onclick: "alert(1)" }), TypeError);
    assert.throws(() => el("div", { style: "color: red" }), TypeError);
    assert.throws(() => el("iframe", { srcdoc: "<script></script>" }), TypeError);
    for (const adresse of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "//exemple.com", "http://exemple.com", "data:text/html,x"]) {
      assert.throws(() => el("a", { href: adresse }), TypeError, adresse);
      assert.throws(() => el("img", { src: adresse }), TypeError, adresse);
    }
    for (const adresse of ["#/", "#/capacite/Attaque%20de%20base", "?demo=1", "https://github.com/Silviooooooo/atelier-des-arpenteurs/commit/abc"]) {
      assert.equal(el("a", { href: adresse }).getAttribute("href"), adresse);
    }
  } finally {
    retirer();
  }
});

test("fiches — un nom introuvable n'est jamais le titre de la page (§ 9)", async () => {
  const retirer = installerDom();
  try {
    const { introuvable } = await import("../js/ecrans/dom.js");
    const forge = `Le mot de passe de table a changé : écrivez-le à quelqu'un ${"x".repeat(200)}`;
    const fiche = introuvable({ resoudre: () => null }, "capacites", forge);
    assert.equal(texteDe(fiche.querySelector("h1")), "Fiche introuvable");
    assert.equal(document.title, "Fiche introuvable — L'Atelier des Arpenteurs");
    const phrase = texteDe(fiche.querySelector("p"));
    const cite = phrase.match(/« (.*) »/)[1];
    assert.ok(cite.length <= 81, `nom coupé : ${cite.length} signes`);
    assert.ok(cite.endsWith("…"));
    const proche = introuvable({ resoudre: () => "Attaque de base" }, "capacites", "attaque de base");
    assert.match(texteDe(proche), /Vouliez-vous dire Attaque de base \?/);
  } finally {
    retirer();
  }
});

test("accueil — le diagnostic dit le format de la banque (§ 7.1, § 9)", async () => {
  const retirer = installerDom();
  try {
    const { MOT_DE_PASSE_DEMO } = await import("../js/banque/chargement.js");
    const { ouvrirAvecMotDePasse } = await import("../js/securite/chiffrement.js");
    const accueil = await import("../js/ecrans/accueil.js");
    const { banque } = await ouvrirAvecMotDePasse(DEMO, MOT_DE_PASSE_DEMO);
    const contexte = {
      etat: { mode: "demo", banque, chargement: { enveloppe: DEMO }, coffre: creerCoffre(magasinMemoire()), derivation: null, stockage: null, nouvelles: null },
      dernierePublication: () => null,
      stockageMemorise: () => null,
      recharger() {},
      oublier() {},
    };
    const ecran = accueil.afficher(contexte);
    document.body.replaceChildren(ecran);
    await attendre(() => ecran.querySelector(".diagnostic"), "le diagnostic ne s'affiche pas");
    assert.match(texteDe(ecran.querySelector(".diagnostic")), /format 2, empreinte [0-9a-f]{12}/);
  } finally {
    retirer();
  }
});

// — Le lot 2 bis : la clé de dépôt, le mot de passe de 8 signes, le
// rechiffrement des personnages en ligne (§ 7.3, § 8.4)

// Une clé de dépôt fictive, fabriquée à l'exécution (tests/depot.test.js).
const CLE_DEPOT = `github_pat_${"Q".repeat(82)}`;

// GitHub simulé pour l'API Git Data : main, ses fichiers, les commits
// écrits. Juste ce que lisent et écrivent le changement de mot de passe et
// la reprise ; tests/publication.test.js en contrôle le détail.
function simulerGit(fichiers) {
  const hache = (texte) => createHash("sha1").update(texte).digest("hex");
  const git = { methodes: [], commits: [], fichiers: new Map(Object.entries(fichiers)) };
  const blobs = new Map();
  const arbres = new Map();
  const enAttente = new Map();
  let ref = hache("depart");
  const blob = (texte) => {
    const sha = hache(`blob ${texte}`);
    blobs.set(sha, texte);
    return sha;
  };
  const repondre = (statut, corps) => new Response(JSON.stringify(corps), { status: statut });
  git.fetch = async (adresse, init = {}) => {
    const methode = init.method ?? "GET";
    git.methodes.push(methode);
    const corps = init.body ? JSON.parse(init.body) : null;
    const chemin = adresse.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/git\//, "").split("?")[0];
    if (methode === "GET" && chemin === "ref/heads/main") return repondre(200, { object: { sha: ref } });
    if (methode === "GET" && chemin.startsWith("commits/")) return repondre(200, { tree: { sha: hache(`arbre ${ref}`) } });
    if (methode === "GET" && chemin.startsWith("trees/")) {
      const tree = [...git.fichiers].map(([path, texte]) => ({ path, type: "blob", sha: blob(texte), size: Buffer.byteLength(texte) }));
      return repondre(200, { tree, truncated: false });
    }
    if (methode === "GET" && blobs.has(chemin.slice(6))) return repondre(200, { encoding: "base64", content: Buffer.from(blobs.get(chemin.slice(6))).toString("base64") });
    if (methode === "POST" && chemin === "blobs") return repondre(201, { sha: blob(Buffer.from(corps.content, "base64").toString()) });
    if (methode === "POST" && chemin === "trees") {
      const sha = hache(`arbre ${JSON.stringify(corps)}`);
      arbres.set(sha, corps.tree);
      return repondre(201, { sha });
    }
    if (methode === "POST" && chemin === "commits") {
      const sha = hache(`commit ${JSON.stringify(corps)}`);
      enAttente.set(sha, corps);
      return repondre(201, { sha });
    }
    if (methode === "PATCH" && chemin === "refs/heads/main") {
      const commit = enAttente.get(corps.sha);
      if (corps.force || commit.parents[0] !== ref) return repondre(422, { message: "Update is not a fast forward" });
      for (const entree of arbres.get(commit.tree)) git.fichiers.set(entree.path, entree.content ?? blobs.get(entree.sha));
      ref = corps.sha;
      git.commits.push(commit);
      return repondre(200, { object: { sha: ref } });
    }
    return repondre(404, { message: "Not Found" });
  };
  return git;
}

// Un personnage en ligne, rangé par l'automate, chiffré sous secret.
async function personnageRange(identifiant, secret) {
  const personnage = personnageEssai((p) => Object.assign(p, { id: identifiant, mode: "reel", etat: "enregistre", etape: 9, enregistre_le: DATE_ESSAI.toISOString() }));
  const chiffre = await chiffrerPersonnage(personnage, secret);
  const { corps } = ecrireTicket({ action: "creer", identifiant, date: "2026-09-30T10:21:36.536Z", personnage: chiffre });
  return { personnage, fichier: fichierDuTicket(lireTicket(corps).ticket, { rangeLe: "2026-09-30T10:22:05Z", numero: 5 }) };
}

// Un espace auteur réel, clé GitHub (jeton) gardée, devant une banque publiée
// et ouverte (sa clé en mémoire), avec ou sans clé de dépôt ; GitHub simulé
// (l'API des contenus, en lecture sauf ecriture), sauf dépôt Git simulé
// fourni. Une publication réussie ouvre la banque publiée, comme le fait
// l'application (ctx.publiee).
async function espaceOuvert({ cleDepot = null, magasin = magasinMemoire(), secret = null, depot = null, jeton = JETON, ecriture = false } = {}) {
  const cle = secret ?? (await nouveauSecret(PHRASE));
  const { banque: importee } = await importerFichier(ESSAI, "classeur_essai.xlsx");
  const banque = { ...importee, publiee_le: "2026-09-28T14:32:00+02:00", ...(cleDepot ? { cle_depot: cleDepot } : {}) };
  const enveloppe = await chiffrer(banque, cle);
  const coffre = creerCoffre(magasin);
  await coffre.garderJeton(jeton);
  await coffre.garderCle("reel", cle);
  const etat = { mode: "reel", coffre, chargement: { enveloppe }, secret: cle, banque };
  const git = depot ? simulerGit(depot(enveloppe)) : null;
  const github = git ? null : simulerGithub(enveloppe, { ecriture });
  globalThis.fetch = (git ?? github).fetch;
  const publiee = (preparation, ouverte) => Object.assign(etat, { chargement: { enveloppe: preparation.enveloppe }, banque: preparation.banque, secret: ouverte });
  const { ecran, module } = await espaceAuteur(etat, publiee);
  return { ecran, module, etat, git, github, enveloppe };
}

// Tout ce que l'écran montre ou tient : textes, attributs, valeurs des champs.
const toutLEcran = (ecran) => [texteDe(ecran), ...[...ecran.descendants()].flatMap((e) => [e.value, ...e.attributs.values()])].join(" ");

test("espace auteur — la clé de dépôt : l'aide, l'état, une saisie vérifiée, jamais affichée ni gardée (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const memoire = magasinMemoire();
    const ecrits = [];
    const magasin = { ...memoire, ecrire: async (cle, valeur) => (ecrits.push(valeur), memoire.ecrire(cle, valeur)) };
    const { ecran } = await espaceOuvert({ magasin });
    assert.ok(ecran.querySelectorAll("h2").some((h) => texteDe(h) === "Clé de dépôt des personnages"));
    const texte = texteDe(ecran);
    assert.match(texte, /Repository access : Only select repositories, et le seul dépôt atelier-des-arpenteurs\./);
    assert.match(texte, /Permissions : Issues, en Read and write\. Rien d'autre\./);
    assert.match(texte, /Expiration : un an/);
    assert.match(texte, /tout joueur qui a le mot de passe de table peut déposer, modifier et supprimer des personnages ; il peut aussi écrire en votre nom dans les tickets de ce dépôt/);
    assert.match(texte, /Rien d'autre : ni le code, ni la banque. Si elle fuit, révoquez-la sur GitHub/);
    assert.match(texte, /La banque publiée ne porte aucune clé de dépôt\./);
    const champ = ecran.querySelector("#cle-depot");
    assert.equal(champ.getAttribute("type"), "password");
    assert.equal(champ.getAttribute("autocomplete"), "off");
    assert.equal(boutons(ecran, "Retirer la clé de dépôt").length, 0, "rien à retirer");

    // Une forme invalide : un message, qui ne recopie pas la saisie.
    const classique = `ghp_${"q".repeat(36)}`;
    champ.value = classique;
    await soumettre(formulaireDe(ecran, "cle-depot"));
    const erreur = formulaireDe(ecran, "cle-depot").querySelector(".message");
    assert.equal(erreur.hidden, false);
    assert.match(texteDe(erreur), /commence par « github_pat_ »/);
    assert.equal(texteDe(ecran).includes(classique), false);

    // La bonne : en mémoire seulement, nulle part à l'écran.
    ecran.querySelector("#cle-depot").value = `  ${CLE_DEPOT}  `;
    await soumettre(formulaireDe(ecran, "cle-depot"));
    assert.match(texteDe(ecran), /Nouvelle clé saisie : elle partira avec la prochaine publication ou le prochain changement de mot de passe\./);
    assert.equal(ecran.querySelector("#cle-depot"), null);
    assert.equal(toutLEcran(ecran).includes(CLE_DEPOT), false, "la clé n'est nulle part à l'écran");

    // La comparaison dit ce qu'il advient d'elle ; le message de commit, rien.
    await importer(ecran);
    await comparer(ecran);
    assert.ok(differencesAffichees(ecran));
    assert.match(texteDe(ecran), /Clé de dépôt des personnages : ajoutée à la banque/);
    assert.doesNotMatch(texteDe(ecran.querySelector(".resume")), /github_pat_|clé|dépôt/i);
    assert.equal(toutLEcran(ecran).includes(CLE_DEPOT), false);
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);
    assert.match(texteDe(ecran), /Nouvelle clé saisie/, "annuler la publication garde la clé saisie");

    // « Oublier la clé saisie » : retour à la saisie.
    boutons(ecran, "Oublier la clé saisie")[0].click();
    assert.ok(ecran.querySelector("#cle-depot"));
    assert.equal(
      ecrits.some((valeur) => JSON.stringify(valeur ?? null).includes(CLE_DEPOT)),
      false,
      "rien n'en est gardé sur l'appareil",
    );
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
  assert.doesNotMatch(lire("js/ecrans/espace_auteur.js"), /(?:local|session)Storage\s*[.[]/, "ni localStorage ni sessionStorage");
});

test("espace auteur — une clé de dépôt publiée se garde ou se retire ; en démonstration, aucune ne se saisit", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const { ecran, module } = await espaceOuvert({ cleDepot: CLE_DEPOT });
    assert.match(texteDe(ecran), /La banque publiée porte une clé de dépôt\./);
    assert.equal(toutLEcran(ecran).includes(CLE_DEPOT), false, "la clé publiée n'est pas montrée");
    assert.match(texteDe(ecran), /Nouvelle clé de dépôt, qui remplacera la clé publiée/);
    boutons(ecran, "Retirer la clé de dépôt à la prochaine publication")[0].click();
    assert.match(texteDe(ecran), /La clé de dépôt sera retirée à la prochaine publication ou au prochain changement de mot de passe\./);
    await importer(ecran);
    await comparer(ecran);
    assert.match(texteDe(ecran), /Clé de dépôt des personnages : retirée de la banque/);
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);
    boutons(ecran, "Garder la clé publiée")[0].click();
    await comparer(ecran);
    assert.match(texteDe(ecran), /Clé de dépôt des personnages : gardée/);
    boutons(ecran, "Annuler")[0].click();
    await laisserFiler(20);
    // « Oublier le mot de passe » oublie aussi une clé saisie.
    ecran.querySelector("#cle-depot").value = CLE_DEPOT.replace(/Q/g, "R");
    await soumettre(formulaireDe(ecran, "cle-depot"));
    assert.match(texteDe(ecran), /Nouvelle clé saisie/);
    module.oublier();
    assert.ok(ecran.querySelector("#cle-depot"), "la clé saisie est oubliée");

    const demo = (await espaceAuteur({ mode: "demo", coffre: creerCoffre(magasinMemoire()), chargement: { enveloppe: DEMO }, secret: null })).ecran;
    assert.match(texteDe(demo), /Démonstration : rien n'est déposé en ligne, et aucune clé de dépôt ne se saisit ici\./);
    assert.equal(demo.querySelector("#cle-depot"), null);
    assert.equal(boutons(demo, "Vérifier les personnages en ligne").length, 0);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — une clé de dépôt saisie part avec la publication, puis quitte la mémoire (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const { ecran, github } = await espaceOuvert({ ecriture: true });
    ecran.querySelector("#cle-depot").value = CLE_DEPOT;
    await soumettre(formulaireDe(ecran, "cle-depot"));
    await importer(ecran);
    await comparer(ecran);
    assert.match(texteDe(ecran), /Clé de dépôt des personnages : ajoutée à la banque/);
    const coche = ecran.querySelector("#connaissance");
    coche.checked = true;
    coche.declencher("change");
    publier(ecran).bouton.click();
    await attendre(() => texteDe(ecran).includes("Publiée"), "la publication n'aboutit pas");
    const ecrite = JSON.parse(Buffer.from(github.ecrit.content, "base64").toString());
    assert.equal((await ouvrirAvecMotDePasse(ecrite, PHRASE)).banque.cle_depot, CLE_DEPOT, "partie avec la banque chiffrée");
    // Partie : elle ne vit plus dans l'espace auteur. La saisie revient, et
    // la banque ouverte, la nouvelle, la porte.
    assert.ok(ecran.querySelector("#cle-depot"), "la saisie revient");
    assert.doesNotMatch(texteDe(ecran), /Nouvelle clé saisie/);
    assert.match(texteDe(ecran), /La banque publiée porte une clé de dépôt\./);
    assert.equal(toutLEcran(ecran).includes(CLE_DEPOT), false);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — la clé GitHub de l'auteur ne se saisit ni ne se garde comme clé de dépôt (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    // La clé GitHub de l'auteur a la même forme qu'une clé de dépôt.
    const jeton = `github_pat_${"J".repeat(82)}`;
    const { ecran } = await espaceOuvert({ jeton });
    ecran.querySelector("#cle-depot").value = ` ${jeton} `;
    await soumettre(formulaireDe(ecran, "cle-depot"));
    const erreur = formulaireDe(ecran, "cle-depot")?.querySelector(".message");
    assert.ok(erreur, "la saisie reste");
    assert.equal(erreur.hidden, false);
    assert.match(texteDe(erreur), /^C'est la clé GitHub de l'auteur, qui peut écrire dans le dépôt : elle ne doit jamais partir dans la banque\. Créez une clé à part, permission Issues seule\.$/);
    assert.doesNotMatch(texteDe(ecran), /Nouvelle clé saisie/);
    assert.equal(texteDe(ecran).includes(jeton), false);

    // Déjà dans la banque publiée : la comparaison refuse de la garder ; le
    // retrait passe.
    const { ecran: autre } = await espaceOuvert({ jeton, cleDepot: jeton });
    await importer(autre);
    await comparer(autre);
    assert.equal(differencesAffichees(autre), false);
    assert.match(texteDe(autre), /La clé de dépôt de la banque publiée est la clé GitHub de l'auteur.*révoquez-la/);
    assert.equal(toutLEcran(autre).includes(jeton), false);
    boutons(autre, "Retirer la clé de dépôt à la prochaine publication")[0].click();
    await comparer(autre);
    assert.match(texteDe(autre), /Clé de dépôt des personnages : retirée de la banque/);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — le mot de passe de table : 8 signes acceptés, 7 refusés, majuscules indifférentes (§ 7.3)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    // Première publication : le mot de passe se choisit.
    const { ecran } = await espaceReel({ publiee: false });
    await comparer(ecran);
    const essayer = async ([id, id2], premier, second) => {
      ecran.querySelector(`#${id}`).value = premier;
      ecran.querySelector(`#${id2}`).value = second;
      await soumettre(formulaireDe(ecran, id));
      return formulaireDe(ecran, id)?.querySelector(".message");
    };
    let erreur = await essayer(["mdp-auteur", "mdp-auteur-2"], "Marmite", "marmite");
    assert.ok(erreur, "7 signes : le formulaire reste, avec son message");
    assert.equal(erreur.hidden, false);
    assert.match(texteDe(erreur), /compte 7 signe\(s\) : il en faut 8 au moins/, "7 signes refusés, pour leur longueur seule");
    erreur = await essayer(["mdp-auteur", "mdp-auteur-2"], "Marmites", "marmitez");
    assert.equal(texteDe(erreur), "Les deux saisies diffèrent.");
    await essayer(["mdp-auteur", "mdp-auteur-2"], "Marmites", "marmites");
    await attendre(() => ecran.querySelector("#connaissance"), "8 signes, majuscules indifférentes : la confirmation n'arrive pas");

    // Le changement de mot de passe : les mêmes règles.
    const { ecran: autre } = await espaceOuvert({ depot: (enveloppe) => ({ [CHEMIN_BANQUE]: texteDeLaBanque(enveloppe) }) });
    const changer = async (premier, second) => {
      autre.querySelector("#nouveau-mdp").value = premier;
      autre.querySelector("#nouveau-mdp-2").value = second;
      await soumettre(formulaireDe(autre, "nouveau-mdp"));
      return formulaireDe(autre, "nouveau-mdp")?.querySelector(".message");
    };
    erreur = await changer("Marmite", "Marmite");
    assert.equal(erreur.hidden, false);
    assert.match(texteDe(erreur), /il en faut 8 au moins/);
    assert.equal(texteDe(await changer("Marmites", "Marmitez")), "Les deux saisies diffèrent.");
    await changer("MARMITES", "marmites");
    await attendre(() => texteDe(autre).includes("Changement du mot de passe"), "8 signes, majuscules indifférentes : la confirmation n'arrive pas");
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — changer le mot de passe : la confirmation compte les personnages, puis un seul commit (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const secret = await nouveauSecret(PHRASE);
    const ranges = [await personnageRange("PersonnageAlpha000001", secret), await personnageRange("PersonnageBravo000002", secret)];
    const { ecran, etat, git } = await espaceOuvert({
      secret,
      depot: (enveloppe) => ({
        [CHEMIN_BANQUE]: texteDeLaBanque(enveloppe),
        ...Object.fromEntries(ranges.map(({ fichier }) => [cheminDuPersonnage(fichier.identifiant), ecrireFichier(fichier)])),
        [CHEMIN_INDEX]: ecrireIndex(ranges.map(({ fichier }) => fichier)),
      }),
    });
    ecran.querySelector("#nouveau-mdp").value = "Écumoire fouet tamis";
    ecran.querySelector("#nouveau-mdp-2").value = "écumoire fouet tamis";
    await soumettre(formulaireDe(ecran, "nouveau-mdp"));
    await attendre(() => texteDe(ecran).includes("Changement du mot de passe"), "la confirmation n'arrive pas");
    assert.match(texteDe(ecran), /2 personnages en ligne seront rechiffrés sous le nouveau mot de passe, dans le même commit que la banque\./);
    assert.match(texteDe(ecran), /Clé de dépôt des personnages : aucune/);
    assert.match(texteDe(ecran.querySelector(".resume")), /— nouveau mot de passe de table, 2 personnages rechiffrés$/);
    assert.deepEqual([...new Set(git.methodes)], ["GET"], "rien d'écrit avant la confirmation");

    boutons(ecran, "Republier sous le nouveau mot de passe")[0].click();
    await attendre(() => texteDe(ecran).includes("Publiée"), "le changement n'aboutit pas");
    assert.match(texteDe(ecran), /2 personnages en ligne rechiffrés sous le nouveau mot de passe\./);
    assert.equal(git.commits.length, 1, "un seul commit");
    assert.equal(git.methodes.includes("PUT"), false, "pas de PUT : l'API Git Data");
    assert.notEqual(etat.secret, secret, "la nouvelle clé est en mémoire");
    for (const { personnage, fichier } of ranges) {
      const relu = lireFichier(git.fichiers.get(cheminDuPersonnage(fichier.identifiant)), { identifiant: fichier.identifiant }).fichier;
      assert.deepEqual((await dechiffrerPersonnage(relu, etat.secret)).personnage, personnage);
      assert.equal((await dechiffrerPersonnage(relu, secret)).code, "cle");
    }
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

// Change le mot de passe de table depuis l'écran, jusqu'au résultat de l'envoi.
async function changerLeMotDePasse(ecran, motDePasse) {
  ecran.querySelector("#nouveau-mdp").value = motDePasse;
  ecran.querySelector("#nouveau-mdp-2").value = motDePasse;
  await soumettre(formulaireDe(ecran, "nouveau-mdp"));
  await attendre(() => texteDe(ecran).includes("Changement du mot de passe"), "la confirmation n'arrive pas");
  boutons(ecran, "Republier sous le nouveau mot de passe")[0].click();
  await attendre(() => /Publiée|GitHub ne répond/.test(texteDe(ecran)), "le changement n'aboutit pas");
}

// Les fichiers d'un dépôt : la banque, des personnages rangés, leur index.
const fichiersEnLigne = (ranges) => (enveloppe) => ({
  [CHEMIN_BANQUE]: texteDeLaBanque(enveloppe),
  ...Object.fromEntries(ranges.map(({ fichier }) => [cheminDuPersonnage(fichier.identifiant), ecrireFichier(fichier)])),
  [CHEMIN_INDEX]: ecrireIndex(ranges.map(({ fichier }) => fichier)),
});

test("espace auteur — un changement qui laisse des personnages d'une autre clé les montre aussitôt, avec leur reprise (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const secret = await nouveauSecret(PHRASE);
    const ANCIEN = "un mot de passe plus ancien";
    const ranges = [await personnageRange("PersonnageAlpha000001", secret), await personnageRange("PersonnageBravo000002", await nouveauSecret(ANCIEN))];
    const { ecran, git } = await espaceOuvert({ secret, depot: fichiersEnLigne(ranges) });
    await changerLeMotDePasse(ecran, "écumoire fouet tamis");
    assert.match(texteDe(ecran), /Publiée/);
    assert.match(texteDe(ecran), /1 personnage est chiffré avec un mot de passe plus ancien : il reste tel quel\./);
    // Sans « Vérifier » : ce que le changement a lu suffit, rien ne se relit.
    const lectures = git.methodes.length;
    assert.match(texteDe(ecran), /2 personnages sont en ligne ; 1 s'ouvre avec le mot de passe de table actuel\./);
    assert.match(texteDe(ecran), /1 est chiffré avec un mot de passe plus ancien : les joueurs ne peuvent pas l'ouvrir\./);
    assert.ok(ecran.querySelector("#ancien-mdp"), "la reprise est proposée aussitôt");
    assert.equal(git.methodes.length, lectures);

    // La reprise, sous le nouveau mot de passe.
    ecran.querySelector("#ancien-mdp").value = ANCIEN;
    await soumettre(formulaireDe(ecran, "ancien-mdp"));
    await attendre(() => texteDe(ecran).includes("personnage rechiffré sous le mot de passe de table actuel"), "la reprise n'aboutit pas");
    assert.equal(git.commits.length, 2);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — changer le mot de passe quand la réponse de l'avance se perd : la branche relue tranche (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    // La connexion tombe après que GitHub a avancé la branche ; la relecture
    // de la branche répond (relue), ou tombe aussi.
    const essai = async ({ relue }) => {
      const secret = await nouveauSecret(PHRASE);
      const ranges = [await personnageRange("PersonnageAlpha000001", secret)];
      const espace = await espaceOuvert({ secret, depot: fichiersEnLigne(ranges) });
      let coupee = false;
      globalThis.fetch = async (adresse, init = {}) => {
        if (init.method === "PATCH") {
          await espace.git.fetch(adresse, init);
          coupee = true;
          throw new TypeError("Failed to fetch");
        }
        if (coupee && !relue) throw new TypeError("Failed to fetch");
        return espace.git.fetch(adresse, init);
      };
      await changerLeMotDePasse(espace.ecran, "écumoire fouet tamis");
      return { ...espace, secret };
    };

    const faite = await essai({ relue: true });
    assert.match(texteDe(faite.ecran), /Publiée/);
    assert.equal(faite.git.commits.length, 1);
    assert.notEqual(faite.etat.secret, faite.secret, "la nouvelle clé est gardée");

    const inconnue = await essai({ relue: false });
    assert.match(
      texteDe(inconnue.ecran),
      /GitHub ne répond plus depuis l'envoi : le changement a peut-être eu lieu\. Rechargez la page ; si l'Atelier redemande le mot de passe de table, essayez d'abord le nouveau\./,
    );
    assert.doesNotMatch(texteDe(inconnue.ecran), /Publiée/);
    assert.equal(inconnue.etat.secret, inconnue.secret, "l'ancienne clé reste, faute de savoir");
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});

test("espace auteur — vérifier les personnages en ligne, puis les reprendre avec l'ancien mot de passe (§ 8.4)", async () => {
  const retirer = installerDom();
  const fetchAvant = globalThis.fetch;
  try {
    const secret = await nouveauSecret(PHRASE);
    const ANCIEN = "un ancien mot de passe";
    const a = await personnageRange("PersonnageAlpha000001", secret);
    const b = await personnageRange("PersonnageBravo000002", await nouveauSecret(ANCIEN));
    let banqueEcrite = null;
    const { ecran, git } = await espaceOuvert({
      secret,
      depot: (enveloppe) => {
        banqueEcrite = texteDeLaBanque(enveloppe);
        return {
          [CHEMIN_BANQUE]: banqueEcrite,
          [cheminDuPersonnage(a.fichier.identifiant)]: ecrireFichier(a.fichier),
          [cheminDuPersonnage(b.fichier.identifiant)]: ecrireFichier(b.fichier),
          [CHEMIN_INDEX]: ecrireIndex([a.fichier, b.fichier]),
        };
      },
    });
    assert.ok(ecran.querySelectorAll("h2").some((h) => texteDe(h) === "Personnages en ligne"));
    assert.equal(ecran.querySelector("#ancien-mdp"), null);
    boutons(ecran, "Vérifier les personnages en ligne")[0].click();
    await attendre(() => texteDe(ecran).includes("sont en ligne"), "l'inventaire n'arrive pas");
    assert.match(texteDe(ecran), /2 personnages sont en ligne ; 1 s'ouvre avec le mot de passe de table actuel\./);
    assert.match(texteDe(ecran), /1 est chiffré avec un mot de passe plus ancien : les joueurs ne peuvent pas l'ouvrir\./);
    assert.deepEqual([...new Set(git.methodes)], ["GET"], "la vérification n'écrit rien");
    assert.ok(ecran.querySelector("#ancien-mdp"), "la reprise est proposée");

    // Un faux ancien mot de passe : un message, et la saisie reste.
    ecran.querySelector("#ancien-mdp").value = "pas le bon mot de passe";
    await soumettre(formulaireDe(ecran, "ancien-mdp"));
    await attendre(() => texteDe(ecran).includes("n'ouvre pas le personnage"), "le refus ne s'affiche pas");
    assert.ok(ecran.querySelector("#ancien-mdp"));
    assert.deepEqual([...new Set(git.methodes)], ["GET"]);

    ecran.querySelector("#ancien-mdp").value = ANCIEN;
    await soumettre(formulaireDe(ecran, "ancien-mdp"));
    await attendre(() => texteDe(ecran).includes("personnage rechiffré"), "la reprise n'aboutit pas");
    assert.match(texteDe(ecran), /1 personnage rechiffré sous le mot de passe de table actuel : visible par tous d'ici quelques minutes\./);
    assert.equal(git.commits.length, 1);
    assert.equal(git.fichiers.get(CHEMIN_BANQUE), banqueEcrite, "la banque ne bouge pas");
    const relu = lireFichier(git.fichiers.get(cheminDuPersonnage(b.fichier.identifiant)), { identifiant: b.fichier.identifiant }).fichier;
    assert.deepEqual((await dechiffrerPersonnage(relu, secret)).personnage, b.personnage);

    boutons(ecran, "Vérifier les personnages en ligne")[0].click();
    await attendre(() => texteDe(ecran).includes("sont en ligne"), "l'inventaire n'arrive pas");
    assert.match(texteDe(ecran), /2 personnages sont en ligne ; 2 s'ouvrent avec le mot de passe de table actuel\./);
    assert.equal(ecran.querySelector("#ancien-mdp"), null);
  } finally {
    globalThis.fetch = fetchAvant;
    retirer();
  }
});
