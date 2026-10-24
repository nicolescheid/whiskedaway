// "Tell Gemma about you", V1 (tell-gemma-ux.md): the Pantry, the Map and Dietary needs, each in one small sheet with the same
// pattern: choose, Done, one line from Gemma. Phones held upright get a bottom sheet with Done in its header (it stays above the
// keyboard); phones on their side a left-half panel; desktop a 420 px dialog. One sheet at a time. Answers go into the visit store
// on Done (so Gemma speaks once), last the visit, and are forgotten with it.
// Words come from gemma-lines.json `tell`, the cuisines, countries and synonyms from tell-data.json (content editor);
// the lists here only stand in if those files can't be read.

import { DIETS } from './writeout.js';
import { SERVINGS, checkinWords } from './checkin.js';
import { patienceString, confidenceDial } from './checkin-controls.js';
import { APPLIANCES, NONE, kitchenPicks, togglePick, kitchenWords } from './kitchen.js';
import { layers } from './layers.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');

let CUISINES = ['italian', 'thai', 'japanese', 'indian', 'mexican', 'middle-eastern', 'chinese', 'korean', 'kiwi', 'pacific'].map(id => ({ id, label: id }));
export let COUNTRIES = [['NZ', 'New Zealand'], ['AU', 'Australia'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['US', 'United States'], ['CA', 'Canada'], ['other', 'Other']];
let SHOP_WORDS = {};
/** The content editor's lists (tell-data.json): cuisines {id, label}, countries {id, label, example} */
export function useTellData(data) {
  if (Array.isArray(data?.cuisines) && data.cuisines.length) CUISINES = data.cuisines;
  if (Array.isArray(data?.countries) && data.countries.length) {
    COUNTRIES = data.countries.map(c => [c.id, c.label]);
    SHOP_WORDS = Object.fromEntries(data.countries.map(c => [c.id, c.example || '']));
  }
}
export const cuisineLabel = id => CUISINES.find(c => c.id === id)?.label || id;
export const countryLabel = id => COUNTRIES.find(([c]) => c === id)?.[1] || '';
/** The shopping words' example for a country (tell-data.json), for the food map's select */
export const shopExample = id => SHOP_WORDS[id] || '';
const MAX_PANTRY = 12;
const FILLER = /^(some|a|an|the|leftover|left over|half(?: a)?|a bit of|bit of|bits of|a few|few|lots of|a lot of|bag of|tin of|can of|jar of|bunch of|fresh|frozen|old)\s+/;

/** The country the browser's language names ("en-NZ" → NZ), or null. Not the connection: see tell-gemma-ux.md §3 */
export function countryFromLanguage(langs = navigator.languages || [navigator.language]) {
  for (const l of langs || []) {
    const r = (String(l).split('-')[1] || '').toUpperCase();
    if (r === 'UK') return 'GB';
    if (COUNTRIES.some(([c]) => c === r)) return r;          // only the countries on the list
  }
  return null;
}

/** "Eggs, half a bag of spinach and some leftover rice" → ["eggs", "spinach", "rice"] (their words; the navigator matches on the singular) */
export function parsePantry(text) {
  return String(text || '').toLowerCase()
    .split(/,|;|\n|\band\b|&|\+/)
    .map(w => w.replace(/[0-9]+\s*(g|kg|ml|l|x)?\b/g, ' ').replace(/[^a-zà-ÿāēīōū' -]/g, ' ').replace(/\s+/g, ' ').trim())
    .map(w => { let x = w; for (let i = 0; i < 3; i++) x = x.replace(FILLER, ''); return x; })
    .filter(w => w && w.length <= 24);
}

export function createTell({ visit, lines = {}, kitchenLines = {}, track, beforeOpen, onDone, openEnergy, energyLabel, openMap, mapWords, checkin = {}, keepEveryWay = ['kitchen'] }) {
  // openMap(from): the food map (food-map.js) has its own sheet; the menu's map row and open('map') hand over to it
  // keepEveryWay: the sheets whose ✕, the dim, Escape and Back keep the taps like Done does (the others' are Cancel)
  const K = kitchenLines, KS = K.sheet || {};                   // gemma-lines.json `kitchen`
  const W = checkinWords(lines);                               // the check-in's words (checkin.js)
  const P = lines.pantry || {}, M = lines.map || {}, D = lines.dietary || {}, N = lines.menu || {}, B = lines.buttons || {};   // gemma-lines.json `tell`
  const L = {
    pantry: { title: P.title || 'What have you got to use?', helper: P.helper || '', placeholder: P.placeholder || 'eggs, spinach, leftover rice',
              useUp: P.useUp || 'Use these up first', privacy: P.privacy || "Only used for Gemma's ideas and the recipes she writes for you." },
    map: { title: M.title || 'Where shall we take it?', helper: M.helper || '', shop: (M.shop || 'Shopping words for').replace(/:\s*$/, ''), choose: M.choose || 'Choose…' },
    dietary: { title: D.title || 'Anything I should avoid?', other: D.other || 'Something else?', otherPlaceholder: D.otherPlaceholder || '',
               otherNote: D.otherNote || "I'll pass that on when I write your recipe. I can't check my cards for it.",
               fodmapNote: D.fodmapNote || "I'll pass it on when I write your recipe. I only leave out cards I've checked." },
    checkin: { title: W.title },
    kitchen: { title: KS.title || 'Your kitchen', sub: KS.sub || "Tap what you cook with. Leave them all off and I'll suggest anything.",
               noneNote: KS.none_note || '', clear: KS.clear || 'Clear all', privacy: KS.privacy || '' },
    menu: { title: N.title || 'Tell me about you', checkin: N.checkin || W.title, energy: N.energy || 'Energy', pantry: N.pantry || 'Pantry', map: N.map || 'The map',
            dietary: N.dietary || 'Dietary needs', kitchen: K.menu || 'Your kitchen', kitchenNone: K.menu_none || 'anything goes', none: N.none || 'not yet' },
    forget: B.forget || 'Forget this', done: B.done || 'Done', close: B.close || 'Close',
  };
  const root = document.createElement('div');
  root.id = 'tell';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'tell-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box">
      <header class="tl-head"><h2 id="tell-title"></h2><button class="tl-done tl-done-top">${esc(L.done)}</button><button class="tl-x" aria-label="${esc(L.close)}">✕</button></header>
      <div class="tl-body"></div>
      <footer class="tl-foot"><button class="bk-outline tl-forget">${esc(L.forget)}</button><button class="tl-done tl-done-bottom">${esc(L.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const body = $('.tl-body');
  let kind = null, from = null, draft = null, opener = null, layer = null, here = null;

  const pantryNow = () => { const p = visit.get('pantry'); return Array.isArray(p) ? { items: p, useUp: false } : (p || { items: [], useUp: false }); };
  const current = k => ({
    pantry: pantryNow(),
    dietary: { dietary: [].concat(visit.get('dietary') || []), other: visit.get('dietaryOther') || '' },
    checkin: { energy: visit.get('energy'), time: visit.get('time'), servings: visit.get('servings'), confidence: visit.get('confidence'),
               weather: checkin.weather?.() || null },
    kitchen: { picks: kitchenPicks(visit.get('kitchen')) },
  }[k]);

  // ---------- the contents
  function drawPantry() {
    const d = draft;
    body.innerHTML = `${L.pantry.helper ? `<p class="small">${esc(L.pantry.helper)}</p>` : ''}<label class="tl-field"><span class="sr-only">${esc(L.pantry.title)}</span>
        <input class="tl-input" type="text" autocomplete="off" enterkeyhint="done" maxlength="200" placeholder="${esc(L.pantry.placeholder)}"></label>
      <div class="tl-chips">${d.items.map((w, i) => `<span class="tl-chip">${esc(w)}<button data-rm="${i}" aria-label="Remove ${esc(w)}">×</button></span>`).join('')}</div>
      <label class="tl-switch"><input type="checkbox" ${d.useUp ? 'checked' : ''}><span>${esc(L.pantry.useUp)}</span></label>
      <p class="small">${esc(L.pantry.privacy)}</p>`;
    const input = body.querySelector('.tl-input');
    const take = () => {
      const words = parsePantry(input.value);
      if (!words.length) return false;
      for (const w of words) if (!d.items.includes(w) && d.items.length < MAX_PANTRY) d.items.push(w);
      drawPantry();
      return true;
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); take(); body.querySelector('.tl-input')?.blur(); }    // Enter makes chips and closes the keyboard, not the sheet
    });
    input.addEventListener('input', () => { if (/,\s*$/.test(input.value)) { take(); body.querySelector('.tl-input')?.focus(); } });
    input.addEventListener('blur', () => { if (input.isConnected && input.value.trim()) take(); });
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { d.items.splice(+b.dataset.rm, 1); drawPantry(); body.querySelector('.tl-input').focus(); });
    body.querySelector('.tl-switch input').onchange = e => { d.useUp = e.target.checked; };
  }
  function drawDietary() {
    const d = draft;
    body.innerHTML = `<div class="tl-chips tl-pick" role="group" aria-label="${esc(L.dietary.title)}">${DIETS.map(([id, n]) => `<button data-d="${id}" aria-pressed="${d.dietary.includes(id)}">${esc(n)}</button>`).join('')}</div>
      <label class="tl-field">${esc(L.dietary.other)} <input class="tl-input" type="text" autocomplete="off" enterkeyhint="done" maxlength="60" placeholder="${esc(L.dietary.otherPlaceholder)}" value="${esc(d.other)}"></label>
      <p class="small tl-fodmap" ${d.dietary.includes('low-fodmap') ? '' : 'hidden'}>${esc(L.dietary.fodmapNote)}</p>
      <p class="small">${esc(L.dietary.otherNote)}</p>`;
    body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const id = b.dataset.d, on = d.dietary.includes(id);
      d.dietary = on ? d.dietary.filter(x => x !== id) : [...d.dietary, id];
      b.setAttribute('aria-pressed', String(!on));
      body.querySelector('.tl-fodmap').hidden = !d.dietary.includes('low-fodmap');   // portions matter: say what she can and can't check
    });
    const input = body.querySelector('.tl-input');
    input.oninput = () => { d.other = input.value.slice(0, 60); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  }
  // The check-in (checkin-views.md V1): your candle and how long you've got first, then "A bit more" (cooking for, confidence, the
  // weather). Every row can be skipped, and tapping a chosen answer again unchooses it. Gemma says one line on Done.
  function drawCheckin() {
    const d = draft;
    const chips = (k, ids, label) => `<div class="tl-chips tl-pick" role="group" aria-label="${esc(W.rows[k])}">${ids.map(id =>
      `<button data-a="${k}" data-v="${esc(id)}" aria-pressed="${d[k] === id}">${esc(label(id))}</button>`).join('')}</div>`;
    const energies = checkin.energies?.() || [], weathers = checkin.weathers?.() || [];
    body.innerHTML = `${W.helper ? `<p class="small">${esc(W.helper)}</p>` : ''}
      ${energies.length ? `<h3 class="tl-h">${esc(W.rows.energy)}</h3>${W.energyHelper ? `<p class="small">${esc(W.energyHelper)}</p>` : ''}
        <div class="tl-candles" role="group" aria-label="${esc(W.rows.energy)}">${energies.map(e =>
          `<button data-a="energy" data-v="${esc(e.id)}" aria-pressed="${d.energy === e.id}" aria-label="${esc(e.label)}"><span class="tl-wick" aria-hidden="true"><i class="tl-flame"></i></span><span class="tl-wax tl-wax-${esc(e.id)}" aria-hidden="true"></span><b>${esc(e.label)}</b></button>`).join('')}</div>` : ''}
      <h3 class="tl-h">${esc(W.rows.time)}</h3>${W.timeHelper ? `<p class="small">${esc(W.timeHelper)}</p>` : ''}<div class="ck-slot" data-ck="time"></div>
      <h3 class="tl-h">${esc(W.rows.servings)}</h3>${chips('servings', SERVINGS, id => W.servings[id])}
      <h3 class="tl-h">${esc(W.rows.confidence)}</h3>${W.confidenceHelper ? `<p class="small">${esc(W.confidenceHelper)}</p>` : ''}<div class="ck-slot" data-ck="confidence"></div>
      ${weathers.length ? `<h3 class="tl-h">${esc(W.rows.weather)}</h3>${chips('weather', weathers.map(w => w.id), id => weathers.find(w => w.id === id).label)}` : ''}`;
    // The two hand-made controls (checkin-controls.js): they set the same draft keys as the chips did
    const ids = k => Object.keys(W[k]), lab = k => ids(k).map(id => W[k][id]);
    const mount = (k, make, extra) => body.querySelector(`[data-ck="${k}"]`).replaceWith(make({ ids: ids(k), labels: W[k], value: d[k] || null, name: W[k + 'Aria'] || W.rows[k],
      unset: 'Not answered', hint: W[k + 'Hint'], ...extra, onChange: v => { const prev = d[k]; d[k] = v; if (prev !== v) checkin.onTap?.(k, v, prev); } }));
    mount('time', patienceString);
    mount('confidence', confidenceDial, { ends: [W.confidence[ids('confidence')[0]], W.confidence[ids('confidence').at(-1)]] });
    body.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const k = b.dataset.a, v = b.dataset.v, prev = d[k];
      d[k] = d[k] === v && k !== 'weather' ? null : v;           // tap again to unchoose (the weather always has one)
      body.querySelectorAll(`[data-a="${k}"]`).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === d[k])));
      if (prev !== d[k]) checkin.onTap?.(k, d[k], prev);         // the answer's sound, in the tap (sound.js)
    });
  }
  // Your kitchen (appliances-chia-plan.md §1): icon toggles, "No cooking" on its own row; Gemma's line for the last tap under them.
  // An appliance in the Inn opens it with its own icon ringed (`here`), not picked: the visitor still chooses
  function drawKitchen(said = '') {
    const d = draft;
    const btn = (id, A, cls = '') => `<button class="kt-ap${cls}${id === here ? ' kt-here' : ''}" data-ap="${esc(id)}" aria-pressed="${d.picks.includes(id)}">`
      + `<span class="kt-icon" aria-hidden="true">${esc(A.icon || '')}</span><b>${esc(A.label || id)}</b>${A.sub ? `<span class="small">${esc(A.sub)}</span>` : ''}</button>`;
    body.innerHTML = `<p class="small">${esc(L.kitchen.sub)}</p>
      <div class="kt-grid" role="group" aria-label="${esc(L.kitchen.title)}">${APPLIANCES.map(id => btn(id, K.appliances?.[id] || {})).join('')}</div>
      <div class="kt-grid kt-none" role="group" aria-label="${esc(K.none?.label || 'No cooking')}">${btn(NONE, { icon: '🥗', label: 'No cooking', ...(K.none || {}) }, ' kt-wide')}</div>
      ${L.kitchen.noneNote ? `<p class="small">${esc(L.kitchen.noneNote)}</p>` : ''}
      <p class="small kt-said" role="status">${esc(said)}</p>
      <p class="kt-acts"><button class="link kt-clear" ${d.picks.length ? '' : 'hidden'}>${esc(L.kitchen.clear)}</button></p>
      ${L.kitchen.privacy ? `<p class="small">${esc(L.kitchen.privacy)}</p>` : ''}`;
    body.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => {
      const id = b.dataset.ap, on = d.picks.includes(id);
      d.picks = togglePick(d.picks, id);
      const line = on ? '' : K.pick?.[id] || '';
      drawKitchen(line);
      body.querySelector(`[data-ap="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    });
    body.querySelector('.kt-clear').onclick = () => { d.picks = []; drawKitchen(K.cleared || ''); body.querySelector('[data-ap]')?.focus({ preventScroll: true }); };
  }
  function drawMenu() {
    const p = pantryNow(), di = [].concat(visit.get('dietary') || []);
    const t = visit.get('time'), sv = visit.get('servings'), cf = visit.get('confidence');
    const rows = [['checkin', L.menu.checkin, [t && W.time[t], sv && W.servings[sv], cf && W.confidence[cf]].filter(Boolean).join(', ')],
      ['energy', L.menu.energy, energyLabel?.() || ''], ['pantry', L.menu.pantry, p.items.slice(0, 2).join(', ') + (p.items.length > 2 ? ` +${p.items.length - 2}` : '')],
      ['map', L.menu.map, mapWords?.() || ''], ['dietary', L.menu.dietary, di.join(', ') + (visit.get('dietaryOther') ? (di.length ? ' +1' : 'something else') : '')],
      ['kitchen', L.menu.kitchen, kitchenWords(visit.get('kitchen'), K).join(', ') || L.menu.kitchenNone]];
    body.innerHTML = `<ul class="tl-menu">${rows.map(([k, n, v]) => `<li><button data-k="${k}"><b>${esc(n)}</b><span>${esc(v || L.menu.none)}</span><i aria-hidden="true">›</i></button></li>`).join('')}</ul>`;
    body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      if (b.dataset.k === 'energy') { close({ silent: true }); return openEnergy?.(); }
      open(b.dataset.k, 'menu', { keepOpener: true });
    });
  }
  const DRAW = { pantry: drawPantry, dietary: drawDietary, checkin: drawCheckin, kitchen: () => drawKitchen(), menu: drawMenu };

  // ---------- open, Done, forget, close
  function open(k, src = 'tag', { keepOpener = false, appliance = null } = {}) {
    if (k === 'map' && openMap) { if (!root.hidden) close({ silent: true }); return openMap(src); }   // the food map's own sheet
    if (!DRAW[k]) return;
    if (!keepOpener) opener = document.activeElement;
    beforeOpen?.();                                               // the chat's Full sheet or a highlight gives way: one sheet at a time
    kind = k; from = src; here = APPLIANCES.includes(appliance) ? appliance : null;
    draft = k === 'menu' ? null : JSON.parse(JSON.stringify(current(k)));
    $('#tell-title').textContent = k === 'menu' ? L.menu.title : L[k].title;
    root.dataset.kind = k;
    $('.tl-forget').hidden = k === 'checkin';                // forgetting stays in the notebook
    root.classList.toggle('menu', k === 'menu');
    const was = !root.hidden;
    root.hidden = false;
    root.className = `tell ${mode()}${k === 'menu' ? ' menu' : ''}`;
    DRAW[k]();
    fit();
    // A layer (layers.js): its history step, inert behind it, Escape, Tab and focus back to what opened it
    layer = layers.open({ el: root, name: 'tell', opener, close: how => close({ viaBack: how === 'back' }) });   // the menu into a sheet: the same layer
    if (!was && !reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    if (k !== 'menu') track?.('tell_open', { kind: k, from: src });
    (body.querySelector('.kt-here') || body.querySelector('input, button') || $('.tl-x')).focus({ preventScroll: true });
  }
  function close({ silent = false, viaBack = false, keep = true } = {}) {
    if (root.hidden) return;
    if (keep && keepEveryWay.includes(kind)) return done(false, { viaBack });   // every way out keeps the taps (✕, the dim, Escape, Back)
    root.hidden = true;
    kind = null;
    layers.closed(layer, { how: viaBack ? 'back' : 'self', refocus: !silent });
  }
  const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');
  function done(forget = false, { viaBack = false } = {}) {
    if (!kind || kind === 'menu') return close({ viaBack, keep: false });
    const k = kind, before = current(k);
    if (k === 'kitchen') {
      const after = { picks: forget ? [] : kitchenPicks(draft.picks) };
      close({ viaBack, keep: false });
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      visit.set('kitchen', after.picks.length ? after.picks : null);
      track?.('tell_set', { kind: k, count: bucket(after.picks.filter(x => x !== NONE).length), from });
      setTimeout(() => onDone?.(k, { before, after, forgot: forget && !!before.picks.length }), reduce() ? 0 : 200);
      return;
    }
    if (k === 'checkin') {                                         // the page sets each answer through its one setter (checkin.js)
      const after = forget ? { ...before, energy: null, time: null, servings: null, confidence: null } : draft;
      const changed = Object.keys(after).filter(x => (before[x] ?? null) !== (after[x] ?? null));
      if (!forget) checkin.onDone?.(after);                       // every Done, changed or not (the weather guess kept)
      close({ viaBack, keep: false });
      if (!changed.length) return;
      setTimeout(() => onDone?.(k, { before, after, changed, from, forgot: forget }), reduce() ? 0 : 200);
      return;
    }
    const empty = { pantry: { items: [], useUp: false }, dietary: { dietary: [], other: '' } }[k];
    const after = forget ? empty : draft;
    if (k === 'pantry' && !forget) {                               // a word still in the box counts
      const input = body.querySelector('.tl-input');
      if (input?.value.trim()) for (const w of parsePantry(input.value)) if (!draft.items.includes(w) && draft.items.length < MAX_PANTRY) draft.items.push(w);
    }
    if (k === 'dietary' && !forget) draft.other = (body.querySelector('.tl-input')?.value || '').trim().slice(0, 60);
    const same = JSON.stringify(before) === JSON.stringify(after);
    close({ viaBack, keep: false });
    if (same && !forget) return;                                   // nothing changed: Gemma says nothing
    if (k === 'pantry') visit.set('pantry', after.items.length ? after : null);
    if (k === 'dietary') { visit.set('dietary', after.dietary.length ? after.dietary : null); visit.set('dietaryOther', after.other || null); }
    const count = k === 'pantry' ? after.items.length : after.dietary.length + (after.other ? 1 : 0);
    track?.('tell_set', { kind: k, count: bucket(count), ...(k === 'pantry' ? { use_up: after.useUp ? 'yes' : 'no' } : {}) });
    // After the sheet has gone, so her line isn't hidden behind it
    setTimeout(() => onDone?.(k, { before, after, forgot: !count }), reduce() ? 0 : 200);
  }
  root.querySelectorAll('.tl-done').forEach(b => b.onclick = () => done(false));
  $('.tl-forget').onclick = () => done(true);
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();

  // iOS Safari ignores interactive-widget and doesn't shrink the layout viewport for the keyboard: follow visualViewport
  function fit() {
    const box = $('.tl-box'), vv = window.visualViewport;
    if (root.hidden || !vv || mode() === 'desk') { ['bottom', 'top', 'height', 'max-height'].forEach(k => box.style.removeProperty(k)); return; }
    const under = Math.max(0, innerHeight - (vv.height + vv.offsetTop));
    if (mode() === 'phone') box.style.bottom = `${under}px`;
    else { box.style.top = `${vv.offsetTop}px`; box.style.bottom = 'auto'; box.style.height = `${vv.height}px`; }   // landscape: follow iOS scrolling the page for the keyboard (mobile lead)
    box.style.maxHeight = `${Math.max(160, (mode() === 'phone' ? Math.min(vv.height * 0.7 + under, vv.height - 16) : vv.height - 16))}px`;
  }
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  addEventListener('resize', () => { if (!root.hidden) { root.className = `tell ${mode()}${kind === 'menu' ? ' menu' : ''}`; fit(); } });

  return { open, openMenu: (src = 'menu') => open('menu', src), close, get isOpen() { return !root.hidden; }, current };
}
