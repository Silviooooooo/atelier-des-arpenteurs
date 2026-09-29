# L'Atelier des Arpenteurs — spécification

**Version 1.0 — 29/09/2026.** Le lot 1 est en service. Ce document fait foi pour le code. Toute décision
qui le contredit y est reportée, avec une entrée de révision et un numéro de
version (§ 14). Le nom « L'Atelier des Arpenteurs » est validé par l'auteur ;
le dépôt s'appelle `atelier-des-arpenteurs`.

---

## 0. Lire ceci d'abord

**Ce qu'est ce programme.** Un site web statique, hébergé par GitHub Pages,
qui sert aux joueurs et au MJ des *Arpenteurs d'Abrasia* à consulter la banque
du jeu (blocs, capacités, éléments, adversaires, prétirés) et à créer des
personnages, des adversaires et des objets, avec une sortie PDF.

**Trois sources, et une seule fait foi pour les règles.**

| Source | Rôle | Lue par le programme ? |
|---|---|---|
| `Principe jdr abrasia.docx` (le Word) | **les règles du jeu**, lisibles par un humain qui part de zéro | non |
| `regles_jdr.xlsx` (classeur des règles) | les données : blocs, capacités, éléments | oui, à l'import |
| second classeur (lot 2, nom à fixer) | adversaires et prétirés | oui, à l'import |

**Le programme n'invente aucune règle.** Quand un lot a besoin d'une règle que
le Word ne dit pas, on ne la devine pas : on l'inscrit au § 12 comme « à
écrire dans le Word, section … », et on s'arrête sur ce point. L'auteur ne
répond pas aux questions de règles en conversation ; il les écrit dans le Word.

**Les cinq interdits.**

1. **Aucun classeur réel dans le dépôt.** Le dépôt est public. Seuls les
   classeurs d'essai fictifs de `essais/` y entrent (§ 10.3).
2. **Aucune donnée réelle en clair dans le dépôt**, hors les exemples de
   cette spécification, réels mais non confidentiels (décision de l'auteur,
   28/09/2026). La banque publiée est chiffrée (§ 7) ; un contrôle le vérifie.
3. **Aucune clé ni aucun mot de passe dans le code** ni dans un fichier
   versionné. Ils se saisissent dans la page, sur l'appareil de la personne.
   Seule exception : le mot de passe de la démonstration, public par
   décision de l'auteur, qui n'ouvre que des données fictives (§ 9).
4. **Aucune écriture dans un classeur de l'auteur.** Le programme les lit,
   rien d'autre ; seul l'outil des essais (`tests/outils/`) fabrique le
   classeur fictif d'`essais/`.
5. **Aucune dépendance sans justification écrite** au § 10.2. La cible est
   zéro : le navigateur fournit la décompression et le chiffrement ; le XML
   se lit avec un lecteur écrit pour le projet (§ 6.1).

**Méthode.** Le plan avant le code : exposer les fichiers à créer et attendre
la validation. Un lot se découpe en étapes, réunies en groupes : l'auteur
valide à la fin de chaque groupe, pas entre ses étapes (§ 13). Une todo
visible, remontrée à chaque pas. Les questions
groupées à la fin. Un défaut se mesure avant de se corriger. Un contrôle
nouveau se vérifie armé puis désarmé : un contrôle qui ne peut pas échouer ne
prouve rien. Le code, les commentaires, les identifiants et les messages sont
en français.

---

## 1. Le projet

**Pour qui.** Une dizaine de personnes : l'auteur (Silvio Abbaz), ses joueurs
et ses MJ. Sur ordinateur et sur téléphone.

**Ce qu'il fait, à terme.**

1. Une **banque** consultable : blocs, capacités, éléments, adversaires,
   prétirés, avec leurs renvois dans les deux sens.
2. Un **créateur d'adversaire** (lot 2).
3. Un **créateur d'objets, de sorts et d'équipement** (lot 3).
4. Un **créateur de personnage** (lot 4).
5. L'**export PDF** de chaque création, depuis un ordinateur ; la vue d'un
   personnage sur téléphone, adaptée à l'écran et zoomable.

**Hors périmètre.** Serveur, base de données, comptes utilisateurs. Écriture
dans un classeur. PDF sur téléphone en première version (lot 5). Tout lien
avec Book of Abrasia ou World Anvil : ce projet en est indépendant.

---

## 2. Les décisions, et pourquoi

| Décision | Raison |
|---|---|
| Site statique sur **GitHub Pages** | gratuit, rien à entretenir, utilisable depuis un téléphone ; choix de l'auteur, sur le modèle d'un site existant |
| **Code public, données chiffrées** par un mot de passe de table | GitHub Pages gratuit exige un dépôt public ; l'auteur veut des données privées ; une dizaine d'utilisateurs se partagent un mot de passe sans difficulté |
| **Calculs en JavaScript**, dans le navigateur | seul langage que GitHub Pages fait tourner |
| **Modules JavaScript natifs, sans framework ni étape de construction** | GitHub Pages sert les fichiers tels quels ; pas d'outillage à installer pour l'auteur |
| **Bouton « Importer un classeur »** dans la page | idée de l'auteur : il choisit le fichier (depuis OneDrive sur ordinateur ou téléphone), voit le rapport, publie ; aucune pièce mobile en dehors de la page |
| **Seul le JSON chiffré entre dans le dépôt**, jamais le classeur | le dépôt est public ; un JSON montre ses changements ligne par ligne dans l'historique |
| **Le texte d'origine de chaque cellule est conservé** dans la banque | un lot futur pourra réinterpréter les données sans nouvel import ; rien ne se perd |
| **Deux classeurs** : règles d'un côté, adversaires et prétirés de l'autre | choix de l'auteur, pour ne pas mélanger ; le contrôle vérifie les renvois entre les deux |
| **Le Word fait foi** pour les règles | l'auteur veut que n'importe qui puisse comprendre le jeu en relisant le Word depuis zéro |
| **PDF par l'impression du navigateur**, sur ordinateur | aucune dépendance ; le PDF sur téléphone n'est pas une priorité |
| Le dossier du dépôt reste dans **OneDrive** | choix de l'auteur ; précautions au § 10.3 |
| Un **lecteur XML écrit pour le projet**, le même dans la page et dans les contrôles | avec deux lecteurs, les contrôles vérifieraient un code que la page n'exécute pas (§ 6.1) |
| Le **sel** du chiffrement ne change qu'avec le mot de passe | la clé gardée sur un appareil doit déchiffrer les publications suivantes (§ 7.1) |
| Le **cache de GitHub Pages** (`max-age=600`) est accepté ; une page restée 15 secondes sur « Chargement » propose de recharger | un numéro de version dans les adresses des modules ne vaudra la peine que si le cache gêne à l'usage (§ 9) |
| La **première vraie publication** suit le groupe 3, sans attendre les corrections du classeur ni du Word | les erreurs sont publiées en connaissance de cause (§ 6.3) ; l'auteur publie lui-même, guidé par Claude (§ 13) |

---

## 3. L'architecture

### 3.1 Le circuit

```
Auteur : classeur Excel (OneDrive)
  └─ page, espace auteur : « Importer un classeur »
       ├─ lecture du .xlsx sur l'appareil (rien n'est envoyé)
       ├─ analyse de la notation → banque (§ 5, § 6)
       ├─ contrôle de cohérence → rapport, différences avec la version publiée
       ├─ chiffrement par le mot de passe de table (§ 7)
       └─ enregistrement dans le dépôt par l'API GitHub (§ 8)
            └─ GitHub Pages republie le site (≈ 1 à 2 minutes)
                 └─ joueurs : mot de passe une fois par appareil → consultation, créations
```

### 3.2 Le dépôt

```
index.html                  la page unique ; les écrans sont des routes (#/…)
manifest.webmanifest        l'Atelier sur l'écran d'accueil d'un téléphone (§ 9)
package.json                { "type": "module" } et rien d'autre : Node lit les .js comme modules
icones/                     monogramme « AA » : icone.svg, icone-180.png, icone-192.png, icone-512.png
css/
  jetons.css                toutes les valeurs de mise en page en variables
  ecran.css                 l'interface, pensée pour le téléphone d'abord
js/
  application.js            démarrage, routes, chargement de la banque
  veille.js                 script classique : 15 s sur « Chargement », il propose de recharger (§ 9)
  routes.js                 les adresses des écrans, décodées sans exception
  lecture/
    zip.js                  lecteur d'archive ZIP (DecompressionStream)
    xml.js                  lecteur XML du projet, le même pour la page et les contrôles
    xlsx.js                 feuilles, chaînes partagées, cellules → tableaux
  banque/
    noms.js                 comparaison des noms : exacte, puis sans casse, accents ni espaces
    notation.js             analyse de la notation des classeurs (§ 6.2)
    importation.js          classeur → banque
    controle.js             contrôle de cohérence → anomalies (§ 6.3)
    differences.js          banque publiée ↔ banque importée, résumé d'une ligne
    dates.js                date de publication (§ 5.1) et date lisible
    chargement.js           téléchargement et déchiffrement de la banque, démonstration
    consultation.js         renvois, « octroyée par », « porté par », nom affiché
    recherche.js            recherche sans casse ni accents
  securite/
    chiffrement.js          PBKDF2 + AES-GCM (WebCrypto)
    coffre.js               clés gardées sur l'appareil (IndexedDB)
  publication/
    github.js               API GitHub : lecture de l'empreinte, écriture
    preparation.js          différences, message et chiffrement d'une publication
  ecrans/
    accueil.js  mot_de_passe.js  liste.js  fiche_bloc.js
    fiche_capacite.js  fiche_element.js  anomalies.js  espace_auteur.js
    dom.js                  fabrique des éléments, sans jamais insérer de HTML
donnees/
  banque.chiffree.json      la seule donnée réelle du dépôt, chiffrée
essais/
  classeur_essai.xlsx       classeur FICTIF, contenu inventé, fabriqué par tests/outils/
  banque_demo.chiffree.json la banque de démonstration, tirée du classeur d'essai, au format 2 (§ 9)
  banque_format1.chiffree.json  la même, au format 1, figée : l'ancien format reste lisible (§ 7.1)
outils/
  icones.js                 fabrique les icônes, sans dépendance
  banque_demo.js            fabrique la banque de démonstration
  serveur_local.js          sert le site sur le poste, à la seule machine, pour l'essayer avant l'envoi
tests/
  *.test.js                 contrôles, lancés par `node --test`
  outils/                   fabrique de classeurs, description du classeur d'essai, document simulé des écrans
  banc_classeur_reel.js     bancs sur le classeur réel (§ 6.3), lancés à la main
.github/workflows/
  controles.yml             lance les contrôles à chaque envoi
.gitignore                  classeurs et leurs formats voisins, documents, JSON hors liste, documents de travail (§ 10.3)
.nojekyll                   fichier vide : GitHub Pages sert les fichiers tels quels, sans Jekyll
.githooks/pre-push          lance node --test avant chaque envoi, et refuse l'envoi en cas d'échec (§ 10.3)
.gitattributes              les crochets toujours extraits en fins de ligne LF
CLAUDE.md                   consignes pour Claude Code
SPECIFICATION.md            ce document
```

