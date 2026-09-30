// Le calcul de la fiche d'un personnage (SPECIFICATION.md, § 15.2).
//
// Un personnage garde ses choix, jamais des copies de la banque : sa fiche
// se recalcule ici avec la banque du jour. Tout nom qui ne renvoie à rien
// est signalé, jamais exécuté : les noms se cherchent dans des Map, et le
// calcul ne lit que des chaînes et des nombres.
//
// Le calcul est une fonction pure : la même banque et le même personnage
// donnent la même fiche. Il ne lève pas d'exception sur une donnée
// inattendue : il la signale dans les avertissements de la fiche.

import { cle, repertoire } from "../banque/noms.js";
import { typeDe } from "../banque/types.js";
import { entierInferieur, evaluer, fraction, lireNombre, rangs } from "./expressions.js";
import {
  CARACTERISTIQUES,
  CARACTERISTIQUE_MAX,
  CARACTERISTIQUE_MIN,
  CORPS,
  COUT_NIVEAU,
  ELEMENTS,
  NIVEAU_MAX,
  NIVEAU_PERSONNAGE,
  PARAMETRES,
  PARAMETRES_QUALIFIES,
  POINTS_CREATION,
  RANGS,
  RESISTANCE_PAR_ZONE,
  SOMME_CARACTERISTIQUES,
  SOUFFLE_CREATION,
  TYPES_OBJET,
  ZONES,
  caracteristique,
  deDuJet,
} from "./regles.js";
import { changements } from "./suivi.js";

// Les rôles des blocs d'un personnage, dans l'ordre où ses capacités se
// rangent : une capacité reçue deux fois se range sous le premier.
export const ROLES = ["espece", "archetype", "constellation", "primordial", "base", "equipement"];

const premierParNom = (liste) => {
  const table = new Map();
  for (const entree of liste) if (!table.has(entree.nom)) table.set(entree.nom, entree);
  return table;
};

/** Un index de la banque pour le créateur : noms résolus comme au contrôle (§ 6.3). */
export function indexerCreation(banque) {
  const blocs = premierParNom(banque.blocs);
  const capacites = premierParNom(banque.capacites);
  const elements = premierParNom(banque.elements);
  const reps = { blocs: repertoire(blocs.keys()), capacites: repertoire(capacites.keys()), elements: repertoire(elements.keys()) };
  const trouver = (table, rep) => (nom) => {
    const trouve = rep.resoudre(String(nom ?? "")).nom;
    return trouve === null ? null : table.get(trouve);
  };
  const bloc = trouver(blocs, reps.blocs);
  const capacite = trouver(capacites, reps.capacites);
  const element = trouver(elements, reps.elements);
  const parType = new Map();
  for (const b of blocs.values()) {
    const type = typeDe(b);
    if (!type) continue;
    if (!parType.has(type)) parType.set(type, []);
    parType.get(type).push(b);
  }
  for (const liste of parType.values()) liste.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
  return { banque, bloc, capacite, element, blocsDeType: (type) => parType.get(type) ?? [] };
}

// ─── Les éléments et les paramètres d'un bloc ───────────────────────────────

// Vrai si le bloc porte l'élément (sans cible : il vaut pour tout le bloc).
function porte(bloc, nomElement) {
  return bloc.elements.some((e) => e.nom && !e.cible && cle(e.nom) === cle(nomElement));
}

/** Le type d'objet d'un bloc (lourde, agile, précise) : { type } ou { erreur }. */
export function typeObjet(bloc) {
  const types = Object.entries(TYPES_OBJET).filter(([, t]) => porte(bloc, t.element)).map(([code]) => code);
  if (types.length === 1) return { type: types[0] };
  if (types.length === 0) return { erreur: `« ${bloc.nom} » ne porte ni Lourde, ni Agile, ni Précise` };
  return { erreur: `« ${bloc.nom} » porte plusieurs types (${types.map((t) => TYPES_OBJET[t].nom).join(", ")})` };
}

// Les paramètres qu'un bloc transmet à une capacité : ceux sans cible, puis
// ceux qui la visent, qui priment (lisez_moi, « Syntaxe » ; E7 l'admet
// depuis le lot 2 bis). Rend une Map clé du nom → { nom, valeur }.
function parametresPour(index, bloc, nomCapacite) {
  const sansCible = new Map();
  const visant = new Map();
  for (const p of bloc.parametres) {
    if (!p.nom) continue;
    const k = cle(p.nom);
    if (!p.cible) {
      if (!sansCible.has(k)) sansCible.set(k, p);
    } else if (nomCapacite !== null && (index.capacite(p.cible)?.nom ?? p.cible) === nomCapacite) {
      if (!visant.has(k)) visant.set(k, p);
    }
  }
  return new Map([...sansCible, ...visant]);
}

// ─── Les valeurs ────────────────────────────────────────────────────────────

