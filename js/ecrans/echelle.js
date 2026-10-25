// L'échelle d'un papier à l'écran, et la place de la bulle du combat
// (SPECIFICATION.md, § 10.1, § 15.5, § 16.6 et § 17.7 ; complément du lot 4,
// groupe 2, § 4.1).
//
// La fiche d'un personnage et la carte d'un adversaire sont du papier, à
// leurs dimensions : sur un écran plus étroit qu'elles, elles se réduisent
// à sa largeur, et le zoom à deux doigts les agrandit. L'échelle est un
// nombre, posé en propriété CSS (--echelle), que la feuille de style lit
// (zoom).
//
// La bulle du combat, son onglet et ses infobulles s'accrochent à une case
// ou à une ligne : leur place se calcule ici, sans DOM (calculerPlace), puis
// s'écrit en trois propriétés CSS (--bulle-gauche, --bulle-haut,
// --bulle-fleche) que css/combat.css lit (placerBulle). L'ancrage CSS
// (anchor-name) n'est pas employé : Firefox ne le garantit pas. La place se
// refait à l'ouverture et quand la fenêtre change de taille, jamais au
// défilement : la bulle ne fait jamais défiler la page.
//
// Ce sont les seules écritures de style du code, et elles vivent ici :
// poserEchelle et placerBulle, rien d'autre. Un contrôle vérifie qu'aucun
// autre module de js/ n'en fait (tests/echelle.test.js).

/**
 * Pose l'échelle d'un papier, et la rend : la largeur de ce qui le
 * contient, rapportée à la sienne, jamais plus de 1. conteneur : un nœud
 * stable (pas celui qu'un écran remplace), dont le parent donne la largeur
 * disponible. Sans mise en page, ou hors de la page, l'échelle vaut 1.
 */
export function poserEchelle(conteneur, largeurPapier) {
  const largeur = conteneur.parentNode?.clientWidth ?? 0;
  const facteur = largeur > 0 ? Math.min(1, largeur / largeurPapier) : 1;
  conteneur.style?.setProperty("--echelle", String(facteur));
  return facteur;
}

// Le papier que la fenêtre tient à l'échelle : un seul à la fois.
let tenu = null;

function lacher() {
  if (tenu) globalThis.removeEventListener?.("resize", tenu);
  tenu = null;
}

/**
 * Tient un papier à l'échelle de l'écran : à l'affichage, puis à chaque
 * redimensionnement de la fenêtre. Rend la mesure, que l'écran relance
 * quand son contenu change de hauteur (une barre de défilement qui paraît
 * rétrécit la page). Un seul papier à la fois : l'écouteur du précédent se
 * retire, comme celui d'un papier qui a quitté la page.
 */
export function tenirALEchelle(conteneur, largeurPapier) {
  lacher();
  let affiche = false;
  const mesurer = () => {
    if (conteneur.isConnected) {
      affiche = true;
      poserEchelle(conteneur, largeurPapier);
    } else if (affiche && tenu === mesurer) {
      // Il a quitté la page. Un papier pas encore posé dans la page garde
      // son écouteur, et la mesure tardive d'un papier déjà remplacé ne
      // retire pas celui de son successeur.
      lacher();
    }
  };
  if (!globalThis.requestAnimationFrame) return mesurer;
  tenu = mesurer;
  globalThis.addEventListener?.("resize", mesurer);
  requestAnimationFrame(mesurer);
  return mesurer;
}

// ─── La place de la bulle ───────────────────────────────────────────────────

/** La flèche d'une bulle, en px : égale à --fleche-bulle (css/jetons.css). */
export const FLECHE = 8;

// Une valeur ramenée dans [min, max] ; à min quand l'intervalle est vide
// (ce qui se place dépasse la fenêtre : il se colle à la marge).
const ramener = (valeur, min, max) => Math.max(min, Math.min(valeur, max));

/**
 * La place d'une bulle accrochée à une ancre ; pure, en px entiers, dans le
 * repère de la fenêtre. ancre : { gauche, haut, droite, bas } ; taille :
 * { largeur, hauteur } de la bulle ; fenetre : { largeur, hauteur } ;
 * cotes : les côtés essayés dans l'ordre, parmi « droite », « gauche »,
 * « dessous », « dessus » ; ecart : la distance entre l'ancre et la bulle ;
 * pointe : la distance visée entre le bord de la bulle et le milieu de
 * l'ancre.
 *
 * Un côté tient quand la bulle y est entière, à « marge » au moins des
 * bords de la fenêtre : le premier qui tient l'emporte. Si aucun ne tient,
 * le premier, ramené dans la fenêtre sur les deux axes (à « marge » si la
 * taille la dépasse). fleche : la place de la pointe le long du bord qui
 * regarde l'ancre, en face de son milieu, à « coin » au moins des coins.
 * Rend { cote, gauche, haut, fleche, entiere }.
 */
