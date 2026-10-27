// Les noms des protagonistes d'un combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) »).
//
// Un protagoniste porte quatre écritures de son nom : l'entier (partout, et
// dans le titre de son jeton), le court (le journal), celui du jeton (la
// carte), et ses initiales (les pastilles, et les jetons du téléphone). Ce
// module les calcule toutes d'un seul geste, pour la liste entière : un nom
// court ou des initiales ne valent que s'ils distinguent chacun des autres,
// et retirer un protagoniste avant le lancement renumérote donc les siens
// sans rien de plus. Rien de ce qu'il rend n'est gardé avec le combat.
//
// Les initiales suivent la décision de l'auteur du 25/10/2026 (complément
// du groupe 2, § 4.11) : la première lettre, puis, entre noms de même
// première lettre, la première qui les distingue ; deux signes au plus.
//
// Ce sont des règles d'interface, non des règles du jeu. Un nom est une
// donnée hostile : il n'est jamais interprété, seulement découpé.

import { cle } from "../banque/noms.js";

const LETTRE_OU_CHIFFRE = /[\p{L}\p{N}]/u;

// Les marques qui départagent des protagonistes que leurs initiales ne
// distinguent pas : prime, seconde, tierce, quarte. Elles sont données par
// leur code, pour qu'un éditeur ne les change pas en apostrophes.
const MARQUES = [0x2032, 0x2033, 0x2034, 0x2057].map((code) => String.fromCodePoint(code));

function marque(rang) {
  const derniere = MARQUES.length;
  return rang <= derniere ? MARQUES[rang - 1] : MARQUES[derniere - 1] + marque(rang - derniere);
}

/** Un signe en majuscule : le premier point de code de sa majuscule (« ß » donne « S »). */
function majuscule(signe) {
  return String.fromCodePoint(signe.toUpperCase().codePointAt(0));
}

/**
 * La suite d'un nom, que lisent ses initiales : ses lettres et ses chiffres
 * seuls, dans l'ordre, chacun avec sa clé (cle(), la comparaison du § 6.3 :
 * sans casse, accents, espaces ni signe invisible). Tout autre signe est ôté,
 * tirets et apostrophes compris (mission du lot 4.3, § 6, point 3 :
 * « Chef-de-partie » ne donne plus « C- ») ; les signes de clé vide aussi.
 * Vide pour un nom sans lettre ni chiffre.
 */
function suiteDe(nom) {
  return [...nom]
    .filter((signe) => LETTRE_OU_CHIFFRE.test(signe))
    .map((signe) => ({ signe, cle: cle(signe) }))
    .filter((entree) => entree.cle !== "");
}

/**
 * Le premier mot d'un nom : ce qui précède le premier blanc, une fois les
 * bords retirés. Ni un tiret ni une apostrophe ne coupent.
 */
export function premierMot(nom) {
  return String(nom ?? "")
    .trim()
    .split(/\s/u)[0];
}

