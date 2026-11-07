/**
 * Validation du catalogue — module partagé entre le navigateur et Node.
 * Aucune dépendance, aucun accès au DOM.
 *
 * validateCatalog(data) -> { catalog, errors, warnings }
 *  - errors   : problèmes bloquants (le script de validation échoue)
 *  - warnings : points à surveiller (ne bloquent pas)
 *  - catalog  : uniquement les applications valides (une app invalide est écartée,
 *               elle ne fait jamais planter le reste du site)
 */

export const STATUSES = {
  disponible: 'Disponible',
  'en-developpement': 'En développement',
  suspendue: 'Suspendue',
  abandonnee: 'Abandonnée',
};

export const VERDICTS = {
  'non-audite': 'Audit non réalisé',
  'aucun-point-bloquant': 'Aucun point bloquant relevé',
  'points-de-vigilance': 'Points de vigilance',
  critique: 'Problème critique',
};

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_RE = /^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/?$/;
const RELEASE_URL_RE =
  /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/releases\/download\/[^/\s]+\/[^/\s]+\.apk$/;
const LOCAL_ASSET_RE = /^assets\/[A-Za-z0-9._\-/]+\.(svg|png|jpe?g|webp)$/;
// Motifs qui ne doivent jamais apparaître dans le catalogue public.
const SENSITIVE_RE = [
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/, // adresse IP
  /[A-Za-z]:\\/, // chemin Windows
  /\/(?:home|Users)\/[^\s/]+/, // chemin Unix personnel
  /gh[pousr]_[A-Za-z0-9]{20,}/, // token GitHub
  /AKIA[0-9A-Z]{16}/, // clé AWS
  /AIza[0-9A-Za-z_-]{30,}/, // clé Google
];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Compare deux numéros de version (1.10 > 1.9). */
export function compareVersions(a, b) {
  const pa = String(a).split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (isObj(value)) Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function validateApp(app, categoryIds) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!isObj(app)) return { errors: ['entrée invalide (objet attendu)'], warnings };

  if (!isStr(app.id) || !ID_RE.test(app.id)) err('« id » invalide (minuscules, chiffres et tirets)');
  if (!isStr(app.name)) err('« name » manquant');
  if (!isStr(app.shortDescription)) err('« shortDescription » manquant');
  else if (app.shortDescription.length > 140) warn('« shortDescription » dépasse 140 caractères');
  if (!isStr(app.description)) err('« description » manquante');
  if (!categoryIds.has(app.category)) err(`catégorie inconnue : « ${app.category} »`);
  if (!(app.status in STATUSES)) err(`« status » invalide : « ${app.status} »`);

  if (!isStr(app.icon) || !LOCAL_ASSET_RE.test(app.icon) || app.icon.includes('..'))
    err('« icon » doit être un fichier image local sous assets/');
  if (!Array.isArray(app.screenshots)) err('« screenshots » doit être une liste (éventuellement vide)');
  else
    app.screenshots.forEach((s, i) => {
      if (!isObj(s) || !LOCAL_ASSET_RE.test(s.src || '') || String(s.src).includes('..'))
        err(`capture ${i + 1} : « src » doit être un fichier local sous assets/`);
      if (!isObj(s) || !isStr(s.alt)) err(`capture ${i + 1} : « alt » (texte alternatif) manquant`);
    });

  if (!Array.isArray(app.features)) err('« features » doit être une liste');
  if (!isStr(app.repository) || !REPO_RE.test(app.repository)) err('« repository » doit être une URL de dépôt GitHub (https)');

  const released = app.status === 'disponible' || app.status === 'suspendue' || app.status === 'abandonnee';
  if (app.version != null && !VERSION_RE.test(String(app.version))) err('« version » invalide');
  if (app.releaseDate != null && !isRealDate(app.releaseDate)) err('« releaseDate » doit être une date AAAA-MM-JJ valide');
  if (!isStr(app.minAndroid)) err('« minAndroid » manquant (ex. « 10 »)');
  if (!isStr(app.compatibility)) err('« compatibility » manquant');

  // Téléchargement
  if (app.apk != null) {
    if (!isObj(app.apk)) err('« apk » invalide');
    else {
      if (!RELEASE_URL_RE.test(app.apk.url || ''))
        err('« apk.url » doit être un lien direct vers un .apk dans les Releases GitHub (https)');
      if (!Number.isInteger(app.apk.sizeBytes) || app.apk.sizeBytes <= 0) err('« apk.sizeBytes » doit être un entier positif');
      if (app.apk.sha256 != null && !SHA256_RE.test(app.apk.sha256)) err('« apk.sha256 » invalide (64 caractères hexadécimaux minuscules)');
      if (app.apk.sha256 == null) warn('pas d’empreinte SHA-256 pour l’APK actuel');
      if (isStr(app.repository) && isStr(app.apk.url) && !app.apk.url.startsWith(app.repository.replace(/\/$/, '') + '/releases/'))
        err('« apk.url » ne pointe pas vers les Releases du dépôt déclaré');
    }
  }
  if (app.status === 'disponible') {
    if (!app.apk) err('une application « disponible » doit avoir un « apk »');
    if (!app.version) err('une application « disponible » doit avoir une « version »');
    if (!app.releaseDate) err('une application « disponible » doit avoir une « releaseDate »');
    if (Array.isArray(app.versions) && app.version && !app.versions.some((v) => v && v.version === app.version))
      err('la version actuelle doit figurer dans « versions »');
  }
  if (!released && app.apk) warn('une application sans publication ne devrait pas avoir de lien APK');

  // Permissions
  if (!Array.isArray(app.permissions)) err('« permissions » doit être une liste (éventuellement vide)');
  else
    app.permissions.forEach((p, i) => {
      if (!isObj(p) || !isStr(p.name) || !isStr(p.reason)) err(`permission ${i + 1} : « name » et « reason » (justification) obligatoires`);
    });
  if (!Array.isArray(app.securityNotes)) err('« securityNotes » doit être une liste');

  // Historique des versions
  if (!Array.isArray(app.versions)) err('« versions » doit être une liste');
  else {
    const seen = new Set();
    app.versions.forEach((v, i) => {
      if (!isObj(v)) return err(`version ${i + 1} : entrée invalide`);
      if (!VERSION_RE.test(String(v.version))) err(`version ${i + 1} : numéro invalide`);
      if (seen.has(v.version)) err(`version « ${v.version} » en double`);
      seen.add(v.version);
      if (!isRealDate(v.date)) err(`version « ${v.version} » : date invalide`);
      if (!Array.isArray(v.notes) || v.notes.length === 0 || !v.notes.every(isStr)) err(`version « ${v.version} » : « notes » (liste de textes) obligatoire`);
      if (v.apkUrl != null && !RELEASE_URL_RE.test(v.apkUrl)) err(`version « ${v.version} » : « apkUrl » invalide`);
      if (v.sha256 != null && !SHA256_RE.test(v.sha256)) err(`version « ${v.version} » : « sha256 » invalide`);
    });
  }

  // Fiche de contrôle de sécurité
  const s = app.security;
  if (!isObj(s)) err('« security » (fiche de contrôle) manquante');
  else {
    if (!(s.verdict in VERDICTS)) err(`« security.verdict » invalide : « ${s.verdict} »`);
    if (s.lastAudit != null && !isRealDate(s.lastAudit)) err('« security.lastAudit » doit être une date AAAA-MM-JJ');
    if (s.verdict !== 'non-audite') {
      if (s.lastAudit == null) err('un audit réalisé nécessite « security.lastAudit »');
      if (!isStr(s.auditedVersion)) err('un audit réalisé nécessite « security.auditedVersion »');
    } else if (app.status === 'disponible') {
      warn('application disponible sans audit de sécurité');
    }
    if (!Array.isArray(s.points)) err('« security.points » doit être une liste');
    if (typeof s.blocked !== 'boolean') err('« security.blocked » doit être true ou false');
    if ((s.verdict === 'critique' || s.secretsExposed === true) && s.blocked !== true)
      err('verdict critique ou secrets exposés : « security.blocked » doit être true (téléchargement interdit)');
    if (s.blocked === true && app.status === 'disponible' && s.verdict !== 'critique' && s.secretsExposed !== true)
      warn('téléchargement bloqué sans verdict critique : vérifier l’intention');
    if (s.verdict === 'points-de-vigilance' && Array.isArray(s.points) && s.points.length === 0)
      warn('verdict « points de vigilance » sans détail');
    if (isStr(s.auditedVersion) && app.version && s.verdict !== 'non-audite' && s.auditedVersion !== app.version)
      warn(`audit sur la version ${s.auditedVersion} mais version actuelle ${app.version} : audit à refaire`);
  }

  // Aucune donnée sensible dans la fiche
  for (const str of collectStrings(app)) {
    for (const re of SENSITIVE_RE) {
      if (re.test(str)) {
        err(`donnée potentiellement sensible détectée (${re}) : « ${str.slice(0, 40)}… »`);
        break;
      }
    }
  }

  return { errors, warnings };
}

