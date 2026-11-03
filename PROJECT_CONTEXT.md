# PROJECT_CONTEXT — Ruche

Dernière mise à jour : 03/11/2026

## Décisions techniques

| Décision | Raison | Écartée |
|---|---|---|
| Site statique natif (HTML/CSS/JS modules), sans framework ni build | Fiabilité, zéro dépendance, maintenance sur des années, CSP stricte | React/Vite (build + dépendances inutiles ici) |
| Une seule page, routage par hash (`#/app/<id>`) | Fonctionne sur GitHub Pages sans règle de réécriture, liens partageables | Pages HTML par app (génération à maintenir) |
| Catalogue JSON unique validé par un module partagé navigateur/Node | Ajouter une app = éditer un fichier ; une fiche invalide est écartée sans casser le site ; le même code valide en CI | Validation JSON Schema (dépendance) |
| Liens APK limités aux Releases GitHub du dépôt déclaré | Empêche un lien piégé dans le catalogue | Liens libres |
| Pas d'appel à l'API GitHub depuis le navigateur | Site indépendant de tout service, pas de limite de débit ; `sync-releases` s'exécute localement | Chargement dynamique des Releases |
| Pas de « populaires », notes ni commentaires | Pas de statistiques fiables sans serveur ni pistage | Compteurs de téléchargements GitHub |
| Nom/identité « Ruche » (alvéole orange, flèche de téléchargement) | Identité propre, indépendante des apps | — |
| CSP par balise `<meta>` | GitHub Pages n'autorise pas d'en-têtes ; `frame-ancestors` impossible | — |

## Architecture
Voir README.md (organisation) et SECURITY_POLICY.md.

## Niveaux de validation (état réel)
| Élément | Niveau |
|---|---|
| Catalogue, validateur, 13 tests, recherche de secrets | Testé automatiquement (réussi le 03/11/2026) |
| Site : accueil, recherche, fiches, pages statiques, mobile 375 px et thème sombre | Testé dans le navigateur intégré (émulation) — pas sur un vrai téléphone |
| Téléchargement APK réel, installation Android | **Non testé** (liens vérifiés d'après l'API GitHub, pas téléchargés) |
| Workflow GitHub Actions, déploiement Pages | **Non exécuté** (rien n'est publié) |
| `sync-releases.mjs` | Rapport exécuté le 03/11/2026 : les 2 apps sont à jour ; l'option `--write` n'a pas été exercée |

## Tâches réalisées
Analyse de l'environnement · identité visuelle (logo, favicon, thèmes) · interface (accueil, recherche instantanée, filtres, tri, fiches, historique, installation guidée, barre de téléchargement mobile) · catalogue avec IGN Trail et APK Installer (données issues de leurs Releases publiques et de leurs manifestes) · validation, tests, recherche de secrets · workflow Pages · documentation.

## Tâches restantes
- **P0** : accord de Doanh puis `git init`, commit, push vers Mon-Android-Store ; activer Pages (Source : GitHub Actions) ; vérifier le site en ligne.
- **P0** : audit de sécurité réel d'IGN Trail et d'APK Installer (les deux sont « non audités » dans le catalogue ; APK Installer est une version debug).
- **P1** : remplacer les icônes génériques par les vraies icônes ; ajouter des captures d'écran ; test sur téléphone Android ; essayer `npm run sync`.
- **P1** : ajouter les autres apps publiques (AntivolAndroid n'a pas encore de Release).
- **P2** : domaine personnalisé ; outil d'audit APK automatisé (aapt2 + recherche de secrets).

## Prochaine tâche exacte
Obtenir l'accord de Doanh pour publier (git init + push + Pages), puis vérifier https://kamikazz60.github.io/Mon-Android-Store/.
