// Contrôles des noms des protagonistes d'un combat (SPECIFICATION.md, § 17
// et § 11, domaine « Combat ») : le premier mot, les numéros d'exemplaire,
// les noms courts, les jetons et les initiales de js/combat/noms.js.
//
// Chaque règle est vue des deux côtés : deux exemplaires se numérotent, un
// seul non ; deux premiers mots confondus gardent leur nom entier, deux
// premiers mots distincts non ; des noms de même première lettre prennent
// une seconde, un nom seul à porter la sienne garde une lettre.
//
// Les initiales suivent le complément du groupe 2 du lot 4 (§ 4.11) : la
// première lettre, puis la première qui distingue, deux signes au plus. Les
// attentes du groupe 1 (une lettre de plus à chacun, tant qu'il le fallait)
// sont réécrites.
//
// Tous les noms viennent de la démonstration, ou sont inventés pour l'essai.

import { test } from "node:test";
import assert from "node:assert/strict";
import { nommer, premierMot } from "../js/combat/noms.js";

const PRIME = String.fromCodePoint(0x2032);
const SECONDE = String.fromCodePoint(0x2033);
const TIERCE = String.fromCodePoint(0x2034);
const QUARTE = String.fromCodePoint(0x2057);

// Une liste comme la donne la mise en place : un seul compteur pour les
// identifiants, dans l'ordre d'ajout.
const liste = (...protagonistes) => protagonistes.map(([camp, nom], rang) => ({ id: `${camp}${rang + 1}`, camp, nom }));

const champ = (noms, nom) => Object.fromEntries(Object.entries(noms).map(([id, valeur]) => [id, valeur[nom]]));

test("premierMot : ce qui précède le premier blanc, bords retirés", () => {
  assert.equal(premierMot("Aubépine Crèmebrûlée"), "Aubépine");
  assert.equal(premierMot("Chef de partie"), "Chef");
  assert.equal(premierMot("   Marmiton de corvée  "), "Marmiton");
  assert.equal(premierMot("Aubépine"), "Aubépine");
  assert.equal(premierMot("Chef\tde partie"), "Chef", "une tabulation est un blanc");
});

test("premierMot : ni un tiret ni une apostrophe ne coupent", () => {
  assert.equal(premierMot("Marie-Bolet la Rousse"), "Marie-Bolet");
  assert.equal(premierMot("L'Écumoire dorée"), "L'Écumoire");
  assert.equal(premierMot("Chef-de-partie"), "Chef-de-partie");
});

test("premierMot : un nom vide ou absent n'a pas de premier mot", () => {
  assert.equal(premierMot(""), "");
  assert.equal(premierMot("   "), "");
  assert.equal(premierMot(null), "");
  assert.equal(premierMot(undefined), "");
});

