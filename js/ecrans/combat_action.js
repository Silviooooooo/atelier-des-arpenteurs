// Le panneau d'action du simulateur de combat (SPECIFICATION.md, § 17, « Le
// simulateur de combat (lot 4) »).
//
// Ce qu'il fait : il montre la vue du panneau que fabrique le moteur
// (vuePanneau, js/combat/lecture.js) : « Qui joue ? », le titre, les étapes,
// les capacités groupées par origine, la cible, les dés et les choix du
// moment. Chaque bouton émet la commande que la vue lui donne, chaque saisie
// complète le gabarit que la vue lui donne.
//
// Pourquoi il existe : l'écran du combat se partage en quatre parties, pour
// que chacune se contrôle seule, sur des vues écrites à la main. Celle-ci ne
// porte AUCUNE règle du jeu et n'importe rien du moteur : ce qui est permis,
// ce qui ne l'est pas et pourquoi, les bornes d'une saisie, tout vient de la
// vue ; le moteur revalide chaque événement.
//
// Trois nœuds sont créés une fois et ne sont jamais refaits : la section, la
// liste d'une case (« +k », que remplit l'écran) et la région d'annonce,
// seule région polie de l'écran, pour les lecteurs d'écran. La région n'est
// pas dans la section : l'écran la pose dans la page dès son premier rendu,
// vide, pour qu'un lecteur d'écran la connaisse avant qu'elle parle ; entrée
// dans la page avec le panneau, déjà pleine, sa première annonce pouvait ne
// pas être dite. Le corps, lui, est refait en entier dès que la vue change,
// et seulement alors : un rendu de plus (l'enregistrement qui finit) ne doit
// ni effacer une saisie en cours, ni déplacer le focus.

import { el, enumerer, sansSensForce } from "./dom.js";

// D'où vient un clic fait ici : l'écran s'en sert pour dire « choisie ici ».
const ORIGINE = "panneau";
const TEXTE_ORIGINE = { plateau: "choisie sur la carte", panneau: "choisie ici" };

const CLASSE_ETAPE = { faite: "fait", en_cours: "en-cours" };

// Un dé ne dit jamais son état par la couleur seule : le signe est écrit
// dans le dé, et l'état dans son nom accessible.
const ETATS_DE = {
  reussi: { classe: "reussi", dit: "réussi", signe: "✓" },
  echoue: { classe: "echoue", dit: "échec", signe: "✗" },
  relance: { classe: "relance", dit: "relancé", signe: null },
  a_lancer: { classe: "a-lancer", dit: "à lancer", signe: null },
  a_venir: { classe: "a-venir", dit: "à venir", signe: null },
};

const SIGNE_MOINS = "−";
// Le titre du texte d'une capacité, à côté des dés : celui de la maquette.
const TITRE_DE_LA_DESCRIPTION = "Effets de capacité (mode assisté)";
// Ce qui sépare, dans le titre du panneau, qui joue de ce qu'il lui reste :
// « Aubépine Crèmebrûlée joue — 1 action sur 2, souffle 10 ».
const TIRET_DU_TITRE = " — ";

// Ce que dit une saisie refusée : ces textes ne viennent pas de l'auteur, et
// restent à lui faire confirmer.
const RAISON_REFUSEE = "Une raison est demandée.";

const present = (valeur) => valeur !== null && valeur !== undefined;

/** Un nombre tel qu'il s'écrit dans une phrase : « −3 », « 5 ». */
const ecrireNombre = (n) => (n < 0 ? `${SIGNE_MOINS}${Math.abs(n)}` : String(n));

/** Les bornes d'une saisie, en clair : « de 0 à 5 » ; rien si la vue n'en donne pas. */
function ecrireBornes(saisie) {
  return typeof saisie.min === "number" && typeof saisie.max === "number" ? ` (de ${ecrireNombre(saisie.min)} à ${ecrireNombre(saisie.max)})` : "";
}

/** Ce que dit un nombre refusé : « Un nombre entier de 0 à 5 est attendu. » */
function nombreRefuse(saisie) {
  const bornes = typeof saisie.min === "number" && typeof saisie.max === "number" ? ` de ${ecrireNombre(saisie.min)} à ${ecrireNombre(saisie.max)}` : "";
  return `Un nombre entier${bornes} est attendu.`;
}

/**
 * L'entier que porte un champ, ou null s'il n'en porte pas un qui tienne
 * dans les bornes que la vue a données. Le moteur revalide : ceci évite
 * seulement d'émettre ce qu'il refuserait à coup sûr.
 */
