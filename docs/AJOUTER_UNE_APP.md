# Ajouter, mettre à jour ou retirer une application

Tout se passe dans `data/catalog.json`. Le code du site ne change jamais.

## A. Ajouter une application

1. **Publier l'APK** dans une Release du dépôt de l'application (GitHub → Releases → *Draft a new release*, joindre le `.apk`). Utiliser un APK **signé en release** (pas debug) pour la diffusion.
2. **Auditer** l'application : voir [AUDIT_ANDROID.md](AUDIT_ANDROID.md). Noter le résultat.
3. **Ajouter l'icône** (SVG/PNG/WebP, carrée) dans `assets/img/apps/` et d'éventuelles captures dans `assets/img/shots/`.
4. **Copier un bloc existant** de `apps` dans `data/catalog.json` et le modifier. Champs :

| Champ | Contenu |
|---|---|
| `id` | identifiant unique : minuscules, chiffres, tirets (devient l'adresse `#/app/<id>`) |
| `name`, `shortDescription` (≤140 car.), `description` | textes ; paragraphes séparés par une ligne vide |
| `category` | un `id` de la liste `categories` (ajoutable en tête du fichier) |
| `icon`, `screenshots[{src,alt}]` | fichiers sous `assets/` ; `alt` obligatoire |
| `features` | liste des fonctionnalités |
| `status` | `disponible`, `en-developpement`, `suspendue` ou `abandonnee` |
| `repository` | `https://github.com/<compte>/<depot>` |
| `version`, `releaseDate` (AAAA-MM-JJ) | version actuelle ; obligatoires si `disponible` |
| `apk` | `url` (lien direct du `.apk` dans les Releases **du même dépôt**), `sizeBytes`, `sha256` conseillé |
| `minAndroid`, `compatibility` | ex. `"10"` et un texte |
| `permissions[{name,reason}]` | chaque permission **justifiée** |
| `securityNotes` | recommandations aux utilisateurs |
| `security` | `verdict` (`non-audite`, `aucun-point-bloquant`, `points-de-vigilance`, `critique`), `lastAudit`, `auditedVersion`, `points[]`, `blocked` (true/false), `secretsExposed` (optionnel) |
| `versions[]` | historique : `version`, `date`, `notes[]`, et `apkUrl`, `sizeBytes`, `sha256` facultatifs. La version actuelle doit y figurer |

   Application pas encore publiée : `status: "en-developpement"`, pas de `apk`, `version`/`releaseDate` absents, `versions: []`.
5. `npm run check` : doit afficher « 0 erreur ». Corriger ce qu'il signale.
6. `node scripts/serve.mjs`, vérifier la fiche dans le navigateur.
7. `git add -A && git commit -m "Ajout de <app>" && git push` → le site se met à jour tout seul (1 à 2 minutes).

## B. Publier une mise à jour

1. Nouvelle Release (nouveau tag, nouvel APK) sur le dépôt de l'application.
2. `npm run sync` (rapport) puis `npm run sync -- --write` : met à jour `version`, `releaseDate`, `apk` (lien, taille, SHA-256) et ajoute une entrée dans `versions` avec « À COMPLÉTER ».
3. Rédiger les nouveautés de cette entrée ; revoir `permissions` si elles ont changé.
4. **Refaire l'audit** si la mise à jour est importante, puis mettre à jour `security` (`lastAudit`, `auditedVersion`, `verdict`, `points`). Le contrôle affiche un avertissement si la version auditée n'est pas la version actuelle.
5. `npm run check`, puis commit + push. Les anciennes versions restent consultables dans l'historique.

Sans `sync` : modifier les mêmes champs à la main, c'est équivalent.

## C. Retirer une application

- **Temporairement / définitivement, en gardant la fiche** : `status` à `suspendue` ou `abandonnee`, supprimer le bloc `apk` (le bouton devient « indisponible »).
- **En cas de problème de sécurité** : `security.verdict: "critique"` (ou `secretsExposed: true`) et `security.blocked: true` : le téléchargement est coupé, la fiche explique pourquoi.
- **Suppression totale** : supprimer le bloc de `apps`, puis les images associées. Penser aussi à supprimer la Release sur le dépôt de l'app si l'APK ne doit plus être accessible, car l'ancien lien reste valide tant que la Release existe.

## Si le contrôle échoue

Le message indique l'application entre crochets et le champ fautif. Sur le site publié, une fiche invalide est simplement masquée : le reste du catalogue continue de fonctionner (et le déploiement est de toute façon refusé tant que `npm run check` échoue).
