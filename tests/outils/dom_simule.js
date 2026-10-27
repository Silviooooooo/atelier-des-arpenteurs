// Un document simulé, juste assez pour que les écrans se construisent sous
// Node (SPECIFICATION.md, § 11, domaine Site).
//
// Les écrans fabriquent leurs éléments par js/ecrans/dom.js : createElement,
// setAttribute, append, addEventListener. Ce document en tient la trace, sans
// mise en page ni feuille de style : il permet de vérifier qu'un bouton
// existe, qu'il est actif ou non, et quel texte l'accompagne. Aucune
// dépendance : le contrôle vaut ce que vaut ce simulacre, et les essais dans
// un vrai navigateur (Firefox, Chromium) le complètent.
//
// Pour la bulle du combat (contrat du lot 4, groupe 2, § 11), il relève ce
// que le code écrit et demande, sans rien calculer : les propriétés posées
// sur le style d'un élément (ecritures), chaque focus et ses options
// (document.focalisations), chaque scrollIntoView (document.defilements).
// La boîte d'un élément est celle qu'un contrôle lui prête (rectangle) ; la
// fenêtre fait 1 280 × 800 px (documentElement). Toujours sans propagation,
// ni matchMedia, ni ResizeObserver : un écouteur en capture, keydown,
// pointerenter, pointerleave, pointerdown ({ pointerType }) et toggle se
// déclenchent à la main (declencher). À la demande (focusFidele), focus()
// déclenche blur et focus comme un navigateur : sans cela, le focus que pose
// l'écran n'ouvrait aucune infobulle, et un défaut s'y cachait (lot 4,
// groupe 2, relecture, C-02).
//
// Au lot 4.3 (contrat de la vague 3, § 5.6), deux ajouts, sans rien changer
// au reste : document.querySelectorAll et querySelector, qui cherchent dans
// toute la page ; et la navigation de index.html (l'en-tête du site et ses
// liens a[data-route]), qu'un contrôle pose quand il en a besoin
// (poserLaNavigation) : le menu ☰ de l'écran du combat la relit.
//
// À la vague 4, un ajout encore : getClientRects, vide hors de la page et
// pour un élément caché (hidden, lui ou un ancêtre) ou qu'un contrôle marque
// sans boîte (sansBoite), comme ce que cache la feuille de style ; l'écran y
// voit si l'élément à qui rendre le focus se voit encore.

import { readFileSync } from "node:fs";

// Ce que rend querySelectorAll dans un navigateur : une NodeList, qui se
// parcourt (for…of, forEach, un indice, length, item) mais n'a ni filter, ni
// map, ni find. Un tableau ici laissait passer un appel que le navigateur
// refuse (« querySelectorAll(...).filter is not a function », vu en ligne
// le 30/09/2026) : les contrôles en font un tableau explicitement, [...].
class ListeDeNoeuds {
  constructor(noeuds) {
    noeuds.forEach((noeud, i) => {
      this[i] = noeud;
    });
    Object.defineProperty(this, "length", { value: noeuds.length });
  }

  item(i) {
    return this[i] ?? null;
  }

  forEach(faire, cela) {
    for (let i = 0; i < this.length; i += 1) faire.call(cela, this[i], i, this);
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i += 1) yield this[i];
  }

  *entries() {
    for (let i = 0; i < this.length; i += 1) yield [i, this[i]];
  }

  *keys() {
    for (let i = 0; i < this.length; i += 1) yield i;
  }

  *values() {
    yield* this;
  }
}

class Noeud {
  constructor() {
    this.parentNode = null;
  }

  get isConnected() {
    let noeud = this;
    while (noeud.parentNode) noeud = noeud.parentNode;
    return noeud === document?.documentElement;
  }

  /** Vrai pour ce nœud lui-même et pour chacun de ses descendants. */
  contains(autre) {
    for (let noeud = autre; noeud; noeud = noeud.parentNode) {
      if (noeud === this) return true;
    }
    return false;
  }