function lireEntier(texte, min, max) {
  const net = String(texte).trim().replace(SIGNE_MOINS, "-");
  if (!/^[+-]?\d+$/.test(net)) return null;
  const nombre = Number(net);
  if (!Number.isSafeInteger(nombre)) return null;
  if (typeof min === "number" && nombre < min) return null;
  if (typeof max === "number" && nombre > max) return null;
  return nombre === 0 ? 0 : nombre;
}

/**
 * Le gabarit d'une saisie, complété. Deux événements ne rangent pas leur
 * nombre dans « valeur » : l'esquive le veut dans « x », les dégâts dans
 * leur unique opération « ajuster », avec sa raison.
 */
function completer(gabarit, valeur, raison) {
  const evenement = gabarit?.evenement;
  if (!evenement) return null;
  if (evenement.type === "degats") return { evenement: { ...evenement, operations: [{ op: "ajuster", valeur, raison }] } };
  if (evenement.type === "esquive") return { evenement: { ...evenement, x: valeur } };
  return { evenement: raison === null ? { ...evenement, valeur } : { ...evenement, valeur, raison } };
}

/** Pose data-focus sur la commande qui attend, et sur elle seule. */
function marquer(r, noeud, cle) {
  if (r.pose || !present(cle) || cle !== r.focus) return;
  noeud.setAttribute("data-focus", cle);
  r.pose = true;
}

/**
 * Le nom accessible d'un bouton ou d'un dé. Il peut porter un nom venu de la
 * banque (une zone, une arme) : comme tout texte montré, il perd les signes
 * qui commandent le sens de l'écriture.
 */
const nomAccessible = (etiquette) => (present(etiquette) ? sansSensForce(etiquette) : null);

/**
 * Un bouton qui émet sa commande. Inactif, il garde le focus (aria-disabled,
 * jamais disabled), ne fait rien, et sa raison, écrite à côté de lui, lui
 * est liée. Rend le bouton, puis sa raison s'il en a une.
 *
 * « surPlace » : un réglage qui ne fait pas avancer le geste (la puissance,
 * une caractéristique sur deux). Le corps refait, le focus revient au bouton
 * de même clé, et non à la commande qui attend : on y revient d'un geste.
 */
function bouton(r, { cle = null, classe, contenu, commande = null, actif = true, raison = null, presse, etiquette = null, surPlace = false }) {
  const inactif = actif === false;
  const idRaison = inactif && raison ? `combat-action-raison-${(r.compteur += 1)}` : null;
  const noeud = el(
    "button",
    {
      type: "button",
      classe,
      "aria-pressed": presse === undefined ? null : String(Boolean(presse)),
      "aria-disabled": inactif ? "true" : null,
      "aria-describedby": idRaison,
      "aria-label": nomAccessible(etiquette),
      onclick: () => {
        if (inactif || !commande) return;
        if (!surPlace || !present(cle)) {
          r.actions.executer(commande, ORIGINE);
          return;
        }
        r.garder(cle);
        try {
          r.actions.executer(commande, ORIGINE);
        } finally {
          r.garder(null);
        }
      },
    },
    contenu,
  );
  marquer(r, noeud, cle);
  return [noeud, idRaison ? el("span", { id: idRaison, classe: "combat-raison" }, raison) : null];
}

/**
 * Une saisie : un nombre, sa raison si la vue en demande une, et le bouton
 * qui émet le gabarit complété. Une raison vide ne part jamais : sans elle,
 * seul un nombre nul s'émet (il efface le réglage), sauf pour des dégâts,
 * dont l'opération exige toujours la sienne.
 *
 * Une saisie refusée ne part pas, et le dit : le champ fautif est marqué
 * (aria-invalid, que la feuille de style montre), une phrase liée aux deux
 * champs dit ce qui est attendu, et le focus va au champ. Tant que rien
 * n'est refusé, la phrase est vide : un lecteur d'écran lit la description
 * d'un champ même quand elle est cachée. Rend la rangée, puis la phrase.
 */
