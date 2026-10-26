// Contrôle de cohérence de la banque (SPECIFICATION.md, § 6.3).
//
// Les trente-sept codes du § 6.3 sont définis ici, avec leur gravité (A6,
// retiré, ne revient pas : le bloc sans capacité est devenu I3). L'import en
// relève six en lisant les lignes (E1, E2, E6, A7, I1, I4) ; ce module relève
// les autres sur la banque : doublons, renvois, paramètres, rattachements,
// descriptions (I2 ; et I6 au lot 5 : une expression devant un mot au
// pluriel, sans « (s) » pour l'accorder). Ceux de la feuille Adversaires (E8 à E16, A11 à A16, I5)
// viennent de la résolution des adversaires, la même que celle de la page
// (js/adversaire/). Il ne corrige rien et n'ajoute aucune règle du jeu : là
// où le classeur laisse une ambiguïté, il la signale.

import { FEUILLE as FEUILLE_ADVERSAIRES, constatsDesAdversaires } from "../adversaire/controle.js";
import { cle, nomCompare, repertoire } from "./noms.js";
import { parametresInvoques } from "./notation.js";
import { TYPES, typeInconnu } from "./types.js";
import { packsDArmure } from "../personnage/packs.js";
import { TYPES_OBJET } from "../personnage/regles.js";

export const GRAVITES = {
  E1: "bloquante",
  E2: "erreur",
  E3: "erreur",
  E4: "erreur",
  E5: "erreur",
  E6: "erreur",
  E7: "erreur",
  E8: "erreur",
  E9: "erreur",
  E10: "erreur",
  E11: "erreur",
  E12: "erreur",
  E13: "erreur",
  E14: "erreur",
  E15: "erreur",
  E16: "erreur",
  A1: "avertissement",
  A2: "avertissement",
  A3: "avertissement",
  A4: "avertissement",
  A5: "avertissement",
  A7: "avertissement",
  A8: "avertissement",
  A9: "avertissement",
  A10: "avertissement",
  A11: "avertissement",
  A12: "avertissement",
  A13: "avertissement",
  A14: "avertissement",
  A15: "avertissement",
  A16: "avertissement",
  I1: "information",
  I2: "information",
  I3: "information",
  I4: "information",
  I5: "information",
  I6: "information",
};

/** Une anomalie, au format du § 5.1. */
export function anomalie(code, feuille, ligne, message) {
  return { gravite: GRAVITES[code], code, feuille, ligne, message };
}

const ORDRE_GRAVITES = ["bloquante", "erreur", "avertissement", "information"];
export const ORDRE_FEUILLES = ["lisez_moi", "Blocs", "Eléments", "Capacites", FEUILLE_ADVERSAIRES];

/** Trie les anomalies par gravité, puis par feuille et par ligne (§ 6.4). */
export function trier(anomalies) {
  return [...anomalies].sort(
    (a, b) =>
      ORDRE_GRAVITES.indexOf(a.gravite) - ORDRE_GRAVITES.indexOf(b.gravite) ||
      ORDRE_FEUILLES.indexOf(a.feuille) - ORDRE_FEUILLES.indexOf(b.feuille) ||
      (a.ligne ?? 0) - (b.ligne ?? 0) ||
      a.code.localeCompare(b.code, "fr", { numeric: true }),
  );
}

function ajouter(table, cleTable, valeur) {
  if (!table.has(cleTable)) table.set(cleTable, []);
  table.get(cleTable).push(valeur);
}

const ecrire = (parametre) => `{${parametre.nom}:${parametre.valeur}}${parametre.cible ? `(${parametre.cible})` : ""}`;
const ambigu = (trouve) => (trouve.candidats?.length > 1 ? ` (renvoi ambigu : ${trouve.candidats.map((n) => `« ${n} »`).join(", ")})` : "");

// I6 (lot 5) : dans une description, une expression entre crochets ou un
// paramètre entre accolades suivi, après des espaces, d'un mot qui finit par
// « s » ou « x », sans « (s) » ni « (x) » après lui. Avec un 1, le mot
// resterait au pluriel : « [N] cases » s'afficherait « 1 cases ». Les mots
// invariables, ou qui ne sont pas des noms, sont exclus : la liste du § 6.2,
// telle quelle. Les espaces ne passent pas un retour à la ligne, où la phrase
// s'arrête (js/banque/accord.js).
const MOTS_EXCLUS = new Set(
  "fois, pas, temps, corps, poids, prix, choix, croix, voix, bras, dos, os, mois, avis, repas, cours, succès, progrès, accès, plus, moins, sous, sans, vers, après, très, deux, trois, six, dix, aux, des, les, ses, ces, mes, tes, nos, vos, leurs, dans, hors, lors, alors, puis, mais, jamais, toujours, depuis, envers".split(", "),
);
const EXPRESSION_SUIVIE = /(\[[^[\]]*\]|\{[^{}]*\})[^\S\r\n]+(\p{L}+)/gu;

