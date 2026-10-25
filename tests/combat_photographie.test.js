// Contrôles des photographies du simulateur de combat (SPECIFICATION.md, § 17
// et § 11, domaine « Combat ») : ce que js/combat/photographie.js fige d'un
// personnage et d'un adversaire à leur ajout, et qui ne s'ajoute pas.
//
// La démonstration d'abord, telle qu'elle est publiée : Aubépine, et ses cinq
// adversaires, dont les valeurs de départ sont écrites ici à la main (ce sont
// celles du combat de référence). Les cas que la démonstration n'a pas
// (loc_multiple, des dégâts propres, un coût illisible, deux armes de même
// nom…) se fabriquent en mémoire, sur une copie retouchée de sa banque.
// Chaque règle se voit dans les deux sens : le cas qui la déclenche, et son
// voisin qui ne la déclenche pas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ecrireTypes } from "../js/adversaire/carte.js";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { MOT_DE_PASSE_DEMO } from "../js/banque/chargement.js";
import { validerPhoto } from "../js/combat/forme.js";
import { capaciteDeRole, photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { BORNES_PHOTO, ROLES } from "../js/combat/regles.js";
import { tableDesRoles } from "../js/combat/roles.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter, lirePersonnage } from "../js/personnage/format.js";
import { ouvrirAvecMotDePasse } from "../js/securite/chiffrement.js";
import { personnageEssai } from "./outils/personnage_essai.js";
import { aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai } from "./outils/photographies_essai.js";

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");
const { banque: BANQUE } = await ouvrirAvecMotDePasse(JSON.parse(lire("essais/banque_demo.chiffree.json")), MOT_DE_PASSE_DEMO);
const AUBEPINE = lirePersonnage(lire("essais/personnage_demo.arpenteur.json"), { mode: "demo" }).personnage;

// Une banque, et ce qu'il faut pour la photographier : la démonstration, ou
// une copie retouchée en mémoire.
async function monde(retoucher = null, mode = "demo") {
  const banque = structuredClone(BANQUE);
  retoucher?.(banque);
  const index = indexerCreation(banque);
  return { banque, index, roles: await tableDesRoles(banque, mode), adversaires: indexerAdversaires(banque, index) };
}
const DEMO = await monde();

const pj = (m, personnage = AUBEPINE) => photographierPersonnage(m.banque, personnage, { index: m.index, roles: m.roles });
const adv = (m, nom) => photographierAdversaire(m.adversaires, nom, { banque: m.banque, roles: m.roles });
const valeursDe = (resultat) => {
  assert.equal(resultat.refus, undefined, resultat.refus);
  return resultat.photo.valeurs;
};
const blocDe = (banque, nom) => banque.blocs.find((bloc) => bloc.nom === nom);
const capaciteDe = (banque, nom) => banque.capacites.find((capacite) => capacite.nom === nom);
const laCapacite = (valeurs, nom) => {
  const trouvee = valeurs.capacites.find((capacite) => capacite.nom === nom);
  assert.ok(trouvee, `« ${nom} » est photographiée`);
  return trouvee;
};
const noms = (valeurs) => valeurs.capacites.map((capacite) => capacite.nom);
const groupes = (valeurs) => valeurs.capacites.map((capacite) => `${capacite.groupe.genre} : ${capacite.groupe.titre}`).filter((titre, i, tous) => titre !== tous[i - 1]);
const zones = (valeurs) => valeurs.zones.map((zone) => [zone.nom, zone.debut, zone.fin, zone.armure, zone.resistance]);
// Un caractère de contrôle qui n'est ni un retour à la ligne ni une tabulation, fabriqué par son code.
const SONNETTE = String.fromCodePoint(7);
const gelee = (valeur) => valeur === null || typeof valeur !== "object" || (Object.isFrozen(valeur) && Object.values(valeur).every(gelee));

// Un adversaire fabriqué, sans type : une seule zone, pour ne rien devoir à
// la grille des personnages.
const ligneAdversaire = (nom, champs = {}) => ({ nom, types: "", localisation: "Corps(2)", actions: "1", souffle: "3", attaque: "2", defense: "3", equipement: "", capacites: "", ...champs });

// ─── Aubépine, telle que la démonstration la publie ─────────────────────────

test("Aubépine — ses valeurs de départ sont celles du combat de référence", () => {
  const { photo } = pj(DEMO);
  const v = photo.valeurs;
  assert.equal(photo.camp, "pj");
  assert.equal(v.identifiant, "demo-aubepine-0000000001");
  assert.equal(v.nom, "Aubépine Crèmebrûlée");
  assert.equal(v.sousTitre, "Marmiton · Saucier");
  assert.deepEqual([v.actions, v.souffle, v.corps, v.souffleAbsent, v.faceContre], [2, 10, 10, false, 20]);
  assert.deepEqual(zones(v), [
    ["Tête", 1, 1, 6, 5],
    ["Torse", 2, 11, 30, 5],
    ["Jambe gauche", 12, 13, 10, 5],
    ["Jambe droite", 14, 15, 10, 5],
    ["Bras gauche", 16, 17, 10, 5],
    ["Bras droit", 18, 19, 10, 5],
  ]);
  assert.deepEqual(v.zones.map((zone) => [zone.code, zone.ecrit]), [["tete", "Tête"], ["torse", "Torse"], ["jambe_gauche", "Jambe gauche"], ["jambe_droite", "Jambe droite"], ["bras_gauche", "Bras gauche"], ["bras_droit", "Bras droit"]]);
  assert.deepEqual(v.caracteristiques, { force: 4, agilite: 5, precision: 5, sens: 3, culture_neruvienne: 4, savoir_sauvage: 3, parole: 4, empathie: 4, creativite: 4 });
  assert.deepEqual([v.attaque, v.defense], [null, null], "un personnage lance des dés : il n'a pas les deux nombres d'un adversaire");
  // Trois pièces agiles et une précise : le dé de l'agile, et les types mêlés ;
  // l'agile et la précise donnent toutes deux un d8 : elles sont à égalité.
  assert.deepEqual(v.deDefense, { faces: 8, type: "agile", caracteristiques: ["agilite", "creativite"], meles: true, egalite: ["agile", "precise"] });
  assert.deepEqual(v.armes, [
    { nom: "Couteau d'office", libelle: "Couteau d'office", poids: "precise", faces: 10, caracteristiques: ["precision", "agilite"], degats: [3, 8, 20], portee: 1, locMultiple: 1, mainsNues: false },
    { nom: "Taloche", libelle: "Taloche", poids: null, faces: null, caracteristiques: null, degats: [2, 4, 8], portee: 0, locMultiple: 1, mainsNues: true },
  ]);
  assert.equal(v.armePretee, 0, "le jet prêté est celui de l'arme tenue");
  assert.deepEqual(v.bouclier, { nom: "Couvercle de marmite", defense: 8 });
  assert.deepEqual(v.liens, [{ nom: "Grand Four", points: 1 }]);
  assert.deepEqual(photo.avertissements, []);
  assert.equal(photo.publiee_le, BANQUE.publiee_le);
});

test("Aubépine — ses capacités, leur groupe, leur niveau et leur rôle, dans l'ordre du panneau d'action", () => {
  const v = valeursDe(pj(DEMO));
  const COUTEAU = ["arme", "Couteau d'office (précise)"];
  const SAUCIER = ["archetype", "Saucier"];
  const MARMITON = ["espece", "Marmiton"];
  const FOUR = ["primordial", "Grand Four"];
  const GESTES = ["base", "Gestes de cuisine"];
  // nom, rôle, niveau, évolue, groupe, jauge de lien, puissances jouables.
  const ATTENDU = [
    ["Frappe", null, 0, false, COUTEAU, null, [0]],
    ["Émincer", null, 0, false, COUTEAU, null, [0]],
    ["Réduction", "degrossir", 1, true, SAUCIER, null, [1]],
    ["Flambage", null, 2, true, SAUCIER, null, [1, 2]],
    ["Dressage minute", null, 0, false, SAUCIER, null, [0]],
    ["Maîtrise de l'agile", null, 1, true, SAUCIER, null, [1]],
    ["Vif", "bonus_agilite", 1, true, MARMITON, null, [1]],
    ["Nez fin", null, 0, false, MARMITON, null, [0]],
    ["Solo du chef", "seul_sur_sa_case", 1, true, ["style", "Style de combat"], null, [1]],
    ["Fournaise", null, 1, true, FOUR, 0, [1]],
    ["Cendre", null, 0, false, FOUR, 0, [0]],
    ["Se couvrir", null, 0, false, ["objet", "Couvercle de marmite"], null, [0]],
    ["Boire le bouillon", null, 0, false, ["objet", "Bouillon revigorant"], null, [0]],
    ["Pas chassé", "deplacement", 1, true, GESTES, null, [1]],
    ["Goûter", "jet_de_caracteristique", 0, false, GESTES, null, [0]],
    ["Taloche", "mains_nues", 1, true, GESTES, null, [1]],
    ["Pas de côté", "esquive", 0, false, GESTES, null, [0]],
    ["Guetter", "attendre", 0, false, GESTES, null, [0]],
  ];
  assert.deepEqual(
    v.capacites.map((c) => [c.nom, c.role, c.niveau, c.evolue, [c.groupe.genre, c.groupe.titre], c.lien, c.facons.map((f) => f.puissance)]),
    ATTENDU,
  );
  assert.ok(v.capacites.every((c) => c.inactive === null));
  // Les trois passifs câblés d'Aubépine, désignés par leur indice.
  assert.deepEqual(
    v.passifs.map((passif) => [v.capacites[passif.capacite].nom, passif.role, passif.niveau]),
    [["Réduction", "degrossir", 1], ["Vif", "bonus_agilite", 1], ["Solo du chef", "seul_sur_sa_case", 1]],
  );
  assert.ok(v.capacites.every((c) => c.role === null || ROLES.includes(c.role)));
});

test("Aubépine — chaque façon : coût, description, éléments, attaque, dégâts, portée, désavantage", () => {
  const v = valeursDe(pj(DEMO));
  const facon = (nom, k = 0) => laCapacite(v, nom).facons[k];
  // Son couteau est précis, et elle n'a que la maîtrise de l'agile : ses deux
  // capacités sont hors maîtrise, et le couteau en est la cause.
  const COUTEAU_PRECIS = { origine: "Couteau d'office", poids: "precise" };
  assert.deepEqual(facon("Frappe"), {
    puissance: 0, arme: 0, libelle: null, cout: { souffle: 0, lien: 0 }, description: "Une attaque qui inflige 3/8/20.", elements: [],
    passif: false, intervention: false, attaque: true, degats: [3, 8, 20], portee: 1, locMultiple: 1, desavantage: true, maitrise: COUTEAU_PRECIS,
  });
  assert.deepEqual(facon("Émincer"), {
    puissance: 0, arme: 0, libelle: null, cout: { souffle: 4, lien: 0 }, description: "Une réussite de plus si vous en avez une.", elements: [],
    passif: false, intervention: false, attaque: true, degats: [3, 8, 20], portee: 1, locMultiple: 1, desavantage: true, maitrise: COUTEAU_PRECIS,
  });
  // L'attaque à mains nues : les dégâts que dit sa description à la puissance jouée, sans portée écrite.
  assert.deepEqual(facon("Taloche"), {
    puissance: 1, arme: 1, libelle: null, cout: { souffle: 0, lien: 0 }, description: "Une taloche qui inflige 2/4/8.", elements: ["Dégâts"],
    passif: false, intervention: false, attaque: true, degats: [2, 4, 8], portee: 0, locMultiple: 1, desavantage: false, maitrise: null,
  });
  // Une cause de maîtrise exactement quand la façon porte un désavantage.
  assert.ok(v.capacites.every((c) => c.facons.every((f) => (f.maitrise !== null) === f.desavantage)), "maitrise suit desavantage");
  // Le coût et la description suivent la puissance.
  assert.deepEqual(laCapacite(v, "Flambage").facons.map((f) => [f.puissance, f.cout, f.description, f.attaque]), [
    [1, { souffle: 5, lien: 0 }, "Multiplie les dégâts par 2.", false],
    [2, { souffle: 10, lien: 0 }, "Multiplie les dégâts par 3.", false],
  ]);
  assert.deepEqual([facon("Fournaise").cout, facon("Fournaise").description, facon("Fournaise").degats, facon("Fournaise").portee], [{ souffle: 1, lien: 1 }, "Réchauffe la case.", null, 0]);
  assert.deepEqual(facon("Cendre").cout, { souffle: 2, lien: 1 });
  assert.deepEqual(facon("Pas chassé").cout, { souffle: 0, lien: 0 }, "« N-1 » à la puissance 1");
  assert.equal(facon("Pas chassé").description, "Se déplace de 1 cases.");
  assert.deepEqual([facon("Pas de côté").cout, facon("Pas de côté").intervention, facon("Pas de côté").description], [{ souffle: "X", lien: 0 }, true, "Annulez X dégâts reçus."]);
  assert.equal(facon("Se couvrir").description, "Reportez les dommages sur les 8 points du couvercle.");
  // Passif et Intervention se lisent sur la variante jouée ; une attaque n'est ni l'un ni l'autre.
  const passives = v.capacites.filter((c) => c.facons.some((f) => f.passif)).map((c) => c.nom);
  assert.deepEqual(passives, ["Réduction", "Maîtrise de l'agile", "Vif", "Nez fin", "Solo du chef"]);
  assert.deepEqual(v.capacites.filter((c) => c.facons.some((f) => f.intervention)).map((c) => c.nom), ["Dressage minute", "Pas de côté"]);
  assert.deepEqual(v.capacites.filter((c) => c.facons.some((f) => f.attaque)).map((c) => c.nom), ["Frappe", "Émincer", "Taloche"]);
  assert.deepEqual(facon("Solo du chef").elements, ["Style de combat", "Passif"]);
  assert.deepEqual(facon("Maîtrise de l'agile").elements, ["Maîtrise", "Passif"]);
  // Hors de l'arme tenue et des mains nues, aucune façon ne désigne une arme.
  assert.deepEqual(v.capacites.filter((c) => c.facons.some((f) => f.arme !== null)).map((c) => c.nom), ["Frappe", "Émincer", "Taloche"]);
  assert.ok(v.capacites.every((c) => c.facons.every((f) => f.libelle === null)));
});

test("Aubépine — la photographie est celle que les contrôles du moteur recopient à la main", () => {
  assert.deepEqual(valeursDe(pj(DEMO)), aubepineEssai().valeurs);
});

// ─── Le sac, l'arme tenue, ce qui est porté ─────────────────────────────────

test("le sac — une arme rangée ne donne rien ; tenue, elle donne ses capacités, son dé et ses dégâts", () => {
  const v = valeursDe(pj(DEMO));
  assert.ok(!noms(v).includes("Choc sourd"), "seul le Rouleau de fonte, au sac, la donne");
  assert.equal(noms(v).filter((nom) => nom === "Frappe").length, 1, "une capacité a un seul bouton");

  // Les deux armes échangent leur place.
  const echange = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.equipement[0].place = "sac";
    p.equipement[1].place = "arme";
  })));
  assert.deepEqual(noms(echange).slice(0, 2), ["Frappe", "Choc sourd"]);
  assert.ok(!noms(echange).includes("Émincer"), "le couteau est au sac");
  assert.deepEqual(laCapacite(echange, "Frappe").groupe, { genre: "arme", titre: "Rouleau de fonte (lourde)" });
  // Force 4 et Précision 5 : d8. Sans maîtrise du lourd, tout est hors maîtrise.
  assert.deepEqual(echange.armes[0], { nom: "Rouleau de fonte", libelle: "Rouleau de fonte", poids: "lourde", faces: 8, caracteristiques: ["force", "precision"], degats: [8, 11, 13], portee: 0, locMultiple: 1, mainsNues: false });
  assert.deepEqual(laCapacite(echange, "Frappe").facons.map((f) => [f.degats, f.portee, f.desavantage, f.description]), [[[8, 11, 13], 0, true, "Une attaque qui inflige 8/11/13."]]);
  assert.deepEqual(laCapacite(echange, "Choc sourd").facons.map((f) => [f.cout, f.attaque, f.desavantage]), [[{ souffle: 2, lien: 0 }, true, true]]);
});

