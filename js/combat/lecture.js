// Les vues du combat : ce que l'écran demande au moteur (SPECIFICATION.md,
// § 17 « Le simulateur de combat (lot 4) »).
//
// Ce module fabrique, sans rien toucher de la page, les cinq vues que l'écran
// affiche : la barre de titre, le plateau, la fiche vivante d'un
// protagoniste, le panneau d'action et la préparation. Une vue est un objet
// prêt à montrer : ses textes sont écrits, ses états nommés. Il dit aussi ce
// qu'une ligne du journal met en évidence (vueLigne).
//
// Il existe pour que l'écran n'écrive aucune règle et ne fasse aucun calcul :
// - chaque élément qu'on peut actionner porte sa « commande » : l'événement à
//   émettre, le protagoniste à choisir, ou l'ordre de préparation ;
// - chaque bouton inactif porte « actif: false » et sa raison ;
// - chaque saisie porte ses bornes et un « gabarit » : l'événement, qu'il ne
//   reste qu'à compléter du nombre saisi et, s'il y a lieu, de sa raison.
//
// Tout ce qui est offert vient de l'offre (js/combat/offre.js), que le moteur
// lit aussi pour juger chaque événement : un bouton montré actif est donc un
// événement que le moteur accepte, et un bouton montré inactif un événement
// qu'il refuse. C'est pourquoi ce module n'importe jamais le moteur, et ne
// change rien à ce qu'on lui donne. Un contrôle tient cette concordance à
// chaque moment d'un combat joué (tests/combat_lecture.test.js).
//
// Ce qu'il impose à ce qu'il rend :
// - une vue ne porte rien d'instable (ni heure, ni compteur) : l'écran
//   compare le texte JSON de deux vues pour savoir quoi redessiner ;
// - le nom court ne sert qu'au journal et aux jetons du plateau ; partout
//   ailleurs une vue écrit le nom entier ;
// - les noms (protagonistes, capacités, zones, armes, raisons) sont des
//   données hostiles, rendues telles quelles : c'est l'écran qui les pose
//   comme du texte.
//
// Quelques textes ne viennent pas de l'auteur, qui n'a décrit que le panneau
// de la maquette : les phrases du bilan pendant la chaîne, les libellés des
// dégâts à fixer, « Une action est en cours. ». Ils restent à lui faire
// confirmer.

import { CARACTERISTIQUES, deDuJet } from "../personnage/regles.js";
import { circonstances, modificateursDe, passifsDe } from "./circonstances.js";
import { coupsDuGeste, degatsFixes, frapper, lettreDe, localiser } from "./degats.js";
import { evaluerEssai, modificateurDe, netDe, ouvrirJet, relancesRestantes, reussites } from "./jet.js";
import { ecrireBilan, ecrireMort, ecrireSource, ligneDeFin } from "./journal.js";
import { acteurCourant, boutons, candidats, cibles, esquiveOfferte, faconsDe, offre } from "./offre.js";
import { ajouterAdversaires, ajouterPersonnage, peutLancer } from "./preparation.js";
import { DIFFICULTES, LETTRES, LONGUEUR_RAISON, PLAFOND_ADVERSAIRES, PLAFOND_EXEMPLAIRES, REUSSITES_MAX, SIGNES } from "./regles.js";
import { aJoue, attaqueDe, campDe, capaciteDe, courantDe, defenseDe, faconDe, gesteEnCours, photoDe } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const CAMPS = { pj: "PJ", adv: "adversaires" };
const UN_DU_CAMP = { pj: "personnage", adv: "adversaire" };
const POIDS = { lourde: "lourde", agile: "agile", precise: "précise" };
const RANGS = ["1er dé", "2e dé", "3e dé"];

const ACTION_EN_COURS = "Une action est en cours.";

const present = (valeur) => valeur !== null && valeur !== undefined;
const somme = (nombres) => nombres.reduce((total, nombre) => total + nombre, 0);
const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);

// « 1 action », « 2 actions » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// La casse du premier signe seul, sans règle propre à une langue : la même
// vue sort sur tous les appareils.
function minuscule(texte) {
  const [premier = ""] = texte;
  return premier.toLowerCase() + texte.slice(premier.length);
}

function majuscule(texte) {
  const [premier = ""] = texte;
  return premier.toUpperCase() + texte.slice(premier.length);
}

const nomEntier = (etat, id) => etat.noms?.[id]?.entier ?? photoDe(etat, id)?.nom ?? "";

const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });
const gabaritDe = (champ) => ({ evenement: { type: "regler", champ } });

// La raison qu'une saisie propose : le nom de la capacité jouée. Une raison
// tient en LONGUEUR_RAISON signes, sans blanc de bord ; un nom peut être plus
// long.
const raisonDepuis = (nom) => String(nom ?? "").slice(0, LONGUEUR_RAISON).trim();

// « Taloche [1] » : la puissance ne s'écrit que pour une capacité qui évolue.
const libelleDe = (capacite, facon) => `${capacite.nom}${capacite.evolue && facon !== null ? ` [${facon.puissance}]` : ""}`;

// ─── La barre ───────────────────────────────────────────────────────────────

const AIDES = {
  preparation:
    "Un protagoniste ajouté se pose d'office : un personnage sur la colonne A, un adversaire sur la colonne J. Déplacez-le en le faisant glisser, en touchant son jeton puis une case, ou par le champ « Case » de sa fiche.",
  pj: "Les PJ jouent dans l'ordre de leur choix. Le tour des adversaires commence quand tous ont joué, ou sur « Fin de tour ».",
  adv: "Les adversaires jouent dans l'ordre de votre choix. Le tour des PJ commence quand tous ont joué, ou sur « Fin de tour ».",
  termine: "Le combat est terminé. Le journal se copie et se télécharge toujours.",
};

/**
 * La barre de titre : l'état du combat (« Préparation », « Tour 2 · camp des
 * PJ », « Combat terminé »), la ligne d'aide de la phase, et « Fin de tour »,
 * proposé pendant le combat, inactif au milieu d'une action.
 */
export function vueBarre(etat) {
  if (etat.phase === "preparation") return { etat: "Préparation", aide: AIDES.preparation, finDeTour: null };
  if (etat.phase !== "combat" || etat.tour === null) return { etat: "Combat terminé", aide: AIDES.termine, finDeTour: null };
  const actif = offre(etat).types.includes("fin_de_tour");
  return {
    etat: `Tour ${etat.tour.numero} ${SIGNES.point} camp des ${CAMPS[etat.tour.camp]}`,
    aide: AIDES[etat.tour.camp],
    finDeTour: { actif, raison: actif ? null : ACTION_EN_COURS, commande: { evenement: { type: "fin_de_tour" } } },
  };
}

// ─── Le journal ─────────────────────────────────────────────────────────────

