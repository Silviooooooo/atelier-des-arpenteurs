// Le thème au premier affichage (SPECIFICATION.md, § 9 et § 10.1).
//
// La page Apparence garde le thème choisi dans localStorage, clé
// « atelier.theme », en valeur brute (« taverne », sans JSON). Ce script la
// relit à l'ouverture de la page et, si c'est un code de sa table, pose
// data-theme="<code>" sur <html> (css/themes.css fait le reste) et écrit le
// fond du thème dans les deux balises <meta name="theme-color">, la couleur
// de la barre du navigateur. Une valeur absente, inconnue ou illisible ne
// change rien : la page reste en « Atelier », qui suit le réglage de
// l'appareil. « Atelier » n'est jamais gardé (la page Apparence retire la
// clé) : ni atelier-clair ni atelier-sombre ne sont dans la table.
//
// Pourquoi un script classique : un module ne s'exécute qu'une fois la page
// lue, quand elle a pu se dessiner en « Atelier » puis changer de couleurs
// sous les yeux. Un script classique, sans defer ni async, arrête la lecture
// du <head> le temps de s'exécuter : l'attribut est posé avant le premier
// dessin. Il vit dans un fichier, car la politique de sécurité n'admet aucun
// script en ligne (§ 10.1), et hors du graphe des modules, comme js/veille.js :
// il n'importe rien, et sa table recopie le fond des trente-six thèmes de
// js/apparence/themes.js, que tests/theme_initial.test.js lui compare.
//
// Sa place, dans index.html : juste avant la feuille css/jetons.css, donc
// après la politique de sécurité, qui précède tout script, et après les deux
// balises theme-color, qu'il doit trouver déjà lues. Tout tient dans un
// bloc : aucun nom ne fuit dans la page.

"use strict";

{
  const CLE = "atelier.theme";

  // Le fond de chaque thème qui s'applique par data-theme, dans l'ordre du
  // catalogue.
  const FONDS = new Map([
    ["taverne", "#1d1611"], ["sylve", "#0f1d16"], ["forge", "#1a1918"], ["tenebres", "#0d0a0b"],
    ["heraldique", "#f8f4e9"], ["sables", "#f7eddb"], ["givre", "#111920"], ["cathedrale", "#14161c"],
    ["grand-cru", "#faf6f0"], ["velours", "#1f0d12"], ["ardoise", "#16181c"], ["neon", "#0d0b1f"],
    ["epure", "#ffffff"], ["contraste", "#ffffff"], ["daltonisme", "#fbfbfa"], ["abrasia", "#f5efe1"],
    ["enluminure", "#faf3e4"], ["constellations", "#0b1027"], ["compagnie", "#ece0c4"], ["bivouac", "#1c1814"],
    ["abysses", "#04161f"], ["bastion", "#15181f"], ["clans", "#1a1410"], ["quete", "#efe3c6"],
    ["faille", "#010a13"], ["laiton", "#f6efe2"], ["arcade", "#fffdf3"], ["belle-epoque", "#f7f1e5"],
    ["clair-obscur", "#0c0b0a"], ["ascension", "#1b1033"], ["gueule-de-bois", "#141a1a"], ["huile", "#ece6d8"],
    ["cendres", "#1e1715"], ["mycelium", "#161021"], ["carte-aventure", "#efe6cc"], ["necropole", "#111214"],
  ]);

  let code = null;
  try {
    code = localStorage.getItem(CLE);
  } catch {
    // Un stockage refusé (navigation privée, réglage du navigateur) lève
    // dès sa lecture : la page reste en « Atelier ».
  }
  const fond = FONDS.get(code);
  if (fond !== undefined) {
    document.documentElement.setAttribute("data-theme", code);
    for (const teinte of document.querySelectorAll('meta[name="theme-color"]')) teinte.setAttribute("content", fond);
  }
}
