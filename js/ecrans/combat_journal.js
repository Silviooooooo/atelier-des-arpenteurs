// Le journal du combat et le bandeau « Dernier événement », à l'écran
// (SPECIFICATION.md, § 17, « Le simulateur de combat (lot 4) », § 17.7 et
// § 17.9 ; contrat du lot 4, groupe 2, § 3.1, § 8.7 et § 9.8 ; complément,
// § 4.4 et § 4.8).
//
// Chaque ligne du journal naît en segments typés (js/combat/journal.js) :
// qui agit, la capacité, la cible, les dés d'un jet, la lettre des dégâts, la
// mort… Ce module en fait des nœuds, et rien d'autre : il colore par le type
// d'un segment, encadre par son jet, garde un dé d'un seul tenant par son
// numéro, coupe le bandeau par ses phrases, et barre par les plages des
// lignes « Annulé ». Il ne relit jamais le texte d'une ligne pour y chercher
// un nom : un nom est une donnée hostile, qui peut porter « contre », « ✓ »
// ou « […] ». Tout texte passe par el() ; aucun style n'est écrit, seulement
// des classes (css/combat.css). Aucune espace insécable n'entre dans la page :
// un copier à la main redonne le texte.
//
// Ce qu'il fait :
// - ligneEnNoeuds(ligne) : les nœuds d'une ligne (une LigneVue de
//   js/combat/lecture.js) ; leur texte est celui de la ligne ;
// - creerListe({ vueJournal }) : la liste du journal, qui ne pose que les
//   lignes neuves, barre celles d'un geste annulé, et se repose en entier
//   pour un autre journal ;
// - creerBandeau({ montrerLeJournal, tient, surveiller }) : le bandeau, au
//   plus trois lignes, coupé par couperLaLigne(ligne, essayer), qui ne sait
//   rien de la page : essayer(morceaux) dit si des morceaux tiennent.
//
// La mesure vient de l'écran (tient : la hauteur du texte contre trois fois
// son interligne ; dans les contrôles, un budget de signes) ; la coupe se
// refait à chaque ligne neuve et quand la largeur du texte change.
// montrerLeJournal() est à l'écran : c'est lui qui fait voir le journal.

import { el, sansSensForce } from "./dom.js";

const ETIQUETTE = "Dernier événement";
// Les signes s'écrivent par leur code : « ↓ », « … ».
const VERS_LE_JOURNAL = `Journal ${String.fromCodePoint(0x2193)}`;
// « … » : la fin coupée de la première phrase ; « […] » : une suite de
// phrases ôtées.
const POINTS = String.fromCodePoint(0x2026);
const COUPE = `[${POINTS}]`;
const ESPACE = " ";

// La classe de chaque type de segment qui se colore ; tout autre type est du
// texte. Le nom de qui agit et celui de la cible prennent la couleur de leur
// camp.
const CLASSES = Object.freeze({
  capacite: "combat-seg-capacite",
  reussi: "combat-seg-reussite",
  echoue: "combat-seg-echec",
  lettre: "combat-seg-valeur",
  ajuste: "combat-seg-valeur",
  mort: "combat-mort",
  fin_de_tour: "combat-seg-fin",
  tour: "combat-seg-tour",
});
const CAMPS = Object.freeze({ pj: "combat-seg-pj", adv: "combat-seg-adv" });
const NOMS = new Set(["acteur", "cible"]);

// ─── Une ligne en nœuds ─────────────────────────────────────────────────────

// Un nœud texte, fabriqué par el() comme tout texte de la page.
function noeudTexte(texte) {
  const noeud = el("span", {}, texte).childNodes[0];
  noeud.remove();
  return noeud;
}

const texteDuSegment = (segment) => (typeof segment?.texte === "string" ? segment.texte : "");

function classeDuSegment(segment) {
  if (NOMS.has(segment.type)) return Object.hasOwn(CAMPS, segment.camp) ? CAMPS[segment.camp] : null;
  return Object.hasOwn(CLASSES, segment.type) ? CLASSES[segment.type] : null;
}

function segmentEnNoeud(segment) {
  const classe = classeDuSegment(segment);
  return classe === null ? noeudTexte(texteDuSegment(segment)) : el("span", { classe }, texteDuSegment(segment));
}

