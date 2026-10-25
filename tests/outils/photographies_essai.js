// Des photographies de combat écrites à la main (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) », et § 11).
//
// Le noyau du combat ne lit que les valeurs d'une photographie, jamais la
// banque : ses contrôles n'ont donc pas besoin d'un classeur. Ils prennent
// ici des protagonistes aux valeurs connues d'avance, rôles câblés déjà
// posés, et les retouchent pour atteindre les règles que la démonstration
// n'a pas (les rôles bonus_precision, petit, esprit_de_corps, plusieurs d20
// de localisation, un adversaire à passif câblé, un second PJ, deux jauges de
// lien, un adversaire sans arme ou sans action).
//
// Au groupe 2 (contrat du groupe, § 5.3, § 5.4, § 5.6) : chaque façon porte
// « maitrise », la cause de son désavantage (nulle sans désavantage) ; le dé
// de défense d'un PJ porte « egalite », les types à égalité de dés.
//
// Rien ici ne passe par js/combat/photographie.js ni par le moteur : ce qui
// se fabrique dans la banque a ses propres contrôles. Tous les noms sont ceux
// de la démonstration, et « source » est toujours null.
//
// ── Les deux protagonistes ronds ────────────────────────────────────────────
//
// pjEssai() — « Aubépine » (un seul mot : son nom court est son nom).
//   2 actions, souffle 10, corps 10 ; les neuf caractéristiques à 4 (toute
//   paire fait donc un d8) ; six zones, armure 10 et résistance 5 chacune ;
//   défense : d8, agile (Agilité et Créativité), types non mêlés, sans
//   égalité ; pas de bouclier ; une jauge de lien, Grand Four, 2 points ;
//   aucun passif câblé.
//   Armes : 0, Couteau d'office, précise, d8 (Précision et Agilité), 5/10/15,
//   portée 1 ; 1, Taloche, les mains nues, dé au choix, 2/4/8, portée 0.
//   L'arme qui prête son jet est le couteau.
//   Capacités, dans cet ordre :
//     Frappe         arme         attaque gratuite, dans sa maîtrise
//     Émincer        arme         attaque, 4 souffle, hors maîtrise (le couteau, précise)
//     Flambage       archétype    sans jet ; niveau 2 : [1] 5 souffle, [2] 10
//     Fournaise      primordial   sans jet ; [1] 1 souffle et 1 lien, sur la jauge 0
//     Pas chassé     base         rôle deplacement ; niveau 2 : [1] gratuit, [2] 1 souffle
//     Goûter         base         rôle jet_de_caracteristique
//     Taloche        base         rôle mains_nues ; [1], arme 1, 2/4/8, portée 0
//     Pas de côté    base         rôle esquive ; intervention, X souffle
//
// adversaireEssai() — « Marmiton ».
//   1 action, souffle 5, corps 10, attaque 4, défense 5 ; Torse 2-11, Jambe
//   gauche 12-13, Jambe droite 14-15, Bras gauche 16-17, Bras droit 18-19,
//   Tête 20, armure 10 et résistance 5 chacune ; aucun passif câblé.
//   Arme : 0, Spatule souple, agile, 5/10/15, portée 0.
//   Capacités, dans cet ordre :
//     Frappe             arme        attaque gratuite, dans sa maîtrise
//     Moulinet farineux  arme        attaque [1], 5 souffle, hors maîtrise (la spatule, agile)
//     Pas chassé         capacités   rôle deplacement, rang 1, gratuit
//
// ── Les trois de la démonstration ───────────────────────────────────────────
//
// aubepineEssai(), chefDePartieEssai(), marmitonDeCorveeEssai() : Aubépine
// Crèmebrûlée, le Chef de partie et un Marmiton de corvée, recopiés à la main
// de la démonstration (ses passifs câblés compris : Réduction, Vif, Solo du
// chef). Ils servent aux gabarits du journal qui se déroulent dans la
// démonstration. tests/combat_photographie.test.js tient, lui, ce que la
// banque donne vraiment.
//
// Aubépine Crèmebrûlée porte des pièces agiles et précises, toutes deux à d8 :
// son dé de défense est à égalité, le type retenu restant l'agile. Ses deux
// capacités de couteau sont hors maîtrise, à cause du couteau (précise). Le
// Chef de partie joue Pas chassé à chacune de ses puissances, comme le fait
// la photographie d'un adversaire au groupe 2 : [1] gratuit, [2] 1 souffle.
//
// ── L'état ──────────────────────────────────────────────────────────────────
//
// etatEssai() écrit à la main l'état d'un combat lancé, sans le moteur. Les
// noms y sont « le nom tel quel » : le nom entier sert de nom court et de
// jeton, et l'initiale est son premier signe. Il égale donc l'état du moteur
// quand chaque protagoniste a un nom d'un seul mot que nul autre ne porte ;
// au-delà (exemplaires numérotés, noms de plusieurs mots), donner « noms ».
// Rien n'y est à annuler : son « annulation » est SANS_ANNULATION.

