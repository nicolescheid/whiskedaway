// The Chiapothecary (rooms-views.md, Stage A): the flasks open the moods, and "Mix an experiment" opens one sheet, one step per screen
// (mood → base → flavour → topping), then Gemma writes the jar out. The fridge opens it at the base and the drawers at the flavour,
// so a choice made at any of them is the same answer (visit.dish('chiapothecary') { mood, base, flavour, topping }).
// Gemma's swaps are a fixed, content-owned table, checked on every tap: one inline line with [Swap to X] [Keep mine], never a
// popup and never blocking Next. Moods say what's in them, never what they do (no health claims).
// Words and lists come from gemma-lines.json `chia` (content editor); these stand in until then.

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const ROOM = 'chiapothecary';
export const STEPS = ['mood', 'base', 'flavour', 'topping'];

const DEFAULTS = {
  moods: {
    'morning-spark': { label: 'Morning spark', inIt: 'Brings matcha, mango and a little ginger.', themes: ['energising', 'breakfast', 'green'], suggest: { flavour: 'matcha' } },
    'deep-focus': { label: 'Deep focus', inIt: 'Brings walnuts, blueberries and cacao.', themes: ['focus', 'crunchy', 'protein'], suggest: { flavour: 'berry', topping: 'nuts' } },
    calm: { label: 'Calm', inIt: 'Brings warm vanilla, cinnamon and a drizzle of honey.', themes: ['calming', 'evening', 'rest'], suggest: { flavour: 'vanilla' } },
    cultured: { label: 'Cultured', inIt: 'Brings kefir or yoghurt, kiwifruit and oats.', themes: ['protein', 'breakfast'], suggest: { base: 'yoghurt' } },
    bright: { label: 'Bright', inIt: 'Brings citrus, berries and kiwifruit.', themes: ['vitamins', 'citrus', 'fruity'], suggest: { flavour: 'lemon' } },
    'by-flavour': { label: 'By flavour', inIt: 'Just what tastes good to you.', themes: ['indulgent', 'creamy'] },
  },
  bases: { milk: 'Milk', oat: 'Oat milk', coconut: 'Coconut milk', almond: 'Almond milk', soy: 'Soy milk', yoghurt: 'Yoghurt' },
  flavours: { vanilla: 'Vanilla', cacao: 'Cacao', berry: 'Berries', mango: 'Mango', matcha: 'Matcha', cinnamon: 'Cinnamon', lemon: 'Lemon', peanut: 'Peanut butter' },
  toppings: { fruit: 'Fresh fruit', granola: 'Granola', nuts: 'Nuts and seeds', coconut: 'Coconut flakes', nibs: 'Cacao nibs', drizzle: 'A drizzle of honey' },
  swaps: [
    { when: { base: 'milk', flavour: 'lemon' }, swap: { step: 'base', to: 'coconut' }, line: 'Lemon can split dairy milk overnight. Would you consider coconut milk instead?' },
    { when: { mood: 'calm', flavour: 'matcha' }, swap: { step: 'flavour', to: 'vanilla' }, line: 'Matcha is quite lively for a calm jar. Would you consider vanilla instead?' },
    { when: { mood: 'cultured', base: 'oat' }, swap: { step: 'base', to: 'yoghurt' }, line: 'A cultured jar wants something cultured. Would you consider yoghurt instead of oat milk?' },
    { when: { flavour: 'cacao', topping: 'nibs' }, swap: { step: 'topping', to: 'fruit' }, line: 'Cacao twice is a lot of cacao. Would you consider fresh fruit on top instead?' },
  ],
  lines: {
    moodTitle: 'Pick a mood', mixTitle: 'Mix an experiment', names: { mood: 'Mood', base: 'Base', flavour: 'Flavour', topping: 'On top' },
    steps: { mood: 'What mood is it?', base: 'What shall we set it in?', flavour: 'And the flavour?', topping: 'Something on top?' },
    swapYes: 'Swap to {x}', swapNo: 'Keep mine', swapLine: 'Would you try {x} instead of {y}? {reason}', back: '‹ Back', next: 'Next ›', skip: 'Skip', write: 'Write it out',
    cap: 'That uses one of your 3 write-outs this visit.', capNone: "I've written three out this visit, so that's my pen done. Your choices are kept.",
    writing: "Gemma's writing it out…", failed: "My pen's run dry. Your choices are kept, so try again in a bit.",
    summary: 'Your jar', moodAck: "{x}. I'll lean that way.", written: "Here's your jar. Keep it if you like it.",
    breakfast: 'Ready by breakfast?', breakfastLine: "Set it tonight and it'll be ready by 7.", jars: 'Make 4 jars', jarsLine: "Four jars, then. I've scaled your list.",
  },
};

