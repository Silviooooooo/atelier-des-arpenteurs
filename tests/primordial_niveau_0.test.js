// Contrôles du primordial au niveau 0 et du format 3 (mission du lot 4.3,
// § 8.3 ; SPECIFICATION.md, § 15.1 et § 15.2).
//
// Règle de l'auteur (26/10/2026) : une capacité que le personnage ne tient
// que de son primordial, et qui peut évoluer, part au niveau 0 : offerte,
// non acquise ; une montée au niveau 1 l'acquiert, pour 1 point, comme une
// montée. Un personnage au format 2 se calcule converti en mémoire
// (versFormat3) et garde tout ce qu'il avait ; les écritures autres que le
// créateur gardent le format qu'elles ont lu.
//
// La banque vient du classeur d'essai, fictif ; les cas qu'il n'a pas (une
// capacité à seule variante 1, une capacité à la fois de l'espèce et du
// primordial) se fabriquent en mémoire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { photographierPersonnage } from "../js/combat/photographie.js";
import { tableDesRoles } from "../js/combat/roles.js";
import { feuilles } from "../js/fiche/feuilles.js";
import { lecture } from "../js/fiche/lecture.js";
import { calculerFiche, descriptionA, indexerCreation, versFormat3 } from "../js/personnage/calcul.js";
import { chiffrerPersonnage, dechiffrerPersonnage } from "../js/personnage/en_ligne.js";
import { FORMAT, accepter, codeDuLien, ecrirePersonnage, lireCode, lirePersonnage, migrer, nouveauPersonnage, verifier } from "../js/personnage/format.js";
import { manques, niveauxPermis } from "../js/personnage/parcours.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { nouveauSecret } from "../js/securite/chiffrement.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { DATE_ESSAI, personnageEssai } from "./outils/personnage_essai.js";

const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("../essais/classeur_essai.xlsx", import.meta.url)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T22:34:07+02:00" };
const INDEX = indexerCreation(BANQUE);
const ficheDe = (personnage, banque = BANQUE) => calculerFiche(banque, personnage, banque === BANQUE ? { index: INDEX } : {});
const capacite = (f, nom) => f.capacites.find((c) => c.nom === nom) ?? null;
const noms = (liste) => liste.map((c) => c.nom);
const montees = (p) => p.niveaux.map((m) => `${m.capacite} ${m.niveau}`);

// Aubépine telle qu'elle était au format 2 : Fournaise reçue au niveau 1,
// sans montée.
const auFormat2 = (modifier = null) =>
  personnageEssai((p) => {
    p.format = 2;
    p.niveaux = p.niveaux.filter((m) => m.capacite !== "Fournaise");
    modifier?.(p);
  });
// Un personnage neuf, au format 3 : Aubépine sans montée.
const neuve = (modifier = null) =>
  personnageEssai((p) => {
    p.niveaux = [];
    modifier?.(p);
  });

// Une copie de la banque, retouchée en mémoire.
function retouchee(retoucher) {
  const banque = structuredClone(BANQUE);
  retoucher(banque);
  return banque;
}
const blocDe = (banque, nom) => banque.blocs.find((b) => b.nom === nom);
const variante = (puissance, description) => ({ puissance, cout_souffle: "1", cout_lien: "1", elements: [], description, notes: "" });

function avecDom(fn) {
  const retirer = installerDom();
  try {
    return fn();
  } finally {
    retirer();
  }
}

test("format 3 — FORMAT vaut 3 ; un personnage neuf y naît ; migrer écrit le format 2", () => {
  assert.equal(FORMAT, 3);
  assert.equal(nouveauPersonnage("demo").format, 3);
  assert.equal(personnageEssai().format, 3);
  assert.deepEqual(montees(personnageEssai()), ["Flambage 2", "Fournaise 1"], "le personnage d'essai acquiert Fournaise au niveau 1");
  const { equipement, constellation, niveaux, ...reste } = auFormat2();
  const ancien = {
    ...reste,
    format: 1,
    niveaux,
    constellation: { nom: constellation.nom, choix: [], obtention: "tirage" },
    equipement: equipement.map(({ place, ...o }) => ({ ...o, porte: place === "equipe" && o.nom !== "Couvercle de marmite" })),
    arme_principale: 0,
    bouclier: 7,
  };
  assert.equal(migrer(ancien).format, 2);
});

