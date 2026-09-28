// L'écran d'accueil (SPECIFICATION.md, § 9).
//
// La date de la banque publiée, ses comptes, un lien vers les anomalies
// s'il y en a ; l'aide pour ajouter l'Atelier à l'écran d'accueil d'un
// téléphone ; et, repliable en bas, le diagnostic : date et empreinte de la
// banque, durée de la dernière dérivation de clé, stockage durable, mode.
// Il sert à mesurer la dérivation sur un téléphone, et à aider un joueur à
// distance : un bouton le copie.

import { empreinteCourte } from "../banque/chargement.js";
import { dateLisible } from "../banque/dates.js";
import { adresseAnomalies, adresseListe } from "../routes.js";
import { compte, el, titre } from "./dom.js";

function aide() {
  return el(
    "section",
    { classe: "aide-ecran-accueil" },
    el("h2", {}, "Ajouter l'Atelier à l'écran d'accueil"),
    el(
      "ul",
      {},
      el("li", {}, "Sur iPhone, dans Safari : touchez Partager, puis « Sur l'écran d'accueil »."),
      el("li", {}, "Sur Android, dans Chrome : ouvrez le menu (les trois points), puis « Ajouter à l'écran d'accueil »."),
    ),
    el(
      "p",
      { classe: "secondaire-texte petit" },
      "L'Atelier s'ouvre alors comme une application. Sur iPhone, c'est aussi ce qui garde le mot de passe : Safari efface les données d'un site qu'on n'a pas ouvert depuis sept jours, sauf s'il est sur l'écran d'accueil.",
    ),
  );
}

function ligne(terme, valeur) {
  return [el("dt", {}, terme), el("dd", {}, valeur)];
}

async function diagnostic(contexte) {
  const { etat } = contexte;
  const enveloppe = etat.chargement?.enveloppe;
  const garde = await etat.coffre.lireCle(etat.mode);
  const derniere = etat.derivation ?? (garde ? { duree: garde.duree, le: garde.gardee_le } : null);
  const stockage = etat.stockage ?? contexte.stockageMemorise();
  let accorde = "inconnu";
  try {
    accorde = (await navigator.storage?.persisted?.()) ? "oui" : "non";
  } catch {
    // navigateur sans l'API : « inconnu »
  }
  const lignes = [
    ["Mode", etat.mode === "demo" ? "démonstration" : "réel"],
    [
      "Banque",
      enveloppe
        ? `publiée le ${dateLisible(enveloppe.publiee_le)}, empreinte ${empreinteCourte(enveloppe.empreinte)}`
        : etat.chargement?.absente
          ? "aucune banque publiée"
          : "non chargée",
    ],
    ["Dernière dérivation de clé", derniere ? `${derniere.duree} ms, le ${dateLisible(derniere.le)}` : "aucune sur cet appareil"],
    ["Stockage durable", `${stockage ? `demandé le ${dateLisible(stockage.le)} : ${stockage.resultat}` : "non demandé"} ; accordé aujourd'hui : ${accorde}`],
    ["Clé gardée sur cet appareil", garde ? `oui, depuis le ${dateLisible(garde.gardee_le)}` : "non"],
    ["Coffre", etat.coffre.durable ? "IndexedDB" : "en mémoire seulement (navigation privée ?)"],
    ["Navigateur", navigator.userAgent],
  ];
  const texte = lignes.map(([terme, valeur]) => `${terme} : ${valeur}`).join("\n");
  const retour = el("p", { classe: "petit", role: "status" });
  return el(
    "details",
    { classe: "repliable diagnostic" },
    el("summary", {}, "Diagnostic"),
    el("dl", {}, lignes.map(([terme, valeur]) => ligne(terme, valeur))),
    el(
      "div",
      { classe: "boutons" },
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(texte);
              retour.textContent = "Diagnostic copié : collez-le dans un message.";
            } catch {
              retour.textContent = "La copie a échoué : sélectionnez le texte à la main.";
            }
          },
        },
        "Copier le diagnostic",
      ),
    ),
    retour,
  );
}

// Le diagnostic se calcule à part : il lit le coffre et le navigateur.
function pied(contexte) {
  const zone = el("div", {});
  diagnostic(contexte).then((noeud) => zone.replaceChildren(noeud));
  return zone;
}

export function afficher(contexte) {
  const { etat } = contexte;
  const { banque } = etat;
  const erreurs = banque.anomalies.filter((a) => a.gravite === "erreur" || a.gravite === "bloquante").length;
  const carte = (categorie, singulier, pluriel) =>
    el(
      "li",
      {},
      el("a", { classe: "carte", href: adresseListe(categorie) }, el("span", { classe: "nombre" }, banque[categorie].length), banque[categorie].length > 1 ? pluriel : singulier),
    );
  return el(
    "section",
    {},
    titre("L'Atelier des Arpenteurs"),
    el("p", {}, `Banque publiée le ${dateLisible(banque.publiee_le)}.`),
    enAttente(contexte, banque.publiee_le),
    el("ul", { classe: "comptes" }, carte("blocs", "bloc", "blocs"), carte("capacites", "capacité", "capacités"), carte("elements", "élément", "éléments")),
    banque.anomalies.length
      ? el(
          "p",
          {},
          el(
            "a",
            { href: adresseAnomalies() },
            `${compte(banque.anomalies.length, "anomalie publiée", "anomalies publiées")} avec la banque, dont ${compte(erreurs, "erreur", "erreurs")}`,
          ),
          ".",
        )
      : null,
    el(
      "div",
      { classe: "boutons" },
      el("button", { type: "button", classe: "bouton secondaire", onclick: () => contexte.recharger() }, "Vérifier les mises à jour"),
      el("button", { type: "button", classe: "bouton secondaire", onclick: () => contexte.oublier() }, "Oublier le mot de passe sur cet appareil"),
    ),
    etat.nouvelles ? el("p", { classe: "message", role: "status" }, etat.nouvelles) : null,
    aide(),
    pied(contexte),
  );
}

// Une publication faite d'ici que GitHub Pages ne sert pas encore (§ 8.3).
function enAttente(contexte, publieeLe) {
  const derniere = contexte.dernierePublication();
  if (!derniere || (publieeLe && new Date(publieeLe) >= new Date(derniere.publiee_le))) return null;
  return el(
    "p",
    { classe: "message", role: "status" },
    `Votre publication du ${dateLisible(derniere.publiee_le)} n'est pas encore servie par GitHub Pages : elle le sera d'ici quelques minutes. Rechargez alors la page.`,
  );
}

export function afficherSansBanque(contexte) {
  return el(
    "section",
    {},
    titre("L'Atelier des Arpenteurs"),
    el("p", { classe: "message" }, "Aucune banque publiée pour l'instant."),
    enAttente(contexte, null),
    contexte.etat.mode === "reel"
      ? el("p", { classe: "secondaire-texte" }, "Pour essayer l'Atelier sur des données fictives : ", el("a", { href: "?demo=1" }, "ouvrir la démonstration"), ".")
      : null,
    aide(),
    pied(contexte),
  );
}

export function afficherErreur(contexte, message) {
  return el(
    "section",
    {},
    titre("L'Atelier des Arpenteurs"),
    el("p", { classe: "message", role: "alert" }, message),
    el("div", { classe: "boutons" }, el("button", { type: "button", classe: "bouton", onclick: () => contexte.recharger() }, "Réessayer")),
    pied(contexte),
  );
}
