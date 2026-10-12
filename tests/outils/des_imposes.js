// Une source de dés imposés, pour les contrôles de l'écran du combat
// (SPECIFICATION.md, § 17 « Le simulateur de combat (lot 4) », et § 11).
//
// L'écran lance ses dés par une source qu'il reçoit (js/combat/des.js, en
// vrai). Un contrôle lui donne celle-ci à la place : elle rend, dans l'ordre,
// les valeurs qu'il a écrites, et le combat joué à l'écran est alors connu
// d'avance. Elle n'est pas dans js/ : rien de ce que charge la page ne permet
// d'imposer un dé.
//
// Les contrôles du moteur n'en ont pas besoin : leurs scénarios écrivent les
// valeurs dans les événements.

/**
 * desImposes([8, 3, 14]) rend { lancer(faces, combien = 1), reste() }.
 *
 * lancer() rend les « combien » valeurs suivantes. Elle lève si l'on demande
 * un dé qui n'a pas été prévu, ou si la valeur prévue n'est pas une face du
 * dé demandé : dans les deux cas, l'écran ne joue pas le combat que le
 * contrôle croit jouer, et mieux vaut le savoir au dé près.
 *
 * reste() rend les valeurs qui n'ont pas été lancées, dans l'ordre : vide
 * quand tous les dés prévus sont tombés.
 */
export function desImposes(valeurs) {
  const prevues = [...valeurs];
  let lances = 0;
  return {
    lancer(faces, combien = 1) {
      if (lances + combien > prevues.length) {
        throw new Error(`Dés imposés : ${combien} d${faces} demandé(s) après ${lances} valeur(s), mais ${prevues.length} seulement sont prévues.`);
      }
      const rendues = prevues.slice(lances, lances + combien);
      for (const valeur of rendues) {
        if (!Number.isInteger(valeur) || valeur < 1 || valeur > faces) {
          throw new Error(`Dés imposés : la valeur ${valeur} n'est pas une face d'un d${faces} (valeur n° ${lances + 1}).`);
        }
      }
      lances += combien;
      return rendues;
    },
    reste() {
      return prevues.slice(lances);
    },
  };
}