const dansUnCadre = (segment) => Number.isInteger(segment?.jet);
const dansUnDe = (segment) => dansUnCadre(segment) && Number.isInteger(segment.de);

// Les segments d'un cadre : chaque dé d'un seul tenant, les séparateurs entre
// eux.
function desEnNoeuds(segments) {
  const noeuds = [];
  for (let i = 0; i < segments.length; ) {
    if (!dansUnDe(segments[i])) {
      noeuds.push(segmentEnNoeud(segments[i]));
      i += 1;
      continue;
    }
    const de = segments[i].de;
    const dedans = [];
    for (; i < segments.length && dansUnDe(segments[i]) && segments[i].de === de; i += 1) dedans.push(segmentEnNoeud(segments[i]));
    noeuds.push(el("span", { classe: "combat-de-insecable" }, dedans));
  }
  return noeuds;
}

// Des segments en nœuds : ceux qui se suivent dans un même jet entourés de
// leur cadre.
function segmentsEnNoeuds(segments) {
  const noeuds = [];
  for (let i = 0; i < segments.length; ) {
    if (!dansUnCadre(segments[i])) {
      noeuds.push(segmentEnNoeud(segments[i]));
      i += 1;
      continue;
    }
    const jet = segments[i].jet;
    const dedans = [];
    for (; i < segments.length && dansUnCadre(segments[i]) && segments[i].jet === jet; i += 1) dedans.push(segments[i]);
    noeuds.push(el("span", { classe: "combat-cadre-jet" }, desEnNoeuds(dedans)));
  }
  return noeuds;
}

/**
 * Les nœuds d'une ligne du journal (une LigneVue) : un nœud texte pour un
 * segment « texte », « suite » ou d'un type inconnu ; un span de sa classe
 * pour les autres (combat-seg-pj ou -adv selon le camp de qui agit et de la
 * cible, combat-seg-capacite, -reussite, -echec, -valeur, -fin, -tour,
 * combat-mort). Les segments d'un même jet sont dans span.combat-cadre-jet,
 * et ceux d'un même dé, dans span.combat-de-insecable. Leur texte est celui
 * de la ligne ; il n'est jamais relu.
 */
export function ligneEnNoeuds(ligne) {
  return Array.isArray(ligne?.segments) ? segmentsEnNoeuds(ligne.segments) : [];
}

// ─── La liste du journal ────────────────────────────────────────────────────

function ajouterLaClasse(noeud, classe) {
  const classes = noeud.className.split(/\s+/).filter((nom) => nom !== "");
  if (!classes.includes(classe)) noeud.className = [...classes, classe].join(" ");
}

const classesDeLaLigne = (ligne) => [ligne.genre === "tour" ? "tour" : null, ligne.barree === true ? "combat-annulee" : null].filter((classe) => classe !== null).join(" ") || null;

/**
 * La liste du journal, ol.combat-lignes. rendre(etat) pose les lignes neuves
 * (vueJournal(etat, lignes déjà posées)), barre les lignes déjà posées
 * qu'une ligne « Annulé » neuve couvre de sa plage [début, fin), puis montre
 * la dernière ligne ; un autre journal (son premier ou son dernier objet posé
 * a changé) se repose en entier. Rend { ajoutees, reposee }.
 */
