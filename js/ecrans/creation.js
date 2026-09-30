// Le parcours de création d'un personnage (SPECIFICATION.md, § 15.3).
//
// Neuf étapes, à l'adresse #/personnage/<id>/etape/<1 à 9>. Chaque
// changement est vérifié comme un fichier reçu (format.js) avant d'être
// accepté, puis gardé aussitôt sur l'appareil : le brouillon survit à une
// page fermée. On avance même incomplet ; la zone « Ce qui manque » le dit
// à chaque étape, et « Enregistrer » attend qu'il ne manque plus rien.
//
// Aucune règle du jeu n'est écrite ici : ce qui manque, les montées
// permises et le tirage viennent de parcours.js, la fiche de calcul.js, les
// nombres de regles.js.

import { cle } from "../banque/noms.js";
import { TYPES, typeDe } from "../banque/types.js";
import { coutEcrit, lecture } from "../fiche/lecture.js";
import { calculerFiche, capacitesDuBloc, estBouclier, indexerCreation, qualiteDe } from "../personnage/calcul.js";
import { ErreurPersonnage, verifier } from "../personnage/format.js";
import { ETAPES, banqueUtilisable, manques, niveauxPermis, tirerConstellation } from "../personnage/parcours.js";
import {
  CARACTERISTIQUES,
  CARACTERISTIQUE_MAX,
  CARACTERISTIQUE_MIN,
  COUT_NIVEAU,
  DES,
  ELEMENTS,
  SOMME_CARACTERISTIQUES,
  TYPES_OBJET,
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
// Le motif d'une qualité saisie : celui que format.js vérifie.
const QUALITE = /^\d{1,3}(?:,\d{1,2})?$/;
const RUBRIQUES = [
  ["arme", "Armes"],
  ["armure", "Armures"],
  ["equipement", "Équipement"],
  ["consommable", "Consommables"],
];

function renommer(entete, texte) {
  entete.textContent = texte;
  titrer(texte);
}

const versLaListe = () => el("p", { classe: "lien-retour" }, el("a", { href: "#/personnages" }, "Personnages"));

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
 * cases à cocher. ecrire(q, choix) range la liste des options choisies
 * dans le personnage q ; un choix qui n'est plus une option s'y perd.
 */
function groupesDeChoix(o, bloc, choix, prefixe, ecrire) {
  const { groupes } = capacitesDuBloc(bloc, choix);
  return groupes.map((groupe, g) => {
    const options = groupe.options.map((option, i) => {
      const id = `${prefixe}-g${g}-${i}`;
      const unique = groupe.forme === "choix";
      return el(
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

// Ce qu'un bloc donne, en une ligne, pour choisir en connaissance de cause.
function resumeBloc(bloc) {
  const { capacites, groupes } = capacitesDuBloc(bloc, []);
  const parties = [
    ...capacites.map((c) => c.nom),
    ...groupes.map((g) => `${g.forme === "choix" ? "au choix" : "facultatif"} : ${g.options.join(", ")}`),
  ];
  return parties.length ? parties.join(" · ") : "capacités à venir";
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

function etapeCaracteristiques(o) {
  const somme = el("p", { classe: "somme", role: "status" });
  const apercu = el("div", {});
  const rafraichir = () => {
    const valeurs = o.personnage.caracteristiques;
    somme.textContent = `Somme : ${CARACTERISTIQUES.reduce((total, c) => total + (valeurs[c.code] ?? 0), 0)} / ${SOMME_CARACTERISTIQUES}`;
    apercu.replaceChildren(tableDesDes(valeurs));
  };
  const champs = CARACTERISTIQUES.map((c) => {
    const id = `carac-${c.code}`;
    const erreur = el("p", { classe: "erreur-champ", id: `${id}-erreur`, hidden: true });
    const entree = el("input", {
      type: "number",
      id,
      classe: "champ champ-court",
      min: CARACTERISTIQUE_MIN,
      max: CARACTERISTIQUE_MAX,
      step: 1,
      inputmode: "numeric",
      "aria-describedby": `${id}-erreur`,
      oninput: (evenement) => {
        const texte = evenement.target.value.trim();
        const valeur = texte === "" ? null : Number(texte);
        if (valeur !== null && !(Number.isInteger(valeur) && valeur >= CARACTERISTIQUE_MIN && valeur <= CARACTERISTIQUE_MAX)) {
          erreur.textContent = `De ${CARACTERISTIQUE_MIN} à ${CARACTERISTIQUE_MAX} : cette valeur n'est pas gardée.`;
          erreur.hidden = false;
          return;
        }
        erreur.hidden = true;
        if (o.modifier((q) => { q.caracteristiques[c.code] = valeur; })) rafraichir();
      },
    });
    const valeur = o.personnage.caracteristiques[c.code];
    entree.value = valeur === null ? "" : String(valeur);
    return el("div", { classe: "caracteristique" }, el("label", { for: id }, c.nom), entree, erreur);
  });
  rafraichir();
  return [
    el("p", {}, `Neuf caractéristiques, chacune de ${CARACTERISTIQUE_MIN} à ${CARACTERISTIQUE_MAX}, pour une somme de ${SOMME_CARACTERISTIQUES}.`),
    el("div", { classe: "caracteristiques" }, champs),
    somme,
    el("h3", {}, "Aperçu des dés"),
    apercu,
    el("p", { classe: "secondaire-texte petit" }, `Somme des deux caractéristiques, arrondie au pair inférieur : ${DES.map((f) => `${f} → d${f}`).join(" · ")}`),
  ];
}

// Archétype, espèce, primordial : un bloc à choisir, puis ses groupes.
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
        return el(
          "label",
          { classe: "choix-option" },
          el("input", {
            type: "radio",
            id,
            name: role,
            checked: actuel?.nom === bloc.nom,
            onchange: () => {
              if (o.personnage[role]?.nom === bloc.nom) return;
              o.modifier((q) => { q[role] = { nom: bloc.nom, choix: [] }; }, { refaire: true, focus: id });
            },
          }),
          el("span", {}, el("span", { classe: "choix-nom" }, bloc.nom), el("span", { classe: "detail" }, resumeBloc(bloc))),
        );
      }),
    ),
    actuel ? groupesDeChoix(o, actuel, choisi.choix, role, (q, choix) => { q[role].choix = choix; }) : null,
  ];
}

function etapeConstellation(o) {
  const constellations = o.index.blocsDeType("constellation");
  if (!constellations.length) return el("p", { classe: "message" }, "La banque ne contient aucune constellation : ni tirage ni saisie n'est possible.");
  const actuelle = o.personnage.constellation;
  const bloc = actuelle?.nom ? o.index.bloc(actuelle.nom) : null;
  const groupes = bloc ? groupesDeChoix(o, bloc, actuelle.choix, "constellation", (q, choix) => { q.constellation.choix = choix; }) : null;
  const resume = bloc ? el("p", { classe: "secondaire-texte" }, resumeBloc(bloc)) : null;

  if (actuelle?.obtention === "tirage") {
    return [
      el("p", { id: "constellation-tiree", classe: "resultat-tirage", tabindex: "-1" }, "Constellation tirée au sort : ", el("strong", {}, actuelle.nom)),
      el("p", {}, "Le tirage est figé : il ne se refait pas et ne se change pas."),
      resume,
      groupes,
    ];
  }

  // Le tirage est définitif : il se confirme dans la page, comme une
  // suppression, et remplace une saisie faite à la table.
  const confirmation = el("div", {});
  const tirer = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      onclick: () => {
        const annuler = el("button", { type: "button", classe: "bouton secondaire", onclick: () => confirmation.replaceChildren() }, "Annuler");
        confirmation.replaceChildren(
          el(
            "div",
            { classe: "confirmation", role: "group", "aria-label": "Confirmer le tirage" },
            el("p", {}, actuelle?.nom ? `Tirer au sort ? Le tirage remplace « ${actuelle.nom} », saisie à la main, et il est définitif.` : "Tirer au sort ? Le tirage est définitif."),
            el(
              "div",
              { classe: "boutons" },
              el(
                "button",
                {
                  type: "button",
                  classe: "bouton",
                  onclick: () => {
                    const nom = tirerConstellation(o.banque);
                    if (nom) o.modifier((q) => { q.constellation = { nom, choix: [], obtention: "tirage" }; }, { refaire: true, focus: "constellation-tiree" });
                  },
                },
                "Tirer",
              ),
              annuler,
            ),
          ),
        );
        annuler.focus();
      },
    },
    "Tirer au sort",
  );
  const saisie = el(
    "select",
    {
      id: "constellation-saisie",
      classe: "champ",
      onchange: (evenement) => {
        const nom = evenement.target.value;
        o.modifier(
          (q) => {
            q.constellation = nom ? { nom, choix: q.constellation?.nom === nom ? q.constellation.choix : [], obtention: "saisie" } : null;
          },
          { refaire: true, focus: "constellation-saisie" },
        );
      },
    },
    el("option", { value: "", selected: !actuelle?.nom }, "— choisir —"),
    constellations.map((c) => el("option", { value: c.nom, selected: actuelle?.nom === c.nom }, c.nom)),
  );
  return [
    el("h3", {}, "Tirer au sort"),
    el("p", {}, "L'Atelier tire une constellation parmi celles de la banque. Le tirage est définitif : il ne se refait pas."),
    el("div", { classe: "boutons" }, tirer),
    confirmation,
    el("h3", {}, "Saisir le tirage fait à la table"),
    el("p", { classe: "secondaire-texte petit" }, "Une constellation saisie est marquée « saisie à la main » sur la fiche."),
    el("label", { for: "constellation-saisie" }, "Constellation tirée à la table"),
    saisie,
    resume,
    groupes,
  ];
}

// Deux objets de même nom se distinguent par leur rang dans l'équipement.
function libelleObjet(equipement, rang) {
  const nom = equipement[rang].nom;
  return equipement.filter((o) => cle(o.nom) === cle(nom)).length > 1 ? `${nom} (objet ${rang + 1})` : nom;
}

function carteObjet(o, objet, rang) {
  const bloc = o.index.bloc(objet.nom);
  const type = bloc ? typeDe(bloc) : null;
  const prefixe = `objet-${rang}`;
  let qualite = null;
  if (bloc) {
    const q = qualiteDe(bloc, objet.qualite);
    if (q.applicable && q.fixee) qualite = el("p", {}, `Qualité ${q.texte}`);
    else if (q.applicable) {
      const id = `${prefixe}-qualite`;
      const erreur = el("p", { classe: "erreur-champ", id: `${id}-erreur`, hidden: true });
      const entree = el("input", {
        type: "text",
        id,
        classe: "champ champ-court",
        inputmode: "decimal",
        pattern: "\\d{1,3}(,\\d{1,2})?",
        maxlength: 6,
        autocomplete: "off",
        "aria-describedby": `${id}-aide ${id}-erreur`,
        oninput: (evenement) => {
          const texte = evenement.target.value.trim();
          if (texte !== "" && !QUALITE.test(texte)) {
            erreur.textContent = "Un nombre comme 2 ou 1,5, ou rien pour X : cette valeur n'est pas gardée.";
            erreur.hidden = false;
            return;
          }
          erreur.hidden = true;
          o.modifier((p) => { p.equipement[rang].qualite = texte === "" ? null : texte; });
        },
      });
      entree.value = objet.qualite ?? "";
      qualite = [
        el("label", { for: id }, "Qualité"),
        el("p", { id: `${id}-aide`, classe: "secondaire-texte petit" }, "Vide : X, tant que le MJ ne l'a pas fixée."),
        entree,
        erreur,
      ];
    }
  }
  const porte =
    type === "armure"
      ? el(
          "label",
          { classe: "choix-option" },
          el("input", { type: "checkbox", id: `${prefixe}-porte`, checked: objet.porte, onchange: (evenement) => o.modifier((p) => { p.equipement[rang].porte = evenement.target.checked; }) }),
          el("span", {}, "Portée"),
        )
      : null;
  const retirer = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      "aria-label": `Retirer ${libelleObjet(o.personnage.equipement, rang)}`,
      onclick: () =>
        o.modifier(
          (p) => {
            p.equipement.splice(rang, 1);
            const recaler = (i) => (i === null || i === rang ? null : i > rang ? i - 1 : i);
            p.arme_principale = recaler(p.arme_principale);
            p.bouclier = recaler(p.bouclier);
          },
          // Le focus va à l'objet suivant (ou au précédent) : la page ne
          // remonte pas en haut d'une longue liste.
          { refaire: true, focus: o.personnage.equipement.length > 1 ? `objet-${Math.min(rang, o.personnage.equipement.length - 2)}-titre` : "objet-a-ajouter" },
        ),
    },
    "Retirer",
  );
  return el(
    "li",
    { classe: "objet" },
    el("h4", { id: `${prefixe}-titre`, tabindex: "-1" }, libelleObjet(o.personnage.equipement, rang), " ", el("span", { classe: "detail" }, bloc ? (TYPES[type]?.nom ?? "") : "n'existe plus dans la banque")),
    qualite,
    porte,
    bloc ? groupesDeChoix(o, bloc, objet.choix, prefixe, (p, choix) => { p.equipement[rang].choix = choix; }) : null,
    el("div", { classe: "boutons" }, retirer),
  );
}

