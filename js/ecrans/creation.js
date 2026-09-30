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
// Aucune règle du jeu n'est écrite ici : ce qui manque, les montées
// permises et le tirage viennent de parcours.js, la fiche de calcul.js, les
// packs de packs.js, les nombres de regles.js.

import { cle } from "../banque/noms.js";
import { TYPES, typeDe } from "../banque/types.js";
import { coutEcrit, lecture } from "../fiche/lecture.js";
import { calculerFiche, capacitesDuBloc, descriptionA, estBouclier, indexerCreation } from "../personnage/calcul.js";
import { ErreurPersonnage, nouvelIdentifiant, verifier } from "../personnage/format.js";
import { NOMS_PACK, packsDArmure, zonesCouvertes } from "../personnage/packs.js";
import { ETAPES, banqueUtilisable, manques, niveauxPermis, tirerConstellation } from "../personnage/parcours.js";
import {
  CARACTERISTIQUES,
  CARACTERISTIQUE_MAX,
  CARACTERISTIQUE_MIN,
  COUT_NIVEAU,
  DES,
  ELEMENTS,
  POINTS_CREATION,
  SOMME_CARACTERISTIQUES,
  TYPES_OBJET,
  ZONES,
  deDuJet,
} from "../personnage/regles.js";
import { relever } from "../personnage/suivi.js";
import { adressePersonnage } from "../routes.js";
import { el, titre, titrer } from "./dom.js";

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
 * écran, à déplier sous son nom sur un téléphone.
 */
function capaciteDecrite(o, nom, { bloc = null, niveau = null, qualite = QUALITE_CREATION, intitule = null, cle: cleEtat = null } = {}) {
  const d = descriptionA(o.index, o.personnage, nom, { bloc, niveau, qualite });
  if (!d) return el("li", { classe: "capacite-decrite" }, el("span", { classe: "capacite-nom" }, intitule ?? nom), el("span", { classe: "detail" }, " — capacité à venir"));
  return el(
    "li",
    { classe: "capacite-decrite" },
    el(
      "details",
      { open: !estEtroit(), "data-cle": cleEtat ?? `${bloc ?? ""}|${nom}|${niveau ?? ""}|${intitule ?? ""}` },
      el("summary", {}, el("span", { classe: "capacite-nom" }, intitule ?? d.nom), " ", el("span", { classe: "detail" }, `niveau ${d.niveau} · ${coutLisible(d.cout)}`)),
      el("p", { classe: "capacite-texte" }, d.texte.trim() || "Sans description."),
    ),
  );
}

const capacitesDecrites = (o, noms, options = {}) => (noms.length ? el("ul", { classe: "capacites-decrites" }, noms.map((nom) => capaciteDecrite(o, nom, options))) : null);

// Ce qu'un bloc donne, décrit : ses capacités, puis ses groupes de choix
// quand ils ne sont pas proposés ailleurs dans la page.
function blocDecrit(o, bloc, { avecGroupes = true, qualite = QUALITE_CREATION, siVide = "Capacités à venir." } = {}) {
  const { capacites, groupes } = capacitesDuBloc(bloc, []);
  const parties = [capacitesDecrites(o, capacites.map((c) => c.nom), { bloc: bloc.nom, qualite })];
  if (avecGroupes) {
    for (const g of groupes) {
      parties.push(
        el("p", { classe: "secondaire-texte petit" }, g.forme === "choix" ? "Au choix, une option :" : "Facultatif, aucune, une ou plusieurs options :"),
        capacitesDecrites(o, g.options, { bloc: bloc.nom, qualite }),
      );
    }
  }
  if (!capacites.length && !groupes.length && siVide) parties.push(el("p", { classe: "secondaire-texte petit" }, siVide));
  return parties;
}

// ─── Les groupes de choix d'un bloc ─────────────────────────────────────────

