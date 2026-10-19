// npm run check: the automatic check before every deploy (brainstorm 1, G1).
// Builds the site, runs the navigator unit tests, serves dist/ on a local port and walks the Inn in a real browser:
// every room at five sizes, by day and by night. Prints PASS, or FAIL with a short list. Exit code 0 or 1.
//   node scripts/check.mjs [--no-build] [--headed] [--only=375x812]
// Uses the Chrome (or Edge) already installed, through playwright-core: no browser download.
// The genie Worker is never called: its requests are answered locally with empty replies, and the AI navigator is
// off on localhost, so Turnstile never loads.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const only = args.find(a => a.startsWith('--only='))?.slice(7);
const t0 = Date.now();
const failures = [];
const fail = msg => { if (!failures.includes(msg)) failures.push(msg); };
const warnings = [];
const warn = msg => { if (!warnings.includes(msg)) warnings.push(msg); };
const step = msg => console.log(`· ${msg} (${Math.round((Date.now() - t0) / 1000)} s)`);

// ---------- 1. build
if (!flag('--no-build')) {
  step('building');
  const b = spawnSync('npm run build', { cwd: root, shell: true, encoding: 'utf8' });
  if (b.status !== 0) { console.log(b.stdout.slice(-2000), b.stderr.slice(-2000)); console.log('\nFAIL\n- the build failed'); process.exit(1); }
}

// ---------- 2. unit tests
step('navigator unit tests');
const u = spawnSync(process.execPath, ['--test', 'test/navigator.test.mjs'], { cwd: root, encoding: 'utf8' });
for (const line of u.stdout.split('\n')) if (/^✖ /.test(line) && !/failing tests/.test(line)) fail(`unit test: ${line.replace(/^✖ /, '').replace(/ \([\d.]+ms\)$/, '')}`);
if (u.status !== 0 && !failures.some(f => f.startsWith('unit test'))) fail('unit tests failed to run');

