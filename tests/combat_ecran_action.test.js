// Contrôles du contenu d'une action et de la zone sous la carte, au
// simulateur de combat (SPECIFICATION.md, § 17 et § 11, domaine « Combat » ;
// contrat du lot 4, groupe 2, § 8.1 à § 8.4, § 9.5 à § 9.7, § 14 É1) :
// js/ecrans/combat_action.js, dans le document simulé, sur des vues écrites
// à la main dans les formes du contrat. Trois d'entre elles (la liste, le jet
// payé, l'attaque du Chef) sont tenues à la forme de celles que rend
// vuePanneau au même moment du combat de référence : mêmes clés, sur deux
// niveaux (relecture du groupe 2, C-24).
//
// Le module ne porte aucune règle : ces contrôles vérifient qu'il montre ce
// que dit la vue, qu'il émet la commande que la vue lui donne avec son
// origine (« bulle » pour la bulle, « panneau » pour la zone), et qu'il lie
// chaque ligne, chaque passif et chaque nombre de causes à son infobulle.
// Chaque règle est vue des deux côtés : le bouton actif qui émet et
// l'inactif qui se tait, l'aperçu qu'un doigt ouvre et la souris qui joue,
// le corps refait quand ce qu'il montre change et gardé sinon.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutons, installerDom, texteDe } from "./outils/dom_simule.js";
import { vuePanneau } from "../js/combat/lecture.js";
import { scenario } from "./outils/combat_reference.js";
import { aubepineEssai, chefDePartieEssai, marmitonDeCorveeEssai } from "./outils/photographies_essai.js";
import { versContenu } from "./outils/scenario.js";

const { creer, composerListe, composerGeste } = await import("../js/ecrans/combat_action.js");

// ——— L'outillage ———

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const leBouton = (noeud, debut) => {
  const trouves = boutons(noeud, debut);
  assert.equal(trouves.length, 1, `un seul bouton « ${debut} », trouvé ${trouves.length}`);
  return trouves[0];
};
const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });
const capacite = (rang, facon) => ({ evenement: { type: "capacite", qui: "pj1", capacite: rang, facon } });
/** Un nœud dit par sa balise et ses classes ; un texte, tel quel. */
const forme = (n) => (typeof n === "string" ? n : `${n.tagName.toLowerCase()}.${n.className}`);
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
const FERMER = String.fromCodePoint(0x2715);
const REDUIRE = String.fromCodePoint(0x2013);
const SIGNE_DE_LA_CAUSE = String.fromCodePoint(0x24d8);

/**
 * Compose comme le fait la bulle (contrat, § 9.6) : un contexte r neuf, ou
 * celui qu'on lui passe en partie (sa mémoire, son focus), puis les nœuds
 * rendus, posés dans un lieu de la page. Relève ce que les nœuds demandent.
 */
function composer(fonction, vue, champs = {}) {
  const appels = [];
  const liens = [];
  const hachures = [];
  const gardes = [];
  const r = {
    actions: {
      executer: (commande, origine) => appels.push({ commande, origine }),
      lancerLeDe: () => appels.push({ de: true }),
      hachurer: (noms) => hachures.push(noms),
    },
    origine: "bulle",
    focus: vue.focus ?? null,
    garder: (cle) => gardes.push(cle),
    pose: false,
    compteur: 0,
    // L'identifiant de la raison doit être posé avant le lien : celui de l'infobulle vient après lui.
    lier: (declencheur, options) => liens.push({ declencheur, options, decrit: declencheur.getAttribute("aria-describedby") }),
    memoire: { reglagesOuverts: false, apercu: null, causesOuvertes: false },
    ...champs,
  };
  const noeuds = fonction(r, vue);
  const lieu = globalThis.document.createElement("div");
  lieu.append(...noeuds);
  globalThis.document.body.append(lieu);
  return { r, noeuds, lieu, appels, liens, hachures, gardes };
}

/** Joue un contrôle dans un document simulé neuf. */
function avecDom(faire) {
  const retirer = installerDom();
  try {
    faire();
  } finally {
    retirer();
  }
}

/** La zone sous la carte, dans le document simulé, sur un grand écran ou un téléphone (etroit). */
function monter({ etroit = false, avecCouche = true } = {}) {
  const retirer = installerDom();
  const appels = [];
  const liens = [];
  const hachures = [];
  const actions = {
    executer: (commande, origine) => appels.push({ commande, origine }),
    lancerLeDe: () => appels.push({ de: true }),
    hachurer: (noms) => hachures.push(noms),
  };
  let couche = null;
  if (avecCouche) {
    couche = globalThis.document.createElement("div");
    couche.className = "combat-infobulles";
  }
  const zone = creer(actions, { lier: (declencheur, options) => liens.push({ declencheur, options }), couche });
  globalThis.document.body.append(zone.noeud);
  const rendre = (vue, ecran = {}) => zone.rendre(vue, { etroit, ...ecran });
  return { ...zone, rendre, appels, liens, hachures, couche, retirer };
}

function avecLaZone(faire, options) {
  const monte = monter(options);
  try {
    faire(monte);
  } finally {
    monte.retirer();
  }
}

/** Le jet joué sous la carte, sur un téléphone : la zone montre composerGeste. */
const avecLeTelephone = (faire) => avecLaZone(faire, { etroit: true });

// ——— Les vues, écrites à la main dans les formes du contrat (§ 8.1 à § 8.4) ———

const PANNEAU_VIDE = { candidats: [], nom: null, entete: null, defenseur: null, fermeture: null, etapes: [], groupes: [], passer: null, passifs: [], geste: null, vainqueur: null, focus: null };

/** Le survol d'une ligne ou d'un passif (§ 8.2). */
const survolDe = (titre, champs = {}) => ({ titre, origine: null, description: "", portee: null, causes: [], cout: "Coût : 1 action, aucun souffle", hachures: [], ...champs });

const SOLO = { texte: "Solo du chef [1] : aucun allié de son camp sur sa case (A1) ; 1 avantage.", citation: "« Seul sur sa case : 1 avantage. »", sens: "avantage" };
const HORS_MAITRISE = {
  texte: "Frappe hors maîtrise : Frappe vient du Couteau d'office (précise), et aucune maîtrise de ce poids ne couvre sa place dans le bloc ; 1 désavantage.",
  citation: null,
  sens: "desavantage",
};

/** Une ligne (§ 8.2) : Frappe, au Couteau d'office, gratuite. */
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
    causes: [SOLO, HORS_MAITRISE],
    hachures: ["A1", "A2", "B1", "B2"],
  }),
  ...champs,
});

const LIGNES = {
  frappe: ligneVue(),
  emincer: ligneVue({ cle: "1:0", libelle: "Émincer", desavantage: true, cout: "5 souffle", commande: capacite(1, 0), jouer: "Jouer Émincer", survol: survolDe("Émincer", { origine: "Couteau d'office", cout: "Coût : 1 action, 5 souffle", hachures: ["A1", "B2"] }) }),
  fournaise1: ligneVue({ cle: "4:0", libelle: "Fournaise [1]", degats: null, cout: "1 souffle, 1 lien", commande: capacite(4, 0), jouer: "Jouer Fournaise [1]", survol: survolDe("Fournaise", { origine: "Saucier", portee: "Cible au choix, sans condition de portée", cout: "Coût : 1 action, 1 souffle, 1 lien" }) }),
  fournaise2: ligneVue({
    cle: "4:1",
    libelle: "Fournaise [2]",
    degats: null,
    cout: "2 souffle, 1 lien",
    actif: false,
    raison: "il manque du souffle (2)",
    commande: capacite(4, 1),
    jouer: "Jouer Fournaise [2]",
    survol: survolDe("Fournaise", { origine: "Saucier", description: "Une fournaise plus vive.", portee: "Cible au choix, sans condition de portée", cout: "Coût : 1 action, 2 souffle, 1 lien" }),
  }),
  dressage: ligneVue({ cle: "6:0", libelle: "Dressage minute", degats: null, intervention: true, cout: "1 souffle", commande: capacite(6, 0), jouer: "Jouer Dressage minute", survol: survolDe("Dressage minute", { origine: "Saucier", portee: "Cible au choix, sans condition de portée" }) }),
  pas1: ligneVue({ cle: "9:0", libelle: "Pas chassé [1]", degats: "1 case", commande: capacite(9, 0), jouer: "Jouer Pas chassé [1]", survol: survolDe("Pas chassé", { origine: "Gestes de cuisine", portee: "Arrivée : les cases à une distance de 1 à 1, hachurées sur la carte.", hachures: ["A2", "B1", "B2"] }) }),
  pas2: ligneVue({ cle: "9:1", libelle: "Pas chassé [2]", degats: "2 cases", cout: "2 souffle", commande: capacite(9, 1), jouer: "Jouer Pas chassé [2]", survol: survolDe("Pas chassé", { origine: "Gestes de cuisine", hachures: ["A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"] }) }),
  taloche: ligneVue({ cle: "15:0", libelle: "Taloche [1]", degats: "2/4/8", commande: capacite(15, 0), jouer: "Jouer Taloche [1]", survol: survolDe("Taloche", { origine: "Gestes de cuisine", portee: "Portée 0 : sa case seule, hachurée sur la carte.", hachures: ["A1"] }) }),
};
const CLES = ["0:0", "1:0", "4:0", "4:1", "6:0", "9:0", "9:1", "15:0"];

const PASSIFS = [
  { cle: "passif:3", libelle: "Réduction [1]", survol: survolDe("Réduction", { origine: "Saucier", description: "Retire 1 points d'armure par réussite.", cout: "Passif : ne se joue pas" }) },
  { cle: "passif:10", libelle: "Vif [1]", survol: survolDe("Vif", { origine: "Marmiton", description: "Ajoutez 1 aux jets d'agilité.", cout: "Passif : ne se joue pas" }) },
  { cle: "passif:12", libelle: "Solo du chef [1]", survol: survolDe("Solo du chef", { origine: "Saucier", description: "Seul sur sa case : 1 avantage.", cout: "Passif : ne se joue pas" }) },
];

const ACTION_EN_COURS = "Une action est en cours.";
/** Les six étapes du groupe 1, celle du jet nommée comme elle l'est pour qui la lance, et celle en cours. */
const etapesDuGroupe1 = (jet, enCours) =>
  ["Capacité", "Cible", jet, "Localisation", "Interventions", "Dégâts"].map((nom, rang) => ({ nom, etat: rang < enCours ? "faite" : rang === enCours ? "en_cours" : "a_venir" }));
/** Une ligne que le geste payé rend inactive (contrat, § 8.1). */
const enCours = (ligne, choisi = false) => ({ ...ligne, actif: false, raison: ACTION_EN_COURS, choisi });

/** La bulle sans geste (vue 1) : la liste d'Aubépine, juste après le lancement. */
const vueListe = (champs = {}) => ({
  genre: "action",
  candidats: [],
  nom: "Aubépine Crèmebrûlée : ses actions",
  entete: { titre: "Aubépine Crèmebrûlée", sous: "actions restantes : 2 sur 2 · souffle 10/10" },
  defenseur: null,
  fermeture: { genre: "fermer", libelle: "Fermer", commande: { choisir: null } },
  etapes: etapesDuGroupe1("Jet d'attaque", 0),
  groupes: [
    { titre: "Couteau d'office (précise)", lignes: [LIGNES.frappe, LIGNES.emincer] },
    { titre: "Saucier", lignes: [LIGNES.fournaise1, LIGNES.fournaise2, LIGNES.dressage] },
    { titre: "Gestes de cuisine", lignes: [LIGNES.pas1, LIGNES.pas2, LIGNES.taloche] },
  ],
  passer: { actif: true, raison: null, commande: { evenement: { type: "passer", qui: "pj1" } } },
  passifs: PASSIFS,
  geste: null,
  annonce: { pas: 1, texte: "Combat lancé : 1 personnage contre 3 adversaires. Les PJ commencent. — Tour 1 · camp des PJ —" },
  vainqueur: null,
  focus: "ligne:0:0",
  ...champs,
});

const CONTEXTE_NU = { de: null, detail: null, modificateurs: [], difficulte: null, causes: null, defense: null, reglages: null };
const CAUSES = { nombre: "1 avantage", nom: "1 avantage : voir la cause", phrases: [{ ...SOLO, texte: "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage." }], compte: null };
const DEFENSE = (choisie) => ({
  libelle: "Défense :",
  options: [
    ["lourde", "lourde"],
    ["agile", "agile"],
    ["precise", "précise"],
  ].map(([code, libelle]) => ({ code, libelle, choisie: code === choisie, commande: regler("defense", code) })),
});
const REGLAGES = {
  modificateur: { valeur: 0, raison: null, min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "modificateur" } } },
  avantages: { valeur: 1, raison: "Nez fin", min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "avantages" } } },
};

/** Le geste de la vue 2 bis : Aubépine, Taloche contre le Marmiton n° 2, 8 puis 3 sur son d8. */
const gesteVu = (champs = {}) => ({
  description: "Une taloche qui inflige 2/4/8.",
  jetPrete: null,
  armes: null,
  cibles: [{ id: "adv4", libelle: "Marmiton de corvée n° 2", choisie: true, actif: true, raison: null, commande: regler("cible", "adv4") }],
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
  lettres: [{ texte: "1 réussite : 2", atteinte: true }, { texte: "2 : 4" }, { texte: "3 : 8" }, { texte: "Réduction : +1 contre l'armure par réussite" }],
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
  ...champs,
});

/**
 * La bulle avec un geste payé (vue 2 bis), au point de la maquette : ses
 * lignes restent, inactives (« Une action est en cours. »), « Passer son
 * tour » aussi, et ses passifs.
 */
const vueJet = (champs = {}) => ({
  genre: "action",
  candidats: [],
  nom: "Aubépine Crèmebrûlée : ses actions",
  entete: { titre: "Taloche [1] contre Marmiton de corvée n° 2", sous: "Aubépine · dernière action · souffle 6/10" },
  defenseur: null,
  fermeture: { genre: "reduire", libelle: "Réduire", onglet: "Taloche [1] : rouvrir" },
  etapes: etapesDuGroupe1("Jet d'attaque", 2),
  groupes: vueListe().groupes.map((groupe) => ({ ...groupe, lignes: groupe.lignes.map((ligne) => enCours(ligne, ligne.cle === "15:0")) })),
  passer: { actif: false, raison: ACTION_EN_COURS, commande: { evenement: { type: "passer", qui: "pj1" } } },
  passifs: PASSIFS,
  geste: gesteVu(),
  annonce: { pas: 12, texte: "2e dé : 4, échec. Relancer ou garder ?" },
  vainqueur: null,
  focus: "choix:relancer",
  ...champs,
});

/**
 * Le Chef de partie attaque Aubépine : sa Frappe, après son premier dé. Le
 * jet est celui de qui se défend (« Jet de défense », lecture.js, etapesDe) ;
 * ses lignes, sous son arme puis sous « Capacités », inactives ; aucun
 * passif.
 */
const vueDeLAttaqueDuChef = (champs = {}) =>
  vueJet({
    nom: "Chef de partie : ses actions",
    entete: { titre: "Frappe contre Aubépine Crèmebrûlée", sous: "Chef · dernière action · souffle 6/7" },
    defenseur: "Aubépine lance sa défense · souffle 6/10",
    fermeture: { genre: "reduire", libelle: "Réduire", onglet: "Frappe : rouvrir" },
    etapes: etapesDuGroupe1("Jet de défense", 2),
    groupes: [
      {
        titre: "Spatule souple",
        lignes: [
          enCours(ligneVue({ commande: { evenement: { type: "capacite", qui: "adv2", capacite: 0, facon: 0 } }, survol: survolDe("Frappe", { origine: "Spatule souple" }) }), true),
          enCours(ligneVue({ cle: "1:0", libelle: "Moulinet farineux [1]", commande: { evenement: { type: "capacite", qui: "adv2", capacite: 1, facon: 0 } }, jouer: "Jouer Moulinet farineux [1]", survol: survolDe("Moulinet farineux", { origine: "Spatule souple" }) })),
        ],
      },
      {
        titre: "Capacités",
        lignes: [
          enCours({ ...LIGNES.pas1, cle: "2:0", commande: { evenement: { type: "capacite", qui: "adv2", capacite: 2, facon: 0 } }, survol: { ...LIGNES.pas1.survol, origine: null } }),
          enCours({ ...LIGNES.pas2, cle: "2:1", commande: { evenement: { type: "capacite", qui: "adv2", capacite: 2, facon: 1 } }, survol: { ...LIGNES.pas2.survol, origine: null } }),
        ],
      },
    ],
    passer: { actif: false, raison: ACTION_EN_COURS, commande: { evenement: { type: "passer", qui: "adv2" } } },
    passifs: [],
    annonce: { pas: 45, texte: "1er dé : 5, réussi." },
    ...champs,
  });

