// The Inn's layers (code-health-plan.md step 2, accessibility-review-1.md section A): one stack for every sheet, dialog and
// overlay above the room. It owns what each sheet used to do by hand, so a new one can't forget a rule:
//   - history: one step per layer. Back closes the top layer, and only that; a layer closed any other way takes its own step
//     back. A layer opened while a step back is still landing waits for it (that used to be fromBook, closeThen and whenFree's
//     400 ms timers)
//   - inert: everything outside the top modal layer is inert (other layers too); nothing is ours once the stack is empty.
//     Live regions (aria-live) stay out of it, so Gemma's lines are still announced over a sheet
//   - Escape: the top layer's, once. Nothing else hears it (the chat used to shrink as a dialog closed)
//   - Tab stays inside the top modal layer
//   - tap outside: a layer's `dim` (its scrim) closes it
//   - focus: back to what opened the layer; if that has gone, to the layer's fallback, else the room
//   - whenFree(fn): fn once no layer is open and every step back has landed (a cast's book waits for the check-in)
//
// A sheet shows its own element, then calls layers.open({ el, name, close }); when it has hidden itself it calls
// layers.closed(handle). close(how) is how the stack asks it to close: how is 'back', 'escape' or 'outside'.
//   open({ el, name, close, modal = true, dim, keep: [els], opener, fallback, onEscape, expands })
//     modal: false is a layer over a live room (the first-visit tour, a popover): Escape and Back, no inert, no Tab trap
//     keep: more elements that stay live with it (the chat's scrim); expands: a button whose aria-expanded follows the layer
//     onEscape(e): the layer's own Escape (the book's list goes back to the page it came from); return false to close as usual
// It also answers: top, any, has(name), isOpen(el), subscribe(fn).

const stack = [];                       // the open layers, bottom first
const waiting = [];                     // layers whose history step waits for our steps back to land
const free = [];                        // whenFree callbacks
const after = [];                       // afterBack callbacks
const subs = new Set();
let owed = 0;                           // steps back we still have to take for layers closed by their own buttons
let inFlight = false;                   // one history.back() of ours is on its way (they're taken one at a time)
let seq = 0;
let clicked = null;                     // the last button clicked: the opener where a click doesn't focus it (Safari)
addEventListener('click', e => { clicked = e.target.closest?.('button, a[href], [tabindex]') || null; }, true);

const run = fns => fns.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
const settled = () => !owed && !inFlight;

/** Everything outside the top modal layer is inert; with none open, nothing is (of ours) */
function applyInert() {
  const top = [...stack].reverse().find(L => L.modal);
  const live = top ? [top.el, ...top.keep] : [];
  for (const el of document.body.children) {
    const want = !!top && !live.some(x => x === el || el.contains(x)) && !el.matches('script, .sr-only, [aria-live]');
    if (want && !el.inert) { el.inert = true; el.dataset.layerInert = '1'; }
    else if (!want && el.dataset.layerInert) { el.inert = false; delete el.dataset.layerInert; }
  }
}

function push(L) {
  if (!stack.includes(L) || L.pushed) return;
  if (!settled()) { if (!waiting.includes(L)) waiting.push(L); return; }
  L.token = `${++seq}.${Math.random().toString(36).slice(2, 6)}`;
  history.pushState({ ...(history.state || {}), layer: L.token }, '');
  L.pushed = true;
}

function stepBack() {
  if (inFlight || !owed) return;
  inFlight = true;
  history.back();
}

/** A layer has opened (its element is showing). Opening one that's already open changes nothing. Returns its handle. */
function open(layer) {
  let L = stack.find(x => x.el === layer.el && x.name === layer.name);
  if (!L) {
    const active = document.activeElement;
    L = { modal: true, keep: [], ...layer, opener: layer.opener ?? (active && active !== document.body ? active : clicked), pushed: false, token: null };
    stack.push(L);
    L.expands?.setAttribute('aria-expanded', 'true');
  }
  applyInert();
  push(L);
  emit();
  return L;
}

/** The layer's element is hidden again (its Done or ✕, or because the stack asked): its step, its inert and focus are undone */
function closed(layer, { how = 'self', refocus = true } = {}) {
  const i = stack.findIndex(x => x === layer || (x.el === layer?.el && x.name === layer?.name));
  if (i < 0) return;
  const [L] = stack.splice(i, 1);
  const w = waiting.indexOf(L);
  if (w >= 0) waiting.splice(w, 1);                    // its step was never pushed: nothing to take back
  else if (L.pushed && how !== 'back') owed++;
  L.pushed = false;
  L.expands?.setAttribute('aria-expanded', 'false');
  applyInert();
  if (refocus) focusAfter(L);
  emit();
  stepBack();
  settle();
}

/** Focus goes back to the opener; if it's gone (or now inert), to the layer's fallback, else the top layer, else the room */
function focusAfter(L) {
  const ok = el => el?.isConnected && !el.closest('[inert]') && el.getClientRects().length > 0;   // fixed elements have no offsetParent
  const top = stack.at(-1);
  const to = [L.opener, typeof L.fallback === 'function' ? L.fallback() : L.fallback, top?.el.querySelector('[autofocus], button, [tabindex="-1"]'),
              document.getElementById('stage')].find(ok);
  to?.focus({ preventScroll: true });
}

addEventListener('popstate', () => {
  if (inFlight) {                                      // our own step back has landed
    inFlight = false;
    owed = Math.max(0, owed - 1);
    if (owed) return stepBack();
    return settle();
  }
  // The visitor pressed Back: the newest layer whose step is gone closes, and only that one
  const L = [...stack].reverse().find(x => x.pushed);
  if (!L || history.state?.layer === L.token) return;  // Forward onto it, or not ours
  L.pushed = false;
  L.close('back');
  if (stack.includes(L)) closed(L, { how: 'back' });   // in case the sheet didn't report back
});

function settle() {
  if (!settled()) return;
  while (waiting.length && settled()) push(waiting.shift());
  if (!settled()) return;
  run(after);
  if (!stack.length) run(free);
}

/** fn once no layer is open and our steps back have landed (at once, if that's now) */
function whenFree(fn) {
  if (!stack.length && settled()) return fn();
  free.push(fn);
}
/** fn once our steps back have landed: to open a sheet straight after closing another */
function afterBack(fn) {
  if (settled()) return fn();
  after.push(fn);
}

// Escape and Tab belong to the top layer. Capture on window: it runs before anything else hears the key
addEventListener('keydown', e => {
  const L = stack.at(-1);
  if (!L) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (L.onEscape && L.onEscape(e) !== false) return;
    return L.close('escape');
  }
  if (e.key === 'Tab' && L.modal) {
    const f = [...L.el.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
    const i = f.indexOf(document.activeElement);
    if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  }
}, true);
// Tap outside: the top layer's scrim closes it
addEventListener('click', e => {
  const L = stack.at(-1);
  if (L?.dim && e.target === L.dim) L.close('outside');
}, true);

export const layers = {
  open, closed, whenFree, afterBack,
  get top() { return stack.at(-1) || null; },
  get any() { return stack.length > 0; },
  has: name => stack.some(x => x.name === name),
  isOpen: el => stack.some(x => x.el === el),
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
if (typeof window !== 'undefined') window.__layers = layers;   // for scripted checks
