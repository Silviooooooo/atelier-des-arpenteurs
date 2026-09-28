// La veille du chargement (SPECIFICATION.md, § 9).
//
// GitHub Pages sert chaque fichier avec max-age=600 : pendant une dizaine de
// minutes après une mise à jour du site, un navigateur peut garder d'anciens
// modules, qu'un module neuf ne sait pas lier, et la page resterait sur
// « Chargement ». Ce script classique, sans import, vit hors du graphe des
// modules : il tourne même quand ce graphe ne se lie pas. Au bout de
// 15 secondes, si l'écran montre encore un chargement (data-chargement), il
// le remplace par un message et un bouton « Recharger ». Il fabrique ses
// éléments lui-même, sans insérer de HTML (§ 10.1).

"use strict";

{
  const DELAI = 15_000;

  setTimeout(() => {
    const ecran = document.getElementById("ecran");
    if (!ecran?.querySelector("[data-chargement]")) return;
    const message = document.createElement("p");
    message.className = "message";
    message.setAttribute("role", "alert");
    message.append("Mise à jour en cours : rechargez dans quelques minutes.");
    const bouton = document.createElement("button");
    bouton.setAttribute("type", "button");
    bouton.className = "bouton";
    bouton.append("Recharger");
    bouton.addEventListener("click", () => location.reload());
    const boutons = document.createElement("div");
    boutons.className = "boutons";
    boutons.append(bouton);
    ecran.replaceChildren(message, boutons);
  }, DELAI);
}
