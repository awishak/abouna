// Draws map-santa-clara.svg, the parking map on the Santa Clara register page:
// the streets, buildings and footpaths around the North Parking Garage and
// Vari Hall, with the walk between them along the mapped paths. The shapes
// come from OpenStreetMap, so the page credits OpenStreetMap under the map.
//
//   node scripts/make-map-santa-clara.mjs
//
// The OpenStreetMap extract is kept in originals/maps/santa-clara-osm.json
// (not deployed). Delete that file to fetch a fresh one.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'originals', 'maps', 'santa-clara-osm.json');
const GARAGE = 301350202, VARI = 277753518; // OpenStreetMap way ids
// What the picture covers. North is up.
const BOX = { s: 37.34955, n: 37.35245, w: -121.94285, e: -121.93795 };
const PER_M = 2; // drawing units per metre

if (!existsSync(cache)) {
  const q = '[out:json][timeout:60];(way["building"](37.3470,-121.9450,37.3535,-121.9340);way["highway"](37.3470,-121.9450,37.3535,-121.9340);way["amenity"="parking"](37.3470,-121.9450,37.3535,-121.9340);way["leisure"](37.3470,-121.9450,37.3535,-121.9340););out body;>;out skel qt;';
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'user-agent': 'map-drawing-script/1.0' }, body: new URLSearchParams({ data: q }) });
  if (!r.ok) throw new Error('overpass ' + r.status);
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, await r.text());
}
const osm = JSON.parse(readFileSync(cache, 'utf8'));
const nodes = new Map(osm.elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
const ways = osm.elements.filter((e) => e.type === 'way' && e.tags);

const kx = 111320 * Math.cos(((BOX.s + BOX.n) / 2) * Math.PI / 180), ky = 110540;
const W = Math.round((BOX.e - BOX.w) * kx * PER_M), H = Math.round((BOX.n - BOX.s) * ky * PER_M);
const xy = (n) => [(n.lon - BOX.w) * kx * PER_M, (BOX.n - n.lat) * ky * PER_M];
const pts = (w) => w.nodes.map((i) => nodes.get(i)).filter(Boolean).map(xy);
const f1 = (v) => v.toFixed(1);
const line = (p) => 'M' + p.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L');
const inView = (p) => p.some(([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60);
const box = (p) => { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const mid = (p) => { const b = box(p); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; };

// The walk: shortest way over the mapped footpaths from the garage to Vari Hall.
// Streets cost half again as much as paths, so the walk stays on paths where there is one.
const FOOT = new Set(['footway', 'pedestrian', 'path', 'steps', 'cycleway']);
const ROAD = new Set(['service', 'residential', 'unclassified', 'tertiary']);
const graph = new Map();
const link = (a, b, cost) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push([b, cost]); };
for (const w of ways) {
  const h = w.tags.highway;
  if (!FOOT.has(h) && !ROAD.has(h)) continue;
  for (let i = 1; i < w.nodes.length; i++) {
    const a = nodes.get(w.nodes[i - 1]), b = nodes.get(w.nodes[i]);
    if (!a || !b) continue;
    const [ax, ay] = xy(a), [bx, by] = xy(b);
    const d = Math.hypot(ax - bx, ay - by) * (FOOT.has(h) ? 1 : 1.5);
    link(a.id, b.id, d); link(b.id, a.id, d);
  }
}
function nearest(wayId) {
  const shape = pts(ways.find((w) => w.id === wayId));
  let best = null, bd = Infinity;
  for (const id of graph.keys()) {
    const [x, y] = xy(nodes.get(id));
    for (const [px, py] of shape) { const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = id; } }
  }
  return best;
}
const from = nearest(GARAGE), to = nearest(VARI);
const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
while (true) {
  let u = null, ud = Infinity;
  for (const [id, d] of dist) if (!done.has(id) && d < ud) { u = id; ud = d; }
  if (u == null || u === to) break;
  done.add(u);
  for (const [v, c] of graph.get(u) || []) if (!dist.has(v) || ud + c < dist.get(v)) { dist.set(v, ud + c); prev.set(v, u); }
}
if (!dist.has(to)) throw new Error('no walk found between the garage and Vari Hall');
const walk = [];
for (let n = to; n != null; n = prev.get(n)) walk.unshift(xy(nodes.get(n)));
let metres = 0;
for (let i = 1; i < walk.length; i++) metres += Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1]) / PER_M;

