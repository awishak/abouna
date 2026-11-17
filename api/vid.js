// watchabouna.com/vid/<token>: one page per priest or bishop with Andrew's recorded message
// and the episode, so he knows who opened it. Slate (drewi.sh/slate/abouna, Marketing, To
// clergy) publishes the links to the andrewishak_data row 'abouna-vid' on every save:
// { text, links: { token: { name, video, id } } }, the same video for every priest and a
// special one per bishop. This reads that row, shows the page, and keeps one row per
// token, 'abouna-vid:<token>': { opens: [{ at }], first, last, pct }.
//
// GET  /vid/<token>  (vercel.json rewrites it to ?t=)   the page; an unknown token gets the site's front
// GET  /vid/<token>?preview=1                            the same page for Andrew to look at; nothing is counted
//
// The video is a Vimeo or a YouTube link (2026-11-16, Andrew: "it might be Vimeo, might be YouTube"). The message
// above the video can be empty; the page is then the name and the video.
// POST { t, seen: 1 }                                     the page loaded in a browser (not a link preview), one open
// POST { t, pct }                                         how far the video got, kept as the furthest so far
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are the values api/press.js already uses.
const KEY = 'abouna-vid';
const PREFIX = 'abouna-vid:';
const TOKEN = /^[a-z0-9]{8,24}$/;

function db(path, init = {}) {
  return fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json', ...(init.headers || {}) }
  });
}
async function read(key) {
  const r = await db('andrewishak_data?select=data&key=eq.' + encodeURIComponent(key));
  const rows = r.ok ? await r.json() : [];
  return rows[0] ? rows[0].data : null;
}
async function upsert(key, data) {
  const r = await db('andrewishak_data?on_conflict=key', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }) });
  return r.ok;
}
function body(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(String(req.body)); } catch (e) { return {}; }
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A Vimeo address in any of its shapes to the player's: vimeo.com/123, vimeo.com/123/abcdef (unlisted), player.vimeo.com/video/123?h=abcdef.
// A YouTube one too: youtube.com/watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID, /live/ID.
function player(video) {
  const v = String(video || '').trim();
  const y = v.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (y) return { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/' + y[1] + '?enablejsapi=1&rel=0&playsinline=1' };
  const m = v.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?(?:[?&]h=([a-z0-9]+))?/i) || v.match(/^(\d+)$/);
  if (!m) return null;
  const h = m[2] || m[3];
  return { kind: 'vimeo', src: 'https://player.vimeo.com/video/' + m[1] + (h ? '?h=' + h + '&' : '?') + 'title=0&byline=0&portrait=0&dnt=1' };
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).end('Not set up yet.');
  try {
    if (req.method === 'POST') return await post(req, res);
    if (req.method === 'GET') return await page(req, res);
    res.setHeader('allow', 'GET, POST');
    return res.status(405).end('GET or POST');
  } catch (e) {
    console.error(e);
    return res.status(500).end('Something broke on our side. Try again in a minute.');
  }
}

async function post(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  const b = body(req);
  const t = String(b.t || '');
  if (!TOKEN.test(t)) return res.status(400).end(JSON.stringify({ error: 'not a link' }));
  const links = ((await read(KEY)) || {}).links || {};
  if (!links[t]) return res.status(404).end(JSON.stringify({ error: 'no such link' }));
  const row = (await read(PREFIX + t)) || { opens: [], first: '', last: '', pct: 0 };
  const at = new Date().toISOString();
  if (b.seen) { row.opens = (row.opens || []).concat([{ at }]).slice(-500); row.first = row.first || at; row.last = at; }
  const pct = Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0)));
  if (pct > (row.pct || 0)) row.pct = pct;
  if (b.pct !== undefined) row.last = at;
  if (!(await upsert(PREFIX + t, row))) return res.status(502).end(JSON.stringify({ error: 'could not save' }));
  return res.status(200).end(JSON.stringify({ ok: true }));
}

