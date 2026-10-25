// Les photographies du simulateur de combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) »).
//
// Un combat commencé ne doit plus rien à la banque : la republier, ou modifier
// un personnage, ne change pas un combat en cours. À l'ajout d'un
// protagoniste, ce module fige donc tout ce que le combat lira de lui : ses
// valeurs, ses armes, ses zones, et chaque capacité à chaque puissance qu'il
// peut jouer (coût, description, éléments, portée, dégâts, désavantage de
// maîtrise). C'est aussi ici, et nulle part ailleurs, qu'une capacité reçoit
// son rôle câblé : le noyau du combat ne lit ensuite que « valeurs », jamais
// la banque, ni un nom.
//
// Il dit encore qui ne s'ajoute pas, et pourquoi : un personnage aux
// caractéristiques incomplètes, ou dont l'arme tenue ou la défense n'a pas de
// dé ; un adversaire incomplet, ou sans nombre d'actions. Ce sont les seules
// raisons de règle. Les autres refus viennent de validerPhoto
// (js/combat/forme.js), par laquelle passe toute photographie avant d'être
// rendue : la même fonction juge ce qui s'ajoute et ce qui se relit, si bien
// qu'un combat gardé ne peut pas être refusé au rechargement pour une
// photographie que la préparation avait acceptée.
//
// Rien n'est inventé ici : chaque valeur vient de la fiche du personnage
// (§ 15.2) ou de la résolution de l'adversaire (§ 16.4). Ce que la banque
// n'écrit pas prend la valeur neutre que disent les conventions du § 12
// (« Pour le lot 4 ») : portée 0, un dé de localisation, pas de dégâts.
//
// Au groupe 2 du lot 4 (le contrat du groupe, § 5.2 à § 5.4 ; le complément,
// § 6.1 à § 6.3) : un adversaire a, comme un personnage, une façon par
// puissance jouable, de 1 à son rang, là où la banque écrit une variante,
// chacune résolue par capacitesA() (js/adversaire/resolution.js) ; une façon
// hors maîtrise dit sa cause (« maitrise » : l'objet ou le bloc qui la donne,
// et son poids) ; le dé de défense d'un personnage dit les types à égalité
// de dés (« egalite »), parmi lesquels le joueur choisit au combat. Et, à la
// relecture du groupe (C-15), un demi-codet isolé d'un texte devient une
// espace, comme un caractère de contrôle.

import { ecrireTypes } from "../adversaire/carte.js";
import { defautDe } from "../adversaire/lecture.js";
import { horsMaitrise, positionDans, rangsDeMaitrise } from "../adversaire/resolution.js";
import { cle } from "../banque/noms.js";
import { calculerFiche, contexte, coutA, decrire, degatsDecrits, elementsDe, estBouclier, indexerCreation, typesDuBloc, varianteA } from "../personnage/calcul.js";
import { accepter } from "../personnage/format.js";
import { ELEMENTS, NIVEAU_MAX, PARAMETRES, TYPES_OBJET, ZONES } from "../personnage/regles.js";
import { validerPhoto } from "./forme.js";
import { ACTIONS_PJ, BORNES_PHOTO, ELEMENTS_COMBAT, FACE_CONTRE, GRILLE_PJ, PARAMETRE_LOC, ROLES_PASSIFS, SIGNES } from "./regles.js";

// ─── Les textes ─────────────────────────────────────────────────────────────

// Les deux séparateurs de ligne sont fabriqués par leur code : écrits tels
// quels, ils couperaient la ligne de ce fichier. Un demi-codet isolé (la
// moitié d'un signe astral, seule : \p{Cs}), qu'une cellule forgée peut
// porter, devient une espace comme un caractère de contrôle : validerPhoto
// le refuse (js/combat/forme.js), et la photographie fabriquée doit passer
// sa propre forme (relecture du groupe 2, C-15). Le drapeau « u » lit une
// paire bien formée comme un seul signe, qui reste.
const SEPARATEURS = String.fromCodePoint(0x2028, 0x2029);
const CONTROLES = new RegExp(`[\\p{Cc}\\p{Cs}${SEPARATEURS}]`, "gu");
const CONTROLES_HORS_LIGNES = new RegExp(`(?![\\n\\r\\t])[\\p{Cc}\\p{Cs}${SEPARATEURS}]`, "gu");