// La liste d'un rôle d'objet (arme principale, bouclier) : un rang de
// l'équipement, ou rien.
function listeDeRole(o, { id, libelle, aucun, cleRole, retenir }) {
  const p = o.personnage;
  const candidats = p.equipement.map((objet, rang) => ({ rang, bloc: o.index.bloc(objet.nom) })).filter(({ bloc }) => bloc && retenir(bloc));
  return [
    el("label", { for: id }, libelle),
    el(
      "select",
      {
        id,
        classe: "champ",
        onchange: (evenement) => o.modifier((q) => { q[cleRole] = evenement.target.value === "" ? null : Number(evenement.target.value); }),
      },
      el("option", { value: "", selected: p[cleRole] === null }, aucun),
      candidats.map(({ rang }) => el("option", { value: rang, selected: p[cleRole] === rang }, libelleObjet(p.equipement, rang))),
    ),
  ];
}

function etapeEquipement(o) {
  const p = o.personnage;
  const choixObjet = el(
    "select",
    { id: "objet-a-ajouter", classe: "champ" },
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
          o.dire("Choisissez d'abord un objet dans la liste.");
          return;
        }
        o.modifier((q) => { q.equipement.push({ nom: bloc.nom, choix: [], qualite: null, porte: typeDe(bloc) === "armure" }); }, { refaire: true, focus: `objet-${o.personnage.equipement.length}-titre` });
      },
    },
    "Ajouter",
  );
  return [
    el("h3", {}, "Ajouter un objet"),
    el("label", { for: "objet-a-ajouter" }, "Objet"),
    choixObjet,
    el("div", { classe: "boutons" }, ajouter),
    el("h3", {}, "L'équipement"),
    p.equipement.length ? el("ul", { classe: "objets" }, p.equipement.map((objet, rang) => carteObjet(o, objet, rang))) : el("p", { classe: "secondaire-texte" }, "Aucun objet."),
    el(
      "div",
      { classe: "formulaire" },
      listeDeRole(o, { id: "arme-principale", libelle: "Arme principale", aucun: "Aucune : mains nues", cleRole: "arme_principale", retenir: (bloc) => typeDe(bloc) === "arme" }),
      listeDeRole(o, { id: "bouclier", libelle: "Bouclier", aucun: "Aucun", cleRole: "bouclier", retenir: estBouclier }),
    ),
  ];
}

