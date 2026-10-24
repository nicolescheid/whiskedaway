// The food map (Nicole, 23 Oct; map-adventure-scale.md): where you're from, the cooking you grew up with, and the food you
// love, on one map, and how far from it you'd like to go tonight (the adventure dial). Three pens: Home (a pin), Family (a heart pin) and Love the food (a warm wash). The list under the map
// does the same for keyboards and screen readers, as "In this room" does on the Inn map. A layer (layers.js); every way out
// keeps the taps. It replaced Tell Gemma's map sheet, through the same doors (Cuddlecore's framed map, the Tell menu, the
// notebook). The bar's Map button is the Inn map's, never this.
// The store: visit.set('foodMap', { home: ['nz'], heritage: ['it'], loved: ['jp'] }), visit.set('adventure', 1..5) (null: unset, the
// Inn serves as it always has) and `country` (shopping words), as before. The dial is a score in the navigator, never a filter.
// The old `cuisines` key is moved into foodMap once. Words: gemma-lines.json `foodMap` (content's); the countries and the
// drawing: food-map.json. The rules are food-map-rules.js.
import { visit } from './visit-state.js';
import { layers } from './layers.js';
import { COUNTRIES, shopExample } from './tell.js';
import { PENS, STEPS, tidy, isEmpty, cuisineSets, shopFrom, migrate } from './food-map-rules.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');
const MARK = { home: '📍', heritage: '♥', loved: '✿' };

