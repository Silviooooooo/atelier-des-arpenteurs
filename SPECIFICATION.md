# L'Atelier des Arpenteurs — spécification

**Version 1.2 — 30/09/2026.** Le lot 1 est en service ; le lot 2, le
créateur de personnage (§ 15), et le lot 2 bis, ses améliorations et les
personnages en ligne (§ 15.8), sont livrés. Ce document fait foi pour le code. Toute décision
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
| second classeur (lot 3, nom à fixer) | adversaires et prétirés | oui, à l'import |

**Le programme n'invente aucune règle.** Quand un lot a besoin d'une règle que
le Word ne dit pas, on ne la devine pas : on l'inscrit au § 12 comme « à
écrire dans le Word, section … », et on s'arrête sur ce point. L'auteur ne
répond pas aux questions de règles en conversation ; il les écrit dans le Word.

**Les cinq interdits.**

1. **Aucun classeur réel dans le dépôt.** Le dépôt est public. Seuls les
   classeurs d'essai fictifs de `essais/` y entrent (§ 10.3).
2. **Aucune donnée réelle en clair dans le dépôt**, hors les exemples de
   cette spécification, réels mais non confidentiels (décision de l'auteur,
   28/09/2026), et la légende des huit primordiaux du modèle de fiche,
   reproduite sur la fiche de personnage (décision de l'auteur, 29/09/2026,
   § 15.4). La banque publiée est chiffrée (§ 7), les personnages en ligne
   aussi (§ 15.8) ; des contrôles le vérifient.
3. **Aucune clé ni aucun mot de passe dans le code** ni dans un fichier
   versionné. Ils se saisissent dans la page, sur l'appareil de la personne.
   Seule exception : le mot de passe de la démonstration, public par
   décision de l'auteur, qui n'ouvre que des données fictives (§ 9). La clé
   de dépôt des personnages (§ 8.4) n'existe, hors de l'appareil de
   l'auteur, que dans la banque chiffrée.
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
2. Un **créateur de personnage** (lot 2, § 15), dont les personnages se
   partagent en ligne, chiffrés (lot 2 bis, § 15.8).
3. Un **créateur d'adversaire** (lot 3).
4. Un **créateur d'objets, de sorts et d'équipement** (lot 4).
5. L'**export PDF** de chaque création, depuis un ordinateur ; la vue d'un
   personnage sur téléphone, adaptée à l'écran et zoomable.

