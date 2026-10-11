// La vue lecture d'un adversaire (SPECIFICATION.md, § 16.6).
//
// L'adversaire résolu (resolution.js), ses rubriques empilées dans les
// styles de l'interface, lisibles sans zoom sur un téléphone. C'est ici, et
// ici seulement, que chaque valeur dit d'où elle vient : « de Saucier ×2 »
// pour ce qu'un type donne sous le multiplicateur, « de sa ligne » pour ce
// que l'adversaire écrit lui-même, « de Spatule souple » pour ce que donne un
// objet. La carte (carte.js), qui s'imprime, n'en dit rien.
//
// Rien ne se recalcule : la vue affiche ce que la résolution a rendu. Un
// type, un objet ou une capacité introuvable s'affiche barré, avec un lien
// vers l'anomalie de la ligne qui le cite, comme tout renvoi cassé (§ 9).

import { GRAVITES } from "../banque/controle.js";
import { compte, el, enumerer, renvoiCasse, versAnomalie } from "../ecrans/dom.js";
import { ZONES } from "../personnage/regles.js";
import { adresseFiche } from "../routes.js";
import { ecrireCout, ecrireMultiplicateur } from "./carte.js";
import { FACE_CONTRE_ATTAQUE } from "./notation.js";
import { FEUILLE } from "./resolution.js";

// L'élision devant une voyelle : « d'Écaille ». Un h reste entier, faute de
// savoir s'il est muet.
const VOYELLE = /^[aeiouàâäéèêëîïôöùûüœæ]/iu;
const de = (nom) => (VOYELLE.test(nom) ? `d'${nom}` : `de ${nom}`);

/**
 * D'où vient une valeur : « de Saucier ×2 » (un type, sous le
 * multiplicateur de l'adversaire), « de Commis », « de sa ligne », « de
 * Spatule souple » (un objet). Rien pour une valeur que rien ne donne.
 */
export function ecrireOrigine(origine, multiplicateur = null) {
  if (!origine) return "";
  if (origine.objet !== undefined) return de(origine.objet);
  if (origine.type === null) return "de sa ligne";
  return `${de(origine.type)}${origine.multiplie && multiplicateur ? ` ${ecrireMultiplicateur(multiplicateur)}` : ""}`;
}

const gravite = (constat) => (constat.code && Object.hasOwn(GRAVITES, constat.code) ? GRAVITES[constat.code] : null);

/**
 * Ce qui rend un adversaire incertain, en quelques mots : « incomplet »,
 * « 2 erreurs », ou les deux ; null quand il se résout sans erreur. Il
 * s'affiche et s'imprime quand même, tel qu'il se résout.
 */
export function defautDe(resolu) {
  const erreurs = resolu.constats.filter((constat) => ["erreur", "bloquante"].includes(gravite(constat))).length;
  const defauts = [resolu.complet ? null : "incomplet", erreurs ? compte(erreurs, "erreur", "erreurs") : null].filter(Boolean);
  return defauts.length ? defauts.join(", ") : null;
}

function section(titre, ...contenu) {
  return el("section", { classe: "lecture-section" }, el("h2", {}, titre), ...contenu);
}

const provenance = (texte) => (texte ? el("span", { classe: "provenance" }, texte) : null);
const detail = (...morceaux) => el("span", { classe: "detail" }, morceaux.filter(Boolean).join(" · "));
const vide = (texte) => el("p", { classe: "secondaire-texte" }, texte);

