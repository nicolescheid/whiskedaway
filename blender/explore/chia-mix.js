// The Chiapothecary (rooms-views.md, Stage A): the flasks open the moods, and "Mix an experiment" opens one sheet, one step per screen
// (mood → base → flavour → topping), then Gemma writes the jar out. The fridge opens it at the base and the drawers at the flavour,
// so a choice made at any of them is the same answer (visit.dish('chiapothecary') { mood, base, flavour, topping }).
// Gemma's swaps are a fixed, content-owned table, checked on every tap: one inline line with [Swap to X] [Keep mine], never a
// popup and never blocking Next. Moods say what's in them, never what they do (no health claims).
// Words and lists come from gemma-lines.json `chia` (content editor); these stand in until then.
// A bigger jar (appliances-chia-plan.md §2): the Mix starts with "How big a jar?". Keep it simple is the flow above; A real mix
// swaps the one topping for add-ins in groups (chia.addins), any number, with Gemma's line at the soft cap (never a block).
// Drawer taps add to the add-ins rather than replacing the choice. The add-ins have their own swap rules (chia.addinSwaps).

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const ROOM = 'chiapothecary';
export const STEPS = ['mood', 'base', 'flavour', 'topping'];
export const REAL_STEPS = ['mood', 'base', 'flavour', 'addins'];
/** The Mix's screens for this draft: the jar size first, then the simple or the real mix's steps */
export const stepsFor = d => ['mode', ...(d.mode === 'real' ? REAL_STEPS : STEPS)];

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
  seeds: { black: 'Black chia', white: 'White chia' },        // set by the two chia drawers, not a step of its own
  toppings: { fruit: 'Fresh fruit', granola: 'Granola', nuts: 'Nuts and seeds', coconut: 'Coconut flakes', nibs: 'Cacao nibs', drizzle: 'A drizzle of honey' },
  swaps: [
    { when: { base: 'milk', flavour: 'lemon' }, swap: { step: 'base', to: 'coconut' }, line: 'Lemon can split dairy milk overnight. Would you consider coconut milk instead?' },
    { when: { mood: 'calm', flavour: 'matcha' }, swap: { step: 'flavour', to: 'vanilla' }, line: 'Matcha is quite lively for a calm jar. Would you consider vanilla instead?' },
    { when: { mood: 'cultured', base: 'oat' }, swap: { step: 'base', to: 'yoghurt' }, line: 'A cultured jar wants something cultured. Would you consider yoghurt instead of oat milk?' },
    { when: { flavour: 'cacao', topping: 'nibs' }, swap: { step: 'topping', to: 'fruit' }, line: 'Cacao twice is a lot of cacao. Would you consider fresh fruit on top instead?' },
  ],
  lines: {
    moodTitle: 'Pick a mood', mixTitle: 'Mix an experiment', names: { mood: 'Mood', base: 'Base', flavour: 'Flavour', topping: 'On top', seed: 'Chia' },
    steps: { mood: 'What mood is it?', base: 'What shall we set it in?', flavour: 'And the flavour?', topping: 'Something on top?' },
    swapYes: 'Swap to {x}', swapNo: 'Keep mine', swapLine: 'Would you try {x} instead of {y}? {reason}', back: '‹ Back', next: 'Next ›', skip: 'Skip', write: 'Get my recipe',
    cap: 'Gemma writes it for you (3 free a day, {n} left today).', capNone: "I've written three today, so that's my pen done. Your choices are kept.",
    writing: "Gemma's writing your recipe…", failed: "My pen's run dry. Your choices are kept, so try again in a bit.",
    summary: 'Your jar', moodAck: "{x}. I'll lean that way.", written: "Here's your jar. Keep it if you like it.",
    breakfast: 'Ready by breakfast?', breakfastLine: "Set it tonight and it'll be ready by 7.", jars: 'Make 4 jars', jarsLine: "Four jars, then. I've scaled your list.",
  },
};

/** The content editor's `chia` block (gemma-lines.json: moods.options, mix.steps.*.options, swap.rules, ack, breakfast, jars),
 *  read into one shape; the stand-ins fill anything it doesn't have */
