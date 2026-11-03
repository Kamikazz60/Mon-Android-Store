// Vues : accueil, fiche d'application, pages statiques.
import { h, formatSize, formatDate, normalize, isAndroid } from './dom.js';
import { STATUSES, VERDICTS, compareVersions } from './validate.js';

const NEW_DAYS = 45;
const verdictClass = { 'non-audite': 'warn', 'aucun-point-bloquant': 'ok', 'points-de-vigilance': 'warn', critique: 'bad' };
const statusClass = { disponible: 'ok', 'en-developpement': '', suspendue: 'warn', abandonnee: 'bad' };

const categoryLabel = (catalog, id) => catalog.categories.find((c) => c.id === id)?.label ?? id;
const byDateDesc = (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '');
const isDownloadable = (app) => app.status === 'disponible' && app.apk && !app.security.blocked;

function appIcon(app, cls = 'app-icon') {
  return h('img', { class: cls, src: app.icon, alt: '', width: 64, height: 64, loading: 'lazy' });
}

function appCard(catalog, app) {
  return h('a', { class: 'card', href: `#/app/${app.id}` },
    h('div', { class: 'card-top' },
      appIcon(app),
      h('div', {}, h('h3', {}, app.name), h('p', {}, app.shortDescription))),
    h('div', { class: 'meta' },
      app.version ? h('span', { class: 'badge' }, `v${app.version}`) : null,
      h('span', { class: 'badge' }, categoryLabel(catalog, app.category)),
      h('span', { class: `badge ${statusClass[app.status]}` }, STATUSES[app.status]),
      app.security.verdict === 'non-audite' && app.status === 'disponible'
        ? h('span', { class: 'badge warn' }, 'Non audité') : null));
}

function section(title, content, sub) {
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', {}, title), sub ? h('span', { class: 'muted' }, sub) : null),
    content);
}

/* ---------- Accueil ---------- */
export function homeView(catalog, state, rerender) {
  const root = h('div');
  root.append(h('div', { class: 'hero' },
    h('h1', {}, catalog.store.name ? `${catalog.store.name}, le store d'applications de Doanh` : 'Applications Android'),
    h('p', {}, catalog.store.tagline || '')));

  const results = h('div');
  const search = h('input', {
    type: 'search', placeholder: 'Rechercher une application…', 'aria-label': 'Rechercher une application',
    autocomplete: 'off', value: state.query,
    oninput: (e) => { state.query = e.target.value; renderResults(); },
  });
  root.append(h('div', { class: 'search' }, search));

  const chips = h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Filtrer par catégorie' });
  const sort = h('select', {
    'aria-label': 'Trier', onchange: (e) => { state.sort = e.target.value; renderResults(); },
  }, [['recent', 'Plus récentes'], ['nom', 'Nom (A–Z)'], ['categorie', 'Catégorie']].map(
    ([v, l]) => h('option', { value: v, selected: state.sort === v }, l)));

  function drawChips() {
    chips.replaceChildren(
      ...[{ id: '', label: 'Toutes' }, ...catalog.categories].map((c) =>
        h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(state.category === c.id),
          onclick: () => { state.category = c.id; drawChips(); renderResults(); },
        }, c.label)),
      sort);
  }
  drawChips();
  root.append(chips, results);

  function renderResults() {
    const q = normalize(state.query.trim());
    let apps = catalog.apps.filter((a) =>
      (!state.category || a.category === state.category) &&
      (!q || normalize([a.name, a.shortDescription, a.description, categoryLabel(catalog, a.category)].join(' ')).includes(q)));
    const filtering = Boolean(q || state.category);

    if (state.sort === 'nom') apps = [...apps].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    else if (state.sort === 'categorie') apps = [...apps].sort((a, b) => categoryLabel(catalog, a.category).localeCompare(categoryLabel(catalog, b.category), 'fr') || a.name.localeCompare(b.name, 'fr'));
    else apps = [...apps].sort(byDateDesc);

    results.replaceChildren();
    if (apps.length === 0) {
      results.append(h('p', { class: 'empty-results' }, 'Aucune application ne correspond à votre recherche.'));
      return;
    }
    const available = apps.filter((a) => a.status === 'disponible');
    const dev = apps.filter((a) => a.status === 'en-developpement');
    const other = apps.filter((a) => a.status === 'suspendue' || a.status === 'abandonnee');

    if (!filtering) {
      const recent = [...available].sort(byDateDesc).slice(0, 3);
      if (recent.length) results.append(section('Dernières mises à jour',
        h('div', { class: 'grid' }, recent.map((a) => appCard(catalog, a))), 'Les plus récemment publiées'));
      const limit = Date.now() - NEW_DAYS * 86400000;
      const fresh = [...available].sort(byDateDesc).filter((a) => new Date(a.releaseDate).getTime() >= limit);
      results.append(section('Nouveautés', fresh.length
        ? h('div', { class: 'news' }, fresh.map((a) => newsItem(a)))
        : h('p', { class: 'muted' }, `Aucune nouveauté depuis ${NEW_DAYS} jours.`)));
    }
    if (available.length) results.append(section('Applications disponibles',
      h('div', { class: 'grid' }, available.map((a) => appCard(catalog, a))), `${available.length}`));
    if (dev.length || !filtering) results.append(section('En développement', dev.length
      ? h('div', { class: 'grid' }, dev.map((a) => appCard(catalog, a)))
      : h('p', { class: 'muted' }, 'Aucun projet en développement pour le moment.')));
    if (other.length) results.append(section('Suspendues ou abandonnées', h('div', { class: 'grid' }, other.map((a) => appCard(catalog, a)))));
  }
  renderResults();
  return root;
}

