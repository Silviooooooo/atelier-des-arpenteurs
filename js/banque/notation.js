// Analyse de la notation des classeurs (SPECIFICATION.md, § 6.2).
//
// Chaque fonction lit le texte d'une cellule et rend { valeurs, anomalies }.
// Elle ne lève jamais d'exception. Ce qu'elle ne comprend pas, elle le garde
// tel quel sous la forme { brut } et le signale (E6) : rien n'est avalé.
// Rien n'est calculé non plus : les valeurs restent des chaînes (§ 5.1).
//
// Une cellule ne se découpe jamais sur une virgule située entre accolades,
// crochets ou parenthèses : « {force}*0,5 » porte une virgule décimale.

const FERMANTS = { "(": ")", "[": "]", "{": "}" };
const OUVRANTS = { ")": "(", "]": "[", "}": "{" };
const JAMAIS_FERME = {
  "(": "parenthèse « ( » jamais fermée",
  "[": "crochet « [ » jamais fermé",
  "{": "accolade « { » jamais fermée",
};
const DELIMITEURS = /[()[\]{}|]/;

// Découpe un texte sur un séparateur de premier niveau. Chaque morceau garde
// son défaut éventuel : délimiteur fermant sans ouvrant, ou jamais fermé.
function decouper(texte, separateur) {
  const morceaux = [];
  let courant = "";
  let defaut = null;
  const pile = [];
  for (const signe of texte) {
    if (FERMANTS[signe]) pile.push(signe);
    else if (OUVRANTS[signe]) {
      if (pile.at(-1) === OUVRANTS[signe]) pile.pop();
      else defaut ??= `« ${signe} » sans « ${OUVRANTS[signe]} » qui l'ouvre`;
    } else if (signe === separateur && pile.length === 0) {
      morceaux.push({ texte: courant.trim(), defaut });
      courant = "";
      defaut = null;
      continue;
    }
    courant += signe;
  }
  if (pile.length) defaut ??= JAMAIS_FERME[pile.at(-1)];
  morceaux.push({ texte: courant.trim(), defaut });
  // Un morceau vide (virgule finale, « a, , b ») ne porte aucune donnée.
  return morceaux.filter((morceau) => morceau.texte !== "");
}

function lire(texte, lireMorceau) {
  const valeurs = [];
  const anomalies = [];
  for (const { texte: morceau, defaut } of decouper(String(texte ?? ""), ",")) {
    const lu = defaut ? { anomalie: ["E6", defaut] } : lireMorceau(morceau);
    if (lu.anomalie) {
      const [code, raison] = lu.anomalie;
      valeurs.push({ brut: morceau });
      anomalies.push({ code, message: `« ${morceau} » : ${raison}` });
    } else {
      valeurs.push(lu.valeur);
    }
  }
  return { valeurs, anomalies };
}

const illisible = (raison) => ({ anomalie: ["E6", raison] });

// « (a | b) » ou « [a | b] » : les options, sans délimiteur ni option vide.
function options(morceau) {
  const liste = decouper(morceau.slice(1, -1), "|");
  const toutes = morceau.slice(1, -1).split("|").map((option) => option.trim());
  if (liste.length !== toutes.length || liste.some((option) => DELIMITEURS.test(option.texte))) return null;
  return liste.map((option) => option.texte);
}

function estEnsemble(morceau) {
  return (morceau.startsWith("(") && morceau.endsWith(")")) || (morceau.startsWith("[") && morceau.endsWith("]"));
}

/**
 * Blocs · capacites : « a, b » (simples), « (a | b) » (choix obligatoire),
 * « [a | b] » (ensemble facultatif).
 */
export function lireCapacites(texte) {
  return lire(texte, (morceau) => {
    if (estEnsemble(morceau)) {
      const liste = options(morceau);
      if (!liste) return illisible("option vide ou délimitée");
      return { valeur: { forme: morceau.startsWith("(") ? "choix" : "facultatif", options: liste } };
    }
    if (DELIMITEURS.test(morceau)) return illisible("forme non reconnue");
    return { valeur: { forme: "simple", nom: morceau } };
  });
}