// ---------- 3. serve dist/ (a few lines instead of wrangler: fast, and the same files)
const dist = join(root, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch { if (existsSync(`${file}.html`)) file = `${file}.html`; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ---------- 4. the browser
const { chromium } = await import('playwright-core');
let browser;
for (const channel of ['chrome', 'msedge']) {
  try { browser = await chromium.launch({ channel, headless: !flag('--headed') }); break; } catch { /* try the next */ }
}
if (!browser) { console.log('\nFAIL\n- no Chrome or Edge found for the browser check'); process.exit(1); }

const SIZES = [[375, 812], [375, 635], [724, 340], [812, 375], [1280, 800]].filter(([w, h]) => !only || only === `${w}x${h}`);
const hall = JSON.parse(readFileSync(join(root, 'blender/explore/hallway-world.json'), 'utf8'));
const ROOMS = ['cuddlecore', ...Object.keys(hall.stops), 'glasshouse', 'flourish', 'sweet-spells', 'chiapothecary'];
const TIMES = ['midday', 'night'];

async function openPage({ width, height, time, path, phone }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: phone, isMobile: false });
  // A returning visitor in this tab: welcomed, through the door, with the time of day set; nothing else
  await context.addInitScript(([t]) => {
    try {
      localStorage.setItem('wa-welcomed', '1');
      if (!sessionStorage.getItem('wa-check')) {
        sessionStorage.setItem('wa-check', '1');
        sessionStorage.setItem('wa-door-done', '1');
        sessionStorage.setItem('wa-explore', JSON.stringify({ time: t }));
      }
    } catch { /* storage blocked */ }
  }, [time]);
  // Never the live genie: answer its routes locally (the page treats {} as "no answer")
  await context.route(/whiskedaway-genie|challenges\.cloudflare\.com/, route => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
  const page = await context.newPage();
  const where = `${width}x${height} ${time}`;
  page.on('console', m => { if (m.type() === 'error') fail(`${where}: console error: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', e => fail(`${where}: script error: ${String(e.message).slice(0, 160)}`));
  page.on('response', r => {
    const url = r.url().replace(base, '');
    if (r.status() >= 400) fail(`${where}: ${r.status()} ${url.slice(0, 120)}`);
    if (r.request().resourceType() === 'script' && !/javascript/.test(r.headers()['content-type'] || '')) fail(`${where}: script not served as JavaScript: ${url}`);
  });
  await page.goto(`${base}${path}`, { waitUntil: 'load' });
  return { page, context, where };
}

// Every hotspot on screen at the arrival view: the element under its dot's centre must be that hotspot
const COVERED = `(() => {
  const out = [];
  for (const s of document.querySelectorAll('.spot')) {
    if (s.style.display === 'none' || getComputedStyle(s).visibility === 'hidden') continue;
    const d = (s.querySelector('.dot') || s).getBoundingClientRect();
    const x = d.left + d.width / 2, y = d.top + d.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === s || s.contains(hit))) continue;
    if (hit?.closest('.chatwin')) { out.push('WARN ' + (s.getAttribute('aria-label') || '?').split(/[.:]/)[0] + ' under the chat window'); continue; }
    const other = hit?.closest('.spot');
    const by = other ? 'hotspot "' + (other.getAttribute('aria-label') || '').split(/[.:]/)[0] + '"'
      : hit ? (hit.closest('[id]')?.id || hit.className || hit.tagName).toString().slice(0, 40) : 'nothing';
    out.push((s.getAttribute('aria-label') || '?').split(/[.:]/)[0] + ' under ' + by);
  }
  return out;
})()`;

for (const [width, height] of SIZES) for (const time of TIMES) {
  step(`${width}x${height} ${time}`);
  const phone = width < 900;
  const { page, context, where } = await openPage({ width, height, time, path: '/?room=cuddlecore', phone });
  try {
    await page.waitForFunction(() => window.__explore?.goRoom, null, { timeout: 15000 });
    for (const room of ROOMS) {
      await page.evaluate(id => window.__explore.goRoom(id), room);
      await page.waitForTimeout(700);                          // the move, the hotspots and Gemma's intro settle
      // Dots under the chat window are known work (R1, the chat layout): listed as warnings, not failures, until that lands
      for (const c of await page.evaluate(COVERED)) c.startsWith('WARN ') ? warn(`${where} ${room}: ${c.slice(5)}`) : fail(`${where} ${room}: ${c}`);
    }
  } catch (e) { fail(`${where}: ${String(e.message).split('\n')[0]}`); }
  await context.close();
}

// The front door: one h1 for the page outline
step('front door and star dial');
{
  const { page, context, where } = await openPage({ width: 1280, height: 800, time: 'midday', path: '/?door=1', phone: false });
  const h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
  if (h1 !== 1) fail(`${where} front door: ${h1} h1 elements (want 1)`);
  await context.close();
}
// The star on the hallway dial opens the room the wander leans to
{
  const { page, context, where } = await openPage({ width: 1280, height: 800, time: 'midday', path: '/?room=hall-middle', phone: false });
  await page.waitForFunction(() => window.__explore?.goRoom, null, { timeout: 15000 });
  const cases = { sweet: 'sweet-spells', 'build-up': 'flourish', energising: 'chiapothecary', fresh: 'cuddlecore', '': 'cuddlecore' };
  for (const [lean, want] of Object.entries(cases)) {
    const got = await page.evaluate(async lean => {
      const ex = window.__explore, wait = ms => new Promise(r => setTimeout(r, ms));
      ex.goRoom('hall-middle'); await wait(300);
      ex.state.trail = lean ? [{ kind: 'choose', cluster: lean }, { kind: 'choose', cluster: lean }] : [];
      ex.touch('dial-cuddlecore'); await wait(200);
      const star = [...document.querySelectorAll('#roomdial button')].at(-1);
      if (!star) return 'no dial';
      star.click(); await wait(1200);
      return ex.state.room;
    }, lean);
    if (got !== want) fail(`${where} star dial: a "${lean || 'quiet'}" wander opened ${got} (want ${want})`);
  }
  await context.close();
}

// Gemma reads the wander in every room the way the page runs it (navigate(), with the room's own id): a separate page, so the
// ideas she puts out don't change the hotspot checks above
step('Gemma in every room');
{
  const { page, context, where } = await openPage({ width: 1280, height: 800, time: 'midday', path: '/?room=cuddlecore', phone: false });
  await page.waitForFunction(() => window.__explore?.navigate, null, { timeout: 15000 });
  for (const room of ROOMS) {
    const err = await page.evaluate(async id => {
      const ex = window.__explore;
      ex.goRoom(id);
      ex.state.trail.push({ kind: 'weather', id: 'rain', t: Date.now() }, { kind: 'time', id: 'evening', t: Date.now() });
      try { await ex.navigate(); return ex.state.result?.cluster ? null : 'named no reading'; } catch (e) { return String(e.message); }
    }, room);
    if (err) fail(`${where} ${room}: the navigator: ${err.slice(0, 120)}`);
  }
  await context.close();
}

await browser.close();
server.close();

// ---------- 5. the verdict
const secs = Math.round((Date.now() - t0) / 1000);
// The same problem by day and by night reads as one line
const merged = new Map();
for (const f of failures) {
  const key = f.replace(/ (midday|night)/, '');
  const times = f.match(/ (midday|night)/)?.[1];
  merged.set(key, [...(merged.get(key) || []), ...(times ? [times] : [])]);
}
failures.length = 0;
for (const [key, times] of merged) failures.push(times.length ? key.replace(/^(\d+x\d+)/, `$1 ${times.length === 2 ? 'day+night' : times[0]}`) : key);
const warned = [...new Set(warnings.map(w => w.replace(/ (midday|night)/, '')))];
if (warned.length) { console.log(`\nWarnings: ${warned.length} hotspot${warned.length > 1 ? 's' : ''} under the chat window (known, R1)`); for (const w of warned) console.log(`  · ${w}`); }
if (!failures.length) { console.log(`\nPASS (${secs} s)`); process.exit(0); }
console.log(`\nFAIL (${secs} s): ${failures.length} problem${failures.length > 1 ? 's' : ''}`);
for (const f of failures) console.log(`- ${f}`);
process.exit(1);
