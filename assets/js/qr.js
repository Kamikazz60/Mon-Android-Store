/**
 * Générateur de QR code (mode octets, versions 1 à 10, niveaux de correction L/M/Q/H).
 * Aucune dépendance, aucun accès au DOM : utilisable dans le navigateur et dans Node.
 *
 * qrMatrix(texte, niveau = 'M') -> { size, version, modules: boolean[][] }  (modules[y][x], true = noir)
 * qrSvgPath(matrice, marge = 4)  -> { viewBox, d }  chemin SVG unique pour tous les modules noirs
 *
 * Algorithme standard ISO/IEC 18004 (Reed-Solomon sur GF(256), 8 masques, pénalités de choix du masque).
 * Vérifié par décodage avec un décodeur indépendant (voir scripts/test.mjs).
 */

const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
// Index = numéro de version (0 inutilisé).
const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const NUM_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
const MAX_VERSION = 10;

const bit = (value, i) => ((value >>> i) & 1) !== 0;

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (version, ecl) =>
  Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[ecl][version] * NUM_BLOCKS[ecl][version];

function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

/** Données + terminateur + remplissage -> octets de données. */
function buildDataCodewords(bytes, version, ecl) {
  const capacityBits = dataCodewords(version, ecl) * 8;
  const bits = [];
  const push = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4); // mode octets
  push(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return out;
}

/* ----- Reed-Solomon sur GF(256), polynôme 0x11D ----- */
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
  }
  return result;
}

function addEccAndInterleave(data, version, ecl) {
  const numBlocks = NUM_BLOCKS[ecl][version];
  const blockEccLen = ECC_PER_BLOCK[ecl][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks = [];
  const divisor = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const chunk = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(chunk, divisor);
    if (i < numShortBlocks) chunk.push(0); // place réservée pour l'alignement des blocs courts
    blocks.push(chunk.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

/* ----- Construction de la matrice ----- */
function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function makeGrid(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function buildFunctionPatterns(version) {
  const size = version * 4 + 17;
  const modules = makeGrid(size);
  const isFunction = makeGrid(size);
  const setFunction = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };

  for (let i = 0; i < size; i++) { setFunction(6, i, i % 2 === 0); setFunction(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx; const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

  const align = alignmentPositions(version);
  const last = align.length - 1;
  align.forEach((ax, i) => align.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) setFunction(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, bit(bits, i)); setFunction(b, a, bit(bits, i));
    }
  }
  return { size, modules, isFunction, setFunction };
}

function drawFormatBits(grid, ecl, mask) {
  const { size, setFunction } = grid;
  const data = (ECC_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) setFunction(8, i, bit(bits, i));
  setFunction(8, 7, bit(bits, 6)); setFunction(8, 8, bit(bits, 7)); setFunction(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(bits, i));
  setFunction(8, size - 8, true); // module sombre fixe
}

function drawCodewords(grid, codewords) {
  const { size, modules, isFunction } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid, mask) {
  const { size, modules, isFunction } = grid;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
  }
}

/** Pénalité du motif (règles 1 à 4 de la norme) : plus elle est faible, plus le code se lit facilement. */
function penalty({ size, modules }) {
  let total = 0;
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(modules[i]);
    lines.push(modules.map((row) => row[i]));
  }
  for (const line of lines) {
    let run = 1;
    for (let k = 1; k <= size; k++) {
      if (k < size && line[k] === line[k - 1]) run++;
      else { if (run >= 5) total += 3 + (run - 5); run = 1; }
    }
    const s = line.map((v) => (v ? '1' : '0')).join('');
    for (const pattern of ['10111010000', '00001011101']) {
      for (let at = s.indexOf(pattern); at !== -1; at = s.indexOf(pattern, at + 1)) total += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) total += 3;
    }
  }
  const dark = modules.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  total += 10 * (Math.ceil(Math.abs(percent - 50) / 5) - 1 > 0 ? Math.ceil(Math.abs(percent - 50) / 5) - 1 : 0);
  return total;
}

export function qrMatrix(text, ecl = 'M') {
  if (!(ecl in ECC_FORMAT_BITS)) throw new Error(`Niveau de correction inconnu : ${ecl}`);
  const bytes = utf8Bytes(text);
  let version = 1;
  for (;; version++) {
    if (version > MAX_VERSION) throw new Error('Texte trop long pour ce générateur de QR code');
    const needed = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= dataCodewords(version, ecl) * 8) break;
  }
  const codewords = addEccAndInterleave(buildDataCodewords(bytes, version, ecl), version, ecl);
  const grid = buildFunctionPatterns(version);
  drawFormatBits(grid, 'L', 0); // réserve les zones de format avant de placer les données
  drawCodewords(grid, codewords);

  let best = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(grid, mask);
    drawFormatBits(grid, ecl, mask);
    const p = penalty(grid);
    if (p < bestPenalty) { best = mask; bestPenalty = p; }
    applyMask(grid, mask); // annule le masque
  }
  applyMask(grid, best);
  drawFormatBits(grid, ecl, best);
  return { size: grid.size, version, modules: grid.modules };
}

/** Chemin SVG unique (un carré 1×1 par module noir) + cadre blanc de `margin` modules. */
export function qrSvgPath({ size, modules }, margin = 4) {
  const parts = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (modules[y][x]) parts.push(`M${x + margin} ${y + margin}h1v1h-1z`);
  }
  const full = size + margin * 2;
  return { viewBox: `0 0 ${full} ${full}`, d: parts.join(''), full };
}
