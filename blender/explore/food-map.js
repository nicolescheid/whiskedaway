// The food map (Nicole, 23 Oct; map-adventure-scale.md): where you're from, the cooking you grew up with, and the food you
// love, on one map, and how far from it you'd like to go tonight (the adventure dial). Three pens: Home (a pin), Family (a heart pin) and Love the food (a warm wash). The list under the map
// does the same for keyboards and screen readers, as "In this room" does on the Inn map. A layer (layers.js); every way out
// keeps the taps. It replaced Tell Gemma's map sheet, through the same doors (Cuddlecore's framed map, the Tell menu, the
// notebook). The bar's Map button is the Inn map's, never this.
// The store: visit.set('foodMap', { home: ['nz'], heritage: ['it'], loved: ['jp'] }), visit.set('adventure', 1..5) (null: unset, the
// Inn serves as it always has) and `country` (shopping words), as before. The dial is a score in the navigator, never a filter.
// The old `cuisines` key is moved into foodMap once. Words: gemma-lines.json `foodMap` (content's); the countries and the
// countries (all of them, so every country takes a pin): food-map.json; the drawing (Natural Earth 1:110m, styled here in code) is
// world-map.json, fetched the first time the map opens. The rules are food-map-rules.js.
import { visit } from './visit-state.js';
import { layers } from './layers.js';
import { COUNTRIES, shopExample } from './tell.js';
import { PENS, STEPS, tidy, isEmpty, cuisineSets, shopFrom, migrate, hasRecipes } from './food-map-rules.js';

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
    noRecipes: F.noRecipes || "I don't have dishes from there yet, but I'll lean that way.",
    find: F.find || 'Find a country', findNone: F.findNone || 'No country by that name.', noDishes: F.noDishes || 'no dishes from there yet', notPinned: F.notPinned || 'not pinned',
    zoomIn: F.zoomIn || 'Zoom in', zoomOut: F.zoomOut || 'Zoom out', zoomAll: F.zoomAll || 'Show the whole world', mapHint: F.mapHint || 'Tap a country, or use the list below.',
    count: F.count || '{n} countries', countOf: F.countOf || '{n} of {total} countries',
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
        <div class="fm-view" style="--ar: 1000 / 432"><svg class="fm-map" viewBox="0 0 1000 432" aria-hidden="true" focusable="false"></svg></div>
        <div class="fm-bar"><p class="fm-readout small" role="status" aria-live="polite">${esc(W.mapHint)}</p>
          <button class="fm-zb" data-z="out" aria-label="${esc(W.zoomOut)}"><span aria-hidden="true">−</span></button>
          <button class="fm-zb" data-z="in" aria-label="${esc(W.zoomIn)}"><span aria-hidden="true">+</span></button>
          <button class="fm-zb" data-z="all" aria-label="${esc(W.zoomAll)}"><span aria-hidden="true">⌂</span></button></div>
        <div class="fm-dial" role="group" aria-labelledby="fm-dial-title"><h3 class="hy-group" id="fm-dial-title">${esc(W.dialTitle)}</h3>
          <svg class="fm-gauge" viewBox="0 0 200 112" aria-hidden="true"><path class="fm-arc" d="M18 100 A82 82 0 0 1 182 100"/>
            ${STEPS.map(n => { const a = Math.PI * (1 - (n - 1) / 4), x = 100 + 82 * Math.cos(a), y = 100 - 82 * Math.sin(a); return `<circle class="fm-notch" data-n="${n}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`; }).join('')}
            <g class="fm-needle"><line x1="100" y1="100" x2="100" y2="30"/><circle cx="100" cy="100" r="9"/></g></svg>
          <div class="fm-steps">${STEPS.map(n => `<button data-step="${n}" aria-pressed="false">${esc(W.steps[n])}</button>`).join('')}</div>
          <button class="link fm-unset">${esc(W.dialUnset)}</button></div>
        <h3 class="hy-group">${esc(W.listTitle)}</h3>
        <label class="fm-find"><span>${esc(W.find)}</span><input type="search" class="fm-q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
        <p class="small fm-count" role="status" aria-live="polite"></p>
        <ul class="fm-list"></ul>
        <p class="small fm-none" hidden>${esc(W.findNone)}</p>
        <label class="tl-row fm-shop">${esc(W.shop)}: <select class="tl-country"></select></label>
        <p class="small tl-example fm-example"></p>
      </div>
      <footer class="tl-foot"><span></span><button class="tl-done fm-done">${esc(W.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let layer = null, draft = null, before = null, pen = 'home', from = 'object', shopTouched = false, opening = false;

  const has = (p, id) => draft[p].includes(id);
  function toggle(p, id) {
    draft[p] = has(p, id) ? draft[p].filter(x => x !== id) : countries.map(c => c.id).filter(x => x === id || draft[p].includes(x));
    if (p === 'home' && !shopTouched) { const s = shopFrom(draft, countries); if (s) draft.country = s; }   // the first home pin sets shopping words
    drawMarks();
    readout(id);
  }
  const stateWords = id => PENS.filter(p => has(p, id)).map(p => W.pens[p]).join(', ');
  /** What was just tapped, in words (a live region: the pins themselves are only drawn) */
  function readout(id) {
    const c = byId[id];
    $('.fm-readout').textContent = `${c.label}: ${stateWords(id) || W.notPinned}${hasRecipes(c) ? '' : ` · ${W.noDishes}`}`;
  }

  // ---------- the world (Natural Earth 1:110m, drawn in code: parchment, inked borders with a little wobble, paper grain)
  let world = null, worldP = null, mapBuilt = false, listBuilt = false, rows = [], pts = [], view = { x: 0, y: 0, w: 1000 }, vw = 345, W0 = 1000, H0 = 432, Y0 = 0, calm = 0;
  const loadWorld = () => (worldP ||= fetch('explore/world-map.json').then(r => (r.ok ? r.json() : Promise.reject(r.status))).then(w => (world = w)).catch(() => { worldP = null; return null; }));
  const MAXZ = 8;
  const svg = $('.fm-map'), viewEl = $('.fm-view');
  const fold = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const at = id => world.centres[id] || world.dots[id];
  function buildMap() {
    const PAD = 36;                                            // sea above and below, so a name at the edge isn't cut off
    W0 = world.w; H0 = world.h + 2 * PAD; Y0 = -PAD; view = { x: 0, y: Y0, w: W0 };
    viewEl.style.setProperty('--ar', `${W0} / ${H0}`);
    svg.setAttribute('viewBox', `0 ${Y0} ${W0} ${H0}`);
    const shaped = countries.filter(c => world.shapes[c.id]), dotted = countries.filter(c => world.dots[c.id] && !world.shapes[c.id]);
    svg.innerHTML = `<defs><filter id="fm-wobble" filterUnits="userSpaceOnUse" x="0" y="0" width="${W0}" height="${H0}">
        <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
      <g class="fm-lands" filter="url(#fm-wobble)">${world.land.map(d => `<path class="fm-land" d="${d}"/>`).join('')}
        ${shaped.map(c => `<path class="fm-country" data-c="${c.id}" d="${world.shapes[c.id]}"><title>${esc(c.label)}</title></path>`).join('')}</g>
      <g class="fm-pts">${dotted.map(c => `<g class="fm-country fm-dot" data-c="${c.id}" data-x="${world.dots[c.id][0]}" data-y="${world.dots[c.id][1]}"><title>${esc(c.label)}</title><circle class="fm-hit" r="13"/><circle class="fm-dotc" r="4.5"/></g>`).join('')}</g>
      <g class="fm-stamps"></g>`;
    pts = [...svg.querySelectorAll('.fm-dot')];
  }
  function build() {
    if (!listBuilt) { buildList(); listBuilt = true; }
    if (!mapBuilt && world) { buildMap(); mapBuilt = true; }
    root.classList.toggle('fm-nomap', !mapBuilt);
  }
  function buildList() {
    $('.fm-list').innerHTML = countries.map(c => `<li class="fm-row" data-k="${esc(fold([c.label, ...(c.alt || [])].join(' ')))}"><span class="fm-label" id="fm-l-${c.id}">${esc(c.label)}</span>
      ${PENS.map(p => `<button class="fm-t fm-${p}" data-t="${p}" data-c="${c.id}" aria-pressed="false" aria-label="${esc(W.pens[p])}" aria-describedby="fm-l-${c.id}"><span aria-hidden="true">${MARK[p]}</span></button>`).join('')}</li>`).join('');
    rows = [...root.querySelectorAll('.fm-row')];
    root.querySelectorAll('.fm-t').forEach(b => b.onclick = () => toggle(b.dataset.t, b.dataset.c));
  }
  /** Find a country: the list narrows as you type (small countries, and screen readers) */
  function filterList() {
    const q = fold($('.fm-q').value.trim());
    let n = 0;
    for (const r of rows) { const hit = !q || r.dataset.k.includes(q); r.hidden = !hit; if (hit) n++; }
    $('.fm-count').textContent = (q ? W.countOf : W.count).replace('{n}', n).replace('{total}', rows.length);
    $('.fm-none').hidden = n > 0;
  }
  $('.fm-q').oninput = filterList;
  $('.fm-q').onkeydown = e => { if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); e.target.value = ''; filterList(); } };

  // ---------- stamps: a stamp for each pen a country holds, over its middle, kept the same size on screen at every zoom
  const glyphs = { home: '📍', heritage: '♥', loved: '✿' };
  function drawStamps() {
    if (!mapBuilt) return;
    const ids = countries.map(c => c.id).filter(id => PENS.some(p => has(p, id)));
    $('.fm-stamps').innerHTML = ids.map(id => {
      const ps = PENS.filter(p => has(p, id)), [x, y] = at(id);
      return `<g class="fm-mark" data-x="${x}" data-y="${y}">${ps.map((p, i) => `<g transform="translate(${(i - (ps.length - 1) / 2) * 20} -13)"><circle class="fm-st fm-st-${p}" r="9"/><text class="fm-glyph fm-g-${p}" y="4">${glyphs[p]}</text></g>`).join('')}
        <text class="fm-lab" y="12"${x > W0 - 60 ? ' text-anchor="end" x="14"' : x < 60 ? ' text-anchor="start" x="-14"' : ''}>${esc(byId[id].label.replace(/^Aotearoa /, ''))}</text></g>`;
    }).join('');
    place();
  }
  function place() {
    if (!mapBuilt) return;
    const u = (view.w / vw).toFixed(4);
    svg.querySelectorAll('[data-x]').forEach(el => el.setAttribute('transform', `translate(${el.dataset.x} ${el.dataset.y}) scale(${u})`));
  }

  // ---------- zoom and pan: the viewBox moves, so the shapes stay sharp. Pinch, drag, the buttons, ctrl+wheel
  const measure = () => { vw = svg.getBoundingClientRect().width || vw; };
  const hOf = w => w * H0 / W0;
  function setView(v, still) {
    const w = Math.min(W0, Math.max(W0 / MAXZ, v.w)), h = hOf(w);
    view = { w, x: Math.min(W0 - w, Math.max(0, v.x)), y: Math.min(Y0 + H0 - h, Math.max(Y0, v.y)) };
    svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    viewEl.classList.toggle('zoomed', w < W0 - 1);
    root.querySelector('[data-z="in"]').disabled = w <= W0 / MAXZ + 0.5;
    root.querySelector('[data-z="out"]').disabled = w >= W0 - 0.5;
    root.querySelector('[data-z="all"]').disabled = w >= W0 - 0.5;
    place();
    if (!still) hush();
  }
  // The wobble filter is the costly bit; it rests while a finger is moving the map
  function hush() {
    const g = svg.querySelector('.fm-lands');
    g.removeAttribute('filter');
    clearTimeout(calm);
    calm = setTimeout(() => g.setAttribute('filter', 'url(#fm-wobble)'), 160);
  }
  function showAll(still) { if (mapBuilt) setView({ x: 0, y: Y0, w: W0 }, still); }
  function zoomAt(f, cx, cy, still) {
    const w = Math.min(W0, Math.max(W0 / MAXZ, view.w / f)), k = w / view.w;
    setView({ w, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k }, still);
  }
  root.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
    if (b.dataset.z === 'all') return showAll(true);
    zoomAt(b.dataset.z === 'in' ? 1.6 : 1 / 1.6, view.x + view.w / 2, view.y + hOf(view.w) / 2, true);
  });
  const ptrs = new Map();
  let gesture = null, dragged = false;
  const toSvg = (rect, cx, cy, v = view) => [v.x + (cx - rect.left) / rect.width * v.w, v.y + (cy - rect.top) / rect.height * hOf(v.w)];
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { dragged = false; gesture = { kind: 'pan', sx: e.clientX, sy: e.clientY, v: { ...view }, on: false }; }
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], rect = svg.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      dragged = true;
      gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, v: { ...view }, rect, anchor: toSvg(rect, mx, my) };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !gesture) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.kind === 'pan') {
      const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
      if (view.w >= W0 - 1) return;                              // whole world showing: nothing to pan, let the page scroll
      if (!gesture.on) { if (Math.hypot(dx, dy) < 6) return; gesture.on = true; dragged = true; try { svg.setPointerCapture(e.pointerId); } catch {} }
      const k = gesture.v.w / vw;
      setView({ w: gesture.v.w, x: gesture.v.x - dx * k, y: gesture.v.y - dy * k });
    } else if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], g = gesture, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const w = Math.min(W0, Math.max(W0 / MAXZ, g.v.w * g.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1))), k = w / g.rect.width;
      setView({ w, x: g.anchor[0] - (mx - g.rect.left) * k, y: g.anchor[1] - (my - g.rect.top) * k });
    }
  });
  const lift = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2 && gesture?.kind === 'pinch') gesture = null; if (!ptrs.size) gesture = null; };
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);
  svg.addEventListener('click', e => {
    if (dragged) { dragged = false; e.stopPropagation(); return; }   // the end of a drag or pinch is not a tap
    const el = e.target.closest('[data-c]');
    if (el) toggle(pen, el.dataset.c);
  }, true);
  svg.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;                          // a plain wheel scrolls the sheet
    e.preventDefault();
    const [cx, cy] = toSvg(svg.getBoundingClientRect(), e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * 0.01), cx, cy);
  }, { passive: false });

  function drawShop() {
    const sel = $('.tl-country');
    sel.innerHTML = (draft.country ? '' : `<option value="">${esc(W.choose)}</option>`)
      + COUNTRIES.map(([c, n]) => `<option value="${c}" ${draft.country === c ? 'selected' : ''}>${esc(n)}</option>`).join('');
    $('.fm-example').textContent = draft.country && shopExample(draft.country) ? `"${shopExample(draft.country)}"` : '';
  }
  $('.tl-country').onchange = e => { draft.country = e.target.value || null; shopTouched = true; drawShop(); };
  // Marks follow the draft: the map's shapes, stamps and pins, the list's toggles, the shopping words
  function drawMarks() {
    root.querySelectorAll('.fm-country').forEach(el => PENS.forEach(p => el.classList.toggle(p, has(p, el.dataset.c))));
    root.querySelectorAll('.fm-t').forEach(b => b.setAttribute('aria-pressed', String(has(b.dataset.t, b.dataset.c))));
    drawStamps(); drawShop();
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
  async function open(src = 'object') {
    if (!root.hidden || opening) return;
    const opener = document.activeElement;
    opening = true;
    await loadWorld();
    opening = false;
    if (!root.hidden) return;
    inn.ideas.close(false);
    if (inn.bookView.isOpen) inn.bookView.close();
    if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto');
    from = src; shopTouched = false;
    before = { ...fmNow(), country: visit.get('country') || inn.mapDefault() || null, adventure: stepNow() };
    draft = JSON.parse(JSON.stringify(before));
    build(); choosePen('home'); drawDial();
    $('.fm-q').value = ''; filterList();
    root.hidden = false;
    root.className = `tell ${mode()} fm-sheet`;
    measure(); showAll(true);
    $('.tl-body').scrollTop = 0;
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
  addEventListener('resize', () => { if (!root.hidden) { root.className = `tell ${mode()} fm-sheet`; measure(); place(); } });

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
    const added = PENS.flatMap(p => now[p].filter(id => !was[p].includes(id)));
    if (added.length && added.every(id => !hasRecipes(byId[id]))) return W.noRecipes;   // at most this one line for a pin on a country with no dishes yet
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
