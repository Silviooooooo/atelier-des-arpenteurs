// Contrôles de la mise en place d'un combat et de ses dés (SPECIFICATION.md,
// § 17 et § 11, domaine « Combat ») : les ajouts, les plafonds et leurs
// raisons, la pose d'office, « Retirer », « Lancer le combat »
// (js/combat/preparation.js) ; la source de dés de l'écran, sans biais
// (js/combat/des.js) ; et la source de dés imposés des contrôles de l'écran
// (tests/outils/des_imposes.js).
//
// Chaque règle est vue des deux côtés : le douzième personnage s'ajoute, le
// treizième non ; soixante adversaires passent, soixante et un non, et alors
// aucun ne s'ajoute.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceAleatoire } from "../js/combat/des.js";
import { nommer } from "../js/combat/noms.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide, peutLancer, poser, reglerQuiCommence, retirer } from "../js/combat/preparation.js";
import { IDENTIFIANTS_MAX, PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES, PLAFOND_PJ } from "../js/combat/regles.js";
import * as rencontre from "../js/ecrans/rencontre.js";
import { desImposes } from "./outils/des_imposes.js";
import { adversaireEssai, aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// Un personnage d'essai de plus : un autre personnage (son identifiant), et
// un autre nom.
const pj = (rang) =>
  pjEssai((valeurs) => {
    valeurs.identifiant = `essai-personnage-${rang}`;
    valeurs.nom = `Commis ${rang}`;
  });

// Un adversaire d'essai sous un autre nom : un autre adversaire, non un
// exemplaire de plus.
const adversaire = (nom) =>
  adversaireEssai((valeurs) => {
    valeurs.nom = nom;
  });

const plusieurs = (photo, nombre) => Array.from({ length: nombre }, () => photo);

function ajouterTous(mep, photos) {
  const rendu = ajouterAdversaires(mep, photos);
  assert.equal(rendu.refus, undefined, rendu.refus);
  return rendu.miseEnPlace;
}

function ajouterPj(mep, photo) {
  const rendu = ajouterPersonnage(mep, photo);
  assert.equal(rendu.refus, undefined, rendu.refus);
  return rendu.miseEnPlace;
}

const cases = (mep) => Object.fromEntries(mep.protagonistes.map((protagoniste) => [protagoniste.id, protagoniste.case]));

const nomsCourts = (mep) => {
  const noms = nommer(mep.protagonistes.map(({ id, camp, photo }) => ({ id, camp, nom: photo.valeurs.nom })));
  return Object.fromEntries(Object.entries(noms).map(([id, nom]) => [id, nom.court]));
};

function estGeleEnProfondeur(valeur) {
  if (valeur === null || typeof valeur !== "object") return true;
  return Object.isFrozen(valeur) && Object.values(valeur).every(estGeleEnProfondeur);
}

// ─── La mise en place vide ──────────────────────────────────────────────────

test("miseEnPlaceVide : personne, les PJ commencent, le compteur à zéro", () => {
  assert.deepEqual(miseEnPlaceVide("demo"), { mode: "demo", quiCommence: "pj", compteur: 0, protagonistes: [] });
  assert.equal(miseEnPlaceVide("reel").mode, "reel");
  assert.ok(estGeleEnProfondeur(miseEnPlaceVide("demo")));
});

// ─── Les ajouts ─────────────────────────────────────────────────────────────

test("ajouterPersonnage : le personnage reçoit son identifiant, se pose en A1, et sa photographie est gardée telle quelle", () => {
  const photo = aubepineEssai();
  const vide = miseEnPlaceVide("demo");
  const rendu = ajouterPersonnage(vide, photo);
  assert.deepEqual(Object.keys(rendu), ["miseEnPlace", "id"]);
  assert.equal(rendu.id, "pj1");
  assert.deepEqual(rendu.miseEnPlace, { mode: "demo", quiCommence: "pj", compteur: 1, protagonistes: [{ id: "pj1", camp: "pj", case: "A1", photo }] });
  assert.equal(rendu.miseEnPlace.protagonistes[0].photo, photo, "par référence");
  assert.deepEqual(Object.keys(rendu.miseEnPlace.protagonistes[0]), ["id", "camp", "case", "photo"]);
  assert.deepEqual(vide.protagonistes, [], "la mise en place reçue ne change pas");
  assert.ok(estGeleEnProfondeur(rendu.miseEnPlace));
});

test("ajouterAdversaires : une photographie par exemplaire, un identifiant chacun, dans l'ordre donné", () => {
  const chef = chefDePartieEssai();
  const marmiton = marmitonDeCorveeEssai();
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  const rendu = ajouterAdversaires(depart, [chef, marmiton, marmiton]);
  assert.deepEqual(Object.keys(rendu), ["miseEnPlace", "ids"]);
  assert.deepEqual(rendu.ids, ["adv2", "adv3", "adv4"], "un seul compteur pour les deux camps");
  assert.equal(rendu.miseEnPlace.compteur, 4);
  assert.deepEqual(rendu.miseEnPlace.protagonistes.map(({ id, camp }) => [id, camp]), [["pj1", "pj"], ["adv2", "adv"], ["adv3", "adv"], ["adv4", "adv"]]);
  assert.equal(rendu.miseEnPlace.protagonistes[1].photo, chef);
  assert.equal(rendu.miseEnPlace.protagonistes[3].photo, marmiton);
  assert.ok(estGeleEnProfondeur(rendu.miseEnPlace));
});

test("la mise en place faite par les ajouts est celle qu'écrivent à la main les photographies d'essai", () => {
  const aubepine = aubepineEssai();
  const chef = chefDePartieEssai();
  const marmiton = marmitonDeCorveeEssai();
  const faite = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepine), [chef, marmiton, marmiton]);
  const ecrite = miseEnPlaceEssai([{ photo: aubepine, case: "A1" }, { photo: chef, case: "J1" }, { photo: marmiton, case: "J2" }, { photo: marmiton, case: "J2" }]);
  assert.deepEqual(faite, ecrite);
});