export function chiaData(lines = {}) {
  const c = lines.chia || {}, m = c.mix || {}, sw = c.swap || {}, L = DEFAULTS.lines;
  // The reshaped block (content/chia-mix-reshape): already this module's own shape, keyed by id
  if (c.moods && !Array.isArray(c.moods.options) && !c.mix) {
    const cl = c.lines || {};
    return { moods: c.moods, bases: c.bases || DEFAULTS.bases, flavours: c.flavours || DEFAULTS.flavours, toppings: c.toppings || DEFAULTS.toppings, seeds: c.seeds || DEFAULTS.seeds,
      fromDrawers: c.fromDrawers || {}, swaps: [...(Array.isArray(c.swaps) ? c.swaps : DEFAULTS.swaps), ...(c.addinSwaps?.rules || [])],
      ...addinData(c),
      lines: { ...L, ...cl, intro: cl.mixIntro ?? cl.intro ?? '', steps: { ...L.steps, ...(cl.steps || {}) }, names: { ...L.names, ...(cl.names || {}) } } };
  }
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
  Object.assign(D, addinData(c));
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
/** chia.modes and chia.addins: the groups, each add-in by id ({ id, label, group, when, note, thirsty, clash, check }), the soft cap */
function addinData(c = {}) {
  const groups = (c.addins?.groups || []).map(g => ({ id: g.id, label: g.label, items: (g.items || []).map(x => x.id) }));
  const addins = {};
  for (const g of c.addins?.groups || []) for (const x of g.items || []) addins[x.id] = { ...x, group: g.id };
  return { groups, addins, softCap: Number(c.modes?.soft_cap) || 6, modes: c.modes || {} };
}
// A real mix's add-ins only count in a real mix: a simple jar keeps them in the store but out of its rules and its recipe
const addinsOf = d => (d.mode === 'real' ? [].concat(d.addins || []).filter(id => id !== d.flavour) : []);
/** Whether one rule's `when` matches: single choices (mood, base, flavour, topping) by value; `addins` every id listed is picked;
 *  `group` + `atLeast` that many picked from one group */
export function whenMatches(data, when = {}, draft = {}) {
  const picked = addinsOf(draft);
  const keys = Object.keys(when);
  if (!keys.length) return false;
  return keys.every(k => {
    if (k === 'addins') return [].concat(when.addins).every(id => picked.includes(id));
    if (k === 'group') return picked.filter(id => data.addins?.[id]?.group === when.group).length >= (Number(when.atLeast) || 1);
    if (k === 'atLeast') return 'group' in when;
    return draft[k] === when[k];
  });
}
/** The first swap whose `when` all match the choices so far and the visitor hasn't turned down; null if none. A swap that's
 *  already made (its step at `to`, or the add-in it removes gone) doesn't show again */
export function swapFor(data, draft, declined = new Set()) {
  const done = sw => (sw.step === 'addins' ? !addinsOf(draft).includes(sw.remove) : draft[sw.step] === sw.to);
  return (data.swaps || []).map((r, i) => ({ ...r, i })).find(r => !declined.has(r.i) && (!r.swap || !done(r.swap)) && whenMatches(data, r.when, draft)) || null;
}
/** One add-in tapped: in, or out again; returns the new list (never capped: the soft cap is Gemma's line) */
export const toggleAddin = (list, id) => ([].concat(list || []).includes(id) ? [].concat(list).filter(x => x !== id) : [...[].concat(list || []), id]);
/** Gemma's line at the soft cap: softCap on reaching it, softCapMore two past it; '' otherwise */
export function capLine(data, n) {
  const cap = data.softCap || 6, L = data.lines || {};
  return n === cap ? L.softCap || "That's a proper jar." : n === cap + 2 ? L.softCapMore || "That's a very full jar. I'd stop here." : '';
}
const listWords = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`).toLowerCase().replace(/^./, c => c.toUpperCase());
// "Berries go in", "Rolled oats drink up liquid": a plural label (ends in a single s) takes the plural verb in a content line
const PLURAL_VERBS = [[/\bgoes\b/, 'go'], [/\bis\b/, 'are'], [/\bdrinks\b/, 'drink'], [/\bsoaks\b/, 'soak']];
export const agree = (line, label) => (/[^s]s$/i.test(String(label).trim()) ? PLURAL_VERBS.reduce((t, [re, v]) => t.replace(re, v), line) : line);
const optionsFor = (D, step) => (step === 'mood' ? Object.fromEntries(Object.entries(D.moods).map(([id, m]) => [id, m.label])) : D[`${step}s`] || {});
export const labelOf = (D, step, id) => (id ? optionsFor(D, step)[id] || id : '');

/** A recipe card for a mix, written out like any idea (writeout.js) and opened as a loose book page */
export function mixRecipe(D, d) {
  const L = s => labelOf(D, s, d[s]);
  const mood = d.mood && d.mood !== 'by-flavour' ? D.moods[d.mood] : null;
  const title = `${mood ? mood.label : L('flavour') || 'Your'} chia jar`.replace(/^Your chia jar$/, 'Your chia jar');
  const real = d.mode === 'real', adds = addinsOf(d).filter(id => D.addins?.[id]), A = id => D.addins[id].label;
  const bits = [L('base'), L('flavour'), real ? '' : L('topping'), ...adds.map(A)].filter(Boolean).map(x => x.toLowerCase());
  const chia = d.seed ? `${L('seed').toLowerCase()} seeds` : 'chia seeds';   // "black chia seeds", from a drawer
  return {
    id: `mix-${(real ? REAL_STEPS.slice(0, 3) : STEPS).map(s => d[s] || 'x').join('-')}${d.seed ? `-${d.seed}` : ''}${adds.length ? `-${[...adds].sort().join('-')}` : ''}`,
    room: ROOM, kind: 'chia experiment', title, short: title,
    hook: bits.length ? `Chia set in ${bits[0]}${bits.length > 1 ? `, with ${bits.length > 4 ? `${bits.slice(1, 3).join(', ')} and ${bits.length - 3} more` : bits.slice(1).join(' and ')}` : ''}.` : 'A chia jar of your own.',
    key_ingredients: [chia, ...bits], body: 'Stir the chia into the base with the flavour, leave it in the fridge overnight, then top it and eat.',
    method_short: 'Stir the chia into the base with the flavour, leave it in the fridge overnight, then top it and eat.',
    themes: [...(mood?.themes || []), 'overnight', 'no-cook'], spoons: 0, time: 5, wait: 'overnight', why: mood ? mood.inIt : '',
    seed: { name: title, ingredients: [chia, ...bits] },
    mix: { ...Object.fromEntries([...(real ? REAL_STEPS.slice(0, 3) : STEPS), 'seed'].filter(s => d[s]).map(s => [s, L(s)])), ...(mood?.inIt ? { inside: mood.inIt } : {}),
           ...(adds.length ? { addins: adds.map(A), top: adds.filter(id => D.addins[id].when === 'top').map(A), thirsty: adds.filter(id => D.addins[id].thirsty).map(A) } : {}) },
  };
}

export function createChiaMix({ visit, lines = {}, writer, track, sound, beforeOpen, say, onStart, onWritten, words = t => t, diets = () => [] }) {
  // words(text): the visitor's shopping words (shopwords.js) for what the sheet shows; the data keeps the written words
  const D = chiaData(lines), T = D.lines, w = t => words(String(t ?? ''));
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
  let kind = null, from = null, at = 0, draft = {}, declined = new Set(), writing = false, failed = false, opener = null, pushed = false, then = null, reply = '', prefilled = false, said = '';
  const steps = () => stepsFor(draft);

  const save = (step, v) => { visit.setDish(ROOM, step, v ?? null); };
  const chips = step => {
    const opts = optionsFor(D, step);
    if (step === 'mode') {                                       // How big a jar? Two big choices, like the moods
      const M = D.modes || {};
      const one = (id, label, sub) => `<li><button data-s="mode" data-v="${id}" aria-pressed="${draft.mode === id}" aria-label="${esc(label)}. ${esc(sub)}"><b>${esc(label)}</b><span>${esc(sub)}</span></button></li>`;
      return `<ul class="mx-moods mx-modes" role="group" aria-label="${esc(T.modeTitle || 'How big a jar?')}">${one('simple', M.simple?.label || T.modeSimple || 'Keep it simple', M.simple?.sub || T.modeSimpleSub || '')}${one('real', M.real?.label || T.modeReal || 'A real mix', M.real?.sub || T.modeRealSub || '')}</ul>`;
    }
    if (step === 'addins') {                                     // A real mix: every group, any number
      const on = [].concat(draft.addins || []);
      return D.groups.map(g => `<h4 class="mx-group">${esc(g.label)}</h4><div class="tl-chips tl-pick" role="group" aria-label="${esc(g.label)}">${g.items.map(id =>
        `<button data-a="${esc(id)}" aria-pressed="${on.includes(id)}">${esc(w(D.addins[id].label))}</button>`).join('')}</div>`).join('');
    }
    if (step === 'mood') {
      return `<ul class="mx-moods" role="group" aria-label="${esc(T.steps.mood)}">${Object.entries(D.moods).map(([id, m]) =>
        `<li><button data-s="mood" data-v="${esc(id)}" aria-pressed="${draft.mood === id}" aria-label="${esc(w(m.label))}. ${esc(w(m.inIt))}"><b>${esc(w(m.label))}</b><span>${esc(w(m.inIt))}</span></button></li>`).join('')}</ul>`;
    }
    return `<div class="tl-chips tl-pick" role="group" aria-label="${esc(T.steps[step])}">${Object.entries(opts).map(([id, label]) =>
      `<button data-s="${step}" data-v="${esc(id)}" aria-pressed="${draft[step] === id}">${esc(w(label))}</button>`).join('')}</div>`;
  };
  // Gemma's swap: an inline line under the choices, on whichever step it shows, never in the way of Next
  const swapHtml = () => {
    const r = swapFor(D, draft, declined);
    if (!r) return reply ? `<p class="small mx-reply" role="status">${esc(reply)}</p>` : '';
    if (!r.swap) return `<div class="ck-offer mx-swap mx-note" role="status"><p>${esc(w(r.line))}</p></div>`;   // a note: nothing to choose
    const yes = r.yes || T.swapYes.replace('{x}', (r.swap.step === 'addins' ? `no ${D.addins[r.swap.remove]?.label || r.swap.remove}` : labelOf(D, r.swap.step, r.swap.to)).toLowerCase());
    return `<div class="ck-offer mx-swap" role="status"><p>${esc(w(r.line))}</p><p><button class="bk-cook" data-swap="${r.i}">${esc(w(yes))}</button>
      <button class="bk-outline" data-keep="${r.i}">${esc(r.no || T.swapNo)}</button></p></div>`;
  };

  const jarRows = () => {
    const real = draft.mode === 'real', single = (real ? REAL_STEPS.slice(0, 3) : STEPS).concat('seed').filter(s => draft[s]);
    let html = single.map(s => `<li><span>${esc(T.names?.[s] || s)}</span> <b>${esc(w(labelOf(D, s, draft[s])))}</b></li>`).join('');
    if (!real) return `<ul class="mx-sum">${html}</ul>`;
    const adds = addinsOf(draft).filter(id => D.addins[id]), night = adds.filter(id => D.addins[id].when !== 'top'), top = adds.filter(id => D.addins[id].when === 'top');
    const list = (title, ids) => (ids.length ? `<li><span>${esc(title)}</span> <b>${esc(ids.map(id => w(D.addins[id].label)).join(', '))}</b></li>` : '');
    html += list(T.jarNight || 'In the jar overnight', night) + list(T.jarTop || 'On top when you eat', top);
    const thirsty = adds.filter(id => D.addins[id].thirsty).map(id => D.addins[id].label);
    return `<ul class="mx-sum">${html}</ul>${adds.length ? '' : `<p class="small">${esc(T.addinsNone || '')}</p>`}
      <p class="small">${esc(T.ratio || '')}${thirsty.length && T.thirsty ? ` ${esc(w(agree(T.thirsty, thirsty.length > 1 ? 'these' : thirsty[0]).replace('{x}', listWords(thirsty))))}` : ''}</p>`;
  };
  // An add-in that breaks a dietary need the visitor gave (clash), or depends on the product (check): one plain line
  const dietNote = id => {
    const x = D.addins[id], ds = [].concat(diets() || []);
    const clash = (x.clash || []).find(d => ds.includes(d)), check = (x.check || []).find(d => ds.includes(d));
    if (clash) return (T.addinClash || "{x} isn't {d}, so I'd leave it out.").replace('{x}', x.label).replace('{d}', clash.replace('-', ' '));
    if (check) return (T.addinCheck || 'Check the label on the {x} for {d}.').replace('{x}', x.label.toLowerCase()).replace('{d}', check.replace('-', ' '));
    return '';
  };
  function draw() {
    if (kind === 'mood') {
      $('#mx-title').textContent = T.moodTitle;
      body.innerHTML = `${T.moodHelper ? `<p class="small">${esc(T.moodHelper)}</p>` : ''}${chips('mood')}`;
      foot.innerHTML = `<button class="tl-done mx-done">Done</button>`;
    } else if (at < steps().length) {
      const S = steps(), step = S[at];
      const title = step === 'mode' ? T.modeTitle || D.modes?.title || 'How big a jar?' : step === 'addins' ? T.addinsTitle || 'What goes in the jar?' : T.steps[step];
      const chosen = step === 'addins' ? addinsOf(draft).length : draft[step];
      $('#mx-title').textContent = T.mixTitle;
      body.innerHTML = `<p class="mx-dots" aria-label="Step ${at + 1} of ${S.length + 1}">${[...S, 'write'].map((_, i) => `<i class="${i === at ? 'on' : i < at ? 'done' : ''}"></i>`).join('')}</p>
        ${at === 0 && T.intro ? `<p class="small">${esc(T.intro)}</p>` : ''}${at === 0 && prefilled && T.prefill ? `<p class="small">${esc(T.prefill)}</p>` : ''}
        <h3 class="tl-h">${esc(title)}</h3>${step === 'addins' && T.addinsHelper ? `<p class="small">${esc(T.addinsHelper)}</p>` : ''}
        ${step === 'addins' ? `<p class="small mx-said" role="status">${esc(w(said))}</p>${swapHtml()}` : ''}${chips(step)}${step === 'addins' ? '' : swapHtml()}`;
      foot.innerHTML = `<button class="bk-outline mx-back" ${at ? '' : 'hidden'}>${esc(T.back)}</button><button class="tl-done mx-next">${esc(chosen ? T.next : T.skip)}</button>`;
    } else {
      $('#mx-title').textContent = T.mixTitle;
      const left = writer?.left ?? 0;
      body.innerHTML = `<p class="mx-dots">${[...steps(), 'write'].map((_, i) => `<i class="${i === at ? 'on' : 'done'}"></i>`).join('')}</p>
        <h3 class="tl-h">${esc(T.summary)}</h3>${jarRows()}${swapHtml()}
        ${writing ? `<div class="ck-offer"><p>${esc(T.writing)} <span class="dots" aria-hidden="true">• • •</span></p></div>`
          : failed ? `<p class="small">${esc(T.failed)}</p>` : `<p class="small">${esc(left > 0 ? T.cap.replace('{n}', left) : T.capNone)}</p>`}`;
      foot.innerHTML = `<button class="bk-outline mx-back">${esc(T.back)}</button>${left > 0 && !writing ? `<button class="tl-done mx-write">${esc(T.write)}</button>` : ''}`;
    }
    body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const s = b.dataset.s, v = b.dataset.v;
      draft[s] = draft[s] === v ? null : v;                       // tap again to unchoose
      reply = '';
      // A real mix takes the simple jar's topping in as an add-in (the same ids), so nothing chosen is lost
      if (s === 'mode' && draft.mode === 'real' && draft.topping && D.addins[draft.topping] && !(draft.addins || []).includes(draft.topping)) {
        draft.addins = [...(draft.addins || []), draft.topping]; save('addins', draft.addins);
      }
      if (kind === 'mix') save(s, draft[s]);
      if (draft[s] && s !== 'mode') { if (s === 'mood') sound?.answer?.('mood'); else sound?.mix?.(s); }   // clink and cork; the potion sounds
      // A mood suggests the rest, where nothing's chosen yet
      if (s === 'mood' && draft.mood && kind === 'mix') for (const [k, x] of Object.entries(D.moods[draft.mood]?.suggest || {})) if (!draft[k]) { draft[k] = x; save(k, x); }
      draw();
      body.querySelector(`[data-s="${s}"][data-v="${CSS.escape(v)}"]`)?.focus({ preventScroll: true });
    });
    // A real mix's add-ins: in or out, Gemma's line for it (its note, the diet, the soft cap) under the groups
    body.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const id = b.dataset.a, x = D.addins[id], on = (draft.addins || []).includes(id);
      draft.addins = toggleAddin(draft.addins, id);
      save('addins', draft.addins.length ? draft.addins : null);
      reply = '';
      said = on ? agree(T.addinRemoved || '{x} is out again.', x.label).replace('{x}', x.label)
        : [agree(T.addinAdded || '{x} goes in.', x.label).replace('{x}', x.label), dietNote(id) || x.note, capLine(D, addinsOf(draft).length)].filter(Boolean).join(' ');
      if (!on) sound?.mix?.('topping');
      draw();
      body.querySelector(`[data-a="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    });
    body.querySelector('[data-swap]')?.addEventListener('click', e => {
      const r = D.swaps[+e.currentTarget.dataset.swap];
      if (r.swap.step === 'addins') { draft.addins = (draft.addins || []).filter(x => x !== r.swap.remove); save('addins', draft.addins.length ? draft.addins : null); }
      else { draft[r.swap.step] = r.swap.to; save(r.swap.step, r.swap.to); }
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
    // "Swapped." belongs to the step it was said on (QA 7): a new step starts without it
    foot.querySelector('.mx-back')?.addEventListener('click', () => { at = Math.max(0, at - 1); failed = false; reply = ''; said = ''; draw(); });
    foot.querySelector('.mx-next')?.addEventListener('click', () => {
      if (steps()[at] === 'mode' && !draft.mode) { draft.mode = 'simple'; save('mode', 'simple'); }   // skipped: today's jar
      at += 1; reply = ''; said = ''; draw(); foot.querySelector('.mx-next, .mx-write')?.focus({ preventScroll: true });
    });
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
    const full = await writer.writeNow(rec, 'mix');
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
    prefilled = !!(draft.base || draft.flavour || draft.topping || draft.addins?.length);   // from the fridge, the drawers or an earlier mix
    reply = ''; said = '';
    // The fridge opens at the base, the drawers at the flavour (a real mix's add-ins); the jar size is a step back
    const to = step === 'flavour' && draft.mode === 'real' ? 'addins' : step;
    at = to ? Math.max(0, steps().indexOf(to)) : 0;
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

  /** A drawer tapped (chia.fromDrawers: drawer id → a flavour, topping, add-in or seed id): it goes into the Mix, as the fridge's milk
   *  is its base, so "Mix an experiment" opens with it in. Drawers add (QA 4, P3): an empty flavour or topping takes it, and it joins
   *  the add-ins too; two add-ins from the drawers make it a real mix. Returns { step, label } for Gemma's line, or null. */
  function drawer(id) {
    const v = D.fromDrawers?.[id];
    const step = v && (D.flavours?.[v] ? 'flavour' : D.toppings?.[v] ? 'topping' : D.seeds?.[v] ? 'seed' : D.addins?.[v] ? 'addins' : null);
    if (!step) return null;
    const dish = visit.dish(ROOM);
    if (step === 'seed') save('seed', v);
    else {
      if (step !== 'addins' && !dish[step]) save(step, v);
      if (D.addins?.[v]) {
        const adds = [].concat(dish.addins || []);
        if (!adds.includes(v)) adds.push(v);
        save('addins', adds);
        if (adds.filter(x => x !== (dish.flavour || (step === 'flavour' ? v : null))).length >= 2 && dish.mode !== 'real') save('mode', 'real');
      }
    }
    sound?.mix?.(step === 'seed' ? 'topping' : step);   // a seed has no sound of its own
    return { step, label: step === 'addins' ? D.addins[v].label : labelOf(D, step, v) };
  }

  return { open, close, drawer, data: D, get isOpen() { return !root.hidden; } };
}
