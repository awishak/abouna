// Serves ~/Projects/abouna locally with the rsvp function wired in, against the
// real Supabase project (values from encore/.env) and a test admin code.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = '/Users/ishak/Projects/abouna';
for (const line of readFileSync('/Users/ishak/Projects/encore/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.ABOUNA_ADMIN_CODE = 'tiki-test';
const { default: rsvp } = await import(ROOT + '/api/rsvp.js');
const { default: press } = await import(ROOT + '/api/press.js');
const { default: request } = await import(ROOT + '/api/request.js');
const API = { '/api/rsvp': rsvp, '/api/press': press, '/api/request': request };

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (API[url.pathname]) {
    const fn = API[url.pathname];
    let raw = '';
    for await (const c of req) raw += c;
    const r = { method: req.method, query: Object.fromEntries(url.searchParams), body: raw, headers: req.headers };
    const shim = {
      status(c) { res.statusCode = c; return shim; },
      setHeader(k, v) { res.setHeader(k, v); return shim; },
      end(b) { res.end(b); return shim; },
      send(b) { res.end(b); return shim; },
      json(o) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return shim; }
    };
    try { await fn(r, shim); } catch (e) { res.statusCode = 500; res.end(String(e)); }
    return;
  }
  let p = url.pathname;
  if (p === '/rsvp') p = '/rsvp.html';
  if (p === '/signups') p = '/signups.html';
  if (p === '/host') p = '/host.html';
  if (p === '/request') p = '/request.html';
  if (p === '/press') p = '/index.html';
  if (p === '/') p = '/index.html';
  const f = join(ROOT, p);
  if (!existsSync(f)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('content-type', types[extname(f)] || 'application/octet-stream');
  res.end(readFileSync(f));
}).listen(8771, () => console.log('up 8771'));
