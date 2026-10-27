// Toute lecture d'un protagoniste, et du geste en cours (SPECIFICATION.md,
// § 17 « Le simulateur de combat (lot 4) »).
//
// Les règles du combat ne fouillent jamais l'état d'elles-mêmes : elles
// demandent ici ce que vaut un protagoniste (son camp, sa case, son attaque,
// sa défense, ses alliés, ses capacités, ses effets) et quel geste est en
// cours. Ce module existe pour que ces lectures n'aient qu'un chemin : un
// effet à durée (« défense −1 jusqu'au prochain tour ») change ce que valent
// une attaque et une défense, et il se branche ici, sans qu'aucune règle ne
// change. C'est pourquoi attaqueDe() et defenseDe() rendent une valeur, sa
// base et la liste de ses écarts.
//
// Deux sources, qui ne se mêlent pas (§ 17) :
// - ce qui bouge pendant le combat (case, actions, souffle, corps, armure,
//   endurance, attaque, défense, mort, retrait, effets durables) se lit dans
//   etat.protagonistes et etat.effets ;
// - ce qui ne bouge pas (capacités, armes, passifs, grille, caractéristiques)
//   se lit dans etat.photos, qui porte les valeurs de chaque photographie,
//   jamais sa source. Au groupe 3, une photographie peut être remplacée (le
//   MJ change l'équipement) ou prolongée (une capacité de blessure).
//
// Au groupe 3 (contrat de la vague 1, § 3, § 5.7 et § 7.3) :
// - un vivant est présent, ni mort ni retiré du combat par le MJ ;
// - ±N sur un adversaire écarte son attaque ou sa défense : les effets
//   durables « modif » qu'il porte, puis ceux « pour ce jet » du geste ;
// - la source d'un effet se nomme ici (nomDeLaSource) : une capacité, un état
//   porté, ou « MJ » ;
// - le −1 par zone sans endurance a disparu (mission, § 4.10) : une blessure
//   est un effet durable, et le compte des zones sans endurance s'en est allé
//   avec lui (personne ne le lisait plus).
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
 * au groupe 3, une intervention ou une contre-attaque s'empile sur le geste
 * qu'elle interrompt (trois étages au plus).
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

/**
 * Vrai tant qu'il est présent, ni mort ni retiré du combat par le MJ. Un mort
 * ou un retiré ne joue plus, ne se cible plus, et n'est l'allié de personne.
 */
export function vivant(etat, id) {
  const courant = courantDe(etat, id);
  return courant !== null && courant.mort === null && courant.retire !== true;
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

// ─── Les effets ─────────────────────────────────────────────────────────────

/** Les effets durables qu'il porte (etat.effets), dans leur ordre d'application. */
export function effetsDurablesDe(etat, id) {
  const effets = Array.isArray(etat?.effets) ? etat.effets : [];
  return effets.filter((effet) => effet.porteur === id);
}

/** Ses gardes actives : les effets durables « guet » qu'il porte (attendre), dans leur ordre. */
export function gardesDe(etat, id) {
  return effetsDurablesDe(etat, id).filter((effet) => effet.genre === "guet");
}

/**
 * Les effets appliqués pendant un geste, dans l'ordre : ceux des cibles déjà
 * finies (geste.faites), puis les siens. Un effet « pour ce jet » vaut pour
 * tous les jets du geste, ses cibles comprises (contrat, § 12, choix 6). Un
 * effet tenu deux fois (la même entrée) ne compte qu'une. Rien pour null.
 */
export function effetsDuGeste(geste) {
  if (geste === null || typeof geste !== "object") return [];
  const faites = Array.isArray(geste.faites) ? geste.faites.flatMap((faite) => (Array.isArray(faite?.effets) ? faite.effets : [])) : [];
  return [...new Set([...faites, ...(Array.isArray(geste.effets) ? geste.effets : [])])];
}

/**
 * Le nom d'une source d'effet (contrat, § 5) : le nom de la capacité ; pour
 * un état porté, celui de sa capacité figée, ou son texte libre ; « MJ » pour
 * le MJ. null pour ce qui n'existe pas (ou plus).
 */
export function nomDeLaSource(etat, source) {
  if (source === null || typeof source !== "object") return null;
  if (source.genre === "mj") return "MJ";
  if (source.genre === "capacite") return capaciteDe(etat, source.qui, source.capacite)?.nom ?? null;
  if (source.genre === "etat") {
    const effet = (Array.isArray(etat?.effets) ? etat.effets : []).find((un) => un.id === source.effet) ?? null;
    return effet?.capacite?.nom ?? effet?.libre ?? null;
  }
  return null;
}

// ─── L'attaque et la défense ────────────────────────────────────────────────

// Les écarts de son attaque ou de sa défense (« valeur ») : les effets
// durables « modif » qu'il porte, dans l'ordre d'application, puis les ±N
// « pour ce jet » du geste dont il est la cible (« sur »). Chacun avec le nom
// de sa source, et l'effet même.
function ecartsDe(etat, id, valeur, geste) {
  const durables = effetsDurablesDe(etat, id).filter((effet) => effet.genre === "modif" && effet.valeur === valeur);
  const duJet = effetsDuGeste(geste).filter((effet) => effet.genre === valeur && effet.sur === id && effet.duree === "jet");
  return [...durables, ...duJet].map((effet) => ({ nom: nomDeLaSource(etat, effet.source), source: effet.source ?? null, n: effet.n, effet }));
}

// La valeur écartée : la base et la somme des écarts ; null sans base (un PJ).
function ecartee(etat, id, valeur, geste) {
  const base = courantDe(etat, id)?.[valeur] ?? null;
  const ecarts = ecartsDe(etat, id, valeur, geste);
  return { valeur: base === null ? null : base + ecarts.reduce((total, ecart) => total + ecart.n, 0), base, ecarts };
}

/**
 * L'attaque d'un adversaire : la difficulté du jet de défense du PJ qu'il
 * vise. { valeur, base, ecarts: [{ nom, source, n, effet }] } : la base, que
 * le MJ peut changer, écartée par les ±N actifs (contrat, § 5.7) ; ceux
 * « pour ce jet » ne valent que pour le geste donné. Sa valeur est null pour
 * un PJ, dont l'attaque est un dé : ses ±N sont des modificateurs de ses jets
 * (circonstances).
 */
export function attaqueDe(etat, id, geste = null) {
  return ecartee(etat, id, "attaque", geste);
}

/**
 * La défense d'un adversaire : la difficulté du jet d'attaque du PJ qui le
 * vise, écartée comme son attaque. Sa valeur est null pour un PJ, dont la
 * défense est un dé.
 */
export function defenseDe(etat, id, geste = null) {
  return ecartee(etat, id, "defense", geste);
}

/**
 * Ses alliés présents sur sa case, dans l'ordre d'ajout : les vivants de son
 * camp, autres que lui (convention provisoire, § 12). C'est ce que regardent
 * les passifs « seul sur sa case », « en meute » et « esprit de corps ».
 */
export function alliesSurLaCase(etat, id) {
  const courant = courantDe(etat, id);
  if (courant === null) return [];
  return etat.ordre.filter((autre) => autre !== id && vivant(etat, autre) && campDe(etat, autre) === courant.camp && courantDe(etat, autre).case === courant.case);
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
