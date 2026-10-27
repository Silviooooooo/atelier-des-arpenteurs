// Les vues de la palette et du menu du MJ (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) » ; mission du lot 4.3, § 4.6 à § 4.8 et § 5 ;
// contrat de la vague 3, § 3.6, § 3.7 et D10 bis).
//
// Ce module fabrique, sans rien toucher de la page, les deux vues des outils
// du MJ : la palette (vuePalette), qui applique un effet au nom d'une source,
// et le menu du MJ d'un protagoniste (vueMenuMj). Il existe à part de
// js/combat/lecture.js, qui les réexporte, pour qu'une part de la vague 3 les
// écrive pendant qu'une autre écrit les autres vues. Il suit les règles de
// lecture.js : chaque élément actionnable porte sa commande ou son gabarit,
// avec « actif » et sa raison ; ce que le Mode MJ seul montre porte
// « mj: true » ; la vue ne lit jamais le Mode MJ, ni la page.
//
// Ce qui est actif se lit chez le juge du noyau (js/combat/effets.js) : le
// moment de chaque genre (offreDesEffets), puis, pour chaque option et chaque
// genre, l'événement complet qu'elle ferait, jugé par jugerEffet ou jugerMj,
// ceux-là mêmes que le moteur appelle. Une option active est donc un
// événement que le moteur accepte, une option inactive porte la raison de son
// refus. Une valeur que l'écran choisit (apports.choisi, apports.saisies) se
// lit d'abord par validerEvenement (js/combat/forme.js), comme le moteur le
// fait.
//
// Ce module n'importe jamais le moteur, et ne l'atteint par aucun import
// (contrat, D10 bis) : l'aperçu « Le journal écrira : … » se calcule sur
// l'état d'après que l'écran lui donne (apports.simuler, qu'il fabrique avec
// appliquer), une fois par rendu, pour la seule commande choisie. Pendant un
// geste, la phrase de l'effet (ecrireEffet), ou les phrases de la ligne en
// cours qui changent ; hors d'un geste, les lignes que le moteur a écrites ;
// pour le MJ, phrasesDuMj.
//
// Les textes que ni la mission, ni la maquette, ni le contrat ne donnent
// (les libellés des champs, des options d'un dé ou d'une ressource, le nom des
// effets en cours, la phrase d'une source autre que la capacité jouée) sont
// à faire confirmer par l'auteur.

import { localisationsDuGeste, victimeDe } from "./degats.js";
import { faconTenue, jugerEffet, jugerMj, offreDesEffets, passifDe } from "./effets.js";
import { validerEvenement } from "./forme.js";
import { deNom, ecrireBilan, ecrireDuree, ecrireEffet, ecrireLocalisation, ligneEnCours, phrasesDuMj } from "./journal.js";
import { casesEntre } from "./plateau.js";
import { BORNES_EFFET, BORNES_MJ, DUREES_EFFET, GENRES_EFFET, SIGNES } from "./regles.js";
import { campDe, capaciteDe, courantDe, defenseDe, effetsDurablesDe, faconDe, gesteEnCours, nomDeLaSource, photoDe, vivant } from "./valeurs.js";

// ─── Les mots ───────────────────────────────────────────────────────────────

const POINTS = String.fromCodePoint(0x2026);
const FOIS = String.fromCodePoint(0x00d7);
const OUVRANT = String.fromCodePoint(0x00ab);
const FERMANT = String.fromCodePoint(0x00bb);

const UN_DU_CAMP = { pj: "personnage", adv: "adversaire" };

const present = (valeur) => valeur !== null && valeur !== undefined;
const element = (liste, indice) => (Array.isArray(liste) && Number.isInteger(indice) && indice >= 0 && indice < liste.length ? liste[indice] : null);

// « 1 avantage », « 2 avantages » : le pluriel commence à deux.
const compter = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;

// « +1 », « −1 » : le moins est celui de SIGNES, jamais le trait d'union.
const signer = (nombre) => (nombre < 0 ? `${SIGNES.moins}${-nombre}` : `+${nombre}`);

// « 1er », « 2e ».
const ordinal = (place) => (place === 1 ? "1er" : `${place}e`);

// La casse du premier signe seul, sans règle propre à une langue.
function majuscule(texte) {
  const [premier = ""] = texte;
  return premier.toUpperCase() + texte.slice(premier.length);
}

function minuscule(texte) {
  const [premier = ""] = texte;
  return premier.toLowerCase() + texte.slice(premier.length);
}

// Le nom entier (« Marmiton de corvée n° 2 ») : celui des titres et des
// listes ; le nom court (« Marmiton n° 2 ») : celui du journal, que suivent
// les phrases qui le citent.
const nomEntier = (etat, id) => etat.noms?.[id]?.entier ?? photoDe(etat, id)?.nom ?? "";
const court = (etat, id) => etat.noms?.[id]?.court ?? photoDe(etat, id)?.nom ?? "";

const effetsDe = (etat) => (Array.isArray(etat?.effets) ? etat.effets : []);
const etatPorte = (etat, id) => effetsDe(etat).find((effet) => effet.genre === "etat" && effet.id === id) ?? null;
const vivantsDe = (etat) => (Array.isArray(etat?.ordre) ? etat.ordre : []).filter((id) => vivant(etat, id));

// « Étourdi », « Main brûlée », ou le nom libre d'un état, tel quel.
const nomDUnEtat = (effet) => effet?.capacite?.nom ?? effet?.libre ?? "";

// La description d'une capacité figée (un état de la banque), ou "".
const descriptionDe = (capacite) => (capacite === null ? "" : (element(capacite.facons, faconTenue(capacite))?.description ?? ""));

// Un verdict du juge (jugerEffet, jugerMj), tel que la vue le porte.
const vu = (verdict) => (verdict.ok ? { actif: true, raison: null } : { actif: false, raison: verdict.message });
const inactif = (raison) => ({ actif: false, raison });

// ─── La source ──────────────────────────────────────────────────────────────

function memeSource(a, b) {
  if (a?.genre !== b?.genre) return false;
  if (a.genre === "mj") return true;
  if (a.genre === "etat") return a.effet === b.effet;
  return a.qui === b.qui && a.capacite === b.capacite;
}

// Une source qui existe : une capacité de la photographie de « qui », un état
// porté, ou le MJ.
function sourceExiste(etat, source) {
  if (source?.genre === "mj") return true;
  if (source?.genre === "etat") return etatPorte(etat, source.effet) !== null;
  if (source?.genre === "capacite") return capaciteDe(etat, source.qui, source.capacite) !== null;
  return false;
}

// La capacité que joue le geste au sommet de la pile.
const estLaCapaciteJouee = (geste, source) => geste !== null && source.genre === "capacite" && source.qui === geste.acteur && source.capacite === geste.capacite;

// L'auteur d'un effet (mission, § 4.6) : celui qui joue le geste ; hors d'un
// geste, le porteur de l'état dont la palette porte le nom, ou celui de la
// capacité ; personne pour le MJ hors d'un geste, dont la durée se dit du camp
// qui joue.
function auteurDe(etat, geste, source) {
  if (geste !== null) return geste.acteur;
  if (source.genre === "etat") return etatPorte(etat, source.effet)?.porteur ?? null;
  if (source.genre === "capacite") return source.qui;
  return null;
}

