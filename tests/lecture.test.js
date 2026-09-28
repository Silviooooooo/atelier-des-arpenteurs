// Contrôles de la lecture (SPECIFICATION.md, § 6.1 et § 11, domaine
// « Lecture ») : le lecteur XML, le lecteur ZIP et le lecteur de classeur,
// sur le classeur d'essai et sur des archives abîmées exprès.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ErreurXml, attribut, enfants, lireXml, premier, texte } from "../js/lecture/xml.js";
import { lireArchive } from "../js/lecture/zip.js";
import { lireClasseur } from "../js/lecture/xlsx.js";
import { archiver, fabriquerClasseur } from "./outils/fabrique_classeur.js";
import { CLASSEUR_ESSAI } from "./outils/classeur_essai.js";

const SUIVI = readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url));

async function lireEssai() {
  const classeur = await lireClasseur(SUIVI);
  assert.equal(classeur.erreur, undefined, classeur.erreur);
  return classeur;
}

function cellule(classeur, feuille, numero, colonne) {
  const ligne = classeur.feuilles.find((f) => f.nom === feuille).lignes.find((l) => l.numero === numero);
  return ligne?.cellules[colonne];
}

// Position, dans l'archive, de l'entrée du répertoire central qui porte ce nom.
function entreeCentrale(octets, nom) {
  const fin = octets.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let position = octets.readUInt32LE(fin + 16);
  while (position < fin) {
    const longueur = octets.readUInt16LE(position + 28);
    if (octets.toString("utf8", position + 46, position + 46 + longueur) === nom) return position;
    position += 46 + longueur + octets.readUInt16LE(position + 30) + octets.readUInt16LE(position + 32);
  }
  throw new Error(`entrée ${nom} absente`);
}

function abime(modifier) {
  const octets = Buffer.from(SUIVI);
  modifier(octets);
  return octets;
}

// — Le lecteur XML

test("XML — entités, références de caractère, CDATA ; commentaires et instructions ignorés", () => {
  const racine = lireXml('<?xml version="1.0"?><!-- note --><a>x &lt;&amp;&gt; &#233;&#x41;<![CDATA[<brut> & ]]><?pi y?></a>');
  assert.equal(texte(racine), "x <&> éA<brut> & ");
});

test("XML — balises et attributs se retrouvent par leur nom local", () => {
  const racine = lireXml('<x:feuille xmlns:x="u" xmlns:r="v"><x:ligne r="1" r:id="rId7"/><ligne r="2"/></x:feuille>');
  assert.equal(racine.local, "feuille");
  assert.deepEqual(enfants(racine, "ligne").map((l) => attribut(l, "r")), ["1", "2"]);
  assert.equal(attribut(premier(racine, "ligne"), "id"), "rId7");
  assert.equal(attribut(racine, "x"), null, "une déclaration d'espace de noms ne répond pas");
});

test("XML — fins de ligne normalisées, blancs d'attribut normalisés, références gardées", () => {
  const racine = lireXml('<a b="un\tdeux&#10;trois">x\r\ny\rz</a>');
  assert.equal(attribut(racine, "b"), "un deux\ntrois");
  assert.equal(texte(racine), "x\ny\nz");
});

test("XML — un XML mal formé ou un DOCTYPE lèvent ErreurXml", () => {
  for (const mauvais of ["<a><b></a>", "<a>", "<a>x & y</a>", "<a>&inconnue;</a>", "<!DOCTYPE a><a/>", "<a/><b/>", '<a b="1" b="2"/>', "texte seul"]) {
    assert.throws(() => lireXml(mauvais), ErreurXml, mauvais);
  }
});

// — Le classeur d'essai

test("classeur — feuilles dans leur ordre, en-têtes tels qu'écrits, y compris en XML préfixé", async () => {
  const classeur = await lireEssai();
  assert.deepEqual(classeur.feuilles.map((f) => f.nom), ["lisez_moi", "Blocs", "Eléments", "Capacites", "Formes de cellules"]);
  const entetes = (nom) => classeur.feuilles.find((f) => f.nom === nom).lignes.find((l) => l.numero === 1).cellules;
  assert.deepEqual(entetes("Blocs"), ["Nom", "Eléments transmis aux capacités", "Capacités", "Paramètres transmis aux capacités", "Infos"]);
  assert.deepEqual(entetes("Eléments"), ["Nom", "Paramètres reçus", "Description"]);
  assert.deepEqual(entetes("Capacites"), ["Nom", "puissance", "Coût en souffle", "Coût en lien", "Éléments propres", "description", "origine"]);
});

test("classeur — numéros de ligne d'Excel gardés, lignes vides absentes, cellules vides en chaîne vide", async () => {
  const classeur = await lireEssai();
  const lisezMoi = classeur.feuilles.find((f) => f.nom === "lisez_moi").lignes;
  assert.deepEqual(lisezMoi.map((l) => l.numero), [2, 3, 4, 5, 6]);
  assert.deepEqual(lisezMoi[1].cellules, ["", "Une capacité invoque un paramètre sous la forme {nom}."]);
  const formes = classeur.feuilles.find((f) => f.nom === "Formes de cellules").lignes;
  assert.deepEqual(formes.map((l) => l.numero).slice(-2), [11, 13]);
  assert.equal(cellule(classeur, "Formes de cellules", 13, 27), "colonne AB");
  assert.equal(cellule(classeur, "Formes de cellules", 13, 26), "");
});

