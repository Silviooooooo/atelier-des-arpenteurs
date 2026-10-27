// Les effets du combat : la palette, les passifs qui s'y appliquent, les
// états, et les gestes du MJ (SPECIFICATION.md, § 17 « Le simulateur de
// combat (lot 4) » ; mission du lot 4.3, § 4.5 à § 4.8 et § 5 ; contrat de la
// vague 1, § 3, § 5, § 6.3 et § 7.5).
//
// Un effet est ce que fait l'événement « effet » : des avantages pour ce jet,
// le dernier dé relancé ou inversé, une réussite de plus, la zone d'un d20,
// des dégâts changés, une ressource rendue, un ±N, un état, un déplacement
// sans action. Le MJ, lui, change une valeur, l'équipement ou les états d'un
// protagoniste, le déplace, ou le retire du combat (l'événement « mj »). Ce
// module existe pour que ces deux événements n'aient qu'un juge et qu'une
// application : l'offre (js/combat/offre.js) lui demande ce que la palette
// peut appliquer et si un événement est permis, le moteur
// (js/combat/moteur.js) lui demande l'état d'après. Les deux lisent donc le
// même moment, la même source et le même prix.
//
// Il est pur, comme le moteur : il ne lit ni l'heure, ni le hasard, ni la
// banque (une capacité d'état arrive figée dans l'événement), ni l'écran. Le
// Mode MJ ne se lit pas : ce qu'il réserve (une source au choix, la palette
// libre, le menu du MJ) est accepté ici, et c'est l'écran qui le cache. Il ne
// gèle rien, le moteur gèle l'état une fois, à la fin de l'événement ; il
// n'écrit pas au journal, le moteur écrit d'après l'effet qu'il rend.
//
// Ce qu'il applique (mission, § 4.5 à § 4.8 ; conventions 15, 52, 54, 58,
// 59, 61 et 62) :
// - un effet sur le geste en cours (les dés, la zone, les dégâts) ne s'offre
//   qu'au moment où il a prise, sinon il dit pourquoi ; un effet sur une cible
//   (rendre, ±N, un état, déplacer) s'offre toujours, hors d'un geste aussi ;
// - un effet « pour ce jet » (avantages, désavantages, ±N ou état de durée
//   « jet ») se règle tant qu'aucun dé n'est lancé, et vaut pour les jets du
//   geste ; « tour » et « combat » posent un effet durable (etat.effets) ;
// - un passif non câblé payant se paie quand un effet s'applique, X compris,
//   par son porteur ; un adversaire paie son souffle, jamais son lien ; un
//   passif sert une fois par jet ;
// - l'auteur d'un effet est celui qui joue le geste ; hors d'un geste, le
//   porteur de l'état ou de la capacité dont la palette porte le nom ; la
//   source « MJ » hors d'un geste se dit du camp qui joue ;
// - un effet durable « tour » finit au début du prochain tour du camp de son
//   auteur (echeances) ; « combat », jamais ; celui que porte un mort ou un
//   retiré s'en va avec lui (sansEffetsDesAbsents).
//
// Et les choix de l'agent principal (contrat, § 12) :
// - pendant la préparation d'un geste, rien n'est payé : la palette n'y offre
//   que les effets « pour ce jet », de la capacité jouée ou d'un passif, et
//   seulement à un geste qui lance un dé ; le prix d'un passif payé alors se
//   rend si le geste s'en va (choix 11) ;
// - le jet contre un allié ou contre soi n'est écrit nulle part : « toute la
//   case » ne coche ni l'auteur ni ses alliés (choix 10) ;
// - les valeurs que pose le MJ ne sont pas bornées par leurs maxima ; rendre
//   l'est (choix 16) ;
// - un changement d'équipement renumérote par leur nom les capacités que
//   nomment les effets durables et les gardes ; ce qui disparaît s'en va, sans
//   ligne (choix 17) ;
// - une photographie ne passe jamais ses bornes, pas plus par une blessure que
//   par un changement d'équipement (choix 20).
//
// Les dés passent par js/combat/jet.js, la zone par la localisation du geste,
// les dégâts par geste.effets, que js/combat/degats.js lit ; ±N par
// geste.effets et etat.effets, que js/combat/valeurs.js et circonstances.js
// lisent. De l'offre, ce module n'importe que prixDuGeste, appelée dans ses
// fonctions et jamais au chargement : l'offre l'importe lui-même, et
// n'appeler ni accepte ni offre tient la boucle ouverte.
//
// Les refus portent les codes de l'offre : « hors_moment » (le genre n'a pas
// prise à cet instant), « hors_bornes » (une valeur qui ne s'offre pas),
// « interdit » (le bouton existe, inactif : le message est sa raison). Rien
// n'y lève : l'événement a passé validerEvenement (js/combat/forme.js), et ce
// qu'il nomme (un protagoniste, une capacité, un effet, une zone) se cherche
// sans lever.

import { lettreDuGeste, localisationsDuGeste, victimeDe } from "./degats.js";
import { ajouterReussite, evaluerEssai, inversable, inverserDernier, jetFini, relancable, relancerParPalette, reussites } from "./jet.js";
import { prixDuGeste } from "./offre.js";
import { BORNES_PHOTO, GENRES_EFFET, REUSSITES_MAX } from "./regles.js";
import { campDe, capaciteDe, courantDe, gesteEnCours, photoDe, vivant } from "./valeurs.js";

const accorder = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);
const effetsDe = (etat) => (Array.isArray(etat?.effets) ? etat.effets : []);

const OUI = Object.freeze({ ok: true });
const refuser = (code, message) => ({ ok: false, code, message });
const horsMoment = (message) => refuser("hors_moment", message);
const horsBornes = (message) => refuser("hors_bornes", message);
const interdit = (message) => refuser("interdit", message);

// ─── Les retouches de l'état ────────────────────────────────────────────────
//
// Chacune rend un état neuf qui partage tout ce qu'elle ne change pas, sans
// rien geler (le moteur gèle).

const changer = (etat, id, champs) => ({ ...etat, protagonistes: { ...etat.protagonistes, [id]: { ...etat.protagonistes[id], ...champs } } });
const poserLeGeste = (etat, geste) => ({ ...etat, pile: [...etat.pile.slice(0, -1), geste] });
const ajouterDurable = (etat, durable) => ({ ...etat, effets: [...effetsDe(etat), durable] });

// Un effet durable (contrat, § 3) : « id » est le pas de l'événement qui le
// pose ; « camp », celui dont le prochain tour le finit.
const durable = (id, genre, { porteur, auteur, camp, duree, source }, champs = {}) => ({ id, genre, porteur, auteur, camp, duree, source, ...champs });

// ─── Les moments ────────────────────────────────────────────────────────────
//
// Pour chaque genre, pourquoi il n'a pas prise sur le geste au sommet de la
// pile (ou hors d'un geste), ou null. Les phrases sont celles de la palette.

