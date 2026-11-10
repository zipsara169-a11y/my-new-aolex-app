import { TMDB_API_KEY, tmdbConfigured, escapeHtml, imageUrl, yearFrom, languageName } from './tmdb.js';

const grid = document.getElementById('movieGrid');
const count = document.getElementById('resultCount');
const empty = document.getElementById('emptyState');
const search = document.getElementById('searchInput');
const sort = document.getElementById('sortSelect');
const genreFilter = document.getElementById('genreFilter');
const yearFilter = document.getElementById('yearFilter');
const languageFilter = document.getElementById('languageFilter');
const dialog = document.getElementById('filterDialog');
const loadMoreButton = document.getElementById('loadMoreButton');
const paginationNote = document.getElementById('paginationNote');
const filterCount = document.getElementById('filterCount');
const filterSummary = document.getElementById('activeFilterSummary');
const personBanner = document.getElementById('personBanner');
const mediaButtons = [...document.querySelectorAll('[data-media]')];
const browseSection = document.getElementById('browse');
const searchResultsInfo = document.getElementById('searchResultsInfo');
const searchResultsQuery = document.getElementById('searchResultsQuery');
const searchResultsSub = document.getElementById('searchResultsSub');
const featuredTrack = document.getElementById('featuredTrack');
const featuredHeading = document.getElementById('featuredHeading');
const featuredKicker = document.getElementById('featuredKicker');
const featuredControls = document.getElementById('featuredControls');
const featuredPrev = document.getElementById('featuredPrev');
const featuredNext = document.getElementById('featuredNext');
let activeFeaturedRequest = 0;
let featuredItems = [];
let featuredIndex = 0;
let featuredTimer = null;

document.getElementById('year').textContent = new Date().getFullYear();
let mediaType = 'movie';
let committedQuery = '';
let page = 1;
let totalPages = 1;
let items = [];
let genreNames = new Map();
let languageNames = new Map();
let personId = new URLSearchParams(location.search).get('person');
let personName = new URLSearchParams(location.search).get('personName') || 'Cast member';
let activeRequest = 0;
let configured = false;

const tmdbFetch = async (path, params = {}) => {
  if (!tmdbConfigured) throw new Error('Catalogue setup is incomplete. Please check the website configuration.');
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('include_adult', 'false');
  for (const [key, value] of Object.entries(params)) if (value !== '' && value != null) url.searchParams.set(key, String(value));
  const response = await fetch(url.toString());
  if (!response.ok) {
    let detail = '';
    try { const json = await response.json(); detail = json.status_message || ''; } catch (_) {}
    throw new Error(detail || `Could not load titles (${response.status}).`);
  }
  return response.json();
};