  remove() {
    if (!this.parentNode) return;
    const freres = this.parentNode.childNodes;
    freres.splice(freres.indexOf(this), 1);
    this.parentNode = null;
  }
}

class Texte extends Noeud {
  constructor(texte) {
    super();
    this.data = texte;
  }

  get textContent() {
    return this.data;
  }
}

// Le style d'un élément : ses propriétés, et le relevé de chaque écriture,
// dans l'ordre (ecritures : [nom, valeur] ; [nom, null] pour un retrait).
// Comme dans un navigateur, une valeur vide ou nulle retire la propriété, et
// une propriété absente se lit « ».
class Style {
  #valeurs = new Map();

  constructor() {
    this.ecritures = [];
  }

  setProperty(nom, valeur) {
    const texte = valeur === null ? "" : String(valeur);
    if (texte === "") this.#valeurs.delete(nom);
    else this.#valeurs.set(nom, texte);
    this.ecritures.push([nom, texte]);
  }

  getPropertyValue(nom) {
    return this.#valeurs.get(nom) ?? "";
  }

  removeProperty(nom) {
    const avant = this.getPropertyValue(nom);
    this.#valeurs.delete(nom);
    this.ecritures.push([nom, null]);
    return avant;
  }
}

// Les attributs qui sont aussi des propriétés booléennes.
const BOOLEENS = ["hidden", "disabled", "checked", "required"];

class Element extends Noeud {
  constructor(balise) {
    super();
    this.tagName = balise.toUpperCase();
    this.attributs = new Map();
    this.childNodes = [];
    this.ecouteurs = new Map();
    this.value = "";
    this.files = [];
    // Une propriété propre : un contrôle peut la remplacer par la sienne.
    this.style = new Style();
    // La boîte que lui prête un contrôle : { left, top, width, height }.
    this.rectangle = null;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    for (const nom of BOOLEENS) {
      Object.defineProperty(this, nom, {
        get: () => this.attributs.has(nom),
        set: (valeur) => (valeur ? this.attributs.set(nom, "") : this.attributs.delete(nom)),
      });
    }
  }

  get className() {
    return this.attributs.get("class") ?? "";
  }

  set className(valeur) {
    this.attributs.set("class", String(valeur));
  }

  get id() {
    return this.attributs.get("id") ?? "";
  }

  get dataset() {
    return Object.fromEntries([...this.attributs].filter(([nom]) => nom.startsWith("data-")).map(([nom, valeur]) => [nom.slice(5).replace(/-(.)/g, (_, c) => c.toUpperCase()), valeur]));
  }

  setAttribute(nom, valeur) {
    this.attributs.set(nom, String(valeur));
  }

  getAttribute(nom) {
    return this.attributs.get(nom) ?? null;
  }

  hasAttribute(nom) {
    return this.attributs.has(nom);
  }

  removeAttribute(nom) {
    this.attributs.delete(nom);
  }

  append(...enfants) {
    for (const enfant of enfants) {
      // Un navigateur écrirait « null » ou « undefined » dans la page.
      if (enfant === null || enfant === undefined) throw new TypeError(`append(${enfant}) : le navigateur afficherait « ${enfant} »`);
      const noeud = enfant instanceof Noeud ? enfant : new Texte(String(enfant));
      noeud.remove();
      noeud.parentNode = this;
      this.childNodes.push(noeud);
    }
  }

  replaceChildren(...enfants) {
    for (const enfant of [...this.childNodes]) enfant.remove();
    this.append(...enfants);
  }

  get children() {
    return this.childNodes.filter((noeud) => noeud instanceof Element);
  }

  get textContent() {
    return this.childNodes.map((noeud) => noeud.textContent).join("");
  }

  set textContent(texte) {
    this.replaceChildren(String(texte));
  }