function newsItem(app) {
  const current = app.versions.find((v) => v.version === app.version);
  return h('a', { class: 'news-item', href: `#/app/${app.id}` },
    appIcon(app),
    h('div', {},
      h('strong', {}, `${app.name} ${app.version}`), ' ',
      h('span', { class: 'muted' }, `— ${formatDate(app.releaseDate)}`),
      current ? h('ul', {}, current.notes.slice(0, 2).map((n) => h('li', {}, n))) : null));
}

/* ---------- Fiche d'application ---------- */
export function detailView(catalog, id) {
  const app = catalog.apps.find((a) => a.id === id);
  if (!app) return notFoundView('Application introuvable.');
  const sec = app.security;
  const ok = isDownloadable(app);
  const root = h('div');

  root.append(h('p', { class: 'crumbs muted' }, h('a', { href: '#/' }, 'Accueil'), ' › ', app.name));
  root.append(h('div', { class: 'detail-head' },
    appIcon(app),
    h('div', {},
      h('h1', {}, app.name),
      h('p', { class: 'muted' }, app.shortDescription),
      h('div', { class: 'meta' },
        h('span', { class: 'badge' }, categoryLabel(catalog, app.category)),
        h('span', { class: `badge ${statusClass[app.status]}` }, STATUSES[app.status]),
        h('span', { class: `badge ${verdictClass[sec.verdict]}` }, VERDICTS[sec.verdict])))));

  root.append(h('div', { class: 'detail-actions' }, downloadButton(app, ok),
    h('a', { class: 'btn secondary', href: app.repository, target: '_blank', rel: 'noopener noreferrer' }, 'Dépôt GitHub')));
  if (ok) root.append(h('p', { class: 'muted' }, `Fichier APK · ${formatSize(app.apk.sizeBytes)} · téléchargement direct depuis GitHub`));

  if (sec.blocked) root.append(h('div', { class: 'notice bad' }, h('strong', {}, 'Téléchargement bloqué. '), 'Un problème de sécurité a été relevé sur cette application : elle ne doit pas être installée.'));
  else if (app.status === 'disponible' && sec.verdict === 'non-audite') root.append(h('div', { class: 'notice warn' }, h('strong', {}, 'Audit de sécurité non réalisé. '), 'Cette application n’a pas encore passé le contrôle de sécurité du store. Installez-la en connaissance de cause (voir la page Sécurité).'));
  if (app.status === 'suspendue' || app.status === 'abandonnee') root.append(h('div', { class: 'notice warn' }, `Cette application est ${STATUSES[app.status].toLowerCase()} : aucune mise à jour n'est prévue.`));
  if (app.status === 'en-developpement') root.append(h('div', { class: 'notice' }, 'Cette application est en cours de développement : pas encore de téléchargement.'));

  root.append(h('div', { class: 'infos' },
    info('Version', app.version ? `v${app.version}` : '—'),
    info('Publication', formatDate(app.releaseDate)),
    info('Taille', app.apk ? formatSize(app.apk.sizeBytes) : '—'),
    info('Android', `${app.minAndroid} ou plus récent`)));

  root.append(h('div', { class: 'panel prose' }, h('h2', {}, 'À propos'), app.description.split(/\n{2,}/).map((p) => h('p', {}, p))));

  root.append(h('div', { class: 'panel' }, h('h2', {}, 'Captures d’écran'),
    app.screenshots.length
      ? h('div', { class: 'shots' }, app.screenshots.map((s) => h('img', { src: s.src, alt: s.alt, loading: 'lazy' })))
      : h('p', { class: 'muted' }, 'Pas encore de capture d’écran pour cette application.')));

  root.append(h('div', { class: 'panel' }, h('h2', {}, 'Fonctionnalités principales'),
    app.features.length ? h('ul', {}, app.features.map((f) => h('li', {}, f))) : h('p', { class: 'muted' }, 'Non renseignées.')));

  const current = app.versions.find((v) => v.version === app.version);
  if (current) root.append(h('div', { class: 'panel' }, h('h2', {}, `Nouveautés de la version ${current.version}`), h('ul', {}, current.notes.map((n) => h('li', {}, n)))));

  root.append(h('div', { class: 'panel' }, h('h2', {}, 'Compatibilité'), h('p', {}, app.compatibility)));

  root.append(h('div', { class: 'panel' }, h('h2', {}, 'Permissions demandées'),
    app.permissions.length
      ? h('ul', { class: 'perm' }, app.permissions.map((p) => h('li', {}, h('strong', {}, p.name), h('br'), h('span', { class: 'muted' }, p.reason))))
      : h('p', {}, 'Aucune permission particulière déclarée.')));

  root.append(securityPanel(app));
  root.append(installPanel(app, ok));
  root.append(historyPanel(app));
  return root;
}