function etapeCapacites(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const { points } = fiche;
  const changer = (capacite, niveau, id) =>
    o.modifier(
      (q) => {
        q.niveaux = q.niveaux.filter((m) => cle(o.index.capacite(m.capacite)?.nom ?? m.capacite) !== cle(capacite.nom));
        if (niveau !== capacite.niveauCreation) q.niveaux.push({ capacite: capacite.nom, niveau });
      },
      { refaire: true, focus: id },
    );
  const lignes = fiche.capacites.map((capacite, i) => {
    const id = `niveau-${i}`;
    let niveau;
    if (capacite.aVenir) niveau = el("span", {}, "capacité à venir, hors du décompte");
    else {
      const permis = niveauxPermis(fiche, capacite);
      if (permis.length > 1) {
        const offerts = permis.includes(capacite.niveau) ? permis : [...permis, capacite.niveau].sort((a, b) => a - b);
        niveau = el(
          "select",
          { id, classe: "champ champ-court", "aria-label": `Niveau de ${capacite.nom}`, onchange: (evenement) => changer(capacite, Number(evenement.target.value), id) },
          offerts.map((n) => el("option", { value: n, selected: n === capacite.niveau }, `niveau ${n}`)),
        );
      } else niveau = el("span", {}, capacite.niveau === 0 ? "niveau 0, n'évolue pas" : `niveau ${capacite.niveau}`);
    }
    return el(
      "li",
      { classe: "capacite-ligne" },
      el("p", {}, el("strong", {}, capacite.nom), " ", el("span", { classe: "detail" }, capacite.origines.join(", "))),
      el("div", { classe: "capacite-niveau" }, niveau, capacite.aVenir ? null : el("span", { classe: "detail" }, `coût : ${coutEcrit(capacite.cout)}`)),
    );
  });
  return [
    el("p", { classe: "compteur-points", role: "status" }, `Points dépensés : ${points.depenses} / ${points.plafond} · reliquat : ${points.reliquat}`),
    points.recus > points.plafond ? el("p", { classe: "message" }, `Les capacités reçues valent déjà ${points.recus} points : aucune montée n'est possible.`) : null,
    el(
      "p",
      { classe: "secondaire-texte petit" },
      `Points d'une capacité : ${COUT_NIVEAU.slice(1).map((cout, i) => `niveau ${i + 1} = ${cout}`).join(", ")} ; les capacités de niveau 0 ne comptent pas.`,
    ),
    el("ul", { classe: "capacites-creation" }, lignes),
  ];
}