const HORS_D_UN_GESTE = "Hors d'un geste.";
const AUCUN_DE = "Aucun dé lancé.";
const AUCUN_D20 = "Aucun d20 lancé.";
const AUCUNS_DEGATS = "Aucuns dégâts calculés.";
const UN_DE_LANCE = "Un dé est déjà lancé.";
const UN_D20_LANCE = "Un d20 est déjà lancé.";
const UNE_INTERVENTION = "Une intervention est déjà jouée.";
const UN_DE_ATTENDU = "Un dé est attendu.";
const DEJA_INVERSE = "Ce dé est déjà inversé.";
const DEJA_EXPLOSE = "Ce dé a explosé : il ne s'inverse plus.";
const JET_PAS_FINI = "Le jet n'est pas fini.";
const TROIS_REUSSITES = "Le jet compte déjà trois réussites.";
const DEGATS_APPLIQUES = "Les dégâts sont déjà appliqués.";
const GESTE_EMBOITE = "Seul le geste du bas de la pile vise toute la case.";
const DEJA_PLUSIEURS = "Ce geste a déjà plusieurs cibles.";
const PAS_ENCORE_PAYE = "Le geste n'est pas encore payé.";
const SANS_JET = "Ce geste ne lance aucun dé.";

// Le combat lancé et pas fini : rien ne s'applique avant, ni après.
function horsDuCombat(etat) {
  if (etat?.phase === "preparation") return "Le combat n'est pas lancé.";
  if (etat?.phase !== "combat") return "Le combat est terminé.";
  return null;
}

// Un effet « pour ce jet » : un réglage du geste, tant que rien n'est payé ni
// lancé (mission, § 4.6).
function avantToutDe(etat, geste) {
  if (geste === null) return HORS_D_UN_GESTE;
  return geste.moment === "preparation" ? null : UN_DE_LANCE;
}

// Le jet du geste, tant que son moment se relit d'après lui (contrat, § 4.1) :
// un dé lancé, aucun d20, aucune intervention ni esquive.
function surLeJet(geste) {
  if (geste === null) return HORS_D_UN_GESTE;
  if ((geste.jet?.places?.length ?? 0) === 0) return AUCUN_DE;
  if ((geste.localisation?.length ?? 0) > 0) return UN_D20_LANCE;
  if ((geste.interventions?.length ?? 0) > 0) return UNE_INTERVENTION;
  return null;
}

// Les attentes où le dernier dé de la chaîne est posé (jet.js) : ni une
// relance ni une explosion n'attendent leur dé.
const DERNIER_DE_POSE = ["de", "choix_relance", "choix_explosion", "fini"];

// Relancer ou inverser le dernier dé de la chaîne (contrat, § 5.2) : le verdict
// est celui de jet.js (relancable, inversable) ; la raison se lit ici.
function surLeDernierDe(geste, peut) {
  const avant = surLeJet(geste);
  if (avant !== null) return avant;
  const { jet } = geste;
  if (peut(jet)) return null;
  if (!DERNIER_DE_POSE.includes(jet.attente)) return UN_DE_ATTENDU;
  const essais = jet.places[jet.places.length - 1].essais;
  return essais[essais.length - 1].inverse === true ? DEJA_INVERSE : DEJA_EXPLOSE;
}

// « +1 réussite » : un jet fini, sous trois réussites (mission, § 4.6).
function surLeJetFini(geste) {
  const avant = surLeJet(geste);
  if (avant !== null) return avant;
  if (!jetFini(geste.jet)) return JET_PAS_FINI;
  return reussites(geste.jet) >= REUSSITES_MAX ? TROIS_REUSSITES : null;
}

// La zone : un d20 lancé, les dégâts pas encore appliqués.
function unD20Lance(etat, geste) {
  if (geste === null) return HORS_D_UN_GESTE;
  if ((geste.localisation?.length ?? 0) === 0) return AUCUN_D20;
  return geste.resultat === null ? null : DEGATS_APPLIQUES;
}

// Les dégâts : calculés (le geste a touché, ses dégâts sont posés) et pas
// encore appliqués.
const MOMENTS_DES_DEGATS = ["bilan", "localisation", "suites"];

function degatsCalcules(etat, geste) {
  if (geste === null) return HORS_D_UN_GESTE;
  if (geste.resultat !== null) return DEGATS_APPLIQUES;
  if (!MOMENTS_DES_DEGATS.includes(geste.moment) || (geste.degats ?? null) === null || lettreDuGeste(etat, geste) === null) return AUCUNS_DEGATS;
  return null;
}

// « Toute la case » : les dégâts de la première cible calculés, sur le geste
// racine, qui n'a pas encore plusieurs cibles (contrat, § 4.4 et § 5.1).
function surLaPremiereCible(etat, geste) {
  const avant = degatsCalcules(etat, geste);
  if (avant !== null) return avant;
  if (etat.pile.length > 1) return GESTE_EMBOITE;
  return (geste.cibles ?? null) !== null || (geste.rang ?? 0) > 0 ? DEJA_PLUSIEURS : null;
}

const toujours = () => null;

// Le moment de chaque genre, dans l'ordre de GENRES_EFFET. ±N et l'état ont
// toujours une durée qui s'offre ; celle « pour ce jet » se juge à part.
const MOMENTS = {
  avantages: avantToutDe,
  desavantages: avantToutDe,
  relancer: (etat, geste) => surLeDernierDe(geste, relancable),
  inverser: (etat, geste) => surLeDernierDe(geste, inversable),
  reussite: (etat, geste) => surLeJetFini(geste),
  zone: unD20Lance,
  multiplier: degatsCalcules,
  ajouter: degatsCalcules,
  retrancher: degatsCalcules,
  armure: degatsCalcules,
  directs: degatsCalcules,
  reporter: degatsCalcules,
  toute_la_case: surLaPremiereCible,
  attaque_en_plus: degatsCalcules,
  rendre: toujours,
  attaque: toujours,
  defense: toujours,
  etat: toujours,
  deplacer: toujours,
};

const A_DUREE = ["attaque", "defense", "etat"];

// Les effets « pour ce jet » (mission, § 4.6) : les avantages et les
// désavantages, et ±N ou un état de durée « jet », qui restent dans le geste.
const POUR_CE_JET = ["avantages", "desavantages", ...A_DUREE];

// Les modes d'un geste qui lance un dé (ceux de js/combat/offre.js).
const MODES_A_JET = ["attaque", "jet_prete", "caracteristique"];

const enPreparation = (geste) => geste?.moment === "preparation";

// Pendant la préparation d'un geste, rien n'est payé : la palette n'y offre
// que les effets « pour ce jet », et seulement à un geste qui lance un dé ;
// tout autre genre attend le paiement (contrat, § 12, choix 11). Un geste
// retiré sans être payé ne laisse ainsi rien derrière lui : ses effets s'en
// vont avec lui, et le moteur rend le prix d'un passif (rendrePrixDesPassifs).
// null hors de la préparation.
function avantLePaiement(geste, genre) {
  if (!enPreparation(geste)) return null;
  if (!POUR_CE_JET.includes(genre)) return PAS_ENCORE_PAYE;
  return MODES_A_JET.includes(geste.mode) ? null : SANS_JET;
}