/**
 * Les noms de tous les protagonistes, par identifiant.
 *
 * liste : [{ id, camp, nom }], dans l'ordre d'ajout, qui est le seul ordre
 * lu ici. Rend { [id]: { entier, court, jeton, initiales, exemplaire } }.
 *
 * - Les exemplaires d'un adversaire sont les adversaires dont le nom est
 *   exactement le même ; dès qu'ils sont deux, ils se numérotent dans l'ordre
 *   d'ajout (« n° 1 », « n° 2 »…), et « exemplaire » porte ce numéro (sinon
 *   null). Deux PJ de même nom ne sont pas des exemplaires.
 * - Le nom court est le premier mot. Deux protagonistes qui ne sont pas des
 *   exemplaires du même adversaire et dont les premiers mots se confondent
 *   (comparés par cle()) gardent leur nom entier.
 * - Le jeton est le nom court, où « n° k » devient « k ». Un nom peut finir
 *   par un chiffre : si « Commis 1 » côtoie deux « Commis », ces deux-là
 *   gardent « n° k » sur leur jeton, qui serait sinon celui de l'autre.
 * - Les initiales (compl. § 4.11) : la première lettre ou le premier chiffre
 *   du nom, en majuscule (« ? » faute d'un tel signe). Les protagonistes
 *   dont ce premier signe a la même clé, hors exemplaires d'un même
 *   adversaire, forment un groupe ; dans un groupe de deux ou plus, chacun
 *   ajoute, en majuscule, le signe de son nom à la première position où les
 *   clés ne sont pas toutes égales (au-delà d'un nom, l'absence compte comme
 *   une valeur, et ce nom n'ajoute rien). Deux signes au plus. Ceux qui se
 *   confondent encore (mêmes lettres, ou une initiale écrite, numéro
 *   compris, égale à une autre) reçoivent une marque, dans l'ordre d'ajout ;
 *   le numéro d'exemplaire vient à la fin. Deux protagonistes différents
 *   n'ont donc jamais les mêmes initiales.
 */
