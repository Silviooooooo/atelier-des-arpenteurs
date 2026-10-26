# L'Atelier des Arpenteurs — spécification

**Version 1.5 — 26/10/2026.** Le lot 1 est en service ; le lot 2, le
créateur de personnage (§ 15), le lot 2 bis, ses améliorations et les
personnages en ligne (§ 15.8), et le lot 3, les adversaires (§ 16), sont
livrés. Le lot 4, le simulateur de combat (§ 17), se fait en trois
groupes : le groupe 1, le combat jouable, et le groupe 2, l'ergonomie et
les correctifs, sont faits ; le groupe 3, les règles fines et la main du
MJ, suivra un arrêt d'essais (§ 13).
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
les dernières arrêtées en écrivant le moteur ; deux ont été tranchées par
l'auteur le 25/10/2026, les autres restent à confirmer. Elles priment jusqu'à la réécriture du livret, jusque là
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
   et se télécharge. Il se fait en trois groupes : le combat jouable ;
   l'ergonomie et les correctifs (la bulle d'options à côté des jetons,
   « Annuler le dernier geste ») ; les règles fines et la main du MJ.
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
| Les capacités que le simulateur sait jouer seul se reconnaissent **à leur nom** ; ceux du vrai classeur ne sont dans le code que **par leur empreinte** | aucun nom du vrai classeur n'entre dans le dépôt, qui est public (interdit 2) ; un nom changé dans le classeur se voit à la préparation (§ 17.6) ; les empreintes sont gardées telles quelles (décision de l'auteur, 25/10/2026) |
| **Vert pour les personnages, rouge pour les adversaires**, à l'écran du combat | demande de l'auteur ; c'est une exception à « une seule couleur d'accent », et jamais la couleur seule : initiales, noms, listes, ✓ et ✗ la doublent (§ 9, § 17.7) |
| Le lot 4 se fait en **trois groupes** : le combat jouable, puis l'ergonomie et les correctifs, puis les règles fines et la main du MJ | les essais de l'auteur après le groupe 1 ont demandé l'ergonomie d'abord ; décision du 25/10/2026, par le complément du groupe 2 (§ 13) |
| Tout ce qui se décide pour un geste se fait **dans une bulle à côté du jeton** de qui joue ; sur un téléphone, dans un volet qui monte du bas | décision de l'auteur du 25/10/2026, sur la maquette d'ergonomie : le regard reste sur la carte, et l'écran ne fait jamais défiler la page de lui-même (§ 17.7) |
| **« Annuler le dernier geste »**, sans « Rétablir » | décision de l'auteur du 25/10/2026 ; le journal ne recule pas, il barre et ajoute une ligne, et le rejeu reste linéaire (§ 17.3) |
| **15 000 événements** par combat, au plus | chiffre de l'auteur, 25/10/2026 : l'offre ne juge plus que la capacité demandée, le journal n'est recopié qu'une fois par événement, et le rejeu rend la main au navigateur (§ 17.3) |
| La composition en cours de **la rencontre** se garde sur l'appareil, **chiffrée** par la clé de table | l'auteur a vu la rencontre préparée perdue ; elle porte des noms de la banque, qui ne s'écrit jamais en clair sur un appareil (§ 7.2, § 16.6) |

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
  jetons.css                toutes les valeurs de mise en page en variables, dont les quinze couleurs du combat et les longueurs de sa bulle (§ 17.7)
  ecran.css                 l'interface, pensée pour le téléphone d'abord ; les deux vues d'un adversaire et la rencontre (§ 16.6) ; les vignettes du créateur (§ 15.3)
  personnage.css            l'écran d'un personnage : vue lecture, vue fiche
  fiche.css                 la fiche imprimable, reproduction du modèle (§ 15.4)
  adversaire.css            la carte d'un adversaire, reproduction de la maquette, et son impression (§ 16.5)
  combat.css                l'écran du simulateur de combat, ses trois dispositions, ses deux couleurs de camp, la bulle et le volet, le journal en couleurs (§ 17.7)
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
    rencontre_gardee.js     la composition de la rencontre gardée sur l'appareil, chiffrée, sa base, sa relecture (§ 16.6)
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
    offre.js                la seule porte : ce qui est permis à cet instant, et pourquoi le reste ne l'est pas ; l'annulation et ses raisons
    moteur.js               le réducteur : un état, un événement, l'état suivant ; la pile d'annulation ; le rejeu d'un combat gardé, linéaire, par tranches
    journal.js              chaque ligne du journal et ses segments, la ligne en cours, la ligne « Annulé », l'en-tête, le nom du fichier, les annonces
    lecture.js              les vues que l'écran affiche (la barre, la carte, une fiche, la bulle, la préparation, le journal, le bandeau), chaque bouton avec sa commande ou sa raison
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
    combat_plateau.js  combat_fiches.js  combat_action.js  combat_preparation.js  combat_bulle.js  combat_journal.js
                            ses six parties : la carte, les fiches vivantes, le contenu d'une action et la zone sous la carte,
                            la préparation, la bulle et ses infobulles, le journal et son bandeau
    partage.js              fichier et lien d'un personnage ; la lecture du personnage de démonstration, partagée avec le combat
    echelle.js              l'échelle d'un papier à l'écran et la place de la bulle : la seule écriture de style du code (§ 10.1)
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
  Deux lignes de même nom **et** de même puissance sont une erreur (E3), comme
  deux capacités dont les noms ne diffèrent que par un signe invisible,
  quelles que soient leurs puissances (§ 6.3, depuis le groupe 2 du lot 4).
  Cette lecture contredit la phrase de `lisez_moi` « le nom est l'identifiant
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
l'écran. `js/banque/noms.js` en retire **vingt-deux, et eux seuls** :
U+00AD, U+061C, U+200B à U+200F, U+202A à U+202E, U+2060 à U+2064, U+2066
à U+2069 et U+FEFF. U+061C, une marque de sens que l'affichage ôtait déjà
(§ 10.1), y est entré au groupe 2 du lot 4 (décision de l'auteur,
25/10/2026) ; U+2065, non attribué, n'en est pas.

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
  noms ne diffèrent que d'un signe invisible restent donc deux capacités.
  **E3 les signale, quelles que soient leurs puissances** (élargi au
  groupe 2 du lot 4, décision de l'auteur, 25/10/2026) : la première est
  celle dont la première ligne est la plus haute ; chaque autre reçoit un
  E3, à la plus basse de ses propres lignes (le complément du groupe 2,
  § 5.4, dit « à la ligne la plus basse » ; lue ainsi depuis la relecture
  de fin du groupe 2, choix réversible), et le message cite la première
  ligne de la première : « La capacité « {nom} » ne diffère de celle de la
  ligne {n} que par un signe invisible. » Pour une capacité d'une seule
  ligne, c'est la même ; pour une capacité à plusieurs variantes, non.
  Deux noms écrits
  différents n'ont que ce message. **Deux variantes d'un même nom écrit ne
  sont jamais un doublon**, sauf à la même puissance : « La capacité
  « {nom} » a déjà une variante de puissance « {p} », ligne {n}. », à la
  plus basse des deux. Jusqu'au groupe 1, des puissances différentes ne
  donnaient pas E3.
- **Ce qui ne change pas** : les listes, la rencontre et la recherche
  rangent toujours les noms tels qu'écrits (§ 12).

| Code | Gravité | Ce qui est vérifié |
|---|---|---|
| E1 | bloquante | feuille ou en-tête attendu absent : l'import s'arrête |
| E2 | erreur | ligne non vide sans nom |
| E3 | erreur | doublon : bloc, élément, ou capacité de même nom et même puissance (noms comparés exactement, signes invisibles et espaces de bord retirés) ; deux capacités dont les noms ne diffèrent que par un signe invisible, quelles que soient leurs puissances |
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
- **La composition de la rencontre** (lot 4, groupe 2, § 16.6) se garde
  de même, **chiffrée par la clé de table** : elle porte des noms
  d'adversaires de la banque. Elle vit dans une base à elle,
  `atelier-des-arpenteurs-rencontre`, jamais celle du combat, ni le
  coffre, ni `localStorage` ; une par mode. Sans clé, rien ne s'écrit ; sans
  IndexedDB, elle vit en mémoire le temps de la visite, sans rien dire.
  Une enveloppe sous une autre clé, ou abîmée, rend une composition vide,
  sans rien lever ni rien dire.
- Un bouton « Oublier le mot de passe sur cet appareil » efface la clé, du
  coffre et de la mémoire. Il annule aussi le circuit en cours de l'espace
  auteur : une confirmation en attente se referme sans rien écrire, et les
  différences déchiffrées quittent l'écran. Une clé lue juste avant l'oubli
  ne revient pas en mémoire. Depuis le lot 4, il efface aussi **le combat
  de la mémoire** de la page, qui porte des valeurs de la banque en clair :
  une lecture partie avant l'oubli n'y remet rien. Depuis le groupe 2, il
  efface de même **la composition de la rencontre** de la mémoire de la
  page. L'enregistrement chiffré de l'un et de l'autre reste sur
  l'appareil, illisible sans la clé.
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
boutons de 44 px** : dans la bulle ou sous la carte, un bouton par cible
possible et par case d'arrivée possible ; avant le lancement, un champ
« Case » (de A1 à J10) pour chaque fiche, hors de son volet : il s'atteint
sans la déplier. Tout bouton hors de la carte tient les 44 px (§ 17.7),
sauf un.

**Une exception de plus, depuis le groupe 2 du lot 4 : les lignes de la
bulle du combat** (complément du groupe 2, décision de l'auteur du
25/10/2026). Avec une souris (`pointer: fine`), chaque ligne de la bulle,
une capacité à une puissance (seules à porter `data-ligne`), fait
**36 px** de haut ; au doigt (`pointer: coarse`), et partout ailleurs,
44 px. La règle ne vaut que pour elles : « Passer son tour », les rangées
du jet (« Jet d'attaque », les armes, les cases d'arrivée, les
caractéristiques, les difficultés, les jauges, les dégâts, les natures)
et les passifs du pied gardent leurs 44 px, à la souris comme au doigt,
comme toute autre cible de l'écran (§ 17.7).

**L'aspect est sobre** (décision de l'auteur, 28/09/2026) : polices du
système, aucune police téléchargée ; gris neutres et une seule couleur
d'accent ; un thème clair et un thème sombre, selon le réglage de l'appareil
(`prefers-color-scheme`). Le texte contraste d'au moins 4,5:1 avec chacun de
ses fonds, et les bordures des champs d'au moins 3:1. Toutes les valeurs
vivent dans `css/jetons.css` : une identité visuelle s'y posera plus tard,
sans toucher au reste ; seules les largeurs des conditions `@media`
s'écrivent en dur, car CSS n'y lit pas de variable : 56rem dans `ecran.css`,
56rem et 80rem dans `css/combat.css`, qui a aussi une condition sans
largeur, `(pointer: fine)` (§ 17.7). La gravité d'une anomalie
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
entamée, la mention « désavantage »), ce sont onze couleurs ; le groupe 2
du lot 4 en ajoute quatre : la hachure de la portée d'une capacité
survolée et son bord, le bord et le fond du cadre d'un jet au journal.
**Quinze couleurs** (`--combat-…`, § 17.7), dans `css/jetons.css`, pour
les deux thèmes, aux mêmes contrastes que le reste : 4,5:1 pour un texte,
3:1 pour un rond ou un trait sur le fond d'une case. **Aucune ne porte
seule une information** : un jeton a ses initiales ou son nom, un camp sa
liste et son titre, un dé son signe (✓ ou ✗) et son état dans son nom
accessible, une case hachurée la phrase de portée de l'infobulle. Ces
couleurs ne servent qu'à l'écran du combat ; l'accent du site y reste
celui de qui joue et de sa case. Le groupe 2 y ajoute aussi **quinze
longueurs**, sans « combat » dans leur nom, de la bulle et de son volet
jusqu'à l'écart du pointillé d'un passif (`--decalage-soulignement`) et à
la vignette du créateur (§ 17.7).

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
| Rencontre | des adversaires, un nombre d'exemplaires par + et −, « Imprimer / PDF », l'aperçu des cartes ; la composition gardée sur l'appareil, chiffrée, jusqu'à « Vider la rencontre » (§ 16.6) |
| Combat | le simulateur de combat (`#/combat`, § 17.7) : la carte de 10 × 10 cases et ses jetons, le bandeau « Dernier événement » au-dessus ; avant le lancement, la préparation (ajouter un personnage, et en démonstration le personnage de démonstration, des adversaires, placer la rencontre préparée, qui commence, « Lancer le combat ») ; ensuite la bulle accrochée au jeton de qui joue (ses capacités, une ligne par puissance, leur survol et la portée hachurée sur la carte, la cible, les dés, la localisation, l'esquive, les dégâts), le volet qui monte du bas sur un téléphone ; une fiche vivante par protagoniste, et sa fiche complète en panneau ; le journal en couleurs, « Copier » et « Télécharger » ; « Fin de tour », « ↶ Annuler le dernier geste », « Nouveau combat » ; l'état de l'enregistrement chiffré (§ 17.8) |
| Anomalies | le rapport publié avec la banque ; `#/anomalies/Blocs/14` met en avant les anomalies d'une ligne, `#/anomalies/Adversaires/3` de même |
| Espace auteur | clé GitHub ; import ; rapport ; différences ; publication ; changement de mot de passe, avec les personnages en ligne ; clé de dépôt des personnages ; vérification et reprise des personnages en ligne (§ 8.4) |
| Personnages | en ligne, tous les personnages du site et ceux que l'appareil vient d'envoyer ; à part, les non-envoyés (« Réessayer ») et les brouillons ; créer, reprendre, ouvrir, modifier, enregistrer le fichier, importer, ouvrir sur mon téléphone, supprimer après confirmation (pour tous, en ligne) ; en démonstration, le personnage de démonstration, et rien en ligne (§ 15.3, § 15.8) |
| Création | le parcours en neuf étapes, chaque capacité décrite, l'archétype, l'espèce, la constellation et le primordial en vignettes, des boutons + et −, trois entrées d'objets, un brouillon gardé à chaque changement, « Ce qui manque » toujours présent ; la copie de travail d'un « Modifier », qui s'enregistre à la place de l'original ou sous un autre nom (§ 15.3) |
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
- Toute la mise en page vit dans les variables de `css/jetons.css`, dont
  les quinze couleurs du combat et les quinze longueurs du groupe 2 du
  lot 4 (§ 9, § 17.7).
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
  de `js/banque/noms.js` en retire vingt-deux, pour la clé d'un nom et
  pour les doublons. Ce sont deux listes pour deux usages, et `dom.js` ne
  change pas : douze de ces signes commandent aussi le sens de l'écriture,
  dont U+061C depuis le groupe 2 du lot 4, et il les ôte du texte affiché ;
  les dix autres, dont U+200B, y restent, sans rien montrer. Tout signe que
  l'affichage ôte est désormais retiré d'un nom comparé.
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
  qu'elle fabrique elle-même, seule adresse que `el()` refuserait. **Le
  code n'écrit de style qu'en un module**, `js/ecrans/echelle.js`, et par
  deux fonctions seulement, qui posent des nombres en propriétés CSS :
  `poserEchelle` pose l'échelle d'un papier à l'écran
  (`--echelle`), pour la vue fiche d'un personnage (§ 15.5) et pour la
  carte d'un adversaire (§ 16.6) ; depuis le groupe 2 du lot 4,
  `placerBulle` pose la place de la bulle du combat, de son onglet et de
  ses infobulles (`--bulle-gauche`, `--bulle-haut`, `--bulle-fleche`, en
  pixels entiers), que `css/combat.css` lit (§ 17.7). Un contrôle vérifie
  qu'aucun autre module de `js/` n'écrit de style, que ces quatre
  propriétés sont les seules, et que les trois de la bulle ne s'écrivent
  que dans `placerBulle` (§ 11). L'ancrage CSS (`anchor-name`) n'est pas
  employé : Firefox ne le garantit pas. Raison : la clé et le jeton vivent dans
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
est refusé (sous Windows, `/plans%5Cx` passait, relecture du lot 2). Les
écrans se contrôlent dans un document simulé, écrit pour le projet
(`tests/outils/dom_simule.js`), sans dépendance. Depuis le groupe 2 du
lot 4, il prête à la demande un `focus()` fidèle (`focusFidele`), qui
déclenche `blur` puis `focus` quand l'élément actif change ; par défaut,
rien ne change pour les autres contrôles. Les contrôles de l'écran y
comparent deux nœuds par identité, jamais par `assert.equal`, dont
l'échec déroulerait la page entière (§ 17.11).

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
| Contrôle | le classeur d'essai déclenche **chaque** code du § 6.3 (trente-six ; E1, A8, A9, A10 et quinze des codes de la feuille Adversaires sur ses variantes, § 10.3), et exactement les anomalies qu'il annonce, ligne par ligne ; un classeur propre n'en déclenche aucun ; gravités du § 6.3 (le tableau lu dans la spécification, codes à deux chiffres compris) et tri du § 6.4 ; la colonne « Type » attendue, les types comparés sans casse, accents ni espaces ; E7 : un paramètre ciblé à côté du même sans cible admis, dans les deux ordres ; deux sans cible, ou la même cible deux fois (casse comprise), une erreur ; E4 toujours sur la cible ; A10 : deux pièces d'un même type sur une zone, pas deux types différents, pas une valeur écrite « 0 » ou « 0,0 » ; le signe invisible (lot 4, § 6.3) : chacun des vingt-deux signes retiré de la clé, U+061C compris depuis le groupe 2, aucun autre point de code d'Unicode retiré, les voisins de la liste gardés (dont U+061B, U+061D, U+180E et U+2065), les espaces voisins retirés comme avant ; E3 sur un bloc, un élément (avec l'espace que le signe cachait) et une capacité, de même puissance ou non ; le signe sur la première définition comme sur la seconde, et des variantes dont les lignes s'entrelacent : le doublon est la définition qui commence le plus bas, la ligne citée la plus haute ; « exactement » : ni la casse, ni un accent, ni une espace intérieure ne font un doublon (bloc, élément, capacité de même puissance) ; **E3 élargi** (groupe 2) : deux capacités à un signe près et de puissances différentes restent deux capacités, avec un E3 au message neuf, mot pour mot, et un renvoi approché vers ce nom devenu ambigu (E4), là où il est retrouvé et signalé (A1) sans la seconde ; le contrôle qui fixait la lecture d'avant (« puissances différentes : sans E3 ») est inversé ; trois noms d'un même groupe : deux E3, chacun à la plus basse des lignes de sa capacité, qui citent la première ligne de la première ; une capacité à deux variantes (lignes n et n + 5), qui ne diffère d'une plus haute que par U+061C : son E3 à la ligne n + 5, le message citant la première ligne de l'autre ; deux variantes d'un même nom écrit, de puissances différentes : aucun ; la même puissance d'un même nom écrit garde l'ancien message ; A1 sur une capacité, un élément et un paramètre, mot pour mot ; aucun de ces signes écrit tel quel dans `js/`, `outils/`, `tests/` ni dans ce document, sans exception (§ 10.1) |
| Chiffrement | aller-retour, au format 2 du § 7.1 : l'empreinte est celle des octets chiffrés, vérifiée avant le déchiffrement, et change à chaque publication ; le format 1 ne se lit plus : il se dit abîmé, avant toute dérivation ; mauvais mot de passe refusé proprement ; fichier abîmé ou inconnu, ou en-tête hors des bornes du § 7.1 (itérations, sel, IV, données), ou dérivation refusée : un message ; une clé sous le plancher ne chiffre pas ; IV différent à chaque chiffrement ; sel inchangé tant que le mot de passe ne change pas ; la clé gardée déchiffre la publication suivante (§ 7.1), et un sel renouvelé la rend inutilisable ; normalisation du mot de passe : NFC, espaces de bord, **minuscules** (« İ » compris), la même clé quelle que soit la casse ; une banque chiffrée sous la forme exacte reste lisible avec le mot de passe tel qu'il se saisissait, et la clé rendue republie sous la même forme ; 8 signes au moins, sans autre exigence ; coffre : seule une clé AES-GCM non extractible, clés réelle et de démonstration séparées, jeton à part (§ 7.2) |
| Publication | `fetch` simulé, **aucun appel réel à GitHub** : adresses, en-têtes et corps de la requête ; auteur et committer explicites, en adresse privée (§ 8.2) ; **première publication** : fichier absent, réponse 404, écriture sans `sha` ; mise à jour avec le `sha` lu ; refus pour `sha` périmé (409, ou 422 sans `sha`) : rechargement, nouvelles différences, nouvelle confirmation ; clé refusée (401), droits, réseau, JSON illisible, réponse qui n'est pas du JSON : un message ; écriture acceptée au corps perdu : un succès ; trois refus 422 : le motif du dernier ; contenu de plus d'un mégaoctet relu en brut. Lot 2 bis : la clé de dépôt ajoutée, gardée, remplacée, retirée, en fin de banque et seulement avec une valeur ; une forme invalide refusée sans recopier la saisie ; jamais dans le message de commit ni en clair dans une requête ; la clé GitHub de l'auteur refusée comme clé de dépôt, saisie comme publiée ; le changement de mot de passe en un seul commit Git Data (banque, personnages rechiffrés, déchiffrables avec la nouvelle clé et plus avec l'ancienne, autres champs gardés, index aux versions nouvelles ; branche lue sans cache, avance sans forcer, auteur et committer explicites) ; un refus d'avance relance tout et rechiffre le personnage rangé entre-temps ; une avance sans réponse : succès si la branche relue est sur le commit écrit, panne sur le commit lu, `incertain` sur un autre commit ou si la relecture tombe aussi ; autre clé, fichier reçu entier mais abîmé, ou trop gros : laissés et comptés, index abîmé régénéré ; réponse illisible, coupée ou inattendue sur un personnage ou l'index, arbre tronqué, clé refusée, droits, réseau, 409 : un message, rien d'écrit ; la reprise avec l'ancien mot de passe (minuscules puis forme exacte), en un seul commit sans la banque |
| Dépôt | aucun `.xlsx` hors `essais/`, et chaque `.xlsx` d'`essais/` fabriqué, octet pour octet, par l'outil des essais ; le `.gitignore` ignore les classeurs, leurs formats voisins, les documents et tout JSON hors liste ; aucun autre format de classeur ou de document, aucun JSON hors liste (le personnage de démonstration y entre) ; une seule page (`index.html`), une seule image SVG (l'icône) ; dans tout l'historique, aucun fichier interdit et aucun jeton, chaque contenu lu une seule fois (un historique de 900 révisions se lit, là où la ligne de commande de Windows n'en passerait que quelque 790) ; un jeton écrit en UTF-16 se voit, dans l'arbre comme dans l'historique ; deux workflows et eux seuls : « Contrôles » (actions fixées sur un commit avec leur version, `contents: read`, aucune écriture, `persist-credentials: false`, ni `pull_request_target` ni `workflow_run`, ni texte d'un événement) et « Personnages » (les mêmes règles, et son texte exact, ligne utile par ligne utile : l'ouverture d'un ticket et le lancement à la main pour seuls déclencheurs, `contents: read` au workflow, le groupe `personnages` sans annulation, un seul job sur `ubuntu-latest`, `contents`, `issues` et `pages` en écriture à ce seul job, les actions de « Contrôles » sur les mêmes commits, une seule commande, l'automate, le jeton pour seule expression ; la faute donne le numéro de ligne, jamais la ligne trouvée), chacun vu refusé sur des variantes fautives (dont un interpréteur, `NODE_OPTIONS`, un conteneur, une autre machine, un second checkout) ; `personnages/` ne contient que `<identifiant>.chiffre.json` et `index.json`, dans l'arbre comme dans l'historique ; chaque fichier se lit par le vérificateur de la page, sous l'identifiant de son chemin, et son contenu ne se lit pas comme du texte ; l'index se lit, **sans aucun nom en clair**, et dit exactement les fichiers présents, avec leur date et leur version ; le `.gitignore` ignore tout autre fichier de `personnages/` ; **aucun `.docx`** ; `donnees/` (quelle que soit la casse) ne contient que `banque.chiffree.json`, sans autre champ que ceux du § 7.1, aux valeurs du § 7.1 (600 000 itérations, sel de 16 octets, IV de 12), au format 2 seulement (l'empreinte est vérifiée sur les octets chiffrés ; le format 1 n'est plus permis nulle part, pas même au fichier du 29/09/2026), et des données qui ne se lisent pas comme du texte ; la banque d'`essais/` a la même forme, au format 2 ; le fichier figé du format 1, retiré, n'est permis que dans l'historique ; le crochet `pre-push` existe, en `sh`, exécutable, extrait en LF, et `core.hooksPath` le désigne sur le poste (pas sur GitHub Actions, qui n'envoie rien) ; un envoi vers un dépôt d'essai est refusé quand un contrôle échoue (même avec `NODE_TEST_CONTEXT` hérité), quand tout n'est pas commité, ou sans `node`, et accepté sinon ; aucun **jeton GitHub entier** : un préfixe (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) suivi d'au moins 36 caractères alphanumériques ou soulignés, le contrôle fabriquant son faux jeton au moment de l'essai ; dans l'historique, des **auteurs** en `…@users.noreply.github.com`, des **committers** aussi ou en `noreply@github.com` (commits faits sur le site de GitHub), la ligne `Co-Authored-By` d'un message n'étant pas une adresse d'auteur ; ni `innerHTML`, ni `outerHTML`, ni `insertAdjacentHTML`, ni `document.write` dans les fichiers du site et dans `outils/` (§ 10.1) |
| Différences | ajout, modification champ par champ, retrait ; variantes de puissance ; ordre des lignes et écriture d'une même notation sans effet ; doublons ; résumé d'une ligne et ses accords ; dates ; le type d'un bloc, et une banque publiée avant la colonne « Type » ; les types d'adversaires et les adversaires : ajout, modification cellule par cellule, retrait, deux écritures de la même cellule sans effet ; une banque publiée avant la feuille Adversaires, dans les deux sens, sans exception ; la phrase de la première publication, avec et sans adversaires |
| Adversaires | la notation de la feuille (§ 16.1) : nombre, « aucune », colonne Type et ses formes illisibles, localisation et ses défauts, zones reconnues exactement et à deux lettres près (et pas à trois), listes, « // », virgule entre crochets ; une cellule faite d'un très long blanc lue sans délai. La résolution (§ 16.2 à § 16.4), sur la feuille de démonstration et sur des variantes : deux types et leur ordre ; le multiplicateur (les quatre nombres, la qualité héritée, 2 par défaut comprise ; ni les faces, ni les rangs, ni la ligne de l'adversaire) ; l'arrondi une seule fois, à la fin, dont deux pièces d'armure dont la somme n'est pas la somme des arrondis, et 15 × (1/3 + 4/3) = 25 ; « aucun », « // », une liste qui remplace ; la grille propre ; l'armure : globale et pièces qui s'ajoutent, deux globales, six valeurs par nom quel que soit l'ordre des zones, autant de valeurs que de zones, la dernière pièce non globale, la valeur nulle, les trois packs sans armure naturelle ; plusieurs armes, la capacité donnée par deux ; la qualité (0, 1, 3, celle que fixe le bloc, héritée sous multiplicateur) ; l'ordre des capacités, les rangs par défaut, le rang qui remplace, le rang ramené au maximum, les groupes au choix non donnés ; le coût au rang, X, le lien ; les descriptions évaluées, le bouclier ; les maîtrises, par l'élément et par le nom ; le désavantage selon la position, entier ou partiel. Chaque code de la feuille sur son cas, mot pour mot, avec sa ligne et sa gravité (`tests/outils/adversaires_essai.js`), dont E16, A16 et A1 à un signe invisible près (lot 4), le signe porté par la première définition comme par la seconde ; E16 et A16 comparent exactement : ni la casse, ni un accent, ni une espace intérieure ne font un doublon ; un constat de type dit une fois ; le tri, les codes à deux chiffres ; E1 sur un en-tête absent ; un adversaire en erreur qui se résout quand même ; des noms hostiles (`__proto__`, du HTML) et des nombres démesurés, sans exception. Les types naturels reconnus, absents du créateur de personnage et des packs ; une banque d'avant le lot 3. Les ajouts du lot 4 au classeur d'essai ne changent aucun adversaire : chacun se résout à l'identique sur le classeur d'avant, refabriqué, et la feuille garde les mêmes anomalies (§ 16.7). **La carte**, dans un document simulé (§ 16.5) : en-tête et numéro d'exemplaire, bande du d20 et place de chaque zone, abréviations, première ligne, une ligne par capacité, capacité à deux armes, désavantage entier et partiel, quatre lignes au moins, valeurs absentes, aucune provenance, un nom qui contient du HTML reste du texte, un signe qui commande le sens de l'écriture ne s'affiche pas, un nombre reste entier dans les initiales d'une zone ; sa feuille lue comme un texte : aucune couleur en dur, jetons définis et sans valeur sombre, règles préfixées, aucune classe commune avec l'interface ni la fiche, les deux familles de classes de position, la contre-attaque verticale, la description en italique, aucune hauteur ni rognage sur la carte, les deux `@font-face`, l'impression (la page nommée posée trois fois, son fond), le lien dans `index.html`. **Les écrans**, dans un document simulé (§ 16.6) : les listes, leurs cinq onglets et leur recherche ; les comptes de l'accueil ; une banque d'avant le lot 3, sans feuille, ou abîmée : aucune exception, et la phrase ; la recherche par ce qu'un adversaire porte une fois résolu ; une banque forgée dont une cellule ou un numéro de ligne n'est pas un texte : rien de technique à l'écran, la recherche ne lève rien ; la fiche d'un adversaire : deux vues et leur clé propre, la vue lecture sans choix gardé, la carte amenée à l'écran quand on la choisit, la carte toujours dans la page et seule à l'impression, la provenance de chaque valeur sur le Chef de partie et le Homard furieux, l'origine du rang quand plusieurs lignes citent la capacité, la liste vidée par « aucun » et qui la vide, les introuvables barrés avec la ligne qui les cite, un nombre illisible, le doublon, le doublon à un signe invisible près sur les quatre fiches qui le disent (adversaire, type, bloc, élément), la phrase d'un tel doublon de types sous chacun des deux noms, et l'adresse forgée d'un signe, qui reste introuvable (lot 4), l'introuvable, un nom en HTML, un nom qui porte U+202E, le focus passé au lien de la rencontre quand le plafond est atteint ; la fiche d'un type ; la rencontre : + et −, le focus, la numérotation, l'ordre, les deux plafonds, « Vider », le mode d'emploi après la liste, l'adversaire incomplet signalé, l'impression après les polices ; depuis le groupe 2 du lot 4, **rien en clair** (avec la clé de démonstration, après +, +, −, « Vider », + : rien dans `localStorage`, une seule base, où aucun nom ne se lit ; sans clé, aucune base ; les mots du stockage absents des deux modules), la composition relue par les noms (une banque republiée la garde, un nom absent se perd, une autre banque rend une liste vide sans rien élaguer), relue après un rechargement simulé, à part par mode, vidée, rendue vide par une donnée abîmée, effacée de la mémoire par « Oublier », une seule lecture pour deux visites et un « + » fait pendant la lecture rejoué, un nom de plus de 200 signes qui ne s'écrit pas, la fiche d'un adversaire qui la lit aussi ; la garde elle-même (`tests/rencontre_gardee.test.js`) : l'aller-retour, sept clés dans leur ordre, ni nom ni nombre en clair, l'enveloppe d'un mode illisible sous l'autre, chaque borne de la relecture des deux côtés (60 et 61 entrées, 200 et 201 signes, 1 et 12 contre 0, 13, 1,5 et « 2 », une somme de 60 et de 61, un doublon, `__proto__`), autre sel ou autres itérations, autre clé, une date d'enveloppe à la forme de `toISOString` sous ses deux formes et refusée autrement (dix millions de signes que `Date.parse` lirait, des mots, sans ses millièmes, une forme juste que `Date.parse` ne lit pas), rien qui lève, l'écriture qui refuse ce qui ne se relirait pas, les magasins par mode, rien d'ouvert à l'import, la file à une place, la clé relue à chaque écriture ; l'adresse d'une anomalie de la feuille ; l'échelle tenue (son unique écriture de style : domaine Site) ; les règles d'`ecran.css` (cadre masqué à l'écran seulement, rétabli à l'impression ; sur un grand écran la carte et la lecture ensemble, sans choix de vue ; cibles de 44 px, lien d'un type compris ; un mot très long qui se replie, la grille qui défile seule, les faces d'une zone sur une ligne). Les listes d'un adversaire résolu disent d'où vient la dernière cellule écrite sans « // ». La mise en page et l'impression se mesurent dans un vrai navigateur (§ 16.8) |
| Préparation | première publication, mise à jour sous le même secret ; mot de passe à choisir, à saisir ou changé ; E1 refusé ; changement de mot de passe ; la clé de dépôt suivie d'une publication à l'autre ; circuit complet, de l'import à la lecture par un joueur |
| En ligne | les trois formats du § 15.8 dans les deux sens : personnage chiffré, ticket, fichier rangé, déchiffré, le même personnage ; aucun nom en clair dans le ticket, le fichier ni l'index ; seul un personnage enregistré, de la banque réelle, part ; « supprimer » sans personnage ; un ticket hostile (JSON, tableau, champ en plus, `__proto__`, format, action, identifiant hostile, date locale ou impossible, sel, IV, contenu, base64 sans remplissage ou url, signe non ASCII, trop gros) refusé avec une raison ; un personnage trop gros pour un ticket ne part pas ; un chiffré recopié sous un autre identifiant, ou d'une autre clé, ne se lit pas ; le contenu déchiffré hostile (bombe, format, UTF-8, autre identifiant, brouillon, démonstration) refusé ; l'index trié, trois champs, un doublon de casse refusé ; le rechiffrement sans lecture. La page : la démonstration ne dépose ni ne lit rien ; sans clé de dépôt, « non envoyé » et sa raison ; le ticket ouvert avec la clé, le sel de la banque en place vérifié d'abord ; les refus de GitHub (401, 403, 404, 410, 422, réseau) laissent « non envoyé », « Réessayer » le refait ; l'index lu sans cache, chaque fichier par sa version, une seconde lecture sans nouvelle requête ; une ancienne clé et un fichier hostile comptés à part, un mot de passe changé pendant la visite distingué d'une ancienne clé ; GitHub Pages en retard juste après un changement fait d'ici ne bloque pas le dépôt, une page en retard, si ; une version en ligne plus récente arrête l'envoi, sauf confirmation ; une lecture échouée n'est pas un personnage absent ; le rapprochement (rattrapé, attente, retard, suppression gardée tant que l'index ne se lit pas, copie plus ancienne qui ne cache pas la version en ligne) |
| Automate | lancé hors de GitHub, sur une simulation de l'API et de vrais dépôts git jetables : un ticket « creer » conforme rangé (fichier qui se déchiffre, index, commit du robot aux deux seuls chemins, message sans nom, ticket fermé et verrouillé, Pages demandée) ; « remplacer », ticket repassé sans effet (même deux tickets rejoués, déjà rangés : aucun commit), « supprimer », suppression d'un absent, passage sans ticket ; tickets non conformes (JSON illisible, autre titre, identifiant hostile ou en forme de jeton, trop gros, base64 faux, contenu en clair, sel périmé, corps vide, champ en plus, commandes de shell et chemins) fermés avec leur raison, sans rien recopier, écrire ni exécuter ; collision de casse ; inconnu (autre login, ou même login d'un autre compte) fermé et verrouillé sans commentaire, même quand la partie git s'arrête ; avalanche d'inconnus au-delà de la limite de pages : les plus anciens fermés, les autres au passage suivant, les tickets du propriétaire lus à part et rangés ; demande de fusion ignorée ; envoi refusé puis réussi, tickets rejugés sur la banque republiée ; cinq refus : aucun ticket du propriétaire fermé ; fichier illisible, intrus, ou `.gitignore` qui cache les fichiers rangés : arrêt sans commit ni fermeture ; chemin hors de `personnages/` : arrêt avant l'envoi ; la variable du jeton ôtée de toute commande git, le jeton à la seule commande d'envoi, jamais sur le disque ; Pages refusée ; lancé à la main, l'automate redemande Pages ; l'API et l'environnement de GitHub Actions. Aucun nom en clair nulle part |
| Routes et fiches | décodage des adresses de fiche (`#/capacite/Attaque%20de%20base`) et aller-retour des noms difficiles ; la fiche et la liste des blocs montrent leur type ; adresses abîmées, dont les noms d'`Object.prototype` ; un nom introuvable n'est jamais le titre ; recherche sans casse ni accents, sur les noms et les descriptions ; renvois résolus comme au contrôle ; « octroyée par », « porté par », nom affiché ; anomalies d'une ligne ; les adresses des adversaires, des types et de la rencontre, dont un nom forgé qui porte un demi-codet seul ; le lien de la navigation que marque chaque écran ; la recherche d'un adversaire par ce qu'il écrit ; l'index des adversaires et de leurs types, les lignes de la feuille Adversaires ; une banque d'avant le lot 3 indexée sans exception ; les entrées d'un nom comptent ses doublons à un signe invisible près (lot 4), celle du nom écrit d'abord, et aucune sous un nom que rien ne porte exactement ; un nom qui ne diffère d'un autre que par la casse, un accent ou une espace intérieure a ses propres entrées, et n'entre pas dans celles de l'autre ; l'adresse du combat (lot 4) : `#/combat`, et dix adresses abîmées autour d'elle (`#/combat/`, `#/combat/2`, `#/combats`, `#/Combat`…), la rubrique qu'elle marque, son lien après « Rencontre », et tout lien de la navigation écrit sous la forme que lit le contrôle (un lien écrit autrement manquait à la liste sans bruit) |
| Site | politique de sécurité du `<meta>`, avant scripts et styles, toute la table des directives et rien d'autre ; zoom permis ; ni script, ni style, ni gestionnaire en ligne ; chaque fichier appelé existe ; le graphe des modules se résout et atteint les seize écrans (le combat est le seizième ; seize de ses modules y sont nommés, dont la bulle et le journal de son écran depuis le groupe 2, avec la rencontre gardée), et tout module de `js/` y est, hors la veille ; manifeste, couleurs des jetons, icônes aux tailles dites, telles que les dessine leur outil ; contrastes, dont ceux des quinze couleurs du combat dans les deux thèmes, le texte à 4,5:1 (✓, ✗ et les chiffres dans le cadre d'un jet compris), les ronds et les traits (la hachure, son bord, le bord du cadre) à 3:1 sur le fond des cases, ces quinze-là déclarées dans le bloc sombre, chacune avec sa valeur sombre, sauf le bord du cadre, exempté par son nom, dont le gris tient dans les deux thèmes (§ 17.7) ; l'unique écriture de style du code (`tests/echelle.test.js`, déplacé là au groupe 2) : dans tout `js/`, les écritures sont dans `echelle.js` seul, quatre propriétés, `--echelle`, puis les trois de la bulle dans `placerBulle` et nulle part ailleurs, un alias du style refusé ; le calcul de la place (chaque côté, aucun, une ancre hors de la fenêtre, la flèche bornée, des pixels entiers), l'écouteur de changement de taille, un seul, retiré quand la bulle a quitté la page, aucun écouteur de défilement ; valeurs de `ecran.css`, de `personnage.css` et de `combat.css` tirées des jetons, hors les largeurs des `@media`, aucune police téléchargée par l'interface ; la banque de démonstration, au format 2, se déchiffre et vient du classeur d'essai, avec ce qu'y lit le simulateur de combat (lot 4 : ses comptes, les deux éléments, les deux capacités du bloc de base, mot pour mot) ; le mot de passe de démonstration, déjà en minuscules, saisi en majuscules, ouvre la banque, et la clé gardée la rouvre ; le format 1 ne s'ouvre plus ; au téléchargement, une empreinte de format 2 fausse et un format plus récent donnent leur message ; le diagnostic dit le format ; chargement : absente, présente, abîmée, `?v=`, clé gardée, mot de passe requis ou changé, stockage durable ; l'attente du mot de passe ne dépend pas de la peinture de la fenêtre ; le déverrouillage n'attend pas la réponse sur le stockage durable ; sans IndexedDB, la phrase au lieu de la case ; une erreur inattendue : un message. Dans un document simulé : le bouton « Publier » existe dans chaque état de l'espace auteur, et sa raison s'affiche ; la barre de publication reste collée au bas de l'écran ; « Oublier le mot de passe » ne laisse ni clé ni différences, même pendant une comparaison ; « Oublier la clé GitHub » annule la publication en attente ; « Se souvenir » décide de garder la clé ; la veille de 15 secondes, et rien sur une page chargée ; l'aide dit d'ajouter l'Atelier depuis son accueil ; `dom.js` refuse gestionnaires en texte, `style`, `srcdoc` et adresses étrangères, et n'affiche pas les signes qui commandent le sens de l'écriture, que les attributs gardent ; le document simulé refuse d'ajouter null ou undefined, que le navigateur afficherait, et son `querySelectorAll` rend, comme le navigateur, une liste qui se parcourt mais n'a ni `filter` ni `map`. L'espace auteur (lot 2 bis) : la section de la clé de dépôt (aide, état, saisie vérifiée ; la clé jamais à l'écran, dans un attribut ou un champ, ni gardée ; retirer, garder ; oubliée avec le mot de passe, et après une publication réussie ; la clé GitHub de l'auteur refusée ; une phrase en démonstration) ; le mot de passe : 7 signes refusés, 8 acceptés, deux saisies qui ne diffèrent que par la casse acceptées ; le changement compte les personnages avant l'envoi, puis écrit un seul commit ; s'il en laisse sous une autre clé, la section « Personnages en ligne » les montre aussitôt, avec la reprise ; une avance sans réponse : « Publiée » si la branche a avancé, sinon l'incertitude dite, et l'ancienne clé reste ; la vérification n'écrit rien, la reprise rechiffre. Le serveur local : la seule machine, les seuls fichiers du site, dont les polices, le personnage de démonstration et `personnages/` sous ses deux seules formes, casse comprise |
| Personnage | chaque règle du § 15.2 : la table des dés, bornes comprises ; les paires d'attaque et de défense ; les types mêlés et le cas sans armure ; l'ordre des zones, la grille et le maximum par zone, et l'interdiction du livret ; la qualité (X, 1, 2, 3, 1,5) et l'arrondi une fois l'opération faite, dont un cas où la virgule flottante se tromperait ; les expressions et leurs refus ; l'expression de mains nues et son dé vide ; le coût à la puissance ; les coûts 1, 3 et 6, le plafond de 10, le reliquat, les capacités reçues au-delà de 10 ; la capacité reçue deux fois ; le niveau 0 et les capacités à venir hors décompte ; les groupes ( ) et [ ], un choix disparu ; le style de combat ; le tirage (chaque constellation atteignable, rejet des valeurs biaisées) ; les points de lien ; la banque sans types ; les choix modifiés ou disparus ; ce qui manque à chaque étape, un bloc d'un autre type. Le format : aller-retour du fichier, champ inconnu ou manquant, `__proto__`, chaque champ et ses bornes, 64 Ko, JSON illisible, mode inversé, nom de fichier sûr ; le lien : aller-retour dans le fragment, lien abîmé, forgé, bombe de décompression, UTF-8 invalide, mode inversé. L'étagère : modes séparés, ordre, illisibles comptés, un personnage du format 1 converti, les notes ; une base bloquée par un autre onglet : l'étagère en mémoire et la raison, sans attendre. Le format 2 (lot 2 bis) : les places d'un objet, une seule arme tenue, les tirages ; le format 1 converti (arme principale, bouclier, armures portées, tirage) ou refusé s'il est abîmé ; un personnage neuf à 2 partout. Les places dans le calcul : pièces du pack portées, bouclier équipé (un seul), rangés sans effet ; le parcours signale une place fautive. Les adresses des écrans du personnage. La répartition du recto et son débordement ; le recto et le verso dans un document simulé (en-tête, cases cochées et grisées, reliquat, souffle, zones, corps, équipement, liens, légende, pied de page, suite du recto, toutes les capacités et les armes, un nom en HTML qui reste du texte) ; l'impression (A4 sans marge, couleurs, saut de page, barre non imprimée) ; les polices hébergées (Marcellus, Alegreya Sans, EB Garamond), appelées par `fiche.css` et `adversaire.css` seulement, et leurs trois licences ; le personnage de démonstration, fabriqué par son outil et complet, qui suit ses dix-neuf capacités ; Aubépine et les ajouts du lot 4 (§ 15.7) : les deux capacités nouvelles du bloc de base, leur coût, leur description, Passif et Intervention sur les siennes, les mêmes points. Les écrans : liste, parcours, réception, fiche (vues, impression, banque sans types). Le parcours du lot 2 bis : les descriptions, dépliées sur grand écran et repliées sur téléphone ; les boutons + et − des caractéristiques (de 2 à 6, « + » arrêté à 36, le focus qui passe au voisin) ; le tirage refait et compté, la saisie ; l'arme tenue remplacée, les packs (un seul à la fois, la pièce portée seule renvoyée au sac), un pack non proposé (A10) avec sa raison, tous les objets au sac, qualité 2, la pièce refusée sur une zone couverte, un seul bouclier, l'arme prise en main ; l'étape 8 : seules les capacités qui peuvent évoluer, + et − dans les bornes, la raison d'un « + » inactif, avant et après, le focus gardé sur le bouton actionné ; les descriptions gardent leur état quand l'étape se redessine ; les vignettes des étapes 3 à 6 (lot 4, groupe 2) : le résumé d'un bloc, mot pour mot, sur le classeur d'essai et un bloc fabriqué, des boutons radio natifs sous l'habit de vignette, des cases à cocher pour un groupe facultatif, la coche cachée aux lecteurs d'écran, la description et les choix du bloc choisi dessous, ouverts sur téléphone aussi quand ceux de l'étape 8 restent repliés, les choix d'un bloc quitté perdus, le focus gardé après le rendu, la constellation choisie en vignette « saisie à la main » avec le compte des tirages, la vignette déjà choisie qui ne change rien, des identifiants uniques, la feuille (44 px, la grille dans et hors du `@media`, le résumé sur deux lignes) ; le personnage de démonstration lu par une fonction partagée avec le combat (`tests/personnage_demonstration.test.js` : sans cache, un 404, une levée, un fichier illisible, un bon fichier, la phrase du personnage gardé, la question du doublon posée sans défiler) ; le catalogue des armes, l'objet décrit avant d'être ajouté, un refus dit près de l'objet et le focus sur lui ; « Modifier » : la copie de travail, reprise, « Enregistrer » à la place de l'original, « Enregistrer sous un autre nom » (un autre nom exigé) ; l'enregistrement dépose (« creer », « remplacer »). La liste en ligne : les rubriques, l'attente, « Réessayer », « Supprimer » pour tous, « Modifier » d'un personnage en ligne, la phrase de la démonstration ; le mot de passe changé pendant la visite, une suppression dont le personnage ne se lit plus, une copie plus ancienne (« Envoyer quand même », « Retirer de l'appareil »), une base bloquée. La fiche : la qualité des objets (saisie fautive refusée, redépôt, panneau resté ouvert, focus sur la confirmation, deux objets de même nom distingués), « Modifier », un personnage ouvert depuis le site, ou dont la lecture échoue (« Réessayer »), « tirée N fois ». La mise en page se mesure dans un vrai navigateur (§ 15.4) |
| Combat | le simulateur de combat (lot 4, § 17). **Le moteur, sans page, règle par règle** (§ 17.3 à § 17.6) : la forme d'un événement, d'une photographie et d'un contenu, chaque borne vue des deux côtés (dont cent tirages par dé, six cents façons par photographie et vingt de déplacement, 200 000 signes et 64 étages pour la source d'un adversaire, le compteur des identifiants), une grille de localisation à trou refusée, un contenu d'une autre version des règles reconnu comme tel et non dit abîmé ; les cases, la distance, les cases à portée, la pose d'office ; les noms courts, les jetons, les initiales, leurs collisions, un nom épuisé, un nom sans lettre, un nom qui finit par un chiffre et ne prend ni les initiales ni le jeton d'un exemplaire ; la chaîne et ses bornes, k désavantages, k relances, relancer et garder, le dé explosif (son seuil, l'enchaînement, sous désavantage, après une relance, le modificateur compté une fois, « exploser » seule suite), chaque transition refusée hors de son attente ; les plafonds de la préparation et leurs raisons, égaux à ceux de la rencontre, un personnage une seule fois, « Retirer » qui renumérote, la source de dés sans biais ; les sept modificateurs et les dix sources d'avantage et de désavantage, un par un et dans leur ordre, l'inversion dans les deux sens, un bonus au niveau 2 qui donne d10+2, le jet prêté sans désavantage de maîtrise, ce qui ne s'applique pas à un adversaire, chaque passif câblé actif et inactif avec sa raison, au niveau 0 compris ; les deux grilles, plusieurs dés de localisation, la face de contre-attaque que le décalage ne crée ni n'efface, les bornes du décalage, les dégâts zone par zone, dégrossir (chez un personnage, chez un adversaire, jamais sans dégâts ni en dégâts directs, pas sur un coup annulé), les dégâts directs, l'esquive et son imputation, deux dés sur la même zone, la blessure et son compte, la mort, ce qui dépasse et se perd ; quel événement est accepté à quel moment d'un geste, chaque code de refus, un refus qui rend l'état reçu, l'objet même, une capacité sans dégâts qui touche et se localise, la face de contre-attaque qui clôt le geste et arrête les dés, l'événement de trop au-delà de la borne du combat ; les tours, l'alternance, passer, la fin automatique, « Fin de tour », les actions retrouvées et celles qui manquent après une esquive, deux fins d'affilée au plus, un camp qui commence sans pouvoir agir, la fin du combat sans « Fin du tour » ; le paiement au premier dé et à la confirmation, « Revenir » qui ne dépense rien, une entrée par façon jouable (une ligne par puissance, pour un personnage comme pour un adversaire), la plus petite puissance payable qui atteint une case d'arrivée, X, le lien sur un personnage à deux jauges, l'adversaire qui ne paie pas le lien, chaque raison d'un bouton inactif, dont un déplacement qui n'offre aucune case, la portée et les cibles, le jet prêté. **Le journal** (§ 17.9) : chaque gabarit, mot pour mot, sur des gestes écrits à la main, ceux que la mission ne donne pas compris ; une valeur de dé passée sous zéro, écrite avec le moins du journal, sans aucun trait d'union ; ce que dit la région d'annonce après un dé, une esquive, une face décalée, et le bilan, en une phrase ; l'en-tête, le nom du fichier, les deux fins de ligne, aucune espace insécable ; les trente-six lignes du combat de référence refaites à la main. **Les vues** : chacune, ses titres, ses étapes, ses boutons et leurs raisons, ses saisies et leurs bornes, les annonces ; la cible choisie, gardée seule et inactive pendant le jet ; le dé écrit nu dans le contexte, et le bilan d'une relance ; la seule phrase de la mort, par son segment ; et la concordance : à chaque pas d'un combat joué, tout événement que porte un élément actif d'une vue est accepté par le moteur, tout événement que porte un élément inactif est refusé, et l'événement réellement joué ensuite est de ceux que les vues portaient. **Les rôles câblés** (§ 17.6) : chaque rôle de la démonstration reconnu par son nom, aucun reconnu en mode réel par un nom de démonstration, la ligne des absents, des empreintes de 64 signes hexadécimaux dont aucune n'est celle d'un nom de démonstration, et leur condensat commun, calculé hors dépôt d'après le tableau de la mission ; la reconnaissance par empreinte du mode réel, vue sur un tableau d'essai aux noms fictifs condensés à l'exécution, qui ne se mémorise pas. **Les photographies** (§ 17.2) : Aubépine et les cinq adversaires de la démonstration, champ par champ ; qui ne s'ajoute pas ; le sac ; l'ordre des groupes ; sur des banques fabriquées en mémoire, plusieurs dés de localisation, des dégâts propres, un coût négatif, un coût illisible, une capacité à venir, un souffle absent, deux armes de même nom, un adversaire à passifs câblés, chacun à son rôle et au rang que sa ligne écrit, une maîtrise que seule une arme rangée au sac donnerait, et qui ne lève rien ; toute photographie rendue est gelée, passe par JSON à l'identique, et passe la validation qui la relira ; un nom à retour de ligne devient une seule ligne, une description au-delà de sa borne est un refus d'ajout ; un demi-codet isolé devient une espace, dans un nom comme dans une description, un signe astral entier reste, et un nom fait seulement de demi-codets est un refus d'ajout ; les personnages disponibles, lus sans rien écrire, face au vrai rapprochement de l'écran Personnages. **L'enregistrement** (§ 17.8) : l'aller-retour, le mode à part, la révision entre deux onglets, le mot de passe changé, la donnée abîmée, l'absence d'IndexedDB, « Oublier » pendant une lecture lente, rien en clair ni dans la base ni dans `localStorage` ; la file à une place, jamais deux écritures à la fois, la clé relue à chaque écriture ; une enveloppe d'un format plus récent, que rien n'écrase ; une donnée abîmée jusque dans sa révision, que « Nouveau combat » remplace ; une enveloppe de plusieurs mégaoctets, ou piégée, qui se dit illisible sans rien faire lever, une date d'enveloppe qui n'a pas la forme de `toISOString` (dix millions de signes que `Date.parse` lirait, des mots, sans ses millièmes, une forme juste que `Date.parse` ne lit pas) qui la dit abîmée, la borne du chiffré à l'octet près, une écriture qui refuse ce qui ne se relirait pas, la révision bornée et son retour à 1, rien de lourd dans le tour de la demande ; chaque propriété de l'IndexedDB simulée. **La séance** : l'ouverture cas par cas (contenu refusé, révision discordante, rejeu refusé, autre version des règles), un rechargement en plein geste qui retrouve le moment sans attendre un dé déjà lancé, un combat dont une description tient sur deux lignes gardé puis repris, « Nouveau combat », le blocage, et, sur les deux magasins, une enveloppe longue, une révision démesurée, des identifiants épuisés. **Le rejeu**, sur le combat de référence : chaque préfixe rejoué égale l'état tenu un événement à la fois, journal compris ; l'état passe par JSON à l'identique ; tout ce que rend le moteur est gelé ; ni heure ni hasard (l'horloge et les générateurs remplacés par des fonctions qui lèvent) ; ni banque (les sources des photographies ôtées) ; le graphe des imports du noyau, clos et sans cycle, et son texte sans rien qui dépende de l'appareil ; des événements au hasard, à graine écrite, bien et mal formés, qui ne font jamais lever le moteur ; un dé jamais relancé : en plein geste, l'offre est la même après rejeu ; une ligne de plus au journal ne fait regarder aucune de celles qui la précèdent, `appliquer` ne recopie la liste qu'une fois par événement qui écrit, et le rejeu de N événements la recopie un nombre de fois qui ne croît pas avec N (100 et 1 000 passes, 50 et 500 paires « geste, annuler » : au plus une, armé dans le contrôle même par `appliquer` pas à pas) ; le rejeu rend ce qu'`appliquer` fait pas à pas, plages des maillons comprises (le combat de référence, le même suivi d'autant d'« annuler » qu'il a de maillons, 2 000 passes, 1 000 paires), son journal et chaque ligne gelés, chaque autre champ gelé en profondeur ; et le combat le plus long, 15 000 événements, se rejoue en entier, d'une traite comme par tranches de 1 000. **Le combat de référence fictif** (§ 17.10) : les cases d'office des ajouts, l'état final, lien compris, et les trente-six lignes du journal, mot pour mot, l'écart dit au signe près ; le suivi des ressources après chaque geste et le compte des événements, transcrits du calcul à la main ; le départ que dit le banc, chaque zone avec ses faces et son armure. **L'écran**, dans un document simulé (§ 17.7) : chacune de ses six parties sur des vues écrites à la main (ce qu'elle montre, la commande que porte chaque bouton et son origine, un bouton inactif qui ne fait rien, les nœuds gardés d'un rendu à l'autre quand la vue n'a pas changé, refaits quand elle a changé ; et, depuis la relecture de fin de groupe : l'ordre des blocs du jet, chaque rangée de choix en groupe que son intitulé nomme, une saisie refusée qui ne part pas et dit pourquoi, un réglage qui garde le focus, le libellé d'une face décalée, un nom accessible sans signe de sens, la table des zones nommée et ses en-têtes de ligne, « Case » et « Retirer » hors du volet, la carte qui n'offre rien quand on ne joue pas) ; l'écran entier : la préparation, la rencontre placée, un tour, la mort, le journal copié (accepté, puis refusé par le navigateur) et téléchargé (nom et contenu), l'annonce après chaque dé et une seule région qui change de texte, dans la page dès l'ouverture, le focus, un nom hostile qui reste du texte, « Nouveau combat » et son menu refermé, l'oubli, un rechargement, une cible « choisie sur la carte » ou « choisie ici », un état de garde qui prévient dit une fois, la dernière ligne du journal visible en revenant sur l'écran, les morts en dernier dans la liste d'une case, « Fiche complète » calculée du personnage photographié, la clé de table relue à chaque écriture et changée pendant la visite ; sa feuille lue comme un texte : des jetons seulement, trois `@media`, à 56rem, à 80rem, puis sous une souris, chaque règle partant d'une classe « combat », hors la seule racine qui porte la marge de défilement du volet, aucune classe hors de `combat-`, des classes d'état du contrat d'écriture et des deux classes communes du site (§ 17.7), aucun nom en « carte », les quinze couleurs dans les deux thèmes, les quinze longueurs du groupe 2 et `--fleche-bulle` égale à la flèche du placement, le nom court d'un jeton mesuré sur sa case et son plancher, un bouton du site inactif qui n'a pas l'aspect d'un bouton actif, une saisie refusée qui se voit, le dé relancé qui garde le rouge de son échec, sa valeur barrée par un trait de fond et non par `text-decoration`, la seule phrase de la mort au journal, la préparation, la barre, les réglages à la main et les fiches rangés comme le dit le § 17.7. Avec eux, dans les domaines voisins : les trois fonctions de maîtrise et les champs neufs de la résolution (Adversaires), les sources et les éléments d'une capacité (Personnage), la rencontre préparée lue par les noms, sans rien vider, le câblage d'`application.js` lu dans son texte (l'écran après la banque, un seul appel, l'oubli du combat puis celui de la rencontre à leur place, aucun enregistrement ouvert hors de l'écran). **Le groupe 2** (complément, § 9), chaque contrôle neuf vu armé puis désarmé (§ 17.11) : **l'annulation** (`tests/combat_annulation.test.js`) : chaque genre de geste défait, l'état d'avant revenu hors du journal, du pas, de l'annonce et de la pile ; la mort, la fin du combat, une et deux fins automatiques défaites avec leur geste, jamais seules ; geste après geste jusqu'au lancement, qui ne se défait pas, puis « Rien à annuler depuis le lancement. » ; les trois raisons, dans leur ordre ; la pile chaînée, gelée, qui partage les objets de son état ; « annuler » compté pour le plafond ; le rejeu des annulations, et le contenu qui passe par JSON sans la pile ; **l'offre allégée** (`tests/combat_offre_allegee.test.js`) : à chaque état du combat de référence, et sur des photographies piégées, le verdict du groupe 1, objet pour objet ; **le plafond** : 15 000 et sa phrase, l'alerte à 13 499 et à 13 500, le rejeu qui cède toutes les 1 000 événements, une recopie du journal par événement qui écrit, aucune d'un événement rejoué à l'autre, un rejeu dépassé par « Nouveau combat » qui n'installe rien ; **la version des règles 2** : un combat du groupe 1 se dit « commencé avec une autre version du simulateur » ; **les règles** : une façon par puissance jouable d'un adversaire, sa résolution à une puissance, identique au rang sur les adversaires de la démonstration et du classeur d'essai ; la défense au choix à égalité, son réglage refusé après le premier dé, son retour au défaut avec la cible ; la cause de maîtrise d'une façon ; **les initiales** du § 17.2 ; **le journal en segments** (`tests/combat_segments.test.js`) : la concaténation des segments égale au texte, gabarit par gabarit et sur les trente-six lignes du combat de référence ; deux noms piégés (« → », « ✓ », « contre », « Annulé : », « […] »…) ; les cadres et les dés insécables, ni U+00A0 ni U+202F ; la ligne en cours à chaque moment d'un geste et, à chaque événement du combat de référence, début exact de la ligne qui s'écrira ; les trois lignes « Annulé » et leur plage ; **les vues** : la bulle d'Aubépine et celle du Chef, les survols, les hachures de portée 0, 1 et 2, d'un déplacement, et l'absence de hachure, chaque phrase de cause, le compte, la main, l'inversion, l'en-tête du jet, la barre (trois raisons, quatre questions, la limite), le journal barré, le bandeau, le lien de la rencontre, et la concordance, commandes à deux événements et « annuler » comprises ; **l'écran** : la bulle (`tests/combat_ecran_bulle.test.js` : son ouverture par le jeton, « Qui joue ? », « Jouer » et « +k », son contenu, « Fermer », « Réduire » et l'onglet, le geste fini, Échap en deux temps, Maj+Tab, le clic au-dehors, sa place aux seuls moments dits, l'infobulle et ses 300 ms de grâce, ses hachures, l'aperçu au doigt) ; le contenu d'une action et la zone sous la carte, le volet et le jet sous la carte sur un téléphone ; le journal et le bandeau (`tests/combat_ecran_journal.test.js` : chaque segment et sa classe, rien d'autre de coloré, les cadres, les lignes barrées, la coupe à 2, 3 et 6 phrases par une mesure donnée, « Journal ↓ » et le clic à la souris, jamais au doigt) ; le plateau (la hachure, la légende, la raison d'un jeton inactif) ; la préparation (le personnage de démonstration, liste vide ou non, absent en mode réel ; le lien vers l'écran Rencontre) ; l'écran assemblé (le combat de référence joué par la bulle, mot pour mot ; l'annulation de bout en bout ; 13 500 dit une fois par combat ; le personnage de démonstration ajouté sans rien changer au combat ; la rencontre composée après l'ouverture du combat, une banque republiée, une composition déjà gardée : le bouton actif) ; **aucun défilement** (`tests/combat_ecran_defilement.test.js`) : dans les modules de l'écran et `echelle.js`, lus dans leur texte, tout `focus` porte `preventScroll`, un seul `scrollIntoView`, celui de `montrerLeJournal()`, ni `scrollTo` ni `scrollBy`, deux écritures de `scrollTop` : celle de la liste du journal et, dans la bulle, celle de son propre défilement, dans `montrerDansLaBulle` seule ; le contrôle voit chaque faute sur dix-huit sources fautives, dont un second `scrollTop` de la bulle hors de cette fonction et une `montrerDansLaBulle` qui ferait défiler la page ; **la feuille** : la bulle et le volet, les lignes de la bulle (`data-ligne`) à 36 px sous une souris, pour elles seules, la hachure avant `.active` et `.possible`, le bandeau, les segments et le cadre, ni `transform` ni `filter` sur `.combat` et `.combat-cadre`, la liste close des classes neuves et l'état `portee`. **Depuis la relecture de fin du groupe 2** (§ 14), chaque contrôle neuf vu armé puis désarmé : **l'écran** : « Annuler le dernier geste », montré inactif pendant un geste non payé, ne demande rien, même quand le clic au-dehors, qui ferme la bulle, le rend actif, et le focus reste sur lui ; ouverte par un appui du doigt sur le jeton, la bulle ne laisse le focus de sa première ligne ouvrir ni infobulle ni hachure, sur un téléphone comme au-delà de 56rem, et l'ouvre au clavier (un `focus()` fidèle du document simulé, qui déclenche `blur` et `focus`) ; ce qui défile dans la bulle repart du haut à chaque ouverture et quand l'onglet la rouvre, pas à un dé, et le focus posé comme l'aperçu qui s'ouvre y sont amenés dans la partie vue ; Échap ferme l'infobulle d'une ligne survolée le focus hors de la bulle, sans le bouger, et les seules hachures de « Jet d'attaque » au premier Échap ; dans la liste d'une case, Maj+Tab depuis son premier jeton mène au « +k » qui l'a ouverte, d'où Échap la ferme, et sans protagoniste ni case l'appui n'est pas pris ; l'aperçu ouvert au doigt porte `aria-expanded` et `aria-controls` sur sa ligne, ôtés à sa fermeture, rien sur un passif ; pendant la reprise, une seule région polie ; rouverte au rechargement en plein jet, ou à 13 500 événements, la bulle se place après le bandeau et la zone d'avis du même rendu, sa flèche au milieu de la case, entière dans la fenêtre, et un dé ne la replace pas ; les vues écrites à la main des contrôles de l'écran (la liste, le jet payé, l'attaque du Chef) ont, sur deux niveaux, les clés de `vuePanneau` au même moment du combat de référence ; **le bandeau** : quand même le minimum ne tient pas, la première phrase garde le nom de qui agit, entier, suivi de « … » (l'attaque, la défense, la passe, le jet de caractéristique, la ligne en cours), et une ligne sans lui garde la règle première ; **la feuille** : la flèche de la bulle (aucune règle ne repose une couleur de bord après la première règle de côté), une plaque du fond sous les jetons et le « +k » d'une case hachurée, hors de qui joue, où `--texte` tient 4,5:1 dans les deux thèmes, `data-ligne` porté par les seules lignes (lu dans `combat_action.js`), « Passer son tour », les rangées du jet et les passifs à 44 px, les lignes et « Passer son tour » en rangées plates, l'inactive en trait discontinu, le passif souligné en pointillé sous son nom et sans bord, la marge de défilement du volet tant qu'il est montré et aucune à 56rem, ni `content-visibility` ni `contain-intrinsic-size` nulle part dans la feuille ; **le noyau** : l'origine d'une capacité à mains nues, le titre de son groupe ; « Jouer » d'une fiche qui suit le choix des jetons ; une raison sans demi-codet isolé, un signe astral entier comptant deux unités sur les 80 ; la raison proposée d'un nom coupé au milieu d'un signe astral, de 80 unités au plus, acceptée par le moteur partout où elle est proposée ; une photographie qui porte un demi-codet isolé, refusée à l'ajout comme à la relecture. La mise en page ne se contrôle pas ici : elle se mesure dans un vrai navigateur (§ 17.11 : les mesures du 12/10/2026 et du 25/10/2026, leurs réserves, et ce qui n'est pas fait) |

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
la comparaison des noms (`js/banque/noms.js`) retire vingt-deux signes de
format, pour tout le site (§ 6.3) : le renvoi est retrouvé et signalé (A1),
le doublon est dit (E3, E16, A16), et les fiches le comptent de même.
Aucun cas dans le classeur réel au 11/10/2026. Les deux points que la
correction laissait sont **tranchés par l'auteur le 25/10/2026** (groupe 2
du lot 4) :

- **U+061C** entre dans la liste (vingt-deux signes) : l'affichage l'ôtait
  déjà (§ 10.1), et un nom qui ne différait d'un autre que par lui restait
  un autre nom, que rien ne distinguait à l'écran, sans E16 ni A1.
- **E3 est élargi** : deux capacités dont les noms ne diffèrent que d'un
  signe invisible, quelles que soient leurs puissances, ont un E3 à la
  plus basse des lignes de la seconde, avec son message, qui cite la
  première ligne de la première (§ 6.3). L'import, lui,
  ne change pas : elles restent deux capacités ; un renvoi exact prend
  celle qu'il écrit, et un renvoi approché vers ce nom reste ambigu (E4
  depuis un bloc, E13 depuis un type ou un adversaire), mais E3 dit
  désormais la cause à la ligne où elle se corrige.

Ce que la correction **laisse encore**, à trancher par l'auteur s'il le
souhaite :

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
à un arrêt d'essais (§ 13). Celles qui portent « (25/10) » ont été
décidées par l'auteur le 25/10/2026, à l'arrêt d'essais du groupe 1
(complément du groupe 2, § 3 et § 6) ; les autres restent à confirmer.
**Chacune est à écrire dans le livret**, à la section dite. Les capacités
que le simulateur reconnaît s'y nomment par leur rôle (§ 17.6), jamais
par leur nom du vrai classeur ; les rôles `bonus_precision` et `petit`,
que la démonstration n'a pas, ont été confirmés par l'auteur le
25/10/2026. Les exemples viennent de la démonstration. Les règles
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
4. **Le dé miroir** (groupe 3) : la valeur opposée vaut faces + 1 − valeur
   (11/10), prise sur la valeur brute, avant les modificateurs. Section
   « Dé miroir ».
5. **Le dé explosif.** La valeur maximale s'entend modificateurs compris ;
   le modificateur ne compte qu'une fois ; le dé explose tant qu'il montre
   sa face maximale et que la somme reste sous la difficulté. Section « Dé
   explosif ».
6. **Le coup critique** (groupe 3). Le quatrième dé ne se propose qu'aux
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
    un adversaire : un décalage jusqu'à 20 sur un personnage reste exclu
    (25/10 : la convention ne change pas, c'est au livret d'en décider).
    Sections « Jets de localisation » et « Contre-attaque », à accorder.
13. **Les blessures** : le −1 par zone sans résistance vaut pour les dés de
    la chaîne, pas pour le dé de localisation. Section « Ressources ».
14. **Les adversaires** : leur souffle ne se recharge pas pendant un
    combat, et n'annule pas de dégâts (11/10) ; une zone sans résistance
    est « blessée », sans effet calculé (11/10) ; ils meurent à 0 de corps
    (11/10) ; un coût en lien ne se paie pas, et le journal le dit ; **ils
    choisissent leur puissance de 1 à leur rang, parmi celles qui ont une
    variante, comme un personnage de 1 à son niveau (25/10)**, et une
    capacité qui n'évolue pas garde sa seule puissance (jusqu'au groupe 1,
    ils jouaient leurs capacités à leur rang) ; ils n'ont que les capacités
    de leur ligne : sans capacité de déplacement, un adversaire ne se
    déplace pas, sauf par le clic droit (groupe 3) ; les bonus et malus +N des
    passifs ne s'appliquent pas à eux. Section « Caractéristiques d'un
    adversaire » (lot 3, plus haut).
15. **Les effets « jusqu'à votre prochain tour »** cessent au début du
    prochain tour du camp de leur auteur (11/10) (groupe 3). À la mort d'un
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
    (groupe 3). Section « Jets d'attaque ».

**Les précisions**, que ni le livret ni ces vingt-deux points ne portent.
La mission en dit quatre ailleurs qu'en sa liste (son § 8.4, accepté le
11/10/2026 : les points 23, 24 et 33, et le cœur du 34) ; les vingt
autres ont été arrêtées le 12/10/2026 : dix-neuf en écrivant le moteur,
par l'agent principal, par le contrat d'écriture du lot ou par un lot
d'écriture ; la dernière (point 46) était dans le moteur sans être écrite
nulle part, et c'est la relecture de fin de groupe qui l'a relevée.
**L'auteur ne les a pas vues**, et les confirme ou les corrige à un arrêt
d'essais. Le complément du groupe 2 (25/10/2026) ne tranche que le point
30 ; **les autres, de 23 à 46, restent « à confirmer »**, avec la lecture
de la face de contre-attaque (point 41, l'action et le coût de
l'attaquant restent payés), jusqu'à la réécriture du livret. Chacune est
réversible, et **à écrire dans le livret** de même, ou, pour ce qui tient
à une cellule, dans le classeur et son `lisez_moi`.

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
    une variante (des variantes 1 et 3, au niveau 3 : 1 et 3), et de 1 au
    rang pour un adversaire (point 14). Une capacité qui n'évolue pas se
    joue à la puissance 0 chez un personnage, à sa seule puissance chez
    un adversaire. Section « Capacités ».
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
    (c'est la fiche, § 15.2). **C'est le défaut proposé (25/10)** : le
    livret (« Jets de défense ») laisse ce choix au joueur, qui choisit
    l'autre type dans le contexte du jet, jusqu'au premier dé ; chaque jet
    de défense repart du défaut, et les caractéristiques du type choisi
    donnent les bonus (§ 17.4). Jusqu'au groupe 1, l'écran affichait le
    type retenu sans le laisser changer. Section « Jets de défense ».
31. **Une capacité reçue de plusieurs origines** ne se range qu'une fois,
    ses lignes sous la première qui la donne valablement, dans cet ordre : l'arme tenue,
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
40. **Une seule esquive par attaque** (groupes 1 et 2) : elle s'offre au
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
  sa ligne est inactive et dit « aucune case à sa portée » (§ 17.6 ; ces
  mots ne sont pas de la mission). Aucun cas dans la démonstration ni dans
  le classeur réel au 12/10/2026. Section « Cases de combat », ou le
  classeur.
- **Les charges des consommables, les points d'historique, la recharge du
  souffle et du lien, les effets de terrain d'une case** : hors du lot ;
  rien n'en est calculé.

**Des bornes et des phrases que la mission ne donne pas**, posées le
12/10/2026 par les corrections de la relecture de fin de groupe (§ 14),
puis revues au groupe 2. Ce ne sont pas des règles du jeu, et rien n'en va
au livret ; elles sont ici pour être confirmées ou corrigées à un arrêt
d'essais, avec les précisions. Chacune est réversible. **L'auteur en a
tranché trois le 25/10/2026** (complément du groupe 2, § 3) : le plafond
des événements, le nom court des jetons et la carte sur un téléphone ; il
n'a pas vu les autres.

- **Les bornes** : **15 000 événements par combat, chiffre confirmé par
  l'auteur le 25/10/2026**, quelle que soit la mesure (5 000 au groupe 1,
  20 000 avant sa relecture de fin de groupe) ; à 13 500, un
  avertissement ; un rejeu qui rend la main au navigateur tous les 1 000
  événements (§ 17.3) ; 100 tirages par dé ; un compteur des identifiants
  arrêté à 99 999 (§ 17.3) ; 600 façons par photographie, dont 20 pour
  ses capacités de déplacement ; 200 000 signes pour la source d'un
  adversaire (§ 17.2) ; une révision de 2^40 au plus, qui repart de 1 à
  sa borne (§ 17.8).
- **Les phrases** : « Ce combat a épuisé ses identifiants : commencez-en
  un nouveau. » ; à la suite de « Ne s'ajoute pas : », « la source de la
  photographie dépasse 200 000 signes. », « la photographie compte plus de
  600 façons. » et « les capacités de déplacement comptent plus de
  20 façons. » ; dans le refus d'un combat gardé, que l'écran ne montre
  pas, « L'événement « de » : « valeurs » compte plus de 100 tirages. » et
  « Le compteur des identifiants n'est pas un entier de 0 à 99 999. » ;
  sur une fiche, « sans effet » et « niveau 0 » (point 45) ; sur une ligne
  de déplacement, « aucune case à sa portée » ; depuis le groupe 2, le
  refus du 15 001e événement, « Ce combat a atteint 15 000 événements :
  commencez-en un nouveau. », et l'avertissement, « Ce combat approche de
  sa limite (13 500 événements sur 15 000) : copiez ou téléchargez le
  journal ; au-delà, il faudra en commencer un nouveau. »
- **Les textes de l'écran**, posés par ses corrections (§ 17.7) : à une
  saisie refusée, « Un nombre entier de −20 à 20 est attendu. », aux
  bornes de la saisie, « Un nombre entier est attendu. » sans bornes, et
  « Une raison est demandée. » ; le libellé d'une face à décaler, « Décaler
  le dé 16 : face 18, bras droit », et le titre d'un dé décalé, « d20 :
  16 » ; le nom de la table des zones d'une fiche, « Zones : », suivi du
  nom du protagoniste. **Les boutons + et − de la puissance sont retirés**
  au groupe 2, avec leur nom (« Baisser la puissance (actuelle : 2) »,
  « Monter la puissance (actuelle : 2) ») et le bouton qui portait d'office
  la plus haute puissance payable : une ligne par puissance les remplace
  (§ 17.6). Les phrases d'écran du groupe 2 sont au § 17.7, « à
  confirmer ».
- **Une mesure de l'écran** : à partir de 56rem, le nom court d'un jeton
  de la carte à 15 % du côté de sa case, 9,8 px au moins, quand le petit
  texte du site fait 14 px (§ 17.7, avec sa réserve mesurée) ; **inchangé
  par décision de l'auteur, le 25/10/2026** : il les lit bien à
  mi-fenêtre, et le plancher de 9,8 px reste. De même, la carte sur un
  téléphone (ses initiales très petites à deux par case, sa grille pâle)
  ne change pas.

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
| **4 — Simulateur de combat** | groupe 1, le combat jouable : le signe invisible dans les noms, le classeur d'essai, le moteur du combat, l'enregistrement chiffré, l'écran ; groupe 2, l'ergonomie et les correctifs : la bulle d'options à côté des jetons, le survol et la portée hachurée, les causes, le bandeau, aucun défilement, le volet du téléphone, « Annuler le dernier geste », le journal en couleurs, une ligne par puissance, la puissance des adversaires, la défense au choix, 15 000 événements, la rencontre gardée chiffrée, le personnage de démonstration au combat, le créateur en vignettes ; groupe 3, les règles fines et la main du MJ : les interventions, la contre-attaque, le coup critique, le dé miroir, les passifs payants, la palette de modificateurs, les états, le clic droit, plusieurs cibles (§ 17) | l'auteur : un arrêt d'essais entre deux groupes ; § 12, lot 4 |
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

**Le lot 4 en est à la fin de son groupe 2** (25/10/2026, spécification
1.5), selon la mission du 12/10/2026 (`plans/instruction_lot4.md`), validée
par l'auteur avec la maquette du 11/10/2026 (`plans/maquette_simulateur.html`
et ses deux rendus, hors dépôt), puis selon le complément du 25/10/2026
(`plans/complement_lot4_groupe2.md`), qui prime sur elle. Il se fait **en
trois groupes, chacun d'un seul tenant, avec un arrêt d'essais entre deux
groupes** :

