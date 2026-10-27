// Contrôles de la bulle d'options du simulateur de combat, de son onglet et
// de ses infobulles (SPECIFICATION.md, § 17 et § 11, domaine « Combat » ;
// contrat du lot 4, groupe 2, § 8.1, § 8.2, § 9.3 à § 9.5, § 9.7, § 9.11 et
// § 14 É2) : js/ecrans/combat_bulle.js, dans le document simulé, sur des vues
// écrites à la main dans les formes du contrat (celles de
// combat_ecran_action.test.js), avec le contenu que fabrique
// combat_action.js.
//
// L'écran n'est pas là : un banc tient sa place (monter). Il fait ce que le
// contrat lui demande (§ 9.10) : il rend la bulle, la replace puis la
// focalise à une ouverture, et se refait pendant executer quand le contrôle
// lui donne la vue qui suit. La place se lit dans les propriétés que le
// document simulé relève ; la fenêtre fait 1 280 × 800 px. Chaque règle est
// vue des deux côtés : la bulle montrée et cachée, le geste qui ferme et
// celui qui réduit, le placement qui vient et celui qui ne vient pas. Les
// nœuds se comparent par identité (memeNoeud), pour qu'un contrôle déçu se
// dise tout de suite, en une ligne (relecture du groupe 2, C-07).

import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutons, installerDom, texteDe } from "./outils/dom_simule.js";
import { FLECHE } from "../js/ecrans/echelle.js";
import { composerGeste, composerListe } from "../js/ecrans/combat_action.js";

const { creer, creerInfobulles } = await import("../js/ecrans/combat_bulle.js");

// ——— L'outillage ———

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const leBouton = (noeud, debut) => {
  const trouves = boutons(noeud, debut);
  assert.equal(trouves.length, 1, `un seul bouton « ${debut} », trouvé ${trouves.length}`);
  return trouves[0];
};
const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });
const capacite = (rang, facon) => ({ evenement: { type: "capacite", qui: "pj1", capacite: rang, facon } });
/** Un nœud dit par sa balise et ses classes. */
const forme = (n) => `${n.tagName.toLowerCase()}.${n.className}`;
/** Le bouton d'une ligne, par sa clé. */
const laLigne = (lieu, cle) => {
  const trouvees = tous(lieu, "button.combat-capacite").filter((b) => b.getAttribute("data-ligne") === cle);
  assert.equal(trouvees.length, 1, `une seule ligne « ${cle} », trouvé ${trouvees.length}`);
  return trouvees[0];
};
/** Un appui : du doigt (« touch ») ou de la souris (« mouse »), noté au pointerdown, puis le clic. */
const appuyer = (noeud, pointerType) => {
  noeud.declencher("pointerdown", { pointerType });
  noeud.click();
};
/** L'infobulle d'un déclencheur, par son aria-describedby. */
const infobulleDe = (lieu, declencheur) => {
  const id = (declencheur.getAttribute("aria-describedby") ?? "").split(" ").find((nom) => nom.startsWith("combat-info-"));
  return id ? lieu.querySelector(`#${id}`) : null;
};
/** Les trois propriétés de place d'un nœud. */
const proprietes = (noeud) => Object.fromEntries(["--bulle-gauche", "--bulle-haut", "--bulle-fleche", "--bulle-hauteur"].map((nom) => [nom, noeud.style.getPropertyValue(nom)]));
const dernierFocus = () => globalThis.document.focalisations.at(-1);
const classesDe = (noeud) => noeud.className.split(/\s+/);
/**
 * Deux nœuds identiques, deux listes des mêmes nœuds, ou un nœud qui a
 * changé. Un assert.equal raté entre deux nœuds déroule toute la page dans
 * son message, puis compare ligne à ligne ce qu'il a déroulé : sur l'écran
 * du combat, de quinze secondes à plus d'une minute, et des Go (relecture du
 * groupe 2, C-07). Ici, l'échec se dit tout de suite, en une ligne.
 */
const decrire = (n) => (n === null || n === undefined ? String(n) : typeof n.tagName === "string" ? `${forme(n)} « ${texteDe(n).slice(0, 60)} »` : JSON.stringify(String(n.textContent ?? n)));
function memeNoeud(vu, attendu, quoi = "le nœud") {
  if (vu !== attendu) assert.fail(`${quoi} : ${decrire(vu)} au lieu de ${decrire(attendu)}`);
}
function memesNoeuds(vus, attendus, quoi = "les nœuds") {
  const liste = [...vus];
  if (liste.length !== attendus.length || liste.some((n, rang) => n !== attendus[rang])) assert.fail(`${quoi} : [${liste.map(decrire).join(", ")}] au lieu de [${attendus.map(decrire).join(", ")}]`);
}
function autreNoeud(vu, ancien, quoi = "le nœud") {
  if (vu === ancien) assert.fail(`${quoi} : toujours ${decrire(vu)}`);
}
const FERMER = String.fromCodePoint(0x2715);
const REDUIRE = String.fromCodePoint(0x2013);

// ——— Les vues, écrites à la main dans les formes du contrat (§ 8.1, § 8.2) ———

// Avec les clés neuves de la vague 3 (contrat, § 3.2) : camp, etape, fil, consigne.
const PANNEAU_VIDE = { candidats: [], nom: null, entete: null, defenseur: null, fermeture: null, etapes: [], groupes: [], passer: null, passifs: [], geste: null, vainqueur: null, focus: null, camp: null, etape: null, fil: [], consigne: null };

/** Le fil d'une attaque au téléphone (contrat, § 3.2), à son étape en cours. */
const filDeLAttaque = (etape) =>
  ["Capacité", "Cible", "Dés", "Zone et dégâts"].map((nom, rang) => ({ nom, etape: rang, etat: rang < etape ? "faite" : rang === etape ? "en_cours" : "a_venir" }));

const survolDe = (titre, champs = {}) => ({ titre, origine: null, description: "", portee: null, causes: [], cout: "Coût : 1 action, aucun souffle", hachures: [], ...champs });

const SOLO = { texte: "Solo du chef [1] : aucun allié de son camp sur sa case (A1) ; 1 avantage.", citation: "« Seul sur sa case : 1 avantage. »", sens: "avantage" };

const ligneVue = (champs = {}) => ({
  cle: "0:0",
  libelle: "Frappe",
  degats: "3/8/20",
  desavantage: false,
  intervention: false,
  cout: "gratuit",
  choisi: false,
  actif: true,
  raison: null,
  commande: capacite(0, 0),
  jouer: "Jouer Frappe",
  survol: survolDe("Frappe", {
    origine: "Couteau d'office",
    description: "Une attaque qui inflige 3/8/20.",
    portee: "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte.",
    causes: [SOLO],
    hachures: ["A1", "A2", "B1", "B2"],
  }),
  ...champs,
});

const LIGNES = {
  frappe: ligneVue(),
  emincer: ligneVue({ cle: "1:0", libelle: "Émincer", desavantage: true, cout: "5 souffle", commande: capacite(1, 0), jouer: "Jouer Émincer", survol: survolDe("Émincer", { origine: "Couteau d'office", cout: "Coût : 1 action, 5 souffle", hachures: ["A1", "B2"] }) }),
  fournaise1: ligneVue({ cle: "4:0", libelle: "Fournaise [1]", degats: null, cout: "1 souffle, 1 lien", commande: capacite(4, 0), jouer: "Jouer Fournaise [1]", survol: survolDe("Fournaise", { origine: "Saucier", portee: "Cible au choix, sans condition de portée", cout: "Coût : 1 action, 1 souffle, 1 lien" }) }),
  fournaise2: ligneVue({ cle: "4:1", libelle: "Fournaise [2]", degats: null, cout: "2 souffle, 1 lien", actif: false, raison: "il manque du souffle (2)", commande: capacite(4, 1), jouer: "Jouer Fournaise [2]", survol: survolDe("Fournaise", { origine: "Saucier", cout: "Coût : 1 action, 2 souffle, 1 lien" }) }),
  pas1: ligneVue({ cle: "9:0", libelle: "Pas chassé [1]", degats: "1 case", commande: capacite(9, 0), jouer: "Jouer Pas chassé [1]", survol: survolDe("Pas chassé", { origine: "Gestes de cuisine", portee: "Arrivée : les cases à une distance de 1 à 1, hachurées sur la carte.", hachures: ["A2", "B1", "B2"] }) }),
  taloche: ligneVue({ cle: "15:0", libelle: "Taloche [1]", degats: "2/4/8", commande: capacite(15, 0), jouer: "Jouer Taloche [1]", survol: survolDe("Taloche", { origine: "Gestes de cuisine", portee: "Portée 0 : sa case seule, hachurée sur la carte.", hachures: ["A1"] }) }),
};
const CLES = ["0:0", "1:0", "4:0", "4:1", "9:0", "15:0"];

const PASSIFS = [
  { cle: "passif:3", libelle: "Réduction [1]", survol: survolDe("Réduction", { origine: "Saucier", description: "Retire 1 point d'armure par réussite.", cout: "Passif : ne se joue pas" }) },
  { cle: "passif:10", libelle: "Vif [1]", survol: survolDe("Vif", { origine: "Marmiton", description: "Ajoutez 1 aux jets d'agilité.", cout: "Passif : ne se joue pas" }) },
];

// « Passer son tour » : toujours là quand quelqu'un agit ; la bulle y lit qui joue.
const passerDe = (qui, actif = true) => ({ actif, raison: actif ? null : "Une action est en cours.", commande: { evenement: { type: "passer", qui } } });

/** La bulle sans geste (vue 1) : la liste d'Aubépine. */
const vueListe = (champs = {}) => ({
  genre: "action",
  candidats: [],
  nom: "Aubépine Crèmebrûlée : ses actions",
  entete: { titre: "Aubépine Crèmebrûlée", sous: "actions restantes : 2 sur 2 · souffle 10/10" },
  defenseur: null,
  fermeture: { genre: "fermer", libelle: "Fermer", commande: { choisir: null } },
  etapes: [],
  groupes: [
    { titre: "Couteau d'office (précise)", lignes: [LIGNES.frappe, LIGNES.emincer] },
    { titre: "Saucier", lignes: [LIGNES.fournaise1, LIGNES.fournaise2] },
    { titre: "Gestes de cuisine", lignes: [LIGNES.pas1, LIGNES.taloche] },
  ],
  passer: passerDe("pj1"),
  passifs: PASSIFS,
  geste: null,
  annonce: null,
  vainqueur: null,
  focus: "ligne:0:0",
  camp: "pj",
  etape: 0,
  fil: filDeLAttaque(0),
  consigne: "Que fait Aubépine ?",
  ...champs,
});

/** La liste d'un autre protagoniste : le Chef de partie. */
const vueDuChef = (champs = {}) =>
  vueListe({
    nom: "Chef de partie : ses actions",
    entete: { titre: "Chef de partie", sous: "actions restantes : 2 sur 2 · souffle 7/7" },
    groupes: [{ titre: "Frappe", lignes: [ligneVue({ commande: { evenement: { type: "capacite", qui: "adv2", capacite: 0, facon: 0 } } })] }],
    passer: passerDe("adv2"),
    passifs: [],
    ...champs,
  });

const CONTEXTE_NU = { de: null, detail: null, modificateurs: [], difficulte: null, causes: null, defense: null, reglages: null };
const CAUSES = { nombre: "1 avantage", nom: "1 avantage : voir la cause", phrases: [{ ...SOLO, texte: "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage." }], compte: null };
// Les réglages à la main : le Mode MJ seul les montre (contrat de la vague 3, § 3.2, D11).
const REGLAGES = {
  modificateur: { valeur: 0, raison: null, min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "modificateur" } } },
  avantages: { valeur: 1, raison: "Nez fin", min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "avantages" } } },
  mj: true,
};
const CIBLE = { id: "adv4", libelle: "Marmiton de corvée n° 2", choisie: true, actif: true, raison: null, commande: regler("cible", "adv4") };

/** Le geste de la vue 2 bis : Aubépine, Taloche contre le Marmiton n° 2. */
const gesteVu = (champs = {}) => ({
  description: "Une taloche qui inflige 2/4/8.",
  jetPrete: null,
  armes: null,
  cibles: [CIBLE],
  sansCible: null,
  cases: null,
  caracteristiques: null,
  difficultes: null,
  x: null,
  jauges: null,
  contexte: { de: "d8", detail: "Force 4 + Agilité 5", modificateurs: ["+1 (Vif)"], difficulte: "5, sa défense", causes: CAUSES, defense: null, reglages: null },
  chaine: [
    { titre: "1er dé", etat: "reussi", valeur: 9, detail: "8 + 1" },
    { titre: "2e dé", etat: "echoue", valeur: 4, detail: "3 + 1" },
    { titre: "3e dé", etat: "a_venir", de: "d8" },
  ],
  aLancer: null,
  bilan: "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.",
  lettres: [{ texte: "1 réussite : 2", atteinte: true }, { texte: "2 : 4" }, { texte: "3 : 8" }],
  choix: [
    { cle: "relancer", libelle: "Relancer le 2e dé", commande: { evenement: { type: "relancer" } } },
    { cle: "garder", libelle: "Garder ce dé", commande: { evenement: { type: "garder" } } },
  ],
  degats: null,
  localisation: null,
  esquive: null,
  detail: null,
  appliquer: null,
  confirmer: null,
  revenir: null,
  // Les clés de la vague 3 (contrat, § 3.2).
  bilanAuDoigt: "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.",
  avis: null,
  ciblesDetail: [],
  jetsParCible: null,
  progression: null,
  dernierDe: 1,
  passifs: [],
  appliquerEffet: null,
  palette: { libelle: "Palette", source: { genre: "capacite", qui: "pj1", capacite: 15 }, mj: true },
  interventions: null,
  aucuneIntervention: null,
  contre: null,
  critique: null,
  ...champs,
});

