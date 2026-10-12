// Contrôles des coûts du combat (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat ») : js/combat/offre.js et js/combat/moteur.js. Le paiement d'un
// geste, « Revenir », la façon que joue d'office un bouton, la part X d'un
// coût, le lien et ses jauges, les raisons d'un bouton inactif, la portée et
// les cibles, le déplacement, et le jet prêté.
//
// Chaque règle est vue dans les deux sens : avant le premier dé et après, la
// puissance qu'on peut payer et celle qu'on ne peut pas, la jauge qui suffit
// et celle qui manque, la cible à portée et celle qui ne l'est pas, à un
// point ou à une case près.
//
// Les protagonistes sont ceux de tests/outils/photographies_essai.js,
// retouchés pour atteindre ce que la démonstration n'a pas : un personnage à
// deux jauges de lien, un coût illisible, une capacité absente de la banque,
// un adversaire à deux armes ou sans arme. Tous sont sur la case D4, sauf
// mention.

import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { arrivees, boutons, cibles, faconsDe, offre, pret, prixDeLEsquive, prixDuGeste, reglages } from "../js/combat/offre.js";
import { adversaireEssai, ajouterPassif, capaciteEssai, faconEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";

// ─── Les outils ─────────────────────────────────────────────────────────────

const LANCER = { type: "lancer", le: "2026-10-12T21:30" };
const CONFIRMER = { type: "confirmer" };
const APPLIQUER = { type: "appliquer" };
const AUBEPINE = pjEssai();
const CIBOULETTE = pjEssai((champs) => {
  champs.identifiant = "essai-ciboulette-0000000002";
  champs.nom = "Ciboulette";
});
const MARMITON = adversaireEssai();

const surD4 = (...photos) => photos.map((photo) => ({ photo, case: "D4" }));

/** Applique des événements à la suite ; un refus fait échouer le contrôle, avec sa phrase. */
function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements.flat()) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

const combat = (protagonistes, options) => jouer(ouvrirCombat(miseEnPlaceEssai(protagonistes, options)), LANCER);
const contre = (pj, adversaire = MARMITON) => combat(surD4(pj, adversaire));
const adverse = (adversaire, pj = AUBEPINE) => combat(surD4(pj, adversaire), { quiCommence: "adv" });

function refuse(etat, evenement, code, message = null) {
  const rendu = appliquer(etat, evenement);
  assert.notEqual(rendu.refus, undefined, `${JSON.stringify(evenement)} aurait dû être refusé`);
  assert.equal(rendu.etat, etat, "un refus rend l'état reçu, l'objet même");
  assert.equal(rendu.refus.code, code, rendu.refus.message);
  if (message !== null) assert.equal(rendu.refus.message, message);
}

const indiceDe = (etat, qui, nom) => {
  const indice = etat.photos[qui].capacites.findIndex((une) => une.nom === nom);
  assert.notEqual(indice, -1, `${qui} n'a pas de capacité « ${nom} »`);
  return indice;
};
const capacite = (etat, qui, nom, facon = 0) => ({ type: "capacite", qui, capacite: indiceDe(etat, qui, nom), facon });
const regler = (champ, valeur, raison) => (raison === undefined ? { type: "regler", champ, valeur } : { type: "regler", champ, valeur, raison });
const viser = (id) => regler("cible", id);
const d8 = (...valeurs) => ({ type: "de", faces: 8, valeurs });
const d20 = (valeur) => ({ type: "de", faces: 20, valeurs: [valeur] });

const boutonDe = (etat, qui, nom) => boutons(etat, qui).filter((bouton) => bouton.capacite === indiceDe(etat, qui, nom));
const ressources = (etat, id) => {
  const { actions, souffle, liens } = etat.protagonistes[id];
  return { actions, souffle, liens: liens.map((jauge) => jauge.points) };
};
const derniereLigne = (etat) => etat.journal.findLast((ligne) => ligne.genre === "geste").texte;

const OBJET = { genre: "objet", titre: "Écumoire" };
const CAPACITES = { genre: "capacites", titre: "Capacités" };

// ─── Le paiement ────────────────────────────────────────────────────────────

test("le paiement au premier dé : jusque-là rien n'est dépensé ; l'action et le souffle se paient d'un coup, une seule fois", () => {
  const depart = contre(AUBEPINE);
  // Émincer : 4 points de souffle, hors maîtrise (deux valeurs par dé).
  const regle = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"), regler("modificateur", 1, "Sel fin"));
  assert.equal(regle.protagonistes, depart.protagonistes, "avant le premier dé, rien n'a bougé : les mêmes objets");
  assert.equal(gesteEnCours(regle).paye, false);
  assert.equal(gesteEnCours(regle).prix, null);
  assert.deepEqual(prixDuGeste(regle, gesteEnCours(regle)), { actions: 1, souffle: 4, lien: 0, jauge: null, lienNonPaye: 0 });

  const premier = jouer(regle, d8(8, 8));
  assert.deepEqual(ressources(premier, "pj1"), { actions: 1, souffle: 6, liens: [2] });
  assert.equal(gesteEnCours(premier).paye, true);
  assert.deepEqual(gesteEnCours(premier).prix, { actions: 1, souffle: 4, lien: 0, jauge: null, lienNonPaye: 0 });

  // Ni les dés suivants, ni la localisation, ni « Appliquer » ne coûtent rien de plus.
  const fini = jouer(premier, d8(1, 8), d20(5), APPLIQUER);
  assert.deepEqual(ressources(fini, "pj1"), { actions: 1, souffle: 6, liens: [2] });
  assert.match(derniereLigne(fini), /^Aubépine : Émincer \(4 souffle\) contre Marmiton\./);
});

test("quand un adversaire attaque, c'est lui qui paie, au premier dé de la défense ; le jet de défense ne coûte rien au PJ", () => {
  const depart = adverse(MARMITON);
  const regle = jouer(depart, capacite(depart, "adv2", "Moulinet farineux"), viser("pj1"));
  assert.equal(regle.protagonistes, depart.protagonistes);
  const lance = jouer(regle, d8(8));
  assert.deepEqual(ressources(lance, "adv2"), { actions: 0, souffle: 0, liens: [] });
  assert.deepEqual(ressources(lance, "pj1"), { actions: 2, souffle: 10, liens: [2] });
  assert.deepEqual(gesteEnCours(lance).prix, { actions: 1, souffle: 5, lien: 0, jauge: null, lienNonPaye: 0 });
});

