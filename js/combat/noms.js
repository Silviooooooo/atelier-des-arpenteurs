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
// Ce sont des règles d'interface, non des règles du jeu. Un nom est une
// donnée hostile : il n'est jamais interprété, seulement découpé.

import { cle } from "../banque/noms.js";

const LETTRE_OU_CHIFFRE = /[\p{L}\p{N}]/u;

// Les marques qui départagent des protagonistes dont le nom entier ne suffit
// plus à faire des initiales distinctes : prime, seconde, tierce, quarte.
// Elles sont données par leur code, pour qu'un éditeur ne les change pas en
// apostrophes.
const MARQUES = [0x2032, 0x2033, 0x2034, 0x2057].map((code) => String.fromCodePoint(code));

function marque(rang) {
  const derniere = MARQUES.length;
  return rang <= derniere ? MARQUES[rang - 1] : MARQUES[derniere - 1] + marque(rang - derniere);
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
 * - Le jeton est le nom court, où « n° k » devient « k ».
 * - Les initiales sont le premier signe du nom qui est une lettre ou un
 *   chiffre, en majuscule (« ? » faute d'un tel signe), puis le numéro
 *   d'exemplaire. Tant que deux protagonistes qui ne sont pas des exemplaires
 *   du même adversaire ont les mêmes lettres, chacun prend une lettre de plus
 *   de son nom ; quand un nom est épuisé, ceux qui restent confondus
 *   reçoivent une marque, dans l'ordre d'ajout.
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
      const signes = [...nom].filter((signe) => LETTRE_OU_CHIFFRE.test(signe));
      famille = {
        nom,
        mot: premierMot(nom),
        signes: signes.length > 0 ? [signes[0].toUpperCase(), ...signes.slice(1)] : ["?"],
        longueur: 1,
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

  const lettres = (famille) => famille.signes.slice(0, famille.longueur).join("");
  for (;;) {
    let allonge = false;
    for (const groupe of confondues(lettres)) {
      for (const famille of groupe) {
        if (famille.longueur < famille.signes.length) {
          famille.longueur += 1;
          allonge = true;
        }
      }
    }
    if (!allonge) break;
  }
  for (const groupe of confondues(lettres)) {
    groupe.forEach((famille, rang) => {
      famille.marque = marque(rang + 1);
    });
  }

  const noms = {};
  for (const { id, famille, rang } of membres) {
    const exemplaire = famille.membres > 1 ? rang : null;
    const base = famille.entier ? famille.nom : famille.mot;
    const numero = exemplaire === null ? "" : ` n° ${exemplaire}`;
    noms[id] = {
      entier: `${famille.nom}${numero}`,
      court: `${base}${numero}`,
      jeton: exemplaire === null ? base : `${base} ${exemplaire}`,
      initiales: `${lettres(famille)}${famille.marque}${exemplaire ?? ""}`,
      exemplaire,
    };
  }
  return noms;
}