/** La bulle avec un geste payé (vue 2 bis) : après le premier dé, elle se réduit. */
const vueJet = (champs = {}) => ({
  genre: "action",
  candidats: [],
  nom: "Aubépine Crèmebrûlée : ses actions",
  entete: { titre: "Taloche [1] contre Marmiton de corvée n° 2", sous: "Aubépine · dernière action · souffle 6/10" },
  defenseur: null,
  fermeture: { genre: "reduire", libelle: "Réduire", onglet: "Taloche [1] : rouvrir" },
  etapes: [
    { nom: "Capacité", etat: "faite" },
    { nom: "Cible", etat: "faite" },
    { nom: "Jet d'attaque", etat: "en_cours" },
  ],
  groupes: [],
  passer: passerDe("pj1", false),
  passifs: [],
  geste: gesteVu(),
  annonce: { pas: 12, texte: "2e dé : 4, échec. Relancer ou garder ?" },
  vainqueur: null,
  focus: "choix:relancer",
  camp: "pj",
  etape: 2,
  fil: filDeLAttaque(2),
  consigne: null,
  ...champs,
});

/** Un geste non payé (avant le premier dé) : fermer vaut « Revenir ». */
const vueAvantLeDe = (champs = {}) =>
  vueJet({ fermeture: { genre: "fermer", libelle: "Fermer", commande: { choisir: null } }, geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [] }), annonce: null, focus: null, ...champs });

const QUI_JOUE = {
  genre: "qui_joue",
  ...PANNEAU_VIDE,
  candidats: [
    { id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } },
    { id: "pj5", nom: "Aubépine Fleurdesel", commande: { choisir: "pj5" } },
  ],
  annonce: null,
  focus: "candidat:pj1",
  camp: "pj",
  etape: 0,
};
const PREPARATION = { genre: "preparation", ...PANNEAU_VIDE, annonce: null };
const TERMINE = { genre: "termine", ...PANNEAU_VIDE, annonce: null };
/** Ce que la barre donne au volet au repos (contrat, § 4.2) : « Annuler le dernier geste » et « Fin de tour ». */
const REPOS = {
  annuler: { libelle: "Annuler le dernier geste", actif: true, raison: null, commande: { evenement: { type: "annuler" } }, question: { texte: "Annuler ?", confirmer: "Annuler", garder: "Garder" } },
  finDeTour: { actif: true, raison: null, commande: { evenement: { type: "fin_de_tour" } } },
};

// ——— Le banc : la bulle dans le cadre, et l'écran qui la mène ———

// Les boîtes prêtées : le cadre (le repère), la case active (l'ancre), la
// bulle (20rem de large), l'onglet. La fenêtre : 1 280 × 800.
const CADRE = { left: 20, top: 10, width: 1240, height: 780 };
const CASE = { left: 100, top: 100, width: 48, height: 48 };
const BULLE = { left: 204, top: 64, width: 320, height: 400 };
const ONGLET = { left: 0, top: 0, width: 160, height: 44 };
const FENETRE = { largeur: 1280, hauteur: 800 };

/**
 * La bulle, posée dans le cadre de la page, menée comme le fait l'écran :
 * afficher(vue, champs) la rend avec un écran (etroit, caseOuverte,
 * origineDeLaCible…), puis, à une ouverture, la replace et la focalise ;
 * executer relève la commande, puis rend la vue que banc.ensuite(commande)
 * donne (rien : la séance a refusé, l'écran ne redessine pas). Relève les
 * hachures, les focus au jeton et au « +k », les fermetures de la liste
 * d'une case, les écrans refaits ; tient les écouteurs de la fenêtre. Comme
 * l'écran sur sa racine, il retient sur le cadre le genre du dernier appui
 * (pointerdown, keydown), que la bulle lit (dernierAppui) ; le jeton de qui
 * joue est dans la case active. focusFidele : le document simulé déclenche
 * blur et focus à chaque focus().
 */
function monter({ etroit = false, espion = false, focusFidele = false, modeMj = false } = {}) {
  const retirerDom = installerDom({ focusFidele });
  const avant = { add: globalThis.addEventListener, remove: globalThis.removeEventListener };
  const ecoutes = [];
  globalThis.addEventListener = (type, f) => ecoutes.push([type, f]);
  globalThis.removeEventListener = (type, f) => {
    const i = ecoutes.findIndex(([t, g]) => t === type && g === f);
    if (i >= 0) ecoutes.splice(i, 1);
  };
  const banc = { ensuite: null, appels: [], hachures: [], jetons: [], cases: [], rafraichis: [], ecoutes, contextes: [], appui: null };
  const cadre = globalThis.document.createElement("div");
  cadre.className = "combat-cadre";
  cadre.rectangle = { ...CADRE };
  cadre.addEventListener("pointerdown", (evenement) => {
    banc.appui = evenement.pointerType || null;
  });
  cadre.addEventListener("keydown", () => {
    banc.appui = "clavier";
  });
  const caseActive = globalThis.document.createElement("div");
  caseActive.className = "combat-case";
  caseActive.rectangle = { ...CASE };
  const jeton = globalThis.document.createElement("button");
  jeton.className = "combat-jeton";
  caseActive.append(jeton);
  let champs = {};
  let bulle = null;
  const afficher = (vue, autres = {}) => {
    champs = autres;
    const rendu = bulle.rendre(vue, { etroit, caseOuverte: null, ancre: caseActive, repere: cadre, fenetre: FENETRE, origineDeLaCible: null, modeMj, repos: REPOS, ...autres });
    if (rendu.ouverture) {
      bulle.replacer();
      bulle.focaliser();
    }
    return rendu;
  };
  const suivre = (commande) => {
    const suite = banc.ensuite?.(commande) ?? null;
    if (suite) afficher(suite, champs);
  };
  const actions = {
    executer: (commande, origine) => {
      banc.appels.push({ commande, origine });
      suivre(commande);
    },
    lancerLeDe: () => {
      banc.appels.push({ de: true });
      suivre({ de: true });
    },
    hachurer: (noms) => banc.hachures.push(noms),
    focusSurLeJeton: (id) => banc.jetons.push(id),
    focusSurLaCase: (nomDeCase) => banc.cases.push(nomDeCase),
    fermerLaCase: () => banc.appels.push({ fermerLaCase: true }),
    rafraichir: () => banc.rafraichis.push(true),
    // Les actions de la vague 3 (contrat, § 4.2) : la palette, les fiches, le journal, le repos.
    ouvrirPalette: (source, ancre, options) => banc.appels.push({ ouvrirPalette: source, ancre, options }),
    ouvrirFiches: (id) => banc.appels.push({ ouvrirFiches: id }),
    ouvrirJournal: () => banc.appels.push({ ouvrirJournal: true }),
    demanderLAnnulation: () => banc.appels.push({ demanderLAnnulation: true }),
    finDeTour: () => banc.appels.push({ finDeTour: true }),
  };
  // L'espion relève le contexte que la bulle passe au contenu, tel qu'il est à l'entrée.
  const releve = (composer) => (r, vue) => {
    banc.contextes.push({ r, entree: { ...r } });
    return composer(r, vue);
  };
  const dernierAppui = () => banc.appui;
  bulle = creer(actions, espion ? { composerListe: releve(composerListe), composerGeste: releve(composerGeste), dernierAppui } : { composerListe, composerGeste, dernierAppui });
  bulle.noeud.rectangle = { ...BULLE };
  bulle.onglet.rectangle = { ...ONGLET };
  cadre.append(caseActive, bulle.noeud, bulle.onglet);
  globalThis.document.body.append(cadre);
  const retirer = () => {
    Object.assign(globalThis, { addEventListener: avant.add, removeEventListener: avant.remove });
    retirerDom();
  };
  return Object.assign(banc, bulle, { bulle, afficher, cadre, caseActive, jeton, retirer, defile: bulle.noeud.querySelector(".combat-bulle-defile"), couche: bulle.noeud.querySelector(".combat-infobulles") });
}

function avecLaBulle(faire, options) {
  const monte = monter(options);
  try {
    faire(monte);
  } finally {
    monte.retirer();
  }
}

/** Le bouton qui ferme ou réduit la bulle. */
const leFermer = (monte) => monte.noeud.querySelector(".combat-bulle-fermer");

// ——— a) Ce que montre la bulle (§ 9.4) ———

test("bulle — sur un ordinateur, montrée pour une action non réduite : la liste sans geste, le jet avec (combat-bulle-jet) ; cachée pour « Qui joue ? », la fin, la préparation ; pas d'onglet sans réduction", () => {
  avecLaBulle((monte) => {
    const { noeud, onglet, defile } = monte;
    assert.equal(noeud.hidden, true, "cachée avant tout rendu");
    assert.deepEqual(monte.afficher(vueListe()), { montree: true, ouverture: true });
    assert.equal(noeud.hidden, false);
    assert.deepEqual(tous(defile, "button.combat-capacite").map((b) => b.getAttribute("data-ligne")).filter(Boolean), CLES, "la liste, dans ce qui défile");
    assert.equal(classesDe(noeud).includes("combat-bulle-jet"), false, "20rem pour la liste");
    assert.equal(onglet.hidden, true);

    assert.deepEqual(monte.afficher(vueJet()), { montree: true, ouverture: true }, "le jet : un autre genre de contenu");
    assert.ok(classesDe(noeud).includes("combat-bulle-jet"), "29,5rem pour le jet");
    assert.notEqual(defile.querySelector("ol.combat-etapes"), null);
    memeNoeud(defile.querySelector("[data-ligne]"), null, "le jet, sans la liste");
    assert.equal(onglet.hidden, true);

    for (const vue of [QUI_JOUE, TERMINE, PREPARATION]) {
      assert.deepEqual(monte.afficher(vue), { montree: false, ouverture: false }, vue.genre);
      assert.equal(noeud.hidden, true, vue.genre);
      assert.equal(onglet.hidden, true, vue.genre);
      assert.equal(defile.children.length, 0, "cachée, son corps est vide");
    }
  });
});

test("bulle — « +k » pendant le combat : la liste d'une case prend la place du contenu, ou ouvre la bulle seule ; elle se nomme par son titre ; avant le lancement et à la fin, rien", () => {
  avecLaBulle((monte) => {
    const { noeud, defile, listeDeCase } = monte;
    assert.equal(forme(listeDeCase), "div.combat-case-liste");
    assert.equal(listeDeCase.childNodes.length, 0, "c'est l'écran qui la remplit");

    // Sur une case, personne ne jouant encore : la bulle s'ouvre pour elle seule.
    assert.deepEqual(monte.afficher(QUI_JOUE, { caseOuverte: "D4" }), { montree: true, ouverture: true });
    memesNoeuds(defile.children, [listeDeCase], "ce qui défile");
    assert.equal(noeud.querySelector(".combat-bulle-tete").hidden, true, "la liste porte son propre titre");
    assert.equal(leFermer(monte).getAttribute("aria-label"), "Fermer");
    // L'écran la remplit, puis la bulle se nomme par son titre et y met le focus.
    const titreDeLaCase = globalThis.document.createElement("h3");
    titreDeLaCase.setAttribute("tabindex", "-1");
    titreDeLaCase.append("Case D4");
    const jeton = globalThis.document.createElement("button");
    jeton.append("Marmiton de corvée n° 1");
    listeDeCase.append(titreDeLaCase, jeton);
    assert.equal(monte.focaliser(), true);
    memeNoeud(dernierFocus().noeud, titreDeLaCase, "le focus");
    assert.notEqual(titreDeLaCase.id, "");
    assert.equal(noeud.getAttribute("aria-labelledby"), titreDeLaCase.id);
    assert.equal(noeud.getAttribute("aria-label"), null);

    // Une bulle montrée prend la liste à sa place, et la rend quand elle se ferme.
    assert.deepEqual(monte.afficher(vueListe()), { montree: true, ouverture: true });
    memeNoeud(listeDeCase.parentNode, null, "la liste a quitté la bulle");
    assert.equal(noeud.getAttribute("aria-label"), "Aubépine Crèmebrûlée : ses actions");
    assert.equal(noeud.getAttribute("aria-labelledby"), null);
    assert.equal(noeud.querySelector(".combat-bulle-tete").hidden, false);
    assert.deepEqual(monte.afficher(vueListe(), { caseOuverte: "D4" }), { montree: true, ouverture: true });
    memesNoeuds(defile.children, [listeDeCase], "ce qui défile");
    memesNoeuds(listeDeCase.children, [titreDeLaCase, jeton], "la bulle ne touche pas à ce que l'écran y a mis");
    assert.deepEqual(monte.afficher(vueListe(), { caseOuverte: "E5" }).ouverture, true, "une autre case : une ouverture");
    assert.deepEqual(monte.afficher(vueListe()).ouverture, true, "le contenu d'avant revient");
    assert.equal(laLigne(defile, "0:0").getAttribute("data-focus"), "ligne:0:0");

    // Avant le lancement, et à la fin : la liste reste où elle est.
    for (const vue of [PREPARATION, TERMINE]) assert.deepEqual(monte.afficher(vue, { caseOuverte: "D4" }), { montree: false, ouverture: false }, vue.genre);

    // ✕, Échap et le clic au-dehors valent son « Fermer » : l'écran rend le contenu d'avant, ou ferme.
    monte.afficher(QUI_JOUE, { caseOuverte: "D4" });
    leFermer(monte).click();
    assert.equal(monte.echap(), "fermee");
    monte.auDehors();
    assert.deepEqual(monte.appels, [{ fermerLaCase: true }, { fermerLaCase: true }, { fermerLaCase: true }]);
    assert.deepEqual(monte.jetons, []);
  });
});

