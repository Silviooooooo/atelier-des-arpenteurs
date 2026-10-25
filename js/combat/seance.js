// La séance d'un combat : le lien entre l'écran, le moteur et le gardien
// (SPECIFICATION.md, § 17, « Le simulateur de combat (lot 4) »).
//
// Elle existe pour que l'écran n'ait qu'une porte : il lui passe les
// commandes des vues, elle tient le combat du moment (la mise en place, la
// suite des événements, l'état que le moteur en tire, et qui est choisi pour
// jouer), et chaque changement accepté part au gardien, qui le chiffre et le
// garde. C'est elle aussi qui rouvre un combat gardé : elle le fait valider,
// puis rejouer, et dit ce qui ne se reprend pas.
//
// Aucun état de module : tout vit dans la séance que rend creerSeance(), et
// l'écran seul la garde en mémoire. Rien ici ne touche au DOM, à la banque ni
// à la clé de table.
//
// Au groupe 2 (contrat du groupe, § 2.8, § 4.3, § 6.3 ; § 17.8 et § 17.3) :
// - un combat gardé peut compter 15 000 événements. Son rejeu rend la main
//   au navigateur entre deux tranches (le générateur rejeu() du moteur) ;
//   pendant ce temps, l'écran garde son attente, et rien n'est installé. Une
//   génération, montée par ouvrir(), reprendre() et « Nouveau combat »,
//   départage les demandes : un rejeu dont la génération a changé
//   n'installe rien, et rend { issue: "abandonne" }, que l'écran ignore ;
// - « Annuler le dernier geste » ferme la bulle : personne n'est plus
//   choisi ;
// - la case d'arrivée d'un déplacement peut porter deux événements (la
//   façon, puis l'arrivée) : { evenements } les joue tous, ou aucun.

import { appliquer, gesteEnCours, ouvrirCombat, rejeu } from "./moteur.js";
import { acteurCourant, candidats, offre } from "./offre.js";
import { ajouterAdversaires, ajouterPersonnage, miseEnPlaceVide, poser, reglerQuiCommence, retirer } from "./preparation.js";
import { validerContenu, validerEvenement, validerPhoto } from "./forme.js";
import { REGLES } from "./regles.js";

const deuxChiffres = (nombre) => String(nombre).padStart(2, "0");

/**
 * L'heure locale d'une date, en composantes : « 2026-10-11T23:05 ». C'est le
 * seul endroit où l'heure entre dans un combat (l'événement « lancer » la
 * porte) : le noyau ne lit jamais l'horloge, et le rejeu retrouve le journal
 * au signe près, quel que soit le fuseau de l'appareil qui relit.
 */