// La capacité que nomme une source (celle d'un état porté : sa capacité
// figée), ou null.
function capaciteDeLaSource(etat, source) {
  if (source.genre === "etat") return etatPorte(etat, source.effet)?.capacite ?? null;
  if (source.genre === "capacite") return capaciteDe(etat, source.qui, source.capacite);
  return null;
}

// « Frappe — Une attaque qui inflige 3/8/20. » : la façon jouée pour la
// capacité jouée, la façon tenue pour une autre ; null sans description.
function texteDeLaSource(etat, geste, source, nom) {
  const capacite = capaciteDeLaSource(etat, source);
  if (capacite === null) return null;
  const facon = estLaCapaciteJouee(geste, source) ? faconDe(etat, geste) : element(capacite.facons, faconTenue(capacite));
  const description = facon?.description ?? "";
  return description === "" ? null : `${nom} ${SIGNES.tiret} ${description}`;
}

// L'événement qui éprouve une source, hors de tout champ : un ±N sur le
// premier vivant, de la durée que le moment permet. Son refus, s'il ne tient
// pas au moment, est celui de la source (avant le paiement, un passif qui a
// déjà servi, son prix).
function epreuveDeLaSource(contexte, source, x = null) {
  const sur = contexte.vivants[0] ?? null;
  if (sur === null) return null;
  const duree = contexte.geste?.moment === "preparation" ? "jet" : "tour";
  return { type: "effet", genre: "attaque", source, sur, n: 1, duree, ...(x === null ? {} : { x }) };
}

function jugerLaSource(contexte, source) {
  const epreuve = epreuveDeLaSource(contexte, source);
  if (epreuve === null) return { actif: true, raison: null };
  const verdict = jugerEffet(contexte.etat, epreuve);
  return verdict.ok || verdict.code === "hors_moment" ? { actif: true, raison: null } : inactif(verdict.message);
}

// Les sources au choix, en Mode MJ (mission, § 4.6) : l'état dont la palette
// porte le nom, les capacités de l'auteur et de la cible, et « MJ ». « Frappe
// (Aubépine) » : la capacité, puis le nom court de qui la porte.
function sourcesAuChoix(contexte) {
  const { etat, geste, source, auteur } = contexte;
  const porteurs = [...new Set((geste === null ? [auteur] : [geste.acteur, geste.cible]).filter((id) => present(id) && courantDe(etat, id) !== null))];
  const sources = source.genre === "etat" ? [source] : [];
  for (const qui of porteurs) (photoDe(etat, qui)?.capacites ?? []).forEach((capacite, indice) => sources.push({ genre: "capacite", qui, capacite: indice }));
  if (!sources.some((une) => memeSource(une, source)) && source.genre !== "mj") sources.unshift(source);
  sources.push({ genre: "mj" });
  return sources.map((une) => {
    const porteur = une.genre === "etat" ? etatPorte(etat, une.effet)?.porteur : une.qui;
    const libelle = une.genre === "mj" ? "MJ" : `${nomDeLaSource(etat, une) ?? "?"} (${court(etat, porteur)})`;
    return { libelle, source: une, choisie: memeSource(une, source), ...jugerLaSource(contexte, une), mj: true };
  });
}

// X, pour un passif au coût X (mission, § 4.5) : de 0 à la plus grande valeur
// que jugerEffet accepte ; null pour toute autre source.
function xDe(contexte, choisi) {
  const { etat, source } = contexte;
  const passif = passifDe(etat, source);
  if (passif === null) return null;
  const cout = passif.capacite.facons[passif.facon].cout;
  if (cout?.souffle !== "X" && cout?.lien !== "X") return null;
  const courant = courantDe(etat, source.qui);
  const haut = Math.max(0, courant.souffle, ...(courant.liens ?? []).map((jauge) => jauge.points));
  let max = 0;
  for (let x = haut; x > 0 && max === 0; x -= 1) {
    const epreuve = epreuveDeLaSource(contexte, source, x);
    if (epreuve !== null && jugerEffet(etat, epreuve).ok) max = x;
  }
  return { libelle: "X", min: 0, max, valeur: choisi?.x ?? 0 };
}

// ─── Les champs de chaque genre ─────────────────────────────────────────────
//
// Chaque genre dit ses champs (leur nom est leur clé dans Choisi.valeurs),
// ses valeurs préférées, et comment ses valeurs font les champs de
// l'événement (null tant qu'il en manque une). Une option peut porter des
// « essais » : les valeurs qu'elle pose pour être jugée (une seule d'ordinaire ;
// pour le protagoniste de « rendre », chacune de ses ressources) ; elle est
// active si l'un d'eux est accepté. Une option sans essai (la cible en cours
// de « toute la case ») est toujours active.

const A_DUREE = ["attaque", "defense", "etat"];

const nombre = (nom, libelle, min, max, exclus = null) => ({ nom, sorte: "nombre", libelle, min, max, ...(exclus === null ? {} : { exclus }) });

const champSur = (contexte, essais = (id) => [{ sur: id }]) => ({
  nom: "sur",
  sorte: "option",
  libelle: "Sur",
  options: contexte.vivants.map((id) => ({ valeur: id, libelle: nomEntier(contexte.etat, id), case: courantDe(contexte.etat, id).case, essais: essais(id) })),
});

// Le premier vivant de la liste des préférés : la cible, l'auteur, puis les
// autres, dans l'ordre d'ajout.
const preferer = (contexte, ...ids) => [...ids, ...contexte.vivants].find((id) => present(id) && contexte.vivants.includes(id)) ?? null;

// Les champs nommés de l'événement, ou null s'il en manque un.
const prendre = (valeurs, noms) => (noms.some((nom) => !present(valeurs[nom])) ? null : Object.fromEntries(noms.map((nom) => [nom, valeurs[nom]])));

// Ce que « rendre » rend à un protagoniste, dans l'ordre de RESSOURCES_RENDRE,
// une zone tenant son armure et son endurance : chacune un tuple { sur,
// ressource, zone?, jauge? } que l'écran étale dans Choisi.valeurs.
function ressourcesDe(etat, sur) {
  const courant = courantDe(etat, sur);
  const photo = photoDe(etat, sur);
  if (courant === null) return [];
  const ressources = [{ valeur: { sur, ressource: "souffle" }, libelle: "Souffle" }];
  (courant.liens ?? []).forEach((jauge, rang) => ressources.push({ valeur: { sur, ressource: "lien", jauge: rang }, libelle: `Lien ${deNom(photo?.liens?.[rang]?.nom ?? "?")}` }));
  (courant.zones ?? []).forEach((zone, rang) => {
    const nom = photo?.zones?.[rang]?.nom ?? "?";
    ressources.push({ valeur: { sur, ressource: "armure", zone: rang }, libelle: `${nom}, armure` });
    ressources.push({ valeur: { sur, ressource: "endurance", zone: rang }, libelle: `${nom}, endurance` });
  });
  ressources.push({ valeur: { sur, ressource: "corps" }, libelle: "Corps" });
  return ressources;
}

const memeRessource = (a, b) => a?.sur === b?.sur && a?.ressource === b?.ressource && (a?.zone ?? null) === (b?.zone ?? null) && (a?.jauge ?? null) === (b?.jauge ?? null);