function etapeRecapitulatif(o) {
  const fiche = calculerFiche(o.banque, o.personnage, { index: o.index });
  const incomplet = manques(o.banque, o.personnage, { index: o.index, fiche })[9].length > 0;
  const bouton = el(
    "button",
    { type: "button", classe: "bouton", disabled: incomplet, "aria-describedby": incomplet ? "raison-enregistrer" : null, onclick: () => o.enregistrerDefinitivement(bouton) },
    "Enregistrer",
  );
  return [
    lecture(fiche),
    el("h3", {}, "Enregistrer"),
    el("p", {}, "Après l'enregistrement, le personnage n'est plus modifiable."),
    el("div", { classe: "boutons" }, bouton),
    incomplet ? el("p", { id: "raison-enregistrer", classe: "secondaire-texte petit" }, "Inactif tant qu'il manque quelque chose : voir « Ce qui manque », en haut de l'étape.") : null,
  ];
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

function parcours(contexte, n, lu, entete, contenu) {
  const { banque, etagere } = contexte.etat;
  const index = indexerCreation(banque);
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
    renommer(entete, `Création — ${nomDe(personnage)}`);
  };

  const refaire = (focus = null) => {
    corps.replaceChildren(...[CONSTRUCTEURS[n](outils)].flat(Infinity).filter((partie) => partie !== null && partie !== undefined && partie !== false));
    actualiser();
    if (focus) corps.querySelector(`#${focus}`)?.focus();
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

  const enregistrerDefinitivement = async (bouton) => {
    const fiche = calculerFiche(banque, personnage, { index });
    if (manques(banque, personnage, { index, fiche })[9].length) return;
    const maintenant = new Date().toISOString();
    const final = {
      ...structuredClone(personnage),
      etat: "enregistre",
      etape: n,
      modifie_le: maintenant,
      enregistre_le: maintenant,
      banque: { empreinte: contexte.etat.chargement?.enveloppe?.empreinte ?? "", publiee_le: banque.publiee_le ?? null },
      empreintes: relever(index, fiche, personnage),
    };
    bouton.disabled = true;
    try {
      await etagere.garder(final);
    } catch (erreur) {
      dire(`Le personnage n'a pas pu être enregistré : ${texteErreur(erreur)}`);
      bouton.disabled = false;
      return;
    }
    personnage = final;
    contexte.naviguer(adressePersonnage(final.id));
  };

  const outils = {
    index,
    banque,
    get personnage() {
      return personnage;
    },
    modifier,
    dire,
    enregistrerDefinitivement,
  };

  const precedent = n > 1 ? el("a", { classe: "bouton secondaire", href: adressePersonnage(personnage.id, n - 1) }, "Précédent") : null;
  const suivant = n < ETAPES.length ? el("a", { classe: "bouton", href: adressePersonnage(personnage.id, n + 1) }, "Suivant") : null;
  // Sur un téléphone, les neuf étapes viennent après le contenu : en tête,
  // elles repoussaient chaque champ sous le pli (relecture du lot 2).
  const navigation = el("nav", { classe: "navigation-etapes", "aria-label": "Étapes de la création" }, etapes);
  const etroit = Boolean(globalThis.matchMedia?.("(max-width: 55.99rem)").matches);
  contenu.replaceChildren(
    ...[
      etroit ? null : navigation,
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
  contexte.etat.etagere
    .lire(route.id)
    .then((personnage) => {
      if (!personnage) {
        renommer(entete, "Personnage introuvable sur cet appareil");
        contenu.replaceChildren(el("p", {}, "Il a pu être supprimé, ou créé sur un autre appareil : importez son fichier."), versLaListe());
        return;
      }
      if (personnage.etat === "enregistre") {
        renommer(entete, `Création — ${nomDe(personnage)}`);
        contenu.replaceChildren(
          el("p", { classe: "message" }, "Ce personnage est enregistré : il n'est plus modifiable ; la progression viendra dans un lot ultérieur."),
          el("p", { classe: "lien-retour" }, el("a", { href: adressePersonnage(personnage.id) }, "Ouvrir sa fiche")),
        );
        return;
      }
      parcours(contexte, route.etape, personnage, entete, contenu);
    })
    .catch((erreur) => contenu.replaceChildren(el("p", { classe: "message", role: "alert" }, `Le personnage n'a pas pu être lu : ${texteErreur(erreur)}`), versLaListe()));
  return ecran;
}
