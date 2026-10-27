// Contrôles des vignettes du combat, au téléphone, dans un document simulé
// (SPECIFICATION.md, § 17 et § 11 ; mission du lot 4.3, § 3, vues A1 et A7 ;
// contrat de la vague 3, § 3.5, § 4.1, § 5.2 et § 7).
//
// La partie se contrôle seule, sur des vues écrites à la main à la forme de
// vueVignettes : ce qu'elle montre (le rond des initiales, un rond par
// action, le nom court, la garde, la pastille d'un état ; les classes de ce
// que chacun peut encore faire et du choisi), ce que rend l'appui court (la
// commande de son jeton, origine « vignette »), l'appui long au minuteur
// simulé (le menu du MJ en Mode MJ, sa raison s'il est inactif, la phrase
// hors Mode MJ ; rien s'il est relâché avant), et les nœuds gardés d'un rendu
// à l'autre. Les noms viennent de la démonstration. La mise en page se
// regarde dans un vrai navigateur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installerDom, texteDe } from "./outils/dom_simule.js";

const { creer } = await import("../js/ecrans/combat_vignettes.js");
const SOURCE = readFileSync(new URL("../js/ecrans/combat_vignettes.js", import.meta.url), "utf8");

const CHOISIR = (id) => ({ commande: { choisir: id } });
const CIBLER = (id) => ({ commande: { evenement: { type: "regler", champ: "cible", valeur: id } } });
const MODIFIER = { libelle: "Modifier…", actif: true, raison: null, mj: true };
const PHRASE_HORS_MJ = "Le menu du MJ s'ouvre en Mode MJ (menu ⋯).";
const LE_GESTE_D_ABORD = "Le geste en cours se finit d'abord.";
const EN_COURS = "Une action est en cours.";

/** Une vignette à la forme de vueVignettes (contrat de la vague 3, § 3.5) ; « retouches » en remplace des champs. */
function vignette(id, initiales, nom, entier, reste, max, retouches = {}) {
  const texte = `actions restantes : ${reste} sur ${max}`;
  return {
    id,
    initiales,
    nom,
    etiquette: `${entier}, ${texte}`,
    actions: { reste, max, texte },
    jeu: reste > 0 ? "peut_agir" : "epuise",
    choisie: false,
    garde: null,
    pastille: null,
    choix: reste > 0 ? CHOISIR(id) : null,
    inactif: false,
    raison: null,
    menuMj: MODIFIER,
    ...retouches,
  };
}

const aubepine = (retouches) => vignette("pj1", "A", "Aubépine", "Aubépine Crèmebrûlée", 2, 2, retouches);
const chef = (retouches) => vignette("adv2", "C", "Chef", "Chef de partie", 1, 1, retouches);
const marmiton2 = (retouches) => vignette("adv4", "M2", "Marmiton n° 2", "Marmiton de corvée n° 2", 0, 1, retouches);

/** Un minuteur simulé : ce qui est posé attend « avancer ». */
function minuteurSimule() {
  const poses = new Map();
  let numero = 0;
  return {
    poses,
    poser(faire, ms) {
      numero += 1;
      poses.set(numero, { faire, ms });
      return numero;
    },
    retirer(n) {
      poses.delete(n);
    },
    avancer() {
      for (const [n, { faire }] of [...poses]) {
        poses.delete(n);
        faire();
      }
    },
  };
}

/** Les vignettes posées dans la page, des actions qui notent ce qu'on leur demande, et de quoi les défaire. */
function monter(vue = { camp: "adv", vignettes: [chef(), marmiton2()] }, ecran = {}) {
  const retirer = installerDom();
  const appels = [];
  const noter = (nom) => (...parametres) => appels.push([nom, ...parametres]);
  const actions = { executer: noter("executer"), ouvrirMenuMj: noter("ouvrirMenuMj"), dire: noter("dire") };
  const minuteur = minuteurSimule();
  const partie = creer(actions, { minuteur });
  document.body.append(partie.noeud);
  if (vue !== undefined) partie.rendre(vue, ecran);
  return { partie, appels, minuteur, retirer };
}

const boutonsDe = (partie) => [...partie.noeud.querySelectorAll(".combat-vignette")];
const boutonDe = (partie, entier) => boutonsDe(partie).find((bouton) => bouton.getAttribute("aria-label").startsWith(entier)) ?? null;
const classesDe = (noeud) => noeud.className.split(/\s+/).filter(Boolean);
const inactif = (bouton) => bouton.getAttribute("aria-disabled") === "true";