export function install(inn) {
  const esc = inn.esc;
  const D = inn.foodMapData || {};
  const countries = (D.countries || []).filter(c => c.id && c.label).map(c => ({ cuisines: [], neighbours: [], ...c }));
  const byId = Object.fromEntries(countries.map(c => [c.id, c]));
  const F = inn.LINES.foodMap || {};
  const W = {
    title: F.title || 'The food map', sub: F.sub || "Pin where you're from, and colour in the food you love.",
    pens: { home: 'Home', heritage: 'Family', loved: 'Love the food', ...F.pens },
    penNotes: { heritage: 'the cooking you grew up with', ...F.penNotes },
    listTitle: F.listTitle || 'Every country on the map', shop: F.shop || 'Shopping words for', choose: F.choose || 'Choose…',
    done: F.done || 'Done',
    lean: F.lean || "{c} it is. I'll lean that way.", family: F.family || "The cooking you grew up with. I'll keep it in mind.",
    country: F.country || 'Shopping words for {country}, then.', cleared: F.cleared || 'A clean map. Anywhere you like.', noted: F.noted || 'Noted.',
    dialTitle: F.dialTitle || 'How far shall we go?', dialUnset: F.dialUnset || 'Leave it to me',
    steps: { 1: 'Close to home', 2: 'Familiar, with a twist', 3: 'A little further', 4: 'Further afield', 5: 'Somewhere new', ...F.steps },
    stepLines: { 1: 'Somewhere familiar tonight.', 2: 'Familiar, with a little twist.', 3: 'Fancy a short trip?', 4: "Let's wander a bit further.",
                 5: "Let's go somewhere you've never been.", ...F.stepLines },
    dialCleared: F.dialCleared || "I'll go where the wander takes us.",
  };
  const fmNow = () => tidy(visit.get('foodMap'), countries);
  // The old Map's cuisines become loved countries, once (they were the same fact)
  if (visit.get('cuisines') && !visit.get('foodMap')) {
    const m = migrate(visit.get('cuisines'), countries);
    if (!isEmpty(m)) visit.set('foodMap', m);
    visit.forget('cuisines');
  }
  /** The familiar cuisines, home first, then family, then loved (serving, write-outs, her lines) */
  const cuisinesNow = () => cuisineSets(fmNow(), countries).familiar;
  const stepNow = () => (STEPS.includes(visit.get('adventure')) ? visit.get('adventure') : null);
  /** What the navigator reads (serving.js steer): { step, familiar, near }, or null while the dial is unset */
  const adventure = () => { const step = stepNow(); if (!step) return null; const { familiar, near } = cuisineSets(fmNow(), countries); return { step, familiar, near }; };

  // ---------- the sheet
  const root = document.createElement('div');
  root.id = 'food-map';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'fm-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box fm-box">
      <header class="tl-head"><h2 id="fm-title">${esc(W.title)}</h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body">
        <p class="small fm-sub">${esc(W.sub)}</p>
        <div class="fm-pens" role="radiogroup" aria-label="${esc(W.title)}">${PENS.map(p => `<button role="radio" data-pen="${p}">
          <span class="fm-pen-mark fm-${p}" aria-hidden="true">${MARK[p]}</span><span class="fm-pen-name">${esc(W.pens[p])}</span>${W.penNotes[p] ? `<span class="fm-pen-note">${esc(W.penNotes[p])}</span>` : ''}</button>`).join('')}</div>
        <div class="fm-scroll"><svg class="fm-map" viewBox="0 0 340 150" role="group" aria-label="${esc(W.title)}"></svg></div>
        <div class="fm-dial" role="group" aria-labelledby="fm-dial-title"><h3 class="hy-group" id="fm-dial-title">${esc(W.dialTitle)}</h3>
          <svg class="fm-gauge" viewBox="0 0 200 112" aria-hidden="true"><path class="fm-arc" d="M18 100 A82 82 0 0 1 182 100"/>
            ${STEPS.map(n => { const a = Math.PI * (1 - (n - 1) / 4), x = 100 + 82 * Math.cos(a), y = 100 - 82 * Math.sin(a); return `<circle class="fm-notch" data-n="${n}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`; }).join('')}
            <g class="fm-needle"><line x1="100" y1="100" x2="100" y2="30"/><circle cx="100" cy="100" r="9"/></g></svg>
          <div class="fm-steps">${STEPS.map(n => `<button data-step="${n}" aria-pressed="false">${esc(W.steps[n])}</button>`).join('')}</div>
          <button class="link fm-unset">${esc(W.dialUnset)}</button></div>
        <h3 class="hy-group">${esc(W.listTitle)}</h3>
        <ul class="fm-list"></ul>
        <label class="tl-row fm-shop">${esc(W.shop)}: <select class="tl-country"></select></label>
        <p class="small tl-example fm-example"></p>
      </div>
      <footer class="tl-foot"><span></span><button class="tl-done fm-done">${esc(W.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let layer = null, draft = null, before = null, pen = 'home', from = 'object', shopTouched = false;

  const has = (p, id) => draft[p].includes(id);
  function toggle(p, id) {
    draft[p] = has(p, id) ? draft[p].filter(x => x !== id) : countries.map(c => c.id).filter(x => x === id || draft[p].includes(x));
    if (p === 'home' && !shopTouched) { const s = shopFrom(draft, countries); if (s) draft.country = s; }   // the first home pin sets shopping words
    drawMarks();
  }
  const stateWords = id => PENS.filter(p => has(p, id)).map(p => W.pens[p]).join(', ');
  function drawMap() {
    $('.fm-map').innerHTML = (D.land || []).map(d => `<path class="fm-land" d="${esc(d)}"/>`).join('')
      + countries.filter(c => Array.isArray(c.at)).map(c => `<g class="fm-c" data-c="${c.id}" role="button" tabindex="-1" transform="translate(${c.at[0]} ${c.at[1]})">
          <circle class="fm-hit" r="9"/><circle class="fm-stamp" r="5.5"/><text class="fm-heart" x="4.5" y="-3.5" aria-hidden="true">♥</text>
          <text class="fm-pin" x="-4" y="-4" aria-hidden="true">📍</text>
          <text class="fm-name" y="11" aria-hidden="true">${esc(c.label.replace(/^Aotearoa /, ''))}</text></g>`).join('');
    root.querySelectorAll('.fm-c').forEach(g => g.onclick = () => toggle(pen, g.dataset.c));
  }
  function drawList() {
    $('.fm-list').innerHTML = countries.map(c => `<li class="fm-row"><span class="fm-label" id="fm-l-${c.id}">${esc(c.label)}</span>
      ${PENS.map(p => `<button class="fm-t fm-${p}" data-t="${p}" data-c="${c.id}" aria-pressed="false" aria-label="${esc(W.pens[p])}" aria-describedby="fm-l-${c.id}"><span aria-hidden="true">${MARK[p]}</span></button>`).join('')}</li>`).join('');
    root.querySelectorAll('.fm-t').forEach(b => b.onclick = () => toggle(b.dataset.t, b.dataset.c));
  }
  function drawShop() {
    const sel = $('.tl-country');
    sel.innerHTML = (draft.country ? '' : `<option value="">${esc(W.choose)}</option>`)
      + COUNTRIES.map(([c, n]) => `<option value="${c}" ${draft.country === c ? 'selected' : ''}>${esc(n)}</option>`).join('');
    $('.fm-example').textContent = draft.country && shopExample(draft.country) ? `"${shopExample(draft.country)}"` : '';
  }
  $('.tl-country').onchange = e => { draft.country = e.target.value || null; shopTouched = true; drawShop(); };
  // Marks follow the draft: the map's stamps and pins, the list's toggles, the shopping words
  function drawMarks() {
    root.querySelectorAll('.fm-c').forEach(g => {
      const id = g.dataset.c;
      PENS.forEach(p => g.classList.toggle(p, has(p, id)));
      const s = stateWords(id);
      g.setAttribute('aria-label', `${byId[id].label}${s ? `: ${s}` : ''}`);
      g.setAttribute('aria-pressed', String(has(pen, id)));            // pressed: marked with the pen in hand
    });
    root.querySelectorAll('.fm-t').forEach(b => b.setAttribute('aria-pressed', String(has(b.dataset.t, b.dataset.c))));
    drawShop();
  }
  // The dial: five steps, or unset (Leave it to me). The needle points at the step; unset, it rests straight up and dimmed
  function drawDial() {
    root.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.step === draft.adventure)));
    root.querySelectorAll('.fm-notch').forEach(c => c.classList.toggle('on', +c.dataset.n === draft.adventure));
    const deg = draft.adventure ? -90 + (draft.adventure - 1) * 45 : 0;
    $('.fm-needle').style.transform = `rotate(${deg}deg)`;
    $('.fm-dial').classList.toggle('unset', !draft.adventure);
    $('.fm-unset').hidden = !draft.adventure;
  }
  root.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { draft.adventure = +b.dataset.step; drawDial(); });
  $('.fm-unset').onclick = () => { draft.adventure = null; drawDial(); root.querySelector('[data-step="1"]').focus(); };
  function choosePen(p) {
    pen = p;
    root.querySelectorAll('[data-pen]').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.pen === p)); b.tabIndex = b.dataset.pen === p ? 0 : -1; });
    root.classList.toggle('pen-loved', p === 'loved');
    drawMarks();
  }
  root.querySelectorAll('[data-pen]').forEach(b => {
    b.onclick = () => choosePen(b.dataset.pen);
    b.onkeydown = e => {                                           // a radio group: the arrows move the pen
      const i = PENS.indexOf(pen), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      choosePen(PENS[(i + d + PENS.length) % PENS.length]);
      root.querySelector(`[data-pen="${pen}"]`).focus();
    };
  });

  /** open(from): object|menu|book|tag (counted with tell_open) */
  function open(src = 'object') {
    if (!root.hidden) return;
    const opener = document.activeElement;
    inn.ideas.close(false);
    if (inn.bookView.isOpen) inn.bookView.close();
    if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto');
    from = src; shopTouched = false;
    before = { ...fmNow(), country: visit.get('country') || inn.mapDefault() || null, adventure: stepNow() };
    draft = JSON.parse(JSON.stringify(before));
    drawMap(); drawList(); choosePen('home'); drawDial();
    root.hidden = false;
    root.className = `tell ${mode()} fm-sheet`;
    inn.track('tell_open', { kind: 'food-map', from });
    layer = layers.open({ el: root, name: 'food-map', opener, close: how => close({ viaBack: how === 'back' }) });
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    $('[data-pen="home"]').focus({ preventScroll: true });
  }
  // Every way out keeps the taps (EVERY_WAY_KEEPS)
  function close({ viaBack = false } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    layers.closed(layer, { how: viaBack ? 'back' : 'self' });
    setTimeout(() => saved(before, draft), reduce() ? 0 : 200);   // after the sheet has gone, so her line isn't behind it
  }
  $('.fm-done').onclick = () => close();
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell ${mode()} fm-sheet`; });

  function saved(was, now) {
    const pins = o => JSON.stringify(PENS.map(p => o[p]));
    const pinsChanged = pins(was) !== pins(now), shopChanged = (was.country || null) !== (now.country || null), dialChanged = was.adventure !== now.adventure;
    if (!pinsChanged && !shopChanged && !dialChanged) return;
    const fm = Object.fromEntries(PENS.map(p => [p, now[p]]));
    if (pinsChanged) visit.set('foodMap', isEmpty(fm) ? null : fm);
    if (shopChanged) { visit.set('country', now.country || null); inn.applyShopWords(); }
    if (dialChanged) { visit.set('adventure', now.adventure || null); inn.track('adventure_set', { step: now.adventure ? String(now.adventure) : 'unset' }); }
    if (pinsChanged || shopChanged) inn.track('tell_set', { kind: 'food-map', count: bucket(PENS.reduce((n, p) => n + now[p].length, 0)), from });   // how many, never which
    // The dial's line when it moved (it's the newest thing they said), else the map's
    inn.say(dialChanged ? (now.adventure ? W.stepLines[now.adventure] : W.dialCleared) : line(was, now, pinsChanged), [], true);
    inn.holdLine();
    inn.scheduleNavigate();
  }
  function line(was, now, pinsChanged) {
    if (!pinsChanged) return W.country.replace('{country}', COUNTRIES.find(([c]) => c === now.country)?.[1] || 'everywhere');
    const fm = Object.fromEntries(PENS.map(p => [p, now[p]]));
    if (isEmpty(fm)) return W.cleared;
    const { familiar } = cuisineSets(fm, countries);
    const newFamily = now.heritage.some(id => !was.heritage.includes(id));
    if (familiar.length) return W.lean.replace('{c}', inn.listOf(familiar.slice(0, 2)));
    return newFamily ? W.family : W.noted;
  }

  // What you've told me (panels.js TOLD): "The food map: home in Aotearoa New Zealand; family in Italy; you love Japan."
  function told(v) {
    const fm = tidy(v, countries), names = ids => inn.listOf(ids.map(id => byId[id].label));
    const parts = [fm.home.length && `home in ${names(fm.home)}`, fm.heritage.length && `family in ${names(fm.heritage)}`, fm.loved.length && `you love ${names(fm.loved)}`].filter(Boolean);
    return parts.length ? `${W.title}: ${parts.join('; ')}.` : '';
  }
  /** The chat's tag: the first two familiar cuisines, or the first country */
  const word = v => { const fm = tidy(v, countries), c = cuisineSets(fm, countries).familiar; return c.length ? c.slice(0, 2).join(', ') + (c.length > 2 ? ` +${c.length - 2}` : '') : (byId[PENS.flatMap(p => fm[p])[0]]?.label || ''); };

  inn.foodMap = { open, told, word, adventure, heritage: () => cuisineSets(fmNow(), countries).heritage, get isOpen() { return !root.hidden; } };
  inn.cuisinesNow = cuisinesNow;
}