test("nommer : le combat de la démonstration", () => {
  const noms = nommer(liste(["pj", "Aubépine Crèmebrûlée"], ["adv", "Chef de partie"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(noms, {
    pj1: { entier: "Aubépine Crèmebrûlée", court: "Aubépine", jeton: "Aubépine", initiales: "A", exemplaire: null },
    adv2: { entier: "Chef de partie", court: "Chef", jeton: "Chef", initiales: "C", exemplaire: null },
    adv3: { entier: "Marmiton de corvée n° 1", court: "Marmiton n° 1", jeton: "Marmiton 1", initiales: "M1", exemplaire: 1 },
    adv4: { entier: "Marmiton de corvée n° 2", court: "Marmiton n° 2", jeton: "Marmiton 2", initiales: "M2", exemplaire: 2 },
  });
});

test("nommer : les exemplaires se numérotent dès qu'ils sont deux, et pas avant", () => {
  const seul = nommer(liste(["adv", "Marmiton de corvée"]));
  assert.deepEqual(seul.adv1, { entier: "Marmiton de corvée", court: "Marmiton", jeton: "Marmiton", initiales: "M", exemplaire: null });

  const deux = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(deux, "exemplaire"), { adv1: 1, adv2: 2 });
  assert.deepEqual(champ(deux, "court"), { adv1: "Marmiton n° 1", adv2: "Marmiton n° 2" });
});

test("nommer : les numéros suivent l'ordre d'ajout, même quand d'autres s'intercalent", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["pj", "Aubépine"], ["adv", "Chef de partie"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(noms, "court"), { adv1: "Marmiton n° 1", pj2: "Aubépine", adv3: "Chef", adv4: "Marmiton n° 2", adv5: "Marmiton n° 3" });
  assert.deepEqual(champ(noms, "initiales"), { adv1: "M1", pj2: "A", adv3: "C", adv4: "M2", adv5: "M3" });
});

test("nommer : un exemplaire est un adversaire du même nom, exactement", () => {
  // Une casse ou un accent de différence : deux adversaires, non deux
  // exemplaires. Leurs premiers mots se confondent : ils gardent leur nom.
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvee"]));
  assert.deepEqual(champ(noms, "exemplaire"), { adv1: null, adv2: null });
  assert.deepEqual(champ(noms, "court"), { adv1: "Marmiton de corvée", adv2: "Marmiton de corvee" });
});

test("nommer : deux PJ de même nom, ou un PJ et un adversaire de même nom, ne sont pas des exemplaires", () => {
  const pj = nommer(liste(["pj", "Aubépine"], ["pj", "Aubépine"]));
  assert.deepEqual(champ(pj, "exemplaire"), { pj1: null, pj2: null });
  assert.deepEqual(champ(pj, "entier"), { pj1: "Aubépine", pj2: "Aubépine" });

  const meles = nommer(liste(["pj", "Marmiton"], ["adv", "Marmiton"]));
  assert.deepEqual(champ(meles, "exemplaire"), { pj1: null, adv2: null });
  assert.deepEqual(champ(meles, "jeton"), { pj1: "Marmiton", adv2: "Marmiton" });
});

test("nommer : un PJ ajouté après un adversaire de même nom n'en devient pas l'exemplaire", () => {
  // L'ordre d'ajout n'y change rien : seuls des adversaires sont des
  // exemplaires, et un PJ ne prend jamais de numéro.
  const apres = nommer(liste(["adv", "Marmiton"], ["pj", "Marmiton"]));
  assert.deepEqual(champ(apres, "exemplaire"), { adv1: null, pj2: null });
  assert.deepEqual(champ(apres, "entier"), { adv1: "Marmiton", pj2: "Marmiton" });
  assert.deepEqual(champ(apres, "court"), { adv1: "Marmiton", pj2: "Marmiton" });
  assert.deepEqual(champ(apres, "jeton"), { adv1: "Marmiton", pj2: "Marmiton" });
  assert.notEqual(apres.adv1.initiales, apres.pj2.initiales, "deux protagonistes différents ont des initiales différentes");
  for (const { initiales } of Object.values(apres)) assert.ok(!/\d$/.test(initiales), `« ${initiales} » ne porte pas de numéro d'exemplaire`);

  // Pris entre deux exemplaires, le PJ reste hors de leur numérotation.
  const entre = nommer(liste(["adv", "Marmiton"], ["pj", "Marmiton"], ["adv", "Marmiton"]));
  assert.deepEqual(champ(entre, "exemplaire"), { adv1: 1, pj2: null, adv3: 2 });
  assert.deepEqual(champ(entre, "entier"), { adv1: "Marmiton n° 1", pj2: "Marmiton", adv3: "Marmiton n° 2" });
});

test("nommer : le nom court est le premier mot, quand il ne se confond avec aucun autre", () => {
  const noms = nommer(liste(["pj", "Aubépine Crèmebrûlée"], ["adv", "Chef de partie"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(noms, "court"), { pj1: "Aubépine", adv2: "Chef", adv3: "Marmiton" });
  assert.deepEqual(champ(noms, "jeton"), { pj1: "Aubépine", adv2: "Chef", adv3: "Marmiton" });
  assert.deepEqual(champ(noms, "entier"), { pj1: "Aubépine Crèmebrûlée", adv2: "Chef de partie", adv3: "Marmiton de corvée" });
});

test("nommer : deux protagonistes différents au même premier mot gardent leur nom entier", () => {
  const noms = nommer(liste(["adv", "Chef de partie"], ["adv", "Chef de rang"], ["pj", "Aubépine Crèmebrûlée"]));
  assert.deepEqual(champ(noms, "court"), { adv1: "Chef de partie", adv2: "Chef de rang", pj3: "Aubépine" });
  assert.deepEqual(champ(noms, "jeton"), { adv1: "Chef de partie", adv2: "Chef de rang", pj3: "Aubépine" });
});

test("nommer : les exemplaires d'un même adversaire, seuls à porter leur premier mot, gardent le nom court", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Chef de partie"]));
  assert.deepEqual(champ(noms, "court"), { adv1: "Marmiton n° 1", adv2: "Marmiton n° 2", adv3: "Chef" });
});

test("nommer : des exemplaires dont le premier mot est aussi celui d'un autre gardent leur nom entier, numéro compris", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de salle"]));
  assert.deepEqual(champ(noms, "court"), { adv1: "Marmiton de corvée n° 1", adv2: "Marmiton de corvée n° 2", adv3: "Marmiton de salle" });
  assert.deepEqual(champ(noms, "jeton"), { adv1: "Marmiton de corvée 1", adv2: "Marmiton de corvée 2", adv3: "Marmiton de salle" });
  assert.deepEqual(champ(noms, "entier"), { adv1: "Marmiton de corvée n° 1", adv2: "Marmiton de corvée n° 2", adv3: "Marmiton de salle" });
});

test("nommer : les premiers mots se comparent sans casse ni accents", () => {
  const confondus = nommer(liste(["pj", "CHEF étoilé"], ["adv", "Chéf de partie"]));
  assert.deepEqual(champ(confondus, "court"), { pj1: "CHEF étoilé", adv2: "Chéf de partie" });

  const distincts = nommer(liste(["pj", "Cheffe étoilée"], ["adv", "Chef de partie"]));
  assert.deepEqual(champ(distincts, "court"), { pj1: "Cheffe", adv2: "Chef" });
});

test("nommer : le jeton est le nom court, où « n° k » devient « k »", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Chef de partie"]));
  assert.deepEqual(champ(noms, "jeton"), { adv1: "Marmiton 1", adv2: "Marmiton 2", adv3: "Chef" });
});

