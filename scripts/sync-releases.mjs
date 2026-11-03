#!/usr/bin/env node
// Compare le catalogue avec les Releases GitHub (API publique, sans jeton) et propose les écarts.
//   node scripts/sync-releases.mjs            -> rapport seulement (ne modifie rien)
//   node scripts/sync-releases.mjs --write    -> met à jour version, date, APK, taille et empreinte
// Les textes (nouveautés, permissions…) restent à rédiger à la main : relisez toujours le diff.
// Exécuté sur votre machine : le site, lui, ne dépend d'aucun service au chargement.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'catalog.json');
const write = process.argv.includes('--write');
const catalog = JSON.parse(readFileSync(file, 'utf8'));
let changes = 0;

for (const app of catalog.apps) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/.exec(app.repository);
  if (!m || app.status !== 'disponible') continue;
  const res = await fetch(`https://api.github.com/repos/${m[1]}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ruche-store-sync' } });
  if (!res.ok) { console.warn(`⚠ ${app.id} : API GitHub ${res.status} (dépôt privé, sans Release, ou limite atteinte)`); continue; }
  const rel = await res.json();
  const asset = (rel.assets || []).find((a) => a.name.endsWith('.apk'));
  if (!asset) { console.warn(`⚠ ${app.id} : aucun .apk dans la dernière Release`); continue; }
  const version = rel.tag_name.replace(/^v/, '');
  const date = rel.published_at.slice(0, 10);
  const sha = (asset.digest || '').replace(/^sha256:/, '') || undefined;

  if (version === app.version && asset.browser_download_url === app.apk.url) { console.log(`✓ ${app.id} à jour (v${version})`); continue; }
  changes++;
  console.log(`↻ ${app.id} : v${app.version} → v${version} (${asset.name}, ${asset.size} octets)`);
  if (!write) continue;
  app.version = version;
  app.releaseDate = date;
  app.apk = { url: asset.browser_download_url, sizeBytes: asset.size, ...(sha && { sha256: sha }) };
  if (!app.versions.some((v) => v.version === version)) {
    app.versions.unshift({ version, date, notes: ['À COMPLÉTER : nouveautés de cette version.'], apkUrl: app.apk.url, sizeBytes: asset.size, ...(sha && { sha256: sha }) });
  }
  // L'audit ne couvre plus la nouvelle version : à refaire.
  if (app.security.verdict !== 'non-audite') console.warn(`⚠ ${app.id} : audit de la v${app.security.auditedVersion} à refaire pour la v${version}`);
}

if (write && changes) {
  catalog.store.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
  console.log('Catalogue mis à jour. Complétez les nouveautés, puis lancez « npm run check ».');
} else if (changes) console.log('\nRelancez avec --write pour appliquer.');
