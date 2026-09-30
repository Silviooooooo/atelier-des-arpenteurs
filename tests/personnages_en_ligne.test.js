// Contrôles des personnages en ligne, côté page (SPECIFICATION.md, § 15.8) :
// le dépôt par ticket, la lecture de l'index et des fichiers rangés, l'état
// de chaque dépôt sur l'appareil, la démonstration qui ne dépose rien. fetch
// est simulé : aucun réseau.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ADRESSE_DEPOT } from "../js/publication/github.js";
import { ATTENTE_MAX_MS, PHRASE_DEMO, PHRASE_SANS_CLE, PHRASE_VISIBLE, creerDepot } from "../js/personnage/depot.js";
import { chiffrerPersonnage, ecrireFichier, ecrireIndex, ecrireTicket, fichierDuTicket, lireTicket } from "../js/personnage/en_ligne.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { nouveauSecret } from "../js/securite/chiffrement.js";
import { personnageEssai } from "./outils/personnage_essai.js";

// Une clé de dépôt de la bonne forme, fabriquée ici : aucun jeton dans le dépôt.
const CLE = ["github", "pat", "x".repeat(24)].join("_");
const SECRET = await nouveauSecret("louche marmite passoire");
const AUTRE = await nouveauSecret("un autre mot de passe de table");
const MAINTENANT = new Date("2026-09-30T12:00:00.000Z");

const enregistre = (id = "Qx7-aZ_09bcdEFGHijklmn", modifier = null) =>
  personnageEssai((p) => {
    Object.assign(p, { id, mode: "reel", etat: "enregistre", etape: 9, enregistre_le: "2026-09-30T10:00:00.000Z", modifie_le: "2026-09-30T10:00:00.000Z" });
    if (modifier) modifier(p);
  });

// Un site simulé : la banque en place (son sel), l'API des tickets, les
// fichiers rangés. Chaque appel est noté.
function site({ sel = SECRET.sel, publieeLe = null, ticket = { status: 201, corps: { number: 12 } }, fichiers = null, index = undefined } = {}) {
  const appels = [];
  const reponse = (status, corps, texte = null) => ({ ok: status >= 200 && status < 300, status, json: async () => corps, text: async () => texte ?? JSON.stringify(corps) });
  const fetch = async (adresse, init = {}) => {
    appels.push({ adresse, init });
    if (adresse.startsWith("donnees/banque.chiffree.json?v=")) return reponse(200, { publiee_le: publieeLe, kdf: { sel } });
    if (adresse === `${ADRESSE_DEPOT}/issues`) {
      if (ticket === "reseau") throw new TypeError("Failed to fetch");
      return reponse(ticket.status, ticket.corps);
    }
    if (adresse.startsWith("personnages/index.json?v=")) {
      if (index === null) return reponse(404, {});
      if (index === "erreur") return reponse(503, {});
      return reponse(200, null, index ?? ecrireIndex(Object.values(fichiers ?? {})));
    }
    const trouve = /^personnages\/([A-Za-z0-9_-]+)\.chiffre\.json\?v=/.exec(adresse);
    if (trouve && fichiers?.[trouve[1]]) return reponse(200, null, typeof fichiers[trouve[1]] === "string" ? fichiers[trouve[1]] : ecrireFichier(fichiers[trouve[1]]));
    return reponse(404, {});
  };
  return { fetch, appels };
}

async function fichierEnLigne(personnage, secret = SECRET, rangeLe = "2026-09-30T11:00:00Z") {
  const { ticket } = lireTicket(ecrireTicket({ action: "creer", identifiant: personnage.id, date: "2026-09-30T10:59:00.000Z", personnage: await chiffrerPersonnage(personnage, secret) }).corps);
  return fichierDuTicket(ticket, { rangeLe, numero: 7 });
}