test("nommer : l'initiale est la première lettre ou le premier chiffre du nom, en majuscule", () => {
  const noms = nommer(liste(["pj", "aubépine"], ["adv", "écumeur"], ["adv", "« Zeste »"], ["adv", "42e commis"], ["adv", "  -- l'Ogre"]));
  assert.deepEqual(champ(noms, "initiales"), { pj1: "A", adv2: "É", adv3: "Z", adv4: "4", adv5: "L" });
});

test("nommer : un nom sans lettre ni chiffre a « ? » pour initiale", () => {
  assert.equal(nommer(liste(["adv", "???"])).adv1.initiales, "?");
  assert.equal(nommer(liste(["adv", ""])).adv1.initiales, "?");
  assert.equal(nommer(liste(["adv", "— ! —"], ["adv", "— ! —"])).adv2.initiales, "?2");
  assert.equal(nommer(liste(["adv", "?a"])).adv1.initiales, "A", "dès qu'il y a une lettre, c'est elle");
});

test("nommer : les initiales d'un exemplaire portent son numéro", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Chef de partie"]));
  assert.deepEqual(champ(noms, "initiales"), { adv1: "M1", adv2: "M2", adv3: "C" });
});

test("nommer : entre noms de même première lettre, chacun prend la seconde, à la première position où ils diffèrent", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Mitron"], ["pj", "Aubépine"]));
  assert.deepEqual(champ(noms, "initiales"), { adv1: "MA1", adv2: "MA2", adv3: "MI", pj4: "A" }, "celui qui est seul à sa première lettre la garde seule");

  // La position est celle du groupe entier : ceux qu'elle ne sépare pas ne vont pas plus loin, ils reçoivent une marque.
  const trois = nommer(liste(["adv", "Marmiton"], ["adv", "Maraîcher"], ["adv", "Mitron"]));
  assert.deepEqual(champ(trois, "initiales"), { adv1: `MA${PRIME}`, adv2: `MA${SECONDE}`, adv3: "MI" });
});

