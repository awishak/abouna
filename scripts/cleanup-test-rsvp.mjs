// Removes the test sign-up rows (email claude-test@example.com) and nothing else.
import { readFileSync } from 'node:fs';
for (const line of readFileSync('/Users/ishak/Projects/encore/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json', prefer: 'return=representation' };
const q = 'andrewishak_data?key=like.' + encodeURIComponent('abouna-rsvp:*') + '&data->>email=eq.' + encodeURIComponent('claude-test@example.com') + '&select=key';
const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + q, { method: 'DELETE', headers: H });
const rows = r.ok ? await r.json() : [];
console.log('deleted', r.status, rows.map((x) => x.key));
const left = await fetch(process.env.SUPABASE_URL + '/rest/v1/andrewishak_data?key=like.' + encodeURIComponent('abouna-rsvp:*') + '&select=key', { headers: H });
console.log('rsvp rows left:', (await left.json()).length);
