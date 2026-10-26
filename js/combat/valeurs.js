// Toute lecture d'un protagoniste, et du geste en cours (SPECIFICATION.md,
// § 17 « Le simulateur de combat (lot 4) »).
//
// Les règles du combat ne fouillent jamais l'état d'elles-mêmes : elles
// demandent ici ce que vaut un protagoniste (son camp, sa case, son attaque,
// sa défense, ses blessures, ses alliés, ses capacités) et quel geste est en
// cours. Ce module existe pour que ces lectures n'aient qu'un chemin : au
// groupe 2, un effet à durée (« défense −1 jusqu'au prochain tour ») changera
// ce que valent une attaque et une défense, et il se branchera ici, sans
// qu'aucune règle ne change. C'est pourquoi attaqueDe() et defenseDe() rendent
// déjà une valeur, sa base et la liste de ses écarts.
//
// Deux sources, qui ne se mêlent pas (§ 17) :
// - ce qui bouge pendant le combat (case, actions, souffle, corps, armure,
//   endurance, attaque, défense, mort) se lit dans etat.protagonistes ;
// - ce qui ne bouge pas (capacités, armes, passifs, grille, caractéristiques)
//   se lit dans etat.photos, qui porte les valeurs de chaque photographie,
//   jamais sa source.
//
// Ce fichier n'importe rien : l'offre, le journal et les vues y prennent le
// geste en cours sans passer par le moteur, donc sans cycle d'import.
//
// Aucune lecture ne lève : un identifiant ou un indice vient parfois d'un
// événement gardé, qui a pu être forgé. Ce qui n'existe pas se rend null (ou
// une liste vide, ou zéro).

// Une propriété propre, et elle seule : « constructor » ou « __proto__ » ne
// sont l'identifiant de personne.
const propre = (objet, nom) => (objet !== null && typeof objet === "object" && typeof nom === "string" && Object.hasOwn(objet, nom) ? objet[nom] : null);

const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);

/**
 * Le geste en cours, ou null entre deux gestes. C'est le sommet de la pile :
 * au groupe 1 elle n'a jamais plus d'un geste, au groupe 2 une intervention
 * ou une contre-attaque s'empilera sur le geste qu'elle interrompt.
 */
export function gesteEnCours(etat) {
  const pile = etat?.pile;
  return Array.isArray(pile) && pile.length > 0 ? pile[pile.length - 1] : null;
}

/** Les valeurs de la photographie d'un protagoniste : ce qui ne bouge pas. null s'il n'est pas dans le combat. */
export function photoDe(etat, id) {
  return propre(etat?.photos, id);
}

/** L'état courant d'un protagoniste : ce qui bouge. null s'il n'est pas dans le combat. */
export function courantDe(etat, id) {
  return propre(etat?.protagonistes, id);
}

/** Son camp : « pj » ou « adv » ; null s'il n'est pas dans le combat. */
export function campDe(etat, id) {
  return courantDe(etat, id)?.camp ?? null;
}

/** Vrai tant qu'il n'est pas mort. Un mort ne joue plus, ne se cible plus, et n'est l'allié de personne. */
export function vivant(etat, id) {
  const courant = courantDe(etat, id);
  return courant !== null && courant.mort === null;
}

/** Les vivants d'un camp, dans l'ordre d'ajout (le seul ordre des protagonistes). */
export function vivantsDe(etat, camp) {
  return etat.ordre.filter((id) => campDe(etat, id) === camp && vivant(etat, id));
}

/**
 * Vrai quand il a joué : il n'a plus d'action, ou il a passé son tour. Ce
 * n'est gardé nulle part. Vrai aussi pour qui n'est pas dans le combat : il
 * n'a rien à jouer.
 */
export function aJoue(etat, id) {
  const courant = courantDe(etat, id);
  return courant === null || courant.passe === true || courant.actions <= 0;
}

// Au groupe 1, rien ne modifie une attaque ni une défense : la valeur est la
// base, et la liste des écarts est vide.
const sansEcart = (base) => ({ valeur: base, base, ecarts: [] });

/**
 * L'attaque d'un adversaire : la difficulté du jet de défense du PJ qu'il
 * vise. Sa valeur est null pour un PJ, dont l'attaque est un dé.
 */
export function attaqueDe(etat, id) {
  return sansEcart(courantDe(etat, id)?.attaque ?? null);
}

/**
 * La défense d'un adversaire : la difficulté du jet d'attaque du PJ qui le
 * vise. Sa valeur est null pour un PJ, dont la défense est un dé.
 */
export function defenseDe(etat, id) {
  return sansEcart(courantDe(etat, id)?.defense ?? null);
}

/**
 * Le nombre de ses blessures : une par zone dont l'endurance est à 0
 * (livret, « Ressources »). Pour un PJ, chacune retire 1 à ses jets ; pour un
 * adversaire, le compte n'a pas d'effet calculé (convention provisoire, § 12).
 */
export function blessuresDe(etat, id) {
  const zones = courantDe(etat, id)?.zones ?? [];
  return zones.filter((zone) => zone.resistance <= 0).length;
}

/**
 * Ses alliés présents sur sa case, dans l'ordre d'ajout : les vivants de son
 * camp, autres que lui (convention provisoire, § 12). C'est ce que regardent
 * les passifs « seul sur sa case », « en meute » et « esprit de corps ».
 */
export function alliesSurLaCase(etat, id) {
  const courant = courantDe(etat, id);
  if (courant === null) return [];
  return etat.ordre.filter((autre) => {
    const voisin = courantDe(etat, autre);
    return autre !== id && voisin !== null && voisin.mort === null && voisin.camp === courant.camp && voisin.case === courant.case;
  });
}

/** Une capacité d'un protagoniste, par son indice dans sa photographie ; null si elle n'existe pas. */
export function capaciteDe(etat, id, indice) {
  return element(photoDe(etat, id)?.capacites, indice);
}

/** La façon que joue un geste (la capacité, à la puissance ou avec l'arme choisie) ; null si elle n'existe pas. */
export function faconDe(etat, geste) {
  if (geste === null || typeof geste !== "object") return null;
  return element(capaciteDe(etat, geste.acteur, geste.capacite)?.facons, geste.facon);
}
