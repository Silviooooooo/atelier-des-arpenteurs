// Banc du simulateur de combat sur le classeur réel (SPECIFICATION.md, § 17
// « Le simulateur de combat (lot 4) », et § 11).
//
//   node tests/banc_combat_reel.js chemin/vers/regles_jdr.xlsx chemin/vers/scenario.json
//
// Les contrôles de node --test ne voient que la démonstration, dont les noms
// sont fictifs. Ce banc rejoue un combat de référence sur le vrai classeur,
// avec ses dés imposés, pour vérifier ce qu'eux ne peuvent pas voir :
// - que chaque rôle câblé y est reconnu par l'empreinte de son nom : la ligne
//   « Câblés absents de la banque » doit être vide ;
// - que les personnages et les adversaires du scénario se photographient, et
//   avec eux chaque adversaire complet du classeur : un texte du classeur qui
//   sortirait des bornes d'une photographie se voit ici, avant de se voir à
//   l'écran ;
// - que le combat joué rend le journal du scénario, ligne à ligne et mot pour
//   mot, et son état final ;
// - que ce combat, tel qu'il serait gardé, se relit et se rejoue à l'identique ;
// - qu'arrêté à un moment que dit le scénario (celui que montre la maquette),
//   il attend le dé et montre l'état qu'on en attend.
//
// node --test ne le lance pas : il demande le classeur réel, qui n'entre
// jamais dans le dépôt. Le classeur se lit là où il est ; le banc ne le copie
// pas et n'écrit rien. Il ne garde aucune donnée réelle : le scénario, qui
// porte des noms du classeur, reste hors dépôt, et ce fichier n'en écrit
// aucun.
//
// Un écart n'est pas un échec : l'auteur a pu changer son classeur depuis que
// le scénario a été écrit. Le banc dit chaque écart, et les valeurs de départ
// qui aident à l'expliquer ; il ne corrige rien. Il rend 1 seulement s'il ne
// peut pas jouer le combat (un fichier illisible, une photographie refusée,
// un geste que le moteur refuse), 2 s'il lui manque un argument.
//
// ── Le scénario ─────────────────────────────────────────────────────────────
//
// Un fichier JSON, au format du lecteur de scénario (tests/outils/scenario.js :
// mode, quiCommence, lanceLe, ajouts, cases, gestes), et quatre champs de plus :
// - personnages : les personnages des ajouts « pj », au format du créateur
//   (js/personnage/format.js) ; chacun se retrouve par son nom ;
// - journalAttendu : les lignes du journal, dans l'ordre ;
// - etatAttendu : l'état final, un protagoniste par entrée, dans l'ordre
//   d'ajout (la forme est dite devant ecartsDeLEtat) ;
// - arrets, facultatif : des moments où rejouer le combat pour y regarder ce
//   qu'il attend, chacun { nom, jusqua, … } : « jusqua » est celui du lecteur
//   de scénario, le reste est dit devant ecartsDeLArret.
//
// Les trois comparaisons sont exportées : le contrôle du combat de référence
// fictif (tests/combat_reference.test.js) emploie les mêmes, et les voit dire
// un écart puis se taire. Ce que le banc compare sur le vrai classeur est
// ainsi tenu par node --test.

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { indexerAdversaires } from "../js/adversaire/resolution.js";
import { importerFichier } from "../js/banque/importation.js";
import { validerContenu } from "../js/combat/forme.js";
import { evaluerEssai } from "../js/combat/jet.js";
import { rejouer } from "../js/combat/moteur.js";
import { offre } from "../js/combat/offre.js";
import { photographierAdversaire, photographierPersonnage } from "../js/combat/photographie.js";
import { ecrireAbsents, tableDesRoles } from "../js/combat/roles.js";
import { blessuresDe, gesteEnCours } from "../js/combat/valeurs.js";
import { indexerCreation } from "../js/personnage/calcul.js";
import { accepter } from "../js/personnage/format.js";
import { versContenu } from "./outils/scenario.js";

// ─── Les comparaisons ───────────────────────────────────────────────────────

