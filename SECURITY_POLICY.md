# Politique de sécurité de Ruche

Le store est public : tout ce qu'il contient, et toutes les applications distribuées, peuvent être lus, décompilés et analysés par n'importe qui. On part de ce principe.

## 1. Le site

| Exigence | Mise en œuvre |
|---|---|
| Aucun secret dans le code public | Aucune clé ni token n'existe dans le projet ; `scripts/check-secrets.mjs` (tokens, clés, IP, chemins personnels, e-mails) est exécuté par `npm run check` et par le workflow |
| Aucune donnée personnelle exposée | Le catalogue est vérifié (`validate.js`) : IP, chemins locaux, tokens refusés |
| Pas de lien avec mon réseau / mon PC | Site 100 % statique ; le serveur local n'écoute que sur 127.0.0.1 |
| Pas d'exécution de commande à distance | Aucun backend, aucun `eval`, aucun `innerHTML` sur des données : tout passe par `textContent` |
| Dépendances limitées | **Aucune** dépendance d'exécution ni de build (le workflow utilise seulement des actions GitHub officielles `actions/*`) |
| Pas de script tiers | Aucune police, image, CDN ou statistique externe |
| CSP | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'` (balise `<meta>`) |
| Cookies / pistage | Aucun. Seul `localStorage` mémorise le thème choisi |
| Liens sortants | `rel="noopener noreferrer"`, `referrer: no-referrer` |
| Liens de téléchargement | Uniquement `https://github.com/<compte>/<dépôt>/releases/download/…/*.apk`, et le dépôt doit être celui déclaré dans la fiche |

Limite : GitHub Pages n'autorise pas les en-têtes HTTP personnalisés ; `frame-ancestors` (anti-clickjacking) est donc impossible. Risque faible : le site n'a ni compte ni action sensible.

## 2. Les APK

- Audit **avant chaque publication importante** : [docs/AUDIT_ANDROID.md](docs/AUDIT_ANDROID.md) (secrets, permissions, composants exportés, dépendances, réseau, stockage, débogage, fonctions risquées, signature).
- Fiche de contrôle dans le catalogue : `verdict`, `lastAudit`, `auditedVersion`, `points`, `blocked`.
- **Publication contrôlée** : verdict `critique` ou `secretsExposed: true` ⇒ `blocked: true` obligatoire (le validateur refuse le catalogue sinon) ⇒ bouton de téléchargement désactivé.
- Une application non auditée reste identifiée comme telle sur la fiche (« Audit non réalisé »). Le store ne prétend jamais qu'une application est parfaitement sûre.
- Empreinte SHA-256 de chaque APK affichée quand elle est connue.
- Ne jamais diffuser un APK debug comme version de production.

## 3. Mon environnement personnel

Ne jamais mettre dans un dépôt ou une application publique : adresse IP personnelle, chemins de fichiers, identifiants de comptes, informations sur le réseau local, accès à des services privés, clé de signature, jetons. Le store et les applications restent indépendants de mon téléphone et de mon PC.

## 4. Si un problème est découvert

1. Passer `security.blocked: true` (et `verdict: "critique"`), pousser : le téléchargement est coupé en 1 à 2 minutes.
2. Supprimer la Release fautive sur le dépôt de l'application (l'ancien lien reste valide tant qu'elle existe).
3. **Révoquer et remplacer** tout secret exposé (supprimer le fichier ne suffit pas).
4. Corriger, ré-auditer, publier une nouvelle version, documenter dans `versions`.

## 5. Compte GitHub

Activer l'authentification à deux facteurs ; ne jamais partager le jeton de la CLI `gh` ; vérifier régulièrement les Releases publiées.
