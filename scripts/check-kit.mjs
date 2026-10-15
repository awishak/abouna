// Drives the Press Kit popup in the installed Google Chrome: with nothing
// published (the function answers 404) the popup shows the two posters on the
// page; with a published kit (a stand-in answer for /api/press) it shows the
// one line, the synopsis, posters, cast, stills, behind the scenes and the
// screenings; a picture opens the poster popup; /press opens the kit on its
// own. Then the two design rules on the popup, nothing under 13px and every
// text colour at 4.5:1 or better. Screenshots land in mockups/kit/.
//
// Needs scripts/dev.mjs running first:
//   node scripts/dev.mjs &
//   node scripts/check-kit.mjs
// Playwright is borrowed from ../fieldtime.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = process.argv[2] || join(root, 'mockups', 'kit');
await mkdir(outdir, { recursive: true });
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771';

const SAMPLE = {
  title: 'Abouna Episode Two',
  logline: 'Sometimes we need others to see the fire within us.',
  synopsis: 'Now, Father Beemen is putting that conviction into action.',
  links: { ep1: 'https://youtube.com/@andrewishak', ig: 'https://www.instagram.com/watchabouna/' },
  posters: [{ w: '/poster-episode-two-web.jpg', f: '/poster-episode-two.jpg', cap: 'Abouna Episode Two poster' }, { w: '/poster-new-york-web.jpg', f: '/poster-new-york.jpg', cap: 'New York, November 6' }],
  stills: [{ w: '/ep2-still.jpg', f: '/ep2-still.jpg', cap: 'Episode Two' }, { w: '/ep1-still.jpg', f: '/ep1-still.jpg', cap: '' }],
  bts: [{ w: '/bts-03.jpeg', f: '/bts-03.jpeg', cap: 'The crew on the Santa Cruz pier at sunset' }, { w: '/reel-01.jpg', f: '/reel-01.jpg', cap: '' }, { w: '/reel-02.jpg', f: '/reel-02.jpg', cap: '' }],
  screenings: [],
  cast: [{ name: 'Andrew Ishak', role: 'Cast and crew', pic: '/creator-photo.png' }, { name: 'Dina Hanna', role: 'Cast', pic: '' }],
  creator: { name: 'Andrew Ishak', line: 'Creator, writer, director, editor. Plays Beemen.', pic: '/creator-photo.png' },
  shows: [{ date: '2026-11-06', t: 'New York premiere, Beacon of Faith Conference', where: 'New York' }],
  contact: { name: 'Andrew Ishak', email: '' }
};

const CONTRAST = `(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); if (p.length > 3 && p[3] === 0) return null; return p.slice(0, 3); };
  const out = [];
  for (const el of document.querySelectorAll('#kit *')) {
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.ktile')) continue;
    const fg = rgb(cs.color); if (!fg) continue;
    let bg = null, p = el;
    while (p && !bg) { bg = rgb(getComputedStyle(p).backgroundColor); p = p.parentElement; }
    if (!bg) bg = [255, 255, 255];
    const a = lum(...fg), b = lum(...bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) out.push(el.tagName + '.' + el.className + ' ' + ratio.toFixed(2) + ' ' + cs.color + ' on ' + JSON.stringify(bg));
  }
  return out;
})()`;
const SMALL = `Array.from(document.querySelectorAll('#kit *')).filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).display !== 'none' && parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize)`;

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
function fail(...m) { bad++; console.log(...m); }
async function design(page, name) {
  const small = await page.evaluate(SMALL);
  const low = await page.evaluate(CONTRAST);
  if (small.length) fail(name, 'TYPE under 13px:', JSON.stringify(small.slice(0, 10)));
  if (low.length) fail(name, 'CONTRAST under 4.5:', JSON.stringify(low.slice(0, 10)));
}