test("classeur — texte enrichi, texte en ligne, retours à la ligne, formule, booléens, erreur, « _x »", async () => {
  const classeur = await lireEssai();
  const forme = (numero, colonne = 1) => cellule(classeur, "Formes de cellules", numero, colonne);
  assert.equal(forme(2), "Texte enrichi en trois morceaux.");
  assert.equal(forme(3), "Écrit en ligne, sans chaîne partagée.");
  assert.equal(forme(4), "Deux lignes :\nla seconde.");
  assert.equal(forme(5), "Retour chariot :\r\nfin.");
  assert.equal(forme(6), "Écrire _x0041_ tel quel.");
  assert.equal(forme(7), "  gardés  ");
  assert.equal(forme(8), "formule");
  assert.deepEqual([forme(9, 1), forme(9, 2)], ["VRAI", "FAUX"]);
  assert.equal(forme(10), "#N/A");
  assert.equal(cellule(classeur, "Capacites", 3, 5), "Tourbillonne [N] fois.");
  assert.equal(cellule(classeur, "Capacites", 4, 5), "Lance du sel à {distance} pas.\nPuis recommence.");
});

test("classeur — nombres sans décimale inutile, à 15 chiffres significatifs et à virgule, comme Excel en français", async () => {
  const classeur = await lireEssai();
  assert.deepEqual([1, 2, 3, 4, 5].map((colonne) => cellule(classeur, "Formes de cellules", 11, colonne)), ["0,5", "10", "1234,5678", "-3", "0,3"]);
  assert.deepEqual([5, 6, 7].map((numero) => cellule(classeur, "Capacites", numero, 1)), ["1", "2", "3"]);
  assert.equal(cellule(classeur, "Capacites", 2, 1), "0");
});

test("classeur — le classeur suivi correspond à sa description", async () => {
  const suivi = lireArchive(SUIVI);
  const neuf = lireArchive(fabriquerClasseur(CLASSEUR_ESSAI));
  assert.deepEqual(suivi.noms, neuf.noms);
  const decodeur = new TextDecoder();
  for (const nom of neuf.noms) {
    assert.equal(decodeur.decode(await suivi.lire(nom)), decodeur.decode(await neuf.lire(nom)), `${nom} diffère : relancer node tests/outils/classeur_essai.js`);
  }
});

// — Les fichiers illisibles donnent un message, jamais une exception

async function message(octets) {
  const resultat = await lireClasseur(octets);
  assert.equal(resultat.feuilles, undefined);
  assert.equal(typeof resultat.erreur, "string");
  return resultat.erreur;
}

test("illisible — un fichier qui n'est pas une archive ZIP", async () => {
  assert.match(await message(Buffer.from("Nom;Capacités\nLouche;Coup\n")), /n'est pas un classeur \.xlsx lisible : ce n'est pas une archive ZIP/);
  assert.match(await message(new Uint8Array(0)), /pas une archive ZIP/);
});

test("illisible — une archive tronquée", async () => {
  assert.match(await message(SUIVI.subarray(0, SUIVI.length - 200)), /tronquée/);
});

test("illisible — un CRC faux", async () => {
  const octets = abime((o) => o.writeUInt32LE(o.readUInt32LE(entreeCentrale(o, "xl/workbook.xml") + 16) ^ 1, entreeCentrale(o, "xl/workbook.xml") + 16));
  assert.match(await message(octets), /« xl\/workbook\.xml » a un CRC faux/);
});

test("illisible — une entrée chiffrée", async () => {
  const octets = abime((o) => o.writeUInt16LE(0x0801, entreeCentrale(o, "xl/workbook.xml") + 8));
  assert.match(await message(octets), /« xl\/workbook\.xml » est chiffrée/);
});

test("illisible — une méthode de compression inconnue", async () => {
  const octets = abime((o) => o.writeUInt16LE(12, entreeCentrale(o, "xl/workbook.xml") + 10));
  assert.match(await message(octets), /méthode de compression 12/);
});

test("illisible — une archive ZIP64", async () => {
  const octets = abime((o) => o.writeUInt16LE(0xffff, o.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 10));
  assert.match(await message(octets), /ZIP64/);
});

test("illisible — un classeur protégé par mot de passe, ou au format .xls", async () => {
  const compose = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(504)]);
  assert.match(await message(compose), /protégé par un mot de passe/);
});

test("illisible — une archive ZIP qui n'est pas un classeur, un XML abîmé", async () => {
  const zipQuelconque = archiver([{ nom: "notes.txt", contenu: Buffer.from("bonjour") }]);
  assert.match(await message(zipQuelconque), /n'est pas un classeur Excel/);
  const neuf = lireArchive(fabriquerClasseur(CLASSEUR_ESSAI));
  const entrees = [];
  for (const nom of neuf.noms) {
    const contenu = Buffer.from(await neuf.lire(nom));
    entrees.push({ nom, contenu: nom === "xl/worksheets/sheet2.xml" ? contenu.subarray(0, contenu.length - 30) : contenu });
  }
  assert.match(await message(archiver(entrees)), /« xl\/worksheets\/sheet2\.xml » a un XML illisible/);
});