export function heureMurale(date) {
  const annee = String(date.getFullYear()).padStart(4, "0");
  const jour = `${annee}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
  return `${jour}T${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;
}

const refuser = (code, message) => ({ refus: { code, message } });

const PAS_CANDIDAT = "Ce protagoniste ne peut pas jouer à cet instant.";
const GESTE_EN_COURS = "Le geste en cours se finit d'abord.";
const DEJA_LANCE = "Le combat est déjà lancé.";
const AUCUN_DE = "Aucun dé n'est attendu à cet instant.";
const COMMANDE_INCONNUE = "Cette commande n'est pas de celles de la séance.";
const BLOQUE = "Le combat ne se joue pas à cet instant.";

// Les issues de l'ouverture qui ne viennent pas d'un texte lu.
const ISSUE_DU_CODE = { sans_cle: "sans_cle", cle: "illisible", illisible: "illisible", format_recent: "recent" };

// Une commande { evenements } en porte de 1 à 4 (contrat du groupe 2, § 6.3) :
// la case d'un déplacement en porte deux.
const EVENEMENTS_PAR_COMMANDE = 4;

// Ce que rend une ouverture qu'une demande plus récente a remplacée.
const ABANDONNE = Object.freeze({ issue: "abandonne" });

// Rendre la main au navigateur : la tâche suivante, après ce qu'il a à faire.
const tacheSuivante = () => new Promise((reprendre) => setTimeout(reprendre, 0));

/**
 * Une séance, pour un mode (« demo » ou « reel »).
 *
 * - gardien : celui de js/combat/enregistrement.js ;
 * - des : la source de dés, { lancer(faces, combien) } ;
 * - maintenant : rend la date du moment (elle ne sert qu'au lancement) ;
 * - accepter : la fonction de js/personnage/format.js, que la validation
 *   d'une photographie de personnage demande ;
 * - rendreLaMain : rend une promesse, attendue entre deux tranches du rejeu
 *   d'un combat gardé (par défaut, la tâche suivante du navigateur).
 *
 * Les commandes sont synchrones et rendent {} ou { refus: { code, message } }.
 * Un refus ne change rien, et rien ne part au gardien.
 */
export function creerSeance({ gardien, des, maintenant = () => new Date(), mode, accepter, rendreLaMain = tacheSuivante }) {
  let miseEnPlace = miseEnPlaceVide(mode);
  let etat = ouvrirCombat(miseEnPlace);
  let choisi = null;
  // La génération de la demande en cours : ouvrir(), reprendre() et
  // nouveau() la montent ; une ouverture qui la retrouve changée s'efface.
  let generation = 0;
  // Le texte gardé s'assemble de morceaux déjà écrits : la mise en place est
  // sérialisée une fois par changement (donc une fois pour toutes au
  // lancement), chaque événement une fois à son arrivée. Un clic ne
  // resérialise jamais le combat entier.
  let texteDeLaMiseEnPlace = null;
  let textesDesEvenements = [];
  // Ce que l'ouverture a trouvé et qui ne se reprend pas : « illisible » ou
  // « autre_version ». Le gardien garde cet état jusqu'à la fin de l'écriture
  // de « Nouveau combat » ; la séance, elle, doit rendre la main dès le clic.
  let verrou = null;

  function bloque() {
    const garde = gardien.etat();
    if (garde === "ailleurs" || garde === "recent") return garde;
    return verrou;
  }

  const refusDuBlocage = () => refuser("interdit", gardien.phrase?.() ?? BLOQUE);

  function texte(revision) {
    texteDeLaMiseEnPlace ??= JSON.stringify(miseEnPlace);
    return `{"regles":${REGLES},"revision":${JSON.stringify(revision)},"miseEnPlace":${texteDeLaMiseEnPlace},"evenements":[${textesDesEvenements.join(",")}]}`;
  }

  // Le gardien appelle l'assembleur au départ de l'écriture : il lit donc le
  // combat de ce moment-là, pas celui du clic.
  const garder = () => gardien.garder(texte);

  function installer(nouvelle, evenements, nouvelEtat) {
    miseEnPlace = nouvelle;
    texteDeLaMiseEnPlace = null;
    textesDesEvenements = evenements.map((evenement) => JSON.stringify(evenement));
    etat = nouvelEtat;
    choisi = acteurCourant(etat, null);
  }

  /**
   * Joue des événements à la suite, tous ou aucun : chacun est jugé sur
   * l'état que laisse le précédent, et le premier refus est rendu sans que
   * rien ne change. Acceptés, chacun entre au contenu (et compte au plafond
   * du combat), et le gardien n'écrit qu'une fois.
   */
  function jouerLaSuite(evenements) {
    if (bloque() !== null) return refusDuBlocage();
    let suivant = etat;
    let annule = false;
    const textes = [];
    for (const evenement of evenements) {
      const rendu = appliquer(suivant, evenement);
      if (rendu.refus) return { refus: rendu.refus };
      // La copie aux seuls champs connus, dans leur ordre : c'est elle que la
      // validation rendra à la relecture, et le texte gardé reste le même.
      const lu = validerEvenement(evenement).evenement;
      textes.push(JSON.stringify(lu));
      annule ||= lu.type === "annuler";
      suivant = rendu.etat;
    }
    textesDesEvenements.push(...textes);
    etat = suivant;
    // Une annulation ferme la bulle : la zone redit « Qui joue ? ».
    choisi = annule ? null : acteurCourant(etat, choisi);
    garder();
    return {};
  }

  function jouer(evenement) {
    return jouerLaSuite([evenement]);
  }

  function jouerTout(evenements) {
    if (!Array.isArray(evenements) || evenements.length === 0 || evenements.length > EVENEMENTS_PAR_COMMANDE) return refuser("forme", COMMANDE_INCONNUE);
    return jouerLaSuite(evenements);
  }

  function photoRelue(photo) {
    const lu = validerPhoto(photo, { accepter });
    return lu.photo ? { photo: lu.photo } : { refus: `Ne s'ajoute pas : ${lu.erreur}` };
  }

  // Ce qui s'ajoute doit se reprendre : la photographie repasse ici par la
  // validation qui la jugera au rechargement, et c'est sa copie qui est gardée.
  function ajouter(commande) {
    if (commande.type === "ajouter_personnage") {
      const lu = photoRelue(commande.photo);
      return lu.refus ? lu : ajouterPersonnage(miseEnPlace, lu.photo);
    }
    if (!Array.isArray(commande.photos)) return ajouterAdversaires(miseEnPlace, commande.photos);
    const photos = [];
    for (const photo of commande.photos) {
      const lu = photoRelue(photo);
      if (lu.refus) return lu;
      photos.push(lu.photo);
    }
    return ajouterAdversaires(miseEnPlace, photos);
  }

  const PREPARATIONS = {
    ajouter_personnage: ajouter,
    ajouter_adversaires: ajouter,
    retirer: (commande) => retirer(miseEnPlace, commande.id),
    poser: (commande) => poser(miseEnPlace, commande.id, commande.case),
    qui_commence: (commande) => reglerQuiCommence(miseEnPlace, commande.camp),
  };

  function preparer(commande) {
    if (bloque() !== null) return refusDuBlocage();
    // La préparation ne sait pas si le combat est lancé : c'est ici que la
    // mise en place se fige.
    if (etat.phase !== "preparation") return refuser("hors_moment", DEJA_LANCE);
    const faire = Object.hasOwn(PREPARATIONS, commande?.type) ? PREPARATIONS[commande.type] : null;
    if (faire === null) return refuser("forme", COMMANDE_INCONNUE);
    const issue = faire(commande);
    if (issue.refus) return refuser("interdit", issue.refus);
    miseEnPlace = issue.miseEnPlace;
    texteDeLaMiseEnPlace = null;
    etat = ouvrirCombat(miseEnPlace);
    choisi = null;
    garder();
    return {};
  }

  function lancer() {
    return jouer({ type: "lancer", le: heureMurale(maintenant()) });
  }

  function choisir(id) {
    if (bloque() !== null) return refusDuBlocage();
    if (id !== null && !candidats(etat).includes(id)) return refuser("interdit", PAS_CANDIDAT);
    const geste = gesteEnCours(etat);
    if (geste !== null && geste.acteur !== id) {
      // Un geste payé ne se quitte pas : son acteur reste celui qui joue.
      if (geste.paye) return refuser("hors_moment", GESTE_EN_COURS);
      const issue = jouer({ type: "revenir" });
      if (issue.refus) return issue;
    }
    choisi = id;
    return {};
  }

  function lancerLeDe() {
    if (bloque() !== null) return refusDuBlocage();
    const permis = offre(etat);
    if (permis.de === null) {
      // Un geste qui n'est pas prêt n'offre pas son dé : sa raison est ce
      // qu'il lui manque, et aucun dé n'est tiré.
      return permis.pret?.ok === false ? refuser("interdit", permis.pret.manque) : refuser("hors_moment", AUCUN_DE);
    }
    const { faces, combien } = permis.de;
    return jouer({ type: "de", faces, valeurs: des.lancer(faces, combien) });
  }

  function executer(commande) {
    if (commande !== null && typeof commande === "object") {
      if (Object.hasOwn(commande, "evenement")) return jouer(commande.evenement);
      if (Object.hasOwn(commande, "evenements")) return jouerTout(commande.evenements);
      if (Object.hasOwn(commande, "choisir")) return choisir(commande.choisir);
      if (Object.hasOwn(commande, "preparer")) return preparer(commande.preparer);
    }
    return refuser("forme", COMMANDE_INCONNUE);
  }

  function nouveau() {
    // Un combat ouvert ailleurs se reprend, un combat plus récent ne
    // s'écrase pas : là, le gardien n'écrirait rien, et le combat vide ne
    // vivrait que jusqu'au rechargement.
    const garde = gardien.etat();
    if (garde === "ailleurs" || garde === "recent") return refusDuBlocage();
    // Une ouverture en cours ne viendra pas l'écraser.
    generation += 1;
    verrou = null;
    const vide = miseEnPlaceVide(mode);
    installer(vide, [], ouvrirCombat(vide));
    garder();
    return {};
  }

  // Le rejeu d'un contenu validé, par tranches : entre deux, la main revient
  // au navigateur. Rend ce que rend rejeu(), ou null quand la génération a
  // changé pendant une attente : rien n'est alors à installer.
  async function rejouerParTranches(contenu, mienne) {
    const suite = rejeu(contenu);
    let etape = suite.next();
    while (!etape.done) {
      await rendreLaMain();
      if (mienne !== generation) return null;
      etape = suite.next();
    }
    return etape.value;
  }

  // Ce que le gardien a lu, jusqu'au combat rejoué : l'issue, ou null pour
  // une ouverture abandonnée.
  async function reprendreLeTexte(lu, mienne) {
    let donnee;
    try {
      donnee = JSON.parse(lu.texte);
    } catch {
      return "illisible";
    }
    const valide = validerContenu(donnee, { mode, revision: lu.revision, accepter });
    if (valide.autreVersion) return "autre_version";
    if (!valide.contenu) return "illisible";
    const rejoue = await rejouerParTranches(valide.contenu, mienne);
    if (rejoue === null) return null;
    if (!rejoue.etat) return "illisible";
    installer(valide.contenu.miseEnPlace, valide.contenu.evenements, rejoue.etat);
    return "repris";
  }

  async function relire(charger) {
    // Cette lecture devient la demande en cours.
    const mienne = ++generation;
    const lu = await charger();
    // Une demande plus récente (une autre ouverture, « Nouveau combat ») a
    // pris la place de celle-ci : rien de ce qui a été lu ne s'installe.
    if (mienne !== generation) return ABANDONNE;
    // Chaque lecture rejuge : un verrou d'avant ne survit pas à une base
    // qu'on retrouve vide, ou à un combat qui se reprend.
    verrou = null;
    if (lu.vide) return { issue: "vide" };
    if (lu.erreur) {
      const issue = Object.hasOwn(ISSUE_DU_CODE, lu.code) ? ISSUE_DU_CODE[lu.code] : "illisible";
      if (issue === "illisible") verrou = "illisible";
      return { issue };
    }
    const issue = await reprendreLeTexte(lu, mienne);
    if (issue === null) return ABANDONNE;
    if (issue !== "repris") {
      verrou = issue;
      gardien.declarer(issue);
    }
    return { issue };
  }

  return {
    /** La mise en place du moment (figée une fois le combat lancé). */
    miseEnPlace: () => miseEnPlace,
    /** L'état du moteur. */
    etat: () => etat,
    /** Qui est choisi pour jouer, hors de tout geste ; jamais gardé. */
    choisi: () => choisi,
    /** null, ou pourquoi on ne joue pas : « ailleurs », « illisible », « recent », « autre_version ». */
    bloque,
    /**
     * À l'ouverture de l'écran sans combat en mémoire : relit le combat
     * gardé, le fait valider, le rejoue en rendant la main entre deux
     * tranches. Rend { issue } : « vide », « repris », « sans_cle »,
     * « illisible », « recent » ou « autre_version » ; ou « abandonne »,
     * quand une autre ouverture ou « Nouveau combat » l'a remplacée
     * entre-temps. Sauf « repris », le combat en mémoire ne change pas.
     */
    ouvrir: () => relire(() => gardien.charger()),
    /** « Reprendre le combat le plus récent » : comme ouvrir(). */
    reprendre: () => relire(() => gardien.reprendre()),
    /** Change la mise en place, avant le lancement : { type, … }. */
    preparer,
    /** Lance le combat, à l'heure locale du moment. */
    lancer,
    /** Choisit qui joue (un candidat, ou null) ; un geste non payé d'un autre est d'abord retiré. */
    choisir,
    /** Joue un événement : le moteur le juge, la suite le reçoit, le gardien le garde. */
    jouer,
    /** Lance le dé que le moteur attend, par la source de dés. */
    lancerLeDe,
    /**
     * Aiguille la commande d'une vue : { evenement }, { evenements } (de 1 à
     * 4, joués tous ou aucun), { choisir } ou { preparer }.
     */
    executer,
    /** « Nouveau combat » : un combat vide, gardé à la révision suivante ; il l'emporte sur une ouverture en cours. */
    nouveau,
    /** Le contenu du combat en JSON, à cette révision : ce que le gardien chiffre. */
    texte,
  };
}