import { validerPhoto } from "../../js/combat/forme.js";
import { ACTIONS_PJ, FACE_CONTRE, GRILLE_PJ, REGLES, SANS_ANNULATION, SIGNES, geler } from "../../js/combat/regles.js";
import { CARACTERISTIQUES, ZONES } from "../../js/personnage/regles.js";

const FACON_NEUTRE = {
  puissance: 0,
  arme: null,
  libelle: null,
  cout: { souffle: 0, lien: 0 },
  description: "",
  elements: [],
  passif: false,
  intervention: false,
  attaque: false,
  degats: null,
  portee: 0,
  locMultiple: 1,
  desavantage: false,
  maitrise: null,
};

const CAPACITE_NEUTRE = {
  nom: "Tour de main",
  role: null,
  niveau: 0,
  evolue: false,
  groupe: { genre: "base", titre: "Gestes de cuisine" },
  lien: null,
  inactive: null,
  facons: null,
};

// Un champ mal orthographié dans un contrôle passerait sans bruit, et le
// contrôle éprouverait autre chose que ce qu'il croit.
function completer(neutre, champs, quoi) {
  for (const nom of Object.keys(champs)) {
    if (!Object.hasOwn(neutre, nom)) throw new Error(`${quoi} : le champ « ${nom} » n'existe pas.`);
  }
  return structuredClone({ ...neutre, ...champs });
}

/** Une façon ; les champs manquants prennent une valeur neutre (gratuite, sans jet, sans dégâts). */
export function faconEssai(champs = {}) {
  return completer(FACON_NEUTRE, champs, "faconEssai");
}

/** Une capacité ; les champs manquants prennent une valeur neutre, et une seule façon neutre. */
export function capaciteEssai(champs = {}) {
  const capacite = completer(CAPACITE_NEUTRE, champs, "capaciteEssai");
  capacite.facons ??= capacite.inactive === null ? [faconEssai()] : [];
  return capacite;
}

const NOM_DE_ZONE = new Map(ZONES.map((zone) => [zone.code, zone.nom]));

const zonesDuPj = (armures) =>
  GRILLE_PJ.map(({ code, debut, fin }) => ({ nom: NOM_DE_ZONE.get(code), ecrit: NOM_DE_ZONE.get(code), code, debut, fin, armure: armures[code], resistance: 5 }));

// La grille humanoïde des adversaires de la démonstration : la face 1 est la
// contre-attaque, la tête est à 20.
const zonesDeLAdversaire = (armures, ecrits = {}) =>
  [
    ["torse", 2, 11],
    ["jambe_gauche", 12, 13],
    ["jambe_droite", 14, 15],
    ["bras_gauche", 16, 17],
    ["bras_droit", 18, 19],
    ["tete", 20, 20],
  ].map(([code, debut, fin]) => ({ nom: NOM_DE_ZONE.get(code), ecrit: ecrits[code] ?? NOM_DE_ZONE.get(code), code, debut, fin, armure: armures[code], resistance: 5 }));

const partout = (armure) => Object.fromEntries(GRILLE_PJ.map((zone) => [zone.code, armure]));

/**
 * La photographie faite de ces valeurs, retouchées, puis jugée par
 * validerPhoto : un contrôle ne part jamais d'une photographie que le
 * simulateur refuserait.
 */