---

## 4. Les sources

### 4.1 Le classeur des règles — état relevé le 28/09/2026

Quatre feuilles. **Les colonnes se retrouvent par leur en-tête, jamais par
leur position** : l'auteur réordonne ses feuilles.

| Feuille | En-têtes (ligne 1) | Lignes |
|---|---|---|
| `lisez_moi` | aucune ; colonne A = rubrique (Syntaxe, nb, directions), écrite sur la première ligne de chacune, B = texte | 19 lignes non vides, de la ligne 2 à la ligne 20 ; la ligne 1 est vide |
| `Blocs` | Nom · Type · Eléments transmis aux capacités · capacites · Paramètres transmis aux capacités · Infos | 67 blocs |
| `Eléments` | Nom · Paramètres reçus · description | 19 éléments |
| `Capacites` | origine · Nom · puissance · Coût en souffle · Coût en lien · Eléments propres · description | 71 lignes, 69 noms |

Le banc de lecture du 28/09/2026 (§ 6.3) retrouve ces feuilles, ces en-têtes
et ces comptes. Une lecture indépendante par Python trouve les mêmes 678
cellules non vides, sans un écart. Le classeur ne contient que des chaînes
partagées et des nombres entiers : ni formule, ni texte enrichi, ni retour à
la ligne.

La correspondance des en-têtes ignore casse, accents et espaces
(« capacites » = « Capacités »). Un en-tête attendu introuvable est une erreur
d'import (§ 6.3, E1).

Les colonnes `origine` (Capacites) et `Infos` (Blocs) n'ont, selon
`lisez_moi`, « aucune valeur légale ». Elles sont conservées et affichées
comme **notes de conception**, jamais interprétées.

**Le type d'un bloc** (lot 2). L'auteur a ajouté la colonne « Type » à
`Blocs` le 29/09/2026 ; c'est un en-tête attendu (E1 s'il manque). Le type
se garde tel qu'écrit, espaces de bord retirés, et se compare sans casse,
accents ni espaces (`js/banque/types.js`). Les types reconnus sont ceux que
le livret énumère (« Système », « Blocs ») : Base, Espèce, Archétype,
Style de combat, Constellation, Primordial, Arme, Armure, Équipement,
Consommable, Blessure, État. Le livret écrit « Constellation de
naissance » : les deux écritures sont admises (§ 12). Un bloc sans type
(A8) ou d'un type inconnu (A9) reste dans la banque et dans la
consultation, mais le créateur de personnage ne le voit pas. La fiche
d'un bloc et la liste des blocs montrent le type. Banc du 29/09/2026 sur
le classeur réel : chaque bloc a un type reconnu, aucun A8 ni A9.

### 4.2 Le second classeur

Adversaires et prétirés. Sa structure est définie au lot 2, à partir du
gabarit de fiche d'adversaire et de la section « Caractéristiques d'un
adversaire » du Word (§ 12).

### 4.3 Le Word

Il n'est pas lu par le programme. La spécification le cite par section.

---

## 5. La banque

### 5.1 Le format en clair (avant chiffrement)

```json
{
  "format": 1,
  "publiee_le": "2026-09-27T14:32:00+02:00",
  "sources": [
    { "classeur": "regles", "fichier": "regles_jdr.xlsx", "empreinte": "sha256:…" }
  ],
  "blocs": [
    {
      "nom": "Epée longue",
      "type": "Arme",
      "elements": [ { "nom": "Arme" }, { "nom": "Agile" } ],
      "capacites": [
        { "forme": "simple", "nom": "Attaque de base" },
        { "forme": "choix", "options": ["Loup solitaire", "Attaque de meute"] },
        { "forme": "facultatif", "options": ["Cheville foulée", "Doigt coupé"] }
      ],
      "parametres": [
        { "nom": "degats", "valeur": "5/10/15", "cible": null },
        { "nom": "portee", "valeur": "0", "cible": null }
      ],
      "notes": "Aoe, visée",
      "brut": { "feuille": "Blocs", "ligne": 39, "cellules": { "Nom": "…", "…": "…" } }
    }
  ],
  "capacites": [
    {
      "nom": "Sphère de Makith",
      "variantes": [
        { "puissance": "1", "cout_souffle": "1", "cout_lien": "1",
          "elements": [ { "nom": "Centré" } ],
          "description": "…", "notes": "Primordial", "brut": { "…": "…" } }
      ]
    }
  ],
  "elements": [
    { "nom": "Portée", "parametres_recus": ["portee"], "description": "…", "brut": { "…": "…" } }
  ],
  "lisez_moi": [ { "rubrique": "Syntaxe", "texte": "…" } ],
  "anomalies": [
    { "gravite": "erreur", "code": "E4", "feuille": "Blocs", "ligne": 14,
      "message": "Le bloc « Artisan » cite la capacité « Représailles », introuvable dans Capacites." }
  ]
}
```

**Règles de forme.**

