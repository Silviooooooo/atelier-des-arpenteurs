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
// déclenchent à la main (declencher).

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

  /** Le focus, et son relevé : { noeud, options } (preventScroll…). */
  focus(options) {
    if (!document) return;
    document.activeElement = this;
    document.focalisations.push({ noeud: this, options });
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

/**
 * Installe le document simulé dans globalThis, ses relevés vides ; rend une
 * fonction qui le retire. La page : html (une fenêtre de 1 280 × 800 px),
 * puis body.
 */
export function installerDom() {
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
  };
  const avant = { document: globalThis.document, Node: globalThis.Node };
  globalThis.document = document;
  globalThis.Node = Noeud;
  return () => {
    globalThis.document = avant.document;
    globalThis.Node = avant.Node;
    document = null;
  };
}

/** Le texte d'un nœud, espaces resserrées. */
export const texteDe = (noeud) => noeud.textContent.replace(/\s+/g, " ").trim();

/** Les boutons d'un nœud dont le texte commence par… */
export const boutons = (noeud, debut) => [...noeud.querySelectorAll("button")].filter((b) => texteDe(b).startsWith(debut));

/** Laisse passer les promesses en cours (lecture du coffre, dérivation…). */
export const laisserFiler = (ms = 0) => new Promise((resoudre) => setTimeout(resoudre, ms));