// Un texte d'une ligne entre au journal, qui tient une ligne par geste : un
// retour à la ligne venu d'une cellule du classeur y devient une espace.
const uneLigne = (texte) => String(texte ?? "").replace(CONTROLES, " ").trim();
// Un texte à lignes garde les siennes : une description tient souvent sur
// plusieurs lignes de sa cellule.
const aLignes = (texte) => String(texte ?? "").replace(CONTROLES_HORS_LIGNES, " ");

const NOM_PAR_DEFAUT = "Sans nom";
const ABSENTE = "absente de la banque";
const TITRE_DES_AUTRES = "Capacités";
const ENTIER = /^-?\d+$/;

/** Le refus d'un ajout que validerPhoto n'accepte pas : sa phrase nomme le champ. */
const refusDeForme = (erreur) => ({ refus: `Ne s'ajoute pas : ${erreur}` });

// ─── Ce qui se lit de la même façon pour les deux camps ─────────────────────

/** Une copie qui passe par JSON : c'est ainsi qu'un combat se garde, et ce qu'il relira. */
function copier(valeur) {
  try {
    return JSON.parse(JSON.stringify(valeur));
  } catch {
    return null;
  }
}

/** La date de la banque, ou null : elle dit si la banque a changé depuis l'ajout. */
function dateDe(banque) {
  const date = typeof banque?.publiee_le === "string" ? uneLigne(banque.publiee_le) : "";
  return date === "" ? null : date;
}

/**
 * Le coût d'une capacité, tel que le combat le paie : des entiers, « X », ou
 * null quand la banque l'écrit sans qu'il se lise. Un coût négatif vaut 0.
 */
function lireCout(cout) {
  const part = (texte) => {
    if (texte === "X") return "X";
    return typeof texte === "string" && ENTIER.test(texte) ? Math.max(0, Number(texte)) : null;
  };
  const souffle = part(cout?.souffle);
  const lien = part(cout?.lien);
  return souffle === null || lien === null ? null : { souffle, lien };
}

const porteElement = (elements, nom) => elements.some((element) => cle(element) === cle(nom));

/** Ce que disent d'une façon ses éléments : passive, intervention, porteuse de l'élément Dégâts. */
function lireElements(noms) {
  const elements = noms.map(uneLigne).filter((nom) => nom !== "");
  return {
    elements,
    passif: porteElement(elements, ELEMENTS_COMBAT.passif),
    intervention: porteElement(elements, ELEMENTS_COMBAT.intervention),
    aDegats: porteElement(elements, ELEMENTS_COMBAT.degats),
  };
}

/** Des dégâts ne descendent pas sous 0 : une expression peut en donner, un coup n'en rend pas. */
const bornerDegats = (degats) => (Array.isArray(degats) ? degats.map((degat) => Math.max(0, degat)) : null);

/** Les passifs câblés : un par capacité qui porte l'un des huit rôles calculés, dans l'ordre des capacités. */
function passifsDe(capacites) {
  return capacites.flatMap((capacite, indice) => (ROLES_PASSIFS.includes(capacite.role) ? [{ capacite: indice, role: capacite.role, niveau: capacite.niveau }] : []));
}

/** Les avertissements d'une photographie, sans doublon, dans la borne que validerPhoto leur donne. */
function carnet() {
  const lignes = [];
  return {
    noter(texte) {
      const ligne = aLignes(texte);
      if (!lignes.includes(ligne)) lignes.push(ligne);
    },
    rendre() {
      const borne = BORNES_PHOTO.avertissements;
      return lignes.length > borne ? [...lignes.slice(0, borne - 1), `Et ${lignes.length - borne + 1} autres avertissements.`] : lignes;
    },
  };
}