**Hors périmètre.** Serveur, base de données, comptes utilisateurs (les
personnages en ligne passent par des tickets GitHub et un automate de
GitHub, § 15.8). Écriture
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
| Le **créateur de personnage** est le lot 2, avant l'adversaire (lot 3) et les objets et sorts (lot 4) | décision de l'auteur, 29/09/2026 |
| Les **règles chiffrées du personnage vivent dans le code**, chacune avec la section du livret qui la fonde | le livret n'est pas lu par le programme ; une règle se retrouve ainsi dans sa source (§ 15.2) |
| Un **personnage garde ses choix, pas des copies** de la banque | sa fiche suit la banque du jour et en imprime la date ; un fichier ou un lien ne transporte aucune donnée de la banque (§ 15.1) |
| Le personnage part vers le téléphone **dans le fragment de l'adresse** | aucun serveur ; le fragment n'est jamais envoyé ; le code QR viendra plus tard (§ 15.1) |
| Les **polices du modèle de fiche** (Marcellus, Alegreya Sans) sont **hébergées dans le dépôt** | la fiche imite le modèle ; aucune connexion à un tiers, que la politique de sécurité interdit (§ 15.4) ; licence OFL |
| Les **personnages en ligne passent par une file d'attente** : un ticket GitHub ouvert avec une clé de dépôt (permission Issues seule), qu'un automate de GitHub range dans le dépôt | le site ne détient aucun droit d'écriture sur le code ni sur la banque ; pas de serveur à entretenir (décision de l'auteur, lot 2 bis, option B ; § 15.8) |
| Les personnages en ligne sont **chiffrés avec la clé de table**, visibles par tous les joueurs qui ont le mot de passe, et **modifiables par tous** | rien en clair sur GitHub ; une table de confiance ; l'historique de GitHub garde chaque version, et l'auteur peut en restaurer une (décision de l'auteur, lot 2 bis) |
| Le **mot de passe de table** : 8 signes au moins, **insensible aux majuscules** | plus simple à transmettre et à saisir sur un téléphone ; risque accepté par l'auteur (§ 7.3) |

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

Joueur : un personnage enregistré (lot 2 bis, § 15.8)
  └─ chiffré avec la clé de table, dans un ticket GitHub (clé de dépôt, Issues seule)
       └─ automate de GitHub (workflow « Personnages ») : vérifie, range dans personnages/, commite
            └─ construction de GitHub Pages demandée → visible par tous d'ici quelques minutes
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
  personnage.css            l'écran d'un personnage : vue lecture, vue fiche
  fiche.css                 la fiche imprimable, reproduction du modèle (§ 15.4)
polices/                    Marcellus et Alegreya Sans (woff2), et leurs licences OFL
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
  personnage/               le créateur de personnage (§ 15)
    regles.js               les règles chiffrées, chacune avec sa section du livret
    expressions.js          les expressions du classeur, en fractions exactes
    calcul.js               la fiche d'un personnage, recalculée avec la banque du jour
    parcours.js             ce qui manque à chaque étape, montées permises, tirage
    format.js               le fichier *.arpenteur.json, sa vérification, le lien
    suivi.js                les choix modifiés ou disparus depuis l'enregistrement
    stockage.js             les personnages de l'appareil (IndexedDB), réel et démonstration séparés, et leurs notes
    packs.js                les packs d'armure, partagés par le créateur et le contrôle (A10)
    en_ligne.js             les personnages en ligne : ticket, fichier rangé, index, chiffrement (§ 15.8)
    depot.js                côté page : déposer, lire l'index et les fichiers, l'état de chaque dépôt
  fiche/
    feuilles.js             le recto (le modèle) et le verso imprimables
    repartition.js          ce qui tient au recto, ce qui passe au verso
    lecture.js              la vue lecture, pour un téléphone
  publication/
    github.js               API GitHub : lecture de l'empreinte, écriture, commit par l'API Git Data
    preparation.js          différences, message et chiffrement d'une publication, clé de dépôt
    personnages.js          inventaire et rechiffrement des personnages en ligne (§ 8.4)
  ecrans/
    accueil.js  mot_de_passe.js  liste.js  fiche_bloc.js
    fiche_capacite.js  fiche_element.js  anomalies.js  espace_auteur.js
    personnages.js  creation.js  reception.js  fiche_personnage.js
    partage.js              fichier et lien d'un personnage
    dom.js                  fabrique des éléments, sans jamais insérer de HTML
donnees/
  banque.chiffree.json      la banque réelle, chiffrée
personnages/                les personnages en ligne, chiffrés, que range l'automate (§ 15.8)
  <identifiant>.chiffre.json  identifiant, dates, numéro de ticket, sel, IV, contenu chiffré
  index.json                identifiants, dates de rangement, versions ; aucun nom
essais/
  classeur_essai.xlsx       classeur FICTIF, contenu inventé, fabriqué par tests/outils/
  banque_demo.chiffree.json la banque de démonstration, tirée du classeur d'essai, au format 2 (§ 9)
  personnage_demo.arpenteur.json  le personnage de démonstration, fictif, prêt à imprimer (§ 15.7)
outils/
  icones.js                 fabrique les icônes, sans dépendance
  banque_demo.js            fabrique la banque de démonstration
  personnage_demo.js        fabrique le personnage de démonstration
  serveur_local.js          sert le site sur le poste, à la seule machine, pour l'essayer avant l'envoi ; personnages/ sous ses deux seules formes
  automate_personnages.js   l'automate des personnages : range les tickets, ne commite que dans personnages/ (§ 15.8)
tests/
  *.test.js                 contrôles, lancés par `node --test`
  outils/                   fabrique de classeurs, description du classeur d'essai, personnage d'essai, document simulé des écrans
  banc_classeur_reel.js     bancs sur le classeur réel (§ 6.3), lancés à la main
.github/workflows/
  controles.yml             lance les contrôles à chaque envoi
  personnages.yml           lance l'automate à l'ouverture d'un ticket, ou à la main (§ 15.8)
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

Adversaires et prétirés. Sa structure est définie au lot 3, à partir du
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
- `cle_depot` (lot 2 bis), en dernier champ : le jeton qui permet de
  déposer les personnages en ligne (§ 8.4, § 15.8). Le champ n'existe que
  s'il a une valeur. Il ne vient jamais de la banque importée : seule la
  décision de l'auteur, dans l'espace auteur, l'y met, l'y garde ou l'en
  retire. Les différences (§ 6.4) et le message de commit l'ignorent.

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
| E7 | erreur | même paramètre transmis deux fois par un bloc sans cible, ou deux fois vers la même capacité : une capacité en recevrait deux valeurs. Un paramètre ciblé à côté du même paramètre sans cible est admis : il vaut pour sa capacité, le sans-cible pour les autres (`lisez_moi`, la Hache légère ; décision de l'auteur, lot 2 bis) |
| A1 | avertissement | renvoi qui ne diffère que par la casse, les accents ou les espaces : capacité, cible, élément ou paramètre |
| A2 | avertissement | paramètre transmis qu'aucun élément ne reçoit (`lisez_moi` : un paramètre implique son élément) |
| A3 | avertissement | capacité rattachée à aucun bloc : citée dans la colonne des capacités d'aucun bloc (une cible ne rattache pas, un choix gardé en brut non plus) |
| A4 | avertissement | élément défini, porté par rien : cité par aucun bloc ni aucune capacité, et reçu d'aucun paramètre transmis (`lisez_moi` : un bloc qui transmet un paramètre porte l'élément lié) |
| A5 | avertissement | paramètre invoqué dans une description (`{portee}`) que ni la capacité ni ses blocs ne portent : ni un élément propre qui le reçoit, ni un bloc qui la cite et le transmet ou porte un élément qui le reçoit, sans cible ou avec elle pour cible |
| A7 | avertissement | choix de capacités écrit hors de la colonne des capacités |
| A8 | avertissement | bloc sans type (colonne « Type » vide) : le créateur de personnage ne le voit pas |
| A9 | avertissement | bloc d'un type inconnu, qui n'est aucun des types reconnus (§ 4.1) : le créateur de personnage ne le voit pas |
| A10 | avertissement | un type d'armure (lourde, agile, précise) compte deux pièces qui couvrent une même zone : son pack d'armure n'est pas proposé au créateur (§ 15.3). Une pièce couvre une zone quand la valeur écrite à ce rang de son paramètre `armure` n'est pas zéro |
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
- E7 : Hache légère transmet `{portee:0}` et `{portee:1}` sans cible (depuis
  le lot 2 bis, E7 admet un paramètre ciblé à côté du même sans cible : la
  Hache légère, dont le `{portee:1}` vise une capacité, **n'est plus
  signalée** ; le banc le vérifie, et le 30/09/2026 il ne trouve aucun E7 sur
  le classeur réel) ;
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
  espaces de bord retirés, puis **minuscules** (décision de l'auteur, lot
  2 bis), et NFC de nouveau (« İ » en minuscule n'est plus en NFC). Un « é »
  s'écrit en un ou deux caractères selon l'appareil, un clavier de téléphone
  ajoute volontiers une espace en fin de mot, ou une majuscule en tête : le
  même mot de passe doit donner la même clé partout. La règle vaut à la
  publication comme à la saisie ; les deux saisies d'un nouveau mot de passe
  se comparent normalisées. Les champs du mot de passe portent
  `autocapitalize="none"`, `autocorrect="off"` et `spellcheck="false"`.
- **La banque en place reste lisible** : elle a été chiffrée sous la forme
  exacte, sans minuscules. À la saisie, la page dérive d'abord en
  minuscules ; si la clé n'ouvre pas la banque et que la forme exacte
  diffère, elle dérive une seconde fois sous la forme exacte (une dérivation
  de plus, seulement dans ce cas). La clé qui ouvre est gardée, et l'auteur
  publie avec elle sous la même forme. **Le prochain changement de mot de
  passe** publie la banque sous la nouvelle règle ; ce repli pourra se
  retirer au groupe qui suivra ce changement, confirmé par l'auteur. Le mot
  de passe de démonstration, déjà en minuscules, garde sa clé.

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
version suivante (revue du groupe 3). La publication réelle du 29/09/2026 à
22 h 14 est au format 2 : **la lecture du format 1 est retirée** (lot 2 bis,
décision de l'auteur). Un fichier au format 1 se dit « abîmé ou d'un format
inconnu », avant toute dérivation. Le fichier figé
`essais/banque_format1.chiffree.json` a quitté le dépôt ; l'historique le
garde, et le contrôle du dépôt ne l'y permet plus que là.

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
- L'auteur publie avec la clé qu'il a gardée, sans ressaisir le mot de
  passe.
- La clé de dépôt des personnages (§ 8.4) ne se garde ni dans le coffre ni
  dans `localStorage` : elle voyage dans la banque chiffrée, et celle que
  l'auteur vient de saisir attend en mémoire la prochaine publication.
- Les personnages en ligne se chiffrent avec la clé de table gardée : elle
  sait chiffrer comme déchiffrer (§ 15.8).
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
  est public : n'importe qui peut essayer des mots de passe hors ligne, sans
  limite. **Un mot du dictionnaire se devine en quelques secondes** ;
  « abrasia » ou un prénom aussi. L'espace auteur refuse un mot de passe de
  moins de **8 signes**, comptés après la normalisation du § 7.1, sans
  exiger de chiffre, de majuscule ni de signe, et la casse ne compte pas
  (décision de l'auteur, lot 2 bis). **C'est un risque que l'auteur
  accepte** : 8 signes en minuscules se trouvent bien plus vite que la
  phrase de 20 signes demandée jusqu'au lot 2. **Conseil** : deux ou trois
  mots sans rapport, collés (« marmitepoivrelanterne »).
- **Les personnages en ligne** (§ 15.8) sont chiffrés avec la même clé :
  qui trouve le mot de passe les lit aussi. Tout joueur qui a le mot de
  passe a aussi la clé de dépôt, dans la banque : il peut créer, modifier
  et supprimer n'importe quel personnage en ligne (décision de l'auteur,
  lot 2 bis) ; l'historique de GitHub garde chaque version, et l'auteur peut
  en restaurer une. La clé de dépôt agit **au nom de l'auteur** dans les
  tickets de ce dépôt : qui l'a peut y écrire des textes publics (tickets,
  commentaires), en fermer ou en rouvrir, et rouvrir un ancien dépôt, que
  l'automate rejoue ; elle n'écrit ni dans le code ni dans la banque
  (relecture du lot 2 bis). Si elle fuit, l'auteur la révoque et en publie
  une autre. **Un joueur écarté par un changement de mot de passe** garde la
  clé de dépôt qu'il a pu lire : pour l'écarter aussi en écriture, l'auteur
  remplace la clé de dépôt au même changement, puis révoque l'ancienne.
- **L'historique garde les anciennes versions**, chiffrées avec le mot de
  passe de leur époque. Changer de mot de passe protège les publications
  suivantes, pas les précédentes : un joueur qui part garde l'accès à ce
  qu'il a déjà pu lire.
- **Changer de mot de passe** : l'espace auteur le fait en une action : la
  banque publiée est republiée sous le nouveau mot de passe, et les
  personnages en ligne sont rechiffrés avec elle, dans le même commit
  (§ 8.4). L'auteur transmet ensuite le nouveau mot de passe.
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

### 8.4 La clé de dépôt et le rechiffrement des personnages (lot 2 bis)

**La clé de dépôt** est un jeton GitHub à portée fine, créé par l'auteur,
distinct de sa clé GitHub (§ 8.1) : limitée à ce seul dépôt, à la
**permission Issues en lecture et écriture, rien d'autre**, valable un an.
Elle permet aux joueurs de déposer des personnages (§ 15.8). Elle se saisit
dans la section « Clé de dépôt des personnages » de l'espace auteur, dans un
champ masqué ; sa forme est vérifiée (`github_pat_` suivi de 20 à 255
signes). Elle attend **en mémoire** la prochaine publication ou le prochain
changement de mot de passe : ni coffre, ni `localStorage` ; « Oublier le
mot de passe » et « Oublier la clé GitHub » l'oublient. Elle n'est jamais
affichée : l'écran dit seulement si la banque publiée en porte une, et si
une nouvelle clé attend. L'auteur la garde (par défaut), la remplace ou la
retire ; elle **voyage dans la banque chiffrée** (champ `cle_depot`, § 5.1),
si bien que seuls les porteurs du mot de passe l'ont, et qu'elle n'est
jamais en clair nulle part. Partie avec la banque, elle quitte l'espace
auteur. Une clé de forme invalide ne part jamais. **Elle ne peut pas être la
clé GitHub de l'auteur** : les deux ont la même forme et se créent sur le
même écran de GitHub, et celle de l'auteur, qui écrit dans le dépôt,
partirait chez tous les joueurs ; la saisie la refuse, et la préparation
refuse de la mettre ou de la garder dans la banque (code `cle_depot`) ;
déjà publiée, elle se retire, puis se révoque sur GitHub. La
confirmation dit ce qu'il advient de la clé (ajoutée, remplacée, retirée,
gardée, aucune) ; le message de commit, public, n'en dit rien. En
démonstration, une phrase, sans champ.

**Le changement de mot de passe** écrit un seul commit, par l'API Git Data
(`js/publication/github.js`, `js/publication/personnages.js`) : la banque
republiée sous le nouveau mot de passe, **tous les personnages en ligne
rechiffrés** sous la nouvelle clé, et l'index régénéré (versions nouvelles).
La lecture : la référence de `main` sans cache, son commit, son arbre
récursif (un arbre tronqué arrête tout), puis la banque, l'index et chaque
`personnages/<id>.chiffre.json` ; un fichier de plus de 96 Ko n'est pas
téléchargé. Une réponse de GitHub illisible, coupée ou inattendue, même sur
un seul fichier, **arrête tout sans rien écrire** (un nouvel essai
rechiffrera ce qu'elle a manqué) ; seul un fichier reçu entier mais abîmé
est laissé, et un index abîmé se régénère des fichiers. Chaque fichier est
vérifié (`lireFichier`), puis rechiffré sans être lu (`rechiffrer`) ; ses
autres champs restent. L'écriture : des blobs
pour les gros fichiers, un arbre sur celui lu, un commit dont le parent est
le commit lu (auteur et committer explicites, § 8.2), puis la référence
avancée **sans forcer**. Un refus d'avance (422, ou 409) dit qu'un commit
est passé entre-temps (une publication, ou un personnage rangé par
l'automate) : tout recommence depuis la lecture, trois fois au plus, avec
une nouvelle confirmation, et le personnage rangé entre-temps est rechiffré
aussi. **Une avance restée sans réponse** (connexion tombée) a pu se faire :
la branche est relue une fois, sans cache ; sur le commit écrit, c'est un
succès ; sur le commit lu (la branche n'a pas bougé), la panne, et rien
n'est écrit ; sur un autre commit (la branche a bougé depuis l'envoi : le
commit écrit a pu passer, puis être suivi d'un autre), ou si la relecture
échoue aussi, l'issue est inconnue (code `incertain`), l'écran dit de recharger la
page et d'essayer d'abord le nouveau mot de passe, et l'ancienne clé reste
sur l'appareil. Le message : « … — nouveau mot de passe de table, 3 personnages
rechiffrés ». Un personnage chiffré sous une clé plus ancienne encore, ou
un fichier illisible, reste tel quel et compté ; la confirmation, qui
annonce le nombre de personnages rechiffrés, et le résultat le disent. La
publication ordinaire garde son `PUT` d'un seul fichier.

**La vérification et la reprise** : section « Personnages en ligne » (mode
réel, clé GitHub, banque publiée). « Vérifier les personnages en ligne » lit
l'arbre et les fichiers, sans rien écrire ni déchiffrer, et compte ceux dont
le sel n'est pas celui de la banque publiée, et les illisibles. Elle se
lance par un bouton, pas à l'ouverture de l'espace auteur (un
téléchargement par personnage, et un affichage tardif effacerait une
saisie) ; mais un changement qui laisse des personnages sous une autre clé
les montre aussitôt, avec la reprise. S'il y en a,
l'auteur saisit l'ancien mot de passe : pour chaque sel, la clé se dérive
aux itérations de la banque, en minuscules, puis sous la forme exacte si
elle diffère ; les personnages qu'elle ouvre passent sous la clé de la
banque publiée, vérifiée d'abord sur la banque elle-même ; le tout part en
un seul commit (personnages et index, sans la banque), avec la même reprise
en cas de refus d'avance. Ceux que l'ancien mot de passe n'ouvre pas
restent, comptés. Les erreurs ont les messages et les codes du § 8.2 (la
permission citée est « Contents »), plus `arbre_tronque`,
`avance_refusee` et `incertain`. L'automate refuse d'ailleurs, en amont, un personnage
déposé sous un autre sel que celui de la banque en place (§ 15.8).

---

## 9. Les écrans

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
visuelle propre à Abrasia dans l'interface. Seule exception : la fiche de
personnage imprimable, qui est du papier, a l'identité du modèle de fiche,
ses couleurs (`--fiche-…`, claires dans les deux thèmes) et ses polices,
hébergées dans le dépôt (§ 15.4).

| Écran | Contenu |
|---|---|
| Mot de passe | un champ, « se souvenir sur cet appareil » coché par défaut, une attente pendant la dérivation, qui ne dépend pas de la peinture de la fenêtre (une fenêtre masquée ne peint pas) ; après chaque saisie réussie, la page demande un stockage durable (`navigator.storage.persist()`), sans attendre la réponse : Firefox la demande à la personne, qui peut ne jamais répondre (relevé du groupe 3) ; sans IndexedDB, une phrase remplace la case (§ 7.2) |
| Accueil | date de la banque publiée, comptes (blocs, capacités, éléments), lien vers les anomalies s'il y en a ; « Vérifier les mises à jour » (§ 8.3) ; « Oublier le mot de passe sur cet appareil » (§ 7.2) ; l'aide pour l'écran d'accueil ; le diagnostic |
| Listes | Blocs, Capacités, Éléments, dans l'ordre alphabétique ; recherche instantanée sur les noms et les descriptions, sans casse ni accents (`œ` vaut `oe`), chaque mot de la recherche devant se trouver |
| Fiche d'un bloc | éléments (liens), capacités (liens ; « au choix : … », « facultatif : … »), paramètres sous leur nom affiché (§ 5.2), par exemple `Brûlant[5/10/15]`, suivis de leur écriture transmise, notes de conception en retrait |
| Fiche d'une capacité | variantes par puissance, coûts, éléments propres, description ; **« octroyée par »** : les blocs qui la citent dans leur colonne des capacités (A3) |
| Fiche d'un élément | paramètres reçus, description ; **« porté par »** : blocs et capacités qui le citent, et blocs qui transmettent un paramètre qu'il reçoit (A4) |
| Anomalies | le rapport publié avec la banque ; `#/anomalies/Blocs/14` met en avant les anomalies d'une ligne |
| Espace auteur | clé GitHub ; import ; rapport ; différences ; publication ; changement de mot de passe, avec les personnages en ligne ; clé de dépôt des personnages ; vérification et reprise des personnages en ligne (§ 8.4) |
| Personnages | en ligne, tous les personnages du site et ceux que l'appareil vient d'envoyer ; à part, les non-envoyés (« Réessayer ») et les brouillons ; créer, reprendre, ouvrir, modifier, enregistrer le fichier, importer, ouvrir sur mon téléphone, supprimer après confirmation (pour tous, en ligne) ; en démonstration, le personnage de démonstration, et rien en ligne (§ 15.3, § 15.8) |
| Création | le parcours en neuf étapes, chaque capacité décrite, des boutons + et −, trois entrées d'objets, un brouillon gardé à chaque changement, « Ce qui manque » toujours présent ; la copie de travail d'un « Modifier », qui s'enregistre à la place de l'original ou sous un autre nom (§ 15.3) |
| Fiche d'un personnage | vue lecture ou vue fiche, « Imprimer / PDF » (recto puis verso), fichier, lien vers le téléphone, « Modifier », qualité des objets ; un personnage en ligne s'y ouvre aussi (§ 15.3, § 15.4, § 15.5) |
| Personnage reçu | un lien #/recevoir/… : aperçu, puis « Enregistrer sur cet appareil » (§ 15.1) |

La navigation porte un lien « Personnages ». Chaque fiche a une adresse (`#/capacite/Attaque%20de%20base`) qu'on peut
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
l'auteur choisit le mot de passe de table, deux fois, 8 signes au moins,
majuscules indifférentes (§ 7.3). Ensuite, la banque publiée se déchiffre avec la clé gardée, ou avec
le mot de passe, redemandé s'il a changé. Quand le rapport compte des
erreurs, la case « Je publie en connaissance de cause » s'affiche sous sa
liste complète, et le bouton « Publier » ne s'active qu'une fois cochée
(§ 6.3). Après la publication : « Publiée — visible par tous d'ici quelques
minutes », le message et le lien du commit. La page ouvre aussitôt la
nouvelle banque ; tant que GitHub Pages sert l'ancien fichier, l'accueil le
dit (§ 8.3). Le changement de mot de passe republie la banque publiée sous
le nouveau, et rechiffre les personnages en ligne dans le même commit, avec
le message « … — aucune différence — nouveau mot de passe de table, N
personnages rechiffrés » (§ 8.4).

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
  `img-src`, et depuis le lot 2 `font-src` : `'self'`, pour les polices de
  la fiche), seules les connexions vers le site et vers `api.github.com`
  sont permises, et ni objet, ni `<base>`, ni travailleur, ni envoi de
  formulaire. Aucun script, style ni gestionnaire
  d'événement n'est écrit dans la page. **Aucune donnée n'est insérée comme
  HTML** : ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni
  `document.write` dans les fichiers du site (`index.html`, le manifeste,
  `css/`, `js/`) ni dans `outils/`, et un contrôle le vérifie (§ 11). Les
  écrans fabriquent leurs éléments par `js/ecrans/dom.js`, où chaque texte
  devient un nœud texte. `dom.js` refuse aussi un gestionnaire écrit en
  texte, les attributs `style` et `srcdoc`, et toute adresse (`href`, `src`)
  qui ne commence pas par `#/`, `?` ou `https://` : la politique de sécurité
  n'est pas la seule barrière. `svg()` n'y fabrique que quelques formes
  (la silhouette de la fiche), sans adresse, gestionnaire ni style ;
  `telecharger()` fait enregistrer un fichier par un lien vers un Blob
  qu'elle fabrique elle-même, seule adresse que `el()` refuserait. La seule
  écriture de style du code est l'échelle de la vue fiche, un nombre, posé
  en propriété CSS (§ 15.5). Raison : la clé et le jeton vivent dans
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
clair ; un chemin qui porte une barre inverse ou un caractère de contrôle
est refusé (sous Windows, `/plans%5Cx` passait, relecture du lot 2). Les écrans se contrôlent dans un document simulé, écrit pour le
projet (`tests/outils/dom_simule.js`), sans dépendance.

GitHub Actions emploie deux actions, **seules dépendances du dépôt** :
`actions/checkout` (récupérer le dépôt et son historique) et
`actions/setup-node` (installer Node). Elles sont publiées par GitHub et
**fixées sur un commit précis**, pour qu'une version nouvelle n'entre pas sans
relecture.

**Le workflow « Personnages »** (lot 2 bis, § 15.8) emploie les deux mêmes
actions, fixées sur les mêmes commits que « Contrôles ». Ses droits :
`contents: read` au niveau du workflow ; au seul job, `contents: write`
(commiter dans `personnages/`), `issues: write` (commenter, fermer,
verrouiller) et **`pages: write`** (demander la construction du site).
Cette troisième permission n'est pas dans l'instruction du lot 2 bis, qui
ne citait que les deux premières : **un envoi fait avec le jeton d'un
workflow ne déclenche pas la construction de GitHub Pages** (documentation
de GitHub, « Configuring a publishing source for your GitHub Pages site »,
section « Troubleshooting publishing from a branch » : « Commits pushed by a
GitHub Actions workflow that uses the GITHUB_TOKEN do not trigger a GitHub
Pages build. », relevé du 30/09/2026) ; sans elle, un personnage déposé
n'apparaîtrait qu'au prochain envoi de l'auteur. L'automate
(`outils/automate_personnages.js`) n'emploie que Node : `node:child_process`
pour git, sans shell, et `fetch` pour l'API.

**Les polices de la fiche** (lot 2) : Marcellus et Alegreya Sans, au format
woff2, sous-ensemble « latin » de Google Fonts (qui couvre le français), et
leurs licences SIL OFL 1.1, dans `polices/` (décision de l'auteur,
29/09/2026 ; 120 Ko environ). Ce ne sont pas du code : la page les charge de
son propre site, seulement quand la fiche s'affiche. Le navigateur fournit
aussi `CompressionStream` pour le lien d'un personnage (§ 15.1) et le
chiffré d'un personnage en ligne (§ 15.8). Le serveur local sert en plus les
`.woff2`, le personnage de démonstration, et `personnages/` sous ses deux
seules formes, à la casse près.

Toute dépendance future est justifiée ici, avant son arrivée.

### 10.3 Le dépôt et Git

- `.gitignore` : `*.xlsx`, avec la seule exception
  `!essais/classeur_essai.xlsx`, et les formats voisins d'un classeur
  (`.xls`, `.xlsm`, `.xlsb`, `.ods`, `.csv`) ; `*.docx` (le Word des
  règles), `.doc`, `.docm`, `.odt` et `.pdf` ; tout JSON, sauf
  `package.json`, `essais/banque_demo.chiffree.json`,
  `donnees/banque.chiffree.json`, `essais/personnage_demo.arpenteur.json`,
  fictif (un personnage réel exporté dans le dossier reste dehors), et les
  personnages en ligne, chiffrés : `personnages/*.chiffre.json` et
  `personnages/index.json` (rien d'autre de `personnages/` : ni fichier
  d'un autre genre, ni sous-dossier) ; les documents de travail
  `ressources/` et `plans/` ; `système/`, le dossier
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
- **Les commits de l'automate** (lot 2 bis) portent l'identité du robot de
  GitHub Actions, en adresse privée
  (`41898282+github-actions[bot]@users.noreply.github.com`), que le contrôle
  des adresses admet, et ne touchent que `personnages/`. Ils ne lancent pas
  le workflow « Contrôles » : ils sont contrôlés au prochain envoi de
  l'auteur, qui doit d'abord les récupérer (`git pull --rebase`), sans quoi
  GitHub refuse l'envoi. Le contrôle de l'automate crée de vrais dépôts git
  jetables : il allonge la suite d'environ 17 secondes sur le poste de
  l'auteur (git y est lent), bien moins sous Linux.

---

## 11. Les contrôles

Lancés par `node --test`, en local et par GitHub Actions à chaque envoi.
Chaque contrôle nouveau se vérifie **armé puis désarmé**.

| Domaine | Contrôles minimaux |
|---|---|
| Lecture | le lecteur XML : entités, CDATA, noms locaux, fins de ligne, XML mal formé et DOCTYPE refusés ; le classeur d'essai donne les feuilles, en-têtes et cellules attendus, dont le texte enrichi, les retours à la ligne et les nombres ; un fichier qui n'est pas un ZIP, une archive tronquée, chiffrée, ZIP64 ou d'une méthode inconnue, un CRC faux, un classeur protégé par mot de passe, un XML abîmé donnent un message, pas une exception ; le classeur suivi correspond à sa description (`tests/outils/`) |
| Notation | chaque ligne du tableau du § 6.2, dont les accolades imbriquées et la virgule décimale ; une notation cassée donne E6 et garde le brut |
| Import | la banque du classeur d'essai a le format du § 5.1 ; colonnes retrouvées malgré la casse, les accents et l'ordre des en-têtes ; valeurs en chaînes, telles qu'écrites ; brut et `lisez_moi`, où une colonne nommée `__proto__` ou `constructor` reste ; ligne sans nom exclue ; fichier illisible : un message |
| Contrôle | le classeur d'essai déclenche **chaque** code du § 6.3 (E1, A8, A9 et A10 sur ses variantes, § 10.3), et exactement les anomalies qu'il annonce, ligne par ligne ; un classeur propre n'en déclenche aucun ; gravités du § 6.3 (le tableau lu dans la spécification, codes à deux chiffres compris) et tri du § 6.4 ; la colonne « Type » attendue, les types comparés sans casse, accents ni espaces ; E7 : un paramètre ciblé à côté du même sans cible admis, dans les deux ordres ; deux sans cible, ou la même cible deux fois (casse comprise), une erreur ; E4 toujours sur la cible ; A10 : deux pièces d'un même type sur une zone, pas deux types différents, pas une valeur écrite « 0 » ou « 0,0 » |
| Chiffrement | aller-retour, au format 2 du § 7.1 : l'empreinte est celle des octets chiffrés, vérifiée avant le déchiffrement, et change à chaque publication ; le format 1 ne se lit plus : il se dit abîmé, avant toute dérivation ; mauvais mot de passe refusé proprement ; fichier abîmé ou inconnu, ou en-tête hors des bornes du § 7.1 (itérations, sel, IV, données), ou dérivation refusée : un message ; une clé sous le plancher ne chiffre pas ; IV différent à chaque chiffrement ; sel inchangé tant que le mot de passe ne change pas ; la clé gardée déchiffre la publication suivante (§ 7.1), et un sel renouvelé la rend inutilisable ; normalisation du mot de passe : NFC, espaces de bord, **minuscules** (« İ » compris), la même clé quelle que soit la casse ; une banque chiffrée sous la forme exacte reste lisible avec le mot de passe tel qu'il se saisissait, et la clé rendue republie sous la même forme ; 8 signes au moins, sans autre exigence ; coffre : seule une clé AES-GCM non extractible, clés réelle et de démonstration séparées, jeton à part (§ 7.2) |
| Publication | `fetch` simulé, **aucun appel réel à GitHub** : adresses, en-têtes et corps de la requête ; auteur et committer explicites, en adresse privée (§ 8.2) ; **première publication** : fichier absent, réponse 404, écriture sans `sha` ; mise à jour avec le `sha` lu ; refus pour `sha` périmé (409, ou 422 sans `sha`) : rechargement, nouvelles différences, nouvelle confirmation ; clé refusée (401), droits, réseau, JSON illisible, réponse qui n'est pas du JSON : un message ; écriture acceptée au corps perdu : un succès ; trois refus 422 : le motif du dernier ; contenu de plus d'un mégaoctet relu en brut. Lot 2 bis : la clé de dépôt ajoutée, gardée, remplacée, retirée, en fin de banque et seulement avec une valeur ; une forme invalide refusée sans recopier la saisie ; jamais dans le message de commit ni en clair dans une requête ; la clé GitHub de l'auteur refusée comme clé de dépôt, saisie comme publiée ; le changement de mot de passe en un seul commit Git Data (banque, personnages rechiffrés, déchiffrables avec la nouvelle clé et plus avec l'ancienne, autres champs gardés, index aux versions nouvelles ; branche lue sans cache, avance sans forcer, auteur et committer explicites) ; un refus d'avance relance tout et rechiffre le personnage rangé entre-temps ; une avance sans réponse : succès si la branche relue est sur le commit écrit, panne sur le commit lu, `incertain` sur un autre commit ou si la relecture tombe aussi ; autre clé, fichier reçu entier mais abîmé, ou trop gros : laissés et comptés, index abîmé régénéré ; réponse illisible, coupée ou inattendue sur un personnage ou l'index, arbre tronqué, clé refusée, droits, réseau, 409 : un message, rien d'écrit ; la reprise avec l'ancien mot de passe (minuscules puis forme exacte), en un seul commit sans la banque |
| Dépôt | aucun `.xlsx` hors `essais/`, et chaque `.xlsx` d'`essais/` fabriqué, octet pour octet, par l'outil des essais ; le `.gitignore` ignore les classeurs, leurs formats voisins, les documents et tout JSON hors liste ; aucun autre format de classeur ou de document, aucun JSON hors liste (le personnage de démonstration y entre) ; une seule page (`index.html`), une seule image SVG (l'icône) ; dans tout l'historique, aucun fichier interdit et aucun jeton, chaque contenu lu une seule fois (un historique de 900 révisions se lit, là où la ligne de commande de Windows n'en passerait que quelque 790) ; un jeton écrit en UTF-16 se voit, dans l'arbre comme dans l'historique ; deux workflows et eux seuls : « Contrôles » (actions fixées sur un commit avec leur version, `contents: read`, aucune écriture, `persist-credentials: false`, ni `pull_request_target` ni `workflow_run`, ni texte d'un événement) et « Personnages » (les mêmes règles, et son texte exact, ligne utile par ligne utile : l'ouverture d'un ticket et le lancement à la main pour seuls déclencheurs, `contents: read` au workflow, le groupe `personnages` sans annulation, un seul job sur `ubuntu-latest`, `contents`, `issues` et `pages` en écriture à ce seul job, les actions de « Contrôles » sur les mêmes commits, une seule commande, l'automate, le jeton pour seule expression ; la faute donne le numéro de ligne, jamais la ligne trouvée), chacun vu refusé sur des variantes fautives (dont un interpréteur, `NODE_OPTIONS`, un conteneur, une autre machine, un second checkout) ; `personnages/` ne contient que `<identifiant>.chiffre.json` et `index.json`, dans l'arbre comme dans l'historique ; chaque fichier se lit par le vérificateur de la page, sous l'identifiant de son chemin, et son contenu ne se lit pas comme du texte ; l'index se lit, **sans aucun nom en clair**, et dit exactement les fichiers présents, avec leur date et leur version ; le `.gitignore` ignore tout autre fichier de `personnages/` ; **aucun `.docx`** ; `donnees/` (quelle que soit la casse) ne contient que `banque.chiffree.json`, sans autre champ que ceux du § 7.1, aux valeurs du § 7.1 (600 000 itérations, sel de 16 octets, IV de 12), au format 2 seulement (l'empreinte est vérifiée sur les octets chiffrés ; le format 1 n'est plus permis nulle part, pas même au fichier du 29/09/2026), et des données qui ne se lisent pas comme du texte ; la banque d'`essais/` a la même forme, au format 2 ; le fichier figé du format 1, retiré, n'est permis que dans l'historique ; le crochet `pre-push` existe, en `sh`, exécutable, extrait en LF, et `core.hooksPath` le désigne sur le poste (pas sur GitHub Actions, qui n'envoie rien) ; un envoi vers un dépôt d'essai est refusé quand un contrôle échoue (même avec `NODE_TEST_CONTEXT` hérité), quand tout n'est pas commité, ou sans `node`, et accepté sinon ; aucun **jeton GitHub entier** : un préfixe (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) suivi d'au moins 36 caractères alphanumériques ou soulignés, le contrôle fabriquant son faux jeton au moment de l'essai ; dans l'historique, des **auteurs** en `…@users.noreply.github.com`, des **committers** aussi ou en `noreply@github.com` (commits faits sur le site de GitHub), la ligne `Co-Authored-By` d'un message n'étant pas une adresse d'auteur ; ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni `document.write` dans les fichiers du site et dans `outils/` (§ 10.1) |
| Différences | ajout, modification champ par champ, retrait ; variantes de puissance ; ordre des lignes et écriture d'une même notation sans effet ; doublons ; résumé d'une ligne et ses accords ; dates ; le type d'un bloc, et une banque publiée avant la colonne « Type » |
| Préparation | première publication, mise à jour sous le même secret ; mot de passe à choisir, à saisir ou changé ; E1 refusé ; changement de mot de passe ; la clé de dépôt suivie d'une publication à l'autre ; circuit complet, de l'import à la lecture par un joueur |
| En ligne | les trois formats du § 15.8 dans les deux sens : personnage chiffré, ticket, fichier rangé, déchiffré, le même personnage ; aucun nom en clair dans le ticket, le fichier ni l'index ; seul un personnage enregistré, de la banque réelle, part ; « supprimer » sans personnage ; un ticket hostile (JSON, tableau, champ en plus, `__proto__`, format, action, identifiant hostile, date locale ou impossible, sel, IV, contenu, base64 sans remplissage ou url, signe non ASCII, trop gros) refusé avec une raison ; un personnage trop gros pour un ticket ne part pas ; un chiffré recopié sous un autre identifiant, ou d'une autre clé, ne se lit pas ; le contenu déchiffré hostile (bombe, format, UTF-8, autre identifiant, brouillon, démonstration) refusé ; l'index trié, trois champs, un doublon de casse refusé ; le rechiffrement sans lecture. La page : la démonstration ne dépose ni ne lit rien ; sans clé de dépôt, « non envoyé » et sa raison ; le ticket ouvert avec la clé, le sel de la banque en place vérifié d'abord ; les refus de GitHub (401, 403, 404, 410, 422, réseau) laissent « non envoyé », « Réessayer » le refait ; l'index lu sans cache, chaque fichier par sa version, une seconde lecture sans nouvelle requête ; une ancienne clé et un fichier hostile comptés à part, un mot de passe changé pendant la visite distingué d'une ancienne clé ; GitHub Pages en retard juste après un changement fait d'ici ne bloque pas le dépôt, une page en retard, si ; une version en ligne plus récente arrête l'envoi, sauf confirmation ; une lecture échouée n'est pas un personnage absent ; le rapprochement (rattrapé, attente, retard, suppression gardée tant que l'index ne se lit pas, copie plus ancienne qui ne cache pas la version en ligne) |
| Automate | lancé hors de GitHub, sur une simulation de l'API et de vrais dépôts git jetables : un ticket « creer » conforme rangé (fichier qui se déchiffre, index, commit du robot aux deux seuls chemins, message sans nom, ticket fermé et verrouillé, Pages demandée) ; « remplacer », ticket repassé sans effet (même deux tickets rejoués, déjà rangés : aucun commit), « supprimer », suppression d'un absent, passage sans ticket ; tickets non conformes (JSON illisible, autre titre, identifiant hostile ou en forme de jeton, trop gros, base64 faux, contenu en clair, sel périmé, corps vide, champ en plus, commandes de shell et chemins) fermés avec leur raison, sans rien recopier, écrire ni exécuter ; collision de casse ; inconnu (autre login, ou même login d'un autre compte) fermé et verrouillé sans commentaire, même quand la partie git s'arrête ; avalanche d'inconnus au-delà de la limite de pages : les plus anciens fermés, les autres au passage suivant, les tickets du propriétaire lus à part et rangés ; demande de fusion ignorée ; envoi refusé puis réussi, tickets rejugés sur la banque republiée ; cinq refus : aucun ticket du propriétaire fermé ; fichier illisible, intrus, ou `.gitignore` qui cache les fichiers rangés : arrêt sans commit ni fermeture ; chemin hors de `personnages/` : arrêt avant l'envoi ; la variable du jeton ôtée de toute commande git, le jeton à la seule commande d'envoi, jamais sur le disque ; Pages refusée ; lancé à la main, l'automate redemande Pages ; l'API et l'environnement de GitHub Actions. Aucun nom en clair nulle part |
| Routes et fiches | décodage des adresses de fiche (`#/capacite/Attaque%20de%20base`) et aller-retour des noms difficiles ; la fiche et la liste des blocs montrent leur type ; adresses abîmées, dont les noms d'`Object.prototype` ; un nom introuvable n'est jamais le titre ; recherche sans casse ni accents, sur les noms et les descriptions ; renvois résolus comme au contrôle ; « octroyée par », « porté par », nom affiché ; anomalies d'une ligne |
| Site | politique de sécurité du `<meta>`, avant scripts et styles, toute la table des directives et rien d'autre ; zoom permis ; ni script, ni style, ni gestionnaire en ligne ; chaque fichier appelé existe ; le graphe des modules se résout et atteint les douze écrans ; manifeste, couleurs des jetons, icônes aux tailles dites, telles que les dessine leur outil ; contrastes ; valeurs de `ecran.css` et de `personnage.css` tirées des jetons, aucune police téléchargée par l'interface ; la banque de démonstration, au format 2, se déchiffre et vient du classeur d'essai ; le mot de passe de démonstration, déjà en minuscules, saisi en majuscules, ouvre la banque, et la clé gardée la rouvre ; le format 1 ne s'ouvre plus ; au téléchargement, une empreinte de format 2 fausse et un format plus récent donnent leur message ; le diagnostic dit le format ; chargement : absente, présente, abîmée, `?v=`, clé gardée, mot de passe requis ou changé, stockage durable ; l'attente du mot de passe ne dépend pas de la peinture de la fenêtre ; le déverrouillage n'attend pas la réponse sur le stockage durable ; sans IndexedDB, la phrase au lieu de la case ; une erreur inattendue : un message. Dans un document simulé : le bouton « Publier » existe dans chaque état de l'espace auteur, et sa raison s'affiche ; la barre de publication reste collée au bas de l'écran ; « Oublier le mot de passe » ne laisse ni clé ni différences, même pendant une comparaison ; « Oublier la clé GitHub » annule la publication en attente ; « Se souvenir » décide de garder la clé ; la veille de 15 secondes, et rien sur une page chargée ; l'aide dit d'ajouter l'Atelier depuis son accueil ; `dom.js` refuse gestionnaires en texte, `style`, `srcdoc` et adresses étrangères ; le document simulé refuse d'ajouter null ou undefined, que le navigateur afficherait. L'espace auteur (lot 2 bis) : la section de la clé de dépôt (aide, état, saisie vérifiée ; la clé jamais à l'écran, dans un attribut ou un champ, ni gardée ; retirer, garder ; oubliée avec le mot de passe, et après une publication réussie ; la clé GitHub de l'auteur refusée ; une phrase en démonstration) ; le mot de passe : 7 signes refusés, 8 acceptés, deux saisies qui ne diffèrent que par la casse acceptées ; le changement compte les personnages avant l'envoi, puis écrit un seul commit ; s'il en laisse sous une autre clé, la section « Personnages en ligne » les montre aussitôt, avec la reprise ; une avance sans réponse : « Publiée » si la branche a avancé, sinon l'incertitude dite, et l'ancienne clé reste ; la vérification n'écrit rien, la reprise rechiffre. Le serveur local : la seule machine, les seuls fichiers du site, dont les polices, le personnage de démonstration et `personnages/` sous ses deux seules formes, casse comprise |
| Personnage | chaque règle du § 15.2 : la table des dés, bornes comprises ; les paires d'attaque et de défense ; les types mêlés et le cas sans armure ; l'ordre des zones, la grille et le maximum par zone, et l'interdiction du livret ; la qualité (X, 1, 2, 3, 1,5) et l'arrondi une fois l'opération faite, dont un cas où la virgule flottante se tromperait ; les expressions et leurs refus ; l'expression de mains nues et son dé vide ; le coût à la puissance ; les coûts 1, 3 et 6, le plafond de 10, le reliquat, les capacités reçues au-delà de 10 ; la capacité reçue deux fois ; le niveau 0 et les capacités à venir hors décompte ; les groupes ( ) et [ ], un choix disparu ; le style de combat ; le tirage (chaque constellation atteignable, rejet des valeurs biaisées) ; les points de lien ; la banque sans types ; les choix modifiés ou disparus ; ce qui manque à chaque étape, un bloc d'un autre type. Le format : aller-retour du fichier, champ inconnu ou manquant, `__proto__`, chaque champ et ses bornes, 64 Ko, JSON illisible, mode inversé, nom de fichier sûr ; le lien : aller-retour dans le fragment, lien abîmé, forgé, bombe de décompression, UTF-8 invalide, mode inversé. L'étagère : modes séparés, ordre, illisibles comptés, un personnage du format 1 converti, les notes ; une base bloquée par un autre onglet : l'étagère en mémoire et la raison, sans attendre. Le format 2 (lot 2 bis) : les places d'un objet, une seule arme tenue, les tirages ; le format 1 converti (arme principale, bouclier, armures portées, tirage) ou refusé s'il est abîmé ; un personnage neuf à 2 partout. Les places dans le calcul : pièces du pack portées, bouclier équipé (un seul), rangés sans effet ; le parcours signale une place fautive. Les adresses des écrans du personnage. La répartition du recto et son débordement ; le recto et le verso dans un document simulé (en-tête, cases cochées et grisées, reliquat, souffle, zones, corps, équipement, liens, légende, pied de page, suite du recto, toutes les capacités et les armes, un nom en HTML qui reste du texte) ; l'impression (A4 sans marge, couleurs, saut de page, barre non imprimée) ; les polices hébergées et leurs licences ; le personnage de démonstration, fabriqué par son outil et complet. Les écrans : liste, parcours, réception, fiche (vues, impression, banque sans types). Le parcours du lot 2 bis : les descriptions, dépliées sur grand écran et repliées sur téléphone ; les boutons + et − des caractéristiques (de 2 à 6, « + » arrêté à 36, le focus qui passe au voisin) ; le tirage refait et compté, la saisie ; l'arme tenue remplacée, les packs (un seul à la fois, la pièce portée seule renvoyée au sac), un pack non proposé (A10) avec sa raison, tous les objets au sac, qualité 2, la pièce refusée sur une zone couverte, un seul bouclier, l'arme prise en main ; l'étape 8 : seules les capacités qui peuvent évoluer, + et − dans les bornes, la raison d'un « + » inactif, avant et après, le focus gardé sur le bouton actionné ; les descriptions gardent leur état quand l'étape se redessine ; « — choisir — » ne défait pas la constellation ; le catalogue des armes, l'objet décrit avant d'être ajouté, un refus dit près de l'objet et le focus sur lui ; « Modifier » : la copie de travail, reprise, « Enregistrer » à la place de l'original, « Enregistrer sous un autre nom » (un autre nom exigé) ; l'enregistrement dépose (« creer », « remplacer »). La liste en ligne : les rubriques, l'attente, « Réessayer », « Supprimer » pour tous, « Modifier » d'un personnage en ligne, la phrase de la démonstration ; le mot de passe changé pendant la visite, une suppression dont le personnage ne se lit plus, une copie plus ancienne (« Envoyer quand même », « Retirer de l'appareil »), une base bloquée. La fiche : la qualité des objets (saisie fautive refusée, redépôt, panneau resté ouvert, focus sur la confirmation, deux objets de même nom distingués), « Modifier », un personnage ouvert depuis le site, ou dont la lecture échoue (« Réessayer »), « tirée N fois ». La mise en page se mesure dans un vrai navigateur (§ 15.4) |

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
- `Blocs` : la **colonne de type** existe depuis le 29/09/2026 (§ 4.1).
  Reste à désigner les types pour lesquels un bloc sans capacité (I3)
  remonterait en avertissement.
- La notation vit à la fois dans `lisez_moi` et dans le chapitre « Système »
  du Word. Un seul endroit : une annexe du Word, vers laquelle `lisez_moi`
  renvoie.
- Un bloc qui transmet un paramètre sans cible et le même avec une cible
  (Hache légère, `{portee:…}` deux fois) : le livret (« Paramètre »,
  exemple de la Dague) et `lisez_moi` disent que le paramètre ciblé vaut
  pour la capacité visée, et le créateur de personnage le lit ainsi
  (§ 15.2). **Tranché par l'auteur (lot 2 bis)** : E7 ne le signale plus ;
  il reste une erreur pour deux paramètres sans cible, ou deux fois la même
  cible (§ 6.3). Reste à écrire : une cible doit-elle être une capacité du
  bloc ? Celle de Hache légère n'en est pas une (E4).

**Pour le lot 2 — personnage** (relevé le 30/09/2026 ; le lot applique le
livret, et laisse vide ce qu'aucune source ne dit) :

- **Le dé d'attaque à mains nues** : à écrire dans le Word, section « Jets
  d'attaque ». Le bloc de base ne porte ni lourde, ni agile, ni précise : la
  fiche montre les dégâts de mains nues et laisse le dé vide.
- **Styles de combat et maîtrises** : le livret (« Système », « Blocs », et
  « Style de combat ») fait du style **un type de bloc**, que le créateur
  reconnaît ; le classeur en fait **une capacité au choix d'un archétype**.
  Convention retenue (instruction du 29/09/2026) : une capacité est un style
  si ses éléments propres contiennent l'élément « Style de combat », une
  maîtrise s'ils contiennent l'élément « Maîtrise ». À faire dans le
  classeur : ajouter « Style de combat » aux capacités de style, et créer
  l'élément « Maîtrise » pour les capacités de maîtrise ; tant que ce n'est
  pas fait, les options choisies d'un archétype s'affichent sous
  « Archétype », et la case « Style de combat » reste vide. À écrire dans le
  Word, section « Style de combat » : laquelle des deux formes vaut.
- **Une capacité reçue deux fois** (deux armes qui donnent la même
  capacité) : une seule capacité, comptée une fois dans les points. C'est
  une lecture du livret (« Création » : « les capacités qu'il possède ») ; à
  écrire dans le Word, section « Création ».
- **Deux pièces d'armure sur une même zone** : le livret (« Objet ») ne
  permet pas de les porter ensemble ; le classeur (élément Armure) dit
  qu'elles ne s'additionnent pas et que la plus élevée compte. Le livret
  fait foi : le parcours refuse de porter une seconde pièce sur une zone
  couverte (depuis le lot 2 bis, avec le nom de la pièce qui la couvre), un
  type d'armure à deux pièces sur une zone n'a pas de pack (A10), et la
  fiche d'un fichier importé le signale, en comptant la plus élevée. À
  unifier dans l'une des deux sources.
- **La constellation** : le livret la nomme « Constellation de naissance »
  et la dit tirée « parmi la liste des primordiaux » (« Constellation de
  naissance ») ; le classeur a des blocs de type « Constellation », un par
  primordial. Le créateur tire parmi les blocs de type Constellation et
  admet les deux noms du type. À unifier. Et le livret dit qu'elle octroie
  « une capacité » : les constellations du classeur n'en ont pas encore
  (« capacités à venir »), celle de Neru porte un choix dans la colonne des
  paramètres (A7).
- **Le bouclier** : ni le livret ni le classeur ne le définissent. Convention
  du créateur : un objet qui transmet un paramètre `defense` est un
  bouclier ; équipé, un seul compte (lot 2 bis), et la fiche en montre la
  défense après qualité. Dans le classeur, aucun élément ne reçoit
  `defense` (A2). À écrire dans le Word, section « Objet ».
- **La qualité** n'est dite que dans l'élément Qualité du classeur (1/3 +
  qualité/3) ; le livret (« Paramètre ») n'en donne qu'un exemple. À écrire
  dans le Word, section « Objet ».
- **Les capacités d'un objet rangé dans le sac** : le livret (« Objet »)
  distingue l'objet équipé de l'objet dans le sac, sans dire si ses
  capacités comptent. Le créateur compte les capacités de tout
  l'équipement possédé, sac compris ; depuis le lot 2 bis, où tout objet
  ajouté va d'abord au sac, la question compte davantage. À écrire dans le
  Word, section « Objet ».
- **La maîtrise des pièces d'armure** (types mêlés : « désavantage s'il ne
  possède pas la maîtrise de l'ensemble des pièces ») : la fiche l'écrit en
  mention, sans la calculer ; le lien avec les capacités de maîtrise du
  classeur n'est pas écrit. Section « Jets de défense ».
- **La jauge de lien au départ** : pleine ou vide ? La fiche montre le
  maximum, et des cases à remplir en jeu. Section « Ressources ».
- **L'espèce** : le livret (« Espèce ») lui donne une capacité activable et
  une passive à dé miroir ; dans le classeur, chaque espèce donne deux
  capacités passives (l'une ajoute +N, l'autre retourne un dé), aucune
  activable. Section « Espèce », ou le classeur.
- **Le bloc de base** : le livret (« Blocs ») y compte « se concentrer »,
  que le bloc « Capacités de base » du classeur n'a pas ; le créateur suit
  le classeur.
- **La maîtrise des armes** : les éléments Lourde, Agile et Précise du
  classeur imposent un désavantage à toutes les capacités de l'objet, sauf
  aux N premières couvertes par une Maîtrise du combat ; le livret
  (« Maîtrises ») fait de la maîtrise une condition de progression, objet
  par objet. Le recto donne le dé d'attaque sans ce désavantage, qui n'est
  pas calculé. Sections « Jets d'attaque » et « Maîtrises ».
- **Une seule arme** : l'élément Arme dit « une seule arme dans le même
  tour », le livret (« Objet ») « une seule arme équipée à la fois ». Le
  créateur suit le livret (lot 2 bis) : une arme tenue, les autres au sac.
- **Le modèle de fiche** : son sous-titre du souffle, « 5 par niveau »,
  contredit le livret (10 à la création, +1 par point d'historique) ; le
  livret fait foi. Il n'a pas de place pour le reliquat des points de
  capacité, que le livret exige : la fiche l'écrit près du titre des
  capacités. Et il ne laisse aucune place libre (§ 15.4) : une capacité, un
  objet ou un pouvoir de plus passe au verso.

**Pour le lot 2 bis — améliorations du créateur** (décisions de l'auteur du
30/09/2026, que le livret ne dit pas encore) :

- **La qualité à la création** : **2 par défaut** pour tout objet choisi à
  la création (facteur 1 : les valeurs du classeur s'appliquent telles
  quelles), sans étape pour la qualité ; elle se modifie ensuite, objet par
  objet, sur l'écran du personnage. À écrire dans le livret, section
  « Objet » (ou « Création »).
- **Le tirage de la constellation** : il **peut être refait** à volonté ; la
  fiche indique le nombre de tirages (« tirée 3 fois »), ou « saisie à la
  main ». Le livret (« Constellation de naissance », « Création ») dit
  seulement « tiré au hasard lors de la création ». À écrire dans le livret,
  section « Constellation de naissance ».
- **Le pack d'armure** : un par type (lourd, agile, précis), formé de
  toutes les pièces de ce type, une par zone, équipé d'office ; il n'existe
  pas dans le livret, qui ne connaît que des pièces. À écrire dans le
  livret, section « Objet », si le pack doit valoir hors du créateur.

**Pour le lot 3 — créateur d'adversaire**, section « Caractéristiques d'un
adversaire » du Word : ce que sont son attaque et sa défense ; son nombre
d'actions ; ses dégâts ; son armure, sa résistance et son corps par zone ; la
règle de construction d'une grille de localisation propre ; le sort de ses
blessures.

**Pour le lot 4 — objets, sorts, équipement** : ce qu'est un sort (le mot
n'apparaît pas dans le Word) ; la grammaire des expressions : le créateur de
personnage en calcule une (§ 15.2 : nombres, `{nom}`, `N`, + − × ÷, `X`,
arrondi inférieur), que le Word ou `lisez_moi` devra confirmer ou
étendre (parenthèses, signe).

**Pour la progression du personnage** (lot à fixer) : l'articulation entre
la montée de niveau (« Niveau » : un point à la puissance d'une capacité ou
à la maîtrise d'un objet) et les points d'expérience (« Progression ») ; la
maîtrise d'un objet.

---

## 13. Les lots

| Lot | Contenu | Attend |
|---|---|---|
| **1 — Socle** | lecture, notation, contrôle, chiffrement, publication, consultation, contrôles, GitHub Actions | rien |
| **2 — Personnage** | créateur au niveau 1, fiche imprimable (recto : le modèle ; verso), vue lecture et vue fiche zoomable sur téléphone, fichier et lien vers le téléphone (§ 15) | rien ; § 12, lot 2, pour ce qu'il laisse vide |
| **2 bis — Améliorations du créateur** | descriptions, boutons + et −, packs d'armure, qualité 2, tirage refait, modifier un personnage enregistré ; personnages en ligne (ticket, automate, chiffrés) ; mot de passe à 8 signes, sans casse ; E7 assoupli, A10 ; format 1 retiré (§ 15.8) | l'auteur : le jeton de dépôt, puis le changement du mot de passe |
| 3 — Adversaire | second classeur, créateur, assistant de calibrage, PDF quatre par feuille | § 12, lot 3 |
| 4 — Objets, sorts, équipement | créateur, « Copier comme lignes Excel » | § 12, lot 4 |
| 5 — Finitions | fiche de jeu à compteurs, PDF sur téléphone, annulation d'une publication, code QR vers le téléphone | — |

L'ordre des lots 2 à 4 a changé le 29/09/2026 (décision de l'auteur) : le
personnage passe avant l'adversaire. La progression du personnage (niveaux,
expérience, historique) viendra dans un lot à fixer.

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

**Le lot 2 est livré** (30/09/2026, spécification 1.1), d'un seul tenant,
selon l'instruction du 29/09/2026 (`plans/instruction_lot2.md`), sans
validation entre ses étapes. Les étapes : 1 et 2 — le type des blocs, A8 et
A9, le classeur d'essai enrichi ; 3 et 4 — les règles, le format et le lien
du personnage ; 5 et 6 — les écrans, la fiche imprimable, le personnage de
démonstration ; puis les défauts vus dans le navigateur ; la relecture à
quatre angles (livret, modèle, sécurité, téléphone) par 29 agents, chaque
constat vérifié par un sceptique, et ses 24 constats corrigés ; la
spécification 1.1. Les écrans du parcours ont été écrits par un agent et
relus. Ce qui reste à l'auteur : les essais du compte rendu (Firefox,
téléphone, site en ligne), la republication de la banque réelle depuis le
classeur à jour (le créateur en a besoin), et les points du § 12.

**Le lot 2 bis est livré** (30/09/2026, spécification 1.2), d'un seul
tenant, selon l'instruction du 30/09/2026 (`plans/instruction_lot2bis.md`),
sans validation entre ses étapes. Les étapes : une étude à quatre agents,
au début, en guise de revue de sécurité ; E7 assoupli, A10, le format 1
retiré, le mot de passe à 8 signes et sans casse, les formats en ligne ;
puis, en deux pistes menées par des agents et relues, l'automate et son
workflow, la clé de dépôt et le rechiffrement ; le parcours amélioré et les
personnages en ligne ; la relecture finale à quatre angles ; la
spécification 1.2. Ce qui reste à l'auteur, et à lui seul : créer le jeton
de dépôt, le saisir dans l'espace auteur, changer le mot de passe de table
(ce qui publie la banque avec la clé de dépôt), puis les essais du compte
rendu (`plans/compte_rendu_lot2bis.md`).

---

## 14. Révisions

**1.2 — 30/09/2026.** Lot 2 bis : les améliorations du créateur, les
personnages en ligne.

- Décisions de l'auteur du 30/09/2026 (§ 1, § 2) ; interdits 2 et 3 (§ 0)
  et `CLAUDE.md` : la clé de dépôt ne vit que dans la banque chiffrée ;
  `git pull --rebase` avant d'envoyer, l'automate commitant aussi ; les
  mutations se lancent sur une copie hors de OneDrive.
- Le contrôle : E7 assoupli (un paramètre ciblé à côté du même sans cible
  est admis ; deux sans cible, ou la même cible deux fois, restent une
  erreur ; E4 vérifie toujours la cible) ; A10, deux pièces d'armure d'un
  même type sur une zone, avertissement : le pack de ce type n'est pas
  proposé ; dix-neuf codes (§ 6.3 ; § 12, l'entrée E7 du lot 1 tranchée).
- Le mot de passe : 8 signes au moins, sans autre exigence ; sans casse
  (NFC, espaces de bord, minuscules), avec un repli sur la forme exacte,
  qui garde lisible la banque en place ; le risque accepté, écrit, et le
  conseil de deux ou trois mots sans rapport (§ 7.1, § 7.3, § 9). Le format
  1 de la banque ne se lit plus (§ 7.1, § 11).
- Le personnage au format 2 : la place de chaque objet (arme, pack, équipé,
  sac), les tirages de la constellation, la conversion du format 1 ; les
  notes de l'appareil (§ 15.1). Les règles : qualité 2 à la création, le
  tirage refait, le pack d'armure (§ 15.2 ; § 12, trois entrées). Le
  parcours : les descriptions partout, les boutons + et −, l'équipement en
  trois entrées, l'étape 8 réduite aux capacités qui peuvent évoluer, avec
  leur description avant et après (demande de l'auteur), « Modifier » et
  ses deux enregistrements ; « Personnages » ; la qualité des objets sur la
  fiche (§ 15.3).
- Les personnages en ligne (§ 15.8, nouveau) : le chiffré, le ticket, le
  fichier rangé, l'index ; l'automate et son workflow, avec `pages: write`
  (§ 10.2 : les envois faits avec le jeton d'un workflow ne déclenchent pas
  GitHub Pages) ; la clé de dépôt, le changement de mot de passe en un seul
  commit qui rechiffre les personnages, la vérification et la reprise
  (§ 5.1, § 8.4, nouveau) ; `.gitignore` (§ 10.3), fichiers (§ 3.2),
  serveur local ; contrôles (§ 11 : 318 contrôles).
- Relectures : l'étude du début (4 agents) ; les deux pistes, chacune
  relue (6 agents) ; la relecture finale à quatre angles (sécurité de la
  file, conformité au livret, ergonomie du téléphone, rechiffrement), par
  35 agents : 30 constats, 20 confirmés par un sceptique, tous corrigés
  (§ 8.4, § 15.1, § 15.3, § 15.8 ; § 7.3, le pouvoir exact de la clé de
  dépôt). Mesures : 62 mutations du lot, une équivalente, et 25 des
  corrections, vues échouer ; le banc sur le classeur réel (§ 15.2).


**1.1 — 30/09/2026.** Lot 2 : le créateur de personnage.

- Lots renumérotés : 2 personnage, 3 adversaire, 4 objets et sorts (§ 1,
  § 13) ; décisions de l'auteur du lot 2 (§ 2).
- Le type des blocs : la colonne « Type », en-tête attendu ; A8 (sans type)
  et A9 (type inconnu) ; les différences et la consultation le montrent ;
  une banque sans type se détecte (§ 4.1, § 5.1, § 6.3).
- Le personnage (§ 15, nouveau) : son format et son lien, les règles de
  calcul avec leur source, le parcours, la fiche imprimable (recto : le
  modèle, au pixel ; verso), le téléphone, la sécurité des fichiers et des
  liens reçus, la démonstration. Écrans (§ 9), fichiers (§ 3.2), polices
  hébergées et CSP (§ 2, § 10.1, § 10.2), `.gitignore` (§ 10.3), contrôles
  (§ 11 : 232 contrôles).
- § 12 : le dé d'attaque à mains nues, la convention style et maîtrise, la
  capacité comptée une fois, et les écarts relevés entre le livret, le
  classeur et le modèle ; l'entrée E7 du lot 1 réécrite.
- Relecture à quatre angles par 29 agents : 24 constats retenus, dont un
  critique (l'impression depuis la vue lecture sortait une page vide), tous
  corrigés (§ 15.3 à § 15.6, § 10.2).

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

---

## 15. Le personnage (lots 2 et 2 bis)

Ce paragraphe suit les révisions pour ne pas renuméroter ceux que le code
cite. Le lot 2 est le **créateur de personnage** (instruction du 29/09/2026,
validée par l'auteur) : la création au niveau 1. Le lot 2 bis (instruction
du 30/09/2026) l'améliore : descriptions, boutons + et −, packs d'armure,
qualité 2 d'office, tirage à refaire, un personnage enregistré qui se
modifie, et **les personnages en ligne** (§ 15.8). La progression (niveaux,
expérience, historique) viendra dans un lot ultérieur. **Préséance : le
livret fait foi** (`Principe jdr abrasia.docx`, lu en lecture seule, jamais
copié), puis le classeur, puis le modèle de fiche (hors dépôt, dans
`plans/`). Un écart se signale au § 12, et c'est le livret qu'on applique.

### 15.1 Le personnage, son fichier et son lien

**Ses choix, pas des copies.** Un personnage garde des noms (espèce,
archétype, options choisies, objets…), des nombres et les textes du joueur,
jamais une donnée copiée de la banque. Sa fiche se recalcule avec la banque
du jour (`js/personnage/calcul.js`) et imprime la date de cette banque. Un
choix disparu de la banque, ou modifié depuis l'enregistrement, se signale :
le personnage garde de chaque bloc choisi et de chaque capacité possédée une
**empreinte courte de son contenu de règle** (type, éléments, capacités,
paramètres d'un bloc ; variantes d'une capacité), sans les notes de
conception ni la ligne du classeur, qui changent sans changer la règle
(`suivi.js`). C'est un hachage rapide de 53 bits (cyrb53), qui voit un
changement sans permettre de retrouver le contenu.

**Où il vit.** Sur l'appareil, dans une base IndexedDB à part du coffre
(§ 7.2), `atelier-des-arpenteurs-personnages`, avec un entrepôt pour le mode
réel et un pour la démonstration : ils ne se mêlent jamais (`stockage.js`).
Depuis le lot 2 bis (version 2 de la base), un troisième entrepôt,
« notes », garde ce que l'appareil sait d'un personnage hors de son
format : l'original d'une copie de travail (« Modifier ») et l'état de son
dépôt en ligne (§ 15.8), avec le nom du personnage, pour dire encore de quoi
il s'agit quand le personnage ne se lit plus ; une note illisible s'ignore.
La montée de version ne fait qu'ajouter cet entrepôt : les personnages
gardés restent. Un autre onglet, resté sur la version précédente, bloque la
montée : la page ne l'attend pas, les personnages vivent en mémoire, et la
liste dit de fermer cet onglet puis de recharger. Sans IndexedDB, les
personnages vivent en mémoire le temps de la visite, et l'écran le dit. Dans un **fichier** `*.arpenteur.json`, que l'on enregistre
et que l'on importe. Dans un **lien « Ouvrir sur mon téléphone »**, qui
porte le personnage dans l'adresse elle-même, sans serveur. Et **en ligne**,
chiffré, visible par tous les joueurs qui ont le mot de passe (§ 15.8). Le
code QR est hors lot.

**Le format** (`format.js`, format 2 depuis le lot 2 bis) :

```json
{
  "format": 2,
  "id": "22 signes base64url, tirés au hasard",
  "mode": "demo",
  "etat": "enregistre",
  "etape": 9,
  "cree_le": "2026-09-29T20:00:00.000Z",
  "modifie_le": "2026-09-29T20:00:00.000Z",
  "enregistre_le": "2026-09-29T20:00:00.000Z",
  "banque": { "empreinte": "sha256:…", "publiee_le": "2026-09-29T22:34:07+02:00" },
  "identite": { "nom": "Aubépine Crèmebrûlée", "age": "31 ans", "description": "…", "histoire": "…" },
  "caracteristiques": { "force": 4, "agilite": 5, "precision": 5, "sens": 3, "culture_neruvienne": 4,
                        "savoir_sauvage": 3, "parole": 4, "empathie": 4, "creativite": 4 },
  "archetype": { "nom": "Saucier", "choix": ["Solo du chef", "Maîtrise de l'agile"] },
  "espece": { "nom": "Marmiton", "choix": [] },
  "constellation": { "nom": "Constellation du Sablier", "choix": [], "obtention": "tirage", "tirages": 3 },
  "primordial": { "nom": "Grand Four", "choix": ["Cendre"] },
  "equipement": [
    { "nom": "Couteau d'office", "choix": [], "qualite": "2", "place": "arme" },
    { "nom": "Tablier de cuir", "choix": [], "qualite": "2", "place": "pack" },
    { "nom": "Couvercle de marmite", "choix": [], "qualite": "2", "place": "equipe" },
    { "nom": "Bouillon revigorant", "choix": [], "qualite": "2", "place": "sac" }
  ],
  "niveaux": [ { "capacite": "Flambage", "niveau": 2 } ],
  "empreintes": [ { "genre": "bloc", "nom": "Saucier", "empreinte": "0a1b2c3d4e5f60" } ]
}
```

Les choix d'un bloc sont une liste de noms d'options, comparés sans casse
ni accents : un choix qui ne figure plus parmi les options se signale.
Chaque objet a sa **place** : `arme`, l'arme tenue (une au plus, livret,
« Objet ») ; `pack`, une pièce du pack d'armure, portée ; `equipe`, une
pièce d'armure portée seule, ou un bouclier tenu ; `sac`, rangé. `qualite`
vaut « 2 » à la création (décision de l'auteur, lot 2 bis), puis le nombre
que le MJ donne (« 1,5 »), ou `null` pour X. `tirages` compte les tirages
de la constellation, qui se refont à volonté ; une constellation tirée l'a
été une fois au moins. `niveaux` ne garde que les montées. `etape` est
l'étape où reprendre un brouillon. Un personnage neuf a ses neuf
caractéristiques à 2.

**Le format 1** (lot 2) se lit encore, fichier, lien ou appareil, converti à
la lecture (`migrer`) : l'objet de rang `arme_principale` prend la place
`arme`, celui de rang `bouclier` et les armures « portées » la place
`equipe`, le reste le sac ; une constellation tirée l'a été une fois. Un
format 1 abîmé (rang hors de l'équipement, champ inconnu) est refusé. Tout
s'écrit ensuite au format 2.

**Le lien.** Le fichier du personnage, compressé
(`CompressionStream("deflate-raw")`), en base64url, **dans le fragment** de
l'adresse : `…/atelier-des-arpenteurs/?demo=1#/recevoir/<code>`. Le fragment
n'est jamais envoyé à un serveur ; il reste dans l'historique du navigateur
qui l'ouvre. À l'ouverture, le mot de passe de table s'il le faut, puis un
aperçu, puis « Enregistrer sur cet appareil ». Un personnage déjà présent
(même identifiant) se remplace ou se garde en double, au choix. Un lien
réel ouvert en démonstration, ou l'inverse, est refusé avec un message.

### 15.2 Les règles de calcul

Elles vivent dans le code (décision de l'auteur, 29/09/2026), chacune avec
la section du livret ou l'élément du classeur qui la fonde, en commentaire
(`js/personnage/regles.js`). Aucune n'est inventée : ce qui manque est au
§ 12.

| Règle | Source |
|---|---|
| Neuf caractéristiques (Force, Agilité, Précision, Sens, Culture néruvienne, Savoir sauvage, Parole, Empathie, Créativité), de 2 à 6, somme 36 | livret, « Caractéristiques » |
| Dé d'un jet : somme de deux caractéristiques, ou le double d'une seule, arrondie au pair inférieur ou égal : 4 → d4 … 12 → d12 | livret, « Caractéristiques » et « Types de dés » |
| Dé d'attaque selon l'arme : lourde For+Pré, agile Agi+For, précise Pré+Agi ; le type d'un objet est l'élément Lourde, Agile ou Précise qu'il porte | livret, « Jets d'attaque » ; classeur, Eléments |
| Dé de défense selon l'armure portée : lourde For+Sen, agile Agi+Cré, précise Pré+Emp. Types mêlés : le dé le plus faible, et « désavantage sans la maîtrise de toutes les pièces » (la maîtrise n'est pas calculée). Aucune pièce : le plus avantageux des trois, avec son type | livret, « Jets de défense » |
| Armure par zone : les six valeurs de `{armure}` dans l'ordre torse, jambe gauche, jambe droite, bras gauche, bras droit, tête, des pièces portées (places `pack` et `equipe`) ; deux pièces sur une zone ne s'additionnent pas, la plus élevée compte. Le livret interdit de porter deux pièces sur une même zone : le parcours refuse de porter la seconde, en disant laquelle couvre déjà la zone ; la fiche d'un fichier importé le signale | élément Armure ; livret, « Objet » (§ 12) |
| Arme tenue : une seule, la place `arme` ; une arme ailleurs compte comme rangée | livret, « Objet » |
| Pack d'armure : un par type (lourd, agile, précis), formé de toutes les pièces d'armure de ce type, portées d'office ; un type dont deux pièces couvrent une même zone (une valeur écrite autre que zéro à ce rang) n'a pas de pack (A10, § 6.3) | livret, « Objet » ; instruction du lot 2 bis |
| Grille de localisation : tête 1, torse 2-11, jambe gauche 12-13, jambe droite 14-15, bras gauche 16-17, bras droit 18-19, 20 attaque annulée | livret, « Jets de localisation » |
| Qualité : `{degats}`, `{defense}` et `{armure}` du bloc multipliés par 1/3 + `{qualite}`/3. **2 à la création** (facteur 1 : les valeurs du classeur s'appliquent telles quelles) ; elle se change ensuite sur l'écran du personnage, objet par objet ; vide, elle vaut X : les valeurs brutes et « X » | élément Qualité ; décision de l'auteur, lot 2 bis (§ 12) |
| Valeurs décimales : l'entier inférieur, une fois l'opération faite. Le calcul se fait **en fractions exactes** : en virgule flottante, 15 × (1/3 + 4/3) vaut 24,999… et donnerait 24 au lieu de 25 (contrôlé) | livret, « Valeurs décimales » |
| Expressions : nombres à virgule décimale, `{caractéristique}` ou `{paramètre}`, `N`, et + − × ÷, la multiplication et la division d'abord. `X` reste « X ». Toute autre forme (parenthèses, signe seul) s'affiche telle qu'écrite, avec un avertissement dans le rapport du personnage. Un paramètre à rangs (`degats` : 3, `armure` : 6) se découpe sur ses barres ; ailleurs la barre divise | classeur, lisez_moi « Syntaxe » |
| Descriptions : les `[expression]` et les `{nom}` remplacés par leur valeur ; un paramètre à rangs donne un résultat par rang (`[N*{degats}]` → 2/4/8). Les paramètres d'une capacité : ceux de son bloc sans cible, puis ceux qui la visent, puis ceux de ses éléments propres (`Portée[1]`), qui priment | livret, « Paramètre » ; lisez_moi |
| Ressources : souffle 10 à la création (+1 par point d'historique, aucun à la création), corps 10, résistance 5 par zone, armure selon l'équipement | livret, « Ressources » |
| Points de lien d'un primordial lié : la puissance investie dans ses capacités (la somme de leurs niveaux) | livret, « Ressources » et « Lien » |
| Création : un archétype (ses capacités et ses groupes, dont style et maîtrise), une espèce, toutes les capacités du bloc de base, une constellation tirée au hasard parmi les blocs de type Constellation (le tirage **se refait à volonté** et se compte : la fiche dit « tirée N fois », ou « saisie à la main »), un primordial choisi et ses capacités, l'équipement à volonté | livret, « Création » ; tirage refait : décision de l'auteur, lot 2 bis (§ 12) |
| Niveau d'une capacité : 1 à la création, sauf si elle ne peut évoluer (puissance « 0 ») : niveau 0. Une puissance N va de 1 à 3 ; une capacité à variantes (1, 2, 3) monte jusqu'à la plus haute | livret, « Création » et « Capacités » ; lisez_moi |
| 10 points de capacité, hors capacités de niveau 0, au coût de la progression : niveau 1 = 1 point, 2 = 3, 3 = 6. Le joueur monte des capacités (jusqu'au niveau 3) tant que le total ne dépasse pas 10 ; le reliquat (10 − dépensés, jamais négatif) s'inscrit sur la fiche. Des capacités reçues au-delà de 10 : aucune montée, et le total réel | livret, « Création » et « Progression » |
| Une capacité reçue deux fois (deux armes qui donnent « Frappe ») : une seule capacité, comptée une fois, avec ses deux origines | lecture du livret, § 12 |
| Une capacité absente de `Capacites` : « capacité à venir », hors du décompte | instruction du lot 2 |
| Groupes : `( a \| b )` exactement une option ; `[ a \| b ]` zéro, une ou plusieurs | lisez_moi, « Syntaxe » |
| Coût affiché : souffle et lien à la puissance de la capacité (N remplacé), la variante de sa puissance ; un coût vide vaut 0, X reste X | lisez_moi |
| Style de combat : une capacité est un style si ses éléments propres contiennent « Style de combat », une maîtrise s'ils contiennent « Maîtrise » ; sinon les options d'un archétype s'affichent sous « Archétype » | convention, § 12 |
| Attaque à mains nues : la capacité que vise le paramètre `degats` du bloc de base ; ses dégâts sont ceux que dit sa description à sa puissance (`[N*{degats}]` : 2/4/8 au niveau 1 avec une Force de 4, le double au niveau 2), sinon le paramètre lui-même, si bien que le recto et le verso concordent ; **dé vide**, faute de règle | classeur ; § 12 |
| Bouclier : un objet équipé (place `equipe`) qui transmet un paramètre `defense` ; un seul compte ; la fiche en montre la défense après qualité | convention, § 12 |

**Mesures.** Chaque règle a ses contrôles, vus échouer puis passer : 62
mutations des règles, du format et du lien, désarmées une à une, font
échouer un contrôle, sauf une, équivalente (compter les capacités de
niveau 0, dont le coût est nul). Au lot 2 bis, 62 mutations de plus (E7,
A10, packs, format 2 et sa conversion, places, parcours, dépôt en ligne,
mot de passe), une survivante équivalente (la borne de 6 d'une
caractéristique, que le bouton inactif et le format gardent déjà), et 25
pour les corrections de la relecture finale, toutes vues échouer. Banc du
29/09/2026 sur le classeur réel, hors dépôt : les 320 combinaisons
d'archétype, d'espèce et de primordial se calculent sans manque ni
exception ; au banc du 30/09/2026 (lot 2 bis), 1 280 combinaisons, avec
l'arme et les packs, aucun E7 ni A10, les packs lourd, agile et précis
proposés (6, 6 et 5 pièces), 108 descriptions évaluées sans crochet
restant.

### 15.3 Le parcours et les écrans

**Personnages** (`#/personnages`, `js/ecrans/personnages.js` ; « Mes
personnages » jusqu'au lot 2) : **en ligne**, tous les personnages du site,
et ceux que l'appareil vient d'envoyer (« visible par tous d'ici quelques
minutes ») ; **à part**, ceux de l'appareil : les non-envoyés, avec la raison
et « Réessayer » (ou « Envoyer en ligne » pour un personnage du lot 2), et
les brouillons, dont les copies de travail (« copie de travail de … »).
Créer, ouvrir, reprendre, **modifier**, supprimer (après confirmation dans
la page : de l'appareil pour un brouillon ou un non-envoyé, **pour tous**
pour un personnage en ligne, l'historique de GitHub gardant chaque
version), enregistrer le fichier, importer un fichier, ouvrir sur mon
téléphone ; en démonstration, « Ajouter le personnage de démonstration », et
la phrase « La démonstration ne dépose rien en ligne ». Les personnages
illisibles, de l'appareil ou du site, sont comptés, jamais montrés ; ceux
d'une ancienne clé de table aussi, à part ; un mot de passe changé pendant
la visite se dit (« rechargez la page »). Une copie de l'appareil plus
ancienne que la version en ligne se montre avec « Envoyer quand même »
(après confirmation) et « Retirer de l'appareil » ; une suppression qui
n'est pas partie, avec le nom gardé par sa note et « Réessayer ». Un
personnage déjà
présent (même identifiant) : la question montre les deux versions (nom,
état, date), et dit en clair quand la version reçue est un brouillon face
à une version enregistrée, ou plus ancienne ; remplacer est définitif.

**Le parcours** (`#/personnage/<id>/etape/<n>`, `js/ecrans/creation.js`) :
neuf étapes, un **brouillon enregistré à chaque changement**, un retour en
arrière toujours possible, et une zone « Ce qui manque » toujours présente
(`parcours.js`). Chaque changement se vérifie comme un fichier reçu avant
d'être gardé ; une montée dont la capacité n'est plus possédée (archétype,
option ou objet changé) s'efface. Sur un téléphone, la liste des neuf
étapes vient après le contenu de l'étape : en tête, elle repoussait chaque
champ sous le pli. **Partout où le joueur choisit, chaque capacité en jeu
se présente avec sa description**, ses `[N]` et expressions évalués au
niveau 1, avec les caractéristiques du personnage et les paramètres du bloc
qui la donne (`descriptionA`) : dépliée sur un grand écran, à déplier sous
son nom sur un téléphone ; une description ouverte ou fermée le reste quand
l'étape se redessine, et le focus va au bouton actionné, ou à son voisin
quand il devient inactif. Un refus (une pièce qui ne se porte pas) se dit
près de ce qui l'a causé, et le focus y va. 1. Identité (nom obligatoire ; âge, description,
histoire). 2. Caractéristiques : toutes à 2 au départ, des **boutons + et
−** de 2 à 6, la somme en direct (36 exigés : « + » s'arrête à 36), l'aperçu
des dés. 3. Archétype : chaque archétype avec ses capacités décrites, puis
les groupes de choix du choisi, chaque option décrite, nommés « Style de
combat » ou « Maîtrise » d'après la convention du § 15.2. 4. Espèce, de
même. 5. Constellation : « Tirer au sort » (`crypto.getRandomValues`, sans
biais : les valeurs au-delà du dernier multiple sont rejetées), puis
« Refaire le tirage », à volonté, chaque tirage compté ; ou « Saisir le
tirage fait à la table » (marqué « saisie à la main » sur la fiche) ;
revenir à « — choisir — » ne défait rien. 6.
Primordial, décrit, puis ses groupes. 7. Équipement, en **trois entrées** :
« Arme », une seule, tenue d'office (changer d'arme la remplace), avec le
catalogue replié des armes et de ce qu'elles donnent ; « Pack
d'armure », un par type, formé de toutes les pièces de ce type, portées
d'office, un type à deux pièces sur une zone proposé inactif avec sa raison
(A10) ; « Tous les objets », armes, pièces isolées, bouclier, consommables
et équipement, **rangés dans le sac** : une pièce se porte si aucune pièce
portée ne couvre déjà ses zones, un bouclier s'équipe (un seul), une arme
se prend en main à la place de l'arme tenue. Qualité 2 d'office, sans
champ : elle se change sur l'écran du personnage. Chaque objet montre les
capacités qu'il donne, décrites, et l'objet choisi dans la liste se décrit
avant d'être ajouté. 8. Capacités : **seules celles qui peuvent
évoluer** (demande de l'auteur, 30/09/2026), même quand les points
manquent, avec des **boutons + et −** dans les bornes (plafond de 10,
niveau 3), la raison d'un « + » inactif (« il manque 2 point(s) »), et leur
description **avant et après l'évolution** ; le compteur « points dépensés
/ 10, reliquat ». 9. Récapitulatif, puis « Enregistrer » : le personnage est
enregistré, garde l'empreinte et la date de la banque, et les empreintes de
ses choix ; en ligne, il part aussitôt (§ 15.8).

**Modifier un personnage enregistré** : « Modifier » (sur sa carte ou sa
fiche) en fait une **copie de travail**, un brouillon sous un nouvel
identifiant, dont la note garde l'original ; l'original ne change pas tant
qu'elle n'est pas enregistrée. « Modifier » de nouveau reprend la même
copie. Au récapitulatif, deux boutons : « Enregistrer », qui remplace
l'original (son identifiant, sa date de création et de premier
enregistrement) et le redépose ; « Enregistrer sous un autre nom », qui en
fait un nouveau personnage (un autre nom exigé), l'original restant tel
quel. Un personnage chargé depuis une banque plus ancienne se recalcule, et
ses choix disparus sont signalés, comme au lot 2. **Une banque publiée avant la colonne « Type »** (la banque
réelle du 29/09/2026) : « Le créateur a besoin d'une banque republiée
depuis le classeur à jour. » ; la consultation continue, et la liste ne
garde que « Enregistrer le fichier » et « Supprimer ».

**La fiche** (`#/personnage/<id>`, `js/ecrans/fiche_personnage.js`) : vue
lecture ou vue fiche, « Imprimer / PDF », « Enregistrer le fichier »,
« Ouvrir sur mon téléphone », « Reprendre la création » pour un brouillon,
« Modifier » pour un enregistré, et « Qualité des objets » (un champ par
objet dont le classeur ne fixe pas la qualité, deux objets de même nom
distingués par leur rang, « (objet 2) » ; « Enregistrer les qualités »
garde le personnage et, en ligne, le redépose ; le panneau reste ouvert, et
le focus va à la confirmation). Un personnage absent de l'appareil s'ouvre
depuis le site (« · en ligne ») ; une lecture en ligne qui échoue le dit,
avec « Réessayer », sans le déclarer introuvable. Le pied de la
fiche dit « constellation tirée N fois » ou « saisie à la main ».

**La réception** (`#/recevoir/<code>`, `js/ecrans/reception.js`) : § 15.1.

### 15.4 La fiche imprimable

**Le recto est le modèle, fidèlement** (`js/fiche/feuilles.js`,
`css/fiche.css`) : sa page de 794 × 1123 pixels (A4 à 96 points par
pouce), ses marges, ses cadres, ses rubriques et leurs hauteurs, ses traits
et ses cases, ses couleurs (dans `jetons.css`, `--fiche-…`, qui restent
claires dans le thème sombre : la fiche est du papier) et ses polices,
**Marcellus et Alegreya Sans, hébergées dans `polices/`** avec leur licence
OFL (décision de l'auteur, 29/09/2026). Chaque règle de `fiche.css` est
préfixée par `.feuille`, et la feuille remet à zéro ce que l'interface
transmet (marges, `box-sizing`, `overflow-wrap`) : les classes de l'une ne
débordent jamais sur l'autre (deux collisions réelles, `.etiquette` et
`.table-des`, ont été mesurées et corrigées). Les chiffres sont alignés (`lining-nums`) : Alegreya Sans les
écrit en bas de casse.

Remplissage : l'en-tête (nom, espèce, archétype, style de combat, niveau
1) ; les caractéristiques ; l'attaque (l'arme principale, son dé, ses
dégâts A/B/C après qualité, sa portée, sa qualité ; sans arme, l'attaque à
mains nues du bloc de base, ses dégâts calculés et un dé vide) ; la défense
(les pièces portées ou « aucune », le dé du § 15.2 et sa mention, la
défense du bouclier après qualité, son nom et sa qualité) ; les capacités
par groupe (espèce ; archétype, maîtrise comprise ; style de combat ;
constellation de naissance, son nom avec « capacités à venir » quand elle
n'en a pas ; acquises en progression, vides à la création ; un titre de
groupe dit « suite au verso » quand des lignes y passent), les cases de
puissance cochées jusqu'au niveau et grisées au-delà du maximum, la colonne
coût (le souffle, et « ·1L » pour un lien), et **« Reliquat : N points »**
près du titre ; le souffle, sous-titré **« 10 à la création · +1 par point
d'historique »** (le modèle dit « 5 par niveau », que le livret contredit),
« Max 10 », les cases au-delà grisées ; l'armure de chaque zone et cinq
cases de résistance ; le corps, 10 ; l'équipement, chaque objet et sa
qualité (« suite au verso » en sous-titre s'il y en a plus de huit) ; le
primordial lié, ses points de lien (cases grisées au-delà) et ses pouvoirs
avec leur puissance (sans capacité : « capacités à venir » sur la première
ligne ; au-delà de trois : « suite au verso »), puis la légende des huit
primordiaux,
reproduite du modèle ; en pied de page, discret, « Banque du JJ/MM/AAAA »
et, s'il y a lieu, « constellation saisie à la main ».

**Le débordement.** Les lignes du modèle sont un minimum, pour la rubrique
entière : les neuf lignes de capacités se partagent entre les groupes (le
modèle en donne 2, 3, 1, 1 et 2 ; un groupe qui n'en a pas besoin rend les
siennes). **Mesuré dans Chromium : le modèle n'a aucune place libre** (la
rubrique des capacités garde 10 pixels, celle de l'équipement 11, moins
qu'une ligne de 18) : aucune rubrique ne peut grandir sans pousser la page.
Ce qui ne tient pas passe donc au verso, sous « Suite du recto » : au-delà
de 9 lignes de capacités (chaque groupe qui en a une garde au moins une
ligne), de 8 objets, de 3 pouvoirs, ou quand les pièces d'armure dépassent
34 signes (« 4 pièces, détail au verso ») (`repartition.js`). **Le recto ne
déborde jamais** : ses rubriques ont la hauteur du modèle, le recto cache
ce qui dépasserait, et la page mesure les rubriques à lignes elles-mêmes
(capacités, équipement, liens) après le chargement des polices, au
changement de vue et avant l'impression ; si une police manque et qu'une
rubrique déborde, une ligne de plus passe au verso. En vue lecture, la
fiche reste mise en page, invisible et sans hauteur, pour être mesurée.

**Le verso** (une page ou plus, dans le même style) : la suite du recto ; le
contexte (nom, âge, description, histoire) ; l'historique, avec des lignes
vides ; toutes les armes (type, dé, dégâts, portée, qualité) ; le détail de
toutes les capacités, bloc de base et équipement compris (nom, origine,
niveau, coût, éléments, description évaluée) ; les points de capacité ; les
capacités à venir (dont « Givre éternel : capacités à venir » pour un
primordial ou une constellation sans capacité) et les avertissements.

**L'impression.** `@page` A4 sans marge ; le recto fait 210 × 297 mm et
finit sa page ; le verso a sa page nommée, à marges, sur la couleur du
papier ; les couleurs se gardent (`print-color-adjust: exact`), même quand
le navigateur n'imprime pas les arrière-plans. « Imprimer / PDF » attend les
polices, mesure, puis imprime, quelle que soit la vue : la vue lecture ne
masque la fiche qu'à l'écran. Mesures du 29/09/2026 :
dans Chromium, les huit rubriques et 97 repères du recto (cases, traits,
zones, en-tête, silhouette) coïncident au pixel avec le modèle ; Firefox 143
sans fenêtre (WebDriver BiDi) imprime le personnage de démonstration en
**deux pages**, le recto seul sur la première.

### 15.5 Le téléphone

**La vue lecture** : les rubriques empilées, dans les styles de
l'interface, lisibles sans zoom ; le détail de chaque capacité se déplie,
et un triangle le dit ; un coût nul s'écrit « sans coût »
(`js/fiche/lecture.js`, `css/personnage.css`). **La vue fiche** : le recto
et le verso réduits à la largeur de l'écran (`zoom`, l'échelle posée par le
code en propriété CSS : la seule écriture de style du code, un nombre), et
le zoom à deux doigts du navigateur, jamais interdit, les agrandit. La vue
se choisit par deux boutons ; par défaut, la vue fiche sur un grand écran,
la vue lecture sur un téléphone ; le choix se garde sur l'appareil.

### 15.6 La sécurité des fichiers et des liens reçus

Tout fichier ou lien reçu est une donnée hostile. **Taille bornée** : un
fichier de plus de 64 Ko n'est pas même lu ; un lien dont le code dépasse
64 Ko est refusé, et sa décompression s'arrête dès 64 Ko : le code entre
par tranches d'un kilo-octet, sans quoi Chromium décompressait tout avant
la première lecture, soit une soixantaine de mégaoctets pour un lien forgé
(relecture du lot 2) ; une bombe de 50 Mo de zéros, compressée sous 64 Ko,
est refusée. Le texte doit être de l'UTF-8 valide. **Schéma vérifié champ par champ**
(`verifier`) : chaque champ, son type, ses bornes (textes de 40 à 12 000
signes selon le champ, listes de 30 à 300 éléments, caractéristiques de 2 à
6, niveaux 2 ou 3, places d'objet connues et une seule arme tenue, dates
ISO), aucun caractère de
contrôle hors les retours à la ligne des textes longs ; un champ inconnu ou
manquant fait refuser, y compris `__proto__` ; une liste abîmée (un trou,
une clé en plus, qu'IndexedDB peut garder et JSON jamais) aussi. Un
personnage enregistré est complet : un nom, neuf caractéristiques de somme
36, un archétype, une espèce, une constellation et un primordial. **Aucune insertion de HTML**,
comme partout (§ 10.1) : un nom qui contient du HTML s'affiche tel quel.
**Les noms** ne renvoient qu'à des recherches dans la banque ; ceux qui ne
renvoient à rien sont signalés, jamais exécutés. Ce qui se lit de l'appareil
se vérifie de même : l'origine est partagée par les sites GitHub Pages du
compte (§ 7.3). Un personnage d'un autre mode est refusé.

### 15.7 La démonstration

Le classeur d'essai a de quoi créer un personnage (§ 10.3), et la banque de
démonstration en est tirée. **Le personnage de démonstration**, Aubépine
Crèmebrûlée, Marmitonne Saucière, est fourni prêt à imprimer :
`essais/personnage_demo.arpenteur.json`, fabriqué par
`outils/personnage_demo.js` contre la banque de démonstration (à relancer
après chaque régénération de celle-ci ; un contrôle le vérifie). Il exerce
chaque règle : une montée, une constellation sans capacité tirée trois
fois, un primordial à capacité variable, une arme tenue, des armures de
types mêlés portées seules, un bouclier équipé, des objets dans le sac, des
qualités X, 1, 2 et 3, et un recto qui déborde (neuf objets, quatre pièces
d'armure). « Ajouter le personnage de démonstration » le range sur
l'appareil, en démonstration seulement. Le classeur d'essai a trois packs
d'armure : agile (tablier de cuir, maniques, toque), lourd (plastron),
précis (guêtres). La démonstration ne dépose rien en ligne et ne lit rien
en ligne : ses personnages restent sur l'appareil, et l'écran le dit.

### 15.8 Les personnages en ligne (lot 2 bis)

**Le principe** (option B, décision de l'auteur, 30/09/2026). Le site ne
détient aucun droit d'écriture sur le code ni sur la banque. Un personnage
enregistré part, **chiffré avec la clé de table**, dans un **ticket GitHub**
(*issue*), ouvert avec la **clé de dépôt** que porte la banque (§ 8.4) ; un
**automate** de GitHub le range dans le dépôt. Les personnages en ligne sont
**visibles par tous les joueurs** qui ont le mot de passe, et **modifiables
par tous** (créer, modifier, supprimer) ; l'historique de GitHub garde
chaque version, et l'auteur peut en restaurer une. Rien n'est en clair sur
GitHub.

**Le chiffré** (`js/personnage/en_ligne.js`). Le personnage enregistré, au
format du § 15.1, vérifié, 64 Ko au plus, compressé (`deflate-raw`), puis
chiffré en AES-GCM sous la clé de table, IV neuf de 12 octets ; ses données
associées sont son identifiant (`atelier-des-arpenteurs/personnage/1/<id>`) :
un chiffré recopié sous un autre identifiant ne se déchiffre pas. Le sel de
la banque l'accompagne : il dit sous quelle clé il a été fait. Seul un
personnage enregistré, de la banque réelle, part.

**Le ticket.** Titre `personnage` ; corps, une ligne de JSON, 64 Ko au plus,
en ASCII :

```json
{ "format": 1, "action": "creer", "identifiant": "Qx7-aZ_09bcdEFGHijklmn", "date": "2026-09-30T10:21:36.536Z",
  "personnage": { "sel": "base64 16 octets", "iv": "base64 12 octets", "contenu": "base64" } }
```

`action` vaut `creer`, `remplacer` ou `supprimer` ; `personnage` accompagne
les deux premières, jamais la troisième. L'identifiant suit le motif du
format (`[A-Za-z0-9_-]{16,40}`) ; la date est UTC stricte ; le base64 est
strict (remplissage exigé). Un personnage trop gros pour un ticket ne part
pas, avec sa raison.

**Le fichier rangé** `personnages/<identifiant>.chiffre.json` : `format`,
`identifiant`, `depose_le` (la date du ticket), `range_le` (l'heure de
l'automate), `ticket` (son numéro), `sel`, `iv`, `contenu` ; 96 Ko au plus ;
il doit porter l'identifiant de son chemin. **L'index**
`personnages/index.json` : `format` et la liste des personnages, triés par
identifiant, chacun `identifiant`, `range_le` et `version` (l'IV en
base64url, qui change à chaque chiffrement) ; **aucun nom** ; deux
identifiants qui ne diffèrent que par la casse y sont refusés (le clone de
l'auteur, sous Windows, les confondrait) ; 5 000 personnages au plus.

**L'automate** (`outils/automate_personnages.js`, workflow
`.github/workflows/personnages.yml`, déclenché à l'ouverture d'un ticket, ou
à la main). Il balaie à chaque passage **tous les tickets ouverts**, par
ordre de création, les demandes de fusion laissées. Il lit deux listes : les
tickets du propriétaire, et tous les ouverts ; chacune s'arrête à 100 pages
de 100 tickets (au-delà, les plus anciens passent, les suivants au passage
d'après). Les passages ne se chevauchent pas (groupe `personnages`, sans
annulation) ; un passage en attente peut être remplacé par le suivant, qui
rattrape ses tickets.

- Le ticket d'un **autre que le propriétaire** du dépôt (login et numéro de
  compte) est fermé (« non prévu ») et verrouillé, sans être lu ni commenté,
  même si la partie git du passage s'arrête, mais après les tickets du
  propriétaire (le jeton d'un workflow a droit à 1 000 appels par heure).
- Le ticket du propriétaire doit porter le titre `personnage` et un corps
  que `lireTicket` accepte. Sont refusés aussi : un identifiant en forme de
  jeton GitHub ; un contenu qui se lit comme du texte ; un **sel qui n'est
  pas celui de la banque en place** (le chiffré est périmé : le mot de passe
  a changé) ; un identifiant qui ne diffère d'un personnage présent, ou d'un
  autre ticket du passage, que par la casse ; un 5 001ᵉ personnage. Un refus
  ferme (« non prévu ») et verrouille, avec un commentaire fait d'une phrase
  fixe : rien du ticket n'y est recopié. Tout ticket du propriétaire qui
  n'est pas un dépôt conforme est ainsi fermé : l'auteur ne se sert plus des
  tickets de ce dépôt pour autre chose.
- « creer » et « remplacer » écrivent le fichier rangé, « supprimer »
  l'efface s'il existe : l'état final de chaque personnage se calcule, puis
  se compare aux fichiers de la branche, et seul ce qui diffère s'écrit ou
  s'efface (des tickets rejoués qui aboutissent au chiffré déjà rangé ne
  réécrivent rien, pas même la date). L'index est ensuite régénéré à partir
  des fichiers présents. Un fichier illisible ou un intrus dans
  `personnages/` arrête le passage sans rien commiter ; de même, après
  l'ajout à l'index de git, un fichier de `personnages/` que cacherait le
  `.gitignore` de la branche.
- Seuls des chemins de `personnages/`, sous ces deux formes, partent. Le
  commit porte l'identité du robot et un message sans nom (« Personnages :
  tickets n° 12, 14 »). Un envoi refusé (un commit arrivé entre-temps) fait
  tout reprendre depuis la branche distante, banque et tickets rejugés, cinq
  fois au plus.
- Après l'envoi seulement : la **demande de construction de GitHub Pages**
  (`pages: write`, § 10.2), puis la fermeture (« fait ») et le verrouillage
  des tickets rangés, et la fermeture des autres. Sans rien à commiter, les
  tickets se ferment quand même. Lancé à la main (« Run workflow »),
  l'automate redemande toujours la construction, même sans commit : c'est le
  rattrapage d'une demande refusée, qui marque le passage en échec. Limite
  connue : GitHub annonce une limite souple de 10 constructions par heure
  pour un site publié depuis une branche, sans dire ce qu'il fait au-delà (à
  vérifier à l'usage).
- Rien d'un ticket n'est exécuté ni passé à une commande : git s'appelle
  sans shell, et le chemin est fait de l'identifiant vérifié. Le jeton ne
  sert qu'à l'API et à la seule commande `git push`, par l'environnement de
  celle-ci (`GIT_CONFIG_*`) ; la variable où le workflow le place est ôtée
  de l'environnement de toute commande git ; il n'est jamais écrit sur le
  disque.

**La page** (`js/personnage/depot.js`). **Déposer** : à l'enregistrement
(« creer », ou « remplacer » pour une copie de travail enregistrée à la
place de l'original, § 15.3), au changement des qualités, et à « Supprimer »
d'un personnage en ligne. Avant d'ouvrir un ticket, la page relit sans cache
l'en-tête de la banque en place : si son sel n'est plus celui de sa clé, et
que cette banque n'est pas plus ancienne que celle de la page, le mot de
passe de table a changé, et rien ne part (« rechargez la page »). Plus
ancienne (juste après un changement fait de cet appareil, GitHub Pages en
retard), c'est le site qui est en retard : le dépôt part, et l'automate juge
sur la banque du dépôt. Une version en ligne plus récente que la copie de
l'appareil, connue de la page, arrête l'envoi (« l'envoyer la
remplacerait ») ; le joueur peut l'envoyer quand même, après confirmation.
**Lire** : l'index sans cache (`?v=<horodatage>`, `no-store`), puis chaque
fichier par sa version (`?v=<version>`), vérifié, déchiffré, le personnage
vérifié comme un fichier reçu (§ 15.6), du bon identifiant, enregistré, de
la banque réelle ; une seconde lecture ne redemande pas un fichier de même
version. Un fichier illisible se compte à part ; un fichier d'une autre clé
aussi, de deux façons : si sa clé est celle de la banque en place, c'est le
mot de passe qui a changé pendant la visite (« rechargez la page ») ; sinon,
c'est un fichier d'une ancienne clé, pas encore rechiffré. Une fiche ouverte
par son lien distingue « ni sur cet appareil, ni en ligne » d'une lecture
qui a échoué (« ne se lit pas pour l'instant », avec « Réessayer »).
**Sur l'appareil**, une note garde l'état de chaque dépôt : « non
envoyé » (pas de réseau, clé révoquée, droits, dépôt pas encore ouvert),
avec sa raison et « Réessayer » ; « envoyé » : le personnage reste sur
l'appareil, « visible par tous d'ici quelques minutes », jusqu'à ce que la
version en ligne le rattrape (sa date de modification au moins aussi
récente) ; il quitte alors l'appareil. Au-delà de 15 minutes sans
apparaître, il repasse sous « Réessayer ». Une copie de l'appareil plus
ancienne que la version en ligne ne la cache pas : elle se montre à part,
avec « Envoyer quand même » et « Retirer de l'appareil ». Une suppression
envoyée cache la version en ligne jusqu'à ce qu'elle quitte l'index ; sa
note, qui garde le nom du personnage, ne s'efface que si l'index s'est lu
et ne porte plus l'identifiant : une suppression non envoyée se montre avec
« Réessayer », même quand la version en ligne ne se lit pas. Les brouillons
restent locaux jusqu'à « Enregistrer ». **Le délai** : l'automate, puis
GitHub Pages (une à deux minutes, puis jusqu'à dix minutes de cache, que
l'adresse unique de l'index contourne).

**Sans clé de dépôt dans la banque** (tant que l'auteur ne l'a pas publiée),
un personnage enregistré reste sur l'appareil, « non envoyé », avec la
phrase « Le dépôt en ligne n'est pas encore ouvert… ». **La démonstration ne
dépose rien et ne lit rien en ligne** : ses personnages restent sur
l'appareil, et l'écran le dit.

**Le changement de mot de passe** : § 8.4. Les personnages en ligne sont
rechiffrés dans le même commit que la banque ; l'automate refuse ensuite
tout dépôt fait sous l'ancienne clé.

**Les risques acceptés** (§ 7.3) : qui a le mot de passe lit tous les
personnages en ligne, et, avec la clé de dépôt de la banque, peut en créer,
modifier ou supprimer ; il peut aussi choisir un identifiant qui épelle un
mot, ce que rien ne détecte. Qui n'a pas le mot de passe ne voit que des
identifiants, des dates et des tailles.
