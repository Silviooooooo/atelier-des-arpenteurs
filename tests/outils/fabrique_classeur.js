// Fabrique de classeurs .xlsx pour les contrôles (SPECIFICATION.md, § 10.3).
//
// C'est le seul code du projet qui écrive un classeur, et il n'écrit que des
// classeurs fictifs (interdit 4), à partir d'une description lisible : le
// classeur d'essai se relit ainsi dans son code source, et ses variantes se
// fabriquent au moment de l'essai. Il emploie node:zlib, fourni avec Node.
//
// Une description : { feuilles: [{ nom, prefixe?, lignes }] }. La ligne
// d'indice i est la ligne i + 1 d'Excel ; null y laisse une ligne vide.
// Une cellule est null (vide), une chaîne (chaîne partagée), un nombre, ou
// un objet : { riche: [morceaux], phonetique? }, { enLigne: texte },
// { formule, texte }, { booleen }, { erreur }. Un préfixe écrit tout le XML
// de la feuille sous ce préfixe d'espace de noms (x:row…).
//
// L'archive ne dépend que de la description (date fixe). _rels/.rels y est
// « stockée », sans compression, pour que la lecture exerce les deux
// méthodes du ZIP.

import { crc32, deflateRawSync } from "node:zlib";

const PRINCIPAL = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PAQUET = "http://schemas.openxmlformats.org/package/2006/relationships";
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const PREAMBULE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const TYPE_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml";

const DATE_DOS = ((2026 - 1980) << 9) | (9 << 5) | 28;
const HEURE_DOS = 12 << 11;

function echapperXml(texte) {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Comme Excel : un « _xHHHH_ » écrit par l'auteur devient « _x005F_xHHHH_ »,
// et les caractères qu'XML ne sait pas porter, retour chariot compris,
// s'écrivent « _xHHHH_ ».
function echapperTexte(texte) {
  return echapperXml(
    texte
      .replace(/_x(?=[0-9A-Fa-f]{4}_)/g, "_x005F_x")
      .replace(/[\u0000-\u0008\u000B-\u001F]/g, (c) => `_x${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}_`),
  );
}

function lettres(indice) {
  let resultat = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) resultat = String.fromCharCode(65 + ((n - 1) % 26)) + resultat;
  return resultat;
}

function celluleXml(cellule, reference, p, chaine) {
  if (cellule === null || cellule === undefined) return "";
  const c = (type, contenu) => `<${p}c r="${reference}"${type ? ` t="${type}"` : ""}>${contenu}</${p}c>`;
  if (typeof cellule === "string") return c("s", `<${p}v>${chaine({ texte: cellule })}</${p}v>`);
  if (typeof cellule === "number") return c("", `<${p}v>${cellule}</${p}v>`);
  if ("riche" in cellule) return c("s", `<${p}v>${chaine(cellule)}</${p}v>`);
  if ("enLigne" in cellule) return c("inlineStr", `<${p}is><${p}t xml:space="preserve">${echapperTexte(cellule.enLigne)}</${p}t></${p}is>`);
  if ("formule" in cellule) return c("str", `<${p}f>${echapperXml(cellule.formule)}</${p}f><${p}v>${echapperTexte(cellule.texte)}</${p}v>`);
  if ("booleen" in cellule) return c("b", `<${p}v>${cellule.booleen ? 1 : 0}</${p}v>`);
  if ("erreur" in cellule) return c("e", `<${p}v>${echapperXml(cellule.erreur)}</${p}v>`);
  throw new Error(`Cellule inconnue de la fabrique : ${JSON.stringify(cellule)}`);
}

function feuilleXml(feuille, chaine) {
  const p = feuille.prefixe ? `${feuille.prefixe}:` : "";
  const espace = feuille.prefixe ? `xmlns:${feuille.prefixe}="${PRINCIPAL}"` : `xmlns="${PRINCIPAL}"`;
  let lignes = "";
  feuille.lignes.forEach((ligne, i) => {
    const cellules = (ligne ?? []).map((cellule, j) => celluleXml(cellule, `${lettres(j)}${i + 1}`, p, chaine)).join("");
    if (cellules) lignes += `<${p}row r="${i + 1}">${cellules}</${p}row>`;
  });
  return `${PREAMBULE}<${p}worksheet ${espace}><${p}sheetData>${lignes}</${p}sheetData></${p}worksheet>`;
}

