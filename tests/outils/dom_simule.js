// Un document simulé, juste assez pour que les écrans se construisent sous
// Node (SPECIFICATION.md, § 11, domaine Site).
//
// Les écrans fabriquent leurs éléments par js/ecrans/dom.js : createElement,
// setAttribute, append, addEventListener. Ce document en tient la trace, sans
// mise en page ni style : il permet de vérifier qu'un bouton existe, qu'il
// est actif ou non, et quel texte l'accompagne. Aucune dépendance : le
// contrôle vaut ce que vaut ce simulacre, et les essais dans un vrai
// navigateur (Firefox, Chromium) le complètent.

class Noeud {
  constructor() {
    this.parentNode = null;
  }

  get isConnected() {
    let noeud = this;
    while (noeud.parentNode) noeud = noeud.parentNode;
    return noeud === document?.body;
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

  focus() {}

  select() {}

  scrollIntoView() {}

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
    return [...this.descendants()].filter((e) => {
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
    });
  }

  querySelector(selecteur) {
    return this.querySelectorAll(selecteur)[0] ?? null;
  }
}

let document = null;

/** Installe le document simulé dans globalThis ; rend une fonction qui le retire. */
export function installerDom() {
  document = {
    title: "",
    body: new Element("body"),
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
export const boutons = (noeud, debut) => noeud.querySelectorAll("button").filter((b) => texteDe(b).startsWith(debut));

/** Laisse passer les promesses en cours (lecture du coffre, dérivation…). */
export const laisserFiler = (ms = 0) => new Promise((resoudre) => setTimeout(resoudre, ms));