const codeDe = (signe) => `U+${signe.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

// Où deux lignes se séparent : le rang du premier signe qui diffère, compté
// de 1, et les deux signes avec leur code. Deux signes qui se ressemblent (un
// trait d'union et un signe moins, une espace et une espace insécable) ne se
// distinguent à l'œil que par là.
function premierEcart(obtenu, attendu) {
  const a = [...obtenu];
  const b = [...attendu];
  let rang = 0;
  while (rang < a.length && rang < b.length && a[rang] === b[rang]) rang += 1;
  const dire = (signes) => (rang < signes.length ? `« ${signes[rang]} », ${codeDe(signes[rang])}` : "la fin de la ligne");
  return `au signe ${rang + 1} (obtenu ${dire(a)} ; attendu ${dire(b)})`;
}

/**
 * Les écarts entre le journal d'un combat et celui qu'on attend, ligne à
 * ligne et mot pour mot. lignes, attendues : des listes de textes. Rend une
 * liste de phrases, vide quand les deux journaux sont les mêmes ; chacune
 * cite sa ligne, comptée de 1, puis ce qui a été obtenu et ce qui était
 * attendu.
 */
export function ecartsDuJournal(lignes, attendues) {
  const ecarts = [];
  for (let rang = 0; rang < Math.max(lignes.length, attendues.length); rang += 1) {
    const obtenu = lignes[rang];
    const attendu = attendues[rang];
    if (obtenu === attendu) continue;
    if (obtenu === undefined) ecarts.push(`ligne ${rang + 1}, absente du journal :\n    attendu : ${attendu}`);
    else if (attendu === undefined) ecarts.push(`ligne ${rang + 1}, en trop dans le journal :\n    obtenu  : ${obtenu}`);
    else ecarts.push(`ligne ${rang + 1}, ${premierEcart(obtenu, attendu)} :\n    obtenu  : ${obtenu}\n    attendu : ${attendu}`);
  }
  return ecarts;
}

// Les nombres d'un protagoniste que l'état attendu peut dire, et comment les
// nommer dans un écart.
const NOMBRES_COMPARES = [
  ["case", "case"],
  ["actions", "actions"],
  ["actionsMax", "actions au plus"],
  ["souffle", "souffle"],
  ["souffleMax", "souffle au plus"],
  ["corps", "corps"],
  ["corpsMax", "corps au plus"],
  ["attaque", "attaque"],
  ["defense", "défense"],
];

const dit = (valeur) => valeur !== null && valeur !== undefined;

/**
 * Les écarts entre l'état d'un combat et l'état attendu. Rend une liste de
 * phrases, vide quand l'état est celui qu'on attend ; chacune nomme le
 * protagoniste, puis ce qui diffère.
 *
 * attendus : un protagoniste par entrée, dans l'ordre d'ajout :
 *   { protagoniste, case, actions, actionsMax, souffle, souffleMax, corps,
 *     corpsMax, attaque, defense, liens, mort, blessures, zones }
 * - protagoniste : son nom court, celui du journal ;
 * - un nombre nul ou absent n'est pas dit, et ne se compare pas (les actions
 *   d'un mort, les blessures d'un adversaire) ;
 * - liens : [{ nom, points, max }], dans l'ordre des jauges ; nul : non dit ;
 * - mort : null pour un vivant, { tour } pour un mort (un tour nul : non dit) ;
 *   absent : non dit ;
 * - blessures : le nombre de zones dont la résistance est à 0 ;
 * - zones : [{ code, armure, armureMax, resistance, resistanceMax }], chacune
 *   retrouvée par son code (ou par « nom », pour une zone que la banque ne
 *   reconnaît pas). Toute zone qui n'y figure pas doit être intacte : armure
 *   et résistance à leur maximum.
 */
export function ecartsDeLEtat(etat, attendus) {
  const ecarts = [];
  if (etat.ordre.length !== attendus.length) ecarts.push(`Le combat compte ${etat.ordre.length} protagoniste(s), l'état attendu ${attendus.length}.`);

  attendus.forEach((attendu, rang) => {
    const qui = attendu.protagoniste;
    const id = etat.ordre.find((un) => etat.noms[un].court === qui);
    if (id === undefined) {
      ecarts.push(`${qui} : absent du combat (noms courts : ${etat.ordre.map((un) => etat.noms[un].court).join(", ")}).`);
      return;
    }
    const courant = etat.protagonistes[id];
    const photo = etat.photos[id];
    const comparer = (quoi, obtenu, voulu) => {
      if (obtenu !== voulu) ecarts.push(`${qui} : ${quoi} ${obtenu}, attendu ${voulu}.`);
    };

    if (etat.ordre[rang] !== id) ecarts.push(`${qui} : au rang ${etat.ordre.indexOf(id) + 1} de l'ordre d'ajout, attendu au rang ${rang + 1}.`);
    for (const [champ, nom] of NOMBRES_COMPARES) {
      if (dit(attendu[champ])) comparer(nom, courant[champ], attendu[champ]);
    }

    if (attendu.mort !== undefined) {
      const sort = (mort) => (mort === null ? "vivant" : `mort${dit(mort.tour) ? ` au tour ${mort.tour}` : ""}`);
      const memeSort = (courant.mort === null) === (attendu.mort === null) && (attendu.mort === null || !dit(attendu.mort.tour) || attendu.mort.tour === courant.mort.tour);
      if (!memeSort) ecarts.push(`${qui} : ${sort(courant.mort)}, attendu ${sort(attendu.mort)}.`);
    }

    if (dit(attendu.blessures)) comparer("blessures", blessuresDe(etat, id), attendu.blessures);

    if (dit(attendu.liens)) {
      comparer("jauges de lien", courant.liens.length, attendu.liens.length);
      attendu.liens.forEach((jauge, indice) => {
        const nom = photo.liens[indice]?.nom;
        if (nom !== jauge.nom) {
          ecarts.push(`${qui} : jauge de lien n° ${indice + 1} « ${nom ?? "aucune"} », attendu « ${jauge.nom} ».`);
          return;
        }
        const { points, max } = courant.liens[indice];
        if (points !== jauge.points || max !== jauge.max) ecarts.push(`${qui} : lien ${jauge.nom} ${points}/${max}, attendu ${jauge.points}/${jauge.max}.`);
      });
    }

    const dites = attendu.zones ?? [];
    const retrouvees = new Set();
    photo.zones.forEach((zone, indice) => {
      const { armure, armureMax, resistance, resistanceMax } = courant.zones[indice];
      const dite = dites.find((une) => (dit(une.code) ? une.code === zone.code : une.nom === zone.nom));
      const ou = `${qui}, ${zone.nom.toLowerCase()}`;
      if (dite === undefined) {
        if (armure !== armureMax || resistance !== resistanceMax) {
          ecarts.push(`${ou} : armure ${armure}/${armureMax}, résistance ${resistance}/${resistanceMax}, attendue intacte.`);
        }
        return;
      }
      retrouvees.add(dite);
      if (armure !== dite.armure || armureMax !== dite.armureMax) ecarts.push(`${ou} : armure ${armure}/${armureMax}, attendu ${dite.armure}/${dite.armureMax}.`);
      if (resistance !== dite.resistance || resistanceMax !== dite.resistanceMax) {
        ecarts.push(`${ou} : résistance ${resistance}/${resistanceMax}, attendu ${dite.resistance}/${dite.resistanceMax}.`);
      }
    });
    for (const dite of dites) {
      if (!retrouvees.has(dite)) ecarts.push(`${qui} : aucune zone « ${dite.code ?? dite.nom} » dans sa grille (${photo.zones.map((zone) => zone.code ?? zone.nom).join(", ")}).`);
    }
  });
  return ecarts;
}

