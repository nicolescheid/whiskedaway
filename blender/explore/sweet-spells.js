// Sweet Spells (rooms-views.md, Stage B): three sheets on objects the room already has.
//   The potion cabinet → "How sweet?" (full, less, none), then "Sweeten with…" only for less or none. Both are about you,
//     Inn-wide (visit 'sweetness', 'sweeteners[]'), so the Chiapothecary reads them too.
//   The spell books → "What are you craving?" (6 chips, pick any), for this dish (visit.dish('sweet-spells', 'cravings')).
//   The lectern's open book → the Occasions book (4 occasions, visit.dish('sweet-spells', 'occasion')). It suggests servings
//     and time only where the check-in hasn't answered them, with one line ("Six of you, then?"). The check-in always wins.
// And the swap-the-sugar lines on Sweet Spells recipe pages: a fixed, content-owned table, never invented ratios.
// Words come from gemma-lines.json `sweet` (content editor); these stand in where it has none.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const ROOM = 'sweet-spells';
const listOf = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const capFirst = t => String(t || '').replace(/^./, c => c.toUpperCase());
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// The check-in's answers (checkin.js): servings '1'…'6' | 'crowd'; time quick | half | hour | any
const TIME_KEY = { 15: 'quick', 30: 'half', 60: 'hour' };

const DEFAULTS = {
  howSweet: { title: 'How sweet?', options: { full: 'The full treat', less: 'A bit less sugar', none: 'No added sugar' } },
  sweetenWith: { title: 'Sweeten with…', helper: "Only if you'd like less sugar. Pick any.",
    options: { sugar: 'Sugar', honey: 'Honey', maple: 'Maple syrup', agave: 'Agave', dates: 'Dates or fruit', sweeteners: 'Sweeteners are fine' } },
  cravings: { title: 'What are you craving?', helper: 'Pick any.',
    options: { chocolate: 'Chocolate', fruity: 'Fruit', creamy: 'Something creamy', crunchy: 'Something crunchy', warming: 'Something warm', chilled: 'Something cold' } },
  occasions: { title: "What's it for?", helper: "I'll suggest how many and how long, unless you've already told me.", suggest: '{n} of you, then?',
    options: { now: { label: 'A treat now', line: 'Something for right now, then.', servings: 1, time: 15 },
               tea: { label: 'Afternoon tea', line: 'Afternoon tea. Something to share with a cuppa.', servings: 4, time: 60 },
               dinner: { label: 'A dinner party', line: "A dinner party. A pudding for six, I'd say.", servings: 6, time: 60 },
               celebration: { label: 'A celebration', line: "A celebration. Let's make it look the part.", servings: 8, time: null } } },
  ack: { howSweet: { full: 'The full treat it is.', less: "A bit less sugar. I'll go gently.", none: 'No added sugar. Fruit can do the work.' },
         sweetener: '{s} it is.', cravings: '{c}. Noted.' },
  // The notebook's "What you've told me" (no content lines yet: stand-ins for the content editor to replace)
  told: { howSweet: { full: 'You like the full treat.', less: "You'd like a bit less sugar.", none: "You'd rather no added sugar." },
          sweeteners: "You'd sweeten with {s}." },
  swap: { title: 'Swap the sugar', rules: [] },
  done: 'Done',
};

/** The content editor's `sweet` block (gemma-lines.json), with the stand-ins under anything it doesn't have */
export function sweetData(lines = {}) {
  const s = lines.sweet || {}, D = DEFAULTS;
  const part = k => ({ ...D[k], ...(s[k] || {}), options: { ...D[k].options, ...(s[k]?.options || {}) } });
  return {
    howSweet: part('howSweet'), sweetenWith: part('sweetenWith'), cravings: part('cravings'), occasions: part('occasions'),
    ack: { ...D.ack, ...(s.ack || {}), howSweet: { ...D.ack.howSweet, ...(s.ack?.howSweet || {}) } },
    told: { ...D.told, ...(s.told || {}), howSweet: { ...D.told.howSweet, ...(s.told?.howSweet || {}) } },
    swap: { title: s.swap?.title || D.swap.title, rules: Array.isArray(s.swap?.rules) ? s.swap.rules : D.swap.rules },
    done: s.done || D.done,
  };
}