function info(label, value) { return h('div', { class: 'info' }, h('b', {}, label), value); }

function downloadButton(app, ok, extra = '') {
  if (ok) {
    return h('a', { class: `btn ${extra}`, href: app.apk.url, rel: 'noopener noreferrer', download: '' }, `⬇ Télécharger v${app.version}`);
  }
  const label = app.status === 'en-developpement' ? 'Bientôt disponible' : 'Téléchargement indisponible';
  return h('a', { class: `btn ${extra}`, href: '#', 'aria-disabled': 'true', tabindex: '-1', onclick: (e) => e.preventDefault() }, label);
}

function securityPanel(app) {
  const s = app.security;
  const rows = [h('p', {}, h('span', { class: `badge ${verdictClass[s.verdict]}` }, VERDICTS[s.verdict]))];
  if (s.verdict === 'non-audite') rows.push(h('p', {}, 'Aucun audit n’a encore été réalisé sur cette application.'));
  else rows.push(h('p', {}, `Dernier audit : ${formatDate(s.lastAudit)} · version auditée : ${s.auditedVersion}.`));
  if (s.points.length) rows.push(h('ul', {}, s.points.map((p) => h('li', {}, p))));
  if (app.securityNotes.length) rows.push(h('ul', {}, app.securityNotes.map((n) => h('li', {}, n))));
  if (app.apk?.sha256) rows.push(h('p', {}, 'Empreinte SHA-256 de l’APK :', h('br'), h('span', { class: 'hash' }, app.apk.sha256)));
  rows.push(h('p', { class: 'muted' }, 'Un audit automatisé ne prouve pas qu’une application est parfaitement sûre. ', h('a', { href: '#/securite' }, 'En savoir plus')));
  return h('div', { class: 'panel' }, h('h2', {}, 'Contrôle de sécurité'), rows);
}

function installPanel(app, ok) {
  const intro = isAndroid()
    ? 'Vous êtes sur Android : touchez « Télécharger », puis ouvrez le fichier.'
    : 'Ouvrez cette page depuis votre téléphone Android (ou transférez l’APK sur le téléphone) pour installer l’application.';
  return h('div', { class: 'panel' }, h('h2', {}, 'Installation'), h('p', {}, intro),
    h('ol', {},
      h('li', {}, ok ? 'Téléchargez l’APK avec le bouton ci-dessus.' : 'Le téléchargement n’est pas disponible pour le moment.'),
      h('li', {}, 'Ouvrez le fichier depuis la notification de téléchargement ou l’application « Fichiers ».'),
      h('li', {}, 'Si Android affiche « Pour votre sécurité, l’installation depuis cette source est bloquée », touchez « Paramètres » puis autorisez l’installation pour votre navigateur (ou votre gestionnaire de fichiers) seulement.'),
      h('li', {}, 'Revenez en arrière et touchez « Installer ». Si Google Play Protect propose une analyse, acceptez-la.'),
      h('li', {}, 'Pour une mise à jour, installez simplement la nouvelle version par-dessus l’ancienne : vos données sont conservées.'),
      h('li', {}, 'Une fois installée, vous pouvez retirer l’autorisation d’installation donnée au navigateur.')));
}

function historyPanel(app) {
  const versions = [...app.versions].sort((a, b) => compareVersions(b.version, a.version));
  return h('div', { class: 'panel' }, h('h2', {}, 'Historique des versions'),
    versions.map((v, i) => h('details', { class: 'version', open: i === 0 }, h('summary', {}, `v${v.version} — ${formatDate(v.date)}`),
      h('ul', {}, v.notes.map((n) => h('li', {}, n))),
      v.sizeBytes ? h('p', { class: 'muted' }, `Taille : ${formatSize(v.sizeBytes)}`) : null,
      v.sha256 ? h('p', { class: 'hash muted' }, `SHA-256 : ${v.sha256}`) : null,
      v.apkUrl && !app.security.blocked ? h('a', { class: 'btn secondary small', href: v.apkUrl, rel: 'noopener noreferrer', download: '' }, 'Télécharger cette version') : null)));
}