async function page(req, res) {
  const t = String((req.query || {}).t || '');
  const kit = (await read(KEY)) || {};
  const link = TOKEN.test(t) ? (kit.links || {})[t] : null;
  if (!link) { res.statusCode = 302; res.setHeader('location', '/'); return res.end(); }
  const pl = player(link.video);
  const src = pl ? pl.src : '';
  const preview = !!(req.query || {}).preview;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('x-robots-tag', 'noindex, nofollow');
  return res.status(200).end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>For ${esc(link.name)} | ABOUNA</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
<style>
  .page { max-width: 960px; margin: 0 auto; padding: var(--s4) var(--s3) var(--s5); }
  h1 { font-family: var(--serif); font-weight: 600; font-size: clamp(44px, 7vw, 72px); line-height: 0.98; margin: var(--s1) 0 var(--s3); }
  .words { font-size: 21px; color: var(--ink2); max-width: 62ch; white-space: pre-line; margin-bottom: var(--s4); }
  .frame { position: relative; aspect-ratio: 16 / 9; background: var(--tile); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .from { margin-top: var(--s3); color: var(--ink2); font-size: 17px; }
</style>
</head>
<body>
<main class="page">
  <p class="label">Abouna, Episode 2</p>
  <h1>For ${esc(link.name)}</h1>
  ${kit.text ? `<p class="words">${esc(kit.text)}</p>` : ''}
  ${preview ? '<p class="from" style="margin:0 0 var(--s3)">You are looking at this page the way it will arrive. Nothing here is counted.</p>' : ''}
  ${src ? `<div class="frame"><iframe id="v" src="${esc(src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Abouna, Episode 2"></iframe></div>` : ''}
  <p class="from">Andrew Ishak, <a href="mailto:aishak@scu.edu">aishak@scu.edu</a></p>
</main>
${pl && pl.kind === 'vimeo' ? '<script src="https://player.vimeo.com/api/player.js"></script>' : ''}
<script>
(function(){
  if(${preview ? 'true' : 'false'})return; // Andrew looking at the page: nothing is counted
  var t=${JSON.stringify(t)}, sent=0, top=0, timer=null;
  var send=function(b){try{navigator.sendBeacon('/api/vid',new Blob([JSON.stringify(Object.assign({t:t},b))],{type:'application/json'}))}catch(e){fetch('/api/vid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({t:t},b)),keepalive:true}).catch(function(){})}};
  send({seen:1});
  var f=document.getElementById('v');if(!f)return;
  var far=function(pct){if(pct>top){top=pct;if(!timer)timer=setTimeout(function(){timer=null;if(top>sent){sent=top;send({pct:top})}},15000)}};
  var end=function(){top=100;sent=100;send({pct:100})};
  addEventListener('pagehide',function(){if(top>sent){sent=top;send({pct:top})}});
  if(${JSON.stringify(pl ? pl.kind : '')}==='youtube'){
    // YouTube has no progress event, so the player is asked where it is every five seconds while it plays.
    var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);
    window.onYouTubeIframeAPIReady=function(){var tick=null;var yp=new YT.Player('v',{events:{onStateChange:function(e){
      if(e.data===0){clearInterval(tick);tick=null;return end()}
      if(e.data===1&&!tick)tick=setInterval(function(){try{var d=yp.getDuration();if(d>0)far(Math.round(yp.getCurrentTime()/d*100))}catch(x){}},5000);
      if(e.data!==1&&tick){clearInterval(tick);tick=null;try{var d2=yp.getDuration();if(d2>0)far(Math.round(yp.getCurrentTime()/d2*100))}catch(x){}}
    }}})};
    return;
  }
  if(!window.Vimeo)return;
  var p=new Vimeo.Player(f);
  p.on('timeupdate',function(d){far(Math.round((d.percent||0)*100))});
  p.on('ended',end);
})();
</script>
</body>
</html>`);
}
