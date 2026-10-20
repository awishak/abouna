// Drives watchabouna.com/request in the installed Google Chrome at phone and
// laptop widths: an empty send is refused, a full request goes through, the
// admin view on /host lists it, then the two design rules on every screen
// (nothing under 13px, every text colour at 4.5:1 or better). The test row it
// writes is removed at the end with the service key. Screenshots land in
// mockups/request/.
//
// Needs scripts/dev.mjs running first (admin code tiki-test):
//   node scripts/dev.mjs &
//   node scripts/check-request.mjs
// Playwright is borrowed from ../fieldtime.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = process.argv[2] || join(root, 'mockups', 'request');
await mkdir(outdir, { recursive: true });
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771';

const CONTRAST = `(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); if (p.length > 3 && p[3] === 0) return null; return p.slice(0, 3); };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const fg = rgb(cs.color); if (!fg) continue;
    let bg = null, p = el;
    while (p && !bg) { bg = rgb(getComputedStyle(p).backgroundColor); p = p.parentElement; }
    if (!bg) bg = [255, 255, 255];
    const a = lum(...fg), b = lum(...bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) out.push(el.tagName + '.' + el.className + ' ' + ratio.toFixed(2) + ' ' + cs.color + ' on ' + JSON.stringify(bg));
  }
  return out;
})()`;
const SMALL = `Array.from(document.querySelectorAll('body *')).filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).display !== 'none' && parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize)`;

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
const ids = [];
async function design(page, name) {
  const small = await page.evaluate(SMALL);
  const low = await page.evaluate(CONTRAST);
  if (small.length) { bad++; console.log(name, 'TYPE under 13px:', JSON.stringify(small.slice(0, 10))); }
  if (low.length) { bad++; console.log(name, 'CONTRAST under 4.5:', JSON.stringify(low.slice(0, 10))); }
}

for (const [w, h, t] of [[390, 844, 'phone'], [1280, 900, 'laptop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log(t, 'pageerror', e.message); });

  await page.goto(base + '/request');
  await page.waitForSelector('#f');
  await page.screenshot({ path: join(outdir, 'request-' + t + '.png'), fullPage: true });
  await design(page, 'request ' + t);

  /* an empty send is refused with a plain sentence */
  await page.click('#f button');
  await page.waitForTimeout(600);
  const refused = await page.locator('#msg').textContent();
  console.log(t, 'empty send:', refused);
  if (!/church or group/i.test(refused)) { bad++; console.log(t, 'FAIL: empty send was not refused the right way'); }

  /* the full request */
  await page.fill('input[name=church]', 'St. Test Coptic Orthodox Church');
  await page.fill('input[name=city]', 'Testville, CA');
  await page.fill('input[name=name]', 'Claude Check');
  await page.fill('input[name=email]', 'claude-test@example.com');
  await page.selectOption('select[name=hosted]', { index: 1 });
  await page.fill('input[name=where]', 'The hall, about 120 seats');
  await page.fill('input[name=when]', 'A Saturday in February');
  await page.fill('input[name=size]', '300 families');
  await page.fill('input[name=expect]', '80');
  await page.fill('textarea[name=note]', 'A test row from check-request.mjs.');
  await page.click('#f button');
  await page.waitForSelector('#done', { state: 'visible' });
  const doneText = await page.locator('#doneText').textContent();
  console.log(t, 'done:', doneText);
  if (!/claude-test@example.com/.test(doneText)) { bad++; console.log(t, 'FAIL: the thanks does not name the email'); }
  await page.screenshot({ path: join(outdir, 'request-done-' + t + '.png'), fullPage: true });
  await design(page, 'request done ' + t);

  /* the admin view lists it, newest first */
  await page.goto(base + '/host?k=tiki-test');
  await page.waitForSelector('#reqs .req');
  const first = await page.locator('#reqs .req b').first().textContent();
  console.log(t, 'first request on /host:', first);
  if (first !== 'St. Test Coptic Orthodox Church') { bad++; console.log(t, 'FAIL: the request is not first on /host'); }
  await page.screenshot({ path: join(outdir, 'host-requests-' + t + '.png'), fullPage: true });
  await design(page, 'host ' + t);
  await ctx.close();
}
await browser.close();

/* take the test rows out again */
const env = {};
for (const line of readFileSync('/Users/ishak/Projects/encore/.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY };
const list = await (await fetch(base + '/api/request?k=tiki-test')).json();
for (const q of list.requests || []) {
  if (q.email !== 'claude-test@example.com') continue;
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/andrewishak_data?key=eq.' + encodeURIComponent('abouna-request:' + q.id), { method: 'DELETE', headers: h });
  console.log('removed test row', q.id, r.status);
}

console.log(bad ? bad + ' checks FAILED' : 'Request page, admin list, type floor and contrast pass.');
console.log('Screenshots in', outdir);
process.exit(bad ? 1 : 0);