test("sans combat en cours (null), les vignettes sont cachées et vides ; une vue les montre, une par protagoniste, dans l'ordre reçu", () => {
  const { partie, retirer } = monter(null);
  try {
    assert.equal(partie.noeud.tagName, "DIV");
    assert.equal(partie.noeud.className, "combat-vignettes");
    assert.equal(partie.noeud.hidden, true);
    assert.equal(partie.noeud.children.length, 0);
    partie.rendre({ camp: "adv", vignettes: [chef(), marmiton2()] }, {});
    assert.equal(partie.noeud.hidden, false);
    assert.deepEqual(boutonsDe(partie).map((bouton) => bouton.getAttribute("aria-label")), [
      "Chef de partie, actions restantes : 1 sur 1",
      "Marmiton de corvée n° 2, actions restantes : 0 sur 1",
    ]);
    assert.ok(boutonsDe(partie).every((bouton) => bouton.tagName === "BUTTON" && bouton.getAttribute("type") === "button"));
    // Le combat fini : de nouveau cachées.
    partie.rendre(null, {});
    assert.equal(partie.noeud.hidden, true);
    assert.equal(partie.noeud.children.length, 0);
  } finally {
    retirer();
  }
});

test("une vignette : ses initiales dans un rond, un rond par action (pleins puis vides), son nom court, sa garde ; le nom accessible est l'étiquette de la vue", () => {
  const { partie, retirer } = monter({
    camp: "pj",
    vignettes: [aubepine({ actions: { reste: 1, max: 2, texte: "actions restantes : 1 sur 2" }, etiquette: "Aubépine Crèmebrûlée, actions restantes : 1 sur 2, en guet : Frappe", garde: "en guet : Frappe" })],
  });
  try {
    const [bouton] = boutonsDe(partie);
    assert.deepEqual(bouton.children.map((enfant) => enfant.className), ["combat-rond", "combat-actions", "combat-vignette-nom", "combat-vignette-garde"]);
    assert.equal(texteDe(bouton.querySelector(".combat-rond")), "A");
    assert.deepEqual([...bouton.querySelectorAll(".combat-pion")].map((pion) => pion.className), ["combat-pion", "combat-pion vide"]);
    assert.equal(texteDe(bouton.querySelector(".combat-vignette-nom")), "Aubépine");
    assert.equal(texteDe(bouton.querySelector(".combat-vignette-garde")), "en guet : Frappe");
    assert.equal(bouton.getAttribute("aria-label"), "Aubépine Crèmebrûlée, actions restantes : 1 sur 2, en guet : Frappe");
    // Ce qui se voit se tait : l'étiquette dit tout.
    assert.ok(bouton.children.every((enfant) => enfant.getAttribute("aria-hidden") === "true"));
  } finally {
    retirer();
  }
});

test("les classes d'état : « a-jouer » ou « epuise » d'après « jeu », « choisie » ; la pastille d'un état, de sa couleur ; une valeur inconnue ne s'écrit pas", () => {
  const { partie, retirer } = monter({
    camp: "adv",
    vignettes: [chef({ choisie: true, pastille: "blessure" }), marmiton2({ pastille: "alerte" }), vignette("adv3", "M1", "Marmiton n° 1", "Marmiton de corvée n° 1", 1, 1, { jeu: "inconnu", pastille: "inconnue" })],
  });
  try {
    const [c, m2, m1] = boutonsDe(partie);
    assert.deepEqual(classesDe(c), ["combat-vignette", "a-jouer", "choisie"]);
    assert.equal(c.getAttribute("aria-pressed"), "true");
    assert.deepEqual(classesDe(m2), ["combat-vignette", "epuise"]);
    assert.equal(m2.getAttribute("aria-pressed"), "false");
    assert.deepEqual(classesDe(m1), ["combat-vignette"]);
    assert.deepEqual(classesDe(c.querySelector(".combat-pastille-etat")), ["combat-pastille-etat", "blessure"]);
    assert.deepEqual(classesDe(m2.querySelector(".combat-pastille-etat")), ["combat-pastille-etat", "alerte"]);
    assert.equal(m1.querySelector(".combat-pastille-etat"), null);
    // Le choix passe : la classe suit, sur le même bouton.
    partie.rendre({ camp: "adv", vignettes: [chef(), marmiton2({ choisie: true })] }, {});
    assert.ok(boutonsDe(partie)[0] === c);
    assert.deepEqual(classesDe(c), ["combat-vignette", "a-jouer"]);
    assert.equal(c.querySelector(".combat-pastille-etat"), null);
  } finally {
    retirer();
  }
});

