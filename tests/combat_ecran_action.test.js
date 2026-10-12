// Contrôles du panneau d'action du simulateur de combat (SPECIFICATION.md,
// § 17 et § 11, domaine « Combat ») : js/ecrans/combat_action.js, dans le
// document simulé, sur des vues écrites à la main.
//
// Le panneau ne porte aucune règle : ces contrôles vérifient qu'il montre ce
// que dit la vue et qu'il émet la commande que la vue lui donne, avec son
// origine. Chaque règle est vue des deux côtés : le bouton actif qui émet et
// l'inactif qui se tait, la marque posée et la marque absente, le corps
// refait quand la vue change et gardé quand elle ne change pas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boutons, installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_action.js");

// ——— L'outillage ———

/** Un panneau dans le document simulé, et ce que ses boutons ont demandé. */
function monter() {
  const retirer = installerDom();
  const appels = [];
  const actions = {
    executer: (commande, origine) => appels.push({ commande, origine }),
    lancerLeDe: () => appels.push({ de: true }),
  };
  const panneau = creer(actions);
  globalThis.document.body.append(panneau.noeud);
  return { ...panneau, appels, retirer };
}

/** Joue un contrôle dans un panneau neuf, puis retire le document simulé. */
function avecPanneau(faire) {
  const monte = monter();
  try {
    faire(monte);
  } finally {
    monte.retirer();
  }
}

const tous = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)];
const leBouton = (noeud, debut) => {
  const trouves = boutons(noeud, debut);
  assert.equal(trouves.length, 1, `un seul bouton « ${debut} », trouvé ${trouves.length}`);
  return trouves[0];
};
const regler = (champ, valeur) => ({ evenement: { type: "regler", champ, valeur } });

/** Le bouton d'une capacité, tel que la vue le donne. */
const boutonVu = (champs = {}) => ({
  cle: "15:0",
  libelle: "Taloche [1]",
  degats: "2/4/8",
  cout: null,
  desavantage: false,
  choisi: false,
  actif: true,
  raison: null,
  commande: { evenement: { type: "capacite", qui: "pj1", capacite: 15, facon: 0 } },
  ...champs,
});

/** Le geste du contrat (§ 7.4) : Aubépine, Taloche contre le Marmiton n° 1, 8 puis 3 sur son d8. */
const gesteVu = (champs = {}) => ({
  description: "Une taloche qui inflige 2/4/8.",
  puissance: null,
  jetPrete: null,
  armes: null,
  cibles: [{ id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: true, actif: true, raison: null, commande: regler("cible", "adv3") }],
  sansCible: null,
  cases: null,
  caracteristiques: null,
  difficultes: null,
  x: null,
  jauges: null,
  contexte: {
    titre: "Jet d'attaque · Taloche [1] contre Marmiton de corvée n° 1",
    de: "d8+1",
    detail: "Force 4 + Agilité 5",
    modificateurs: ["+1 (Vif)"],
    difficulte: "5, sa défense",
    avantages: ["Solo du chef"],
    desavantages: [],
    net: "1 avantage",
    reglages: null,
  },
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

/** La vue du contrat (§ 7.4), au point de la maquette joué en démonstration. */
const vueAction = (champs = {}) => ({
  genre: "action",
  candidats: [],
  titre: "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10",
  etapes: [
    { nom: "Capacité", etat: "faite" },
    { nom: "Cible", etat: "faite" },
    { nom: "Jet d'attaque", etat: "en_cours" },
    { nom: "Localisation", etat: "a_venir" },
    { nom: "Interventions", etat: "a_venir" },
    { nom: "Dégâts", etat: "a_venir" },
  ],
  groupes: [
    { titre: "Couteau d'office (précise)", boutons: [boutonVu({ cle: "0:0", libelle: "Frappe", degats: "3/8/20", commande: { evenement: { type: "capacite", qui: "pj1", capacite: 0, facon: 0 } } })] },
    { titre: "Gestes de cuisine", boutons: [boutonVu({ choisi: true })] },
  ],
  passer: { actif: true, raison: null, commande: { evenement: { type: "passer", qui: "pj1" } } },
  mentions: { passifs: "Réduction [1], Vif [1], Solo du chef [1]", interventions: "Dressage minute, Pas de côté" },
  geste: gesteVu(),
  annonce: { pas: 12, texte: "2e dé : 4, échec. Relancer ou garder ?" },
  vainqueur: null,
  focus: "choix:relancer",
  ...champs,
});

/** Une vue réduite à un geste, pour regarder une seule de ses parties. */
const vueDuGeste = (champs, autres = {}) => vueAction({ geste: gesteVu({ contexte: null, chaine: [], bilan: null, lettres: [], choix: [], cibles: [], description: null, ...champs }), focus: null, annonce: null, ...autres });

// ——— Les nœuds stables ———

test("panneau d'action — une section nommée, son corps, la liste d'une case et la seule région polie, créés une fois", () => {
  avecPanneau(({ noeud, rendre, listeDeCase }) => {
    assert.equal(noeud.tagName, "SECTION");
    assert.equal(noeud.className, "combat-action");
    assert.equal(noeud.getAttribute("aria-label"), "Action en cours");
    assert.deepEqual(noeud.children.map((enfant) => enfant.className), ["combat-action-corps", "combat-case-liste", "combat-annonce"]);
    assert.equal(noeud.children[1], listeDeCase);
    assert.equal(listeDeCase.childNodes.length, 0, "la liste d'une case est vide : c'est l'écran qui la remplit");

    const [corps, , annonce] = noeud.children;
    rendre(vueAction());
    rendre(vueAction({ titre: "Aubépine Crèmebrûlée joue — 0 action sur 2, souffle 10", annonce: { pas: 13, texte: "1er dé : 9, réussi." } }));
    assert.deepEqual(noeud.children, [corps, listeDeCase, annonce], "les trois nœuds ne sont jamais refaits");
    assert.equal(tous(noeud, "[aria-live]").length, 1);
    assert.equal(annonce.getAttribute("aria-live"), "polite");
    assert.equal(annonce.tagName, "P");
    assert.equal(tous(noeud, "[role]").length, 0, "ni role=status ni role=alert dans le panneau");
    assert.equal(listeDeCase.childNodes.length, 0, "un rendu ne touche pas la liste d'une case");
  });
});

// ——— Qui joue, la fin, la préparation ———

test("panneau d'action — « Qui joue ? » : un bouton par candidat, à son nom entier, qui émet « choisir » depuis le panneau", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre({
      genre: "qui_joue",
      candidats: [
        { id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } },
        { id: "pj2", nom: "Basile Croûton", commande: { choisir: "pj2" } },
      ],
      geste: null,
      annonce: null,
      focus: null,
    });
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Qui joue ?");
    assert.deepEqual(tous(noeud, "button").map(texteDe), ["Aubépine Crèmebrûlée", "Basile Croûton"]);
    leBouton(noeud, "Basile").click();
    assert.deepEqual(appels, [{ commande: { choisir: "pj2" }, origine: "panneau" }]);
    assert.equal(noeud.querySelector(".combat-etapes"), null);

    // Sans candidat : le titre seul, et aucun bouton.
    rendre({ genre: "qui_joue", candidats: [], geste: null, annonce: null, focus: null });
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Qui joue ?");
    assert.equal(tous(noeud, "button").length, 0);
  });
});