function saisie(r, { cle, libelle, donnee, action, defaut = "" }) {
  const idRefus = `combat-action-refus-${(r.compteur += 1)}`;
  const refus = el("p", { id: idRefus, classe: "combat-refus", hidden: true });
  const nombre = el("input", {
    type: "number",
    classe: "champ",
    step: "1",
    min: present(donnee.min) ? donnee.min : null,
    max: present(donnee.max) ? donnee.max : null,
    "aria-describedby": idRefus,
  });
  nombre.value = String(donnee.valeur ?? defaut);
  marquer(r, nombre, cle);
  const veutUneRaison = Object.hasOwn(donnee, "raisonParDefaut") || Object.hasOwn(donnee, "raison");
  const raison = veutUneRaison ? el("input", { type: "text", classe: "champ", "aria-describedby": idRefus }) : null;
  if (raison) raison.value = String(donnee.raison ?? donnee.raisonParDefaut ?? "");

  const refuser = (champ, phrase) => {
    champ.setAttribute("aria-invalid", "true");
    refus.replaceChildren(phrase);
    refus.hidden = false;
    champ.focus();
  };
  const emettre = () => {
    nombre.removeAttribute("aria-invalid");
    raison?.removeAttribute("aria-invalid");
    refus.replaceChildren();
    refus.hidden = true;
    const valeur = lireEntier(nombre.value, donnee.min, donnee.max);
    if (valeur === null) {
      refuser(nombre, nombreRefuse(donnee));
      return;
    }
    let dite = null;
    if (raison) {
      dite = raison.value.trim();
      if (dite === "") {
        if (valeur !== 0 || donnee.gabarit?.evenement?.type === "degats") {
          refuser(raison, RAISON_REFUSEE);
          return;
        }
        dite = null;
      }
    }
    const commande = completer(donnee.gabarit, valeur, dite);
    if (commande) r.actions.executer(commande, ORIGINE);
  };
  const auClavier = (evenement) => {
    if (evenement.key !== "Enter") return;
    evenement.preventDefault();
    emettre();
  };
  nombre.addEventListener("keydown", auClavier);
  raison?.addEventListener("keydown", auClavier);

  return [
    el(
      "div",
      { classe: "combat-ligne" },
      el("label", {}, `${libelle}${ecrireBornes(donnee)}`, nombre),
      raison ? el("label", {}, "Raison", raison) : null,
      el("button", { type: "button", classe: "bouton secondaire", onclick: emettre }, action),
    ),
    refus,
  ];
}

/**
 * Une rangée de choix : son intitulé, puis un bouton par option. C'est un
 * groupe, que son intitulé nomme : un lecteur d'écran dit « Arrivée : » en
 * entrant dans la rangée, et non une suite de boutons sans objet.
 */
function rangee(r, classe, intitule, ...boutons) {
  const id = `combat-action-rangee-${(r.compteur += 1)}`;
  return el("div", { classe, role: "group", "aria-labelledby": id }, el("span", { id }, intitule), boutons);
}

// ——— Les capacités ———

function boutonDeCapacite(r, b) {
  return bouton(r, {
    cle: `capacite:${b.cle}`,
    classe: "combat-capacite",
    presse: Boolean(b.choisi),
    actif: b.actif,
    raison: b.raison,
    commande: b.commande,
    // Une espace entre les parties : sans elle, le nom du bouton se lirait d'un seul tenant (« Taloche [1]2/4/8 »).
    contenu: enumerer(
      [
        el("span", {}, b.libelle),
        present(b.degats) ? el("span", { classe: "combat-degats" }, b.degats) : null,
        present(b.cout) ? el("span", { classe: "combat-cout" }, b.cout) : null,
        b.desavantage ? el("span", { classe: "combat-desavantage" }, "désavantage") : null,
      ].filter(present),
      " ",
    ),
  });
}

/** Les groupes, dans l'ordre de la vue ; « Passer son tour » ferme le dernier. */
function groupes(r, vue) {
  const passer = vue.passer ? bouton(r, { cle: "passer", classe: "combat-capacite", actif: vue.passer.actif, raison: vue.passer.raison, commande: vue.passer.commande, contenu: "Passer son tour" }) : null;
  const liste = vue.groupes ?? [];
  const noeuds = liste.map((groupe, i) =>
    el(
      "div",
      { classe: "combat-groupe" },
      el("h3", { classe: "combat-groupe-titre" }, groupe.titre),
      (groupe.boutons ?? []).map((b) => boutonDeCapacite(r, b)),
      i === liste.length - 1 ? passer : null,
    ),
  );
  if (passer && liste.length === 0) noeuds.push(el("div", { classe: "combat-groupe" }, passer));
  return noeuds;
}