function chainesXml(chaines, references) {
  const si = chaines.map((chaine) => {
    if (!chaine.riche) return `<si><t xml:space="preserve">${echapperTexte(chaine.texte)}</t></si>`;
    const morceaux = chaine.riche
      .map((morceau, i) => `<r>${i % 2 ? "<rPr><b/></rPr>" : ""}<t xml:space="preserve">${echapperTexte(morceau)}</t></r>`)
      .join("");
    const phonetique = chaine.phonetique
      ? `<rPh sb="0" eb="1"><t>${echapperTexte(chaine.phonetique)}</t></rPh><phoneticPr fontId="0" type="noConversion"/>`
      : "";
    return `<si>${morceaux}${phonetique}</si>`;
  });
  return `${PREAMBULE}<sst xmlns="${PRINCIPAL}" count="${references}" uniqueCount="${chaines.length}">${si.join("")}</sst>`;
}

const STYLES =
  `${PREAMBULE}<styleSheet xmlns="${PRINCIPAL}">` +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** Écrit une archive ZIP : [{ nom, contenu (Buffer), stocker? }] → Buffer. */
export function archiver(entrees) {
  const morceaux = [];
  const repertoire = [];
  let position = 0;
  for (const { nom, contenu, stocker } of entrees) {
    const nomOctets = Buffer.from(nom, "utf8");
    const donnees = stocker ? contenu : deflateRawSync(contenu);
    const methode = stocker ? 0 : 8;
    const crc = crc32(contenu);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(methode, 8);
    local.writeUInt16LE(HEURE_DOS, 10);
    local.writeUInt16LE(DATE_DOS, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(contenu.length, 22);
    local.writeUInt16LE(nomOctets.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(methode, 10);
    central.writeUInt16LE(HEURE_DOS, 12);
    central.writeUInt16LE(DATE_DOS, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(donnees.length, 20);
    central.writeUInt32LE(contenu.length, 24);
    central.writeUInt16LE(nomOctets.length, 28);
    central.writeUInt32LE(position, 42);

    morceaux.push(local, nomOctets, donnees);
    repertoire.push(central, nomOctets);
    position += 30 + nomOctets.length + donnees.length;
  }
  const central = Buffer.concat(repertoire);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...morceaux, central, fin]);
}

/** Fabrique un classeur .xlsx à partir de sa description ; rend un Buffer. */
export function fabriquerClasseur(description) {
  const chaines = [];
  const indices = new Map();
  let references = 0;
  const chaine = (morceau) => {
    references += 1;
    if (morceau.riche) return chaines.push(morceau) - 1;
    if (!indices.has(morceau.texte)) indices.set(morceau.texte, chaines.push(morceau) - 1);
    return indices.get(morceau.texte);
  };
  const feuilles = description.feuilles.map((feuille) => feuilleXml(feuille, chaine));
  const n = feuilles.length;

  const types =
    `${PREAMBULE}<Types xmlns="${TYPES}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${TYPE_MIME}.sheet.main+xml"/>` +
    feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${TYPE_MIME}.worksheet+xml"/>`).join("") +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${TYPE_MIME}.sharedStrings+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${TYPE_MIME}.styles+xml"/>` +
    "</Types>";
  const racine =
    `${PREAMBULE}<Relationships xmlns="${PAQUET}">` +
    `<Relationship Id="rId1" Type="${RELATIONS}/officeDocument" Target="xl/workbook.xml"/>` +
    "</Relationships>";
  const classeur =
    `${PREAMBULE}<workbook xmlns="${PRINCIPAL}" xmlns:r="${RELATIONS}"><sheets>` +
    description.feuilles.map((feuille, i) => `<sheet name="${echapperXml(feuille.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    "</sheets></workbook>";
  const relations =
    `${PREAMBULE}<Relationships xmlns="${PAQUET}">` +
    feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${RELATIONS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${n + 1}" Type="${RELATIONS}/sharedStrings" Target="sharedStrings.xml"/>` +
    `<Relationship Id="rId${n + 2}" Type="${RELATIONS}/styles" Target="styles.xml"/>` +
    "</Relationships>";

  const parties = [
    { nom: "[Content_Types].xml", xml: types },
    { nom: "_rels/.rels", xml: racine, stocker: true },
    { nom: "xl/workbook.xml", xml: classeur },
    { nom: "xl/_rels/workbook.xml.rels", xml: relations },
    ...feuilles.map((xml, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, xml })),
    { nom: "xl/sharedStrings.xml", xml: chainesXml(chaines, references) },
    { nom: "xl/styles.xml", xml: STYLES },
  ];
  return archiver(parties.map(({ nom, xml, stocker }) => ({ nom, contenu: Buffer.from(xml, "utf8"), stocker })));
}