test("verifier — aux formats 1, 2, 3 et 4 : le 1 passe par migrer ; une montée de 2 à 3 au format 2, de 1 à 3 au format 3 ; le 4 fait recharger la page", () => {
  const refus = (p) => {
    try {
      verifier(p);
      return null;
    } catch (erreur) {
      return erreur.message;
    }
  };
  // Format 1 : verifier seul le refuse ; accepter le convertit (migrer), au format 2.
  const premier = personnageEssai((p) => (p.format = 1));
  assert.match(refus(premier), /format inconnu/);
  // Format 2 : une montée vaut de 2 à 3.
  assert.equal(refus(auFormat2()), null);
  assert.equal(refus(auFormat2((p) => p.niveaux.push({ capacite: "Fournaise", niveau: 2 }))), null);
  assert.match(refus(auFormat2((p) => p.niveaux.push({ capacite: "Fournaise", niveau: 1 }))), /La montée 2, niveau doit être un entier de 2 à 3\./);
  // Format 3 : de 1 à 3.
  assert.equal(refus(personnageEssai()), null);
  assert.equal(refus(neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 3 }]))), null);
  assert.match(refus(neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 0 }]))), /La montée 1, niveau doit être un entier de 1 à 3\./);
  assert.match(refus(neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 4 }]))), /La montée 1, niveau doit être un entier de 1 à 3\./);
  // Format 4 : d'une version plus récente.
  assert.match(refus(personnageEssai((p) => (p.format = 4))), /version plus récente de l'Atelier : rechargez la page/);
  assert.match(lirePersonnage(JSON.stringify(personnageEssai((p) => (p.format = 4))), { mode: "demo" }).erreur, /rechargez la page/);
});

test("format 2 — calculé converti en mémoire : il garde ses capacités, leurs niveaux, ses points dépensés et son reliquat ; seuls ses points reçus baissent", () => {
  const deux = auFormat2();
  const intact = JSON.stringify(deux);
  const f2 = ficheDe(deux);
  assert.equal(JSON.stringify(deux), intact, "rien ne s'écrit dans le personnage");
  const f3 = ficheDe(personnageEssai());
  assert.deepEqual(
    f2.capacites.map((c) => `${c.nom} ${c.niveau}`),
    f3.capacites.map((c) => `${c.nom} ${c.niveau}`),
  );
  assert.equal(capacite(f2, "Fournaise").niveau, 1);
  assert.deepEqual(noms(f2.offertes), []);
  assert.deepEqual([f2.points.depenses, f2.points.reliquat, f2.points.recus], [10, 0, 7], "8 reçus au format 2 : un de moins, celui de Fournaise");
  assert.deepEqual(noms(f2.liens[0].pouvoirs), ["Fournaise", "Cendre"]);
  assert.equal(f2.liens[0].points, 1);
  assert.deepEqual(f2.avertissements, f3.avertissements);
});