test("bulle — sur un téléphone, le volet (contrat de la vague 3, § 4.2) : la liste, puis le geste ; « Fiche » dans son en-tête ; jamais l'onglet ; sa poignée ; la feuille le place ; une case ouverte le cache", () => {
  avecLaBulle(
    (monte) => {
      const { noeud, onglet } = monte;
      assert.deepEqual(monte.afficher(vueListe()), { montree: true, ouverture: true });
      assert.deepEqual(noeud.children.map((n) => n.className), ["combat-bulle-poignee", "combat-bulle-tete", "combat-bulle-defile", "combat-infobulles", "combat-bulle-fermer"]);
      assert.equal(noeud.children[0].tagName, "SPAN");
      assert.equal(noeud.children[0].getAttribute("aria-hidden"), "true", "la poignée n'est qu'un repère");
      assert.equal(noeud.className, "combat-bulle", "ni flèche ni largeur de jet");
      assert.deepEqual(noeud.style.ecritures, [], "la feuille place le volet : aucune écriture");
      assert.equal(laLigne(noeud, "0:0").getAttribute("data-focus"), "ligne:0:0");
      // La liste, au téléphone : le fil et la consigne en tête.
      assert.deepEqual(monte.defile.children.slice(0, 2).map(forme), ["ol.combat-fil", "p.combat-consigne"]);
      // « Fiche » dans l'en-tête : la fiche de qui joue.
      const tete = noeud.querySelector(".combat-bulle-tete");
      assert.deepEqual(tete.children.map(forme), ["h2.combat-bulle-titre", "p.combat-bulle-sous", "button.bouton secondaire"]);
      const fiche = leBouton(tete, "Fiche");
      assert.equal(fiche.hidden, false);
      fiche.click();
      assert.deepEqual(monte.appels, [{ ouvrirFiches: "pj1" }]);

      // Avec un geste, le volet le porte, pas à pas : une ouverture, l'étape de la vue.
      assert.deepEqual(monte.afficher(vueJet()), { montree: true, ouverture: true });
      assert.equal(noeud.hidden, false);
      assert.equal(texteDe(monte.defile.querySelector("ol.combat-fil li.en-cours")), "› 3 · Dés");
      assert.equal(monte.defile.querySelector("ol.combat-etapes"), null, "ni les six étapes du PC");
      assert.equal(texteDe(monte.defile.querySelector(".combat-de.echoue .combat-de-titre")), "2e dé");
      assert.equal(leFermer(monte).textContent, REDUIRE);
      assert.equal(fiche.hidden, false);
      assert.equal(onglet.hidden, true, "jamais d'onglet sur un téléphone");
      assert.equal(monte.echap(), "reduite");
      assert.equal(onglet.hidden, true);
      // « +k » : la liste d'une case reste dans la zone ; le volet se cache.
      assert.deepEqual(monte.afficher(vueListe(), { caseOuverte: "D4" }), { montree: false, ouverture: false });
      assert.deepEqual(monte.afficher(vueListe()), { montree: true, ouverture: true });
      monte.replacer();
      monte.ecoutes.find(([type]) => type === "resize")[1]();
      assert.deepEqual(noeud.style.ecritures, [], "ni à l'ouverture, ni sur resize");
      // La préparation : rien.
      assert.deepEqual(monte.afficher(PREPARATION), { montree: false, ouverture: false });
    },
    { etroit: true },
  );
  // Sur un ordinateur, ni poignée, ni « Fiche ».
  avecLaBulle((monte) => {
    monte.afficher(vueListe());
    assert.deepEqual(monte.noeud.children.map((n) => n.className), ["combat-bulle-tete", "combat-bulle-defile", "combat-infobulles", "combat-bulle-fermer"]);
    assert.deepEqual(monte.noeud.querySelector(".combat-bulle-tete").children.map(forme), ["h2.combat-bulle-titre", "p.combat-bulle-sous"]);
    assert.equal(monte.defile.querySelector(".combat-fil"), null);
  });
});

test("bulle — au téléphone, le volet au repos (maquette A1, A7) : qui joue, « Fiches », « Journal » ou « Fin de tour », « Annuler le dernier geste », chacun par son action ; la fin du combat ; rien à fermer", () => {
  avecLaBulle(
    (monte) => {
      const { noeud } = monte;
      // Le tour des PJ : « À qui le tour ? ».
      assert.deepEqual(monte.afficher(QUI_JOUE), { montree: true, ouverture: true });
      const titre = noeud.querySelector(".combat-bulle-titre");
      const sous = noeud.querySelector(".combat-bulle-sous");
      assert.deepEqual([texteDe(titre), texteDe(sous)], ["À qui le tour ?", "Touchez une vignette, ou un jeton sur la carte."]);
      assert.equal(noeud.getAttribute("aria-label"), "À qui le tour ?", "le dialogue se nomme par son titre");
      assert.equal(leFermer(monte).hidden, true, "rien à fermer");
      assert.equal(noeud.querySelector(".combat-bulle-tete button").hidden, true, "ni « Fiche »");
      const repos = monte.defile.querySelector(".combat-repos");
      memesNoeuds(monte.defile.children, [repos], "ce qui défile");
      assert.deepEqual(tous(repos, "button").map((b) => [texteDe(b), b.className]), [["Fiches", "bouton secondaire"], ["Journal", "bouton secondaire"], ["Annuler le dernier geste", "bouton secondaire"]]);
      for (const nom of ["Fiches", "Journal", "Annuler le dernier geste"]) leBouton(repos, nom).click();
      assert.deepEqual(monte.appels, [{ ouvrirFiches: null }, { ouvrirJournal: true }, { demanderLAnnulation: true }], "l'écran pose la question de l'annulation");
      assert.equal(monte.echap(), null, "Échap n'y ferme rien");
      assert.equal(monte.focaliser(), true);
      memeNoeud(dernierFocus().noeud, titre, "le focus, au titre");

      // Rien à annuler : inactif, sa raison liée ; il ne fait rien.
      monte.appels.length = 0;
      monte.afficher(QUI_JOUE, { repos: { ...REPOS, annuler: { ...REPOS.annuler, actif: false, raison: "Aucun geste à annuler." } } });
      const annuler = leBouton(noeud, "Annuler le dernier geste");
      assert.equal(annuler.getAttribute("aria-disabled"), "true");
      assert.equal(texteDe(noeud.querySelector(`#${annuler.getAttribute("aria-describedby")}`)), "Aucun geste à annuler.");
      annuler.click();
      assert.deepEqual(monte.appels, []);

      // Le tour adverse : « Le MJ joue ses adversaires. », « Fin de tour » en principal, sans « Journal ».
      monte.afficher({ ...QUI_JOUE, camp: "adv" });
      assert.deepEqual([texteDe(titre), texteDe(sous)], ["Le MJ joue ses adversaires.", "Touchez une vignette, ou « Fin de tour » quand tous ont joué."]);
      assert.deepEqual(tous(noeud, ".combat-repos button").map((b) => [texteDe(b), b.className]), [["Fiches", "bouton secondaire"], ["Fin de tour", "bouton"], ["Annuler le dernier geste", "bouton secondaire"]]);
      leBouton(noeud, "Fin de tour").click();
      assert.deepEqual(monte.appels, [{ finDeTour: true }]);
      monte.afficher({ ...QUI_JOUE, camp: "adv" }, { repos: { ...REPOS, finDeTour: { actif: false, raison: "Une action est en cours.", commande: null } } });
      leBouton(noeud, "Fin de tour").click();
      assert.deepEqual(monte.appels, [{ finDeTour: true }], "inactif, il ne fait rien");

      // La fin du combat : le vainqueur, « Fiches » et « Journal » seuls.
      monte.afficher({ ...TERMINE, vainqueur: "Combat terminé : victoire des PJ." });
      assert.equal(texteDe(titre), "Combat terminé : victoire des PJ.");
      assert.equal(sous.hidden, true);
      assert.deepEqual(tous(noeud, ".combat-repos button").map(texteDe), ["Fiches", "Journal"]);

      // Le geste fini, depuis le volet : le repos revient, et le focus va au jeton de qui jouait.
      monte.afficher(vueListe());
      assert.equal(leFermer(monte).hidden, false);
      monte.ensuite = () => QUI_JOUE;
      leBouton(noeud, "Passer son tour").click();
      assert.equal(noeud.hidden, false);
      assert.equal(texteDe(titre), "À qui le tour ?");
      assert.deepEqual(monte.jetons, ["pj1"]);
    },
    { etroit: true },
  );
});

test("bulle — l'onglet : la bulle réduite après le premier dé, « Taloche [1] : rouvrir » ; réduite tant que la vue dit « reduire », elle revient avec le geste qui suit ; oublier() la rouvre", () => {
  avecLaBulle((monte) => {
    const { noeud, onglet } = monte;
    assert.equal(forme(onglet), "button.combat-onglet");
    assert.equal(onglet.getAttribute("type"), "button");
    monte.afficher(vueJet());
    assert.equal(monte.echap(), "reduite");
    assert.deepEqual(monte.appels, [], "rien n'est émis : le geste attend");
    assert.equal(noeud.hidden, true);
    assert.equal(onglet.hidden, false);
    assert.equal(onglet.textContent, "Taloche [1] : rouvrir");

    // Un rendu de plus, une autre annonce : toujours réduite.
    assert.deepEqual(monte.afficher(vueJet({ annonce: { pas: 13, texte: "3e dé : 7, réussi." } })), { montree: false, ouverture: false });
    assert.equal(onglet.hidden, false);
    // Sur un téléphone, jamais d'onglet ; revenu à l'ordinateur, l'onglet revient.
    const ecran = (etroit) => ({ etroit, caseOuverte: null, ancre: monte.caseActive, repere: monte.cadre, fenetre: FENETRE, origineDeLaCible: null });
    monte.bulle.rendre(vueJet(), ecran(true));
    assert.equal(onglet.hidden, true);
    monte.bulle.rendre(vueJet(), ecran(false));
    assert.equal(onglet.hidden, false);
    // Le geste fini, la liste : reduite retombe.
    assert.deepEqual(monte.afficher(vueListe()), { montree: true, ouverture: true });
    assert.equal(onglet.hidden, true);
    // Le geste suivant, payé : la bulle montrée.
    assert.deepEqual(monte.afficher(vueJet()), { montree: true, ouverture: true });
    assert.equal(onglet.hidden, true);

    // Réduite, puis « Annuler le geste » : l'écran oublie, la bulle revient au rendu qui suit.
    monte.echap();
    assert.equal(onglet.hidden, false);
    monte.oublier();
    assert.deepEqual(monte.afficher(vueJet()), { montree: true, ouverture: true });
    assert.equal(onglet.hidden, true);
  });
});

// ——— b) Le dialogue, fermer, réduire ———

test("bulle — un dialogue non modal nommé par la vue : son en-tête, ce qui défile, la couche des infobulles, puis ✕ en dernier ; créés une fois ; un nom hostile reste du texte", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    const enfants = [...noeud.children];
    assert.equal(forme(noeud), "div.combat-bulle");
    assert.equal(noeud.getAttribute("role"), "dialog");
    assert.deepEqual(enfants.map((n) => n.className), ["combat-bulle-tete", "combat-bulle-defile", "combat-infobulles", "combat-bulle-fermer"]);
    monte.afficher(vueListe());
    assert.equal(noeud.getAttribute("aria-label"), "Aubépine Crèmebrûlée : ses actions");
    assert.equal(noeud.getAttribute("aria-modal"), null, "non modal : ni aria-modal, ni piège");
    const [tete, , , fermer] = noeud.children;
    assert.deepEqual(tete.children.map(forme), ["h2.combat-bulle-titre", "p.combat-bulle-sous"]);
    const [titre, sous] = tete.children;
    assert.equal(titre.getAttribute("tabindex"), "-1");
    assert.equal(titre.textContent, "Aubépine Crèmebrûlée");
    assert.equal(sous.textContent, "actions restantes : 2 sur 2 · souffle 10/10");
    assert.equal(forme(fermer), "button.combat-bulle-fermer");
    assert.equal(fermer.getAttribute("type"), "button");
    assert.equal(fermer.textContent, FERMER);
    assert.equal(fermer.getAttribute("aria-label"), "Fermer");
    memeNoeud(noeud.children.at(-1), fermer, "✕ en dernier : Tab sort après lui");

    // Le geste payé : son en-tête, et « – » pour réduire.
    monte.afficher(vueJet());
    assert.equal(titre.textContent, "Taloche [1] contre Marmiton de corvée n° 2");
    assert.equal(sous.textContent, "Aubépine · dernière action · souffle 6/10");
    assert.equal(fermer.textContent, REDUIRE);
    assert.equal(fermer.getAttribute("aria-label"), "Réduire");
    memesNoeuds(noeud.children, enfants, "les nœuds de la bulle ne sont jamais refaits");
    assert.equal(tous(noeud, "[aria-live]").length, 0, "la seule région polie est celle de la zone");

    // Un signe qui renverse l'écriture ne s'affiche pas, et n'entre pas dans le nom.
    monte.afficher(vueListe({ nom: "Aubépine\u202eCrèmebrûlée : ses actions", entete: { titre: "Aubépine\u202eCrèmebrûlée", sous: "" } }));
    assert.equal(noeud.getAttribute("aria-label"), "AubépineCrèmebrûlée : ses actions");
    assert.equal(titre.textContent, "AubépineCrèmebrûlée");
    assert.equal(sous.hidden, true, "un sous-titre vide ne se montre pas");
  });
});

test("bulle — « Fermer » (✕) avant le premier dé : la commande de la vue, depuis la bulle ; fermée, le focus va au jeton ; refusée, rien ne bouge", () => {
  for (const vue of [vueListe(), vueAvantLeDe()]) {
    avecLaBulle((monte) => {
      monte.afficher(vue);
      monte.ensuite = (commande) => (commande.choisir === null ? QUI_JOUE : null);
      assert.equal(leFermer(monte).textContent, FERMER);
      leFermer(monte).click();
      assert.deepEqual(monte.appels, [{ commande: { choisir: null }, origine: "bulle" }], "la séance joue « revenir » d'abord : rien n'est dépensé");
      assert.equal(monte.noeud.hidden, true);
      assert.deepEqual(monte.jetons, ["pj1"], "le focus au jeton de qui jouait");
    });
  }
  // La séance refuse : l'écran ne redessine pas, la bulle reste et le focus ne bouge pas.
  avecLaBulle((monte) => {
    monte.afficher(vueListe());
    leFermer(monte).click();
    assert.equal(monte.appels.length, 1);
    assert.equal(monte.noeud.hidden, false);
    assert.deepEqual(monte.jetons, []);
  });
});

