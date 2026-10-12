// Les rôles câblés du simulateur de combat (SPECIFICATION.md, § 17).
//
// Le simulateur sait jouer quelques capacités sans qu'on lui dise comment :
// le déplacement, l'esquive, huit passifs… Il les reconnaît à leur nom, et à
// lui seul. Ce module est le seul à porter le tableau qui lie un rôle à un
// nom ; la photographie d'un protagoniste y lit le rôle de chaque capacité,
// et le noyau du combat ne lit ensuite que ce rôle, jamais un nom.
//
// Le dépôt est public, et les noms du classeur de l'auteur n'y entrent pas.
// Ceux de la démonstration, fictifs, s'écrivent en clair ; ceux du vrai
// classeur n'y sont que par leur empreinte : le SHA-256 de cle(nom), en
// hexadécimal. Un nom changé dans le classeur ne se reconnaît plus : la
// préparation le dit, par la ligne des « câblés absents ».

import { cle } from "../banque/noms.js";
import { empreinte } from "../securite/chiffrement.js";

// L'ordre est celui du tableau du § 17 : c'est aussi celui de la ligne des
// absents. « demo » est nul quand la démonstration n'a pas de capacité pour
// ce rôle. Les empreintes se recalculent hors dépôt, d'après le tableau de la
// mission, avec le cle() du moment : si cle() change, elles changent toutes.
// Le rôle « mains_nues » n'est pas ici : il ne tient pas à un nom, mais au
// paramètre « degats » du bloc de base.
export const TABLE = Object.freeze([
  { role: "deplacement", libelle: "déplacement", demo: "Pas chassé", empreinte: "5429bf852d9d299189b9b75e0f52b3697341930421638207ffc563c8434ff0b4" },
  { role: "jet_de_caracteristique", libelle: "jet de caractéristique", demo: "Goûter", empreinte: "8824b4c9997dbd7a1953a90121e6ec224db4f9c053f5e554e3c2217b93bf3593" },
  { role: "esquive", libelle: "esquive", demo: "Pas de côté", empreinte: "e77d0e6205e226652b8a8254702e6a09f98c1a6437daf73fa3413a32b674c313" },
  { role: "attendre", libelle: "attendre", demo: "Guetter", empreinte: "3f5f9f80f7d64c93754f0014a6f6592df8a6a8f87dbcaf447ad25b3d3e2aaccb" },
  { role: "passer_son_tour", libelle: "passer son tour", demo: null, empreinte: "9cdeb09c36873f08a05a37c4f1fba361c56b725c30988ffbb3741c7d466e7b80" },
  { role: "jet_de_defense", libelle: "jet de défense", demo: null, empreinte: "3ff626a0e7c23e3d854180d633ab3aca58804a2b612549cd06795d51e656282c" },
  { role: "bonus_force", libelle: "bonus de Force", demo: "Costaud", empreinte: "41fd1136eac6cd65c1d987cec5f09f1f3820ed00d605e8034065a2bad0c37d71" },
  { role: "bonus_agilite", libelle: "bonus d'Agilité", demo: "Vif", empreinte: "052ff38befb367b06353d0c39e3fca98f0d4ae2da161ae681010e299120ad502" },
  { role: "bonus_precision", libelle: "bonus de Précision", demo: null, empreinte: "8ba17dab9c42da0746392aa175b0062d63efde4345c12baf5736673eda70277c" },
  { role: "petit", libelle: "petit", demo: null, empreinte: "8e3cefcb3c22369aad72eb9c22a0d0292c0640f01dfe2d6eb2827b4e5baa4deb" },
  { role: "seul_sur_sa_case", libelle: "seul sur sa case", demo: "Solo du chef", empreinte: "a7e5108398cee81217f9e1b86809214a5024842a2dc04885a3bf1f55b8f51b7f" },
  { role: "en_meute", libelle: "en meute", demo: "Brigade", empreinte: "16dff7bea64800557a81bb1a7945c4b652aa0b6f1c51ad0e53d95230f653d1a9" },
  { role: "esprit_de_corps", libelle: "esprit de corps", demo: null, empreinte: "1d309346cf2f05a403a0e2ee4999e5efa9a157b68fd1d82d3969c70fab1d6de9" },
  { role: "degrossir", libelle: "dégrossir", demo: "Réduction", empreinte: "27ec7a4ee6cf10f95f7679a5a8b2dc86d7a1706a03944bc1660057a5ae1b4105" },
].map((entree) => Object.freeze(entree)));

