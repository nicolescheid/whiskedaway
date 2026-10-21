// The shopping list, was "What do I need?" (cook-mode-ux.md §2): one shopping list from the recipes in the book. Same ingredient on one line (by the
// write-out's `key`, else its singular name), amounts added when the units match, "1 cup + 200 g" when they don't; recipes without a
// write-out add their key ingredients with no amount. What's in the pantry (Tell Gemma) moves to "You've got these".
// Ticks and the recipes left out are kept in the book's storage (book.listState). Share uses the phone's share sheet, or copies.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const singular = w => w.replace(/ies$/, 'y').replace(/(oes|ches|shes|xes)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const keyOf = i => (i.key || singular(String(i.item || '').toLowerCase().trim())).toLowerCase();
/** "1", "1/2", "1 1/2", "1.5" → a number, or NaN */
export function qty(a) {
  const s = String(a ?? '').trim();
  if (!s) return NaN;
  const m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return +m[1] + m[2] / m[3];
  const f = s.match(/^(\d+)\/(\d+)$/);
  if (f) return f[1] / f[2];
  return /^\d+(\.\d+)?$/.test(s) ? +s : NaN;
}
/** A write-out's ingredients for another number of people (the check-in's "cooking for"): counted and measured amounts scale,
 *  "a pinch" and words ("to taste") stay. Whole things round to a half, spoons and cups to a quarter, grams and millilitres to 5. */
export function scaleItems(items, factor) {
  if (!factor || Math.abs(factor - 1) < 0.01) return items;
  return items.map(i => {
    const n = qty(i.amount), unit = (i.unit || '').trim().toLowerCase();
    if (Number.isNaN(n) || unit === 'pinch') return i;
    const x = n * factor;
    const step = !unit ? 0.5 : /^(g|ml)$/.test(unit) ? (x >= 20 ? 5 : 1) : /^(kg|l)$/.test(unit) ? 0.05 : 0.25;
    return { ...i, amount: showQty(Math.max(step, Math.round(x / step) * step)) };
  });
}
const showQty = n => (Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString());

/** Merge ingredient lines: [{item, amount, unit, key}] from several recipes → [{key, item, amounts: ["4", "1 cup + 200 g"]}] */
export function mergeItems(lists) {
  const by = new Map();
  for (const list of lists) for (const i of list) {
    const k = keyOf(i);
    if (!k) continue;
    const e = by.get(k) || { key: k, item: i.item, parts: [] };
    if (i.amount) {
      const unit = (i.unit || '').trim(), n = qty(i.amount);
      const same = e.parts.find(p => p.unit === unit && !Number.isNaN(p.n) && !Number.isNaN(n));
      if (same) same.n += n;
      else e.parts.push({ n, raw: i.amount, unit });
    }
    by.set(k, e);
  }
  return [...by.values()].map(e => ({ key: e.key, item: e.item,
    amount: e.parts.map(p => `${Number.isNaN(p.n) ? p.raw : showQty(p.n)}${p.unit ? ` ${p.unit}` : ''}`).join(' + ') }));
}

export function createList({ title, book, written, pantry, synonyms = () => ({}), servings = () => null, track }) {
  const state = () => ({ off: [], ticks: [], back: [], ...(book.listState || {}) });
  const setState = s => { book.listState = s; };
  const has = (k, words) => words.some(w => k.includes(w) || w.includes(k));
  const inPantry = key => {
    const words = pantry().map(p => singular(String(p).toLowerCase()));
    const syn = synonyms();
    const all = words.flatMap(w => [w, ...(syn[w] || []).map(x => singular(x.toLowerCase()))]);
    return has(key, all);
  };
  /** The list as it stands: { recipes, need, got } */
  function build() {
    const s = state(), kept = book.list();
    const on = kept.filter(k => !s.off.includes(k.id));
    const lists = on.map(k => {
      const full = written(k.id) || k.full, n = servings();
      // Written for another number (2 before the check-in): scale by servings ÷ serves
      return full?.ingredients?.length ? scaleItems(full.ingredients, n && full.serves ? n / full.serves : 1)
        : (k.key_ingredients || k.seed?.ingredients || []).map(item => ({ item }));
    });
    const items = mergeItems(lists);
    const got = items.filter(i => inPantry(i.key) && !s.back.includes(i.key));
    return { kept, s, need: items.filter(i => !got.includes(i)), got };
  }
  const line = i => `${i.amount ? `${i.amount} ` : ''}${i.item}`;
  function text() {
    const { need } = build();
    return `What I need:\n${need.map(i => `- ${line(i)}`).join('\n')}`;
  }
  /** Draw the list into a book page */
  function render(el, rerender) {
    const { kept, s, need, got } = build();
    if (!kept.length) { el.innerHTML = `<h3 class="bk-h">${esc(title || 'Shopping list')}</h3><p class="small">Keep a recipe or two first, and I'll make you a list.</p>`; return; }
    el.innerHTML = `<h3 class="bk-h">${esc(title || 'Shopping list')}</h3>${servings() ? `<p class="small ls-for">Amounts for ${servings()}.</p>` : ''}
      <div class="ls-from" role="group" aria-label="From">${kept.map(k => `<button data-r="${esc(k.id)}" aria-pressed="${!s.off.includes(k.id)}">${esc(k.short || k.title)}</button>`).join('')}</div>
      <ul class="ls-need">${need.map(i => `<li><label><input type="checkbox" data-k="${esc(i.key)}" ${s.ticks.includes(i.key) ? 'checked' : ''}><span>${esc(line(i))}</span></label></li>`).join('') || '<li class="small">Nothing to buy.</li>'}</ul>
      ${got.length ? `<details class="ls-got"><summary>You've got these (${got.length})</summary><p>${got.map(i => `<button data-back="${esc(i.key)}">${esc(i.item)}</button>`).join(' ')}</p></details>` : ''}
      <p class="ls-acts"><button class="bk-cook ls-share">Share list</button> <button class="bk-outline ls-clear">Clear ticks</button></p>
      <p class="small ls-copied" hidden>Copied. Paste it wherever you keep your list.</p>`;
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const st = state(), id = b.dataset.r;
      st.off = st.off.includes(id) ? st.off.filter(x => x !== id) : [...st.off, id];
      setState(st); rerender();
    });
    el.querySelectorAll('[data-k]').forEach(c => c.onchange = () => {
      const st = state(), k = c.dataset.k;
      st.ticks = c.checked ? [...new Set([...st.ticks, k])] : st.ticks.filter(x => x !== k);
      setState(st);
    });
    el.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { const st = state(); st.back = [...new Set([...st.back, b.dataset.back])]; setState(st); rerender(); });
    el.querySelector('.ls-clear').onclick = () => { const st = state(); st.ticks = []; setState(st); rerender(); };
    el.querySelector('.ls-share').onclick = async () => {
      track?.('list_share');
      const t = text();
      try {
        if (navigator.share) return await navigator.share({ title: 'What I need', text: t });
        await navigator.clipboard.writeText(t);
        el.querySelector('.ls-copied').hidden = false;
      } catch { /* the visitor closed the share sheet */ }
    };
  }
  return { render, text, build };
}
