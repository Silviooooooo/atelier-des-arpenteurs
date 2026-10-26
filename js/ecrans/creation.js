// Le parcours de création d'un personnage (SPECIFICATION.md, § 15.3).
//
// Neuf étapes, à l'adresse #/personnage/<id>/etape/<1 à 9>. Chaque
// changement est vérifié comme un fichier reçu (format.js) avant d'être
// accepté, puis gardé aussitôt sur l'appareil : le brouillon survit à une
// page fermée. On avance même incomplet ; la zone « Ce qui manque » le dit
// à chaque étape, et « Enregistrer » attend qu'il ne manque plus rien.
//
// Le lot 2 bis : chaque capacité en jeu se présente avec sa description
// (dépliée sur un grand écran, à déplier sous son nom sur un téléphone) ;
// les caractéristiques et les niveaux se règlent par des boutons + et − ;
// les objets passent par trois entrées (l'arme, le pack d'armure, tous les
// objets), à la qualité 2 d'office ; le tirage de la constellation se
// refait ; un personnage enregistré se modifie par une copie de travail, qui
// s'enregistre à sa place ou sous un autre nom.
//
// Le lot 4, groupe 2 (contrat § 12.5, complément § 7) : aux étapes 3 à 6,
// les blocs se choisissent en vignettes, côte à côte, chacune avec son
// résumé ; sous elles, le bloc choisi décrit, ses descriptions ouvertes, et
// ses groupes de choix, en vignettes eux aussi. Sous l'habit de vignette, un
// bouton radio ou une case à cocher natifs.
//
// Le lot 5 (§ 15.3) : à l'étape 8, une vignette par capacité, qu'elle
// puisse évoluer ou non, avec son effet au niveau actuel et la raison de son
// « + » ; le niveau suivant se compare au niveau actuel, mot à mot
// (difference.js), dans une infobulle sur un ordinateur, dans un volet du
// bas sur un téléphone. À l'étape 7, l'arme tenue et le pack d'armure se
// choisissent en vignettes, chacune avec ce que l'objet donne et son état
// de maîtrise (maitrise.js) ; le choix reste permis dans tous les cas.
//
// Aucune règle du jeu n'est écrite ici : ce qui manque, les montées
// permises, le tirage, l'intitulé d'un groupe et le résumé d'un bloc
// viennent de parcours.js, la fiche de calcul.js, les packs de packs.js, la
// maîtrise de maitrise.js, les nombres de regles.js.

import { accorder } from "../banque/accord.js";
import { cle } from "../banque/noms.js";
import { TYPES, typeDe } from "../banque/types.js";
import { coutEcrit, lecture } from "../fiche/lecture.js";
import { calculerFiche, capacitesDuBloc, contexte, degatsDecrits, descriptionA, estBouclier, indexerCreation, qualiteDe, valeursParametre } from "../personnage/calcul.js";
import { difference } from "../personnage/difference.js";
import { ErreurPersonnage, nouvelIdentifiant, verifier } from "../personnage/format.js";
import { capacitesDeLObjet, ligneDesMaitrises, maitriseDeLObjet, maitriseDuPack, maitrisesDuPersonnage, poidsDe, rangsDuPersonnage } from "../personnage/maitrise.js";
import { NOMS_PACK, packsDArmure, zonesCouvertes } from "../personnage/packs.js";
import { ETAPES, banqueUtilisable, legendeDuGroupe, manques, niveauxPermis, resumeDuBloc, tirerConstellation } from "../personnage/parcours.js";
import {
  CARACTERISTIQUES,
  CARACTERISTIQUE_MAX,
  CARACTERISTIQUE_MIN,
  COUT_NIVEAU,
  DES,
  PARAMETRES,
  POINTS_CREATION,
  SOMME_CARACTERISTIQUES,
  TYPES_OBJET,
  ZONES,
  deDuJet,
} from "../personnage/regles.js";
import { relever } from "../personnage/suivi.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer, versAnomalie } from "./dom.js";

const texteErreur = (erreur) => erreur?.message ?? String(erreur);
const nomDe = (personnage) => personnage.identite.nom.trim() || "nouveau personnage";
const deux = (nombre) => String(nombre).padStart(2, "0");
const heure = (date = new Date()) => `${deux(date.getHours())}:${deux(date.getMinutes())}:${deux(date.getSeconds())}`;
const ABREGE = Object.fromEntries(CARACTERISTIQUES.map((c) => [c.code, c.abrege]));
const NOM_ZONE = Object.fromEntries(ZONES.map((z) => [z.code, z.nom.toLowerCase()]));
// La qualité d'un objet choisi à la création (décision de l'auteur, lot 2
// bis) : 2, le facteur 1 ; elle se change ensuite, sur l'écran du personnage.
export const QUALITE_CREATION = "2";
const RUBRIQUES = [
  ["arme", "Armes"],
  ["armure", "Pièces d'armure"],
  ["equipement", "Équipement"],
  ["consommable", "Consommables"],
];
// Un téléphone : la même largeur que celle de la mise en page (ecran.css).
const estEtroit = () => Boolean(globalThis.matchMedia?.("(max-width: 55.99rem)").matches);

function renommer(entete, texte) {
  entete.textContent = texte;
  titrer(texte);
}

const versLaListe = () => el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Personnages"));

// Un refus dit près de ce qui l'a causé, et le focus y va : sur un
// téléphone, un message écrit au bas de l'étape passerait inaperçu
// (relecture du lot 2 bis).
function direIci(zone, texte) {
  const message = el("p", { classe: "message", role: "alert", tabindex: "-1" }, texte);
  zone.replaceChildren(message);
  message.focus();
}

// ─── Les descriptions ───────────────────────────────────────────────────────

const coutLisible = (cout) => {
  const texte = coutEcrit(cout);
  return texte === "0" || texte === "" ? "sans coût" : texte;
};

/**
 * Une capacité avec sa description, ses [N] et expressions évalués au
 * niveau demandé (par défaut son niveau de création) : ouverte sur un grand
 * écran, à déplier sous son nom sur un téléphone ; ouverte partout quand
 * ouverte vaut true (le bloc choisi d'une étape en vignettes).
 */
function capaciteDecrite(o, nom, { bloc = null, niveau = null, qualite = QUALITE_CREATION, intitule = null, cle: cleEtat = null, ouverte = null } = {}) {
  const d = descriptionA(o.index, o.personnage, nom, { bloc, niveau, qualite });
  if (!d) return el("li", { classe: "capacite-decrite" }, el("span", { classe: "capacite-nom" }, intitule ?? nom), el("span", { classe: "detail" }, " — capacité à venir"));
  return el(
    "li",
    { classe: "capacite-decrite" },
    el(
      "details",
      { open: ouverte ?? !estEtroit(), "data-cle": cleEtat ?? `${bloc ?? ""}|${nom}|${niveau ?? ""}|${intitule ?? ""}` },
      el("summary", {}, el("span", { classe: "capacite-nom" }, intitule ?? d.nom), " ", el("span", { classe: "detail" }, `niveau ${d.niveau} · ${coutLisible(d.cout)}`)),
      el("p", { classe: "capacite-texte" }, d.texte.trim() || "Sans description."),
    ),
  );
}

const capacitesDecrites = (o, noms, options = {}) => (noms.length ? el("ul", { classe: "capacites-decrites" }, noms.map((nom) => capaciteDecrite(o, nom, options))) : null);

// Ce qu'un bloc donne, décrit : ses capacités, puis ses groupes de choix
// quand ils ne sont pas proposés ailleurs dans la page. ouvertes : les
// descriptions ouvertes sur un téléphone aussi ; sinon, la règle de
// capaciteDecrite.
function blocDecrit(o, bloc, { avecGroupes = true, qualite = QUALITE_CREATION, siVide = "Capacités à venir.", ouvertes = false } = {}) {
  const { capacites, groupes } = capacitesDuBloc(bloc, []);
  const ouverte = ouvertes ? true : null;
  const parties = [capacitesDecrites(o, capacites.map((c) => c.nom), { bloc: bloc.nom, qualite, ouverte })];
  if (avecGroupes) {
    for (const g of groupes) {
      parties.push(
        el("p", { classe: "secondaire-texte petit" }, g.forme === "choix" ? "Au choix, une option :" : "Facultatif, aucune, une ou plusieurs options :"),
        capacitesDecrites(o, g.options, { bloc: bloc.nom, qualite, ouverte }),
      );
    }
  }
  if (!capacites.length && !groupes.length && siVide) parties.push(el("p", { classe: "secondaire-texte petit" }, siVide));
  return parties;
}

// ─── Les vignettes ──────────────────────────────────────────────────────────

// Le signe d'une vignette choisie, caché aux lecteurs d'écran : le bouton
// natif dit déjà qu'elle l'est.
const COCHE = "✓";

/**
 * Une vignette (contrat § 12.5) : un bouton radio ou une case à cocher
 * natifs, posés sur toute la vignette et transparents (ecran.css) ; le nom
 * dans son label ; dessous, le résumé d'un bloc, ou le niveau, le coût et la
 * description d'une option, que l'entrée désigne par aria-describedby ; ✓
 * quand elle est choisie. L'étape 7 y ajoute ce qu'un objet donne
 * (contenu), une classe (habit), le signe du choix (« ✓ tenue ») et
 * l'entrée inactive d'un pack que la banque ne propose pas.
 */
function vignette({ id, name, type = "radio", nom, absente = false, choisie, resume = null, decrite = null, contenu = null, habit = null, coche = COCHE, inactive = false, onchange }) {
  const description = resume !== null ? `${id}-resume` : decrite ? `${id}-texte` : contenu ? `${id}-contenu` : null;
  return el(
    "div",
    { classe: ["vignette", habit, choisie ? "choisie" : null, inactive ? "inactive" : null].filter(Boolean).join(" ") },
    el("input", { type, id, name, classe: "vignette-entree", checked: choisie, disabled: inactive, "aria-describedby": description, onchange }),
    el("label", { for: id, classe: "vignette-nom" }, nom, absente ? el("span", { classe: "detail" }, " — capacité à venir") : null),
    resume !== null ? el("span", { id: description, classe: "vignette-resume" }, resume) : null,
    decrite ? [el("span", { classe: "vignette-meta" }, decrite.meta), el("span", { id: description, classe: "vignette-texte" }, decrite.texte)] : null,
    contenu ? el("div", { id: description, classe: "vignette-contenu" }, contenu) : null,
    choisie ? el("span", { classe: "vignette-coche", "aria-hidden": "true" }, coche) : null,
  );
}

