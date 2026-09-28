// Les dates de publication (SPECIFICATION.md, § 5.1 et § 8.2).
//
// Une banque porte sa date de publication à l'heure locale de l'auteur,
// avec son décalage (2026-09-28T14:32:00+02:00) ; le message de commit et
// les écrans l'écrivent à la française (28/09/2026 14:32).

const deux = (nombre) => String(nombre).padStart(2, "0");

/** La date au format du § 5.1, à l'heure locale, avec son décalage. */
export function horodatage(date) {
  const decalage = -date.getTimezoneOffset();
  const signe = decalage < 0 ? "-" : "+";
  const absolu = Math.abs(decalage);
  return (
    `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}` +
    `T${deux(date.getHours())}:${deux(date.getMinutes())}:${deux(date.getSeconds())}` +
    `${signe}${deux(Math.floor(absolu / 60))}:${deux(absolu % 60)}`
  );
}

/** « 28/09/2026 14:32 », à l'heure locale de l'appareil qui l'affiche. */
export function dateLisible(date) {
  const jour = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(jour.getTime())) return String(date);
  return `${deux(jour.getDate())}/${deux(jour.getMonth() + 1)}/${jour.getFullYear()} ${deux(jour.getHours())}:${deux(jour.getMinutes())}`;
}
