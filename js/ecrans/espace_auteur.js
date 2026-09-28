// L'espace auteur (SPECIFICATION.md, § 6, § 7, § 8 et § 9).
//
// La clé GitHub ; l'import d'un classeur, lu sur l'appareil ; le rapport ;
// les différences avec la banque publiée ; la publication ; le changement
// de mot de passe. Sans clé GitHub, il n'affiche que la saisie de la clé
// (§ 8.1). Une erreur bloque la publication, sauf si l'auteur coche « Je
// publie en connaissance de cause », sous la liste complète (§ 6.3).
//
// En démonstration, rien n'est publié et aucune clé GitHub n'est demandée :
// l'import, le rapport et les différences s'essaient contre la banque de
// démonstration, sans que rien ne quitte l'appareil.

import { MOT_DE_PASSE_DEMO } from "../banque/chargement.js";
import { importerFichier } from "../banque/importation.js";
import { DEPOT, publier } from "../publication/github.js";
import { preparerChangement, preparerPublication } from "../publication/preparation.js";
import { defautDuMotDePasse, nouveauSecret, ouvrirAvecMotDePasse } from "../securite/chiffrement.js";
import { decompte, listeAnomalies } from "./anomalies.js";
import { compte, el, titre } from "./dom.js";

const BESOINS = ["nouveau_mot_de_passe", "mot_de_passe_requis", "sel_change"];

// L'état de l'espace auteur survit aux changements d'écran.
const auteur = {
  jeton: undefined, // undefined : pas encore lu ; null : aucune clé
  fichier: null, // { nom, banque, anomalies } ou { nom, erreur }
  secret: null, // le secret du mot de passe de table, en mémoire
  publiee: null, // la dernière lecture : { sha, enveloppe }
  besoin: null, // l'un des BESOINS : un mot de passe à saisir
  confirmation: null, // { preparation, essai, resoudre }
  attente: null, // le texte de l'attente
  resultat: null, // { publie, commit, message } ou { erreur } ou { message }
  genre: "publication", // ou « changement »
  nouveau: null, // le secret du nouveau mot de passe, pendant un changement
};
let conteneur = null;
let ctx = null;

const demo = () => ctx.etat.mode === "demo";

// Les parties d'un écran, aplaties et sans les absentes.
const noeuds = (parties) => parties.flat(Infinity).filter((partie) => partie !== null && partie !== undefined && partie !== false);

function rendre() {
  if (!conteneur?.isConnected) return;
  conteneur.replaceChildren(...noeuds(contenu()));
  conteneur.querySelector("[data-focus]")?.focus();
}

function champMotDePasse(id, autocomplete) {
  return el("input", { type: "password", id, classe: "champ", autocomplete, autocapitalize: "none", autocorrect: "off", spellcheck: "false", required: true });
}

function erreurDeFormulaire() {
  return el("p", { classe: "message", role: "alert", hidden: true });
}

// La clé GitHub (§ 8.1)

function saisieDuJeton() {
  const champ = champMotDePasse("jeton", "off");
  return [
    el("h2", {}, "Clé GitHub"),
    el("p", {}, "Pour publier depuis cet appareil, saisissez une clé GitHub. Elle y reste, dans son coffre ; si l'appareil est perdu, révoquez-la sur GitHub."),
    el(
      "ol",
      {},
      el("li", {}, "Sur GitHub : Settings, Developer settings, Personal access tokens, Fine-grained tokens, puis Generate new token."),
      el("li", {}, `Repository access : Only select repositories, et le seul dépôt ${DEPOT.nom}.`),
      el("li", {}, "Permissions : Contents, en Read and write. Rien d'autre."),
      el("li", {}, "Une date d'expiration, puis Generate token : copiez la clé ici."),
    ),
    el(
      "form",
      {
        classe: "formulaire",
        onsubmit: async (evenement) => {
          evenement.preventDefault();
          const jeton = champ.value.trim();
          if (!jeton) return;
          await ctx.etat.coffre.garderJeton(jeton);
          auteur.jeton = jeton;
          rendre();
        },
      },
      el("label", { for: "jeton" }, "Clé GitHub"),
      champ,
      el("div", { classe: "boutons" }, el("button", { type: "submit", classe: "bouton" }, "Garder la clé sur cet appareil")),
    ),
  ];
}

