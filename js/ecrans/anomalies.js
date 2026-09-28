// L'écran des anomalies (SPECIFICATION.md, § 6.3, § 6.4 et § 9).
//
// Le rapport publié avec la banque, trié par gravité, puis par feuille et
// par ligne. La gravité se lit en toutes lettres. Une adresse
// #/anomalies/Blocs/14 met en avant les anomalies de cette ligne : c'est là
// que mène un renvoi cassé. L'espace auteur réutilise la liste.

import { adresseFiche } from "../routes.js";
import { compte, el, titre } from "./dom.js";

const GRAVITES = [
  ["bloquante", "Bloquantes", "bloquante", "bloquantes"],
  ["erreur", "Erreurs", "erreur", "erreurs"],
  ["avertissement", "Avertissements", "avertissement", "avertissements"],
  ["information", "Informations", "information", "informations"],
];

/** Le décompte par gravité : « 15 erreurs, 9 avertissements, 5 informations ». */
export function decompte(anomalies) {
  return GRAVITES.map(([gravite, , singulier, pluriel]) => [anomalies.filter((a) => a.gravite === gravite).length, singulier, pluriel])
    .filter(([nombre]) => nombre > 0)
    .map(([nombre, singulier, pluriel]) => compte(nombre, singulier, pluriel))
    .join(", ");
}

/**
 * La liste complète, par gravité. index (facultatif) donne un lien vers la
 * fiche de chaque ligne ; surligner : { feuille, ligne } ; niveau : la balise
 * des titres de gravité.
 */
export function listeAnomalies(anomalies, { index = null, surligner = null, niveau = "h2" } = {}) {
  return GRAVITES.map(([gravite, intitule]) => {
    const groupe = anomalies.filter((a) => a.gravite === gravite);
    if (!groupe.length) return null;
    return el(
      "section",
      {},
      el(niveau, {}, `${intitule} (${groupe.length})`),
      el(
        "ul",
        { classe: "anomalies" },
        groupe.map((anomalie) => {
          const visee = surligner && anomalie.feuille === surligner.feuille && anomalie.ligne === surligner.ligne;
          const entree = index && anomalie.ligne ? index.entreeDeLigne(anomalie.feuille, anomalie.ligne) : null;
          return el(
            "li",
            { classe: `anomalie ${gravite}${visee ? " surlignee" : ""}` },
            el("p", { classe: "petit" }, el("span", { classe: "code" }, anomalie.code), ` · ${anomalie.gravite} · ${anomalie.feuille}${anomalie.ligne ? `, ligne ${anomalie.ligne}` : ""}`),
            el("p", {}, anomalie.message),
            entree ? el("p", { classe: "petit" }, el("a", { href: adresseFiche(entree.categorie, entree.nom) }, `Voir la fiche « ${entree.nom} »`)) : null,
          );
        }),
      ),
    );
  });
}

export function afficher(contexte, route) {
  const { banque, index } = contexte.etat;
  const surligner = route.feuille ? { feuille: route.feuille, ligne: route.ligne } : null;
  const visees = surligner ? banque.anomalies.filter((a) => a.feuille === surligner.feuille && a.ligne === surligner.ligne) : [];
  return el(
    "section",
    {},
    titre("Anomalies"),
    banque.anomalies.length
      ? el("p", {}, `Le rapport publié avec la banque : ${decompte(banque.anomalies)}.`)
      : el("p", {}, "Aucune anomalie n'a été publiée avec la banque."),
    surligner
      ? el(
          "p",
          { classe: "message" },
          visees.length
            ? `${compte(visees.length, "anomalie", "anomalies")} sur la ligne ${surligner.ligne} de la feuille ${surligner.feuille}, mise${visees.length > 1 ? "s" : ""} en avant ci-dessous.`
            : `Aucune anomalie sur la ligne ${surligner.ligne} de la feuille ${surligner.feuille}.`,
        )
      : null,
    listeAnomalies(banque.anomalies, { index, surligner }),
  );
}