test("un ajout ne passe pas d'un camp à l'autre", () => {
  const vide = miseEnPlaceVide("demo");
  assert.deepEqual(ajouterPersonnage(vide, chefDePartieEssai()), { refus: "Ce n'est pas un personnage." });
  assert.deepEqual(ajouterAdversaires(vide, [aubepineEssai()]), { refus: "Ce n'est pas un adversaire." });
  assert.deepEqual(ajouterAdversaires(vide, [chefDePartieEssai(), aubepineEssai()]), { refus: "Ce n'est pas un adversaire." }, "un seul intrus refuse tout");
  assert.deepEqual(ajouterPersonnage(vide, null), { refus: "Ce n'est pas un personnage." });
  assert.deepEqual(ajouterAdversaires(vide, chefDePartieEssai()), { refus: "Ce n'est pas un adversaire." }, "une liste, non une photographie");
});

test("ce qui ne porte pas de valeurs n'est pas une photographie : l'ajout est refusé, sans lever", () => {
  const vide = miseEnPlaceVide("demo");
  for (const valeurs of [undefined, null, "Aubépine", 3]) {
    assert.deepEqual(ajouterPersonnage(vide, { camp: "pj", valeurs }), { refus: "Ce n'est pas un personnage." }, String(valeurs));
    assert.deepEqual(ajouterAdversaires(vide, [{ camp: "adv", valeurs }]), { refus: "Ce n'est pas un adversaire." }, String(valeurs));
    assert.deepEqual(ajouterAdversaires(vide, [chefDePartieEssai(), { camp: "adv", valeurs }]), { refus: "Ce n'est pas un adversaire." }, String(valeurs));
  }
  for (const photo of [undefined, "pj", 3, []]) {
    assert.deepEqual(ajouterPersonnage(vide, photo), { refus: "Ce n'est pas un personnage." });
    assert.deepEqual(ajouterAdversaires(vide, [photo]), { refus: "Ce n'est pas un adversaire." });
  }
});

test("ajouterAdversaires : une liste vide n'ajoute rien, sans refus", () => {
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  const rendu = ajouterAdversaires(depart, []);
  assert.deepEqual(rendu.ids, []);
  assert.deepEqual(rendu.miseEnPlace, depart);
});

// ─── Un PJ ne s'ajoute qu'une fois ──────────────────────────────────────────

test("un PJ ne s'ajoute qu'une fois", () => {
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  // Une autre photographie du même personnage : c'est l'identifiant du
  // personnage qui compte, non l'objet.
  assert.deepEqual(ajouterPersonnage(depart, aubepineEssai()), { refus: "Ce personnage est déjà dans le combat." });
  assert.equal(depart.protagonistes.length, 1);
});

test("deux personnages de même nom sont deux personnages : ils s'ajoutent tous les deux", () => {
  const jumelle = aubepineEssai((valeurs) => {
    valeurs.identifiant = "essai-jumelle";
  });
  assert.equal(jumelle.valeurs.nom, aubepineEssai().valeurs.nom);
  const rendu = ajouterPersonnage(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), jumelle);
  assert.equal(rendu.id, "pj2");
  assert.equal(rendu.miseEnPlace.protagonistes.length, 2);
});

test("un personnage retiré peut revenir, sous un identifiant neuf", () => {
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  const sans = retirer(depart, "pj1").miseEnPlace;
  const rendu = ajouterPersonnage(sans, aubepineEssai());
  assert.equal(rendu.id, "pj2");
});

// ─── Les plafonds ───────────────────────────────────────────────────────────