// Les blocs d'une étape en vignettes radio, sous leur légende.
const vignettesDesBlocs = (intitule, vignettes) => el("fieldset", { classe: "groupe-choix groupe-vignettes" }, el("legend", {}, intitule), el("div", { classe: "vignettes" }, vignettes));

// ─── Les groupes de choix d'un bloc ─────────────────────────────────────────

/**
 * Les groupes de choix d'un bloc : ( a | b ) en boutons radio, [ a | b ] en
 * cases à cocher, chaque option avec sa description ; en vignettes quand
 * vignettes vaut true (les étapes 3 à 6). ecrire(q, choix) range la liste
 * des options choisies dans le personnage q ; un choix qui n'est plus une
 * option s'y perd.
 */
function groupesDeChoix(o, bloc, choix, prefixe, ecrire, { qualite = QUALITE_CREATION, vignettes = false } = {}) {
  const { groupes } = capacitesDuBloc(bloc, choix);
  return groupes.map((groupe, g) => {
    const unique = groupe.forme === "choix";
    const options = groupe.options.map((option, i) => {
      const id = `${prefixe}-g${g}-${i}`;
      const choisie = groupe.choisies.some((c) => cle(c) === cle(option));
      const onchange = (evenement) => {
        const sans = (liste) => liste.filter((c) => cle(c) !== cle(option));
        const nouveaux = groupes.flatMap((autre, k) => {
          if (k !== g) return autre.choisies;
          if (unique) return [option];
          return evenement.target.checked ? [...sans(autre.choisies), option] : sans(autre.choisies);
        });
        o.modifier((q) => ecrire(q, nouveaux), { refaire: true, focus: id });
      };
      if (vignettes) {
        const d = descriptionA(o.index, o.personnage, option, { bloc: bloc.nom, qualite });
        const decrite = d ? { meta: `niveau ${d.niveau} · ${coutLisible(d.cout)}`, texte: d.texte.trim() || "Sans description." } : null;
        return vignette({ id, name: `${prefixe}-g${g}`, type: unique ? "radio" : "checkbox", nom: option, absente: !d, choisie, decrite, onchange });
      }
      return el(
        "div",
        { classe: "option-decrite" },
        el(
          "label",
          { classe: "choix-option" },
          el("input", {
            type: unique ? "radio" : "checkbox",
            id,
            name: `${prefixe}-g${g}`,
            checked: choisie,
            onchange,
          }),
          el("span", {}, option, o.index.capacite(option) ? null : el("span", { classe: "detail" }, " — capacité à venir")),
        ),
        o.index.capacite(option) ? el("ul", { classe: "capacites-decrites" }, capaciteDecrite(o, option, { bloc: bloc.nom, qualite, intitule: "Description" })) : null,
      );
    });
    return el(
      "fieldset",
      { classe: "groupe-choix" },
      el("legend", {}, legendeDuGroupe(o.index, groupe)),
      el("p", { classe: "secondaire-texte petit" }, unique ? "Une option." : "Aucune, une ou plusieurs options."),
      vignettes ? el("div", { classe: "vignettes" }, options) : options,
    );
  });
}

// Le bloc choisi d'une étape en vignettes, sous elles : son nom, ses
// capacités décrites et ouvertes, puis ses groupes de choix en vignettes.
function blocChoisi(o, bloc, choix, prefixe, ecrire) {
  return el(
    "section",
    { classe: "bloc-choisi" },
    el("h3", {}, bloc.nom),
    blocDecrit(o, bloc, { avecGroupes: false, ouvertes: true }),
    groupesDeChoix(o, bloc, choix, prefixe, ecrire, { vignettes: true }),
  );
}

// ─── Les étapes ─────────────────────────────────────────────────────────────

function etapeIdentite(o) {
  const p = o.personnage;
  const champ = (cleIdentite, libelle, max, { zone = false, requis = false, lignes = 4 } = {}) => {
    const entree = el(zone ? "textarea" : "input", {
      id: cleIdentite,
      classe: zone ? "champ zone-texte" : "champ",
      type: zone ? null : "text",
      maxlength: max,
      rows: zone ? lignes : null,
      required: requis,
      autocomplete: "off",
      oninput: (evenement) => o.modifier((q) => {
        q.identite[cleIdentite] = evenement.target.value;
      }),
    });
    entree.value = p.identite[cleIdentite];
    return [el("label", { for: cleIdentite }, libelle), entree];
  };
  return el(
    "div",
    { classe: "formulaire" },
    champ("nom", "Nom (obligatoire)", 120, { requis: true }),
    champ("age", "Âge", 40),
    champ("description", "Description physique", 4000, { zone: true }),
    champ("histoire", "Histoire", 12000, { zone: true, lignes: 8 }),
  );
}

function tableDesDes(caracteristiques) {
  const de = ([a, b]) => deDuJet(caracteristiques[a], caracteristiques[b])?.de ?? "—";
  const paire = ([a, b]) => `${ABREGE[a]} + ${ABREGE[b]}`;
  return el(
    "table",
    { classe: "apercu-des" },
    el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Type"), el("th", { scope: "col" }, "Attaque"), el("th", { scope: "col" }, "Défense"))),
    el(
      "tbody",
      {},
      Object.values(TYPES_OBJET).map((t) =>
        el("tr", {}, el("th", { scope: "row" }, t.nom), el("td", {}, `${de(t.attaque)} (${paire(t.attaque)})`), el("td", {}, `${de(t.defense)} (${paire(t.defense)})`)),
      ),
    ),
  );
}

// Étape 2 : chaque caractéristique part de 2, et se règle par + et −, de 2
// à 6 ; « + » s'arrête quand la somme atteint 36.
function etapeCaracteristiques(o) {
  const somme = el("p", { classe: "somme", role: "status" });
  const apercu = el("div", {});
  const lignes = new Map();
  const total = () => CARACTERISTIQUES.reduce((t, c) => t + (o.personnage.caracteristiques[c.code] ?? 0), 0);
  const rafraichir = () => {
    const valeurs = o.personnage.caracteristiques;
    const t = total();
    const ecart = t < SOMME_CARACTERISTIQUES ? ` · reste ${SOMME_CARACTERISTIQUES - t} à répartir` : t > SOMME_CARACTERISTIQUES ? ` · ${t - SOMME_CARACTERISTIQUES} de trop` : "";
    somme.textContent = `Somme : ${t} / ${SOMME_CARACTERISTIQUES}${ecart}`;
    for (const c of CARACTERISTIQUES) {
      const { valeur, moins, plus } = lignes.get(c.code);
      const v = valeurs[c.code];
      valeur.textContent = v === null ? "—" : String(v);
      moins.disabled = v === null || v <= CARACTERISTIQUE_MIN;
      plus.disabled = (v !== null && v >= CARACTERISTIQUE_MAX) || t >= SOMME_CARACTERISTIQUES;
    }
    apercu.replaceChildren(tableDesDes(valeurs));
  };
  const changer = (c, pas) => {
    const actuelle = o.personnage.caracteristiques[c.code];
    const valeur = actuelle === null ? CARACTERISTIQUE_MIN : actuelle + pas;
    if (valeur < CARACTERISTIQUE_MIN || valeur > CARACTERISTIQUE_MAX) return;
    if (pas > 0 && total() >= SOMME_CARACTERISTIQUES) return;
    if (!o.modifier((q) => { q.caracteristiques[c.code] = valeur; })) return;
    rafraichir();
    // Un bouton devenu inactif perd le focus : il passe à son voisin.
    const { moins, plus } = lignes.get(c.code);
    const bouton = pas > 0 ? plus : moins;
    const voisin = pas > 0 ? moins : plus;
    if (bouton.disabled && !voisin.disabled) voisin.focus();
  };
  const champs = CARACTERISTIQUES.map((c) => {
    const id = `carac-${c.code}`;
    const valeur = el("span", { id, classe: "valeur-pas", "aria-live": "polite" });
    const moins = el("button", { type: "button", id: `${id}-moins`, classe: "bouton secondaire bouton-pas", "aria-label": `Diminuer ${c.nom}`, onclick: () => changer(c, -1) }, "−");
    const plus = el("button", { type: "button", id: `${id}-plus`, classe: "bouton secondaire bouton-pas", "aria-label": `Augmenter ${c.nom}`, onclick: () => changer(c, +1) }, "+");
    lignes.set(c.code, { valeur, moins, plus });
    return el("div", { classe: "caracteristique" }, el("span", { classe: "nom-pas" }, c.nom), el("div", { classe: "pas-a-pas" }, moins, valeur, plus));
  });
  rafraichir();
  return [
    el("p", {}, `Neuf caractéristiques, chacune de ${CARACTERISTIQUE_MIN} à ${CARACTERISTIQUE_MAX}, pour une somme de ${SOMME_CARACTERISTIQUES}. Toutes partent de ${CARACTERISTIQUE_MIN}.`),
    el("div", { classe: "caracteristiques" }, champs),
    somme,
    el("h3", {}, "Aperçu des dés"),
    apercu,
    el("p", { classe: "secondaire-texte petit" }, `Somme des deux caractéristiques, arrondie au pair inférieur : ${DES.map((f) => `${f} → d${f}`).join(" · ")}`),
  ];
}

// Archétype, espèce, primordial : un bloc à choisir parmi des vignettes,
// chacune avec son résumé ; sous elles, le bloc choisi, décrit, et ses
// groupes de choix. Changer de bloc perd les choix du bloc quitté.
function etapeBloc(o, role, { intitule, aucun }) {
  const blocs = o.index.blocsDeType(role);
  if (!blocs.length) return el("p", { classe: "message" }, aucun);
  const choisi = o.personnage[role];
  const actuel = choisi?.nom ? o.index.bloc(choisi.nom) : null;
  const avecGroupes = blocs.some((bloc) => capacitesDuBloc(bloc, []).groupes.length > 0);
  return [
    el("p", { classe: "aide-vignettes" }, avecGroupes ? "Choisissez une vignette : sa description et ses choix s'affichent dessous." : "Choisissez une vignette : sa description s'affiche dessous."),
    vignettesDesBlocs(
      intitule,
      blocs.map((bloc, i) => {
        const id = `${role}-${i}`;
        return vignette({
          id,
          name: role,
          nom: bloc.nom,
          choisie: actuel?.nom === bloc.nom,
          resume: resumeDuBloc(o.index, bloc),
          onchange: () => {
            if (o.personnage[role]?.nom === bloc.nom) return;
            o.modifier((q) => { q[role] = { nom: bloc.nom, choix: [] }; }, { refaire: true, focus: id });
          },
        });
      }),
    ),
    actuel ? blocChoisi(o, actuel, choisi.choix, role, (q, choix) => { q[role].choix = choix; }) : null,
  ];
}