/** The swap-the-sugar lines for a recipe and what the visitor told Gemma: the recipe's own sweetener (`from`) to the ones
 *  they picked (`to`), or "none" when they'd rather no added sugar. Only recipes with added sugar; nothing if one of their
 *  picks is the recipe's own. At most two lines. */
export function swapLines(D, rec, { sweetness = null, sweeteners = [] } = {}) {
  if (!rec?.added_sugar || !rec.sweetener || !sweetness || sweetness === 'full') return [];
  const picks = [].concat(sweeteners || []);
  if (picks.includes(rec.sweetener)) return [];
  const wants = sweetness === 'none' && !picks.length ? ['none'] : picks;
  const out = [];
  for (const to of wants) {
    const r = D.swap.rules.find(x => x.to === to && x.from === rec.sweetener) || D.swap.rules.find(x => x.to === to && x.from === '*');
    if (r && !out.includes(r.line)) out.push(r.line);
  }
  return out.slice(0, 2);
}

/** What an occasion suggests, only where the check-in hasn't answered: { servings, time } in the check-in's own values, or null */
export function occasionSuggest(D, id, { servings = null, time = null } = {}) {
  const o = D.occasions.options[id];
  if (!o) return { servings: null, time: null };
  const n = Number(o.servings);
  return {
    servings: !servings && n > 0 ? (n <= 6 ? String(n) : 'crowd') : null,
    time: !time && TIME_KEY[o.time] ? TIME_KEY[o.time] : null,
  };
}

/** The navigator's Sweet Spells steer: the cravings (themes of the same names) and "no added sugar" (a soft penalty) */
export function sweetSteer(visit) {
  return { cravingThemes: [].concat(visit.dish(ROOM, 'cravings') || []), cravingRoom: ROOM, noAddedSugar: visit.get('sweetness') === 'none' };
}

/** The notebook's told lines for the two about-you answers */
export function sweetTold(D) {
  return {
    sweetness: v => D.told.howSweet[v] || '',
    sweeteners: v => ([].concat(v || []).length ? D.told.sweeteners.replace('{s}', listOf([].concat(v).map(x => (D.sweetenWith.options[x] || x).toLowerCase()))) : ''),
  };
}

/** The tags in Gemma's chat for the two about-you answers (tags.js `extra`): a tap opens the cabinet's sheet */
export function sweetTags(D, open) {
  return {
    sweetness: { icon: '🍯', name: 'How sweet', word: v => (D.howSweet.options[v] || '').toLowerCase(), open: () => open('sweet', 'tag') },
    sweeteners: { icon: '🍯', name: 'Sweeten with', word: v => [].concat(v || []).map(x => (D.sweetenWith.options[x] || x).toLowerCase()).join(', '),
                  open: () => open('sweet', 'tag') },
  };
}

const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');

