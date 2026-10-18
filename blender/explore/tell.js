// "Tell Gemma about you", V1 (tell-gemma-ux.md): the Pantry, the Map and Dietary needs, each in one small sheet with the same
// pattern: choose, Done, one line from Gemma. Phones held upright get a bottom sheet with Done in its header (it stays above the
// keyboard); phones on their side a left-half panel; desktop a 420 px dialog. One sheet at a time. Answers go into the visit store
// on Done (so Gemma speaks once), last the visit, and are forgotten with it.
// Lists and words here are placeholders until the content editor's copy lands (gemma-lines.json `tell`, world JSON `cuisines`).

import { DIETS } from './writeout.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');

const CUISINES = ['Italian', 'Thai', 'Japanese', 'Indian', 'Mexican', 'Middle Eastern', 'Chinese', 'Korean', 'Greek', 'French', 'Kiwi classics', 'Pacific'];
export const COUNTRIES = [['NZ', 'New Zealand'], ['AU', 'Australia'], ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['US', 'United States'], ['CA', 'Canada'], ['other', 'Other']];
const SHOP_WORDS = { NZ: 'courgette, coriander, kūmara', AU: 'zucchini, coriander, capsicum', GB: 'courgette, coriander, aubergine',
  IE: 'courgette, coriander, aubergine', US: 'zucchini, cilantro, eggplant', CA: 'zucchini, cilantro, eggplant', other: 'everyday names' };
const MAX_PANTRY = 12, MAX_CUISINES = 3;
const FILLER = /^(some|a|an|the|leftover|left over|half(?: a)?|a bit of|bit of|bits of|a few|few|lots of|a lot of|bag of|tin of|can of|jar of|bunch of|fresh|frozen|old)\s+/;