/** The content editor's `chia` block (gemma-lines.json: moods.options, mix.steps.*.options, swap.rules, ack, breakfast, jars),
 *  read into one shape; the stand-ins fill anything it doesn't have */
export function chiaData(lines = {}) {
  const c = lines.chia || {}, m = c.mix || {}, sw = c.swap || {}, L = DEFAULTS.lines;
  const opts = list => (Array.isArray(list) && list.length ? Object.fromEntries(list.map(o => [o.id, o.label])) : null);
  const D = {
    moods: Array.isArray(c.moods?.options)
      ? Object.fromEntries(c.moods.options.map(o => [o.id, { label: o.label, inIt: o.inside || '', themes: o.themes || [], suggest: o.suggest }]))
      : DEFAULTS.moods,
    bases: opts(m.steps?.base?.options) || DEFAULTS.bases,
    flavours: opts(m.steps?.flavour?.options) || DEFAULTS.flavours,
    toppings: opts(m.steps?.topping?.options) || DEFAULTS.toppings,
  };
  const low = t => String(t || '').toLowerCase();
  const name = (step, id) => (step === 'mood' ? D.moods[id]?.label : D[`${step}s`]?.[id]) || id;
  // A rule's line: "Would you try {x} instead of {y}? {reason}", or the reason alone for a note (swap null)
  D.swaps = Array.isArray(sw.rules)
    ? sw.rules.map(r => ({ when: r.when || {}, swap: r.swap || null,
      line: r.swap ? (sw.line || L.swapLine).replace('{x}', low(name(r.swap.step, r.swap.to))).replace('{y}', low(name(r.swap.step, (r.when || {})[r.swap.step])))
        .replace('{reason}', r.reason || '').trim() : r.reason || '' }))
    : DEFAULTS.swaps;
  D.lines = { ...L,
    moodTitle: c.moods?.title || L.moodTitle, moodHelper: c.moods?.helper || '', mixTitle: m.title || L.mixTitle, intro: m.intro || '', prefill: m.prefill || '',
    steps: { mood: m.steps?.mood?.title || L.steps.mood, base: m.steps?.base?.title || L.steps.base, flavour: m.steps?.flavour?.title || L.steps.flavour,
             topping: m.steps?.topping?.title || L.steps.topping },
    next: m.next ? `${m.next} ›` : L.next, back: m.back ? `‹ ${m.back}` : L.back, write: m.write || L.write,
    cap: m.cap || L.cap, writing: m.done || L.writing, swapYes: sw.yes || L.swapYes, swapNo: sw.no || L.swapNo,
    moodAck: c.ack?.mood || L.moodAck, swapped: c.ack?.swapped || '', kept: c.ack?.kept || '',
    breakfast: c.breakfast?.label || L.breakfast, breakfastLine: c.breakfast?.line || L.breakfastLine,
    jars: c.jars?.label || L.jars, jarsLine: c.jars?.line || L.jarsLine };
  return D;
}
/** The first swap whose `when` all match the choices so far and the visitor hasn't turned down; null if none */
export function swapFor(data, draft, declined = new Set()) {
  return (data.swaps || []).map((r, i) => ({ ...r, i })).find(r => !declined.has(r.i) && (!r.swap || draft[r.swap.step] !== r.swap.to)
    && Object.keys(r.when || {}).length && Object.entries(r.when).every(([k, v]) => draft[k] === v)) || null;
}
const optionsFor = (D, step) => (step === 'mood' ? Object.fromEntries(Object.entries(D.moods).map(([id, m]) => [id, m.label])) : D[`${step}s`] || {});
export const labelOf = (D, step, id) => (id ? optionsFor(D, step)[id] || id : '');