export function creerListe({ vueJournal }) {
  const noeud = el("ol", { classe: "combat-lignes", tabindex: "0", "aria-label": "Journal du combat" });
  // Les lignes posées, dans l'ordre : leur li et leur genre ; puis le premier
  // et le dernier objet du journal qu'elles montrent.
  let posees = [];
  let premiere = null;
  let derniere = null;

  function barrer(barre, depuis) {
    if (!Array.isArray(barre)) return;
    for (let rang = Math.max(0, barre[0]); rang < Math.min(barre[1], depuis); rang += 1) {
      if (posees[rang] && posees[rang].genre !== "annule") ajouterLaClasse(posees[rang].li, "combat-annulee");
    }
  }

  function rendre(etat) {
    const journal = etat?.journal ?? [];
    const combien = posees.length;
    const suite = journal.length >= combien && (combien === 0 || (journal[0] === premiere && journal[combien - 1] === derniere));
    if (!suite) {
      noeud.replaceChildren();
      posees = [];
    }
    const depuis = posees.length;
    let ajoutees = 0;
    if (journal.length > depuis) {
      const { lignes } = vueJournal(etat, depuis);
      for (const ligne of lignes) {
        const li = el("li", { classe: classesDeLaLigne(ligne) }, ligneEnNoeuds(ligne));
        noeud.append(li);
        posees.push({ li, genre: ligne.genre });
        ajoutees += 1;
      }
      for (const ligne of lignes) barrer(ligne.barre, depuis);
    }
    premiere = journal[0] ?? null;
    derniere = journal[posees.length - 1] ?? null;
    // La dernière ligne reste visible : la liste défile en elle-même, jamais
    // la page.
    if (ajoutees > 0 || !suite) noeud.scrollTop = noeud.scrollHeight;
    return { ajoutees, reposee: !suite };
  }

  return { noeud, rendre };
}

// ─── La coupe ───────────────────────────────────────────────────────────────

// Les morceaux d'une ligne qui garde les phrases « gardees » (rangs
// croissants) : chaque suite de phrases ôtées devient une coupe.
function enMorceaux(gardees, n) {
  const morceaux = [];
  let attendue = 0;
  for (const phrase of gardees) {
    if (phrase > attendue) morceaux.push({ coupe: true });
    morceaux.push({ phrase });
    attendue = phrase + 1;
  }
  if (attendue < n) morceaux.push({ coupe: true });
  return morceaux;
}

const rangs = (debut, fin) => Array.from({ length: Math.max(0, fin - debut) }, (_, k) => debut + k);

const segmentsDeLaPhrase = (ligne, phrase) => (Array.isArray(ligne.segments) ? ligne.segments.filter((segment) => segment.phrase === phrase) : []);

const signes = (texte) => [...texte];

// Les unités de la première phrase, que sa coupe ne sépare pas : un dé
// entier, un séparateur du cadre, ou un segment hors du cadre. Seul un
// segment hors du cadre se coupe encore : un texte par ses mots, un nom par
// ses points de code.
function unitesDe(segments) {
  const unites = [];
  for (let i = 0; i < segments.length; ) {
    const segment = segments[i];
    if (dansUnDe(segment)) {
      const dedans = [];
      for (; i < segments.length && dansUnDe(segments[i]) && segments[i].jet === segment.jet && segments[i].de === segment.de; i += 1) dedans.push(segments[i]);
      unites.push({ segments: dedans, coupure: null });
      continue;
    }
    const coupure = dansUnCadre(segment) ? null : segment.type === "texte" ? "mots" : NOMS.has(segment.type) || segment.type === "capacite" ? "signes" : null;
    unites.push({ segments: [segment], coupure });
    i += 1;
  }
  return unites.map((unite) => ({ ...unite, longueur: signes(unite.segments.map(texteDuSegment).join("")).length }));
}

// Où une unité peut se couper, en signes depuis son début, dans l'ordre :
// après chaque mot d'un texte, après chaque point de code d'un nom.
function coupuresDe(unite) {
  const lettres = signes(texteDuSegment(unite.segments[0]));
  if (unite.coupure === "signes") return rangs(1, lettres.length);
  if (unite.coupure !== "mots") return [];
  const blanc = (signe) => /\s/u.test(signe);
  return rangs(1, lettres.length).filter((p) => !blanc(lettres[p - 1]) && blanc(lettres[p]));
}

// Le plus grand rang, de 0 à nombre − 1, dont l'essai tient, en supposant
// qu'un morceau plus long ne tient pas mieux ; −1 si aucun ne tient.
function dernierQuiTient(nombre, tient) {
  let bas = 0;
  let haut = nombre - 1;
  let trouve = -1;
  while (bas <= haut) {
    const milieu = Math.floor((bas + haut) / 2);
    if (tient(milieu)) {
      trouve = milieu;
      bas = milieu + 1;
    } else {
      haut = milieu - 1;
    }
  }
  return trouve;
}