const ecrireUnDe = (de) => (de === null ? "aucun" : `d${de.faces}${de.combien > 1 ? `, ${de.combien} valeurs` : ""}, ${de.motif}, place ${de.place}`);
const ecrireUneChaine = (des) => des.map(({ somme, reussi }) => `${somme} ${reussi ? "✓" : "✗"}`).join(", ") || "aucun dé";

/**
 * Les écarts d'un combat arrêté en cours de route avec ce qu'on attend de ce
 * moment. Rend une liste de phrases, vide quand tout y est.
 *
 * arret : ce qu'on attend, chaque champ facultatif :
 * - lignes : le nombre de lignes déjà écrites ; elles sont les premières de
 *   journalAttendu, mot pour mot ;
 * - cible : le nom court de la cible du geste en cours (null : aucune) ;
 * - chaine : les dés déjà lancés du jet en cours, un par place, tels qu'ils
 *   comptent : [{ somme, reussi }], modificateurs compris ;
 * - de : le dé que le combat attend, { faces, combien, motif, place }, ou
 *   null s'il n'en attend pas ;
 * - etatAttendu : l'état de ce moment, comme pour ecartsDeLEtat.
 */
export function ecartsDeLArret(etat, arret, journalAttendu) {
  const ecarts = [];
  const geste = gesteEnCours(etat);
  if (dit(arret.lignes)) {
    ecarts.push(
      ...ecartsDuJournal(
        etat.journal.map((ligne) => ligne.texte),
        journalAttendu.slice(0, arret.lignes),
      ),
    );
  }
  if (arret.cible !== undefined) {
    const cible = dit(geste?.cible) ? etat.noms[geste.cible].court : null;
    if (cible !== arret.cible) ecarts.push(`La cible du geste en cours : ${cible ?? "aucune"}, attendu ${arret.cible ?? "aucune"}.`);
  }
  if (arret.chaine !== undefined) {
    const lances = (geste?.jet?.places ?? []).map((place) => evaluerEssai(geste.jet, place.essais.at(-1)));
    if (ecrireUneChaine(lances) !== ecrireUneChaine(arret.chaine)) ecarts.push(`Les dés du jet en cours : ${ecrireUneChaine(lances)}, attendu ${ecrireUneChaine(arret.chaine)}.`);
  }
  if (arret.de !== undefined) {
    const aLancer = offre(etat).de;
    if (ecrireUnDe(aLancer) !== ecrireUnDe(arret.de)) ecarts.push(`Le dé à lancer : ${ecrireUnDe(aLancer)}, attendu ${ecrireUnDe(arret.de)}.`);
  }
  if (dit(arret.etatAttendu)) ecarts.push(...ecartsDeLEtat(etat, arret.etatAttendu));
  return ecarts;
}

