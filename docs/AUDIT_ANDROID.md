# Fiche de contrôle de sécurité d'un APK

À faire **avant** chaque publication importante. Reporter le résultat dans `security` du catalogue. Un audit automatisé ne prouve jamais qu'une application est parfaitement sûre : il réduit le risque.

Une application avec un **secret exposé** ou une **vulnérabilité critique** n'est pas publiable : `blocked: true`.

## Outils (gratuits)

| Besoin | Outil |
|---|---|
| Lire manifeste, permissions, signature | `aapt2 dump badging`, `apkanalyzer manifest print`, `apksigner verify --print-certs` (Android SDK build-tools) |
| Décompiler | `jadx` (https://github.com/skylot/jadx) ou `apktool` |
| Analyse automatique | MobSF (Mobile Security Framework, en local avec Docker) |
| Secrets | `gitleaks` ou `trufflehog` sur le code **et** sur le dossier décompilé |
| Dépendances | `./gradlew dependencies`, OWASP Dependency-Check, OSV-Scanner |
| Lint Android | `./gradlew lintRelease` |

## Liste de contrôle

| # | Contrôle | Comment | OK ? |
|---|---|---|---|
| 1 | Aucune clé API, token, mot de passe dans le code ni l'APK | gitleaks sur le dépôt ; `jadx` puis recherche de `key`, `token`, `secret`, `password`, `AIza`, `AKIA`, `ghp_` | ☐ |
| 2 | Permissions minimales et justifiées | manifeste ; chaque permission documentée dans `permissions` | ☐ |
| 3 | Composants exportés | chercher `android:exported="true"` : seuls les écrans/filtres voulus ; tout le reste `false` ; protéger par `permission` si exporté | ☐ |
| 4 | Services, activités, receivers, providers | pour chacun : utile ? exporté ? intent-filter trop large ? provider sans `grantUriPermissions` maîtrisé ? | ☐ |
| 5 | Dépendances à jour et sans CVE connue | OWASP Dependency-Check / OSV-Scanner | ☐ |
| 6 | Réseau chiffré | pas de `usesCleartextTraffic="true"` ; `networkSecurityConfig` sans confiance aux certificats utilisateur ; pas de `TrustManager` permissif | ☐ |
| 7 | Stockage des données sensibles | pas de secret en `SharedPreferences` clair ni stockage externe ; `allowBackup` réfléchi ; chiffrement (Keystore) si besoin | ☐ |
| 8 | Débogage désactivé | `android:debuggable` absent/`false` ; APK **release** ; pas de logs de données sensibles | ☐ |
| 9 | Fonctions risquées | WebView avec JS + `addJavascriptInterface`, exécution de code téléchargé, accès shell, chargement dynamique de code, deep links non validés | ☐ |
| 10 | Signature | APK signé avec la clé de release (pas la clé debug) ; **même clé** à chaque version | ☐ |
| 11 | Données personnelles | aucune IP, chemin, identifiant ou service privé en dur (`strings` / jadx) | ☐ |

## Résultat à reporter

- Aucun point bloquant → `verdict: "aucun-point-bloquant"`.
- Points non bloquants (à lister) → `verdict: "points-de-vigilance"` + `points`.
- Secret exposé / vulnérabilité critique → `verdict: "critique"`, `blocked: true` ; corriger, **changer les secrets exposés**, republier.
- Toujours renseigner `lastAudit` (date) et `auditedVersion`.

## Clé de signature

Ne jamais la mettre dans un dépôt (même privé : utiliser un coffre/gestionnaire de mots de passe et une sauvegarde chiffrée). La perdre empêche de publier des mises à jour installables par-dessus.
