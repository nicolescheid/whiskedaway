// "Write it out in full" (recipe-book-ux.md v4 §8, stage 4): on a recipe's page in the book, Gemma writes the seed recipe out
// with quantities, steps and a tip, through the genie Worker's recipe route (tome inn-idea). The seed recipe is always
// there and free; writing costs one of 3 a visit. Re-opening one she wrote is free: it's kept in the book for a kept recipe,
// and in this tab's sessionStorage for one that isn't. A failure doesn't count against the cap.

const KEY = 'wa-written';
export const WRITE_CAP = 3;
export const DIETS = [['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['gluten-free', 'Gluten-free'], ['dairy-free', 'Dairy-free'], ['nut-free', 'Nut-free']];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || { n: 0, recipes: {} }; } catch { return { n: 0, recipes: {} }; } }
let mem = load();
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked: memory only */ } };

/** A written recipe, checked into a safe shape (or null) */
export function cleanRecipe(r) {
  if (!r || typeof r !== 'object') return null;
  const s = (v, n) => String(v ?? '').slice(0, n).trim();
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 16)
    .map(i => (typeof i === 'string' ? { item: s(i, 80), amount: '' }
      : { item: s(i?.item ?? i?.name, 80), amount: s(i?.amount ?? i?.quantity, 40), unit: s(i?.unit, 12), key: s(i?.key, 40).toLowerCase() }))
    .filter(i => i.item);
  // Steps come as strings (older write-outs) or { text, minutes?, uses? } (cook-mode-ux.md §3); both are kept as given
  const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 12).map(x => {
    if (typeof x === 'string') return s(x, 400);
    const text = s(x?.text, 400), min = Math.round(Number(x?.minutes));
    return text && { text, ...(min > 0 && min <= 600 ? { minutes: min } : {}), ...(Array.isArray(x?.uses) ? { uses: x.uses.slice(0, 8).map(u => s(u, 40)) } : {}) };
  }).filter(Boolean);
  if (!ingredients.length || !steps.length) return null;
  return { name: s(r.name, 100), serves: Number(r.serves) > 0 ? Math.min(12, Math.round(Number(r.serves))) : null, time: s(r.time, 40),
           ingredients, steps, tip: s(r.tip, 240) };
}