test("panneau d'action — combat terminé : la phrase du vainqueur, sans bouton ; en préparation : un corps vide", () => {
  avecPanneau(({ noeud, rendre }) => {
    rendre({ genre: "termine", vainqueur: "Combat terminé : victoire des PJ.", candidats: [], geste: null, annonce: null, focus: null });
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Combat terminé : victoire des PJ.");
    assert.equal(tous(noeud, "button").length, 0);

    rendre({ genre: "termine", vainqueur: "Combat terminé : victoire des adversaires.", candidats: [], geste: null, annonce: null, focus: null });
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Combat terminé : victoire des adversaires.");

    rendre({ genre: "preparation", candidats: [], geste: null, annonce: null, focus: null });
    assert.equal(noeud.querySelector(".combat-action-corps").childNodes.length, 0);
  });
});

// ——— Le titre, les étapes ———

test("panneau d'action — le titre tel que la vue l'écrit ; chaque étape faite, en cours ou à venir", () => {
  avecPanneau(({ noeud, rendre }) => {
    rendre(vueAction());
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10");
    // Qui joue se lit d'abord : la suite (ses actions, son souffle) est dans
    // un morceau à part, que la feuille écrit plus bas, comme sur la maquette.
    // La coupe ne change pas le texte.
    const titre = noeud.querySelector("h2.combat-qui");
    assert.equal(titre.textContent, "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10");
    assert.equal(titre.children.length, 1);
    assert.equal(titre.children[0].className, "combat-qui-suite");
    assert.equal(titre.children[0].textContent, " — 1 action sur 2, souffle 10");
    // Un nom qui porte lui-même un tiret reste entier devant : la coupe est au dernier.
    rendre(vueAction({ titre: "Aubépine — dite la Brûlée joue — 2 actions sur 2, souffle 10" }));
    assert.equal(noeud.querySelector("h2.combat-qui").textContent, "Aubépine — dite la Brûlée joue — 2 actions sur 2, souffle 10");
    assert.equal(noeud.querySelector(".combat-qui-suite").textContent, " — 2 actions sur 2, souffle 10");
    // Sans tiret, rien ne se coupe.
    rendre(vueAction({ titre: "Aubépine Crèmebrûlée joue" }));
    assert.equal(noeud.querySelector("h2.combat-qui").children.length, 0);
    rendre(vueAction());
    const etapes = tous(noeud, "ol.combat-etapes li");
    assert.deepEqual(etapes.map(texteDe), ["Capacité", "Cible", "Jet d'attaque", "Localisation", "Interventions", "Dégâts"]);
    assert.deepEqual(etapes.map((li) => li.className), ["fait", "fait", "en-cours", "", "", ""]);
    assert.deepEqual(etapes.map((li) => li.getAttribute("aria-current")), [null, null, "step", null, null, null]);

    // Un déplacement : deux étapes, la seconde en cours.
    rendre(vueAction({ etapes: [{ nom: "Capacité", etat: "faite" }, { nom: "Arrivée", etat: "en_cours" }] }));
    assert.deepEqual(tous(noeud, "ol.combat-etapes li").map((li) => [texteDe(li), li.className, li.getAttribute("aria-current")]), [["Capacité", "fait", null], ["Arrivée", "en-cours", "step"]]);

    // Sans étape, pas de liste vide.
    rendre(vueAction({ etapes: [] }));
    assert.equal(noeud.querySelector("ol.combat-etapes"), null);
  });
});

// ——— Les capacités ———

test("panneau d'action — les groupes dans l'ordre de la vue ; un bouton porte sa puissance, ses dégâts, son coût et « désavantage », et rien de ce que la vue ne dit pas", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(
      vueAction({
        groupes: [
          { titre: "Couteau d'office (précise)", boutons: [boutonVu({ cle: "0:0", libelle: "Frappe", degats: "3/8/20" }), boutonVu({ cle: "1:0", libelle: "Émincer", degats: "3/8/20", cout: "5 souffle", desavantage: true, commande: { evenement: { type: "capacite", qui: "pj1", capacite: 1, facon: 0 } } })] },
          { titre: "Saucier", boutons: [boutonVu({ cle: "4:0", libelle: "Fournaise [1]", degats: null, cout: "1 souffle, 1 lien" })] },
          { titre: "Gestes de cuisine", boutons: [boutonVu({ cle: "9:0", libelle: "Pas chassé [1]", degats: null }), boutonVu({ choisi: true })] },
        ],
      }),
    );
    const groupes = tous(noeud, ".combat-groupe");
    assert.deepEqual(groupes.map((g) => texteDe(g.querySelector("h3.combat-groupe-titre"))), ["Couteau d'office (précise)", "Saucier", "Gestes de cuisine"]);

    const emincer = leBouton(noeud, "Émincer");
    assert.equal(emincer.className, "combat-capacite");
    assert.equal(emincer.getAttribute("type"), "button");
    assert.equal(texteDe(emincer.querySelector(".combat-degats")), "3/8/20");
    assert.equal(texteDe(emincer.querySelector(".combat-cout")), "5 souffle");
    assert.equal(texteDe(emincer.querySelector(".combat-desavantage")), "désavantage");
    assert.equal(emincer.getAttribute("aria-pressed"), "false");

    // Dans l'autre sens : ni dégâts pour ce qui n'est pas une attaque, ni coût nul, ni désavantage absent.
    const pasChasse = leBouton(noeud, "Pas chassé [1]");
    assert.equal(texteDe(pasChasse), "Pas chassé [1]");
    assert.equal(pasChasse.querySelector(".combat-degats"), null);
    assert.equal(pasChasse.querySelector(".combat-cout"), null);
    assert.equal(pasChasse.querySelector(".combat-desavantage"), null);
    const fournaise = leBouton(noeud, "Fournaise [1]");
    assert.equal(fournaise.querySelector(".combat-degats"), null);
    assert.equal(texteDe(fournaise.querySelector(".combat-cout")), "1 souffle, 1 lien");

    // La capacité choisie est enfoncée, elle seule.
    assert.deepEqual(tous(noeud, ".combat-groupe button[aria-pressed=true]").map(texteDe), ["Taloche [1] 2/4/8"]);

    emincer.click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "capacite", qui: "pj1", capacite: 1, facon: 0 } }, origine: "panneau" }]);
  });
});