// Pourquoi l'événement n'a pas prise à cet instant, ou null : son genre, et,
// pour ±N et un état, sa durée : « pour ce jet », avant tout dé d'un geste ;
// « tour » et « combat », jamais avant que le geste soit payé.
function raisonDuMoment(etat, geste, evenement) {
  const raison = horsDuCombat(etat) ?? avantLePaiement(geste, evenement.genre) ?? MOMENTS[evenement.genre](etat, geste);
  if (raison !== null || !A_DUREE.includes(evenement.genre)) return raison;
  if (evenement.duree === "jet") return avantToutDe(etat, geste);
  return enPreparation(geste) ? PAS_ENCORE_PAYE : null;
}

/**
 * Ce que la palette peut appliquer maintenant (contrat, § 7.5) : un
 * { actif, raison } par genre de l'événement « effet », dans l'ordre de
 * GENRES_EFFET, pour le geste au sommet de la pile, ou hors d'un geste. Seul
 * le moment compte ici : la source, les bornes et le prix se jugent sur
 * l'événement (jugerEffet). Avant le lancement et après la fin, rien n'est
 * actif. Pendant la préparation d'un geste, seuls les effets « pour ce jet » :
 * ±N et un état s'y disent actifs pour la seule durée « jet ».
 */
export function offreDesEffets(etat) {
  const geste = gesteEnCours(etat);
  const phase = horsDuCombat(etat);
  return Object.fromEntries(
    GENRES_EFFET.map((genre) => {
      const raison = phase ?? avantLePaiement(geste, genre) ?? MOMENTS[genre](etat, geste);
      return [genre, { actif: raison === null, raison }];
    }),
  );
}

// ─── La source, l'auteur, le passif ─────────────────────────────────────────

// Un état porté : l'effet durable « etat » de cet identifiant, ou null.
const etatPorte = (etat, id) => effetsDe(etat).find((effet) => effet.genre === "etat" && effet.id === id) ?? null;

// Ceux dont une capacité peut être la source d'un effet (contrat, § 5) : les
// porteurs d'un état ; pendant un geste, aussi son acteur et le jeté.
function quiPeutEtreSource(etat, geste) {
  const qui = new Set(effetsDe(etat).filter((effet) => effet.genre === "etat").map((effet) => effet.porteur));
  if (geste !== null) {
    qui.add(geste.acteur);
    if (geste.cible !== null) qui.add(geste.cible);
  }
  return qui;
}

function jugerSource(etat, geste, source) {
  if (source.genre === "mj") return null;
  if (source.genre === "etat") return etatPorte(etat, source.effet) === null ? horsBornes("Cet état n'est porté par personne.") : null;
  if (capaciteDe(etat, source.qui, source.capacite) === null) return horsBornes("Cette capacité n'existe pas.");
  return quiPeutEtreSource(etat, geste).has(source.qui) ? null : horsBornes("Cette capacité ne peut pas être la source de cet effet.");
}

/**
 * L'auteur d'un effet (convention 62) : l'acteur du geste en cours ; hors
 * d'un geste, le porteur de l'état source, ou celui de la capacité source ;
 * null pour le MJ hors d'un geste.
 */
function auteurDe(etat, geste, source) {
  if (geste !== null) return geste.acteur;
  if (source.genre === "etat") return etatPorte(etat, source.effet)?.porteur ?? null;
  if (source.genre === "capacite") return source.qui;
  return null;
}

// La façon tenue d'une capacité (contrat, § 12, choix 14) : la plus haute de
// ses façons jouables, celle de la plus haute puissance qui ne passe pas son
// niveau (son rang, chez un adversaire ; la photographie ne garde que les
// puissances jouables), la première à égalité ; à défaut, la première. null
// pour une capacité sans façon.
function faconTenue(capacite) {
  let tenue = null;
  capacite.facons.forEach((facon, indice) => {
    if (facon.puissance > capacite.niveau) return;
    if (tenue === null || facon.puissance > capacite.facons[tenue].puissance) tenue = indice;
  });
  return tenue ?? (capacite.facons.length > 0 ? 0 : null);
}

// Le passif non câblé d'une source : { capacite, facon } quand elle est une
// capacité sans rôle câblé, passive à la puissance tenue ; null sinon. Un
// passif câblé (dégrossir, un bonus…) se calcule de lui-même : il ne se paie
// pas, et peut servir plus d'une fois.
function passifDe(etat, source) {
  if (source?.genre !== "capacite") return null;
  const capacite = capaciteDe(etat, source.qui, source.capacite);
  if (capacite === null || capacite.role !== null) return null;
  const facon = faconTenue(capacite);
  return facon !== null && capacite.facons[facon].passif === true ? { capacite, facon } : null;
}

const sansCout = (cout) => cout !== null && cout.souffle === 0 && cout.lien === 0;

/**
 * Le prix d'un effet (contrat, § 5 ; mission, § 4.5) : celui d'un passif non
 * câblé au coût non nul, X compris, payé par son porteur quand l'effet
 * s'applique : { souffle, lien, jauge, lienNonPaye }, comme le prix d'un
 * geste (prixDuGeste), sans action. Un adversaire paie son souffle, jamais son
 * lien (« lienNonPaye », que le journal dit). null pour toute autre source,
 * pour un passif gratuit, et pour un coût illisible (jugerEffet le refuse).
 * « x » est le X choisi dans la palette.
 *
 * Hors du § 7.5 du contrat : l'écran peut y lire le prix d'un bouton de passif
 * (« Nez fin · 1 souffle »).
 */
export function prixDuPassif(etat, source, x = 0) {
  const passif = passifDe(etat, source);
  if (passif === null || sansCout(passif.capacite.facons[passif.facon].cout)) return null;
  const prix = prixDuGeste(etat, { acteur: source.qui, capacite: source.capacite, facon: passif.facon, x, jauge: null });
  return prix === null ? null : { souffle: prix.souffle, lien: prix.lien, jauge: prix.jauge, lienNonPaye: prix.lienNonPaye };
}

// La borne du X d'un passif : le plus petit des restes des ressources dont son
// coût porte X (le souffle ; pour un PJ, la jauge qui paierait son lien, ou la
// plus pleine). null quand rien ne porte X : il ne se choisit pas.
function borneDeX(courant, capacite, cout) {
  if (cout === null) return null;
  const restes = [];
  if (cout.souffle === "X") restes.push(courant.souffle);
  if (cout.lien === "X" && courant.camp === "pj") {
    restes.push(capacite.lien !== null ? (element(courant.liens, capacite.lien)?.points ?? 0) : Math.max(0, ...courant.liens.map((jauge) => jauge.points)));
  }
  return restes.length === 0 ? null : Math.min(...restes);
}