test("l'appui court rend la commande de son jeton, origine « vignette » : « choisir », ou la cible pendant son choix ; inactive, elle dit sa raison et ne rend rien", () => {
  const { partie, appels, retirer } = monter({ camp: "adv", vignettes: [chef(), marmiton2()] });
  try {
    boutonDe(partie, "Chef de partie").click();
    assert.deepEqual(appels, [["executer", { choisir: "adv2" }, "vignette"]]);
    // Sans choix (a tout joué) : un bouton qui ne rend rien.
    const epuise = boutonDe(partie, "Marmiton de corvée n° 2");
    assert.equal(inactif(epuise), true);
    epuise.click();
    assert.equal(appels.length, 1);

    // Pendant le choix d'une cible (R n° 22) : la commande « regler » d'une cible, comme son jeton.
    partie.rendre({ camp: "pj", vignettes: [aubepine({ choisie: true, choix: CIBLER("pj1") })] }, {});
    boutonDe(partie, "Aubépine").click();
    assert.deepEqual(appels.at(-1), ["executer", { evenement: { type: "regler", champ: "cible", valeur: "pj1" } }, "vignette"]);

    // Après le premier dé, un candidat qui attend : inactif, avec sa raison, liée.
    partie.rendre({ camp: "adv", vignettes: [chef({ choisie: true, choix: null }), vignette("adv3", "M1", "Marmiton n° 1", "Marmiton de corvée n° 1", 1, 1, { choix: null, inactif: true, raison: EN_COURS })] }, {});
    const attend = boutonDe(partie, "Marmiton de corvée n° 1");
    assert.equal(inactif(attend), true);
    assert.equal(attend.hasAttribute("disabled"), false, "jamais éteint");
    const raison = partie.noeud.querySelector(`#${attend.getAttribute("aria-describedby")}`);
    assert.equal(texteDe(raison), EN_COURS);
    assert.equal(raison.className, "combat-raison");
    assert.ok(raison.parentNode === partie.noeud && partie.noeud.children[partie.noeud.children.indexOf(attend) + 1] === raison, "la raison suit son bouton");
    const avant = appels.length;
    attend.click();
    // Une vue qui porte une commande sur une vignette inactive : rien non plus.
    partie.rendre({ camp: "adv", vignettes: [chef({ inactif: true, raison: EN_COURS })] }, {});
    boutonDe(partie, "Chef de partie").click();
    assert.equal(appels.length, avant);
    // Quand on ne joue pas (un combat ouvert ailleurs), rien ne s'offre, sans raison.
    partie.rendre({ camp: "adv", vignettes: [chef()] }, { arrete: true });
    assert.equal(inactif(boutonDe(partie, "Chef de partie")), true);
    assert.equal(boutonDe(partie, "Chef de partie").getAttribute("aria-describedby"), null);
    boutonDe(partie, "Chef de partie").click();
    assert.equal(appels.length, avant);
  } finally {
    retirer();
  }
});