test("panneau d'action — un bouton inactif garde le focus, dit pourquoi, et ne fait rien ; un bouton actif n'a ni raison ni aria-disabled", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(
      vueAction({
        groupes: [
          {
            titre: "Couteau d'office (précise)",
            boutons: [
              boutonVu({ cle: "0:0", libelle: "Frappe" }),
              boutonVu({ cle: "1:0", libelle: "Émincer", actif: false, raison: "il manque du souffle (5)" }),
              boutonVu({ cle: "2:0", libelle: "Flambage", actif: false, raison: "absente de la banque", commande: undefined }),
            ],
          },
        ],
      }),
    );
    const emincer = leBouton(noeud, "Émincer");
    assert.equal(emincer.getAttribute("aria-disabled"), "true");
    assert.equal(emincer.disabled, false, "aria-disabled, jamais disabled : le bouton garde le focus");
    assert.equal(emincer.hasAttribute("disabled"), false);
    const raison = noeud.querySelector(`#${emincer.getAttribute("aria-describedby")}`);
    assert.equal(texteDe(raison), "il manque du souffle (5)");
    assert.equal(raison.parentNode, emincer.parentNode, "la raison est à côté du bouton, jamais dedans");
    // Juste après lui, avec sa classe : c'est ainsi que la feuille la montre
    // sous la rangée quand on survole le bouton ou qu'il a le focus, et la
    // tient hors de la vue le reste du temps.
    const rangee = emincer.parentNode.children;
    assert.equal(rangee[rangee.indexOf(emincer) + 1], raison);
    assert.equal(raison.className, "combat-raison");
    assert.equal(raison.tagName, "SPAN");

    const flambage = leBouton(noeud, "Flambage");
    assert.equal(texteDe(noeud.querySelector(`#${flambage.getAttribute("aria-describedby")}`)), "absente de la banque");
    assert.notEqual(flambage.getAttribute("aria-describedby"), emincer.getAttribute("aria-describedby"), "chaque raison a son identifiant");

    emincer.click();
    flambage.click();
    assert.deepEqual(appels, [], "un bouton inactif ne fait rien, même cliqué");

    const frappe = leBouton(noeud, "Frappe");
    assert.equal(frappe.hasAttribute("aria-disabled"), false);
    assert.equal(frappe.hasAttribute("aria-describedby"), false);
    frappe.click();
    assert.equal(appels.length, 1);
    assert.equal(tous(noeud, "button[disabled]").length, 0);
  });
});

test("panneau d'action — « Passer son tour » ferme le dernier groupe ; il émet « passer », ou dit pourquoi il ne le peut pas", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueAction());
    const groupes = tous(noeud, ".combat-groupe");
    assert.deepEqual(tous(groupes.at(-1), "button").map(texteDe), ["Taloche [1] 2/4/8", "Passer son tour"]);
    assert.equal(boutons(groupes[0], "Passer").length, 0);
    leBouton(noeud, "Passer son tour").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "passer", qui: "pj1" } }, origine: "panneau" }]);

    // Sans aucun groupe, il reste là.
    rendre(vueAction({ groupes: [] }));
    assert.equal(leBouton(noeud, "Passer son tour").parentNode.className, "combat-groupe");

    // Inactif : sa raison, et rien d'émis.
    appels.length = 0;
    rendre(vueAction({ passer: { actif: false, raison: "Une action est en cours.", commande: { evenement: { type: "passer", qui: "pj1" } } } }));
    const passer = leBouton(noeud, "Passer son tour");
    assert.equal(passer.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${passer.getAttribute("aria-describedby")}`)), "Une action est en cours.");
    passer.click();
    assert.deepEqual(appels, []);

    // Sans « passer » dans la vue, pas de bouton.
    rendre(vueAction({ passer: null }));
    assert.equal(boutons(noeud, "Passer").length, 0);
  });
});

test("panneau d'action — une ligne nomme les interventions et les passifs, sans en faire des boutons", () => {
  avecPanneau(({ noeud, rendre }) => {
    rendre(vueAction());
    const ligne = noeud.querySelector("p.combat-passifs");
    assert.equal(texteDe(ligne), "Interventions : Dressage minute, Pas de côté. Passifs : Réduction [1], Vif [1], Solo du chef [1].");
    assert.equal(tous(ligne, "button").length, 0);
    assert.equal(boutons(noeud, "Solo du chef").length, 0);

    rendre(vueAction({ mentions: { passifs: "Vif [1]", interventions: null } }));
    assert.equal(texteDe(noeud.querySelector("p.combat-passifs")), "Passifs : Vif [1].");
    rendre(vueAction({ mentions: { passifs: "", interventions: "Pas de côté" } }));
    assert.equal(texteDe(noeud.querySelector("p.combat-passifs")), "Interventions : Pas de côté.");
    rendre(vueAction({ mentions: { passifs: null, interventions: null } }));
    assert.equal(noeud.querySelector("p.combat-passifs"), null);
  });
});

// ——— Le geste, avant les dés ———

test("panneau d'action — la puissance : + et − émettent leur commande ; à la borne, le bouton se tait et dit pourquoi", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    const puissance = { valeur: 2, moins: { actif: true, commande: regler("facon", 0) }, plus: { actif: false, raison: "il manque du souffle (2)", commande: regler("facon", 2) } };
    rendre(vueDuGeste({ puissance }));
    const ligne = noeud.querySelector(".combat-puissance");
    assert.equal(texteDe(ligne.querySelector(".combat-puissance-valeur")), "2");
    const [moins, plus] = tous(ligne, "button");
    assert.equal(moins.getAttribute("aria-label"), "Baisser la puissance");
    assert.equal(plus.getAttribute("aria-label"), "Monter la puissance");
    assert.equal(plus.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${plus.getAttribute("aria-describedby")}`)), "il manque du souffle (2)");
    plus.click();
    assert.deepEqual(appels, []);
    moins.click();
    assert.deepEqual(appels, [{ commande: regler("facon", 0), origine: "panneau" }]);

    rendre(vueDuGeste({ puissance: null }));
    assert.equal(noeud.querySelector(".combat-puissance"), null);
  });
});