/** Une vue réduite à un geste, pour regarder une seule de ses parties. */
const vueDuGeste = (champs, autres = {}) =>
  vueJet({ geste: gesteVu({ contexte: null, chaine: [], bilan: null, lettres: [], choix: [], cibles: [], description: null, ...champs }), focus: null, annonce: null, ...autres });

const QUI_JOUE = {
  genre: "qui_joue",
  ...PANNEAU_VIDE,
  candidats: [
    { id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } },
    { id: "pj5", nom: "Aubépine Fleurdesel", commande: { choisir: "pj5" } },
  ],
  annonce: null,
  focus: "candidat:pj1",
};

// ——— Les vues écrites à la main, tenues à celles du moteur ———

const estObjet = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);
/** Les clés d'une vue sur deux niveaux : les siennes, puis celles de chaque objet qu'elle porte, et celles des éléments de chaque liste. */
function clesSurDeuxNiveaux(vue) {
  const cles = { "": Object.keys(vue).sort() };
  for (const [cle, valeur] of Object.entries(vue)) {
    if (Array.isArray(valeur)) cles[`${cle}[]`] = [...new Set(valeur.filter(estObjet).flatMap((element) => Object.keys(element)))].sort();
    else if (estObjet(valeur)) cles[cle] = Object.keys(valeur).sort();
  }
  return cles;
}

test("les vues — la liste, le jet payé et l'attaque du Chef, écrites à la main, ont les clés de vuePanneau sur deux niveaux, au même moment du combat de référence", () => {
  const photos = { "Aubépine Crèmebrûlée": aubepineEssai(), "Chef de partie": chefDePartieEssai(), "Marmiton de corvée": marmitonDeCorveeEssai() };
  const vueDuMoteur = (jusqua, choisi) => vuePanneau(versContenu(scenario, photos, { jusqua }).etat, choisi);
  for (const [quoi, ecrite, duMoteur] of [
    ["la liste d'Aubépine, au lancement", vueListe(), vueDuMoteur(0, "pj1")],
    ["Taloche [1] contre le Marmiton n° 2, après deux dés", vueJet(), vueDuMoteur({ geste: 7, des: 2 }, "pj1")],
    ["la Frappe du Chef contre Aubépine, après un dé", vueDeLAttaqueDuChef(), vueDuMoteur({ geste: 8, des: 1 }, "adv2")],
  ]) {
    assert.deepEqual(clesSurDeuxNiveaux(ecrite), clesSurDeuxNiveaux(duMoteur), quoi);
  }
  // Au même moment, les étapes : celles du groupe 1, et le jet de qui se défend quand un adversaire attaque.
  assert.deepEqual(vueDeLAttaqueDuChef().etapes, vueDuMoteur({ geste: 8, des: 1 }, "adv2").etapes);
  assert.deepEqual(vueListe().etapes, vueDuMoteur(0, "pj1").etapes);
});

// ——— a) La zone sous la carte ———

test("zone — une section nommée : son corps, la liste d'une case, la couche d'infobulles que l'écran lui donne ; la seule région polie, hors de la section ; créés une fois", () => {
  avecLaZone(({ noeud, rendre, listeDeCase, annonce, dire, couche }) => {
    assert.equal(noeud.tagName, "SECTION");
    assert.equal(noeud.className, "combat-action");
    assert.equal(noeud.getAttribute("aria-label"), "Action en cours");
    assert.deepEqual(noeud.children.map((enfant) => enfant.className), ["combat-action-corps", "combat-case-liste", "combat-infobulles"]);
    assert.equal(noeud.children[1], listeDeCase);
    assert.equal(noeud.children[2], couche, "la couche des infobulles de la zone est un enfant de la section");
    assert.equal(listeDeCase.childNodes.length, 0, "la liste d'une case est vide : c'est l'écran qui la remplit");
    assert.equal(annonce.className, "combat-annonce");
    assert.equal(annonce.parentNode, null, "c'est l'écran qui la pose dans la page, dès son premier rendu");
    assert.equal(annonce.childNodes.length, 0, "vide tant que rien n'est à dire");

    const [corps] = noeud.children;
    rendre(vueJet());
    rendre(QUI_JOUE);
    rendre(vueJet({ annonce: { pas: 13, texte: "1er dé : 9, réussi." } }), { etroit: true });
    assert.deepEqual(noeud.children, [corps, listeDeCase, couche], "les nœuds de la section ne sont jamais refaits");
    assert.equal(tous(noeud, "[aria-live]").length, 0, "aucune région dans la section");
    assert.equal(annonce.getAttribute("aria-live"), "polite");
    assert.equal(annonce.tagName, "P");
    assert.equal(annonce.textContent, "1er dé : 9, réussi.");
    assert.deepEqual(tous(noeud, "[role]").map((n) => n.getAttribute("role")).filter((role) => role !== "group"), [], "ni role=status ni role=alert dans la zone");
    assert.equal(listeDeCase.childNodes.length, 0, "un rendu ne touche pas la liste d'une case");

    // Ce que l'écran a à dire lui-même passe par la même région ; l'annonce suivante du combat le remplace, la même ne le redit pas.
    dire("Journal copié.");
    assert.equal(annonce.textContent, "Journal copié.");
    rendre(vueJet({ annonce: { pas: 13, texte: "1er dé : 9, réussi." } }));
    assert.equal(annonce.textContent, "Journal copié.", "le même pas ne se redit pas");
    rendre(vueJet({ annonce: { pas: 14, texte: "2e dé : 4, échec. Relancer ou garder ?" } }));
    assert.equal(annonce.textContent, "2e dé : 4, échec. Relancer ou garder ?");
    dire(`${String.fromCodePoint(0x202e)}Journal copié.`);
    assert.equal(annonce.textContent, "Journal copié.", "sans signe qui commande le sens");
  });
  // Sans couche, la section n'a que ses deux nœuds.
  avecLaZone(({ noeud, couche }) => {
    assert.equal(couche, null);
    assert.deepEqual(noeud.children.map((enfant) => enfant.className), ["combat-action-corps", "combat-case-liste"]);
  }, { avecCouche: false });
});

test("zone — « Qui joue ? » : un bouton par candidat, à son nom entier, qui émet « choisir » depuis la zone ; sans candidat, le titre seul ; de même sur un téléphone", () => {
  for (const etroit of [false, true]) {
    avecLaZone(({ noeud, rendre, appels }) => {
      rendre(QUI_JOUE);
      const titre = noeud.querySelector("h2.combat-qui");
      assert.equal(texteDe(titre), "Qui joue ?");
      assert.equal(titre.getAttribute("tabindex"), "-1");
      assert.deepEqual(tous(noeud, "button").map(texteDe), ["Aubépine Crèmebrûlée", "Aubépine Fleurdesel"]);
      assert.deepEqual(tous(noeud, ".combat-choix button").map((b) => b.className), ["bouton secondaire", "bouton secondaire"]);
      leBouton(noeud, "Aubépine Fleurdesel").click();
      assert.deepEqual(appels, [{ commande: { choisir: "pj5" }, origine: "panneau" }]);
      assert.equal(noeud.querySelector(".combat-etapes"), null);
      assert.equal(noeud.querySelector(".combat-action-phrase"), null);

      rendre({ ...QUI_JOUE, candidats: [], focus: null });
      assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Qui joue ?");
      assert.equal(tous(noeud, "button").length, 0);
    }, { etroit });
  }
});

test("zone — la fin du combat : la phrase du vainqueur, sans bouton ; la préparation : un corps vide", () => {
  for (const etroit of [false, true]) {
    avecLaZone(({ noeud, rendre }) => {
      rendre({ genre: "termine", ...PANNEAU_VIDE, vainqueur: "Combat terminé : victoire des PJ.", annonce: null });
      assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Combat terminé : victoire des PJ.");
      assert.equal(tous(noeud, "button").length, 0);
      rendre({ genre: "termine", ...PANNEAU_VIDE, vainqueur: "Combat terminé : victoire des adversaires.", annonce: null });
      assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Combat terminé : victoire des adversaires.");

      rendre({ genre: "preparation", ...PANNEAU_VIDE, annonce: null });
      assert.equal(noeud.querySelector(".combat-action-corps").childNodes.length, 0);
    }, { etroit });
  }
});

test("zone — sur un grand écran, pendant une action, la phrase seule : ni liste, ni jet, ni bouton ; elle ne se refait pas à chaque dé", () => {
  avecLaZone(({ noeud, rendre, liens, hachures }) => {
    const corps = noeud.querySelector(".combat-action-corps");
    assert.equal(rendre(vueListe()), true);
    assert.deepEqual(corps.children.map(forme), ["p.combat-action-phrase"]);
    assert.equal(texteDe(corps), "Le jet se joue dans la bulle, à côté des jetons.");
    const phrase = corps.children[0];

    // Le geste commence, un dé tombe, l'annonce change : rien ne se refait, rien ne se lie.
    assert.equal(rendre(vueJet()), false);
    assert.equal(rendre(vueJet({ geste: gesteVu({ bilan: "2 réussites." }), annonce: { pas: 13, texte: "3e dé : 7, réussi." } })), false);
    assert.equal(corps.children[0], phrase);
    assert.deepEqual(corps.children.map(forme), ["p.combat-action-phrase"]);
    assert.equal(tous(noeud, "button").length, 0);
    assert.equal(noeud.querySelector(".combat-groupe"), null);
    assert.equal(noeud.querySelector(".combat-des"), null);
    assert.equal(tous(noeud, "[data-focus]").length, 0, "rien à focaliser : le jet est dans la bulle");
    assert.deepEqual(liens, []);
    assert.deepEqual(hachures, []);

    // Un adversaire qui attaque : la même phrase.
    rendre(vueJet({ nom: "Chef de partie : ses actions", entete: { titre: "Frappe contre Aubépine Crèmebrûlée", sous: "Chef · dernière action · souffle 6/7" }, defenseur: "Aubépine lance sa défense · souffle 6/10" }));
    assert.deepEqual(corps.children.map(forme), ["p.combat-action-phrase"]);
  });
});

test("zone — sur un téléphone, le jet sous la carte : son titre, qui le joue, puis le jet ; ni ✕ ni « – » ; sans geste, un corps vide (le volet est ouvert)", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    const corps = noeud.querySelector(".combat-action-corps");
    assert.equal(rendre(vueJet()), true);
    const [titre, sous, ...jet] = corps.children;
    assert.equal(forme(titre), "h2.combat-qui");
    assert.equal(titre.getAttribute("tabindex"), "-1");
    assert.equal(titre.textContent, "Taloche [1] contre Marmiton de corvée n° 2");
    assert.equal(forme(sous), "p.combat-sous");
    assert.equal(sous.textContent, "Aubépine · dernière action · souffle 6/10");
    assert.deepEqual(jet.map(forme), ["ol.combat-etapes", "div.combat-cibles", "div.combat-des"], "le jet, tel que composerGeste le rend");
    // Rien qui ferme ou réduise : il n'y a rien à fermer sous la carte.
    const fermetures = tous(noeud, "button").filter((b) => [FERMER, REDUIRE].includes(texteDe(b)) || ["Fermer", "Réduire"].includes(b.getAttribute("aria-label")));
    assert.deepEqual(fermetures, []);
    assert.equal(noeud.querySelector(".combat-bulle-fermer"), null);
    assert.equal(noeud.textContent.includes("Taloche [1] : rouvrir"), false);
    assert.equal(noeud.querySelector(".combat-action-phrase"), null);
    // Ses commandes partent de la zone.
    leBouton(noeud, "Garder ce dé").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "garder" } }, origine: "panneau" }]);

    // Un adversaire attaque : son en-tête, et qui se défend sous les étapes ; le jet est celui de la défense.
    rendre(vueDeLAttaqueDuChef());
    assert.deepEqual(corps.children.slice(0, 4).map((n) => [forme(n), n.textContent]), [
      ["h2.combat-qui", "Frappe contre Aubépine Crèmebrûlée"],
      ["p.combat-sous", "Chef · dernière action · souffle 6/7"],
      ["ol.combat-etapes", "CapacitéCibleJet de défenseLocalisationInterventionsDégâts"],
      ["p.combat-defenseur", "Aubépine lance sa défense · souffle 6/10"],
    ]);

    // Sans geste, la liste est dans le volet : la zone est vide.
    assert.equal(rendre(vueListe()), true);
    assert.equal(corps.childNodes.length, 0);
    assert.equal(rendre(vueListe()), false);
    // Le même jet, sur un grand écran : la phrase ; revenu au téléphone : le jet.
    rendre(vueJet(), { etroit: false });
    assert.deepEqual(corps.children.map(forme), ["p.combat-action-phrase"]);
    assert.equal(rendre(vueJet()), true);
    assert.equal(forme(corps.children[0]), "h2.combat-qui");
  });
});

test("zone — le corps n'est refait que si ce qu'il montre change ; une saisie en cours survit à un rendu de plus", () => {
  avecLeTelephone(({ noeud, rendre }) => {
    assert.equal(rendre(vueJet()), true);
    const relancer = leBouton(noeud, "Relancer le 2e dé");
    const titre = noeud.querySelector("h2.combat-qui");

    // La même vue, refabriquée (un rendu de plus quand l'enregistrement finit) : rien ne bouge.
    assert.equal(rendre(vueJet()), false);
    assert.equal(leBouton(noeud, "Relancer le 2e dé"), relancer);
    assert.equal(noeud.querySelector("h2.combat-qui"), titre);
    // Une annonce de plus ne refait pas le corps.
    assert.equal(rendre(vueJet({ annonce: { pas: 13, texte: "Le dé explose : 6 plus 3, 9, réussi." } })), false);
    assert.equal(leBouton(noeud, "Relancer le 2e dé"), relancer);

    // Une saisie en cours survit à un rendu sans changement.
    const avecX = vueDuGeste({ x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } });
    rendre(avecX);
    noeud.querySelector("input[type=number]").value = "4";
    rendre(structuredClone(avecX));
    assert.equal(noeud.querySelector("input[type=number]").value, "4");

    // La vue change (un dé de plus) : le corps est refait.
    rendre(vueJet());
    const avant = leBouton(noeud, "Relancer le 2e dé");
    assert.equal(rendre(vueJet({ geste: gesteVu({ bilan: "2 réussites." }) })), true);
    assert.notEqual(leBouton(noeud, "Relancer le 2e dé"), avant);
    assert.equal(avant.isConnected, false);
    assert.equal(texteDe(noeud.querySelector("p.combat-bilan")), "2 réussites.");

    // L'origine de la cible change seule : le corps est refait aussi.
    const deux = vueJet({ geste: gesteVu({ bilan: "2 réussites." }) });
    assert.equal(rendre(deux, { origineDeLaCible: "plateau" }), true);
    assert.equal(rendre(deux, { origineDeLaCible: "plateau" }), false);
    assert.equal(rendre(deux, { origineDeLaCible: "panneau" }), true);
  });
});