/**
 * Une ligne du journal, telle que l'écran la montre : { genre, texte, mort }.
 * « mort » est la phrase de la mort (« Marmiton n° 1 meurt. »), la dernière de
 * la ligne : l'écran la met seule en évidence, comme la maquette. « texte »
 * est ce qui la précède, et les deux bout à bout redonnent la ligne, signe
 * pour signe. Une ligne où personne ne meurt rend son texte entier, et
 * « mort » nul.
 *
 * La forme d'une ligne dans l'état du combat ne change pas : la phrase se
 * retrouve dans le texte. C'est celle que le journal écrit pour l'un des
 * morts du combat, la plus longue si plusieurs finissent la ligne.
 * Introuvable, c'est la ligne entière qui est mise en évidence.
 */
export function vueLigne(etat, ligne) {
  const genre = ligne.genre ?? null;
  if (ligne.mort !== true) return { genre, texte: ligne.texte, mort: null };
  let phrase = null;
  for (const id of etat.ordre) {
    if (!present(courantDe(etat, id)?.mort)) continue;
    const dite = ecrireMort(etat, { cible: id, resultat: { mort: true } });
    if (dite !== null && ligne.texte.endsWith(dite) && (phrase === null || dite.length > phrase.length)) phrase = dite;
  }
  if (phrase === null) return { genre, texte: "", mort: ligne.texte };
  return { genre, texte: ligne.texte.slice(0, ligne.texte.length - phrase.length), mort: phrase };
}

// ─── Le plateau ─────────────────────────────────────────────────────────────

// Le geste qui se règle encore, tant qu'il attend une cible ou une arrivée :
// c'est pendant ce choix que le plateau marque ce qui se choisit, et écarte
// le reste.
function choixSurLePlateau(etat) {
  const geste = gesteEnCours(etat);
  if (geste === null || geste.moment !== "preparation") return null;
  const offerts = offre(etat).reglages;
  if (Object.hasOwn(offerts, "cible")) return { champ: "cible", options: offerts.cible.options.filter(present) };
  if (Object.hasOwn(offerts, "arrivee")) return { champ: "arrivee", options: offerts.arrivee.options };
  return null;
}

// Ce qu'on dit d'un protagoniste, en un mot ou deux ; null quand il n'y a
// rien à en dire. « A joué » ne vaut que pour le camp dont c'est le tour.
function situationDe(etat, id, acteur) {
  const courant = courantDe(etat, id);
  if (courant.mort !== null) return "mort";
  if (etat.phase !== "combat") return null;
  if (id === acteur) return "joue";
  if (gesteEnCours(etat)?.cible === id) return "cible";
  if (etat.tour !== null && courant.camp === etat.tour.camp && aJoue(etat, id)) return "a_joue";
  return null;
}

const DIT_SUR_LE_JETON = { mort: "mort", joue: "joue", cible: "ciblé", a_joue: "a joué" };

// Le nom d'une case d'arrivée possible : le même sur la carte et sur son
// double, le bouton du panneau d'action.
const nomDArrivee = (nomDeCase) => `Case ${nomDeCase} : s'y déplacer`;

/**
 * Le plateau : les seules cases qui portent un jeton ou qui se choisissent,
 * et un jeton par protagoniste.
 * - Une case : { jetons, active, choix }. « active » : la case de qui joue ;
 *   « choix » : { commande, nom } pour une case d'arrivée possible. Dans une
 *   case, celui qui joue vient en tête, puis la cible : au-delà de trois
 *   jetons l'écran n'en montre que les premiers.
 * - Un jeton : { camp, entier, jeton, initiales, marque, mort, nom, choix,
 *   inactif }. « nom » est son nom accessible : nom entier, camp, état, case.
 *   « choix » : { commande } pour qui peut être choisi pour jouer quand rien
 *   n'est en cours, ou pour une cible possible.
 * Pendant un choix de cible ou d'arrivée, et alors seulement, tout jeton sans
 * choix est « inactif ». Avant le lancement, aucun choix : l'écran déplace
 * lui-même les jetons.
 */
export function vuePlateau(etat, choisi) {
  const acteur = acteurCourant(etat, choisi);
  const geste = gesteEnCours(etat);
  const enChoix = choixSurLePlateau(etat);
  const quiPeutJouer = geste === null ? candidats(etat) : [];

  const jetons = {};
  const cases = {};
  const laCase = (nom) => {
    if (!Object.hasOwn(cases, nom)) cases[nom] = { jetons: [], active: false, choix: null };
    return cases[nom];
  };

  for (const id of etat.ordre) {
    const courant = courantDe(etat, id);
    const noms = etat.noms?.[id] ?? {};
    const situation = situationDe(etat, id, acteur);
    let choix = null;
    if (enChoix?.champ === "cible" && enChoix.options.includes(id)) choix = { commande: regler("cible", id) };
    else if (enChoix === null && quiPeutJouer.includes(id)) choix = { commande: { choisir: id } };
    const entier = nomEntier(etat, id);
    jetons[id] = {
      camp: courant.camp,
      entier,
      jeton: noms.jeton ?? entier,
      initiales: noms.initiales ?? "?",
      marque: situation === "joue" || situation === "cible" ? situation : null,
      mort: courant.mort !== null,
      nom: [entier, UN_DU_CAMP[courant.camp], DIT_SUR_LE_JETON[situation] ?? null, `case ${courant.case}`].filter(present).join(", "),
      choix,
      inactif: enChoix !== null && choix === null,
    };
    laCase(courant.case).jetons.push(id);
  }

  const rangDe = (id) => (jetons[id].marque === "joue" ? 0 : jetons[id].marque === "cible" ? 1 : 2);
  for (const nom of Object.keys(cases)) {
    const rangee = cases[nom].jetons;
    cases[nom].jetons = [0, 1, 2].flatMap((rang) => rangee.filter((id) => rangDe(id) === rang));
  }
  if (acteur !== null && courantDe(etat, acteur) !== null) laCase(courantDe(etat, acteur).case).active = true;
  if (enChoix?.champ === "arrivee") {
    for (const nom of enChoix.options) laCase(nom).choix = { commande: regler("arrivee", nom), nom: nomDArrivee(nom) };
  }
  return { phase: etat.phase, cases, jetons };
}

// ─── Une fiche vivante ──────────────────────────────────────────────────────

const ecrireFaces = ({ debut, fin }) => (debut === fin ? `${debut}` : `${debut}-${fin}`);

// Le modificateur qu'un PJ ajouterait à chaque dé d'un tel jet, hors de tout
// réglage : ses bonus câblés et ses blessures (« d10 +1 »).
function modificateurAffiche(etat, id, genre, mobilisees) {
  const total = somme(modificateursDe(etat, id, { genre, mobilisees: mobilisees ?? [] }).map((modificateur) => modificateur.valeur));
  return total === 0 ? "" : ` ${signer(total)}`;
}

const ecrireDegats = (degats) => (Array.isArray(degats) ? degats.join("/") : null);

