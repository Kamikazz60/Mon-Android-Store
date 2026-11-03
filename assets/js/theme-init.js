// Appliqué avant l'affichage pour éviter un flash de thème. Préférence stockée localement uniquement.
(function () {
  try {
    var t = localStorage.getItem('ruche-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* stockage indisponible : thème du système */ }
})();
