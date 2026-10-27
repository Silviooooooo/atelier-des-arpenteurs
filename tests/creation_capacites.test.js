// Les contrôles de l'étape 8 du créateur, en vignettes (SPECIFICATION.md,
// § 15.3 ; lot 5) : l'en-tête, ses points et sa jauge ; une vignette par
// capacité, son origine, son effet et les quatre lignes de raison mot pour
// mot ; « amélioré » ; la comparaison avec le niveau suivant, dans
// l'infobulle d'un ordinateur (survol, focus, Échap, ses identifiants), par
// la divulgation « Niveau suivant ▸ », dans le volet d'un téléphone (le
// focus à l'aller et au retour) ; les mots ajoutés et retirés de Fournaise,
// du niveau 1 au niveau 2. Le document simulé de tests/outils/dom_simule.js,
// comme les contrôles voisins ; la place de l'infobulle, elle, se lit dans
// la feuille.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importerFichier } from "../js/banque/importation.js";
import { nouveauPersonnage } from "../js/personnage/format.js";
import { creerEtagere, magasinPersonnagesMemoire } from "../js/personnage/stockage.js";
import { installerDom, laisserFiler, texteDe } from "./outils/dom_simule.js";
import { personnageEssai } from "./outils/personnage_essai.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const { banque: IMPORTEE } = await importerFichier(readFileSync(new URL("essais/classeur_essai.xlsx", RACINE)), "classeur_essai.xlsx");
const BANQUE = { ...IMPORTEE, publiee_le: "2026-09-29T10:00:00+02:00" };
const creation = await import("../js/ecrans/creation.js");

function contexteDe(banque = BANQUE) {
  return {
    etat: { mode: "demo", banque, etagere: creerEtagere(magasinPersonnagesMemoire(), "demo"), chargement: { enveloppe: { empreinte: "0123456789abcdef" } } },
    naviguer() {},
    afficher() {},
  };
}

async function etape8(contexte, personnage) {
  await contexte.etat.etagere.garder(personnage);
  const ecran = creation.afficher(contexte, { ecran: "creation", id: personnage.id, etape: 8 });
  document.body.replaceChildren(ecran);
  await laisserFiler(10);
  return ecran;
}

// Le pointeur et la largeur : une souris sur grand écran, un téléphone, ou
// rien (ni souris ni téléphone : un grand écran tactile).
const A_LA_SOURIS = (requete) => ({ matches: requete.includes("pointer: fine") });
const TELEPHONE = (requete) => ({ matches: requete.includes("max-width") });

async function avec(matchMedia, faire, options = {}) {
  const retirer = installerDom(options);
  const avant = globalThis.matchMedia;
  globalThis.matchMedia = matchMedia;
  try {
    await faire();
  } finally {
    globalThis.matchMedia = avant;
    retirer();
  }
}

// Le nom accessible d'un bouton sans aria-label : son texte, hors ce que
// cache aria-hidden.
const nomAccessible = (noeud) => {
  const lireTexte = (n) => (n.childNodes === undefined ? n.textContent : n.getAttribute("aria-hidden") === "true" ? "" : n.childNodes.map(lireTexte).join(""));
  return lireTexte(noeud).replace(/\s+/g, " ").trim();
};
const vignetteDe = (ecran, nom) => [...ecran.querySelectorAll(".vignette-capacite")].find((v) => texteDe(v.querySelector(".capacite-nom")) === nom) ?? null;
const boutonDe = (vignette, fin) => [...vignette.querySelectorAll("button")].find((b) => b.id.endsWith(fin)) ?? null;
const suivantDe = (vignette) => [...vignette.querySelectorAll("button")].find((b) => nomAccessible(b) === "Niveau suivant") ?? null;
const raisonDe = (vignette) => vignette.querySelector(".vignette-capacite-pied p");
const bulleDe = (vignette) => vignette.querySelector(".infobulle-niveau");
// La ligne de niveau, morceau par morceau : « − », « niveau N », « + », le coût.
const ligneDeNiveau = (vignette) => [boutonDe(vignette, "-moins"), vignette.querySelector(".valeur-pas"), boutonDe(vignette, "-plus"), vignette.querySelector(".cout-capacite")].map(texteDe);
const echap = () => {
  let empeche = false;
  document.documentElement.declencher("keydown", { key: "Escape", preventDefault: () => (empeche = true) });
  return empeche;
};
// Chaque identifiant que désigne un attribut existe dans la page, une fois.
function designesPresents(ecran) {
  for (const attribut of ["aria-describedby", "aria-controls", "aria-labelledby"]) {
    for (const noeud of ecran.querySelectorAll(`[${attribut}]`)) {
      for (const id of noeud.getAttribute(attribut).split(" ")) assert.equal(ecran.querySelectorAll(`#${id}`).length, 1, `${attribut} → #${id}`);
    }
  }
}

