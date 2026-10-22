// The Inn's layers (code-health-plan.md, step 2): one stack for every sheet and dialog over the room. It owns what each sheet
// used to do by hand, so a new sheet can't forget a rule:
//   - history: one step per layer. Back closes the top layer; a sheet closed any other way takes its own step back
//   - inert: everything under the top layer (other layers included) is inert; nothing is left inert once the stack is empty
//   - Escape and Tab: Escape closes the top layer (or does its own thing), Tab stays inside it
//   - tap-outside: a layer's `dim` (its scrim) closes it
//   - focus: back to what opened the layer, if it's still in the page
//   - whenFree(fn): runs fn once no layer is open and every step back has landed (a cast's book waits for the check-in)
// A layer: open(layer) with { el, name, close(how), focus?, dim?, onEscape?, keepFocus? }. The sheet still shows and hides
// its own element; it calls layers.open() after showing it and layers.closed(layer) when it has hidden it. `close(how)` is
// how the stack asks the sheet to close: how is 'back' (the browser's Back), 'escape' or 'outside'.
//
// The one subtle rule, history: a sheet closed by its own button goes back one step (history.back()), and that popstate
// arrives later. Until it has, a new layer's step waits (pushing now would be the step the back pops), and the popstate is
// recognised as ours, not as the visitor pressing Back. That replaces the old waits (fromBook, closeThen, whenFree's 400 ms).

const stack = [];                       // { el, name, close, focus, opener, token, pushed }
let backs = 0;                          // our own history.back() calls whose popstate hasn't arrived yet
const waiting = [];                     // layers whose history step waits for those backs
const free = [];                        // whenFree callbacks
const subs = new Set();
const KEEP = 'script, .sr-only';
let seq = 0;

const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

/** Everything outside the top layer is inert; nothing is, with no layer open. The marker says which inert is ours. */
function applyInert() {
  const top = stack.at(-1)?.el;
  for (const el of document.body.children) {
    const want = !!top && el !== top && !el.matches(KEEP) && !(el.contains(top));
    if (want && !el.inert) { el.inert = true; el.dataset.layerInert = '1'; }
    else if (!want && el.dataset.layerInert) { el.inert = false; delete el.dataset.layerInert; }
  }
}

function push(L) {
  if (!stack.includes(L) || L.pushed) return;
  if (backs) { if (!waiting.includes(L)) waiting.push(L); return; }
  L.token = `${++seq}-${Math.random().toString(36).slice(2, 6)}`;
  history.pushState({ ...(history.state || {}), layer: L.token }, '');
  L.pushed = true;
}

/** Open a layer (already shown by its sheet). Opening one already in the stack brings nothing new: it stays where it is. */
function open(layer) {
  let L = stack.find(x => x.el === layer.el && x.name === layer.name);
  if (!L) {
    L = { ...layer, opener: layer.opener ?? document.activeElement, pushed: false, token: null };
    stack.push(L);
  }
  applyInert();
  push(L);
  emit();
  return L;
}

/** The sheet has hidden itself (Done, ✕, or because the stack asked): drop its layer, its history step and its inert. */
function closed(layer, { how = 'ui', refocus = true } = {}) {
  const i = stack.findIndex(x => x === layer || (x.el === layer.el && x.name === layer.name));
  if (i < 0) return;
  const [L] = stack.splice(i, 1);
  const w = waiting.indexOf(L);
  if (w >= 0) waiting.splice(w, 1);                    // its step was never pushed
  if (L.pushed && how !== 'back') { backs++; history.back(); }
  L.pushed = false;
  applyInert();
  const to = typeof L.focus === 'function' ? L.focus() : L.opener;
  if (refocus && !L.keepFocus && to?.isConnected && !to.closest('[inert]')) to.focus({ preventScroll: true });
  emit();
  settle();
}

addEventListener('popstate', () => {
  if (backs) { backs--; return settle(); }             // our own step back landing
  // The visitor pressed Back: close the top layer whose step is gone (the newest pushed one)
  const L = [...stack].reverse().find(x => x.pushed);
  if (!L) return;
  if (history.state?.layer === L.token) return;        // Forward onto it, or someone else's step: leave it
  L.pushed = false;
  L.close('back');
  if (stack.includes(L)) closed(L, { how: 'back' });   // a sheet that didn't report back
});

function settle() {
  if (backs) return;
  while (waiting.length) push(waiting.shift());
  if (stack.length || !free.length) return;
  const fns = free.splice(0);
  fns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

/** Run fn once no layer is open and our steps back have landed (at once, if that's now) */
function whenFree(fn) {
  if (!stack.length && !backs) return fn();
  free.push(fn);
}

/** Run fn once our steps back have landed: to open a sheet from inside one that is closing */
function afterBack(fn) {
  if (!backs) return fn();
  const once = () => { if (backs) return; subs.delete(check); fn(); };
  const check = () => setTimeout(once);
  subs.add(check);
  addEventListener('popstate', () => setTimeout(once), { once: true });
}

// Escape and Tab belong to the top layer
addEventListener('keydown', e => {
  const L = stack.at(-1);
  if (!L) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (L.onEscape) return L.onEscape(e);
    return L.close('escape');
  }
  if (e.key === 'Tab') {
    const f = [...L.el.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
    const i = f.indexOf(document.activeElement);
    if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  }
}, true);
// Tap outside: a layer's scrim closes it
addEventListener('click', e => {
  const L = stack.at(-1);
  if (L?.dim && e.target === L.dim) L.close('outside');
});

export const layers = {
  open, closed, whenFree, afterBack,
  get top() { return stack.at(-1) || null; },
  get any() { return stack.length > 0; },
  has: name => stack.some(x => x.name === name),
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