| Groupe | Contenu | Spécification |
|---|---|---|
| 1 | le combat jouable (12/10/2026) | 1.4 |
| 2 | l'ergonomie et les correctifs (25/10/2026) | 1.5 |
| 3 | les règles fines et la main du MJ : le § 13 de la mission (interventions, contre-attaque, coup critique, dé miroir, passifs payants, palette, états, clic droit, plusieurs cibles) | 1.6 |

Les essais de l'auteur après le groupe 1 ont fait naître le groupe 2 :
son complément, validé par l'auteur avec une maquette d'ergonomie
(`plans/maquette_ergonomie.html` et ses rendus, hors dépôt), dit ce qui
change ; partout où la mission dit « groupe 2 » pour le contenu de son
§ 13, il faut lire « groupe 3 ». Le groupe 3 ne commence que sur la parole
de l'auteur, après un nouvel arrêt d'essais ; un complément
(`plans/complement_lot4_groupe3.md`) pourra l'écrire. Les étapes du
groupe 1 :

1. **le signe invisible** dans les noms, correction recommandée au lot 3
   (§ 6.3, § 12) ;
2. **le classeur d'essai** et la démonstration : ce qui manquait au
   simulateur (§ 10.3) ; ces deux étapes, commit `40db3a0`, 458 contrôles ;
