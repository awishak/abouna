// Measures the hero title at phone widths: ABOUNA must fit inside the page
// gutter with no horizontal scroll, at 320, 360, 390 and 430 wide.
//   node scripts/dev.mjs &   then   node scripts/check-hero.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, '..', 'fieldtime', 'package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://127.0.0.1:8771';
const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
for (const w of [320, 360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(base + '/');
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const h = document.querySelector('.hero h1');
    const r = h.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(h);
    const text = range.getBoundingClientRect();
    return { box: Math.round(r.width), text: Math.round(text.width), right: Math.round(text.right), inner: innerWidth, scroll: document.documentElement.scrollWidth, size: getComputedStyle(h).fontSize };
  });
  const ok = m.text <= m.box + 1 && m.right <= m.inner - 16 && m.scroll <= m.inner;
  if (!ok) bad++;
  console.log(w, ok ? 'fits' : 'TOO WIDE', JSON.stringify(m));
  if (w === 390) await page.screenshot({ path: join(root, 'mockups', 'hero-390.png') });
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