  addEventListener(type, ecouteur) {
    if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []);
    this.ecouteurs.get(type).push(ecouteur);
  }

  /** Déclenche un événement ; rend la liste des promesses des écouteurs. */
  declencher(type, proprietes = {}) {
    const evenement = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...proprietes };
    return (this.ecouteurs.get(type) ?? []).map((ecouteur) => ecouteur(evenement));
  }

  /** Un clic, refusé comme dans un navigateur quand le bouton est inactif. */
  click() {
    if (this.disabled) return [];
    return this.declencher("click");
  }

  /**
   * Le focus, et son relevé : { noeud, options } (preventScroll…). Fidèle
   * (installerDom({ focusFidele: true })), un focus qui change l'élément
   * actif déclenche, comme un navigateur, blur sur l'ancien puis focus sur le
   * nouveau ; sinon, aucun événement.
   */
  focus(options) {
    if (!document) return;
    const ancien = document.activeElement ?? null;
    document.activeElement = this;
    document.focalisations.push({ noeud: this, options });
    if (!focusFidele || ancien === this) return;
    if (ancien instanceof Element) ancien.declencher("blur");
    this.declencher("focus");
  }

  select() {}

  /** Rien ne défile ici : la demande est relevée, { noeud, options }. */
  scrollIntoView(options) {
    document?.defilements.push({ noeud: this, options });
  }

  /** La boîte prêtée par un contrôle (rectangle), des zéros sinon. */
  getBoundingClientRect() {
    const { left = 0, top = 0, width = 0, height = 0 } = this.rectangle ?? {};
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }

  /**
   * Les boîtes de l'élément, comme un navigateur : aucune hors de la page, ni
   * quand lui ou l'un de ses ancêtres est caché (hidden), ou marqué sans
   * boîte par un contrôle (sansBoite : ce que la feuille de style cache) ;
   * sinon la sienne.
   */
  getClientRects() {
    if (!this.isConnected) return [];
    for (let noeud = this; noeud; noeud = noeud.parentNode) {
      if (noeud instanceof Element && (noeud.hidden || noeud.sansBoite === true)) return [];
    }
    return [this.getBoundingClientRect()];
  }

  *descendants() {
    for (const enfant of this.children) {
      yield enfant;
      yield* enfant.descendants();
    }
  }

  // Sélecteurs simples, seuls ou en suite (balise, .classe, #id,
  // [attribut], [attribut=valeur]), et leurs descendants séparés par une
  // espace : « .carte button[aria-pressed=true] ». Un sélecteur que ce
  // simulacre ne comprend pas lève une erreur, au lieu de ne rien trouver.
  querySelectorAll(selecteur) {
    const parties = selecteur.trim().match(/(?:[^\s[\]]+|\[[^\]]*\])+/g) ?? [];
    const conditionsDe = (partie) => {
      const jetons = [...partie.matchAll(/([a-z][a-z0-9]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/giy)];
      if (jetons.map(([t]) => t).join("") !== partie) throw new Error(`Sélecteur non pris en charge par le document simulé : ${selecteur}`);
      return jetons.map(([, balise, classe, id, attribut, v1, v2, v3]) => (e) => {
        if (balise) return e.tagName === balise.toUpperCase();
        if (classe) return e.className.split(/\s+/).includes(classe);
        if (id) return e.id === id;
        const valeur = v1 ?? v2 ?? v3;
        return valeur === undefined ? e.hasAttribute(attribut) : e.getAttribute(attribut) === valeur;
      });
    };
    const suite = parties.map(conditionsDe);
    const convient = (e, conditions) => conditions.every((condition) => condition(e));
    return new ListeDeNoeuds([...this.descendants()].filter((e) => {
      if (!convient(e, suite.at(-1))) return false;
      // Les parties précédentes, de droite à gauche, parmi les ancêtres
      // intérieurs à ce nœud.
      let ancetre = e.parentNode;
      for (let i = suite.length - 2; i >= 0; i -= 1) {
        while (ancetre && ancetre !== this && !convient(ancetre, suite[i])) ancetre = ancetre.parentNode;
        if (!ancetre || ancetre === this) return false;
        ancetre = ancetre.parentNode;
      }
      return true;
    }));
  }

  querySelector(selecteur) {
    return this.querySelectorAll(selecteur)[0] ?? null;
  }
}

let document = null;
// Le focus fidèle : blur et focus déclenchés à chaque changement de l'élément
// actif (installerDom({ focusFidele: true })).
let focusFidele = false;