// Les d20 lancés du geste : « d20 → 15 » ; « 1er d20 → 6 » quand il y en a
// plusieurs.
function desDuGeste(etat, geste) {
  if (geste === null) return [];
  const lances = geste.localisation ?? [];
  return localisationsDuGeste(etat, geste).map((d20, rang) => ({
    valeur: rang,
    libelle: `${lances.length > 1 ? `${ordinal(rang + 1)} ` : ""}d20 ${SIGNES.fleche} ${lances[rang]?.brut ?? "?"}`,
    zone: d20.contre ? null : d20.zone,
  }));
}

// Le détail d'une cible de « toute la case », comme celui de l'étape « Cible »
// (contrat, § 3.2) : sa case, sa défense ou « lance sa défense », son corps.
function detailDeLaCible(etat, geste, id) {
  const courant = courantDe(etat, id);
  const corps = `corps ${courant.corps}/${courant.corpsMax}`;
  if (campDe(etat, id) === campDe(etat, geste.acteur)) return [courant.case, corps].join(` ${SIGNES.point} `);
  const defense = campDe(etat, id) === "adv" ? `défense ${defenseDe(etat, id, geste).valeur}` : "lance sa défense";
  return [courant.case, defense, corps].join(` ${SIGNES.point} `);
}

const NOMBRE_DE_DES = {
  champs: () => [nombre("nombre", "k", 1, BORNES_EFFET.nombre)],
  defauts: () => ({ nombre: 1 }),
  evenement: (contexte, valeurs) => prendre(valeurs, ["nombre"]),
};

const SANS_CHAMP = { champs: () => [], defauts: () => ({}), evenement: () => ({}) };

const OPERATION = {
  champs: () => [nombre("n", "N", 1, BORNES_EFFET.points)],
  defauts: () => ({ n: 1 }),
  evenement: (contexte, valeurs) => prendre(valeurs, ["n"]),
};

const ECART = {
  champs: (contexte) => [champSur(contexte), nombre("n", "N", -BORNES_EFFET.ecart, BORNES_EFFET.ecart, [0])],
  defauts: (contexte) => ({ sur: preferer(contexte, contexte.geste?.cible, contexte.auteur), n: 1 }),
  evenement: (contexte, valeurs) => prendre(valeurs, ["sur", "n", "duree"]),
};

const GENRES = {
  avantages: NOMBRE_DE_DES,
  desavantages: NOMBRE_DE_DES,
  relancer: SANS_CHAMP,
  inverser: SANS_CHAMP,
  reussite: SANS_CHAMP,
  zone: {
    champs(contexte) {
      const { etat, geste } = contexte;
      const victime = geste === null ? null : photoDe(etat, victimeDe(geste));
      return [
        { nom: "de", sorte: "option", libelle: "d20", options: desDuGeste(etat, geste).map(({ valeur, libelle }) => ({ valeur, libelle, essais: [{ de: valeur }] })) },
        { nom: "zone", sorte: "option", libelle: "Zone", options: (victime?.zones ?? []).map((zone, rang) => ({ valeur: rang, libelle: zone.nom, essais: [{ zone: rang }] })) },
      ];
    },
    // Le premier d20 qui n'est pas une contre-attaque, et la zone qu'il lit.
    defauts(contexte) {
      const des = desDuGeste(contexte.etat, contexte.geste);
      const premier = des.find((d20) => d20.zone !== null) ?? des[0] ?? null;
      return { de: premier?.valeur ?? null, zone: premier?.zone ?? 0 };
    },
    evenement: (contexte, valeurs) => prendre(valeurs, ["de", "zone"]),
  },
  multiplier: {
    champs: () => [nombre("k", "k", BORNES_EFFET.facteurMin, BORNES_EFFET.facteurMax)],
    defauts: () => ({ k: BORNES_EFFET.facteurMin }),
    evenement: (contexte, valeurs) => prendre(valeurs, ["k"]),
  },
  ajouter: OPERATION,
  retrancher: OPERATION,
  armure: OPERATION,
  directs: {
    champs: () => [
      nombre("n", "N", 0, BORNES_EFFET.points),
      {
        nom: "nature",
        sorte: "option",
        libelle: "Nature",
        options: [
          { valeur: "resistance", libelle: "à l'endurance", essais: [{ nature: "resistance" }] },
          { valeur: "corps", libelle: "au corps", essais: [{ nature: "corps" }] },
        ],
      },
    ],
    defauts: () => ({ n: 1, nature: "resistance" }),
    evenement: (contexte, valeurs) => prendre(valeurs, ["n", "nature"]),
  },
  reporter: {
    champs: (contexte) => [champSur(contexte)],
    defauts: () => ({ sur: null }),
    evenement: (contexte, valeurs) => prendre(valeurs, ["sur"]),
  },
  // Plusieurs cibles (mission, § 4.9) : la cible en cours en tête, cochée et
  // fixe ; puis les autres vivants de sa case, chacun éprouvé avec elle.
  toute_la_case: {
    champs(contexte) {
      const { etat, geste } = contexte;
      const cible = geste?.cible ?? null;
      if (cible === null || courantDe(etat, cible) === null) return [{ nom: "cibles", sorte: "cibles", libelle: "Toute la case", options: [] }];
      const laCase = courantDe(etat, cible).case;
      const autres = contexte.vivants.filter((id) => id !== cible && courantDe(etat, id).case === laCase);
      const option = (id, essais) => ({ valeur: id, libelle: nomEntier(etat, id), detail: detailDeLaCible(etat, geste, id), essais });
      return [{ nom: "cibles", sorte: "cibles", libelle: `Toute la case ${laCase}`, options: [option(cible, null), ...autres.map((id) => option(id, [{ cibles: [cible, id] }]))] }];
    },
    defauts: () => ({ cibles: null }),
    evenement: (contexte, valeurs) => prendre(valeurs, ["cibles"]),
  },
  attaque_en_plus: SANS_CHAMP,
  rendre: {
    champs: (contexte, valeurs) => [
      champSur(contexte, (id) => ressourcesDe(contexte.etat, id).map((ressource) => ressource.valeur)),
      {
        nom: "ressource",
        sorte: "option",
        libelle: "Ressource",
        options: ressourcesDe(contexte.etat, valeurs.sur).map((ressource) => ({ ...ressource, essais: [ressource.valeur] })),
      },
      nombre("n", "N", 1, BORNES_EFFET.points),
    ],
    defauts: (contexte) => ({ sur: preferer(contexte, contexte.auteur), ressource: "souffle", n: 1 }),
    evenement(contexte, valeurs) {
      const champs = prendre(valeurs, ["sur", "ressource", "n"]);
      if (champs === null) return null;
      if (valeurs.ressource === "lien") return present(valeurs.jauge) ? { ...champs, jauge: valeurs.jauge } : null;
      if (valeurs.ressource === "armure" || valeurs.ressource === "endurance") return present(valeurs.zone) ? { ...champs, zone: valeurs.zone } : null;
      return champs;
    },
  },
  attaque: ECART,
  defense: ECART,
  // Un état : une capacité d'un bloc de la banque (« 1:0 », le bloc et son
  // rang dans apports.etats), ou un état libre, nommé.
  etat: {
    champs(contexte) {
      const blocs = contexte.etats.map((bloc, rangBloc) => ({
        titre: `${bloc.nom} (bloc du classeur)`,
        options: (bloc.capacites ?? []).map((capacite, rang) => {
          const description = descriptionDe(capacite);
          return { valeur: `${rangBloc}:${rang}`, libelle: capacite.nom, texte: description === "" ? null : description, essais: [{ capacite: `${rangBloc}:${rang}`, libre: null }] };
        }),
      }));
      return [champSur(contexte), { nom: "capacite", sorte: "option", libelle: "État", blocs }, { nom: "libre", sorte: "texte", libelle: "État libre", max: BORNES_EFFET.libre }];
    },
    defauts: (contexte) => ({ sur: preferer(contexte, contexte.geste?.cible, contexte.auteur), capacite: null, libre: null }),
    evenement(contexte, valeurs) {
      const champs = prendre(valeurs, ["sur", "duree"]);
      if (champs === null) return null;
      if (present(valeurs.libre)) return { sur: champs.sur, libre: valeurs.libre, duree: champs.duree };
      const capacite = capaciteDuBloc(contexte, valeurs.capacite);
      return capacite === null ? null : { sur: champs.sur, capacite, duree: champs.duree };
    },
  },
  deplacer: {
    champs: (contexte, valeurs) => [champSur(contexte), { nom: "vers", sorte: "case", libelle: "Case d'arrivée", exclue: courantDe(contexte.etat, valeurs.sur)?.case ?? null }],
    defauts: (contexte) => ({ sur: preferer(contexte, contexte.geste?.cible, contexte.auteur), vers: null }),
    evenement: (contexte, valeurs) => prendre(valeurs, ["sur", "vers"]),
  },
};