test("panneau d'action — « Jet d'attaque » prête le jet d'une arme, qu'il nomme ; un adversaire à plusieurs armes choisit la sienne", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueDuGeste({ jetPrete: { presse: false, actif: true, raison: null, commande: regler("jet_prete", true), arme: "Couteau d'office" } }));
    const pret = leBouton(noeud, "Jet d'attaque");
    assert.equal(texteDe(pret), "Jet d'attaque (Couteau d'office)");
    assert.equal(pret.getAttribute("aria-pressed"), "false");
    assert.equal(noeud.querySelector(".combat-armes"), null);
    pret.click();
    assert.deepEqual(appels, [{ commande: regler("jet_prete", true), origine: "panneau" }]);

    appels.length = 0;
    rendre(
      vueDuGeste({
        jetPrete: { presse: true, actif: true, raison: null, commande: regler("jet_prete", false), arme: "Spatule souple" },
        armes: [
          { libelle: "Spatule souple", choisie: true, commande: regler("arme_pretee", 0) },
          { libelle: "Spatule souple (2)", choisie: false, commande: regler("arme_pretee", 1) },
        ],
      }),
    );
    assert.equal(leBouton(noeud, "Jet d'attaque").getAttribute("aria-pressed"), "true");
    const armes = tous(noeud, ".combat-armes button");
    assert.deepEqual(armes.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Spatule souple", "true"], ["Spatule souple (2)", "false"]]);
    armes[1].click();
    assert.deepEqual(appels, [{ commande: regler("arme_pretee", 1), origine: "panneau" }]);

    // « sans arme » se dit, et un jet prêté qui ne se peut pas dit pourquoi.
    appels.length = 0;
    rendre(vueDuGeste({ jetPrete: { presse: false, actif: false, raison: "aucune cible adverse à portée", commande: regler("jet_prete", true), arme: "sans arme" } }));
    const inactif = leBouton(noeud, "Jet d'attaque");
    assert.equal(texteDe(inactif), "Jet d'attaque (sans arme)");
    assert.equal(texteDe(noeud.querySelector(`#${inactif.getAttribute("aria-describedby")}`)), "aucune cible adverse à portée");
    inactif.click();
    assert.deepEqual(appels, []);
  });
});

test("panneau d'action — la cible : un bouton par cible possible ; « choisie sur la carte », « choisie ici », rien sans origine", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    const cibles = [
      { id: "adv3", libelle: "Marmiton de corvée n° 1", choisie: true, actif: true, raison: null, commande: regler("cible", "adv3") },
      { id: "adv4", libelle: "Marmiton de corvée n° 2", choisie: false, actif: true, raison: null, commande: regler("cible", "adv4") },
      { id: "adv2", libelle: "Chef de partie", choisie: false, actif: false, raison: "hors de portée", commande: regler("cible", "adv2") },
    ];
    const vue = vueDuGeste({ cibles });

    rendre(vue, { origineDeLaCible: "plateau" });
    const rangee = noeud.querySelector(".combat-cibles");
    const lesBoutons = tous(rangee, "button");
    assert.deepEqual(lesBoutons.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Marmiton de corvée n° 1", "true"], ["Marmiton de corvée n° 2", "false"], ["Chef de partie", "false"]]);
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie sur la carte"]);
    // La mention suit la cible choisie, et elle seule.
    assert.equal(rangee.children[rangee.children.indexOf(lesBoutons[0]) + 1].className, "combat-origine");

    rendre(vue, { origineDeLaCible: "panneau" });
    assert.deepEqual(tous(noeud, ".combat-origine").map(texteDe), ["choisie ici"]);

    // Sans origine (après un rechargement), ou sans cible choisie : rien.
    rendre(vue, { origineDeLaCible: null });
    assert.equal(tous(noeud, ".combat-origine").length, 0);
    rendre(vue);
    assert.equal(tous(noeud, ".combat-origine").length, 0);
    rendre(vueDuGeste({ cibles: cibles.map((cible) => ({ ...cible, choisie: false })) }), { origineDeLaCible: "plateau" });
    assert.equal(tous(noeud, ".combat-origine").length, 0);

    // Un clic émet le réglage de la cible, depuis le panneau ; une cible hors de portée ne se choisit pas.
    leBouton(noeud, "Marmiton de corvée n° 2").click();
    assert.deepEqual(appels, [{ commande: regler("cible", "adv4"), origine: "panneau" }]);
    const chef = leBouton(noeud, "Chef de partie");
    assert.equal(chef.getAttribute("aria-disabled"), "true");
    assert.equal(texteDe(noeud.querySelector(`#${chef.getAttribute("aria-describedby")}`)), "hors de portée");
    chef.click();
    assert.equal(appels.length, 1);
  });
});

test("panneau d'action — une capacité sans jet offre « Sans cible » ; sans cible ni « Sans cible », pas de rangée", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
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

test("panneau d'action — un déplacement : un bouton par case d'arrivée possible, la case choisie enfoncée", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueDuGeste({ cases: [{ case: "C3", choisie: false, commande: regler("arrivee", "C3") }, { case: "D4", choisie: true, commande: regler("arrivee", "D4") }] }));
    const cases = tous(noeud, ".combat-arrivees button");
    assert.deepEqual(cases.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["C3", "false"], ["D4", "true"]]);
    cases[0].click();
    assert.deepEqual(appels, [{ commande: regler("arrivee", "C3"), origine: "panneau" }]);

    rendre(vueDuGeste({ cases: null }));
    assert.equal(noeud.querySelector(".combat-arrivees"), null);
  });
});

test("panneau d'action — les caractéristiques d'un dé au choix : une ou deux, émises par le gabarit de la vue", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
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
    assert.match(texteDe(rangee), /d8/);
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

test("panneau d'action — la difficulté et la jauge de lien : un bouton par option, la choisie enfoncée", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(
      vueDuGeste({
        difficultes: [{ valeur: 5, libelle: "moyen", choisie: false, commande: regler("difficulte", 5) }, { valeur: 6, libelle: "compliqué", choisie: true, commande: regler("difficulte", 6) }],
        jauges: [{ nom: "Grand Four", choisie: true, commande: regler("jauge", 0) }, { nom: "Petit Four", choisie: false, commande: regler("jauge", 1) }],
      }),
    );
    const difficultes = tous(noeud, ".combat-difficultes button");
    assert.deepEqual(difficultes.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["5 (moyen)", "false"], ["6 (compliqué)", "true"]]);
    difficultes[0].click();
    const jauges = tous(noeud, ".combat-jauges button");
    assert.deepEqual(jauges.map((b) => [texteDe(b), b.getAttribute("aria-pressed")]), [["Grand Four", "true"], ["Petit Four", "false"]]);
    jauges[1].click();
    assert.deepEqual(appels, [{ commande: regler("difficulte", 5), origine: "panneau" }, { commande: regler("jauge", 1), origine: "panneau" }]);

    rendre(vueDuGeste({ difficultes: null, jauges: null }));
    assert.equal(noeud.querySelector(".combat-difficultes"), null);
    assert.equal(noeud.querySelector(".combat-jauges"), null);
  });
});

