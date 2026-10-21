// Inn notes (brainstorm-1 D4): the little stories a visitor finds by touching objects, kept at the back of the book.
// Stored like the book (book.js): one JSON blob in localStorage `wa-notes`, on this device only, emptied by "Clear my book".
// Note ids only (each is its object's id), never the text, so the copy in gemma-lines.json `innNotes` can change later.

const KEY = 'wa-notes';

const fresh = () => ({ v: 1, found: [] });
const parse = raw => { try { const n = JSON.parse(raw || 'null'); return n && n.v === 1 && Array.isArray(n.found) ? n : null; } catch { return null; } };

// Where the notes can live: the same order as the book's (localStorage, else this tab's sessionStorage, else memory)
let area = null;
for (const get of [() => localStorage, () => sessionStorage]) {
  try { const s = get(); s.setItem('wa-notes-test', '1'); s.removeItem('wa-notes-test'); area = s; break; } catch { /* blocked */ }
}
let data = (area && parse(area.getItem(KEY))) || fresh();

const subs = new Set();
const emit = detail => subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
function save() {
  try { area?.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked: it stays in memory for the page */ }
}
addEventListener('storage', e => { if (e.key === KEY && area === localStorage) { data = parse(e.newValue) || fresh(); emit({ kind: 'sync' }); } });

export const notes = {
  get count() { return data.found.length; },
  has(id) { return data.found.includes(id); },
  /** In the order found */
  list() { return [...data.found]; },
  /** Returns true if it's new */
  add(id) {
    if (this.has(id)) return false;
    data.found.push(id);
    save();
    emit({ kind: 'add', id });
    return true;
  },
  /** Empty them (with "Clear my book"). Returns an undo function. */
  clear() {
    const before = data;
    data = fresh();
    save();
    emit({ kind: 'clear' });
    return () => { data = before; save(); emit({ kind: 'sync' }); };
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
