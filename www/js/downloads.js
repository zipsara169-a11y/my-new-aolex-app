import { supabase, supabaseConfigured, escapeHtml } from './shared.js';
const safeUrl = value => {
  try { const u = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
};
async function loadDownloadButtons() {
  const host = document.getElementById('downloadButtonsSlot');
  if (!host || !supabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from('site_download_buttons')
      .select('id,name,button_text,target_url,is_active,sort_order,created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return;
    const rows = data.filter(row => safeUrl(row.target_url));
    host.replaceChildren();
    rows.forEach(row => {
      const link = document.createElement('a');
      link.className = 'download-button';
      link.href = safeUrl(row.target_url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = `<span aria-hidden="true">↓</span><span>${escapeHtml(row.button_text || row.name || 'Download')}</span><b aria-hidden="true">↗</b>`;
      host.appendChild(link);
    });
    host.classList.toggle('hidden', rows.length === 0);
  } catch (_) { /* Download management must never block title playback. */ }
}
loadDownloadButtons();
