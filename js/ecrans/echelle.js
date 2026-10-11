// L'échelle d'un papier à l'écran (SPECIFICATION.md, § 10.1, § 15.5 et
// § 16.6).
//
// La fiche d'un personnage et la carte d'un adversaire sont du papier, à
// leurs dimensions : sur un écran plus étroit qu'elles, elles se réduisent
// à sa largeur, et le zoom à deux doigts les agrandit. L'échelle est un
// nombre, posé en propriété CSS (--echelle), que la feuille de style lit
// (zoom). C'est la seule écriture de style du code, et elle vit ici : un
// contrôle vérifie qu'aucun autre module de js/ n'en fait.

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