const valeurCaracteristique = (caracteristiques) => (nom) => {
  const code = caracteristique(nom);
  const valeur = code ? caracteristiques?.[code] : null;
  return Number.isInteger(valeur) ? fraction(valeur) : null;
};

/**
 * La qualité d'un objet (élément Qualité du classeur) : { applicable:
 * false } sans paramètre qualite ; sinon { applicable: true, texte, q }, q
 * étant la fraction de la qualité, ou null tant qu'elle vaut X. Le joueur
 * saisit la valeur que donne le MJ quand le classeur dit X.
 */
export function qualiteDe(bloc, saisie) {
  const parametre = bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.qualite);
  if (!parametre) return { applicable: false, texte: "" };
  if (parametre.valeur.trim() !== "X") {
    const q = lireNombre(parametre.valeur);
    return q ? { applicable: true, texte: parametre.valeur.trim(), q, fixee: true } : { applicable: true, texte: parametre.valeur, q: null, fixee: true };
  }
  const q = saisie === null || saisie === undefined ? null : lireNombre(saisie);
  return q ? { applicable: true, texte: String(saisie), q, fixee: false } : { applicable: true, texte: "X", q: null, fixee: false };
}

/**
 * Les valeurs d'un paramètre, calculées : un tableau d'entiers (un par
 * rang), ou { erreur, brut }. Les caractéristiques y entrent ; pour dégâts,
 * défense et armure, la qualité les multiplie par 1/3 + q/3, et l'arrondi
 * inférieur se fait une fois l'opération faite (livret, « Valeurs
 * décimales »).
 */
export function valeursParametre(nom, texte, { caracteristiques = null, qualite = null } = {}) {
  const attendus = RANGS[cle(nom)] ?? 1;
  const morceaux = rangs(texte, attendus);
  if (!morceaux) return { erreur: `${nom} : ${attendus} valeurs attendues dans « ${texte} »`, brut: texte };
  const facteur = qualite?.q && PARAMETRES_QUALIFIES.includes(cle(nom)) ? fraction(qualite.q.n + qualite.q.d, 3 * qualite.q.d) : null;
  const valeurs = [];
  for (const morceau of morceaux) {
    const resultat = evaluer(morceau, valeurCaracteristique(caracteristiques));
    if (!resultat.valeur) return { erreur: resultat.x ? null : resultat.erreur, x: Boolean(resultat.x), brut: texte };
    const produit = facteur ? fraction(resultat.valeur.n * facteur.n, resultat.valeur.d * facteur.d) : resultat.valeur;
    if (!produit) return { erreur: `${nom} : « ${texte} » sort des nombres calculables`, brut: texte };
    valeurs.push(entierInferieur(produit));
  }
  return { valeurs };
}

// ─── Les capacités ──────────────────────────────────────────────────────────

/**
 * Ce que permet une capacité : { niveauCreation, niveauMax, peutEvoluer }.
 * Livret, « Création » : niveau 1, sauf celles qui ne peuvent évoluer,
 * de niveau 0 ; lisez_moi : une puissance fixée à 0 ne peut pas évoluer,
 * une puissance N va de 1 à 3. Une capacité à variantes (1, 2, 3) monte
 * jusqu'à la plus haute. Une puissance illisible vaut un niveau 1 fixe, et
 * se signale.
 */
export function evolution(capacite) {
  const puissances = capacite.variantes.map((v) => v.puissance.trim());
  if (puissances.every((p) => p === "0")) return { niveauCreation: 0, niveauMax: 0, peutEvoluer: false };
  const nombres = puissances.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= NIVEAU_MAX);
  const niveauMax = puissances.includes("N") ? NIVEAU_MAX : nombres.length ? Math.max(...nombres) : 1;
  const lisible = puissances.includes("N") || nombres.length > 0;
  return { niveauCreation: 1, niveauMax, peutEvoluer: niveauMax > 1, ...(lisible ? {} : { illisible: true }) };
}

/** La variante d'une capacité à un niveau : celle de puissance N, ou celle de ce nombre. */
export function varianteA(capacite, niveau) {
  return capacite.variantes.find((v) => v.puissance.trim() === "N") ?? capacite.variantes.find((v) => v.puissance.trim() === String(niveau)) ?? null;
}

/** Le coût d'une capacité à un niveau, évalué : { souffle, lien } en texte. */
export function coutA(capacite, niveau) {
  const variante = varianteA(capacite, niveau);
  if (!variante) return { souffle: "?", lien: "?", erreur: `« ${capacite.nom} » n'a pas de variante de puissance ${niveau}` };
  const lire = (texte) => {
    if (texte.trim() === "") return { texte: "0" }; // lisez_moi : un coût vide vaut 0
    const resultat = evaluer(texte, (nom) => (nom === "N" ? fraction(niveau) : null));
    if (resultat.x) return { texte: "X" };
    if (resultat.erreur) return { texte: texte.trim(), erreur: resultat.erreur };
    return { texte: String(resultat.entier) };
  };
  const souffle = lire(variante.cout_souffle);
  const lien = lire(variante.cout_lien);
  const erreur = souffle.erreur ?? lien.erreur;
  return { souffle: souffle.texte, lien: lien.texte, ...(erreur ? { erreur: `coût de « ${capacite.nom} » : ${erreur}` } : {}) };
}