/**
 * La cause d'un désavantage de maîtrise (contrat du groupe 2, § 5.3) : le nom
 * de l'objet ou du bloc qui donne la capacité, et son poids. Un bloc à deux
 * poids demande les deux maîtrises (js/adversaire/resolution.js,
 * horsMaitrise) : celui dont la maîtrise est la plus basse est alors celui
 * qui manque, le premier dans l'ordre lourde, agile, précise s'ils sont à
 * égalité. rangs : le rang de maîtrise de chaque poids (rangsDeMaitrise).
 */
function causeDeMaitrise(bloc, rangs) {
  const poids = typesDuBloc(bloc).reduce((retenu, code) => (retenu === null || (rangs.get(code) ?? 0) < (rangs.get(retenu) ?? 0) ? code : retenu), null);
  return { origine: uneLigne(bloc.nom), poids };
}

/** L'indice de la première capacité d'une photographie qui porte ce rôle, ou null. */
export function capaciteDeRole(valeursPhoto, role) {
  const indice = Array.isArray(valeursPhoto?.capacites) ? valeursPhoto.capacites.findIndex((capacite) => capacite?.role === role) : -1;
  return indice === -1 ? null : indice;
}

// ─── Le personnage ──────────────────────────────────────────────────────────

// L'ordre des groupes du panneau d'action : l'arme tenue, puis ce que le
// personnage est, puis ses autres objets, et les capacités de base en dernier.
const ORDRE_DES_GROUPES = ["arme", "archetype", "espece", "style", "constellation", "primordial", "objet", "base"];
const GENRE_DU_ROLE = { espece: "espece", archetype: "archetype", constellation: "constellation", primordial: "primordial", base: "base" };

// Ce qu'une arme transmet à toute capacité se lit comme le reste, par
// contexte(), sur une capacité que rien ne vise.
const AUCUNE_CAPACITE = { nom: "", variantes: [] };
const CLE_LOC = cle(PARAMETRE_LOC);

const estDeStyle = (capacite) => Boolean(capacite?.variantes.some((variante) => variante.elements.some((element) => element.nom && cle(element.nom) === cle(ELEMENTS.style))));

/**
 * L'origine que vaut une source au combat, ou null si elle ne donne rien :
 * une arme ne donne ses capacités que tenue, une armure que portée, le
 * bouclier que s'il est celui qui compte ; tout autre objet les donne où
 * qu'il soit (convention du § 12).
 */
function origineDe(index, fiche, source, capacite) {
  if (source.role !== "equipement") {
    const bloc = index.bloc(source.nom);
    if (!bloc) return null;
    const genre = source.role === "archetype" && estDeStyle(capacite) ? "style" : GENRE_DU_ROLE[source.role];
    if (!genre) return null;
    return { genre, titre: genre === "style" ? ELEMENTS.style : bloc.nom, bloc, qualite: null, rang: null, choix: fiche.choix[source.role] ?? [] };
  }
  const objet = fiche.equipement[source.rang];
  if (!objet || objet.absent || !objet.bloc) return null;
  const commun = { bloc: objet.bloc, qualite: objet.qualite, rang: objet.rang, choix: fiche.choix.equipement[objet.rang] ?? [] };
  if (objet.type === "arme") {
    if (fiche.attaque.mainsNues || fiche.attaque.rang !== objet.rang) return null;
    return { ...commun, genre: "arme", titre: `${objet.nom} (${TYPES_OBJET[fiche.attaque.typeObjet].nom})` };
  }
  if (objet.type === "armure" && !objet.porte) return null;
  // Un objet qui transmet une défense est un bouclier : un seul compte, équipé.
  if (objet.type !== "armure" && estBouclier(objet.bloc) && fiche.bouclier?.rang !== objet.rang) return null;
  return { ...commun, genre: "objet", titre: objet.nom };
}

/** Un paramètre en nombre, ou sa valeur neutre, dite, quand il est écrit sans se calculer ou sort de ses bornes. */
function nombreRecu(variable, minimum, { nom, quoi, noter }) {
  if (!variable) return minimum;
  const valeur = variable.valeurs?.[0];
  if (Number.isInteger(valeur) && valeur >= minimum) return valeur;
  const ecrit = variable.valeurs ? String(valeur) : uneLigne(variable.brut);
  noter(`« ${nom} » : ${quoi}, « ${ecrit} », ne se lit pas ; ${minimum === 0 ? "elle vaut 0" : "il vaut 1"}.`);
  return minimum;
}