test("nommer : les exemplaires d'un même adversaire ne forment pas un groupe à eux seuls", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(noms, "initiales"), { adv1: "M1", adv2: "M2", adv3: "M3" });
});

test("nommer : la seconde est un signe du nom, en majuscule ; les blancs n'occupent aucune position, une apostrophe n'en occupe aucune", () => {
  const noms = nommer(liste(["adv", "Chef de partie"], ["adv", "Chef de rang"]));
  assert.deepEqual(champ(noms, "initiales"), { adv1: "CP", adv2: "CR" });

  const signes = nommer(liste(["adv", "L'Ogre"], ["adv", "L'Orge"]));
  assert.deepEqual(champ(signes, "initiales"), { adv1: "LG", adv2: "LR" });
});

test("nommer : au-delà d'un nom, l'absence compte comme une valeur ; le nom fini n'ajoute rien, sans marque s'ils se distinguent", () => {
  const noms = nommer(liste(["adv", "Ma"], ["adv", "Mat"]));
  assert.deepEqual(champ(noms, "initiales"), { adv1: "M", adv2: "MT" });
});

test("nommer : sans position qui les distingue, ceux qui restent confondus reçoivent une marque, dans l'ordre d'ajout", () => {
  const pj = nommer(liste(["pj", "Aubépine"], ["pj", "Aubépine"]));
  assert.deepEqual(champ(pj, "initiales"), { pj1: `A${PRIME}`, pj2: `A${SECONDE}` });

  // Les mêmes lettres confondent, quel que soit le numéro : « C » et « C1 », « C2 ».
  const meles = nommer(liste(["pj", "Chef"], ["adv", "Chef"], ["adv", "Chef"]));
  assert.deepEqual(champ(meles, "initiales"), { pj1: `C${PRIME}`, adv2: `C${SECONDE}1`, adv3: `C${SECONDE}2` }, "la marque, puis le numéro d'exemplaire");

  const sansLettre = nommer(liste(["adv", "!!!"], ["adv", "***"]));
  assert.deepEqual(champ(sansLettre, "initiales"), { adv1: `?${PRIME}`, adv2: `?${SECONDE}` });
});

test("nommer : les marques ne vont qu'à ceux qui restent confondus", () => {
  const noms = nommer(liste(["pj", "Ma"], ["pj", "Ma"], ["adv", "Mat"], ["adv", "Chef"]));
  assert.deepEqual(champ(noms, "initiales"), { pj1: `M${PRIME}`, pj2: `M${SECONDE}`, adv3: "MT", adv4: "C" });
});

test("nommer : au-delà de quatre confondus, les marques s'ajoutent", () => {
  const noms = nommer(liste(["pj", "A"], ["pj", "A"], ["pj", "A"], ["pj", "A"], ["pj", "A"], ["pj", "A"]));
  assert.deepEqual(Object.values(champ(noms, "initiales")), [`A${PRIME}`, `A${SECONDE}`, `A${TIERCE}`, `A${QUARTE}`, `A${QUARTE}${PRIME}`, `A${QUARTE}${SECONDE}`]);
  assert.equal(new Set(Object.values(champ(noms, "initiales"))).size, 6);
});

// Les lettres d'initiales : sans le numéro d'exemplaire ni les marques.
const MARQUES = [PRIME, SECONDE, TIERCE, QUARTE];
const lettresDe = ({ initiales, exemplaire }) => [...(exemplaire === null ? initiales : initiales.slice(0, -String(exemplaire).length))].filter((signe) => !MARQUES.includes(signe));