test("l'appui long d'une demi-seconde : hors Mode MJ la phrase, en Mode MJ le menu près de la vignette, inactif sa raison ; relâché, annulé ou quitté avant, rien ; le clic qui le suit est avalé", () => {
  const vue = { camp: "adv", vignettes: [chef(), marmiton2({ menuMj: null })] };
  const { partie, appels, minuteur, retirer } = monter(vue, { modeMj: false });
  try {
    const c = () => boutonDe(partie, "Chef de partie");
    c().declencher("pointerdown", { pointerType: "touch", button: 0 });
    assert.deepEqual([...minuteur.poses.values()].map(({ ms }) => ms), [500]);
    minuteur.avancer();
    assert.deepEqual(appels, [["dire", PHRASE_HORS_MJ]]);
    c().declencher("pointerup");
    c().click();
    assert.equal(appels.length, 1, "le clic qui suit l'appui long ne choisit pas");
    // Relâché, annulé, quitté avant la demi-seconde : l'appui s'oublie, et le clic choisit.
    for (const fin of ["pointerup", "pointercancel", "pointerleave"]) {
      c().declencher("pointerdown", { pointerType: "touch", button: 0 });
      c().declencher(fin);
      assert.equal(minuteur.poses.size, 0, fin);
    }
    c().click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "adv2" }, "vignette"]);

    // En Mode MJ : le menu du MJ, l'ancre est la vignette ; le clic droit qui suit ne l'ouvre pas deux fois.
    partie.rendre(vue, { modeMj: true });
    c().declencher("pointerdown", { pointerType: "touch", button: 0 });
    minuteur.avancer();
    assert.deepEqual(appels.at(-1).slice(0, 2), ["ouvrirMenuMj", "adv2"]);
    assert.ok(appels.at(-1)[2] === c());
    const nombre = appels.length;
    const droit = { evite: false };
    c().declencher("contextmenu", { preventDefault: () => (droit.evite = true) });
    assert.equal(droit.evite, true, "pas de menu du navigateur sur un appui long, en Mode MJ");
    assert.equal(appels.length, nombre);
    // Sans menu (la vue n'en porte pas) : aucun appui ne se pose.
    boutonDe(partie, "Marmiton de corvée n° 2").declencher("pointerdown", { pointerType: "touch", button: 0 });
    assert.equal(minuteur.poses.size, 0);
    // Un menu inactif dit sa raison.
    partie.rendre({ camp: "adv", vignettes: [chef({ menuMj: { ...MODIFIER, actif: false, raison: LE_GESTE_D_ABORD } })] }, { modeMj: true });
    c().declencher("pointerdown", { pointerType: "touch", button: 0 });
    minuteur.avancer();
    assert.deepEqual(appels.at(-1), ["dire", LE_GESTE_D_ABORD]);
    // Quand on ne joue pas : aucun appui.
    partie.rendre(vue, { modeMj: true, arrete: true });
    c().declencher("pointerdown", { pointerType: "touch", button: 0 });
    assert.equal(minuteur.poses.size, 0);
  } finally {
    retirer();
  }
});

test("l'appui long qui aboutit demande à l'écran d'avaler le clic qui le suit, où qu'il tombe (vague 4, W1 n° 5, R2 n° 11) : une fois, après le menu ; relâché avant, rien ; la vignette n'avale alors rien elle-même (C4)", () => {
  const { partie, appels, minuteur, retirer } = monter({ camp: "pj", vignettes: [aubepine()] }, { modeMj: true });
  try {
    const avales = [];
    // L'action que l'écran donne en plus (actions.avalerLeClicSuivant) : la partie la demande, si elle est là.
    const actions = { executer: (commande, origine) => appels.push(["executer", commande, origine]), ouvrirMenuMj: (id) => appels.push(["ouvrirMenuMj", id]), dire: () => {}, avalerLeClicSuivant: () => avales.push(appels.length) };
    const autre = creer(actions, { minuteur });
    document.body.append(autre.noeud);
    autre.rendre({ camp: "pj", vignettes: [aubepine()] }, { modeMj: true });
    const a = boutonDe(autre, "Aubépine Crèmebrûlée");
    a.declencher("pointerdown", { pointerType: "touch", button: 0 });
    a.declencher("pointerup");
    assert.deepEqual(avales, [], "relâché avant la demi-seconde : rien à avaler");
    a.declencher("pointerdown", { pointerType: "touch", button: 0 });
    minuteur.avancer();
    assert.deepEqual(appels.map(([nom]) => nom), ["ouvrirMenuMj"]);
    assert.deepEqual(avales, [1], "une fois, le menu ouvert");
    // L'écran avale ce clic-là : la vignette n'avale rien elle-même. Le menu fermé, Entrée sur elle (un clic
    // sans pointerdown, qui n'a pas suivi l'appui) choisit (vague 4, C4).
    a.click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "pj1" }, "vignette"], "Entrée après le menu : le choix, pas un clic avalé");
    // Sans l'action (une partie montée seule), l'appui long ne lève rien ; la vignette avale elle-même le clic qui le suit, une fois.
    const seule = boutonDe(partie, "Aubépine Crèmebrûlée");
    seule.declencher("pointerdown", { pointerType: "touch", button: 0 });
    minuteur.avancer();
    assert.equal(avales.length, 1);
    const nombre = appels.length;
    seule.click();
    assert.equal(appels.length, nombre, "le clic qui suit l'appui long est avalé");
    seule.click();
    assert.deepEqual(appels.at(-1), ["executer", { choisir: "pj1" }, "vignette"], "le suivant choisit");
  } finally {
    retirer();
  }
});