// La capacité figée d'un bloc (« 1:0 »), ou null.
function capaciteDuBloc(contexte, cle) {
  if (typeof cle !== "string") return null;
  const [bloc, rang] = cle.split(":").map(Number);
  return element(element(contexte.etats, bloc)?.capacites, rang);
}

// L'onglet Durée (mission, § 4.6) : pour ±N et un état, « ce jet », jusqu'au
// prochain tour de l'auteur (ou du camp qui joue, pour le MJ hors d'un
// geste), jusqu'à la fin du combat.
function champDeLaDuree(contexte) {
  const { etat, auteur, camp } = contexte;
  const libelles = { jet: "ce jet", tour: ecrireDuree(etat, "tour", auteur, camp), combat: ecrireDuree(etat, "combat") };
  return { nom: "duree", sorte: "option", libelle: "Durée", options: DUREES_EFFET.map((duree) => ({ valeur: duree, libelle: libelles[duree], essais: [{ duree }] })) };
}

// Les champs d'un genre, la durée comprise pour ±N et un état.
const champsDu = (contexte, genre, valeurs) => [...GENRES[genre].champs(contexte, valeurs), ...(A_DUREE.includes(genre) ? [champDeLaDuree(contexte)] : [])];

// ─── Juger ──────────────────────────────────────────────────────────────────

// L'événement « effet » entier, ou null s'il lui manque un champ.
function evenementDe(contexte, genre, valeurs, x) {
  const champs = GENRES[genre].evenement(contexte, valeurs);
  if (champs === null) return null;
  return { type: "effet", genre, source: contexte.source, ...champs, ...(x === null ? {} : { x }) };
}

// La case voisine de celle d'un protagoniste, cherchée une fois par rendu.
function voisineDe(contexte, sur) {
  const depart = courantDe(contexte.etat, sur)?.case ?? null;
  if (!contexte.voisines.has(depart)) contexte.voisines.set(depart, casesEntre(depart, 1, 1)[0] ?? null);
  return contexte.voisines.get(depart);
}

// Pour juger une option avant que tout soit choisi : la case d'arrivée d'un
// déplacement, que l'écran demande au plateau, est la voisine de sa case ; un
// état sans capacité choisie, un nom libre.
function valeursAJuger(contexte, genre, valeurs) {
  if (genre === "deplacer" && !present(valeurs.vers)) return { ...valeurs, vers: voisineDe(contexte, valeurs.sur) };
  if (genre === "etat" && !present(valeurs.libre) && capaciteDuBloc(contexte, valeurs.capacite) === null) return { ...valeurs, libre: "?" };
  return valeurs;
}

// Le verdict de jugerEffet sur ces valeurs (bien formées : elles viennent des
// options mêmes), X à 0. Un événement auquel il manque un champ porte le
// refus de la forme.
function juger(contexte, genre, valeurs) {
  const evenement = evenementDe(contexte, genre, valeursAJuger(contexte, genre, valeurs), contexte.xEpreuve);
  if (evenement === null) return { ok: false, message: validerEvenement({ type: "effet", genre, source: contexte.source }).erreur ?? null };
  return jugerEffet(contexte.etat, evenement);
}

// Pose la valeur d'une option : le tuple de « rendre » s'étale.
function poser(valeurs, nom, valeur) {
  if (nom !== "ressource") return { ...valeurs, [nom]: valeur };
  const { zone, jauge, ...reste } = valeurs;
  return { ...reste, ...valeur };
}

const optionsDe = (champ) => champ.options ?? (champ.blocs ?? []).flatMap((bloc) => bloc.options);
const egale = (champ, option, valeurs) => (champ.nom === "ressource" ? memeRessource(option.valeur, valeurs) : option.valeur === valeurs[champ.nom]);

// Juge chaque option d'un champ ; une option sans essai est active. Un essai
// qui porte une ressource (un tuple de « rendre ») s'étale.
function jugerLesOptions(contexte, genre, champ, valeurs, moment) {
  const jugerUne = (option) => {
    if (!moment.actif) return inactif(moment.raison);
    if (option.essais === null || option.essais === undefined) return { actif: true, raison: null };
    let raison = null;
    for (const essai of option.essais) {
      const verdict = juger(contexte, genre, Object.hasOwn(essai, "ressource") ? poser(valeurs, "ressource", essai) : { ...valeurs, ...essai });
      if (verdict.ok) return { actif: true, raison: null };
      raison ??= verdict.message;
    }
    return inactif(raison);
  };
  const montrer = ({ essais, ...option }) => ({ ...option, ...jugerUne({ essais }) });
  if (champ.blocs) return { ...champ, blocs: champ.blocs.map((bloc) => ({ ...bloc, options: bloc.options.map(montrer) })) };
  return { ...champ, options: champ.options.map(montrer) };
}

// Les seuls genres dont les champs suivent les valeurs déjà posées (les
// ressources de qui reçoit, la case de qui se déplace) : leurs champs se
// relisent à chaque champ ; ceux des autres genres, une fois par parcours.
const CHAMPS_QUI_SUIVENT = ["rendre", "deplacer"];

/**
 * Les champs d'un genre, l'un après l'autre (un champ peut dépendre du
 * précédent : les ressources de qui reçoit, la case de qui se déplace) :
 * chaque option jugée sur les valeurs déjà posées ; puis la valeur du champ,
 * celle choisie par l'écran s'il y en a une, sinon la préférée si elle est
 * active, sinon la première active. Rend { champs, valeurs }.
 */