test("les plafonds du combat sont ceux de l'écran Rencontre", () => {
  assert.equal(PLAFOND_PJ, 12);
  assert.equal(PLAFOND_ADVERSAIRES, 60);
  assert.equal(PLAFOND_EXEMPLAIRES, 12);
  assert.equal(PLAFOND_EXEMPLAIRES, rencontre.PLAFOND_EXEMPLAIRES);
  assert.equal(PLAFOND_ADVERSAIRES, rencontre.PLAFOND_CARTES);
});

test("douze personnages au plus : le douzième s'ajoute, le treizième non", () => {
  let mep = miseEnPlaceVide("demo");
  for (let rang = 1; rang <= 11; rang += 1) mep = ajouterPj(mep, pj(rang));
  const douzieme = ajouterPersonnage(mep, pj(12));
  assert.equal(douzieme.id, "pj12");
  assert.deepEqual(ajouterPersonnage(douzieme.miseEnPlace, pj(13)), { refus: "12 personnages au plus dans un combat." });
  assert.equal(douzieme.miseEnPlace.protagonistes.length, 12);
});

test("les adversaires ne comptent pas dans le plafond des personnages, ni l'inverse", () => {
  let mep = ajouterTous(miseEnPlaceVide("demo"), plusieurs(marmitonDeCorveeEssai(), 12));
  for (let rang = 1; rang <= 12; rang += 1) mep = ajouterPj(mep, pj(rang));
  assert.equal(mep.protagonistes.length, 24);
  assert.equal(ajouterAdversaires(mep, plusieurs(chefDePartieEssai(), 12)).ids.length, 12);

  // Relecture de fin de groupe (lot 4) : vingt-quatre adversaires et douze
  // personnages restent sous soixante, de quelque façon qu'on les compte. Le
  // combat plein que permet la mission, lui, ne passe que si chaque plafond
  // ne compte que son camp : douze personnages, puis soixante adversaires.
  let plein = miseEnPlaceVide("demo");
  for (let rang = 1; rang <= 12; rang += 1) plein = ajouterPj(plein, pj(rang));
  const cinq = ["Commis", "Plongeur", "Saucier", "Rôtisseur", "Garde-manger"].map(adversaire);
  const soixante = ajouterAdversaires(plein, cinq.flatMap((photo) => plusieurs(photo, 12)));
  assert.equal(soixante.refus, undefined, soixante.refus);
  assert.equal(soixante.ids.length, 60);
  assert.equal(soixante.miseEnPlace.protagonistes.length, 72);
  // Chaque plafond tient encore, dans son camp.
  assert.deepEqual(ajouterAdversaires(soixante.miseEnPlace, [adversaire("Écuyer tranchant")]), { refus: "60 adversaires au plus dans un combat." });
  assert.deepEqual(ajouterPersonnage(soixante.miseEnPlace, pj(13)), { refus: "12 personnages au plus dans un combat." });
  // Dans l'autre ordre aussi : soixante adversaires ne prennent la place d'aucun personnage.
  let aRebours = ajouterTous(miseEnPlaceVide("demo"), cinq.flatMap((photo) => plusieurs(photo, 12)));
  for (let rang = 1; rang <= 12; rang += 1) aRebours = ajouterPj(aRebours, pj(rang));
  assert.equal(aRebours.protagonistes.length, 72);
});

test("un personnage qui porte le nom d'un adversaire n'en est pas un exemplaire : il ne compte pas parmi les douze", () => {
  const marmiton = marmitonDeCorveeEssai();
  const homonyme = pjEssai((valeurs) => {
    valeurs.identifiant = "essai-homonyme";
    valeurs.nom = marmiton.valeurs.nom;
  });
  const onze = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), homonyme), plusieurs(marmiton, 11));
  assert.equal(onze.protagonistes.filter((protagoniste) => protagoniste.photo.valeurs.nom === marmiton.valeurs.nom).length, 12, "douze protagonistes de ce nom, dont un personnage");
  assert.equal(ajouterAdversaires(onze, [marmiton]).ids.length, 1, "le douzième exemplaire s'ajoute encore");
  assert.deepEqual(ajouterAdversaires(onze, plusieurs(marmiton, 2)), { refus: "12 exemplaires au plus d'un même adversaire." }, "le treizième, non");
  // Sans le personnage, les mêmes comptes : il n'y changeait rien.
  const sans = ajouterTous(miseEnPlaceVide("demo"), plusieurs(marmiton, 11));
  assert.equal(ajouterAdversaires(sans, [marmiton]).ids.length, 1);
  assert.deepEqual(ajouterAdversaires(sans, plusieurs(marmiton, 2)), { refus: "12 exemplaires au plus d'un même adversaire." });
});

test("un personnage déjà présent le dit, même dans un combat plein", () => {
  let mep = miseEnPlaceVide("demo");
  for (let rang = 1; rang <= 12; rang += 1) mep = ajouterPj(mep, pj(rang));
  assert.deepEqual(ajouterPersonnage(mep, pj(3)), { refus: "Ce personnage est déjà dans le combat." });
});

