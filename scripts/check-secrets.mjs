#!/usr/bin/env node
// Recherche de secrets et d'informations personnelles dans les fichiers du dépôt public.
// Usage : node scripts/check-secrets.mjs   (code de sortie 1 si un motif est trouvé)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'installateur', 'apk', 'livrables']);
const SKIP_FILES = new Set(['check-secrets.mjs', 'test.mjs', 'validate.js']); // contiennent les motifs eux-mêmes
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.md', '.svg', '.yml', '.yaml', '.txt']);

const PATTERNS = [
  ['token GitHub', /\bgh[pousr]_[A-Za-z0-9]{20,}\b|github_pat_[A-Za-z0-9_]{20,}/],
  ['clé AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['clé Google', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['clé privée', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['secret en clair', /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{8,}["']/i],
  ['adresse IP', /\b(?!127\.0\.0\.1\b)(?:\d{1,3}\.){3}\d{1,3}\b/],
  ['chemin Windows personnel', /\b[A-Za-z]:\\(?:Users|Documents)/i],
  ['chemin Unix personnel', /\/(?:home|Users)\/[A-Za-z0-9_.-]+\//],
  ['adresse e-mail', /\b[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(full); continue; }
    if (SKIP_FILES.has(name) || !TEXT.has(extname(name))) continue;
    readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
      for (const [label, re] of PATTERNS) if (re.test(line)) hits.push(`${relative(root, full)}:${i + 1}  ${label}`);
    });
  }
}
walk(root);

if (hits.length) {
  console.error('✗ Éléments sensibles possibles :');
  hits.forEach((h) => console.error('  ' + h));
  process.exit(1);
}
console.log('✓ Aucun secret ni information personnelle détecté dans les fichiers texte.');
