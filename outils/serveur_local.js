// Serveur local, pour essayer le site sur le poste avant de l'envoyer
// (SPECIFICATION.md, § 3.2).
//
// Les modules JavaScript ne se chargent pas depuis un fichier ouvert
// directement (file://) : il faut un serveur. Celui-ci sert les fichiers du
// dépôt comme GitHub Pages, sans dépendance, en lecture seule, et à la seule
// machine (127.0.0.1). WebCrypto y fonctionne : localhost compte comme sûr.
//
// Usage : node outils/serveur_local.js [port], puis ouvrir
// http://localhost:8080/ ou http://localhost:8080/?demo=1

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const PORT = Number(process.argv[2] ?? 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

createServer(async (requete, reponse) => {
  let chemin;
  try {
    chemin = decodeURIComponent(new URL(requete.url, "http://localhost").pathname);
  } catch {
    reponse.writeHead(400).end();
    return;
  }
  let fichier = normalize(join(RACINE, chemin.endsWith("/") ? `${chemin}index.html` : chemin));
  if (!fichier.startsWith(RACINE.endsWith(sep) ? RACINE : RACINE + sep)) {
    reponse.writeHead(403).end();
    return;
  }
  try {
    const contenu = await readFile(fichier);
    reponse.writeHead(200, { "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    reponse.end(contenu);
  } catch {
    reponse.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Introuvable");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`L'Atelier est servi à http://localhost:${PORT}/ (démonstration : ?demo=1).`));
