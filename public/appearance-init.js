// Runs before the application and stylesheet to avoid a light first frame.
(function () {
  var preference = 'system';
  try {
    var saved = localStorage.getItem('wows-appearance');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch (_) { /* Storage may be unavailable in private/restricted contexts. */ }
  var theme = preference === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  document.documentElement.dataset.appearance = preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0b1524' : '#edf3f9');
})();