function parcourir(contexte, genre, choisies) {
  const moment = contexte.offerts[genre];
  let valeurs = { ...GENRES[genre].defauts(contexte), ...(A_DUREE.includes(genre) ? { duree: contexte.geste?.moment === "preparation" ? "jet" : "tour" } : {}) };
  for (const [nom, valeur] of Object.entries(choisies ?? {})) if (present(valeur)) valeurs = { ...valeurs, [nom]: valeur };
  const champs = [];
  let tous = champsDu(contexte, genre, valeurs);
  for (let rang = 0; rang < tous.length; rang += 1) {
    if (rang > 0 && CHAMPS_QUI_SUIVENT.includes(genre)) tous = champsDu(contexte, genre, valeurs);
    const champ = tous[rang];
    if (champ.sorte !== "option" && champ.sorte !== "cibles") {
      champs.push({ ...champ, valeur: valeurs[champ.nom] ?? null });
      continue;
    }
    const juge = jugerLesOptions(contexte, genre, champ, valeurs, moment);
    const options = optionsDe(juge);
    if (!present(choisies?.[champ.nom])) valeurs = poser(valeurs, champ.nom, valeurParDefaut(champ, options, valeurs));
    const valeur = champ.nom === "ressource" ? (options.find((option) => egale(champ, option, valeurs))?.valeur ?? null) : (valeurs[champ.nom] ?? null);
    if (champ.sorte === "cibles") {
      const premiere = options[0]?.valeur ?? null;
      champs.push({ ...juge, valeur, options: juge.options.map((option) => ({ ...option, dOffice: option.valeur === premiere || option.actif })) });
    } else {
      champs.push({ ...juge, valeur });
    }
  }
  return { champs, valeurs };
}

// La valeur d'un champ à options que l'écran n'a pas choisie : la préférée si
// elle est active, sinon la première active, sinon la préférée (le genre
// dira pourquoi rien ne s'applique). Pour « toute la case », la cible en
// cours et toutes les autres actives.
function valeurParDefaut(champ, options, valeurs) {
  if (champ.sorte === "cibles") return options.length === 0 ? null : [options[0].valeur, ...options.slice(1).filter((option) => option.actif).map((option) => option.valeur)];
  const preferee = options.find((option) => egale(champ, option, valeurs)) ?? null;
  if (preferee?.actif) return preferee.valeur;
  const active = options.find((option) => option.actif) ?? null;
  if (active !== null) return active.valeur;
  if (preferee !== null || options.length > 0) return (preferee ?? options[0]).valeur;
  return champ.nom === "ressource" ? { sur: valeurs.sur ?? null, ressource: valeurs.ressource ?? null } : (valeurs[champ.nom] ?? null);
}

// ─── Les genres ─────────────────────────────────────────────────────────────

const ONGLETS = [
  { cle: "des", libelle: "Dés", genres: ["avantages", "desavantages", "relancer", "inverser", "reussite"] },
  { cle: "zone", libelle: "Zone", genres: ["zone"] },
  { cle: "degats", libelle: "Dégâts", genres: ["multiplier", "ajouter", "retrancher", "armure", "directs", "reporter", "toute_la_case", "attaque_en_plus", "rendre"] },
  { cle: "cible", libelle: "Cible", genres: ["attaque", "defense", "etat", "deplacer"] },
];

// Les libellés de la maquette (F4, E1) ; « k avantages » et « k
// désavantages, pour ce jet » (mission, § 4.6), k étant le nombre posé.
const LIBELLES = {
  avantages: (valeurs) => `${compter(valeurs.nombre ?? 1, "avantage")}, pour ce jet`,
  desavantages: (valeurs) => `${compter(valeurs.nombre ?? 1, "désavantage")}, pour ce jet`,
  relancer: () => "Relancer",
  inverser: () => "Inverser",
  reussite: () => "+1 réussite",
  zone: () => `Choisir la zone${POINTS}`,
  multiplier: () => `${FOIS}k`,
  ajouter: () => "+N",
  retrancher: () => `${SIGNES.moins}N`,
  armure: () => "+N contre l'armure",
  directs: () => `Directs${POINTS}`,
  reporter: () => `Reporter sur${POINTS}`,
  toute_la_case: () => "Toute la case",
  attaque_en_plus: () => "Attaque en plus",
  rendre: () => `Rendre N${POINTS}`,
  attaque: () => "Attaque de la cible",
  defense: () => "Défense de la cible",
  etat: () => `Appliquer un état${POINTS}`,
  deplacer: () => `Déplacer, sans action${POINTS}`,
};

/**
 * Un genre de la palette : actif si son moment le permet et si l'événement
 * de ses valeurs par défaut est accepté ; sinon la raison du moment, ou celle
 * du refus. Le genre choisi montre ses champs avec les valeurs choisies.
 * Rend { vu (le Genre), valeurs (celles de la commande), duree (le champ de
 * l'onglet Durée, pour ±N et un état) }.
 */
function voirLeGenre(contexte, genre, choisi) {
  const moment = contexte.offerts[genre];
  const parDefaut = parcourir(contexte, genre, null);
  const estChoisi = choisi?.genre === genre;
  const montre = estChoisi ? parcourir(contexte, genre, choisi.valeurs ?? {}) : parDefaut;
  const verdict = moment.actif ? vu(juger(contexte, genre, parDefaut.valeurs)) : inactif(moment.raison);
  const champs = montre.champs.filter((champ) => champ.nom !== "duree");
  const duree = montre.champs.find((champ) => champ.nom === "duree") ?? null;
  const gabarit = { evenement: { type: "effet", genre, source: contexte.source, ...(contexte.xVue === null ? {} : { x: contexte.xVue }) } };
  return {
    vu: { genre, libelle: LIBELLES[genre](montre.valeurs), ...verdict, mj: contexte.source.genre === "mj", champs, gabarit },
    valeurs: montre.valeurs,
    duree,
  };
}

// ─── Les effets en cours ────────────────────────────────────────────────────

const RESSOURCES = { souffle: "souffle", corps: "corps", armure: "armure", endurance: "endurance" };

// Ce qu'un effet du geste a fait, sans sa source.
const QUOI_DU_GESTE = {
  avantages: (etat, effet) => compter(effet.nombre, "avantage"),
  desavantages: (etat, effet) => compter(effet.nombre, "désavantage"),
  relancer: () => "Relancer",
  inverser: () => "Inverser",
  reussite: () => "+1 réussite",
  zone: (etat, effet, geste) => `Zone : ${minuscule(photoDe(etat, victimeDe(geste))?.zones?.[effet.zone]?.nom ?? "?")}`,
  multiplier: (etat, effet) => `${FOIS}${effet.k}`,
  ajouter: (etat, effet) => `+${effet.n}`,
  retrancher: (etat, effet) => `${SIGNES.moins}${effet.n}`,
  armure: (etat, effet) => `+${effet.n} contre l'armure`,
  directs: (etat, effet) => `Dégâts directs ${effet.nature === "corps" ? "au corps" : "à l'endurance"} : ${effet.n}`,
  reporter: (etat, effet) => `Reportés sur ${court(etat, effet.sur)}`,
  toute_la_case: () => "Toute la case",
  attaque_en_plus: () => "Attaque en plus",
  rendre(etat, effet) {
    const photo = photoDe(etat, effet.sur);
    const quoi = effet.ressource === "lien" ? `lien ${deNom(photo?.liens?.[effet.jauge]?.nom ?? "?")}` : RESSOURCES[effet.ressource];
    const zone = effet.ressource === "armure" || effet.ressource === "endurance" ? `, ${minuscule(photo?.zones?.[effet.zone]?.nom ?? "?")}` : "";
    return `${court(etat, effet.sur)}${zone} : ${quoi} +${effet.n}`;
  },
  attaque: (etat, effet) => `Attaque ${deNom(court(etat, effet.sur))} ${signer(effet.n)}`,
  defense: (etat, effet) => `Défense ${deNom(court(etat, effet.sur))} ${signer(effet.n)}`,
  etat: (etat, effet) => `${court(etat, effet.sur)} : ${nomDUnEtat(effet)}`,
  deplacer: (etat, effet) => `${court(etat, effet.sur)} : ${effet.depart ?? "?"} ${SIGNES.fleche} ${effet.vers}`,
};

