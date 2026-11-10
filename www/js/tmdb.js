import { TMDB_API_KEY } from './config.js';
export { TMDB_API_KEY };
export const tmdbConfigured = Boolean(TMDB_API_KEY && !TMDB_API_KEY.includes('PASTE_'));
export const imageUrl = (path, size = 'w500') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const yearFrom = value => value ? String(value).slice(0, 4) : '—';
export function languageName(code) {
  const value = String(code || '').trim();
  if (!value) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(value.toLowerCase()) || value.toUpperCase(); }
  catch { return ({ en: 'English', si: 'Sinhala', ta: 'Tamil', hi: 'Hindi', ko: 'Korean', ja: 'Japanese', zh: 'Chinese', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ar: 'Arabic', th: 'Thai', tr: 'Turkish', ru: 'Russian' })[value.toLowerCase()] || value.toUpperCase(); }
}