export function validateCatalog(data) {
  const errors = [];
  const warnings = [];
  const catalog = { store: {}, categories: [], apps: [] };

  if (!isObj(data)) return { catalog, errors: ['catalogue illisible (objet JSON attendu)'], warnings };
  if (data.schemaVersion !== 1) errors.push('« schemaVersion » doit valoir 1');
  catalog.store = isObj(data.store) ? data.store : {};
  // Adresse publique du store (utilisée par le QR code de la page « Partager »).
  if (catalog.store.url != null) {
    const u = catalog.store.url;
    if (typeof u !== 'string' || !/^https:\/\/[^\s]+$/.test(u) || u.length > 200) errors.push('« store.url » doit être une adresse https sans espace (200 caractères maximum)');
  }

  const cats = Array.isArray(data.categories) ? data.categories : [];
  if (cats.length === 0) errors.push('« categories » vide ou manquant');
  for (const c of cats) {
    if (isObj(c) && isStr(c.id) && ID_RE.test(c.id) && isStr(c.label)) catalog.categories.push(c);
    else errors.push(`catégorie invalide : ${JSON.stringify(c)}`);
  }
  const categoryIds = new Set(catalog.categories.map((c) => c.id));

  if (!Array.isArray(data.apps)) {
    errors.push('« apps » doit être une liste');
    return { catalog, errors, warnings };
  }
  const ids = new Set();
  data.apps.forEach((app, i) => {
    const label = isObj(app) && isStr(app.id) ? app.id : `#${i + 1}`;
    const r = validateApp(app, categoryIds);
    if (isObj(app) && ids.has(app.id)) r.errors.push('« id » en double');
    if (isObj(app)) ids.add(app.id);
    r.errors.forEach((m) => errors.push(`[${label}] ${m}`));
    r.warnings.forEach((m) => warnings.push(`[${label}] ${m}`));
    if (r.errors.length === 0) catalog.apps.push(app);
  });
  return { catalog, errors, warnings };
}
