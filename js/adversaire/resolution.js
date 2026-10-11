// La résolution d'un adversaire (SPECIFICATION.md, § 16).
//
// La banque garde les lignes de la feuille « Adversaires » telles qu'écrites
// (§ 5.1) : des types, et des adversaires qui en héritent. Ce module en tire
// l'adversaire tel qu'il se joue. Il est le seul à le faire : l'import s'en
// sert pour le contrôle (js/adversaire/controle.js), la page pour
// l'affichage. Les deux lisent donc toujours la même chose.
//
// Les règles sont des décisions de l'auteur du 11/10/2026, que le livret ne
// dit pas encore (§ 12) : sa section « Caractéristiques d'un adversaire »
// tient en une phrase. Chacune vaut pour les seuls adversaires ; celles des
// personnages restent dans js/personnage/. Ce qui est partagé avec eux, le
// coût et la description d'une capacité, la qualité, les fractions exactes,
// vient de leur code, pas d'une copie.
//
// La résolution est une fonction pure, et ne lève pas d'exception sur une
// donnée inattendue : elle la signale dans ses constats. Un constat porte le
// code du § 6.3 quand il en a un, et la ligne de la feuille où il se corrige.

import { cle, repertoire } from "../banque/noms.js";
import { parametresInvoques } from "../banque/notation.js";
import { typeDe } from "../banque/types.js";
import { contexte, coutA, decrire, evolution, indexerCreation, varianteA } from "../personnage/calcul.js";
import { entierInferieur, evaluer, fraction, lireNombre } from "../personnage/expressions.js";
import { CORPS, ELEMENTS, PARAMETRES, RESISTANCE_PAR_ZONE, TYPES_OBJET, ZONES } from "../personnage/regles.js";
import { citer, lireListe, lireLocalisation, lireNombreCellule, lireTypes, texteDe } from "./notation.js";

export const FEUILLE = "Adversaires";

// La qualité d'un objet sans crochets (décision de l'auteur, 11/10/2026).
export const QUALITE_DEFAUT = 2;
// Les quatre nombres d'un adversaire, que le multiplicateur multiplie.
export const NOMBRES = ["actions", "souffle", "attaque", "defense"];
const NOMS_DES_NOMBRES = { actions: "le nombre d'actions", souffle: "le souffle", attaque: "l'attaque", defense: "la défense" };

// Les trois packs d'armure : toutes les pièces de type Armure qui portent
// l'élément, avec la qualité du pack.
export const PACKS = { lourde: "Armure lourde", agile: "Armure agile", precise: "Armure précise" };

// À défaut de l'élément « Maîtrise » (convention du § 15.2), ces trois
// capacités sont les maîtrises. Une maîtrise s'associe à l'élément Lourde,
// Agile ou Précise dont son nom porte le mot.
const MAITRISES_PAR_DEFAUT = ["Maîtrise du combat lourd", "Maîtrise du combat agile", "Maîtrise du combat précis"];
const MOT_DE_MAITRISE = { lourde: "lourd", agile: "agile", precise: "precis" };

const fois = (a, b) => fraction(a.n * b.n, a.d * b.d);
const plus = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const ZERO = fraction(0);

// Le bloc porte l'élément, sans cible : il vaut pour tout le bloc.
const porte = (bloc, element) => bloc.elements.some((e) => e.nom && !e.cible && cle(e.nom) === cle(element));