// ─── L'affichage ────────────────────────────────────────────────────────────

const dire = (...lignes) => console.log(lignes.join("\n"));
const titre = (texte) => dire("", texte);
const milliers = (nombre) => String(nombre).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const accorder = (nombre, un, plusieurs) => `${nombre} ${nombre > 1 ? plusieurs : un}`;

function tableau(lignes) {
  const largeurs = lignes[0].map((_, colonne) => Math.max(...lignes.map((ligne) => String(ligne[colonne]).length)));
  for (const ligne of lignes) dire(`  ${ligne.map((cellule, colonne) => String(cellule).padEnd(largeurs[colonne])).join("   ").trimEnd()}`);
}

// Les valeurs de départ d'un protagoniste, telles que le classeur les donne
// aujourd'hui : c'est par elles qu'un écart s'explique (une armure, un dé ou
// des dégâts qui ne sont plus ceux du jour où le scénario a été écrit).
function ecrireDepart({ camp, valeurs, avertissements }) {
  const arme = ({ libelle, poids, faces, degats, portee, locMultiple }) =>
    [libelle, poids, faces === null ? null : `d${faces}`, degats === null ? "sans dégâts lisibles" : degats.join("/"), `portée ${portee}`, locMultiple > 1 ? `${locMultiple} d20` : null].filter(Boolean).join(", ");
  const jet =
    camp === "pj"
      ? `défense d${valeurs.deDefense.faces} (${valeurs.deDefense.type}${valeurs.deDefense.meles ? ", types mêlés" : ""})`
      : `attaque ${valeurs.attaque}, défense ${valeurs.defense}`;
  const cables = valeurs.passifs.map(({ role, niveau }) => `${role} [${niveau}]${niveau === 0 ? " (niveau 0 : sans effet)" : ""}`);
  const roles = valeurs.capacites.filter((capacite) => capacite.role !== null && !valeurs.passifs.some((passif) => valeurs.capacites[passif.capacite] === capacite));
  return [
    `  ${valeurs.nom} — ${accorder(valeurs.actions, "action", "actions")}, souffle ${valeurs.souffleAbsent ? "absent" : valeurs.souffle}, corps ${valeurs.corps} ; ${jet}`,
    `      armes : ${valeurs.armes.map(arme).join(" · ") || "aucune"}`,
    `      zones, dans l'ordre du d20 : ${valeurs.zones.map((zone) => `${zone.nom.toLowerCase()} ${zone.armure}`).join(", ")} ; face de contre-attaque : ${valeurs.faceContre}`,
    `      passifs câblés : ${cables.join(", ") || "aucun"} ; autres rôles : ${roles.map((capacite) => `${capacite.role} [${capacite.niveau}]`).join(", ") || "aucun"}`,
    ...avertissements.map((avertissement) => `      avertissement : ${avertissement}`),
  ];
}

