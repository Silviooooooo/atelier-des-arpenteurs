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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

function git(...parametres) {
  return execFileSync("git", parametres, { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
  if (kdf.nom !== "PBKDF2-SHA256" || !Number.isInteger(kdf.iterations) || !BASE64.test(kdf.sel ?? "")) {
    return "dérivation (kdf) incomplète";
  }
  if (chiffre.nom !== "AES-GCM" || !BASE64.test(chiffre.iv ?? "") || !BASE64.test(chiffre.donnees ?? "")) {
    return "données chiffrées incomplètes";
  }
  return null;
}

function donneesEnClair(chemins, lireTexte) {
  const fautes = [];
  for (const chemin of chemins.filter((c) => c.startsWith("donnees/"))) {
    const defaut = chemin === BANQUE ? defautDeFormeChiffree(lireTexte(chemin)) : `seule ${BANQUE} a sa place ici`;
    if (defaut) fautes.push(`${chemin} : ${defaut}`);
  }
  return fautes;
}

// Interdit 3 : aucun jeton GitHub entier. Un préfixe seul ne suffit pas, car
// la spécification les cite (§ 11). La faute donne le fichier et la ligne,
// jamais le jeton, que le journal de GitHub Actions rendrait public.
const JETON = /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{36,}/;

function jetonsEntiers(fichiers) {
  return lignesFautives(fichiers, JETON);
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

test("interdit 2 — repère des données en clair dans donnees/", () => {
  const enTete = { format: 1, publiee_le: "2026-09-28T14:32:00+02:00", empreinte: "sha256:00" };
  const kdf = { nom: "PBKDF2-SHA256", iterations: 600000, sel: "c2Vs" };
  const chiffre = { nom: "AES-GCM", iv: "aXY=", donnees: "ZG9ubsOpZXM=" };
  const essais = [
    [{ ...enTete, kdf, chiffre }, 0],
    [{ ...enTete, kdf, chiffre, blocs: [] }, 1],
    [{ ...enTete, kdf: { ...kdf, capacites: [] }, chiffre }, 1],
    [{ ...enTete, kdf, chiffre: { ...chiffre, donnees: '{"blocs":[]}' } }, 1],
    [{ ...enTete, kdf }, 1],
  ];
  for (const [banque, nombre] of essais) {
    const fautes = donneesEnClair([BANQUE], () => JSON.stringify(banque));
    assert.equal(fautes.length, nombre, JSON.stringify(banque));
  }
  assert.equal(donneesEnClair([BANQUE], () => "{ pas du JSON").length, 1);
  assert.equal(donneesEnClair(["donnees/banque.json", "donnees/copie.csv"], () => "{}").length, 2);
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
  ];
  assert.deepEqual(jetonsEntiers(fichiers), ["a.js, ligne 1", "c.txt, ligne 3"]);
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