function photographier(camp, valeurs, retoucher) {
  // Ce que rend le retoucheur ne compte pas : il change les valeurs sur place.
  retoucher(valeurs);
  const { photo, erreur } = validerPhoto({ camp, publiee_le: null, source: null, valeurs, avertissements: [] });
  if (erreur) throw new Error(`Photographie d'essai refusée : ${erreur}`);
  return photo;
}

const sansRetouche = () => {};

/**
 * Ajoute aux valeurs une capacité passive qui porte un rôle câblé, et son
 * entrée dans « passifs » : les deux vont ensemble. Pour un retoucheur :
 * pjEssai((valeurs) => { ajouterPassif(valeurs, { role: "bonus_force", niveau: 2, nom: "Costaud" }); }).
 * Rend l'indice de la capacité.
 */
export function ajouterPassif(valeurs, { role, niveau = 1, nom, groupe = { genre: valeurs.caracteristiques ? "archetype" : "capacites", titre: valeurs.caracteristiques ? "Saucier" : "Capacités" } }) {
  if (typeof nom !== "string") throw new Error("ajouterPassif : il faut le nom de la capacité.");
  const capacite = valeurs.capacites.length;
  valeurs.capacites.push(
    capaciteEssai({ nom, role, niveau, evolue: true, groupe, facons: [faconEssai({ puissance: niveau, elements: ["Passif"], passif: true })] }),
  );
  valeurs.passifs.push({ capacite, role, niveau });
  return capacite;
}

// ─── Les deux protagonistes ronds ───────────────────────────────────────────

const COUTEAU = { genre: "arme", titre: "Couteau d'office (précise)" };
const GESTES = { genre: "base", titre: "Gestes de cuisine" };
const SPATULE = { genre: "arme", titre: "Spatule souple" };
const CAPACITES = { genre: "capacites", titre: "Capacités" };

// La cause d'un désavantage de maîtrise : l'objet qui donne la capacité, et
// son type (contrat du groupe 2, § 5.3).
const HORS_MAITRISE_DU_COUTEAU = { origine: "Couteau d'office", poids: "precise" };
const HORS_MAITRISE_DE_LA_SPATULE = { origine: "Spatule souple", poids: "agile" };

