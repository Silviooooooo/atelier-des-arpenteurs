// Lecteur d'archive ZIP (SPECIFICATION.md, § 6.1).
//
// Un .xlsx est une archive ZIP. Ce module lit le répertoire central, puis
// l'en-tête local de chaque entrée demandée, et décompresse par
// DecompressionStream("deflate-raw"), natif dans les navigateurs et dans
// Node 22 : aucune bibliothèque. Il vérifie la taille et le CRC-32 de chaque
// entrée lue.
//
// Il ne lit ni les archives ZIP64, ni les archives chiffrées, ni celles qui
// s'étendent sur plusieurs volumes, ni d'autres méthodes que « stockée » (0)
// et « deflate » (8) : un classeur n'en a pas besoin. Chacun de ces cas
// donne une ErreurZip au message clair, jamais une exception brute.

export class ErreurZip extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurZip";
  }
}

const FIN_DU_REPERTOIRE = 0x06054b50;
const LOCALISATEUR_ZIP64 = 0x07064b50;
const ENTREE_CENTRALE = 0x02014b50;
const EN_TETE_LOCAL = 0x04034b50;
const DRAPEAU_CHIFFREE = 0x0001;

const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** Le CRC-32 d'une suite d'octets, tel que le ZIP le note. */
export function crc32(octets) {
  let crc = 0xffffffff;
  for (let i = 0; i < octets.length; i += 1) crc = TABLE_CRC[(crc ^ octets[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// La fin du répertoire central fait 22 octets, suivis d'un commentaire
// d'au plus 65 535 octets : on la cherche en remontant depuis la fin.
function chercherFin(octets, vue) {
  const limite = Math.max(0, octets.length - 22 - 0xffff);
  for (let position = octets.length - 22; position >= limite; position -= 1) {
    if (vue.getUint32(position, true) === FIN_DU_REPERTOIRE) return position;
  }
  if (octets.length >= 4 && vue.getUint32(0, true) === EN_TETE_LOCAL) {
    throw new ErreurZip("archive tronquée, sa fin est introuvable");
  }
  throw new ErreurZip("ce n'est pas une archive ZIP");
}

async function decompresser(donnees, nom) {
  if (typeof DecompressionStream === "undefined") {
    throw new ErreurZip("ce navigateur ne sait pas décompresser (DecompressionStream absent)");
  }
  try {
    const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  } catch {
    throw new ErreurZip(`« ${nom} » a des données compressées illisibles, l'archive est abîmée`);
  }
}

async function lireEntree(octets, vue, entree) {
  if (entree.drapeaux & DRAPEAU_CHIFFREE) throw new ErreurZip(`« ${entree.nom} » est chiffrée`);
  const local = entree.positionLocale;
  if (local + 30 > octets.length || vue.getUint32(local, true) !== EN_TETE_LOCAL) {
    throw new ErreurZip(`l'en-tête local de « ${entree.nom} » est illisible, l'archive est abîmée`);
  }
  // Le nom et le champ supplémentaire de l'en-tête local peuvent différer de
  // ceux du répertoire central : leurs longueurs se relisent ici.
  const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true);
  const fin = debut + entree.tailleCompressee;
  if (fin > octets.length) throw new ErreurZip(`« ${entree.nom} » est incomplète, l'archive est tronquée`);
  const donnees = octets.subarray(debut, fin);

  let contenu;
  if (entree.methode === 0) contenu = donnees;
  else if (entree.methode === 8) contenu = await decompresser(donnees, entree.nom);
  else throw new ErreurZip(`« ${entree.nom} » emploie la méthode de compression ${entree.methode}, non prise en charge`);

  if (contenu.length !== entree.taille) throw new ErreurZip(`« ${entree.nom} » n'a pas la taille annoncée, l'archive est abîmée`);
  if (crc32(contenu) !== entree.crc) throw new ErreurZip(`« ${entree.nom} » a un CRC faux, l'archive est abîmée`);
  return contenu;
}

/**
 * Ouvre une archive ZIP rangée dans un Uint8Array. Rend { noms, contient,
 * lire } ; lire(nom) est asynchrone et rend le contenu de l'entrée. Les noms
 * se comparent sans casse, comme les noms de parties d'un classeur.
 * Lève ErreurZip sur une archive illisible.
 */
export function lireArchive(octets) {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const fin = chercherFin(octets, vue);
  const nombre = vue.getUint16(fin + 10, true);
  const taille = vue.getUint32(fin + 12, true);
  const debut = vue.getUint32(fin + 16, true);

  if (fin >= 20 && vue.getUint32(fin - 20, true) === LOCALISATEUR_ZIP64) throw new ErreurZip("archive ZIP64, non prise en charge");
  if (nombre === 0xffff || taille === 0xffffffff || debut === 0xffffffff) throw new ErreurZip("archive ZIP64, non prise en charge");
  if (vue.getUint16(fin + 4, true) !== 0 || vue.getUint16(fin + 6, true) !== 0 || vue.getUint16(fin + 8, true) !== nombre) {
    throw new ErreurZip("archive répartie sur plusieurs volumes, non prise en charge");
  }
  if (debut + taille > fin) throw new ErreurZip("archive tronquée ou abîmée : son répertoire central sort du fichier");

  const decodeur = new TextDecoder("utf-8");
  const entrees = new Map();
  let position = debut;
  for (let i = 0; i < nombre; i += 1) {
    if (position + 46 > debut + taille || vue.getUint32(position, true) !== ENTREE_CENTRALE) {
      throw new ErreurZip("archive abîmée : son répertoire central est illisible");
    }
    const longueurNom = vue.getUint16(position + 28, true);
    const suivante = position + 46 + longueurNom + vue.getUint16(position + 30, true) + vue.getUint16(position + 32, true);
    if (suivante > debut + taille) throw new ErreurZip("archive abîmée : son répertoire central est illisible");
    const entree = {
      nom: decodeur.decode(octets.subarray(position + 46, position + 46 + longueurNom)),
      drapeaux: vue.getUint16(position + 8, true),
      methode: vue.getUint16(position + 10, true),
      crc: vue.getUint32(position + 16, true),
      tailleCompressee: vue.getUint32(position + 20, true),
      taille: vue.getUint32(position + 24, true),
      positionLocale: vue.getUint32(position + 42, true),
    };
    const cle = entree.nom.toLowerCase();
    if (!entrees.has(cle)) entrees.set(cle, entree);
    position = suivante;
  }

  return {
    noms: [...entrees.values()].map((entree) => entree.nom),
    contient: (nom) => entrees.has(nom.toLowerCase()),
    lire: async (nom) => {
      const entree = entrees.get(nom.toLowerCase());
      if (!entree) throw new ErreurZip(`l'archive ne contient pas « ${nom} »`);
      return lireEntree(octets, vue, entree);
    },
  };
}