test("nommer : dans un combat plein, toutes les initiales sont distinctes, de deux signes au plus", () => {
  const adversaires = ["Marmiton de corvée", "Marmiton de salle", "Maraîcher", "Chef de partie", "Chef de rang"].flatMap((nom) => Array.from({ length: 12 }, () => ["adv", nom]));
  const pj = ["Aubépine Crèmebrûlée", "Aubépine", "Amande", "Basilic", "Cerfeuil", "Ciboule", "Mélisse", "Marjolaine", "Origan", "Persil", "Romarin", "Sarriette"].map((nom) => ["pj", nom]);
  const noms = nommer(liste(...pj, ...adversaires));
  const initiales = Object.values(champ(noms, "initiales"));
  assert.equal(initiales.length, 72);
  assert.equal(new Set(initiales).size, 72);
  assert.equal(new Set(Object.values(champ(noms, "court"))).size, 72);
  for (const nom of Object.values(noms)) assert.ok(lettresDe(nom).length <= 2, nom.initiales);
});

// Relecture de fin de groupe (lot 4) : la confusion se jugeait sur les lettres
// seules, avant d'y coller le numéro d'exemplaire. Un nom qui finit par un
// chiffre recevait alors les initiales et le jeton d'un exemplaire.
const distincts = (noms, nom) => {
  const valeurs = Object.values(champ(noms, nom));
  assert.equal(new Set(valeurs).size, valeurs.length, `${nom} : ${valeurs.join(" | ")}`);
};

test("nommer : un nom qui finit par un chiffre ne prend ni les initiales ni le jeton d'un exemplaire", () => {
  // « Commis 1 », à côté de deux « Commis » : sans rien de plus, le premier des deux s'écrirait comme lui (« C1 »).
  const commis = nommer(liste(["adv", "Commis 1"], ["adv", "Commis"], ["adv", "Commis"]));
  assert.deepEqual(champ(commis, "court"), { adv1: "Commis 1", adv2: "Commis n° 1", adv3: "Commis n° 2" }, "le journal les distinguait déjà");
  assert.deepEqual(champ(commis, "jeton"), { adv1: "Commis 1", adv2: "Commis n° 1", adv3: "Commis n° 2" }, "les exemplaires gardent « n° k », tous les deux");
  assert.deepEqual(champ(commis, "initiales"), { adv1: `C1${PRIME}`, adv2: `C${SECONDE}1`, adv3: `C${SECONDE}2` }, "la seconde ne les sépare pas : une marque le fait");

  // « A2 » seul, à côté de deux « A » : les jetons se distinguaient déjà (« A2 », « A 2 »), pas les initiales.
  const a = nommer(liste(["adv", "A2"], ["adv", "A"], ["adv", "A"]));
  assert.deepEqual(champ(a, "jeton"), { adv1: "A2", adv2: "A 1", adv3: "A 2" });
  assert.deepEqual(champ(a, "initiales"), { adv1: `A2${PRIME}`, adv2: `A${SECONDE}1`, adv3: `A${SECONDE}2` });

  // Deux « A1 » contre douze « A » : « A11 » et « A12 » ne s'écrivent pas deux fois.
  const douze = nommer(liste(["adv", "A1"], ["adv", "A1"], ...Array.from({ length: 12 }, () => ["adv", "A"])));
  assert.deepEqual(Object.values(champ(douze, "initiales")).slice(0, 4), [`A1${PRIME}1`, `A1${PRIME}2`, `A${SECONDE}1`, `A${SECONDE}2`]);
  assert.equal(douze.adv14.initiales, `A${SECONDE}12`);
  for (const noms of [commis, a, douze]) {
    distincts(noms, "initiales");
    distincts(noms, "jeton");
  }
  // Un personnage se confond de même avec un exemplaire.
  const pj = nommer(liste(["adv", "Commis"], ["pj", "Commis 2"], ["adv", "Commis"]));
  assert.deepEqual(champ(pj, "jeton"), { adv1: "Commis n° 1", pj2: "Commis 2", adv3: "Commis n° 2" });
  distincts(pj, "initiales");
});