test("panneau d'action — X : la saisie porte ses bornes, émet le gabarit complété, et se tait hors de ses bornes", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
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

    // Hors des bornes, pas un entier, vide : rien ne part, et le champ le dit.
    for (const refuse of ["6", "-1", "2,5", "1.5", "", "deux", "1e1"]) {
      appels.length = 0;
      champ.value = refuse;
      leBouton(noeud, "Régler X").click();
      assert.deepEqual(appels, [], `« ${refuse} » ne part pas`);
      assert.equal(champ.getAttribute("aria-invalid"), "true");
    }
    // Les bornes elles-mêmes passent, et le champ n'est plus marqué.
    for (const [texte, valeur] of [["0", 0], ["5", 5], [" 3 ", 3]]) {
      appels.length = 0;
      champ.value = texte;
      leBouton(noeud, "Régler X").click();
      assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "x", valeur } }, origine: "panneau" }]);
      assert.equal(champ.hasAttribute("aria-invalid"), false);
    }
    // La touche Entrée vaut le bouton ; une autre touche, non.
    appels.length = 0;
    champ.value = "1";
    champ.declencher("keydown", { key: "a" });
    assert.deepEqual(appels, []);
    champ.declencher("keydown", { key: "Enter" });
    assert.equal(appels.length, 1);
  });
});

// ——— Les dés ———

test("panneau d'action — le contexte : le jet, la capacité et la cible ; le dé, ses modificateurs et la difficulté ; les avantages et leurs sources", () => {
  avecPanneau(({ noeud, rendre }) => {
    rendre(vueAction());
    const lignes = tous(noeud, ".combat-des .combat-jet .combat-contexte p").map(texteDe);
    assert.deepEqual(lignes, ["Jet d'attaque · Taloche [1] contre Marmiton de corvée n° 1", "Dé d8+1 (Force 4 + Agilité 5) · +1 (Vif) · difficulté 5, sa défense", "1 avantage · Avantages : Solo du chef"]);

    // Dans l'autre sens : des désavantages, pas d'avantage, pas de modificateur.
    rendre(vueAction({ geste: gesteVu({ contexte: { titre: "Jet de défense · Frappe de Marmiton de corvée n° 1", de: "d8", detail: null, modificateurs: [], difficulte: "5, son attaque", avantages: [], desavantages: ["types d'armure mêlés", "Blessure"], net: "2 désavantages", reglages: null } }) }));
    assert.deepEqual(tous(noeud, ".combat-contexte p").map(texteDe), ["Jet de défense · Frappe de Marmiton de corvée n° 1", "Dé d8 · difficulté 5, son attaque", "2 désavantages · Désavantages : types d'armure mêlés, Blessure"]);

    // Ni avantage ni désavantage : pas de troisième ligne ; sans contexte : rien.
    rendre(vueAction({ geste: gesteVu({ contexte: { titre: "Jet de caractéristique · Goûter", de: "d6", detail: "Sens 3 + Parole 3", modificateurs: [], difficulte: null, avantages: [], desavantages: [], net: null, reglages: null } }) }));
    assert.deepEqual(tous(noeud, ".combat-contexte p").map(texteDe), ["Jet de caractéristique · Goûter", "Dé d6 (Sens 3 + Parole 3)"]);
    rendre(vueAction({ geste: gesteVu({ contexte: null }) }));
    assert.equal(noeud.querySelector(".combat-contexte"), null);
  });
});

test("panneau d'action — les réglages à la main, avant le premier dé : un nombre et sa raison ; jamais une raison vide", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    const reglages = {
      modificateur: { valeur: 0, raison: null, min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "modificateur" } } },
      avantages: { valeur: 1, raison: "Minutie", min: -20, max: 20, raisonParDefaut: "Taloche", gabarit: { evenement: { type: "regler", champ: "avantages" } } },
    };
    rendre(vueAction({ geste: gesteVu({ contexte: { ...gesteVu().contexte, reglages } }) }));
    const aside = noeud.querySelector(".combat-des aside.combat-reglages");
    // Le texte de la capacité sous son titre (celui de la maquette), puis les réglages sous le leur.
    assert.deepEqual(tous(aside, "h3").map(texteDe), ["Effets de capacité (mode assisté)", "Réglages à la main"]);
    assert.deepEqual(aside.children.slice(0, 3).map((enfant) => `${enfant.tagName} ${enfant.className}`), ["H3 ", "P combat-description", "H3 "]);
    const [modificateur, avantages] = tous(aside, "input[type=number]");
    const [raisonDuModificateur, raisonDesAvantages] = tous(aside, "input[type=text]");
    assert.equal(texteDe(modificateur.parentNode), "Modificateur de chaque dé (de −20 à 20)");
    assert.equal(modificateur.value, "0");
    assert.equal(raisonDuModificateur.value, "Taloche", "la raison par défaut est proposée");
    assert.equal(avantages.value, "1");
    assert.equal(raisonDesAvantages.value, "Minutie", "la raison déjà donnée est reprise");

    modificateur.value = "-2";
    raisonDuModificateur.value = "  Inspiration ";
    leBouton(aside, "Régler le modificateur").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "modificateur", valeur: -2, raison: "Inspiration" } }, origine: "panneau" }]);

    // Une raison vide ne part jamais : avec un nombre non nul, rien ne s'émet.
    appels.length = 0;
    raisonDuModificateur.value = "   ";
    leBouton(aside, "Régler le modificateur").click();
    assert.deepEqual(appels, []);
    assert.equal(raisonDuModificateur.getAttribute("aria-invalid"), "true");
    // À zéro, le réglage s'efface sans raison : le champ « raison » n'est pas dans l'événement.
    modificateur.value = "0";
    leBouton(aside, "Régler le modificateur").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "modificateur", valeur: 0 } }, origine: "panneau" }]);
    assert.equal(Object.hasOwn(appels[0].commande.evenement, "raison"), false);
    assert.equal(raisonDuModificateur.hasAttribute("aria-invalid"), false);

    // Hors des bornes de la vue : rien.
    appels.length = 0;
    avantages.value = "21";
    leBouton(aside, "Régler les avantages").click();
    assert.deepEqual(appels, []);
    avantages.value = "-20";
    leBouton(aside, "Régler les avantages").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "regler", champ: "avantages", valeur: -20, raison: "Minutie" } }, origine: "panneau" }]);

    // Après le premier dé, la vue n'offre plus de réglage : plus de champ.
    rendre(vueAction());
    assert.equal(tous(noeud, ".combat-reglages input").length, 0);
    assert.equal(texteDe(noeud.querySelector(".combat-reglages .combat-description")), "Une taloche qui inflige 2/4/8.");
    assert.deepEqual(tous(noeud, ".combat-reglages h3").map(texteDe), ["Effets de capacité (mode assisté)"]);
    // Des réglages sans description : leur seul titre.
    rendre(vueAction({ geste: gesteVu({ description: null, contexte: { ...gesteVu().contexte, reglages } }) }));
    assert.deepEqual(tous(noeud, ".combat-reglages h3").map(texteDe), ["Réglages à la main"]);
    // Sans description ni réglage, pas d'encart.
    rendre(vueAction({ geste: gesteVu({ description: null }) }));
    assert.equal(noeud.querySelector(".combat-reglages"), null);
  });
});