// Les valeurs qu'une capacité voit : N, les caractéristiques, les
// paramètres de son bloc (qualité appliquée), et ceux de ses éléments
// propres, qui priment (livret, « Paramètre »).
function contexte(index, personnage, bloc, qualite, capacite, niveau, avertir = () => {}) {
  const variables = new Map();
  if (bloc) {
    for (const [k, p] of parametresPour(index, bloc, capacite.nom)) {
      const lu = valeursParametre(p.nom, p.valeur, { caracteristiques: personnage.caracteristiques, qualite });
      if (lu.erreur) avertir("expression", `« ${bloc.nom} », paramètre ${lu.erreur}, gardé tel qu'écrit`);
      variables.set(k, lu.valeurs ? { valeurs: lu.valeurs } : { brut: p.valeur });
    }
  }
  const variante = varianteA(capacite, niveau);
  for (const e of variante?.elements ?? []) {
    if (!e.nom || e.valeur === undefined || e.valeur === null) continue;
    const element = index.element(e.nom);
    const recus = (element?.parametres_recus ?? []).filter((r) => typeof r === "string");
    if (recus.length !== 1) continue;
    const lu = valeursParametre(recus[0], e.valeur, { caracteristiques: personnage.caracteristiques });
    if (lu.erreur) avertir("expression", `« ${capacite.nom} », élément ${e.nom} : ${lu.erreur}, gardé tel qu'écrit`);
    variables.set(cle(recus[0]), lu.valeurs ? { valeurs: lu.valeurs } : { brut: e.valeur });
  }
  return variables;
}

/**
 * La description d'une capacité telle que le joueur la voit en choisissant
 * (lot 2 bis) : sa variante au niveau demandé (par défaut son niveau de
 * création), ses [N] et expressions évalués avec les caractéristiques du
 * personnage et les paramètres du bloc qui la donne (bloc : son nom ; pour
 * un objet, qualite : la qualité saisie, 2 par défaut). Rend { nom, niveau,
 * texte, cout, evolution } ou null pour une capacité absente de la banque.
 */
export function descriptionA(index, personnage, nomCapacite, { bloc = null, niveau = null, qualite = "2" } = {}) {
  const capacite = index.capacite(nomCapacite);
  if (!capacite) return null;
  const evo = evolution(capacite);
  const n = niveau ?? evo.niveauCreation;
  const variante = varianteA(capacite, n);
  if (!variante) return { nom: capacite.nom, niveau: n, texte: "", cout: coutA(capacite, n), evolution: evo };
  const source = bloc ? index.bloc(bloc) : null;
  const q = source ? qualiteDe(source, qualite) : null;
  const variables = contexte(index, personnage, source, q, capacite, n);
  return { nom: capacite.nom, niveau: n, texte: decrire(variante.description, variables, personnage.caracteristiques, n).texte, cout: coutA(capacite, n), evolution: evo };
}

function ecrireValeurs(valeurs) {
  return valeurs.join("/");
}

/**
 * La valeur d'une expression entre crochets, pour une capacité à un
 * niveau : un entier par rang quand elle invoque un paramètre à rangs
 * ([N*{degats}] → trois valeurs), « X » pour une valeur décidée en jeu,
 * ou null si elle ne se calcule pas.
 */
export function valeursCrochet(expression, variables, caracteristiques, niveau) {
  const valeurDe = (rang) => (nom) => {
    if (nom === "N") return fraction(niveau);
    const code = caracteristique(nom);
    if (code) return Number.isInteger(caracteristiques?.[code]) ? fraction(caracteristiques[code]) : null;
    const variable = variables.get(cle(nom));
    if (!variable?.valeurs) return null;
    const valeurs = variable.valeurs;
    return fraction(valeurs.length === 1 ? valeurs[0] : valeurs[rang] ?? NaN);
  };
  const longueurs = new Set();
  for (const [, nom] of String(expression).matchAll(/\{([^{}]*)\}/g)) {
    const valeurs = variables.get(cle(nom))?.valeurs;
    if (valeurs && valeurs.length > 1 && !caracteristique(nom)) longueurs.add(valeurs.length);
  }
  if (longueurs.size > 1) return null;
  const nombre = longueurs.size ? [...longueurs][0] : 1;
  const resultats = [];
  for (let rang = 0; rang < nombre; rang += 1) {
    const r = evaluer(expression, valeurDe(rang));
    if (r.x) return "X";
    if (!r.valeur) return null;
    resultats.push(r.entier);
  }
  return resultats;
}