// La couleur (D13) : vert pour un ±N positif ; rouge pour une blessure ; la
// couleur d'alerte pour le reste.
const couleurDuGeste = (effet) => ((effet.genre === "attaque" || effet.genre === "defense") && effet.n > 0 ? "favorable" : "alerte");

function couleurDurable(effet) {
  if (effet.genre === "modif") return effet.n > 0 ? "favorable" : "alerte";
  return effet.genre === "etat" && effet.blessure === true ? "blessure" : "alerte";
}

const sourceEntre = (etat, effet) => `(${nomDeLaSource(etat, effet.source) ?? "?"})`;

// Le ✕ d'un état (celui de son étiquette, contrat, § 3.3) : un geste du MJ.
function retirerLEtat(etat, effet) {
  const evenement = { type: "mj", genre: "etat", qui: effet.porteur, retrait: effet.id };
  return { libelle: `Retirer l'état ${nomDUnEtat(effet)}`, ...vu(jugerMj(etat, evenement)), commande: { evenement }, mj: true };
}

/**
 * Les effets en cours (contrat, § 3.6) : ceux du geste, pour la cible en
 * cours, qui ne posent rien de durable (« pour ce jet ») ; puis les effets
 * durables que la source a posés, dans l'ordre de etat.effets, avec leur
 * durée écrite comme au journal. Une garde n'est pas un effet de la palette.
 */
function effetsEnCoursDe(contexte) {
  const { etat, geste, source } = contexte;
  const rang = geste?.rang ?? 0;
  const duGeste = (geste?.effets ?? [])
    .filter((effet) => (effet.rang ?? 0) === rang && !present(effet.durable) && Object.hasOwn(QUOI_DU_GESTE, effet.genre))
    .map((effet) => ({
      id: null,
      genre: effet.genre,
      nom: `${QUOI_DU_GESTE[effet.genre](etat, effet, geste)} ${sourceEntre(etat, effet)}`,
      duree: "pour ce jet",
      couleur: couleurDuGeste(effet),
      retirer: null,
    }));
  const durables = effetsDe(etat)
    .filter((effet) => effet.genre !== "guet" && memeSource(effet.source, source))
    .map((effet) => {
      const genre = effet.genre === "modif" ? effet.valeur : effet.genre;
      let quoi = "Attaque en plus";
      if (effet.genre === "modif") quoi = `${effet.valeur === "attaque" ? "Attaque" : "Défense"} ${deNom(court(etat, effet.porteur))} ${signer(effet.n)}`;
      if (effet.genre === "etat") quoi = `${court(etat, effet.porteur)} : ${nomDUnEtat(effet)}`;
      return {
        id: effet.id,
        genre,
        nom: `${quoi} ${sourceEntre(etat, effet)}`,
        duree: ecrireDuree(etat, effet.duree, effet.auteur ?? null, effet.camp ?? null),
        couleur: couleurDurable(effet),
        retirer: effet.genre === "etat" ? retirerLEtat(etat, effet) : null,
      };
    });
  return [...duGeste, ...durables];
}

// ─── L'aperçu ───────────────────────────────────────────────────────────────

// Les genres qui ont leur phrase au journal (journal.js, ecrireEffet).
const AVEC_PHRASE = ["rendre", "attaque", "defense", "etat", "deplacer"];
const DE_DEGATS = ["multiplier", "ajouter", "retrancher", "armure", "directs", "reporter"];

// Les phrases d'une ligne en cours, en texte, dans leur ordre.
function phrasesDe(ligne) {
  const textes = [];
  for (const segment of ligne?.segments ?? []) {
    if (!Number.isInteger(segment.phrase)) continue;
    textes[segment.phrase] = `${textes[segment.phrase] ?? ""}${segment.texte}`;
  }
  return textes.filter((texte) => texte !== undefined);
}

// Pendant un geste, ce que la ligne en cours dira de plus : ses phrases qui
// changent ; la dernière, si elle n'est qu'un début, suivie de « … ».
function changementsDeLaLigne(avant, apres) {
  const ligne = ligneEnCours(apres);
  const anciennes = phrasesDe(ligneEnCours(avant));
  const nouvelles = phrasesDe(ligne);
  const changees = nouvelles.filter((phrase) => !anciennes.includes(phrase));
  if (changees.length === 0) return null;
  const inachevee = ligne?.segments?.at(-1)?.type === "suite" && changees.at(-1) === nouvelles.at(-1);
  return `${changees.join(" ")}${inachevee ? POINTS : ""}`;
}

/**
 * Ce que le journal écrira d'un effet (contrat, D10 bis), lu sur l'état
 * d'après : hors d'un geste, les lignes que le moteur a écrites ; pendant un
 * geste, la phrase de l'effet pour un genre qui a la sienne, sinon les
 * phrases de la ligne en cours qui changent ; pour les dégâts, le bilan qui
 * change, et pour la zone, la localisation. null quand rien ne change encore
 * (des avantages avant le premier dé, une attaque en plus).
 */
function texteDeLApercu(avant, apres, genre) {
  const geste = gesteEnCours(avant);
  if (geste === null) {
    const ecrites = (apres.journal ?? []).slice((avant.journal ?? []).length).map((ligne) => ligne.texte);
    return ecrites.length === 0 ? null : ecrites.join(" ");
  }
  const suivant = gesteEnCours(apres);
  const effet = suivant?.effets?.at(-1) ?? null;
  if (AVEC_PHRASE.includes(genre) && effet?.genre === genre && (suivant.effets.length ?? 0) > (geste.effets?.length ?? 0)) return ecrireEffet(apres, effet);
  const ligne = changementsDeLaLigne(avant, apres);
  if (ligne !== null || suivant === null) return ligne;
  if (DE_DEGATS.includes(genre)) {
    const bilan = ecrireBilan(apres, suivant);
    return bilan === ecrireBilan(avant, geste) ? null : `${majuscule(bilan)}.`;
  }
  if (genre === "zone") {
    const localisation = ecrireLocalisation(apres, suivant);
    return localisation === ecrireLocalisation(avant, geste) ? null : localisation;
  }
  return null;
}

const ecrira = (texte) => (texte === null ? null : `Le journal écrira : ${texte}`);

// ─── La palette ─────────────────────────────────────────────────────────────