function etatDuJeton() {
  return el(
    "div",
    {},
    el("p", {}, "Clé GitHub gardée sur cet appareil."),
    el(
      "div",
      { classe: "boutons" },
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          onclick: async () => {
            await ctx.etat.coffre.oublierJeton();
            auteur.jeton = null;
            auteur.resultat = null;
            rendre();
          },
        },
        "Oublier la clé GitHub",
      ),
    ),
  );
}

// L'import et le rapport (§ 6.1, § 6.4)

function importation() {
  const entree = el("input", {
    type: "file",
    id: "classeur",
    classe: "champ",
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    onchange: async (evenement) => {
      const fichier = evenement.target.files[0];
      if (!fichier) return;
      Object.assign(auteur, { fichier: null, resultat: null, besoin: null, attente: "Lecture du classeur…" });
      rendre();
      const resultat = await importerFichier(new Uint8Array(await fichier.arrayBuffer()), fichier.name);
      auteur.fichier = { nom: fichier.name, ...resultat };
      auteur.attente = null;
      rendre();
    },
  });
  const { fichier } = auteur;
  let bilan = null;
  if (fichier?.erreur) bilan = el("p", { classe: "message", role: "alert" }, fichier.erreur);
  else if (fichier?.banque) {
    const b = fichier.banque;
    bilan = el(
      "p",
      {},
      `« ${fichier.nom} » : ${compte(b.blocs.length, "bloc", "blocs")}, ${compte(b.capacites.length, "capacité", "capacités")}, ${compte(b.elements.length, "élément", "éléments")}.`,
    );
  } else if (fichier) bilan = el("p", { classe: "message", role: "alert" }, `« ${fichier.nom} » ne peut pas être importé : une feuille ou un en-tête attendu manque (E1).`);
  return [
    el("h2", {}, "Importer un classeur"),
    el("p", {}, "Choisissez le classeur des règles. Il est lu sur cet appareil : rien n'est envoyé avant la publication."),
    el("label", { for: "classeur" }, "Classeur des règles (.xlsx)"),
    entree,
    bilan,
  ];
}

function rapport() {
  const anomalies = auteur.fichier?.anomalies;
  if (!anomalies) return [];
  return [
    el("h2", {}, "Rapport"),
    anomalies.length ? el("p", {}, `${decompte(anomalies)}.`) : el("p", {}, "Aucune anomalie."),
    listeAnomalies(anomalies, { niveau: "h3" }),
  ];
}

// Le circuit : lecture, différences, confirmation, écriture (§ 8.2)

async function secretGarde() {
  auteur.secret ??= ctx.etat.secret ?? (await ctx.etat.coffre.lireCle(ctx.etat.mode));
  return auteur.secret;
}

async function preparer(publiee) {
  auteur.publiee = publiee;
  auteur.attente = "Calcul des différences…";
  rendre();
  const secret = await secretGarde();
  if (auteur.genre === "changement") return preparerChangement({ publiee, ancien: secret, nouveau: auteur.nouveau });
  return preparerPublication({ publiee, banque: auteur.fichier.banque, secret });
}

function confirmer(preparation, { essai }) {
  return new Promise((resoudre) => {
    auteur.attente = null;
    auteur.confirmation = { preparation, essai, resoudre };
    rendre();
  });
}

async function circuitDemo() {
  const preparation = await preparer({ sha: null, enveloppe: ctx.etat.chargement?.enveloppe ?? null });
  if (preparation.erreur) return preparation;
  await confirmer(preparation, { essai: 1 });
  return { annulee: true, demo: true };
}

async function lancer(genre) {
  Object.assign(auteur, { genre, resultat: null, besoin: null, confirmation: null, attente: "Lecture de la banque publiée…" });
  rendre();
  let resultat;
  try {
    resultat = demo() ? await circuitDemo() : await publier({ jeton: auteur.jeton, preparer, confirmer });
  } catch (erreur) {
    resultat = { erreur: `Erreur inattendue : ${erreur.message}` };
  }
  auteur.attente = null;
  auteur.confirmation = null;
  if (BESOINS.includes(resultat.code)) {
    auteur.besoin = resultat.code;
    if (resultat.code === "sel_change") auteur.secret = null;
  } else if (resultat.annulee) {
    auteur.resultat = resultat.demo ? null : { message: "Publication annulée : rien n'a été écrit." };
  } else if (resultat.erreur) {
    auteur.resultat = resultat;
  } else {
    if (genre === "changement") {
      await ctx.etat.coffre.garderCle(ctx.etat.mode, auteur.nouveau);
      auteur.secret = auteur.nouveau;
      auteur.nouveau = null;
    }
    ctx.publiee(resultat.preparation, auteur.secret);
    auteur.resultat = { publie: true, commit: resultat.commit, message: resultat.preparation.message };
  }
  rendre();
}

