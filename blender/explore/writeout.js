// "Write it out in full" (recipe-book-ux.md v4 §8, stage 4): on a recipe's page in the book, Gemma writes the seed recipe out
// with quantities, steps and a tip, through the genie Worker's recipe route (tome inn-idea). The seed recipe is always
// there and free; writing costs one of 3 a day on this device (the basket's allowance, docs/basket-stage1-design.md: localStorage
// `wa-allowance`, shared by checkout, this button, the Mix and cook mode). Re-opening one she wrote is free: it's kept in the
// book, and in this tab's sessionStorage. A failure doesn't count against the cap.

const KEY = 'wa-written';
export const WRITE_CAP = 3;
export const DIETS = [['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['gluten-free', 'Gluten-free'], ['dairy-free', 'Dairy-free'], ['nut-free', 'Nut-free'], ['low-fodmap', 'Low-FODMAP']];
// "More options" (Nicole, 22 Oct): passed to the write-out like the others; labels from write_out.diet_labels. The id is what
// the Worker reads, so Hindu is sent as "hindu-no-beef"
export const MORE_DIETS = [['halal', 'Halal'], ['kosher', 'Kosher'], ['hindu-no-beef', 'Hindu (no beef)'], ['keto', 'Keto'], ['low-carb', 'Low carb']];
export const WRITE_ONLY = ['halal', 'kosher', 'hindu-no-beef'];   // religious needs: cards rarely say, so mostly the write-out keeps to them
export const CARB_DIETS = ['keto', 'low-carb'];
// The More options never filter a card on a guess: only cards content has judged for that need (atom.diet_checked lists the
// needs judged; atom.diet the ones it meets) are left out or kept (explore.html dietClash)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || { recipes: {} }; } catch { return { recipes: {} }; } }
let mem = load();
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked: memory only */ } };

// Today's allowance: { day: 'YYYY-MM-DD' (the device's own date), n }. Read every time, so another tab's write counts too
const ALLOW = 'wa-allowance';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let allowMem = { day: today(), n: 0 };
function usedToday() {
  try { const a = JSON.parse(localStorage.getItem(ALLOW) || 'null'); if (a) allowMem = a; } catch { /* blocked: memory */ }
  return allowMem.day === today() ? Number(allowMem.n) || 0 : 0;
}
function spend() {
  allowMem = { day: today(), n: usedToday() + 1 };
  try { localStorage.setItem(ALLOW, JSON.stringify(allowMem)); } catch { /* blocked: memory only */ }
}

// Re-writes (recipe-tools, PM 4's cost rule): a swap or other measurements on a recipe already written. They don't use the 3 a
// day; they have their own 5 a day on this device (localStorage `wa-rewrites`), and the Worker's /rewrite its own rate limit
const REW = 'wa-rewrites';
export const REWRITE_CAP = 5;
let rewMem = { day: today(), n: 0 };
function rewritesToday() {
  try { const a = JSON.parse(localStorage.getItem(REW) || 'null'); if (a) rewMem = a; } catch { /* blocked: memory */ }
  return rewMem.day === today() ? Number(rewMem.n) || 0 : 0;
}
function spendRewrite() {
  rewMem = { day: today(), n: rewritesToday() + 1 };
  try { localStorage.setItem(REW, JSON.stringify(rewMem)); } catch { /* blocked: memory only */ }
}
// Measurements (Nicole, 22 Oct): what the write-out uses; labels from write_out.units_labels
export const UNITS = [['metric', 'Metric (grams, ml)'], ['cups', 'Cups and spoons'], ['both', 'Both']];