test("panneau d'action — la chaîne : un dé par entrée, son état en classe, en signe et en nom ; seul le dé attendu se lance", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueAction());
    let des = tous(noeud, ".combat-chaine button.combat-de");
    assert.deepEqual(des.map((de) => de.className), ["combat-de reussi", "combat-de echoue", "combat-de a-venir"]);
    assert.deepEqual(des.map((de) => tous(de, "span").map((span) => `${span.className}=${texteDe(span)}`)), [
      ["combat-de-titre=1er dé", "combat-de-valeur=9", "combat-de-detail=8 + 1 ✓"],
      ["combat-de-titre=2e dé", "combat-de-valeur=4", "combat-de-detail=3 + 1 ✗"],
      ["combat-de-titre=3e dé", "combat-de-valeur=d8"],
    ]);
    assert.deepEqual(des.map((de) => de.getAttribute("aria-label")), ["1er dé : 9 (8 + 1), réussi", "2e dé : 4 (3 + 1), échec", "3e dé : d8, à venir"]);
    // Aucun dé n'est attendu : aucun ne lance rien.
    for (const de of des) de.click();
    assert.deepEqual(appels, []);
    assert.deepEqual(des.map((de) => de.getAttribute("aria-disabled")), ["true", "true", "true"]);

    // Après « relancer » (contrat, § 7.4) : le dé relancé, puis celui de la relance, à cliquer.
    rendre(
      vueAction({
        geste: gesteVu({
          chaine: [
            { titre: "1er dé", etat: "reussi", valeur: 9, detail: "8 + 1" },
            { titre: "2e dé", etat: "relance", valeur: 4, detail: "3 + 1" },
            { titre: "relance", etat: "a_lancer", de: "d8" },
            { titre: "3e dé", etat: "a_venir", de: "d8" },
          ],
          aLancer: { faces: 8, combien: 1, libelle: "d8", motif: "relance" },
          choix: [],
          bilan: "Avantage dépensé : cliquez sur le d8 pour relancer le 2e dé.",
        }),
        focus: "de",
      }),
    );
    des = tous(noeud, ".combat-chaine button.combat-de");
    assert.deepEqual(des.map((de) => de.className), ["combat-de reussi", "combat-de relance", "combat-de a-lancer", "combat-de a-venir"]);
    assert.equal(texteDe(des[1].querySelector(".combat-de-detail")), "relancé");
    assert.equal(texteDe(des[2].querySelector(".combat-de-valeur")), "d8");
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
    rendre(vueAction({ geste: gesteVu({ chaine: [{ titre: "1er dé", etat: "echoue", valeur: 2, detail: null }] }) }));
    assert.equal(texteDe(noeud.querySelector(".combat-de .combat-de-detail")), "✗");
    assert.equal(noeud.querySelector(".combat-de").getAttribute("aria-label"), "1er dé : 2, échec");
  });
});

test("panneau d'action — le dé attendu que la chaîne ne montre pas reste cliquable ; une entrée « à lancer » sans dé attendu ne lance rien", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueAction({ geste: gesteVu({ chaine: [], aLancer: { faces: 8, combien: 2, libelle: "d8", motif: "chaine" }, choix: [] }) }));
    const des = tous(noeud, ".combat-chaine button.combat-de");
    assert.equal(des.length, 1);
    assert.equal(des[0].className, "combat-de a-lancer");
    assert.equal(des[0].getAttribute("aria-label"), "Dé : lancer le d8");
    des[0].click();
    assert.deepEqual(appels, [{ de: true }], "un clic, un dé, même sous désavantage");

    appels.length = 0;
    rendre(vueAction({ geste: gesteVu({ chaine: [{ titre: "1er dé", etat: "a_lancer", de: "d8" }], aLancer: null, choix: [] }) }));
    const seul = noeud.querySelector(".combat-chaine button.combat-de");
    seul.click();
    assert.deepEqual(appels, []);
    assert.equal(seul.getAttribute("aria-disabled"), "true");
  });
});

test("panneau d'action — le bilan visible, à part de l'annonce ; les rangs de dégâts, le rang atteint en évidence", () => {
  avecPanneau(({ noeud, rendre }) => {
    rendre(vueAction());
    assert.equal(texteDe(noeud.querySelector("p.combat-bilan")), "1 réussite pour l'instant. Le 2e dé échoue : il reste 1 avantage.");
    assert.equal(noeud.querySelector("p.combat-bilan").hasAttribute("aria-live"), false);
    const lettres = tous(noeud, "ul.combat-lettres li");
    assert.deepEqual(lettres.map((li) => [texteDe(li), li.className]), [["1 réussite : 2", "atteinte"], ["2 : 4", ""], ["3 : 8", ""], ["Réduction : +1 contre l'armure par réussite", ""]]);

    rendre(vueAction({ geste: gesteVu({ bilan: null, lettres: [{ texte: "1 réussite : 2" }, { texte: "2 : 4", atteinte: true }] }) }));
    assert.equal(noeud.querySelector("p.combat-bilan"), null);
    assert.deepEqual(tous(noeud, "ul.combat-lettres li").map((li) => li.className), ["", "atteinte"]);
    rendre(vueAction({ geste: gesteVu({ lettres: [] }) }));
    assert.equal(noeud.querySelector("ul.combat-lettres"), null);
  });
});

test("panneau d'action — les choix du moment : relancer ou garder, faire exploser, chacun émet sa commande", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(vueAction());
    leBouton(noeud, "Relancer le 2e dé").click();
    leBouton(noeud, "Garder ce dé").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "relancer" } }, origine: "panneau" }, { commande: { evenement: { type: "garder" } }, origine: "panneau" }]);

    appels.length = 0;
    rendre(vueAction({ geste: gesteVu({ choix: [{ cle: "exploser", libelle: "Faire exploser", commande: { evenement: { type: "exploser" } } }] }) }));
    assert.equal(boutons(noeud, "Relancer").length, 0);
    leBouton(noeud, "Faire exploser").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "exploser" } }, origine: "panneau" }]);

    rendre(vueAction({ geste: gesteVu({ choix: [] }) }));
    assert.equal(noeud.querySelector(".combat-choix"), null);
  });
});

test("panneau d'action — fixer les dégâts : la base, la nature, et un nombre avec sa raison, rangés dans l'opération « ajuster »", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
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
    rendre(vueAction({ geste: gesteVu({ choix: [], degats }) }));
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

    rendre(vueAction({ geste: gesteVu({ degats: null }) }));
    assert.equal(boutons(noeud, "Fixer les dégâts").length, 0);
  });
});

