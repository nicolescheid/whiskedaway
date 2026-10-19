// Cook mode (cook-mode-ux.md §1): a recipe one step at a time, full screen, big type, for a phone propped by the stove.
// Step 0 is "You'll need"; then the steps (a write-out's, else the short method split into sentences). Next and Back, swipes,
// tap zones and the arrow keys move; timed steps get a timer that counts by wall clock, rings with its own brass (even with the
// Inn's sound off: the visitor asked for it) and keeps ringing gently until tapped. The screen is kept awake where the browser allows.

import { pageSwipe } from './swipe.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const STORE = 'wa-cook';                                       // the step you were on, per recipe, for this visit
const BIG = 'wa-cook-big';                                     // the larger text, remembered on the device
const RING_EVERY = 10000, RING_FOR = 120000;
const plural = w => /s$/.test(w) && !/ss$/.test(w);                // "pears are", "congee is"

/** The recipe's steps as { text, minutes?, uses? }: a write-out's (either shape), else the short method in sentences */
export function stepsOf(rec, full) {
  const raw = full?.steps?.length ? full.steps : String(rec.method_short || rec.body || '').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  return raw.map(x => (typeof x === 'string' ? { text: x.trim() } : x)).filter(x => x.text);
}
/** "You'll need": a write-out's ingredients with amounts, else the seed's key ingredients */
export function needsOf(rec, full) {
  if (full?.ingredients?.length) return full.ingredients.map(i => [i.amount, i.unit, i.item].filter(Boolean).join(' '));
  return (rec.key_ingredients || rec.seed?.ingredients || []).slice();
}

