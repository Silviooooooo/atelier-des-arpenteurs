// Les menus, les feuilles et les dialogues du combat (SPECIFICATION.md, § 17,
// « Le simulateur de combat (lot 4) » ; mission du lot 4.3, § 3, § 4.1, § 4.8
// et § 5, vues A8, F1, F7, F8, F9, F13 et E4 ; contrat de la vague 3, § 4.1).
//
// Ce qu'il tient : la couche où s'ouvrent, par-dessus le combat, les entrées
// du site (☰), le menu du combat (⋯ : le Mode MJ, « Intervenir… », « Fiches »,
// « Journal », « Nouveau combat »), « Intervenir… », le menu du MJ et ses
// panneaux, la place de la palette, le journal et les fiches en plein écran,
// et la phrase d'une seconde. Il ne porte aucune règle : ce qu'il montre vient
// des vues (js/combat/lecture.js), et chaque choix rend la main à l'écran par
// « actions ».
//
// Pourquoi il existe à part : l'écran (combat.js) ne lit jamais la clé d'une
// option de vue (tests/combat_ecran.test.js) ; les saisies du menu du MJ
// (« Modifier une valeur… »), le choix d'un état et de sa durée, celui de
// l'équipement, les clés des options d'« Intervenir… » se tiennent donc ici.
// L'écran lui donne, à chaque rendu, la barre, le Mode MJ, et deux fonctions :
// menuMj(id, saisies), qui rend la vue du menu du MJ pour ces saisies (le menu
// lui rend ainsi l'objet « saisies » entier), et equipement(id), ce qu'il y a
// à changer.
//
// Une feuille, un menu et un plein écran sont chacun une section
// role="dialog" aria-modal="true", nommée par son titre : ✕ (« Fermer »),
// Échap et un appui sur le voile la ferment, et le focus revient à ce qui
// l'avait ouverte (le bouton « ⋯ », le jeton, la fiche…), sans faire défiler
// la page. Une seule s'ouvre à la fois : en ouvrir une autre depuis elle
// (« Modifier une valeur… » depuis le menu du MJ) la remplace, et garde à qui
// rendre le focus. La palette n'a ici ni tête ni pied : son nœud les porte ;
// Échap et le voile y demandent actions.fermerLaPalette(). Le journal et les
// fiches en plein écran sont des nœuds de l'écran, prêtés le temps de
// l'ouverture : « apres », à la fermeture, les lui rend.
//
// À la vague 4 (relecture finale, R2 n° 5 et 6, W1 n° 8) : modale pour de
// bon, la couche rend inerte (inert) le reste de ce qui la porte, sauf une
// région d'annonce, et Tab et Maj+Tab bouclent dans ce qui est ouvert. Elle
// garde aussi l'ancre du genre qu'une ouverture remplace : quand celle du
// nouveau n'a plus de boîte à la fermeture (« Modifier… » d'une fiche rendue
// à la page, que la feuille de style cache au téléphone), le focus va à
// elle. Sur PC, le menu du MJ et ses panneaux se posent contre ce qui les
// ouvre, à la place que l'écran calcule (placer) : seul js/ecrans/echelle.js
// écrit un style.
//
// À la vague 4 encore (relecture des correctifs, C2 et C6) : une case
// demandée à la carte depuis la palette d'une feuille efface la feuille,
// sans la fermer, le temps du choix (suspendre, reprendre) ; et le menu du
// MJ se replace quand la fenêtre change de taille (replacer).
//
// La phrase d'une seconde (genre « toast ») ne se lit pas : la région
// d'annonce de l'écran la dit déjà. Ses états sont des classes (contrat,
// § 5.2 : « change » sur un champ saisi) ; le code n'écrit jamais de mise en
// forme.

import { el, sansSensForce } from "./dom.js";

// Les signes, écrits par leur code : ✕ (fermer), − (moins), … (points),
// — (tiret), « et » (guillemets).
const SIGNES = { fermer: "\u2715", moins: "\u2212", points: "\u2026", tiret: "\u2014", ouvrant: "\u00ab", fermant: "\u00bb" };
const entreGuillemets = (texte) => `${SIGNES.ouvrant} ${texte} ${SIGNES.fermant}`;

// Les textes fixés par la mission et la maquette (contrat, § 6.1 et § 6.2).
const FERMER = "Fermer";
const ANNULER = "Annuler";
const TITRE_DU_SITE = "L'Atelier des Arpenteurs";
const TITRE_DU_COMBAT = "Le combat";
const MODE_MJ = "Mode MJ";
const MJ_ALLUME = `Allumé : la palette libre, le menu du MJ (appui long), ${entreGuillemets(`Modifier${SIGNES.points}`)}, choisir la zone, fixer les dégâts.`;
const MJ_ETEINT = `Éteint : le jeu suit ses règles ; l'effet d'une capacité s'applique par ${entreGuillemets(`Appliquer l'effet de${SIGNES.points}`)}.`;
const MJ_SE_GARDE = "Le Mode MJ est éteint par défaut, et l'appareil s'en souvient.";
const INTERVENIR_DU_MENU = "le MJ fait intervenir un adversaire";
const FICHES = "Fiches";
const JOURNAL = "Journal";
const NOUVEAU_COMBAT = "Nouveau combat";
const TITRE_D_INTERVENIR = "Intervenir";
const SOUS_D_INTERVENIR = "qui intervient ? (ceux qui ont encore une action)";
const NOTE_D_INTERVENIR = "Puis l'intervention se joue comme un geste : palette, et jet s'il le faut.";
const SOURCE_ET_DUREE = "Source et durée";
// Les textes qu'aucune source ne donne : à faire confirmer par l'auteur.
const CASE_D_ARRIVEE = "Touchez la case d'arrivée.";
const CHOISIR_UN_ETAT = "Choisissez un état.";
const SES_ETATS = "Ses états";
const ARME_TENUE = "Arme tenue";
const AUCUNE_ARME = "Aucune arme";
const QUALITES = "Qualité des objets";
const CELLULE = "Équipement";
const ENREGISTRER = "Enregistrer";
const RIEN_NE_CHANGE = "Aucune valeur ne change.";

// La phrase d'une seconde.
const UNE_SECONDE = 1000;
// Le minuteur de la page, quand l'écran n'en donne pas.
const MINUTEUR_DE_LA_PAGE = { poser: (faire, ms) => globalThis.setTimeout(faire, ms), retirer: (numero) => globalThis.clearTimeout(numero) };