for (const [w, h, t] of [[390, 844, 'phone'], [1280, 900, 'laptop']]) {
  // Nothing published: the function answers 404 and the popup shows the page's posters.
  let ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  await page.route('**/api/press', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no kit yet"}' }));
  await page.goto(base + '/');
  await page.waitForTimeout(500);
  await page.click('footer a[data-kit]');
  await page.waitForTimeout(600);
  const dlg = page.locator('#kit');
  if (!(await dlg.evaluate((d) => d.open))) fail(t, 'the footer link did not open the kit');
  const fbTiles = await page.locator('#kit .ktile').count();
  if (fbTiles !== 2) fail(t, 'fallback kit has', fbTiles, 'tiles, want the 2 posters');
  if (!(await page.locator('#kit .ksyn').count())) fail(t, 'fallback kit has no synopsis');
  await page.screenshot({ path: join(outdir, 'kit-fallback-' + t + '.png') });
  await design(page, 'fallback ' + t);
  await ctx.close();

  // A published kit, and /press opening it on its own.
  ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  await page.route('**/api/press', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ kit: SAMPLE }) }));
  await page.goto(base + '/press');
  await page.waitForTimeout(800);
  const dlg2 = page.locator('#kit');
  if (!(await dlg2.evaluate((d) => d.open))) fail(t, '/press did not open the kit');
  const heads = await page.locator('#kit .ksec h4').allTextContents();
  const want = ['Posters', 'Cast and crew', 'Stills', 'Behind the scenes', 'Screenings', 'The creator', 'Links', 'Contact'];
  if (heads.join('|') !== want.join('|')) fail(t, 'sections:', JSON.stringify(heads));
  const tiles = await page.locator('#kit .ktile').count();
  if (tiles !== 7) fail(t, 'published kit has', tiles, 'tiles, want 7');
  if (!/Sometimes we need others/.test(await page.locator('#kit .klead').textContent())) fail(t, 'no logline');
  if ((await page.locator('#kit .kcast b').allTextContents()).join('|') !== 'Andrew Ishak|Dina Hanna|Andrew Ishak') fail(t, 'cast names wrong');
  if (!/Nov 6/.test(await page.locator('#kit .kshows .day').first().textContent())) fail(t, 'screening date wrong');
  await page.screenshot({ path: join(outdir, 'kit-' + t + '.png') });
  await page.locator('#kit').evaluate((d) => { d.scrollTop = d.scrollHeight; });
  await page.screenshot({ path: join(outdir, 'kit-bottom-' + t + '.png') });
  await design(page, 'kit ' + t);
  const short = await page.locator('#kit .btn, #kit .x').evaluateAll((els) => els.filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 44).map((e) => e.id + ' ' + e.getBoundingClientRect().height));
  if (short.length) fail(t, 'hit targets under 44px:', JSON.stringify(short));

  // A picture opens the poster popup with the right file.
  await page.locator('#kit .ktile').nth(2).click();
  await page.waitForTimeout(300);
  const pd = page.locator('#poster');
  if (!(await pd.evaluate((d) => d.open))) fail(t, 'a tile did not open the poster popup');
  const dl = page.locator('#posterDl');
  if ((await dl.getAttribute('href')) !== '/ep2-still.jpg') fail(t, 'tile download href', await dl.getAttribute('href'));
  if ((await dl.getAttribute('download')) !== 'Episode Two.jpg') fail(t, 'tile download name', await dl.getAttribute('download'));
  await page.screenshot({ path: join(outdir, 'kit-picture-' + t + '.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await pd.evaluate((d) => d.open)) fail(t, 'Esc did not close the picture');
  if (!(await dlg2.evaluate((d) => d.open))) fail(t, 'the kit closed with the picture');
  await page.click('#kitClose');
  await page.waitForTimeout(200);
  if (await dlg2.evaluate((d) => d.open)) fail(t, 'X did not close the kit');

  // The cast and crew lines on the page.
  const ivy = await page.locator('.names div', { hasText: 'Ivy Wu' }).locator('span').textContent().catch(() => '');
  if (ivy !== 'Crew') fail(t, 'Ivy Wu line:', ivy);
  await ctx.close();
}
await browser.close();
console.log(bad ? bad + ' checks FAILED' : 'Press kit popup, fallback, /press, tiles, close, type floor, contrast and hit targets pass.');
process.exit(bad ? 1 : 0);