export function createCook({ written, sound, track, say, lines = {}, beforeOpen, onList, isKept }) {
  const L = { dim: 'Your phone may dim. Tap the screen to keep it awake.', first: "I'll ring the bell when it's done.", ready: 'Your {what} is ready.',
              late: 'Your {what} finished {n} min ago.', done: 'Enjoy it.', need: "You'll need", ...lines };
  const root = document.createElement('div');
  root.id = 'cook';
  root.className = 'cook';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cook-title');
  root.innerHTML = `<header class="ck-head">
      <button class="ck-x" aria-label="Close cook mode">✕</button>
      <h2 id="cook-title"></h2>
      <button class="ck-peek" aria-expanded="false">Ingredients</button>
      <button class="ck-size" aria-pressed="false" aria-label="Larger text">A A</button>
    </header>
    <p class="ck-dim small" hidden></p>
    <div class="ck-timers" aria-label="Running timers"></div>
    <div class="ck-progress"><span class="ck-dots" aria-hidden="true"></span><span class="ck-count" aria-live="polite"></span></div>
    <main class="ck-main">
      <section class="ck-step" aria-live="polite"></section>
      <aside class="ck-side"><div class="ck-timer-slot"></div><p class="ck-uses"></p>
        <div class="ck-nav"><button class="ck-back">‹ Back</button><button class="ck-next">Next ›</button></div></aside>
    </main>
    <div class="ck-peekbox" hidden></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let rec = null, steps = [], needs = [], at = 0, pushed = false, lock = null, opener = null, firstTimerSaid = false, lastTap = 0;
  const timers = [];                                               // { step, label, end, left (ms while paused), paused, rang, ringUntil, nextRing }

  const big = () => { try { return localStorage.getItem(BIG) === '1'; } catch { return false; } };
  const saved = () => { try { return JSON.parse(sessionStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const remember = () => { try { sessionStorage.setItem(STORE, JSON.stringify({ ...saved(), [rec.id]: at })); } catch { /* storage blocked */ } };
  const what = () => (rec?.ref || rec?.short || rec?.title || 'food').replace(/^the /, '').toLowerCase();

  // ---------- drawing
  function draw() {
    const n = steps.length;
    $('#cook-title').textContent = rec.title;
    $('.ck-count').textContent = at === 0 ? L.need : `Step ${at} of ${n}`;
    $('.ck-dots').innerHTML = Array.from({ length: n + 1 }, (_, i) => `<i class="${i === at ? 'on' : i < at ? 'past' : ''}"></i>`).join('');
    const st = steps[at - 1];
    const step = $('.ck-step');
    if (at === 0) {
      step.innerHTML = `<h3>${esc(L.need)}</h3><ul class="ck-needs">${needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        + (onList && isKept?.(rec.id) ? `<p><button class="bk-outline ck-list">What do I need?</button></p>` : '');
      step.querySelector('.ck-list')?.addEventListener('click', () => { close(); onList(); });
      step.classList.remove('long');
    } else {
      const last = at === n;
      step.innerHTML = `<p>${esc(st.text)}</p>${last && rec._tip ? `<p class="ck-tip"><b>Gemma's tip:</b> ${esc(rec._tip)}</p>` : ''}`;
      step.classList.toggle('long', st.text.length > 150);
    }
    $('.ck-uses').textContent = st?.uses?.length ? `You'll need: ${st.uses.join(', ')}` : '';
    // A timed step's timer: Start, or the one already running for it
    const slot = $('.ck-timer-slot');
    slot.innerHTML = '';
    if (st?.minutes) {
      const t = timers.find(x => x.step === at);
      const b = document.createElement('button');
      b.className = 'ck-timer';
      b.dataset.step = at;
      slot.appendChild(b);
      paintTimer(b, t, st.minutes);
      b.onclick = () => (t ? toggle(t) : start(at, st.minutes));
      if (t && !t.rang) slot.insertAdjacentHTML('beforeend', `<button class="ck-cancel" aria-label="Cancel this timer">✕</button>`);
      slot.querySelector('.ck-cancel')?.addEventListener('click', () => cancel(t));
    }
    $('.ck-back').disabled = at === 0;
    $('.ck-next').textContent = at === n ? 'Done' : at === 0 ? 'Start cooking ›' : 'Next ›';
    root.classList.toggle('big', big());
    $('.ck-size').setAttribute('aria-pressed', String(big()));
    drawStrip();
  }
  function paintTimer(b, t, minutes) {
    const left = t ? (t.paused ? t.left : t.end - Date.now()) : minutes * 60000;
    b.classList.toggle('ringing', !!t?.rang && !t.stopped);
    b.classList.toggle('paused', !!t?.paused);
    b.innerHTML = !t ? `<span aria-hidden="true">⏱</span> Start ${mmss(left)}` : t.rang ? `<span aria-hidden="true">🔔</span> Done: tap to stop`
      : `<span aria-hidden="true">⏱</span> ${mmss(left)}${t.paused ? ' (paused)' : ''}`;
  }
  function drawStrip() {
    const live = timers.filter(t => !t.stopped);
    $('.ck-timers').innerHTML = live.map((t, i) => `<button data-i="${i}" class="${t.rang ? 'ringing' : ''}">${esc(t.label)} ${t.rang ? 'ready' : mmss(t.paused ? t.left : t.end - Date.now())}</button>`).join('');
    $('.ck-timers').querySelectorAll('button').forEach(b => b.onclick = () => { const t = live[+b.dataset.i]; if (t.rang) stop(t); else go(t.step); });
  }

  // ---------- timers (wall clock: the end is a timestamp, worked out on every tick and on return)
  function start(step, minutes) {
    sound?.unlock?.();                                            // the tap is the audio gesture (iOS)
    timers.push({ step, label: what().replace(/^./, c => c.toUpperCase()), end: Date.now() + minutes * 60000, paused: false });
    track?.('timer_start');
    if (!firstTimerSaid) { firstTimerSaid = true; say?.(L.first); }
    draw();
  }
  function toggle(t) {
    if (t.rang) return stop(t);
    if (t.paused) { t.end = Date.now() + t.left; t.paused = false; } else { t.left = t.end - Date.now(); t.paused = true; }
    draw();
  }
  function cancel(t) { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); draw(); }
  function stop(t) { t.stopped = true; t.stopRing?.(); cancel(t); }
  function ring(t, late = 0) {
    t.rang = true;
    t.ringUntil = Date.now() + RING_FOR;
    t.nextRing = Date.now() + RING_EVERY;
    // sound.timerRing rings three strikes, then gently every ~10 s for 2 min, whatever the Inn's switch; it returns its stop
    if (sound?.timerRing) t.stopRing = sound.timerRing(); else sound?.bell?.();
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
    track?.('timer_done');
    const w = what();
    say?.((late >= 1 ? L.late.replace('{n}', late) : L.ready).replace('{what}', w).replace(/is ready/, plural(w) ? 'are ready' : 'is ready'));
    draw();
  }
  setInterval(() => {
    if (!timers.length) return;
    const now = Date.now();
    for (const t of timers) {
      if (t.paused || t.stopped) continue;
      if (!t.rang && now >= t.end) { if (!document.hidden) ring(t); }   // a hidden tab rings on return (visibilitychange)
      else if (t.rang && !t.stopRing && now < t.ringUntil && now >= t.nextRing) { t.nextRing = now + RING_EVERY; sound?.bell?.(); }   // fallback re-ring
    }
    // About once a second while a timer runs: the soft tick in its last 10 seconds (sound.js plays it only with sound on)
    const soonest = Math.min(...timers.filter(t => !t.rang && !t.paused && !t.stopped).map(t => t.end - now));
    if (Number.isFinite(soonest)) sound?.timer?.({ last10: soonest <= 10000 });
    if (!root.hidden) { root.querySelectorAll('.ck-timer').forEach(b => paintTimer(b, timers.find(x => x.step === +b.dataset.step), steps[+b.dataset.step - 1]?.minutes)); drawStrip(); }
  }, 1000);
  // A tab that was hidden plays no sound (iOS): a timer that ended meanwhile rings once on return, saying how long ago
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const now = Date.now();
    for (const t of timers) if (!t.rang && !t.paused && now >= t.end) ring(t, Math.floor((now - t.end) / 60000));
    if (!root.hidden) wake();
  });

  // ---------- moving
  function go(i) {
    at = Math.max(0, Math.min(steps.length, i));
    remember();
    draw();
    if (!reduce()) $('.ck-step').animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 180 });
  }
  const next = () => (at === steps.length ? done() : go(at + 1));
  const back = () => go(at - 1);
  $('.ck-next').onclick = next;
  $('.ck-back').onclick = back;
  pageSwipe($('.ck-step'), d => (d > 0 ? next() : back()));
  // Floury hands: a tap on the step's right ~60 % is Next, its left ~25 % Back (taps that barely moved, ~400 ms apart)
  let down = null;
  $('.ck-step').addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  $('.ck-step').addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || e.target.closest('button, a')) return;
    const now = performance.now();
    if (now - lastTap < 400) return;
    lastTap = now;
    const r = $('.ck-step').getBoundingClientRect(), k = (e.clientX - r.left) / r.width;
    if (k > 0.4) next(); else if (k < 0.25) back();
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); return close(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });
  $('.ck-size').onclick = () => { try { localStorage.setItem(BIG, big() ? '0' : '1'); } catch { /* storage blocked */ } draw(); };
  $('.ck-peek').onclick = () => {
    const box = $('.ck-peekbox'), open = box.hidden;
    box.hidden = !open;
    $('.ck-peek').setAttribute('aria-expanded', String(open));
    if (open) box.innerHTML = `<h3>${esc(L.need)}</h3><ul>${needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  };
  $('.ck-peekbox').onclick = () => $('.ck-peek').click();
  $('.ck-x').onclick = () => close();

  // ---------- the screen stays awake where the browser allows (iOS Low Power Mode and older home-screen apps refuse)
  async function wake() {
    try {
      if (!navigator.wakeLock) throw new Error('none');
      lock = await navigator.wakeLock.request('screen');
      $('.ck-dim').hidden = true;
    } catch {
      $('.ck-dim').textContent = L.dim;
      $('.ck-dim').hidden = false;
    }
  }

  // ---------- open and close
  function open(r, from = 'book') {
    beforeOpen?.();
    opener = document.activeElement;
    rec = r;
    const full = written?.(r.id) || r.full || null;
    steps = stepsOf(r, full);
    needs = needsOf(r, full);
    rec._tip = full?.tip || '';
    at = Math.min(saved()[r.id] ?? 0, steps.length);
    wake();                                                       // in the tap, as the mobile lead asked
    root.hidden = false;
    root.className = `cook${big() ? ' big' : ''}`;
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.cookInert = '1'; }
    if (!pushed) { history.pushState({ ...(history.state || {}), cook: true }, ''); pushed = true; }
    draw();
    $('.ck-next').focus({ preventScroll: true });
    track?.('cook_open', { from });
  }
  function close(viaBack = false) {
    if (root.hidden) return;
    root.hidden = true;
    $('.ck-peekbox').hidden = true;
    for (const el of document.body.children) if (el.dataset.cookInert) { el.inert = false; delete el.dataset.cookInert; }
    try { lock?.release(); } catch { /* already released */ }
    lock = null;
    if (pushed) { pushed = false; if (!viaBack && history.state?.cook) history.back(); }
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function done() {
    track?.('cook_done');
    try { sessionStorage.setItem(STORE, JSON.stringify({ ...saved(), [rec.id]: 0 })); } catch { /* storage blocked */ }
    close();
    say?.(L.done);
  }
  addEventListener('popstate', () => { if (pushed && !history.state?.cook) { pushed = false; close(true); } });

  return { open, close, get isOpen() { return !root.hidden; } };
}
