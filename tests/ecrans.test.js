// Contrôles des écrans, construits dans un document simulé
// (SPECIFICATION.md, § 9 et § 11, domaine Site).
//
// Le bouton « Publier » de l'espace auteur, toujours présent, et la raison
// qu'il porte tant qu'il est inactif ; la veille du chargement ; l'aide pour
// l'écran d'accueil. Aucun appel réel à GitHub : fetch est simulé.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { creerCoffre, magasinMemoire } from "../js/securite/coffre.js";
import { importerFichier } from "../js/banque/importation.js";
import { chiffrer, nouveauSecret } from "../js/securite/chiffrement.js";
import { boutons, installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";

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
async function espaceAuteur(etat) {
  instance += 1;
  const module = await import(`../js/ecrans/espace_auteur.js?instance=${instance}`);
  const contexte = { etat, publiee() {} };
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
// méthode notée ; une écriture est refusée, et se verrait.
function simulerGithub(enveloppe = null) {
  const github = { methodes: [] };
  github.fetch = async (adresse, init = {}) => {
    const methode = init.method ?? "GET";
    github.methodes.push(methode);
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