test("le sac — le bouclier ne donne sa capacité qu'équipé ; un consommable la donne où qu'il soit", () => {
  const v = valeursDe(pj(DEMO));
  assert.ok(noms(v).includes("Se couvrir"));
  assert.ok(noms(v).includes("Boire le bouillon"), "le bouillon est au sac, et se boit quand même");
  const range = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.equipement[7].place = "sac";
  })));
  assert.ok(!noms(range).includes("Se couvrir"));
  assert.equal(range.bouclier, null);
  assert.ok(noms(range).includes("Boire le bouillon"));
});

test("le sac — une armure ne donne sa capacité que portée", async () => {
  // Le Plastron de fonte, au sac d'Aubépine, reçoit une capacité.
  const m = await monde((banque) => {
    blocDe(banque, "Plastron de fonte").capacites.push({ forme: "simple", nom: "Boire le bouillon" });
    blocDe(banque, "Bouillon revigorant").capacites = [];
  });
  assert.ok(!noms(valeursDe(pj(m, personnageEssai()))).includes("Boire le bouillon"));
  const porte = valeursDe(pj(m, personnageEssai((p) => {
    p.equipement[3].place = "equipe";
    p.equipement[2].place = "sac";
  })));
  assert.deepEqual(laCapacite(porte, "Boire le bouillon").groupe, { genre: "objet", titre: "Plastron de fonte" });
  // Une armure lourde, sans maîtrise du lourd : la capacité qu'elle donne est hors maîtrise.
  assert.equal(laCapacite(porte, "Boire le bouillon").facons[0].desavantage, true);
});

test("sans arme tenue — les mains nues prêtent leur jet, et leurs dégâts suivent la puissance", () => {
  const sansArme = (modifier) => personnageEssai((p) => {
    p.equipement[0].place = "sac";
    modifier?.(p);
  });
  const v = valeursDe(pj(DEMO, sansArme()));
  assert.deepEqual(v.armes, [{ nom: "Taloche", libelle: "Taloche", poids: null, faces: null, caracteristiques: null, degats: [2, 4, 8], portee: 0, locMultiple: 1, mainsNues: true }]);
  assert.equal(v.armePretee, 0);
  assert.equal(laCapacite(v, "Taloche").facons[0].arme, 0);
  assert.ok(!noms(v).includes("Frappe") && !noms(v).includes("Émincer"));
  assert.equal(groupes(v)[0], "archetype : Saucier", "aucun groupe d'arme");

  // Au niveau 2 : une façon par puissance, et l'entrée « mains nues » prend la plus haute.
  const monte = valeursDe(pj(DEMO, sansArme((p) => {
    p.niveaux = [{ capacite: "Taloche", niveau: 2 }];
  })));
  assert.deepEqual(laCapacite(monte, "Taloche").facons.map((f) => [f.puissance, f.degats, f.description]), [
    [1, [2, 4, 8], "Une taloche qui inflige 2/4/8."],
    [2, [4, 8, 16], "Une taloche qui inflige 4/8/16."],
  ]);
  assert.deepEqual(monte.armes[0].degats, [4, 8, 16]);
});

test("les mains nues tiennent au paramètre degats du bloc de base, pas à un nom", async () => {
  // Sans ce paramètre, la même capacité n'est plus une attaque, et rien ne prête de jet sans arme.
  const m = await monde((banque) => {
    const gestes = blocDe(banque, "Gestes de cuisine");
    gestes.parametres = [];
    gestes.elements = [];
  });
  const v = valeursDe(pj(m, personnageEssai((p) => {
    p.equipement[0].place = "sac";
  })));
  assert.equal(laCapacite(v, "Taloche").role, null);
  assert.equal(laCapacite(v, "Taloche").facons[0].attaque, false);
  assert.deepEqual([v.armes, v.armePretee], [[], null]);
  assert.equal(capaciteDeRole(v, "mains_nues"), null);
});

// ─── Les groupes, les maîtrises, le lien, les puissances ────────────────────

test("l'ordre des groupes — l'arme tenue, l'archétype, l'espèce, le style, la constellation, le primordial, les autres objets, la base", () => {
  assert.deepEqual(groupes(valeursDe(pj(DEMO))), [
    "arme : Couteau d'office (précise)",
    "archetype : Saucier",
    "espece : Marmiton",
    "style : Style de combat",
    "primordial : Grand Four",
    "objet : Couvercle de marmite",
    "objet : Bouillon revigorant",
    "base : Gestes de cuisine",
  ]);
  // Une constellation qui donne une capacité prend sa place, entre le style et le primordial.
  const v = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.constellation = { nom: "Constellation du Chaudron", choix: [], obtention: "tirage", tirages: 1 };
  })));
  assert.deepEqual(groupes(v).slice(3, 6), ["style : Style de combat", "constellation : Constellation du Chaudron", "primordial : Grand Four"]);
  assert.deepEqual(laCapacite(v, "Bouillonnement").facons.map((f) => f.cout), [{ souffle: 2, lien: 0 }]);
});

test("les maîtrises — le désavantage tient au poids de l'objet, à la position dans son bloc et au niveau de la maîtrise", () => {
  // La Spatule souple est agile : Frappe est sa première capacité, Moulinet farineux sa deuxième.
  const spatule = (modifier) => personnageEssai((p) => {
    p.equipement[0] = { nom: "Spatule souple", choix: [], qualite: "2", place: "arme" };
    modifier?.(p);
  });
  const desavantages = (v) => ["Frappe", "Moulinet farineux"].map((nom) => laCapacite(v, nom).facons.map((f) => f.desavantage));
  // Maîtrise de l'agile au niveau 1 : la première capacité seulement.
  assert.deepEqual(desavantages(valeursDe(pj(DEMO, spatule()))), [[false], [true]]);
  // Au niveau 2 : les deux.
  assert.deepEqual(desavantages(valeursDe(pj(DEMO, spatule((p) => {
    p.niveaux = [{ capacite: "Maîtrise de l'agile", niveau: 2 }];
  })))), [[false], [false]]);
  // Avec la maîtrise du lourd à la place : aucune.
  assert.deepEqual(desavantages(valeursDe(pj(DEMO, spatule((p) => {
    p.archetype.choix = ["Solo du chef", "Maîtrise du lourd"];
  })))), [[true], [true]]);
  // Un bloc sans poids ne gêne jamais.
  const v = valeursDe(pj(DEMO));
  assert.ok(v.capacites.filter((c) => c.groupe.genre !== "arme").every((c) => c.facons.every((f) => f.desavantage === false)));
});

// Relecture de fin de groupe (lot 4) : les rangs de maîtrise se lisaient sur
// toutes les capacités de la fiche, celles d'une arme rangée au sac comprises.
test("les maîtrises — seule compte celle qu'une origine valable donne : celle d'une arme rangée au sac ne lève rien", async () => {
  // Aubépine tient la Spatule souple, agile ; son archétype lui donne la maîtrise du lourd, non celle de l'agile.
  const spatule = (modifier) => personnageEssai((p) => {
    p.equipement[0] = { nom: "Spatule souple", choix: [], qualite: "2", place: "arme" };
    p.archetype.choix = ["Solo du chef", "Maîtrise du lourd"];
    modifier?.(p);
  });
  const desavantages = (v) => ["Frappe", "Moulinet farineux"].map((nom) => laCapacite(v, nom).facons.map((f) => f.desavantage));
  const donnePar = (objet) => monde((banque) => {
    blocDe(banque, objet).capacites.push({ forme: "simple", nom: "Maîtrise de l'agile" });
  });

  // Le Rouleau de fonte, rangé au sac, la donne : elle n'est pas photographiée, et ne lève aucun désavantage.
  const auSac = valeursDe(pj(await donnePar("Rouleau de fonte"), spatule()));
  assert.ok(!noms(auSac).includes("Maîtrise de l'agile"));
  assert.deepEqual(desavantages(auSac), [[true], [true]]);
  // Le même rouleau, tenu : sa maîtrise vaut, mais c'est lui l'arme, et il est lourd.
  const tenu = valeursDe(pj(await donnePar("Rouleau de fonte"), personnageEssai((p) => {
    p.equipement[0].place = "sac";
    p.equipement[1].place = "arme";
  })));
  assert.ok(noms(tenu).includes("Maîtrise de l'agile"));
  // La même maîtrise par l'archétype : elle lève le désavantage de la première capacité de la spatule.
  assert.deepEqual(desavantages(valeursDe(pj(DEMO, spatule((p) => {
    p.archetype.choix = ["Solo du chef", "Maîtrise de l'agile"];
  })))), [[false], [true]]);
  // Par un objet qui donne ses capacités où qu'il soit (le bouillon, au sac) : elle compte aussi.
  const bue = valeursDe(pj(await donnePar("Bouillon revigorant"), spatule()));
  assert.ok(noms(bue).includes("Maîtrise de l'agile"));
  assert.deepEqual(desavantages(bue), [[false], [true]]);
});

