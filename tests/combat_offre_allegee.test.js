// Contrôles de l'offre allégée (SPECIFICATION.md, § 17 et § 11, domaine
// « Combat » ; complément du groupe 2, § 5.3 ; contrat du groupe 2, § 4.2) :
// js/combat/offre.js.
//
// Au groupe 1, juger l'événement « capacite » passait par les boutons de qui
// joue : chacune de ses façons était jugée, à chaque événement, et c'est ce
// qui bornait le combat à 5 000 événements. Au groupe 2, l'offre ne juge plus
// que la façon demandée. Son verdict ne doit pas changer, branche pour
// branche : ce fichier recopie le jugement du groupe 1 (et les boutons dont
// il dépendait, une façon d'office par capacité d'un PJ), et compare les deux,
// objet pour objet, sur chaque état du combat de référence
// (tests/outils/combat_reference.js), puis sur des photographies piégées,
// pour chaque protagoniste (et un inconnu) et chaque indice de capacité et de
// façon, de −1 à la longueur de sa liste. Le banc, hors des contrôles, fait de
// même sur l'annexe A et le classeur réel.
//
// Chaque branche du jugement est vue : le contrôle compte les verdicts de
// chaque sorte, et exige qu'aucune ne manque.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validerEvenement } from "../js/combat/forme.js";
import { appliquer, gesteEnCours, ouvrirCombat } from "../js/combat/moteur.js";
import { accepte, candidats, faconsDe } from "../js/combat/offre.js";
import { ROLES_SANS_BOUTON } from "../js/combat/regles.js";
import { campDe, courantDe, photoDe } from "../js/combat/valeurs.js";
import { scenario } from "./outils/combat_reference.js";
import { adversaireEssai, aubepineEssai, capaciteEssai, chefDePartieEssai, faconEssai, marmitonDeCorveeEssai, miseEnPlaceEssai, pjEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

// ─── Le jugement du groupe 1, recopié ───────────────────────────────────────
//
// Recopié de js/combat/offre.js au commit a61a7e7 (la fin du groupe 1), sans
// rien y changer que les noms : il ne sert qu'à juger le jugement neuf.

const OUI = { ok: true };
const refus = (code, message) => ({ ok: false, code, message });

function faconDOfficeDuGroupe1(capacite, jugees) {
  const jouables = jugees.filter(({ facon }) => !capacite.facons[facon].passif);
  const puissance = ({ facon }) => capacite.facons[facon].puissance;
  const payables = jouables.filter(({ actif }) => actif);
  if (payables.length > 0) return payables.reduce((haute, jugee) => (puissance(jugee) > puissance(haute) ? jugee : haute));
  return jouables.reduce((basse, jugee) => (puissance(jugee) < puissance(basse) ? jugee : basse));
}

function boutonsDuGroupe1(etat, id) {
  const photo = photoDe(etat, id);
  if (photo === null) return [];
  const parFacon = campDe(etat, id) !== "pj";
  const liste = [];
  photo.capacites.forEach((capacite, indice) => {
    if (ROLES_SANS_BOUTON.includes(capacite.role)) return;
    if (capacite.facons.length === 0) {
      liste.push({ capacite: indice, facon: null, actif: false, raison: capacite.inactive ?? "absente de la banque" });
      return;
    }
    if (capacite.facons.every((facon) => facon.passif)) return;
    const jugees = faconsDe(etat, id, indice);
    for (const { facon, actif, raison } of parFacon ? jugees : [faconDOfficeDuGroupe1(capacite, jugees)]) {
      liste.push({ capacite: indice, facon, actif, raison });
    }
  });
  return liste;
}

function jugementDuGroupe1(etat, { qui, capacite, facon }) {
  if (courantDe(etat, qui) === null) return refus("hors_bornes", "Ce protagoniste n'est pas dans le combat.");
  if (!candidats(etat).includes(qui)) return refus("interdit", "Ce protagoniste ne peut pas jouer à cet instant.");
  const bouton = boutonsDuGroupe1(etat, qui).find((un) => un.capacite === capacite);
  if (!bouton) return refus("hors_bornes", "Cette capacité ne se joue pas.");
  if (bouton.facon === null) return refus("interdit", bouton.raison);
  const jugee = faconsDe(etat, qui, capacite)[facon];
  if (!jugee) return refus("hors_bornes", "Cette capacité ne se joue pas de cette façon.");
  return jugee.actif ? OUI : refus("interdit", jugee.raison);
}

// La porte d'avant les juges, qui n'a pas changé : la forme, puis la colonne
// (« capacite » ne s'offre que sans geste ou en préparation, combat lancé).
// Le plafond n'est jamais atteint ici.
function avantLesJuges(etat, evenement) {
  if (validerEvenement(evenement).erreur) return "forme";
  const geste = gesteEnCours(etat);
  return etat.phase === "combat" && (geste === null || geste.moment === "preparation") ? null : "hors_moment";
}

// ─── La comparaison ─────────────────────────────────────────────────────────

/**
 * Compare les deux jugements pour chaque protagoniste de l'état (et un
 * inconnu), chaque capacité de −1 à sa longueur, et chaque façon de −1 à sa
 * longueur. Rend le compte des verdicts, par sorte.
 */
function comparer(etat, quoi, sortes) {
  for (const qui of [...etat.ordre, "pj99"]) {
    const capacites = photoDe(etat, qui)?.capacites ?? [];
    for (let capacite = -1; capacite <= capacites.length; capacite += 1) {
      const facons = capacites[capacite]?.facons.length ?? 1;
      for (let facon = -1; facon <= facons; facon += 1) {
        const evenement = { type: "capacite", qui, capacite, facon };
        const neuf = accepte(etat, evenement);
        const porte = avantLesJuges(etat, evenement);
        if (porte !== null) {
          assert.equal(neuf.code, porte, `${quoi} : ${JSON.stringify(evenement)}`);
          sortes.set(porte, (sortes.get(porte) ?? 0) + 1);
          continue;
        }
        const ancien = jugementDuGroupe1(etat, validerEvenement(evenement).evenement);
        assert.deepEqual(neuf, ancien, `${quoi} : ${JSON.stringify(evenement)}`);
        const sorte = neuf.ok ? "oui" : `${neuf.code} : ${neuf.message}`;
        sortes.set(sorte, (sortes.get(sorte) ?? 0) + 1);
      }
    }
  }
}

const PHOTOS_DE_REFERENCE = { "Aubépine Crèmebrûlée": aubepineEssai(), "Chef de partie": chefDePartieEssai(), "Marmiton de corvée": marmitonDeCorveeEssai() };

test("l'offre allégée rend, à chaque état du combat de référence, le verdict du groupe 1, objet pour objet", () => {
  const { contenu } = versContenu(scenario, PHOTOS_DE_REFERENCE);
  let etat = ouvrirCombat(contenu.miseEnPlace);
  const sortes = new Map();
  comparer(etat, "la préparation", sortes);
  for (const [rang, evenement] of contenu.evenements.entries()) {
    etat = appliquer(etat, evenement).etat;
    comparer(etat, `l'état ${rang + 1}`, sortes);
  }
  assert.equal(etat.phase, "termine");
  // Chaque branche du jugement est vue.
  for (const sorte of [
    "oui",
    "forme",
    "hors_moment",
    "hors_bornes : Ce protagoniste n'est pas dans le combat.",
    "interdit : Ce protagoniste ne peut pas jouer à cet instant.",
    "hors_bornes : Cette capacité ne se joue pas.",
    "hors_bornes : Cette capacité ne se joue pas de cette façon.",
  ]) {
    assert.ok(sortes.has(sorte), `aucun verdict « ${sorte} »`);
  }
  assert.ok([...sortes.keys()].some((sorte) => sorte.startsWith("interdit : Pas assez de souffle")), "une façon qu'on ne peut pas payer");
});

// ─── Les photographies piégées ──────────────────────────────────────────────

const OBJET = { genre: "objet", titre: "Écumoire" };
const CAPACITES = { genre: "capacites", titre: "Capacités" };

// Un PJ qui porte tout ce que le jugement distingue : une capacité absente de
// la banque, un rôle tenu par le simulateur, une capacité toute passive, une
// façon passive parmi d'autres, un déplacement à la puissance 0, un coût
// illisible, un lien qu'il ne peut pas payer.
const PIEGEE = pjEssai((champs) => {
  champs.liens = [{ nom: "Grand Four", points: 0 }];
  champs.capacites.push(
    capaciteEssai({ nom: "Recette perdue", groupe: OBJET, inactive: "absente de la banque" }),
    capaciteEssai({ nom: "Guetter", role: "attendre" }),
    capaciteEssai({ nom: "Lever le couvercle", role: "jet_de_defense" }),
    capaciteEssai({ nom: "Costaud", groupe: CAPACITES, facons: [faconEssai({ passif: true, elements: ["Passif"] }), faconEssai({ puissance: 1, passif: true, elements: ["Passif"] })] }),
    capaciteEssai({ nom: "Tache d'encre", groupe: OBJET, facons: [faconEssai({ cout: null })] }),
  );
  // Flambage : la [1] passive, la [2] se joue.
  champs.capacites[2].facons[0].passif = true;
  // Pas chassé à la puissance 0 : aucune case à sa portée.
  Object.assign(champs.capacites[4], { niveau: 0, evolue: false, facons: [faconEssai({ puissance: 0, description: "Se déplace de 0 case." })] });
});
// Un adversaire à deux armes, qui porte lui aussi une capacité absente et un rôle tenu par le simulateur.
const ADVERSAIRE_PIEGE = adversaireEssai((champs) => {
  champs.armes.push({ nom: "Louche", libelle: "Louche", poids: null, faces: null, caracteristiques: null, degats: [1, 2, 3], portee: 2, locMultiple: 1, mainsNues: false });
  champs.capacites[0].facons.push(faconEssai({ arme: 1, libelle: "Louche", attaque: true, degats: [1, 2, 3], portee: 2 }));
  champs.capacites.push(capaciteEssai({ nom: "Recette perdue", groupe: CAPACITES, inactive: "absente de la banque" }), capaciteEssai({ nom: "Lever le pied", role: "passer_son_tour" }));
});

function jouer(etat, ...evenements) {
  let courant = etat;
  for (const evenement of evenements) {
    const rendu = appliquer(courant, evenement);
    assert.equal(rendu.refus, undefined, `${JSON.stringify(evenement)} est refusé : ${rendu.refus?.message}`);
    courant = rendu.etat;
  }
  return courant;
}

test("l'offre allégée rend le verdict du groupe 1 sur des photographies piégées, à chaque moment où « capacite » se juge", () => {
  const mep = (options) => miseEnPlaceEssai([PIEGEE, ADVERSAIRE_PIEGE, pjEssai()].map((photo) => ({ photo, case: "D4" })), options);
  const lance = jouer(ouvrirCombat(mep()), { type: "lancer", le: "2026-10-12T21:30" });
  const frappe = { type: "capacite", qui: "pj1", capacite: 0, facon: 0 };
  // Depuis le lot 4.3, un manqué attend « Appliquer » pour finir.
  const manque = [{ type: "regler", champ: "cible", valeur: "adv2" }, { type: "de", faces: 8, valeurs: [1] }, { type: "appliquer" }];
  const etats = {
    "le tour des PJ": lance,
    "un geste en préparation": jouer(lance, frappe, { type: "regler", champ: "cible", valeur: "adv2" }),
    "une action dépensée": jouer(lance, frappe, ...manque),
    "plus d'action": jouer(lance, frappe, ...manque, frappe, ...manque),
    "un geste payé": jouer(lance, frappe, { type: "regler", champ: "cible", valeur: "adv2" }, { type: "de", faces: 8, valeurs: [8] }),
    "le tour des adversaires": jouer(lance, { type: "fin_de_tour" }),
    "un essoufflé": jouer(ouvrirCombat(miseEnPlaceEssai([pjEssai((champs) => (champs.souffle = 4)), ADVERSAIRE_PIEGE].map((photo) => ({ photo, case: "D4" })))), { type: "lancer", le: "2026-10-12T21:30" }),
  };
  const sortes = new Map();
  for (const [quoi, etat] of Object.entries(etats)) comparer(etat, quoi, sortes);
  for (const sorte of [
    "oui",
    "forme",
    "hors_moment",
    "hors_bornes : Ce protagoniste n'est pas dans le combat.",
    "interdit : Ce protagoniste ne peut pas jouer à cet instant.",
    "hors_bornes : Cette capacité ne se joue pas.",
    "hors_bornes : Cette capacité ne se joue pas de cette façon.",
    "interdit : absente de la banque",
    "interdit : Passif à cette puissance.",
    "interdit : aucune case à sa portée",
    "interdit : coût illisible dans la banque",
    "interdit : Pas assez de lien : 1 demandé, 0 restant.",
    "interdit : Pas assez de souffle : 5 demandés, 4 restants.",
  ]) {
    assert.ok(sortes.has(sorte), `aucun verdict « ${sorte} »`);
  }

  // Les branches, vues une à une sur le PJ piégé, au tour des PJ.
  const indice = (nom) => PIEGEE.valeurs.capacites.findIndex((une) => une.nom === nom);
  const juger = (nom, facon = 0) => accepte(lance, { type: "capacite", qui: "pj1", capacite: indice(nom), facon });
  // Attendre a sa ligne depuis le lot 4.3 (contrat de la vague 1, § 6.2) : il se joue.
  assert.deepEqual(juger("Guetter"), OUI, "attendre se joue");
  assert.deepEqual(juger("Lever le couvercle"), refus("hors_bornes", "Cette capacité ne se joue pas."), "un rôle tenu par le simulateur");
  assert.deepEqual(juger("Costaud"), refus("hors_bornes", "Cette capacité ne se joue pas."), "toute passive");
  assert.deepEqual(juger("Recette perdue"), refus("interdit", "absente de la banque"));
  assert.deepEqual(juger("Flambage", 0), refus("interdit", "Passif à cette puissance."), "une passive parmi d'autres");
  assert.deepEqual(juger("Flambage", 1), OUI);
  assert.deepEqual(juger("Flambage", 2), refus("hors_bornes", "Cette capacité ne se joue pas de cette façon."));
  assert.deepEqual(juger("Pas chassé"), refus("interdit", "aucune case à sa portée"));
  assert.deepEqual(juger("Tache d'encre"), refus("interdit", "coût illisible dans la banque"));
  assert.deepEqual(juger("Fournaise"), refus("interdit", "Pas assez de lien : 1 demandé, 0 restant."));
  assert.deepEqual(accepte(lance, { type: "capacite", qui: "pj1", capacite: PIEGEE.valeurs.capacites.length, facon: 0 }), refus("hors_bornes", "Cette capacité ne se joue pas."));
});