test("zone — l'annonce s'écrit quand son pas change, et alors seulement", () => {
  avecLeTelephone(({ noeud, rendre, annonce }) => {
    assert.equal(annonce.childNodes.length, 0);
    rendre(vueJet());
    assert.equal(annonce.textContent, "2e dé : 4, échec. Relancer ou garder ?");
    const ecrit = annonce.childNodes[0];

    // Le même pas, même avec une vue qui change : la région ne bouge pas (elle ne serait pas redite).
    rendre(vueJet({ entete: { titre: "Taloche [1] contre Marmiton de corvée n° 2", sous: "Aubépine · dernière action · souffle 5/10" } }));
    assert.equal(annonce.childNodes[0], ecrit);
    // Le pas change : le texte s'écrit, même s'il est le même mot pour mot (deux dés de suite au même résultat).
    rendre(vueJet({ annonce: { pas: 13, texte: "2e dé : 4, échec. Relancer ou garder ?" } }));
    assert.notEqual(annonce.childNodes[0], ecrit);
    assert.equal(annonce.textContent, "2e dé : 4, échec. Relancer ou garder ?");
    // Sur un grand écran aussi, quand le corps ne se refait pas.
    rendre(vueJet({ annonce: { pas: 14, texte: "1er dé : 9, réussi." } }), { etroit: false });
    assert.equal(annonce.textContent, "1er dé : 9, réussi.");
    rendre(vueJet({ annonce: { pas: 15, texte: "2e dé : 8, réussi." } }), { etroit: false });
    assert.equal(annonce.textContent, "2e dé : 8, réussi.");

    // Sans annonce (un combat neuf), la région se vide ; le même pas, ensuite, se redit.
    rendre(vueJet({ annonce: null }));
    assert.equal(annonce.childNodes.length, 0);
    rendre(vueJet({ annonce: { pas: 15, texte: "1er dé : 9, réussi." } }));
    assert.equal(annonce.textContent, "1er dé : 9, réussi.");

    // Le bilan visible n'est pas dans la région, et la région n'est pas dans le corps refait.
    assert.equal(annonce.querySelector(".combat-bilan"), null);
    assert.equal(noeud.querySelector(".combat-annonce"), null, "ni dans le corps refait, ni dans la section");
  });
});

test("zone — data-focus désigne la commande qui attend, et elle seule ; à défaut, le titre", () => {
  avecLeTelephone(({ noeud, rendre }) => {
    const marques = () => tous(noeud, "[data-focus]").map((n) => [n.tagName, n.getAttribute("data-focus"), texteDe(n)]);
    rendre(vueJet());
    assert.deepEqual(marques(), [["BUTTON", "choix:relancer", "Relancer le 2e dé"]]);
    rendre(vueJet({ focus: "choix:garder" }));
    assert.deepEqual(marques(), [["BUTTON", "choix:garder", "Garder ce dé"]]);
    rendre(vueJet({ focus: "cible:adv4" }));
    assert.deepEqual(marques(), [["BUTTON", "cible:adv4", "Marmiton de corvée n° 2"]]);

    // Une saisie : c'est son champ qui reçoit le focus.
    rendre(vueDuGeste({ x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } }, { focus: "x" }));
    assert.deepEqual(tous(noeud, "[data-focus]").map((n) => [n.tagName, n.getAttribute("type")]), [["INPUT", "number"]]);

    // Rien n'attend, ou une clé que la zone ne montre pas : le titre, qui peut recevoir le focus.
    for (const focus of [null, "choix:exploser"]) {
      rendre(vueJet({ focus }));
      assert.deepEqual(marques(), [["H2", "titre", "Taloche [1] contre Marmiton de corvée n° 2"]]);
      assert.equal(noeud.querySelector("h2.combat-qui").getAttribute("tabindex"), "-1");
    }
    rendre(QUI_JOUE);
    assert.deepEqual(marques(), [["BUTTON", "candidat:pj1", "Aubépine Crèmebrûlée"]]);
    rendre({ ...QUI_JOUE, focus: null });
    assert.deepEqual(marques(), [["H2", "titre", "Qui joue ?"]]);
    rendre({ genre: "termine", ...PANNEAU_VIDE, vainqueur: "Combat terminé : victoire des PJ.", annonce: null });
    assert.deepEqual(marques(), [["H2", "titre", "Combat terminé : victoire des PJ."]]);
  });
});

test("zone — un réglage qui ne fait pas avancer le geste garde le focus : une caractéristique, la défense ; tout autre le rend à la commande qui attend", () => {
  const retirer = installerDom();
  try {
    // L'écran redessine pendant « executer » : c'est là que la zone apprend où poser le focus.
    let suivante = null;
    const zone = creer({
      executer: () => {
        if (suivante !== null) zone.rendre(suivante, { etroit: true });
      },
      lancerLeDe: () => {},
      hachurer: () => {},
    });
    globalThis.document.body.append(zone.noeud);
    const marques = () => tous(zone.noeud, "[data-focus]").map((n) => n.getAttribute("data-focus"));
    const options = [{ code: "force", nom: "Force", valeur: 4 }, { code: "agilite", nom: "Agilité", valeur: 5 }];
    const cible = { id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: false, actif: true, raison: null, commande: regler("cible", "adv3") };
    const avec = (choisies, defense, autres = {}) =>
      vueDuGeste(
        {
          caracteristiques: { choisies, de: "d8", gabarit: { evenement: { type: "regler", champ: "caracteristiques" } }, options },
          cibles: [cible],
          contexte: { ...CONTEXTE_NU, defense: DEFENSE(defense) },
        },
        { focus: "cible:adv3", ...autres },
      );
    const caracteristique = (nom) => leBouton(zone.noeud.querySelector(".combat-caracteristiques"), nom);
    const liste = () => zone.noeud.querySelector(".combat-defense select");

    zone.rendre(avec(["force"], "lourde"), { etroit: true });
    assert.deepEqual(marques(), ["cible:adv3"], "la commande qui attend, tant que rien n'est actionné");

    // Une caractéristique de plus : la commande qui attend reste la cible, mais on y revient d'un geste.
    suivante = avec(["force", "agilite"], "lourde");
    caracteristique("Agilité").click();
    assert.deepEqual(marques(), ["caracteristique:agilite"]);
    assert.equal(caracteristique("Agilité").getAttribute("aria-pressed"), "true");
    // Un rendu de plus, sans geste de la personne : le focus désigné redevient celui de la vue.
    zone.rendre(avec(["force"], "lourde"), { etroit: true });
    assert.deepEqual(marques(), ["cible:adv3"]);

    // La défense : le choix fait, le focus reste sur la liste.
    suivante = avec(["force"], "agile");
    liste().value = "agile";
    liste().declencher("change");
    assert.deepEqual(marques(), ["defense"]);
    assert.equal(liste().value, "agile");

    // Tout autre réglage rend le focus à la commande qui attend : choisir la cible mène au dé.
    suivante = avec(["force"], "agile", { focus: "caracteristique:force" });
    leBouton(zone.noeud.querySelector(".combat-cibles"), "Marmiton").click();
    assert.deepEqual(marques(), ["caracteristique:force"], "la clé de la vue, non celle du bouton actionné");

    // Refusé, l'écran ne redessine pas : rien ne bouge, et la clé ne passe pas au rendu suivant.
    suivante = null;
    caracteristique("Agilité").click();
    assert.deepEqual(marques(), ["caracteristique:force"]);
    zone.rendre(avec(["agilite"], "lourde"), { etroit: true });
    assert.deepEqual(marques(), ["cible:adv3"]);

    // Le bouton actionné n'est plus dans le corps refait : la commande qui attend, comme toujours.
    suivante = vueDuGeste({ cibles: [cible] }, { focus: "cible:adv3" });
    caracteristique("Force").click();
    assert.deepEqual(marques(), ["cible:adv3"]);
  } finally {
    retirer();
  }
});

test("zone — sa mémoire (réglages dépliés, explication des causes) tient le temps du geste et retombe quand il change ; un corps refait vide la couche et efface les hachures", () => {
  avecLeTelephone(({ noeud, rendre, hachures, couche }) => {
    const avecReglages = (bilan, autres = {}) => vueJet({ geste: gesteVu({ bilan, contexte: { ...gesteVu().contexte, reglages: REGLAGES } }), ...autres });
    const details = () => noeud.querySelector("details.combat-reglages");
    const cause = () => noeud.querySelector("button.combat-cause");

    rendre(avecReglages("Avant le premier dé."));
    assert.equal(details().hasAttribute("open"), false, "repliés");
    details().setAttribute("open", "");
    details().declencher("toggle");
    appuyer(cause(), "touch");
    assert.equal(cause().getAttribute("aria-expanded"), "true");

    // Le corps refait, dans le même geste : dépliés, l'explication montrée.
    assert.equal(rendre(avecReglages("Toujours avant le premier dé.")), true);
    assert.equal(details().hasAttribute("open"), true);
    assert.equal(cause().getAttribute("aria-expanded"), "true");
    assert.equal(noeud.querySelector(".combat-cause-explication").hidden, false);

    // Ce que la couche porte part avec le corps d'avant ; les hachures aussi.
    couche.append(globalThis.document.createElement("div"));
    hachures.length = 0;
    rendre(avecReglages("Encore avant le premier dé."));
    assert.equal(couche.childNodes.length, 0, "les infobulles du corps d'avant ne restent pas");
    assert.deepEqual(hachures, [null]);

    // Le geste finit (la liste revient) : la mémoire retombe.
    rendre(vueListe());
    rendre(avecReglages("Un autre geste."));
    assert.equal(details().hasAttribute("open"), false);
    assert.equal(cause().getAttribute("aria-expanded"), "false");
    assert.equal(noeud.querySelector(".combat-cause-explication").hidden, true);

    // Un autre protagoniste : de même.
    details().setAttribute("open", "");
    details().declencher("toggle");
    rendre(avecReglages("Le Chef joue.", { nom: "Chef de partie : ses actions", entete: { titre: "Frappe contre Aubépine Crèmebrûlée", sous: "Chef · dernière action · souffle 6/7" } }));
    assert.equal(details().hasAttribute("open"), false);
  });
});

test("zone — deux zones ne se mêlent pas ; la bulle et la zone, dans la page en même temps, n'ont aucun identifiant en commun", () => {
  avecDom(() => {
    const appelsA = [];
    const appelsB = [];
    const a = creer({ executer: (commande) => appelsA.push(commande), lancerLeDe: () => {}, hachurer: () => {} });
    const b = creer({ executer: (commande) => appelsB.push(commande), lancerLeDe: () => {}, hachurer: () => {} });
    globalThis.document.body.append(a.noeud, b.noeud);
    a.rendre(vueJet(), { etroit: true });
    b.rendre(vueListe(), { etroit: true });
    leBouton(a.noeud, "Garder ce dé").click();
    assert.equal(appelsA.length, 1);
    assert.equal(appelsB.length, 0);
    assert.equal(b.noeud.querySelector(".combat-des"), null);
    assert.notEqual(a.listeDeCase, b.listeDeCase);
    assert.notEqual(a.annonce, b.annonce);

    // Sur un téléphone, la zone montre le jet pendant que la bulle, cachée, garde sa liste.
    const geste = vueDuGeste({
      x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } },
      cibles: [{ id: "adv2", libelle: "Chef de partie", choisie: false, actif: false, raison: "hors de portée", commande: regler("cible", "adv2") }],
    });
    a.rendre(geste, { etroit: true });
    composer(composerListe, vueListe());
    const ids = tous(globalThis.document.body, "[id]").map((n) => n.id);
    assert.equal(ids.length, 4, "trois dans la zone (une raison, une rangée, un refus), une dans la bulle (une raison)");
    assert.equal(new Set(ids).size, ids.length, `aucun identifiant en double : ${ids.join(", ")}`);
  });
});

// ——— b) La liste ———

test("liste — des nœuds sans en-tête ni conteneur : un groupe par origine sous son intitulé, une ligne par capacité et par puissance, dans l'ordre de la vue", () => {
  avecDom(() => {
    const { noeuds, lieu } = composer(composerListe, vueListe());
    assert.deepEqual(noeuds.map(forme), ["div.combat-groupe", "div.combat-groupe", "div.combat-groupe", "p.combat-bulle-pied", "div."]);
    assert.equal(tous(lieu, "h2").length, 0, "l'en-tête est celui de la bulle");
    assert.deepEqual(noeuds.slice(0, 3).map((groupe) => texteDe(groupe.children[0])), ["Couteau d'office (précise)", "Saucier", "Gestes de cuisine"]);
    assert.deepEqual(noeuds.slice(0, 3).map((groupe) => forme(groupe.children[0])), ["h3.combat-groupe-titre", "h3.combat-groupe-titre", "h3.combat-groupe-titre"]);
    // Chaque ligne a sa place : div.combat-option > button.combat-capacite[data-ligne].
    const lignes = tous(lieu, "button.combat-capacite").filter((b) => b.hasAttribute("data-ligne"));
    assert.deepEqual(lignes.map((b) => b.getAttribute("data-ligne")), CLES);
    for (const ligne of lignes) {
      assert.equal(forme(ligne.parentNode), "div.combat-option");
      assert.equal(ligne.parentNode.children[0], ligne);
      assert.equal(ligne.getAttribute("type"), "button");
    }
    // Une ligne par puissance : deux pour Fournaise, deux pour Pas chassé.
    assert.deepEqual(lignes.map((b) => b.children[0].textContent), ["Frappe", "Émincer", "Fournaise [1]", "Fournaise [2]", "Dressage minute", "Pas chassé [1]", "Pas chassé [2]", "Taloche [1]"]);
  });
});

test("liste — une ligne porte son libellé, ses dégâts (ou ses cases), « désavantage », « intervention » et son coût, séparés d'une espace, et rien de ce que la vue ne dit pas ; un clic la joue depuis la bulle", () => {
  avecDom(() => {
    const goûter = ligneVue({ cle: "14:0", libelle: "Goûter", degats: null, cout: null, commande: capacite(14, 0), jouer: "Jouer Goûter", survol: survolDe("Goûter") });
    const vue = vueListe();
    vue.groupes[2] = { ...vue.groupes[2], lignes: [...vue.groupes[2].lignes, goûter] };
    const { lieu, appels } = composer(composerListe, vue);
    const textes = Object.fromEntries([...CLES, "14:0"].map((cle) => [cle, laLigne(lieu, cle).textContent]));
    assert.deepEqual(textes, {
      "0:0": "Frappe 3/8/20 gratuit",
      "1:0": "Émincer 3/8/20 désavantage 5 souffle",
      "4:0": "Fournaise [1] 1 souffle, 1 lien",
      "4:1": "Fournaise [2] 2 souffle, 1 lien",
      "6:0": "Dressage minute intervention 1 souffle",
      "9:0": "Pas chassé [1] 1 case gratuit",
      "9:1": "Pas chassé [2] 2 cases 2 souffle",
      "15:0": "Taloche [1] 2/4/8 gratuit",
      "14:0": "Goûter",
    });
    // Les parties, chacune dans sa classe, une espace entre elles : sans elle, le nom se lirait d'un seul tenant.
    const emincer = laLigne(lieu, "1:0");
    assert.deepEqual(emincer.childNodes.map((n) => (typeof n.tagName === "string" ? forme(n) : JSON.stringify(n.textContent))), ["span.", '" "', "span.combat-degats", '" "', "span.combat-desavantage", '" "', "span.combat-cout"]);
    assert.equal(texteDe(emincer.querySelector(".combat-desavantage")), "désavantage");
    assert.deepEqual(tous(laLigne(lieu, "6:0"), "span").map(forme), ["span.", "span.combat-intervention", "span.combat-cout"]);
    assert.equal(texteDe(laLigne(lieu, "6:0").querySelector(".combat-intervention")), "intervention");
    assert.deepEqual(tous(laLigne(lieu, "9:0"), "span").map((s) => [forme(s), s.textContent]), [["span.", "Pas chassé [1]"], ["span.combat-degats", "1 case"], ["span.combat-cout", "gratuit"]]);
    // Ni dégâts pour ce qui n'en a pas, ni coût illisible, ni « désavantage » absent.
    const goute = laLigne(lieu, "14:0");
    assert.deepEqual(tous(goute, "span").map(forme), ["span."]);

    laLigne(lieu, "1:0").click();
    assert.deepEqual(appels, [{ commande: capacite(1, 0), origine: "bulle" }]);
  });
});

