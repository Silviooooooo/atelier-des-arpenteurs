// La rencontre (SPECIFICATION.md, § 16.6).
//
// Le meneur choisit des adversaires et un nombre d'exemplaires de chacun,
// par des boutons + et −, puis imprime : une carte par exemplaire (§ 16.5),
// numérotée dès qu'il y en a plus d'une du même adversaire, dans l'ordre de
// la liste, sur des pages A4. La composition est gardée sur cet appareil,
// chiffrée, jusqu'à « Vider la rencontre » (js/adversaire/rencontre_gardee.js,
// par la clé de table, une par mode) : chaque + et chaque − l'écrivent,
// « Vider la rencontre » l'efface. Elle se lit à la première visite de cet
// écran, de celui du combat ou d'une fiche d'adversaire, jamais au
// démarrage, et sans que l'écran l'attende. « Oublier le mot de passe »
// l'efface de la mémoire de ce module ; la version chiffrée reste,
// illisible sans la clé.
//
// La composition se relit par les noms, contre la banque ouverte : une
// banque republiée, ou rechargée, la garde ; un nom qui n'y est plus se
// perd. Elle ne tient plus à l'objet banque : c'était la cause réelle du
// bouton « Placer la rencontre préparée » grisé (lot 4, groupe 2). En mode
// réel, une publication faite d'ici ou « Vérifier les mises à jour »
// remplacent la banque ouverte par une autre, de mêmes noms ; la rencontre
// préparée, comparée à l'ancien objet, se lisait vide, et le premier écran
// qui voyait la nouvelle vidait la composition.
//
// Ce module porte aussi ce que la fiche d'un adversaire partage avec lui :
// le cadre où des cartes se tiennent à l'échelle de l'écran, et
// l'impression, qui attend les polices de la carte.

import { LARGEUR_CARTE, cartes } from "../adversaire/carte.js";
import { defautDe } from "../adversaire/lecture.js";
import { texteDe } from "../adversaire/notation.js";
import { NOM_MAX, PLAFOND_CARTES, PLAFOND_EXEMPLAIRES, creerGardeRencontre, ouvrirMagasinRencontre } from "../adversaire/rencontre_gardee.js";
import { listeDe, manqueDe } from "../banque/consultation.js";
import { filtrer } from "../banque/recherche.js";
import { adresseFiche, adresseListe } from "../routes.js";
import { compte, el, enumerer, sansSensForce, titre } from "./dom.js";
import { tenirALEchelle } from "./echelle.js";

// Les plafonds vivent avec la rencontre gardée, qui relit avec eux ce que
// l'appareil lui rend. Trois cartes tiennent sur une page A4 : douze
// exemplaires d'un adversaire en font quatre pages, soixante cartes une
// vingtaine. L'aperçu fabrique chaque carte dans la page, une centaine
// d'éléments chacune (94 à 121 sur la démonstration, lot 3) : au-delà, un
// téléphone peine, et un doigt resté sur « + » imprimerait une rame.
export { PLAFOND_CARTES, PLAFOND_EXEMPLAIRES };

// Les trois faces d'EB Garamond qu'emploie la carte (css/adversaire.css).
const POLICES_CARTE = ["11px 'EB Garamond'", "600 11px 'EB Garamond'", "italic 11px 'EB Garamond'"];

// La composition : le nombre d'exemplaires de chaque adversaire, par son
// nom. Elle n'appartient à aucun objet banque : chaque banque vue l'élague
// des noms qu'elle n'a pas (compositionDe), sans rien écrire.
let composition = new Map();
let banqueVue = null;
let nomsVus = new Set(); // les noms de la banque vue
let resolus = new Map(); // les adversaires de la banque vue, déjà résolus
// La lecture de la composition gardée : null (pas encore), une promesse (en
// cours), ou "faite". Les gestes faits pendant qu'elle court attendent, puis
// se rejouent sur ce qu'elle rend : ni l'un ni l'autre ne se perd.
let lecture = null;
let enAttente = []; // [["plus", nom] | ["moins", nom] | ["vider"]]
let contexteDuMoment = null;
let magasinDesServices = null; // le magasin que les contrôles donnent, sinon celui de la page
let garde = null;
let magasinDeLaPage = null; // ouvert une fois par page, jamais à l'import
// Chaque « Oublier le mot de passe » ouvre un nouveau circuit : une lecture
// partie avant lui n'a plus rien à poser.
let circuit = 0;

