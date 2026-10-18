// Drives the Tickets popup in the installed Google Chrome: the Tickets button
// on the Nov 6 row opens it instead of leaving the page, the note and the
// Zeffy link are there, Not now, Esc and the X close it. Then the two design
// rules on the popup, nothing under 13px and every text colour at 4.5:1 or
// better. Serves the folder itself, no API needed. Screenshots land in
// mockups/tickets/. Playwright is borrowed from ../fieldtime.
//   node scripts/check-tickets.mjs [outdir]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = process.argv[2] || join(root, 'mockups', 'tickets');
await mkdir(outdir, { recursive: true });
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const { chromium } = require('playwright');

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/api/press') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}'); }
  try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch (e) { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(8792, r));
const base = 'http://127.0.0.1:8792';
const ZEFFY = 'https://www.zeffy.com/en-US/ticketing/bof--2026';

const CONTRAST = `(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); if (p.length > 3 && p[3] === 0) return null; return p.slice(0, 3); };
  const out = [];
  for (const el of document.querySelectorAll('#tickets *')) {
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
const SMALL = `Array.from(document.querySelectorAll('#tickets *')).filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).display !== 'none' && parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize)`;

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
let bad = 0;
for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desk', { width: 1280, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|tile\.openstreetmap|unpkg|net::ERR/.test(m.text())) errors.push(name + ' console: ' + m.text()); });
  await pg.goto(base + '/#screenings');
  await pg.waitForTimeout(800);
  const btn = pg.locator('a[data-tickets]');
  const href = await btn.getAttribute('href');
  await btn.scrollIntoViewIfNeeded();
  await pg.screenshot({ path: join(outdir, `tickets-${name}-row.png`) });
  await btn.click();
  await pg.waitForTimeout(300);
  const state = await pg.evaluate((z) => {
    const d = document.getElementById('tickets');
    const a = d.querySelector('.tacts a');
    return { open: d.open, url: location.href, note: d.querySelector('.tnote').textContent, link: a.getAttribute('href') === z && a.target === '_blank', focus: document.activeElement && document.activeElement.id };
  }, ZEFFY);
  console.log(name, 'button href ok:', href === ZEFFY, '| opened:', JSON.stringify(state));
  if (href !== ZEFFY || !state.open || !state.link || !/Zeffy page/.test(state.note) || !/Film Premiere/.test(state.note)) { bad++; console.log(name, 'FAIL: the popup did not open as expected'); }
  await pg.screenshot({ path: join(outdir, `tickets-${name}-open.png`) });
  const small = await pg.evaluate(SMALL);
  const low = await pg.evaluate(CONTRAST);
  if (small.length) { bad++; console.log(name, 'TYPE under 13px:', JSON.stringify(small)); }
  if (low.length) { bad++; console.log(name, 'CONTRAST under 4.5:', JSON.stringify(low)); }
  await pg.click('#ticketsBack');
  const closed1 = !(await pg.evaluate(() => document.getElementById('tickets').open));
  await btn.click(); await pg.waitForTimeout(200);
  await pg.keyboard.press('Escape');
  const closed2 = !(await pg.evaluate(() => document.getElementById('tickets').open));
  await btn.click(); await pg.waitForTimeout(200);
  await pg.click('#ticketsClose');
  const closed3 = !(await pg.evaluate(() => document.getElementById('tickets').open));
  console.log(name, 'closes: Not now', closed1, '| Esc', closed2, '| X', closed3);
  if (!closed1 || !closed2 || !closed3) { bad++; console.log(name, 'FAIL: a close did not work'); }
  await ctx.close();
}
await browser.close();
server.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No script errors.');
console.log(bad ? bad + ' checks FAILED' : 'Tickets popup, type floor and contrast pass.');
process.exit(bad ? 1 : 0);
