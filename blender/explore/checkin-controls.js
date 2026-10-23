// The check-in card's two hand-made controls (SVG and CSS, in the Inn's style):
//   patienceString: a ball of string; pull the end out to say how much patience you've got today (four stops)
//   confidenceDial: a knob you turn from "a cautious cook" to "a confident chef" (three positions)
// Both are role="slider" with aria-valuetext, work by drag and tap (44 px+ targets) and by arrow keys, and have a "not answered" state
// (drag back to the start, or press Delete). They hold no state of their own: `value` is an id from `ids`
// (or null), `onChange(id|null)` is called on every change. Reduced motion: no transition, the pieces just jump to their place.

const NS = 'http://www.w3.org/2000/svg';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

/**
 * The ball of string. Four stops along a track: the ball sits at the left and the thread runs out to the handle (a little bead on its end).
 * Nothing pulled = not answered.
 */
export function patienceString({ ids, labels, value = null, name, unset, hint, onChange }) {
  const W = 300, H = 52, X0 = 46, X1 = 276, Y = 26;       // track from the ball's edge to the far end
  const xOf = i => (i < 0 ? X0 : X0 + (X1 - X0) * ((i + 1) / ids.length));   // stops at 1/4 ... 4/4 of the track; the start is "nothing pulled"
  const root = document.createElement('div');
  root.className = 'ck-ctl ck-string';
  root.innerHTML = `<div class="ck-track" role="slider" tabindex="0" aria-label="${name}" aria-orientation="horizontal"
      aria-valuemin="0" aria-valuemax="${ids.length}" aria-valuenow="0" aria-valuetext="${unset}"></div>
    <div class="ck-readout" aria-hidden="true"></div>`;
  const track = root.querySelector('.ck-track'), readout = root.querySelector('.ck-readout');
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ck-svg', 'aria-hidden': 'true', focusable: 'false' }, track);
  // stop marks
  ids.forEach((id, i) => svg('circle', { cx: xOf(i), cy: Y, r: 3, class: 'ck-mark' }, s));
  const thread = svg('path', { class: 'ck-thread', fill: 'none' }, s);
  const ball = svg('g', { class: 'ck-ball' }, s);
  const ballBody = svg('circle', { cx: 28, cy: Y, r: 22, class: 'ck-ball-body' }, ball);
  svg('path', { d: `M10 ${Y - 6} Q28 ${Y - 16} 46 ${Y - 4} M8 ${Y + 3} Q28 ${Y - 8} 47 ${Y + 6} M12 ${Y + 14} Q28 ${Y + 2} 44 ${Y + 14} M18 ${Y - 18} Q26 ${Y} 20 ${Y + 20}`, class: 'ck-ball-wind', fill: 'none' }, ball);
  const bead = svg('g', { class: 'ck-bead' }, s);
  svg('circle', { r: 11, class: 'ck-bead-body' }, bead);
  svg('path', { d: 'M-4 -1 L0 -5 L4 -1 M0 -5 L0 5', class: 'ck-bead-arrow', fill: 'none', transform: 'rotate(90)' }, bead);

  const idxOf = v => (v == null ? -1 : ids.indexOf(v));
  const paint = () => {
    const i = idxOf(value), x = xOf(i);
    // the thread loops loosely out of the ball to the bead; a little slack so it reads as string
    const sag = i < 0 ? 0 : 6 + i * 2;
    thread.setAttribute('d', i < 0 ? `M${X0 - 2} ${Y} L${X0 + 8} ${Y}` : `M${X0 - 2} ${Y} C ${X0 + (x - X0) * 0.35} ${Y + sag}, ${X0 + (x - X0) * 0.65} ${Y - sag}, ${x} ${Y}`);
    bead.setAttribute('transform', `translate(${x + (i < 0 ? 14 : 0)} ${Y})`);
    ball.setAttribute('transform', `translate(0 0) scale(1)`);
    ballBody.setAttribute('r', String(22 - Math.max(i + 1, 0) * 1.6));          // the ball gets smaller as it unwinds
    ids.forEach((id, k) => s.querySelectorAll('.ck-mark')[k].classList.toggle('on', k === i));
    const text = i < 0 ? unset : labels[ids[i]];
    track.setAttribute('aria-valuenow', String(i + 1));
    track.setAttribute('aria-valuetext', text);
    readout.textContent = i < 0 ? (hint || '') : text;
    root.classList.toggle('answered', i >= 0);
  };
  const apply = i => {
    const next = i < 0 ? null : ids[clamp(i, 0, ids.length - 1)];
    if (next === value) return;
    value = next;
    paint();
    onChange(next);
  };
  const fromX = clientX => {
    const r = s.getBoundingClientRect(), x = ((clientX - r.left) / r.width) * W;
    if (x < X0 + (xOf(0) - X0) / 2) return -1;                // back near the ball: not answered
    let best = 0;
    for (let k = 1; k < ids.length; k++) if (Math.abs(xOf(k) - x) < Math.abs(xOf(best) - x)) best = k;
    return best;
  };
  let dragging = false;
  track.addEventListener('pointerdown', e => {
    dragging = true; track.setPointerCapture(e.pointerId); track.classList.add('drag');
    apply(fromX(e.clientX));
  });
  track.addEventListener('pointermove', e => { if (dragging) apply(fromX(e.clientX)); });
  const end = () => { dragging = false; track.classList.remove('drag'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', e => {
    const i = idxOf(value);
    const move = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: ids.length - 1, Delete: -1, Backspace: -1 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    apply(clamp(move, -1, ids.length - 1));
  });
  paint();
  return root;
}