test("versFormat3 — pure : une montée au niveau 1 pour chaque capacité du seul primordial qui évolue et n'en a pas ; tout autre format rendu tel quel", () => {
  const deux = auFormat2();
  const intact = JSON.stringify(deux);
  const converti = versFormat3(deux, INDEX);
  assert.equal(JSON.stringify(deux), intact, "le personnage reçu ne change pas");
  assert.ok(converti !== deux && converti.niveaux !== deux.niveaux, "un autre objet");
  assert.equal(converti.format, 3);
  assert.deepEqual(montees(converti), ["Flambage 2", "Fournaise 1"]);
  assert.equal(verifier(converti).format, 3);
  // Le format 3 et tout autre format : tels quels.
  const trois = personnageEssai();
  assert.ok(versFormat3(trois, INDEX) === trois);
  const premier = { format: 1 };
  assert.ok(versFormat3(premier, INDEX) === premier);
  // Une montée appliquée au format 2 se garde, sans autre ; Cendre (puissance
  // 0) n'en reçoit pas ; Braise (N), du seul Grand Four, en reçoit une.
  assert.deepEqual(montees(versFormat3(auFormat2((p) => p.niveaux.push({ capacite: "Fournaise", niveau: 3 })), INDEX)), ["Flambage 2", "Fournaise 3"]);
  assert.deepEqual(montees(versFormat3(auFormat2((p) => (p.primordial.choix = ["Braise"])), INDEX)), ["Flambage 2", "Fournaise 1", "Braise 1"]);
  // Une capacité qui vient aussi d'ailleurs n'en reçoit pas.
  const banque = retouchee((b) => blocDe(b, "Marmiton").capacites.push({ forme: "simple", nom: "Fournaise" }));
  assert.deepEqual(montees(versFormat3(auFormat2(), indexerCreation(banque))), ["Flambage 2"]);
  // Une montée que le format 2 n'appliquait pas (au-delà du maximum) laisse
  // la capacité au niveau 1 : la conversion le garde, et le calcul le dit encore.
  const borne = retouchee((b) => (b.capacites.find((c) => c.nom === "Fournaise").variantes = [variante("1", "Réchauffe la case."), variante("2", "Brûle.")]));
  const deBorne = auFormat2((p) => p.niveaux.push({ capacite: "Fournaise", niveau: 3 }));
  assert.deepEqual(montees(versFormat3(deBorne, indexerCreation(borne))), ["Flambage 2", "Fournaise 3", "Fournaise 1"]);
  const f = ficheDe(deBorne, borne);
  assert.equal(capacite(f, "Fournaise").niveau, 1);
  assert.ok(f.avertissements.some((a) => a.texte === "« Fournaise » ne peut pas être au niveau 3."));
});

test("format 1 — passe par migrer (1 → 2), puis par la conversion : Fournaise au niveau 1, les mêmes points dépensés", () => {
  const { equipement, constellation, niveaux, ...reste } = auFormat2();
  const ancien = {
    ...reste,
    format: 1,
    niveaux,
    constellation: { nom: constellation.nom, choix: [], obtention: "tirage" },
    equipement: equipement.map(({ place, ...o }) => ({ ...o, porte: place === "equipe" && o.nom !== "Couvercle de marmite" })),
    arme_principale: 0,
    bouclier: 7,
  };
  const lu = accepter(ancien);
  assert.equal(lu.format, 2);
  const f = ficheDe(lu);
  assert.equal(capacite(f, "Fournaise").niveau, 1);
  assert.deepEqual([f.points.depenses, f.points.reliquat], [10, 0]);
});