3. **le moteur du combat**, sans page (§ 17.1 à § 17.6) ;
4. **l'enregistrement** chiffré (§ 17.8) ;
5. **l'écran** (§ 17.7), sans ce qui est aux groupes suivants ; ces trois étapes,
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
   désormais ce qu'il vérifie (commit `d51c16a`). À ce commit, les
   contrôles de l'écran n'étaient pas mis à l'épreuve (plus bas) ;
7. **la fin du groupe** : la spécification 1.4 (§ 17, nouveau ; § 0, § 2,
   § 9, § 11, § 12 amendés) et `CLAUDE.md` ; une relecture de la
   spécification, onze constats ; la relecture de fin de groupe, sept
   relecteurs à sept angles, soixante constats (§ 14) ; ses corrections,
   chaque défaut vérifié avant d'être corrigé (une sonde, une mesure, la
   lecture du code, ou un regard dans un navigateur), chaque correction
   mise à l'épreuve : 184 casses, toutes vues. Les corrections du moteur
   (40 casses) sont dans le commit `c4cff7d`, avec l'étape 6 ; celles de
   l'enregistrement et des bornes (32 casses) et les trente points de
   l'écran (112 casses) dans le commit `8032ce2`, 1 517 contrôles. Puis
   l'écran remesuré dans Edge et dans Firefox, sans case qui déborde, et
   le temps d'un clic repris poste plus calme : la cible de 100 ms est
   tenue dans les deux (§ 17.11) ; le site en ligne comparé, octet pour
   octet, au commit `8032ce2` ; le commit de fin de groupe et le compte
   rendu.

**Un écart à la méthode**, au groupe 1, relevé par sa relecture : le
commit `fda3a2a` (les étapes 3 à 5) a été envoyé sans son paragraphe,
contre la règle de `CLAUDE.md`, « la spécification s'amende avec le
code ». Dans le dépôt public, la spécification est restée en version 1.3,
sans § 17, jusqu'au commit `c4cff7d`, qui porte la version 1.4.

**À la fin du groupe 1**, les contrôles de l'écran écrits avant la
relecture ont été mis à l'épreuve (369 casses, § 17.11), et le commit de
fin de groupe comptait 1 526 contrôles, que le crochet passait à l'envoi.
Le compte rendu du groupe (`plans/compte_rendu_lot4_groupe1.md`, hors
dépôt) donne l'issue de GitHub Actions sur ce commit, les agents et leur
coût, et la liste des essais de l'auteur, qu'il a faits avant le
groupe 2.

**Les étapes du groupe 2**, l'ergonomie et les correctifs, d'un seul
tenant, sans validation entre elles :

1. **la conception** : un contrat d'écriture, hors dépôt
   (`plans/lot4_travail/groupe2/contrat_g2.md`), tiré de trois conceptions
   (le noyau, l'écran, le bord), d'une critique de complétude et d'une
   synthèse ; dix-neuf lots aux fichiers disjoints, en six vagues de
   quatre lots au plus, chaque lot rendant ce qu'il avait dû préciser du
   contrat. Aucun arrêt de règles : rien ne manque au livret pour ce
   groupe, la puissance des adversaires venant de l'auteur et la défense
   au choix du livret ;
2. **la vague 1**, commit `4af944f` : le socle du noyau (15 000
   événements, l'alerte à 13 500, le rejeu par tranches de 1 000, la
   version des règles 2, l'événement « annuler », le réglage de la
   défense, la cause de maîtrise d'une façon, l'égalité du dé de
   défense) ; les initiales, U+061C et E3 élargi ; la garde chiffrée de la
   rencontre ; le placement de la bulle dans `echelle.js` ;
3. **la vague 2**, commit `5178a48` : la puissance des adversaires (la
   résolution à une puissance, une façon par puissance) ; le journal en
   segments et la ligne en cours ; la défense à égalité dans les
   circonstances ; l'écran Rencontre qui garde sa composition et la relit
   par les noms ;
4. **la vague 3**, en deux commits, la mémoire du poste l'ayant
   interrompue (plus bas) : `772d03d`, les feuilles, le plateau, les
   fiches, la préparation ; puis `50df336`, avec une part de la vague 5 :
   l'annulation et l'offre allégée, une ligne par puissance, le contenu
   de la bulle et la zone sous la carte, le personnage de démonstration
   partagé, le créateur en vignettes ;
5. **la vague 4**, commit `3e46abb` : les vues de la bulle, du journal,
   du bandeau et de la barre ; la séance et son rejeu par tranches ; la
   bulle, ses infobulles et ses hachures ; le journal en couleurs et le
   bandeau à l'écran ; le banc sur le classeur réel, sans écart ;
6. **la vague 6**, commit `c98ac84` : l'écran assemblé, sans défilement
   automatique, et son contrôle ; 1 774 contrôles, aucun échec ;
7. **la fin du groupe** : les captures et les mesures dans Edge et dans
   Firefox (§ 17.11) ; la spécification 1.5 ; la relecture de fin de
   groupe sous quatre angles (la conformité au complément et à la
   maquette ; le téléphone, le clavier, les lecteurs d'écran et les
   contrastes ; la sécurité ; la performance) et ses corrections (§ 14) ;
   l'envoi ; le compte rendu (`plans/compte_rendu_lot4_groupe2.md`, hors
   dépôt). Rien n'a été envoyé avant la fin du groupe : les commits des
   vagues sont des états de passage, où des contrôles d'autres modules
   échouaient jusqu'à la vague qui les reprenait.

**La conduite du lot.** Les agents sont « autant que nécessaire »
(décision de l'auteur du 29/09/2026) ; leur compte et leur coût sont au
compte rendu de chaque groupe. La mémoire du poste a été veillée tout au
long, une panne ayant interrompu le lot 3. Au groupe 1, le seuil d'arrêt
de la mission, 18 Go de mémoire validée, a été relevé à 20 par l'auteur
le 12/10/2026, sans arrêt pour mémoire. Au groupe 2, le poste était déjà
près de 20 Go sans les agents : pointe à 21,09 Go à 12 h 48, pendant la
vague 2 ; le groupe s'est mis en pause, et l'auteur a relevé le seuil à
21 Go le 25/10/2026 à 13 h 11. À 13 h 43, pendant la vague 3, le poste
est monté à 21,38 Go sur 22,8 : deux lots ont été interrompus, puis
relancés. Tout au long : un seul processus de mutation à la fois, et la
suite complète sur deux processus au plus.

**Un point de la mission n'est fait par aucun agent**, au groupe 1 comme
au groupe 2 : « le site en ligne montre le simulateur dans la
démonstration, et un combat s'y joue jusqu'au bout ». Y ouvrir la
démonstration demande de saisir son mot de passe, et la règle de sécurité
de l'outil interdit à un agent de saisir un mot de passe hors du poste
local, même public. La vérification en ligne s'arrête donc à l'écran du
mot de passe, après la comparaison, octet pour octet, des fichiers servis
à ceux du commit de fin de groupe ; le combat joué en ligne est un essai
de l'auteur.

**Ce qui reste à l'auteur, à l'arrêt d'essais du groupe 2** (la liste et
ses liens sont au compte rendu) : d'abord, sur chaque appareil et dans
chaque mode, « Nouveau combat », car le combat gardé au groupe 1 ne se
reprend plus (§ 17.8) ; la démonstration sur son téléphone, le personnage
de démonstration ajouté depuis le combat, puis le Chef de partie et deux
Marmitons de corvée, jusqu'au bout (le volet, l'aperçu, le jet sous la
carte, le bandeau) ; sur son ordinateur, un combat réel avec deux de ses
personnages en ligne et une rencontre composée à l'écran Rencontre, posée
d'un clic après un retour au combat par le menu, joué avec la bulle (le
survol, les hachures, les causes, le bandeau, les cadres et les couleurs
du journal) ; un adversaire à deux puissances de déplacement qui avance
d'une case, et joue la première ; « Annuler le dernier geste » sur une
attaque, puis sur une fin de tour ; la rencontre retrouvée après un
rechargement ; les étapes 3 à 6 du créateur en vignettes ; si l'un de ses
personnages a deux types d'armure à égalité, l'autre type de défense
choisi avant le premier dé ; puis confirmer ou corriger ce que le § 12 et
le § 17.7 laissent « à confirmer ».
Rien de réel n'est publié par le lot : seul l'auteur publie.

---

## 14. Révisions

**1.5 — 25 et 26/10/2026.** Lot 4, groupe 2 : l'ergonomie et les correctifs du
simulateur de combat.

- Décisions de l'auteur du 25/10/2026, par le complément du groupe 2
  (`plans/complement_lot4_groupe2.md`), validé avec la maquette
  d'ergonomie et relu par un agent indépendant (§ 1, § 2, § 13) : le lot 4
  en trois groupes, le contenu du § 13 de la mission passant au groupe 3 ;
  le jet sur ordinateur dans une bulle à côté des jetons (vue 2 bis) ;
  « Annuler le dernier geste » ; l'encadrement des résultats d'un jet, à
  l'écran seulement ; la puissance au choix, adversaires compris (§ 12,
  point 14) ; la défense à égalité au choix du joueur, le type retenu
  devenant le défaut proposé (point 30) ; 15 000 événements ; les
  initiales, la première lettre puis la première qui distingue ; U+061C
  et E3 élargi ; la version des règles 2, un combat du groupe 1 ne se
  reprenant pas. Confirmés : les rôles `bonus_precision` et `petit`.
  Laissés tels quels : le nom de capacité resté dans l'historique public,
  les empreintes des rôles câblés, les noms courts des jetons et leur
  plancher de 9,8 px, la carte sur un téléphone, le décalage de
  localisation (convention 12, au livret d'en décider). Abandonné pour
  l'instant : saisir le résultat d'un vrai dé.
- **La conception**, hors dépôt : trois conceptions (le noyau, l'écran,
  le bord), une critique de complétude, une synthèse, puis un contrat
  d'écriture (`plans/lot4_travail/groupe2/contrat_g2.md`), qui tranche ce
  que le complément ne dit pas sans rouvrir ses choix ; dix-neuf lots aux
  fichiers disjoints, en six vagues (§ 13). Aucun arrêt de règles : rien
  n'est à écrire dans le Word pour ce groupe.
- **Vague 1** (commit `4af944f`) : le socle du noyau (les bornes, la
  version des règles 2, l'événement « annuler », le réglage de la
  défense, la cause de maîtrise d'une façon, l'égalité du dé de défense ;
  § 17.1, § 17.3) ; les initiales (§ 17.2) ; U+061C et E3 élargi (§ 6.3,
  § 10.1, § 12) ; la garde chiffrée de la rencontre (§ 7.2, § 16.6) ; la
  place de la bulle dans `echelle.js`, seconde écriture de style admise
  (§ 10.1). 154 contrôles des lots ; 190 casses, toutes vues.
- **Vague 2** (commit `5178a48`) : la puissance des adversaires, une façon
  par puissance jouable, résolue à cette puissance (§ 17.2, § 17.6) ; le
  journal en segments, la ligne en cours, la ligne « Annulé » (§ 17.9) ; la
  défense à égalité dans les circonstances (§ 17.4) ; l'écran Rencontre qui
  garde sa composition et la relit par les noms, et la cause réelle du
  bouton « Placer la rencontre préparée » grisé, mesurée avant d'être
  corrigée (§ 16.6). 409 contrôles des lots ; 139 casses, toutes vues.
- **Vague 3**, interrompue par la mémoire du poste (commits `772d03d` et
  `50df336`, ce dernier avec une part de la vague 5) : les feuilles, leurs
  quatre couleurs et leurs quatorze longueurs (§ 9, § 17.7) ; le plateau,
  ses hachures et sa légende, les fiches, la préparation et son personnage
  de démonstration ; l'annulation dans le moteur (§ 17.3), l'offre allégée,
  une ligne par puissance et la case d'un déplacement (§ 17.1, § 17.6), une
  recopie du journal par événement, le rejeu par tranches, le lecteur de
  scénario (§ 17.10) ; le contenu de la bulle et la zone sous la carte
  (§ 17.7) ; la lecture partagée du personnage de démonstration (§ 15.7) ;
  le créateur en vignettes (§ 15.3). 127, puis 285 contrôles des lots ;
  291 casses, toutes vues.
- **Vague 4** (commit `3e46abb`) : les vues de la bulle, du journal, du
  bandeau et de la barre ; la séance, son rejeu par tranches, ses commandes
  de deux à quatre événements (§ 17.8) ; la bulle, ses infobulles, ses
  hachures et son aperçu au doigt ; le journal en couleurs et le bandeau à
  l'écran (§ 17.7, § 17.9) ; le banc sur le classeur réel du jour, sans
  écart (§ 17.10, § 17.11). 248 contrôles des lots ; 203 casses, toutes
  vues.
- **Vague 6** (commit `c98ac84`) : l'écran assemblé, sans défilement
  automatique, et son contrôle (§ 17.7, § 11). 1 774 contrôles, aucun
  échec (1 526 au commit de départ, aucun échec) : 248 de plus, dont neuf
  fichiers neufs (§ 11, § 17.11). Ses casses, et les neuf des feuilles
  qui attendaient l'assemblage : 69, dont 67 vues et 2 en délai (§ 17.11).
- **La mémoire du poste** : déjà près de 20 Go avant les agents ; une
  pointe à 21,09 Go pendant la vague 2, une pause, le seuil relevé à 21 Go
  par l'auteur ; à 21,38 Go pendant la vague 3, deux lots interrompus puis
  relancés ; une première séance des navigateurs arrêtée à 23,1 Go ;
  ensuite, 19,13 Go au plus (§ 13, § 17.11).
- **Les mesures** : celles sous Node et le banc (§ 17.11) ; celles d'Edge
  156 et de Firefox 143, prises au commit `c98ac84`, avant les
  corrections, face aux cibles du complément : le clic tenu dans Edge, à
  refaire au calme dans Firefox ; « annuler » à 15 000 événements non
  tenu, tout compris ; aucun débordement (§ 17.11). Celles du code
  corrigé, au calme, au commit `b7df064` : le clic tenu en médiane dans
  les deux navigateurs, son pire passant 100 ms dans une séance d'Edge sur
  trois ; « annuler » sur un combat ordinaire de 15 000 événements tenu
  en médiane, non au pire, ni sur 45 000 lignes dans Edge ; le rejeu,
  devenu linéaire, de 1,4 à 4,0 s ; aucun débordement (§ 17.11).
- **La spécification 1.5**, en une passe au commit `c98ac84` : § 0, § 1,
  § 2, § 3.2, § 5.1, § 6.3, § 7.2, § 9, § 10.1, § 11, § 12, § 13, § 15.3,
  § 15.7, § 16.6 et le § 17 au fil de ses sous-sections ; les phrases
  d'écran du groupe, « à confirmer » (§ 17.7). Puis, après les
  corrections, mise à l'état du commit `b7df064` : § 3.2, § 6.3, § 9,
  § 10.1, § 10.2, § 11, § 12, § 15.3, § 16.6, § 17.1 à § 17.4, § 17.7,
  § 17.8 et § 17.11.
- Ce que le livret ne dit pas encore (§ 12) : le point 14 (25/10) et le
  point 30 (le défaut proposé) ; dans « Des bornes et des phrases »,
  15 000 événements, confirmés par l'auteur, et le retrait des boutons + et
  − de la puissance ; « (groupe 2) » devient « (groupe 3) » pour le contenu
  du § 13 de la mission ; les précisions 23 à 46, et la lecture de la face
  de contre-attaque, restent « à confirmer », avec le livret.
- Le code : trois modules neufs (`js/ecrans/combat_bulle.js`,
  `js/ecrans/combat_journal.js`, `js/adversaire/rencontre_gardee.js`),
  aucun fichier de plus dans `js/combat/` ; aucune dépendance (§ 10.2).
- **Relecture de fin de groupe**, au commit `c98ac84`, sous cinq angles :
  la conformité au complément et au contrat, l'accessibilité, la
  sécurité, la performance, et deux vrais navigateurs (Edge 156 et
  Firefox 143, 160 images, § 17.11). Une liste consolidée de **vingt-sept
  constats, aucun bloquant, treize majeurs**, treize mineurs et une
  remarque ; des constats écartés, chacun avec sa raison ; huit points à
  trancher.
  - **Les corrections** (commit `2e1d8b8`), en six lots. L'écran :
    « Annuler le dernier geste » montré inactif ne demande plus rien ; le
    doigt n'ouvre plus d'infobulle, l'écran
    retenant le genre du dernier appui ; ce qui a le focus, et l'aperçu,
    restent dans la partie vue de la bulle, par son seul défilement ;
    Échap ferme l'infobulle où que soit le focus ; Maj+Tab et Échap dans
    la liste d'une case ; l'aperçu au doigt le dit (`aria-expanded`) ;
    une seule région polie pendant la reprise ; les vues écrites à la
    main des contrôles, alignées sur celles du moteur ; les contrôles de
    l'écran comparent les nœuds par identité, et leurs attentes sont
    bornées (§ 17.7, § 17.11). Les feuilles : la flèche de la bulle, qui
    ne se dessinait jamais ; une plaque sous les jetons d'une case
    hachurée ; 36 px pour les seules lignes de la bulle, 44 px pour le
    reste et pour les passifs ; les rangées plates ; le dé relancé barré
    dans Firefox ; la hauteur de la bulle à la fenêtre moins 32 px ; la
    marge de défilement du volet (§ 9, § 17.7). Le noyau et le bord :
    l'origine d'une capacité à mains nues ; « Jouer » d'une fiche suit le
    choix des jetons ; E3 à la plus basse des lignes de la capacité
    signalée ; la date d'une enveloppe gardée bornée ; une raison, un nom,
    une description sans demi-codet isolé (§ 6.3, § 16.6, § 17.2,
    § 17.4, § 17.8). Le rejeu redevenu linéaire : le journal ne se recopie
    plus d'un événement rejoué à l'autre, et l'état rendu est le même
    (§ 17.3, § 17.8, § 17.11). Le bandeau garde au moins le nom de qui
    agit (§ 17.7). 1 798 contrôles, aucun échec.
  - **Les captures finales** (au commit `2e1d8b8`, Edge et Firefox,
    178 images) : douze corrections sur treize tiennent ; trois défauts
    neufs. Corrigés au commit `b7df064` : la règle de feuille qui sautait
    la mise en page des lignes du journal hors de la vue, et cachait sa
    dernière ligne, est ôtée, et refusée par un contrôle ; la bulle se
    place après le bandeau et la zone d'avis du même rendu ; le pointillé
    des passifs est posé sous leur nom, écarté par une quinzième
    longueur, `--decalage-soulignement` ; « Passer son tour » prend
    l'aspect des rangées plates (§ 17.7, § 17.11). **1 804 contrôles,
    aucun échec.**
  - **Les mises à l'épreuve** : 892 casses au commit `c98ac84`, 890 vues,
    2 en délai, que la comparaison des nœuds des contrôles de l'écran
    expliquait ; 154 casses des corrections ; au passage du commit
    `2e1d8b8`, 968 jouées, 957 vues, les autres repointées, remplacées,
    équivalentes ou ambiguës ; le dernier passage, au commit `b7df064` :
    256 casses, 256 vues ; en tout, 1 033 casses dans les listes finales,
    1 031 vues, 2 équivalentes (§ 17.11).
  - **Ce qui reste à l'auteur**, avec une recommandation chacun (compte
    rendu du groupe 2) : « annuler » à 15 000 événements au-delà de
    100 ms (le journal montré par pages, ou la mesure acceptée) ; Tab
    après ✕ plutôt qu'après la dernière ligne (§ 17.7, point 17) ; un
    tiret ou une apostrophe en seconde initiale (§ 17.2) ;
    `deDefense.caracteristiques`, gardé comme redite (§ 17.4) ; « cliquez »
    et « survolée » au téléphone (§ 17.7) ; ce que la marge du volet ne
    couvre pas, et couper la phrase du jet par « … » dans le bandeau
    (§ 17.7). Décidés au groupe, et réversibles : le rejeu linéaire, le
    nom de qui agit gardé, la marge du volet, « Passer son tour » plat,
    E3 à la plus basse des lignes de la capacité. Le détail est au compte
    rendu (`plans/compte_rendu_lot4_groupe2.md`).

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
  poste chargé, sans fenêtre) ; dans Firefox, la cible de 100 ms n'était
  pas tenue pour tous les clics, sur un poste chargé (de 49 à 74 ms de
  médiane à 1 440 px, de 0 à 19 clics à 100 ms ou plus selon la passe et
  la largeur) : remesuré après la relecture, plus bas ; un combat joué
  de bout en bout par de vrais clics, dans Edge, Firefox et Chrome. À ce
  commit, les contrôles de l'écran n'étaient pas mis à l'épreuve.
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
    contrôle ne le tenait. **Corrigés en trente points** (commit
    `8032ce2` ; § 17.7), chacun retrouvé dans le code ou dans un
    navigateur avant d'être corrigé. Ce qui se voit : le nom court d'un
    jeton à 15 % de sa case, 9,8 px au moins ; un bouton du site inactif
    en trait discontinu ; le focus sur le jeton de celui qui joue ; le dé
    relancé qui garde le rouge de son échec ; au journal, la seule phrase
    de la mort en évidence ; la préparation et la barre du téléphone
    rangées comme la maquette ; la barre de défilement du journal dans
    Firefox ; le texte à 200 % ; la carte de « Fiche complète » sur un
    téléphone ; le menu refermé après « Effacer ». Ce que dit le panneau
    d'action : la cible gardée pendant le jet ; le bilan d'une relance,
    le dé nu et ses modificateurs ; le libellé d'une face décalée ; une
    saisie refusée qui dit pourquoi ; les réglages à la main entre le
    contexte et les dés ; « Composez d'abord une rencontre », sans point.
    L'accessibilité : la région polie dans la page dès le premier rendu ;
    les rangées, les tables et les régions nommées ; le focus gardé après
    un réglage ; « Case » et « Retirer » hors du volet ; aucun signe de
    sens dans un nom accessible. Ce que fait l'écran : le journal sur sa
    dernière ligne au retour ; un combat ouvert ailleurs sans commande
    sur la carte ; les morts en dernier dans la liste d'une case. Et
    quatre points faits de contrôles seuls : « Fiche complète » calculée
    de la photographie, l'ordre des blocs du jet, des règles de la
    feuille, la clé relue à chaque écriture. Deux points ne sont suivis
    qu'en partie : le plancher des noms courts les laisse coupés là où la
    case fait moins de 65 px, et la première rangée de la préparation
    n'est pas celle de la maquette (§ 17.7). Laissés, et dits
    (§ 17.11) : l'ordre du clavier, qui suit le document ; les initiales
    et la grille d'un téléphone, qui sont celles de la maquette. Les
    constats qui visaient ce document y sont portés (§ 13, § 17.7,
    § 17.11).
  - Toutes les corrections ont été mises à l'épreuve par le même
    lanceur : 184 casses, toutes vues (40 pour le moteur, dont les
    corrections sont dans le commit `c4cff7d`, avec l'étape 6 ; 32 pour
    l'enregistrement et les bornes, et 112 pour l'écran, dont les
    corrections sont dans le commit `8032ce2`, 1 517 contrôles) ; le
    banc sur le classeur réel, relancé après chaque série, reste sans
    écart.
  - **Remesuré après ces corrections**, le 12/10/2026 : aucune case ne
    déborde, sur 98 largeurs, dans Edge 155 et dans Firefox 143 ; un
    clic à l'écran à jour, vers 13 h 10, poste plus calme, en 3,65 ms
    dans Edge et 3,62 ms dans Firefox, à 1 440 px (médianes ; le pire,
    8,7 et 8,3 ms), sur le même combat de 300 événements et quinze
    protagonistes. **La cible de 100 ms est tenue dans les deux
    navigateurs** : la réserve de l'étape 6 sur Firefox est levée, et
    les deux séries restent écrites (§ 17.11).
  - **Le site en ligne** sert, octet pour octet, le code du commit
    `8032ce2` (90 fichiers : la page, les feuilles, les modules, la
    banque et le personnage de démonstration ; vérifié le 12/10/2026 vers
    13 h 10). Aucun
    agent n'y a joué de combat : l'outil lui interdit d'y saisir le mot
    de passe de la démonstration. C'est le premier essai de l'auteur
    (§ 13, § 17.11).
  - **Les contrôles de l'écran écrits avant la relecture, mis à
    l'épreuve** en dernier : 369 casses, 336 vues d'emblée ; des 33
    autres, 28 sont vues à la fin (vingt-trois contrôles ajoutés ou
    complétés, et un contrôle existant hors de la liste jouée), 3 sont
    équivalentes, et 2 font attendre les contrôles au-delà du délai du
    lanceur (échec déduit, non observé). Aucun
    défaut du code. Le commit de fin de groupe compte 1 526 contrôles
    (§ 17.11).
