// Point d'entrée : chargement + validation du catalogue, routage par hash, thème.
import { h } from './dom.js';
import { validateCatalog } from './validate.js';
import { homeView, detailView, howView, securityView, notFoundView, dockFor } from './views.js';

const app = document.getElementById('app');
const state = { query: '', category: '', sort: 'recent' };
let catalog = null;

async function loadCatalog() {
  const res = await fetch('data/catalog.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { catalog: valid, errors } = validateCatalog(await res.json());
  // Les applications invalides sont écartées ; les erreurs vont dans la console du navigateur.
  errors.forEach((e) => console.warn('[catalogue]', e));
  return { valid, errors };
}

function render() {
  if (!catalog) return;
  const route = (location.hash.replace(/^#\/?/, '') || '').split('/');
  document.body.classList.remove('has-dock');
  document.querySelector('.dock')?.remove();
  let view;
  let name = 'home';
  let title = 'Ruche — Applications Android';

  if (route[0] === '' ) view = homeView(catalog, state, render);
  else if (route[0] === 'app' && route[1]) {
    name = 'app';
    view = detailView(catalog, decodeURIComponent(route[1]));
    const a = catalog.apps.find((x) => x.id === route[1]);
    if (a) {
      title = `${a.name} — Ruche`;
      const dock = dockFor(catalog, a.id);
      if (dock) { document.body.append(dock); document.body.classList.add('has-dock'); }
    }
  } else if (route[0] === 'fonctionnement') { name = route[0]; view = howView(); title = 'Fonctionnement — Ruche'; }
  else if (route[0] === 'securite') { name = route[0]; view = securityView(); title = 'Sécurité — Ruche'; }
  else view = notFoundView();

  document.title = title;
  app.replaceChildren(view);
  document.querySelectorAll('.nav a').forEach((a) =>
    a.dataset.route === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
}

let lastRoute = null;
function onRoute() {
  const key = location.hash;
  render();
  if (key !== lastRoute) { window.scrollTo(0, 0); lastRoute = key; }
}

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.getAttribute('data-theme') || (dark() ? 'dark' : 'light');
  const paint = () => { btn.textContent = current() === 'dark' ? '☀' : '☾'; btn.title = current() === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'; };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ruche-theme', next); } catch (e) { /* ignoré */ }
    paint();
  });
  paint();
}

async function start() {
  initTheme();
  try {
    const { valid, errors } = await loadCatalog();
    catalog = valid;
    const d = catalog.store.updated;
    if (d) document.getElementById('catalog-date').textContent = `Catalogue mis à jour le ${new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`;
    window.addEventListener('hashchange', onRoute);
    onRoute();
    if (errors.length) app.prepend(h('p', { class: 'notice warn' }, 'Une ou plusieurs fiches du catalogue contiennent une erreur et n’ont pas été affichées.'));
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'empty' }, h('h1', {}, 'Catalogue indisponible'), h('p', {}, 'Impossible de charger la liste des applications. Réessayez dans un instant.')));
  }
}
start();