function titleOf(item) { return item.title || item.name || 'Untitled'; }
function dateOf(item) { return item.release_date || item.first_air_date || ''; }
function typeOf(item) { return item.media_type || mediaType; }
function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
function isReleasedTv(item) {
  const firstAirDate = String(item.first_air_date || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(firstAirDate) && firstAirDate <= todayIsoDate();
}
function isTrendingTvView() {
  return mediaType === 'tv' && !personId && !committedQuery.trim() &&
    !genreFilter.value && !yearFilter.value && !languageFilter.value &&
    sort.value === 'popularity.desc';
}
function genreLabel(item) {
  return (item.genre_ids || []).slice(0, 2).map(id => genreNames.get(`${typeOf(item)}:${id}`)).filter(Boolean).join(' · ') || (typeOf(item) === 'tv' ? 'TV Series' : 'Movie');
}
function poster(src, title) {
  return src ? `<img src="${escapeHtml(imageUrl(src, 'w500'))}" alt="${escapeHtml(title)} poster" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
}
function card(item) {
  const type = typeOf(item);
  const title = titleOf(item);
  const year = yearFrom(dateOf(item));
  const posterPath = item.poster_path || item.poster_url || '';
  const tmdbId = item.id;
  return `<a class="movie-card" href="movie.html?id=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(type)}"><div class="poster-frame">${poster(posterPath, title)}<div class="poster-fallback" ${posterPath ? 'style="display:none"' : ''}><span>APLEX</span><b>${escapeHtml(title.slice(0, 1) || (type === 'tv' ? 'T' : 'M'))}</b></div><span class="poster-rating">★ ${Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average).toFixed(1) : 'NR'}</span><span class="media-type-label">${type === 'tv' ? 'TV' : 'MOVIE'}</span><span class="card-play">▶</span></div><div class="movie-card-info"><div class="movie-card-meta"><span>${escapeHtml(year)}</span><i></i><span>${escapeHtml(genreLabel(item))}</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(languageNames.get(item.original_language) || languageName(item.original_language) || '—')}</p></div></a>`;
}
function updateSearchPresentation(resultCount = 0) {
  const searchMode = Boolean(committedQuery.trim()) && !personId;
  browseSection.classList.toggle('search-mode', searchMode);
  document.getElementById('heroPanel').classList.toggle('hidden', searchMode);
  document.getElementById('about').classList.toggle('hidden', searchMode);
  searchResultsInfo.classList.toggle('hidden', !searchMode);
  if (searchMode) {
    searchResultsQuery.textContent = `“${committedQuery}”`;
    searchResultsSub.textContent = `${resultCount} ${resultCount === 1 ? 'result' : 'results'} · ${mediaType === 'tv' ? 'TV shows' : 'movies'}`;
  }
}

function featuredSlide(item, index, total, type) {
  const title = titleOf(item);
  const date = yearFrom(dateOf(item));
  const imagePath = item.backdrop_path || item.poster_path || item.poster_url || '';
  const image = imagePath ? imageUrl(imagePath, item.backdrop_path ? 'w1280' : 'w780') : '';
  const overview = String(item.overview || 'Discover the story, cast and trailer for this popular title on APLEX Movies.').trim();
  const rating = Number(item.vote_average);
  const ratingText = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'NEW';
  const genre = genreLabel({ ...item, media_type: type });
  const href = `movie.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}`;
  const safeImage = escapeHtml(image);
  return `<article class="featured-slide${index === 0 ? ' is-active' : ''}" aria-hidden="${index !== 0}" data-featured-index="${index}">
    <div class="featured-backdrop" aria-hidden="true"${safeImage ? ` style="background-image:url(&quot;${safeImage}&quot;)"` : ''}></div>
    <div class="featured-vignette" aria-hidden="true"></div>
    <div class="featured-slide-index">APLEX CINEMA <span>/</span> ${String(index + 1).padStart(2, '0')} <i>/</i> ${String(total).padStart(2, '0')}</div>
    <div class="featured-slide-content">
      <div class="featured-badges"><span class="featured-pick"><span></span> POPULAR PICK</span><span class="featured-score">★ ${escapeHtml(ratingText)}</span></div>
      <h3 class="featured-title"><a href="${href}" tabindex="${index === 0 ? '0' : '-1'}">${escapeHtml(title)}</a></h3>
      <div class="featured-meta"><span>${escapeHtml(date)}</span><i></i><span>${escapeHtml(genre)}</span><i></i><span>${type === 'tv' ? 'TV SERIES' : 'FEATURE FILM'}</span></div>
      <p class="featured-overview">${escapeHtml(overview)}</p>
      <a class="featured-cta" href="${href}" tabindex="${index === 0 ? '0' : '-1'}">Explore title <span aria-hidden="true">↗</span></a>
    </div>
    <div class="featured-type-pill"><span>${type === 'tv' ? 'SERIES' : 'MOVIE'}</span><b>${type === 'tv' ? 'TV' : '▶'}</b></div>
  </article>`;
}

function setFeaturedSlide(nextIndex, resetTimer = false) {
  if (!featuredItems.length) return;
  featuredIndex = (nextIndex + featuredItems.length) % featuredItems.length;
  featuredTrack.style.transform = `translateX(-${featuredIndex * 100}%)`;
  const slides = [...featuredTrack.querySelectorAll('.featured-slide')];
  slides.forEach((slide, index) => {
    const active = index === featuredIndex;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
    slide.querySelectorAll('a, button').forEach(link => link.tabIndex = active ? 0 : -1);
  });
  [...featuredControls.querySelectorAll('.featured-dot')].forEach((dot, index) => {
    const active = index === featuredIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-pressed', String(active));
    dot.setAttribute('aria-label', `${active ? 'Current title: ' : 'Show '}${titleOf(featuredItems[index])}`);
  });
  if (resetTimer) startFeaturedTimer();
}

function startFeaturedTimer() {
  if (featuredTimer) clearInterval(featuredTimer);
  featuredTimer = null;
  if (featuredItems.length < 2) return;
  featuredTimer = setInterval(() => setFeaturedSlide(featuredIndex + 1), 5000);
}

function shuffleFeaturedItems(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderFeaturedCarousel(results, type) {
  featuredItems = shuffleFeaturedItems(results).slice(0, 12);
  featuredIndex = 0;
  featuredTrack.style.transform = 'translateX(0)';
  featuredTrack.innerHTML = featuredItems.map((item, index) => featuredSlide(item, index, featuredItems.length, type)).join('');
  featuredControls.innerHTML = featuredItems.map((item, index) => `<button type="button" class="featured-dot${index === 0 ? ' is-active' : ''}" data-featured-dot="${index}" aria-label="${index === 0 ? 'Current title: ' : 'Show '}${escapeHtml(titleOf(item))}" aria-pressed="${index === 0}"><span></span></button>`).join('');
  featuredControls.classList.toggle('hidden', featuredItems.length < 2);
  featuredPrev.classList.toggle('hidden', featuredItems.length < 2);
  featuredNext.classList.toggle('hidden', featuredItems.length < 2);
  setFeaturedSlide(0);
  startFeaturedTimer();
}

async function loadFeaturedRail() {
  const requestId = ++activeFeaturedRequest;
  const type = mediaType;
  const label = type === 'tv' ? 'Popular TV Shows' : 'Popular Movies';
  featuredKicker.textContent = label.toUpperCase();
  featuredHeading.innerHTML = `${type === 'tv' ? 'Popular TV shows' : 'Popular movies'}<span class="red-dot">.</span>`;
  document.getElementById('heroPanel').setAttribute('aria-label', label);
  if (featuredTimer) clearInterval(featuredTimer);
  featuredTimer = null;
  featuredItems = [];
  featuredControls.innerHTML = '';
  featuredControls.classList.add('hidden');
  featuredPrev.classList.add('hidden');
  featuredNext.classList.add('hidden');
  featuredTrack.style.transition = 'none';
  featuredTrack.style.transform = 'translateX(0)';
  featuredTrack.innerHTML = `<div class="featured-message">Loading ${type === 'tv' ? 'popular TV shows' : 'popular movies'}…</div>`;
  if (!tmdbConfigured) {
    featuredTrack.innerHTML = '<div class="featured-message">Popular titles will appear here once the catalogue is configured.</div>';
    return;
  }
  try {
    const data = await tmdbFetch(type === 'tv' ? '/tv/popular' : '/movie/popular', { language: 'en-US', page: 1 });
    if (requestId !== activeFeaturedRequest || type !== mediaType) return;
    let results = (data.results || []).map(item => ({ ...item, media_type: type }));
    if (type === 'tv') results = results.filter(isReleasedTv);
    if (!results.length) {
      featuredTrack.innerHTML = '<div class="featured-message">No popular titles are available right now.</div>';
      return;
    }
    renderFeaturedCarousel(results, type);
    requestAnimationFrame(() => { featuredTrack.style.transition = ''; });
  } catch (error) {
    if (requestId !== activeFeaturedRequest) return;
    featuredTrack.innerHTML = '<div class="featured-message">Popular titles could not load. Please check your connection.</div>';
    console.warn('Popular title carousel could not load', error);
  }
}

function draw() {
  let visible = [...items];
  if (personId) visible = visible.filter(item => (item.media_type || 'movie') === mediaType);
  const activeGenre = genreFilter.value;
  const activeYear = yearFilter.value;
  const activeLanguage = languageFilter.value;
  visible = visible.filter(item => {
    const type = typeOf(item);
    const genres = (item.genre_ids || []).map(id => Number(id));
    const date = dateOf(item);
    // TMDB can include announced shows with future first-air dates. Never show them in TV galleries.
    const released = type !== 'tv' || isReleasedTv(item);
    return released && (!activeGenre || genres.includes(Number(activeGenre))) &&
      (!activeYear || date.startsWith(activeYear)) &&
      (!activeLanguage || String(item.original_language || '').toLowerCase() === activeLanguage.toLowerCase());
  });
  grid.innerHTML = visible.map(card).join('');
  grid.classList.toggle('hidden', visible.length === 0);
  empty.classList.toggle('hidden', visible.length > 0);
  document.getElementById('resultCount').textContent = `${visible.length} ${visible.length === 1 ? 'title' : 'titles'}`;
  updateSearchPresentation(visible.length);
  const heading = personId ? `More from ${escapeHtml(personName)}` : committedQuery ? 'Search results' : isTrendingTvView() ? 'Trending TV Shows' : mediaType === 'tv' ? 'TV Shows' : 'Popular movies';
  document.getElementById('libraryHeading').innerHTML = `${heading}<span class="red-dot">.</span>`;
  const activeN = [activeGenre, activeYear, activeLanguage].filter(Boolean).length;
  filterCount.textContent = String(activeN);
  filterCount.classList.toggle('hidden', activeN === 0);
  const summaries = [];
  if (activeGenre) summaries.push(genreNames.get(`${mediaType}:${activeGenre}`) || 'Genre');
  if (activeYear) summaries.push(activeYear);
  if (activeLanguage) summaries.push(languageNames.get(activeLanguage) || activeLanguage.toUpperCase());
  filterSummary.textContent = summaries.join(' · ');
  filterSummary.classList.toggle('hidden', summaries.length === 0);
  personBanner.classList.toggle('hidden', !personId);
  document.getElementById('personHeading').textContent = personName;
  document.getElementById('personSubheading').textContent = `Explore other movies and TV shows featuring ${personName}.`;
}

function fillYears() {
  const now = new Date().getFullYear();
  const firstYear = 1900;
  const years = Array.from({ length: Math.max(0, now - firstYear + 1) }, (_, i) => now - i).filter(y => y >= firstYear);
  yearFilter.innerHTML = '<option value="">All years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}
async function loadFilters() {
  fillYears();
  const [movieGenres, tvGenres, languages] = await Promise.all([
    tmdbFetch('/genre/movie/list', { language: 'en-US' }),
    tmdbFetch('/genre/tv/list', { language: 'en-US' }),
    tmdbFetch('/configuration/languages')
  ]);
  genreNames.clear();
  (movieGenres.genres || []).forEach(g => genreNames.set(`movie:${g.id}`, g.name));
  (tvGenres.genres || []).forEach(g => genreNames.set(`tv:${g.id}`, g.name));
  const langList = (languages || []).filter(x => x.iso_639_1 && x.english_name).sort((a,b) => a.english_name.localeCompare(b.english_name));
  languageNames = new Map(langList.map(x => [x.iso_639_1, x.english_name]));
  fillGenreOptions();
  languageFilter.innerHTML = '<option value="">All languages</option>' + langList.map(l => `<option value="${escapeHtml(l.iso_639_1)}">${escapeHtml(l.english_name)}</option>`).join('');
}
function fillGenreOptions() {
  const oldValue = genreFilter.value;
  const list = [...genreNames.entries()].filter(([key]) => key.startsWith(`${mediaType}:`)).map(([key,name]) => ({ id:key.split(':')[1], name })).sort((a,b)=>a.name.localeCompare(b.name));
  genreFilter.innerHTML = '<option value="">All genres</option>' + list.map(g=>`<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('');
  genreFilter.value = list.some(x => x.id === oldValue) ? oldValue : '';
}
function requestParams(nextPage) {
  let sortBy = sort.value;
  if (mediaType === 'tv') {
    if (sortBy === 'primary_release_date.desc') sortBy = 'first_air_date.desc';
    if (sortBy === 'title.asc') sortBy = 'name.asc';
  }
  const params = { page: nextPage, sort_by: sortBy, language: 'en-US' };
  if (mediaType === 'tv') {
    params['first_air_date.lte'] = todayIsoDate();
    params.include_null_first_air_dates = false;
  }
  if (genreFilter.value) params.with_genres = genreFilter.value;
  if (yearFilter.value) params[mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = yearFilter.value;
  if (languageFilter.value) params.with_original_language = languageFilter.value;
  if (committedQuery) {
    const searchParams = { query: committedQuery, page: nextPage, language: 'en-US' };
    if (yearFilter.value) searchParams[mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = yearFilter.value;
    return searchParams;
  }
  return params;
}
function catalogEndpoint(nextPage) {
  if (committedQuery) return `/search/${mediaType}`;
  // The default TV gallery should reflect what is trending now, not future announced series.
  if (isTrendingTvView()) return '/trending/tv/week';
  return `/discover/${mediaType}`;
}
async function getPersonCredits() {
  const [movieCredits, tvCredits] = await Promise.all([
    tmdbFetch(`/person/${encodeURIComponent(personId)}/movie_credits`, { language: 'en-US' }),
    tmdbFetch(`/person/${encodeURIComponent(personId)}/tv_credits`, { language: 'en-US' })
  ]);
  const all = [
    ...(movieCredits.cast || []).map(x => ({ ...x, media_type: 'movie' })),
    ...(tvCredits.cast || []).map(x => ({ ...x, media_type: 'tv' }))
  ];
  const unique = new Map();
  all.forEach(x => { const key = `${x.media_type}:${x.id}`; if (!unique.has(key)) unique.set(key, x); });
  return [...unique.values()].sort((a,b) => Number(b.popularity || 0) - Number(a.popularity || 0));
}
async function loadCatalog({ append = false } = {}) {
  if (!tmdbConfigured) {
    grid.innerHTML = '<div class="setup-notice"><strong>Catalogue setup needed</strong><p>Please check the website configuration to enable the automatic movie and TV library.</p></div>';
    document.getElementById('resultCount').textContent = 'Setup needed';
    loadMoreButton.classList.add('hidden');
    return;
  }
  const thisRequest = ++activeRequest;
  if (!append) {
    page = 1;
    items = [];
    grid.innerHTML = '<div class="loading-card">Loading titles…</div>';
    grid.classList.remove('hidden');
    empty.classList.add('hidden');
  }
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = 'Loading…';
  try {
    let data;
    if (personId) {
      if (!append) items = await getPersonCredits();
      data = { results: [], total_pages: 1 };
    } else {
      const path = catalogEndpoint(page);
      const params = path === '/trending/tv/week'
        ? { page, language: 'en-US' }
        : requestParams(page);
      data = await tmdbFetch(path, params);
      const results = (data.results || []).map(item => ({ ...item, media_type: mediaType }));
      items = append ? items.concat(results) : results;
      totalPages = Math.min(Number(data.total_pages || 1), 500);
    }
    if (thisRequest !== activeRequest) return;
    draw();
    const remaining = personId ? false : page < totalPages;
    loadMoreButton.classList.toggle('hidden', !remaining);
    paginationNote.textContent = personId
      ? 'Showing other titles featuring this person.'
      : isTrendingTvView()
        ? 'Trending this week · unreleased and future-dated TV shows are hidden.'
        : mediaType === 'tv'
          ? `Released TV series only (first-air date up to ${todayIsoDate()}). Page ${page} of ${totalPages}.`
          : `Page ${page} of ${totalPages}. Load more to continue browsing.`;
  } catch (error) {
    if (thisRequest !== activeRequest) return;
    grid.innerHTML = `<div class="setup-notice"><strong>Could not load titles</strong><p>${escapeHtml(error.message || error)}</p><p>Please check the site configuration and network connection.</p></div>`;
    document.getElementById('resultCount').textContent = 'API error';
    loadMoreButton.classList.add('hidden');
  } finally {
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = 'Load more titles';
  }
}
function applySearch() {
  committedQuery = search.value.trim();
  updateSearchPresentation(0);
  if (personId) {
    personId = '';
    const url = new URL(location.href); url.searchParams.delete('person'); url.searchParams.delete('personName'); history.replaceState({}, '', url);
  }
  loadCatalog();
  if (committedQuery) window.setTimeout(() => browseSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}
function clearFilters() {
  genreFilter.value = '';
  yearFilter.value = '';
  languageFilter.value = '';
  sort.value = 'popularity.desc';
  committedQuery = '';
  search.value = '';
  personId = '';
  const url = new URL(location.href); url.searchParams.delete('person'); url.searchParams.delete('personName'); history.replaceState({}, '', url);
  draw();
  loadCatalog();
}

featuredPrev.addEventListener('click', () => setFeaturedSlide(featuredIndex - 1, true));
featuredNext.addEventListener('click', () => setFeaturedSlide(featuredIndex + 1, true));
featuredControls.addEventListener('click', event => {
  const dot = event.target.closest('[data-featured-dot]');
  if (dot) setFeaturedSlide(Number(dot.dataset.featuredDot), true);
});

document.getElementById('searchForm').addEventListener('submit', e => { e.preventDefault(); applySearch(); search.blur(); });
search.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applySearch(); search.blur(); } });
mediaButtons.forEach(button => button.addEventListener('click', () => {
  mediaType = button.dataset.media;
  sort.value = 'popularity.desc';
  mediaButtons.forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', String(other === button)); });
  fillGenreOptions();
  fillYears();
  loadFeaturedRail();
  loadCatalog();
}));
sort.addEventListener('change', () => loadCatalog());
document.getElementById('openFilters').addEventListener('click', () => { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); });
document.getElementById('closeFilters').addEventListener('click', () => dialog.close ? dialog.close() : dialog.removeAttribute('open'));
document.getElementById('applyFilters').addEventListener('click', () => { dialog.close ? dialog.close() : dialog.removeAttribute('open'); loadCatalog(); });
document.getElementById('clearFilters').addEventListener('click', () => { genreFilter.value = ''; yearFilter.value = ''; languageFilter.value = ''; sort.value = 'popularity.desc'; fillYears(); committedQuery = ''; search.value = ''; draw(); loadCatalog(); });
loadMoreButton.addEventListener('click', () => { if (page < totalPages) { page += 1; loadCatalog({ append: true }); } });
document.getElementById('clearEmptyFilters').addEventListener('click', clearFilters);
document.getElementById('clearPerson').addEventListener('click', clearFilters);
document.getElementById('clearSearchButton').addEventListener('click', clearFilters);