- Ce que le livret ne dit pas encore (§ 12) : un bloc « Pour le lot 4 —
  simulateur de combat », les vingt-deux conventions provisoires de la
  mission et vingt-quatre précisions (quatre que la mission dit ailleurs,
  vingt que l'auteur n'a pas vues : dix-neuf arrêtées en écrivant le
  moteur, une relevée par la relecture de fin de groupe),
  chacune « à écrire dans le livret », et ce que le simulateur laisse à la
  main ; les bornes, les phrases et les textes de l'écran que les
  corrections de la relecture ont posés hors de la mission, avec la
  taille du nom court d'un jeton, à confirmer ; les entrées des lots
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
des dés. 3. Archétype : **en vignettes** (plus bas), puis, sous elles, le
choisi, décrit, et ses groupes de choix, nommés « Style de combat » ou
« Maîtrise » d'après la convention du § 15.2. 4. Espèce, de même. 5.
Constellation : « Tirer au sort » (`crypto.getRandomValues`, sans biais :
les valeurs au-delà du dernier multiple sont rejetées), puis « Refaire le
tirage », à volonté, chaque tirage compté ; ou « Saisir le tirage fait à
la table » (marqué « saisie à la main » sur la fiche), par les vignettes
des constellations (« Constellation tirée à la table ») : en choisir une
donne une constellation saisie à la main, et garde le compte des
tirages ; la tirée ou la saisie porte ✓ ; un clic sur la vignette déjà
choisie ne change rien. 6. Primordial, comme l'archétype. 7. Équipement, en **trois entrées** :
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

**Les vignettes** (lot 4, groupe 2 ; complément du groupe 2, § 7, et les
vues 5a et 5b de sa maquette). Aux étapes 3 Archétype, 4 Espèce,
5 Constellation et 6 Primordial, les blocs se montrent en vignettes côte
à côte, à la place d'un bouton radio et de la description entière par
bloc.

- **Une vignette** porte le nom du bloc, puis **son résumé**, en texte
  secondaire (`resumeDuBloc`, `js/personnage/parcours.js`, sans page) :
  les noms de ses capacités séparés par « , », puis « ; » et un mot par
  groupe, « un style » (Style de combat), « une maîtrise » (Maîtrise),
  « un choix » (Au choix), « facultatif » (Facultatif) ; « Capacités à
  venir. » pour un bloc sans capacité. Le résumé est coupé par « … » au-delà
  de deux lignes. Choisie, la vignette porte un cadre d'accent et ✓, caché
  aux lecteurs d'écran.
- **Au-dessus des vignettes**, une phrase d'aide aux étapes 3, 4 et 6
  (vue 5a) : « Choisissez une vignette : sa description et ses choix
  s'affichent dessous. » (« … : sa description s'affiche dessous. » quand
  aucun bloc de l'étape n'a de groupe) ; **sous elles**, le bloc choisi,
  sous son nom : sa
  description, telle que le parcours l'écrit ailleurs, et ses groupes de
  choix, dont les options sont des vignettes elles aussi (« niveau N ·
  coût », puis la description). Ces descriptions sont ouvertes, sur un
  téléphone aussi ; ailleurs (l'étape 8), elles restent repliées sur un
  téléphone.
- **La grille** : `repeat(auto-fill, minmax(180px, 1fr))` à partir de
  56rem (le jeton `--largeur-vignette`), deux colonnes en dessous.
- **L'accessibilité** : des boutons radio natifs sous leur habit de
  vignette, et des cases à cocher natives pour un groupe facultatif ; une
  flèche déplace et choisit à la fois, comme dans tout groupe radio, Tab
  entre dans le groupe et en sort ; le focus reste sur la vignette après le
  rendu ; chaque vignette fait 44 px au moins ; les choix internes d'un
  bloc qu'on quitte se perdent, comme avant.
- **Ne changent pas** : l'étape Équipement, la fiche et son PDF. La liste
  déroulante « — choisir — » de l'étape 5 a disparu.

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
`js/ecrans/echelle.js` en propriété CSS, un nombre, partagée avec la carte
d'un adversaire, § 16.6 ; avec la place de la bulle du combat, la seule
écriture de style du code, § 10.1), et
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
l'appareil, en démonstration seulement, depuis l'écran Personnages et,
depuis le groupe 2 du lot 4, depuis la préparation d'un combat (§ 17.7) :
les deux écrans passent par la même lecture du fichier
(`lirePersonnageDeDemonstration`, `js/ecrans/partage.js`), puis par la
même question du doublon (« Remplacer », « Garder les deux »,
« Annuler »). Le classeur d'essai a trois packs
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
se résout, et l'écran le signale, avec un lien vers sa fiche.

**La composition en cours est gardée sur l'appareil, chiffrée** (lot 4,
groupe 2 ; complément du groupe 2, § 5.2). Le mode d'emploi le dit : « La
composition est gardée sur cet appareil, chiffrée, jusqu'à « Vider la
rencontre ». » Ce n'est pas un enregistrement de rencontres, que la
mission du lot 4 exclut : aucune bibliothèque de rencontres nommées ;
seule la composition en cours survit à un rechargement.

- **Son module**, `js/adversaire/rencontre_gardee.js`, sans page ni
  mémoire de la composition, sur le modèle de l'enregistrement d'un combat
  (§ 17.8), sans révision ni compression : la dernière écriture l'emporte.
  **Sa base**, `atelier-des-arpenteurs-rencontre`, version 1, entrepôt
  `rencontres`, le mode pour clé : jamais celle du combat, ni le coffre,
  ni `localStorage` (§ 7.2). Une composition par mode.
- **L'enveloppe** : `{ mode, format: 1, sel, iterations, iv, chiffre,
  enregistre_le }`, chiffrée en AES-GCM par la clé de table, un vecteur
  neuf à chaque écriture, la donnée associée
  `atelier-des-arpenteurs/rencontre/1/<mode>` ; le sel et les itérations
  sont ceux de la clé. Sans clé, rien ne s'écrit ni ne s'efface.
- **Quand** : elle s'écrit à chaque + et −, et à chaque « Ajouter à la
  rencontre » d'une fiche ; « Vider la rencontre » l'efface. Les écritures
  passent par une file à une place, au tour suivant : trois clics font une
  écriture, la dernière, et deux écritures ne se croisent jamais. Elle se
  lit une fois par page, à la première visite de l'écran Rencontre, de
  l'écran Combat ou de la fiche d'un adversaire, jamais au démarrage ; un
  + fait pendant cette lecture est rejoué sur ce qu'elle rend.
- **Elle se relit comme une donnée venue d'ailleurs** : n'importe quel
  script du site a pu la poser dans la base. Chaque champ de l'enveloppe
  est borné avant d'être examiné : la date (`enregistre_le`) a la forme
  qu'écrit `toISOString` (l'année en quatre chiffres, ou signée en six,
  puis les millièmes et « Z », 27 signes au plus), jugée avant
  `Date.parse`, qui lirait une date de n'importe quelle longueur
  (« Oct 25 2026 ( », dix millions de signes, « ) » en est une pour lui).
  Dans la composition, 60 entrées au plus, chacune
  faite exactement d'un nom et d'un nombre ; un nom de 1 à 200 signes ; un
  nombre entier de 1 à 12 ; aucun nom répété ; 60 cartes au plus en tout.
  La même relecture juge ce qui s'écrit : ce qui ne se relirait pas ne
  s'écrit pas, et un nom de plus de 200 signes n'est pas gardé. Tout écart,
  ou un déchiffrement qui échoue (une autre clé, un autre mode, une donnée
  abîmée), la rend vide, sans rien lever ni rien dire.
- **Elle se relit par les noms**, contre la banque ouverte : un nom absent
  de la banque se perd. Elle ne repart donc plus de zéro quand la banque
  change, et une banque republiée la garde.
- **« Oublier le mot de passe »** l'efface de la mémoire de la page
  (§ 7.2) ; la version chiffrée reste, illisible sans la clé.

**Le simulateur de combat la lit** pour la poser sur sa carte (« Placer la
rencontre préparée », § 17.7), par une fonction qui ne change rien :
`rencontrePreparee(banque)` rend les adversaires de la composition que la
banque porte, avec leur nombre, dans l'ordre de la liste, sans rien
élaguer, et une liste vide pour une banque qui n'a aucun de ses noms. Les
plafonds du combat sont ceux d'ici : douze exemplaires, soixante
adversaires. Les contrôles « rien n'est enregistré en clair » et « la
rencontre préparée se lit par les noms » la couvrent (§ 11).

**La cause réelle du bouton « Placer la rencontre préparée » grisé**, que
l'auteur a vu après l'arrêt d'essais du groupe 1, mesurée avant d'être
corrigée : la fonction comparait l'**objet** banque, et le mode réel le
remplace par un autre aux mêmes noms, dans trois cas : une publication
depuis l'espace auteur, « Vérifier les mises à jour » ou « Réessayer »
quand l'empreinte servie a changé, le déverrouillage après « Oublier » ou
un changement de mot de passe. La rencontre préparée se lisait alors vide,
et le premier écran qui voyait l'autre objet remettait la composition à
zéro ; de plus, elle ne vivait qu'en mémoire, et un rechargement la
perdait. En démonstration, rien ne remplace la banque : d'où l'absence de
reproduction. La relecture par les noms et la garde chiffrée l'ont
corrigée ; sans rencontre, la raison du bouton dit désormais où la
composer (§ 17.7).

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
`plans/instruction_lot4.md`) se fait **en trois groupes**, séparés par des
arrêts d'essais (§ 13) : le combat jouable (groupe 1) ; l'ergonomie et les
correctifs (groupe 2, complément du 25/10/2026,
`plans/complement_lot4_groupe2.md`, validé par l'auteur avec la maquette
d'ergonomie `plans/maquette_ergonomie.html`, qui prime sur la mission) ;
les règles fines et la main du MJ (groupe 3). **Ce paragraphe décrit les
groupes 1 et 2** ; le § 17.12 dit ce que le groupe 3 ajoutera. Partout où
la mission dit « groupe 2 » pour le contenu de son § 13, il faut lire
« groupe 3 ».

**Ce qu'il est.** Un écran, `#/combat`, où l'on pose sur une carte de
10 × 10 cases des personnages du site et des adversaires de la banque, puis
où l'on joue leur combat : qui agit, quelle capacité, contre qui, les dés,
la localisation, les dégâts, tour après tour. Tout ce qui se décide pour un
geste se fait dans une bulle accrochée au jeton de qui joue ; un geste
fini se défait par « Annuler le dernier geste ». Le combat est gardé sur
l'appareil, chiffré, et survit à un rechargement ; son journal se copie et
se télécharge.

- **Il est assisté.** Les règles générales du combat s'appliquent seules :
  les tours et les actions, la chaîne des dés, l'avantage et le
  désavantage, la portée, la localisation, l'armure, la résistance et le
  corps, la mort. **L'effet propre d'une capacité**, que le classeur écrit
  en texte libre, **s'applique à la main** : sa description s'affiche
  toujours, et le groupe 1 donne pour cela des réglages simples (un
  modificateur, des avantages, des dégâts fixés, une face décalée), que le
  groupe 3 complétera d'une palette. Sont câblés, c'est-à-dire joués sans
  qu'on dise comment : le bloc de base, les attaques, les maîtrises et huit
  passifs (§ 17.6).
- **Il se joue à la main.** Aucune intelligence artificielle :
  l'utilisateur joue tous les protagonistes, adversaires compris, et lance
  chaque dé d'un clic sur le dé. Saisir le résultat d'un vrai dé est
  abandonné pour l'instant (décision de l'auteur, 25/10/2026).

**Ce qu'il n'est pas** (mission, § 18) : il ne joue pas les adversaires ; il
ne lit pas les effets des capacités ; il ne partage pas un combat entre
deux appareils et n'ajoute pas de renforts après le lancement ; il ne
connaît ni les effets de terrain d'une case, ni les charges des
consommables, ni les points d'historique, ni la recharge du souffle et du
lien ; il ne s'imprime pas ; il n'écrit rien dans le livret ni dans le
classeur ; il ne garde pas de bibliothèque de rencontres. Le désavantage
des maîtrises reste absent de la fiche de personnage (§ 15) : il n'est
calculé qu'ici.

**Préséance.** Le livret fait foi, puis le classeur, puis le complément du
groupe 2, puis sa maquette, puis la mission. Là où le livret se tait ou
diffère, le simulateur applique **des conventions provisoires**, toutes
inscrites au § 12 (« Pour le lot 4 — simulateur de combat »), « à écrire
dans le livret » : elles priment jusqu'à sa réécriture. **Pour toute autre
règle absente, rien n'est inventé** : le simulateur laisse la main au
joueur, par une saisie ou un choix. Les règles d'interface (choisir qui
joue, revenir avant le premier dé, poser les jetons, nommer court, ce
qu'un geste englobe pour l'annulation, la case d'un déplacement) ne sont
pas des règles du jeu : elles sont ici, et non au § 12. Chaque règle de ce
paragraphe cite la section du livret, le point du § 12 ou la décision qui
la fonde.

**Aucun nom du vrai classeur** n'entre dans le dépôt avec ce lot (interdit
2) : ni bloc, ni capacité, ni type, ni adversaire, dans le code, les
contrôles, ce document ou les messages de commit. Les exemples viennent de
la démonstration (§ 15.7, § 16.7) : Aubépine Crèmebrûlée, le Chef de
partie, le Marmiton de corvée ; les rôles câblés se nomment par leur code
(`bonus_precision`, `petit`, `en_meute`…). Les noms d'éléments et de
paramètres du classeur (Intervention, Passif, Dégâts, Portée, Localisation
multiple, Centré, `loc_multiple`) s'écrivent en clair, comme depuis le lot
1. La règle a été enfreinte une fois : un nom de capacité est entré au
commit `fda3a2a`, par un exemple de la mission, et en a été retiré au
commit suivant ; il reste dans l'historique, et l'auteur l'y laisse
(25/10/2026, § 17.11).

### 17.1 Les modules

**Un combat est une mise en place, puis une suite d'événements, et rien
d'autre.** La mise en place dit qui est là, sur quelle case, et quel camp
commence. Un événement est un choix du joueur ou un dé lancé, qui porte ses
valeurs ; « annuler » en est un. Tout le reste — ce que vaut chacun, le
geste en cours, le journal, ce qui est permis, ce qui peut se défaire — se
recalcule. C'est ce qui est gardé (§ 17.8), et c'est ce qui fait qu'un
rechargement, un contrôle et le banc passent par le même chemin que
l'écran.

**Le noyau** (`js/combat/`) n'a ni page, ni banque, ni hasard, ni heure. Il
n'importe que lui-même, `js/banque/noms.js` (la clé d'un nom) et
`js/personnage/regles.js` (les neuf caractéristiques, le dé d'un jet), sans
cycle ; un contrôle tient ce graphe (§ 11). Le groupe 2 n'y a ajouté aucun
fichier.

| Module | Ce qu'il fait |
|---|---|
| `regles.js` | les constantes du combat, chacune avec sa source en commentaire : la carte, les plafonds, les deux actions d'un personnage, les trois réussites, la grille des personnages, les faces de contre-attaque, les libellés des difficultés du livret, les noms des éléments lus, les quinze rôles (les quatorze du tableau du § 17.6, et celui de l'attaque à mains nues, qui ne tient pas à un nom), les signes du journal, les bornes d'un combat (ses 15 000 événements, l'alerte à 13 500, la tranche du rejeu, ses identifiants, les tirages d'un dé), d'une saisie et d'une photographie ; l'écriture d'un nombre par tranches de trois chiffres, séparées d'une espace ordinaire ; l'annulation vide, que l'ouverture pose ; la version des règles du rejeu, 2 |
| `forme.js` | la forme de ce qui se garde : un événement (seize types), une photographie, un contenu entier ; chaque champ attendu, typé et borné, un champ inconnu refusé ; rien de ce qui se relit n'est cru |
| `plateau.js` | les cases (« D4 »), la distance entre deux cases, les cases à portée, la case où un ajout se pose d'office. Dans le code, la carte du combat s'appelle « le plateau » : « carte » y désigne déjà la carte d'adversaire (§ 16.5) |
| `noms.js` | le nom entier, le nom court, le jeton et les initiales de chaque protagoniste, calculés pour la liste entière (§ 17.2) |
| `preparation.js` | la mise en place d'avant le lancement : ajouter, retirer, poser, régler qui commence ; les plafonds ; la fabrique des identifiants |
| `jet.js` | la chaîne d'un jet : les réussites, l'avantage, le désavantage, le dé explosif ; il ne tire aucun dé, et ne garde aucun total (§ 17.4) |
| `valeurs.js` | toute lecture d'un protagoniste et du geste en cours : ce qui bouge se lit dans l'état, ce qui ne bouge pas dans la photographie |
| `circonstances.js` | de quoi ouvrir un jet : qui lance, quel dé, contre quoi, les modificateurs, les avantages et les désavantages, chacun avec sa source (le rôle et la capacité d'un passif compris), dans un ordre écrit ; la défense choisie à égalité ; les causes qu'une ligne montre avant toute cible ; les passifs câblés d'une fiche |
| `degats.js` | la lettre que valent des réussites, la zone que touche un d20, ce que perdent l'armure, la résistance et le corps, « dégrossir », l'esquive, la blessure, la mort (§ 17.5) |
| `offre.js` | **la seule porte** : ce qui est permis à cet instant, et pourquoi le reste ne l'est pas ; une entrée par façon jouable, le mode d'un geste à son ouverture, la façon que joue une case d'arrivée, l'annulation et ses trois raisons |
| `moteur.js` | le réducteur : d'un état et d'un événement, l'état suivant ; la pile d'annulation ; le rejeu d'un combat gardé, linéaire, d'une traite ou par tranches |
| `journal.js` | chaque ligne du journal, ses segments typés et ses phrases, la ligne en cours d'un geste, la ligne « Annulé », le nom d'un geste, son en-tête, le nom du fichier, et ce que la région d'annonce dit après chaque dé (§ 17.9) |
| `lecture.js` | les vues que l'écran affiche : la barre (avec « Annuler le dernier geste », sa question, et l'alerte des 13 500 événements), la carte, une fiche, la bulle (le panneau du groupe 1, déplacé), la préparation, le journal et le bandeau ; toute phrase qui dépend de l'état y est écrite, sans page (§ 17.7) |

**Cinq règles tiennent le noyau** (ce que les contrôles en tiennent :
§ 11, § 17.11) :

- **`appliquer(etat, evenement)` est pure.** Elle ne lit ni l'heure, ni le
  hasard, ni la banque, ni l'écran, ni la langue de l'appareil. Les dés et
  l'heure du lancement sont dans les événements, les photographies dans la
  mise en place. Elle ne modifie rien de ce qu'elle reçoit : elle rend un
  état neuf, gelé, qui partage avec le précédent tout ce qui n'a pas
  changé : ce qui est déjà gelé n'est pas reparcouru, et un clic ne coûte
  pas le parcours du combat. Le journal suit la même règle : une ligne naît
  gelée, et une ligne de plus ne fait regarder aucune de celles qui la
  précèdent. **La liste du journal n'est recopiée qu'une fois par
  événement** depuis le groupe 2 : la première écriture d'un événement la
  recopie dans un tableau neuf, que les écritures suivantes du même
  événement prolongent, et `appliquer` le gèle à la fin. **Le rejeu ne la
  recopie plus d'un événement à l'autre** : il passe par le même calcul,
  la liste laissée ouverte jusqu'à son dernier événement, et il est
  linéaire (§ 17.8, § 17.11). Ce chemin n'est pas exporté : l'écran et la
  séance ne voient que des états gelés.
- **Une seule porte : l'offre.** Le moteur refuse tout événement qu'elle
  n'admet pas ; les vues en tirent leurs boutons, leurs bornes et la raison
  de chaque bouton inactif. Un bouton montré actif est donc un événement
  que le moteur accepte : ni `offre.js` ni `lecture.js` n'importent le
  moteur. **Depuis le groupe 2, l'offre ne juge que la capacité
  demandée**, et non chaque façon de qui joue : à chaque état du combat de
  référence et sur des photographies piégées, elle rend le verdict du
  groupe 1, objet pour objet (§ 17.10).
- **L'écran n'écrit aucune règle et ne fait aucun calcul.** Chaque élément
  d'une vue qu'on peut actionner porte sa commande (l'événement à émettre,
  ou deux à quatre événements joués tout ou rien), chaque bouton inactif sa
  raison, chaque saisie ses bornes.
- **Un événement refusé rend l'état reçu, l'objet même**, et un refus :
  « forme » (l'événement est mal fait), « hors_moment » (rien de tel ne
  s'offre à cet instant), « hors_bornes » (la valeur n'est pas de celles
  qui s'offrent) ou « interdit » (le bouton existe, il est inactif, et le
  message est sa raison). Le moteur ne lève jamais, quel que soit ce qu'on
  lui donne : un combat gardé est une donnée venue d'ailleurs.
- **La pile d'annulation ne passe jamais par JSON et ne se compare jamais
  en profondeur** : elle vit dans l'état (`etat.annulation`), elle ne se
  garde pas, et elle se refait au rejeu. « L'état passe par JSON à
  l'identique » et toute comparaison d'états entiers portent sur l'état
  sans elle ; ses maillons se comparent par identité (§ 17.3).

**Le bord** touche ce que le noyau ignore :

| Module | Ce qu'il fait |
|---|---|
| `js/combat/des.js` | la source de dés de l'écran : `crypto.getRandomValues`, un tirage rejeté et refait au-delà du plus grand multiple du nombre de faces, pour qu'aucune face ne sorte plus souvent qu'une autre. Les contrôles et le banc lui substituent des dés imposés (`tests/outils/des_imposes.js`), que rien dans la page, ni adresse ni réglage, ne permet de lui substituer |
| `js/combat/roles.js` | le seul tableau qui lie un rôle câblé à un nom (§ 17.6) |
| `js/combat/photographie.js` | fige à l'ajout tout ce que le combat lira d'un protagoniste, et dit qui ne s'ajoute pas (§ 17.2) |
| `js/personnage/disponibles.js` | les personnages qu'on peut ajouter, lus sans rien écrire sur l'appareil (§ 17.2) |
| `js/combat/enregistrement.js` | le chiffrement du combat, sa base, la file des écritures, la révision (§ 17.8) |
| `js/combat/seance.js` | le lien entre l'écran, le moteur et l'enregistrement : elle tient le combat du moment, passe chaque commande au moteur, donne chaque changement à garder, et rouvre un combat gardé en rendant la main au navigateur entre deux tranches du rejeu |
| `js/ecrans/combat.js` | l'écran assemblé, et **le seul module qui garde le combat en mémoire** d'une visite de l'adresse à l'autre ; le clic au-dehors de la bulle, Échap, « Annuler le dernier geste », le seul défilement demandé (`montrerLeJournal()`) |
| `js/ecrans/combat_plateau.js`, `combat_fiches.js`, `combat_action.js`, `combat_preparation.js`, `combat_bulle.js`, `combat_journal.js` | ses six parties, dont aucune n'importe le moteur : la carte et ses hachures ; les fiches vivantes ; le contenu d'une action (la liste des capacités, le jet) et la zone sous la carte ; la préparation ; la bulle, son onglet et ses infobulles ; le journal en couleurs et le bandeau. Chacune montre la vue qu'on lui donne (§ 17.7) |
| `js/ecrans/echelle.js` | la place de la bulle, de son onglet et de ses infobulles, calculée sans page, puis posée en trois propriétés CSS : avec l'échelle d'un papier, la seule écriture de style du code (§ 10.1) |
| `js/adversaire/rencontre_gardee.js` | la composition de la rencontre, gardée chiffrée sur l'appareil (§ 16.6) |

**Les modules d'avant, par ajouts seulement.** `js/adversaire/resolution.js`
rend les armes d'un adversaire et les éléments de ses capacités, partage
la règle de position des maîtrises (§ 16.4), et, depuis le groupe 2,
résout les capacités d'un adversaire à une puissance donnée
(`capacitesA`), la même résolution qu'au rang : au rang, elle rend
exactement ce que rend `resoudre()`. `js/personnage/calcul.js` dit, pour
chaque capacité d'une fiche, de quelles sources elle vient (un bloc, ou un
objet et son rang dans l'équipement), les éléments d'une capacité à une
puissance (ceux de sa variante, puis ceux que son bloc lui transmet en la
visant), les dégâts que dit une description à une puissance, les types
d'un bloc (`typesDuBloc`), et, au dé de défense, les types à égalité de
dés (`egalite`). `js/adversaire/carte.js` exporte l'écriture des types d'un
adversaire (« Commis, Rôtisseur ×1,4 »). `js/ecrans/rencontre.js` laisse
lire la rencontre préparée, la charge et l'oublie (§ 16.6) ;
`js/application.js` l'oublie avec le combat. `js/ecrans/partage.js` lit le
personnage de démonstration pour l'écran Personnages et pour la
préparation d'un combat, et `js/ecrans/personnages.js` pose la question du
doublon sans faire défiler la page quand le combat le demande (§ 15.7).
`js/personnage/parcours.js` écrit le résumé d'un bloc pour les vignettes
du créateur, que montre `js/ecrans/creation.js` (§ 15.3). Ce que rendaient
la résolution et la fiche au commit `40db3a0` est rendu à l'identique, les
champs neufs mis à part : mesuré sur 85 adversaires et 7 fiches.

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
  les caractéristiques et le dé de défense d'un personnage, avec les types
  d'armure qui sont à égalité de dés (`egalite`, vide sauf égalité de deux
  types au moins ; § 17.4), les deux nombres d'un adversaire ; les armes ;
  le bouclier ; les jauges de lien ; les passifs câblés ; les capacités. Le
  noyau n'y lit ensuite que ce qui ne bouge pas : les nombres qui bougent
  sont recopiés dans l'état à l'ouverture du combat ;
- **par capacité** : son nom, tel que la banque le donne ; son rôle câblé,
  reconnu ici et nulle part ailleurs (§ 17.6) ; son niveau (son rang, chez
  un adversaire) ; le groupe sous lequel ses lignes se rangent ; et **ses
  façons**, une par manière de la jouer : pour un personnage, une par
  puissance jouable ; **pour un adversaire, une par puissance jouable et
  par arme qui la donne** (depuis le groupe 2 ; § 12, point 14) : de 1 à
  son rang, parmi les puissances qui ont une variante, rangées par
  puissance puis par arme, chacune résolue comme la résolution le fait au
  rang, à cette puissance (`capacitesA`) ; une capacité qui n'évolue pas
  garde sa seule façon, à son rang. Dans la démonstration, le Chef de
  partie a ainsi Pas chassé [1], gratuit, et Pas chassé [2], pour
  1 souffle. Chaque façon fige le coût, la description évaluée, les
  éléments, ce qu'ils disent (passive, intervention, attaque), les dégâts,
  la portée, le nombre de dés de localisation et le désavantage de
  maîtrise, avec **sa cause** (`maitrise`, présente exactement quand le
  désavantage l'est : l'objet qui donne la capacité, l'arme tenue
  comprise, sinon le bloc, et son poids ; pour un bloc à deux poids, celui
  dont la maîtrise est la plus basse), qui ne sert qu'à la phrase de cause
  de l'écran (§ 17.7) ;
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
Une capacité d'un personnage que plusieurs origines donnent ne se range
qu'une fois, sous la première qui la donne valablement (§ 12, points 19 et 31).

**La même fonction juge une photographie quand elle se fabrique et quand
elle se relit** (`validerPhoto`, `js/combat/forme.js`) : ce qui s'est
ajouté à un combat se reprend toujours. Elle borne chaque champ : un nombre
de 0 à 9 999 ; un texte d'une ligne (un nom, un titre, un libellé) de 200
signes au plus, sans caractère de contrôle ni demi-codet isolé ; un texte
à lignes (une description, un avertissement) de 4 000 signes au plus, sans
caractère de contrôle ni demi-codet isolé hors ses retours à la ligne et
ses tabulations. Un demi-codet isolé, la moitié seule d'un signe astral,
ne se voit pas et s'écrit en six signes au JSON ; un signe astral entier
(une poêle, U+1F373) passe, et compte deux unités. Deux moitiés séparées
par un retour à la ligne ne se recollent pas : le retour compte pour une
espace. Le refus garde sa phrase (« … porte un caractère de contrôle. »),
qu'une photographie fabriquée ici n'atteint pas ; 200 capacités, 20
façons par capacité, 40 armes, 19 zones, 20 jauges, 40 éléments par
façon ; une grille qui couvre, sans trou ni chevauchement, toutes les faces
du d20 hors celle de la contre-attaque. Ce qui les dépasse est un refus
d'ajout, dit (« Ne s'ajoute pas : la description de … dépasse 4 000
signes. »). À la photographie, un caractère de contrôle ou un demi-codet
isolé devient une espace : dans un texte d'une ligne, ses retours à la
ligne aussi, puisque ce texte entrera au journal, qui tient une ligne par
geste ; une description garde ses retours à la ligne. Une capacité dont
le nom n'est fait que de demi-codets a un nom vide : son protagoniste ne
s'ajoute pas (« Ne s'ajoute pas : le nom de la capacité n° … est
vide. »), et le combat n'en reçoit jamais une raison proposée vide.

**Trois bornes de plus**, posées le 12/10/2026 par les corrections de la
relecture de fin de groupe (§ 12, à confirmer) : mises bout à bout, les
bornes de chaque liste laissaient passer un contenu forgé qui coûtait
cher à rejouer ou à afficher.