test("le paiement à « confirmer » : une capacité sans jet paie son action, son souffle et son lien, puis c'est fini", () => {
  const depart = contre(AUBEPINE);
  const ouvert = jouer(depart, capacite(depart, "pj1", "Fournaise"));
  assert.equal(ouvert.protagonistes, depart.protagonistes);
  assert.deepEqual(prixDuGeste(ouvert, gesteEnCours(ouvert)), { actions: 1, souffle: 1, lien: 1, jauge: 0, lienNonPaye: 0 });
  const confirme = jouer(ouvert, CONFIRMER);
  assert.deepEqual(ressources(confirme, "pj1"), { actions: 1, souffle: 9, liens: [1] });
  assert.deepEqual(confirme.pile, []);
  assert.equal(derniereLigne(confirme), "Aubépine : Fournaise [1] (1 souffle, 1 lien).");
  assert.equal(confirme.protagonistes.pj1.liens[0].max, 2, "le maximum de la jauge ne bouge pas");
});

test("« Revenir » ne dépense rien, et ne se propose plus après le premier dé", () => {
  const depart = contre(AUBEPINE);
  const regle = jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"), regler("avantages", 1, "Minutie"));
  const revenu = jouer(regle, { type: "revenir" });
  assert.deepEqual(revenu.pile, []);
  assert.equal(revenu.protagonistes, depart.protagonistes);
  assert.deepEqual(revenu.journal, depart.journal);
  // On rejoue la même capacité comme si de rien n'était : elle repart sans ses réglages.
  assert.deepEqual(gesteEnCours(jouer(revenu, capacite(revenu, "pj1", "Émincer"))).reglages, { modificateur: null, avantages: null });

  // Le premier dé lancé, le coût est payé : on ne revient plus.
  const lance = jouer(regle, d8(8));
  assert.equal(lance.protagonistes.pj1.souffle, 6);
  refuse(lance, { type: "revenir" }, "hors_moment");
  // De même pour un déplacement : avant « Confirmer », on revient ; après, c'est fait.
  const pas = jouer(depart, capacite(depart, "pj1", "Pas chassé", 1), regler("arrivee", "F4"));
  assert.equal(jouer(pas, { type: "revenir" }).protagonistes, depart.protagonistes);
  refuse(jouer(pas, CONFIRMER), { type: "revenir" }, "hors_moment", "Aucun geste n'est en cours.");
});

// ─── Les boutons, et la façon d'office ──────────────────────────────────────

test("boutons : un par capacité d'un PJ, dans l'ordre de sa photographie, chacun avec sa façon d'office", () => {
  const depart = contre(AUBEPINE);
  const actif = (indice, facon) => ({ capacite: indice, facon, actif: true, raison: null });
  // Flambage et Pas chassé ont deux puissances : la plus haute se paie (10 de souffle).
  assert.deepEqual(boutons(depart, "pj1"), [actif(0, 0), actif(1, 0), actif(2, 1), actif(3, 0), actif(4, 1), actif(5, 0), actif(6, 0), actif(7, 0)]);
  assert.deepEqual(boutons(depart, "pj9"), []);
});

test("la façon d'office d'un bouton : la plus haute puissance qu'on peut payer ; aucune, la plus basse, et le bouton est inactif", () => {
  const avecSouffle = (souffle) => contre(pjEssai((champs) => (champs.souffle = souffle)));
  const flambage = (etat) => boutonDe(etat, "pj1", "Flambage");
  const pasChasse = (etat) => boutonDe(etat, "pj1", "Pas chassé");

  // Flambage : [1] 5 de souffle, [2] 10. Pas chassé : [1] gratuit, [2] 1 de souffle.
  assert.deepEqual(flambage(avecSouffle(10)), [{ capacite: 2, facon: 1, actif: true, raison: null }]);
  assert.deepEqual(flambage(avecSouffle(9)), [{ capacite: 2, facon: 0, actif: true, raison: null }]);
  assert.deepEqual(flambage(avecSouffle(5)), [{ capacite: 2, facon: 0, actif: true, raison: null }]);
  assert.deepEqual(flambage(avecSouffle(4)), [{ capacite: 2, facon: 0, actif: false, raison: "Pas assez de souffle : 5 demandés, 4 restants." }]);
  assert.deepEqual(pasChasse(avecSouffle(1)), [{ capacite: 4, facon: 1, actif: true, raison: null }]);
  assert.deepEqual(pasChasse(avecSouffle(0)), [{ capacite: 4, facon: 0, actif: true, raison: null }]);

  // L'événement écrit la façon : la plus haute se joue si elle se paie, et elle seule décide.
  const juste = avecSouffle(9);
  refuse(juste, capacite(juste, "pj1", "Flambage", 1), "interdit", "Pas assez de souffle : 10 demandés, 9 restants.");
  assert.equal(gesteEnCours(jouer(juste, capacite(juste, "pj1", "Flambage", 0))).facon, 0);
});

test("la puissance se change tant que rien n'est payé : parmi celles qu'on peut payer, et le prix suit", () => {
  const depart = contre(AUBEPINE);
  const flambage = jouer(depart, capacite(depart, "pj1", "Flambage", 1));
  assert.deepEqual(reglages(flambage).facon, { valeur: 1, options: [0, 1] });
  assert.equal(prixDuGeste(flambage, gesteEnCours(flambage)).souffle, 10);
  const baisse = jouer(flambage, regler("facon", 0));
  assert.equal(prixDuGeste(baisse, gesteEnCours(baisse)).souffle, 5);
  assert.equal(jouer(baisse, CONFIRMER).protagonistes.pj1.souffle, 5);
  assert.equal(jouer(flambage, CONFIRMER).protagonistes.pj1.souffle, 0);
  refuse(flambage, regler("facon", 2), "hors_bornes");

  // Avec 9 de souffle, la puissance [2] ne s'offre plus : la demander dit pourquoi.
  const juste = contre(pjEssai((champs) => (champs.souffle = 9)));
  const basse = jouer(juste, capacite(juste, "pj1", "Flambage", 0));
  assert.deepEqual(reglages(basse).facon, { valeur: 0, options: [0] });
  refuse(basse, regler("facon", 1), "interdit", "Pas assez de souffle : 10 demandés, 9 restants.");
  // Une capacité à une seule façon n'a pas de puissance à régler.
  assert.equal("facon" in reglages(jouer(depart, capacite(depart, "pj1", "Frappe"))), false);
});

