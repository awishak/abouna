// Removes the test sign-up rows (emails claude-test...@example.com, and the children added by them) and nothing else.
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/Users/ishak/Projects/encore/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json', prefer: 'return=representation' };
const q = 'andrewishak_data?key=like.' + encodeURIComponent('abouna-rsvp:*') + '&data->>email=like.' + encodeURIComponent('claude-test*@example.com') + '&select=key';
const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + q, { method: 'DELETE', headers: H });
const r2 = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + q.replace('data->>email', 'data->>by'), { method: 'DELETE', headers: H });
const rows = (r.ok ? await r.json() : []).concat(r2.ok ? await r2.json() : []);
console.log('deleted', r.status, rows.map((x) => x.key));
const left = await fetch(process.env.SUPABASE_URL + '/rest/v1/andrewishak_data?key=like.' + encodeURIComponent('abouna-rsvp:*') + '&select=key', { headers: H });
console.log('rsvp rows left:', (await left.json()).length);