test("liste — une ligne inactive reste dans la liste : aria-disabled, jamais disabled, sa raison liée juste après elle, avant le lien de son infobulle ; elle ne fait rien", () => {
  avecDom(() => {
    const { lieu, appels, liens } = composer(composerListe, vueListe());
    const fournaise = laLigne(lieu, "4:1");
    assert.equal(fournaise.getAttribute("aria-disabled"), "true");
    assert.equal(fournaise.disabled, false, "aria-disabled, jamais disabled : la ligne garde le focus");
    const raison = lieu.querySelector(`#${fournaise.getAttribute("aria-describedby")}`);
    assert.equal(forme(raison), "span.combat-raison");
    assert.equal(raison.textContent, "il manque du souffle (2)");
    assert.equal(fournaise.parentNode.children[1], raison, "juste après la ligne, dans sa place");
    assert.equal(liens.find((lien) => lien.declencheur === fournaise).decrit, raison.id, "la raison est liée avant l'infobulle, qui vient après elle");
    fournaise.click();
    appuyer(fournaise, "mouse");
    assert.deepEqual(appels, [], "une ligne inactive ne fait rien, même cliquée");

    const frappe = laLigne(lieu, "0:0");
    assert.equal(frappe.hasAttribute("aria-disabled"), false);
    assert.equal(frappe.hasAttribute("aria-describedby"), false);
    assert.equal(frappe.parentNode.children.length, 1);
    assert.equal(tous(lieu, "button[disabled]").length, 0);
  });
});

test("liste — ni + ni −, ni titre à tiret, ni « Interventions : » : la puissance est une ligne", () => {
  avecDom(() => {
    const { lieu } = composer(composerListe, vueListe());
    assert.deepEqual(tous(lieu, "button").filter((b) => ["+", "−", "-"].includes(texteDe(b))), []);
    assert.equal(lieu.textContent.includes(" — "), false);
    assert.equal(lieu.textContent.includes("Interventions :"), false);
    for (const classe of ["combat-puissance", "combat-passifs", "combat-qui-suite", "bouton-pas"]) assert.equal(lieu.querySelector(`.${classe}`), null, classe);
  });
});

test("liste — « Passer son tour » ferme le dernier groupe ; il émet « passer », ou dit pourquoi il ne le peut pas ; sans groupe, il reste", () => {
  avecDom(() => {
    const { lieu, appels } = composer(composerListe, vueListe());
    const groupes = tous(lieu, ".combat-groupe");
    assert.equal(texteDe(tous(groupes.at(-1), "button").at(-1)), "Passer son tour");
    assert.equal(boutons(groupes[0], "Passer").length, 0);
    const passer = leBouton(lieu, "Passer son tour");
    assert.equal(forme(passer), "button.combat-capacite");
    assert.equal(forme(passer.parentNode), "div.combat-option");
    passer.click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "passer", qui: "pj1" } }, origine: "bulle" }]);
  });
  avecDom(() => {
    const { lieu } = composer(composerListe, vueListe({ groupes: [] }));
    assert.equal(forme(leBouton(lieu, "Passer son tour").parentNode.parentNode), "div.combat-groupe");
  });
  avecDom(() => {
    const { lieu, appels } = composer(composerListe, vueListe({ passer: { actif: false, raison: "Une action est en cours.", commande: { evenement: { type: "passer", qui: "pj1" } } } }));
    const passer = leBouton(lieu, "Passer son tour");
    assert.equal(passer.getAttribute("aria-disabled"), "true");
    assert.equal(lieu.querySelector(`#${passer.getAttribute("aria-describedby")}`).textContent, "Une action est en cours.");
    passer.click();
    assert.deepEqual(appels, []);
  });
  avecDom(() => {
    const { lieu } = composer(composerListe, vueListe({ passer: null }));
    assert.equal(boutons(lieu, "Passer").length, 0);
  });
});

test("liste — chaque ligne est liée à son infobulle, avec ses hachures ; « Passer son tour » n'en a pas", () => {
  avecDom(() => {
    const { lieu, liens } = composer(composerListe, vueListe());
    const deLignes = liens.filter((lien) => lien.declencheur.hasAttribute("data-ligne"));
    assert.deepEqual(deLignes.map((lien) => lien.declencheur.getAttribute("data-ligne")), CLES, "une infobulle par ligne, dans l'ordre");
    const parCle = Object.fromEntries(Object.values(LIGNES).map((ligne) => [ligne.cle, ligne]));
    for (const lien of deLignes) {
      const ligne = parCle[lien.declencheur.getAttribute("data-ligne")];
      assert.equal(typeof lien.options.contenu, "function", ligne.cle);
      assert.deepEqual(lien.options.hachures, ligne.survol.hachures, ligne.cle);
      assert.equal(lien.options.cotes, null, "la bulle choisit les côtés d'une ligne");
    }
    assert.equal(liens.some((lien) => lien.declencheur === leBouton(lieu, "Passer son tour")), false);
  });
});

test("liste — les passifs en pied : « Passifs : » puis chacun, focalisable, séparés par une virgule, liés à leur infobulle sans hachure", () => {
  avecDom(() => {
    const { lieu, liens } = composer(composerListe, vueListe());
    const pied = lieu.querySelector("p.combat-bulle-pied");
    assert.equal(forme(pied.childNodes[0]), "b.");
    assert.equal(pied.childNodes[0].textContent, "Passifs :");
    assert.equal(pied.textContent, "Passifs : Réduction [1], Vif [1], Solo du chef [1]");
    const passifs = tous(pied, "span.combat-passif");
    assert.deepEqual(passifs.map((p) => [p.textContent, p.getAttribute("tabindex")]), [["Réduction [1]", "0"], ["Vif [1]", "0"], ["Solo du chef [1]", "0"]]);
    assert.equal(tous(pied, "button").length, 0, "un passif ne se joue pas");
    const lies = liens.filter((lien) => passifs.includes(lien.declencheur));
    assert.deepEqual(lies.map((lien) => lien.declencheur), passifs, "chaque passif est lié à son infobulle");
    for (const lien of lies) {
      assert.equal(lien.options.hachures, null, "sans hachure");
      assert.equal(typeof lien.options.contenu, "function");
    }
    assert.deepEqual(lies[1].options.contenu().map(forme), ["b.combat-infobulle-titre", " · ", "span.combat-sous", "p.", "p.combat-infobulle-cout"]);
    assert.equal(lies[1].options.contenu().at(-1).textContent, "Passif : ne se joue pas");
  });
  avecDom(() => {
    const { noeuds, lieu } = composer(composerListe, vueListe({ passifs: [] }));
    assert.equal(lieu.querySelector(".combat-bulle-pied"), null);
    assert.equal(noeuds.length, 3, "les groupes seuls");
  });
});

test("liste — le contenu d'une infobulle : le titre et son origine, la description, la portée, chaque cause et sa citation, le coût ; ce qui est vide n'a pas de paragraphe", () => {
  avecDom(() => {
    const { liens } = composer(composerListe, vueListe());
    const contenu = (cle) => liens.find((lien) => lien.declencheur.getAttribute("data-ligne") === cle).options.contenu();
    const frappe = contenu("0:0");
    assert.deepEqual(frappe.map(forme), ["b.combat-infobulle-titre", " · ", "span.combat-sous", "p.", "p.", "p.combat-cause-avantage", "p.combat-cause-desavantage", "p.combat-infobulle-cout"]);
    assert.deepEqual(frappe.map((n) => (typeof n === "string" ? n : n.textContent)), [
      "Frappe",
      " · ",
      "Couteau d'office",
      "Une attaque qui inflige 3/8/20.",
      "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte.",
      "Solo du chef [1] : aucun allié de son camp sur sa case (A1) ; 1 avantage. « Seul sur sa case : 1 avantage. »",
      HORS_MAITRISE.texte,
      "Coût : 1 action, aucun souffle",
    ]);
    // La citation suit sa phrase, dans le même paragraphe, après une espace.
    const solo = frappe[5];
    assert.deepEqual(solo.childNodes.map((n) => (typeof n.tagName === "string" ? forme(n) : n.textContent)), [SOLO.texte, " ", "span.combat-citation"]);
    assert.equal(solo.querySelector(".combat-citation").textContent, "« Seul sur sa case : 1 avantage. »");
    assert.equal(frappe[6].querySelector(".combat-citation"), null, "sans citation, rien");
    // Chaque appel fabrique des nœuds neufs : l'infobulle ne prend pas ceux de la liste.
    assert.notEqual(contenu("0:0")[0], frappe[0]);

    // Sans description ni portée, ni cause : le titre, son origine, le coût.
    assert.deepEqual(contenu("1:0").map(forme), ["b.combat-infobulle-titre", " · ", "span.combat-sous", "p.combat-infobulle-cout"]);
    assert.deepEqual(contenu("4:0").map((n) => (typeof n === "string" ? n : n.textContent)), ["Fournaise", " · ", "Saucier", "Cible au choix, sans condition de portée", "Coût : 1 action, 1 souffle, 1 lien"]);
  });
  // Sans origine (un adversaire dont la façon n'a pas de libellé) : ni « · », ni origine.
  avecDom(() => {
    const vue = vueListe({ groupes: [{ titre: "Gestes", lignes: [ligneVue({ survol: survolDe("Pas chassé", { origine: null, portee: "Sans cible", cout: "Coût : 1 action, aucun souffle" }) })] }], passifs: [] });
    const { liens } = composer(composerListe, vue);
    assert.deepEqual(liens[0].options.contenu().map((n) => (typeof n === "string" ? n : `${forme(n)}=${n.textContent}`)), ["b.combat-infobulle-titre=Pas chassé", "p.=Sans cible", "p.combat-infobulle-cout=Coût : 1 action, aucun souffle"]);
  });
});

test("liste — data-focus : la ligne que nomme la vue, et elle seule ; « Passer son tour » ; rien sinon", () => {
  avecDom(() => {
    const marques = (lieu) => tous(lieu, "[data-focus]").map((n) => [n.getAttribute("data-focus"), texteDe(n.children[0] ?? n)]);
    let compose = composer(composerListe, vueListe());
    assert.deepEqual(marques(compose.lieu), [["ligne:0:0", "Frappe"]]);
    assert.equal(compose.r.pose, true, "la bulle sait qu'une commande attend");
    compose = composer(composerListe, vueListe({ focus: "ligne:9:1" }));
    assert.deepEqual(marques(compose.lieu), [["ligne:9:1", "Pas chassé [2]"]]);
    compose = composer(composerListe, vueListe({ focus: "passer" }));
    assert.deepEqual(tous(compose.lieu, "[data-focus]").map((n) => texteDe(n)), ["Passer son tour"]);
    compose = composer(composerListe, vueListe({ focus: null }));
    assert.deepEqual(marques(compose.lieu), []);
    assert.equal(compose.r.pose, false);
  });
});

// ——— c) L'aperçu, au doigt ———

test("aperçu — au doigt, un premier appui ouvre l'aperçu sous la ligne, sans rien émettre, avec ses hachures ; un second appui joue", () => {
  avecDom(() => {
    const { lieu, appels, hachures, r } = composer(composerListe, vueListe());
    const frappe = laLigne(lieu, "0:0");
    appuyer(frappe, "touch");
    assert.deepEqual(appels, [], "le premier appui n'émet rien");
    const apercu = lieu.querySelector(".combat-apercu");
    assert.equal(forme(apercu), "div.combat-apercu");
    assert.equal(apercu.parentNode, frappe.parentNode, "sous la ligne, dans sa place");
    assert.deepEqual(frappe.parentNode.children, [frappe, apercu]);
    assert.deepEqual(apercu.children.map((n) => [forme(n), n.textContent]), [
      ["p.", "Une attaque qui inflige 3/8/20."],
      ["p.", "Portée 1 : sa case et les huit cases voisines, hachurées sur la carte."],
      ["p.combat-cause-avantage", "Solo du chef [1] : aucun allié de son camp sur sa case (A1) ; 1 avantage. « Seul sur sa case : 1 avantage. »"],
      ["p.combat-cause-desavantage", HORS_MAITRISE.texte],
      ["button.bouton", "Jouer Frappe"],
    ]);
    assert.deepEqual(hachures, [["A1", "A2", "B1", "B2"]], "ses hachures tiennent tant qu'il est ouvert");
    assert.equal(r.memoire.apercu, "0:0");

    // Le second appui sur la même ligne la joue.
    appuyer(frappe, "touch");
    assert.deepEqual(appels, [{ commande: capacite(0, 0), origine: "bulle" }]);
  });
});

test("aperçu — « Jouer Frappe » joue ; Entrée joue toujours, même après un appui du doigt ; la souris joue d'emblée", () => {
  avecDom(() => {
    const { lieu, appels } = composer(composerListe, vueListe());
    appuyer(laLigne(lieu, "0:0"), "touch");
    leBouton(lieu, "Jouer Frappe").click();
    assert.deepEqual(appels, [{ commande: capacite(0, 0), origine: "bulle" }]);
  });
  avecDom(() => {
    const { lieu, appels } = composer(composerListe, vueListe());
    const taloche = laLigne(lieu, "15:0");
    taloche.declencher("pointerdown", { pointerType: "touch" });
    let empeche = false;
    taloche.declencher("keydown", { key: "Enter", preventDefault: () => (empeche = true) });
    assert.deepEqual(appels, [{ commande: capacite(15, 0), origine: "bulle" }], "Entrée joue");
    assert.equal(empeche, true, "Entrée est prise au keydown : le clic qu'elle ferait ne vient pas");
    assert.equal(lieu.querySelector(".combat-apercu"), null);
    // Une autre touche ne fait rien.
    taloche.declencher("keydown", { key: "a", preventDefault: () => assert.fail("une autre touche n'est pas prise") });
    assert.equal(appels.length, 1);
    // La souris : le clic joue, sans aperçu.
    appuyer(taloche, "mouse");
    assert.equal(appels.length, 2);
    assert.equal(lieu.querySelector(".combat-apercu"), null);
    // Un clic sans appui noté (la barre d'espace) joue aussi.
    taloche.click();
    assert.equal(appels.length, 3);
  });
});

test("aperçu — un seul à la fois ; sa clé survit à un corps refait, avec ses hachures ; une ligne qui n'est plus là l'oublie", () => {
  avecDom(() => {
    const premier = composer(composerListe, vueListe());
    appuyer(laLigne(premier.lieu, "0:0"), "touch");
    appuyer(laLigne(premier.lieu, "15:0"), "touch");
    assert.equal(tous(premier.lieu, ".combat-apercu").length, 1, "un seul aperçu");
    assert.equal(laLigne(premier.lieu, "15:0").parentNode.querySelector(".combat-apercu") !== null, true);
    assert.equal(laLigne(premier.lieu, "0:0").parentNode.querySelector(".combat-apercu"), null);
    assert.deepEqual(premier.hachures.at(-1), ["A1"]);
    assert.equal(premier.r.memoire.apercu, "15:0");
    assert.deepEqual(premier.appels, []);

    // Le corps refait, la même mémoire : l'aperçu se rouvre sous sa ligne, avec ses hachures.
    const second = composer(composerListe, vueListe(), { memoire: premier.r.memoire });
    assert.equal(tous(second.lieu, ".combat-apercu").length, 1);
    assert.equal(laLigne(second.lieu, "15:0").parentNode.querySelector(".combat-apercu") !== null, true);
    assert.deepEqual(second.hachures, [["A1"]]);
    // Un second appui sur la ligne rouverte la joue.
    appuyer(laLigne(second.lieu, "15:0"), "touch");
    assert.deepEqual(second.appels, [{ commande: capacite(15, 0), origine: "bulle" }]);

    // La ligne n'est plus là : la clé s'oublie, rien ne s'ouvre ni ne se hachure.
    const vue = vueListe();
    vue.groupes[2] = { ...vue.groupes[2], lignes: [LIGNES.pas1, LIGNES.pas2] };
    const troisieme = composer(composerListe, vue, { memoire: premier.r.memoire });
    assert.equal(troisieme.lieu.querySelector(".combat-apercu"), null);
    assert.equal(premier.r.memoire.apercu, null);
    assert.deepEqual(troisieme.hachures, []);
  });
});