// Le personnage d'essai sans la montée de Flambage : 8 points dépensés,
// reliquat 2 ; Fournaise, du seul primordial, acquise au niveau 1 (lot 4.3).
const seuleFournaise = (p) => (p.niveaux = [{ capacite: "Fournaise", niveau: 1 }]);

// Une copie de la banque : Vif n'a plus que sa puissance 1 (de niveau 1, il
// n'évolue pas) ; le Saucier donne une capacité absente de la feuille
// Capacites (à venir).
function banqueModifiee() {
  const banque = structuredClone(BANQUE);
  const vif = banque.capacites.find((c) => c.nom === "Vif");
  vif.variantes = [{ ...vif.variantes[0], puissance: "1" }];
  banque.blocs.find((b) => b.nom === "Saucier").capacites.push({ forme: "simple", nom: "Sauce absente" });
  return banque;
}

test("étape 8 — en tête : « Points dépensés », la jauge d'une case par point du plafond, « reliquat » ; l'aide sans sa dernière phrase ; « Survolez » sous la souris seulement", async () => {
  for (const [matchMedia, survol] of [[undefined, false], [TELEPHONE, false], [A_LA_SOURIS, true]]) {
    await avec(matchMedia, async () => {
      const ecran = await etape8(contexteDe(), personnageEssai(seuleFournaise));
      const compteur = ecran.querySelector(".compteur-points");
      assert.equal(compteur.getAttribute("role"), "status");
      assert.equal(texteDe(compteur), "Points dépensés : 8 / 10 reliquat : 2");
      const jauge = compteur.querySelector(".jauge-points");
      assert.equal(jauge.getAttribute("aria-hidden"), "true");
      const cases = [...jauge.querySelectorAll(".jauge-case")];
      assert.deepEqual([cases.length, cases.filter((c) => !c.className.split(" ").includes("vide")).length], [10, 8]);
      const aide = texteDe(ecran.querySelector(".points-capacites").children[1]);
      const sansSurvol = "Points d'une capacité : niveau 1 = 1, niveau 2 = 3, niveau 3 = 6 ; les capacités de niveau 0 ne comptent pas.";
      assert.equal(aide, survol ? `${sansSurvol} Survolez « + » pour voir le niveau suivant.` : sansSurvol);
      assert.doesNotMatch(texteDe(ecran), /Seules les capacités qui peuvent évoluer/);
    });
  }
});

