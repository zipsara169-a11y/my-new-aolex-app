const firstHeader = (value) => Array.isArray(value) ? value[0] : value;
function originFrom(req) {
  const proto = String(firstHeader(req.headers['x-forwarded-proto']) || 'https').split(',')[0].trim();
  const host = String(firstHeader(req.headers['x-forwarded-host']) || req.headers.host || '').split(',')[0].trim();
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return 'https://example.invalid';
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
module.exports = function handler(req, res) {
  const origin = originFrom(req);
  const ua = String(firstHeader(req.headers['user-agent']) || '');
  const crawler = /(WhatsApp|facebookexternalhit|Facebot|meta-externalagent|meta-externalfetcher|Twitterbot|TelegramBot|Discordbot|LinkedInBot|Slackbot|Pinterestbot|Googlebot)/i.test(ua);
  if (!crawler) { res.statusCode = 302; res.setHeader('Location', origin + '/'); res.setHeader('Cache-Control','no-store, max-age=0'); return res.end(); }
  const title = 'APLEX Movies — Discover Your Next Movie';
  const description = 'Discover trending movies and TV series, explore posters, ratings, cast, trailers and details on APLEX Movies.';
  const image = origin + '/assets/aplex-share-card-v2.png';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'User-Agent');
  return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="icon" href="${esc(origin+'/assets/favicon.svg')}" type="image/svg+xml"><link rel="apple-touch-icon" href="${esc(origin+'/assets/aplex-icon.png')}"><link rel="canonical" href="${esc(origin+'/')}"><meta property="og:type" content="website"><meta property="og:site_name" content="APLEX Movies"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(origin+'/')}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:alt" content="APLEX Movies logo and cinematic social preview artwork"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="APLEX Movies logo and cinematic preview"><meta name="theme-color" content="#080d17"></head><body><h1>${esc(title)}</h1><p>${esc(description)}</p><img src="${esc(image)}" alt="APLEX Movies"></body></html>`);
};