test("bulle — après le premier dé, « – », Échap et le clic au-dehors réduisent, sans rien émettre ; l'onglet paraît contre la case ; il rouvre la bulle, la replace et met le focus sur la commande qui attend", () => {
  avecLaBulle((monte) => {
    const { noeud, onglet } = monte;
    monte.afficher(vueJet());
    assert.equal(dernierFocus().noeud.textContent, "Relancer le 2e dé", "à l'ouverture, la commande qui attend");

    // « – » : réduite, le focus au jeton.
    leFermer(monte).click();
    assert.deepEqual(monte.appels, []);
    assert.equal(noeud.hidden, true);
    assert.equal(onglet.hidden, false);
    assert.deepEqual(monte.jetons, ["pj1"]);
    // L'onglet, contre la case : l'écart de la flèche, sa pointe à 22 px.
    assert.deepEqual(proprietes(onglet), { "--bulle-gauche": "136px", "--bulle-haut": "92px", "--bulle-fleche": "22px", "--bulle-hauteur": "682px" });

    // Il rouvre, replace et focalise.
    const placees = noeud.style.ecritures.length;
    const focusAvant = globalThis.document.focalisations.length;
    onglet.click();
    assert.equal(globalThis.document.focalisations.length, focusAvant + 1, "un focus, par l'onglet");
    assert.equal(noeud.hidden, false);
    assert.equal(onglet.hidden, true);
    assert.equal(noeud.style.ecritures.length, placees + 4, "replacée : quatre propriétés");
    assert.equal(dernierFocus().noeud.textContent, "Relancer le 2e dé");
    assert.deepEqual(dernierFocus().options, { preventScroll: true });

    // Échap réduit, sans bouger le focus : c'est l'écran qui le met au jeton.
    const focalisations = globalThis.document.focalisations.length;
    assert.equal(monte.echap(), "reduite");
    assert.deepEqual(monte.appels, []);
    assert.equal(globalThis.document.focalisations.length, focalisations);
    assert.equal(onglet.hidden, false);
    assert.equal(monte.echap(), null, "réduite, Échap n'est plus pris");
    onglet.click();

    // Le clic au-dehors réduit, et le focus reste.
    const avant = globalThis.document.focalisations.length;
    monte.auDehors();
    assert.equal(onglet.hidden, false);
    assert.deepEqual(monte.appels, []);
    assert.equal(globalThis.document.focalisations.length, avant);
    assert.deepEqual(monte.jetons, ["pj1"], "seul « – » a rendu le focus au jeton");
  });
});

// ——— c) Le focus, le clavier, le dehors ———

test("bulle — focaliser : la commande qui attend ([data-focus]), sinon la première ligne active, sinon le titre ; toujours sans défiler ; cachée, rien", () => {
  avecLaBulle((monte) => {
    assert.equal(monte.focaliser(), false, "cachée, rien");
    monte.afficher(vueListe({ focus: "ligne:4:0" }));
    assert.equal(dernierFocus().noeud.getAttribute("data-ligne"), "4:0");

    // Sans commande qui attend : la première ligne active ; le corps refait garde le focus dans la bulle.
    monte.afficher(vueListe({ focus: null }));
    assert.equal(dernierFocus().noeud.getAttribute("data-ligne"), "0:0");
    const inactive = (ligne) => ({ ...ligne, actif: false, raison: "il manque du souffle (5)" });
    monte.afficher(vueListe({ focus: null, groupes: [{ titre: "Couteau d'office (précise)", lignes: [inactive(LIGNES.frappe), LIGNES.emincer] }] }));
    assert.equal(dernierFocus().noeud.getAttribute("data-ligne"), "1:0");
    // Rien d'actif, « Passer son tour » compris : le titre.
    monte.afficher(vueListe({ focus: null, groupes: [{ titre: "Couteau d'office (précise)", lignes: [inactive(LIGNES.frappe)] }], passer: passerDe("pj1", false) }));
    assert.equal(forme(dernierFocus().noeud), "h2.combat-bulle-titre");
    assert.equal(monte.focaliser(), true);
    for (const { options } of globalThis.document.focalisations) assert.deepEqual(options, { preventScroll: true });
  });
});

test("bulle — Maj+Tab depuis son premier élément (ou son titre) rend le focus au jeton ; ailleurs, et Tab après ✕, elle laisse faire et reste ouverte", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    const touche = (cible, shiftKey, key = "Tab") => {
      let empeche = false;
      noeud.declencher("keydown", { key, shiftKey, target: cible, preventDefault: () => (empeche = true) });
      return empeche;
    };
    monte.afficher(vueListe());
    const titre = noeud.querySelector(".combat-bulle-titre");
    assert.equal(touche(laLigne(noeud, "0:0"), true), true, "depuis la première ligne");
    assert.deepEqual(monte.jetons, ["pj1"]);
    assert.equal(touche(titre, true), true, "depuis le titre, que rien de tabulable ne précède");
    assert.deepEqual(monte.jetons, ["pj1", "pj1"]);
    assert.equal(touche(laLigne(noeud, "1:0"), true), false, "depuis la deuxième ligne, le navigateur fait");
    assert.equal(touche(leFermer(monte), false), false, "Tab après ✕ sort de la bulle");
    assert.equal(touche(laLigne(noeud, "0:0"), false), false, "Tab sans Maj");
    assert.equal(touche(laLigne(noeud, "0:0"), true, "Enter"), false, "une autre touche");
    assert.deepEqual(monte.jetons, ["pj1", "pj1"]);
    assert.equal(noeud.hidden, false, "la bulle reste ouverte");

    // Le jet : son premier élément est la première cible.
    monte.afficher(vueJet());
    assert.equal(touche(leBouton(noeud.querySelector(".combat-cibles"), "Marmiton de corvée n° 2"), true), true);
    assert.equal(touche(leBouton(noeud, "Relancer le 2e dé"), true), false);
    assert.deepEqual(monte.jetons, ["pj1", "pj1", "pj1"]);
    // Le Chef : son jeton.
    monte.afficher(vueDuChef());
    touche(laLigne(noeud, "0:0"), true);
    assert.equal(monte.jetons.at(-1), "adv2");
  });
});

test("bulle — la liste d'une case : Maj+Tab depuis son premier jeton rend le focus au « +k » qui l'a ouverte, non au jeton de qui joue ; sans protagoniste ni case, l'appui n'est pas pris", () => {
  avecLaBulle((monte) => {
    const { noeud, listeDeCase } = monte;
    const majTab = (cible) => {
      let empeche = false;
      noeud.declencher("keydown", { key: "Tab", shiftKey: true, target: cible, preventDefault: () => (empeche = true) });
      return empeche;
    };
    // La liste d'une case, depuis « Qui joue ? » : personne ne joue, la vue n'a pas de « Passer son tour ».
    monte.afficher(QUI_JOUE, { caseOuverte: "D4" });
    const titreDeLaCase = globalThis.document.createElement("h3");
    titreDeLaCase.setAttribute("tabindex", "-1");
    titreDeLaCase.append("Case D4");
    const premier = globalThis.document.createElement("button");
    premier.append("Marmiton de corvée n° 1");
    const second = globalThis.document.createElement("button");
    second.append("Marmiton de corvée n° 2");
    listeDeCase.append(titreDeLaCase, premier, second);
    assert.equal(majTab(premier), true, "l'appui est pris : il n'est pas avalé");
    assert.deepEqual(monte.cases, ["D4"], "le focus au « +k » de la case ouverte");
    assert.deepEqual(monte.jetons, []);
    assert.equal(majTab(second), false, "depuis le deuxième jeton, le navigateur fait");
    // Ouverte pendant une action : la liste prend la place, et Maj+Tab mène encore au « +k », non au jeton de l'acteur.
    monte.afficher(vueListe(), { caseOuverte: "D4" });
    assert.equal(majTab(premier), true);
    assert.deepEqual(monte.cases, ["D4", "D4"]);
    assert.deepEqual(monte.jetons, []);
    assert.equal(noeud.hidden, false, "la bulle reste ouverte");
    // Sans protagoniste (aucun « Passer son tour ») et sans case : rien n'est retenu, le navigateur fait.
    monte.afficher(vueListe({ passer: null }));
    assert.equal(majTab(laLigne(noeud, "0:0")), false, "sans protagoniste, l'appui n'est pas pris");
    assert.deepEqual([monte.cases, monte.jetons], [["D4", "D4"], []]);
  });
});

test("bulle — Échap en deux temps : l'infobulle ouverte d'abord, sans bouger le focus ; puis la bulle se ferme avant le premier dé ; cachée, Échap n'est pas pris", () => {
  avecLaBulle((monte) => {
    monte.afficher(vueListe());
    monte.ensuite = (commande) => (commande.choisir === null ? QUI_JOUE : null);
    const frappe = laLigne(monte.noeud, "0:0");
    frappe.declencher("focus");
    const info = infobulleDe(monte.noeud, frappe);
    assert.equal(info.hidden, false, "le focus ouvre son infobulle");
    const focalisations = globalThis.document.focalisations.length;
    assert.equal(monte.echap(), "infobulle");
    assert.equal(info.hidden, true);
    assert.equal(globalThis.document.focalisations.length, focalisations, "le focus ne bouge pas");
    assert.deepEqual(monte.appels, []);
    assert.equal(monte.echap(), "fermee");
    assert.deepEqual(monte.appels, [{ commande: { choisir: null }, origine: "bulle" }]);
    assert.equal(monte.noeud.hidden, true);
    assert.deepEqual(monte.jetons, [], "après Échap, c'est l'écran qui met le focus au jeton");
    assert.equal(monte.echap(), null, "cachée, Échap n'est pas pris");
  });
});

test("bulle — fermerLInfobulle : l'infobulle ouverte, ou les seules hachures de « Jet d'attaque », se ferment sans bouger le focus ni la bulle ; rien d'ouvert, faux", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    monte.afficher(vueListe());
    assert.equal(monte.fermerLInfobulle(), false, "rien d'ouvert");
    const taloche = laLigne(noeud, "15:0");
    taloche.declencher("pointerenter", { pointerType: "mouse" });
    const info = infobulleDe(noeud, taloche);
    assert.equal(info.hidden, false);
    const focalisations = globalThis.document.focalisations.length;
    assert.equal(monte.fermerLInfobulle(), true);
    assert.equal(info.hidden, true);
    assert.equal(noeud.hidden, false, "la bulle reste");
    assert.equal(globalThis.document.focalisations.length, focalisations, "le focus ne bouge pas");
    assert.deepEqual(monte.appels, []);

    // « Jet d'attaque » survolé : ses seules hachures. Échap les efface d'abord ; la bulle se ferme ensuite.
    monte.afficher(vueAvantLeDe({ geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], jetPrete: { arme: "Couteau d'office", presse: false, actif: true, raison: null, commande: regler("jet_prete", true), hachures: ["C3"] } }) }));
    monte.ensuite = (commande) => (commande.choisir === null ? QUI_JOUE : null);
    leBouton(noeud, "Jet d'attaque").declencher("pointerenter", { pointerType: "mouse" });
    assert.deepEqual(monte.hachures.at(-1), ["C3"]);
    assert.equal(monte.echap(), "infobulle", "les hachures d'abord");
    assert.equal(monte.hachures.at(-1), null);
    assert.equal(noeud.hidden, false);
    assert.equal(monte.echap(), "fermee", "puis la bulle");
    assert.equal(noeud.hidden, true);
  });
});

test("bulle — dehors : vrai hors de la bulle et de son onglet, la bulle montrée ; le clic au-dehors la ferme sans toucher au focus", () => {
  avecLaBulle((monte) => {
    const { noeud, onglet } = monte;
    const ailleurs = globalThis.document.createElement("button");
    globalThis.document.body.append(ailleurs);
    assert.equal(monte.dehors(ailleurs), false, "cachée, rien n'est au-dehors");
    monte.afficher(vueListe());
    assert.equal(monte.dehors(ailleurs), true);
    assert.equal(monte.dehors(globalThis.document.body), true);
    for (const dedans of [noeud, laLigne(noeud, "0:0"), leFermer(monte), noeud.querySelector(".combat-infobulle"), onglet]) assert.equal(monte.dehors(dedans), false, forme(dedans));

    monte.ensuite = (commande) => (commande.choisir === null ? QUI_JOUE : null);
    const focalisations = globalThis.document.focalisations.length;
    monte.auDehors();
    assert.deepEqual(monte.appels, [{ commande: { choisir: null }, origine: "bulle" }]);
    assert.equal(noeud.hidden, true);
    assert.equal(globalThis.document.focalisations.length, focalisations, "le focus reste");
    assert.deepEqual(monte.jetons, []);
    monte.auDehors();
    assert.equal(monte.appels.length, 1, "cachée, rien");
    assert.equal(monte.dehors(ailleurs), false);
  });
});

// ——— d) Le placement ———