test("d'un rendu à l'autre : chaque protagoniste garde son bouton (et le focus) ; une vue égale ne récrit rien ; un retiré s'en va", () => {
  const { partie, retirer } = monter({ camp: "adv", vignettes: [chef(), marmiton2()] });
  try {
    const [c, m2] = boutonsDe(partie);
    c.focus({ preventScroll: true });
    const ecrits = [];
    for (const methode of ["setAttribute", "removeAttribute", "replaceChildren"]) {
      const origine = c[methode];
      c[methode] = function compte(...parametres) {
        ecrits.push(methode);
        return origine.apply(this, parametres);
      };
    }
    partie.rendre({ camp: "adv", vignettes: [chef(), marmiton2()] }, {});
    assert.deepEqual(ecrits, [], "une vue égale ne récrit rien");
    partie.rendre({ camp: "adv", vignettes: [chef({ actions: { reste: 0, max: 1, texte: "actions restantes : 0 sur 1" }, jeu: "epuise", choix: null }), marmiton2()] }, {});
    assert.ok(boutonsDe(partie)[0] === c, "le même bouton, mis à jour");
    assert.ok(document.activeElement === c, "le focus reste");
    assert.deepEqual(classesDe(c), ["combat-vignette", "epuise"]);
    partie.rendre({ camp: "adv", vignettes: [marmiton2()] }, {});
    assert.deepEqual(boutonsDe(partie), [m2]);
  } finally {
    retirer();
  }
});

test("un nom hostile reste du texte : ni balise, ni sens d'écriture forcé, ni identifiant de page", () => {
  const force = String.fromCodePoint(0x202e);
  const hostile = `<b>Brûlot${force}</b>"] , [id="x`;
  const { partie, retirer } = monter({ camp: "adv", vignettes: [vignette(hostile, "B", hostile, hostile, 1, 1)] });
  try {
    const [bouton] = boutonsDe(partie);
    assert.equal(partie.noeud.querySelectorAll("b").length, 0);
    assert.ok(!partie.noeud.textContent.includes(force));
    assert.ok(!bouton.getAttribute("aria-label").includes(force));
    assert.equal(texteDe(bouton.querySelector(".combat-vignette-nom")), `<b>Brûlot</b>"] , [id="x`);
    partie.rendre({ camp: "adv", vignettes: [vignette(hostile, "B", hostile, hostile, 1, 1, { choix: null, inactif: true, raison: EN_COURS })] }, {});
    for (const noeud of partie.noeud.querySelectorAll("[id]")) assert.match(noeud.id, /^combat-vignette-\d+-raison$/);
  } finally {
    retirer();
  }
});

test("le texte du module : ses seuls imports, aucun mot interdit, aucun bouton éteint, aucun style", () => {
  const imports = [...SOURCE.matchAll(/^\s*import\b[^;]*?from\s+"([^"]+)";/gm)].map(([, chemin]) => chemin);
  assert.deepEqual(imports, ["./dom.js"]);
  assert.ok(!/\bimport\s*\(/.test(SOURCE), "aucun import dynamique");
  for (const interdit of ["innerHTML", "outerHTML", "insertAdjacent", ".style", "cssText", "localStorage", "indexedDB", "matchMedia", "classList", "closest(", "addEventListener", "aria-live", "scrollIntoView"]) {
    assert.ok(!SOURCE.includes(interdit), `« ${interdit} » n'a pas sa place dans les vignettes`);
  }
  assert.doesNotMatch(SOURCE, /\bstyle\s*[:=]|setAttribute\(\s*["'`]style/, "aucun style écrit par le code");
  assert.ok(!/["'`]disabled["'`]\s*[:,]/.test(SOURCE), "jamais disabled");
  assert.ok(!SOURCE.includes(String.fromCodePoint(0xa0)) && !SOURCE.includes(String.fromCodePoint(0x202f)), "aucune espace insécable");
  assert.match(SOURCE, /^\/\/ Les vignettes du combat, au téléphone \(SPECIFICATION\.md, § 17/);
});