/** La ligne qui nomme les interventions et les passifs : ce ne sont pas des boutons. */
function mentions(vue) {
  const parts = [];
  if (vue.mentions?.interventions) parts.push([el("b", {}, "Interventions :"), ` ${vue.mentions.interventions}.`]);
  if (vue.mentions?.passifs) parts.push([el("b", {}, "Passifs :"), ` ${vue.mentions.passifs}.`]);
  return parts.length ? el("p", { classe: "combat-passifs" }, enumerer(parts, " ")) : null;
}

// ——— Le geste, avant les dés ———

/**
 * La puissance : ses deux pas gardent le focus, pour monter ou baisser
 * plusieurs fois de suite. Leur nom dit la puissance du moment : le bouton
 * refait, c'est ce qu'un lecteur d'écran entend du pas qui vient d'être fait.
 */
function puissance(r, p) {
  const actuelle = present(p.valeur) ? ` (actuelle : ${p.valeur})` : "";
  return el(
    "div",
    { classe: "combat-ligne combat-puissance" },
    el("span", {}, "Puissance"),
    bouton(r, { cle: "puissance:moins", classe: "bouton secondaire bouton-pas", etiquette: `Baisser la puissance${actuelle}`, actif: p.moins?.actif, raison: p.moins?.raison, commande: p.moins?.commande, contenu: SIGNE_MOINS, surPlace: true }),
    el("span", { classe: "combat-puissance-valeur" }, p.valeur),
    bouton(r, { cle: "puissance:plus", classe: "bouton secondaire bouton-pas", etiquette: `Monter la puissance${actuelle}`, actif: p.plus?.actif, raison: p.plus?.raison, commande: p.plus?.commande, contenu: "+", surPlace: true }),
  );
}

function jetPrete(r, j) {
  return el(
    "div",
    { classe: "combat-ligne combat-jet-prete" },
    bouton(r, { cle: "jet_prete", classe: "combat-capacite", presse: Boolean(j.presse), actif: j.actif, raison: j.raison, commande: j.commande, contenu: present(j.arme) ? `Jet d'attaque (${j.arme})` : "Jet d'attaque" }),
  );
}

function armes(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-armes",
    "Arme :",
    liste.map((arme, i) => bouton(r, { cle: `arme:${i}`, classe: "combat-capacite", presse: Boolean(arme.choisie), commande: arme.commande, contenu: arme.libelle })),
  );
}

function cibles(r, geste) {
  const liste = geste.cibles ?? [];
  if (liste.length === 0 && !geste.sansCible) return null;
  const origine = TEXTE_ORIGINE[r.origine] ?? null;
  return rangee(
    r,
    "combat-cibles",
    "Cible :",
    liste.map((cible) => [
      bouton(r, { cle: `cible:${cible.id}`, classe: null, presse: Boolean(cible.choisie), actif: cible.actif, raison: cible.raison, commande: cible.commande, contenu: cible.libelle }),
      cible.choisie && origine ? el("span", { classe: "combat-origine" }, origine) : null,
    ]),
    geste.sansCible ? bouton(r, { cle: "sans_cible", classe: null, presse: Boolean(geste.sansCible.choisie), commande: geste.sansCible.commande, contenu: "Sans cible" }) : null,
  );
}

/**
 * Les cases d'arrivée : les doubles, en boutons de 44 px, des cases de la
 * carte. Chacun porte le nom que la vue donne à sa case (« Case G2 : s'y
 * déplacer »), le même que sur la carte ; « G2 » seul ne disait pas quoi.
 */
function cases(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-arrivees",
    "Arrivée :",
    liste.map((c) => bouton(r, { cle: `case:${c.case}`, classe: "combat-capacite", presse: Boolean(c.choisie), commande: c.commande, contenu: c.case, etiquette: c.nom ?? null })),
  );
}

/**
 * Les caractéristiques d'un dé au choix. L'événement en veut une ou deux :
 * toucher une caractéristique choisie la retire (sauf la dernière), en
 * toucher une autre l'ajoute, et une troisième repart d'elle seule.
 */
function caracteristiques(r, c) {
  const choisies = c.choisies ?? [];
  const apres = (code) => {
    if (choisies.includes(code)) return choisies.length > 1 ? choisies.filter((autre) => autre !== code) : null;
    return choisies.length < 2 ? [...choisies, code] : [code];
  };
  return rangee(
    r,
    "combat-ligne combat-caracteristiques",
    present(c.de) ? ["Caractéristiques, une ou deux (dé : ", el("b", {}, c.de), ") :"] : "Caractéristiques, une ou deux :",
    (c.options ?? []).map((option) => {
      const valeur = apres(option.code);
      return bouton(r, {
        cle: `caracteristique:${option.code}`,
        classe: "combat-capacite",
        presse: choisies.includes(option.code),
        commande: valeur && c.gabarit?.evenement ? { evenement: { ...c.gabarit.evenement, valeur } } : null,
        contenu: present(option.valeur) ? `${option.nom} ${option.valeur}` : option.nom,
        surPlace: true,
      });
    }),
  );
}

