// La source de dés de l'écran du combat (SPECIFICATION.md, § 17 « Le
// simulateur de combat (lot 4) »).
//
// Le moteur du combat ne tire rien : chaque dé lui arrive avec ses valeurs,
// pour qu'un combat gardé se rejoue à l'identique. C'est donc l'écran qui
// lance, au clic, et ce module est sa seule source de hasard. Les contrôles
// et le banc lui substituent une source de dés imposés (tests/outils/),
// que l'écran reçoit par ses services : rien dans la page, ni adresse ni
// réglage, ne permet de remplacer celle-ci.

// Un tirage est un entier de 32 bits : il y en a 2 puissance 32.
const TIRAGES = 2 ** 32;

/**
 * Une source de dés : lancer(faces, combien = 1) rend « combien » valeurs de
 * 1 à « faces », chacune aussi probable que les autres.
 *
 * Le reste d'une division ne suffit pas : 2 puissance 32 n'est pas un
 * multiple de 6, et les premières faces sortiraient un peu plus souvent. Un
 * tirage au-delà du plus grand multiple de « faces » est donc rejeté et
 * refait (au pire une fois sur deux, pour un dé de plus de 2 puissance 31
 * faces ; une fois sur un milliard pour un d6).
 *
 * alea : ce qui porte getRandomValues ; par défaut, le générateur du
 * navigateur.
 */
export function sourceAleatoire(alea = crypto) {
  const tampon = new Uint32Array(1);
  const lancerUn = (faces) => {
    const plafond = TIRAGES - (TIRAGES % faces);
    for (;;) {
      alea.getRandomValues(tampon);
      if (tampon[0] < plafond) return 1 + (tampon[0] % faces);
    }
  };
  return {
    lancer(faces, combien = 1) {
      // Sans cette garde, un nombre de faces nul ou fractionnaire ferait
      // tourner le rejet sans fin, ou rendrait des valeurs qui ne sont pas
      // des faces.
      if (!Number.isSafeInteger(faces) || faces < 1 || faces > TIRAGES) throw new RangeError(`Un dé a de 1 à ${TIRAGES} faces, non ${faces}.`);
      if (!Number.isSafeInteger(combien) || combien < 0) throw new RangeError(`Le nombre de dés à lancer est un entier positif, non ${combien}.`);
      return Array.from({ length: combien }, () => lancerUn(faces));
    },
  };
}
