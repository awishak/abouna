// watchabouna.com/rsvp and /host: sign-ups for a dated screening, with a head
// count. Each sign-up is one row in andrewishak_data, the key-value table the
// drewi.sh functions use on the same Supabase project. The key is
// 'abouna-rsvp:<screening>:<hash of the email>', so signing up twice updates
// the party size instead of doubling it. Mailchimp is not touched here: the
// page posts to the list itself when the box is ticked, the way /signup does.
//
// GET  ?s=<id>                  what the sign-up page shows: city, date, venue
// GET  ?s=<id>&k=<host key>     the host's view: seats and names, no emails
// GET  ?all=1&k=<admin code>    Andrew's view: every screening, every sign-up, each host link
// POST { s, first, last, email, count, list }   saves one sign-up; { ok, count } back
//
// ABOUNA_ADMIN_CODE is the password for /host. A screening's host key is
// derived from it, so handing a priest a link needs no table: copy it off the
// admin view. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are the same values
// the andrewishak project holds.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SCREENINGS, ID, find } from './_screenings.js';

const PREFIX = 'abouna-rsvp:';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,24}$/;

function db(path, init = {}) {
  return fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

function same(given, want) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(want || ''));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function body(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  const s = String(req.body);
  try { return JSON.parse(s); } catch (e) {}
  return Object.fromEntries(new URLSearchParams(s));
}

const hostKey = (id) => createHmac('sha256', String(process.env.ABOUNA_ADMIN_CODE || '')).update('host:' + id).digest('hex').slice(0, 20);
const pub = (s) => ({ id: s.id, city: s.city, date: s.date, when: s.when, venue: s.venue, note: s.note, open: s.open });
const str = (x, max) => String(x == null ? '' : x).trim().slice(0, max);
const seats = (people) => people.reduce((n, p) => n + (Number(p.count) || 0), 0);
const byTime = (a, b) => String(a.at || '').localeCompare(String(b.at || ''));
const send = (res, status, obj) => res.status(status).end(JSON.stringify(obj));

async function rows(id) {
  const r = await db('andrewishak_data?select=data&key=like.' + encodeURIComponent(PREFIX + id + ':*'));
  if (!r.ok) throw new Error('db read ' + r.status);
  return (await r.json()).map((x) => x.data).filter((d) => d && typeof d === 'object').sort(byTime);
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ABOUNA_ADMIN_CODE) return send(res, 503, { error: 'Sign-ups are not set up yet.' });
  try {
    if (req.method === 'GET') return await get(req, res);
    if (req.method === 'POST') return await post(req, res);
    res.setHeader('allow', 'GET, POST');
    return send(res, 405, { error: 'method' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Something broke on our side. Try again in a minute.' });
  }
}

async function get(req, res) {
  const q = req.query || {};
  const k = str(q.k, 80);

  if (q.all === '1') {
    if (!same(k, process.env.ABOUNA_ADMIN_CODE)) return send(res, 401, { error: 'Not it.' });
    const out = [];
    for (const s of SCREENINGS) {
      const people = await rows(s.id);
      out.push({ ...pub(s), seats: seats(people), host: 'https://watchabouna.com/host?s=' + s.id + '&k=' + hostKey(s.id), people });
    }
    return send(res, 200, { screenings: out });
  }

  const id = str(q.s, 40);
  const s = ID.test(id) ? find(id) : null;
  if (!s) return send(res, 404, { error: 'No such screening.' });
  if (!k) return send(res, 200, { screening: pub(s) });
  if (!same(k, hostKey(s.id))) return send(res, 401, { error: 'That link is not right.' });
  const people = await rows(s.id);
  return send(res, 200, {
    screening: pub(s),
    seats: seats(people),
    people: people.map((p) => ({ name: (p.first + ' ' + (p.last || '')).trim(), count: p.count }))
  });
}

async function post(req, res) {
  const b = body(req);
  const id = str(b.s, 40);
  const s = ID.test(id) ? find(id) : null;
  if (!s || !s.open) return send(res, 404, { error: 'Sign-ups are not open for that screening.' });
  const first = str(b.first, 60);
  const last = str(b.last, 60);
  const email = str(b.email, 160).toLowerCase();
  const count = Math.round(Number(b.count));
  if (!first) return send(res, 400, { error: 'What is your first name?' });
  if (!EMAIL.test(email)) return send(res, 400, { error: 'That email does not look right.' });
  if (!(count >= 1 && count <= 10)) return send(res, 400, { error: 'How many are coming? One to ten.' });
  const list = b.list === true || b.list === 'true' || b.list === '1' || b.list === 'on';

  const key = PREFIX + s.id + ':' + createHash('sha256').update(email).digest('hex').slice(0, 16);
  const at = new Date().toISOString();
  const data = { s: s.id, first, last, email, count, list, at };
  // Every write asks for the row back, and the answer comes from that row.
  const r = await db('andrewishak_data?on_conflict=key&select=data', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ key, data, updated_at: at })
  });
  const back = r.ok ? await r.json().catch(() => []) : [];
  if (!back[0] || !back[0].data) throw new Error('db write ' + r.status + ' ' + (r.ok ? 'no row back' : (await r.text()).slice(0, 200)));
  return send(res, 200, { ok: true, screening: pub(s), count: back[0].data.count });
}
