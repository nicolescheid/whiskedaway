// Cuddlecore's "How you like it" tray (Nicole, 23 Oct; cuddlecore-medicine-foods.md): the feels some people love and some
// would rather skip. Each is Skip it, Either way (the default) or More, please. A choice is respected without comment:
// Gemma takes no side, asks no reasons and gives no advice. One sheet, a layer (layers.js); every way out keeps the taps.
// The store: visit.set('feels', { spicy: 'skip', crunchy: 'more' }) (only the ones that aren't "Either way"; null forgets).
// Words: gemma-lines.json `howYouLikeIt` (content's); the ones here stand in until it's written. docs/code-map.md has the module.
import { visit } from './visit-state.js';
import { layers } from './layers.js';
import { cuisineLabel } from './tell.js';
import { FEELS, GROUPS, HEAT, names, feelClash, feelsSplit, feelsPayload } from './feels.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');

const CHOICES = [['skip', 'Skip it'], ['either', 'Either way'], ['more', 'More, please']];

export function install(inn) {
  const H = inn.LINES.howYouLikeIt || {};
  const W = {
    title: H.title || 'How you like it',
    sub: H.sub || 'Skip it, either way, or more, please. No reasons needed.',
    groups: { ...GROUPS, ...H.groups }, choices: { ...Object.fromEntries(CHOICES), ...H.choices },
    allergy: H.allergy || 'For allergies, use Dietary needs.',
    done: H.done || 'Done',
    // Her Done line: what's skipped, then what's wanted more; two named at most, never the list
    skipLine: H.skipLine || '{x}. Got it.', skipMany: H.skipMany || '{x}. Locked up. It can\'t get you in here.',
    moreLine: H.moreLine || 'And {x}, then. I\'ll lean that way.', moreOnly: H.moreOnly || '{x}, then. I\'ll lean that way.',
    cleared: H.cleared || 'All let out. Anything goes.', noted: H.noted || 'Noted.', freed: H.freed || 'Out it comes.',
    // The little cage
    cageTitle: H.cageTitle || 'The little cage', cageSub: H.cageSub || "Locked up. It can't get you in here.",
    cageEmpty: H.cageEmpty || "Nothing locked up yet. Skip something on the tray and it goes in here.",
    letOut: H.letOut || 'Let it out', putBack: H.putBack || 'Put it back', toTray: H.toTray || 'The tray',
    cage: H.cage || "My little cage. Whatever you'd rather skip goes in here.",
    tray: H.tray || "My tray of feels. Tell me how you like things, and I'll cook to suit.",
  };
  const feelById = Object.fromEntries(FEELS.map(f => [f.id, { ...f, ...H.feels?.[f.id] }]));
  const feelsNow = () => { const v = visit.get('feels'); return v && typeof v === 'object' ? v : {}; };
  const skipped = (v = feelsNow()) => feelsSplit(v).skip;
  const wanted = (v = feelsNow()) => feelsSplit(v).more;
  const capFirst = t => t.replace(/^./, c => c.toUpperCase());

  // ---------- the sheet
  const root = document.createElement('div');
  root.id = 'hyli';
  root.className = 'tell';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'hy-title');
  root.innerHTML = `<div class="tl-dim"></div><div class="tl-box hy-box">
      <header class="tl-head"><h2 id="hy-title"></h2><button class="tl-x" aria-label="Close">✕</button></header>
      <div class="tl-body"><p class="small hy-sub"></p><div class="hy-list"></div></div>
      <footer class="tl-foot"><span class="small hy-note"></span><button class="bk-outline hy-totray" hidden></button><button class="tl-done hy-done">${esc(W.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let layer = null, picks = {}, before = {}, from = 'object', view = 'tray';

  // The sheet has a view per object: the tray (every feel), the cage (what's skipped)
  function fill() {
    $('.hy-totray').hidden = view !== 'cage';
    if (view === 'cage') return fillCage();
    fillTray();
  }
  function fillTray() {
    $('#hy-title').textContent = W.title;
    $('.hy-sub').textContent = W.sub;
    $('.hy-note').textContent = W.allergy;
    $('.hy-list').innerHTML = Object.entries(W.groups).map(([g, name]) => `<h3 class="hy-group">${esc(name)}</h3>`
      + FEELS.filter(f => f.group === g).map(f => `<div class="hy-row" role="group" aria-labelledby="hy-l-${f.id}">
          <span class="hy-label" id="hy-l-${f.id}">${esc(feelById[f.id].label)}</span>
          <span class="hy-seg">${CHOICES.map(([c]) => `<button data-feel="${f.id}" data-choice="${c}" aria-pressed="${(picks[f.id] || 'either') === c}">${esc(W.choices[c])}</button>`).join('')}</span>
        </div>`).join('')).join('');
    root.querySelectorAll('[data-feel]').forEach(b => b.onclick = () => {
      const { feel, choice } = b.dataset;
      if (choice === 'either') delete picks[feel]; else picks[feel] = choice;
      root.querySelectorAll(`[data-feel="${feel}"]`).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.choice === choice)));
    });
  }

  // The cage: each skip with "Let it out"; let out, it can go back in before the sheet closes. Empty, it points to the tray
  function fillCage() {
    $('#hy-title').textContent = W.cageTitle;
    const caged = FEELS.filter(f => before[f.id] === 'skip');
    $('.hy-sub').textContent = caged.length ? W.cageSub : W.cageEmpty;
    $('.hy-note').textContent = '';
    $('.hy-totray').textContent = W.toTray;
    $('.hy-list').innerHTML = caged.map(f => `<div class="hy-row hy-caged">
        <span class="hy-icon" aria-hidden="true">${f.icon}</span><span class="hy-label" id="hy-l-${f.id}">${esc(feelById[f.id].label)}</span>
        <button class="hy-out" data-out="${f.id}" aria-pressed="${picks[f.id] !== 'skip'}" aria-describedby="hy-l-${f.id}">${esc(picks[f.id] === 'skip' ? W.letOut : W.putBack)}</button>
      </div>`).join('');
    root.querySelectorAll('[data-out]').forEach(b => b.onclick = () => {
      const id = b.dataset.out, out = picks[id] === 'skip';
      if (out) delete picks[id]; else picks[id] = 'skip';
      b.setAttribute('aria-pressed', String(out));
      b.textContent = out ? W.putBack : W.letOut;
      b.closest('.hy-row').classList.toggle('out', out);
    });
  }
  $('.hy-totray').onclick = () => { view = 'tray'; fill(); root.querySelector('.hy-seg button[aria-pressed="true"]')?.focus({ preventScroll: true }); };

  /** open(which, from): which is tray|cage; from is object|book|tag (counted with tell_open) */
  function open(which = 'tray', src = 'object') {
    if (!root.hidden) return;
    const opener = document.activeElement;
    inn.ideas.close(false);
    if (inn.bookView.isOpen) inn.bookView.close();
    if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto');
    from = src;
    before = feelsNow(); picks = { ...before }; view = which;
    fill();
    root.hidden = false;
    root.className = `tell ${mode()} hy-sheet`;
    inn.track('tell_open', { kind: view === 'cage' ? 'cage' : 'feels', from });
    layer = layers.open({ el: root, name: 'feels', opener, close: how => close({ viaBack: how === 'back' }) });
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    root.querySelector('.hy-seg button[aria-pressed="true"], .hy-out, .hy-totray:not([hidden])')?.focus({ preventScroll: true });
  }
  // Every way out keeps the taps (EVERY_WAY_KEEPS: all Tell Gemma sheets keep on every way out)
  function close({ viaBack = false } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    layers.closed(layer, { how: viaBack ? 'back' : 'self' });
    setTimeout(() => saved(before, picks), reduce() ? 0 : 200);   // after the sheet has gone, so her line isn't behind it
  }
  $('.hy-done').onclick = () => close();
  $('.tl-x').onclick = () => close();
  $('.tl-dim').onclick = () => close();
  addEventListener('resize', () => { if (!root.hidden) root.className = `tell ${mode()} hy-sheet`; });

  // The answer goes into the store once, then one line from Gemma (no reasons, no advice, no side taken)
  function saved(was, now) {
    if (JSON.stringify(sorted(was)) === JSON.stringify(sorted(now))) return;
    visit.set('feels', Object.keys(now).length ? now : null);
    inn.track('tell_set', { kind: 'feels', count: bucket(Object.keys(now).length), from });   // how many, never which
    const line = feelsLine(was, now);
    if (line) { inn.say(line, [], true); inn.holdLine(); }
    offerMild(was, now);
    inn.scheduleNavigate();
  }
  const sorted = o => Object.fromEntries(Object.entries(o).sort());
  function feelsLine(was, now) {
    if (!Object.keys(now).length) return W.cleared;
    const newly = (v, c) => FEELS.filter(f => now[f.id] === c && was[f.id] !== c).map(f => feelById[f.id]);
    const s = newly(now, 'skip'), m = newly(now, 'more');
    const skipText = s.length ? (s.length === 1 ? W.skipLine : W.skipMany).replace('{x}', capFirst(inn.listOf(s.slice(0, 2).map(f => f.skip.toLowerCase())))) : '';
    const moreWords = inn.listOf(m.slice(0, 2).map(f => f.more));
    const moreText = m.length ? (s.length ? W.moreLine : W.moreOnly).replace('{x}', s.length ? moreWords : capFirst(moreWords)) : '';
    const freed = FEELS.some(f => was[f.id] === 'skip' && now[f.id] !== 'skip');
    return [skipText, moreText].filter(Boolean).join(' ') || (freed ? W.freed : W.noted);
  }

  // What you've told me (panels.js TOLD): "How you like it: nothing spicy and no coriander; more crunch."
  function told(v) {
    const s = skipped(v || {}).map(id => feelById[id].skip.toLowerCase()), m = wanted(v || {}).map(id => feelById[id].more);
    if (!s.length && !m.length) return '';
    return `${W.title}: ${[s.length && inn.listOf(s), m.length && `${inn.listOf(m)}, please`].filter(Boolean).join('; ')}.`;
  }

  // ---------- the filter (serving.js steer, centrepieces.js canServe, tell-glue.js fits): the cage always wins, before the
  // kitchen loosens. A room left with only caged ideas is loosened for the feels (never the bell jar): Gemma says so once
  const feelsCaged = a => feelClash(a, skipped());
  const likeClash = a => (inn.state.feelsLoose?.[a.room] ? null : feelsCaged(a));
  function loosenFeels(home) {
    if (!skipped().length || inn.state.feelsLoose?.[home]) return null;
    (inn.state.feelsLoose ||= {})[home] = true;
    return inn.pickLine('feels.loosen', [].concat(H.loosen || "Everything left in here has something you skipped. I'll bring it out anyway, and you can set aside what you don't fancy."));
  }
  // A changed tray starts every room afresh
  visit.subscribe(({ part, key }) => {
    if (part !== 'all' && key !== 'feels') return;
    inn.state.feelsLoose = {};
    // Cards already out that are now caged go back, quietly: her Done line has already said what's skipped
    inn.state.cards.filter(c => inn.atomsById[c.atom] && likeClash(inn.atomsById[c.atom])).forEach(c => inn.ideas.remove(c.atom));
  });
  /** What the write-out sends (basket-glue.js payloadFor): words, never ids */
  const payload = () => feelsPayload(feelsNow());
  /** A swap that names something caged (basket-glue.js swapsFor leaves it out) */
  const caged = text => skipped().some(id => names(id, text));

  // ---------- mild ways in (PM's idea, approved 23 Oct): with heat caged, Gemma may offer a cuisine's mild dishes, labelled
  // mild, once a visit and never pushed. Content marks a card `mild_way_in: "<cuisine>"`; until one is marked, nothing happens
  function offerMild(was, now) {
    if (inn.state.mildOffered || !HEAT.some(id => now[id] === 'skip' && was[id] !== 'skip')) return;
    const fancy = [].concat(visit.get('cuisines') || []);
    const ok = a => a.mild_way_in && !likeClash(a) && !inn.dietClash(a) && inn.canServe(a);
    const a = inn.world.atoms.find(x => ok(x) && fancy.includes(x.mild_way_in)) || inn.world.atoms.find(ok);
    if (!a) return;
    inn.state.mildOffered = true;
    const line = (H.mild || "If you ever fancy {cuisine}, it has mild ways in. {title} is one, and it's mild.")
      .replace('{cuisine}', cuisineLabel(a.mild_way_in)).replace('{title}', a.title);
    setTimeout(() => {
      inn.say(line, [], true);
      inn.setChips([{ label: H.mildYes || 'Show me', do: ['mild', a.id] }, { label: H.mildNo || 'Not now', do: ['mildNo'] }]);
    }, 3200);                                                       // after her Done line has had its 3 s
  }
  inn.CHIP_ACTS.mild = id => inn.showIdea(inn.atomsById[id], 'chat');
  inn.CHIP_ACTS.mildNo = () => {};

  // ---------- the cage's overlay: what's skipped, drawn inside the cage like the candle flames (inn.spriteFrom, candles.js).
  // At the hotspot's `inside` point (art adds it with the render; until then the hotspot itself, 2.4 m away). Until the cage
  // is painted into the render, a wire cage is drawn too (CAGE_PAINTED, docs/art-brief-cuddlecore-tray.md)
  const CAGE_PAINTED = false;
  // Made on first use: spriteFrom is candles.js's, installed after this module
  let cageSprite = null;
  function drawCage(ids) {
    const c = cageSprite.material.map.image, g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    if (!CAGE_PAINTED) {
      g.strokeStyle = 'rgba(176, 141, 72, 0.95)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(128, 236, 92, 12, 0, 0, Math.PI * 2); g.stroke();                // the base ring
      g.beginPath(); g.arc(128, 104, 92, Math.PI, 0); g.stroke();                               // the dome
      for (let i = 0; i <= 8; i++) {                                                             // the bars
        const x = 36 + i * 23, top = 104 - Math.sqrt(Math.max(0, 92 * 92 - (x - 128) ** 2));
        g.beginPath(); g.moveTo(x, top); g.lineTo(x, 236); g.stroke();
      }
      g.beginPath(); g.arc(128, 6, 7, 0, Math.PI * 2); g.stroke();                              // the ring at the top
      g.beginPath(); g.moveTo(128, 13); g.lineTo(128, 24); g.stroke();
    }
    // Up to six tokens on the cage floor, two rows (the first skipped at the front)
    g.font = '44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    ids.slice(0, 6).forEach((id, i) => {
      const row = i < 3 ? 0 : 1, col = i % 3;
      g.globalAlpha = row ? 0.85 : 1;
      g.fillText(FEELS.find(f => f.id === id).icon, 80 + col * 48 + (row ? 24 : 0), row ? 170 : 205);
    });
    g.globalAlpha = 1;
    cageSprite.material.map.needsUpdate = true;
  }
  function showCage() {
    const s = inn.spots?.cage;
    if (!s && !cageSprite) return;
    if (!cageSprite) { cageSprite = inn.spriteFrom(() => {}, false); cageSprite.renderOrder = 12; }
    cageSprite.visible = !!s;
    if (s) {
      const p = s.inside || { yaw: s.yaw, pitch: s.pitch, distance: 2.4 };
      const near = 10 / Math.max(p.distance || 2.4, 0.4);       // the sphere sits at 10 units: scale real metres to it
      cageSprite.scale.set(0.3 * near, 0.3 * near, 1);
      cageSprite.position.copy(inn.dir(p.yaw, p.pitch).multiplyScalar(10));
      drawCage(skipped());
    }
    inn.render();
  }
  // Only in the room with a cage: rooms.js's goRoom rebuilds the hotspots (and the bootstrap builds the first room's), so the
  // overlay follows that
  const buildHotspots = inn.buildHotspots;
  inn.buildHotspots = (...a) => { buildHotspots(...a); showCage(); };
  visit.subscribe(({ part, key }) => { if (part === 'all' || key === 'feels') showCage(); });

  inn.howYouLike = { open, told, skipped, wanted, feelById, payload, caged, get isOpen() { return !root.hidden; } };
  Object.assign(inn, { likeClash, feelsCaged, loosenFeels });

  // Taps (touch.js order 25: after the chia drawers, before the kitchen): the tray opens the sheet after her line
  inn.onTouch(25, obj => obj.tool === 'feels' || obj.tool === 'cage', (obj, id) => {
    const cage = obj.tool === 'cage';
    inn.say(inn.momentOf(id, obj) || (cage ? (skipped().length ? W.cageSub : W.cage) : W.tray), [], true);
    inn.holdLine();
    open(cage ? 'cage' : 'tray', 'object');
  });
}