function difficultes(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-difficultes",
    "Difficulté :",
    liste.map((d) => bouton(r, { cle: `difficulte:${d.valeur}`, classe: "combat-capacite", presse: Boolean(d.choisie), commande: d.commande, contenu: present(d.libelle) ? `${d.valeur} (${d.libelle})` : d.valeur })),
  );
}

function jauges(r, liste) {
  return rangee(
    r,
    "combat-ligne combat-jauges",
    "Lien payé sur :",
    liste.map((jauge, i) => bouton(r, { cle: `jauge:${i}`, classe: "combat-capacite", presse: Boolean(jauge.choisie), commande: jauge.commande, contenu: jauge.nom })),
  );
}

// ——— Les dés ———

function contexte(c) {
  const lignes = [];
  if (present(c.titre)) lignes.push(el("p", {}, el("b", {}, c.titre)));
  // Le dé nu, puis ses modificateurs, chacun avec sa source, à sa suite et
  // sans séparateur, comme sur la maquette : « Dé d8 (Force 4 + Agilité 5)
  // +1 (Vif) ».
  const jet = [];
  const modificateurs = c.modificateurs ?? [];
  if (present(c.de)) jet.push(["Dé ", el("b", {}, c.de), present(c.detail) ? ` (${c.detail})` : null, modificateurs.map((modificateur) => ` ${modificateur}`)]);
  else for (const modificateur of modificateurs) jet.push(modificateur);
  if (present(c.difficulte)) jet.push(["difficulté ", el("b", {}, c.difficulte)]);
  if (jet.length) lignes.push(el("p", {}, enumerer(jet, " · ")));
  const sources = [];
  if (present(c.net) && c.net !== "") sources.push(el("b", {}, c.net));
  if (c.avantages?.length) sources.push(`Avantages : ${c.avantages.join(", ")}`);
  if (c.desavantages?.length) sources.push(`Désavantages : ${c.desavantages.join(", ")}`);
  if (sources.length) lignes.push(el("p", {}, enumerer(sources, " · ")));
  return lignes.length ? el("div", { classe: "combat-contexte" }, lignes) : null;
}

/** Un dé : son titre, sa valeur (ou son type tant qu'il n'est pas lancé), son détail. Seul le dé à lancer agit. */
function de(r, { titre, valeur, detail, classe, etiquette, aLancer }) {
  const noeud = el(
    "button",
    {
      type: "button",
      classe: classe ? `combat-de ${classe}` : "combat-de",
      "aria-label": nomAccessible(etiquette),
      "aria-disabled": aLancer ? null : "true",
      onclick: () => {
        if (aLancer) r.actions.lancerLeDe();
      },
    },
    present(titre) ? el("span", { classe: "combat-de-titre" }, titre) : null,
    el("span", { classe: "combat-de-valeur" }, valeur ?? ""),
    present(detail) && detail !== "" ? el("span", { classe: "combat-de-detail" }, detail) : null,
  );
  if (aLancer) marquer(r, noeud, "de");
  return noeud;
}

/** Le dé qu'attend le moteur, quand aucune entrée de la chaîne ne le montre. */
function deALancer(r, titre, aLancer) {
  return de(r, { titre, valeur: aLancer.libelle, detail: "cliquez", classe: ETATS_DE.a_lancer.classe, etiquette: `${titre} : lancer le ${aLancer.libelle}`, aLancer: true });
}

