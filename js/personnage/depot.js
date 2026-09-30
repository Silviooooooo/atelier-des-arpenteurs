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
// qu'elle disparaisse de l'index.
//
// La démonstration ne dépose rien et ne lit rien en ligne.

import { ADRESSE_DEPOT, CHEMIN_BANQUE } from "../publication/github.js";
import { CHEMIN_INDEX, cheminDuPersonnage, chiffrerPersonnage, cleDepotValide, dechiffrerPersonnage, ecrireTicket, lireFichier, lireIndex } from "./en_ligne.js";

export const PHRASE_DEMO = "La démonstration ne dépose rien en ligne : ses personnages restent sur cet appareil.";
export const PHRASE_SANS_CLE = "Le dépôt en ligne n'est pas encore ouvert : l'auteur doit publier la banque avec la clé de dépôt. Le personnage reste sur cet appareil, « non envoyé ».";
export const PHRASE_VISIBLE = "Enregistré, le personnage part en ligne : visible par tous d'ici quelques minutes.";
// Au-delà, un envoi qui n'est toujours pas en ligne propose « Réessayer ».
export const ATTENTE_MAX_MS = 15 * 60 * 1000;

const LIMITE_LECTURES = 6;
const PAS_DE_RESEAU = "Pas de réseau : le personnage reste sur cet appareil, « non envoyé ».";

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

  const noter = (id, depot) => etagere.garderNote(id, { depot });
  const noterEchec = (id, action, erreur) => noter(id, { etat: "non_envoye", action, ticket: null, date: maintenant().toISOString(), erreur });

  // Le mot de passe de table a-t-il changé depuis l'ouverture de la page ?
  // Un chiffré sous l'ancienne clé serait refusé par l'automate.
  async function selEnPlace() {
    try {
      const reponse = await fetch(`${CHEMIN_BANQUE}?v=${maintenant().getTime()}`, { cache: "no-store" });
      if (!reponse.ok) return null;
      return (await reponse.json())?.kdf?.sel ?? null;
    } catch {
      return null;
    }
  }

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

  async function deposer(id, action, personnage = null) {
    if (!disponible) {
      if (mode === "reel") await noterEchec(id, action, raison);
      return { envoye: false, erreur: raison };
    }
    const sel = await selEnPlace();
    if (sel && sel !== secret.sel) {
      const erreur = "Le mot de passe de table a changé : rechargez la page et saisissez le nouveau, puis « Réessayer ».";
      await noterEchec(id, action, erreur);
      return { envoye: false, erreur };
    }
    let chiffre = null;
    if (personnage) {
      chiffre = await chiffrerPersonnage(personnage, secret);
      if (chiffre.erreur) {
        await noterEchec(id, action, chiffre.erreur);
        return { envoye: false, erreur: chiffre.erreur };
      }
    }
    const date = maintenant().toISOString();
    const ticket = ecrireTicket({ action, identifiant: id, date, personnage: chiffre });
    if (ticket.erreur) {
      await noterEchec(id, action, ticket.erreur);
      return { envoye: false, erreur: ticket.erreur };
    }
    const ouvert = await ouvrirTicket(ticket.titre, ticket.corps);
    if (ouvert.erreur) {
      await noterEchec(id, action, ouvert.erreur);
      return { envoye: false, erreur: ouvert.erreur };
    }
    await noter(id, { etat: "envoye", action, ticket: ouvert.ticket, date, erreur: null });
    return { envoye: true, ticket: ouvert.ticket };
  }

  /** L'index et les personnages en ligne, déchiffrés : { personnages, illisibles, ancienneCle, erreur? }. */
  async function lireEnLigne() {
    if (mode !== "reel" || !secret?.cle) return { personnages: [], illisibles: 0, ancienneCle: 0 };
    let texte;
    try {
      const reponse = await fetch(`${CHEMIN_INDEX}?v=${maintenant().getTime()}`, { cache: "no-store" });
      if (reponse.status === 404) return { personnages: [], illisibles: 0, ancienneCle: 0 };
      if (!reponse.ok) return { personnages: [], illisibles: 0, ancienneCle: 0, erreur: `Les personnages en ligne n'ont pas pu être lus (réponse ${reponse.status}).` };
      texte = await reponse.text();
    } catch {
      return { personnages: [], illisibles: 0, ancienneCle: 0, erreur: "Pas de réseau : les personnages en ligne ne se lisent pas." };
    }
    const { index, erreur } = lireIndex(texte);
    if (erreur) return { personnages: [], illisibles: 0, ancienneCle: 0, erreur: `L'index des personnages en ligne est illisible : ${erreur}` };
    let illisibles = 0;
    let ancienneCle = 0;
    const resultats = await parLots(
      index.personnages.map((entree) => async () => {
        const deja = lus.get(entree.identifiant);
        if (deja && deja.version === entree.version) return deja;
        try {
          // La version dans l'adresse : un fichier rechiffré ne vient pas du cache.
          const reponse = await fetch(`${cheminDuPersonnage(entree.identifiant)}?v=${entree.version}`);
          if (!reponse.ok) return { illisible: true };
          const lu = lireFichier(await reponse.text(), { identifiant: entree.identifiant });
          if (lu.erreur) return { illisible: true };
          const ouvert = await dechiffrerPersonnage(lu.fichier, secret, { mode });
          if (ouvert.erreur) return ouvert.code === "cle" ? { ancienne: true } : { illisible: true };
          const trouve = { version: entree.version, range_le: entree.range_le, personnage: ouvert.personnage };
          lus.set(entree.identifiant, trouve);
          return trouve;
        } catch {
          return { illisible: true };
        }
      }),
    );
    const personnages = [];
    for (const r of resultats) {
      if (r.personnage) personnages.push(r.personnage);
      else if (r.ancienne) ancienneCle += 1;
      else illisibles += 1;
    }
    const presents = new Set(index.personnages.map((e) => e.identifiant));
    for (const id of [...lus.keys()]) if (!presents.has(id)) lus.delete(id);
    return { personnages, illisibles, ancienneCle };
  }

  return {
    mode,
    disponible,
    raison,
    phraseEnregistrement: mode !== "reel" ? PHRASE_DEMO : disponible ? PHRASE_VISIBLE : PHRASE_SANS_CLE,

    /** Dépose un personnage enregistré (« creer » ou « remplacer ») : { envoye, ticket?, erreur? }. */
    envoyer(personnage, { action = "creer" } = {}) {
      return deposer(personnage.id, action, personnage);
    },

    /** Demande la suppression en ligne d'un personnage : { envoye, erreur? }. */
    supprimer(id) {
      return deposer(id, "supprimer");
    },

    /** Refait le dépôt noté « non envoyé » (ou trop long à venir) d'un personnage. */
    async reessayer(id) {
      const note = await etagere.lireNote(id);
      if (!note?.depot) return { envoye: false, erreur: "Rien à envoyer pour ce personnage." };
      if (note.depot.action === "supprimer") return deposer(id, "supprimer");
      const personnage = await etagere.lire(id);
      if (!personnage || personnage.etat !== "enregistre") return { envoye: false, erreur: "Ce personnage n'est plus enregistré sur cet appareil." };
      return deposer(id, note.depot.action, personnage);
    },

    lireEnLigne,

    /** Un personnage en ligne par son identifiant, ou null. */
    async lire(id) {
      if (lus.has(id)) return lus.get(id).personnage;
      await lireEnLigne();
      return lus.get(id)?.personnage ?? null;
    },

    /**
     * Rapproche l'appareil et le site : rend { enLigne, attente, nonEnvoyes,
     * brouillons, illisibles, ancienneCle, erreur? }. Un personnage envoyé
     * que la version en ligne a rattrapé quitte l'appareil ; une suppression
     * faite en ligne efface sa note.
     */
    async rapprocher() {
      const [{ personnages: locaux, illisibles: illisiblesLocaux }, notes, enLigne] = await Promise.all([etagere.lister(), etagere.listerNotes(), lireEnLigne()]);
      const noteDe = new Map(notes.map((n) => [n.id, n]));
      const enLigneParId = new Map(enLigne.personnages.map((p) => [p.id, p]));
      const brouillons = [];
      const nonEnvoyes = [];
      const attente = [];
      const caches = new Set();
      for (const p of locaux) {
        const note = noteDe.get(p.id);
        if (p.etat === "brouillon") {
          brouillons.push({ personnage: p, note });
          continue;
        }
        const enLigneMeme = enLigneParId.get(p.id);
        // Rattrapé : la version en ligne est au moins aussi récente.
        if (mode === "reel" && note?.depot?.etat === "envoye" && enLigneMeme && Date.parse(enLigneMeme.modifie_le) >= Date.parse(p.modifie_le)) {
          await etagere.effacer(p.id);
          await etagere.garderNote(p.id, { depot: null });
          continue;
        }
        if (mode !== "reel") {
          nonEnvoyes.push({ personnage: p, note, demo: true });
          continue;
        }
        const envoye = note?.depot?.etat === "envoye";
        const enRetard = envoye && maintenant().getTime() - Date.parse(note.depot.date) > ATTENTE_MAX_MS;
        if (envoye && !enRetard) {
          attente.push({ personnage: p, note });
          caches.add(p.id);
        } else nonEnvoyes.push({ personnage: p, note, enRetard });
        // La version de l'appareil, plus récente, prime sur celle du site.
        if (enLigneMeme) caches.add(p.id);
      }
      // Les suppressions envoyées : la version en ligne se cache jusqu'à ce
      // qu'elle quitte l'index ; ensuite, la note s'efface.
      for (const note of notes.filter((n) => n.depot?.action === "supprimer")) {
        if (enLigneParId.has(note.id)) {
          caches.add(note.id);
          const enRetard = note.depot.etat === "envoye" && maintenant().getTime() - Date.parse(note.depot.date) > ATTENTE_MAX_MS;
          if (note.depot.etat !== "envoye" || enRetard) nonEnvoyes.push({ personnage: enLigneParId.get(note.id), note, suppression: true, enRetard });
        } else await etagere.garderNote(note.id, { depot: null });
      }
      return {
        enLigne: enLigne.personnages.filter((p) => !caches.has(p.id)),
        attente,
        nonEnvoyes,
        brouillons,
        illisibles: illisiblesLocaux + enLigne.illisibles,
        ancienneCle: enLigne.ancienneCle,
        ...(enLigne.erreur ? { erreur: enLigne.erreur } : {}),
      };
    },
  };
}