// Les deux façons de reconnaître, une par mode et jamais les deux à la fois :
// un nom fictif ne doit pas câbler une capacité du vrai classeur qui
// porterait ce nom par hasard, ni l'inverse.
const PREFIXE = "sha256:";
const RECONNAITRE = {
  demo: {
    attendus: TABLE.filter((entree) => entree.demo !== null),
    marque: (entree) => cle(entree.demo),
    marqueDe: async (cleDuNom) => cleDuNom,
  },
  reel: {
    attendus: TABLE,
    marque: (entree) => entree.empreinte,
    marqueDe: async (cleDuNom) => (await empreinte(cleDuNom)).slice(PREFIXE.length),
  },
};

// Condenser chaque nom d'une banque demande une attente : elle se paie une
// fois par banque ouverte et par mode, après quoi les photographies sont
// synchrones. La banque est un objet neuf à chaque ouverture ou republication.
const memoire = new WeakMap();

async function dresser(banque, mode) {
  const { attendus, marque, marqueDe } = RECONNAITRE[mode];
  const roleParMarque = new Map(attendus.map((entree) => [marque(entree), entree.role]));
  const cles = new Set();
  for (const capacite of Array.isArray(banque.capacites) ? banque.capacites : []) {
    const cleDuNom = cle(capacite?.nom);
    if (cleDuNom !== "") cles.add(cleDuNom);
  }
  const lues = await Promise.all([...cles].map(async (cleDuNom) => [cleDuNom, roleParMarque.get(await marqueDe(cleDuNom))]));
  const parCle = new Map(lues.filter(([, role]) => role !== undefined));
  const portes = new Set(parCle.values());
  const absents = Object.freeze(attendus.filter((entree) => !portes.has(entree.role)).map((entree) => entree.libelle));
  return Object.freeze({ parCle, absents });
}

/**
 * Le rôle de chaque capacité câblée d'une banque, pour un mode ("demo" ou
 * "reel") : parCle va de cle(nom) au code du rôle ; absents donne, dans
 * l'ordre du tableau, les libellés des rôles que ce mode attend et qu'aucune
 * capacité de la banque ne porte. Le résultat est le même objet d'un appel à
 * l'autre : qui le reçoit ne le modifie pas.
 */
export async function tableDesRoles(banque, mode) {
  if (!Object.hasOwn(RECONNAITRE, mode)) throw new TypeError(`Mode inconnu : ${mode}`);
  if (banque === null || typeof banque !== "object") throw new TypeError("La banque n'est pas ouverte.");
  let parMode = memoire.get(banque);
  if (!parMode) {
    parMode = new Map();
    memoire.set(banque, parMode);
  }
  if (!parMode.has(mode)) {
    const promesse = dresser(banque, mode);
    parMode.set(mode, promesse);
    // Un échec (un navigateur sans condensat) ne se mémorise pas : la visite
    // suivante de l'écran réessaie.
    promesse.catch(() => {
      if (parMode.get(mode) === promesse) parMode.delete(mode);
    });
  }
  return parMode.get(mode);
}

/** La ligne de la préparation qui nomme les rôles absents ; null quand il n'en manque aucun. */
export function ecrireAbsents(absents) {
  if (!Array.isArray(absents) || absents.length === 0) return null;
  return `Câblés absents de la banque : ${absents.join(", ")}.`;
}