test("douze exemplaires au plus d'un même adversaire : le douzième s'ajoute, le treizième non", () => {
  const marmiton = marmitonDeCorveeEssai();
  const douze = ajouterAdversaires(miseEnPlaceVide("demo"), plusieurs(marmiton, 12));
  assert.equal(douze.ids.length, 12);
  assert.deepEqual(ajouterAdversaires(douze.miseEnPlace, [marmiton]), { refus: "12 exemplaires au plus d'un même adversaire." });
  assert.deepEqual(ajouterAdversaires(miseEnPlaceVide("demo"), plusieurs(marmiton, 13)), { refus: "12 exemplaires au plus d'un même adversaire." });
  assert.equal(ajouterAdversaires(douze.miseEnPlace, [chefDePartieEssai()]).ids.length, 1, "un autre adversaire s'ajoute encore");
});

test("les exemplaires se comptent avec ceux qui sont déjà là", () => {
  const marmiton = marmitonDeCorveeEssai();
  const dix = ajouterTous(miseEnPlaceVide("demo"), plusieurs(marmiton, 10));
  assert.equal(ajouterAdversaires(dix, plusieurs(marmiton, 2)).ids.length, 2);
  assert.deepEqual(ajouterAdversaires(dix, plusieurs(marmiton, 3)), { refus: "12 exemplaires au plus d'un même adversaire." });
});

test("soixante adversaires au plus : le soixantième s'ajoute, le soixante et unième non", () => {
  const cinq = ["Commis", "Plongeur", "Saucier", "Rôtisseur", "Garde-manger"].map(adversaire);
  const soixante = ajouterAdversaires(miseEnPlaceVide("demo"), cinq.flatMap((photo) => plusieurs(photo, 12)));
  assert.equal(soixante.ids.length, 60);
  assert.deepEqual(ajouterAdversaires(soixante.miseEnPlace, [adversaire("Écuyer tranchant")]), { refus: "60 adversaires au plus dans un combat." });

  const cinquanteNeuf = ajouterTous(miseEnPlaceVide("demo"), [...cinq.slice(0, 4).flatMap((photo) => plusieurs(photo, 12)), ...plusieurs(cinq[4], 11)]);
  assert.equal(ajouterAdversaires(cinquanteNeuf, [adversaire("Écuyer tranchant")]).ids.length, 1);
  assert.deepEqual(ajouterAdversaires(cinquanteNeuf, plusieurs(adversaire("Écuyer tranchant"), 2)), { refus: "60 adversaires au plus dans un combat." });
});

test("tout ou rien : un plafond dépassé, et aucun adversaire de la liste ne s'ajoute", () => {
  const marmiton = marmitonDeCorveeEssai();
  const chef = chefDePartieEssai();
  const depart = ajouterTous(miseEnPlaceVide("demo"), plusieurs(marmiton, 11));
  // Le Chef et un Marmiton passeraient ; le second Marmiton serait le treizième.
  const rendu = ajouterAdversaires(depart, [chef, marmiton, marmiton]);
  assert.deepEqual(Object.keys(rendu), ["refus"]);
  assert.equal(depart.protagonistes.length, 11);
  assert.equal(depart.compteur, 11);
  // Les mêmes, moins celui de trop, passent ensemble.
  assert.deepEqual(ajouterAdversaires(depart, [chef, marmiton]).ids, ["adv12", "adv13"]);
});

test("les identifiants s'épuisent : au dernier que sa forme permet, plus personne ne s'ajoute, et la phrase le dit", () => {
  const phrase = "Ce combat a épuisé ses identifiants : commencez-en un nouveau.";
  assert.equal(IDENTIFIANTS_MAX, 99999);
  const marmiton = marmitonDeCorveeEssai();
  // Un combat dont le compteur gardé touche à sa borne : celui qu'un contenu forgé donnerait.
  const au = (compteur) => ({ ...ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), compteur });

  // Il reste un identifiant : il se donne, à un adversaire comme à un personnage.
  const presque = au(IDENTIFIANTS_MAX - 1);
  const dernier = ajouterAdversaires(presque, [marmiton]);
  assert.deepEqual(dernier.ids, ["adv99999"]);
  assert.equal(dernier.miseEnPlace.compteur, IDENTIFIANTS_MAX);
  assert.equal(ajouterPersonnage(presque, pj(2)).id, "pj99999");
  // Tout ou rien : deux adversaires pour un seul identifiant, et aucun ne s'ajoute.
  assert.deepEqual(ajouterAdversaires(presque, [marmiton, marmiton]), { refus: phrase });
  assert.equal(presque.protagonistes.length, 1);

  // Il n'en reste plus : ni adversaire, ni personnage. Aucun identifiant à six chiffres ne naît.
  const epuise = dernier.miseEnPlace;
  assert.deepEqual(ajouterAdversaires(epuise, [marmiton]), { refus: phrase });
  assert.deepEqual(ajouterPersonnage(epuise, pj(2)), { refus: phrase });
  assert.deepEqual(ajouterAdversaires(au(IDENTIFIANTS_MAX), [marmiton]), { refus: phrase });
  // Un compteur forcé plus haut encore ne fabrique rien non plus.
  assert.deepEqual(ajouterAdversaires(au(Number.MAX_SAFE_INTEGER), [marmiton]), { refus: phrase });
  assert.deepEqual(ajouterPersonnage(au(Number.MAX_SAFE_INTEGER), pj(2)), { refus: phrase });
  // Le reste se fait toujours : n'ajouter personne, poser, retirer, dire qui commence.
  assert.deepEqual(ajouterAdversaires(epuise, []).ids, []);
  assert.equal(poser(epuise, "adv99999", "D4").miseEnPlace.protagonistes[1].case, "D4");
  assert.equal(retirer(epuise, "adv99999").miseEnPlace.compteur, IDENTIFIANTS_MAX);
  assert.equal(reglerQuiCommence(epuise, "adv").miseEnPlace.quiCommence, "adv");
  // Un refus plus ordinaire passe d'abord : ce personnage est déjà là.
  assert.deepEqual(ajouterPersonnage(epuise, aubepineEssai()), { refus: "Ce personnage est déjà dans le combat." });
});