function chaine(r, geste, dansLaChaine) {
  const entrees = geste.chaine ?? [];
  if (entrees.length === 0 && !dansLaChaine) return null;
  // Une seule entrée « à lancer » agit, et seulement si le moteur attend un dé.
  const attendue = geste.aLancer ? entrees.findIndex((entree) => entree.etat === "a_lancer") : -1;
  const des = entrees.map((entree, i) => {
    const etat = ETATS_DE[entree.etat] ?? { classe: "", dit: "", signe: null };
    const agit = i === attendue;
    const lance = present(entree.valeur);
    let detail = entree.detail ?? null;
    if (etat.signe) detail = [detail, etat.signe].filter(present).join(" ");
    else if (entree.etat === "relance") detail = etat.dit;
    else if (agit) detail = "cliquez";
    const dit = [lance ? `${entree.valeur}${present(entree.detail) ? ` (${entree.detail})` : ""}` : entree.de, etat.dit].filter((part) => present(part) && part !== "").join(", ");
    return de(r, { titre: entree.titre, valeur: lance ? entree.valeur : entree.de, detail, classe: etat.classe, etiquette: `${entree.titre} : ${dit}`, aLancer: agit });
  });
  if (dansLaChaine && attendue === -1) des.push(deALancer(r, "Dé", geste.aLancer));
  return el("div", { classe: "combat-chaine" }, des);
}

function lettres(liste) {
  return el("ul", { classe: "combat-lettres" }, liste.map((lettre) => el("li", { classe: lettre.atteinte ? "atteinte" : null }, lettre.texte)));
}

function degats(r, d) {
  const noeuds = [];
  if (d.bases?.length) noeuds.push(rangee(r, "combat-ligne combat-degats-bases", "Dégâts :", d.bases.map((base, i) => bouton(r, { cle: `degats:base:${i}`, classe: "combat-capacite", presse: Boolean(base.choisie), commande: base.commande, contenu: base.libelle }))));
  if (d.natures?.length) noeuds.push(rangee(r, "combat-ligne combat-degats-natures", "Nature :", d.natures.map((nature, i) => bouton(r, { cle: `degats:nature:${i}`, classe: "combat-capacite", presse: Boolean(nature.choisie), commande: nature.commande, contenu: nature.libelle }))));
  if (d.saisie) noeuds.push(saisie(r, { cle: "degats:saisie", libelle: "Dégâts à la main", donnee: d.saisie, action: "Fixer les dégâts" }));
  return noeuds;
}

/**
 * Ce que décale une saisie, sans équivoque : le dé tiré, puis, s'il a déjà
 * été décalé, la face qu'il vaut maintenant, puis la zone de cette face.
 * « Décaler le dé 14 : jambe gauche », « Décaler le dé 14 : face 16, bras
 * gauche ». Écrit « Décaler le 14 (bras gauche) », un dé déjà décalé se
 * lisait comme si le 14 tombait sur le bras.
 */
function libelleDuDecalage(coup) {
  const face = coup.face ?? coup.brut;
  const lu = [present(face) && face !== coup.brut ? `face ${face}` : null, coup.zone].filter(present).join(", ");
  return `Décaler le dé ${coup.brut}${lu === "" ? "" : ` : ${lu}`}`;
}

/** Les d20 lancés, celui qu'on attend, puis le décalage de chaque face qui peut l'être. */
function localisation(r, geste, d20Attendu) {
  const liste = geste.localisation ?? [];
  if (liste.length === 0 && !d20Attendu) return [];
  const des = liste.map((coup) => {
    const face = coup.face ?? coup.brut;
    const decale = present(coup.brut) && coup.brut !== face;
    const dite = [face, decale ? `dé ${coup.brut}` : null, coup.zone].filter(present).join(", ");
    // Un dé décalé montre aussi ce qu'il a tiré : sa valeur est la face décalée.
    return de(r, { titre: decale ? `d20 : ${coup.brut}` : "d20", valeur: face, detail: coup.zone ?? null, classe: "", etiquette: `Localisation : ${dite}`, aLancer: false });
  });
  if (d20Attendu) des.push(deALancer(r, "Localisation", geste.aLancer));
  const decalages = liste.map((coup, i) => (coup.decaler ? saisie(r, { cle: `decaler:${i}`, libelle: libelleDuDecalage(coup), donnee: coup.decaler, action: "Décaler" }) : null));
  return [el("div", { classe: "combat-chaine combat-localisation" }, des), decalages];
}

function detail(liste) {
  return el("ul", { classe: "combat-detail" }, liste.map((ligne) => el("li", {}, present(ligne.zone) ? `${ligne.zone} : ${ligne.texte}` : ligne.texte)));
}

/**
 * Les réglages à la main, avant le premier dé : une région que son titre
 * nomme, posée dans le document entre le contexte et la chaîne.
 */
