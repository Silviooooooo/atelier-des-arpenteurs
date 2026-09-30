// Les personnages en ligne, côté page (SPECIFICATION.md, § 15.8).
//
// Déposer : un personnage enregistré part, chiffré avec la clé de table,
// dans un ticket GitHub ouvert avec la clé de dépôt que porte la banque ;
// l'automate le range. Lire : l'index des personnages, sans cache, puis
// chaque fichier rangé, déchiffré avec la clé de table. Tout ce qui est lu
// est une donnée hostile (en_ligne.js le vérifie).
//
// Sur l'appareil, une note garde l'état de chaque dépôt (stockage.js) : «
// non envoyé » (réseau absent, clé révoquée, pas encore de clé), avec «
// Réessayer » ; « envoyé », en attente de l'automate et de GitHub Pages. Un
// personnage envoyé reste sur l'appareil jusqu'à ce que la version en ligne
// le rattrape ; une suppression envoyée cache la version en ligne jusqu'à ce
// qu'elle disparaisse de l'index. Une copie de l'appareil plus ancienne que
// la version en ligne ne la cache jamais, et ne part pas sans qu'on le
// veuille (relecture du lot 2 bis).
//
// La démonstration ne dépose rien et ne lit rien en ligne.

import { ADRESSE_DEPOT, CHEMIN_BANQUE } from "../publication/github.js";
import { CHEMIN_INDEX, cheminDuPersonnage, chiffrerPersonnage, cleDepotValide, dechiffrerPersonnage, ecrireTicket, lireFichier, lireIndex } from "./en_ligne.js";

export const PHRASE_DEMO = "La démonstration ne dépose rien en ligne : ses personnages restent sur cet appareil.";
export const PHRASE_SANS_CLE = "Le dépôt en ligne n'est pas encore ouvert : l'auteur doit publier la banque avec la clé de dépôt. Le personnage reste sur cet appareil, « non envoyé ».";
export const PHRASE_VISIBLE = "Enregistré, le personnage part en ligne : visible par tous d'ici quelques minutes.";
export const PHRASE_CLE_CHANGEE = "Le mot de passe de table a changé : rechargez la page et saisissez le nouveau.";
export const PHRASE_PLUS_RECENTE = "Une version plus récente de ce personnage est en ligne : l'envoyer la remplacerait.";
// Au-delà, un envoi qui n'est toujours pas en ligne propose « Réessayer ».
export const ATTENTE_MAX_MS = 15 * 60 * 1000;

const LIMITE_LECTURES = 6;
const PAS_DE_RESEAU = "Pas de réseau : le personnage reste sur cet appareil, « non envoyé ».";
const date = (texte) => Date.parse(texte);

// Le refus de GitHub, dit à la personne qui dépose.
function refusDeGitHub(statut) {
  if (statut === 401) return "GitHub refuse la clé de dépôt (révoquée ou expirée) : l'auteur doit en créer une autre et republier la banque.";
  if (statut === 403 || statut === 404) return "La clé de dépôt n'a pas la permission Issues sur ce dépôt : l'auteur doit la refaire.";
  if (statut === 410) return "Les tickets sont fermés sur ce dépôt : l'auteur doit les rouvrir.";
  return `GitHub a refusé le dépôt (statut ${statut}).`;
}

// Des tâches, quelques-unes à la fois.
async function parLots(taches, limite = LIMITE_LECTURES) {
  const resultats = new Array(taches.length);
  let suivante = 0;
  const ouvrier = async () => {
    while (suivante < taches.length) {
      const i = suivante++;
      resultats[i] = await taches[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, taches.length) }, ouvrier));
  return resultats;
}

/**
 * Le dépôt en ligne d'une page : mode, banque ouverte, secret de table,
 * étagère de l'appareil. fetch se remplace dans les contrôles.
 */