/** Les mots au pluriel sans marque d'une description, le premier seul : I6 vaut une fois par cellule. */
function plurielsSansMarque(description) {
  const texte = String(description ?? "");
  const trouves = [];
  for (const trouve of texte.matchAll(EXPRESSION_SUIVIE)) {
    const [tout, expression, mot] = trouve;
    const fin = trouve.index + tout.length;
    const finale = mot.slice(-1).toLowerCase();
    const marquee = texte.startsWith("(s)", fin) || texte.startsWith("(x)", fin);
    if ((finale === "s" || finale === "x") && !MOTS_EXCLUS.has(mot.toLowerCase()) && !marquee) trouves.push({ expression, mot, finale });
  }
  return trouves.slice(0, 1);
}

const messageI6 = (nom, { expression, mot, finale }) =>
  `La description de « ${nom} » écrit « ${expression} ${mot} » : avec un 1, elle s'affichera « 1 ${mot} ». Écrivez « ${mot.slice(0, -1)}(${finale}) » pour l'accorder.`;

/** Contrôle une banque importée ; rend ses anomalies (hors E1, E2, E6, A7, I1). */
export function controler(banque) {
  const anomalies = [];
  const signaler = (code, lieu, message) => anomalies.push(anomalie(code, lieu.feuille, lieu.ligne, message));

  const capacites = repertoire(banque.capacites.map((capacite) => capacite.nom));
  const elements = repertoire(banque.elements.map((element) => element.nom));
  const elementsParNom = new Map();
  const receveurs = new Map();
  for (const element of banque.elements) {
    if (!elementsParNom.has(element.nom)) elementsParNom.set(element.nom, element);
    for (const recu of element.parametres_recus) if (typeof recu === "string") ajouter(receveurs, recu, element.nom);
  }
  const parametres = repertoire([...receveurs.keys()]);

  // Un renvoi retrouvé sans casse, accents, espaces ni signe invisible est
  // résolu, mais signalé (A1).
  function resoudre(repertoireCible, renvoi, lieu, genre) {
    const trouve = repertoireCible.resoudre(renvoi);
    if (trouve.facon === "approchee") {
      signaler("A1", lieu, `${lieu.sujet} cite « ${renvoi} » pour ${genre} « ${trouve.nom} » : seuls la casse, les accents, les espaces ou un signe invisible diffèrent.`);
    }
    return trouve;
  }

  // E3 : même nom défini deux fois (les capacités, plus bas). Les noms se
  // comparent exactement, une fois leurs signes invisibles retirés
  // (nomCompare) : rien ne distinguerait les deux à l'écran. Le message cite
  // le nom tel qu'il est écrit.
  function doublons(objets, genre, feuille) {
    const vus = new Map();
    for (const objet of objets) {
      const nom = nomCompare(objet.nom);
      const premier = vus.get(nom);
      if (premier) signaler("E3", { feuille, ligne: objet.brut.ligne }, `${genre} « ${objet.nom} » est déjà défini ligne ${premier.brut.ligne}.`);
      else vus.set(nom, objet);
    }
  }
  doublons(banque.blocs, "Le bloc", "Blocs");
  doublons(banque.elements, "L'élément", "Eléments");
  // E3 des capacités (§ 5.1 ; complément du groupe 2 du lot 4, § 5.4).
  // L'import range les lignes de Capacites en variantes par nom tel
  // qu'écrit : deux capacités dont les noms ne diffèrent que d'un signe
  // invisible y restent deux capacités. D'une part, deux variantes d'un même
  // nom écrit et de même puissance : la plus basse est le doublon, et cite
  // la plus haute. Deux variantes d'un même nom écrit, de puissances
  // différentes, ne sont jamais un doublon.
  for (const capacite of banque.capacites) {
    const vues = new Map();
    for (const variante of [...capacite.variantes].sort((a, b) => a.brut.ligne - b.brut.ligne)) {
      const premiere = vues.get(variante.puissance);
      const lieu = { feuille: "Capacites", ligne: variante.brut.ligne };
      if (premiere) {
        signaler("E3", lieu, `La capacité « ${capacite.nom} » a déjà une variante de puissance « ${variante.puissance} », ligne ${premiere.brut.ligne}.`);
      } else vues.set(variante.puissance, variante);
    }
  }
  // D'autre part, deux capacités dont les noms, différents tels qu'écrits,
  // deviennent égaux une fois les signes invisibles retirés (nomCompare),
  // quelles que soient leurs puissances : rien ne les distingue à l'écran.
  // Dans un tel groupe, la première est celle dont la première ligne est la
  // plus haute ; chaque autre reçoit un E3 « à la ligne la plus basse »
  // (complément, § 5.4), lue ici comme la plus basse de ses propres lignes
  // (choix fait seul, réversible), et le message cite la première ligne de
  // la première. Deux noms écrits différents n'ont que ce message.
  const premiereLigne = (capacite) => Math.min(...capacite.variantes.map((variante) => variante.brut.ligne));
  const derniereLigne = (capacite) => Math.max(...capacite.variantes.map((variante) => variante.brut.ligne));
  const capacitesParNomCompare = new Map();
  for (const capacite of banque.capacites) ajouter(capacitesParNomCompare, nomCompare(capacite.nom), capacite);
  for (const groupe of capacitesParNomCompare.values()) {
    const [premiere, ...autres] = [...groupe].sort((a, b) => premiereLigne(a) - premiereLigne(b));
    for (const autre of autres) {
      signaler("E3", { feuille: "Capacites", ligne: derniereLigne(autre) }, `La capacité « ${autre.nom} » ne diffère de celle de la ligne ${premiereLigne(premiere)} que par un signe invisible.`);
    }
  }

  const rattachees = new Set();
  const portes = new Set();
  const citeesPar = new Map();

  for (const bloc of banque.blocs) {
    const lieu = { feuille: "Blocs", ligne: bloc.brut.ligne, sujet: `Le bloc « ${bloc.nom} »` };
    const viser = (cible, quoi) => {
      const trouve = resoudre(capacites, cible, lieu, "la capacité");
      if (!trouve.nom) signaler("E4", lieu, `${lieu.sujet} vise la capacité « ${cible} » (${quoi}), introuvable dans Capacites${ambigu(trouve)}.`);
    };

    for (const nom of bloc.capacites.flatMap((item) => (item.forme === "simple" ? [item.nom] : (item.options ?? [])))) {
      const trouve = resoudre(capacites, nom, lieu, "la capacité");
      if (trouve.nom) {
        rattachees.add(trouve.nom);
        ajouter(citeesPar, trouve.nom, bloc);
      } else signaler("E4", lieu, `${lieu.sujet} cite la capacité « ${nom} », introuvable dans Capacites${ambigu(trouve)}.`);
    }
    if (bloc.capacites.length === 0) signaler("I3", lieu, `${lieu.sujet} n'a aucune capacité.`);

    // Le créateur de personnage ne voit que les blocs d'un type reconnu.
    if ((bloc.type ?? "") === "") signaler("A8", lieu, `${lieu.sujet} n'a pas de type : le créateur de personnage ne le voit pas.`);
    else if (typeInconnu(bloc)) {
      signaler("A9", lieu, `${lieu.sujet} a le type « ${bloc.type} », inconnu (types reconnus : ${Object.values(TYPES).map((t) => t.nom).join(", ")}) : le créateur de personnage ne le voit pas.`);
    }

    for (const element of bloc.elements.filter((item) => item.nom)) {
      const trouve = resoudre(elements, element.nom, lieu, "l'élément");
      if (trouve.nom) portes.add(trouve.nom);
      else signaler("E5", lieu, `${lieu.sujet} cite l'élément « ${element.nom} », introuvable dans Eléments${ambigu(trouve)}.`);
      if (element.cible) viser(element.cible, `cible de l'élément ${element.nom}`);
    }

    // Un bloc qui transmet un paramètre porte l'élément qui le reçoit
    // (lisez_moi, « Syntaxe »).
    const parNom = new Map();
    for (const parametre of bloc.parametres.filter((item) => item.nom)) {
      const trouve = resoudre(parametres, parametre.nom, lieu, "le paramètre");
      if (trouve.nom) receveurs.get(trouve.nom).forEach((nom) => portes.add(nom));
      else signaler("A2", lieu, `${lieu.sujet} transmet le paramètre ${parametre.nom}, qu'aucun élément ne reçoit${ambigu(trouve)}.`);
      if (parametre.cible) viser(parametre.cible, `cible du paramètre ${parametre.nom}`);
      ajouter(parNom, cle(parametre.nom), parametre);
    }

    // E7 : sans cible, un paramètre vaut pour toutes les capacités du bloc ;
    // avec une cible, il vaut pour elle seule et l'emporte sur le même
    // paramètre sans cible (lisez_moi, « Syntaxe » : la Hache légère). Restent
    // ambiguës deux transmissions sans cible, ou deux vers la même cible.
    for (const liste of parNom.values()) {
      const conflit = liste.some((p, i) =>
        liste.slice(i + 1).some((q) => (!p.cible && !q.cible) || (p.cible && q.cible && cle(p.cible) === cle(q.cible))),
      );
      if (conflit) {
        signaler("E7", lieu, `${lieu.sujet} transmet ${liste.length} fois le paramètre ${liste[0].nom} (${liste.map(ecrire).join(", ")}) : deux fois sans cible, ou deux fois vers la même capacité, qui en recevrait plusieurs valeurs.`);
      }
    }
  }

  // A10 : un type d'armure dont deux pièces couvrent une même zone n'a pas
  // de pack (livret, « Objet » : deux pièces ne se portent pas sur une même
  // zone). La règle des packs est celle du créateur (js/personnage/packs.js) ;
  // un doublon (E3) n'y compte qu'une fois, comme dans le créateur.
  const parNom = new Map();
  for (const bloc of banque.blocs) if (!parNom.has(bloc.nom)) parNom.set(bloc.nom, bloc);
  for (const pack of packsDArmure([...parNom.values()])) {
    if (pack.propose) continue;
    const zones = pack.conflits.map((c) => `${c.nomZone.toLowerCase()} : ${c.pieces.map((p) => `« ${p.nom} »`).join(" et ")}`).join(" ; ");
    const seconde = pack.conflits[0].pieces[1];
    signaler(
      "A10",
      { feuille: "Blocs", ligne: seconde.brut.ligne },
      `Des pièces d'armure de type ${TYPES_OBJET[pack.type].nom} couvrent une même zone (${zones}) : le pack ${pack.nom} n'est pas proposé au créateur de personnage.`,
    );
  }

  const recoit = (nomElement, parametre) =>
    (elementsParNom.get(nomElement)?.parametres_recus ?? []).some((recu) => typeof recu === "string" && cle(recu) === cle(parametre));

  // A5 : un paramètre invoqué est porté quand un élément propre de la
  // capacité le reçoit, ou quand l'un des blocs qui la citent le transmet ou
  // porte un élément qui le reçoit, sans cible ou avec elle pour cible.
  function porte(nomCapacite, propres, parametre) {
    if (propres.some((nom) => recoit(nom, parametre))) return true;
    const pourElle = (cible) => !cible || capacites.resoudre(cible).nom === nomCapacite;
    return (citeesPar.get(nomCapacite) ?? []).some(
      (bloc) =>
        bloc.parametres.some((q) => q.nom && cle(q.nom) === cle(parametre) && pourElle(q.cible)) ||
        bloc.elements.some((e) => e.nom && pourElle(e.cible) && recoit(elements.resoudre(e.nom).nom, parametre)),
    );
  }

  for (const capacite of banque.capacites) {
    if (!rattachees.has(capacite.nom)) {
      signaler("A3", { feuille: "Capacites", ligne: capacite.variantes[0].brut.ligne }, `La capacité « ${capacite.nom} » n'est rattachée à aucun bloc.`);
    }
    for (const variante of capacite.variantes) {
      const lieu = { feuille: "Capacites", ligne: variante.brut.ligne, sujet: `La capacité « ${capacite.nom} »` };
      const propres = [];
      for (const element of variante.elements.filter((item) => item.nom)) {
        const trouve = resoudre(elements, element.nom, lieu, "l'élément");
        if (trouve.nom) {
          portes.add(trouve.nom);
          propres.push(trouve.nom);
        } else signaler("E5", lieu, `${lieu.sujet} cite l'élément « ${element.nom} », introuvable dans Eléments${ambigu(trouve)}.`);
      }
      for (const parametre of parametresInvoques(variante.description)) {
        if (!porte(capacite.nom, propres, parametre)) signaler("A5", lieu, `${lieu.sujet} invoque {${parametre}}, que ni elle ni ses blocs ne portent.`);
      }
      if (variante.description.trim() === "") signaler("I2", lieu, `${lieu.sujet} a une description vide.`);
      for (const pluriel of plurielsSansMarque(variante.description)) signaler("I6", lieu, messageI6(capacite.nom, pluriel));
    }
  }

  for (const element of banque.elements) {
    const lieu = { feuille: "Eléments", ligne: element.brut.ligne };
    if (!portes.has(element.nom)) signaler("A4", lieu, `L'élément « ${element.nom} » n'est porté par rien : ni bloc, ni capacité, ni paramètre transmis.`);
    if (element.description.trim() === "") signaler("I2", lieu, `L'élément « ${element.nom} » a une description vide.`);
    for (const pluriel of plurielsSansMarque(element.description)) signaler("I6", lieu, messageI6(element.nom, pluriel));
  }

  // La feuille Adversaires : ce que trouve la résolution de chaque adversaire.
  for (const constat of constatsDesAdversaires(banque)) signaler(constat.code, { feuille: FEUILLE_ADVERSAIRES, ligne: constat.ligne }, constat.message);

  return anomalies;
}
