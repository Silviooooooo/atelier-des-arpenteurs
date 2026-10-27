// La palette du combat (SPECIFICATION.md, § 17, « Le simulateur de combat
// (lot 4) » ; mission du lot 4.3, § 4.5 et § 4.6, vues F4, E1 et E6 ; contrat
// de la vague 3, § 3.6 et § 4.1).
//
// Ce qu'elle montre : les effets qu'une source peut appliquer, rangés en cinq
// onglets (Dés, Zone, Dégâts, Cible, Durée), la ligne que le journal écrira,
// puis « Fermer » et « Appliquer ». Au téléphone, l'écran la pose dans une
// feuille qui monte du bas ; sur PC, la bulle la porte en colonne, à droite
// des dés. Elle ne porte aucune règle : chaque genre, chaque option, chaque
// borne et chaque raison viennent de la vue (vuePalette, js/combat/lecture.js) ;
// ce qu'on y choisit remonte à l'écran, qui redemande la vue.
//
// Le nœud porte tout (contrat, R n° 35) : son titre et son sous-titre, le
// texte de la source, la phrase de la source (et, en Mode MJ, les sources au
// choix), X quand la vue en a un, les onglets et le corps de celui qui est
// ouvert, les effets en cours, l'aperçu (« Le journal écrira : … »), puis le
// pied. La feuille ou la colonne qui l'accueille n'ont ni tête ni pied.
//
// Ce qu'on choisit (Choisi : { genre, valeurs, x }) se tient ici, le temps
// que la palette reste ouverte : un genre, puis les valeurs de ses champs
// (les valeurs par défaut de la vue d'abord), X ; chaque choix part à l'écran
// (actions.choisirDansLaPalette), qui rend la vue de ce choix (son aperçu,
// son « Appliquer »). Une vue sans « Appliquer » dit qu'aucun choix n'est
// retenu : l'écran l'a remis à zéro (un effet appliqué, une autre source, la
// fin du geste), et la palette aussi. L'onglet ouvert se garde quand la
// source change ; il repart du premier qui offre quelque chose quand la
// palette se rouvre.
//
// Ce que seul le Mode MJ montre (mj: true, les sources au choix, la croix d'un
// effet en cours) ne paraît pas quand il est éteint ; un genre inactif rend
// inactif ce qu'il contient, avec sa raison. Le corps n'est refait que si ce
// qu'il montre change ; refait pendant une saisie, il rend le focus au champ
// de même clé, sans faire défiler la page. Ce module n'importe que dom.js.

import { el, sansSensForce } from "./dom.js";

// D'où vient ce que la palette émet.
const ORIGINE = "palette";
// Les textes du pied, des effets en cours et d'un onglet Durée sans genre de
// l'onglet Cible : le dernier ne vient ni de la mission, ni de la maquette,
// et reste à faire confirmer par l'auteur.
const FERMER = "Fermer";
const APPLIQUER = "Appliquer";
const EFFETS_EN_COURS = "Effets en cours";
const SANS_DUREE = "La durée se choisit pour un effet de l'onglet Cible.";
// Le signe qui retire un effet en cours (U+2715), écrit par son code ; son
// nom accessible vient de la vue (« Retirer l'état Étourdi »).
const SIGNE_RETIRER = "\u2715";
const SIGNE_MOINS = "\u2212";

const present = (valeur) => valeur !== null && valeur !== undefined;
const rempli = (texte) => present(texte) && texte !== "";
const estTuple = (valeur) => valeur !== null && typeof valeur === "object" && !Array.isArray(valeur);

// Le numéro du dernier identifiant de palette, commun à toutes : la bulle
// et une feuille peuvent en montrer deux à la fois.
let numero = 0;
const identifiant = (nom) => {
  numero += 1;
  return `combat-palette-${nom}-${numero}`;
};

/** Ce que seul le Mode MJ montre (mj: true) ne paraît pas quand il est éteint. */
const montre = (ecran, objet) => present(objet) && !(objet.mj === true && ecran.modeMj !== true);

/** Un enfant d'un parent inactif l'est aussi, avec la raison du parent. */
const herite = (parent, enfant) =>
  parent?.actif === false ? { actif: false, raison: parent.raison ?? null } : { actif: enfant?.actif !== false, raison: enfant?.actif === false ? (enfant.raison ?? null) : null };