export function calculerPlace({ ancre, taille, fenetre, cotes, ecart, pointe, marge = 16, coin = 12 }) {
  const { largeur, hauteur } = taille;
  const xMax = fenetre.largeur - marge - largeur;
  const yMax = fenetre.hauteur - marge - hauteur;
  const milieuX = (ancre.gauche + ancre.droite) / 2;
  const milieuY = (ancre.haut + ancre.bas) / 2;
  const essayer = (cote) => {
    if (cote === "droite") return { cote, x: ancre.droite + ecart, y: ramener(milieuY - pointe, marge, yMax) };
    if (cote === "gauche") return { cote, x: ancre.gauche - ecart - largeur, y: ramener(milieuY - pointe, marge, yMax) };
    if (cote === "dessous") return { cote, x: ramener(milieuX - pointe, marge, xMax), y: ancre.bas + ecart };
    if (cote === "dessus") return { cote, x: ramener(milieuX - pointe, marge, xMax), y: ancre.haut - ecart - hauteur };
    throw new TypeError(`Côté inconnu : ${cote}.`);
  };
  const tient = ({ x, y }) => x >= marge && x <= xMax && y >= marge && y <= yMax;
  const essais = cotes.map(essayer);
  const premier = essais[0];
  const place = essais.find(tient) ?? { cote: premier.cote, x: ramener(premier.x, marge, xMax), y: ramener(premier.y, marge, yMax) };
  // Un côté qui tient suppose la bulle plus petite que la fenêtre, marges
  // ôtées : « entière » ne dépend que de sa taille.
  const entiere = largeur <= fenetre.largeur - 2 * marge && hauteur <= fenetre.hauteur - 2 * marge;
  const laterale = place.cote === "droite" || place.cote === "gauche";
  const fleche = laterale ? ramener(milieuY - place.y, coin, hauteur - coin) : ramener(milieuX - place.x, coin, largeur - coin);
  return { cote: place.cote, gauche: Math.round(place.x), haut: Math.round(place.y), fleche: Math.round(fleche), entiere };
}

/**
 * Place une bulle (montrée et remplie : sa taille se mesure) contre son
 * ancre, et rend { cote, entiere }. ancre, repere : ce qui a une boîte
 * (getBoundingClientRect), un nœud ou une boîte composée par l'appelant
 * (l'infobulle d'une ligne : les bords gauche et droit de la bulle, le haut
 * et le bas de la ligne) ; repere : ce par rapport à quoi la bulle se pose
 * (position: absolute). Écrit trois propriétés, en px entiers relatifs au
 * repère, et rien d'autre : la classe du côté, c'est l'appelant qui la pose.
 */
export function placerBulle(noeud, { ancre, repere, fenetre, cotes, ecart, pointe }) {
  const boite = noeud.getBoundingClientRect();
  const a = ancre.getBoundingClientRect();
  const r = repere.getBoundingClientRect();
  const place = calculerPlace({
    ancre: { gauche: a.left, haut: a.top, droite: a.right, bas: a.bottom },
    taille: { largeur: boite.width, hauteur: boite.height },
    fenetre,
    cotes,
    ecart,
    pointe,
  });
  noeud.style.setProperty("--bulle-gauche", `${Math.round(place.gauche - r.left)}px`);
  noeud.style.setProperty("--bulle-haut", `${Math.round(place.haut - r.top)}px`);
  noeud.style.setProperty("--bulle-fleche", `${place.fleche}px`);
  return { cote: place.cote, entiere: place.entiere };
}

// La bulle que la fenêtre tient en place : une seule à la fois, à part du
// papier tenu à l'échelle.
let tenue = null;

function lacherLaBulle() {
  if (tenue) globalThis.removeEventListener?.("resize", tenue);
  tenue = null;
}

/**
 * Tient une bulle en place : quand la fenêtre change de taille, appelle
 * auChangement(), qui la replace. Jamais au défilement : aucun autre
 * écouteur. Une seule bulle à la fois : l'écouteur de la précédente se
 * retire, comme celui d'une bulle qui a quitté la page (au changement de
 * taille qui suit). Rend lacher(), qui retire cet écouteur, et lui seul.
 */
export function tenirLaBulle(noeud, auChangement) {
  lacherLaBulle();
  // Une bulle pas encore posée dans la page (l'écran se construit hors
  // d'elle) garde son écouteur ; celle qui l'a quittée le perd.
  let vue = noeud.isConnected === true;
  const surLaTaille = () => {
    if (tenue !== surLaTaille) return;
    if (noeud.isConnected) {
      vue = true;
      auChangement();
    } else if (vue) {
      lacherLaBulle();
    }
  };
  tenue = surLaTaille;
  globalThis.addEventListener?.("resize", surLaTaille);
  return () => {
    if (tenue === surLaTaille) lacherLaBulle();
  };
}