test("la position compte les groupes au choix et les entrées illisibles du bloc", async () => {
  // Une entrée glissée devant Frappe la fait passer en deuxième position : la maîtrise de niveau 1 ne la couvre plus.
  const spatule = personnageEssai((p) => {
    p.equipement[0] = { nom: "Spatule souple", choix: [], qualite: "2", place: "arme" };
  });
  for (const entree of [{ brut: "( Frappe" }, { forme: "facultatif", options: ["Goûter", "Guetter"] }]) {
    const m = await monde((banque) => {
      blocDe(banque, "Spatule souple").capacites.unshift(entree);
    });
    assert.equal(laCapacite(valeursDe(pj(m, spatule)), "Frappe").facons[0].desavantage, true, JSON.stringify(entree));
  }
  // Une capacité donnée par l'option choisie d'un groupe prend la position de ce groupe : la troisième.
  const m = await monde((banque) => {
    blocDe(banque, "Spatule souple").capacites.push({ forme: "choix", options: ["Émincer", "Choc sourd"] });
  });
  const choisie = (niveau) => valeursDe(pj(m, personnageEssai((p) => {
    p.equipement[0] = { nom: "Spatule souple", choix: ["Choc sourd"], qualite: "2", place: "arme" };
    p.niveaux = niveau > 1 ? [{ capacite: "Maîtrise de l'agile", niveau }] : [];
  })));
  assert.ok(!noms(choisie(3)).includes("Émincer"), "l'option qui n'est pas choisie n'est pas donnée");
  assert.deepEqual([2, 3].map((niveau) => laCapacite(choisie(niveau), "Choc sourd").facons[0].desavantage), [true, false]);
});

test("le lien — la jauge du primordial, et les capacités qui en viennent ; sans capacité de lien, une jauge vide", () => {
  const v = valeursDe(pj(DEMO));
  assert.deepEqual(v.capacites.filter((c) => c.lien !== null).map((c) => [c.nom, v.liens[c.lien].nom]), [["Fournaise", "Grand Four"], ["Cendre", "Grand Four"]]);
  const givre = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.primordial = { nom: "Givre éternel", choix: [] };
  })));
  assert.deepEqual(givre.liens, [{ nom: "Givre éternel", points: 0 }], "la jauge de taille 0 est gardée : c'est l'écran qui ne la montre pas");
  assert.ok(givre.capacites.every((c) => c.lien === null));
});

test("les puissances jouables — de 1 au niveau, là où la banque écrit une variante", async () => {
  const troisieme = (p) => {
    p.niveaux = [{ capacite: "Fournaise", niveau: 3 }];
  };
  const v = valeursDe(pj(DEMO, personnageEssai(troisieme)));
  // La portée vient de l'élément propre de la variante jouée.
  assert.deepEqual(laCapacite(v, "Fournaise").facons.map((f) => [f.puissance, f.cout, f.portee, f.elements]), [
    [1, { souffle: 1, lien: 1 }, 0, []],
    [2, { souffle: 3, lien: 1 }, 1, ["Portée"]],
    [3, { souffle: 7, lien: 1 }, 2, ["Portée"]],
  ]);
  assert.equal(laCapacite(v, "Fournaise").facons[2].description, "Aveugle une cible à 2 cases.");
  // Sans variante de puissance 2 : les puissances 1 et 3.
  const m = await monde((banque) => {
    const fournaise = capaciteDe(banque, "Fournaise");
    fournaise.variantes = fournaise.variantes.filter((variante) => variante.puissance !== "2");
  });
  assert.deepEqual(laCapacite(valeursDe(pj(m, personnageEssai(troisieme))), "Fournaise").facons.map((f) => f.puissance), [1, 3]);
});

// ─── Qui ne s'ajoute pas ────────────────────────────────────────────────────

test("un personnage ne s'ajoute pas — caractéristiques incomplètes, arme tenue sans dé, défense sans dé", async () => {
  assert.deepEqual(pj(DEMO, personnageEssai((p) => {
    p.caracteristiques.force = null;
  })), { refus: "Ses caractéristiques ne sont pas complètes." });
  assert.deepEqual(pj(DEMO, personnageEssai((p) => {
    p.caracteristiques.force = 5;
  })), { refus: "Ses caractéristiques ne sont pas complètes." }, "une somme de 37");

  // Le couteau perd son poids : son dé d'attaque reste vide.
  const sansPoids = await monde((banque) => {
    const couteau = blocDe(banque, "Couteau d'office");
    couteau.elements = couteau.elements.filter((element) => element.nom !== "Précise");
  });
  assert.deepEqual(pj(sansPoids, personnageEssai()), { refus: "Son arme tenue n'a pas de dé." });
  // Rangé au sac, il n'empêche plus rien.
  assert.equal(pj(sansPoids, personnageEssai((p) => {
    p.equipement[0].place = "sac";
  })).refus, undefined);

  // Les quatre pièces portées perdent le leur : aucune ne donne le dé de défense.
  const sansType = await monde((banque) => {
    for (const nom of ["Tablier de cuir", "Guêtres de toile", "Maniques", "Toque renforcée"]) {
      const piece = blocDe(banque, nom);
      piece.elements = piece.elements.filter((element) => element.nom === "Armure");
    }
  });
  assert.deepEqual(pj(sansType, personnageEssai()), { refus: "Sa défense n'a pas de dé." });
  // Sans aucune armure, le dé le plus avantageux des trois : rien n'est refusé.
  const nue = valeursDe(pj(sansType, personnageEssai((p) => {
    for (const rang of [2, 4, 5, 6]) p.equipement[rang].place = "sac";
  })));
  assert.equal(nue.deDefense.meles, false);
  assert.deepEqual(nue.zones.map((zone) => zone.armure), [0, 0, 0, 0, 0, 0]);
});

test("un personnage s'ajoute quand même — les mains nues, « Ce qui manque », un brouillon sans nom", () => {
  // Un choix d'archétype laissé ouvert : la fiche le dit, le combat ne s'y arrête pas.
  const v = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.archetype.choix = ["Maîtrise de l'agile"];
    p.equipement[0].place = "sac";
    p.identite.nom = "   ";
  })));
  assert.ok(!noms(v).includes("Solo du chef"));
  assert.equal(v.nom, "Sans nom");
  assert.equal(v.armes[0].mainsNues, true);
});

// ─── Les rôles ──────────────────────────────────────────────────────────────

test("les rôles — reconnus par le nom, selon le mode ; capaciteDeRole rend l'indice, ou null", async () => {
  const v = valeursDe(pj(DEMO));
  for (const [role, nom] of [["deplacement", "Pas chassé"], ["esquive", "Pas de côté"], ["jet_de_caracteristique", "Goûter"], ["attendre", "Guetter"], ["degrossir", "Réduction"], ["mains_nues", "Taloche"]]) {
    assert.equal(v.capacites[capaciteDeRole(v, role)].nom, nom, role);
  }
  assert.equal(capaciteDeRole(v, "petit"), null);
  assert.equal(capaciteDeRole(v, "bonus_force"), null, "Costaud est d'une autre espèce");
  assert.equal(capaciteDeRole(null, "esquive"), null);

  // En mode réel, aucun nom de la démonstration ne câble rien : seules les mains nues, qui ne tiennent pas à un nom.
  const reel = valeursDe(pj(await monde(null, "reel")));
  assert.deepEqual(reel.capacites.filter((c) => c.role !== null).map((c) => [c.nom, c.role]), [["Taloche", "mains_nues"]]);
  assert.deepEqual(reel.passifs, []);
  // Sans table des rôles, de même.
  const sans = valeursDe(photographierPersonnage(BANQUE, AUBEPINE));
  assert.deepEqual(sans.capacites.filter((c) => c.role !== null).map((c) => c.nom), ["Taloche"]);

  // Le nom seul décide : sans l'élément Passif, Réduction garde son rôle, et n'est plus une façon passive.
  const m = await monde((banque) => {
    capaciteDe(banque, "Réduction").variantes[0].elements = [];
  });
  const reduction = laCapacite(valeursDe(pj(m)), "Réduction");
  assert.deepEqual([reduction.role, reduction.facons[0].passif], ["degrossir", false]);
});

// ─── Les adversaires de la démonstration ────────────────────────────────────

test("le Chef de partie et le Marmiton de corvée — leurs valeurs de départ sont celles du combat de référence", () => {
  const chef = valeursDe(adv(DEMO, "Chef de partie"));
  assert.deepEqual([chef.nom, chef.sousTitre, chef.identifiant], ["Chef de partie", "Commis, Rôtisseur ×1,4", null]);
  assert.deepEqual([chef.actions, chef.souffle, chef.souffleAbsent, chef.corps, chef.attaque, chef.defense, chef.faceContre], [1, 7, false, 10, 5, 7, 1]);
  assert.deepEqual(zones(chef), [["Torse", 2, 11, 38, 5], ["Jambe gauche", 12, 13, 0, 5], ["Jambe droite", 14, 15, 0, 5], ["Bras gauche", 16, 17, 19, 5], ["Bras droit", 18, 19, 19, 5], ["Tête", 20, 20, 6, 5]]);
  assert.deepEqual(chef.zones[2], { nom: "Jambe droite", ecrit: "Jambre droite", code: "jambe_droite", debut: 14, fin: 15, armure: 0, resistance: 5 }, "reconnue à deux lettres près : le nom des personnages, et ce qui est écrit");
  assert.deepEqual(chef.armes, [{ nom: "Spatule souple", libelle: "Spatule souple", poids: "agile", faces: null, caracteristiques: null, degats: [6, 12, 19], portee: 0, locMultiple: 1, mainsNues: false }]);
  assert.deepEqual([chef.caracteristiques, chef.deDefense, chef.armePretee, chef.bouclier, chef.liens, chef.passifs], [null, null, null, null, [], []]);
  const resume = (v) => v.capacites.map((c) => [c.nom, c.role, c.niveau, c.evolue, c.groupe.genre, c.groupe.titre, c.facons.map((f) => [f.puissance, f.arme, f.libelle, f.cout, f.attaque, f.degats, f.portee, f.desavantage, f.maitrise])]);
  const SPATULE = "Spatule souple";
  // Sa maîtrise de l'agile, au rang 3, couvre ses deux capacités de spatule. Il joue Pas chassé à chacune de
  // ses puissances, de 1 à son rang (complément, § 6.1) : [1] gratuit, [2] 1 souffle ; son niveau reste son rang.
  assert.deepEqual(resume(chef), [
    ["Frappe", null, 0, false, "arme", SPATULE, [[0, 0, SPATULE, { souffle: 0, lien: 0 }, true, [6, 12, 19], 0, false, null]]],
    ["Moulinet farineux", null, 1, true, "arme", SPATULE, [[1, 0, SPATULE, { souffle: 5, lien: 0 }, true, [6, 12, 19], 0, false, null]]],
    ["Pas chassé", "deplacement", 2, true, "capacites", "Capacités", [
      [1, null, null, { souffle: 0, lien: 0 }, false, null, 0, false, null],
      [2, null, null, { souffle: 1, lien: 0 }, false, null, 0, false, null],
    ]],
  ]);
  assert.deepEqual(laCapacite(chef, "Pas chassé").facons.map((f) => f.description), ["Se déplace de 1 cases.", "Se déplace de 2 cases."]);
  assert.equal(laCapacite(chef, "Frappe").facons[0].description, "Une attaque qui inflige 6/12/19.");

  const marmiton = valeursDe(adv(DEMO, "Marmiton de corvée"));
  assert.deepEqual([marmiton.nom, marmiton.sousTitre], ["Marmiton de corvée", "Commis, Rôtisseur"]);
  assert.deepEqual([marmiton.actions, marmiton.souffle, marmiton.corps, marmiton.attaque, marmiton.defense], [1, 5, 10, 4, 5]);
  assert.deepEqual(marmiton.zones.map((zone) => zone.armure), [30, 0, 0, 15, 15, 5]);
  // Sa maîtrise, au rang 1, ne couvre que la première capacité de sa spatule, agile, qui est la cause du
  // désavantage de la seconde ; son Pas chassé [1] est gratuit.
  assert.deepEqual(resume(marmiton), [
    ["Frappe", null, 0, false, "arme", SPATULE, [[0, 0, SPATULE, { souffle: 0, lien: 0 }, true, [5, 10, 15], 0, false, null]]],
    ["Moulinet farineux", null, 1, true, "arme", SPATULE, [[1, 0, SPATULE, { souffle: 5, lien: 0 }, true, [5, 10, 15], 0, true, { origine: SPATULE, poids: "agile" }]]],
    ["Pas chassé", "deplacement", 1, true, "capacites", "Capacités", [[1, null, null, { souffle: 0, lien: 0 }, false, null, 0, false, null]]],
  ]);
  // Les maîtrises ne sont pas des capacités ici : leur effet est figé dans le désavantage.
  assert.ok(![...noms(chef), ...noms(marmiton)].includes("Maîtrise de l'agile"));

  assert.deepEqual(chef, chefDePartieEssai().valeurs);
  assert.deepEqual(marmiton, marmitonDeCorveeEssai().valeurs);
});

