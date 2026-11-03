// Utilitaires d'affichage. Tout le texte passe par textContent : jamais d'innerHTML sur des données.

/** Crée un élément. h('a', {href:'#/'}, 'texte', autreNoeud) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const mo = bytes / (1024 * 1024);
  return mo >= 1 ? `${mo.toFixed(mo >= 100 ? 0 : 1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Minuscules sans accents, pour la recherche instantanée. */
export function normalize(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function isAndroid() {
  return /android/i.test(navigator.userAgent || '');
}
