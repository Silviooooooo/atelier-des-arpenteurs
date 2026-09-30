// Le démarrage et les routes de la page (SPECIFICATION.md, § 3.2, § 8.3,
// § 9 et § 15).
//
// Lit le mode (démonstration avec ?demo=1), ouvre le coffre, télécharge la
// banque et l'ouvre avec la clé gardée, sinon demande le mot de passe ; puis
// affiche l'écran que désigne l'adresse après le « # ». L'espace auteur
// s'ouvre sans la banque : la première publication se fait avant qu'elle
// existe. Les écrans des personnages ont besoin de la banque : un lien reçu
// (#/recevoir/…) attend donc le mot de passe, puis s'ouvre. Une erreur
// inattendue s'affiche, jamais une page blanche.

import { demanderStockageDurable, modeDe, ouvrirAvecCoffre, ouvrirParMotDePasse, telecharger } from "./banque/chargement.js";
import { indexer } from "./banque/consultation.js";
import { dateLisible } from "./banque/dates.js";
import * as accueil from "./ecrans/accueil.js";
import * as anomalies from "./ecrans/anomalies.js";
import * as creation from "./ecrans/creation.js";
import { el, titre } from "./ecrans/dom.js";
import * as espaceAuteur from "./ecrans/espace_auteur.js";
import * as fichePersonnage from "./ecrans/fiche_personnage.js";
import * as liste from "./ecrans/liste.js";
import * as motDePasse from "./ecrans/mot_de_passe.js";
import * as personnages from "./ecrans/personnages.js";
import * as reception from "./ecrans/reception.js";
import { ouvrirEtagere } from "./personnage/stockage.js";
import { lireRoute } from "./routes.js";
import { ouvrirCoffre } from "./securite/coffre.js";

// Petits souvenirs de l'appareil, qui ne sont pas des secrets : la réponse
// à la demande de stockage durable, la dernière publication faite d'ici.
// Le navigateur peut les refuser (navigation privée) : rien n'en dépend.
function lireMemoire(cle) {
  try {
    return JSON.parse(localStorage.getItem(`atelier.${cle}`));
  } catch {
    return null;
  }
}

function ecrireMemoire(cle, valeur) {
  try {
    localStorage.setItem(`atelier.${cle}`, JSON.stringify(valeur));
  } catch {
    // stockage refusé : le souvenir se perd, sans autre effet
  }
}

const etat = {
  mode: modeDe(location.search),
  coffre: null,
  chargement: null, // { enveloppe }, { absente: true } ou { erreur }
  banque: null,
  index: null,
  secret: null, // le secret de table en mémoire : sa seule copie hors du coffre
  garder: null, // le choix « Se souvenir sur cet appareil » de la dernière saisie
  motDePasse: null, // « requis » ou « change » quand la banque attend le mot de passe
  derivation: null, // { duree, le } : la dernière dérivation de cette visite
  stockage: null, // { resultat, le } : la demande de stockage durable
  nouvelles: null, // un message après « Vérifier les mises à jour »
  etagere: null, // les personnages de l'appareil, pour ce mode (§ 15.1)
};

function installer(banque, secret) {
  etat.banque = banque;
  etat.index = indexer(banque);
  etat.secret = secret ?? etat.secret;
  etat.motDePasse = null;
}

async function charger(telecharge = null) {
  etat.chargement = telecharge ?? (await telecharger(etat.mode));
  Object.assign(etat, { banque: null, index: null, motDePasse: null });
  if (!etat.chargement.enveloppe) return;
  const ouverte = await ouvrirAvecCoffre(etat.chargement.enveloppe, etat.coffre, etat.mode);
  if (ouverte.banque) installer(ouverte.banque, ouverte.secret);
  else if (ouverte.motDePasse) etat.motDePasse = ouverte.motDePasse;
  else etat.chargement = { erreur: ouverte.erreur };
}