/** Le personnage rond (voir l'en-tête). retoucher reçoit ses valeurs, et les change sur place. */
export function pjEssai(retoucher = sansRetouche) {
  return photographier(
    "pj",
    {
      identifiant: "essai-aubepine-0000000001",
      nom: "Aubépine",
      sousTitre: "Marmiton · Saucier",
      actions: ACTIONS_PJ,
      souffle: 10,
      corps: 10,
      souffleAbsent: false,
      zones: zonesDuPj(partout(10)),
      faceContre: FACE_CONTRE.pj,
      caracteristiques: Object.fromEntries(CARACTERISTIQUES.map(({ code }) => [code, 4])),
      attaque: null,
      defense: null,
      deDefense: { faces: 8, type: "agile", caracteristiques: ["agilite", "creativite"], meles: false, egalite: [] },
      armes: [
        { nom: "Couteau d'office", libelle: "Couteau d'office", poids: "precise", faces: 8, caracteristiques: ["precision", "agilite"], degats: [5, 10, 15], portee: 1, locMultiple: 1, mainsNues: false },
        { nom: "Taloche", libelle: "Taloche", poids: null, faces: null, caracteristiques: null, degats: [2, 4, 8], portee: 0, locMultiple: 1, mainsNues: true },
      ],
      armePretee: 0,
      bouclier: null,
      liens: [{ nom: "Grand Four", points: 2 }],
      passifs: [],
      capacites: [
        capaciteEssai({
          nom: "Frappe",
          groupe: COUTEAU,
          facons: [faconEssai({ arme: 0, description: "Une attaque qui inflige 5/10/15.", attaque: true, degats: [5, 10, 15], portee: 1 })],
        }),
        capaciteEssai({
          nom: "Émincer",
          groupe: COUTEAU,
          facons: [
            faconEssai({
              arme: 0,
              cout: { souffle: 4, lien: 0 },
              description: "Une réussite de plus si vous en avez une.",
              attaque: true,
              degats: [5, 10, 15],
              portee: 1,
              desavantage: true,
              maitrise: HORS_MAITRISE_DU_COUTEAU,
            }),
          ],
        }),
        capaciteEssai({
          nom: "Flambage",
          niveau: 2,
          evolue: true,
          groupe: { genre: "archetype", titre: "Saucier" },
          facons: [
            faconEssai({ puissance: 1, cout: { souffle: 5, lien: 0 }, description: "Multiplie les dégâts par 2." }),
            faconEssai({ puissance: 2, cout: { souffle: 10, lien: 0 }, description: "Multiplie les dégâts par 3." }),
          ],
        }),
        capaciteEssai({
          nom: "Fournaise",
          niveau: 1,
          evolue: true,
          groupe: { genre: "primordial", titre: "Grand Four" },
          lien: 0,
          facons: [faconEssai({ puissance: 1, cout: { souffle: 1, lien: 1 }, description: "Réchauffe la case." })],
        }),
        capaciteEssai({
          nom: "Pas chassé",
          role: "deplacement",
          niveau: 2,
          evolue: true,
          groupe: GESTES,
          facons: [
            faconEssai({ puissance: 1, description: "Se déplace de 1 cases." }),
            faconEssai({ puissance: 2, cout: { souffle: 1, lien: 0 }, description: "Se déplace de 2 cases." }),
          ],
        }),
        capaciteEssai({ nom: "Goûter", role: "jet_de_caracteristique", groupe: GESTES, facons: [faconEssai({ description: "Fait un jet de caractéristique." })] }),
        capaciteEssai({
          nom: "Taloche",
          role: "mains_nues",
          niveau: 1,
          evolue: true,
          groupe: GESTES,
          facons: [faconEssai({ puissance: 1, arme: 1, description: "Une taloche qui inflige 2/4/8.", elements: ["Dégâts"], attaque: true, degats: [2, 4, 8] })],
        }),
        capaciteEssai({
          nom: "Pas de côté",
          role: "esquive",
          groupe: GESTES,
          facons: [faconEssai({ cout: { souffle: "X", lien: 0 }, description: "Annulez X dégâts reçus.", elements: ["Intervention"], intervention: true })],
        }),
      ],
    },
    retoucher,
  );
}

// Les trois capacités que tout adversaire de la démonstration tient de ses
// types : deux de sa spatule, une de son espèce. Pas chassé a une façon par
// puissance, de 1 à son rang ; elle coûte sa puissance moins 1 en souffle.
const capacitesDeSpatule = ({ degats, moulinetHorsMaitrise, rangDuPas }) => [
  capaciteEssai({
    nom: "Frappe",
    groupe: SPATULE,
    facons: [faconEssai({ arme: 0, libelle: "Spatule souple", description: `Une attaque qui inflige ${degats.join("/")}.`, attaque: true, degats })],
  }),
  capaciteEssai({
    nom: "Moulinet farineux",
    niveau: 1,
    evolue: true,
    groupe: SPATULE,
    facons: [
      faconEssai({
        puissance: 1,
        arme: 0,
        libelle: "Spatule souple",
        cout: { souffle: 5, lien: 0 },
        description: "Tourbillonne 1 fois.",
        attaque: true,
        degats,
        desavantage: moulinetHorsMaitrise,
        maitrise: moulinetHorsMaitrise ? HORS_MAITRISE_DE_LA_SPATULE : null,
      }),
    ],
  }),
  capaciteEssai({
    nom: "Pas chassé",
    role: "deplacement",
    niveau: rangDuPas,
    evolue: true,
    groupe: CAPACITES,
    facons: Array.from({ length: rangDuPas }, (_rien, rang) =>
      faconEssai({ puissance: rang + 1, cout: { souffle: rang, lien: 0 }, description: `Se déplace de ${rang + 1} cases.` }),
    ),
  }),
];