// Le X, puis ce qu'un passif payant demande à son porteur. Une source qui ne
// se paie pas ne prend pas de X.
function jugerPrix(etat, source, x) {
  const passif = passifDe(etat, source);
  const capacite = passif?.capacite ?? null;
  const cout = passif === null ? null : capacite.facons[passif.facon].cout;
  const courant = passif === null ? null : courantDe(etat, source.qui);
  const borne = passif === null ? null : borneDeX(courant, capacite, cout);
  if (x > 0 && borne === null) return horsBornes("Seul un passif au coût X prend un X.");
  if (borne !== null && x > borne) return horsBornes(`X ne va que de 0 à ${borne}.`);
  if (passif === null) return null;
  if (cout === null) return interdit("Ce passif a un coût illisible dans la banque.");
  const prix = prixDuPassif(etat, source, x);
  if (prix === null) return null;
  if (prix.souffle > courant.souffle) return interdit(`Pas assez de souffle : ${accorder(prix.souffle, "demandé")}, ${accorder(courant.souffle, "restant")}.`);
  if (prix.lien > 0 && prix.jauge === null) {
    const reste = capacite.lien !== null ? (element(courant.liens, capacite.lien)?.points ?? 0) : Math.max(0, ...courant.liens.map((jauge) => jauge.points));
    return interdit(`Pas assez de lien : ${accorder(prix.lien, "demandé")}, ${accorder(reste, "restant")}.`);
  }
  return null;
}

// Le porteur du passif paie : son souffle, et le lien sur la jauge du prix.
function payer(etat, qui, prix) {
  if (prix === null || (prix.souffle === 0 && prix.lien === 0)) return etat;
  const courant = courantDe(etat, qui);
  const liens = prix.jauge === null ? courant.liens : courant.liens.map((jauge, indice) => (indice === prix.jauge ? { ...jauge, points: jauge.points - prix.lien } : jauge));
  return changer(etat, qui, { souffle: courant.souffle - prix.souffle, liens });
}

// Le prix rendu tel que payer() l'a pris : le souffle, et le lien sur sa jauge.
function rembourser(etat, qui, prix) {
  const courant = courantDe(etat, qui);
  if (prix === null || courant === null || (prix.souffle === 0 && prix.lien === 0)) return etat;
  const liens = prix.jauge === null ? courant.liens : courant.liens.map((jauge, indice) => (indice === prix.jauge ? { ...jauge, points: jauge.points + prix.lien } : jauge));
  return changer(etat, qui, { souffle: courant.souffle + prix.souffle, liens });
}

/**
 * L'état où le prix des passifs payés pendant la préparation d'un geste est
 * rendu à qui l'a payé (contrat, § 12, choix 11 ; « Revenir l'efface »,
 * mission, § 4.6). Le moteur l'appelle quand ce geste s'en va sans avoir été
 * payé (« Revenir », une autre capacité, passer, la fin du tour) ; ses autres
 * effets, tous « pour ce jet », s'en vont avec lui. L'objet même si rien
 * n'est à rendre.
 */
export function rendrePrixDesPassifs(etat, geste) {
  return (geste?.effets ?? []).reduce((rendu, effet) => rembourser(rendu, effet.source?.qui, effet.prix ?? null), etat);
}

// Un passif sert une fois par jet : le geste retient ceux qui ont servi. Une
// seule application, même si son texte porte deux effets ; le second, s'il le
// faut, par le MJ (contrat, § 12, choix 15).
const dejaServi = (geste, source) => (geste?.passifs ?? []).some((passif) => passif.qui === source.qui && passif.capacite === source.capacite);

// Avant le paiement, un effet vient de la capacité jouée ou d'un passif
// (contrat, § 12, choix 11) : ni du MJ, ni d'un état, ni d'une autre capacité.
const SOURCE_AVANT_LE_PAIEMENT = "Avant le paiement, la source est la capacité jouée ou un passif.";
const sourceAvantLePaiement = (etat, geste, source) =>
  (source.genre === "capacite" && source.qui === geste.acteur && source.capacite === geste.capacite) || passifDe(etat, source) !== null;

// ─── Les bornes ─────────────────────────────────────────────────────────────

const INCONNU = "Ce protagoniste n'est pas dans le combat.";
const ABSENT = "Ce protagoniste est mort ou retiré du combat.";

/**
 * Le jet contre un allié ou contre soi n'est écrit nulle part (contrat, § 12,
 * choix 10 ; à écrire dans le Word, section « Plusieurs cibles ») : ni « toute
 * la case » ni l'étape « Cible » d'une façon Centrée (js/combat/offre.js) ne
 * cochent l'auteur ou ses alliés. La phrase de ce refus, que les deux disent.
 */
export const JET_CONTRE_UN_ALLIE = "Le jet contre un allié ou contre soi n'est pas encore écrit dans les règles.";
const DEJA_AU_MAXIMUM = "Déjà au maximum.";
const DEJA_SUR_LA_CASE = "Ce protagoniste est déjà sur cette case.";

// Un protagoniste présent et vivant : ce que doit être le « sur » d'un effet,
// et le « qui » d'un geste du MJ. Un mort est un bouton inactif.
function jugerVivant(etat, id) {
  if (courantDe(etat, id) === null) return horsBornes(INCONNU);
  return vivant(etat, id) ? null : interdit(ABSENT);
}

// La ressource que rend « rendre », lue sur le courant de « sur » : { valeur,
// max, champs(valeur) }, champs étant ce qu'il faut changer pour la poser ;
// null si sa zone ou sa jauge n'existe pas.
function ressourceDe(courant, { ressource, zone, jauge }) {
  if (ressource === "souffle") return { valeur: courant.souffle, max: courant.souffleMax, champs: (valeur) => ({ souffle: valeur }) };
  if (ressource === "corps") return { valeur: courant.corps, max: courant.corpsMax, champs: (valeur) => ({ corps: valeur }) };
  if (ressource === "lien") {
    const laJauge = element(courant.liens, jauge);
    if (laJauge === null) return null;
    return { valeur: laJauge.points, max: laJauge.max, champs: (valeur) => ({ liens: courant.liens.map((une, k) => (k === jauge ? { ...une, points: valeur } : une)) }) };
  }
  const laZone = element(courant.zones, zone);
  if (laZone === null) return null;
  const [champ, max] = ressource === "armure" ? ["armure", "armureMax"] : ["resistance", "resistanceMax"];
  return { valeur: laZone[champ], max: laZone[max], champs: (valeur) => ({ zones: courant.zones.map((une, k) => (k === zone ? { ...une, [champ]: valeur } : une)) }) };
}