export function nommer(liste) {
  // Les exemplaires d'un même adversaire partagent tout sauf leur numéro :
  // ils forment une seule « famille », qui n'entre jamais en collision avec
  // elle-même. Tout autre protagoniste est seul dans la sienne.
  const familles = [];
  const familleDeLAdversaire = new Map();
  const membres = liste.map(({ id, camp, nom: brut }) => {
    const nom = String(brut ?? "");
    let famille = camp === "adv" ? familleDeLAdversaire.get(nom) : undefined;
    if (!famille) {
      famille = {
        nom,
        mot: premierMot(nom),
        suite: suiteDe(nom),
        lettres: "",
        membres: 0,
        entier: false,
        marque: "",
      };
      familles.push(famille);
      if (camp === "adv") familleDeLAdversaire.set(nom, famille);
    }
    famille.membres += 1;
    return { id, famille, rang: famille.membres };
  });

  // Les familles regroupées par une valeur, dans l'ordre d'ajout ; seuls
  // restent les groupes de deux familles ou plus.
  const confondues = (cleDe) => {
    const groupes = new Map();
    for (const famille of familles) {
      const valeur = cleDe(famille);
      if (!groupes.has(valeur)) groupes.set(valeur, []);
      groupes.get(valeur).push(famille);
    }
    return [...groupes.values()].filter((groupe) => groupe.length > 1);
  };

  for (const groupe of confondues((famille) => cle(famille.mot))) {
    for (const famille of groupe) famille.entier = true;
  }

  // Ce qu'une famille écrit d'un texte : une fois sans numéro si elle n'a
  // qu'un membre, sinon une fois par exemplaire, avec le sien.
  const numerotes = (famille, ecrire) => (famille.membres > 1 ? Array.from({ length: famille.membres }, (_, rang) => ecrire(rang + 1)) : [ecrire(null)]);

  // Les initiales. La première : le premier signe de la suite, en majuscule.
  // Les familles dont ce signe a la même clé forment un groupe (« É » et
  // « E » en font un) ; celles qui n'en ont pas, aussi.
  for (const famille of familles) famille.lettres = famille.suite.length > 0 ? majuscule(famille.suite[0].signe) : "?";
  for (const groupe of confondues((famille) => famille.suite[0]?.cle ?? null)) {
    // La seconde : à la première position où les clés du groupe ne sont pas
    // toutes égales, la même pour tout le groupe ; un nom déjà fini n'y a
    // rien, et n'ajoute rien. Sans une telle position, aucune seconde.
    const longueur = Math.max(...groupe.map((famille) => famille.suite.length));
    for (let position = 1; position < longueur; position += 1) {
      if (new Set(groupe.map((famille) => famille.suite[position]?.cle ?? null)).size === 1) continue;
      for (const famille of groupe) {
        const entree = famille.suite[position];
        if (entree) famille.lettres += majuscule(entree.signe);
      }
      break;
    }
  }

  const initialesDe = (famille, exemplaire) => `${famille.lettres}${famille.marque}${exemplaire ?? ""}`;
  const ecrites = (famille) => numerotes(famille, (exemplaire) => initialesDe(famille, exemplaire));

  // Les familles que leurs initiales confondent encore. Les lettres seules
  // les confondent déjà, quel que soit le numéro (« M » et « M1 ») ; et un
  // nom peut finir par un chiffre : « Commis 1 » à côté de deux « Commis »
  // s'écrirait « C1 », comme le premier des deux. Deux familles se
  // confondent donc quand elles ont les mêmes lettres, ou quand l'une de
  // leurs initiales, numéro compris, est aussi celle de l'autre ; les groupes
  // sont ceux que ces rencontres relient, de proche en proche.
  const chef = new Map(familles.map((famille) => [famille, famille]));
  const chefDe = (famille) => {
    let courant = famille;
    while (chef.get(courant) !== courant) courant = chef.get(courant);
    return courant;
  };
  const premiere = new Map();
  for (const famille of familles) {
    for (const repere of [`lettres:${famille.lettres}`, ...ecrites(famille).map((ecrite) => `ecrit:${ecrite}`)]) {
      if (premiere.has(repere)) chef.set(chefDe(famille), chefDe(premiere.get(repere)));
      else premiere.set(repere, famille);
    }
  }
  // Une marque n'est ni une lettre, ni un chiffre, ni un signe ordinaire :
  // posée entre les lettres et le numéro, elle sépare ceux qui restent
  // confondus, entre eux comme de tous les autres.
  for (const groupe of confondues(chefDe)) {
    groupe.forEach((famille, rang) => {
      famille.marque = marque(rang + 1);
    });
  }
  // Un filet, pour un nom hostile dont la seconde serait elle-même une
  // marque (une lettre suivie d'une prime) : la marque d'un autre
  // l'écrirait de même. Dans l'ordre d'ajout, une famille dont une initiale
  // est déjà prise reçoit une marque de plus, la première qui la rend libre.
  // Sur tout autre nom, il ne change rien.
  const prises = new Set();
  for (const famille of familles) {
    const avant = famille.marque;
    for (let rang = 1; ecrites(famille).some((ecrite) => prises.has(ecrite)); rang += 1) famille.marque = avant + marque(rang);
    for (const ecrite of ecrites(famille)) prises.add(ecrite);
  }

  // Le jeton d'un exemplaire écrit « k » pour « n° k ». Quand ce jeton serait
  // aussi celui d'un autre protagoniste, les exemplaires de cet adversaire
  // gardent tous « n° k ».
  const base = (famille) => (famille.entier ? famille.nom : famille.mot);
  const jetonBref = (famille, exemplaire) => (exemplaire === null ? base(famille) : `${base(famille)} ${exemplaire}`);
  const porteurs = new Map();
  for (const famille of familles) {
    for (const jeton of numerotes(famille, (exemplaire) => jetonBref(famille, exemplaire))) porteurs.set(jeton, (porteurs.get(jeton) ?? 0) + 1);
  }
  const gardeSonNumero = (famille) => famille.membres > 1 && numerotes(famille, (exemplaire) => jetonBref(famille, exemplaire)).some((jeton) => porteurs.get(jeton) > 1);

  const noms = {};
  for (const { id, famille, rang } of membres) {
    const exemplaire = famille.membres > 1 ? rang : null;
    const numero = exemplaire === null ? "" : ` n° ${exemplaire}`;
    const court = `${base(famille)}${numero}`;
    noms[id] = {
      entier: `${famille.nom}${numero}`,
      court,
      jeton: gardeSonNumero(famille) ? court : jetonBref(famille, exemplaire),
      initiales: initialesDe(famille, exemplaire),
      exemplaire,
    };
  }
  return noms;
}