function listeDesDifferences(d) {
  if (d.premiere) return [el("p", {}, "Première publication : tout est ajouté.")];
  const parties = [];
  for (const [categorie, intitule] of [
    ["blocs", "Blocs"],
    ["capacites", "Capacités"],
    ["elements", "Éléments"],
  ]) {
    const { ajoutes, modifies, retires } = d[categorie];
    if (ajoutes.length + modifies.length + retires.length === 0) continue;
    parties.push(el("h4", {}, intitule));
    if (ajoutes.length) parties.push(el("p", {}, el("strong", {}, "Ajoutés : "), ajoutes.join(", ")));
    if (retires.length) parties.push(el("p", {}, el("strong", {}, "Retirés : "), retires.join(", ")));
    for (const { nom, champs } of modifies) {
      parties.push(
        el("p", {}, el("strong", {}, `Modifié : ${nom}`)),
        champs.map((champ) =>
          champ.champ === "variante"
            ? el("p", { classe: "champ-modifie" }, `Puissance ${champ.variante} : ${champ.apres || champ.avant}.`)
            : el(
                "dl",
                { classe: "champ-modifie" },
                el("dt", {}, champ.variante ? `${champ.colonne}, puissance ${champ.variante}` : champ.colonne),
                el("dd", {}, el("span", { classe: "etiquette" }, "avant"), el("del", {}, champ.avant || "(vide)")),
                el("dd", {}, el("span", { classe: "etiquette" }, "après"), el("ins", {}, champ.apres || "(vide)")),
              ),
        ),
      );
    }
  }
  if (d.lisez_moi_modifie) parties.push(el("p", {}, "La feuille lisez_moi a changé."));
  return parties.length ? parties : [el("p", {}, "Aucune différence de contenu.")];
}

function confirmation() {
  const { preparation, essai, resoudre } = auteur.confirmation;
  const { erreurs } = preparation;
  const changement = auteur.genre === "changement";
  const accepte = el("input", { type: "checkbox", id: "connaissance" });
  const bouton = el(
    "button",
    {
      type: "button",
      classe: "bouton",
      disabled: demo() || erreurs > 0,
      onclick: () => {
        auteur.confirmation = null;
        auteur.attente = "Publication en cours…";
        rendre();
        resoudre(true);
      },
    },
    changement ? "Republier sous le nouveau mot de passe" : "Publier",
  );
  accepte.addEventListener("change", () => {
    bouton.disabled = !accepte.checked;
  });
  const annuler = el(
    "button",
    {
      type: "button",
      classe: "bouton secondaire",
      onclick: () => {
        auteur.confirmation = null;
        rendre();
        resoudre(false);
      },
    },
    demo() ? "Fermer" : "Annuler",
  );
  const pluriel = erreurs > 1;
  return [
    essai > 1
      ? el("p", { classe: "message", role: "alert", tabindex: "-1", "data-focus": true }, "La banque a été publiée entre-temps depuis un autre appareil : voici les différences recalculées.")
      : null,
    el("h3", { tabindex: "-1", "data-focus": essai > 1 ? null : true }, changement ? "Changement du mot de passe" : "Différences avec la banque publiée"),
    changement
      ? el("p", {}, "La banque publiée sera republiée telle quelle, sous le nouveau mot de passe. Transmettez-le ensuite aux joueurs : leur appareil le leur redemandera.")
      : listeDesDifferences(preparation.differences),
    el("h3", {}, "Message de la publication"),
    el("p", { classe: "resume" }, preparation.message),
    erreurs > 0 && !demo()
      ? el(
          "div",
          { classe: "formulaire" },
          el(
            "label",
            { classe: "case", for: "connaissance" },
            accepte,
            `Je publie en connaissance de cause : ${pluriel ? `les ${erreurs} erreurs` : "l'erreur"} du rapport ci-dessus ${pluriel ? "seront publiées" : "sera publiée"} avec la banque, ${pluriel ? "visibles" : "visible"} de tous.`,
          ),
        )
      : null,
    demo() ? el("p", { classe: "message" }, "Démonstration : la publication est désactivée.") : null,
    el("div", { classe: "boutons" }, bouton, annuler),
  ];
}

