# Consignes pour Claude Code — L'Atelier des Arpenteurs

Lire `SPECIFICATION.md` en entier avant toute chose : il fait foi.

## Travailler avec l'auteur (Silvio Abbaz)

- **Vouvoiement**, ton chaleureux.
- **Le plan avant le code** : exposer la liste des fichiers à créer ou
  modifier et leur contenu, puis attendre la validation.
- **Une todo visible**, présentée au début et remontrée à chaque pas franchi,
  une ligne vide entre chaque point.
- **Les questions groupées à la fin.** Trancher soi-même les choix
  réversibles et les signaler ; ne bloquer que sur ce qui serait dangereux.
- **Contredire, mesure à l'appui**, quand une idée paraît fragile.
- **Proposer** ce qui paraît utile, sans l'imposer.
- **Estimer** le temps et le travail humain qu'une étape demandera.

## Les règles du jeu

Le Word `Principe jdr abrasia.docx` fait foi. **Ne jamais inventer une règle.**
Si le code a besoin d'une règle absente, s'arrêter sur ce point et l'inscrire
au § 12 de la spécification : « à écrire dans le Word, section … ». L'auteur ne
répond pas aux questions de règles en conversation.

## Les cinq interdits

1. Aucun classeur réel dans le dépôt (public) : seuls `essais/*.xlsx`, fictifs.
2. Aucune donnée réelle en clair dans le dépôt, hors les exemples de la
   spécification, réels mais non confidentiels.
3. Aucune clé ni aucun mot de passe dans le code ou un fichier suivi,
   hors le mot de passe public de la démonstration (§ 9).
4. Aucune écriture dans un classeur de l'auteur ; seul l'outil des essais
   (`tests/outils/`) fabrique le classeur fictif d'`essais/`.
5. Aucune dépendance sans justification écrite dans la spécification.

## La méthode

- Code, commentaires, identifiants, messages et clés JSON **en français**.
- Un défaut se mesure avant de se corriger.
- Un contrôle nouveau se vérifie **armé puis désarmé**.
- **La spécification s'amende avec le code** : réécrire le paragraphe à
  chaque étape. **Un numéro de version par groupe, à la fin du groupe** :
  une entrée en tête du § 14, qui détaille les étapes du groupe.
- Commits en prose française : un titre, puis ce qui a changé, ce qui a été
  mesuré, ce qui a été laissé.
- **Le dépôt est public** : `git config user.email` (sans `--global`) est
  l'adresse privée GitHub de l'auteur (`…@users.noreply.github.com`), jamais
  son adresse personnelle.
- Contrôles : `node --test` (Node 22 ou plus récent, 24 conseillé).
- Banc sur le classeur réel, **hors dépôt** :
  `node tests/banc_classeur_reel.js chemin/vers/regles_jdr.xlsx`.

## Circuit de travail

- Les instructions viennent de Claude (conversation claude.ai), par
  l'auteur, sous la forme `plans/instruction_<groupe>.md`. Elles ne
  contiennent aucun choix ouvert : ne pas les rouvrir.
- Pas de validation entre les étapes d'un même groupe. S'arrêter avant la
  fin du groupe seulement pour : une contradiction avec la spécification ;
  une règle du jeu absente du Word ; un contrôle impossible à faire passer
  après deux approches différentes ; une erreur de verrou Git ; une
  consommation manifestement anormale.
- À chaque arrêt : écrire `plans/compte_rendu_<groupe>.md` selon le modèle
  ci-dessous, puis s'arrêter.

## Modèle du compte rendu (deux pages au plus, aucun code recopié)

1. Fait : étapes, commits (sha court et titre).
2. Contrôles : nombre, échecs, contrôles vus armés puis désarmés.
3. Mesures, dont les bancs sur le classeur réel.
4. Écarts à la spécification : amendements faits, version.
5. Choix faits seul (réversibles).
6. Points à trancher, chacun avec une recommandation.
7. Suite prévue.
8. Consommation : laisser « relevé /usage : à compléter par l'auteur ».

## Économie

- Ne lire de la spécification que les § utiles à l'étape.
- Pendant le travail, ne lancer que les contrôles de l'étape ; la suite
  complète en fin d'étape.
- Filtrer les sorties longues (`tail`, `grep`) plutôt que les lire entières.
- Un seul agent pour le travail. Sous-agent pour dépouiller une sortie très
  longue, ou pour relire dans le cadre suivant.
- **Relecture par plusieurs agents** (décision de l'auteur, 28/09/2026) :
  **autorisée**, dans ce cadre : à la fin d'un groupe (ou, dans ce groupe,
  au début, comme revue de sécurité) ; **trois relecteurs au plus**, chacun
  avec un angle distinct ; **une seule liste consolidée** ; c'est l'agent
  principal qui corrige ; le compte rendu dit ce qu'ils ont trouvé.

## OneDrive

Le dépôt est dans OneDrive (décision de l'auteur). En cas d'erreur de verrou
(`index.lock`, « Permission denied », fichier en cours d'utilisation) :
s'arrêter ; ne jamais effacer un verrou ni relancer en boucle ; demander à
l'auteur de suspendre la synchronisation OneDrive, puis réessayer une fois.

## Consignes de résumé

En cas de résumé du contexte, garder : l'étape en cours, les fichiers
modifiés depuis le dernier commit, les contrôles en échec et leur cause,
les choix faits seul, la prochaine action.