// Un choix écrit dans une autre colonne que celle des capacités : lu, gardé
// tel quel, signalé par A7 (§ 6.2).
const choixHorsCapacites = { anomalie: ["A7", "choix écrit hors de la colonne des capacités, gardé tel quel"] };

/** Blocs · éléments : « a, b », cible éventuelle « Dégâts(Attaque à mains nues) ». */
export function lireElements(texte) {
  return lire(texte, (morceau) => {
    if (morceau.startsWith("(") || morceau.startsWith("[")) return choixHorsCapacites;
    const cible = /^([^()[\]{}|]+?)\s*\(([^()[\]{}|]+)\)$/.exec(morceau);
    if (cible) return { valeur: { nom: cible[1].trim(), cible: cible[2].trim() } };
    if (DELIMITEURS.test(morceau)) return illisible("forme non reconnue");
    return { valeur: { nom: morceau } };
  });
}

/**
 * Blocs · paramètres : « {nom:valeur} », valeur libre (accolades imbriquées
 * comprises), cible éventuelle « {nom:valeur}(capacité) ».
 */
export function lireParametres(texte) {
  return lire(texte, (morceau) => {
    if (morceau.startsWith("(") || morceau.startsWith("[")) return choixHorsCapacites;
    if (!morceau.startsWith("{")) return illisible("un paramètre s'écrit {nom:valeur}");
    // Fin de l'accolade ouvrante, profondeur comptée.
    let profondeur = 0;
    let fin = -1;
    for (let i = 0; i < morceau.length && fin === -1; i += 1) {
      if (morceau[i] === "{") profondeur += 1;
      else if (morceau[i] === "}" && --profondeur === 0) fin = i;
    }
    const interieur = morceau.slice(1, fin);
    const suite = morceau.slice(fin + 1).trim();
    const cible = /^\(([^()[\]{}|]+)\)$/.exec(suite);
    if (suite !== "" && !cible) return illisible("après l'accolade, seule une cible entre parenthèses est permise");
    const deuxPoints = interieur.indexOf(":");
    if (deuxPoints === -1) return illisible("paramètre sans « : »");
    const nom = interieur.slice(0, deuxPoints).trim();
    const valeur = interieur.slice(deuxPoints + 1).trim();
    if (nom === "" || DELIMITEURS.test(nom)) return illisible("nom de paramètre vide ou délimité");
    if (valeur === "") return illisible("paramètre sans valeur");
    return { valeur: { nom, valeur, cible: cible ? cible[1].trim() : null } };
  });
}

/** Capacites · éléments propres : « a », valeur éventuelle « Portee[1] ». */
export function lireElementsPropres(texte) {
  return lire(texte, (morceau) => {
    const valeur = /^([^()[\]{}|]+?)\s*\[([^()[\]{}|]+)\]$/.exec(morceau);
    if (valeur) return { valeur: { nom: valeur[1].trim(), valeur: valeur[2].trim() } };
    if (DELIMITEURS.test(morceau)) return illisible("forme non reconnue");
    return { valeur: { nom: morceau } };
  });
}

/** Eléments · paramètres reçus : « {portee} », un nom de paramètre entre accolades. */
export function lireParametresRecus(texte) {
  return lire(texte, (morceau) => {
    const nom = /^\{([^()[\]{}|:]+)\}$/.exec(morceau);
    if (!nom) return illisible("un paramètre reçu s'écrit {nom}");
    return { valeur: nom[1].trim() };
  });
}

/**
 * Les paramètres qu'un texte invoque sous la forme « {nom} », crochets
 * compris (« [N*{degats}] ») ; chacun une fois, dans l'ordre.
 */
export function parametresInvoques(texte) {
  const noms = [...String(texte ?? "").matchAll(/\{([^{}:]+)\}/g)].map((trouve) => trouve[1].trim());
  return [...new Set(noms)].filter(Boolean);
}
