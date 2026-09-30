// Le parcours de création (SPECIFICATION.md, § 15.3).
//
// Neuf étapes, un brouillon enregistré à chaque pas, et toujours un message
// qui dit ce qui manque. Ce module ne touche pas à la page : il dit ce qui
// manque à chaque étape, quelles montées sont possibles, et tire la
// constellation.

import { TYPES, banqueSansTypes, typeDe } from "../banque/types.js";
import { calculerFiche, capacitesDuBloc, estBouclier, indexerCreation } from "./calcul.js";
import { CARACTERISTIQUES, COUT_NIVEAU, POINTS_CREATION, SOMME_CARACTERISTIQUES } from "./regles.js";

export const ETAPES = [
  { numero: 1, cle: "identite", titre: "Identité" },
  { numero: 2, cle: "caracteristiques", titre: "Caractéristiques" },
  { numero: 3, cle: "archetype", titre: "Archétype" },
  { numero: 4, cle: "espece", titre: "Espèce" },
  { numero: 5, cle: "constellation", titre: "Constellation" },
  { numero: 6, cle: "primordial", titre: "Primordial" },
  { numero: 7, cle: "equipement", titre: "Équipement" },
  { numero: 8, cle: "capacites", titre: "Capacités" },
  { numero: 9, cle: "recapitulatif", titre: "Récapitulatif" },
];

export const MESSAGE_BANQUE_SANS_TYPES = "Le créateur a besoin d'une banque republiée depuis le classeur à jour.";

/** Vrai quand la banque convient au créateur ; sinon le message du § 15.3. */
export function banqueUtilisable(banque) {
  return banqueSansTypes(banque) ? { erreur: MESSAGE_BANQUE_SANS_TYPES } : { ok: true };
}

function manquesDuBloc(index, choix, type, intitule) {
  if (!choix?.nom) return [`Choisissez ${intitule}.`];
  const bloc = index.bloc(choix.nom);
  if (!bloc) return [`« ${choix.nom} » n'existe plus dans la banque : choisissez ${intitule}.`];
  // Un fichier importé peut nommer un bloc d'un autre type.
  if (typeDe(bloc) !== type) return [`« ${bloc.nom} » n'est pas du type ${TYPES[type].nom} : choisissez ${intitule}.`];
  return capacitesDuBloc(bloc, choix.choix).manques.map((m) => `${m[0].toUpperCase()}${m.slice(1)}.`);
}

/**
 * Ce qui manque à chaque étape : { 1: [phrases], … 9: [] }. L'étape 9
 * reprend tout ce qui manque ailleurs : on n'enregistre qu'un personnage
 * complet.
 */
export function manques(banque, personnage, { index = indexerCreation(banque), fiche = null } = {}) {
  const resultat = Object.fromEntries(ETAPES.map((e) => [e.numero, []]));
  if (personnage.identite.nom.trim() === "") resultat[1].push("Donnez un nom au personnage.");

  const valeurs = CARACTERISTIQUES.map((c) => personnage.caracteristiques[c.code]);
  const vides = CARACTERISTIQUES.filter((c) => personnage.caracteristiques[c.code] === null).map((c) => c.nom);
  const somme = valeurs.reduce((total, v) => total + (v ?? 0), 0);
  if (vides.length) resultat[2].push(`Donnez une valeur de 2 à 6 à : ${vides.join(", ")}.`);
  else if (somme !== SOMME_CARACTERISTIQUES) resultat[2].push(`La somme vaut ${somme} : il faut ${SOMME_CARACTERISTIQUES} (${somme > SOMME_CARACTERISTIQUES ? `${somme - SOMME_CARACTERISTIQUES} de trop` : `il manque ${SOMME_CARACTERISTIQUES - somme}`}).`);

  resultat[3].push(...manquesDuBloc(index, personnage.archetype, "archetype", "un archétype"));
  resultat[4].push(...manquesDuBloc(index, personnage.espece, "espece", "une espèce"));
  if (!personnage.constellation?.nom) resultat[5].push("Tirez la constellation au sort, ou saisissez le tirage fait à la table.");
  else if (!index.bloc(personnage.constellation.nom)) resultat[5].push(`« ${personnage.constellation.nom} » n'existe plus dans la banque.`);
  else resultat[5].push(...manquesDuBloc(index, personnage.constellation, "constellation", "une constellation").filter((m) => !m.startsWith("Choisissez une constellation")));
  resultat[6].push(...manquesDuBloc(index, personnage.primordial, "primordial", "un primordial"));

  personnage.equipement.forEach((objet, rang) => {
    const bloc = index.bloc(objet.nom);
    if (!bloc) resultat[7].push(`« ${objet.nom} » n'existe plus dans la banque : retirez-le.`);
    else for (const m of capacitesDuBloc(bloc, objet.choix).manques) resultat[7].push(`« ${bloc.nom} » : ${m}.`);
    if (bloc && rang === personnage.bouclier && !estBouclier(bloc)) resultat[7].push(`« ${objet.nom} » ne peut pas servir de bouclier.`);
  });
  const calculee = fiche ?? calculerFiche(banque, personnage, { index });
  for (const a of calculee.avertissements.filter((a) => a.genre === "regle" && /couvrent la même zone/.test(a.texte))) resultat[7].push(a.texte);

  if (calculee.points.depasse && personnage.niveaux.length) resultat[8].push(`Les montées portent les points de capacité à ${calculee.points.depenses} : ${POINTS_CREATION} au plus.`);

  resultat[9] = ETAPES.slice(0, 8).flatMap((e) => resultat[e.numero].map((m) => `${e.titre} : ${m}`));
  return resultat;
}

/**
 * Les montées possibles d'une capacité de la fiche : les niveaux qu'elle
 * peut prendre sans que le total dépasse 10 (livret, « Création »). Rend la
 * liste des niveaux permis, le niveau de création compris.
 */
export function niveauxPermis(fiche, capacite) {
  if (capacite.aVenir || capacite.niveau === null || !capacite.peutEvoluer) return capacite.niveau === null ? [] : [capacite.niveau];
  const sansElle = fiche.points.depenses - COUT_NIVEAU[capacite.niveau];
  const permis = [];
  for (let niveau = capacite.niveauCreation; niveau <= capacite.niveauMax; niveau += 1) {
    if (niveau === capacite.niveauCreation || sansElle + COUT_NIVEAU[niveau] <= POINTS_CREATION) permis.push(niveau);
  }
  return permis;
}

/**
 * Tire un indice de 0 à n − 1, sans biais : les valeurs du générateur qui
 * dépassent le dernier multiple de n sont rejetées. aleatoire remplit un
 * Uint32Array (crypto.getRandomValues).
 */
export function tirerIndice(n, aleatoire = (tableau) => crypto.getRandomValues(tableau)) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("Aucun choix à tirer.");
  const limite = Math.floor(0x1_0000_0000 / n) * n;
  const tableau = new Uint32Array(1);
  for (;;) {
    aleatoire(tableau);
    if (tableau[0] < limite) return tableau[0] % n;
  }
}

/** Tire une constellation parmi les blocs de type Constellation (livret, « Création »). */
export function tirerConstellation(banque, aleatoire) {
  const constellations = indexerCreation(banque).blocsDeType("constellation");
  if (!constellations.length) return null;
  return constellations[tirerIndice(constellations.length, aleatoire)].nom;
}
