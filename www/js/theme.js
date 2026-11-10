import { supabase, supabaseConfigured } from './shared.js';

const themeKey = 'aplex-movies-theme';
const supportedThemes = new Set(['ruby', 'ocean', 'violet', 'emerald', 'halloween', 'christmas', 'valentines', 'newyear', 'easter', 'summer']);
let chosenTheme = 'ruby';
let userChangedTheme = false;
function applyTheme(theme, { saveLocal = true } = {}) {
  chosenTheme = supportedThemes.has(theme) ? theme : 'ruby';
  document.body.dataset.theme = chosenTheme;
  document.querySelectorAll('[data-theme-control]').forEach(control => { control.value = chosenTheme; });
  if (saveLocal) { try { localStorage.setItem(themeKey, chosenTheme); } catch (_) {} }
}
try {
  const saved = localStorage.getItem(themeKey);
  if (supportedThemes.has(saved)) chosenTheme = saved;
} catch (_) {}
applyTheme(chosenTheme, { saveLocal: false });
// The admin selection is saved to Supabase; public pages read the shared value on load.
document.querySelectorAll('[data-theme-control]').forEach(control => {
  control.addEventListener('change', () => {
    userChangedTheme = true;
    applyTheme(control.value);
  });
});
async function loadGlobalTheme() {
  if (!supabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'active_theme').maybeSingle();
    if (!error && supportedThemes.has(data?.setting_value) && !userChangedTheme) applyTheme(data.setting_value);
  } catch (_) { /* Existing installations can continue with the locally cached theme until migrated. */ }
}
loadGlobalTheme();

if (!document.querySelector('.aplex-splash')) {
  const splash = document.createElement('div');
  splash.className = 'aplex-splash';
  splash.setAttribute('role', 'status');
  splash.setAttribute('aria-label', 'APLEX Movies is loading');
  splash.innerHTML = '<div class="splash-orbit"><img class="splash-mark-image" src="assets/favicon.png" alt="" width=88 height=88></div><div class="splash-title">APLEX <b>MOVIES</b></div><p>YOUR NEXT WATCH STARTS HERE</p><div class="splash-progress"><span></span></div>';
  document.body.appendChild(splash);
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    splash.classList.add('splash-hidden');
    window.setTimeout(() => splash.remove(), 650);
  };
  window.addEventListener('load', () => window.setTimeout(dismiss, 280), { once: true });
  window.setTimeout(dismiss, 1800);
}