function reglages(r, reglagesVus) {
  const id = `combat-action-reglages-${(r.compteur += 1)}`;
  return el(
    "aside",
    { classe: "combat-reglages", "aria-labelledby": id },
    el("h3", { id }, "Réglages à la main"),
    reglagesVus.modificateur ? saisie(r, { cle: "reglage:modificateur", libelle: "Modificateur de chaque dé", donnee: reglagesVus.modificateur, action: "Régler le modificateur", defaut: 0 }) : null,
    reglagesVus.avantages ? saisie(r, { cle: "reglage:avantages", libelle: `Avantages (+) ou désavantages (${SIGNE_MOINS})`, donnee: reglagesVus.avantages, action: "Régler les avantages", defaut: 0 }) : null,
  );
}

function gesteVu(r, geste) {
  const aLancer = geste.aLancer ?? null;
  const d20Attendu = Boolean(aLancer) && aLancer.motif === "localisation";
  const dansLaChaine = Boolean(aLancer) && !d20Attendu;

  const choix = (geste.choix ?? []).map((c) => bouton(r, { cle: `choix:${c.cle}`, classe: "bouton", commande: c.commande, contenu: c.libelle }));
  const fins = [
    geste.appliquer ? bouton(r, { cle: "appliquer", classe: "bouton", commande: geste.appliquer.commande, contenu: geste.appliquer.libelle ?? "Appliquer" }) : null,
    geste.confirmer ? bouton(r, { cle: "confirmer", classe: "bouton", actif: geste.confirmer.actif, raison: geste.confirmer.raison, commande: geste.confirmer.commande, contenu: geste.confirmer.libelle ?? "Confirmer" }) : null,
    geste.revenir ? bouton(r, { cle: "revenir", classe: "bouton secondaire", commande: geste.revenir.commande, contenu: "Revenir" }) : null,
  ].filter(present);

  // L'ordre du document est celui de la mission (§ 10.6), qui est aussi celui
  // du téléphone : le contexte ; les réglages à la main, qui n'existent
  // qu'avant le premier dé ; puis la chaîne, le bilan, les rangs, les choix
  // du moment, les dégâts à fixer, la face à décaler, l'esquive, « Revenir ».
  // Le texte de la capacité ferme le bloc. À partir de 56rem, la feuille de
  // style range les réglages et ce texte à droite des dés.
  const jet = el(
    "div",
    { classe: "combat-jet" },
    chaine(r, geste, dansLaChaine),
    present(geste.bilan) && geste.bilan !== "" ? el("p", { classe: "combat-bilan" }, geste.bilan) : null,
    geste.lettres?.length ? lettres(geste.lettres) : null,
    choix.length ? el("div", { classe: "combat-choix" }, choix) : null,
    geste.degats ? degats(r, geste.degats) : null,
    localisation(r, geste, d20Attendu),
    geste.esquive ? saisie(r, { cle: "esquive", libelle: `${geste.esquive.libelle}, X`, donnee: geste.esquive, action: geste.esquive.libelle, defaut: geste.esquive.min ?? "" }) : null,
    geste.detail?.length ? detail(geste.detail) : null,
    fins.length ? el("div", { classe: "combat-choix" }, fins) : null,
  );

  // Le texte de la capacité se montre toujours (mode assisté) : c'est au
  // joueur d'en appliquer l'effet. Son titre est celui de la maquette.
  const assiste =
    present(geste.description) && geste.description !== "" ? el("div", { classe: "combat-assiste" }, el("h3", {}, TITRE_DE_LA_DESCRIPTION), el("p", { classe: "combat-description" }, geste.description)) : null;

  return [
    geste.puissance ? puissance(r, geste.puissance) : null,
    geste.jetPrete ? jetPrete(r, geste.jetPrete) : null,
    geste.armes?.length ? armes(r, geste.armes) : null,
    cibles(r, geste),
    geste.cases?.length ? cases(r, geste.cases) : null,
    geste.caracteristiques ? caracteristiques(r, geste.caracteristiques) : null,
    geste.difficultes?.length ? difficultes(r, geste.difficultes) : null,
    geste.x ? saisie(r, { cle: "x", libelle: "X", donnee: geste.x, action: "Régler X", defaut: 0 }) : null,
    geste.jauges?.length ? jauges(r, geste.jauges) : null,
    el("div", { classe: "combat-des" }, geste.contexte ? contexte(geste.contexte) : null, geste.contexte?.reglages ? reglages(r, geste.contexte.reglages) : null, jet, assiste),
  ];
}

// ——— Le corps ———