// La première phrase coupée par « … », suivie du « reste » (les coupes et la
// phrase du jet) : la plus longue qui tient, en unités entières, puis dans
// l'unité suivante. Si rien ne tient, rien n'en reste, et la feuille rogne.
function couperLaPremiere(ligne, reste, essayer) {
  const unites = unitesDe(segmentsDeLaPhrase(ligne, 0));
  const debuts = [];
  let somme = 0;
  for (const unite of unites) {
    debuts.push(somme);
    somme += unite.longueur;
  }
  const essai = (jusqua) => essayer([{ phrase: 0, jusqua }, ...reste]);
  const entieres = dernierQuiTient(unites.length, (m) => essai(debuts[m]));
  if (entieres === -1) return [{ phrase: 0, jusqua: 0 }, ...reste];
  const coupures = coupuresDe(unites[entieres]);
  const dedans = dernierQuiTient(coupures.length, (k) => essai(debuts[entieres] + coupures[k]));
  return [{ phrase: 0, jusqua: debuts[entieres] + (dedans === -1 ? 0 : coupures[dedans]) }, ...reste];
}

/**
 * La coupe d'une ligne en trois lignes au plus (complément, § 4.4), par ses
 * phrases : essayer(morceaux) dit si des morceaux tiennent. Toutes, si elles
 * tiennent ; sinon la première phrase et celle du jet, puis, en partant de la
 * fin, autant des phrases suivantes qu'il en tient. Si la première et le jet
 * ne tiennent pas ensemble, la première se coupe par « … ».
 *
 * Morceau = { phrase } | { coupe: true } (une suite de phrases ôtées,
 * « […] ») | { phrase: 0, jusqua } (la première, coupée après « jusqua »
 * points de code, jamais dans un dé).
 */
export function couperLaLigne(ligne, essayer) {
  const n = Array.isArray(ligne?.phrases) ? ligne.phrases.length : 0;
  const toutes = enMorceaux(rangs(0, n), n);
  if (n === 0 || essayer(toutes)) return toutes;
  const j = ligne.phrases.indexOf("jet");
  const garde = j > 0 ? [0, j] : [0];
  const minimum = enMorceaux(garde, n);
  if (!essayer(minimum)) return couperLaPremiere(ligne, minimum.slice(1), essayer);
  let fin = n;
  for (let k = n - 1; k >= Math.max(j, 0) + 1; k -= 1) {
    if (essayer(enMorceaux([...garde, ...rangs(k, n)], n))) fin = k;
    else break;
  }
  return enMorceaux([...garde, ...rangs(fin, n)], n);
}

// Les segments de la première phrase gardés jusqu'à « jusqua » points de
// code : les unités entières, puis le début de la suivante si elle se coupe.
function debutDeLaPremiere(ligne, jusqua) {
  const gardes = [];
  let somme = 0;
  for (const unite of unitesDe(segmentsDeLaPhrase(ligne, 0))) {
    if (somme + unite.longueur <= jusqua) {
      gardes.push(...unite.segments);
      somme += unite.longueur;
      continue;
    }
    if (somme < jusqua && unite.coupure !== null) {
      const [segment] = unite.segments;
      gardes.push({ ...segment, texte: signes(texteDuSegment(segment)).slice(0, jusqua - somme).join("") });
    }
    break;
  }
  return gardes;
}

// Les morceaux sont-ils la ligne entière ?
const entiere = (ligne, morceaux) =>
  morceaux.length === (Array.isArray(ligne.phrases) ? ligne.phrases.length : 0) && morceaux.every((morceau, rang) => morceau.phrase === rang && morceau.coupe !== true && morceau.jusqua === undefined);

// Les nœuds de morceaux d'une ligne : une espace entre deux morceaux, puis le
// « … » de la ligne en cours, toujours en dernier.
function morceauxEnNoeuds(ligne, morceaux) {
  if (entiere(ligne, morceaux)) return ligneEnNoeuds(ligne);
  const parties = [];
  for (const morceau of morceaux) {
    if (morceau.coupe === true) parties.push([el("span", { classe: "combat-bandeau-coupe" }, COUPE)]);
    else if (Number.isInteger(morceau.jusqua)) parties.push([...segmentsEnNoeuds(debutDeLaPremiere(ligne, morceau.jusqua)), noeudTexte(POINTS)]);
    else {
      const noeuds = segmentsEnNoeuds(segmentsDeLaPhrase(ligne, morceau.phrase));
      if (noeuds.length > 0) parties.push(noeuds);
    }
  }
  const suite = (Array.isArray(ligne.segments) ? ligne.segments : []).filter((segment) => segment.phrase === null && segment.type === "suite");
  return [...parties.flatMap((noeuds, rang) => (rang === 0 ? noeuds : [noeudTexte(ESPACE), ...noeuds])), ...suite.map(segmentEnNoeud)];
}