test("aperçu — une ligne inactive y montre sa raison, sans bouton ; un second appui ne fait rien", () => {
  avecDom(() => {
    const { lieu, appels } = composer(composerListe, vueListe());
    const fournaise = laLigne(lieu, "4:1");
    appuyer(fournaise, "touch");
    const apercu = fournaise.parentNode.querySelector(".combat-apercu");
    assert.deepEqual(fournaise.parentNode.children.map(forme), ["button.combat-capacite", "span.combat-raison", "div.combat-apercu"]);
    assert.deepEqual(apercu.children.map((n) => [forme(n), n.textContent]), [
      ["p.", "Une fournaise plus vive."],
      ["p.", "Cible au choix, sans condition de portée"],
      ["p.", "il manque du souffle (2)"],
    ]);
    assert.equal(tous(apercu, "button").length, 0);
    appuyer(fournaise, "touch");
    assert.deepEqual(appels, []);
  });
});

test("aperçu — un passif ouvre le sien au doigt, sans bouton ni hachure, sous le pied ; un second appui le referme ; la souris n'ouvre rien", () => {
  avecDom(() => {
    const { lieu, noeuds, appels, hachures, r } = composer(composerListe, vueListe());
    const vif = tous(lieu, "span.combat-passif")[1];
    appuyer(vif, "mouse");
    assert.equal(lieu.querySelector(".combat-apercu"), null, "à la souris, l'infobulle suffit");

    appuyer(vif, "touch");
    const apercu = lieu.querySelector(".combat-apercu");
    assert.equal(apercu.parentNode, noeuds.at(-1), "à la place qui suit le pied");
    assert.equal(forme(noeuds.at(-2)), "p.combat-bulle-pied");
    assert.equal(tous(apercu, "button").length, 0);
    assert.equal(apercu.textContent.includes("Ajoutez 1 aux jets d'agilité."), true);
    assert.equal(apercu.textContent.includes("Passif : ne se joue pas"), true);
    assert.deepEqual(hachures, [null], "sans hachure : celles d'une ligne s'effacent");
    assert.equal(r.memoire.apercu, "passif:10");

    // Un autre passif prend sa place ; un second appui sur lui le referme.
    const reduction = tous(lieu, "span.combat-passif")[0];
    appuyer(reduction, "touch");
    assert.equal(tous(lieu, ".combat-apercu").length, 1);
    assert.equal(lieu.querySelector(".combat-apercu").textContent.includes("Retire 1 points d'armure par réussite."), true);
    appuyer(reduction, "touch");
    assert.equal(lieu.querySelector(".combat-apercu"), null);
    assert.equal(r.memoire.apercu, null);
    assert.deepEqual(hachures, [null, null, null]);
    assert.deepEqual(appels, []);
  });
});

test("aperçu — ouvert au doigt, sa ligne le dit (aria-expanded, aria-controls vers son identifiant) ; un autre ouvert, ou un passif, le lui ôte ; un passif ne porte rien", () => {
  avecDom(() => {
    const { lieu } = composer(composerListe, vueListe());
    const frappe = laLigne(lieu, "0:0");
    const taloche = laLigne(lieu, "15:0");
    const etat = (ligne) => [ligne.getAttribute("aria-expanded"), ligne.getAttribute("aria-controls")];
    assert.deepEqual(etat(frappe), [null, null], "fermé, rien");
    appuyer(frappe, "touch");
    const apercu = lieu.querySelector(".combat-apercu");
    assert.match(apercu.id, /^combat-bulle-apercu-\d+$/);
    assert.deepEqual(etat(frappe), ["true", apercu.id], "ouvert : la ligne dit ce qu'elle a ouvert");
    assert.ok(lieu.querySelector(`#${frappe.getAttribute("aria-controls")}`) === apercu, "aria-controls désigne l'aperçu");
    // Un appui sur une autre ligne : son aperçu, et la première ne dit plus rien.
    appuyer(taloche, "touch");
    assert.deepEqual(etat(frappe), [null, null]);
    assert.deepEqual(etat(taloche), ["true", lieu.querySelector(".combat-apercu").id]);
    // Un passif ouvert à son tour : la ligne ne dit plus rien, et le passif ne porte ni l'un ni l'autre.
    const vif = tous(lieu, "span.combat-passif")[1];
    appuyer(vif, "touch");
    assert.deepEqual(etat(taloche), [null, null]);
    assert.deepEqual(etat(vif), [null, null], "rien sur les passifs");
    assert.equal(lieu.querySelector(".combat-apercu").hasAttribute("id"), false);
  });
});

// ——— d) Le jet ———

test("jet — des nœuds sans en-tête ni conteneur, dans l'ordre de la vue 2 bis : les étapes, qui se défend, les rangées, puis le contexte, les dés, le texte de la capacité et les réglages à la main", () => {
  avecDom(() => {
    const choix = (libelle) => ({ libelle, choisie: false, commande: regler("x", 0) });
    const commande = { evenement: { type: "degats", base: "aucun", operations: [], nature: "normaux" } };
    const complet = gesteVu({
      jetPrete: { presse: true, actif: true, raison: null, commande: regler("jet_prete", false), arme: "Spatule souple", hachures: ["J1"] },
      armes: [choix("Spatule souple")],
      cases: [{ case: "C3", nom: "Case C3 : s'y déplacer", choisie: false, commande: regler("arrivee", "C3") }],
      caracteristiques: { choisies: [], de: null, gabarit: { evenement: { type: "regler", champ: "caracteristiques" } }, options: [{ code: "force", nom: "Force", valeur: 4 }] },
      difficultes: [{ valeur: 5, libelle: "moyen", choisie: false, commande: regler("difficulte", 5) }],
      x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } },
      jauges: [{ nom: "Grand Four", choisie: true, commande: regler("jauge", 0) }],
      contexte: { ...gesteVu().contexte, defense: DEFENSE("agile"), reglages: REGLAGES },
      degats: {
        bases: [{ libelle: "Sans dégâts", choisie: true, commande }],
        natures: [{ libelle: "Dégâts normaux", choisie: true, commande }],
        saisie: { valeur: null, raison: null, raisonParDefaut: "Taloche", min: 0, max: 999, gabarit: { evenement: { type: "degats", base: "aucun", nature: "normaux" } } },
      },
      localisation: [{ brut: 14, face: 14, zone: "jambe droite", decaler: { min: -13, max: 5, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "decaler", de: 0 } } } }],
      esquive: { libelle: "Pas de côté", min: 1, max: 6, gabarit: { evenement: { type: "esquive" } } },
      detail: [{ zone: "Jambe droite", texte: "armure 10 → 1" }],
      appliquer: { libelle: "Appliquer", commande: { evenement: { type: "appliquer" } } },
      revenir: { commande: { evenement: { type: "revenir" } } },
    });
    const { noeuds, lieu } = composer(composerGeste, vueJet({ geste: complet, defenseur: "Aubépine lance sa défense · souffle 6/10" }));

    // Un bloc se dit par sa balise et sa dernière classe ; une rangée sans classe propre, par le texte de ses boutons.
    const dit = (bloc) => {
      const nom = `${bloc.tagName.toLowerCase()}${bloc.className ? `.${bloc.className.split(" ").at(-1)}` : ""}`;
      return ["div.combat-ligne", "div.combat-choix"].includes(nom) ? `${nom} : ${tous(bloc, "button").map(texteDe).join(", ")}` : nom;
    };
    assert.deepEqual(noeuds.map(dit), [
      "ol.combat-etapes",
      "p.combat-defenseur",
      "div.combat-jet-prete",
      "div.combat-armes",
      "div.combat-cibles",
      "div.combat-arrivees",
      "div.combat-caracteristiques",
      "div.combat-difficultes",
      "div.combat-ligne : Régler X",
      "p.combat-refus",
      "div.combat-jauges",
      "div.combat-des",
    ]);
    assert.equal(tous(lieu, "h2").length, 0, "l'en-tête est celui de la bulle, ou de la zone");
    const des = noeuds.at(-1);
    assert.deepEqual(des.children.map(dit), ["div.combat-contexte", "div.combat-jet", "div.combat-assiste", "details.combat-reglages"]);
    assert.deepEqual(des.querySelector(".combat-contexte").children.map(dit), ["p", "p", "div.combat-cause-explication", "div.combat-defense"]);
    assert.deepEqual(des.querySelector(".combat-jet").children.map(dit), [
      "div.combat-chaine",
      "p.combat-bilan",
      "ul.combat-lettres",
      "div.combat-choix : Relancer le 2e dé, Garder ce dé",
      "div.combat-degats-bases",
      "div.combat-degats-natures",
      "div.combat-ligne : Fixer les dégâts",
      "p.combat-refus",
      "div.combat-localisation",
      "div.combat-ligne : Décaler",
      "p.combat-refus",
      "div.combat-ligne : Pas de côté",
      "p.combat-refus",
      "ul.combat-detail",
      "div.combat-choix : Appliquer, Revenir",
    ]);
    // Chaque étape faite, en cours ou à venir.
    const etapes = tous(noeuds[0], "li");
    assert.deepEqual(etapes.map((li) => [texteDe(li), li.className, li.getAttribute("aria-current")]), [
      ["Capacité", "fait", null],
      ["Cible", "fait", null],
      ["Jet d'attaque", "en-cours", "step"],
      ["Localisation", "", null],
      ["Interventions", "", null],
      ["Dégâts", "", null],
    ]);

    // Sans contexte ni réglage (une capacité sans jet) : le jet, puis le texte.
    const sansJet = composer(composerGeste, vueDuGeste({ description: "Un pas chassé.", revenir: { commande: { evenement: { type: "revenir" } } } }, { etapes: [] }));
    assert.deepEqual(sansJet.noeuds.map(dit), ["div.combat-des"]);
    assert.deepEqual(sansJet.noeuds[0].children.map(dit), ["div.combat-jet", "div.combat-assiste"]);
  });
});

test("jet — sans geste, rien ; ni + ni − : la puissance n'est plus un réglage du geste", () => {
  avecDom(() => {
    assert.deepEqual(composer(composerGeste, vueListe()).noeuds, []);
    assert.deepEqual(composer(composerListe, vueListe({ groupes: [], passer: null, passifs: [] })).noeuds, []);
    const { lieu } = composer(composerGeste, vueJet());
    assert.deepEqual(tous(lieu, "button").filter((b) => ["+", "−"].includes(texteDe(b))), []);
    assert.equal(lieu.querySelector(".combat-puissance"), null);
  });
});

test("jet — qui se défend : sous les étapes, quand un adversaire attaque ; sinon rien", () => {
  avecDom(() => {
    const adversaire = vueDeLAttaqueDuChef();
    const { noeuds } = composer(composerGeste, adversaire);
    assert.deepEqual(noeuds.slice(0, 2).map((n) => [forme(n), n.textContent]), [
      ["ol.combat-etapes", "CapacitéCibleJet de défenseLocalisationInterventionsDégâts"],
      ["p.combat-defenseur", "Aubépine lance sa défense · souffle 6/10"],
    ]);
    assert.equal(composer(composerGeste, vueJet()).lieu.querySelector(".combat-defenseur"), null);
    assert.equal(composer(composerGeste, vueJet({ defenseur: "" })).lieu.querySelector(".combat-defenseur"), null);
  });
});