function ecrireEtat(etat) {
  const lignes = [["protagoniste", "case", "actions", "souffle", "corps", "zones touchées"]];
  for (const id of etat.ordre) {
    const courant = etat.protagonistes[id];
    const touchees = etat.photos[id].zones
      .map((zone, indice) => ({ nom: zone.nom.toLowerCase(), ...courant.zones[indice] }))
      .filter((zone) => zone.armure !== zone.armureMax || zone.resistance !== zone.resistanceMax)
      .map((zone) => `${zone.nom} : armure ${zone.armure}/${zone.armureMax}${zone.resistance !== zone.resistanceMax ? `, résistance ${zone.resistance}/${zone.resistanceMax}` : ""}`);
    lignes.push([
      etat.noms[id].court,
      courant.case,
      courant.mort === null ? `${courant.actions}/${courant.actionsMax}` : `mort (tour ${courant.mort.tour})`,
      `${courant.souffle}/${courant.souffleMax}`,
      courant.corps,
      touchees.join(" ; ") || "—",
    ]);
  }
  tableau(lignes);
}

// ─── Le banc ────────────────────────────────────────────────────────────────

function lireScenario(chemin) {
  const scenario = JSON.parse(readFileSync(chemin, "utf8"));
  for (const champ of ["ajouts", "gestes", "journalAttendu", "etatAttendu"]) {
    if (!Array.isArray(scenario[champ])) throw new Error(`le champ « ${champ} » manque, ou n'est pas une liste.`);
  }
  if (scenario.mode !== "reel" && scenario.mode !== "demo") throw new Error("le champ « mode » vaut « reel » ou « demo ».");
  return scenario;
}

// Les photographies des ajouts du scénario, par nom entier. Un personnage
// passe par accepter(), comme tout personnage lu d'un fichier.
function photographierLesAjouts(scenario, monde) {
  const photos = {};
  const refus = [];
  for (const [genre, nom] of scenario.ajouts) {
    let rendu;
    if (genre === "pj") {
      const personnage = (scenario.personnages ?? []).find((un) => un?.identite?.nom === nom);
      if (!personnage) rendu = { refus: "le scénario ne porte pas ce personnage (champ « personnages »)." };
      else {
        try {
          rendu = photographierPersonnage(monde.banque, accepter(structuredClone(personnage)), { index: monde.index, roles: monde.roles });
        } catch (echec) {
          rendu = { refus: `le personnage n'est pas accepté : ${echec.message}` };
        }
      }
    } else {
      rendu = photographierAdversaire(monde.adversaires, nom, { banque: monde.banque, roles: monde.roles });
    }
    if (rendu.refus) refus.push(`  ${nom} : ${rendu.refus}`);
    else photos[nom] = rendu.photo;
  }
  return { photos, refus };
}

// Chaque adversaire complet du classeur se photographie : c'est validerPhoto
// qui juge, la fonction même qui relira un combat gardé. Un adversaire
// incomplet ne s'ajoute pas à un combat : il se compte, sans plus.
function photographierToutLeClasseur(monde) {
  let complets = 0;
  const incomplets = [];
  const refus = [];
  for (const [nom, ligne] of monde.adversaires.adversaires) {
    if (!monde.adversaires.resoudre(ligne).complet) {
      incomplets.push(nom);
      continue;
    }
    complets += 1;
    const rendu = photographierAdversaire(monde.adversaires, nom, { banque: monde.banque, roles: monde.roles });
    if (rendu.refus) refus.push(`  ${nom} : ${rendu.refus}`);
  }
  return { complets, incomplets, refus };
}

// Joue le scénario. S'il ne se joue pas jusqu'au bout, rend aussi le combat
// arrêté avant le geste qui échoue : son journal dit jusqu'où tout allait.
function jouer(scenario, photos) {
  try {
    return versContenu(scenario, photos);
  } catch (echec) {
    for (let gestes = scenario.gestes.length - 1; gestes >= 0; gestes -= 1) {
      try {
        return { ...versContenu(scenario, photos, { jusqua: gestes }), echec: echec.message, gestes };
      } catch {
        // Ce geste-là ne se joue pas non plus : on recule encore.
      }
    }
    return { echec: echec.message, gestes: 0, etat: null, contenu: null };
  }
}