test("chaque raison d'un bouton inactif, et leur ordre", () => {
  const perdue = pjEssai((champs) => {
    champs.capacites.push(capaciteEssai({ nom: "Recette perdue", groupe: OBJET, inactive: "absente de la banque" }));
    champs.capacites.push(capaciteEssai({ nom: "Tache d'encre", groupe: OBJET, facons: [faconEssai({ cout: null })] }));
  });
  const depart = combat(surD4(perdue, MARMITON, CIBOULETTE));
  // « absente de la banque » : elle garde son bouton, nommé, inactif, sans façon.
  assert.deepEqual(boutonDe(depart, "pj1", "Recette perdue"), [{ capacite: 8, facon: null, actif: false, raison: "absente de la banque" }]);
  refuse(depart, capacite(depart, "pj1", "Recette perdue"), "interdit", "absente de la banque");
  assert.deepEqual(faconsDe(depart, "pj1", 8), []);
  // « coût illisible dans la banque ».
  assert.deepEqual(boutonDe(depart, "pj1", "Tache d'encre"), [{ capacite: 9, facon: 0, actif: false, raison: "coût illisible dans la banque" }]);
  refuse(depart, capacite(depart, "pj1", "Tache d'encre"), "interdit", "coût illisible dans la banque");
  assert.equal(prixDuGeste(depart, { acteur: "pj1", capacite: 9, facon: 0, x: 0, jauge: null }), null);

  // « Plus d'action à ce tour. » : Aubépine a dépensé ses deux actions, Ciboulette n'a pas joué.
  const frappe = [capacite(depart, "pj1", "Frappe"), viser("adv2"), d8(1)];
  const sansAction = jouer(depart, frappe, frappe);
  assert.equal(sansAction.protagonistes.pj1.actions, 0);
  assert.deepEqual(sansAction.tour, { numero: 1, camp: "pj" });
  for (const nom of ["Frappe", "Émincer", "Flambage", "Fournaise", "Pas chassé", "Goûter", "Taloche", "Pas de côté"]) {
    const [bouton] = boutonDe(sansAction, "pj1", nom);
    assert.deepEqual({ actif: bouton.actif, raison: bouton.raison }, { actif: false, raison: "Plus d'action à ce tour." }, nom);
  }
  // L'ordre : la banque d'abord (absente, illisible), puis l'action.
  assert.equal(boutonDe(sansAction, "pj1", "Recette perdue")[0].raison, "absente de la banque");
  assert.equal(boutonDe(sansAction, "pj1", "Tache d'encre")[0].raison, "coût illisible dans la banque");
  // Avec une action, les mêmes boutons sont actifs.
  assert.equal(boutonDe(jouer(depart, frappe), "pj1", "Frappe")[0].actif, true);

  // « Pas assez de souffle », au pluriel et au singulier ; puis « Pas assez de lien ».
  const essoufflee = contre(pjEssai((champs) => (champs.souffle = 3)));
  assert.equal(boutonDe(essoufflee, "pj1", "Flambage")[0].raison, "Pas assez de souffle : 5 demandés, 3 restants.");
  assert.equal(boutonDe(essoufflee, "pj1", "Émincer")[0].raison, "Pas assez de souffle : 4 demandés, 3 restants.");
  assert.equal(boutonDe(essoufflee, "pj1", "Fournaise")[0].actif, true);
  const aBout = contre(pjEssai((champs) => (champs.souffle = 0)));
  assert.equal(boutonDe(aBout, "pj1", "Fournaise")[0].raison, "Pas assez de souffle : 1 demandé, 0 restant.");
  const sansLien = contre(pjEssai((champs) => (champs.liens[0].points = 0)));
  assert.equal(boutonDe(sansLien, "pj1", "Fournaise")[0].raison, "Pas assez de lien : 1 demandé, 0 restant.");
  refuse(sansLien, capacite(sansLien, "pj1", "Fournaise"), "interdit", "Pas assez de lien : 1 demandé, 0 restant.");
  // L'ordre : le souffle avant le lien.
  const sansRien = contre(
    pjEssai((champs) => {
      champs.souffle = 0;
      champs.liens[0].points = 0;
    }),
  );
  assert.equal(boutonDe(sansRien, "pj1", "Fournaise")[0].raison, "Pas assez de souffle : 1 demandé, 0 restant.");
});