/** Un nombre tel qu'il s'écrit : un négatif avec le signe moins (U+2212), « 5 ». */
const ecrireNombre = (n) => (n < 0 ? `${SIGNE_MOINS}${Math.abs(n)}` : String(n));

/** L'entier d'un champ, dans ses bornes et hors des valeurs exclues, ou null. */
function lireEntier(texte, { min, max, exclus = [] }) {
  const net = String(texte).trim().replace(SIGNE_MOINS, "-");
  if (!/^[+-]?\d+$/.test(net)) return null;
  const nombre = Number(net) || 0;
  if (!Number.isSafeInteger(nombre)) return null;
  if (typeof min === "number" && nombre < min) return null;
  if (typeof max === "number" && nombre > max) return null;
  return exclus.includes(nombre) ? null : nombre;
}

/** Ce que dit un nombre refusé : ses bornes, puis ce qui est exclu (« …, sauf 0, est attendu. »). */
function nombreRefuse({ min, max, exclus = [] }) {
  const bornes = typeof min === "number" && typeof max === "number" ? ` de ${ecrireNombre(min)} à ${ecrireNombre(max)}` : "";
  const sauf = exclus.length ? `, sauf ${exclus.map(ecrireNombre).join(", ")},` : "";
  return `Un nombre entier${bornes}${sauf} est attendu.`;
}

/** Une copie d'un choix : l'écran ne tient jamais celui de la palette. */
const copier = (choix) => (choix === null ? null : { genre: choix.genre, valeurs: structuredClone(choix.valeurs), x: choix.x });

/**
 * La valeur par défaut d'un champ, posée dans les valeurs d'un choix : un
 * tuple (« rendre » : { sur, ressource, zone?, jauge? }) s'y étale ; les
 * cibles partent de celles que la vue coche, la cible en cours en tête.
 */
function poserLeDefaut(valeurs, champ) {
  if (champ.sorte === "cibles") {
    const options = champ.options ?? [];
    valeurs.cibles = Array.isArray(champ.valeur) ? [...champ.valeur] : options.filter((option, rang) => rang === 0 || (option.dOffice === true && option.actif !== false)).map((option) => option.valeur);
    return;
  }
  if (!present(champ.valeur)) return;
  if (estTuple(champ.valeur)) Object.assign(valeurs, structuredClone(champ.valeur));
  else valeurs[champ.nom] = champ.valeur;
}

/** Vrai si l'option d'un champ est celle que portent les valeurs (un tuple : toutes ses clés). */
function choisie(valeurs, champ, option) {
  if (estTuple(option.valeur)) return Object.entries(option.valeur).every(([cle, valeur]) => valeurs[cle] === valeur);
  return present(valeurs[champ.nom]) && valeurs[champ.nom] === option.valeur;
}

/**
 * La palette : { noeud, rendre(vue, ecran), choisi() }. « actions » :
 * executer(commande, origine), choisirDansLaPalette(choisi),
 * changerLaSource(source), fermerLaPalette(), demanderUneCase(options,
 * rappel). rendre reçoit vuePalette (ou null : cachée, son choix oublié) et
 * { etroit, modeMj } ; choisi() rend { genre, valeurs, x }, ou null.
 */
