// The basket's checkout (Stage 1, docs/basket-stage1-design.md): the book's Basket page. The visitor ticks the leaflets Gemma
// writes out in full into the book, as many as today's allowance has left (writeout.js, 3 a day on this device). She writes
// them one at a time; a failure stays in the basket and doesn't count. Leaflets not written stay for another day.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createCheckout({ basket, writer, ribbons, lines = {}, track, bucket, onRead, onOpenBook, onWriteStart, onWriteEnd, onBatchDone }) {
  const L = {
    title: lines.title || 'Your basket',
    intro: lines.intro || "Tick the ones you'd like me to write out in full. They go into your book for good.",
    empty: lines.empty || 'Nothing in your basket yet. When an idea catches your eye, tap ♥ Keep and its leaflet comes in here.',
    free: lines.free || '{n} free today',
    freeOne: lines.free_one || 'One free today',
    none: lines.none || "That's my three for today. Your leaflets wait here, and I'll write more tomorrow.",
    full: lines.pick_full || "That's as many as I can write today.",
    write: lines.write_button || 'Write out {n}',
    writeOne: lines.write_one || 'Write it out',
    writing: lines.writing || 'Writing…',
    written: lines.written || 'Written into your book',
    failed: lines.failed || "That one didn't take. It's still in your basket. Try again in a bit.",
    openBook: lines.open_book || 'Open my book',
    read: lines.read || 'Read ›',
    remove: lines.remove || 'Take out',
  };
  const ticked = new Set();
  const status = new Map();          // id → 'queued' | 'writing' | 'failed'
  let done = [];                     // this checkout's written ones: { id, title }
  let running = false, redraw = () => {};

  const left = () => writer.left;
  const allowanceLine = () => (left() > 1 ? L.free.replace('{n}', left()) : left() === 1 ? L.freeOne : L.none);
  // Never more ticks than she can write today
  const trim = () => { while (ticked.size > left()) ticked.delete([...ticked].pop()); };

  function render(el, draw) {
    redraw = draw || redraw;
    for (const id of [...ticked]) if (!basket.has(id)) ticked.delete(id);
    if (!running) trim();
    const items = basket.list(), n = ticked.size;
    const row = x => {
      const st = status.get(x.id), r = ribbons[x.room];
      return `<li class="bs-leaf${st ? ` is-${st}` : ''}" style="--ring:${r?.colour || 'var(--berry)'}">
        <label><input type="checkbox" data-tick="${esc(x.id)}" ${ticked.has(x.id) ? 'checked' : ''}
          ${running || (!ticked.has(x.id) && n >= left()) ? 'disabled' : ''}><i></i>
          <span><b>${esc(x.title)}</b><small>${esc(r?.name || '')}</small></span></label>
        ${st === 'writing' ? `<span class="bs-st" role="status">${esc(L.writing)} <span class="dots" aria-hidden="true">• • •</span></span>`
          : st === 'failed' ? `<span class="bs-st bs-fail" role="status">${esc(L.failed)}</span>` : ''}
        <span class="bs-acts"><button class="link" data-read="${esc(x.id)}">${esc(L.read)}</button>
          ${running ? '' : `<button class="link" data-out="${esc(x.id)}" aria-label="${esc(L.remove)}: ${esc(x.title)}">✕</button>`}</span></li>`;
    };
    el.innerHTML = `<h3 class="bk-h">${esc(L.title)}</h3>
      <p class="bs-allow"><b>${esc(allowanceLine())}</b></p>
      ${items.length ? `${left() ? `<p class="small">${esc(L.intro)}</p>` : ''}<div class="bs-diet"></div><ul class="bs-list">${items.map(row).join('')}</ul>
        ${left() && n >= left() && !running ? `<p class="small">${esc(L.full)}</p>` : ''}
        ${left() ? `<p><button class="tl-done bs-write" ${!n || running ? 'disabled' : ''}>${esc(n === 1 ? L.writeOne : L.write.replace('{n}', n || ''))}</button></p>` : ''}`
        : `<p class="small">${esc(L.empty)}</p>`}
      ${done.length ? `<h4>${esc(L.written)}</h4><ul class="bs-done">${done.map(d => `<li>✓ <button class="link" data-book="${esc(d.id)}">${esc(d.title)}</button></li>`).join('')}</ul>` : ''}
      <p><button class="bk-outline bs-book">${esc(L.openBook)}</button></p>`;
    if (!running) writer.dietAsk(el.querySelector('.bs-diet') || document.createElement('div'));
    el.querySelectorAll('[data-tick]').forEach(b => b.onchange = () => {
      if (b.checked) ticked.add(b.dataset.tick); else ticked.delete(b.dataset.tick);
      status.delete(b.dataset.tick);
      const focus = b.dataset.tick;
      render(el);
      el.querySelector(`[data-tick="${CSS.escape(focus)}"]`)?.focus();
    });
    el.querySelectorAll('[data-read]').forEach(b => b.onclick = () => onRead(basket.get(b.dataset.read)));
    el.querySelectorAll('[data-out]').forEach(b => b.onclick = () => { ticked.delete(b.dataset.out); status.delete(b.dataset.out); basket.remove(b.dataset.out); });
    el.querySelectorAll('[data-book]').forEach(b => b.onclick = () => onOpenBook(b.dataset.book));
    el.querySelector('.bs-book').onclick = () => onOpenBook(done[0]?.id || null);
    el.querySelector('.bs-write')?.addEventListener('click', () => write());
  }

  async function write() {
    if (running || !ticked.size) return;
    running = true;
    const ids = [...ticked];
    ids.forEach(id => status.set(id, 'queued'));
    let count = 0, failed = 0;
    for (const id of ids) {
      const rec = basket.get(id);
      if (!rec || !left()) { status.delete(id); continue; }
      status.set(id, 'writing'); redraw();
      onWriteStart?.(rec);
      const full = await writer.writeNow(rec, 'checkout');      // writeout.js: the pass wait, the genie; onWritten moves it to the book
      onWriteEnd?.(rec, full);
      if (full) { count++; status.delete(id); ticked.delete(id); done.push({ id, title: rec.title }); }
      else { failed++; status.set(id, 'failed'); }
    }
    running = false;
    track?.('checkout_written', { count: String(count), failed: String(failed), remaining: bucket(left()) });
    redraw();
    onBatchDone?.({ count, failed, first: done[0]?.id || null });
  }

  return {
    render,
    /** Called as the Basket page opens: tick one (a centrepiece's or the star chart's idea), and start a fresh list of written ones */
    opened(tick) {
      if (!running) { done = []; status.clear(); }
      if (tick && basket.has(tick) && !running) { ticked.add(tick); trim(); if (!ticked.has(tick) && left()) { ticked.clear(); ticked.add(tick); } }
    },
    get running() { return running; },
    get left() { return left(); },
    allowanceLine,
  };
}
