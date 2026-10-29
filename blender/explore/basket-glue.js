// The basket and the book, wired to the Inn (moved out of explore.html, architecture step 3): write-outs through the
// genie (recipeFetch, unitsNow, swapsFor, writer = createWriteOut, intoBook), the basket's checkout and sheet, cook mode,
// the shopping list and the book view. The pieces themselves are writeout.js, checkout.js, basket-view.js, cook.js,
// list.js and book-view.js. Shared through `inn` (docs/code-map.md).
import { visit } from './visit-state.js';
import { sound } from './sound.js';
import { RIBBONS } from './ideas.js';
import { book } from './book.js';
import { basket } from './basket.js';
import { createCheckout } from './checkout.js';
import { createBasketView } from './basket-view.js';
import { createBookView } from './book-view.js';
import { notes as innNotes } from './notes.js';
import { createWriteOut } from './writeout.js';
import { createCook } from './cook.js';
import { createList } from './list.js';
import { TIME_LIMIT, servingsNumber } from './checkin.js';
import { countryLabel } from './tell.js';
import { layers } from './layers.js';
import { kitchenPayload } from './kitchen.js';

export function install(inn) {
  // "Write it out in full" (explore/writeout.js): the genie's recipe route, seeded by the card and the whole visit, 3 a visit
  // A write-out through the genie: the visitor pass first, then 45 s to write. Giving up on the pass throws a timeout (or the
  // turnstile error), so writeout.js says why it failed and doesn't count it.
  // The person check: when Turnstile needs the visitor to tick its box, it comes to the sheet that's open (a sheet covers Gemma's
  // chat, where it first appears), and the wait stretches to give them time. It stays there while it needs them, even after
  // a failure, so the retry works with no reload (the pass is cached the moment they tick)
  const PASS_WAIT = 20000, CHECK_WAIT = 70000;
  const CHECK_NOTE = 'One quick check that you’re a person, then I’ll write it.';
  let wantPass = false, watching = null;
  function bringCheck() {
    const el = layers.top && layers.top.modal !== false ? layers.top.el : null;   // the sheet she's looking at, else the chat
    if (!inn.placeCheck(el, CHECK_NOTE)) return;
    clearInterval(watching);
    if (el) watching = setInterval(() => {                                       // the sheet closed under it: home to the chat
      if (el.hidden || !el.isConnected) { clearInterval(watching); inn.placeCheck(null); }
      else if (!inn.placeCheck(el)) clearInterval(watching);                  // the check is done
    }, 500);
  }
  inn.onCheck(showing => { if (showing && wantPass) bringCheck(); else if (!showing) wantPass = false; });
  async function recipeFetch(p) {
    let pass = inn.peekPass?.() || null;
    if (!pass) {
      wantPass = true;
      let timer, off;
      try {
        pass = await new Promise((ok, no) => {
          const arm = ms => { clearTimeout(timer); timer = setTimeout(() => no(new Error('timeout: no visitor pass')), ms); };
          arm(PASS_WAIT);
          if (inn.checkShowing()) { bringCheck(); arm(CHECK_WAIT); }                 // it's already waiting for them, in the chat
          off = inn.onCheck(showing => { if (showing) arm(CHECK_WAIT); });
          inn.getPass().then(ok, no);
        });
      } finally { clearTimeout(timer); off?.(); }
      if (pass) wantPass = false;
    }
    const init = { method: 'POST', signal: AbortSignal.timeout(45000), headers: { 'Content-Type': 'application/json', ...(pass ? { 'X-WA-Pass': pass } : {}) }, body: JSON.stringify(p) };
    // No pass (Turnstile unavailable): ask anyway and let the Worker decide. It says 403, so the failure is "bot_check" with no
    // second wait for a check (genieFetch would start one)
    if (!pass) return fetch(`${inn.GENIE_URL}${p.rewrite ? '/rewrite' : '/recipe'}`, init).catch(() => { throw new Error('turnstile: no visitor pass'); });   // an unreachable Worker with no pass is still the check's failure
    return inn.genieFetch(p.rewrite ? '/rewrite' : '/recipe', p, { signal: init.signal });   // a re-write has its own route and limit
  }
  // The room's own answers as the Worker reads them (four short ones): a real mix's jar size and add-ins go in `mix` instead
  const dishWords = r => { const d = visit.dish(r); return Object.fromEntries(Object.entries(d).filter(([k, v]) => !['mode', 'addins', ...(d.mode === 'real' ? ['topping'] : [])].includes(k) && typeof v === 'string')); };
  // Measurements (recipe-tools): the visitor's choice for this visit, else from the Map's country (the US measures in cups)
  const unitsNow = () => visit.get('units') || ((visit.get('country') || inn.mapDefault()) === 'US' ? 'cups' : 'metric');
  // Swaps on a written recipe's ingredient: Substitutions (Nicole's word; gemma-lines.json substitutions.table, content's), matched on the ingredient's
  // key or a word of its name; sweeteners also offer Sweet Spells' "Sweeten with" list (the sugar-swap table), never free text
  const SWEETENER_KEYS = { sugar: 'sugar', 'caster sugar': 'sugar', 'brown sugar': 'sugar', honey: 'honey', 'maple syrup': 'maple', agave: 'agave', 'agave syrup': 'agave' };
  function swapsFor(ing) {
    const table = inn.LINES.substitutions?.table || {}, key = String(ing.key || '').toLowerCase(), name = String(ing.item || '').toLowerCase();
    const hit = table[key] ? key : Object.keys(table).filter(k => !k.startsWith('_')).find(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(name));
    const xs = [...(hit ? table[hit] : [])];
    const sw = SWEETENER_KEYS[key] || SWEETENER_KEYS[hit];
    if (sw) for (const [id, label] of Object.entries(inn.sweet.data.sweetenWith.options)) if (id !== sw && id !== 'sweeteners' && !xs.includes(label)) xs.push(label);
    return xs.filter(x => x.toLowerCase() !== name && !inn.howYouLike.caged(x)).slice(0, 6);   // a swap never brings back what's caged
  }
  const writer = createWriteOut({
    book, visit, lines: inn.LINES.write_out, track: inn.track, bucket: n => (n >= 2 ? '2-3' : String(n)),
    // window.__recipeFetch is a test seam (scripted checks without the Worker); the site always uses the genie
    fetchRecipe: payload => (window.__recipeFetch || recipeFetch)(payload),
    fetchRewrite: payload => (window.__recipeFetch || recipeFetch)(payload),      // the seam sees payload.rewrite
    units: unitsNow, setUnits: u => visit.set('units', u), swapsFor,
    checkShowing: () => window.__checkShowing ?? inn.checkShowing(),      // test seam: say a check is on screen
    payloadFor: rec => ({
      tome_id: 'inn-idea', locale: navigator.language || 'en', room: rec.room, units: unitsNow(),
      idea: { name: rec.seed?.name || rec.title, kind: rec.kind, hook: rec.hook, key_ingredients: rec.key_ingredients || rec.seed?.ingredients || [],
              method_short: rec.method_short || rec.body, time: rec.seed?.time || (rec.time ? `${rec.time} min` : ''), why: rec.why }, mix: rec.mix,   // mix: the Chiapothecary's own jar (labels)
      energy: inn.world.energies?.[visit.get('energy')]?.label || null, weather: inn.world.weathers[inn.state.weather]?.label, time_of_day: inn.world.times[inn.timeNow()]?.label,
      theme: inn.themeNow().words, cuisines: inn.cuisinesNow().slice(0, 4), pantry_ingredients: inn.pantryNow().items, use_up: inn.pantryNow().useUp,
      dietary_restrictions: [].concat(visit.get('dietary') || []), dietary_other: visit.get('dietaryOther') || '',
      country: countryLabel(visit.get('country') || inn.mapDefault()), dish: dishWords(rec.room),
      // Sweet Spells (Inn-wide): how sweet and what with, as words; the occasion as words (the dish has its id)
      sweetness: inn.sweet.data.howSweet.options[visit.get('sweetness')] || null,
      sweeteners: [].concat(visit.get('sweeteners') || []).map(x => inn.sweet.data.sweetenWith.options[x] || x),
      occasion: rec.room === 'sweet-spells' ? inn.sweet.data.occasions.options[visit.dish('sweet-spells', 'occasion')]?.label || null : null,
      servings: servingsNumber(visit.get('servings')), confidence: visit.get('confidence') || null, time_available: TIME_LIMIT[visit.get('time')] || null,
      ...kitchenPayload(inn.kitchenNow(), inn.LINES.kitchen),               // { appliances: ['oven', 'air fryer'] } or { no_cooking: true }
      ...inn.howYouLike.payload(),                                          // { feels_skip, feels_more, keeping_off }: words, the Worker reads them
    }),
    onWritten: (rec, full) => { inn.record({ kind: 'recipe', atom: rec.id }); intoBook(rec, full); },
    onChange: () => bookView.refresh(),
    onLanded: rec => { cook.refresh(rec.id); bookView.refresh(); },              // cook mode open on this recipe picks up the write-out, keeping its step
  }); inn.writer = writer;
  // Whatever Gemma writes out goes into the book, with its leaflet out of the basket (Stage 1)
  function intoBook(rec, full) {
    if (!book.has(rec.id)) { const { added, kept, visit: v, full: f, ...snap } = rec; book.keep({ ...snap, full }); }
    basket.remove(rec.id);
    if (!inn.state.served.includes(rec.id)) inn.state.served.push(rec.id);
    if (inn.state.cards.some(c => c.atom === rec.id)) inn.ideas.remove(rec.id);
  }
  // The basket's checkout (explore/checkout.js): the book's Basket page. A centrepiece's idea glows its object while she writes it
  inn.castFor = null;                                           // { atom, el, line } the centrepiece idea the checkout is holding
  const checkout = createCheckout({
    basket, writer, ribbons: RIBBONS, lines: inn.LINES.basket, track: inn.track, bucket: n => (n >= 2 ? '2-3' : String(n)),
    onOpenBook: id => basketView.closeThen(() => bookView.open(id && book.has(id) ? id : 'contents', { from: 'basket' })),
    onWriteStart: rec => {
      if (inn.castFor?.atom !== rec.id) return;
      inn.casting = true;
      inn.castFor.el?.classList.add('casting');
      inn.say(inn.castFor.line('writing'), [], true);
      inn.holdLine();
      inn.thinking(true);
    },
    onWriteEnd: (rec, full) => {
      if (inn.castFor?.atom !== rec.id) return;
      inn.thinking(false);
      inn.castFor.el?.classList.remove('casting');
      inn.casting = false;
      inn.say(inn.castFor.line(full ? 'done' : 'failed'), [], true);
      inn.holdLine();
      inn.castFor = null;
    },
    // The visitor closed the book while she wrote: the first one opens once nothing else is open (whenFree)
    onBatchDone: ({ count, first }) => {
      const free = () => !bookView.isOpen && !basketView.isOpen;   // the basket shows its own results
      if (count && first && free()) inn.whenFree(() => { if (free()) bookView.open(first, { from: 'basket' }); });
    },
  }); inn.checkout = checkout;
  // The basket's own sheet (basket-view.js): the bar's basket chip opens it; the book has its own chip
  const basketView = createBasketView({ basket, checkout, chip: inn.$('btn-book'), lines: inn.LINES.basket || {}, track: inn.track, bucket: inn.sizeBucket }); inn.basketView = basketView;
  // Recipes kept before the basket, never written out, become leaflets: the book holds only written recipes (Nicole, 22 Oct)
  for (const k of book.list()) if (!k.full && !writer.written(k.id)) { const { kept, visit: v, ...snap } = k; basket.add(snap); book.remove(k.id); }
  // Cook mode (explore/cook.js, cook-mode-ux.md §1): one step at a time over everything, with timers
  const cook = createCook({ written: id => writer.written(id), writer, sound, track: inn.track, say: t => inn.say(t, [], true), lines: { ...inn.LINES.cook, shopping_list: inn.LINES.book?.shopping_list },
    // The list opens over the recipe cook mode was started from, once cook mode's step back in history has gone (or the
    // list's own step would be the one popped, and back would skip it)
    isKept: id => book.has(id), onList: rec => {
      inn.track('list_open');
      shopList.set(rec.id, true, 'cook');                         // the recipe being cooked goes on the list
      layers.afterBack(() => bookView.open('list', { from: 'cook' }));   // once cook mode's step back has landed (layers.js)
    } }); inn.cook = cook;
  // The shopping list (explore/list.js): the written recipes the visitor picks, summed, the pantry set aside, in their shopping words
  const shopList = createList({ title: inn.LINES.book?.shopping_list, lines: inn.LINES.book || {}, book, written: id => writer.written(id), pantry: () => inn.pantryNow().items, synonyms: () => inn.SYNONYMS,
    servings: () => servingsNumber(visit.get('servings')), words: t => inn.shopWords.text(t), track: inn.track }); inn.shopList = shopList;
  const bookView = createBookView({
    onCook: (rec, from) => cook.open(rec, from),
    list: shopList,
    writeOut: (el, rec, seed) => writer.render(el, rec, seed),
    themeLine: () => inn.themeNow().sentence, clashNote: rec => inn.CLASH_NOTE[inn.dietClash(rec)] || '',
    book, basket, basketLines: inn.LINES.basket || {}, bookLines: inn.LINES.book || {},
    onBasket: () => inn.fromBook(() => basketView.open({ from: 'book' }))(),
    atoms: inn.atomsById, chip: inn.$('btn-mybook'), notes: inn.$('notes'), track: inn.track, bucket: inn.sizeBucket,
    onKeep: rec => inn.keepIdea(rec.id, rec.why, 'book'),
    onRead: id => inn.countAtom('atom_open', id, { from: 'book' }),     // a kept recipe opened from Contents
    onClear: n => { inn.track('book_clear', { book_size: inn.sizeBucket(n) }); inn.say(inn.L.cleared, [], true); },
    actions: rec => (rec.room === 'chiapothecary' ? inn.chiaActions : []),
    extra: rec => inn.sweetSwapHtml(rec),                              // Sweet Spells' swap-the-sugar lines
    innNotes, noteLines: inn.LINES.innNotes,                           // Inn notes at the back of the book
  }); inn.bookView = bookView;
}
