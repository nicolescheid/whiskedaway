// The energy candles (moved out of explore.html, architecture step 3): the chosen candle's flame and glow, drawn as
// sprites at its wick (spriteFrom, showCandle), and chooseEnergy. spriteFrom is on `inn` for other overlays drawn into the
// room the same way (the cage over Cuddlecore's tray, docs/code-map.md).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { visit } from './visit-state.js';

export function install(inn) {
  Object.assign(inn, { showCandle, chooseEnergy });   // its functions, for the other modules (hoisted)
  // ---------- energy candles: pick the one that matches how much you've got in you today
  // The candles are rendered unlit (the kitchen's five and the foyer desk's five). The chosen one is lit here:
  // a flame drawn at its wick, sized for its real distance, with a warm glow behind it. It's a standing signal, like the weather.
  const spriteFrom = (draw, additive) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    draw(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false,
                                                               blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    sprite.visible = false;
    inn.scene.add(sprite);
    return sprite;
  }; inn.spriteFrom = spriteFrom;
  const candleGlow = spriteFrom(g => {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 214, 140, 0.55)');
    grad.addColorStop(0.4, 'rgba(255, 176, 90, 0.22)');
    grad.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }, true);
  candleGlow.renderOrder = 10;
  const candleFlame = spriteFrom(g => {
    // a teardrop: round at the base, drawn up to a point; hot white-yellow core, orange edge, a blue foot
    g.translate(128, 150);
    const body = new Path2D();
    body.moveTo(0, -128); body.bezierCurveTo(46, -48, 58, 30, 0, 74); body.bezierCurveTo(-58, 30, -46, -48, 0, -128);
    const edge = g.createRadialGradient(0, 30, 4, 0, 10, 120);
    edge.addColorStop(0, 'rgba(255, 252, 235, 1)');
    edge.addColorStop(0.35, 'rgba(255, 220, 120, 0.95)');
    edge.addColorStop(0.75, 'rgba(255, 140, 40, 0.7)');
    edge.addColorStop(1, 'rgba(230, 90, 20, 0)');
    g.fillStyle = edge;
    g.fill(body);
    const foot = g.createRadialGradient(0, 62, 0, 0, 62, 24);
    foot.addColorStop(0, 'rgba(90, 120, 255, 0.55)');
    foot.addColorStop(1, 'rgba(90, 120, 255, 0)');
    g.fillStyle = foot;
    g.fillRect(-30, 38, 60, 48);
  }, true);
  candleFlame.renderOrder = 11;
  const candleSpot = id => Object.keys(inn.world.objects).find(k => inn.world.objects[k].type === 'energy' && inn.world.objects[k].energy === id);
  /** Where the chosen candle's flame goes in this room: a kitchen candle's own flame point, or the foyer desk's */
  function flamePoint(id) {
    const key = candleSpot(id);
    return (key && inn.spots[key]?.flame) || inn.spots['checkin-desk']?.flames?.[id] || null;
  }
  let flicker = null;
  function placeFlame(f, k = 1) {
    const near = 10 / Math.max(f.distance || 2.5, 0.4);          // the sphere sits at 10 units: scale real metres to it
    const small = visit.get('energy') === 'burnt-out' ? 0.55 : 1;    // a guttering stub
    candleFlame.scale.set(0.024 * near * small * (2 - k), 0.05 * near * small * k, 1);
    candleFlame.position.copy(inn.dir(f.yaw, f.pitch).multiplyScalar(10));
    candleGlow.scale.set(0.3 * near * small, 0.36 * near * small, 1);
    candleGlow.position.copy(candleFlame.position);
    candleFlame.material.opacity = 0.85 + 0.15 * k;
  }
  function showCandle() {
    const id = visit.get('energy');
    const key = id && candleSpot(id);
    const f = id && flamePoint(id);
    const s = !f && key && inn.spots[key];                                // no flame point (an old render): glow on the candle
    candleFlame.visible = !!f;
    candleGlow.visible = !!(f || s);
    clearInterval(flicker);
    if (f) {
      placeFlame(f);
      // a slow, small flicker while a flame shows (about 11 frames a second, nothing when the tab is hidden)
      flicker = setInterval(() => { if (!document.hidden) { placeFlame(f, 0.93 + Math.random() * 0.12); inn.render(); } }, 90);
    } else if (s) {
      candleGlow.scale.set(0.95, 1.4, 1);
      candleGlow.position.copy(inn.dir(s.yaw, s.pitch).multiplyScalar(10));
    }
    for (const h of inn.hotspots) h.el.classList.toggle('chosen', !!key && h.id === key);
    inn.render();
  }
  function chooseEnergy(id, { quiet = false, from = null } = {}) {
    const e = inn.world.energies?.[id];
    if (!e || id === visit.get('energy')) return;
    const prev = visit.get('energy');
    visit.set('energy', id);
    if (!quiet) inn.answerSound('energy', id, prev);
    if (from) inn.track('tell_set', { kind: 'energy', from });   // the check-in's candle; in Cuddlecore the candle is a touch
    else inn.track('hotspot_touch', { room: inn.state.room, object_type: 'energy' });   // that a candle was picked, never which
    showCandle();
    if (!quiet) inn.say(e.moment, [], true);
    inn.record({ kind: 'energy', id });
  }
}