function composer(r, vue) {
  if (vue.genre === "preparation") return [];
  // Le titre peut recevoir le focus : c'est là qu'il va quand aucune commande n'attend.
  // Ce qui suit le dernier tiret (les actions, le souffle) s'écrit plus bas
  // que le nom, comme sur la maquette : la coupe ne change pas le texte, et
  // un nom qui porterait lui-même un tiret reste entier devant.
  const titre = (texte) => {
    const coupe = String(texte).lastIndexOf(TIRET_DU_TITRE);
    const contenu = coupe > 0 ? [texte.slice(0, coupe), el("span", { classe: "combat-qui-suite" }, texte.slice(coupe))] : [texte];
    return el("h2", { classe: "combat-qui", tabindex: "-1" }, contenu);
  };
  let noeuds;
  if (vue.genre === "qui_joue") {
    const candidats = (vue.candidats ?? []).map((candidat) => bouton(r, { cle: `candidat:${candidat.id}`, classe: "bouton secondaire", commande: candidat.commande, contenu: candidat.nom }));
    noeuds = [titre("Qui joue ?"), candidats.length ? el("div", { classe: "combat-choix" }, candidats) : null];
  } else if (vue.genre === "termine") {
    noeuds = [titre(vue.vainqueur ?? "Combat terminé")];
  } else {
    noeuds = [
      titre(vue.titre ?? ""),
      vue.etapes?.length
        ? el(
            "ol",
            { classe: "combat-etapes" },
            vue.etapes.map((etape) => el("li", { classe: CLASSE_ETAPE[etape.etat] ?? null, "aria-current": etape.etat === "en_cours" ? "step" : null }, etape.nom)),
          )
        : null,
      groupes(r, vue),
      mentions(vue),
      vue.geste ? gesteVu(r, vue.geste) : null,
    ];
  }
  if (!r.pose) noeuds[0].setAttribute("data-focus", "titre");
  return noeuds.flat(Infinity).filter(present);
}

/**
 * Le panneau d'action. `actions` : { executer(commande, origine), lancerLeDe() }.
 * Rend { noeud, rendre(vue, ecran), listeDeCase, annonce, dire(texte) } ;
 * `ecran.origineDeLaCible` vaut "plateau", "panneau" ou rien. `rendre` dit
 * vrai quand il a refait le corps : l'écran ne repose le focus (sur
 * [data-focus]) que dans ce cas. `annonce` est la région polie, que l'écran
 * pose dans la page ; `dire` y écrit ce que l'écran a à dire lui-même
 * (« Journal copié. »), et l'annonce suivante du combat le remplace.
 */
export function creer(actions) {
  const corps = el("div", { classe: "combat-action-corps" });
  const listeDeCase = el("div", { classe: "combat-case-liste" });
  const annonce = el("p", { classe: "combat-annonce", "aria-live": "polite" });
  const noeud = el("section", { classe: "combat-action", "aria-label": "Action en cours" }, corps, listeDeCase);
  let rendue = null;
  let pasAnnonce = null;
  // La clé du réglage qui garde le focus, le temps que l'écran redessine.
  let gardee = null;

  // Un lecteur d'écran redit ce qui change dans la région : elle ne change
  // donc que lorsque le pas de l'annonce change, jamais à chaque rendu.
  function annoncer(dite) {
    if (!dite) {
      if (pasAnnonce !== null) annonce.replaceChildren();
      pasAnnonce = null;
      return;
    }
    if (dite.pas === pasAnnonce) return;
    pasAnnonce = dite.pas;
    annonce.replaceChildren(sansSensForce(dite.texte ?? ""));
  }

  function rendre(vue, ecran = {}) {
    annoncer(vue.annonce ?? null);
    const origine = ecran?.origineDeLaCible ?? null;
    const signature = JSON.stringify([{ ...vue, annonce: undefined }, origine]);
    if (signature === rendue) return false;
    rendue = signature;
    const garder = (cle) => {
      gardee = cle;
    };
    const contexteDe = (focus) => ({ actions, garder, focus, pose: false, compteur: 0, origine });
    let r = contexteDe(gardee ?? vue.focus ?? null);
    let noeuds = composer(r, vue);
    // Le bouton gardé n'est plus dans le corps refait : le focus va, comme
    // toujours, à la commande qui attend.
    if (gardee !== null && !r.pose) {
      r = contexteDe(vue.focus ?? null);
      noeuds = composer(r, vue);
    }
    corps.replaceChildren(...noeuds);
    return true;
  }

  function dire(texte) {
    annonce.replaceChildren(sansSensForce(texte ?? ""));
  }

  return { noeud, rendre, listeDeCase, annonce, dire };
}