// « Appliquer » : la commande du genre choisi, ses valeurs, et X ; un genre
// inactif dit sa raison ; sinon jugée par la forme, puis par jugerEffet, puis
// par la simulation de l'écran, une fois. Rend { appliquer, apercu }.
function appliquerLeChoix(contexte, genreVu, valeurs, choisi, simuler) {
  const libelle = "Appliquer";
  const x = contexte.xVue === null ? null : (choisi.x ?? 0);
  const evenement = evenementDe(contexte, choisi.genre, valeurs, x);
  const commande = evenement === null ? null : { evenement };
  if (!genreVu.actif) return { appliquer: { libelle, actif: false, raison: genreVu.raison, commande }, apercu: null };
  if (evenement === null) {
    const raison = choisi.genre === "deplacer" && !present(valeurs.vers) ? "Touchez la case d'arrivée." : validerEvenement({ type: "effet", genre: choisi.genre, source: contexte.source }).erreur;
    return { appliquer: { libelle, actif: false, raison, commande: null }, apercu: null };
  }
  const lu = validerEvenement(evenement);
  if (lu.erreur) return { appliquer: { libelle, actif: false, raison: lu.erreur, commande: null }, apercu: null };
  const verdict = jugerEffet(contexte.etat, lu.evenement);
  if (!verdict.ok) return { appliquer: { libelle, ...vu(verdict), commande }, apercu: null };
  if (typeof simuler !== "function") return { appliquer: { libelle, actif: true, raison: null, commande }, apercu: null };
  const simule = simuler(evenement);
  if (present(simule?.refus)) return { appliquer: { libelle, actif: false, raison: simule.refus.message ?? null, commande }, apercu: null };
  const apercu = present(simule?.etat) ? ecrira(texteDeLApercu(contexte.etat, simule.etat, choisi.genre)) : null;
  return { appliquer: { libelle, actif: true, raison: null, commande }, apercu };
}

/**
 * La palette (contrat de la vague 3, § 3.6) : null si la source n'existe pas ;
 * sinon { titre, sous, texte, source: { valeur, nom, phrase, phraseMj, choix },
 * x, onglets: [{ cle, libelle, genres, champ? }], effetsEnCours, apercu,
 * appliquer: { libelle, actif, raison, commande } | null, fermer }.
 *
 * - « source » : { genre: "capacite", qui, capacite } | { genre: "etat",
 *   effet } | { genre: "mj" } ; ses « choix » (les sources du Mode MJ) portent
 *   chacun « mj: true » ; « phraseMj » est la phrase du Mode MJ.
 * - Chaque genre (onglets[].genres) : { genre, libelle, actif, raison, mj,
 *   champs, gabarit } ; le gabarit est l'événement sans ses champs, X compris
 *   quand « x » n'est pas nul (complet pour relancer, inverser, +1 réussite,
 *   une attaque en plus). Chaque champ : { nom, sorte, libelle, valeur, … } ;
 *   ses options, actives ou avec leur raison.
 * - L'onglet Durée porte « champ » : la durée du genre choisi de l'onglet
 *   Cible (±N, un état), null sans lui.
 * - « apports » : { etats (etatsDeLaBanque(banque).blocs), libre (ouverte
 *   par « Palette »), choisi: { genre, valeurs, x } | null, simuler:
 *   ((evenement) => { etat } | { refus }) | null }. La simulation n'est
 *   appelée que pour la commande choisie, acceptée, une fois.
 */
export function vuePalette(etat, source, apports = {}) {
  if (!sourceExiste(etat, source)) return null;
  const geste = gesteEnCours(etat);
  const auteur = auteurDe(etat, geste, source);
  const contexte = {
    etat,
    geste,
    source,
    auteur,
    camp: auteur === null ? (etat.tour?.camp ?? null) : campDe(etat, auteur),
    offerts: offreDesEffets(etat),
    etats: Array.isArray(apports.etats) ? apports.etats : [],
    vivants: vivantsDe(etat),
    xVue: null,
    xEpreuve: null,
    // Les cases voisines déjà cherchées, le temps d'un rendu.
    voisines: new Map(),
  };
  const choisi = present(apports.choisi) && GENRES_EFFET.includes(apports.choisi.genre) ? apports.choisi : null;
  const x = xDe(contexte, choisi);
  contexte.xVue = x === null ? null : x.valeur;
  contexte.xEpreuve = x === null ? null : 0;

  const nom = nomDeLaSource(etat, source) ?? "?";
  const laJouee = estLaCapaciteJouee(geste, source);
  const libre = apports.libre === true;

  const genres = Object.fromEntries(GENRES_EFFET.map((genre) => [genre, voirLeGenre(contexte, genre, choisi)]));
  const dureeChoisie = choisi !== null && A_DUREE.includes(choisi.genre) ? genres[choisi.genre].duree : null;
  const onglets = [
    ...ONGLETS.map(({ cle, libelle, genres: ceux }) => ({ cle, libelle, genres: ceux.map((genre) => genres[genre].vu) })),
    { cle: "duree", libelle: "Durée", genres: [], champ: dureeChoisie },
  ];

  const { appliquer, apercu } = choisi === null ? { appliquer: null, apercu: null } : appliquerLeChoix(contexte, genres[choisi.genre].vu, genres[choisi.genre].valeurs, choisi, apports.simuler);

  return {
    titre: libre ? "Palette (Mode MJ)" : `Effet ${deNom(nom)}`,
    sous: libre ? "la source se choisit" : laJouee ? "la palette, au nom de la capacité jouée" : `la palette, au nom ${deNom(nom)}`,
    texte: texteDeLaSource(etat, geste, source, nom),
    source: {
      valeur: source,
      nom,
      phrase: `Source : ${nom}${laJouee ? ", la capacité jouée" : ""} (en Mode MJ, elle se change).`,
      phraseMj: `Source : ${nom}${laJouee ? " (par défaut)" : ""} ${SIGNES.point} changer`,
      choix: sourcesAuChoix(contexte),
    },
    x,
    onglets,
    effetsEnCours: effetsEnCoursDe(contexte),
    apercu,
    appliquer,
    fermer: "Fermer",
  };
}

// ─── Le menu du MJ ──────────────────────────────────────────────────────────

// Les valeurs que change « Modifier une valeur… » (mission, § 4.8), dans
// l'ordre de CHAMPS_MJ, une zone tenant son armure et son endurance : chacune
// sa clé de saisie, son libellé, ce qui la situe, sa valeur courante, et
// l'entrée de l'événement qu'elle fera.
function valeursDuMenu(etat, id) {
  const courant = courantDe(etat, id);
  const photo = photoDe(etat, id);
  const champs = [];
  const ajouter = (cle, libelle, sous, valeur, entree) => champs.push({ cle, libelle, sous, valeur, min: 0, max: BORNES_MJ.valeur, entree });
  if (courant.camp === "adv") {
    ajouter("attaque", "Attaque", `${photo.attaque} au départ`, courant.attaque, { champ: "attaque" });
    ajouter("defense", "Défense", `${photo.defense} au départ`, courant.defense, { champ: "defense" });
  }
  ajouter("souffle", "Souffle", `sur ${courant.souffleMax}`, courant.souffle, { champ: "souffle" });
  ajouter("souffleMax", "Souffle maximum", `${photo.souffle} au départ`, courant.souffleMax, { champ: "souffleMax" });
  ajouter("actions", "Actions", `maximum ${courant.actionsMax}`, courant.actions, { champ: "actions" });
  ajouter("actionsMax", "Actions maximum", `${photo.actions} au départ`, courant.actionsMax, { champ: "actionsMax" });
  (courant.liens ?? []).forEach((jauge, rang) => ajouter(`lien:${rang}`, `Lien ${deNom(photo.liens?.[rang]?.nom ?? "?")}`, `sur ${jauge.max}`, jauge.points, { champ: "lien", jauge: rang }));
  ajouter("corps", "Corps", `sur ${courant.corpsMax}`, courant.corps, { champ: "corps" });
  (courant.zones ?? []).forEach((zone, rang) => {
    const nom = photo.zones?.[rang]?.nom ?? "?";
    ajouter(`armure:${rang}`, `${nom}, armure`, `sur ${zone.armureMax}`, zone.armure, { champ: "armure", zone: rang });
    ajouter(`endurance:${rang}`, `${nom}, endurance`, `sur ${zone.resistanceMax}`, zone.resistance, { champ: "endurance", zone: rang });
  });
  if (present(photo.bouclier)) ajouter("bouclier", "Défense du bouclier", `${photo.bouclier.defense} au départ`, courant.bouclier ?? photo.bouclier.defense, { champ: "bouclier" });
  return champs;
}

