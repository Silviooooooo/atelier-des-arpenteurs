// La comparaison mot à mot de deux descriptions d'une capacité : son niveau
// actuel et le suivant (SPECIFICATION.md, § 15.3, étape 8 du créateur).
//
// Chaque texte se découpe en mots, suites de lettres, de chiffres et de
// marques au sens Unicode (\p{L}, \p{N}, \p{M}), et en ce qui les sépare :
// signes et espaces. Les mots se comparent tels quels, sans ignorer ni la
// casse ni les accents. La plus longue sous-suite commune des deux suites de
// mots dit ce qui demeure : un mot du texte actuel hors d'elle est « retiré »,
// un mot du texte suivant hors d'elle est « ajouté ». Les signes et les
// espaces ne sont jamais marqués, et se gardent tels qu'écrits : la
// concaténation des morceaux redonne chaque texte, à l'octet près.
//
// Le module ne connaît aucune règle du jeu : il ne lit que deux chaînes, en
// rend deux suites de morceaux, et ne lève pas d'exception.

const MOT = /[\p{L}\p{N}\p{M}]+/gu;

// Au-delà de ce nombre de cases, la table de la sous-suite coûterait trop de
// mémoire pour une description : aucun mot n'y est alors tenu pour commun.
// Une description du classeur en est loin (quelques dizaines de mots).
const CASES_MAX = 4_000_000;

/** Les mots d'un texte, chacun avec sa place : { mot, debut, fin }. */
function decouper(texte) {
  return [...texte.matchAll(MOT)].map((m) => ({ mot: m[0], debut: m.index, fin: m.index + m[0].length }));
}

/**
 * Les mots de chaque texte qui appartiennent à une plus longue sous-suite
 * commune : deux tableaux de booléens, un par mot. Le début et la fin
 * communs se retirent d'abord ; la table des longueurs ne porte que le reste.
 */
function communs(a, b) {
  const gardeA = new Array(a.length).fill(false);
  const gardeB = new Array(b.length).fill(false);
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) {
    gardeA[debut] = gardeB[debut] = true;
    debut += 1;
  }
  let finA = a.length;
  let finB = b.length;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) {
    finA -= 1;
    finB -= 1;
    gardeA[finA] = gardeB[finB] = true;
  }
  const n = finA - debut;
  const m = finB - debut;
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > CASES_MAX) return { gardeA, gardeB };

  // longueur[i * (m + 1) + j] : la longueur de la plus longue sous-suite
  // commune des mots de a à partir de debut + i et de b à partir de debut + j.
  const largeur = m + 1;
  const longueur = new Uint32Array((n + 1) * largeur);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      longueur[i * largeur + j] =
        a[debut + i] === b[debut + j] ? 1 + longueur[(i + 1) * largeur + j + 1] : Math.max(longueur[(i + 1) * largeur + j], longueur[i * largeur + j + 1]);
    }
  }
  // Le chemin, du début : deux mots égaux se gardent ensemble ; sinon on
  // écarte celui dont l'écart garde la plus longue sous-suite (le mot du
  // texte actuel, à égalité).
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[debut + i] === b[debut + j]) {
      gardeA[debut + i] = gardeB[debut + j] = true;
      i += 1;
      j += 1;
    } else if (longueur[(i + 1) * largeur + j] >= longueur[i * largeur + j + 1]) i += 1;
    else j += 1;
  }
  return { gardeA, gardeB };
}

/**
 * Les morceaux d'un texte : les mots hors de la sous-suite, chacun seul et
 * marqué ; tout le reste, mots communs, signes et espaces, en morceaux non
 * marqués, les voisins réunis. cle : « retire » ou « ajoute ».
 */
function morceaux(texte, mots, garde, cle) {
  const liste = [];
  const ajouter = (bout, marque) => {
    if (!bout) return;
    const dernier = liste[liste.length - 1];
    if (!marque && dernier && !dernier[cle]) dernier.texte += bout;
    else liste.push({ texte: bout, [cle]: marque });
  };
  let position = 0;
  mots.forEach(({ debut, fin }, k) => {
    ajouter(texte.slice(position, debut), false);
    ajouter(texte.slice(debut, fin), !garde[k]);
    position = fin;
  });
  ajouter(texte.slice(position), false);
  return liste;
}

/**
 * La comparaison de deux textes, mot à mot : { avant: [{ texte, retire }],
 * apres: [{ texte, ajoute }] }. La concaténation des « texte » de chaque
 * suite redonne exactement chaque texte ; un texte vide n'a aucun morceau.
 */
export function difference(avant, apres) {
  const texteAvant = typeof avant === "string" ? avant : "";
  const texteApres = typeof apres === "string" ? apres : "";
  const motsAvant = decouper(texteAvant);
  const motsApres = decouper(texteApres);
  const { gardeA, gardeB } = communs(
    motsAvant.map((m) => m.mot),
    motsApres.map((m) => m.mot),
  );
  return {
    avant: morceaux(texteAvant, motsAvant, gardeA, "retire"),
    apres: morceaux(texteApres, motsApres, gardeB, "ajoute"),
  };
}