// « Attaque d10 +1 · Couteau d'office, précise, 3/8/20 » : le dé de l'arme
// tenue, son modificateur, puis l'arme. Sans arme tenue, le dé se choisit au
// moment du jet.
function attaqueDuPj(etat, id, photo) {
  const tenue = photo.armes.find((arme) => !arme.mainsNues) ?? null;
  if (tenue !== null && tenue.faces !== null) {
    const parties = [tenue.libelle, POIDS[tenue.poids] ?? null, ecrireDegats(tenue.degats)].filter(present);
    return `Attaque d${tenue.faces}${modificateurAffiche(etat, id, "attaque", tenue.caracteristiques)} ${SIGNES.point} ${parties.join(", ")}`;
  }
  const nues = photo.armes.find((arme) => arme.mainsNues) ?? null;
  const suite = nues === null ? "" : ` ${SIGNES.point} ${[nues.libelle, ecrireDegats(nues.degats)].filter(present).join(", ")}`;
  return `Attaque dé au choix${suite}`;
}

// « Défense d8 +1 · agile, types mêlés ».
function defenseDuPj(etat, id, photo) {
  const de = photo.deDefense;
  if (de === null) return null;
  const parties = [POIDS[de.type] ?? null, de.meles ? "types mêlés" : null].filter(present);
  return `Défense d${de.faces}${modificateurAffiche(etat, id, "defense", de.caracteristiques)}${parties.length > 0 ? ` ${SIGNES.point} ${parties.join(", ")}` : ""}`;
}

// « Attaque 5 · Défense 7 · Spatule souple 6/12/19 » : un adversaire ne lance
// rien, ses deux nombres sont des difficultés.
function valeursDeLAdversaire(etat, id, photo) {
  const armes = photo.armes.map((arme) => [arme.libelle, ecrireDegats(arme.degats)].filter(present).join(" "));
  return [`Attaque ${attaqueDe(etat, id).valeur}`, `Défense ${defenseDe(etat, id).valeur}`, ...armes].join(` ${SIGNES.point} `);
}

const etatDeLArmure = ({ armure, armureMax }) => (armure <= 0 && armureMax > 0 ? "detruite" : armure < armureMax ? "abimee" : null);

const STATUTS = { joue: "joue", cible: "ciblé", a_joue: "a joué" };
const MARQUES = { joue: "joue", cible: "ciblee", mort: "morte" };

/**
 * La fiche vivante d'un protagoniste : son en-tête (initiales, nom entier,
 * sous-titre, statut, actions), ses jauges, la table de ses zones dans
 * l'ordre du d20, ses valeurs d'attaque et de défense, ses jauges de lien
 * (une jauge de taille 0 n'y est pas), ses passifs câblés, actifs ou non avec
 * leur raison. « jouer » porte la commande qui le choisit, s'il peut l'être ;
 * « avant », le champ « Case » et « Retirer » d'avant le lancement. null pour
 * qui n'est pas dans le combat.
 */
export function vueFiche(etat, id, choisi) {
  const photo = photoDe(etat, id);
  const courant = courantDe(etat, id);
  if (photo === null || courant === null) return null;
  const acteur = acteurCourant(etat, choisi);
  const situation = situationDe(etat, id, acteur);
  const estUnPj = courant.camp === "pj";

  return {
    id,
    camp: courant.camp,
    initiales: etat.noms?.[id]?.initiales ?? "?",
    nom: nomEntier(etat, id),
    sousTitre: photo.sousTitre,
    statut: situation === "mort" ? `mort au tour ${courant.mort.tour}` : (STATUTS[situation] ?? null),
    marques: Object.hasOwn(MARQUES, situation ?? "") ? [MARQUES[situation]] : [],
    actions: { reste: courant.actions, max: courant.actionsMax },
    souffle: { valeur: courant.souffle, max: courant.souffleMax, absent: photo.souffleAbsent === true },
    corps: { valeur: courant.corps, max: courant.corpsMax },
    zones: photo.zones.map((zone, rang) => {
      const etatDeLaZone = courant.zones[rang];
      return {
        faces: ecrireFaces(zone),
        nombreDeFaces: zone.fin - zone.debut + 1,
        nom: zone.nom,
        armure: { valeur: etatDeLaZone.armure, max: etatDeLaZone.armureMax, etat: etatDeLArmure(etatDeLaZone) },
        resistance: { valeur: etatDeLaZone.resistance, max: etatDeLaZone.resistanceMax },
      };
    }),
    contre: `${photo.faceContre} : contre-attaque`,
    attaque: estUnPj ? attaqueDuPj(etat, id, photo) : valeursDeLAdversaire(etat, id, photo),
    defense: estUnPj ? defenseDuPj(etat, id, photo) : null,
    bouclier: photo.bouclier === null ? null : `${photo.bouclier.nom} : ${photo.bouclier.defense} (sans effet)`,
    liens: photo.liens.map((lien, rang) => ({ nom: lien.nom, valeur: courant.liens[rang].points, max: courant.liens[rang].max })).filter((lien) => lien.max > 0),
    passifs: passifsDe(etat, id).map(({ nom, effet, actif, raison }) => ({ texte: `${nom} : ${effet}`, actif, raison })),
    effets: [],
    jouer: gesteEnCours(etat) === null && id !== acteur && candidats(etat).includes(id) ? { commande: { choisir: id } } : null,
    avant:
      etat.phase === "preparation"
        ? { case: courant.case, poser: { gabarit: { preparer: { type: "poser", id } } }, retirer: { commande: { preparer: { type: "retirer", id } } } }
        : null,
  };
}

// ─── Le panneau d'action : les capacités ────────────────────────────────────

// « 5 souffle », « 1 souffle, 1 lien », « X souffle » ; null pour un coût nul
// ou illisible (le bouton dit alors pourquoi il est inactif).
function ecrireCout(cout) {
  if (cout === null) return null;
  const parties = [];
  if (cout.souffle === "X" || cout.souffle > 0) parties.push(`${cout.souffle} souffle`);
  if (cout.lien === "X" || cout.lien > 0) parties.push(`${cout.lien} lien`);
  return parties.length > 0 ? parties.join(", ") : null;
}

