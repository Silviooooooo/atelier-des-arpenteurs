// L'accord des nombres dans une description (SPECIFICATION.md, § 6.2).
//
// Le classeur écrit « Se déplace de [N] case(s). » : un mot suivi
// immédiatement de « (s) » ou de « (x) » prend la marque du pluriel quand le
// dernier nombre écrit avant lui, dans la même phrase, vaut 2 ou plus en
// valeur absolue (« 2 cases », « 2 feux »), et la perd sinon (« 1 case »,
// « 1,5 case », « 0 feu »). Une phrase s'arrête à « . », « ! », « ? »,
// « ; », « : » ou à un retour à la ligne. Un nombre s'écrit en chiffres,
// avec une virgule décimale et un signe moins éventuels ; dans « 2/4/8 »,
// le dernier est 8. Sans nombre dans la phrase, le texte reste tel qu'écrit,
// marque comprise : rien ne dit combien.
//
// Seul decrire (js/personnage/calcul.js) l'appelle, sur sa sortie, une fois
// les nombres calculés : une description montrée brute, avec ses « [N] »,
// garde ses marques. accorder ne lit qu'une chaîne, en rend une, et ne lève
// pas d'exception.

// La dernière lettre d'un mot, suivie de sa marque.
const MARQUE = /(\p{L})\((s|x)\)/gu;
const FINS_DE_PHRASE = ".!?;:\n";
const NOMBRE = /-?\d+(?:,\d+)?/g;

/** Le début de la phrase où se trouve la position donnée. */
function debutDePhrase(texte, position) {
  let debut = position;
  while (debut > 0 && !FINS_DE_PHRASE.includes(texte[debut - 1])) debut -= 1;
  return debut;
}

/** Le texte, chaque « (s) » ou « (x) » accordé au dernier nombre de sa phrase. */
export function accorder(texte) {
  const source = String(texte ?? "");
  return source.replace(MARQUE, (tout, lettre, marque, position) => {
    const nombres = source.slice(debutDePhrase(source, position), position).match(NOMBRE);
    if (!nombres) return tout;
    const dernier = nombres[nombres.length - 1];
    const valeur = Math.abs(Number(dernier.replace(",", ".")));
    return lettre + (valeur >= 2 ? marque : "");
  });
}