function formulaireMotDePasse() {
  const nouveau = auteur.besoin === "nouveau_mot_de_passe";
  const premier = champMotDePasse("mdp-auteur", nouveau ? "new-password" : "current-password");
  const second = nouveau ? champMotDePasse("mdp-auteur-2", "new-password") : null;
  const erreur = erreurDeFormulaire();
  const intro = {
    nouveau_mot_de_passe:
      "Première publication : choisissez le mot de passe de table, que les joueurs saisiront. Une phrase de quatre ou cinq mots tirés au hasard, 20 signes au moins. Il ne quitte pas cet appareil : seule la clé qui en dérive y est gardée.",
    mot_de_passe_requis: "Pour comparer avec la banque publiée, saisissez le mot de passe de table.",
    sel_change: "La clé gardée sur cet appareil n'ouvre plus la banque publiée : saisissez le mot de passe de table actuel.",
  }[auteur.besoin];
  return el(
    "form",
    {
      classe: "formulaire",
      onsubmit: async (evenement) => {
        evenement.preventDefault();
        erreur.hidden = true;
        if (nouveau) {
          const defaut = defautDuMotDePasse(premier.value) ?? (premier.value !== second.value ? "Les deux saisies diffèrent." : null);
          if (defaut) {
            erreur.textContent = defaut;
            erreur.hidden = false;
            return;
          }
        }
        auteur.attente = "Calcul de la clé…";
        rendre();
        let secret;
        if (nouveau) secret = await nouveauSecret(premier.value);
        else {
          const ouverte = await ouvrirAvecMotDePasse(auteur.publiee.enveloppe, premier.value);
          if (ouverte.erreur) {
            auteur.attente = null;
            auteur.resultat = { erreur: ouverte.code === "mot_de_passe" ? "Ce mot de passe n'ouvre pas la banque publiée." : ouverte.erreur };
            rendre();
            return;
          }
          secret = ouverte.secret;
        }
        await ctx.etat.coffre.garderCle(ctx.etat.mode, secret);
        auteur.secret = secret;
        auteur.besoin = null;
        lancer(auteur.genre);
      },
    },
    el("h3", { tabindex: "-1", "data-focus": true }, "Mot de passe de table"),
    el("p", {}, intro),
    demo() ? el("p", { classe: "mot-de-passe-demo" }, "Mot de passe de démonstration : ", el("span", { classe: "valeur" }, MOT_DE_PASSE_DEMO)) : null,
    el("label", { for: "mdp-auteur" }, nouveau ? "Nouveau mot de passe de table" : "Mot de passe de table"),
    premier,
    nouveau ? [el("label", { for: "mdp-auteur-2" }, "Le même, une seconde fois"), second] : null,
    erreur,
    el(
      "div",
      { classe: "boutons" },
      el("button", { type: "submit", classe: "bouton" }, "Continuer"),
      el(
        "button",
        {
          type: "button",
          classe: "bouton secondaire",
          onclick: () => {
            auteur.besoin = null;
            rendre();
          },
        },
        "Annuler",
      ),
    ),
  );
}

function resultat() {
  const r = auteur.resultat;
  if (!r) return null;
  if (r.publie) {
    const adresse = `https://github.com/${DEPOT.proprietaire}/${DEPOT.nom}/commit/${r.commit}`;
    return el(
      "div",
      { classe: "message", role: "status", tabindex: "-1", "data-focus": true },
      el("p", {}, el("strong", {}, "Publiée — visible par tous d'ici quelques minutes.")),
      el("p", {}, r.message),
      r.commit ? el("p", { classe: "petit" }, el("a", { href: adresse, rel: "noreferrer" }, `Voir le commit ${r.commit.slice(0, 7)} sur GitHub`)) : null,
      auteur.genre === "changement" ? el("p", {}, "Transmettez maintenant le nouveau mot de passe aux joueurs.") : null,
    );
  }
  return el(
    "div",
    { classe: "message", role: r.erreur ? "alert" : "status", tabindex: "-1", "data-focus": true },
    el("p", {}, r.erreur ?? r.message),
    r.code === "jeton"
      ? el(
          "button",
          {
            type: "button",
            classe: "bouton secondaire",
            onclick: async () => {
              await ctx.etat.coffre.oublierJeton();
              auteur.jeton = null;
              auteur.resultat = null;
              rendre();
            },
          },
          "Saisir une autre clé",
        )
      : null,
  );
}

