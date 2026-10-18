/**
 * What the visitor has told the Inn about themselves, kept for the whole visit and read in every room
 * (recipe-book-brief.md, addendum): today the energy candle; soon the pantry (FEAT-016) and location and
 * cuisines (FEAT-017); later any similar "tell Gemma about you" object.
 *
 * Tab only: sessionStorage, gone when the tab closes, and cleared by the notebook's "Forget this visit".
 * Nothing here is sent anywhere by this module; the navigator passes on only what it already did.
 *
 *   import { visit } from './explore/visit-state.js';
 *   visit.get('energy')                    // 'low', or null
 *   visit.set('energy', 'low')             // null or undefined removes it
 *   const off = visit.subscribe('energy', (value, key) => ...)   // '*' hears every key; returns an unsubscribe
 *   visit.all()                            // a copy of everything, e.g. { energy: 'low' }
 *   visit.clear()                          // forget it all (each key's subscribers hear null)
 *
 * Keys in use: energy (an id of world.energies). Planned: pantry (ingredient ids), location, cuisines.
 * Values must survive JSON (strings, numbers, arrays, plain objects).
 */
const KEY = 'wa-visit';

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
let data = load();
const subs = new Map();                       // key (or '*') -> Set of callbacks

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: kept for this page only */ }
}
function emit(key, value) {
  for (const k of [key, '*']) for (const fn of subs.get(k) || []) {
    try { fn(value, key); } catch (err) { console.error('visit-state subscriber', err); }
  }
}

export const visit = {
  get(key) { return data[key] ?? null; },
  all() { return JSON.parse(JSON.stringify(data)); },
  set(key, value) {
    const next = value ?? null;
    if (JSON.stringify(data[key] ?? null) === JSON.stringify(next)) return;
    if (next === null) delete data[key]; else data[key] = JSON.parse(JSON.stringify(next));
    save();
    emit(key, next);
  },
  subscribe(key, fn) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
    return () => subs.get(key)?.delete(fn);
  },
  clear() {
    const keys = Object.keys(data);
    data = {};
    save();
    keys.forEach(k => emit(k, null));
  },
};
