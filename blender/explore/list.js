// The shopping list (cook-mode-ux.md §2; multi-recipe list, Nicole 22 Oct): one list from the written recipes the visitor picks
// (ticks on Contents, "Add to shopping list" on a recipe page; the pick stays on the device, book.listState.on).
// Same ingredient on one line with the total: units are normalised where that's honest (g/kg, ml/l, tsp/tbsp/cup), and a
// line stays apart when it can't be summed ("2 onions" and "1 cup chopped onion"). "Both" amounts ("200 g (1 1/2 cups)") sum
// the metric part and keep the cups in brackets only when every part had them. What's in the pantry (Tell Gemma) moves to
// "You've got these". Ticks stay on the device; Copy, Share and Print take only what's left to buy.

import { printSheet } from './writeout.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const singular = w => w.replace(/ies$/, 'y').replace(/(oes|ches|shes|xes)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const keyOf = i => (i.key || singular(String(i.item || '').toLowerCase().trim())).toLowerCase();
const VULGAR = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
/** "1", "1/2", "1 1/2", "1.5", "1½" → a number, or NaN */
export function qty(a) {
  const s = String(a ?? '').trim().replace(/(\d*)\s*([½¼¾⅓⅔⅛])/g, (m, d, f) => String((+d || 0) + VULGAR[f]));
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

// Units that can be added together: a family and its size in the family's base (grams, millilitres, teaspoons)
const UNITS = {
  g: ['g', 1], gram: ['g', 1], kg: ['g', 1000], kilogram: ['g', 1000],
  ml: ['ml', 1], millilitre: ['ml', 1], milliliter: ['ml', 1], l: ['ml', 1000], litre: ['ml', 1000], liter: ['ml', 1000],
  tsp: ['spoon', 1], teaspoon: ['spoon', 1], tbsp: ['spoon', 3], tablespoon: ['spoon', 3], cup: ['spoon', 48],
};
const SPOONS = [['cup', 48], ['tbsp', 3], ['tsp', 1]];
const unitOf = u => {
  const w = String(u || '').trim().toLowerCase().replace(/\.$/, '');
  if (!w) return { fam: 'count', size: 1, word: '' };
  const s = w === 'tbsps' || w === 'tsps' ? w.slice(0, -1) : singular(w);
  return UNITS[s] ? { fam: UNITS[s][0], size: UNITS[s][1], word: s } : { fam: `u:${s}`, size: 1, word: s };
};
/** One measure: "200 g", or an amount and a unit → { n (in the family's base), fam, word } or null */
function measure(amount, unit) {
  const a = String(amount || '').trim();
  if (!unit) {
    const m = a.match(/^([\d\s./½¼¾⅓⅔⅛]*[\d½¼¾⅓⅔⅛])\s*([a-zA-Z]+\.?)$/);
    if (m) { const n = qty(m[1]), u = unitOf(m[2]); return Number.isNaN(n) ? null : { n: n * u.size, fam: u.fam, word: u.word }; }
  }
  const n = qty(a), u = unitOf(unit);
  return Number.isNaN(n) ? null : { n: n * u.size, fam: u.fam, word: u.word };
}
/** An ingredient's amount: { main, alt } (alt: the bracketed half of a "Both" amount), or { raw } when it isn't a number */
export function parseAmount(amount, unit) {
  const a = String(amount || '').trim();
  const both = !String(unit || '').trim() && a.match(/^(.+?)\s*\((.+)\)$/);
  if (both) { const main = measure(both[1]), alt = measure(both[2]); if (main) return { main, alt }; }
  const main = measure(a, unit);
  return main ? { main, alt: null } : { raw: a };
}

// Showing a total: fractions where cooks write them ("1 1/2 cups"), decimals for kg and litres
const FRACS = [[1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']];
// Cups come in thirds and quarters; spoons in halves and quarters
const clean = (v, thirds = true) => { const f = v - Math.floor(v); return f < 0.02 || f > 0.98 || FRACS.some(([x]) => (thirds || x * 4 % 1 === 0) && Math.abs(f - x) < 0.02); };
function frac(v) {
  let w = Math.floor(v), f = v - w;
  if (f > 0.98) { w += 1; f = 0; }
  const hit = f >= 0.02 && FRACS.find(([x]) => Math.abs(f - x) < 0.02);
  if (f < 0.02) return String(w);
  if (hit) return w ? `${w} ${hit[1]}` : hit[1];
  return showQty(v);
}
const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);
const plural = (word, v) => (!word || v <= 1 || /s$/.test(word) || ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp'].includes(word) ? word
  : /(ch|sh|x)$/.test(word) ? `${word}es` : `${word}s`);
/** A total in its family's base → "450 g", "1.2 kg", "1 1/2 cups", "2" */
export function showAmount(n, fam, words = []) {
  if (fam === 'g' || fam === 'ml') {
    const big = fam === 'g' ? 'kg' : 'l';
    if (n >= 1000) return `${showQty(Math.round(n / 10) / 100)} ${big}`;
    return `${showQty(roundTo(n, n >= 20 ? 5 : 1))} ${fam}`;
  }
  if (fam === 'spoon') {
    // The biggest spoon or cup the recipes used, or a smaller one if that gives a cleaner number (6 tsp → 2 tbsp)
    const used = SPOONS.filter(([w]) => words.includes(w));
    const top = used[0] || ['tsp', 1];
    const pick = SPOONS.filter(([, s]) => s <= top[1]).find(([w, s]) => n / s >= (w === 'cup' ? 0.25 : 1) && clean(n / s, w === 'cup'));
    const v = pick ? n / pick[1] : roundTo(n / top[1], 0.25);
    if (!pick) return `${frac(v)} ${plural(top[0], v)}`;
    return `${frac(v)} ${plural(pick[0], v)}`;
  }
  const v = roundTo(n, fam === 'count' ? 0.5 : 0.25);
  return `${frac(v)}${words[0] ? ` ${plural(words[0], v)}` : ''}`;
}

/** Merge several recipes' ingredients into lines. recipes: [{ id, name, items: [{item, amount, unit, key}], factor }]
 *  → [{ id, key, item, amount, from: [recipe ids] }]. One line per ingredient and kind of measure; amounts that aren't numbers
 *  ("to taste") join a measured line of the same ingredient, or show in brackets on their own. */
export function combine(recipes, words = t => t) {
  const lines = new Map(), order = [];
  for (const r of recipes) for (const i of r.items) {
    const key = words(keyOf(i));
    if (!key) continue;
    const p = parseAmount(i.amount, i.unit), f = r.factor || 1;
    const fam = p.main ? p.main.fam : 'raw';
    const id = `${key}|${fam}`;
    let e = lines.get(id);
    if (!e) { e = { id, key, fam, item: words(i.item), n: 0, words: [], alt: null, altOk: true, from: [], raws: [] }; lines.set(id, e); order.push(e); }
    if (!e.from.includes(r.id)) e.from.push(r.id);
    if (!p.main) { if (p.raw && !e.raws.includes(p.raw)) e.raws.push(p.raw); continue; }
    e.n += p.main.n * f;
    if (!e.words.includes(p.main.word)) e.words.push(p.main.word);
    // The bracketed half sums only if every part had one, in the same family
    if (!p.alt || (e.alt && e.alt.fam !== p.alt.fam)) e.altOk = false;
    else if (e.altOk) { e.alt = e.alt || { n: 0, fam: p.alt.fam, words: [] }; e.alt.n += p.alt.n * f; if (!e.alt.words.includes(p.alt.word)) e.alt.words.push(p.alt.word); }
  }
  // "Salt, to taste" next to "1 tsp salt": one line, for both recipes
  for (const e of order) if (e.fam === 'raw') {
    const measured = order.find(x => x.key === e.key && x.fam !== 'raw');
    if (measured) { e.gone = true; for (const r of e.from) if (!measured.from.includes(r)) measured.from.push(r); }
  }
  return order.filter(e => !e.gone).map(e => ({
    id: e.id, key: e.key, item: e.item, from: e.from,
    amount: e.fam === 'raw' ? '' : `${showAmount(e.n, e.fam, e.words)}${e.altOk && e.alt ? ` (${showAmount(e.alt.n, e.alt.fam, e.alt.words)})` : ''}`,
    note: e.fam === 'raw' && e.raws.length === 1 ? e.raws[0] : '',
  }));
}
/** The old merge (kept for anything still calling it): [{item, amount, unit, key}] lists → [{key, item, amount}] */
export const mergeItems = lists => combine(lists.map((items, i) => ({ id: String(i), items })));

const count = n => (n <= 1 ? String(n) : n <= 3 ? '2-3' : '4+');

export function createList({ title, lines: L = {}, book, written, pantry, synonyms = () => ({}), servings = () => null, words = t => t, track }) {
  // The pick: `on` (ids). Older lists kept `off` (every recipe on unless left out): they carry on as they were
  const state = () => {
    const s = { off: [], ticks: [], back: [], ...(book.listState || {}) };
    if (!Array.isArray(s.on)) s.on = book.listState ? book.ids().filter(id => !s.off.includes(id)) : [];
    return s;
  };
  const setState = s => { book.listState = s; };
  const has = (k, ws) => ws.some(w => k.includes(w) || w.includes(k));
  const inPantry = key => {
    const ws = pantry().map(p => singular(String(p).toLowerCase()));
    const syn = synonyms();
    const all = ws.flatMap(w => [w, ...(syn[w] || []).map(x => singular(x.toLowerCase()))]);
    return has(key, all);
  };
  const t = (k, d) => L[k] || d;
  const onList = id => state().on.includes(id) && book.has(id);
  /** Put a recipe on the list or take it off; from: contents, recipe, list, cook, jars */
  function set(id, yes, from) {
    const s = state();
    if (yes === s.on.includes(id)) return;
    s.on = yes ? [...s.on, id] : s.on.filter(x => x !== id);
    setState(s);
    if (yes) track?.('list_build', { from, count: count(s.on.filter(x => book.has(x)).length) });
  }
  const name = k => k.short || k.title;
  /** The list as it stands: { kept, on, s, need, got } */
  function build() {
    const s = state(), kept = book.list();
    const on = kept.filter(k => s.on.includes(k.id));
    const n = servings();
    const recipes = on.map(k => {
      const full = written(k.id) || k.full;
      // Written for another number (2 before the check-in): scale by servings ÷ serves
      return full?.ingredients?.length ? { id: k.id, items: full.ingredients, factor: n && full.serves ? n / full.serves : 1 }
        : { id: k.id, items: (k.key_ingredients || k.seed?.ingredients || []).map(item => ({ item })) };
    });
    const items = combine(recipes, words);
    const got = items.filter(i => inPantry(i.key) && !s.back.includes(i.key));
    return { kept, on, s, need: items.filter(i => !got.includes(i)), got };
  }
  const line = i => `${i.amount ? `${i.amount} ` : ''}${i.item}${i.note ? ` (${i.note})` : ''}`;
  /** Groups: what more than one recipe needs, then each recipe's own (one group, no heading, for a single recipe) */
  function groups(on, need) {
    if (on.length < 2) return [{ head: '', items: need }];
    const shared = need.filter(i => i.from.length > 1);
    return [{ head: t('list_shared', 'For more than one recipe'), items: shared, shared: true },
      ...on.map(k => ({ head: t('list_group', 'For {recipe}').replace('{recipe}', name(k)), items: need.filter(i => i.from.length === 1 && i.from[0] === k.id) }))]
      .filter(g => g.items.length);
  }
  const fromNames = (i, on) => on.filter(k => i.from.includes(k.id)).map(name).join(', ');
  /** What goes out (Copy, Share, Print): only what's left to buy, with a header and the recipes' names */
  function takeaway() {
    const { on, s, need } = build();
    const left = need.filter(i => !s.ticks.includes(i.id));
    return { on, left, gs: groups(on, left), head: t('list_header', 'WhiskedAway shopping list'),
      forLine: t('list_for', 'For: {recipes}').replace('{recipes}', on.map(name).join(', ')),
      amounts: servings() ? t('list_amounts', 'Amounts for {n}.').replace('{n}', servings()) : '' };
  }
  function text() {
    const { on, left, gs, head, forLine, amounts } = takeaway();
    const out = [head, forLine, ...(amounts ? [amounts] : []), ''];
    if (!left.length) out.push(t('list_nothing', 'Nothing left to buy.'));
    for (const g of gs) {
      if (g.head) out.push(g.head);
      for (const i of g.items) out.push(`- ${line(i)}${g.shared ? ` (${fromNames(i, on)})` : ''}`);
      if (g.head) out.push('');
    }
    return out.join('\n').trim();
  }
  function print() {
    const { on, left, gs, head, forLine, amounts } = takeaway();
    printSheet(`<h1>${esc(head)}</h1><p class="ps-hook">${esc(forLine)}${amounts ? ` ${esc(amounts)}` : ''}</p>
      ${left.length ? '' : `<p>${esc(t('list_nothing', 'Nothing left to buy.'))}</p>`}
      ${gs.map(g => `${g.head ? `<h2>${esc(g.head)}</h2>` : ''}<ul class="ps-list">${g.items.map(i => `<li>☐ ${esc(line(i))}${g.shared ? ` <small>(${esc(fromNames(i, on))})</small>` : ''}</li>`).join('')}</ul>`).join('')}
      <p class="ps-foot">${esc(t('list_foot', 'Made at the WhiskedAway Inn · whiskedaway.com'))}</p>`);
  }
  async function copy(el) {
    const txt = text();
    try { await navigator.clipboard.writeText(txt); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      ta.remove();
    }
    const note = el.querySelector('.ls-copied');
    if (note) { note.hidden = false; note.textContent = t('list_copied', 'Copied. Paste it wherever you keep your list.'); }
  }
  /** Draw the list into a book page */
  function render(el, rerender) {
    const { kept, on, s, need, got } = build();
    const h = `<h3 class="bk-h">${esc(title || 'Shopping list')}</h3>`;
    if (!kept.length) { el.innerHTML = `${h}<p class="small">${esc(t('list_empty', "Once Gemma has written out a recipe or two, I'll make you a list."))}</p>`; return; }
    const from = `<p class="small ls-pick">${esc(t('list_pick', 'Which recipes are you shopping for?'))}</p>
      <div class="ls-from" role="group" aria-label="${esc(t('list_pick', 'Which recipes are you shopping for?'))}">${kept.map(k => `<button data-r="${esc(k.id)}" aria-pressed="${on.includes(k)}">${esc(name(k))}</button>`).join('')}</div>`;
    if (!on.length) {
      el.innerHTML = `${h}${from}<p class="small ls-none">${esc(t('list_none', 'Tick a recipe above, or on Contents, and its ingredients come onto your list.'))}</p>`;
    } else {
      const lineHtml = (i, shared) => `<li><label><input type="checkbox" data-k="${esc(i.id)}" ${s.ticks.includes(i.id) ? 'checked' : ''}><span><span class="ls-t">${esc(line(i))}</span>${shared ? `<small class="ls-why">${esc(fromNames(i, on))}</small>` : ''}</span></label></li>`;
      const gs = groups(on, need);
      const left = need.filter(i => !s.ticks.includes(i.id)).length;
      el.innerHTML = `${h}${from}${servings() ? `<p class="small ls-for">${esc(t('list_amounts', 'Amounts for {n}.').replace('{n}', servings()))}</p>` : ''}
        ${need.length ? gs.map(g => `${g.head ? `<h4 class="ls-group">${esc(g.head)}</h4>` : ''}<ul class="ls-need">${g.items.map(i => lineHtml(i, g.shared)).join('')}</ul>`).join('')
          : `<ul class="ls-need"><li class="small">${esc(t('list_nothing', 'Nothing left to buy.'))}</li></ul>`}
        ${got.length ? `<details class="ls-got"><summary>${esc(t('list_got', "You've got these ({n})").replace('{n}', got.length))}</summary><p>${got.map(i => `<button data-back="${esc(i.key)}">${esc(i.item)}</button>`).join(' ')}</p></details>` : ''}
        <p class="small ls-hint">${esc(t('list_tick_hint', "Tick what you've already got. The rest goes out with Copy, Share or Print."))}</p>
        <p class="ls-acts"><button class="bk-cook ls-copy"${left ? '' : ' disabled'}>${esc(t('list_copy', 'Copy'))}</button>
          <button class="bk-outline ls-share"${left ? '' : ' disabled'}>${esc(t('list_share', 'Share'))}</button>
          <button class="bk-outline ls-print"${left ? '' : ' disabled'}>${esc(t('list_print', 'Print / Save as PDF'))}</button>
          <button class="link ls-clear">${esc(t('list_clear', 'Clear ticks'))}</button></p>
        <p class="small ls-copied" role="status" hidden></p>`;
    }
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      set(b.dataset.r, b.getAttribute('aria-pressed') !== 'true', 'list');
      rerender();
      el.querySelector(`[data-r="${CSS.escape(b.dataset.r)}"]`)?.focus({ preventScroll: true });
    });
    el.querySelectorAll('[data-k]').forEach(c => c.onchange = () => {
      const st = state(), k = c.dataset.k;
      st.ticks = c.checked ? [...new Set([...st.ticks, k])] : st.ticks.filter(x => x !== k);
      setState(st);
      // Copy, Share and Print need something left to buy
      const left = build().need.some(i => !st.ticks.includes(i.id));
      el.querySelectorAll('.ls-copy, .ls-share, .ls-print').forEach(b => { b.disabled = !left; });
    });
    el.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { const st = state(); st.back = [...new Set([...st.back, b.dataset.back])]; setState(st); rerender(); });
    el.querySelector('.ls-clear')?.addEventListener('click', () => { const st = state(); st.ticks = []; setState(st); rerender(); });
    el.querySelector('.ls-copy')?.addEventListener('click', () => { track?.('list_export', { kind: 'copy' }); copy(el); });
    el.querySelector('.ls-print')?.addEventListener('click', () => { track?.('list_export', { kind: 'print' }); print(); });
    el.querySelector('.ls-share')?.addEventListener('click', async () => {
      if (!navigator.share) { track?.('list_export', { kind: 'copy' }); return copy(el); }   // no share sheet (most desktops): copy
      track?.('list_export', { kind: 'share' });
      try { await navigator.share({ title: t('list_header', 'WhiskedAway shopping list'), text: text() }); }
      catch (e) { if (e?.name !== 'AbortError') copy(el); }                   // closed the sheet: nothing; it failed: copy
    });
  }
  return { render, text, build, has: onList, set, get count() { return state().on.filter(id => book.has(id)).length; } };
}
