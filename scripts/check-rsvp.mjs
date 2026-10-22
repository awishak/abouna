// Drives the register pages in the installed Google Chrome: /rsvp for the open
// screening at phone and laptop widths, and the closed text for a closed one, a sign-up through the form (the
// mailing-list box unticked so Mailchimp is not touched), the host view with
// its key, and the admin view with the password; then the two design rules on
// every screen, nothing under 13px and every text colour at 4.5:1 or better
// against the surface it sits on. Screenshots land in mockups/rsvp/.
//
// Needs scripts/dev.mjs running first (the pages and the function against the
// real database, admin code tiki-test):
//   node scripts/dev.mjs &
//   node scripts/check-rsvp.mjs
//   node scripts/cleanup-test-rsvp.mjs     removes the test rows it wrote
// Playwright is borrowed from ../fieldtime.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = process.argv[2] || join(root, 'mockups', 'rsvp');
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

const admin = await (await fetch(base + '/api/rsvp?all=1&k=tiki-test')).json();
const OPEN_S = admin.screenings.find((s) => s.open) || null;
const CLOSED_S = admin.screenings.find((s) => !s.open) || null;
const OPEN = !!OPEN_S;
const ID = OPEN_S && OPEN_S.id;
const hostKey = OPEN_S && new URL(OPEN_S.host).searchParams.get('k');
const WANT = admin.screenings.filter((s) => s.open).length;

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
async function design(page, name) {
  const small = await page.evaluate(SMALL);
  const low = await page.evaluate(CONTRAST);
  if (small.length) { bad++; console.log(name, 'TYPE under 13px:', JSON.stringify(small.slice(0, 10))); }
  if (low.length) { bad++; console.log(name, 'CONTRAST under 4.5:', JSON.stringify(low.slice(0, 10))); }
}

for (const [w, h, t] of [[390, 844, 'phone'], [1280, 900, 'laptop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(base + '/#screenings');
  await page.waitForTimeout(800);
  await page.locator('#screenings .show').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(outdir, 'home-' + t + '.png') });
  const signups = await page.locator('#screenings a.btn[href^="/rsvp"]').count();
  if (signups !== WANT) { bad++; console.log(t, 'home has', signups, 'Register buttons, want', WANT); }

  if (CLOSED_S) {
    await page.goto(base + '/rsvp?s=' + CLOSED_S.id);
    await page.waitForTimeout(500);
    const closed = await page.locator('#meta').textContent();
    if (!/not open for registration/.test(closed)) { bad++; console.log(t, 'closed screening text:', closed); }
    await page.screenshot({ path: join(outdir, 'rsvp-closed-' + t + '.png'), fullPage: true });
    await design(page, 'rsvp closed ' + t);
  }
  if (!OPEN) { await ctx.close(); continue; }

  await page.goto(base + '/rsvp?s=' + ID);
  await page.waitForSelector('.meta .day');
  await page.screenshot({ path: join(outdir, 'rsvp-' + t + '.png'), fullPage: true });
  await design(page, 'rsvp ' + t);

  await page.fill('input[name=first]', 'Test');
  await page.fill('input[name=last]', 'Row');
  await page.fill('input[name=email]', 'claude-test@example.com');
  await page.selectOption('select[name=count]', '4');
  await page.uncheck('input[name=list]');
  await page.click('#f button');
  await page.waitForSelector('#done', { state: 'visible' });
  const doneText = await page.locator('#doneText').textContent();
  if (!/4 seats under Test Row/.test(doneText)) { bad++; console.log(t, 'done text wrong:', doneText); }
  await page.screenshot({ path: join(outdir, 'rsvp-done-' + t + '.png'), fullPage: true });
  await design(page, 'rsvp done ' + t);

  await page.goto(base + '/rsvp?s=nope');
  await page.waitForTimeout(500);
  const nope = await page.locator('#meta').textContent();
  if (!/not open for registration/.test(nope)) { bad++; console.log(t, 'unknown screening text:', nope); }

  await page.goto(base + '/signups?s=' + ID + '&k=' + hostKey);
  await page.waitForSelector('table');
  const seats = await page.locator('.num b').textContent();
  if (seats !== '4') { bad++; console.log(t, 'host seats', seats); }
  await page.screenshot({ path: join(outdir, 'host-' + t + '.png'), fullPage: true });
  await design(page, 'host ' + t);

  await page.goto(base + '/signups?s=' + ID + '&k=wrong');
  await page.waitForSelector('.msg.err');

  await page.goto(base + '/signups');
  await page.waitForSelector('#gate:not([hidden])');
  await page.fill('#gf input', 'nope');
  await page.click('#gf button');
  await page.waitForSelector('.msg.err');
  await page.fill('#gf input', 'tiki-test');
  await page.click('#gf button');
  await page.waitForSelector('.hostlink input');
  const links = await page.locator('.hostlink input').evaluateAll((els) => els.map((e) => e.value));
  if (!links.some((l) => l.includes('s=' + ID + '&k=' + hostKey))) { bad++; console.log(t, 'admin host links', links); }
  await page.screenshot({ path: join(outdir, 'admin-' + t + '.png'), fullPage: true });
  await design(page, 'admin ' + t);

  await ctx.close();
}
await browser.close();
console.log(bad ? bad + ' checks FAILED' : 'Register, host, admin, type floor and contrast pass.');
process.exit(bad ? 1 : 0);
