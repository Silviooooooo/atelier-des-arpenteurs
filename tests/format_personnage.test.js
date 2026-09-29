// Contrôles du format du personnage, de son fichier et de son lien
// (SPECIFICATION.md, § 15.1, § 15.6 et § 11, domaine « Personnage »). Tout
// fichier ou lien reçu est une donnée hostile.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAILLE_MAX,
  adresseDuLien,
  codeDuLien,
  depuisBase64Url,
  ecrirePersonnage,
  lireCode,
  lirePersonnage,
  nomDeFichier,
  nouveauPersonnage,
  versBase64Url,
  verifier,
} from "../js/personnage/format.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const lire = (objet, mode = "demo") => lirePersonnage(typeof objet === "string" ? objet : JSON.stringify(objet), { mode });

test("format — un personnage neuf et le personnage d'essai se vérifient ; le fichier fait l'aller-retour", () => {
  const neuf = nouveauPersonnage("reel", new Date("2026-09-29T20:00:00Z"));
  assert.equal(verifier(neuf), neuf);
  assert.match(neuf.id, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(nouveauPersonnage("reel").id, neuf.id);
  const essai = personnageEssai();
  const texte = ecrirePersonnage(essai);
  assert.ok(texte.endsWith("}\n"));
  assert.deepEqual(lire(texte).personnage, essai);
  // Aucune donnée copiée de la banque : les seules chaînes sont des noms,
  // des dates, des textes du joueur et des qualités.
  assert.deepEqual(Object.keys(essai).sort(), [
    "archetype", "arme_principale", "banque", "bouclier", "caracteristiques", "constellation", "cree_le", "empreintes", "enregistre_le",
    "equipement", "espece", "etape", "etat", "format", "id", "identite", "mode", "modifie_le", "niveaux", "primordial",
  ]);
});

test("format — un champ inconnu, un champ manquant ou « __proto__ » font refuser le fichier", () => {
  const avec = (modifier) => {
    const p = personnageEssai();
    modifier(p);
    return p;
  };
  assert.match(lire(avec((p) => (p.pouvoir = "tout"))).erreur, /le champ « pouvoir » est inconnu/);
  assert.match(lire(avec((p) => (p.identite.titre = "roi"))).erreur, /L'identité : le champ « titre » est inconnu/);
  assert.match(lire(avec((p) => delete p.niveaux)).erreur, /le champ « niveaux » manque/);
  assert.match(lire(avec((p) => (p.equipement[0].prix = 3))).erreur, /L'objet 1 : le champ « prix » est inconnu/);
  const proto = JSON.stringify(personnageEssai()).replace('"identite":{', '"identite":{"__proto__":{"nom":"x"},');
  assert.match(lire(proto).erreur, /le champ « __proto__ » est inconnu/);
  assert.equal({}.nom, undefined, "aucun prototype touché");
});

test("format — chaque champ vérifié : types, bornes, dates, index, qualité, caractères de contrôle", () => {
  const refus = [
    [(p) => (p.format = 2), /version plus récente de l'Atelier : rechargez la page/],
    [(p) => (p.format = "1"), /format inconnu/],
    [(p) => (p.id = "court"), /identifiant/],
    [(p) => (p.mode = "admin"), /mode du personnage est inconnu/],
    [(p) => (p.etat = "fini"), /état du personnage/],
    [(p) => (p.etape = 10), /L'étape doit être un entier de 1 à 9/],
    [(p) => (p.cree_le = "hier"), /n'est pas une date/],
    [(p) => (p.identite.nom = 42), /Le nom n'est pas un texte/],
    [(p) => (p.identite.nom = "x".repeat(121)), /Le nom dépasse 120 signes/],
    [(p) => (p.identite.nom = "Aubépine\u0000"), /caractère de contrôle/],
    [(p) => (p.identite.nom = "Aubé\npine"), /caractère de contrôle/],
    [(p) => (p.caracteristiques.force = 7), /Force doit être un entier de 2 à 6/],
    [(p) => (p.caracteristiques.force = 4.5), /Force doit être un entier/],
    [(p) => (p.archetype = { nom: "", choix: [] }), /L'archétype, nom est vide/],
    [(p) => (p.archetype.choix = "Solo du chef"), /n'est pas une liste/],
    [(p) => (p.constellation.obtention = "magie"), /« tirage » ou « saisie »/],
    [(p) => (p.equipement = Array(81).fill(p.equipement[0])), /plus de 80 éléments/],
    [(p) => (p.equipement[0].qualite = "deux"), /la qualité est un nombre/],
    [(p) => (p.equipement[0].qualite = 2), /la qualité est un nombre/],
    [(p) => (p.equipement[0].porte = "oui"), /« porte » est vrai ou faux/],
    [(p) => (p.arme_principale = 9), /L'arme principale doit être un entier de 0 à 8/],
    [(p) => (p.bouclier = -1), /Le bouclier doit être un entier/],
    [(p) => (p.niveaux = [{ capacite: "Flambage", niveau: 4 }]), /niveau doit être un entier de 2 à 3/],
    [(p) => (p.empreintes = [{ genre: "bloc", nom: "Saucier", empreinte: "<script>" }]), /L'empreinte 1 est illisible/],
    [(p) => (p.etat = "enregistre"), /date d'enregistrement/],
    [(p) => (p.equipement = []), /désigne un objet absent/],
  ];
  for (const [modifier, attendu] of refus) {
    const p = personnageEssai();
    modifier(p);
    const { erreur, personnage } = lire(p);
    assert.equal(personnage, undefined, String(attendu));
    assert.match(erreur, attendu);
  }
  // Un texte de joueur garde ses retours à la ligne, et le HTML y reste du texte.
  const libre = personnageEssai((p) => (p.identite.histoire = "Ligne 1\nLigne 2 <img src=x onerror=alert(1)>"));
  assert.equal(lire(libre).personnage.identite.histoire, "Ligne 1\nLigne 2 <img src=x onerror=alert(1)>");
});

test("format — la taille est bornée à 64 Ko ; un JSON illisible ou un tableau donnent un message", () => {
  const gros = JSON.stringify(personnageEssai()) + " ".repeat(TAILLE_MAX);
  assert.match(lire(gros).erreur, /dépasse 64 Ko/);
  assert.match(lire("{ pas du JSON").erreur, /JSON illisible/);
  assert.match(lire("[]").erreur, /n'est pas un objet/);
  assert.match(lire("null").erreur, /n'est pas un objet/);
  assert.match(lirePersonnage(null, { mode: "demo" }).erreur, /illisible/);
});

test("format — un personnage réel ouvert en démonstration, ou l'inverse, est refusé avec un message", () => {
  const demo = personnageEssai();
  assert.match(lire(demo, "reel").erreur, /créé dans la démonstration : ouvrez-le dans la démonstration/);
  const reel = personnageEssai((p) => (p.mode = "reel"));
  assert.match(lire(reel, "demo").erreur, /créé avec la banque réelle : ouvrez-le hors de la démonstration/);
  assert.ok(lire(reel, "reel").personnage);
});

test("fichier — un nom de fichier sûr, terminé par .arpenteur.json", () => {
  assert.equal(nomDeFichier(personnageEssai()), "Aubépine Crèmebrûlée.arpenteur.json");
  assert.equal(nomDeFichier(personnageEssai((p) => (p.identite.nom = '../../a:b*c?"<>|'))), "..abc.arpenteur.json".replace(/^\.+/, ""));
  assert.equal(nomDeFichier(personnageEssai((p) => (p.identite.nom = "   "))), "personnage.arpenteur.json");
});

test("lien — aller-retour : compressé, en base64url, dans le fragment de l'adresse", async () => {
  const essai = personnageEssai();
  const code = await codeDuLien(essai);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.ok(code.length < JSON.stringify(essai).length, "compressé");
  assert.deepEqual((await lireCode(code, { mode: "demo" })).personnage, essai);
  const adresse = adresseDuLien(code, { origine: "https://silviooooooo.github.io", chemin: "/atelier-des-arpenteurs/", mode: "demo" });
  assert.equal(adresse, `https://silviooooooo.github.io/atelier-des-arpenteurs/?demo=1#/recevoir/${code}`);
  assert.equal(new URL(adresse).hash, `#/recevoir/${code}`, "le personnage n'est que dans le fragment");
  assert.equal(adresseDuLien("abc", { origine: "https://a.b", chemin: "/", mode: "reel" }), "https://a.b/#/recevoir/abc");
  // base64url : aller-retour de tous les octets.
  const octets = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(depuisBase64Url(versBase64Url(octets)), octets);
});

test("lien — abîmé, forgé, trop gros une fois décompressé, ou de l'autre mode : refusé avec un message", async () => {
  assert.match((await lireCode("", { mode: "demo" })).erreur, /abîmé/);
  assert.match((await lireCode("a", { mode: "demo" })).erreur, /abîmé/);
  assert.match((await lireCode("!!!", { mode: "demo" })).erreur, /abîmé/);
  assert.match((await lireCode(versBase64Url(new TextEncoder().encode("pas compressé")), { mode: "demo" })).erreur, /abîmé/);
  // Une bombe : un mégaoctet de zéros, compressé en quelques centaines d'octets.
  const bombe = await new Response(new Blob([new Uint8Array(1024 * 1024)]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
  assert.ok(bombe.byteLength < 2048);
  assert.match((await lireCode(versBase64Url(new Uint8Array(bombe)), { mode: "demo" })).erreur, /dépasse 64 Ko une fois décompressé/);
  // Du JSON valide, compressé, mais pas un personnage.
  const faux = await new Response(new Blob([JSON.stringify({ format: 1, pirate: true })]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
  assert.match((await lireCode(versBase64Url(new Uint8Array(faux)), { mode: "demo" })).erreur, /le champ « pirate » est inconnu/);
  // Un UTF-8 invalide.
  const invalide = await new Response(new Blob([new Uint8Array([0xff, 0xfe, 0x7b])]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
  assert.match((await lireCode(versBase64Url(new Uint8Array(invalide)), { mode: "demo" })).erreur, /abîmé/);
  const code = await codeDuLien(personnageEssai());
  assert.match((await lireCode(code, { mode: "reel" })).erreur, /créé dans la démonstration/);
});