/** answer(key, value): the check-in's setter where it's in (setAnswer), else the store; used only for an occasion's suggestion */
export function createSweetSheets({ visit, lines = {}, track, sound, beforeOpen, say, answer }) {
  const D = sweetData(lines);
  const root = document.createElement('div');
  root.id = 'sweet-sheet';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'sw-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box">
      <header class="tl-head"><h2 id="sw-title"></h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body"></div>
      <footer class="tl-foot"><span></span><button class="tl-done sw-done">${esc(D.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const body = $('.tl-body');
  let kind = null, from = null, draft = {}, opener = null, pushed = false;

  const chips = (group, opts, on, multi) => `<div class="tl-chips tl-pick" role="group" aria-label="${esc(group)}">${Object.entries(opts).map(([id, o], i) =>
    `<button data-v="${esc(id)}" data-i="${i}" aria-pressed="${multi ? on.includes(id) : on === id}">${esc(typeof o === 'string' ? o : o.label)}</button>`).join('')}</div>`;

  function draw() {
    if (kind === 'sweet') {
      $('#sw-title').textContent = D.howSweet.title;
      const more = draft.sweetness === 'less' || draft.sweetness === 'none';
      body.innerHTML = `<div class="sw-how">${chips(D.howSweet.title, D.howSweet.options, draft.sweetness, false)}</div>
        ${more ? `<h3 class="tl-h">${esc(D.sweetenWith.title)}</h3>${D.sweetenWith.helper ? `<p class="small">${esc(D.sweetenWith.helper)}</p>` : ''}
        <div class="sw-with">${chips(D.sweetenWith.title, D.sweetenWith.options, draft.sweeteners, true)}</div>` : ''}`;
      body.querySelectorAll('.sw-how [data-v]').forEach(b => b.onclick = () => {
        const v = b.dataset.v;
        draft.sweetness = draft.sweetness === v ? null : v;          // tap again to unchoose
        if (draft.sweetness) sound?.answer?.('sweetness');
        redraw(`.sw-how [data-v="${CSS.escape(v)}"]`);
      });
      body.querySelectorAll('.sw-with [data-v]').forEach(b => b.onclick = () => {
        const v = b.dataset.v, on = draft.sweeteners.includes(v);
        draft.sweeteners = on ? draft.sweeteners.filter(x => x !== v) : [...draft.sweeteners, v];
        if (!on) sound?.answer?.('sweetener');
        redraw(`.sw-with [data-v="${CSS.escape(v)}"]`);
      });
    } else if (kind === 'cravings') {
      $('#sw-title').textContent = D.cravings.title;
      body.innerHTML = `${D.cravings.helper ? `<p class="small">${esc(D.cravings.helper)}</p>` : ''}${chips(D.cravings.title, D.cravings.options, draft.cravings, true)}`;
      body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
        const v = b.dataset.v, on = draft.cravings.includes(v);
        draft.cravings = on ? draft.cravings.filter(x => x !== v) : [...draft.cravings, v];
        if (!on) sound?.answer?.('craving', { index: +b.dataset.i });   // each jar its own note
        redraw(`[data-v="${CSS.escape(v)}"]`);
      });
    } else if (kind === 'occasion') {
      $('#sw-title').textContent = D.occasions.title;
      const o = D.occasions.options[draft.occasion];
      body.innerHTML = `${D.occasions.helper ? `<p class="small">${esc(D.occasions.helper)}</p>` : ''}${chips(D.occasions.title, D.occasions.options, draft.occasion, false)}
        ${o?.line ? `<p class="small sw-line" role="status">${esc(o.line)}</p>` : ''}`;
      body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
        const v = b.dataset.v;
        draft.occasion = draft.occasion === v ? null : v;
        if (draft.occasion) sound?.page?.();                          // a page turned in the Occasions book
        redraw(`[data-v="${CSS.escape(v)}"]`);
      });
    }
  }
  const redraw = sel => { draw(); body.querySelector(sel)?.focus({ preventScroll: true }); };

  // Every way out keeps the taps (Done, ✕, the dim, Escape, Back): these are one-tap answers, and a tap just off Done lands
  // on the dim (PM, live 19 Oct: the answer was lost)
  function done({ viaBack = false } = {}) {
    if (root.hidden) return;
    const k = kind;
    close({ viaBack });
    const later = f => setTimeout(f, reduce() ? 0 : 200);           // after the sheet has gone, so her line isn't hidden behind it
    if (k === 'sweet') {
      const sweetness = draft.sweetness || null;
      const sweeteners = sweetness === 'less' || sweetness === 'none' ? draft.sweeteners : [];
      const was = { s: visit.get('sweetness'), w: [].concat(visit.get('sweeteners') || []) };
      const sChanged = (was.s ?? null) !== sweetness, wChanged = JSON.stringify(was.w) !== JSON.stringify(sweeteners);
      if (sChanged) { visit.set('sweetness', sweetness); track?.('tell_set', { kind: 'sweetness', from }); }
      if (wChanged) { visit.set('sweeteners', sweeteners.length ? sweeteners : null); track?.('tell_set', { kind: 'sweetener', count: bucket(sweeteners.length), from }); }
      const line = sChanged && sweetness ? D.ack.howSweet[sweetness]
        : wChanged && sweeteners.length ? D.ack.sweetener.replace('{s}', capFirst(listOf(sweeteners.slice(0, 2).map(x => D.sweetenWith.options[x].toLowerCase())))) : '';
      if (line) later(() => say?.(line));
    } else if (k === 'cravings') {
      const was = [].concat(visit.dish(ROOM, 'cravings') || []);
      if (JSON.stringify(was) === JSON.stringify(draft.cravings)) return;
      visit.setDish(ROOM, 'cravings', draft.cravings.length ? draft.cravings : null);
      track?.('tell_set', { kind: 'craving', count: bucket(draft.cravings.length), from });
      if (draft.cravings.length) later(() => say?.(D.ack.cravings.replace('{c}', capFirst(listOf(draft.cravings.slice(0, 2).map(x => D.cravings.options[x].toLowerCase()))))));
    } else if (k === 'occasion') {
      if ((visit.dish(ROOM, 'occasion') ?? null) === (draft.occasion ?? null)) return;
      visit.setDish(ROOM, 'occasion', draft.occasion || null);
      track?.('tell_set', { kind: 'occasion', from });
      if (!draft.occasion) return;
      // The check-in always wins: suggest only what it hasn't answered
      const sug = occasionSuggest(D, draft.occasion, { servings: visit.get('servings'), time: visit.get('time') });
      if (sug.servings) answer?.('servings', sug.servings);
      if (sug.time) answer?.('time', sug.time);
      const n = Number(D.occasions.options[draft.occasion].servings);
      const line = sug.servings && n > 1 ? D.occasions.suggest.replace('{n}', capFirst(NUM[n] || String(n))) : D.occasions.options[draft.occasion].line;
      later(() => say?.(line));
    }
  }

  /** open('sweet' | 'cravings' | 'occasion', from: object | tag | book) */
  function open(k, src = 'object') {
    opener = document.activeElement;
    beforeOpen?.();
    kind = k; from = src;
    draft = { sweetness: visit.get('sweetness'), sweeteners: [].concat(visit.get('sweeteners') || []),
              cravings: [].concat(visit.dish(ROOM, 'cravings') || []), occasion: visit.dish(ROOM, 'occasion') };
    root.hidden = false;
    root.className = `tell ${mode()} sw-${k}`;
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.sweetInert = '1'; }
    draw();
    if (!pushed) { history.pushState({ ...(history.state || {}), sweet: true }, ''); pushed = true; }
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    if (k === 'occasion') sound?.page?.();
    track?.('tell_open', { kind: { sweet: 'sweetness', cravings: 'craving', occasion: 'occasion' }[k], from: src });
    (body.querySelector('[aria-pressed="true"]') || body.querySelector('button') || $('.tl-x')).focus({ preventScroll: true });
  }
  function close({ viaBack = false } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    for (const el of document.body.children) if (el.dataset.sweetInert) { el.inert = false; delete el.dataset.sweetInert; }
    if (pushed) { pushed = false; if (!viaBack && history.state?.sweet) history.back(); }
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  $('.sw-done').onclick = () => done();
  $('.tl-x').onclick = () => done();
  $('.tl-dim').onclick = () => done();
  addEventListener('popstate', () => { if (pushed && !history.state?.sweet) { pushed = false; done({ viaBack: true }); } });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return done(); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell ${mode()} sw-${kind}`; });

  return { open, close, data: D, get isOpen() { return !root.hidden; } };
}