// « Enregistrer » : les saisies qui changent une valeur, en un événement
// « valeurs » ; jugé par la forme et par jugerMj ; l'aperçu, par la
// simulation de l'écran, une fois. Rend { enregistrer, apercu }.
function enregistrerLesSaisies(etat, id, champs, menu, apports) {
  const libelle = "Enregistrer";
  const saisies = apports.saisies !== null && typeof apports.saisies === "object" ? apports.saisies : {};
  const entrees = champs.filter((champ) => present(saisies[champ.cle]) && saisies[champ.cle] !== champ.valeur).map((champ) => ({ ...champ.entree, valeur: saisies[champ.cle] }));
  if (entrees.length === 0) return { enregistrer: { libelle, ...(menu.actif ? inactif("Aucune valeur ne change.") : menu), commande: null, mj: true }, apercu: null };
  const evenement = { type: "mj", genre: "valeurs", qui: id, valeurs: entrees };
  const lu = validerEvenement(evenement);
  if (lu.erreur) return { enregistrer: { libelle, ...(menu.actif ? inactif(lu.erreur) : menu), commande: null, mj: true }, apercu: null };
  const verdict = vu(jugerMj(etat, lu.evenement));
  const enregistrer = { libelle, ...verdict, commande: { evenement }, mj: true };
  if (!verdict.actif || typeof apports.simuler !== "function") return { enregistrer, apercu: null };
  const simule = apports.simuler(evenement);
  if (present(simule?.refus)) return { enregistrer: { ...enregistrer, ...inactif(simule.refus.message ?? null) }, apercu: null };
  if (!present(simule?.etat)) return { enregistrer, apercu: null };
  return { enregistrer, apercu: ecrira(phrasesDuMj(etat, simule.etat, lu.evenement).join(" ")) };
}

// « Ajouter ou retirer un état… » (mission, § 4.7, § 4.8 ; maquette, F9) :
// les états de la banque par bloc, un état libre, et ceux qu'il porte, à
// retirer. La durée se complète par l'écran (« tour » par défaut).
function etatsDuMenu(etat, id, menu, blocs) {
  const nom = nomEntier(etat, id);
  const jugerLAjout = (ajout) => vu(jugerMj(etat, { type: "mj", genre: "etat", qui: id, ajout: { ...ajout, duree: "tour" } }));
  return {
    libelle: `Ajouter ou retirer un état${POINTS}`,
    texte: "un état du classeur, ou un état libre",
    titre: `Un état pour ${nom}`,
    sous: "du classeur, ou libre",
    ...menu,
    blocs: blocs.map((bloc) => ({
      titre: `${bloc.nom} (bloc du classeur)`,
      options: (bloc.capacites ?? []).map((capacite) => {
        const description = descriptionDe(capacite);
        return {
          libelle: capacite.nom,
          texte: description === "" ? null : description,
          ...jugerLAjout({ capacite }),
          gabarit: { evenement: { type: "mj", genre: "etat", qui: id, ajout: { capacite } } },
          mj: true,
        };
      }),
    })),
    libre: {
      libelle: "État libre",
      aide: `Un nom : ${OUVRANT} À terre ${FERMANT}, ${OUVRANT} Dans la fumée ${FERMANT}${POINTS}`,
      max: BORNES_EFFET.libre,
      ...jugerLAjout({ libre: "?" }),
      gabarit: { evenement: { type: "mj", genre: "etat", qui: id, ajout: {} } },
      mj: true,
    },
    durees: [
      { valeur: "tour", libelle: ecrireDuree(etat, "tour", null, etat.tour?.camp ?? null) },
      { valeur: "combat", libelle: ecrireDuree(etat, "combat") },
    ],
    source: "Source : le MJ (menu du jeton).",
    portes: effetsDurablesDe(etat, id)
      .filter((effet) => effet.genre === "etat")
      .map((effet) => {
        const evenement = { type: "mj", genre: "etat", qui: id, retrait: effet.id };
        return { libelle: nomDUnEtat(effet), ...vu(jugerMj(etat, evenement)), commande: { evenement }, mj: true };
      }),
    mj: true,
  };
}

/**
 * Le menu du MJ d'un protagoniste (contrat de la vague 3, § 3.7) : null pour
 * un mort, un retiré, ou qui n'est pas du combat ; sinon { titre, sous,
 * actif, raison, note, valeurs, equipement, etats, deplacer, retirer, mj }.
 * Tout y porte « mj: true ». Entre deux gestes seulement : pendant un geste,
 * le menu et toutes ses entrées sont inactifs, avec la raison du juge (« Le
 * geste en cours se finit d'abord. »).
 *
 * « apports » : { etats (etatsDeLaBanque(banque).blocs), saisies: { [clé
 * d'un champ de « valeurs »]: valeur } | null, simuler: ((evenement) =>
 * { etat } | { refus }) | null } ; la simulation n'est appelée que pour
 * « Enregistrer », accepté, une fois.
 */
export function vueMenuMj(etat, id, apports = {}) {
  const courant = courantDe(etat, id);
  if (courant === null || !vivant(etat, id)) return null;
  const nom = nomEntier(etat, id);
  const menu = vu(jugerMj(etat, { type: "mj", genre: "retirer", qui: id }));
  const champs = valeursDuMenu(etat, id);
  const { enregistrer, apercu } = enregistrerLesSaisies(etat, id, champs, menu, apports ?? {});
  return {
    titre: nom,
    sous: [UN_DU_CAMP[courant.camp] ?? "", courant.case, `corps ${courant.corps}/${courant.corpsMax}`].join(` ${SIGNES.point} `),
    ...menu,
    note: "Ne change que ce combat ; le journal l'écrit.",
    valeurs: {
      libelle: `Modifier une valeur${POINTS}`,
      texte: "attaque, défense, souffle, actions, lien, corps, armure et endurance d'une zone",
      titre: `Modifier ${SIGNES.tiret} ${nom}`,
      sous: "pour ce combat seulement",
      ...menu,
      champs,
      gabarit: { evenement: { type: "mj", genre: "valeurs", qui: id } },
      apercu,
      enregistrer,
      mj: true,
    },
    equipement: {
      libelle: `Changer l'équipement${POINTS}`,
      texte: courant.camp === "pj" ? "l'arme tenue, la qualité des objets" : "la cellule Équipement",
      ...menu,
      mj: true,
    },
    etats: etatsDuMenu(etat, id, menu, Array.isArray(apports?.etats) ? apports.etats : []),
    deplacer: {
      libelle: `Déplacer sans action${POINTS}`,
      texte: "touchez ensuite la case d'arrivée",
      exclue: courant.case,
      ...menu,
      gabarit: { evenement: { type: "mj", genre: "deplacer", qui: id } },
      mj: true,
    },
    retirer: {
      libelle: "Retirer du combat",
      ...menu,
      commande: { evenement: { type: "mj", genre: "retirer", qui: id } },
      mj: true,
    },
    mj: true,
  };
}