// Le combat tel qu'il serait gardé : passé par JSON, jugé par validerContenu,
// puis rejoué. Rend une phrase.
function relire(contenu, etat, mode) {
  const texte = JSON.stringify(contenu);
  const taille = `${milliers(Math.ceil(new TextEncoder().encode(texte).length / 1024))} Ko`;
  const lu = validerContenu(JSON.parse(texte), { mode, revision: contenu.revision, accepter });
  if (lu.erreur) return `ÉCART : le combat gardé (${taille}) serait refusé à la relecture : ${lu.erreur}`;
  if (lu.autreVersion) return `ÉCART : le combat gardé (${taille}) se dirait d'une autre version des règles.`;
  const rejoue = rejouer(lu.contenu);
  if (rejoue.erreur) return `ÉCART : le combat gardé (${taille}) ne se rejoue pas, à l'événement n° ${rejoue.erreur.pas} : ${rejoue.erreur.message}`;
  if (JSON.stringify(rejoue.etat) !== JSON.stringify(etat)) return `ÉCART : le combat gardé (${taille}) se rejoue, mais ne retrouve pas l'état du combat joué.`;
  return `Le combat gardé (${accorder(contenu.evenements.length, "événement", "événements")}, ${taille}) se relit et se rejoue à l'identique.`;
}

