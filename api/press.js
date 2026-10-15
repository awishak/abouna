// watchabouna.com/api/press: the public press kit, as Slate last published it.
// Slate (drewi.sh/slate, in the andrewishak repo) writes the kit to the
// andrewishak_data row with key 'abouna-press' on every save; this hands it
// out to anyone, cached for a minute. The site's Press Kit popup reads it and
// falls back to the posters on the page when there is nothing here.
//
// GET -> { kit } or 404 { error } before the first publish, 503 before the env vars are set.
const KEY = 'abouna-press';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('access-control-allow-origin', '*');
  if (req.method !== 'GET') { res.setHeader('allow', 'GET'); return res.status(405).json({ error: 'GET' }); }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'not set up yet' });
  const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/andrewishak_data?key=eq.' + KEY + '&select=data,updated_at', {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const rows = r.ok ? await r.json() : [];
  if (!rows[0] || !rows[0].data) return res.status(404).json({ error: 'no kit yet' });
  return res.status(200).json({ kit: rows[0].data, updated: rows[0].updated_at });
}