const adversaire = ({ nom, sousTitre, souffle, attaque, defense, armures, ecrits, degats, moulinetHorsMaitrise, rangDuPas }) => ({
  identifiant: null,
  nom,
  sousTitre,
  actions: 1,
  souffle,
  corps: 10,
  souffleAbsent: false,
  zones: zonesDeLAdversaire(armures, ecrits),
  faceContre: FACE_CONTRE.adv,
  caracteristiques: null,
  attaque,
  defense,
  deDefense: null,
  armes: [{ nom: "Spatule souple", libelle: "Spatule souple", poids: "agile", faces: null, caracteristiques: null, degats, portee: 0, locMultiple: 1, mainsNues: false }],
  armePretee: null,
  bouclier: null,
  liens: [],
  passifs: [],
  capacites: capacitesDeSpatule({ degats, moulinetHorsMaitrise, rangDuPas }),
});

/** L'adversaire rond (voir l'en-tête). retoucher reçoit ses valeurs, et les change sur place. */
export function adversaireEssai(retoucher = sansRetouche) {
  return photographier(
    "adv",
    adversaire({ nom: "Marmiton", sousTitre: "Commis", souffle: 5, attaque: 4, defense: 5, armures: partout(10), degats: [5, 10, 15], moulinetHorsMaitrise: true, rangDuPas: 1 }),
    retoucher,
  );
}

// ─── Les trois de la démonstration ──────────────────────────────────────────

const SAUCIER = { genre: "archetype", titre: "Saucier" };
const MARMITON = { genre: "espece", titre: "Marmiton" };
const GRAND_FOUR = { genre: "primordial", titre: "Grand Four" };
const passive = (champs) => faconEssai({ elements: ["Passif"], passif: true, ...champs });

