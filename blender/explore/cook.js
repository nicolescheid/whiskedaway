// Cook mode (cook-mode-ux.md §1): a recipe one step at a time, full screen, big type, for a phone propped by the stove.
// Step 0 is "You'll need"; then the steps (a write-out's, else the short method split into sentences). Next and Back, swipes,
// tap zones and the arrow keys move; timed steps get a timer that counts by wall clock, rings with its own brass (even with the
// Inn's sound off: the visitor asked for it) and keeps ringing gently until tapped. The screen is kept awake where the browser allows.

import { pageSwipe } from './swipe.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 25:00, or 10:00:00 from an hour up (a jar set for breakfast)
const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), p = n => String(n).padStart(2, '0');
  return t >= 3600 ? `${Math.floor(t / 3600)}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}` : `${Math.floor(t / 60)}:${p(t % 60)}`; };
const STORE = 'wa-cook';                                       // the step you were on, per recipe, for this visit
const BIG = 'wa-cook-big';                                     // the larger text, remembered on the device
const RING_EVERY = 10000, RING_FOR = 120000;
const plural = w => /s$/.test(w) && !/ss$/.test(w);                // "pears are", "congee is"

/** The recipe's steps as { text, minutes?, uses? }: a write-out's (either shape), else the short method in sentences */
export function stepsOf(rec, full) {
  const raw = full?.steps?.length ? full.steps : String(rec.method_short || rec.body || '').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [];
  const steps = raw.map(x => (typeof x === 'string' ? { text: x.trim() } : { ...x })).filter(x => x.text);
  // A step without `minutes` may still say how long ("simmer for 30 minutes", "bake 25–30 min": the upper figure)
  for (const st of steps) if (!st.minutes) { const m = minutesIn(st.text); if (m) st.minutes = m; }
  // Still no timer: one on the waiting step (a waiting verb, else the last step), from the recipe's own wait or its time
  if (!steps.some(st => st.minutes) && steps.length) {
    const wait = rec.wait ? minutesIn(rec.wait) : null;
    const fromTime = rec.time >= 20 ? Math.max(5, Math.round((rec.time - 10) / 5) * 5) : null;
    const target = steps.findLast(st => WAITING.test(st.text));   // only a step that waits gets one (not "let it melt on your tongue")
    const m = /overnight/i.test(rec.wait || '') ? null : wait || fromTime;
    if (target && m) target.minutes = m;
  }
  return steps;
}
const WAITING = /simmer|tick over|bake|roast|\brest|chill|\bset\b|soak|steep|braise|stew|left in|leave it|in the freezer/i;   // not "from the fridge"
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30,
  forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90, 'a couple of': 2 };
/** Minutes named in a piece of text: "30 minutes", "25–30 min", "1 hour", "Twenty minutes", "2 hours in the freezer" → a number (≤ 600), or null */
export function minutesIn(text) {
  const t = String(text || '').toLowerCase().replace(/½/g, '.5');
  const n = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:–|-|to)\s*(\d+(?:\.\d+)?))?\s*(minutes?|mins?\b|min\b|hours?|hrs?\b|hr\b)/);
  const w = !n && t.match(/\b(a couple of|twenty-five|forty-five|an|a|one|two|three|four|five|ten|fifteen|twenty|thirty|forty|fifty|sixty|ninety)\s+(minutes?|hours?)\b/);
  if (!n && !w) return null;
  if (/^\s*before\b/.test(t.slice((n || w).index + (n || w)[0].length))) return null;   // "two minutes before bed" isn't a wait
  const v = n ? Number(n[2] || n[1]) : WORDS[w[1]], unit = n ? n[3] : w[2];
  const mins = Math.round(/^h/.test(unit) ? v * 60 : v);
  return mins > 0 && mins <= 600 ? mins : null;
}
/** "You'll need": a write-out's ingredients with amounts, else the seed's key ingredients */
export function needsOf(rec, full) {
  if (full?.ingredients?.length) return full.ingredients.map(i => [i.amount, i.unit, i.item].filter(Boolean).join(' '));
  return (rec.key_ingredients || rec.seed?.ingredients || []).slice();
}

