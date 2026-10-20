// watchabouna.com/request: a church or group asking for a screening. Each
// request is one row in andrewishak_data, the key-value table the drewi.sh
// functions use on the same Supabase project, under 'abouna-request:<time>-<id>'.
// Nothing is emailed; Andrew reads them on /host with his password, newest first.
//
// POST { church, city, name, email, hosted, where, when, size, expect, note }   saves one; { ok, id, contact } back
// GET  ?k=<admin code>                                                            every request, newest first
//
// ABOUNA_ADMIN_CODE, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are the values
// api/rsvp.js already uses.
import { randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'abouna-request:';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,24}$/;
const CONTACT = 'aishak@scu.edu';
const FIELDS = [['church', 120], ['city', 80], ['name', 80], ['email', 160], ['hosted', 40], ['where', 200], ['when', 200], ['size', 60], ['expect', 60], ['note', 1500]];

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

const str = (x, max) => String(x == null ? '' : x).trim().slice(0, max);
const send = (res, status, obj) => res.status(status).end(JSON.stringify(obj));

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ABOUNA_ADMIN_CODE) return send(res, 503, { error: 'Requests are not set up yet. Write to ' + CONTACT + '.' });
  try {
    if (req.method === 'GET') return await get(req, res);
    if (req.method === 'POST') return await post(req, res);
    res.setHeader('allow', 'GET, POST');
    return send(res, 405, { error: 'method' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Something broke on our side. Try again in a minute, or write to ' + CONTACT + '.' });
  }
}

async function get(req, res) {
  const q = req.query || {};
  if (!same(str(q.k, 80), process.env.ABOUNA_ADMIN_CODE)) return send(res, 401, { error: 'Not it.' });
  const r = await db('andrewishak_data?select=key,data&key=like.' + encodeURIComponent(PREFIX + '*') + '&order=key.desc');
  if (!r.ok) throw new Error('db read ' + r.status);
  const rows = (await r.json()).map((x) => ({ id: x.key.slice(PREFIX.length), ...x.data })).filter((d) => d && d.church);
  return send(res, 200, { requests: rows });
}

async function post(req, res) {
  const b = body(req);
  if (str(b.web, 10)) return send(res, 200, { ok: true, id: 'x', contact: CONTACT }); // the hidden box only a script fills
  const data = {};
  for (const [k, max] of FIELDS) data[k] = str(b[k], max);
  data.email = data.email.toLowerCase();
  if (!data.church) return send(res, 400, { error: 'Which church or group is it?' });
  if (!data.city) return send(res, 400, { error: 'Which city?' });
  if (!data.name) return send(res, 400, { error: 'What is your name?' });
  if (!EMAIL.test(data.email)) return send(res, 400, { error: 'That email does not look right.' });
  const at = new Date().toISOString();
  data.at = at;
  // The key sorts by time, so newest first is a key order; the random tail keeps two in the same second apart.
  const id = at.replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + randomBytes(3).toString('hex');
  // Every write asks for the row back, and the answer comes from that row.
  const r = await db('andrewishak_data?select=key,data', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ key: PREFIX + id, data, updated_at: at })
  });
  const back = r.ok ? await r.json().catch(() => []) : [];
  if (!back[0] || !back[0].data) throw new Error('db write ' + r.status + ' ' + (r.ok ? 'no row back' : (await r.text()).slice(0, 200)));
  const mailed = await notify(back[0].data, id);
  return send(res, 200, { ok: true, id, contact: CONTACT, mailed });
}

// One plain email to Andrew per request, through Resend (the account fieldtime
// already uses). RESEND_API_KEY, RESEND_FROM (an address at a domain verified
// there) and ABOUNA_NOTIFY (where it goes) live in Vercel; with any of them
// missing the request is still saved and nothing is sent. Reply-to is the
// person who asked, so replying in Mail answers them.
async function notify(d, id) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM, to = process.env.ABOUNA_NOTIFY;
  if (!key || !from || !to) return false;
  const line = (label, v) => (v ? label + ': ' + v + '\n' : '');
  const text = d.church + ', ' + d.city + '\n' + d.name + ' <' + d.email + '>\n\n'
    + line('Hosted before', d.hosted) + line('Where', d.where) + line('When', d.when) + line('Church size', d.size) + line('Expected', d.expect)
    + (d.note ? '\n' + d.note + '\n' : '')
    + '\nAll requests: https://watchabouna.com/host and drewi.sh/slate, Screenings.\n';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: d.email, subject: 'Screening request: ' + d.church + ', ' + d.city, text })
    });
    if (!r.ok) console.error('resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}