- Toutes les valeurs restent des **chaînes**, telles qu'écrites : `"N"`,
  `"5*N"`, `"X"`, `"{force}*0,5"`. Le programme ne calcule rien au lot 1. Un
  nombre de cellule s'écrit sans décimale inutile (`10`, jamais `10.0`), et
  avec une **virgule** décimale (`0,5`, jamais `0.5`), comme Excel en français
  et comme les expressions du classeur (décision de l'auteur, 28/09/2026).
- Les noms sont débarrassés de leurs espaces de bord ; le nom d'origine reste
  dans `brut`.
- Une **capacité peut avoir plusieurs variantes**, une par puissance : la
  Sphère de Makith occupe trois lignes de même nom (puissances 1, 2, 3).
  Deux lignes de même nom **et** de même puissance sont une erreur (E3). Cette
  lecture contredit la phrase de `lisez_moi` « le nom est l'identifiant
  unique » ; elle est inscrite au § 12 pour que la source le dise.
- Les **anomalies** voyagent avec la banque : ce qui a été publié malgré une
  erreur reste visible de tous (§ 9, écran Anomalies).
- Une ligne non vide sans nom (E2) n'entre pas dans la banque ; l'anomalie
  donne sa feuille et sa ligne.
- `lisez_moi` garde la rubrique et le texte tels qu'écrits : la rubrique
  n'étant écrite que sur la première ligne de chacune, les suivantes ont une
  rubrique vide.
- `sources` porte le nom du fichier importé et l'empreinte SHA-256 de ses
  octets.
- `type` (lot 2) : le type du bloc tel qu'écrit, ou `""` (A8). Une banque
  publiée avant la colonne « Type » n'a pas ce champ : la consultation la
  lit comme avant, et le créateur de personnage dit « Le créateur a besoin
  d'une banque republiée depuis le classeur à jour. » Les différences
  comparent le type comme un champ ; un bloc sans type vaut un type vide,
  si bien que la première republication de l'auteur montre chaque bloc
  modifié par son type, et rien d'autre.

### 5.2 Le nom affiché d'un paramètre

Le Word distingue le nom transmis (`{portee:1}`) du nom affiché (`Portée[1]`).
Règle retenue : **le nom affiché est celui de l'élément qui reçoit ce
paramètre** (colonne « Paramètres reçus » de `Eléments`). Un paramètre qu'aucun
élément ne reçoit s'affiche sous son nom brut, et produit l'avertissement A2.

---

## 6. L'import (lot 1)

### 6.1 La lecture du fichier

L'auteur choisit un `.xlsx` par le sélecteur de fichiers du système : sur
Windows il atteint son dossier OneDrive, sur téléphone l'application OneDrive.
**Rien ne quitte l'appareil avant la publication.**

Le `.xlsx` est une archive ZIP. `zip.js` lit le répertoire central, puis les
en-têtes locaux, et décompresse avec `DecompressionStream("deflate-raw")`,
natif dans les navigateurs actuels et dans Node 22. Il accepte les méthodes
« stockée » et « deflate » et les noms en UTF-8, et vérifie le CRC-32 de
chaque entrée lue.

`xlsx.js` lit `workbook.xml` et ses relations pour nommer les feuilles, puis
`sharedStrings.xml` (texte enrichi : concaténer les `<t>` des `<r>`, en
ignorant les annotations phonétiques `<rPh>`), puis les cellules : `t="s"`,
`t="inlineStr"`, `t="str"`, booléens, erreurs, nombres. Chaque cellule devient
une chaîne, au plus près de ce qu'Excel affiche :

- un nombre à 15 chiffres significatifs, comme Excel, sans décimale inutile
  et avec une virgule décimale (`0,5`) (§ 5.1) ;
- un booléen `VRAI` ou `FAUX`, comme Excel en français ;
- une erreur de formule sous son code (`#N/A`) ;
- les caractères qu'Excel écrit `_xHHHH_`, le retour chariot notamment,
  rendus tels quels.

Les retours à la ligne internes aux cellules sont gardés. Chaque ligne garde
son numéro dans Excel.

Un classeur protégé par un mot de passe, ou enregistré à l'ancien format
`.xls`, n'est pas une archive ZIP. Son message dit comment l'enregistrer en
`.xlsx`.

Le XML se lit avec `xml.js`, un lecteur écrit pour le projet, **le même dans la
page et dans les contrôles** : avec deux lecteurs, les contrôles et le banc
vérifieraient un code que la page n'exécute pas. Il compare les balises **par
leur nom local**, sans préfixe d'espace de noms (`x:row` = `row`), car
certains logiciels préfixent tout le XML d'un classeur. Il refuse les
DOCTYPE, qu'un classeur ne contient pas.

Un fichier qui n'est pas un `.xlsx` lisible produit un message clair, jamais
une page blanche. Il en va de même d'une archive tronquée, chiffrée, au format
ZIP64 ou dont le CRC est faux.

### 6.2 La notation

La notation est décrite dans `lisez_moi` ; `notation.js` la lit sans jamais
lever d'exception. Ce qu'il ne comprend pas, il le **garde en brut et le
signale** (E6), il ne l'avale pas.

| Où | Forme | Exemple réel | Résultat |
|---|---|---|---|
| Blocs · capacites | liste séparée par des virgules | `Attaque de base, choc, visée` | trois capacités simples |
| | choix obligatoire `( a \| b )` | `(Loup solitaire \| Attaque de meute)` | `forme: "choix"` |
| | ensemble facultatif `[ a \| b ]` | `[Cheville foulée \| Doigt coupé]` | `forme: "facultatif"` |
| Blocs · éléments | liste, cible éventuelle entre parenthèses | `Dégâts(Attaque à mains nues)` | élément Dégâts, `cible: "Attaque à mains nues"` |
| Blocs · paramètres | `{nom:valeur}` séparés par des virgules | `{degats:5/10/15}, {portee:0}` | deux paramètres |
| | valeur composée par `/` | `{armure:40/0/0/0/0/0}` | valeur gardée en chaîne |
| | valeur contenant des accolades | `{degats:{force}*0,5/{force}/{force}*2}` | **accolades imbriquées** : compter la profondeur |
| | cible entre parenthèses après l'accolade | `{…}(Attaque à mains nues)` | `cible` |
| Capacites · éléments propres | nom, valeur éventuelle entre crochets | `Portee[1]` | élément Portée, `valeur: "1"` |
| Eléments · paramètres reçus | liste de noms entre accolades | `{portee}` | paramètre reçu `portee` |
| Descriptions | `[N]`, `[N*{degats}]`, `{portee}` | — | gardées telles quelles au lot 1 ; les `{nom}` sont les paramètres invoqués (A5) |

**Une ligne de la feuille ne se découpe jamais sur une virgule située entre
accolades, crochets ou parenthèses** : `{force}*0,5` contient une virgule
décimale.

Les noms et les options perdent leurs espaces de bord : `( a | b)` est un
choix entre `a` et `b`. Un choix peut n'avoir qu'une option : `(a)`. Un
morceau vide, celui d'une virgule finale par exemple, ne porte rien.

Un choix peut apparaître dans la colonne des paramètres (Constellation de
Neru), ou dans celle des éléments. Il est lu, conservé en brut, et produit
l'avertissement A7.

**Ce qui donne E6**, le morceau étant gardé tel quel :

- un délimiteur jamais fermé, ou fermant sans ouvrant ;
- un paramètre sans `:`, ou avec un nom ou une valeur vide ;
- une option vide ;
- des délimiteurs ailleurs qu'aux places du tableau, par exemple une barre
  hors d'un choix ou deux paramètres collés ;
- un paramètre reçu écrit sans accolades.

### 6.3 Le contrôle de cohérence

Les noms se comparent d'abord **exactement**, puis, à défaut, **sans casse,
sans accents et sans espaces** : un renvoi retrouvé de la seconde façon est
résolu, mais signalé (A1).

| Code | Gravité | Ce qui est vérifié |
|---|---|---|
| E1 | bloquante | feuille ou en-tête attendu absent : l'import s'arrête |
| E2 | erreur | ligne non vide sans nom |
| E3 | erreur | doublon : bloc, élément, ou capacité de même nom et même puissance (noms comparés exactement, espaces de bord retirés) |
| E4 | erreur | capacité citée par un bloc, introuvable ; la cible d'un élément ou d'un paramètre compte comme une citation |
| E5 | erreur | élément cité (Blocs ou Capacites), introuvable |
| E6 | erreur | notation illisible : délimiteur non fermé, paramètre sans `:`… (liste au § 6.2) |
| E7 | erreur | même paramètre transmis deux fois par un bloc, sans cible qui les distingue : un paramètre sans cible vaut pour toutes les capacités du bloc, et seules deux cibles différentes distinguent deux transmissions (§ 12) |
| A1 | avertissement | renvoi qui ne diffère que par la casse, les accents ou les espaces : capacité, cible, élément ou paramètre |
| A2 | avertissement | paramètre transmis qu'aucun élément ne reçoit (`lisez_moi` : un paramètre implique son élément) |
| A3 | avertissement | capacité rattachée à aucun bloc : citée dans la colonne des capacités d'aucun bloc (une cible ne rattache pas, un choix gardé en brut non plus) |
| A4 | avertissement | élément défini, porté par rien : cité par aucun bloc ni aucune capacité, et reçu d'aucun paramètre transmis (`lisez_moi` : un bloc qui transmet un paramètre porte l'élément lié) |
| A5 | avertissement | paramètre invoqué dans une description (`{portee}`) que ni la capacité ni ses blocs ne portent : ni un élément propre qui le reçoit, ni un bloc qui la cite et le transmet ou porte un élément qui le reçoit, sans cible ou avec elle pour cible |
| A7 | avertissement | choix de capacités écrit hors de la colonne des capacités |
| A8 | avertissement | bloc sans type (colonne « Type » vide) : le créateur de personnage ne le voit pas |
| A9 | avertissement | bloc d'un type inconnu, qui n'est aucun des types reconnus (§ 4.1) : le créateur de personnage ne le voit pas |
| I1 | information | espaces de bord retirés d'un nom |
| I2 | information | description vide |
| I3 | information | bloc sans capacité (décision de l'auteur, 28/09/2026 : ce fut A6, avertissement, jusqu'à la 0.6 ; le code A6 ne sera pas réutilisé) |