test("étape 8 — une vignette par capacité hors « à venir » : l'origine et son type, la ligne de niveau et son coût, l'effet tel que la fiche le montre, les quatre raisons mot pour mot, « amélioré »", async () => {
  await avec(undefined, async () => {
    // Sans primordial à capacités : 9 points dépensés, Flambage au niveau 2, reliquat 1.
    const banque = banqueModifiee();
    let ecran = await etape8(contexteDe(banque), personnageEssai((p) => (p.primordial = { nom: "Givre éternel", choix: [] })));
    assert.equal(texteDe(ecran.querySelector(".compteur-points")), "Points dépensés : 9 / 10 reliquat : 1");
    assert.equal(vignetteDe(ecran, "Sauce absente"), null, "une capacité à venir n'a pas de vignette");
    designesPresents(ecran);

    const pas = vignetteDe(ecran, "Pas chassé");
    assert.equal(texteDe(pas.querySelector(".vignette-capacite-tete .detail")), "Gestes de cuisine · base");
    assert.deepEqual(ligneDeNiveau(pas), ["−", "niveau 1", "+", "coût : sans coût"]);
    assert.equal(texteDe(pas.querySelector(".vignette-capacite-effet")), "Se déplace de 1 case.");
    // « (s) » accordé : un point, deux points.
    assert.equal(texteDe(raisonDe(pas)), "Niveau 2 : il manque 1 point.");
    assert.equal(boutonDe(pas, "-plus").disabled, true);
    assert.equal(boutonDe(pas, "-plus").getAttribute("aria-describedby"), raisonDe(pas).id);

    const flambage = vignetteDe(ecran, "Flambage");
    assert.equal(texteDe(flambage.querySelector(".vignette-capacite-tete .detail")), "Saucier · archétype");
    assert.equal(texteDe(raisonDe(flambage)), "Niveau 3 : il manque 2 points.");
    assert.ok(flambage.className.split(" ").includes("amelioree"));
    assert.equal(texteDe(flambage.querySelector(".mention-amelioree")), "amélioré");
    assert.deepEqual(ligneDeNiveau(flambage), ["−", "niveau 2", "+", "coût : 10 souffle"]);
    assert.equal(boutonDe(flambage, "-moins").disabled, false, "au-dessus du niveau des blocs");
    assert.equal(pas.querySelector(".mention-amelioree"), null);
    assert.ok(!pas.className.split(" ").includes("amelioree"));

    // De niveau 1 sans pouvoir évoluer, de niveau 0 : ni ligne de niveau ni « Niveau suivant ▸ ».
    const vif = vignetteDe(ecran, "Vif");
    assert.equal(texteDe(vif.querySelector(".vignette-capacite-tete .detail")), "Marmiton · espèce");
    assert.equal(texteDe(raisonDe(vif)), "Niveau maximal atteint.");
    const nez = vignetteDe(ecran, "Nez fin");
    assert.equal(texteDe(raisonDe(nez)), "Niveau 0 : cette capacité n'évolue pas.");
    assert.equal(texteDe(nez.querySelector(".vignette-capacite-effet")), "Retournez un dé devant un plat douteux.");
    for (const v of [vif, nez]) {
      assert.equal(v.querySelector(".capacite-niveau"), null, texteDe(v.querySelector(".capacite-nom")));
      assert.equal(v.querySelectorAll("button").length, 0);
    }

    // Deux origines, séparées par une virgule ; l'effet de chacune, comme la fiche.
    const frappe = vignetteDe(ecran, "Frappe");
    assert.equal(texteDe(frappe.querySelector(".vignette-capacite-tete .detail")), "Couteau d'office · arme, Rouleau de fonte · arme");
    assert.deepEqual([...frappe.querySelectorAll(".vignette-capacite-effet p")].map(texteDe), ["Couteau d'office : Une attaque qui inflige 3/8/20.", "Rouleau de fonte : Une attaque qui inflige 8/11/13."]);

    // La montée permise : « 2 points de plus », Fournaise au coût de son niveau actuel.
    ecran = await etape8(contexteDe(), personnageEssai(seuleFournaise));
    const fournaise = vignetteDe(ecran, "Fournaise");
    assert.equal(texteDe(fournaise.querySelector(".vignette-capacite-tete .detail")), "Grand Four · primordial");
    assert.deepEqual(ligneDeNiveau(fournaise), ["−", "niveau 1", "+", "coût : 1 souffle · 1 lien"]);
    assert.equal(texteDe(raisonDe(fournaise)), "Niveau 2 : 2 points de plus.");
    assert.equal(boutonDe(fournaise, "-plus").disabled, false);

    // Au niveau le plus haut : « + » inactif, « Niveau maximal atteint. », « amélioré ».
    const neuf = nouveauPersonnage("demo");
    neuf.niveaux = [{ capacite: "Taloche", niveau: 3 }];
    ecran = await etape8(contexteDe(), neuf);
    const taloche = vignetteDe(ecran, "Taloche");
    assert.equal(texteDe(raisonDe(taloche)), "Niveau maximal atteint.");
    assert.equal(boutonDe(taloche, "-plus").disabled, true);
    assert.equal(boutonDe(taloche, "-plus").getAttribute("aria-describedby"), raisonDe(taloche).id);
    assert.equal(texteDe(taloche.querySelector(".mention-amelioree")), "amélioré");
    assert.equal(suivantDe(taloche), null, "pas de niveau suivant au niveau maximal");
    for (const raison of ecran.querySelectorAll(".vignette-capacite-pied p")) assert.doesNotMatch(texteDe(raison), /\(s\)/);
  });
});

