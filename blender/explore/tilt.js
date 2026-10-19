// Tilt to look (brainstorm #7, phones only): an opt-in chip in the top bar. On, the room follows the phone as it turns;
// dragging still works (it re-anchors the tilt). iOS asks for motion permission, and only from the chip's tap.
// Off with the same chip. Nothing at all on desktop-sized screens or where the browser has no orientation events.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const phoneSized = matchMedia('(max-width: 719px), (max-height: 500px)');
const D = THREE.MathUtils.degToRad, R = THREE.MathUtils.radToDeg;

export function createTilt({ stage, look, render }) {
  if (!('DeviceOrientationEvent' in window)) return;
  const bar = document.querySelector('.bar'), title = document.getElementById('room-title');
  if (!bar || !title) return;
  let on = false, anchor = null, dragging = false, last = null;

  const css = document.createElement('style');
  css.textContent = `
    .bar .chip.tilt.on { background: var(--berry); color: var(--parchment); border-color: var(--berry); }
    .bar .chip.tilt[hidden] { display: none; }
    .bar .chip.tilt { position: relative; }
    .bar .chip.tilt::after { content: ''; position: absolute; inset: -12px -4px -6px; }   /* 44 px to tap without a taller bar */
    .tilt-note { position: fixed; z-index: 21; right: calc(16px + env(safe-area-inset-right, 0px)); top: calc(var(--bar-h, 73px) + 6px);
                 max-width: min(260px, calc(100vw - 32px)); padding: 6px 10px; border-radius: 10px; background: var(--parchment-90);
                 border: 1px solid var(--line); font: 500 13px/1.35 'Quicksand', system-ui, sans-serif; color: var(--ink);
                 box-shadow: 0 4px 14px rgba(0,0,0,.2); pointer-events: none; transition: opacity .3s; }
    .tilt-note[hidden] { display: none; }
    @media (max-width: 560px) { body.can-tilt .bar .room-title { flex-basis: calc(100% - 84px); }   /* the chip shares the title's row */
      /* the speaker chip sits under it: start its (taller) tap area a little lower so Tilt keeps 44 px; it keeps ≥ 44 */
      body.can-tilt .bar .chip.speaker::after { top: -4px; } }`;
  document.head.append(css);
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip tilt';
  chip.setAttribute('aria-pressed', 'false');
  chip.setAttribute('aria-label', 'Tilt your phone to look around');
  chip.textContent = '📱 Tilt';
  title.after(chip);
  // When tilt can't run (permission refused, or no motion sensor), say so briefly and leave the chip off
  const note = document.createElement('p');
  note.className = 'tilt-note'; note.hidden = true; note.setAttribute('role', 'status');
  document.body.append(note);
  let noteTimer;
  const sayNo = () => {
    note.textContent = 'Tilt needs motion access on this phone. You can still drag to look around.';
    note.hidden = false; clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.hidden = true; }, 4000);
  };
  const showChip = () => { chip.hidden = !phoneSized.matches; document.body.classList.toggle('can-tilt', phoneSized.matches); if (!phoneSized.matches && on) stop(); };
  phoneSized.addEventListener?.('change', showChip);
  showChip();

  // Device orientation → where the back of the phone points, as yaw/pitch (same convention as the room: yaw + = right)
  const euler = new THREE.Euler(), q = new THREE.Quaternion(), qScreen = new THREE.Quaternion(), fwd = new THREE.Vector3();
  const qBack = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));   // the camera looks out of the back, not the top
  const Z = new THREE.Vector3(0, 0, 1);
  const pose = e => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return null;
    const turn = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
    euler.set(D(e.beta), D(e.alpha), -D(e.gamma), 'YXZ');
    q.setFromEuler(euler).multiply(qBack).multiply(qScreen.setFromAxisAngle(Z, -D(turn)));
    fwd.set(0, 0, -1).applyQuaternion(q);
    return { yaw: R(Math.atan2(fwd.x, -fwd.z)), pitch: R(Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1))) };
  };

  const wrap = a => ((a + 540) % 360) - 180;
  function onOrient(e) {
    const p = pose(e);
    if (p) heard = true;
    if (!p || dragging) { last = p; return; }
    last = p;
    if (!anchor) { anchor = { yaw: look.yaw - p.yaw, pitch: look.pitch - p.pitch }; return; }   // no jump when it starts
    const ty = p.yaw + anchor.yaw, tp = THREE.MathUtils.clamp(p.pitch + anchor.pitch, -75, 75);
    look.yaw += wrap(ty - look.yaw) * 0.35;                    // a little smoothing against sensor jitter
    look.pitch += (tp - look.pitch) * 0.35;
    render();
  }
  // A drag moves the view as before; when it ends, the tilt carries on from wherever the drag left it
  stage.addEventListener('pointerdown', () => { if (on) dragging = true; });
  addEventListener('pointerup', () => { if (on && dragging) { dragging = false; anchor = last ? { yaw: look.yaw - last.yaw, pitch: look.pitch - last.pitch } : null; } });

  let heard = false, heardTimer;
  function start() {
    on = true; anchor = null; heard = false;
    addEventListener('deviceorientation', onOrient);
    // No readings within 1.5 s: there's no motion sensor (or it's blocked), so turn back off and say so
    clearTimeout(heardTimer);
    heardTimer = setTimeout(() => { if (on && !heard) { stop(); sayNo(); } }, 1500);
    chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true'); chip.textContent = '📱 Tilt on';
  }
  function stop() {
    on = false; clearTimeout(heardTimer);
    removeEventListener('deviceorientation', onOrient);
    chip.classList.remove('on'); chip.setAttribute('aria-pressed', 'false'); chip.textContent = '📱 Tilt';
  }
  chip.addEventListener('click', async e => {
    e.stopPropagation();
    if (on) return stop();
    const ask = window.DeviceOrientationEvent?.requestPermission;       // iOS 13+: must be asked from this tap
    if (typeof ask === 'function') {
      try { if (await ask.call(DeviceOrientationEvent) !== 'granted') return sayNo(); } catch { return sayNo(); }
    }
    start();
  });
  return { get on() { return on; }, stop };
}
