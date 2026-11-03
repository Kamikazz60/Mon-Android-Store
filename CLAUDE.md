# Ruche (Mon-Android-Store) — instructions du projet
(Règles générales : skill developpement-pro. En cas de conflit, ce fichier et la sécurité priment. L'état d'avancement est dans PROJECT_CONTEXT.md, qui tient lieu de docs/SUIVI.md.)

## 1. Présentation
Objectif : store personnel d'applications Android, site statique sur GitHub Pages ; APK dans les Releases des dépôts de chaque app.
Livrable : site déployé (https://kamikazz60.github.io/Mon-Android-Store/ une fois Pages activé). Pas d'APK à construire ici.
Public : Doanh, ses amis, éventuellement le public.

## 2. Environnement (vérifié le 03/11/2026)
Machine : PC Windows 10 de Doanh. Projet : `Desktop\Programme IA\Mon-Android-Store`.
Dépôt GitHub : Kamikazz60/Mon-Android-Store (public, au départ un README seul). `gh` connecté (scopes repo, workflow).
Dossier local : pas encore un dépôt Git (voir PROJECT_CONTEXT.md).

## 3. Outils vérifiés
Git 2.55 (pas de user.name/email configurés), Node 24, npm 11, Python 3.12, gh 2.103. Aucune dépendance npm.

## 4–5. Appareils / réseau
Pas de téléphone testé. Réseau : API GitHub accessible. Actions publiques (push, activation de Pages, Releases) = accord de Doanh requis.

## 6. Architecture
HTML/CSS/JS natifs (modules ES), routage `#/`, catalogue `data/catalog.json`, validation partagée navigateur/Node (`assets/js/validate.js`).

## 7. Contraintes
Gratuit, sans pub, sans collecte, sans serveur, CSP stricte, pas d'`innerHTML` sur des données, pas d'APK dans le dépôt, aucun secret. Pas de notes/commentaires. « Populaires » seulement si statistiques respectueuses de la vie privée.

## 8. Commandes
`node scripts/serve.mjs` · `npm run check` (validate + secrets + tests) · `npm run sync [-- --write]`.

## 9. Particularités
Les APK de Doanh ne passent pas par `installateur\` : ils sont publiés dans les Releases GitHub. Icônes des apps = illustrations génériques à remplacer par les vraies icônes.