// Étape 5 : le tirage se refait à volonté (décision de l'auteur, lot 2 bis),
// et se compte ; la fiche dit « tirée N fois » ou « saisie à la main ». Le
// tirage fait à la table se saisit par les vignettes (lot 4, groupe 2) : en
// choisir une donne une constellation « saisie à la main » et garde le
// compte des tirages ; la tirée porte ✓ ; la choisir de nouveau ne change
// rien.
function etapeConstellation(o) {
  const constellations = o.index.blocsDeType("constellation");
  if (!constellations.length) return el("p", { classe: "message" }, "La banque ne contient aucune constellation : ni tirage ni saisie n'est possible.");
  const actuelle = o.personnage.constellation;
  const bloc = actuelle?.nom ? o.index.bloc(actuelle.nom) : null;
  const tirages = actuelle?.tirages ?? 0;
  const tirer = () => {
    const nom = tirerConstellation(o.banque);
    if (!nom) return;
    o.modifier(
      (q) => {
        const garde = q.constellation?.nom === nom ? q.constellation.choix : [];
        q.constellation = { nom, choix: garde, obtention: "tirage", tirages: (q.constellation?.tirages ?? 0) + 1 };
      },
      { refaire: true, focus: "constellation-tiree" },
    );
  };
  const bouton = el("button", { type: "button", id: "tirer-constellation", classe: "bouton", onclick: tirer }, actuelle?.obtention === "tirage" ? "Refaire le tirage" : "Tirer au sort");
  const saisie = vignettesDesBlocs(
    "Constellation tirée à la table",
    constellations.map((c, i) => {
      const id = `constellation-${i}`;
      return vignette({
        id,
        name: "constellation",
        nom: c.nom,
        choisie: bloc?.nom === c.nom,
        resume: resumeDuBloc(o.index, c),
        onchange: () => {
          // La constellation déjà choisie, tirée ou saisie, ne change pas.
          if (o.personnage.constellation?.nom === c.nom) return;
          o.modifier(
            (q) => {
              const compte = q.constellation?.tirages ?? 0;
              q.constellation = { nom: c.nom, choix: [], obtention: "saisie", tirages: compte };
            },
            { refaire: true, focus: id },
          );
        },
      });
    }),
  );
  const resultat =
    actuelle?.obtention === "tirage"
      ? el(
          "p",
          { id: "constellation-tiree", classe: "resultat-tirage", tabindex: "-1" },
          "Constellation tirée au sort : ",
          el("strong", {}, actuelle.nom),
          el("span", { classe: "detail" }, ` — tirée ${tirages} fois`),
        )
      : actuelle?.obtention === "saisie"
        ? el("p", { id: "constellation-tiree", classe: "resultat-tirage", tabindex: "-1" }, "Constellation saisie à la main : ", el("strong", {}, actuelle.nom))
        : null;
  return [
    resultat,
    el("h3", {}, "Tirer au sort"),
    el("p", {}, "L'Atelier tire une constellation parmi celles de la banque. Le tirage se refait autant de fois qu'il le faut ; la fiche dit combien de fois il a été fait."),
    el("div", { classe: "boutons" }, bouton),
    el("h3", {}, "Saisir le tirage fait à la table"),
    el("p", { classe: "secondaire-texte petit" }, "Une constellation saisie est marquée « saisie à la main » sur la fiche."),
    saisie,
    bloc ? blocChoisi(o, bloc, actuelle.choix, "constellation", (q, choix) => { q.constellation.choix = choix; }) : null,
  ];
}

// ─── Étape 7 : l'équipement ─────────────────────────────────────────────────

// Deux objets de même nom se distinguent par leur rang dans l'équipement.
function libelleObjet(equipement, rang) {
  const nom = equipement[rang].nom;
  return equipement.filter((o) => cle(o.nom) === cle(nom)).length > 1 ? `${nom} (objet ${rang + 1})` : nom;
}

// Les zones que couvrent les pièces d'armure portées (pack et pièces
// équipées), sauf celle du rang donné : { zone: nom de la pièce }.
function zonesPortees(o, personnage, { sauf = null } = {}) {
  const prises = {};
  personnage.equipement.forEach((objet, rang) => {
    if (rang === sauf || (objet.place !== "pack" && objet.place !== "equipe")) return;
    const bloc = o.index.bloc(objet.nom);
    if (!bloc || typeDe(bloc) !== "armure") return;
    for (const zone of zonesCouvertes(bloc)) prises[zone] ??= objet.nom;
  });
  return prises;
}

// Ce qu'un objet donne, décrit à la qualité de l'objet, et ses groupes.
function objetDecrit(o, objet, rang) {
  const bloc = o.index.bloc(objet.nom);
  if (!bloc) return el("p", { classe: "message" }, "Cet objet n'existe plus dans la banque : retirez-le.");
  return [
    // Un objet sans capacité (une pièce d'armure, souvent) n'en annonce aucune.
    blocDecrit(o, bloc, { avecGroupes: false, qualite: objet.qualite, siVide: null }),
    groupesDeChoix(o, bloc, objet.choix, `objet-${rang}`, (p, choix) => { p.equipement[rang].choix = choix; }, { qualite: objet.qualite }),
  ];
}

// ─── Étape 7 : la maîtrise en vignettes (lot 5, § 15.3) ─────────────────────

// L'état de maîtrise d'un objet, en mots (maitrise.js le calcule) ; « permis »
// est celui des mains nues, que l'écran seul dit.
const MENTIONS_MAITRISE = {
  maitrise: "Maîtrisé",
  non: "Non maîtrisé",
  sans: "Sans maîtrise requise",
  permis: "Toujours permis",
};

// La mention d'un état, au pied de la vignette ; « ⚠ » devant « Non
// maîtrisé », caché aux lecteurs d'écran que les mots renseignent.
function mentionDeMaitrise({ etat, n = 0, k = 0 }) {
  const texte = etat === "partielle" ? accorder(`Maîtrise partielle : ${k} capacité(s) sur ${n}`) : MENTIONS_MAITRISE[etat];
  return el("p", { classe: `mention-maitrise maitrise-${etat}` }, etat === "non" ? el("span", { "aria-hidden": "true" }, "⚠ ") : null, texte);
}

// Le poids d'un objet en étiquettes, après son nom : une par poids, aucune
// sans poids.
const etiquettesDePoids = (poids) => poids.map((code) => [" ", el("span", { classe: "etiquette-poids" }, TYPES_OBJET[code].nom)]);

// Le nom affiché d'un paramètre : l'élément qui le reçoit, sinon son nom
// brut (§ 5.2, comme la consultation).
function nomAffiche(o, nom) {
  const recoit = (element) => (element.parametres_recus ?? []).some((recu) => typeof recu === "string" && cle(recu) === cle(nom));
  return (o.banque.elements ?? []).find(recoit)?.nom ?? nom;
}

// Les premiers paramètres d'une vignette d'arme, dans cet ordre ; les
// autres suivent, sous leur nom affiché.
const PREMIERS_PARAMETRES = [
  [PARAMETRES.degats, "Dégâts"],
  [PARAMETRES.portee, "Portée"],
  [PARAMETRES.qualite, "Qualité"],
];

/**
 * Les paramètres qu'un objet transmet à tout son bloc (sans cible ; le
 * premier de chaque nom, comme calcul.js), à la qualité de la création :
 * des [nom affiché, valeur]. Les valeurs se calculent comme sur la fiche
 * (valeursParametre, qualiteDe) ; une valeur illisible reste telle
 * qu'écrite.
 */
function parametresDeLObjet(o, bloc) {
  const qualite = qualiteDe(bloc, QUALITE_CREATION);
  const parNom = new Map();
  for (const p of bloc.parametres) if (p.nom && !p.cible && !parNom.has(cle(p.nom))) parNom.set(cle(p.nom), p);
  const valeur = (p) => {
    if (cle(p.nom) === PARAMETRES.qualite) return qualite.applicable ? qualite.texte : p.valeur.trim();
    const lu = valeursParametre(p.nom, p.valeur, { caracteristiques: o.personnage.caracteristiques, qualite });
    return lu.valeurs ? lu.valeurs.join("/") : p.valeur.trim();
  };
  const premiers = PREMIERS_PARAMETRES.filter(([k]) => parNom.has(k)).map(([k, nom]) => [nom, valeur(parNom.get(k))]);
  const autres = [...parNom].filter(([k]) => !PREMIERS_PARAMETRES.some(([premier]) => premier === k)).map(([, p]) => [nomAffiche(o, p.nom), valeur(p)]);
  return [...premiers, ...autres];
}

const listeDeParametres = (parametres) => (parametres.length ? el("dl", { classe: "vignette-parametres" }, parametres.map(([nom, valeur]) => [el("dt", {}, nom), el("dd", {}, valeur)])) : null);

// Les capacités d'un objet, sur une ligne : « (désavantage) » après celles
// que la maîtrise ne couvre pas.
function capacitesDeLaVignette(o, capacites, hors = []) {
  if (!capacites.length) return el("p", { classe: "vignette-capacites" }, "Aucune capacité.");
  return el(
    "p",
    { classe: "vignette-capacites" },
    capacites.map((c, i) => [
      i ? " · " : "",
      el("span", { classe: "capacite-objet" }, c.nom),
      c.detail ? el("span", { classe: "detail" }, ` ${c.detail}`) : null,
      o.index.capacite(c.nom) ? null : el("span", { classe: "detail" }, " — capacité à venir"),
      hors[i] ? [" ", el("span", { classe: "desavantage" }, "(désavantage)")] : null,
    ]),
  );
}