/** Barre de téléchargement fixe sur mobile. */
export function dockFor(catalog, id) {
  const app = catalog.apps.find((a) => a.id === id);
  if (!app) return null;
  return h('div', { class: 'dock' }, appIcon(app, 'app-icon dock-icon'), downloadButton(app, isDownloadable(app)));
}

/* ---------- Pages statiques ---------- */
export function notFoundView(message = 'Page introuvable.') {
  return h('div', { class: 'empty' }, h('h1', {}, message), h('p', {}, h('a', { class: 'btn', href: '#/' }, 'Retour au catalogue')));
}

export function howView() {
  return h('div', { class: 'prose' },
    h('h1', {}, 'Comment fonctionne Ruche ?'),
    h('p', {}, 'Ruche est un petit catalogue personnel d’applications Android. Ce n’est pas Google Play : c’est un site statique hébergé gratuitement sur GitHub Pages, sans serveur, sans compte et sans publicité.'),
    h('h2', {}, 'D’où viennent les fichiers ?'),
    h('p', {}, 'Chaque application a son propre dépôt GitHub. Son APK est publié dans les « Releases » de ce dépôt. Ruche ne stocke aucun APK : le bouton Télécharger pointe directement vers le fichier sur GitHub.'),
    h('h2', {}, 'Comment installer une application ?'),
    h('ol', {},
      h('li', {}, 'Ouvrez la fiche de l’application depuis votre téléphone Android.'),
      h('li', {}, 'Touchez « Télécharger », puis ouvrez le fichier téléchargé.'),
      h('li', {}, 'Autorisez l’installation depuis cette source si Android le demande, puis touchez « Installer ».')),
    h('h2', {}, 'Et mes données ?'),
    h('p', {}, 'Ruche ne collecte rien : pas de cookie, pas de statistique, pas de compte. Seul votre choix de thème (clair/sombre) est mémorisé dans votre navigateur. C’est aussi pour cela qu’il n’y a pas de section « populaires », de notes ni de commentaires : ils exigeraient un serveur ou du pistage.'),
    h('h2', {}, 'Mises à jour'),
    h('p', {}, 'Quand une nouvelle version sort, la fiche est mise à jour et le bouton pointe vers la nouvelle version. Ruche n’installe rien automatiquement : revenez sur la fiche pour récupérer la dernière version.'));
}

export function securityView() {
  return h('div', { class: 'prose' },
    h('h1', {}, 'Sécurité et conditions d’utilisation'),
    h('p', {}, 'Ces applications sont développées à titre personnel et fournies telles quelles, sans garantie. Vous les installez à vos propres risques.'),
    h('h2', {}, 'Ce que fait le store pour vous protéger'),
    h('ul', {},
      h('li', {}, 'Chaque fiche affiche un contrôle de sécurité : date du dernier audit, version auditée, résultat et points de vigilance.'),
      h('li', {}, 'Une application présentant une vulnérabilité critique ou des secrets exposés est bloquée : son téléchargement est désactivé.'),
      h('li', {}, 'Les liens de téléchargement ne pointent que vers les Releases GitHub du dépôt de l’application.'),
      h('li', {}, 'Une empreinte SHA-256 est affichée quand elle est connue, pour vérifier l’intégrité du fichier.'),
      h('li', {}, 'Le site n’utilise aucun script, police ou image tiers, ni cookie, ni statistique.')),
    h('h2', {}, 'Ce que cela ne garantit pas'),
    h('p', {}, 'Un audit, surtout automatisé, ne prouve jamais qu’une application est parfaitement sûre. Les mentions « Audit non réalisé » signifient exactement cela : aucun contrôle n’a été fait.'),
    h('h2', {}, 'Vos bons réflexes'),
    h('ul', {},
      h('li', {}, 'Ne téléchargez que depuis ce site ou directement depuis les dépôts GitHub liés.'),
      h('li', {}, 'Lisez les permissions demandées et leur justification.'),
      h('li', {}, 'Comparez l’empreinte SHA-256 si vous voulez vérifier le fichier.'),
      h('li', {}, 'Ne donnez l’autorisation d’installer des applications qu’au navigateur ou au gestionnaire de fichiers que vous utilisez, et retirez-la ensuite.'),
      h('li', {}, 'Gardez Google Play Protect activé.')),
    h('h2', {}, 'Signaler un problème'),
    h('p', {}, 'Ouvrez un ticket sur le dépôt GitHub de l’application concernée ou sur celui du store.'));
}