test("bulle — le placement : contre la case, à droite en laissant libre la colonne voisine, sa pointe à 60 px ; la classe du côté ; à gauche quand la droite ne tient pas", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    monte.afficher(vueListe());
    // x = droite de la case (148) + un côté de case (48) + FLECHE ; y = milieu (124) − 60.
    assert.equal(FLECHE, 8);
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "184px", "--bulle-haut": "54px", "--bulle-fleche": "60px", "--bulle-hauteur": "720px" });
    assert.deepEqual(noeud.style.ecritures.map(([nom]) => nom), ["--bulle-gauche", "--bulle-haut", "--bulle-fleche", "--bulle-hauteur"]);
    assert.equal(noeud.className, "combat-bulle combat-bulle-droite");

    // Au milieu de la carte, les deux côtés tiennent : à droite d'abord.
    monte.caseActive.rectangle = { left: 600, top: 100, width: 48, height: 48 };
    monte.replacer();
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "684px", "--bulle-haut": "54px", "--bulle-fleche": "60px", "--bulle-hauteur": "720px" });
    assert.equal(noeud.className, "combat-bulle combat-bulle-droite");

    // Une case plus large : l'écart suit son côté.
    monte.caseActive.rectangle = { left: 100, top: 100, width: 64, height: 64 };
    monte.replacer();
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "216px", "--bulle-haut": "62px", "--bulle-fleche": "60px", "--bulle-hauteur": "712px" });

    // La case au bord droit de la fenêtre : à gauche.
    monte.caseActive.rectangle = { left: 1100, top: 100, width: 48, height: 48 };
    monte.replacer();
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "704px", "--bulle-haut": "54px", "--bulle-fleche": "60px", "--bulle-hauteur": "720px" });
    assert.equal(noeud.className, "combat-bulle combat-bulle-gauche");

    // Le jet garde sa largeur et son côté.
    monte.afficher(vueJet());
    assert.equal(noeud.className, "combat-bulle combat-bulle-jet combat-bulle-gauche");
    // Devenue volet (la fenêtre rétrécie) : ni flèche, ni largeur de jet.
    monte.bulle.rendre(vueListe(), { etroit: true, caseOuverte: null, ancre: monte.caseActive, repere: monte.cadre, fenetre: FENETRE, origineDeLaCible: null });
    assert.equal(noeud.className, "combat-bulle");
    monte.afficher(vueJet());
    monte.replacer();
    assert.equal(noeud.className, "combat-bulle combat-bulle-jet combat-bulle-gauche");
    // Cachée puis rouverte : pas de flèche avant d'être replacée.
    monte.afficher(QUI_JOUE);
    assert.equal(noeud.className, "combat-bulle");
    monte.bulle.rendre(vueListe(), { etroit: false, caseOuverte: null, ancre: monte.caseActive, repere: monte.cadre, fenetre: FENETRE, origineDeLaCible: null });
    assert.equal(noeud.className, "combat-bulle");
    // Sans case active, rien ne se place.
    const ecritures = noeud.style.ecritures.length;
    monte.bulle.rendre(vueListe(), { etroit: false, caseOuverte: null, ancre: null, repere: monte.cadre, fenetre: FENETRE, origineDeLaCible: null });
    monte.replacer();
    assert.equal(noeud.style.ecritures.length, ecritures);
  });
});

test("bulle — le placement aux seuls moments du § 9.3 : à l'ouverture, au changement de protagoniste ou de genre de contenu, sur resize ; jamais à un dé ni à un rendu égal", () => {
  avecLaBulle((monte) => {
    const ecritures = () => monte.noeud.style.ecritures.length;
    assert.deepEqual(monte.afficher(vueJet()), { montree: true, ouverture: true });
    assert.equal(ecritures(), 4, "à l'ouverture : quatre propriétés");
    // Des dés : le corps se refait, la bulle ne bouge pas.
    for (const pas of [13, 14, 15]) {
      assert.deepEqual(monte.afficher(vueJet({ annonce: { pas, texte: `${pas}` }, geste: gesteVu({ bilan: `Bilan ${pas}.` }) })), { montree: true, ouverture: false });
    }
    assert.deepEqual(monte.afficher(vueJet({ geste: gesteVu({ bilan: "Bilan 15." }) })), { montree: true, ouverture: false }, "un rendu égal");
    assert.equal(ecritures(), 4, "jamais à un dé");
    // Le geste fini : la liste, un autre genre de contenu.
    assert.equal(monte.afficher(vueListe()).ouverture, true);
    assert.equal(ecritures(), 8);
    assert.equal(monte.afficher(vueListe({ focus: null })).ouverture, false);
    // Un autre protagoniste.
    assert.equal(monte.afficher(vueDuChef()).ouverture, true);
    assert.equal(ecritures(), 12);

    // La fenêtre change de taille : un seul écouteur, de taille ; aucun de défilement.
    assert.deepEqual(monte.ecoutes.map(([type]) => type), ["resize"]);
    const surLaTaille = monte.ecoutes[0][1];
    surLaTaille();
    assert.equal(ecritures(), 16, "sur resize");
    assert.deepEqual(monte.rafraichis, [], "la largeur n'a pas changé : l'écran ne se refait pas");
    globalThis.document.documentElement.clientWidth = 900;
    surLaTaille();
    assert.deepEqual(monte.rafraichis, [true], "la largeur a changé : l'écran se refait (le téléphone se juge à la largeur)");
    assert.equal(ecritures(), 20);
    surLaTaille();
    assert.deepEqual(monte.rafraichis, [true]);
    // Cachée : rien ne se place.
    monte.afficher(QUI_JOUE);
    surLaTaille();
    assert.equal(ecritures(), 24);
    assert.deepEqual(monte.ecoutes.map(([type]) => type), ["resize"]);
  });
});

// ——— e) Les infobulles et les hachures (§ 9.5) ———

/** Une couche d'infobulles sur un repère (la bulle, ou la zone), avec un minuteur que le contrôle fait filer. */
function avecInfobulles(faire, { classe = "combat-bulle combat-bulle-droite", rectangle = BULLE, sansRepere = false } = {}) {
  const retirer = installerDom();
  try {
    const repere = globalThis.document.createElement("div");
    repere.className = classe;
    repere.rectangle = { ...rectangle };
    const couche = globalThis.document.createElement("div");
    couche.className = "combat-infobulles";
    repere.append(couche);
    globalThis.document.body.append(repere);
    const hachures = [];
    const poses = new Map();
    let numero = 0;
    const minuteur = {
      poses,
      poser(faire, ms) {
        numero += 1;
        poses.set(numero, { faire, ms });
        return numero;
      },
      retirer(n) {
        poses.delete(n);
      },
      filer() {
        for (const [n, { faire }] of [...poses]) {
          poses.delete(n);
          faire();
        }
      },
    };
    const infobulles = creerInfobulles({ couche, repere: sansRepere ? undefined : repere, actions: { hachurer: (noms) => hachures.push(noms) }, services: { minuteur, fenetre: () => FENETRE } });
    const declencheur = (boite = null) => {
      const bouton = globalThis.document.createElement("button");
      bouton.rectangle = boite;
      repere.append(bouton);
      return bouton;
    };
    const contenu = (texte) => () => {
      const p = globalThis.document.createElement("p");
      p.append(texte);
      return [p];
    };
    faire({ infobulles, couche, repere, hachures, minuteur, declencheur, contenu });
  } finally {
    retirer();
  }
}

test("infobulle — une par déclencheur, cachée et remplie d'emblée, role=tooltip, combat-info-<n>, décrite après la raison ; jamais focalisable ; sans contenu, les hachures seules", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, hachures, minuteur }) => {
    const ligne = declencheur();
    ligne.setAttribute("aria-describedby", "combat-bulle-raison-1");
    infobulles.lier(ligne, { contenu: () => [globalThis.document.createElement("b"), " · ", "Couteau d'office"], hachures: ["A1"] });
    assert.equal(couche.children.length, 1);
    const [info] = couche.children;
    assert.equal(forme(info), "div.combat-infobulle");
    assert.equal(info.getAttribute("role"), "tooltip");
    assert.equal(info.hidden, true, "cachée");
    assert.match(info.id, /^combat-info-\d+$/);
    assert.equal(info.textContent, " · Couteau d'office", "remplie d'emblée");
    assert.equal(ligne.getAttribute("aria-describedby"), `combat-bulle-raison-1 ${info.id}`, "après la raison");
    assert.equal(info.getAttribute("tabindex"), null, "jamais focalisable");
    for (const selecteur of ["button", "a", "input", "[tabindex]"]) assert.equal(tous(info, selecteur).length, 0, selecteur);
    assert.deepEqual(hachures, [], "rien n'est hachuré avant l'ouverture");

    const seule = declencheur();
    infobulles.lier(seule, { contenu: contenu("Vif") });
    assert.equal(seule.getAttribute("aria-describedby"), couche.children[1].id, "sans raison, son identifiant seul");
    assert.notEqual(couche.children[1].id, info.id);

    // « Jet d'attaque » : les hachures seules, sans infobulle ni description.
    for (const sans of [null, () => null, () => []]) {
      const jet = declencheur();
      infobulles.lier(jet, { contenu: sans, hachures: ["B2"] });
      assert.equal(couche.children.length, 2);
      assert.equal(jet.getAttribute("aria-describedby"), null);
      jet.declencher("pointerenter", { pointerType: "mouse" });
      assert.deepEqual(hachures.at(-1), ["B2"]);
      jet.declencher("pointerleave", { pointerType: "mouse" });
      minuteur.filer();
      assert.equal(hachures.at(-1), null);
    }
  });
});

test("infobulle — ouverte au survol (pas au doigt) et au focus, une seule à la fois, placée à son ouverture, avec ses hachures ; fermée, hachurer(null)", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, hachures }) => {
    const a = declencheur();
    const b = declencheur();
    infobulles.lier(a, { contenu: contenu("Frappe"), hachures: ["A1", "A2"] });
    infobulles.lier(b, { contenu: contenu("Réduction"), hachures: null });
    const [ia, ib] = couche.children;
    a.declencher("pointerenter", { pointerType: "touch" });
    assert.equal(ia.hidden, true, "au doigt, le survol n'ouvre rien");
    assert.deepEqual(hachures, []);

    a.declencher("pointerenter", { pointerType: "mouse" });
    assert.equal(ia.hidden, false);
    assert.deepEqual(hachures, [["A1", "A2"]]);
    assert.deepEqual(ia.style.ecritures.map(([nom]) => nom), ["--bulle-gauche", "--bulle-haut", "--bulle-fleche", "--bulle-hauteur"], "placée à son ouverture");
    assert.match(ia.className, /^combat-infobulle combat-infobulle-(droite|gauche|dessous)$/);
    a.declencher("pointerenter", { pointerType: "mouse" });
    assert.equal(ia.style.ecritures.length, 4, "déjà ouverte, elle ne se replace pas");

    // Une seule à la fois : le focus sur un passif ferme celle de la ligne.
    b.declencher("focus");
    assert.equal(ia.hidden, true);
    assert.equal(ib.hidden, false);
    assert.deepEqual(hachures, [["A1", "A2"], null, null], "fermée, hachurer(null) ; un passif n'en pose pas");
    b.declencher("blur");
    assert.equal(ib.hidden, true);
    assert.deepEqual(hachures, [["A1", "A2"], null, null, null]);
    // Un blur sur une fermée n'efface rien de plus.
    b.declencher("blur");
    assert.equal(hachures.length, 4);
  });
});

test("infobulle — tenue 300 ms après pointerleave, le temps de passer sur elle ; tenue tant que le déclencheur a le focus ; blur la ferme hors survol", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, hachures, minuteur }) => {
    const a = declencheur();
    infobulles.lier(a, { contenu: contenu("Frappe"), hachures: ["A1"] });
    const [ia] = couche.children;
    a.declencher("pointerenter", { pointerType: "mouse" });
    a.declencher("pointerleave", { pointerType: "mouse" });
    assert.equal(ia.hidden, false, "le pointeur peut passer du déclencheur à elle");
    assert.deepEqual([...minuteur.poses.values()].map(({ ms }) => ms), [300]);
    ia.declencher("pointerenter", { pointerType: "mouse" });
    assert.equal(minuteur.poses.size, 0, "sur elle, la fermeture est retirée");
    ia.declencher("pointerleave", { pointerType: "mouse" });
    assert.equal(minuteur.poses.size, 1);
    a.declencher("pointerenter", { pointerType: "mouse" });
    assert.equal(minuteur.poses.size, 0, "revenu sur le déclencheur");
    assert.equal(ia.hidden, false);
    a.declencher("pointerleave", { pointerType: "mouse" });
    minuteur.filer();
    assert.equal(ia.hidden, true, "300 ms passées, ni sur elle ni sur lui : fermée");
    assert.equal(hachures.at(-1), null);

    // Le focus la tient : le pointeur qui part ne la ferme pas.
    a.declencher("focus");
    a.declencher("pointerenter", { pointerType: "mouse" });
    a.declencher("pointerleave", { pointerType: "mouse" });
    assert.equal(minuteur.poses.size, 0);
    assert.equal(ia.hidden, false);
    // blur hors survol : fermée tout de suite.
    a.declencher("blur");
    assert.equal(ia.hidden, true);
    // blur pendant le survol : elle reste, jusqu'au départ du pointeur.
    a.declencher("focus");
    a.declencher("pointerenter", { pointerType: "mouse" });
    a.declencher("blur");
    assert.equal(ia.hidden, false);
    a.declencher("pointerleave", { pointerType: "mouse" });
    assert.equal(ia.hidden, false);
    minuteur.filer();
    assert.equal(ia.hidden, true);
  });
});

test("infobulle — fermer() rend vrai si une infobulle était ouverte, sans bouger le focus ; vider() retire la couche sans toucher aux hachures ; un déclencheur parti ne compte plus", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, hachures, minuteur }) => {
    assert.equal(infobulles.fermer(), false);
    const a = declencheur();
    infobulles.lier(a, { contenu: contenu("Frappe"), hachures: ["A1"] });
    a.declencher("focus");
    const focalisations = globalThis.document.focalisations.length;
    assert.equal(infobulles.fermer(), true);
    assert.equal(couche.children[0].hidden, true);
    assert.equal(hachures.at(-1), null);
    assert.equal(globalThis.document.focalisations.length, focalisations, "le focus ne bouge pas");
    assert.equal(infobulles.fermer(), false, "plus rien d'ouvert");

    // Les hachures seules (« Jet d'attaque ») se voient sur la carte : fermer() les efface, et le dit, comme une infobulle.
    const jet = declencheur();
    infobulles.lier(jet, { contenu: null, hachures: ["B2"] });
    jet.declencher("focus");
    assert.equal(infobulles.fermer(), true, "Échap efface d'abord les hachures");
    assert.equal(hachures.at(-1), null);
    assert.equal(infobulles.fermer(), false, "puis plus rien d'ouvert");
    // Ni contenu ni hachure : il n'y avait rien à voir, Échap passe à la suite.
    for (const sans of [null, []]) {
      const rien = declencheur();
      infobulles.lier(rien, { contenu: null, hachures: sans });
      rien.declencher("focus");
      assert.equal(infobulles.fermer(), false, JSON.stringify(sans));
    }

    // vider() : la couche part, la fermeture qui attendait aussi ; les hachures sont à l'appelant.
    a.declencher("blur");
    a.declencher("pointerenter", { pointerType: "mouse" });
    a.declencher("pointerleave", { pointerType: "mouse" });
    assert.equal(minuteur.poses.size, 1);
    const posees = hachures.length;
    infobulles.vider();
    assert.equal(couche.children.length, 0);
    assert.equal(minuteur.poses.size, 0);
    assert.equal(hachures.length, posees);
    assert.equal(infobulles.fermer(), false);

    // Un corps refait sans vider (la couche vidée par son lieu) : le déclencheur parti ne compte plus.
    const b = declencheur();
    infobulles.lier(b, { contenu: contenu("Taloche") });
    b.declencher("focus");
    couche.replaceChildren();
    b.remove();
    assert.equal(infobulles.fermer(), false, "Échap passe à la suite");
  });
});

