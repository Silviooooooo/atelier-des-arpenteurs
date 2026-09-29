// Les expressions du classeur (SPECIFICATION.md, § 5.1 et § 15.2).
//
// Une expression est faite de nombres (virgule décimale, comme dans le
// classeur : « 0,5 »), de caractéristiques ou de paramètres entre accolades
// (« {force} »), de la puissance N, et des quatre opérations + - * /, la
// multiplication et la division passant avant l'addition et la
// soustraction. Toute autre forme (parenthèses, signe seul, lettre
// inconnue) n'est pas calculée : elle s'affiche telle qu'écrite, avec un
// avertissement dans le rapport du personnage.
//
// Le calcul se fait en fractions exactes, puis s'arrondit à l'entier
// inférieur une fois l'opération faite (livret, « Système », « Valeurs
// décimales ») : 5 × (1/3 + 2/3) vaut 5, jamais 4 par une erreur de virgule
// flottante.
//
// « X » est une valeur décidée en jeu, par le MJ (un paramètre) ou par le
// joueur (un coût) (lisez_moi) : elle n'est pas une erreur, elle reste « X ».

function pgcd(a, b) {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

/** Une fraction réduite { n, d }, d > 0 ; null si elle sort des entiers sûrs. */
export function fraction(n, d = 1) {
  if (d === 0 || !Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return null;
  const signe = d < 0 ? -1 : 1;
  const g = pgcd(n, d);
  return { n: (signe * n) / g, d: (signe * d) / g };
}

const OPERATIONS = {
  "+": (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d),
  "-": (a, b) => fraction(a.n * b.d - b.n * a.d, a.d * b.d),
  "*": (a, b) => fraction(a.n * b.n, a.d * b.d),
  "/": (a, b) => (b.n === 0 ? null : fraction(a.n * b.d, a.d * b.n)),
};

/** L'entier inférieur ou égal à une fraction, calculé sans virgule flottante. */
export function entierInferieur(f) {
  const reste = ((f.n % f.d) + f.d) % f.d;
  return (f.n - reste) / f.d;
}

/** Un nombre écrit comme dans le classeur : « 12 », « 0,5 ». */
export function lireNombre(texte) {
  const trouve = /^(\d{1,9})(?:,(\d{1,6}))?$/.exec(String(texte).trim());
  if (!trouve) return null;
  const decimales = trouve[2] ?? "";
  return fraction(Number(trouve[1] + decimales), 10 ** decimales.length);
}

// Découpe une expression en jetons ; null dès qu'un signe n'y a pas sa place.
function jetons(texte) {
  const resultat = [];
  const motif = /\s*(?:(\d+(?:,\d+)?)|\{([^{}]*)\}|(N)|([+\-*/]))/y;
  let position = 0;
  const source = String(texte);
  while (position < source.length) {
    if (/^\s*$/.test(source.slice(position))) break;
    motif.lastIndex = position;
    const trouve = motif.exec(source);
    if (!trouve) return null;
    position = motif.lastIndex;
    if (trouve[1] !== undefined) resultat.push({ nombre: trouve[1] });
    else if (trouve[2] !== undefined) resultat.push({ nom: trouve[2].trim() });
    else if (trouve[3] !== undefined) resultat.push({ nom: "N" });
    else resultat.push({ operation: trouve[4] });
  }
  return resultat;
}

/**
 * Évalue une expression. valeurDe(nom) rend la fraction d'un nom (« N »,
 * « force », « degats »…) ou null s'il est inconnu. Rend { valeur, entier }
 * (entier : l'arrondi inférieur), { x: true } pour une valeur « X », ou
 * { erreur } avec la raison.
 */
export function evaluer(texte, valeurDe = () => null) {
  const source = String(texte ?? "").trim();
  if (source === "") return { erreur: "expression vide" };
  if (source === "X") return { x: true };
  const suite = jetons(source);
  if (!suite || suite.length === 0) return { erreur: `« ${source} » n'est pas une expression que l'Atelier calcule` };
  // Alternance stricte : opérande, opération, opérande…
  const operandes = [];
  const operations = [];
  for (let i = 0; i < suite.length; i += 1) {
    const jeton = suite[i];
    if (i % 2 === 1) {
      if (!jeton.operation) return { erreur: `« ${source} » : une opération manque` };
      operations.push(jeton.operation);
      continue;
    }
    if (jeton.operation) return { erreur: `« ${source} » : un nombre manque avant « ${jeton.operation} »` };
    const valeur = jeton.nombre !== undefined ? lireNombre(jeton.nombre) : valeurDe(jeton.nom);
    if (!valeur) return { erreur: jeton.nom !== undefined ? `« {${jeton.nom}} » est inconnu ici` : `« ${jeton.nombre} » n'est pas un nombre lisible` };
    operandes.push(valeur);
  }
  if (operandes.length !== operations.length + 1) return { erreur: `« ${source} » finit par une opération` };
  // La multiplication et la division d'abord, de gauche à droite.
  const termes = [operandes[0]];
  const signes = [];
  for (let i = 0; i < operations.length; i += 1) {
    const operation = operations[i];
    if (operation === "*" || operation === "/") {
      const produit = OPERATIONS[operation](termes.pop(), operandes[i + 1]);
      if (!produit) return { erreur: operation === "/" ? `« ${source} » divise par zéro` : `« ${source} » sort des nombres calculables` };
      termes.push(produit);
    } else {
      signes.push(operation);
      termes.push(operandes[i + 1]);
    }
  }
  let valeur = termes[0];
  for (let i = 0; i < signes.length; i += 1) {
    valeur = OPERATIONS[signes[i]](valeur, termes[i + 1]);
    if (!valeur) return { erreur: `« ${source} » sort des nombres calculables` };
  }
  return { valeur, entier: entierInferieur(valeur) };
}

/**
 * Découpe la valeur d'un paramètre à plusieurs rangs (« 5/10/15 » pour des
 * dégâts, six valeurs pour une armure). La barre sépare les rangs ; dans un
 * paramètre à une seule valeur, elle divise. Rend les morceaux, ou null si
 * leur nombre n'est pas celui attendu.
 */
export function rangs(texte, attendus) {
  if (attendus === 1) return [String(texte)];
  const morceaux = String(texte).split("/");
  return morceaux.length === attendus ? morceaux : null;
}

/** Une fraction écrite pour le lecteur : l'entier, ou « 7/2 ». */
export function ecrireFraction(f) {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}