- **600 façons en tout** par protagoniste, toutes capacités confondues
  (deux cents capacités de trois façons, le niveau le plus haut d'un
  personnage), et **20 façons de déplacement** au plus, toutes ses
  capacités de déplacement ensemble. Au groupe 1, l'offre jugeait, à
  chaque capacité jouée, toutes les façons de celui qui jouait, et
  calculait pour chaque façon de déplacement les cases où elle mène : aux
  seules bornes des listes, une photographie forgée coûtait, par événement
  rejoué, 4,2 ms avec 3 980 façons que le lien ne paie pas, et de 30 à
  35 ms avec 200 capacités de déplacement de 20 façons (§ 17.11). Depuis le
  groupe 2, l'offre ne juge que la façon demandée (§ 17.1) ; les bornes
  restent, car elles bornent ce que la bulle calcule à chaque clic : une
  ligne, un survol et ses hachures par façon. Avec la puissance au choix
  des adversaires, le banc relève sur le vrai classeur 5 façons au plus
  pour un adversaire, dont 2 de déplacement, et 2 au plus par capacité
  (§ 17.11) ; dans la démonstration, le Chef de partie a 2 façons de
  déplacement.
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
  téléphone. **Deux signes au plus** (décision de l'auteur, 25/10/2026 ;
  complément du groupe 2, § 4.11) :
  - la première lettre ou le premier chiffre du nom, en majuscule ; « ? »
    faute d'un tel signe ;
  - si d'autres protagonistes ont la même (les exemplaires d'un même
    adversaire ne comptent pas : ils font une seule famille), chacun y
    ajoute, en majuscule, le signe de son nom à la première position où
    ces noms ne sont plus tous pareils. La comparaison se fait sur la clé
    du § 6.3 : la casse, les accents, les espaces et les signes invisibles
    ne comptent pas, si bien que « É… » et « E… » font un groupe. Un nom
    plus court que cette position n'ajoute rien. Les positions comptent
    tout signe que la clé garde, tirets et apostrophes compris ;
  - ceux qui se confondent encore (les mêmes lettres, ou des initiales qui
    s'écriraient de même, numéro compris) reçoivent la marque du groupe 1
    (prime, seconde…), dans l'ordre d'ajout, posée entre les lettres et le
    numéro ; une famille dont les initiales seraient encore celles d'une
    autre (une seconde faite elle-même d'une marque, dans un nom forgé)
    reçoit une marque de plus, la première qui les rend libres ;
  - un exemplaire numéroté garde son numéro à la fin.

  Exemples, tous fictifs et tenus par un contrôle : « Aubépine
  Crèmebrûlée » AC et « Aubépine Fleurdesel » AF ; « Marmiton de corvée »
  MA et « Mouette chapardeuse » MO ; un Marmiton seul, exemplaire 1, M1 ;
  le douzième Marmiton à côté de la Mouette, MA12 ; « Marmiton de
  corvée », « Marmiton de corvée bis » et « Mouette chapardeuse », MA′,
  MA″ et MO. **Deux protagonistes différents n'ont jamais les mêmes
  initiales.** Jusqu'au groupe 1, chacun prenait une lettre de plus de son
  nom tant qu'il se confondait : deux noms au même premier mot donnaient
  des initiales de 8 à 11 signes.
- **Le nom entier** figure partout ailleurs : le titre de la bulle, les
  boutons « Qui joue ? », les cibles, les fiches, et le titre de chaque
  jeton.
- Les noms se figent au lancement : le journal les a écrits.

Deux personnages de même nom, ou un personnage et un adversaire de même
nom, ont le même nom court et le même jeton : rien ne les distingue au
journal, seules leurs initiales diffèrent. La mission ne prévoit pas ce
cas. Un autre reste, relevé par la relecture du groupe 1 et laissé : un
nom qui s'écrirait lui-même « X n° 1 », à côté de plusieurs « X », se
confondrait avec le premier d'entre eux, jeton, nom court et nom entier.
**Un point à trancher par l'auteur** (compte rendu du groupe 2) : un
tiret ou une apostrophe peut devenir la seconde initiale (« Chef-de-partie »
donne « C- » à côté de « Chef de partie », qui donne « CD ») ; le code le
laisse, comme la lettre du complément (§ 4.11, « le signe de son nom »)
l'admet ; la recommandation est de ne compter que les lettres et les
chiffres.

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

**Les événements.** Il y en a seize, et tout ce qui se joue en est un :

| Événement | Ce qu'il fait |
|---|---|
| `lancer` | lance le combat : la ligne du lancement, puis celle du premier tour |
| `capacite` | ouvre un geste : tel protagoniste joue telle capacité, de telle façon (une puissance, une arme). C'est lui qui dit qui joue : choisir un protagoniste n'est pas un événement |
| `regler` | règle le geste avant qu'il soit payé : la façon, le jet d'arme prêté et son arme, la cible, la case d'arrivée, les caractéristiques, la difficulté, X, la jauge de lien, le modificateur et les avantages à la main, et, depuis le groupe 2, le type de défense à égalité de dés (§ 17.4) |
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
| `annuler` | défait le dernier geste fini depuis le lancement (groupe 2 ; plus bas) ; il ne porte aucun champ |

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
- **Une capacité qui ne se joue pas** : sa ligne est inactive et dit
  pourquoi, la première raison qui tient. Ce qui tient à la capacité
  d'abord : « absente de la banque » ; « coût illisible dans la banque » ;
  pour un déplacement qui n'offre aucune case, « aucune case à sa portée »
  (§ 17.6). Ce qui tient au moment ensuite : « Plus d'action à ce tour. » ;
  « Pas assez de souffle : 5 demandés, 3 restants. » ; « Pas assez de
  lien : 1 demandé, 0 restant. » Une puissance qu'on ne peut pas payer
  reste en ligne, inactive, avec sa raison (§ 17.6).
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
actions. On ne joue plus, sauf à défaire le geste qui a fini le combat ;
le journal se copie et se télécharge toujours.

**« Annuler le dernier geste »** (groupe 2, décision de l'auteur du
25/10/2026 ; complément, § 4.10). Ce qu'englobe un geste est une règle
d'interface, non du jeu.

- **Ce qu'il défait** : le dernier geste fini depuis le lancement, une
  capacité jouée avec ses dés, un déplacement, « Passer son tour » ou
  « Fin de tour », avec tout ce que l'événement qui l'a fini a entraîné :
  une mort, la fin du combat, une ou deux fins automatiques de tour. **Une
  fin automatique ne se défait jamais seule.** L'état du combat (les
  protagonistes, le tour, le camp, les actions, les morts, le geste en
  cours, le vainqueur) redevient celui d'avant ce geste. Un geste ouvert
  sans être payé, que la passe ou la fin de tour a retiré, ne revient pas.
- **Ce qu'il ne défait pas** : le journal, qui ne recule pas, et le compte
  des événements. Les lignes que le geste a écrites restent, barrées à
  l'écran, et une ligne « Annulé : … » s'ajoute à la fin (§ 17.9). Les dés
  tirés restent dans le combat gardé : le rejeu reste déterministe, et
  « annuler » compte pour le plafond.
- **Plusieurs fois de suite**, en remontant jusqu'au lancement, qui ne se
  défait pas. Il n'y a pas de « Rétablir ».
- **Quand il ne se peut pas**, la raison, dans cet ordre : « Rien à
  annuler depuis le lancement. » quand aucun geste n'est à défaire ;
  « Revenez d'abord sur le geste en cours. » tant que rien du geste en
  cours n'est payé ; « Terminez d'abord le geste en cours. » après son
  premier dé. Avant le lancement, il n'y a pas de bouton, et l'événement
  est refusé hors du moment.
- **Le moteur** (`js/combat/moteur.js`) garde, geste par geste depuis le
  lancement, l'état d'avant chaque geste, sans son journal : une pile
  chaînée de maillons gelés, chacun avec cet instantané, ce qu'est le
  geste et la plage des lignes qu'il a écrites. L'instantané d'une
  capacité se prend quand elle se paie, le geste lui-même ôté ; il partage
  avec son état tout ce qui est gelé. « Annuler » reprend l'instantané, y
  remet le journal courant, avec la ligne « Annulé », et dépile : il coûte
  comme un clic, et le rejeu reste linéaire, annulations comprises. Seul
  le geste racine compte : les gestes empilés (une intervention, une
  contre-attaque) sont au groupe 3.

**Trois bornes**, celles que tient la lecture d'un combat gardé
(§ 17.8) : le jeu les tient aussi, sans quoi un combat se garderait, puis
serait refusé en entier au rechargement suivant. Les nombres ont été posés
ou revus le 12/10/2026 par les corrections de la relecture de fin de
groupe (§ 14), puis, pour le premier, par l'auteur le 25/10/2026 ; les deux
autres restent à confirmer (§ 12).

- **15 000 événements par combat**, chiffre de l'auteur (25/10/2026),
  quelle que soit la mesure. Au-delà, le jeu refuse l'événement,
  « annuler » compris : « Ce combat a atteint 15 000 événements :
  commencez-en un nouveau. » **À 13 500 événements** (90 %), une ligne
  s'affiche sous la barre de titre, et passe une fois par la zone d'avis
  pour chaque combat : « Ce combat approche de sa limite (13 500
  événements sur 15 000) : copiez ou téléchargez le journal ; au-delà, il
  faudra en commencer un nouveau. » La borne pèse surtout sur l'ouverture
  de l'écran, qui rejoue tout le combat : **le rejeu rend la main au
  navigateur tous les 1 000 événements**, sous l'attente « Ouverture du
  combat… », sans phrase de plus (§ 17.8). Au groupe 1, elle était de
  5 000, fixée d'après la mesure du pire contenu (4,66 à 4,75 s sous Node,
  § 17.11), parce que l'offre jugeait alors chaque façon de qui jouait.
  Trois changements l'ont portée à 15 000 : l'offre ne juge plus que la
  capacité demandée (§ 17.1), le journal n'est recopié qu'une fois par
  événement, et le rejeu cède la main. Depuis la relecture de fin du
  groupe 2, le rejeu ne recopie plus le journal d'un événement à l'autre
  et il est linéaire : 15 000 passes se rejouent en 1,4 à 2,9 s sous Node,
  sur un poste chargé (§ 17.8, § 17.11).
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
  le cas sans armure (§ 15.2). **À égalité de dés, la défense est au choix
  du joueur** (livret, « Jets de défense » ; § 12, point 30 ; groupe 2) :
  la fiche retient un type, le défaut proposé ; quand deux types ou plus
  ont un dé de mêmes faces (sans armure, parmi les trois ; sinon parmi les
  types portés), la photographie les écrit (`egalite`), et le contexte du
  jet de défense, quand un adversaire attaque ce personnage (une attaque ou
  un jet prêté), offre le type retenu avec un choix (« Défense : agile »),
  jusqu'au premier dé. C'est un réglage du geste (`regler`, champ
  `defense`) : il revient au défaut quand la cible change, et chaque jet de
  défense repart du défaut. Les caractéristiques de défense du type
  choisi (§ 15.2) donnent les modificateurs du jet (plus bas) ; le dé garde
  ses faces. Le jet les lit dans la table des types, le type retenu
  compris : celles que la photographie garde avec son dé
  (`deDefense.caracteristiques`, leur seule source au groupe 1) ne servent
  plus qu'à la fiche vivante, qui les écrit. Elles restent, comme une
  redite : les ôter changerait la forme de la photographie, donc le contenu
  gardé. À trancher par l'auteur (compte rendu du groupe 2). Le journal
  écrit le dé employé, comme avant.
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
que la valeur n'est pas nulle : de 1 à 80 unités, sans blanc de bord, ni
caractère de contrôle, ni demi-codet isolé ; un signe astral entier compte
deux unités. L'écran propose le nom de la capacité : la raison proposée en
ôte d'abord les demi-codets isolés, puis, si la coupe à la 80e unité tombe
au milieu d'un signe astral, sa première moitié ; le moteur l'accepte
ainsi toujours, dégâts directs compris. C'est le moteur qui vérifie la
raison, pas l'écran : elle entre au journal et dans le fichier
téléchargé.

Le coup critique et le dé miroir sont au groupe 3 (§ 17.12).

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
  (§ 12, point 41). Les groupes 1 et 2 l'écrivent au journal ; le groupe 3
  proposera la contre-attaque.
- Sans dégâts, aucune zone ne perd rien : le geste se finit quand même par
  « Appliquer », un seul chemin.

**L'esquive** est la seule intervention des groupes 1 et 2 (§ 12, points 8 et
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
- **Pour un adversaire**, une capacité que donnent plusieurs armes a ses
  lignes sous chacune ; deux armes de même nom se distinguent par « (2) ».
  Une capacité citée sans arme est une attaque si elle a des dégâts propres
  ou porte l'élément Dégâts (§ 12, point 43) : dans la démonstration, la
  Frappe de la Mouette chapardeuse n'a ni l'un ni l'autre, et se joue sans
  jet, ou par le jet prêté « sans arme ».
- **Les interventions** se jouent aussi à son propre tour, comme toute
  capacité.

**Les coûts et la puissance** (§ 12, points 26 et 27).

- **La puissance.** Un personnage la choisit de 1 au niveau de la capacité
  (livret, « Capacités » : on joue sous son maximum pour économiser), parmi
  les puissances qui ont une variante ; une capacité qui n'évolue pas se
  joue à la puissance 0, et ne porte pas « [P] ». **Un adversaire la
  choisit de même, de 1 à son rang**, parmi les puissances qui ont une
  variante (décision de l'auteur, 25/10/2026 ; § 12, point 14) ; une
  capacité qui n'évolue pas garde sa seule puissance. Le N d'un passif
  câblé reste le niveau ou le rang (point 24) : un passif ne se joue pas.
- **Une ligne par puissance** (groupe 2, règle d'interface). Une capacité
  à plusieurs puissances jouables a, dans la bulle comme dans le volet,
  une ligne par puissance, et pour un adversaire par puissance et par
  arme, chacune avec son coût (§ 17.7). Une puissance qu'on ne peut pas
  payer reste en ligne, inactive, avec sa raison. Les boutons + et − du
  groupe 1, et le bouton qui portait d'office la plus haute puissance
  payable, ont disparu. Une façon passive parmi d'autres n'a pas de
  ligne ; une capacité toute passive, ni une capacité d'un rôle sans
  bouton, n'en ont aucune.
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
  **Une case ne se choisit qu'après une ligne du déplacement**, qui marque
  les cases d'arrivée, de 1 à P. La case choisie fait jouer **la plus
  petite puissance qui l'atteint et qui se paie** (la même arme, X compté
  0), à son coût, même depuis la ligne d'une puissance plus haute : la
  commande de la case porte alors deux événements, le réglage de la façon
  et celui de l'arrivée, joués tout ou rien (règle d'interface). Le
  journal écrit la puissance jouée. Dans la démonstration, le Chef de
  partie qui avance d'une case joue Pas chassé [1], gratuit, même depuis
  la ligne de Pas chassé [2] ; à deux cases, il joue [2], pour 1 de
  souffle. **À la puissance 0** (une capacité de déplacement qui n'évolue
  pas), aucune case ne s'offre : la ligne est inactive et dit « aucune
  case à sa portée », avant toute raison du moment, et l'événement est
  refusé (§ 12, « Ce qui manque encore »).
- **Le jet de caractéristique** : § 17.4.
- **L'attaque à mains nues.** C'est la capacité que vise le paramètre
  `degats` du bloc de base (§ 15.2) : ce rôle-là ne tient pas à un nom. Ses
  dégâts sont ceux de la puissance jouée, lus comme sur la fiche ; son dé
  se fait d'une ou deux caractéristiques, choisies au moment du jet (§ 12,
  points 10 et 28).
- **L'esquive** : une intervention (§ 17.5).
- **Passer son tour** : un bouton du simulateur (§ 17.3). **Le jet de
  défense** : automatique, il n'a pas de bouton. **L'attente** : au
  groupe 3 ; la capacité de ce rôle n'a pas de ligne aux groupes 1 et 2.

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
décide que de l'absence de ligne. Un seul module porte le tableau ; les
noms se comparent par leur clé (§ 6.3). Le rôle se pose à la photographie,
et le noyau ne lit ensuite que lui, jamais un nom.

| Rôle | Démonstration | Ce que le simulateur en fait |
|---|---|---|
| déplacement | Pas chassé | mène à une case, à une distance de 1 à P |
| jet de caractéristique | Goûter | un jet d'un dé au choix, contre une difficulté de 2 à 10 |
| esquive | Pas de côté | l'intervention qui annule X dégâts pour X de souffle |
| attendre | Guetter | rien aux groupes 1 et 2 : pas de ligne (groupe 3) |
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
  **L'auteur les garde telles quelles** (25/10/2026) : désigner un jour
  les rôles par une colonne ou un élément du classeur plutôt que par un
  nom reste possible, hors de ce lot.
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
un message, jamais une attente sans fin. **« Ouverture du combat… »
reste pendant tout le rejeu** d'un combat gardé, qui rend la main au
navigateur tous les 1 000 événements (§ 17.8), sans phrase de plus ;
pendant celui de « Reprendre le combat le plus récent », le bouton laisse
place à la même phrase d'attente, sans rôle (plus bas, « Les lecteurs
d'écran et le clavier »).

**Il suit deux maquettes**, hors dépôt : celle du lot
(`plans/maquette_simulateur.html`, faite le 11/10/2026 à partir du vrai
classeur, validée par l'auteur, et ses rendus à 1 440 et 390 px), pour
l'écran du groupe 1 ; puis la maquette d'ergonomie du groupe 2
(`plans/maquette_ergonomie.html` et ses rendus) : la vue 1 (choisir une
action, la bulle, le survol, les hachures), la vue 2 bis (le jet dans la
bulle, retenue ; la vue 2 est écartée), les vues 3a et 3b (le
téléphone), la vue 4 (une ligne par puissance), les vues 5a et 5b (le
créateur en vignettes, § 15.3). Là où le complément du groupe 2 et sa
maquette diffèrent, le complément l'emporte. Ce qui change par rapport aux
deux est dit plus bas.

**Trois dispositions.** L'ordre du document est celui du téléphone
(décision de l'auteur du 11/10/2026) : la barre de titre ; puis le cadre
de la carte, qui porte le bandeau, la carte, la bulle (juste après la
carte, jamais dans un bouton) et son onglet, puis la zone sous la carte
(ou la préparation, ou un combat arrêté), les personnages, les
adversaires ; puis le journal. Les deux autres dispositions ne font que
placer. Une largeur de plus, `--largeur-combat` (90rem), élargit la page
pour cet écran seul. Les deux seuils s'écrivent en dur dans
`css/combat.css`, comme celui d'`ecran.css` (§ 9) ; une troisième
condition, `(pointer: fine)`, sert aux lignes de la bulle.

| Largeur | Disposition |
|---|---|
| moins de 56rem | une colonne, dans l'ordre du document ; la bulle devient le volet, qui monte du bas |
| de 56 à 80rem | le bandeau, la carte et la zone sous la carte à gauche, les deux listes à droite ; le journal dessous |
| 80rem et plus | celle de la maquette : les personnages, puis le bandeau, la carte et la zone sous la carte, puis les adversaires ; le journal dessous, sur toute la largeur |

La bulle et son onglet n'ont pas de place dans la grille : ils se posent
sur le cadre de la carte, que la feuille fait leur repère (§ 10.1, plus
bas « La bulle »). Ni `transform`, ni `filter`, ni `container-type` sur
l'écran et ce cadre : le volet du téléphone reste fixé à la fenêtre.

**La barre de titre** : « Simulateur de combat » ; l'état (« Préparation »,
« Tour 2 · camp des PJ », « Combat terminé ») ; l'état de l'enregistrement
(§ 17.8) ; « Fin de tour », bouton principal pendant le combat,
**« ↶ Annuler le dernier geste »** (plus bas) et « Nouveau combat ». Une
ligne d'aide dessous, selon la phase.

- **Son ordre dans le document est celui du téléphone** : le titre,
  l'état, « Fin de tour » et un menu « ⋯ », ce que ce menu ouvre
  (« Annuler le dernier geste » et « Nouveau combat », ou l'une de leurs
  deux questions), puis l'état de l'enregistrement.
- **Sous 56rem**, l'état, « Fin de tour » et « ⋯ » tiennent sur une ligne,
  comme sur la maquette ; là où ils ne tiennent pas (vu à 320 et à
  360 px), les deux boutons passent à la ligne, à droite. Ce que « ⋯ »
  ouvre se pose sous eux, sur sa propre rangée : rangé dans la leur, il
  les faisait passer à la ligne en s'ouvrant. L'état de l'enregistrement
  reste visible, sur sa ligne, la dernière. « Effacer » referme le menu ;
  « ⋯ » reste ouvert après une annulation.
- **À partir de 56rem**, « ⋯ » disparaît, et la feuille range tout sur
  une ligne : l'état de l'enregistrement prend la place libre, puis
  viennent « Annuler le dernier geste », « Nouveau combat » et, au bout,
  « Fin de tour ». Ce qui passe à la ligne, vers 56rem, reste à droite.
- **« Fin de tour » est inactif** au milieu d'une action payée (« Une
  action est en cours. »), et quand le combat est arrêté par son
  enregistrement, avec la phrase de la barre pour raison (§ 17.8).
- **À 13 500 événements**, la phrase de la limite (§ 17.3) se lit sous la
  barre, en ambre, et passe une fois par la zone d'avis pour chaque
  combat, à la suite d'un avis déjà là, sans le remplacer.

**La carte** (dans le code, le plateau) : 10 × 10 cases, colonnes A à J,
lignes 1 à 10 ; un en-tête dessus, celui de la maquette (« Carte de
10 × 10 cases · une diagonale compte pour une case », et, à partir de
56rem, « Survolez un jeton pour son nom complet » : le titre de chaque
jeton est son nom entier) ; une légende dessous, qui finit, depuis le
groupe 2, par « portée de la capacité survolée », le mot du complément
(§ 4.2), au téléphone aussi, où rien ne se survole et où c'est l'aperçu
qui hachure : une légende « portée de la capacité choisie » sous 56rem
serait une phrase neuve, à trancher par l'auteur.

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
  1 280 px). **Aucune case ne déborde**, sur 98 largeurs : mesuré avant
  les corrections de la relecture de fin de groupe, puis de nouveau
  après elles (§ 17.11).
- **Le nom court, à partir de 56rem, se mesure sur la case** : 15 % de
  son côté, jamais plus que le petit texte du site (0,875rem, soit
  14 px), ni moins que ses sept dixièmes (9,8 px) ; le rond du jeton et
  le « +k » suivent la même mesure. À 20 %, la mesure d'avant, presque
  tous les noms étaient coupés : 44 sur 46 sur le plateau chargé, à
  1 440 px. C'est **une exception aux tailles de texte du site**, pour
  les seuls jetons de la carte, posée par les corrections de la
  relecture de fin de groupe, et **gardée par l'auteur le 25/10/2026** :
  il les lit bien à mi-fenêtre, et le plancher reste (§ 12). Mesuré le
  12/10/2026 dans Edge 155, sur 32 largeurs de 896 à 1 440 px : le texte
  va de 9,8 à 10,7 px ; à 1 440 px (Edge 155 et Firefox 143, mêmes
  nombres), « Aubépine » et « Chef » sont entiers, « Marmi… 2 » est
  coupé, dans un texte de 10,3 px. Là où la case fait moins de 65 px (de
  896 à 1 100 px, puis de 1 280 à 1 312 px), presque tous les noms
  restent coupés : 43 ou 44 sur 46 sur le plateau chargé ; 36 à 1 120 et
  à 1 344 px ; 26 de 1 152 à 1 279 px, et à partir de 1 366 px.
- **Le nom court se coupe s'il le faut, jamais le numéro d'un
  exemplaire** (« Marmi… 2 ») : sans lui, deux exemplaires d'une même
  case porteraient le même nom coupé. Sous 56rem, des initiales de plus
  de deux signes (« MA11 », à partir du dixième exemplaire d'un
  adversaire quand d'autres noms commencent par la même lettre)
  s'écrivent à 70 % de la taille des autres, pour tenir dans le rond
  (§ 17.11).
- **Une case montre trois jetons au plus**, deux sous 56rem. Au-delà,
  « +k » ouvre la liste de la case : pendant le combat, sur un grand
  écran, dans la bulle (plus bas) ; sur un téléphone et au combat
  terminé, sous la carte ; avant le lancement, sous la préparation.
  Avant le lancement, les jetons d'une case gardent l'ordre d'ajout.
  Pendant le combat, celui qui joue vient d'abord, puis la cible ; puis,
  dans une case de plus de trois protagonistes, ceux qu'on peut choisir ;
  puis les vivants, puis les morts ; à rang égal, l'ordre d'ajout. Dans
  la liste d'une case, les morts viennent de même en dernier : on l'ouvre
  pour choisir, et un mort ne se choisit pas.
- **Les marques.** Celui qui joue, et sa case, sont entourés de l'accent.
  La cible choisie est entourée d'un trait rouge discontinu. Un mort est
  grisé et barré. Sur le jeton de celui qui joue et sur celui d'un jeton
  tenu en main, qui sont de la couleur d'accent, le focus trace en plus un
  anneau dans le rond, de la couleur des initiales.
- **La portée d'une capacité survolée** se hachure sur les cases où elle
  peut agir (plus bas, « Le survol ») : des traits rouge clair de 3 px
  tous les 9 px, à 135°, sous les jetons, sans les cacher, et le bord de
  ces cases ; la case de qui joue garde sa hachure sous la marque de
  l'accent. **Sur une case hachurée, chaque jeton et le « +k » posent sous
  eux une plaque du fond** : leur nom, leurs initiales et leurs ronds ne se
  dessinent pas à même les traits, où le texte tombait à 2,34:1 en sombre.
  Le jeton de qui joue, ou tenu en main, a déjà la sienne, à l'accent. Sur
  la plaque, le texte tient 17,06:1 en clair et 14,63:1 en sombre.
- **Pendant un choix** de cible ou d'arrivée, les jetons et les cases
  possibles sont marqués, les autres inactifs ; ces marques prennent le
  relais des hachures.
- **Après le premier dé d'un geste**, les autres jetons du camp qui joue
  sont inactifs, avec leur raison, « Une action est en cours. », liée au
  jeton et écrite en seconde ligne de son titre. Un jeton inactif qui
  porte une raison n'est pas un jeton écarté par un choix : la carte ne
  grise rien d'autre pendant le jet.
- **Quand on ne joue pas** (un combat arrêté par son enregistrement,
  § 17.8), la carte montre le combat sans rien offrir : aucun jeton ne
  porte de commande, aucune case ne se choisit, rien ne se prend en main
  ni ne glisse.
- **Chaque jeton est un bouton nommé** : nom entier, camp, état, case
  (« Aubépine Crèmebrûlée, personnage, joue, case D4 »). Une case qu'on
  peut choisir l'est aussi. Jamais un bouton dans un bouton : le bouton
  d'une case la couvre, sous ses jetons.
- **Les cases font moins de 44 px sur un téléphone**, leurs jetons et le
  « +k » d'une case pleine aussi : c'est admis, et chaque choix fait sur
  la carte a son double en boutons de 44 px (§ 9).

**La préparation** prend, avant le lancement, la place de la zone sous la
carte. Elle porte : ajouter un personnage, pris dans la liste des
personnages disponibles (§ 17.2), après une attente pour ceux qui sont en
ligne ; **en démonstration, « Ajouter le personnage de démonstration »**
(groupe 2, plus bas) ; ajouter un adversaire, avec son nombre
d'exemplaires ; **« Placer la rencontre préparée »** ; « Qui commence » ;
« Lancer le combat » ; la ligne des câblés absents (§ 17.6) ; les
avertissements des photographies posées. Une option qui ne s'ajoute pas
reste choisissable : c'est ainsi que sa raison se lit. Chaque bloc a sa
rangée. Sous 56rem, l'intitulé « Qui commence » prend sa ligne, et ses
deux options (« Les PJ », « Les adversaires ») viennent ensemble dessous.
À partir de 56rem, « Qui commence » et « Lancer le combat » partagent une
rangée, le second au bout.

- **Poser et déplacer**, par trois moyens qui mènent au même ordre : à la
  souris, par glisser-déposer ; partout, en touchant le jeton, puis la
  case ; ou par le champ « Case » de la fiche. Le glisser-déposer n'est
  jamais le seul moyen : il n'existe ni au clavier ni au doigt.
- **La rencontre préparée** est la composition que l'écran Rencontre garde
  sur l'appareil, chiffrée (§ 16.6), relue par les noms : celle composée
  après l'ouverture du combat, puis l'écran Combat rejoint par le menu,
  rend le bouton actif. Le bouton l'ajoute à la suite, dans l'ordre de la
  liste, numérotation comprise. Si un plafond serait dépassé, rien ne se
  pose, et le bouton dit pourquoi ; un adversaire qui ne s'ajoute pas
  reste hors du combat, les autres se posent, et l'écran dit lequel et
  pourquoi. **Sans rencontre**, le bouton est inactif, et sa raison dit où
  la composer : « Composez d'abord une rencontre à l'écran Rencontre. »,
  où « écran Rencontre » est un lien vers `#/rencontre`.
- **« Ajouter le personnage de démonstration »**, en démonstration
  seulement, dans un bloc à part, sous la liste des personnages, ou après
  la phrase « Aucun personnage enregistré à ajouter… » quand la liste est
  vide, et pendant l'attente : il fait ce que fait celui de l'écran
  Personnages (§ 15.7). Sa question (« Remplacer », « Garder les deux »,
  « Annuler ») s'ouvre sous le bouton, et son focus se pose sans faire
  défiler la page. Une fois le personnage gardé, la phrase de l'écran
  Personnages paraît (« Le personnage « {nom} » est sur cet appareil. »),
  et la liste des personnages disponibles se relit ; il n'est pas ajouté
  au combat d'office. Un fichier introuvable ou illisible le dit dans la
  zone d'avis, comme un refus de le garder (« Le personnage n'a pas pu
  être gardé : {message} »). En mode réel, rien de cela.
- Une banque sans adversaires : la préparation le dit, comme l'écran
  Rencontre. Un combat gardé reste jouable : ses photographies se
  suffisent.

**Les fiches vivantes.** Une par protagoniste, dans la liste de son camp ;
c'est un volet, que son nom déplie.

- **L'en-tête** : la pastille d'initiales et le nom ; une ligne, l'espèce
  et l'archétype d'un personnage (« Marmiton · Saucier »), les types d'un
  adversaire écrits comme sur sa carte (« Commis, Rôtisseur ×1,4 »,
  § 16.5) ; l'état (« joue », « a joué », « ciblé », « mort au tour 2 ») ;
  les actions restantes, en pastilles, dont le nom dit « actions
  restantes : 1 sur 2 ». « 1 action sur 2 » ne s'écrit plus nulle part.
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
- **« Jouer »** choisit ce protagoniste, et ouvre sa bulle ; le nom, lui,
  déplie le volet : jamais un bouton dans le titre d'un volet. Choisir qui
  joue se fait aussi par son jeton, ou par les boutons « Qui joue ? ».
  **« Jouer » suit exactement le choix des jetons** : une fiche d'un autre
  protagoniste du camp qui peut agir le porte tant que rien du geste en
  cours n'est payé, hors d'un choix de cible ou d'arrivée ; ni pendant ce
  choix, ni après le premier dé ; qui joue n'en a pas (plus bas, « La
  bulle »).
- **« Fiche complète »** ouvre un panneau dans l'écran, sous la barre de
  titre, avec « Fermer ». Il reprend l'affichage existant : la vue lecture
  du personnage (§ 15.5), la carte de l'adversaire (§ 16.5). Il les calcule
  depuis la photographie, avec la banque ouverte : la fiche du personnage
  photographié ; pour un adversaire, la résolution d'une banque d'appoint
  qui porte sa ligne et celles de ses types, telles que photographiées. Si
  la banque a changé depuis l'ajout, il le dit : « La banque a changé
  depuis l'ajout : cette fiche suit la banque du jour. » La carte d'un
  adversaire y est posée dans un nœud sans remplissage : son échelle se
  mesure sur la largeur de ce qui la contient.
- **Ouvertes ou repliées.** Sur un grand écran, les fiches sont ouvertes.
  Sous 56rem, seule celle de qui joue l'est. Une fiche que la personne a
  ouverte ou repliée elle-même garde cet état ; la mort du protagoniste la
  replie.