// Ce que chaque genre demande de plus que sa forme (js/combat/forme.js) : ce
// qui dépend de l'état. Les genres absents n'ont rien de plus.
const BORNES = {
  zone(etat, geste, { de, zone }) {
    const d20 = element(localisationsDuGeste(etat, geste), de);
    if (d20 === null) return horsBornes("Ce d20 n'a pas été lancé.");
    if (d20.contre) return horsBornes("Une face de contre-attaque ne se choisit pas.");
    return element(photoDe(etat, victimeDe(geste))?.zones, zone) === null ? horsBornes("Cette zone n'existe pas chez la victime.") : null;
  },

  reporter(etat, geste, { sur }) {
    const refus = jugerVivant(etat, sur);
    if (refus !== null) return refus;
    return sur === victimeDe(geste) ? interdit("Les dégâts vont déjà à ce protagoniste.") : null;
  },

  // Plusieurs cibles : la cible en cours d'abord, puis des vivants de sa case,
  // ni l'auteur ni ses alliés (contrat, § 12, choix 10).
  toute_la_case(etat, geste, { cibles }) {
    if (cibles[0] !== geste.cible) return horsBornes("La première cible est celle du geste.");
    if (cibles.length < 2) return horsBornes("Choisissez au moins une autre cible.");
    const laCase = courantDe(etat, geste.cible)?.case ?? null;
    const horsDeLaCase = cibles.slice(1).some((id) => !vivant(etat, id) || courantDe(etat, id).case !== laCase);
    if (horsDeLaCase) return horsBornes("Chaque cible est un vivant de la case de la première.");
    const camp = campDe(etat, geste.acteur);
    return cibles.some((id) => campDe(etat, id) === camp) ? interdit(JET_CONTRE_UN_ALLIE) : null;
  },

  rendre(etat, geste, evenement) {
    const refus = jugerVivant(etat, evenement.sur);
    if (refus !== null) return refus;
    const lue = ressourceDe(courantDe(etat, evenement.sur), evenement);
    if (lue === null) return horsBornes(evenement.ressource === "lien" ? "Cette jauge de lien n'existe pas." : "Cette zone n'existe pas.");
    return lue.valeur >= lue.max ? interdit(DEJA_AU_MAXIMUM) : null;
  },

  attaque: (etat, geste, { sur }) => jugerVivant(etat, sur),
  defense: (etat, geste, { sur }) => jugerVivant(etat, sur),
  etat: (etat, geste, { sur }) => jugerVivant(etat, sur),

  deplacer(etat, geste, { sur, vers }) {
    const refus = jugerVivant(etat, sur);
    if (refus !== null) return refus;
    return courantDe(etat, sur).case === vers ? interdit(DEJA_SUR_LA_CASE) : null;
  },
};

// ─── Juger, appliquer un effet ──────────────────────────────────────────────

/**
 * Dit si un événement « effet » (contrat, § 5), déjà lu par validerEvenement,
 * s'applique à cet instant : { ok: true }, ou { ok: false, code, message }.
 * Dans cet ordre : le moment de son genre (hors_moment) ; la source
 * (hors_bornes ; avant le paiement, la capacité jouée ou un passif, sinon
 * interdit) ; le passif qui a déjà servi pour ce jet (interdit) ; les bornes
 * qui dépendent de l'état ; le X et le prix d'un passif payant.
 */
export function jugerEffet(etat, evenement) {
  if (!Object.hasOwn(MOMENTS, evenement?.genre)) return horsBornes("Cet effet n'existe pas.");
  const geste = gesteEnCours(etat);
  const moment = raisonDuMoment(etat, geste, evenement);
  if (moment !== null) return horsMoment(moment);
  const source = jugerSource(etat, geste, evenement.source);
  if (source !== null) return source;
  if (enPreparation(geste) && !sourceAvantLePaiement(etat, geste, evenement.source)) return interdit(SOURCE_AVANT_LE_PAIEMENT);
  if (geste !== null && passifDe(etat, evenement.source) !== null && dejaServi(geste, evenement.source)) return interdit("Ce passif a déjà servi pour ce jet.");
  const bornes = Object.hasOwn(BORNES, evenement.genre) ? BORNES[evenement.genre](etat, geste, evenement) : null;
  if (bornes !== null) return bornes;
  return jugerPrix(etat, evenement.source, evenement.x ?? 0) ?? OUI;
}

// Le dernier essai de la dernière place d'un jet.
const dernierEssai = (jet) => {
  const essais = jet.places[jet.places.length - 1].essais;
  return essais[essais.length - 1];
};

// Ce que chaque genre change, sur l'état payé : { etat?, geste?, effet? },
// chacun à défaut inchangé. « effet » est l'EffetDuGeste, auquel s'ajoute ce
// que le journal en dira ; « id », le pas de l'événement, qui nomme l'effet
// durable qu'il pose. Les avantages, désavantages et opérations de dégâts ne
// changent rien d'autre que geste.effets, que lisent circonstances.js et
// degats.js.
const APPLICATIONS = {
  relancer: (etat, geste) => ({ geste: { ...geste, jet: relancerParPalette(geste.jet).jet } }),

  inverser(etat, geste, effet) {
    const avant = evaluerEssai(geste.jet, dernierEssai(geste.jet)).garde;
    const { jet } = inverserDernier(geste.jet);
    return { geste: { ...geste, jet }, effet: { ...effet, avant, apres: evaluerEssai(jet, dernierEssai(jet)).garde } };
  },

  reussite(etat, geste, effet) {
    const { jet } = ajouterReussite(geste.jet);
    return { geste: { ...geste, jet }, effet: { ...effet, avant: reussites(geste.jet), apres: reussites(jet) } };
  },

  // La zone choisie remplace celle de la face, que le d20 garde (contrat, § 5.3).
  zone(etat, geste, effet) {
    const avant = localisationsDuGeste(etat, geste)[effet.de].zone;
    const choisie = { zone: effet.zone, source: effet.source };
    const localisation = geste.localisation.map((d20, rang) => (rang === effet.de ? { ...d20, choisie } : d20));
    return { geste: { ...geste, localisation }, effet: { ...effet, avant, apres: effet.zone } };
  },

  reporter: (etat, geste, effet) => ({ effet: { ...effet, avant: victimeDe(geste) } }),

  // Plusieurs cibles : la cible en cours reste au rang où elle est.
  toute_la_case: (etat, geste, effet) => ({ geste: { ...geste, cibles: [...effet.cibles] } }),

  // Une attaque en plus, sans action, jusqu'au prochain tour du camp de son
  // porteur, l'auteur (contrat, § 5.5).
  attaque_en_plus: (etat, geste, effet, id) => poser(etat, effet, durable(id, "attaque_en_plus", { ...effet, porteur: effet.auteur, duree: "tour" })),

  // Rendre, sans passer le maximum (contrat, § 5.6).
  rendre(etat, geste, effet) {
    const courant = courantDe(etat, effet.sur);
    const lue = ressourceDe(courant, effet);
    const apres = Math.min(lue.max, lue.valeur + effet.n);
    return { etat: changer(etat, effet.sur, lue.champs(apres)), effet: { ...effet, avant: lue.valeur, apres } };
  },

  attaque: (etat, geste, effet, id) => ecarter(etat, effet, id),
  defense: (etat, geste, effet, id) => ecarter(etat, effet, id),

  // Un état : celui « pour ce jet » reste dans le geste ; les autres sont
  // durables. Seul l'événement « blessure » pose une blessure.
  etat(etat, geste, effet, id) {
    if (effet.duree === "jet") return {};
    return poser(etat, effet, durable(id, "etat", { ...effet, porteur: effet.sur }, { capacite: effet.capacite ?? null, libre: effet.libre ?? null, blessure: false }));
  },

  deplacer(etat, geste, effet) {
    const depart = courantDe(etat, effet.sur).case;
    return { etat: changer(etat, effet.sur, { case: effet.vers }), effet: { ...effet, depart } };
  },
};

