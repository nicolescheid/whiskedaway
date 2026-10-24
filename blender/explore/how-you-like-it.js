// Cuddlecore's "How you like it" tray (Nicole, 23 Oct; cuddlecore-medicine-foods.md): the feels some people love and some
// would rather skip. Each is Skip it, Either way (the default) or More, please. A choice is respected without comment:
// Gemma takes no side, asks no reasons and gives no advice. One sheet, a layer (layers.js); every way out keeps the taps.
// The store: visit.set('feels', { spicy: 'skip', crunchy: 'more' }) (only the ones that aren't "Either way"; null forgets).
// Words: gemma-lines.json `howYouLikeIt` (content's); the ones here stand in until it's written. docs/code-map.md has the module.
import { visit } from './visit-state.js';
import { layers } from './layers.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mode = () => (matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 'land'
  : matchMedia('(max-width: 719px)').matches ? 'phone' : 'desk');
const bucket = n => (n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : '4+');

// The feels, in the tray's order. skip/more: Gemma's short words for her Done line; icon: the cage's overlay
export const FEELS = [
  { id: 'spicy', group: 'flavour', label: 'Spicy heat', skip: 'Nothing spicy', more: 'a bit more heat', icon: '🌶️' },
  { id: 'strong-spice', group: 'flavour', label: 'Strongly spiced', skip: 'Nothing strongly spiced', more: 'plenty of spice', icon: '🫚' },
  { id: 'strong-flavours', group: 'flavour', label: 'Strong flavours', skip: 'No strong flavours', more: 'big flavours', icon: '🧀' },
  { id: 'smells', group: 'flavour', label: 'Strong smells', skip: 'No strong smells', more: 'a good strong smell', icon: '🧄' },
  { id: 'bitter', group: 'flavour', label: 'Bitter', skip: 'Nothing bitter', more: 'a bitter edge', icon: '☕' },
  { id: 'sour', group: 'flavour', label: 'Very sour', skip: 'Nothing very sour', more: 'something sour', icon: '🍋' },
  { id: 'coriander', group: 'flavour', label: 'Coriander', skip: 'No coriander', more: 'more coriander', icon: '🌿' },
  { id: 'slippery', group: 'texture', label: 'Slippery', skip: 'Nothing slippery', more: 'something slippery', icon: '🍄' },
  { id: 'crunchy', group: 'texture', label: 'Very crunchy', skip: 'Nothing too crunchy', more: 'a good crunch', icon: '🥨' },
  { id: 'bits', group: 'texture', label: 'Bits in smooth things', skip: 'No bits in smooth things', more: 'bits in smooth things', icon: '🥣' },
  { id: 'seeds', group: 'bits', label: 'Seeds and pips', skip: 'No seeds', more: 'seeds and pips', icon: '🌻' },
  { id: 'nuts', group: 'bits', label: 'Nuts', skip: 'No nuts', more: 'nuts', icon: '🥜' },
  { id: 'skins', group: 'bits', label: 'Skins and husks', skip: 'No skins or husks', more: 'skins and husks', icon: '🥔' },
];
const GROUPS = { flavour: 'Heat and flavour', texture: 'Textures', bits: 'Bits and pieces' };
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
    cleared: H.cleared || 'All let out. Anything goes.', noted: H.noted || 'Noted.',
    tray: H.tray || "My tray of feels. Tell me how you like things, and I'll cook to suit.",
  };
  const feelById = Object.fromEntries(FEELS.map(f => [f.id, { ...f, ...H.feels?.[f.id] }]));
  const feelsNow = () => { const v = visit.get('feels'); return v && typeof v === 'object' ? v : {}; };
  const skipped = (v = feelsNow()) => FEELS.filter(f => v[f.id] === 'skip').map(f => f.id);
  const wanted = (v = feelsNow()) => FEELS.filter(f => v[f.id] === 'more').map(f => f.id);
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
      <footer class="tl-foot"><span class="small hy-note"></span><button class="tl-done hy-done">${esc(W.done)}</button></footer>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  let layer = null, picks = {}, before = {}, from = 'object';

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

  /** open(from): from is object|book|tag (counted with tell_open) */
  function open(src = 'object') {
    if (!root.hidden) return;
    const opener = document.activeElement;
    inn.ideas.close(false);
    if (inn.bookView.isOpen) inn.bookView.close();
    if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto');
    from = src;
    before = feelsNow(); picks = { ...before };
    fillTray();
    root.hidden = false;
    root.className = `tell ${mode()} hy-sheet`;
    inn.track('tell_open', { kind: 'feels', from });
    layer = layers.open({ el: root, name: 'feels', opener, close: how => close({ viaBack: how === 'back' }) });
    if (!reduce()) $('.tl-box').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    root.querySelector('.hy-seg button[aria-pressed="true"]')?.focus({ preventScroll: true });
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
    return [skipText, moreText].filter(Boolean).join(' ') || W.noted;
  }

  // What you've told me (panels.js TOLD): "How you like it: nothing spicy and no coriander; more crunch."
  function told(v) {
    const s = skipped(v || {}).map(id => feelById[id].skip.toLowerCase()), m = wanted(v || {}).map(id => feelById[id].more);
    if (!s.length && !m.length) return '';
    return `${W.title}: ${[s.length && inn.listOf(s), m.length && `more of ${inn.listOf(m)}`].filter(Boolean).join('; ')}.`;
  }

  inn.howYouLike = { open, told, skipped, wanted, feelById, get isOpen() { return !root.hidden; } };

  // Taps (touch.js order 25: after the chia drawers, before the kitchen): the tray opens the sheet after her line
  inn.onTouch(25, obj => obj.tool === 'feels', (obj, id) => {
    inn.say(inn.momentOf(id, obj) || W.tray, [], true);
    inn.holdLine();
    open('object');
  });
}