test("format 2 — les autres écritures gardent le format lu : le fichier, le lien, le dépôt en ligne, la qualité des objets", async () => {
  const deux = auFormat2();
  assert.equal(JSON.parse(ecrirePersonnage(deux)).format, 2);
  assert.equal(lirePersonnage(ecrirePersonnage(deux), { mode: "demo" }).personnage.format, 2);
  assert.equal((await lireCode(await codeDuLien(deux), { mode: "demo" })).personnage.format, 2);
  // En ligne : une clé de table fabriquée ici.
  const reel = auFormat2((p) => Object.assign(p, { mode: "reel", etat: "enregistre", etape: 9, enregistre_le: DATE_ESSAI.toISOString() }));
  const secret = await nouveauSecret("passoire écumoire louche");
  const chiffre = await chiffrerPersonnage(reel, secret);
  assert.equal(chiffre.erreur, undefined, chiffre.erreur);
  const ouvert = await dechiffrerPersonnage({ identifiant: reel.id, ...chiffre }, secret);
  assert.equal(ouvert.erreur, undefined, ouvert.erreur);
  assert.equal(ouvert.personnage.format, 2);
  assert.deepEqual(montees(ouvert.personnage), ["Flambage 2"]);
  // La qualité des objets, changée sur l'écran de la fiche : gardée au format 2.
  const retirer = installerDom();
  try {
    const fichePersonnage = await import("../js/ecrans/fiche_personnage.js");
    const etagere = creerEtagere(magasinPersonnagesMemoire(), "demo");
    await etagere.garder(deux);
    const contexte = { etat: { mode: "demo", banque: BANQUE, etagere, chargement: { enveloppe: { empreinte: "x" } } }, naviguer() {}, afficher() {} };
    const ecran = fichePersonnage.afficher(contexte, { ecran: "personnage", id: deux.id });
    document.body.replaceChildren(ecran);
    await laisserFiler(20);
    ecran.querySelector("#qualite-1").value = "3";
    await Promise.all([...ecran.querySelectorAll("button")].find((b) => texteDe(b) === "Enregistrer les qualités").click());
    await laisserFiler(20);
    const garde = await etagere.lire(deux.id);
    assert.equal(garde.equipement[1].qualite, "3");
    assert.equal(garde.format, 2);
    assert.deepEqual(montees(garde), ["Flambage 2"]);
  } finally {
    retirer();
  }
});

test("personnage neuf — Fournaise offerte au niveau 0 : ni dans capacites, ni sur la fiche, ni dans la vue lecture, ni dans la photographie du combat", async () => {
  const personnage = neuve();
  const f = ficheDe(personnage);
  assert.equal(capacite(f, "Fournaise"), null);
  assert.deepEqual(noms(f.offertes), ["Fournaise"]);
  const [offerte] = f.offertes;
  assert.deepEqual(Object.keys(offerte), ["nom", "origines", "role", "groupe", "niveau", "niveauCreation", "niveauMax", "peutEvoluer", "cout", "texte"]);
  assert.deepEqual([offerte.origines, offerte.role, offerte.groupe, offerte.niveau, offerte.niveauCreation, offerte.niveauMax, offerte.peutEvoluer], [["Grand Four"], "primordial", "primordial", 0, 0, 3, true]);
  // Son coût et sa description au niveau 1, comme descriptionA les donne.
  const auNiveau1 = descriptionA(INDEX, personnage, "Fournaise", { bloc: "Grand Four", niveau: 1 });
  assert.deepEqual(offerte.cout, auNiveau1.cout);
  assert.equal(offerte.texte, auNiveau1.texte);
  assert.deepEqual([offerte.cout.souffle, offerte.cout.lien, offerte.texte], ["1", "1", "Réchauffe la case."]);
  // Ni dans les liens, ni dans leurs points.
  assert.deepEqual(noms(f.liens[0].pouvoirs), ["Cendre"]);
  assert.equal(f.liens[0].points, 0);
  avecDom(() => {
    assert.ok(!texteDe(feuilles(f)).includes("Fournaise"), "la fiche imprimée");
    assert.ok(!texteDe(lecture(f)).includes("Fournaise"), "la vue lecture");
  });
  const roles = await tableDesRoles(BANQUE, "demo");
  const { photo, refus } = photographierPersonnage(BANQUE, personnage, { index: INDEX, roles });
  assert.equal(refus, undefined, refus);
  assert.ok(!photo.valeurs.capacites.some((c) => c.nom === "Fournaise"), "la photographie du combat");
  // Acquise, elle y est, au niveau 1.
  const acquise = photographierPersonnage(BANQUE, personnageEssai(), { index: INDEX, roles });
  assert.equal(acquise.refus, undefined, acquise.refus);
  assert.equal(acquise.photo.valeurs.capacites.find((c) => c.nom === "Fournaise")?.niveau, 1);
});