// ─── La pose d'office ───────────────────────────────────────────────────────

test("la pose d'office du combat de la démonstration : A1, J1, J2, J2", () => {
  const marmiton = marmitonDeCorveeEssai();
  const mep = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [chefDePartieEssai(), marmiton, marmiton]);
  assert.deepEqual(cases(mep), { pj1: "A1", adv2: "J1", adv3: "J2", adv4: "J2" });
});

test("la pose d'office : les PJ descendent la colonne A, puis passent à la colonne B", () => {
  let mep = miseEnPlaceVide("demo");
  for (let rang = 1; rang <= 12; rang += 1) mep = ajouterPj(mep, pj(rang));
  assert.deepEqual(Object.values(cases(mep)), ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "B1", "B2"]);
});

test("la pose d'office : chaque adversaire différent prend une ligne de la colonne J, puis la colonne I", () => {
  const noms = ["Commis", "Plongeur", "Saucier", "Rôtisseur", "Garde-manger", "Écuyer", "Échanson", "Panetier", "Boucher", "Fruitier", "Maraîcher"];
  const mep = ajouterTous(miseEnPlaceVide("demo"), noms.map(adversaire));
  assert.deepEqual(Object.values(cases(mep)), ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10", "I1"]);
});

test("la pose d'office : une case est libre quand personne n'y est, de quelque camp qu'il soit", () => {
  let mep = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), pj(1)), [chefDePartieEssai()]);
  mep = poser(mep, "adv2", "A2").miseEnPlace;
  mep = poser(mep, "pj1", "J1").miseEnPlace;
  mep = ajouterPj(mep, pj(2));
  mep = ajouterPj(mep, pj(3));
  mep = ajouterTous(mep, [adversaire("Commis")]);
  assert.deepEqual(cases(mep), { pj1: "J1", adv2: "A2", pj3: "A1", pj4: "A3", adv5: "J2" });
});

test("la pose d'office : un nouvel exemplaire rejoint la case du premier, où qu'on l'ait déplacé", () => {
  const marmiton = marmitonDeCorveeEssai();
  let mep = ajouterTous(miseEnPlaceVide("demo"), [marmiton, marmiton]);
  mep = poser(mep, "adv1", "D4").miseEnPlace;
  mep = ajouterTous(mep, [chefDePartieEssai(), marmiton]);
  assert.deepEqual(cases(mep), { adv1: "D4", adv2: "J1", adv3: "J2", adv4: "D4" }, "le Chef prend la première case libre de J, le Marmiton rejoint le n° 1");
});

test("la pose d'office : le premier exemplaire retiré, c'est le premier encore présent qu'on rejoint", () => {
  const marmiton = marmitonDeCorveeEssai();
  let mep = ajouterTous(miseEnPlaceVide("demo"), [marmiton, marmiton]);
  mep = poser(mep, "adv1", "D4").miseEnPlace;
  mep = poser(mep, "adv2", "F6").miseEnPlace;
  mep = retirer(mep, "adv1").miseEnPlace;
  mep = ajouterTous(mep, [marmiton]);
  assert.deepEqual(cases(mep), { adv2: "F6", adv3: "F6" });

  // Tous retirés : le suivant repart de la pose d'office.
  const vide = retirer(retirer(mep, "adv2").miseEnPlace, "adv3").miseEnPlace;
  assert.deepEqual(cases(ajouterTous(vide, [marmiton])), { adv4: "J1" });
});

test("la pose d'office : un adversaire d'un autre nom ne rejoint personne", () => {
  const mep = ajouterTous(miseEnPlaceVide("demo"), [adversaire("Marmiton de corvée"), adversaire("Marmiton de corvee"), adversaire("Marmiton de corvée")]);
  assert.deepEqual(cases(mep), { adv1: "J1", adv2: "J2", adv3: "J1" }, "le même nom, exactement");
});

