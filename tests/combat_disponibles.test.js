// Contrôles des personnages disponibles pour un combat (SPECIFICATION.md,
// § 17 et § 11, domaine « Combat ») : la règle qui dit lesquels se proposent
// (js/personnage/disponibles.js), et le fait qu'on les lit sans rien écrire
// sur l'appareil, là où l'écran Personnages, lui, range en passant.
//
// Les personnages sont ceux de l'outil des essais, fictifs ; le site est
// simulé par un dépôt écrit à la main, ou par le vrai dépôt devant un réseau
// qui ne répond pas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHRASE_CLE_CHANGEE, creerDepot } from "../js/personnage/depot.js";
import { personnagesDisponibles, retenir } from "../js/personnage/disponibles.js";
import { lirePersonnage } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");

const HIER = "2026-10-10T10:00:00.000Z";
const AUJOURD_HUI = "2026-10-11T10:00:00.000Z";
const DEMAIN = "2026-10-12T10:00:00.000Z";

// Un personnage enregistré du mode réel : une lettre fait son identifiant.
const personnage = (lettre, nom, modifie_le = AUJOURD_HUI, champs = {}) =>
  personnageEssai((p) => {
    Object.assign(p, { id: `reel-${lettre}-0000000000001`, mode: "reel", etat: "enregistre", etape: 9, enregistre_le: modifie_le, modifie_le, ...champs });
    p.identite.nom = nom;
  });
const brouillon = (lettre, nom, modifie_le = AUJOURD_HUI) => personnage(lettre, nom, modifie_le, { etat: "brouillon", enregistre_le: null });
const note = (p, depot) => ({ cle: `${p.mode}/${p.id}`, mode: p.mode, id: p.id, remplace: null, nom: null, depot });
const envoi = (action, etat = "envoye") => ({ etat, action, ticket: etat === "envoye" ? 12 : null, date: AUJOURD_HUI, erreur: etat === "envoye" ? null : "Pas de réseau." });
const resume = (liste) => liste.map(({ personnage: p, source }) => [p.identite.nom, source, p.modifie_le]);

// Un dépôt écrit à la main : il ne sait que lire, et tout le reste lève.
function depotSimule(lu) {
  const appels = [];
  const interdit = (nom) => () => {
    appels.push(nom);
    throw new Error(`${nom}() ne doit pas être appelé`);
  };
  return {
    appels,
    lireEnLigne: async () => {
      appels.push("lireEnLigne");
      if (lu instanceof Error) throw lu;
      return { personnages: [], ids: new Set(), illisibles: 0, ancienneCle: 0, cleChangee: 0, ...lu };
    },
    rapprocher: interdit("rapprocher"),
    envoyer: interdit("envoyer"),
    supprimer: interdit("supprimer"),
    reessayer: interdit("reessayer"),
  };
}

// Une étagère sur un magasin en mémoire, dont chaque écriture est notée.
async function etagereEspionnee(mode, personnages, notes = []) {
  const magasin = magasinPersonnagesMemoire();
  for (const p of personnages) await magasin.ecrire(mode, p);
  for (const n of notes) await magasin.ecrireNote(n);
  const ecritures = [];
  for (const nom of ["ecrire", "effacer", "ecrireNote", "effacerNote"]) {
    const origine = magasin[nom];
    magasin[nom] = (...arguments_) => {
      ecritures.push(nom);
      return origine(...arguments_);
    };
  }
  const contenu = async () => JSON.stringify([await magasin.lister(mode), await magasin.listerNotes(mode)]);
  return { etagere: creerEtagere(magasin, mode), ecritures, contenu };
}

// ─── La règle ───────────────────────────────────────────────────────────────