/** Aubépine Crèmebrûlée, telle que la démonstration la donne. */
export function aubepineEssai(retoucher = sansRetouche) {
  return photographier(
    "pj",
    {
      identifiant: "demo-aubepine-0000000001",
      nom: "Aubépine Crèmebrûlée",
      sousTitre: "Marmiton · Saucier",
      actions: ACTIONS_PJ,
      souffle: 10,
      corps: 10,
      souffleAbsent: false,
      zones: zonesDuPj({ tete: 6, torse: 30, jambe_gauche: 10, jambe_droite: 10, bras_gauche: 10, bras_droit: 10 }),
      faceContre: FACE_CONTRE.pj,
      caracteristiques: { force: 4, agilite: 5, precision: 5, sens: 3, culture_neruvienne: 4, savoir_sauvage: 3, parole: 4, empathie: 4, creativite: 4 },
      attaque: null,
      defense: null,
      deDefense: { faces: 8, type: "agile", caracteristiques: ["agilite", "creativite"], meles: true, egalite: ["agile", "precise"] },
      armes: [
        { nom: "Couteau d'office", libelle: "Couteau d'office", poids: "precise", faces: 10, caracteristiques: ["precision", "agilite"], degats: [3, 8, 20], portee: 1, locMultiple: 1, mainsNues: false },
        { nom: "Taloche", libelle: "Taloche", poids: null, faces: null, caracteristiques: null, degats: [2, 4, 8], portee: 0, locMultiple: 1, mainsNues: true },
      ],
      armePretee: 0,
      bouclier: { nom: "Couvercle de marmite", defense: 8 },
      liens: [{ nom: "Grand Four", points: 1 }],
      passifs: [
        { capacite: 2, role: "degrossir", niveau: 1 },
        { capacite: 6, role: "bonus_agilite", niveau: 1 },
        { capacite: 8, role: "seul_sur_sa_case", niveau: 1 },
      ],
      capacites: [
        // Aubépine n'a que la maîtrise de l'agile, et son couteau est précis :
        // ses deux capacités sont hors maîtrise.
        capaciteEssai({
          nom: "Frappe",
          groupe: COUTEAU,
          facons: [
            faconEssai({ arme: 0, description: "Une attaque qui inflige 3/8/20.", attaque: true, degats: [3, 8, 20], portee: 1, desavantage: true, maitrise: HORS_MAITRISE_DU_COUTEAU }),
          ],
        }),
        capaciteEssai({
          nom: "Émincer",
          groupe: COUTEAU,
          facons: [
            faconEssai({
              arme: 0,
              cout: { souffle: 4, lien: 0 },
              description: "Une réussite de plus si vous en avez une.",
              attaque: true,
              degats: [3, 8, 20],
              portee: 1,
              desavantage: true,
              maitrise: HORS_MAITRISE_DU_COUTEAU,
            }),
          ],
        }),
        capaciteEssai({ nom: "Réduction", role: "degrossir", niveau: 1, evolue: true, groupe: SAUCIER, facons: [passive({ puissance: 1, description: "Retire 1 points d'armure par réussite." })] }),
        capaciteEssai({
          nom: "Flambage",
          niveau: 2,
          evolue: true,
          groupe: SAUCIER,
          facons: [
            faconEssai({ puissance: 1, cout: { souffle: 5, lien: 0 }, description: "Multiplie les dégâts par 2." }),
            faconEssai({ puissance: 2, cout: { souffle: 10, lien: 0 }, description: "Multiplie les dégâts par 3." }),
          ],
        }),
        capaciteEssai({ nom: "Dressage minute", groupe: SAUCIER, facons: [faconEssai({ description: "Sert un allié avant son tour.", elements: ["Intervention"], intervention: true })] }),
        capaciteEssai({
          nom: "Maîtrise de l'agile",
          niveau: 1,
          evolue: true,
          groupe: SAUCIER,
          facons: [passive({ puissance: 1, description: "Les 1 premières capacités d'un objet Agile, sans désavantage.", elements: ["Maîtrise", "Passif"] })],
        }),
        capaciteEssai({ nom: "Vif", role: "bonus_agilite", niveau: 1, evolue: true, groupe: MARMITON, facons: [passive({ puissance: 1, description: "Ajoutez 1 aux jets d'agilité." })] }),
        capaciteEssai({ nom: "Nez fin", groupe: MARMITON, facons: [passive({ cout: { souffle: 1, lien: 0 }, description: "Retournez un dé devant un plat douteux." })] }),
        capaciteEssai({
          nom: "Solo du chef",
          role: "seul_sur_sa_case",
          niveau: 1,
          evolue: true,
          groupe: { genre: "style", titre: "Style de combat" },
          facons: [passive({ puissance: 1, description: "Seul sur sa case : 1 avantages.", elements: ["Style de combat", "Passif"] })],
        }),
        capaciteEssai({
          nom: "Fournaise",
          niveau: 1,
          evolue: true,
          groupe: GRAND_FOUR,
          lien: 0,
          facons: [faconEssai({ puissance: 1, cout: { souffle: 1, lien: 1 }, description: "Réchauffe la case." })],
        }),
        capaciteEssai({ nom: "Cendre", groupe: GRAND_FOUR, lien: 0, facons: [faconEssai({ cout: { souffle: 2, lien: 1 }, description: "Disparaît dans la fumée." })] }),
        capaciteEssai({
          nom: "Se couvrir",
          groupe: { genre: "objet", titre: "Couvercle de marmite" },
          facons: [faconEssai({ description: "Reportez les dommages sur les 8 points du couvercle." })],
        }),
        capaciteEssai({ nom: "Boire le bouillon", groupe: { genre: "objet", titre: "Bouillon revigorant" }, facons: [faconEssai({ description: "Regagnez 5 points de résistance." })] }),
        capaciteEssai({ nom: "Pas chassé", role: "deplacement", niveau: 1, evolue: true, groupe: GESTES, facons: [faconEssai({ puissance: 1, description: "Se déplace de 1 cases." })] }),
        capaciteEssai({ nom: "Goûter", role: "jet_de_caracteristique", groupe: GESTES, facons: [faconEssai({ description: "Fait un jet de caractéristique." })] }),
        capaciteEssai({
          nom: "Taloche",
          role: "mains_nues",
          niveau: 1,
          evolue: true,
          groupe: GESTES,
          facons: [faconEssai({ puissance: 1, arme: 1, description: "Une taloche qui inflige 2/4/8.", elements: ["Dégâts"], attaque: true, degats: [2, 4, 8] })],
        }),
        capaciteEssai({
          nom: "Pas de côté",
          role: "esquive",
          groupe: GESTES,
          facons: [faconEssai({ cout: { souffle: "X", lien: 0 }, description: "Annulez X dégâts reçus.", elements: ["Intervention"], intervention: true })],
        }),
        capaciteEssai({
          nom: "Guetter",
          role: "attendre",
          groupe: GESTES,
          facons: [
            faconEssai({ description: "Après un déplacement, ou pour finir son tour : une de vos capacités se joue en intervention jusqu'au prochain tour de votre camp." }),
          ],
        }),
      ],
    },
    retoucher,
  );
}