test("le sous-titre d'un adversaire s'écrit comme sur sa carte", () => {
  for (const nom of DEMO.adversaires.adversaires.keys()) {
    assert.equal(valeursDe(adv(DEMO, nom)).sousTitre, ecrireTypes(DEMO.adversaires.resoudre(DEMO.adversaires.adversaires.get(nom))), nom);
  }
  assert.equal(valeursDe(adv(DEMO, "Homard furieux")).sousTitre, "", "sans type, rien");
});

test("la Mouette chapardeuse et le Plongeur — un souffle absent se dit ; un souffle écrit « aucun » vaut 0 sans être absent", () => {
  const mouette = valeursDe(adv(DEMO, "Mouette chapardeuse"));
  assert.deepEqual([mouette.souffle, mouette.souffleAbsent], [0, true]);
  assert.deepEqual([mouette.actions, mouette.attaque, mouette.defense, mouette.corps], [2, 2, 3, 10]);
  // Ses zones ne sont pas celles des personnages, sauf la tête : le nom écrit, sans code.
  assert.deepEqual(mouette.zones.map((zone) => [zone.nom, zone.ecrit, zone.code, zone.debut, zone.fin, zone.armure]), [
    ["Corps", "Corps", null, 2, 13, 0],
    ["Aile gauche", "Aile gauche", null, 14, 16, 0],
    ["Aile droite", "Aile droite", null, 17, 19, 0],
    ["Tête", "Tête", "tete", 20, 20, 0],
  ]);
  assert.deepEqual(mouette.armes, []);
  // Frappe, citée sans arme et sans dégâts propres, n'est pas une attaque ; Nez fin est passif.
  assert.deepEqual(mouette.capacites.map((c) => [c.nom, c.groupe.genre, c.facons.map((f) => [f.arme, f.attaque, f.degats, f.passif, f.cout])]), [
    ["Frappe", "capacites", [[null, false, null, false, { souffle: 0, lien: 0 }]]],
    ["Nez fin", "capacites", [[null, false, null, true, { souffle: 1, lien: 0 }]]],
  ]);

  const plongeur = valeursDe(adv(DEMO, "Plongeur"));
  assert.deepEqual([plongeur.souffle, plongeur.souffleAbsent], [0, false]);
  assert.deepEqual([plongeur.armes, noms(plongeur)], [[], ["Pas chassé"]]);
  assert.deepEqual(plongeur.zones.map((zone) => zone.armure), [0, 0, 0, 0, 0, 0]);
});

test("le Homard furieux — deux armes : une suite de capacités par arme, et deux façons pour celle que donnent les deux", () => {
  const homard = valeursDe(adv(DEMO, "Homard furieux"));
  assert.deepEqual([homard.actions, homard.souffle, homard.attaque, homard.defense], [2, 4, 6, 7]);
  assert.deepEqual(zones(homard), [["Corps", 2, 11, 30, 5], ["Pince gauche", 12, 14, 30, 5], ["Pince droite", 15, 17, 30, 5], ["Tête", 18, 20, 36, 5]]);
  assert.deepEqual(homard.armes.map((arme) => [arme.libelle, arme.poids, arme.degats, arme.portee, arme.faces]), [
    ["Pinces de homard", null, [4, 8, 12], 0, null],
    ["Couteau d'office", "precise", [3, 8, 20], 1, null],
  ]);
  assert.deepEqual(groupes(homard), ["arme : Pinces de homard", "arme : Couteau d'office"]);
  assert.deepEqual(noms(homard), ["Frappe", "Choc sourd", "Émincer"]);
  // Les pinces n'ont pas de poids : aucun désavantage. Le couteau est précis, et le Homard n'a aucune maîtrise :
  // la cause est l'objet de l'entrée, le couteau.
  const COUTEAU_PRECIS = { origine: "Couteau d'office", poids: "precise" };
  assert.deepEqual(laCapacite(homard, "Frappe").facons.map((f) => [f.arme, f.libelle, f.degats, f.portee, f.desavantage, f.maitrise, f.description]), [
    [0, "Pinces de homard", [4, 8, 12], 0, false, null, "Une attaque qui inflige 4/8/12."],
    [1, "Couteau d'office", [3, 8, 20], 1, true, COUTEAU_PRECIS, "Une attaque qui inflige 3/8/20."],
  ]);
  assert.deepEqual(laCapacite(homard, "Frappe").groupe, { genre: "arme", titre: "Pinces de homard" }, "le groupe de la première");
  assert.deepEqual(laCapacite(homard, "Émincer").facons.map((f) => [f.arme, f.cout, f.desavantage, f.maitrise]), [[1, { souffle: 4, lien: 0 }, true, COUTEAU_PRECIS]]);
});

test("un adversaire ne s'ajoute pas — incomplet, ou sans nombre d'actions ; avec zéro action écrite, il s'ajoute", async () => {
  const m = await monde((banque) => {
    banque.adversaires.push(
      ligneAdversaire("Bernique sans attaque", { attaque: "" }),
      ligneAdversaire("Bernique sans actions", { actions: "" }),
      ligneAdversaire("Bernique immobile", { actions: "aucune" }),
      ligneAdversaire("Bernique entière"),
    );
  });
  assert.match(adv(m, "Bernique sans attaque").refus, /^Ne s'ajoute pas : incomplet/);
  assert.deepEqual(adv(m, "Bernique sans actions"), { refus: "Ne s'ajoute pas : nombre d'actions absent." });
  assert.equal(valeursDe(adv(m, "Bernique immobile")).actions, 0);
  assert.equal(valeursDe(adv(m, "Bernique entière")).actions, 1);
  assert.deepEqual(adv(m, "Bernique introuvable"), { refus: "Cet adversaire n'est plus dans la banque." });
});

// ─── Les cas que la démonstration n'a pas ───────────────────────────────────

test("loc_multiple — lu comme la portée : du bloc, d'un paramètre qui vise la capacité ; absent, un dé", async () => {
  const sansCible = await monde((banque) => {
    blocDe(banque, "Couteau d'office").parametres.push({ nom: "loc_multiple", valeur: "2", cible: null });
  });
  const tout = valeursDe(pj(sansCible));
  assert.deepEqual(["Frappe", "Émincer", "Taloche"].map((nom) => laCapacite(tout, nom).facons[0].locMultiple), [2, 2, 1]);
  assert.deepEqual(tout.armes.map((arme) => arme.locMultiple), [2, 1]);
  // Le Homard : deux dés au couteau, un seul aux pinces.
  const homard = valeursDe(adv(sansCible, "Homard furieux"));
  assert.deepEqual(laCapacite(homard, "Frappe").facons.map((f) => f.locMultiple), [1, 2]);
  assert.deepEqual(homard.armes.map((arme) => arme.locMultiple), [1, 2]);

  const visee = await monde((banque) => {
    blocDe(banque, "Couteau d'office").parametres.push({ nom: "loc_multiple", valeur: "3", cible: "Émincer" });
  });
  const une = valeursDe(pj(visee));
  assert.deepEqual(["Frappe", "Émincer"].map((nom) => laCapacite(une, nom).facons[0].locMultiple), [1, 3]);
  assert.equal(une.armes[0].locMultiple, 1, "l'arme ne transmet rien à toutes");
});

test("un paramètre écrit qui ne se calcule pas, ou sort de ses bornes, prend sa valeur neutre et laisse un avertissement", async () => {
  const m = await monde((banque) => {
    const couteau = blocDe(banque, "Couteau d'office");
    couteau.parametres = [
      { nom: "degats", valeur: "3/8/20", cible: null },
      { nom: "qualite", valeur: "X", cible: null },
      { nom: "portee", valeur: "loin", cible: "Frappe" },
      { nom: "loc_multiple", valeur: "0", cible: "Frappe" },
      { nom: "degats", valeur: "beaucoup", cible: "Émincer" },
    ];
  });
  const { photo } = pj(m);
  const frappe = laCapacite(photo.valeurs, "Frappe").facons[0];
  assert.deepEqual([frappe.portee, frappe.locMultiple, frappe.degats, frappe.attaque], [0, 1, [3, 8, 20], true]);
  // Des dégâts reçus, même illisibles, font une attaque : elle n'en a pas, et se joue quand même.
  const emincer = laCapacite(photo.valeurs, "Émincer").facons[0];
  assert.deepEqual([emincer.degats, emincer.attaque], [null, true]);
  assert.deepEqual(photo.avertissements, [
    "« Frappe » : sa portée, « loin », ne se lit pas ; elle vaut 0.",
    "« Frappe » : son nombre de dés de localisation, « 0 », ne se lit pas ; il vaut 1.",
    "« Émincer » : ses dégâts, « beaucoup », ne se calculent pas ; elle n'en a pas.",
  ]);
  // La démonstration, elle, ne laisse aucun avertissement.
  assert.deepEqual(pj(DEMO).photo.avertissements, []);
});

test("des dégâts propres — une capacité qui porte l'élément Dégâts est une attaque, sans arme", async () => {
  const m = await monde((banque) => {
    banque.capacites.push({ nom: "Coup de bec", variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [{ nom: "Dégâts", valeur: "4/8/12" }, { nom: "Portée", valeur: "3" }], description: "Un coup de bec qui inflige {degats}." }] });
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Coup de bec, Nez fin" }));
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Coup de bec" });
  });
  const goeland = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(laCapacite(goeland, "Coup de bec").facons, [{
    puissance: 0, arme: null, libelle: null, cout: { souffle: 0, lien: 0 }, description: "Un coup de bec qui inflige 4/8/12.", elements: ["Dégâts", "Portée"],
    passif: false, intervention: false, attaque: true, degats: [4, 8, 12], portee: 3, locMultiple: 1, desavantage: false, maitrise: null,
  }]);
  assert.deepEqual(laCapacite(goeland, "Coup de bec").groupe, { genre: "capacites", titre: "Capacités" });
  assert.equal(laCapacite(goeland, "Nez fin").facons[0].attaque, false);
  // Chez un personnage : une attaque que ne donne ni l'arme tenue ni le bloc de base.
  const coup = laCapacite(valeursDe(pj(m)), "Coup de bec");
  assert.deepEqual([coup.groupe.genre, coup.facons[0].arme, coup.facons[0].attaque, coup.facons[0].degats, coup.facons[0].portee], ["archetype", null, true, [4, 8, 12], 3]);
  // Passive, la même capacité n'est plus une attaque.
  const passive = await monde((banque) => {
    banque.capacites.push({ nom: "Coup de bec", variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [{ nom: "Dégâts", valeur: "4/8/12" }, { nom: "Passif" }], description: "" }] });
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Coup de bec" }));
  });
  const facon = laCapacite(valeursDe(adv(passive, "Goéland")), "Coup de bec").facons[0];
  assert.deepEqual([facon.passif, facon.attaque, facon.degats], [true, false, [4, 8, 12]]);
});