/**
 * Installe le document simulé dans globalThis, ses relevés vides ; rend une
 * fonction qui le retire. La page : html (une fenêtre de 1 280 × 800 px),
 * puis body. focusFidele : un focus() qui change l'élément actif déclenche
 * blur sur l'ancien puis focus sur le nouveau ; par défaut, rien.
 */
export function installerDom({ focusFidele: fidele = false } = {}) {
  focusFidele = fidele === true;
  const racine = new Element("html");
  Object.assign(racine, { clientWidth: 1280, clientHeight: 800 });
  const corps = new Element("body");
  racine.append(corps);
  document = {
    title: "",
    documentElement: racine,
    body: corps,
    focalisations: [],
    defilements: [],
    createElement: (balise) => new Element(balise),
    createElementNS: (_espace, balise) => new Element(balise),
    getElementById: (id) => document.body.querySelector(`#${id}`),
    // Toute la page, comme dans un navigateur : sous html (contrat de la
    // vague 3, § 5.6).
    querySelectorAll: (selecteur) => document.documentElement.querySelectorAll(selecteur),
    querySelector: (selecteur) => document.documentElement.querySelector(selecteur),
  };
  const avant = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = document;
  globalThis.Node = Noeud;
  return () => {
    globalThis.document = avant.document;
    globalThis.Node = avant.Node;
    document = null;
    focusFidele = false;
  };
}

// Les liens de la navigation du site, lus dans index.html tels qu'ils y sont
// écrits : { href, route, texte }, dans l'ordre.
const LIEN_DE_NAVIGATION = /<a href="([^"]*)" data-route="([^"]*)">([^<]*)<\/a>/g;

/** Les liens de la navigation de index.html : [{ href, route, texte }]. */
export function liensDeNavigation() {
  const page = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const debut = page.indexOf('<ul class="navigation">');
  const fin = page.indexOf("</ul>", debut);
  if (debut < 0 || fin < 0) throw new Error("index.html n'a plus sa navigation (ul.navigation)");
  return [...page.slice(debut, fin).matchAll(LIEN_DE_NAVIGATION)].map(([, href, route, texte]) => ({ href, route, texte }));
}

/**
 * Pose l'en-tête du site de index.html au bout de body : header.entete, sa
 * marque, puis nav > ul.navigation > li > a[data-route], chaque lien tel
 * qu'il y est écrit ; « courante » reçoit aria-current="page", comme le
 * marque js/application.js. Rend l'en-tête. Le document doit être installé.
 */
export function poserLaNavigation({ courante = null } = {}) {
  if (!document) throw new Error("poserLaNavigation : le document simulé n'est pas installé");
  const creer = (balise, attributs = {}, ...enfants) => {
    const noeud = new Element(balise);
    for (const [nom, valeur] of Object.entries(attributs)) if (valeur !== null) noeud.setAttribute(nom, valeur);
    noeud.append(...enfants);
    return noeud;
  };
  const liste = creer("ul", { class: "navigation" });
  for (const { href, route, texte } of liensDeNavigation()) {
    liste.append(creer("li", {}, creer("a", { href, "data-route": route, "aria-current": route === courante ? "page" : null }, texte)));
  }
  const entete = creer("header", { class: "entete" }, creer("a", { class: "marque", href: "#/" }, "L'Atelier des Arpenteurs"), creer("nav", { "aria-label": "Navigation principale" }, liste));
  document.body.append(entete);
  return entete;
}

/** Le texte d'un nœud, espaces resserrées. */
export const texteDe = (noeud) => noeud.textContent.replace(/\s+/g, " ").trim();

/** Les boutons d'un nœud dont le texte commence par… */
export const boutons = (noeud, debut) => [...noeud.querySelectorAll("button")].filter((b) => texteDe(b).startsWith(debut));

/** Laisse passer les promesses en cours (lecture du coffre, dérivation…). */
export const laisserFiler = (ms = 0) => new Promise((resoudre) => setTimeout(resoudre, ms));