(async function init() {
  if (personId) {
    const url = new URL(location.href);
    personName = url.searchParams.get('personName') || `Cast member ${personId}`;
    // Person credits can include titles from both content types. Render movies by default.
    mediaType = 'movie';
    mediaButtons.forEach(button => { button.classList.toggle('active', button.dataset.media === mediaType); button.setAttribute('aria-pressed', String(button.dataset.media === mediaType)); });
  }
  try { if (tmdbConfigured) await loadFilters(); }
  catch (error) { console.warn('TMDB filter metadata could not load', error); }
  await Promise.all([loadFeaturedRail(), loadCatalog()]);
})();

// Start the play animation at the exact moment the finger/mouse presses a poster.
// Navigation then waits briefly so the animation is visible before opening the title.
// Modified clicks (Ctrl/Cmd-click, middle-click, etc.) keep normal browser behavior.
grid.addEventListener('pointerdown', (event) => {
  const link = event.target.closest('a.movie-card');
  if (!link || !grid.contains(link) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  link.classList.add('is-opening');
  link.dataset.aplexPressStarted = 'true';

  // If the press is cancelled and no click follows, clear the temporary state.
  window.setTimeout(() => {
    if (link.dataset.aplexNavigationPending !== 'true') {
      link.classList.remove('is-opening');
      delete link.dataset.aplexPressStarted;
    }
  }, 1100);
});

grid.addEventListener('pointercancel', (event) => {
  const link = event.target.closest('a.movie-card');
  if (!link || link.dataset.aplexNavigationPending === 'true') return;
  link.classList.remove('is-opening');
  delete link.dataset.aplexPressStarted;
});

grid.addEventListener('click', (event) => {
  const link = event.target.closest('a.movie-card');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target && link.target !== '_self') return;
  event.preventDefault();
  if (link.dataset.aplexNavigationPending === 'true') return;

  // Keyboard activation also gets the same animation if there was no pointerdown.
  link.classList.add('is-opening');
  link.dataset.aplexNavigationPending = 'true';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => { window.location.href = link.href; }, reducedMotion ? 80 : 420);
});
