import { supabase, supabaseConfigured, escapeHtml, showMessage, friendlyError } from './shared.js';

const $ = id => document.getElementById(id);
const themeNames = {
  ruby: 'Ruby Cinema', ocean: 'Ocean Blue', violet: 'Violet Night', emerald: 'Emerald',
  halloween: 'Halloween', christmas: 'Christmas', valentines: 'Valentine’s Day', newyear: 'New Year', easter: 'Easter / Spring', summer: 'Summer'
};
const themeDetails = {
  ruby: ['CLASSIC CINEMA', '✦', 'Classic ruby accents, cinematic dark surfaces and the original APLEX look.'],
  ocean: ['OCEAN BLUE', '◈', 'Cool blue highlights and deep ocean-night surfaces.'],
  violet: ['VIOLET NIGHT', '✧', 'Violet glow, soft purple highlights and a dreamy night-cinema mood.'],
  emerald: ['EMERALD', '✳', 'Fresh emerald accents with a clean, modern cinema look.'],
  halloween: ['SPOOKY SEASON', '🎃', 'Pumpkin orange, haunted purple and a subtle spooky-season atmosphere.'],
  christmas: ['HOLIDAY SEASON', '❄', 'Evergreen accents, festive red details and a winter-holiday atmosphere.'],
  valentines: ['LOVE & CINEMA', '♡', 'Romantic rose and pink accents for Valentine’s Day.'],
  newyear: ['NEW YEAR', '✨', 'Midnight blue with celebratory gold accents.'],
  easter: ['SPRING CELEBRATION', '🐣', 'Soft lilac and spring-pastel highlights.'],
  summer: ['SUMMER MODE', '🌴', 'Bright tropical aqua with a sunny, energetic feel.']
};
const supportedThemes = new Set(Object.keys(themeNames));
let downloadButtons = [];
let downloadsTableReady = false;
let downloadButtonSchemaReady = false;
$('year').textContent = new Date().getFullYear();
if (!supabaseConfigured || !supabase) {
  $('configWarning').textContent = 'js/config.js තුළ Supabase URL සහ public anon/publishable key පරීක්ෂා කරන්න.';
  $('configWarning').classList.remove('hidden');
}
const message = (id, text, type = 'info') => showMessage($(id), text, type);

