// Runs before first paint so the saved theme never flashes. Dark is the default.
try {
  var t = localStorage.getItem('levy.theme');
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
} catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