// Les anomalies que la banque signale sur la ligne d'un bloc, hors les
// informations (un bloc d'armure sans capacité, I3, n'a rien d'anormal) :
// leur nombre, et le lien vers elles, comme sur la fiche du bloc.
function anomaliesDeLObjet(o, bloc) {
  const ligne = bloc?.brut?.ligne;
  if (!Number.isInteger(ligne)) return null;
  const anomalies = (o.banque.anomalies ?? []).filter((a) => a.feuille === "Blocs" && a.ligne === ligne && a.gravite !== "information");
  if (!anomalies.length) return null;
  return el("p", { classe: "vignette-anomalie" }, versAnomalie({ feuille: "Blocs", ligne }, accorder(`${bloc.nom} : ${anomalies.length} anomalie(s) sur sa ligne (Blocs, ligne ${ligne})`)));
}

// L'identifiant de la vignette d'une arme de la banque, « arme-aucune »
// pour les mains nues : le focus y revient après un changement.
function idDeLArme(o, nom) {
  const i = nom ? o.index.blocsDeType("arme").findIndex((bloc) => cle(bloc.nom) === cle(nom)) : -1;
  return i >= 0 ? `arme-${i}` : "arme-aucune";
}

// L'attaque à mains nues, telle que la fiche la calcule sans arme tenue
// (calculerFiche) : celle de la fiche, ou celle d'une copie qui pose l'arme.
function mainsNuesDe(o, fiche) {
  if (fiche.attaque?.mainsNues) return fiche.attaque;
  const sansArme = { ...o.personnage, equipement: o.personnage.equipement.filter((objet) => objet.place !== "arme") };
  return calculerFiche(o.banque, sansArme, { index: o.index }).attaque;
}

// Prendre une arme en main, dans cet équipement : l'arme tenue en sort, la
// nouvelle y entre, tenue, à la qualité de la création ; sans nom, les mains
// nues.
function tenir(equipement, nom) {
  const rang = equipement.findIndex((objet) => objet.place === "arme");
  if (rang >= 0) equipement.splice(rang, 1);
  if (nom) equipement.push({ nom, choix: [], qualite: QUALITE_CREATION, place: "arme" });
}

// Les rangs de maîtrise du personnage s'il prenait cette arme en main : une
// arme ne donne ses capacités, une Maîtrise comprise, que tenue (§ 12,
// point 19). Ils se lisent sur une copie qui la tient à la place de l'arme
// tenue, comme mainsNuesDe ; le personnage ne change pas.
function rangsAvecLArme(o, nom) {
  const equipement = [...o.personnage.equipement];
  tenir(equipement, nom);
  return rangsDuPersonnage(calculerFiche(o.banque, { ...o.personnage, equipement }, { index: o.index }), o.index);
}

// L'entrée « Arme » : une seule arme, tenue d'office (livret, « Objet »).
// Les mains nues, puis chaque arme de la banque, en vignettes : ce qu'elle
// donne à la qualité de la création, et son état de maîtrise, celui qu'elle
// aurait en main (les rangs de la fiche pour l'arme tenue, ceux d'une copie
// qui la tient pour une autre). Changer d'arme remplace celle-ci ; une arme
// de rechange se range dans le sac par « Tous les objets ». Sous les
// vignettes, l'arme tenue, décrite, avec ses groupes de choix.
function entreeArme(o, fiche, rangs) {
  const p = o.personnage;
  const rangTenue = p.equipement.findIndex((objet) => objet.place === "arme");
  const tenue = rangTenue >= 0 ? p.equipement[rangTenue] : null;
  const prendre = (nom) => o.modifier((q) => tenir(q.equipement, nom), { refaire: true, focus: idDeLArme(o, nom) });
  const mains = mainsNuesDe(o, fiche);
  const vignetteMains = vignette({
    id: "arme-aucune",
    name: "arme",
    nom: "Mains nues",
    choisie: !tenue,
    habit: "vignette-objet",
    contenu: [
      listeDeParametres(mains?.degats ? [["Dégâts", mains.degats.join("/")]] : []),
      mains && mains.nom !== "Mains nues" ? capacitesDeLaVignette(o, [{ nom: mains.nom, detail: "(bloc de base)" }]) : null,
      mentionDeMaitrise({ etat: "permis" }),
    ],
    onchange: () => prendre(null),
  });
  const vignettesArmes = o.index.blocsDeType("arme").map((bloc, i) => {
    const choisie = Boolean(tenue) && cle(tenue.nom) === cle(bloc.nom);
    const capacites = capacitesDeLObjet(o.index, bloc, choisie ? tenue.choix : []);
    const maitrise = maitriseDeLObjet(capacites, poidsDe(bloc), choisie ? rangs : rangsAvecLArme(o, bloc.nom));
    return vignette({
      id: `arme-${i}`,
      name: "arme",
      nom: [bloc.nom, etiquettesDePoids(poidsDe(bloc))],
      choisie,
      habit: maitrise.etat === "non" ? "vignette-objet non-maitrise" : "vignette-objet",
      coche: `${COCHE} tenue`,
      contenu: [listeDeParametres(parametresDeLObjet(o, bloc)), capacitesDeLaVignette(o, capacites, maitrise.horsMaitrise), anomaliesDeLObjet(o, bloc), mentionDeMaitrise(maitrise)],
      onchange: () => prendre(bloc.nom),
    });
  });
  return [
    el("h3", {}, "Arme"),
    el("p", { classe: "secondaire-texte petit" }, "Une seule arme se tient, équipée d'office (livret, « Objet »). Changer d'arme remplace celle-ci ; une arme de rechange s'ajoute dans « Tous les objets », rangée dans le sac."),
    el("fieldset", { classe: "groupe-choix groupe-vignettes" }, el("legend", {}, "Arme tenue"), el("div", { classe: "vignettes vignettes-equipement" }, vignetteMains, vignettesArmes)),
    tenue ? el("section", { classe: "bloc-choisi" }, el("h4", {}, tenue.nom), objetDecrit(o, tenue, rangTenue)) : null,
  ];
}

// Les pièces d'un pack : chacune avec les zones qu'elle couvre et son
// armure à la qualité de la création (valeursParametre, qualiteDe) ; une
// armure illisible, telle qu'écrite.
function piecesDuPack(o, pack) {
  return el(
    "ul",
    { classe: "pieces-pack" },
    pack.pieces.map((bloc) => {
      const parametre = bloc.parametres.find((p) => p.nom && !p.cible && cle(p.nom) === PARAMETRES.armure);
      const lu = parametre ? valeursParametre(parametre.nom, parametre.valeur, { caracteristiques: o.personnage.caracteristiques, qualite: qualiteDe(bloc, QUALITE_CREATION) }) : {};
      const zones = zonesCouvertes(bloc).map((code) => (lu.valeurs ? `${NOM_ZONE[code]} ${lu.valeurs[ZONES.findIndex((z) => z.code === code)]}` : NOM_ZONE[code]));
      const armure = lu.valeurs || !parametre ? "" : ` (armure telle qu'écrite : ${parametre.valeur})`;
      return el("li", {}, el("span", { classe: "capacite-objet" }, bloc.nom), " ", el("span", { classe: "detail" }, `${zones.join(", ") || "aucune zone"}${armure}`));
    }),
  );
}

// L'entrée « Pack d'armure » : un pack par type, formé de toutes les pièces
// de ce type, équipées d'office ; un type dont deux pièces couvrent une
// même zone n'a pas de pack (A10) : sa vignette est inactive, avec la
// raison. La maîtrise d'un pack se lit sur la Maîtrise de son poids, pour
// l'affichage seulement (maitriseDuPack).
function entreePack(o, rangs) {
  const p = o.personnage;
  const packs = packsDArmure(o.index.blocsDeType("armure"));
  const pieces = p.equipement.filter((objet) => objet.place === "pack");
  const actuel = packs.find((pack) => pieces.length && pack.pieces.length === pieces.length && pack.pieces.every((b) => pieces.some((objet) => cle(objet.nom) === cle(b.nom))));
  const choisir = (pack) =>
    o.modifier(
      (q) => {
        q.equipement = q.equipement.filter((objet) => objet.place !== "pack");
        if (!pack) return;
        const couvertes = new Set(pack.pieces.flatMap((b) => zonesCouvertes(b)));
        // Une pièce portée seule sur une zone du pack retourne au sac.
        q.equipement.forEach((objet) => {
          const bloc = o.index.bloc(objet.nom);
          if (objet.place === "equipe" && bloc && typeDe(bloc) === "armure" && zonesCouvertes(bloc).some((z) => couvertes.has(z))) objet.place = "sac";
        });
        for (const b of pack.pieces) q.equipement.push({ nom: b.nom, choix: [], qualite: QUALITE_CREATION, place: "pack" });
      },
      { refaire: true, focus: pack ? `pack-${pack.type}` : "pack-aucun" },
    );
  const vignetteDuPack = (pack) => {
    if (!pack.propose) {
      return vignette({
        id: `pack-${pack.type}`,
        name: "pack",
        nom: `Pack ${pack.nom}`,
        choisie: false,
        inactive: true,
        habit: "vignette-objet",
        contenu: [
          piecesDuPack(o, pack),
          el("p", { classe: "raison-inactive" }, `non proposé : ${pack.conflits.map((c) => `${c.nomZone.toLowerCase()} couvert par ${c.pieces.map((b) => b.nom).join(" et ")}`).join(" ; ")}`),
        ],
      });
    }
    const etat = maitriseDuPack(pack.type, rangs);
    return vignette({
      id: `pack-${pack.type}`,
      name: "pack",
      nom: `Pack ${pack.nom}`,
      choisie: actuel === pack,
      habit: etat === "non" ? "vignette-objet non-maitrise" : "vignette-objet",
      coche: `${COCHE} porté`,
      contenu: [piecesDuPack(o, pack), pack.pieces.map((bloc) => anomaliesDeLObjet(o, bloc)), mentionDeMaitrise({ etat })],
      onchange: () => choisir(pack),
    });
  };
  const aucun = vignette({
    id: "pack-aucun",
    name: "pack",
    nom: "Aucun pack",
    choisie: !pieces.length,
    habit: "vignette-objet",
    contenu: el("p", { classe: "vignette-capacites" }, "Les pièces se portent une à une, dans « Tous les objets »."),
    onchange: () => choisir(null),
  });
  return [
    el("h3", {}, "Pack d'armure"),
    el("p", { classe: "secondaire-texte petit" }, "Un pack par type : toutes les pièces de ce type, une par zone, portées d'office. Les pièces portées seules sur une zone du pack retournent au sac."),
    packs.length
      ? el("fieldset", { classe: "groupe-choix groupe-vignettes" }, el("legend", {}, "Pack d'armure"), el("div", { classe: "vignettes vignettes-equipement" }, aucun, packs.map(vignetteDuPack)))
      : el("p", { classe: "secondaire-texte" }, "La banque ne contient aucune pièce d'armure."),
    pieces.length ? el("ul", { classe: "objets" }, p.equipement.map((objet, rang) => (objet.place === "pack" ? carteObjet(o, objet, rang, { retirable: false }) : null))) : null,
  ];
}

