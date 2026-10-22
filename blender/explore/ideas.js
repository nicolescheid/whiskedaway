// Gemma's Ideas (recipe-book-ux.md v4 §1–4): small bubbles in a column at the screen's right edge, at most 3.
// Tap a bubble for its highlight (title, hook, why, Not this / Keep); "Read ›" opens the book at its page.
// The page owns the visit (state.cards, state.waiting) and the navigator; this module draws the column and the
// highlight, runs the replacement rule, the undo and the live region, and hands decisions back through callbacks.

/** Room ribbons: a colour, a name and a fallback glyph for an idea with no icon yet */
export const RIBBONS = {
  cuddlecore: { name: 'Cuddlecore', colour: '#c4956a', glyph: '🍲' },
  flourish: { name: 'Flourish', colour: '#6f8f4e', glyph: '🥗' },
  'sweet-spells': { name: 'Sweet Spells', colour: '#b5577a', glyph: '🍰' },
  chiapothecary: { name: 'Chiapothecary', colour: '#4f8a83', glyph: '🥣' },
  glasshouse: { name: 'Conservatory', colour: '#7a9a5c', glyph: '🌿' },
};
import { swipeable } from './swipe.js';

export const MAX_IDEAS = 3;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Until every atom has its own `icon` (content editor), a guess from the title, then the room's glyph
const GUESS = [[/strawberr/, '🍓'], [/chocolate|cocoa|truffle/, '🍫'], [/pear/, '🍐'], [/banana/, '🍌'], [/apple/, '🍎'], [/lemon|citrus/, '🍋'],
  [/orange|clementine/, '🍊'], [/kiwi/, '🥝'], [/mango/, '🥭'], [/berr/, '🫐'], [/watermelon|melon/, '🍉'], [/pineapple/, '🍍'], [/peach/, '🍑'],
  [/cherr/, '🍒'], [/coconut/, '🥥'], [/egg|omelette|frittata/, '🍳'], [/pancake/, '🥞'], [/toast|bread|sandwich/, '🍞'], [/soup|broth|congee/, '🍲'],
  [/salad/, '🥗'], [/rice/, '🍚'], [/noodle|pasta|ramen/, '🍜'], [/smoothie|juice|lassi|shake/, '🥤'], [/tea|chai|latte/, '🍵'], [/cookie|biscuit/, '🍪'],
  [/cake|pavlova|tart|crumble/, '🍰'], [/ice|sorbet|frozen|popsicle/, '🍨'], [/honey/, '🍯'], [/avocado/, '🥑'], [/carrot/, '🥕'], [/potato|kumara/, '🥔'],
  [/fish|salmon/, '🐟'], [/chicken/, '🍗'], [/cheese/, '🧀'], [/nut|almond|peanut/, '🥜'], [/chia|pudding|porridge|oat|yoghurt/, '🥣']];
export const iconOf = a => a.icon || GUESS.find(([re]) => re.test(a.title.toLowerCase()))?.[1] || RIBBONS[a.room]?.glyph || '🍴';
export const shortOf = a => a.short || a.title.split(/\s+/).filter(w => !/^(and|with|a|the|of|in|on)$/i.test(w)).slice(0, 2).join(' ');
export const spoonsOf = a => (a.spoons ? '🥄'.repeat(a.spoons) : 'no spoons needed');
export const minutesOf = a => (a.time ? `${a.time} min` : '');
/** "SWEET SPELLS · recipe idea · 25 min · 🥄" */
export const metaLine = (a, room = true) => [room && RIBBONS[a.room]?.name, a.kind, minutesOf(a), spoonsOf(a)].filter(Boolean).map(esc).join(' · ');