test("jet — « Jet d'attaque » prête le jet d'une arme, qu'il nomme, lié aux hachures de sa portée ; un adversaire à plusieurs armes choisit la sienne", () => {
  avecDom(() => {
    const jetPrete = { presse: false, actif: true, raison: null, commande: regler("jet_prete", true), arme: "Couteau d'office", hachures: ["A1", "A2", "B1", "B2"] };
    const { lieu, appels, liens } = composer(composerGeste, vueDuGeste({ jetPrete }));
    const pret = leBouton(lieu, "Jet d'attaque");
    assert.equal(texteDe(pret), "Jet d'attaque (Couteau d'office)");
    assert.equal(pret.getAttribute("aria-pressed"), "false");
    assert.equal(lieu.querySelector(".combat-armes"), null);
    const lien = liens.find((un) => un.declencheur === pret);
    assert.deepEqual(lien.options, { contenu: null, hachures: ["A1", "A2", "B1", "B2"], cotes: null }, "son infobulle n'a que les hachures");
    pret.click();
    assert.deepEqual(appels, [{ commande: regler("jet_prete", true), origine: "bulle" }]);
  });
  avecDom(() => {
    const { lieu, appels, liens } = composer(
      composerGeste,
      vueDuGeste({
        jetPrete: { presse: true, actif: true, raison: null, commande: regler("jet_prete", false), arme: "Spatule souple", hachures: [] },
        armes: [
          { libelle: "Spatule souple", choisie: true, commande: regler("arme_pretee", 0) },
          { libelle: "Spatule souple (2)", choisie: false, commande: regler("arme_pretee", 1) },
        ],
      }),
    );
    assert.equal(leBouton(lieu, "Jet d'attaque").getAttribute("aria-pressed"), "true");
    assert.deepEqual(liens[0].options.hachures, [], "sans arme à portée, rien à hachurer");
    const armes = tous(lieu, ".combat-armes button");
    assert.deepEqual(armes.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Spatule souple", "true"], ["Spatule souple (2)", "false"]]);
    armes[1].click();
    assert.deepEqual(appels, [{ commande: regler("arme_pretee", 1), origine: "bulle" }]);
  });
  avecDom(() => {
    // « sans arme » se dit, et un jet prêté qui ne se peut pas dit pourquoi.
    const { lieu, appels } = composer(composerGeste, vueDuGeste({ jetPrete: { presse: false, actif: false, raison: "aucune cible adverse à portée", commande: regler("jet_prete", true), arme: "sans arme", hachures: [] } }));
    const inactif = leBouton(lieu, "Jet d'attaque");
    assert.equal(texteDe(inactif), "Jet d'attaque (sans arme)");
    assert.equal(texteDe(lieu.querySelector(`#${inactif.getAttribute("aria-describedby")}`)), "aucune cible adverse à portée");
    inactif.click();
    assert.deepEqual(appels, []);
  });
});

test("jet — la cible : un bouton par cible possible ; « choisie sur la carte », « choisie ici » (dans la zone comme dans la bulle), rien sans origine", () => {
  const cibles = [
    { id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: true, actif: true, raison: null, commande: regler("cible", "adv3") },
    { id: "adv4", libelle: "Marmiton de corvée n° 2", choisie: false, actif: true, raison: null, commande: regler("cible", "adv4") },
    { id: "adv2", libelle: "Chef de partie", choisie: false, actif: false, raison: "hors de portée", commande: regler("cible", "adv2") },
  ];
  const vue = vueDuGeste({ cibles });
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vue, { origineDeLaCible: "plateau" });
    const rangee = noeud.querySelector(".combat-cibles");
    const lesBoutons = tous(rangee, "button");
    assert.deepEqual(lesBoutons.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Marmiton de corvée n° 1", "true"], ["Marmiton de corvée n° 2", "false"], ["Chef de partie", "false"]]);
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie sur la carte"]);
    // La mention suit la cible choisie, et elle seule.
    assert.equal(rangee.children[rangee.children.indexOf(lesBoutons[0]) + 1].className, "combat-origine");

    rendre(vue, { origineDeLaCible: "panneau" });
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie ici"]);
    rendre(vue, { origineDeLaCible: "bulle" });
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie ici"], "un clic dans la bulle vaut un clic ici");

    // Sans origine (après un rechargement), ou sans cible choisie : rien.
    rendre(vue, { origineDeLaCible: null });
    assert.equal(tous(noeud, ".combat-origine").length, 0);
    rendre(vueDuGeste({ cibles: cibles.map((cible) => ({ ...cible, choisie: false })) }), { origineDeLaCible: "plateau" });
    assert.equal(tous(noeud, ".combat-origine").length, 0);

    // Un clic émet le réglage de la cible, depuis la zone ; une cible hors de portée ne se choisit pas.
    leBouton(noeud, "Marmiton de corvée n° 2").click();
    assert.deepEqual(appels, [{ commande: regler("cible", "adv4"), origine: "panneau" }]);
    const chef = leBouton(noeud, "Chef de partie");
    assert.equal(chef.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${chef.getAttribute("aria-describedby")}`)), "hors de portée");
    chef.click();
    assert.equal(appels.length, 1);

    // Pendant le jet, la vue ne donne plus que la cible choisie, inactive : la rangée reste montrée, avec d'où vient le choix, et ne fait rien.
    appels.length = 0;
    rendre(vueDuGeste({ cibles: [{ ...cibles[0], actif: false, raison: "Une action est en cours." }] }), { origineDeLaCible: "plateau" });
    const [choisie] = tous(noeud, ".combat-cibles button");
    assert.deepEqual([texteDe(choisie), choisie.getAttribute("aria-pressed"), choisie.getAttribute("aria-disabled")], ["Marmiton de corvée n° 1", "true", "true"]);
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie sur la carte"]);
    choisie.click();
    assert.deepEqual(appels, []);
  });
  // Dans la bulle : l'origine que la bulle lui donne, et ses clics partent de la bulle.
  avecDom(() => {
    const { lieu, appels } = composer(composerGeste, vue, { origineDeLaCible: "bulle" });
    assert.deepEqual(tous(lieu, ".combat-origine").map(texteDe), ["choisie ici"]);
    leBouton(lieu, "Marmiton de corvée n° 2").click();
    assert.deepEqual(appels, [{ commande: regler("cible", "adv4"), origine: "bulle" }]);
  });
});

test("jet — une capacité sans jet offre « Sans cible » ; sans cible ni « Sans cible », pas de rangée", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueDuGeste({ cibles: [{ id: "pj1", libelle: "Aubépine Crèmebrûlée", choisie: false, actif: true, raison: null, commande: regler("cible", "pj1") }], sansCible: { choisie: true, commande: regler("cible", null) } }), { origineDeLaCible: "panneau" });
    const sans = leBouton(noeud, "Sans cible");
    assert.equal(sans.getAttribute("aria-pressed"), "true");
    assert.equal(tous(noeud, ".combat-origine").length, 0, "« Sans cible » n'est pas une cible choisie quelque part");
    sans.click();
    assert.deepEqual(appels, [{ commande: regler("cible", null), origine: "panneau" }]);

    rendre(vueDuGeste({ cibles: [], sansCible: null }));
    assert.equal(noeud.querySelector(".combat-cibles"), null);
  });
});

test("jet — un déplacement : un double de 44 px par case d'arrivée, nommé comme sa case ; sa commande part telle quelle, à un ou deux événements", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    // La commande à deux événements : des événements nus, comme les rend lecture.js (commandeDArrivee ; contrat, § 0.2, règle 7, et § 6.3).
    const deux = { evenements: [{ type: "regler", champ: "facon", valeur: 0 }, { type: "regler", champ: "arrivee", valeur: "C3" }] };
    rendre(vueDuGeste({ cases: [{ case: "C3", nom: "Case C3 : s'y déplacer", choisie: false, commande: deux }, { case: "D4", nom: "Case D4 : s'y déplacer", choisie: true, commande: regler("arrivee", "D4") }] }));
    const cases = tous(noeud, ".combat-arrivees button");
    assert.deepEqual(cases.map((b) => [texteDe(b), b.getAttribute("aria-pressed"), b.className]), [["C3", "false", "combat-capacite"], ["D4", "true", "combat-capacite"]]);
    assert.deepEqual(cases.map((b) => b.getAttribute("aria-label")), ["Case C3 : s'y déplacer", "Case D4 : s'y déplacer"]);
    cases[0].click();
    cases[1].click();
    assert.deepEqual(appels, [{ commande: deux, origine: "panneau" }, { commande: regler("arrivee", "D4"), origine: "panneau" }]);

    rendre(vueDuGeste({ cases: null }));
    assert.equal(noeud.querySelector(".combat-arrivees"), null);
    // Sans nom dans la vue, le bouton garde son texte pour nom.
    rendre(vueDuGeste({ cases: [{ case: "C3", choisie: false, commande: regler("arrivee", "C3") }] }));
    assert.equal(noeud.querySelector(".combat-arrivees button").hasAttribute("aria-label"), false);
  });
});

test("jet — chaque rangée de choix est un groupe que son intitulé nomme", () => {
  avecLeTelephone(({ noeud, rendre }) => {
    const choix = (libelle) => ({ libelle, choisie: false, commande: regler("x", 0) });
    rendre(
      vueDuGeste({
        armes: [choix("Spatule souple"), choix("Spatule souple (2)")],
        cibles: [{ id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: false, actif: true, raison: null, commande: regler("cible", "adv3") }],
        cases: [{ case: "C3", nom: "Case C3 : s'y déplacer", choisie: false, commande: regler("arrivee", "C3") }],
        caracteristiques: { choisies: [], de: null, gabarit: { evenement: { type: "regler", champ: "caracteristiques" } }, options: [{ code: "force", nom: "Force", valeur: 4 }] },
        difficultes: [{ valeur: 5, libelle: "moyen", choisie: false, commande: regler("difficulte", 5) }],
        jauges: [{ nom: "Grand Four", choisie: true, commande: regler("jauge", 0) }],
        degats: { bases: [choix("Sans dégâts")], natures: [choix("Dégâts normaux")], saisie: null },
      }),
    );
    const groupes = tous(noeud, "[role=group]");
    assert.deepEqual(
      groupes.map((groupe) => [groupe.className, texteDe(noeud.querySelector(`#${groupe.getAttribute("aria-labelledby")}`))]),
      [
        ["combat-ligne combat-armes", "Arme :"],
        ["combat-cibles", "Cible :"],
        ["combat-ligne combat-arrivees", "Arrivée :"],
        ["combat-ligne combat-caracteristiques", "Caractéristiques, une ou deux :"],
        ["combat-ligne combat-difficultes", "Difficulté :"],
        ["combat-ligne combat-jauges", "Lien payé sur :"],
        ["combat-ligne combat-degats-bases", "Dégâts :"],
        ["combat-ligne combat-degats-natures", "Nature :"],
      ],
    );
    for (const groupe of groupes) {
      assert.equal(groupe.children[0].id, groupe.getAttribute("aria-labelledby"), groupe.className);
      assert.equal(groupe.children[0].tagName, "SPAN");
      assert.ok(tous(groupe, "button").length > 0, groupe.className);
    }
    const ids = tous(noeud, "[id]").map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, "aucun identifiant en double");
  });
});

test("jet — les caractéristiques d'un dé au choix : une ou deux, émises par le gabarit de la vue", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    const options = [{ code: "force", nom: "Force", valeur: 4 }, { code: "agilite", nom: "Agilité", valeur: 5 }, { code: "sens", nom: "Sens", valeur: 3 }];
    const gabarit = { evenement: { type: "regler", champ: "caracteristiques" } };
    const avec = (choisies) => vueDuGeste({ caracteristiques: { choisies, de: "d8", gabarit, options } });
    const cliquer = (nom) => {
      appels.length = 0;
      leBouton(noeud.querySelector(".combat-caracteristiques"), nom).click();
      return appels.map((appel) => appel.commande.evenement.valeur);
    };

    rendre(avec(["force", "agilite"]));
    const rangee = noeud.querySelector(".combat-caracteristiques");
    assert.equal(texteDe(noeud.querySelector(`#${rangee.getAttribute("aria-labelledby")}`)), "Caractéristiques, une ou deux (dé : d8) :");
    assert.deepEqual(tous(rangee, "button").map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Force 4", "true"], ["Agilité 5", "true"], ["Sens 3", "false"]]);
    // Deux sont choisies : en retirer une, ou repartir d'une troisième seule.
    assert.deepEqual(cliquer("Agilité"), [["force"]]);
    assert.deepEqual(cliquer("Sens"), [["sens"]]);
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "caracteristiques", valeur: ["sens"] } }, origine: "panneau" }]);

    // Une seule : en ajouter une autre ; la dernière ne se retire pas.
    rendre(avec(["force"]));
    assert.deepEqual(cliquer("Sens"), [["force", "sens"]]);
    assert.deepEqual(cliquer("Force"), []);

    // Aucune : la première.
    rendre(avec([]));
    assert.deepEqual(cliquer("Agilité"), [["agilite"]]);
  });
});

test("jet — la difficulté et la jauge de lien : un bouton par option, la choisie enfoncée", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(
      vueDuGeste({
        difficultes: [{ valeur: 5, libelle: "moyen", choisie: false, commande: regler("difficulte", 5) }, { valeur: 6, libelle: "compliqué", choisie: true, commande: regler("difficulte", 6) }],
        jauges: [{ nom: "Grand Four", choisie: true, commande: regler("jauge", 0) }, { nom: "Grand Four (2)", choisie: false, commande: regler("jauge", 1) }],
      }),
    );
    const difficultes = tous(noeud, ".combat-difficultes button");
    assert.deepEqual(difficultes.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["5 (moyen)", "false"], ["6 (compliqué)", "true"]]);
    difficultes[0].click();
    const jauges = tous(noeud, ".combat-jauges button");
    assert.deepEqual(jauges.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Grand Four", "true"], ["Grand Four (2)", "false"]]);
    jauges[1].click();
    assert.deepEqual(appels, [{ commande: regler("difficulte", 5), origine: "panneau" }, { commande: regler("jauge", 1), origine: "panneau" }]);

    rendre(vueDuGeste({ difficultes: null, jauges: null }));
    assert.equal(noeud.querySelector(".combat-difficultes"), null);
    assert.equal(noeud.querySelector(".combat-jauges"), null);
  });
});

test("jet — X : la saisie porte ses bornes, émet le gabarit complété, se tait hors de ses bornes, et met le focus au champ refusé sans faire défiler", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueDuGeste({ x: { valeur: 2, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } }));
    const champ = noeud.querySelector("input[type=number]");
    assert.equal(champ.value, "2");
    assert.equal(champ.getAttribute("min"), "0");
    assert.equal(champ.getAttribute("max"), "5");
    assert.equal(champ.className, "champ");
    assert.equal(texteDe(champ.parentNode), "X (de 0 à 5)");
    assert.equal(tous(noeud, "input[type=text]").length, 0, "X ne demande pas de raison");

    champ.value = "4";
    leBouton(noeud, "Régler X").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "x", valeur: 4 } }, origine: "panneau" }]);

    // Le message d'un refus est lié au champ, et vide tant que rien n'est refusé (une description cachée se lit quand même).
    const refus = noeud.querySelector(`#${champ.getAttribute("aria-describedby")}`);
    assert.equal(refus.tagName, "P");
    assert.deepEqual([refus.hidden, refus.textContent], [true, ""]);

    // Hors des bornes, pas un entier, vide : rien ne part, le champ le dit, et le message dit ce qui est attendu.
    for (const refuse of ["6", "-1", "2,5", "1.5", "", "deux", "1e1"]) {
      appels.length = 0;
      champ.value = refuse;
      globalThis.document.activeElement = null;
      globalThis.document.focalisations.length = 0;
      leBouton(noeud, "Régler X").click();
      assert.deepEqual(appels, [], `« ${refuse} » ne part pas`);
      assert.equal(champ.getAttribute("aria-invalid"), "true");
      assert.deepEqual([refus.hidden, refus.textContent], [false, "Un nombre entier de 0 à 5 est attendu."], `« ${refuse} »`);
      assert.equal(globalThis.document.activeElement, champ, "le focus va au champ refusé");
      assert.deepEqual(globalThis.document.focalisations, [{ noeud: champ, options: { preventScroll: true } }], "sans faire défiler la page");
    }
    // Les bornes elles-mêmes passent, le champ n'est plus marqué, et le message se tait.
    for (const [texte, valeur] of [["0", 0], ["5", 5], [" 3 ", 3]]) {
      appels.length = 0;
      champ.value = "9";
      leBouton(noeud, "Régler X").click();
      assert.equal(refus.hidden, false);
      champ.value = texte;
      leBouton(noeud, "Régler X").click();
      assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "x", valeur } }, origine: "panneau" }]);
      assert.equal(champ.hasAttribute("aria-invalid"), false);
      assert.deepEqual([refus.hidden, refus.textContent], [true, ""]);
    }
    // Sans bornes dans la vue, le message ne les invente pas.
    rendre(vueDuGeste({ x: { valeur: 2, gabarit: { evenement: { type: "regler", champ: "x" } } } }));
    const sansBornes = noeud.querySelector("input[type=number]");
    sansBornes.value = "deux";
    leBouton(noeud, "Régler X").click();
    assert.equal(noeud.querySelector(`#${sansBornes.getAttribute("aria-describedby")}`).textContent, "Un nombre entier est attendu.");
    rendre(vueDuGeste({ x: { valeur: 2, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } }));
    // La touche Entrée vaut le bouton ; une autre touche, non.
    const neuf = noeud.querySelector("input[type=number]");
    appels.length = 0;
    neuf.value = "1";
    neuf.declencher("keydown", { key: "a" });
    assert.deepEqual(appels, []);
    neuf.declencher("keydown", { key: "Enter" });
    assert.equal(appels.length, 1);
  });
});

test("jet — le contexte : le dé, ses modificateurs et la difficulté ; le nombre des avantages porte ⓘ, se nomme « … : voir la cause » et ouvre sa cause dessous ou dessus", () => {
  avecDom(() => {
    const { lieu, liens } = composer(composerGeste, vueJet());
    const contexte = lieu.querySelector(".combat-des .combat-contexte");
    const [jet, ligneDesCauses, explication] = contexte.children;
    // Le dé nu, puis son modificateur avec sa source, à sa suite et une seule fois, comme sur la maquette.
    assert.equal(texteDe(jet), "Dé d8 (Force 4 + Agilité 5) +1 (Vif) · difficulté 5, sa défense");
    const nombre = ligneDesCauses.children[0];
    assert.equal(forme(nombre), "button.combat-cause");
    assert.equal(nombre.getAttribute("type"), "button");
    assert.equal(nombre.getAttribute("aria-label"), "1 avantage : voir la cause");
    assert.equal(nombre.getAttribute("aria-expanded"), "false");
    assert.equal(texteDe(nombre), `1 avantage ${SIGNE_DE_LA_CAUSE}`);
    const signe = nombre.querySelector(".combat-cause-signe");
    assert.deepEqual([forme(signe), signe.getAttribute("aria-hidden"), signe.textContent], ["span.combat-cause-signe", "true", SIGNE_DE_LA_CAUSE], "« ⓘ » est caché aux lecteurs d'écran");
    // L'explication, sous la ligne, cachée : les phrases, leurs citations.
    assert.deepEqual([forme(explication), explication.hidden], ["div.combat-cause-explication", true]);
    assert.deepEqual(explication.children.map((p) => [forme(p), p.textContent]), [["p.combat-cause-avantage", "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage. « Seul sur sa case : 1 avantage. »"]]);
    // Son infobulle : les mêmes phrases, dessous puis dessus, sans hachure.
    const lien = liens.find((un) => un.declencheur === nombre);
    assert.deepEqual([lien.options.cotes, lien.options.hachures], [["dessous", "dessus"], null]);
    assert.deepEqual(lien.options.contenu().map((p) => p.textContent), explication.children.map((p) => p.textContent));
    // Plus de titre du jet, ni d'« Avantages : » à la suite.
    assert.equal(lieu.textContent.includes("Avantages :"), false);
    assert.equal(lieu.textContent.includes("Jet d'attaque · "), false);
  });
  avecDom(() => {
    // Avantages et désavantages ensemble : chaque phrase dans sa couleur, puis le compte.
    const causes = {
      nombre: "avantages et désavantages s'annulent",
      nom: "avantages et désavantages s'annulent : voir la cause",
      phrases: [CAUSES.phrases[0], HORS_MAITRISE],
      compte: "Avantages et désavantages s'annulent : aucun ne reste.",
    };
    const { lieu, liens } = composer(composerGeste, vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, detail: null, modificateurs: ["+1 (Vif)", "−2 (blessures)"], causes } }) }));
    assert.equal(texteDe(lieu.querySelector(".combat-contexte p")), "Dé d8 +1 (Vif) −2 (blessures) · difficulté 5, sa défense");
    const explication = lieu.querySelector(".combat-cause-explication");
    assert.deepEqual(explication.children.map((p) => [forme(p), p.textContent]), [
      ["p.combat-cause-avantage", "Solo du chef [1] : aucun allié de son camp sur sa case (D4) ; 1 avantage. « Seul sur sa case : 1 avantage. »"],
      ["p.combat-cause-desavantage", HORS_MAITRISE.texte],
      ["p.", "Avantages et désavantages s'annulent : aucun ne reste."],
    ]);
    assert.equal(liens.find((un) => un.declencheur.className === "combat-cause").options.contenu().length, 3);
    assert.equal(lieu.querySelector("button.combat-cause").getAttribute("aria-label"), "avantages et désavantages s'annulent : voir la cause");
  });
  avecDom(() => {
    // Sans source : ni nombre, ni explication ; sans contexte : rien.
    const { lieu } = composer(composerGeste, vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, causes: null } }) }));
    assert.equal(lieu.querySelector(".combat-cause"), null);
    assert.equal(lieu.querySelector(".combat-cause-explication"), null);
    assert.equal(composer(composerGeste, vueJet({ geste: gesteVu({ contexte: null }) })).lieu.querySelector(".combat-contexte"), null);
  });
});