// Un effet durable posé : l'état qui le porte, et l'effet du geste qui le
// nomme.
const poser = (etat, effet, pose) => ({ etat: ajouterDurable(etat, pose), effet: { ...effet, durable: pose.id } });

// ±N : « pour ce jet », dans le geste seul (valeurs.js et circonstances.js
// l'y lisent) ; sinon un effet durable « modif » porté par « sur ».
function ecarter(etat, effet, id) {
  return effet.duree === "jet" ? {} : poser(etat, effet, durable(id, "modif", { ...effet, porteur: effet.sur }, { valeur: effet.genre, n: effet.n }));
}

/**
 * Applique un événement « effet » que jugerEffet a accepté, et rend
 * { etat, effet } :
 * - « etat » : l'état neuf, non gelé ; le passif payant payé par son porteur ;
 *   pendant un geste, le geste au sommet remplacé, qui porte l'effet au bout
 *   de geste.effets et, pour un passif, sa trace dans geste.passifs ;
 * - « effet » : l'EffetDuGeste (contrat, § 4), la copie de l'événement avec
 *   « prix » ({ souffle, lien, jauge, lienNonPaye } ou null), « rang » (celui
 *   de la cible en cours, null hors d'un geste), « auteur » (null pour le MJ
 *   hors d'un geste), « camp » (celui de l'auteur, ou le camp qui joue),
 *   « durable » (l'identifiant de l'effet durable posé, ou null), et ce que le
 *   journal dira : « avant » et « apres » d'une ressource rendue, d'une zone
 *   choisie, d'un dé inversé (sa valeur gardée), d'une réussite ajoutée ;
 *   « avant », la victime d'avant un report ; « depart », la case d'avant un
 *   déplacement.
 * Hors d'un geste, le moteur écrit ensuite la ligne de l'effet.
 */
export function appliquerEffet(etat, evenement) {
  const geste = gesteEnCours(etat);
  const { source } = evenement;
  const prix = prixDuPassif(etat, source, evenement.x ?? 0);
  const auteur = auteurDe(etat, geste, source);
  const camp = auteur === null ? etat.tour.camp : campDe(etat, auteur);
  const effet = { ...evenement, prix, rang: geste === null ? null : (geste.rang ?? 0), auteur, camp, durable: null };
  const paye = payer(etat, source.qui, prix);
  const fait = Object.hasOwn(APPLICATIONS, evenement.genre) ? APPLICATIONS[evenement.genre](paye, geste, effet, etat.pas + 1) : {};
  const suivant = fait.etat ?? paye;
  const applique = fait.effet ?? effet;
  if (geste === null) return { etat: suivant, effet: applique };
  const change = fait.geste ?? geste;
  const passifs = passifDe(etat, source) === null ? (change.passifs ?? []) : [...(change.passifs ?? []), { qui: source.qui, capacite: source.capacite }];
  return { etat: poserLeGeste(suivant, { ...change, effets: [...(change.effets ?? []), applique], passifs }), effet: applique };
}

// ─── Le MJ ──────────────────────────────────────────────────────────────────

// Les valeurs que change « Modifier une valeur… » (contrat, § 6.3) : comment
// chacune se lit sur le courant (et la photographie, pour le bouclier), et ce
// qu'il faut changer pour la poser. Un maximum qui descend sous la valeur
// courante l'entraîne avec lui.
const VALEURS_DU_MJ = {
  attaque: { lire: (courant) => courant.attaque, poser: (courant, valeur) => ({ ...courant, attaque: valeur }) },
  defense: { lire: (courant) => courant.defense, poser: (courant, valeur) => ({ ...courant, defense: valeur }) },
  souffle: { lire: (courant) => courant.souffle, poser: (courant, valeur) => ({ ...courant, souffle: valeur }) },
  souffleMax: { lire: (courant) => courant.souffleMax, poser: (courant, valeur) => ({ ...courant, souffleMax: valeur, souffle: Math.min(courant.souffle, valeur) }) },
  actions: { lire: (courant) => courant.actions, poser: (courant, valeur) => ({ ...courant, actions: valeur }) },
  actionsMax: { lire: (courant) => courant.actionsMax, poser: (courant, valeur) => ({ ...courant, actionsMax: valeur, actions: Math.min(courant.actions, valeur) }) },
  corps: { lire: (courant) => courant.corps, poser: (courant, valeur) => ({ ...courant, corps: valeur }) },
  lien: {
    lire: (courant, { jauge }) => courant.liens[jauge].points,
    poser: (courant, valeur, { jauge }) => ({ ...courant, liens: courant.liens.map((une, k) => (k === jauge ? { ...une, points: valeur } : une)) }),
  },
  armure: {
    lire: (courant, { zone }) => courant.zones[zone].armure,
    poser: (courant, valeur, { zone }) => ({ ...courant, zones: courant.zones.map((une, k) => (k === zone ? { ...une, armure: valeur } : une)) }),
  },
  endurance: {
    lire: (courant, { zone }) => courant.zones[zone].resistance,
    poser: (courant, valeur, { zone }) => ({ ...courant, zones: courant.zones.map((une, k) => (k === zone ? { ...une, resistance: valeur } : une)) }),
  },
  // La défense du bouclier : celle que le MJ a posée, sinon celle de la photo.
  bouclier: { lire: (courant, entree, photo) => courant.bouclier ?? photo.bouclier.defense, poser: (courant, valeur) => ({ ...courant, bouclier: valeur }) },
};

// Une valeur du MJ que ce protagoniste n'a pas, ou null. Aucune n'est bornée
// par son maximum, le lien compris : en Mode MJ, le MJ décide (contrat, § 12,
// choix 16) ; seule « rendre », dans la palette, l'est.
function jugerUneValeur(courant, photo, { champ, zone, jauge }) {
  if ((champ === "attaque" || champ === "defense") && courant.camp !== "adv") return horsBornes("L'attaque et la défense sont celles d'un adversaire.");
  if (champ === "lien" && element(courant.liens, jauge) === null) return horsBornes("Cette jauge de lien n'existe pas.");
  if ((champ === "armure" || champ === "endurance") && element(courant.zones, zone) === null) return horsBornes("Cette zone n'existe pas.");
  if (champ === "bouclier" && (photo?.bouclier ?? null) === null) return horsBornes("Ce protagoniste n'a pas de bouclier.");
  return null;
}