export function createCook({ written, sound, track, say, lines = {}, beforeOpen, onList, isKept, writer }) {
  const L = { writing: "Gemma's writing the recipe…", failed: "I couldn't write this one just now, so here's the short version.", dim: 'Your phone may dim. Tap the screen to keep it awake.', first: "I'll ring the bell when it's done.", ready: 'Your {what} is ready.',
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
    <p class="ck-said" role="status" hidden></p>
    <div class="ck-timers" aria-label="Running timers"></div>
    <div class="ck-progress"><span class="ck-dots" aria-hidden="true"></span><span class="ck-count"></span></div>
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
    $('.ck-count').textContent = at === 0 ? '' : `Step ${at} of ${n}`;   // step 0's own heading says "You'll need"
    $('.ck-dots').innerHTML = Array.from({ length: n + 1 }, (_, i) => `<i class="${i === at ? 'on' : i < at ? 'past' : ''}"></i>`).join('');
    const st = steps[at - 1];
    const step = $('.ck-step');
    if (at === 0) {
      // Gemma's write-out on its way (cook mode started it, or joined the book page's), or one quiet line if it couldn't be
      const inflight = !hasFull && writer?.busyFor === rec.id;
      step.innerHTML = `<h3>${esc(L.need)}</h3><ul class="ck-needs">${needs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        + (inflight ? `<div class="ck-offer"><p>${esc(L.writing)} <span class="dots" aria-hidden="true">• • •</span></p></div>`
          : !hasFull && failedWrite ? `<p class="ck-quiet">${esc(L.failed)}</p>` : '')
        + (onList && isKept?.(rec.id) ? `<p><button class="bk-outline ck-list">${esc(lines.shopping_list || 'Shopping list')}</button></p>` : '');
      step.querySelector('.ck-list')?.addEventListener('click', () => { const was = pushed; close(); onList(rec, was); });
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
    if (!firstTimerSaid) { firstTimerSaid = true; speak(L.first); }
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
    speak((late >= 1 ? L.late.replace('{n}', late) : L.ready).replace('{what}', w).replace(/is ready/, plural(w) ? 'are ready' : 'is ready'));
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

  // Gemma's lines while cooking show inside cook mode, under the timers (the chat is behind it), and go to her chat too
  let saidTimer = null;
  function speak(t) {
    say?.(t);
    const p = $('.ck-said');
    p.textContent = t;
    p.hidden = false;
    clearTimeout(saidTimer);
    saidTimer = setTimeout(() => { p.hidden = true; }, 12000);
  }

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
      // Only phones and tablets dim while you cook: the line isn't shown on desktop (QA pass 5)
      $('.ck-dim').textContent = L.dim;
      $('.ck-dim').hidden = !matchMedia('(pointer: coarse)').matches;
    }
  }

  // ---------- the recipe's steps and "You'll need": its write-out if there is one, else the short version
  let hasFull = false, failedWrite = false;
  function load(r) {
    const full = written?.(r.id) || r.full || null;
    hasFull = !!full;
    steps = stepsOf(r, full);
    needs = needsOf(r, full);
    rec._tip = full?.tip || '';
    // "Ready by breakfast?" (a chia jar): the setting step's timer runs to that time, not the recipe's own minutes
    if (readyBy && steps.length) {
      const st = steps.findLast(x => WAITING.test(x.text)) || steps.at(-1);
      st.minutes = Math.max(1, Math.min(1440, Math.round((readyBy - Date.now()) / 60000)));   // to the next 7:00, even from the morning (QA 7)
    }
  }
  let readyBy = null;

  // ---------- open and close
  function open(r, from = 'book', { until = null } = {}) {
    beforeOpen?.();
    opener = document.activeElement;
    rec = r;
    readyBy = until;
    failedWrite = false;
    load(r);
    // "Cook this" just works: no write-out yet, so Gemma starts one (or joins the one on its way); it lands via refresh()
    if (!hasFull && writer && writer.busyFor !== r.id) {
      if (writer.left > 0 && !writer.busy) writer.writeNow(r, 'cook');
      else failedWrite = true;                          // 3 a visit used, or busy on another: the short version and its fallback timer
    }
    at = Math.min(saved()[r.id] ?? 0, steps.length);
    wake();                                                       // in the tap, as the mobile lead asked
    root.hidden = false;
    root.className = `cook${big() ? ' big' : ''}`;
    // The book makes every other child of body inert while it's open, this layer included: lift that, or nothing in here responds (QA pass 5)
    root.inert = false; delete root.dataset.bookInert;
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

  /** A write-out landed (or failed) for a recipe: if it's the one open, reload its steps and timers, keeping the step */
  function refresh(id) {
    if (root.hidden || !rec || rec.id !== id) return;
    const keep = at;
    load(rec);
    failedWrite = !hasFull;                             // it didn't come: say so once, quietly, on step 0
    at = Math.min(keep, steps.length);
    draw();
  }
  return { open, close, refresh, get isOpen() { return !root.hidden; } };
}
