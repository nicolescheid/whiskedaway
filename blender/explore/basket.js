// The recipe basket (Stage 1, docs/basket-stage1-design.md): the ideas a visitor keeps, as leaflets, until Gemma writes
// them out into the book at checkout. On this device only, in localStorage `wa-basket` (sessionStorage or memory if blocked),
// like the book. Leaflets not written stay across visits.

const KEY = 'wa-basket';
export const BASKET_CAP = 30;

const fresh = () => ({ v: 1, items: [] });
const parse = raw => { try { const b = JSON.parse(raw || 'null'); return b && b.v === 1 && Array.isArray(b.items) ? b : null; } catch { return null; } };

let area = null;
for (const get of [() => localStorage, () => sessionStorage]) {
  try { const s = get(); s.setItem('wa-basket-test', '1'); s.removeItem('wa-basket-test'); area = s; break; } catch { /* blocked */ }
}
let data = (area && parse(area.getItem(KEY))) || fresh();

const subs = new Set();
const emit = detail => subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
const save = () => { try { area?.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked: memory for the page */ } };
addEventListener('storage', e => { if (e.key === KEY) { data = parse(e.newValue) || fresh(); emit({ kind: 'sync' }); } });

export const basket = {
  get count() { return data.items.length; },
  /** Newest first. Copies. */
  list() { return data.items.map(x => ({ ...x })); },
  get(id) { const x = data.items.find(k => k.id === id); return x ? { ...x } : null; },
  has(id) { return data.items.some(k => k.id === id); },
  /** Add a snapshot (book.js snapshot()). Returns false if it was already in. The oldest goes past the cap. */
  add(snap) {
    if (this.has(snap.id)) return false;
    data.items.unshift({ ...snap, added: Date.now() });
    data.items.length = Math.min(data.items.length, BASKET_CAP);
    save();
    emit({ kind: 'add', id: snap.id });
    return true;
  },
  remove(id) {
    const i = data.items.findIndex(k => k.id === id);
    if (i < 0) return null;
    const [x] = data.items.splice(i, 1);
    save();
    emit({ kind: 'remove', id });
    return { item: x, at: i };
  },
  restore({ item, at }) {
    if (this.has(item.id)) return;
    data.items.splice(Math.min(at, data.items.length), 0, item);
    save();
    emit({ kind: 'add', id: item.id });
  },
  /** Empty it ("Clear my book" takes the basket too). Returns an undo function. */
  clear() {
    const before = data;
    data = fresh(); save(); emit({ kind: 'clear' });
    return () => { data = before; save(); emit({ kind: 'sync' }); };
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