- **Avant le lancement**, le champ « Case » et un bouton « Retirer »
  suivent chaque fiche, **hors de son volet**, sur une rangée qui en
  prolonge le cadre : ils s'atteignent sans déplier la fiche, à toute
  largeur. Sur un téléphone, ce champ est le double de 44 px de la carte
  (§ 9). Une case mal écrite ne part pas : le champ est marqué, et sa
  phrase paraît (« Une case s'écrit de A1 à J10. »). Un jeton déplacé ne
  refait pas le corps de sa fiche. Quand on ne joue pas (§ 17.8), ni
  « Jouer », ni « Case », ni « Retirer » ne s'offrent.
- **Une fiche ne refait que ce dont la vue a changé** : son en-tête,
  son corps, ou le seul bouton « Jouer », qui paraît et disparaît à
  chaque geste sur toutes les fiches du camp qui joue (§ 17.11).
- **Avec le texte à 200 %** sur un téléphone, la table des zones est plus
  large que la fiche : elle y défile, plutôt que de faire défiler la
  page.

**La bulle** (groupe 2 ; complément, § 4.1 ; vue 1 de la maquette
d'ergonomie). Tout ce qui se décide pour un geste se fait désormais dans
**une bulle accrochée au jeton de qui joue**, à côté de sa case : la liste
des capacités, puis la cible ou la case d'arrivée, puis le jet. C'est le
panneau d'action du groupe 1, déplacé et resserré : ses étapes, ses
commandes, ses raisons et ses doubles de 44 px restent. Sous 56rem, la
bulle devient le volet (plus bas, « Le téléphone »).

- **Elle s'ouvre** par un clic sur un jeton du camp qui joue, ou Entrée
  sur ce jeton ; par un bouton « Qui joue ? » sous la carte, ou par le
  bouton « Jouer » d'une fiche. Pendant le combat, « +k » ouvre la liste
  de la case dans la bulle même, nommée par son titre (« Case D4 ») ;
  choisir un jeton y met ses options à la place, et « Fermer » de cette
  liste rend ce que la bulle montrait, ou ferme la bulle ouverte pour elle
  seule, le focus au « +k ». Hors d'un choix de cible, un clic sur un
  jeton de l'autre camp n'ouvre rien.
- **Son en-tête** : le nom entier, puis « actions restantes : 1 sur 2 ·
  souffle 6/10 » (sans souffle écrit : « souffle — »), puis « ✕ ».
- **Ses lignes**, groupées par origine, dans l'ordre et sous les
  intitulés du groupe 1 (« Couteau d'office (précise) », … ; pour un
  adversaire, une rangée par arme, puis « Capacités »), chaque objet sous
  le sien. **Une ligne par capacité et par puissance jouable** (§ 17.6),
  dans l'ordre des façons de la photographie. Chaque ligne porte le nom et
  la puissance (« Fournaise [1] ») ; les dégâts d'une attaque (« 3/8/20 »),
  ou, pour un déplacement, « 1 case », « 2 cases » ; « désavantage » s'il
  y a lieu ; « intervention » pour une intervention ; et, à droite, le
  coût : « gratuit », « 4 souffle », « 1 souffle, 1 lien », « X souffle ».
  Une ligne inactive garde le focus et sa raison, liée à elle. « Passer
  son tour » ferme le dernier groupe. **Les lignes sont des rangées
  plates** (vue 1) : ni bord ni fond au repos, aucun écart entre deux
  lignes d'un groupe, ni sous l'intitulé ; au survol et au focus, le fond
  doux de l'accent et un trait d'accent en dedans. Leur bord existe,
  transparent : une ligne inactive y garde son trait discontinu, l'aspect
  d'un bouton inactif du site, et ne s'éclaire ni au survol ni au focus.
  « Passer son tour » a le même aspect, dans la bulle, sans être une ligne
  (plus bas, « Ses lignes font 36 px »).
- **Son pied** : « Passifs : », puis chaque passif (« Réduction [1] »),
  séparés par « , », chacun pouvant recevoir le focus (plus bas, « Le
  survol »). Un passif est une cible de 44 px, à la souris comme au
  doigt ; son nom est souligné d'un trait pointillé, sous le texte même,
  écarté d'une part de la taille du texte (`--decalage-soulignement`),
  jamais en bord de sa boîte de 44 px : le trait et la couleur du texte
  disent ensemble qu'il s'ouvre.
- **Sa vie.** Elle se ferme par ✕, par Échap, ou par un clic hors de la
  bulle et hors de la carte ; un clic sur un autre jeton du camp qui joue
  ouvre la bulle de celui-ci. **Avant le premier dé**, fermer vaut
  « Revenir » : rien n'est dépensé. **Après le premier dé**, ✕ devient
  « – » (« Réduire ») : ce bouton, Échap et un clic au-dehors réduisent la
  bulle en **un onglet**, un bouton accroché au jeton (« Taloche [1] :
  rouvrir »), qui la rouvre, le focus sur la commande qui attend. Les
  autres jetons du camp sont alors inactifs (« Une action est en
  cours. »). **Le geste fini** (« Appliquer », « Confirmer », « Passer son
  tour ») : si le protagoniste peut encore agir, la bulle revient à sa
  liste, le focus sur la première ligne active ; sinon elle se ferme, le
  focus va à son jeton, et la zone sous la carte montre « Qui joue ? ». Il
  en va de même pour la bulle d'un adversaire. Cachée ou réduite, la bulle
  vide son corps : une saisie en cours dans un jet réduit puis rouvert se
  perd.
- **Sa place** se calcule à son ouverture, quand son protagoniste ou le
  genre de son contenu change (la liste, le jet, la liste d'une case), et
  quand la fenêtre change de taille ; jamais au défilement, jamais à un
  dé. Une infobulle se place à sa propre ouverture. **La bulle se place
  sur la carte telle que le rendu la laisse** : après ce qui, au même
  rendu, la déplace en changeant de hauteur (le panneau « Fiche
  complète » et la zone d'avis, au-dessus du cadre ; le bandeau, au-dessus
  de la carte ; le journal, dessous, ne la déplace pas), puis le focus.
  Rouverte d'elle-même au rechargement en plein jet, elle vise ainsi sa
  case, sous le bandeau qui paraît au même rendu. Un bandeau qui change de
  hauteur après le rendu, quand sa coupe se refait sur un changement de
  largeur, ne la replace pas. Elle s'écrit par la seule fonction admise
  de `js/ecrans/echelle.js`, en trois propriétés CSS que la feuille
  lit (§ 10.1) ; l'ancrage CSS n'est pas employé. Les côtés s'essaient
  dans cet ordre : à droite de la case, en laissant libre la colonne
  voisine (vue 1), puis à gauche, en dessous, au-dessus ; elle prend le
  premier où elle tient entière, à 16 px au moins des bords de la
  fenêtre ; si aucun ne tient, le premier, ramené dans la fenêtre.
  « Entière dans la fenêtre » s'entend à l'ouverture. Sa flèche, de 8 px,
  pointe vers le milieu de la case, à 60 px du bord de la bulle quand la
  place le permet (22 px pour l'onglet), jamais à moins de 12 px de ses
  coins. Elle se dessine, à partir de 56rem, en deux triangles de bords,
  du côté du jeton : celui de `--bordure`, puis celui du fond par-dessus.
  La feuille pose les quatre bords transparents avant les règles de côté,
  qui en colorent un, et seulement le style et la largeur des bords à
  56rem : aucune règle venue après les côtés n'y repose une couleur. Le
  volet n'a pas de flèche.
- **Sa taille** : 20rem pour la liste, 29,5rem pour le jet, jamais plus
  large que le cadre de la carte, qui ne l'est jamais plus que la fenêtre
  moins 32 px. Au-delà de la hauteur de la fenêtre moins 32 px (en pixels,
  quelle que soit la taille du texte, comme la marge que garde le
  placement), elle défile en elle-même : elle ne fait jamais défiler la
  page. **Ce qui défile en elle** repart du haut à chacune de ses
  ouvertures, et quand l'onglet la rouvre, jamais à un dé ; ce qui reçoit
  le focus et l'aperçu qui s'ouvre sous une ligne y sont amenés dans la
  partie vue, par le plus court (le haut d'abord, pour ce qui est plus
  grand qu'elle), par son propre défilement seulement, jamais par celui
  de la page : une seule fonction de la bulle, `montrerDansLaBulle`,
  l'écrit (plus bas, « Aucun défilement automatique »).
- **Ses lignes font 36 px de haut avec une souris** (`pointer: fine`), et
  44 px au doigt : l'exception du § 9, pour les lignes de la bulle
  seulement, une capacité à une puissance, seules à porter `data-ligne`.
  « Passer son tour », qui n'en est pas une, et les rangées du jet
  (« Jet d'attaque », les armes, les cases d'arrivée, les caractéristiques,
  les difficultés, les jauges, les dégâts, les natures) gardent leurs
  44 px.
- **Pour le clavier et les lecteurs d'écran**, c'est un dialogue non
  modal, nommé « Aubépine Crèmebrûlée : ses actions », sans piège. À
  l'ouverture, le focus va à sa première ligne active (sinon à « Passer
  son tour », sinon à son titre). ✕ ou « – » est son dernier élément :
  Tab, après lui, quitte la bulle vers ce qui suit la carte, et la bulle
  reste ouverte (le complément dit « après la dernière ligne » : lu
  « après son dernier élément », qui laisse les passifs et ✕ au clavier ;
  à trancher par l'auteur). Depuis son premier élément, Maj+Tab revient
  au jeton ; pour la liste d'une case, au « +k » qui l'a ouverte, qui en
  tient lieu ; sans protagoniste ni case (la liste d'une case ouverte
  depuis « Qui joue ? » n'a pas de « Passer »), l'appui n'est pas pris, et
  le navigateur fait. **Échap ferme d'abord l'infobulle ouverte**, de la
  bulle ou de la zone sous la carte, où que soit le focus et sans le
  déplacer ; au survol de « Jet d'attaque », qui n'a que des hachures, il
  efface d'abord celles-ci. **Un second Échap**, le focus dans la bulle,
  sur son jeton ou sur le « +k » qui en tient lieu (celui de la case dont
  la liste est ouverte, ou celui de la case du protagoniste quand son
  jeton ne se voit pas), ferme ou réduit la bulle, et rend le focus au
  jeton (au « +k » pour la liste d'une case) ; ailleurs, il n'est pas
  pris. Un clic au-dehors ne déplace pas le focus. **Sur un bouton
  inactif hors de la bulle**, il la ferme ou la réduit comme tout clic
  au-dehors, et ne fait rien d'autre : l'écran retient, à la capture,
  avant que la bulle se ferme, l'élément inactif qu'il touche, et le
  bouton ne fait rien, même redevenu actif entre-temps (« Annuler le
  dernier geste », inactif pendant un geste non payé, le redevient quand
  la bulle se ferme ; il ne pose pas sa question, et garde le focus).

**Le survol d'une ligne** (groupe 2 ; complément, § 4.2).

- **L'infobulle.** Au survol d'une ligne, ou quand elle reçoit le focus,
  une infobulle de 18rem s'ouvre du côté de la bulle opposé au jeton, à la
  hauteur de la ligne (si la place manque : de l'autre côté, puis
  dessous). Elle dit : le nom et l'origine (« Frappe · Couteau
  d'office ») ; l'origine est, pour un personnage, l'arme qui donne la
  façon, hors les mains nues, dont l'arme porte le nom de la capacité, et
  sinon le titre de son groupe (« Taloche · Gestes de cuisine ») ; pour un
  adversaire, son arme, sinon rien ; la description, évaluée à la
  puissance de la ligne ; la portée, en clair ; **les causes qui ne
  dépendent pas de la cible**, la
  maîtrise et « en meute », sans rien dire d'une absence ; le coût
  (« Coût : 1 action, aucun souffle » ; un adversaire dont le coût porte
  du lien y ajoute « ; coût en lien non payé : un adversaire n'a pas de
  lien » ; « Coût : illisible »). Elle est liée à sa ligne, après sa
  raison, ne prend jamais le focus, et reste ouverte tant que le pointeur
  est sur sa ligne ou sur elle, ou que la ligne a le focus (WCAG 1.4.13) :
  le pointeur qui la quitte lui laisse 300 ms. Une seule est ouverte à la
  fois.
- **La portée, en clair** : « Portée 0 : sa case seule, hachurée sur la
  carte. » ; « Portée 1 : sa case et les huit cases voisines, hachurées
  sur la carte. » ; « Portée 2 : sa case et les cases à 2 de distance au
  plus, hachurées sur la carte. » ; un déplacement : « Arrivée : les cases
  à une distance de 1 à 2, hachurées sur la carte. » ; une capacité sans
  jet : « Cible au choix, sans condition de portée » ; un jet de
  caractéristique : « Sans cible ».
- **Les hachures** : pour une attaque, les cases dont la distance de
  Tchebychev va de 0 à la portée de la façon de la ligne (`portee`, à sa
  puissance ; absente, 0 : la case seule) ; pour le bouton « Jet
  d'attaque » d'une capacité sans jet, la portée de l'arme prêtée, à son
  survol ; pour un déplacement à la puissance P, les cases à une distance
  de 1 à P ; pour une capacité sans condition de portée, ou sans cible,
  aucune. Elles s'effacent quand le survol cesse, que le contenu de la
  bulle est refait ou qu'elle se ferme. Pendant le choix d'une cible ou
  d'une case d'arrivée, seul « Jet d'attaque » en pose.
- **Les passifs du pied** ouvrent la même infobulle : nom, origine,
  description à leur niveau, « Passif : ne se joue pas », sans hachure.
- **Au doigt**, jugé à l'appui lui-même (`pointerType` « touch ») : le
  premier appui sur une ligne l'ouvre en aperçu, sous elle, sans rien
  jouer (la description, la portée, les causes et les hachures, puis un
  bouton « Jouer Frappe » ; une ligne inactive y montre sa raison) ;
  « Jouer », ou un second appui sur la même ligne, la joue. Entrée joue
  toujours. **Le focus qui suit un appui du doigt n'ouvre pas
  l'infobulle**, où qu'ait eu lieu l'appui : sur la ligne, ou sur le jeton
  qui ouvre la bulle ou le volet, dont la première ligne reçoit alors le
  focus. L'écran retient sur sa racine, à la capture, le genre du dernier
  appui (le doigt, la souris ou le stylet à l'appui, le clavier à une
  touche), et le passe aux infobulles de la bulle et de la zone. Une
  tablette au doigt, au-delà de 56rem, n'en ouvre donc pas non plus ; au
  clavier, le focus l'ouvre. **L'aperçu ouvert le dit** : sa ligne porte
  `aria-expanded="true"` et `aria-controls`, vers l'identifiant de
  l'aperçu, jusqu'à ce qu'il se ferme. Un passif ouvre le sien, sans
  bouton ni hachure, et sans rien porter : un texte sans rôle n'admet pas
  `aria-expanded`.

**Les causes des avantages et des désavantages** (groupe 2 ;
complément, § 4.3). Dans le contexte du jet et dans l'infobulle d'une
ligne, et seulement là, le nombre (« 1 avantage ») porte « ⓘ », caché aux
lecteurs d'écran ; le nombre se nomme « 1 avantage : voir la cause »
(« avantages et désavantages s'annulent : voir la cause »). Son survol ou
son focus ouvre une infobulle, dessous, sinon dessus ; au doigt, ou par
Entrée au clavier, il ouvre l'explication sous la ligne, puis la referme ;
à la souris, son clic ne fait rien de plus. Une phrase par
source, tirée de son rôle (§ 17.6) et de la situation ; les phrases qui
portent un nom ne s'accordent pas avec lui et n'élident rien ; le poids
s'écrit comme la photographie l'écrit (« précise ») ; un passif qui
évolue porte son niveau :

- « Solo du chef [1] : aucun allié de son camp sur sa case (D4) ;
  1 avantage. » ; « Brigade [1] : un allié sur sa case (D4) ;
  1 avantage. », phrase que prend aussi « esprit de corps », et « un
  allié » même s'ils sont plusieurs ;
- « Frappe hors maîtrise : Frappe vient du Couteau d'office (précise), et
  aucune maîtrise de ce poids ne couvre sa place dans le bloc ;
  1 désavantage. » ;
- « Types d'armure mêlés : 1 désavantage en défense. » ;
- « À la main : {raison saisie}. » ;
- l'inversion, à la suite de la phrase de sa source : « Venu de Marmiton
  n° 2 : ce désavantage devient un avantage pour Aubépine. » (ou « … : cet
  avantage devient un désavantage pour … ») ;
- la description d'un passif suit sa phrase, entre guillemets, quand elle
  n'est pas vide : « « Seul sur sa case : 1 avantage. » » ;
- **le compte**, seulement quand avantages et désavantages sont là
  ensemble : « Avantages et désavantages s'annulent : aucun ne reste. » ;
  sinon « Avantages et désavantages s'annulent : il reste 1 avantage. »
  (lecture à la lettre du complément).

Les causes d'un avantage se lisent en vert, celles d'un désavantage en
rouge, toujours doublées de leur phrase. Un adversaire dit ses causes de
son point de vue. Ce sont des phrases d'écran, non des gabarits du
journal : le journal ne change pas (§ 17.9).

**Le jet dans la bulle** (groupe 2, ordinateur ; vue 2 bis). Le jet se
joue dans la bulle, à la place de la liste, sur 29,5rem. Elle porte, dans
cet ordre :

- **l'en-tête** : le libellé de la capacité, suivi de « contre » ou
  « sur » et du nom entier de la cible dès qu'elle est choisie
  (« Taloche [1] contre Marmiton de corvée n° 2 ») ; le libellé seul pour
  un geste sans cible, un déplacement, un jet de caractéristique. Puis le
  nom court, l'action que coûte le geste, comptée avant le paiement, et le
  souffle courant : « Aubépine · dernière action · souffle 6/10 » ;
  l'action s'écrit « dernière action » s'il n'en restait qu'une, sinon
  « action 1 sur 2 ». Puis « – » ou « ✕ ». **Quand un adversaire
  attaque** : « Frappe contre Aubépine Crèmebrûlée », puis « Chef ·
  dernière action · souffle 6/7 » ; et, sous les étapes, « Aubépine lance
  sa défense · souffle 6/10 », pour une attaque ou un jet prêté d'un
  adversaire contre un personnage seulement ;
- **les étapes** du groupe 1 : Capacité › Cible › le jet (« Jet
  d'attaque » pour un personnage, « Jet de défense » quand un adversaire
  attaque) › Localisation › Interventions › Dégâts ; chacune faite, en
  cours, ou à venir. Une capacité sans jet : Capacité › Cible ; un
  déplacement : Capacité › Arrivée ; un jet de caractéristique : Capacité
  › Jet de caractéristique ;
- **les rangées de choix** : « Jet d'attaque » (lié aux hachures de
  l'arme prêtée), « Arme : », « Cible : », « Arrivée : », les
  caractéristiques, « Difficulté : », X, « Lien payé sur : ». La cible
  se choisit par un clic sur un jeton, ou par un bouton par cible
  possible ; sous elle, « choisie sur la carte » ou « choisie ici ».
  **Pendant le jet, la rangée « Cible : » reste montrée**, avec la seule
  cible choisie : enfoncée, entourée du trait rouge discontinu, inactive
  (« Une action est en cours. »), son nom à la couleur du texte ;
- **le contexte** : le dé, écrit nu, puis ses modificateurs, chacun une
  fois, avec sa source, sans séparateur (« Dé d8 (Force 4 + Agilité 5)
  +1 (Vif) · difficulté 5, sa défense ») ; la difficulté ; les avantages
  et les désavantages, avec ⓘ ; et, quand deux types d'armure sont à
  égalité, « Défense : » et une liste (« agile », « précise »), jusqu'au
  premier dé (§ 17.4) ;
- **le jet** : la chaîne, en dés de 64 px, puis le bilan ; les rangs de
  dégâts, le rang atteint en évidence ; les choix du moment : relancer ou
  garder, faire exploser, les dégâts à fixer, la face à décaler,
  l'esquive et combien ; le détail des dégâts, avant « Appliquer » ;
  « Confirmer » pour un geste sans jet, et « Revenir » avant le premier
  dé. Le bilan d'une relance garde sa tête (« 1 réussite pour l'instant.
  Avantage dépensé : cliquez sur le d8 pour relancer le 2e dé. ») ;
  « cliquez » s'y écrit, comme sous le dé à lancer, au téléphone et au
  doigt aussi, où la vue 3b dit « touchez » : « touchez » sous 56rem
  serait une phrase neuve, à trancher par l'auteur ; la
  face à décaler se nomme sans équivoque (« Décaler le dé 16 : bras
  gauche », puis « Décaler le dé 16 : face 18, bras droit », chacun suivi
  de ses bornes), et le dé décalé porte en titre ce qu'il a tiré
  (« d20 : 16 ») ;
- **en pied, toujours montrés**, « Effets de capacité (mode assisté) » et
  la description à la puissance jouée (mission, § 2) ; puis, tant qu'ils
  existent, « Réglages à la main (avant le premier dé) », repliés, qui se
  déplient d'un clic, gardent leur état pendant le geste et disparaissent
  au premier dé.

**Une saisie refusée ne part pas, et le dit** : X, un modificateur, des
avantages, des dégâts, un décalage, l'esquive. Le champ fautif est marqué,
bordure et trait intérieur rouges, sans changer de taille, et reçoit le
focus ; une phrase liée aux champs de la saisie dit ce qui est attendu :
« Un nombre entier de −20 à 20 est attendu. », aux bornes de la saisie
(sans bornes : « Un nombre entier est attendu. »), ou « Une raison est
demandée. ».

**La zone sous la carte** ne porte plus que : « Qui joue ? » et un bouton
par protagoniste du camp qui peut encore agir, quand personne n'est
choisi ; sinon, sur un grand écran, la phrase « Le jet se joue dans la
bulle, à côté des jetons. » ; au combat terminé, la phrase de la fin ;
avant le lancement, la préparation ; un combat arrêté par son
enregistrement (§ 17.8), un bloc avec la phrase de la barre et son bouton.
Sur un téléphone, elle porte le jet (plus bas).

**Le bandeau « Dernier événement »** (groupe 2 ; complément, § 4.4).

- **Sa place** : au-dessus de la carte, sur la largeur de sa colonne.
  Avant le lancement, il n'est pas montré.
- **Ce qu'il montre** : la dernière ligne du journal, avec ses couleurs et
  ses cadres (§ 17.9), sur le second fond, une bordure gauche d'accent,
  dans la chasse fixe du site. **Pendant un geste, après le premier dé
  seulement**, il montre **la ligne en cours** de ce geste, avec une
  bordure gauche ambre : toujours le début exact de la ligne qui
  s'écrira, suivi de « … » ; un dé qui peut exploser s'y écrit sans son
  signe tant qu'il attend (§ 17.9). Avant le premier dé, il garde la
  dernière ligne du journal ; le geste fini, sa ligne définitive le
  remplace. Le journal lui-même n'écrit toujours sa ligne qu'à la fin du
  geste.
- **Trois lignes au plus**, sur ordinateur comme sur téléphone. Au-delà, il
  garde, dans cet ordre, la première phrase (qui fait quoi, contre qui),
  la phrase du jet, celle qui porte le cadre et le bilan, puis, en partant
  de la fin, autant des phrases suivantes que trois lignes en tiennent.
  Chaque suite ôtée devient « […] ». Si la première phrase et la phrase du
  jet ne tiennent pas ensemble, la première se coupe par « … » : par
  segments entiers, puis par mots, puis par signes d'un nom, la plus
  longue qui tient ; aucun dé n'est coupé, et le « … » de la ligne en
  cours reste en dernier. **Une première phrase qui s'ouvre sur le nom de
  qui agit le garde au moins**, entier, suivi de « … » : la coupe ne
  descend jamais sous lui (« Aubépine… », puis « […] » et la phrase du
  jet) ; cela
  vaut pour un adversaire qui agit, et se juge au genre du segment, qui
  agit, jamais à son texte. Une ligne sans lui (le lancement) garde la
  règle première, et peut n'en garder que « … ». Si ce minimum ne tient
  pas encore, la feuille rogne la fin, sans marque. Garder le nom est un
  choix fait au groupe, le complément se taisant sur ce cas ; couper aussi
  la phrase du jet par « … », plutôt que laisser la feuille la rogner,
  reste à trancher par l'auteur. Un nom de qui agit très long, gardé
  entier, peut chasser le jet, que la feuille rogne. Les
  phrases sont celles que le journal a écrites comme telles,
  jamais un point trouvé dans le texte. La mesure compare la hauteur du
  texte à trois fois sa hauteur de ligne ; elle se refait à chaque ligne
  nouvelle et quand la largeur change, jamais pour la hauteur seule.
- **Le clic.** « Journal ↓ » est un bouton, jamais un lien (une adresse
  « #… » changerait la route). Ce bouton, ou un clic à la souris sur le
  reste du bandeau, appelle `montrerLeJournal()`, le seul défilement de
  l'écran (plus bas), qui montre le journal par son haut, puis donne le
  focus à son titre, « Journal », sans défiler de nouveau. Un appui du
  doigt sur le reste du bandeau ne fait rien.
- **Pour les lecteurs d'écran**, le bandeau n'est ni un bouton ni une
  région d'annonce : son texte coupé leur est caché, et la ligne entière
  le suit, cachée à la vue, par le procédé de la région d'annonce ; son
  titre, au survol, porte aussi la ligne entière.
- **Sur un téléphone**, l'étiquette « Dernier événement » disparaît, et
  « Journal ↓ » passe sous le texte.

**Aucun défilement automatique** (groupe 2 ; complément, § 4.5).
L'écran ne fait jamais défiler la page de lui-même. Chaque focus qu'il
pose l'est sans défiler (`preventScroll`) ; le seul `scrollIntoView` est
celui de `montrerLeJournal()`, demandé par un clic ; ni `scrollTo`, ni
`scrollBy`. Deux défilements propres seulement s'écrivent, jamais celui
de la page : la liste du journal défile en elle-même pour montrer sa
dernière ligne, comme au groupe 1, par une seule écriture ; et ce qui
défile dans la bulle, par la seule `montrerDansLaBulle` (plus haut, « Sa
taille »). Le focus suit toujours la commande qui attend, selon la règle
du groupe 1 ; la bulle étant à côté du jeton, cette commande est déjà à
l'écran, et, si la bulle défile, dans sa partie vue. Un contrôle lit les
sources de l'écran pour le tenir (§ 11).

**Le téléphone** (sous 56rem ; complément, § 4.9 ; vues 3a et 3b).

- **La liste des capacités s'ouvre dans un volet** qui monte du bas, au
  plus 45 % de la hauteur de la fenêtre, et défile en lui-même. Il porte
  l'en-tête (le nom, les actions restantes, le souffle) et ✕ ; sa poignée
  n'est qu'un repère visuel. Il se ferme par ✕, par Échap, ou par
  « Jouer ». Quand la page est défilée jusqu'à la carte, celle-ci reste
  visible au-dessus. Le volet ne porte ni le jet, ni l'onglet, ni flèche.
- **Le volet ne retient pas le focus** : non modal, il peut couvrir ce qui
  l'a (WCAG 2.4.11). Tant qu'il est montré, la page garde en bas une marge
  de défilement de sa hauteur au plus (`scroll-padding-bottom`, le jeton
  `--hauteur-volet`), et ce que Tab atteint après ✕ se montre au-dessus
  de lui ; à 56rem, la bulle posée n'en demande aucune. C'est la feuille
  qui le fait, par la seule règle de `css/combat.css` qui part de la
  racine (`html:has(…)`) : le code n'écrit aucun style. Restent : ce qui
  finit la page (« Copier ») peut rester quelques pixels sous le volet, la
  page ne défilant plus au bout ; dans Firefox, une fiche haute en partie
  vue, que Firefox ne fait pas défiler (jamais entièrement cachée : WCAG
  2.4.11 tenu, 2.4.12 non) ; et, après le premier dé, le jeton de qui joue
  n'a plus de commande : Entrée sur lui ne ramène pas le focus au geste en
  cours. À trancher par l'auteur.
- **Jouer une capacité** : le premier appui sur une ligne ouvre son aperçu
  avec « Jouer … », amené dans la partie vue du volet ; « Jouer », ou un
  second appui, la joue, et le volet se ferme. Ouvert d'un appui du
  doigt, le volet ne montre aucune infobulle sur sa première ligne, qui a
  le focus (plus haut, « Au doigt »).
- **La cible ou l'arrivée** se choisit sur la carte, ou par les doubles de
  44 px, sous la carte.
- **Le jet se joue juste sous la carte**, dans la zone, avec les en-têtes
  du jet dans la bulle, sans la liste des capacités, ni ✕, ni « – ». Les
  causes s'y ouvrent sous la ligne.
- **Le bandeau** reste au-dessus de la carte, sur trois lignes au plus ;
  « +k » ouvre sa liste sous la carte ; **« Annuler le dernier geste »**
  est dans le menu « ⋯ ».

**« Annuler le dernier geste » à l'écran** (groupe 2 ; complément,
§ 4.10 ; § 17.3).

- **Le bouton** : « ↶ Annuler le dernier geste », le signe caché aux
  lecteurs d'écran, dans la barre de titre, à gauche de « Nouveau
  combat » ; sous 56rem, dans « ⋯ ». Avant le lancement, il n'est pas
  montré. Inactif, il garde sa raison (§ 17.3), et son clic ne demande
  rien, même quand ce clic, fermant la bulle d'un geste non payé, le rend
  actif : la bulle se ferme, le focus reste sur lui ; quand on ne joue
  pas (un combat ouvert ailleurs, § 17.8), il est inactif avec la phrase
  de la barre, comme « Fin de tour ».
- **La question** se pose dans l'écran, comme pour « Nouveau combat »,
  jamais par une boîte du navigateur, à la place des boutons :
  « Annuler ce geste : Aubépine — Taloche [1] contre Marmiton n° 2 ? Ses
  dés seront perdus. » (la seconde phrase seulement si le geste a des
  dés) ; « Annuler ce geste : Aubépine — Pas chassé [1], C3 → D4 ? » ;
  « Annuler ce geste : Aubépine — passer son tour ? » ; « Annuler la fin
  du tour des PJ ? » (ou « des adversaires »). Ses boutons : « Annuler le
  geste » et « Garder » ; le focus va à « Garder ». Une question ouverte
  se ferme si le bouton devient inactif.
- **Après l'annulation**, personne n'est choisi : la bulle est fermée, la
  zone sous la carte montre « Qui joue ? », et le focus reste sur le
  bouton « Annuler le dernier geste », sans défiler. Au journal, les
  lignes du geste sont barrées, et la ligne « Annulé : … » s'ajoute
  (§ 17.9) ; la région d'annonce la dit. « Garder » rend le focus au
  bouton.

**Le journal** est sous le reste, sur toute la largeur : les lignes du
§ 17.9, la dernière visible. Sa hauteur est limitée, 24rem sur un grand
écran, 18rem sur un téléphone, et il défile. « Copier » et « Télécharger »
sont inactifs avant le lancement : le journal est vide.

- **Ses couleurs et ses cadres**, à l'écran seulement (§ 17.9) : le nom de
  qui agit et celui de la cible dans la couleur de leur camp, en gras ; la
  capacité jouée à l'accent ; ✓ et ✗ en vert et en rouge ; la lettre et sa
  valeur, et le nombre saisi après « ajusté à », en ambre, en gras ;
  « Fin du tour… » en italique ; « — Tour… — » à l'accent ; **la phrase de
  la mort**, seule, en rouge et en gras ; les dés d'un même jet dans un
  cadre fin. Les lignes d'un geste annulé sont barrées.
- **La dernière ligne reste visible en revenant sur l'écran**, le combat
  en mémoire : la première pose de la liste attend que son nœud soit dans
  la page, à la fin du tour, puis la liste se règle sur sa dernière
  ligne.
- **Chaque ligne se met en page, vue ou non** : aucune ne saute la mise en
  page hors de la vue (ni `content-visibility` ni `contain-intrinsic-size`,
  nulle part dans la feuille, et un contrôle le tient). Sautées, les
  lignes jamais vues prenaient une hauteur d'attente, la liste se calait
  au bout sur ces hauteurs, et sa dernière ligne tombait sous la partie
  vue dès que le journal entrait dans la fenêtre. Le prix : chaque
  changement de l'écran paie la mise en page du journal entier, ce qui
  retient « Annuler le dernier geste » sur un long combat (§ 17.11).
- **Les lignes laissent à droite la place d'une barre de défilement** :
  dans Firefox, elle se pose sur le contenu, et couvrait la fin des
  lignes.
- **C'est une région que son titre nomme**, « Journal » ; ce titre reçoit
  le focus de `montrerLeJournal()`.

**Les lecteurs d'écran et le clavier.**

- **Une seule région d'annonce**, polie : elle dit le résultat de chaque dé
  (« 1er dé : 9, réussi. », « 2e dé : 4, échec. Relancer ou garder ? »), le
  bilan d'un jet, un dé de localisation, une esquive et une face décalée,
  la ligne d'un geste fini, la ligne « Annulé », un tour qui change. Le
  bilan est une phrase (« 1er dé : 2, échec. Aucune réussite, Aubépine
  reçoit C = 15. ») ; il ne dit rien de dégâts qui restent à saisir. Une
  valeur de dé passée sous zéro y porte le moins du journal. Ni l'état de
  la barre, ni celui de l'enregistrement, ni le bandeau ne sont des
  régions.
- **Cette région est dans la page dès le premier rendu, vide**, sous la
  racine de l'écran, après le journal, et elle y reste quand la
  préparation ou un combat arrêté prend la place de la zone. « Journal
  copié. » y passe aussi, le focus restant sur « Copier » ; l'annonce
  suivante du combat le remplace. **Pendant « Reprendre le combat le plus
  récent »**, la phrase d'attente qui remplace le bouton n'a pas de rôle :
  la région d'annonce, déjà dans la page, reste la seule région polie de
  l'écran. Seule l'attente de l'ouverture, avant que cette région soit
  dans la page, est une région (`role="status"`).
- **Les états de l'enregistrement qui demandent un geste ou préviennent
  d'une perte**, et la limite des 13 500 événements, passent une fois, à
  leur arrivée, par une zone d'avis, avec leur bouton s'ils en ont un ;
  leur phrase reste ensuite dans la barre.
- **Un bouton inactif garde le focus**, et sa raison lui est liée ; il ne
  fait rien, même quand le clic qui le touche, fermant la bulle, le rend
  actif (plus haut, « Pour le clavier »). Dans la barre et la bulle, sa
  raison se lit sous la rangée du bouton quand on le survole, qu'on le
  touche ou qu'il a le focus. Dans la préparation, elle s'écrit sous le
  bouton.
- **Un bouton inactif se voit** : trait discontinu, fond transparent,
  texte au second gris, sans opacité, pour une ligne de la bulle comme
  pour un bouton du site (« Fin de tour » pendant un geste, « Lancer le
  combat », « Ajouter », « Copier », « Confirmer », « Annuler le dernier
  geste »).
- **Le focus.** Après chaque geste, il va à la commande qui attend : le
  dé à lancer, le choix du moment, « Appliquer », sans défiler. Un
  réglage qui ne fait pas avancer le geste le garde : après une
  caractéristique sur deux, il revient au bouton actionné. Un dé lancé
  reste un bouton, pour relire la chaîne au clavier, et son nom dit sa
  valeur et son état. Un choix fait sur la carte (une cible) met le focus
  dans la bulle, sur la commande qui attend.
- **Les régions, les groupes et les tables se nomment.** Le journal et
  les réglages à la main sont des régions que leur titre nomme. Chaque
  rangée de choix (« Arme : », « Cible : », « Arrivée : », les
  caractéristiques, « Difficulté : », « Lien payé sur : », « Dégâts : »,
  « Nature : ») est un groupe que son intitulé nomme. Le double d'une
  case d'arrivée porte le nom de la case de la carte (« Case G2 : s'y
  déplacer »). La table des zones d'une fiche porte le nom de son
  protagoniste (« Zones : Aubépine Crèmebrûlée »), et le nom d'une zone y
  est l'en-tête de sa ligne. Avant le lancement, « Case » et « Retirer »
  forment un groupe au nom du protagoniste.
- **Un nom accessible est un texte montré** : celui d'un bouton ou d'un
  dé, qui peut porter un nom venu de la banque (une zone, une arme),
  perd comme les autres les signes qui commandent le sens de l'écriture.
- **Jamais la couleur seule** (§ 9) : un dé porte ✓ ou ✗, un jeton ses
  initiales ou son nom, une armure entamée ses deux nombres, une case
  hachurée la phrase de portée de l'infobulle, une ligne annulée la ligne
  « Annulé » qui la suit. Un dé relancé garde le rouge de son échec, en
  trait discontinu, et sa valeur, grisée, est barrée : par un trait de
  fond d'un pixel, à mi-hauteur et de la largeur de la valeur, non par
  `text-decoration`, que Firefox ne dessinait pas sur la valeur, un bloc
  dans un bouton souple. Le trait est fin, gris sur gris : il se voit de
  près.
- L'écran ne redessine que ce dont la vue a changé : une saisie en cours et
  le focus survivent au rendu que provoque la fin d'une écriture.

**Les couleurs** vivent dans `css/jetons.css`, pour les deux thèmes
(§ 9) : les onze du groupe 1, puis les quatre du groupe 2.

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--combat-pj` | #1e7a3c | #3fae62 | le rond d'un personnage |
| `--combat-pj-doux` | #e2f2e7 | #163222 | le fond d'un personnage |
| `--combat-pj-texte` | #1e7a3c | #9ee0b4 | le texte d'un personnage |
| `--combat-adv` | #b3261e | #e66b61 | le rond d'un adversaire |
| `--combat-adv-doux` | #fbe3e1 | #3a1c1a | le fond d'un adversaire |
| `--combat-adv-texte` | #b3261e | #f2aaa3 | le texte d'un adversaire |
| `--combat-sur-jeton` | #ffffff | #0b1722 | les initiales |
| `--combat-mort` | #6b717b | #7d838d | le rond d'un mort |
| `--combat-reussite` | #1e7a3c | #5cc38a | ✓, une cause d'avantage |
| `--combat-echec` | #b3261e | #e8776e | ✗, une cause de désavantage, la phrase de la mort |
| `--combat-alerte` | #8a5300 | #e6a85a | une armure entamée, « désavantage », la lettre au journal, le bandeau en cours, la limite |
| `--combat-portee` | #d9534f | #e8776e | les traits de la hachure (groupe 2) |
| `--combat-portee-bord` | #c8372d | #f19a92 | le bord des cases hachurées (groupe 2) |
| `--combat-cadre-jet` | #7d838d | #7d838d | le bord du cadre d'un jet (groupe 2) |
| `--combat-cadre-jet-fond` | #ffffff | #262a30 | le fond de ce cadre (groupe 2) |

- Deux valeurs de la maquette du lot changent, pour le contraste : en
  sombre, elle met les initiales en blanc et le rouge à #e0574d.
- **Les contrastes** (formule de WCAG, recalculés au groupe 2) : la
  hachure, 3,96, 3,60 et 3,34:1 en clair sur `--fond`, `--fond-2` et
  `--accent-doux`, 6,24, 5,55 et 4,77:1 en sombre ; son bord, 5,20, 4,72
  et 4,38:1, puis 8,36, 7,43 et 6,39:1 ; le bord du cadre, 3,82, 3,47 et
  3,82:1 en clair sur `--fond`, `--fond-2` et son fond, 4,71, 4,18 et
  3,78:1 en sombre ; dans le cadre, ✓ 5,38 et 6,61:1, ✗ 6,54 et 5,01:1,
  le texte 17,06 et 11,75:1. Le bord du cadre garde le même gris dans les
  deux thèmes : il tient 3:1 sur chaque fond, et le contrôle l'exempte par
  son nom d'une valeur sombre à lui.
- **Les longueurs du groupe 2**, au bloc clair, sans « combat » dans leur
  nom : `--largeur-bulle` (20rem), `--largeur-bulle-jet` (29,5rem),
  `--largeur-infobulle` (18rem), `--hauteur-bulle-max` (la hauteur de la
  fenêtre moins 32 px, en pixels, quelle que soit la taille du texte),
  `--hauteur-volet` (45 %, aussi la marge de défilement de la page tant
  que le volet est montré), `--ligne-souris` (36 px), `--fleche-bulle`
  (8 px, égale à la flèche du placement), `--taille-de-jet` (4rem),
  `--hachure-trait` (3 px), `--hachure-pas` (9 px), `--hachure-angle`
  (135°), `--rayon-cadre` (4 px), `--marge-cadre` (3 px),
  `--decalage-soulignement` (0,2em, l'écart entre le nom d'un passif et
  son trait pointillé, qui suit la taille du texte) et `--largeur-vignette`
  (180 px, pour le créateur), la dernière : quinze. Les trois propriétés de
  la place de la bulle ne sont pas déclarées : seule `echelle.js` les
  pose.
- Le fond des cases, des panneaux et des dés prend les jetons du site.
  « mort » est une couleur de rond, trop pâle pour un texte sur le second
  fond : le texte d'un mort est dans le second gris du site, barré.
- `css/combat.css` entre dans le contrôle « des jetons seulement », hors
  les largeurs des `@media`. Chaque règle part d'une classe « combat »,
  sauf une : la racine (`html:has(.combat-bulle:not([hidden]))`), qui
  seule porte la marge de défilement de la page, et seulement tant que le
  volet est montré (plus haut, « Le téléphone »). Toute classe propre à
  l'écran commence par
  `combat-` ; s'y ajoutent vingt-quatre classes d'état, sans préfixe
  (`joue`, `cible`, `mort`, `possible`, `reussi`…, et `portee` depuis le
  groupe 2), et deux classes du site (`bouton`, `champ`) : le contrôle
  tient la liste de chaque classe, celles du groupe 1 et la liste close
  du groupe 2, et refuse toute autre classe. Tout jeton commence par
  `--combat-`, et aucun nom ne contient « carte », mot réservé à la carte
  d'adversaire (§ 16.5). **Le code n'écrit aucun style** hors
  d'`echelle.js` (§ 10.1) : des classes et des jetons.

**Ce qui change par rapport à la maquette du lot.**

- Les couleurs sont celles du tableau. La cible porte un trait rouge
  discontinu, non l'anneau plein ; les boutons que la maquette dessine sous
  44 px grandissent.
- **Aux groupes 1 et 2**, il n'y a ni palette, ni « Intervenir… », ni menu
  du clic droit : à leur place, les réglages à la main (§ 17.4, § 17.5).
  Le groupe 3 dira leur place dans la bulle. La capacité d'attente
  n'apparaît pas.
- **Le journal** suit les gabarits du § 17.9, et sa hauteur est limitée.
  Une ligne s'écrit quand le geste est fini : la ligne « relance en
  cours… » de la maquette n'existe pas ; c'est le bandeau qui montre la
  ligne en cours.
- **Les fiches** des adversaires ont toutes leur table des zones ; la
  maquette en résume deux. Leurs types s'écrivent comme sur leur carte
  (« ×2 »).
- **Sur téléphone**, une case montre deux jetons au plus, puis « +k » ; la
  maquette en montre trois.
- **La préparation** prend la place de la zone sous la carte. Les ajouts
  se posent d'office : la phrase d'aide de la maquette change.
- **Les seuils** sont ceux de la mission, 56rem et 80rem ; la maquette
  n'en a qu'un, à 700 px.
- **Choisir qui joue.** La mission dit qu'un clic sur le nom d'une fiche
  choisit le protagoniste ; ici le nom déplie le volet, et c'est le
  bouton « Jouer » qui choisit, avec le jeton et les boutons « Qui
  joue ? » : jamais un bouton dans le titre d'un volet.
- **« Fiche complète »** est un bouton de 44 px, pour un adversaire comme
  pour un personnage ; la maquette en fait un lien.
- **De moindres écarts, gardés** : une étape faite porte une coche verte,
  sans le fond vert de la maquette ; dans une fiche, le dé et les nombres
  d'attaque et de défense ne sont pas en gras ; la légende de la carte dit
  « mort, barré » ; la phrase « Ensuite : la localisation… » de la
  maquette n'existe pas, les étapes le disent déjà ; dans une case
  pleine, un mort passe derrière « +k », quand la maquette le montre barré
  dans la case ; sur téléphone, l'état de l'enregistrement reste visible,
  sur sa ligne, quand la maquette le cache.
- **Ce qui restait après les corrections de la relecture de fin du
  groupe 1** (vu le 12/10/2026 dans Edge 155 et Firefox 143) : la
  première rangée de la préparation, que la maquette met sur une ligne et
  que l'écran laisse en trois rangées ; « Fin de tour » en trait
  discontinu pendant un geste, puisqu'il est alors inactif ; le nom court
  encore coupé à certaines largeurs (« Marmi… 2 » à 1 440 px). Les noms
  des protagonistes, sans gras dans le journal au groupe 1, y sont en gras
  depuis les segments du groupe 2.

**Ce qui change par rapport à la maquette d'ergonomie** (le complément
l'emporte, § 1 du complément) :

- le bandeau suit la règle plus haut, au téléphone aussi : ni « relance en
  cours… », ni la ligne réécrite de la vue 3a ;
- la phrase sous la carte est « Le jet se joue dans la bulle, à côté des
  jetons. » ;
- une ligne de déplacement porte « 1 case » ou « 2 cases » à la place des
  dégâts (vue 4), en vue 1 aussi ; la note de la vue 4 (« cliquer
  directement une case ») ne vaut pas ;
- chaque objet garde son groupe, comme au groupe 1 : pas d'intitulé commun
  à deux objets ; les intitulés de groupe restent ceux du groupe 1
  (« Couteau d'office (précise) ») ;
- les causes suivent les phrases plus haut, au doigt comme à la souris ;
- les couleurs du journal sont celles du § 17.9 : la zone et le bilan n'y
  sont pas colorés ;
- au créateur, le détail est la description du bloc telle quelle, sans
  l'en-tête « Archétype · ses capacités, puis deux choix » ; ni flèche
  vers la vignette, ni vignettes d'exemple (§ 15.3) ;
- la légende de la carte finit par « portée de la capacité survolée »,
  après « mort, barré », que la maquette n'a pas ;
- au téléphone, « cliquez » sous le dé à lancer et dans le bilan d'une
  relance, où la vue 3b dit « touchez » (à trancher par l'auteur, plus
  haut) ;
- les noms que la maquette invente pour remplir ses vignettes ne
  s'écrivent nulle part.

**Les phrases d'écran du groupe 2, à confirmer par l'auteur.** Ce sont
des phrases d'écran, non des règles du jeu ni des gabarits du journal :
rien n'en va au livret. Celles du complément (ses § 4.1 à § 4.6, § 4.10,
§ 5.1 à § 5.3), écrites plus haut et au § 17.3 ; puis celles qu'a dû
écrire le contrat d'écriture du groupe, réversibles :

1. « esprit de corps » prend la phrase d'« en meute », et « un allié »
   s'écrit même s'ils sont plusieurs ;
2. le compte « Avantages et désavantages s'annulent : il reste … »,
   seulement quand les deux sortes sont là ; une lecture plus claire
   serait « Avantages et désavantages : il reste 1 avantage. » (point du
   compte rendu) ;
3. « Arrivée : les cases à une distance de 1 à 1, hachurées sur la
   carte. » pour un déplacement d'une case ;
4. « … ; coût en lien non payé : un adversaire n'a pas de lien » dans le
   coût d'un adversaire, et « Coût : illisible » ;
5. le titre seul, sans origine, pour la capacité d'un adversaire que ne
   donne aucun objet ;
6. le libellé seul en en-tête d'un geste sans cible, d'un déplacement,
   d'un jet de caractéristique ;
7. « Jouer {libellé} » ; 8. « {libellé} : rouvrir » ;
9. « actions restantes : 1 sur 2 » sur la fiche ;
10. « Fermer » et « Réduire », les noms de ✕ et de « – » ;
11. « {nombre} : voir la cause », dont « avantages et désavantages
    s'annulent : voir la cause » ;
12. « Défense : » et « lourde », « agile », « précise » ;
13. la largeur de l'infobulle, 18rem ;
14. « Ouverture du combat… » pendant « Reprendre le combat le plus
    récent » ;
15. « Le personnage « {nom} » est sur cet appareil. » au combat, et « Le
    personnage n'a pas pu être gardé : {message} » ;
16. au créateur : « Choisissez une vignette : sa description et ses choix
    s'affichent dessous. » (et sa forme courte), « Capacités à venir. »,
    « niveau N · coût », la légende « Constellation tirée à la table »
    (§ 15.3) ;
17. Tab quitte la bulle après son dernier élément, ✕ ou « – », et non
    après sa dernière ligne : la lecture du contrat, gardée ; à trancher
    par l'auteur (plus haut, « Pour le clavier »).

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
  0,7 Mo). Avec 15 000 événements, le pire contenu qu'on tape au clavier
  (des réglages dont la raison fait 80 signes de 3 octets) fait 4,76 Mo de
  texte, 2,54 Mo chiffrés, et se garde (banc du groupe 2, § 17.11). Forgé de
  demi-codets isolés, que le JSON écrit en six signes chacun, il ferait
  8,19 Mo : c'est pourquoi une raison n'en porte plus (§ 17.4), ni un
  texte de photographie (§ 17.2). Un contenu ainsi forgé est refusé à la
  relecture, pour sa forme ; si un combat passait encore la borne, le
  gardien refuserait l'écriture, la barre dirait « Ce navigateur ne garde
  pas le combat », rien ne lèverait et rien ne se perdrait en mémoire.
- **L'enveloppe est une donnée venue d'ailleurs** : n'importe quel script
  du site a pu la poser dans la base, sans la clé. Chaque champ est donc
  borné avant d'être examiné. `enregistre_le` a la forme qu'écrit
  `toISOString` (l'année en quatre chiffres, ou signée en six, puis les
  millièmes et « Z », 27 signes au plus), jugée avant `Date.parse`, qui
  lirait une date de n'importe quelle longueur ; une autre forme dit
  l'enregistrement abîmé. `sel`, `iv` et `chiffre` sont en base64
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
- **L'état se recalcule en rejouant les événements**, par le chemin même
  du jeu, « annuler » compris : la pile d'annulation, qui ne se garde
  jamais, se refait ainsi (§ 17.3). Un rechargement reprend le geste où il
  en était, relance choisie comprise, **sans relancer un dé déjà lancé**.
  Ce qui n'est pas un événement ne se garde pas : hors d'un geste, l'écran
  revient à « Qui joue ? » ; d'où vient la cible choisie, une fiche
  ouverte, la liste d'une case s'oublient.
- **Le rejeu rend la main au navigateur** (groupe 2) : à l'ouverture de
  l'écran, et pour « Reprendre le combat le plus récent », la séance le
  mène par tranches de 1 000 événements, et attend la tâche suivante
  entre deux ; un combat de moins de 1 000 événements s'ouvre comme au
  groupe 1. Un rejeu dépassé par un « Nouveau combat » accepté, une autre
  ouverture ou une reprise n'installe rien, et l'écran l'ignore. Le
  contrôle et le banc rejouent d'une traite, par la même fonction.
- **Le rejeu est linéaire, annulations comprises** (complément, § 4.10 ;
  relecture de fin du groupe 2) : il applique chaque événement par le
  chemin même d'`appliquer`, sans geler la liste du journal entre deux
  événements. Elle n'est recopiée qu'à sa première écriture, chaque
  événement suivant la prolonge, et elle se gèle après le dernier. Aucun
  état intermédiaire n'en sort : le rejeu ne cède que `{ pas }`, un refus
  ne rend que l'erreur, et les instantanés de l'annulation n'ont pas de
  journal. L'état rendu est celui qu'`appliquer` aurait fait, pas à pas,
  gelé en profondeur, plages des maillons comprises (§ 11, § 17.11).
- **Rien de ce qui se relit n'est cru.** Avant tout rejeu, le contenu
  déchiffré se valide (`js/combat/forme.js`) : ses clés, elles seules ; les
  identifiants, leur compteur (99 999 au plus), les cases, les plafonds ;
  chaque photographie, par la fonction qui l'a jugée à l'ajout (§ 17.2) ;
  chaque événement, 15 000 au plus, et les valeurs d'un dé, cent au plus,
  comptées avant qu'une seule soit lue (§ 17.3). Au rejeu, le premier
  événement refusé arrête tout : la suite n'est jamais tronquée en
  silence. Un contenu refusé, ou un rejeu refusé, est
  une donnée abîmée.
- **La version des règles** est dans le contenu. Toute correction qui
  change un nombre, un mot du journal ou un moment la fait monter ; un
  combat d'une autre version ne se rejoue pas, et se dit. **Elle vaut 2
  depuis le groupe 2** (décision de l'auteur, 25/10/2026) : l'événement
  « annuler », la puissance au choix des adversaires et la défense à
  égalité changent le rejeu. Un combat gardé au groupe 1 se dit
  « commencé avec une autre version du simulateur » et ne se reprend pas :
  sur chaque appareil, et dans chaque mode, un combat commence par
  « Nouveau combat ». Le groupe 3 la passera à 3. Au groupe 1, elle valait
  1, et les corrections de sa relecture de fin de groupe ne l'avaient pas
  fait monter.

**Quand.** Après chaque événement, et après chaque changement de la
préparation, dans **une file à une seule place** : jamais deux écritures à
la fois. **L'écriture part un tour après la demande**, jamais dans le tour
du clic : la file est prise et « Enregistrement… » se dit dès la demande,
mais assembler le texte du combat, l'encoder et ouvrir la compression
attendent que l'écouteur du clic ait rendu la main (une microtâche n'y
aurait pas suffi). Les demandes venues d'ici là n'en font qu'une ; une
demande arrivée pendant une écriture attend qu'elle finisse, et la dernière
remplace celle qui attendait, puisque le contenu est cumulatif. Une
commande de deux à quatre événements (la case d'un déplacement, § 17.6)
s'applique tout ou rien, et ne s'écrit qu'une fois ; chacun de ses
événements entre au contenu et compte pour le plafond.
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
| un autre onglet a écrit : la révision gardée n'est pas celle qu'on attend | « Combat ouvert ailleurs », avec « Reprendre le combat le plus récent » | non, tant qu'on n'a pas repris ; la zone sous la carte le dit |
| à l'ouverture : un sel ou un nombre d'itérations qui ne sont pas ceux de la clé (le mot de passe de table a changé) ; ou une enveloppe malformée, un chiffré abîmé, un autre mode, un contenu qui ne se décompresse pas, ne se lit pas ou est refusé, une révision qui ne concorde pas, un rejeu refusé | « Le combat gardé ne se lit plus (mot de passe de table changé, ou donnée abîmée). », avec « Nouveau combat » | après « Nouveau combat », qui s'écrit toujours |
| à l'ouverture : une enveloppe d'un format plus récent | « Ce combat vient d'une version plus récente de l'Atelier : rechargez la page. » | non ; rien ne s'écrit par-dessus |
| à l'ouverture : un contenu d'une autre version des règles | « Ce combat a été commencé avec une autre version du simulateur : il ne se reprend pas. », avec « Nouveau combat » | après « Nouveau combat » |
| la banque est ouverte sans clé (le mot de passe a changé pendant la visite) | la phrase « ne se lit plus » s'il y a un combat gardé, sinon « Combat non gardé : le mot de passe de table a changé. » | oui, en mémoire ; rien ne se lit ni ne s'écrit |

Un format plus récent se reconnaît avant tout autre examen : le dire
« abîmé » offrirait « Nouveau combat », qui l'écraserait. De même une autre
version des règles, avant que la forme du contenu soit jugée : un contenu
d'une autre version peut porter une clé de plus ou de moins, ce n'est pas
une donnée abîmée.

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
- **Le groupe 2 ne change aucun gabarit**, sauf la ligne nouvelle
  « Annulé : … » (plus bas, « L'annulation ») : le combat de référence et
  le banc se retrouvent mot pour mot.

**Les segments et les phrases** (groupe 2 ; complément, § 4.8). Chaque
ligne garde son texte, inchangé, et la liste de ses **segments typés**, qui
naissent avec elle : leur concaténation redonne ce texte au signe près,
par construction, sur les trente-six lignes du combat de référence comme
sur des noms piégés (« → », « ✓ », « contre », « Annulé : », « […] »…).
Un segment porte son type (le nom de qui agit, en tête de ligne, la
capacité jouée, avec sa puissance, et le nom de la cible, chacun des deux
noms avec son camp ; ✓ et ✗ ; la lettre et sa valeur ; le nombre saisi
après « ajusté à » ; la phrase de la mort ; « Fin du tour… » ;
« — Tour… — » ; le reste en texte), le numéro de sa phrase, et, dans un
jet, son cadre et son dé. Une ligne connaît aussi le genre de chacune de
ses phrases (le lancement, le tour, l'ouverture, les sources, le jet, la
localisation, l'intervention, les dégâts, les blessures, la mort,
l'annulation…), que le bandeau lit pour se couper (§ 17.7). **L'écran ne
relit jamais le texte** pour y chercher un nom : un nom est une donnée
hostile. Les couleurs, les cadres, la coupe du bandeau et les lignes
barrées se lisent dans les segments et dans les plages des lignes
« Annulé ».

- **Ce qui se colore, et rien d'autre**, à l'écran seulement (la liste du
  journal et le bandeau) :

  | Segment | Couleur |
  |---|---|
  | le nom de qui agit, en tête de ligne | `--combat-pj-texte` ou `--combat-adv-texte`, gras |
  | la capacité jouée qui le suit | l'accent |
  | le nom de la cible, après « contre » ou « sur » | la couleur de son camp, gras |
  | ✓ | `--combat-reussite` |
  | ✗ | `--combat-echec` |
  | la lettre et sa valeur (« B = 8 »), et le nombre saisi après « ajusté à » | `--combat-alerte`, gras |
  | la phrase de la mort | `--combat-echec`, gras |
  | « Fin du tour… » | italique, couleur secondaire |
  | « — Tour… — » | l'accent, comme au groupe 1 |

  Un nom répété plus loin, les sources entre parenthèses, les raisons, la
  zone et le bilan gardent la couleur du texte. Un nom dont l'identifiant
  n'est pas dans le combat (un contenu forgé) s'écrit en texte.
- **Les cadres.** Les résultats des dés d'un même jet (la chaîne d'une
  attaque, d'une défense, d'un jet de caractéristique) sont entourés d'un
  cadre fin, dans la ligne : « d10+1 contre 5 → [5 ✓, 9 ✓, 4 ✗] :
  2 réussites », les crochets figurant ici le cadre, qui ne s'écrit nulle
  part. Un seul dé s'encadre seul : « d8−1 contre 5 → [4 ✗] ». Le cadre
  comprend les valeurs et leurs signes, les doubles du désavantage
  (« 7/10 → 7 ✓ »), les relances et l'explosion de ce même jet ; il suit
  la ligne quand elle passe à la ligne suivante. **Une coupure ne tombe
  jamais au milieu d'un dé** : chaque essai est d'un seul tenant, les
  séparateurs entre eux ; aucune espace insécable n'entre dans la page,
  pour qu'un copier à la main redonne le texte. Le dé de localisation
  n'est pas encadré : il a son étiquette (« Localisation d20 → 16 »). Un
  bord de 1 px, un fond à lui, un rayon de 4 px, 3 px de marge sur les
  côtés (§ 17.7, « Les couleurs »).
- **Les lignes d'un geste annulé** sont barrées, à l'écran : celles que la
  plage d'une ligne « Annulé » couvre, qu'elles soient déjà posées ou
  neuves. Aucune ligne n'est réécrite, et une ligne « Annulé » n'est
  jamais barrée.
- **Le texte copié ou téléchargé ne change pas** : ni couleur, ni cadre, ni
  crochet, ni barre ; il garde les lignes d'un geste annulé et la ligne
  « Annulé ». Les comparaisons mot pour mot du groupe 1 passent telles
  quelles. Le journal n'écrit aucun style : des classes, et des jetons.

**La ligne en cours** (groupe 2). Pendant un geste payé qui a un jet, c'est
le début exact de la ligne que ce geste écrira, suivi de « … », sans
espace avant ; rien sans geste, avant le paiement, ni pour un geste sans
jet. Elle n'écrit que ce qui ne peut plus changer, et ses segments sont
ceux de la ligne finale, le dernier pouvant n'en être qu'un début : pendant
la chaîne, l'ouverture, les sources, puis le jet jusqu'au dernier dé
lancé, sans le séparateur qui le suivra ; au bilan, le cadre entier, puis
les réussites seules (« 2 réussites »), les dégâts pouvant encore
changer ; à la localisation, le jet entier, puis le premier d20, brut ;
après l'esquive, la localisation entière, puis l'intervention. Un dé qui
attend d'exploser s'écrit sans signe ni somme (« 5 » ; « 6 explose,
+ 6 ») ; un dé qui attend une relance garde son « ✗ ». Le bandeau la
montre (§ 17.7) ; le journal n'écrit toujours sa ligne qu'à la fin du
geste.

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

*L'annulation* (groupe 2, le seul gabarit neuf ; § 17.3), une ligne
ajoutée à la fin du journal, en texte seul :

- une capacité ou un déplacement, par le nom court, la capacité et sa
  puissance : « Annulé : Aubépine — Taloche [1]. » ;
- une passe : « Annulé : Aubépine — passer son tour. » ;
- une fin de tour : « Annulé : la fin du tour des PJ. » (ou « des
  adversaires »).

Elle porte la plage des lignes que le geste a écrites, qui restent : la
sienne, puis, s'il y a lieu, « Fin du tour… », « — Tour … — », « Combat
terminé… ». La région d'annonce la dit.

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
les rôles qu'elle n'a pas (`bonus_precision`, `petit`, `esprit_de_corps`),
se contrôlent sur des banques fabriquées en mémoire et sur des
photographies écrites à la main (`tests/outils/photographies_essai.js`).
Depuis le groupe 2, sans que la banque change : le Chef de partie a deux
puissances de déplacement, Pas chassé [1], gratuit, et [2], pour
1 souffle ; Aubépine a deux types d'armure à égalité de dés, agile et
précise, et sa défense se choisit ; Frappe et Émincer, que lui donne son
couteau, portent la cause de leur désavantage (« Couteau d'office »,
précise). Les photographies d'essai suivent la démonstration, et le
contrôle les y compare.

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
  geste. Le même lecteur sert au banc. **Depuis le groupe 2**, une ligne
  d'adversaire sans « puissance » vaut son rang : elle ne choisit que
  parmi les façons de cette puissance, si bien que le combat de référence
  et celui de la mission ne changent pas ; celle d'un personnage garde la
  façon d'office du groupe 1, recopiée dans le lecteur comme convention de
  lecture (la plus haute puissance payable, sinon la plus basse) ; plus
  d'une façon possible arrête tout. Deux champs neufs : `annuler: true`,
  qui joue « Annuler le dernier geste », et `defense`, après la cible, le
  type de défense à égalité.
- **Il est retrouvé mot pour mot à chaque étage** : par le moteur, sur la
  banque de démonstration publiée, avec ses cases d'office et son état
  final ; par le journal seul, sur des gestes écrits à la main ; par la
  séance, puis par l'écran, du premier clic au dernier, sur des dés
  imposés, et, depuis le groupe 2, joué par la bulle.
- **Le groupe 2 ne le change pas**, et s'en sert : chacune de ses lignes
  égale ses segments ; à chaque événement, la ligne en cours débute la
  ligne qui suit (51 états en cours, chaque moment d'un geste sauf celui
  de plusieurs d20, qu'il n'a pas et que tient un contrôle écrit à la
  main) ; à la fin de chaque geste, « annuler » rend l'état d'avant, et le
  geste rejoué refait le même état et les mêmes lignes, puis tous les
  gestes se défont jusqu'au lancement ; à chaque état, l'offre allégée
  rend le verdict du groupe 1 (§ 17.1).

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
  compare ce qu'il attend et ce qu'il montre. **Depuis le groupe 2**, il
  compare en plus : chaque ligne du journal à ses segments, et, à chaque
  état en plein geste, la ligne en cours au début de la ligne du geste ;
  l'offre allégée à celle du groupe 1, à chaque état du combat de la
  mission (le jugement du groupe 1 y est recopié, un contrôle ne pouvant
  s'importer sans se lancer) ; la résolution à une puissance, au rang, à
  la résolution de chaque adversaire complet du classeur ; les façons de
  chacun contre les bornes de la photographie ; et il fabrique le pire
  contenu que le jeu accepte, aux plafonds, pour mesurer ce qu'il pèse,
  chiffré, et le temps de son rejeu (§ 17.8, § 17.11). Ses fonctions
  d'écart sont exportées : le contrôle du combat de référence les voit se
  taire sur la démonstration, puis dire l'écart qu'on leur forge.
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

Les mesures du groupe 2, du 25/10/2026, viennent d'abord ; celles du
groupe 1, du 12/10/2026, suivent, telles qu'elles ont été prises. Toutes
sont prises sur le poste de l'auteur. Chacune dit son outil, sa méthode et
sa réserve ; ce qui n'est pas mesuré est dit à la fin de chaque série.

**Le groupe 2, le 25/10/2026.**

**Les contrôles.** 1 526 au commit de départ (aucun échec, 234 secondes) ;
1 774 au commit `c98ac84`, celui de la vague 6 (deux processus,
165 secondes), aucun échec : 248 de plus. Les fichiers de contrôles des
lots, lancés à la fin de chaque vague : 154 contrôles à la vague 1, 409 à
la vague 2, 127 à la première part de la vague 3, 285 à sa reprise, avec la
part de la vague 5, 248 à la vague 4. Après les corrections de la
relecture de fin de groupe : 1 798 au commit `2e1d8b8`, puis **1 804 au
commit `b7df064`**, aucun échec : 278 de plus qu'au commit de départ.
Neuf fichiers de contrôles sont neufs (§ 11). Les commits des vagues sont
des états de passage : des contrôles d'autres modules y échouaient, comme
prévu, jusqu'à la vague qui les reprenait ; rien n'a été envoyé avant la
fin du groupe.

**Les mises à l'épreuve**, armé puis désarmé (§ 0), sur une copie du dépôt
hors de OneDrive, un seul processus de mutation à la fois. Chaque lot a
écrit les casses de ses contrôles, chaque fragment vérifié présent une
seule fois ; une casse fait échouer au moins un contrôle qu'elle nomme, et
le code rétabli le fait passer.

| Vague | Lots et casses | Vues |
|---|---|---|
| 1 | le socle du noyau 31, les noms 24, la rencontre gardée 68, l'échelle 67 | 190 sur 190 |
| 2 | les photographies 41, le journal en segments 48, les circonstances 17, l'écran Rencontre 33 | 139 sur 139 |
| 3, et part de 5 | le plateau, les fiches et la préparation 38, les feuilles 52, le moteur et l'offre 60, le contenu d'une action 60, la démonstration partagée 24, le créateur 57 | 291 sur 291 |
| 4 | les vues 60, la séance et le banc 23, la bulle 60, le journal à l'écran 60 | 203 sur 203 |
| 6 | l'écran assemblé et le contrôle du défilement 60 ; les neuf casses des feuilles qui visent `tests/site.test.js`, jouables seulement après l'assemblage, 9 | 58 sur 60, 2 en délai ; 9 sur 9 |
| **en tout, au commit `c98ac84`** | **892** | **890, 2 en délai** |
| les corrections de la relecture (commit `2e1d8b8`) | l'écran 39, les feuilles 26, le noyau et le bord 22, le rejeu 16, le bandeau 8, les demi-codets des photographies 12 | 121 sur 123 au passage suivant, 2 équivalentes |
| les défauts des captures finales (commit `b7df064`) | les feuilles 23, la place de la bulle 8 | 31 sur 31 |

- **Les deux casses en délai** (focaliser après une commande ; le focus
  au jeton à la fermeture) faisaient tourner les contrôles de l'écran
  sans fin, jusqu'à 4,7 Go de mémoire. Ce n'était pas une boucle du code :
  un `assert.equal` entre deux nœuds du document simulé, que Node 24
  déroule en entier avant de les comparer (15 à 25 s et 408 Ko de message
  pour un échec, 1 ms par une comparaison d'identité). Les contrôles de
  l'écran comparent désormais les nœuds par identité, leurs attentes
  bornées à 5 s, et le lanceur borne la mémoire de chaque processus de
  contrôles (1 536 Mo).
- **Le passage au commit `2e1d8b8`**, toutes les listes rejouées l'une
  après l'autre, chacune contre les contrôles qu'elle nomme : **968 casses
  jouées, 957 vues**. Huit visaient du code que les corrections ont
  réécrit, introuvables : elles sont repointées, ou remplacées par les
  casses des corrections. Deux sont équivalentes : l'élagage des
  demi-codets de la raison proposée, inatteignable depuis que la
  photographie les refuse, gardé en défense. Une, ambiguë, est repointée.
  Trois casses des feuilles, qui visaient la règle ôtée au commit
  `b7df064`, sont retirées. Une liste (les photographies, 41) n'a pu se
  jouer, un contrôle du lot 3 chronométré échouant déjà sur la copie
  intacte, sous la charge : rejouée au calme au commit `b7df064`, 41 sur
  41.
- **Le dernier passage, au commit `b7df064`** (les casses des défauts des
  captures finales, et celles qui ont été repointées) : **256 casses, 256
  vues** : les photographies 41, les feuilles des captures 23, la place de
  la bulle 8, les cinq repointées, les feuilles du groupe 51 et 9, les
  feuilles des corrections 23, l'écran des corrections 39, l'écran
  assemblé 57. **En tout, 1 033 casses dans les listes finales, chacune à
  son dernier passage : 1 031 vues, 2 équivalentes.**

**Le combat de référence fictif** sort du moteur mot pour mot, tel qu'au
groupe 1 : ses trente-six lignes, son état final, ses cases d'office ; la
ligne en cours débute la ligne qui suit à chacun de ses 51 états en plein
geste ; l'offre allégée rend, à chacun de ses états, le verdict du
groupe 1, objet pour objet (§ 17.10).

**Le banc sur le classeur réel**, hors dépôt, sur le classeur de l'auteur
du 25/10/2026 et le scénario de la mission : **sans écart**, en
10 secondes. Quatorze rôles câblés reconnus par leur empreinte, aucun
absent ; trois adversaires complets, aucun incomplet ; neuf capacités
comparées entre la résolution à une puissance, au rang, et la résolution,
sans écart. Les façons : 2 au plus par capacité (borne 20), 5 en tout pour
un adversaire (borne 600), 2 de déplacement (borne 20), aucun refus dû aux
bornes. Le journal : 19 lignes, mot pour mot, chacune égale à ses
segments ; 30 états en plein geste, dont la ligne en cours débute chaque
fois la ligne de son geste. L'état final et le moment de la maquette :
sans écart. Le combat gardé : 63 événements, 58 Ko, rejoué à l'identique.
L'offre allégée : 11 776 verdicts sur 64 états, les mêmes qu'au groupe 1.
**Le pire contenu** : 12 personnages et 36 adversaires (12 de chacun des
trois adversaires complets du classeur), 0,38 Mo de mise en place ; puis
15 000 événements de réglage, dont la raison fait 80 signes de 3 octets :
4,76 Mo de texte, 2,54 Mo chiffrés, qui se gardent ; rejoué en 2 573 ms
sous Node à la vague 4, en 524 ms au banc du commit `c98ac84`, refait
sans écart. Forgé de demi-codets isolés, le même contenu ferait 8,19 Mo,
au-delà des 8 Mo du clair : depuis la relecture de fin de groupe, le
moteur refuse une telle raison, et la relecture un tel contenu (§ 17.4,
§ 17.8). La sortie du banc porte des noms du classeur : elle reste hors
dépôt.

**Sous Node** (24.21), hors navigateur, sur un poste que d'autres agents
chargeaient plus ou moins : des nombres à titre indicatif, en
fourchettes, chacun avec son relevé et la charge du moment.

- **Le rejeu de 15 000 passes** (deux protagonistes qui passent, trois
  lignes chaque fois, 44 999 lignes de journal) : 13,4 s avant la recopie
  unique du journal, mesurées par la conception ; après elle, de 4,5 à
  5,8 s, puis 3,3 s, au fil des lots. **Au commit `c98ac84`**, avant la
  correction du rejeu : 6,9 s au relevé de 16 h 22
  (`plans/mesures_g2_node.json`, poste chargé) et 8,6 s au témoin de la
  mesure d'Edge (17 h 14, poste calme), le plus long pas entre deux fois
  où le rejeu rend la main de 1,4 à 1,9 s (un premier relevé, non gardé,
  disait 8,1 et 0,98 s). Le rejeu y était quadratique : la recopie de la
  liste du journal, une par événement rejoué, et le ramasse-miettes
  qu'elle provoque en faisaient environ 84 % (2 500 passes : 79 ms).
- **Au même commit** : 61 protagonistes qui passent, 15 000 événements, de
  3,3 à 6,2 s ; un combat tiré au sort de 15 000 événements, quinze
  protagonistes et quelque 390 annulations, de 1,2 à 1,3 s ; 7 499 paires
  « passe, annuler », de 4,8 à 6,6 s (6,4 s pour 7 500 paires, mesurées
  par le lot du moteur), dans les mêmes relevés.
- **Après la correction du rejeu** (§ 17.8), dos à dos, le moteur d'avant
  copié seul hors du dépôt, sur un poste que les autres lots de correction
  chargeaient (d'où des temps d'avant trois fois plus longs que les
  relevés au calme) : 15 000 passes, 21,1 et 22,3 s avant, de 1,4 à 2,9 s
  après, en trois passes ; leur tranche de 1 000 la plus longue, 3,2 et
  3,3 s avant, de 0,16 à 0,30 s après ; la dernière, de 2,3 à 3,3 s avant,
  de 0,06 à 0,15 s après. 7 499 paires « passe, annuler » : 11,9 et
  15,2 s avant, de 0,96 à 1,16 s après ; leur tranche la plus longue, de
  1,9 à 2,7 s avant, de 0,13 à 0,16 s après. Sur ces deux contenus, l'état
  d'après égale celui d'avant, hors l'annulation, avec les mêmes plages
  pour leurs 14 999 maillons. Ce qui reste, de 60 à 150 µs par passe,
  n'est pas profilé plus loin.
- **La mémoire de la pile d'annulation**, à 15 000 événements : 5,9 Mo pour
  le combat tiré au sort (5 649 maillons), 9,0 Mo pour les passes
  (14 999 maillons) ; les instantanés partagent les objets gelés de leur
  état. Les relectures ont trouvé plus haut : 16,87 Mo pour
  61 protagonistes qui passent (14 999 maillons, 1 125 octets chacun), et
  14,8 Mo pour 15 000 « Fin de tour » sur le plus que la préparation
  permet (12 personnages, 60 adversaires).
- **Le contrôle des 5 000 événements au hasard** du rejeu passe de 76 s à
  10 s : les comparaisons d'états et le JSON ne descendent plus dans la
  pile.

**Les noms du vrai classeur** ont été cherchés, par un script hors dépôt
qui n'en garde aucun, dans ce qu'ajoutait chaque vague, puis chaque
commit de corrections, avant son commit : aucun. Les exemples de ce
paragraphe, des contrôles et des commits
viennent de la démonstration ; les rôles s'y nomment par leur code.

**La mémoire du poste**, veillée toutes les 15 secondes : 19,8 Go validés
au repos, avant les agents ; une pointe à 20,09 Go pendant la suite de
départ, à 19,94 Go pendant la conception, à 21,09 Go à 12 h 48 pendant la
vague 2 (149 relevés sur 733 au-dessus de 20 Go depuis 9 h 38) ; une
pause, et le seuil relevé à 21 Go par l'auteur à 13 h 11 ; à 13 h 43, le
poste à 21,38 Go sur 22,8 : deux lots de la vague 3 interrompus, puis
relancés (§ 13). Une première séance des navigateurs, arrêtée : le poste
à 23,1 Go, par les deux casses en délai de l'écran (plus haut), et Edge 156
sorti sans ouvrir son port. Pendant les navigateurs de la relecture,
19,13 Go au plus (la veille, de 17 h 19 à 18 h 30 : 18,95 Go) ; pendant
les captures finales, 18,44 Go au plus (409 relevés, de 20 h 26 à
21 h 50) : jamais au seuil d'attente (20 Go).

**Dans Edge et Firefox, au commit `c98ac84`**, avant les corrections de
la relecture de fin de groupe : ce sont les mesures de la relecture, que
les corrections n'ont pas encore remplacées (plus bas). Edge
156.0.4314.42, piloté par le protocole DevTools, et Firefox 143.0.4, par
WebDriver BiDi, ceux de « Program Files », sans fenêtre, un navigateur à
la fois, sur des profils jetables ; le serveur local du dépôt, la
démonstration ouverte par son mot de passe public. Les combats, fabriqués
par le moteur dans la démonstration : 300 événements et 15 protagonistes ;
« long », 14 940 à 15 000 événements tirés au sort, 15 protagonistes,
quelque 390 annulations, 8 129 lignes ; « passes », deux protagonistes
qui passent, 44 939 à 44 999 lignes ; « passes61 », 61 protagonistes ;
« paires », 7 499 paires « passe, annuler ». **Edge, le poste au calme**
(le témoin sous Node rejoue 15 000 passes en 8,7 s), à 17 h 14.
**Firefox, sur un poste lent** : sa première séance (d'autres scripts
Node, OneDrive, le processeur à 35-53 % de sa fréquence ; le témoin ×4 à
×4,9) ne vaut que pour le débordement ; sa reprise, à 18 h 21, sur un
poste encore lent (témoin ×2,3), est celle du tableau.

| Mesure (cible du complément, § 9) | Edge 156 | Firefox 143, reprise |
|---|---|---|
| le clic, bulle ouverte, 300 événements, 1 440 px, écran à jour, 66 clics (moins de 100 ms) | médiane 21,6 ms, 95e centile 38,6, le pire 83,3 : **tenu** ; l'image suivante, le pire 102,3 ms (1 clic sur 66) | médiane 67,3 ms, 95e centile 131,3, le pire 210,5 : non tenu ; rapportés au témoin, environ 29, 57 et 91 ms |
| le même clic à 390 px, 30 clics (moins de 100 ms) | médiane 14,8 ms, le pire 17,1 : tenu | médiane 78,2 ms, le pire 204,3 (environ 34 et 89 rapportés) : non tenu |
| l'ouverture de la bulle par le jeton, placée et peinte (pas de cible) | 1 440 px : médiane 22,9 ms, le pire 56,9 ; 900 px : 20,2 et 23,4 ; 390 px, le volet : 20,9 et 31,5 ; entière dans la fenêtre 10 fois sur 10 | 1 440 px : 95,1 et 296,5 ms ; 900 px : 54,0 et 104,3 ; 390 px : 59,3 et 118,4 ; entière 10 fois sur 10 |
| « Annuler le dernier geste », « long », tout compris (moins de 100 ms) | médiane 131,8 ms, le pire 179,8 (les écouteurs 35,6 et 47,7, le gardien 102,4 et 132,7) : **non tenu**, 14 fois sur 15 | médiane 249,3 ms, le pire 333,1 : non tenu |
| le même, « passes » (moins de 100 ms) | médiane 366 ms, le pire 475 (les écouteurs 137,9 et 191,1) : **non tenu**, 15 fois sur 15 ; la question elle-même, 1,6 ms de script, attend 163 à 239 ms son image | médiane 505,3 ms, le pire 1 016 : non tenu |
| le rejeu à 15 000 événements, sous « Ouverture du combat… » (pas de cible) | passes 6,57 s ; passes61 4,73 s ; long 3,03 s ; paires 4,64 s ; l'écart le plus long entre deux images, 469, 253, 230 et 383 ms | long 15,6 s, l'écart le plus long 1 647 ms |
| la mémoire de la pile, tas JavaScript (pas de cible) | long 2,79 Mo (5 649 maillons) ; passes 4,02 Mo (14 999 maillons) | non lisible par WebDriver BiDi |
| aucun débordement, de 320 à 414 px, puis à 768, 1 024 et 1 440 px, bulle comprise | 0 défaut : sur 98 largeurs pour la liste et pour le jet, sur 8 pour un adversaire et pour 300 événements : tenu | les mêmes zéros, à la première séance : tenu |

- **Le clic** : tenu dans Edge ; dans Firefox, à refaire au calme.
- **« Annuler » sur 15 000 événements : non tenu, tout compris**, dans
  les deux navigateurs. Chaque changement de l'écran paie la mise en page
  du journal (8 129 à 44 939 lignes). La règle de feuille qui sautait la
  mise en page des lignes hors de la vue, posée par les corrections,
  cachait la dernière ligne du journal (plus bas) : elle est ôtée
  (§ 17.7). Montrer la liste du journal par pages (les 500 dernières
  lignes, puis « Lignes précédentes »), ou accepter la mesure : à trancher
  par l'auteur.
- **Le rejeu** rend la main (15 à 16 écarts de plus de 50 ms dans Edge),
  mais une tranche peut figer la page : jusqu'à 469 ms dans Edge,
  1,6 s dans Firefox, avant la correction du rejeu.

**Les captures**, au commit `c98ac84` : 160 images, 74 captures par
navigateur (le combat à 1 440, 1 100, 900, 390 et 320 px, en clair et en
sombre, et les étapes 3 à 6 du créateur à 1 440 et 390 px) et 12 du
diagnostic (le clavier, la flèche, le défilement de la page sous des clics
bruts, le volet), regardées contre la maquette d'ergonomie : aucune page
qui déborde en largeur, la bulle et l'infobulle entières dans la fenêtre
à chaque vue, `pointer: coarse` au téléphone, aucun U+00A0, aucun message
à la console ni aucune requête hors du site ; les sondes d'Edge et de
Firefox identiques, vue par vue, sauf au volet et après la question, à
320 px. Elles ont donné à la relecture ses constats des navigateurs
(§ 14).

**Les captures finales**, au commit `2e1d8b8`, après les corrections :
178 images (148 captures et 30 du diagnostic), dans Edge et Firefox,
regardées et comparées, pixel à pixel, à celles d'avant. **Douze
corrections sur treize tiennent** : la flèche, du côté du jeton ; la
plaque sous les jetons d'une case hachurée ; les rangées plates (à 900 px
de haut, la bulle ne défile plus, 782 px vus pour 782) ; les passifs et
ce qui n'est pas une ligne à 44 px, les lignes à 36 ; le dé relancé barré
dans Firefox ; Échap ; « Annuler » inactif ; le volet sans infobulle au
doigt ; le focus et l'aperçu dans la partie vue ; la marge de défilement
du volet (dans Firefox, à 15 px près) ; le bandeau à 320 px, qui garde
« Aubépine… », sa troisième ligne rognée par la feuille ; « Taloche ·
Gestes de cuisine ». **La treizième ne tient pas** : la règle de feuille
qui sautait la mise en page des lignes du journal hors de la vue cachait
sa dernière ligne dès qu'il entrait dans la fenêtre (de 63 à 2 667 px
sous la partie vue, selon le cas et le navigateur). Avec deux autres
défauts neufs, la flèche du jet rouvert au rechargement, 61 px trop
haut, la hauteur du bandeau, et le pointillé des passifs, une douzaine de
pixels sous leur nom, elle est corrigée au commit `b7df064` (§ 14).
**Des remarques** : « Passer son tour » encadré entre des rangées plates
(corrigé au même commit) ; « Copier » 7 px sous le volet, et dans Firefox
une fiche haute 15 px dessous (§ 17.7, « Le téléphone ») ; dans Firefox à
320 px, la page à 18 px après la question, intermittent, non établi comme
un défilement du site ; « Se déplace de 1 cases. » et « Fait bouillir
1 marmites. » dans les textes de la démonstration, d'avant le groupe 2
(une description évaluée à la puissance, § 15.2). Les images de page
entière ne servent plus à relire le journal : elles ne peignent pas les
lignes hors de la fenêtre.

**Les mesures finales, au calme, au commit `b7df064`** (Edge 156 en trois
séances, dont une sur batterie, et Firefox 143 ; le poste sans autre
travail, vérifié par un témoin sous Node avant et après chaque
navigateur, à 6 % près) :

- **le clic, bulle ouverte, sur un combat de 300 événements** (cible :
  moins de 100 ms), à 1 440 px, l'écran à jour, médiane, p95 et pire :
  Edge de 12,3 à 17,8, de 30,8 à 46,0 et de 65 à 155 ms ; Firefox 22,9,
  33,3 et 62,4 ms ; à 390 px, moins de 30 ms au pire dans les deux.
  **Tenue en médiane et au p95 ; le pire d'Edge passe 100 ms dans une
  séance sur trois**, toujours au choix d'une cible, à profiler ;
- **l'ouverture de la bulle**, placée et peinte : de 13 à 24 ms en
  médiane, 43 ms au pire ; entière dans la fenêtre dix fois sur dix ;
- **« annuler » sur 15 000 événements** (cible : moins de 100 ms), tout
  compris (écouteurs, image suivante, écriture du gardien) : sur un combat
  ordinaire (14 940 événements, 8 129 lignes), médiane de 55 à 76 ms dans
  Edge, 76 ms dans Firefox, pire de 89 à 168 ms ; sur 45 000 lignes de
  journal, médiane de 136 à 169 ms dans Edge, 93 ms dans Firefox. **Non
  tenue au pire, ni sur le journal le plus long dans Edge** : point à
  trancher (compte rendu du groupe 2) ;
- **le rejeu à l'ouverture**, devenu linéaire : de 1,4 à 4,0 s dans Edge,
  de 2,8 à 3,4 s dans Firefox (avant la correction : jusqu'à 6,6 et
  15,6 s) ; le rendu de l'écran qui suit se fait d'une seule tâche, de
  0,5 à 2,5 s sur 45 000 lignes ;
- **la pile d'annulation**, au tas, dans Edge : 2,78 Mo (combat
  ordinaire), 4,02 Mo (45 000 lignes), 8,37 Mo (61 protagonistes) ;
- **aucun débordement**, de 320 à 414 px à chaque pixel, puis à 768,
  1 024 et 1 440 px, bulle comprise ; la bulle, le volet et l'infobulle
  entiers dans la fenêtre à l'ouverture ;
- à l'image, dans les deux navigateurs : la dernière ligne du journal
  reste vue, après un geste comme après un rechargement ; la flèche du
  jet rouvert vise sa case au pixel près ; le pointillé des passifs est
  sous leur nom ; « Passer son tour » est plat.

**Ce qui n'est pas fait au groupe 2.**

- **Un combat joué sur le site en ligne** par un agent (§ 13).
- **La composition de la rencontre gardée dans une vraie IndexedDB** :
  tenue par les contrôles sur l'IndexedDB simulée seulement.
- **À l'auteur, à l'arrêt d'essais** (§ 13), ce que ni un document simulé
  ni un navigateur sans fenêtre ne montrent : un vrai téléphone et le
  toucher (le volet, l'aperçu, l'appui qui joue) ; les lecteurs d'écran,
  la bulle et ses infobulles n'ayant été que lues dans le document ; le
  temps de peinture ; Firefox 157.

**Le groupe 1, le 12/10/2026.**

**Les contrôles.** 1 392 contrôles au commit `fda3a2a` (deux processus,
168 secondes), aucun échec, dont 934 neufs depuis les étapes 1 et 2 (458
au commit `40db3a0`) ; 1 476 au commit `c4cff7d` (deux processus, 190
secondes), aucun échec ; 1 517 au commit `8032ce2` (deux processus),
aucun échec. Le nombre du commit de fin du groupe 1 est dit à la fin de
cette série. Chaque règle y est vue dans les deux sens, dans
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
`fda3a2a`**. L'en retirer demanderait de réécrire cet historique ;
l'auteur l'y laisse (décision du 25/10/2026). Une arme fabriquée pour un contrôle
des adversaires portait deux mots du classeur : elle a été renommée avant
d'être commitée. Le reste de ce que le script relève est sans objet : des
mots courants du français, des noms d'éléments, permis en clair (§ 17),
et **huit des quatorze libellés de rôle** du tableau du § 17.6, qui ont
par nature la clé du nom qu'ils désignent, et que la mission ordonne :
ce constat rejoint celui des empreintes, à trancher par l'auteur
(§ 17.6). Les messages des deux commits que le lot comptait alors, relus
de même, ne portent que des mots courants.

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
lanceur : 184 casses, 184 vues, aucune en délai.

- **Quarante pour le moteur** (commit `c4cff7d`) : le signe moins d'un
  dé, les annonces, les passifs d'un adversaire, le tableau des rôles,
  les maîtrises, les noms, le niveau 0, le déplacement sans case, les
  plafonds, la double relance, le départ du banc.
- **Trente-deux pour l'enregistrement et les bornes** (commit
  `8032ce2`) : l'enveloppe longue, le rejeu, les tirages et les façons,
  la révision, le compteur, la source d'un adversaire, le départ de
  l'écriture.
- **Cent douze pour l'écran** (commit `8032ce2`), sur ses trente points
  corrigés (§ 14) : `css/combat.css`, `js/combat/lecture.js` et les cinq
  modules de `js/ecrans/`, contre les sept fichiers de contrôles de
  l'écran. Un premier passage avait laissé deux casses non vues, sur
  « Case » et « Retirer » hors du volet, et sur la carte d'un combat
  arrêté : deux contrôles creux, complétés, puis la liste entière
  rejouée, 112 vues sur 112. Désarmé : les sept fichiers passent sur la
  copie intacte. Les contrôles de l'écran, lancés avec ceux du site, de
  la carte, des routes et des écrans, un processus à la fois, étaient
  270 avant ces corrections, 282 après : douze neufs, les autres
  complétés. Ceux du combat de référence et du rejeu, 42, passent sans
  retouche : le journal attendu ne change pas.

**Les contrôles de l'écran écrits avant la relecture** : les cinq modules
de `js/ecrans/`, `css/combat.css`, le câblage d'`application.js`. En est
établi ceci. Les contrôles ajoutés ou retouchés par le regard sur la
maquette, lancés sur une copie du code d'avant, échouent à 16 sur 148,
et passent tous sur le code corrigé. Les trois corrections faites pendant
les mesures ont chacune leur contrôle, vu échouer sur l'ancien code. Un
relecteur a joué un échantillon de 81 casses sur les modules de l'écran
et la feuille : 70 vues, 11 non vues ; les règles que rien ne tenait
sont entrées à la liste des corrections de l'écran, dont quatre points
sont faits de contrôles seuls (§ 14). Leur mise à l'épreuve d'ensemble,
par le lanceur : à la fin de ce paragraphe.

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
événements et 4 protagonistes (graine 1). **Deux séries** : celle du
matin du 12/10/2026, les quatre mesures de la mission ; puis, après les
corrections de la relecture de fin de groupe, deux mesures reprises, le
temps d'un clic (vers 13 h 10) et « aucune case ne déborde ». **Trois
réserves :**

- **le matin, le poste était chargé** par d'autres agents, dont les
  contrôles tournaient : le rejeu sous Node, témoin de la charge, a varié
  de 63 à 251 ms d'une passe à l'autre. La série de 13 h 10 est prise
  poste plus calme, non au repos : 13,6 Go de mémoire validée, deux
  agents de mise à l'épreuve tournant à côté, un processus de contrôles
  à la fois ;
- **un navigateur sans fenêtre n'a pas d'écran** : le temps de peinture
  n'est pas mesuré. De l'événement à l'image suivante, les nombres relevés
  (le matin, médiane 67 ms dans Edge, 82 à 130 ms dans Firefox ; à
  13 h 10, 17,2 ms dans Edge et 5,97 ms dans Firefox, à 1 440 px) ne
  sont pas à retenir, non plus que ceux de l'API Event Timing (le matin,
  104 ms de médiane pour 30 ms de traitement ; à 13 h 10, dans Edge,
  32 ms pour 3,5 ms) ;
- **la série du matin précède les corrections de la relecture de fin de
  groupe** (le journal du rejeu, l'écriture sortie du clic, l'écran).
  Rejouer 1 000 événements et enregistrer un combat de 300 n'ont pas été
  remesurés dans un navigateur depuis ; le rejeu l'a été sous Node (plus
  bas).

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
554 ms et 1 855 ms. Ce temps court après le clic, sans le retenir. À
13 h 10, après les corrections et poste plus calme, sur 86 écritures
dans chaque navigateur : dans Edge, médiane 17,6 ms, 95e centile 20,4 ms,
le pire 22,4 ms ; dans Firefox, médiane 4,99 ms, 95e centile 8,4 ms, le
pire 9,42 ms. C'est le même relevé, entre les deux textes de la barre ;
dans Firefox, il est plus court que l'écriture entière mesurée le matin
(22,7 ms), et la mesure ne dit pas pourquoi : il n'est pas à lire comme
le temps d'une écriture.

**Le temps d'un clic, jusqu'à l'écran à jour** (cible de la mission :
moins de 100 ms), sur un combat de 300 événements. Des clics de souris
envoyés par le protocole, joués par un joueur automatique (qui joue, une
capacité, une cible, chaque dé, des dégâts fixés, « Appliquer », « Passer
son tour ») ; dans la page, de l'entrée d'un écouteur de capture posé sur
le document à la sortie d'un écouteur de bulle, puis le style et la mise
en page forcés : le rendu de l'écran est synchrone. Pour que le combat
dure cent clics, le joueur fixe à 0 les dégâts portés au personnage.
**La cible est tenue dans les deux navigateurs**, à la seconde série ;
les deux séries restent écrites, datées.

**Première série, le matin du 12/10/2026**, poste chargé, avant les
corrections de la relecture de fin de groupe :

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

- **Dans Edge, le matin, la cible est tenue**, et le nombre de
  protagonistes ne pèse plus sur le clic. La mesure y avait d'abord
  trouvé un défaut : à l'ouverture et à la fin de chaque geste, 12 à 14
  fiches sur 15 étaient refaites en entier, environ 1 400 nœuds, pour le
  seul bouton « Jouer » qui y paraît ou disparaît ; le clic allait alors
  à 84,6 ms au 95e centile et 108,2 ms au pire, 3 clics sur 70 à 100 ms
  ou plus. Corrigé avant les nombres du tableau : une fiche ne refait
  plus que ce qui a changé.
- **Dans Firefox, le matin, la cible n'est pas tenue de façon sûre** :
  selon la passe et la largeur, de 0 à 19 clics y sont à 100 ms ou plus,
  sur 25 à 70. Diagnostic pris dans la page : refaire le corps du panneau
  d'action (123 nœuds) puis mettre en page coûte de 17 à 42 ms dans
  Firefox, contre 6 à 9 ms dans Edge ; refaire une fiche (118 nœuds),
  22 ms contre 4,6 ms. Le script du moteur pèse peu (les vues 2,5 ms, un
  événement 0,7 ms) ; ni les règles `:has()` ni les cent cases en
  conteneur ne sont en cause (de 1,7 à 2,5 ms). Le remède envisagé
  alors, ne plus refaire le panneau en entier à chaque clic, n'est pas
  fait : le corps du panneau est toujours refait en entier quand sa vue
  change (§ 17.7).
- **D'où vient le temps d'un clic, dans Edge, le matin** : les compteurs
  du moteur de rendu, lus avant et après chacun de 78 clics, donnent
  18,4 ms de script, 4 ms de styles et 6,6 ms de mise en page (médianes),
  6 calculs de style et 2 mises en page par clic. Un profil du
  processeur, sur 70 clics : remplacer le contenu du panneau d'action,
  10,5 ms par clic ; poser le focus, 7,4 ms ; ouvrir la compression,
  4 ms ; encoder le texte, 1,5 ms. Ces deux dernières parts étaient
  celles de l'enregistrement, parti dans l'écouteur du clic : il part
  depuis un tour plus tard (§ 17.8). Une série profilée est plus lente
  (médiane de 36 à 41 ms) : ses temps ne sont pas ceux à retenir.

**Seconde série, le 12/10/2026 vers 13 h 10**, après les corrections de
la relecture de fin de groupe, poste plus calme (plus haut). Même
script, même méthode, même combat de 300 événements et 15 protagonistes
(graine 7) : au départ, « Tour 10 · camp des PJ », 14 fiches ouvertes,
2 135 nœuds. Cent clics joués dans chaque navigateur, sans erreur de
console ni requête hors du serveur local ; le combat ordinaire de 4
protagonistes n'a pas été repris.

| Navigateur, largeur | Clics | Médiane | 95e centile | Le pire | À 50 ms ou plus | À 100 ms ou plus |
|---|---|---|---|---|---|---|
| Edge 155.0.4283.45, 1 440 px | 70 | 3,65 ms | 6,8 ms | 8,7 ms | 0 | 0 |
| Edge 155.0.4283.45, 390 px | 30 | 2,8 ms | 5,2 ms | 5,3 ms | 0 | 0 |
| Firefox 143.0.4, 1 440 px | 70 | 3,62 ms | 7,76 ms | 8,3 ms | 0 | 0 |
| Firefox 143.0.4, 390 px | 30 | 4,62 ms | 9,06 ms | 11,72 ms | 0 | 0 |

- **La cible de 100 ms est tenue dans les deux navigateurs** : aucun
  clic n'atteint 50 ms. La réserve du matin sur Firefox est levée, et le
  point n'est plus à trancher.
- **Dans Edge**, les compteurs du moteur de rendu, sur 76 clics à
  1 440 px : 1,8 ms de script (18,4 ms le matin), 0,76 ms de styles et
  1,2 ms de mise en page (médianes), 6 calculs de style et 3 mises en
  page par clic.
- **Ce qui a changé entre les deux séries.** Le code : une ligne du
  journal n'est plus regelée à chaque événement (§ 17.1) ; l'écriture
  part hors de l'écouteur du clic (§ 17.8) ; les trente points de
  l'écran (§ 14). La fiche qui ne refait que ce qui change était déjà
  dans les nombres d'Edge du matin. Le poste : plus calme. **La mesure ne
  dit pas ce qui revient à chacun.**
- **Ce que cette série ne dit pas** : le temps de peinture, qu'un
  navigateur sans fenêtre ne donne pas ; le Firefox 157 de l'auteur, qui
  n'a pas été mesuré.

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
- **Remesuré après les corrections de l'écran**, le 12/10/2026, dans
  Edge 155.0.4283.45 puis dans Firefox 143.0.4, un seul navigateur à la
  fois, par le même script, sur les mêmes cinq plateaux : aucun défaut
  sur 98 largeurs, 17 938 boîtes dans chacun, console vide. Le côté d'une
  case est le même aux largeurs relevées. Les noms courts raccourcis à
  1 440 px : 26 sur 46 sur le plateau chargé (44 avant la correction de
  leur taille), 1 sur 3 au moment de la maquette (3 avant), 1 sur 5 sur
  le combat de 300 événements, 2 sur 4 pendant le choix d'une arrivée.
- **Une mesure de plus, dans Edge seul**, sur 32 largeurs de 896 à
  1 440 px et trois de ces plateaux : aucun défaut, 8 768 boîtes ; le
  texte des jetons y va de 9,8 à 10,7 px, et presque tous les noms
  restent coupés là où la case fait moins de 65 px (§ 17.7).

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
- **Mesuré sur les vues finales de ce regard**, avant la relecture de fin
  de groupe, dans les deux navigateurs : aucun
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
- Le § 17.7 porte ce que ce regard a changé à l'écran, avec les
  corrections de la relecture de fin de groupe.

**Les corrections de l'écran, vues dans un navigateur** (12/10/2026,
après la relecture de fin de groupe ; Edge 155.0.4283.45 et Firefox
143.0.4, sur le serveur local, profils jetables). Les trente points de
la liste (§ 14) ont été retrouvés dans le code ou dans un navigateur
avant d'être corrigés ; aucun n'a été jugé non fondé.

- **Des images** : dans les deux navigateurs, à 1 440 et 390 px, au
  moment de la maquette, à la préparation, au septième geste avant son
  premier dé et au combat terminé, en thème sombre ; dans Edge, en thème
  clair, à 900, 1 000, 1 100, 1 440, 390 et 320 px. Partout : aucun
  défilement horizontal, aucun nœud hors de la fenêtre, console vide,
  aucune requête hors du serveur local.
- **Des gestes joués par un script**, dans les deux navigateurs, mêmes
  résultats. Un bouton du site inactif : trait discontinu, fond
  transparent, opacité 1, en sombre et en clair. Le focus sur le jeton
  de celui qui joue : un anneau intérieur de 2 px, vu sur les images
  agrandies. Une saisie refusée (« 99 » au modificateur, puis une raison
  vide), à 1 440 et 390 px : le champ marqué, sa phrase visible, le focus
  sur lui. Le focus gardé après « − », « + » et une caractéristique. La
  région polie : un seul nœud, enfant de la racine. Les tables des
  zones : 24 en-têtes de ligne pour 24 lignes, quatre tables nommées.
- **Sur un téléphone.** À 390 px, l'état, « Fin de tour » et « ⋯ » sur
  une ligne, « Combat gardé sur cet appareil » dessous ; le menu ouvert,
  puis la question, ne déplacent pas les deux boutons ; à 320 et 360 px,
  ils passent à la ligne, à droite ; après « Effacer », le menu est
  fermé. La préparation, à 320, 360 et 390 px : « Les PJ » et « Les
  adversaires » sur la même ligne, sous leur intitulé. Avant le
  lancement, aux mêmes largeurs : aucune fiche ouverte sur quatre, et
  les quatre champs « Case » visibles (96 × 44 px), chacun avec
  « Retirer » (82 × 44 px) sur la même ligne. Le texte de la racine à
  200 %, à 390 px : la page ne défile plus de côté (96 px avant), la
  table des zones (429 px) défile dans sa fiche (324 px). La carte de
  « Fiche complète », à 390 px : 340 px dans un cadre de 340 (356
  avant), à l'échelle 0,473.
- **Sur un grand écran.** À 1 440 px, « Nouveau combat » puis « Fin de
  tour » au bout de la barre ; vu en chemin et corrigé : à 900 px, « Fin
  de tour » tombait seul à gauche, sous le titre. À 1 440 et 900 px,
  « Lancer le combat » au bout de la rangée de « Qui commence ».
- **Le journal.** Dans Firefox 143, le texte le plus à droite s'arrête à
  12,6 px du bord (12,2 px à 390 px), et la barre de défilement tient
  dans cette marge. Le combat terminé, 36 lignes : après un aller à
  l'écran Rencontre et un retour, le journal est au bas de son
  défilement (984 px, soit 1 368 − 384), dans Edge et dans Firefox. Au
  journal, seule « Marmiton n° 1 meurt. » est rouge et grasse.
- **Un combat ouvert ailleurs**, un second écrivant dans la base : au
  clic suivant, les trois jetons montrés sont inactifs, et aucun bouton
  « Jouer » ne reste.
- **Ce qui n'a pas été regardé à part dans un navigateur** : les groupes
  nommés des rangées et le nom accessible d'un dé, où rien ne se voit,
  et les quatre points faits de contrôles seuls. Vu, et non corrigé :
  dans Firefox, le trait qui barre la valeur d'un dé relancé se confond
  avec la barre d'un « 4 », qui est le dessin du chiffre.

**Un combat joué de bout en bout, par de vrais clics** et de vraies
frappes du protocole, quatre fois, jusqu'à « Combat terminé : victoire des
adversaires. », sans aucun échec : Edge 155 à 1 440 px (59 vérifications,
207 pas, 72 dés, 91 secondes), Firefox 143 à 1 440 px (56 vérifications,
185 pas, 64 dés, 137 secondes), Chrome 154.0.8037.99 à 1 440 px (59
vérifications, 216 pas, 78 dés), Edge à 390 px (59 vérifications, 149
pas). Dans les quatre : aucune erreur ni avertissement de console, aucune
requête échouée, aucune hors du serveur local. **Ces quatre combats
précèdent les corrections de l'écran** de la relecture de fin de
groupe, et n'ont pas été rejoués depuis par de vrais clics : depuis, les
contrôles de l'écran rejouent le combat de référence en entier dans le
document simulé, et la seconde série du clic a joué cent clics dans
chaque navigateur, sans mener un combat à son terme.

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
du tableau. Le 5 001e événement arrêtait le rejeu, par sa phrase. **Une
piste, suivie au groupe 2** : que l'offre ne juge que la capacité
demandée ; le plafond est monté à 15 000 (§ 17.3), et les deux bornes des
façons restent (§ 17.2).

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
  40 révisions s'écrivent comme avant. C'est une mesure sous Node ; dans
  un navigateur, le clic a été remesuré depuis (plus haut, la seconde
  série).

**Le site en ligne**, vérifié par l'agent principal le 12/10/2026 vers
13 h 10. Quatre-vingt-dix fichiers du site (`index.html`, les six
feuilles de `css/`, les quatre-vingt-un modules de `js/`, la banque et le
personnage de démonstration ; ni le manifeste, ni les icônes, ni les
polices n'ont été comparés) que sert
`https://silviooooooo.github.io/atelier-des-arpenteurs/` sont
identiques, octet pour octet, à ceux du commit `8032ce2` ; 24 d'entre
eux sont ceux du combat. Sur GitHub Actions, « Contrôles » a réussi sur
les commits `d51c16a` et `8032ce2` (issue relue le 12/10/2026 vers
13 h 40).

- **Aucun combat n'a été joué par un agent sur le site en ligne
  lui-même.** Y ouvrir la démonstration demande de saisir son mot de
  passe, et la règle de sécurité de l'outil interdit à l'agent de saisir
  un mot de passe hors du poste local, même public.
- **Ce qui en tient lieu, sans le remplacer** : le site sert, octet pour
  octet, le code du commit `8032ce2` ; un combat de démonstration a été
  joué jusqu'à « Combat terminé », par de vrais clics, dans Edge et dans
  Firefox, sur le serveur local, avant les corrections de l'écran (plus
  haut) ; depuis, les contrôles de l'écran rejouent le combat de
  référence en entier dans le document simulé.
- La mission demande qu'un combat s'y joue jusqu'au bout (son § 17) :
  **c'est le premier essai de la liste de l'auteur** (§ 13).

**Les contrôles de l'écran écrits avant la relecture, mis à l'épreuve**
le 12/10/2026 après 13 h 15, par le même lanceur, sur une copie du commit
`8032ce2` : 369 casses.

- **L'écran assemblé et son câblage** (`js/ecrans/combat.js`,
  `js/routes.js`, `js/application.js`, `index.html`) : 127 casses. Au
  premier passage, 102 vues, 21 non vues, 4 en délai. À la fin : 122
  vues, 3 équivalentes, preuve à l'appui, 2 en délai. Des 21 non vues, 17
  le sont devenues après l'ajout de sept contrôles et le complément de
  huit autres ; une l'était déjà par un contrôle de `tests/carte.test.js`,
  hors de la liste jouée ; les 3 dernières sont les équivalentes. Les deux
  casses restées en délai font attendre presque chaque contrôle cinq
  secondes avant d'échouer, et la somme dépasse la minute que le lanceur
  accorde : leur échec est déduit de cette borne, non observé.
- **Les quatre parties de l'écran et la feuille** (`combat_plateau.js`,
  `combat_fiches.js`, `combat_action.js`, `combat_preparation.js`,
  `css/combat.css`, les jetons du combat) : 242 casses, en deux listes.
  234 vues d'emblée ; les 8 autres le sont après l'ajout ou le complément
  de huit contrôles. Aucune équivalente, aucun délai.
- **Aucune casse n'a révélé de défaut du code.** Un défaut de contrôle,
  corrigé : l'attente de `tests/combat_ecran.test.js`, bornée en nombre
  d'essais, durait 47 secondes par attente déçue ; elle est bornée à cinq
  secondes.

**Le commit de fin du groupe 1** comptait 1 526 contrôles, que le crochet
passait à l'envoi ; l'issue de GitHub Actions sur ce commit est au compte
rendu de ce groupe.

**Ce qui n'était pas fait au groupe 1.**

- **Un combat joué sur le site en ligne** par un agent (plus haut).
- **Un combat de bout en bout par de vrais clics, depuis les corrections
  de l'écran** (plus haut). Les outils hors dépôt qui l'avaient joué
  n'ont pas été vérifiés contre la structure nouvelle de l'écran.
- **Rejouer 1 000 événements et enregistrer un combat de 300 dans un
  navigateur, depuis les corrections** ; le combat ordinaire de 4
  protagonistes, à la seconde série du clic.
- **Laissés par les corrections de l'écran**, à dire à l'auteur :
  - l'ordre du clavier suit le document, qui est celui du téléphone, et
    non l'œil sur un grand écran : dans la barre, « Fin de tour » vient
    avant « Nouveau combat », qui est à sa gauche ; à 80rem et plus, le
    clavier va de la carte et du panneau d'action aux personnages, puis
    aux adversaires ;
  - sur un téléphone, les initiales sont très petites dès que deux
    jetons partagent une case (relevé par la relecture : 6,5 px dans un
    rond de 12,7 px à 390 px, 4,9 px à 320 px), et les traits de la
    grille sont pâles, de 1,18:1 à 1,35:1 selon le thème et le fond.
    C'est la maquette, que l'auteur garde (25/10/2026) ;
  - à la première et à la dernière puissance d'une capacité, « − » ou
    « + » était inactif sans dire pourquoi : ces boutons ont disparu au
    groupe 2 (§ 17.6) ;
  - ce que le § 17.7 range sous « Ce qui change par rapport à la
    maquette du lot » : la première rangée de la préparation, les noms
    sans gras au journal (en gras depuis le groupe 2), le nom court encore
    coupé à certaines largeurs.
- **À l'auteur, à l'arrêt d'essais** (§ 13), ce que ni un document simulé
  ni un navigateur sans fenêtre ne montrent : le dépôt d'un
  glisser-déposer dans Firefox, à faire une fois à la main ; un vrai
  téléphone et le toucher, la largeur seule ayant été émulée, avec des
  clics de souris ; les lecteurs d'écran, la région d'annonce n'ayant été
  que lue dans le document ; les contrastes à l'écran, ceux des onze
  couleurs étant calculés par un contrôle (§ 11) et aucun mesuré à
  l'image ; le temps de peinture ; Firefox 157.

### 17.12 Ce que le groupe 3 ajoutera

Les règles fines et la main du MJ (mission, § 13, que la mission appelle
« groupe 2 » ; spécification 1.6). Il ne commence que sur la parole de
l'auteur, après l'arrêt d'essais du groupe 2 et `/clear` (§ 13) ; un
complément (`plans/complement_lot4_groupe3.md`) pourra l'écrire.

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
- **La palette** de modificateurs, avec le texte de la capacité jouée : sur
  les dés, la localisation, les dégâts (multiplier, ajouter, annuler,
  reporter, toute la case, une attaque en plus, rendre), la cible
  (défense, attaque, état, déplacement), chaque effet avec sa source et sa
  durée.
- **Les états** : ceux des blocs de type État de la banque, ou un état
  libre, avec une durée.
- **Le clic droit**, ou l'appui long sur téléphone, et un bouton
  « Modifier… » pour le clavier : il ne change que le combat en cours, et
  l'écrit au journal (modifier une valeur, changer l'équipement, un état,
  déplacer sans action, retirer du combat).
- **Plusieurs cibles**, avec un jet par cible.

La palette, « Intervenir… » et le menu du clic droit gardent leur place à
dire : le groupe 3 la dira dans la bulle (§ 17.7), et sur un téléphone.

**Les groupes 1 et 2 tiennent déjà ses points d'accroche** : le geste en
cours est le sommet d'une pile, qui recevra l'intervention ou la
contre-attaque, et l'annulation ne garde aujourd'hui que le geste racine
(§ 17.3) ; les dégâts sont une base et une suite d'opérations, où
entreront multiplier, ajouter et reporter ; la victime est un paramètre du
calcul des dégâts, jamais la cible du geste ; le prix d'un geste est un
objet ; l'attaque et la défense d'un protagoniste se lisent chacune par une
seule fonction (`attaqueDe`, `defenseDe`), qui rend déjà une valeur, sa
base et la liste de ses écarts ; le jet garde ses dés place par place, sans
aucun total ; la bulle et sa ligne par façon recevront les lignes neuves ;
une ligne du journal porte ses segments typés. **La version des règles
passera à 3** : un combat du groupe 2 se dira alors « commencé avec une
autre version du simulateur », sans se rejouer.