/**
 * La description d'une capacité, ses « [expression] » et ses « {nom} »
 * remplacés par leur valeur (livret, « Paramètre » ; lisez_moi, « Syntaxe »).
 * Ce qui ne se calcule pas reste tel qu'écrit, avec un avertissement.
 */
export function decrire(texte, variables, caracteristiques, niveau) {
  const avertissements = [];
  const calculer = (expression) => {
    const valeurs = valeursCrochet(expression, variables, caracteristiques, niveau);
    return Array.isArray(valeurs) ? valeurs.join("/") : valeurs;
  };
  // D'abord les crochets, qui peuvent contenir des accolades ; puis les
  // accolades restées seules.
  let sortie = String(texte ?? "").replace(/\[([^[\]]*)\]/g, (tout, expression) => {
    const valeur = calculer(expression);
    if (valeur === null) avertissements.push(`« ${tout} » ne se calcule pas`);
    return valeur ?? tout;
  });
  sortie = sortie.replace(/\{([^{}]*)\}/g, (tout, nom) => {
    const code = caracteristique(nom);
    if (code && Number.isInteger(caracteristiques?.[code])) return String(caracteristiques[code]);
    const variable = variables.get(cle(nom));
    if (nom === "N") return String(niveau);
    if (variable?.valeurs) return ecrireValeurs(variable.valeurs);
    if (variable?.brut) return variable.brut;
    avertissements.push(`« ${tout} » n'a pas de valeur ici`);
    return tout;
  });
  return { texte: sortie, avertissements };
}

// Les capacités qu'un bloc donne : les simples, et les options choisies dans
// ses groupes. ( a | b ) : exactement une ; [ a | b ] : zéro, une ou
// plusieurs (lisez_moi, « Syntaxe »).
export function capacitesDuBloc(bloc, choix = []) {
  const choisies = new Set((choix ?? []).map(cle));
  const capacites = [];
  const manques = [];
  const groupes = [];
  const reconnus = new Set();
  bloc.capacites.forEach((entree) => {
    if (entree.brut !== undefined) return;
    if (entree.forme === "simple") {
      capacites.push({ nom: entree.nom, groupe: null });
      return;
    }
    const numero = groupes.length;
    const options = entree.options.filter((o) => choisies.has(cle(o)));
    options.forEach((o) => reconnus.add(cle(o)));
    groupes.push({ forme: entree.forme, options: entree.options, choisies: options });
    if (entree.forme === "choix" && options.length !== 1) {
      manques.push(options.length === 0 ? `choisir une option parmi : ${entree.options.join(", ")}` : `une seule option parmi : ${entree.options.join(", ")}`);
    }
    for (const o of entree.forme === "choix" ? options.slice(0, 1) : options) capacites.push({ nom: o, groupe: numero });
  });
  const disparus = (choix ?? []).filter((nom) => !reconnus.has(cle(nom)));
  return { capacites, groupes, manques, disparus };
}

// ─── Les blocs du personnage ────────────────────────────────────────────────

const ROLE_TYPE = { espece: "espece", archetype: "archetype", constellation: "constellation", primordial: "primordial" };
const NOM_ROLE = { espece: "l'espèce", archetype: "l'archétype", constellation: "la constellation", primordial: "le primordial" };

// Les blocs d'où viennent les capacités du personnage, chacun avec son rôle.
function sources(index, personnage, avertissements) {
  const liste = [];
  for (const role of ["espece", "archetype", "constellation", "primordial"]) {
    const choix = personnage[role];
    if (!choix?.nom) continue;
    const bloc = index.bloc(choix.nom);
    if (!bloc) {
      avertissements.push({ genre: "banque", texte: `${NOM_ROLE[role][0].toUpperCase()}${NOM_ROLE[role].slice(1)} « ${choix.nom} » n'existe plus dans la banque.` });
      liste.push({ role, nom: choix.nom, bloc: null, choix: choix.choix ?? [] });
      continue;
    }
    if (typeDe(bloc) !== ROLE_TYPE[role]) avertissements.push({ genre: "banque", texte: `« ${bloc.nom} » n'est plus du type attendu pour ${NOM_ROLE[role]}.` });
    liste.push({ role, nom: bloc.nom, bloc, choix: choix.choix ?? [] });
  }
  // Livret, « Création » : toutes les capacités du bloc de base.
  for (const bloc of index.blocsDeType("base")) liste.push({ role: "base", nom: bloc.nom, bloc, choix: [] });
  (personnage.equipement ?? []).forEach((objet, rang) => {
    const bloc = index.bloc(objet.nom);
    if (!bloc) avertissements.push({ genre: "banque", texte: `L'objet « ${objet.nom} » n'existe plus dans la banque.` });
    liste.push({ role: "equipement", nom: bloc?.nom ?? objet.nom, bloc, choix: objet.choix ?? [], objet, rang });
  });
  return liste;
}

