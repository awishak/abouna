// watchabouna.com/rsvp and /signups: sign-ups for a dated screening, one row
// per person. Each row sits in andrewishak_data, the key-value table the
// drewi.sh functions use on the same Supabase project. The key is
// 'abouna-rsvp:<screening>:<hash of the email>', so the same email signing up
// twice stays one row. Mailchimp is not touched here: the
// page posts to the list itself when the box is ticked, the way /signup does.
//
// GET  ?s=<id>                  what the sign-up page shows: city, date, venue
// GET  ?s=<id>&k=<host key>     the host's view: seats and names, no emails
// GET  ?all=1&k=<admin code>    Andrew's view: every screening, every sign-up, each host link
// POST { s, people: [{ first, last, email } or { first, last, kid: true }], list }   saves a row per person; { ok, count, people } back
//
// ABOUNA_ADMIN_CODE is the password for /signups. A screening's host key is
// derived from it, so handing a priest a link needs no table: copy it off the
// admin view. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are the same values
// the andrewishak project holds.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SCREENINGS, ID, find } from './_screenings.js';

const PREFIX = 'abouna-rsvp:';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,24}$/;
const MAX = 6; // people on one form

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
const pub = (s) => ({ id: s.id, city: s.city, date: s.date, when: s.when, venue: s.venue, address: s.address || '', time: s.time || '', note: s.note, tba: !!s.tba, open: s.open });
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
      out.push({ ...pub(s), seats: seats(people), host: 'https://watchabouna.com/signups?s=' + s.id + '&k=' + hostKey(s.id), people });
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

// One row per person. The first person is whoever filled in the form; anyone
// they add needs a name and an email of their own, and is saved with `by` set
// to the first person's email. Rows saved before 2026-11-16 can carry a party
// size above one from the old "how many are coming" box; those sizes are kept.
// A child under 16 (`kid: true`, never the first person) has no email: the row
// is keyed on the first person's email plus the child's name.
async function post(req, res) {
  const b = body(req);
  const id = str(b.s, 40);
  const s = ID.test(id) ? find(id) : null;
  if (!s || !s.open) return send(res, 404, { error: 'Sign-ups are not open for that screening.' });
  if (str(b.web, 10)) return send(res, 200, { ok: true, screening: pub(s), people: [] }); // the hidden box only a script fills
  // The page before 2026-11-16 sent one person at the top level; a copy of that page still open in a tab keeps working.
  const given = Array.isArray(b.people) ? b.people : [{ first: b.first, last: b.last, email: b.email }];
  if (given.length < 1 || given.length > MAX) return send(res, 400, { error: 'One form takes up to ' + MAX + ' people.' });
  const list = b.list === true || b.list === 'true' || b.list === '1' || b.list === 'on';

  const people = [];
  for (let i = 0; i < given.length; i++) {
    const g = given[i] && typeof given[i] === 'object' ? given[i] : {};
    const kid = i > 0 && (g.kid === true || g.kid === 'true');
    const p = { first: str(g.first, 60), last: str(g.last, 60), email: kid ? '' : str(g.email, 160).toLowerCase(), kid };
    if (!p.first) return send(res, 400, { error: 'First name is missing.', at: i, field: 'first' });
    if (!p.last && Array.isArray(b.people)) return send(res, 400, { error: 'Last name is missing.', at: i, field: 'last' });
    if (!kid && !EMAIL.test(p.email)) return send(res, 400, { error: 'That email does not look right.', at: i, field: 'email' });
    if (!kid && people.some((o) => o.email === p.email)) return send(res, 400, { error: 'Each person needs their own email.', at: i, field: 'email' });
    const who = kid ? people[0].email + '|' + (p.first + ' ' + p.last).toLowerCase() : p.email;
    if (kid && people.some((o) => o.who === who)) return send(res, 400, { error: 'That name is on the form twice.', at: i, field: 'first' });
    p.who = who;
    p.key = PREFIX + s.id + ':' + createHash('sha256').update(who).digest('hex').slice(0, 16);
    people.push(p);
  }

  const was = await db('andrewishak_data?select=key,data&key=in.(' + encodeURIComponent(people.map((p) => '"' + p.key + '"').join(',')) + ')');
  if (!was.ok) throw new Error('db read ' + was.status);
  const old = new Map((await was.json()).map((x) => [x.key, x.data || {}]));

  const at = new Date().toISOString();
  const write = [];
  people.forEach((p, i) => {
    const o = old.get(p.key);
    if (o && i > 0) return; // somebody added a person who is already registered: that person's row stays as they left it
    const data = { s: s.id, first: p.first, last: p.last, email: p.email, count: Math.max(1, Number(o && o.count) || 1), list: i === 0 ? list || !!(o && o.list) : false, at: (o && o.at) || at };
    if (p.kid) data.kid = true;
    if (i > 0) data.by = people[0].email;
    else if (o && o.by) data.by = o.by;
    write.push({ key: p.key, data, updated_at: at });
  });
  if (write.length) {
    // Every write asks for the rows back, and the answer waits for them.
    const r = await db('andrewishak_data?on_conflict=key&select=key', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(write)
    });
    const back = r.ok ? await r.json().catch(() => []) : [];
    if (back.length !== write.length) throw new Error('db write ' + r.status + ' ' + (r.ok ? back.length + ' of ' + write.length + ' rows back' : (await r.text()).slice(0, 200)));
  }
  return send(res, 200, { ok: true, screening: pub(s), count: people.length, people: people.map((p) => ({ name: (p.first + ' ' + p.last).trim() })) });
}