test("la pose d'office : un adversaire ne rejoint pas un PJ qui porte son nom", () => {
  // Seuls les exemplaires d'un même adversaire partagent leur case : un PJ du
  // même nom n'en est pas un, et l'adversaire se pose sur la colonne J.
  const homonyme = pjEssai((valeurs) => {
    valeurs.identifiant = "essai-personnage-homonyme";
    valeurs.nom = "Marmiton de corvée";
  });
  let mep = ajouterPj(miseEnPlaceVide("demo"), homonyme);
  mep = ajouterTous(mep, [adversaire("Marmiton de corvée")]);
  assert.deepEqual(cases(mep), { pj1: "A1", adv2: "J1" });
  // Le PJ déplacé, puis deux exemplaires de plus : ils rejoignent l'adversaire, non le PJ.
  mep = poser(mep, "pj1", "D4").miseEnPlace;
  mep = poser(mep, "adv2", "F6").miseEnPlace;
  mep = ajouterTous(mep, [adversaire("Marmiton de corvée"), adversaire("Marmiton de corvée")]);
  assert.deepEqual(cases(mep), { pj1: "D4", adv2: "F6", adv3: "F6", adv4: "F6" });
});

// ─── Retirer ────────────────────────────────────────────────────────────────

test("retirer : le protagoniste part, le compteur ne redescend pas, et son identifiant ne resert pas", () => {
  const marmiton = marmitonDeCorveeEssai();
  const depart = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [marmiton, marmiton]);
  const rendu = retirer(depart, "adv3");
  assert.deepEqual(Object.keys(rendu), ["miseEnPlace"]);
  assert.deepEqual(rendu.miseEnPlace.protagonistes.map((protagoniste) => protagoniste.id), ["pj1", "adv2"]);
  assert.equal(rendu.miseEnPlace.compteur, 3);
  assert.deepEqual(ajouterAdversaires(rendu.miseEnPlace, [marmiton]).ids, ["adv4"]);
  assert.equal(depart.protagonistes.length, 3, "la mise en place reçue ne change pas");
  assert.ok(estGeleEnProfondeur(rendu.miseEnPlace));
});

test("retirer : un protagoniste inconnu est refusé", () => {
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  assert.deepEqual(retirer(depart, "pj2"), { refus: "Ce protagoniste n'est pas dans le combat." });
  assert.deepEqual(retirer(depart, undefined), { refus: "Ce protagoniste n'est pas dans le combat." });
  assert.deepEqual(retirer(miseEnPlaceVide("demo"), "pj1"), { refus: "Ce protagoniste n'est pas dans le combat." });
});

test("« Retirer » renumérote : les numéros d'exemplaire ne sont pas gardés", () => {
  const marmiton = marmitonDeCorveeEssai();
  const trois = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [marmiton, marmiton, marmiton]);
  assert.deepEqual(nomsCourts(trois), { pj1: "Aubépine", adv2: "Marmiton n° 1", adv3: "Marmiton n° 2", adv4: "Marmiton n° 3" });

  const deux = retirer(trois, "adv2").miseEnPlace;
  assert.deepEqual(nomsCourts(deux), { pj1: "Aubépine", adv3: "Marmiton n° 1", adv4: "Marmiton n° 2" });

  const un = retirer(deux, "adv4").miseEnPlace;
  assert.deepEqual(nomsCourts(un), { pj1: "Aubépine", adv3: "Marmiton" });
  for (const protagoniste of trois.protagonistes) assert.deepEqual(Object.keys(protagoniste), ["id", "camp", "case", "photo"], "ni numéro, ni nom court dans ce qui est gardé");
});

// ─── Poser ──────────────────────────────────────────────────────────────────

test("poser : un protagoniste va sur la case dite, lue comme une saisie", () => {
  const depart = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [chefDePartieEssai()]);
  const rendu = poser(depart, "pj1", " c3 ");
  assert.deepEqual(Object.keys(rendu), ["miseEnPlace"]);
  assert.deepEqual(cases(rendu.miseEnPlace), { pj1: "C3", adv2: "J1" });
  assert.equal(rendu.miseEnPlace.protagonistes[1], depart.protagonistes[1], "les autres ne sont pas recopiés");
  assert.equal(rendu.miseEnPlace.protagonistes[0].photo, depart.protagonistes[0].photo);
  assert.deepEqual(cases(depart), { pj1: "A1", adv2: "J1" });
  assert.ok(estGeleEnProfondeur(rendu.miseEnPlace));
});

test("poser : plusieurs protagonistes, des deux camps, partagent une case", () => {
  let mep = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [chefDePartieEssai(), marmitonDeCorveeEssai()]);
  for (const id of ["pj1", "adv2", "adv3"]) mep = poser(mep, id, "D4").miseEnPlace;
  assert.deepEqual(cases(mep), { pj1: "D4", adv2: "D4", adv3: "D4" });
});