// Une carte d'objet : son type, sa place, ses boutons (porter, équiper,
// prendre en main, ranger, retirer), ce qu'il donne.
function carteObjet(o, objet, rang, { retirable = true } = {}) {
  const bloc = o.index.bloc(objet.nom);
  const type = bloc ? typeDe(bloc) : null;
  const prefixe = `objet-${rang}`;
  const libelle = libelleObjet(o.personnage.equipement, rang);
  const placer = (place, focus = `${prefixe}-titre`) => o.modifier((p) => { p.equipement[rang].place = place; }, { refaire: true, focus });
  const boutons = [];
  const zoneCarte = el("div", {});
  let etat = "dans le sac";
  if (objet.place === "pack") etat = "pièce du pack, portée";
  else if (objet.place === "arme") etat = "tenue";
  else if (bloc && type === "arme") {
    boutons.push(
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          "aria-label": `Prendre en main ${libelle}`,
          onclick: () =>
            o.modifier(
              (p) => {
                // Une seule arme se tient : l'autre retourne au sac.
                p.equipement.forEach((autre) => {
                  if (autre.place === "arme") autre.place = "sac";
                });
                p.equipement[rang].place = "arme";
              },
              { refaire: true, focus: idDeLArme(o, objet.nom) },
            ),
        },
        "Prendre en main",
      ),
    );
  } else if (bloc && type === "armure") {
    if (objet.place === "equipe") {
      etat = "portée";
      boutons.push(el("button", { type: "button", classe: "bouton secondaire", "aria-label": `Ranger ${libelle}`, onclick: () => placer("sac") }, "Ranger"));
    } else {
      boutons.push(
        el(
          "button",
          {
            type: "button",
            classe: "bouton secondaire",
            "aria-label": `Porter ${libelle}`,
            onclick: () => {
              // Le livret (« Objet ») : pas deux pièces sur une même zone.
              const prises = zonesPortees(o, o.personnage, { sauf: rang });
              const genees = zonesCouvertes(bloc).filter((z) => prises[z]);
              if (genees.length) {
                direIci(zoneCarte, `« ${objet.nom} » ne se porte pas : ${genees.map((z) => `${NOM_ZONE[z]} déjà couvert par « ${prises[z]} »`).join(" ; ")} (livret, « Objet »). Rangez d'abord l'autre pièce.`);
                return;
              }
              placer("equipe");
            },
          },
          "Porter",
        ),
      );
    }
  } else if (bloc && estBouclier(bloc)) {
    if (objet.place === "equipe") {
      etat = "équipé";
      boutons.push(el("button", { type: "button", classe: "bouton secondaire", "aria-label": `Ranger ${libelle}`, onclick: () => placer("sac") }, "Ranger"));
    } else {
      boutons.push(
        el(
          "button",
          {
            type: "button",
            classe: "bouton secondaire",
            "aria-label": `Équiper ${libelle}`,
            onclick: () =>
              o.modifier(
                (p) => {
                  // Un seul bouclier compte : l'autre retourne au sac.
                  p.equipement.forEach((autre, k) => {
                    const b = o.index.bloc(autre.nom);
                    if (k !== rang && autre.place === "equipe" && b && typeDe(b) !== "armure" && estBouclier(b)) autre.place = "sac";
                  });
                  p.equipement[rang].place = "equipe";
                },
                { refaire: true, focus: `${prefixe}-titre` },
              ),
          },
          "Équiper",
        ),
      );
    }
  }
  if (retirable) {
    boutons.push(
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          "aria-label": `Retirer ${libelle}`,
          onclick: () =>
            o.modifier(
              (p) => {
                p.equipement.splice(rang, 1);
              },
              // Le focus va à l'objet suivant (ou au précédent) : la page ne
              // remonte pas en haut d'une longue liste.
              { refaire: true, focus: o.personnage.equipement.length > 1 ? `objet-${Math.min(rang, o.personnage.equipement.length - 2)}-titre` : "objet-a-ajouter" },
            ),
        },
        "Retirer",
      ),
    );
  }
  return el(
    "li",
    { classe: "objet" },
    el("h4", { id: `${prefixe}-titre`, tabindex: "-1" }, libelle, " ", el("span", { classe: "detail" }, bloc ? `${TYPES[type]?.nom ?? ""} · ${etat}` : "n'existe plus dans la banque")),
    boutons.length ? el("div", { classe: "boutons" }, boutons) : null,
    zoneCarte,
    objetDecrit(o, objet, rang),
  );
}

// L'entrée « Tous les objets » : armes, pièces d'armure isolées, bouclier,
// consommables et équipement, rangés dans le sac par défaut.
function entreeObjets(o) {
  const p = o.personnage;
  const apercu = el("div", { classe: "apercu-objet", "aria-live": "polite" });
  const zoneAjout = el("div", {});
  const choixObjet = el(
    "select",
    {
      id: "objet-a-ajouter",
      classe: "champ",
      // L'objet choisi se décrit avant d'être ajouté.
      onchange: (evenement) => {
        const bloc = evenement.target.value ? o.index.bloc(evenement.target.value) : null;
        zoneAjout.replaceChildren();
        apercu.replaceChildren(...(bloc ? [blocDecrit(o, bloc, { siVide: "Aucune capacité." })].flat(Infinity).filter(Boolean) : []));
      },
    },
    el("option", { value: "" }, "— choisir un objet —"),
    RUBRIQUES.map(([type, rubrique]) => {
      const blocs = o.index.blocsDeType(type);
      return blocs.length ? el("optgroup", { label: rubrique }, blocs.map((b) => el("option", { value: b.nom }, b.nom))) : null;
    }),
  );
  const ajouter = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      onclick: () => {
        const bloc = choixObjet.value ? o.index.bloc(choixObjet.value) : null;
        if (!bloc) {
          direIci(zoneAjout, "Choisissez d'abord un objet dans la liste.");
          return;
        }
        o.modifier((q) => { q.equipement.push({ nom: bloc.nom, choix: [], qualite: QUALITE_CREATION, place: "sac" }); }, { refaire: true, focus: `objet-${o.personnage.equipement.length}-titre` });
      },
    },
    "Ajouter",
  );
  const autres = p.equipement.map((objet, rang) => (objet.place === "arme" || objet.place === "pack" ? null : carteObjet(o, objet, rang))).filter(Boolean);
  return [
    el("h3", {}, "Tous les objets"),
    el("p", { classe: "secondaire-texte petit" }, "Un objet ajouté est rangé dans le sac ; une pièce d'armure se porte, un bouclier s'équipe, une arme se prend en main à la place de l'arme tenue. La qualité vaut 2 ; elle se change ensuite, sur l'écran du personnage."),
    el("label", { for: "objet-a-ajouter" }, "Objet"),
    choixObjet,
    apercu,
    el("div", { classe: "boutons" }, ajouter),
    zoneAjout,
    autres.length ? el("ul", { classe: "objets" }, autres) : el("p", { classe: "secondaire-texte" }, "Aucun autre objet."),
  ];
}

// En tête, la ligne des maîtrises du personnage ; puis l'arme tenue et le
// pack d'armure en vignettes, chacune avec son état de maîtrise (les rangs
// de sa fiche, ceux qu'il tient au combat, maitrise.js ; pour une arme
// candidate, ceux qu'il aurait en la tenant) ; enfin tous les objets.
function etapeEquipement(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const rangs = rangsDuPersonnage(fiche, o.index);
  return [
    el("p", { classe: "ligne-maitrises" }, ligneDesMaitrises(o.personnage.identite.nom, maitrisesDuPersonnage(fiche, o.index))),
    entreeArme(o, fiche, rangs),
    entreePack(o, rangs),
    entreeObjets(o),
  ];
}

// ─── Étape 8 : les capacités ────────────────────────────────────────────────

// Une souris, qui survole : le pointeur d'un ordinateur. Le téléphone se lit
// dans estEtroit() ; une fenêtre étroite à la souris a les deux.
const aLaSouris = () => Boolean(globalThis.matchMedia?.("(pointer: fine)").matches);

// L'origine d'une capacité : chaque bloc qui la donne, suivi de son type
// (« Grand Four · primordial ») ; plusieurs, séparées par des virgules.
const origineEcrite = (o, capacite) =>
  capacite.origines
    .map((nom) => {
      const code = typeDe(o.index.bloc(nom));
      return code ? `${nom} · ${TYPES[code].nom.toLowerCase()}` : nom;
    })
    .join(", ");

// L'effet au niveau actuel, tel que la fiche le montre (lecture.js) : une
// description par source qui en donne une différente, précédée de la source.
const effetsEcrits = (capacite) =>
  capacite.descriptions.length
    ? capacite.descriptions.map((d) => el("p", {}, `${capacite.descriptions.length > 1 ? `${d.source} : ` : ""}${d.texte.trim() || "Sans description."}`))
    : [el("p", {}, "Sans description.")];

// Les morceaux de difference() en nœuds : les mots marqués dans l'habit
// donné ; une espace seule entre deux mots marqués rejoint leur suite, pour
// que le trait ou la couleur ne se coupe pas entre eux.
function morceauxMarques(morceaux, marque, habiller) {
  const noeuds = [];
  let suite = null;
  morceaux.forEach((m, i) => {
    const lie = !m[marque] && suite !== null && m.texte.trim() === "" && morceaux[i + 1]?.[marque];
    if (m[marque] || lie) {
      suite = (suite ?? "") + m.texte;
      return;
    }
    if (suite !== null) noeuds.push(habiller(suite));
    suite = null;
    noeuds.push(m.texte);
  });
  if (suite !== null) noeuds.push(habiller(suite));
  return noeuds;
}

// Le coût et les paramètres d'une capacité à un niveau : le souffle, le lien
// (« sans coût » sans l'un ni l'autre), la portée, les dégâts.
function parametresEcrits(cout, portee, degats) {
  const parties = [];
  if (cout.souffle !== "0") parties.push({ nature: "souffle", valeur: cout.souffle, suite: " souffle" });
  if (cout.lien !== "0") parties.push({ nature: "lien", valeur: cout.lien, suite: " lien" });
  if (!parties.length) parties.push({ nature: "cout", valeur: "sans coût" });
  if (portee !== null) parties.push({ nature: "portee", tete: "portée ", valeur: String(portee) });
  if (degats) parties.push({ nature: "degats", tete: "dégâts ", valeur: degats.join("/") });
  return parties;
}