export function creerDepot({ mode, banque, secret, etagere, fetch = (...a) => globalThis.fetch(...a), maintenant = () => new Date() }) {
  const cle = banque?.cle_depot;
  const raison = mode !== "reel" ? PHRASE_DEMO : !cleDepotValide(cle) ? PHRASE_SANS_CLE : !secret?.cle ? "La clé de table manque : saisissez de nouveau le mot de passe." : null;
  const disponible = raison === null;
  // Les personnages en ligne déchiffrés pendant la visite : par identifiant,
  // avec la version de leur fichier.
  const lus = new Map();

  const noter = (id, depot, suite = {}) => etagere.garderNote(id, { depot, ...suite });
  const noterEchec = (id, action, erreur, suite = {}) => noter(id, { etat: "non_envoye", action, ticket: null, date: maintenant().toISOString(), erreur }, suite);

  // L'en-tête de la banque que sert le site : { sel, publiee_le }, ou null.
  async function enTeteEnPlace() {
    try {
      const reponse = await fetch(`${CHEMIN_BANQUE}?v=${maintenant().getTime()}`, { cache: "no-store" });
      if (!reponse.ok) return null;
      const enveloppe = await reponse.json();
      return typeof enveloppe?.kdf?.sel === "string" ? { sel: enveloppe.kdf.sel, publiee_le: enveloppe.publiee_le ?? null } : null;
    } catch {
      return null;
    }
  }

  // Le mot de passe a changé depuis l'ouverture de la page quand le site sert
  // une banque d'un autre sel, et plus récente que celle de la page. Plus
  // ancienne (juste après un changement fait d'ici, GitHub Pages en retard),
  // c'est le site qui est en retard : l'automate, lui, juge sur le dépôt.
  const pageEnRetard = (enPlace) =>
    Boolean(enPlace && enPlace.sel !== secret.sel && !(banque?.publiee_le && enPlace.publiee_le && date(enPlace.publiee_le) < date(banque.publiee_le)));

  async function ouvrirTicket(titre, corps) {
    let reponse;
    try {
      reponse = await fetch(`${ADRESSE_DEPOT}/issues`, {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cle}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
        body: JSON.stringify({ title: titre, body: corps }),
      });
    } catch {
      return { erreur: PAS_DE_RESEAU };
    }
    if (reponse.status !== 201) return { erreur: refusDeGitHub(reponse.status) };
    let numero = null;
    try {
      numero = (await reponse.json())?.number ?? null;
    } catch {
      // Un corps perdu : le ticket est ouvert quand même.
    }
    return { ticket: Number.isSafeInteger(numero) && numero > 0 ? numero : null };
  }

  async function deposer(id, action, personnage = null, { nom = null } = {}) {
    const suite = nom ? { nom } : {};
    if (!disponible) {
      if (mode === "reel") await noterEchec(id, action, raison, suite);
      return { envoye: false, erreur: raison };
    }
    if (pageEnRetard(await enTeteEnPlace())) {
      const erreur = `${PHRASE_CLE_CHANGEE} Puis « Réessayer ».`;
      await noterEchec(id, action, erreur, suite);
      return { envoye: false, erreur };
    }
    let chiffre = null;
    if (personnage) {
      chiffre = await chiffrerPersonnage(personnage, secret);
      if (chiffre.erreur) {
        await noterEchec(id, action, chiffre.erreur, suite);
        return { envoye: false, erreur: chiffre.erreur };
      }
    }
    const quand = maintenant().toISOString();
    const ticket = ecrireTicket({ action, identifiant: id, date: quand, personnage: chiffre });
    if (ticket.erreur) {
      await noterEchec(id, action, ticket.erreur, suite);
      return { envoye: false, erreur: ticket.erreur };
    }
    const ouvert = await ouvrirTicket(ticket.titre, ticket.corps);
    if (ouvert.erreur) {
      await noterEchec(id, action, ouvert.erreur, suite);
      return { envoye: false, erreur: ouvert.erreur };
    }
    await noter(id, { etat: "envoye", action, ticket: ouvert.ticket, date: quand, erreur: null }, suite);
    return { envoye: true, ticket: ouvert.ticket };
  }

  // Une version en ligne plus récente que le personnage de l'appareil ?
  const plusRecenteEnLigne = (personnage) => {
    const connu = lus.get(personnage.id)?.personnage;
    return Boolean(connu && date(connu.modifie_le) > date(personnage.modifie_le));
  };

  /**
   * L'index et les personnages en ligne, déchiffrés : { personnages, ids,
   * illisibles, ancienneCle, cleChangee, erreur? }. ids : tous les
   * identifiants de l'index, lisibles ou non. Un fichier d'un autre sel que
   * la page, mais du sel de la banque en place, dit que c'est la page qui est
   * en retard (cleChangee) ; sinon, c'est un fichier d'une ancienne clé.
   */
  async function lireEnLigne() {
    const vide = { personnages: [], ids: new Set(), illisibles: 0, ancienneCle: 0, cleChangee: 0 };
    if (mode !== "reel" || !secret?.cle) return vide;
    let texte;
    try {
      const reponse = await fetch(`${CHEMIN_INDEX}?v=${maintenant().getTime()}`, { cache: "no-store" });
      if (reponse.status === 404) return vide;
      if (!reponse.ok) return { ...vide, erreur: `Les personnages en ligne n'ont pas pu être lus (réponse ${reponse.status}).` };
      texte = await reponse.text();
    } catch {
      return { ...vide, erreur: "Pas de réseau : les personnages en ligne ne se lisent pas." };
    }
    const { index, erreur } = lireIndex(texte);
    if (erreur) return { ...vide, erreur: `L'index des personnages en ligne est illisible : ${erreur}` };
    const resultats = await parLots(
      index.personnages.map((entree) => async () => {
        const deja = lus.get(entree.identifiant);
        if (deja && deja.version === entree.version) return deja;
        // Une version nouvelle qui ne se lirait pas ne laisse pas l'ancienne.
        lus.delete(entree.identifiant);
        try {
          // La version dans l'adresse : un fichier rechiffré ne vient pas du cache.
          const reponse = await fetch(`${cheminDuPersonnage(entree.identifiant)}?v=${entree.version}`);
          if (!reponse.ok) return { illisible: true };
          const lu = lireFichier(await reponse.text(), { identifiant: entree.identifiant });
          if (lu.erreur) return { illisible: true };
          const ouvert = await dechiffrerPersonnage(lu.fichier, secret, { mode });
          if (ouvert.erreur) return ouvert.code === "cle" ? { autreSel: lu.fichier.sel } : { illisible: true };
          const trouve = { version: entree.version, range_le: entree.range_le, personnage: ouvert.personnage };
          lus.set(entree.identifiant, trouve);
          return trouve;
        } catch {
          return { illisible: true };
        }
      }),
    );
    const personnages = [];
    let illisibles = 0;
    let ancienneCle = 0;
    let cleChangee = 0;
    const enPlace = resultats.some((r) => r.autreSel) ? await enTeteEnPlace() : null;
    for (const r of resultats) {
      if (r.personnage) personnages.push(r.personnage);
      else if (r.autreSel) {
        if (enPlace && r.autreSel === enPlace.sel) cleChangee += 1;
        else ancienneCle += 1;
      } else illisibles += 1;
    }
    const ids = new Set(index.personnages.map((e) => e.identifiant));
    for (const id of [...lus.keys()]) if (!ids.has(id)) lus.delete(id);
    return { personnages, ids, illisibles, ancienneCle, cleChangee };
  }

  /** Un personnage en ligne : { personnage }, { absent: true } ou { erreur }. */
  async function chercher(id) {
    if (lus.has(id)) return { personnage: lus.get(id).personnage };
    if (mode !== "reel") return { absent: true };
    const lu = await lireEnLigne();
    if (lu.erreur) return { erreur: lu.erreur };
    if (lus.has(id)) return { personnage: lus.get(id).personnage };
    if (lu.cleChangee && lu.ids.has(id)) return { erreur: PHRASE_CLE_CHANGEE };
    if (lu.ids.has(id)) return { erreur: "Ce personnage en ligne ne se lit pas : son fichier est abîmé, ou d'une ancienne clé de table." };
    return { absent: true };
  }

  return {
    mode,
    disponible,
    raison,
    phraseEnregistrement: mode !== "reel" ? PHRASE_DEMO : disponible ? PHRASE_VISIBLE : PHRASE_SANS_CLE,

    /**
     * Dépose un personnage enregistré (« creer » ou « remplacer ») : {
     * envoye, ticket?, erreur?, plusAncienne? }. Une version en ligne plus
     * récente, connue de la page, arrête l'envoi, sauf { forcer: true }.
     */
    async envoyer(personnage, { action = "creer", forcer = false } = {}) {
      if (!forcer && plusRecenteEnLigne(personnage)) return { envoye: false, erreur: PHRASE_PLUS_RECENTE, plusAncienne: true };
      return deposer(personnage.id, action, personnage);
    },

    /** Demande la suppression en ligne d'un personnage : { envoye, erreur? }. */
    supprimer(id, { nom = null } = {}) {
      return deposer(id, "supprimer", null, { nom });
    },

    /** Refait le dépôt noté « non envoyé » (ou trop long à venir) d'un personnage. */
    async reessayer(id, { forcer = false } = {}) {
      const note = await etagere.lireNote(id);
      if (!note?.depot) return { envoye: false, erreur: "Rien à envoyer pour ce personnage." };
      if (note.depot.action === "supprimer") return deposer(id, "supprimer", null, { nom: note.nom });
      const personnage = await etagere.lire(id);
      if (!personnage || personnage.etat !== "enregistre") return { envoye: false, erreur: "Ce personnage n'est plus enregistré sur cet appareil." };
      if (!forcer && plusRecenteEnLigne(personnage)) return { envoye: false, erreur: PHRASE_PLUS_RECENTE, plusAncienne: true };
      return deposer(id, note.depot.action, personnage);
    },

    lireEnLigne,
    chercher,

    /** Un personnage en ligne par son identifiant, ou null. */
    async lire(id) {
      return (await chercher(id)).personnage ?? null;
    },

    /**
     * Rapproche l'appareil et le site : rend { enLigne, attente,
     * nonEnvoyes, brouillons, illisibles, ancienneCle, cleChangee, erreur? }.
     * Un personnage envoyé que la version en ligne a rattrapé quitte
     * l'appareil ; une copie identique à la version en ligne aussi ; une
     * copie plus ancienne se montre à part (plusAncienne), sans cacher la
     * version en ligne. Une suppression faite en ligne efface sa note, mais
     * seulement si l'index s'est lu.
     */
    async rapprocher() {
      const [{ personnages: locaux, illisibles: illisiblesLocaux }, notes, enLigne] = await Promise.all([etagere.lister(), etagere.listerNotes(), lireEnLigne()]);
      const noteDe = new Map(notes.map((n) => [n.id, n]));
      const enLigneParId = new Map(enLigne.personnages.map((p) => [p.id, p]));
      const brouillons = [];
      const nonEnvoyes = [];
      const attente = [];
      const caches = new Set();
      const enRetardDepuis = (quand) => maintenant().getTime() - date(quand) > ATTENTE_MAX_MS;
      for (const p of locaux) {
        const note = noteDe.get(p.id);
        if (p.etat === "brouillon") {
          brouillons.push({ personnage: p, note });
          continue;
        }
        if (mode !== "reel") {
          nonEnvoyes.push({ personnage: p, note, demo: true });
          continue;
        }
        const enLigneMeme = enLigneParId.get(p.id);
        const envoye = note?.depot?.etat === "envoye";
        const auMoinsAussiRecente = enLigneMeme && date(enLigneMeme.modifie_le) >= date(p.modifie_le);
        // Rattrapé : envoyé, et la version en ligne est au moins aussi récente.
        // Une copie sans note, identique en date à la version en ligne (un
        // lien, un fichier), ne sert plus à rien non plus.
        if (auMoinsAussiRecente && (envoye || (!note?.depot && date(enLigneMeme.modifie_le) === date(p.modifie_le)))) {
          await etagere.effacer(p.id);
          await etagere.garderNote(p.id, { depot: null });
          continue;
        }
        if (auMoinsAussiRecente) {
          // Une copie plus ancienne que la version en ligne : elle ne la cache
          // pas, et ne part qu'à la demande expresse.
          nonEnvoyes.push({ personnage: p, note, plusAncienne: true });
          continue;
        }
        if (envoye && !enRetardDepuis(note.depot.date)) {
          attente.push({ personnage: p, note });
          caches.add(p.id);
          continue;
        }
        nonEnvoyes.push({ personnage: p, note, enRetard: envoye, enLigne: Boolean(enLigneMeme) || enLigne.ids.has(p.id) });
        // La version de l'appareil, plus récente, prime sur celle du site.
        if (enLigneMeme) caches.add(p.id);
      }
      // Les suppressions : la version en ligne se cache ; une suppression non
      // envoyée, ou trop longue à venir, se montre avec « Réessayer », même si
      // la version en ligne ne se lit pas. La note ne s'efface que si l'index
      // s'est lu et ne porte plus l'identifiant.
      for (const note of notes.filter((n) => n.depot?.action === "supprimer")) {
        if (!enLigne.erreur && !enLigne.ids.has(note.id)) {
          await etagere.garderNote(note.id, { depot: null });
          continue;
        }
        caches.add(note.id);
        const enRetard = note.depot.etat === "envoye" && enRetardDepuis(note.depot.date);
        if (note.depot.etat !== "envoye" || enRetard) nonEnvoyes.push({ personnage: enLigneParId.get(note.id) ?? null, note, suppression: true, enRetard });
      }
      return {
        enLigne: enLigne.personnages.filter((p) => !caches.has(p.id)),
        attente,
        nonEnvoyes,
        brouillons,
        illisibles: illisiblesLocaux + enLigne.illisibles,
        ancienneCle: enLigne.ancienneCle,
        cleChangee: enLigne.cleChangee,
        ...(enLigne.erreur ? { erreur: enLigne.erreur } : {}),
      };
    },
  };
}