// Les capacités qu'une blessure a ajoutées à la photographie d'un protagoniste
// (contrat, § 5.9) : les indices que nomment ses effets durables de blessure,
// rangés, chacun une fois.
function capacitesDeBlessure(etat, qui) {
  const indices = effetsDe(etat)
    .filter((effet) => effet.genre === "etat" && effet.blessure === true && effet.porteur === qui && effet.source?.genre === "capacite" && effet.source.qui === qui)
    .map((effet) => effet.source.capacite);
  return [...new Set(indices)].sort((a, b) => a - b).filter((indice) => capaciteDe(etat, qui, indice) !== null);
}

/**
 * Pourquoi une photographie qui porterait ces capacités passerait ses bornes
 * (BORNES_PHOTO : deux cents capacités, six cents façons en tout), ou null.
 * Une blessure (js/combat/offre.js) et un changement d'équipement, qui
 * ajoutent des capacités à une photographie, se refusent avec cette raison
 * (contrat, § 12, choix 20) : une photographie au-delà de ses bornes ne se
 * relirait plus.
 */
export function horsDesBornesDeLaPhoto(capacites) {
  if (capacites.length > BORNES_PHOTO.capacites) return `La photographie compterait plus de ${BORNES_PHOTO.capacites} capacités.`;
  const facons = capacites.reduce((total, capacite) => total + capacite.facons.length, 0);
  return facons > BORNES_PHOTO.faconsEnTout ? `La photographie compterait plus de ${BORNES_PHOTO.faconsEnTout} façons.` : null;
}

/**
 * Pourquoi la victime du geste en cours ne peut pas recevoir cette capacité
 * du bloc de blessure, ou null : sa photographie passerait ses bornes
 * (horsDesBornesDeLaPhoto ; contrat, § 12, choix 20). L'offre refuse alors
 * l'événement « blessure » qui la porte ; l'état libre (« Une autre… ») reste
 * possible. L'écran y lit la raison d'une capacité inactive de l'étape « La
 * blessure ».
 */
export function refusDeLaBlessure(etat, capacite) {
  const geste = gesteEnCours(etat);
  const photo = geste === null ? null : photoDe(etat, victimeDe(geste));
  return photo === null ? null : horsDesBornesDeLaPhoto([...photo.capacites, capacite]);
}

// Les capacités de la photographie neuve que pose un changement d'équipement :
// les siennes, puis celles qu'une blessure avait ajoutées à l'ancienne.
function capacitesApresLEquipement(etat, qui, photo) {
  const ancienne = photoDe(etat, qui);
  return [...photo.capacites, ...capacitesDeBlessure(etat, qui).map((indice) => ancienne.capacites[indice])];
}

// L'indice, dans la photographie neuve, de chaque capacité de l'ancienne
// (contrat, § 12, choix 17) : celles d'une blessure, remises au bout dans leur
// ordre ; les autres, par leur nom (la première de ce nom qui n'est pas déjà
// prise). Une capacité qui disparaît n'y est pas.
function nouveauxIndices(ancienne, photo, deBlessure) {
  const indices = new Map(deBlessure.map((indice, rang) => [indice, photo.capacites.length + rang]));
  const prises = new Set();
  ancienne.capacites.forEach((capacite, indice) => {
    if (indices.has(indice)) return;
    const neuf = photo.capacites.findIndex((une, rang) => une.nom === capacite.nom && !prises.has(rang));
    if (neuf === -1) return;
    prises.add(neuf);
    indices.set(indice, neuf);
  });
  return indices;
}

// L'arme d'une façon, par son nom ; null sans arme.
const nomDeLArme = (photo, facon) => (facon.arme === null ? null : (element(photo.armes, facon.arme)?.nom ?? null));

// La façon gardée, retrouvée dans la capacité neuve : celle de la même
// puissance et de la même arme, par son nom ; -1 si elle n'y est plus.
function nouvelleFacon(ancienne, neuve, { capacite, facon }, indice) {
  const lue = element(ancienne.capacites[capacite]?.facons, facon);
  if (lue === null) return -1;
  const arme = nomDeLArme(ancienne, lue);
  return neuve.capacites[indice].facons.findIndex((une) => une.puissance === lue.puissance && nomDeLArme(neuve, une) === arme);
}

// Les effets durables après le changement d'équipement de « qui » (contrat,
// § 12, choix 17) : les sources qui nomment une de ses capacités, et ses
// gardes, à leur nouvel indice ; ceux dont la capacité, ou la façon gardée,
// disparaît s'en vont, sans ligne. Les autres restent, les objets mêmes.
function effetsApresLEquipement(etat, qui, ancienne, neuve, indices) {
  const restent = [];
  for (const effet of effetsDe(etat)) {
    let suivant = effet;
    if (effet.source?.genre === "capacite" && effet.source.qui === qui) {
      const indice = indices.get(effet.source.capacite);
      if (indice === undefined) continue;
      if (indice !== effet.source.capacite) suivant = { ...suivant, source: { ...effet.source, capacite: indice } };
    }
    if (effet.genre === "guet" && effet.porteur === qui) {
      const indice = indices.get(effet.garde.capacite);
      const facon = indice === undefined ? -1 : nouvelleFacon(ancienne, neuve, effet.garde, indice);
      if (facon === -1) continue;
      if (indice !== effet.garde.capacite || facon !== effet.garde.facon) suivant = { ...suivant, garde: { capacite: indice, facon } };
    }
    restent.push(suivant);
  }
  return restent;
}

// Ce que chaque genre du MJ demande de plus que sa forme.
const JUGES_DU_MJ = {
  valeurs(etat, { qui, valeurs }) {
    const courant = courantDe(etat, qui);
    const photo = photoDe(etat, qui);
    for (const entree of valeurs) {
      const refus = jugerUneValeur(courant, photo, entree);
      if (refus !== null) return refus;
    }
    const change = valeurs.some((entree) => VALEURS_DU_MJ[entree.champ].lire(courant, entree, photo) !== entree.valeur);
    return change ? null : interdit("Aucune valeur ne change.");
  },

  // La photographie recalculée : celle de ce protagoniste (son camp, son
  // identifiant), avec autant de zones ; ses capacités de blessure remises au
  // bout, dans ses bornes.
  equipement(etat, { qui, photo }) {
    const ancienne = photoDe(etat, qui);
    if ((qui.startsWith("pj") ? "pj" : "adv") !== campDe(etat, qui)) return horsBornes("Cette photographie n'est pas du camp de ce protagoniste.");
    if (photo.identifiant !== ancienne.identifiant) return horsBornes("Cette photographie n'est pas celle de ce protagoniste.");
    if (photo.zones.length !== ancienne.zones.length) return horsBornes("Cette photographie n'a pas le même nombre de zones.");
    const raison = horsDesBornesDeLaPhoto(capacitesApresLEquipement(etat, qui, photo));
    return raison === null ? null : interdit(raison);
  },

  etat(etat, { qui, retrait }) {
    if (retrait === undefined) return null;
    return etatPorte(etat, retrait)?.porteur === qui ? null : horsBornes("Cet état n'est pas porté par ce protagoniste.");
  },

  deplacer: (etat, { qui, vers }) => (courantDe(etat, qui).case === vers ? interdit(DEJA_SUR_LA_CASE) : null),
};