test("poser : hors du plateau, ou pour un protagoniste inconnu, c'est refusé", () => {
  const depart = ajouterPj(miseEnPlaceVide("demo"), aubepineEssai());
  for (const nomDeCase of ["K1", "A0", "A11", "", "D 4", null, 7]) {
    assert.deepEqual(poser(depart, "pj1", nomDeCase), { refus: "Cette case n'est pas sur la carte : elles vont de A1 à J10." }, String(nomDeCase));
  }
  assert.deepEqual(poser(depart, "adv9", "D4"), { refus: "Ce protagoniste n'est pas dans le combat." });
  assert.equal(poser(depart, "pj1", "J10").miseEnPlace.protagonistes[0].case, "J10");
});

// ─── Qui commence, et le lancement ──────────────────────────────────────────

test("reglerQuiCommence : les PJ ou les adversaires, rien d'autre", () => {
  const vide = miseEnPlaceVide("demo");
  assert.equal(reglerQuiCommence(vide, "adv").miseEnPlace.quiCommence, "adv");
  assert.equal(reglerQuiCommence(reglerQuiCommence(vide, "adv").miseEnPlace, "pj").miseEnPlace.quiCommence, "pj");
  assert.equal(vide.quiCommence, "pj");
  for (const camp of ["adversaires", "PJ", "", null, undefined]) {
    assert.deepEqual(reglerQuiCommence(vide, camp), { refus: "Le camp qui commence est celui des PJ ou celui des adversaires." });
  }
});

test("peutLancer : il faut au moins un personnage et un adversaire", () => {
  const refus = { ok: false, raison: "Il faut au moins un personnage et un adversaire." };
  const vide = miseEnPlaceVide("demo");
  const unPj = ajouterPj(vide, aubepineEssai());
  const unAdversaire = ajouterTous(vide, [chefDePartieEssai()]);
  assert.deepEqual(peutLancer(vide), refus);
  assert.deepEqual(peutLancer(unPj), refus, "un personnage seul");
  assert.deepEqual(peutLancer(unAdversaire), refus, "un adversaire seul");
  assert.deepEqual(peutLancer(ajouterTous(unPj, [chefDePartieEssai()])), { ok: true });
  assert.deepEqual(peutLancer(retirer(ajouterTous(unPj, [chefDePartieEssai()]), "pj1").miseEnPlace), refus, "le personnage retiré");
});

test("la mise en place passe par JSON à l'identique", () => {
  const mep = ajouterTous(ajouterPj(miseEnPlaceVide("demo"), aubepineEssai()), [chefDePartieEssai(), marmitonDeCorveeEssai()]);
  assert.deepEqual(JSON.parse(JSON.stringify(mep)), mep);
});

// ─── La source de dés de l'écran ────────────────────────────────────────────

const TIRAGES = 2 ** 32;

// Un générateur qui rend, dans l'ordre, les tirages de 32 bits qu'on lui
// écrit, et compte ceux qu'on lui a pris.
function aleaImpose(tirages) {
  let pris = 0;
  return {
    getRandomValues(tampon) {
      assert.ok(tampon instanceof Uint32Array, "un tirage est un entier de 32 bits");
      assert.equal(tampon.length, 1);
      if (pris >= tirages.length) throw new Error("plus de tirage");
      tampon[0] = tirages[pris];
      pris += 1;
      return tampon;
    },
    pris: () => pris,
  };
}

test("des : un tirage donne la face 1 + tirage modulo faces", () => {
  const alea = aleaImpose([0, 1, 5, 6, 7, 600]);
  assert.deepEqual(sourceAleatoire(alea).lancer(6, 6), [1, 2, 6, 1, 2, 1]);
  assert.equal(alea.pris(), 6, "un tirage par dé, quand aucun n'est rejeté");
});

test("des : sans biais, un tirage au-delà du plus grand multiple des faces est rejeté et refait", () => {
  // 2 puissance 32 vaut 6 × 715 827 882 + 4 : les quatre derniers tirages
  // donneraient les faces 1 à 4 une fois de plus que les faces 5 et 6.
  const plafond = TIRAGES - (TIRAGES % 6);
  assert.equal(TIRAGES % 6, 4);
  const alea = aleaImpose([TIRAGES - 1, plafond, plafond + 1, plafond - 1, 0]);
  const source = sourceAleatoire(alea);
  assert.deepEqual(source.lancer(6), [6], "les trois premiers tirages sont rejetés ; le dernier d'avant le plafond donne 6");
  assert.equal(alea.pris(), 4);
  assert.deepEqual(source.lancer(6), [1]);
  assert.equal(alea.pris(), 5);
});

test("des : un dé dont les faces divisent 2 puissance 32 ne rejette rien", () => {
  const alea = aleaImpose([TIRAGES - 1, TIRAGES - 2, 3]);
  assert.deepEqual(sourceAleatoire(alea).lancer(4, 3), [4, 3, 4]);
  assert.equal(alea.pris(), 3);
});