**Publier malgré des erreurs** (validé par l'auteur le 28/09/2026). Une erreur
bloque la publication par défaut.
L'auteur peut l'accepter : une case « Je publie en connaissance de cause » ne
s'active qu'après affichage de la liste complète. Les anomalies sont alors
publiées avec la banque et visibles de tous. Raison : les règles sont en
cours d'écriture, et une banque incomplète vaut mieux qu'aucune banque, à
condition que rien ne soit caché. E1 ne s'accepte jamais.

**Mesure de référence, classeur relevé le 28/09/2026.** Sur le classeur réel, le
contrôle doit trouver **au moins** :

- E4 : 9 capacités citées introuvables (12 citations) — Boire, Enduire arme,
  Maîtrise du combat précise, Représailles, Savoir acquis, fureur, lancer
  grenade, redécouverte, trouvé ! ;
- E7 : Hache légère transmet `{portee:0}` et `{portee:1}` sans cible ;
- A1 : 21 renvois de capacités qui ne diffèrent que par la casse, les accents
  ou les espaces ;
- A2 : 3 paramètres sans élément — `archetype`, `consommable`, `defense` ;
- A3 : 2 capacités orphelines — Maîtrise du combat précis, Constellation
  d'Enaël ;
- I1 : 15 noms à espace de bord.

**Banc complet du 28/09/2026**, sur le même classeur (modifié le 24/09) : il
retrouve exactement ces comptes et ces noms, sans absent ni nom en plus. Il
trouve aussi ce que la référence ne mesurait pas :

- E4 : une cible de paramètre introuvable, celle de Hache légère ;
- A1 : 35 renvois d'éléments, dont `Portee` pour Portée ;
- E5 : 5 ;
- A4 : 4 ;
- I3 : 30 blocs sans capacité (A6 dans la 0.6) ;
- A7 : 1, la Constellation de Neru ;
- I2 : 2 ;
- aucun E2, E3, E6 ni A5.

**Les bancs sur le classeur réel.** Ils se lancent **en local, hors dépôt**,
par l'auteur ou par Claude Code : `node tests/banc_classeur_reel.js
chemin/vers/regles_jdr.xlsx`. Le classeur se lit là où il est, sans être
copié ; le banc affiche des comptes et n'écrit rien.

- **Banc de lecture**, dès que `xlsx.js` existe et avant la notation : les
  feuilles, leurs en-têtes et le nombre de lignes non vides de chacune,
  comparés au § 4.1. Quand Python répond sur le poste, une lecture
  indépendante par sa bibliothèque standard (`zipfile`, `xml.etree`), dans un
  script hors dépôt, compare en plus chaque cellule.
- **Banc complet** : import et contrôle, et les comptes par code, à côté de la
  mesure de référence ci-dessus. L'auteur modifie son classeur : un écart
  n'est pas un échec. Il s'explique par les éléments qui le causent, sans que
  rien ne soit « corrigé » dans les données.

### 6.4 Le rapport et les différences

Avant publication, l'espace auteur montre :

1. le **rapport** d'anomalies, trié par gravité puis par feuille et ligne ;
2. les **différences** avec la banque publiée (déchiffrée avec le mot de
   passe de table) : blocs, capacités et éléments ajoutés, modifiés (champ par
   champ), retirés ;
3. un résumé d'une ligne, qui devient le message de commit (§ 8).

**Les différences** (`differences.js`). Blocs, capacités et éléments se
reconnaissent à leur nom : un nom changé est un retrait suivi d'un ajout ;
deux entrées de même nom (E3) se distinguent par leur rang. Les champs se
comparent sur leur **valeur lue**, si bien que l'ordre des lignes et deux
écritures de la même notation (`a,b` et `a, b`) ne font pas de différence ;
ils s'affichent **tels que l'auteur les a écrits** (`brut`), sous le nom de
leur colonne. Une capacité à une seule variante de part et d'autre compare
sa puissance comme un champ ; à plusieurs variantes, elle se compare
puissance par puissance, et une variante ajoutée ou retirée est une
modification. Un `lisez_moi` modifié est signalé.

**Le résumé d'une ligne** : `Publication du classeur des règles — 28/09/2026
14:32 — 3 capacités ajoutées, 2 modifiées, 0 retirée`. Les catégories
viennent dans l'ordre blocs, capacités, éléments, séparées par « ; » ; une
catégorie sans changement est tue ; zéro et un s'accordent au singulier.
Sans changement : « aucune différence ». La première publication donne les
totaux (« première publication : 67 blocs, 69 capacités, 19 éléments ») ; une
publication malgré des erreurs finit par « — publiée malgré 12 erreurs ».

---

## 7. Le chiffrement

### 7.1 Le schéma

- **Dérivation** : PBKDF2-SHA256, **600 000 itérations**, sel aléatoire de
  16 octets, **tiré avec le mot de passe de table et gardé jusqu'au
  suivant**.
- **Chiffrement** : AES-GCM 256 bits, IV aléatoire de 12 octets, **neuf à
  chaque publication** : c'est lui qu'AES-GCM exige unique pour une même clé.
- **Tout par WebCrypto** : aucune bibliothèque.
- **Le mot de passe se normalise** avant la dérivation : forme Unicode NFC,
  espaces de bord retirés. Un « é » s'écrit en un ou deux caractères selon
  l'appareil, et un clavier de téléphone ajoute volontiers une espace en fin
  de mot : le même mot de passe doit donner la même clé partout.

**Pourquoi le sel ne change qu'avec le mot de passe** (relevé du 28/09/2026,
dans Chromium et dans Node 24). Une clé dérivée avec un sel ne déchiffre pas
ce qu'a chiffré une clé dérivée avec un autre sel. Un sel renouvelé à chaque
publication obligerait chaque joueur à ressaisir le mot de passe après chaque
publication : le « une fois par appareil » du § 7.2 ne tiendrait pas. La
sécurité ne baisse pas : le sel empêche les tables précalculées, et toutes les
versions partagent de toute façon le même mot de passe.

Le fichier `donnees/banque.chiffree.json` :

```json
{
  "format": 2,
  "publiee_le": "2026-09-27T14:32:00+02:00",
  "empreinte": "sha256 des octets chiffrés",
  "kdf": { "nom": "PBKDF2-SHA256", "iterations": 600000, "sel": "base64…" },
  "chiffre": { "nom": "AES-GCM", "iv": "base64…", "donnees": "base64…" }
}
```

L'en-tête est en clair (date, empreinte, paramètres). **Au format 2**
(décision de l'auteur, 29/09/2026), l'empreinte est le SHA-256 **des octets
chiffrés** (`chiffre.donnees` décodé, étiquette d'AES-GCM comprise). Elle
permet à la page de savoir si sa copie est à jour, et se vérifie sans clé,
**dès le téléchargement** : un fichier abîmé se dit avant que le mot de passe
soit demandé. Elle ne dit rien du contenu, même à qui en a lu une version :
deux publications de la même banque ont deux empreintes, puisque l'IV
change. Savoir si le contenu a changé se fait sur le contenu déchiffré,
jamais sur l'empreinte. Elle ne couvre pas l'IV : un IV abîmé se lit comme
un mot de passe faux (revue du groupe 4). Un fichier abîmé, d'un format
inconnu, ou un mot de passe faux donnent un message, jamais une exception.
Un format plus récent que celui de la page (un onglet resté ouvert sur
l'ancien code) dit « rechargez la page ».

**Le format 1**, celui de la première publication réelle (29/09/2026),
portait le SHA-256 de la banque en clair, vérifié après le déchiffrement :
qui détenait une version en clair pouvait y vérifier une supposition sur une
version suivante (revue du groupe 3). **La page écrit le format 2 et lit
encore le format 1** : la banque réelle reste lisible sans rien faire, et la
prochaine publication de l'auteur passe d'elle-même au format 2, sous le même
sel. Le fichier figé `essais/banque_format1.chiffree.json`, tiré du classeur
d'essai par le code du format 1, garantit cette lecture. **La lecture du
format 1 sera retirée au premier groupe qui suit une publication réelle au
format 2, confirmée par l'auteur.**

**Les bornes de l'en-tête, à la lecture** (groupe 3). La page refuse, comme
un fichier abîmé : moins de 600 000 itérations, ou plus de dix fois ce
nombre (une hausse future reste lisible, une attente de plusieurs heures
non) ; un sel qui ne se décode pas en 16 octets ; un IV qui ne se décode pas
en 12 ; des données plus courtes que l'étiquette d'AES-GCM (16 octets). Une
clé de moins de 600 000 itérations ne chiffre rien. Un navigateur qui refuse
la dérivation donne lui aussi un message.

### 7.2 Sur les appareils

- Le mot de passe se saisit **une fois par appareil**. La page garde la clé
  dérivée, non extractible, **avec le sel qui l'a produite**, le nombre
  d'itérations et la durée de la dérivation, dans IndexedDB (`coffre.js`),
  jamais le mot de passe lui-même. Le coffre ne garde qu'une clé WebCrypto
  d'AES-GCM non extractible, et rien d'autre. Il la garde seulement si
  « Se souvenir sur cet appareil » est coché, y compris quand la clé naît
  dans l'espace auteur ; sinon, elle vit en mémoire le temps de la visite.
  En mémoire, la page n'en tient qu'une copie.
- La clé de la banque réelle et celle de la **démonstration** (§ 9) se
  gardent **séparément** : garder ou oublier l'une ne touche jamais l'autre.
  Le jeton GitHub (§ 8.1) se garde et s'oublie à part.
- Sans IndexedDB (navigation privée de certains navigateurs), la clé vit en
  mémoire le temps de la visite, et la page le dit : l'écran du mot de passe
  remplace la case « Se souvenir » par « Cet appareil ne garde rien : le mot
  de passe sera redemandé à la prochaine visite. »
- Un sel ou un nombre d'itérations gardés qui diffèrent de ceux de la banque
  publiée signifient que le mot de passe de table a changé : la page le dit
  et redemande le mot de passe.
- L'auteur publie avec la clé qu'il a gardée, sans ressaisir la phrase de
  passe.
- Un bouton « Oublier le mot de passe sur cet appareil » efface la clé, du
  coffre et de la mémoire. Il annule aussi le circuit en cours de l'espace
  auteur : une confirmation en attente se referme sans rien écrire, et les
  différences déchiffrées quittent l'écran. Une clé lue juste avant l'oubli
  ne revient pas en mémoire.
- La dérivation prend 63 ms dans Chromium et 77 ms dans Node 24 sur le PC de
  l'auteur (relevé du 28/09/2026), et **123 ms sur Android 15, dans
  Firefox 156** (relevé de l'auteur, 28/09/2026), puis **119 ms en mode réel**
  sur le même téléphone, le 29/09/2026 à 7 h 29, clé gardée. Le stockage
  durable y est accordé. La page affiche une attente.

### 7.3 Les limites, à dire à l'auteur et dans le guide

- **La force du mot de passe est toute la protection.** Le fichier chiffré
  est public : n'importe qui peut essayer des mots de passe hors ligne. Une
  phrase de **quatre ou cinq mots tirés au hasard** résiste ; « abrasia » ou
  un prénom se trouvent en secondes. L'espace auteur refuse un mot de passe
  de moins de 20 signes, comptés après la normalisation du § 7.1.
- **L'historique garde les anciennes versions**, chiffrées avec le mot de
  passe de leur époque. Changer de mot de passe protège les publications
  suivantes, pas les précédentes : un joueur qui part garde l'accès à ce
  qu'il a déjà pu lire.
- **Changer de mot de passe** : l'auteur republie avec le nouveau, puis le
  transmet. L'espace auteur le propose en une action.
- **Le code est public** : il révèle la structure des données (noms des
  champs), jamais leur contenu.
- **La taille se voit.** Le fichier chiffré a la taille de la banque en
  clair, plus 16 octets, et le message de commit compte les ajouts, les
  modifications et les retraits (§ 8.2). Qui a lu une version peut donc
  deviner l'ampleur d'un changement, jamais son contenu (revue du
  groupe 4).
- **L'origine est réservée à l'Atelier.** Tous les sites GitHub Pages d'un
  compte partagent l'origine `https://silviooooooo.github.io`, et IndexedDB
  est cloisonné par origine, pas par chemin : la clé de table et le jeton
  GitHub seraient lisibles par tout autre site Pages du compte. Relevé du
  28/09/2026 : aucun autre site Pages sur ce compte. S'il en fallait un jour
  un autre, l'Atelier passerait sur une organisation GitHub dédiée (gratuite)
  ou sur un domaine propre.
- **Safari peut effacer les données d'un site non visité depuis sept jours**,
  sauf s'il est ajouté à l'écran d'accueil. C'est la limite du « une fois par
  appareil » sur iPhone, à écrire dans le guide des joueurs.

---

## 8. La publication

### 8.1 La clé GitHub

L'auteur crée un **jeton à portée fine** (*fine-grained personal access
token*), limité **à ce seul dépôt**, permission **Contents : lecture et
écriture**, **valable un an** (décision de l'auteur, 28/09/2026 ; il le crée
à l'étape H). Il le saisit une fois dans l'espace auteur de chaque appareil
dont il publie ; la page le garde dans IndexedDB. **Sans clé, l'espace
auteur n'affiche que la saisie de la clé, et le bouton « Publier »,
inactif** : un joueur ne peut rien publier. « Oublier la clé GitHub »
annule le circuit en cours : rien ne s'écrit ensuite avec la clé oubliée.
Un appareil perdu : le jeton se révoque sur GitHub.

### 8.2 L'écriture

1. `GET /repos/{proprietaire}/{depot}/contents/donnees/banque.chiffree.json?ref=main`,
   sans cache du navigateur, pour obtenir le `sha` de la version en place et
   la banque publiée, dont l'espace auteur tire les différences. Au-delà d'un
   mégaoctet, l'API ne donne le contenu qu'en brut : il se relit alors avec
   `Accept: application/vnd.github.raw+json`. **Première publication** : le
   fichier n'existe pas encore, la réponse est 404, et l'écriture se fait
   sans `sha`.
2. `PUT` du même chemin avec le contenu, le `sha` (sauf à la première
   publication) et le message `Publication du classeur des règles —
   28/09/2026 14:32 — 3 capacités ajoutées, 2 modifiées, 0 retirée`.
3. Le `PUT` porte **un auteur et un committer explicites** : le nom de
   l'auteur et l'adresse privée du compte
   (`id+login@users.noreply.github.com`). Sans ces champs, GitHub prend
   l'identité du compte, peut-être avec l'adresse personnelle, et
   l'historique public la garderait.
4. Un refus pour `sha` périmé (publication concurrente depuis un autre
   appareil) : recharger, refaire les différences, redemander confirmation.
   GitHub le signale par un 409, ou par un 422 quand l'écriture était sans
   `sha` (une première publication doublée). Le circuit recommence trois fois
   au plus ; le message final porte le code et le motif du dernier refus,
   car un 422 peut aussi venir d'une autre cause.
5. Un seul fichier, donc un seul commit par publication. Le JSON s'y écrit
   indenté, suivi d'un retour à la ligne.
6. Chaque requête porte `Authorization: Bearer <jeton>` et
   `X-GitHub-Api-Version: 2022-11-28`. Une clé refusée (401), des droits
   insuffisants (403, ou 404 à l'écriture), une panne du réseau ou un
   fichier illisible donnent un message qui dit quoi faire, avec le code et
   le motif de GitHub pour le diagnostic ; jamais une exception. Une réponse
   qui n'est pas du JSON (un portail captif, une connexion coupée) donne un
   message ; après une écriture acceptée (200 ou 201), un corps perdu ne
   change pas le succès.

### 8.3 Le délai

GitHub Pages republie en une à deux minutes, puis son cache garde l'ancien
fichier jusqu'à une dizaine de minutes. La page télécharge donc la banque avec
un paramètre unique (`?v=<horodatage>`) et compare l'empreinte de l'en-tête à
celle qu'elle détient ; l'espace auteur affiche « publiée — visible par tous
d'ici quelques minutes ».

---

## 9. Les écrans du lot 1

**Pensés pour le téléphone d'abord** : une colonne, cibles tactiles de 44 px
au moins, **zoom jamais interdit** (pas de `user-scalable=no`). Sur un grand
écran (56rem et plus), la liste et la fiche se placent côte à côte ; sur un
téléphone, la fiche s'ouvre seule, avec un lien de retour à sa liste.

**L'aspect est sobre** (décision de l'auteur, 28/09/2026) : polices du
système, aucune police téléchargée ; gris neutres et une seule couleur
d'accent ; un thème clair et un thème sombre, selon le réglage de l'appareil
(`prefers-color-scheme`). Le texte contraste d'au moins 4,5:1 avec chacun de
ses fonds, et les bordures des champs d'au moins 3:1. Toutes les valeurs
vivent dans `css/jetons.css` : une identité visuelle s'y posera plus tard,
sans toucher au reste ; seule la largeur de la condition `@media` s'écrit
dans `ecran.css`, car CSS n'y lit pas de variable. La gravité d'une anomalie
se lit en toutes lettres, jamais à la seule couleur. Aucune identité
visuelle propre à Abrasia au lot 1.

| Écran | Contenu |
|---|---|
| Mot de passe | un champ, « se souvenir sur cet appareil » coché par défaut, une attente pendant la dérivation, qui ne dépend pas de la peinture de la fenêtre (une fenêtre masquée ne peint pas) ; après chaque saisie réussie, la page demande un stockage durable (`navigator.storage.persist()`), sans attendre la réponse : Firefox la demande à la personne, qui peut ne jamais répondre (relevé du groupe 3) ; sans IndexedDB, une phrase remplace la case (§ 7.2) |
| Accueil | date de la banque publiée, comptes (blocs, capacités, éléments), lien vers les anomalies s'il y en a ; « Vérifier les mises à jour » (§ 8.3) ; « Oublier le mot de passe sur cet appareil » (§ 7.2) ; l'aide pour l'écran d'accueil ; le diagnostic |
| Listes | Blocs, Capacités, Éléments, dans l'ordre alphabétique ; recherche instantanée sur les noms et les descriptions, sans casse ni accents (`œ` vaut `oe`), chaque mot de la recherche devant se trouver |
| Fiche d'un bloc | éléments (liens), capacités (liens ; « au choix : … », « facultatif : … »), paramètres sous leur nom affiché (§ 5.2), par exemple `Brûlant[5/10/15]`, suivis de leur écriture transmise, notes de conception en retrait |
| Fiche d'une capacité | variantes par puissance, coûts, éléments propres, description ; **« octroyée par »** : les blocs qui la citent dans leur colonne des capacités (A3) |
| Fiche d'un élément | paramètres reçus, description ; **« porté par »** : blocs et capacités qui le citent, et blocs qui transmettent un paramètre qu'il reçoit (A4) |
| Anomalies | le rapport publié avec la banque ; `#/anomalies/Blocs/14` met en avant les anomalies d'une ligne |
| Espace auteur | clé GitHub ; import ; rapport ; différences ; publication ; changement de mot de passe |

Chaque fiche a une adresse (`#/capacite/Attaque%20de%20base`) qu'on peut
envoyer à un joueur. Un renvoi cassé s'affiche comme tel (texte barré, lien
vers l'anomalie), jamais comme un lien mort ; un morceau que la notation n'a
pas compris s'affiche tel qu'écrit, avec le même lien. Une adresse abîmée
mène à « page introuvable », comme les noms d'`Object.prototype`
(`#/constructor`, `#/__proto__`). Un nom introuvable propose le nom
approché ; il vient de l'adresse, que n'importe qui peut forger : il est
cité, coupé à 80 signes, et jamais mis en titre (« Fiche introuvable »).

**L'espace auteur.** Sans clé GitHub, il n'affiche que la saisie de la clé
(§ 8.1), avec la marche à suivre pour la créer, et le bouton « Publier ».

**Le bouton « Publier » est toujours visible** (décision de l'auteur,
28/09/2026, après l'essai 8). Il vit dans une barre collée au bas de
l'écran, avec « Comparer », ou « Annuler » pendant la confirmation : le
rapport d'un classeur réel est long (13 000 pixels, relevé du groupe 3), et
le bouton ne doit jamais se perdre dessous. Tant qu'il est inactif, il porte
sa raison en une ligne, la première qui tient : « Démonstration : rien n'est
publié. » ; « Clé GitHub absente : saisissez-la d'abord. » ; pendant une
attente, l'attente elle-même ; « Cochez la case « Je publie en connaissance
de cause ». » ; « Importez d'abord un classeur. » ; « Comparez d'abord. » À la première publication,
l'auteur choisit le mot de passe de table, deux fois, 20 signes au moins
(§ 7.3). Ensuite, la banque publiée se déchiffre avec la clé gardée, ou avec
le mot de passe, redemandé s'il a changé. Quand le rapport compte des
erreurs, la case « Je publie en connaissance de cause » s'affiche sous sa
liste complète, et le bouton « Publier » ne s'active qu'une fois cochée
(§ 6.3). Après la publication : « Publiée — visible par tous d'ici quelques
minutes », le message et le lien du commit. La page ouvre aussitôt la
nouvelle banque ; tant que GitHub Pages sert l'ancien fichier, l'accueil le
dit (§ 8.3). Le changement de mot de passe republie la banque publiée sous
le nouveau, avec le message « … — aucune différence — nouveau mot de passe
de table ».

**L'écran d'accueil du téléphone** (décision de l'auteur, 28/09/2026).
`manifest.webmanifest` : nom « L'Atelier des Arpenteurs », nom court
« Atelier », `display: standalone`, couleurs tirées des jetons (`--fond` du
thème clair). Il n'a pas de `start_url` : l'Atelier ajouté à l'écran
d'accueil s'ouvre à l'adresse d'où on l'a ajouté, si bien que la
démonstration ajoutée reste la démonstration. L'icône est un monogramme
« AA », en SVG et en PNG de 180 (iPhone), 192 et 512 pixels (Android), aux
couleurs des jetons, sans transparence ; ses lettres restent dans le disque
central, que garde la découpe « maskable » d'Android. Elle est fabriquée par
`outils/icones.js`, sans dépendance. Une aide courte, sur l'accueil,
explique l'ajout sur iPhone (Partager, puis « Sur l'écran d'accueil ») et
sur Android (menu, puis « Ajouter à l'écran d'accueil »). Elle dit de
l'ajouter **depuis l'accueil de l'Atelier**, et non depuis une fiche : sans
`start_url`, l'icône rouvre toujours la page d'où on l'a ajoutée (décision
de l'auteur, 28/09/2026). Elle disparaît quand l'Atelier est ouvert depuis
l'écran d'accueil. **Pas de service
worker** : l'Atelier ne s'ouvre pas hors connexion.

**Le chargement.** GitHub Pages sert chaque fichier avec `max-age=600` :
dix minutes après une mise à jour du site, un navigateur peut encore garder
d'anciens modules, qu'un module neuf ne sait pas lier (§ 2). `js/veille.js`,
un script classique sans import, vit hors du graphe des modules : au bout de
**15 secondes**, si l'écran montre encore un « Chargement » (marqué
`data-chargement`), il affiche « Mise à jour en cours : rechargez dans
quelques minutes », avec un bouton « Recharger » (décision de l'auteur,
28/09/2026). Relevé du groupe 3, dans Firefox : un module refusé laisse la
page sur « Chargement de l'Atelier… » ; à 16 secondes, le message est là.

**Le diagnostic**, repliable en bas de l'accueil : le mode (réel ou
démonstration) ; la date de la banque, son format (§ 7.1) et son empreinte
courte (12 chiffres) ;
la durée de la dernière dérivation de clé, en millisecondes, et sa date ; la
réponse à la demande de stockage durable, et s'il est accordé aujourd'hui ;
la clé gardée ou non ; le coffre (IndexedDB, ou la mémoire seule) ; le
navigateur. Un bouton le copie. Il sert à mesurer la dérivation sur
téléphone, et à aider un joueur à distance.

**La démonstration** (décision de l'auteur, 28/09/2026). La banque fictive
`essais/banque_demo.chiffree.json` vient du classeur d'essai, par le vrai
code d'import, de contrôle et de préparation de la publication
(`outils/banque_demo.js`, qui garde le sel de la précédente, § 7.1). Elle
n'entre jamais dans `donnees/`, qui reste vide jusqu'à la première vraie
publication. Elle s'ouvre par l'adresse du site suivie de `?demo=1` : un
bandeau permanent annonce « Démonstration — données fictives », et l'écran
du mot de passe affiche le mot de passe de démonstration, public,
`louche passoire marmite fouet`, avec un bouton qui le recopie. Sa clé se
garde à part de la clé réelle (§ 7.2). L'espace auteur y fonctionne sans clé
GitHub, contre la banque de démonstration, et ne publie rien. Sans
`?demo=1`, tant que `donnees/` est vide, le site affiche « Aucune banque
publiée pour l'instant », sans erreur, avec un lien vers la démonstration.

**Essayer sur le poste** : `node outils/serveur_local.js`, puis
`http://localhost:8080/` ou `http://localhost:8080/?demo=1`. Les modules ne
se chargent pas depuis un fichier ouvert directement.

---

## 10. Conventions

### 10.1 Le code

- Français partout : identifiants, commentaires, messages, clés JSON.
- Chaque module s'ouvre sur un commentaire qui dit ce qu'il fait, pourquoi il
  existe, et le § de cette spécification qui le fonde.
- Un commentaire dit une contrainte que le code ne montre pas, jamais ce que
  fait la ligne suivante.
- Toute la mise en page vit dans les variables de `css/jetons.css`.
- Une donnée inattendue est signalée (anomalie ou message), jamais avalée.
- `index.html` porte une **politique de sécurité**
  (`Content-Security-Policy`), placée avant tout script et tout style : tout
  vient du site lui-même (`default-src`, `script-src`, `style-src`,
  `img-src` : `'self'`), seules les connexions vers le site et vers
  `api.github.com` sont permises, et ni police, ni objet, ni `<base>`, ni
  travailleur, ni envoi de formulaire. Aucun script, style ni gestionnaire
  d'événement n'est écrit dans la page. **Aucune donnée n'est insérée comme
  HTML** : ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni
  `document.write` dans les fichiers du site (`index.html`, le manifeste,
  `css/`, `js/`) ni dans `outils/`, et un contrôle le vérifie (§ 11). Les
  écrans fabriquent leurs éléments par `js/ecrans/dom.js`, où chaque texte
  devient un nœud texte. `dom.js` refuse aussi un gestionnaire écrit en
  texte, les attributs `style` et `srcdoc`, et toute adresse (`href`, `src`)
  qui ne commence pas par `#/`, `?` ou `https://` : la politique de sécurité
  n'est pas la seule barrière. Raison : la clé et le jeton vivent dans
  IndexedDB, et une cellule de classeur contenant du HTML ne doit jamais
  s'exécuter.
- GitHub Pages sert chaque fichier du dépôt dans l'origine de l'Atelier, sans
  cette politique : la seule page est `index.html`, la seule image SVG
  l'icône, et un contrôle le vérifie. La directive `frame-ancestors` ne peut
  pas se poser dans un `<meta>`, et GitHub Pages n'envoie pas
  d'`X-Frame-Options` : la page peut être encadrée par un autre site.
  L'effet est limité, car un cadre tiers a son propre stockage, sans la clé
  ni le jeton (revue du groupe 3).

### 10.2 Les dépendances

Aucune au lot 1. Le navigateur fournit `DecompressionStream`,
`crypto.subtle`, `indexedDB`, `fetch` ; le XML se lit avec `js/lecture/xml.js`
(§ 6.1). Les contrôles demandent **Node 22 ou plus récent** (24 conseillé,
version LTS active), sur la machine de développement seulement ; l'outil des
essais emploie `node:zlib`, fourni avec Node (22.2 au moins, pour
`zlib.crc32`). Les outils de `outils/` n'emploient eux aussi que Node :
`node:zlib` pour les icônes, `node:http` pour le serveur local. Celui-ci
n'écoute que sur 127.0.0.1, refuse un en-tête `Host` qui n'est pas la
machine elle-même (rebinding DNS), et ne sert que les fichiers du site : ni
`.git/`, ni un dossier en point, ni les documents de travail, ni un JSON en
clair. Les écrans se contrôlent dans un document simulé, écrit pour le
projet (`tests/outils/dom_simule.js`), sans dépendance.

GitHub Actions emploie deux actions, **seules dépendances du dépôt** :
`actions/checkout` (récupérer le dépôt et son historique) et
`actions/setup-node` (installer Node). Elles sont publiées par GitHub et
**fixées sur un commit précis**, pour qu'une version nouvelle n'entre pas sans
relecture.

Toute dépendance future est justifiée ici, avant son arrivée.

### 10.3 Le dépôt et Git

- `.gitignore` : `*.xlsx`, avec la seule exception
  `!essais/classeur_essai.xlsx`, et les formats voisins d'un classeur
  (`.xls`, `.xlsm`, `.xlsb`, `.ods`, `.csv`) ; `*.docx` (le Word des
  règles), `.doc`, `.docm`, `.odt` et `.pdf` ; tout JSON, sauf
  `package.json`, `essais/banque_demo.chiffree.json`,
  `essais/banque_format1.chiffree.json` et `donnees/banque.chiffree.json` ; les documents de travail `ressources/` et `plans/` ; `système/`, le dossier
  du classeur réel, s'il venait dans le dépôt ; les fichiers que déposent
  Windows, OneDrive et Office (`desktop.ini`, `Thumbs.db`, les verrous `~$…`).
- **Le dépôt vit dans OneDrive** (décision de l'auteur). Le classeur réel et
  le Word restent hors du dépôt, dans le dossier `Système` voisin, et n'y sont
  jamais copiés. En cas d'erreur de verrou (`index.lock`, « Permission
  denied », fichier en cours d'utilisation) : s'arrêter, ne jamais effacer un
  verrou ni relancer en boucle, demander à l'auteur de suspendre la
  synchronisation OneDrive, puis réessayer une fois.
- `essais/classeur_essai.xlsx` : **contenu inventé**, qui reproduit chaque
  forme de la notation et chaque anomalie du § 6.3. Il est **fabriqué par un
  script** (`tests/outils/`), jamais saisi dans Excel (interdit 4). E1, qui
  arrête l'import, se déclenche sur des variantes que les contrôles fabriquent
  eux-mêmes : une feuille ôtée, un en-tête renommé. Il sert aux contrôles
  automatiques. Deux autres traits y figurent : une feuille écrite en XML
  préfixé (`x:row`), et une cinquième feuille, que l'import ignore, avec les
  formes de cellule qu'Excel n'écrit pas toujours (texte en ligne, texte
  enrichi, formule, booléen, erreur). Depuis le lot 2, chaque bloc y porte
  un type, écrit de plusieurs façons (« Equipement », « équipement »,
  « Archetype », espaces de bord), et le classeur a de quoi créer un
  personnage : un bloc de base dont les dégâts de mains nues sont une
  expression, deux espèces, deux archétypes avec un groupe de style et un
  groupe de maîtrise (éléments « Style de combat » et « Maîtrise »), trois
  constellations dont une sans capacité, deux primordiaux dont un sans
  capacité (l'autre a une capacité à trois puissances et un choix), des
  armes lourde, agile et précise, des armures sur les six zones dont deux
  sur le torse, un bouclier (paramètre `defense`), un consommable, et les
  éléments Arme, Lourde, Agile, Précise, Armure, Dégâts, Qualité, Portée,
  Défense. A8 et A9 se déclenchent sur des variantes, comme E1.
- Messages de commit en prose française : un titre, puis ce qui a changé, ce
  qui a été mesuré, ce qui a été laissé.
- **Le dépôt est public, l'historique aussi** : chaque commit porte le nom et
  l'adresse de son auteur. L'adresse configurée pour ce dépôt
  (`git config user.email`, sans `--global`) est l'adresse privée fournie
  par GitHub (`…@users.noreply.github.com`), jamais une adresse personnelle.
  Un contrôle vérifie que l'historique n'en contient pas d'autre.
- Sans `.nojekyll`, GitHub Pages passe le dépôt dans Jekyll, qui ignore les
  fichiers commençant par `_` et retarde chaque publication.
- **Un contrôle avant chaque envoi** (décision de l'auteur, 29/09/2026) : le
  crochet `.githooks/pre-push`, un script `sh` qui fonctionne sous Git pour
  Windows, lance `node --test` et refuse l'envoi au moindre échec, avec un
  message en français. Il s'installe une fois par poste, sans `--global` :
  `git config core.hooksPath .githooks`. Il ne se contourne jamais
  (`--no-verify`) : un envoi refusé se corrige. `.gitattributes` l'extrait
  toujours en fins de ligne LF, que `sh` exige. Les contrôles portant sur
  l'arbre de travail, le crochet refuse aussi l'envoi quand cet arbre n'est
  pas celui du dernier commit (modification non commitée, fichier non suivi) :
  ce qui est contrôlé est ce qui part. Il refuse enfin, en le disant, quand
  `node` est introuvable, et se défait de `NODE_TEST_CONTEXT`, qui ferait
  passer un échec pour un succès (revue du groupe 4).

---

## 11. Les contrôles

Lancés par `node --test`, en local et par GitHub Actions à chaque envoi.
Chaque contrôle nouveau se vérifie **armé puis désarmé**.

| Domaine | Contrôles minimaux |
|---|---|
| Lecture | le lecteur XML : entités, CDATA, noms locaux, fins de ligne, XML mal formé et DOCTYPE refusés ; le classeur d'essai donne les feuilles, en-têtes et cellules attendus, dont le texte enrichi, les retours à la ligne et les nombres ; un fichier qui n'est pas un ZIP, une archive tronquée, chiffrée, ZIP64 ou d'une méthode inconnue, un CRC faux, un classeur protégé par mot de passe, un XML abîmé donnent un message, pas une exception ; le classeur suivi correspond à sa description (`tests/outils/`) |
| Notation | chaque ligne du tableau du § 6.2, dont les accolades imbriquées et la virgule décimale ; une notation cassée donne E6 et garde le brut |
| Import | la banque du classeur d'essai a le format du § 5.1 ; colonnes retrouvées malgré la casse, les accents et l'ordre des en-têtes ; valeurs en chaînes, telles qu'écrites ; brut et `lisez_moi`, où une colonne nommée `__proto__` ou `constructor` reste ; ligne sans nom exclue ; fichier illisible : un message |
| Contrôle | le classeur d'essai déclenche **chaque** code du § 6.3 (E1, A8 et A9 sur ses variantes, § 10.3), et exactement les anomalies qu'il annonce, ligne par ligne ; un classeur propre n'en déclenche aucun ; gravités du § 6.3 et tri du § 6.4 ; la colonne « Type » attendue, les types comparés sans casse, accents ni espaces |
| Chiffrement | aller-retour, au format 2 du § 7.1 : l'empreinte est celle des octets chiffrés, vérifiée avant le déchiffrement, et change à chaque publication ; le format 1 se lit encore, son empreinte en clair vérifiée ; mauvais mot de passe refusé proprement ; fichier abîmé ou inconnu, ou en-tête hors des bornes du § 7.1 (itérations, sel, IV, données), ou dérivation refusée : un message ; une clé sous le plancher ne chiffre pas ; IV différent à chaque chiffrement ; sel inchangé tant que le mot de passe ne change pas ; la clé gardée déchiffre la publication suivante (§ 7.1), et un sel renouvelé la rend inutilisable ; normalisation du mot de passe ; 20 signes au moins ; coffre : seule une clé AES-GCM non extractible, clés réelle et de démonstration séparées, jeton à part (§ 7.2) |
| Publication | `fetch` simulé, **aucun appel réel à GitHub** : adresses, en-têtes et corps de la requête ; auteur et committer explicites, en adresse privée (§ 8.2) ; **première publication** : fichier absent, réponse 404, écriture sans `sha` ; mise à jour avec le `sha` lu ; refus pour `sha` périmé (409, ou 422 sans `sha`) : rechargement, nouvelles différences, nouvelle confirmation ; clé refusée (401), droits, réseau, JSON illisible, réponse qui n'est pas du JSON : un message ; écriture acceptée au corps perdu : un succès ; trois refus 422 : le motif du dernier ; contenu de plus d'un mégaoctet relu en brut |
| Dépôt | aucun `.xlsx` hors `essais/`, et chaque `.xlsx` d'`essais/` fabriqué, octet pour octet, par l'outil des essais ; le `.gitignore` ignore les classeurs, leurs formats voisins, les documents et tout JSON hors liste ; aucun autre format de classeur ou de document, aucun JSON hors liste ; une seule page (`index.html`), une seule image SVG (l'icône) ; dans tout l'historique, aucun fichier interdit et aucun jeton ; un jeton écrit en UTF-16 se voit ; workflow : actions fixées sur un commit avec leur version, `contents: read`, aucune écriture, `persist-credentials: false`, ni `pull_request_target` ni texte d'un événement ; **aucun `.docx`** ; `donnees/` (quelle que soit la casse) ne contient que `banque.chiffree.json`, sans autre champ que ceux du § 7.1, aux valeurs du § 7.1 (600 000 itérations, sel de 16 octets, IV de 12), au format 1 ou 2 (au format 2, l'empreinte est vérifiée sur les octets chiffrés ; dans `donnees/`, le format 1 n'est permis qu'au fichier publié le 29/09/2026), et des données qui ne se lisent pas comme du texte ; les banques d'`essais/` ont la même forme, la démonstration au format 2 et l'ancien format au format 1 ; le crochet `pre-push` existe, en `sh`, exécutable, extrait en LF, et `core.hooksPath` le désigne sur le poste (pas sur GitHub Actions, qui n'envoie rien) ; un envoi vers un dépôt d'essai est refusé quand un contrôle échoue (même avec `NODE_TEST_CONTEXT` hérité), quand tout n'est pas commité, ou sans `node`, et accepté sinon ; aucun **jeton GitHub entier** : un préfixe (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) suivi d'au moins 36 caractères alphanumériques ou soulignés, le contrôle fabriquant son faux jeton au moment de l'essai ; dans l'historique, des **auteurs** en `…@users.noreply.github.com`, des **committers** aussi ou en `noreply@github.com` (commits faits sur le site de GitHub), la ligne `Co-Authored-By` d'un message n'étant pas une adresse d'auteur ; ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni `document.write` dans les fichiers du site et dans `outils/` (§ 10.1) |
| Différences | ajout, modification champ par champ, retrait ; variantes de puissance ; ordre des lignes et écriture d'une même notation sans effet ; doublons ; résumé d'une ligne et ses accords ; dates ; le type d'un bloc, et une banque publiée avant la colonne « Type » |
| Préparation | première publication, mise à jour sous le même secret ; mot de passe à choisir, à saisir ou changé ; E1 refusé ; changement de mot de passe ; circuit complet, de l'import à la lecture par un joueur |
| Routes et fiches | décodage des adresses de fiche (`#/capacite/Attaque%20de%20base`) et aller-retour des noms difficiles ; adresses abîmées, dont les noms d'`Object.prototype` ; un nom introuvable n'est jamais le titre ; recherche sans casse ni accents, sur les noms et les descriptions ; renvois résolus comme au contrôle ; « octroyée par », « porté par », nom affiché ; anomalies d'une ligne |
| Site | politique de sécurité du `<meta>`, avant scripts et styles, toute la table des directives et rien d'autre ; zoom permis ; ni script, ni style, ni gestionnaire en ligne ; chaque fichier appelé existe ; le graphe des modules se résout et atteint les huit écrans ; manifeste, couleurs des jetons, icônes aux tailles dites, telles que les dessine leur outil ; contrastes ; valeurs de `ecran.css` tirées des jetons, aucune police téléchargée ; la banque de démonstration, au format 2, se déchiffre et vient du classeur d'essai ; le fichier d'essai au format 1 vient du classeur d'essai, et la page l'ouvre ; au téléchargement, une empreinte de format 2 fausse et un format plus récent donnent leur message ; le diagnostic dit le format ; chargement : absente, présente, abîmée, `?v=`, clé gardée, mot de passe requis ou changé, stockage durable ; l'attente du mot de passe ne dépend pas de la peinture de la fenêtre ; le déverrouillage n'attend pas la réponse sur le stockage durable ; sans IndexedDB, la phrase au lieu de la case ; une erreur inattendue : un message. Dans un document simulé : le bouton « Publier » existe dans chaque état de l'espace auteur, et sa raison s'affiche ; la barre de publication reste collée au bas de l'écran ; « Oublier le mot de passe » ne laisse ni clé ni différences, même pendant une comparaison ; « Oublier la clé GitHub » annule la publication en attente ; « Se souvenir » décide de garder la clé ; la veille de 15 secondes, et rien sur une page chargée ; l'aide dit d'ajouter l'Atelier depuis son accueil ; `dom.js` refuse gestionnaires en texte, `style`, `srcdoc` et adresses étrangères. Le serveur local : la seule machine, les seuls fichiers du site |

Les contrôles du dépôt portent sur les fichiers suivis et sur ceux que Git
suivrait, c'est-à-dire non ignorés : une faute se voit avant d'être commitée.

**Les bancs** (§ 6.3) ne font pas partie de `node --test` : ils demandent le
classeur réel, qui n'est pas dans le dépôt. Le banc de lecture se lance dès que
`xlsx.js` existe, avant la notation ; le banc complet, une fois l'import et le
contrôle écrits.

---

## 12. Ce que les sources doivent contenir

Au fil des lots, ce qui manque dans le Word ou les classeurs pour que le
programme puisse avancer. **L'auteur l'écrit dans la source, pas en
conversation.**

**Pour le lot 1 (recommandé, non bloquant)**

- `lisez_moi` : une capacité à plusieurs puissances peut occuper plusieurs
  lignes de même nom ; la clé est alors (nom, puissance) (§ 5.1).
- `Blocs` : une **colonne de type légale** (Espèce, Archétype, Style de
  combat, Constellation, Primordial, Arme, Armure, Consommable, Équipement,
  Blessure, État, Base), sans quoi les listes ne peuvent pas regrouper les
  blocs par type. Quand elle existera, le bloc sans capacité (I3) remontera
  en avertissement pour certains types seulement, que l'auteur désignera.
- La notation vit à la fois dans `lisez_moi` et dans le chapitre « Système »
  du Word. Un seul endroit : une annexe du Word, vers laquelle `lisez_moi`
  renvoie.
- À écrire dans le Word, chapitre « Système », ou dans `lisez_moi` : quand un
  bloc transmet un paramètre sans cible et le même paramètre avec une cible
  (cas de Hache légère, `{portee:…}` deux fois), lequel vaut pour la capacité
  visée ? Tant que ce n'est pas écrit, le contrôle signale l'ambiguïté (E7).
  Et une cible doit-elle être une capacité du bloc ? Celle de Hache légère
  n'est pas une capacité (E4).

**Pour le lot 2 — créateur d'adversaire**, section « Caractéristiques d'un
adversaire » du Word : ce que sont son attaque et sa défense ; son nombre
d'actions ; ses dégâts ; son armure, sa résistance et son corps par zone ; la
règle de construction d'une grille de localisation propre ; le sort de ses
blessures.

**Pour le lot 3 — objets, sorts, équipement** : ce qu'est un sort (le mot
n'apparaît pas dans le Word) ; la grammaire des expressions (opérateurs,
virgule décimale, `N`, `X`, arrondis) ; le type de bloc.

**Pour le lot 4 — personnage** : la procédure de création complète (la
section « Création et progression » s'interrompt) ; l'équipement de départ ;
le primordial lié et la jauge initiale ; le dé de défense sans armure ;
l'articulation entre montée de niveau et points d'expérience.

---

## 13. Les lots

| Lot | Contenu | Attend |
|---|---|---|
| **1 — Socle** | lecture, notation, contrôle, chiffrement, publication, consultation, contrôles, GitHub Actions | rien |
| 2 — Adversaire | second classeur, créateur, assistant de calibrage, PDF quatre par feuille | § 12, lot 2 |
| 3 — Objets, sorts, équipement | créateur, « Copier comme lignes Excel » | § 12, lot 3 |
| 4 — Personnage | créateur, vue téléphone, vue fiche zoomable, code QR vers le téléphone, PDF | § 12, lot 4 |
| 5 — Finitions | fiche de jeu à compteurs, PDF sur téléphone, annulation d'une publication | — |

**Le lot 1 est terminé** (29/09/2026, spécification 1.0). Ses critères :

- l'auteur a publié le classeur réel depuis son ordinateur : le 29/09/2026 à
  7 h 19 (commit `d25aa2a`, 67 blocs, 69 capacités, 19 éléments, publiée
  malgré 15 erreurs) ;
- « un joueur l'a ouvert sur son téléphone » : **critère levé par
  l'auteur**, son propre essai en tient lieu (mode réel, Android 15,
  Firefox 156, dérivation en 119 ms, le 29/09/2026 à 7 h 29, clé gardée,
  stockage durable accordé) ;
- le banc du § 6.3 a retrouvé exactement les comptes de référence le
  28/09/2026 (groupes 1 et 2). Le 29/09, sur le classeur que l'auteur a
  corrigé depuis, il trouve 129 anomalies, et moins que la référence en E4
  (8 noms sur 9) et en A3 (1 sur 2) : une même citation corrigée,
  « Maîtrise du combat précise », retire les deux ;
- tous les contrôles passent, et chacun a été vu échouer une fois.

**Ce qui ne dépend que de l'auteur, au lot 1** : créer le compte GitHub et le
dépôt public (fait) ; activer GitHub Pages, branche `main`, racine (fait le
28/09/2026) ; créer le jeton à portée fine (fait, valable un an) ; choisir le
mot de passe de table (fait) et le transmettre aux joueurs.

**Le déroulement du lot 1** (plan validé par l'auteur le 28/09/2026). Huit
étapes, réunies en trois groupes. L'auteur valide à la fin de chaque groupe,
jamais entre deux étapes d'un même groupe. La spécification prend **un numéro
de version par groupe**, à la fin du groupe ; l'entrée du § 14 en détaille
les étapes (décision de l'auteur, 28/09/2026). Le groupe 3 a été redéfini
par l'instruction du 28/09/2026 : revue de sécurité et corrections, sans
rien publier ; l'étape H vient ensuite, faite par l'auteur. Une relecture à
plusieurs agents est permise dans un cadre écrit dans `CLAUDE.md` (trois
relecteurs au plus, une seule liste, l'agent principal corrige).

| Groupe | Étapes |
|---|---|
| 1 | A — socle du dépôt et spécification 0.3 ; B — lecture du classeur ; C — notation ; D — import, contrôle et banc |
| 2 | 0 — virgule décimale, A6 devenu I3 ; E — chiffrement et coffre ; F — différences et publication ; G — écrans, écran d'accueil, démonstration, diagnostic, mise en ligne sur GitHub Pages |
| 3 | revue de sécurité à trois relecteurs, et correction de ses constats ; corrections de l'essai 8 (le bouton « Publier » toujours visible), de l'attente sur « Chargement » et de l'aide pour l'écran d'accueil ; préparation de H |
| H | mise en service, faite par l'auteur et guidée par Claude : jeton valable un an, mot de passe de table, première publication (29/09/2026, 7 h 19), essai sur téléphone |
| 4 | clôture : vérification de la première publication (en-tête, commit, historique sans donnée réelle, fichier servi) ; empreinte sur le fichier chiffré (format 2) ; crochet `pre-push` ; un relecteur ; spécification 1.0 |

La suite : **un numéro de version par groupe**, 1.1, 1.2…

---

## 14. Révisions

**1.0 — 29/09/2026.** Groupe 4, clôture du lot 1 : le lot 1 est en service.

- Première publication réelle vérifiée : `donnees/` ne contient que la
  banque chiffrée, à l'en-tête conforme au § 7.1 ; commit en adresse privée,
  message du § 8.2 ; aucun fichier interdit ni aucun nom réel hors des
  exemples de la spécification dans l'historique ; fichier servi par GitHub
  Pages identique octet pour octet.
- Format 2 : l'empreinte porte sur les octets chiffrés ; le format 1 se lit
  encore, jusqu'à une publication réelle au format 2 confirmée (§ 7.1) ;
  banque de démonstration au format 2, fichier d'essai figé au format 1
  (§ 3.2).
- Crochet `pre-push` et `.gitattributes` (§ 3.2, § 10.3). Mesure de l'auteur
  en mode réel (§ 7.2). Lot 1 terminé, critère du téléphone levé par
  l'auteur, banc relevé sur le classeur corrigé (§ 13). Contrôles (§ 11).
  Désormais, un numéro par groupe : 1.1, 1.2…
- Relecture (un relecteur, cryptographie et compatibilité des formats),
  aucun constat critique ni important. Corrigés : le crochet se défait de
  `NODE_TEST_CONTEXT`, refuse un arbre non commité, et dit « node
  introuvable » (§ 10.3) ; l'empreinte se vérifie dès le téléchargement ;
  un format plus récent dit « rechargez la page » (§ 7.1) ; le diagnostic
  dit le format (§ 9) ; le format 1 de `donnees/` est épinglé au fichier du
  29/09/2026 (§ 11). La taille qui se voit (§ 7.3), l'IV hors de l'empreinte
  (§ 7.1).

**0.8 — 28/09/2026.** Groupe 3 du lot 1 : revue de sécurité, corrections,
préparation de H.

- Revue de sécurité par trois relecteurs (secrets ; cryptographie et
  publication ; surface d'attaque). Constats importants corrigés : un
  en-tête hors bornes figeait l'écran, d'où les bornes de lecture (§ 7.1) ;
  « Oublier le mot de passe » laissait une copie de la clé dans l'espace
  auteur (§ 7.2) ; un classeur réel posé dans `essais/` aurait été publié
  (§ 10.3, § 11). Mineures corrigées : coffre réservé aux clés AES-GCM ;
  « Se souvenir » respecté par l'espace auteur ; phrase sans IndexedDB
  (§ 7.2) ; oubli de la clé GitHub (§ 8.1) ; réponses de GitHub illisibles,
  motif du 422 (§ 8.2) ; noms d'`Object.prototype` dans les adresses, nom
  introuvable jamais en titre (§ 9) ; `dom.js` et pages servies (§ 10.1) ;
  serveur local (§ 10.2) ; `.gitignore`, formats, historique, workflow
  (§ 10.3, § 11). L'empreinte en clair est nuancée (§ 7.1). Sa décision
  reste ouverte.
- Corrections : le bouton « Publier » toujours visible, dans une barre
  collée, avec sa raison (§ 9) ; la veille de 15 secondes (§ 2, § 3.2,
  § 9) ; l'aide pour l'écran d'accueil (§ 9) ; le déverrouillage n'attend
  plus la réponse de Firefox sur le stockage durable (§ 9).
- Mesures de l'auteur : dérivation en 123 ms sur Android 15 et Firefox 156,
  stockage durable accordé (§ 7.2). Jeton valable un an (§ 8.1). Première
  vraie publication dès la fin du groupe (§ 2). Déroulement (§ 13) et
  contrôles (§ 11).

**0.7 — 28/09/2026.** Groupe 2 du lot 1. Désormais, un numéro de version
par groupe, à la fin du groupe (§ 13).

- Étape 0 : un nombre de cellule s'écrit avec une virgule décimale (§ 5.1,
  § 6.1). Le bloc sans capacité passe en information, sous le code I3 ; A6
  est retiré et ne sera pas réutilisé (§ 6.3). Il remontera en
  avertissement pour certains types, avec la colonne de type (§ 12). Le
  contrôle des gravités lit le tableau du § 6.3.
- Étape E : le mot de passe se normalise ; l'empreinte se vérifie après le
  déchiffrement ; un fichier abîmé ou un mot de passe faux donnent un
  message (§ 7.1). Le coffre garde la clé non extractible avec son sel, ses
  itérations et la durée de sa dérivation ; la clé réelle et celle de la
  démonstration séparément ; le jeton à part ; la mémoire seule sans
  IndexedDB (§ 7.2). Les 20 signes se comptent après normalisation (§ 7.3).
- Étape F : ce que comparent les différences, et comment elles
  s'affichent ; le résumé d'une ligne et ses accords (§ 6.4). Lecture sans
  cache, et en brut au-delà d'un mégaoctet ; sha périmé par 409, ou par 422
  sans sha ; trois essais ; en-têtes et messages (§ 8.2). `dates.js`
  (§ 3.2).
- Étape G : aspect sobre, jetons et contrastes ; écrans précisés ; espace
  auteur ; écran d'accueil du téléphone, avec un manifeste sans
  `start_url` et le monogramme « AA » ; diagnostic ; démonstration, dont
  le mot de passe public est la seule exception à l'interdit 3 (§ 0, § 9).
  Politique de sécurité détaillée ; contrôle des insertions de HTML étendu
  aux fichiers du site et aux outils (§ 10.1). Outils sans dépendance
  (§ 10.2), nouveaux fichiers (§ 3.2). Contrôles Préparation, Routes et
  fiches, Site (§ 11). Déroulement du groupe 2 (§ 13).

**0.6 — 28/09/2026.** Étape D, import et contrôle. Ce que visent E3, E4
(cibles comprises), E7 (un paramètre sans cible vaut pour toutes les
capacités du bloc), A1, A3, A4 (paramètre transmis) et A5 (§ 6.3). Résultat
du banc complet : la mesure de référence est retrouvée exactement (§ 6.3).
Ligne sans nom, `lisez_moi` tel qu'écrit, empreinte de la source (§ 5.1).
Contrôles d'import et de contrôle (§ 11). La question de Hache légère est à
écrire dans le Word (§ 12).

**0.5 — 28/09/2026.** Étape C, notation (§ 6.2). La colonne « Paramètres
reçus » s'écrit `{nom}`, comme dans le classeur réel. Espaces de bord
retirés ; choix d'une seule option ; morceau vide sans donnée. A7 vaut aussi
pour un choix écrit dans la colonne des éléments. Liste de ce qui donne E6
(§ 6.2, § 6.3).

**0.4 — 28/09/2026.** Étape B, lecture du classeur. `lisez_moi` compte 19
lignes non vides, de la ligne 2 à la ligne 20 ; le « 20 » de la 0.3 était le
numéro de la dernière ligne (§ 4.1). Résultat du banc de lecture et de la
lecture indépendante par Python (§ 4.1). Forme des cellules : 15 chiffres
significatifs, `VRAI`/`FAUX`, code d'erreur, `_xHHHH_` ; message du classeur
protégé ou au format `.xls` (§ 6.1). Contenu du classeur d'essai (§ 10.3) et
contrôles de lecture (§ 11).

**0.3 — 28/09/2026.** Plan du lot 1 validé, en trois groupes d'étapes
(§ 0, § 13). Interdits 2 et 4 précisés : exemples réels non confidentiels,
classeur d'essai fabriqué par script (§ 0, § 10.3). Sel gardé jusqu'au
changement de mot de passe, IV neuf à chaque publication, clé gardée avec son
sel (§ 7.1, § 7.2). Origine réservée à l'Atelier et limite de Safari (§ 7.3).
Auteur et committer explicites, première publication sans `sha` (§ 8.2). Un
seul lecteur XML, qui compare les balises par leur nom local (§ 6.1).
Politique de sécurité, aucune insertion de HTML (§ 10.1). Actions de GitHub
fixées sur un commit, Node 24 conseillé (§ 10.2). Dépôt dans OneDrive et ses
précautions ; `.gitignore` étendu au Word, aux documents de travail, à
`système/` et aux fichiers de Windows et d'Office (§ 10.3). Nouveaux fichiers
(§ 3.2). Contrôles : jetons entiers, adresses des auteurs et des committers,
`.docx`, insertions de HTML, publication, bancs de lecture et complet (§ 6.3,
§ 11). GitHub Pages activé (§ 13). Trois décisions en tableau (§ 2).

**0.2 — 28/09/2026.** Nom validé (« L'Atelier des Arpenteurs », dépôt
`atelier-des-arpenteurs`) ; publication malgré des erreurs validée (§ 6.3) ;
fichier `.nojekyll` (§ 3.2) ; adresse privée GitHub pour les commits et son
contrôle (§ 10.3, § 11) ; dates corrigées (le relevé du classeur est du
28/09).

**0.1 — 28/09/2026.** Création. Architecture (GitHub Pages, code public,
données chiffrées, import dans la page, deux classeurs, Word qui fait foi) ;
détail du lot 1 ; mesure de référence du classeur.