test("un passif n'a pas de bouton, ni la capacité dont le simulateur tient le rôle ; aucun ne se joue", () => {
  const charge = pjEssai((champs) => {
    ajouterPassif(champs, { role: "bonus_force", nom: "Costaud" });
    champs.capacites.push(capaciteEssai({ nom: "Guetter", role: "attendre" }));
    champs.capacites.push(capaciteEssai({ nom: "Lever le pied", role: "passer_son_tour" }));
    champs.capacites.push(capaciteEssai({ nom: "Lever le couvercle", role: "jet_de_defense" }));
  });
  const depart = contre(charge);
  assert.deepEqual(
    boutons(depart, "pj1").map((bouton) => bouton.capacite),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  for (const nom of ["Costaud", "Guetter", "Lever le pied", "Lever le couvercle"]) {
    assert.deepEqual(boutonDe(depart, "pj1", nom), [], nom);
    refuse(depart, capacite(depart, "pj1", nom), "hors_bornes", "Cette capacité ne se joue pas.");
  }
  // Dans l'autre sens : la même capacité, sans son rôle, a son bouton.
  const libre = contre(pjEssai((champs) => champs.capacites.push(capaciteEssai({ nom: "Guetter" }))));
  assert.deepEqual(boutonDe(libre, "pj1", "Guetter"), [{ capacite: 8, facon: 0, actif: true, raison: null }]);
  // Les interventions, elles, gardent leur bouton à leur propre tour.
  assert.equal(boutonDe(depart, "pj1", "Pas de côté")[0].actif, true);
});

test("une façon passive ne se joue jamais, même quand la capacité a d'autres façons", () => {
  // Flambage : la puissance [1] est passive, la [2] se joue.
  const mixte = (souffle) =>
    contre(
      pjEssai((champs) => {
        champs.souffle = souffle;
        champs.capacites[2].facons[0].passif = true;
      }),
    );
  const depart = mixte(10);
  assert.deepEqual(faconsDe(depart, "pj1", 2), [
    { facon: 0, actif: false, raison: "Passif à cette puissance." },
    { facon: 1, actif: true, raison: null },
  ]);
  assert.deepEqual(boutonDe(depart, "pj1", "Flambage"), [{ capacite: 2, facon: 1, actif: true, raison: null }]);
  refuse(depart, capacite(depart, "pj1", "Flambage", 0), "interdit", "Passif à cette puissance.");
  const ouvert = jouer(depart, capacite(depart, "pj1", "Flambage", 1));
  assert.deepEqual(reglages(ouvert).facon.options, [1]);
  refuse(ouvert, regler("facon", 0), "interdit", "Passif à cette puissance.");
  // Faute de pouvoir payer la [2], le bouton la garde, inactif : la façon passive n'est jamais celle d'office.
  assert.deepEqual(boutonDe(mixte(9), "pj1", "Flambage"), [{ capacite: 2, facon: 1, actif: false, raison: "Pas assez de souffle : 10 demandés, 9 restants." }]);
  // Passive à la plus haute puissance : le bouton joue la [1].
  const haute = contre(pjEssai((champs) => (champs.capacites[2].facons[1].passif = true)));
  assert.deepEqual(boutonDe(haute, "pj1", "Flambage"), [{ capacite: 2, facon: 0, actif: true, raison: null }]);
});

test("un adversaire a un bouton par façon : un par arme qui donne la capacité, et il joue à son rang", () => {
  const aDeuxArmes = adversaireEssai((champs) => {
    champs.armes.push({ nom: "Louche", libelle: "Louche", poids: null, faces: null, caracteristiques: null, degats: [1, 2, 3], portee: 2, locMultiple: 1, mainsNues: false });
    champs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Louche", attaque: true, degats: [1, 2, 3], portee: 2 }));
  });
  const depart = adverse(aDeuxArmes);
  assert.deepEqual(boutons(depart, "adv2"), [
    { capacite: 0, facon: 0, actif: true, raison: null },
    { capacite: 0, facon: 1, actif: true, raison: null },
    { capacite: 1, facon: 0, actif: true, raison: null },
    { capacite: 2, facon: 0, actif: true, raison: null },
  ]);
  // La façon choisit l'arme : ses dégâts, sa portée.
  const louche = jouer(depart, capacite(depart, "adv2", "Frappe", 1), viser("pj1"), d8(1), d20(5), APPLIQUER);
  assert.match(derniereLigne(louche), /^Marmiton : Frappe \(Louche\) contre Aubépine\. .* Aubépine reçoit C = 3\./);
  assert.match(derniereLigne(jouer(depart, capacite(depart, "adv2", "Frappe", 0), viser("pj1"), d8(1), d20(5), APPLIQUER)), /^Marmiton : Frappe \(Spatule souple\) contre Aubépine\. .* Aubépine reçoit C = 15\./);
  // Son Moulinet coûte 5 de souffle : avec 4, le bouton est inactif.
  const essouffle = adverse(adversaireEssai((champs) => (champs.souffle = 4)));
  assert.deepEqual(boutonDe(essouffle, "adv2", "Moulinet farineux"), [{ capacite: 1, facon: 0, actif: false, raison: "Pas assez de souffle : 5 demandés, 4 restants." }]);
  assert.equal(boutonDe(adverse(MARMITON), "adv2", "Moulinet farineux")[0].actif, true);
});

// ─── La part X d'un coût ────────────────────────────────────────────────────

test("X se choisit de 0 à ce qui reste, et se paie tel quel", () => {
  const depart = contre(AUBEPINE);
  // Le Pas de côté, joué à son propre tour : X points de souffle.
  const ouvert = jouer(depart, capacite(depart, "pj1", "Pas de côté"));
  assert.deepEqual(reglages(ouvert).x, { valeur: 0, min: 0, max: 10 });
  refuse(ouvert, regler("x", 11), "hors_bornes");
  refuse(ouvert, regler("x", -1), "hors_bornes");
  refuse(ouvert, regler("x", 3, "Par prudence"), "forme");

  const trois = jouer(ouvert, regler("x", 3));
  assert.equal(reglages(trois).x.valeur, 3);
  assert.equal(trois.protagonistes, depart.protagonistes, "X ne se paie qu'à la confirmation");
  const paye = jouer(trois, CONFIRMER);
  assert.deepEqual(ressources(paye, "pj1"), { actions: 1, souffle: 7, liens: [2] });
  assert.equal(derniereLigne(paye), "Aubépine : Pas de côté (3 souffle).");
  // 0 par défaut : rien à payer que l'action. 10, tout le souffle.
  assert.equal(derniereLigne(jouer(ouvert, CONFIRMER)), "Aubépine : Pas de côté.");
  assert.equal(jouer(ouvert, regler("x", 10), CONFIRMER).protagonistes.pj1.souffle, 0);

  // Avec 4 de souffle, X va de 0 à 4.
  const essoufflee = contre(pjEssai((champs) => (champs.souffle = 4)));
  const borne = jouer(essoufflee, capacite(essoufflee, "pj1", "Pas de côté"));
  assert.deepEqual(reglages(borne).x, { valeur: 0, min: 0, max: 4 });
  refuse(borne, regler("x", 5), "hors_bornes");
  assert.equal(gesteEnCours(jouer(borne, regler("x", 4))).x, 4);

  // Un coût sans X n'a rien à régler.
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"));
  assert.equal("x" in reglages(frappe), false);
  refuse(frappe, regler("x", 1), "hors_moment");
});

test("le même X vaut pour le souffle et pour le lien : il est borné par le plus petit des deux restes", () => {
  // Fournaise, du Grand Four (2 points) : X de souffle et X de lien.
  const aX = (souffle) =>
    contre(
      pjEssai((champs) => {
        champs.souffle = souffle;
        champs.capacites[3].facons[0].cout = { souffle: "X", lien: "X" };
      }),
    );
  const riche = aX(10);
  const ouvert = jouer(riche, capacite(riche, "pj1", "Fournaise"));
  assert.deepEqual(reglages(ouvert).x, { valeur: 0, min: 0, max: 2 }, "la jauge borne : 2 points de lien");
  refuse(ouvert, regler("x", 3), "hors_bornes");
  const deux = jouer(ouvert, regler("x", 2));
  assert.deepEqual(prixDuGeste(deux, gesteEnCours(deux)), { actions: 1, souffle: 2, lien: 2, jauge: 0, lienNonPaye: 0 });
  const paye = jouer(deux, CONFIRMER);
  assert.deepEqual(ressources(paye, "pj1"), { actions: 1, souffle: 8, liens: [0] });
  assert.equal(derniereLigne(paye), "Aubépine : Fournaise [1] (2 souffle, 2 lien).");

  const pauvre = aX(1);
  assert.deepEqual(reglages(jouer(pauvre, capacite(pauvre, "pj1", "Fournaise"))).x, { valeur: 0, min: 0, max: 1 }, "le souffle borne : 1 point");

  // Un coût fixe de souffle et X de lien : seule la jauge borne X.
  const fixe = contre(pjEssai((champs) => (champs.capacites[3].facons[0].cout = { souffle: 2, lien: "X" })));
  const regle = jouer(fixe, capacite(fixe, "pj1", "Fournaise"), regler("x", 2));
  assert.deepEqual(reglages(regle).x, { valeur: 2, min: 0, max: 2 });
  assert.deepEqual(ressources(jouer(regle, CONFIRMER), "pj1"), { actions: 1, souffle: 8, liens: [0] });
});

// ─── Le lien ────────────────────────────────────────────────────────────────

// Un personnage à deux jauges : le Grand Four (1 point), dont vient Fournaise
// (1 de souffle, 1 de lien), et le Vieux Fourneau (3 points). Fond de sauce (2 de lien)
// et Pincée de sel (1 de lien) viennent d'un objet : elles n'ont pas de jauge attitrée.
const aDeuxJauges = (grandFour = 1, vieuxFourneau = 3) =>
  pjEssai((champs) => {
    champs.liens = [
      { nom: "Grand Four", points: grandFour },
      { nom: "Vieux Fourneau", points: vieuxFourneau },
    ];
    champs.capacites.push(capaciteEssai({ nom: "Fond de sauce", groupe: OBJET, facons: [faconEssai({ cout: { souffle: 0, lien: 2 } })] }));
    champs.capacites.push(capaciteEssai({ nom: "Pincée de sel", groupe: OBJET, facons: [faconEssai({ cout: { souffle: 0, lien: 1 } })] }));
  });

test("la capacité d'un primordial ne paie que sur sa jauge : inactive quand elle manque, même si l'autre suffirait", () => {
  const depart = contre(aDeuxJauges());
  const ouvert = jouer(depart, capacite(depart, "pj1", "Fournaise"));
  assert.equal("jauge" in reglages(ouvert), false, "pas de jauge à choisir");
  refuse(ouvert, regler("jauge", 1), "hors_moment");
  assert.equal(prixDuGeste(ouvert, gesteEnCours(ouvert)).jauge, 0);
  const paye = jouer(ouvert, CONFIRMER);
  assert.deepEqual(ressources(paye, "pj1"), { actions: 1, souffle: 9, liens: [0, 3] });

  // Le Grand Four est vide : Fournaise ne se joue plus, alors que le Vieux Fourneau a 3 points.
  assert.deepEqual(boutonDe(paye, "pj1", "Fournaise"), [{ capacite: 3, facon: 0, actif: false, raison: "Pas assez de lien : 1 demandé, 0 restant." }]);
  refuse(paye, capacite(paye, "pj1", "Fournaise"), "interdit", "Pas assez de lien : 1 demandé, 0 restant.");
  // Avec un point dans sa jauge, elle se joue ; l'autre jauge n'y change rien.
  assert.equal(boutonDe(contre(aDeuxJauges(1, 0)), "pj1", "Fournaise")[0].actif, true);
});

test("la capacité sans jauge attitrée paie sur une jauge qui suffit : la première par défaut, ou celle qu'on choisit", () => {
  const depart = contre(aDeuxJauges());
  // Pincée de sel, 1 de lien : les deux jauges suffisent, on choisit.
  const pincee = jouer(depart, capacite(depart, "pj1", "Pincée de sel"));
  assert.deepEqual(reglages(pincee).jauge, { valeur: 0, options: [0, 1] });
  assert.equal(prixDuGeste(pincee, gesteEnCours(pincee)).jauge, 0);
  assert.deepEqual(ressources(jouer(pincee, CONFIRMER), "pj1"), { actions: 1, souffle: 10, liens: [0, 3] });
  const choisie = jouer(pincee, regler("jauge", 1));
  assert.equal(reglages(choisie).jauge.valeur, 1);
  assert.deepEqual(ressources(jouer(choisie, CONFIRMER), "pj1"), { actions: 1, souffle: 10, liens: [1, 2] });
  refuse(pincee, regler("jauge", 2), "hors_bornes");
  assert.equal(derniereLigne(jouer(pincee, CONFIRMER)), "Aubépine : Pincée de sel (1 lien).");

  // Fond de sauce, 2 de lien : seul le Vieux Fourneau suffit. Rien à choisir, il paie.
  const fond = jouer(depart, capacite(depart, "pj1", "Fond de sauce"));
  assert.equal("jauge" in reglages(fond), false);
  assert.equal(prixDuGeste(fond, gesteEnCours(fond)).jauge, 1);
  assert.deepEqual(ressources(jouer(fond, CONFIRMER), "pj1"), { actions: 1, souffle: 10, liens: [1, 1] });

  // Aucune ne suffit : le bouton est inactif, et dit le reste de la plus pleine.
  const justes = contre(aDeuxJauges(1, 1));
  assert.deepEqual(boutonDe(justes, "pj1", "Fond de sauce"), [{ capacite: 8, facon: 0, actif: false, raison: "Pas assez de lien : 2 demandés, 1 restant." }]);
  assert.equal(boutonDe(justes, "pj1", "Pincée de sel")[0].actif, true);
  // Sans jauge du tout : 0 restant.
  const sansJauge = contre(
    pjEssai((champs) => {
      champs.liens = [];
      champs.capacites = champs.capacites.filter((une) => une.lien === null);
      champs.capacites.push(capaciteEssai({ nom: "Pincée de sel", groupe: OBJET, facons: [faconEssai({ cout: { souffle: 0, lien: 1 } })] }));
    }),
  );
  assert.equal(boutonDe(sansJauge, "pj1", "Pincée de sel")[0].raison, "Pas assez de lien : 1 demandé, 0 restant.");
});

test("un adversaire ne paie pas le lien : le prix le dit, le journal aussi, et rien ne lui en manque", () => {
  const saucier = adversaireEssai((champs) => {
    champs.capacites.push(capaciteEssai({ nom: "Sauce noire", groupe: CAPACITES, facons: [faconEssai({ cout: { souffle: 2, lien: 1 } })] }));
    champs.capacites.push(capaciteEssai({ nom: "Jus court", groupe: CAPACITES, facons: [faconEssai({ cout: { souffle: 0, lien: 3 } })] }));
  });
  const depart = adverse(saucier);
  assert.equal(boutonDe(depart, "adv2", "Sauce noire")[0].actif, true, "il n'a aucune jauge, et le bouton est actif");
  const sauce = jouer(depart, capacite(depart, "adv2", "Sauce noire"));
  assert.deepEqual(prixDuGeste(sauce, gesteEnCours(sauce)), { actions: 1, souffle: 2, lien: 0, jauge: null, lienNonPaye: 1 });
  const paye = jouer(sauce, CONFIRMER);
  assert.deepEqual(ressources(paye, "adv2"), { actions: 1, souffle: 3, liens: [] }, "son tour a fini : il a retrouvé son action, pas son souffle");
  assert.equal(derniereLigne(paye), "Marmiton : Sauce noire (2 souffle ; coût en lien non payé : un adversaire n'a pas de lien).");
  assert.equal(derniereLigne(jouer(depart, capacite(depart, "adv2", "Jus court"), CONFIRMER)), "Marmiton : Jus court (coût en lien non payé : un adversaire n'a pas de lien).");
  // Un PJ, lui, le paie : c'est le contrôle de Fournaise, plus haut. Le souffle d'un adversaire, lui, se paie.
  const aSec = adverse(
    adversaireEssai((champs) => {
      champs.souffle = 1;
      champs.capacites.push(capaciteEssai({ nom: "Sauce noire", groupe: CAPACITES, facons: [faconEssai({ cout: { souffle: 2, lien: 1 } })] }));
    }),
  );
  assert.equal(boutonDe(aSec, "adv2", "Sauce noire")[0].raison, "Pas assez de souffle : 2 demandés, 1 restant.");
});

test("le prix d'une esquive : une action, et autant de souffle que de dégâts annulés", () => {
  assert.deepEqual(prixDeLEsquive(3), { actions: 1, souffle: 3 });
  assert.deepEqual(prixDeLEsquive(1), { actions: 1, souffle: 1 });
});

// ─── La portée et les cibles ────────────────────────────────────────────────

// Aubépine en D4 ; un Marmiton en diagonale (E5, à une case), un autre à deux
// cases (F4), Ciboulette sur sa case.
const disperses = (options) =>
  combat(
    [
      { photo: AUBEPINE, case: "D4" },
      { photo: MARMITON, case: "E5" },
      { photo: MARMITON, case: "F4" },
      { photo: CIBOULETTE, case: "D4" },
    ],
    options,
  );

test("la cible d'une attaque : vivante, du camp adverse, à portée ; une diagonale compte pour une case", () => {
  const depart = disperses();
  // La Frappe du couteau porte à 1 : la diagonale est à portée, deux cases non.
  const frappe = jouer(depart, capacite(depart, "pj1", "Frappe"));
  assert.deepEqual(cibles(frappe), [
    { id: "adv2", possible: true, raison: null },
    { id: "adv3", possible: false, raison: "hors de portée : 2 cases, portée 1" },
  ]);
  assert.deepEqual(reglages(frappe).cible, { valeur: null, options: ["adv2"] });
  assert.equal(gesteEnCours(jouer(frappe, viser("adv2"))).cible, "adv2");
  refuse(frappe, viser("adv3"), "interdit", "hors de portée : 2 cases, portée 1");
  // Un allié, ou soi : ce n'est pas une cible d'attaque.
  refuse(frappe, viser("pj4"), "hors_bornes", "Ce protagoniste ne peut pas être la cible de ce geste.");
  refuse(frappe, viser("pj1"), "hors_bornes");
  refuse(frappe, viser(null), "hors_bornes");
  assert.deepEqual(pret(frappe), { ok: false, manque: "Choisissez une cible." });
  assert.deepEqual(pret(jouer(frappe, viser("adv2"))), { ok: true });

  // La Taloche n'a pas de portée : 0, la même case. Une case, c'est trop loin.
  const taloche = jouer(depart, capacite(depart, "pj1", "Taloche"));
  assert.deepEqual(cibles(taloche), [
    { id: "adv2", possible: false, raison: "hors de portée : 1 case, portée 0" },
    { id: "adv3", possible: false, raison: "hors de portée : 2 cases, portée 0" },
  ]);
  const colles = combat(surD4(AUBEPINE, MARMITON));
  assert.deepEqual(cibles(jouer(colles, capacite(colles, "pj1", "Taloche"))), [{ id: "adv2", possible: true, raison: null }]);

  // Vu de l'adversaire : sa spatule porte à 0, les deux PJ sont à une case.
  const tourAdverse = disperses({ quiCommence: "adv" });
  assert.deepEqual(cibles(jouer(tourAdverse, capacite(tourAdverse, "adv2", "Frappe"))), [
    { id: "pj1", possible: false, raison: "hors de portée : 1 case, portée 0" },
    { id: "pj4", possible: false, raison: "hors de portée : 1 case, portée 0" },
  ]);
  // Hors d'un geste en préparation, personne ne se vise.
  assert.deepEqual(cibles(depart), []);
  assert.deepEqual(cibles(jouer(frappe, viser("adv2"), d8(8))), []);
});

test("la cible d'une capacité sans jet est facultative : un vivant au choix, sans condition de portée, ou personne", () => {
  const depart = disperses();
  const flambage = jouer(depart, capacite(depart, "pj1", "Flambage"));
  assert.deepEqual(cibles(flambage), [
    { id: "pj1", possible: true, raison: null },
    { id: "adv2", possible: true, raison: null },
    { id: "adv3", possible: true, raison: null },
    { id: "pj4", possible: true, raison: null },
  ]);
  assert.deepEqual(reglages(flambage).cible, { valeur: null, options: [null, "pj1", "adv2", "adv3", "pj4"] });
  assert.deepEqual(pret(flambage), { ok: true }, "sans cible, elle se joue");
  assert.equal(derniereLigne(jouer(flambage, CONFIRMER)), "Aubépine : Flambage [1] (5 souffle).");
  assert.equal(derniereLigne(jouer(flambage, viser("adv3"), CONFIRMER)), "Aubépine : Flambage [1] (5 souffle) contre Marmiton n° 2.");
  assert.equal(derniereLigne(jouer(flambage, viser("pj4"), CONFIRMER)), "Aubépine : Flambage [1] (5 souffle) sur Ciboulette.");
  // « Sans cible » retire la cible choisie.
  assert.equal(gesteEnCours(jouer(flambage, viser("adv3"), viser(null))).cible, null);
  refuse(flambage, viser("adv9"), "hors_bornes");
  // Ni un déplacement ni un jet de caractéristique n'ont de cible.
  for (const nom of ["Pas chassé", "Goûter"]) {
    const ouvert = jouer(depart, capacite(depart, "pj1", nom));
    assert.deepEqual(cibles(ouvert), [], nom);
    assert.equal("cible" in reglages(ouvert), false, nom);
  }
});

// ─── Le déplacement ─────────────────────────────────────────────────────────

test("un déplacement à la puissance P mène à une case située à une distance de 1 à P ; il se paie à la confirmation", () => {
  const depart = contre(AUBEPINE);
  const un = jouer(depart, capacite(depart, "pj1", "Pas chassé", 0));
  assert.deepEqual(arrivees(un), ["C3", "C4", "C5", "D3", "D5", "E3", "E4", "E5"]);
  assert.deepEqual(reglages(un).arrivee, { valeur: null, options: arrivees(un) });
  refuse(un, regler("arrivee", "F4"), "hors_bornes");
  refuse(un, regler("arrivee", "D4"), "hors_bornes", "Cette valeur n'est pas de celles qui s'offrent.");
  refuse(un, regler("arrivee", "K4"), "forme");
  const arrive = jouer(un, regler("arrivee", "E5"), CONFIRMER);
  assert.equal(arrive.protagonistes.pj1.case, "E5");
  assert.deepEqual(ressources(arrive, "pj1"), { actions: 1, souffle: 10, liens: [2] });
  assert.equal(derniereLigne(arrive), "Aubépine : Pas chassé [1], D4 → E5.");

  // À la puissance [2] : jusqu'à deux cases, pour 1 de souffle.
  const deux = jouer(depart, capacite(depart, "pj1", "Pas chassé", 1));
  assert.equal(arrivees(deux).length, 24);
  assert.equal(arrivees(deux).includes("F6"), true);
  assert.equal(arrivees(deux).includes("G4"), false);
  const loin = jouer(deux, regler("arrivee", "F6"));
  assert.equal(loin.protagonistes.pj1.case, "D4", "avant « Confirmer », personne ne bouge");
  const paye = jouer(loin, CONFIRMER);
  assert.equal(paye.protagonistes.pj1.case, "F6");
  assert.equal(paye.protagonistes.pj1.souffle, 9);
  assert.equal(derniereLigne(paye), "Aubépine : Pas chassé [2] (1 souffle), D4 → F6.");

  // Au bord du plateau, les cases qui n'existent pas ne s'offrent pas ; une case occupée s'offre.
  const auCoin = combat([
    { photo: AUBEPINE, case: "A1" },
    { photo: MARMITON, case: "B2" },
  ]);
  const duCoin = jouer(auCoin, capacite(auCoin, "pj1", "Pas chassé", 0));
  assert.deepEqual(arrivees(duCoin), ["A2", "B1", "B2"]);
  assert.equal(jouer(duCoin, regler("arrivee", "B2"), CONFIRMER).protagonistes.pj1.case, "B2");
  assert.deepEqual(arrivees(auCoin), [], "hors d'un déplacement en préparation, aucune case");
});

test("un adversaire se déplace à son rang, s'il en a la capacité ; sans elle, il n'a pas de bouton pour bouger", () => {
  // Rang 2 : jusqu'à deux cases, pour 1 de souffle (« N-1 »).
  const chef = adversaireEssai((champs) => {
    champs.capacites[2].niveau = 2;
    champs.capacites[2].facons = [faconEssai({ puissance: 2, cout: { souffle: 1, lien: 0 } })];
  });
  const depart = adverse(chef);
  const pas = jouer(depart, capacite(depart, "adv2", "Pas chassé"));
  assert.equal(arrivees(pas).length, 24);
  const arrive = jouer(pas, regler("arrivee", "F6"), CONFIRMER);
  assert.equal(arrive.protagonistes.adv2.case, "F6");
  assert.equal(arrive.protagonistes.adv2.souffle, 4);
  assert.equal(derniereLigne(arrive), "Marmiton : Pas chassé [2] (1 souffle), D4 → F6.");
  // Au rang 1, une case seulement.
  const marmiton = adverse(MARMITON);
  assert.equal(arrivees(jouer(marmiton, capacite(marmiton, "adv2", "Pas chassé"))).length, 8);

  const cloue = adverse(adversaireEssai((champs) => champs.capacites.pop()));
  assert.deepEqual(
    boutons(cloue, "adv2").map((bouton) => cloue.photos.adv2.capacites[bouton.capacite].nom),
    ["Frappe", "Moulinet farineux"],
  );
});

// ─── Le jet prêté ───────────────────────────────────────────────────────────

test("le jet prêté d'un PJ est celui de son arme tenue : son dé, sa portée, ses dégâts sur demande, sans désavantage de maîtrise", () => {
  // Flambage, hors maîtrise si c'était une attaque : le jet prêté n'en tient pas compte.
  const depart = contre(pjEssai((champs) => (champs.capacites[2].facons[0].desavantage = true)));
  const ouvert = jouer(depart, capacite(depart, "pj1", "Flambage"));
  assert.deepEqual(reglages(ouvert).jet_prete, { valeur: false, options: [false, true] });
  assert.equal(offre(ouvert).de, null);
  const prete = jouer(ouvert, regler("jet_prete", true));
  assert.deepEqual({ mode: gesteEnCours(prete).mode, armePretee: gesteEnCours(prete).armePretee }, { mode: "jet_prete", armePretee: 0 });
  assert.deepEqual(reglages(prete).jet_prete, { valeur: true, options: [false, true] });
  assert.equal("arme_pretee" in reglages(prete), false, "un PJ ne choisit pas l'arme : c'est la tenue");
  assert.equal("caracteristiques" in reglages(prete), false, "le dé du couteau est fixe");
  refuse(prete, regler("arme_pretee", 1), "hors_moment");
  // Il exige alors une cible adverse.
  assert.deepEqual(pret(prete), { ok: false, manque: "Choisissez une cible." });
  refuse(prete, CONFIRMER, "hors_moment");
  const visee = jouer(prete, viser("adv2"));
  assert.deepEqual(offre(visee).de, { faces: 8, combien: 1, motif: "chaine", place: 1 }, "un d8, lancé une fois : pas de désavantage");
  assert.deepEqual(gesteEnCours(jouer(visee, d8(8))).jet.desavantages, []);
  // La même façon, jouée comme l'attaque qu'est Émincer, porte le désavantage : deux valeurs par dé.
  assert.equal(offre(jouer(depart, capacite(depart, "pj1", "Émincer"), viser("adv2"))).de.combien, 2);

  // À la portée de l'arme prêtée (1), pas au-delà.
  const loin = combat([
    { photo: AUBEPINE, case: "D4" },
    { photo: MARMITON, case: "F4" },
  ]);
  const horsDePortee = jouer(loin, capacite(loin, "pj1", "Flambage"), regler("jet_prete", true));
  assert.deepEqual(cibles(horsDePortee), [{ id: "adv2", possible: false, raison: "hors de portée : 2 cases, portée 1" }]);
});

test("sans arme tenue, un PJ prête le jet de ses mains nues : un dé au choix, à portée 0 ; sans rien, « sans arme »", () => {
  // Les mains nues seules : la Taloche est son arme prêtée.
  const mainsNues = pjEssai((champs) => {
    champs.armes = [champs.armes[1]];
    champs.capacites = champs.capacites.filter((une) => une.groupe.genre !== "arme");
    champs.capacites.find((une) => une.nom === "Taloche").facons[0].arme = 0;
  });
  const depart = contre(mainsNues);
  const prete = jouer(depart, capacite(depart, "pj1", "Flambage"), regler("jet_prete", true));
  assert.equal(gesteEnCours(prete).armePretee, 0);
  assert.deepEqual(Object.keys(reglages(prete)), ["facon", "jet_prete", "cible", "caracteristiques", "modificateur", "avantages"]);
  const visee = jouer(prete, viser("adv2"));
  assert.deepEqual(pret(visee), { ok: false, manque: "Choisissez une ou deux caractéristiques." });
  const touche = jouer(visee, regler("caracteristiques", ["force", "agilite"]), d8(8), d8(1));
  assert.deepEqual(offre(touche).degats.bases, ["aucun", "arme"]);
  const applique = jouer(touche, { type: "degats", base: "arme", operations: [], nature: "normaux" }, d20(5), APPLIQUER);
  assert.match(derniereLigne(applique), /d8 \(Force \+ Agilité\) contre 5 → 8 ✓, 1 ✗ : 1 réussite, touché, dégâts de l'arme : A = 2\. Localisation d20 → 5 : torse\. Armure 10 → 8\.$/);
  // À portée 0 : une case, c'est trop loin.
  const ecartes = combat([
    { photo: mainsNues, case: "D4" },
    { photo: MARMITON, case: "E4" },
  ]);
  assert.deepEqual(cibles(jouer(ecartes, capacite(ecartes, "pj1", "Flambage"), regler("jet_prete", true))), [{ id: "adv2", possible: false, raison: "hors de portée : 1 case, portée 0" }]);

  // Ni arme ni mains nues : le jet se fait « sans arme », dé au choix, sans dégâts à prêter.
  const sansRien = pjEssai((champs) => {
    champs.armes = [];
    champs.armePretee = null;
    champs.capacites = champs.capacites.filter((une) => une.groupe.genre !== "arme" && une.nom !== "Taloche");
  });
  const nu = contre(sansRien);
  const sansArme = jouer(nu, capacite(nu, "pj1", "Flambage"), regler("jet_prete", true), viser("adv2"), regler("caracteristiques", ["sens"]));
  assert.equal(gesteEnCours(sansArme).armePretee, null);
  assert.deepEqual(offre(jouer(sansArme, d8(8), d8(1))).degats.bases, ["aucun"]);
});

test("le jet prêté d'un adversaire : sa première arme, sans avantage de maîtrise pour le PJ ; « sans arme » pour celui qui n'en a aucune", () => {
  // Humer, une capacité sans jet que sa façon dit hors maîtrise.
  const humeur = adversaireEssai((champs) => {
    champs.capacites.push(capaciteEssai({ nom: "Humer", groupe: CAPACITES, facons: [faconEssai({ desavantage: true })] }));
  });
  const depart = adverse(humeur);
  const prete = jouer(depart, capacite(depart, "adv2", "Humer"), regler("jet_prete", true));
  assert.equal(gesteEnCours(prete).armePretee, 0);
  assert.equal("arme_pretee" in reglages(prete), false, "une seule arme : rien à choisir");
  // C'est Aubépine qui lance sa défense, contre l'attaque du Marmiton ; aucun avantage ne lui vient de la maîtrise.
  const lance = jouer(prete, viser("pj1"), d8(1));
  assert.deepEqual(lance.pile.length, 1, "un échec sans relance : aucune réussite, l'attaque touche, le bilan s'ouvre");
  assert.deepEqual({ genre: gesteEnCours(lance).jet.genre, lanceur: gesteEnCours(lance).jet.lanceur, avantages: gesteEnCours(lance).jet.avantages }, { genre: "defense", lanceur: "pj1", avantages: [] });
  assert.deepEqual(offre(lance).degats.bases, ["aucun", "arme"]);
  // Le Moulinet, lui, est une attaque hors maîtrise : le PJ en tire un avantage, donc une relance.
  const moulinet = jouer(depart, capacite(depart, "adv2", "Moulinet farineux"), viser("pj1"), d8(1));
  assert.deepEqual(offre(moulinet).choix, ["relancer", "garder"]);

  // Sans arme : la Frappe n'est pas une attaque. Elle se joue sans jet, ou par le jet prêté « sans arme ».
  const sansArme = adversaireEssai((champs) => {
    champs.armes = [];
    champs.capacites = [capaciteEssai({ nom: "Frappe", groupe: CAPACITES })];
  });
  const nu = adverse(sansArme);
  const frappe = jouer(nu, capacite(nu, "adv2", "Frappe"));
  assert.equal(gesteEnCours(frappe).mode, "sans_jet");
  const sansJet = jouer(frappe, regler("jet_prete", true));
  assert.deepEqual({ mode: gesteEnCours(sansJet).mode, armePretee: gesteEnCours(sansJet).armePretee }, { mode: "jet_prete", armePretee: null });
  assert.equal("arme_pretee" in reglages(sansJet), false, "« sans arme » ne se choisit pas : il se pose de lui-même");
  refuse(sansJet, regler("arme_pretee", 0), "hors_moment");
  // À portée 0, un seul d20, et les dégâts se saisissent à la main.
  const bilan = jouer(sansJet, viser("pj1"), d8(1));
  assert.deepEqual(offre(bilan).degats.bases, ["aucun"]);
  const saisi = jouer(bilan, { type: "degats", base: "aucun", operations: [{ op: "ajuster", valeur: 4, raison: "Frappe" }], nature: "normaux" }, d20(5));
  assert.equal(gesteEnCours(saisi).moment, "suites", "un seul d20");
  assert.deepEqual(offre(saisi).esquive, { min: 1, max: 4, capacite: 7 });
  const applique = jouer(saisi, APPLIQUER);
  assert.equal(applique.protagonistes.pj1.zones[1].armure, 6);
  assert.equal(derniereLigne(applique), "Marmiton : Frappe contre Aubépine. Aubépine lance sa défense, d8 contre 4 → 1 ✗ : aucune réussite, Aubépine reçoit 4 (à la main : Frappe). Localisation d20 → 5 : torse. Armure 10 → 6.");
  const ecartes = combat(
    [
      { photo: AUBEPINE, case: "D4" },
      { photo: sansArme, case: "E4" },
    ],
    { quiCommence: "adv" },
  );
  assert.deepEqual(cibles(jouer(ecartes, capacite(ecartes, "adv2", "Frappe"), regler("jet_prete", true))), [{ id: "pj1", possible: false, raison: "hors de portée : 1 case, portée 0" }]);
});
