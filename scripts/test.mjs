#!/usr/bin/env node
// Tests automatiques du validateur de catalogue (aucune dépendance : node:assert).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateCatalog, compareVersions } from '../assets/js/validate.js';
import { qrMatrix, qrSvgPath } from '../assets/js/qr.js';

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
  Object.assign(firstApp(c).security, { verdict: 'aucun-point-bloquant', lastAudit: null });
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

test('adresse du store : https accepté, http et javascript: refusés', () => {
  const c = clone();
  assert.ok(typeof c.store.url === 'string');
  assert.deepEqual(validateCatalog(c).errors, []);
  for (const bad of ['http://exemple.org/', 'javascript:alert(1)', 'https://a b.org', 42]) {
    const d = clone(); d.store.url = bad;
    assert.ok(validateCatalog(d).errors.some((e) => e.includes('store.url')), String(bad));
  }
});

// QR code : la vraie preuve de lisibilité est un décodage avec un décodeur indépendant (jsQR),
// fait lors du développement ; ici on garde des garde-fous de non-régression sans dépendance.
const matrixHash = (m) => createHash('sha256').update(m.modules.map((r) => r.map((v) => (v ? '1' : '0')).join('')).join('\n')).digest('hex');

test('QR code du store : version 4, 33×33, motif inchangé', () => {
  const m = qrMatrix(real.store.url, 'M');
  assert.equal(m.version, 4);
  assert.equal(m.size, 33);
  assert.equal(matrixHash(m), '6a0edaa057eceb93e731e48d25ceaf54731c8267321bdf777579d41ccaec3e6a');
});

test('QR code : repères d’angle, module sombre fixe, déterminisme', () => {
  const m = qrMatrix('https://exemple.org/', 'Q');
  const dark = (x, y) => m.modules[y][x];
  for (const [ox, oy] of [[0, 0], [m.size - 7, 0], [0, m.size - 7]]) {
    assert.ok(dark(ox, oy) && dark(ox + 6, oy + 6) && dark(ox + 3, oy + 3), 'repère');
    assert.ok(!dark(ox + 1, oy + 1) && !dark(ox + 5, oy + 5), 'anneau clair du repère');
  }
  assert.ok(dark(8, m.size - 8), 'module sombre fixe');
  assert.equal(matrixHash(qrMatrix('https://exemple.org/', 'Q')), matrixHash(m));
});

test('QR code : la version augmente avec la longueur, texte trop long refusé', () => {
  assert.ok(qrMatrix('a'.repeat(10), 'M').version < qrMatrix('a'.repeat(120), 'M').version);
  assert.throws(() => qrMatrix('a'.repeat(500), 'M'), /trop long/);
  assert.throws(() => qrMatrix('a', 'Z'), /Niveau/);
  const { d } = qrSvgPath(qrMatrix('a', 'L'));
  assert.ok(d.startsWith('M') && d.includes('h1v1h-1z'));
});

console.log(`\n${n} tests réussis.`);