function updateThemePreview(theme) {
  if (!supportedThemes.has(theme)) theme = 'ruby';
  const [tag, icon, detail] = themeDetails[theme];
  document.body.dataset.theme = theme;
  if ($('statTheme')) $('statTheme').textContent = themeNames[theme];
  if ($('themeDescription')) $('themeDescription').textContent = detail;
  if ($('themePreviewIcon')) $('themePreviewIcon').textContent = icon;
  if ($('themePreviewLabel')) $('themePreviewLabel').textContent = tag;
  if ($('themePreviewName')) $('themePreviewName').textContent = themeNames[theme];
  if ($('themePreviewCta')) $('themePreviewCta').textContent = `${tag} · EXPLORE LIBRARY ↗`;
}
function safeHttpUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
}
async function loadGlobalTheme() {
  if (!supabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'active_theme').maybeSingle();
    if (error) throw error;
    const theme = supportedThemes.has(data?.setting_value) ? data.setting_value : 'ruby';
    $('activeThemeSelect').value = theme;
    updateThemePreview(theme);
    $('themeMigrationNotice').classList.add('hidden');
  } catch (error) {
    $('themeMigrationNotice').classList.remove('hidden');
    message('themeSaveMessage', 'Global theme settings are not ready. Run supabase-theme-migration.sql once.', 'error');
  }
}
async function saveGlobalTheme(theme) {
  if (!supportedThemes.has(theme)) return;
  updateThemePreview(theme);
  // The theme module applies the selection immediately; this request persists it for every visitor.
  if (!supabaseConfigured || !supabase) {
    message('themeSaveMessage', 'Supabase configuration is missing. This preview is only local until settings are configured.', 'error');
    return;
  }
  $('activeThemeSelect').disabled = true;
  message('themeSaveMessage', 'Applying theme to the website…');
  try {
    const { error } = await supabase.from('site_settings').upsert({ setting_key: 'active_theme', setting_value: theme, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' });
    if (error) throw error;
    $('themeMigrationNotice').classList.add('hidden');
    message('themeSaveMessage', `Saved! ${themeNames[theme]} is now the website theme for all visitors.`, 'success');
  } catch (error) {
    $('themeMigrationNotice').classList.remove('hidden');
    message('themeSaveMessage', `Could not save the global theme. Run supabase-theme-migration.sql if this is an existing project. ${friendlyError(error)}`, 'error');
  } finally { $('activeThemeSelect').disabled = false; }
}
function renderDownloadButtons() {
  $('downloadsCount').textContent = `${downloadButtons.length} button${downloadButtons.length === 1 ? '' : 's'}`;
  $('statDownloads').textContent = String(downloadButtons.length);
  $('statActiveDownloads').textContent = String(downloadButtons.filter(row => row.is_active).length);
  $('downloadButtonsList').innerHTML = downloadButtons.length ? downloadButtons.map(row => `<article class="download-admin-row">
    <div class="download-status-mark ${row.is_active ? 'is-on' : 'is-off'}">${row.is_active ? 'ON' : 'OFF'}</div>
    <div class="download-admin-info"><strong>${escapeHtml(row.button_text || row.name || 'Download')}</strong><span>${escapeHtml(row.name || 'Download link')} · order ${Number(row.sort_order || 0)}</span><small>${escapeHtml(row.target_url || '')} · ${row.is_active ? '<i class="status-published">Enabled</i>' : '<i class="status-draft">Disabled</i>'}</small></div>
    <div class="row-actions"><button class="small-outline" type="button" data-download-edit="${escapeHtml(row.id)}">Edit</button><button class="small-outline" type="button" data-download-toggle="${escapeHtml(row.id)}">${row.is_active ? 'Disable' : 'Enable'}</button><button class="small-outline danger-button" type="button" data-download-delete="${escapeHtml(row.id)}">Delete</button></div>
  </article>`).join('') : '<div class="no-items">No download buttons yet. Add one to display a themed download button below the player.</div>';
}
async function loadDownloadButtons() {
  try {
    let result = await supabase.from('site_download_buttons').select('id,name,button_text,target_url,is_active,sort_order,created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (result.error) throw result.error;
    downloadsTableReady = true;
    downloadButtons = result.data || [];
    const schema = await supabase.from('site_download_buttons').select('button_text').limit(1);
    downloadButtonSchemaReady = !schema.error;
    $('downloadsMigrationNotice').classList.toggle('hidden', downloadButtonSchemaReady);
    renderDownloadButtons();
    return true;
  } catch (error) {
    downloadsTableReady = false;
    $('downloadsMigrationNotice').classList.remove('hidden');
    $('downloadButtonsList').innerHTML = '<div class="no-items">The download-button database fields are not ready. Run supabase-clean-ads.sql and reload.</div>';
    $('downloadsCount').textContent = 'Setup needed';
    $('statDownloads').textContent = '—';
    $('statActiveDownloads').textContent = '—';
    return false;
  }
}
function openDownloadEditor(row = null) {
  $('downloadEditorTitle').textContent = row ? 'Edit download button' : 'Add download button';
  $('downloadId').value = row?.id || '';
  $('downloadName').value = row?.name || '';
  $('downloadButtonText').value = row?.button_text || '';
  $('downloadTargetUrl').value = row?.target_url || '';
  $('downloadActive').checked = row ? Boolean(row.is_active) : true;
  $('downloadOrder').value = row?.sort_order ?? 0;
  message('downloadEditorMessage', '');
  $('downloadEditorSection').classList.remove('hidden');
  $('downloadEditorSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function closeDownloadEditor() {
  $('downloadEditorSection').classList.add('hidden');
  $('downloadForm').reset();
  $('downloadId').value = '';
  $('downloadActive').checked = true;
  $('downloadOrder').value = '0';
  message('downloadEditorMessage', '');
}
async function saveDownloadButton(event) {
  event.preventDefault();
  if (!supabaseConfigured || !supabase) { message('downloadEditorMessage', 'Supabase settings are missing in js/config.js.', 'error'); return; }
  if (!downloadsTableReady || !downloadButtonSchemaReady) { message('downloadEditorMessage', 'Run supabase-clean-ads.sql in Supabase SQL Editor, then reload.', 'error'); return; }
  const name = $('downloadName').value.trim();
  const buttonText = $('downloadButtonText').value.trim();
  const targetUrl = safeHttpUrl($('downloadTargetUrl').value.trim());
  if (!name || !buttonText || !targetUrl) { message('downloadEditorMessage', 'Name, button text and a valid http(s) download URL are required.', 'error'); return; }
  const rawOrder = Number($('downloadOrder').value || 0);
  const payload = { name, button_text: buttonText, target_url: targetUrl, is_active: $('downloadActive').checked, sort_order: Number.isFinite(rawOrder) ? Math.trunc(rawOrder) : 0, updated_at: new Date().toISOString() };
  $('saveDownloadBtn').disabled = true;
  message('downloadEditorMessage', 'Saving download button…');
  try {
    const result = $('downloadId').value
      ? await supabase.from('site_download_buttons').update(payload).eq('id', $('downloadId').value).select('id').single()
      : await supabase.from('site_download_buttons').insert(payload).select('id').single();
    if (result.error) throw result.error;
    message('downloadEditorMessage', 'Download button saved.', 'success');
    await loadDownloadButtons();
    window.setTimeout(closeDownloadEditor, 350);
  } catch (error) { message('downloadEditorMessage', friendlyError(error), 'error'); }
  finally { $('saveDownloadBtn').disabled = false; }
}
async function toggleDownload(id) {
  const row = downloadButtons.find(item => item.id === id);
  if (!row) return;
  const { error } = await supabase.from('site_download_buttons').update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { message('downloadsListMessage', friendlyError(error), 'error'); return; }
  message('downloadsListMessage', `Download button ${row.is_active ? 'disabled' : 'enabled'}.`, 'success');
  await loadDownloadButtons();
}
async function deleteDownload(id) {
  const row = downloadButtons.find(item => item.id === id);
  if (!row || !confirm(`Delete download button “${row.button_text || row.name}”? This cannot be undone.`)) return;
  const { error } = await supabase.from('site_download_buttons').delete().eq('id', id);
  if (error) { message('downloadsListMessage', friendlyError(error), 'error'); return; }
  message('downloadsListMessage', 'Download button deleted.', 'success');
  await loadDownloadButtons();
}

let titleMagnetRows = [];
let titleMagnetTableReady = false;
let ytsSearchMatches = [];
const ytsApiBase = 'https://movies-api.accel.li/api/v2';
const magnetTrackers = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.stealth.si:80/announce'
];
function validMagnetUri(value) {
  return /^magnet:\?xt=urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})(?:&|$)/i.test(String(value || '').trim());
}
function buildYtsMagnet(movie, torrent) {
  const hash = String(torrent?.hash || '').trim();
  if (!/^(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(hash)) return '';
  const dn = `${movie.title || 'Movie'}${movie.year ? ` (${movie.year})` : ''} ${torrent.quality || ''}`.trim();
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(dn)}${magnetTrackers.map(tr => `&tr=${encodeURIComponent(tr)}`).join('')}`;
}
function renderYtsResults(movies) {
  const host = $('ytsSearchResults');
  if (!movies.length) { host.innerHTML = '<p class="muted">No YTS matches found. Check the title or enter an authorized magnet URI manually.</p>'; return; }
  host.innerHTML = movies.map((movie, movieIndex) => {
    const torrents = Array.isArray(movie.torrents) ? movie.torrents : [];
    const torrentButtons = torrents.map((torrent, torrentIndex) => {
      const size = torrent.size || torrent.size_bytes ? (torrent.size || `${Math.round(Number(torrent.size_bytes) / 1024 / 1024 / 1024 * 10) / 10} GB`) : '';
      const label = `${torrent.quality || 'Torrent'}${torrent.type ? ` · ${torrent.type}` : ''}${size ? ` · ${size}` : ''}`;
      return `<button class="small-outline yts-quality-button" type="button" data-yts-movie="${movieIndex}" data-yts-torrent="${torrentIndex}">${escapeHtml(label)} · Select</button>`;
    }).join('');
    return `<article class="download-admin-row yts-result-card"><div class="download-admin-info"><strong>${escapeHtml(movie.title || 'Untitled')} (${escapeHtml(movie.year || 'Year n/a')})</strong><span>IMDb ${escapeHtml(movie.imdb_code || 'not listed')} · Rating ${escapeHtml(movie.rating ?? '—')}</span><small>${torrents.length ? `${torrents.length} torrent option${torrents.length === 1 ? '' : 's'}` : 'No torrent options listed'}</small><div class="yts-quality-list">${torrentButtons || '<span class="muted">No torrent qualities available.</span>'}</div></div></article>`;
  }).join('');
}
async function searchYtsMatches() {
  const mediaType = $('magnetMediaType').value;
  const title = $('magnetSearchTerm').value.trim() || $('magnetTitle').value.trim();
  if (mediaType !== 'movie') { message('ytsSearchMessage', 'YTS API search supports movies, not TV-show episode torrents. Paste an authorized TV magnet link manually.', 'error'); return; }
  if (!title) { message('ytsSearchMessage', 'Enter a movie title first.', 'error'); return; }
  const button = $('searchYtsBtn');
  button.disabled = true;
  $('ytsSearchResults').replaceChildren();
  message('ytsSearchMessage', 'Searching YTS for matching movie titles…');
  try {
    const url = new URL(`${ytsApiBase}/list_movies.json`);
    url.searchParams.set('query_term', title);
    url.searchParams.set('limit', '20');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let response;
    try { response = await fetch(url.toString(), { signal: controller.signal }); }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new Error(`YTS API responded with ${response.status}.`);
    const payload = await response.json();
    if (payload.status !== 'ok') throw new Error(payload.status_message || 'YTS returned an error.');
    const movies = Array.isArray(payload.data?.movies) ? payload.data.movies : [];
    const targetTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const targetYear = Number($('magnetYear').value || 0);
    movies.sort((a, b) => {
      const score = m => {
        const text = String(m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return (text === targetTitle ? 4 : text.includes(targetTitle) || targetTitle.includes(text) ? 2 : 0) + (targetYear && Number(m.year) === targetYear ? 3 : 0);
      };
      return score(b) - score(a);
    });
    ytsSearchMatches = movies.slice(0, 10);
    renderYtsResults(ytsSearchMatches);
    message('ytsSearchMessage', ytsSearchMatches.length ? `Found ${payload.data.movie_count ?? ytsSearchMatches.length} results. Check title and year carefully before selecting a torrent.` : 'No matching movie found. You can enter an authorized magnet URI manually.', ytsSearchMatches.length ? 'success' : 'info');
  } catch (error) {
    message('ytsSearchMessage', error.name === 'AbortError' ? 'YTS request timed out. Try again in a moment.' : `Could not search YTS: ${error.message || error}`, 'error');
  } finally { button.disabled = false; }
}
function clearTitleMagnetForm() {
  $('titleMagnetForm').reset();
  delete $('magnetUri').dataset.ytsTitle;
  delete $('magnetUri').dataset.ytsYear;
  delete $('magnetUri').dataset.quality;
  $('magnetMediaType').value = 'movie';
  $('ytsSearchResults').replaceChildren();
  ytsSearchMatches = [];
  message('titleMagnetFormMessage', '');
  message('ytsSearchMessage', '');
}
function renderTitleMagnetRows() {
  $('titleMagnetCount').textContent = `${titleMagnetRows.length} link${titleMagnetRows.length === 1 ? '' : 's'}`;
  $('titleMagnetList').innerHTML = titleMagnetRows.length ? titleMagnetRows.map(row => `<article class="download-admin-row">
    <div class="download-status-mark ${row.is_active ? 'is-on' : 'is-off'}">${row.is_active ? 'ON' : 'OFF'}</div>
    <div class="download-admin-info"><strong>${escapeHtml(row.title || row.yts_title || 'Untitled')} · ${escapeHtml(row.media_type === 'tv' ? 'TV Show' : 'Movie')}</strong><span>TMDB ID ${Number(row.tmdb_id)} · ${escapeHtml(row.quality || 'Magnet')}</span><small>${escapeHtml(row.yts_title || '')} ${row.yts_year ? `(${Number(row.yts_year)})` : ''} · ${row.is_active ? '<i class="status-published">Enabled</i>' : '<i class="status-draft">Disabled</i>'}</small></div>
    <div class="row-actions"><button class="small-outline" type="button" data-magnet-edit="${escapeHtml(row.id)}">Edit</button><button class="small-outline" type="button" data-magnet-toggle="${escapeHtml(row.id)}">${row.is_active ? 'Disable' : 'Enable'}</button><button class="small-outline danger-button" type="button" data-magnet-delete="${escapeHtml(row.id)}">Delete</button></div>
  </article>`).join('') : '<div class="no-items">No title-specific magnet links yet. Search a permitted movie above or add an authorized magnet URI manually.</div>';
}
async function loadTitleMagnetLinks() {
  try {
    const result = await supabase.from('title_magnet_links').select('id,tmdb_id,media_type,title,yts_title,yts_year,quality,magnet_uri,is_active,created_at').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    titleMagnetTableReady = true;
    titleMagnetRows = result.data || [];
    $('titleMagnetMigrationNotice').classList.add('hidden');
    renderTitleMagnetRows();
    return true;
  } catch (error) {
    titleMagnetTableReady = false;
    $('titleMagnetMigrationNotice').classList.remove('hidden');
    $('titleMagnetCount').textContent = 'Setup needed';
    $('titleMagnetList').innerHTML = '<div class="no-items">Run supabase-title-magnet-migration.sql in Supabase SQL Editor, then reload this page.</div>';
    return false;
  }
}
async function saveTitleMagnet(event) {
  event.preventDefault();
  if (!titleMagnetTableReady) { message('titleMagnetFormMessage', 'Run supabase-title-magnet-migration.sql in Supabase SQL Editor first.', 'error'); return; }
  const tmdbId = Number($('magnetTmdbId').value);
  const mediaType = $('magnetMediaType').value === 'tv' ? 'tv' : 'movie';
  const title = $('magnetTitle').value.trim();
  const ytsTitle = ytsSearchMatches.find(m => String(m.title) === String($('magnetUri').dataset.ytsTitle))?.title || $('magnetUri').dataset.ytsTitle || title;
  const ytsYear = Number($('magnetUri').dataset.ytsYear || $('magnetYear').value || 0) || null;
  const quality = $('magnetUri').dataset.quality || 'Authorized magnet';
  const magnetUri = $('magnetUri').value.trim();
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) { message('titleMagnetFormMessage', 'Enter a valid numeric TMDB ID.', 'error'); return; }
  if (!title) { message('titleMagnetFormMessage', 'Enter the title name.', 'error'); return; }
  if (!validMagnetUri(magnetUri)) { message('titleMagnetFormMessage', 'Enter a valid magnet URI beginning with magnet:?xt=urn:btih: and a valid torrent hash.', 'error'); return; }
  if (!$('magnetRightsConfirm').checked) { message('titleMagnetFormMessage', 'Confirm that you own this content or have distribution permission.', 'error'); return; }
  const payload = { tmdb_id: tmdbId, media_type: mediaType, title, yts_title: ytsTitle, yts_year: ytsYear, quality, magnet_uri: magnetUri, is_active: true, updated_at: new Date().toISOString() };
  $('saveTitleMagnetBtn').disabled = true;
  message('titleMagnetFormMessage', 'Saving title download link…');
  try {
    const result = await supabase.from('title_magnet_links').upsert(payload, { onConflict: 'tmdb_id,media_type' }).select('id').single();
    if (result.error) throw result.error;
    await loadTitleMagnetLinks();
    clearTitleMagnetForm();
    message('titleMagnetFormMessage', 'Saved. The Download via Magnet button will show on this title page.', 'success');
  } catch (error) { message('titleMagnetFormMessage', friendlyError(error), 'error'); }
  finally { $('saveTitleMagnetBtn').disabled = false; }
}
function editTitleMagnet(id) {
  const row = titleMagnetRows.find(item => item.id === id);
  if (!row) return;
  $('magnetTmdbId').value = row.tmdb_id;
  $('magnetMediaType').value = row.media_type;
  $('magnetTitle').value = row.title || '';
  $('magnetYear').value = row.yts_year || '';
  $('magnetSearchTerm').value = row.yts_title || row.title || '';
  $('magnetUri').value = row.magnet_uri || '';
  $('magnetUri').dataset.ytsTitle = row.yts_title || row.title || '';
  $('magnetUri').dataset.ytsYear = row.yts_year || '';
  $('magnetUri').dataset.quality = row.quality || '';
  $('magnetRightsConfirm').checked = false;
  $('titleMagnetEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  message('titleMagnetFormMessage', 'Editing this title mapping. Confirm your distribution rights again before saving.', 'info');
}
async function toggleTitleMagnet(id) {
  const row = titleMagnetRows.find(item => item.id === id);
  if (!row) return;
  const { error } = await supabase.from('title_magnet_links').update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { message('titleMagnetListMessage', friendlyError(error), 'error'); return; }
  message('titleMagnetListMessage', `Title download ${row.is_active ? 'disabled' : 'enabled'}.`, 'success');
  await loadTitleMagnetLinks();
}
async function deleteTitleMagnet(id) {
  const row = titleMagnetRows.find(item => item.id === id);
  if (!row || !confirm(`Delete the magnet link for “${row.title}”?`)) return;
  const { error } = await supabase.from('title_magnet_links').delete().eq('id', id);
  if (error) { message('titleMagnetListMessage', friendlyError(error), 'error'); return; }
  message('titleMagnetListMessage', 'Title download link deleted.', 'success');
  await loadTitleMagnetLinks();
}


let titleDirectRows = [];
let titleDirectTableReady = false;
function renderTitleDirectRows() {
  $('titleDirectCount').textContent = `${titleDirectRows.length} link${titleDirectRows.length === 1 ? '' : 's'}`;
  $('titleDirectList').innerHTML = titleDirectRows.length ? titleDirectRows.map(row => `<article class="download-admin-row">
    <div class="download-status-mark ${row.is_active ? 'is-on' : 'is-off'}">${row.is_active ? 'ON' : 'OFF'}</div>
    <div class="download-admin-info"><strong>${escapeHtml(row.title || 'Untitled')} · ${escapeHtml(row.media_type === 'tv' ? 'TV Show' : 'Movie')}</strong><span>TMDB ID ${Number(row.tmdb_id)} · ${escapeHtml(row.quality || 'Direct')}</span><small>${escapeHtml(row.direct_url || '')} · ${row.is_active ? '<i class="status-published">Enabled</i>' : '<i class="status-draft">Disabled</i>'}</small></div>
    <div class="row-actions"><button class="small-outline" type="button" data-direct-edit="${escapeHtml(row.id)}">Edit</button><button class="small-outline" type="button" data-direct-toggle="${escapeHtml(row.id)}">${row.is_active ? 'Disable' : 'Enable'}</button><button class="small-outline danger-button" type="button" data-direct-delete="${escapeHtml(row.id)}">Delete</button></div>
  </article>`).join('') : '<div class="no-items">No direct links yet. Add a direct URL you are authorized to distribute.</div>';
}
async function loadTitleDirectLinks() {
  try {
    const result = await supabase.from('title_direct_links')
      .select('id,tmdb_id,media_type,title,quality,button_text,direct_url,is_active,created_at')
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    titleDirectTableReady = true;
    titleDirectRows = result.data || [];
    $('titleDirectMigrationNotice').classList.add('hidden');
    renderTitleDirectRows();
    return true;
  } catch (_) {
    titleDirectTableReady = false;
    $('titleDirectMigrationNotice').classList.remove('hidden');
    $('titleDirectCount').textContent = 'Setup needed';
    $('titleDirectList').innerHTML = '<div class="no-items">Run website-source/supabase-title-direct-links-migration.sql in your Supabase SQL Editor, then reload.</div>';
    return false;
  }
}
function clearTitleDirectForm() {
  $('titleDirectForm').reset();
  $('directMediaType').value = 'movie';
  $('directQuality').value = '1080p';
  $('directButtonText').value = 'Download 1080p';
  $('directRightsConfirm').checked = false;
}
async function saveTitleDirectLink(event) {
  event.preventDefault();
  if (!titleDirectTableReady) { message('titleDirectFormMessage', 'Run the direct-links SQL migration in Supabase first.', 'error'); return; }
  const tmdbId = Number($('directTmdbId').value);
  const mediaType = $('directMediaType').value === 'tv' ? 'tv' : 'movie';
  const title = $('directTitle').value.trim();
  const quality = $('directQuality').value;
  const buttonText = $('directButtonText').value.trim() || `Download ${quality}`;
  const directUrl = safeHttpUrl($('directUrl').value.trim());
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) { message('titleDirectFormMessage', 'Enter a valid numeric TMDB ID.', 'error'); return; }
  if (!title) { message('titleDirectFormMessage', 'Enter the exact title name.', 'error'); return; }
  if (!directUrl) { message('titleDirectFormMessage', 'Enter a valid HTTP or HTTPS direct URL.', 'error'); return; }
  if (!$('directRightsConfirm').checked) { message('titleDirectFormMessage', 'Confirm that you own this content or have permission to distribute it.', 'error'); return; }
  const payload = { tmdb_id: tmdbId, media_type: mediaType, title, quality, button_text: buttonText, direct_url: directUrl, is_active: true, updated_at: new Date().toISOString() };
  $('saveTitleDirectBtn').disabled = true;
  message('titleDirectFormMessage', 'Saving direct download link…');
  try {
    const result = await supabase.from('title_direct_links').upsert(payload, { onConflict: 'tmdb_id,media_type,quality' }).select('id').single();
    if (result.error) throw result.error;
    await loadTitleDirectLinks();
    clearTitleDirectForm();
    message('titleDirectFormMessage', 'Saved. The direct download button will appear on the matching TMDB title page.', 'success');
  } catch (error) { message('titleDirectFormMessage', friendlyError(error), 'error'); }
  finally { $('saveTitleDirectBtn').disabled = false; }
}
function editTitleDirectLink(id) {
  const row = titleDirectRows.find(item => item.id === id);
  if (!row) return;
  $('directTmdbId').value = row.tmdb_id;
  $('directMediaType').value = row.media_type;
  $('directTitle').value = row.title || '';
  $('directQuality').value = row.quality || '1080p';
  $('directButtonText').value = row.button_text || `Download ${row.quality || ''}`.trim();
  $('directUrl').value = row.direct_url || '';
  $('directRightsConfirm').checked = false;
  $('titleDirectEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  message('titleDirectFormMessage', 'Editing this TMDB mapping. Confirm distribution rights again before saving.', 'info');
}
async function toggleTitleDirectLink(id) {
  const row = titleDirectRows.find(item => item.id === id);
  if (!row) return;
  const { error } = await supabase.from('title_direct_links').update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { message('titleDirectListMessage', friendlyError(error), 'error'); return; }
  await loadTitleDirectLinks();
  message('titleDirectListMessage', `Direct link ${row.is_active ? 'disabled' : 'enabled'}.`, 'success');
}
async function deleteTitleDirectLink(id) {
  const row = titleDirectRows.find(item => item.id === id);
  if (!row || !confirm(`Delete the ${row.quality} direct link for “${row.title}”?`)) return;
  const { error } = await supabase.from('title_direct_links').delete().eq('id', id);
  if (error) { message('titleDirectListMessage', friendlyError(error), 'error'); return; }
  await loadTitleDirectLinks();
  message('titleDirectListMessage', 'Direct download link deleted.', 'success');
}

async function startAdmin(user) {
  const { data: admin, error } = await supabase.from('site_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error('This account is not an authorized site admin. Check site_admins setup in README-SI.txt.');
  }
  $('adminEmail').textContent = user.email || 'Administrator';
  $('loginWrap').classList.add('hidden');
  $('adminApp').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  await Promise.all([loadGlobalTheme(), loadDownloadButtons(), loadTitleMagnetLinks(), loadTitleDirectLinks()]);
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseConfigured || !supabase) { message('loginMessage', 'Supabase settings are missing in js/config.js.', 'error'); return; }
  message('loginMessage', 'Signing in…');
  const { data, error } = await supabase.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
  if (error) { message('loginMessage', friendlyError(error), 'error'); return; }
  try { await startAdmin(data.user); message('loginMessage', ''); }
  catch (err) { $('loginWrap').classList.remove('hidden'); $('adminApp').classList.add('hidden'); message('loginMessage', friendlyError(err), 'error'); }
});
$('logoutBtn').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); location.reload(); });
$('activeThemeSelect').addEventListener('change', event => saveGlobalTheme(event.target.value));
$('newDownloadBtn').addEventListener('click', () => openDownloadEditor());
$('downloadForm').addEventListener('submit', saveDownloadButton);
$('closeDownloadEditorBtn').addEventListener('click', closeDownloadEditor);
$('cancelDownloadEditorBtn').addEventListener('click', closeDownloadEditor);
$('downloadButtonsList').addEventListener('click', event => {
  const edit = event.target.closest('[data-download-edit]');
  const toggle = event.target.closest('[data-download-toggle]');
  const del = event.target.closest('[data-download-delete]');
  if (edit) { const row = downloadButtons.find(item => item.id === edit.dataset.downloadEdit); if (row) openDownloadEditor(row); }
  if (toggle) toggleDownload(toggle.dataset.downloadToggle);
  if (del) deleteDownload(del.dataset.downloadDelete);
});
$('searchYtsBtn').addEventListener('click', searchYtsMatches);
$('titleMagnetForm').addEventListener('submit', saveTitleMagnet);
$('magnetMediaType').addEventListener('change', () => {
  if ($('magnetMediaType').value === 'tv') message('ytsSearchMessage', 'YTS API search is for movies. For a TV show, paste a magnet link from a source you are authorized to distribute.', 'info');
  else message('ytsSearchMessage', '');
});
$('magnetUri').addEventListener('input', () => {
  delete $('magnetUri').dataset.ytsTitle;
  delete $('magnetUri').dataset.ytsYear;
  delete $('magnetUri').dataset.quality;
});
$('ytsSearchResults').addEventListener('click', event => {
  const button = event.target.closest('[data-yts-movie][data-yts-torrent]');
  if (!button) return;
  const movie = ytsSearchMatches[Number(button.dataset.ytsMovie)];
  const torrent = movie?.torrents?.[Number(button.dataset.ytsTorrent)];
  const magnet = movie && torrent ? buildYtsMagnet(movie, torrent) : '';
  if (!magnet) { message('ytsSearchMessage', 'This torrent does not contain a valid hash.', 'error'); return; }
  $('magnetUri').value = magnet;
  $('magnetUri').dataset.ytsTitle = movie.title || '';
  $('magnetUri').dataset.ytsYear = movie.year || '';
  $('magnetUri').dataset.quality = `${torrent.quality || ''}${torrent.type ? ` ${torrent.type}` : ''}`.trim();
  if (!$('magnetTitle').value.trim()) $('magnetTitle').value = movie.title || '';
  if (!$('magnetYear').value) $('magnetYear').value = movie.year || '';
  message('ytsSearchMessage', `Selected ${movie.title} (${movie.year}) · ${torrent.quality || 'torrent'}. Confirm the title is the correct match and that you have distribution permission before saving.`, 'success');
});
$('titleMagnetList').addEventListener('click', event => {
  const edit = event.target.closest('[data-magnet-edit]');
  const toggle = event.target.closest('[data-magnet-toggle]');
  const del = event.target.closest('[data-magnet-delete]');
  if (edit) editTitleMagnet(edit.dataset.magnetEdit);
  if (toggle) toggleTitleMagnet(toggle.dataset.magnetToggle);
  if (del) deleteTitleMagnet(del.dataset.magnetDelete);
});

$('titleDirectForm').addEventListener('submit', saveTitleDirectLink);
$('titleDirectList').addEventListener('click', event => {
  const edit = event.target.closest('[data-direct-edit]');
  const toggle = event.target.closest('[data-direct-toggle]');
  const del = event.target.closest('[data-direct-delete]');
  if (edit) editTitleDirectLink(edit.dataset.directEdit);
  if (toggle) toggleTitleDirectLink(toggle.dataset.directToggle);
  if (del) deleteTitleDirectLink(del.dataset.directDelete);
});
$('directQuality').addEventListener('change', () => {
  $('directButtonText').value = `Download ${$('directQuality').value}`;
});

(async () => {
  if (!supabaseConfigured || !supabase) return;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) await startAdmin(session.user);
  } catch (error) {
    $('loginWrap').classList.remove('hidden');
    $('adminApp').classList.add('hidden');
    message('loginMessage', friendlyError(error), 'error');
  }
})();
