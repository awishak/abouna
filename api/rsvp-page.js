// watchabouna.com/rsvp?s=<id> is served through here so a link sent over text
// has a preview of its own: Messages reads the page without running its
// script, so the screening's name and date have to be in the HTML already.
// This fetches the static rsvp.html from the same deployment and writes the
// share tags for that screening into its head. Everything else on the page is
// untouched. If the fetch fails, the visitor is sent to /rsvp.html, which is
// the same page without the tags.
import { ID, find } from './_screenings.js';

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SITE = 'https://www.watchabouna.com';

export default async function handler(req, res) {
  const id = String((req.query && req.query.s) || '').trim().slice(0, 40);
  const s = ID.test(id) ? find(id) : null;
  const host = req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  let html = '';
  try {
    const r = await fetch(proto + '://' + host + '/rsvp.html');
    if (r.ok) html = await r.text();
  } catch (e) { console.error(e); }
  if (!html.includes('</head>')) {
    res.statusCode = 302;
    res.setHeader('location', '/rsvp.html' + (id ? '?s=' + encodeURIComponent(id) : ''));
    return res.end();
  }
  // Andrew, 2026-11-16: the title starts "Register for", and the line under the title leaves out "Free".
  const title = s && s.open ? 'Register for the Abouna Episode Two screening in ' + s.city : 'Register for an Abouna Episode Two screening';
  const line = s && s.open ? s.when + (s.time ? ', ' + s.time : '') + '. ' + s.venue + '.' : 'Register for a screening of Abouna Episode Two.';
  const poster = s && s.open && s.poster ? s.poster : '';
  const IMAGE = SITE + (poster || '/og-image.png');
  const tags = '<meta property="og:title" content="' + esc(title) + '">\n'
    + '<meta property="og:description" content="' + esc(line) + '">\n'
    + '<meta property="og:image" content="' + IMAGE + '">\n'
    + '<meta property="og:url" content="https://www.watchabouna.com/rsvp' + (s ? '?s=' + s.id : '') + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<meta name="twitter:title" content="' + esc(title) + '">\n'
    + '<meta name="twitter:description" content="' + esc(line) + '">\n'
    + '<meta name="twitter:image" content="' + IMAGE + '">\n';
  html = html
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(line) + '">')
    .replace('</head>', tags + '</head>');
  // The screening's own poster goes into the page here, so the picture is right before the script runs.
  if (poster) html = html.replace('src="/poster-episode-two-web.jpg"', 'src="' + poster + '"').replace('alt="Abouna Episode Two poster"', 'alt="Abouna Episode Two poster, ' + esc(s.city) + '"');
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=60');
  res.end(html);
}