test("nommer : un chiffre final qui ne rencontre aucun exemplaire ne change rien, ni marque ni « n° » sur le jeton", () => {
  // « Commis 3 » : aucun des deux « Commis » ne porte le numéro 3.
  const noms = nommer(liste(["adv", "Commis 3"], ["adv", "Commis"], ["adv", "Commis"]));
  assert.deepEqual(champ(noms, "jeton"), { adv1: "Commis 3", adv2: "Commis 1", adv3: "Commis 2" });
  assert.deepEqual(champ(noms, "initiales"), { adv1: "C3", adv2: "C1", adv3: "C2" });
  // Dès qu'un troisième « Commis » s'ajoute, le numéro 3 existe : tout se sépare.
  const trois = nommer(liste(["adv", "Commis 3"], ["adv", "Commis"], ["adv", "Commis"], ["adv", "Commis"]));
  assert.deepEqual(champ(trois, "jeton"), { adv1: "Commis 3", adv2: "Commis n° 1", adv3: "Commis n° 2", adv4: "Commis n° 3" });
  assert.deepEqual(champ(trois, "initiales"), { adv1: `C3${PRIME}`, adv2: `C${SECONDE}1`, adv3: `C${SECONDE}2`, adv4: `C${SECONDE}3` });
  // Un seul et des exemplaires de même première lettre forment un groupe, quel que soit le numéro : chacun prend sa seconde.
  const lettres = nommer(liste(["adv", "Mitron"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(lettres, "initiales"), { adv1: "MI", adv2: "MA1", adv3: "MA2" });
});

test("nommer : dans un combat plein de noms à chiffres, toutes les initiales sont distinctes, et tous les jetons", () => {
  const exemplaires = (nom, nombre) => Array.from({ length: nombre }, () => ["adv", nom]);
  const noms = nommer(
    liste(
      ["pj", "C1"],
      ["pj", "C12"],
      ["pj", "Commis 3"],
      ...exemplaires("Commis", 12),
      ...exemplaires("Commis 1", 12),
      ["adv", "Commis 1 1"],
      ["adv", "Commis 12"],
      ...exemplaires("C", 12),
      ...exemplaires("C1", 2),
      ...exemplaires("1", 12),
      ["adv", "11"],
      ["adv", "112"],
    ),
  );
  assert.equal(Object.keys(noms).length, 57);
  for (const nom of ["initiales", "jeton", "court", "entier"]) distincts(noms, nom);
});

// ─── Les initiales du groupe 2 (complément, § 4.11) ───────────────────────
//
// La décision de l'auteur du 25/10/2026, par ses exemples, puis règle par
// règle. Les noms sont ceux de la démonstration, et ceux d'essai que permet
// le contrat du groupe 2.

const ESPACE_SANS_CHASSE = String.fromCodePoint(0x200b);

test("initiales — les exemples du complément : AC et AF, MA et MO, M1, MA12 ; MA prime, MA seconde et MO", () => {
  assert.deepEqual(champ(nommer(liste(["pj", "Aubépine Crèmebrûlée"], ["pj", "Aubépine Fleurdesel"])), "initiales"), { pj1: "AC", pj2: "AF" });
  assert.deepEqual(champ(nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Mouette chapardeuse"])), "initiales"), { adv1: "MA", adv2: "MO" });
  // Des Marmitons seuls à porter leur M : « M1 », « M2 ».
  const demonstration = nommer(liste(["pj", "Aubépine Crèmebrûlée"], ["adv", "Chef de partie"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  assert.deepEqual(champ(demonstration, "initiales"), { pj1: "A", adv2: "C", adv3: "M1", adv4: "M2" });
  // Le douzième Marmiton, à côté de la Mouette.
  const douze = nommer(liste(...Array.from({ length: 12 }, () => ["adv", "Marmiton de corvée"]), ["adv", "Mouette chapardeuse"]));
  assert.deepEqual([douze.adv1.initiales, douze.adv12.initiales, douze.adv13.initiales], ["MA1", "MA12", "MO"]);
  // La seconde est celle du groupe entier : les deux Marmitons y restent confondus, une marque les sépare.
  const trois = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée bis"], ["adv", "Mouette chapardeuse"]));
  assert.deepEqual(champ(trois, "initiales"), { adv1: `MA${PRIME}`, adv2: `MA${SECONDE}`, adv3: "MO" });
});

test("initiales — le premier signe se compare par sa clé : « É… » et « E… » font un groupe, la casse aussi ; chacun garde sa majuscule", () => {
  assert.deepEqual(champ(nommer(liste(["adv", "Émincer"], ["adv", "Emincer bis"])), "initiales"), { adv1: "É", adv2: "EB" });
  assert.deepEqual(champ(nommer(liste(["pj", "aubépine Crèmebrûlée"], ["pj", "Aubépine Fleurdesel"])), "initiales"), { pj1: "AC", pj2: "AF" });
  // Seul à sa première lettre, chacun n'en garde qu'une.
  assert.deepEqual(champ(nommer(liste(["adv", "Émincer"], ["adv", "Chef de partie"])), "initiales"), { adv1: "É", adv2: "C" });
});

test("initiales — les positions ne comptent que les lettres et les chiffres : un tiret n'est jamais la seconde ; un signe invisible n'en occupe aucune", () => {
  // Tranché par l'auteur (mission du lot 4.3, § 6, point 3) : « Chef-de-partie » ne donne plus « C- ». À côté de
  // « Chef de partie », il a les mêmes lettres : aucune position ne les distingue, une marque les sépare.
  assert.deepEqual(champ(nommer(liste(["adv", "Chef-de-partie"], ["adv", "Chef de partie"])), "initiales"), { adv1: `C${PRIME}`, adv2: `C${SECONDE}` });
  // À côté de « Chef de rang », le tiret ôté, la seconde est la première lettre qui les distingue.
  assert.deepEqual(champ(nommer(liste(["adv", "Chef-de-partie"], ["adv", "Chef de rang"])), "initiales"), { adv1: "CP", adv2: "CR" });
  // Ni une apostrophe, ni un signe : « Ch'ti » et « Ch!c » ont les lettres C, H, T… et C, H, C.
  assert.deepEqual(champ(nommer(liste(["adv", "Ch'ti"], ["adv", "Ch!c"])), "initiales"), { adv1: "CT", adv2: "CC" });
  // Un signe invisible a une clé vide : il est ôté de la suite, et le « o » qui le suit est en position 1.
  assert.deepEqual(champ(nommer(liste(["adv", "Marmiton de corvée"], ["adv", `M${ESPACE_SANS_CHASSE}ouette chapardeuse`])), "initiales"), { adv1: "MA", adv2: "MO" });
});

test("initiales — deux signes au plus, quelle que soit la longueur commune ; une majuscule est un seul point de code", () => {
  // Le groupe 1 allongeait jusqu'à la première différence ; la seconde est désormais un seul signe.
  assert.deepEqual(champ(nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée bis"])), "initiales"), { adv1: "M", adv2: "MB" });
  // « ß » s'écrit « SS » en majuscule : seul le premier signe compte, en première comme en seconde.
  assert.deepEqual(champ(nommer(liste(["pj", "Aß"], ["pj", "Ab"])), "initiales"), { pj1: "AS", pj2: "AB" });
  assert.equal(nommer(liste(["pj", "ßa"])).pj1.initiales, "S");
});

test("initiales — un combat plein des noms de la démonstration et d'essai : 72 initiales distinctes, de deux signes au plus", () => {
  const nomsDEssai = ["Aubépine Crèmebrûlée", "Aubépine Fleurdesel", "Mouette chapardeuse", "Marmiton de corvée", "Marmiton de corvée bis", "Chef de partie"];
  const pj = [...nomsDEssai, ...nomsDEssai].map((nom) => ["pj", nom]);
  const adversaires = ["Marmiton de corvée", "Marmiton de corvée bis", "Mouette chapardeuse", "Chef de partie", "Brûlot → ✓ contre tous"].flatMap((nom) => Array.from({ length: 12 }, () => ["adv", nom]));
  const noms = nommer(liste(...pj, ...adversaires));
  assert.equal(Object.keys(noms).length, 72);
  distincts(noms, "initiales");
  for (const nom of Object.values(noms)) assert.ok(lettresDe(nom).length <= 2, nom.initiales);
  // Quelques-unes, mot pour mot : deux PJ de même nom se marquent, les six familles « MA » aussi, le Brûlot est seul à son B.
  assert.deepEqual([noms.pj1.initiales, noms.pj7.initiales, noms.pj4.initiales, noms.adv13.initiales, noms.adv49.initiales, noms.adv72.initiales], [
    `AC${PRIME}`,
    `AC${SECONDE}`,
    `MA${PRIME}`,
    `MA${QUARTE}${PRIME}1`,
    `C${TIERCE}1`,
    "B12",
  ]);
});

test("initiales — un nom hostile qui porte une marque ne la prend jamais pour seconde, ni les initiales d'un autre", () => {
  // Depuis le lot 4.3, seules les lettres et les chiffres comptent : la prime de « A′x » est ôtée, sa seconde est « X ».
  const noms = nommer(liste(["pj", "A"], ["pj", "A"], ["pj", `A${PRIME}x`]));
  assert.deepEqual(champ(noms, "initiales"), { pj1: `A${PRIME}`, pj2: `A${SECONDE}`, pj3: "AX" });
  distincts(noms, "initiales");
});

test("nommer : retirer un exemplaire renumérote, et le dernier resté perd son numéro", () => {
  const trois = liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]);
  assert.deepEqual(champ(nommer(trois), "court"), { adv1: "Marmiton n° 1", adv2: "Marmiton n° 2", adv3: "Marmiton n° 3" });
  assert.deepEqual(champ(nommer(trois.slice(1)), "court"), { adv2: "Marmiton n° 1", adv3: "Marmiton n° 2" });
  assert.deepEqual(champ(nommer(trois.slice(2)), "court"), { adv3: "Marmiton" });
});

test("nommer : aucune espace insécable, et rien que des espaces ordinaires autour de « n° »", () => {
  const noms = nommer(liste(["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]));
  const texte = JSON.stringify(noms);
  assert.ok(!texte.includes(String.fromCodePoint(0x00a0)));
  assert.ok(!texte.includes(String.fromCodePoint(0x202f)));
  assert.equal(noms.adv1.entier, ["Marmiton", "de", "corvée", "n°", "1"].join(String.fromCodePoint(0x20)));
});

test("nommer : un nom hostile reste un texte, et rien n'est lu d'une liste vide", () => {
  assert.deepEqual(nommer([]), {});
  const noms = nommer(liste(["adv", "<b>Chef</b> de partie"], ["adv", "constructor"], ["pj", null]));
  assert.equal(noms.adv1.court, "<b>Chef</b>");
  assert.equal(noms.adv1.initiales, "B");
  assert.equal(noms.adv2.court, "constructor");
  assert.deepEqual(noms.pj3, { entier: "", court: "", jeton: "", initiales: "?", exemplaire: null });
});

test("nommer : le résultat passe par JSON à l'identique, et ne dépend que de la liste", () => {
  const protagonistes = liste(["pj", "Aubépine Crèmebrûlée"], ["adv", "Marmiton de corvée"], ["adv", "Marmiton de corvée"]);
  const noms = nommer(protagonistes);
  assert.deepEqual(JSON.parse(JSON.stringify(noms)), noms);
  assert.deepEqual(nommer(protagonistes), noms);
  assert.deepEqual(Object.keys(noms), ["pj1", "adv2", "adv3"], "dans l'ordre d'ajout");
});