/**
 * Une capacité à un niveau, vue d'où la fiche la voit : sa description (la
 * source et la qualité de l'étape 8 d'avant, descriptionA), son coût, sa
 * portée (contexte) et ses dégâts, ceux que dit sa description à ce niveau
 * (degatsDecrits), sinon ceux que son bloc lui transmet. Le calcul
 * d'aujourd'hui, appliqué à un niveau candidat.
 */
function capaciteA(o, capacite, niveau) {
  const source = capacite.origines[0] ?? null;
  const objet = o.personnage.equipement.find((e) => cle(e.nom) === cle(source ?? ""));
  const qualite = objet?.qualite ?? QUALITE_CREATION;
  const d = descriptionA(o.index, o.personnage, capacite.nom, { bloc: source, niveau, qualite });
  const bloc = source ? (o.index.bloc(source) ?? null) : null;
  const deLaBanque = o.index.capacite(capacite.nom);
  const variables = contexte(o.index, o.personnage, bloc, bloc ? qualiteDe(bloc, qualite) : null, deLaBanque, niveau);
  const degats = degatsDecrits(o.index, o.personnage, bloc, deLaBanque, niveau) ?? variables.get(PARAMETRES.degats)?.valeurs ?? null;
  const portee = variables.get(PARAMETRES.portee)?.valeurs?.[0] ?? null;
  return { texte: d.texte.trim() || "Sans description.", parametres: parametresEcrits(d.cout, portee, degats) };
}

/**
 * La comparaison d'une capacité avec son niveau suivant (§ 15.3) : le
 * titre ; ce que la montée coûte, ou ce qui lui manque ; le coût et les
 * paramètres au niveau suivant ; sa description, les mots ajoutés en
 * --difference ; la description actuelle, les mots retirés barrés ; la
 * légende. Jamais la couleur seule : la graisse, le trait et la légende.
 */
function comparaison(o, capacite, { reliquat, ecart, manque, permis }) {
  const suivant = capacite.niveau + 1;
  const actuel = capaciteA(o, capacite, capacite.niveau);
  const apres = capaciteA(o, capacite, suivant);
  const changee = (partie) => actuel.parametres.find((p) => p.nature === partie.nature)?.valeur !== partie.valeur;
  const enDifference = (texte) => el("span", { classe: "difference" }, texte);
  const mots = difference(actuel.texte, apres.texte);
  return {
    titre: `${capacite.nom} — niveau ${suivant}`,
    corps: [
      // « 4 → 2 » d'un seul tenant (la feuille) : au téléphone, la flèche et
      // le second nombre se séparaient.
      el(
        "p",
        { classe: "comparaison-sous" },
        permis
          ? [accorder(`après progression · ${ecart} point(s) de plus (reliquat `), el("span", { classe: "comparaison-reliquat" }, `${reliquat} → ${reliquat - ecart}`), ")"]
          : accorder(`après progression · il manque ${manque} point(s)`),
      ),
      el(
        "p",
        { classe: "comparaison-cout" },
        "Coût : ",
        apres.parametres.map((p, i) => [i ? " · " : "", p.tete ?? "", changee(p) ? enDifference(p.valeur) : p.valeur, p.suite ?? ""]),
      ),
      el("p", { classe: "comparaison-texte" }, morceauxMarques(mots.apres, "ajoute", enDifference)),
      el("p", { classe: "comparaison-avant" }, `Niveau ${capacite.niveau} : `, morceauxMarques(mots.avant, "retire", (texte) => el("s", {}, texte))),
      el("p", { classe: "comparaison-legende" }, "En ", enDifference("rouge"), " : ce qui change par rapport au niveau actuel."),
    ],
  };
}

// Une vignette par capacité, hors « à venir », qu'elle puisse évoluer ou
// non (décision de l'auteur, 26/10/2026) : son nom, son origine, la ligne de
// niveau quand elle évolue, son effet au niveau actuel, la raison de son
// « + ». Le niveau suivant se compare au niveau actuel : au survol ou au
// focus de « + » sur un ordinateur, par « Niveau suivant ▸ » partout.
function etapeCapacites(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const { points } = fiche;
  const souris = aLaSouris();
  const etroit = estEtroit();
  const changer = (capacite, niveau, focus) =>
    o.modifier(
      (q) => {
        q.niveaux = q.niveaux.filter((m) => cle(o.index.capacite(m.capacite)?.nom ?? m.capacite) !== cle(capacite.nom));
        if (niveau !== capacite.niveauCreation) q.niveaux.push({ capacite: capacite.nom, niveau });
      },
      { refaire: true, focus },
    );

  // L'infobulle montrée, une seule à la fois : par le survol de « + » (tant
  // que la souris reste sur la vignette ou sur elle), par son focus, ou
  // épinglée par « Niveau suivant ▸ ». Le volet du bas, sur un téléphone.
  // Échap ferme l'une et l'autre, où que soit le focus : il s'écoute sur la
  // page tant que l'une est ouverte.
  let montree = null;
  const volet = etroit ? el("div", { classe: "volet-niveau", role: "dialog", "aria-labelledby": "volet-niveau-titre", hidden: true }) : null;
  let ouvreur = null;
  const voletOuvert = () => volet !== null && !volet.hidden;
  const racine = () => globalThis.document?.documentElement ?? null;
  const ecouterEchap = () => {
    if (montree !== null || voletOuvert()) racine()?.addEventListener("keydown", surEchap);
    else racine()?.removeEventListener?.("keydown", surEchap);
  };
  const cacher = (entree) => {
    Object.assign(entree, { survolee: false, focalisee: false, epinglee: false });
    entree.noeud.hidden = true;
    entree.bouton?.setAttribute("aria-expanded", "false");
    if (montree === entree) montree = null;
    ecouterEchap();
  };
  const revoir = (entree) => {
    if (!entree.survolee && !entree.focalisee && !entree.epinglee) {
      cacher(entree);
      return;
    }
    if (montree !== null && montree !== entree) cacher(montree);
    montree = entree;
    entree.noeud.hidden = false;
    entree.bouton?.setAttribute("aria-expanded", String(entree.epinglee));
    ecouterEchap();
  };
  // « Fermer » et Échap rendent le focus au bouton qui a ouvert le volet ;
  // le focus parti ailleurs (rendre: false) reste où il est allé.
  const fermerVolet = ({ rendre = true } = {}) => {
    if (!voletOuvert()) return;
    volet.hidden = true;
    volet.replaceChildren();
    const retour = ouvreur;
    ouvreur = null;
    ecouterEchap();
    if (rendre) retour?.focus();
  };
  // Le volet ne retient pas le focus : quand il le quitte pour un élément
  // hors de lui (Tab après « Passer au niveau N+1 », Maj+Tab depuis son
  // titre), il se ferme, sans quoi cet élément resterait caché dessous
  // (WCAG 2.4.11). Vers rien (une autre fenêtre, un clic sur un fond), il
  // reste ouvert.
  volet?.addEventListener("focusout", (evenement) => {
    const vers = evenement?.relatedTarget ?? null;
    if (vers !== null && !volet.contains(vers)) fermerVolet({ rendre: false });
  });
  const ouvrirVolet = (bouton, { titre, corps }, passer) => {
    const entete = el("h3", { id: "volet-niveau-titre", classe: "volet-niveau-titre", tabindex: "-1" }, titre);
    volet.replaceChildren(
      el("span", { classe: "volet-poignee", "aria-hidden": "true" }),
      entete,
      ...corps,
      el("div", { classe: "boutons" }, el("button", { type: "button", classe: "bouton secondaire", onclick: () => fermerVolet() }, "Fermer"), passer),
    );
    volet.hidden = false;
    ouvreur = bouton;
    ecouterEchap();
    entete.focus();
  };
  // Une infobulle ou un volet d'un rendu que la page a quitté ne prend pas Échap.
  function surEchap(evenement) {
    if (evenement?.key !== "Escape") return;
    const prise = (montree !== null && montree.noeud.isConnected !== false) || (voletOuvert() && volet.isConnected !== false);
    if (montree !== null) cacher(montree);
    fermerVolet();
    if (prise) evenement.preventDefault?.();
    else racine()?.removeEventListener?.("keydown", surEchap);
  }

  const vignettes = fiche.capacites
    .filter((c) => !c.aVenir)
    .map((capacite, i) => {
      const id = `niveau-${i}`;
      const evolue = capacite.peutEvoluer && capacite.niveauCreation >= 1;
      const suivant = capacite.niveau + 1;
      const auMaximum = suivant > capacite.niveauMax;
      const permis = evolue && !auMaximum && niveauxPermis(fiche, capacite).includes(suivant);
      const ecart = auMaximum ? 0 : COUT_NIVEAU[suivant] - COUT_NIVEAU[capacite.niveau];
      const manque = auMaximum ? 0 : points.depenses + ecart - POINTS_CREATION;
      const raison =
        capacite.niveau === 0
          ? "Niveau 0 : cette capacité n'évolue pas."
          : !evolue || auMaximum
            ? "Niveau maximal atteint."
            : accorder(permis ? `Niveau ${suivant} : ${ecart} point(s) de plus.` : `Niveau ${suivant} : il manque ${manque} point(s).`);
      const etat = { reliquat: points.reliquat, ecart, manque, permis };
      const compare = evolue && !auMaximum;
      // L'infobulle : sur un ordinateur, pour « + » ; ailleurs qu'au téléphone, pour « Niveau suivant ▸ ».
      const bulle = compare && (souris || !etroit) ? { noeud: null, bouton: null, survolee: false, focalisee: false, epinglee: false } : null;
      if (bulle) {
        const { titre, corps } = comparaison(o, capacite, etat);
        bulle.noeud = el("div", { id: `${id}-comparaison`, classe: "infobulle-niveau", role: "tooltip", hidden: true }, el("p", { classe: "comparaison-titre" }, titre), corps);
      }
      const plusAvecBulle = bulle !== null && souris;
      const moins = evolue
        ? el(
            "button",
            { type: "button", id: `${id}-moins`, classe: "bouton secondaire bouton-pas", "aria-label": `Baisser ${capacite.nom}`, disabled: capacite.niveau <= capacite.niveauCreation, onclick: () => changer(capacite, capacite.niveau - 1, [`${id}-moins`, `${id}-plus`]) },
            "−",
          )
        : null;
      const plus = evolue
        ? el(
            "button",
            {
              type: "button",
              id: `${id}-plus`,
              classe: "bouton secondaire bouton-pas",
              "aria-label": `Monter ${capacite.nom}`,
              "aria-describedby": plusAvecBulle ? `${id}-raison ${id}-comparaison` : `${id}-raison`,
              disabled: !permis,
              onclick: () => changer(capacite, suivant, [`${id}-plus`, `${id}-moins`]),
            },
            "+",
          )
        : null;
      if (plusAvecBulle) {
        plus.addEventListener("pointerenter", (evenement) => {
          if (evenement?.pointerType === "touch") return;
          bulle.survolee = true;
          revoir(bulle);
        });
        plus.addEventListener("focus", () => {
          bulle.focalisee = true;
          revoir(bulle);
        });
        plus.addEventListener("blur", () => {
          bulle.focalisee = false;
          revoir(bulle);
        });
      }
      // « Niveau suivant ▸ » : une divulgation de l'infobulle, ou le volet du téléphone.
      let suite = null;
      if (compare) {
        // Le nom accessible est « Niveau suivant » : la flèche ne se lit pas.
        suite = el("button", { type: "button", id: `${id}-suivant`, classe: "bouton-suivant" }, "Niveau suivant ", el("span", { "aria-hidden": "true" }, "▸"));
        if (etroit) {
          suite.setAttribute("aria-haspopup", "dialog");
          suite.addEventListener("click", () => {
            const passer = el(
              "button",
              { type: "button", classe: "bouton", disabled: !permis, "aria-describedby": `${id}-raison`, onclick: () => changer(capacite, suivant, [`${id}-suivant`, `${id}-plus`, `${id}-moins`]) },
              `Passer au niveau ${suivant}`,
            );
            ouvrirVolet(suite, comparaison(o, capacite, etat), passer);
          });
        } else {
          bulle.bouton = suite;
          suite.setAttribute("aria-expanded", "false");
          suite.setAttribute("aria-controls", `${id}-comparaison`);
          suite.addEventListener("click", () => {
            const fermer = bulle.epinglee;
            bulle.epinglee = !fermer;
            if (fermer) cacher(bulle);
            else revoir(bulle);
          });
        }
      }
      const ameliore = capacite.niveau > capacite.niveauCreation;
      const vignetteDeLaCapacite = el(
        "li",
        { classe: ameliore ? "vignette vignette-capacite amelioree" : "vignette vignette-capacite" },
        el(
          "p",
          { classe: "vignette-capacite-tete" },
          el("span", { classe: "capacite-nom" }, capacite.nom),
          " ",
          el("span", { classe: "detail" }, origineEcrite(o, capacite)),
          ameliore ? [" ", el("span", { classe: "mention-amelioree" }, "amélioré")] : null,
        ),
        evolue
          ? el(
              "div",
              { classe: "capacite-niveau" },
              el("div", { classe: "pas-a-pas" }, moins, el("span", { id, classe: "valeur-pas", "aria-live": "polite" }, `niveau ${capacite.niveau}`), plus),
              el("span", { classe: "detail cout-capacite" }, `coût : ${coutLisible(capacite.cout)}`),
            )
          : null,
        el("div", { classe: "vignette-capacite-effet" }, effetsEcrits(capacite)),
        el("div", { classe: "vignette-capacite-pied" }, el("p", { id: `${id}-raison`, classe: "secondaire-texte petit" }, raison), suite),
        bulle?.noeud ?? null,
      );
      // La souris qui quitte la vignette, et l'infobulle qui en fait partie.
      if (plusAvecBulle) {
        vignetteDeLaCapacite.addEventListener("pointerleave", () => {
          bulle.survolee = false;
          revoir(bulle);
        });
      }
      return vignetteDeLaCapacite;
    });

  const jauge = el(
    "span",
    { classe: "jauge-points", "aria-hidden": "true" },
    Array.from({ length: points.plafond }, (_, i) => el("span", { classe: i < points.depenses ? "jauge-case" : "jauge-case vide" })),
  );
  return [
    el(
      "div",
      { classe: "points-capacites" },
      el("p", { classe: "compteur-points", role: "status" }, el("span", {}, `Points dépensés : ${points.depenses} / ${points.plafond}`), " ", jauge, " ", el("span", {}, `reliquat : ${points.reliquat}`)),
      el(
        "p",
        { classe: "secondaire-texte petit" },
        `Points d'une capacité : ${COUT_NIVEAU.slice(1).map((cout, i) => `niveau ${i + 1} = ${cout}`).join(", ")} ; les capacités de niveau 0 ne comptent pas.`,
        souris ? " Survolez « + » pour voir le niveau suivant." : null,
      ),
    ),
    points.recus > points.plafond ? el("p", { classe: "message" }, `Les capacités reçues valent déjà ${points.recus} points : aucune montée n'est possible.`) : null,
    vignettes.length ? el("ul", { classe: "vignettes-capacites" }, vignettes) : el("p", { classe: "secondaire-texte" }, "Le personnage n'a encore aucune capacité."),
    volet,
  ];
}

