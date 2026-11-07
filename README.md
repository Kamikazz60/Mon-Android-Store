# Ruche — mon store personnel d'applications Android

Un petit « Play Store » personnel : site statique hébergé gratuitement sur **GitHub Pages**, qui présente mes applications Android et pointe vers leurs APK dans les **Releases GitHub** de leurs dépôts.

- Sans publicité, sans compte, sans cookie, sans statistique, sans serveur.
- Zéro dépendance (HTML, CSS et JavaScript natifs ; Node.js seulement pour les scripts de contrôle).
- Interface en français, responsive (priorité Android), thème clair/sombre.
- Le catalogue est un seul fichier : [`data/catalog.json`](data/catalog.json).

## Utilisation rapide

```bash
node scripts/serve.mjs        # site local sur http://127.0.0.1:8080/
npm run check                 # valide le catalogue + tests + recherche de secrets
npm run sync                  # compare le catalogue avec les Releases GitHub (rapport)
```

## Procédures (détail dans [docs/AJOUTER_UNE_APP.md](docs/AJOUTER_UNE_APP.md))

| Je veux… | Je fais… |
|---|---|
| **Ajouter une application** | Publier une Release (avec l'APK) sur son dépôt, ajouter un bloc dans `apps` du catalogue, `npm run check`, commit + push |
| **Publier une mise à jour** | Nouvelle Release sur le dépôt de l'app ; `npm run sync -- --write` ; compléter les nouveautés ; refaire l'audit ; `npm run check` ; push |
| **Retirer une application** | Mettre `status` à `suspendue`/`abandonnee` et supprimer `apk` (ou supprimer le bloc) ; push |

Le déploiement est automatique à chaque push sur `main` ([workflow](.github/workflows/deploy.yml)) : si la validation échoue, rien n'est publié.

## Organisation

```
index.html, 404.html        Page unique (routage par #/…) et page d'erreur
assets/css/style.css        Styles et thèmes
assets/js/                  app.js (démarrage, routes, thème) · views.js (vues) · dom.js · validate.js · qr.js (générateur de QR code)
assets/img/                 logo, favicon, icônes des applications (apps/), captures (shots/)
data/catalog.json           LE catalogue
scripts/                    validate-catalog · check-secrets · test · sync-releases · serve
docs/                       Procédures et audit Android
.github/workflows/          Validation + déploiement GitHub Pages
```

## Sécurité en bref

CSP stricte (aucune ressource tierce), aucun `innerHTML` sur des données, liens APK limités aux Releases GitHub du dépôt déclaré, fiche de contrôle de sécurité par application, blocage du téléchargement en cas de vulnérabilité critique. Détails : [SECURITY_POLICY.md](SECURITY_POLICY.md).

## Limites connues

- Pas de section « populaires » : il n'existe pas de statistiques fiables et respectueuses de la vie privée sans serveur (les compteurs de téléchargement des Releases ne sont pas fiables et obligeraient à appeler l'API depuis le navigateur).
- Pas de notes ni de commentaires (ils exigeraient un serveur).
- Un audit automatisé ne prouve pas qu'une application est sûre.
- GitHub Pages ne permet pas de définir les en-têtes HTTP : la CSP est donnée par une balise `<meta>` (elle ne peut pas inclure `frame-ancestors`).

Contexte et avancement du projet : [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Page « Partager » (QR code)

`#/partager` affiche un QR code vers le store, avec les boutons Copier le lien, Partager (si le téléphone le permet), Enregistrer en PNG ou SVG, et Imprimer. Le QR code est généré dans le navigateur par `assets/js/qr.js` (aucune dépendance, aucun service externe) et reste noir sur blanc dans les deux thèmes.

- L'adresse encodée est `store.url` dans `data/catalog.json` (https obligatoire, vérifié par `npm run check`). **Si l'adresse du store change** (nom de domaine personnalisé, renommage du dépôt), modifiez seulement cette valeur : le QR code suit.
- Le générateur est validé par décodage avec un lecteur de QR code indépendant lors du développement (versions 1 à 10, niveaux L/M/Q/H) ; `npm test` garde des contrôles de non-régression.