// Un nom, ses blancs réduits comme la notation réduit ceux d'une cellule.
const blancs = (nom) => texteDe(nom).replace(/\s+/gu, " ").trim();
// « a », « a et b », « a, b et c ».
const enumerer = (noms) => (noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}` : (noms[0] ?? ""));

/**
 * Les entrées d'une liste de la banque qui en sont : des objets qui portent
 * un nom en chaîne. Une banque abîmée (une liste qui n'en est pas une, une
 * entrée nulle) ne fait pas lever la lecture : ce qui ne se lit pas n'y
 * entre pas.
 */
export function entreesLisibles(liste) {
  return Array.isArray(liste) ? liste.filter((entree) => entree !== null && typeof entree === "object" && typeof entree.nom === "string") : [];
}

const premierParNom = (liste) => {
  const table = new Map();
  for (const entree of entreesLisibles(liste)) if (!table.has(entree.nom)) table.set(entree.nom, entree);
  return table;
};

/** Vrai quand la banque a été publiée avant la feuille « Adversaires » (lot 3). */
export function banqueSansAdversaires(banque) {
  return !Array.isArray(banque.adversaires) || !Array.isArray(banque.types_adversaires);
}

/**
 * Une qualité écrite pour le lecteur : l'entier, ou deux décimales au plus,
 * à la virgule (« 2,8 », « 2,67 »). Le calcul, lui, garde la fraction.
 */
export function ecrireQualite(q) {
  const centiemes = Math.floor((2 * q.n * 100 + q.d) / (2 * q.d));
  const entier = Math.floor(centiemes / 100);
  const reste = String(centiemes % 100).padStart(2, "0").replace(/0+$/, "");
  return reste ? `${entier},${reste}` : String(entier);
}

/** La maîtrise qu'est une capacité : { type } (type : lourde, agile, precise, ou null), ou null. */
export function maitriseDe(capacite) {
  const parElement = capacite.variantes.some((v) => v.elements.some((e) => e.nom && cle(e.nom) === cle(ELEMENTS.maitrise)));
  const parNom = MAITRISES_PAR_DEFAUT.some((nom) => cle(nom) === cle(capacite.nom));
  if (!parElement && !parNom) return null;
  const types = Object.keys(TYPES_OBJET).filter((code) => cle(capacite.nom).includes(MOT_DE_MAITRISE[code]));
  return { type: types.length === 1 ? types[0] : null };
}

// Les valeurs d'armure d'un bloc, en fractions : { ecrit, valeurs } ou
// { ecrit, erreur } ; null sans paramètre armure. La barre sépare les
// valeurs : une seule, six, ou autant que l'adversaire a de zones.
function armureDuBloc(bloc) {
  const parametre = bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.armure);
  if (!parametre) return null;
  const valeurs = [];
  for (const morceau of parametre.valeur.split("/")) {
    const lu = evaluer(morceau);
    if (!lu.valeur) return { ecrit: parametre.valeur, erreur: true };
    valeurs.push(lu.valeur);
  }
  return { ecrit: parametre.valeur, valeurs };
}

/**
 * Un index des adversaires d'une banque : { types, adversaires, type(nom),
 * adversaire(nom), analyser(entree, genre), resoudre(adversaire),
 * utilisateurs(nomType) }. index : celui du créateur (noms résolus comme au
 * contrôle, § 6.3), refait si on ne le donne pas.
 */
export function indexerAdversaires(banque, index = indexerCreation(banque)) {
  const types = premierParNom(banque.types_adversaires);
  const adversaires = premierParNom(banque.adversaires);
  const repertoireTypes = repertoire(types.keys());

  // Les pièces de chaque pack, dans l'ordre de la feuille Blocs ; un doublon
  // (E3) n'y compte qu'une fois, comme dans le créateur.
  const blocs = [...premierParNom(banque.blocs).values()];
  const blocsExacts = new Set(blocs.map((bloc) => bloc.nom));
  const packs = new Map(
    Object.entries(PACKS).map(([type, nom]) => [cle(nom), { type, nom, pieces: blocs.filter((bloc) => typeDe(bloc) === "armure" && porte(bloc, TYPES_OBJET[type].element)) }]),
  );
  // Les capacités de même clé, pour dire un renvoi ambigu.
  const capacitesParCle = new Map();
  for (const nom of new Set(banque.capacites.map((capacite) => capacite.nom))) {
    if (!capacitesParCle.has(cle(nom))) capacitesParCle.set(cle(nom), []);
    capacitesParCle.get(cle(nom)).push(nom);
  }

  const analyses = new Map();

  /**
   * Lit les cellules d'une ligne, type ou adversaire, et résout ses renvois.
   * Rend { lue, constats } ; les constats sont ceux de cette ligne seule
   * (E6, E8, E9, E10, E11, E13, E14, A1, A11, A13, A14). Une ligne ne se lit
   * qu'une fois : ses constats ne se répètent pas d'un adversaire à l'autre.
   */
  function analyser(entree, genre) {
    if (analyses.has(entree)) return analyses.get(entree);
    const sujet = genre === "type" ? `Le type « ${citer(entree.nom)} »` : `L'adversaire « ${citer(entree.nom)} »`;
    const ligne = entree.brut?.ligne ?? null;
    const constats = [];
    const signaler = (code, message) => constats.push({ code, ligne, message });
    const ambigu = (trouve) => (trouve.candidats?.length > 1 ? ` (renvoi ambigu : ${trouve.candidats.map((n) => `« ${citer(n)} »`).join(", ")})` : "");
    // Un renvoi retrouvé sans casse ni accents est résolu, et signalé (A1).
    // Les blancs ne comptent pas : la notation les réduit en lisant la
    // cellule, et un nom à double espace, écrit de même des deux côtés, n'a
    // rien d'approché.
    const approche = (ecrit, trouve, quoi) => {
      if (blancs(trouve) !== ecrit) signaler("A1", `${sujet} cite « ${citer(ecrit)} » pour ${quoi} « ${citer(trouve)} » : seules la casse, les accents ou les espaces diffèrent.`);
    };

    // La colonne Type d'un adversaire ; un type n'hérite de rien. Le nom
    // d'un type ne peut porter ni « / » ni crochets : nul ne pourrait le citer.
    if (genre === "type" && /[/[\]]/.test(entree.nom)) {
      signaler("E9", `${sujet} porte « / » ou un crochet dans son nom : la colonne Type d'un adversaire ne pourrait pas le citer.`);
    }
    const typesLus = genre === "adversaire" ? lireTypes(entree.types) : { types: [], multiplicateur: null };
    if (typesLus.defaut) signaler("E9", `${sujet} : la colonne Type, « ${citer(texteDe(entree.types).trim())} », ne se lit pas : ${typesLus.defaut}.`);
    const typesCites = typesLus.types.map((nom) => {
      const trouve = repertoireTypes.resoudre(nom);
      if (trouve.nom) approche(nom, trouve.nom, "le type");
      else signaler("E8", `${sujet} cite le type « ${citer(nom)} », introuvable parmi les types de la feuille ${FEUILLE}${ambigu(trouve)}.`);
      return { ecrit: nom, entree: trouve.nom ? types.get(trouve.nom) : null };
    });

    const localisation = lireLocalisation(entree.localisation);
    if (localisation.genre === "zones") {
      if (localisation.defauts.length) signaler("E10", `${sujet} : localisation invalide : ${localisation.defauts.join(" ; ")}.`);
      for (const zone of localisation.zones.filter((z) => z.approchee)) {
        signaler("A11", `${sujet} : la zone « ${citer(zone.nom)} » est reconnue par approximation comme « ${ZONES.find((z) => z.code === zone.code).nom} ».`);
      }
    }

    const nombres = {};
    for (const champ of NOMBRES) {
      nombres[champ] = lireNombreCellule(entree[champ]);
      if (nombres[champ].genre === "illisible") signaler("E14", `${sujet} : ${NOMS_DES_NOMBRES[champ]}, « ${citer(nombres[champ].ecrit)} », n'est pas un nombre lisible.`);
    }

    const listeLue = (texte, colonne) => {
      const lue = lireListe(texte);
      for (const defaut of lue.defauts ?? []) signaler("E6", `${sujet}, colonne « ${colonne} » : ${defaut}.`);
      return lue;
    };

    // L'équipement : des blocs, ou l'un des trois packs d'armure.
    const equipement = listeLue(entree.equipement, "Equipement");
    if (equipement.genre === "liste") {
      equipement.objets = equipement.entrees.map(({ nom, crochet }) => {
        const bloc = blocsExacts.has(nom) ? index.bloc(nom) : null;
        const pack = bloc ? null : packs.get(cle(nom));
        const trouve = bloc ?? (pack?.pieces.length ? null : index.bloc(nom));
        // Sans crochets, la qualité que le classeur fixe au bloc, sinon 2.
        const fixee = trouve?.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.qualite);
        const defaut = (fixee ? lireNombre(fixee.valeur) : null) ?? fraction(QUALITE_DEFAUT);
        let qualite = null;
        if (crochet !== null) {
          qualite = lireNombre(crochet);
          if (!qualite) signaler("E14", `${sujet} : la qualité de « ${citer(nom)} », « ${citer(crochet)} », n'est pas un nombre lisible ; elle vaut ${ecrireQualite(defaut)}.`);
        }
        const commun = { ecrit: nom, qualite: qualite ?? defaut, qualiteEcrite: qualite !== null };
        if (!bloc && pack?.pieces.length) return { ...commun, nom: pack.nom, genre: "pack", pack };
        if (!trouve) {
          if (pack) signaler("E11", `${sujet} cite le pack « ${pack.nom} », mais aucun bloc de type Armure ne porte l'élément ${TYPES_OBJET[pack.type].element}.`);
          else signaler("E11", `${sujet} cite l'objet « ${citer(nom)} », introuvable : ni un bloc, ni un pack d'armure (${Object.values(PACKS).join(", ")}).`);
          return { ...commun, nom, genre: "absent" };
        }
        approche(nom, trouve.nom, "le bloc");
        return { ...commun, nom: trouve.nom, genre: "bloc", bloc: trouve };
      });
    }

    // Les capacités : des noms de la feuille Capacites, et leur rang.
    const capacites = listeLue(entree.capacites, "Capacités");
    if (capacites.genre === "liste") {
      capacites.citees = capacites.entrees.map(({ nom, crochet }) => {
        const capacite = index.capacite(nom);
        if (!capacite) {
          const candidats = capacitesParCle.get(cle(nom)) ?? [];
          signaler("E13", `${sujet} cite la capacité « ${citer(nom)} », introuvable dans Capacites${ambigu({ candidats })}.`);
          return { ecrit: nom, nom, capacite: null, rang: null };
        }
        approche(nom, capacite.nom, "la capacité");
        const evo = evolution(capacite);
        const cite = citer(capacite.nom);
        let rang = null;
        if (crochet !== null) {
          const lu = lireNombre(crochet);
          if (!lu || lu.d !== 1) {
            signaler("E14", `${sujet} : le rang de « ${cite} », « ${citer(crochet)} », n'est pas un entier lisible ; il vaut ${evo.niveauCreation}.`);
          } else if (evo.niveauMax === 0) {
            if (lu.n !== 0) signaler("A14", `${sujet} donne le rang ${lu.n} à « ${cite} », qui n'évolue pas : il est ignoré.`);
          } else if (lu.n < 1) {
            signaler("E14", `${sujet} : le rang de « ${cite} », « ${citer(crochet)} », n'est pas un rang ; il vaut ${evo.niveauCreation}.`);
          } else if (lu.n > evo.niveauMax) {
            signaler("A13", `${sujet} donne le rang ${lu.n} à « ${cite} », au-delà de son maximum : il est ramené à ${evo.niveauMax}.`);
            rang = evo.niveauMax;
          } else rang = lu.n;
        }
        // Une capacité à variantes numérotées n'a pas toujours celle du rang
        // demandé (les puissances 1 et 3, sans la 2) : son coût et sa
        // description ne se liraient pas.
        const voulu = rang ?? evo.niveauCreation;
        if (!varianteA(capacite, voulu)) {
          signaler("E14", `${sujet} : « ${cite} » n'a pas de variante de puissance ${voulu} ; son coût et sa description ne se lisent pas.`);
        }
        return { ecrit: nom, nom: capacite.nom, capacite, rang };
      });
    }

    const analyse = {
      lue: {
        types: typesCites,
        multiplicateur: typesLus.multiplicateur,
        typesCasses: Boolean(typesLus.defaut) || typesCites.some((t) => !t.entree),
        localisation,
        nombres,
        equipement,
        capacites,
      },
      constats,
    };
    analyses.set(entree, analyse);
    return analyse;
  }

  // L'héritage : les types dans l'ordre (pour chaque cellule non vide, le
  // suivant l'emporte), puis le multiplicateur sur tout ce qui en vient,
  // puis la ligne de l'adversaire, sans multiplicateur.
  function heriter(propre) {
    // listes : pour chaque liste, d'où vient la dernière cellule écrite sans
    // « // », celle qui remplace tout ce qui précède. Une liste vide dit
    // ainsi qui la vide (« aucun »).
    const etat = { localisation: null, actions: null, souffle: null, attaque: null, defense: null, equipement: [], capacites: [], listes: { equipement: null, capacites: null } };
    const appliquer = (lue, type) => {
      const origine = () => ({ type, multiplie: false });
      if (lue.localisation.genre === "zones") etat.localisation = { zones: lue.localisation.zones, invalide: lue.localisation.defauts.length > 0, origine: origine() };
      for (const champ of NOMBRES) {
        const lu = lue.nombres[champ];
        if (lu.genre === "valeur") etat[champ] = { valeur: lu.valeur, origine: origine() };
        else if (lu.genre === "illisible" && !etat[champ]) etat[champ] = { valeur: null, origine: origine() };
      }
      // Une boucle, et non un étalement en arguments : une liste forgée de
      // plus de cent mille entrées ferait déborder la pile d'appels.
      if (lue.equipement.genre === "liste") {
        if (!lue.equipement.reprise) {
          etat.equipement = [];
          etat.listes.equipement = origine();
        }
        for (const objet of lue.equipement.objets) etat.equipement.push({ ...objet, origine: origine() });
      }
      if (lue.capacites.genre === "liste") {
        if (!lue.capacites.reprise) {
          etat.capacites = [];
          etat.listes.capacites = origine();
        }
        for (const citee of lue.capacites.citees) etat.capacites.push({ ...citee, origine: origine() });
      }
    };
    for (const type of propre.lue.types) if (type.entree) appliquer(analyser(type.entree, "type").lue, type.entree.nom);
    // Le multiplicateur touche les nombres et la qualité de l'équipement
    // hérité, la qualité 2 par défaut comprise ; ni les faces du d20, ni le
    // rang des capacités, ni les valeurs propres des blocs.
    const multiplicateur = propre.lue.multiplicateur;
    // Un produit qui sort des entiers sûrs ne se calcule pas : la valeur
    // héritée reste telle quelle, et la résolution le signale.
    const debordements = [];
    if (multiplicateur) {
      for (const champ of NOMBRES) {
        if (!etat[champ]?.valeur) continue;
        const produit = fois(etat[champ].valeur, multiplicateur.valeur);
        if (produit) etat[champ] = { valeur: produit, origine: { ...etat[champ].origine, multiplie: true } };
        else debordements.push(NOMS_DES_NOMBRES[champ]);
      }
      etat.equipement = etat.equipement.map((objet) => {
        const produit = fois(objet.qualite, multiplicateur.valeur);
        if (!produit) debordements.push(`la qualité de « ${citer(objet.nom)} »`);
        return produit ? { ...objet, qualite: produit, origine: { ...objet.origine, multiplie: true } } : objet;
      });
    }
    appliquer(propre.lue, null);
    return { ...etat, debordements };
  }

  /**
   * Résout un adversaire. Rend un objet simple, que les écrans affichent
   * sans rien recalculer. Les nombres sont arrondis à l'entier inférieur
   * une seule fois, ici, à la fin (livret, « Valeurs décimales »).
   */
  function resoudre(adversaire) {
    const propre = analyser(adversaire, "adversaire");
    const sujet = `L'adversaire « ${citer(adversaire.nom)} »`;
    const ligne = adversaire.brut?.ligne ?? null;
    const constatsDeResolution = [];
    const signaler = (code, message) => {
      if (!constatsDeResolution.some((c) => c.message === message)) constatsDeResolution.push({ code, ligne, message });
    };
    const etat = heriter(propre);
    const multiplicateur = propre.lue.multiplicateur;
    for (const quoi of etat.debordements) signaler("E14", `${sujet} : ${quoi} × ${multiplicateur.ecrit} sort des nombres que l'Atelier calcule ; la valeur héritée reste telle quelle.`);

    const nombre = (champ) => ({
      valeur: etat[champ]?.valeur ? entierInferieur(etat[champ].valeur) : null,
      origine: etat[champ]?.origine ?? null,
    });

    // L'équipement, les packs dépliés en leurs pièces.
    const equipement = etat.equipement.map((objet) => ({
      nom: objet.nom,
      ecrit: objet.ecrit,
      genre: objet.genre,
      qualite: ecrireQualite(objet.qualite),
      pieces: objet.genre === "pack" ? objet.pack.pieces.map((bloc) => bloc.nom) : null,
      origine: objet.origine,
    }));
    const pieces = etat.equipement.flatMap((objet) => {
      if (objet.genre === "bloc") return [{ bloc: objet.bloc, qualite: objet.qualite }];
      if (objet.genre === "pack") return objet.pack.pieces.map((bloc) => ({ bloc, qualite: objet.qualite }));
      return [];
    });

    // L'armure, zone par zone, qualité comprise : une pièce à une valeur est
    // globale, et les autres s'y ajoutent ; sur une zone, la dernière pièce
    // non globale l'emporte ; une valeur nulle ne couvre rien.
    const zonesLues = etat.localisation && !etat.localisation.invalide ? etat.localisation.zones : [];
    const debordement = (quoi) => signaler("E14", `${sujet} : ${quoi} sort des nombres que l'Atelier calcule.`);
    let globale = ZERO;
    const posees = zonesLues.map(() => null);
    const apports = zonesLues.map(() => []);
    for (const piece of zonesLues.length ? pieces : []) {
      const armure = armureDuBloc(piece.bloc);
      if (!armure) continue;
      const nomPiece = citer(piece.bloc.nom);
      if (armure.erreur) {
        signaler("E14", `${sujet} porte « ${nomPiece} », dont l'armure, « ${citer(armure.ecrit)} », ne se calcule pas.`);
        continue;
      }
      const facteur = fraction(piece.qualite.n + piece.qualite.d, 3 * piece.qualite.d);
      const valeurs = armure.valeurs.map((valeur) => (facteur ? fois(valeur, facteur) : null));
      if (valeurs.some((valeur) => !valeur)) {
        debordement(`l'armure de « ${nomPiece} », à la qualité ${ecrireQualite(piece.qualite)},`);
        continue;
      }
      const dit = `${piece.bloc.nom} [${ecrireQualite(piece.qualite)}]`;
      if (valeurs.length === 1) {
        const somme = plus(globale, valeurs[0]);
        if (!somme) {
          debordement(`la somme des armures, avec « ${nomPiece} »,`);
          continue;
        }
        globale = somme;
        apports.forEach((liste) => liste.push({ piece: dit, globale: true }));
        continue;
      }
      let places = null;
      if (valeurs.length === ZONES.length) {
        // Six valeurs : sur les zones nommées comme celles des personnages.
        // Une valeur dont la zone manque ne se pose nulle part : c'est dit
        // (A12). Si l'adversaire a justement six zones, la pièce a « autant
        // de valeurs que de zones », et se pose alors dans l'ordre du d20.
        const perdues = ZONES.filter((zone, k) => valeurs[k].n > 0 && !zonesLues.some((z) => z.code === zone.code)).map((zone) => zone.nom.toLowerCase());
        const sans = `${sujet} porte « ${nomPiece} », une armure à six valeurs, sans avoir ${perdues.length > 1 ? "les zones" : "la zone"} ${enumerer(perdues)}`;
        if (!perdues.length) places = zonesLues.map((zone) => (zone.code ? valeurs[ZONES.findIndex((z) => z.code === zone.code)] : null));
        else if (zonesLues.length === ZONES.length) {
          places = valeurs;
          signaler("A12", `${sans} : ses six valeurs sont posées dans l'ordre du d20.`);
        } else {
          places = zonesLues.map((zone) => (zone.code ? valeurs[ZONES.findIndex((z) => z.code === zone.code)] : null));
          signaler("A12", `${sans} : ${perdues.length > 1 ? "ces valeurs ne couvrent" : "cette valeur ne couvre"} rien.`);
        }
      } else if (valeurs.length === zonesLues.length) {
        places = valeurs;
      } else {
        signaler("E12", `${sujet} porte « ${nomPiece} », dont l'armure a ${valeurs.length} valeurs : il en faut 1, ${ZONES.length}, ou autant que ses zones (${zonesLues.length}).`);
      }
      (places ?? []).forEach((valeur, i) => {
        if (!valeur || valeur.n <= 0) return;
        posees[i] = valeur;
        apports[i] = [...apports[i].filter((a) => a.globale), { piece: dit, globale: false }];
      });
    }
    const zones = zonesLues.map((zone, i) => {
      const somme = plus(globale, posees[i] ?? ZERO);
      if (!somme) debordement(`l'armure de la zone « ${citer(zone.nom)} »`);
      return {
        nom: zone.nom,
        code: zone.code,
        approchee: zone.approchee,
        debut: zone.debut,
        fin: zone.fin,
        faces: zone.fin - zone.debut + 1,
        armure: entierInferieur(somme ?? globale),
        pieces: apports[i].map((a) => a.piece),
        resistance: RESISTANCE_PAR_ZONE,
      };
    });

    // Les capacités : celles de l'équipement d'abord, dans l'ordre de chaque
    // bloc, puis celles que citent les types et la ligne. Une capacité citée
    // et aussi donnée par l'équipement ne figure qu'une fois ; de deux rangs
    // écrits, le dernier compte.
    const possedees = new Map();
    const entreeDe = (nom, capacite) => {
      const k = cle(capacite?.nom ?? nom);
      if (!possedees.has(k)) possedees.set(k, { nom: capacite?.nom ?? nom, capacite, rangEcrit: null, sources: [], citations: [] });
      return possedees.get(k);
    };
    // Un bloc donne ses capacités simples, et l'option d'un choix
    // obligatoire qui n'en a qu'une, « ( a ) » : il n'y a rien à choisir. Un
    // autre groupe, ( a | b ) ou [ a | b ], ne donne rien : personne ne
    // choisit pour un adversaire, et l'écran le dit.
    const groupesTus = new Set();
    for (const piece of pieces) {
      piece.bloc.capacites.forEach((donnee, i) => {
        const seule = donnee.forme === "choix" && donnee.options.length === 1;
        if (donnee.forme !== "simple" && !seule) {
          if (donnee.options && !groupesTus.has(piece.bloc)) {
            groupesTus.add(piece.bloc);
            signaler(null, `${sujet} porte « ${citer(piece.bloc.nom)} », qui propose des capacités au choix : rien n'est choisi pour un adversaire, aucune n'est donnée.`);
          }
          return;
        }
        const nom = seule ? donnee.options[0] : donnee.nom;
        const entree = entreeDe(nom, index.capacite(nom));
        // Les pièces viennent l'une après l'autre : une source de la même
        // pièce ne peut être que la dernière ajoutée.
        if (entree.sources.at(-1)?.piece !== piece) entree.sources.push({ piece, position: i + 1 });
      });
    }
    for (const citee of etat.capacites) {
      const entree = entreeDe(citee.nom, citee.capacite);
      entree.rangEcrit = citee.rang;
      entree.citations.push(citee.origine);
    }

    for (const entree of possedees.values()) {
      entree.evolution = entree.capacite ? evolution(entree.capacite) : null;
      entree.rang = entree.capacite ? (entree.rangEcrit ?? entree.evolution.niveauCreation) : null;
      entree.maitrise = entree.capacite ? maitriseDe(entree.capacite) : null;
    }
    // Le rang de maîtrise de chaque type d'objet, lourde, agile, précise.
    const rangDeMaitrise = new Map();
    for (const entree of possedees.values()) {
      if (entree.maitrise?.type) rangDeMaitrise.set(entree.maitrise.type, Math.max(rangDeMaitrise.get(entree.maitrise.type) ?? 0, entree.rang));
    }

    const SANS_CARACTERISTIQUES = { caracteristiques: null };
    const capacites = [];
    const maitrises = [];
    for (const entree of possedees.values()) {
      const origines = [...entree.sources.map((s) => ({ objet: s.piece.bloc.nom })), ...entree.citations];
      if (!entree.capacite) {
        capacites.push({ nom: entree.nom, absente: true, rang: null, armes: [], degats: "", cout: null, desavantage: [], descriptions: [], origines });
        continue;
      }
      if (entree.maitrise) {
        maitrises.push({ nom: entree.nom, rang: entree.rang, type: entree.maitrise.type, origines });
        if (!entree.maitrise.type) signaler(null, `${sujet} : la maîtrise « ${citer(entree.nom)} » ne dit ni lourd, ni agile, ni précis ; elle ne lève aucun désavantage.`);
        continue;
      }
      const cout = coutA(entree.capacite, entree.rang);
      if (cout.erreur) signaler(null, `${sujet} : ${cout.erreur}.`);
      const variante = varianteA(entree.capacite, entree.rang);
      const invoqueDegats = parametresInvoques(variante?.description ?? "").some((nom) => cle(nom) === PARAMETRES.degats);
      const aVerifier = [];
      const decrite = (bloc, qualite) => {
        // L'armure d'un adversaire se calcule à part, avec ses propres
        // nombres de valeurs : elle n'entre pas dans les variables.
        const source = bloc ? { ...bloc, parametres: bloc.parametres.filter((p) => !p.nom || cle(p.nom) !== PARAMETRES.armure) } : null;
        const variables = contexte(index, SANS_CARACTERISTIQUES, source, qualite ? { q: qualite } : null, entree.capacite, entree.rang, (genre, texte) => aVerifier.push(texte));
        const texte = variante ? decrire(variante.description, variables, null, entree.rang) : { texte: "", avertissements: [] };
        for (const a of texte.avertissements) aVerifier.push(`« ${citer(entree.nom)} » : ${a}`);
        return { variables, texte: texte.texte };
      };
      const armes = [];
      const descriptions = [];
      const desavantage = [];
      // Les dégâts sont donnés par un objet, ou par un élément propre de la
      // capacité ; un objet peut aussi les transmettre sans qu'ils se
      // calculent (une qualité démesurée, une expression).
      let degatsDonnes = false;
      let degatsIllisibles = false;
      // Le désavantage (éléments Lourde, Agile, Précise du classeur) : toute
      // capacité issue d'un bloc qui porte l'un d'eux, sauf si la maîtrise
      // correspondante atteint la position de la capacité dans la liste du bloc.
      for (const { piece, position } of entree.sources) {
        const { variables, texte } = decrite(piece.bloc, piece.qualite);
        const transmis = variables.get(PARAMETRES.degats);
        const degats = transmis?.valeurs ?? null;
        const portee = variables.get(PARAMETRES.portee)?.valeurs?.[0] ?? null;
        if (degats) degatsDonnes = true;
        else if (transmis) {
          degatsIllisibles = true;
          signaler("E14", `${sujet} porte « ${citer(piece.bloc.nom)} », dont les dégâts, « ${citer(transmis.brut)} », ne se calculent pas à la qualité ${ecrireQualite(piece.qualite)}.`);
        }
        const gene = Object.keys(TYPES_OBJET).some((code) => porte(piece.bloc, TYPES_OBJET[code].element) && (rangDeMaitrise.get(code) ?? 0) < position);
        if (gene) desavantage.push(piece.bloc.nom);
        if (degats) armes.push({ nom: piece.bloc.nom, degats: degats.join("/"), portee: portee > 0 ? portee : null, desavantage: gene });
        if (!descriptions.some((d) => d.texte === texte)) descriptions.push({ source: piece.bloc.nom, texte });
      }
      if (!entree.sources.length) {
        const { variables, texte } = decrite(null, null);
        if (variables.get(PARAMETRES.degats)?.valeurs) degatsDonnes = true;
        descriptions.push({ source: null, texte });
      }
      // Une capacité d'arme sans arme : sa description invoque {degats}, et
      // ni elle-même ni rien de ce que porte l'adversaire ne les lui donne (A15).
      const sansArme = invoqueDegats && !degatsDonnes && !degatsIllisibles;
      if (sansArme) signaler("A15", `${sujet} a la capacité « ${citer(entree.nom)} », qui invoque {${PARAMETRES.degats}}, sans arme pour lui donner ses dégâts.`);
      for (const texte of aVerifier) {
        // Les dégâts manquants ou illisibles sont déjà dits, avec leur code.
        if (invoqueDegats && !degatsDonnes && (texte.includes(`{${PARAMETRES.degats}}`) || texte.includes(`paramètre ${PARAMETRES.degats} `))) continue;
        signaler(null, `${sujet} : ${texte}.`);
      }
      capacites.push({
        nom: entree.nom,
        absente: false,
        rang: entree.rang,
        evolue: entree.evolution.niveauMax > 0,
        armes,
        cout: { souffle: cout.souffle, lien: cout.lien },
        // Les blocs qui la donnent avec un désavantage ; tous : désavantage
        // sans réserve.
        desavantage,
        desavantageEntier: desavantage.length > 0 && desavantage.length === entree.sources.length,
        descriptions,
        origines,
      });
    }

    // Un adversaire incomplet (E15) : une colonne illisible ou un type
    // introuvable est déjà signalé, et ne se signale pas deux fois.
    const manques = [];
    if (!etat.localisation || (!etat.localisation.invalide && etat.localisation.zones.length === 0)) manques.push("sans localisation");
    if (!etat.attaque) manques.push("sans attaque");
    if (!etat.defense) manques.push("sans défense");
    const casse = propre.lue.typesCasses;
    if (manques.length && !casse) signaler("E15", `${sujet} est incomplet une fois l'héritage appliqué : ${manques.join(", ")}.`);
    // Complet : une grille, une attaque et une défense qui se lisent. Une
    // grille invalide ou une attaque illisible, déjà signalées, ne font pas
    // un E15 de plus, mais ne font pas non plus un adversaire complet.
    const complet = !casse && zones.length > 0 && etat.attaque?.valeur != null && etat.defense?.valeur != null;

    const heritees = propre.lue.types.filter((t) => t.entree).flatMap((t) => analyser(t.entree, "type").constats);
    return {
      nom: adversaire.nom,
      ligne,
      types: propre.lue.types.map((t) => ({ nom: t.entree?.nom ?? t.ecrit, absent: !t.entree })),
      multiplicateur: multiplicateur ? multiplicateur.ecrit : null,
      localisation: etat.localisation ? { origine: etat.localisation.origine, invalide: etat.localisation.invalide } : null,
      zones,
      corps: CORPS,
      resistance: RESISTANCE_PAR_ZONE,
      actions: nombre("actions"),
      souffle: nombre("souffle"),
      attaque: nombre("attaque"),
      defense: nombre("defense"),
      equipement,
      maitrises,
      capacites,
      // D'où vient la dernière liste écrite sans « // », ou null : ce qui
      // permet de dire qui vide une liste.
      listes: etat.listes,
      complet,
      // Les constats de la résolution elle-même se rangent à la ligne de
      // l'adversaire ; ceux de ses cellules et de celles de ses types, à
      // leur ligne. Un type cassé rend la suite incertaine : seuls les
      // constats des lignes sont alors gardés pour le contrôle.
      constatsDeResolution: casse ? [] : constatsDeResolution,
      constats: [...propre.constats, ...heritees, ...constatsDeResolution],
    };
  }

  const utilisateurs = new Map();
  for (const adversaire of adversaires.values()) {
    for (const type of analyser(adversaire, "adversaire").lue.types) {
      if (!type.entree) continue;
      if (!utilisateurs.has(type.entree.nom)) utilisateurs.set(type.entree.nom, []);
      if (!utilisateurs.get(type.entree.nom).includes(adversaire.nom)) utilisateurs.get(type.entree.nom).push(adversaire.nom);
    }
  }

  return {
    banque,
    index,
    types,
    adversaires,
    /** Le type que désigne un nom, résolu comme tout renvoi (§ 6.3), ou null. */
    type: (nom) => types.get(repertoireTypes.resoudre(String(nom ?? "")).nom) ?? null,
    analyser,
    resoudre,
    /** Les adversaires qui utilisent un type, par leur nom. */
    utilisateurs: (nomType) => utilisateurs.get(nomType) ?? [],
  };
}
