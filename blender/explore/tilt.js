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
    @media (max-width: 560px) { body.can-tilt .bar .room-title { flex-basis: calc(100% - 84px); } }   /* the chip shares the title's row */`;
  document.head.append(css);
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip tilt';
  chip.setAttribute('aria-pressed', 'false');
  chip.setAttribute('aria-label', 'Tilt your phone to look around');
  chip.textContent = '📱 Tilt';
  title.after(chip);
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

  function start() {
    on = true; anchor = null;
    addEventListener('deviceorientation', onOrient);
    chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true'); chip.textContent = '📱 Tilt on';
  }
  function stop() {
    on = false;
    removeEventListener('deviceorientation', onOrient);
    chip.classList.remove('on'); chip.setAttribute('aria-pressed', 'false'); chip.textContent = '📱 Tilt';
  }
  chip.addEventListener('click', async e => {
    e.stopPropagation();
    if (on) return stop();
    const ask = window.DeviceOrientationEvent?.requestPermission;       // iOS 13+: must be asked from this tap
    if (typeof ask === 'function') {
      try { if (await ask.call(DeviceOrientationEvent) !== 'granted') return; } catch { return; }
    }
    start();
  });
  return { get on() { return on; }, stop };
}