/** Le Chef de partie : sa maîtrise de l'agile, au rang 3, couvre ses deux capacités de spatule. */
export function chefDePartieEssai(retoucher = sansRetouche) {
  return photographier(
    "adv",
    adversaire({
      nom: "Chef de partie",
      sousTitre: "Commis, Rôtisseur ×1,4",
      souffle: 7,
      attaque: 5,
      defense: 7,
      armures: { torse: 38, jambe_gauche: 0, jambe_droite: 0, bras_gauche: 19, bras_droit: 19, tete: 6 },
      ecrits: { jambe_droite: "Jambre droite" },
      degats: [6, 12, 19],
      moulinetHorsMaitrise: false,
      rangDuPas: 2,
    }),
    retoucher,
  );
}

/** Un Marmiton de corvée : sa maîtrise de l'agile, au rang 1, ne couvre que la première capacité de sa spatule. */
export function marmitonDeCorveeEssai(retoucher = sansRetouche) {
  return photographier(
    "adv",
    adversaire({
      nom: "Marmiton de corvée",
      sousTitre: "Commis, Rôtisseur",
      souffle: 5,
      attaque: 4,
      defense: 5,
      armures: { torse: 30, jambe_gauche: 0, jambe_droite: 0, bras_gauche: 15, bras_droit: 15, tete: 5 },
      ecrits: { jambe_droite: "Jambre droite" },
      degats: [5, 10, 15],
      moulinetHorsMaitrise: true,
      rangDuPas: 1,
    }),
    retoucher,
  );
}

// ─── La mise en place et l'état ─────────────────────────────────────────────

const CASE_PAR_DEFAUT = { pj: "A1", adv: "J1" };

/**
 * Une mise en place : les protagonistes dans l'ordre donné, leurs
 * identifiants fabriqués comme le fait la préparation (un seul compteur :
 * « pj1 », « adv2 », « adv3 »…). Sans case, un PJ est en A1 et un adversaire
 * en J1.
 */
export function miseEnPlaceEssai(protagonistes, { mode = "demo", quiCommence = "pj" } = {}) {
  return geler({
    mode,
    quiCommence,
    compteur: protagonistes.length,
    protagonistes: protagonistes.map(({ photo, case: nomDeCase }, rang) => ({
      id: `${photo.camp}${rang + 1}`,
      camp: photo.camp,
      case: nomDeCase ?? CASE_PAR_DEFAUT[photo.camp],
      photo,
    })),
  });
}

const NOM_DU_CAMP = { pj: "PJ", adv: "adversaires" };
const autreCamp = (camp) => (camp === "pj" ? "adv" : "pj");
const compter = (nombre, singulier, pluriel) => `${nombre} ${nombre === 1 ? singulier : pluriel}`;
const ligneDeTour = ({ numero, camp }) => `${SIGNES.tiret} Tour ${numero} ${SIGNES.point} camp des ${NOM_DU_CAMP[camp]} ${SIGNES.tiret}`;

function initiale(nom) {
  const signe = [...nom].find((candidat) => /[\p{L}\p{N}]/u.test(candidat));
  return signe ? signe.toUpperCase() : "?";
}