export function createWriteOut({ book, visit, lines = {}, fetchRecipe, payloadFor, track, bucket, onWritten, onDiet, onChange }) {
  const L = {
    button: lines.button || 'Write it out in full',
    remaining: lines.remaining || 'I can write out {n} more this visit.',
    remainingOne: lines.remaining_one || 'I can write out one more this visit.',
    writing: lines.writing || 'Gemma is writing…',
    atCap: lines.at_cap || "That's three I've written out this visit. The short version's above.",
    failed: lines.failed || "My pen's run dry. The short version's above. Try again in a bit.",
    diet: lines.diet_question || 'Anything I should avoid?',
  };
  let busy = null;                                    // the atom being written, while it's being written
  let failed = null;                                  // the atom whose last try failed (her line shows until the next try)
  let openDiet = false;                               // the visitor opened "Anything to avoid? ›" on this page
  const left = () => Math.max(0, WRITE_CAP - mem.n);
  /** A recipe she's already written for this atom, from the book or this tab */
  const written = id => book.get(id)?.full || mem.recipes[id] || null;

  function fullHtml(f) {
    return `<h4>You'll need${f.serves ? ` <span class="small">(serves ${f.serves})</span>` : ''}</h4>
      <ul class="bk-ing">${f.ingredients.map(i => `<li>${i.amount ? `<b>${esc(i.amount)}${i.unit ? ` ${esc(i.unit)}` : ''}</b> ` : ''}${esc(i.item)}</li>`).join('')}</ul>
      <h4>How${f.time ? ` <span class="small">${esc(f.time)}</span>` : ''}</h4>
      <ol class="bk-steps">${f.steps.map(x => `<li>${esc(typeof x === 'string' ? x : x.text)}</li>`).join('')}</ol>
      ${f.tip ? `<p class="bk-tip"><b>Gemma's tip:</b> ${esc(f.tip)}</p>` : ''}
      <p class="small">Written out by Gemma for this visit${book.has(f.id) ? ', and kept in your book' : ''}.</p>`;
  }

  /** Fill a page's write-out slot. `seedEl` holds the short version, which a written recipe replaces. */
  function render(el, rec, seedEl) {
    const f = written(rec.id);
    if (f) { seedEl.innerHTML = fullHtml({ ...f, id: rec.id }); el.innerHTML = ''; return; }
    if (busy === rec.id) {
      el.innerHTML = `<p class="bk-writing" role="status">${esc(L.writing)} <span class="dots" aria-hidden="true">• • •</span></p>`;
      return;
    }
    if (!left()) { el.innerHTML = `<p class="small">${esc(L.atCap)}</p>`; return; }
    const oops = failed === rec.id ? `<p class="bk-failed" role="status">${esc(L.failed)}</p>` : '';
    const diet = [].concat(visit.get('dietary') || []);
    const ask = !diet.length && !mem.dietAsked;
    const offer = !diet.length && mem.dietAsked && !openDiet;     // asked before and not answered: a one-line way back in (UX T6)
    el.innerHTML = `${oops}${offer ? `<p><button class="link bk-dietmore">Anything to avoid? ›</button></p>` : ''}${ask || openDiet ? `<div class="bk-diet" role="group" aria-label="${esc(L.diet)}"><p class="small">${esc(L.diet)}</p>
        ${DIETS.map(([id, label]) => `<button data-diet="${id}" aria-pressed="false">${esc(label)}</button>`).join('')}</div>` : ''}
      <button class="bk-writeout">${esc(L.button)}</button>
      <p class="small">${esc(left() === 1 ? L.remainingOne : L.remaining.replace('{n}', left()))}</p>`;
    // An answer here sets the visit's dietary needs, like the cookbook shelf, in every room; it isn't asked again this visit
    el.querySelectorAll('[data-diet]').forEach(b => b.onclick = () => {
      const now = [].concat(visit.get('dietary') || []), id = b.dataset.diet;
      const next = now.includes(id) ? now.filter(x => x !== id) : [...now, id];
      visit.set('dietary', next.length ? next : null);
      mem.dietAsked = true; save();
      b.setAttribute('aria-pressed', String(next.includes(id)));
      onDiet?.(next);
    });
    el.querySelector('.bk-dietmore')?.addEventListener('click', () => { openDiet = true; render(el, rec, seedEl); el.querySelector('[data-diet]')?.focus(); });
    el.querySelector('.bk-writeout').onclick = () => write(rec, el, seedEl);
  }

  async function write(rec, el, seedEl) {
    if (busy || !left()) return;
    const p = writeNow(rec);
    render(el, rec, seedEl);
    await p;
    // The page may have been redrawn while she wrote: draw it again (or this slot, if nothing redraws)
    if (onChange) onChange(); else render(el, rec, seedEl);
  }
  /** Write one out (the page's button, or cook mode's offer): the recipe, or null if it failed. Counts against the cap. */
  async function writeNow(rec) {
    if (busy || !left()) return null;
    busy = rec.id;
    failed = null;
    mem.dietAsked = true; save();
    let reason = null, recipe = null;
    try {
      const res = await fetchRecipe(payloadFor(rec));
      if (!res.ok) reason = res.status === 429 ? 'rate_limited' : res.status === 403 ? 'bot_check' : 'error';
      else recipe = cleanRecipe(await res.json());
      if (!reason && !recipe) reason = 'error';
    } catch (err) {
      reason = /timeout|abort/i.test(String(err?.message || err)) ? 'timeout' : /turnstile/i.test(String(err?.message || err)) ? 'bot_check' : 'error';
    }
    busy = null;
    if (recipe) {
      mem.n += 1;
      mem.recipes[rec.id] = recipe;
      save();
      if (book.has(rec.id)) book.setFull(rec.id, recipe);
      track?.('recipe_full', { atom: rec.id, room: rec.room, remaining: bucket(left()) });
      onWritten?.(rec, recipe);
    } else {
      failed = rec.id;
      track?.('recipe_full_failed', { atom: rec.id, room: rec.room, reason });
    }
    return recipe;
  }

  return { render, written, writeNow, get left() { return left(); }, get busy() { return !!busy; }, clear() { mem = { n: mem.n, recipes: {} }; save(); } };
}
