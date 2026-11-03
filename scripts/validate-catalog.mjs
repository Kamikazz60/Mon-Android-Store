#!/usr/bin/env node
// Valide data/catalog.json et vérifie que les fichiers référencés existent.
// Usage : node scripts/validate-catalog.mjs   (code de sortie 1 en cas d'erreur)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateCatalog } from '../assets/js/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let data;
try {
  data = JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8'));
} catch (e) {
  console.error(`✗ data/catalog.json illisible : ${e.message}`);
  process.exit(1);
}

const { catalog, errors, warnings } = validateCatalog(data);

for (const app of catalog.apps) {
  for (const file of [app.icon, ...app.screenshots.map((s) => s.src)]) {
    if (!existsSync(join(root, file))) errors.push(`[${app.id}] fichier introuvable : ${file}`);
  }
}

warnings.forEach((w) => console.warn(`⚠ ${w}`));
errors.forEach((e) => console.error(`✗ ${e}`));
console.log(
  `\n${catalog.apps.length}/${data.apps?.length ?? 0} application(s) valide(s), ${errors.length} erreur(s), ${warnings.length} avertissement(s).`,
);
process.exit(errors.length ? 1 : 0);
