// Fabrique les icônes de l'écran d'accueil (SPECIFICATION.md, § 9) : un
// monogramme « AA », en SVG et en PNG de 180, 192 et 512 pixels.
//
// Sans dépendance. Les lettres sont des quadrilatères convexes : le SVG les
// trace, et ce script les remplit lui-même pour les PNG, avec un
// anticrénelage par sous-échantillonnage, puis les compresse avec node:zlib.
// Le fond couvre tout le carré et les lettres restent dans le disque central
// (80 % du côté) : l'icône supporte les découpes d'Android (maskable), et
// iOS, qui remplit la transparence de noir, n'en trouve aucune.
//
// Les couleurs sont celles du thème clair de css/jetons.css : --accent pour
// le fond, --texte-sur-accent pour les lettres.
//
// Usage : node outils/icones.js

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

export const COTE = 512;
export const TAILLES = [180, 192, 512];
const SOUS_ECHANTILLONS = 4;

/** Les couleurs du thème clair, lues dans jetons.css. */
export function couleursDesJetons(css) {
  const clair = css.slice(css.indexOf(":root"), css.indexOf("@media (prefers-color-scheme: dark)"));
  const lire = (nom) => clair.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6});`))?.[1];
  return { fond: lire("accent"), lettres: lire("texte-sur-accent") };
}

// Un « A » : deux jambes et une barre, dans une boîte de largeur donnée.
function lettreA(gauche, largeur) {
  const [haut, bas, epaisseur] = [150, 362, 40];
  const milieu = gauche + largeur / 2;
  // La ligne médiane de chaque jambe, à la hauteur y.
  const jambeGauche = (y) => gauche + epaisseur / 2 + ((milieu - gauche - epaisseur / 2) * (bas - y)) / (bas - haut);
  const jambeDroite = (y) => 2 * milieu - jambeGauche(y);
  const [barreHaut, barreBas] = [276, 306];
  return [
    [[gauche, bas], [gauche + epaisseur, bas], [milieu + epaisseur / 2, haut], [milieu - epaisseur / 2, haut]],
    [[gauche + largeur - epaisseur, bas], [gauche + largeur, bas], [milieu + epaisseur / 2, haut], [milieu - epaisseur / 2, haut]],
    [[jambeGauche(barreHaut), barreHaut], [jambeDroite(barreHaut), barreHaut], [jambeDroite(barreBas), barreBas], [jambeGauche(barreBas), barreBas]],
  ];
}

// Tous les quadrilatères dans le même sens de parcours : superposés dans le
// SVG, ils s'additionnent au lieu de se creuser.
function orienter(quadrilatere) {
  let aire = 0;
  quadrilatere.forEach(([x1, y1], i) => {
    const [x2, y2] = quadrilatere[(i + 1) % quadrilatere.length];
    aire += x1 * y2 - x2 * y1;
  });
  return aire < 0 ? [...quadrilatere].reverse() : quadrilatere;
}

export const QUADRILATERES = [...lettreA(100, 180), ...lettreA(232, 180)].map(orienter);

function arrondi(nombre) {
  return Number(nombre.toFixed(2));
}

/** Le SVG de l'icône. */
export function svg({ fond, lettres }) {
  const chemin = QUADRILATERES.map((q) => `M${q.map(([x, y]) => `${arrondi(x)} ${arrondi(y)}`).join("L")}Z`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COTE} ${COTE}" role="img" aria-label="L'Atelier des Arpenteurs">` +
    `<rect width="${COTE}" height="${COTE}" fill="${fond}"/><path fill="${lettres}" d="${chemin}"/></svg>\n`
  );
}

function dedans([px, py], quadrilatere) {
  // Parcours dans le sens positif : le point est à gauche de chaque côté.
  for (let i = 0; i < quadrilatere.length; i += 1) {
    const [x1, y1] = quadrilatere[i];
    const [x2, y2] = quadrilatere[(i + 1) % quadrilatere.length];
    if ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < 0) return false;
  }
  return true;
}

const rvb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Les pixels RVB de l'icône à la taille donnée, ligne par ligne. */
export function pixels(taille, { fond, lettres }) {
  const [f, l] = [rvb(fond), rvb(lettres)];
  const echelle = COTE / taille;
  const n = SOUS_ECHANTILLONS;
  const boites = QUADRILATERES.map((q) => ({
    q,
    xmin: Math.min(...q.map((p) => p[0])),
    xmax: Math.max(...q.map((p) => p[0])),
    ymin: Math.min(...q.map((p) => p[1])),
    ymax: Math.max(...q.map((p) => p[1])),
  }));
  const sortie = new Uint8Array(taille * taille * 3);
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      let couverts = 0;
      for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < n; i += 1) {
          const point = [(x + (i + 0.5) / n) * echelle, (y + (j + 0.5) / n) * echelle];
          const touche = boites.some(
            (b) => point[0] >= b.xmin && point[0] <= b.xmax && point[1] >= b.ymin && point[1] <= b.ymax && dedans(point, b.q),
          );
          if (touche) couverts += 1;
        }
      }
      const part = couverts / (n * n);
      for (let c = 0; c < 3; c += 1) sortie[(y * taille + x) * 3 + c] = Math.round(f[c] + (l[c] - f[c]) * part);
    }
  }
  return sortie;
}

function morceau(type, donnees) {
  const tete = Buffer.alloc(8);
  tete.writeUInt32BE(donnees.length, 0);
  tete.write(type, 4, "latin1");
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])), 0);
  return Buffer.concat([tete, donnees, controle]);
}

/** Un PNG RVB 8 bits, sans transparence. */
export function png(taille, couleurs) {
  const brut = pixels(taille, couleurs);
  const lignes = Buffer.alloc(taille * (taille * 3 + 1));
  for (let y = 0; y < taille; y += 1) {
    lignes[y * (taille * 3 + 1)] = 0;
    Buffer.from(brut.subarray(y * taille * 3, (y + 1) * taille * 3)).copy(lignes, y * (taille * 3 + 1) + 1);
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", entete),
    morceau("IDAT", deflateSync(lignes, { level: 9 })),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const racine = new URL("../", import.meta.url);
  const couleurs = couleursDesJetons(readFileSync(new URL("css/jetons.css", racine), "utf8"));
  mkdirSync(new URL("icones/", racine), { recursive: true });
  writeFileSync(new URL("icones/icone.svg", racine), svg(couleurs));
  for (const taille of TAILLES) writeFileSync(new URL(`icones/icone-${taille}.png`, racine), png(taille, couleurs));
  console.log(`Icônes écrites dans ${fileURLToPath(new URL("icones/", racine))} : SVG, et PNG de ${TAILLES.join(", ")} pixels.`);
}