/**
 * L'état d'un combat lancé sur cette mise en place, écrit à la main : chacun
 * à ses valeurs de départ, personne n'a joué, aucun geste n'est ouvert.
 *
 * - tour : { numero, camp } ; par défaut le tour 1 du camp qui commence.
 *   Donné plus loin, l'état est celui qu'on atteint par « Fin de tour »,
 *   autant de fois qu'il le faut : le journal porte ces fins de tour, et
 *   « pas » compte un événement pour le lancement et un par fin de tour.
 * - noms : { [id]: { entier, court, jeton, initiales, exemplaire } }, pour
 *   remplacer en tout ou partie « le nom tel quel » (voir l'en-tête).
 * - lanceLe : l'heure du lancement.
 * - retoucher : reçoit l'état avant qu'il soit gelé, et le change sur place
 *   (une action de moins, du souffle dépensé, une zone entamée, un mort).
 *
 * « annulation » est SANS_ANNULATION, l'objet même (contrat du groupe 2,
 * § 2.2) : aucun geste n'est encore fini.
 */
export function etatEssai(miseEnPlace, { tour = null, noms = {}, lanceLe = "2026-10-12T21:30", retoucher = sansRetouche } = {}) {
  const { mode, quiCommence, protagonistes } = miseEnPlace;
  const vise = tour ?? { numero: 1, camp: quiCommence };
  if (!Number.isInteger(vise.numero) || vise.numero < 1 || !Object.hasOwn(NOM_DU_CAMP, vise.camp)) throw new Error("etatEssai : le tour demandé n'existe pas.");

  const journal = [
    {
      genre: "cadre",
      texte: `Combat lancé : ${compter(protagonistes.filter((p) => p.camp === "pj").length, "personnage", "personnages")} contre ${compter(
        protagonistes.filter((p) => p.camp === "adv").length,
        "adversaire",
        "adversaires",
      )}. Les ${NOM_DU_CAMP[quiCommence]} commencent.`,
    },
  ];
  let courant = { numero: 1, camp: quiCommence };
  journal.push({ genre: "tour", texte: ligneDeTour(courant) });
  let pas = 1;
  let dernieres = journal.map((ligne) => ligne.texte);
  while (courant.numero !== vise.numero || courant.camp !== vise.camp) {
    const suivant = autreCamp(courant.camp);
    const fin = { genre: "cadre", texte: `Fin du tour des ${NOM_DU_CAMP[courant.camp]} : ils retrouvent leurs actions.` };
    courant = { numero: courant.numero + (suivant === quiCommence ? 1 : 0), camp: suivant };
    const debut = { genre: "tour", texte: ligneDeTour(courant) };
    journal.push(fin, debut);
    dernieres = [fin.texte, debut.texte];
    pas += 1;
  }

  const etat = {
    regles: REGLES,
    mode,
    quiCommence,
    phase: "combat",
    ordre: protagonistes.map((protagoniste) => protagoniste.id),
    photos: Object.fromEntries(protagonistes.map(({ id, photo }) => [id, photo.valeurs])),
    noms: Object.fromEntries(
      protagonistes.map(({ id, photo }) => {
        const { nom } = photo.valeurs;
        return [id, { entier: nom, court: nom, jeton: nom, initiales: initiale(nom), exemplaire: null, ...noms[id] }];
      }),
    ),
    lanceLe,
    tour: courant,
    protagonistes: Object.fromEntries(
      protagonistes.map(({ id, camp, case: nomDeCase, photo }) => {
        const { actions, souffle, corps, attaque, defense, zones, liens } = photo.valeurs;
        return [
          id,
          {
            camp,
            case: nomDeCase,
            actions,
            actionsMax: actions,
            souffle,
            souffleMax: souffle,
            corps,
            corpsMax: corps,
            attaque,
            defense,
            zones: zones.map(({ armure, resistance }) => ({ armure, armureMax: armure, resistance, resistanceMax: resistance })),
            liens: liens.map(({ points }) => ({ points, max: points })),
            passe: false,
            mort: null,
          },
        ];
      }),
    ),
    effets: [],
    pile: [],
    journal,
    // Ce que dit la région d'annonce après un changement de cadre : les
    // lignes ajoutées par le dernier événement, à la suite.
    annonce: { pas, texte: dernieres.join(" ") },
    vainqueur: null,
    pas,
    annulation: SANS_ANNULATION,
  };
  retoucher(etat);
  return geler(etat);
}