// Les boutons de capacité de qui joue, tels que l'offre les donne. Le bouton
// de la capacité jouée par un PJ suit la puissance du geste : c'est elle qui
// sera jouée. Une fois le geste payé, plus aucune capacité ne se choisit.
function boutonsVus(etat, acteur, geste) {
  const photo = photoDe(etat, acteur);
  const parFacon = campDe(etat, acteur) !== "pj";
  const paye = geste !== null && geste.moment !== "preparation";
  return boutons(etat, acteur).map((offert) => {
    const capacite = photo.capacites[offert.capacite];
    const jouee = geste !== null && geste.capacite === offert.capacite;
    let { facon: rang, actif, raison } = offert;
    if (jouee && !parFacon && rang !== null) {
      const jugee = faconsDe(etat, acteur, offert.capacite)[geste.facon];
      if (jugee) ({ facon: rang, actif, raison } = jugee);
    }
    if (paye && rang !== null) {
      actif = false;
      raison = ACTION_EN_COURS;
    }
    const facon = element(capacite.facons, rang);
    const groupe = parFacon && facon !== null && facon.arme !== null ? { genre: "arme", titre: element(photo.armes, facon.arme)?.libelle ?? capacite.groupe.titre } : capacite.groupe;
    return {
      groupe,
      bouton: {
        cle: `${offert.capacite}:${rang ?? ""}`,
        libelle: libelleDe(capacite, facon),
        degats: facon !== null && facon.attaque ? ecrireDegats(facon.degats) : null,
        cout: facon === null ? null : ecrireCout(facon.cout),
        desavantage: facon !== null && facon.desavantage === true,
        choisi: jouee && (!parFacon || geste.facon === rang),
        actif,
        raison,
        commande: rang === null ? null : { evenement: { type: "capacite", qui: acteur, capacite: offert.capacite, facon: rang } },
      },
    };
  });
}

// Les groupes du panneau. Un PJ : un groupe s'ouvre quand le genre ou le
// titre change, dans l'ordre de ses capacités. Un adversaire : une ligne par
// arme, avec les façons qu'elle donne, puis « Capacités » ; une capacité que
// donnent deux armes a un bouton sous chacune.
function grouper(vus, parArme) {
  const groupes = [];
  for (const { groupe, bouton } of vus) {
    const meme = (un) => un.genre === groupe.genre && un.titre === groupe.titre;
    let cible = parArme ? (groupes.find(meme) ?? null) : groupes.length > 0 && meme(groupes[groupes.length - 1]) ? groupes[groupes.length - 1] : null;
    if (cible === null) {
      cible = { genre: groupe.genre, titre: groupe.titre, boutons: [] };
      groupes.push(cible);
    }
    cible.boutons.push(bouton);
  }
  return groupes.map(({ titre, boutons: lesBoutons }) => ({ titre, boutons: lesBoutons }));
}

// La ligne qui nomme ce qui n'a pas de bouton à soi : les passifs, et les
// interventions (qui en ont un à son propre tour).
function mentionsDe(photo) {
  const passifs = photo.capacites.filter((capacite) => capacite.facons.length > 0 && capacite.facons.every((facon) => facon.passif));
  const interventions = photo.capacites.filter((capacite) => capacite.facons.some((facon) => facon.intervention && !facon.passif));
  return {
    passifs: passifs.length > 0 ? passifs.map((capacite) => `${capacite.nom}${capacite.evolue ? ` [${capacite.niveau}]` : ""}`).join(", ") : null,
    interventions: interventions.length > 0 ? interventions.map((capacite) => capacite.nom).join(", ") : null,
  };
}

// ─── Le panneau d'action : les étapes ───────────────────────────────────────

const nomDuJet = (etat, geste) => (geste?.mode === "caracteristique" ? "Jet de caractéristique" : campDe(etat, geste?.acteur) === "pj" ? "Jet d'attaque" : "Jet de défense");

// Les étapes d'un geste, et le rang de celle qui est en cours.
function etapesDe(etat, acteur, geste, offerts) {
  const jet = geste === null ? (campDe(etat, acteur) === "pj" ? "Jet d'attaque" : "Jet de défense") : nomDuJet(etat, geste);
  const entieres = ["Capacité", "Cible", jet, "Localisation", "Interventions", "Dégâts"];
  if (geste === null) return { noms: entieres, enCours: 0 };
  if (geste.mode === "deplacement") return { noms: ["Capacité", "Arrivée"], enCours: 1 };
  if (geste.mode === "sans_jet") return { noms: ["Capacité", "Cible"], enCours: 1 };
  if (geste.mode === "caracteristique") return { noms: ["Capacité", jet], enCours: 1 };
  const parMoment = {
    preparation: offerts.pret?.ok ? 2 : 1,
    jet: 2,
    bilan: 2,
    localisation: 3,
    suites: offerts.esquive !== null ? 4 : 5,
  };
  return { noms: entieres, enCours: parMoment[geste.moment] ?? 5 };
}

function etapesVues(etat, acteur, geste, offerts) {
  const { noms, enCours } = etapesDe(etat, acteur, geste, offerts);
  return noms.map((nom, rang) => ({ nom, etat: rang < enCours ? "faite" : rang === enCours ? "en_cours" : "a_venir" }));
}

// ─── Le panneau d'action : le geste ─────────────────────────────────────────

// Le jet d'un geste : celui qui s'est figé au premier dé ; avant, celui qui
// se figerait à cet instant (il suit la cible et les réglages) ; null tant
// qu'il manque de quoi l'ouvrir.
function jetDe(etat, geste) {
  if (geste.jet) return geste.jet;
  if (!["attaque", "jet_prete", "caracteristique"].includes(geste.mode)) return null;
  const lues = circonstances(etat, geste);
  return lues.manque ? null : ouvrirJet(lues);
}

const nomDeCaracteristique = (code) => CARACTERISTIQUES.find((caracteristique) => caracteristique.code === code)?.nom ?? code;

// « +1 (Vif) », « −2 (blessures) », « +1 (à la main : Minutie) ».
function ecrireModificateur({ genre, nom, valeur }) {
  const source = genre === "blessures" ? "blessures" : genre === "main" ? `à la main : ${nom}` : `${nom}`;
  return `${signer(valeur)} (${source})`;
}

function ecrireNet(jet) {
  const net = netDe(jet);
  if (net !== 0) return compter(Math.abs(net), net > 0 ? "avantage" : "désavantage");
  return jet.avantages.length > 0 && jet.desavantages.length > 0 ? "avantages et désavantages s'annulent" : null;
}

const DIFFICULTE_DITE = { attaque: "sa défense", defense: "son attaque" };

// Le contexte du jet : qui lance quoi, contre quoi, avec quels modificateurs,
// avantages et désavantages, chacun avec sa source. Avant le premier dé, il
// porte aussi les deux réglages à la main. Le dé s'y écrit nu (« d8 ») : ses
// modificateurs le suivent, chacun une fois, avec sa source. Écrit « d8+1 »
// devant « +1 (Vif) », il se lisait d8+1+1.
function contexteVu(etat, geste, capacite, facon, jet, offerts) {
  const cible = present(geste.cible) ? ` contre ${nomEntier(etat, geste.cible)}` : "";
  const titre = `${nomDuJet(etat, geste)} ${SIGNES.point} ${libelleDe(capacite, facon)}${cible}`;

  const aLaMain = (champ) => {
    const offert = offerts.reglages[champ];
    return {
      valeur: offert.valeur,
      raison: geste.reglages?.[champ]?.raison ?? null,
      min: offert.min,
      max: offert.max,
      raisonParDefaut: raisonDepuis(capacite.nom),
      gabarit: gabaritDe(champ),
    };
  };
  const reglages = Object.hasOwn(offerts.reglages, "modificateur") ? { modificateur: aLaMain("modificateur"), avantages: aLaMain("avantages") } : null;

  if (jet === null) return { titre, de: null, detail: null, modificateurs: [], difficulte: null, avantages: [], desavantages: [], net: null, reglages };
  const valeurs = photoDe(etat, jet.lanceur)?.caracteristiques ?? {};
  return {
    titre,
    de: `d${jet.faces}`,
    detail: jet.mobilisees.map((code) => `${nomDeCaracteristique(code)} ${valeurs[code] ?? "?"}`).join(" + "),
    modificateurs: jet.modificateurs.map(ecrireModificateur),
    difficulte: `${jet.difficulte}, ${jet.libelle ?? DIFFICULTE_DITE[jet.genre]}`,
    avantages: jet.avantages.map(ecrireSource),
    desavantages: jet.desavantages.map(ecrireSource),
    net: ecrireNet(jet),
    reglages,
  };
}

