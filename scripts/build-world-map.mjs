// Builds the food map's world: blender/explore/world-map.json (the shapes, loaded only when the map opens) and tops up
// blender/explore/food-map.json (every country's id, name and region; the curated cuisines/neighbours/shop already there are kept).
// Source: Natural Earth 1:110m admin-0 countries (public domain) via the world-atlas package, with names, regions and land borders
// from world-countries. See CREDITS.md. Run once, by hand, when the source should change:
//   npm i --prefix <dir> world-atlas@2 topojson-client world-countries
//   node scripts/build-world-map.mjs <dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = process.argv[2];
if (!from) throw new Error('usage: node scripts/build-world-map.mjs <dir with node_modules/world-atlas, topojson-client, world-countries>');
const req = createRequire(join(from, 'package.json'));
const topo = req('world-atlas/countries-110m.json');
const { feature } = req('topojson-client');
const wc = req('world-countries');

const FM = join(root, 'blender/explore/food-map.json');
const old = JSON.parse(readFileSync(FM, 'utf8'));
const oldById = Object.fromEntries(old.countries.map(c => [c.id, c]));

// ---- which countries: independent states, plus Palestine, Taiwan, Kosovo and Greenland (people pin them)
const EXTRA = { ps: 'Palestine', tw: 'Taiwan', xk: 'Kosovo', gl: 'Greenland' };
const rows = wc.filter(c => c.independent || EXTRA[c.cca2.toLowerCase()]).map(c => ({
  id: c.cca2.toLowerCase(), n3: c.ccn3, a3: c.cca3, name: c.name.common, region: c.region, sub: c.subregion, borders: c.borders || [], ll: c.latlng,
}));
if (!rows.some(r => r.id === 'xk')) rows.push({ id: 'xk', n3: '', a3: 'XKX', name: 'Kosovo', region: 'Europe', sub: 'Southeast Europe', borders: ['ALB', 'MKD', 'MNE', 'SRB'], ll: [42.67, 21.17] });
const byA3 = Object.fromEntries(rows.map(r => [r.a3, r]));
const NAMES = { cz: 'Czechia', cd: 'DR Congo', cg: 'Republic of the Congo', ci: "Côte d'Ivoire", cv: 'Cabo Verde', mm: 'Myanmar', sz: 'Eswatini', mk: 'North Macedonia',
  tr: 'Türkiye', kr: 'Korea', kp: 'North Korea', ps: 'Palestine', va: 'Vatican City', tl: 'Timor-Leste', st: 'São Tomé and Príncipe', us: 'United States', gb: 'United Kingdom',
  nz: 'Aotearoa New Zealand', bs: 'Bahamas', gm: 'Gambia', fm: 'Micronesia', ru: 'Russia', ir: 'Iran', sy: 'Syria', la: 'Laos', bo: 'Bolivia', ve: 'Venezuela', tz: 'Tanzania', md: 'Moldova', bn: 'Brunei' };
for (const r of rows) r.label = NAMES[r.id] || r.name;
// Other names people type into "Find a country"
const ALT = { tr: ['turkey'], kr: ['south korea'], kp: ['north korea'], us: ['usa', 'america', 'united states of america'], gb: ['uk', 'england', 'scotland', 'wales', 'britain', 'great britain'],
  cz: ['czech republic'], mm: ['burma'], ci: ['ivory coast'], sz: ['swaziland'], nl: ['holland'], ae: ['uae', 'emirates', 'dubai'], nz: ['new zealand', 'kiwi', 'nz'], cd: ['congo kinshasa', 'drc'],
  cg: ['congo brazzaville'], mk: ['macedonia'], cv: ['cape verde'], tl: ['east timor'], ps: ['gaza', 'west bank'], ru: ['russian federation'], va: ['holy see'], la: ['lao'],
  bn: ['brunei darussalam'], ir: ['persia'], tw: ['republic of china'], sy: ['syrian arab republic'], vn: ['viet nam'] };
const sortKey = l => l.replace(/^Aotearoa /, '');

// ---- Natural Earth I projection into a 1000-wide box, cropped to 56°S..84°N (Antarctica is not a country)
const rad = d => d * Math.PI / 180;
function proj([lon, lat]) {
  const l = rad(lon), p = rad(lat), p2 = p * p, p4 = p2 * p2;
  return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    -p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
};
const LATMIN = -56, LATMAX = 84;
const xmax = proj([180, 0])[0], top = proj([0, LATMAX])[1], bot = proj([0, LATMIN])[1];
const S = 1000 / (2 * xmax), H = Math.round((bot - top) * S);
const P = ll => { const [x, y] = proj(ll); return [(x + xmax) * S, (y - top) * S]; };
const q = v => Math.round(v * 2) / 2;   // half a unit of 1000

function ringArea(r) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; }
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}
/** One polygon's rings as a relative path; rings with under 2 points of real size are dropped */
function ringPath(ring) {
  const pts = [];
  for (const ll of ring) {
    const [x, y] = P(ll).map(q);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
  }
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return '';
  const num = v => String(+v.toFixed(1)).replace(/^(-?)0\./, '$1.');
  const join = ts => ts.reduce((o, t, i) => o + (i && !t.startsWith('-') ? ' ' : '') + t, '');
  const rel = [];
  for (let i = 1; i < pts.length; i++) rel.push(num(pts[i][0] - pts[i - 1][0]), num(pts[i][1] - pts[i - 1][1]));
  const d = 'M' + join([num(pts[0][0]), num(pts[0][1])]) + 'l' + join(rel);
  return d + 'z';
}

