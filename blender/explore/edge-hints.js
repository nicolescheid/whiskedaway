// Edge hints (brainstorm #7, phones only): a portrait phone sees ~44° of a room, so most hotspots are off-screen.
// A soft arrow in the room's colour sits at the left or right edge, pointing the shorter way to the nearest thing to touch.
// It never takes a tap (pointer-events: none), keeps clear of visible hotspots, the chat and the ideas,
// and stops showing once the visitor has turned the view a few times on this device.

const KEY = 'wa-edge-turns', ENOUGH = 8;
const COLOURS = { cuddlecore: '#c4956a', flourish: '#6f8f4e', 'sweet-spells': '#b5577a', chiapothecary: '#4f8a83', garden: '#a0522d' };
const phoneSized = matchMedia('(max-width: 719px), (max-height: 500px)');

let turns = 0;
try { turns = +localStorage.getItem(KEY) || 0; } catch { /* storage blocked: hints for this visit only */ }

export function createEdgeHints({ stage, roomId }) {
  const css = document.createElement('style');
  css.textContent = `
    .edge-hint { position: fixed; z-index: 4; width: 28px; height: 44px; display: grid; place-items: center; pointer-events: none;
                 font: 700 22px/1 'Quicksand', system-ui, sans-serif; color: #fff; border-radius: 14px; opacity: 0;
                 background: var(--eh, #8b4d5c); box-shadow: 0 2px 10px rgba(0,0,0,.25); transition: opacity .35s; }
    .edge-hint.on { opacity: .82; }
    .edge-hint.l { left: calc(4px + env(safe-area-inset-left, 0px)); }
    .edge-hint.r { right: calc(4px + env(safe-area-inset-right, 0px)); }`;
  document.head.append(css);
  const make = (cls, ch) => { const el = document.createElement('div'); el.className = `edge-hint ${cls}`; el.textContent = ch; el.setAttribute('aria-hidden', 'true'); document.body.append(el); return el; };
  const left = make('l', '‹'), right = make('r', '›');

  // A turn: a drag on the room of more than ~30 px
  let start = null;
  stage.addEventListener('pointerdown', e => { start = [e.clientX, e.clientY]; });
  stage.addEventListener('pointerup', e => {
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 30 && turns < ENOUGH) {
      turns++;
      try { localStorage.setItem(KEY, String(turns)); } catch { /* fine */ }
    }
    start = null;
  });

  // Rectangles the arrow must not sit on: visible hotspots, Gemma's chat, the ideas column and the highlight
  const blockers = () => [...document.querySelectorAll('.spot, #chatwin, #ideas, #idea-hl')]
    .filter(el => el.style.display !== 'none' && !el.hidden)
    .flatMap(el => [el, ...el.querySelectorAll('.name')])           // a hotspot's name can reach past its button
    .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
  const hits = (x0, y0, x1, y1, rs) => rs.some(r => !(r.right < x0 || r.left > x1 || r.bottom < y0 || r.top > y1));

  function place(el, show, side) {
    if (!show) return el.classList.remove('on');
    const bar = document.querySelector('.bar')?.getBoundingClientRect().bottom || 60;
    const chat = document.getElementById('chatwin')?.getBoundingClientRect().top || innerHeight;
    const mid = (bar + Math.min(chat, innerHeight)) / 2 - 22, rs = blockers();
    const x0 = side === 'l' ? 0 : innerWidth - 40, x1 = side === 'l' ? 40 : innerWidth;
    for (const dy of [0, -56, 56, -112, 112, -168, 168]) {
      const y = mid + dy;
      if (y < bar + 4 || y + 44 > chat - 4) continue;
      if (!hits(x0, y - 4, x1, y + 48, rs)) { el.style.top = `${Math.round(y)}px`; return el.classList.add('on'); }
    }
    el.classList.remove('on');                                   // nowhere clear: say nothing rather than cover something
  }

  /** Called after each render with the room's hotspots ({ el, v }) and the camera */
  function update(hotspots, camera) {
    const active = phoneSized.matches && turns < ENOUGH && document.getElementById('front-door')?.hidden !== false;
    // One arrow, toward the nearest thing off-screen (there's always something both ways, so two arrows would say nothing)
    let l = false, r = false;
    if (active) {
      let best = Infinity;
      for (const h of hotspots) {
        if (h.el.style.display !== 'none') continue;             // on screen already
        const c = h.v.clone().applyMatrix4(camera.matrixWorldInverse);
        const turn = Math.atan2(c.x, -c.z);                       // radians to turn: − left, + right
        if (Math.abs(turn) < best) { best = Math.abs(turn); l = turn < 0; r = turn >= 0; }
      }
    }
    const colour = COLOURS[roomId()] || '#8b4d5c';
    left.style.setProperty('--eh', colour); right.style.setProperty('--eh', colour);
    place(left, l, 'l'); place(right, r, 'r');
  }
  return { update };
}
