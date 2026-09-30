// La répartition des lignes du recto (SPECIFICATION.md, § 15.4).
//
// Le recto est le modèle de fiche, une page A4 qui ne déborde jamais. Ses
// lignes sont un minimum : une rubrique qui en demande plus grandit, tant
// que le recto tient sur la page ; le reste passe au verso, sous « Suite du
// recto ». Le minimum vaut pour la rubrique entière : les capacités ont neuf
// lignes, que les groupes se partagent (le modèle en donne 2 à l'espèce, 3
// à l'archétype, 1 au style, 1 à la constellation, 2 aux acquises), et un
// groupe vide rend les siennes aux autres.
//
// Les places sont celles du modèle, mesurées dans Chromium (§ 15.4) : ses
// rubriques n'ont aucune place libre (moins qu'une ligne de 18 pixels
// chacune), si bien qu'une rubrique ne grandit jamais : ce qui ne tient pas
// passe au verso.

export const PLACES = {
  // Lignes de capacités que la rubrique tient, ses cinq groupes compris.
  capacites: 9,
  // Lignes d'équipement.
  equipement: 8,
  // Pouvoirs par primordial.
  pouvoirs: 3,
  // Signes que le champ « Armure » tient sur sa ligne.
  armure: 34,
};

export const MODELE_CAPACITES = { espece: 2, archetype: 3, style: 1, constellation: 1, acquises: 2 };
export const MINIMUM_CAPACITES = 9;
const GROUPES = Object.keys(MODELE_CAPACITES);

const vide = () => ({ vide: true });

// Une ligne de capacité, telle que le recto l'écrit.
const ligne = (capacite) => ({ nom: capacite.nom, niveau: capacite.niveau, niveauMax: capacite.niveauMax, cout: capacite.cout, aVenir: capacite.aVenir });

/**
 * Répartit une fiche calculée entre le recto et la suite au verso. places :
 * celles du modèle, ou moins quand la page mesure un débordement.
 */
export function repartir(fiche, places = PLACES) {
  // Les capacités, par groupe ; une constellation sans capacité tient une
  // ligne, avec « capacités à venir ».
  const besoins = Object.fromEntries(GROUPES.map((g) => [g, fiche.groupes[g].map(ligne)]));
  if (fiche.constellation && besoins.constellation.length === 0) {
    besoins.constellation.push({ nom: fiche.constellation.nom, aVenirGroupe: true });
  }
  const total = places.capacites;
  const lignesVides = Math.min(MINIMUM_CAPACITES, total);
  const lignes = Object.fromEntries(GROUPES.map((g) => [g, []]));
  const suite = [];
  const occupees = () => GROUPES.reduce((n, g) => n + lignes[g].length, 0);
  // D'abord une ligne à chaque groupe qui en a besoin, puis les suivantes,
  // groupe après groupe, tant qu'il reste de la place ; le reste au verso.
  for (const g of GROUPES) if (besoins[g].length && occupees() < total) lignes[g].push(besoins[g][0]);
  for (const g of GROUPES) {
    for (const l of besoins[g].slice(lignes[g].length)) {
      if (occupees() < total) lignes[g].push(l);
      else suite.push({ groupe: g, ...l });
    }
  }
  // Des lignes vides, jusqu'aux neuf du modèle et jamais au-delà : chaque
  // groupe reçoit d'abord les siennes, le reste va aux acquises.
  for (const g of GROUPES) {
    while (occupees() < lignesVides && lignes[g].length < MODELE_CAPACITES[g]) lignes[g].push(vide());
  }
  while (occupees() < lignesVides) lignes.acquises.push(vide());

  // L'équipement : chaque objet et sa qualité.
  const objets = fiche.equipement.map((o) => ({ nom: o.nom, qualite: o.qualite.applicable ? o.qualite.texte : "" }));
  const equipement = objets.slice(0, places.equipement);
  const suiteEquipement = objets.slice(places.equipement);
  while (equipement.length < Math.min(PLACES.equipement, places.equipement)) equipement.push(vide());

  // Les liens : un primordial par colonne, ses pouvoirs sur trois lignes.
  const liens = fiche.liens.slice(0, 2).map((lien) => {
    const pouvoirs = lien.pouvoirs.map(ligne);
    const recto = pouvoirs.slice(0, places.pouvoirs);
    while (recto.length < Math.min(PLACES.pouvoirs, places.pouvoirs)) recto.push(vide());
    // Un primordial sans capacité : sa première ligne dit « capacités à venir ».
    if (lien.pouvoirs.length === 0 && recto.length) recto[0] = { aVenirGroupe: true };
    return { nom: lien.nom, points: lien.points, pouvoirs: recto, suite: pouvoirs.slice(places.pouvoirs) };
  });
  const suitePouvoirs = liens.flatMap((l) => l.suite.map((p) => ({ primordial: l.nom, ...p })));

  // Le champ « Armure » : les pièces portées, ou « aucune ».
  const pieces = fiche.defense.pieces;
  const texteArmure = pieces.length ? pieces.join(", ") : "aucune";
  const armure = texteArmure.length <= places.armure ? { texte: texteArmure, auVerso: false } : { texte: `${pieces.length} pièces, détail au verso`, auVerso: true };

  return {
    capacites: lignes,
    equipement,
    liens,
    armure,
    suite: {
      capacites: suite,
      equipement: suiteEquipement,
      pouvoirs: suitePouvoirs,
      armure: armure.auVerso ? pieces : [],
    },
    deborde: suite.length + suiteEquipement.length + suitePouvoirs.length > 0 || armure.auVerso,
  };
}