const depotDe = ({ mode = "reel", cle = CLE, secret = SECRET, publieeLe = null, etagere = creerEtagere(magasinPersonnagesMemoire(), mode), fetch, maintenant = () => MAINTENANT } = {}) => ({
  etagere,
  depot: creerDepot({ mode, banque: { ...(cle ? { cle_depot: cle } : {}), ...(publieeLe ? { publiee_le: publieeLe } : {}) }, secret, etagere, fetch, maintenant }),
});

test("en ligne — la démonstration ne dépose rien et ne lit rien en ligne, et le dit", async () => {
  const { fetch, appels } = site();
  const { depot, etagere } = depotDe({ mode: "demo", fetch });
  assert.equal(depot.disponible, false);
  assert.equal(depot.raison, PHRASE_DEMO);
  assert.equal(depot.phraseEnregistrement, PHRASE_DEMO);
  const personnage = enregistre("demo-aubepine-0000000001", (p) => (p.mode = "demo"));
  assert.deepEqual(await depot.envoyer(personnage), { envoye: false, erreur: PHRASE_DEMO });
  assert.deepEqual(await depot.lireEnLigne(), { personnages: [], ids: new Set(), illisibles: 0, ancienneCle: 0, cleChangee: 0 });
  assert.equal(appels.length, 0, "aucun réseau");
  assert.deepEqual(await etagere.listerNotes(), [], "aucune note : rien n'attend d'envoi");
});

test("en ligne — sans clé de dépôt dans la banque : le personnage reste sur l'appareil, « non envoyé », avec la raison", async () => {
  const { fetch, appels } = site();
  const { depot, etagere } = depotDe({ cle: null, fetch });
  assert.equal(depot.raison, PHRASE_SANS_CLE);
  assert.equal(depot.phraseEnregistrement, PHRASE_SANS_CLE);
  const resultat = await depot.envoyer(enregistre());
  assert.equal(resultat.envoye, false);
  assert.equal(appels.length, 0);
  const note = await etagere.lireNote("Qx7-aZ_09bcdEFGHijklmn");
  assert.deepEqual(note.depot, { etat: "non_envoye", action: "creer", ticket: null, date: MAINTENANT.toISOString(), erreur: PHRASE_SANS_CLE });
  // Une clé de forme fausse ne vaut pas mieux.
  assert.equal(depotDe({ cle: "ghp_court", fetch }).depot.disponible, false);
});

test("en ligne — déposer : un ticket « personnage » ouvert avec la clé de dépôt ; le corps chiffré, sans nom en clair ; la note « envoyé »", async () => {
  const { fetch, appels } = site();
  const { depot, etagere } = depotDe({ fetch });
  assert.equal(depot.disponible, true);
  assert.equal(depot.phraseEnregistrement, PHRASE_VISIBLE);
  const personnage = enregistre();
  assert.deepEqual(await depot.envoyer(personnage, { action: "remplacer" }), { envoye: true, ticket: 12 });
  // D'abord le sel de la banque en place, sans cache ; puis le ticket.
  assert.match(appels[0].adresse, /^donnees\/banque\.chiffree\.json\?v=\d+$/);
  assert.equal(appels[0].init.cache, "no-store");
  const { init } = appels[1];
  assert.equal(appels[1].adresse, `${ADRESSE_DEPOT}/issues`);
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, `Bearer ${CLE}`);
  assert.equal(init.headers["X-GitHub-Api-Version"], "2022-11-28");
  const envoye = JSON.parse(init.body);
  assert.deepEqual(Object.keys(envoye), ["title", "body"]);
  assert.equal(envoye.title, "personnage");
  assert.doesNotMatch(envoye.body, /Aubépine|Crèmebrûlée|Saucier|Marmiton/);
  const { ticket } = lireTicket(envoye.body);
  assert.deepEqual([ticket.action, ticket.identifiant, ticket.personnage.sel], ["remplacer", personnage.id, SECRET.sel]);
  assert.deepEqual((await etagere.lireNote(personnage.id)).depot, { etat: "envoye", action: "remplacer", ticket: 12, date: MAINTENANT.toISOString(), erreur: null });
  // La suppression : un ticket sans personnage.
  await depot.supprimer(personnage.id);
  const suppression = lireTicket(JSON.parse(appels.at(-1).init.body).body).ticket;
  assert.deepEqual([suppression.action, suppression.personnage], ["supprimer", undefined]);
});