test("infobulle — sa place : une ligne s'accroche aux bords de la bulle et à sa hauteur, du côté opposé au jeton, puis de l'autre, puis dessous ; une cause, à son nombre, dessous ou dessus", () => {
  const ligne = { left: 220, top: 150, width: 288, height: 36 };
  // La bulle à droite de sa case : l'infobulle à droite de la bulle.
  avecInfobulles(({ infobulles, couche, declencheur, contenu }) => {
    const bouton = declencheur(ligne);
    infobulles.lier(bouton, { contenu: contenu("Frappe") });
    const [info] = couche.children;
    info.rectangle = { width: 288, height: 120 };
    bouton.declencher("pointerenter", { pointerType: "mouse" });
    // x = bord droit de la bulle (524) + FLECHE ; y = milieu de la ligne (168) − 14 ; relatifs à la bulle (204, 64).
    assert.deepEqual(proprietes(info), { "--bulle-gauche": "328px", "--bulle-haut": "90px", "--bulle-fleche": "14px", "--bulle-hauteur": "630px" });
    assert.equal(info.className, "combat-infobulle combat-infobulle-droite");
  });
  // La bulle à gauche de sa case : l'infobulle à gauche, même si la droite tiendrait.
  avecInfobulles(
    ({ infobulles, couche, declencheur, contenu }) => {
      const bouton = declencheur({ ...ligne, left: 416 });
      infobulles.lier(bouton, { contenu: contenu("Frappe") });
      const [info] = couche.children;
      info.rectangle = { width: 288, height: 120 };
      bouton.declencher("focus");
      assert.deepEqual(proprietes(info), { "--bulle-gauche": "-296px", "--bulle-haut": "90px", "--bulle-fleche": "14px", "--bulle-hauteur": "630px" });
      assert.equal(info.className, "combat-infobulle combat-infobulle-gauche");
    },
    { classe: "combat-bulle combat-bulle-gauche", rectangle: { ...BULLE, left: 400 } },
  );
  // La bulle dessous sa case, contre le bord droit : à droite d'abord, qui ne tient pas, puis à gauche.
  avecInfobulles(
    ({ infobulles, couche, declencheur, contenu }) => {
      const bouton = declencheur({ ...ligne, left: 916 });
      infobulles.lier(bouton, { contenu: contenu("Frappe") });
      const [info] = couche.children;
      info.rectangle = { width: 288, height: 120 };
      bouton.declencher("focus");
      assert.equal(info.className, "combat-infobulle combat-infobulle-gauche");
    },
    { classe: "combat-bulle combat-bulle-dessous", rectangle: { ...BULLE, left: 900 } },
  );
  // Ni à droite ni à gauche : dessous.
  avecInfobulles(
    ({ infobulles, couche, declencheur, contenu }) => {
      const bouton = declencheur({ left: 316, top: 150, width: 648, height: 36 });
      infobulles.lier(bouton, { contenu: contenu("Frappe") });
      const [info] = couche.children;
      info.rectangle = { width: 288, height: 120 };
      bouton.declencher("focus");
      assert.equal(info.className, "combat-infobulle combat-infobulle-dessous");
    },
    { classe: "combat-bulle combat-bulle-droite", rectangle: { left: 300, top: 64, width: 680, height: 400 } },
  );
  // Une cause : son nombre est l'ancre, dessous puis dessus ; sur la zone, repère par défaut le parent de la couche.
  avecInfobulles(
    ({ infobulles, couche, declencheur, contenu }) => {
      const nombre = declencheur({ left: 300, top: 300, width: 60, height: 24 });
      infobulles.lier(nombre, { contenu: contenu("1 avantage"), cotes: ["dessous", "dessus"] });
      const [info] = couche.children;
      info.rectangle = { width: 288, height: 120 };
      nombre.declencher("pointerenter", { pointerType: "mouse" });
      // x = milieu du nombre (330) − 14 ; y = son bas (324) + FLECHE ; relatifs à la zone (204, 64).
      assert.deepEqual(proprietes(info), { "--bulle-gauche": "112px", "--bulle-haut": "268px", "--bulle-fleche": "14px", "--bulle-hauteur": "452px" });
      assert.equal(info.className, "combat-infobulle combat-infobulle-dessous");
      const bas = declencheur({ left: 300, top: 700, width: 60, height: 24 });
      infobulles.lier(bas, { contenu: contenu("1 désavantage"), cotes: ["dessous", "dessus"] });
      couche.children[1].rectangle = { width: 288, height: 120 };
      bas.declencher("focus");
      assert.equal(couche.children[1].className, "combat-infobulle combat-infobulle-dessus");
    },
    { classe: "combat-action", sansRepere: true },
  );
});

test("infobulle — au doigt, le focus qui suit l'appui n'ouvre rien (l'aperçu garde ses hachures) ; au clavier ou à la souris, il ouvre", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, hachures }) => {
    const a = declencheur();
    infobulles.lier(a, { contenu: contenu("Frappe"), hachures: ["A1"] });
    const [ia] = couche.children;
    a.declencher("pointerdown", { pointerType: "touch" });
    a.declencher("focus");
    assert.equal(ia.hidden, true);
    assert.deepEqual(hachures, []);
    a.declencher("blur");
    assert.deepEqual(hachures, [], "rien n'était ouvert : le blur n'efface rien");
    a.declencher("focus");
    assert.equal(ia.hidden, false, "plus tard, au clavier, le focus l'ouvre");
    a.declencher("blur");
    a.declencher("pointerdown", { pointerType: "mouse" });
    a.declencher("focus");
    assert.equal(ia.hidden, false, "le focus qui suit un clic de souris l'ouvre");
  });
});

test("infobulle — deux couches dans la page en même temps (la bulle, la zone) n'ont aucun identifiant en commun", () => {
  avecInfobulles(({ infobulles, couche, declencheur, contenu, repere }) => {
    const autreCouche = globalThis.document.createElement("div");
    repere.append(autreCouche);
    const autres = creerInfobulles({ couche: autreCouche, repere, actions: {}, services: { fenetre: () => FENETRE } });
    for (let i = 0; i < 3; i += 1) {
      infobulles.lier(declencheur(), { contenu: contenu(`a${i}`) });
      autres.lier(declencheur(), { contenu: contenu(`b${i}`) });
    }
    const ids = [...couche.children, ...autreCouche.children].map((n) => n.id);
    assert.equal(new Set(ids).size, 6);
  });
});

// ——— La bulle et son contenu ———

test("bulle — le corps refait : infobulles vidées et hachures effacées avant la composition, puis l'aperçu gardé se rouvre avec les siennes ; un rendu égal ne refait rien", () => {
  avecLaBulle((monte) => {
    const { noeud, couche } = monte;
    monte.afficher(vueListe());
    const frappe = laLigne(noeud, "0:0");
    assert.equal(couche.children.length, CLES.length + PASSIFS.length, "une infobulle par ligne et par passif");
    appuyer(frappe, "touch");
    assert.deepEqual(monte.hachures.at(-1), ["A1", "A2", "B1", "B2"], "l'aperçu, au doigt");
    assert.deepEqual(monte.appels, []);

    const posees = monte.hachures.length;
    monte.afficher(vueListe());
    memeNoeud(laLigne(noeud, "0:0"), frappe, "un rendu égal ne refait rien");
    monte.afficher(vueListe({ annonce: { pas: 3, texte: "1er dé : 9, réussi." } }));
    memeNoeud(laLigne(noeud, "0:0"), frappe, "l'annonce n'est pas dans la bulle : elle ne refait rien");
    assert.equal(monte.hachures.length, posees);

    monte.afficher(vueListe({ entete: { titre: "Aubépine Crèmebrûlée", sous: "actions restantes : 2 sur 2 · souffle 9/10" } }));
    autreNoeud(laLigne(noeud, "0:0"), frappe, "la vue a changé : le corps refait");
    assert.deepEqual(monte.hachures.slice(posees), [null, ["A1", "A2", "B1", "B2"]], "effacées d'abord, puis reposées par l'aperçu rouvert");
    assert.notEqual(laLigne(noeud, "0:0").parentNode.querySelector(".combat-apercu"), null);
    // Les infobulles du corps neuf, et elles seules.
    assert.equal(couche.children.length, CLES.length + PASSIFS.length);
    for (const cle of CLES) assert.notEqual(infobulleDe(noeud, laLigne(noeud, cle)), null, cle);
  });
});

test("bulle — le contexte du contenu : origine « bulle », l'origine de la cible, le focus de la vue, garder, la mémoire et les clés ; « choisie sur la carte », « choisie ici »", () => {
  avecLaBulle(
    (monte) => {
      monte.afficher(vueJet(), { origineDeLaCible: "plateau" });
      const [{ r, entree }] = monte.contextes;
      assert.equal(entree.origine, "bulle");
      assert.equal(entree.origineDeLaCible, "plateau");
      assert.equal(entree.focus, "choix:relancer");
      assert.equal(entree.pose, false);
      assert.equal(entree.compteur, 0);
      assert.equal(typeof entree.garder, "function");
      assert.equal(typeof entree.lier, "function");
      assert.ok(entree.cles instanceof Map);
      assert.deepEqual(Object.keys(entree.memoire).sort(), ["apercu", "causesOuvertes", "reglagesOuverts"]);
      assert.deepEqual(Object.keys(entree.actions).sort(), ["executer", "hachurer", "lancerLeDe", "montrer", "ouvrirPalette", "passerAuxDes"]);
      // Le contexte de la vague 3 (contrat, § 4.2) : sur PC, ni étape montrée ; le Mode MJ et la palette ouverte de l'écran.
      assert.deepEqual([entree.etroit, entree.modeMj, entree.palette, entree.etapeVue], [false, false, null, null]);
      assert.equal(r.pose, true, "la commande qui attend a été marquée");
      assert.equal(texteDe(monte.noeud.querySelector(".combat-origine")), "choisie sur la carte");
      // Le Mode MJ et la palette ouverte passent au contenu, et le refont.
      const palette = { onglets: [] };
      monte.afficher(vueJet(), { origineDeLaCible: "plateau", modeMj: true, vuePalette: palette });
      const refait = monte.contextes.at(-1).entree;
      assert.deepEqual([refait.modeMj, refait.etapeVue], [true, null]);
      assert.ok(refait.palette === palette, "la vue de la palette ouverte, telle quelle");
      // Un passif, « Appliquer l'effet de… », « Palette » : le contenu ouvre la palette par l'écran.
      monte.contextes.at(-1).r.actions.ouvrirPalette({ genre: "capacite", qui: "pj1", capacite: 7 }, monte.noeud, { libre: true });
      assert.deepEqual(monte.appels.at(-1).ouvrirPalette, { genre: "capacite", qui: "pj1", capacite: 7 });
      // « Palette » l'ouvre libre : la bulle passe ce troisième argument à l'écran, tel quel.
      assert.deepEqual(monte.appels.at(-1).options, { libre: true });

      // La même vue, la cible choisie ici : le corps se refait.
      monte.afficher(vueJet(), { origineDeLaCible: "bulle" });
      assert.equal(texteDe(monte.noeud.querySelector(".combat-origine")), "choisie ici");
      monte.afficher(vueJet(), { origineDeLaCible: null });
      memeNoeud(monte.noeud.querySelector(".combat-origine"), null, "sans origine, rien");

      // Un dé lancé depuis la bulle passe par l'écran.
      monte.afficher(vueJet({ geste: gesteVu({ aLancer: { libelle: "d8", motif: "jet" }, chaine: [{ titre: "1er dé", etat: "a_lancer", de: "d8" }] }), focus: "de" }));
      monte.noeud.querySelector("[data-focus=de]").click();
      assert.deepEqual(monte.appels.at(-1), { de: true });
    },
    { espion: true },
  );
});

test("bulle — la mémoire du contenu (aperçu, réglages, causes) tient le temps du geste, retombe quand il change ; oublier() la remet à zéro", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    const avecReglages = (bilan, autres = {}) => vueJet({ geste: gesteVu({ bilan, contexte: { ...gesteVu().contexte, reglages: REGLAGES } }), ...autres });
    const details = () => noeud.querySelector("details.combat-reglages");
    const cause = () => noeud.querySelector("button.combat-cause");
    const apercu = () => noeud.querySelector(".combat-apercu");

    monte.afficher(vueListe());
    appuyer(laLigne(noeud, "15:0"), "touch");
    assert.notEqual(apercu(), null);
    monte.afficher(vueListe({ focus: null }));
    assert.notEqual(apercu(), null, "le corps refait, l'aperçu rouvert");

    monte.afficher(avecReglages("Avant."));
    details().setAttribute("open", "");
    details().declencher("toggle");
    appuyer(cause(), "touch");
    monte.afficher(avecReglages("Toujours avant."));
    assert.equal(details().hasAttribute("open"), true, "le même geste : dépliés");
    assert.equal(cause().getAttribute("aria-expanded"), "true");

    // Le geste fini : l'aperçu d'avant ne revient pas ; le geste suivant repart replié.
    monte.afficher(vueListe());
    memeNoeud(apercu(), null, "l'aperçu d'avant");
    monte.afficher(avecReglages("Un autre geste."));
    assert.equal(details().hasAttribute("open"), false);
    assert.equal(cause().getAttribute("aria-expanded"), "false");
    // Un autre protagoniste : de même.
    details().setAttribute("open", "");
    details().declencher("toggle");
    monte.afficher(avecReglages("Le Chef joue.", { nom: "Chef de partie : ses actions", passer: passerDe("adv2", false) }));
    assert.equal(details().hasAttribute("open"), false);

    // oublier() (« Annuler le geste ») : la mémoire retombe, même pour le même geste.
    details().setAttribute("open", "");
    details().declencher("toggle");
    monte.oublier();
    monte.afficher(avecReglages("Le Chef joue.", { nom: "Chef de partie : ses actions", passer: passerDe("adv2", false) }));
    assert.equal(details().hasAttribute("open"), false);
    monte.afficher(vueListe());
    appuyer(laLigne(noeud, "15:0"), "touch");
    monte.oublier();
    monte.afficher(vueListe());
    memeNoeud(apercu(), null, "l'aperçu oublié");
  }, { modeMj: true });
});