// ─── Étape 9 : le récapitulatif et l'enregistrement ─────────────────────────

function etapeRecapitulatif(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const incomplet = manques(o.banque, o.personnage, { index: o.index, fiche })[9].length > 0;
  const raison = incomplet ? "raison-enregistrer" : null;
  const enregistrer = el(
    "button",
    { type: "button", classe: "bouton", disabled: incomplet, "aria-describedby": raison, onclick: () => o.enregistrerDefinitivement(enregistrer) },
    "Enregistrer",
  );
  const parties = [lecture(fiche), el("h3", {}, "Enregistrer")];
  if (o.remplaceId) {
    // Une copie de travail : elle remplace le personnage, ou devient un autre.
    const nom = el("input", { type: "text", id: "autre-nom", classe: "champ", maxlength: 120, autocomplete: "off" });
    nom.value = `${nomDe(o.personnage)} (copie)`;
    const sousAutreNom = el(
      "button",
      { type: "button", classe: "bouton secondaire", disabled: incomplet, "aria-describedby": raison, onclick: () => o.enregistrerDefinitivement(sousAutreNom, { nom: nom.value }) },
      "Enregistrer sous un autre nom",
    );
    parties.push(
      el("p", {}, `« Enregistrer » remplace ${o.nomOriginal ? `« ${o.nomOriginal} »` : "l'original"} ; « Enregistrer sous un autre nom » en fait un nouveau personnage et laisse l'original tel quel.`),
      el("div", { classe: "boutons" }, enregistrer),
      el("label", { for: "autre-nom" }, "Autre nom"),
      nom,
      el("div", { classe: "boutons" }, sousAutreNom),
    );
  } else {
    parties.push(el("p", {}, "Après l'enregistrement, le personnage reste modifiable : « Modifier », sur sa fiche, rouvre ce parcours."), el("div", { classe: "boutons" }, enregistrer));
  }
  if (o.enLigne) parties.push(el("p", { classe: "secondaire-texte petit" }, o.enLigne));
  if (incomplet) parties.push(el("p", { id: "raison-enregistrer", classe: "secondaire-texte petit" }, "Inactif tant qu'il manque quelque chose : voir « Ce qui manque », en haut de l'étape."));
  return parties;
}

const CONSTRUCTEURS = {
  1: etapeIdentite,
  2: etapeCaracteristiques,
  3: (o) => etapeBloc(o, "archetype", { intitule: "Archétype", aucun: "La banque ne contient aucun archétype." }),
  4: (o) => etapeBloc(o, "espece", { intitule: "Espèce", aucun: "La banque ne contient aucune espèce." }),
  5: etapeConstellation,
  6: (o) => etapeBloc(o, "primordial", { intitule: "Primordial", aucun: "La banque ne contient aucun primordial." }),
  7: etapeEquipement,
  8: etapeCapacites,
  9: etapeRecapitulatif,
};

// ─── Le parcours ────────────────────────────────────────────────────────────