test("jet — au doigt, ⓘ montre l'explication sous la ligne, ou la cache ; au clavier aussi ; la souris s'en tient à l'infobulle ; montrée, elle le reste le temps du geste", () => {
  avecDom(() => {
    const { lieu, r, appels } = composer(composerGeste, vueJet());
    const nombre = lieu.querySelector("button.combat-cause");
    const explication = lieu.querySelector(".combat-cause-explication");
    appuyer(nombre, "mouse");
    assert.deepEqual([explication.hidden, nombre.getAttribute("aria-expanded")], [true, "false"], "à la souris, l'infobulle suffit");
    appuyer(nombre, "touch");
    assert.deepEqual([explication.hidden, nombre.getAttribute("aria-expanded"), r.memoire.causesOuvertes], [false, "true", true]);
    appuyer(nombre, "touch");
    assert.deepEqual([explication.hidden, nombre.getAttribute("aria-expanded"), r.memoire.causesOuvertes], [true, "false", false]);
    // Au clavier (un clic sans appui noté) : le bouton fait ce que son état annonce.
    nombre.click();
    assert.deepEqual([explication.hidden, nombre.getAttribute("aria-expanded")], [false, "true"]);
    assert.deepEqual(appels, [], "rien ne part : c'est une explication");

    // Le corps refait, la même mémoire : toujours montrée.
    const refait = composer(composerGeste, vueJet(), { memoire: r.memoire });
    assert.equal(refait.lieu.querySelector(".combat-cause-explication").hidden, false);
    assert.equal(refait.lieu.querySelector("button.combat-cause").getAttribute("aria-expanded"), "true");
  });
});

test("jet — la défense au choix : « Défense : » et sa liste, une option par type, la choisie retenue ; le changement émet la commande de l'option choisie", () => {
  avecDom(() => {
    const vue = vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, defense: DEFENSE("lourde") } }) });
    const { lieu, appels, gardes } = composer(composerGeste, vue);
    const bloc = lieu.querySelector(".combat-contexte .combat-defense");
    assert.equal(forme(bloc), "div.combat-defense");
    const [etiquette, liste] = bloc.children;
    assert.deepEqual([forme(etiquette), etiquette.textContent], ["label.", "Défense :"]);
    assert.deepEqual([forme(liste), liste.id.length > 0, etiquette.getAttribute("for")], ["select.champ", true, liste.id], "l'étiquette nomme la liste");
    assert.deepEqual(liste.children.map((o) => [o.tagName, o.getAttribute("value"), o.textContent, o.hasAttribute("selected")]), [
      ["OPTION", "lourde", "lourde", true],
      ["OPTION", "agile", "agile", false],
      ["OPTION", "precise", "précise", false],
    ]);
    assert.equal(liste.value, "lourde");

    liste.value = "agile";
    liste.declencher("change");
    assert.deepEqual(appels, [{ commande: regler("defense", "agile"), origine: "bulle" }]);
    liste.value = "precise";
    liste.declencher("change");
    assert.deepEqual(appels.at(-1), { commande: regler("defense", "precise"), origine: "bulle" });
    assert.deepEqual(gardes, ["defense", null, "defense", null], "le focus revient à la liste, le temps du rendu");
    // Une valeur que la vue n'offre pas ne part pas.
    liste.value = "autre";
    liste.declencher("change");
    assert.equal(appels.length, 2);
  });
  avecDom(() => {
    const { lieu } = composer(composerGeste, vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, defense: DEFENSE("precise") } }) }));
    assert.equal(lieu.querySelector(".combat-defense select").value, "precise");
    assert.equal(composer(composerGeste, vueJet()).lieu.querySelector(".combat-defense"), null, "sans choix offert, pas de liste");
  });
});

test("jet — le texte de la capacité, toujours : « Effets de capacité (mode assisté) » et sa description, avant comme après le premier dé", () => {
  avecDom(() => {
    const assiste = (vue) => composer(composerGeste, vue).lieu.querySelector(".combat-des .combat-assiste");
    assert.deepEqual(assiste(vueJet()).children.map((n) => [forme(n), n.textContent]), [["h3.", "Effets de capacité (mode assisté)"], ["p.combat-description", "Une taloche qui inflige 2/4/8."]]);
    assert.deepEqual(assiste(vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, reglages: REGLAGES } }) })).children.map(forme), ["h3.", "p.combat-description"]);
    // Même sans description : le bloc reste, sa description vide.
    assert.deepEqual(assiste(vueJet({ geste: gesteVu({ description: null }) })).children.map((n) => [forme(n), n.textContent]), [["h3.", "Effets de capacité (mode assisté)"], ["p.combat-description", ""]]);
  });
});

test("jet — les réglages à la main : repliés sous « Réglages à la main (avant le premier dé) », ils se déplient d'un clic et gardent leur état le temps du geste ; un nombre et sa raison, jamais une raison vide", () => {
  avecDom(() => {
    const vue = vueJet({ geste: gesteVu({ contexte: { ...gesteVu().contexte, reglages: REGLAGES } }) });
    const { lieu, appels, r } = composer(composerGeste, vue);
    const details = lieu.querySelector(".combat-des details.combat-reglages");
    assert.equal(details.hasAttribute("open"), false, "repliés");
    const resume = details.children[0];
    assert.equal(forme(resume), "summary.");
    assert.equal(resume.textContent, "Réglages à la main (avant le premier dé)");
    assert.deepEqual(tous(resume, "span").map((s) => [forme(s), s.textContent]), [["span.combat-sous", "(avant le premier dé)"]]);
    details.setAttribute("open", "");
    details.declencher("toggle");
    assert.equal(r.memoire.reglagesOuverts, true);
    assert.equal(composer(composerGeste, vue, { memoire: r.memoire }).lieu.querySelector("details.combat-reglages").hasAttribute("open"), true, "un dé refait le corps sans les refermer");
    details.removeAttribute("open");
    details.declencher("toggle");
    assert.equal(r.memoire.reglagesOuverts, false);

    const [modificateur, avantages] = tous(details, "input[type=number]");
    const [raisonDuModificateur, raisonDesAvantages] = tous(details, "input[type=text]");
    assert.equal(texteDe(modificateur.parentNode), "Modificateur de chaque dé (de −20 à 20)");
    assert.equal(modificateur.value, "0");
    assert.equal(raisonDuModificateur.value, "Taloche", "la raison par défaut est proposée");
    assert.equal(avantages.value, "1");
    assert.equal(raisonDesAvantages.value, "Nez fin", "la raison déjà donnée est reprise");

    modificateur.value = "-2";
    raisonDuModificateur.value = "  Inspiration ";
    leBouton(details, "Régler le modificateur").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "modificateur", valeur: -2, raison: "Inspiration" } }, origine: "bulle" }]);

    // Une raison vide ne part jamais : avec un nombre non nul, rien ne s'émet, et le message, lié aux deux champs, dit pourquoi.
    appels.length = 0;
    raisonDuModificateur.value = "   ";
    const refus = details.querySelector(`#${raisonDuModificateur.getAttribute("aria-describedby")}`);
    assert.equal(modificateur.getAttribute("aria-describedby"), raisonDuModificateur.getAttribute("aria-describedby"));
    assert.notEqual(avantages.getAttribute("aria-describedby"), modificateur.getAttribute("aria-describedby"), "chaque saisie a son message");
    leBouton(details, "Régler le modificateur").click();
    assert.deepEqual(appels, []);
    assert.equal(raisonDuModificateur.getAttribute("aria-invalid"), "true");
    assert.equal(modificateur.hasAttribute("aria-invalid"), false, "seul le champ fautif est marqué");
    assert.deepEqual([refus.hidden, refus.textContent], [false, "Une raison est demandée."]);
    assert.equal(globalThis.document.activeElement, raisonDuModificateur, "le focus va au champ refusé");
    // À zéro, le réglage s'efface sans raison : le champ « raison » n'est pas dans l'événement.
    modificateur.value = "0";
    leBouton(details, "Régler le modificateur").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "modificateur", valeur: 0 } }, origine: "bulle" }]);
    assert.deepEqual([refus.hidden, refus.textContent], [true, ""], "le message se tait dès que la saisie part");

    // Hors des bornes de la vue : rien, et le message dit les bornes.
    appels.length = 0;
    avantages.value = "21";
    leBouton(details, "Régler les avantages").click();
    assert.deepEqual(appels, []);
    assert.equal(details.querySelector(`#${avantages.getAttribute("aria-describedby")}`).textContent, "Un nombre entier de −20 à 20 est attendu.");
    avantages.value = "-20";
    leBouton(details, "Régler les avantages").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "avantages", valeur: -20, raison: "Nez fin" } }, origine: "bulle" }]);
  });
  avecDom(() => {
    // Après le premier dé, la vue n'offre plus de réglage : plus de bloc, plus de champ ; le texte de la capacité reste.
    const { lieu } = composer(composerGeste, vueJet());
    assert.equal(lieu.querySelector(".combat-reglages"), null);
    assert.equal(tous(lieu, ".combat-des input").length, 0);
    assert.equal(texteDe(lieu.querySelector(".combat-assiste .combat-description")), "Une taloche qui inflige 2/4/8.");
  });
});

test("jet — la chaîne : un dé par entrée, son état en classe, en signe et en nom ; seul le dé attendu se lance", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueJet());
    let des = tous(noeud, ".combat-chaine button.combat-de");
    assert.deepEqual(des.map((de) => de.className), ["combat-de reussi", "combat-de echoue", "combat-de a-venir"]);
    assert.deepEqual(des.map((de) => tous(de, "span").map((span) => `${span.className}=${texteDe(span)}`)), [
      ["combat-de-titre=1er dé", "combat-de-valeur=9", "combat-de-detail=8 + 1 ✓"],
      ["combat-de-titre=2e dé", "combat-de-valeur=4", "combat-de-detail=3 + 1 ✗"],
      ["combat-de-titre=3e dé", "combat-de-valeur=d8"],
    ]);
    assert.deepEqual(des.map((de) => de.getAttribute("aria-label")), ["1er dé : 9 (8 + 1), réussi", "2e dé : 4 (3 + 1), échec", "3e dé : d8, à venir"]);
    for (const de of des) de.click();
    assert.deepEqual(appels, []);
    assert.deepEqual(des.map((de) => de.getAttribute("aria-disabled")), ["true", "true", "true"]);

    // Après « relancer » : le dé relancé, puis celui de la relance, à cliquer.
    rendre(
      vueJet({
        geste: gesteVu({
          chaine: [
            { titre: "1er dé", etat: "reussi", valeur: 9, detail: "8 + 1" },
            { titre: "2e dé", etat: "relance", valeur: 4, detail: "3 + 1" },
            { titre: "relance", etat: "a_lancer", de: "d8" },
            { titre: "3e dé", etat: "a_venir", de: "d8" },
          ],
          aLancer: { faces: 8, combien: 1, libelle: "d8", motif: "relance" },
          choix: [],
          bilan: "1 réussite pour l'instant. Avantage dépensé : cliquez sur le d8 pour relancer le 2e dé.",
        }),
        focus: "de",
      }),
    );
    des = tous(noeud, ".combat-chaine button.combat-de");
    assert.deepEqual(des.map((de) => de.className), ["combat-de reussi", "combat-de relance", "combat-de a-lancer", "combat-de a-venir"]);
    assert.equal(texteDe(des[1].querySelector(".combat-de-detail")), "relancé");
    assert.equal(des[2].getAttribute("aria-label"), "relance : d8, à lancer");
    assert.equal(des[2].hasAttribute("aria-disabled"), false);
    assert.equal(des[2].getAttribute("data-focus"), "de");
    des[0].click();
    des[1].click();
    des[3].click();
    assert.deepEqual(appels, [], "seul le dé attendu lance");
    des[2].click();
    assert.deepEqual(appels, [{ de: true }]);

    // Un dé sans modificateur porte son signe seul.
    rendre(vueJet({ geste: gesteVu({ chaine: [{ titre: "1er dé", etat: "echoue", valeur: 2, detail: null }] }) }));
    assert.equal(texteDe(noeud.querySelector(".combat-de .combat-de-detail")), "✗");
    assert.equal(noeud.querySelector(".combat-de").getAttribute("aria-label"), "1er dé : 2, échec");
  });
});

test("jet — le dé attendu que la chaîne ne montre pas reste cliquable ; une entrée « à lancer » sans dé attendu ne lance rien", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueJet({ geste: gesteVu({ chaine: [], aLancer: { faces: 8, combien: 2, libelle: "d8", motif: "chaine" }, choix: [] }) }));
    const des = tous(noeud, ".combat-chaine button.combat-de");
    assert.equal(des.length, 1);
    assert.equal(des[0].className, "combat-de a-lancer");
    assert.equal(des[0].getAttribute("aria-label"), "Dé : lancer le d8");
    des[0].click();
    assert.deepEqual(appels, [{ de: true }], "un clic, un dé, même sous désavantage");

    appels.length = 0;
    rendre(vueJet({ geste: gesteVu({ chaine: [{ titre: "1er dé", etat: "a_lancer", de: "d8" }], aLancer: null, choix: [] }) }));
    const seul = noeud.querySelector(".combat-chaine button.combat-de");
    seul.click();
    assert.deepEqual(appels, []);
    assert.equal(seul.getAttribute("aria-disabled"), "true");
  });
});

test("jet — le bilan visible, à part de l'annonce ; les rangs de dégâts, le rang atteint en évidence ; les choix du moment", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueJet());
    assert.equal(texteDe(noeud.querySelector("p.combat-bilan")), "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.");
    assert.equal(noeud.querySelector("p.combat-bilan").hasAttribute("aria-live"), false);
    assert.deepEqual(tous(noeud, "ul.combat-lettres li").map((li) => [texteDe(li), li.className]), [["1 réussite : 2", "atteinte"], ["2 : 4", ""], ["3 : 8", ""], ["Réduction : +1 contre l'armure par réussite", ""]]);
    leBouton(noeud, "Relancer le 2e dé").click();
    leBouton(noeud, "Garder ce dé").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "relancer" } }, origine: "panneau" }, { commande: { evenement: { type: "garder" } }, origine: "panneau" }]);

    appels.length = 0;
    rendre(vueJet({ geste: gesteVu({ bilan: null, lettres: [{ texte: "1 réussite : 2" }, { texte: "2 : 4", atteinte: true }], choix: [{ cle: "exploser", libelle: "Faire exploser", commande: { evenement: { type: "exploser" } } }] }) }));
    assert.equal(noeud.querySelector("p.combat-bilan"), null);
    assert.deepEqual(tous(noeud, "ul.combat-lettres li").map((li) => li.className), ["", "atteinte"]);
    assert.equal(boutons(noeud, "Relancer").length, 0);
    leBouton(noeud, "Faire exploser").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "exploser" } }, origine: "panneau" }]);

    rendre(vueJet({ geste: gesteVu({ lettres: [], choix: [] }) }));
    assert.equal(noeud.querySelector("ul.combat-lettres"), null);
    assert.equal(noeud.querySelector(".combat-choix"), null);
  });
});