function aElementPropre(capacite, nomElement) {
  return capacite.variantes.some((v) => v.elements.some((e) => e.nom && cle(e.nom) === cle(nomElement)));
}

// ─── La fiche ───────────────────────────────────────────────────────────────

/**
 * Calcule la fiche d'un personnage avec une banque. Rend un objet simple,
 * que les écrans affichent sans rien recalculer.
 */
export function calculerFiche(banque, personnage, { index = indexerCreation(banque) } = {}) {
  const avertissements = [];
  const avertir = (genre, texte) => {
    if (!avertissements.some((a) => a.texte === texte)) avertissements.push({ genre, texte });
  };
  const caracteristiques = personnage.caracteristiques ?? {};

  // Les caractéristiques et les dés (livret, « Caractéristiques »).
  const caracs = CARACTERISTIQUES.map((c) => ({ ...c, valeur: Number.isInteger(caracteristiques[c.code]) ? caracteristiques[c.code] : null }));
  const somme = caracs.reduce((total, c) => total + (c.valeur ?? 0), 0);
  const completes = caracs.every((c) => c.valeur !== null && c.valeur >= CARACTERISTIQUE_MIN && c.valeur <= CARACTERISTIQUE_MAX);
  const deDe = (paire) => (completes ? deDuJet(caracteristiques[paire[0]], caracteristiques[paire[1]]) : null);
  const des = {
    attaque: Object.fromEntries(Object.entries(TYPES_OBJET).map(([code, t]) => [code, deDe(t.attaque)])),
    defense: Object.fromEntries(Object.entries(TYPES_OBJET).map(([code, t]) => [code, deDe(t.defense)])),
  };

  // Les capacités, rangées par leur première source ; une capacité reçue
  // deux fois n'en fait qu'une, comptée une fois (§ 12).
  const blocs = sources(index, personnage, avertissements);
  const possedees = new Map();
  const manques = [];
  for (const role of ROLES) {
    for (const source of blocs.filter((s) => s.role === role && s.bloc)) {
      const donnees = capacitesDuBloc(source.bloc, source.choix);
      for (const m of donnees.manques) manques.push(`« ${source.bloc.nom} » : ${m}`);
      for (const nom of donnees.disparus) avertir("banque", `Le choix « ${nom} » ne figure plus parmi les options de « ${source.bloc.nom} ».`);
      for (const { nom } of donnees.capacites) {
        const capacite = index.capacite(nom);
        const k = cle(capacite?.nom ?? nom);
        if (!possedees.has(k)) {
          const evo = capacite ? evolution(capacite) : null;
          possedees.set(k, { nom: capacite?.nom ?? nom, capacite, sources: [], evolution: evo, niveau: evo?.niveauCreation ?? null });
        }
        const entree = possedees.get(k);
        if (!entree.sources.some((s) => s.bloc === source.bloc && s.rang === source.rang)) entree.sources.push(source);
      }
    }
  }

  // Les montées choisies à la création (livret, « Création »).
  const montees = new Map();
  for (const { capacite: nom, niveau } of personnage.niveaux ?? []) {
    const entree = possedees.get(cle(index.capacite(nom)?.nom ?? nom));
    if (!entree || !entree.capacite) {
      avertir("banque", `La montée de « ${nom} » vise une capacité que le personnage n'a pas.`);
      continue;
    }
    if (!Number.isInteger(niveau) || niveau <= entree.evolution.niveauCreation || niveau > entree.evolution.niveauMax) {
      avertir("regle", `« ${entree.nom} » ne peut pas être au niveau ${niveau}.`);
      continue;
    }
    entree.niveau = niveau;
    montees.set(cle(entree.nom), niveau);
  }

  const capacites = [...possedees.values()].map((entree) => {
    const premiere = entree.sources[0];
    const role = premiere.role;
    let groupe = null;
    if (entree.capacite) {
      if (role === "archetype" && aElementPropre(entree.capacite, ELEMENTS.style)) groupe = "style";
      else if (role === "espece" || role === "archetype" || role === "constellation" || role === "primordial") groupe = role;
    } else if (role === "espece" || role === "archetype" || role === "constellation" || role === "primordial") groupe = role;
    const cout = entree.capacite ? coutA(entree.capacite, entree.niveau) : null;
    if (cout?.erreur) avertir("expression", cout.erreur);
    const variante = entree.capacite ? varianteA(entree.capacite, entree.niveau) : null;
    const descriptions = [];
    if (variante) {
      for (const source of entree.sources) {
        const qualite = source.bloc && source.objet ? qualiteDe(source.bloc, source.objet.qualite) : null;
        const variables = contexte(index, personnage, source.bloc, qualite, entree.capacite, entree.niveau, avertir);
        const decrite = decrire(variante.description, variables, caracteristiques, entree.niveau);
        decrite.avertissements.forEach((a) => avertir("expression", `${entree.nom} : ${a}`));
        if (!descriptions.some((d) => d.texte === decrite.texte)) descriptions.push({ source: source.nom, texte: decrite.texte });
      }
    }
    return {
      nom: entree.nom,
      aVenir: !entree.capacite,
      groupe,
      role,
      origines: entree.sources.map((s) => s.nom),
      niveau: entree.capacite ? entree.niveau : null,
      niveauCreation: entree.evolution?.niveauCreation ?? null,
      niveauMax: entree.evolution?.niveauMax ?? null,
      peutEvoluer: entree.evolution?.peutEvoluer ?? false,
      cout,
      elements: variante ? variante.elements.map((e) => (e.nom ? (e.valeur ? `${e.nom}[${e.valeur}]` : e.nom) : e.brut)) : [],
      descriptions,
    };
  });
  for (const entree of possedees.values()) if (entree.evolution?.illisible) avertir("banque", `« ${entree.nom} » a une puissance illisible : elle compte au niveau 1.`);
  for (const c of capacites.filter((c) => c.aVenir)) avertir("a_venir", `« ${c.nom} » (${c.origines.join(", ")}) : capacité à venir, absente de la feuille Capacites.`);

  // Les points de capacité (livret, « Création ») : hors niveau 0 et hors
  // capacités à venir.
  const comptees = capacites.filter((c) => !c.aVenir && c.niveau >= 1);
  const points = comptees.reduce((total, c) => total + COUT_NIVEAU[c.niveau], 0);
  const recus = comptees.reduce((total, c) => total + COUT_NIVEAU[c.niveauCreation], 0);
  if (montees.size && points > POINTS_CREATION) avertir("regle", `Les montées portent les points de capacité à ${points}, au-delà de ${POINTS_CREATION}.`);

  // L'équipement, et la place de chaque objet (format 2) : l'arme tenue, une
  // pièce du pack d'armure, un objet équipé, le sac.
  const equipement = (personnage.equipement ?? []).map((objet, rang) => {
    const bloc = index.bloc(objet.nom);
    const type = bloc ? typeDe(bloc) : null;
    const qualite = bloc ? qualiteDe(bloc, objet.qualite) : { applicable: false, texte: "" };
    const place = objet.place ?? "sac";
    return { rang, nom: bloc?.nom ?? objet.nom, bloc, type, qualite, place, porte: type === "armure" && (place === "pack" || place === "equipe"), absent: !bloc };
  });

  // L'arme tenue (livret, « Objet » : une seule arme équipée) et son jet
  // d'attaque (livret, « Jets d'attaque »). Une arme ailleurs que dans la
  // main compte comme rangée.
  const armes = equipement.filter((o) => o.type === "arme").map((o) => ({ ...o, ...arme(index, personnage, o, des, avertir) }));
  let attaque;
  const tenue = equipement.find((o) => o.place === "arme");
  const principale = armes.find((a) => a.place === "arme");
  if (tenue && !tenue.absent && !principale) avertir("regle", `« ${tenue.nom} » est tenu comme arme, mais ce n'est pas une arme.`);
  for (const a of armes.filter((a) => a.place === "pack" || a.place === "equipe")) avertir("regle", `« ${a.nom} » : une seule arme se tient, celle de l'entrée « Arme » ; celle-ci compte comme rangée dans le sac.`);
  if (principale) attaque = { ...principale, mainsNues: false };
  else attaque = mainsNues(index, personnage, capacites, avertir);

  // La défense (livret, « Jets de défense ») et l'armure par zone (élément
  // Armure du classeur).
  const portees = equipement.filter((o) => o.porte);
  const defense = defenseDe(portees, des, avertir, personnage);
  const armure = armureParZone(portees, personnage, avertir);
  const bouclier = bouclierDe(equipement, personnage, avertir);

  // Les liens primordiaux (livret, « Ressources » et « Lien »).
  const primordial = blocs.find((s) => s.role === "primordial");
  const liens = primordial
    ? [
        {
          nom: primordial.nom,
          pouvoirs: capacites.filter((c) => c.origines.includes(primordial.nom) && c.role === "primordial"),
          points: capacites
            .filter((c) => !c.aVenir && c.origines.includes(primordial.nom))
            .reduce((total, c) => total + (c.niveau ?? 0), 0),
        },
      ]
    : [];

  // Un primordial ou une constellation sans capacité encore écrite : la
  // fiche dit « capacités à venir » (instruction du lot 2), au recto comme
  // au verso.
  for (const role of ["constellation", "primordial"]) {
    const source = blocs.find((b) => b.role === role && b.bloc);
    if (source && !capacites.some((c) => !c.aVenir && c.origines.includes(source.nom))) avertir("a_venir", `« ${source.nom} » : capacités à venir.`);
  }

  // Un choix disparu de la banque ou modifié depuis l'enregistrement.
  for (const phrase of changements(index, personnage.empreintes)) avertir("banque", phrase);

  const constellation = personnage.constellation?.nom
    ? { nom: personnage.constellation.nom, saisie: personnage.constellation.obtention === "saisie", tirages: personnage.constellation.tirages ?? 0 }
    : null;
  const groupe = (nom) => capacites.filter((c) => c.groupe === nom);

  return {
    identite: { nom: personnage.identite?.nom ?? "", age: personnage.identite?.age ?? "", description: personnage.identite?.description ?? "", histoire: personnage.identite?.histoire ?? "" },
    niveau: NIVEAU_PERSONNAGE,
    espece: personnage.espece?.nom ?? "",
    archetype: personnage.archetype?.nom ?? "",
    style: groupe("style").map((c) => c.nom).join(", "),
    caracteristiques: caracs,
    somme,
    caracteristiquesCompletes: completes && somme === SOMME_CARACTERISTIQUES,
    des,
    attaque,
    armes,
    defense,
    armure,
    bouclier,
    capacites,
    groupes: {
      espece: groupe("espece"),
      archetype: groupe("archetype"),
      style: groupe("style"),
      constellation: groupe("constellation"),
      acquises: [],
    },
    constellation,
    primordial: primordial ? { nom: primordial.nom, aVenir: !capacites.some((c) => c.origines.includes(primordial.nom) && !c.aVenir) } : null,
    liens,
    points: { depenses: points, recus, plafond: POINTS_CREATION, reliquat: Math.max(0, POINTS_CREATION - points), depasse: points > POINTS_CREATION },
    ressources: { souffle: SOUFFLE_CREATION, corps: CORPS, resistance: RESISTANCE_PAR_ZONE },
    equipement,
    manques,
    avertissements,
    banque: { publiee_le: banque.publiee_le ?? null },
  };
}