test("étape 8 — sur un ordinateur, l'infobulle du niveau suivant : au survol de « + » ou à son focus, désignée par aria-describedby après la raison ; la vignette quittée, le focus perdu ou Échap la ferment", async () => {
  await avec(
    A_LA_SOURIS,
    async () => {
      const ecran = await etape8(contexteDe(), personnageEssai(seuleFournaise));
      designesPresents(ecran);
      const fournaise = vignetteDe(ecran, "Fournaise");
      const plus = boutonDe(fournaise, "-plus");
      const bulle = bulleDe(fournaise);
      assert.equal(bulle.getAttribute("role"), "tooltip");
      assert.equal(plus.getAttribute("aria-describedby"), `${raisonDe(fournaise).id} ${bulle.id}`);
      assert.equal(bulle.hidden, true);

      // Le doigt n'ouvre rien ; la souris, si.
      plus.declencher("pointerenter", { pointerType: "touch" });
      assert.equal(bulle.hidden, true);
      plus.declencher("pointerenter", { pointerType: "mouse" });
      assert.equal(bulle.hidden, false);
      fournaise.declencher("pointerleave", { pointerType: "mouse" });
      assert.equal(bulle.hidden, true, "la souris a quitté la vignette");

      // Une seule à la fois.
      const pas = vignetteDe(ecran, "Pas chassé");
      plus.declencher("pointerenter", { pointerType: "mouse" });
      boutonDe(pas, "-plus").declencher("pointerenter", { pointerType: "mouse" });
      assert.deepEqual([bulle.hidden, bulleDe(pas).hidden], [true, false]);
      pas.declencher("pointerleave", { pointerType: "mouse" });

      // Le focus, puis le focus ailleurs.
      plus.focus();
      assert.equal(bulle.hidden, false);
      boutonDe(pas, "-plus").focus();
      assert.equal(bulle.hidden, true, "« + » a perdu le focus");
      boutonDe(pas, "-plus").declencher("blur");

      // Échap la ferme, où que soit le focus ; sans infobulle ouverte, il n'est pas pris.
      plus.declencher("pointerenter", { pointerType: "mouse" });
      assert.equal(echap(), true);
      assert.equal(bulle.hidden, true);
      assert.equal(echap(), false);
      assert.ok(!ecran.querySelector(".volet-niveau"), "pas de volet sur un grand écran");
    },
    { focusFidele: true },
  );
});