// Le détail d'un dé lancé : « 8 + 1 » ; sous désavantage, « 8/4 → 4 + 1 » ;
// avec ses explosions, brutes, « 6 + 1 + 3 ». null quand la valeur dit tout.
function detailDeLEssai(jet, essai, { garde }) {
  const modificateur = modificateurDe(jet);
  const parties = [`${garde}`];
  if (modificateur !== 0) parties.push(`${modificateur < 0 ? SIGNES.moins : "+"} ${Math.abs(modificateur)}`);
  for (const ajout of essai.explosions) parties.push(`+ ${ajout}`);
  const lancers = essai.tirages.length > 1 ? `${essai.tirages.join("/")} ${SIGNES.fleche} ` : "";
  return lancers === "" && parties.length === 1 ? null : `${lancers}${parties.join(" ")}`;
}

// La chaîne : une entrée par dé lancé (le dé d'origine d'une place, puis
// chacune de ses relances), le dé à lancer, puis les places à venir. Un dé
// qui montre sa face maximale sous la difficulté n'est ni réussi ni échoué :
// il reste « à lancer », et c'est lui qu'on clique pour le faire exploser.
function chaineVue(jet) {
  const de = `d${jet.faces}`;
  const entrees = [];
  const derniere = jet.places.length - 1;
  const explose = jet.attente === "choix_explosion" || jet.attente === "de_explosion";
  jet.places.forEach((place, rang) => {
    place.essais.forEach((essai, numero) => {
      const evalue = evaluerEssai(jet, essai);
      const enJeu = rang === derniere && numero === place.essais.length - 1;
      let etat = evalue.reussi ? "reussi" : "echoue";
      if (numero < place.essais.length - 1 || (enJeu && jet.attente === "de_relance")) etat = "relance";
      else if (enJeu && explose) etat = "a_lancer";
      entrees.push({ titre: numero === 0 ? RANGS[rang] : "relance", etat, valeur: evalue.somme, detail: detailDeLEssai(jet, essai, evalue) });
    });
  });
  if (jet.attente === "de_relance") entrees.push({ titre: "relance", etat: "a_lancer", de });
  if (jet.attente === "de") entrees.push({ titre: RANGS[jet.places.length], etat: "a_lancer", de });
  if (jet.attente !== "fini") {
    for (let rang = jet.places.length + (jet.attente === "de" ? 1 : 0); rang < REUSSITES_MAX; rang += 1) entrees.push({ titre: RANGS[rang], etat: "a_venir", de });
  }
  return entrees;
}

// Ce que dit le bilan pendant la chaîne, selon ce que le jet attend. La
// relance reprend la tête, comme sur la maquette : « 1 réussite pour
// l'instant. Avantage dépensé : … ».
const BILANS_DU_JET = {
  de: (jet, tete) => `${tete} Cliquez sur le d${jet.faces} pour lancer le ${RANGS[jet.places.length]}.`,
  choix_relance: (jet, tete) => `${tete} Le ${RANGS[jet.places.length - 1]} échoue : il reste ${compter(relancesRestantes(jet), "avantage")}.`,
  de_relance: (jet, tete) => `${tete} Avantage dépensé : cliquez sur le d${jet.faces} pour relancer le ${RANGS[jet.places.length - 1]}.`,
  choix_explosion: (jet) => `Le ${RANGS[jet.places.length - 1]} montre sa face maximale sans atteindre la difficulté : il peut exploser.`,
  de_explosion: (jet) => `Cliquez sur le d${jet.faces} pour faire exploser le ${RANGS[jet.places.length - 1]}.`,
};

function bilanVu(etat, geste, jet, offerts) {
  if (geste.moment === "preparation") {
    if (!offerts.pret.ok) return offerts.pret.manque;
    if (offerts.de === null) return null;
    const plusieurs = offerts.de.combien > 1 ? ` Il se lance ${offerts.de.combien} fois : le pire est gardé.` : "";
    return `Cliquez sur le d${offerts.de.faces} pour lancer le ${RANGS[0]}.${plusieurs}`;
  }
  if (jet === null) return null;
  if (geste.moment === "jet") {
    const nombre = reussites(jet);
    const tete = nombre === 0 ? "Aucune réussite pour l'instant." : `${compter(nombre, "réussite")} pour l'instant.`;
    return Object.hasOwn(BILANS_DU_JET, jet.attente) ? BILANS_DU_JET[jet.attente](jet, tete) : tete;
  }
  return `${majuscule(ecrireBilan(etat, geste))}.`;
}

// L'arme qui prête son jet ; null quand il se fait « sans arme ».
const armePreteeDe = (etat, geste) => element(photoDe(etat, geste.acteur)?.armes, geste.armePretee);

// Les trois dégâts que le geste lit : ceux de la façon jouée pour une
// attaque, ceux de l'arme prêtée pour un jet prêté.
function tarifDe(etat, geste, facon) {
  if (geste.mode === "attaque") return facon.degats ?? null;
  if (geste.mode === "jet_prete") return armePreteeDe(etat, geste)?.degats ?? null;
  return null;
}

// Les rangs de dégâts, le rang atteint en évidence, puis dégrossir. En
// attaque, le rang monte avec les réussites ; en défense il descend, et ne se
// connaît qu'à la fin de la chaîne.
function lettresVues(etat, geste, facon, jet) {
  const tarif = tarifDe(etat, geste, facon);
  if (tarif === null) return null;
  const enDefense = campDe(etat, geste.acteur) !== "pj";
  const fini = geste.moment !== "preparation" && geste.moment !== "jet";
  const atteinte = jet !== null && jet.places.length > 0 && (fini || !enDefense) ? lettreDe(enDefense ? "defense" : "attaque", reussites(jet)) : null;
  const lignes = [0, 1, 2, 3].map((nombre) => {
    const lettre = lettreDe(enDefense ? "defense" : "attaque", nombre);
    if (lettre === null) return enDefense ? { texte: `${nombre} : aucun dégât` } : null;
    const tete = nombre === 0 ? "aucune réussite" : nombre === 1 ? "1 réussite" : `${nombre}`;
    return lettre === atteinte ? { texte: `${tete} : ${tarif[lettre]}`, atteinte: true } : { texte: `${tete} : ${tarif[lettre]}` };
  });
  const degrossir = passifsDe(etat, geste.acteur).find((passif) => passif.role === "degrossir" && passif.niveau > 0) ?? null;
  if (degrossir !== null) lignes.push({ texte: `${degrossir.nom} : ${degrossir.effet}` });
  return lignes.filter(present);
}