const total = (choisis) => [...choisis.values()].reduce((somme, nombre) => somme + nombre, 0);
const pareilles = (une, autre) => une.size === autre.size && [...une].every(([nom, nombre]) => autre.get(nom) === nombre);
const peutRecevoir = (choisis, nom) => (choisis.get(nom) ?? 0) < PLAFOND_EXEMPLAIRES && total(choisis) < PLAFOND_CARTES;

function compositionDe(banque) {
  if (banque !== banqueVue) {
    nomsVus = new Set(listeDe(banque ?? {}, "adversaires").map(({ nom }) => nom));
    for (const nom of [...composition.keys()]) if (!nomsVus.has(nom)) composition.delete(nom);
    resolus = new Map();
    banqueVue = banque;
  }
  return composition;
}

// Ce qu'un geste fait d'une composition, plafonds compris : le même à
// l'écran et au rejeu des gestes faits pendant la lecture. Rend vrai s'il
// la change.
function jouer(choisis, [genre, nom]) {
  if (genre === "vider") {
    const avait = choisis.size > 0;
    choisis.clear();
    return avait;
  }
  const nombre = choisis.get(nom) ?? 0;
  if (genre === "plus") {
    if (!nomsVus.has(nom) || !peutRecevoir(choisis, nom)) return false;
    choisis.set(nom, nombre + 1);
    return true;
  }
  if (nombre === 0) return false;
  if (nombre === 1) choisis.delete(nom);
  else choisis.set(nom, nombre - 1);
  return true;
}

// Le magasin s'ouvre sans qu'on l'attende : la garde reçoit tout de suite un
// mandataire, dont chaque demande attend l'ouverture.
function differe(source) {
  const pret = Promise.resolve(source);
  return {
    lire: async (mode) => (await pret).lire(mode),
    ecrire: async (enveloppe) => (await pret).ecrire(enveloppe),
    effacer: async (mode) => (await pret).effacer(mode),
  };
}

// La garde, créée avec la clé, et seulement avec elle : une clé apparue
// après une première visite sans clé la crée au geste suivant. La clé se
// relit à chaque écriture, jamais copiée (§ 7.2).
function gardeDuMoment() {
  if (garde || !contexteDuMoment?.etat?.secret) return garde;
  try {
    garde = creerGardeRencontre({
      magasin: differe(magasinDesServices ?? (magasinDeLaPage ??= ouvrirMagasinRencontre())),
      mode: contexteDuMoment.etat.mode,
      secret: () => contexteDuMoment?.etat?.secret ?? null,
    });
  } catch {
    // un mode inconnu : rien ne se garde, la composition reste en mémoire
    garde = null;
  }
  return garde;
}

// Un nom de plus de NOM_MAX signes ne se relirait pas : il ne s'écrit pas, et
// le reste de la composition se garde sans lui.
const aGarder = () => [...composition].filter(([nom]) => [...nom].length <= NOM_MAX).map(([nom, nombre]) => ({ nom, nombre }));

function ecrire(effacer) {
  const lagarde = gardeDuMoment();
  if (!lagarde) return;
  if (effacer) lagarde.effacer();
  else lagarde.garder(aGarder());
}

// Chaque geste qui change la composition s'écrit ; avant la fin de la
// lecture, il attend, pour se rejouer sur ce qu'elle rend.
function noter(geste) {
  if (lecture !== "faite") {
    enAttente.push(geste);
    if (lecture === null && contexteDuMoment) charger(contexteDuMoment, { magasin: magasinDesServices });
    return;
  }
  ecrire(geste[0] === "vider");
}

function gerer(banque, geste) {
  if (!jouer(compositionDe(banque), geste)) return false;
  noter(geste);
  return true;
}

// La lecture arrivée : les noms lus que la banque du moment connaît, puis
// les gestes faits pendant la lecture, rejoués dessus. Rend vrai si la
// composition a changé.
function poser(lues) {
  const avant = new Map(composition);
  compositionDe(contexteDuMoment?.etat?.banque ?? banqueVue);
  const choisis = new Map();
  for (const { nom, nombre } of lues) if (nomsVus.has(nom)) choisis.set(nom, nombre);
  const gestes = enAttente;
  enAttente = [];
  for (const geste of gestes) jouer(choisis, geste);
  composition = choisis;
  lecture = "faite";
  if (gestes.length > 0) ecrire(choisis.size === 0);
  return !pareilles(avant, choisis);
}