test("retenir — un personnage par identifiant : la version la plus récente, et à égalité celle en ligne", () => {
  const cas = (dateAppareil, dateEnLigne) => resume(retenir([personnage("a", "Aubépine", dateAppareil)], [], [personnage("a", "Aubépine", dateEnLigne)]));
  assert.deepEqual(cas(DEMAIN, AUJOURD_HUI), [["Aubépine", "appareil", DEMAIN]]);
  assert.deepEqual(cas(HIER, AUJOURD_HUI), [["Aubépine", "en_ligne", AUJOURD_HUI]]);
  assert.deepEqual(cas(AUJOURD_HUI, AUJOURD_HUI), [["Aubépine", "en_ligne", AUJOURD_HUI]]);
  // Deux écritures de la même date sont une égalité.
  assert.deepEqual(resume(retenir([personnage("a", "Aubépine", "2026-10-11T12:00:00+02:00")], [], [personnage("a", "Aubépine", AUJOURD_HUI)])), [["Aubépine", "en_ligne", AUJOURD_HUI]]);
  // Seul sur l'appareil, ou seul en ligne.
  assert.deepEqual(resume(retenir([personnage("a", "Aubépine")], [], [])), [["Aubépine", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(resume(retenir([], [], [personnage("a", "Aubépine")])), [["Aubépine", "en_ligne", AUJOURD_HUI]]);
  assert.deepEqual(retenir([], [], []), []);
  assert.deepEqual(retenir(undefined, undefined, undefined), []);
});

test("retenir — un brouillon ne se propose pas, même plus récent que la version en ligne", () => {
  assert.deepEqual(retenir([brouillon("a", "Aubépine")], [], []), []);
  assert.deepEqual(resume(retenir([brouillon("a", "Aubépine", DEMAIN)], [], [personnage("a", "Aubépine", HIER)])), [["Aubépine", "en_ligne", HIER]]);
  // Enregistré, le même personnage se propose.
  assert.deepEqual(resume(retenir([personnage("a", "Aubépine", DEMAIN)], [], [personnage("a", "Aubépine", HIER)])), [["Aubépine", "appareil", DEMAIN]]);
});

test("retenir — un personnage dont l'appareil a demandé la suppression n'apparaît pas, envoyée ou non", () => {
  const a = personnage("a", "Aubépine");
  const b = personnage("b", "Basilic");
  for (const etat of ["envoye", "non_envoye"]) {
    // La version en ligne se cache, comme la copie de l'appareil.
    assert.deepEqual(resume(retenir([b], [note(a, envoi("supprimer", etat))], [a])), [["Basilic", "appareil", AUJOURD_HUI]], etat);
    assert.deepEqual(retenir([a], [note(a, envoi("supprimer", etat))], []), [], etat);
  }
  // Une note d'envoi, une note sans dépôt, ne cachent rien.
  for (const depot of [envoi("creer"), envoi("remplacer", "non_envoye"), null]) {
    assert.deepEqual(resume(retenir([b], [note(a, depot)], [a])), [["Aubépine", "en_ligne", AUJOURD_HUI], ["Basilic", "appareil", AUJOURD_HUI]]);
  }
});

test("retenir — la liste est triée par nom, sans casse ni accents ; elle ne modifie rien de ce qu'elle reçoit", () => {
  const locaux = [personnage("z", "Zeste"), personnage("e", "Échalote"), personnage("b", "basilic")];
  const enLigne = [personnage("c", "Câpre"), personnage("d", "Estragon"), personnage("a", "Aubépine")];
  const notes = [note(locaux[0], envoi("creer"))];
  const avant = JSON.stringify([locaux, notes, enLigne]);
  for (const liste of [locaux, notes, enLigne]) Object.freeze(liste);
  const retenus = retenir(locaux, notes, enLigne);
  assert.deepEqual(retenus.map(({ personnage: p }) => p.identite.nom), ["Aubépine", "basilic", "Câpre", "Échalote", "Estragon", "Zeste"]);
  assert.equal(JSON.stringify([locaux, notes, enLigne]), avant);
  assert.equal(retenus.find(({ personnage: p }) => p.identite.nom === "Zeste").personnage, locaux[0], "le personnage tel que lu, pas une copie");
  // Deux personnages de même nom gardent un ordre fixe : celui de leur identifiant.
  const jumeaux = [personnage("y", "Persil"), personnage("x", "Persil")];
  assert.deepEqual(retenir(jumeaux, [], []).map(({ personnage: p }) => p.id), [jumeaux[1].id, jumeaux[0].id]);
  assert.deepEqual(retenir([...jumeaux].reverse(), [], []).map(({ personnage: p }) => p.id), [jumeaux[1].id, jumeaux[0].id]);
});

// ─── La lecture seule ───────────────────────────────────────────────────────

test("lecture seule — là où l'écran Personnages effacerait des copies de l'appareil, rien ne s'écrit", async () => {
  // A : envoyé, rattrapé par la version en ligne. H : une copie sans note, de la même date que la version en ligne.
  // C : suppression envoyée, que l'index ne porte plus. Dans ces trois cas, rapprocher() écrit sur l'appareil.
  const a = personnage("a", "Aubépine");
  const h = personnage("h", "Hysope");
  const c = personnage("c", "Câpre");
  const g = personnage("g", "Girofle", DEMAIN);
  const d = brouillon("d", "Dragée");
  const notes = [note(a, envoi("creer")), note(c, envoi("supprimer"))];
  const { etagere, ecritures, contenu } = await etagereEspionnee("reel", [a, h, g, d], notes);
  const avant = await contenu();
  const depot = depotSimule({ personnages: [a, h, personnage("e", "Estragon"), personnage("g", "Girofle", HIER)] });

  const { personnages, phrases } = await personnagesDisponibles({ etagere, depot });
  assert.deepEqual(resume(personnages), [
    ["Aubépine", "en_ligne", AUJOURD_HUI],
    ["Estragon", "en_ligne", AUJOURD_HUI],
    ["Girofle", "appareil", DEMAIN],
    ["Hysope", "en_ligne", AUJOURD_HUI],
  ]);
  assert.deepEqual(phrases, []);
  assert.deepEqual(ecritures, [], "aucune écriture dans le magasin");
  assert.equal(await contenu(), avant, "l'appareil est tel qu'avant");
  assert.deepEqual(depot.appels, ["lireEnLigne"], "un seul appel au dépôt, et jamais rapprocher()");
});

test("lecture seule — le témoin : sur le même appareil et le même site, rapprocher() écrit, la lecture des disponibles non", async () => {
  // Une suppression envoyée, que le site n'a plus : le rapprochement de l'écran Personnages efface sa note.
  const c = personnage("c", "Câpre");
  const { etagere, ecritures, contenu } = await etagereEspionnee("reel", [personnage("g", "Girofle")], [note(c, envoi("supprimer"))]);
  const avant = await contenu();
  const depot = creerDepot({ mode: "reel", banque: {}, secret: { cle: {}, sel: "sel" }, etagere, fetch: async () => ({ ok: false, status: 404 }) });
  const { personnages, phrases } = await personnagesDisponibles({ etagere, depot });
  assert.deepEqual(resume(personnages), [["Girofle", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(phrases, [], "aucun personnage en ligne n'est pas une erreur");
  assert.deepEqual(ecritures, []);
  assert.equal(await contenu(), avant);
  await depot.rapprocher();
  assert.deepEqual(ecritures, ["effacerNote"]);
  assert.notEqual(await contenu(), avant);
});

test("lecture seule — sans dépôt, l'appareil seul ; une étagère sans notes se lit aussi", async () => {
  const { etagere, ecritures } = await etagereEspionnee("reel", [personnage("a", "Aubépine"), brouillon("d", "Dragée")]);
  assert.deepEqual(resume((await personnagesDisponibles({ etagere })).personnages), [["Aubépine", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(resume((await personnagesDisponibles({ etagere, depot: null })).personnages), [["Aubépine", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(ecritures, []);
  const sansNotes = { lister: async () => ({ personnages: [personnage("a", "Aubépine")], illisibles: 0 }) };
  assert.deepEqual(await personnagesDisponibles({ etagere: sansNotes }), { personnages: retenir([personnage("a", "Aubépine")], [], []), phrases: [] });
});

// ─── La lecture qui échoue ──────────────────────────────────────────────────

test("la lecture en ligne échoue — la liste montre ceux de l'appareil, avec la phrase du dépôt", async () => {
  const locaux = [personnage("a", "Aubépine"), personnage("b", "Basilic")];
  const { etagere, ecritures } = await etagereEspionnee("reel", locaux);
  const ERREUR = "Les personnages en ligne n'ont pas pu être lus (réponse 503).";
  const refuse = await personnagesDisponibles({ etagere, depot: depotSimule({ erreur: ERREUR }) });
  assert.deepEqual(resume(refuse.personnages), [["Aubépine", "appareil", AUJOURD_HUI], ["Basilic", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(refuse.phrases, [ERREUR]);

  // Le vrai dépôt, devant un réseau qui ne répond pas.
  let appels = 0;
  const depot = creerDepot({
    mode: "reel",
    banque: {},
    secret: { cle: {}, sel: "sel" },
    etagere,
    fetch: async () => {
      appels += 1;
      throw new TypeError("réseau coupé");
    },
  });
  const coupe = await personnagesDisponibles({ etagere, depot });
  assert.equal(appels, 1, "l'index seulement, une fois");
  assert.deepEqual(resume(coupe.personnages), resume(refuse.personnages));
  assert.deepEqual(coupe.phrases, ["Pas de réseau : les personnages en ligne ne se lisent pas."]);

  // Un dépôt qui lève : la liste vient quand même.
  const leve = await personnagesDisponibles({ etagere, depot: depotSimule(new Error("imprévu")) });
  assert.deepEqual(resume(leve.personnages), resume(refuse.personnages));
  assert.deepEqual(leve.phrases, ["Les personnages en ligne ne se lisent pas pour l'instant."]);
  assert.deepEqual(ecritures, []);
});

test("la lecture en ligne est partielle — les phrases de l'écran Personnages, au singulier et au pluriel", async () => {
  const { etagere } = await etagereEspionnee("reel", [personnage("a", "Aubépine")]);
  const b = personnage("b", "Basilic");
  const un = await personnagesDisponibles({ etagere, depot: depotSimule({ personnages: [b], cleChangee: 1, ancienneCle: 1, illisibles: 1 }) });
  assert.deepEqual(resume(un.personnages), [["Aubépine", "appareil", AUJOURD_HUI], ["Basilic", "en_ligne", AUJOURD_HUI]], "ceux qui se lisent se proposent");
  assert.deepEqual(un.phrases, [
    `${PHRASE_CLE_CHANGEE} (1 personnage en ligne attend la nouvelle clé.)`,
    "1 personnage en ligne est chiffré avec une ancienne clé de table : l'auteur doit les rechiffrer.",
    "1 personnage illisible est ignoré.",
  ]);
  const plusieurs = await personnagesDisponibles({ etagere, depot: depotSimule({ cleChangee: 2, ancienneCle: 3, illisibles: 2 }) });
  assert.deepEqual(plusieurs.phrases, [
    `${PHRASE_CLE_CHANGEE} (2 personnages en ligne attendent la nouvelle clé.)`,
    "3 personnages en ligne sont chiffrés avec une ancienne clé de table : l'auteur doit les rechiffrer.",
    "2 personnages illisibles sont ignorés.",
  ]);
  // Tout se lit : aucune phrase.
  assert.deepEqual((await personnagesDisponibles({ etagere, depot: depotSimule({ personnages: [b] }) })).phrases, []);
});

test("un personnage illisible de l'appareil est compté, jamais proposé ; une étagère qui ne se lit pas laisse la liste en ligne", async () => {
  const magasin = magasinPersonnagesMemoire();
  await magasin.ecrire("reel", personnage("a", "Aubépine"));
  await magasin.ecrire("reel", { id: "reel-x-0000000000001", mode: "reel", abime: true });
  const lu = await personnagesDisponibles({ etagere: creerEtagere(magasin, "reel"), depot: depotSimule({ illisibles: 2 }) });
  assert.deepEqual(resume(lu.personnages), [["Aubépine", "appareil", AUJOURD_HUI]]);
  assert.deepEqual(lu.phrases, ["3 personnages illisibles sont ignorés."], "ceux de l'appareil et ceux du site, ensemble");

  const cassee = {
    lister: async () => {
      throw new Error("la base est fermée");
    },
    listerNotes: async () => [],
  };
  const sans = await personnagesDisponibles({ etagere: cassee, depot: depotSimule({ personnages: [personnage("b", "Basilic")] }) });
  assert.deepEqual(resume(sans.personnages), [["Basilic", "en_ligne", AUJOURD_HUI]]);
  assert.deepEqual(sans.phrases, ["Les personnages de cet appareil n'ont pas pu être lus : la base est fermée"]);
});

// ─── La démonstration ───────────────────────────────────────────────────────

test("la démonstration — le personnage de démonstration, gardé sur l'appareil, se propose ; rien ne se lit en ligne", async () => {
  const aubepine = lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage;
  const essai = personnageEssai((p) => {
    p.id = "demo-brouillon-000000001";
    p.identite.nom = "Brouillon de sauce";
  });
  const { etagere, ecritures, contenu } = await etagereEspionnee("demo", [aubepine, essai]);
  const avant = await contenu();
  let appels = 0;
  const depot = creerDepot({
    mode: "demo",
    banque: {},
    secret: { cle: {}, sel: "sel" },
    etagere,
    fetch: async () => {
      appels += 1;
      throw new Error("la démonstration ne touche pas au réseau");
    },
  });
  const { personnages, phrases } = await personnagesDisponibles({ etagere, depot });
  assert.deepEqual(personnages, [{ personnage: aubepine, source: "appareil" }]);
  assert.deepEqual(phrases, []);
  assert.equal(appels, 0);
  assert.deepEqual(ecritures, []);
  assert.equal(await contenu(), avant);
  // Un personnage du mode réel, sur le même magasin, n'est pas de cette étagère.
  assert.equal(personnages.every(({ personnage: p }) => p.mode === "demo"), true);
});

test("le module — il ne rapproche pas, et n'écrit rien", () => {
  const source = lire("js/personnage/disponibles.js");
  const code = source.split(/\r?\n/).filter((ligne) => !ligne.trim().startsWith("//") && !ligne.trim().startsWith("*") && !ligne.trim().startsWith("/**")).join("\n");
  // Aucune des méthodes qui écrivent sur l'appareil ou sur le site n'y est appelée.
  assert.doesNotMatch(code, /\.(?:rapprocher|garder|garderNote|effacer|envoyer|supprimer|reessayer|ecrire\w*)\s*\(/);
  for (const interdit of ["rapprocher", "localStorage", "indexedDB"]) assert.ok(!code.includes(interdit), interdit);
  assert.match(code, /etagere\.lister\(\)/);
  assert.match(code, /lireEnLigne\(\)/);
});

// ─── Mise à l'épreuve (lot 4) : ce que les casses du code n'avaient pas fait échouer ───

test("le tri ignore la casse et les accents : deux noms qui n'en diffèrent que par là sont le même nom, rangés par identifiant", () => {
  const paires = [[personnage("y", "persil"), personnage("x", "Persil")], [personnage("y", "Céleri"), personnage("x", "celeri")]];
  for (const [un, deux] of paires) {
    assert.deepEqual(retenir([un, deux], [], []).map(({ personnage: p }) => p.id), [deux.id, un.id]);
    assert.deepEqual(retenir([deux, un], [], []).map(({ personnage: p }) => p.id), [deux.id, un.id]);
  }
});

test("la suppression demandée se lit dans les notes de l'étagère : ni la copie de l'appareil ni la version en ligne ne se proposent", async () => {
  const a = personnage("a", "Aubépine");
  const b = personnage("b", "Basilic");
  for (const etat of ["envoye", "non_envoye"]) {
    const { etagere, ecritures } = await etagereEspionnee("reel", [a, b], [note(a, envoi("supprimer", etat))]);
    const lu = await personnagesDisponibles({ etagere, depot: depotSimule({ personnages: [a] }) });
    assert.deepEqual(resume(lu.personnages), [["Basilic", "appareil", AUJOURD_HUI]], etat);
    assert.deepEqual(resume((await personnagesDisponibles({ etagere })).personnages), [["Basilic", "appareil", AUJOURD_HUI]], `${etat}, sans dépôt`);
    assert.deepEqual(ecritures, []);
  }
});

test("des notes qui ne se lisent pas : rien de l'appareil ne se propose, car une suppression demandée ne se verrait pas", async () => {
  const sansNotes = {
    lister: async () => ({ personnages: [personnage("a", "Aubépine")], illisibles: 0 }),
    listerNotes: async () => {
      throw new Error("les notes sont fermées");
    },
  };
  const lu = await personnagesDisponibles({ etagere: sansNotes, depot: depotSimule({ personnages: [personnage("b", "Basilic")] }) });
  assert.deepEqual(resume(lu.personnages), [["Basilic", "en_ligne", AUJOURD_HUI]]);
  assert.deepEqual(lu.phrases, ["Les personnages de cet appareil n'ont pas pu être lus : les notes sont fermées"]);
});