// Les genres qui portent le menu du MJ : ils se ferment avec le Mode MJ, et
// quand le protagoniste n'a plus de menu (mort, retiré).
const DU_MJ = new Set(["mj", "valeurs", "etats", "equipement"]);
// Les genres d'une feuille ; les autres sont en plein écran.
const EN_PLEIN = new Set(["journal", "fiches"]);
const GENRES = new Set(["site", "combat", "intervenir", "mj", "valeurs", "etats", "equipement", "palette", "journal", "fiches", "toast"]);

const present = (valeur) => valeur !== null && valeur !== undefined;
const rempli = (texte) => present(texte) && String(texte) !== "";

/** Vrai quand « noeud » est « ancetre », ou l'un de ses descendants. */
function estDans(noeud, ancetre) {
  for (let courant = noeud; courant; courant = courant.parentNode) if (courant === ancetre) return true;
  return false;
}

/**
 * Vrai quand l'élément est dans la page et s'y voit : il a une boîte, ni lui
 * ni un ancêtre n'étant caché (par hidden ou par la feuille de style).
 */
export function aUneBoite(element) {
  if (!element?.isConnected) return false;
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}

// Ce que Tab atteint, en plus de ce qui porte un tabindex positif ou nul.
const PRENABLES = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);

/** Ce que Tab atteint sous « racine », dans l'ordre du document : ce qui se prend et se voit. */
function prenablesDans(racine) {
  const trouves = [];
  const parcourir = (parent) => {
    for (const enfant of parent.children) {
      const rang = enfant.getAttribute("tabindex");
      const prenable = rang !== null ? Number(rang) >= 0 : PRENABLES.has(enfant.tagName) && (enfant.tagName !== "A" || enfant.hasAttribute("href"));
      if (prenable && aUneBoite(enfant)) trouves.push(enfant);
      parcourir(enfant);
    }
  };
  parcourir(racine);
  return trouves;
}

/** Une région d'annonce : elle parle encore quand le reste dort sous le voile. */
const parle = (element) => element.hasAttribute("aria-live") || ["alert", "status", "log"].includes(element.getAttribute("role"));

/**
 * La couche des menus : { noeud, ouvrir(genre, options), fermer(), rendre(vues),
 * ouvert(), secours() }. « genre » : "site", "combat", "intervenir", "mj",
 * "valeurs", "etats", "equipement", "palette", "journal", "fiches", "toast".
 * « minuteur » : celui de la page, { poser(faire, ms) → numéro,
 * retirer(numéro) }. « placer(feuille, ancre) » : l'écran pose, sur PC, le
 * menu du MJ et ses panneaux contre leur ancre (echelle.js). ouvert() rend le
 * genre ouvert, ou null (la phrase d'une seconde n'en est pas un) ; secours(),
 * l'ancre du genre que l'ouvert a remplacé (null sans lui), où l'écran rend
 * le focus quand celle de la palette n'a plus de boîte. suspendre() efface
 * la feuille ouverte, sans la fermer, le temps qu'une case se choisisse sur
 * la carte, et reprendre() la rend ; replacer(), quand la fenêtre change de
 * taille, replace le menu du MJ contre son ancre.
 *
 * « actions » vient de l'écran : executer(commande, origine) (l'origine
 * « menu »), basculerLeModeMj(), ouvrirFiches(id), ouvrirJournal(),
 * demanderUnNouveauCombat(), demanderUneCase(options, rappel), dire(texte),
 * fermerLaPalette(), changerLEquipement(id, choix) → { refus } | {}.
 *
 * « options » d'ouvrir : ancre (à qui rendre le focus ; à défaut, l'élément
 * actif) ; « id » pour les genres du MJ ; « noeud » et « nom » pour la
 * palette ; « titre », « outils », « contenu » et « apres » pour un plein
 * écran (« apres » aussi pour la palette, appelé quand sa feuille se ferme
 * ou cède la place) ; « texte » pour la phrase d'une seconde. rendre(vues) reçoit
 * { barre (vueBarre), modeMj, etroit, menuMj(id, saisies), equipement(id),
 * garde (la phrase de l'enregistrement) }, en partie ou en entier, et met à
 * jour ce qui est ouvert.
 */
