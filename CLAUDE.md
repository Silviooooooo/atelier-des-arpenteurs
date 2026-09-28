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
2. Aucune donnée réelle en clair dans le dépôt.
3. Aucune clé ni aucun mot de passe dans le code ou un fichier suivi.
4. Aucune écriture dans un classeur.
5. Aucune dépendance sans justification écrite dans la spécification.

## La méthode

- Code, commentaires, identifiants, messages et clés JSON **en français**.
- Un défaut se mesure avant de se corriger.
- Un contrôle nouveau se vérifie **armé puis désarmé**.
- **La spécification s'amende avec le code** : réécrire le paragraphe, ajouter
  une entrée en tête du § 14, passer le numéro de version.
- Commits en prose française : un titre, puis ce qui a changé, ce qui a été
  mesuré, ce qui a été laissé.
- **Le dépôt est public** : `git config user.email` (sans `--global`) est
  l'adresse privée GitHub de l'auteur (`…@users.noreply.github.com`), jamais
  son adresse personnelle.
- Contrôles : `node --test` (Node 22 ou plus récent).
- Banc sur le classeur réel, **hors dépôt** :
  `node tests/banc_classeur_reel.js chemin/vers/regles_jdr.xlsx`.
