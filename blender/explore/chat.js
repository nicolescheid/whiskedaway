// Gemma's chat in three sizes (recipe-book-ux.md v4 §4b): Line (her newest words), Short (the last few messages and
// her answer chips) and Full (the whole log). Her newest line shows in every size. Every screen opens at Line;
// a question raises Line to Short until it's answered, unless the visitor chose the size themselves. It never opens Full by itself.
// Change size by dragging or tapping the handle, the ▴ ▾ buttons, tapping her line, Escape or back (down one size).
// The page keeps the log (state.chat) and calls update() when it changes; this module owns the window's size and scroll.

import { layers } from './layers.js';

export const SIZES = ['line', 'short', 'full'];
const KEY = 'wa-chat';
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqLand = matchMedia('(max-height: 500px) and (orientation: landscape)');
const mqPhone = matchMedia('(max-width: 719px)');
/** 'phone' (portrait, under 720 wide), 'land' (a phone on its side, 500 tall or less) or 'desk' */
export const screenMode = () => (mqLand.matches ? 'land' : mqPhone.matches ? 'phone' : 'desk');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createChat({ win, track, onSize }) {
  const bar = win.querySelector('.cw-bar'), body = win.querySelector('.cw-body'), log = win.querySelector('.cw-log');
  // The handle row: a grip (drag or tap), and the ▾ ▴ buttons in place of the old minimise button
  bar.classList.add('cw-handle');
  bar.insertAdjacentHTML('afterbegin', '<span class="cw-grip" aria-hidden="true"></span>');
  const btns = document.createElement('span');
  btns.className = 'cw-sizes';
  btns.innerHTML = `<button class="cw-less" aria-label="Show less of Gemma's chat"><span aria-hidden="true">▾</span></button><button class="cw-more" aria-label="More of Gemma's chat"><span aria-hidden="true">▴</span></button>`;
  bar.appendChild(btns);
  const less = btns.querySelector('.cw-less'), more = btns.querySelector('.cw-more');
  // Her newest line (the Line size), with "…more" when it runs past three lines
  const line = document.createElement('div');
  line.className = 'cw-line';
  line.innerHTML = '<p class="cw-said" aria-hidden="true"></p><button class="cw-moreline" hidden>…more</button>';
  body.insertBefore(line, log);
  const said = line.querySelector('.cw-said'), moreLine = line.querySelector('.cw-moreline');
  // Her newest line for screen readers at Line size: the log is display:none there and the line above is aria-hidden
  // (in Short and Full the log itself announces, so this stays quiet)
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  win.appendChild(live);
  // The visitor's tags (tags.js fills it)
  const tags = document.createElement('div');
  tags.className = 'cw-tags';
  body.insertBefore(tags, log);
  // The visit's theme, once something's kept ("Today: sweet, evening"): with the tags, in Short and Full on phones
  const theme = document.createElement('p');
  theme.className = 'cw-theme';
  theme.hidden = true;
  body.insertBefore(theme, log);
  // "Newest ▾": her new line, when the visitor has scrolled up the log
  const newest = document.createElement('button');
  newest.className = 'cw-newest';
  newest.hidden = true;
  win.appendChild(newest);
  // Full on a phone: a scrim over the dimmed room; a tap on it goes back a size (the room itself is inert)
  const scrim = document.createElement('div');
  scrim.className = 'cw-scrim';
  scrim.hidden = true;
  document.body.appendChild(scrim);

  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { /* storage blocked */ }
  let chosen = SIZES.includes(saved.chosen) ? saved.chosen : null;   // what the visitor picked, for the visit
  let called = false;
  let size = null, asking = false, held = false, prevSize = null, lastGemma = null, pinned = true, fullLayer = null, closing = 'self';
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ chosen })); } catch { /* storage blocked */ } };
  const base = () => chosen || 'line';
  // What the size should be now: the visitor's choice, else the screen's default, raised to Short while she's asking
  const wanted = () => {
    if (held) return 'line';
    const b = base();
    return asking && !chosen && b === 'line' ? 'short' : b;
  };

  function apply(next, how) {
    if (next === size) return;
    const was = size;
    if (was && was !== 'full') prevSize = was;
    size = next;
    for (const s of SIZES) win.classList.toggle(`size-${s}`, s === size);
    document.body.dataset.chat = size;
    const i = SIZES.indexOf(size);
    less.setAttribute('aria-disabled', String(i === 0));   // still focusable, so focus isn't lost at Line
    more.setAttribute('aria-label', size === 'full' ? "Gemma's chat: full. Back to her newest line" : "Show more of Gemma's chat");
    more.setAttribute('aria-expanded', String(size !== 'line'));
    sheet(size === 'full' && screenMode() !== 'desk');
    if (size !== 'line') requestAnimationFrame(() => { if (pinned) log.scrollTop = log.scrollHeight; });
    if (was && !reduce()) win.animate([{ opacity: 0.85 }, { opacity: 1 }], { duration: 180 });
    fitLine();
    if (was && how) track?.('chat_size', { panel_size: size, method: how });
    onSize?.(size);
  }
  function choose(next, how) {
    if (!SIZES.includes(next)) return;
    chosen = next;
    persist();
    held = false;
    apply(wanted(), how);
  }
  const step = d => {
    const i = SIZES.indexOf(size);
    if (d > 0 && size === 'full') return choose('line', 'tap');       // from Full, a tap on the handle goes back to Line
    choose(SIZES[Math.max(0, Math.min(2, i + d))], 'button');
  };
  more.onclick = e => { e.stopPropagation(); size === 'full' ? choose('line', 'button') : step(1); };
  less.onclick = e => { e.stopPropagation(); if (size !== 'line') step(-1); };
  said.parentElement.onclick = e => { if (size === 'line' && !e.target.closest('.cw-chips')) choose('short', 'tap'); };
  moreLine.onclick = e => { e.stopPropagation(); choose('short', 'tap'); };
  scrim.onclick = () => choose(prevSize && prevSize !== 'full' ? prevSize : 'short', 'tap');

  // Drag the handle: vertical only (the 1.5× axis lock), snaps on release; a tap goes up one size
  let drag = null;
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.button) return;
    drag = { y: e.clientY, x: e.clientX, t: performance.now(), lock: null, id: e.pointerId };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.lock && Math.hypot(dx, dy) >= 10) drag.lock = Math.abs(dy) > 1.5 * Math.abs(dx) ? 'y' : 'x';
    if (drag.lock === 'y' && !reduce()) win.style.transform = `translateY(${Math.max(-40, Math.min(40, dy * 0.3))}px)`;
  });
  const endDrag = (e, cancelled) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    win.style.transform = '';
    if (cancelled) return;                                          // pointercancel springs back, no change
    const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t);
    if (!d.lock) return step(1);                                    // a tap (moved under 10 px)
    if (d.lock !== 'y') return;
    const steps = Math.abs(v) > 0.5 ? Math.sign(dy) : Math.round(dy / 120);
    if (!steps) return;
    const i = Math.max(0, Math.min(2, SIZES.indexOf(size) - steps));   // up (negative dy) is bigger; below Line does nothing
    if (SIZES[i] !== size) choose(SIZES[i], 'drag');
  };
  bar.addEventListener('pointerup', e => endDrag(e, false));
  bar.addEventListener('pointercancel', e => endDrag(e, true));
  // The grip isn't focusable: the ▴ ▾ buttons are the keyboard way

  // Escape goes down one size, unless something above the chat is open
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || size === 'line') return;
    if (document.querySelector('.tool.open, #book.open, .panel.open, .tag-pick:not([hidden])') || document.getElementById('idea-hl')?.hidden === false) return;
    step(-1);
  });

  // Full on a phone is a sheet: a layer (layers.js), so the room is dimmed and inert, and Back or Escape goes back a size.
  // The scrim and an idea's Undo stay live with it
  function sheet(on) {
    scrim.hidden = !on;
    if (on && !fullLayer) {
      fullLayer = layers.open({ el: win, name: 'chat-full', keep: [scrim, document.querySelector('.idea-undo')].filter(Boolean),
        close: how => { closing = how; choose(prevSize && prevSize !== 'full' ? prevSize : 'short', 'button'); } });
    } else if (!on && fullLayer) {
      const L = fullLayer, how = closing;
      fullLayer = null; closing = 'self';
      layers.closed(L, { how: how === 'back' ? 'back' : 'self', refocus: how !== 'self' });
    }
  }

  // The log: follow the newest message unless the visitor has scrolled up; then "Newest ▾" carries her line
  log.addEventListener('scroll', () => {
    pinned = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    if (pinned) newest.hidden = true;
  }, { passive: true });
  newest.onclick = () => { log.scrollTop = log.scrollHeight; newest.hidden = true; pinned = true; };

  function fitLine() {
    requestAnimationFrame(() => { moreLine.hidden = size !== 'line' || said.scrollHeight <= said.clientHeight + 2; });
  }
  /** The log changed: her newest line goes to the Line strip, and the log keeps to the bottom if it was there. */
  function update(messages) {
    const g = [...messages].reverse().find(m => m.who === 'gemma');
    const text = g?.text || '';
    const isNew = text && g !== lastGemma && lastGemma !== null;
    if (text && g !== lastGemma && called && size === 'line') live.textContent = text;   // not the first call: that is the restored log
    called = true;
    lastGemma = g || null;
    said.textContent = text;
    said.scrollTop = 0;
    if (pinned || size === 'line') { log.scrollTop = log.scrollHeight; newest.hidden = true; }
    else if (isNew) { newest.innerHTML = `<span>${esc(text)}</span> <b>Newest ▾</b>`; newest.hidden = false; }
    fitLine();
  }
  /** Gemma is asking (her answer chips are showing), or has been answered */
  function setAsking(on) {
    if (asking === !!on) return;
    asking = !!on;
    apply(wanted(), asking && !chosen ? 'auto' : null);
  }
  /** A highlight is open: hold the chat at Line on phones, and restore it when it closes */
  function hold(on) {
    held = !!on && screenMode() !== 'desk';
    apply(wanted(), null);
  }
  const refit = () => apply(wanted(), null);
  mqLand.addEventListener('change', refit);
  mqPhone.addEventListener('change', refit);
  apply(wanted(), null);

  return {
    update, setAsking, hold, choose,
    setTheme(words) { theme.textContent = words.length ? `Today: ${words.join(', ')}` : ''; theme.hidden = !words.length; },
    get size() { return size; },
    tags,
    /** Show the tags above the Line strip for a moment (arriving in a room) */
    // Only what they've told her flashes, never the "+ Tell me about you" chip alone
    flashTags() { if (!tags.querySelector('.tag[data-k]')) return; win.classList.add('tags-flash'); clearTimeout(this._ft); this._ft = setTimeout(() => win.classList.remove('tags-flash'), 4000); },
  };
}