export function creer(actions, { minuteur = null, placer = null } = {}) {
  const leMinuteur = minuteur ?? MINUTEUR_DE_LA_PAGE;
  // Ce que l'écran a donné au dernier rendu.
  let vues = { barre: null, modeMj: false, etroit: false, menuMj: null, equipement: null, garde: null };
  // Ce qui est ouvert : son genre, ses options, à qui rendre le focus (et,
  // s'il n'a plus de boîte, l'ancre du genre remplacé), ce qu'il faut rendre
  // à l'écran en fermant.
  let genre = null;
  let options = {};
  let ancre = null;
  let ancreDeSecours = null;
  let apres = null;
  // Ce que l'ouverture a rendu inerte, sous le voile.
  let inertes = [];
  // La feuille ouverte s'est effacée le temps qu'une case se choisisse sur
  // la carte (suspendre) : rien ne l'a fermée.
  let suspendue = false;
  // Ce que le corps montre, pour ne le refaire que s'il change.
  let signature = null;
  // Les saisies de « Modifier une valeur… » : { [clé d'un champ]: valeur }.
  let saisies = {};
  // Le choix d'un état : { bloc, rang }, « libre », ou null ; le nom libre ;
  // la durée.
  let etatChoisi = null;
  let nomLibre = "";
  let duree = "tour";
  // Le choix de l'équipement : { tenue, qualites } (un personnage), ou
  // { cellule } (un adversaire) ; et le refus du dernier essai.
  let equipement = null;
  let refusDeLEquipement = null;
  // Les champs de « Modifier une valeur… », créés une fois à l'ouverture.
  let champsDesValeurs = [];
  let numero = 0;
  let toastEnCours = null;

  // ——— Les nœuds de la couche ———

  const titre = el("h2", { id: "combat-feuille-titre", tabindex: "-1" });
  const sous = el("p", { classe: "combat-sous" });
  const croix = el("button", { type: "button", classe: "bouton secondaire", "aria-label": FERMER, "data-repere": "fermer", onclick: () => fermer() }, SIGNES.fermer);
  const tete = el("div", { classe: "combat-feuille-tete" }, titre, sous, croix);
  const corps = el("div", { classe: "combat-feuille-corps" });
  const pied = el("div", { classe: "combat-feuille-pied" });
  // La feuille prend elle-même le focus d'un clic sur ce qui ne le prend pas (sa
  // phrase, sa marge) : il restait sur main#ecran, hors d'elle, et Échap ne la
  // fermait plus (mesuré dans Edge, vague 4, M). Hors de l'ordre de Tab.
  const feuille = el("section", { classe: "combat-feuille", role: "dialog", "aria-modal": "true", "aria-labelledby": "combat-feuille-titre", tabindex: "-1", hidden: true }, tete, corps, pied);

  const titreDuPlein = el("h2", { id: "combat-plein-titre", tabindex: "-1" });
  const outilsDuPlein = el("span", {});
  const croixDuPlein = el("button", { type: "button", classe: "bouton secondaire", "aria-label": FERMER, "data-repere": "fermer", onclick: () => fermer() }, SIGNES.fermer);
  const teteDuPlein = el("div", { classe: "combat-plein-tete" }, titreDuPlein, outilsDuPlein, croixDuPlein);
  // Le plein écran de même : un clic sur le texte d'une fiche (un details,
  // hors de son summary) portait le focus sur main#ecran (relecture finale, R7).
  const plein = el("section", { classe: "combat-plein", role: "dialog", "aria-modal": "true", "aria-labelledby": "combat-plein-titre", tabindex: "-1", hidden: true }, teteDuPlein);

  // Un appui sur le voile n'y porte pas le focus (mousedown empêché) : l'appui
  // long qui ouvre un menu sous le doigt le laisse dans la feuille (vague 4, M).
  const voile = el("div", { classe: "combat-voile", hidden: true, onclick: () => echap(), onmousedown: (evenement) => evenement.preventDefault() });
  const toast = el("p", { classe: "combat-toast", "aria-hidden": "true", hidden: true });
  const noeud = el(
    "div",
    {
      onkeydown: (evenement) => {
        if (genre === null || evenement?.defaultPrevented) return;
        if (evenement.key === "Tab") {
          boucler(evenement);
          return;
        }
        if (evenement.key !== "Escape") return;
        evenement.preventDefault?.();
        echap();
      },
    },
    voile,
    feuille,
    plein,
    toast,
  );

  // ——— Les petits outils ———

  /** Un bouton, actif ou inactif (aria-disabled, sa raison liée et dite à côté). */
  function bouton({ texte, contenu = null, classe = "bouton secondaire", actif = true, raison = null, repere = null, faire, attributs = {} }) {
    numero += 1;
    const idRaison = !actif && rempli(raison) ? `combat-menu-raison-${numero}` : null;
    const noeudBouton = el(
      "button",
      {
        type: "button",
        classe,
        "data-repere": repere,
        "aria-disabled": actif ? null : "true",
        "aria-describedby": idRaison,
        ...attributs,
        onclick: () => {
          if (noeudBouton.getAttribute("aria-disabled") === "true") return;
          faire(noeudBouton);
        },
      },
      contenu ?? texte,
    );
    return idRaison ? [noeudBouton, el("span", { id: idRaison, classe: "combat-raison" }, raison)] : [noeudBouton];
  }

  /** Une ligne de menu : son libellé, et ce qu'elle fait en petit. */
  const ligne = ({ libelle, texte = null, ...reste }) =>
    el("li", {}, bouton({ classe: "combat-menu-ligne", contenu: [el("span", {}, libelle), rempli(texte) ? el("span", {}, texte) : null], ...reste }));

  const menu = (lignes) => el("ul", { classe: "combat-menu" }, lignes.filter(present));
  const paragraphe = (texte) => (rempli(texte) ? el("p", {}, texte) : null);

  // Le menu du MJ de qui est ouvert, pour ces saisies ; null s'il n'en a pas.
  const vueDuMj = () => (typeof vues.menuMj === "function" && present(options.id) ? (vues.menuMj(options.id, genre === "valeurs" ? { ...saisies } : null) ?? null) : null);

  // ——— Ce que chaque genre montre ———

  // ☰ : les liens de la navigation du site, relus à chaque ouverture.
  function composerLeSite() {
    const liens = [...(globalThis.document?.querySelectorAll?.(".navigation a[data-route]") ?? [])].filter((lien) => String(lien.getAttribute("href") ?? "").startsWith("#/"));
    const lignes = liens.map((lien) =>
      el(
        "li",
        {},
        el(
          "a",
          {
            href: lien.getAttribute("href"),
            classe: "combat-menu-ligne",
            "data-repere": `site-${lien.getAttribute("data-route")}`,
            "aria-current": lien.getAttribute("aria-current"),
            onclick: () => fermer({ focus: false }),
          },
          lien.textContent,
        ),
      ),
    );
    return { titre: TITRE_DU_SITE, sous: null, corps: [el("nav", { "aria-label": TITRE_DU_SITE }, menu(lignes))], pied: [], signature: liens.map((lien) => [lien.getAttribute("href"), lien.textContent, lien.getAttribute("aria-current")]) };
  }

  // ⋯ : le combat (F13).
  function composerLeCombat() {
    const barre = vues.barre ?? {};
    const allume = vues.modeMj === true;
    const interrupteur = el(
      "button",
      {
        type: "button",
        role: "switch",
        classe: "combat-interrupteur",
        "aria-checked": String(allume),
        "aria-labelledby": "combat-menu-mj-libelle",
        "aria-describedby": "combat-menu-mj-phrase",
        "data-repere": "mode-mj",
        onclick: () => actions.basculerLeModeMj?.(),
      },
      el("span", { id: "combat-menu-mj-libelle" }, MODE_MJ),
      el("span", { id: "combat-menu-mj-phrase" }, allume ? MJ_ALLUME : MJ_ETEINT),
    );
    const intervenir = barre.intervenir?.place === "menu" ? barre.intervenir : null;
    const lignes = [
      intervenir
        ? ligne({ libelle: intervenir.libelle, texte: INTERVENIR_DU_MENU, actif: intervenir.actif === true, raison: intervenir.raison, repere: "intervenir", faire: () => ouvrir("intervenir") })
        : null,
      ligne({ libelle: FICHES, repere: "fiches", faire: () => actions.ouvrirFiches?.(null) }),
      ligne({ libelle: JOURNAL, repere: "journal", faire: () => actions.ouvrirJournal?.() }),
      ligne({ libelle: NOUVEAU_COMBAT, repere: "nouveau", faire: () => nouveauCombat() }),
    ];
    // En tête, l'état de l'enregistrement (« Combat gardé sur cet appareil »),
    // que la barre du téléphone ne montre plus (W1 n° 14).
    return {
      titre: TITRE_DU_COMBAT,
      sous: barre.etatCourt ?? null,
      corps: [paragraphe(vues.garde), interrupteur, menu(lignes), el("p", {}, MJ_SE_GARDE)],
      pied: [],
      signature: [barre.etatCourt ?? null, allume, intervenir, vues.garde ?? null],
    };
  }

  // « Nouveau combat » pose sa question dans la barre : la feuille se ferme
  // d'abord, et le focus revient à « ⋯ », que la question reprendra.
  function nouveauCombat() {
    fermer();
    actions.demanderUnNouveauCombat?.();
  }

  // « Intervenir… » (F1) : qui intervient, puis son intervention. Un appui
  // ferme la feuille, puis joue la commande : le geste d'intervention s'ouvre.
  function composerIntervenir() {
    const vue = vues.barre?.intervenir ?? null;
    if (vue === null) return null;
    const groupes = (vue.intervenants ?? []).map((intervenant) =>
      el(
        "li",
        {},
        el("h3", {}, [intervenant.initiales, intervenant.nom, intervenant.sous].filter(rempli).join(" \u00b7 ")),
        el(
          "ul",
          { classe: "combat-menu" },
          (intervenant.options ?? []).map((option) =>
            ligne({
              libelle: option.libelle,
              texte: [option.texte, option.cout].filter(rempli).join(" \u00b7 "),
              actif: vue.actif === true && option.actif === true,
              raison: vue.actif === true ? option.raison : vue.raison,
              attributs: { "data-cle": option.cle },
              faire: () => {
                fermer({ focus: false });
                actions.executer?.(option.commande, "menu");
              },
            }),
          ),
        ),
      ),
    );
    return {
      titre: TITRE_D_INTERVENIR,
      sous: SOUS_D_INTERVENIR,
      corps: [vue.actif === true ? null : paragraphe(vue.raison), el("ul", { classe: "combat-menu" }, groupes), el("p", {}, NOTE_D_INTERVENIR)],
      pied: [],
      signature: vue,
    };
  }

  // Le menu du MJ d'un protagoniste (F7).
  function composerLeMenuDuMj() {
    const vue = vueDuMj();
    if (vue === null) return null;
    const actifs = (entree) => vue.actif === true && entree.actif === true;
    const raisonDe = (entree) => (vue.actif === true ? entree.raison : vue.raison);
    const entree = (cle, faire) => {
      const donnee = vue[cle];
      return donnee ? ligne({ libelle: donnee.libelle, texte: donnee.texte, actif: actifs(donnee), raison: raisonDe(donnee), repere: `mj-${cle}`, faire }) : null;
    };
    const lignes = [
      entree("valeurs", () => ouvrir("valeurs", { id: options.id })),
      entree("equipement", () => ouvrir("equipement", { id: options.id })),
      entree("etats", () => ouvrir("etats", { id: options.id })),
      entree("deplacer", () => deplacer(vue)),
      entree("retirer", () => {
        fermer();
        actions.executer?.(vue.retirer.commande, "menu");
      }),
    ];
    return {
      titre: vue.titre,
      sous: vue.sous,
      corps: [vue.actif === true ? null : paragraphe(vue.raison), menu(lignes), paragraphe(vue.note)],
      pied: [],
      signature: vue,
    };
  }

  // « Déplacer sans action… » : la feuille se ferme, la carte demande la case
  // d'arrivée, nommée pour chaque case ; un appui joue le déplacement.
  function deplacer(vue) {
    const { deplacer: donnee, titre: nom } = vue;
    fermer();
    actions.demanderUneCase?.(
      { exclue: donnee.exclue ?? null, nommer: (nomDeCase) => `Case ${nomDeCase} : y déplacer ${sansSensForce(nom)}` },
      (nomDeCase) => actions.executer?.({ evenement: { ...donnee.gabarit.evenement, vers: nomDeCase } }, "menu"),
    );
    actions.dire?.(CASE_D_ARRIVEE);
  }

  // « Modifier une valeur… » (F8) : les champs se créent une fois, à
  // l'ouverture ; ce qui suit une saisie (l'aperçu, « Enregistrer », la
  // marque « change ») se met à jour sur place, sans ôter le focus.
  function composerLesValeurs() {
    const vue = vueDuMj();
    if (vue === null || !vue.valeurs) return null;
    const { valeurs } = vue;
    if (champsDesValeurs.length === 0) champsDesValeurs = (valeurs.champs ?? []).map((champ) => champDeValeur(champ, valeurs.actif === true && vue.actif === true));
    const apercu = el("p", { classe: "combat-palette-apercu", "data-repere": "apercu" });
    const enregistrer = el("span", { "data-repere": "enregistrer-place" });
    return {
      titre: valeurs.titre,
      sous: valeurs.sous,
      corps: [vue.actif === true ? null : paragraphe(vue.raison), champsDesValeurs.map(({ noeud: rangee }) => rangee), apercu],
      pied: [bouton({ texte: ANNULER, repere: "annuler", faire: () => fermer() }), enregistrer],
      signature: "valeurs",
      apres: () => mettreAJourLesValeurs(),
    };
  }

  function champDeValeur(champ, actif) {
    numero += 1;
    const id = `combat-menu-champ-${numero}`;
    const saisie = el("input", {
      id,
      type: "number",
      classe: "champ",
      inputmode: "numeric",
      min: String(champ.min ?? 0),
      max: String(champ.max ?? 999),
      "data-repere": `valeur-${champ.cle}`,
      "aria-disabled": actif ? null : "true",
      readonly: actif ? null : true,
      oninput: () => saisir(champ, saisie.value),
    });
    saisie.value = String(champ.valeur ?? "");
    const pas = (sens) =>
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          "aria-label": `${sens < 0 ? "Moins" : "Plus"} : ${sansSensForce(champ.libelle)}`,
          "aria-disabled": actif ? null : "true",
          onclick: () => {
            if (!actif) return;
            const lu = Number.parseInt(saisie.value, 10);
            const suivant = Math.min(champ.max ?? 999, Math.max(champ.min ?? 0, (Number.isInteger(lu) ? lu : (champ.valeur ?? 0)) + sens));
            saisie.value = String(suivant);
            saisir(champ, saisie.value);
          },
        },
        sens < 0 ? SIGNES.moins : "+",
      );
    const rangee = el(
      "div",
      { classe: "combat-champ-mj" },
      el("label", { for: id }, el("span", {}, champ.libelle), rempli(champ.sous) ? el("span", {}, champ.sous) : null),
      pas(-1),
      saisie,
      pas(1),
    );
    return { champ, noeud: rangee, saisie };
  }

  // Une saisie lue : un entier entre les bornes compte ; sinon, la valeur
  // d'origine. La vue juge le reste (« Aucune valeur ne change. »).
  function saisir(champ, texte) {
    const lu = /^\d+$/.test(String(texte).trim()) ? Number.parseInt(texte, 10) : null;
    if (lu === null || lu < (champ.min ?? 0) || lu > (champ.max ?? 999) || lu === champ.valeur) delete saisies[champ.cle];
    else saisies[champ.cle] = lu;
    mettreAJourLesValeurs();
  }

  function mettreAJourLesValeurs() {
    if (genre !== "valeurs") return;
    const vue = vueDuMj();
    if (vue === null) return;
    for (const { champ, noeud: rangee } of champsDesValeurs) {
      const classe = Object.hasOwn(saisies, champ.cle) ? "combat-champ-mj change" : "combat-champ-mj";
      if (rangee.className !== classe) rangee.className = classe;
    }
    const apercu = corps.querySelector("[data-repere=apercu]");
    if (apercu) {
      const texte = sansSensForce(vue.valeurs.apercu ?? "");
      if (apercu.textContent !== texte) apercu.textContent = texte;
      apercu.hidden = texte === "";
    }
    const place = pied.querySelector("[data-repere=enregistrer-place]");
    const donnee = vue.valeurs.enregistrer ?? { libelle: ENREGISTRER, actif: false, raison: RIEN_NE_CHANGE, commande: null };
    const etat = JSON.stringify([donnee.libelle, donnee.actif, donnee.raison]);
    if (place && place.getAttribute("data-etat") !== etat) {
      const avait = estDans(globalThis.document?.activeElement ?? null, place);
      place.setAttribute("data-etat", etat);
      place.replaceChildren(
        ...bouton({
          texte: donnee.libelle ?? ENREGISTRER,
          classe: "bouton",
          actif: donnee.actif === true && present(donnee.commande),
          raison: donnee.raison,
          repere: "enregistrer",
          faire: () => enregistrerLesValeurs(),
        }),
      );
      if (avait) place.querySelector("button")?.focus({ preventScroll: true });
    }
  }

  // « Enregistrer » relit la vue au moment de l'appui, jamais celle d'avant.
  function enregistrerLesValeurs() {
    const commande = vueDuMj()?.valeurs?.enregistrer?.commande ?? null;
    if (commande === null) return;
    fermer();
    actions.executer?.(commande, "menu");
  }

  // « Ajouter ou retirer un état… » (F9) : un état du classeur, ou un état
  // libre, puis sa durée ; « Appliquer {état} » joue l'ajout, la durée
  // complétée (« tour » par défaut). Les états portés se retirent ici aussi.
  function composerLesEtats() {
    const vue = vueDuMj();
    if (vue === null || !vue.etats) return null;
    const { etats } = vue;
    const ouvert = vue.actif === true && etats.actif === true;
    const raisonDuMenu = vue.actif === true ? etats.raison : vue.raison;
    const groupes = (etats.blocs ?? []).map((bloc, rangDuBloc) =>
      el(
        "div",
        { role: "group", "aria-label": bloc.titre },
        el("h3", {}, bloc.titre),
        el(
          "ul",
          { classe: "combat-menu" },
          (bloc.options ?? []).map((option, rang) =>
            ligne({
              libelle: option.libelle,
              texte: option.texte,
              actif: ouvert && option.actif === true,
              raison: ouvert ? option.raison : raisonDuMenu,
              repere: `etat-${rangDuBloc}-${rang}`,
              attributs: { "aria-pressed": String(etatChoisi?.bloc === rangDuBloc && etatChoisi?.rang === rang) },
              faire: () => {
                etatChoisi = { bloc: rangDuBloc, rang };
                mettreAJourLePiedDesEtats();
              },
            }),
          ),
        ),
      ),
    );
    const libre = etats.libre ?? null;
    numero += 1;
    const idLibre = `combat-menu-libre-${numero}`;
    const champLibre = libre
      ? el("input", {
          id: idLibre,
          type: "text",
          classe: "champ",
          maxlength: String(libre.max ?? 40),
          "data-repere": "etat-libre",
          "aria-disabled": ouvert && libre.actif === true ? null : "true",
          readonly: ouvert && libre.actif === true ? null : true,
          oninput: () => {
            nomLibre = champLibre.value;
            etatChoisi = nomLibre.trim() === "" ? null : "libre";
            mettreAJourLePiedDesEtats();
          },
        })
      : null;
    if (champLibre) champLibre.value = nomLibre;
    const durees = (etats.durees ?? []).map((laDuree) =>
      bouton({
        texte: laDuree.libelle,
        repere: `duree-${laDuree.valeur}`,
        attributs: { "aria-pressed": String(duree === laDuree.valeur) },
        faire: () => {
          duree = laDuree.valeur;
          mettreAJourLePiedDesEtats();
        },
      }),
    );
    const portes = (etats.portes ?? []).map((porte, rang) =>
      bouton({
        texte: `Retirer l'état ${porte.libelle}`,
        actif: vue.actif === true && porte.actif === true,
        raison: vue.actif === true ? porte.raison : vue.raison,
        repere: `retirer-${rang}`,
        faire: () => {
          fermer();
          actions.executer?.(porte.commande, "menu");
        },
      }),
    );
    return {
      titre: etats.titre,
      sous: etats.sous,
      corps: [
        vue.actif === true ? null : paragraphe(vue.raison),
        groupes,
        libre ? el("div", { role: "group", "aria-labelledby": `${idLibre}-titre` }, el("h3", { id: `${idLibre}-titre` }, el("label", { for: idLibre }, libre.libelle)), champLibre, paragraphe(libre.aide)) : null,
        el("div", { role: "group", "aria-labelledby": `${idLibre}-duree` }, el("h3", { id: `${idLibre}-duree` }, SOURCE_ET_DUREE), paragraphe(etats.source), durees),
        portes.length ? el("div", { role: "group", "aria-labelledby": `${idLibre}-portes` }, el("h3", { id: `${idLibre}-portes` }, SES_ETATS), portes) : null,
      ],
      pied: [bouton({ texte: ANNULER, repere: "annuler", faire: () => fermer() }), el("span", { "data-repere": "appliquer-place" })],
      signature: [vue.etats, vue.actif],
      apres: () => mettreAJourLePiedDesEtats(),
    };
  }

  // Le choix d'un état et sa durée se marquent sur place (aria-pressed) :
  // refaire le corps ôterait le focus au nom libre en cours de saisie.
  function marquerLesEtats() {
    for (const element of corps.querySelectorAll("[aria-pressed]")) {
      const repere = element.getAttribute("data-repere") ?? "";
      let presse = null;
      if (repere.startsWith("etat-")) {
        const [bloc, rang] = repere.slice("etat-".length).split("-").map(Number);
        presse = etatChoisi !== null && etatChoisi !== "libre" && etatChoisi.bloc === bloc && etatChoisi.rang === rang;
      } else if (repere.startsWith("duree-")) presse = repere === `duree-${duree}`;
      if (presse !== null && element.getAttribute("aria-pressed") !== String(presse)) element.setAttribute("aria-pressed", String(presse));
    }
  }

  // L'option choisie, relue dans la vue du moment ; null sans choix.
  function etatDuMoment() {
    const etats = vueDuMj()?.etats ?? null;
    if (etats === null) return null;
    if (etatChoisi === "libre") {
      const nom = nomLibre.trim();
      if (nom === "" || !etats.libre) return null;
      const { evenement } = etats.libre.gabarit;
      return { nom, actif: etats.libre.actif === true, raison: etats.libre.raison, commande: { evenement: { ...evenement, ajout: { ...evenement.ajout, libre: nom, duree } } } };
    }
    const option = etatChoisi === null ? null : (etats.blocs?.[etatChoisi.bloc]?.options?.[etatChoisi.rang] ?? null);
    if (option === null) return null;
    const { evenement } = option.gabarit;
    return { nom: option.libelle, actif: option.actif === true, raison: option.raison, commande: { evenement: { ...evenement, ajout: { ...evenement.ajout, duree } } } };
  }

  function mettreAJourLePiedDesEtats() {
    if (genre !== "etats") return;
    const vue = vueDuMj();
    const place = pied.querySelector("[data-repere=appliquer-place]");
    if (vue === null || !place) return;
    marquerLesEtats();
    const choix = etatDuMoment();
    const ouvert = vue.actif === true && vue.etats?.actif === true;
    const actif = ouvert && choix !== null && choix.actif;
    const raison = !ouvert ? (vue.actif === true ? vue.etats?.raison : vue.raison) : choix === null ? CHOISIR_UN_ETAT : choix.raison;
    const texte = choix === null ? "Appliquer" : `Appliquer ${choix.nom}`;
    const etat = JSON.stringify([texte, actif, raison]);
    if (place.getAttribute("data-etat") === etat) return;
    const avait = estDans(globalThis.document?.activeElement ?? null, place);
    place.setAttribute("data-etat", etat);
    place.replaceChildren(
      ...bouton({
        texte,
        classe: "bouton",
        actif,
        raison,
        repere: "appliquer-etat",
        faire: () => {
          const commande = etatDuMoment()?.commande ?? null;
          if (commande === null) return;
          fermer();
          actions.executer?.(commande, "menu");
        },
      }),
    );
    if (avait) place.querySelector("button")?.focus({ preventScroll: true });
  }

  // « Changer l'équipement… » (D14) : l'arme tenue parmi les armes et la
  // qualité de chaque objet d'un personnage, ou la cellule Équipement d'un
  // adversaire ; l'écran recalcule la photographie à « Enregistrer ».
  function composerLEquipement() {
    const vue = vueDuMj();
    const donnee = vue?.equipement ?? null;
    const proposition = typeof vues.equipement === "function" && donnee !== null ? vues.equipement(options.id) : null;
    if (vue === null || donnee === null || proposition === null) return null;
    const ouvert = vue.actif === true && donnee.actif === true;
    const raisonDuMenu = vue.actif === true ? donnee.raison : vue.raison;
    if (proposition.refus) {
      return { titre: `${donnee.libelle.replace(/\u2026$/, "")} ${SIGNES.tiret} ${vue.titre}`, sous: donnee.texte, corps: [paragraphe(proposition.refus)], pied: [bouton({ texte: ANNULER, repere: "annuler", faire: () => fermer() })], signature: [proposition] };
    }
    equipement ??= proposition.camp === "pj" ? { tenue: proposition.tenue ?? null, qualites: Object.fromEntries((proposition.objets ?? []).map((objet) => [objet.rang, objet.qualite ?? ""])) } : { cellule: proposition.cellule ?? "" };
    const corpsDuPanneau = [];
    if (proposition.camp === "pj") {
      const armes = [{ valeur: null, libelle: AUCUNE_ARME }, ...(proposition.armes ?? [])];
      corpsDuPanneau.push(
        el(
          "div",
          { role: "group", "aria-label": ARME_TENUE },
          el("h3", {}, ARME_TENUE),
          armes.map((arme) =>
            bouton({
              texte: arme.libelle,
              actif: ouvert,
              raison: raisonDuMenu,
              repere: `arme-${arme.valeur ?? "aucune"}`,
              attributs: { "aria-pressed": String(equipement.tenue === arme.valeur) },
              faire: () => {
                equipement.tenue = arme.valeur;
                dessiner();
              },
            }),
          ),
        ),
      );
      corpsDuPanneau.push(
        el(
          "div",
          { role: "group", "aria-label": QUALITES },
          el("h3", {}, QUALITES),
          (proposition.objets ?? []).map((objet) => {
            numero += 1;
            const id = `combat-menu-qualite-${numero}`;
            const champ = el("input", {
              id,
              type: "text",
              classe: "champ",
              inputmode: "decimal",
              maxlength: "6",
              "data-repere": `qualite-${objet.rang}`,
              "aria-disabled": ouvert ? null : "true",
              readonly: ouvert ? null : true,
              oninput: () => {
                equipement.qualites[objet.rang] = champ.value;
              },
            });
            champ.value = String(equipement.qualites[objet.rang] ?? "");
            return el("div", { classe: "combat-champ-mj" }, el("label", { for: id }, objet.nom), champ);
          }),
        ),
      );
    } else {
      numero += 1;
      const id = `combat-menu-cellule-${numero}`;
      const champ = el("input", {
        id,
        type: "text",
        classe: "champ",
        "data-repere": "cellule",
        "aria-disabled": ouvert ? null : "true",
        readonly: ouvert ? null : true,
        oninput: () => {
          equipement.cellule = champ.value;
        },
      });
      champ.value = String(equipement.cellule ?? "");
      corpsDuPanneau.push(el("div", { classe: "combat-champ-mj" }, el("label", { for: id }, CELLULE), champ));
    }
    return {
      titre: `${donnee.libelle.replace(/\u2026$/, "")} ${SIGNES.tiret} ${vue.titre}`,
      sous: donnee.texte,
      corps: [ouvert ? null : paragraphe(raisonDuMenu), corpsDuPanneau, paragraphe(refusDeLEquipement)],
      pied: [
        bouton({ texte: ANNULER, repere: "annuler", faire: () => fermer() }),
        bouton({
          texte: ENREGISTRER,
          classe: "bouton",
          actif: ouvert,
          raison: raisonDuMenu,
          repere: "enregistrer",
          faire: () => {
            const issue = actions.changerLEquipement?.(options.id, structuredClone(equipement)) ?? {};
            if (issue.refus) {
              refusDeLEquipement = issue.refus;
              actions.dire?.(issue.refus);
              dessiner();
              return;
            }
            fermer();
          },
        }),
      ],
      signature: [vue.titre, donnee, proposition, equipement.tenue, refusDeLEquipement],
    };
  }

  // La palette : sa place seulement, ni tête ni pied (son nœud les porte).
  function composerLaPalette() {
    const place = options.noeud ?? null;
    if (place === null) return null;
    return { titre: null, sous: null, corps: [place], pied: [], signature: "palette" };
  }

  const COMPOSITEURS = {
    site: composerLeSite,
    combat: composerLeCombat,
    intervenir: composerIntervenir,
    mj: composerLeMenuDuMj,
    valeurs: composerLesValeurs,
    etats: composerLesEtats,
    equipement: composerLEquipement,
    palette: composerLaPalette,
  };

  // ——— Ouvrir, dessiner, fermer ———

  /** Refait la feuille ouverte si ce qu'elle montre a changé ; la ferme si elle n'a plus rien à montrer. */
  function dessiner() {
    if (genre === null || EN_PLEIN.has(genre)) return;
    const compose = COMPOSITEURS[genre]();
    if (compose === null) {
      fermer();
      return;
    }
    // Le menu d'un jeton et ses panneaux, sur PC : contre ce qui les ouvre
    // (le jeton, « Modifier… »), plutôt qu'une feuille du bas, à la place
    // que l'écran calcule (mission, § 4.8, E4 ; W1 n° 8) ; une ancre qui ne
    // se voit pas laisse le dialogue au milieu. La largeur peut changer sans
    // que ce qu'il montre change.
    const contre = DU_MJ.has(genre) && vues.etroit !== true && aUneBoite(ancre);
    const classe = contre ? "combat-feuille combat-menu-contexte" : "combat-feuille";
    const classeChangee = feuille.className !== classe;
    if (classeChangee) feuille.className = classe;
    const neuve = JSON.stringify([genre, compose.signature]);
    if (neuve === signature) {
      compose.apres?.();
      if (contre && classeChangee) placer?.(feuille, ancre);
      return;
    }
    const premiere = signature === null;
    signature = neuve;
    const actif = globalThis.document?.activeElement ?? null;
    const repereDuFocus = !premiere && estDans(actif, feuille) ? actif.getAttribute?.("data-repere") : null;
    const palette = genre === "palette";
    tete.hidden = palette;
    pied.hidden = palette || compose.pied.length === 0;
    const etiquette = palette ? (options.noeud.querySelector("h2")?.id ?? null) : "combat-feuille-titre";
    if (etiquette !== null) feuille.setAttribute("aria-labelledby", etiquette);
    else feuille.removeAttribute("aria-labelledby");
    if (palette && rempli(options.nom)) feuille.setAttribute("aria-label", sansSensForce(options.nom));
    else feuille.removeAttribute("aria-label");
    if (!palette) {
      titre.textContent = sansSensForce(compose.titre ?? "");
      sous.textContent = sansSensForce(compose.sous ?? "");
      sous.hidden = !rempli(compose.sous);
    }
    corps.replaceChildren(...[compose.corps].flat(Infinity).filter(present));
    pied.replaceChildren(...[compose.pied].flat(Infinity).filter(present));
    compose.apres?.();
    feuille.hidden = false;
    // Montrée et remplie, elle se mesure : sa place se calcule maintenant.
    if (contre) placer?.(feuille, ancre);
    // Refaite pendant qu'elle avait le focus : il revient à l'élément de
    // même repère, ou au titre.
    if (premiere) return;
    if (repereDuFocus) [...feuille.querySelectorAll("[data-repere]")].find((element) => element.getAttribute("data-repere") === repereDuFocus)?.focus({ preventScroll: true });
    else if (estDans(actif, feuille) && !actif.isConnected) titre.focus({ preventScroll: true });
  }

  // Le focus à l'ouverture : la première ligne d'un menu, le titre d'un
  // panneau ou d'un plein écran, celui de la palette.
  function focaliserALOuverture() {
    if (EN_PLEIN.has(genre)) {
      titreDuPlein.focus({ preventScroll: true });
      return;
    }
    if (genre === "palette") {
      (options.noeud.querySelector("h2") ?? options.noeud.querySelector("button"))?.focus({ preventScroll: true });
      return;
    }
    const premier = ["site", "combat", "intervenir", "mj"].includes(genre) ? (corps.querySelector(".combat-menu-ligne") ?? corps.querySelector("button")) : null;
    (premier ?? titre).focus({ preventScroll: true });
  }

  function ouvrirLePlein() {
    titreDuPlein.textContent = sansSensForce(options.titre ?? "");
    outilsDuPlein.replaceChildren(...[options.outils ?? []].flat(Infinity).filter(present));
    plein.replaceChildren(teteDuPlein, ...[options.contenu ?? []].flat(Infinity).filter(present));
    plein.hidden = false;
  }

  // Sous le voile, rien ne se prend : les autres enfants de ce qui porte la
  // couche (la page de l'écran) deviennent inertes, sauf une région
  // d'annonce, qui doit parler encore ; la fermeture les réveille (R2 n° 5).
  function endormirLeReste() {
    const parent = noeud.parentNode;
    if (!parent || inertes.length > 0) return;
    inertes = [...parent.children].filter((enfant) => enfant !== noeud && !enfant.hasAttribute("inert") && !parle(enfant));
    for (const enfant of inertes) enfant.setAttribute("inert", "");
  }

  function reveillerLeReste() {
    for (const enfant of inertes) enfant.removeAttribute("inert");
    inertes = [];
  }

  // Tab sur le dernier élément de ce qui est ouvert mène au premier, Maj+Tab
  // sur le premier au dernier ; hors d'eux (le titre, que seul le code
  // focalise), Tab mène au premier et Maj+Tab au dernier. Au milieu, Tab
  // suit son cours (R2 n° 5).
  function boucler(evenement) {
    const liste = prenablesDans(EN_PLEIN.has(genre) ? plein : feuille);
    if (liste.length === 0) return;
    const actif = globalThis.document?.activeElement ?? null;
    const arriere = evenement.shiftKey === true;
    if (liste.includes(actif) && actif !== (arriere ? liste[0] : liste.at(-1))) return;
    evenement.preventDefault?.();
    (arriere ? liste.at(-1) : liste[0]).focus({ preventScroll: true });
  }

  /**
   * Ouvre un genre, à la place de ce qui était ouvert. La phrase d'une
   * seconde (« toast ») se montre à côté, sans rien fermer.
   */
  function ouvrir(genreNeuf, optionsNeuves = {}) {
    if (!GENRES.has(genreNeuf)) return;
    if (genreNeuf === "toast") {
      direUneSeconde(optionsNeuves.texte);
      return;
    }
    const actif = globalThis.document?.activeElement ?? null;
    const ancreNeuve = optionsNeuves.ancre ?? (genre !== null ? ancre : actif);
    // L'ancre du genre remplacé, s'il se voit encore (sinon, son propre
    // secours) : le focus ira à elle si la nouvelle n'a plus de boîte.
    const secoursNeuf = genre === null ? null : aUneBoite(ancre) ? ancre : ancreDeSecours;
    vider();
    genre = genreNeuf;
    options = optionsNeuves;
    ancre = ancreNeuve;
    ancreDeSecours = secoursNeuf;
    apres = typeof optionsNeuves.apres === "function" ? optionsNeuves.apres : null;
    signature = null;
    saisies = {};
    etatChoisi = null;
    nomLibre = "";
    duree = "tour";
    equipement = null;
    refusDeLEquipement = null;
    champsDesValeurs = [];
    voile.hidden = false;
    if (EN_PLEIN.has(genre)) ouvrirLePlein();
    else {
      dessiner();
      if (genre === null) return;
    }
    endormirLeReste();
    focaliserALOuverture();
  }

  // Ferme sans rendre le focus : ce qui était prêté revient à l'écran, et
  // ce qui dormait sous le voile se réveille.
  function vider() {
    if (genre === null) return;
    const rendre = apres;
    genre = null;
    options = {};
    ancre = null;
    ancreDeSecours = null;
    apres = null;
    suspendue = false;
    reveillerLeReste();
    signature = null;
    champsDesValeurs = [];
    corps.replaceChildren();
    pied.replaceChildren();
    outilsDuPlein.replaceChildren();
    plein.replaceChildren(teteDuPlein);
    feuille.hidden = true;
    plein.hidden = true;
    voile.hidden = true;
    rendre?.();
  }

  /**
   * Ferme ce qui est ouvert ; le focus revient à ce qui l'avait ouvert, s'il
   * est encore dans la page. Sans boîte (caché depuis), il va à l'ancre du
   * genre remplacé, si elle se voit (R2 n° 6).
   */
  function fermer({ focus = true } = {}) {
    if (genre === null) return;
    const retour = ancre;
    const secours = ancreDeSecours;
    vider();
    if (!focus) return;
    const cible = !aUneBoite(retour) && aUneBoite(secours) ? secours : retour;
    if (cible?.isConnected) cible.focus({ preventScroll: true });
  }

  // Échap, ou un appui sur le voile : la palette se ferme par l'écran, qui
  // sait où rendre le focus ; le reste se ferme ici.
  function echap() {
    if (genre === "palette") actions.fermerLaPalette?.();
    else fermer();
  }

  /**
   * Une case à choisir sur la carte, demandée de la feuille ouverte (la case
   * d'arrivée de la palette, au téléphone, ou sur PC hors d'un geste) : la
   * feuille s'efface le temps du choix, avec le voile, et ce qui dormait sous
   * lui se réveille, car la carte en était (vague 4, C2). Rien ne se ferme :
   * le genre, l'ancre et le secours restent, et reprendre() rend la feuille
   * telle quelle. La phrase d'une seconde dit quoi toucher. Rend vrai si la
   * feuille s'est effacée.
   */
  function suspendre() {
    if (genre === null || EN_PLEIN.has(genre) || suspendue) return false;
    suspendue = true;
    reveillerLeReste();
    feuille.hidden = true;
    voile.hidden = true;
    actions.dire?.(CASE_D_ARRIVEE);
    return true;
  }

  /** La case choisie, ou Échap : la feuille effacée revient, et le reste se rendort sous le voile. */
  function reprendre() {
    if (!suspendue) return;
    suspendue = false;
    voile.hidden = false;
    feuille.hidden = false;
    endormirLeReste();
  }

  /**
   * La fenêtre a changé de taille, ou de zoom : sur PC, le menu du MJ et ses
   * panneaux se replacent contre leur ancre, que la carte a pu déplacer, comme
   * la bulle ; jamais à un rendu, ni à un dé (vague 4, C6). « Modifier une
   * valeur… » compris, que rendre() ne redessine pas.
   */
  function replacer() {
    if (genre === null || !DU_MJ.has(genre) || suspendue) return;
    const contre = vues.etroit !== true && aUneBoite(ancre);
    const classe = contre ? "combat-feuille combat-menu-contexte" : "combat-feuille";
    if (feuille.className !== classe) feuille.className = classe;
    if (!contre) return;
    placer?.(feuille, ancre);
  }

  function direUneSeconde(texte) {
    if (toastEnCours !== null) leMinuteur.retirer(toastEnCours);
    toast.textContent = sansSensForce(texte ?? "");
    toast.hidden = !rempli(texte);
    toastEnCours = leMinuteur.poser(() => {
      toastEnCours = null;
      toast.hidden = true;
      toast.textContent = "";
    }, UNE_SECONDE);
  }

  /** Les vues du dernier rendu de l'écran : ce qui est ouvert les suit. */
  function rendre(vuesNeuves = {}) {
    vues = { ...vues, ...vuesNeuves };
    if (genre === null) return;
    if (DU_MJ.has(genre) && vues.modeMj !== true) {
      fermer();
      return;
    }
    if (genre === "valeurs") {
      if (vueDuMj() === null) fermer();
      else mettreAJourLesValeurs();
      return;
    }
    if (EN_PLEIN.has(genre) || genre === "palette" || genre === "site") return;
    dessiner();
  }

  return { noeud, ouvrir, fermer, rendre, suspendre, reprendre, replacer, ouvert: () => genre, secours: () => (genre === null ? null : ancreDeSecours) };
}
