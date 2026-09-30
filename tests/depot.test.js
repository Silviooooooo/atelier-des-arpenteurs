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
const JSON_PERMIS = ["package.json", "essais/banque_demo.chiffree.json", "essais/banque_format1.chiffree.json", "donnees/banque.chiffree.json", "essais/personnage_demo.arpenteur.json"];

function fichiersHorsListe(chemins) {
  return chemins.filter((chemin) => FORMATS_INTERDITS.test(chemin) || (/\.json$/i.test(chemin) && !JSON_PERMIS.includes(chemin)));
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
  if (banque.format !== 1 && banque.format !== 2) return `format ${banque.format} inconnu`;
  // Format 2 : l'empreinte est celle des octets chiffrés, et se vérifie ici.
  if (banque.format === 2 && banque.empreinte !== `sha256:${createHash("sha256").update(donnees).digest("hex")}`) {
    return "format 2 : l'empreinte n'est pas celle des octets chiffrés";
  }
  return null;
}

// La première publication réelle (29/09/2026) est au format 1 ; toute
// publication suivante doit être au format 2. Un onglet de l'espace auteur
// ouvert sur l'ancien code écrirait encore le format 1 : cela se verrait ici.
const FORMAT_1_PUBLIE = "sha256:de78dcbfbcf5f39a1187b6821359aef6fcda740faa8c1f4c79094479428ad854";

function defautDeLaBanquePubliee(texte) {
  const defaut = defautDeFormeChiffree(texte);
  if (defaut) return defaut;
  const { format, empreinte } = JSON.parse(texte);
  if (format === 1 && empreinte !== FORMAT_1_PUBLIE) return "format 1 : seul le fichier du 29/09/2026 l'a ; une publication nouvelle doit être au format 2 (recharger la page avant de publier)";
  return null;
}

function donneesEnClair(chemins, lireTexte) {
  const fautes = [];
  for (const chemin of chemins.filter((c) => c.toLowerCase().startsWith("donnees/"))) {
    const defaut = chemin === BANQUE ? defautDeLaBanquePubliee(lireTexte(chemin)) : `seule ${BANQUE} a sa place ici`;
    if (defaut) fautes.push(`${chemin} : ${defaut}`);
  }
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

// Les révisions où un fichier porte un jeton entier : « sha:chemin »,
// jamais le jeton, que le journal de GitHub Actions rendrait public.
function jetonsDansLHistorique(dossier = RACINE) {
  const revisions = gitDans(dossier, "rev-list", "--all").split("\n").filter(Boolean);
  try {
    return gitDans(dossier, "grep", "-l", "--text", "-E", "(gh[pousr]_|github_pat_)[A-Za-z0-9_]{36,}", ...revisions).split("\n").filter(Boolean);
  } catch (erreur) {
    if (erreur.status === 1) return [];
    throw erreur;
  }
}

// Tout ce qu'un chemin seul suffit à interdire, pour l'historique.
function cheminsInterdits(chemins) {
  return [
    ...classeursHorsEssais(chemins),
    ...chemins.filter((chemin) => /^essais\/[^/]+\.xlsx$/i.test(chemin) && !Object.hasOwn(CLASSEURS_D_ESSAI, chemin)),
    ...documentsWord(chemins),
    ...fichiersHorsListe(chemins),
    ...pagesEnTrop(chemins),
    ...chemins.filter((chemin) => chemin.toLowerCase().startsWith("donnees/") && chemin !== BANQUE),
  ];
}

// § 10.2 : le workflow n'emploie que des actions fixées sur un commit, avec
// les droits les plus faibles, sans jeton gardé ni texte venu d'un tiers.
function defautsDuWorkflow(texte) {
  const fautes = [];
  for (const [, action, suite] of texte.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm)) {
    if (!/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(action) || !/^\s+#\s*v\d/.test(suite)) fautes.push(`action non fixée : ${action}`);
  }
  if (!/^permissions:[ ]*\n[ ]+contents:[ ]*read[ ]*$/m.test(texte)) fautes.push("permissions : contents: read attendu au niveau du workflow");
  if (/:\s*write\b/.test(texte)) fautes.push("une permission en écriture");
  if (!/persist-credentials:\s*false/.test(texte)) fautes.push("persist-credentials: false attendu");
  if (/pull_request_target|workflow_run/.test(texte)) fautes.push("déclencheur qui donne des droits à un tiers");
  if (/\$\{\{\s*github\.event/.test(texte)) fautes.push("texte d'un événement recopié dans le workflow");
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
  ];
  const suivis = [
    "essais/classeur_essai.xlsx", "essais/banque_demo.chiffree.json", "essais/banque_format1.chiffree.json", "donnees/banque.chiffree.json", "package.json", "index.html", "js/application.js", "icones/icone.svg",
    "essais/personnage_demo.arpenteur.json", "polices/Marcellus-Regular.woff2", "polices/OFL-Marcellus.txt", "css/fiche.css",
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
    writeFileSync(join(essai, "propre.txt"), "rien");
    g("add", "-A");
    g("commit", "-q", "-m", "ajout");
    g("rm", "-q", "regles_jdr.xlsx", "note.txt");
    g("commit", "-q", "-m", "retrait");
    assert.deepEqual(cheminsInterdits(cheminsDeLHistorique(essai)), ["regles_jdr.xlsx"]);
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

test("workflow — les workflows du dépôt sont sûrs (§ 10.2)", () => {
  const workflows = cheminsDuDepot().filter((chemin) => chemin.startsWith(".github/workflows/"));
  assert.ok(workflows.length >= 1);
  for (const chemin of workflows) assert.deepEqual(defautsDuWorkflow(lire(chemin, "utf8")), [], chemin);
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
    // Le format 1 n'est permis dans donnees/ que pour le fichier du 29/09/2026.
    [{ ...enTete, format: 1, empreinte: `sha256:${"1".repeat(64)}`, kdf, chiffre }, 1],
    [{ ...enTete, format: 1, empreinte: FORMAT_1_PUBLIE, kdf, chiffre }, 0],
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

test("interdit 2 — les banques d'essais/ ont la forme chiffrée du § 7.1 : démonstration au format 2, ancien format au format 1", () => {
  const banques = cheminsDuDepot().filter((chemin) => /^essais\/.+\.chiffree\.json$/.test(chemin));
  assert.deepEqual(banques.sort(), ["essais/banque_demo.chiffree.json", "essais/banque_format1.chiffree.json"]);
  for (const chemin of banques) assert.equal(defautDeFormeChiffree(lire(chemin, "utf8")), null, chemin);
  assert.equal(JSON.parse(lire("essais/banque_demo.chiffree.json", "utf8")).format, 2);
  assert.equal(JSON.parse(lire("essais/banque_format1.chiffree.json", "utf8")).format, 1);
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