/**
 * The knob. A round dial with a pointer; the pointer rests pointing straight down (not answered) and turns to one of three marks
 * along the top arc: cautious (left), at home (middle), confident (right). Tap a mark, drag the knob round, or use the arrows.
 */
export function confidenceDial({ ids, labels, value = null, name, unset, hint, onChange, ends }) {
  const root = document.createElement('div');
  root.className = 'ck-ctl ck-dial';
  root.innerHTML = `<div class="ck-knobrow"><span class="ck-end ck-end-l" aria-hidden="true">${ends?.[0] || ''}</span>
      <div class="ck-track ck-knob" role="slider" tabindex="0" aria-label="${name}" aria-orientation="horizontal"
        aria-valuemin="0" aria-valuemax="${ids.length}" aria-valuenow="0" aria-valuetext="${unset}"></div>
      <span class="ck-end ck-end-r" aria-hidden="true">${ends?.[1] || ''}</span></div>
    <div class="ck-readout" aria-hidden="true"></div>`;
  const track = root.querySelector('.ck-track'), readout = root.querySelector('.ck-readout');
  const S = 120, C = 60, R = 38;
  const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'ck-svg', 'aria-hidden': 'true', focusable: 'false' }, track);
  const ang = i => (ids.length === 1 ? 0 : -60 + (120 * i) / (ids.length - 1));   // degrees from straight up; -1 rests straight down
  const pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
  ids.forEach((id, i) => { const [x, y] = pt(ang(i), R + 13); svg('circle', { cx: x, cy: y, r: 4, class: 'ck-mark' }, s); });
  svg('circle', { cx: C, cy: C, r: R, class: 'ck-knob-body' }, s);
  svg('circle', { cx: C, cy: C, r: R - 9, class: 'ck-knob-face' }, s);
  const needle = svg('g', { class: 'ck-needle' }, s);
  svg('path', { d: `M${C} ${C} L${C} ${C - R + 6}`, class: 'ck-needle-line' }, needle);
  svg('circle', { cx: C, cy: C - R + 8, r: 4.5, class: 'ck-needle-tip' }, needle);

  const idxOf = v => (v == null ? -1 : ids.indexOf(v));
  const paint = () => {
    const i = idxOf(value);
    needle.setAttribute('transform', `rotate(${i < 0 ? 180 : ang(i)} ${C} ${C})`);
    s.querySelectorAll('.ck-mark').forEach((m, k) => m.classList.toggle('on', k === i));
    const text = i < 0 ? unset : labels[ids[i]];
    track.setAttribute('aria-valuenow', String(i + 1));
    track.setAttribute('aria-valuetext', text);
    readout.textContent = i < 0 ? (hint || '') : text;
    root.classList.toggle('answered', i >= 0);
  };
  const apply = i => {
    const next = i < 0 ? null : ids[clamp(i, 0, ids.length - 1)];
    if (next === value) return;
    value = next;
    paint();
    onChange(next);
  };
  const fromPoint = (cx, cy) => {
    const r = s.getBoundingClientRect(), x = ((cx - r.left) / r.width) * S - C, y = ((cy - r.top) / r.height) * S - C;
    if (Math.hypot(x, y) < 8) return undefined;                // the middle of the knob: no change
    let deg = Math.atan2(x, -y) * 180 / Math.PI;               // 0 = straight up, ±180 = straight down
    if (Math.abs(deg) > 150) return -1;                        // turned right round to rest: not answered
    deg = clamp(deg, -60, 60);
    let best = 0;
    for (let k = 1; k < ids.length; k++) if (Math.abs(ang(k) - deg) < Math.abs(ang(best) - deg)) best = k;
    return best;
  };
  let dragging = false;
  track.addEventListener('pointerdown', e => {
    dragging = true; track.setPointerCapture(e.pointerId); track.classList.add('drag');
    const k = fromPoint(e.clientX, e.clientY);
    if (k !== undefined) apply(k);
    else apply(idxOf(value) < 0 ? 0 : (idxOf(value) + 1) % ids.length);   // a tap on the knob's face turns it to the next mark
  });
  track.addEventListener('pointermove', e => { if (!dragging) return; const k = fromPoint(e.clientX, e.clientY); if (k !== undefined) apply(k); });
  const end = () => { dragging = false; track.classList.remove('drag'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', e => {
    const i = idxOf(value);
    const move = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: ids.length - 1, Delete: -1, Backspace: -1 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    apply(clamp(move, -1, ids.length - 1));
  });
  paint();
  return root;
}