const LIBELLES_DE_NATURE = { normaux: "Dégâts normaux", resistance: "Directs, à la résistance", corps: "Directs, au corps" };

// Les dégâts à fixer, à la fin du jet : la base, un nombre et sa raison, la
// nature. Choisir une base retire le nombre saisi ; des dégâts directs
// exigent un nombre et une raison, que la commande d'une nature porte donc
// toujours (à défaut, les dégâts du moment et le nom de la capacité).
function degatsVus(etat, geste, capacite, facon, offerts) {
  if (offerts.degats === null) return null;
  const fixes = degatsFixes(etat, geste);
  const operations = (geste.degats?.operations ?? []).map(({ op, valeur, raison }) => ({ op, valeur, raison }));
  const saisi = operations.findLast((operation) => operation.op === "ajuster") ?? null;
  const raisonParDefaut = raisonDepuis(capacite.nom);
  const commande = (base, lesOperations, nature) => ({ evenement: { type: "degats", base, operations: lesOperations, nature } });
  const lettre = lettreDe(geste.jet.genre, reussites(geste.jet));
  const chiffrer = (tarif) => (tarif !== null && lettre !== null ? ` (${LETTRES[lettre]} = ${tarif[lettre]})` : "");
  const libelles = {
    lettre: `Dégâts du rang${chiffrer(facon.degats ?? null)}`,
    arme: `Dégâts de l'arme${chiffrer(armePreteeDe(etat, geste)?.degats ?? null)}`,
    aucun: "Sans dégâts",
  };
  return {
    bases: offerts.degats.bases.map((base) => ({ libelle: libelles[base], choisie: fixes.base === base, commande: commande(base, [], "normaux") })),
    saisie: {
      valeur: fixes.valeur,
      raison: saisi?.raison ?? null,
      raisonParDefaut,
      min: 0,
      max: offerts.degats.max,
      gabarit: { evenement: { type: "degats", base: fixes.base, nature: fixes.nature } },
    },
    natures: offerts.degats.natures.map((nature) => {
      const directs = saisi !== null ? [saisi] : [{ op: "ajuster", valeur: Math.min(fixes.valeur, offerts.degats.max), raison: raisonParDefaut }];
      return { libelle: LIBELLES_DE_NATURE[nature], choisie: fixes.nature === nature, commande: commande(fixes.base, nature === "normaux" ? operations : directs, nature) };
    }),
  };
}

// Les d20 lancés, chacun avec sa face, sa zone, et le décalage qu'on peut
// encore lui donner.
function localisationVue(etat, geste, offerts) {
  const victime = photoDe(etat, geste.cible);
  if (victime === null || geste.localisation.length === 0) return null;
  return geste.localisation.map(({ brut, decalage }, rang) => {
    const lu = localiser(victime, brut, decalage?.valeur ?? 0);
    if (lu.contre) return { brut, face: brut, zone: "contre-attaque", decaler: null };
    const borne = offerts.decalages.find((un) => un.de === rang) ?? null;
    return {
      brut,
      face: lu.face,
      zone: minuscule(element(victime.zones, lu.zone)?.nom ?? "?"),
      decaler:
        borne === null
          ? null
          : {
              valeur: decalage?.valeur ?? null,
              raison: decalage?.raison ?? null,
              min: borne.min,
              max: borne.max,
              raisonParDefaut: raisonDepuis(capaciteDe(etat, geste.acteur, geste.capacite)?.nom),
              gabarit: { evenement: { type: "decaler", de: rang } },
            },
    };
  });
}

// Le détail des dégâts, avant « Appliquer » : ce que chaque coup changerait,
// esquive comprise. Les coups frappent une copie : rien n'est appliqué.
function detailVu(etat, geste) {
  const victime = photoDe(etat, geste.cible);
  const courant = courantDe(etat, geste.cible);
  if (victime === null || courant === null) return null;
  const change = ([avant, apres], mot) => (avant === apres ? null : `${mot} ${avant} ${SIGNES.fleche} ${apres}`);
  return frapper(courant, coupsDuGeste(etat, geste)).coups.map((coup) => {
    const parties = [change(coup.armure, "armure"), change(coup.resistance, "résistance"), change(coup.corps, "corps")].filter(present);
    return { zone: element(victime.zones, coup.zone)?.nom ?? "?", texte: parties.length > 0 ? parties.join(", ") : "aucun dégât" };
  });
}

// La puissance d'une capacité d'un PJ qui en a plusieurs : sa valeur, et les
// deux boutons qui passent à la façon voisine. Un voisin qu'il ne peut pas
// jouer garde sa commande, inactive, avec sa raison.
function puissanceVue(etat, geste, facon, offerts) {
  if (campDe(etat, geste.acteur) !== "pj" || !Object.hasOwn(offerts.reglages, "facon")) return null;
  const jugees = faconsDe(etat, geste.acteur, geste.capacite);
  const vers = (rang) => {
    const jugee = element(jugees, rang);
    if (jugee === null) return { actif: false, raison: null, commande: null };
    return { actif: jugee.actif, raison: jugee.raison, commande: regler("facon", rang) };
  };
  return { valeur: facon.puissance, moins: vers(geste.facon - 1), plus: vers(geste.facon + 1) };
}

// « Jet d'attaque » : le bouton qui prête à une capacité sans jet celui d'une
// arme. Il dit quelle arme : celle qui est prêtée ; sinon celle qui le serait.
function jetPreteVu(etat, geste, offerts) {
  if (!Object.hasOwn(offerts.reglages, "jet_prete")) return null;
  const photo = photoDe(etat, geste.acteur);
  const presse = geste.mode === "jet_prete";
  const rang = presse ? geste.armePretee : campDe(etat, geste.acteur) === "pj" ? photo.armePretee : photo.armes.length > 0 ? 0 : null;
  return { presse, actif: true, raison: null, commande: regler("jet_prete", !presse), arme: element(photo.armes, rang)?.libelle ?? "sans arme" };
}

function caracteristiquesVues(etat, geste, offerts) {
  if (!Object.hasOwn(offerts.reglages, "caracteristiques")) return null;
  const valeurs = photoDe(etat, geste.acteur)?.caracteristiques ?? {};
  const choisies = [...(geste.caracteristiques ?? [])];
  const de = choisies.length === 0 ? null : deDuJet(valeurs[choisies[0]], valeurs[choisies[choisies.length - 1]]);
  return {
    choisies,
    de: de?.de ?? null,
    gabarit: gabaritDe("caracteristiques"),
    options: CARACTERISTIQUES.filter(({ code }) => offerts.reglages.caracteristiques.options.includes(code)).map(({ code, nom }) => ({ code, nom, valeur: valeurs[code] ?? null })),
  };
}