test("des : chaque face garde exactement le même nombre de tirages", () => {
  // Pour un d10 et un d20, les tirages qui restent après le rejet se
  // partagent en parts égales : le plafond est un multiple des faces.
  for (const faces of [2, 4, 6, 8, 10, 12, 20, 100]) {
    const plafond = TIRAGES - (TIRAGES % faces);
    assert.equal(plafond % faces, 0);
    const alea = aleaImpose([plafond - 1, plafond, 0]);
    const source = sourceAleatoire(alea);
    assert.deepEqual(source.lancer(faces), [faces], `d${faces} : le dernier tirage gardé donne la dernière face`);
    if (plafond < TIRAGES) {
      assert.deepEqual(source.lancer(faces), [1], `d${faces} : le tirage du plafond est rejeté`);
      assert.equal(alea.pris(), 3);
    }
  }
});

test("des : par défaut, un seul dé ; sinon autant qu'on en demande", () => {
  const source = sourceAleatoire(aleaImpose([0, 1, 2, 3]));
  assert.deepEqual(source.lancer(10), [1]);
  assert.deepEqual(source.lancer(10, 3), [2, 3, 4]);
  assert.deepEqual(source.lancer(10, 0), []);
});

test("des : avec le générateur de l'appareil, toutes les faces sortent, et elles seules", () => {
  const source = sourceAleatoire();
  for (const faces of [6, 20]) {
    const valeurs = source.lancer(faces, 2000);
    assert.equal(valeurs.length, 2000);
    assert.ok(valeurs.every((valeur) => Number.isInteger(valeur) && valeur >= 1 && valeur <= faces));
    assert.equal(new Set(valeurs).size, faces);
  }
});

test("des : un dé sans faces, ou un nombre de dés qui n'en est pas un, lève au lieu de tourner sans fin", () => {
  const source = sourceAleatoire(aleaImpose([0, 0, 0, 0]));
  for (const faces of [0, -6, 2.5, NaN, "6", undefined, TIRAGES + 1]) assert.throws(() => source.lancer(faces), RangeError, String(faces));
  for (const combien of [-1, 1.5, "2", NaN]) assert.throws(() => source.lancer(6, combien), RangeError, String(combien));
});

test("des : la source de l'écran ne connaît que le générateur cryptographique", () => {
  const texte = readFileSync(new URL("../js/combat/des.js", import.meta.url), "utf8");
  assert.ok(texte.includes("getRandomValues"));
  assert.ok(!/Math\s*\.\s*random/.test(texte));
  assert.ok(!/\bimport\b/.test(texte.replace(/\/\/.*$/gm, "")), "elle n'importe rien");
});

// ─── La source de dés imposés ───────────────────────────────────────────────

test("desImposes : les valeurs sortent dans l'ordre, par dé ou par poignée", () => {
  const des = desImposes([8, 3, 6, 9, 14]);
  assert.deepEqual(des.reste(), [8, 3, 6, 9, 14]);
  assert.deepEqual(des.lancer(10), [8]);
  assert.deepEqual(des.lancer(10, 2), [3, 6]);
  assert.deepEqual(des.reste(), [9, 14]);
  assert.deepEqual(des.lancer(10, 1), [9]);
  assert.deepEqual(des.lancer(20), [14]);
  assert.deepEqual(des.reste(), []);
});

test("desImposes : demander un dé qui n'est pas prévu lève", () => {
  const des = desImposes([8]);
  assert.throws(() => des.lancer(10, 2), /Dés imposés/);
  assert.deepEqual(des.reste(), [8], "un lancer refusé ne prend rien");
  des.lancer(10);
  assert.throws(() => des.lancer(10), /Dés imposés/);
  assert.throws(() => desImposes([]).lancer(6), /Dés imposés/);
});

test("desImposes : une valeur plus grande que les faces du dé demandé lève", () => {
  const des = desImposes([14, 6]);
  assert.throws(() => des.lancer(10), /n'est pas une face d'un d10/);
  assert.deepEqual(des.reste(), [14, 6]);
  assert.deepEqual(des.lancer(20), [14], "la même valeur va à un d20");
  assert.deepEqual(des.lancer(6), [6], "la face maximale est une face");
  assert.throws(() => desImposes([0]).lancer(6), /Dés imposés/);
  assert.throws(() => desImposes([2.5]).lancer(6), /Dés imposés/);
});

test("desImposes : la liste donnée n'est ni gardée par référence, ni changée", () => {
  const valeurs = [4, 5];
  const des = desImposes(valeurs);
  valeurs.push(6);
  des.lancer(6);
  assert.deepEqual(des.reste(), [5]);
  assert.deepEqual(valeurs, [4, 5, 6]);
  des.reste().pop();
  assert.deepEqual(des.reste(), [5]);
});