test("jet — fixer les dégâts : la base, la nature, et un nombre avec sa raison, rangés dans l'opération « ajuster »", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    const degats = {
      bases: [
        { libelle: "Sans dégâts", choisie: true, commande: { evenement: { type: "degats", base: "aucun", operations: [], nature: "normaux" } } },
        { libelle: "Dégâts de l'arme", choisie: false, commande: { evenement: { type: "degats", base: "arme", operations: [], nature: "normaux" } } },
      ],
      natures: [
        { libelle: "Normaux", choisie: true, commande: { evenement: { type: "degats", base: "aucun", operations: [], nature: "normaux" } } },
        { libelle: "Directs, à la résistance", choisie: false, commande: { evenement: { type: "degats", base: "aucun", operations: [], nature: "resistance" } } },
      ],
      saisie: { valeur: null, raison: null, raisonParDefaut: "Fournaise", min: 0, max: 999, gabarit: { evenement: { type: "degats", base: "aucun", nature: "normaux" } } },
    };
    rendre(vueJet({ geste: gesteVu({ choix: [], degats }) }));
    assert.deepEqual(tous(noeud, ".combat-degats-bases button").map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Sans dégâts", "true"], ["Dégâts de l'arme", "false"]]);
    leBouton(noeud, "Dégâts de l'arme").click();
    leBouton(noeud, "Directs, à la résistance").click();
    assert.deepEqual(appels.map((appel) => [appel.commande.evenement.base, appel.commande.evenement.nature, appel.origine]), [["arme", "normaux", "panneau"], ["aucun", "resistance", "panneau"]]);

    const ligne = leBouton(noeud, "Fixer les dégâts").parentNode;
    const nombre = ligne.querySelector("input[type=number]");
    const raison = ligne.querySelector("input[type=text]");
    assert.equal(texteDe(nombre.parentNode), "Dégâts à la main (de 0 à 999)");
    assert.equal(nombre.value, "");
    assert.equal(raison.value, "Fournaise");
    appels.length = 0;
    leBouton(noeud, "Fixer les dégâts").click();
    assert.deepEqual(appels, [], "sans nombre, rien ne part");
    nombre.value = "22";
    leBouton(noeud, "Fixer les dégâts").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "degats", base: "aucun", nature: "normaux", operations: [{ op: "ajuster", valeur: 22, raison: "Fournaise" }] } }, origine: "panneau" }]);

    // Des dégâts de 0 gardent leur raison ; sans raison, même 0 ne part pas.
    appels.length = 0;
    nombre.value = "0";
    raison.value = "";
    leBouton(noeud, "Fixer les dégâts").click();
    assert.deepEqual(appels, []);
    raison.value = "Raté de peu";
    leBouton(noeud, "Fixer les dégâts").click();
    assert.deepEqual(appels.map((appel) => appel.commande.evenement.operations), [[{ op: "ajuster", valeur: 0, raison: "Raté de peu" }]]);
    nombre.value = "1000";
    leBouton(noeud, "Fixer les dégâts").click();
    assert.equal(appels.length, 1, "au-delà de la borne de la vue, rien ne part");

    rendre(vueJet({ geste: gesteVu({ degats: null }) }));
    assert.equal(boutons(noeud, "Fixer les dégâts").length, 0);
  });
});

test("jet — la localisation : les d20 lancés, le d20 attendu à cliquer, et la face à décaler avec sa raison", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(vueJet({ geste: gesteVu({ choix: [], aLancer: { faces: 20, combien: 1, libelle: "d20", motif: "localisation" }, localisation: [] }), focus: "de" }));
    assert.equal(tous(noeud, ".combat-chaine").length, 2);
    assert.equal(tous(noeud, ".combat-chaine")[0].querySelector(".a-lancer"), null, "la chaîne du jet ne reçoit pas le d20");
    let d20 = tous(noeud, ".combat-localisation button.combat-de");
    assert.deepEqual(d20.map((de) => [de.className, de.getAttribute("aria-label"), de.getAttribute("data-focus")]), [["combat-de a-lancer", "Localisation : lancer le d20", "de"]]);
    d20[0].click();
    assert.deepEqual(appels, [{ de: true }]);

    // Deux d20 lancés, le second décalé ; le premier seul se décale encore.
    appels.length = 0;
    rendre(
      vueJet({
        geste: gesteVu({
          choix: [],
          localisation: [
            { brut: 14, face: 14, zone: "jambe droite", decaler: { min: -13, max: 5, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "decaler", de: 0 } } } },
            { brut: 6, face: 12, zone: "jambe gauche", decaler: null },
          ],
        }),
      }),
    );
    d20 = tous(noeud, ".combat-localisation button.combat-de");
    assert.deepEqual(d20.map((de) => [texteDe(de.querySelector(".combat-de-valeur")), texteDe(de.querySelector(".combat-de-detail")), de.getAttribute("aria-label")]), [
      ["14", "jambe droite", "Localisation : 14, jambe droite"],
      ["12", "jambe gauche", "Localisation : 12, dé 6, jambe gauche"],
    ]);
    assert.deepEqual(d20.map((de) => texteDe(de.querySelector(".combat-de-titre"))), ["d20", "d20 : 6"]);
    for (const de of d20) de.click();
    assert.deepEqual(appels, [], "un d20 lancé ne se relance pas");

    assert.equal(boutons(noeud, "Décaler").length, 1);
    const ligne = leBouton(noeud, "Décaler").parentNode;
    const nombre = ligne.querySelector("input[type=number]");
    assert.equal(texteDe(nombre.parentNode), "Décaler le dé 14 : jambe droite (de −13 à 5)");
    nombre.value = "-2";
    ligne.querySelector("input[type=text]").value = "Nez fin";
    leBouton(noeud, "Décaler").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "decaler", de: 0, valeur: -2, raison: "Nez fin" } }, origine: "panneau" }]);
    appels.length = 0;
    nombre.value = "6";
    leBouton(noeud, "Décaler").click();
    assert.deepEqual(appels, [], "la face décalée reste dans les bornes que donne la vue");

    // Un dé déjà décalé, qui se décale encore : le dé tiré, la face qu'il vaut maintenant, la zone de cette face.
    rendre(vueJet({ geste: gesteVu({ choix: [], localisation: [{ brut: 14, face: 16, zone: "bras gauche", decaler: { valeur: 2, raison: "Nez fin", min: -13, max: 5, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "decaler", de: 0 } } } }] }) }));
    const decale = leBouton(noeud, "Décaler").parentNode.querySelector("input[type=number]");
    assert.equal(texteDe(decale.parentNode), "Décaler le dé 14 : face 16, bras gauche (de −13 à 5)");
    assert.equal(decale.value, "2");

    rendre(vueJet({ geste: gesteVu({ localisation: null }) }));
    assert.equal(noeud.querySelector(".combat-localisation"), null);
  });
});

test("jet — l'esquive : combien, dans les bornes de la vue, rangé dans « x » ; le détail des dégâts ; « Appliquer »", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    rendre(
      vueJet({
        geste: gesteVu({
          choix: [],
          esquive: { libelle: "Pas de côté", min: 1, max: 6, gabarit: { evenement: { type: "esquive" } } },
          detail: [{ zone: "Jambe gauche", texte: "armure 10 → 1" }, { zone: null, texte: "corps 10 → 8" }],
          appliquer: { libelle: "Appliquer", commande: { evenement: { type: "appliquer" } } },
        }),
      }),
    );
    const ligne = leBouton(noeud, "Pas de côté").parentNode;
    const nombre = ligne.querySelector("input[type=number]");
    assert.equal(texteDe(nombre.parentNode), "Pas de côté, X (de 1 à 6)");
    assert.equal(nombre.value, "1");
    assert.equal(ligne.querySelector("input[type=text]"), null);
    nombre.value = "3";
    leBouton(noeud, "Pas de côté").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "esquive", x: 3 } }, origine: "panneau" }]);
    for (const refuse of ["0", "7"]) {
      nombre.value = refuse;
      leBouton(noeud, "Pas de côté").click();
    }
    assert.equal(appels.length, 1, "hors des bornes, l'esquive ne part pas");

    assert.deepEqual(tous(noeud, "ul.combat-detail li").map(texteDe), ["Jambe gauche : armure 10 → 1", "corps 10 → 8"]);
    leBouton(noeud, "Appliquer").click();
    assert.deepEqual(appels.at(-1), { commande: { evenement: { type: "appliquer" } }, origine: "panneau" });

    rendre(vueJet({ geste: gesteVu({ esquive: null, detail: null, appliquer: null }) }));
    assert.equal(boutons(noeud, "Pas de côté").length, 0);
    assert.equal(noeud.querySelector("ul.combat-detail"), null);
    assert.equal(boutons(noeud, "Appliquer").length, 0);
  });
});

test("jet — « Confirmer » d'une capacité sans jet, inactif tant que le geste n'est pas prêt ; « Revenir » avant le premier dé", () => {
  avecLeTelephone(({ noeud, rendre, appels }) => {
    const confirmer = { libelle: "Confirmer", actif: false, raison: "Choisissez une case d'arrivée.", commande: { evenement: { type: "confirmer" } } };
    rendre(vueDuGeste({ confirmer, revenir: { commande: { evenement: { type: "revenir" } } } }));
    const bouton = leBouton(noeud, "Confirmer");
    assert.equal(bouton.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${bouton.getAttribute("aria-describedby")}`)), "Choisissez une case d'arrivée.");
    bouton.click();
    assert.deepEqual(appels, []);
    leBouton(noeud, "Revenir").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "revenir" } }, origine: "panneau" }]);

    appels.length = 0;
    rendre(vueDuGeste({ confirmer: { ...confirmer, actif: true, raison: null }, revenir: null }));
    leBouton(noeud, "Confirmer").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "confirmer" } }, origine: "panneau" }]);
    assert.equal(boutons(noeud, "Revenir").length, 0, "après le premier dé, on ne revient plus");
  });
});

// ——— Les données hostiles ———

test("contenu — un nom hostile reste du texte ; un signe qui renverse l'écriture ne s'affiche pas, et n'entre dans aucun attribut", () => {
  const balise = "<img src=x onerror=alert(1)>";
  const renverse = String.fromCodePoint(0x202e);
  const attributsAvecLeSigne = (racine) => [racine, ...racine.descendants()].flatMap((n) => [...n.attributs].filter(([, valeur]) => valeur.includes(renverse)).map(([nom]) => `${n.tagName}@${nom}`));
  avecLeTelephone(({ noeud, rendre, annonce }) => {
    rendre(
      vueJet({
        entete: { titre: `${balise} contre ${renverse}Marmiton`, sous: balise },
        defenseur: balise,
        geste: gesteVu({
          description: balise,
          bilan: balise,
          cibles: [{ id: "adv3", libelle: balise, choisie: false, actif: true, raison: null, commande: regler("cible", "adv3") }],
          contexte: { ...gesteVu().contexte, causes: { ...CAUSES, nom: `${renverse}1 avantage : voir la cause`, phrases: [{ texte: balise, citation: `${renverse}${balise}`, sens: "avantage" }] }, defense: { libelle: "Défense :", options: [{ code: "agile", libelle: `${renverse}agile`, choisie: true, commande: regler("defense", "agile") }] } },
          // Un nom de zone vient de la banque : il entre dans le nom accessible du d20, et dans celui de sa saisie.
          localisation: [{ brut: 5, face: 7, zone: `${renverse}eton`, decaler: { min: -4, max: 14, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "decaler", de: 0 } } } }],
          cases: [{ case: "C3", nom: `Case C3 : ${renverse}s'y déplacer`, choisie: false, commande: regler("arrivee", "C3") }],
        }),
        annonce: { pas: 1, texte: `${renverse}${balise}` },
      }),
    );
    assert.equal(tous(noeud, "img").length, 0);
    assert.equal(tous(noeud, "script").length, 0);
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), `${balise} contre Marmiton`);
    assert.equal(texteDe(noeud.querySelector(".combat-cibles button")), balise);
    assert.equal(noeud.textContent.includes(renverse), false);
    assert.equal(annonce.textContent, balise);
    assert.equal(noeud.querySelector("button.combat-cause").getAttribute("aria-label"), "1 avantage : voir la cause");
    assert.equal(noeud.querySelector(".combat-localisation button.combat-de").getAttribute("aria-label"), "Localisation : 7, dé 5, eton");
    assert.equal(noeud.querySelector(".combat-arrivees button").getAttribute("aria-label"), "Case C3 : s'y déplacer");
    assert.deepEqual(attributsAvecLeSigne(noeud), []);
  });
  avecDom(() => {
    const hostile = ligneVue({ libelle: `${renverse}Frappe`, raison: balise, actif: false, survol: survolDe(balise, { origine: `${renverse}Couteau`, description: balise }) });
    const vue = vueListe({ groupes: [{ titre: balise, lignes: [hostile] }], passifs: [{ cle: "passif:1", libelle: `${renverse}${balise}`, survol: survolDe(balise) }] });
    const { lieu, liens } = composer(composerListe, vue);
    assert.equal(tous(lieu, "img").length, 0);
    assert.equal(texteDe(lieu.querySelector(".combat-groupe-titre")), balise);
    assert.equal(laLigne(lieu, "0:0").children[0].textContent, "Frappe");
    assert.equal(lieu.querySelector(".combat-passif").textContent, balise);
    assert.equal(lieu.textContent.includes(renverse), false);
    assert.deepEqual(attributsAvecLeSigne(lieu), []);
    const contenu = liens[0].options.contenu();
    assert.equal(contenu.some((n) => typeof n !== "string" && n.tagName === "IMG"), false);
    assert.deepEqual(contenu.map((n) => (typeof n === "string" ? n : n.textContent)).slice(0, 3), [balise, " · ", "Couteau"]);
  });
});

// ——— e) Le texte du module ———

test("combat_action.js — dom.js seul ; aucun focus qui fasse défiler, aucun défilement ; ni style, ni insertion de HTML, ni écouteur global ; les signes neufs par leur code ; son en-tête dit le § 17 et le contrat", () => {
  const source = readFileSync(new URL("../js/ecrans/combat_action.js", import.meta.url), "utf8");
  const entete = source.slice(0, source.search(/^import /m));
  assert.match(entete, /SPECIFICATION\.md, § 17/);
  assert.match(entete, /§ 9\.5 à § 9\.7/);
  assert.deepEqual([...source.matchAll(/^import .* from "(.*)";\r?$/gm)].map(([, chemin]) => chemin), ["./dom.js"]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.match(source, /^export function composerListe\(r, vue\) \{/m);
  assert.match(source, /^export function composerGeste\(r, vue\) \{/m);
  assert.match(source, /^export function creer\(actions, \{ lier/m);
  // Tout focus sans défiler (compl. § 4.5), écrit en toutes lettres ; aucun défilement de la page.
  const focus = [...source.matchAll(/\.focus\(([^)]*)\)/g)].map(([, options]) => options);
  assert.ok(focus.length > 0);
  for (const options of focus) assert.equal(options, "{ preventScroll: true }");
  assert.doesNotMatch(source, /scrollIntoView|scrollTo\b|scrollBy|window\.scroll|scrollTop\s*=/);
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write/);
  assert.doesNotMatch(source, /\.style\b|\bstyle\s*[:=]|setAttribute\(\s*["']style|cssText|setProperty/);
  assert.doesNotMatch(source, /\bconfirm\(|\balert\(|data-chargement|Chargement de/);
  assert.doesNotMatch(source, /\b(?:window|globalThis|document)\s*\.\s*addEventListener/);
  assert.doesNotMatch(source, /role\s*[:=]\s*["']status|aria-live["']?\s*:\s*["']assertive/);
  assert.equal([...source.matchAll(/aria-live/g)].length, 1, "une seule région polie, créée une fois");
  assert.doesNotMatch(source, /\bdisabled\s*:/, "un bouton inactif garde le focus : aria-disabled, jamais disabled");
  for (const code of [0xa0, 0x202f]) assert.equal(source.includes(String.fromCodePoint(code)), false, "aucune espace insécable");
  // Les signes neufs (contrat, § 0.2, règle 5) s'écrivent par leur code.
  for (const code of [0x24d8, 0x21b6, 0x2013, 0x2715]) assert.equal(source.includes(String.fromCodePoint(code)), false, `U+${code.toString(16)} par son code`);
  assert.ok(source.includes(`"${"\\"}u24d8"`), "« ⓘ » écrit par son code");
  // Ce qui quitte le code au groupe 2 : le titre à tiret, les pas de la puissance, la ligne des mentions.
  assert.doesNotMatch(source, /combat-qui-suite|bouton-pas|combat-puissance|combat-passifs|Interventions :/);
});