// Une arme : son type, son dé, ses dégâts après qualité, sa portée.
function arme(index, personnage, objet, des, avertir) {
  const type = typeObjet(objet.bloc);
  if (type.erreur) avertir("regle", `${type.erreur} : son dé d'attaque reste vide.`);
  const parametres = parametresPour(index, objet.bloc, null);
  const degats = parametres.get(PARAMETRES.degats);
  let valeurs = null;
  if (degats) {
    const lu = valeursParametre(degats.nom, degats.valeur, { caracteristiques: personnage.caracteristiques, qualite: objet.qualite });
    if (lu.valeurs) valeurs = lu.valeurs;
    else if (lu.erreur) avertir("expression", `« ${objet.nom} » : ${lu.erreur}`);
  }
  const portees = objet.bloc.parametres.filter((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.portee).map((p) => p.valeur);
  if (new Set(portees).size > 1) avertir("banque", `« ${objet.nom} » transmet plusieurs portées sans cible (${portees.join(", ")}).`);
  return {
    typeObjet: type.type ?? null,
    de: type.type ? des.attaque[type.type] : null,
    degats: valeurs,
    degatsBruts: degats?.valeur ?? "",
    portee: [...new Set(portees)].join(" ou "),
  };
}

// Sans arme : l'attaque à mains nues, la capacité que vise le paramètre
// degats du bloc de base. Ses dégâts sont ceux que dit sa description à sa
// puissance (« [N*{degats}] » dans le classeur), sinon le paramètre
// lui-même ; recto et verso disent ainsi la même chose. Le dé reste vide :
// aucune règle ne le donne (§ 12).
function mainsNues(index, personnage, capacites, avertir) {
  for (const bloc of index.blocsDeType("base")) {
    const parametre = bloc.parametres.find((p) => p.nom && cle(p.nom) === PARAMETRES.degats);
    if (!parametre) continue;
    const lu = valeursParametre(parametre.nom, parametre.valeur, { caracteristiques: personnage.caracteristiques });
    if (lu.erreur) avertir("expression", `Mains nues : ${lu.erreur}`);
    const capacite = parametre.cible ? index.capacite(parametre.cible) : null;
    const nom = parametre.cible ? (capacite?.nom ?? parametre.cible) : "Mains nues";
    let degats = lu.valeurs ?? null;
    const possedee = capacite ? capacites.find((c) => !c.aVenir && c.nom === capacite.nom) : null;
    if (degats && possedee) {
      const description = varianteA(capacite, possedee.niveau)?.description ?? "";
      const crochet = [...description.matchAll(/\[([^[\]]*)\]/g)]
        .map(([, expression]) => expression)
        .find((expression) => [...expression.matchAll(/\{([^{}]*)\}/g)].some(([, n]) => cle(n) === PARAMETRES.degats));
      if (crochet) {
        const variables = contexte(index, personnage, bloc, null, capacite, possedee.niveau, avertir);
        const valeurs = valeursCrochet(crochet, variables, personnage.caracteristiques, possedee.niveau);
        if (Array.isArray(valeurs) && valeurs.length === degats.length) degats = valeurs;
      }
    }
    return { mainsNues: true, nom, de: null, degats, degatsBruts: parametre.valeur, portee: "", qualite: { applicable: false, texte: "" } };
  }
  return { mainsNues: true, nom: "Mains nues", de: null, degats: null, degatsBruts: "", portee: "", qualite: { applicable: false, texte: "" } };
}

// Le dé de défense : celui du type des pièces portées ; types mêlés, le plus
// faible et le désavantage sans la maîtrise de toutes les pièces ; aucune
// pièce, le plus avantageux des trois (livret, « Jets de défense »).
function defenseDe(portees, des, avertir) {
  const types = new Set();
  for (const piece of portees) {
    const type = typeObjet(piece.bloc);
    if (type.type) types.add(type.type);
    else avertir("regle", `${type.erreur} : il ne compte pas dans le dé de défense.`);
  }
  const faces = (code) => des.defense[code]?.faces ?? 0;
  if (portees.length === 0) {
    const codes = Object.keys(TYPES_OBJET).filter((c) => des.defense[c]);
    if (!codes.length) return { pieces: [], de: null, type: null, mention: "" };
    const meilleur = codes.reduce((a, b) => (faces(b) > faces(a) ? b : a));
    return { pieces: [], de: des.defense[meilleur], type: meilleur, mention: "sans armure : le plus avantageux" };
  }
  if (types.size === 0) return { pieces: portees.map((p) => p.nom), de: null, type: null, mention: "" };
  const codes = [...types];
  const pire = codes.reduce((a, b) => (faces(b) < faces(a) ? b : a));
  const meles = codes.length > 1;
  return {
    pieces: portees.map((p) => p.nom),
    de: des.defense[pire] ?? null,
    type: pire,
    meles,
    mention: meles ? "désavantage sans la maîtrise de toutes les pièces" : "",
  };
}

// L'armure par zone : pour chaque zone, la plus élevée des pièces portées ;
// deux pièces ne s'additionnent pas (élément Armure du classeur). Le livret
// (« Objet ») ne permet pas de porter deux pièces sur une même zone : c'est
// signalé.
function armureParZone(portees, personnage, avertir) {
  const zones = Object.fromEntries(ZONES.map((z) => [z.code, 0]));
  const couvertes = Object.fromEntries(ZONES.map((z) => [z.code, []]));
  for (const piece of portees) {
    const parametre = piece.bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.armure);
    if (!parametre) {
      avertir("banque", `« ${piece.nom} » ne transmet pas de paramètre armure.`);
      continue;
    }
    const lu = valeursParametre(parametre.nom, parametre.valeur, { caracteristiques: personnage.caracteristiques, qualite: piece.qualite });
    if (!lu.valeurs) {
      if (lu.erreur) avertir("expression", `« ${piece.nom} » : ${lu.erreur}`);
      continue;
    }
    ZONES.forEach((zone, i) => {
      if (lu.valeurs[i] > 0) couvertes[zone.code].push(piece.nom);
      zones[zone.code] = Math.max(zones[zone.code], lu.valeurs[i]);
    });
  }
  for (const zone of ZONES) {
    if (couvertes[zone.code].length > 1) {
      avertir("regle", `${zone.nom} : ${couvertes[zone.code].join(" et ")} couvrent la même zone ; le livret (« Objet ») ne permet pas de les porter ensemble, et seule la plus élevée compte.`);
    }
  }
  return { zones, couvertes };
}

