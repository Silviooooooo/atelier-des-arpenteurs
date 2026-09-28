// Lecteur XML du projet (SPECIFICATION.md, § 6.1).
//
// Le même lecteur sert à la page et aux contrôles : avec deux lecteurs, les
// contrôles vérifieraient un code que la page n'exécute pas. Il ne lit que ce
// qu'un classeur contient : éléments, attributs, texte, entités et sections
// CDATA. Il ignore les commentaires et les instructions de traitement, et
// refuse les DOCTYPE, qu'un classeur ne contient pas et qui ouvriraient la
// porte aux entités externes.
//
// Balises et attributs se retrouvent par leur nom local, sans préfixe
// d'espace de noms (x:row = row) : certains logiciels préfixent tout le XML
// d'un classeur.

export class ErreurXml extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurXml";
  }
}

const ENTITES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const REFERENCE = /&(?:#x([0-9A-Fa-f]+);|#([0-9]+);|([A-Za-z_][\w.-]*);)|&/g;
const NOM_BALISE = /[^\s/>]+/y;
const ATTRIBUT = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
const BLANCS = /\s*/y;

function decoder(brut) {
  if (!brut.includes("&")) return brut;
  return brut.replace(REFERENCE, (reference, hexadecimal, decimal, nom) => {
    if (hexadecimal !== undefined || decimal !== undefined) {
      const code = hexadecimal !== undefined ? parseInt(hexadecimal, 16) : parseInt(decimal, 10);
      if (code > 0x10ffff) throw new ErreurXml(`référence de caractère invalide : ${reference}`);
      return String.fromCodePoint(code);
    }
    if (nom !== undefined && Object.hasOwn(ENTITES, nom)) return ENTITES[nom];
    throw new ErreurXml(nom === undefined ? "« & » isolé dans le texte" : `entité inconnue : ${reference}`);
  });
}

function nomLocal(nom) {
  return nom.slice(nom.indexOf(":") + 1);
}

function sauter(xml, fermeture, depuis, quoi) {
  const fin = xml.indexOf(fermeture, depuis);
  if (fin === -1) throw new ErreurXml(`${quoi} jamais fermé`);
  return fin + fermeture.length;
}

// Lit la balise qui commence à `debut`, met la pile à jour et rend la
// position qui la suit.
function lireBalise(xml, debut, pile) {
  if (xml.startsWith("<!--", debut)) return sauter(xml, "-->", debut + 4, "commentaire");
  if (xml.startsWith("<![CDATA[", debut)) {
    const fin = sauter(xml, "]]>", debut + 9, "section CDATA");
    pile.at(-1).enfants.push(xml.slice(debut + 9, fin - 3));
    return fin;
  }
  if (xml.startsWith("<?", debut)) return sauter(xml, "?>", debut + 2, "instruction de traitement");
  if (xml.startsWith("<!", debut)) throw new ErreurXml("DOCTYPE refusé : un classeur n'en contient pas");

  if (xml.startsWith("</", debut)) {
    const fin = sauter(xml, ">", debut + 2, "balise fermante");
    const nom = xml.slice(debut + 2, fin - 1).trim();
    if (pile.length === 1 || pile.at(-1).nom !== nom) {
      throw new ErreurXml(`balise </${nom}> sans balise ouvrante correspondante`);
    }
    pile.pop();
    return fin;
  }

  NOM_BALISE.lastIndex = debut + 1;
  const nom = NOM_BALISE.exec(xml)?.[0];
  if (!nom) throw new ErreurXml("balise sans nom");
  const element = { nom, local: nomLocal(nom), attributs: Object.create(null), enfants: [] };
  let position = NOM_BALISE.lastIndex;
  for (;;) {
    ATTRIBUT.lastIndex = position;
    const trouve = ATTRIBUT.exec(xml);
    if (!trouve) break;
    const [, cle, entreGuillemets, entreApostrophes] = trouve;
    if (Object.hasOwn(element.attributs, cle)) throw new ErreurXml(`attribut ${cle} répété dans <${nom}>`);
    // Normalisation des valeurs d'attribut (XML 1.0, § 3.3.3) : les blancs
    // écrits tels quels deviennent des espaces, pas ceux des références.
    element.attributs[cle] = decoder((entreGuillemets ?? entreApostrophes).replace(/[\t\n]/g, " "));
    position = ATTRIBUT.lastIndex;
  }
  BLANCS.lastIndex = position;
  BLANCS.exec(xml);
  position = BLANCS.lastIndex;

  pile.at(-1).enfants.push(element);
  if (xml.startsWith("/>", position)) return position + 2;
  if (xml[position] === ">") {
    pile.push(element);
    return position + 1;
  }
  throw new ErreurXml(`balise <${nom}> mal formée`);
}

/**
 * Lit un texte XML et rend son élément racine : { nom, local, attributs,
 * enfants }, où chaque enfant est un élément ou une chaîne de texte.
 * Lève ErreurXml sur un XML mal formé.
 */
export function lireXml(source) {
  // Fins de ligne normalisées comme l'exige XML 1.0 (§ 2.11). La marque
  // d'ordre des octets, elle, est déjà retirée par TextDecoder.
  const xml = source.replace(/\r\n?/g, "\n");
  const document = { nom: "", local: "", attributs: Object.create(null), enfants: [] };
  const pile = [document];
  let position = 0;
  while (position < xml.length) {
    const chevron = xml.indexOf("<", position);
    const finDuTexte = chevron === -1 ? xml.length : chevron;
    if (finDuTexte > position) pile.at(-1).enfants.push(decoder(xml.slice(position, finDuTexte)));
    if (chevron === -1) break;
    position = lireBalise(xml, chevron, pile);
  }
  if (pile.length > 1) throw new ErreurXml(`balise <${pile.at(-1).nom}> jamais fermée`);
  const racines = document.enfants.filter((enfant) => typeof enfant !== "string");
  const texteAuDehors = document.enfants.some((enfant) => typeof enfant === "string" && enfant.trim() !== "");
  if (racines.length !== 1 || texteAuDehors) throw new ErreurXml("le document n'a pas exactement un élément racine");
  return racines[0];
}

/** Les enfants d'un élément qui portent ce nom local. */
export function enfants(element, local) {
  return element.enfants.filter((enfant) => typeof enfant !== "string" && enfant.local === local);
}

/** Le premier enfant qui porte ce nom local, ou null. */
export function premier(element, local) {
  return element.enfants.find((enfant) => typeof enfant !== "string" && enfant.local === local) ?? null;
}

/** Le texte d'un élément et de tous ses descendants, dans l'ordre. */
export function texte(element) {
  let resultat = "";
  for (const enfant of element.enfants) resultat += typeof enfant === "string" ? enfant : texte(enfant);
  return resultat;
}

/**
 * La valeur d'un attribut, cherché par son nom exact puis par son nom local
 * (r:id répond à « id »), ou null. Les déclarations d'espace de noms ne
 * répondent jamais.
 */
export function attribut(element, nom) {
  if (Object.hasOwn(element.attributs, nom)) return element.attributs[nom];
  for (const [cle, valeur] of Object.entries(element.attributs)) {
    if (!cle.startsWith("xmlns") && nomLocal(cle) === nom) return valeur;
  }
  return null;
}
