// The recipe book, opened (recipe-book-ux.md v4 §5): a two-page spread over the dimmed room on desktop, a full-height
// sheet one page at a time on phones. Pages: This visit (Gemma's notebook, moved in), Contents, then one per kept recipe,
// then Inn notes (notes.js) once one is found: its list, and a page per note in the order found.
// A "loose page" is an idea read but not kept: shown on its own, with "Keep this in my book".
// Escape, ✕ and back close it; ‹ › and the arrow keys turn pages; focus returns to whatever opened it.

import { RIBBONS, metaLine } from './ideas.js';
import { pageSwipe } from './swipe.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesk = () => matchMedia('(min-width: 720px) and (min-height: 501px)').matches;
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const day = t => new Date(t).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });   // "19 Oct"

export function createBookView({ book, basket, onBasket, basketLines = {}, bookLines = {}, atoms, chip, notes, onKeep, onRead, onTakeOut, onClear, track, bucket, themeLine, clashNote, writeOut, onCook, list, actions, extra, innNotes, noteLines }) {
  // actions(rec): a room's own buttons under Cook this ([{ label, do }]), e.g. the Chiapothecary's "Ready by breakfast?"
  // innNotes, noteLines: the found notes' store (notes.js) and their words (gemma-lines.json innNotes)
  // basket, onBasket: the recipe basket (basket.js) and a way to its own sheet (basket-view.js). The book holds only recipes
  // Gemma has written out in full (Nicole, 22 Oct: "My Custom Recipe Book"); bookLines: gemma-lines.json `book`
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
        <h2 id="book-title">${esc(bookLines.title || 'My Custom Recipe Book')}</h2>
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
  [...notes.children].filter(el => !el.classList.contains('panel-title')).forEach(el => visitPage.appendChild(el));
  // "Visitor check" is the builder's (it reports the bot check): only with ?debug
  if (!new URLSearchParams(location.search).has('debug')) {
    const vh = [...visitPage.querySelectorAll('h3, .panel-sub')].find(h => /visitor check/i.test(h.textContent));
    if (vh) { vh.hidden = true; visitPage.querySelector('#visitor')?.setAttribute('hidden', ''); }
  }
  const forget = visitPage.querySelector('#forget');
  if (forget) {
    forget.textContent = 'Forget this visit';
    forget.className = 'bk-outline';
    forget.insertAdjacentHTML('afterend', `<span class="small">The wander, my ideas and what you've told me. Not your book.</span>
      <button class="bk-outline bk-clear2">Clear my book</button><span class="small bk-clearnote"></span>`);
  }
  notes.remove();
  // Off-page, the visit page waits in a hidden stash inside the book, so its ids stay in the document for the page's renderers
  const stash = document.createElement('div');
  stash.hidden = true;
  root.appendChild(stash);
  stash.appendChild(visitPage);

  // The shopping list remembers where it was opened from (Nicole's test, 22 Oct): a recipe's id, 'contents', or null (from
  // outside the book: back leaves the book). It has its own history step, so the back gesture and Escape return there
  let listFrom = null, listTok = null;
  let at = 'visit', loose = null, opener = null, pushed = false, filter = null, undo = null, undoTimer = null, undoSettled = null;
  // A note's page is `note:<object id>`; only notes that still have words are shown
  const noteIds = () => (innNotes && noteLines?.notes ? innNotes.list().filter(id => noteLines.notes[id]) : []);
  const seq = () => { const n = noteIds(); return ['visit', 'contents', ...book.ids(), ...(n.length ? ['notes', ...n.map(id => `note:${id}`)] : [])]; };
  const isOpen = () => !root.hidden;

  // The book's own chip (the basket has its own, basket-view.js): its count is the recipes written out
  const chipName = bookLines.chip_long || 'My recipe book';
  chip.querySelector('.long').textContent = chipName;
  chip.querySelector('.short').textContent = bookLines.chip_short || 'Book';
  function chipCount() {
    const n = book.count, badge = chip.querySelector('.badge');
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
    chip.setAttribute('aria-label', `${chipName}${n ? `, ${n} ${n === 1 ? 'recipe' : 'recipes'}` : ''}`);
  }
  // How the book works: shown on an empty book every time, and once (per device) the first time a visitor opens a book that
  // already has recipes in it (they added them without ever seeing it empty)
  const HOW = [].concat(bookLines.how || ["Tap ♥ Keep on an idea you like. Its leaflet goes in your basket.",
    'Open your basket, tick the ones you want and tap Add recipe to my book. Gemma writes each one out in full, 3 free a day.',
    "They live here, ready to cook step by step, with a shopping list and Save as PDF."]);
  const howHtml = () => `<h4>${esc(bookLines.how_title || 'How your book works')}</h4><ol class="bk-how">${HOW.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
    ${onBasket ? `<p><button class="bk-outline bk-tobasket">${esc(bookLines.to_basket || 'Open my basket')}</button></p>` : ''}`;
  let introShown = false;                                          // the first-use explainer is showing this time the book is open
  const firstUseHtml = () => `<div class="bk-firstuse" role="note"><h4>${esc(bookLines.first_use_title || 'Your recipe book')}</h4>
    <p>${esc(bookLines.first_use || "Every recipe Gemma writes out for you lands here, in full. Cook it step by step, make a shopping list, or save it as a PDF. New ones come from your basket.")}</p>
    <button class="link bk-gotit">${esc(bookLines.got_it || 'Got it')}</button></div>`;

  // ---------- pages
  function recipeLeft(r) {
    const a = r;
    return `<div class="bk-ribbon" style="--ring:${RIBBONS[a.room]?.colour || 'var(--berry)'}">${esc(RIBBONS[a.room]?.name || '')}</div>
      <div class="meta">${metaLine(a, false)}</div>
      <h3 class="bk-title">${esc(a.title)}</h3>
      ${clashNote?.(a) ? `<p class="bk-clash">${esc(clashNote(a))}</p>` : ''}
      <p class="bk-hook">${esc(a.hook || a.body)}</p>
      ${r.why ? `<p class="why">${esc(r.why)}</p>` : ''}
      ${a.seed?.why ? `<p class="bk-seedwhy">${esc(a.seed.why)}</p>` : ''}`;
  }
  function recipeRight(r) {
    const ing = r.key_ingredients || r.seed?.ingredients || [];
    return `<div class="bk-seed">${ing.length ? `<h4>You'll need</h4><ul class="bk-ing">${ing.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      <h4>How</h4><p class="bk-method">${esc(r.method_short || r.body)}</p>
      ${r.seed?.time ? `<p class="small">${esc(r.seed.time)}</p>` : ''}</div>
      <div class="bk-write"></div>
      ${onCook ? '<p><button class="bk-cook">Cook this, step by step</button></p>' : ''}
      ${list && book.has(r.id) ? listRow(r) : ''}
      ${(actions?.(r) || []).map((a, i) => `<p><button class="bk-outline bk-act" data-act-i="${i}">${esc(a.label)}</button></p>`).join('')}
      ${extra?.(r) || ''}`;   // extra(rec): a room's own lines under the buttons (escaped HTML), e.g. Sweet Spells' swap the sugar
  }
  // On a written recipe's page: put it on the shopping list (list.js keeps the pick), and a way to the list once it's on
  function listRow(r) {
    const on = list.has(r.id);
    return `<p class="bk-listrow"><button class="bk-outline bk-addlist" aria-pressed="${on}">${esc(on ? bookLines.on_list || '✓ On my shopping list' : bookLines.add_to_list || 'Add to shopping list')}</button>
      ${on ? `<button class="link bk-seelist">${esc(bookLines.see_list || 'See the list ›')}</button>` : ''}</p>`;
  }
  // Inn notes: the row in Contents, the section's list, and a note's own page (no Keep, Cook or diet: a note isn't a recipe)
  function notesRow() {
    const n = noteIds().length;
    if (!n) return '';
    const count = noteLines.count.replace('{n}', n).replace('{total}', Object.keys(noteLines.notes).length);
    return `<ul class="bk-list bk-notesrow"><li><button data-note="" style="--ring:var(--berry)"><i></i><span>${esc(noteLines.title)}</span><small>${esc(count)}</small></button></li></ul>`;
  }
  function notesPage(current) {
    const ids = noteIds(), total = Object.keys(noteLines.notes).length;
    return `<h3 class="bk-h">${esc(noteLines.title)}</h3><p class="small">${esc(noteLines.intro)}</p>
      ${ids.length ? `<p class="small">${esc(noteLines.count.replace('{n}', ids.length).replace('{total}', total))}</p>
      <ul class="bk-list">${ids.map(id => `<li><button data-note="${esc(id)}" style="--ring:var(--berry)"${id === current ? ' aria-current="page"' : ''}><i></i><span>${esc(noteLines.notes[id].title)}</span></button></li>`).join('')}</ul>`
        : `<p class="small">${esc(noteLines.empty)}</p>`}`;
  }
  function notePage(id, desk) {
    const n = noteLines.notes[id];
    return `<div class="bk-ribbon" style="--ring:var(--berry)">${esc(noteLines.title)}</div>
      <h3 class="bk-title">${esc(n.title)}</h3><p class="bk-note">${esc(n.text)}</p>
      ${desk ? '' : `<p><button class="link" data-note="">All ${esc(noteLines.title)}</button></p>`}`;
  }
  // What "Clear my book" empties: the book, the basket and the Inn notes (PM 4: one way to clear everything). Plain text;
  // basket.clear_note in gemma-lines.json, {notes} = " and your <Inn notes title>" when any are found
  const clearText = () => {
    const t = (basketLines.clear_note || "Every recipe you've kept, your basket{notes}, on this device.")
      .replace('{notes}', noteIds().length ? ` and your ${noteLines.title}` : '');
    return book.lasting ? t : `${t.replace(/\.$/, '')} (this one only lasts the visit: this browser won't keep it).`;
  };
  const clearNote = () => esc(clearText());
  function contentsPage() {
    const kept = book.list();
    if (!kept.length) return `<h3 class="bk-h">Contents</h3><p class="small">${esc(basketLines.book_empty || 'Nothing written out yet. Tick leaflets in your basket and Gemma writes them out in here.')}</p>
      <div class="bk-howbox">${howHtml()}</div>
      ${noteIds().length ? `${notesRow()}<p><button class="bk-outline bk-clear">Clear my book</button> <span class="small">${clearNote()}</span></p>` : ''}`;
    const rooms = [...new Set(kept.map(k => k.room))].filter(r => RIBBONS[r]);
    const shown = filter ? kept.filter(k => k.room === filter) : kept;
    return `<h3 class="bk-h">Contents</h3>
      ${rooms.length > 1 ? `<div class="bk-filter" role="group" aria-label="Show recipes from"><button data-f="" aria-pressed="${!filter}">All</button>${rooms.map(r => `<button data-f="${esc(r)}" aria-pressed="${filter === r}" style="--ring:${RIBBONS[r].colour}"><i></i>${esc(RIBBONS[r].name)}</button>`).join('')}</div>` : ''}
      ${list ? `<p class="small bk-pickhint">${esc(bookLines.list_tick || 'Tick ☐ the recipes you want on your shopping list.')}</p>` : ''}
      <ul class="bk-list">${shown.map(k => `<li${list ? ' class="bk-pick"' : ''}><button data-open="${esc(k.id)}" style="--ring:${RIBBONS[k.room]?.colour || 'var(--berry)'}"><i></i><span>${esc(k.title)}</span><small>${esc(RIBBONS[k.room]?.name || '')} · ${esc(day(k.kept))}</small></button>${list
        ? `<label class="bk-onlist"><input type="checkbox" data-onlist="${esc(k.id)}" ${list.has(k.id) ? 'checked' : ''} aria-label="${esc((bookLines.list_tick_aria || '{title} on my shopping list').replace('{title}', k.title))}"></label>` : ''}</li>`).join('')}</ul>
      ${notesRow()}
      ${list ? `<p><button class="bk-cook bk-need">${esc(bookLines.shopping_list || 'Shopping list')}${list.count ? ` (${list.count})` : ''}</button></p>` : ''}
      <p><button class="bk-outline bk-clear">Clear my book</button> <span class="small">${clearNote()}</span></p>`;
  }
  function theme() {
    const mine = book.keptThisVisit(), line = themeLine?.();
    visitPage.querySelector('.bk-theme').textContent = line ? line : mine.length
      ? `You've kept ${NUM[mine.length] || mine.length} this visit${book.count > mine.length ? `, and there are ${book.count} in your book` : ''}.`
      : book.count ? `There ${book.count === 1 ? 'is one recipe' : `are ${book.count} recipes`} in your book from before.` : '';
  }

  function draw() {
    const desk = isDesk();
    root.classList.toggle('desk', desk);
    const s = seq();
    if (!loose && !s.includes(at) && at !== 'list') at = 'contents';
    const page = loose ? loose.id : at;
    const kept = page !== 'visit' && page !== 'contents' ? book.get(page) : null;
    const rec = kept || (loose && loose.id === page ? loose : null);
    theme();
    visitPage.querySelector('.bk-clearnote')?.replaceChildren(clearText());
    stash.appendChild(visitPage);
    left.replaceChildren(); right.replaceChildren();
    // An idea read from its card isn't in the book yet: its page says so in the header
    $('#book-title').textContent = loose ? (bookLines.loose_title || 'A recipe idea') : (bookLines.title || 'My Custom Recipe Book');
    if (page === 'notes' || page.startsWith('note:')) {            // Inn notes: on desktop the list sits beside a note, Contents beside the list
      const id = page === 'notes' ? null : page.slice(5);
      left.innerHTML = id ? notePage(id, desk) : notesPage();
      right.innerHTML = desk ? (id ? notesPage(id) : contentsPage()) : '';
      right.hidden = !desk;
    } else if (page === 'list' && list) {                           // the shopping list (list.js), with a way back to where it came from
      list.render(left, () => draw());
      const backTo = listFrom && book.has(listFrom) ? (bookLines.back_to_recipe || '‹ Back to the recipe')
        : listFrom ? (bookLines.back_to_contents || '‹ Back to Contents') : (bookLines.back_to_room || '‹ Back');
      left.insertAdjacentHTML('afterbegin', `<p class="bk-listback"><button class="link bk-back">${esc(backTo)}</button></p>`);
      left.querySelector('.bk-back').onclick = () => listBack();
      right.innerHTML = desk ? contentsPage() : '';
      right.hidden = !desk;
    } else if (!rec) {
      if (desk) { left.appendChild(visitPage); right.innerHTML = contentsPage(); }
      else if (page === 'visit') left.appendChild(visitPage);
      else left.innerHTML = contentsPage();
      right.hidden = !desk;
    } else {
      left.innerHTML = recipeLeft(rec) + (desk ? '' : `<hr>${recipeRight(rec)}`);
      right.innerHTML = desk ? recipeRight(rec) : '';
      right.hidden = !desk;
      const slot = root.querySelector('.bk-write');
      if (slot) writeOut?.(slot, rec, root.querySelector('.bk-seed'));   // "Write it out in full" (stage 4)
      root.querySelector('.bk-cook')?.addEventListener('click', () => onCook(rec, kept ? 'book' : 'loose'));   // cook mode
      const acts = actions?.(rec) || [];
      root.querySelectorAll('.bk-act').forEach(b => b.addEventListener('click', () => acts[+b.dataset.actI]?.do(rec)));
    }
    // Footer: Keep on a loose page (into the basket, or the book if it's written), "In your basket" on a leaflet,
    // "Kept · Take it out" on a kept one
    const kb = $('.bk-keepbar');
    const inBasket = rec && !kept && basket.has(rec.id);
    kb.innerHTML = !rec ? '' : kept
      ? `<span>♥ Kept ${esc(day(kept.kept))}</span> · <button class="link" data-act="out">Take it out</button>`
      : inBasket ? `<span>${esc(basketLines.in_basket || 'In your basket')}</span>${onBasket ? ` · <button class="link" data-act="basket">${esc(basketLines.tab || 'Basket')} ›</button>` : ''} · <button class="link" data-act="unbasket">${esc(basketLines.remove_page || 'Take it out')}</button>`
      : `<button class="bk-keep" data-act="keep"><span aria-hidden="true">♥</span> ${esc(basketLines.keep_button || 'Put it in my basket')}</button>`;
    kb.querySelector('[data-act=keep]')?.addEventListener('click', () => { onKeep(rec); if (book.has(rec.id)) { loose = null; at = rec.id; } draw(); });
    kb.querySelector('[data-act=basket]')?.addEventListener('click', () => onBasket?.());
    kb.querySelector('[data-act=unbasket]')?.addEventListener('click', () => {
      const removed = basket.remove(rec.id);
      showUndo(`Taken out: ${rec.title}`, () => { if (removed) basket.restore(removed); draw(); });
      draw();
    });
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
    const cap = desk ? 12 : 8;                                       // phones: few enough that "Contents · This visit" stays on one line at 375 px
    $('.bk-dots').innerHTML = loose || page === 'list' ? '' : Array.from({ length: Math.min(n, cap) }, (_, k) => `<i class="${k === Math.min(pos, cap - 1) ? 'on' : ''}"></i>`).join('');
    const off = loose;                                               // outside the book's order: ‹ › go to Contents
    const atStart = !off && (desk ? i <= 1 : i <= 0), atEnd = !off && i === s.length - 1;
    root.querySelectorAll('.bk-prev, .bk-prev2').forEach(b => { b.disabled = atStart; });
    $('.bk-next').disabled = atEnd;
    $('.bk-count').textContent = book.count ? `${book.count} kept` : '';
    // Contents' buttons
    root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { onRead?.(b.dataset.open); go(b.dataset.open); });
    root.querySelectorAll('[data-note]').forEach(b => b.onclick = () => go(b.dataset.note ? `note:${b.dataset.note}` : 'notes'));
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f || null; draw(); root.querySelector(`[data-f="${filter || ''}"]`)?.focus(); });
    root.querySelectorAll('.bk-clear, .bk-clear2').forEach(b => b.onclick = clearBook);
    root.querySelector('.bk-need')?.addEventListener('click', () => { track?.('list_open'); enterList(loose ? 'contents' : at); });   // not .bk-list: that's Contents' own list of recipes
    root.querySelector('.bk-tobasket')?.addEventListener('click', () => onBasket?.());
    root.querySelectorAll('[data-onlist]').forEach(c => c.onchange = () => {
      list.set(c.dataset.onlist, c.checked, 'contents');
      draw();
      root.querySelector(`[data-onlist="${CSS.escape(c.dataset.onlist)}"]`)?.focus({ preventScroll: true });
    });
    root.querySelector('.bk-addlist')?.addEventListener('click', () => {
      list.set(rec.id, !list.has(rec.id), 'recipe');
      draw();
      root.querySelector('.bk-addlist')?.focus({ preventScroll: true });
    });
    root.querySelector('.bk-seelist')?.addEventListener('click', () => { track?.('list_open'); enterList(at); });
    // The first-use explainer, above whatever page shows first; it goes when they say Got it or close the book
    if (introShown && !loose && book.count) {
      left.insertAdjacentHTML('afterbegin', firstUseHtml());
      left.querySelector('.bk-gotit').onclick = () => { introShown = false; book.introSeen = true; draw(); left.focus({ preventScroll: true }); };
    }
  }
  /** Open the shopping list from `from` (a page of the book, or null from outside it), with its own history step */
  function enterList(from) {
    listFrom = from;
    if (!listTok && pushed) { listTok = Math.random().toString(36).slice(2, 8); history.pushState({ ...(history.state || {}), book: true, bookList: listTok }, ''); }
    go('list', { keepList: true });
  }
  /** Leave the list for where it came from: its history step back does it (popstate below), or straight away if it has none */
  function listBack() {
    if (listTok && history.state?.bookList === listTok) return history.back();
    leaveList();
  }
  function leaveList() {
    listTok = null;
    const to = listFrom;
    listFrom = null;
    if (to === null) return close();
    go(book.has(to) || to === 'visit' ? to : 'contents');
  }
  function go(page, { keepList = false } = {}) {
    // Leaving the list another way (the tabs, ‹ ›): drop its history step quietly
    if (!keepList && at === 'list' && page !== 'list' && listTok) { const t = listTok; listTok = null; listFrom = null; if (history.state?.bookList === t) history.back(); }
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
  pageSwipe(left, d => { if (!isDesk()) turn(d); });   // phones: swipe left or right to turn the page (keep and dismiss never swipe in here)
  root.querySelectorAll('.bk-prev, .bk-prev2').forEach(b => b.onclick = () => turn(-1));
  $('.bk-next').onclick = () => turn(1);
  root.querySelectorAll('.bk-tabs [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('.bk-close').onclick = () => close();
  $('.bk-dim').onclick = () => close();

  function clearBook() {
    const n = book.count, m = noteIds().length, b = basket.count;   // n counts recipes only: the notes and the basket go too, uncounted
    if (!n && !m && !b) return;
    const back = n ? book.clear() : null, backNotes = m ? innNotes.clear() : null, backBasket = b ? basket.clear() : null;
    filter = null;
    // Gemma says so (and it's counted) once the undo has gone by
    showUndo(basketLines.cleared || 'Your book and basket are cleared.', () => { back?.(); backNotes?.(); backBasket?.(); draw(); }, () => onClear?.(n));
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
    const was = isOpen();
    // The list opened from a page of the open book (cook mode's, the jars') goes back to that page; from outside, out of the book
    if (page === 'list' && !loosePage) {
      const back = was ? (loose ? 'contents' : at) : null;
      if (was) return enterList(back);
      listFrom = null;
    }
    loose = loosePage && !book.has(loosePage.id) ? loosePage : null;
    at = loosePage ? loosePage.id : page;
    if (!loose && !seq().includes(at) && at !== 'list') at = book.has(at) ? at : 'visit';
    if (!was && !loose && book.count && !book.introSeen) introShown = true;
    root.hidden = false;
    root.classList.add('open');
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('on');
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.bookInert = '1'; }
    draw();
    if (!was) {
      if (!pushed) { history.pushState({ ...(history.state || {}), book: true }, ''); pushed = true; }
      if (!reduce()) $('.bk-box').animate(isDesk() ? [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
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
    if (introShown) { introShown = false; book.introSeen = true; }  // seen once is enough
    const steps = listTok && history.state?.bookList === listTok ? 2 : 1;   // the list's own step, then the book's
    listTok = null; listFrom = null;
    if (pushed) { pushed = false; if (!viaBack && history.state?.book) history.go(-steps); }
    chip.focus({ preventScroll: true });                           // where the book lives (QA P3-6)
  }
  addEventListener('popstate', () => {
    if (pushed && !history.state?.book) { pushed = false; close(true); return; }
    if (listTok && history.state?.bookList !== listTok && at === 'list') leaveList();   // back from the list: where it came from
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return at === 'list' && !loose ? listBack() : close(); }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea, select')) { e.preventDefault(); turn(e.key === 'ArrowLeft' ? -1 : 1); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button, a[href], [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  addEventListener('resize', () => { if (isOpen()) draw(); });
  book.subscribe(() => { chipCount(); if (isOpen()) draw(); });
  basket.subscribe(() => { if (isOpen()) draw(); });
  innNotes?.subscribe(() => { if (isOpen()) draw(); });
  chip.onclick = () => (isOpen() ? close() : open('contents', { from: 'chip' }));   // an empty book's Contents shows how it works
  chipCount();

  return { open, close, refresh: () => { chipCount(); if (isOpen()) draw(); }, get isOpen() { return isOpen(); }, visitPage };
}
