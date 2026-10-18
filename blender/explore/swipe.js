// Swipe on an idea's highlight (recipe-book-ux.md v4 §3, stage 2): right keeps, left sets aside, down closes (phones upright).
// Touch and pen only; the buttons stay the way for mouse, keyboard and screen readers.
// Axis lock at 10 px (horizontal only if |dx| > 1.5·|dy|). Commit past 40 % of the width, or on a flick faster than
// 0.5 px/ms that has also travelled 25 %. Otherwise it springs back; so does a cancelled pointer. A stamp fades in from 15 %.

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOCK = 10, RATIO = 1.5, COMMIT = 0.4, FLICK_V = 0.5, FLICK_MIN = 0.25, DOWN = 60;

/** Make `el` swipeable. Returns a detach function. `canClose()` says whether swipe-down closes (phones upright).
 *  After a drag, `el.dragged` is true until the click that follows has passed, so a swipe never also reads the card. */
export function swipeable(el, { onKeep, onDismiss, onClose, canClose = () => false }) {
  let g = null;
  const stamp = side => el.querySelector(`.stamp.s-${side}`);
  const setStamps = k => {
    const keep = stamp('keep'), no = stamp('no');
    if (keep) keep.style.opacity = k > 0 ? Math.min(1, Math.max(0, (k - 0.15) / (COMMIT - 0.15))) : 0;
    if (no) no.style.opacity = k < 0 ? Math.min(1, Math.max(0, (-k - 0.15) / (COMMIT - 0.15))) : 0;
  };
  const springBack = () => {
    el.style.transition = reduce() ? 'none' : 'transform .25s cubic-bezier(.2,.8,.3,1)';
    el.style.transform = '';
    setStamps(0);
    setTimeout(() => { el.style.transition = ''; }, 260);
  };
  function down(e) {
    if (e.pointerType === 'mouse' || e.button) return;                    // touch and pen; a mouse uses the buttons
    if (e.target.closest('button:not(.read)')) return;                     // no swipe starts on a button (the title may): tap wins
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lock: null, dx: 0, dy: 0, last: [] };
    try { el.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows */ }
  }
  function move(e) {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x; g.dy = e.clientY - g.y;
    g.last.push([performance.now(), e.clientX, e.clientY]);
    if (g.last.length > 6) g.last.shift();
    if (!g.lock && Math.hypot(g.dx, g.dy) >= LOCK) g.lock = Math.abs(g.dx) > RATIO * Math.abs(g.dy) ? 'x' : 'y';
    if (g.lock === 'x') {
      const k = g.dx / el.offsetWidth;
      el.style.transition = 'none';
      el.style.transform = `translateX(${g.dx}px) rotate(${Math.max(-1, Math.min(1, k / COMMIT)) * 4}deg)`;
      setStamps(k);
    } else if (g.lock === 'y' && g.dy > 0 && canClose()) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${g.dy * 0.6}px)`;
    }
  }
  // Speed over the last few moves, in px/ms
  const velocity = (s, axis) => {
    const l = s.last;
    if (l.length < 2) return 0;
    const [t0, x0, y0] = l[0], [t1, x1, y1] = l[l.length - 1];
    return ((axis === 'x' ? x1 - x0 : y1 - y0) / Math.max(1, t1 - t0));
  };
  function up(e) {
    if (!g || e.pointerId !== g.id) return;
    const s = g;
    g = null;
    if (!s.lock) return;                                                   // moved under 10 px: a tap, and its click reads the card
    el.dragged = true;
    setTimeout(() => { el.dragged = false; }, 80);
    const w = el.offsetWidth, k = s.dx / w, v = velocity(s, 'x');
    const flick = Math.abs(v) > FLICK_V && Math.abs(k) >= FLICK_MIN && Math.sign(v) === Math.sign(k);
    if (s.lock === 'x' && (Math.abs(k) >= COMMIT || flick)) {
      try { navigator.vibrate?.(10); } catch { /* not supported */ }
      // Carry on off the side, then hand over
      const dir = Math.sign(k);
      el.style.transition = reduce() ? 'none' : 'transform .18s ease-in, opacity .18s ease-in';
      el.style.transform = `translateX(${dir * w * 1.2}px) rotate(${dir * 6}deg)`;
      el.style.opacity = '0';
      setTimeout(() => { el.style.transition = el.style.transform = el.style.opacity = ''; setStamps(0); dir > 0 ? onKeep() : onDismiss(); }, reduce() ? 0 : 180);
      return;
    }
    if (s.lock === 'y' && canClose() && (s.dy > DOWN || (velocity(s, 'y') > FLICK_V && s.dy > 20))) {
      el.style.transition = el.style.transform = '';
      return onClose();
    }
    springBack();
  }
  function cancel(e) { if (g && e.pointerId === g.id) { g = null; springBack(); } }
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('lostpointercapture', cancel);
  return () => {
    el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); el.removeEventListener('lostpointercapture', cancel);
  };
}

/** Horizontal page swipes (the phone book): the same axis lock; vertical drags scroll the page as usual.
 *  A swipe can start anywhere, on a button too: once it has locked sideways, the click that follows is swallowed. */
export function pageSwipe(el, onTurn) {
  let g = null, swallow = false;
  el.addEventListener('click', e => { if (swallow) { e.preventDefault(); e.stopPropagation(); } }, true);
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') g = { id: e.pointerId, x: e.clientX, y: e.clientY, lock: null }; });
  el.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id || g.lock) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) >= LOCK) g.lock = Math.abs(dx) > RATIO * Math.abs(dy) ? 'x' : 'y';
  });
  el.addEventListener('pointerup', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, lock = g.lock;
    g = null;
    if (lock === 'x') { swallow = true; setTimeout(() => { swallow = false; }, 80); }
    if (lock === 'x' && Math.abs(dx) > 60) onTurn(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { g = null; });
}