test("étape 8 — « Niveau suivant ▸ » : une divulgation (aria-expanded) de la même infobulle, même quand « + » est inactif, nommée « Niveau suivant », sans sa flèche ; absente au niveau maximal et pour une capacité qui n'évolue pas", async () => {
  await avec(undefined, async () => {
    // Le reliquat épuisé : « + » inactif, la comparaison s'ouvre par le bouton.
    const ecran = await etape8(contexteDe(), personnageEssai());
    designesPresents(ecran);
    const fournaise = vignetteDe(ecran, "Fournaise");
    const plus = boutonDe(fournaise, "-plus");
    assert.equal(plus.disabled, true);
    assert.equal(plus.getAttribute("aria-describedby"), raisonDe(fournaise).id, "sans souris, « + » ne désigne que sa raison");
    const bouton = suivantDe(fournaise);
    // « ▸ » se voit mais ne se lit pas : il est seul dans un span aria-hidden.
    assert.equal(texteDe(bouton), "Niveau suivant ▸");
    assert.equal(nomAccessible(bouton), "Niveau suivant");
    assert.equal(bouton.getAttribute("aria-label"), null);
    assert.deepEqual([...bouton.querySelectorAll("span")].map((s) => [s.getAttribute("aria-hidden"), texteDe(s)]), [["true", "▸"]]);
    const bulle = bulleDe(fournaise);
    assert.equal(bouton.getAttribute("aria-controls"), bulle.id);
    assert.equal(bouton.getAttribute("aria-expanded"), "false");
    bouton.click();
    assert.deepEqual([bouton.getAttribute("aria-expanded"), bulle.hidden], ["true", false]);
    assert.equal(texteDe(bulle.querySelector(".comparaison-sous")), "après progression · il manque 2 points");
    bouton.click();
    assert.deepEqual([bouton.getAttribute("aria-expanded"), bulle.hidden], ["false", true]);
    bouton.click();
    assert.equal(echap(), true);
    assert.deepEqual([bouton.getAttribute("aria-expanded"), bulle.hidden], ["false", true]);
    assert.equal(suivantDe(vignetteDe(ecran, "Nez fin")), null);
    assert.equal(bulleDe(vignetteDe(ecran, "Nez fin")), null);
  });
});

test("étape 8 — au téléphone, le volet du bas : role dialog, titré ; le focus à son titre, puis rendu au bouton par « Fermer » ou Échap ; « Passer au niveau 2 », avec les règles de « + »", async () => {
  await avec(
    TELEPHONE,
    async () => {
      const contexte = contexteDe();
      const personnage = personnageEssai(seuleFournaise);
      const ecran = await etape8(contexte, personnage);
      assert.equal(ecran.querySelector("[role=tooltip]"), null, "pas d'infobulle sans souris");
      let fournaise = vignetteDe(ecran, "Fournaise");
      assert.equal(boutonDe(fournaise, "-plus").getAttribute("aria-describedby"), raisonDe(fournaise).id);
      let bouton = suivantDe(fournaise);
      assert.equal(bouton.getAttribute("aria-haspopup"), "dialog");
      assert.equal(bouton.getAttribute("aria-expanded"), null);
      const volet = ecran.querySelector(".volet-niveau");
      assert.deepEqual([volet.getAttribute("role"), volet.hidden], ["dialog", true]);

      bouton.click();
      assert.equal(volet.hidden, false);
      designesPresents(ecran);
      const titre = ecran.querySelector(`#${volet.getAttribute("aria-labelledby")}`);
      assert.equal(texteDe(titre), "Fournaise — niveau 2");
      assert.ok(document.activeElement === titre, "le focus va au titre");
      assert.equal(texteDe(volet.querySelector(".comparaison-sous")), "après progression · 2 points de plus (reliquat 2 → 0)");
      assert.equal(texteDe(volet.querySelector(".comparaison-sous .comparaison-reliquat")), "2 → 0", "le reliquat d'un seul tenant (la feuille)");
      assert.equal(texteDe(volet.querySelector(".comparaison-legende")), "En rouge : ce qui change par rapport au niveau actuel.");
      assert.deepEqual([...volet.querySelectorAll("button")].map(texteDe), ["Fermer", "Passer au niveau 2"]);
      [...volet.querySelectorAll("button")][0].click();
      assert.equal(volet.hidden, true);
      assert.ok(document.activeElement === bouton, "le focus revient au bouton");

      bouton.click();
      assert.equal(echap(), true);
      assert.equal(volet.hidden, true);
      assert.ok(document.activeElement === bouton, "Échap le rend aussi");

      // « Passer au niveau 2 » : la montée, le volet refermé, le focus sur le bouton de la vignette refaite.
      bouton.click();
      [...volet.querySelectorAll("button")][1].click();
      await laisserFiler(10);
      assert.deepEqual((await contexte.etat.etagere.lire(personnage.id)).niveaux, [{ capacite: "Fournaise", niveau: 2 }]);
      fournaise = vignetteDe(ecran, "Fournaise");
      assert.equal(texteDe(fournaise.querySelector(".valeur-pas")), "niveau 2");
      assert.equal(ecran.querySelector(".volet-niveau").hidden, true);
      assert.ok(document.activeElement === suivantDe(fournaise), "le focus sur « Niveau suivant ▸ »");

      // Le reliquat épuisé : « Passer au niveau 3 » inactif, avec sa raison.
      bouton = suivantDe(fournaise);
      bouton.click();
      const passer = [...ecran.querySelector(".volet-niveau").querySelectorAll("button")][1];
      assert.deepEqual([texteDe(passer), passer.disabled], ["Passer au niveau 3", true]);
      assert.equal(passer.getAttribute("aria-describedby"), raisonDe(fournaise).id);
      assert.equal(texteDe(raisonDe(fournaise)), "Niveau 3 : il manque 3 points.");
    },
    { focusFidele: true },
  );
});