test("le coût — négatif, il vaut 0 ; illisible, il est nul ; X reste X", async () => {
  const m = await monde((banque) => {
    capaciteDe(banque, "Pas chassé").variantes[0].cout_souffle = "N-3";
    capaciteDe(banque, "Goûter").variantes[0].cout_souffle = "beaucoup";
    capaciteDe(banque, "Guetter").variantes[0].cout_lien = "?";
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Pas chassé[2], Goûter, Pas de côté, Frappe" }));
  });
  const v = valeursDe(pj(m));
  assert.deepEqual(laCapacite(v, "Pas chassé").facons[0].cout, { souffle: 0, lien: 0 });
  assert.equal(laCapacite(v, "Goûter").facons[0].cout, null);
  assert.equal(laCapacite(v, "Guetter").facons[0].cout, null, "un seul des deux coûts illisible suffit");
  assert.deepEqual(laCapacite(v, "Pas de côté").facons[0].cout, { souffle: "X", lien: 0 });
  const goeland = valeursDe(adv(m, "Goéland"));
  // Pas chassé, au rang 2, se joue à ses deux puissances : « N-3 » y vaut 0 les deux fois, sans descendre sous 0.
  assert.deepEqual(laCapacite(goeland, "Pas chassé").facons.map((f) => [f.puissance, f.cout]), [[1, { souffle: 0, lien: 0 }], [2, { souffle: 0, lien: 0 }]]);
  assert.deepEqual(noms(goeland).map((nom) => laCapacite(goeland, nom).facons[0].cout), [{ souffle: 0, lien: 0 }, null, { souffle: "X", lien: 0 }, { souffle: 0, lien: 0 }]);
  // « N-1 », dans la démonstration, vaut 0 à la puissance 1 et 1 à la puissance 2.
  assert.deepEqual(laCapacite(valeursDe(adv(DEMO, "Chef de partie")), "Pas chassé").facons.map((f) => f.cout), [{ souffle: 0, lien: 0 }, { souffle: 1, lien: 0 }]);
});

test("une capacité à venir — nommée, inactive, sans façon ; une capacité dont la puissance ne se lit pas garde une façon au coût illisible", async () => {
  const m = await monde((banque) => {
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Sauce fantôme" });
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Sauce fantôme, Nez fin" }));
    capaciteDe(banque, "Vif").variantes[0].puissance = "beaucoup";
  });
  const v = valeursDe(pj(m, personnageEssai()));
  assert.deepEqual(laCapacite(v, "Sauce fantôme"), { nom: "Sauce fantôme", role: null, niveau: 0, evolue: false, groupe: { genre: "archetype", titre: "Saucier" }, lien: null, inactive: "absente de la banque", facons: [] });
  assert.deepEqual(laCapacite(valeursDe(adv(m, "Goéland")), "Sauce fantôme"), { nom: "Sauce fantôme", role: null, niveau: 0, evolue: false, groupe: { genre: "capacites", titre: "Capacités" }, lien: null, inactive: "absente de la banque", facons: [] });
  assert.deepEqual(laCapacite(v, "Réduction").inactive, null);
  const vif = laCapacite(v, "Vif");
  assert.deepEqual([vif.inactive, vif.niveau, vif.facons.map((f) => [f.puissance, f.cout])], [null, 1, [[1, null]]]);
});

test("deux armes de même nom — la seconde porte « (2) », et chacune fait sa façon", async () => {
  const m = await monde((banque) => {
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Spatule souple, Spatule souple[3], Couteau d'office" }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(v.armes.map((arme) => [arme.nom, arme.libelle, arme.degats]), [
    ["Spatule souple", "Spatule souple", [5, 10, 15]],
    ["Spatule souple", "Spatule souple (2)", [6, 13, 20]],
    ["Couteau d'office", "Couteau d'office", [3, 8, 20]],
  ]);
  assert.deepEqual(laCapacite(v, "Frappe").facons.map((f) => [f.arme, f.libelle, f.degats]), [
    [0, "Spatule souple", [5, 10, 15]],
    [1, "Spatule souple (2)", [6, 13, 20]],
    [2, "Couteau d'office", [3, 8, 20]],
  ]);
  assert.deepEqual(groupes(v), ["arme : Spatule souple", "arme : Couteau d'office"]);
  // Une seule arme de ce nom : pas de numéro.
  assert.deepEqual(valeursDe(adv(DEMO, "Chef de partie")).armes.map((arme) => arme.libelle), ["Spatule souple"]);
});

test("une capacité qu'une arme donne sans lui donner de dégâts se range sous cette arme ; citée seulement, sous « Capacités »", async () => {
  const m = await monde((banque) => {
    banque.blocs.push({ nom: "Louche creuse", type: "Arme", elements: [{ nom: "Arme" }], capacites: [{ forme: "simple", nom: "Goûter" }], parametres: [], notes: "" });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Couteau d'office, Louche creuse", capacites: "Guetter" }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(v.armes.map((arme) => [arme.libelle, arme.degats]), [["Couteau d'office", [3, 8, 20]], ["Louche creuse", null]]);
  assert.deepEqual(v.capacites.map((c) => [c.nom, c.groupe.genre, c.groupe.titre, c.facons.map((f) => [f.arme, f.attaque])]), [
    ["Frappe", "arme", "Couteau d'office", [[0, true]]],
    ["Émincer", "arme", "Couteau d'office", [[0, true]]],
    ["Goûter", "arme", "Louche creuse", [[null, false]]],
    ["Guetter", "capacites", "Capacités", [[null, false]]],
  ]);
});

test("un objet qui donne des dégâts sans être une arme fait une façon sans arme, au nom de l'objet", async () => {
  const m = await monde((banque) => {
    banque.blocs.push({ nom: "Poivrière", type: "Équipement", elements: [], capacites: [{ forme: "simple", nom: "Goûter" }], parametres: [{ nom: "degats", valeur: "1/2/3", cible: null }], notes: "" });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Poivrière" }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(v.armes, [], "la poivrière n'est pas une arme");
  assert.deepEqual(v.capacites.map((c) => [c.nom, c.groupe, c.facons.map((f) => [f.arme, f.libelle, f.attaque, f.degats])]), [
    ["Goûter", { genre: "capacites", titre: "Capacités" }, [[null, "Poivrière", true, [1, 2, 3]]]],
  ]);
  // Sans ces dégâts, la même capacité n'a ni libellé ni attaque.
  const plongeur = laCapacite(valeursDe(adv(m, "Plongeur")), "Pas chassé").facons[0];
  assert.deepEqual([plongeur.arme, plongeur.libelle, plongeur.attaque], [null, null, false]);
});

test("des dégâts négatifs valent 0, dans les deux camps", async () => {
  const m = await monde((banque) => {
    blocDe(banque, "Couteau d'office").parametres[0].valeur = "1-3/8/20";
  });
  const v = valeursDe(pj(m));
  assert.deepEqual([v.armes[0].degats, laCapacite(v, "Frappe").facons[0].degats], [[0, 8, 20], [0, 8, 20]]);
  const homard = valeursDe(adv(m, "Homard furieux"));
  assert.deepEqual([homard.armes[1].degats, laCapacite(homard, "Frappe").facons.map((f) => f.degats)], [[0, 8, 20], [[4, 8, 12], [0, 8, 20]]]);
});

test("les avertissements — sans doublon, et deux cents au plus : le dernier dit alors combien manquent", async () => {
  const tours = Array.from({ length: 100 }, (_, k) => `Tour de main ${k + 1}`);
  const m = await monde((banque) => {
    const saucier = blocDe(banque, "Saucier");
    for (const nom of tours) {
      banque.capacites.push({ nom, variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [], description: "" }] });
      saucier.capacites.push({ forme: "simple", nom });
      saucier.parametres.push({ nom: "portee", valeur: "loin", cible: nom }, { nom: "loc_multiple", valeur: "peu", cible: nom }, { nom: "degats", valeur: "trop", cible: nom });
    }
  });
  const { photo } = pj(m);
  assert.equal(photo.avertissements.length, BORNES_PHOTO.avertissements);
  assert.equal(photo.avertissements[0], "« Tour de main 1 » : ses dégâts, « trop », ne se calculent pas ; elle n'en a pas.");
  assert.equal(photo.avertissements.at(-1), "Et 101 autres avertissements.");
  assert.equal(new Set(photo.avertissements).size, photo.avertissements.length);
  // Le bouclier dont la défense ne se calcule pas : 0, et c'est dit.
  const couvercle = await monde((banque) => {
    blocDe(banque, "Couvercle de marmite").parametres[0].valeur = "épaisse";
  });
  const sansDefense = pj(couvercle).photo;
  assert.deepEqual(sansDefense.valeurs.bouclier, { nom: "Couvercle de marmite", defense: 0 });
  assert.deepEqual(sansDefense.avertissements, ["« Couvercle de marmite » : sa défense ne se calcule pas ; elle vaut 0."]);
});

// ─── Les textes, la forme, ce qui se garde ──────────────────────────────────

test("les textes — une description garde ses lignes ; un nom à retour de ligne devient une seule ligne, et son rôle se lit avant", async () => {
  const m = await monde((banque) => {
    // « Jet de sel » a, dans le classeur d'essai, une description sur deux lignes.
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Jet de sel" }, { forme: "simple", nom: "Coup\nde torchon" });
    banque.capacites.push({ nom: "Coup\nde torchon", variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [], description: "Claque.\r\n\tDeux fois." + SONNETTE }] });
    capaciteDe(banque, "Pas chassé").nom = "Pas\nchassé";
    blocDe(banque, "Gestes de cuisine").capacites[0].nom = "Pas\nchassé";
    banque.adversaires.push(ligneAdversaire("Goéland\ndu port", { capacites: "Jet de sel" }));
  });
  const v = valeursDe(pj(m));
  assert.equal(laCapacite(v, "Jet de sel").facons[0].description, "Lance du sel à 2 pas.\nPuis recommence.");
  assert.equal(laCapacite(v, "Coup de torchon").facons[0].description, "Claque.\r\n\tDeux fois. ", "les autres caractères de contrôle deviennent une espace");
  assert.deepEqual([laCapacite(v, "Pas chassé").role, laCapacite(v, "Pas chassé").nom], ["deplacement", "Pas chassé"]);
  const goeland = valeursDe(adv(m, "Goéland\ndu port"));
  assert.equal(goeland.nom, "Goéland du port");
  assert.equal(laCapacite(goeland, "Jet de sel").facons[0].description, "Lance du sel à 2 pas.\nPuis recommence.");
  // Rien de ce qui entre au journal ne porte un caractère de contrôle.
  const lignes = [v.nom, goeland.nom, ...[v, goeland].flatMap((valeurs) => valeurs.capacites.flatMap((c) => [c.nom, c.groupe.titre, ...c.facons.flatMap((f) => f.elements)]))];
  for (const ligne of lignes) assert.doesNotMatch(ligne, /\p{Cc}/u, JSON.stringify(ligne));
});

// Un demi-codet isolé (la moitié d'un signe astral, seule), qu'un nom de
// personnage ou une cellule forgée peut porter, devient une espace comme un
// caractère de contrôle : validerPhoto le refuse, et la photographie
// fabriquée passe sa propre forme, qui la juge de même à la relecture
// (relecture du groupe 2, C-15). Un signe astral entier reste. Les
// demi-codets s'écrivent par leur code ; le signe astral est une poêle
// (U+1F373).
test("les textes — un demi-codet isolé devient une espace, dans un nom comme dans une description ; un signe astral entier reste ; la photographie passe validerPhoto", async () => {
  const POELE = String.fromCodePoint(0x1f373);
  const DEMI_CODET = /\p{Cs}/u;
  // Le nom du personnage : un demi-codet de tête au milieu, une poêle entière à la fin.
  const personnage = structuredClone(AUBEPINE);
  personnage.identite.nom = `Aubépine\uD800Crèmebrûlée ${POELE}`;
  assert.equal(valeursDe(pj(DEMO, personnage)).nom, `Aubépine Crèmebrûlée ${POELE}`);
  // Une capacité de la banque nommée et décrite de demi-codets, et un adversaire nommé de même.
  const forgee = await monde((banque) => {
    const jet = capaciteDe(banque, "Jet de sel");
    jet.nom = "Jet\uDC00de sel";
    jet.variantes[0].description = `${jet.variantes[0].description}${POELE}\uDFFF`;
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Jet\uDC00de sel" });
    banque.adversaires.push(ligneAdversaire("Marmiton de corvée\uD800bis", { capacites: "Jet\uDC00de sel" }));
  });
  const v = valeursDe(pj(forgee));
  const marmiton = valeursDe(adv(forgee, "Marmiton de corvée\uD800bis"));
  assert.equal(marmiton.nom, "Marmiton de corvée bis");
  for (const valeurs of [v, marmiton]) {
    assert.equal(laCapacite(valeurs, "Jet de sel").facons[0].description, `Lance du sel à 2 pas.\nPuis recommence.${POELE} `, valeurs.nom);
  }
  // Rien de ce que la photographie écrit ne porte un demi-codet, et elle se relit telle quelle.
  for (const resultat of [pj(DEMO, personnage), pj(forgee), adv(forgee, "Marmiton de corvée\uD800bis")]) {
    const { photo } = resultat;
    const textes = [
      photo.valeurs.nom,
      photo.valeurs.sousTitre,
      ...photo.valeurs.armes.flatMap((arme) => [arme.nom, arme.libelle]),
      ...photo.valeurs.capacites.flatMap((c) => [c.nom, c.groupe.titre, ...c.facons.flatMap((f) => [f.description, ...f.elements])]),
      ...photo.avertissements,
    ];
    for (const texte of textes) assert.doesNotMatch(texte, DEMI_CODET, JSON.stringify(texte));
    const relue = validerPhoto(JSON.parse(JSON.stringify(photo)), { accepter });
    assert.equal(relue.erreur, undefined, relue.erreur);
    assert.deepEqual(relue.photo, photo, `${photo.valeurs.nom} : ce qui s'ajoute se reprend`);
  }
  // Un nom fait seulement de demi-codets est vide une fois nettoyé : il ne
  // s'ajoute pas, et ne donne donc jamais au combat une raison proposée vide.
  const seuls = await monde((banque) => {
    banque.capacites.push({ nom: "\uDC00\uDC01", variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [], description: "" }] });
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "\uDC00\uDC01" });
  });
  assert.match(pj(seuls).refus, /^Ne s'ajoute pas : le nom de la capacité n° \d+ est vide\.$/);
});