// Les cibles du geste. Tant qu'il se règle : celles qu'il pourrait viser,
// possibles ou non, chacune avec sa raison. Une fois payé : la seule cible
// choisie, enfoncée et inactive. La rangée « Cible : » reste ainsi montrée
// pendant le jet, comme sur la maquette, sans rien offrir : le moteur
// refuserait d'en changer.
function ciblesVues(etat, geste) {
  if (geste.moment === "preparation") {
    return cibles(etat).map(({ id, possible, raison }) => ({ id, libelle: nomEntier(etat, id), choisie: geste.cible === id, actif: possible, raison, commande: regler("cible", id) }));
  }
  if (!present(geste.cible)) return [];
  return [{ id: geste.cible, libelle: nomEntier(etat, geste.cible), choisie: true, actif: false, raison: ACTION_EN_COURS, commande: regler("cible", geste.cible) }];
}

const LIBELLES_DE_CHOIX = {
  relancer: (jet) => `Relancer le ${RANGS[jet.places.length - 1]}`,
  garder: () => "Garder ce dé",
  exploser: () => "Faire exploser",
};

// Le geste en cours, tel que le panneau le montre : ce qui se règle, le
// contexte du jet, la chaîne, le bilan, puis les choix du moment.
function gesteVu(etat, geste, offerts) {
  const capacite = capaciteDe(etat, geste.acteur, geste.capacite);
  const facon = faconDe(etat, geste);
  if (capacite === null || facon === null) return null;
  const photo = photoDe(etat, geste.acteur);
  const enPreparation = geste.moment === "preparation";
  const jet = jetDe(etat, geste);
  const aJet = ["attaque", "jet_prete", "caracteristique"].includes(geste.mode);
  const reglables = offerts.reglages;
  const offert = (champ) => Object.hasOwn(reglables, champ);
  const esquive = esquiveOfferte(etat);

  return {
    description: facon.description,
    puissance: puissanceVue(etat, geste, facon, offerts),
    jetPrete: jetPreteVu(etat, geste, offerts),
    armes: offert("arme_pretee") ? reglables.arme_pretee.options.map((rang) => ({ libelle: photo.armes[rang].libelle, choisie: geste.armePretee === rang, commande: regler("arme_pretee", rang) })) : null,
    cibles: ciblesVues(etat, geste),
    sansCible: offert("cible") && reglables.cible.options.includes(null) ? { choisie: geste.cible === null, commande: regler("cible", null) } : null,
    cases: offert("arrivee") ? reglables.arrivee.options.map((nom) => ({ case: nom, nom: nomDArrivee(nom), choisie: geste.arrivee === nom, commande: regler("arrivee", nom) })) : null,
    caracteristiques: caracteristiquesVues(etat, geste, offerts),
    difficultes: offert("difficulte")
      ? Object.keys(DIFFICULTES)
          .map(Number)
          .filter((valeur) => valeur >= reglables.difficulte.min && valeur <= reglables.difficulte.max)
          .map((valeur) => ({ valeur, libelle: DIFFICULTES[valeur], choisie: geste.difficulte === valeur, commande: regler("difficulte", valeur) }))
      : null,
    x: offert("x") ? { valeur: reglables.x.valeur, min: reglables.x.min, max: reglables.x.max, gabarit: gabaritDe("x") } : null,
    jauges: offert("jauge") ? reglables.jauge.options.map((rang) => ({ nom: photo.liens[rang].nom, choisie: reglables.jauge.valeur === rang, commande: regler("jauge", rang) })) : null,
    contexte: aJet ? contexteVu(etat, geste, capacite, facon, jet, offerts) : null,
    chaine: jet === null ? [] : chaineVue(jet),
    aLancer: offerts.de === null ? null : { faces: offerts.de.faces, combien: offerts.de.combien, libelle: `d${offerts.de.faces}`, motif: offerts.de.motif },
    bilan: bilanVu(etat, geste, jet, offerts),
    lettres: lettresVues(etat, geste, facon, jet),
    choix: offerts.choix.map((cle) => ({ cle, libelle: LIBELLES_DE_CHOIX[cle](geste.jet), commande: { evenement: { type: cle } } })),
    degats: degatsVus(etat, geste, capacite, facon, offerts),
    localisation: localisationVue(etat, geste, offerts),
    esquive: esquive === null ? null : { libelle: capaciteDe(etat, geste.cible, esquive.capacite)?.nom ?? "", min: esquive.min, max: esquive.max, gabarit: { evenement: { type: "esquive" } } },
    detail: geste.moment === "suites" ? detailVu(etat, geste) : null,
    appliquer: offerts.types.includes("appliquer") ? { libelle: "Appliquer", commande: { evenement: { type: "appliquer" } } } : null,
    confirmer:
      enPreparation && !aJet ? { libelle: "Confirmer", actif: offerts.pret.ok, raison: offerts.pret.ok ? null : offerts.pret.manque, commande: { evenement: { type: "confirmer" } } } : null,
    revenir: enPreparation ? { commande: { evenement: { type: "revenir" } } } : null,
  };
}

// La commande qui attend : c'est là que l'écran pose le focus. null : le
// titre du panneau.
function focusDe(geste, vu, offerts) {
  if (vu === null) return null;
  if (vu.aLancer !== null) return "de";
  if (vu.choix.length > 0) return `choix:${vu.choix[0].cle}`;
  if (vu.appliquer !== null) return "appliquer";
  if (geste.moment !== "preparation") return null;
  if (offerts.pret.ok) return vu.confirmer !== null ? "confirmer" : null;
  if (vu.cases !== null && !vu.cases.some((une) => une.choisie)) return vu.cases.length > 0 ? `case:${vu.cases[0].case}` : null;
  const possible = vu.cibles.find((cible) => cible.actif) ?? null;
  if (["attaque", "jet_prete"].includes(geste.mode) && !vu.cibles.some((cible) => cible.choisie && cible.actif)) return possible === null ? null : `cible:${possible.id}`;
  if (vu.caracteristiques !== null && vu.caracteristiques.choisies.length === 0) return `caracteristique:${vu.caracteristiques.options[0]?.code ?? ""}`;
  if (vu.difficultes !== null && !vu.difficultes.some((une) => une.choisie)) return `difficulte:${vu.difficultes[0]?.valeur ?? ""}`;
  return null;
}

const PANNEAU_VIDE = { candidats: [], titre: null, etapes: [], groupes: [], passer: null, mentions: null, geste: null, vainqueur: null, focus: null };

