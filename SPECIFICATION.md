# L'Atelier des Arpenteurs — spécification

**Version 1.4 — 12/10/2026.** Le lot 1 est en service ; le lot 2, le
créateur de personnage (§ 15), le lot 2 bis, ses améliorations et les
personnages en ligne (§ 15.8), et le lot 3, les adversaires (§ 16), sont
livrés. Le lot 4, le simulateur de combat (§ 17), en est à la fin de son
groupe 1, le combat jouable ; son groupe 2 suivra un arrêt d'essais (§ 13).
Ce document fait foi pour le code. Toute décision
qui le contredit y est reportée, avec une entrée de révision et un numéro de
version (§ 14). Le nom « L'Atelier des Arpenteurs » est validé par l'auteur ;
le dépôt s'appelle `atelier-des-arpenteurs`.

---

## 0. Lire ceci d'abord

**Ce qu'est ce programme.** Un site web statique, hébergé par GitHub Pages,
qui sert aux joueurs et au MJ des *Arpenteurs d'Abrasia* à consulter la banque
du jeu (blocs, capacités, éléments, adversaires, prétirés), à créer des
personnages, des adversaires et des objets, avec une sortie PDF, et à jouer
un combat à la main (§ 17).

**Trois sources, et une seule fait foi pour les règles.**

| Source | Rôle | Lue par le programme ? |
|---|---|---|
| `Principe jdr abrasia.docx` (le Word) | **les règles du jeu**, lisibles par un humain qui part de zéro | non |
| `regles_jdr.xlsx` (classeur des règles) | les données : blocs, capacités, éléments, et, depuis le lot 3, les adversaires (§ 16) | oui, à l'import |
| second classeur (à venir, nom à fixer) | prétirés | oui, à l'import |

**Le programme n'invente aucune règle.** Quand un lot a besoin d'une règle que
le Word ne dit pas, on ne la devine pas : on l'inscrit au § 12 comme « à
écrire dans le Word, section … », et on s'arrête sur ce point. L'auteur ne
répond pas aux questions de règles en conversation ; il les écrit dans le Word.

**Une exception, écrite : le simulateur de combat (lot 4).** Le livret ne
dit pas tout du combat, et un simulateur ne peut pas s'arrêter à chaque
silence. Il applique des **conventions provisoires**, toutes inscrites au
§ 12 (« Pour le lot 4 — simulateur de combat ») : les unes acceptées par
l'auteur le 11/10/2026, d'autres tranchées par la mission du 12/10/2026,
les dernières arrêtées en écrivant le moteur ; toutes sont à confirmer à
l'arrêt d'essais. Elles priment jusqu'à la réécriture du livret, jusque là
où elles s'en écartent (§ 2, § 17). Pour toute autre règle absente, il
n'invente rien et laisse la main au joueur.

**Les cinq interdits.**

1. **Aucun classeur réel dans le dépôt.** Le dépôt est public. Seuls les
   classeurs d'essai fictifs de `essais/` y entrent (§ 10.3).
2. **Aucune donnée réelle en clair dans le dépôt**, hors les exemples de
   cette spécification, réels mais non confidentiels (décision de l'auteur,
   28/09/2026), et la légende des huit primordiaux du modèle de fiche,
   reproduite sur la fiche de personnage (décision de l'auteur, 29/09/2026,
   § 15.4). La banque publiée est chiffrée (§ 7), les personnages en ligne
   aussi (§ 15.8) ; des contrôles le vérifient. Depuis le lot 4, aucun
   nouveau nom de bloc, de capacité, de type ou d'adversaire du vrai
   classeur n'entre dans le dépôt, exemples de cette spécification compris
   (§ 17).
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
3. Les **adversaires** (lot 3, § 16) : leurs types, chaque adversaire
   résolu, et la carte imprimable d'une rencontre. L'éditeur d'adversaire
   dans la page et l'assistant de calibrage viendront dans un lot ultérieur.
4. Un **simulateur de combat** (lot 4, § 17) : des personnages du site et
   des adversaires de la banque sur une carte de 10 × 10 cases, un combat
   joué à la main, dé après dé, dont les règles générales s'appliquent
   seules ; il est gardé sur l'appareil, chiffré, et son journal se copie
   et se télécharge.
5. La **progression du personnage**, puis un **créateur d'objets, de sorts
   et d'équipement** (lots à fixer, § 13).
6. L'**export PDF** de chaque création, depuis un ordinateur ; la vue d'un
   personnage sur téléphone, adaptée à l'écran et zoomable.

**Hors périmètre.** Serveur, base de données, comptes utilisateurs (les
personnages en ligne passent par des tickets GitHub et un automate de
GitHub, § 15.8). Écriture
dans un classeur. PDF sur téléphone en première version (lot des
finitions, § 13). Un combat partagé entre appareils, et tout jeu automatique
des adversaires (§ 17). Tout lien
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
| **Deux classeurs** : règles d'un côté, prétirés de l'autre (à venir) | choix de l'auteur, pour ne pas mélanger. Les **adversaires**, d'abord prévus dans le second, vivent depuis le 11/10/2026 dans une feuille du classeur des règles, facultative : ils citent ses blocs et ses capacités, que le contrôle vérifie dans le même classeur (§ 16.1) |
| **Le Word fait foi** pour les règles | l'auteur veut que n'importe qui puisse comprendre le jeu en relisant le Word depuis zéro ; seule exception, les conventions provisoires du combat (plus bas) |
| **PDF par l'impression du navigateur**, sur ordinateur | aucune dépendance ; le PDF sur téléphone n'est pas une priorité |
| Le dossier du dépôt reste dans **OneDrive** | choix de l'auteur ; précautions au § 10.3 |
| Un **lecteur XML écrit pour le projet**, le même dans la page et dans les contrôles | avec deux lecteurs, les contrôles vérifieraient un code que la page n'exécute pas (§ 6.1) |
| Le **sel** du chiffrement ne change qu'avec le mot de passe | la clé gardée sur un appareil doit déchiffrer les publications suivantes (§ 7.1) |
| Le **cache de GitHub Pages** (`max-age=600`) est accepté ; une page restée 15 secondes sur « Chargement » propose de recharger | un numéro de version dans les adresses des modules ne vaudra la peine que si le cache gêne à l'usage (§ 9) |
| La **première vraie publication** suit le groupe 3, sans attendre les corrections du classeur ni du Word | les erreurs sont publiées en connaissance de cause (§ 6.3) ; l'auteur publie lui-même, guidé par Claude (§ 13) |
| Le **créateur de personnage** est le lot 2, avant l'adversaire (lot 3). Le **simulateur de combat** est le lot 4 ; la progression du personnage, les objets et sorts, puis les finitions suivent, sans numéro | décisions de l'auteur, 29/09/2026, puis 12/10/2026 (mission du lot 4, § 13) |
| Les **règles chiffrées du personnage vivent dans le code**, chacune avec la section du livret qui la fonde | le livret n'est pas lu par le programme ; une règle se retrouve ainsi dans sa source (§ 15.2) |
| Un **personnage garde ses choix, pas des copies** de la banque | sa fiche suit la banque du jour et en imprime la date ; un fichier ou un lien ne transporte aucune donnée de la banque (§ 15.1) |
| Le personnage part vers le téléphone **dans le fragment de l'adresse** | aucun serveur ; le fragment n'est jamais envoyé ; le code QR viendra plus tard (§ 15.1) |
| Les **polices du modèle de fiche** (Marcellus, Alegreya Sans) sont **hébergées dans le dépôt** | la fiche imite le modèle ; aucune connexion à un tiers, que la politique de sécurité interdit (§ 15.4) ; licence OFL |
| Les **personnages en ligne passent par une file d'attente** : un ticket GitHub ouvert avec une clé de dépôt (permission Issues seule), qu'un automate de GitHub range dans le dépôt | le site ne détient aucun droit d'écriture sur le code ni sur la banque ; pas de serveur à entretenir (décision de l'auteur, lot 2 bis, option B ; § 15.8) |
| Les personnages en ligne sont **chiffrés avec la clé de table**, visibles par tous les joueurs qui ont le mot de passe, et **modifiables par tous** | rien en clair sur GitHub ; une table de confiance ; l'historique de GitHub garde chaque version, et l'auteur peut en restaurer une (décision de l'auteur, lot 2 bis) |
| Le **mot de passe de table** : 8 signes au moins, **insensible aux majuscules** | plus simple à transmettre et à saisir sur un téléphone ; risque accepté par l'auteur (§ 7.3) |
| Les **règles des adversaires** sont des décisions de l'auteur du 11/10/2026, que le livret ne dit pas encore | sa section « Caractéristiques d'un adversaire » tient en une phrase ; chacune est inscrite au § 12, et vaut pour les seuls adversaires (§ 16) |
| **Un seul module** résout un adversaire, pour le contrôle de l'import comme pour l'affichage ; la banque garde les lignes brutes | ce que le rapport annonce est ce que l'écran montre ; un lot futur réinterprète sans nouvel import (§ 16.2) |
| **Pas de mot de passe du MJ** : les adversaires se lisent avec le mot de passe de table | une table de confiance, comme pour les personnages ; décision de l'auteur, lot 3 |
| La **carte d'adversaire** a l'identité de sa maquette, et sa police, EB Garamond, est **hébergée dans le dépôt** | elle est du papier, comme la fiche de personnage ; aucune connexion à un tiers (§ 16.5) ; licence OFL |
| Le simulateur de combat est **assisté, et joué à la main** : les règles générales du combat s'appliquent seules ; l'effet propre d'une capacité, écrit en texte libre dans le classeur, s'applique à la main, sa description toujours sous les yeux ; aucune intelligence artificielle, l'utilisateur joue tous les protagonistes et lance chaque dé d'un clic | décision de l'auteur, lot 4 : lire seul l'effet d'une capacité demanderait une colonne codée dans le classeur, qui n'existe pas (§ 17) |
| Les **conventions provisoires** du combat priment jusqu'à la réécriture du livret | le livret ne dit pas tout du combat, et le simulateur ne peut pas s'arrêter à chaque silence : l'auteur en a accepté une partie le 11/10/2026, la mission du 12/10/2026 a tranché le reste pour qu'aucun choix ne reste ouvert ; toutes sont au § 12, à confirmer à l'arrêt d'essais. Pour toute autre règle absente, le simulateur laisse la main au joueur |
| Un combat est **une mise en place, puis une suite d'événements**, dés compris ; l'état et le journal se recalculent en les rejouant, par **un seul moteur, sans page ni hasard** | l'écran, le rechargement, les contrôles et le banc passent par le même chemin ; un dé déjà lancé n'est jamais relancé (§ 17.1, § 17.8) |
| Un protagoniste entre au combat par une **photographie** de ses valeurs | republier la banque ou modifier un personnage ne change pas un combat commencé (§ 17.2) |
| Le combat se garde **sur l'appareil, chiffré par la clé de table**, dans une base à part | il porte des valeurs de la banque, qui ne s'écrit jamais en clair sur un appareil (§ 7.2, § 17.8) |
| Les capacités que le simulateur sait jouer seul se reconnaissent **à leur nom** ; ceux du vrai classeur ne sont dans le code que **par leur empreinte** | aucun nom du vrai classeur n'entre dans le dépôt, qui est public (interdit 2) ; un nom changé dans le classeur se voit à la préparation (§ 17.6) |
| **Vert pour les personnages, rouge pour les adversaires**, à l'écran du combat | demande de l'auteur ; c'est une exception à « une seule couleur d'accent », et jamais la couleur seule : initiales, noms, listes, ✓ et ✗ la doublent (§ 9, § 17.7) |

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
  jetons.css                toutes les valeurs de mise en page en variables, dont les onze couleurs du combat (§ 17.7)
  ecran.css                 l'interface, pensée pour le téléphone d'abord ; les deux vues d'un adversaire et la rencontre (§ 16.6)
  personnage.css            l'écran d'un personnage : vue lecture, vue fiche
  fiche.css                 la fiche imprimable, reproduction du modèle (§ 15.4)
  adversaire.css            la carte d'un adversaire, reproduction de la maquette, et son impression (§ 16.5)
  combat.css                l'écran du simulateur de combat, ses trois dispositions et ses deux couleurs de camp (§ 17.7)
polices/                    Marcellus, Alegreya Sans et EB Garamond (woff2), et leurs licences OFL
js/
  application.js            démarrage, routes, chargement de la banque
  veille.js                 script classique : 15 s sur « Chargement », il propose de recharger (§ 9)
  routes.js                 les adresses des écrans, décodées sans exception ; #/combat depuis le lot 4
  lecture/
    zip.js                  lecteur d'archive ZIP (DecompressionStream)
    xml.js                  lecteur XML du projet, le même pour la page et les contrôles
    xlsx.js                 feuilles, chaînes partagées, cellules → tableaux
  banque/
    noms.js                 comparaison des noms : exacte, puis sans casse, accents, espaces ni signe invisible ; les signes invisibles retirés (§ 6.3)
    notation.js             analyse de la notation des classeurs (§ 6.2)
    importation.js          classeur → banque
    controle.js             contrôle de cohérence → anomalies (§ 6.3)
    differences.js          banque publiée ↔ banque importée, résumé d'une ligne
    dates.js                date de publication (§ 5.1) et date lisible
    chargement.js           téléchargement et déchiffrement de la banque, démonstration
    consultation.js         renvois, « octroyée par », « porté par », nom affiché ; la liste de chaque catégorie, l'index de résolution des adversaires
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
    disponibles.js          les personnages qu'on peut ajouter à un combat, lus sans rien écrire sur l'appareil (§ 17.2)
  adversaire/               les adversaires (§ 16)
    notation.js             les cellules de la feuille Adversaires : types, localisation, nombres, listes (§ 16.1)
    resolution.js           le seul module qui résout un adversaire, pour le contrôle comme pour la page (§ 16.2) ; la règle de position des maîtrises, partagée avec le combat (§ 16.4)
    controle.js             les constats de la feuille Adversaires (§ 6.3)
    carte.js                la carte d'un adversaire résolu (§ 16.5)
    lecture.js              la vue lecture d'un adversaire : chaque valeur et sa provenance (§ 16.6)
  combat/                   le simulateur de combat (§ 17) ; le noyau, sans page, sans banque, sans hasard ni heure :
    regles.js               les constantes du combat, chacune avec sa source ; la racine du graphe du noyau
    forme.js                la forme de ce qui se garde (événement, photographie, contenu), vérifiée avant tout rejeu
    plateau.js              les cases de la carte, la distance, la pose d'office
    noms.js                 le nom court, le jeton et les initiales de chaque protagoniste
    preparation.js          la mise en place d'avant le lancement, ses plafonds et ses refus
    jet.js                  la chaîne d'un jet : réussites, avantage, désavantage, dé explosif
    valeurs.js              toute lecture d'un protagoniste et du geste en cours
    circonstances.js        qui lance, quel dé, contre quoi ; modificateurs, avantages et désavantages avec leur source ; les passifs câblés
    degats.js               la lettre, la localisation, les dégâts zone par zone, dégrossir, l'esquive, la blessure, la mort
    offre.js                la seule porte : ce qui est permis à cet instant, et pourquoi le reste ne l'est pas
    moteur.js               le réducteur : un état, un événement, l'état suivant ; le rejeu d'un combat gardé
    journal.js              chaque ligne du journal, son en-tête, le nom du fichier, les annonces
    lecture.js              les cinq vues que l'écran affiche, chaque bouton avec sa commande ou sa raison
                            et le bord, qui touche le hasard, la banque, la clé et l'appareil :
    des.js                  la source de dés de l'écran (crypto.getRandomValues, sans biais)
    roles.js                le seul tableau des rôles câblés : noms de la démonstration en clair, ceux du vrai classeur par empreinte (§ 17.6)
    photographie.js         fige les valeurs d'un personnage ou d'un adversaire à son ajout ; dit qui ne s'ajoute pas
    enregistrement.js       le combat chiffré, sa base IndexedDB, la file des écritures, la révision (§ 17.8)
    seance.js               le lien entre l'écran, le moteur et l'enregistrement
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
    fiche_adversaire.js  fiche_type.js  rencontre.js
    combat.js               l'écran du simulateur de combat ; le seul module qui garde le combat en mémoire (§ 17.7)
    combat_plateau.js  combat_fiches.js  combat_action.js  combat_preparation.js
                            ses quatre parties : la carte, les fiches vivantes, le panneau d'action, la préparation
    partage.js              fichier et lien d'un personnage
    echelle.js              l'échelle d'un papier à l'écran : la seule écriture de style du code (§ 10.1)
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
  outils/                   fabrique de classeurs, description du classeur d'essai, personnage d'essai, document simulé des écrans ;
                            pour le combat : photographies d'essai, dés imposés, lecteur de scénario, combat de référence fictif,
                            IndexedDB simulée, espion du stockage (§ 17.10)
  banc_classeur_reel.js     bancs sur le classeur réel (§ 6.3), lancés à la main
  banc_combat_reel.js       banc du combat sur le classeur réel et un scénario hors dépôt (§ 17.10), lancé à la main
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

Quatre feuilles, et une cinquième, facultative, depuis le lot 3 :
`Adversaires` (§ 16.1 ; relevée le 11/10/2026 : neuf en-têtes, 5 lignes).
**Les colonnes se retrouvent par leur en-tête, jamais par leur position** :
l'auteur réordonne ses feuilles.

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
naissance » : les deux écritures sont admises (§ 12). Depuis le lot 3,
**« Arme naturelle » et « Armure naturelle »** sont reconnus aussi
(décision de l'auteur, 11/10/2026) : les griffes et les carapaces des
adversaires (§ 16.4). Ils ont leur propre code, si bien que le créateur de
personnage, qui ne demande que les armes et les armures, les ignore, et
qu'un pack d'armure n'en contient pas. Un bloc sans type
(A8) ou d'un type inconnu (A9) reste dans la banque et dans la
consultation, mais le créateur de personnage ne le voit pas. La fiche
d'un bloc et la liste des blocs montrent le type. Banc du 29/09/2026 sur
le classeur réel : chaque bloc a un type reconnu, aucun A8 ni A9.

### 4.2 Le second classeur

Les prétirés, dans un lot à venir. Les adversaires, d'abord prévus ici,
vivent dans la feuille `Adversaires` du classeur des règles (décision de
l'auteur, 11/10/2026 ; § 16.1).

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
  "types_adversaires": [
    { "nom": "Commis", "localisation": "Torse(2), Tête(20)", "actions": "1", "souffle": "2", "attaque": "3",
      "defense": "4", "equipement": "", "capacites": "Pas chassé",
      "brut": { "feuille": "Adversaires", "ligne": 2, "cellules": { "…": "…" } } }
  ],
  "adversaires": [
    { "nom": "Chef de partie", "types": "Commis/Rôtisseur[1,4]", "localisation": "", "actions": "", "souffle": "",
      "attaque": "", "defense": "", "equipement": "", "capacites": "//, Pas chassé[2]",
      "brut": { "feuille": "Adversaires", "ligne": 5, "cellules": { "…": "…" } } }
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
- `types_adversaires` et `adversaires` (lot 3, § 16.1) : une entrée par
  ligne de la feuille Adversaires. Leurs cellules restent des **chaînes,
  telles qu'écrites**, espaces de bord retirés, vides comprises : une
  cellule vide hérite, et c'est la résolution (§ 16.2) qui lit le reste, à
  l'import pour le contrôle comme dans la page. Un type n'a pas de champ
  `types` : sa colonne Type porte son nom. Les deux listes existent même
  vides (feuille absente, I4). Une banque publiée avant le lot 3 n'a aucun
  des deux champs : la consultation la lit comme avant, les écrans des
  adversaires disent « Les adversaires ont besoin d'une banque republiée
  depuis le classeur à jour. », et les différences (§ 6.4) y voient une
  banque sans adversaires.
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
sans accents, sans espaces et sans signe invisible** : un renvoi retrouvé de
la seconde façon est résolu, mais signalé (A1).

**Les signes invisibles** (lot 4). Un nom copié d'une page web ou d'un
traitement de texte peut porter un signe de format que rien ne montre à
l'écran. `js/banque/noms.js` en retire **vingt et un, et eux seuls** :
U+00AD, U+200B à U+200F, U+202A à U+202E, U+2060 à U+2064, U+2066 à U+2069
et U+FEFF.

- **La clé d'un nom** se calcule sans eux. Elle sert à toutes les
  comparaisons approchées du site : les renvois, les en-têtes, les types de
  bloc, la résolution des adversaires, le créateur de personnage. Un renvoi
  écrit avec un tel signe est donc retrouvé, et signalé (A1), au lieu d'être
  dit introuvable sous un nom qui paraît juste.
- **Les doublons** (E3, E16, et A16 qui lit la même table) comparent les
  noms **exactement, après ce retrait**, espaces de bord retirés de
  nouveau : « Marmiton » et « Marmiton » suivi de U+200B font un doublon,
  et « Marmiton » suivi d'une espace puis du signe aussi. **Exactement** :
  la casse, un accent ou une espace au milieu du nom font toujours un autre
  nom, et « marmiton » n'est pas un doublon de « Marmiton ». Le doublon est
  la définition la plus basse de la feuille, et son message cite la ligne de
  la plus haute, quelle que soit celle des deux qui porte le signe.
- **Les fiches** d'un bloc, d'un élément, d'un adversaire et d'un type
  comptent un doublon de la même façon (§ 9, § 16.6) : sous un nom que
  porte une entrée, elles montrent d'abord celles qui le portent tel qu'il
  est écrit, puis celles qui n'en diffèrent que par un signe invisible.
  Sous un nom que rien ne porte exactement, la fiche reste introuvable et
  propose le nom approché.
- **La banque garde chaque nom tel qu'il est écrit**, et les messages le
  citent tel quel. L'import ne change pas : il range les lignes de
  `Capacites` en variantes par nom écrit (§ 5.1). Deux capacités dont les
  noms ne diffèrent que d'un signe invisible restent donc deux capacités ;
  le contrôle confronte leurs variantes, toutes ensemble et dans l'ordre des
  lignes, et la même puissance donne E3. Des puissances différentes n'en
  donnent pas : ce n'est pas un doublon (ce que cette lecture laisse : § 12).
- **Ce qui ne change pas** : les listes, la rencontre et la recherche
  rangent toujours les noms tels qu'écrits (§ 12).

| Code | Gravité | Ce qui est vérifié |
|---|---|---|
| E1 | bloquante | feuille ou en-tête attendu absent : l'import s'arrête |
| E2 | erreur | ligne non vide sans nom |
| E3 | erreur | doublon : bloc, élément, ou capacité de même nom et même puissance (noms comparés exactement, signes invisibles et espaces de bord retirés) |
| E4 | erreur | capacité citée par un bloc, introuvable ; la cible d'un élément ou d'un paramètre compte comme une citation |
| E5 | erreur | élément cité (Blocs ou Capacites), introuvable |
| E6 | erreur | notation illisible : délimiteur non fermé, paramètre sans `:`… (liste au § 6.2) |
| E7 | erreur | même paramètre transmis deux fois par un bloc sans cible, ou deux fois vers la même capacité : une capacité en recevrait deux valeurs. Un paramètre ciblé à côté du même paramètre sans cible est admis : il vaut pour sa capacité, le sans-cible pour les autres (`lisez_moi`, la Hache légère ; décision de l'auteur, lot 2 bis) |
| A1 | avertissement | renvoi qui ne diffère que par la casse, les accents, les espaces ou un signe invisible : capacité, cible, élément ou paramètre |
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
| E8 | erreur | feuille Adversaires (§ 16) : type cité par un adversaire, introuvable parmi les types de la feuille |
| E9 | erreur | notation de type illisible : multiplicateur ailleurs qu'après le dernier type, crochet non fermé, multiplicateur nul, négatif ou qui n'est pas un nombre, nom de type manquant ; ou un type dont le nom porte « / » ou un crochet, que la colonne Type d'un adversaire ne pourrait pas citer |
| E10 | erreur | localisation invalide : face hors de 2 à 20 (la face 1 est la contre-attaque), deux zones sur une même face, faces non couvertes (aucune zone ne commence à 2), forme autre que `Nom(face)` |
| E11 | erreur | objet d'équipement introuvable : ni un bloc, ni un pack d'armure ; ou un pack dont aucune pièce n'existe |
| E12 | erreur | armure dont le nombre de valeurs n'est ni 1, ni 6, ni celui des zones de l'adversaire |
| E13 | erreur | capacité citée par un type ou un adversaire, introuvable dans Capacites |
| E14 | erreur | valeur numérique illisible : nombre d'actions, souffle, attaque, défense, qualité (elle vaut alors la qualité par défaut), rang (un entier de 1 au maximum de la capacité ; il vaut alors le rang par défaut), rang sans variante de puissance écrite dans Capacites, armure ou dégâts d'un bloc porté qui ne se calculent pas, produit par le multiplicateur ou somme d'armures hors des nombres calculables |
| E15 | erreur | adversaire incomplet une fois l'héritage appliqué : sans localisation, sans attaque ou sans défense (une cellule illisible ou un type introuvable, déjà signalés, ne le sont pas deux fois) |
| E16 | erreur | deux types, ou deux adversaires, de même nom (noms comparés exactement, signes invisibles et espaces de bord retirés, comme E3) |
| A11 | avertissement | zone reconnue par approximation : à deux lettres d'écart au plus d'une des six zones des personnages |
| A12 | avertissement | armure à six valeurs dont une valeur non nulle vise une zone que l'adversaire n'a pas (aucune de ses zones n'en porte le nom) : cette valeur ne couvre rien, ou, s'il a justement six zones, les six valeurs se posent dans l'ordre du d20 |
| A13 | avertissement | rang supérieur au maximum de la capacité (3, ou sa plus haute variante) : ramené au maximum |
| A14 | avertissement | rang donné à une capacité qui n'évolue pas : ignoré |
| A15 | avertissement | capacité d'arme sans arme : sa description invoque `{degats}`, et rien de ce que porte l'adversaire ne les lui donne |
| A16 | avertissement | un type et un adversaire de même nom (comparés comme E16) |
| I4 | information | feuille Adversaires absente : la banque n'a pas d'adversaires |
| I5 | information | type qu'aucun adversaire n'utilise |

**Les codes de la feuille Adversaires** (lot 3 : E8 à E16, A11 à A16, I4,
I5, à la suite des autres et dans l'ordre de l'instruction) viennent de la
résolution des adversaires, la même que celle de la page (§ 16.2) ; l'import
relève la feuille absente (I4). Les codes communs y valent aussi : E1 (un
en-tête absent d'une feuille présente), E2 (une ligne sans nom, un type
sans nom), E6 (une liste illisible), A1 (un type, un bloc ou une capacité
cités à la casse, aux accents ou à un signe invisible près, du même message
que sur les autres feuilles), I1. Une anomalie se range **à la
ligne où elle se corrige** : celle d'une cellule d'un type à la ligne du
type, une seule fois, même quand dix adversaires en héritent ; ce qui ne se
voit qu'une fois l'héritage appliqué (E12, E15, A12, A15), à la ligne de
l'adversaire. Les anomalies de la feuille se trient après celles des autres
feuilles ; sur une même ligne, les codes se rangent dans l'ordre des
nombres (E9 avant E11).

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
- **Banc des adversaires** (lot 3) : chaque adversaire de la feuille,
  résolu, avec ses quatre nombres, ses armes et leurs dégâts, l'armure de
  chaque zone, ses maîtrises et ses capacités jouées avec un désavantage,
  et les anomalies de la feuille. Ces valeurs se comparent, à la main, aux
  mesures de référence de l'instruction du lot, qui restent hors dépôt
  (§ 16.8).

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
modification. Un `lisez_moi` modifié est signalé. **Les types d'adversaires
et les adversaires** (lot 3) se comparent de même, par leur nom, cellule par
cellule, sur ce que la notation de la feuille y lit (§ 16.1) : deux
écritures de la même liste, ou « 2 » et « 2,0 », ne diffèrent pas. Une
banque publiée avant la feuille Adversaires n'en a aucun : tout y est
ajouté.

**Le résumé d'une ligne** : `Publication du classeur des règles — 28/09/2026
14:32 — 3 capacités ajoutées, 2 modifiées, 0 retirée`. Les catégories
viennent dans l'ordre blocs, capacités, éléments, types d'adversaires,
adversaires, séparées par « ; » ; une catégorie sans changement est tue ;
zéro et un s'accordent au singulier. Sans changement : « aucune
différence ». La première publication donne les totaux (« première
publication : 67 blocs, 69 capacités, 19 éléments », suivis de « 2 types
d'adversaires, 3 adversaires » quand la feuille en a) ; une publication
malgré des erreurs finit par « — publiée malgré 12 erreurs ».

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
- **Le combat du simulateur** (lot 4, § 17.8) se garde sur l'appareil,
  **chiffré par la même clé de table** : il porte des valeurs de la banque
  (les photographies de ses protagonistes), qui ne s'écrit jamais en clair
  sur un appareil. Il vit dans une base IndexedDB à lui,
  `atelier-des-arpenteurs-combat`, **jamais dans le coffre**, qui ne garde
  que des clés, **ni dans `localStorage`**. Il y a un combat par mode : la
  démonstration, chiffrée par sa propre clé, ne touche jamais le combat
  réel. La page ne copie pas la clé pour lui : elle la relit dans son état
  à chaque écriture. Un combat chiffré sous un sel ou un nombre
  d'itérations qui ne sont plus ceux de la clé (le mot de passe de table a
  changé) ne se lit plus, et l'écran le dit ; sans IndexedDB, le combat vit
  en mémoire le temps de la visite, et l'écran le dit aussi.
- Un bouton « Oublier le mot de passe sur cet appareil » efface la clé, du
  coffre et de la mémoire. Il annule aussi le circuit en cours de l'espace
  auteur : une confirmation en attente se referme sans rien écrire, et les
  différences déchiffrées quittent l'écran. Une clé lue juste avant l'oubli
  ne revient pas en mémoire. Depuis le lot 4, il efface aussi **le combat
  de la mémoire** de la page, qui porte des valeurs de la banque en clair :
  une lecture partie avant l'oubli n'y remet rien. L'enregistrement chiffré
  reste sur l'appareil, illisible sans la clé.
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

**Une exception aux 44 px : les cases de la carte du combat** (décision de
l'auteur, mission du lot 4). Dix cases de front sur un téléphone font moins
de 44 px chacune, et leurs jetons aussi, comme le « +k » d'une case
pleine : c'est admis. **Chaque choix fait sur la carte a son double en
boutons de 44 px** : dans le panneau d'action, un bouton par cible possible
et par case d'arrivée possible ; avant le lancement, un champ « Case » (de
A1 à J10) sur chaque fiche. Tout bouton hors de la carte tient les 44 px
(§ 17.7).

**L'aspect est sobre** (décision de l'auteur, 28/09/2026) : polices du
système, aucune police téléchargée ; gris neutres et une seule couleur
d'accent ; un thème clair et un thème sombre, selon le réglage de l'appareil
(`prefers-color-scheme`). Le texte contraste d'au moins 4,5:1 avec chacun de
ses fonds, et les bordures des champs d'au moins 3:1. Toutes les valeurs
vivent dans `css/jetons.css` : une identité visuelle s'y posera plus tard,
sans toucher au reste ; seules les largeurs des conditions `@media`
s'écrivent en dur, car CSS n'y lit pas de variable : 56rem dans `ecran.css`,
56rem et 80rem dans `css/combat.css` (§ 17.7). La gravité d'une anomalie
se lit en toutes lettres, jamais à la seule couleur. Aucune identité
visuelle propre à Abrasia dans l'interface. Seules exceptions : la fiche de
personnage imprimable et la carte d'adversaire, qui sont du papier. La
première a l'identité du modèle de fiche, ses couleurs (`--fiche-…`, claires
dans les deux thèmes) et ses polices, hébergées dans le dépôt (§ 15.4) ; la
seconde, celle de la maquette des adversaires (`--carte-…`, EB Garamond,
§ 16.5).

**Une exception à « une seule couleur d'accent » : le simulateur de
combat** (demande de l'auteur, mission du lot 4). Le vert y désigne les
personnages, le rouge les adversaires ; avec le gris d'un mort, le vert et
le rouge d'un dé réussi ou échoué, et l'ambre d'une alerte (une armure
entamée, la mention « désavantage »), ce sont **onze couleurs**
(`--combat-…`, § 17.7), dans `css/jetons.css`, pour les deux thèmes, aux
mêmes contrastes que le reste : 4,5:1 pour un texte, 3:1 pour un rond sur
le fond d'une case. **Aucune ne porte seule une information** : un jeton a
ses initiales ou son nom, un camp sa liste et son titre, un dé son signe
(✓ ou ✗) et son état dans son nom accessible. Ces couleurs ne servent qu'à
l'écran du combat ; l'accent du site y reste celui de qui joue et de sa
case.

| Écran | Contenu |
|---|---|
| Mot de passe | un champ, « se souvenir sur cet appareil » coché par défaut, une attente pendant la dérivation, qui ne dépend pas de la peinture de la fenêtre (une fenêtre masquée ne peint pas) ; après chaque saisie réussie, la page demande un stockage durable (`navigator.storage.persist()`), sans attendre la réponse : Firefox la demande à la personne, qui peut ne jamais répondre (relevé du groupe 3) ; sans IndexedDB, une phrase remplace la case (§ 7.2) |
| Accueil | date de la banque publiée, comptes (blocs, capacités, éléments, adversaires, types d'adversaires ; une phrase à la place des deux derniers quand la banque a été publiée avant le lot 3, § 16.6), lien vers les anomalies s'il y en a ; « Vérifier les mises à jour » (§ 8.3) ; « Oublier le mot de passe sur cet appareil » (§ 7.2) ; l'aide pour l'écran d'accueil ; le diagnostic |
| Listes | Blocs, Capacités, Éléments, Adversaires, Types, dans l'ordre alphabétique ; recherche instantanée sur les noms et les descriptions, sans casse ni accents (`œ` vaut `oe`), chaque mot de la recherche devant se trouver ; un adversaire se cherche aussi par ses types, son équipement et ses capacités, tels qu'il les écrit et tels qu'il les porte une fois résolu (§ 16.6) |
| Fiche d'un bloc | éléments (liens), capacités (liens ; « au choix : … », « facultatif : … »), paramètres sous leur nom affiché (§ 5.2), par exemple `Brûlant[5/10/15]`, suivis de leur écriture transmise, notes de conception en retrait |
| Fiche d'une capacité | variantes par puissance, coûts, éléments propres, description ; **« octroyée par »** : les blocs qui la citent dans leur colonne des capacités (A3) |
| Fiche d'un élément | paramètres reçus, description ; **« porté par »** : blocs et capacités qui le citent, et blocs qui transmettent un paramètre qu'il reçoit (A4) |
| Fiche d'un adversaire | l'adversaire **résolu** : sa carte, et la lecture, où chaque valeur dit d'où elle vient ; ensemble sur un grand écran, en deux vues sur un téléphone ; « Ajouter à la rencontre », « Imprimer / PDF » (§ 16.6) |
| Fiche d'un type | sa ligne telle que la résolution la lit, et les adversaires qui l'utilisent (§ 16.6) |
| Rencontre | des adversaires, un nombre d'exemplaires par + et −, « Imprimer / PDF », l'aperçu des cartes ; rien n'est enregistré (§ 16.6) |
| Combat | le simulateur de combat (`#/combat`, § 17.7) : la carte de 10 × 10 cases et ses jetons ; avant le lancement, la préparation (ajouter un personnage, des adversaires, placer la rencontre préparée, qui commence, « Lancer le combat ») ; ensuite le panneau d'action (qui joue, la capacité, la cible, les dés, la localisation, l'esquive, les dégâts) ; une fiche vivante par protagoniste, et sa fiche complète en panneau ; le journal, « Copier » et « Télécharger » ; « Fin de tour », « Nouveau combat » ; l'état de l'enregistrement chiffré (§ 17.8) |
| Anomalies | le rapport publié avec la banque ; `#/anomalies/Blocs/14` met en avant les anomalies d'une ligne, `#/anomalies/Adversaires/3` de même |
| Espace auteur | clé GitHub ; import ; rapport ; différences ; publication ; changement de mot de passe, avec les personnages en ligne ; clé de dépôt des personnages ; vérification et reprise des personnages en ligne (§ 8.4) |
| Personnages | en ligne, tous les personnages du site et ceux que l'appareil vient d'envoyer ; à part, les non-envoyés (« Réessayer ») et les brouillons ; créer, reprendre, ouvrir, modifier, enregistrer le fichier, importer, ouvrir sur mon téléphone, supprimer après confirmation (pour tous, en ligne) ; en démonstration, le personnage de démonstration, et rien en ligne (§ 15.3, § 15.8) |
| Création | le parcours en neuf étapes, chaque capacité décrite, des boutons + et −, trois entrées d'objets, un brouillon gardé à chaque changement, « Ce qui manque » toujours présent ; la copie de travail d'un « Modifier », qui s'enregistre à la place de l'original ou sous un autre nom (§ 15.3) |
| Fiche d'un personnage | vue lecture ou vue fiche, « Imprimer / PDF » (recto puis verso), fichier, lien vers le téléphone, « Modifier », qualité des objets ; un personnage en ligne s'y ouvre aussi (§ 15.3, § 15.4, § 15.5) |
| Personnage reçu | un lien #/recevoir/… : aperçu, puis « Enregistrer sur cet appareil » (§ 15.1) |

La navigation porte les liens « Personnages », « Adversaires »,
« Rencontre » et, depuis le lot 4, **« Combat », après « Rencontre »** :
neuf liens en tout (Blocs, Capacités, Éléments, Adversaires, Rencontre,
Combat, Personnages, Anomalies, Auteur). L'écran du combat marque
« Combat », attend comme les autres que la banque soit ouverte, et n'a
qu'une adresse : `#/combat` suivi de quoi que ce soit mène à « page
introuvable ». Son attente d'ouverture ne porte pas `data-chargement` : la
veille de 15 secondes (plus bas) ne la concerne pas. Il ne s'imprime pas.
Les types d'adversaires s'atteignent par les onglets des
listes et depuis chaque fiche d'adversaire ; leurs écrans marquent
« Adversaires ». À l'impression d'une fiche de la consultation, ni la liste
ni le lien de retour ne sortent. Chaque fiche a une adresse
(`#/capacite/Attaque%20de%20base`) qu'on peut envoyer à un joueur. Un renvoi cassé s'affiche comme tel (texte barré, lien
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
  la fiche et de la carte), seules les connexions vers le site et vers `api.github.com`
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
  n'est pas la seule barrière. Il **n'affiche pas les signes qui commandent
  le sens de l'écriture** (propriété Unicode `Bidi_Control`, dont U+202E) :
  laissé ouvert dans un nom venu d'un classeur, l'un d'eux renverserait tout
  ce qui le suit dans la ligne, jusqu'aux nombres d'une carte imprimée
  (« 13/26/41 » lu « 14/62/31 ») ; la banque, les adresses et les attributs
  gardent le nom tel qu'écrit (lot 3). **La comparaison des noms**, elle,
  ignore les signes de format invisibles (lot 4, § 6.3) : `sansSignesInvisibles()`
  de `js/banque/noms.js` en retire vingt et un, pour la clé d'un nom et
  pour les doublons. Ce sont deux listes pour deux usages, et `dom.js` ne
  change pas : onze de ces signes commandent aussi le sens de l'écriture,
  et il les ôte du texte affiché ; les dix autres, dont U+200B, y restent,
  sans rien montrer ; U+061C, qu'il ôte, n'est pas retiré d'un nom comparé.
  **Aucun de ces signes ne s'écrit tel quel dans le dépôt** : personne ne
  le verrait, ni à la relecture ni dans une différence, et un outil peut
  l'ôter sans rien dire. Le code et les contrôles l'écrivent par son code
  (une barre oblique inversée, « u », quatre chiffres), ce document par
  « U+… » ; un contrôle le vérifie dans `js/`, `outils/`, `tests/` et ici
  (§ 11), sans exception : la marque d'ordre des octets qu'un contrôle du
  dépôt pose en tête d'un fichier UTF-16 d'essai (`tests/depot.test.js`)
  s'écrit elle aussi par son code.
  `svg()` n'y fabrique que quelques formes
  (la silhouette de la fiche), sans adresse, gestionnaire ni style ;
  `telecharger()` fait enregistrer un fichier par un lien vers un Blob
  qu'elle fabrique elle-même, seule adresse que `el()` refuserait. La seule
  écriture de style du code est l'échelle d'un papier à l'écran, un nombre,
  posé en propriété CSS (`--echelle`) par `js/ecrans/echelle.js`, pour la
  vue fiche d'un personnage (§ 15.5) et pour la carte d'un adversaire
  (§ 16.6) ; un contrôle vérifie qu'aucun autre module de `js/` n'écrit de
  style (§ 11). Raison : la clé et le jeton vivent dans
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

**Le simulateur de combat** (lot 4) n'ajoute aucune dépendance. Il emploie
du navigateur ce que le site employait déjà (`crypto.subtle`, `indexedDB`,
`CompressionStream`, `DecompressionStream`), et `crypto.getRandomValues`
pour ses dés. Son enregistrement se contrôle sur une IndexedDB simulée,
écrite pour le projet (`tests/outils/indexeddb_simulee.js`), plus stricte
qu'un navigateur : une transaction y devient inactive dès la première
attente, ce qui fait voir un chiffrement glissé dans une transaction.

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

**La police de la carte d'adversaire** (lot 3) : EB Garamond, au format
woff2, sous-ensemble « latin » (qui couvre le français) : une police
variable, de 400 à 800 de graisse, et son italique, 70 Ko à elles deux, et
leur licence SIL OFL 1.1 (`polices/OFL-EBGaramond.txt`, « Copyright 2017 The
EB Garamond Project Authors »), décision de l'auteur du 11/10/2026. Ce sont
les deux fichiers de la maquette du lot. La page les charge de son propre
site, seulement quand une carte s'affiche (`css/adversaire.css`).

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
  Défense. A8 et A9 se déclenchent sur des variantes, comme E1. Depuis le
  lot 3, une sixième feuille, `Adversaires`, sert aussi à la démonstration
  (§ 16.7), avec une arme et une armure naturelles en fin de `Blocs`. Elle
  ne porte que trois anomalies, qu'elle annonce (A11, A1, A15) : les autres
  codes de la feuille se déclenchent sur des variantes fabriquées au moment
  de l'essai (`tests/outils/adversaires_essai.js` : un socle sans défaut,
  plus la ligne fautive), pour que la démonstration reste jouable. Le
  classeur propre des contrôles a lui aussi sa feuille Adversaires, sans
  défaut : sans elle, I4 le dirait. Depuis le lot 4, il porte ce qui
  manquait au simulateur de combat, toujours fictif :
  - deux éléments, en fin d'`Eléments` : **Intervention** (« Se joue pendant
    le tour adverse. ») et **Passif** (« Agit sans action. ») ;
  - **Passif** sur douze capacités : Vif, Costaud, Nez fin, Palais d'acier,
    Réduction, Feuilletage, les trois styles de combat (Solo du chef,
    Brigade, Minutie) et les trois maîtrises, qui gardent leur élément
    d'avant (« Style de combat, Passif », « Maîtrise, Passif ») ;
  - **Intervention** sur deux : Dressage minute et Coup de chalumeau ;
  - deux capacités de puissance 0 dans le bloc de base, « Gestes de
    cuisine », en fin de `Capacites` : **Pas de côté** (Intervention, coût
    en souffle X, « Annulez [X] dégâts reçus. ») et **Guetter** (« Après un
    déplacement, ou pour finir son tour : une de vos capacités se joue en
    intervention jusqu'au prochain tour de votre camp. »).

  Tout est posé en fin de feuille ou dans une cellule existante : aucune
  ligne ne change de numéro, aucune anomalie ne s'ajoute, et les cinq
  adversaires se résolvent à l'identique (un contrôle les résout aussi sur
  le classeur d'avant, refabriqué, § 11). Mesuré le 12/10/2026 : 37 blocs,
  46 capacités (51 variantes), 22 éléments, 2 types d'adversaires,
  5 adversaires ; 40 anomalies, dont 15 erreurs, comme avant. Le classeur
  d'essai n'a toujours ni paramètre `loc_multiple`, ni élément
  « Localisation multiple » ou « Centré », ni bloc de type État ou
  Blessure.
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
| Import | la banque du classeur d'essai a le format du § 5.1 ; colonnes retrouvées malgré la casse, les accents et l'ordre des en-têtes ; valeurs en chaînes, telles qu'écrites ; brut et `lisez_moi`, où une colonne nommée `__proto__` ou `constructor` reste ; ligne sans nom exclue ; fichier illisible : un message ; la feuille Adversaires : une entrée par ligne, type ou adversaire, ses cellules telles qu'écrites, vides comprises, et son brut ; ses en-têtes retrouvés malgré la casse et les espaces (« Nombre  d'actions ») ; les ajouts du lot 4 pour le simulateur de combat, mot pour mot (§ 10.3) : les deux éléments et leur texte, les douze capacités qui portent Passif et les trois qui portent Intervention, les deux capacités du bloc de base, cellule par cellule, en fin de feuille et sans anomalie |
| Contrôle | le classeur d'essai déclenche **chaque** code du § 6.3 (trente-six ; E1, A8, A9, A10 et quinze des codes de la feuille Adversaires sur ses variantes, § 10.3), et exactement les anomalies qu'il annonce, ligne par ligne ; un classeur propre n'en déclenche aucun ; gravités du § 6.3 (le tableau lu dans la spécification, codes à deux chiffres compris) et tri du § 6.4 ; la colonne « Type » attendue, les types comparés sans casse, accents ni espaces ; E7 : un paramètre ciblé à côté du même sans cible admis, dans les deux ordres ; deux sans cible, ou la même cible deux fois (casse comprise), une erreur ; E4 toujours sur la cible ; A10 : deux pièces d'un même type sur une zone, pas deux types différents, pas une valeur écrite « 0 » ou « 0,0 » ; le signe invisible (lot 4, § 6.3) : chacun des vingt et un signes retiré de la clé, aucun autre point de code d'Unicode retiré, les voisins de la liste gardés (dont U+061C, U+180E et U+2065), les espaces voisins retirés comme avant ; E3 sur un bloc, un élément (avec l'espace que le signe cachait) et une capacité de même puissance, pas sur une autre puissance ; le signe sur la première définition comme sur la seconde, et des variantes dont les lignes s'entrelacent : le doublon est la ligne la plus basse, la ligne citée la plus haute ; « exactement » : ni la casse, ni un accent, ni une espace intérieure ne font un doublon (bloc, élément, capacité de même puissance) ; deux capacités à un signe près et de puissances différentes : deux capacités, sans E3, et un renvoi approché vers ce nom devenu ambigu (E4), là où il est retrouvé et signalé (A1) sans la seconde ; A1 sur une capacité, un élément et un paramètre, mot pour mot ; aucun de ces signes écrit tel quel dans `js/`, `outils/`, `tests/` ni dans ce document, sans exception (§ 10.1) |
| Chiffrement | aller-retour, au format 2 du § 7.1 : l'empreinte est celle des octets chiffrés, vérifiée avant le déchiffrement, et change à chaque publication ; le format 1 ne se lit plus : il se dit abîmé, avant toute dérivation ; mauvais mot de passe refusé proprement ; fichier abîmé ou inconnu, ou en-tête hors des bornes du § 7.1 (itérations, sel, IV, données), ou dérivation refusée : un message ; une clé sous le plancher ne chiffre pas ; IV différent à chaque chiffrement ; sel inchangé tant que le mot de passe ne change pas ; la clé gardée déchiffre la publication suivante (§ 7.1), et un sel renouvelé la rend inutilisable ; normalisation du mot de passe : NFC, espaces de bord, **minuscules** (« İ » compris), la même clé quelle que soit la casse ; une banque chiffrée sous la forme exacte reste lisible avec le mot de passe tel qu'il se saisissait, et la clé rendue republie sous la même forme ; 8 signes au moins, sans autre exigence ; coffre : seule une clé AES-GCM non extractible, clés réelle et de démonstration séparées, jeton à part (§ 7.2) |
| Publication | `fetch` simulé, **aucun appel réel à GitHub** : adresses, en-têtes et corps de la requête ; auteur et committer explicites, en adresse privée (§ 8.2) ; **première publication** : fichier absent, réponse 404, écriture sans `sha` ; mise à jour avec le `sha` lu ; refus pour `sha` périmé (409, ou 422 sans `sha`) : rechargement, nouvelles différences, nouvelle confirmation ; clé refusée (401), droits, réseau, JSON illisible, réponse qui n'est pas du JSON : un message ; écriture acceptée au corps perdu : un succès ; trois refus 422 : le motif du dernier ; contenu de plus d'un mégaoctet relu en brut. Lot 2 bis : la clé de dépôt ajoutée, gardée, remplacée, retirée, en fin de banque et seulement avec une valeur ; une forme invalide refusée sans recopier la saisie ; jamais dans le message de commit ni en clair dans une requête ; la clé GitHub de l'auteur refusée comme clé de dépôt, saisie comme publiée ; le changement de mot de passe en un seul commit Git Data (banque, personnages rechiffrés, déchiffrables avec la nouvelle clé et plus avec l'ancienne, autres champs gardés, index aux versions nouvelles ; branche lue sans cache, avance sans forcer, auteur et committer explicites) ; un refus d'avance relance tout et rechiffre le personnage rangé entre-temps ; une avance sans réponse : succès si la branche relue est sur le commit écrit, panne sur le commit lu, `incertain` sur un autre commit ou si la relecture tombe aussi ; autre clé, fichier reçu entier mais abîmé, ou trop gros : laissés et comptés, index abîmé régénéré ; réponse illisible, coupée ou inattendue sur un personnage ou l'index, arbre tronqué, clé refusée, droits, réseau, 409 : un message, rien d'écrit ; la reprise avec l'ancien mot de passe (minuscules puis forme exacte), en un seul commit sans la banque |
| Dépôt | aucun `.xlsx` hors `essais/`, et chaque `.xlsx` d'`essais/` fabriqué, octet pour octet, par l'outil des essais ; le `.gitignore` ignore les classeurs, leurs formats voisins, les documents et tout JSON hors liste ; aucun autre format de classeur ou de document, aucun JSON hors liste (le personnage de démonstration y entre) ; une seule page (`index.html`), une seule image SVG (l'icône) ; dans tout l'historique, aucun fichier interdit et aucun jeton, chaque contenu lu une seule fois (un historique de 900 révisions se lit, là où la ligne de commande de Windows n'en passerait que quelque 790) ; un jeton écrit en UTF-16 se voit, dans l'arbre comme dans l'historique ; deux workflows et eux seuls : « Contrôles » (actions fixées sur un commit avec leur version, `contents: read`, aucune écriture, `persist-credentials: false`, ni `pull_request_target` ni `workflow_run`, ni texte d'un événement) et « Personnages » (les mêmes règles, et son texte exact, ligne utile par ligne utile : l'ouverture d'un ticket et le lancement à la main pour seuls déclencheurs, `contents: read` au workflow, le groupe `personnages` sans annulation, un seul job sur `ubuntu-latest`, `contents`, `issues` et `pages` en écriture à ce seul job, les actions de « Contrôles » sur les mêmes commits, une seule commande, l'automate, le jeton pour seule expression ; la faute donne le numéro de ligne, jamais la ligne trouvée), chacun vu refusé sur des variantes fautives (dont un interpréteur, `NODE_OPTIONS`, un conteneur, une autre machine, un second checkout) ; `personnages/` ne contient que `<identifiant>.chiffre.json` et `index.json`, dans l'arbre comme dans l'historique ; chaque fichier se lit par le vérificateur de la page, sous l'identifiant de son chemin, et son contenu ne se lit pas comme du texte ; l'index se lit, **sans aucun nom en clair**, et dit exactement les fichiers présents, avec leur date et leur version ; le `.gitignore` ignore tout autre fichier de `personnages/` ; **aucun `.docx`** ; `donnees/` (quelle que soit la casse) ne contient que `banque.chiffree.json`, sans autre champ que ceux du § 7.1, aux valeurs du § 7.1 (600 000 itérations, sel de 16 octets, IV de 12), au format 2 seulement (l'empreinte est vérifiée sur les octets chiffrés ; le format 1 n'est plus permis nulle part, pas même au fichier du 29/09/2026), et des données qui ne se lisent pas comme du texte ; la banque d'`essais/` a la même forme, au format 2 ; le fichier figé du format 1, retiré, n'est permis que dans l'historique ; le crochet `pre-push` existe, en `sh`, exécutable, extrait en LF, et `core.hooksPath` le désigne sur le poste (pas sur GitHub Actions, qui n'envoie rien) ; un envoi vers un dépôt d'essai est refusé quand un contrôle échoue (même avec `NODE_TEST_CONTEXT` hérité), quand tout n'est pas commité, ou sans `node`, et accepté sinon ; aucun **jeton GitHub entier** : un préfixe (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) suivi d'au moins 36 caractères alphanumériques ou soulignés, le contrôle fabriquant son faux jeton au moment de l'essai ; dans l'historique, des **auteurs** en `…@users.noreply.github.com`, des **committers** aussi ou en `noreply@github.com` (commits faits sur le site de GitHub), la ligne `Co-Authored-By` d'un message n'étant pas une adresse d'auteur ; ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni `document.write` dans les fichiers du site et dans `outils/` (§ 10.1) |
| Différences | ajout, modification champ par champ, retrait ; variantes de puissance ; ordre des lignes et écriture d'une même notation sans effet ; doublons ; résumé d'une ligne et ses accords ; dates ; le type d'un bloc, et une banque publiée avant la colonne « Type » ; les types d'adversaires et les adversaires : ajout, modification cellule par cellule, retrait, deux écritures de la même cellule sans effet ; une banque publiée avant la feuille Adversaires, dans les deux sens, sans exception ; la phrase de la première publication, avec et sans adversaires |
| Adversaires | la notation de la feuille (§ 16.1) : nombre, « aucune », colonne Type et ses formes illisibles, localisation et ses défauts, zones reconnues exactement et à deux lettres près (et pas à trois), listes, « // », virgule entre crochets ; une cellule faite d'un très long blanc lue sans délai. La résolution (§ 16.2 à § 16.4), sur la feuille de démonstration et sur des variantes : deux types et leur ordre ; le multiplicateur (les quatre nombres, la qualité héritée, 2 par défaut comprise ; ni les faces, ni les rangs, ni la ligne de l'adversaire) ; l'arrondi une seule fois, à la fin, dont deux pièces d'armure dont la somme n'est pas la somme des arrondis, et 15 × (1/3 + 4/3) = 25 ; « aucun », « // », une liste qui remplace ; la grille propre ; l'armure : globale et pièces qui s'ajoutent, deux globales, six valeurs par nom quel que soit l'ordre des zones, autant de valeurs que de zones, la dernière pièce non globale, la valeur nulle, les trois packs sans armure naturelle ; plusieurs armes, la capacité donnée par deux ; la qualité (0, 1, 3, celle que fixe le bloc, héritée sous multiplicateur) ; l'ordre des capacités, les rangs par défaut, le rang qui remplace, le rang ramené au maximum, les groupes au choix non donnés ; le coût au rang, X, le lien ; les descriptions évaluées, le bouclier ; les maîtrises, par l'élément et par le nom ; le désavantage selon la position, entier ou partiel. Chaque code de la feuille sur son cas, mot pour mot, avec sa ligne et sa gravité (`tests/outils/adversaires_essai.js`), dont E16, A16 et A1 à un signe invisible près (lot 4), le signe porté par la première définition comme par la seconde ; E16 et A16 comparent exactement : ni la casse, ni un accent, ni une espace intérieure ne font un doublon ; un constat de type dit une fois ; le tri, les codes à deux chiffres ; E1 sur un en-tête absent ; un adversaire en erreur qui se résout quand même ; des noms hostiles (`__proto__`, du HTML) et des nombres démesurés, sans exception. Les types naturels reconnus, absents du créateur de personnage et des packs ; une banque d'avant le lot 3. Les ajouts du lot 4 au classeur d'essai ne changent aucun adversaire : chacun se résout à l'identique sur le classeur d'avant, refabriqué, et la feuille garde les mêmes anomalies (§ 16.7). **La carte**, dans un document simulé (§ 16.5) : en-tête et numéro d'exemplaire, bande du d20 et place de chaque zone, abréviations, première ligne, une ligne par capacité, capacité à deux armes, désavantage entier et partiel, quatre lignes au moins, valeurs absentes, aucune provenance, un nom qui contient du HTML reste du texte, un signe qui commande le sens de l'écriture ne s'affiche pas, un nombre reste entier dans les initiales d'une zone ; sa feuille lue comme un texte : aucune couleur en dur, jetons définis et sans valeur sombre, règles préfixées, aucune classe commune avec l'interface ni la fiche, les deux familles de classes de position, la contre-attaque verticale, la description en italique, aucune hauteur ni rognage sur la carte, les deux `@font-face`, l'impression (la page nommée posée trois fois, son fond), le lien dans `index.html`. **Les écrans**, dans un document simulé (§ 16.6) : les listes, leurs cinq onglets et leur recherche ; les comptes de l'accueil ; une banque d'avant le lot 3, sans feuille, ou abîmée : aucune exception, et la phrase ; la recherche par ce qu'un adversaire porte une fois résolu ; une banque forgée dont une cellule ou un numéro de ligne n'est pas un texte : rien de technique à l'écran, la recherche ne lève rien ; la fiche d'un adversaire : deux vues et leur clé propre, la vue lecture sans choix gardé, la carte amenée à l'écran quand on la choisit, la carte toujours dans la page et seule à l'impression, la provenance de chaque valeur sur le Chef de partie et le Homard furieux, l'origine du rang quand plusieurs lignes citent la capacité, la liste vidée par « aucun » et qui la vide, les introuvables barrés avec la ligne qui les cite, un nombre illisible, le doublon, le doublon à un signe invisible près sur les quatre fiches qui le disent (adversaire, type, bloc, élément), la phrase d'un tel doublon de types sous chacun des deux noms, et l'adresse forgée d'un signe, qui reste introuvable (lot 4), l'introuvable, un nom en HTML, un nom qui porte U+202E, le focus passé au lien de la rencontre quand le plafond est atteint ; la fiche d'un type ; la rencontre : + et −, le focus, la numérotation, l'ordre, les deux plafonds, « Vider », le mode d'emploi après la liste, rien d'enregistré, la remise à zéro au changement de banque, l'adversaire incomplet signalé, l'impression après les polices ; l'adresse d'une anomalie de la feuille ; l'unique écriture de style et l'échelle tenue ; les règles d'`ecran.css` (cadre masqué à l'écran seulement, rétabli à l'impression ; sur un grand écran la carte et la lecture ensemble, sans choix de vue ; cibles de 44 px, lien d'un type compris ; un mot très long qui se replie, la grille qui défile seule, les faces d'une zone sur une ligne). Les listes d'un adversaire résolu disent d'où vient la dernière cellule écrite sans « // ». La mise en page et l'impression se mesurent dans un vrai navigateur (§ 16.8) |
| Préparation | première publication, mise à jour sous le même secret ; mot de passe à choisir, à saisir ou changé ; E1 refusé ; changement de mot de passe ; la clé de dépôt suivie d'une publication à l'autre ; circuit complet, de l'import à la lecture par un joueur |
| En ligne | les trois formats du § 15.8 dans les deux sens : personnage chiffré, ticket, fichier rangé, déchiffré, le même personnage ; aucun nom en clair dans le ticket, le fichier ni l'index ; seul un personnage enregistré, de la banque réelle, part ; « supprimer » sans personnage ; un ticket hostile (JSON, tableau, champ en plus, `__proto__`, format, action, identifiant hostile, date locale ou impossible, sel, IV, contenu, base64 sans remplissage ou url, signe non ASCII, trop gros) refusé avec une raison ; un personnage trop gros pour un ticket ne part pas ; un chiffré recopié sous un autre identifiant, ou d'une autre clé, ne se lit pas ; le contenu déchiffré hostile (bombe, format, UTF-8, autre identifiant, brouillon, démonstration) refusé ; l'index trié, trois champs, un doublon de casse refusé ; le rechiffrement sans lecture. La page : la démonstration ne dépose ni ne lit rien ; sans clé de dépôt, « non envoyé » et sa raison ; le ticket ouvert avec la clé, le sel de la banque en place vérifié d'abord ; les refus de GitHub (401, 403, 404, 410, 422, réseau) laissent « non envoyé », « Réessayer » le refait ; l'index lu sans cache, chaque fichier par sa version, une seconde lecture sans nouvelle requête ; une ancienne clé et un fichier hostile comptés à part, un mot de passe changé pendant la visite distingué d'une ancienne clé ; GitHub Pages en retard juste après un changement fait d'ici ne bloque pas le dépôt, une page en retard, si ; une version en ligne plus récente arrête l'envoi, sauf confirmation ; une lecture échouée n'est pas un personnage absent ; le rapprochement (rattrapé, attente, retard, suppression gardée tant que l'index ne se lit pas, copie plus ancienne qui ne cache pas la version en ligne) |
| Automate | lancé hors de GitHub, sur une simulation de l'API et de vrais dépôts git jetables : un ticket « creer » conforme rangé (fichier qui se déchiffre, index, commit du robot aux deux seuls chemins, message sans nom, ticket fermé et verrouillé, Pages demandée) ; « remplacer », ticket repassé sans effet (même deux tickets rejoués, déjà rangés : aucun commit), « supprimer », suppression d'un absent, passage sans ticket ; tickets non conformes (JSON illisible, autre titre, identifiant hostile ou en forme de jeton, trop gros, base64 faux, contenu en clair, sel périmé, corps vide, champ en plus, commandes de shell et chemins) fermés avec leur raison, sans rien recopier, écrire ni exécuter ; collision de casse ; inconnu (autre login, ou même login d'un autre compte) fermé et verrouillé sans commentaire, même quand la partie git s'arrête ; avalanche d'inconnus au-delà de la limite de pages : les plus anciens fermés, les autres au passage suivant, les tickets du propriétaire lus à part et rangés ; demande de fusion ignorée ; envoi refusé puis réussi, tickets rejugés sur la banque republiée ; cinq refus : aucun ticket du propriétaire fermé ; fichier illisible, intrus, ou `.gitignore` qui cache les fichiers rangés : arrêt sans commit ni fermeture ; chemin hors de `personnages/` : arrêt avant l'envoi ; la variable du jeton ôtée de toute commande git, le jeton à la seule commande d'envoi, jamais sur le disque ; Pages refusée ; lancé à la main, l'automate redemande Pages ; l'API et l'environnement de GitHub Actions. Aucun nom en clair nulle part |
| Routes et fiches | décodage des adresses de fiche (`#/capacite/Attaque%20de%20base`) et aller-retour des noms difficiles ; la fiche et la liste des blocs montrent leur type ; adresses abîmées, dont les noms d'`Object.prototype` ; un nom introuvable n'est jamais le titre ; recherche sans casse ni accents, sur les noms et les descriptions ; renvois résolus comme au contrôle ; « octroyée par », « porté par », nom affiché ; anomalies d'une ligne ; les adresses des adversaires, des types et de la rencontre, dont un nom forgé qui porte un demi-codet seul ; le lien de la navigation que marque chaque écran ; la recherche d'un adversaire par ce qu'il écrit ; l'index des adversaires et de leurs types, les lignes de la feuille Adversaires ; une banque d'avant le lot 3 indexée sans exception ; les entrées d'un nom comptent ses doublons à un signe invisible près (lot 4), celle du nom écrit d'abord, et aucune sous un nom que rien ne porte exactement ; un nom qui ne diffère d'un autre que par la casse, un accent ou une espace intérieure a ses propres entrées, et n'entre pas dans celles de l'autre ; l'adresse du combat (lot 4) : `#/combat`, et dix adresses abîmées autour d'elle (`#/combat/`, `#/combat/2`, `#/combats`, `#/Combat`…), la rubrique qu'elle marque, son lien après « Rencontre », et tout lien de la navigation écrit sous la forme que lit le contrôle (un lien écrit autrement manquait à la liste sans bruit) |
| Site | politique de sécurité du `<meta>`, avant scripts et styles, toute la table des directives et rien d'autre ; zoom permis ; ni script, ni style, ni gestionnaire en ligne ; chaque fichier appelé existe ; le graphe des modules se résout et atteint les seize écrans (le combat est le seizième ; quatorze de ses modules y sont nommés), et tout module de `js/` y est, hors la veille ; manifeste, couleurs des jetons, icônes aux tailles dites, telles que les dessine leur outil ; contrastes, dont ceux des onze couleurs du combat dans les deux thèmes, le texte à 4,5:1 et les ronds à 3:1 sur le fond des cases, ces onze-là ayant chacune sa valeur sombre (§ 17.7) ; valeurs de `ecran.css`, de `personnage.css` et de `combat.css` tirées des jetons, hors les largeurs des `@media`, aucune police téléchargée par l'interface ; la banque de démonstration, au format 2, se déchiffre et vient du classeur d'essai, avec ce qu'y lit le simulateur de combat (lot 4 : ses comptes, les deux éléments, les deux capacités du bloc de base, mot pour mot) ; le mot de passe de démonstration, déjà en minuscules, saisi en majuscules, ouvre la banque, et la clé gardée la rouvre ; le format 1 ne s'ouvre plus ; au téléchargement, une empreinte de format 2 fausse et un format plus récent donnent leur message ; le diagnostic dit le format ; chargement : absente, présente, abîmée, `?v=`, clé gardée, mot de passe requis ou changé, stockage durable ; l'attente du mot de passe ne dépend pas de la peinture de la fenêtre ; le déverrouillage n'attend pas la réponse sur le stockage durable ; sans IndexedDB, la phrase au lieu de la case ; une erreur inattendue : un message. Dans un document simulé : le bouton « Publier » existe dans chaque état de l'espace auteur, et sa raison s'affiche ; la barre de publication reste collée au bas de l'écran ; « Oublier le mot de passe » ne laisse ni clé ni différences, même pendant une comparaison ; « Oublier la clé GitHub » annule la publication en attente ; « Se souvenir » décide de garder la clé ; la veille de 15 secondes, et rien sur une page chargée ; l'aide dit d'ajouter l'Atelier depuis son accueil ; `dom.js` refuse gestionnaires en texte, `style`, `srcdoc` et adresses étrangères, et n'affiche pas les signes qui commandent le sens de l'écriture, que les attributs gardent ; le document simulé refuse d'ajouter null ou undefined, que le navigateur afficherait, et son `querySelectorAll` rend, comme le navigateur, une liste qui se parcourt mais n'a ni `filter` ni `map`. L'espace auteur (lot 2 bis) : la section de la clé de dépôt (aide, état, saisie vérifiée ; la clé jamais à l'écran, dans un attribut ou un champ, ni gardée ; retirer, garder ; oubliée avec le mot de passe, et après une publication réussie ; la clé GitHub de l'auteur refusée ; une phrase en démonstration) ; le mot de passe : 7 signes refusés, 8 acceptés, deux saisies qui ne diffèrent que par la casse acceptées ; le changement compte les personnages avant l'envoi, puis écrit un seul commit ; s'il en laisse sous une autre clé, la section « Personnages en ligne » les montre aussitôt, avec la reprise ; une avance sans réponse : « Publiée » si la branche a avancé, sinon l'incertitude dite, et l'ancienne clé reste ; la vérification n'écrit rien, la reprise rechiffre. Le serveur local : la seule machine, les seuls fichiers du site, dont les polices, le personnage de démonstration et `personnages/` sous ses deux seules formes, casse comprise |
| Personnage | chaque règle du § 15.2 : la table des dés, bornes comprises ; les paires d'attaque et de défense ; les types mêlés et le cas sans armure ; l'ordre des zones, la grille et le maximum par zone, et l'interdiction du livret ; la qualité (X, 1, 2, 3, 1,5) et l'arrondi une fois l'opération faite, dont un cas où la virgule flottante se tromperait ; les expressions et leurs refus ; l'expression de mains nues et son dé vide ; le coût à la puissance ; les coûts 1, 3 et 6, le plafond de 10, le reliquat, les capacités reçues au-delà de 10 ; la capacité reçue deux fois ; le niveau 0 et les capacités à venir hors décompte ; les groupes ( ) et [ ], un choix disparu ; le style de combat ; le tirage (chaque constellation atteignable, rejet des valeurs biaisées) ; les points de lien ; la banque sans types ; les choix modifiés ou disparus ; ce qui manque à chaque étape, un bloc d'un autre type. Le format : aller-retour du fichier, champ inconnu ou manquant, `__proto__`, chaque champ et ses bornes, 64 Ko, JSON illisible, mode inversé, nom de fichier sûr ; le lien : aller-retour dans le fragment, lien abîmé, forgé, bombe de décompression, UTF-8 invalide, mode inversé. L'étagère : modes séparés, ordre, illisibles comptés, un personnage du format 1 converti, les notes ; une base bloquée par un autre onglet : l'étagère en mémoire et la raison, sans attendre. Le format 2 (lot 2 bis) : les places d'un objet, une seule arme tenue, les tirages ; le format 1 converti (arme principale, bouclier, armures portées, tirage) ou refusé s'il est abîmé ; un personnage neuf à 2 partout. Les places dans le calcul : pièces du pack portées, bouclier équipé (un seul), rangés sans effet ; le parcours signale une place fautive. Les adresses des écrans du personnage. La répartition du recto et son débordement ; le recto et le verso dans un document simulé (en-tête, cases cochées et grisées, reliquat, souffle, zones, corps, équipement, liens, légende, pied de page, suite du recto, toutes les capacités et les armes, un nom en HTML qui reste du texte) ; l'impression (A4 sans marge, couleurs, saut de page, barre non imprimée) ; les polices hébergées (Marcellus, Alegreya Sans, EB Garamond), appelées par `fiche.css` et `adversaire.css` seulement, et leurs trois licences ; le personnage de démonstration, fabriqué par son outil et complet, qui suit ses dix-neuf capacités ; Aubépine et les ajouts du lot 4 (§ 15.7) : les deux capacités nouvelles du bloc de base, leur coût, leur description, Passif et Intervention sur les siennes, les mêmes points. Les écrans : liste, parcours, réception, fiche (vues, impression, banque sans types). Le parcours du lot 2 bis : les descriptions, dépliées sur grand écran et repliées sur téléphone ; les boutons + et − des caractéristiques (de 2 à 6, « + » arrêté à 36, le focus qui passe au voisin) ; le tirage refait et compté, la saisie ; l'arme tenue remplacée, les packs (un seul à la fois, la pièce portée seule renvoyée au sac), un pack non proposé (A10) avec sa raison, tous les objets au sac, qualité 2, la pièce refusée sur une zone couverte, un seul bouclier, l'arme prise en main ; l'étape 8 : seules les capacités qui peuvent évoluer, + et − dans les bornes, la raison d'un « + » inactif, avant et après, le focus gardé sur le bouton actionné ; les descriptions gardent leur état quand l'étape se redessine ; « — choisir — » ne défait pas la constellation ; le catalogue des armes, l'objet décrit avant d'être ajouté, un refus dit près de l'objet et le focus sur lui ; « Modifier » : la copie de travail, reprise, « Enregistrer » à la place de l'original, « Enregistrer sous un autre nom » (un autre nom exigé) ; l'enregistrement dépose (« creer », « remplacer »). La liste en ligne : les rubriques, l'attente, « Réessayer », « Supprimer » pour tous, « Modifier » d'un personnage en ligne, la phrase de la démonstration ; le mot de passe changé pendant la visite, une suppression dont le personnage ne se lit plus, une copie plus ancienne (« Envoyer quand même », « Retirer de l'appareil »), une base bloquée. La fiche : la qualité des objets (saisie fautive refusée, redépôt, panneau resté ouvert, focus sur la confirmation, deux objets de même nom distingués), « Modifier », un personnage ouvert depuis le site, ou dont la lecture échoue (« Réessayer »), « tirée N fois ». La mise en page se mesure dans un vrai navigateur (§ 15.4) |
| Combat | le simulateur de combat (lot 4, § 17). **Le moteur, sans page, règle par règle** (§ 17.3 à § 17.6) : la forme d'un événement, d'une photographie et d'un contenu, chaque borne vue des deux côtés (dont cent tirages par dé, six cents façons par photographie et vingt de déplacement, 200 000 signes et 64 étages pour la source d'un adversaire, le compteur des identifiants), une grille de localisation à trou refusée, un contenu d'une autre version des règles reconnu comme tel et non dit abîmé ; les cases, la distance, les cases à portée, la pose d'office ; les noms courts, les jetons, les initiales, leurs collisions, un nom épuisé, un nom sans lettre, un nom qui finit par un chiffre et ne prend ni les initiales ni le jeton d'un exemplaire ; la chaîne et ses bornes, k désavantages, k relances, relancer et garder, le dé explosif (son seuil, l'enchaînement, sous désavantage, après une relance, le modificateur compté une fois, « exploser » seule suite), chaque transition refusée hors de son attente ; les plafonds de la préparation et leurs raisons, égaux à ceux de la rencontre, un personnage une seule fois, « Retirer » qui renumérote, la source de dés sans biais ; les sept modificateurs et les dix sources d'avantage et de désavantage, un par un et dans leur ordre, l'inversion dans les deux sens, un bonus au niveau 2 qui donne d10+2, le jet prêté sans désavantage de maîtrise, ce qui ne s'applique pas à un adversaire, chaque passif câblé actif et inactif avec sa raison, au niveau 0 compris ; les deux grilles, plusieurs dés de localisation, la face de contre-attaque que le décalage ne crée ni n'efface, les bornes du décalage, les dégâts zone par zone, dégrossir (chez un personnage, chez un adversaire, jamais sans dégâts ni en dégâts directs, pas sur un coup annulé), les dégâts directs, l'esquive et son imputation, deux dés sur la même zone, la blessure et son compte, la mort, ce qui dépasse et se perd ; quel événement est accepté à quel moment d'un geste, chaque code de refus, un refus qui rend l'état reçu, l'objet même, une capacité sans dégâts qui touche et se localise, la face de contre-attaque qui clôt le geste et arrête les dés, l'événement de trop au-delà de la borne du combat ; les tours, l'alternance, passer, la fin automatique, « Fin de tour », les actions retrouvées et celles qui manquent après une esquive, deux fins d'affilée au plus, un camp qui commence sans pouvoir agir, la fin du combat sans « Fin du tour » ; le paiement au premier dé et à la confirmation, « Revenir » qui ne dépense rien, la puissance d'office, X, le lien sur un personnage à deux jauges, l'adversaire qui ne paie pas le lien, chaque raison d'un bouton inactif, dont un déplacement qui n'offre aucune case, la portée et les cibles, le jet prêté. **Le journal** (§ 17.9) : chaque gabarit, mot pour mot, sur des gestes écrits à la main, ceux que la mission ne donne pas compris ; une valeur de dé passée sous zéro, écrite avec le moins du journal, sans aucun trait d'union ; ce que dit la région d'annonce après un dé, une esquive, une face décalée, et le bilan, en une phrase ; l'en-tête, le nom du fichier, les deux fins de ligne, aucune espace insécable ; les trente-six lignes du combat de référence refaites à la main. **Les vues** : les cinq, leurs titres, leurs étapes, leurs boutons et leurs raisons, leurs saisies et leurs bornes, les annonces ; et la concordance : à chaque pas d'un combat joué, tout événement que porte un élément actif d'une vue est accepté par le moteur, tout événement que porte un élément inactif est refusé, et l'événement réellement joué ensuite est de ceux que les vues portaient. **Les rôles câblés** (§ 17.6) : chaque rôle de la démonstration reconnu par son nom, aucun reconnu en mode réel par un nom de démonstration, la ligne des absents, des empreintes de 64 signes hexadécimaux dont aucune n'est celle d'un nom de démonstration, et leur condensat commun, calculé hors dépôt d'après le tableau de la mission ; la reconnaissance par empreinte du mode réel, vue sur un tableau d'essai aux noms fictifs condensés à l'exécution, qui ne se mémorise pas. **Les photographies** (§ 17.2) : Aubépine et les cinq adversaires de la démonstration, champ par champ ; qui ne s'ajoute pas ; le sac ; l'ordre des groupes ; sur des banques fabriquées en mémoire, plusieurs dés de localisation, des dégâts propres, un coût négatif, un coût illisible, une capacité à venir, un souffle absent, deux armes de même nom, un adversaire à passifs câblés, chacun à son rôle et au rang que sa ligne écrit, une maîtrise que seule une arme rangée au sac donnerait, et qui ne lève rien ; toute photographie rendue est gelée, passe par JSON à l'identique, et passe la validation qui la relira ; un nom à retour de ligne devient une seule ligne, une description au-delà de sa borne est un refus d'ajout ; les personnages disponibles, lus sans rien écrire, face au vrai rapprochement de l'écran Personnages. **L'enregistrement** (§ 17.8) : l'aller-retour, le mode à part, la révision entre deux onglets, le mot de passe changé, la donnée abîmée, l'absence d'IndexedDB, « Oublier » pendant une lecture lente, rien en clair ni dans la base ni dans `localStorage` ; la file à une place, jamais deux écritures à la fois, la clé relue à chaque écriture ; une enveloppe d'un format plus récent, que rien n'écrase ; une donnée abîmée jusque dans sa révision, que « Nouveau combat » remplace ; une enveloppe de plusieurs mégaoctets, ou piégée, qui se dit illisible sans rien faire lever, la borne du chiffré à l'octet près, une écriture qui refuse ce qui ne se relirait pas, la révision bornée et son retour à 1, rien de lourd dans le tour de la demande ; chaque propriété de l'IndexedDB simulée. **La séance** : l'ouverture cas par cas (contenu refusé, révision discordante, rejeu refusé, autre version des règles), un rechargement en plein geste qui retrouve le moment sans attendre un dé déjà lancé, un combat dont une description tient sur deux lignes gardé puis repris, « Nouveau combat », le blocage, et, sur les deux magasins, une enveloppe longue, une révision démesurée, des identifiants épuisés. **Le rejeu**, sur le combat de référence : chaque préfixe rejoué égale l'état tenu un événement à la fois, journal compris ; l'état passe par JSON à l'identique ; tout ce que rend le moteur est gelé ; ni heure ni hasard (l'horloge et les générateurs remplacés par des fonctions qui lèvent) ; ni banque (les sources des photographies ôtées) ; le graphe des imports du noyau, clos et sans cycle, et son texte sans rien qui dépende de l'appareil ; des événements au hasard, à graine écrite, bien et mal formés, qui ne font jamais lever le moteur ; un dé jamais relancé : en plein geste, l'offre est la même après rejeu ; une ligne de plus au journal ne fait regarder aucune de celles qui la précèdent, et le combat le plus long, 5 000 événements, se rejoue en entier. **Le combat de référence fictif** (§ 17.10) : les cases d'office des ajouts, l'état final, lien compris, et les trente-six lignes du journal, mot pour mot, l'écart dit au signe près ; le suivi des ressources après chaque geste et le compte des événements, transcrits du calcul à la main ; le départ que dit le banc, chaque zone avec ses faces et son armure. **L'écran**, dans un document simulé (§ 17.7) : chacune de ses quatre parties sur des vues écrites à la main (ce qu'elle montre, la commande que porte chaque bouton et son origine, un bouton inactif qui ne fait rien, les nœuds gardés d'un rendu à l'autre quand la vue n'a pas changé, refaits quand elle a changé) ; l'écran entier : la préparation, la rencontre placée, un tour, la mort, le journal copié (accepté, puis refusé par le navigateur) et téléchargé (nom et contenu), l'annonce après chaque dé et une seule région qui change de texte, le focus, un nom hostile qui reste du texte, « Nouveau combat », l'oubli, un rechargement, une cible « choisie sur la carte » ou « choisie ici », un état de garde qui prévient dit une fois ; sa feuille lue comme un texte : des jetons seulement, deux `@media`, à 56rem et 80rem, aucune classe hors de `combat-`, des classes d'état du contrat d'écriture et des deux classes communes du site (§ 17.7), aucun nom en « carte », les onze couleurs dans les deux thèmes. Avec eux, dans les domaines voisins : les trois fonctions de maîtrise et les champs neufs de la résolution (Adversaires), les sources et les éléments d'une capacité (Personnage), la rencontre préparée lue sans rien enregistrer ni vider, le câblage d'`application.js` lu dans son texte (l'écran après la banque, un seul appel, l'oubli à sa place, aucun enregistrement ouvert hors de l'écran). La mise en page ne se contrôle pas ici : elle se mesure dans un vrai navigateur (§ 17.11 : les mesures du 12/10/2026, leurs réserves, et ce qui reste à mesurer) |

Les contrôles du dépôt portent sur les fichiers suivis et sur ceux que Git
suivrait, c'est-à-dire non ignorés : une faute se voit avant d'être commitée.

**Les bancs** (§ 6.3) ne font pas partie de `node --test` : ils demandent le
classeur réel, qui n'est pas dans le dépôt. Le banc de lecture se lance dès que
`xlsx.js` existe, avant la notation ; le banc complet, une fois l'import et le
contrôle écrits. **Le banc du combat** (`tests/banc_combat_reel.js`,
§ 17.10) demande en plus un scénario, hors dépôt lui aussi, car il porte des
noms du classeur. Ce qu'il compare hors de `node --test` est pourtant tenu
par elle : ses fonctions d'écart (le journal, l'état final, un arrêt en
plein geste) sont celles que le contrôle du combat de référence emploie, et
voit dans les deux sens.

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
  fiche montre les dégâts de mains nues et laisse le dé vide. Le simulateur
  de combat, lui, le fait choisir au moment du jet, par une convention
  provisoire (plus bas, « Pour le lot 4 », point 10) ; la fiche ne change
  pas.
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
  `defense` (A2). À écrire dans le Word, section « Objet ». Au combat, sa
  défense s'affiche, sans effet, tant que le livret ne dit pas ce qu'elle
  fait (« Pour le lot 4 », point 18).
- **La qualité** n'est dite que dans l'élément Qualité du classeur (1/3 +
  qualité/3) ; le livret (« Paramètre ») n'en donne qu'un exemple. À écrire
  dans le Word, section « Objet ».
- **Les capacités d'un objet rangé dans le sac** : le livret (« Objet »)
  distingue l'objet équipé de l'objet dans le sac, sans dire si ses
  capacités comptent. Le créateur compte les capacités de tout
  l'équipement possédé, sac compris ; depuis le lot 2 bis, où tout objet
  ajouté va d'abord au sac, la question compte davantage. À écrire dans le
  Word, section « Objet ». **Le simulateur de combat ne lit pas comme le
  créateur** : une arme, une armure ou un bouclier n'y donne ses capacités
  que porté, et une seule arme, la tenue (« Pour le lot 4 », point 19). La
  fiche garde sa lecture ; l'écart se lèvera avec la règle.
- **La maîtrise des pièces d'armure** (types mêlés : « désavantage s'il ne
  possède pas la maîtrise de l'ensemble des pièces ») : la fiche l'écrit en
  mention, sans la calculer ; le lien avec les capacités de maîtrise du
  classeur n'est pas écrit. Section « Jets de défense ». Au combat, faute
  de cette règle, des types mêlés donnent toujours 1 désavantage en défense
  (« Pour le lot 4 », point 20).
- **La jauge de lien au départ** : pleine ou vide ? La fiche montre le
  maximum, et des cases à remplir en jeu. Section « Ressources ». Au
  combat, elle part pleine (« Pour le lot 4 », point 17).
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
  pas calculé. Sections « Jets d'attaque » et « Maîtrises ». **Le simulateur
  de combat le calcule**, lui, pour un personnage comme pour un adversaire,
  par la lecture du classeur que les adversaires suivent déjà (§ 16.4 ;
  « Pour le lot 4 », point 23) ; la fiche de personnage ne change pas.
- **Une seule arme** : l'élément Arme dit « une seule arme dans le même
  tour », le livret (« Objet ») « une seule arme équipée à la fois ». Le
  créateur suit le livret (lot 2 bis) : une arme tenue, les autres au sac.
  Au combat, un personnage n'a que son arme tenue (« Pour le lot 4 »,
  point 19) ; « une seule arme dans le même tour » n'y est pas contrôlé, et
  un adversaire, qui peut porter plusieurs armes (§ 16.4), peut en jouer
  plusieurs dans un tour (point 21).
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

**Pour le lot 3 — adversaires** (décisions de l'auteur du 11/10/2026,
appliquées par le § 16, que le livret ne dit pas encore). **À écrire dans
le livret, section « Caractéristiques d'un adversaire »**, qui tient
aujourd'hui en une phrase :

- **La feuille et l'héritage** : un adversaire hérite d'un ou de plusieurs
  types, appliqués dans l'ordre, le suivant l'emportant cellule par
  cellule ; une cellule vide hérite ; « aucune » veut dire rien, ou 0 ;
  « // » reprend la liste héritée (§ 16.1, § 16.2).
- **Le multiplicateur** : global, après le dernier type ; il multiplie le
  nombre d'actions, le souffle, l'attaque, la défense et la qualité de
  l'équipement hérités, la qualité 2 par défaut comprise ; il ne touche ni
  les faces du d20, ni le rang des capacités, ni les valeurs propres des
  blocs, ni la ligne de l'adversaire (§ 16.2).
- **L'arrondi** : une seule fois, à la fin, à l'entier inférieur. Le livret
  (« Valeurs décimales ») dit « suite à une opération » : préciser que les
  opérations intermédiaires restent exactes.
- **La grille de localisation** : la première face de chaque zone, la face
  1 pour la contre-attaque, un nombre de zones libre ; les six zones des
  personnages reconnues par leur nom, à deux lettres près (§ 16.3).
- **Les ressources** : résistance 5 par zone et corps 10, comme un
  personnage ; attaque et défense, les difficultés des jets du joueur ; le
  souffle, la réserve qui paie ses capacités ; le nombre d'actions. Le
  livret (« Actions de jeu ») dit seulement « habituellement une seule ».
- **L'équipement** : la qualité entre crochets, 2 par défaut ; les trois
  packs d'armure ; **plusieurs armes permises**, quand le livret (« Objet »)
  n'en permet qu'une au personnage ; **l'armure zone par zone** : une pièce
  à une valeur, globale, à laquelle les autres s'ajoutent, la dernière
  pièce non globale l'emportant sur une zone, quand le livret interdit au
  personnage deux pièces sur une même zone ; une pièce à autant de valeurs
  que de zones, dans l'ordre du d20 (§ 16.4).
- **Les types de bloc « Arme naturelle » et « Armure naturelle »** : à
  ajouter à la liste des blocs du livret (« Système », « Blocs »).
- **Les capacités** : celles de l'équipement héritées, le rang entre
  crochets, le rang propre qui remplace le rang hérité ; les maîtrises et
  le désavantage, selon la position de la capacité dans la liste du bloc,
  ce que disent déjà les éléments Lourde, Agile et Précise du classeur
  (§ 12, lot 2, « La maîtrise des armes ») ; un bouclier donne ses
  capacités sans changer la Défense.
- **Pas de mot de passe du MJ** : tout joueur qui a le mot de passe de
  table lit les adversaires.

Ce que l'instruction ne tranchait pas, et que le § 16 applique en le
disant, **à confirmer ou à corriger dans le livret ou le classeur** :

- **L'association d'une maîtrise à son poids** : par le mot que porte son
  nom (« lourd », « agile », « précis »). Un élément porté par la capacité
  le dirait mieux (§ 16.4).
- **La qualité par défaut d'un bloc dont le classeur fixe la qualité** (un
  nombre au lieu de X) : celle du bloc, plutôt que 2 ; le multiplicateur
  s'y applique comme aux autres. Aucun bloc du classeur réel n'est dans ce
  cas.
- **Deux armures globales** : elles s'additionnent, comme une globale et
  une pièce.
- **Une armure à six valeurs sur un adversaire à qui manque une des six
  zones** (l'instruction dit : « alors qu'aucune zone ne porte les six
  noms ») : une valeur non nulle dont la zone manque ne couvre rien, et
  c'est dit (A12), même si d'autres zones sont reconnues ; une valeur nulle
  ne dit rien. Si l'adversaire a justement six zones, la pièce a « autant
  de valeurs que de zones » : les six se posent dans l'ordre du d20, avec
  le même avertissement.
- **« aucun » dans la colonne Type** : aucun type, comme une cellule vide.
- **Un groupe au choix d'un bloc qui n'a qu'une option** (`( a )`) : la
  capacité est donnée, il n'y a rien à choisir. Les autres groupes ne sont
  pas donnés, et l'écran le dit, sans code d'anomalie.
- **Un rang écrit pour une capacité à variantes qui n'a pas cette
  variante** : une erreur (E14), le coût et la description ne se lisant
  pas. **Un type dont le nom porte « / » ou un crochet** : une erreur (E9),
  aucun adversaire ne pouvant le citer.
- **Un nombre que rien ne donne** (le souffle de l'Aigle du classeur
  réel) : la case reste vide ; seules la localisation, l'attaque et la
  défense sont exigées (E15).
- **Une qualité non entière** s'écrit arrondie au plus proche (« 2,67 ») ;
  le calcul garde la fraction.
- **Les renvois de la feuille à la casse ou aux accents près** sont
  résolus et signalés (A1), comme partout (§ 6.3) : « Maitrise du combat
  agile » pour « Maîtrise du combat agile », deux fois dans le classeur
  réel.
- **Le sort des blessures d'un adversaire**, que le lot ne traite pas. Le
  simulateur de combat le tranche provisoirement : une zone sans résistance
  est « blessée », sans effet calculé (« Pour le lot 4 », point 14).

**Un signe invisible dans un nom : tranché au lot 4** (décision de
l'auteur, mission du 12/10/2026). La relecture finale du lot 3 l'avait
laissé à trancher : « Marmiton » et « Marmiton » suivi de U+200B (copié
d'une page web ou d'un traitement de texte) étaient deux adversaires que
rien ne distinguait à l'écran, sans E16, et le signe, dans une citation,
donnait E8, E11 ou E13 avec un nom qui paraissait juste. Depuis le lot 4,
la comparaison des noms (`js/banque/noms.js`) retire vingt et un signes de
format, pour tout le site (§ 6.3) : le renvoi est retrouvé et signalé (A1),
le doublon est dit (E3, E16, A16), et les fiches le comptent de même.
Aucun cas dans le classeur réel au 11/10/2026. Ce que la correction
**laisse**, à trancher par l'auteur s'il le souhaite :

- **U+061C** n'est pas dans la liste, qui est celle de la mission,
  exactement. L'affichage l'ôte pourtant (§ 10.1) : un nom qui ne diffère
  d'un autre que par lui reste un autre nom, que rien ne distingue à
  l'écran, sans E16 ni A1. Recommandation : l'ajouter.
- **Deux capacités** dont les noms ne diffèrent que d'un signe invisible,
  et dont les puissances diffèrent, restent deux capacités, sans E3 : ce
  n'est pas un doublon (§ 6.3). La seconde, que rien ne cite sous ce
  nom-là, se signale par A3, sous un nom qui paraît rattaché. Un renvoi
  exact prend celle qu'il écrit ; **un renvoi approché vers ce nom devient
  ambigu** : E4 depuis un bloc, E13 depuis un type ou un adversaire, avec
  deux candidats que rien ne distingue à l'écran, là où, sans la seconde,
  il était retrouvé et signalé (A1). C'est la lecture à la lettre d'E3
  (« même nom et même puissance »), retenue pendant le lot et qu'un
  contrôle épingle. L'autre lecture donnerait E3 à toute paire de
  capacités de même nom comparé, quelle que soit la puissance, avec un
  message à écrire : elle dirait la cause à la ligne où elle se corrige.
- **Les listes, la rencontre et la recherche** rangent toujours les noms
  tels qu'écrits. Un doublon à un signe près y fait deux lignes que rien ne
  distingue (E3 ou E16 le dit) ; une rencontre prend celui dont elle reçoit
  le nom exact ; un nom qui porte un signe invisible entre deux lettres ne
  se trouve pas en tapant ses lettres.
- **« Type » suivi d'un signe invisible**, dans la colonne Nom de la
  feuille Adversaires, définit désormais un type : la clé le reconnaît.
  **Un nom fait d'un seul signe invisible** entre dans la banque, sans E2.

Ce que la relecture finale du lot 3 a vu et que le lot laisse, **à
trancher par l'auteur** :

- **Un nom de zone plus large que sa case** est rogné, comme dans la
  maquette (§ 16.5). Faut-il abréger un mot seul sur une zone étroite ?
  C'est une règle d'affichage, que l'instruction ne dit pas.
- **Les liens pris dans une phrase** (les pièces d'un pack, les adversaires
  d'un type, et, depuis le lot 1, les renvois des fiches) ont la hauteur du
  texte, 21 px, et non les 44 px du § 9.
- **L'en-tête sur un téléphone** : la navigation porte huit liens, et prend
  une rangée de plus (189 px de 360 à 414 px de large) ; les onglets des
  listes, cinq, en prennent deux. Un en-tête replié serait un choix d'aspect.
  Depuis le lot 4, les liens sont neuf (« Combat », § 9) : la hauteur de
  l'en-tête n'a pas été reprise. La mission du lot 4 range l'en-tête du
  téléphone au lot des finitions (§ 13).
- **Une capacité d'arme sans arme** (A15) imprime « {degats} » tel quel sur
  la carte : c'est le comportement décrit, et il se verra à la table.

**Pour le lot 4 — simulateur de combat** (mission du 12/10/2026, § 17).
Ce sont des **conventions provisoires** : les règles qu'applique le
simulateur sans que le livret les dise, ou là où il s'en écarte. **Elles
priment jusqu'à la réécriture du livret**, et le simulateur les applique
toutes. Celles qui portent « (11/10) » ont été acceptées par l'auteur le
11/10/2026 ; les autres ont été tranchées par la mission, le 12/10/2026,
pour qu'aucun choix ne reste ouvert : l'auteur les confirme ou les corrige
à l'arrêt d'essais (§ 13). **Chacune est à écrire dans le livret**, à la
section dite. Les capacités que le simulateur reconnaît s'y nomment par
leur rôle (§ 17.6), les exemples viennent de la démonstration. Les règles
d'interface (choisir qui joue, revenir avant le premier dé, poser les
jetons, les noms courts) ne sont pas des règles du jeu : elles sont au
§ 17, et non ici.

1. **L'inversion (11/10)**, règle de l'auteur que le livret ne dit pas
   encore : le jet d'attaque d'un adversaire est le jet de défense du
   personnage visé ; un avantage de l'adversaire devient un désavantage du
   personnage dans le même jet, et inversement. Sections « Asymétrie des
   rôles lors des combats » et « Avantage et désavantage ».
2. **La distance.** Une diagonale compte pour une case : la distance de
   Tchebychev (11/10). Une portée absente vaut 0, la même case. La
   capacité de déplacement, jouée à la puissance P, mène à une case située
   à une distance de 1 à P. Section « Cases de combat ».
3. **Le désavantage et l'avantage sur la chaîne.** Le désavantage pèse sur
   chaque dé de la chaîne (11/10) : avec k désavantages, chaque dé se
   lance k + 1 fois, et l'on garde le pire. L'avantage relance le dé qui
   échoue, au choix du joueur. Section « Avantage et désavantage ».
4. **Le dé miroir** (groupe 2) : la valeur opposée vaut faces + 1 − valeur
   (11/10), prise sur la valeur brute, avant les modificateurs. Section
   « Dé miroir ».
5. **Le dé explosif.** La valeur maximale s'entend modificateurs compris ;
   le modificateur ne compte qu'une fois ; le dé explose tant qu'il montre
   sa face maximale et que la somme reste sous la difficulté. Section « Dé
   explosif ».
6. **Le coup critique** (groupe 2). Le quatrième dé ne se propose qu'aux
   jets d'attaque et de caractéristique ; il double aussi le surplus du
   passif « dégrossir ». Section « Coup critique ».
7. **Le moment des interventions** : après le jet de défense, avant les
   dégâts (11/10) ; après la localisation, s'il y en a une. Section
   « Actions de jeu ».
8. **Annuler des dégâts avec le souffle** passe par la capacité d'esquive,
   qui coûte une action (11/10, la maquette) ; **le livret (« Ressources »)
   le dit sans action**. Avec plusieurs zones touchées, l'annulation se
   fait zone après zone. Section « Ressources ».
9. **Les capacités qui « touchent » sans dégâts propres.** Leur jet est
   celui d'une arme, sur un bouton (11/10, la maquette) ; les dégâts de
   l'arme ne s'appliquent que si le joueur les demande. Sections
   « Capacités » et « Jets d'attaque ».
10. **Le dé d'attaque à mains nues** : une ou deux caractéristiques,
    choisies au moment du jet (11/10). Section « Jets d'attaque » (lot 2,
    plus haut).
11. **Le corps-à-corps** : l'attaquant et la cible sur la même case.
    Section « Cases de combat ».
12. **La face de contre-attaque.** La face 1 d'un adversaire annule
    l'attaque du personnage, comme la face 20 d'un personnage annule celle
    de l'adversaire ; **le livret ne le dit que pour le personnage**. Sur
    l'un des dés d'une localisation multiple, elle annule toute l'attaque.
    **Le livret dit « un 1 sur un jet d'attaque » (« Jets de
    localisation »), puis « un jet de localisation » (« Contre-attaque ») :
    le simulateur suit le second**, comme les grilles des adversaires
    (§ 16.3). La localisation se fait dès que l'attaque touche, même sans
    dégâts : **une capacité sans dégâts peut donc être annulée**. La face
    se lit sur le dé brut : un décalage ne la crée ni ne l'efface ; la face
    décalée reste sur une zone, de 1 à 19 sur un personnage, de 2 à 20 sur
    un adversaire. Sections « Jets de localisation » et « Contre-attaque »,
    à accorder.
13. **Les blessures** : le −1 par zone sans résistance vaut pour les dés de
    la chaîne, pas pour le dé de localisation. Section « Ressources ».
14. **Les adversaires** : leur souffle ne se recharge pas pendant un
    combat, et n'annule pas de dégâts (11/10) ; une zone sans résistance
    est « blessée », sans effet calculé (11/10) ; ils meurent à 0 de corps
    (11/10) ; un coût en lien ne se paie pas, et le journal le dit ; ils
    jouent leurs capacités à leur rang ; ils n'ont que les capacités de
    leur ligne : sans capacité de déplacement, un adversaire ne se déplace
    pas, sauf par le clic droit (groupe 2) ; les bonus et malus +N des
    passifs ne s'appliquent pas à eux. Section « Caractéristiques d'un
    adversaire » (lot 3, plus haut).
15. **Les effets « jusqu'à votre prochain tour »** cessent au début du
    prochain tour du camp de leur auteur (11/10) (groupe 2). À la mort d'un
    protagoniste, les effets qu'il a lancés durent jusqu'à leur échéance.
    La capacité d'attente dure de même : jusqu'au prochain tour du camp de
    son auteur. Section « Temporalité ».
16. **Alterner dans un camp** : les protagonistes du camp qui joue peuvent
    alterner leurs actions ; le livret (« Temporalité ») dit seulement
    qu'ils choisissent qui joue dans quel ordre. Section « Temporalité ».
17. **Le lien** : la jauge part pleine. Section « Ressources » (lot 2, plus
    haut).
18. **Le bouclier.** Sa défense s'affiche, sans effet, car le livret
    (« Objet ») ne le définit pas. Section « Objet » (lot 2, plus haut).
19. **Les objets portés.** Les armes, les armures et le bouclier ne donnent
    leurs capacités que portés, et une seule arme : la tenue. Les autres
    objets les donnent où qu'ils soient. Section « Objet » (lot 2, plus
    haut : le créateur de personnage, lui, compte tout l'équipement).
20. **Les types d'armure mêlés** donnent 1 désavantage en défense : **la
    maîtrise des pièces n'est pas définie**. Section « Jets de défense »
    (lot 2, plus haut).
21. **Une seule arme par tour** (élément Arme) : le simulateur ne le
    contrôle pas. Section « Objet » (lot 2, plus haut).
22. **Une attaque à plusieurs cibles** se fait avec un jet par cible
    (groupe 2). Section « Jets d'attaque ».

**Les précisions**, que ni le livret ni ces vingt-deux points ne portent.
La mission en dit quatre ailleurs qu'en sa liste (son § 8.4, accepté le
11/10/2026 : les points 23, 24 et 33, et le cœur du 34) ; les vingt
autres ont été arrêtées le 12/10/2026 : dix-neuf en écrivant le moteur,
par l'agent principal, par le contrat d'écriture du lot ou par un lot
d'écriture ; la dernière (point 46) était dans le moteur sans être écrite
nulle part, et c'est la relecture de fin de groupe qui l'a relevée.
**L'auteur ne les a pas vues**, et les confirme ou les corrige à l'arrêt
d'essais. Chacune est réversible, et **à écrire dans le livret** de même,
ou, pour ce qui tient à une cellule, dans le classeur et son `lisez_moi`.

23. **Les maîtrises au combat.** Une capacité que donne un objet Lourde,
    Agile ou Précise a 1 désavantage, sauf si une maîtrise de ce poids, au
    rang N, couvre sa position dans la liste du bloc : la règle des
    adversaires (§ 16.4), appliquée au personnage aussi, par la même
    fonction. Au rang 0, une maîtrise ne couvre rien. La fiche de
    personnage ne le calcule toujours pas. Sections « Maîtrises » et « Jets
    d'attaque » (lot 2, plus haut).
24. **Le N d'un passif câblé** (§ 17.6) est le niveau de cette capacité
    chez le personnage, son rang chez l'adversaire ; le niveau du
    personnage n'entre dans aucun calcul. Section « Niveau », et la
    description de ces capacités dans le classeur. Ce que cela donne au
    niveau 0, et pour deux passifs du même rôle : point 45.
25. **Un paramètre présent mais non calculé** (une portée, un nombre de dés
    de localisation, des dégâts écrits d'une façon que le § 15.2 ne lit
    pas) prend sa valeur neutre : portée 0, un dé, pas de dégâts ; pour un
    personnage, la préparation le dit par un avertissement. Un
    `loc_multiple` inférieur à 1 vaut 1, une portée négative 0, des dégâts
    négatifs 0. Dans `lisez_moi`.
26. **Les puissances jouables** vont de 1 au niveau, parmi celles qui ont
    une variante (des variantes 1 et 3, au niveau 3 : 1 et 3). Une capacité
    qui n'évolue pas se joue à la puissance 0. Section « Capacités ».
27. **Le coût.** Négatif, il vaut 0. Le même X vaut pour le souffle et pour
    le lien d'une capacité ; il se choisit de 0 à ce qui reste, le plus
    petit des restes des ressources dont le coût porte X ; pour un
    adversaire, qui ne paie pas le lien, seul le souffle le borne. Un coût
    illisible rend la capacité injouable, et l'écran le dit. Sections
    « Capacités » et « Ressources ».
28. **Les dégâts à mains nues** à la puissance P se lisent dans la
    description de la capacité, comme sur la fiche (§ 15.2). Section « Jets
    d'attaque ».
29. **Une attaque que ne donnent ni l'arme tenue ni le bloc de base** :
    son dé se choisit comme à mains nues. Aucun cas aujourd'hui. Section
    « Jets d'attaque ».
30. **La défense, à égalité de dés** : le type retenu est celui de la
    première pièce portée ; sans armure, l'ordre lourde, agile, précise
    (c'est la fiche, § 15.2). Le livret laisse ce choix au joueur : l'écran
    affiche le type retenu, sans le laisser changer. Section « Jets de
    défense ».
31. **Une capacité reçue de plusieurs origines** n'a qu'un bouton, sous la
    première qui la donne valablement, dans cet ordre : l'arme tenue,
    l'archétype, l'espèce, le style, la constellation, le primordial, les
    autres objets, le bloc de base. Elle en suit les paramètres, la
    description et la maîtrise. Section « Création » (lot 2, plus haut,
    « Une capacité reçue deux fois »).
32. **Un adversaire sans nombre d'actions** ne s'ajoute pas à un combat ;
    avec zéro action écrit, il s'ajoute et ne joue jamais. **Sans souffle
    écrit**, il a un souffle de 0, affiché « — ». Section
    « Caractéristiques d'un adversaire ».
33. **« Dégrossir » chez un adversaire** : les réussites de son attaque
    valent 3 moins celles de la défense du personnage. Section « Asymétrie
    des rôles lors des combats ».
34. **« Dégrossir », son champ.** Il vaut pour toute attaque, mains nues
    comprises, et pour un jet d'arme prêté dont le joueur demande les
    dégâts de l'arme ; jamais sans dégâts, ni pour des dégâts fixés à 0, ni
    pour des dégâts directs, ni sur un coup que l'esquive a annulé en
    entier. Il compte les réussites du jet, non un ajustement fait à la
    main. Son surplus ne passe pas à la résistance, qui reçoit « les dégâts
    moins l'armure d'avant le coup ». Section « Armure, résistance et
    corps ».
35. **Passer son tour** ne coûte rien ; le protagoniste a joué, et ses
    actions restantes ne servent plus à ce tour. Section « Actions de
    jeu ».
36. **Le dé explosif, la suite.** Devant un dé qui peut exploser, le faire
    exploser est la seule suite ; le dé d'une explosion se lance une seule
    fois, même sous désavantage, où seul le dé gardé explose ; une relance
    d'avantage remplace le dé et sa somme ; l'explosion s'arrête dès que la
    somme n'est plus sous la difficulté. Section « Dé explosif ».
37. **Un allié** est un protagoniste vivant du même camp, autre que soi.
    **Les effets qui portent sur un mort cessent.** Section « Combat ».
38. **Le jet d'arme prêté** (point 9) prend la portée et le nombre de dés
    de localisation de l'arme prêtée : pour un personnage, l'arme tenue,
    et sans elle sa capacité à mains nues à son niveau, avec son dé au
    choix et ses dégâts ; pour un adversaire, l'arme qu'il choisit s'il en
    a plusieurs, et sans arme une portée de 0, un dé, des dégâts saisis à
    la main. Il reçoit les avantages des passifs, **sans le désavantage de
    maîtrise**, ni pour qui le lance, ni par inversion. Sections « Jets
    d'attaque » et « Maîtrises ».
39. **Les dégâts directs**, saisis à la main : ils remplacent ceux du
    coup, demandent un nombre et une raison, et vont à la résistance de la
    zone touchée (le reste au corps) ou droit au corps, sans toucher
    l'armure. Section « Armure, résistance et corps ».
40. **Une seule esquive par attaque** (groupe 1) : elle s'offre au
    personnage visé tant qu'il lui reste une action et du souffle, et que
    les dégâts dépassent 0 ; elle annule de 1 au plus petit de son souffle
    et du total des dégâts. Section « Ressources ».
41. **Après une face de contre-attaque**, les dés de localisation restants
    ne se lancent pas ; **l'action et le coût de l'attaquant restent
    payés** (ils le sont au premier dé). C'est, de toutes ces lectures, la
    seule qui change un état : à confirmer en premier. Section
    « Contre-attaque ».
42. **Un adversaire qui porte la capacité du jet de caractéristique** la
    joue sans jet : seuls les joueurs lancent des dés, et il n'a pas de
    caractéristiques. Section « Jets de caractéristique ».
43. **Une attaque dont les dégâts ne se lisent pas** touche « sans
    dégâts », et le joueur les saisit. Chez un adversaire, une capacité
    citée sans arme est une attaque si elle a des dégâts propres ou porte
    l'élément Dégâts ; sinon elle se joue sans jet, ou par le jet prêté.
    Section « Jets d'attaque ».
44. **La face d'un dé de localisation se décale** tant que ni l'esquive ni
    l'application des dégâts n'ont été jouées. Section « Jets de
    localisation ».
45. **Un passif câblé au niveau 0, et deux passifs du même rôle**
    (12/10/2026, en écrivant le moteur ; la mission n'en dit rien). Au
    niveau 0, un passif câblé ne fait rien (+0, aucun avantage), sauf le
    −1 du rôle « petit », qui ne dépend pas de N. La fiche le dit comme le
    jet l'applique (correction de la relecture, § 17.6) : inactif,
    « niveau 0 », avec « sans effet » à la place de « +0 » ; pour
    « petit », « −1 en force » seul, actif chez un personnage. Ces mots ne
    sont pas de la mission. Deux passifs du même rôle comptent tous les
    deux ; pour « dégrossir », le premier seul. À confirmer. Section
    « Niveau », et la description de ces capacités dans le classeur.
46. **Plusieurs relances sur un même dé** (12/10/2026 ; la mission dit
    « k relances pendant le jet », sans dire si un même dé en reçoit
    plusieurs). Avec deux avantages ou plus, un dé relancé qui échoue
    encore se relance, tant qu'il reste une relance : les relances se
    comptent par jet, non par dé (§ 17.4, § 17.9). Ni le combat de
    référence de la mission ni celui de la démonstration n'ont deux
    relances dans un jet. À confirmer. Section « Avantage et
    désavantage ».

**Ce qui manque encore, et que le simulateur laisse à la main**, par une
saisie ou un choix, sans rien inventer :

- **L'effet propre de chaque capacité**, écrit en texte libre dans le
  classeur : il s'applique à la main, sa description sous les yeux (§ 17).
  Le lire seul demanderait une colonne codée dans le classeur, hors de ce
  lot.
- **Une capacité de déplacement qui n'évolue pas** (puissance 0) : « une
  distance de 1 à P » ne lui offre aucune case, et elle ne se joue pas :
  son bouton est inactif et dit « aucune case à sa portée » (§ 17.6 ; ces
  mots ne sont pas de la mission). Aucun cas dans la démonstration ni dans
  le classeur réel au 12/10/2026. Section « Cases de combat », ou le
  classeur.
- **Les charges des consommables, les points d'historique, la recharge du
  souffle et du lien, les effets de terrain d'une case** : hors du lot ;
  rien n'en est calculé.

**Des bornes et des phrases que la mission ne donne pas**, posées le
12/10/2026 par les corrections de la relecture de fin de groupe (§ 14) :
**l'auteur ne les a pas vues**. Ce ne sont pas des règles du jeu, et rien
n'en va au livret ; elles sont ici pour être confirmées ou corrigées à
l'arrêt d'essais, avec les précisions. Chacune est réversible.

- **Les bornes** : 5 000 événements par combat, là où il y en avait
  20 000 ; 100 tirages par dé ; un compteur des identifiants arrêté à
  99 999 (§ 17.3) ; 600 façons par photographie, dont 20 pour ses
  capacités de déplacement ; 200 000 signes pour la source d'un adversaire
  (§ 17.2) ; une révision de 2^40 au plus, qui repart de 1 à sa borne
  (§ 17.8). La première est à confirmer d'abord : elle tient à une
  mesure (§ 17.11), et sa marge sur un long combat paraît mince, sans
  mesure qui le dise (§ 17.3).
- **Les phrases** : « Ce combat a épuisé ses identifiants : commencez-en
  un nouveau. » ; à la suite de « Ne s'ajoute pas : », « la source de la
  photographie dépasse 200 000 signes. », « la photographie compte plus de
  600 façons. » et « les capacités de déplacement comptent plus de
  20 façons. » ; dans le refus d'un combat gardé, que l'écran ne montre
  pas, « L'événement « de » : « valeurs » compte plus de 100 tirages. » et
  « Le compteur des identifiants n'est pas un entier de 0 à 99 999. » ;
  sur une fiche, « sans effet » et « niveau 0 » (point 45) ; sur un bouton
  de déplacement, « aucune case à sa portée ».

**Pour le lot des objets, sorts et équipement** (lot à fixer, § 13) : ce
qu'est un sort (le mot n'apparaît pas dans le Word) ; la grammaire des
expressions : le créateur de personnage en calcule une (§ 15.2 : nombres,
`{nom}`, `N`, + − × ÷, `X`, arrondi inférieur), que le Word ou `lisez_moi`
devra confirmer ou étendre (parenthèses, signe).

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
| **3 — Adversaires** | la feuille Adversaires du classeur des règles, son import et ses dix-sept codes de contrôle ; la résolution (types, multiplicateur, armure par zone, capacités, désavantage) ; la consultation des types et des adversaires, résolus ; la carte et l'impression d'une rencontre (§ 16) | l'auteur : republier la banque depuis le classeur à jour ; § 12, lot 3 |
| **4 — Simulateur de combat** | groupe 1, le combat jouable : le signe invisible dans les noms, le classeur d'essai, le moteur du combat, l'enregistrement chiffré, l'écran ; groupe 2, les règles fines et la main du MJ : les interventions, la contre-attaque, le coup critique, le dé miroir, les passifs payants, la palette de modificateurs, les états, le clic droit, plusieurs cibles (§ 17) | l'auteur : l'arrêt d'essais entre les deux groupes ; § 12, lot 4 |
| — Éditeur d'adversaire (lot à fixer) | l'éditeur dans la page, l'assistant de calibrage, les prétirés, l'enregistrement d'une rencontre | — |
| — Progression du personnage (lot à fixer) | niveaux, expérience, historique | § 12 |
| — Objets, sorts, équipement (lot à fixer) | créateur, « Copier comme lignes Excel » | § 12 |
| — Finitions (lot à fixer) | fiche de jeu à compteurs, PDF sur téléphone, annulation d'une publication, code QR vers le téléphone, l'en-tête du téléphone | — |

L'ordre des lots 2 à 4 a changé le 29/09/2026 (décision de l'auteur) : le
personnage passe avant l'adversaire. Il a changé de nouveau le 12/10/2026
(mission du lot 4, validée par l'auteur) : **le lot 4 est le simulateur de
combat**. « Le suivi des dégâts à l'écran », jusque-là rangé avec l'éditeur
d'adversaire, en fait partie. Les lots qui suivent perdent leur numéro et
se rangent ainsi, chacun « lot à fixer » : la progression du personnage
(niveaux, expérience, historique), puis les objets, sorts et équipement,
puis les finitions. L'éditeur d'adversaire reste sans date.

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
relecteurs au plus, une seule liste, l'agent principal corrige). Depuis le
29/09/2026, les agents sont « autant que nécessaire », pour le travail
comme pour la relecture (décision de l'auteur, reportée dans `CLAUDE.md` au
lot 4) : le compte rendu dit combien, à quoi, et ce qu'ils ont coûté.

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

**Le lot 3 est livré** (11/10/2026, spécification 1.3), d'un seul tenant,
selon l'instruction du 11/10/2026 (`plans/instruction_lot3.md`), sans
validation entre ses étapes. Les étapes : une cartographie du dépôt et de
la mission par cinq agents ; les types naturels, l'import de la feuille, le
module de résolution et ses dix-sept codes, le classeur d'essai et la
démonstration, écrits par l'agent principal ; la carte et les écrans, en
deux pistes menées par des agents ; la relecture du cœur (trois relecteurs,
quatorze sceptiques) et ses corrections ; les écrans vus dans un
navigateur ; la relecture finale à quatre angles (conformité, maquette,
sécurité de l'affichage, téléphone : quatre relecteurs, seize sceptiques),
ses corrections, dont l'impression dans Firefox ; la spécification 1.3. Le
travail a été interrompu trois fois, dont une par une panne de mémoire du
poste, sans rien abîmer (compte rendu, § 9). Ce qui reste à l'auteur :
republier la banque depuis le classeur à jour (les adversaires n'existent
pas dans la banque en place), puis les essais du compte rendu
(`plans/compte_rendu_lot3.md`) : deux adversaires sur PC et sur téléphone,
une rencontre imprimée dans Firefox et comparée à la maquette ; et les
points du § 12.

**Le lot 4 en est à la fin de son groupe 1** (12/10/2026, spécification
1.4), selon la mission du 12/10/2026 (`plans/instruction_lot4.md`), validée
par l'auteur avec la maquette du 11/10/2026 (`plans/maquette_simulateur.html`
et ses deux rendus, hors dépôt). Il se fait **en deux groupes, chacun d'un
seul tenant, avec un arrêt d'essais entre les deux** : le compte rendu du
groupe 1 (`plans/compte_rendu_lot4_groupe1.md`) donne à l'auteur une liste
d'essais, et le groupe 2 ne commence que sur sa parole ; si les essais
demandent un ajustement, un complément à la mission
(`plans/complement_lot4_groupe2.md`) l'écrit, et prime sur elle. La
spécification passe en 1.4 à la fin du groupe 1, en 1.5 à la fin du
groupe 2. Les étapes du groupe 1 :

1. **le signe invisible** dans les noms, correction recommandée au lot 3
   (§ 6.3, § 12) ;
2. **le classeur d'essai** et la démonstration : ce qui manquait au
   simulateur (§ 10.3) ; ces deux étapes, commit `40db3a0`, 458 contrôles ;
3. **le moteur du combat**, sans page (§ 17.1 à § 17.6) ;
4. **l'enregistrement** chiffré (§ 17.8) ;
5. **l'écran** (§ 17.7), sans ce qui est au groupe 2 ; ces trois étapes,
   commit `fda3a2a`, 1 392 contrôles. Elles ont suivi une cartographie du
   dépôt, de la mission, du livret et du classeur ; des arbitrages de
   l'agent principal ; le combat de référence fictif, composé puis calculé
   à la main trois fois, avant le code (§ 17.10) ; un contrat d'écriture,
   tiré de deux conceptions ; puis vingt lots d'écriture, deux lots ne
   touchant jamais le même fichier, chacun rendant ce qu'il avait dû
   préciser du contrat ;
6. **les contrôles, les mises à l'épreuve et les mesures** (commit
   `c4cff7d`, 1 476 contrôles) : les contrôles du moteur mis à l'épreuve
   en six groupes, 1 030 casses jouées une à une sur une copie hors de
   OneDrive, par un seul lanceur ; l'écran regardé dans Edge et dans
   Firefox contre les deux images de la maquette, puis les quatre mesures
   de la mission, et un combat joué de bout en bout par de vrais clics ;
   le combat de référence fictif et le banc sur le classeur réel, hors
   dépôt (§ 17.10, § 17.11). Un contrôle du lot 2 bis, qui attendait une
   durée fixe et a fait refuser un envoi sur le poste chargé, attend
   désormais ce qu'il vérifie (commit `d51c16a`). **Les contrôles de
   l'écran ne sont pas encore mis à l'épreuve** à l'écriture de ce
   paragraphe (§ 17.11) ;
7. **la fin du groupe** : la spécification 1.4 (§ 17, nouveau ; § 0, § 2,
   § 9, § 11, § 12 amendés) et `CLAUDE.md` ; une relecture de la
   spécification, onze constats ; la relecture de fin de groupe, sept
   relecteurs à sept angles, soixante constats (§ 14) ; ses corrections
   du moteur et de l'enregistrement, chaque défaut vérifié avant d'être
   corrigé (une sonde, une mesure ou la lecture du code), chaque
   correction mise à l'épreuve (72 casses, toutes vues) : les corrections
   du moteur (40 casses) sont dans le commit `c4cff7d`, avec l'étape 6 ;
   celles de l'enregistrement et des bornes (32 casses) dans le commit de
   fin de groupe ; celles de
   l'écran, **en cours à l'écriture de ce paragraphe** ; le compte rendu.

**Un écart à la méthode**, relevé par la relecture : le commit `fda3a2a`
(les étapes 3 à 5) a été envoyé sans son paragraphe, contre la règle de
`CLAUDE.md`, « la spécification s'amende avec le code ». Dans le dépôt
public, la spécification est restée en version 1.3, sans § 17, jusqu'au
commit `c4cff7d`, qui porte la version 1.4.

**La conduite du lot.** Les agents sont « autant que nécessaire »
(décision de l'auteur du 29/09/2026) ; leur compte et leur coût sont au
compte rendu. La mémoire du poste a été veillée tout au long, une panne
ayant interrompu le lot 3 : le seuil d'arrêt de la mission, 18 Go de
mémoire validée, a été relevé à 20 par l'auteur le 12/10/2026 ; aucun
arrêt pour mémoire.

**Ce qui manque encore pour que le groupe soit fini**, au sens de la
mission (son § 17), à l'écriture de ce paragraphe : les corrections de
l'écran et leur regard dans un navigateur ; les mises à l'épreuve des
contrôles de l'écran ; la mesure du clic, refaite poste au calme, dans
Firefox et dans Edge (§ 17.11) ; les contrôles passés par le crochet et
sur GitHub Actions au commit de fin de groupe, et leur nombre ; le site en
ligne qui joue un combat de démonstration jusqu'au bout ; le compte rendu.

Ce qui reste à l'auteur, à l'arrêt d'essais : la démonstration sur son
téléphone ; sur son ordinateur, un combat réel avec deux de ses personnages
en ligne et une rencontre de quatre adversaires posée d'un clic ; le début
du combat de référence de la mission, rejoué à la main et comparé à la
maquette ; un rechargement en plein combat ; « Copier » et « Télécharger » ;
puis confirmer ou corriger les conventions du § 12, « Pour le lot 4 ».
Rien de réel n'est publié par le lot : seul l'auteur publie.

---

## 14. Révisions

**1.4 — 12/10/2026.** Lot 4, groupe 1 : le simulateur de combat, le combat
jouable.

- Décisions de l'auteur, par la mission du 12/10/2026 (§ 1, § 2, § 13) :
  le lot 4 est le simulateur de combat, en deux groupes séparés par un
  arrêt d'essais ; « le suivi des dégâts à l'écran » quitte l'éditeur
  d'adversaire ; les lots suivants perdent leur numéro (la progression du
  personnage, puis les objets, sorts et équipement, puis les finitions).
  Le simulateur est assisté et se joue à la main, sans intelligence
  artificielle ; ses conventions provisoires priment jusqu'à la réécriture
  du livret ; vert pour les personnages, rouge pour les adversaires (§ 2).
  Dans `CLAUDE.md` : les agents « autant que nécessaire » (29/09/2026), la
  consommation au compte rendu sans relevé `/usage` (30/09/2026).
- Étape 1, **le signe invisible** (commit `40db3a0`) : `js/banque/noms.js`
  retire vingt et un signes de format ; la clé d'un nom les ignore, les
  doublons (E3, E16, A16) comparent les noms exactement après ce retrait,
  A1 le dit, les fiches comptent un doublon de même (§ 6.3, § 10.1,
  § 16.6) ; aucun de ces signes ne s'écrit tel quel dans le dépôt ; ce que
  la correction laisse (§ 12). 18 contrôles, tous vus échouer sur une
  casse du code puis passer (49 casses, hors de OneDrive) ; un relecteur :
  huit constats, dont un majeur (la moitié « exactement » de la règle
  n'était gardée par aucun contrôle), tous corrigés.
- Étape 2, **le classeur d'essai** (même commit) : les éléments
  Intervention et Passif, Passif sur douze capacités, Intervention sur
  deux, deux capacités de plus au bloc de base ; la banque et le
  personnage de démonstration régénérés, le sel gardé ; aucun adversaire
  n'en change (§ 10.3, § 15.7, § 16.7). 458 contrôles.
- Étape 3, **le moteur du combat** (commit `fda3a2a` ; § 17, nouveau) : un
  combat est une mise en place, puis une suite d'événements, dés compris ;
  un noyau sans page, sans banque, sans hasard ni heure, dont une seule
  porte, l'offre, dit ce qui est permis (§ 17.1) ; les protagonistes et
  leur photographie (§ 17.2) ; les tours, les actions, la mort, la fin
  (§ 17.3) ; la chaîne, l'avantage et le désavantage avec leurs sources, le
  dé explosif, l'inversion (§ 17.4) ; l'attaque, la portée, la
  localisation, les dégâts zone par zone, l'esquive (§ 17.5) ; les
  capacités, les huit passifs câblés, les maîtrises, les rôles reconnus à
  leur nom, ceux du vrai classeur par leur seule empreinte (§ 17.6) ; le
  journal et ses gabarits (§ 17.9). Des modules existants, par ajouts
  seulement : la règle de position des maîtrises, partagée ; ce que la
  résolution rend de plus (§ 16.4) ; la rencontre préparée, lue sans rien
  enregistrer (§ 16.6).
- Étape 4, **l'enregistrement** (même commit) : le combat gardé sur
  l'appareil, chiffré par la clé de table, dans une base à part, un combat
  par mode ; une révision qui ne redescend jamais, et un second onglet qui
  n'écrase rien ; ses cas d'échec et ce que dit la barre de titre (§ 7.2,
  § 17.8).
- Étape 5, **l'écran** `#/combat` (même commit) : la carte de 10 × 10
  cases, les fiches vivantes, le panneau d'action, la préparation, le
  journal à copier et à télécharger ; trois dispositions ; « Combat » dans
  la navigation ; deux exceptions écrites au § 9 : les onze couleurs du
  combat, et des cases de moins de 44 px sur un téléphone, chacune doublée
  d'un bouton de 44 px (§ 9, § 17.7).
- Étape 6, **les contrôles, les mises à l'épreuve et les mesures** (commit
  `c4cff7d` ; § 11, une ligne « Combat » ; § 17.10, § 17.11) : 1 392
  contrôles au commit `fda3a2a`, dont 934 neufs ; 1 476 au commit
  `c4cff7d`. Le combat de référence fictif, calculé à la main trois fois
  avant le code, sort du moteur mot pour mot, avec son état final ; le
  banc du 12/10/2026 sur le classeur réel, hors dépôt, rejoue le combat de
  référence de la mission sans écart, et chaque rôle câblé y est reconnu
  par son empreinte. **Les contrôles du moteur mis à l'épreuve**, en six
  groupes, sur une copie hors de OneDrive : 1 030 casses, 947 vues
  d'emblée, 75 non vues au premier passage ; 68 de celles-ci sont vues
  depuis, 5 sont équivalentes, preuve à l'appui, et 2 ne se voyaient
  qu'en mode réel ; aucun défaut du code. **Dans de vrais navigateurs**
  (Edge 155 et Firefox 143, sans fenêtre) : le regard sur la maquette, et
  douze écarts corrigés ; aucune case qui déborde sur 98 largeurs ; un
  clic à l'écran à jour en 31,6 ms dans Edge, à 1 440 px, sur un combat
  de 300 événements et quinze protagonistes (médiane ; le pire, 60,2 ms ;
  poste chargé, sans fenêtre) ; dans Firefox, la cible de
  100 ms n'est pas tenue pour tous les clics, sur un poste chargé : à
  remesurer ; un combat joué de bout en bout par de vrais clics, dans
  Edge, Firefox et Chrome. Les contrôles de l'écran ne sont pas encore
  mis à l'épreuve (§ 17.11).
- Étape 7, **la spécification** : le § 17, nouveau ; le § 0 dit
  l'exception du combat à « le programme n'invente aucune règle », et
  l'interdit 2 la règle des noms du lot ; § 2, § 9, § 11, § 12 et § 13
  amendés. Elle a rejoint le dépôt au commit `c4cff7d`, un commit après
  le code qu'elle décrit : le commit `fda3a2a` avait été envoyé sans elle
  (§ 13).
- Relecture de la spécification 1.4 : onze constats, dont trois majeurs.
  Le § 0 démentait le lot (il disait de s'arrêter devant une règle
  absente, quand le simulateur applique ses conventions) : l'exception y
  est écrite. Une précision arrêtée en écrivant le moteur passait pour
  acceptée par l'auteur : elle est à part (§ 12, point 45), et les
  dix-neuf que l'auteur n'avait alors pas vues sont dites telles (vingt
  depuis la relecture de fin de groupe, plus bas). Le § 17.11
  tenait lieu de mesures par un paragraphe d'attente : il a d'abord dit
  ce qui n'était pas mesuré, puis reçu les mesures, à la fin du groupe.
  Huit mineurs, corrigés : le simulateur absent de « ce
  qu'est ce programme », un compte de dés (48 événements
  de dé, 50 lancers), le quinzième rôle, deux fonctions dites une, la
  ligne des rôles absents, le « +k » sous 44 px, une phrase sur les
  empreintes raccourcie, les phrases de la barre de titre hors mission.
- Relectures de fin de groupe, aux angles de la mission (son § 17), par
  sept relecteurs : **soixante constats**, dont un bloquant et quatorze
  majeurs.
  - **Le moteur, règle par règle**, en deux moitiés : neuf constats, deux
    majeurs. Une valeur de dé passée sous zéro s'écrivait avec un trait
    d'union, à côté du signe moins du modificateur (§ 17.9) ; aucun
    contrôle ne photographiait, depuis une banque, un adversaire à passifs
    câblés, ni ne voyait une capacité reconnue par son empreinte ; un
    passif de niveau 0 se disait actif, « +0 » ; un déplacement de
    puissance 0 ouvrait un geste sans issue ; une maîtrise que seule une
    arme au sac donnait levait un désavantage ; un nom fini par un chiffre
    prenait les initiales et le jeton d'un exemplaire ; le contrôle des
    plafonds ne tenait pas son second membre. Corrigés (§ 17.2, § 17.6,
    § 17.9).
    Laissés, et dits : deux noms au même premier mot ont des initiales de
    8 à 11 signes (§ 17.2) ; des fichiers de l'arbre de travail en fins
    de ligne LF.
  - **Le recalcul à la main**, sans lire le code : trois constats
    mineurs. Les 19 lignes du combat de référence de la mission et les
    36 du combat de référence fictif, recalculées, sont celles du journal
    attendu et du moteur, sans écart. Trouvé : le même signe moins ; une
    lecture que rien n'écrivait, la double relance (§ 12, point 46) ; les
    faces des zones, que le banc ne disait pas (§ 17.10).
  - **La sécurité** : neuf constats, le bloquant et trois majeurs. Le
    bloquant : un nom du vrai classeur dans deux lignes d'un contrôle
    envoyé, retiré, et resté dans l'historique (§ 17.11). Une enveloppe
    longue (dès 4,48 Mo de base64, sous Node) faisait lever la lecture,
    et l'écran restait sans combat ni bouton à chaque visite ; le rejeu
    d'un contenu forgé de 20 000 événements, synchrone à l'ouverture,
    demandait de 31 secondes à plus de sept minutes selon la charge du
    poste (sous Node) ; une révision démesurée ne laissait plus rien
    s'écrire ; un compteur d'identifiants forcé donnait un combat qui ne
    se relisait plus ; la source d'un adversaire n'était bornée qu'en
    profondeur. Corrigés (§ 17.2, § 17.3, § 17.8, § 17.11). Deux autres
    tiennent à l'écran, et suivent ses corrections. Sans correction, à
    trancher par l'auteur : ce que valent les empreintes (§ 17.6).
  - **La conformité de l'écran et de l'enregistrement** (quatorze
    constats, cinq majeurs), **le téléphone et l'accessibilité** (quinze,
    trois majeurs), **la fidélité à la maquette** (dix, un majeur).
    Trouvé, entre autres : le journal rouvert sur ses premières lignes au
    retour sur l'écran ; un bouton du site inactif qui garde l'aspect d'un
    bouton actif ; le focus invisible sur le jeton de celui qui joue ; une
    saisie refusée qui ne dit rien ; les noms courts de la carte coupés à
    partir de 56rem ; quatre endroits où le code est juste et où aucun
    contrôle ne le tenait. **Leurs corrections sont en cours à
    l'écriture de cette entrée** : elle sera complétée. Ceux qui visaient
    ce document y sont portés (§ 13, § 17.7, § 17.11).
  - Les corrections du moteur et de l'enregistrement ont été mises à
    l'épreuve par le même lanceur : 72 casses, toutes vues (40 pour le
    moteur, dont les corrections sont dans le commit `c4cff7d`, avec
    l'étape 6 ; 32 pour l'enregistrement et les bornes, dont les
    corrections sont dans le commit de fin de groupe) ; le banc sur
    le classeur réel, relancé après chaque série, reste sans écart.
- Ce que le livret ne dit pas encore (§ 12) : un bloc « Pour le lot 4 —
  simulateur de combat », les vingt-deux conventions provisoires de la
  mission et vingt-quatre précisions (quatre que la mission dit ailleurs,
  vingt que l'auteur n'a pas vues : dix-neuf arrêtées en écrivant le
  moteur, une relevée par la relecture de fin de groupe),
  chacune « à écrire dans le livret », et ce que le simulateur laisse à la
  main ; les bornes et les phrases que les corrections de la relecture
  ont posées hors de la mission, à confirmer ; les entrées des lots
  2 et 3 que le simulateur tranche y renvoient ; l'ancien bloc du lot 4
  devient « Pour le lot des objets, sorts et équipement ». La
  contre-attaque se lit sur le jet de localisation : la formulation du § 16
  s'y accorde.
- Le code : `js/combat/` (dix-huit modules), `js/personnage/disponibles.js`,
  cinq modules d'écran, `css/combat.css` (§ 3.2) ; aucune dépendance
  (§ 10.2).

**1.3 — 11/10/2026.** Lot 3 : les adversaires.

- Décisions de l'auteur du 11/10/2026 (§ 1, § 2) : la feuille
  « Adversaires » vit dans le classeur des règles, facultative ; pas de mot
  de passe du MJ ; la carte suit la maquette du lot, et sa police, EB
  Garamond, est hébergée (§ 10.2).
- La banque : `types_adversaires` et `adversaires`, les lignes gardées
  telles qu'écrites (§ 5.1) ; l'import de la feuille, ses en-têtes, I4
  (§ 16.1) ; les types de bloc « Arme naturelle » et « Armure
  naturelle » (§ 4.1) ; les différences et le message de publication
  (§ 6.4).
- Le contrôle : dix-sept codes à la suite des autres, trente-six en tout
  (E8 à E16, A11 à A16, I4, I5), venus de la résolution elle-même, rangés à
  la ligne où ils se corrigent ; le tri par nombre (§ 6.3).
- Les adversaires (§ 16, nouveau) : la feuille et sa notation (§ 16.1) ;
  l'héritage, le multiplicateur, l'arrondi une seule fois, un seul module de
  résolution (§ 16.2) ; la grille, la résistance, le corps, les nombres
  (§ 16.3) ; l'équipement, l'armure zone par zone, les capacités, les
  maîtrises et le désavantage (§ 16.4) ; la carte et son impression
  (§ 16.5) ; les écrans : deux catégories de plus, la fiche résolue et sa
  provenance, la fiche d'un type, la rencontre (§ 16.6, § 9) ; la
  démonstration (§ 16.7) ; les mesures (§ 16.8). Ce que le livret ne dit pas
  encore, et ce que l'instruction ne tranchait pas (§ 12).
- Le code : `js/adversaire/`, trois écrans, l'échelle d'un papier partagée
  avec la fiche de personnage, seule écriture de style (§ 3.2, § 10.1) ;
  `dom.js` n'affiche plus les signes qui commandent le sens de l'écriture
  (§ 10.1) ; contrôles (§ 11 : 440 contrôles).
- Relectures. Le cœur, par trois relecteurs et quatorze sceptiques : 32
  constats, 12 confirmés, 2 réfutés ; corrigés, sauf deux laissés (un
  nombre à plus de six décimales dit illisible ; les signes invisibles).
  La carte et les écrans, à quatre angles, par quatre relecteurs et seize
  sceptiques : 19 constats, 16 vérifiés et tous confirmés (un important,
  quinze mineurs) ; 14 corrigés, 2 en partie, 3 laissés et écrits (§ 12).
  L'important : **Firefox imprimait la première page sans marge**, ce que la
  mesure faite avant la relecture, sur une page d'essai et non sur le site,
  n'avait pas vu (§ 16.5, § 16.8). Sur un grand écran, la carte et la
  lecture se montrent désormais ensemble (§ 16.6) ; la recherche trouve ce
  qu'un adversaire hérite ; le rang et une liste vidée disent leur origine.
- Mesures : le banc sur le classeur réel retrouve exactement les mesures de
  référence de l'instruction, avant et après les corrections ; 222
  mutations vues échouer (109 du cœur, 51 de la carte et des écrans, 62 des
  corrections) ; l'impression mesurée dans Chrome 154 et dans Firefox 143
  et 157 (§ 16.8).

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
- Vu en ligne après l'envoi des corrections : le parcours ne s'ouvrait plus
  dans un navigateur (`filter` appelé sur le résultat de
  `querySelectorAll`), ce que le document simulé, qui rendait un tableau,
  laissait passer. Corrigé ; le document simulé rend désormais une liste
  comme celle du navigateur, et 18 contrôles du parcours échouent sur le
  défaut (§ 11) ; le parcours entier repassé dans un vrai navigateur.


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
et le verso réduits à la largeur de l'écran (`zoom`, l'échelle posée par
`js/ecrans/echelle.js` en propriété CSS : la seule écriture de style du
code, un nombre, partagée avec la carte d'un adversaire, § 16.6), et
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

**Depuis le lot 4**, la démonstration porte ce que lit le simulateur de
combat (§ 10.3) : les éléments Intervention et Passif, et deux capacités de
plus dans le bloc de base. Aubépine a donc **dix-neuf capacités** : les
dix-sept d'avant, plus **Pas de côté** (une intervention, au coût en
souffle X) et **Guetter**, toutes deux du bloc « Gestes de cuisine », au
niveau 0, sans point à dépenser (10 dépensés, 8 reçus, comme avant). Six
de ses dix-sept capacités d'avant portent désormais un des deux éléments :
Passif sur Vif, Nez fin, Réduction, Solo du chef et Maîtrise de l'agile,
Intervention sur Dressage minute ; avec Pas de côté, sept en tout. Son
fichier suit trente-deux empreintes : treize blocs et
dix-neuf capacités. Un appareil qui avait rangé Aubépine avant cette
régénération lit six avertissements, « La capacité « … » a changé dans la
banque depuis l'enregistrement. » : ils n'empêchent rien, et « Ajouter le
personnage de démonstration », puis « Remplacer », les fait disparaître.
Le sel de la banque de démonstration est gardé d'une régénération à
l'autre : la clé de démonstration qu'un appareil a gardée rouvre la
nouvelle banque.

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

---

## 16. Les adversaires (lot 3)

Ce paragraphe suit le § 15 pour ne rien renuméroter. Le lot 3 (instruction
du 11/10/2026, validée par l'auteur, `plans/instruction_lot3.md`) : l'import
de la feuille « Adversaires » et ses contrôles ; la consultation des types
et des adversaires, **résolus** ; l'impression d'une rencontre. Hors lot :
l'éditeur d'adversaire dans la page, l'assistant de calibrage, les
prétirés, l'enregistrement d'une rencontre, le suivi des dégâts à l'écran.
Ce dernier est venu depuis, avec le simulateur de combat (lot 4, § 17), qui
pose d'un clic la rencontre composée ici.

**Préséance.** Le livret fait foi, mais il ne dit presque rien des
adversaires : sa section « Caractéristiques d'un adversaire » tient en une
phrase. Les règles de ce paragraphe sont des **décisions de l'auteur du
11/10/2026**, inscrites au § 12, « à écrire dans le livret ». Quand le livret
ne parle que des personnages (une seule arme équipée, deux pièces d'armure
interdites sur une même zone), sa règle reste celle des personnages (§ 15),
et celle d'ici vaut **pour les seuls adversaires**. Ce que le livret dit des
adversaires est appliqué tel quel : une grille de localisation propre à
chacun (« Jets de localisation »), **un 1 au jet de localisation**, qui
provoque toujours une contre-attaque, l'attaque et la défense qui sont les
difficultés des jets du joueur (« Asymétrie des rôles lors des combats »).
Sur ce 1, le livret a deux formulations : « un 1 sur un jet d'attaque »
(« Jets de localisation »), puis « un jet de localisation »
(« Contre-attaque »). La grille des adversaires suit la seconde, depuis le
lot 3 : c'est la face 1 du d20 de localisation qui est la contre-attaque
(§ 16.3) ; le simulateur de combat la lit de même (§ 17.5), et le § 12
demande d'accorder les deux sections (« Pour le lot 4 », point 12).

**Pas de mot de passe du MJ** : les adversaires se lisent avec le mot de
passe de table, comme le reste de la banque (décision de l'auteur).

### 16.1 La feuille « Adversaires »

Elle vit dans le classeur des règles, au même titre que `Blocs` (le « second
classeur » des versions précédentes n'existe pas). Elle est **facultative** :
absente, la banque n'a pas d'adversaires, et l'import le dit (I4). Présente,
ses en-têtes se retrouvent par leur nom, comme ailleurs (§ 4.1), et un
en-tête absent arrête l'import (E1) : Nom, Type, Localisation, Nombre
d'actions, Souffle, Attaque, Défense, Equipement, Capacités. Une autre
colonne (des notes) se garde dans `brut`, sans être lue.

**Une ligne par type ou par adversaire.** Une ligne qui porte « Type » dans
la colonne Nom (sans casse ni accents) définit un **type**, dont le nom est
dans la colonne Type ; un type n'hérite de rien. **Toute autre ligne est un
adversaire**, et sa colonne Type cite les types dont il hérite.

**Les cellules** se gardent dans la banque telles qu'écrites, espaces de
bord retirés (§ 5.1) ; rien n'y est lu à l'import. C'est la résolution
(§ 16.2) qui les lit, avec `js/adversaire/notation.js` :

| Cellule | Forme | Exemple | Lecture |
|---|---|---|---|
| toute | vide | | **hérite** : la valeur vient des types |
| toute | `aucune`, `aucun`, seul dans la cellule | `aucun` | rien pour une liste, 0 pour un nombre |
| Type | types séparés par `/`, multiplicateur entre crochets après le dernier | `Humain/Brigand[2]`, `Humain[1,4]` | les types, dans l'ordre, et le multiplicateur |
| Localisation | `Nom(face)`, séparés par des virgules, sur une ou plusieurs lignes | `Torse(2), Jambe gauche(12)` | la **première face** de chaque zone |
| Nombre d'actions, Souffle, Attaque, Défense | un nombre, à virgule décimale | `1,5` | une fraction exacte |
| Equipement | noms de blocs ou de packs, qualité entre crochets | `Spatule souple, Armure agile[3]` | les objets ; qualité 2 sans crochets |
| Capacités | noms de capacités, rang entre crochets | `Déplacement[2]` | les capacités ; rang 1, ou 0 pour celle qui n'évolue pas |
| Equipement, Capacités | `//` en tête | `//, Parade` | reprend la liste héritée, et lui ajoute ce qui suit |

Une liste ne se découpe pas sur une virgule entre crochets (`Dague[2,5]`).
Sans « // », une liste **remplace** la liste héritée. Ce qui ne se lit pas
est signalé, jamais avalé : E9 pour la colonne Type, E10 pour la
localisation, E14 pour un nombre, E6 pour une liste (crochet jamais fermé,
« // » ailleurs qu'en tête).

### 16.2 L'héritage et la résolution

**Un seul module** résout un adversaire, `js/adversaire/resolution.js` :
l'import s'en sert pour le contrôle (`js/adversaire/controle.js`, § 6.3), la
page pour l'affichage. La banque garde les lignes brutes, comme pour les
blocs, et la page résout à l'affichage : ce que le rapport annonce est ce
que l'écran montre. La résolution est une fonction pure, ne lève pas
d'exception sur une donnée inattendue, et rend ses **constats**, chacun avec
son code (§ 6.3) et la ligne de la feuille où il se corrige.

1. **Les types**, dans l'ordre de la colonne Type : pour chaque cellule non
   vide, le suivant l'emporte sur le précédent. Une liste écrite avec « // »
   s'ajoute à ce qui précède ; sans, elle le remplace. La colonne peut être
   vide : l'adversaire n'hérite alors de rien.
2. **Le multiplicateur**, global, permis après le dernier type seulement
   (`Humain/Brigand[2]`, `Humain[1,4]`), strictement positif. **Il multiplie
   tout ce qui est hérité des types** : le nombre d'actions, le souffle,
   l'attaque, la défense, et la **qualité de l'équipement hérité**, la
   qualité 2 par défaut comprise (une arme héritée sous `[2]` est de qualité
   4). **Il ne touche pas** les faces du d20, le rang des capacités, les
   valeurs propres des blocs, ni ce que l'adversaire écrit dans sa ligne.
3. **La ligne de l'adversaire**, ensuite, sans multiplicateur.
4. **L'arrondi.** Les calculs sont exacts, en fractions
   (`js/personnage/expressions.js`), et **arrondis à l'entier inférieur une
   seule fois, à la fin** (livret, « Valeurs décimales »), pour les actions,
   le souffle, l'attaque, la défense, les dégâts et l'armure : deux pièces
   d'armure de 26,67 et 6,67 font 33, et non 32. Une qualité qui n'est pas
   entière s'écrit avec deux décimales au plus, à la virgule (« 2,8 »,
   « 2,67 », au plus proche) ; le calcul garde la fraction.

Un type introuvable (E8) ou une colonne Type illisible (E9) rend la suite
incertaine : l'adversaire se résout avec ce qui se lit, l'écran le dit, et
le contrôle ne lui ajoute aucun autre constat (pas d'« incomplet » en
plus). Un produit qui sort des entiers sûrs ne se calcule pas : la valeur
héritée reste, et c'est dit (E14).

### 16.3 Les valeurs

**Localisation.** `Torse(2), Jambe gauche(12), …` donne la première face de
chaque zone. Les zones se rangent par leur première face, et chacune couvre
jusqu'à la face avant la suivante ; la dernière va jusqu'à 20. **La face 1
est la contre-attaque**, posée d'office : elle se lit sur le jet de
localisation (livret, « Contre-attaque » ; « Jets de localisation » dit
« sur un jet d'attaque », § 12).
Le nombre de zones est libre, et chaque adversaire a sa grille. Une grille
fautive (E10 : face hors de 2 à 20, deux zones sur une face, aucune zone
sur la face 2) n'est pas rendue.

**Les six zones des personnages** (torse, jambe gauche, jambe droite, bras
gauche, bras droit, tête) se reconnaissent par leur nom, sans casse,
accents ni espaces superflus. Un nom proche d'une seule d'entre elles, à
**deux lettres d'écart au plus** (ajoutées, retirées ou remplacées), est
reconnu avec un avertissement (A11) : « Jambre droite », dans le classeur
réel, se lit « jambe droite ». La zone garde son nom tel qu'écrit ; la
reconnaissance ne sert qu'à poser les armures à six valeurs. Limite connue :
un nom court et voisin (« Tige », à deux lettres de « tête ») est reconnu
aussi ; l'avertissement le dit, et l'auteur renomme la zone s'il le faut.

**Résistance et corps** : 5 par zone, et 10 (livret, « Ressources »). Ce
sont des valeurs fixes, qui ne se saisissent pas.

**Attaque et défense** : des nombres, les difficultés des jets du joueur
(livret, « Asymétrie des rôles lors des combats »). **Souffle** : un nombre,
la réserve qui paie les capacités de l'adversaire. **Nombre d'actions** : un
nombre (livret, « Actions de jeu »). Un nombre que rien ne donne reste
vide, sur la carte comme à l'écran ; seuls la localisation, l'attaque et la
défense sont exigées (E15).

### 16.4 L'équipement et les capacités

**L'équipement** liste des blocs, de n'importe quel type, chacun avec sa
qualité entre crochets. Sans crochets : la qualité que le classeur fixe au
bloc (un nombre au lieu de X dans son paramètre `qualite`), sinon **2**
(facteur 1). La qualité vaut pour tout objet d'un adversaire, que son bloc
transmette ou non un paramètre `qualite`.

- **Les packs.** « Armure lourde », « Armure agile » et « Armure précise »
  (sans casse ni accents) désignent toutes les pièces de **type Armure** qui
  portent l'élément, dans l'ordre de la feuille Blocs, à la qualité du
  pack. Un bloc du même nom l'emporterait sur le pack. Une armure naturelle
  n'entre dans aucun pack.
- **Plusieurs armes sont permises.** Chacune a ses dégâts :
  `{degats} × (1/3 + qualité/3)`.
- **L'armure** se calcule zone par zone, qualité comprise, à partir du
  paramètre `armure` de chaque objet porté :
  - une pièce à **six valeurs** les pose sur les zones nommées comme celles
    des personnages, où qu'elles soient sur le d20 ; une valeur nulle ne
    couvre rien ;
  - une pièce à **une seule valeur** est **globale** : elle couvre toutes
    les zones, et les autres pièces s'y ajoutent (une carapace de 30, plus
    un casque de 10 : la tête a 40) ; deux pièces globales s'additionnent ;
  - une pièce qui a **autant de valeurs que de zones** les pose dans
    l'ordre du d20 ;
  - sur une zone, **la dernière pièce non globale l'emporte** (et non la
    plus élevée, comme pour un personnage) ;
  - un autre nombre de valeurs est une erreur (E12) ; une pièce à six
    valeurs dont une valeur non nulle vise une zone que l'adversaire n'a
    pas (un oiseau sans bras) ne la pose nulle part, ou, s'il a justement
    six zones, pose ses six valeurs dans l'ordre du d20, avec un
    avertissement dans les deux cas (A12).
- **Les types de bloc « Arme naturelle » et « Armure naturelle »** sont
  reconnus (§ 4.1) : les griffes et les carapaces. Ils se comportent comme
  Arme et Armure, et **le créateur de personnage les ignore**.
- **Un bouclier** (un objet qui transmet `defense`, § 15.2) donne ses
  capacités. Sa défense ne change pas le nombre Défense.

**Les capacités** sont des noms de la feuille Capacites, avec leur rang
entre crochets : 1 par défaut, 0 pour une capacité qui n'évolue pas ; un
rang au-delà du maximum y est ramené (A13), un rang donné à une capacité
qui n'évolue pas est ignoré (A14).

- **Les capacités de l'équipement sont héritées**, dans l'ordre des objets
  puis de chaque bloc ; celles que citent les types et la ligne viennent
  ensuite. Seules les capacités simples d'un bloc sont données : un groupe
  au choix ne l'est pas, rien n'étant choisi.
- **Une même capacité héritée au rang X et propre au rang Y** : seul le
  rang Y compte (le dernier écrit). Une capacité citée et aussi donnée par
  l'équipement ne figure qu'une fois.
- **Les maîtrises** sont les capacités qui portent l'élément « Maîtrise »
  (convention du § 15.2), ou, à défaut, les trois « Maîtrise du combat
  lourd, agile, précis ». Chacune s'associe à l'élément Lourde, Agile ou
  Précise dont son nom porte le mot (« lourd », « agile », « précis »).
- **Le désavantage** (éléments Lourde, Agile, Précise du classeur). Une
  capacité issue d'un bloc qui porte l'un d'eux est marquée
  « désavantage », sauf si l'adversaire a la maîtrise correspondante à un
  rang supérieur ou égal à la **position de la capacité dans la liste du
  bloc** (première, deuxième…). Avec une maîtrise de l'agile au rang 1,
  seule la première capacité d'une arme agile y échappe ; au rang 3, les
  trois. Une capacité que deux armes donnent peut n'avoir le désavantage
  qu'avec l'une : la carte dit laquelle.
- **Le coût** (souffle, et lien s'il y en a) s'évalue au rang, comme pour
  le personnage (§ 15.2). Une valeur X reste X.
- **Les descriptions** s'évaluent comme pour le personnage (§ 15.2), par le
  même code : `[N]`, les expressions, et `{degats}` ou `{portee}` de l'arme
  dont vient la capacité, à sa qualité. Un adversaire n'a pas de
  caractéristiques : une expression qui en invoque une reste telle
  qu'écrite, et l'écran le dit.
- **Une capacité d'arme sans arme** : sa description invoque `{degats}`, et
  rien de ce que porte l'adversaire ne les lui donne (A15).

**Depuis le lot 4, pour le simulateur de combat** (§ 17), le même module
rend davantage, par ajouts seulement : ce qu'il rendait au lot 3 est rendu
à l'identique (mesuré sur 85 adversaires, la démonstration, les cas fautifs
et des variantes), et le rapport d'anomalies ne gagne aucun constat.

- **La règle de position des maîtrises est partagée** par trois fonctions
  de `resolution.js`, que la résolution emploie et que la photographie d'un
  personnage emploie aussi (§ 17.6) : le rang de maîtrise de chaque poids,
  le plus haut de ceux qu'on possède (`rangsDeMaitrise`) ; la position
  d'une capacité dans son bloc, toute entrée comptant dans l'indice, un
  groupe au choix ou une entrée illisible compris (`positionDans`) ; et le
  verdict : un bloc qui porte un poids dont la maîtrise n'atteint pas la
  position gêne la capacité (`horsMaitrise`). Un bloc à deux poids demande
  les deux maîtrises ; une maîtrise de rang 0 ne lève rien.
- **Les armes de l'adversaire** (`armes`) : une par objet porté dont le
  bloc est de type Arme ou Arme naturelle, dans l'ordre de l'équipement, la
  même arme deux fois comprise ; pour chacune son poids, ses dégâts en
  nombres, sa portée et son nombre de dés de localisation, lus dans ce que
  le bloc transmet sans cible, à sa qualité. Le bouclier n'en est pas une.
- **Pour chaque capacité** : les noms de ses éléments au rang, ceux de sa
  variante puis ceux que lui transmet, en la visant, chaque bloc qui la
  donne ; ce qu'elle reçoit de chaque objet qui lui donne des dégâts, en
  nombres, parallèle à ce que la carte en écrit (dégâts, portée, dés de
  localisation, désavantage, et laquelle des armes) ; et ce qu'elle porte
  en propre, sans objet. Une portée absente, non calculée ou négative y
  vaut 0 ; un nombre de dés de localisation absent ou inférieur à 1, 1
  (§ 12).

### 16.5 La carte

**Elle suit la maquette** du lot (`plans/maquette_adversaires.html` et son
rendu, hors dépôt ; le modèle d'origine est une carte Claude Design de
l'auteur), dans `js/adversaire/carte.js` et `css/adversaire.css` : ses
dimensions, ses traits, ses cases et ses espacements ; sa police, **EB
Garamond, hébergée dans `polices/`** avec sa licence OFL (§ 10.2) ; son
papier `#fffdf8`, ses traits `#3a3126`, son accent `#6d4a1f`, dans
`jetons.css` (`--carte-…`), les mêmes dans le thème sombre : la carte est du
papier. Elle affiche l'adversaire résolu sans rien recalculer, et ne dit
pas d'où vient une valeur : la provenance est l'affaire de l'écran (§ 16.6).

- **En-tête** : « Adversaire », le nom, et le numéro d'exemplaire dans une
  rencontre (« n° 2 »).
- **Bande du d20**, de 1 à 20. Une case « Contre-attaque », verticale,
  occupe la face 1 sur les trois rangées. **Armure** : chaque zone avec sa
  valeur. **Résistance** : chaque zone avec 5. **Corps** : dix cases, et 10.
  Une zone de deux faces au plus s'abrège en initiales (« J. g. ») si son
  nom a plusieurs mots, un nombre restant entier (« Patte 12 » : « P. 12 ») ;
  une zone d'une seule face s'écrit plus petit. Limite connue, celle de la
  maquette : un nom plus large que sa case est rogné (au-delà de sept à
  huit lettres pour un mot seul sur une face, d'une vingtaine de signes sur
  trois faces) ; les valeurs, elles, restent entières (§ 12).
- **Capacités, au moins quatre lignes, et autant qu'il en faut.** Une
  première ligne donne les types (avec « ×2 » ou « ×1,4 » s'il y a un
  multiplicateur), puis les maîtrises avec leur rang, puis l'équipement
  avec sa qualité (« Armure agile [4] (6 pièces) ») ; un segment sans rien
  s'omet. Les maîtrises ne figurent pas dans les lignes suivantes. Ensuite,
  une ligne par capacité : le nom ; le rang entre crochets, pour une
  capacité qui évolue ; les dégâts entre parenthèses pour une capacité
  d'arme, avec la portée si elle dépasse 0, et le nom de l'arme devant
  chaque valeur si plusieurs armes la donnent ; le coût (« 5 souffle »,
  « 1 souffle · 1 lien » ; rien quand elle ne coûte rien) ; la mention
  « désavantage », suivie du nom des blocs quand elle ne vaut que pour
  certains ; la description en italique. Des lignes vides complètent
  jusqu'à quatre.
- **Colonne de droite** : « Nombre d'actions : X » ; « Souffle : X » (il n'y
  a pas de case « Dégâts ») ; les carrés Attaque et Défense. Une valeur que
  rien ne donne laisse sa place vide.
- **La hauteur est variable.** Il n'y a pas de rappel en bas de carte.

**Aucun style n'est posé par le code** (§ 10.1) : une zone se place sur la
grille de vingt et une colonnes (l'étiquette, puis les vingt faces) par deux
classes d'un ensemble fini, sa première face (`debut-2` à `debut-20`) et son
étendue (`etendue-1` à `etendue-19`), écrites dans le CSS. Chaque règle
commence par `.carte-adversaire`, la carte, ou `.cartes-adversaires`, le
conteneur des cartes : aucune de ses classes n'existe ailleurs, et la carte
remet à zéro ce que l'interface lui transmettrait.

**L'impression.** Une page nommée, A4, aux marges de la maquette (11 mm en
haut et en bas, 10 mm sur les côtés) ; les cartes larges de 190 mm, l'une
sous l'autre à 4 mm ; **une carte n'est jamais coupée d'une page à l'autre**
(`break-inside: avoid`) ; les couleurs se gardent ; l'échelle de l'écran
est remise à 1 ; le papier des cartes remplace, sur la page qui en porte, le
fond de la fiche de personnage.

- **La page nommée se pose trois fois** : sur le conteneur des cartes, sur
  la racine et le corps de la page, et sur chaque carte. Sans les deux
  dernières, Firefox donnait la page par défaut, sans marge, à la première
  page, puis aux pages après la deuxième : les cartes sortaient collées au
  coin de la feuille (relecture du lot 3, § 16.8).
- **Le fond de la page** est le papier de la carte. Chrome le peint jusqu'au
  bord de la feuille, comme la maquette. Firefox ne peint pas le fond d'une
  page : ses marges restent blanches, et le bas de la dernière page aussi,
  sous la dernière carte, tant que « Imprimer les arrière-plans » n'est pas
  coché. Le papier se voit toujours dans les cartes et entre elles.
- **Les en-têtes et pieds de page du navigateur** (la date, le titre,
  l'adresse, le numéro de page) s'impriment dans les marges tant que leur
  case est cochée dans la fenêtre d'impression : elle se décoche. Le verso
  de la fiche de personnage est dans le même cas.

### 16.6 Les écrans

**Deux catégories de plus dans la consultation** (§ 9) : « Adversaires »
(`#/adversaires`, `#/adversaire/<nom>`) et « Types » (`#/types`,
`#/type/<nom>`), chacune avec sa liste, sa recherche instantanée et ses
fiches, dans les onglets des listes. La catégorie « types » lit la liste
`types_adversaires` de la banque : le nom d'une catégorie n'est plus
forcément celui de sa liste (`js/banque/consultation.js`). Un adversaire se
cherche par son nom, par ses types, son équipement et ses capacités tels
qu'il les écrit dans sa ligne, **et par ce qu'il porte une fois résolu** :
ce qu'il hérite de ses types, les capacités que donne son équipement, les
pièces d'un pack (« spatule » trouve ceux qui la tiennent de leur type).
Chaque adversaire n'est résolu qu'une fois pour cela, à la première
recherche. Dans la liste, un adversaire montre ses types tels qu'écrits
(« Commis/Rôtisseur[1,4] », ou « sans type »), un type le nombre
d'adversaires qui l'utilisent. L'accueil compte les adversaires et leurs
types. `#/anomalies/Adversaires/3` met en avant les anomalies d'une ligne de
la feuille, et mène à la fiche du type ou de l'adversaire qui l'occupe.

**Une banque publiée avant le lot 3** n'a ni adversaires ni types : rien ne
tombe. L'accueil, les deux listes, une fiche demandée par son adresse et la
rencontre disent « Les adversaires ont besoin d'une banque republiée depuis
le classeur à jour. », et le reste se consulte comme avant. Un classeur sans
feuille Adversaires (I4) donne deux listes vides, sans cette phrase.

**La fiche d'un adversaire** (`js/ecrans/fiche_adversaire.js`). Il s'ouvre
**résolu** (§ 16.2) ; l'index de résolution se fait une fois par banque, à
la première demande, et se garde avec l'index de la consultation.

**Sur un grand écran** (56rem et plus), la carte puis la lecture se montrent
ensemble, sans rien à choisir : chaque valeur dit d'où elle vient dès
l'ouverture, et ce qui est « à vérifier » se lit sous la carte. **Sur un
téléphone, deux vues**, comme pour un personnage (§ 15.5), choisies par deux
boutons : la vue lecture, qui s'ouvre d'abord, et la vue carte ; le choix se
garde sur l'appareil, sous sa propre clé (`atelier.vue-adversaire`). Choisir
la vue carte l'amène à l'écran : elle est sous les boutons, souvent sous le
pli. (Le personnage, lui, s'ouvre en vue fiche sur un grand écran, sans la
lecture : l'écart est voulu, la provenance n'existant qu'à l'écran.)

- **La vue lecture** (`js/adversaire/lecture.js`) : les rubriques empilées,
  dans les styles de l'interface. **Chaque valeur dit d'où elle vient** :
  « de Rôtisseur ×1,4 » (un type, sous le multiplicateur de l'adversaire),
  « de Commis » (un type, pour ce que le multiplicateur ne touche pas : la
  grille, le rang d'une capacité), « de sa ligne », « de Spatule souple »
  (un objet, pour une capacité et ses dégâts). L'armure d'une zone nomme les
  pièces qui la donnent, avec leur qualité (« Carapace épaisse [2] + Toque
  renforcée [3] ») ; le corps et la résistance sont dits « valeur fixe » ;
  un nombre que rien ne donne, « rien ne le donne » ; une cellule illisible,
  « illisible », avec son origine. « de » s'élide devant une voyelle. Une
  capacité dit son rang (ou « n'évolue pas »), son coût (ou « sans coût »),
  les dégâts de chaque arme qui la donne et leur portée, le désavantage et
  le bloc dont il vient (« seulement » quand il ne vaut que pour certains),
  sa description, son origine. Quand plusieurs lignes la citent, **le rang
  dit de laquelle il vient**, la dernière : « rang 2, de sa ligne ». **Une
  liste que rien ne remplit dit qui la vide** : « Aucun objet », suivi de
  « de sa ligne, qui n'en garde aucun », quand sa ligne écrit « aucun » là
  où son type donnait un équipement ; « Aucun objet. » seul quand personne
  n'en donne. La résolution rend pour cela, pour chaque liste, d'où vient
  la dernière cellule écrite sans « // » (`listes`).
- Les types, les objets, les pièces d'un pack et les capacités sont des
  liens vers leurs fiches. Un type, un objet ou une capacité introuvable
  s'affiche barré, avec un lien vers l'anomalie de la ligne qui le cite :
  celle de l'adversaire, celle du type dont il l'hérite, ou, dans la feuille
  Blocs, celle du bloc qui donne une capacité absente.
- **« À vérifier »** : les constats de la résolution, ceux de sa ligne et
  ceux de ses types, chacun avec son code et sa gravité en toutes lettres
  quand il en a un, suivis d'un lien vers les anomalies de leur ligne quand
  le rapport publié en porte. Un adversaire incomplet ou en erreur le dit en
  tête, dans les deux vues, et s'affiche tel qu'il se résout.
- **La vue carte** : la carte (§ 16.5) à l'échelle de l'écran (`zoom`,
  l'échelle posée par `js/ecrans/echelle.js`, § 10.1 : le plus petit de 1 et
  de la largeur disponible divisée par celle de la carte), que le zoom à
  deux doigts agrandit. L'écran place toujours les cartes dans leur
  conteneur, même pour une seule. Sur un téléphone, en vue lecture, la
  carte reste dans la page, invisible et sans hauteur, à l'écran seulement :
  « Imprimer / PDF » sort la seule carte, sans numéro, quelle que soit la
  vue, après avoir chargé les trois faces de sa police.
- « Ajouter à la rencontre » ajoute un exemplaire, et dit combien la
  rencontre en porte déjà ; un lien mène à la rencontre, un autre aux types.
  Au plafond, le bouton devient inactif et le focus passe au lien de la
  rencontre.
- Deux adversaires de même nom (E16) s'affichent l'un sous l'autre, chacun
  résolu pour lui-même, avec la phrase du doublon ; une rencontre prend le
  premier. « De même nom » s'entend comme au contrôle, signes invisibles
  retirés (§ 6.3, lot 4) : celui qui porte le nom de l'adresse vient
  d'abord. Un nom introuvable donne « Fiche introuvable » et le nom approché
  (§ 9).

**La fiche d'un type** (`js/ecrans/fiche_type.js`) : sa ligne telle que la
résolution la lit, cellule par cellule — la localisation et ses zones, les
quatre nombres, l'équipement avec sa qualité (« qualité par défaut » quand
elle n'est pas écrite) et les pièces d'un pack, les capacités avec leur rang
(« rang par défaut » sinon). Une cellule vide est dite « hérite » ; « aucun »
se dit ; « // » se dit en clair : « Reprend la liste héritée, et ajoute : ».
Rien n'y est multiplié ni arrondi. Une cellule que la notation ne lit pas
s'affiche telle qu'écrite, avec son anomalie. Puis **les adversaires qui
l'utilisent**, en liens, et les anomalies de sa ligne. Deux types de même
nom (E16) s'affichent l'un sous l'autre, avec la phrase du doublon, qui
finit par « Les adversaires héritent du premier. ». Quand seul un signe
invisible les distingue (§ 6.3, lot 4), chacun garde les adversaires qui
écrivent son nom, et celui que porte l'adresse vient d'abord : la phrase
finit alors par « Chaque adversaire hérite du premier dont il écrit le nom
exact. », sous l'un et l'autre nom.

**La rencontre** (`js/ecrans/rencontre.js`, `#/rencontre`). La liste des
adversaires, avec la même recherche ; pour chacun, des boutons + et − :
cibles de 44 px, le nombre entre les deux, « − » inactif à zéro, le focus
gardé sur le bouton actionné, et passé à son voisin quand il devient
inactif. **Douze exemplaires au plus d'un adversaire, soixante cartes au
plus** : trois cartes tiennent sur une page A4, et l'aperçu fabrique chaque
carte dans la page. Sous la liste, une barre qui reste au bas de l'écran
porte le nombre de cartes et « Imprimer / PDF » ; puis la composition, le
mode d'emploi (placé en tête, il poussait les boutons + sous le pli d'un
téléphone), « Vider la rencontre », et **l'aperçu des cartes à l'échelle de
l'écran**.
L'Atelier imprime une carte par exemplaire, **numérotée dès qu'il y en a
plus d'une du même adversaire** (« n° 1 », « n° 2 » ; un seul exemplaire :
pas de numéro), dans l'ordre de la liste, sur des pages A4 (§ 16.5) ; seules
les cartes sortent. Un adversaire incomplet ou en erreur s'imprime tel qu'il
se résout, et l'écran le signale, avec un lien vers sa fiche. **La
composition vit le temps de la visite** : dans la mémoire du module, jamais
enregistrée (ni `localStorage`, ni IndexedDB, ni l'adresse), remise à zéro
quand la banque change. Depuis le lot 4, le simulateur de combat la lit
pour la poser sur sa carte (« Placer la rencontre préparée », § 17.7), par
une fonction qui ne change rien : `rencontrePreparee(banque)` rend les
adversaires et leur nombre, dans l'ordre de la liste, et une liste vide
pour une autre banque que celle de la rencontre, sans la vider. Le contrôle
« rien n'est enregistré » la couvre. Les plafonds du combat sont ceux
d'ici : douze exemplaires, soixante adversaires.

**Le téléphone.** Une colonne. Tant que l'échelle n'est pas posée, c'est le
cadre des cartes qui défile, jamais la page. Un nom fait d'un seul mot plus
large que l'écran se replie dans la rencontre ; une grille au nom de zone
démesuré fait défiler sa seule rubrique ; les faces d'une zone (« 12-13 »)
tiennent sur une ligne. Le lien d'un type, seul dans sa ligne, se touche sur
ses 44 px ; les liens pris dans une phrase (les pièces d'un pack, les
adversaires d'un type) gardent la hauteur du texte, comme sur les fiches du
lot 1 (§ 12).

**Une banque forgée ou abîmée** ne fait rien lever, et ne montre rien de
technique : une cellule ou un numéro de ligne qui n'est pas un texte vaut
une cellule vide, dans la liste, la rencontre, la recherche et la fiche.

### 16.7 La démonstration

Le classeur d'essai a une feuille `Adversaires` fictive, dans l'esprit de sa
batterie de cuisine (§ 10.3), et la banque de démonstration en est tirée.
Elle couvre chaque règle :

| Ligne | Ce qu'elle montre |
|---|---|
| type **Commis** | une grille de six zones, dont « Jambre droite », mal orthographiée (A11) ; quatre nombres ; une capacité |
| type **Rôtisseur** | une arme, **un pack d'armure** (« Armure agile » : trois pièces), et « // » qui ajoute une maîtrise à la liste héritée (citée à l'accent près : A1) |
| **Marmiton de corvée** | **deux types**, rien en propre : 1 action, 5 de souffle, 4 d'attaque, 5 de défense ; désavantage sur la seconde capacité de sa spatule |
| **Chef de partie** | un **multiplicateur décimal**, `[1,4]` : 1, 7, 5, 7 ; qualité 2,8 ; dégâts 6/12/19 ; armure 38, 19, 6 ; **deux rangs qui en remplacent d'autres** (maîtrise au rang 3, déplacement au rang 2), aucun désavantage |
| **Plongeur** | **« aucun »** : ni souffle (0), ni équipement |
| **Homard furieux** | sans type, sa propre grille de quatre zones ; **une armure naturelle globale plus une pièce** (30 partout, 36 à la tête) ; **deux armes**, dont une naturelle : une capacité donnée par les deux, avec le désavantage par l'une seulement |
| **Mouette chapardeuse** | un souffle que rien ne donne ; une capacité d'arme sans arme (A15) |

Deux blocs s'ajoutent à la feuille `Blocs` : « Pinces de homard », une arme
naturelle, et « Carapace épaisse », une armure naturelle à une seule valeur.
Les codes d'erreur de la feuille ne sont pas dans la démonstration, qui
doit se lire : ils se déclenchent sur des variantes
(`tests/outils/adversaires_essai.js`, § 11). La démonstration ne porte que
trois avertissements de la feuille : A11, A1 et A15.

**Les ajouts du lot 4** au classeur d'essai (§ 10.3) touchent ce que
portent des adversaires : Passif sur « Nez fin », que cite la Mouette
chapardeuse, et sur la maîtrise que citent le type Rôtisseur et le Chef de
partie. **Aucune valeur
d'un adversaire n'en change**, et la feuille garde ses trois
avertissements. Un contrôle le vérifie : il refabrique le classeur d'avant
ces ajouts (`sansAjoutsDuCombat()`, dans `tests/outils/adversaires_essai.js`),
résout les cinq adversaires sur les deux par le même code, et compare tout
ce que rend la résolution. Ce classeur d'avant, refabriqué, est octet pour
octet le fichier du lot 3 (mesuré le 12/10/2026, hors des contrôles).

### 16.8 Les mesures

**Le banc sur le classeur réel** (§ 6.3), lancé hors dépôt le 11/10/2026 sur
le classeur de l'auteur : la feuille Adversaires compte cinq lignes, deux
types et trois adversaires. **Les mesures de référence de l'instruction du
lot sont retrouvées exactement**, pour les deux adversaires qu'elle mesure :
les quatre nombres, les dégâts de l'arme aux trois rangs, l'armure des six
zones, les capacités jouées avec un désavantage, et, pour celui qui porte un
multiplicateur, aucun désavantage, sa maîtrise au rang 3 et son déplacement
au rang 2. Ces valeurs sont des données de jeu de l'auteur : elles restent
dans l'instruction, hors dépôt, et le banc les affiche sans que rien n'en
soit gardé. La feuille donne quatre anomalies, toutes des avertissements :
A11 (la zone mal orthographiée, ligne 2), A15 (la capacité d'arme sans
arme, ligne 4) — les deux que l'instruction attendait —, et deux A1 (une
maîtrise citée à l'accent près, lignes 3 et 6), que le § 12 explique. Le
classeur entier : 67 blocs, 69 capacités, 19 éléments, 134 anomalies.

**Les contrôles armés puis désarmés** : sur une copie du dépôt hors de
OneDrive, un processus à la fois (`CLAUDE.md`), 109 mutations du cœur
(notation, résolution, contrôle, import, différences, types) et 51 de la
carte et des écrans, toutes vues échouer ; puis 62 mutations des
corrections de la relecture finale : 60 vues échouer d'emblée, une qui a
montré un contrôle manquant (le rang d'une capacité citée une seule fois),
ajouté puis vu échouer, et une, mal visée, remplacée et vue échouer.

**Une cellule démesurée.** Une cellule faite de 32 000 blancs demandait
973 ms à la lecture d'une liste (un motif au coût quadratique) ; les blancs
sont désormais réduits avant tout motif, et la même cellule se lit en moins
d'une milliseconde (§ 11).

**Dans un vrai navigateur**, le 11/10/2026, sur la démonstration servie par
le serveur local, sans fenêtre, les pages rendues en PDF puis mesurées.

- **La fidélité à la maquette** (Chrome 154) : les trois cartes de la
  maquette, refaites par le code dans la vraie page, comparées à
  `plans/maquette_adversaires.html` dans le même navigateur : 7 707 mesures
  (position, taille, police, graisse, couleur, bordures), aucun écart
  au-delà de 0,03 px ; les trois faces d'EB Garamond réellement dessinées,
  depuis `polices/` seulement.
- **L'impression dans Chrome** : seules les cartes sortent, larges de
  190 mm ; trois cartes sur une page, neuf sur trois, aucune coupée ; le
  premier cadre à 11,2 mm du haut et 10,2 mm de la gauche sur chaque page ;
  la feuille entière au papier de la carte, marges comprises.
- **L'impression dans Firefox** (143, et 157, la version de l'auteur).
  Avant la correction, **le site perdait les marges** sur la première page
  et sur d'autres : cadres à 0,0 mm, quatre cartes sur la première page.
  Une page d'essai statique, la seule mesurée avant la relecture, ne
  montrait pas le défaut : c'est la relecture de la maquette qui l'a vu,
  sur le site. Après la correction (§ 16.5), sur le site : premier cadre à
  10,9 mm du haut et 9,9 mm de la gauche sur toutes les pages, pour trois
  cartes (une page), neuf cartes (trois pages) et la fiche d'un adversaire ;
  marges blanches, papier entre les cartes.
- **Le grand écran** (1 280 px) : la carte, à l'échelle 1, puis la lecture ;
  toutes les provenances visibles à l'ouverture, « À vérifier » compris.
- **Le téléphone** (Chrome, de 320 à 414 px, et 375 × 667 après
  corrections) : aucun écran du lot ne déborde ; la vue lecture d'abord ;
  « Vue carte » amène la carte entière à l'écran ; les faces des zones sur
  une ligne ; dans la rencontre, trois boutons + sur cinq visibles sans
  défiler, contre aucun avant ; un nom d'un seul mot de 3 000 lettres ne
  fait plus défiler la page.
- **La charge** (banque fabriquée de 2 000 adversaires). Dans Chrome, avant
  les corrections : la liste en 61 ms, soixante cartes en 0,9 s ; rien ne
  gèle durablement. La recherche par ce qu'un adversaire porte une fois
  résolu, mesurée hors navigateur après les corrections : la première
  frappe, qui résout les 2 000 adversaires, 174 ms ; les suivantes, 7 ms.

**Ce qui reste à mesurer par l'auteur** : l'impression depuis Firefox avec
sa fenêtre et son imprimante, d'une rencontre réelle, comparée à la
maquette (en décochant les en-têtes et pieds de page) ; les écrans sur son
téléphone : le toucher et le zoom n'ont été qu'émulés, ni Safari ni Firefox
pour Android n'ont été essayés.

---

## 17. Le simulateur de combat (lot 4)

Ce paragraphe suit le § 16 pour ne rien renuméroter. Le lot 4 (mission du
12/10/2026, validée par l'auteur avec la maquette du 11/10/2026,
`plans/instruction_lot4.md`) se fait **en deux groupes**, séparés par un
arrêt d'essais (§ 13). **Ce paragraphe décrit le groupe 1, le combat
jouable** ; le § 17.12 dit ce que le groupe 2 ajoutera.

**Ce qu'il est.** Un écran, `#/combat`, où l'on pose sur une carte de
10 × 10 cases des personnages du site et des adversaires de la banque, puis
où l'on joue leur combat : qui agit, quelle capacité, contre qui, les dés,
la localisation, les dégâts, tour après tour. Le combat est gardé sur
l'appareil, chiffré, et survit à un rechargement ; son journal se copie et
se télécharge.

- **Il est assisté.** Les règles générales du combat s'appliquent seules :
  les tours et les actions, la chaîne des dés, l'avantage et le
  désavantage, la portée, la localisation, l'armure, la résistance et le
  corps, la mort. **L'effet propre d'une capacité**, que le classeur écrit
  en texte libre, **s'applique à la main** : sa description s'affiche
  toujours, et le groupe 1 donne pour cela des réglages simples (un
  modificateur, des avantages, des dégâts fixés, une face décalée), que le
  groupe 2 complétera d'une palette. Sont câblés, c'est-à-dire joués sans
  qu'on dise comment : le bloc de base, les attaques, les maîtrises et huit
  passifs (§ 17.6).
- **Il se joue à la main.** Aucune intelligence artificielle :
  l'utilisateur joue tous les protagonistes, adversaires compris, et lance
  chaque dé d'un clic sur le dé.

**Ce qu'il n'est pas** (mission, § 18) : il ne joue pas les adversaires ; il
ne lit pas les effets des capacités ; il ne partage pas un combat entre
deux appareils et n'ajoute pas de renforts après le lancement ; il ne
connaît ni les effets de terrain d'une case, ni les charges des
consommables, ni les points d'historique, ni la recharge du souffle et du
lien ; il ne s'imprime pas ; il n'écrit rien dans le livret ni dans le
classeur. Le désavantage des maîtrises reste absent de la fiche de
personnage (§ 15) : il n'est calculé qu'ici.

**Préséance.** Le livret fait foi, puis le classeur, puis la mission. Là
où le livret se tait ou diffère, le simulateur applique **des conventions
provisoires**, toutes inscrites au § 12 (« Pour le lot 4 — simulateur de
combat »), « à écrire dans le livret » : elles priment jusqu'à sa
réécriture. **Pour toute autre règle absente, rien n'est inventé** : le
simulateur laisse la main au joueur, par une saisie ou un choix. Les règles
d'interface (choisir qui joue, revenir avant le premier dé, poser les
jetons, nommer court) ne sont pas des règles du jeu : elles sont ici, et
non au § 12. Chaque règle de ce paragraphe cite la section du livret, le
point du § 12 ou la décision qui la fonde.

**Aucun nom du vrai classeur** n'entre dans le dépôt avec ce lot (interdit
2) : ni bloc, ni capacité, ni type, ni adversaire, dans le code, les
contrôles, ce document ou les messages de commit. Les exemples viennent de
la démonstration (§ 15.7, § 16.7) : Aubépine Crèmebrûlée, le Chef de
partie, le Marmiton de corvée. Les noms d'éléments et de paramètres du
classeur (Intervention, Passif, Dégâts, Portée, Localisation multiple,
Centré, `loc_multiple`) s'écrivent en clair, comme depuis le lot 1. La
règle a été enfreinte une fois : un nom de capacité est entré au commit
`fda3a2a`, par un exemple de la mission, et en a été retiré au commit
suivant ; il reste dans l'historique (§ 17.11).

### 17.1 Les modules

**Un combat est une mise en place, puis une suite d'événements, et rien
d'autre.** La mise en place dit qui est là, sur quelle case, et quel camp
commence. Un événement est un choix du joueur ou un dé lancé, qui porte ses
valeurs. Tout le reste — ce que vaut chacun, le geste en cours, le journal,
ce qui est permis — se recalcule. C'est ce qui est gardé (§ 17.8), et c'est
ce qui fait qu'un rechargement, un contrôle et le banc passent par le même
chemin que l'écran.

**Le noyau** (`js/combat/`) n'a ni page, ni banque, ni hasard, ni heure. Il
n'importe que lui-même, `js/banque/noms.js` (la clé d'un nom) et
`js/personnage/regles.js` (les neuf caractéristiques, le dé d'un jet), sans
cycle ; un contrôle tient ce graphe (§ 11).

| Module | Ce qu'il fait |
|---|---|
| `regles.js` | les constantes du combat, chacune avec sa source en commentaire : la carte, les plafonds, les deux actions d'un personnage, les trois réussites, la grille des personnages, les faces de contre-attaque, les libellés des difficultés du livret, les noms des éléments lus, les quinze rôles (les quatorze du tableau du § 17.6, et celui de l'attaque à mains nues, qui ne tient pas à un nom), les signes du journal, les bornes d'un combat (ses événements, ses identifiants, les tirages d'un dé), d'une saisie et d'une photographie ; la version des règles du rejeu |
| `forme.js` | la forme de ce qui se garde : un événement, une photographie, un contenu entier ; chaque champ attendu, typé et borné, un champ inconnu refusé ; rien de ce qui se relit n'est cru |
| `plateau.js` | les cases (« D4 »), la distance entre deux cases, les cases à portée, la case où un ajout se pose d'office. Dans le code, la carte du combat s'appelle « le plateau » : « carte » y désigne déjà la carte d'adversaire (§ 16.5) |
| `noms.js` | le nom entier, le nom court, le jeton et les initiales de chaque protagoniste, calculés pour la liste entière (§ 17.2) |
| `preparation.js` | la mise en place d'avant le lancement : ajouter, retirer, poser, régler qui commence ; les plafonds ; la fabrique des identifiants |
| `jet.js` | la chaîne d'un jet : les réussites, l'avantage, le désavantage, le dé explosif ; il ne tire aucun dé, et ne garde aucun total (§ 17.4) |
| `valeurs.js` | toute lecture d'un protagoniste et du geste en cours : ce qui bouge se lit dans l'état, ce qui ne bouge pas dans la photographie |
| `circonstances.js` | de quoi ouvrir un jet : qui lance, quel dé, contre quoi, les modificateurs, les avantages et les désavantages, chacun avec sa source, dans un ordre écrit ; les passifs câblés d'une fiche |
| `degats.js` | la lettre que valent des réussites, la zone que touche un d20, ce que perdent l'armure, la résistance et le corps, « dégrossir », l'esquive, la blessure, la mort (§ 17.5) |
| `offre.js` | **la seule porte** : ce qui est permis à cet instant, et pourquoi le reste ne l'est pas |
| `moteur.js` | le réducteur : d'un état et d'un événement, l'état suivant ; le rejeu d'un combat gardé |
| `journal.js` | chaque ligne du journal, son en-tête, le nom du fichier, et ce que la région d'annonce dit après chaque dé (§ 17.9) |
| `lecture.js` | les cinq vues que l'écran affiche : la barre, la carte, une fiche, le panneau d'action, la préparation |

**Quatre règles tiennent le noyau** (ce que les contrôles en tiennent :
§ 11, § 17.11) :

- **`appliquer(etat, evenement)` est pure.** Elle ne lit ni l'heure, ni le
  hasard, ni la banque, ni l'écran, ni la langue de l'appareil. Les dés et
  l'heure du lancement sont dans les événements, les photographies dans la
  mise en place. Elle ne modifie rien de ce qu'elle reçoit : elle rend un
  état neuf, gelé, qui partage avec le précédent tout ce qui n'a pas
  changé : ce qui est déjà gelé n'est pas reparcouru, et un clic ne coûte
  pas le parcours du combat. Le journal suit la même règle depuis la
  relecture de fin de groupe : une ligne naît gelée, la liste neuve est
  gelée en surface, et une ligne de plus ne fait regarder aucune de
  celles qui la précèdent ; reste une recopie de la liste par ajout
  (§ 17.11).
- **Une seule porte : l'offre.** Le moteur refuse tout événement qu'elle
  n'admet pas ; les vues en tirent leurs boutons, leurs bornes et la raison
  de chaque bouton inactif. Un bouton montré actif est donc un événement
  que le moteur accepte : ni `offre.js` ni `lecture.js` n'importent le
  moteur.
- **L'écran n'écrit aucune règle et ne fait aucun calcul.** Chaque élément
  d'une vue qu'on peut actionner porte sa commande (l'événement à émettre),
  chaque bouton inactif sa raison, chaque saisie ses bornes.
- **Un événement refusé rend l'état reçu, l'objet même**, et un refus :
  « forme » (l'événement est mal fait), « hors_moment » (rien de tel ne
  s'offre à cet instant), « hors_bornes » (la valeur n'est pas de celles
  qui s'offrent) ou « interdit » (le bouton existe, il est inactif, et le
  message est sa raison). Le moteur ne lève jamais, quel que soit ce qu'on
  lui donne : un combat gardé est une donnée venue d'ailleurs.

**Le bord** touche ce que le noyau ignore :

| Module | Ce qu'il fait |
|---|---|
| `js/combat/des.js` | la source de dés de l'écran : `crypto.getRandomValues`, un tirage rejeté et refait au-delà du plus grand multiple du nombre de faces, pour qu'aucune face ne sorte plus souvent qu'une autre. Les contrôles et le banc lui substituent des dés imposés (`tests/outils/des_imposes.js`), que rien dans la page, ni adresse ni réglage, ne permet de lui substituer |
| `js/combat/roles.js` | le seul tableau qui lie un rôle câblé à un nom (§ 17.6) |
| `js/combat/photographie.js` | fige à l'ajout tout ce que le combat lira d'un protagoniste, et dit qui ne s'ajoute pas (§ 17.2) |
| `js/personnage/disponibles.js` | les personnages qu'on peut ajouter, lus sans rien écrire sur l'appareil (§ 17.2) |
| `js/combat/enregistrement.js` | le chiffrement du combat, sa base, la file des écritures, la révision (§ 17.8) |
| `js/combat/seance.js` | le lien entre l'écran, le moteur et l'enregistrement : elle tient le combat du moment, passe chaque commande au moteur, donne chaque changement à garder, et rouvre un combat gardé |
| `js/ecrans/combat.js` | l'écran, et **le seul module qui garde le combat en mémoire** d'une visite de l'adresse à l'autre |
| `js/ecrans/combat_plateau.js`, `combat_fiches.js`, `combat_action.js`, `combat_preparation.js` | ses quatre parties, dont aucune n'importe le moteur : chacune montre la vue qu'on lui donne (§ 17.7) |

**Les modules d'avant, par ajouts seulement.** `js/adversaire/resolution.js`
rend les armes d'un adversaire et les éléments de ses capacités, et partage
la règle de position des maîtrises (§ 16.4). `js/personnage/calcul.js` dit,
pour chaque capacité d'une fiche, de quelles sources elle vient (un bloc,
ou un objet et son rang dans l'équipement), les éléments d'une capacité à
une puissance (ceux de sa variante, puis ceux que son bloc lui transmet en
la visant), et les dégâts que dit une description à une puissance.
`js/adversaire/carte.js` exporte l'écriture des types d'un adversaire
(« Commis, Rôtisseur ×1,4 »). `js/ecrans/rencontre.js` laisse lire la
rencontre préparée (§ 16.6). Ce que rendaient la résolution et la fiche au
commit `40db3a0` est rendu à l'identique, les champs neufs mis à part :
mesuré sur 85 adversaires et 7 fiches.

### 17.2 Les protagonistes et la photographie

**Un personnage** vient des personnages du site.

- **Lesquels** (`js/personnage/disponibles.js`) : ceux de l'appareil qui
  sont enregistrés, jamais un brouillon, et, en mode réel, ceux qui sont en
  ligne (§ 15.8). Un personnage par identifiant ; sa version la plus
  récente (`modifie_le`), et à égalité celle en ligne ; un personnage dont
  l'appareil a demandé la suppression, envoyée ou non, n'apparaît pas. La
  liste est triée par nom ; un personnage sans nom s'y appelle « Sans
  nom ».
- **En lecture seule.** L'écran Personnages rapproche l'appareil et le
  site en rangeant au passage : il efface de l'appareil une copie que le
  site a rattrapée (§ 15.8). Ouvrir la préparation d'un combat ne doit rien
  changer à l'appareil : le module ne lit que la liste de l'étagère, ses
  notes et les personnages en ligne, et n'appelle jamais ce rapprochement.
  La règle est plus simple que celle de l'écran Personnages : une copie
  plus ancienne que la version en ligne, qu'il montre à part, ne se propose
  pas ici. Quand les personnages en ligne ne se lisent pas, la liste montre
  ceux de l'appareil, avec les phrases de l'écran Personnages. En
  démonstration, rien n'est lu en ligne.
- **Ses valeurs** viennent de sa fiche (`calculerFiche`, § 15.2) : le dé
  d'attaque de l'arme tenue, ou les mains nues ; le dé de défense, son type
  et la mention des types mêlés ; l'armure des six zones, la résistance de
  chacune, le corps, le souffle ; **deux actions** (livret, « Actions de
  jeu » : « habituellement ») ; une jauge de lien par primordial lié, de la
  taille de ses points de lien ; ses capacités, avec leur niveau.
- **Ne s'ajoute pas**, et l'écran dit pourquoi : un personnage dont les
  caractéristiques ne sont pas complètes ; un personnage dont l'arme tenue,
  ou la défense, n'a pas de dé. Les mains nues, sans dé par construction,
  n'empêchent rien, « Ce qui manque » non plus. Un personnage ne s'ajoute
  qu'une fois : il se reconnaît à son identifiant, non à son nom.

**Un adversaire** vient de la banque, **résolu** (§ 16.2) : son nombre
d'actions, son souffle, son attaque, sa défense ; ses zones, leurs faces et
leur armure, la résistance de chacune et le corps ; ses armes ; ses
capacités, avec leur rang, leurs dégâts, leur portée, leur désavantage,
leur coût au rang et leurs éléments.

- **Ne s'ajoute pas** : un adversaire que la résolution dit incomplet
  (plus large qu'E15 : une grille invalide, un type cassé, une attaque
  illisible), avec la raison que le site donne déjà ; un adversaire
  **sans nombre d'actions**. Avec zéro action écrit, il s'ajoute et ne joue
  jamais ; sans souffle écrit, il a un souffle de 0, affiché « — » (§ 12,
  point 32).
- **Les exemplaires** d'un même adversaire se numérotent « n° 1 »,
  « n° 2 »…, dans l'ordre d'ajout, dès qu'il y en a deux ; avant le
  lancement, « Retirer » renumérote. Douze exemplaires au plus d'un
  adversaire.
- **Les plafonds du combat** : soixante adversaires et douze personnages,
  ceux de la rencontre (§ 16.6 ; un contrôle les tient égaux). Un ajout qui
  les dépasserait est refusé en entier, avec sa raison.

**Une photographie.** Les valeurs se figent à l'ajout
(`js/combat/photographie.js`) : **republier la banque ou modifier un
personnage ne change pas un combat commencé.** Une photographie porte :

- **les valeurs**, tout ce que lit le noyau, et lui seul : le nom, les
  actions, le souffle, le corps ; les zones dans l'ordre du d20, chacune
  avec ses faces, son armure et sa résistance ; la face de contre-attaque ;
  les caractéristiques et le dé de défense d'un personnage, les deux
  nombres d'un adversaire ; les armes ; le bouclier ; les jauges de lien ;
  les passifs câblés ; les capacités. Le noyau n'y lit ensuite que ce qui
  ne bouge pas : les nombres qui bougent sont recopiés dans l'état à
  l'ouverture du combat ;
- **par capacité** : son nom, tel que la banque le donne ; son rôle câblé,
  reconnu ici et nulle part ailleurs (§ 17.6) ; son niveau (son rang, chez
  un adversaire) ; le groupe sous lequel son bouton se range ; et **ses
  façons**, une par manière de la jouer : pour un personnage, une par
  puissance jouable ; pour un adversaire, une par arme qui la donne, à son
  rang. Chaque façon fige le coût, la description évaluée, les éléments, ce
  qu'ils disent (passive, intervention, attaque), les dégâts, la portée, le
  nombre de dés de localisation et le désavantage de maîtrise ;
- **la source**, telle que lue : le personnage entier ; ou la ligne de
  l'adversaire, celles de ses types et sa résolution. Elle ne sert qu'à
  « Fiche complète » (§ 17.7) : le noyau ne la lit jamais, et un contrôle
  rejoue le combat de référence sans elle ;
- **la date de la banque** (`publiee_le`), pour dire si elle a changé
  depuis l'ajout ; et, pour un personnage, **des avertissements**, montrés
  à la préparation (une portée, un nombre de dés ou des dégâts qui ne se
  lisent pas : § 12, point 25).

Les paramètres d'une capacité (`portee`, `loc_multiple`, `degats`) se
lisent par `contexte()` (§ 15.2 : son bloc, un paramètre qui la vise, un
élément propre), à la puissance jouée, **jamais par le nom d'un élément**.
Une capacité d'un personnage que plusieurs origines donnent n'a qu'un
bouton, sous la première qui la donne valablement (§ 12, points 19 et 31).

**La même fonction juge une photographie quand elle se fabrique et quand
elle se relit** (`validerPhoto`, `js/combat/forme.js`) : ce qui s'est
ajouté à un combat se reprend toujours. Elle borne chaque champ : un nombre
de 0 à 9 999 ; un texte d'une ligne (un nom, un titre, un libellé) de 200
signes au plus, sans caractère de contrôle ; un texte à lignes (une
description, un avertissement) de 4 000 signes au plus ; 200 capacités, 20
façons par capacité, 40 armes, 19 zones, 20 jauges, 40 éléments par
façon ; une grille qui couvre, sans trou ni chevauchement, toutes les faces
du d20 hors celle de la contre-attaque. Ce qui les dépasse est un refus
d'ajout, dit (« Ne s'ajoute pas : la description de … dépasse 4 000
signes. »). À la photographie, un caractère de contrôle dans un texte d'une
ligne devient une espace, puisque ce texte entrera au journal, qui tient
une ligne par geste ; une description garde ses retours à la ligne.

**Trois bornes de plus**, posées le 12/10/2026 par les corrections de la
relecture de fin de groupe (§ 12, à confirmer) : mises bout à bout, les
bornes de chaque liste laissaient passer un contenu forgé qui coûtait
cher à rejouer ou à afficher.

- **600 façons en tout** par protagoniste, toutes capacités confondues
  (deux cents capacités de trois façons, le niveau le plus haut d'un
  personnage), et **20 façons de déplacement** au plus, toutes ses
  capacités de déplacement ensemble. À chaque capacité jouée, l'offre juge
  toutes les façons de celui qui joue, et calcule pour chaque façon de
  déplacement les cases où elle mène : aux seules bornes des listes, une
  photographie forgée coûtait, par événement rejoué, 4,2 ms avec 3 980
  façons que le lien ne paie pas, et de 30 à 35 ms avec 200 capacités de
  déplacement de 20 façons (§ 17.11). Dans la démonstration comme sur le
  vrai classeur, un adversaire a 4 façons au plus, dont 1 de déplacement.
- **La source d'un adversaire** : 200 000 signes de JSON au plus, sur 64
  étages d'imbrication au plus. Elle n'était bornée qu'en profondeur :
  une source forgée de 300 000 capacités (10,39 Mo) était acceptée en
  120 ms, et « Fiche complète » la recalcule en entier. Mesuré sans rien
  garder : les sources des trois adversaires complets du vrai classeur
  font de 2 636 à 6 278 signes, celles des cinq de la démonstration de
  2 669 à 5 529 ; la borne vaut 32 fois la plus grosse. La source d'un
  personnage n'est pas comptée : elle repasse par la fonction qui accepte
  un personnage (`js/personnage/format.js`), qui borne chacun de ses
  champs.
- Leurs refus, à la suite de « Ne s'ajoute pas : » : « la photographie
  compte plus de 600 façons. », « les capacités de déplacement comptent
  plus de 20 façons. », « la source de la photographie dépasse 200 000
  signes. »

**Les noms** (`js/combat/noms.js`) sont des règles d'interface. Un nom est
une donnée hostile : il n'est jamais interprété, seulement découpé.

- **Le nom court** sert au journal et aux jetons de la carte. C'est le
  premier mot du nom : ce qui précède le premier blanc ; ni un tiret ni une
  apostrophe ne coupent. Un exemplaire numéroté y ajoute « n° k » au
  journal (« Marmiton n° 1 ») et « k » sur un jeton (« Marmiton 1 »). Deux
  protagonistes qui ne sont pas des exemplaires du même adversaire, et dont
  les premiers mots ont la même clé (§ 6.3), gardent leur nom entier.
- **Un nom peut finir par un chiffre.** Quand le jeton d'un exemplaire
  serait aussi celui d'un autre protagoniste (un « Commis 1 » à côté de
  deux « Commis »), les exemplaires de cet adversaire gardent tous
  « n° k » sur leur jeton.
- **Les initiales** servent aux pastilles des fiches et aux jetons du
  téléphone : le premier signe du nom qui est une lettre ou un chiffre, en
  majuscule, suivi du numéro d'exemplaire (« M1 ») ; « ? » faute d'un tel
  signe. Deux protagonistes différents se confondent quand ils ont les
  mêmes lettres (la règle de la mission), ou quand leurs initiales
  s'écriraient de même, numéro compris (« A2 » seul, et le second de deux
  « A ») : tant qu'ils se confondent, chacun prend une lettre de plus de
  son nom ; un nom épuisé, ceux qui restent confondus reçoivent une marque
  (prime, seconde…), dans l'ordre d'ajout, posée entre les lettres et le
  numéro. **Deux protagonistes différents n'ont donc jamais les mêmes
  initiales** ; avant la relecture de fin de groupe, la confusion se
  jugeait sur les lettres seules, et un nom fini par un chiffre prenait
  les initiales d'un exemplaire.
- **Le nom entier** figure partout ailleurs : le titre du panneau, les
  boutons « Qui joue ? », les cibles, les fiches, et le titre de chaque
  jeton.
- Les noms se figent au lancement : le journal les a écrits.

Deux personnages de même nom, ou un personnage et un adversaire de même
nom, ont le même nom court et le même jeton : rien ne les distingue au
journal, seules leurs initiales diffèrent. La mission ne prévoit pas ce
cas. Deux autres restent, relevés par la relecture et laissés : un nom
qui s'écrirait lui-même « X n° 1 », à côté de plusieurs « X », se
confondrait avec le premier d'entre eux, jeton, nom court et nom entier ;
et deux protagonistes qui partagent leur premier mot s'allongent ensemble
jusqu'à la première lettre qui les sépare : sur trois cas sondés, leurs
initiales font de 8 à 11 signes, dans les pastilles des fiches et les
jetons du téléphone, qu'aucune mesure n'a vus ainsi. C'est la règle de la
mission appliquée à la lettre ; la démonstration ne le montre pas, aucun
de ses noms n'ayant le premier mot d'un autre. Point à trancher, au
compte rendu.

### 17.3 Le combat : la mise en place, les tours, les actions

**La mise en place** (`js/combat/preparation.js`). Avant le lancement, on
ajoute des personnages et des adversaires, on les pose, on les déplace, on
les retire. Rien de cela n'est un événement ni n'entre au journal ; chaque
changement se garde (§ 17.8).

- **Où se pose un ajout, d'office** : un personnage sur la colonne A, à la
  première ligne libre en partant de 1 ; un adversaire sur la colonne J, de
  même, et les exemplaires d'un même adversaire sur la case du premier
  d'entre eux ; une colonne pleine passe à sa voisine (B, puis C… ; I, puis
  H…). Une case est libre quand personne n'y est ; ensuite, plusieurs
  protagonistes tiennent sur une case.
- **« Qui commence »** : les personnages par défaut (décision de l'auteur),
  ou les adversaires.
- **« Lancer le combat »** demande au moins un personnage et un adversaire.
  Le lancement fige la mise en place et les noms, et porte l'heure locale
  de l'appareil : c'est le seul endroit où une heure entre dans un combat.

**Les événements.** Il y en a quinze, et tout ce qui se joue en est un :

| Événement | Ce qu'il fait |
|---|---|
| `lancer` | lance le combat : la ligne du lancement, puis celle du premier tour |
| `capacite` | ouvre un geste : tel protagoniste joue telle capacité, de telle façon. C'est lui qui dit qui joue : choisir un protagoniste n'est pas un événement |
| `regler` | règle le geste avant qu'il soit payé : la puissance ou l'arme, le jet d'arme prêté et son arme, la cible, la case d'arrivée, les caractéristiques, la difficulté, X, la jauge de lien, le modificateur et les avantages à la main |
| `revenir` | retire le geste : rien n'est dépensé |
| `confirmer` | joue un geste sans jet, ou un déplacement : il paie, et le geste est fini |
| `de` | donne ses valeurs au dé attendu ; le premier dé d'un geste le paie |
| `relancer`, `garder` | devant un dé qui échoue, quand il reste une relance d'avantage |
| `exploser` | devant un dé qui peut exploser |
| `degats` | fixe les dégâts, à la fin du jet ; le dernier compte |
| `decaler` | décale la face d'un dé de localisation |
| `esquive` | le personnage visé paie une action et X points de souffle |
| `appliquer` | applique les dégâts : le geste est fini |
| `passer` | un protagoniste passe son tour |
| `fin_de_tour` | finit le tour du camp qui joue |

**Un geste a des moments** : il se prépare (tout se règle, rien n'est
payé) ; son jet se lance ; l'attaque a touché, ses dégâts se fixent ; ses
dés de localisation se lancent ; viennent les suites (décaler, esquiver),
puis « Appliquer ». Un moment sans choix se passe de lui-même. Un geste
dont rien n'est payé cède la place : jouer autre chose, passer ou finir le
tour l'emportent, sans rien dépenser.

**Les tours** (livret, « Tours de jeu » et « Temporalité »).

- Dans un tour, chaque camp joue à son tour, en commençant par celui que
  désigne le réglage. Le numéro du tour monte quand le camp qui a commencé
  rejoue.
- **Qui agit.** Dans le camp qui joue, l'utilisateur choisit qui agit, dans
  l'ordre qu'il veut : tout vivant qui n'a pas joué. Il peut changer de
  protagoniste entre deux actions (§ 12, point 16).
- **Un protagoniste a joué** quand il n'a plus d'action, ou qu'il a passé
  son tour.
- **La fin du tour d'un camp.** Quand tous ses vivants ont joué, ce tour
  finit de lui-même. « Fin de tour » le finit à tout moment, sauf au milieu
  d'une action payée. Un camp qui commence sans pouvoir agir (des
  adversaires sans action) voit son tour finir dès le lancement. Deux fins
  de tour d'affilée au plus se font d'elles-mêmes : quand aucun des deux
  camps ne peut agir, le combat attend « Fin de tour » (règle d'interface).
- **Les actions retrouvées** (livret, « Actions de jeu »). À la fin du tour
  d'un camp, ses vivants retrouvent toutes leurs actions. Pendant le tour
  adverse, ils peuvent en dépenser en interventions : ce qu'ils y dépensent
  leur manque à leur propre tour, puisque leurs actions ne remontent qu'à
  la fin de celui-ci.

**Les actions.**

- **Ce qui coûte une action** : jouer une capacité (livret, « Capacités »),
  sauf un passif, qui ne se joue pas ; une intervention.
- **Ce qui ne coûte rien de plus** : le jet de défense, la localisation, et
  les effets d'une capacité.
- **Une capacité qui ne se joue pas** : son bouton est inactif et dit
  pourquoi, la première raison qui tient. Ce qui tient à la capacité
  d'abord : « absente de la banque » ; « coût illisible dans la banque » ;
  pour un déplacement qui n'offre aucune case, « aucune case à sa portée »
  (§ 17.6). Ce qui tient au moment ensuite : « Plus d'action à ce tour. » ;
  « Pas assez de souffle : 5 demandés, 3 restants. » ; « Pas assez de
  lien : 1 demandé, 0 restant. »
- **Le paiement.** L'action, le souffle et le lien d'un geste se paient
  d'un coup, au premier dé lancé, ou à la confirmation d'une capacité sans
  jet. Jusque-là, « Revenir » annule le choix sans rien dépenser (règle
  d'interface). Ce que le joueur a lu avant de lancer est ce qui
  s'applique : les circonstances du jet se figent au même instant.

**« Passer son tour »** est toujours proposé, par un bouton du simulateur :
la capacité de la banque qui porte ce rôle (§ 17.6) n'a pas de bouton à
elle. Passer ne coûte rien ; le protagoniste a joué (§ 12, point 35).

**La mort** (§ 12, point 14, pour un adversaire). À 0 point de corps, un
protagoniste meurt, à la fin du geste qui le tue. Il ne joue plus et ne se
cible plus ; sa fiche dit « mort au tour N » ; son jeton est grisé et
barré, et sa fiche se replie. Ses actions ne remontent plus.

**La fin.** Quand un camp n'a plus de vivant, le combat est terminé :
« Combat terminé : victoire des PJ. » (ou « … des adversaires. »). La ligne
suit celle de la mort, sans « Fin du tour » : personne ne retrouve ses
actions. On ne joue plus ; le journal se copie et se télécharge toujours.

**Trois bornes**, celles que tient la lecture d'un combat gardé
(§ 17.8) : le jeu les tient aussi, sans quoi un combat se garderait, puis
serait refusé en entier au rechargement suivant. Les nombres ont été posés
ou revus le 12/10/2026 par les corrections de la relecture de fin de
groupe (§ 14), et restent à confirmer (§ 12).

- **5 000 événements par combat.** Au-delà, le jeu refuse l'événement :
  « Ce combat a atteint 5 000 événements : commencez-en un nouveau. » La
  borne était de 20 000. Elle borne surtout l'ouverture de l'écran, qui
  rejoue tout le combat d'une traite : le nombre est fixé d'après la
  mesure, pour que le pire contenu que la validation accepte se rejoue en
  quelques secondes (4,66 à 4,75 s pour 5 000 événements, sous Node, poste
  chargé : § 17.11). L'agent des corrections estime qu'un combat ordinaire
  compte de 100 à 3 000 événements : c'est une estimation, écrite dans
  `js/combat/regles.js`, non une mesure. Seul repère mesuré : les combats
  tirés pour les mesures (§ 17.11) atteignent 300 événements au tour 10
  avec quinze protagonistes, au tour 27 avec quatre
  (`plans/mesures_chromium.json`, l'état au départ des clics). La marge
  paraît mince, et un combat aux plafonds (douze personnages, soixante
  adversaires) pourrait atteindre la borne ; aucune mesure ne dit à quel
  tour. **Point à trancher**, au compte rendu.
- **100 tirages par dé.** Un dé sous k désavantages nets se lance k + 1
  fois (§ 17.4), et son événement porte autant de valeurs : la main en
  règle 20 au plus, les passifs d'un adversaire quelques-uns. Sans cette
  borne, un seul événement d'un contenu forgé portait des millions de
  valeurs, lues une à une avant tout refus. Reste connu : au-delà de 99
  désavantages nets, le dé s'offre puis son événement est refusé pour sa
  forme ; le joueur peut revenir, rien n'est payé. Ni la démonstration ni
  le vrai classeur n'ont d'adversaire à passif câblé.
- **99 999 identifiants.** Chaque ajout prend un identifiant (« pj » ou
  « adv », puis cinq chiffres au plus) à un compteur qui ne redescend
  jamais, même après « Retirer ». Arrivé à 99 999, plus personne ne
  s'ajoute : « Ce combat a épuisé ses identifiants : commencez-en un
  nouveau. », pour un personnage comme pour des adversaires, tout ou
  rien. Un sixième chiffre ferait un protagoniste que le moteur
  refuserait à chaque geste, et un combat qui ne se relirait plus.

### 17.4 Les jets

**La chaîne** (livret, « Jets » ; `js/combat/jet.js`). Un dé est réussi si
sa valeur, modificateurs compris, égale ou dépasse la difficulté. Une
réussite fait lancer le dé suivant, jusqu'à trois réussites ; le premier
échec arrête la chaîne. Chaque dé se lance d'un clic sur le dé, qui affiche
son type (« d10 ») tant qu'il n'est pas lancé.

**Le dé** est la somme de deux caractéristiques, ou le double d'une seule,
arrondie au pair inférieur (§ 15.2).

- **Attaque** : le dé de l'arme tenue, celui de la fiche (lourde, Force et
  Précision ; agile, Agilité et Force ; précise, Précision et Agilité).
- **Défense** : celui de l'armure portée, avec la règle des types mêlés et
  le cas sans armure (§ 15.2). À égalité de dés, la fiche retient un type :
  l'écran l'affiche (§ 12, point 30).
- **Dé au choix** : une ou deux caractéristiques, choisies au moment du
  jet. C'est le dé du jet de caractéristique, de l'attaque à mains nues
  (§ 12, point 10), et d'une attaque que ne donnent ni l'arme tenue ni le
  bloc de base (point 29).
- **Jet de caractéristique** (livret, « Jets de caractéristique ») : la
  difficulté se choisit de 2 à 10, avec les libellés du livret
  (« Difficultés ») : extrêmement facile, très facile, facile, moyen,
  compliqué, difficile, très difficile, extrêmement difficile, quasi
  impossible.

**Les modificateurs** s'ajoutent à la valeur de chaque dé de la chaîne
(« 8 + 1 »). Ils entrent dans cet ordre, écrit dans le code
(`js/combat/circonstances.js`) ; N est le niveau du passif (§ 17.6) :

| # | Source | Quand | Valeur |
|---|---|---|---|
| 1 | le passif « bonus de Force » du lanceur | le jet mobilise la Force | +N |
| 2 | « bonus d'Agilité » | il mobilise l'Agilité | +N |
| 3 | « bonus de Précision » | il mobilise la Précision | +N |
| 4 | « petit » | un jet de défense | +N |
| 5 | « petit » | le jet mobilise la Force | −1 |
| 6 | **les blessures** du lanceur (livret, « Ressources ») | k zones dont la résistance est à 0 | −k |
| 7 | la main | un réglage, avant le premier dé | ±N, avec sa raison |

Seul un personnage lance : les lignes 1 à 6 ne s'appliquent jamais à un
adversaire (§ 12, point 14). Le −1 d'une blessure vaut pour les dés de la
chaîne, pas pour le dé de localisation (point 13).

**L'avantage et le désavantage** (livret, « Avantage et désavantage »). On
compte les avantages et les désavantages du jet, chacun avec sa source. Ils
s'annulent, et seule la différence reste.

- **Avec k avantages**, le joueur a k relances pendant le jet. Quand un dé
  échoue, il choisit de le relancer ou de le garder. La relance remplace le
  dé, et la chaîne continue si elle réussit. Une relance est dépensée dès
  qu'elle est choisie. Un dé relancé qui échoue encore se relance, tant
  qu'il reste une relance : les relances ne se comptent pas par dé (lecture
  retenue, à confirmer par l'auteur : § 12, point 46 ; § 17.9).
- **Avec k désavantages**, chaque dé de la chaîne se lance k + 1 fois, et
  l'on garde le pire (§ 12, point 3) ; cent lancers au plus par dé
  (§ 17.3).
- **Les sources**, dans cet ordre, écrit dans le code. « L'autre » est la
  cible du personnage qui attaque, ou l'adversaire qui l'attaque :

| # | De qui | Source | Quand | Donne au personnage qui lance |
|---|---|---|---|---|
| 1 | le lanceur | « seul sur sa case » | attaque ou défense au corps-à-corps, aucun allié vivant sur sa case | N avantages |
| 2 | le lanceur | « en meute » | attaque, un allié vivant sur sa case | N avantages |
| 3 | le lanceur | « esprit de corps » | défense, un allié vivant sur sa case | N avantages |
| 4 | le lanceur | la maîtrise | son attaque, hors maîtrise (§ 17.6) | 1 désavantage |
| 5 | le lanceur | les types d'armure mêlés | sa défense | 1 désavantage |
| 6 | l'autre | « seul sur sa case » | au corps-à-corps, sans allié vivant sur sa case | N désavantages |
| 7 | l'autre | « en meute » | il attaque, un allié vivant sur sa case | N désavantages |
| 8 | l'autre | « esprit de corps » | il se défend, un allié vivant sur sa case | N désavantages |
| 9 | l'autre | la maîtrise | son attaque, hors maîtrise | 1 avantage |
| 10 | la main | un réglage, avant le premier dé | toujours | k avantages, ou k désavantages, avec sa raison |

- **L'inversion** (règle de l'auteur du 11/10/2026 ; § 12, point 1) : les
  lignes 6 à 9. Un avantage d'un adversaire devient un désavantage du
  personnage dans le même jet, et inversement ; la source garde alors le
  nom de l'adversaire. Mesuré sur la démonstration : un Marmiton de corvée
  joue sa seconde capacité de spatule contre Aubépine, sur sa case ;
  Aubépine a 1 avantage (ligne 1), 1 désavantage (ligne 5) et 1 avantage
  (ligne 9), soit 1 avantage.
- **Le corps-à-corps** : l'attaquant et la cible sur la même case.
  **Un allié** : un protagoniste vivant du même camp, autre que soi (§ 12,
  points 11 et 37).
- **Un jet de caractéristique** n'a ni passif d'avantage ni maîtrise : seule
  la main lui donne un avantage ou un désavantage.

**Le dé explosif** (livret, « Dé explosif » ; § 12, points 5 et 36).

- **Quand** : la face maximale du dé, modificateurs compris, reste sous la
  difficulté, et le dé la montre.
- **« Faire exploser »** relance le même dé et ajoute sa valeur brute : le
  modificateur ne compte qu'une fois. Cela se répète tant que le dé montre
  sa face maximale et que la somme reste sous la difficulté. Devant un dé
  qui peut exploser, c'est la seule suite offerte.
- Avec un désavantage, seul le dé gardé explose, et l'explosion se lance
  une seule fois. Une relance d'avantage remplace le dé et sa somme.

**L'asymétrie** (livret, « Asymétrie des rôles lors des combats »). Seuls
les joueurs lancent des dés. Quand un personnage attaque, la difficulté est
la défense de sa cible. Quand un adversaire attaque, le personnage visé
lance sa défense contre l'attaque de l'adversaire. Un adversaire qui porte
la capacité du jet de caractéristique la joue donc sans jet (§ 12,
point 42).

**À la main**, avant le premier dé : un modificateur, et des avantages ou
des désavantages, chacun de −20 à +20, **avec sa raison**, obligatoire dès
que la valeur n'est pas nulle (de 1 à 80 signes, sans caractère de
contrôle ; l'écran propose le nom de la capacité). C'est le moteur qui
vérifie la raison, pas l'écran : elle entre au journal et dans le fichier
téléchargé.

Le coup critique et le dé miroir sont au groupe 2 (§ 17.12).

### 17.5 L'attaque, la localisation et les dégâts

**Une attaque d'un personnage.**

1. Il choisit une capacité d'attaque (§ 17.6), puis une cible vivante du
   camp adverse, **à portée**.
2. **Le jet d'attaque**, contre la défense de la cible. Avec 0 réussite,
   c'est manqué. Sinon, les dégâts sont ceux du rang de ses réussites : A
   pour 1, B pour 2, C pour 3 (livret, « Jets d'attaque »). À la fin de
   cette étape, avant la localisation, le joueur peut fixer les dégâts
   (plus bas).
3. Viennent la localisation, l'esquive, puis les dégâts.

**Une attaque d'un adversaire** suit la même suite : la capacité, puis la
cible ; puis **le jet de défense du personnage**, contre l'attaque de
l'adversaire (livret, « Jets de défense ») : 0 réussite, C ; 1 réussite,
B ; 2 réussites, A ; 3 réussites, aucun dégât, et l'attaque n'a pas touché.

**La portée** d'une capacité est son paramètre `portee`, à la puissance
jouée ; absente, 0 (§ 12, point 2). La distance entre l'attaquant et la
cible (une diagonale compte pour une case) ne la dépasse pas : 0, c'est la
même case. Une cible hors de portée ne se choisit pas, et l'écran dit
pourquoi (« hors de portée : 2 cases, portée 1 »).

**La localisation** (livret, « Jets de localisation » ;
`js/combat/degats.js`) se fait **dès qu'une attaque touche**, même sans
dégâts : au moins une réussite pour un personnage qui attaque, moins de
trois en défense pour un personnage attaqué.

- **Combien de dés** : autant que le dit le paramètre `loc_multiple` de la
  capacité, lu comme la portée ; 1 par défaut. Avec plusieurs dés, les
  dégâts s'appliquent en entier à chaque zone, même deux fois à la même.
- **Quelle grille** : sur un personnage, la sienne : tête 1, torse 2-11,
  jambe gauche 12-13, jambe droite 14-15, bras gauche 16-17, bras droit
  18-19 ; sur un adversaire, la sienne propre (§ 16.3).
- **À la main** : décaler la face de ±N, avec sa raison (une capacité qui
  fait viser), tant que ni l'esquive ni « Appliquer » n'ont été joués. La
  face décalée reste sur une zone.
- **La face de contre-attaque** (20 sur un personnage, 1 sur un
  adversaire ; § 12, point 12) **annule toute l'attaque** et ses effets,
  même parmi plusieurs dés. Elle se lit sur le dé brut : un décalage ne la
  crée ni ne l'efface. Les dés de localisation restants ne se lancent pas,
  et le geste est fini ; l'action et le coût de l'attaquant restent payés
  (§ 12, point 41). Le groupe 1 l'écrit au journal ; le groupe 2 proposera
  la contre-attaque.
- Sans dégâts, aucune zone ne perd rien : le geste se finit quand même par
  « Appliquer », un seul chemin.

**L'esquive** est la seule intervention du groupe 1 (§ 12, points 8 et
40). Elle est proposée au personnage qui va recevoir des dégâts, s'il porte
la capacité de ce rôle, qu'il lui reste une action et du souffle, une seule
fois par attaque : X points de souffle annulent X dégâts, X allant de 1 au
plus petit de son souffle et du total des dégâts (la somme des dégâts de
chaque zone touchée). Elle se paie tout de suite : une action, X de
souffle. Avec plusieurs zones touchées, elle s'impute zone après zone, dans
l'ordre des dés. Le souffle d'un adversaire n'annule rien.

**Les dégâts** (livret, « Armure, résistance et corps »). Sur chaque zone
touchée, dans l'ordre des dés :

1. l'armure de la zone perd autant de points que les dégâts, jusqu'à 0 ;
2. le reste passe à la résistance de la zone, jusqu'à 0 ;
3. le reste passe au corps, qui n'est pas localisé. Ce qui dépasse 0 de
   corps se perd.

Une zone dont la résistance tombe à 0 est **une blessure** (livret,
« Ressources ») : pour un personnage, −1 à ses jets par zone blessée,
cumulés ; pour un adversaire, sans effet calculé (§ 12, point 14).

**Fixer les dégâts**, à la fin de l'étape du jet. Les dégâts d'un geste
sont une base et, au plus, une opération :

- **une attaque** a les dégâts du rang de ses réussites. Le joueur peut les
  ajuster : un nombre, de 0 à 999, et une raison (par défaut, le nom de la
  capacité), qui vont au journal ;
- **une capacité sans dégâts propres**, jouée avec un jet d'arme prêté
  (§ 17.6), propose « Sans dégâts », par défaut, ou « Dégâts de l'arme »
  (le rang de ses réussites) ; ils s'ajustent de même ;
- **une attaque dont les dégâts ne se lisent pas** touche « sans dégâts »,
  et le joueur les saisit (§ 12, point 43) ;
- **des dégâts directs**, à la main, avec leur nombre et leur raison : ils
  remplacent ceux du coup et passent à la résistance de la zone touchée (le
  reste au corps), ou droit au corps, sans toucher l'armure (point 39) ;
- **des dégâts de 0 ou moins** n'enlèvent rien ; la localisation se fait
  quand même.

L'étape « Dégâts » montre le détail, zone par zone, après l'esquive, et
s'applique par « Appliquer », sans nouveau changement. Ce détail est
calculé par la fonction même qui l'appliquera.

### 17.6 Les capacités et les rôles câblés

**Le mode assisté.** Toute capacité se joue, sauf un passif. Elle coûte une
action, son souffle et son lien. Sa description s'affiche, évaluée à la
puissance jouée (§ 15.2). Ce qu'elle fait de plus que les règles générales
s'applique à la main.

**Les attaques.**

- **Est une attaque** une capacité qui n'est ni Intervention ni Passif, et
  qui reçoit le paramètre `degats`, de son bloc ou d'un paramètre qui la
  vise, ou porte l'élément Dégâts. Ses éléments sont ses éléments propres
  et ceux que son bloc lui transmet en la visant ; Passif et Intervention
  se lisent à la puissance jouée. Elle part sur le jet d'attaque de l'arme
  qui la donne, avec ses dégâts.
- **Toute autre capacité part « sans jet »**. Sa cible est facultative : un
  vivant au choix, sans condition de portée, ou « Sans cible ». **Un bouton
  « Jet d'attaque » lui prête le jet d'une arme** (§ 12, points 9 et 38) ;
  il exige alors une cible adverse, à la portée de cette arme. Pour un
  personnage, c'est l'arme tenue ; sans arme tenue, les mains nues. Un
  adversaire choisit l'arme s'il en a plusieurs ; sans arme, le jet se fait
  « sans arme », à portée 0, et les dégâts se saisissent à la main. Ce jet
  prêté ne porte pas le désavantage de maîtrise.
- **Pour un personnage, les objets qui donnent leurs capacités** (§ 12,
  point 19) : les armes, les armures et le bouclier, seulement portés, et
  une seule arme, la tenue ; les autres objets (consommables, équipements),
  où qu'ils soient. Dans la démonstration, « Choc sourd » ne paraît donc
  pas chez Aubépine : seul son rouleau, rangé au sac, le donne.
- **Pour un adversaire**, une capacité que donnent plusieurs armes a un
  bouton sous chacune ; deux armes de même nom se distinguent par « (2) ».
  Une capacité citée sans arme est une attaque si elle a des dégâts propres
  ou porte l'élément Dégâts (§ 12, point 43) : dans la démonstration, la
  Frappe de la Mouette chapardeuse n'a ni l'un ni l'autre, et se joue sans
  jet, ou par le jet prêté « sans arme ».
- **Les interventions** se jouent aussi à son propre tour, comme toute
  capacité.

**Les coûts et la puissance** (§ 12, points 26 et 27).

- **La puissance.** Un personnage la choisit de 1 au niveau de la capacité
  (livret, « Capacités » : on joue sous son maximum pour économiser), parmi
  les puissances qui ont une variante, par des boutons + et − ; une
  capacité qui n'évolue pas se joue à la puissance 0, et ne porte pas
  « [P] ». Son bouton porte d'office la plus haute puissance qu'il peut
  payer (règle d'interface). Un adversaire joue au rang de la capacité.
- **Le coût** se lit à la puissance jouée (§ 15.2 : « N » remplacé). X se
  choisit au moment de jouer, de 0 à ce qui reste ; l'esquive a sa propre
  borne (§ 17.5). Un coût négatif vaut 0.
- **Le lien d'un personnage** se paie sur la jauge du primordial dont vient
  la capacité, et sur elle seule ; pour une capacité qui ne vient pas d'un
  primordial, sur une jauge au choix qui suffit. La jauge part pleine
  (§ 12, point 17) ; une jauge de taille 0 ne s'affiche pas.
- **Le coût en lien d'un adversaire** ne se paie pas, et le journal le dit
  (§ 12, point 14).

**Le bloc de base, câblé.** Le nom de chacune de ses capacités vient du
tableau des rôles, plus bas.

- **Le déplacement.** La puissance P se choisit comme ci-dessus ; le coût
  s'évalue à P ; l'arrivée est une case située à une distance de 1 à P
  (§ 12, point 2). Un adversaire ne se déplace que s'il a la capacité.
  Dans la démonstration, le Chef de partie joue son Pas chassé au rang 2,
  pour 1 de souffle, et va jusqu'à deux cases. **À la puissance 0** (une
  capacité de déplacement qui n'évolue pas), aucune case ne s'offre : le
  bouton est inactif et dit « aucune case à sa portée », avant toute
  raison du moment, et l'événement est refusé. Avant la relecture de fin
  de groupe, le bouton restait actif et ouvrait un geste sans autre issue
  que « Revenir » (§ 12, « Ce qui manque encore »).
- **Le jet de caractéristique** : § 17.4.
- **L'attaque à mains nues.** C'est la capacité que vise le paramètre
  `degats` du bloc de base (§ 15.2) : ce rôle-là ne tient pas à un nom. Ses
  dégâts sont ceux de la puissance jouée, lus comme sur la fiche ; son dé
  se fait d'une ou deux caractéristiques, choisies au moment du jet (§ 12,
  points 10 et 28).
- **L'esquive** : une intervention (§ 17.5).
- **Passer son tour** : un bouton du simulateur (§ 17.3). **Le jet de
  défense** : automatique, il n'a pas de bouton. **L'attente** : au
  groupe 2 ; la capacité de ce rôle n'a pas de bouton au groupe 1.

**Les passifs câblés** (proposition acceptée par l'auteur le 11/10/2026).
Leur N est **le niveau de cette capacité** chez le personnage (§ 15.2), ou
son rang chez l'adversaire. Le niveau du personnage n'entre dans aucun
calcul (§ 12, point 24).

| Rôle | Effet |
|---|---|
| bonus de Force | +N à chaque dé des jets qui mobilisent la Force |
| bonus d'Agilité | +N à chaque dé des jets qui mobilisent l'Agilité |
| bonus de Précision | +N à chaque dé des jets qui mobilisent la Précision |
| petit | +N à chaque dé des jets de défense ; −1 à chaque dé des jets qui mobilisent la Force |
| seul sur sa case | N avantages aux jets d'attaque et de défense au corps-à-corps, quand aucun allié vivant n'est sur sa case |
| en meute | N avantages aux jets d'attaque, quand un allié vivant est sur sa case |
| esprit de corps | N avantages aux jets de défense, quand un allié vivant est sur sa case |
| dégrossir | à chaque attaque, N points de plus contre l'armure par réussite |
| maîtrises | le désavantage du § 16.4, pour un personnage comme pour un adversaire |

- **« Dégrossir »** (§ 12, points 33 et 34). Sur chaque zone touchée,
  l'armure perd les dégâts plus N × réussites, jusqu'à 0. Ce qui passe à la
  résistance reste « les dégâts moins l'armure d'avant le coup ». Exemples
  tenus par un contrôle : armure 15, dégâts 13, +3 : l'armure tombe à 0, et
  rien ne passe à la résistance ; armure 30, dégâts 13, +3 : 14. Chez un
  adversaire qui attaque, ses réussites valent 3 moins celles de la défense
  du personnage. Il vaut pour toute attaque, mains nues comprises, et pour
  un jet prêté joué avec « Dégâts de l'arme » ; il compte les réussites du
  jet, non un ajustement fait à la main ; il ne s'applique ni sans dégâts,
  ni à des dégâts fixés à 0, ni à des dégâts directs, ni à un coup que
  l'esquive a annulé.
- **Les maîtrises** (§ 12, point 23). Une capacité d'un objet Lourde,
  Agile ou Précise a 1 désavantage, sauf si une maîtrise de ce poids, de
  rang N, couvre sa position dans le bloc. La maîtrise se reconnaît comme
  au § 16.4 ; la règle de position est la fonction partagée de la
  résolution. Pour un personnage, les capacités possédées sont celles qu'il
  tient d'une origine valable au combat (§ 12, point 19), à leur niveau :
  une maîtrise que seule une arme rangée au sac donnerait ne lève aucun
  désavantage. La position se compte sur l'entrée simple ou sur l'option
  **choisie** qui donne la capacité. Le désavantage est figé dans la
  photographie, par façon. Dans la démonstration, Aubépine n'a que la
  maîtrise de l'agile, et son couteau est précis : ses deux capacités de
  couteau sont hors maîtrise.
- **L'affichage.** Sur sa fiche, un passif conditionnel se dit actif ou
  inactif, avec sa raison (« aucun allié sur sa case », « un allié sur sa
  case »). **Au niveau 0**, la fiche dit ce que le jet applique : le
  passif est inactif, « niveau 0 », avant toute autre raison, et son effet
  s'écrit « sans effet », non « +0 » ; « petit » ne garde que « −1 en
  force », actif chez un personnage (§ 12, point 45). La règle se lit dans
  la table des bonus, celle du jet. Avant la relecture de fin de groupe,
  un tel passif se disait actif, « +0 en force ».
- **Chez un adversaire** : les avantages et désavantages de ces passifs
  passent au personnage, inversés (§ 17.4) ; les bonus et malus +N ne
  s'appliquent pas à lui, et sa fiche le dit (« ne s'applique pas à un
  adversaire »).

**Les rôles et les noms** (`js/combat/roles.js`). Le simulateur reconnaît
une capacité câblée **à son nom, et à lui seul** : l'élément Passif ne
décide que de l'absence de bouton. Un seul module porte le tableau ; les
noms se comparent par leur clé (§ 6.3). Le rôle se pose à la photographie,
et le noyau ne lit ensuite que lui, jamais un nom.

| Rôle | Démonstration | Ce que le simulateur en fait |
|---|---|---|
| déplacement | Pas chassé | mène à une case, à une distance de 1 à P |
| jet de caractéristique | Goûter | un jet d'un dé au choix, contre une difficulté de 2 à 10 |
| esquive | Pas de côté | l'intervention qui annule X dégâts pour X de souffle |
| attendre | Guetter | rien au groupe 1 : pas de bouton (groupe 2) |
| passer son tour | — | pas de bouton à elle : « Passer son tour » est un bouton du simulateur |
| jet de défense | — | pas de bouton : la défense se lance d'elle-même quand un adversaire attaque |
| bonus de Force | Costaud | passif : +N |
| bonus d'Agilité | Vif | passif : +N |
| bonus de Précision | — | passif : +N |
| petit | — | passif : +N en défense, −1 en Force |
| seul sur sa case | Solo du chef | passif : N avantages |
| en meute | Brigade | passif : N avantages en attaque |
| esprit de corps | — | passif : N avantages en défense |
| dégrossir | Réduction | passif : +N contre l'armure par réussite |

- **Les noms de la démonstration** sont fictifs, et s'écrivent en clair.
  « — » : la démonstration n'a pas de capacité pour ce rôle ; les contrôles
  le jouent sur des photographies écrites à la main.
- **Les noms du vrai classeur se reconnaissent par leur empreinte** : le
  SHA-256 de la clé du nom, en hexadécimal. Le tableau du code ne porte,
  pour eux, que cette empreinte. Les quatorze empreintes se calculent hors
  dépôt, d'après le tableau de la mission, avec la clé du moment : si la
  clé d'un nom change (§ 6.3), elles changent toutes.
- **Une façon de reconnaître par mode, jamais les deux** : en
  démonstration, le nom ; en mode réel, l'empreinte. Un nom fictif ne câble
  donc pas une capacité du vrai classeur qui le porterait par hasard, ni
  l'inverse. Condenser chaque nom d'une banque demande une attente : elle
  se paie une fois par banque ouverte, à l'ouverture de l'écran.
- **Le tableau est celui du module, toujours, pour le jeu.** La fonction
  qui le dresse (`tableDesRoles`) en accepte un autre, de la même forme,
  pour les seuls contrôles : c'est ainsi qu'ils voient une capacité
  reconnue par son empreinte en mode réel, sur des noms fictifs condensés
  à l'exécution, sans qu'aucun nom du vrai classeur s'écrive. Un tel
  tableau ne se mémorise pas, et ne change rien à ce que la banque a
  mémorisé. Avant la relecture de fin de groupe, seul le banc, hors
  dépôt, tenait cette reconnaissance.
- **Une empreinte n'est pas un secret.** Elle tient la lettre de la règle
  « aucun nom du vrai classeur dans le dépôt », rien de plus. Mesuré par
  la relecture de sécurité, le 12/10/2026 : treize des quatorze noms se
  retrouvent à partir du seul dépôt, sans autre dictionnaire que lui, en
  26 secondes ; et le tableau dit ce que fait chaque rôle (§ 17.11).
  **Point à trancher par l'auteur**, au compte rendu : garder les
  empreintes pour ce qu'elles sont, ou désigner un jour les rôles par une
  colonne ou un élément du classeur plutôt que par un nom.
- **« Câblés absents de la banque : … »** : la préparation dit en une ligne
  les rôles que le mode attend et dont aucun nom n'est dans la banque (les
  neuf de la démonstration, ou les quatorze du vrai classeur). **Un nom
  changé dans le classeur se voit ainsi.** Sans rôle absent, la ligne ne
  paraît pas : sur le vrai classeur, aucun ne manque (banc du 12/10/2026,
  § 17.11).

Le journal et l'écran écrivent **le nom que la banque donne** à la capacité
qui porte un rôle (« Pas chassé », « Pas de côté », « Réduction »), jamais
un nom écrit dans le code. Seuls « passe son tour », le bouton « Passer son
tour » et les noms d'étapes (« Jet d'attaque »…) sont des textes du
simulateur.

### 17.7 L'écran

**L'adresse et la navigation** : § 9. Le module de l'écran
(`js/ecrans/combat.js`) garde le combat en mémoire, puisque chaque visite
de l'adresse reconstruit la page ; « Oublier le mot de passe » l'efface
(§ 7.2). L'ouverture demande trois attentes (les rôles câblés de la
banque, la base de l'appareil, le combat gardé) : l'écran rend son titre et
une attente tout de suite, puis se remplit ; une ouverture qui échoue donne
un message, jamais une attente sans fin.

**Il suit la maquette** du lot (`plans/maquette_simulateur.html`, faite le
11/10/2026 à partir du vrai classeur, validée par l'auteur, et ses rendus à
1 440 et 390 px ; hors dépôt). Elle montre l'écran du groupe 2 ; ce qui en
change est dit plus bas.

**Trois dispositions.** L'ordre du document est celui du téléphone
(décision de l'auteur du 11/10/2026) : la carte, le panneau d'action (ou la
préparation), les personnages, les adversaires, puis le journal. Les deux
autres ne font que placer. Une largeur de plus, `--largeur-combat` (90rem),
élargit la page pour cet écran seul. Les deux seuils s'écrivent en dur dans
`css/combat.css`, comme celui d'`ecran.css` (§ 9).

| Largeur | Disposition |
|---|---|
| moins de 56rem | une colonne, dans l'ordre du document |
| de 56 à 80rem | la carte et le panneau d'action à gauche, les deux listes à droite ; le journal dessous |
| 80rem et plus | celle de la maquette : les personnages, puis la carte et le panneau d'action, puis les adversaires ; le journal dessous, sur toute la largeur |

**La barre de titre** : « Simulateur de combat » ; l'état (« Préparation »,
« Tour 2 · camp des PJ », « Combat terminé ») ; l'état de l'enregistrement
(§ 17.8) ; « Fin de tour », bouton principal pendant le combat, et
« Nouveau combat ». Sur téléphone : « Fin de tour », et un menu « ⋯ » qui
porte l'autre ; l'état de l'enregistrement reste visible sous le titre. Une
ligne d'aide dessous, selon la phase.

**La carte** (dans le code, le plateau) : 10 × 10 cases, colonnes A à J,
lignes 1 à 10, et une légende dessous.

- **Un jeton** est un rond vert (personnage) ou rouge (adversaire). À
  partir de 56rem, le nom court est à côté ; en dessous, les initiales sont
  dedans. Sa taille se mesure sur sa case, non sur une longueur fixe, et
  ce qui dépasserait est coupé, jamais poussé chez la voisine. **Le côté
  d'une case**, mesuré le 12/10/2026 dans Edge 155 et dans Firefox 143,
  qui donnent les mêmes nombres : 24,4 px dans une fenêtre de 320 px,
  28,4 px à 360, 31,4 px à 390, 33,8 px à 414, 69,2 px à 768, 59,3 px à
  1 024, 70,9 px à 1 440. La case la plus grande relevée fait 74,2 px, à
  895 px, juste sous le seuil de 56rem ; elle tombe à 50,8 px à 896 px.
  Au seuil de 80rem, elle passe de 73,4 px (à 1 279 px) à 62 px (à
  1 280 px). Aucune case ne déborde, sur 98 largeurs, avant les
  corrections de la relecture de fin de groupe (§ 17.11).
- **Une case montre trois jetons au plus**, deux sous 56rem. Au-delà,
  « +k » ouvre la liste de la case, dans le panneau d'action ou, avant le
  lancement, sous la préparation. Avant le lancement, les jetons d'une
  case gardent l'ordre d'ajout. Pendant le combat, celui qui joue vient
  d'abord, puis la cible ; puis, dans une case de plus de trois
  protagonistes, ceux qu'on peut choisir ; puis les vivants, puis les
  morts ; à rang égal, l'ordre d'ajout. Sans ce rangement, relevé par le
  regard sur la maquette, un mort tenait la place d'un vivant qu'on
  pouvait cibler, caché derrière « +1 ».
- **Les marques.** Celui qui joue, et sa case, sont entourés de l'accent.
  La cible choisie est entourée d'un trait rouge discontinu. Un mort est
  grisé et barré.
- **Pendant un choix** de cible ou d'arrivée, les jetons et les cases
  possibles sont marqués, les autres inactifs.
- **Chaque jeton est un bouton nommé** : nom entier, camp, état, case
  (« Aubépine Crèmebrûlée, personnage, joue, case D4 »). Une case qu'on
  peut choisir l'est aussi. Jamais un bouton dans un bouton : le bouton
  d'une case la couvre, sous ses jetons.
- **Les cases font moins de 44 px sur un téléphone**, leurs jetons et le
  « +k » d'une case pleine aussi : c'est admis, et chaque choix fait sur
  la carte a son double en boutons de 44 px (§ 9).

**La préparation** prend, avant le lancement, la place du panneau d'action.
Elle porte : ajouter un personnage, pris dans la liste des personnages
disponibles (§ 17.2), après une attente pour ceux qui sont en ligne ;
ajouter un adversaire, avec son nombre d'exemplaires ; **« Placer la
rencontre préparée »** ; « Qui commence » ; « Lancer le combat » ; la ligne
des câblés absents (§ 17.6) ; les avertissements des photographies posées.
Une option qui ne s'ajoute pas reste choisissable : c'est ainsi que sa
raison se lit.

- **Poser et déplacer**, par trois moyens qui mènent au même ordre : à la
  souris, par glisser-déposer ; partout, en touchant le jeton, puis la
  case ; ou par le champ « Case » de la fiche. Le glisser-déposer n'est
  jamais le seul moyen : il n'existe ni au clavier ni au doigt.
- **La rencontre préparée** est la composition que l'écran Rencontre tient
  en mémoire pendant la visite (§ 16.6). Le bouton l'ajoute à la suite,
  dans l'ordre de la liste, numérotation comprise. Si un plafond serait
  dépassé, rien ne se pose, et le bouton dit pourquoi ; un adversaire qui
  ne s'ajoute pas reste hors du combat, les autres se posent, et l'écran
  dit lequel et pourquoi. Sans rencontre, le bouton est inactif :
  « Composez d'abord une rencontre. »
- Une banque sans adversaires : la préparation le dit, comme l'écran
  Rencontre. Un combat gardé reste jouable : ses photographies se
  suffisent.

**Les fiches vivantes.** Une par protagoniste, dans la liste de son camp ;
c'est un volet, que son nom déplie.

- **L'en-tête** : la pastille d'initiales et le nom ; une ligne, l'espèce
  et l'archétype d'un personnage (« Marmiton · Saucier »), les types d'un
  adversaire écrits comme sur sa carte (« Commis, Rôtisseur ×1,4 »,
  § 16.5) ; l'état (« joue », « a joué », « ciblé », « mort au tour 2 ») ;
  les actions restantes, en pastilles.
- **Le corps** : le souffle et le corps, en cases (au-delà de 30, en
  nombres) ; **une table des zones** pour chaque protagoniste : les faces
  du d20 et le nom de la zone (celui des personnages si elle est reconnue,
  même à deux lettres près, sinon le nom écrit), l'armure, signalée dès
  qu'elle baisse et en rouge à 0, la résistance en cases, la face de
  contre-attaque en pied ; l'attaque et la défense : pour un personnage, le
  dé et son modificateur, l'arme (son type, ses dégâts) et l'armure (son
  type) ; pour un adversaire, les deux nombres et ses armes ; le bouclier,
  « sans effet » (§ 12, point 18) ; le lien, par primordial ; les passifs
  câblés, actifs ou inactifs avec leur raison.
- **« Jouer »** choisit ce protagoniste ; le nom, lui, déplie le volet :
  jamais un bouton dans le titre d'un volet. Choisir qui joue se fait aussi
  par son jeton, ou par les boutons « Qui joue ? ».
- **« Fiche complète »** ouvre un panneau dans l'écran, sous la barre de
  titre, avec « Fermer ». Il reprend l'affichage existant : la vue lecture
  du personnage (§ 15.5), la carte de l'adversaire (§ 16.5). Il les calcule
  depuis la photographie, avec la banque ouverte : la fiche du personnage
  photographié ; pour un adversaire, la résolution d'une banque d'appoint
  qui porte sa ligne et celles de ses types, telles que photographiées. Si
  la banque a changé depuis l'ajout, il le dit : « La banque a changé
  depuis l'ajout : cette fiche suit la banque du jour. »
- **Ouvertes ou repliées.** Sur un grand écran, les fiches sont ouvertes.
  Sous 56rem, seule celle de qui joue l'est. Une fiche que la personne a
  ouverte ou repliée elle-même garde cet état ; la mort du protagoniste la
  replie.
- **Avant le lancement**, chaque fiche porte le champ « Case » et un bouton
  « Retirer ».

**Le panneau d'action.**

- **Sans protagoniste choisi** : « Qui joue ? », avec un bouton par
  protagoniste du camp qui peut encore agir.
- **Le titre** : « Aubépine Crèmebrûlée joue — 1 action sur 2,
  souffle 10 ».
- **Les étapes** : Capacité › Cible › le jet (« Jet d'attaque » pour un
  personnage, « Jet de défense » quand un adversaire attaque) ›
  Localisation › Interventions › Dégâts ; chacune est faite, en cours, ou à
  venir. Une capacité sans jet : Capacité › Cible ; un déplacement :
  Capacité › Arrivée ; un jet de caractéristique : Capacité › Jet de
  caractéristique.
- **Les capacités** sont groupées par origine, comme sur la maquette, dans
  cet ordre : l'arme tenue, avec son poids (« Couteau d'office
  (précise) ») ; l'archétype, l'espèce, le style, la constellation, le
  primordial ; les autres objets ; les capacités de base, en dernier ; puis
  « Passer son tour ». Pour un adversaire : une ligne par arme, avec les
  capacités qu'elle donne, puis « Capacités ».
- **Chaque bouton porte** : la puissance qui sera jouée (« Pas
  chassé [1] ») ; les dégâts, pour une attaque seulement (3/8/20) ; le coût
  à cette puissance, s'il n'est pas nul ; « désavantage », s'il y a lieu.
  Inactif, il dit pourquoi : il garde le focus, et sa raison lui est liée.
  Une ligne nomme les passifs, qui ne sont pas des boutons, et les
  interventions, qui le sont à son propre tour.
- **La cible** : un clic sur un jeton, ou un bouton par cible possible ;
  sous la cible, « choisie sur la carte » ou « choisie ici ».
- **Les dés**, dans cet ordre : le contexte (le jet, la capacité et la
  cible ; le dé, ses modificateurs et la difficulté ; les avantages et les
  désavantages, chacun avec sa source ; les réglages à la main, avant le
  premier dé) ; la chaîne, puis le bilan ; les rangs de dégâts, le rang
  atteint en évidence ; les choix du moment : relancer ou garder, faire
  exploser, les dégâts à fixer, la face à décaler, l'esquive et combien,
  « Revenir » avant le premier dé.
- **Quand un adversaire attaque**, c'est le même panneau : sa capacité et
  sa cible, puis le jet de défense du personnage.
- **Un combat arrêté** par son enregistrement (§ 17.8) : un bloc prend la
  place du panneau, avec la phrase de la barre et son bouton.

**Le journal** est sous le reste, sur toute la largeur : les lignes du
§ 17.9, la dernière visible. Sa hauteur est limitée, 24rem sur un grand
écran, 18rem sur un téléphone, et il défile. « Copier » et « Télécharger »
sont inactifs avant le lancement : le journal est vide.

**Les lecteurs d'écran et le clavier.**

- **Une seule région d'annonce**, polie : elle dit le résultat de chaque dé
  (« 1er dé : 9, réussi. », « 2e dé : 4, échec. Relancer ou garder ? »), le
  bilan d'un jet, un dé de localisation, une esquive et une face décalée,
  la ligne d'un geste fini, un tour qui change. Le bilan est une phrase
  (« 1er dé : 2, échec. Aucune réussite, Aubépine reçoit C = 15. ») ; il
  ne dit rien de dégâts qui restent à saisir (« 2e dé : 3, échec.
  1 réussite. », sans « touché »). L'esquive et la face décalée se disent
  par la phrase même que le journal en écrira (§ 17.9) : avant la
  relecture de fin de groupe, elles étaient muettes. Une valeur de dé
  passée sous zéro y porte le moins du journal. Ni l'état de la barre ni
  celui de l'enregistrement ne sont des régions : le second change deux
  fois par clic, et couvrirait
  l'annonce du dé.
- **Les états de l'enregistrement qui demandent un geste ou préviennent
  d'une perte** passent une fois, à leur arrivée, par une zone d'avis, avec
  leur bouton ; leur phrase reste ensuite dans la barre.
- **Un bouton inactif garde le focus**, et sa raison lui est liée. Après
  chaque geste, le focus va à la commande qui attend : le dé à lancer, le
  choix du moment, « Appliquer ». Un dé lancé reste un bouton, pour relire
  la chaîne au clavier, et son nom dit sa valeur et son état.
- **Jamais la couleur seule** (§ 9) : un dé porte ✓ ou ✗, un jeton ses
  initiales ou son nom, une armure entamée ses deux nombres.
- L'écran ne redessine que ce dont la vue a changé : une saisie en cours et
  le focus survivent au rendu que provoque la fin d'une écriture.

**Les couleurs** vivent dans `css/jetons.css`, pour les deux thèmes
(§ 9).

| Jeton | Clair | Sombre |
|---|---|---|
| `--combat-pj` | #1e7a3c | #3fae62 |
| `--combat-pj-doux` | #e2f2e7 | #163222 |
| `--combat-pj-texte` | #1e7a3c | #9ee0b4 |
| `--combat-adv` | #b3261e | #e66b61 |
| `--combat-adv-doux` | #fbe3e1 | #3a1c1a |
| `--combat-adv-texte` | #b3261e | #f2aaa3 |
| `--combat-sur-jeton` (les initiales) | #ffffff | #0b1722 |
| `--combat-mort` | #6b717b | #7d838d |
| `--combat-reussite` | #1e7a3c | #5cc38a |
| `--combat-echec` | #b3261e | #e8776e |
| `--combat-alerte` | #8a5300 | #e6a85a |

- Deux valeurs de la maquette changent, pour le contraste : en sombre, elle
  met les initiales en blanc et le rouge à #e0574d.
- Ce sont les seuls jetons neufs, avec `--largeur-combat` : le fond des
  cases, des panneaux et des dés prend les jetons du site. « mort » est une
  couleur de rond, trop pâle pour un texte sur le second fond : le texte
  d'un mort est dans le second gris du site, barré.
- `css/combat.css` entre dans le contrôle « des jetons seulement », hors
  les largeurs des `@media`. Toute classe propre à l'écran commence par
  `combat-` ; s'y ajoutent vingt-trois classes d'état, sans préfixe
  (`joue`, `cible`, `mort`, `possible`, `reussi`…), celles du contrat
  d'écriture du lot, et deux classes du site (`bouton`, `champ`) : le
  contrôle en tient la liste, et refuse toute autre classe. Tout jeton
  commence par `--combat-`, et aucun nom ne contient « carte », mot
  réservé à la carte d'adversaire (§ 16.5). **Le code n'écrit aucun
  style** (§ 10.1).

**Ce qui change par rapport à la maquette.**

- Les couleurs sont celles du tableau. La cible porte un trait rouge
  discontinu, non l'anneau plein ; les boutons que la maquette dessine sous
  44 px grandissent.
- **Au groupe 1**, il n'y a ni palette, ni « Intervenir… », ni menu du clic
  droit : à leur place, les réglages à la main (§ 17.4, § 17.5). La
  capacité d'attente n'apparaît pas.
- **Le journal** suit les gabarits du § 17.9, et sa hauteur est limitée.
  Une ligne s'écrit quand le geste est fini : la ligne « relance en
  cours… » de la maquette n'existe pas.
- **Les fiches** des adversaires ont toutes leur table des zones ; la
  maquette en résume deux. Leurs types s'écrivent comme sur leur carte
  (« ×2 »).
- **Les boutons de capacité** : une attaque porte les dégâts de son arme,
  une capacité sans dégâts propres n'en porte pas, le déplacement porte sa
  puissance, sans coût quand il est nul. **Les étapes** nomment le jet.
- **Sur téléphone**, une case montre deux jetons au plus, puis « +k » ; la
  maquette en montre trois.
- **Les interventions** sont des boutons à son propre tour ; la maquette
  les nomme seulement.
- **La préparation** prend la place du panneau d'action. Les ajouts se
  posent d'office : la phrase d'aide de la maquette change.
- **Les seuils** sont ceux de la mission, 56rem et 80rem ; la maquette
  n'en a qu'un, à 700 px.
- **Choisir qui joue.** La mission dit qu'un clic sur le nom d'une fiche
  choisit le protagoniste ; ici le nom déplie le volet, et c'est le
  bouton « Jouer » qui choisit, avec le jeton et les boutons « Qui
  joue ? » : jamais un bouton dans le titre d'un volet. C'est un écart à
  la lettre de la mission, choisi seul, dit au compte rendu.
- **« Fiche complète »** est un bouton de 44 px, pour un adversaire comme
  pour un personnage ; la maquette en fait un lien.
- **De moindres écarts, gardés** (relecture de la maquette) : une étape
  faite porte une coche verte, sans le fond vert de la maquette ; les
  boutons de capacité restent montrés pendant le jet, inactifs (« Une
  action est en cours. ») ; dans une fiche, le dé et les nombres
  d'attaque et de défense ne sont pas en gras ; la légende de la carte dit
  « mort, barré » ; la phrase « Ensuite : la localisation… » de la
  maquette n'existe pas, les étapes le disent déjà ; dans une case
  pleine, un mort passe derrière « +k » (plus haut), quand la maquette le
  montre barré dans la case ; sur téléphone, l'état de l'enregistrement
  reste visible, quand la maquette le cache.

### 17.8 L'enregistrement

**Chiffré par la clé de table** (`js/combat/enregistrement.js`), comme les
personnages en ligne (§ 7.2, § 15.8) : le combat porte des valeurs de la
banque, qui ne s'écrit jamais en clair sur un appareil.

- **Le format** : `{ mode, format: 1, sel, iterations, iv, chiffre,
  revision, enregistre_le }`. Le chiffrement est AES-GCM, avec la clé de
  table et un vecteur neuf de 12 octets à chaque écriture ; la donnée
  associée est `atelier-des-arpenteurs/combat/1/<mode>` ; le contenu est
  compressé en deflate-raw ; le sel et le nombre d'itérations sont ceux de
  la clé. C'est le modèle des personnages en ligne, sans ses deux gardes
  (« enregistré », « mode réel ») : un combat se chiffre aussi en
  démonstration, par la clé de la démonstration. Le clair est borné à
  8 Mo, à l'écriture comme à la lecture : la borne des personnages, 64 Ko,
  ne conviendrait pas (douze personnages et soixante adversaires approchent
  0,7 Mo).
- **L'enveloppe est une donnée venue d'ailleurs** : n'importe quel script
  du site a pu la poser dans la base, sans la clé. Chaque champ est donc
  borné avant d'être examiné. `sel`, `iv` et `chiffre` sont en base64
  strict, d'une longueur multiple de quatre et bornée avant tout
  parcours : 24 signes pour le sel, 16 pour le vecteur, 11 272 192 pour
  le chiffré, soit 8 Mo et 64 Ko d'octets, la marge d'un clair qui se
  compresse mal. **Ce qui ne se relirait pas ne s'écrit pas** : un combat
  dont le compressé, avec son étiquette, passerait cette borne est refusé
  à l'écriture, en jouant, et non au rechargement : la barre dit « Ce
  navigateur ne garde pas le combat » (tableau plus bas). **Rien de ce que
  porte une
  enveloppe ne fait lever la lecture**, si long ou si mal fait soit-il :
  le déchiffrement rend « illisible », le gardien de même sur toute levée
  qui lui échapperait, la révision lue reste connue, et « Nouveau combat »
  s'écrit par-dessus. Avant la relecture de fin de groupe, le motif qui
  reconnaissait le base64 débordait dès 4,48 Mo (sous Node) : la lecture
  levait, et l'écran restait sans combat ni bouton à chaque visite
  (§ 17.11).
- **Le lieu** : IndexedDB, base `atelier-des-arpenteurs-combat`, version 1,
  entrepôt `combats`, le mode pour clé. Un combat par mode : la
  démonstration ne touche jamais le combat réel. Jamais dans le coffre,
  jamais dans `localStorage`. La base ne s'ouvre qu'à la première visite de
  l'écran.
- **Le contenu** : la version des règles, la révision, la mise en place
  (les photographies, les cases, qui commence), puis la suite des
  événements, dés compris. La révision y est répétée, dans le chiffré, et
  comparée à celle de l'enveloppe : la donnée associée ne couvre que le
  mode.
- **L'état se recalcule en rejouant les événements** (`rejouer`), par le
  chemin même du jeu. Un rechargement reprend le geste où il en était,
  relance choisie comprise, **sans relancer un dé déjà lancé**. Ce qui
  n'est pas un événement ne se garde pas : hors d'un geste, l'écran revient
  à « Qui joue ? » ; d'où vient la cible choisie, une fiche ouverte, la
  liste d'une case s'oublient.
- **Rien de ce qui se relit n'est cru.** Avant tout rejeu, le contenu
  déchiffré se valide (`js/combat/forme.js`) : ses clés, elles seules ; les
  identifiants, leur compteur (99 999 au plus), les cases, les plafonds ;
  chaque photographie, par la fonction qui l'a jugée à l'ajout (§ 17.2) ;
  chaque événement, 5 000 au plus, et les valeurs d'un dé, cent au plus,
  comptées avant qu'une seule soit lue (§ 17.3). Au rejeu, le premier
  événement refusé arrête tout : la suite n'est jamais tronquée en
  silence. Un contenu refusé, ou un rejeu refusé, est
  une donnée abîmée.
- **La version des règles** est dans le contenu. Toute correction qui
  change un nombre, un mot du journal ou un moment la fait monter ; un
  combat d'une autre version ne se rejoue pas, et se dit. Elle vaut 1 ; le
  groupe 2 la passera à 2. Les corrections de la relecture de fin de
  groupe ne l'ont pas fait monter, bien que deux d'entre elles touchent le
  rejeu : la ligne d'un dé passé sous zéro s'écrit autrement (§ 17.9), et
  jouer un déplacement de puissance 0 est refusé (§ 17.6). Cela ne tient
  que si aucun combat n'a été gardé avant elles, hors des essais du lot ;
  sinon, elle doit monter. Choix fait seul, dit au compte rendu.

**Quand.** Après chaque événement, et après chaque changement de la
préparation, dans **une file à une seule place** : jamais deux écritures à
la fois. **L'écriture part un tour après la demande**, jamais dans le tour
du clic : la file est prise et « Enregistrement… » se dit dès la demande,
mais assembler le texte du combat, l'encoder et ouvrir la compression
attendent que l'écouteur du clic ait rendu la main (une microtâche n'y
aurait pas suffi). Les demandes venues d'ici là n'en font qu'une ; une
demande arrivée pendant une écriture attend qu'elle finisse, et la dernière
remplace celle qui attendait, puisque le contenu est cumulatif.
« Enregistrement… » paraît donc aussi, un instant, avant « Ce navigateur ne
garde pas le combat », quand c'est l'assemblage qui échoue. Avant la
relecture de fin de groupe, cette première part s'exécutait dans l'écouteur
même du clic : environ 7 ms sur les 32 ms d'un clic dans Edge, mesurés
(§ 17.11). À l'ouverture de l'écran sans combat en mémoire (après un
rechargement), le combat gardé se relit ; un chargement attend la fin
d'une écriture en vol, et une base retrouvée vide remet la révision connue
à 0. La clé n'est copiée nulle part : elle se relit dans l'état de la page
à chaque écriture.

**La révision.** Chaque écriture l'augmente de 1. Elle se fait en une seule
transaction, qui lit la révision gardée, la compare à celle qu'on attend,
et n'écrit que si elles sont égales ; le chiffrement précède la
transaction, qui ne survivrait pas à une attente. **Un onglet qui trouve
une autre révision n'écrase rien** : il le dit, ne joue plus, et propose
« Reprendre le combat le plus récent ». **La révision ne redescend
jamais** : « Nouveau combat » n'efface pas l'enregistrement, il écrit un
combat vide à la révision suivante. Une révision qui ne se lit pas vaut 0,
pour la lecture comme pour l'écriture : une donnée abîmée jusque dans sa
révision reste remplaçable. **Elle est bornée à 2^40** (posée par la
relecture de fin de groupe ; § 12, à confirmer) : mille milliards de crans
ne s'atteignent pas en jouant, mais la révision est en clair dans
l'enveloppe, hors de ce que le chiffrement protège. Posée au-delà à la
main, elle vaut 0, l'enveloppe est une donnée abîmée, et « Nouveau
combat » s'écrit à la révision 1. À sa borne même, la révision suivante
repart de 1, l'écriture attendant toujours, exactement, la révision
connue : c'est la seule entorse à « ne redescend jamais », et seule une
enveloppe posée à la main y mène. Sans cette borne, une révision de
2^53 − 1 rendait le combat illisible, et plus rien ne s'écrivait pour ce
mode, rechargement après rechargement.

**Les cas, et ce que dit la barre de titre.** Les cinq premières phrases
sont de la mission ; « … version plus récente … », « … autre version du
simulateur … » et « Combat non gardé : … » ne le sont pas, et restent à
confirmer par l'auteur.

| Cas | La barre de titre | On joue ? |
|---|---|---|
| le combat est écrit | « Combat gardé sur cet appareil » | oui |
| une écriture est en cours | « Enregistrement… » | oui |
| pas d'IndexedDB, ou une ouverture de la base bloquée ou refusée ; une écriture qui échoue (quota, base fermée) ; un combat de plus de 8 Mo, ou dont le compressé ne se relirait pas | « Ce navigateur ne garde pas le combat » | oui, en mémoire ; plus rien ne s'écrit |
| un autre onglet a écrit : la révision gardée n'est pas celle qu'on attend | « Combat ouvert ailleurs », avec « Reprendre le combat le plus récent » | non, tant qu'on n'a pas repris ; le panneau d'action le dit |
| à l'ouverture : un sel ou un nombre d'itérations qui ne sont pas ceux de la clé (le mot de passe de table a changé) ; ou une enveloppe malformée, un chiffré abîmé, un autre mode, un contenu qui ne se décompresse pas, ne se lit pas ou est refusé, une révision qui ne concorde pas, un rejeu refusé | « Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée). », avec « Nouveau combat » | après « Nouveau combat », qui s'écrit toujours |
| à l'ouverture : une enveloppe d'un format plus récent | « Ce combat vient d'une version plus récente de l'Atelier : rechargez la page. » | non ; rien ne s'écrit par-dessus |
| à l'ouverture : un contenu d'une autre version des règles | « Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas. », avec « Nouveau combat » | après « Nouveau combat » |
| la banque est ouverte sans clé (le mot de passe a changé pendant la visite) | la phrase « ne se lit plus » s'il y a un combat gardé, sinon « Combat non gardé : le mot de passe de table a changé. » | oui, en mémoire ; rien ne se lit ni ne s'écrit |

Un format plus récent se reconnaît avant tout autre examen : le dire
« abîmé » offrirait « Nouveau combat », qui l'écraserait. De même une autre
version des règles, avant que la forme du contenu soit jugée : un contenu
du groupe 2 peut porter une clé de plus, ce n'est pas une donnée abîmée.

- **« Oublier le mot de passe »** (§ 7.2) efface le combat de la mémoire,
  comme l'espace auteur. Le combat chiffré reste, illisible sans la clé.
- **« Nouveau combat »** demande une confirmation dans la page (« Effacer
  ce combat et son journal ? »), puis repart de zéro. Il est inactif quand
  le combat est ouvert ailleurs, ou vient d'une version plus récente : rien
  ne s'y écrirait.
- **Les dés.** L'écran tire les siens par `crypto.getRandomValues`, sans
  biais de modulo (§ 17.1). Les contrôles et le banc ont une source de dés
  imposés, que l'écran n'expose pas.

### 17.9 Le journal

Il y a **une ligne par geste fini**, au présent, en texte simple
(`js/combat/journal.js`). **Le texte est exact** : les contrôles et le banc
le comparent mot pour mot, au signe près.

- Une ligne est une fonction du geste fini, des noms figés au lancement et
  des photographies : le geste garde le prix payé, le jet, ses sources,
  l'avant et l'après de ce qu'il a changé. La même ligne sort donc en jeu
  et au rejeu.
- Rien ne vient de l'appareil : ni heure, ni langue, ni hasard.
- Les signes (→, ✓, ✗, −, —, ·) sont donnés par leur code dans le code,
  pour qu'aucun éditeur ne remplace l'un par son voisin ; **toute espace
  est une espace ordinaire**, « n° 1 » et « 21 h 30 » compris.
- Les noms (protagonistes, capacités, zones, armes, raisons) sont des
  données hostiles, écrites telles quelles ; c'est l'écran qui en ôte les
  signes qui commandent le sens de l'écriture (§ 10.1), sur le texte
  entier, au moment de copier ou de télécharger.

**Les gabarits de la mission**, illustrés par la démonstration.

*Le cadre.*

- Le lancement : « Combat lancé : 1 personnage contre 3 adversaires. Les PJ
  commencent. » (« 2 personnages », « 1 adversaire » ; ou « Les adversaires
  commencent. »).
- Un tour : « — Tour 1 · camp des PJ — », « — Tour 1 · camp des
  adversaires — ».
- La fin d'un tour de camp : « Fin du tour des PJ : ils retrouvent leurs
  actions. », de même pour les adversaires.
- La fin : « Combat terminé : victoire des PJ. »

*Les noms et les capacités.*

- On écrit le nom court (§ 17.2). Une capacité qui évolue porte « [P] ».
- **Entre parenthèses**, après la capacité, séparés par « , » : l'arme, si
  plusieurs armes donnent la capacité ; puis le coût payé, s'il n'est pas
  nul : « (4 souffle) », « (1 souffle, 1 lien) », « (Pinces de homard,
  2 souffle) ». Pour un adversaire, après le coût et « ; » : « coût en lien
  non payé : un adversaire n'a pas de lien ».
- **La cible** : « contre » un adversaire du lanceur, « sur » un allié ou
  sur lui-même. Sans cible, rien.

*Les gestes.*

- Un déplacement : « Aubépine : Pas chassé [1], C3 → D4. » ; payant :
  « Chef : Pas chassé [2] (1 souffle), F6 → D4. »
- Passer : « Marmiton n° 2 passe son tour. »
- Une capacité sans jet : « Aubépine : Fournaise [1] (1 souffle,
  1 lien). »
- Un jet de caractéristique, sous le nom que la banque donne à la
  capacité : « Aubépine : Goûter, d6−1 (Sens + Savoir sauvage) contre 6
  (compliqué) → 5 explose, + 6 = 11 ✓, 5 explose, + 2 = 7 ✓, 2 ✗ :
  2 réussites. » Sans réussite : « : aucune réussite. »
- Une attaque à mains nues : « Aubépine : Taloche [1] contre Marmiton
  n° 2. d8+1 (Force + Agilité) contre 5, 1 avantage → … »

*Le jet.*

- **Les sources d'avantage et de désavantage** : celle d'un passif, son
  nom ; celle d'un désavantage de maîtrise, « {capacité} hors maîtrise » ;
  celle qui vient de l'autre protagoniste, suivie de « de {nom court} » ;
  celle qui vient de la main, « à la main : {raison} ».
- **Quand le jet a des avantages et des désavantages**, une phrase vient
  avant lui, et avant « lance sa défense » : « Son avantage (Solo du chef)
  et son désavantage (Émincer hors maîtrise) s'annulent. » ; au pluriel :
  « Ses 2 avantages (Solo du chef, Moulinet farineux hors maîtrise de
  Marmiton n° 2) et son désavantage (types d'armure mêlés) laissent
  1 avantage. »
- **Le dé** : « d10+1 contre 5 ». Le modificateur est la somme nette :
  « d6−1 » avec une blessure, « d10 » s'il est nul. Un modificateur à la
  main se dit après la difficulté : « d8+2 contre 5 (+1 à la main :
  Minutie) ». Le reste net d'avantages ou de désavantages suit, s'il n'est
  pas nul : « , 1 avantage », « , 2 désavantages » ; celui qui vient de la
  main y porte sa source : « , 1 avantage (à la main : Minutie) ».
- **Les dés** : « → », puis les dés, valeurs modificateurs compris, chacun
  suivi de ✓ ou ✗ : « 5 ✓, 9 ✓, 4 ✗ ». Une relance : « 4 ✗, relancé
  6 ✓ ». Un dé à désavantage : « 9/3 → 3 ✗ ». Une explosion : « 5 explose,
  + 6 = 11 ✓ » ; enchaînée : « 7 explose, + 6 explose, + 2 = 15 ✓ ». Une
  valeur passée sous zéro (un 1 tiré avec deux blessures, sans bonus)
  porte le moins du journal, celui du modificateur, jamais un trait
  d'union : « −1 ✗ ». Avant la relecture de fin de groupe, elle s'écrivait
  par la simple conversion du nombre.
- **L'ordre des parenthèses** après la difficulté : le libellé, puis le
  réglage à la main : « d8+2 (Sens + Parole) contre 6 (compliqué, +1 à la
  main : Minutie) ».

*Le bilan.*

- D'une attaque : « : 2 réussites, B = 8 » ; « : aucune réussite,
  manqué. »
- D'une capacité sans dégâts : « : 1 réussite, touché ».
- D'une défense : « Aubépine lance sa défense, d8+1 contre 5 → 5 ✓, 4 ✗ :
  1 réussite, Aubépine reçoit B = 12. » ; « : aucune réussite, Aubépine
  reçoit C = 19. » ; « : 3 réussites, aucun dégât. »
- D'une défense contre une attaque sans arme, aux dégâts saisis : « … :
  1 réussite, Aubépine reçoit 4 (à la main : Frappe). »
- Des dégâts fixés à la main : « , ajusté à 20 (Émincer) ». Deux nombres
  ne se confondent pas : après une lettre, les dégâts de ce rang, avant
  toute opération ; après « ajusté à », le nombre saisi (« B = 8, ajusté à
  20 (Émincer) »).
- Les dégâts de l'arme prêtée : « , dégâts de l'arme : B = 8 ».
- « Dégrossir » : « , +2 contre l'armure (Réduction) ».

*La localisation.*

- « Localisation d20 → 14 : jambe droite. » Avec plusieurs dés :
  « Localisation 2 d20 → 6 : torse ; 13 : jambe gauche. »
- La face de contre-attaque : « Localisation d20 → 20 : contre-attaque,
  l'attaque est annulée. » ; parmi plusieurs dés : « Localisation 2 d20 →
  6 : torse ; 20 : contre-attaque, l'attaque est annulée. »
- Une face décalée : « Localisation d20 → 14, décalée à 12 (Minutie) :
  jambe gauche. »
- **Le nom de la zone** : celui des personnages si la zone est reconnue,
  même à deux lettres près (« Jambre droite » s'écrit « jambe droite ») ;
  sinon, le nom écrit. Minuscule initiale, sauf en tête de phrase.

*Les suites.*

- Une intervention : « Aubépine intervient : Pas de côté (1 action,
  3 souffle), 12 → 9. » Sur plusieurs zones : « Aubépine intervient : Pas
  de côté (1 action, 7 souffle), torse 5 → 0, jambe gauche 5 → 3. »
- **Les dégâts appliqués** : seuls figurent ce qui change, la première
  partie avec une majuscule. « Armure 10 → 1. » ; « Armure 5 → 0,
  résistance 5 → 0, corps 10 → 0. » ; armure déjà nulle : « Résistance
  5 → 0. » ; sur plusieurs zones : « Torse : armure 30 → 22. Jambe
  gauche : armure 10 → 2. »
- **Une blessure**, quand la résistance d'une zone tombe à 0 : d'un
  personnage, « Blessure (jambe gauche) : −1 à ses jets. », puis « Blessure
  (bras gauche) : −2 à ses jets. » ; d'un adversaire, « Blessure (jambe
  droite), sans effet calculé. » ; rien, si le coup tue.
- La mort : « Marmiton n° 1 meurt. »

**Là où la mission permettait deux lectures**, le combat de référence
(§ 17.10) en retient une, à confirmer par l'auteur :

- un avantage ou un désavantage seul s'écrit « , 1 désavantage », sans sa
  source ; les sources ne se nomment que dans la phrase d'annulation, ou
  pour la main ;
- un dé à désavantage s'écrit avec ses lancers, modificateurs compris, dans
  l'ordre où ils tombent, puis le pire : « 7/10 → 7 ✓ » ;
- dans la phrase des sources, celles du lanceur viennent d'abord, puis
  celles qui viennent de l'autre protagoniste ;
- « {capacité} hors maîtrise » s'écrit sans « [P] » ;
- une explosion s'écrit avec sa première valeur modificateur compris, puis
  les ajouts bruts ;
- une relance refusée ne laisse pas de trace : le dé gardé s'écrit comme un
  échec, « 5 ✗ » ;
- avec deux avantages ou plus, un dé relancé qui échoue encore se relance,
  tant qu'il reste une relance : « 3 ✗, relancé 4 ✗, relancé 7 ✓ ». La
  mission dit « k relances pendant le jet », sans dire si un même dé en
  reçoit plusieurs ; le combat de référence n'a jamais deux relances, et
  c'est un contrôle du jet et un contrôle du journal qui tiennent cette
  lecture (§ 12, point 46) ;
- après un jet qui a touché, une face de contre-attaque laisse le bilan tel
  quel (« Aubépine reçoit C = 19. »), et rien ne suit la phrase de la
  localisation qui annule ;
- le combat finit sans « Fin du tour » ;
- une capacité que donnent l'arme tenue et une arme au sac ne porte pas le
  nom de l'arme entre parenthèses : l'arme au sac ne donne rien ;
- les caractéristiques d'un dé au choix s'écrivent dans l'ordre de la liste
  des neuf (§ 15.2), non dans celui du choix ;
- « Fin de tour », par le bouton, écrit la même ligne que la fin
  automatique.

**Les gabarits que la mission ne donne pas.** Un seul texte par cas ; ils
ont été écrits avec le journal, un contrôle les tient, et **ils restent à
confirmer par l'auteur**. Le combat de référence n'emploie que les deux
premiers.

| Cas | Texte |
|---|---|
| la source du désavantage des types d'armure mêlés | « types d'armure mêlés » |
| une face de contre-attaque après un jet qui a touché | le bilan reste tel quel (lettre, ajustement, « dégrossir ») ; rien ne suit la phrase de la localisation |
| un passif de niveau N > 1 dans la phrase des sources | cité une fois, compté N fois : « Ses 2 avantages (Solo du chef) et son désavantage (types d'armure mêlés) laissent 1 avantage. » |
| la phrase des sources, quand il reste des désavantages | « Son avantage (…) et ses 2 désavantages (…, …) laissent 1 désavantage. » |
| le net, quand la phrase des sources a déjà nommé la main | « , 1 avantage », sans redire la main |
| le net, sans phrase des sources, quand la main n'en donne qu'une part | « , 2 avantages (dont 1 à la main : Minutie) » |
| une seule caractéristique choisie | « d8 (Sens) contre … » |
| une valeur de dé passée sous zéro | le moins du journal devant la valeur, partout où une valeur s'écrit : « −1 ✗ » ; « 3 ✗, relancé −1 ✗ » ; « 0/−1 → −1 ✗ » ; « −2 explose, + 1 = −1 ✗ » |
| plusieurs relances sur un même dé | « 3 ✗, relancé 4 ✗, relancé 7 ✓ » |
| une défense qui touche, sans dégâts ni nombre saisi | « 1 réussite, touché » ; « aucune réussite, touché » |
| une défense contre un jet prêté, « Dégâts de l'arme » | « 1 réussite, touché, dégâts de l'arme : B = 12 » |
| une attaque ou un jet prêté d'un personnage, sans dégâts, puis un nombre saisi | « 1 réussite, touché, ajusté à 4 (Fournaise) » |
| une défense sans réussite contre une attaque aux dégâts saisis | « aucune réussite, Aubépine reçoit 4 (à la main : Frappe) » |
| des dégâts directs, à la place de « , ajusté à … » | « , dégâts directs à la résistance : 4 (Frappe) » ; « , dégâts directs au corps : 4 (Frappe) » ; en défense sans dégâts propres, le nombre n'est dit qu'une fois : « 1 réussite, touché, dégâts directs à la résistance : 4 (Frappe) » |
| le jet prêté d'un adversaire qui a plusieurs armes | le nom de l'arme prêtée entre en tête de la parenthèse : « (Pinces de homard, 2 souffle) » ; si la capacité a elle-même plusieurs armes, celle de la façon d'abord, puis l'arme prêtée si c'en est une autre |
| un coût en lien non payé | seul dans sa parenthèse : « (coût en lien non payé : un adversaire n'a pas de lien) » ; après un coût, le point-virgule entre deux espaces, comme partout au journal : « (5 souffle ; coût en lien non payé : un adversaire n'a pas de lien) » |
| l'esquive, dès que le geste a plusieurs dés de localisation | chaque coup qu'elle change porte sa zone, même s'il est seul : « Aubépine intervient : Pas de côté (1 action, 3 souffle), torse 12 → 9. » |
| les dégâts sur plusieurs dés, dont certains ne changent rien | la forme « Torse : … » reste ; un coup sans changement ne s'écrit pas |
| plusieurs blessures dans un même geste | une phrase par zone, dans l'ordre des dés : « Blessure (jambe gauche) : −1 à ses jets. Blessure (torse) : −2 à ses jets. » ; aucune si le geste tue |
| la face de contre-attaque avant le dernier dé | « Localisation 3 d20 → 6 : torse ; 20 : contre-attaque, l'attaque est annulée. » : le nombre est celui des dés du geste, les dés écrits sont ceux qui ont été lancés |
| deux armes de même nom chez un adversaire | « Spatule souple », « Spatule souple (2) » |
| l'heure avant dix heures | « à 9 h 05 » ; le fichier : `combat-2026-10-12-09h05.txt` |

Les phrases que dit la région d'annonce (§ 17.7) et quelques textes des
vues (le bilan pendant la chaîne, les libellés des dégâts à fixer, les
quatre lignes d'aide, les raisons hors mission) ne viennent pas non plus de
la mission : le compte rendu du groupe les liste.

**Le texte copié ou téléchargé** commence par cet en-tête, suivi d'une
ligne vide :

```
Simulateur de combat — L'Atelier des Arpenteurs
Combat lancé le 12/10/2026 à 21 h 30 (démonstration)
Personnages : Aubépine Crèmebrûlée
Adversaires : Chef de partie ; Marmiton de corvée n° 1 et n° 2
```

- La deuxième ligne ne finit par « (démonstration) » qu'en démonstration.
  L'heure est l'heure locale du lancement, telle que l'appareil qui a lancé
  l'a écrite : elle se découpe comme un texte, sans passer par une date,
  qui dépendrait du fuseau de l'appareil qui relit.
- Les personnages et les adversaires y portent leur nom entier ; un
  adversaire y figure une fois, suivi des numéros de ses exemplaires
  (« n° 1, n° 2 et n° 3 »).
- **« Copier »** : le texte, en fins de ligne LF. Si le presse-papiers
  refuse, le texte se sélectionne dans un champ, pour une copie à la main.
  Sous Windows, Edge et Chrome rendent ce texte en fins de ligne CRLF,
  qu'ils convertissent eux-mêmes ; Firefox le rend tel qu'il est écrit
  (vu le 12/10/2026, § 17.11).
- **« Télécharger »** : le fichier `combat-AAAA-MM-JJ-HHhMM.txt`, à la date
  et à l'heure du lancement, en UTF-8 avec sa marque d'ordre des octets et
  en fins de ligne CRLF, par `telecharger()` de `dom.js` (§ 10.1). Seuls
  les chiffres d'une heure bien formée entrent dans le nom du fichier.

### 17.10 La démonstration, le combat de référence et le banc

**La démonstration** a reçu ce qui manquait au simulateur (§ 10.3, § 15.7,
§ 16.7) : les éléments Intervention et Passif, et deux capacités du bloc de
base, Pas de côté et Guetter. Aucune valeur d'un adversaire n'en change.
Elle permet un combat complet : Aubépine contre le Chef de partie et deux
Marmitons de corvée. Elle n'a ni paramètre `loc_multiple`, ni élément
« Localisation multiple » ou « Centré », ni bloc de type État : ces cas, et
les rôles qu'elle n'a pas (bonus de Précision, petit, esprit de corps), se
contrôlent sur des banques fabriquées en mémoire et sur des photographies
écrites à la main (`tests/outils/photographies_essai.js`).

**Le combat de référence fictif** (`tests/outils/combat_reference.js`) est
ce combat-là, dans la démonstration, sans en changer aucune valeur : le
pendant fictif du combat de la maquette.

- **Ses valeurs attendues ont été calculées à la main, d'après la mission,
  avant le code** : composé une fois, puis recalculé deux fois sans voir le
  résultat ; les trois calculs donnent les mêmes trente-six lignes, au
  signe près, et le même état final. **Il est arrêté** : le fichier est une
  transcription, que rien ne retouche d'après ce que rend le moteur. Un
  écart est un défaut du moteur, ou une lecture à porter devant l'auteur.
- **Son déroulé** : vingt-cinq étapes, dont sept fins automatiques de
  tour, sur cinq tours ; 105 événements, dont 48 événements de dé (37 de
  chaîne, 11 de localisation), qui portent 50 lancers : deux dés lancés
  sous désavantage donnent chacun deux valeurs. Les dés sont donnés bruts,
  dans l'ordre où ils tombent.
- **Ce qu'il couvre** : les ajouts posés d'office (A1, J1, J2, J2), puis
  déplacés ; un déplacement gratuit et un déplacement payant ; un avantage
  et un désavantage de maîtrise qui s'annulent ; des dégâts fixés à la
  main, et « dégrossir » ; une mort par l'armure, la résistance et le
  corps ; un coup sur une zone sans armure d'un adversaire, et sa blessure
  sans effet calculé ; deux coups sur une même zone d'Aubépine, le premier
  vidant l'armure, le second la résistance, puis un jet d'Aubépine à −1 ;
  une défense avec relance d'avantage, venue par inversion du désavantage
  de maîtrise d'un Marmiton, et une défense à trois réussites ; une
  esquive pendant le tour adverse, et l'action qui manque ensuite ; une
  capacité sans dégâts jouée avec un jet d'attaque, et sa localisation ; un
  dé explosif, deux fois ; un jet de caractéristique et une attaque à mains
  nues ; une face de contre-attaque qui annule une attaque déjà payée ;
  « Passer son tour », la fin automatique des tours, « Fin de tour » ; la
  fin du combat.
- **Son état final** : Aubépine en D4, 0 action sur 2, 2 de souffle sur
  10, 0 de lien sur 1, 4 de corps sur 10, deux blessures ; les trois
  adversaires morts, aux tours 2, 5 et 5.
- **Un lecteur de scénario** (`tests/outils/scenario.js`) le traduit en
  événements : un scénario s'écrit avec des noms et des dés tels qu'ils
  tombent ; tous les dés d'une liste sont lancés, et aucun autre ; un dé de
  trop, un dé qui manque ou un événement refusé arrête tout, en citant le
  geste. Le même lecteur sert au banc.
- **Il est retrouvé mot pour mot à chaque étage** : par le moteur, sur la
  banque de démonstration publiée, avec ses cases d'office et son état
  final ; par le journal seul, sur des gestes écrits à la main ; par la
  séance, puis par l'écran, du premier clic au dernier, sur des dés
  imposés.

**Le banc sur le vrai classeur** : `node tests/banc_combat_reel.js
<classeur> <scénario>`, hors de `node --test`, comme le banc du § 6.3.

- **Le scénario** est le combat de référence de la mission, celui de la
  maquette. Il porte des noms du classeur : il s'écrit en JSON dans
  `plans/`, hors dépôt, et le banc lui-même n'en garde aucun.
- **Le banc** importe le classeur ; dit les rôles câblés absents de la
  banque, qui doivent être aucun ; photographie les personnages du scénario
  et ses adversaires, et, pour ce seul contrôle, chaque adversaire complet
  du classeur : un texte qui sortirait des bornes d'une photographie se
  voit ainsi avant de se voir à l'écran ; rejoue le combat avec ses dés
  imposés ; compare le journal, ligne à ligne, et l'état final à ceux du
  scénario ; vérifie que le combat, tel qu'il serait gardé, se relit et se
  rejoue à l'identique ; et, arrêté au moment que montre la maquette,
  compare ce qu'il attend et ce qu'il montre.
- **Un écart n'est pas un échec** : l'auteur a pu modifier son classeur
  depuis que le scénario a été écrit. Le banc dit chaque écart, et les
  valeurs de départ qui aident à l'expliquer ; il ne corrige rien. Il rend
  1 seulement s'il ne peut pas jouer le combat, 2 s'il lui manque un
  argument.
- **Les valeurs de départ** d'un protagoniste disent ses actions, son
  souffle, son corps, son jet, ses armes, ses passifs câblés et ses
  zones : chacune avec ses faces et son armure, dans l'ordre du d20, puis
  la face de contre-attaque. Les faces y sont depuis la relecture de fin
  de groupe : sans elles, la localisation était la seule valeur du
  journal qui ne se recalculait pas d'après la sortie du banc. Un contrôle
  tient cette écriture sur trois protagonistes de la démonstration : chaque
  face du d20, hors celle de la contre-attaque, y est une fois.

### 17.11 Les mesures

Toutes les mesures sont du 12/10/2026, sur le poste de l'auteur. Chacune
dit son outil, sa méthode et sa réserve ; ce qui n'est pas mesuré est dit
à la fin.

**Les contrôles.** 1 392 contrôles au commit `fda3a2a` (deux processus,
168 secondes), aucun échec, dont 934 neufs depuis les étapes 1 et 2 (458
au commit `40db3a0`) ; 1 476 au commit `c4cff7d` (deux processus, 190
secondes), aucun échec. Chaque règle y est vue dans les deux sens, dans
le contrôle même : le cas qui passe, et le cas refusé. Ce n'est pas la
mise à l'épreuve « armé puis désarmé » du § 0, qui casse le code pour
voir le contrôle échouer : celle-là est dite plus bas.

**Le combat de référence fictif** sort du moteur mot pour mot : ses
trente-six lignes, son état final, ses cases d'office (§ 17.10).

**Le rejeu**, sur ce combat : les 106 états intermédiaires rejoués égalent
ceux tenus un événement à la fois ; sur ses 86 moments en plein geste,
l'offre est la même après rejeu et après un passage par JSON, et le geste
tient autant de dés que d'événements de dé. Au hasard (graine écrite, 200
suites de 25 événements, bien et mal formés, parties d'un moment quelconque
du combat) : 2 877 événements acceptés, 2 123 refusés (761 pour leur forme,
1 211 hors du moment, 69 hors bornes, 82 interdits), les quinze types
acceptés au moins une fois ; le moteur ne lève jamais, un refus rend l'état
reçu, aucune ressource ne passe sous 0, et un événement fabriqué d'après
l'offre n'est jamais refusé.

**Le banc sur le classeur réel**, le 12/10/2026, hors dépôt : **aucun
écart**. Les dix-neuf lignes du journal de la mission, mot pour mot ;
l'état final ; le moment de la maquette (deux dés lancés, la relance à
lancer, quinze lignes au journal, les six protagonistes comme attendu) ;
aucun rôle câblé absent (quatorze noms reconnus par leur empreinte) ; les
trois adversaires complets du classeur se photographient ; le combat gardé
(63 événements, 57 Ko) se relit et se rejoue. Vu au passage : la capacité
de déplacement y évolue, et aucun passif câblé n'y est au niveau 0, si bien
que les deux cas laissés au § 12 (un passif câblé au niveau 0, point 45 ;
un déplacement qui n'évolue pas) ne s'y présentent pas. Relancé après
chaque série de corrections de la relecture de fin de groupe, il reste
sans écart ; ses valeurs de départ portent depuis les faces de chaque
zone (§ 17.10).

**Les noms du vrai classeur.** Les 139 noms du classeur (blocs,
capacités, types, adversaires) sont cherchés un à un, par un script hors
dépôt qui n'en garde aucun, dans tout ce que le lot ajoute. Avant le
commit `fda3a2a`, un nom entré par un exemple de la mission a ainsi été
retiré de trois fichiers de contrôles. **Cette recherche n'avait pas tout
vu** : la relecture de sécurité a trouvé un nom de capacité, entré par un
exemple de la mission, dans deux lignes d'un contrôle de l'écran, au
commit `fda3a2a`, déjà envoyé. Le commit `c4cff7d` le remplace par un nom
de la démonstration ; **il reste dans l'historique public du commit
`fda3a2a`**. L'en retirer demanderait de réécrire cet historique :
décision de l'auteur, au compte rendu. Une arme fabriquée pour un contrôle
des adversaires portait deux mots du classeur : elle a été renommée avant
d'être commitée. Le reste de ce que le script relève est sans objet : des
mots courants du français, des noms d'éléments, permis en clair (§ 17),
et **huit des quatorze libellés de rôle** du tableau du § 17.6, qui ont
par nature la clé du nom qu'ils désignent, et que la mission ordonne. Les
messages des deux commits que le lot comptait alors, relus de même, ne
portent que des mots courants.

**Les modules d'avant** : ce que rendent la résolution et la fiche est
inchangé, les champs neufs mis à part (85 adversaires, 7 fiches) ; la
cellule forgée de cent trente mille objets que tient un contrôle du lot 3
se résout dans le même temps (353 ms avant, 358 après, à froid).

**Sous Node, hors navigateur**, à titre indicatif, au commit `fda3a2a` (un
personnage et six adversaires) : rejouer 1 009 événements, 17 ms ; un dé
qui finit un geste, puis le calcul de l'offre, moins de 0,5 ms, au
centième événement comme au millième. Douze personnages et soixante
adversaires approchent 0,7 Mo en clair, sous la borne de 8 Mo.

**Les mises à l'épreuve du moteur**, armé puis désarmé (§ 0).

- **La méthode.** Un seul lanceur, hors dépôt, joue une liste de casses
  l'une après l'autre sur une copie du dépôt hors de OneDrive (§ 10.3),
  remise à l'image du dépôt avant chaque liste. Une casse change un
  fragment d'une seule ligne du code ; le lanceur dit si un contrôle l'a
  vue. Un seul processus de contrôles à la fois, un seul lanceur à la
  fois. Les contrôles passent d'abord sur la copie intacte : c'est le
  désarmé. Rien ne s'écrit dans le dépôt.
- **Six groupes**, sur le code du commit `fda3a2a` :

| Groupe | Casses | Vues d'emblée | Non vues au premier passage | Ce qu'elles sont devenues |
|---|---|---|---|---|
| les jets, les valeurs, les circonstances | 166 | 162 | 4 | 4 vues, par un contrôle ajouté ou complété |
| les règles, la forme, le plateau, les noms, la préparation, les dés | 212 | 201 | 11 | 11 vues, par un contrôle ajouté |
| les dégâts et le journal | 202 | 198 | 4 | 3 vues, par un contrôle ajouté ; 1 équivalente |
| l'offre et le moteur | 120 | 110 | 10 | 4 vues par un autre fichier de contrôles du groupe, 3 par un contrôle ajouté ; 3 équivalentes |
| les rôles, les photographies, les personnages disponibles ; la résolution, la fiche, la carte, la rencontre | 122 | 91 | 30 | 27 vues par un contrôle ajouté, 1 par un contrôle qui existait dans un autre fichier ; 2 ne changent rien hors du mode réel |
| les vues, la séance, l'enregistrement | 208 | 185 | 16 | 15 vues, par un contrôle ajouté ; 1 équivalente |
| **en tout** | **1 030** | **947** | **75** | 68 vues, 5 équivalentes, 2 en mode réel |

- Huit casses sont hors de ces colonnes : sept « en délai », dans le
  dernier groupe (plus bas) ; une, écrite au second passage du cinquième,
  vue. **Hors de ce compte**, jouées et vues : 45 casses de complément sur
  l'offre et le moteur, et 2 écrites pour voir mordre des contrôles
  ajoutés. Non jouées : 62 casses écartées de la liste des photographies
  pour tenir sa taille.
- **Ce qu'elles ont fait écrire** : 56 contrôles, dont 2 se jouent chacun
  sur deux lieux ; des lignes de plus dans 4 contrôles qui existaient ; des
  bornes aux attentes de deux fichiers de contrôles. **Aucun défaut du
  code n'a été révélé** : écrits d'après la mission et le contrat, ces
  contrôles passent tous sur le code intact.
- **Les cinq équivalentes**, chacune avec sa preuve, ne changent aucun
  comportement atteignable : un plancher du nombre de d20, que la
  validation d'une photographie tient déjà ; la cible d'un jet, exigée à
  deux endroits (deux casses) ; une comparaison dont le moteur n'atteint
  jamais la borne ; une condition de la file des écritures, que l'oubli
  rend déjà fausse.
- **Les deux casses du mode réel** lui retirent toute reconnaissance par
  empreinte. Les voir dans le dépôt demandait un nom du vrai classeur :
  seul le banc, hors dépôt, tenait alors cette reconnaissance. Depuis la
  relecture de fin de groupe, un contrôle la tient sur un tableau d'essai
  (§ 17.6), vu armé par trois casses.
- **Sept casses de l'enregistrement faisaient tourner son fichier de
  contrôles sans fin**, au lieu de le faire échouer. Aucune n'est une
  boucle sans fin du code : toutes sont une attente du contrôle sur un
  événement que le code cassé ne produit plus. Par le crochet, la même
  casse aurait retenu un envoi sans rien dire. Les attentes sont bornées
  (30 secondes par contrôle, 5 par attente) ; rejouées, les sept
  échouent en 15 à 33 secondes, chacune sur un contrôle nommé.
- **Ce que ces casses n'éprouvent pas.** Une casse ne change qu'une
  ligne : l'ordre des modificateurs, celui des sources et la place de la
  main en dernier demanderaient d'en échanger deux. « Rien en clair » et
  « jamais dans le coffre ni dans `localStorage` » ne se cassent qu'en
  ajoutant du code : leurs contrôles n'ont été vus armés par aucune casse
  de ces six groupes. Et les casses d'un groupe ne sont jouées que contre
  les contrôles des modules qu'il vise.
- Vu au passage, hors du lot : un contrôle du lot 3, qui borne à cinq
  secondes la résolution d'une cellule de cent trente mille objets, a
  échoué une fois sous la charge d'un autre lanceur, et passe seul ; il
  n'est pas touché. Un contrôle du lot 2 bis, qui attendait une durée
  fixe, a été corrigé (§ 13).

**Les corrections de la relecture, mises à l'épreuve** par le même
lanceur : 72 casses, 72 vues, aucune en délai. Quarante pour le moteur (le
signe moins d'un dé, les annonces, les passifs d'un adversaire, le tableau
des rôles, les maîtrises, les noms, le niveau 0, le déplacement sans case,
les plafonds, la double relance, le départ du banc) ; trente-deux pour
l'enregistrement et les bornes (l'enveloppe longue, le rejeu, les tirages
et les façons, la révision, le compteur, la source d'un adversaire, le
départ de l'écriture).

**Les contrôles de l'écran ne sont pas mis à l'épreuve**, à l'écriture de
ce paragraphe : ni les cinq modules de `js/ecrans/`, ni `css/combat.css`,
ni le câblage d'`application.js`. N'en est connu que ceci. Les contrôles
ajoutés ou retouchés par le regard sur la maquette, lancés sur une copie
du code d'avant, échouent à 16 sur 148, et passent tous sur le code
corrigé. Les trois corrections faites pendant les mesures ont chacune
leur contrôle, vu échouer sur l'ancien code. Un relecteur a joué un
échantillon de 81 casses sur les modules de l'écran et la feuille : 70
vues, 11 non vues ; les règles que rien ne tenait sont à la liste des
corrections de l'écran (§ 14). **À faire avant la fin du groupe.**

**Dans de vrais navigateurs** : les conditions, pour tout ce qui suit.
Edge 155.0.4283.45 (Chromium), piloté par le protocole DevTools, et
Firefox 143.0.4, piloté par WebDriver BiDi ; sans fenêtre, un navigateur à
la fois, sur des profils jetables ; Node 24.21. Le site est servi par le
serveur local du dépôt, la démonstration ouverte par son mot de passe
public. Un script par mesure, hors dépôt (`plans/`). Trois combats, tirés
à graine écrite et joués par le moteur lui-même dans la démonstration,
validés et rejoués avant d'être écrits : 300 événements et 15
protagonistes (graine 7) ; 1 000 événements, 15 protagonistes, 152 775
octets, 497 lignes de journal (graine 368) ; un combat ordinaire de 300
événements et 4 protagonistes (graine 1). **Trois réserves valent pour
toutes ces mesures :**

- **le poste était chargé** par d'autres agents, dont les contrôles
  tournaient : le rejeu sous Node, témoin de la charge, a varié de 63 à
  251 ms d'une passe à l'autre ;
- **un navigateur sans fenêtre n'a pas d'écran** : le temps de peinture
  n'est pas mesuré. De l'événement à l'image suivante, les nombres relevés
  (médiane 67 ms dans Edge, 82 à 130 ms dans Firefox) ne sont pas à
  retenir, non plus que ceux de l'API Event Timing (104 ms de médiane pour
  30 ms de traitement) ;
- **elles précèdent les corrections de la relecture de fin de groupe**
  (le journal du rejeu, l'écriture sortie du clic, l'écran, en cours), et
  rien n'a été remesuré dans un navigateur depuis.

**Rejouer 1 000 événements** (mission, § 15). Les modules du site
importés dans la page, le même texte, quinze passes, la première à part ;
dans Firefox, l'horloge fine réglée dans le profil jetable (pas de
0,02 ms).

| Où | `rejouer()` seul, médiane | L'ouverture entière : lire le JSON, valider, rejouer |
|---|---|---|
| Node 24.21 | de 63 à 251 ms selon la charge, sur six passes de quinze rejeux ; 120 ms à la dernière (de 107 à 147) | 135 ms, dont 4,7 ms pour le JSON et 8,9 ms pour la validation |
| Edge 155 | 166 ms (de 121 à 225 ; 319 ms à froid) | 182 ms, dont 4,5 ms et 11,9 ms |
| Firefox 143, première passe (Node au même moment : 95 ms) | 308 ms (de 234 à 431 ; 535 ms à froid) | 344 ms |
| Firefox 143, seconde passe, poste très chargé (Node : 251 ms) | 529 ms (de 383 à 762) | 579,8 ms |

**Enregistrer un combat de 300 événements**, dans une IndexedDB réelle.
Dans la page, par les fonctions du site (`chiffrerCombat`, puis l'écriture
conditionnelle du magasin), avec la clé de la démonstration prise au
coffre ; la relecture vérifie que le texte rendu est le texte écrit ; 25
écritures.

| Où | Une écriture entière, médiane | dont compresser et chiffrer | dont écrire dans IndexedDB | Relire et déchiffrer | Ce qui est gardé, pour 125 372 octets en clair |
|---|---|---|---|---|---|
| Edge 155 | 22,4 ms (de 19,5 à 34,8) | 17,6 ms | 4,7 ms | 12,9 ms | 10 256 signes de base64 (7 690 octets chiffrés) ; l'enregistrement entier, 10 429 signes de JSON, huit clés |
| Firefox 143 | 22,7 ms (de 17,8 à 33,5) ; 40,9 ms à la seconde passe, poste chargé | 14,4 ms | 7,5 ms | 13,8 ms ; 25,9 ms à la seconde passe | 10 352 signes de base64 (7 762 octets chiffrés) ; 10 525 signes de JSON |

Assembler le texte prend moins de 0,1 ms dans Edge. **L'enregistrement
que fait l'écran lui-même** pendant qu'on joue, de « Enregistrement… » à
« Combat gardé sur cet appareil », relevé par un observateur de la barre :
dans Edge, médiane 48,6 ms, 95e centile 83 ms, le pire 133 ms, sur 86
écritures ; dans Firefox, médiane de 59 à 73 ms selon la passe, le pire
554 ms et 1 855 ms. Ce temps court après le clic, sans le retenir.

**Le temps d'un clic, jusqu'à l'écran à jour** (cible de la mission :
moins de 100 ms), sur un combat de 300 événements. Des clics de souris
envoyés par le protocole, joués par un joueur automatique (qui joue, une
capacité, une cible, chaque dé, des dégâts fixés, « Appliquer », « Passer
son tour ») ; dans la page, de l'entrée d'un écouteur de capture posé sur
le document à la sortie d'un écouteur de bulle, puis le style et la mise
en page forcés : le rendu de l'écran est synchrone. Pour que le combat
dure cent clics, le joueur fixe à 0 les dégâts portés au personnage.

| Navigateur, combat, largeur | Clics | Médiane | 95e centile | Le pire | À 100 ms ou plus |
|---|---|---|---|---|---|
| Edge 155, 15 protagonistes, 1 440 px (14 fiches ouvertes, 2 129 nœuds) | 70 | 31,6 ms | 46,3 ms | 60,2 ms | 0 |
| Edge 155, 15 protagonistes, 390 px | 30 | 28,7 ms | 39 ms | 42,9 ms | 0 |
| Edge 155, 4 protagonistes, 1 440 px (949 nœuds) | 60 | 32,5 ms | 45,6 ms | 57,3 ms | 0 |
| Edge 155, 4 protagonistes, 390 px | 25 | 21 ms | 29,6 ms | 29,8 ms | 0 |
| Firefox 143, 15 protagonistes, 1 440 px, première passe | 70 | 74,1 ms | 153 ms | 330 ms | 19 |
| Firefox 143, 15 protagonistes, 390 px, première passe | 30 | 46,7 ms | 71,7 ms | 73,2 ms | 0 |
| Firefox 143, 15 protagonistes, 1 440 px, seconde passe, poste très chargé | 70 | 49,3 ms | 192 ms | 255 ms | 12 |
| Firefox 143, 15 protagonistes, 390 px, seconde passe | 30 | 55,8 ms | 130,6 ms | 144 ms | 5 |
| Firefox 143, 4 protagonistes, 1 440 px, seconde passe | 60 | 53,2 ms | 110 ms | 164 ms | 6 |
| Firefox 143, 4 protagonistes, 390 px, seconde passe | 25 | 44,8 ms | 94,4 ms | 129 ms | 1 |

- **Dans Edge, la cible est tenue**, et le nombre de protagonistes ne
  pèse plus sur le clic. La mesure y avait d'abord trouvé un défaut : à
  l'ouverture et à la fin de chaque geste, 12 à 14 fiches sur 15 étaient
  refaites en entier, environ 1 400 nœuds, pour le seul bouton « Jouer »
  qui y paraît ou disparaît ; le clic allait alors à 84,6 ms au 95e
  centile et 108,2 ms au pire, 3 clics sur 70 à 100 ms ou plus. Corrigé
  avant les nombres du tableau : une fiche ne refait plus que ce qui a
  changé.
- **Dans Firefox, la cible n'est pas tenue de façon sûre** : selon la
  passe et la largeur, de 0 à 19 clics y sont à 100 ms ou plus, sur 25 à
  70. Diagnostic pris dans
  la page : refaire le corps du panneau d'action (123 nœuds) puis mettre
  en page coûte de 17 à 42 ms dans Firefox, contre 6 à 9 ms dans Edge ;
  refaire une fiche (118 nœuds), 22 ms contre 4,6 ms. Le script du moteur
  pèse peu (les vues 2,5 ms, un événement 0,7 ms) ; ni les règles `:has()`
  ni les cent cases en conteneur ne sont en cause (de 1,7 à 2,5 ms). Le
  remède serait de ne plus refaire le panneau en entier à chaque clic : il
  n'est pas fait. **Point à trancher**, après une mesure poste au calme,
  qui reste à faire ; le Firefox 157 de l'auteur, ouvert pendant les
  mesures, n'a pas été lancé.
- **D'où vient le temps d'un clic, dans Edge** : les compteurs du moteur
  de rendu, lus avant et après chacun de 78 clics, donnent 18,4 ms de
  script, 4 ms de styles et 6,6 ms de mise en page (médianes), 6 calculs
  de style et 2 mises en page par clic. Un profil du processeur, sur 70
  clics : remplacer le contenu du panneau d'action, 10,5 ms par clic ;
  poser le focus, 7,4 ms ; ouvrir la compression, 4 ms ; encoder le texte,
  1,5 ms. Ces deux dernières parts étaient celles de l'enregistrement,
  parti dans l'écouteur du clic : il part depuis un tour plus tard
  (§ 17.8), et le clic n'a pas été remesuré. Une série profilée est plus
  lente (médiane de 36 à 41 ms) : ses temps ne sont pas ceux à retenir.

**Aucune case ne déborde**, dans Edge 155 comme dans Firefox 143 : aucun
défaut sur 98 largeurs (chaque pixel de 320 à 414, puis 768, 1 024 et
1 440) et 17 938 boîtes mesurées par navigateur.

- **Cinq plateaux** : la préparation chargée de 61 protagonistes, avec
  des cases à 1, 2, 3, 4, 6 et 12 jetons, dans les coins, sur les bords
  et au milieu (37 jetons et 9 « +k » montrés sous 56rem, 46 jetons et 5
  « +k » à 1 440 px) ; la même, un jeton en main (99 boutons de case),
  sur 8 largeurs seulement ; le combat de référence au moment de la
  maquette ; le même pendant le choix d'une arrivée (8 cases possibles) ;
  le combat de 300 événements.
- **La méthode** : `getBoundingClientRect`, dans la page, à un demi-pixel
  près. Chaque case dans la grille ; chaque jeton montré, son rond, ses
  initiales, son nom court, « +k » et le bouton de case dans leur case ;
  aucun contenu plus grand que sa case ; aucun chevauchement de deux
  jetons ; un seul « +k » montré ; les initiales dans leur rond ; la
  grille dans le plateau ; pas de défilement horizontal de la page.
- **Le côté d'une case** : § 17.7.
- La mesure avait d'abord trouvé un défaut : des initiales de trois signes
  et plus (« Ma11 » : à partir du dixième exemplaire d'un adversaire)
  étaient plus larges que le rond de leur jeton, qui en rognait 1,6 px de
  chaque côté, et sortaient de leur case de 0,6 à 0,9 px sur téléphone, de
  1,9 px à 768 px : 96 largeurs sur 98 en défaut. Corrigé avant les
  nombres ci-dessus.

**Le regard sur la maquette** (mission, § 15). Le combat de référence
fictif, écrit chiffré dans la base par un script de capture hors dépôt,
est arrêté au moment que montre la maquette : une Taloche d'Aubépine après
deux dés, la relance du second à lancer, un Marmiton mort, l'autre ciblé.
L'écran est comparé, image contre image et bloc par bloc, aux deux rendus
de la maquette, à 1 440 et 390 px, dans Edge 155 puis dans Firefox
143.0.4 ; les images sont reprises après chaque série de corrections,
trois fois. Vus aussi : la disposition du milieu (1 100 px), le thème
clair, la préparation, le combat terminé, et cinq autres moments d'un
geste.

- **Douze écarts corrigés.** Le plus lourd : une règle générale de la
  feuille pesait plus qu'une classe et écrasait la taille, la graisse et
  l'interligne des dés, des jetons, des « +k » et des boutons du site ; un
  dé rendait 16 px au lieu de 18, et ses étiquettes sortaient de son
  cadre de 6 px à 1 440 px, de 10 px à 390 px. Les autres : la raison d'un
  bouton inactif écrite en clair à côté de chaque bouton (quatorze au
  moment de la maquette) ; un mort qui tenait, dans une case pleine, la
  place d'un vivant qu'on pouvait cibler ; l'en-tête de la carte, absent ;
  l'ordre des boutons de la barre ; la raison de « Fin de tour », qui
  paraissait sous « Nouveau combat » ; des noms courts réduits à une
  lettre ;
  la fiche d'un mort, les jauges, le titre du panneau ; un arrêt de
  tabulation invisible sur le journal vide ; un lien de 89 × 21 px, seule
  cible sous 44 px hors de la carte.
- **Mesuré sur les vues finales**, dans les deux navigateurs : aucun
  défilement horizontal (0 px) à 1 440, 1 100 et 390 px ; aucune cible
  sous 44 px hors de la carte ; aucune case fautive sur 294 mesures par
  navigateur (98 largeurs, trois moments) ; au clavier, 42 arrêts au
  moment de la maquette à 1 440 px, tous visibles, tous avec leur
  contour ; le journal haut de 384 px (288 px à 390 px), sa dernière ligne
  visible à l'ouverture et après chaque geste ; le focus rendu au bouton
  d'où l'on vient à chaque « Fermer ».
- **Le glisser-déposer** : dans Edge, un jeton passe de E5 à B8 ; dans
  Firefox, le départ et le survol se pilotent, pas le dépôt, que le
  protocole ne mène pas à son terme sans fenêtre.
- **Console et réseau** : aucune erreur, aucun avertissement, aucune
  requête échouée ni hors du serveur local, sur toutes les séances.
- Le § 17.7 ne porte pas encore tout ce que ce regard a changé à l'écran :
  il sera accordé avec les corrections de la relecture, en cours.

**Un combat joué de bout en bout, par de vrais clics** et de vraies
frappes du protocole, quatre fois, jusqu'à « Combat terminé : victoire des
adversaires. », sans aucun échec : Edge 155 à 1 440 px (59 vérifications,
207 pas, 72 dés, 91 secondes), Firefox 143 à 1 440 px (56 vérifications,
185 pas, 64 dés, 137 secondes), Chrome 154.0.8037.99 à 1 440 px (59
vérifications, 216 pas, 78 dés), Edge à 390 px (59 vérifications, 149
pas). Dans les quatre : aucune erreur ni avertissement de console, aucune
requête échouée, aucune hors du serveur local.

- **La préparation** : la démonstration ouverte par son mot de passe tapé
  au clavier ; sur un appareil neuf, le personnage de démonstration
  s'ajoute d'abord à l'écran Personnages ; les ajouts posés d'office en
  A1, J1, J2, J2 ; un adversaire ajouté puis retiré ; les trois moyens de
  déplacer (le jeton puis la case ; le champ « Case », où « Z9 » est
  refusé avec sa phrase et « f6 » écrit F6 ; le glisser-déposer, dans Edge
  et Chrome) ; « Qui commence » ; la préparation gardée chiffrée.
- **Le jeu** : chaque dé d'un clic (de 47 à 78 par combat), une relance,
  une esquive et sa ligne au journal, un réglage à la main avec sa raison,
  « Passer son tour », « Fin de tour ».
- **Un rechargement au milieu d'un jet** : le même titre, les mêmes
  étapes, les mêmes dés avec leurs valeurs, le même dé à lancer, le même
  journal ligne pour ligne ; la base garde la même révision et les mêmes
  dés. **Aucun dé n'est relancé.**
- **« Copier » et « Télécharger »** : presse-papiers refusé (Edge et
  Chrome), le texte paraît dans un champ, sélectionné, avec sa phrase ;
  permis (les trois navigateurs), le texte relu est le texte attendu. Le
  fichier porte le nom et l'heure du lancement, sa marque d'ordre des
  octets, des fins de ligne CRLF partout, et le même texte. Vu au
  passage : sous Windows, Edge et Chrome rendent le texte copié en fins de
  ligne CRLF, qu'ils convertissent eux-mêmes ; Firefox le rend en LF, tel
  que l'écran l'écrit.
- **Deux onglets** : le second joue, le premier dit « Combat ouvert
  ailleurs » à son clic suivant, n'écrase rien, et reprend le combat tel
  que le second l'a laissé.
- **« Oublier le mot de passe »** : la page ne montre plus rien du
  combat, l'adresse redemande le mot de passe, l'enregistrement chiffré
  reste à la même révision.
- **Rien en clair** : toutes les bases IndexedDB du site, `localStorage`,
  `sessionStorage` et les témoins, lus dans la page et fouillés pour 385
  textes (tous ceux de la banque de démonstration, les noms, les lignes du
  journal) : aucun dans la base du combat, ni dans le coffre, ni dans
  `localStorage`. La base des personnages, hors de cette vérification,
  garde le personnage de démonstration en clair, comme depuis le lot 2
  (§ 15.1).
- **La rencontre préparée** : deux Homards furieux et une Mouette
  chapardeuse, posés d'un clic, numérotés, sur la colonne J ; placée une
  seconde fois, elle s'ajoute à la suite.
- **Ce qui n'a pas été joué par de vrais clics** : « Garder ce dé » et
  « Faire exploser » (aucun des quatre combats ne les a rencontrés) ; le
  glisser-déposer et le refus du presse-papiers dans Firefox ; les états
  « ne se lit plus », « autre version », « version plus récente » et « ce
  navigateur ne garde pas le combat » ; le thème clair et la disposition
  du milieu pendant un combat joué.

**Les corrections de la relecture, mesurées avant et après**, sous Node
24.21, sur le poste chargé par deux navigateurs de relecture. Le bruit y
est fort : les mêmes 20 000 passes d'avant correction ont pris 309
secondes pendant une pointe de charge, 31,0 secondes vingt minutes plus
tard (436 secondes chez le relecteur). Les « avant » sont ceux remesurés
poste plus calme, sur une image du commit `d51c16a` prise hors dépôt.

Le rejeu d'un combat gardé, synchrone à l'ouverture de l'écran :

| Contenu rejoué | Avant : 1 000, 5 000, 20 000 événements | Après : 1 000, 5 000 événements |
|---|---|---|
| le moins cher : un réglage qui change, rien au journal | 8 ms, 16 ms, 53 ms | de 8 à 10 ms, de 15 à 17 ms |
| celui qui écrit le plus : des protagonistes qui passent, trois lignes chaque fois | de 46 à 61 ms, de 1,10 à 1,16 s, 31,0 s | de 16 à 18 ms, de 283 à 318 ms |
| une capacité jouée, 200 capacités de 20 façons | 0,25 s, 1,14 s, 6,4 s | la photographie est refusée (600 façons au plus) |
| une capacité jouée, 200 capacités de 3 façons | non mesuré | de 79 à 89 ms, de 340 à 381 ms |
| 72 protagonistes qui passent | 97 859 ms pour 20 000 événements, mesure du relecteur, poste chargé | de 69 à 77 ms, de 156 à 192 ms |
| **le pire que la validation accepte encore** : 600 façons dont 20 de déplacement, 20 jauges, un lien que rien ne paie | la validation en acceptait de plus chers (plus bas) | **de 952 à 968 ms, de 4,66 à 4,75 s** |

La cause, au profil de 5 000 passes : la liste du journal, refaite à
chaque ligne, était regelée et reparcourue ligne à ligne à chaque
événement (`geler`, 73,8 % du temps : 859 ms sur 1 163). Après : la
recopie de la liste, 50,5 % (165 ms sur 327), le ramasse-miettes 19,9 %,
`geler` 2 %. En cherchant le pire, la mesure a montré que le coût du pire
événement tenait à l'offre, non au journal : elle juge toutes les façons
de celui qui joue, à chaque capacité jouée. Avant les bornes,
200 capacités de déplacement de 20 façons coûtaient de 30 à 35 ms par
événement (1 000 événements : 29,6 s ; 3 000 : 94,5 s), et 3 980 façons
que le lien ne paie pas, 4,2 ms (5 000 : 21,1 s). Aucune borne des
événements n'y suffisait : d'où les bornes de la photographie (§ 17.2),
puis le plafond de 5 000 événements (§ 17.3), fixé sur la dernière ligne
du tableau. Le 5 001e événement arrête le rejeu, par sa phrase. **Une
piste, non suivie** : que l'offre ne juge que la capacité demandée ; le
plafond pourrait alors remonter, et les deux bornes des façons se retirer.

- **Un dé** : un événement d'un million de valeurs était accepté, en
  123 ms ; il est refusé au-delà de cent, avant qu'une seule soit lue.
- **L'enveloppe longue.** Avant : la lecture lève dès 4,48 Mo de base64
  (3,36 Mo d'octets) ; des chiffrés de 8, 12, 32 et 64 Mo lèvent tous ; un
  clair qui se compresse mal, de 5,45 Mo puis de 8,07 Mo, sous la borne
  (8,39 Mo dans l'unité de ces mesures, le million d'octets), s'écrit,
  puis sa relecture lève. Après : aucune levée jusqu'à 64 Mo ; un
  chiffré de 8 Mo se dit illisible en 37 ms, ceux de 12, 32 et 64 Mo en
  0 ms, la longueur passant d'abord ; des clairs de 2,73, 5,45 et 8,07 Mo
  s'écrivent et se relisent à l'identique (relecture en 104, 183 et
  286 ms) ; « Nouveau combat » s'écrit par-dessus un combat illisible.
- **La révision** : posée à 2^53 − 1 ou à 2^40 + 1, « Nouveau combat »
  s'écrit à la révision 1, et la page rechargée le reprend ; à 2^40, de
  même ; à 2^40 − 1, il s'écrit à 2^40, puis à 1.
- **Le compteur des identifiants** : à 99 998, le dernier identifiant
  s'ajoute, et le combat se relit ; à 99 999, l'ajout est refusé par sa
  phrase, rien n'est gardé ; à 2^53 − 1, l'ouverture dit « illisible ».
- **La source d'un adversaire** : 1 000 capacités (0,03 Mo), acceptée ;
  30 000, refusée en 13 ms ; 300 000, refusée en 150 ms.
- **L'écriture hors du clic** (un texte de 160 Ko, 40 demandes) : avant,
  la demande prend de 0,49 à 0,65 ms en médiane, de 1,35 à 5,79 ms au
  pire, et le texte est assemblé dans le tour de la demande 40 fois sur
  40 ; après, 0,02 ms en médiane, 0,06 ms au pire, 0 fois sur 40, et les
  40 révisions s'écrivent comme avant. Sous Node seulement : le clic n'a
  pas été remesuré dans un navigateur.

**Ce qui reste à mesurer ou à faire**, à l'écriture de ce paragraphe.

- **Les mises à l'épreuve des contrôles de l'écran** (plus haut).
- **Le temps d'un clic**, poste au calme : dans Firefox, où la cible
  n'est pas tenue de façon sûre ; dans Edge, depuis que l'écriture a
  quitté le clic.
- **L'écran, de nouveau, dans un navigateur**, une fois finies les
  corrections de la relecture : le regard, et « aucune case ne déborde ».
- **Le site en ligne** : la mission veut qu'un combat de démonstration
  s'y joue jusqu'au bout (son § 17). Rien n'en est mesuré ici.
- **Le nombre de contrôles du commit de fin de groupe.**
- **À l'auteur, à l'arrêt d'essais** (§ 13), ce que ni un document simulé
  ni un navigateur sans fenêtre ne montrent : le dépôt d'un
  glisser-déposer dans Firefox, à faire une fois à la main ; un vrai
  téléphone et le toucher, la largeur seule ayant été émulée, avec des
  clics de souris ; les lecteurs d'écran, la région d'annonce n'ayant été
  que lue dans le document ; les contrastes à l'écran, ceux des onze
  couleurs étant calculés par un contrôle (§ 11) et aucun mesuré à
  l'image ; le temps de peinture ; Firefox 157.

### 17.12 Ce que le groupe 2 ajoutera

Les règles fines et la main du MJ (mission, § 13 ; spécification 1.5). Il
ne commence que sur la parole de l'auteur, après l'arrêt d'essais (§ 13).

- **Les interventions** : une étape « Interventions » après chaque jet
  d'une attaque, touchée ou non, qui propose les leurs au protagoniste
  attaqué et à ses alliés vivants ; un bouton « Intervenir… », à tout
  moment du tour adverse ; **attendre**, qui fait jouer une capacité en
  intervention jusqu'au prochain tour du camp de son auteur.
- **La contre-attaque** (livret, « Contre-attaque ») : après une face de
  contre-attaque, si l'attaquant est à la portée de l'arme du défenseur,
  pour une action.
- **Le coup critique** (livret, « Coup critique ») : à trois réussites,
  avec un avantage non dépensé, un quatrième dé, qui double les dégâts.
- **Le dé miroir** (livret, « Dé miroir ») : « Inverser » un dé lancé.
- **Les passifs payants**, qui coûtent du souffle ou du lien, en boutons
  pendant les jets qu'ils visent.
- **La palette** de modificateurs, à droite des dés, avec le texte de la
  capacité jouée : sur les dés, la localisation, les dégâts (multiplier,
  ajouter, annuler, reporter, toute la case, une attaque en plus, rendre),
  la cible (défense, attaque, état, déplacement), chaque effet avec sa
  source et sa durée.
- **Les états** : ceux des blocs de type État de la banque, ou un état
  libre, avec une durée.
- **Le clic droit**, ou l'appui long sur téléphone, et un bouton
  « Modifier… » pour le clavier : il ne change que le combat en cours, et
  l'écrit au journal (modifier une valeur, changer l'équipement, un état,
  déplacer sans action, retirer du combat).
- **Plusieurs cibles**, avec un jet par cible.

**Le groupe 1 tient déjà ses points d'accroche** : le geste en cours est le
sommet d'une pile, qui recevra l'intervention ou la contre-attaque ; les
dégâts sont une base et une suite d'opérations, où entreront multiplier,
ajouter et reporter ; la victime est un paramètre du calcul des dégâts,
jamais la cible du geste ; le prix d'un geste est un objet ; l'attaque et
la défense d'un protagoniste se lisent chacune par une seule fonction
(`attaqueDe`, `defenseDe`), qui rend déjà une valeur, sa base et la liste
de ses écarts ; le jet garde ses dés
place par place, sans aucun total. La version des règles passera à 2 : un
combat du groupe 1 se dira alors « commencé avec une autre version », sans
se rejouer.