test("une description au-delà de sa borne est un refus d'ajout, avec sa phrase ; à la borne, elle passe", async () => {
  const longue = (signes) => (banque) => {
    capaciteDe(banque, "Flambage").variantes[0].description = "a".repeat(signes);
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Flambage" }));
  };
  const trop = await monde(longue(BORNES_PHOTO.texte + 1));
  assert.deepEqual(pj(trop), { refus: "Ne s'ajoute pas : la description de « Flambage » dépasse 4 000 signes." });
  assert.deepEqual(adv(trop, "Goéland"), { refus: "Ne s'ajoute pas : la description de « Flambage » dépasse 4 000 signes." });
  const juste = await monde(longue(BORNES_PHOTO.texte));
  assert.equal(laCapacite(valeursDe(pj(juste)), "Flambage").facons[0].description.length, BORNES_PHOTO.texte);
  assert.equal(adv(juste, "Goéland").refus, undefined);
  // Un nom de capacité vide une fois nettoyé : de même.
  const sansNom = await monde((banque) => {
    banque.capacites.push({ nom: "\n", variantes: [{ puissance: "0", cout_souffle: "", cout_lien: "", elements: [], description: "" }] });
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "\n" });
  });
  assert.match(pj(sansNom).refus, /^Ne s'ajoute pas : le nom de la capacité n° \d+ est vide\.$/);
});

test("toute photographie rendue est gelée, passe par JSON à l'identique, et passe validerPhoto", async () => {
  const fabrique = await monde((banque) => {
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Jet de sel" }, { forme: "simple", nom: "Sauce fantôme" });
    blocDe(banque, "Couteau d'office").parametres.push({ nom: "loc_multiple", valeur: "2", cible: null });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Spatule souple, Spatule souple", capacites: "Jet de sel, Sauce fantôme" }));
  });
  const photos = [
    pj(DEMO),
    pj(DEMO, personnageEssai()),
    pj(fabrique),
    ...[...DEMO.adversaires.adversaires.keys()].map((nom) => adv(DEMO, nom)),
    adv(fabrique, "Goéland"),
  ].map((resultat) => {
    assert.equal(resultat.refus, undefined, resultat.refus);
    return resultat.photo;
  });
  assert.equal(photos.length, 9);
  for (const photo of photos) {
    assert.ok(gelee(photo), `${photo.valeurs.nom} : gelée en profondeur`);
    assert.deepEqual(JSON.parse(JSON.stringify(photo)), photo, `${photo.valeurs.nom} : JSON à l'identique`);
    const relue = validerPhoto(JSON.parse(JSON.stringify(photo)), { accepter });
    assert.equal(relue.erreur, undefined, relue.erreur);
    assert.deepEqual(relue.photo, photo, `${photo.valeurs.nom} : ce qui s'ajoute se reprend`);
    assert.deepEqual(Object.keys(photo), ["camp", "publiee_le", "source", "valeurs", "avertissements"]);
  }
});

test("la source — le personnage entier, tel que lu ; la ligne de l'adversaire, celles de ses types, sa résolution", () => {
  const { photo } = pj(DEMO);
  assert.deepEqual(photo.source, { personnage: AUBEPINE });
  assert.notEqual(photo.source.personnage, AUBEPINE, "une copie : le personnage peut changer ensuite");

  const chef = adv(DEMO, "Chef de partie").photo;
  assert.deepEqual(Object.keys(chef.source), ["ligne", "types", "resolu"]);
  assert.deepEqual(chef.source.ligne, DEMO.banque.adversaires.find((ligne) => ligne.nom === "Chef de partie"));
  assert.ok(chef.source.ligne.brut, "telle que lue, brut compris");
  assert.deepEqual(chef.source.types, DEMO.banque.types_adversaires);
  assert.deepEqual(chef.source.resolu, JSON.parse(JSON.stringify(DEMO.adversaires.resoudre(DEMO.adversaires.adversaires.get("Chef de partie")))));
  assert.deepEqual(adv(DEMO, "Homard furieux").photo.source.types, [], "sans type, aucune ligne de type");
  // La copie passe par JSON : sur la démonstration, la résolution n'y perd rien.
  for (const ligne of DEMO.adversaires.adversaires.values()) {
    const resolu = DEMO.adversaires.resoudre(ligne);
    assert.deepEqual(JSON.parse(JSON.stringify(resolu)), resolu, ligne.nom);
  }
});

test("les valeurs se figent à l'ajout — la banque et le personnage peuvent changer, la photographie non ; un exemplaire, une photographie", async () => {
  const m = await monde();
  const personnage = personnageEssai();
  const aubepine = pj(m, personnage).photo;
  const marmiton = adv(m, "Marmiton de corvée").photo;
  const avant = JSON.stringify([aubepine, marmiton]);
  // La banque est « republiée », le personnage modifié.
  blocDe(m.banque, "Couteau d'office").parametres[0].valeur = "30/80/200";
  blocDe(m.banque, "Spatule souple").parametres[0].valeur = "50/100/150";
  m.banque.adversaires.find((ligne) => ligne.nom === "Marmiton de corvée").types = "";
  m.banque.publiee_le = "2027-01-01T00:00:00+01:00";
  personnage.identite.nom = "Une autre";
  personnage.caracteristiques.force = 2;
  assert.equal(JSON.stringify([aubepine, marmiton]), avant);
  assert.equal(aubepine.publiee_le, BANQUE.publiee_le);
  assert.equal(marmiton.publiee_le, BANQUE.publiee_le);

  const [un, deux] = [adv(DEMO, "Marmiton de corvée").photo, adv(DEMO, "Marmiton de corvée").photo];
  assert.notEqual(un, deux);
  assert.notEqual(un.valeurs, deux.valeurs);
  assert.deepEqual(un, deux);
});

test("la date de la banque — gardée telle quelle ; absente, elle est nulle", async () => {
  const sans = await monde((banque) => {
    delete banque.publiee_le;
  });
  assert.equal(pj(sans).photo.publiee_le, null);
  assert.equal(adv(sans, "Plongeur").photo.publiee_le, null);
  assert.equal(adv(DEMO, "Plongeur").photo.publiee_le, BANQUE.publiee_le);
  assert.equal(photographierAdversaire(DEMO.adversaires, "Plongeur").photo.publiee_le, BANQUE.publiee_le, "à défaut, la banque de la résolution");
});

test("le module — aucun nom de bloc ni de capacité de la démonstration, et pas d'écriture qui trompe le contrôle des styles", () => {
  const source = lire("js/combat/photographie.js");
  for (const nom of ["Taloche", "Pas chassé", "Aubépine", "Marmiton", "Couteau", "Spatule", "Réduction", "Solo du chef"]) assert.ok(!source.includes(nom), nom);
  assert.doesNotMatch(source, /groupes\.style\.|\.style\s*\[/);
  // Le rôle d'une capacité ne se décide qu'ici et dans la table des rôles.
  assert.match(source, /roles\?\.parCle\?\.get\(cle\(/);
});

// ─── Mise à l'épreuve (lot 4) : ce que les casses du code n'avaient pas fait échouer ───

const SANS_EFFET = { puissance: "0", cout_souffle: "", cout_lien: "", elements: [], description: "" };

test("une capacité que donnent deux blocs prend le premier groupe dans l'ordre du panneau, et n'a qu'un bouton", async () => {
  // Goûter vient du bloc de base ; l'archétype la donne aussi : elle passe sous l'archétype.
  const m = await monde((banque) => {
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Goûter" });
  });
  const v = valeursDe(pj(m));
  assert.equal(noms(v).filter((nom) => nom === "Goûter").length, 1);
  assert.deepEqual(laCapacite(v, "Goûter").groupe, { genre: "archetype", titre: "Saucier" });
  assert.equal(laCapacite(v, "Goûter").role, "jet_de_caracteristique", "son rôle tient à son nom, pas à son groupe");
  // Sans cet ajout, elle reste sous le bloc de base.
  assert.deepEqual(laCapacite(valeursDe(pj(DEMO)), "Goûter").groupe, { genre: "base", titre: "Gestes de cuisine" });
});

test("les capacités d'un même objet se suivent : un seul groupe par objet", async () => {
  // « Boire le bouillon » est aussi donnée par le Plastron, au sac : il ne compte pas, mais la fiche la rencontre là,
  // avant le Couvercle. Le Bouillon donne une seconde capacité, que la fiche rencontre après le Couvercle.
  const m = await monde((banque) => {
    banque.capacites.push({ nom: "Tour de main", variantes: [{ ...SANS_EFFET }] });
    blocDe(banque, "Plastron de fonte").capacites.push({ forme: "simple", nom: "Boire le bouillon" });
    blocDe(banque, "Bouillon revigorant").capacites.push({ forme: "simple", nom: "Tour de main" });
  });
  const v = valeursDe(pj(m));
  const objets = v.capacites.filter((c) => c.groupe.genre === "objet").map((c) => [c.nom, c.groupe.titre]);
  assert.deepEqual(objets, [["Boire le bouillon", "Bouillon revigorant"], ["Tour de main", "Bouillon revigorant"], ["Se couvrir", "Couvercle de marmite"]]);
  assert.equal(new Set(groupes(v)).size, groupes(v).length, "aucun groupe ne s'ouvre deux fois");
});

test("une portée écrite 0 et un seul dé de localisation écrit se lisent tels quels, sans avertissement", async () => {
  const m = await monde((banque) => {
    blocDe(banque, "Couteau d'office").parametres.push({ nom: "portee", valeur: "0", cible: "Frappe" }, { nom: "loc_multiple", valeur: "1", cible: "Frappe" });
  });
  const { photo } = pj(m);
  const frappe = laCapacite(photo.valeurs, "Frappe").facons[0];
  assert.deepEqual([frappe.portee, frappe.locMultiple], [0, 1]);
  assert.equal(laCapacite(photo.valeurs, "Émincer").facons[0].portee, 1, "l'autre capacité garde la portée du couteau");
  assert.deepEqual(photo.avertissements, []);
});

test("le N d'un passif câblé est le niveau de sa capacité, pas celui d'une autre", () => {
  const v = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.niveaux = [{ capacite: "Réduction", niveau: 2 }];
  })));
  assert.deepEqual(
    v.passifs.map((passif) => [v.capacites[passif.capacite].nom, passif.role, passif.niveau]),
    [["Réduction", "degrossir", 2], ["Vif", "bonus_agilite", 1], ["Solo du chef", "seul_sur_sa_case", 1]],
  );
  assert.equal(laCapacite(v, "Réduction").niveau, 2);
});