function publication() {
  const parties = [el("h2", {}, demo() ? "Différences" : "Publication")];
  if (auteur.attente) parties.push(el("p", { classe: "attente", role: "status" }, auteur.attente));
  if (auteur.besoin) parties.push(formulaireMotDePasse());
  if (auteur.confirmation) parties.push(...confirmation());
  parties.push(resultat());
  if (!auteur.attente && !auteur.besoin && !auteur.confirmation) {
    const pret = Boolean(auteur.fichier?.banque);
    parties.push(
      el(
        "div",
        { classe: "boutons" },
        el(
          "button",
          { type: "button", classe: "bouton", disabled: !pret, onclick: () => lancer("publication") },
          demo() ? "Comparer avec la banque de démonstration" : "Comparer avec la banque publiée",
        ),
      ),
    );
    if (!pret) parties.push(el("p", { classe: "secondaire-texte" }, "Importez d'abord un classeur."));
  }
  return parties;
}

// Le changement de mot de passe, en une action (§ 7.3)

function changement() {
  // Sans banque publiée, le mot de passe se choisit à la première publication.
  if (auteur.attente || auteur.besoin || auteur.confirmation || !ctx.etat.chargement?.enveloppe) return [];
  const premier = champMotDePasse("nouveau-mdp", "new-password");
  const second = champMotDePasse("nouveau-mdp-2", "new-password");
  const erreur = erreurDeFormulaire();
  return [
    el("h2", {}, "Changer le mot de passe de table"),
    el(
      "p",
      {},
      "La banque publiée est republiée sous le nouveau mot de passe ; transmettez-le ensuite aux joueurs. Les versions précédentes, dans l'historique de GitHub, restent lisibles avec l'ancien.",
    ),
    el(
      "form",
      {
        classe: "formulaire",
        onsubmit: async (evenement) => {
          evenement.preventDefault();
          const defaut = defautDuMotDePasse(premier.value) ?? (premier.value !== second.value ? "Les deux saisies diffèrent." : null);
          if (defaut) {
            erreur.textContent = defaut;
            erreur.hidden = false;
            return;
          }
          auteur.attente = "Calcul de la nouvelle clé…";
          rendre();
          auteur.nouveau = await nouveauSecret(premier.value);
          lancer("changement");
        },
      },
      el("label", { for: "nouveau-mdp" }, "Nouveau mot de passe de table"),
      premier,
      el("label", { for: "nouveau-mdp-2" }, "Le même, une seconde fois"),
      second,
      erreur,
      el("div", { classe: "boutons" }, el("button", { type: "submit", classe: "bouton secondaire" }, "Changer le mot de passe")),
    ),
  ];
}

function contenu() {
  const parties = [titre("Espace auteur")];
  if (demo()) {
    parties.push(
      el(
        "p",
        { classe: "message" },
        "Démonstration : rien n'est publié. L'import, le rapport et les différences s'essaient sur cet appareil, contre la banque de démonstration ; aucun fichier ne le quitte.",
      ),
    );
  } else if (auteur.jeton === undefined) {
    return [...parties, el("p", { classe: "attente" }, "Lecture du coffre…")];
  } else if (auteur.jeton === null) {
    return [...parties, ...saisieDuJeton()];
  } else parties.push(etatDuJeton());
  parties.push(...importation(), ...rapport(), ...publication());
  if (!demo()) parties.push(...changement());
  return parties;
}

export function afficher(contexte) {
  ctx = contexte;
  conteneur = el("section", { classe: "espace-auteur" });
  conteneur.replaceChildren(...noeuds(contenu()));
  if (!demo() && auteur.jeton === undefined) {
    contexte.etat.coffre.lireJeton().then((jeton) => {
      auteur.jeton = jeton;
      rendre();
    });
  }
  return conteneur;
}