/** A ring that crosses the antimeridian (Russia's far east, Fiji) is unwrapped, cut at 180, and the far half moved back: two polygons, no line across the map */
function unwrapSplit(ring) {
  const u = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let [lon, lat] = ring[i];
    const prev = u[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    u.push([lon, lat]);
  }
  const hi = Math.max(...u.map(p => p[0])), lo = Math.min(...u.map(p => p[0]));
  if (hi <= 180 && lo >= -180) return [u];
  const clip = (pts, edge, keepBelow) => {   // Sutherland-Hodgman against the meridian lon = edge
    const inside = p => (keepBelow ? p[0] <= edge : p[0] >= edge), out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push([edge, a[1] + (b[1] - a[1]) * (edge - a[0]) / (b[0] - a[0])]);
    }
    return out;
  };
  const pieces = [];
  if (hi > 180) { pieces.push(clip(u, 180, true)); pieces.push(clip(u, 180, false).map(([x, y]) => [x - 360, y])); }
  else { pieces.push(clip(u, -180, false)); pieces.push(clip(u, -180, true).map(([x, y]) => [x + 360, y])); }
  return pieces.filter(p => p.length > 2).map(p => [...p, p[0]]);
}

const fc = feature(topo, topo.objects.countries).features;
const shapes = {}, centres = {}, land = [], matched = new Set();
for (const f of fc) {
  const name = f.properties.name;
  const row = rows.find(r => r.n3 && r.n3 === String(f.id).padStart(3, '0')) || (name === 'Kosovo' ? rows.find(r => r.id === 'xk') : null) || (name === 'Greenland' ? rows.find(r => r.id === 'gl') : null);
  if (name === 'Antarctica' || name === 'Fr. S. Antarctic Lands') continue;
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(p => {
    const parts = unwrapSplit(p[0]);
    return parts.length === 1 && parts[0].every((pt, i) => pt[0] === p[0][i][0]) ? [p] : parts.map(r => [r]);
  });
  // Antimeridian cuts leave slivers; keep polygons that reach into the cropped latitudes
  const kept = polys.filter(p => p[0].some(([, lat]) => lat >= LATMIN && lat <= LATMAX));
  const d = kept.map(p => p.map(ringPath).join('')).join('');
  if (!d) continue;
  if (!row) { land.push(d); continue; }
  matched.add(row.id);
  shapes[row.id] = d;
  let best = null;
  for (const p of kept) { const outer = p[0].map(P); const a = Math.abs(ringArea(outer)); if (!best || a > best.a) best = { a, c: ringCentroid(outer) }; }
  centres[row.id] = best.c.map(v => Math.round(v));
}
// Countries with no shape at 1:110m (islands and micro-states): a dot where they are
const dots = {};
for (const r of rows) if (!matched.has(r.id)) dots[r.id] = P([r.ll[1], r.ll[0]]).map(Math.round);

writeFileSync(join(root, 'blender/explore/world-map.json'), JSON.stringify({ w: 1000, h: H, land, shapes, centres, dots }));

// ---- food-map.json: every country; curated fields are kept as they were
const ids3 = Object.fromEntries(rows.map(r => [r.a3, r.id]));
const countries = rows.map(r => {
  const o = oldById[r.id];
  const label = r.id === 'kr' ? 'South Korea' : o?.label || r.label;
  const base = { id: r.id, label, region: r.region, sub: r.sub, ...(ALT[r.id] ? { alt: ALT[r.id] } : {}) };
  if (o) return { ...base, cuisines: o.cuisines, neighbours: o.neighbours, shop: o.shop ?? null };
  return { ...base, cuisines: [], neighbours: r.borders.map(b => ids3[b]).filter(Boolean), shop: null };
}).sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label), 'en'));
for (const id of Object.keys(oldById)) if (!countries.some(c => c.id === id)) throw new Error(`saved id ${id} is gone from the new list`);
const about = 'The food map (explore/food-map.js). Content edits the words (label, cuisines, neighbours, shop); the shapes are explore/world-map.json (built by scripts/build-world-map.mjs from Natural Earth, see CREDITS.md). Every country is here so it can take a pin. cuisines are the labels cards carry in their own cuisines (empty: no recipes yet, so the dial leans on neighbours, then sub, then region). neighbours are other countries\' ids whose cuisines count as near. region and sub are the UN geoscheme. shop is a shopping-words country (gemma-lines tell.countries), where there is one.';
const lines = countries.map(c => '    ' + JSON.stringify(c).replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/":/g, '": '));
writeFileSync(FM, `{\n  "_about": ${JSON.stringify(about)},\n  "countries": [\n${lines.join(',\n')}\n  ]\n}\n`);
console.log(`${countries.length} countries, ${Object.keys(shapes).length} shapes, ${Object.keys(dots).length} dots, ${land.length} unassigned land, h=${H}`);
