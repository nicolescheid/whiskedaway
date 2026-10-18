// The recipe book, opened (recipe-book-ux.md v4 §5): a two-page spread over the dimmed room on desktop, a full-height
// sheet one page at a time on phones. Pages: This visit (Gemma's notebook, moved in), Contents, then one per kept recipe.
// A "loose page" is an idea read but not kept: shown on its own, with "Keep this in my book".
// Escape, ✕ and back close it; ‹ › and the arrow keys turn pages; focus returns to whatever opened it.

import { RIBBONS, metaLine } from './ideas.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesk = () => matchMedia('(min-width: 720px) and (min-height: 501px)').matches;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const day = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });

export function createBookView({ book, atoms, chip, notes, onKeep, onTakeOut, onClear, onForget, track, bucket }) {
  const root = document.createElement('div');
  root.id = 'book';
  root.className = 'book';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'book-title');
  root.innerHTML = `<div class="bk-dim"></div>
    <div class="bk-box">
      <header class="bk-head">
        <button class="bk-nav bk-prev" aria-label="Previous page">‹</button>
        <h2 id="book-title">Gemma's recipe book</h2>
        <span class="bk-count" aria-live="off"></span>
        <button class="bk-close" aria-label="Close the book">✕</button>
      </header>
      <div class="bk-spread"><section class="bk-page bk-left" tabindex="-1"></section><section class="bk-page bk-right" tabindex="-1"></section></div>
      <footer class="bk-foot">
        <div class="bk-keepbar"></div>
        <div class="bk-turns"><button class="bk-nav bk-prev2" aria-label="Previous page">‹ <span>prev</span></button>
          <span class="bk-tabs"><button data-go="contents">Contents</button> · <button data-go="visit">This visit</button></span>
          <span class="bk-dots" aria-hidden="true"></span>
          <button class="bk-nav bk-next" aria-label="Next page"><span>next</span> ›</button></div>
        <div class="bk-undo" hidden><span></span><button>Undo</button></div>
      </footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const left = $('.bk-left'), right = $('.bk-right');

  // Gemma's notebook becomes the "This visit" page: its blocks (best guess, visitor check, what you've told me, the wander,
  // forget) move in with their ids, so the page's renderNotes() keeps filling them
  const visitPage = document.createElement('div');
  visitPage.className = 'bk-visit';
  visitPage.innerHTML = `<h3 class="bk-h">This visit</h3><p class="bk-theme"></p>`;
  const privacy = notes.querySelector('p.small');
  [...notes.children].filter(el => el.tagName !== 'H2').forEach(el => visitPage.appendChild(el));
  if (privacy) privacy.textContent = "Your book stays on this device, nowhere else. Clear it any time from Contents. What I've noticed this visit is forgotten when you leave, except a note that you've been welcomed, so I don't say it twice. The inn does count, anonymously, which rooms and recipes get visited, but never who.";
  const forget = visitPage.querySelector('#forget');
  if (forget) {
    forget.textContent = 'Forget this visit';
    forget.insertAdjacentHTML('afterend', `<span class="small"> The wander, my ideas and what you've told me. Not your book.</span>
      <br><button class="link bk-clear2">Clear my book</button><span class="small"> Every recipe you've kept, on this device.</span>`);
  }
  notes.remove();
  // Off-page, the visit page waits in a hidden stash inside the book, so its ids stay in the document for the page's renderers
  const stash = document.createElement('div');
  stash.hidden = true;
  root.appendChild(stash);
  stash.appendChild(visitPage);

  let at = 'visit', loose = null, opener = null, pushed = false, filter = null, undo = null, undoTimer = null, undoSettled = null;
  const seq = () => ['visit', 'contents', ...book.ids()];
  const isOpen = () => !root.hidden;

  function chipCount() {
    const n = book.count, badge = chip.querySelector('.badge');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
    chip.setAttribute('aria-label', `Gemma's recipe book${n ? `, ${n} kept` : ''}`);
  }

  // ---------- pages
  function recipeLeft(r) {
    const a = r;
    return `<div class="bk-ribbon" style="--ring:${RIBBONS[a.room]?.colour || 'var(--berry)'}">${esc(RIBBONS[a.room]?.name || '')}</div>
      <div class="meta">${metaLine(a, false)}</div>
      <h3 class="bk-title">${esc(a.title)}</h3>
      <p class="bk-hook">${esc(a.hook || a.body)}</p>
      ${r.why ? `<p class="why">${esc(r.why)}</p>` : ''}
      ${a.seed?.why ? `<p class="bk-seedwhy">${esc(a.seed.why)}</p>` : ''}`;
  }
  function recipeRight(r) {
    const ing = r.key_ingredients || r.seed?.ingredients || [];
    return `${ing.length ? `<h4>You'll need</h4><ul class="bk-ing">${ing.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      <h4>How</h4><p class="bk-method">${esc(r.method_short || r.body)}</p>
      ${r.seed?.time ? `<p class="small">${esc(r.seed.time)}</p>` : ''}`;
  }
  function contentsPage() {
    const kept = book.list();
    if (!kept.length) return `<h3 class="bk-h">Contents</h3><p class="small">Nothing kept yet. When an idea catches your eye, tap Keep and it comes in here.</p>`;
    const rooms = [...new Set(kept.map(k => k.room))].filter(r => RIBBONS[r]);
    const shown = filter ? kept.filter(k => k.room === filter) : kept;
    return `<h3 class="bk-h">Contents</h3>
      ${rooms.length > 1 ? `<div class="bk-filter" role="group" aria-label="Show recipes from"><button data-f="" aria-pressed="${!filter}">All</button>${rooms.map(r => `<button data-f="${esc(r)}" aria-pressed="${filter === r}" style="--ring:${RIBBONS[r].colour}"><i></i>${esc(RIBBONS[r].name)}</button>`).join('')}</div>` : ''}
      <ul class="bk-list">${shown.map(k => `<li><button data-open="${esc(k.id)}" style="--ring:${RIBBONS[k.room]?.colour || 'var(--berry)'}"><i></i><span>${esc(k.title)}</span><small>${esc(RIBBONS[k.room]?.name || '')} · ${esc(day(k.kept))}</small></button></li>`).join('')}</ul>
      <p><button class="link bk-clear">Clear my book</button> <span class="small">Every recipe you've kept, on this device${book.lasting ? '' : ' (this one only lasts the visit: this browser won\'t keep it)'}.</span></p>`;
  }
  function theme() {
    const mine = book.keptThisVisit();
    visitPage.querySelector('.bk-theme').textContent = mine.length
      ? `You've kept ${NUM[mine.length] || mine.length} this visit${book.count > mine.length ? `, and there are ${book.count} in your book` : ''}.`
      : book.count ? `There ${book.count === 1 ? 'is one recipe' : `are ${book.count} recipes`} in your book from before.` : '';
  }

  function draw() {
    const desk = isDesk();
    root.classList.toggle('desk', desk);
    const s = seq();
    if (!loose && !s.includes(at)) at = 'contents';
    const page = loose ? loose.id : at;
    const kept = page !== 'visit' && page !== 'contents' ? book.get(page) : null;
    const rec = kept || (loose && loose.id === page ? loose : null);
    theme();
    stash.appendChild(visitPage);
    left.replaceChildren(); right.replaceChildren();
    if (!rec) {
      if (desk) { left.appendChild(visitPage); right.innerHTML = contentsPage(); }
      else if (page === 'visit') left.appendChild(visitPage);
      else left.innerHTML = contentsPage();
      right.hidden = !desk;
    } else {
      left.innerHTML = recipeLeft(rec) + (desk ? '' : `<hr>${recipeRight(rec)}`);
      right.innerHTML = desk ? recipeRight(rec) : '';
      right.hidden = !desk;
    }
    // Footer: Keep on a loose page, "Kept · Take it out" on a kept one
    const kb = $('.bk-keepbar');
    kb.innerHTML = !rec ? '' : kept
      ? `<span>♥ Kept ${esc(day(kept.kept))}</span> · <button class="link" data-act="out">Take it out</button>`
      : `<button class="bk-keep" data-act="keep"><span aria-hidden="true">♥</span> Keep this in my book</button>`;
    kb.querySelector('[data-act=keep]')?.addEventListener('click', () => { onKeep(rec); loose = null; at = rec.id; draw(); });
    kb.querySelector('[data-act=out]')?.addEventListener('click', () => {
      const removed = book.remove(kept.id);
      onTakeOut?.(kept);
      showUndo(`Taken out: ${kept.title}`, () => { if (removed) book.restore(removed); at = kept.id; draw(); });
      at = 'contents';
      draw();
    });
    // Turning pages: in the book's order (a loose page sits outside it; ‹ › go to Contents)
    const i = s.indexOf(page), n = desk ? s.length - 1 : s.length;   // on desktop This visit and Contents share a spread
    const pos = desk ? Math.max(0, i - 1) : i;
    $('.bk-dots').innerHTML = loose ? '' : Array.from({ length: Math.min(n, 12) }, (_, k) => `<i class="${k === Math.min(pos, 11) ? 'on' : ''}"></i>`).join('');
    const atStart = !loose && (desk ? i <= 1 : i <= 0), atEnd = !loose && i === s.length - 1;
    root.querySelectorAll('.bk-prev, .bk-prev2').forEach(b => { b.disabled = atStart; });
    $('.bk-next').disabled = atEnd;
    $('.bk-count').textContent = book.count ? `${book.count} kept` : '';
    // Contents' buttons
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => go(b.dataset.open));
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f || null; draw(); root.querySelector(`[data-f="${filter || ''}"]`)?.focus(); });
    root.querySelectorAll('.bk-clear, .bk-clear2').forEach(b => b.onclick = clearBook);
  }
  function go(page) {
    loose = null;
    at = page;
    const flip = left.closest('.bk-spread');
    draw();
    if (!reduce()) flip.animate([{ opacity: 0.2, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' });
    left.scrollTop = right.scrollTop = 0;
    left.focus({ preventScroll: true });
  }
  function turn(d) {
    const s = seq(), desk = isDesk();
    if (loose) return go('contents');
    let i = s.indexOf(at);
    if (desk && i <= 1) i = 1;                                    // This visit + Contents are one spread
    const j = Math.max(desk ? 1 : 0, Math.min(s.length - 1, i + d));
    if (j !== i) go(s[j]);
  }
  root.querySelectorAll('.bk-prev, .bk-prev2').forEach(b => b.onclick = () => turn(-1));
  $('.bk-next').onclick = () => turn(1);
  root.querySelectorAll('.bk-tabs [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('.bk-close').onclick = () => close();
  $('.bk-dim').onclick = () => close();

  function clearBook() {
    const n = book.count;
    if (!n) return;
    const back = book.clear();
    filter = null;
    // Gemma says so (and it's counted) once the undo has gone by
    showUndo('Your book is cleared.', () => { back(); draw(); }, () => onClear?.(n));
    at = 'contents';
    draw();
  }
  function showUndo(text, fn, settled) {
    clearTimeout(undoTimer);
    if (undo) undoSettled?.();
    undoSettled = settled;
    const u = $('.bk-undo');
    u.querySelector('span').textContent = text;
    u.hidden = false;
    undo = fn;
    u.querySelector('button').onclick = () => { const f = undo; undo = null; undoSettled = null; u.hidden = true; clearTimeout(undoTimer); f?.(); };
    undoTimer = setTimeout(() => { undo = null; u.hidden = true; const s = undoSettled; undoSettled = null; s?.(); }, 5000);
  }

  // ---------- open and close
  /** Open at a page: 'visit', 'contents', a kept recipe's id, or a loose page { ...snapshot } */
  function open(page = 'visit', { from = 'chip', loosePage = null } = {}) {
    opener = document.activeElement;
    loose = loosePage && !book.has(loosePage.id) ? loosePage : null;
    at = loosePage ? loosePage.id : page;
    if (!loose && !seq().includes(at)) at = book.has(at) ? at : 'visit';
    const was = isOpen();
    root.hidden = false;
    root.classList.add('open');
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('on');
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.bookInert = '1'; }
    draw();
    if (!was) {
      if (!pushed) { history.pushState({ ...(history.state || {}), book: true }, ''); pushed = true; }
      if (!reduce()) $('.bk-box').animate(isDesk() ? [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }]
        : [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'ease-out' });
      track?.('book_open', { from, book_size: bucket(book.count) });
    }
    (loose || at !== 'visit' ? left : $('.bk-close')).focus({ preventScroll: true });
  }
  function close(viaBack = false) {
    if (!isOpen()) return;
    root.hidden = true;
    root.classList.remove('open');
    chip.setAttribute('aria-expanded', 'false');
    chip.classList.remove('on');
    for (const el of document.body.children) if (el.dataset.bookInert) { el.inert = false; delete el.dataset.bookInert; }
    loose = null;
    if (pushed) { pushed = false; if (!viaBack && history.state?.book) history.back(); }
    (opener?.isConnected && !opener.closest('#book') ? opener : chip).focus({ preventScroll: true });
  }
  addEventListener('popstate', () => { if (pushed && !history.state?.book) { pushed = false; close(true); } });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea, select')) { e.preventDefault(); turn(e.key === 'ArrowLeft' ? -1 : 1); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button, a[href], [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  addEventListener('resize', () => { if (isOpen()) draw(); });
  book.subscribe(() => { chipCount(); if (isOpen()) draw(); });
  chip.onclick = () => (isOpen() ? close() : open('visit', { from: 'chip' }));
  chipCount();

  return { open, close, refresh: () => { chipCount(); if (isOpen()) draw(); }, get isOpen() { return isOpen(); }, visitPage };
}