async function banc([cheminClasseur, cheminScenario]) {
  if (!cheminClasseur || !cheminScenario) {
    console.error("Usage : node tests/banc_combat_reel.js chemin/vers/regles_jdr.xlsx chemin/vers/scenario.json");
    return 2;
  }
  let octets;
  let scenario;
  try {
    octets = readFileSync(cheminClasseur);
    scenario = lireScenario(cheminScenario);
  } catch (echec) {
    dire(`Lecture impossible : ${echec.message}`);
    return 1;
  }
  dire(`Banc du combat — ${basename(cheminClasseur)}, ${milliers(octets.length)} octets ; scénario ${basename(cheminScenario)}, mode « ${scenario.mode} »`);

  const { banque, anomalies, erreur } = await importerFichier(octets, basename(cheminClasseur));
  if (erreur || !banque) {
    dire(`Import impossible : ${erreur ?? (anomalies ?? []).map((anomalie) => anomalie.message).join(" ")}`);
    return 1;
  }
  const index = indexerCreation(banque);
  const monde = { banque, index, roles: await tableDesRoles(banque, scenario.mode), adversaires: indexerAdversaires(banque, index) };
  const ecarts = [];

  titre("1. Les rôles câblés");
  const absents = ecrireAbsents(monde.roles.absents);
  dire(`  ${accorder(monde.roles.parCle.size, "nom de la banque porte un rôle câblé", "noms de la banque portent un rôle câblé")}.`);
  if (absents === null) dire("  Câblés absents de la banque : aucun. La ligne est vide.");
  else {
    dire(`  ${absents}`, "  ÉCART : cette ligne doit être vide. Un nom a changé dans le classeur, ou l'empreinte d'un rôle n'est plus la sienne.");
    ecarts.push(absents);
  }

  titre("2. Les protagonistes du scénario, tels que le classeur les donne");
  const { photos, refus } = photographierLesAjouts(scenario, monde);
  for (const photo of Object.values(photos)) dire(...ecrireDepart(photo));
  if (refus.length) dire("  Ne se photographient pas :", ...refus);

  titre("3. Tous les adversaires complets du classeur");
  const tous = photographierToutLeClasseur(monde);
  dire(
    `  ${accorder(tous.complets, "adversaire complet", "adversaires complets")}, ${tous.complets - tous.refus.length} photographié(s) ; ` +
      `${accorder(tous.incomplets.length, "incomplet, qui ne s'ajoute pas à un combat", "incomplets, qui ne s'ajoutent pas à un combat")}${tous.incomplets.length ? ` (${tous.incomplets.join(", ")})` : ""}.`,
  );
  if (tous.refus.length) {
    dire("  ÉCART : des adversaires complets ne se photographient pas :", ...tous.refus);
    ecarts.push(...tous.refus);
  }

  titre("4. Le combat");
  if (refus.length) {
    dire("  Le combat ne se joue pas : il lui manque une photographie.");
    return 1;
  }
  const joue = jouer(scenario, photos);
  const lignes = joue.etat ? joue.etat.journal.map((ligne) => ligne.texte) : [];
  const attendues = joue.echec === undefined ? scenario.journalAttendu : scenario.journalAttendu.slice(0, lignes.length);
  lignes.forEach((ligne, rang) => dire(`  ${String(rang + 1).padStart(3)} ${ligne === scenario.journalAttendu[rang] ? "=" : "≠"} ${ligne}`));
  const duJournal = ecartsDuJournal(lignes, attendues);
  if (joue.echec !== undefined) {
    dire("", `  Le combat ne se joue pas jusqu'au bout : ${accorder(joue.gestes, "geste joué", "gestes joués")} sur ${scenario.gestes.length}.`, `  ${joue.echec}`);
    if (duJournal.length) dire("", `  Jusque-là, ${accorder(duJournal.length, "ligne s'écarte", "lignes s'écartent")} du journal attendu :`, ...duJournal.map((ecart) => `  ${ecart}`));
    return 1;
  }

  titre("5. Le journal, comparé à celui du scénario");
  dire(`  ${accorder(lignes.length, "ligne", "lignes")}, ${scenario.journalAttendu.length} attendue(s) : ${duJournal.length ? accorder(duJournal.length, "écart", "écarts") : "aucun écart, mot pour mot"}.`);
  if (duJournal.length) dire(...duJournal.map((ecart) => `  ${ecart}`));
  ecarts.push(...duJournal);

  titre("6. L'état final, comparé à celui du scénario");
  ecrireEtat(joue.etat);
  const deLEtat = ecartsDeLEtat(joue.etat, scenario.etatAttendu);
  dire(`  ${deLEtat.length ? accorder(deLEtat.length, "écart", "écarts") : "Aucun écart"}${deLEtat.length ? " :" : "."}`);
  if (deLEtat.length) dire(...deLEtat.map((ecart) => `    ${ecart}`));
  ecarts.push(...deLEtat);

  titre("7. Le combat gardé");
  const relu = relire(joue.contenu, joue.etat, scenario.mode);
  dire(`  ${relu}`);
  if (relu.startsWith("ÉCART")) ecarts.push(relu);

  const arrets = Array.isArray(scenario.arrets) ? scenario.arrets : [];
  if (arrets.length) titre("8. Le combat, arrêté aux moments que dit le scénario");
  for (const arret of arrets) {
    let arrete;
    try {
      arrete = versContenu(scenario, photos, { jusqua: arret.jusqua }).etat;
    } catch (echec) {
      dire(`  ${arret.nom} : ÉCART, le combat ne s'y arrête pas. ${echec.message}`);
      ecarts.push(echec.message);
      continue;
    }
    const duMoment = ecartsDeLArret(arrete, arret, scenario.journalAttendu);
    dire(`  ${arret.nom} : ${duMoment.length ? `${accorder(duMoment.length, "écart", "écarts")}.` : "aucun écart."}`);
    dire(`  Dé à lancer : ${ecrireUnDe(offre(arrete).de)} ; ${accorder(arrete.journal.length, "ligne", "lignes")} au journal.`);
    ecrireEtat(arrete);
    if (duMoment.length) dire(...duMoment.map((ecart) => `    ${ecart}`));
    ecarts.push(...duMoment);
  }

  titre(
    ecarts.length
      ? `Bilan : ${accorder(ecarts.length, "écart", "écarts")}. Un écart n'est pas un échec : le classeur a pu changer depuis que le scénario a été écrit. Chacun est à expliquer, d'après les valeurs de départ du point 2 ; rien n'est à corriger dans les données.`
      : "Bilan : le banc retrouve le scénario, sans écart.",
  );
  return 0;
}

// Le banc ne se lance que demandé par son nom : importé par un contrôle, ce
// fichier ne donne que ses comparaisons.
function lanceParSonNom() {
  if (!process.argv[1]) return false;
  const ici = fileURLToPath(import.meta.url);
  const lance = resolve(process.argv[1]);
  return process.platform === "win32" ? ici.toLowerCase() === lance.toLowerCase() : ici === lance;
}

if (lanceParSonNom()) process.exitCode = await banc(process.argv.slice(2));