/** Ce qu'un bloc donne à une capacité à une puissance : portée, dés de localisation, dégâts. */
function recus(variables, nom, noter) {
  const degats = variables.get(PARAMETRES.degats);
  if (degats && !degats.valeurs) noter(`« ${nom} » : ses dégâts, « ${uneLigne(degats.brut)} », ne se calculent pas ; elle n'en a pas.`);
  return {
    portee: nombreRecu(variables.get(PARAMETRES.portee), 0, { nom, quoi: "sa portée", noter }),
    locMultiple: nombreRecu(variables.get(CLE_LOC), 1, { nom, quoi: "son nombre de dés de localisation", noter }),
    degats: bornerDegats(degats?.valeurs),
    recoitDesDegats: degats !== undefined,
  };
}

/**
 * La photographie d'un personnage : { photo }, gelée et acceptée par
 * validerPhoto, ou { refus }, une phrase. banque : la banque ouverte ;
 * personnage : tel que lu de l'appareil ou du site ; index : celui du
 * créateur ; roles : ce que rend tableDesRoles() (js/combat/roles.js).
 */
export function photographierPersonnage(banque, personnage, { index = indexerCreation(banque), roles = null } = {}) {
  const source = copier(personnage);
  if (source === null || typeof source !== "object") return { refus: "Ce personnage ne se lit pas." };
  const calculee = calculerFiche(banque, personnage, { index });
  if (!calculee.caracteristiquesCompletes) return { refus: "Ses caractéristiques ne sont pas complètes." };
  if (!calculee.attaque.mainsNues && calculee.attaque.de === null) return { refus: "Son arme tenue n'a pas de dé." };
  if (calculee.defense.de === null) return { refus: "Sa défense n'a pas de dé." };

  // Les options choisies de chaque bloc : elles disent laquelle des entrées
  // d'un bloc donne une capacité, donc sa position (les maîtrises).
  const fiche = {
    ...calculee,
    choix: {
      espece: personnage.espece?.choix ?? [],
      archetype: personnage.archetype?.choix ?? [],
      constellation: personnage.constellation?.choix ?? [],
      primordial: personnage.primordial?.choix ?? [],
      equipement: (personnage.equipement ?? []).map((objet) => objet?.choix ?? []),
    },
  };
  const { noter, rendre } = carnet();
  const nomResolu = (nom) => index.capacite(nom)?.nom ?? nom;
  // Les maîtrises possédées sont celles qu'une origine valable donne au
  // combat, comme toute capacité : une maîtrise que seule une arme rangée au
  // sac donnerait ne lève aucun désavantage.
  const possedees = fiche.capacites
    .filter((c) => !c.aVenir)
    .map((c) => ({ capacite: index.capacite(c.nom), rang: c.niveau, sources: c.sources }))
    .filter(({ capacite, sources }) => sources.some((source) => origineDe(index, fiche, source, capacite) !== null));
  const rangs = rangsDeMaitrise(possedees);

  // La capacité de l'attaque à mains nues : celle que vise le paramètre
  // degats du bloc de base (§ 15.2). Elle ne tient pas à un nom.
  let mainsNues = null;
  for (const bloc of index.blocsDeType("base")) {
    const parametre = bloc.parametres.find((p) => p.nom && cle(p.nom) === PARAMETRES.degats);
    if (!parametre) continue;
    const visee = parametre.cible ? index.capacite(parametre.cible) : null;
    if (visee) mainsNues = { bloc, nom: visee.nom };
    break;
  }

  // Chaque capacité sous sa première origine valable, dans l'ordre des groupes.
  const premiereVue = new Map();
  const retenues = [];
  fiche.capacites.forEach((c, rangDeFiche) => {
    const capacite = c.aVenir ? null : index.capacite(c.nom);
    const origines = c.sources.map((s) => origineDe(index, fiche, s, capacite)).filter(Boolean);
    if (!origines.length) return;
    const origine = origines.reduce((a, b) => (ORDRE_DES_GROUPES.indexOf(b.genre) < ORDRE_DES_GROUPES.indexOf(a.genre) ? b : a));
    const suite = `${origine.genre}/${origine.rang ?? origine.bloc.nom}`;
    if (!premiereVue.has(suite)) premiereVue.set(suite, rangDeFiche);
    retenues.push({ c, capacite, origine, suite, rangDeFiche });
  });
  retenues.sort(
    (a, b) =>
      ORDRE_DES_GROUPES.indexOf(a.origine.genre) - ORDRE_DES_GROUPES.indexOf(b.origine.genre) ||
      premiereVue.get(a.suite) - premiereVue.get(b.suite) ||
      a.rangDeFiche - b.rangDeFiche,
  );

  // Les armes : la tenue, puis les mains nues si le personnage en a la
  // capacité. Cette seconde entrée se remplit plus bas, de sa plus haute façon.
  const armes = [];
  if (!fiche.attaque.mainsNues) {
    const tenue = fiche.equipement[fiche.attaque.rang];
    const transmis = recus(contexte(index, personnage, tenue.bloc, tenue.qualite, AUCUNE_CAPACITE, 0), tenue.nom, noter);
    armes.push({
      nom: uneLigne(tenue.nom),
      libelle: uneLigne(tenue.nom),
      poids: fiche.attaque.typeObjet,
      faces: fiche.attaque.de.faces,
      caracteristiques: [...TYPES_OBJET[fiche.attaque.typeObjet].attaque],
      degats: transmis.degats,
      portee: transmis.portee,
      locMultiple: transmis.locMultiple,
      mainsNues: false,
    });
  }
  const estMainsNues = ({ c, origine }) => mainsNues !== null && c.nom === mainsNues.nom && origine.bloc === mainsNues.bloc && !c.aVenir;
  const indiceDesMainsNues = retenues.some(estMainsNues) ? armes.length : null;

  const liens = fiche.liens.map((lien) => ({ nom: uneLigne(lien.nom), points: lien.points }));

  const capacites = retenues.map((retenue) => {
    const { c, capacite, origine } = retenue;
    const nom = uneLigne(c.nom);
    const groupe = { genre: origine.genre, titre: uneLigne(origine.titre) };
    const jauge = origine.genre === "primordial" ? fiche.liens.findIndex((lien) => lien.nom === origine.bloc.nom) : -1;
    const commun = { nom, groupe, lien: jauge === -1 ? null : jauge };
    if (!capacite) return { ...commun, role: null, niveau: 0, evolue: false, inactive: ABSENTE, facons: [] };

    const aMainsNues = estMainsNues(retenue);
    const niveau = c.niveau ?? 0;
    // De 1 au niveau, là où la banque écrit une variante ; une capacité dont
    // aucune puissance ne se lit garde une façon, au coût illisible.
    const possibles = niveau === 0 ? [0] : Array.from({ length: niveau }, (_, k) => k + 1).filter((p) => varianteA(capacite, p));
    const puissances = possibles.length ? possibles : [niveau];
    const position = positionDans(origine.bloc, (entree) => {
      if (entree?.forme === "simple") return nomResolu(entree.nom) === capacite.nom;
      const choisies = new Set(origine.choix.map(cle));
      return Array.isArray(entree?.options) && entree.options.some((option) => choisies.has(cle(option)) && nomResolu(option) === capacite.nom);
    });
    const desavantage = horsMaitrise(origine.bloc, position, rangs);
    // L'objet qui la donne (l'arme tenue comprise), sinon son bloc : c'est l'origine retenue.
    const maitrise = desavantage ? causeDeMaitrise(origine.bloc, rangs) : null;
    const arme = origine.genre === "arme" ? 0 : aMainsNues ? indiceDesMainsNues : null;

    const facons = puissances.map((puissance) => {
      const variables = contexte(index, personnage, origine.bloc, origine.qualite, capacite, puissance);
      const transmis = recus(variables, nom, noter);
      let degats = transmis.degats;
      if (aMainsNues && degats) {
        // Le paramètre ne dépend pas de la puissance : c'est la description
        // qui la fait entrer dans les dégâts, comme sur la fiche (§ 15.2).
        const decrits = degatsDecrits(index, personnage, origine.bloc, capacite, puissance);
        if (decrits?.length === degats.length) degats = bornerDegats(decrits);
      }
      const lus = lireElements(elementsDe(index, origine.bloc, capacite, puissance));
      return {
        puissance,
        arme,
        libelle: null,
        cout: lireCout(coutA(capacite, puissance)),
        description: aLignes(decrire(varianteA(capacite, puissance)?.description, variables, personnage.caracteristiques, puissance).texte),
        elements: lus.elements,
        passif: lus.passif,
        intervention: lus.intervention,
        attaque: !lus.passif && !lus.intervention && (transmis.recoitDesDegats || lus.aDegats),
        degats,
        portee: transmis.portee,
        locMultiple: transmis.locMultiple,
        desavantage,
        maitrise,
      };
    });
    return {
      ...commun,
      // Le rôle se cherche sur le nom de la banque, avant tout nettoyage.
      role: aMainsNues ? "mains_nues" : (roles?.parCle?.get(cle(capacite.nom)) ?? null),
      niveau,
      evolue: c.niveauMax > 0,
      inactive: null,
      facons,
    };
  });

  if (indiceDesMainsNues !== null) {
    const capacite = capacites.find((c) => c.role === "mains_nues");
    const haute = capacite.facons.at(-1);
    // Sans faces : son dé se fait d'une ou deux caractéristiques, choisies au jet.
    armes.push({ nom: capacite.nom, libelle: capacite.nom, poids: null, faces: null, caracteristiques: null, degats: haute.degats, portee: haute.portee, locMultiple: haute.locMultiple, mainsNues: true });
  }

  if (fiche.bouclier && fiche.bouclier.defense === null) noter(`« ${uneLigne(fiche.bouclier.nom)} » : sa défense ne se calcule pas ; elle vaut 0.`);
  const valeurs = {
    identifiant: personnage.id,
    nom: uneLigne(personnage.identite?.nom) || NOM_PAR_DEFAUT,
    sousTitre: [fiche.espece, fiche.archetype].map(uneLigne).filter(Boolean).join(` ${SIGNES.point} `),
    actions: ACTIONS_PJ,
    souffle: fiche.ressources.souffle,
    corps: fiche.ressources.corps,
    souffleAbsent: false,
    zones: GRILLE_PJ.map(({ code, debut, fin }) => {
      const nom = ZONES.find((zone) => zone.code === code).nom;
      return { nom, ecrit: nom, code, debut, fin, armure: fiche.armure.zones[code], resistance: fiche.ressources.resistance };
    }),
    faceContre: FACE_CONTRE.pj,
    caracteristiques: Object.fromEntries(fiche.caracteristiques.map((caracteristique) => [caracteristique.code, caracteristique.valeur])),
    attaque: null,
    defense: null,
    deDefense: {
      faces: fiche.defense.de.faces,
      type: fiche.defense.type,
      caracteristiques: [...TYPES_OBJET[fiche.defense.type].defense],
      meles: fiche.defense.meles === true,
      egalite: [...fiche.defense.egalite],
    },
    armes,
    armePretee: armes.length ? 0 : null,
    bouclier: fiche.bouclier ? { nom: uneLigne(fiche.bouclier.nom), defense: fiche.bouclier.defense ?? 0 } : null,
    liens,
    passifs: passifsDe(capacites),
    capacites,
  };
  const lue = validerPhoto({ camp: "pj", publiee_le: dateDe(banque), source: { personnage: source }, valeurs, avertissements: rendre() }, { accepter });
  return lue.erreur ? refusDeForme(lue.erreur) : { photo: lue.photo };
}

