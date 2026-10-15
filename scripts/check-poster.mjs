// Drives the poster popup in the installed Google Chrome: the Poster button on
// the Nov 6 row and the press kit links open it, Download points at the full
// poster, Esc and the X close it, and with no share sheet the Email and Copy
// link buttons show. Then the two design rules on the popup, nothing under 13px
// and every text colour at 4.5:1 or better. Screenshots land in mockups/poster/.
//
// Needs scripts/dev.mjs running first:
//   node scripts/dev.mjs &
//   node scripts/check-poster.mjs
// Playwright is borrowed from ../fieldtime.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = process.argv[2] || join(root, 'mockups', 'poster');
await mkdir(outdir, { recursive: true });
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771';

const CONTRAST = `(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); if (p.length > 3 && p[3] === 0) return null; return p.slice(0, 3); };
  const out = [];
  for (const el of document.querySelectorAll('#poster *')) {
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
const SMALL = `Array.from(document.querySelectorAll('#poster *')).filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).display !== 'none' && parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize)`;

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
function fail(...m) { bad++; console.log(...m); }
async function design(page, name) {
  const small = await page.evaluate(SMALL);
  const low = await page.evaluate(CONTRAST);
  if (small.length) fail(name, 'TYPE under 13px:', JSON.stringify(small.slice(0, 10)));
  if (low.length) fail(name, 'CONTRAST under 4.5:', JSON.stringify(low.slice(0, 10)));
}

for (const [w, h, t, share] of [[390, 844, 'phone', true], [1280, 900, 'laptop', false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  if (share) {
    // A phone with a share sheet: Send to someone shows, the alternatives do not.
    await ctx.addInitScript(() => { navigator.share = async () => {}; navigator.canShare = () => true; });
  } else {
    // A laptop browser with no share sheet: Email and Copy link show instead.
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  }
  const page = await ctx.newPage();
  await page.goto(base + '/#screenings');
  await page.waitForTimeout(600);

  const row = page.locator('#screenings .show a', { hasText: 'Poster' }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const dlg = page.locator('#poster');
  await page.waitForTimeout(300);
  if (!(await dlg.evaluate((d) => d.open))) fail(t, 'popup did not open from the row');
  const dl = page.locator('#posterDl');
  if ((await dl.getAttribute('href')) !== '/poster-new-york.jpg') fail(t, 'download href', await dl.getAttribute('href'));
  if (!/New York, November 6/.test(await dl.getAttribute('download'))) fail(t, 'download name', await dl.getAttribute('download'));
  if ((await page.locator('#posterName').textContent()) !== 'New York, November 6') fail(t, 'name', await page.locator('#posterName').textContent());
  const sendShown = await page.locator('#posterSend').isVisible();
  const altShown = await page.locator('#posterAlt').isVisible();
  if (share && (!sendShown || altShown)) fail(t, 'with a share sheet: send', sendShown, 'alt', altShown);
  if (!share && (sendShown || !altShown)) fail(t, 'without a share sheet: send', sendShown, 'alt', altShown);
  if (!share) {
    const m = await page.locator('#posterMail').getAttribute('href');
    if (!m.startsWith('mailto:?subject=') || !m.includes(encodeURIComponent('/poster-new-york.jpg'))) fail(t, 'mailto', m);
  }
  await page.screenshot({ path: join(outdir, 'popup-' + t + '.png') });
  await design(page, 'popup ' + t);

  // Every button clears 44px tall.
  const short = await page.locator('#poster .btn, #poster .x').evaluateAll((els) => els.filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 44).map((e) => e.id + ' ' + e.getBoundingClientRect().height));
  if (short.length) fail(t, 'hit targets under 44px:', JSON.stringify(short));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await dlg.evaluate((d) => d.open)) fail(t, 'Esc did not close');

  // The press kit link opens the same popup with the other poster.
  const kit = page.locator('.kit a').first();
  await kit.scrollIntoViewIfNeeded();
  await kit.click();
  await page.waitForTimeout(300);
  if (!(await dlg.evaluate((d) => d.open))) fail(t, 'popup did not open from the press kit');
  if ((await page.locator('#posterName').textContent()) !== 'Episode Two poster') fail(t, 'kit name', await page.locator('#posterName').textContent());
  if ((await dl.getAttribute('href')) !== '/poster-episode-two.jpg') fail(t, 'kit download href', await dl.getAttribute('href'));
  await page.screenshot({ path: join(outdir, 'popup-kit-' + t + '.png') });
  await page.click('#posterClose');
  await page.waitForTimeout(200);
  if (await dlg.evaluate((d) => d.open)) fail(t, 'X did not close');

  await ctx.close();
}
await browser.close();
console.log(bad ? bad + ' checks FAILED' : 'Poster popup, download, send, close, type floor, contrast and hit targets pass.');
process.exit(bad ? 1 : 0);