/** A recipe card for a mix, written out like any idea (writeout.js) and opened as a loose book page */
export function mixRecipe(D, d) {
  const L = s => labelOf(D, s, d[s]);
  const mood = d.mood && d.mood !== 'by-flavour' ? D.moods[d.mood] : null;
  const title = `${mood ? mood.label : L('flavour') || 'Your'} chia jar`.replace(/^Your chia jar$/, 'Your chia jar');
  const bits = [L('base'), L('flavour'), L('topping')].filter(Boolean).map(x => x.toLowerCase());
  return {
    id: `mix-${STEPS.map(s => d[s] || 'x').join('-')}`, room: ROOM, kind: 'chia experiment', title, short: title,
    hook: bits.length ? `Chia set in ${bits[0]}${bits.length > 1 ? `, with ${bits.slice(1).join(' and ')}` : ''}.` : 'A chia jar of your own.',
    key_ingredients: ['chia seeds', ...bits], body: 'Stir the chia into the base with the flavour, leave it in the fridge overnight, then top it and eat.',
    method_short: 'Stir the chia into the base with the flavour, leave it in the fridge overnight, then top it and eat.',
    themes: [...(mood?.themes || []), 'overnight', 'no-cook'], spoons: 0, time: 5, wait: 'overnight', why: mood ? mood.inIt : '',
    seed: { name: title, ingredients: ['chia seeds', ...bits] },
    mix: { ...Object.fromEntries(STEPS.filter(s => d[s]).map(s => [s, L(s)])), ...(mood?.inIt ? { inside: mood.inIt } : {}) },
  };
}