/** Le nombre d'exemplaires d'un adversaire dans la rencontre. */
export function exemplaires(banque, nom) {
  return compositionDe(banque).get(nom) ?? 0;
}

/** Vrai quand la rencontre peut recevoir un exemplaire de plus de cet adversaire. */
export function peutAjouter(banque, nom) {
  return peutRecevoir(compositionDe(banque), nom);
}

/**
 * Ajoute un exemplaire d'un adversaire de la banque, dans la limite des
 * plafonds, et l'écrit ; rend vrai s'il est ajouté. Un nom que la banque n'a
 * pas est refusé : il n'aurait pas de carte.
 */
export function ajouter(banque, nom) {
  return gerer(banque, ["plus", nom]);
}

function retirer(banque, nom) {
  return gerer(banque, ["moins", nom]);
}

function vider(banque) {
  return gerer(banque, ["vider"]);
}

/**
 * La rencontre préparée, pour qui veut la poser ailleurs (le simulateur de
 * combat, § 17) : [{ nom, nombre }], dans l'ordre de la liste, celui où ses
 * cartes se suivent. Elle se lit par les noms, sans comparer d'objet : une
 * banque republiée de mêmes noms rend la même. Elle lit sans rien changer :
 * interrogée pour une banque qui n'a aucun de ses noms, elle rend une liste
 * vide et laisse la composition telle quelle.
 */
export function rencontrePreparee(banque) {
  return listeDe(banque, "adversaires")
    .filter(({ nom }) => composition.has(nom))
    .map(({ nom }) => ({ nom, nombre: composition.get(nom) }));
}

/**
 * Lit la composition gardée, une fois par page : à la première visite de
 * l'écran Rencontre, de l'écran Combat ou d'une fiche d'adversaire. Rend une
 * promesse, vraie si la lecture a changé la composition ; deux visites
 * pendant la lecture reçoivent la même. Sans clé, rien ne s'ouvre et la
 * réponse est faite dans l'appel même. Ne rejette pas.
 * `services.magasin` : un magasin à la place de celui de la page (contrôles).
 */
export function charger(contexte, services = {}) {
  contexteDuMoment = contexte;
  magasinDesServices = services?.magasin ?? null;
  if (lecture === "faite") return Promise.resolve(false);
  if (lecture !== null) return lecture;
  const lagarde = contexte?.etat?.secret ? gardeDuMoment() : null;
  if (!lagarde) {
    lecture = "faite";
    enAttente = [];
    return Promise.resolve(false);
  }
  const tour = circuit;
  lecture = lagarde
    .charger()
    .then(({ entrees }) => (tour === circuit ? poser(entrees) : false))
    .catch(() => {
      if (tour === circuit) lecture = "faite";
      return false;
    });
  return lecture;
}

/**
 * « Oublier le mot de passe » : la composition quitte la mémoire, avec la
 * garde et la lecture en cours. La version chiffrée reste sur l'appareil,
 * illisible sans la clé ; la page garde son magasin.
 */
export function oublier() {
  circuit += 1;
  garde?.oublier();
  garde = null;
  composition = new Map();
  banqueVue = null;
  nomsVus = new Set();
  resolus = new Map();
  lecture = null;
  enAttente = [];
  contexteDuMoment = null;
  magasinDesServices = null;
}

// Un doublon (E16) ne compte qu'une fois : la rencontre prend le premier de
// son nom, comme l'héritage prend la première classe.
function resoudre(contexte, nom) {
  if (!resolus.has(nom)) {
    const resolution = contexte.etat.index.adversaires();
    resolus.set(nom, resolution.resoudre(resolution.adversaires.get(nom)));
  }
  return resolus.get(nom);
}

/**
 * Le cadre où des cartes se tiennent à l'échelle de l'écran : { noeud,
 * montrer(liste), mesurer }, liste étant celle de cartes() (carte.js). Le
 * cadre reste, ses cartes changent : c'est lui qui porte l'échelle, que
 * l'écran fait mesurer de nouveau quand sa hauteur change.
 */
