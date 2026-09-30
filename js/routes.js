// Les adresses des écrans (SPECIFICATION.md, § 9 et § 15.3).
//
// Chaque écran est une route après le « # » : une fiche a ainsi une adresse
// qu'on peut envoyer à un joueur (#/capacite/Attaque%20de%20base). Le nom y
// est encodé par encodeURIComponent, et se décode sans jamais lever
// d'exception : une adresse abîmée mène à l'écran « introuvable ».
//
// Les personnages : #/personnages (la liste), #/personnage/<id> (la fiche),
// #/personnage/<id>/etape/<1 à 9> (le parcours), #/recevoir/<code> (un
// personnage reçu par lien, § 15.1). L'identifiant et le code ne portent
// que des signes base64url.

export const CATEGORIES = {
  blocs: { fiche: "bloc", titre: "Blocs", un: "un bloc" },
  capacites: { fiche: "capacite", titre: "Capacités", un: "une capacité" },
  elements: { fiche: "element", titre: "Éléments", un: "un élément" },
};
const PAR_FICHE = Object.fromEntries(Object.entries(CATEGORIES).map(([categorie, { fiche }]) => [fiche, categorie]));
const FEUILLES = ["lisez_moi", "Blocs", "Eléments", "Capacites"];
const IDENTIFIANT = /^[A-Za-z0-9_-]{16,40}$/;
// Un code de lien : 64 Ko compressés au plus, en base64url (§ 15.1).
const CODE = /^[A-Za-z0-9_-]{1,87382}$/;

function decoder(morceau) {
  try {
    return decodeURIComponent(morceau);
  } catch {
    return null;
  }
}

/** L'écran que désigne une adresse (location.hash). */
export function lireRoute(adresse) {
  const chemin = String(adresse ?? "").replace(/^#/, "").replace(/^\/+/, "");
  const [tete, ...reste] = chemin.split("/");
  if (tete === "" && reste.length === 0) return { ecran: "accueil" };
  // Object.hasOwn : « constructor » ou « __proto__ » ne sont pas des catégories.
  if (Object.hasOwn(CATEGORIES, tete) && reste.length === 0) return { ecran: "liste", categorie: tete };
  if (Object.hasOwn(PAR_FICHE, tete) && reste.length > 0) {
    // Un nom peut contenir « / » : tout ce qui suit la catégorie en fait partie.
    const nom = decoder(reste.join("/"));
    if (nom !== null && nom !== "") return { ecran: "fiche", categorie: PAR_FICHE[tete], nom };
  }
  if (tete === "anomalies" && reste.length === 0) return { ecran: "anomalies" };
  if (tete === "anomalies" && reste.length === 2) {
    const feuille = decoder(reste[0]);
    if (FEUILLES.includes(feuille) && /^\d+$/.test(reste[1])) return { ecran: "anomalies", feuille, ligne: Number(reste[1]) };
  }
  if (tete === "auteur" && reste.length === 0) return { ecran: "auteur" };
  if (tete === "personnages" && reste.length === 0) return { ecran: "personnages" };
  if (tete === "personnage" && IDENTIFIANT.test(reste[0] ?? "")) {
    if (reste.length === 1) return { ecran: "personnage", id: reste[0] };
    if (reste.length === 3 && reste[1] === "etape" && /^[1-9]$/.test(reste[2])) return { ecran: "creation", id: reste[0], etape: Number(reste[2]) };
  }
  if (tete === "recevoir" && reste.length === 1 && CODE.test(reste[0])) return { ecran: "recevoir", code: reste[0] };
  return { ecran: "introuvable", adresse: chemin };
}

/** L'adresse d'une fiche : categorie est blocs, capacites ou elements. */
export function adresseFiche(categorie, nom) {
  return `#/${CATEGORIES[categorie].fiche}/${encodeURIComponent(nom)}`;
}

export function adresseListe(categorie) {
  return `#/${categorie}`;
}

/** L'adresse de la fiche d'un personnage, ou d'une étape de son parcours. */
export function adressePersonnage(id, etape = null) {
  return etape ? `#/personnage/${id}/etape/${etape}` : `#/personnage/${id}`;
}

/** L'adresse des anomalies, éventuellement celles d'une ligne d'une feuille. */
export function adresseAnomalies(feuille = null, ligne = null) {
  return feuille && ligne ? `#/anomalies/${encodeURIComponent(feuille)}/${ligne}` : "#/anomalies";
}