test("bulle — un réglage qui ne fait pas avancer le geste garde le focus ; parti du corps refait, le focus va à la commande qui attend ; refusé, rien ne passe au rendu suivant", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    const options = [{ code: "force", nom: "Force", valeur: 4 }, { code: "agilite", nom: "Agilité", valeur: 5 }];
    const cible = { ...CIBLE, id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: false, commande: regler("cible", "adv3") };
    const avec = (choisies, autres = {}) =>
      vueAvantLeDe({ geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], contexte: CONTEXTE_NU, cibles: [cible], caracteristiques: { choisies, de: "d8", gabarit: { evenement: { type: "regler", champ: "caracteristiques" } }, options } }), focus: "cible:adv3", ...autres });
    const caracteristique = (nom) => leBouton(noeud.querySelector(".combat-caracteristiques"), nom);
    const marques = () => tous(noeud, "[data-focus]").map((n) => n.getAttribute("data-focus"));

    monte.afficher(avec(["force"]));
    assert.equal(dernierFocus().noeud.getAttribute("data-focus"), "cible:adv3");
    monte.ensuite = () => avec(["force", "agilite"]);
    caracteristique("Agilité").click();
    assert.deepEqual(marques(), ["caracteristique:agilite"]);
    memeNoeud(dernierFocus().noeud, caracteristique("Agilité"), "le focus revient au réglage, sans défiler");
    assert.deepEqual(dernierFocus().options, { preventScroll: true });

    // Le réglage n'est plus dans le corps refait : la commande qui attend.
    monte.ensuite = () => vueAvantLeDe({ geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], contexte: CONTEXTE_NU, cibles: [cible] }), focus: "cible:adv3" });
    caracteristique("Force").click();
    assert.deepEqual(marques(), ["cible:adv3"]);
    assert.equal(dernierFocus().noeud.getAttribute("data-focus"), "cible:adv3");

    // Refusé : l'écran ne redessine pas, et la clé ne passe pas au rendu suivant.
    monte.afficher(avec(["force"]));
    monte.ensuite = () => null;
    caracteristique("Agilité").click();
    monte.afficher(avec(["agilite"]));
    assert.deepEqual(marques(), ["cible:adv3"]);
  });
});

test("bulle — le geste fini : la liste revient, le focus à la première ligne active ; « Qui joue ? » : la bulle se cache et le focus va au jeton ; sur un téléphone, « Jouer » mène le volet au geste, sans toucher au jeton", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    const appliquer = { evenement: { type: "appliquer" } };
    monte.afficher(vueJet({ geste: gesteVu({ choix: [], appliquer: { libelle: "Appliquer", commande: appliquer } }), focus: "appliquer" }));
    assert.equal(texteDe(dernierFocus().noeud), "Appliquer");
    monte.ensuite = () => vueListe({ entete: { titre: "Aubépine Crèmebrûlée", sous: "actions restantes : 1 sur 2 · souffle 6/10" } });
    const focusAvant = globalThis.document.focalisations.length;
    leBouton(noeud, "Appliquer").click();
    assert.equal(globalThis.document.focalisations.length, focusAvant + 1, "à une ouverture, l'écran pose le focus, une fois la bulle placée ; la bulle ne le devance pas");
    assert.deepEqual(monte.appels, [{ commande: appliquer, origine: "bulle" }]);
    assert.equal(noeud.hidden, false);
    assert.equal(dernierFocus().noeud.getAttribute("data-ligne"), "0:0", "la première ligne active");
    assert.deepEqual(monte.jetons, []);

    monte.ensuite = () => QUI_JOUE;
    leBouton(noeud, "Passer son tour").click();
    assert.deepEqual(monte.appels.at(-1), { commande: { evenement: { type: "passer", qui: "pj1" } }, origine: "bulle" });
    assert.equal(noeud.hidden, true);
    assert.deepEqual(monte.jetons, ["pj1"], "le focus au jeton");
    assert.equal(monte.onglet.hidden, true);
  });
  // De même pour un adversaire.
  avecLaBulle((monte) => {
    monte.afficher(vueDuChef());
    monte.ensuite = () => QUI_JOUE;
    leBouton(monte.noeud, "Passer son tour").click();
    assert.deepEqual(monte.jetons, ["adv2"]);
  });
  avecLaBulle(
    (monte) => {
      const { noeud } = monte;
      monte.afficher(vueListe());
      monte.ensuite = () => vueJet();
      appuyer(laLigne(noeud, "15:0"), "touch");
      assert.deepEqual(monte.appels, [], "le premier appui ouvre l'aperçu");
      leBouton(noeud, "Jouer Taloche [1]").click();
      assert.deepEqual(monte.appels, [{ commande: capacite(15, 0), origine: "bulle" }]);
      assert.equal(noeud.hidden, false, "le geste se joue dans le volet");
      assert.notEqual(monte.defile.querySelector(".combat-fil"), null);
      assert.equal(monte.hachures.at(-1), null, "les hachures de l'aperçu partent avec la liste");
      assert.equal(dernierFocus().noeud.getAttribute("data-focus"), "choix:relancer", "une ouverture : le focus à la commande qui attend");
      assert.deepEqual(monte.jetons, []);
      // ✕ du volet : « Qui joue ? », le repos ; le focus au jeton.
      monte.afficher(vueListe());
      monte.ensuite = () => QUI_JOUE;
      leFermer(monte).click();
      assert.deepEqual(monte.jetons, ["pj1"]);
      assert.notEqual(monte.defile.querySelector(".combat-repos"), null);
    },
    { etroit: true },
  );
});

test("bulle — l'infobulle d'une ligne : survol, hachures, tenue 300 ms, côté opposé au jeton ; les hachures s'effacent quand la bulle se ferme ou se réduit", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    monte.afficher(vueListe());
    const frappe = laLigne(noeud, "0:0");
    frappe.rectangle = { left: 220, top: 150, width: 288, height: 36 };
    const info = infobulleDe(noeud, frappe);
    info.rectangle = { width: 288, height: 120 };
    memeNoeud(info.parentNode, monte.couche, "dans la couche de la bulle, hors de ce qui défile");
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      frappe.declencher("pointerenter", { pointerType: "mouse" });
      assert.equal(info.hidden, false);
      assert.deepEqual(monte.hachures.at(-1), ["A1", "A2", "B1", "B2"]);
      assert.deepEqual(proprietes(info), { "--bulle-gauche": "328px", "--bulle-haut": "90px", "--bulle-fleche": "14px", "--bulle-hauteur": "630px" });
      assert.equal(info.className, "combat-infobulle combat-infobulle-droite");
      frappe.declencher("pointerleave", { pointerType: "mouse" });
      mock.timers.tick(299);
      assert.equal(info.hidden, false, "tenue pendant la grâce");
      mock.timers.tick(1);
      assert.equal(info.hidden, true);
      assert.equal(monte.hachures.at(-1), null);
    } finally {
      mock.timers.reset();
    }

    // La bulle à gauche de sa case : l'infobulle à gauche.
    monte.caseActive.rectangle = { left: 1100, top: 100, width: 48, height: 48 };
    monte.replacer();
    noeud.rectangle = { ...BULLE, left: 724 };
    frappe.rectangle = { ...frappe.rectangle, left: 740 };
    frappe.declencher("focus");
    assert.equal(info.className, "combat-infobulle combat-infobulle-gauche");

    // Le passif : son infobulle, sans hachure.
    const passif = noeud.querySelector(".combat-passif");
    passif.declencher("focus");
    assert.equal(infobulleDe(noeud, passif).hidden, false);
    assert.equal(monte.hachures.at(-1), null);

    // Une infobulle ouverte, la bulle se ferme : elle part, ses hachures aussi.
    frappe.declencher("focus");
    assert.deepEqual(monte.hachures.at(-1), ["A1", "A2", "B1", "B2"]);
    monte.afficher(QUI_JOUE);
    assert.equal(monte.hachures.at(-1), null);
    assert.equal(monte.couche.children.length, 0);

    // « Jet d'attaque » survolé, la bulle se réduit : les hachures s'effacent.
    monte.afficher(vueJet({ geste: gesteVu({ jetPrete: { arme: "Couteau d'office", presse: false, actif: true, raison: null, commande: regler("jet_prete", true), hachures: ["C3"] } }) }));
    leBouton(noeud, "Jet d'attaque").declencher("pointerenter", { pointerType: "mouse" });
    assert.deepEqual(monte.hachures.at(-1), ["C3"]);
    monte.auDehors();
    assert.equal(monte.onglet.hidden, false);
    assert.equal(monte.hachures.at(-1), null);
  });
});

test("bulle — au doigt, ni le focus qui suit l'appui ni le survol n'ouvrent l'infobulle : l'aperçu garde ses hachures", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    monte.afficher(vueListe());
    const taloche = laLigne(noeud, "15:0");
    taloche.declencher("pointerenter", { pointerType: "touch" });
    taloche.declencher("pointerdown", { pointerType: "touch" });
    taloche.declencher("focus");
    taloche.click();
    assert.equal(infobulleDe(noeud, taloche).hidden, true);
    assert.deepEqual(monte.hachures.at(-1), ["A1"], "les hachures de l'aperçu");
    taloche.declencher("pointerleave", { pointerType: "touch" });
    assert.deepEqual(monte.hachures.at(-1), ["A1"]);
  });
});

test("bulle — ouverte par un appui du doigt sur le jeton, le focus posé sur sa première ligne n'ouvre ni infobulle ni hachure, sur un téléphone comme au-delà de 56rem ; ouverte au clavier, il l'ouvre (focus fidèle)", () => {
  const montrees = (monte) => tous(monte.couche, "div.combat-infobulle").filter((info) => !info.hidden);
  const hachures = (monte) => monte.hachures.filter((noms) => noms !== null);
  for (const etroit of [true, false]) {
    const quand = etroit ? "sous 56rem, le volet" : "à 56rem et plus, la bulle";
    avecLaBulle(
      (monte) => {
        // L'appui du doigt sur le jeton, puis son clic : l'écran ouvre la bulle et met le focus à sa première ligne.
        monte.cadre.declencher("pointerdown", { pointerType: "touch", target: monte.jeton });
        monte.afficher(vueListe());
        const frappe = laLigne(monte.noeud, "0:0");
        memeNoeud(globalThis.document.activeElement, frappe, `${quand} : le focus à la première ligne`);
        assert.deepEqual(montrees(monte), [], `${quand} : aucune infobulle au doigt`);
        assert.deepEqual(hachures(monte), [], `${quand} : aucune hachure au doigt`);

        // Fermée, puis rouverte par Entrée sur le jeton : le focus qui suit ouvre l'infobulle de la première ligne.
        monte.afficher(QUI_JOUE);
        monte.jeton.focus({ preventScroll: true });
        monte.cadre.declencher("keydown", { key: "Enter", target: monte.jeton });
        monte.afficher(vueListe());
        assert.equal(infobulleDe(monte.noeud, laLigne(monte.noeud, "0:0")).hidden, false, `${quand} : au clavier, l'infobulle de la première ligne`);
        assert.deepEqual(monte.hachures.at(-1), ["A1", "A2", "B1", "B2"]);
      },
      { etroit, focusFidele: true },
    );
  }
});

test("bulle — ce qui défile en elle repart du haut à chaque ouverture (✕ puis le jeton, l'onglet), mais pas à un dé ; le focus posé et l'aperçu qui s'ouvre y sont amenés dans la partie vue", () => {
  avecLaBulle((monte) => {
    const { defile } = monte;
    monte.afficher(vueListe());
    defile.scrollTop = 450;
    monte.ensuite = (commande) => (commande.choisir === null ? QUI_JOUE : null);
    leFermer(monte).click();
    assert.equal(monte.noeud.hidden, true);
    monte.afficher(vueListe());
    assert.equal(defile.scrollTop, 0, "rouverte par le jeton : du haut, la première ligne se voit");

    // Réduite après le premier dé, défilée, puis rouverte par l'onglet : du haut.
    monte.afficher(vueJet());
    assert.equal(monte.echap(), "reduite");
    defile.scrollTop = 300;
    monte.onglet.click();
    assert.equal(defile.scrollTop, 0, "rouverte par l'onglet : du haut");
    // Un dé (le corps refait, sans ouverture) ne la fait pas défiler.
    defile.scrollTop = 120;
    assert.equal(monte.afficher(vueJet({ annonce: { pas: 13, texte: "3e dé : 7, réussi." }, geste: gesteVu({ bilan: "Bilan 13." }) })).ouverture, false);
    assert.equal(defile.scrollTop, 120, "un dé ne fait pas défiler la bulle");
  });

  // Ce qui reçoit le focus : amené dans la partie vue (464 à 769 px), par le plus court.
  avecLaBulle((monte) => {
    const { defile, noeud } = monte;
    monte.afficher(vueListe({ focus: "ligne:15:0" }));
    defile.rectangle = { left: 204, top: 464, width: 320, height: 305 };
    laLigne(noeud, "15:0").rectangle = { left: 204, top: 800, width: 320, height: 36 };
    defile.scrollTop = 0;
    assert.equal(monte.focaliser(), true);
    assert.equal(defile.scrollTop, 67, "sous la partie vue : son bas amené au bas de la partie vue");
    laLigne(noeud, "15:0").rectangle = { left: 204, top: 400, width: 320, height: 36 };
    defile.scrollTop = 200;
    monte.focaliser();
    assert.equal(defile.scrollTop, 136, "au-dessus : son haut amené au haut de la partie vue");
    laLigne(noeud, "15:0").rectangle = { left: 204, top: 500, width: 320, height: 36 };
    monte.focaliser();
    assert.equal(defile.scrollTop, 136, "déjà vue : rien ne bouge");
    assert.equal(globalThis.document.documentElement.scrollTop, 0, "la page ne défile pas");
    // Le titre de la bulle, hors de ce qui défile, reçoit le focus (aucune ligne active) : rien ne défile pour lui.
    const inactive = (ligne) => ({ ...ligne, actif: false, raison: "il manque du souffle (5)" });
    noeud.querySelector(".combat-bulle-titre").rectangle = { left: 204, top: 80, width: 320, height: 30 };
    monte.afficher(vueListe({ focus: null, groupes: [{ titre: "Couteau d'office (précise)", lignes: [inactive(LIGNES.frappe)] }], passer: passerDe("pj1", false) }));
    assert.equal(forme(dernierFocus().noeud), "h2.combat-bulle-titre");
    assert.equal(defile.scrollTop, 136, "le titre n'est pas dans ce qui défile");
  });

  // L'aperçu de la dernière ligne, ouvert au doigt sous la partie vue : amené dans la bulle.
  avecLaBulle((monte) => {
    const { defile, noeud } = monte;
    const creerAvant = globalThis.document.createElement;
    // La boîte de l'aperçu, prêtée dès sa fabrication : 900 à 1 000 px.
    globalThis.document.createElement = (balise) => {
      const cree = creerAvant(balise);
      Object.defineProperty(cree, "rectangle", { get: () => (cree.className === "combat-apercu" ? { left: 204, top: 900, width: 320, height: 100 } : null), set: () => {}, configurable: true });
      return cree;
    };
    try {
      monte.afficher(vueListe());
      defile.rectangle = { left: 204, top: 464, width: 320, height: 305 };
      defile.scrollTop = 0;
      appuyer(laLigne(noeud, "15:0"), "touch");
      assert.notEqual(noeud.querySelector(".combat-apercu"), null);
      assert.equal(defile.scrollTop, 231, "le bas de l'aperçu au bas de la partie vue");
    } finally {
      globalThis.document.createElement = creerAvant;
    }
  });
});

