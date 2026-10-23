// Sweet Spells, wired to the Inn (moved out of explore.html, architecture step 3): its sheets (sweet = createSweetSheets),
// the room's tools (SWEET_TOOLS: cabinet, spell books, lectern) and the swap-the-sugar lines on its recipe pages
// (sweetSwapHtml). The sheets themselves are sweet-spells.js. Shared through `inn` (docs/code-map.md).
import { visit } from './visit-state.js';
import { sound } from './sound.js';
import { createSweetSheets, swapLines } from './sweet-spells.js';

export function install(inn) {
  Object.assign(inn, { sweetSwapHtml });   // its functions, for the other modules (hoisted)
  // ---------- Sweet Spells (explore/sweet-spells.js, rooms-views.md Stage B): the cabinet asks how sweet, the spell books the
  // cravings, the lectern's Occasions book what it's for (suggesting servings and time only where the check-in hasn't answered)
  const sweet = createSweetSheets({
    visit, lines: inn.LINES, track: inn.track, sound,
    beforeOpen: () => { inn.ideas.close(false); if (inn.bookView.isOpen) inn.bookView.close(); if (inn.chatUI.size === 'full') inn.chatUI.choose('short', 'auto'); },
    say: t => { inn.say(t, [], true); inn.holdLine(); inn.scheduleNavigate(); },
    // With the check-in in, its own setter (the same tag and store); before it, just the store
    answer: (k, v) => {
      if (typeof inn.setAnswer === 'function') inn.setAnswer(k, v, { from: 'occasion', quiet: true });
      else { visit.set(k, v); inn.track('tell_set', { kind: k, from: 'occasion' }); }
    },
  }); inn.sweet = sweet;
  const SWEET_TOOLS = { 'level-up': () => sweet.open('sweet'), flavour: () => sweet.open('cravings'), occasion: () => sweet.open('occasion') }; inn.SWEET_TOOLS = SWEET_TOOLS;
  // The swap-the-sugar lines on a Sweet Spells recipe page, when the visitor's sweetener differs from the recipe's (read from the
  // atom: a page's snapshot doesn't carry sweetener or added_sugar)
  function sweetSwapHtml(rec) {
    if (rec.room !== 'sweet-spells') return '';
    return `<div class="bk-swapslot" data-id="${inn.esc(rec.id)}">${sweetSwapInner(rec.id)}</div>`;
  }
  function sweetSwapInner(id) {
    const xs = swapLines(sweet.data, inn.atomsById[id] || {}, { sweetness: visit.get('sweetness'), sweeteners: visit.get('sweeteners'), dietary: visit.get('dietary') });
    return xs.length ? `<div class="bk-swap"><h4>${inn.esc(sweet.data.swap.title)}</h4>${xs.map(x => `<p>${inn.esc(x)}</p>`).join('')}</div>` : '';
  }
  // Low-FODMAP chosen on the page itself (Anything to avoid?): the swap line follows, without redrawing the page's diet chips
  addEventListener('wa-visit-state', e => {
    if (!['dietary', 'sweetness', 'sweeteners', null].includes(e.detail.key)) return;
    document.querySelectorAll('.bk-swapslot').forEach(el => { el.innerHTML = sweetSwapInner(el.dataset.id); });
  });

  // Taps (explore/touch.js): Sweet Spells' cabinet, spell books and lectern open their sheets
  inn.onTouch(100, obj => SWEET_TOOLS[obj.tool] && inn.state.room === 'sweet-spells', obj => { SWEET_TOOLS[obj.tool](); });
}
