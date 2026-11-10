const TMDB_API_KEY = process.env.TMDB_API_KEY || '2e45f250dd9649f9c4ac88eb2f62a624';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const firstHeader = (value) => Array.isArray(value) ? value[0] : value;
function siteOrigin(req) {
  const proto = String(firstHeader(req.headers['x-forwarded-proto']) || 'https').split(',')[0].trim();
  const host = String(firstHeader(req.headers['x-forwarded-host']) || req.headers.host || '').split(',')[0].trim();
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return 'https://example.invalid';
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}
function htmlResponse(res, html) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'User-Agent');
  res.end(html);
}
function isCrawler(req) {
  const ua = String(firstHeader(req.headers['user-agent']) || '');
  return /(WhatsApp|facebookexternalhit|Facebot|meta-externalagent|meta-externalfetcher|Twitterbot|TelegramBot|Discordbot|LinkedInBot|Slackbot|Pinterestbot|Googlebot)/i.test(ua);
}
function metadataPage({ origin, shareUrl, title, description, image, imageWidth, imageHeight, type, favicon, id }) {
  const pageTitle = `${title} — APLEX Movies`;
  const imageAlt = `${title} cover artwork`;
  const ogType = type === 'movie' ? 'video.movie' : 'website';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pageTitle)}</title><meta name="description" content="${escapeHtml(description)}">
<link rel="icon" href="${escapeHtml(favicon)}" type="image/svg+xml"><link rel="apple-touch-icon" href="${escapeHtml(origin + '/assets/aplex-icon.png')}">
<link rel="canonical" href="${escapeHtml(shareUrl)}">
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="APLEX Movies"><meta property="og:title" content="${escapeHtml(pageTitle)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(shareUrl)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:secure_url" content="${escapeHtml(image)}"><meta property="og:image:type" content="${image.includes('aplex-share-card-v2.png') ? 'image/png' : 'image/jpeg'}"><meta property="og:image:alt" content="${escapeHtml(imageAlt)}"><meta property="og:image:width" content="${imageWidth}"><meta property="og:image:height" content="${imageHeight}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(pageTitle)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
<meta name="theme-color" content="#080d17"></head><body style="margin:0;background:#080d17;color:#f6f7ff;font:16px system-ui,sans-serif"><main style="max-width:760px;margin:8vh auto;padding:24px"><img src="${escapeHtml(image)}" alt="" style="display:block;width:100%;max-height:430px;object-fit:cover;border-radius:18px;border:1px solid #2b3850"><p style="color:#ff4f79;font-weight:800;letter-spacing:.12em;font-size:12px">APLEX MOVIES</p><h1>${escapeHtml(title)}</h1><p style="color:#aeb8cc;line-height:1.7">${escapeHtml(description)}</p><a href="${escapeHtml(origin + '/movie.html?id=' + encodeURIComponent(id) + '&type=' + encodeURIComponent(type))}" style="color:#fff">Open APLEX Movies</a></main></body></html>`;
}
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end('Method not allowed'); }
  const origin = siteOrigin(req);
  const type = String(req.query.type || 'movie') === 'tv' ? 'tv' : 'movie';
  const id = String(req.query.id || '');
  if (!/^\d{1,12}$/.test(id)) { res.statusCode = 302; res.setHeader('Location', origin + '/'); return res.end(); }
  const shareUrl = `${origin}/share/${type}/${id}`;
  const detailUrl = `${origin}/movie.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
  if (!isCrawler(req)) { res.statusCode = 302; res.setHeader('Location', detailUrl); res.setHeader('Cache-Control','no-store, max-age=0'); return res.end(); }

  let title = 'Discover movies and TV shows';
  let description = 'Explore movie and TV series details, trailers, cast and more on APLEX Movies.';
  let image = `${origin}/assets/aplex-share-card-v2.png`;
  let imageWidth = 1200;
  let imageHeight = 630;
  try {
    const url = new URL(`${BASE}/${type}/${encodeURIComponent(id)}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'en-US');
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      title = data.title || data.name || title;
      description = String(data.overview || '').trim() || `${title} on APLEX Movies. Explore the synopsis, release details, rating and more.`;
      if (description.length > 260) description = description.slice(0, 257).trimEnd() + '…';
      const artwork = data.backdrop_path || data.poster_path;
      if (artwork) {
        image = `${IMG}${data.backdrop_path ? 'w1280' : 'w780'}${artwork}`;
        imageWidth = data.backdrop_path ? 1280 : 780;
        imageHeight = data.backdrop_path ? 720 : 1170;
      }
    }
  } catch (_) { /* Keep the branded fallback when TMDB cannot be reached. */ }

  const html = metadataPage({ origin, shareUrl, title, description, image, imageWidth, imageHeight, type, favicon: `${origin}/assets/favicon.svg`, id });
  return htmlResponse(res, html);
};