test("en ligne — un dépôt refusé reste sur l'appareil, « non envoyé », avec la raison ; « Réessayer » le refait", async () => {
  const cas = [
    [{ status: 401, corps: {} }, /GitHub refuse la clé de dépôt \(révoquée ou expirée\)/],
    [{ status: 403, corps: {} }, /n'a pas la permission Issues/],
    [{ status: 404, corps: {} }, /n'a pas la permission Issues/],
    [{ status: 410, corps: {} }, /tickets sont fermés/],
    [{ status: 422, corps: {} }, /statut 422/],
    ["reseau", /Pas de réseau/],
  ];
  for (const [ticket, attendu] of cas) {
    const { fetch } = site({ ticket });
    const { depot, etagere } = depotDe({ fetch });
    const personnage = enregistre();
    await etagere.garder(personnage);
    const resultat = await depot.envoyer(personnage);
    assert.equal(resultat.envoye, false);
    assert.match(resultat.erreur, attendu);
    assert.equal((await etagere.lireNote(personnage.id)).depot.etat, "non_envoye");
  }
  // Réessayer, le réseau revenu.
  const echec = site({ ticket: "reseau" });
  const etagere = creerEtagere(magasinPersonnagesMemoire(), "reel");
  const personnage = enregistre();
  await etagere.garder(personnage);
  await depotDe({ fetch: echec.fetch, etagere }).depot.envoyer(personnage);
  const reprise = site();
  assert.deepEqual(await depotDe({ fetch: reprise.fetch, etagere }).depot.reessayer(personnage.id), { envoye: true, ticket: 12 });
  assert.equal((await etagere.lireNote(personnage.id)).depot.etat, "envoye");
});

test("en ligne — le mot de passe de table a changé depuis l'ouverture de la page : rien ne part sous l'ancienne clé", async () => {
  const { fetch, appels } = site({ sel: AUTRE.sel });
  const { depot } = depotDe({ fetch });
  const resultat = await depot.envoyer(enregistre());
  assert.equal(resultat.envoye, false);
  assert.match(resultat.erreur, /Le mot de passe de table a changé : rechargez la page/);
  assert.equal(appels.filter((a) => a.adresse.endsWith("/issues")).length, 0);
});

test("en ligne — lire : l'index sans cache, chaque fichier par sa version, déchiffré ; une ancienne clé et un fichier hostile comptés à part", async () => {
  const premier = enregistre("AAAAAAAAAAAAAAAAAAAAAA");
  const second = enregistre("BBBBBBBBBBBBBBBBBBBBBB", (p) => (p.identite.nom = "Bourrache"));
  const ancien = enregistre("CCCCCCCCCCCCCCCCCCCCCC");
  const fichiers = {
    AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(premier),
    BBBBBBBBBBBBBBBBBBBBBB: await fichierEnLigne(second),
    CCCCCCCCCCCCCCCCCCCCCC: await fichierEnLigne(ancien, AUTRE),
  };
  const hostile = await fichierEnLigne(enregistre("DDDDDDDDDDDDDDDDDDDDDD"));
  const { fetch, appels } = site({ fichiers: { ...fichiers, DDDDDDDDDDDDDDDDDDDDDD: hostile } });
  // Le fichier hostile est servi abîmé.
  const fetchAbime = async (adresse, init) => (adresse.startsWith("personnages/DDDD") ? { ok: true, status: 200, text: async () => '{"format":1}' } : fetch(adresse, init));
  const { depot } = depotDe({ fetch: fetchAbime });
  const lu = await depot.lireEnLigne();
  assert.deepEqual(lu.personnages.map((p) => p.identite.nom).sort(), ["Aubépine Crèmebrûlée", "Bourrache"]);
  assert.deepEqual([lu.illisibles, lu.ancienneCle, lu.cleChangee], [1, 1, 0]);
  assert.deepEqual([...lu.ids].sort(), ["AAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBB", "CCCCCCCCCCCCCCCCCCCCCC", "DDDDDDDDDDDDDDDDDDDDDD"]);
  const indexLu = appels.find((a) => a.adresse.startsWith("personnages/index.json"));
  assert.match(indexLu.adresse, /\?v=\d+$/);
  assert.equal(indexLu.init.cache, "no-store");
  assert.ok(appels.some((a) => a.adresse === `personnages/AAAAAAAAAAAAAAAAAAAAAA.chiffre.json?v=${JSON.parse(ecrireIndex([fichiers.AAAAAAAAAAAAAAAAAAAAAA])).personnages[0].version}`));
  // Une seconde lecture ne redemande pas un fichier de même version.
  const avant = appels.length;
  await depot.lireEnLigne();
  assert.equal(appels.filter((a, i) => i >= avant && a.adresse.startsWith("personnages/AAAA")).length, 0);
  assert.equal((await depot.lire("BBBBBBBBBBBBBBBBBBBBBB")).identite.nom, "Bourrache");
  // Sans index : aucun personnage ; un index hostile : un message.
  assert.deepEqual(await depotDe({ fetch: site({ index: null }).fetch }).depot.lireEnLigne(), { personnages: [], ids: new Set(), illisibles: 0, ancienneCle: 0, cleChangee: 0 });
  assert.match((await depotDe({ fetch: site({ index: '{"format":1,"personnages":[{"identifiant":"AAAAAAAAAAAAAAAAAAAAAA","nom":"x"}]}' }).fetch }).depot.lireEnLigne()).erreur, /index des personnages en ligne est illisible/);
});

test("en ligne — rapprocher : l'envoyé rattrapé quitte l'appareil, l'attente se dit, le retard propose « Réessayer », la suppression cache puis s'efface", async () => {
  const enLigne = enregistre("AAAAAAAAAAAAAAAAAAAAAA");
  const plusRecent = enregistre("BBBBBBBBBBBBBBBBBBBBBB", (p) => (p.modifie_le = "2026-09-30T11:30:00.000Z"));
  const supprime = enregistre("CCCCCCCCCCCCCCCCCCCCCC");
  const fichiers = {
    AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(enLigne),
    BBBBBBBBBBBBBBBBBBBBBB: await fichierEnLigne(enregistre("BBBBBBBBBBBBBBBBBBBBBB")),
    CCCCCCCCCCCCCCCCCCCCCC: await fichierEnLigne(supprime),
  };
  const etagere = creerEtagere(magasinPersonnagesMemoire(), "reel");
  const envoye = (date) => ({ depot: { etat: "envoye", action: "remplacer", ticket: 3, date, erreur: null } });
  // A : envoyé, et la version en ligne l'a rattrapé.
  await etagere.garder(enLigne);
  await etagere.garderNote(enLigne.id, envoye("2026-09-30T11:58:00.000Z"));
  // B : envoyé il y a deux minutes, plus récent que la version en ligne.
  await etagere.garder(plusRecent);
  await etagere.garderNote(plusRecent.id, envoye("2026-09-30T11:58:00.000Z"));
  // C : sa suppression est envoyée.
  await etagere.garderNote(supprime.id, { depot: { etat: "envoye", action: "supprimer", ticket: 4, date: "2026-09-30T11:59:00.000Z", erreur: null } });
  // Un brouillon.
  const brouillon = enregistre("DDDDDDDDDDDDDDDDDDDDDD", (p) => Object.assign(p, { etat: "brouillon" }));
  await etagere.garder(brouillon);

  const { fetch } = site({ fichiers });
  let vue = await depotDe({ fetch, etagere }).depot.rapprocher();
  assert.deepEqual(vue.enLigne.map((p) => p.id), ["AAAAAAAAAAAAAAAAAAAAAA"], "B se montre depuis l'appareil ; C est caché");
  assert.deepEqual(vue.attente.map((e) => e.personnage.id), ["BBBBBBBBBBBBBBBBBBBBBB"]);
  assert.deepEqual(vue.brouillons.map((e) => e.personnage.id), ["DDDDDDDDDDDDDDDDDDDDDD"]);
  assert.equal(await etagere.lire(enLigne.id), null, "A, rattrapé, quitte l'appareil");
  assert.equal(await etagere.lireNote(enLigne.id), null);

  // Quinze minutes plus tard, B n'est toujours pas en ligne : « Réessayer ».
  const plusTard = () => new Date(MAINTENANT.getTime() + ATTENTE_MAX_MS + 60_000);
  vue = await depotDe({ fetch, etagere, maintenant: plusTard }).depot.rapprocher();
  assert.deepEqual(vue.nonEnvoyes.map((e) => [e.personnage.id, Boolean(e.enRetard)]), [["BBBBBBBBBBBBBBBBBBBBBB", true], ["CCCCCCCCCCCCCCCCCCCCCC", true]]);

  // C quitte l'index : sa note s'efface.
  const sansC = site({ fichiers: { AAAAAAAAAAAAAAAAAAAAAA: fichiers.AAAAAAAAAAAAAAAAAAAAAA, BBBBBBBBBBBBBBBBBBBBBB: fichiers.BBBBBBBBBBBBBBBBBBBBBB } });
  await depotDe({ fetch: sansC.fetch, etagere }).depot.rapprocher();
  assert.equal(await etagere.lireNote(supprime.id), null);
});

// ─── La relecture du lot 2 bis ──────────────────────────────────────────────

test("relecture — juste après un changement fait d'ici, GitHub Pages en retard ne bloque pas le dépôt ; une page en retard, si", async () => {
  // La page tient la nouvelle clé (AUTRE) ; Pages sert encore l'ancienne banque.
  const enRetard = site({ sel: SECRET.sel, publieeLe: "2026-09-29T22:14:00+02:00" });
  const { depot } = depotDe({ secret: AUTRE, publieeLe: "2026-09-30T12:00:00+02:00", fetch: enRetard.fetch });
  assert.equal((await depot.envoyer(enregistre())).envoye, true);
  // La page tient l'ancienne clé ; le site sert une banque plus récente : rien ne part.
  const nouvelle = site({ sel: AUTRE.sel, publieeLe: "2026-09-30T13:00:00+02:00" });
  const retard = await depotDe({ publieeLe: "2026-09-30T12:00:00+02:00", fetch: nouvelle.fetch }).depot.envoyer(enregistre());
  assert.equal(retard.envoye, false);
  assert.match(retard.erreur, /Le mot de passe de table a changé : rechargez la page/);
  assert.equal(nouvelle.appels.filter((a) => a.adresse.endsWith("/issues")).length, 0);
});

test("relecture — un changement de mot de passe pendant la visite : la page le dit, au lieu d'accuser l'auteur", async () => {
  const x = enregistre("AAAAAAAAAAAAAAAAAAAAAA");
  // Les fichiers sont sous la nouvelle clé, celle de la banque en place ; la page a l'ancienne.
  const { fetch } = site({ sel: AUTRE.sel, fichiers: { AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(x, AUTRE) } });
  const { depot } = depotDe({ fetch });
  const lu = await depot.lireEnLigne();
  assert.deepEqual([lu.cleChangee, lu.ancienneCle, lu.personnages.length], [1, 0, 0]);
  assert.match((await depot.chercher(x.id)).erreur, /Le mot de passe de table a changé/);
  // Un fichier d'un sel qui n'est ni celui de la page ni celui de la banque en place : une ancienne clé.
  const ancien = site({ sel: SECRET.sel, fichiers: { AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(x, AUTRE) } });
  assert.deepEqual((await depotDe({ fetch: ancien.fetch }).depot.lireEnLigne()).ancienneCle, 1);
});

test("relecture — une suppression en attente ne s'efface pas quand l'index ne se lit pas, et se montre même illisible, avec son nom", async () => {
  const etagere = creerEtagere(magasinPersonnagesMemoire(), "reel");
  const x = enregistre("AAAAAAAAAAAAAAAAAAAAAA", (p) => (p.identite.nom = "Bourrache"));
  await etagere.garderNote(x.id, { nom: "Bourrache", depot: { etat: "non_envoye", action: "supprimer", ticket: null, date: "2026-09-30T11:00:00.000Z", erreur: "Pas de réseau" } });
  // L'index ne se lit pas : la note reste, et la carte se montre.
  let vue = await depotDe({ etagere, fetch: site({ index: "erreur" }).fetch }).depot.rapprocher();
  assert.ok(vue.erreur);
  assert.deepEqual(vue.nonEnvoyes.map((e) => [e.suppression, e.personnage, e.note.nom]), [[true, null, "Bourrache"]]);
  assert.ok(await etagere.lireNote(x.id));
  // L'index le porte, mais son fichier ne se lit pas (une autre clé) : toujours montrée.
  vue = await depotDe({ etagere, fetch: site({ fichiers: { AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(x, AUTRE) } }).fetch }).depot.rapprocher();
  assert.deepEqual(vue.nonEnvoyes.map((e) => e.note.nom), ["Bourrache"]);
  // L'index s'est lu et ne le porte plus : la suppression est faite, la note s'efface.
  await depotDe({ etagere, fetch: site({ fichiers: {} }).fetch }).depot.rapprocher();
  assert.equal(await etagere.lireNote(x.id), null);
});

test("relecture — une copie de l'appareil plus ancienne ne cache pas la version en ligne, et ne part pas sans qu'on le veuille ; identique, elle s'efface", async () => {
  const etagere = creerEtagere(magasinPersonnagesMemoire(), "reel");
  const v1 = enregistre("AAAAAAAAAAAAAAAAAAAAAA", (p) => (p.identite.age = "v1"));
  const v2 = enregistre("AAAAAAAAAAAAAAAAAAAAAA", (p) => Object.assign(p, { modifie_le: "2026-09-30T11:30:00.000Z", identite: { ...p.identite, age: "v2" } }));
  await etagere.garder(v1);
  const enLigne = site({ fichiers: { AAAAAAAAAAAAAAAAAAAAAA: await fichierEnLigne(v2) } });
  const { depot } = depotDe({ etagere, fetch: enLigne.fetch });
  const vue = await depot.rapprocher();
  assert.deepEqual(vue.enLigne.map((p) => p.identite.age), ["v2"], "la version en ligne se montre");
  assert.deepEqual(vue.nonEnvoyes.map((e) => [e.personnage.identite.age, e.plusAncienne]), [["v1", true]]);
  // L'envoi s'arrête : la version en ligne est plus récente.
  const arret = await depot.envoyer(v1);
  assert.deepEqual([arret.envoye, arret.plusAncienne], [false, true]);
  assert.equal(enLigne.appels.filter((a) => a.adresse.endsWith("/issues")).length, 0);
  // Expressément voulu, il part.
  assert.equal((await depot.envoyer(v1, { forcer: true })).envoye, true);
  // Une copie identique (même date) à la version en ligne quitte l'appareil.
  const autre = creerEtagere(magasinPersonnagesMemoire(), "reel");
  await autre.garder(v2);
  await depotDe({ etagere: autre, fetch: enLigne.fetch }).depot.rapprocher();
  assert.equal(await autre.lire(v2.id), null);
});

test("relecture — chercher un personnage en ligne distingue l'absent de l'illisible pour l'instant", async () => {
  assert.deepEqual(await depotDe({ fetch: site({ fichiers: {} }).fetch }).depot.chercher("AAAAAAAAAAAAAAAAAAAAAA"), { absent: true });
  assert.match((await depotDe({ fetch: site({ index: "erreur" }).fetch }).depot.chercher("AAAAAAAAAAAAAAAAAAAAAA")).erreur, /réponse 503/);
});