/** "Save as PDF / print": the recipe alone on a print-only sheet (the print stylesheet hides the rest), then the browser's print */
export function printRecipe(rec, f) {
  let sheet = document.getElementById('print-sheet');
  if (!sheet) { sheet = document.createElement('div'); sheet.id = 'print-sheet'; document.body.appendChild(sheet); }
  sheet.innerHTML = `<h1>${esc(f.name || rec.title)}</h1>${rec.hook ? `<p class="ps-hook">${esc(rec.hook)}</p>` : ''}
    <h2>You'll need${f.serves ? ` (serves ${f.serves})` : ''}</h2>
    <ul>${f.ingredients.map(i => `<li>${i.amount ? `<b>${esc(i.amount)}${i.unit ? ` ${esc(i.unit)}` : ''}</b> ` : ''}${esc(i.item)}</li>`).join('')}</ul>
    <h2>How${f.time ? ` (${esc(f.time)})` : ''}</h2>
    <ol>${f.steps.map(x => `<li>${esc(typeof x === 'string' ? x : x.text)}</li>`).join('')}</ol>
    ${f.tip ? `<p><b>Gemma's tip:</b> ${esc(f.tip)}</p>` : ''}
    <p class="ps-foot">Written by Gemma at the WhiskedAway Inn · whiskedaway.com</p>`;
  document.body.classList.add('print-recipe');
  const done = () => { document.body.classList.remove('print-recipe'); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);                              // browsers that print without afterprint (the dialog blocks until then anyway)
}

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

export function createWriteOut({ book, visit, lines = {}, fetchRecipe, fetchRewrite, payloadFor, track, bucket, onWritten, onDiet, onChange, onLanded, onAllowanceReached,
                                 units = () => 'metric', setUnits, swapsFor = () => [] }) {
  // units(): the visitor's measurements (set, or from the Map's country); swapsFor(ingredient): the swap table's options for it
  const L = {
    button: lines.button || 'Get the full recipe',
    remaining: lines.remaining || 'Gemma writes it for you (3 free a day, {n} left today).',
    remainingOne: lines.remaining_one || 'Gemma writes it for you (3 free a day, one left today).',
    writing: lines.writing || 'Gemma is writing…',
    atCap: lines.at_cap || "That's my three written out for today. The short version's above, and I'll write more tomorrow.",
    print: lines.print || 'Save as PDF / print',
    more: lines.more_diets || 'More options ›',
    keeping: lines.keeping || "I'll keep to {d}.",
    change: lines.change_diets || 'Change',
    failed: lines.failed || "My pen's run dry. The short version's above. Try again in a bit.",
    diet: lines.diet_question || 'Anything I should avoid?',
    unitsLine: lines.units_line || 'In {u}.',
    unitsWritten: lines.units_written || 'Written in {u}.',
    unitsUnknown: lines.units_unknown || 'Measurements:',
    unitsQuestion: lines.units_question || 'How do you measure?',
    unitsRewrite: lines.units_rewrite || 'Re-write it in {u}',
    rewritesLeft: lines.rewrites_left || "Re-writes don't use your 3 a day ({n} left today).",
    rewritesNone: lines.rewrites_none || "That's my five re-writes for today. I'll do more tomorrow.",
    rewriting: lines.rewriting || 'Gemma is re-writing it…',
    rewriteFailed: lines.rewrite_failed || "That one didn't take. Here's the recipe as it was. Try again in a bit.",
    swapHint: lines.substitutions_hint || 'Substitutions: tap an ingredient to see what you can use instead.',
    swapTitle: lines.substitutions_title || 'Substitutions for {item}:',
    swapCancel: lines.substitutions_cancel || 'Cancel',
  };
  const ulabel = id => lines.units_labels?.[id] || UNITS.find(([x]) => x === id)?.[1] || id;
  const uword = id => ulabel(id).replace(/\s*\(.*\)$/, '').toLowerCase();   // "metric", "cups and spoons", "both" in a sentence
  let rewriting = null, rwFailed = null;              // the recipe being re-written; the one whose last re-write failed
  let swapAt = null, unitsOpen = null;                // { id, i } the ingredient whose swaps show; the recipe whose units show
  const rwLeft = () => Math.max(0, REWRITE_CAP - rewritesToday());
  const redraw = (el, rec, seedEl) => (onChange ? onChange() : render(el, rec, seedEl));
  let busy = null;                                    // the atom being written, while it's being written
  let failed = null;                                  // the atom whose last try failed (her line shows until the next try)
  let openDiet = false;                               // the visitor opened "Anything to avoid? ›" on this page
  let moreDiets = false;                              // "More options" is open (stays open for the visit's page or checkout)
  let askOpen = false;                                // the checkout's diet question is showing (it stays while they choose)
  const label = ([id, l]) => lines.diet_labels?.[id] || l;
  /** The diet buttons, with More options under a link (open by itself when one of them is chosen) */
  function dietGroup(diet) {
    const more = moreDiets || MORE_DIETS.some(([id]) => diet.includes(id));
    const btn = d => `<button data-diet="${d[0]}" aria-pressed="${diet.includes(d[0])}">${esc(label(d))}</button>`;
    return `<div class="bk-diet" role="group" aria-label="${esc(L.diet)}"><p class="small">${esc(L.diet)}</p>${DIETS.map(btn).join('')}
      ${more ? MORE_DIETS.map(btn).join('') : `<button class="link bk-moredivs" aria-expanded="false">${esc(L.more)}</button>`}</div>`;
  }
  // An answer sets the visit's dietary needs, like the cookbook shelf, in every room
  function bindDiet(el, redraw) {
    el.querySelectorAll('[data-diet]').forEach(b => b.onclick = () => {
      const now = [].concat(visit.get('dietary') || []), id = b.dataset.diet;
      const next = now.includes(id) ? now.filter(x => x !== id) : [...now, id];
      visit.set('dietary', next.length ? next : null);
      mem.dietAsked = true; save();
      b.setAttribute('aria-pressed', String(next.includes(id)));
      onDiet?.(next);
    });
    el.querySelector('.bk-moredivs')?.addEventListener('click', () => {
      moreDiets = true; redraw();
      el.querySelector(`[data-diet="${MORE_DIETS[0][0]}"]`)?.focus();
    });
  }
  const left = () => Math.max(0, WRITE_CAP - usedToday());
  /** A recipe she's already written for this atom, from the book or this tab */
  const written = id => book.get(id)?.full || mem.recipes[id] || null;

  function fullHtml(f) {
    const busyHere = rewriting === f.id, canRw = rwLeft() > 0 && !busyHere;
    const ing = (i, n) => {
      const text = `${i.amount ? `<b>${esc(i.amount)}${i.unit ? ` ${esc(i.unit)}` : ''}</b> ` : ''}${esc(i.item)}`;
      const swaps = swapsFor(i);
      if (!swaps.length || busyHere) return `<li>${text}</li>`;
      const open = swapAt?.id === f.id && swapAt.i === n;
      return `<li><button class="bk-ingbtn" data-ing="${n}" aria-expanded="${open}">${text}</button>${open ? `<div class="bk-swaps" role="group" aria-label="${esc(L.swapTitle.replace('{item}', i.item))}">
        <p class="small">${esc(L.swapTitle.replace('{item}', i.item))}</p>${canRw ? swaps.map(x => `<button data-swap="${esc(x)}">${esc(x)}</button>`).join('') : `<p class="small">${esc(L.rewritesNone)}</p>`}
        <button class="link bk-swapcancel">${esc(L.swapCancel)}</button>${canRw ? `<p class="small">${esc(L.rewritesLeft.replace('{n}', rwLeft()))}</p>` : ''}</div>` : ''}</li>`;
    };
    const hasSwaps = !busyHere && f.ingredients.some(i => swapsFor(i).length);
    const uOpen = unitsOpen === f.id && !busyHere;
    return `${busyHere ? `<p class="bk-writing" role="status">${esc(L.rewriting)} <span class="dots" aria-hidden="true">• • •</span></p>` : ''}
      ${rwFailed === f.id ? `<p class="bk-failed" role="status">${esc(L.rewriteFailed)}</p>` : ''}
      <h4>You'll need${f.serves ? ` <span class="small">(serves ${f.serves})</span>` : ''}</h4>
      <p class="small bk-unitsline">${esc(f.units ? L.unitsWritten.replace('{u}', uword(f.units)) : L.unitsUnknown)}
        ${busyHere ? '' : `<button class="link bk-unitschange" aria-expanded="${uOpen}">${esc(L.change)}</button>`}</p>
      ${uOpen ? `<div class="bk-diet bk-units" role="group" aria-label="${esc(L.unitsQuestion)}">${UNITS.map(([id]) => `<button data-units="${id}" aria-pressed="${units() === id}">${esc(ulabel(id))}</button>`).join('')}
        ${units() !== f.units ? (canRw ? `<p><button class="bk-outline bk-unitsrw">${esc(L.unitsRewrite.replace('{u}', uword(units())))}</button></p><p class="small">${esc(L.rewritesLeft.replace('{n}', rwLeft()))}</p>`
          : `<p class="small">${esc(L.rewritesNone)}</p>`) : ''}</div>` : ''}
      ${hasSwaps ? `<p class="small bk-swaphint">${esc(L.swapHint)}</p>` : ''}
      <ul class="bk-ing">${f.ingredients.map(ing).join('')}</ul>
      <h4>How${f.time ? ` <span class="small">${esc(f.time)}</span>` : ''}</h4>
      <ol class="bk-steps">${f.steps.map(x => `<li>${esc(typeof x === 'string' ? x : x.text)}</li>`).join('')}</ol>
      ${f.tip ? `<p class="bk-tip"><b>Gemma's tip:</b> ${esc(f.tip)}</p>` : ''}
      <p class="small">Written by Gemma${book.has(f.id) ? ', and kept in your book' : ''}.</p>
      <p class="bk-printrow"><button class="bk-outline bk-print">${esc(L.print)}</button></p>`;
  }

  /** Fill a page's write-out slot. `seedEl` holds the short version, which a written recipe replaces. */
  function render(el, rec, seedEl) {
    const f = written(rec.id);
    if (f) {
      seedEl.innerHTML = fullHtml({ ...f, id: rec.id }); el.innerHTML = '';
      seedEl.querySelector('.bk-print').onclick = () => { track?.('recipe_print'); printRecipe(rec, f); };
      const again = (focus) => { redraw(el, rec, seedEl); if (focus) seedEl.isConnected ? seedEl.querySelector(focus)?.focus() : document.querySelector(`.bk-seed ${focus}`)?.focus(); };
      seedEl.querySelectorAll('[data-ing]').forEach(b => b.onclick = () => {
        const i = +b.dataset.ing, open = swapAt?.id === rec.id && swapAt.i === i;
        swapAt = open ? null : { id: rec.id, i }; unitsOpen = null;
        again(open ? `[data-ing="${i}"]` : `[data-ing="${i}"] + .bk-swaps button`);
      });
      seedEl.querySelector('.bk-swapcancel')?.addEventListener('click', () => { const i = swapAt?.i; swapAt = null; again(`[data-ing="${i}"]`); });
      seedEl.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => {
        const from = f.ingredients[swapAt.i]?.item;
        rewriteNow(rec, { swap: { from, to: b.dataset.swap } }, 'swap').then(() => redraw(el, rec, seedEl));
        redraw(el, rec, seedEl);
      });
      seedEl.querySelector('.bk-unitschange')?.addEventListener('click', () => { unitsOpen = unitsOpen === rec.id ? null : rec.id; swapAt = null; again('[data-units]'); });
      seedEl.querySelectorAll('[data-units]').forEach(b => b.onclick = () => { setUnits?.(b.dataset.units); again(`[data-units="${b.dataset.units}"]`); });
      seedEl.querySelector('.bk-unitsrw')?.addEventListener('click', () => {
        rewriteNow(rec, { units: units() }, 'units').then(() => redraw(el, rec, seedEl));
        redraw(el, rec, seedEl);
      });
      return;
    }
    if (busy === rec.id) {
      el.innerHTML = `<p class="bk-writing" role="status">${esc(L.writing)} <span class="dots" aria-hidden="true">• • •</span></p>`;
      return;
    }
    if (!left()) { el.innerHTML = `<p class="small">${esc(L.atCap)}</p>`; return; }
    const oops = failed === rec.id ? `<p class="bk-failed" role="status">${esc(L.failed)}</p>` : '';
    const diet = [].concat(visit.get('dietary') || []);
    const ask = !diet.length && !mem.dietAsked;
    const offer = !diet.length && mem.dietAsked && !openDiet;     // asked before and not answered: a one-line way back in (UX T6)
    el.innerHTML = `${oops}${offer ? `<p><button class="link bk-dietmore">Anything to avoid? ›</button></p>` : ''}${ask || openDiet ? dietGroup(diet) : ''}
      <button class="bk-writeout">${esc(L.button)}</button>
      <p class="small">${esc(left() === 1 ? L.remainingOne : L.remaining.replace('{n}', left()))}</p>`;
    // It isn't asked again this visit once answered; More options redraws with the question open
    bindDiet(el, () => { openDiet = true; render(el, rec, seedEl); });
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
  async function writeNow(rec, from = 'book') {
    if (busy || !left()) return null;
    busy = rec.id;
    failed = null;
    mem.dietAsked = true; save();
    track?.('recipe_full_asked', { atom: rec.id, room: rec.room });
    let reason = null, recipe = null;
    const payload = payloadFor(rec);
    try {
      const res = await fetchRecipe(payload);
      if (!res.ok) reason = res.status === 429 ? 'rate_limited' : res.status === 403 ? 'bot_check' : 'error';
      else recipe = cleanRecipe(await res.json());
      if (!reason && !recipe) reason = 'error';
    } catch (err) {
      reason = /timeout|abort/i.test(String(err?.message || err)) ? 'timeout' : /turnstile/i.test(String(err?.message || err)) ? 'bot_check' : 'error';
    }
    busy = null;
    if (recipe) {
      spend();
      recipe.units = payload.units || null;               // so its page can say how it's measured, and offer a re-write
      mem.recipes[rec.id] = recipe;
      save();
      if (book.has(rec.id)) book.setFull(rec.id, recipe);
      track?.('recipe_full', { atom: rec.id, room: rec.room, remaining: bucket(left()) });
      onWritten?.(rec, recipe);
      if (!left()) { track?.('allowance_reached', { from }); onAllowanceReached?.(from); }
    } else {
      failed = rec.id;
      track?.('recipe_full_failed', { atom: rec.id, room: rec.room, reason });
    }
    onLanded?.(rec);                                    // whoever's showing this recipe (cook mode) can update
    return recipe;
  }

  /** A re-write of a recipe she's written: a swap ({ swap: { from, to } }) or other measurements ({ units }). Not one of the 3 a
   *  day; 5 a day of their own. The page keeps the recipe as it was until the new one lands; a failure leaves it and isn't counted */
  async function rewriteNow(rec, change, kind) {
    const was = written(rec.id);
    if (!was || rewriting || !rwLeft() || !fetchRewrite) return null;
    rewriting = rec.id; rwFailed = null;
    const payload = { ...payloadFor(rec), units: change.units || was.units || units(), rewrite: { recipe: was, swap: change.swap || null } };
    let recipe = null;
    try {
      const res = await fetchRewrite(payload);
      if (res.ok) recipe = cleanRecipe(await res.json());
    } catch { /* timeout, the pass, the network: the failed line */ }
    rewriting = null;
    if (recipe) {
      spendRewrite();
      recipe.units = payload.units;
      mem.recipes[rec.id] = recipe; save();
      if (book.has(rec.id)) book.setFull(rec.id, recipe);
      swapAt = null; unitsOpen = null;
    } else rwFailed = rec.id;
    track?.('recipe_rewrite', { kind, outcome: recipe ? 'ok' : 'failed', remaining: String(rwLeft()) });
    onLanded?.(rec);
    return recipe;
  }

  /** The checkout's measurements: "In metric. Change", the choice opening pre-filled (like the diet line) */
  let unitsAskOpen = false;
  function unitsAsk(el) {
    if (!unitsAskOpen) {
      el.innerHTML = `<p class="small bk-unitsline">${esc(L.unitsLine.replace('{u}', uword(units())))} <button class="link bk-unitschange">${esc(L.change)}</button></p>`;
      el.querySelector('.bk-unitschange').onclick = () => { unitsAskOpen = true; unitsAsk(el); el.querySelector('[aria-pressed="true"]')?.focus(); };
      return;
    }
    el.innerHTML = `<div class="bk-diet bk-units" role="group" aria-label="${esc(L.unitsQuestion)}"><p class="small">${esc(L.unitsQuestion)}</p>
      ${UNITS.map(([id]) => `<button data-units="${id}" aria-pressed="${units() === id}">${esc(ulabel(id))}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-units]').forEach(b => b.onclick = () => { setUnits?.(b.dataset.units); unitsAsk(el); el.querySelector(`[data-units="${b.dataset.units}"]`)?.focus(); });
  }

  /** The checkout's diet question. Needs already set (the Inn's objects, Tell Gemma, an earlier answer) show as one line with
   *  Change, which opens the buttons pre-filled; none set and never asked this visit: the question, as on a page. Once open it
   *  stays while the visitor chooses (dietAskReset() as the checkout opens) */
  function dietAsk(el) {
    const diet = [].concat(visit.get('dietary') || []);
    if (!askOpen && diet.length) {
      const words = diet.map(id => label([...DIETS, ...MORE_DIETS].find(([x]) => x === id) || [id, id]));
      el.innerHTML = `<p class="small bk-dietset">${esc(L.keeping.replace('{d}', words.join(', ')))} <button class="link bk-dietchange">${esc(L.change)}</button></p>`;
      el.querySelector('.bk-dietchange').onclick = () => { askOpen = true; dietAsk(el); el.querySelector('[data-diet]')?.focus(); };
      return;
    }
    if (!askOpen && mem.dietAsked) { el.innerHTML = ''; return; }
    askOpen = true;
    el.innerHTML = dietGroup(diet);
    bindDiet(el, () => dietAsk(el));
  }
  const dietAskReset = () => { askOpen = false; unitsAskOpen = false; };

  return { render, written, writeNow, rewriteNow, dietAsk, unitsAsk, dietAskReset, get rewritesLeft() { return rwLeft(); }, get left() { return left(); }, get busy() { return !!busy; }, get busyFor() { return busy; }, clear() { mem = { recipes: {} }; save(); }, printRecipe };
}
