// Screenshots of Erwina in each of her spots, for a preview: node scripts/erwina-shots.mjs <base url> <out dir>
// (base: a static server of public/, e.g. http://localhost:5193). Uses the installed Chrome through playwright-core,
// like check.mjs; the genie is answered locally. ?erwina=there makes her appear when her spot is looked at.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:5193', out = 'erwina-shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SHOTS = [
  { name: 'conservatory', room: 'glasshouse', time: 'midday', weather: 'fair' },
  { name: 'flourish', room: 'flourish', time: 'midday', weather: 'rain' },
  { name: 'hallway', room: 'hall-middle', time: 'night', weather: 'fair' },
];
const SIZES = [{ w: 1280, h: 800, tag: 'desktop' }, { w: 1280, h: 800, tag: 'desktop-close', fov: 38 }, { w: 375, h: 812, tag: 'phone' }];

let browser;
for (const channel of ['chrome', 'msedge']) {
  try { browser = await chromium.launch({ channel }); break; } catch { /* next */ }
}
for (const s of SHOTS) {
  for (const z of SIZES) {
    const context = await browser.newContext({ viewport: { width: z.w, height: z.h }, deviceScaleFactor: z.w < 600 ? 2 : 1, hasTouch: z.w < 600 });
    await context.addInitScript(([t, w]) => {
      localStorage.setItem('wa-welcomed', '1');
      if (!sessionStorage.getItem('wa-shot')) {
        sessionStorage.setItem('wa-shot', '1');
        sessionStorage.setItem('wa-door-done', '1');
        sessionStorage.setItem('wa-explore', JSON.stringify({ time: t, timeSetAt: Date.now(), weather: w, weatherFrom: 'visitor' }));
      }
    }, [s.time, s.weather]);
    await context.route(/whiskedaway-genie|challenges\.cloudflare\.com/, r => r.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/explore/?room=${s.room}&erwina=there`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__erwina?.active(), null, { timeout: 20000 });
    await page.waitForTimeout(2500);                                    // the full-resolution pano
    // centre the view a little above her, the way a visitor would look at her
    await page.evaluate(fov => {
      const E = window.__erwina, p = E.active().pos;
      E.look.yaw = Math.atan2(p.x, -p.z) * 180 / Math.PI;
      E.look.pitch = Math.atan2(p.y + 0.12, Math.hypot(p.x, p.z)) * 180 / Math.PI + (fov ? 0 : 6);
      if (fov) { E.camera.fov = fov; E.camera.updateProjectionMatrix(); }
      E.render();
    }, z.fov || 0);
    await page.waitForFunction(() => window.__erwina.active().cat.visible, null, { timeout: 5000 });
    await page.waitForTimeout(1200);                                    // her fade, and Gemma's line
    const file = join(out, `erwina-live-${s.name}-${z.tag}.png`);
    await page.screenshot({ path: file });
    console.log(file, errors.length ? `errors: ${errors.join(' | ')}` : 'ok');
    await context.close();
  }
}
await browser.close();