// ─── Le bandeau ─────────────────────────────────────────────────────────────

const largeurDe = (noeud) => noeud.getBoundingClientRect().width;

/**
 * Le bandeau « Dernier événement », div.combat-bandeau, caché avant le
 * lancement : son étiquette, le texte coupé (caché aux lecteurs d'écran), la
 * ligne entière (cachée à la vue), et « Journal ↓ ». Il n'est ni un bouton ni
 * une région d'annonce ; son titre porte la ligne entière.
 *
 * rendre(vue) : la vue de vueBandeau ; null le cache. Une vue inchangée ne
 * refait rien. « Journal ↓ », ou un clic à la souris sur le reste du
 * bandeau (jamais au doigt), appellent montrerLeJournal(). tient(noeud) dit
 * si le texte tient en trois lignes ; surveiller(noeud, rappel) prévient
 * quand sa taille change : la coupe se refait si sa largeur a changé.
 */
export function creerBandeau({ montrerLeJournal, tient, surveiller }) {
  const bouton = el("button", { type: "button", classe: "bouton secondaire combat-bandeau-journal", onclick: () => montrerLeJournal() }, VERS_LE_JOURNAL);
  const texte = el("div", { classe: "combat-bandeau-texte", "aria-hidden": "true" });
  const entier = el("span", { classe: "combat-bandeau-entier" });
  // L'appui du dernier pointerdown : seul un clic à la souris mène au
  // journal, un doigt qui balaie la page ne doit pas y sauter.
  let appui = null;
  const noeud = el(
    "div",
    {
      classe: "combat-bandeau",
      hidden: true,
      onpointerdown: (evenement) => {
        appui = evenement.pointerType ?? null;
      },
      onclick: (evenement) => {
        const souris = appui === "mouse";
        appui = null;
        if (bouton.contains(evenement.target)) return;
        if (souris) montrerLeJournal();
      },
    },
    el("span", { classe: "combat-bandeau-etiquette" }, ETIQUETTE),
    texte,
    entier,
    bouton,
  );

  let signature = "null";
  let montree = null;
  let largeur = null;

  function couper() {
    const ligne = montree;
    const morceaux = couperLaLigne(ligne, (essai) => {
      texte.replaceChildren(...morceauxEnNoeuds(ligne, essai));
      return tient(texte);
    });
    texte.replaceChildren(...morceauxEnNoeuds(ligne, morceaux));
    largeur = largeurDe(texte);
  }

  // Un bandeau pas encore posé dans la page garde sa surveillance ; celui qui
  // l'a quittée la perd.
  let vu = texte.isConnected === true;
  let arreter = null;
  arreter = surveiller(texte, () => {
    if (!texte.isConnected) {
      if (vu) arreter?.();
      return;
    }
    vu = true;
    const maintenant = largeurDe(texte);
    if (maintenant === largeur) return;
    largeur = maintenant;
    if (montree !== null) couper();
  });

  function rendre(vue) {
    const nouvelle = JSON.stringify(vue ?? null);
    if (nouvelle === signature) return;
    signature = nouvelle;
    if (vue === null || vue === undefined) {
      noeud.hidden = true;
      montree = null;
      return;
    }
    const { ligne } = vue;
    noeud.className = vue.enCours === true ? "combat-bandeau combat-bandeau-en-cours" : "combat-bandeau";
    noeud.setAttribute("title", sansSensForce(ligne.texte));
    entier.replaceChildren(sansSensForce(ligne.texte));
    noeud.hidden = false;
    montree = ligne;
    couper();
  }

  return { noeud, rendre };
}
