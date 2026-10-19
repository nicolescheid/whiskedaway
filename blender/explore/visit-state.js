/**
 * What the visitor has told the Inn, kept for the whole visit and read in every room (recipe-book-brief.md addendum;
 * ux-journey-stage1.md rule 11 and "What you've told Gemma"; recipe-book-ux.md §6b).
 *
 * Two parts:
 *   ABOUT YOU, Inn-wide:   energy, feeling, dietary[], pantry[], location, cuisines[]  (only energy is in use so far)
 *   FOR THIS DISH, per room: e.g. { 'sweet-spells': { flavour, occasion }, chiapothecary: { mood, base, flavour, topping },
 *                             flourish: { goal } }
 *
 * Tab only: sessionStorage ('wa-visit'), gone when the tab closes, cleared by the notebook's "Forget this visit".
 * Nothing here is sent anywhere by this module; the navigator passes on only what it already did.
 *
 *   import { visit } from './explore/visit-state.js';
 *   visit.get('energy')                         // 'low', or null
 *   visit.set('energy', 'low')                  // the latest wins; null or undefined forgets it
 *   visit.forget('energy')
 *   visit.dish('sweet-spells')                  // { flavour: 'citrus' }, or {} (a copy)
 *   visit.dish('sweet-spells', 'flavour')       // 'citrus', or null
 *   visit.setDish('sweet-spells', 'flavour', 'citrus')   // null forgets it
 *   visit.forgetDish('sweet-spells')            // that room's dish answers; or forgetDish(room, key)
 *   visit.all()                                 // { about: {...}, dish: { room: {...} } } (a copy)
 *   visit.clear()                               // forget everything
 *   const off = visit.subscribe(fn)             // fn({ part, room, key, value }) on every change; returns an unsubscribe
 *   addEventListener('wa-visit-state', e => e.detail)   // the same change, as a window event, for code that isn't a module
 *
 * A change's detail: { part: 'about' | 'dish' | 'all', room (dish only), key, value } ('all' with key null after clear()).
 * Values must survive JSON (strings, numbers, arrays, plain objects).
 */
const KEY = 'wa-visit';
const EVENT = 'wa-visit-state';
const copy = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function load() {
  let d = {};
  try { d = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { /* storage blocked */ }
  if (!d.about && !d.dish) d = { about: d };      // the first version was flat ({ energy }): it was all about you
  return { about: d.about || {}, dish: d.dish || {} };
}
let data = load();
const subs = new Set();

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: kept for this page only */ }
}
function emit(detail) {
  for (const fn of subs) { try { fn(detail); } catch (err) { console.error('visit-state subscriber', err); } }
  try { dispatchEvent(new CustomEvent(EVENT, { detail })); } catch { /* no window (tests) */ }
}

export const visit = {
  // About you (Inn-wide)
  get(key) { return copy(data.about[key] ?? null); },
  set(key, value) {
    const next = copy(value);
    if (same(data.about[key], next)) return;
    if (next === null) delete data.about[key]; else data.about[key] = next;
    save();
    emit({ part: 'about', key, value: copy(next) });
  },
  forget(key) { this.set(key, null); },

  // For this dish (per room)
  dish(room, key) { const d = data.dish[room] || {}; return key === undefined ? copy(d) : copy(d[key] ?? null); },
  setDish(room, key, value) {
    const next = copy(value), d = data.dish[room] || {};
    if (same(d[key], next)) return;
    if (next === null) delete d[key]; else d[key] = next;
    if (Object.keys(d).length) data.dish[room] = d; else delete data.dish[room];
    save();
    emit({ part: 'dish', room, key, value: copy(next) });
  },
  forgetDish(room, key) {
    if (key !== undefined) return this.setDish(room, key, null);
    if (!data.dish[room]) return;
    delete data.dish[room];
    save();
    emit({ part: 'dish', room, key: null, value: null });
  },

  all() { return copy(data); },
  clear() {
    data = { about: {}, dish: {} };
    save();
    emit({ part: 'all', key: null, value: null });
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