/** La vue lecture d'un adversaire résolu. index : celui de la consultation (js/banque/consultation.js). */
export function lecture(resolu, index) {
  const { multiplicateur } = resolu;
  // Une banque forgée peut porter autre chose qu'un numéro de ligne : il ne
  // s'écrit ni ne se suit que s'il en est un.
  const ligne = Number.isInteger(resolu.ligne) ? resolu.ligne : null;
  const propre = { feuille: FEUILLE, ligne };
  const origineDe = (origine) => ecrireOrigine(origine, multiplicateur);
  const originesDe = (origines) => [...new Set(origines.map(origineDe).filter(Boolean))].join(", ");
  // Le rang est celui de la dernière citation (§ 16.4). Quand plusieurs
  // origines donnent la capacité, il dit laquelle : « rang 2, de sa ligne ».
  const rangDe = (rang, origines) => {
    const citation = origines.findLast((origine) => origine.objet === undefined);
    const plusieurs = new Set(origines.map(origineDe).filter(Boolean)).size > 1;
    return `rang ${rang}${plusieurs && citation ? `, ${origineDe(citation)}` : ""}`;
  };
  // Une liste que ses types donnaient, et qu'une cellule écrite sans « // »
  // laisse vide (« aucun ») : c'est dit, avec la ligne qui la vide.
  const listeVide = (texte, origine, accord) =>
    el("p", { classe: "secondaire-texte" }, origine ? [`${texte} `, provenance(`${origineDe(origine)}, qui n'en garde ${accord}`)] : `${texte}.`);

  // La ligne où se corrige ce qu'une origine cite : celle du bloc, celle du
  // type, sinon celle de l'adversaire.
  const lieuDe = (origine) => {
    const bloc = origine?.objet === undefined ? null : index.entrees("blocs", origine.objet)[0];
    if (bloc?.brut?.ligne) return { feuille: "Blocs", ligne: bloc.brut.ligne };
    const type = origine?.type ? index.entrees("types", origine.type)[0] : null;
    return type?.brut?.ligne ? { feuille: FEUILLE, ligne: type.brut.ligne } : propre;
  };

  const nombre = (lu) => {
    if (lu.valeur !== null) return [el("strong", {}, lu.valeur), " ", provenance(origineDe(lu.origine))];
    // Une cellule qui ne se lit pas garde son origine, sans valeur (E14).
    return lu.origine ? ["illisible ", provenance(origineDe(lu.origine))] : ["— ", provenance("rien ne le donne")];
  };
  const fixe = (ecrit) => [el("strong", {}, ecrit), " ", provenance("valeur fixe")];
  const paire = (terme, contenu) => [el("dt", {}, terme), el("dd", {}, contenu)];

  const types = resolu.types.length
    ? [
        el(
          "ul",
          { classe: "lecture-liste" },
          resolu.types.map((type) => el("li", {}, type.absent ? renvoiCasse(type.nom, propre) : el("a", { href: adresseFiche("types", type.nom) }, type.nom))),
        ),
        resolu.types.length > 1 ? el("p", { classe: "provenance" }, "Appliqués dans cet ordre : pour chaque valeur, le suivant l'emporte.") : null,
        multiplicateur
          ? el("p", {}, "Multiplicateur ", el("strong", {}, ecrireMultiplicateur(multiplicateur)), " ", provenance("de sa ligne : il multiplie ce qui vient des types, les nombres et la qualité de l'équipement"))
          : null,
      ]
    : vide("Aucun type : tout vient de sa ligne.");

  const localisation = () => {
    if (!resolu.localisation) return vide("Aucune localisation : ni ses types, ni sa ligne ne la donnent.");
    const grille = el("p", {}, "Grille ", provenance(origineDe(resolu.localisation.origine)));
    if (resolu.localisation.invalide) return [grille, vide("Cette grille ne se lit pas : aucune zone n'est posée.")];
    if (!resolu.zones.length) return [grille, vide("Aucune zone.")];
    const reconnue = (zone) => (zone.approchee ? provenance(`lue « ${ZONES.find((z) => z.code === zone.code)?.nom ?? zone.nom} »`) : null);
    return [
      grille,
      el(
        "table",
        { classe: "lecture-zones" },
        el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Zone"), el("th", { scope: "col" }, "d20"), el("th", { scope: "col" }, "Armure"), el("th", { scope: "col" }, "Résistance"))),
        el(
          "tbody",
          {},
          el("tr", {}, el("th", { scope: "row" }, "Contre-attaque"), el("td", {}, FACE_CONTRE_ATTAQUE), el("td", {}, "—"), el("td", {}, "—")),
          resolu.zones.map((zone) =>
            el(
              "tr",
              {},
              el("th", { scope: "row" }, zone.nom, " ", reconnue(zone)),
              el("td", { classe: "lecture-faces" }, zone.debut === zone.fin ? zone.debut : `${zone.debut}-${zone.fin}`),
              el("td", {}, el("strong", {}, zone.armure), " ", provenance(zone.pieces.length ? zone.pieces.join(" + ") : "aucune pièce")),
              el("td", {}, zone.resistance),
            ),
          ),
        ),
      ),
    ];
  };

  const objet = (o) => {
    const origine = el("p", {}, provenance(origineDe(o.origine)));
    if (o.genre === "absent") return el("li", {}, el("p", {}, renvoiCasse(o.nom, lieuDe(o.origine))), origine);
    if (o.genre !== "pack") return el("li", {}, el("p", {}, el("a", { href: adresseFiche("blocs", o.nom) }, o.nom), " ", detail(`qualité ${o.qualite}`)), origine);
    return el(
      "li",
      {},
      el("p", {}, el("span", { classe: "lecture-nom" }, o.nom), " ", detail(`qualité ${o.qualite}`, compte(o.pieces.length, "pièce", "pièces"))),
      el("p", {}, "Pièces : ", enumerer(o.pieces.map((piece) => el("a", { href: adresseFiche("blocs", piece) }, piece)))),
      origine,
    );
  };

  const maitrise = (m) =>
    el("li", {}, el("p", {}, el("a", { href: adresseFiche("capacites", m.nom) }, m.nom), " ", detail(rangDe(m.rang, m.origines))), el("p", {}, provenance(originesDe(m.origines))));

  const capacite = (c) => {
    const origine = el("p", {}, provenance(originesDe(c.origines)));
    if (c.absente) return el("li", {}, el("p", {}, renvoiCasse(c.nom, lieuDe(c.origines[0])), " ", detail("absente de la feuille Capacites")), origine);
    const descriptions = c.descriptions.filter((d) => d.texte);
    return el(
      "li",
      {},
      el("p", {}, el("a", { href: adresseFiche("capacites", c.nom) }, c.nom), " ", detail(c.evolue ? rangDe(c.rang, c.origines) : "n'évolue pas", ecrireCout(c.cout) || "sans coût")),
      c.armes.map((arme) => el("p", {}, "Dégâts ", el("strong", {}, arme.degats), arme.portee ? `, portée ${arme.portee}` : null, " ", provenance(de(arme.nom)))),
      c.desavantage.length ? el("p", {}, "Désavantage ", provenance(`${c.desavantage.map(de).join(", ")}${c.desavantageEntier ? "" : " seulement"}`)) : null,
      descriptions.map((d) => el("p", {}, descriptions.length > 1 && d.source ? `${d.source} : ${d.texte}` : d.texte)),
      origine,
    );
  };

  const constat = (c) => {
    const publiee = Number.isInteger(c.ligne) && index.anomaliesDe(FEUILLE, c.ligne).length > 0;
    return el(
      "li",
      {},
      c.code ? [el("span", { classe: "code" }, c.code), gravite(c) ? ` · ${gravite(c)}` : null, " — "] : null,
      c.message,
      publiee ? [" (", versAnomalie({ feuille: FEUILLE, ligne: c.ligne }, `${FEUILLE}, ligne ${c.ligne}`), ")"] : null,
    );
  };

  const anomalies = ligne ? index.anomaliesDe(FEUILLE, ligne) : [];

  return el(
    "div",
    { classe: "lecture" },
    section("Types", types),
    section(
      "Valeurs",
      el(
        "dl",
        { classe: "lecture-paires" },
        paire("Nombre d'actions", nombre(resolu.actions)),
        paire("Souffle", nombre(resolu.souffle)),
        paire("Attaque", nombre(resolu.attaque)),
        paire("Défense", nombre(resolu.defense)),
        paire("Corps", fixe(resolu.corps)),
        paire("Résistance", fixe(`${resolu.resistance} par zone`)),
      ),
    ),
    section("Localisation", localisation()),
    resolu.maitrises.length ? section("Maîtrises", el("ul", { classe: "lecture-liste" }, resolu.maitrises.map(maitrise))) : null,
    section("Équipement", resolu.equipement.length ? el("ul", { classe: "lecture-liste" }, resolu.equipement.map(objet)) : listeVide("Aucun objet", resolu.listes?.equipement, "aucun")),
    section("Capacités", resolu.capacites.length ? el("ul", { classe: "lecture-liste" }, resolu.capacites.map(capacite)) : listeVide("Aucune capacité", resolu.listes?.capacites, "aucune")),
    resolu.constats.length ? section("À vérifier", el("ul", { classe: "lecture-avertissements" }, resolu.constats.map(constat))) : null,
    el(
      "p",
      { classe: "secondaire-texte petit" },
      anomalies.length
        ? versAnomalie(propre, `${compte(anomalies.length, "anomalie", "anomalies")} sur cette ligne (${FEUILLE}, ligne ${ligne})`)
        : `Feuille ${FEUILLE}${ligne ? `, ligne ${ligne}` : ""}.`,
    ),
  );
}