export function cadreDeCartes() {
  const noeud = el("div", { classe: "cadre-cartes" });
  const mesurer = tenirALEchelle(noeud, LARGEUR_CARTE);
  return {
    noeud,
    mesurer,
    montrer(liste) {
      noeud.replaceChildren(cartes(liste));
      globalThis.requestAnimationFrame?.(mesurer);
    },
  };
}

/**
 * Lance l'impression de la page, où seules les cartes sortent (css). Leurs
 * polices d'abord : sinon le PDF prend celles du système.
 */
export async function imprimerCartes() {
  try {
    await Promise.all(POLICES_CARTE.map((police) => document.fonts.load(police)));
    await document.fonts.ready;
  } catch {
    // polices indisponibles : l'impression se fait avec celles de secours
  }
  globalThis.print();
}

/** L'écran #/rencontre. `services.magasin` : celui des contrôles. */
export function afficher(contexte, services = {}) {
  const { banque } = contexte.etat;
  const adversaires = listeDe(banque, "adversaires");
  const manque = manqueDe(banque, "adversaires");
  if (manque || !adversaires.length) {
    return el(
      "section",
      {},
      titre("Rencontre"),
      el("p", { classe: "message" }, manque ?? "Cette banque n'a aucun adversaire."),
      el("p", { classe: "lien-retour" }, el("a", { href: "#/" }, "Retour à l'accueil")),
    );
  }
  const cadre = cadreDeCartes();
  const liste = el("ul", { classe: "liste-rencontre" });
  const trouves = el("p", { classe: "secondaire-texte petit", role: "status" });
  const bilan = el("p", { classe: "bilan-rencontre", role: "status", tabindex: "-1" });
  const detail = el("p", { classe: "secondaire-texte" });
  const signalement = el("div", {});
  const imprimer = el("button", { type: "button", classe: "bouton bouton-principal", onclick: () => imprimerCartes() }, "Imprimer / PDF");
  const boutonVider = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => {
        vider(banque);
        rafraichir();
        // Le bouton devient inactif : le focus va à ce qui dit le résultat.
        bilan.focus();
      },
    },
    "Vider la rencontre",
  );
  const lignes = new Map();

  // La composition se relit à chaque fois : la lecture de la composition
  // gardée la remplace quand elle arrive.
  function rafraichir() {
    const choisis = compositionDe(banque);
    const somme = total(choisis);
    for (const [nom, { valeur, moins, plus }] of lignes) {
      const nombre = choisis.get(nom) ?? 0;
      valeur.textContent = String(nombre);
      moins.disabled = nombre === 0;
      plus.disabled = !peutAjouter(banque, nom);
    }
    const retenus = adversaires.filter((adversaire) => choisis.has(adversaire.nom));
    bilan.textContent = somme >= PLAFOND_CARTES ? `${somme} cartes : le plafond d'une rencontre.` : compte(somme, "carte", "cartes");
    detail.textContent = somme ? sansSensForce(`${retenus.map(({ nom }) => `${choisis.get(nom)} × ${nom}`).join(", ")}.`) : "Ajoutez un adversaire avec « + » : sa carte paraît ci-dessous.";
    imprimer.disabled = somme === 0;
    boutonVider.disabled = somme === 0;
    const incertains = retenus.map(({ nom }) => [nom, defautDe(resoudre(contexte, nom))]).filter(([, defaut]) => defaut);
    signalement.replaceChildren(
      ...(incertains.length
        ? [
            el(
              "p",
              { classe: "message" },
              "À vérifier avant d'imprimer : ",
              enumerer(incertains.map(([nom, defaut]) => [el("a", { href: adresseFiche("adversaires", nom) }, nom), ` (${defaut})`])),
              `. ${incertains.length > 1 ? "Ils s'impriment tels qu'ils se résolvent." : "Il s'imprime tel qu'il se résout."}`,
            ),
          ]
        : []),
    );
    // Une carte par exemplaire, dans l'ordre de la liste ; un numéro dès
    // qu'un adversaire en a plus d'une.
    cadre.montrer(
      retenus.flatMap(({ nom }) => {
        const nombre = choisis.get(nom);
        return Array.from({ length: nombre }, (_, i) => ({ resolu: resoudre(contexte, nom), numero: nombre > 1 ? i + 1 : null }));
      }),
    );
  }

  function changer(nom, pas) {
    if (!(pas > 0 ? ajouter(banque, nom) : retirer(banque, nom))) return;
    rafraichir();
    // Un bouton devenu inactif perd le focus : il passe à son voisin.
    const { moins, plus } = lignes.get(nom);
    const [bouton, voisin] = pas > 0 ? [plus, moins] : [moins, plus];
    if (bouton.disabled && !voisin.disabled) voisin.focus();
  }

  adversaires.forEach(({ nom, types }, rang) => {
    const id = `exemplaires-${rang}`;
    const valeur = el("span", { id, classe: "valeur-pas" });
    const moins = el("button", { type: "button", id: `${id}-moins`, classe: "bouton secondaire bouton-pas", "aria-label": `Retirer un exemplaire de ${nom}`, onclick: () => changer(nom, -1) }, "−");
    const plus = el("button", { type: "button", id: `${id}-plus`, classe: "bouton secondaire bouton-pas", "aria-label": `Ajouter un exemplaire de ${nom}`, onclick: () => changer(nom, +1) }, "+");
    const noeud = el(
      "li",
      { classe: "ligne-rencontre" },
      el("span", { classe: "nom-rencontre" }, el("a", { href: adresseFiche("adversaires", nom) }, nom), " ", el("span", { classe: "detail" }, texteDe(types) || "sans classe")),
      el("div", { classe: "pas-a-pas" }, moins, valeur, plus),
    );
    lignes.set(nom, { noeud, valeur, moins, plus });
  });

  const recherche = el("input", {
    type: "search",
    id: "recherche-rencontre",
    classe: "champ",
    autocomplete: "off",
    autocapitalize: "none",
    spellcheck: "false",
    placeholder: "Nom, classe, équipement ou capacité",
  });
  // Les lignes se gardent, avec leurs boutons : la recherche ne fait que
  // choisir celles qu'elle montre.
  const filtrerLignes = () => {
    const montres = filtrer(adversaires, recherche.value, contexte.etat.index.textesAdversaire);
    liste.replaceChildren(...montres.map(({ nom }) => lignes.get(nom).noeud));
    trouves.textContent = recherche.value.trim() ? `${compte(montres.length, "adversaire", "adversaires")} sur ${adversaires.length}` : compte(adversaires.length, "adversaire", "adversaires");
  };
  recherche.addEventListener("input", filtrerLignes);
  filtrerLignes();
  rafraichir();
  // La composition gardée se lit à la première visite, sans que l'écran
  // l'attende : il se rafraîchit quand elle arrive, si elle change quelque
  // chose.
  charger(contexte, services).then((change) => {
    if (change) rafraichir();
  });

  // Tout ce qui n'est pas une carte reste à l'écran : à l'impression,
  // seules les cartes sortent.
  return el(
    "section",
    { classe: "rencontre" },
    el(
      "div",
      { classe: "ne-pas-imprimer" },
      titre("Rencontre"),
      el("label", { for: "recherche-rencontre" }, "Rechercher parmi les adversaires"),
      recherche,
      trouves,
      liste,
      // La liste d'un vrai classeur est longue : le compte des cartes et
      // « Imprimer / PDF » restent au bas de l'écran pendant qu'on la parcourt.
      el("div", { classe: "barre-rencontre" }, bilan, imprimer),
      detail,
      signalement,
      // Le mode d'emploi vient après la liste : sur un téléphone, placé en
      // tête, il poussait les boutons + sous le pli (relecture du lot 3).
      el(
        "p",
        { classe: "secondaire-texte" },
        `L'Atelier imprime une carte par exemplaire, numérotée dès qu'il y en a plus d'une du même adversaire. Jusqu'à ${PLAFOND_EXEMPLAIRES} exemplaires d'un adversaire, et ${PLAFOND_CARTES} cartes en tout. La composition est gardée sur cet appareil, chiffrée, jusqu'à « Vider la rencontre ».`,
      ),
      el("div", { classe: "boutons" }, boutonVider),
      el("p", { classe: "lien-retour" }, el("a", { href: adresseListe("adversaires") }, "Tous les adversaires")),
      el("h2", {}, "Aperçu"),
    ),
    cadre.noeud,
  );
}