// ——— g) La vague 3 : la bulle bornée, la palette en colonne, le volet pas à pas ———

test("bulle — bornée sous le bandeau (mission, § 6, point 10) : le plafond que l'écran donne, nombre ou fonction, la garde sous lui ; sa plus grande hauteur va jusqu'au bas de la fenêtre", () => {
  avecLaBulle((monte) => {
    const { noeud } = monte;
    // Sans plafond : la marge ; de 64 px au bas de la fenêtre, marge ôtée.
    monte.afficher(vueListe());
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "184px", "--bulle-haut": "54px", "--bulle-fleche": "60px", "--bulle-hauteur": "720px" });
    // Sous un bandeau qui finit à 120 px : collée sous lui, la flèche au plus près de la case.
    monte.afficher(vueJet(), { plafond: 120 });
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "184px", "--bulle-haut": "110px", "--bulle-fleche": "12px", "--bulle-hauteur": "664px" });
    // Une fonction : lue au moment de placer, sur resize aussi.
    let bas = 200;
    monte.afficher(vueListe(), { plafond: () => bas });
    assert.equal(proprietes(noeud)["--bulle-haut"], "190px");
    bas = 300;
    monte.ecoutes.find(([type]) => type === "resize")[1]();
    assert.deepEqual(proprietes(noeud), { "--bulle-gauche": "184px", "--bulle-haut": "290px", "--bulle-fleche": "12px", "--bulle-hauteur": "484px" });
    // L'onglet de la bulle réduite ne s'y borne pas : il reste contre la case.
    monte.afficher(vueJet(), { plafond: 300 });
    monte.echap();
    assert.equal(proprietes(monte.onglet)["--bulle-haut"], "92px");
  });
});

test("bulle — sur PC, la palette en colonne : posée après ce qui défile, la croix toujours en dernier, la bulle élargie (combat-bulle-large) ; ôtée quand l'écran ne la donne plus, cachée avec la bulle ; jamais au téléphone", () => {
  avecLaBulle((monte) => {
    const { noeud, defile } = monte;
    const palette = globalThis.document.createElement("section");
    palette.className = "combat-palette";
    monte.afficher(vueJet(), { palette });
    assert.deepEqual(noeud.children.map((n) => n.className), ["combat-bulle-tete", "combat-bulle-defile", "combat-palette", "combat-infobulles", "combat-bulle-fermer"]);
    memeNoeud(noeud.children[2], palette, "la palette de l'écran, telle quelle");
    assert.deepEqual(classesDe(noeud), ["combat-bulle", "combat-bulle-jet", "combat-bulle-large", "combat-bulle-droite"]);
    memeNoeud(defile.querySelector(".combat-palette"), null, "hors de ce qui défile");
    // Un dé, la palette toujours là : elle n'est pas reposée.
    monte.afficher(vueJet({ annonce: { pas: 13, texte: "3e dé : 7, réussi." } }), { palette });
    memeNoeud(noeud.children[2], palette);
    // L'écran ne la donne plus (« Fermer », ou un effet appliqué hors Mode MJ) : ôtée, la bulle reprend sa largeur.
    monte.afficher(vueJet(), { palette: null });
    assert.deepEqual(noeud.children.map((n) => n.className), ["combat-bulle-tete", "combat-bulle-defile", "combat-infobulles", "combat-bulle-fermer"]);
    memeNoeud(palette.parentNode, null, "elle a quitté la bulle");
    assert.equal(classesDe(noeud).includes("combat-bulle-large"), false);
    // La bulle cachée (« Qui joue ? ») : la palette part avec elle.
    monte.afficher(vueJet(), { palette });
    monte.afficher(QUI_JOUE, { palette });
    memeNoeud(palette.parentNode, null);
  });
  avecLaBulle(
    (monte) => {
      const palette = globalThis.document.createElement("section");
      monte.afficher(vueJet(), { palette });
      memeNoeud(palette.parentNode, null, "au téléphone, la palette est une feuille que l'écran pose");
      assert.equal(classesDe(monte.noeud).includes("combat-bulle-large"), false);
    },
    { etroit: true },
  );
});

test("bulle — au téléphone, l'étape montrée est celle de la vue ; « Un jet par cible » mène le volet aux dés sans rien émettre, jusqu'à ce que la vue y vienne ; un autre geste, ou oublier(), l'efface", () => {
  avecLaBulle(
    (monte) => {
      const { noeud, defile } = monte;
      const centree = (champs = {}) =>
        vueAvantLeDe({
          etape: 1,
          fil: filDeLAttaque(1),
          consigne: "Toute la case D4 : qui est visé ?",
          geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], dernierDe: null, aLancer: { faces: 8, combien: 1, libelle: "d8", motif: "jet" }, jetsParCible: { libelle: "Un jet par cible : 2 cibles" } }),
          focus: "de",
          ...champs,
        });
      monte.afficher(centree());
      assert.equal(monte.contextes.at(-1).entree.etapeVue, 1);
      assert.equal(texteDe(defile.querySelector(".combat-consigne")), "Toute la case D4 : qui est visé ?");
      assert.equal(defile.querySelector(".combat-chaine"), null, "les dés sont à l'étape 2");
      const jets = leBouton(defile, "Un jet par cible");
      jets.focus({ preventScroll: true });
      jets.click();
      assert.deepEqual(monte.appels, [], "rien n'est émis");
      assert.equal(monte.contextes.at(-1).entree.etapeVue, 2);
      assert.equal(defile.querySelector(".combat-cibles"), null);
      assert.equal(defile.querySelector(".combat-consigne"), null, "la consigne est celle de l'étape 1");
      const de = defile.querySelector("[data-focus=de]");
      assert.equal(texteDe(de.querySelector(".combat-de-detail")), "touchez");
      memeNoeud(dernierFocus().noeud, de, "le focus, au dé qui attend");
      // Un rendu de plus, la vue toujours à l'étape 1 : les dés restent.
      monte.afficher(centree({ annonce: { pas: 5, texte: "…" } }));
      assert.notEqual(defile.querySelector(".combat-chaine"), null);
      // Le premier dé : la vue vient à l'étape 2 d'elle-même ; revenue à 1 (« Revenir »), l'étape forcée est oubliée.
      monte.afficher(centree({ etape: 2 }));
      monte.afficher(centree());
      assert.notEqual(defile.querySelector(".combat-cibles"), null);
      // Forcée, puis oubliée par oublier() (« Annuler le geste »).
      leBouton(defile, "Un jet par cible").click();
      monte.oublier();
      monte.afficher(centree());
      assert.notEqual(defile.querySelector(".combat-cibles"), null);
      assert.equal(noeud.hidden, false);
    },
    { etroit: true, espion: true, focusFidele: false },
  );
  // Sur PC, « Un jet par cible » n'est qu'une phrase : tout se montre ensemble.
  avecLaBulle((monte) => {
    monte.afficher(vueAvantLeDe({ etape: 1, geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], jetsParCible: { libelle: "Un jet par cible : 2 cibles" } }) }));
    assert.equal(boutons(monte.noeud, "Un jet par cible").length, 0);
    assert.equal(texteDe(monte.noeud.querySelector("p.combat-jets-par-cible")), "Un jet par cible : 2 cibles");
  });
});

test("bulle — le Mode MJ passe au contenu : sans lui, ni réglages à la main, ni « Palette » ; avec lui, les deux ; le changer refait le corps", () => {
  avecLaBulle(
    (monte) => {
      const { defile } = monte;
      const vue = vueAvantLeDe({ etape: 2, geste: gesteVu({ chaine: [], bilan: null, lettres: [], choix: [], contexte: { ...gesteVu().contexte, reglages: REGLAGES } }) });
      monte.afficher(vue);
      assert.equal(defile.querySelector(".combat-reglages"), null);
      assert.equal(boutons(defile, "Palette").length, 0);
      monte.afficher(vue, { modeMj: true });
      assert.notEqual(defile.querySelector(".combat-reglages"), null);
      leBouton(defile, "Palette").click();
      assert.deepEqual(monte.appels.at(-1).ouvrirPalette, { genre: "capacite", qui: "pj1", capacite: 15 });
    },
    { etroit: true },
  );
});

// ——— f) Le module ———

test("combat_bulle.js — dom.js et echelle.js seuls ; tout focus sans défiler, aucun défilement ; aucun style écrit ; ni modale ni région ; les signes neufs par leur code ; son en-tête dit le § 17 et le contrat", () => {
  const source = readFileSync(new URL("../js/ecrans/combat_bulle.js", import.meta.url), "utf8");
  const entete = source.slice(0, source.search(/^import /m));
  assert.match(entete, /SPECIFICATION\.md, § 17/);
  assert.match(entete, /§ 9\.3 à § 9\.5/);
  // L'en-tête dit quand elle se place (C-25) et ce qui seul la fait défiler (C-03).
  assert.match(entete, /et quand la fenêtre\r?\n\/\/ change de taille ; une infobulle se place à sa propre ouverture\./);
  assert.doesNotMatch(entete, /à l'ouverture d'une\s+(?:\/\/\s+)?infobulle/);
  assert.match(entete, /une\r?\n\/\/ seule fonction, montrerDansLaBulle, et par son seul scrollTop/);
  assert.deepEqual([...source.matchAll(/^import .* from "(.*)";\r?$/gm)].map(([, chemin]) => chemin), ["./dom.js", "./echelle.js"]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.match(source, /^export function creer\(actions, \{ composerListe, composerGeste, dernierAppui = null \}\) \{/m);
  assert.match(source, /^export function creerInfobulles\(\{ couche, repere = null, actions = \{\}, services = \{\} \} = \{\}\) \{/m);
  // Tout focus sans défiler (compl. § 4.5), écrit en toutes lettres ; aucun défilement de la page.
  const focus = [...source.matchAll(/\.focus\(([^)]*)\)/g)].map(([, options]) => options);
  assert.ok(focus.length > 0);
  for (const options of focus) assert.equal(options, "{ preventScroll: true }");
  assert.doesNotMatch(source, /scrollIntoView|scrollTo\b|scrollBy|window\.scroll/);
  // Le défilement propre de la bulle s'écrit dans montrerDansLaBulle seule, et n'y touche que ce qui défile en elle.
  const debut = source.indexOf("function montrerDansLaBulle(");
  assert.ok(debut > 0, "montrerDansLaBulle existe");
  const fin = source.indexOf("\n  }", debut) + 4;
  const corps = source.slice(debut, fin);
  const ecritures = (texte) => [...texte.matchAll(/(\S*)scrollTop\s*[-+*/]?=(?!=)/g)].map(([, objet]) => objet);
  assert.deepEqual(ecritures(source.slice(0, debut) + source.slice(fin)), [], "hors de montrerDansLaBulle, aucun scrollTop écrit");
  assert.ok(ecritures(corps).length >= 3);
  for (const objet of ecritures(corps)) assert.equal(objet, "defile.", "seul ce qui défile dans la bulle");
  assert.doesNotMatch(source, /["']scroll["']/, "aucun écouteur de défilement");
  // La place s'écrit dans echelle.js : ici, ni style ni propriété.
  assert.doesNotMatch(source, /\.style\b|\bstyle\s*[:=]|setAttribute\(\s*["']style|cssText|setProperty|removeProperty/);
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write/);
  assert.doesNotMatch(source, /\b(?:window|globalThis|document)\s*\.\s*addEventListener/, "l'écouteur de la fenêtre passe par tenirLaBulle");
  assert.doesNotMatch(source, /aria-modal|aria-live|role\s*[:=]\s*["'](?:status|alert)/);
  assert.doesNotMatch(source, /\bdisabled\s*:/);
  assert.doesNotMatch(source, /anchor-name/);
  for (const code of [0xa0, 0x202f]) assert.equal(source.includes(String.fromCodePoint(code)), false, "aucune espace insécable");
  for (const code of [0x2715, 0x2013, 0x24d8, 0x21b6]) assert.equal(source.includes(String.fromCodePoint(code)), false, `U+${code.toString(16)} par son code`);
  assert.ok(source.includes(`"${"\\"}u2715"`), "✕ écrit par son code");
  assert.ok(source.includes(`"${"\\"}u2013"`), "« – » écrit par son code");
});