export function createChiaMix({ visit, lines = {}, writer, track, sound, beforeOpen, say, onStart, onWritten }) {
  const D = chiaData(lines), T = D.lines;
  const root = document.createElement('div');
  root.id = 'chia-mix';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'mx-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box mx-box">
      <header class="tl-head"><h2 id="mx-title"></h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body"></div>
      <footer class="tl-foot mx-foot"></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const body = $('.tl-body'), foot = $('.mx-foot');
  let kind = null, from = null, at = 0, draft = {}, declined = new Set(), writing = false, failed = false, opener = null, pushed = false, then = null, reply = '', prefilled = false;

  const save = (step, v) => { visit.setDish(ROOM, step, v ?? null); };
  const chips = step => {
    const opts = optionsFor(D, step);
    if (step === 'mood') {
      return `<ul class="mx-moods" role="group" aria-label="${esc(T.steps.mood)}">${Object.entries(D.moods).map(([id, m]) =>
        `<li><button data-s="mood" data-v="${esc(id)}" aria-pressed="${draft.mood === id}" aria-label="${esc(m.label)}. ${esc(m.inIt || '')}"><b>${esc(m.label)}</b><span>${esc(m.inIt || '')}</span></button></li>`).join('')}</ul>`;
    }
    return `<div class="tl-chips tl-pick" role="group" aria-label="${esc(T.steps[step])}">${Object.entries(opts).map(([id, label]) =>
      `<button data-s="${step}" data-v="${esc(id)}" aria-pressed="${draft[step] === id}">${esc(label)}</button>`).join('')}</div>`;
  };
  // Gemma's swap: an inline line under the choices, on whichever step it shows, never in the way of Next
  const swapHtml = () => {
    const r = swapFor(D, draft, declined);
    if (!r) return reply ? `<p class="small mx-reply" role="status">${esc(reply)}</p>` : '';
    if (!r.swap) return `<div class="ck-offer mx-swap mx-note" role="status"><p>${esc(r.line)}</p></div>`;   // a note: nothing to choose
    return `<div class="ck-offer mx-swap" role="status"><p>${esc(r.line)}</p><p><button class="bk-cook" data-swap="${r.i}">${esc(T.swapYes.replace('{x}', labelOf(D, r.swap.step, r.swap.to).toLowerCase()))}</button>
      <button class="bk-outline" data-keep="${r.i}">${esc(T.swapNo)}</button></p></div>`;
  };

  function draw() {
    if (kind === 'mood') {
      $('#mx-title').textContent = T.moodTitle;
      body.innerHTML = `${T.moodHelper ? `<p class="small">${esc(T.moodHelper)}</p>` : ''}${chips('mood')}`;
      foot.innerHTML = `<button class="tl-done mx-done">Done</button>`;
    } else if (at < STEPS.length) {
      const step = STEPS[at];
      $('#mx-title').textContent = T.mixTitle;
      body.innerHTML = `<p class="mx-dots" aria-label="Step ${at + 1} of ${STEPS.length + 1}">${[...STEPS, 'write'].map((_, i) => `<i class="${i === at ? 'on' : i < at ? 'done' : ''}"></i>`).join('')}</p>
        ${at === 0 && T.intro ? `<p class="small">${esc(T.intro)}</p>` : ''}${at === 0 && prefilled && T.prefill ? `<p class="small">${esc(T.prefill)}</p>` : ''}
        <h3 class="tl-h">${esc(T.steps[step])}</h3>${chips(step)}${swapHtml()}`;
      foot.innerHTML = `<button class="bk-outline mx-back" ${at ? '' : 'hidden'}>${esc(T.back)}</button><button class="tl-done mx-next">${esc(draft[step] ? T.next : T.skip)}</button>`;
    } else {
      $('#mx-title').textContent = T.mixTitle;
      const left = writer?.left ?? 0;
      const rows = STEPS.filter(s => draft[s]).map(s => `<li><span>${esc(T.names?.[s] || s)}</span> <b>${esc(labelOf(D, s, draft[s]))}</b></li>`).join('');
      body.innerHTML = `<p class="mx-dots">${[...STEPS, 'write'].map((_, i) => `<i class="${i === at ? 'on' : 'done'}"></i>`).join('')}</p>
        <h3 class="tl-h">${esc(T.summary)}</h3><ul class="mx-sum">${rows}</ul>${swapHtml()}
        ${writing ? `<div class="ck-offer"><p>${esc(T.writing)} <span class="dots" aria-hidden="true">• • •</span></p></div>`
          : failed ? `<p class="small">${esc(T.failed)}</p>` : `<p class="small">${esc(left > 0 ? T.cap.replace('{n}', left) : T.capNone)}</p>`}`;
      foot.innerHTML = `<button class="bk-outline mx-back">${esc(T.back)}</button>${left > 0 && !writing ? `<button class="tl-done mx-write">${esc(T.write)}</button>` : ''}`;
    }
    body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const s = b.dataset.s, v = b.dataset.v;
      draft[s] = draft[s] === v ? null : v;                       // tap again to unchoose
      reply = '';
      if (kind === 'mix') save(s, draft[s]);
      if (draft[s]) { if (s === 'mood') sound?.answer?.('mood'); else sound?.mix?.(s); }   // clink and cork; the potion sounds
      // A mood suggests the rest, where nothing's chosen yet
      if (s === 'mood' && draft.mood && kind === 'mix') for (const [k, x] of Object.entries(D.moods[draft.mood]?.suggest || {})) if (!draft[k]) { draft[k] = x; save(k, x); }
      draw();
      body.querySelector(`[data-s="${s}"][data-v="${CSS.escape(v)}"]`)?.focus({ preventScroll: true });
    });
    body.querySelector('[data-swap]')?.addEventListener('click', e => {
      const r = D.swaps[+e.currentTarget.dataset.swap];
      draft[r.swap.step] = r.swap.to; save(r.swap.step, r.swap.to);
      reply = T.swapped;
      track?.('mix_swap', { outcome: 'accepted' });
      draw();
    });
    body.querySelector('[data-keep]')?.addEventListener('click', e => {
      declined.add(+e.currentTarget.dataset.keep);
      reply = T.kept;
      track?.('mix_swap', { outcome: 'declined' });
      draw();
    });
    foot.querySelector('.mx-back')?.addEventListener('click', () => { at = Math.max(0, at - 1); failed = false; draw(); });
    foot.querySelector('.mx-next')?.addEventListener('click', () => { at += 1; draw(); foot.querySelector('.mx-next, .mx-write')?.focus({ preventScroll: true }); });
    foot.querySelector('.mx-write')?.addEventListener('click', write);
    foot.querySelector('.mx-done')?.addEventListener('click', doneMood);
  }

  function doneMood() {
    const before = visit.dish(ROOM, 'mood');
    close();
    if ((before ?? null) === (draft.mood ?? null)) return;
    save('mood', draft.mood);
    track?.('tell_set', { kind: 'mood', from });
    if (draft.mood) setTimeout(() => say?.(T.moodAck.replace(/\{[xm]\}/, D.moods[draft.mood].label)), reduce() ? 0 : 200);
  }
  async function write() {
    const rec = mixRecipe(D, draft);
    writing = true; failed = false; draw();
    track?.('tell_set', { kind: 'mix', from });
    onStart?.(rec);                                           // the page knows the jar before the write-out lands (its notebook line)
    const full = await writer.writeNow(rec);
    writing = false;
    if (!full) { failed = true; return draw(); }
    sound?.mix?.('done');
    // The book opens once this sheet's history step has gone, or its own would be popped with it
    close({ silent: true, after: () => onWritten?.(rec, full) });
  }

  /** open('mood') for the flasks; open('mix', { step }) for Mix an experiment (the fridge opens at 'base', the drawers at 'flavour') */
  function open(k, { step = null, src = 'object' } = {}) {
    opener = document.activeElement;
    beforeOpen?.();
    kind = k; from = src; writing = false; failed = false;
    draft = { ...visit.dish(ROOM) };
    prefilled = !!(draft.base || draft.flavour || draft.topping);   // from the fridge, the drawers or an earlier mix
    reply = '';
    at = step ? Math.max(0, STEPS.indexOf(step)) : 0;
    root.hidden = false;
    root.className = `tell ${mode()} mx-${k}`;
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.mixInert = '1'; }
    draw();
    if (!pushed) { history.pushState({ ...(history.state || {}), mix: true }, ''); pushed = true; }
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    track?.('tell_open', { kind: k, from: src });
    (body.querySelector('[aria-pressed="true"]') || body.querySelector('button') || $('.tl-x')).focus({ preventScroll: true });
  }
  function close({ silent = false, viaBack = false, after = null } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    for (const el of document.body.children) if (el.dataset.mixInert) { el.inert = false; delete el.dataset.mixInert; }
    if (pushed) {
      pushed = false;
      if (!viaBack && history.state?.mix) { then = after; after = null; history.back(); }
    }
    if (!silent && opener?.isConnected) opener.focus({ preventScroll: true });
    after?.();
  }
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();
  addEventListener('popstate', () => {
    if (then) { const f = then; then = null; return f(); }
    if (pushed && !history.state?.mix) { pushed = false; close({ viaBack: true }); }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell ${mode()} mx-${kind}`; });

  return { open, close, data: D, get isOpen() { return !root.hidden; } };
}