test("panneau d'action — la localisation : les d20 lancés, le d20 attendu à cliquer, et la face à décaler avec sa raison", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    // Le d20 attendu : un dé à cliquer, hors de la chaîne du jet.
    rendre(vueAction({ geste: gesteVu({ choix: [], aLancer: { faces: 20, combien: 1, libelle: "d20", motif: "localisation" }, localisation: [] }), focus: "de" }));
    assert.equal(tous(noeud, ".combat-chaine").length, 2);
    assert.equal(tous(noeud, ".combat-chaine")[0].querySelector(".a-lancer"), null, "la chaîne du jet ne reçoit pas le d20");
    let d20 = tous(noeud, ".combat-localisation button.combat-de");
    assert.deepEqual(d20.map((de) => [de.className, de.getAttribute("aria-label"), de.getAttribute("data-focus")]), [["combat-de a-lancer", "Localisation : lancer le d20", "de"]]);
    d20[0].click();
    assert.deepEqual(appels, [{ de: true }]);

    // Deux d20 lancés, le second décalé ; le premier seul se décale encore.
    appels.length = 0;
    rendre(
      vueAction({
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
    for (const de of d20) de.click();
    assert.deepEqual(appels, [], "un d20 lancé ne se relance pas");

    assert.equal(boutons(noeud, "Décaler").length, 1);
    const ligne = leBouton(noeud, "Décaler").parentNode;
    const nombre = ligne.querySelector("input[type=number]");
    assert.equal(texteDe(nombre.parentNode), "Décaler le 14 (jambe droite) (de −13 à 5)");
    nombre.value = "-2";
    ligne.querySelector("input[type=text]").value = "Minutie";
    leBouton(noeud, "Décaler").click();
    assert.deepEqual(appels, [{ commande: { evenement: { type: "decaler", de: 0, valeur: -2, raison: "Minutie" } }, origine: "panneau" }]);
    appels.length = 0;
    nombre.value = "6";
    leBouton(noeud, "Décaler").click();
    assert.deepEqual(appels, [], "la face décalée reste dans les bornes que donne la vue");

    rendre(vueAction({ geste: gesteVu({ localisation: null }) }));
    assert.equal(noeud.querySelector(".combat-localisation"), null);
  });
});

test("panneau d'action — l'esquive : combien, dans les bornes de la vue, rangé dans « x » ; le détail des dégâts ; « Appliquer »", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
    rendre(
      vueAction({
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

    rendre(vueAction({ geste: gesteVu({ esquive: null, detail: null, appliquer: null }) }));
    assert.equal(boutons(noeud, "Pas de côté").length, 0);
    assert.equal(noeud.querySelector("ul.combat-detail"), null);
    assert.equal(boutons(noeud, "Appliquer").length, 0);
  });
});

