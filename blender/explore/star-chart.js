// Sweet Spells' star chart reads your fortune (Nicole, 22 Oct: "a little fortune telling as well as giving you the recipe"):
// a small sheet, "Pick a star", with three made-up constellations from starChart.constellations. The picked star glows and
// Gemma's reading types out under it: a line about the visitor's day or kitchen, then the sweet it points to. Every way out
// (Done, ✕, the dim, Escape, Back) keeps the reading: closed before a pick, the stars pick one themselves. Her chat then says
// the reading, and the idea's card comes out (explore.html fortune).
// Words: gemma-lines.json starChart. Fortunes are kitchen-sized: no health, money or love, nothing that sounds like real prediction.

import { layers } from './layers.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const shuffle = xs => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** lines: gemma-lines.json starChart; beforeOpen: close what would cover it */
export function createStarChart({ lines: L = {}, track, sound, beforeOpen }) {
  const root = document.createElement('div');
  root.id = 'star-sheet';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'sc-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box sc-box">
      <header class="tl-head"><h2 id="sc-title">${esc(L.title || 'Pick a star.')}</h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body">
        <p class="small sc-sub">${esc(L.sub || "Three are out tonight. Tap one and I'll read it.")}</p>
        <div class="sc-sky" role="group" aria-label="${esc(L.title || 'Pick a star.')}"></div>
        <p class="sc-reading" aria-hidden="true"></p><p class="sr-only sc-said" role="status"></p>
      </div>
      <footer class="tl-foot"><span></span><button class="tl-done sc-done">${esc(L.done || 'Done')}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let stars = [], picked = null, reading = '', readFor = null, onClose = null, layer = null, typing = null;

  function pick(i, how = 'tap') {
    if (picked !== null) return;
    picked = i;
    reading = readFor(stars[i]);
    root.querySelectorAll('.sc-star').forEach((b, n) => {
      b.classList.toggle('on', n === i); b.classList.toggle('off', n !== i);
      b.setAttribute('aria-pressed', String(n === i)); b.disabled = n !== i;
    });
    if (how !== 'tap') return;
    track?.('hotspot_touch', { room: 'sweet-spells', object: 'star-pick', object_type: 'star' });   // a star was picked, never which
    sound?.shimmer?.();
    $('.sc-said').textContent = reading;
    const el = $('.sc-reading');
    if (reduce()) { el.textContent = reading; return; }
    let n = 0;
    clearInterval(typing);
    typing = setInterval(() => { n += 2; el.textContent = reading.slice(0, n); if (n >= reading.length) clearInterval(typing); }, 28);
    $('.sc-done').focus({ preventScroll: true });
  }

  /** open({ read, close }): read(star name) → the reading's text; close(reading) runs once the sheet has gone */
  function open({ read, close: after }) {
    const opener = document.activeElement;                       // before beforeOpen() moves anything
    beforeOpen?.();
    const pool = [].concat(L.constellations || ['The Whisk', 'The Teapot', 'The Lantern']);
    stars = shuffle(pool).slice(0, 3);
    picked = null; reading = ''; readFor = read; onClose = after;
    $('.sc-sky').innerHTML = stars.map((s, i) => `<button class="sc-star" aria-pressed="false" aria-label="${esc(s)}" style="--d:${i * 0.6}s"><span class="sc-glyph" aria-hidden="true">✦</span><span class="sc-name">${esc(s)}</span></button>`).join('');
    root.querySelectorAll('.sc-star').forEach((b, i) => b.onclick = () => pick(i));
    $('.sc-reading').textContent = '';
    $('.sc-said').textContent = '';
    root.hidden = false;
    root.className = `tell ${mode()} sc-sheet`;
    // A layer (layers.js): its history step, inert behind it, Escape, Tab and focus back to what opened it
    layer = layers.open({ el: root, name: 'stars', opener, close: how => done({ viaBack: how === 'back' }) });
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    root.querySelector('.sc-star').focus({ preventScroll: true });
  }
  // Every way out keeps the reading; closed before a pick, the stars pick one themselves
  function done({ viaBack = false } = {}) {
    if (root.hidden) return;
    if (picked === null) pick(Math.floor(Math.random() * stars.length), 'auto');
    clearInterval(typing);
    root.hidden = true;
    layers.closed(layer, { how: viaBack ? 'back' : 'self' });
    const f = onClose, t = reading;
    onClose = null;
    setTimeout(() => f?.(t), reduce() ? 0 : 200);                  // after the sheet has gone, so her line isn't behind it
  }
  $('.sc-done').onclick = () => done();
  $('.tl-x').onclick = () => done();
  $('.tl-dim').onclick = () => done();
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell ${mode()} sc-sheet`; });
  return { open, get isOpen() { return !root.hidden; } };
}