/**
 * Dit si un geste du MJ (l'événement « mj », contrat, § 6.3), déjà lu par
 * validerEvenement, se joue à cet instant : { ok: true }, ou { ok: false,
 * code, message }. Entre deux gestes seulement, sur un protagoniste présent et
 * vivant ; puis ce que son genre demande : une valeur que ce protagoniste a, et
 * au moins une qui change ; une photographie du même protagoniste ; un état
 * qu'il porte ; une autre case.
 */
export function jugerMj(etat, evenement) {
  const phase = horsDuCombat(etat);
  if (phase !== null) return horsMoment(phase);
  if (gesteEnCours(etat) !== null) return horsMoment("Le geste en cours se finit d'abord.");
  const refus = jugerVivant(etat, evenement.qui);
  if (refus !== null) return refus;
  return (Object.hasOwn(JUGES_DU_MJ, evenement.genre) ? JUGES_DU_MJ[evenement.genre](etat, evenement) : null) ?? OUI;
}

// Ce que chaque genre du MJ change. « id » est le pas de l'événement.
const GESTES_DU_MJ = {
  valeurs(etat, { qui, valeurs }) {
    const photo = photoDe(etat, qui);
    const courant = valeurs.reduce((avant, entree) => VALEURS_DU_MJ[entree.champ].poser(avant, entree.valeur, entree, photo), courantDe(etat, qui));
    return { ...etat, protagonistes: { ...etat.protagonistes, [qui]: courant } };
  },

  // L'équipement (contrat, § 6.3 ; § 12, choix 17) : la photographie neuve,
  // ses capacités de blessure remises au bout ; les effets durables et les
  // gardes suivent leur capacité à son nouvel indice, ou s'en vont avec elle ;
  // l'armure de chaque zone garde les dégâts reçus ; l'attaque et la défense
  // d'un adversaire, et le bouclier, suivent la photo ; le reste demeure.
  equipement(etat, { qui, photo }) {
    const ancienne = photoDe(etat, qui);
    const neuve = { ...photo, capacites: capacitesApresLEquipement(etat, qui, photo) };
    const indices = nouveauxIndices(ancienne, photo, capacitesDeBlessure(etat, qui));
    const effets = effetsApresLEquipement(etat, qui, ancienne, neuve, indices);
    const courant = courantDe(etat, qui);
    const zones = courant.zones.map((zone, rang) => {
      const armureMax = photo.zones[rang].armure;
      return { ...zone, armure: Math.max(0, armureMax - (zone.armureMax - zone.armure)), armureMax };
    });
    const valeurs = courant.camp === "adv" ? { attaque: photo.attaque, defense: photo.defense } : {};
    return {
      ...changer(etat, qui, { zones, bouclier: null, ...valeurs }),
      photos: { ...etat.photos, [qui]: neuve },
      effets,
    };
  },

  // Un état du MJ : sa source est le MJ, sans auteur, et sa durée se dit du
  // camp qui joue (convention 62).
  etat(etat, { qui, ajout, retrait }, id) {
    if (retrait !== undefined) return { ...etat, effets: effetsDe(etat).filter((effet) => effet.id !== retrait) };
    const pose = durable(
      id,
      "etat",
      { porteur: qui, auteur: null, camp: etat.tour.camp, duree: ajout.duree, source: { genre: "mj" } },
      { capacite: ajout.capacite ?? null, libre: ajout.libre ?? null, blessure: false },
    );
    return ajouterDurable(etat, pose);
  },

  deplacer: (etat, { qui, vers }) => changer(etat, qui, { case: vers }),

  // Retiré du combat : il ne joue plus, ne se cible plus, et les effets qu'il
  // porte s'en vont.
  retirer(etat, { qui }) {
    return { ...changer(etat, qui, { retire: true }), effets: effetsDe(etat).filter((effet) => effet.porteur !== qui) };
  },
};

/**
 * Applique un geste du MJ que jugerMj a accepté, et rend { etat }, neuf et
 * non gelé. Le moteur écrit ensuite sa ligne, constate la mort d'un corps mis
 * à 0 et juge la fin du combat.
 */
export function appliquerMj(etat, evenement) {
  return { etat: GESTES_DU_MJ[evenement.genre](etat, evenement, etat.pas + 1) };
}

// ─── Les effets durables ────────────────────────────────────────────────────

/**
 * L'échéance (convention 15) : au début du prochain tour du camp « camp »,
 * ses effets durables de durée « tour » s'en vont, dans l'ordre de
 * etat.effets. Rend { etat, parties } : l'état sans eux (l'objet même s'il
 * n'y en a aucun), et la liste de ceux qui sont partis, pour leurs lignes. Un
 * effet « combat » ne finit jamais.
 */
export function echeances(etat, camp) {
  const effets = effetsDe(etat);
  const parties = effets.filter((effet) => effet.duree === "tour" && effet.camp === camp);
  if (parties.length === 0) return { etat, parties };
  return { etat: { ...etat, effets: effets.filter((effet) => !parties.includes(effet)) }, parties };
}

/**
 * L'état sans les effets durables que porte un mort ou un retiré : ils s'en
 * vont sans ligne, à la fin du geste qui le tue (contrat, § 3). L'objet même
 * s'il n'y en a aucun.
 */
export function sansEffetsDesAbsents(etat) {
  const effets = effetsDe(etat);
  const restent = effets.filter((effet) => vivant(etat, effet.porteur));
  return restent.length === effets.length ? etat : { ...etat, effets: restent };
}

/**
 * L'attaque en plus de ce protagoniste (contrat, § 5.5) : le premier effet
 * durable « attaque_en_plus » qu'il porte, ou null.
 */
export function attaqueEnPlusDe(etat, id) {
  return effetsDe(etat).find((effet) => effet.genre === "attaque_en_plus" && effet.porteur === id) ?? null;
}

/**
 * La garde qui rend cette ligne jouable en intervention (contrat, § 6.2) :
 * l'effet « guet » actif que porte ce protagoniste sur cette capacité et cette
 * façon, qui existent dans sa photographie ; null sinon.
 */
export function gardeJouable(etat, id, capacite, facon) {
  if (element(capaciteDe(etat, id, capacite)?.facons, facon) === null) return null;
  return effetsDe(etat).find((effet) => effet.genre === "guet" && effet.porteur === id && effet.garde?.capacite === capacite && effet.garde?.facon === facon) ?? null;
}