test("personnage neuf — Fournaise acquise au niveau 1 (1 point), au niveau 2 (3 points), puis revenue à 0 ; les points et le reliquat", () => {
  const sans = ficheDe(neuve());
  assert.deepEqual([sans.points.depenses, sans.points.recus, sans.points.reliquat], [7, 7, 3]);
  const un = ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 1 }])));
  const fournaise = capacite(un, "Fournaise");
  assert.deepEqual(
    [fournaise.niveau, fournaise.niveauCreation, fournaise.niveauMax, fournaise.peutEvoluer, fournaise.role, fournaise.groupe, fournaise.aVenir],
    [1, 0, 3, true, "primordial", "primordial", false],
  );
  assert.deepEqual(noms(un.offertes), []);
  assert.deepEqual([un.points.depenses, un.points.recus, un.points.reliquat], [8, 7, 2], "1 point dépensé, aucun reçu");
  assert.deepEqual(noms(un.liens[0].pouvoirs), ["Fournaise", "Cendre"]);
  assert.equal(un.liens[0].points, 1);
  // Elle va du niveau 0 à 2 dans les 10 points (7 sans elle : 7 + 6 > 10).
  assert.deepEqual(niveauxPermis(un, fournaise), [0, 1, 2]);
  assert.deepEqual(niveauxPermis(sans, sans.offertes[0]), [0, 1, 2], "l'offerte aussi, du niveau 0");
  const deux = ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 2 }])));
  assert.deepEqual([capacite(deux, "Fournaise").niveau, deux.points.depenses, deux.points.recus, deux.points.reliquat], [2, 10, 7, 0]);
  assert.deepEqual(capacite(deux, "Fournaise").cout, { souffle: "3", lien: "1" });
  // Revenue à 0 : sa montée disparaît, elle est de nouveau offerte.
  const zero = ficheDe(neuve());
  assert.deepEqual([noms(zero.offertes), capacite(zero, "Fournaise"), zero.points.depenses], [["Fournaise"], null, 7]);
  // Au-delà des 10 points : une montée comme une autre.
  const trop = neuve((p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 3 }]));
  assert.deepEqual([ficheDe(trop).points.depenses, ficheDe(trop).points.depasse], [13, true]);
  assert.deepEqual(manques(BANQUE, trop, { index: INDEX })[8], ["Les montées portent les points de capacité à 13 : 10 au plus."]);
  // Une montée au niveau 1 ne vaut que pour une capacité au niveau 0.
  const flambage = ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Flambage", niveau: 1 }])));
  assert.ok(flambage.avertissements.some((a) => a.texte === "« Flambage » ne peut pas être au niveau 1."));
});