test("étape 8 — au téléphone, le volet ne retient pas le focus : parti vers un élément hors de lui, il se ferme et le laisse où il est allé ; resté dedans ou parti vers rien, il reste ouvert", async () => {
  await avec(
    TELEPHONE,
    async () => {
      const ecran = await etape8(contexteDe(), personnageEssai(seuleFournaise));
      const bouton = suivantDe(vignetteDe(ecran, "Fournaise"));
      const ailleurs = suivantDe(vignetteDe(ecran, "Pas chassé"));
      const volet = ecran.querySelector(".volet-niveau");
      // Le document simulé ne propage rien : focusout se déclenche sur le
      // volet, avec l'élément qui reçoit le focus (relatedTarget).
      const quitter = (vers) => volet.declencher("focusout", { relatedTarget: vers });

      bouton.click();
      const [fermer, passer] = [...volet.querySelectorAll("button")];
      // Du titre à « Fermer », puis à « Passer au niveau 2 » : il reste ouvert.
      fermer.focus();
      quitter(fermer);
      passer.focus();
      quitter(passer);
      assert.equal(volet.hidden, false, "le focus est resté dans le volet");
      // Vers rien (une autre fenêtre) : il reste ouvert.
      quitter(null);
      assert.equal(volet.hidden, false, "le focus n'est allé nulle part");

      // Tab après « Passer au niveau 2 » : le focus sort ; le volet se ferme sans le reprendre.
      ailleurs.focus();
      quitter(ailleurs);
      assert.equal(volet.hidden, true, "le focus a quitté le volet");
      assert.equal(volet.children.length, 0);
      assert.ok(document.activeElement === ailleurs, "le focus reste où il est allé");
      assert.equal(echap(), false, "Échap n'est plus pris");

      // Rouvert, Échap le rend toujours au bouton.
      bouton.click();
      assert.equal(volet.hidden, false);
      assert.equal(echap(), true);
      assert.ok(document.activeElement === bouton, "Échap rend le focus au bouton");
    },
    { focusFidele: true },
  );
});