// Relecture de fin de groupe (lot 4) : aucun adversaire de la démonstration ne
// porte de passif câblé, et les contrôles du moteur posent les leurs à la
// main. Rien ne tenait donc la chaîne « ligne de la banque, rôle reconnu,
// passif au rang écrit ».
test("un adversaire à passifs câblés — chacun porte son rôle, au rang que sa ligne écrit ; sans ces capacités, aucun", async () => {
  const m = await monde((banque) => {
    banque.adversaires.push(
      ligneAdversaire("Second de cuisine", { capacites: "Brigade[2], Frappe, Réduction[3], Costaud" }),
      ligneAdversaire("Second de salle", { capacites: "Frappe" }),
    );
  });
  const passifs = (v) => v.passifs.map((passif) => [v.capacites[passif.capacite].nom, passif.role, passif.niveau]);

  const cuisine = valeursDe(adv(m, "Second de cuisine"));
  assert.deepEqual(passifs(cuisine), [["Brigade", "en_meute", 2], ["Réduction", "degrossir", 3], ["Costaud", "bonus_force", 1]]);
  assert.deepEqual(cuisine.capacites.map((c) => [c.nom, c.role, c.niveau]), [["Brigade", "en_meute", 2], ["Frappe", null, 0], ["Réduction", "degrossir", 3], ["Costaud", "bonus_force", 1]]);
  // L'indice d'un passif désigne sa capacité, même quand une capacité sans rôle s'intercale.
  assert.deepEqual(cuisine.passifs.map((passif) => passif.capacite), [0, 2, 3]);
  assert.deepEqual(passifs(valeursDe(adv(m, "Second de salle"))), [], "sans capacité câblée, aucun passif");

  // Le mode décide : en mode réel, ces noms de la démonstration ne câblent rien.
  const reel = await monde((banque) => {
    banque.adversaires.push(ligneAdversaire("Second de cuisine", { capacites: "Brigade[2], Frappe, Réduction[3], Costaud" }));
  }, "reel");
  assert.deepEqual(valeursDe(adv(reel, "Second de cuisine")).passifs, []);
  // Un rôle qui n'est pas un passif (le déplacement du Chef de partie) n'en fait pas un.
  const chef = valeursDe(adv(DEMO, "Chef de partie"));
  assert.equal(laCapacite(chef, "Pas chassé").role, "deplacement");
  assert.deepEqual(chef.passifs, []);
});

test("deux cents avertissements tiennent tous ; le deux cent unième fait place à la phrase qui compte", async () => {
  // Cent capacités, deux avertissements chacune ; la cent unième, s'il y en a une, n'en laisse qu'un.
  const avec = (combien) => monde((banque) => {
    const saucier = blocDe(banque, "Saucier");
    for (let k = 1; k <= 101; k += 1) {
      const nom = `Tour de main ${k}`;
      banque.capacites.push({ nom, variantes: [{ ...SANS_EFFET }] });
      saucier.capacites.push({ forme: "simple", nom });
      if (2 * k - 1 <= combien) saucier.parametres.push({ nom: "portee", valeur: "loin", cible: nom });
      if (2 * k <= combien) saucier.parametres.push({ nom: "loc_multiple", valeur: "peu", cible: nom });
    }
  });
  assert.equal(BORNES_PHOTO.avertissements, 200);
  const juste = pj(await avec(200)).photo.avertissements;
  assert.equal(juste.length, 200);
  assert.equal(juste.at(-1), "« Tour de main 100 » : son nombre de dés de localisation, « peu », ne se lit pas ; il vaut 1.");
  assert.ok(juste.every((ligne) => ligne.startsWith("« Tour de main ")), "aucune phrase de décompte");
  const trop = pj(await avec(201)).photo.avertissements;
  assert.equal(trop.length, 200);
  assert.equal(trop.at(-2), "« Tour de main 100 » : sa portée, « loin », ne se lit pas ; elle vaut 0.");
  assert.equal(trop.at(-1), "Et 2 autres avertissements.");
});

test("Passif, Intervention et Dégâts se reconnaissent par cle() : la casse et les accents n'y changent rien", async () => {
  const m = await monde((banque) => {
    capaciteDe(banque, "Nez fin").variantes[0].elements = [{ nom: "PASSIF" }];
    capaciteDe(banque, "Dressage minute").variantes[0].elements = [{ nom: "intervention" }];
    banque.capacites.push({ nom: "Coup de bec", variantes: [{ ...SANS_EFFET, elements: [{ nom: "degats" }] }] });
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Coup de bec" });
  });
  const v = valeursDe(pj(m));
  assert.deepEqual([laCapacite(v, "Nez fin").facons[0].passif, laCapacite(v, "Nez fin").facons[0].intervention], [true, false]);
  assert.deepEqual([laCapacite(v, "Dressage minute").facons[0].passif, laCapacite(v, "Dressage minute").facons[0].intervention], [false, true]);
  assert.equal(laCapacite(v, "Coup de bec").facons[0].attaque, true);
});

test("la position d'une capacité est celle de l'entrée qui la donne : une option qui n'est pas choisie ne la donne pas", async () => {
  // Devant Frappe, un groupe au choix qui propose aussi Moulinet farineux ; le personnage y choisit l'autre option.
  // Moulinet farineux lui vient donc de son entrée simple, la troisième : la maîtrise de niveau 2 ne la couvre pas.
  const m = await monde((banque) => {
    blocDe(banque, "Spatule souple").capacites.unshift({ forme: "choix", options: ["Moulinet farineux", "Choc sourd"] });
  });
  const avec = (choix, niveau) => valeursDe(pj(m, personnageEssai((p) => {
    p.equipement[0] = { nom: "Spatule souple", choix: [choix], qualite: "2", place: "arme" };
    p.niveaux = niveau > 1 ? [{ capacite: "Maîtrise de l'agile", niveau }] : [];
  })));
  const moulinet = (v) => laCapacite(v, "Moulinet farineux").facons.at(-1).desavantage;
  assert.deepEqual([moulinet(avec("Choc sourd", 2)), moulinet(avec("Choc sourd", 3))], [true, false]);
  // Choisie dans le groupe, elle prend sa position : la première.
  assert.equal(moulinet(avec("Moulinet farineux", 1)), false);
});

test("l'élément Dégâts fait une attaque à lui seul, sans valeur de dégâts, dans les deux camps", async () => {
  const m = await monde((banque) => {
    banque.capacites.push({ nom: "Coup de bec", variantes: [{ ...SANS_EFFET, elements: [{ nom: "Dégâts" }] }] });
    banque.capacites.push({ nom: "Coup d'aile", variantes: [{ ...SANS_EFFET, elements: [{ nom: "Dégâts" }, { nom: "Intervention" }] }] });
    banque.capacites.push({ nom: "Bec acéré", variantes: [{ ...SANS_EFFET, elements: [{ nom: "Dégâts" }, { nom: "Passif" }] }] });
    blocDe(banque, "Saucier").capacites.push({ forme: "simple", nom: "Coup de bec" }, { forme: "simple", nom: "Coup d'aile" }, { forme: "simple", nom: "Bec acéré" });
    banque.adversaires.push(ligneAdversaire("Goéland", { capacites: "Coup de bec, Coup d'aile, Bec acéré" }));
  });
  for (const v of [valeursDe(pj(m)), valeursDe(adv(m, "Goéland"))]) {
    const bec = laCapacite(v, "Coup de bec").facons[0];
    assert.deepEqual([bec.attaque, bec.degats, bec.arme, bec.elements], [true, null, null, ["Dégâts"]], v.nom);
    const aile = laCapacite(v, "Coup d'aile").facons[0];
    assert.deepEqual([aile.attaque, aile.intervention], [false, true], `${v.nom} : une intervention n'est pas une attaque`);
    const acere = laCapacite(v, "Bec acéré").facons[0];
    assert.deepEqual([acere.attaque, acere.passif], [false, true], `${v.nom} : un passif n'est pas une attaque`);
  }
});

test("chez un adversaire, une intervention ou un passif que son arme dote de dégâts n'est pas une attaque", async () => {
  const m = await monde((banque) => {
    banque.blocs.push({ nom: "Louche creuse", type: "Arme", elements: [{ nom: "Arme" }], capacites: [{ forme: "simple", nom: "Pas de côté" }, { forme: "simple", nom: "Nez fin" }, { forme: "simple", nom: "Goûter" }], parametres: [{ nom: "degats", valeur: "1/2/3", cible: null }], notes: "" });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Louche creuse" }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(v.capacites.map((c) => [c.nom, c.facons.map((f) => [f.arme, f.degats, f.intervention, f.passif, f.attaque])]), [
    ["Pas de côté", [[0, [1, 2, 3], true, false, false]]],
    ["Nez fin", [[0, [1, 2, 3], false, true, false]]],
    ["Goûter", [[0, [1, 2, 3], false, false, true]]],
  ]);
});

test("chez un adversaire, sans façon armée : le désavantage ne vaut que si tous les objets qui donnent la capacité la gênent", async () => {
  const louche = (nom, elements) => ({ nom, type: "Arme", elements: elements.map((element) => ({ nom: element })), capacites: [{ forme: "simple", nom: "Goûter" }], parametres: [], notes: "" });
  const m = await monde((banque) => {
    banque.blocs.push(louche("Louche creuse", ["Arme", "Agile"]), louche("Louche plate", ["Arme"]));
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Louche creuse" }), ligneAdversaire("Mouette rieuse", { equipement: "Louche creuse, Louche plate" }));
  });
  const gouter = (nom) => laCapacite(valeursDe(adv(m, nom)), "Goûter").facons.map((f) => [f.arme, f.desavantage]);
  assert.deepEqual(gouter("Goéland"), [[null, true]], "agile, sans maîtrise de l'agile");
  assert.deepEqual(gouter("Mouette rieuse"), [[null, false]], "la louche plate, sans poids, la donne sans gêne");
});

test("chez un adversaire, le groupe d'une capacité est l'arme de sa première façon armée, même après une façon sans arme", async () => {
  const m = await monde((banque) => {
    banque.blocs.push({ nom: "Poivrière", type: "Équipement", elements: [], capacites: [{ forme: "simple", nom: "Frappe" }], parametres: [{ nom: "degats", valeur: "1/2/3", cible: null }], notes: "" });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Poivrière, Couteau d'office" }));
  });
  const frappe = laCapacite(valeursDe(adv(m, "Goéland")), "Frappe");
  assert.deepEqual(frappe.facons.map((f) => [f.arme, f.libelle, f.degats]), [[null, "Poivrière", [1, 2, 3]], [0, "Couteau d'office", [3, 8, 20]]]);
  assert.deepEqual(frappe.groupe, { genre: "arme", titre: "Couteau d'office" });
});

test("un avertissement ne se répète pas d'une puissance à l'autre de la même capacité", async () => {
  // Flambage a deux puissances jouables : sa portée illisible se dit une fois.
  const m = await monde((banque) => {
    blocDe(banque, "Saucier").parametres.push({ nom: "portee", valeur: "loin", cible: "Flambage" });
  });
  const { photo } = pj(m);
  assert.deepEqual(laCapacite(photo.valeurs, "Flambage").facons.map((f) => [f.puissance, f.portee]), [[1, 0], [2, 0]]);
  assert.deepEqual(photo.avertissements, ["« Flambage » : sa portée, « loin », ne se lit pas ; elle vaut 0."]);
});