const contexte = {
  etat,
  afficher: () => afficher(),
  naviguer(adresse) {
    if (location.hash === adresse) afficher();
    else location.hash = adresse;
  },

  async deverrouiller(motDePasseSaisi, garder) {
    const resultat = await ouvrirParMotDePasse(etat.chargement.enveloppe, motDePasseSaisi, { coffre: etat.coffre, mode: etat.mode, garder });
    const duree = resultat.secret?.duree ?? resultat.duree;
    if (duree !== undefined) etat.derivation = { duree, le: new Date().toISOString() };
    if (resultat.erreur) return resultat;
    etat.garder = garder;
    installer(resultat.banque, resultat.secret);
    // Après chaque saisie réussie : que le navigateur n'efface pas la clé.
    // Firefox demande l'accord de la personne, et la réponse peut ne jamais
    // venir : l'Atelier s'ouvre sans l'attendre, le diagnostic la note après.
    etat.stockage = { resultat: "réponse en attente", le: new Date().toISOString() };
    demanderStockageDurable().then((resultat) => {
      etat.stockage = { resultat, le: new Date().toISOString() };
      ecrireMemoire("stockage", etat.stockage);
    });
    return resultat;
  },

  async oublier() {
    await etat.coffre.oublierCle(etat.mode);
    // L'espace auteur ne garde aucune copie : son circuit en cours s'annule.
    espaceAuteur.oublier();
    Object.assign(etat, { banque: null, index: null, secret: null, nouvelles: null, motDePasse: etat.chargement?.enveloppe ? "requis" : null });
    afficher();
  },

  // Compare l'empreinte téléchargée à celle de la banque ouverte (§ 8.3).
  async recharger() {
    const ouverte = etat.chargement?.enveloppe;
    const telecharge = await telecharger(etat.mode);
    const recue = telecharge.enveloppe;
    const derniere = contexte.dernierePublication();
    const enRetard = telecharge.absente || (recue && derniere && new Date(recue.publiee_le) < new Date(derniere.publiee_le));
    if (recue && ouverte && recue.empreinte === ouverte.empreinte) {
      etat.nouvelles = "La banque est à jour.";
    } else if (derniere && ouverte?.empreinte === derniere.empreinte && enRetard) {
      // GitHub Pages sert encore l'ancien fichier : on garde la banque publiée d'ici.
      etat.nouvelles = `Votre publication du ${dateLisible(derniere.publiee_le)} n'est pas encore servie par GitHub Pages : elle le sera d'ici quelques minutes.`;
    } else {
      await charger(telecharge);
      etat.nouvelles = etat.banque ? "Nouvelle banque chargée." : null;
    }
    afficher();
  },

  // Après une publication depuis cet appareil : la nouvelle banque s'ouvre
  // tout de suite, sans attendre GitHub Pages.
  publiee(preparation, secret) {
    etat.chargement = { enveloppe: preparation.enveloppe };
    installer(preparation.banque, secret);
    ecrireMemoire(`publication.${etat.mode}`, { empreinte: preparation.enveloppe.empreinte, publiee_le: preparation.enveloppe.publiee_le });
  },

  stockageMemorise: () => lireMemoire("stockage"),

  // La dernière publication faite depuis cet appareil : { empreinte, publiee_le }.
  dernierePublication: () => lireMemoire(`publication.${etat.mode}`),
};

const ECRANS_PERSONNAGE = ["personnages", "personnage", "creation", "recevoir"];

function marquerNavigation(route) {
  const active = ECRANS_PERSONNAGE.includes(route.ecran) ? "personnages" : (route.categorie ?? route.ecran);
  for (const lien of document.querySelectorAll(".navigation a[data-route]")) {
    if (lien.dataset.route === active) lien.setAttribute("aria-current", "page");
    else lien.removeAttribute("aria-current");
  }
}

function ecran(route) {
  if (route.ecran === "auteur") return espaceAuteur.afficher(contexte);
  if (!etat.chargement) return el("p", { classe: "attente", role: "status", "data-chargement": true }, "Chargement de la banque…");
  if (etat.chargement.absente) return accueil.afficherSansBanque(contexte);
  if (etat.chargement.erreur) return accueil.afficherErreur(contexte, etat.chargement.erreur);
  if (!etat.banque) return motDePasse.afficher(contexte);
  if (route.ecran === "accueil") return accueil.afficher(contexte);
  if (route.ecran === "liste" || route.ecran === "fiche") return liste.afficher(contexte, route);
  if (route.ecran === "anomalies") return anomalies.afficher(contexte, route);
  if (route.ecran === "personnages") return personnages.afficher(contexte);
  if (route.ecran === "personnage") return fichePersonnage.afficher(contexte, route);
  if (route.ecran === "creation") return creation.afficher(contexte, route);
  if (route.ecran === "recevoir") return reception.afficher(contexte, route);
  return el("section", {}, titre("Page introuvable"), el("p", {}, "Cette adresse ne mène à aucun écran de l'Atelier."), el("p", {}, el("a", { href: "#/" }, "Retour à l'accueil")));
}

let adressePrecedente = null;

function afficher() {
  const principal = document.getElementById("ecran");
  const route = lireRoute(location.hash);
  const nouvelle = location.hash !== adressePrecedente;
  adressePrecedente = location.hash;
  if (nouvelle) etat.nouvelles = null;
  marquerNavigation(route);
  try {
    principal.replaceChildren(ecran(route));
  } catch (erreur) {
    principal.replaceChildren(el("p", { classe: "message", role: "alert" }, `Cet écran n'a pas pu s'afficher : ${erreur.message}`));
    console.error(erreur);
  }
  const surlignee = principal.querySelector(".surlignee");
  if (surlignee) surlignee.scrollIntoView({ block: "center" });
  else if (nouvelle) {
    window.scrollTo(0, 0);
    (principal.querySelector(".panneau-fiche h1") ?? principal.querySelector("h1"))?.focus({ preventScroll: true });
  }
}

async function demarrer() {
  document.getElementById("bandeau-demo").hidden = etat.mode !== "demo";
  etat.coffre = await ouvrirCoffre();
  etat.etagere = await ouvrirEtagere(etat.mode);
  addEventListener("hashchange", afficher);
  afficher();
  await charger();
  afficher();
}

demarrer().catch((erreur) => {
  document.getElementById("ecran").replaceChildren(el("p", { classe: "message", role: "alert" }, `L'Atelier n'a pas pu démarrer : ${erreur.message}`));
  console.error(erreur);
});
