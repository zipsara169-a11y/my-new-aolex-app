import { TMDB_API_KEY, tmdbConfigured, escapeHtml, imageUrl, yearFrom, languageName } from './tmdb.js';
import { supabase, supabaseConfigured } from './shared.js';

document.getElementById('year').textContent = new Date().getFullYear();
const loading = document.getElementById('detailLoading');
const detail = document.getElementById('movieDetail');
const errorBox = document.getElementById('detailError');
const errorMessage = document.getElementById('detailErrorMessage');
const embedPlayer = document.getElementById('embedPlayer');
const placeholder = document.getElementById('embedPlaceholder');
const episodeControls = document.getElementById('episodeControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
let currentTitle = null;
let currentType = 'movie';
let currentId = '';
let currentSeason = 1;
let currentEpisode = 1;
let playbackStarted = false;
let screenshotItems = [];
let activeScreenshotIndex = 0;

const tmdbFetch = async (path, params = {}) => {
  if (!tmdbConfigured) throw new Error('The title catalogue is not configured yet. Please check the website configuration.');
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('include_adult', 'false');
  for (const [key, value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url.toString());
  if (!response.ok) {
    let message = '';
    try { message = (await response.json()).status_message || ''; } catch (_) {}
    throw new Error(message || `Could not load title details (${response.status}).`);
  }
  return response.json();
};
function fail(message) {
  loading.classList.add('hidden');
  detail.classList.add('hidden');
  errorBox.classList.remove('hidden');
  errorMessage.textContent = message || 'This title could not be loaded.';
}
function safeImage(path, size = 'w500') { return imageUrl(path, size); }
function getTitle(data) { return data.title || data.name || 'Untitled'; }
function getDate(data) { return data.release_date || data.first_air_date || ''; }
function isTv() { return currentType === 'tv'; }
function buildPlayerUrl() {
  if (isTv()) return `https://embedmaster.link/tv/${encodeURIComponent(currentId)}/${encodeURIComponent(currentSeason)}/${encodeURIComponent(currentEpisode)}`;
  return `https://embedmaster.link/movie/${encodeURIComponent(currentId)}`;
}
function setPlayerUrl({ autoplay = false } = {}) {
  const url = buildPlayerUrl();
  document.getElementById('playerStatus').textContent = isTv()
    ? `Selected: Season ${currentSeason}, Episode ${currentEpisode}.`
    : 'Movie player is ready.';
  if (playbackStarted || autoplay) {
    embedPlayer.src = url;
    embedPlayer.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    embedPlayer.removeAttribute('src');
    embedPlayer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}
function renderTrailer(videos) {
  const section = document.getElementById('trailerSection');
  const candidates = (videos || []).filter(v => v.site === 'YouTube' && v.key && ['Trailer', 'Teaser'].includes(v.type));
  const trailer = candidates.find(v => v.type === 'Trailer' && v.official) || candidates.find(v => v.type === 'Trailer') || candidates[0];
  if (!trailer) { section.classList.add('hidden'); return; }
  const iframe = document.getElementById('trailerFrame');
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?rel=0&modestbranding=1`;
  const linkWrap = document.getElementById('trailerLinkWrap');
  linkWrap.innerHTML = `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>`;
  section.classList.remove('hidden');
}
function renderScreenshots(images) {
  const section = document.getElementById('screenshotsSection');
  const grid = document.getElementById('screenshotGrid');
  screenshotItems = (images?.backdrops || []).filter(x => x.file_path).slice(0, 16);
  if (!screenshotItems.length) { section.classList.add('hidden'); return; }
  const title = getTitle(currentTitle);
  grid.innerHTML = screenshotItems.map((shot, i) => `<button type="button" class="screenshot-tile" data-screenshot-index="${i}" aria-label="View screenshot ${i + 1}"><img src="${escapeHtml(imageUrl(shot.file_path, 'w342'))}" alt="${escapeHtml(title)} screenshot ${i + 1}" loading="lazy"></button>`).join('');
  const counter = document.getElementById('screenshotCounter');
  if (counter) counter.textContent = `${screenshotItems.length} still${screenshotItems.length === 1 ? '' : 's'} · swipe to browse`;
  section.classList.remove('hidden');
}
function showScreenshot(index, openViewer = true) {
  if (!screenshotItems.length) return;
  activeScreenshotIndex = (index + screenshotItems.length) % screenshotItems.length;
  const shot = screenshotItems[activeScreenshotIndex];
  const image = document.getElementById('lightboxImage');
  image.src = imageUrl(shot.file_path, 'original');
  image.alt = `${getTitle(currentTitle)} screenshot ${activeScreenshotIndex + 1}`;
  document.getElementById('lightboxCounter').textContent = `${activeScreenshotIndex + 1} / ${screenshotItems.length}`;
  const dialog = document.getElementById('screenshotLightbox');
  if (openViewer && !dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
}
function moveScreenshot(direction) {
  showScreenshot(activeScreenshotIndex + direction, false);
}
function renderCast(cast) {
  const section = document.getElementById('castSection');
  const grid = document.getElementById('castGrid');
  const people = (cast || []).filter(person => person.id && person.name).slice(0, 16);
  if (!people.length) { section.classList.add('hidden'); return; }
  grid.innerHTML = people.map(person => {
    const src = safeImage(person.profile_path, 'w185');
    const photo = src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(person.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">` : '';
    const initial = escapeHtml((person.name || '?').slice(0, 1));
    const character = person.character || person.roles?.[0]?.character || person.job || '';
    return `<a class="cast-card" href="index.html?person=${encodeURIComponent(person.id)}&personName=${encodeURIComponent(person.name)}#browse"><span class="cast-photo">${photo}<span class="cast-initial ${src ? 'hidden' : ''}">${initial}</span></span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(character)}</small><em>View titles ↗</em></a>`;
  }).join('');
  section.classList.remove('hidden');
}
function renderSimilar(results) {
  const section = document.getElementById('similarSection');
  const grid = document.getElementById('similarGrid');
  const similar = (results || []).filter(x => x.id && (x.poster_path || x.title || x.name)).slice(0, 6);
  if (!similar.length) { section.classList.add('hidden'); return; }
  grid.innerHTML = similar.map(item => {
    const title = getTitle(item), type = currentType;
    const path = safeImage(item.poster_path, 'w342');
    return `<a class="similar-card" href="movie.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}"><span class="similar-poster">${path ? `<img src="${escapeHtml(path)}" alt="${escapeHtml(title)} poster" loading="lazy">` : 'APLEX'}</span><strong>${escapeHtml(title)}</strong><small>★ ${Number(item.vote_average || 0).toFixed(1)} · ${escapeHtml(yearFrom(getDate(item)))}</small></a>`;
  }).join('');
  section.classList.remove('hidden');
}
async function renderAuthorizedMagnetLink() {
  const host = document.getElementById('titleMagnetSlot');
  if (!host) return;
  host.replaceChildren();
  host.classList.add('hidden');
  if (!supabaseConfigured || !supabase || !/^\d+$/.test(String(currentId))) return;
  try {
    const { data, error } = await supabase.from('title_magnet_links')
      .select('title,quality,magnet_uri,is_active')
      .eq('tmdb_id', Number(currentId)).eq('media_type', currentType).eq('is_active', true).maybeSingle();
    if (error || !data?.magnet_uri) return;
    const magnet = String(data.magnet_uri).trim();
    if (!/^magnet:\?xt=urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})(?:&|$)/i.test(magnet)) return;

    const heading = document.createElement('strong');
    heading.className = 'title-magnet-heading';
    heading.textContent = 'Authorized download';
    heading.style.flexBasis = '100%';
    host.appendChild(heading);

    const download = document.createElement('a');
    download.className = 'download-button';
    download.href = magnet;
    download.setAttribute('aria-label', `Download ${getTitle(currentTitle)} via magnet link`);
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🧲';
    const label = document.createElement('span');
    label.textContent = `Download Magnet${data.quality ? ` · ${data.quality}` : ''}`;
    const arrow = document.createElement('b');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    download.append(icon, label, arrow);
    host.appendChild(download);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'secondary-button';
    copy.textContent = 'Copy Link';
    copy.addEventListener('click', async () => {
      const status = host.querySelector('.title-magnet-status');
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(magnet);
        } else {
          const input = document.createElement('textarea');
          input.value = magnet;
          input.style.position = 'fixed';
          input.style.opacity = '0';
          document.body.appendChild(input);
          input.select();
          const copied = document.execCommand('copy');
          input.remove();
          if (!copied) throw new Error('Clipboard unavailable');
        }
        status.textContent = 'Magnet link copied.';
      } catch (_) {
        status.textContent = 'Could not copy automatically. Use Download Magnet to open your torrent app.';
      }
    });
    host.appendChild(copy);

    const note = document.createElement('small');
    note.className = 'title-magnet-note';
    note.textContent = 'Opens in a compatible torrent app. Only use downloads you are authorized to access.';
    host.appendChild(note);
    const status = document.createElement('small');
    status.className = 'title-magnet-note title-magnet-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    host.appendChild(status);
    host.classList.remove('hidden');
  } catch (_) {
    // Magnet downloads are optional and must never interrupt the title details/player.
    host.classList.add('hidden');
  }
}
const IA_ALLOWED_LICENSES = [
  /^https?:\/\/creativecommons\.org\/publicdomain\/(?:zero|mark)\/1\.0\/?$/i,
  /^https?:\/\/creativecommons\.org\/licenses\/(?:by|by-sa)\/(?:[234]\.0|1\.0)\/?$/i
];
function normalizeArchiveTitle(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function archiveLicenseAllowed(value) {
  const licenses = Array.isArray(value) ? value : [value];
  return licenses.map(x => String(x || '').trim()).some(url => IA_ALLOWED_LICENSES.some(pattern => pattern.test(url)));
}
async function renderArchiveLegalTorrents() {
  const host = document.getElementById('titleMagnetSlot');
  if (!host || !currentTitle || currentType !== 'movie') return;
  // A title-specific link explicitly supplied by an authorized distributor takes priority.
  if (!host.classList.contains('hidden')) return;
  host.replaceChildren();
  host.classList.remove('hidden');
  const status = document.createElement('small');
  status.className = 'title-magnet-note';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Searching public-domain and Creative Commons torrent catalogues…';
  host.appendChild(status);
  try {
    const title = getTitle(currentTitle);
    const year = Number(String(getDate(currentTitle)).slice(0, 4)) || 0;
    const query = 'title:"' + title.replace(/["\\]/g, ' ') + '" AND mediatype:movies';
    const searchUrl = new URL('https://archive.org/advancedsearch.php');
    searchUrl.searchParams.set('q', query);
    ['identifier', 'title', 'year'].forEach(field => searchUrl.searchParams.append('fl[]', field));
    searchUrl.searchParams.set('rows', '12');
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('output', 'json');
    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) throw new Error('Archive search is temporarily unavailable.');
    const searchData = await searchResponse.json();
    const docs = Array.isArray(searchData.response?.docs) ? searchData.response.docs : [];
    const targetTitle = normalizeArchiveTitle(title);
    const matching = docs.filter(item => {
      const candidateTitle = normalizeArchiveTitle(item.title);
      const sameTitle = candidateTitle === targetTitle;
      const candidateYear = Number(item.year) || 0;
      return sameTitle && (!year || !candidateYear || candidateYear === year);
    }).slice(0, 8);
    const verified = [];
    for (const item of matching) {
      const metaResponse = await fetch('https://archive.org/metadata/' + encodeURIComponent(item.identifier));
      if (!metaResponse.ok) continue;
      const record = await metaResponse.json();
      const metadata = record.metadata || {};
      if (!archiveLicenseAllowed(metadata.licenseurl)) continue;
      const files = Array.isArray(record.files) ? record.files : [];
      const torrent = files.find(file => typeof file.name === 'string' && file.name.toLowerCase() === (item.identifier + '_archive.torrent').toLowerCase())
        || files.find(file => typeof file.name === 'string' && file.name.toLowerCase().endsWith('.torrent'));
      if (!torrent) continue;
      verified.push({
        identifier: item.identifier,
        title: metadata.title || item.title || title,
        year: metadata.year || item.year || '',
        license: (Array.isArray(metadata.licenseurl) ? metadata.licenseurl[0] : metadata.licenseurl),
        torrentUrl: 'https://archive.org/download/' + encodeURIComponent(item.identifier) + '/' + encodeURIComponent(torrent.name)
      });
      if (verified.length >= 3) break;
    }
    host.replaceChildren();
    if (!verified.length) {
      host.classList.add('hidden');
      return;
    }
    const heading = document.createElement('strong');
    heading.className = 'title-magnet-heading';
    heading.textContent = 'Legal torrent matches';
    heading.style.flexBasis = '100%';
    host.appendChild(heading);
    verified.forEach(item => {
      const card = document.createElement('div');
      card.className = 'download-manager';
      card.style.flexBasis = '100%';
      const name = document.createElement('strong');
      name.textContent = item.title + (item.year ? ' (' + item.year + ')' : '');
      const license = document.createElement('small');
      license.className = 'title-magnet-note';
      license.textContent = 'Archive-listed licence: ' + item.license;
      const link = document.createElement('a');
      link.className = 'download-button';
      link.href = item.torrentUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Download .torrent file';
      const source = document.createElement('a');
      source.href = 'https://archive.org/details/' + encodeURIComponent(item.identifier);
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = 'View source and licence ↗';
      source.style.display = 'block';
      source.style.marginTop = '9px';
      source.style.fontSize = '11px';
      card.append(name, license, link, source);
      host.appendChild(card);
    });
    const note = document.createElement('small');
    note.className = 'title-magnet-note';
    note.textContent = 'Matches are shown only when the Archive item lists a supported public-domain or Creative Commons licence. Check the item page and licence terms before downloading or sharing.';
    host.appendChild(note);
  } catch (_) {
    host.replaceChildren();
    host.classList.add('hidden');
  }
}
function renderInfo(data) {
  const runtime = isTv() ? (data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min / episode` : '—') : (data.runtime ? `${data.runtime} minutes` : '—');
  const genres = (data.genres || []).map(g => g.name).join(', ') || '—';
  const info = [
    ['Release date', getDate(data) || '—'], ['Original language', languageName(data.original_language) || data.original_language || '—'],
    [isTv() ? 'Episodes' : 'Runtime', isTv() ? (data.number_of_episodes ?? '—') : runtime],
    [isTv() ? 'Seasons' : 'Status', isTv() ? (data.number_of_seasons ?? '—') : (data.status || '—')],
    ['Rating', data.vote_average != null ? `${Number(data.vote_average).toFixed(1)} / 10` : 'Not rated'], ['Genres', genres]
  ];
  document.getElementById('infoList').innerHTML = info.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}
async function loadEpisodes(seasonNumber) {
  currentSeason = Number(seasonNumber);
  episodeSelect.innerHTML = '<option value="">Loading episodes…</option>';
  const season = await tmdbFetch(`/tv/${encodeURIComponent(currentId)}/season/${encodeURIComponent(currentSeason)}`, { language: 'en-US' });
  const episodes = season.episodes || [];
  episodeSelect.innerHTML = episodes.map(ep => `<option value="${Number(ep.episode_number)}">${Number(ep.episode_number)}. ${escapeHtml(ep.name || `Episode ${ep.episode_number}`)}</option>`).join('');
  if (!episodes.length) {
    episodeSelect.innerHTML = '<option value="1">Episode 1</option>';
    currentEpisode = 1;
  } else {
    const firstAvailable = episodes[0];
    currentEpisode = Number(firstAvailable.episode_number || 1);
    episodeSelect.value = String(currentEpisode);
  }
  setPlayerUrl({ autoplay: playbackStarted });
}
async function setupEpisodes(data) {
  episodeControls.classList.remove('hidden');
  const seasons = (data.seasons || []).filter(s => Number(s.season_number) > 0);
  if (!seasons.length) {
    seasonSelect.innerHTML = '<option value="1">Season 1</option>';
  } else {
    seasonSelect.innerHTML = seasons.map(s => `<option value="${Number(s.season_number)}">Season ${Number(s.season_number)}${s.name && !/^season\s+\d+/i.test(s.name) ? ` — ${escapeHtml(s.name)}` : ''}</option>`).join('');
  }
  currentSeason = Number(seasonSelect.value || seasons[0]?.season_number || 1);
  await loadEpisodes(currentSeason);
  seasonSelect.addEventListener('change', () => loadEpisodes(seasonSelect.value).catch(err => { document.getElementById('playerStatus').textContent = err.message || 'Could not load episodes.'; }));
  episodeSelect.addEventListener('change', () => { currentEpisode = Number(episodeSelect.value || 1); setPlayerUrl({ autoplay: playbackStarted }); });
}
async function loadTMDBTitle(id, type) {
  currentId = String(id);
  currentType = type === 'tv' ? 'tv' : 'movie';
  if (!/^\d+$/.test(currentId)) throw new Error('Invalid title link. Open a title from the APLEX Movies library.');
  const details = await tmdbFetch(`/${currentType}/${encodeURIComponent(currentId)}`, { append_to_response: 'videos,images,credits,external_ids,recommendations', language: 'en-US' });
  currentTitle = details;
  const title = getTitle(details);
  document.title = `${title} — APLEX Movies`;
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailCategory').textContent = currentType === 'tv' ? 'TV SERIES' : 'MOVIE';
  const poster = document.getElementById('detailPoster');
  poster.src = safeImage(details.poster_path, 'w500') || '';
  poster.alt = `${title} poster`;
  poster.onerror = () => { poster.style.visibility = 'hidden'; };
  const bg = document.getElementById('detailBackdrop');
  if (details.backdrop_path) bg.style.backgroundImage = `linear-gradient(90deg, rgba(9,10,15,.97), rgba(9,10,15,.58)), url("${safeImage(details.backdrop_path, 'w1280').replace(/["\\]/g, '')}")`;
  const meta = [];
  if (getDate(details)) meta.push(yearFrom(getDate(details)));
  if (currentType === 'movie' && details.runtime) meta.push(`${details.runtime} min`);
  if (currentType === 'tv' && details.number_of_seasons) meta.push(`${details.number_of_seasons} season${details.number_of_seasons === 1 ? '' : 's'}`);
  if (details.vote_average != null) meta.push(`★ ${Number(details.vote_average).toFixed(1)} / 10`);
  document.getElementById('detailMeta').innerHTML = meta.map(x => `<span>${escapeHtml(x)}</span>`).join('<i></i>');
  document.getElementById('detailGenres').innerHTML = (details.genres || []).map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`).join('');
  document.getElementById('detailOverview').textContent = details.overview || 'A synopsis is not available for this title yet.';
  document.getElementById('watchHeading').innerHTML = currentType === 'tv' ? 'Watch episodes<span class="red-dot">.</span>' : 'Watch movie<span class="red-dot">.</span>';
  document.getElementById('watchIntro').textContent = currentType === 'tv' ? 'Choose a season and episode, then press Play.' : 'Play the movie in the embedded player below.';
  document.getElementById('sourceTitle').textContent = currentType === 'tv' ? 'APLEX TV Player' : 'APLEX Movie Player';
  document.getElementById('sourceDescription').textContent = `Ready to play this ${currentType === 'tv' ? 'TV series' : 'movie'}.`;
  document.getElementById('playerStatus').textContent = 'Player URL is ready. Press Play now to load the embedded player.';
  playbackStarted = false;
  episodeControls.classList.toggle('hidden', currentType !== 'tv');
  if (currentType === 'tv') await setupEpisodes(details);
  else { currentSeason = 1; currentEpisode = 1; setPlayerUrl(); }
  renderTrailer(details.videos?.results || []);
  renderScreenshots(details.images || {});
  renderCast(details.credits?.cast || []);
  renderSimilar(details.recommendations?.results || []);
  renderInfo(details);
  await renderAuthorizedMagnetLink();
  await renderArchiveLegalTorrents();
  loading.classList.add('hidden');
  detail.classList.remove('hidden');
}

document.getElementById('startPlayback').addEventListener('click', () => {
  playbackStarted = true;
  setPlayerUrl({ autoplay: true });
});

const screenshotGrid = document.getElementById('screenshotGrid');
screenshotGrid.addEventListener('click', event => {
  const tile = event.target.closest('[data-screenshot-index]');
  if (tile) showScreenshot(Number(tile.dataset.screenshotIndex) || 0);
});
document.getElementById('screenshotScrollPrev').addEventListener('click', () => {
  const first = screenshotGrid.querySelector('.screenshot-tile');
  screenshotGrid.scrollBy({ left: -(first?.getBoundingClientRect().width || 180) - 12, behavior: 'smooth' });
});
document.getElementById('screenshotScrollNext').addEventListener('click', () => {
  const first = screenshotGrid.querySelector('.screenshot-tile');
  screenshotGrid.scrollBy({ left: (first?.getBoundingClientRect().width || 180) + 12, behavior: 'smooth' });
});
document.getElementById('closeScreenshotLightbox').addEventListener('click', () => {
  const dialog = document.getElementById('screenshotLightbox');
  if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
});
document.getElementById('lightboxPrev').addEventListener('click', () => moveScreenshot(-1));
document.getElementById('lightboxNext').addEventListener('click', () => moveScreenshot(1));
document.getElementById('screenshotLightbox').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
const screenshotDialog = document.getElementById('screenshotLightbox');
let screenshotTouchStartX = null;
screenshotDialog.addEventListener('touchstart', event => {
  screenshotTouchStartX = event.changedTouches?.[0]?.clientX ?? null;
}, { passive: true });
screenshotDialog.addEventListener('touchend', event => {
  if (screenshotTouchStartX == null) return;
  const endX = event.changedTouches?.[0]?.clientX;
  const delta = endX == null ? 0 : endX - screenshotTouchStartX;
  screenshotTouchStartX = null;
  if (Math.abs(delta) > 45) moveScreenshot(delta < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('keydown', event => {
  const dialog = document.getElementById('screenshotLightbox');
  if (!dialog.open) return;
  if (event.key === 'ArrowLeft') moveScreenshot(-1);
  if (event.key === 'ArrowRight') moveScreenshot(1);
});
document.getElementById('shareMovieButton').addEventListener('click', async () => {
  const status = document.getElementById('shareMessage');
  const title = currentTitle ? getTitle(currentTitle) : 'APLEX Movies';
  const shareUrl = `https://aplexmovies.vercel.app/share/${currentType}/${encodeURIComponent(currentId)}`;
  const shareData = { title: `${title} — APLEX Movies`, text: `Explore ${title} on APLEX Movies.`, url: shareUrl };
  try {
    if (navigator.share) { await navigator.share(shareData); status.textContent = 'Share menu opened.'; }
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareData.url); status.textContent = 'Title link copied to clipboard.'; }
    else { const input = document.createElement('textarea'); input.value = shareData.url; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); const copied = document.execCommand('copy'); input.remove(); status.textContent = copied ? 'Title link copied to clipboard.' : 'Copy this page URL from your browser address bar.'; }
  } catch (error) { if (error?.name !== 'AbortError') status.textContent = 'Use your browser menu to share this title link.'; }
  if (status.textContent) setTimeout(() => { status.textContent = ''; }, 3500);
});

(async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const type = params.get('type') || 'movie';
  if (!id) { fail('No title was selected. Return to the library and choose a movie or TV show.'); return; }
  try { await loadTMDBTitle(id, type); }
  catch (error) { fail(error.message || 'Could not load title details.'); }
})();
