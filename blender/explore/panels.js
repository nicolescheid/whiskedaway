// The fixed navigation (moved out of explore.html, architecture step 3): the bar's and chat's heights (fitDock), the
// notebook (renderTold: what you've told me; renderNotes: the trail), the bar's Front door and Forget, and what follows
// a change to the visit store. The Map button is the Inn map's (inn-map.js). Shared through `inn` (docs/code-map.md).
import { visit } from './visit-state.js';
import { sweetTold } from './sweet-spells.js';
import { toldLine } from './checkin.js';
import { countryLabel } from './tell.js';
import { layers } from './layers.js';
import { kitchenPicks, kitchenWords, NONE as NO_COOKING } from './kitchen.js';

export function install(inn) {
  Object.assign(inn, { fitDock, fromBook, renderNotes });   // its functions, for the other modules (hoisted)
  // The top bar's and the chat's heights: the highlight, the undo and Turnstile's box sit between them on phones
  function fitDock() {
    const s = document.documentElement.style;
    s.setProperty('--bar-h', `${Math.round(document.querySelector('.bar').getBoundingClientRect().bottom)}px`);
    s.setProperty('--chat-h', `${Math.round(innerHeight - inn.$('chatwin').getBoundingClientRect().top)}px`);
    s.setProperty('--ideas-h', `${Math.round(inn.ideas.el.getBoundingClientRect().height)}px`);   // the theme caption sits above the column
    inn.ideas.place();
  }
  const fitter = new ResizeObserver(fitDock);
  fitter.observe(document.querySelector('.bar'));
  fitter.observe(inn.$('chatwin'));
  fitter.observe(inn.ideas.el);
  addEventListener('resize', fitDock);

  // ---------- the notebook
  // The notebook's "What you've told me" (its own block: it becomes the book's "This visit" page): what the visitor told
  // the Inn about themselves, in Gemma's words, each with its own "forget". An energy's line is its "told" in
  // cuddlecore-world.json when the content editor adds one; until then these.
  const TOLD_ENERGY = { 'burnt-out': "You're running on empty today.", low: "You're running low today.",
                        half: "You've got about half your energy today.", 'three-quarters': "You've got plenty in you today.",
                        full: "You're full of beans today." };
  const TOLD = { energy: v => inn.world.energies?.[v] && (inn.world.energies[v].told || TOLD_ENERGY[v]),
                 dietary: v => [].concat(v || []).length && `You're eating ${listOf([].concat(v).map(d => inn.DIET_WORD[d] || d))}.`,
                 dietaryOther: v => v && `And you'd rather avoid: ${v}.`,
                 pantry: v => (Array.isArray(v) ? v : v?.items || []).length && `You've got ${listOf(Array.isArray(v) ? v : v.items)}${v?.useUp ? ' to use up' : ''}.`,
                 foodMap: v => inn.foodMap.told(v),
                 adventure: v => v && `${inn.LINES.foodMap?.dialTold || 'How far tonight'}: ${(inn.LINES.foodMap?.steps || {})[v] || ['', 'close to home', 'familiar, with a twist', 'a little further', 'further afield', 'somewhere new'][v] || v}.`,
                 country: v => v && `Shopping words for ${countryLabel(v) || v}.`,
                 kitchen: v => kitchenPicks(v).length && `${inn.LINES.kitchen?.visit_row || 'Your kitchen'}: ${kitchenPicks(v)[0] === NO_COOKING ? kitchenWords(v, inn.LINES.kitchen)[0] : listOf(kitchenWords(v, inn.LINES.kitchen))}.`,
                 feels: v => inn.howYouLike.told(v), keepingOff: v => inn.howYouLike.toldJar(v),
                 time: v => toldLine(inn.CW, 'time', v), servings: v => toldLine(inn.CW, 'servings', v), confidence: v => toldLine(inn.CW, 'confidence', v), ...sweetTold(inn.sweet.data) };
  const TOLD_SHEET = { kitchen: 'kitchen', dietary: 'dietary', dietaryOther: 'dietary', pantry: 'pantry', foodMap: 'map', adventure: 'map', country: 'map', time: 'checkin', servings: 'checkin', confidence: 'checkin', sweetness: 'sweet', sweeteners: 'sweet', feels: 'feels', keepingOff: 'jar' };
  const listOf = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`); inn.listOf = listOf;
  function renderTold() {
    const rows = Object.entries(visit.all().about).map(([k, v]) => [k, TOLD[k]?.(v)]).filter(([, text]) => text);
    inn.$('told').innerHTML = (rows.length ? rows.map(([k, text]) => `<li>${inn.esc(text)} ${TOLD_SHEET[k] ? `<button class="link" data-change="${inn.esc(TOLD_SHEET[k])}">change</button> ` : ''}<button class="link" data-forget="${inn.esc(k)}" aria-label="Forget this: ${inn.esc(text)}">forget</button></li>`).join('')
      : `<li>Nothing yet. Light a candle in the kitchen and I'll remember it.</li>`) + `<li><button class="link" data-menu>Tell me about you</button></li>`;
    inn.$('told').querySelectorAll('[data-forget]').forEach(b => b.onclick = () => visit.forget(b.dataset.forget));
    inn.$('told').querySelectorAll('[data-change]').forEach(b => b.onclick = fromBook(() => (b.dataset.change === 'sweet' ? inn.sweet.open('sweet', 'book') : ['feels', 'jar'].includes(b.dataset.change) ? inn.howYouLike.open(b.dataset.change === 'jar' ? 'jar' : 'tray', 'book')
      : inn.tell.open(b.dataset.change, 'book'))));
    inn.$('told').querySelector('[data-menu]')?.addEventListener('click', fromBook(() => inn.tell.openMenu('book')));
  }
  // A sheet opened from inside the book waits for the book's step back in history: otherwise that late step lands on the
  // sheet's own history entry and closes it again (QA 9 issue 1)
  function fromBook(fn) {
    return () => {
      if (!inn.bookView.isOpen) return fn();
      inn.bookView.close();
      layers.afterBack(fn);
    };
  }
  visit.subscribe(({ part, key, value }) => {
    renderTold();
    if (part === 'all' || key === 'energy') inn.showCandle();               // forgetting the energy puts the candle out
    if (part === 'all' || key === 'kitchen') { inn.state.kitchenLoose = {}; if (part === 'about' && !value) inn.scheduleNavigate(); }
    if (part === 'about' && ['energy', 'time', 'servings', 'confidence'].includes(key) && !value) inn.scheduleNavigate();
    if ((part === 'about' && key === 'servings') || part === 'all') inn.bookView.refresh();   // the shopping list's amounts
    if ((part === 'about' && key === 'dietary') || part === 'all') {
      const gone = inn.state.cards.filter(c => inn.atomsById[c.atom] && inn.dietClash(inn.atomsById[c.atom]));
      gone.forEach(c => inn.ideas.remove(c.atom));
      if (gone.length) {
        const a = inn.atomsById[gone[0].atom];
        inn.say((inn.LINES.diet_clash || "I've taken the {title} away. It isn't {diet}.").replace('{title}', a.short?.toLowerCase() || a.title).replace('{diet}', inn.dietClash(a)), [], true);
      }
      inn.bookView.refresh();
    }
  });
  function renderNotes() {
    renderTold();
    const r = inn.state.result;
    let pass = null;
    try { pass = JSON.parse(sessionStorage.getItem('wa-genie-pass') || 'null'); } catch { /* ignore */ }
    inn.$('visitor').textContent = !inn.AI ? 'Not needed in local mode.'
      : pass && pass.until > Date.now() ? `Passed ✓ (good for ${Math.round((pass.until - Date.now()) / 60000)} more minutes)`
      : (() => { try { const e = sessionStorage.getItem('wa-genie-error'); return e ? `Didn't pass (${/timeout/.test(e) ? 'the check took too long' : /unavailable/.test(e) ? "the check couldn't load" : 'the check failed'}), so Gemma is reading your wander on her own.` : null; } catch { return null; } })()
        || 'Not passed yet. Gemma checks quietly the first time you wander.';
    inn.$('guess').textContent = r?.hypothesis ? `You might be after ${r.hypothesis}.` : 'Nothing yet. Have a wander.';
    inn.$('conf').style.width = `${Math.round((r?.confidence || 0) * 100)}%`;
    const verbs = { touch: 'Touched', linger: 'Lingered by', map: 'Looked on the map for', open: 'Read', dismiss: 'Set aside', keep: 'Kept', recipe: 'Got the full recipe for', choose: 'Chose', weather: 'Turned the barometer to', time: 'Pushed the clock to', room: 'Went into', dial: 'Turned the dial to', energy: 'Picked the', season: 'Turned the seasons wheel to' };
    // Sightings of Erwina sit among the trail by time, as plain lines (they're kept by erwina.js, not in the trail)
    const cat = (inn.erwina?.notes() || []).map(n => ({ t: n.t, html: `<li>${inn.esc(inn.erwinaNote(n.sure))}</li>` }));
    inn.$('trail').innerHTML = inn.state.trail.slice().reverse().slice(0, 25).filter(e => verbs[e.kind]).map(e => ({ t: e.t || 0, html:
      `<li>${verbs[e.kind]} ${inn.esc(e.kind === 'weather' ? inn.world.weathers[e.id]?.label : e.kind === 'time' ? inn.world.times[e.id]?.label.toLowerCase() : e.kind === 'energy' ? inn.world.energies[e.id]?.candle : e.kind === 'season' ? inn.world.seasons[e.id]?.label.toLowerCase() : e.kind === 'room' ? inn.ROOMS[e.id]?.title.replace(/^The /, 'the ') : e.kind === 'dial' ? e.id : e.id ? (inn.world.objects[e.id]?.ref || inn.label(e.id)) : e.atom ? inn.atomsById[e.atom]?.title : inn.world.clusters[e.cluster]?.label)}</li>` })).concat(cat)
      .sort((a, b) => b.t - a.t).slice(0, 25).map(i => i.html).join('');
  }
  // The bar's "Front door" does what the hall's front door does (J6): Gemma says goodbye, then the door picture
  inn.$('btn-inn').onclick = e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;          // a new tab or window: let the link be a link
    e.preventDefault();
    inn.track('leave_to_inn', { room: inn.state.room, step: inn.stepNow() });
    inn.say(inn.hallWorld.objects['front-door']?.leaving || 'Mind the step, love.', [], true);
    setTimeout(() => { location.href = inn.$('btn-inn').href; }, 1200);
  };
  inn.$('forget').onclick = () => {
    inn.track('visit_forget');
    inn.store.clear();
    visit.clear();                               // what they told the Inn goes too
    Object.assign(inn.state, { trail: [], served: [], dismissed: [], cards: [], waiting: null, ideaSeen: false, keeps: 0, dismissals: 0, linesUsed: {}, result: null, weather: inn.world.default_weather || 'rain', time: null, season: null, seasonTold: false, introduced: [], asked: false, chat: [] });
    inn.showCandle();
    inn.renderChat(); inn.setChips([]);
    inn.setHands(inn.handsHour());
    inn.showWeather(inn.state.weather);
    inn.ideas.clearAll(); inn.writer.clear(); renderNotes(); inn.applyReveal([]);
    inn.chatLine('gemma', 'Forgotten. Fresh start. Have a wander.');
  };
}