// Une capacité porte l'élément si l'une de ses variantes l'a parmi ses
// éléments propres (convention du lot 2 pour styles et maîtrises, § 12).
function porteElement(capacite, nomElement) {
  return Boolean(capacite?.variantes.some((v) => v.elements.some((e) => e.nom && cle(e.nom) === cle(nomElement))));
}

function legende(index, groupe) {
  const toutes = (nomElement) => groupe.options.length > 0 && groupe.options.every((option) => porteElement(index.capacite(option), nomElement));
  if (toutes(ELEMENTS.style)) return ELEMENTS.style;
  if (toutes(ELEMENTS.maitrise)) return ELEMENTS.maitrise;
  return groupe.forme === "choix" ? "Au choix" : "Facultatif";
}

/**
 * Les groupes de choix d'un bloc : ( a | b ) en boutons radio, [ a | b ] en
 * cases à cocher, chaque option avec sa description. ecrire(q, choix) range
 * la liste des options choisies dans le personnage q ; un choix qui n'est
 * plus une option s'y perd.
 */
function groupesDeChoix(o, bloc, choix, prefixe, ecrire, { qualite = QUALITE_CREATION } = {}) {
  const { groupes } = capacitesDuBloc(bloc, choix);
  return groupes.map((groupe, g) => {
    const options = groupe.options.map((option, i) => {
      const id = `${prefixe}-g${g}-${i}`;
      const unique = groupe.forme === "choix";
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
            checked: groupe.choisies.some((c) => cle(c) === cle(option)),
            onchange: (evenement) => {
              const sans = (liste) => liste.filter((c) => cle(c) !== cle(option));
              const nouveaux = groupes.flatMap((autre, k) => {
                if (k !== g) return autre.choisies;
                if (unique) return [option];
                return evenement.target.checked ? [...sans(autre.choisies), option] : sans(autre.choisies);
              });
              o.modifier((q) => ecrire(q, nouveaux), { refaire: true, focus: id });
            },
          }),
          el("span", {}, option, o.index.capacite(option) ? null : el("span", { classe: "detail" }, " — capacité à venir")),
        ),
        o.index.capacite(option) ? el("ul", { classe: "capacites-decrites" }, capaciteDecrite(o, option, { bloc: bloc.nom, qualite, intitule: "Description" })) : null,
      );
    });
    return el(
      "fieldset",
      { classe: "groupe-choix" },
      el("legend", {}, legende(o.index, groupe)),
      el("p", { classe: "secondaire-texte petit" }, groupe.forme === "choix" ? "Une option." : "Aucune, une ou plusieurs options."),
      options,
    );
  });
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

// Archétype, espèce, primordial : un bloc à choisir, chacun avec les
// capacités qu'il donne, décrites ; puis les groupes du bloc choisi.
function etapeBloc(o, role, { intitule, aucun }) {
  const blocs = o.index.blocsDeType(role);
  if (!blocs.length) return el("p", { classe: "message" }, aucun);
  const choisi = o.personnage[role];
  const actuel = choisi?.nom ? o.index.bloc(choisi.nom) : null;
  return [
    el(
      "fieldset",
      { classe: "groupe-choix" },
      el("legend", {}, intitule),
      blocs.map((bloc, i) => {
        const id = `${role}-${i}`;
        const estChoisi = actuel?.nom === bloc.nom;
        return el(
          "div",
          { classe: estChoisi ? "choix-bloc choisi" : "choix-bloc" },
          el(
            "label",
            { classe: "choix-option" },
            el("input", {
              type: "radio",
              id,
              name: role,
              checked: estChoisi,
              onchange: () => {
                if (o.personnage[role]?.nom === bloc.nom) return;
                o.modifier((q) => { q[role] = { nom: bloc.nom, choix: [] }; }, { refaire: true, focus: id });
              },
            }),
            el("span", {}, el("span", { classe: "choix-nom" }, bloc.nom)),
          ),
          // Les groupes du bloc choisi se choisissent plus bas, décrits.
          blocDecrit(o, bloc, { avecGroupes: !estChoisi }),
        );
      }),
    ),
    actuel ? groupesDeChoix(o, actuel, choisi.choix, role, (q, choix) => { q[role].choix = choix; }) : null,
  ];
}