test("deux armes que leur nom nettoyé confond — le groupe de la seconde porte son libellé, « (2) » compris", async () => {
  // Deux objets différents de la banque, dont les noms ne diffèrent que par un caractère de contrôle : une fois
  // nettoyés pour le journal, c'est le même nom, et seul le libellé les distingue.
  const jumelle = `Spatule${SONNETTE}souple`;
  const m = await monde((banque) => {
    banque.blocs.push({ nom: jumelle, type: "Arme", elements: [{ nom: "Arme" }], capacites: [{ forme: "simple", nom: "Goûter" }], parametres: [{ nom: "degats", valeur: "1/2/3", cible: null }], notes: "" });
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: `Spatule souple, ${jumelle}` }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  assert.deepEqual(v.armes.map((arme) => [arme.nom, arme.libelle, arme.degats]), [["Spatule souple", "Spatule souple", [5, 10, 15]], ["Spatule souple", "Spatule souple (2)", [1, 2, 3]]]);
  assert.deepEqual(groupes(v), ["arme : Spatule souple", "arme : Spatule souple (2)"]);
  assert.deepEqual(laCapacite(v, "Goûter").facons.map((f) => [f.arme, f.libelle]), [[1, "Spatule souple (2)"]]);
  assert.deepEqual(laCapacite(v, "Goûter").groupe, { genre: "arme", titre: "Spatule souple (2)" });
});

// ─── Le groupe 2 : la puissance d'un adversaire, la cause de maîtrise, l'égalité de défense ───
//
// Le contrat du groupe 2 (§ 5.1 à § 5.4) et le complément (§ 6.1 à § 6.3).

test("capacitesA — sur chaque adversaire de la démonstration, au rang, la résolution même ; ailleurs, null ; les constats ne changent pas", () => {
  let comparees = 0;
  for (const ligne of DEMO.adversaires.adversaires.values()) {
    const avant = JSON.stringify(DEMO.adversaires.resoudre(ligne));
    const resolu = DEMO.adversaires.resoudre(ligne);
    const par = [0, 1, 2, 3, 4].map((puissance) => DEMO.adversaires.capacitesA(ligne, puissance));
    resolu.capacites.forEach((capacite, k) => {
      for (const [puissance, liste] of par.entries()) {
        assert.equal(liste.length, resolu.capacites.length, `${ligne.nom} : parallèle à la résolution`);
        if (!capacite.absente && puissance === capacite.rang && puissance >= 1) {
          assert.deepEqual(liste[k], capacite, `${ligne.nom}, ${capacite.nom}, au rang`);
          comparees += 1;
        } else if (capacite.absente || puissance === 0 || puissance > capacite.rang) assert.equal(liste[k], null, `${ligne.nom}, ${capacite.nom}, à la puissance ${puissance}`);
      }
    });
    assert.equal(JSON.stringify(DEMO.adversaires.resoudre(ligne)), avant, `${ligne.nom} : sa résolution et ses constats ne changent pas`);
  }
  // Moulinet farineux (deux fois), Pas chassé (trois fois), et le Chef seul à rang 2.
  assert.equal(comparees, 5);
  // Pas chassé du Chef : à la puissance 1, ce que dit sa variante à 1 ; le rang reste le sien.
  const chef = DEMO.adversaires.adversaires.get("Chef de partie");
  const pas = DEMO.adversaires.resoudre(chef).capacites.findIndex((capacite) => capacite.nom === "Pas chassé");
  const un = DEMO.adversaires.capacitesA(chef, 1)[pas];
  assert.deepEqual([un.rang, un.cout, un.descriptions], [2, { souffle: "0", lien: "0" }, [{ source: null, texte: "Se déplace de 1 cases." }]]);
});

test("les puissances d'un adversaire — par puissance, puis par arme ; une puissance sans variante est sautée ; aucune ne se lit : son rang seul", async () => {
  const m = await monde((banque) => {
    const fournaise = capaciteDe(banque, "Fournaise");
    fournaise.variantes = fournaise.variantes.filter((variante) => variante.puissance !== "2");
    capaciteDe(banque, "Vif").variantes[0].puissance = "beaucoup";
    banque.adversaires.push(ligneAdversaire("Goéland", { equipement: "Spatule souple, Spatule souple[3]", capacites: "Moulinet farineux[2], Fournaise[3], Vif, Frappe" }));
  });
  const v = valeursDe(adv(m, "Goéland"));
  // Deux spatules, deux puissances : la puissance d'abord, puis l'arme ; le coût et la description suivent la puissance.
  assert.deepEqual(laCapacite(v, "Moulinet farineux").facons.map((f) => [f.puissance, f.arme, f.libelle, f.cout, f.degats, f.description]), [
    [1, 0, "Spatule souple", { souffle: 5, lien: 0 }, [5, 10, 15], "Tourbillonne 1 fois."],
    [1, 1, "Spatule souple (2)", { souffle: 5, lien: 0 }, [6, 13, 20], "Tourbillonne 1 fois."],
    [2, 0, "Spatule souple", { souffle: 10, lien: 0 }, [5, 10, 15], "Tourbillonne 2 fois."],
    [2, 1, "Spatule souple (2)", { souffle: 10, lien: 0 }, [6, 13, 20], "Tourbillonne 2 fois."],
  ]);
  // Sans variante de puissance 2 : les puissances 1 et 3, chacune avec ses éléments et sa portée propre.
  assert.deepEqual(laCapacite(v, "Fournaise").facons.map((f) => [f.puissance, f.cout, f.elements, f.portee, f.description]), [
    [1, { souffle: 1, lien: 1 }, [], 0, "Réchauffe la case."],
    [3, { souffle: 7, lien: 1 }, ["Portée"], 2, "Aveugle une cible à 2 cases."],
  ]);
  // Une puissance illisible : aucune variante ne se joue, la façon de son rang reste, au coût illisible.
  assert.deepEqual(laCapacite(v, "Vif").facons.map((f) => [f.puissance, f.cout]), [[1, null]]);
  // Une capacité qui n'évolue pas garde une façon, à sa seule puissance ; le niveau reste le rang.
  assert.deepEqual(laCapacite(v, "Frappe").facons.map((f) => [f.puissance, f.arme]), [[0, 0], [0, 1]]);
  assert.deepEqual(["Moulinet farineux", "Fournaise", "Vif", "Frappe"].map((nom) => laCapacite(v, nom).niveau), [2, 3, 1, 0]);
});

test("les bornes restent — plus de vingt façons pour une capacité : l'adversaire ne s'ajoute pas", async () => {
  const spatules = (combien) => Array(combien).fill("Spatule souple").join(", ");
  const m = await monde((banque) => {
    banque.adversaires.push(
      ligneAdversaire("Goéland", { equipement: spatules(7), capacites: "Moulinet farineux[3]" }),
      ligneAdversaire("Mouette rieuse", { equipement: spatules(6), capacites: "Moulinet farineux[3]" }),
    );
  });
  // Sept spatules, trois puissances : vingt et une façons.
  assert.deepEqual(adv(m, "Goéland"), { refus: "Ne s'ajoute pas : la liste des façons de « Moulinet farineux » compte plus de 20 façons." });
  assert.equal(laCapacite(valeursDe(adv(m, "Mouette rieuse")), "Moulinet farineux").facons.length, 18);
});

test("la cause de maîtrise d'un personnage — l'objet qui donne la capacité, sinon son bloc, et son poids ; nulle sans désavantage", async () => {
  // La démonstration : Frappe et Émincer, hors maîtrise par le couteau précis ; rien d'autre.
  const causes = (v) => v.capacites.flatMap((c) => c.facons.filter((f) => f.maitrise !== null).map((f) => [c.nom, f.maitrise]));
  const COUTEAU = { origine: "Couteau d'office", poids: "precise" };
  assert.deepEqual(causes(valeursDe(pj(DEMO))), [["Frappe", COUTEAU], ["Émincer", COUTEAU]]);
  // La maîtrise du précis, au niveau 1, couvre Frappe, la première capacité du couteau : Émincer seule garde sa cause.
  const precis = await monde((banque) => {
    blocDe(banque, "Saucier").capacites.find((entree) => entree.options?.includes("Maîtrise de l'agile")).options.push("Maîtrise du précis");
  });
  assert.deepEqual(causes(valeursDe(pj(precis, personnageEssai((p) => {
    p.archetype.choix = ["Solo du chef", "Maîtrise du précis"];
  })))), [["Émincer", COUTEAU]]);
  // Le rouleau tenu : l'arme lourde est la cause ; le plastron porté : la pièce d'armure.
  const rouleau = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.equipement[0].place = "sac";
    p.equipement[1].place = "arme";
  })));
  assert.deepEqual(causes(rouleau), [["Frappe", { origine: "Rouleau de fonte", poids: "lourde" }], ["Choc sourd", { origine: "Rouleau de fonte", poids: "lourde" }]]);
  const armure = await monde((banque) => {
    blocDe(banque, "Plastron de fonte").capacites.push({ forme: "simple", nom: "Boire le bouillon" });
    blocDe(banque, "Bouillon revigorant").capacites = [];
  });
  const plastron = valeursDe(pj(armure, personnageEssai((p) => {
    p.equipement[3].place = "equipe";
    p.equipement[2].place = "sac";
  })));
  assert.deepEqual(laCapacite(plastron, "Boire le bouillon").facons[0].maitrise, { origine: "Plastron de fonte", poids: "lourde" });
});

test("la cause de maîtrise — un bloc à deux poids : celui dont la maîtrise est la plus basse, chez un personnage comme chez un adversaire", async () => {
  // Le Saucier porte Lourde et Agile : ses capacités demandent les deux maîtrises.
  const m = await monde((banque) => {
    blocDe(banque, "Saucier").elements.push({ nom: "Lourde" }, { nom: "Agile" });
    banque.blocs.push({ nom: "Batte double", type: "Arme", elements: [{ nom: "Arme" }, { nom: "Agile" }, { nom: "Lourde" }], capacites: [{ forme: "simple", nom: "Frappe" }], parametres: [{ nom: "degats", valeur: "1/2/3", cible: null }], notes: "" });
    banque.adversaires.push(
      ligneAdversaire("Goéland", { equipement: "Batte double", capacites: "Maîtrise de l'agile[2]" }),
      ligneAdversaire("Mouette rieuse", { equipement: "Batte double", capacites: "Maîtrise du lourd[2]" }),
    );
  });
  const reduction = (choix) => laCapacite(valeursDe(pj(m, personnageEssai((p) => {
    p.archetype.choix = ["Solo du chef", choix];
  }))), "Réduction").facons[0].maitrise;
  // La maîtrise de l'agile au niveau 1 : il manque celle du lourd ; et l'inverse.
  assert.deepEqual(reduction("Maîtrise de l'agile"), { origine: "Saucier", poids: "lourde" });
  assert.deepEqual(reduction("Maîtrise du lourd"), { origine: "Saucier", poids: "agile" });
  const frappe = (nom) => laCapacite(valeursDe(adv(m, nom)), "Frappe").facons.map((f) => [f.desavantage, f.maitrise]);
  assert.deepEqual(frappe("Goéland"), [[true, { origine: "Batte double", poids: "lourde" }]]);
  assert.deepEqual(frappe("Mouette rieuse"), [[true, { origine: "Batte double", poids: "agile" }]]);
});

test("la cause de maîtrise d'un adversaire — l'objet de chaque façon armée ; sans façon armée, le premier objet qui la gêne", async () => {
  const louche = (nom, elements) => ({ nom, type: "Arme", elements: elements.map((element) => ({ nom: element })), capacites: [{ forme: "simple", nom: "Goûter" }], parametres: [], notes: "" });
  const m = await monde((banque) => {
    banque.blocs.push(louche("Louche creuse", ["Arme", "Agile"]), louche("Louche plate", ["Arme"]));
    banque.adversaires.push(
      ligneAdversaire("Goéland", { equipement: "Couteau d'office, Spatule souple, Louche creuse" }),
      ligneAdversaire("Mouette rieuse", { equipement: "Louche creuse, Louche plate" }),
    );
  });
  const goeland = valeursDe(adv(m, "Goéland"));
  // Deux armes gênent Frappe : chaque façon dit la sienne.
  assert.deepEqual(laCapacite(goeland, "Frappe").facons.map((f) => [f.libelle, f.maitrise]), [
    ["Couteau d'office", { origine: "Couteau d'office", poids: "precise" }],
    ["Spatule souple", { origine: "Spatule souple", poids: "agile" }],
  ]);
  assert.deepEqual(laCapacite(goeland, "Goûter").facons.map((f) => [f.arme, f.desavantage, f.maitrise]), [[null, true, { origine: "Louche creuse", poids: "agile" }]]);
  // La louche plate, sans poids, la donne sans gêne : ni désavantage, ni cause.
  assert.deepEqual(laCapacite(valeursDe(adv(m, "Mouette rieuse")), "Goûter").facons.map((f) => [f.desavantage, f.maitrise]), [[false, null]]);
});

test("l'égalité de défense — écrite dans la photographie : mêlée à égalité, sans armure, un seul type", () => {
  assert.deepEqual(valeursDe(pj(DEMO)).deDefense.egalite, ["agile", "precise"]);
  // Sans armure : l'agile, le plus avantageux, est retenue ; la précise donne le même d8.
  const nue = valeursDe(pj(DEMO, personnageEssai((p) => {
    for (const rang of [2, 4, 5, 6]) p.equipement[rang].place = "sac";
  })));
  assert.deepEqual([nue.deDefense.type, nue.deDefense.faces, nue.deDefense.egalite], ["agile", 8, ["agile", "precise"]]);
  // Les seules pièces agiles : rien à départager.
  const agile = valeursDe(pj(DEMO, personnageEssai((p) => {
    p.equipement[4].place = "sac";
  })));
  assert.deepEqual([agile.deDefense.type, agile.deDefense.meles, agile.deDefense.egalite], ["agile", false, []]);
});