/**
 * Le panneau d'action. « genre » dit ce qu'il montre :
 * - « preparation » : rien, l'écran montre la préparation à sa place ;
 * - « qui_joue » : un bouton par protagoniste qui peut encore agir ;
 * - « action » : le titre (nom entier, actions, souffle), les étapes, les
 *   capacités groupées par origine, « Passer son tour », la ligne des passifs
 *   et des interventions, puis le geste en cours ;
 * - « termine » : la phrase de la victoire.
 * « annonce » est ce que dit la région d'annonce ; « focus », la commande qui
 * attend.
 */
export function vuePanneau(etat, choisi) {
  const annonce = etat.annonce ?? null;
  if (etat.phase === "preparation") return { genre: "preparation", ...PANNEAU_VIDE, annonce };
  if (etat.phase !== "combat") return { genre: "termine", ...PANNEAU_VIDE, annonce, vainqueur: present(etat.vainqueur) ? ligneDeFin(etat.vainqueur) : null };

  const acteur = acteurCourant(etat, choisi);
  const courant = courantDe(etat, acteur);
  const photo = photoDe(etat, acteur);
  if (acteur === null || courant === null || photo === null) {
    const liste = candidats(etat).map((id) => ({ id, nom: nomEntier(etat, id), commande: { choisir: id } }));
    return { genre: "qui_joue", ...PANNEAU_VIDE, annonce, candidats: liste, focus: liste.length > 0 ? `candidat:${liste[0].id}` : null };
  }

  const geste = gesteEnCours(etat);
  const offerts = offre(etat);
  const libre = offerts.types.includes("passer") && candidats(etat).includes(acteur);
  const vu = geste === null ? null : gesteVu(etat, geste, offerts);
  return {
    genre: "action",
    candidats: [],
    titre: `${nomEntier(etat, acteur)} joue ${SIGNES.tiret} ${compter(courant.actions, "action")} sur ${courant.actionsMax}, souffle ${photo.souffleAbsent ? SIGNES.tiret : courant.souffle}`,
    etapes: etapesVues(etat, acteur, geste, offerts),
    groupes: grouper(boutonsVus(etat, acteur, geste), courant.camp !== "pj"),
    passer: { actif: libre, raison: libre ? null : ACTION_EN_COURS, commande: { evenement: { type: "passer", qui: acteur } } },
    mentions: mentionsDe(photo),
    geste: vu,
    annonce,
    vainqueur: null,
    focus: focusDe(geste, vu, offerts),
  };
}

// ─── La préparation ─────────────────────────────────────────────────────────

const LIBELLES_DE_CAMP = { pj: "Les PJ", adv: "Les adversaires" };
const BANQUE_SANS_ADVERSAIRE = "Cette banque n'a aucun adversaire.";
// Le texte de la mission (§ 10.7), tel quel : sans point final.
const RENCONTRE_VIDE = "Composez d'abord une rencontre";

// De quoi demander à la préparation ce qu'elle refuserait, sans photographie :
// elle ne lit d'un ajout que le camp, l'identifiant et le nom. Ses phrases de
// refus (déjà présent, plafonds) ne s'écrivent ainsi qu'une fois, chez elle.
const sondeDePersonnage = (cle, nom) => ({ camp: "pj", valeurs: { identifiant: cle, nom } });
const sondeDAdversaire = (nom) => ({ camp: "adv", valeurs: { identifiant: null, nom } });

/**
 * La préparation, d'après la mise en place et ce que l'écran apporte de la
 * banque et de l'appareil (« apports ») :
 * - personnages : ceux qu'on peut ajouter, chacun actif ou non avec sa raison
 *   (il ne s'ajoute pas, il est déjà dans le combat, le plafond est atteint) ;
 *   « attente » tant que leur lecture est en cours ;
 * - adversaires : de même, avec « max », les exemplaires encore possibles ;
 *   « vide », la phrase d'une banque sans adversaire ;
 * - rencontre : « Placer la rencontre préparée », inactif si elle est vide ou
 *   si elle dépasserait un plafond ;
 * - quiCommence, lancer, la ligne des câblés absents, et les avertissements
 *   des photographies posées.
 */
export function vuePreparation(miseEnPlace, apports) {
  const adversairesPresents = miseEnPlace.protagonistes.filter((protagoniste) => protagoniste.camp === "adv");
  const refusDe = (rendu) => rendu.refus ?? null;

  const personnages = (apports.personnages ?? []).map(({ cle, nom, refus }) => {
    const raison = refus ?? refusDe(ajouterPersonnage(miseEnPlace, sondeDePersonnage(cle, nom)));
    return { cle, nom, actif: raison === null, raison };
  });

  const adversaires = (apports.adversaires ?? []).map(({ nom, refus }) => {
    const exemplaires = adversairesPresents.filter((protagoniste) => protagoniste.photo.valeurs.nom === nom).length;
    const max = Math.max(0, Math.min(PLAFOND_ADVERSAIRES - adversairesPresents.length, PLAFOND_EXEMPLAIRES - exemplaires));
    const raison = refus ?? refusDe(ajouterAdversaires(miseEnPlace, [sondeDAdversaire(nom)]));
    return { nom, actif: raison === null, raison, max };
  });

  // Un adversaire de la rencontre qui ne s'ajoute pas est laissé : l'écran le
  // dit. Seuls ceux qui se poseraient comptent pour les plafonds.
  const posables = (apports.rencontre ?? []).filter(({ nom }) => (apports.adversaires ?? []).some((adversaire) => adversaire.nom === nom && !present(adversaire.refus)));
  const sondes = posables.flatMap(({ nom, nombre }) => Array.from({ length: Math.max(0, Math.min(nombre, PLAFOND_ADVERSAIRES + 1)) }, () => sondeDAdversaire(nom)));
  const raisonDeLaRencontre = (apports.rencontre ?? []).length === 0 ? RENCONTRE_VIDE : refusDe(ajouterAdversaires(miseEnPlace, sondes));

  const lancement = peutLancer(miseEnPlace);
  const avertissements = [];
  for (const { photo } of miseEnPlace.protagonistes) {
    for (const avertissement of photo.avertissements ?? []) {
      const texte = `${photo.valeurs.nom} ${SIGNES.tiret} ${avertissement}`;
      if (!avertissements.includes(texte)) avertissements.push(texte);
    }
  }

  return {
    personnages: { attente: !present(apports.personnages), phrases: [...(apports.phrases ?? [])], options: personnages },
    adversaires: { options: adversaires, vide: (apports.adversaires ?? []).length === 0 ? BANQUE_SANS_ADVERSAIRE : null },
    rencontre: { actif: raisonDeLaRencontre === null, raison: raisonDeLaRencontre },
    quiCommence: ["pj", "adv"].map((camp) => ({ camp, libelle: LIBELLES_DE_CAMP[camp], choisi: miseEnPlace.quiCommence === camp, commande: { preparer: { type: "qui_commence", camp } } })),
    lancer: { actif: lancement.ok, raison: lancement.ok ? null : lancement.raison },
    absents: apports.absents ?? null,
    avertissements,
  };
}