export function createIdeas({ state, atoms, save, here, onKeep, onDismiss, onUndo, onRead, onHighlight, onShown, canShow, onFirst, avatar, bookChip, layout, wantHint, onHint }) {
  const col = document.createElement('div');
  col.className = 'ideas';
  col.id = 'ideas';
  col.setAttribute('role', 'group');
  const hl = document.createElement('article');
  hl.className = 'idea-hl';
  hl.id = 'idea-hl';
  hl.hidden = true;
  hl.setAttribute('role', 'dialog');
  hl.setAttribute('aria-modal', 'false');
  const toast = document.createElement('div');
  toast.className = 'idea-undo';
  toast.hidden = true;
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  document.body.append(col, hl, toast, live);

  let openAtom = null;                 // the idea whose highlight is open
  let arriving = new Map();            // atom -> the screen point it rises from
  let leaving = [];                    // replaced bubbles floating away: { atom, rect }
  const say = text => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };
  const entry = atom => state.cards.find(c => c.atom === atom);

  // An idea counts as shown once its bubble has been in view for 2 s (or the visitor opened it): not when the navigator
  // picks it, and not if the next idea replaces it first. Once per idea per page (analytics: atom_served)
  const shown = new Set(), timing = new Set();
  const markShown = c => { if (!c || shown.has(c.atom)) return; shown.add(c.atom); timing.delete(c.atom); onShown?.(c); };
  function watchShown() {
    if (!onShown) return;
    for (const c of state.cards) {
      if (shown.has(c.atom) || timing.has(c.atom)) continue;
      timing.add(c.atom);
      const check = () => {
        const cur = entry(c.atom);
        if (!cur) timing.delete(c.atom);                                  // replaced or set aside before it was seen
        else if (shown.has(c.atom)) return;
        else if (document.hidden || col.hidden || canShow?.() === false) setTimeout(check, 2000);   // not in front of anyone yet
        else markShown(cur);
      };
      setTimeout(check, 2000);
    }
  }

  /** A new idea from the navigator. `from`: the point it rises from ({x, y}), or null for Gemma's avatar. */
  // force: a card the visitor asked for (an object's or the star chart's): with every card opened, it replaces the oldest
  function add({ atom, why }, from = null, { force = false } = {}) {
    if (!atoms[atom] || entry(atom)) return;
    const first = !state.ideaSeen;
    state.ideaSeen = true;
    const card = { atom, why, opened: false };
    if (state.cards.length < MAX_IDEAS - (undoing ? 1 : 0)) state.cards.unshift(card);
    else if (undoing) { state.waiting = card; save(); render(); return; }   // the set-aside idea's slot is kept for its Undo (QA P3-2)
    else {
      // Replace the oldest one that hasn't been opened; if every one has been, it waits as "+1"
      let i = state.cards.map(c => c.opened).lastIndexOf(false);
      if (i < 0 && force) i = state.cards.length - 1;
      if (i < 0) { state.waiting = card; save(); render(); return; }
      const gone = state.cards.splice(i, 1)[0];
      const el = col.querySelector(`[data-atom="${CSS.escape(gone.atom)}"]`);
      if (el && gone.atom !== openAtom) leaving.push({ atom: gone.atom, rect: el.getBoundingClientRect() });
      if (gone.atom === openAtom) close(false);
      state.cards.unshift(card);
    }
    arriving.set(atom, from);
    save();
    render();
    say(`New idea: ${shortOf(atoms[atom])}.`);
    if (first) onFirst?.();
  }

  /** Bring the waiting "+1" in, replacing the oldest opened idea */
  function bringWaiting() {
    const w = state.waiting;
    if (!w) return;
    state.waiting = null;
    if (state.cards.length >= MAX_IDEAS) {                        // it replaces the oldest opened one, else the oldest
      const i = state.cards.map(c => c.opened).lastIndexOf(true);
      state.cards.splice(i >= 0 ? i : state.cards.length - 1, 1);
    }
    state.cards.unshift(w);
    arriving.set(w.atom, null);
    save();
    render();
    open(w.atom);
  }

  function render() {
    state.cards = state.cards.filter(c => atoms[c.atom]).slice(0, MAX_IDEAS);
    const n = state.cards.length + (state.waiting ? 1 : 0);
    col.setAttribute('aria-label', `Gemma's ideas (${state.cards.length})`);
    col.hidden = !n;
    const before = new Map([...col.querySelectorAll('.idea[data-atom]')].map(b => [b.dataset.atom, b.getBoundingClientRect()]));
    const focused = col.contains(document.activeElement) ? document.activeElement.dataset.atom || '+1' : null;   // redrawing keeps the focus
    col.innerHTML = '';
    // Newest at the bottom, nearest the thumb and Gemma
    state.cards.slice().reverse().forEach((c, i) => {
      const a = atoms[c.atom], rb = RIBBONS[a.room];
      const b = document.createElement('button');
      b.className = `idea${c.opened ? '' : ' new'}${c.atom === openAtom ? ' open' : ''}`;
      b.dataset.atom = c.atom;
      b.style.setProperty('--ring', rb?.colour || 'var(--berry)');
      b.style.setProperty('--bob', `${(i * 1.7) % 4}s`);
      b.setAttribute('aria-label', `Idea: ${a.title}${rb ? `, ${rb.name}` : ''}${c.opened ? '' : ', new'}`);
      b.setAttribute('aria-expanded', String(c.atom === openAtom));
      b.setAttribute('aria-controls', 'idea-hl');
      b.innerHTML = `<span class="ic" aria-hidden="true">${esc(iconOf(a))}</span><span class="lbl" aria-hidden="true"><span class="t">${esc(a.title)}</span><span class="s">${esc(shortOf(a))}</span></span>`;
      b.onclick = e => { e.stopPropagation(); c.atom === openAtom ? close() : open(c.atom); };
      col.appendChild(b);
    });
    if (state.waiting) {
      const b = document.createElement('button');
      b.className = 'idea more';
      b.setAttribute('aria-label', 'One more idea from Gemma');
      b.innerHTML = '<span class="ic" aria-hidden="true">+1</span>';
      b.onclick = e => { e.stopPropagation(); bringWaiting(); };
      col.appendChild(b);
    }
    if (focused) (col.querySelector(focused === '+1' ? '.idea.more' : `[data-atom="${CSS.escape(focused)}"]`) || col.querySelector('.idea') || bookChip?.())?.focus({ preventScroll: true });
    animate(before);
    watchShown();
  }

  // The column's motion: new ideas rise from where they came from, the rest slide to their new places,
  // replaced ones float up and fade (reduced motion: fades only)
  function animate(before) {
    const rm = reduce();
    for (const b of col.querySelectorAll('.idea[data-atom]')) {
      const atom = b.dataset.atom, to = b.getBoundingClientRect();
      if (arriving.has(atom)) {
        const p = arriving.get(atom) || centre(avatar?.());
        arriving.delete(atom);
        b.classList.add('arrived');
        setTimeout(() => b.classList.remove('arrived'), 3200);      // the short label slides out for ~3 s on phones
        if (rm || !p) { b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); continue; }
        const dx = p.x - (to.left + to.width / 2), dy = p.y - (to.top + to.height / 2);
        b.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.4)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }],
                  { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)' });
      } else if (before.has(atom) && !rm) {
        const f = before.get(atom), dy = f.top - to.top;
        if (Math.abs(dy) > 1) b.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 400, easing: 'ease-out' });
      }
    }
    for (const { atom, rect } of leaving.splice(0)) ghost(atom, rect, rm ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-40px) scale(.8)', opacity: 0 }], 500);
  }
  // A stand-in bubble for one that has left the column, so it can float away or pop
  function ghost(atom, rect, frames, duration) {
    const a = atoms[atom];
    if (!a || !rect) return;
    const g = document.createElement('div');
    g.className = 'idea ghost';
    g.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;--ring:${RIBBONS[a.room]?.colour || 'var(--berry)'}`;
    g.innerHTML = `<span class="ic">${esc(iconOf(a))}</span>`;
    document.body.appendChild(g);
    g.animate(frames, { duration, easing: 'ease-out', fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
  }
  const centre = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };

  // ---------- the highlight
  function open(atom, { focus = true } = {}) {
    const c = entry(atom);
    if (!c) return;
    const a = atoms[atom];
    const firstOpen = !c.opened;
    markShown(c);
    c.opened = true;
    openAtom = atom;
    save();
    hl.setAttribute('aria-labelledby', 'idea-hl-title');
    hl.style.setProperty('--ring', RIBBONS[a.room]?.colour || 'var(--berry)');
    // The ✕ comes last in the DOM, so the Tab order is Read, Not this, Keep, ✕ (it's drawn in the corner)
    hl.innerHTML = `<div class="stamp s-keep" aria-hidden="true">♥ Into the basket</div><div class="stamp s-no" aria-hidden="true">Not today ⟲</div>
      <div class="meta">${metaLine(a, a.room !== here?.())}</div>
      <h4 id="idea-hl-title"><button class="read" data-act="read">${esc(a.title)}</button></h4>
      <p class="hook">${esc(a.hook || a.body)}</p>
      <p class="why">${c.why ? `${esc(c.why)} ` : ''}<button class="readmore" data-act="read" tabindex="-1" aria-hidden="true">Read ›</button></p>
      <div class="acts"><button class="no" data-act="no">Not this</button><button class="keep" data-act="keep"><span aria-hidden="true">♥</span> Keep</button></div>
      <button class="x" data-act="close" aria-label="Close this idea">✕</button>`;
    hl.hidden = false;
    hl.dataset.atom = atom;
    hl.querySelector('[data-act=close]').onclick = e => { e.stopPropagation(); close(); };
    hl.querySelectorAll('[data-act=read]').forEach(b => b.onclick = e => { e.stopPropagation(); onRead(c); });
    hl.querySelector('[data-act=no]').onclick = e => { e.stopPropagation(); dismiss(atom, 'button'); };
    hl.querySelector('[data-act=keep]').onclick = e => { e.stopPropagation(); keep(atom, 'button'); };
    // Tapping the card's body (not a button) reads it too
    hl.onclick = e => { if (!e.target.closest('button') && !hl.dragged) onRead(c); };
    place();
    render();
    if (!reduce() && firstOpen) hl.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    if (focus) hl.querySelector('.read').focus({ preventScroll: true });
    layout?.('highlight', true);
    if (firstOpen) onHighlight?.(c);
    // The first highlight a touch visitor opens nudges right and back, and Gemma says once per device how to swipe
    if (touchy() && wantHint?.()) {
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => {
        if (openAtom !== atom) return;
        if (!reduce()) hl.animate([{ transform: 'none' }, { transform: 'translateX(12px) rotate(1deg)' }, { transform: 'none' }], { duration: 600, easing: 'ease-in-out' });
        onHint?.();
      }, 1000);
    }
  }
  let hintTimer = null;
  const touchy = () => matchMedia('(pointer: coarse)').matches;
  // Right keeps, left sets aside, down closes on a phone held upright (swipe.js)
  swipeable(hl, {
    onKeep: () => openAtom && keep(openAtom, 'swipe'),
    onDismiss: () => openAtom && dismiss(openAtom, 'swipe'),
    onClose: () => close(),
    canClose: () => matchMedia('(max-width: 719px) and (orientation: portrait)').matches,
  });
  // Up and down arrows move between the bubbles
  col.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const bs = [...col.querySelectorAll('.idea')], i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
  });
  // Desktop: bottom-aligned with the bubble that opened it (phones place it by CSS)
  function place() {
    if (hl.hidden) return;
    const b = col.querySelector(`[data-atom="${CSS.escape(openAtom || '')}"]`);
    hl.style.removeProperty('--hl-bottom');
    if (b && matchMedia('(min-width: 720px) and (min-height: 501px)').matches) {
      hl.style.setProperty('--hl-bottom', `${Math.max(16, innerHeight - b.getBoundingClientRect().bottom)}px`);
    }
  }
  addEventListener('resize', place);
  function close(returnFocus = true) {
    if (!openAtom) return;
    const atom = openAtom, hadFocus = hl.contains(document.activeElement);
    openAtom = null;
    hl.hidden = true;
    hl.innerHTML = '';
    render();
    layout?.('highlight', false);
    if ((returnFocus && hadFocus) || returnFocus === 'force') col.querySelector(`[data-atom="${CSS.escape(atom)}"]`)?.focus();
  }
  // Tap outside it (the room, a hotspot, the bar) closes it, making no decision; so does dragging the room
  document.addEventListener('pointerdown', e => {
    if (!openAtom || hl.contains(e.target) || col.contains(e.target)) return;
    close(false);
  }, true);
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !openAtom) return;
    if (document.querySelector('.tool.open, #book.open')) return;
    e.stopPropagation();
    close('force');
  });

  // After Keep or Not this, focus goes to the next bubble, or to the Book chip if none is left
  function focusNext(i) {
    const bs = [...col.querySelectorAll('.idea')];
    (bs[Math.min(i, bs.length - 1)] || bookChip?.())?.focus({ preventScroll: true });
  }

  function keep(atom, method) {
    const c = entry(atom);
    if (!c) return;
    const from = !hl.hidden && openAtom === atom ? hl.getBoundingClientRect() : col.querySelector(`[data-atom="${CSS.escape(atom)}"]`)?.getBoundingClientRect();
    const idx = [...col.querySelectorAll('.idea')].findIndex(b => b.dataset.atom === atom);
    const hadFocus = hl.contains(document.activeElement);
    remove(atom);
    flyToBook(from);
    onKeep(c, method);
    if (hadFocus) focusNext(idx);
  }

  let undoTimer = null, undoing = null;
  function dismiss(atom, method) {
    const i = state.cards.findIndex(c => c.atom === atom);
    if (i < 0) return;
    const c = state.cards[i];
    const idx = [...col.querySelectorAll('.idea')].findIndex(b => b.dataset.atom === atom);
    const rect = col.querySelector(`[data-atom="${CSS.escape(atom)}"]`)?.getBoundingClientRect();
    const hadFocus = hl.contains(document.activeElement);
    if (openAtom === atom && !reduce() && method !== 'swipe') {          // a swipe has already slid it away
      const r = hl.getBoundingClientRect(), g = hl.cloneNode(true);
      g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;margin:0;bottom:auto;right:auto;pointer-events:none`;
      document.body.appendChild(g);
      g.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-60px)', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
    }
    remove(atom);
    ghost(atom, rect, reduce() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.2)', opacity: 0 }], 200);
    onDismiss(c, method);
    say('Set aside. Undo available.');
    if (hadFocus) focusNext(idx);
    // One undo at a time: a second dismissal settles the first
    settleUndo();
    undoing = { c, at: i, method };
    toast.innerHTML = `<span>Set aside: ${esc(atoms[atom].title)}</span><button>Undo</button>`;
    toast.hidden = false;
    toast.querySelector('button').onclick = () => undo();
    undoTimer = setTimeout(settleUndo, 5000);
  }
  function settleUndo() {
    clearTimeout(undoTimer);
    const was = undoing;
    undoing = null;
    toast.hidden = true;
    if (was) onUndo?.(was.c, { undone: false, method: was.method });
    // An idea that waited for the slot comes in now
    if (was && state.waiting && state.cards.length < MAX_IDEAS) {
      const w = state.waiting;
      state.waiting = null;
      state.cards.unshift(w);
      arriving.set(w.atom, null);
      save();
      render();
    }
  }
  function undo() {
    if (!undoing) return;
    clearTimeout(undoTimer);
    const { c, at, method } = undoing;
    undoing = null;
    toast.hidden = true;
    // If an idea arrived in its place, that one steps aside again (unopened, so it can come back later)
    let bumped = null;
    if (!entry(c.atom)) {
      if (state.cards.length >= MAX_IDEAS) {
        const j = state.cards.findIndex(x => !x.opened);
        bumped = state.cards.splice(j >= 0 ? j : state.cards.length - 1, 1)[0].atom;
      }
      state.cards.splice(Math.min(at, state.cards.length), 0, c);
    }
    save();
    render();
    const b = col.querySelector(`[data-atom="${CSS.escape(c.atom)}"]`);
    if (b && !reduce()) b.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)' }, { transform: 'none', opacity: 1 }], { duration: 350 });
    b?.focus({ preventScroll: true });
    onUndo?.(c, { undone: true, method, bumped });
  }

  /** Take an idea off the column without a decision animation (kept from its book page, cleared, clashed) */
  function remove(atom) {
    if (openAtom === atom) close(false);
    state.cards = state.cards.filter(c => c.atom !== atom);
    if (state.waiting?.atom === atom) state.waiting = null;
    // A waiting idea fills the space
    if (state.waiting && state.cards.length < MAX_IDEAS) { state.cards.unshift(state.waiting); arriving.set(state.waiting.atom, null); state.waiting = null; }
    save();
    render();
  }

  // Keep: the highlight (or bubble) shrinks and flies to the Book chip; the chip bounces once
  function flyToBook(from) {
    const chip = bookChip?.();
    const to = chip?.getBoundingClientRect();
    const bounce = () => { if (chip && !reduce()) chip.animate([{ transform: 'none' }, { transform: 'scale(1.1)' }, { transform: 'none' }], { duration: 300 }); };
    if (!from || !to || reduce()) return bounce();
    const g = document.createElement('div');
    g.className = 'idea-fly';
    g.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`;
    document.body.appendChild(g);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    g.animate([{ transform: 'none', opacity: 0.95 }, { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(0.08, 24 / from.width)})`, opacity: 0.3 }],
              { duration: 300, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.then(() => { g.remove(); bounce(); }, () => g.remove());
  }

  return {
    add, render, remove, open, close, keep, dismiss, undo, place, say,
    get openAtom() { return openAtom; },
    clearAll() { settleUndo(); close(false); state.cards = []; state.waiting = null; save(); render(); },
    el: col, highlight: hl,
  };
}
