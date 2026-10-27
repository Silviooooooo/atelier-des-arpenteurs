// Contrôles du Mode MJ gardé sur l'appareil (SPECIFICATION.md, § 17.8 ;
// mission du lot 4.3, § 5 ; contrat de la vague 3, D5 et § 4.1) :
// js/ecrans/mode_mj.js.
//
// Le Mode MJ est un interrupteur, éteint par défaut, que l'appareil garde
// sous la clé « atelier.mode-mj » (« 1 » allumé, « 0 » éteint). Le stockage
// peut lever (navigation privée, données bloquées) : la lecture rend alors
// « éteint », l'écriture ne fait rien, et aucune des deux ne lève. L'écran du
// combat ne nomme jamais le stockage de l'appareil : il passe par ce module.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLE_MODE_MJ, ecrireModeMj, lireModeMj } from "../js/ecrans/mode_mj.js";
import { simulerStockage } from "./outils/stockage_espion.js";

const RACINE = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, RACINE), "utf8");
const SOURCE = lire("js/ecrans/mode_mj.js");

/** Un stockage qui lève à chaque accès, comme un navigateur qui le refuse. */
function stockageQuiLeve() {
  const avant = globalThis.localStorage;
  const essais = { lus: 0, ecrits: 0 };
  globalThis.localStorage = {
    getItem() {
      essais.lus += 1;
      throw new Error("SecurityError");
    },
    setItem() {
      essais.ecrits += 1;
      throw new Error("QuotaExceededError");
    },
  };
  return {
    essais,
    retirer() {
      if (avant === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = avant;
    },
  };
}

test("mode_mj — la clé de l'appareil, et la lecture : « 1 » seul allume ; éteint par défaut", () => {
  assert.equal(CLE_MODE_MJ, "atelier.mode-mj");
  for (const [depart, attendu] of [
    [{}, false],
    [{ "atelier.mode-mj": "1" }, true],
    [{ "atelier.mode-mj": "0" }, false],
    [{ "atelier.mode-mj": "oui" }, false],
    [{ "atelier.mode-mj": "true" }, false],
    [{ "atelier.mode-mj": "" }, false],
  ]) {
    const stockage = simulerStockage(depart);
    try {
      assert.equal(lireModeMj(), attendu, JSON.stringify(depart));
      assert.deepEqual(stockage.lus, ["atelier.mode-mj"], "une seule clé lue");
      assert.deepEqual(stockage.ecrits, [], "lire n'écrit rien");
    } finally {
      stockage.retirer();
    }
  }
});

test("mode_mj — l'écriture : « 1 » allumé, « 0 » éteint, sous la seule clé ; relue telle quelle", () => {
  const stockage = simulerStockage();
  try {
    ecrireModeMj(true);
    assert.equal(lireModeMj(), true);
    ecrireModeMj(false);
    assert.equal(lireModeMj(), false);
    // Une valeur qui n'est pas « true » éteint.
    ecrireModeMj("oui");
    assert.deepEqual(stockage.ecrits, [
      ["atelier.mode-mj", "1"],
      ["atelier.mode-mj", "0"],
      ["atelier.mode-mj", "1"],
    ]);
    assert.equal(lireModeMj(), true, "une valeur vraie allume");
  } finally {
    stockage.retirer();
  }
});

test("mode_mj — sans stockage, ou quand il lève : éteint, rien ne lève, rien ne se garde", () => {
  const avant = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(lireModeMj(), false, "sans localStorage, éteint");
    assert.doesNotThrow(() => ecrireModeMj(true));
  } finally {
    if (avant !== undefined) globalThis.localStorage = avant;
  }
  const leve = stockageQuiLeve();
  try {
    assert.equal(lireModeMj(), false, "un accès qui lève : éteint");
    assert.doesNotThrow(() => ecrireModeMj(true));
    assert.doesNotThrow(() => ecrireModeMj(false));
    assert.deepEqual(leve.essais, { lus: 1, ecrits: 2 }, "chaque accès est tenté une fois, sans boucle");
  } finally {
    leve.retirer();
  }
});

test("mode_mj — le module : son en-tête, deux fonctions dans un try, jamais removeItem ; l'écran du combat ne lit et n'écrit que par lui", () => {
  const enTete = SOURCE.slice(0, SOURCE.indexOf("export "));
  assert.match(enTete, /^\/\/ Le Mode MJ, gardé sur l'appareil/);
  assert.match(enTete, /§ 17\.8/);
  assert.match(enTete, /atelier\.mode-mj/);
  // Aucune dépendance ; seul localStorage, jamais sessionStorage ni cookie ; aucun retrait (l'espion des contrôles n'en a pas).
  assert.doesNotMatch(SOURCE, /^import /m);
  assert.doesNotMatch(SOURCE, /sessionStorage|cookie|removeItem|clear\(/);
  assert.equal((SOURCE.match(/\btry \{/g) ?? []).length, 2, "la lecture et l'écriture, chacune dans un try");
  assert.deepEqual(SOURCE.match(/globalThis\.localStorage\?\.\w+/g),["globalThis.localStorage?.getItem", "globalThis.localStorage?.setItem"], "deux accès : getItem et setItem");
  assert.deepEqual(
    [...SOURCE.matchAll(/^export (?:const|function) (\w+)/gm)].map(([, nom]) => nom),
    ["CLE_MODE_MJ", "lireModeMj", "ecrireModeMj"],
  );
  // L'écran du combat : jamais le stockage ; le Mode MJ par ce module seul, lu à chaque visite, écrit à chaque bascule.
  const ecran = lire("js/ecrans/combat.js");
  assert.doesNotMatch(ecran, /localStorage|sessionStorage/);
  assert.match(ecran, /import \{ ecrireModeMj, lireModeMj \} from "\.\/mode_mj\.js";/);
  assert.equal((ecran.match(/lireModeMj\(\)/g) ?? []).length, 1, "une lecture, à la visite");
  assert.equal((ecran.match(/ecrireModeMj\(/g) ?? []).length, 1, "une écriture, à la bascule");
  // Les autres écrans ne le lisent pas : il n'appartient qu'au combat.
  for (const autre of ["js/application.js", "js/ecrans/combat_menus.js", "js/ecrans/combat_palette.js", "js/ecrans/combat_action.js"]) {
    assert.doesNotMatch(lire(autre), /mode_mj\.js|atelier\.mode-mj/, autre);
  }
});