// ─── L'adversaire ───────────────────────────────────────────────────────────

/** Les armes d'un adversaire : deux armes de même nom se distinguent par « (2) », « (3) ». */
function armesDe(resolu) {
  const vus = new Map();
  return resolu.armes.map((arme) => {
    const nom = uneLigne(arme.nom);
    const combien = (vus.get(nom) ?? 0) + 1;
    vus.set(nom, combien);
    return {
      nom,
      libelle: combien > 1 ? `${nom} (${combien})` : nom,
      poids: arme.poids,
      // Un adversaire ne lance rien : c'est le personnage visé qui lance sa défense.
      faces: null,
      caracteristiques: null,
      degats: bornerDegats(arme.degats),
      portee: arme.portee,
      locMultiple: arme.locMultiple,
      mainsNues: false,
    };
  });
}

/**
 * La photographie d'un adversaire : { photo }, gelée et acceptée par
 * validerPhoto, ou { refus }, une phrase. resolution : ce que rend
 * indexerAdversaires() ; nom : celui de sa ligne ; banque : celle dont la
 * date se garde (par défaut, celle de la résolution) ; roles : ce que rend
 * tableDesRoles(). Chaque exemplaire a sa photographie.
 */
export function photographierAdversaire(resolution, nom, { banque = resolution?.banque, roles = null } = {}) {
  const ligne = resolution.adversaires.get(nom);
  if (!ligne) return { refus: "Cet adversaire n'est plus dans la banque." };
  const types = resolution.analyser(ligne, "adversaire").lue.types.map((type) => type.entree).filter(Boolean);
  const resolu = resolution.resoudre(ligne);
  if (!resolu.complet) return { refus: `Ne s'ajoute pas : ${defautDe(resolu) ?? "incomplet"}.` };
  if (resolu.actions.valeur === null) return { refus: "Ne s'ajoute pas : nombre d'actions absent." };
  const source = copier({ ligne, types, resolu });
  if (source === null) return { refus: "Cet adversaire ne se lit pas." };

  const armes = armesDe(resolu);
  // Le groupe d'une capacité : l'arme de sa première façon armée ; à défaut,
  // la première arme qui la donne sans lui donner de dégâts ; sinon « Capacités ».
  const armeDuGroupe = (capacite) => {
    const armee = capacite.parArme.find((entree) => entree.arme !== null);
    if (armee) return armee.arme;
    const objets = new Set(capacite.origines.map((origine) => origine.objet).filter((objet) => objet !== undefined));
    const indice = resolu.armes.findIndex((arme) => objets.has(arme.nom));
    return indice === -1 ? null : indice;
  };
  const rangees = resolu.capacites
    .map((capacite, indice) => ({ capacite, indice, arme: armeDuGroupe(capacite) }))
    .sort((a, b) => (a.arme ?? armes.length) - (b.arme ?? armes.length) || a.indice - b.indice);

  // Les capacités à chaque puissance, de 1 au plus haut rang : parPuissance[p]
  // est parallèle à resolu.capacites (contrat du groupe 2, § 5.2).
  const plusHaut = Math.min(NIVEAU_MAX, resolu.capacites.reduce((haut, capacite) => (capacite.absente ? haut : Math.max(haut, capacite.rang)), 0));
  const parPuissance = [null];
  for (let puissance = 1; puissance <= plusHaut; puissance += 1) parPuissance.push(resolution.capacitesA(ligne, puissance));
  // Ses puissances jouables : de 1 à son rang, là où la banque écrit une
  // variante, comme un personnage de 1 à son niveau (complément, § 6.1) ;
  // aucune ne se lit, son rang seul. Une capacité qui n'évolue pas garde sa
  // seule puissance (spéc. § 12, point 26).
  const puissancesDe = (capacite, indice) => {
    if (capacite.evolue !== true || capacite.rang === 0) return [capacite.rang];
    const jouables = [];
    for (let puissance = 1; puissance <= capacite.rang; puissance += 1) if (parPuissance[puissance]?.[indice]) jouables.push(puissance);
    return jouables.length ? jouables : [capacite.rang];
  };

  // La cause d'un désavantage de maîtrise se lit dans les maîtrises de l'adversaire.
  const rangs = rangsDeMaitrise(resolu.maitrises.map((maitrise) => ({ capacite: resolution.index.capacite(maitrise.nom), rang: maitrise.rang })));
  const causeDe = (nomDuBloc) => {
    const bloc = resolution.index.bloc(nomDuBloc);
    return bloc ? causeDeMaitrise(bloc, rangs) : { origine: uneLigne(nomDuBloc), poids: null };
  };

  /** Les façons d'une capacité résolue à une puissance : une par arme qui la dote de dégâts, sinon une seule. */
  const faconsA = (capacite, puissance) => {
    const lus = lireElements(capacite.elements);
    const description = (objet) => aLignes((capacite.descriptions.find((d) => d.source === objet) ?? capacite.descriptions[0])?.texte);
    const facon = (champs) => ({
      puissance,
      cout: lireCout(capacite.cout),
      elements: lus.elements,
      passif: lus.passif,
      intervention: lus.intervention,
      ...champs,
    });
    if (capacite.parArme.length) {
      return capacite.parArme.map((entree, k) =>
        facon({
          arme: entree.arme,
          // L'objet qui la donne, même quand ce n'est pas une arme.
          libelle: entree.arme === null ? uneLigne(capacite.armes[k].nom) : armes[entree.arme].libelle,
          description: description(capacite.armes[k].nom),
          attaque: !lus.passif && !lus.intervention,
          degats: bornerDegats(entree.degats),
          portee: entree.portee,
          locMultiple: entree.locMultiple,
          desavantage: entree.desavantage === true,
          // L'objet de l'entrée.
          maitrise: entree.desavantage === true ? causeDe(capacite.armes[k].nom) : null,
        }),
      );
    }
    return [
      facon({
        arme: null,
        libelle: null,
        description: description(null),
        // Citée sans arme, elle n'attaque que par ses dégâts propres.
        attaque: !lus.passif && !lus.intervention && (capacite.propres.degats !== null || lus.aDegats),
        degats: bornerDegats(capacite.propres.degats),
        portee: capacite.propres.portee,
        locMultiple: capacite.propres.locMultiple,
        desavantage: capacite.desavantageEntier === true,
        // Le premier des objets qui la gênent : tous la gênent.
        maitrise: capacite.desavantageEntier === true ? causeDe(capacite.desavantage[0]) : null,
      }),
    ];
  };

  const capacites = rangees.map(({ capacite, indice, arme }) => {
    const groupe = arme === null ? { genre: "capacites", titre: TITRE_DES_AUTRES } : { genre: "arme", titre: armes[arme].libelle };
    const commun = { nom: uneLigne(capacite.nom), role: null, lien: null, groupe };
    if (capacite.absente) return { ...commun, niveau: 0, evolue: false, inactive: ABSENTE, facons: [] };
    // Par puissance, puis par arme ; au rang, la résolution même.
    const facons = puissancesDe(capacite, indice).flatMap((puissance) => faconsA(puissance === capacite.rang ? capacite : parPuissance[puissance][indice], puissance));
    // niveau reste le rang : c'est le N d'un passif câblé (spéc. § 12, point 24).
    return { ...commun, role: roles?.parCle?.get(cle(capacite.nom)) ?? null, niveau: capacite.rang, evolue: capacite.evolue === true, inactive: null, facons };
  });

  const valeurs = {
    identifiant: null,
    nom: uneLigne(resolu.nom),
    sousTitre: uneLigne(ecrireTypes(resolu)),
    actions: resolu.actions.valeur,
    // Un souffle que la banque ne donne pas vaut 0, et se dit (convention du § 12).
    souffle: resolu.souffle.valeur ?? 0,
    corps: resolu.corps,
    souffleAbsent: resolu.souffle.valeur === null,
    zones: resolu.zones.map((zone) => {
      const ecrit = uneLigne(zone.nom);
      return { nom: zone.code ? ZONES.find((z) => z.code === zone.code).nom : ecrit, ecrit, code: zone.code ?? null, debut: zone.debut, fin: zone.fin, armure: zone.armure, resistance: zone.resistance };
    }),
    faceContre: FACE_CONTRE.adv,
    caracteristiques: null,
    attaque: resolu.attaque.valeur,
    defense: resolu.defense.valeur,
    deDefense: null,
    armes,
    armePretee: null,
    bouclier: null,
    liens: [],
    passifs: passifsDe(capacites),
    capacites,
  };
  const lue = validerPhoto({ camp: "adv", publiee_le: dateDe(banque), source, valeurs, avertissements: [] }, { accepter });
  return lue.erreur ? refusDeForme(lue.erreur) : { photo: lue.photo };
}
