// Applies the color theme before first paint, so there is no light flash in dark mode.
// External file on purpose: the production CSP (script-src 'self') forbids inline scripts.
// Keep the storage key and values in sync with libs/ui/src/lib/tema/tema.service.ts.
(function () {
  var preference = null;
  try {
    preference = localStorage.getItem('halsa.tema');
  } catch (e) {
    // Storage blocked: fall back to the system preference.
  }
  var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = preference === 'dark' || (preference !== 'light' && systemDark);
  document.documentElement.classList.toggle('dark', dark);
})();
