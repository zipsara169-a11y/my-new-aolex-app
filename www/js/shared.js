import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TMDB_API_KEY } from './config.js';
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('PASTE_') && !SUPABASE_ANON_KEY.includes('PASTE_'));
export const tmdbConfigured = Boolean(TMDB_API_KEY && !TMDB_API_KEY.includes('PASTE_'));
export const supabase = supabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
export { TMDB_API_KEY };
export const imageUrl = (path, size='w500') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const yearFrom = value => value ? String(value).slice(0,4) : '—';
export function languageName(code) {
  const value = String(code || '').trim();
  if (!value) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(value.toLowerCase()) || value.toUpperCase(); }
  catch { return ({ en: 'English', si: 'Sinhala', ta: 'Tamil', hi: 'Hindi', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ar: 'Arabic', th: 'Thai', tr: 'Turkish', ru: 'Russian' })[value.toLowerCase()] || value.toUpperCase(); }
}
export const validImdbId = value => /^tt\d{5,12}$/i.test(String(value || '').trim());
export const slugify = value => String(value || 'movie').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180) || 'movie';
export async function fetchMovieMetadata(imdbId) {
  if (!tmdbConfigured) throw new Error('The catalogue connection is not configured. Check the website settings and try again.');
  const cleanId = String(imdbId || '').trim();
  if (!validImdbId(cleanId)) throw new Error('Enter a valid title reference, for example tt31170389.');
  const findUrl = new URL(`https://api.themoviedb.org/3/find/${encodeURIComponent(cleanId)}`);
  findUrl.searchParams.set('external_source', 'imdb_id');
  findUrl.searchParams.set('api_key', TMDB_API_KEY);
  const findResponse = await fetch(findUrl);
  if (!findResponse.ok) throw new Error(findResponse.status === 401 ? 'The catalogue connection was rejected. Check the website settings.' : `Title lookup failed (${findResponse.status}).`);
  const found = await findResponse.json();
  const result = (found.movie_results || [])[0];
  if (!result) throw new Error('No matching title was found. Check the reference and try again.');
  const detailsUrl = new URL(`https://api.themoviedb.org/3/movie/${result.id}`);
  detailsUrl.searchParams.set('append_to_response', 'videos');
  detailsUrl.searchParams.set('api_key', TMDB_API_KEY);
  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) throw new Error(`Movie details fetch failed (${detailsResponse.status}).`);
  const d = await detailsResponse.json();
  const videos = d.videos?.results || [];
  const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official && v.key) || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.key) || videos.find(v => v.site === 'YouTube' && v.key);
  return {
    imdb_id: cleanId,
    tmdb_id: d.id,
    title: d.title || result.title || '',
    overview: d.overview || '',
    release_date: d.release_date || '',
    language: languageName(d.original_language),
    runtime: d.runtime || null,
    rating: Number.isFinite(Number(d.vote_average)) ? Number(d.vote_average) : null,
    genres: (d.genres || []).map(g => g.name).join(', '),
    poster_url: imageUrl(d.poster_path, 'w500'),
    backdrop_url: imageUrl(d.backdrop_path, 'w1280'),
    trailer_key: trailer?.key || ''
  };
}
export function showMessage(el, message, type='info') {
  if (!el) return;
  el.textContent = message || '';
  el.className = `form-message ${message ? `message-${type}` : ''}`.trim();
}
export function friendlyError(error) {
  const msg = error?.message || String(error || 'Unknown error');
  if (/Failed to fetch/i.test(msg)) return 'Network/API connection එක පරීක්ෂා කරන්න. Supabase project එක online ද කියලත් බලන්න.';
  if (/Invalid login credentials/i.test(msg)) return 'Invalid login credentials: Supabase Auth එකේ හදපු email/password එක නැවත පරීක්ෂා කරන්න.';
  return msg;
}