test("panneau d'action — « Confirmer » d'une capacité sans jet, inactif tant que le geste n'est pas prêt ; « Revenir » avant le premier dé", () => {
  avecPanneau(({ noeud, rendre, appels }) => {
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

// ——— L'annonce, le focus, les rendus ———

test("panneau d'action — l'annonce s'écrit quand son pas change, et alors seulement", () => {
  avecPanneau(({ noeud, rendre }) => {
    const annonce = noeud.querySelector(".combat-annonce");
    assert.equal(annonce.childNodes.length, 0);
    rendre(vueAction());
    assert.equal(annonce.textContent, "2e dé : 4, échec. Relancer ou garder ?");
    const ecrit = annonce.childNodes[0];

    // Le même pas, même avec une vue qui change : la région ne bouge pas (elle ne serait pas redite).
    rendre(vueAction({ titre: "Aubépine Crèmebrûlée joue — 0 action sur 2, souffle 10" }));
    assert.equal(annonce.childNodes[0], ecrit);
    // Le pas change : le texte s'écrit, même s'il est le même mot pour mot (deux dés de suite au même résultat).
    rendre(vueAction({ annonce: { pas: 13, texte: "2e dé : 4, échec. Relancer ou garder ?" } }));
    assert.notEqual(annonce.childNodes[0], ecrit);
    assert.equal(annonce.textContent, "2e dé : 4, échec. Relancer ou garder ?");
    rendre(vueAction({ annonce: { pas: 14, texte: "1er dé : 9, réussi." } }));
    assert.equal(annonce.textContent, "1er dé : 9, réussi.");

    // Sans annonce (un combat neuf), la région se vide ; le même pas, ensuite, se redit.
    rendre(vueAction({ annonce: null }));
    assert.equal(annonce.childNodes.length, 0);
    rendre(vueAction({ annonce: { pas: 14, texte: "1er dé : 9, réussi." } }));
    assert.equal(annonce.textContent, "1er dé : 9, réussi.");

    // Le bilan visible n'est pas dans la région, et la région n'est pas dans le corps refait.
    assert.equal(annonce.querySelector(".combat-bilan"), null);
    assert.equal(noeud.querySelector(".combat-action-corps").querySelector(".combat-annonce"), null);
  });
});

test("panneau d'action — data-focus désigne la commande qui attend, et elle seule ; à défaut, le titre", () => {
  avecPanneau(({ noeud, rendre }) => {
    const marques = () => tous(noeud, "[data-focus]").map((n) => [n.tagName, n.getAttribute("data-focus"), texteDe(n)]);
    rendre(vueAction());
    assert.deepEqual(marques(), [["BUTTON", "choix:relancer", "Relancer le 2e dé"]]);
    rendre(vueAction({ focus: "choix:garder" }));
    assert.deepEqual(marques(), [["BUTTON", "choix:garder", "Garder ce dé"]]);
    rendre(vueAction({ focus: "capacite:0:0" }));
    assert.deepEqual(marques(), [["BUTTON", "capacite:0:0", "Frappe 3/8/20"]]);
    rendre(vueAction({ focus: "cible:adv3" }));
    assert.deepEqual(marques(), [["BUTTON", "cible:adv3", "Marmiton de corvée n° 1"]]);
    rendre(vueAction({ focus: "passer" }));
    assert.deepEqual(marques(), [["BUTTON", "passer", "Passer son tour"]]);

    // Une saisie : c'est son champ qui reçoit le focus.
    rendre(vueDuGeste({ x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } }, { focus: "x" }));
    assert.deepEqual(tous(noeud, "[data-focus]").map((n) => [n.tagName, n.getAttribute("type")]), [["INPUT", "number"]]);

    // Rien n'attend, ou une clé que le panneau ne montre pas : le titre, qui peut recevoir le focus.
    for (const focus of [null, "choix:exploser"]) {
      rendre(vueAction({ focus }));
      assert.deepEqual(marques(), [["H2", "titre", "Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10"]]);
      assert.equal(noeud.querySelector("h2.combat-qui").getAttribute("tabindex"), "-1");
    }
    rendre({ genre: "qui_joue", candidats: [{ id: "pj1", nom: "Aubépine Crèmebrûlée", commande: { choisir: "pj1" } }], geste: null, annonce: null, focus: "candidat:pj1" });
    assert.deepEqual(marques(), [["BUTTON", "candidat:pj1", "Aubépine Crèmebrûlée"]]);
    rendre({ genre: "termine", vainqueur: "Combat terminé : victoire des PJ.", candidats: [], geste: null, annonce: null, focus: null });
    assert.deepEqual(marques(), [["H2", "titre", "Combat terminé : victoire des PJ."]]);
  });
});

test("panneau d'action — le corps est gardé quand la vue n'a pas changé, refait quand elle a changé", () => {
  avecPanneau(({ noeud, rendre }) => {
    assert.equal(rendre(vueAction()), true);
    const relancer = leBouton(noeud, "Relancer le 2e dé");
    const titre = noeud.querySelector("h2.combat-qui");

    // La même vue, refabriquée (un rendu de plus quand l'enregistrement finit) : rien ne bouge.
    assert.equal(rendre(vueAction()), false);
    assert.equal(leBouton(noeud, "Relancer le 2e dé"), relancer);
    assert.equal(noeud.querySelector("h2.combat-qui"), titre);
    // Une annonce de plus ne refait pas le corps.
    assert.equal(rendre(vueAction({ annonce: { pas: 13, texte: "Le dé explose : 6 plus 3, 9, réussi." } })), false);
    assert.equal(leBouton(noeud, "Relancer le 2e dé"), relancer);

    // Une saisie en cours survit à un rendu sans changement.
    const avecX = vueDuGeste({ x: { valeur: 0, min: 0, max: 5, gabarit: { evenement: { type: "regler", champ: "x" } } } });
    rendre(avecX);
    noeud.querySelector("input[type=number]").value = "4";
    rendre(structuredClone(avecX));
    assert.equal(noeud.querySelector("input[type=number]").value, "4");

    // La vue change (un dé de plus) : le corps est refait.
    rendre(vueAction());
    const avant = leBouton(noeud, "Relancer le 2e dé");
    assert.equal(rendre(vueAction({ geste: gesteVu({ bilan: "2 réussites." }) })), true);
    assert.notEqual(leBouton(noeud, "Relancer le 2e dé"), avant);
    assert.equal(avant.isConnected, false);
    assert.equal(texteDe(noeud.querySelector("p.combat-bilan")), "2 réussites.");

    // L'origine de la cible change seule : le corps est refait aussi.
    assert.equal(rendre(vueAction({ geste: gesteVu({ bilan: "2 réussites." }) }), { origineDeLaCible: "plateau" }), true);
    assert.equal(rendre(vueAction({ geste: gesteVu({ bilan: "2 réussites." }) }), { origineDeLaCible: "plateau" }), false);
    assert.equal(rendre(vueAction({ geste: gesteVu({ bilan: "2 réussites." }) }), { origineDeLaCible: "panneau" }), true);
  });
});

test("panneau d'action — deux panneaux ne se mêlent pas ; un geste absent ne laisse aucun dé", () => {
  const retirer = installerDom();
  try {
    const appelsA = [];
    const appelsB = [];
    const a = creer({ executer: (commande) => appelsA.push(commande), lancerLeDe: () => {} });
    const b = creer({ executer: (commande) => appelsB.push(commande), lancerLeDe: () => {} });
    a.rendre(vueAction());
    b.rendre(vueAction({ geste: null }));
    leBouton(a.noeud, "Garder ce dé").click();
    assert.equal(appelsA.length, 1);
    assert.equal(appelsB.length, 0);
    assert.equal(b.noeud.querySelector(".combat-des"), null);
    assert.equal(tous(b.noeud, ".combat-groupe").length, 2, "sans geste, les capacités restent offertes");
    assert.notEqual(a.listeDeCase, b.listeDeCase);
  } finally {
    retirer();
  }
});

// ——— Les données hostiles, et le texte du module ———

test("panneau d'action — un nom hostile reste du texte ; un signe qui renverse l'écriture ne s'affiche pas", () => {
  avecPanneau(({ noeud, rendre }) => {
    const balise = "<img src=x onerror=alert(1)>";
    const renverse = String.fromCodePoint(0x202e);
    rendre(
      vueAction({
        titre: `${balise} joue — 1 action sur 2, souffle 10`,
        groupes: [{ titre: balise, boutons: [boutonVu({ libelle: `${renverse}Taloche`, raison: balise, actif: false })] }],
        mentions: { passifs: balise, interventions: null },
        geste: gesteVu({ description: balise, bilan: balise, cibles: [{ id: "adv3", libelle: balise, choisie: false, actif: true, raison: null, commande: regler("cible", "adv3") }] }),
        annonce: { pas: 1, texte: `${renverse}${balise}` },
      }),
    );
    assert.equal(tous(noeud, "img").length, 0);
    assert.equal(tous(noeud, "script").length, 0);
    assert.equal(texteDe(noeud.querySelector("h2.combat-qui")), `${balise} joue — 1 action sur 2, souffle 10`);
    assert.equal(texteDe(noeud.querySelector(".combat-groupe-titre")), balise);
    assert.equal(texteDe(noeud.querySelector(".combat-cibles button")), balise);
    assert.equal(noeud.textContent.includes(renverse), false);
    assert.equal(noeud.querySelector(".combat-annonce").textContent, balise);
    assert.equal(texteDe(leBouton(noeud, "Taloche").querySelector("span")), "Taloche");
  });
});

test("combat_action.js — aucune règle ni aucun import du moteur ; ni style, ni insertion de HTML, ni écouteur global ; son en-tête dit le § 17", () => {
  const source = readFileSync(new URL("../js/ecrans/combat_action.js", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/^import .* from "(.*)";$/gm)].map(([, chemin]) => chemin), ["./dom.js"]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.match(source.split("\n")[0], /SPECIFICATION\.md, § 17/);
  assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write/);
  assert.doesNotMatch(source, /\.style\b|\bstyle\s*[:=]|setAttribute\(\s*["']style|cssText/);
  assert.doesNotMatch(source, /\bconfirm\(|\balert\(|data-chargement|Chargement de/);
  assert.doesNotMatch(source, /\b(?:window|globalThis|document)\s*\.\s*addEventListener/);
  assert.doesNotMatch(source, /role\s*[:=]\s*["']status|aria-live["']?\s*:\s*["']assertive/);
  assert.equal([...source.matchAll(/aria-live/g)].length, 1, "une seule région polie, créée une fois");
  assert.doesNotMatch(source, /\bdisabled\s*:/, "un bouton inactif garde le focus : aria-disabled, jamais disabled");
  for (const code of [0xa0, 0x202f]) assert.equal(source.includes(String.fromCodePoint(code)), false, "aucune espace insécable");
});
