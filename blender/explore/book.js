// Gemma's recipe book: the recipes a visitor keeps, on this device only (recipe-book-ux.md v4 §5, §9).
// One JSON blob in localStorage `wa-book`, versioned. It outlives the visit; "Clear my book" empties it.
// Each kept recipe is a snapshot of its atom, so it survives content edits and retired atoms.
// If localStorage is blocked, the book lives in this tab's sessionStorage (or memory) for the visit, and `book.lasting` is false.

const KEY = 'wa-book';
export const BOOK_CAP = 60;

const fresh = () => ({ v: 1, kept: [], everKept: false, hint: false });
const parse = raw => { try { const b = JSON.parse(raw || 'null'); return b && b.v === 1 && Array.isArray(b.kept) ? { ...fresh(), ...b } : null; } catch { return null; } };

// Where the book can live: localStorage if it works, else sessionStorage, else memory
let area = null, lasting = false;
for (const [name, get] of [['local', () => localStorage], ['session', () => sessionStorage]]) {
  try { const s = get(); s.setItem('wa-book-test', '1'); s.removeItem('wa-book-test'); area = s; lasting = name === 'local'; break; } catch { /* blocked */ }
}
let data = (area && parse(area.getItem(KEY))) || fresh();

// Which visit a recipe was kept on: this tab's id, so "this visit's keeps" can weigh more than older ones (stage 3)
let visitId;
try { visitId = sessionStorage.getItem('wa-visit-id'); if (!visitId) { visitId = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('wa-visit-id', visitId); } }
catch { visitId = Math.random().toString(36).slice(2, 10); }

const subs = new Set();
const emit = detail => subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
function save() {
  try { area?.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked: it stays in memory for the page */ }
}
// Another tab kept or cleared something: last write wins, no merge (v1)
addEventListener('storage', e => { if (e.key === KEY && lasting) { data = parse(e.newValue) || fresh(); emit({ kind: 'sync' }); } });

/** The snapshot kept for an atom: the snippet and the seed recipe, plus why it was served. */
export function snapshot(atom, why) {
  const pick = ({ id, title, hook, room, kind, time, spoons, themes, diet, key_ingredients, method_short, body, seed, icon, short, ref }) =>
    ({ id, title, hook, room, kind, time, spoons, themes, diet, key_ingredients, method_short, body, seed, icon, short, ref });
  return { ...JSON.parse(JSON.stringify(pick(atom))), why: why || '' };
}

export const book = {
  get lasting() { return lasting; },
  get count() { return data.kept.length; },
  get everKept() { return data.everKept; },
  get visitId() { return visitId; },
  /** Newest first. Copies. */
  list() { return data.kept.map(k => ({ ...k })); },
  get(id) { const k = data.kept.find(x => x.id === id); return k ? { ...k } : null; },
  has(id) { return data.kept.some(x => x.id === id); },
  ids() { return data.kept.map(k => k.id); },
  /** Keep a snapshot. Returns { first, tuckedAway } (the oldest goes when the book is full). */
  keep(snap) {
    if (this.has(snap.id)) return { first: false, tuckedAway: null };
    const first = !data.everKept;
    data.kept.unshift({ ...snap, kept: Date.now(), visit: visitId });
    let tuckedAway = null;
    while (data.kept.length > BOOK_CAP) tuckedAway = data.kept.pop();
    data.everKept = true;
    save();
    emit({ kind: 'keep', id: snap.id });
    return { first, tuckedAway };
  },
  /** Take one out ("Take it out" on its page). Returns what was removed, for an undo. */
  remove(id) {
    const i = data.kept.findIndex(x => x.id === id);
    if (i < 0) return null;
    const [k] = data.kept.splice(i, 1);
    save();
    emit({ kind: 'remove', id });
    return { item: k, at: i };
  },
  restore({ item, at }) {
    if (this.has(item.id)) return;
    data.kept.splice(Math.min(at, data.kept.length), 0, item);
    save();
    emit({ kind: 'keep', id: item.id });
  },
  /** Empty the book. Returns an undo function (the page offers it for 5 s). */
  clear() {
    const before = data;
    data = { ...fresh(), everKept: before.everKept, hint: before.hint };
    save();
    emit({ kind: 'clear' });
    return () => { data = before; save(); emit({ kind: 'sync' }); };
  },
  /** Keep Gemma's written-out recipe with a kept one (stage 4) */
  setFull(id, full) {
    const k = data.kept.find(x => x.id === id);
    if (!k) return;
    k.full = full;
    save();
    emit({ kind: 'full', id });
  },
  /** This visit's keeps (stage 3 weighs these ×3) */
  keptThisVisit() { return data.kept.filter(k => k.visit === visitId).map(k => ({ ...k })); },
  get hint() { return data.hint; },
  set hint(v) { data.hint = !!v; save(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