test("étape 8 — la comparaison de Fournaise, du niveau 1 au niveau 2 : le titre, la montée, le coût et la portée qui changent, les mots ajoutés et retirés, la légende", async () => {
  await avec(A_LA_SOURIS, async () => {
    let ecran = await etape8(contexteDe(), personnageEssai(seuleFournaise));
    const bulle = bulleDe(vignetteDe(ecran, "Fournaise"));
    const textes = (noeud, selecteur) => [...noeud.querySelectorAll(selecteur)].map(texteDe);
    assert.deepEqual([...bulle.children].map(texteDe), [
      "Fournaise — niveau 2",
      "après progression · 2 points de plus (reliquat 2 → 0)",
      "Coût : 3 souffle · 1 lien · portée 1",
      "Brûle trois adversaires à 1 case.",
      "Niveau 1 : Réchauffe la case.",
      "En rouge : ce qui change par rapport au niveau actuel.",
    ]);
    // Ce qui change : le souffle et la portée, pas le lien ; les mots ajoutés, une suite ; les retirés, barrés.
    assert.deepEqual(textes(bulle.querySelector(".comparaison-cout"), ".difference"), ["3", "1"]);
    assert.deepEqual(textes(bulle.querySelector(".comparaison-texte"), ".difference"), ["Brûle trois adversaires à 1"]);
    assert.deepEqual(textes(bulle.querySelector(".comparaison-avant"), "s"), ["Réchauffe la"]);
    assert.deepEqual(textes(bulle.querySelector(".comparaison-avant"), ".difference"), []);
    assert.deepEqual(textes(bulle.querySelector(".comparaison-legende"), ".difference"), ["rouge"]);

    // Les dégâts que dit la description au niveau suivant ; la portée absente aux deux niveaux.
    const taloche = bulleDe(vignetteDe(ecran, "Taloche"));
    assert.equal(texteDe(taloche.querySelector(".comparaison-cout")), "Coût : sans coût · dégâts 4/8/16");
    assert.deepEqual(textes(taloche.querySelector(".comparaison-cout"), ".difference"), ["4/8/16"]);
    // Un coût qui apparaît : « sans coût » au niveau 1, « 1 souffle » au niveau 2.
    const pas = bulleDe(vignetteDe(ecran, "Pas chassé"));
    assert.equal(texteDe(pas.querySelector(".comparaison-cout")), "Coût : 1 souffle");
    assert.deepEqual(textes(pas.querySelector(".comparaison-cout"), ".difference"), ["1"]);

    // La montée refusée : « il manque », accordé.
    ecran = await etape8(contexteDe(), personnageEssai((p) => (p.primordial = { nom: "Givre éternel", choix: [] })));
    assert.equal(texteDe(bulleDe(vignetteDe(ecran, "Pas chassé")).querySelector(".comparaison-sous")), "après progression · il manque 1 point");
  });
});

test("étape 8 — la feuille : une colonne, trois à partir de 56rem ; l'infobulle posée par la feuille sous sa vignette ; --difference en graisse forte ; hidden l'emporte ; le code n'écrit aucun style", () => {
  const css = lire("css/personnage.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const corps = (texte, selecteur) => {
    const debut = texte.indexOf(`\n${selecteur} {`);
    assert.notEqual(debut, -1, selecteur);
    return texte.slice(debut, texte.indexOf("}", debut));
  };
  assert.match(corps(css, ".vignettes-capacites"), /display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/);
  const debutMedia = css.indexOf("\n@media (min-width: 56rem) {");
  assert.notEqual(debutMedia, -1);
  assert.match(css.slice(debutMedia, css.indexOf("\n}", debutMedia)).replace(/\n {2}/g, "\n"), /\n\.vignettes-capacites \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(corps(css, ".vignette-capacite"), /position: relative;/);
  for (const declaration of ["position: absolute;", "top: 100%;", "right: 0;", "left: 0;"]) assert.ok(corps(css, ".infobulle-niveau").includes(declaration), declaration);
  assert.match(corps(css, ".difference"), /color: var\(--difference\);\s*font-weight: var\(--graisse-forte\);/);
  assert.match(css, /\n\.infobulle-niveau\[hidden\],\s*\.volet-niveau\[hidden\] \{\s*display: none;/);
  assert.match(corps(css, ".volet-niveau"), /position: fixed;[\s\S]*bottom: 0;[\s\S]*max-height: var\(--hauteur-volet\);/);
  assert.match(corps(css, ".vignette-capacite.amelioree"), /border-color: var\(--accent\);/);
  assert.match(corps(css, ".comparaison-reliquat"), /white-space: nowrap;/, "« 2 → 0 » d'un seul tenant");
  // L'étape 8 n'écrit aucun style : la place de l'infobulle est à la feuille.
  const source = lire("js/ecrans/creation.js");
  const etape = source.slice(source.indexOf("// ─── Étape 8 : les capacités"), source.indexOf("// ─── Étape 9"));
  assert.ok(etape.includes("function etapeCapacites("));
  assert.doesNotMatch(etape, /\.style\b|placerBulle|setProperty/);
});