function parcours(contexte, n, lu, entete, contenu, { original = null, remplaceId = null, nomOriginal = null } = {}) {
  // Une copie de travail remplace son original par son identifiant, même
  // quand l'original ne se lit pas pour l'instant (relecture du lot 2 bis) :
  // ses dates viennent de la copie, qui en est un clone.
  const copie = Boolean(remplaceId);
  const { banque, etagere } = contexte.etat;
  const index = indexerCreation(banque);
  const depot = contexte.etat.depot ?? null;
  let personnage = lu;
  let dernier = 0;
  const etapes = el("ol", { classe: "etapes" });
  const zoneManques = el("div", { classe: "manques", role: "status" });
  const corps = el("div", { classe: "etape" });
  const zoneMessage = el("div", {});
  const ligneEtat = el("p", { classe: "secondaire-texte petit", role: "status" });

  const dire = (texte) => zoneMessage.replaceChildren(el("p", { classe: "message", role: "alert" }, texte));

  // Chaque écriture part aussitôt : IndexedDB les exécute dans l'ordre où
  // elles sont ouvertes, si bien que l'étape suivante lit la dernière.
  const enregistrer = ({ silencieux = false } = {}) => {
    const numero = ++dernier;
    return etagere.garder(personnage).then(
      () => {
        if (!silencieux && numero === dernier) ligneEtat.textContent = `Brouillon enregistré à ${heure()}`;
      },
      (erreur) => dire(`Le brouillon n'a pas pu être enregistré : ${texteErreur(erreur)}`),
    );
  };

  const actualiser = () => {
    const liste = manques(banque, personnage, { index });
    etapes.replaceChildren(
      ...ETAPES.map((e) => {
        const complete = liste[e.numero].length === 0;
        return el(
          "li",
          {},
          el(
            "a",
            { href: adressePersonnage(personnage.id, e.numero), "aria-current": e.numero === n ? "step" : null },
            el("span", {}, `${e.numero}. ${e.titre}`),
            el("span", { classe: "detail" }, complete ? "complète" : "à compléter"),
          ),
        );
      }),
    );
    zoneManques.replaceChildren(
      el("p", { classe: "manques-titre" }, "Ce qui manque"),
      liste[n].length ? el("ul", {}, liste[n].map((m) => el("li", {}, m))) : el("p", {}, "Rien ne manque à cette étape."),
    );
    renommer(entete, copie ? `Modification — ${nomDe(personnage)}` : `Création — ${nomDe(personnage)}`);
  };

  // Refaire l'étape garde l'état, ouvert ou fermé, des descriptions ; le
  // focus va au premier élément actif de la liste donnée.
  const refaire = (focus = null) => {
    const etats = new Map([...corps.querySelectorAll("details")].filter((d) => d.getAttribute("data-cle")).map((d) => [d.getAttribute("data-cle"), d.getAttribute("open") !== null]));
    corps.replaceChildren(...[CONSTRUCTEURS[n](outils)].flat(Infinity).filter((partie) => partie !== null && partie !== undefined && partie !== false));
    for (const d of corps.querySelectorAll("details")) {
      const cleDetails = d.getAttribute("data-cle");
      if (!cleDetails || !etats.has(cleDetails)) continue;
      if (etats.get(cleDetails)) d.setAttribute("open", "");
      else d.removeAttribute("open");
    }
    actualiser();
    for (const id of [focus].flat().filter(Boolean)) {
      const cible = corps.querySelector(`#${id}`);
      if (cible && !cible.disabled) {
        cible.focus();
        break;
      }
    }
  };

  // Un changement se fait sur une copie, vérifiée comme un fichier reçu :
  // refusée, elle ne touche ni l'écran ni l'appareil.
  const modifier = (changer, { refaire: aRefaire = false, focus = null } = {}) => {
    const essai = structuredClone(personnage);
    changer(essai);
    // Une montée dont la capacité n'est plus possédée (archétype, option ou
    // objet changé) s'efface : l'étape 8 ne pourrait plus la retirer.
    if (essai.niveaux.length) {
      const possedees = new Set(calculerFiche(banque, essai, { index }).capacites.filter((c) => !c.aVenir).map((c) => cle(c.nom)));
      essai.niveaux = essai.niveaux.filter((m) => possedees.has(cle(index.capacite(m.capacite)?.nom ?? m.capacite)));
    }
    essai.etape = n;
    essai.modifie_le = new Date().toISOString();
    try {
      verifier(essai);
    } catch (erreur) {
      if (!(erreur instanceof ErreurPersonnage)) throw erreur;
      dire(`Ce changement n'est pas gardé : ${erreur.message}`);
      return false;
    }
    zoneMessage.replaceChildren();
    personnage = essai;
    enregistrer();
    if (aRefaire) refaire(focus);
    else actualiser();
    return true;
  };

  // Enregistrer : le brouillon devient un personnage enregistré. Une copie de
  // travail prend l'identifiant de l'original (« Enregistrer ») ou garde le
  // sien sous un autre nom (« Enregistrer sous un autre nom »). En ligne, le
  // personnage part ensuite par un ticket (§ 15.8).
  const enregistrerDefinitivement = async (bouton, { nom = null } = {}) => {
    const fiche = calculerFiche(banque, personnage, { index });
    if (manques(banque, personnage, { index, fiche })[9].length) return;
    if (nom !== null) {
      const propre = nom.trim();
      if (!propre || propre.length > 120) {
        dire("Donnez l'autre nom, 120 signes au plus.");
        return;
      }
      if (copie && nomOriginal && cle(propre) === cle(nomOriginal)) {
        dire(`« ${propre} » est le nom de l'original : choisissez-en un autre, ou « Enregistrer » pour le remplacer.`);
        return;
      }
    }
    const maintenant = new Date().toISOString();
    const remplace = copie && nom === null;
    const final = {
      ...structuredClone(personnage),
      id: remplace ? remplaceId : personnage.id,
      etat: "enregistre",
      etape: n,
      modifie_le: maintenant,
      cree_le: remplace ? (original?.cree_le ?? personnage.cree_le) : nom !== null ? maintenant : personnage.cree_le,
      enregistre_le: remplace ? (original?.enregistre_le ?? personnage.enregistre_le ?? maintenant) : maintenant,
      banque: { empreinte: contexte.etat.chargement?.enveloppe?.empreinte ?? "", publiee_le: banque.publiee_le ?? null },
      empreintes: relever(index, fiche, personnage),
    };
    if (nom !== null) final.identite = { ...final.identite, nom: nom.trim() };
    bouton.disabled = true;
    try {
      verifier(final);
      await etagere.garder(final);
      if (final.id !== personnage.id) await etagere.effacer(personnage.id);
      await etagere.garderNote?.(final.id, null);
      if (final.id !== personnage.id) await etagere.garderNote?.(personnage.id, null);
    } catch (erreur) {
      dire(`Le personnage n'a pas pu être enregistré : ${texteErreur(erreur)}`);
      bouton.disabled = false;
      return;
    }
    personnage = final;
    // Le dépôt en ligne ne retient pas l'enregistrement : un échec laisse le
    // personnage sur l'appareil, « non envoyé », avec « Réessayer ».
    if (depot) await depot.envoyer(final, { action: remplace ? "remplacer" : "creer" }).catch(() => {});
    contexte.naviguer(adressePersonnage(final.id));
  };

  const outils = {
    index,
    banque,
    get personnage() {
      return personnage;
    },
    original,
    remplaceId,
    nomOriginal,
    enLigne: depot?.phraseEnregistrement ?? null,
    refaire: (focus) => refaire(focus),
    modifier,
    dire,
    enregistrerDefinitivement,
  };

  const precedent = n > 1 ? el("a", { classe: "bouton secondaire", href: adressePersonnage(personnage.id, n - 1) }, "Précédent") : null;
  const suivant = n < ETAPES.length ? el("a", { classe: "bouton", href: adressePersonnage(personnage.id, n + 1) }, "Suivant") : null;
  // Sur un téléphone, les neuf étapes viennent après le contenu : en tête,
  // elles repoussaient chaque champ sous le pli (relecture du lot 2).
  const navigation = el("nav", { classe: "navigation-etapes", "aria-label": copie ? "Étapes de la modification" : "Étapes de la création" }, etapes);
  const etroit = estEtroit();
  contenu.replaceChildren(
    ...[
      etroit ? null : navigation,
      copie ? el("p", { classe: "message" }, `Copie de travail de ${nomOriginal ? `« ${nomOriginal} »` : "l'original"} : l'original ne change qu'à l'enregistrement.`) : null,
      el("h2", {}, `Étape ${n} sur ${ETAPES.length} : ${ETAPES[n - 1].titre}`),
      zoneManques,
      corps,
      zoneMessage,
      el("div", { classe: "boutons suite-etapes" }, precedent, suivant),
      ligneEtat,
      etroit ? navigation : null,
      versLaListe(),
    ].filter(Boolean),
  );
  refaire();
  // « Reprendre » rouvre la dernière étape vue ; la date de modification
  // ne bouge pas pour une simple visite.
  if (personnage.etape !== n) {
    personnage = { ...personnage, etape: n };
    enregistrer({ silencieux: true });
  }
}

/**
 * La copie de travail d'un personnage enregistré (« Modifier ») : un
 * brouillon sous un nouvel identifiant, qui note l'original qu'il remplace.
 * Une copie déjà ouverte pour cet original est reprise. Rend son identifiant.
 */
export async function copieDeTravail(etagere, original) {
  const notes = (await etagere.listerNotes?.()) ?? [];
  for (const note of notes.filter((n) => n.remplace === original.id)) {
    if (await etagere.lire(note.id)) return note.id;
  }
  const copie = { ...structuredClone(original), id: nouvelIdentifiant(), etat: "brouillon", etape: 1, modifie_le: new Date().toISOString() };
  verifier(copie);
  await etagere.garder(copie);
  await etagere.garderNote?.(copie.id, { remplace: original.id, nom: original.identite.nom.trim() || null });
  return copie.id;
}

/** L'écran d'une étape du parcours de création. */
export function afficher(contexte, route) {
  const entete = titre("Création d'un personnage");
  const contenu = el("div", {}, el("p", { classe: "attente", role: "status" }, "Lecture du personnage…"));
  const ecran = el("section", { classe: "creation" }, entete, contenu);
  const verdict = banqueUtilisable(contexte.etat.banque);
  if (verdict.erreur) {
    contenu.replaceChildren(el("p", { classe: "message", role: "alert" }, verdict.erreur), versLaListe());
    return ecran;
  }
  const etagere = contexte.etat.etagere;
  etagere
    .lire(route.id)
    .then(async (personnage) => {
      if (!personnage) {
        renommer(entete, "Personnage introuvable sur cet appareil");
        contenu.replaceChildren(el("p", {}, "Il a pu être supprimé, ou créé sur un autre appareil : importez son fichier."), versLaListe());
        return;
      }
      if (personnage.etat === "enregistre") {
        // Un enregistré se modifie par une copie de travail.
        renommer(entete, `Création — ${nomDe(personnage)}`);
        const modifier = el(
          "button",
          {
            type: "button",
            classe: "bouton",
            onclick: async () => {
              modifier.disabled = true;
              try {
                contexte.naviguer(adressePersonnage(await copieDeTravail(etagere, personnage), 1));
              } catch (erreur) {
                modifier.disabled = false;
                contenu.append(el("p", { classe: "message", role: "alert" }, `La copie de travail n'a pas pu être créée : ${texteErreur(erreur)}`));
              }
            },
          },
          "Modifier",
        );
        contenu.replaceChildren(
          el("p", { classe: "message" }, "Ce personnage est enregistré : « Modifier » en ouvre une copie de travail, qui le remplace à l'enregistrement ou devient un autre personnage."),
          el("div", { classe: "boutons" }, modifier),
          el("p", { classe: "lien-retour" }, el("a", { href: adressePersonnage(personnage.id) }, "Ouvrir sa fiche")),
        );
        return;
      }
      const note = (await etagere.lireNote?.(personnage.id)) ?? null;
      const original = note?.remplace ? ((await etagere.lire(note.remplace)) ?? (await contexte.etat.depot?.chercher?.(note.remplace))?.personnage ?? null) : null;
      parcours(contexte, route.etape, personnage, entete, contenu, { original, remplaceId: note?.remplace ?? null, nomOriginal: note?.nom ?? original?.identite.nom ?? null });
    })
    .catch((erreur) => contenu.replaceChildren(el("p", { classe: "message", role: "alert" }, `Le personnage n'a pas pu être lu : ${texteErreur(erreur)}`), versLaListe()));
  return ecran;
}