/** The country the browser's language names ("en-NZ" → NZ), or null. Not the connection: see tell-gemma-ux.md §3 */
export function countryFromLanguage(langs = navigator.languages || [navigator.language]) {
  for (const l of langs || []) {
    const r = (String(l).split('-')[1] || '').toUpperCase();
    if (r === 'UK') return 'GB';
    if (COUNTRIES.some(([c]) => c === r)) return r;
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

export function createTell({ visit, lines = {}, track, beforeOpen, onDone, openEnergy, energyLabel }) {
  const L = {
    pantry: { title: 'What have you got to use?', placeholder: 'eggs, spinach, leftover rice', useUp: 'Use these up first',
              privacy: 'Only goes to Gemma\'s picks and the recipes she writes out for you.', ...(lines.pantry || {}) },
    map: { title: 'Where shall we take it?', shop: 'Shopping words for:', choose: 'Choose…', ...(lines.map || {}) },
    dietary: { title: 'Anything I should avoid?', other: 'Something else?',
               otherNote: "I'll tell my pen when I write a recipe out. I can't check my cards for it.", ...(lines.dietary || {}) },
    menu: { title: 'Tell me about you', energy: 'Energy', pantry: 'Pantry', map: 'The map', dietary: 'Dietary needs', none: 'not yet', ...(lines.menu || {}) },
    forget: 'Forget this', done: 'Done', close: 'Close',
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
  let kind = null, from = null, draft = null, opener = null, pushed = false;

  const pantryNow = () => { const p = visit.get('pantry'); return Array.isArray(p) ? { items: p, useUp: false } : (p || { items: [], useUp: false }); };
  const current = k => ({
    pantry: pantryNow(),
    map: { cuisines: [].concat(visit.get('cuisines') || []), country: visit.get('country') || countryFromLanguage() },
    dietary: { dietary: [].concat(visit.get('dietary') || []), other: visit.get('dietaryOther') || '' },
  }[k]);

  // ---------- the contents
  function drawPantry() {
    const d = draft;
    body.innerHTML = `<label class="tl-field"><span class="sr-only">${esc(L.pantry.title)}</span>
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
  function drawMap() {
    const d = draft;
    body.innerHTML = `<div class="tl-chips tl-pick" role="group" aria-label="${esc(L.map.title)}">${CUISINES.map(c => `<button data-c="${esc(c)}" aria-pressed="${d.cuisines.includes(c)}">${esc(c)}</button>`).join('')}</div>
      <hr>
      <label class="tl-row">${esc(L.map.shop)} <select class="tl-country">${d.country ? '' : `<option value="">${esc(L.map.choose)}</option>`}
        ${COUNTRIES.map(([c, n]) => `<option value="${c}" ${d.country === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <p class="small tl-example">${d.country ? `"${esc(SHOP_WORDS[d.country] || '')}"` : ''}</p>`;
    body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const c = b.dataset.c, on = d.cuisines.includes(c);
      if (on) d.cuisines = d.cuisines.filter(x => x !== c);
      else if (d.cuisines.length < MAX_CUISINES) d.cuisines.push(c);
      else return;                                            // three at most
      b.setAttribute('aria-pressed', String(!on));
    });
    body.querySelector('.tl-country').onchange = e => { d.country = e.target.value || null; body.querySelector('.tl-example').textContent = d.country ? `"${SHOP_WORDS[d.country] || ''}"` : ''; };
  }
  function drawDietary() {
    const d = draft;
    body.innerHTML = `<div class="tl-chips tl-pick" role="group" aria-label="${esc(L.dietary.title)}">${DIETS.map(([id, n]) => `<button data-d="${id}" aria-pressed="${d.dietary.includes(id)}">${esc(n)}</button>`).join('')}</div>
      <label class="tl-field">${esc(L.dietary.other)} <input class="tl-input" type="text" autocomplete="off" enterkeyhint="done" maxlength="60" value="${esc(d.other)}"></label>
      <p class="small">${esc(L.dietary.otherNote)}</p>`;
    body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const id = b.dataset.d, on = d.dietary.includes(id);
      d.dietary = on ? d.dietary.filter(x => x !== id) : [...d.dietary, id];
      b.setAttribute('aria-pressed', String(!on));
    });
    const input = body.querySelector('.tl-input');
    input.oninput = () => { d.other = input.value.slice(0, 60); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  }
  function drawMenu() {
    const p = pantryNow(), cu = [].concat(visit.get('cuisines') || []), di = [].concat(visit.get('dietary') || []);
    const rows = [['energy', L.menu.energy, energyLabel?.() || ''], ['pantry', L.menu.pantry, p.items.slice(0, 2).join(', ') + (p.items.length > 2 ? ` +${p.items.length - 2}` : '')],
      ['map', L.menu.map, cu.join(', ')], ['dietary', L.menu.dietary, di.join(', ') + (visit.get('dietaryOther') ? (di.length ? ' +1' : 'something else') : '')]];
    body.innerHTML = `<ul class="tl-menu">${rows.map(([k, n, v]) => `<li><button data-k="${k}"><b>${esc(n)}</b><span>${esc(v || L.menu.none)}</span><i aria-hidden="true">›</i></button></li>`).join('')}</ul>`;
    body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      if (b.dataset.k === 'energy') { close({ silent: true }); return openEnergy?.(); }
      open(b.dataset.k, 'menu', { keepOpener: true });
    });
  }
  const DRAW = { pantry: drawPantry, map: drawMap, dietary: drawDietary, menu: drawMenu };

  // ---------- open, Done, forget, close
  function open(k, src = 'tag', { keepOpener = false } = {}) {
    if (!DRAW[k]) return;
    if (!keepOpener) opener = document.activeElement;
    beforeOpen?.();                                               // the chat's Full sheet or a highlight gives way: one sheet at a time
    kind = k; from = src;
    draft = k === 'menu' ? null : JSON.parse(JSON.stringify(current(k)));
    $('#tell-title').textContent = k === 'menu' ? L.menu.title : L[k].title;
    root.dataset.kind = k;
    root.classList.toggle('menu', k === 'menu');
    const was = !root.hidden;
    root.hidden = false;
    root.className = `tell ${mode()}${k === 'menu' ? ' menu' : ''}`;
    for (const el of document.body.children) if (el !== root && !el.matches('script, .sr-only') && !el.inert) { el.inert = true; el.dataset.tellInert = '1'; }
    DRAW[k]();
    fit();
    if (!pushed) { history.pushState({ ...(history.state || {}), tell: true }, ''); pushed = true; }
    if (!was && !reduce()) $('.tl-box').animate(mode() === 'phone' ? [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }]
      : [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    if (k !== 'menu') track?.('tell_open', { kind: k, from: src });
    (body.querySelector('input, button') || $('.tl-x')).focus({ preventScroll: true });
  }
  function close({ silent = false, viaBack = false } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    for (const el of document.body.children) if (el.dataset.tellInert) { el.inert = false; delete el.dataset.tellInert; }
    if (pushed) { pushed = false; if (!viaBack && history.state?.tell) history.back(); }
    kind = null;
    if (!silent && opener?.isConnected) opener.focus({ preventScroll: true });
  }
  const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');
  function done(forget = false) {
    if (!kind || kind === 'menu') return close();
    const k = kind, before = current(k);
    const empty = { pantry: { items: [], useUp: false }, map: { cuisines: [], country: null }, dietary: { dietary: [], other: '' } }[k];
    const after = forget ? empty : draft;
    if (k === 'pantry' && !forget) {                               // a word still in the box counts
      const input = body.querySelector('.tl-input');
      if (input?.value.trim()) for (const w of parsePantry(input.value)) if (!draft.items.includes(w) && draft.items.length < MAX_PANTRY) draft.items.push(w);
    }
    if (k === 'dietary' && !forget) draft.other = (body.querySelector('.tl-input')?.value || '').trim().slice(0, 60);
    const same = JSON.stringify(before) === JSON.stringify(after);
    close();
    if (same && !forget) return;                                   // nothing changed: Gemma says nothing
    if (k === 'pantry') visit.set('pantry', after.items.length ? after : null);
    if (k === 'map') { visit.set('cuisines', after.cuisines.length ? after.cuisines : null); visit.set('country', after.country || null); }
    if (k === 'dietary') { visit.set('dietary', after.dietary.length ? after.dietary : null); visit.set('dietaryOther', after.other || null); }
    const count = k === 'pantry' ? after.items.length : k === 'map' ? after.cuisines.length : after.dietary.length + (after.other ? 1 : 0);
    track?.('tell_set', { kind: k, count: bucket(count), ...(k === 'pantry' ? { use_up: after.useUp ? 'yes' : 'no' } : {}) });
    // After the sheet has gone, so her line isn't hidden behind it
    setTimeout(() => onDone?.(k, { before, after, forgot: !count && !(k === 'map' && after.country) }), reduce() ? 0 : 200);
  }
  root.querySelectorAll('.tl-done').forEach(b => b.onclick = () => done(false));
  $('.tl-forget').onclick = () => done(true);
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();
  addEventListener('popstate', () => { if (pushed && !history.state?.tell) { pushed = false; close({ viaBack: true }); } });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button, input, select, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  });

  // iOS Safari ignores interactive-widget and doesn't shrink the layout viewport for the keyboard: follow visualViewport
  function fit() {
    const box = $('.tl-box'), vv = window.visualViewport;
    if (root.hidden || !vv || mode() === 'desk') { box.style.removeProperty('bottom'); box.style.removeProperty('max-height'); return; }
    const under = Math.max(0, innerHeight - (vv.height + vv.offsetTop));
    if (mode() === 'phone') box.style.bottom = `${under}px`;
    box.style.maxHeight = `${Math.max(160, (mode() === 'phone' ? Math.min(vv.height * 0.7 + under, vv.height - 16) : vv.height - 16))}px`;
  }
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  addEventListener('resize', () => { if (!root.hidden) { root.className = `tell ${mode()}${kind === 'menu' ? ' menu' : ''}`; fit(); } });

  return { open, openMenu: (src = 'menu') => open('menu', src), close, get isOpen() { return !root.hidden; }, current };
}