// Le bouclier : l'objet équipé qui transmet une défense (§ 12) ; un seul
// compte. Un objet équipé qui n'est ni armure, ni bouclier, ni arme compte
// comme rangé dans le sac.
function bouclierDe(equipement, personnage, avertir) {
  const equipes = equipement.filter((o) => o.place === "equipe" && o.type !== "armure" && o.type !== "arme" && !o.absent);
  const boucliers = equipes.filter((o) => estBouclier(o.bloc));
  for (const o of equipes.filter((o) => !estBouclier(o.bloc))) avertir("regle", `« ${o.nom} » est équipé, mais ce n'est ni une armure ni un bouclier : il compte comme rangé dans le sac.`);
  if (boucliers.length > 1) avertir("regle", `Plusieurs boucliers sont équipés : seul « ${boucliers[0].nom} » compte.`);
  const objet = boucliers[0];
  if (!objet) return null;
  const parametre = objet.bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.defense);
  const lu = valeursParametre(parametre.nom, parametre.valeur, { caracteristiques: personnage.caracteristiques, qualite: objet.qualite });
  if (lu.erreur) avertir("expression", `« ${objet.nom} » : ${lu.erreur}`);
  return { rang: objet.rang, nom: objet.nom, defense: lu.valeurs ? lu.valeurs[0] : null, defenseBrute: parametre.valeur, qualite: objet.qualite };
}

/** Vrai si le bloc peut servir de bouclier : il transmet une défense. */
export function estBouclier(bloc) {
  return Boolean(bloc?.parametres.some((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.defense));
}