// Étape 5 : le tirage se refait à volonté (décision de l'auteur, lot 2 bis),
// et se compte ; la fiche dit « tirée N fois » ou « saisie à la main ».
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
  const saisie = el(
    "select",
    {
      id: "constellation-saisie",
      classe: "champ",
      onchange: (evenement) => {
        const nom = evenement.target.value;
        // « — choisir — » ne défait rien : le compte des tirages resterait
        // perdu avec la constellation (relecture du lot 2 bis).
        if (!nom) {
          o.refaire("constellation-saisie");
          return;
        }
        o.modifier(
          (q) => {
            const compte = q.constellation?.tirages ?? 0;
            q.constellation = nom ? { nom, choix: q.constellation?.nom === nom ? q.constellation.choix : [], obtention: "saisie", tirages: compte } : null;
          },
          { refaire: true, focus: "constellation-saisie" },
        );
      },
    },
    el("option", { value: "", selected: !(actuelle?.obtention === "saisie") }, "— choisir —"),
    constellations.map((c) => el("option", { value: c.nom, selected: actuelle?.obtention === "saisie" && actuelle.nom === c.nom }, c.nom)),
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
    bloc ? blocDecrit(o, bloc, { avecGroupes: false }) : null,
    bloc ? groupesDeChoix(o, bloc, actuelle.choix, "constellation", (q, choix) => { q.constellation.choix = choix; }) : null,
    el("h3", {}, "Tirer au sort"),
    el("p", {}, "L'Atelier tire une constellation parmi celles de la banque. Le tirage se refait autant de fois qu'il le faut ; la fiche dit combien de fois il a été fait."),
    el("div", { classe: "boutons" }, bouton),
    el("h3", {}, "Saisir le tirage fait à la table"),
    el("p", { classe: "secondaire-texte petit" }, "Une constellation saisie est marquée « saisie à la main » sur la fiche."),
    el("label", { for: "constellation-saisie" }, "Constellation tirée à la table"),
    saisie,
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

// L'entrée « Arme » : une seule arme, tenue d'office (livret, « Objet »).
// Changer d'arme remplace celle-ci ; une arme de rechange se range dans le
// sac par « Tous les objets ».
function entreeArme(o) {
  const p = o.personnage;
  const rangTenue = p.equipement.findIndex((objet) => objet.place === "arme");
  const tenue = rangTenue >= 0 ? p.equipement[rangTenue] : null;
  const armes = o.index.blocsDeType("arme");
  const choix = el(
    "select",
    {
      id: "arme",
      classe: "champ",
      onchange: (evenement) => {
        const nom = evenement.target.value;
        o.modifier(
          (q) => {
            const rang = q.equipement.findIndex((objet) => objet.place === "arme");
            if (rang >= 0) q.equipement.splice(rang, 1);
            if (nom) q.equipement.push({ nom, choix: [], qualite: QUALITE_CREATION, place: "arme" });
          },
          { refaire: true, focus: "arme" },
        );
      },
    },
    el("option", { value: "", selected: !tenue }, "Aucune : mains nues"),
    armes.map((bloc) => el("option", { value: bloc.nom, selected: tenue ? cle(tenue.nom) === cle(bloc.nom) : false }, bloc.nom)),
  );
  // Chaque arme de la banque, décrite, pour choisir en connaissance de cause.
  const catalogue = armes.length
    ? el(
        "details",
        { classe: "catalogue", "data-cle": "catalogue-armes" },
        el("summary", {}, `Les ${armes.length} armes et ce qu'elles donnent`),
        armes.map((bloc) => el("div", { classe: "choix-bloc" }, el("p", { classe: "choix-nom" }, bloc.nom), blocDecrit(o, bloc, { siVide: "Aucune capacité." }))),
      )
    : null;
  return [
    el("h3", {}, "Arme"),
    el("p", { classe: "secondaire-texte petit" }, "Une seule arme se tient, équipée d'office (livret, « Objet »). Changer d'arme remplace celle-ci ; une arme de rechange s'ajoute dans « Tous les objets », rangée dans le sac."),
    el("label", { for: "arme" }, "Arme tenue"),
    choix,
    catalogue,
    tenue ? objetDecrit(o, tenue, rangTenue) : null,
  ];
}

// L'entrée « Pack d'armure » : un pack par type, formé de toutes les pièces
// de ce type, équipées d'office ; un type dont deux pièces couvrent une
// même zone n'a pas de pack (A10).
function entreePack(o) {
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
  const option = (pack) => {
    const id = pack ? `pack-${pack.type}` : "pack-aucun";
    const couvertes = new Set(pack ? pack.pieces.flatMap((b) => zonesCouvertes(b)) : []);
    const zones = ZONES.filter((z) => couvertes.has(z.code)).map((z) => NOM_ZONE[z.code]);
    return el(
      "div",
      { classe: "option-decrite" },
      el(
        "label",
        { classe: "choix-option" },
        el("input", {
          type: "radio",
          id,
          name: "pack",
          disabled: pack ? !pack.propose : false,
          checked: pack ? actuel === pack : !pieces.length,
          onchange: () => choisir(pack),
        }),
        el(
          "span",
          {},
          el("span", { classe: "choix-nom" }, pack ? `Pack ${pack.nom}` : "Aucun pack"),
          pack
            ? el(
                "span",
                { classe: "detail" },
                pack.propose
                  ? ` — ${pack.pieces.map((b) => b.nom).join(", ")} ; ${zones.join(", ") || "aucune zone"}`
                  : ` — non proposé : ${pack.conflits.map((c) => `${c.nomZone.toLowerCase()} couvert par ${c.pieces.map((b) => b.nom).join(" et ")}`).join(" ; ")}`,
              )
            : null,
        ),
      ),
    );
  };
  return [
    el("h3", {}, "Pack d'armure"),
    el("p", { classe: "secondaire-texte petit" }, "Un pack par type : toutes les pièces de ce type, une par zone, portées d'office. Les pièces portées seules sur une zone du pack retournent au sac."),
    packs.length
      ? el("fieldset", { classe: "groupe-choix" }, el("legend", {}, "Pack d'armure"), option(null), packs.map(option))
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
              { refaire: true, focus: "arme" },
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

function etapeEquipement(o) {
  return [entreeArme(o), entreePack(o), entreeObjets(o)];
}

// ─── Étape 8 : les capacités ────────────────────────────────────────────────

// Seules les capacités qui peuvent évoluer se montrent (demande de
// l'auteur, 30/09/2026), même quand les points manquent ; chacune avec sa
// description avant et après l'évolution.
function etapeCapacites(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const { points } = fiche;
  const changer = (capacite, niveau, focus) =>
    o.modifier(
      (q) => {
        q.niveaux = q.niveaux.filter((m) => cle(o.index.capacite(m.capacite)?.nom ?? m.capacite) !== cle(capacite.nom));
        if (niveau !== capacite.niveauCreation) q.niveaux.push({ capacite: capacite.nom, niveau });
      },
      { refaire: true, focus },
    );
  const evolutives = fiche.capacites.filter((c) => !c.aVenir && c.peutEvoluer && c.niveauCreation >= 1);
  const lignes = evolutives.map((capacite, i) => {
    const id = `niveau-${i}`;
    const permis = niveauxPermis(fiche, capacite);
    const suivant = capacite.niveau + 1;
    const peutMonter = suivant <= capacite.niveauMax && permis.includes(suivant);
    const manque = suivant <= capacite.niveauMax ? points.depenses - COUT_NIVEAU[capacite.niveau] + COUT_NIVEAU[suivant] - POINTS_CREATION : 0;
    const raison =
      suivant > capacite.niveauMax
        ? `Niveau ${capacite.niveauMax} : le plus haut.`
        : peutMonter
          ? `Niveau ${suivant} : ${COUT_NIVEAU[suivant] - COUT_NIVEAU[capacite.niveau]} point(s) de plus.`
          : `Niveau ${suivant} : il manque ${manque} point(s).`;
    const moins = el(
      "button",
      { type: "button", id: `${id}-moins`, classe: "bouton secondaire bouton-pas", "aria-label": `Baisser ${capacite.nom}`, disabled: capacite.niveau <= capacite.niveauCreation, onclick: () => changer(capacite, capacite.niveau - 1, [`${id}-moins`, `${id}-plus`]) },
      "−",
    );
    const plus = el(
      "button",
      { type: "button", id: `${id}-plus`, classe: "bouton secondaire bouton-pas", "aria-label": `Monter ${capacite.nom}`, "aria-describedby": `${id}-raison`, disabled: !peutMonter, onclick: () => changer(capacite, suivant, [`${id}-plus`, `${id}-moins`]) },
      "+",
    );
    // Avant : le niveau de départ ; après : le niveau choisi, sinon le suivant.
    const apres = Math.min(Math.max(capacite.niveau, capacite.niveauCreation + 1), capacite.niveauMax);
    const source = capacite.origines[0] ?? null;
    const objet = o.personnage.equipement.find((e) => cle(e.nom) === cle(source ?? ""));
    // La clé de l'état (ouvert, fermé) suit la place, avant ou après, pas le niveau.
    const decrite = (niveau, intitule, place) => capaciteDecrite(o, capacite.nom, { bloc: source, niveau, qualite: objet?.qualite ?? QUALITE_CREATION, intitule, cle: `etape8|${capacite.nom}|${place}` });
    return el(
      "li",
      { classe: "capacite-ligne" },
      el("p", {}, el("strong", {}, capacite.nom), " ", el("span", { classe: "detail" }, capacite.origines.join(", "))),
      el(
        "div",
        { classe: "capacite-niveau" },
        el("div", { classe: "pas-a-pas" }, moins, el("span", { id, classe: "valeur-pas", "aria-live": "polite" }, `niveau ${capacite.niveau}`), plus),
        el("span", { classe: "detail" }, `coût : ${coutLisible(capacite.cout)}`),
      ),
      el("p", { id: `${id}-raison`, classe: "secondaire-texte petit" }, raison),
      el(
        "ul",
        { classe: "capacites-decrites avant-apres" },
        decrite(capacite.niveauCreation, "Avant l'évolution", "avant"),
        decrite(apres, apres === capacite.niveau ? "Après l'évolution (choisie)" : "Après l'évolution", "apres"),
      ),
    );
  });
  return [
    el("p", { classe: "compteur-points", role: "status" }, `Points dépensés : ${points.depenses} / ${points.plafond} · reliquat : ${points.reliquat}`),
    points.recus > points.plafond ? el("p", { classe: "message" }, `Les capacités reçues valent déjà ${points.recus} points : aucune montée n'est possible.`) : null,
    el(
      "p",
      { classe: "secondaire-texte petit" },
      `Points d'une capacité : ${COUT_NIVEAU.slice(1).map((cout, i) => `niveau ${i + 1} = ${cout}`).join(", ")} ; les capacités de niveau 0 ne comptent pas. Seules les capacités qui peuvent évoluer sont ici ; toutes figurent au récapitulatif.`,
    ),
    lignes.length ? el("ul", { classe: "capacites-creation" }, lignes) : el("p", { classe: "secondaire-texte" }, "Aucune capacité ne peut évoluer."),
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