test("primordial — une capacité qui vient aussi de l'espèce, ou d'un objet, se reçoit comme avant ; Cendre (puissance 0) au niveau 0 ; une capacité à venir reste à venir", () => {
  // Fournaise, aussi de l'espèce : reçue au niveau 1, ses points reçus.
  const espece = retouchee((b) => blocDe(b, "Marmiton").capacites.push({ forme: "simple", nom: "Fournaise" }));
  const f = ficheDe(neuve(), espece);
  const fournaise = capacite(f, "Fournaise");
  assert.deepEqual([fournaise.niveau, fournaise.niveauCreation, fournaise.role, fournaise.origines], [1, 1, "espece", ["Marmiton", "Grand Four"]]);
  assert.deepEqual([noms(f.offertes), f.points.recus], [[], 8]);
  // Braise, aussi d'un objet (la spatule) : reçue.
  const objet = retouchee((b) => blocDe(b, "Spatule souple").capacites.push({ forme: "simple", nom: "Braise" }));
  const g = ficheDe(neuve((p) => {
    p.primordial.choix = ["Braise"];
    p.equipement.push({ nom: "Spatule souple", choix: [], qualite: null, place: "sac" });
  }), objet);
  assert.deepEqual([capacite(g, "Braise")?.niveau, noms(g.offertes)], [1, ["Fournaise"]]);
  // Cendre : puissance fixée à 0, reçue au niveau 0, sans coût ni montée.
  const cendre = capacite(ficheDe(neuve()), "Cendre");
  assert.deepEqual([cendre.niveau, cendre.niveauCreation, cendre.niveauMax, cendre.peutEvoluer], [0, 0, 0, false]);
  assert.ok(ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Cendre", niveau: 1 }]))).avertissements.some((a) => a.texte === "« Cendre » ne peut pas être au niveau 1."));
  // Une capacité absente de la feuille Capacites : à venir, ni offerte ni acquise.
  const aVenir = retouchee((b) => blocDe(b, "Grand Four").capacites.push({ forme: "simple", nom: "Flamme future" }));
  const h = ficheDe(neuve(), aVenir);
  assert.deepEqual([capacite(h, "Flamme future")?.aVenir, noms(h.offertes)], [true, ["Fournaise"]]);
});

test("primordial — une capacité à seule variante 1 : offerte, son « + » jusqu'au niveau 1, puis acquise ; jamais au niveau 2", () => {
  const banque = retouchee((b) => {
    b.capacites.push({ nom: "Étincelle", variantes: [variante("1", "Allume une flamme.")] });
    blocDe(b, "Grand Four").capacites.push({ forme: "simple", nom: "Étincelle" });
  });
  const f = ficheDe(neuve(), banque);
  const offerte = f.offertes.find((o) => o.nom === "Étincelle");
  assert.deepEqual([offerte?.niveau, offerte?.niveauMax, offerte?.peutEvoluer, offerte?.texte], [0, 1, true, "Allume une flamme."]);
  assert.deepEqual(niveauxPermis(f, offerte), [0, 1]);
  const acquise = ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Étincelle", niveau: 1 }])), banque);
  const etincelle = capacite(acquise, "Étincelle");
  assert.deepEqual([etincelle.niveau, etincelle.niveauCreation, etincelle.niveauMax, etincelle.peutEvoluer], [1, 0, 1, true]);
  assert.deepEqual(niveauxPermis(acquise, etincelle), [0, 1]);
  assert.equal(acquise.points.depenses, f.points.depenses + 1);
  assert.ok(ficheDe(neuve((p) => (p.niveaux = [{ capacite: "Étincelle", niveau: 2 }])), banque).avertissements.some((a) => a.texte === "« Étincelle » ne peut pas être au niveau 2."));
});

test("« à venir » — une capacité offerte compte comme présente : ni primordial.aVenir ni l'avertissement ; la vue lecture dit « Aucune capacité acquise. »", () => {
  // Braise au lieu de Cendre : Fournaise et Braise offertes, aucune acquise.
  const f = ficheDe(neuve((p) => (p.primordial.choix = ["Braise"])));
  assert.deepEqual([noms(f.offertes), f.liens[0].pouvoirs.length, f.primordial.aVenir], [["Fournaise", "Braise"], 0, false]);
  assert.deepEqual(f.avertissements.filter((a) => a.genre === "a_venir").map((a) => a.texte), ["« Constellation du Sablier » : capacités à venir."]);
  avecDom(() => {
    const vue = lecture(f);
    assert.ok(texteDe(vue).includes("Aucune capacité acquise."));
    assert.ok(!texteDe(vue).includes("Capacités à venir."));
  });
  // Un primordial sans aucune capacité : toujours « Capacités à venir. ».
  const givre = ficheDe(neuve((p) => (p.primordial = { nom: "Givre éternel", choix: [] })));
  assert.deepEqual([noms(givre.offertes), givre.primordial.aVenir], [[], true]);
  assert.ok(givre.avertissements.some((a) => a.texte === "« Givre éternel » : capacités à venir."));
  avecDom(() => {
    const vue = lecture(givre);
    assert.ok(texteDe(vue).includes("Capacités à venir."));
    assert.ok(!texteDe(vue).includes("Aucune capacité acquise."));
  });
});