const WIDTH = { primary: 30, secondary: 24, tertiary: 18, residential: 16, unclassified: 16, tertiary_link: 12, primary_link: 12, service: 7 };
let green = '', roads = '', malls = '', paths = '', blds = '', garage = '', vari = '';
for (const w of ways) {
  const p = pts(w);
  if (p.length < 2 || !inView(p)) continue;
  const t = w.tags;
  if (w.id === GARAGE) { garage = line(p) + 'Z'; continue; }
  if (w.id === VARI) { vari = line(p) + 'Z'; continue; }
  if (t.building) blds += line(p) + 'Z';
  else if (t.leisure && ['pitch', 'park', 'garden', 'stadium'].includes(t.leisure)) green += line(p) + 'Z';
  else if (WIDTH[t.highway]) roads += '<path d="' + line(p) + '" stroke-width="' + WIDTH[t.highway] + '"/>';
  else if (t.highway === 'pedestrian') malls += line(p);
  else if (FOOT.has(t.highway)) paths += line(p);
}

// A street's name, once, along the longest stretch of that street in view.
function streetLabel(name, text, dy = 12) {
  let best = null, bl = 0;
  for (const w of ways) {
    if (w.tags.name !== name || !w.tags.highway) continue;
    const p = pts(w);
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1], p[i]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (m[0] < 90 || m[0] > W - 90 || m[1] < 40 || m[1] > H - 30) continue;
      const l = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (l > bl) { bl = l; best = [a, b, m]; }
    }
  }
  if (!best) return '';
  const [a, b, m] = best;
  let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  return '<text x="' + f1(m[0]) + '" y="' + f1(m[1]) + '" dy="' + dy + '" transform="rotate(' + f1(ang) + ' ' + f1(m[0]) + ' ' + f1(m[1]) + ')">' + text + '</text>';
}
const streets = [['Benton Street', 'Benton St'], ['Franklin Street', 'Franklin St'], ['Alviso Street', 'Alviso St', -16], ['Palm Drive', 'Palm Dr', 44], ['Sherman Street', 'Sherman St']].map(([n, t, dy]) => streetLabel(n, t, dy)).join('\n    ');

const gb = box(pts(ways.find((w) => w.id === GARAGE))), vb = box(pts(ways.find((w) => w.id === VARI)));
const g = mid(pts(ways.find((w) => w.id === GARAGE))), v = mid(pts(ways.find((w) => w.id === VARI)));
const a = walk[0], z = walk[walk.length - 1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map: park in or around the North Parking Garage, then walk the campus paths to Vari Hall" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif">
  <!-- Made by scripts/make-map-santa-clara.mjs from OpenStreetMap data (c) OpenStreetMap contributors. North is up.
       The dotted line is the walk from the North Parking Garage to Vari Hall along the mapped paths, about ${Math.round(metres / 10) * 10} metres. -->
  <rect width="${W}" height="${H}" fill="#15120f"/>
  <path d="${green}" fill="#1b241b"/>
  <g fill="none" stroke="#3a342e" stroke-linecap="round" stroke-linejoin="round">${roads}</g>
  <path d="${malls}" fill="none" stroke="#3a342e" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${paths}" fill="none" stroke="#5e554a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${blds}" fill="#26211c" stroke="#4a4239" stroke-width="1.5"/>
  <path d="${garage}" fill="#2e2a25" stroke="#d9c08f" stroke-width="5"/>
  <path d="${vari}" fill="#d9c08f"/>
  <path d="${line(walk)}" fill="none" stroke="#f6f1e8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 13"/>
  <g font-size="34" fill="#e2d9cb" text-anchor="middle" stroke="#15120f" stroke-width="6" paint-order="stroke" stroke-linejoin="round">
    ${streets}
  </g>
  <g font-size="36" font-weight="700">
    <g fill="#f6f1e8" text-anchor="middle">
      <text x="${f1(g[0] + 6)}" y="${f1(g[1] - 28)}">North</text>
      <text x="${f1(g[0] + 6)}" y="${f1(g[1] + 12)}">Parking</text>
      <text x="${f1(g[0] + 6)}" y="${f1(g[1] + 52)}">Garage</text>
    </g>
    <g fill="#f6f1e8" stroke="#15120f" stroke-width="8" paint-order="stroke" stroke-linejoin="round">
      <text x="${f1(vb.x1 + 12)}" y="${f1(vb.y0 + 34)}">Vari Hall</text>
    </g>
  </g>
  <g font-size="32" font-weight="700" text-anchor="middle">
    <circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="24" fill="#d9c08f" stroke="#0a0908" stroke-width="4"/>
    <text x="${f1(a[0])}" y="${f1(a[1] + 11)}" fill="#0a0908">1</text>
    <circle cx="${f1(z[0])}" cy="${f1(z[1])}" r="24" fill="#0a0908" stroke="#d9c08f" stroke-width="4"/>
    <text x="${f1(z[0])}" y="${f1(z[1] + 11)}" fill="#f6f1e8">2</text>
  </g>
</svg>
`;
writeFileSync(join(root, 'map-santa-clara.svg'), svg);
console.log('map-santa-clara.svg', W + 'x' + H, Math.round(svg.length / 1024) + ' KB', 'walk about', Math.round(metres), 'm over', walk.length, 'points');