export function creer(actions) {
  const idTitre = identifiant("titre");
  const noeud = el("section", { classe: "combat-palette", hidden: true, "aria-labelledby": idTitre });

  let vue = null;
  let ecran = {};
  let choix = null;
  let ongletOuvert = null;
  // X, saisi avant qu'un genre soit choisi : il entre dans le choix qui suit.
  let xSaisi = null;
  let rendue = null;

  /** Le choix part à l'écran, qui rend la vue de ce choix. */
  function emettre() {
    actions.choisirDansLaPalette?.(copier(choix));
  }

  function choisirLeGenre(genre) {
    const valeurs = {};
    for (const champ of genre.champs ?? []) poserLeDefaut(valeurs, champ);
    choix = { genre: genre.genre, valeurs, x: vue.x ? (xSaisi ?? vue.x.valeur ?? 0) : null };
    emettre();
  }

  function changerLaValeur(faire) {
    if (choix === null) return;
    faire(choix.valeurs);
    emettre();
  }

  // ——— Les morceaux ———

  /** Un bouton ; inactif, il garde le focus, ne fait rien, et sa raison lui est liée. Rend le bouton, puis sa raison. */
  function bouton({ cle, classe = "bouton secondaire", contenu, actif = true, raison = null, presse, role = null, coche, etiquette = null, faire }) {
    const inactif = actif === false;
    const idRaison = inactif && rempli(raison) ? identifiant("raison") : null;
    const noeudDuBouton = el(
      "button",
      {
        type: "button",
        classe,
        role,
        "data-cle": cle,
        "aria-pressed": presse === undefined ? null : String(Boolean(presse)),
        "aria-checked": coche === undefined ? null : String(Boolean(coche)),
        "aria-disabled": inactif ? "true" : null,
        "aria-describedby": idRaison,
        "aria-label": present(etiquette) ? sansSensForce(etiquette) : null,
        onclick: () => {
          if (!inactif) faire(noeudDuBouton);
        },
      },
      contenu,
    );
    return [noeudDuBouton, idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, raison) : null];
  }

  /** Un champ de texte ou de nombre : son libellé, la saisie, et la phrase qui dit un refus. */
  function saisie({ cle, libelle, type, valeur, bornes = {}, max = null, actif = true, raison = null, garder }) {
    const idRefus = identifiant("refus");
    const refus = el("p", { id: idRefus, classe: "combat-refus", hidden: true });
    const idRaison = actif === false && rempli(raison) ? identifiant("raison") : null;
    const champ = el("input", {
      type,
      classe: "champ",
      "data-cle": cle,
      step: type === "number" ? "1" : null,
      min: type === "number" && present(bornes.min) ? bornes.min : null,
      max: type === "number" && present(bornes.max) ? bornes.max : null,
      maxlength: type === "text" && typeof max === "number" ? max : null,
      "aria-disabled": actif === false ? "true" : null,
      "aria-describedby": [idRefus, idRaison].filter(present).join(" "),
    });
    champ.value = present(valeur) ? String(valeur) : "";
    const lire = () => {
      champ.removeAttribute("aria-invalid");
      refus.replaceChildren();
      refus.hidden = true;
      if (actif === false) return;
      if (type === "number") {
        const nombre = lireEntier(champ.value, bornes);
        if (nombre === null) {
          champ.setAttribute("aria-invalid", "true");
          refus.replaceChildren(nombreRefuse(bornes));
          refus.hidden = false;
          return;
        }
        garder(nombre);
        return;
      }
      garder(champ.value.trim());
    };
    champ.addEventListener("change", lire);
    champ.addEventListener("keydown", (evenement) => {
      if (evenement.key !== "Enter") return;
      evenement.preventDefault();
      lire();
    });
    return [el("label", {}, libelle, " ", champ), idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, raison) : null, refus];
  }

  /** Les options d'un champ, en boutons ; un tuple s'étale dans les valeurs ; l'état du classeur ou libre, l'un ou l'autre. */
  function boutonsDOptions(champ, options, parent) {
    return options.map((option) => {
      const { actif, raison } = herite(parent, option);
      return bouton({
        cle: `option:${champ.nom}:${JSON.stringify(option.valeur)}`,
        contenu: present(option.case) ? [option.libelle, " ", el("span", { classe: "combat-sous" }, option.case)] : option.libelle,
        presse: choix !== null && choisie(choix.valeurs, champ, option),
        actif,
        raison,
        faire: () =>
          changerLaValeur((valeurs) => {
            if (estTuple(option.valeur)) Object.assign(valeurs, structuredClone(option.valeur));
            else valeurs[champ.nom] = option.valeur;
            if (champ.nom === "capacite") delete valeurs.libre;
          }),
      });
    });
  }

  /** Les cibles de « toute la case » (F10) : la cible en cours en tête, cochée et fixe ; les autres se cochent ; puis « Un jet par cible ». */
  function casesACocher(champ, parent) {
    const cochees = choix?.valeurs?.cibles ?? [];
    const options = champ.options ?? [];
    return [
      el(
        "div",
        { role: "group", "aria-label": sansSensForce(champ.libelle ?? "") },
        options.map((option, rang) => {
          const fixe = rang === 0;
          const { actif, raison } = herite(parent, option);
          return [
            bouton({
              cle: `cible:${option.valeur}`,
              classe: "combat-capacite",
              role: "checkbox",
              coche: fixe || cochees.includes(option.valeur),
              contenu: [option.libelle, rempli(option.detail) ? [" ", el("span", { classe: "combat-cible-detail" }, option.detail)] : null],
              actif: actif && !fixe,
              raison,
              faire: () =>
                changerLaValeur((valeurs) => {
                  const avant = valeurs.cibles ?? [];
                  valeurs.cibles = avant.includes(option.valeur) ? avant.filter((id) => id !== option.valeur) : [...avant, option.valeur];
                }),
            }),
          ];
        }),
      ),
      cochees.length >= 2 ? el("p", { classe: "combat-jets-par-cible" }, `Un jet par cible : ${cochees.length} cibles`) : null,
    ];
  }

  /** Un champ d'un genre choisi, selon sa sorte. */
  function champDuGenre(champ, parent) {
    const { actif, raison } = herite(parent, champ);
    const valeurs = choix?.valeurs ?? {};
    if (champ.sorte === "option") {
      const blocs = champ.blocs ?? null;
      const corps = blocs
        ? blocs.map((bloc) => el("div", { classe: "combat-palette-groupe" }, el("h4", {}, bloc.titre), boutonsDOptions(champ, bloc.options ?? [], { actif, raison })))
        : boutonsDOptions(champ, champ.options ?? [], { actif, raison });
      return el("div", { role: "group", "aria-label": sansSensForce(champ.libelle ?? "") }, rempli(champ.libelle) ? el("p", {}, champ.libelle) : null, corps);
    }
    if (champ.sorte === "nombre" || champ.sorte === "texte") {
      const nombre = champ.sorte === "nombre";
      return saisie({
        cle: `champ:${champ.nom}`,
        libelle: champ.libelle ?? "",
        type: nombre ? "number" : "text",
        valeur: valeurs[champ.nom] ?? champ.valeur,
        bornes: { min: champ.min, max: champ.max, exclus: champ.exclus ?? [] },
        max: champ.max,
        actif,
        raison,
        garder: (valeur) =>
          changerLaValeur((lesValeurs) => {
            if (nombre) lesValeurs[champ.nom] = valeur;
            else if (valeur === "") delete lesValeurs[champ.nom];
            else {
              lesValeurs[champ.nom] = valeur;
              delete lesValeurs.capacite;
            }
          }),
      });
    }
    if (champ.sorte === "case") {
      const sur = (parent.champs ?? []).find((autre) => autre.nom === "sur");
      const nomDuSur = (sur?.options ?? []).find((option) => option.valeur === valeurs.sur)?.libelle ?? null;
      const nommer = (nomDeCase) => (rempli(nomDuSur) ? `Case ${nomDeCase} : y déplacer ${sansSensForce(nomDuSur)}` : `Case ${nomDeCase}`);
      return bouton({
        cle: `champ:${champ.nom}`,
        contenu: rempli(valeurs[champ.nom]) ? `${champ.libelle ?? ""} ${valeurs[champ.nom]}` : (champ.libelle ?? ""),
        actif,
        raison,
        faire: () =>
          actions.demanderUneCase?.({ exclue: champ.exclue ?? null, nommer }, (nomDeCase) =>
            changerLaValeur((lesValeurs) => {
              lesValeurs[champ.nom] = nomDeCase;
            }),
          ),
      });
    }
    if (champ.sorte === "cibles") return casesACocher(champ, { actif, raison });
    return null;
  }

  /** Un genre : son bouton, puis, choisi, ses champs. */
  function genreVu(genre) {
    const estChoisi = choix?.genre === genre.genre;
    return el(
      "div",
      { classe: "combat-palette-groupe" },
      bouton({ cle: `genre:${genre.genre}`, classe: "combat-capacite", contenu: genre.libelle, presse: estChoisi, actif: genre.actif, raison: genre.raison, faire: () => (estChoisi ? null : choisirLeGenre(genre)) }),
      estChoisi ? (genre.champs ?? []).map((champ) => champDuGenre(champ, genre)) : null,
    );
  }

  /** Le corps d'un onglet : ses genres ; pour Durée, le champ du genre choisi dans l'onglet Cible. */
  function corpsDeLOnglet(onglet) {
    if (onglet.cle !== "duree") return (onglet.genres ?? []).filter((genre) => montre(ecran, genre)).map(genreVu);
    if (!onglet.champ) return el("p", { classe: "combat-sous" }, SANS_DUREE);
    return champDuGenre(onglet.champ, { actif: true, raison: null, champs: [] });
  }

  /** L'onglet ouvert : celui qu'on a ouvert, s'il est là ; sinon le premier qui offre un genre actif ; sinon le premier. */
  function ongletDe(onglets) {
    if (onglets.some((onglet) => onglet.cle === ongletOuvert)) return ongletOuvert;
    const offert = onglets.find((onglet) => (onglet.genres ?? []).some((genre) => genre.actif !== false && montre(ecran, genre)));
    return (offert ?? onglets[0])?.cle ?? null;
  }

  function onglets(liste) {
    if (liste.length === 0) return [];
    const ids = liste.map((onglet) => [onglet.cle, identifiant("onglet")]);
    const idDe = Object.fromEntries(ids);
    const idPanneau = identifiant("panneau");
    const ouvert = liste.find((onglet) => onglet.cle === ongletOuvert);
    return [
      el(
        "div",
        { classe: "combat-palette-onglets", role: "tablist" },
        liste.map((onglet) =>
          el(
            "button",
            {
              type: "button",
              id: idDe[onglet.cle],
              role: "tab",
              "data-cle": `onglet:${onglet.cle}`,
              "aria-selected": String(onglet.cle === ongletOuvert),
              "aria-controls": idPanneau,
              onclick: () => {
                if (ongletOuvert === onglet.cle) return;
                ongletOuvert = onglet.cle;
                refaire();
              },
            },
            onglet.libelle,
          ),
        ),
      ),
      el("div", { id: idPanneau, role: "tabpanel", "aria-labelledby": idDe[ongletOuvert] }, ouvert ? corpsDeLOnglet(ouvert) : null),
    ];
  }

  /** La source : sa phrase ; en Mode MJ, la phrase du MJ et les sources au choix. */
  function source(s) {
    if (!s) return null;
    const mj = ecran.modeMj === true;
    const idPhrase = identifiant("source");
    return [
      paragrapheOuRien(mj && rempli(s.phraseMj) ? s.phraseMj : s.phrase, null, idPhrase),
      mj && s.choix?.length
        ? el(
            "div",
            { role: "group", "aria-labelledby": idPhrase },
            s.choix.map((une, rang) =>
              bouton({
                cle: `source:${rang}`,
                contenu: une.libelle,
                presse: une.choisie === true,
                actif: une.actif,
                raison: une.raison,
                faire: () => {
                  if (une.choisie !== true) actions.changerLaSource?.(une.source);
                },
              }),
            ),
          )
        : null,
    ];
  }

  function paragrapheOuRien(texte, classe = null, id = null) {
    return rempli(texte) ? el("p", { classe, id }, texte) : null;
  }

  /** X d'un passif : un nombre de 0 à la plus grande que la vue accepte. */
  function champX(x) {
    if (!x) return null;
    return saisie({
      cle: "x",
      libelle: x.libelle ?? "X",
      type: "number",
      valeur: choix?.x ?? xSaisi ?? x.valeur,
      bornes: { min: x.min, max: x.max },
      garder: (valeur) => {
        xSaisi = valeur;
        if (choix === null) {
          refaire();
          return;
        }
        choix.x = valeur;
        emettre();
      },
    });
  }

  /** Les effets en cours : leur nom et leur durée ; la croix retire un état, en Mode MJ. */
  function effetsEnCours(liste) {
    if (!liste?.length) return null;
    return [
      el("h3", {}, EFFETS_EN_COURS),
      el(
        "ul",
        { classe: "combat-palette-effets" },
        liste.map((effet, rang) =>
          el(
            "li",
            {},
            effet.nom,
            rempli(effet.duree) ? ` · ${effet.duree}` : null,
            montre(ecran, effet.retirer)
              ? [
                  " ",
                  bouton({
                    cle: `retirer:${rang}`,
                    classe: "bouton secondaire",
                    contenu: SIGNE_RETIRER,
                    etiquette: effet.retirer.libelle ?? null,
                    actif: effet.retirer.actif,
                    raison: effet.retirer.raison,
                    faire: () => actions.executer?.(effet.retirer.commande, ORIGINE),
                  }),
                ]
              : null,
          ),
        ),
      ),
    ];
  }

  /** Le pied : « Fermer », puis « Appliquer » (inactif tant que rien n'est choisi). */
  function pied(appliquer) {
    return el(
      "div",
      { classe: "combat-pied" },
      bouton({ cle: "fermer", contenu: FERMER, faire: () => actions.fermerLaPalette?.() }),
      bouton({
        cle: "appliquer",
        classe: "bouton",
        contenu: appliquer?.libelle ?? APPLIQUER,
        actif: appliquer ? appliquer.actif !== false : false,
        raison: appliquer?.raison ?? null,
        faire: () => {
          if (appliquer?.commande) actions.executer?.(appliquer.commande, ORIGINE);
        },
      }),
    );
  }

  // ——— Le rendu ———

  /** La clé du champ qui a le focus dans la palette, ou null. */
  function cleDuFocus() {
    const actif = globalThis.document?.activeElement ?? null;
    return actif !== null && actif !== noeud && noeud.contains(actif) ? actif.getAttribute("data-cle") : null;
  }

  function refaire() {
    rendue = null;
    if (vue !== null) rendre(vue, ecran);
  }

  function rendre(vueRendue, ecranRendu = {}) {
    if (vueRendue === null || vueRendue === undefined) {
      vue = null;
      choix = null;
      ongletOuvert = null;
      xSaisi = null;
      rendue = null;
      noeud.replaceChildren();
      noeud.hidden = true;
      return;
    }
    vue = vueRendue;
    ecran = ecranRendu ?? {};
    // Sans « Appliquer », la vue dit qu'aucun choix n'est retenu.
    if (!vue.appliquer) choix = null;
    if (!vue.x) xSaisi = null;
    ongletOuvert = ongletDe(vue.onglets ?? []);
    const signature = JSON.stringify([vue, ecran.etroit === true, ecran.modeMj === true, ongletOuvert, choix, xSaisi]);
    noeud.hidden = false;
    if (signature === rendue) return;
    rendue = signature;
    const cle = cleDuFocus();
    noeud.replaceChildren(
      ...[
        el("h2", { id: idTitre, tabindex: "-1" }, vue.titre ?? ""),
        paragrapheOuRien(vue.sous, "combat-sous"),
        paragrapheOuRien(vue.texte, "combat-palette-texte"),
        source(vue.source),
        champX(vue.x),
        onglets(vue.onglets ?? []),
        effetsEnCours(vue.effetsEnCours),
        paragrapheOuRien(vue.apercu, "combat-palette-apercu"),
        pied(vue.appliquer ?? null),
      ]
        .flat(Infinity)
        .filter(present),
    );
    // Refaite pendant une saisie : le focus revient au champ de même clé.
    if (cle !== null) [...noeud.querySelectorAll("[data-cle]")].find((element) => element.getAttribute("data-cle") === cle)?.focus({ preventScroll: true });
    // La Durée d'un genre de l'onglet Cible paraît avec la vue de ce choix :
    // sa valeur par défaut entre dans le choix, qui repart, une fois. Après
    // la pose du corps : l'écran rend la vue suivante pendant emettre.
    const duree = (vue.onglets ?? []).find((onglet) => onglet.cle === "duree")?.champ ?? null;
    if (choix !== null && duree !== null && present(duree.valeur) && !present(choix.valeurs[duree.nom])) {
      choix.valeurs[duree.nom] = duree.valeur;
      emettre();
    }
  }

  return { noeud, rendre, choisi: () => copier(choix) };
}
