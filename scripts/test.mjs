#!/usr/bin/env node
// Tests automatiques du validateur de catalogue (aucune dépendance : node:assert).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateCatalog, compareVersions } from '../assets/js/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const real = JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8'));
const clone = () => structuredClone(real);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`✓ ${name}`); };
const firstApp = (c) => c.apps[0];

test('le catalogue réel est valide', () => {
  const r = validateCatalog(real);
  assert.deepEqual(r.errors, []);
  assert.equal(r.catalog.apps.length, real.apps.length);
});

test('comparaison de versions (1.10 > 1.9)', () => {
  assert.ok(compareVersions('1.10', '1.9') > 0);
  assert.ok(compareVersions('1.0.4', '1.0.1') > 0);
  assert.equal(compareVersions('2', '2.0.0'), 0);
});

test('une app invalide est écartée sans casser les autres', () => {
  const c = clone();
  delete firstApp(c).name;
  const r = validateCatalog(c);
  assert.ok(r.errors.length > 0);
  assert.equal(r.catalog.apps.length, real.apps.length - 1);
});

test('lien APK hors Releases GitHub refusé', () => {
  const c = clone();
  firstApp(c).apk.url = 'https://exemple.org/app.apk';
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('apk.url')));
});

test('lien APK d’un autre dépôt refusé', () => {
  const c = clone();
  firstApp(c).apk.url = 'https://github.com/autre/depot/releases/download/v1/x.apk';
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('dépôt déclaré')));
});

test('chemin d’icône avec « .. » refusé', () => {
  const c = clone();
  firstApp(c).icon = 'assets/../secret.svg';
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('icon')));
});

test('verdict critique sans blocage refusé', () => {
  const c = clone();
  Object.assign(firstApp(c).security, { verdict: 'critique', lastAudit: '2026-11-01', auditedVersion: '1.0.4', blocked: false });
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('blocked')));
});

test('secrets exposés sans blocage refusé', () => {
  const c = clone();
  Object.assign(firstApp(c).security, { secretsExposed: true, blocked: false });
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('blocked')));
});

test('audit réalisé sans date refusé', () => {
  const c = clone();
  firstApp(c).security.verdict = 'aucun-point-bloquant';
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('lastAudit')));
});

test('adresse IP dans une fiche refusée', () => {
  const c = clone();
  firstApp(c).securityNotes.push('Serveur de test sur 192.168.1.20');
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('sensible')));
});

test('id en double refusé', () => {
  const c = clone();
  c.apps[1].id = c.apps[0].id;
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('double')));
});

test('catégorie inconnue refusée', () => {
  const c = clone();
  firstApp(c).category = 'inexistante';
  assert.ok(validateCatalog(c).errors.some((e) => e.includes('catégorie')));
});

test('entrée non-objet et catalogue illisible gérés', () => {
  const c = clone();
  c.apps.push(null, 'texte');
  assert.equal(validateCatalog(c).catalog.apps.length, real.apps.length);
  assert.ok(validateCatalog(null).errors.length > 0);
  assert.ok(validateCatalog({ schemaVersion: 1, categories: [], apps: 'x' }).errors.length > 0);
});

console.log(`\n${n} tests réussis.`);
