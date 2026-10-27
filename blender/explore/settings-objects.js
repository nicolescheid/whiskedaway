// Objects in the rooms that show the check-in (art-settings-plan, 28 Oct 2026). Painted sprites (blender/settings_sprites_build.py,
// explore/assets/settings/) put into the panorama by code, like the candle flames and the cage, so no room is re-rendered per state:
//   the candle (visit 'energy', burnt-out ... full):  a lamp in Flourish that burns at that level, a suncatcher in the Chiapothecary
//   the patience string (visit 'time', quick ... any): a ball of yarn (Cuddlecore), a cone of twine (Flourish), a spool of ribbon
//                                                      (Sweet Spells), each a little more unwound; nothing told = fully wound
// Each is a hotspot (a world object with tool "setting-<kind>", placed in the room's hotspots json) that opens the check-in card at
// its row (tell.open('checkin', ..., { row })) after a short Gemma line (gemma-lines.json `settings`).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { visit } from './visit-state.js';

// What each object is: its hotspot (where its body sits), the sprite's size in metres (the build script's SPAN) and where the
// sprite's centre lies from the body in metres (right, up), `big` (a little larger than life so it reads at phone size), the row it opens
const KINDS = {
  lamp:       { id: 'fl-lamp',         key: 'energy', row: 'energy', span: 0.46, off: [0, 0.03], big: 1.15 },
  suncatcher: { id: 'chia-suncatcher', key: 'energy', row: 'energy', span: 0.44, off: [0, 0], big: 1.5 },
  yarn:       { id: 'cc-yarn',         key: 'time',   row: 'time',   span: 0.42, off: [0.12, -0.01], big: 1.5 },
  twine:      { id: 'fl-twine',        key: 'time',   row: 'time',   span: 0.42, off: [0.06, -0.01], big: 1.5 },
  ribbon:     { id: 'ss-ribbon',       key: 'time',   row: 'time',   span: 0.42, off: [0.09, 0.015], big: 1.5 },
};
const LEVEL = { 'burnt-out': 0, low: 0.25, half: 0.5, 'three-quarters': 0.75, full: 1 };   // how brightly the candle burns
const UNWOUND = { quick: 1, half: 2, hour: 3, any: 4 };                                   // the sprite for each patience stop; 0 is wound
const BASE = 'explore/assets/settings/';
const deg = r => (r * 180) / Math.PI;

export function install(inn) {
  const loader = new THREE.TextureLoader();
  const texs = {};
  const tex = name => texs[name] || (texs[name] = loader.load(BASE + name + '.png', t => { t.colorSpace = THREE.SRGBColorSpace; inn.render(); }));
  const mk = (map, additive = false) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false,
                                                          blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.visible = false; s.renderOrder = 9; inn.scene.add(s);
    return s;
  };
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 214, 140, 0.6)'); grad.addColorStop(0.45, 'rgba(255, 176, 90, 0.2)'); grad.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const raysTex = n => {                                   // the suncatcher's colours: n soft dots scattered down and to the right of it
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), cols = ['255,90,90', '255,190,70', '110,220,120', '90,170,255'];
    for (let i = 0; i < n; i++) {
      const x = 70 + i * 34 + (i % 2) * 14, y = 80 + i * 36 - (i % 2) * 10, r = 30 - i * 2;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${cols[i % 4]},0.75)`); grad.addColorStop(1, `rgba(${cols[i % 4]},0)`);
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };

  // One sprite set per kind, made on first use in the room that has it
  const made = {};
  const parts = kind => made[kind] || (made[kind] = {
    body: mk(), lit: kind === 'lamp' ? mk() : null, glow: kind === 'lamp' || kind === 'suncatcher' ? mk(glowTex, true) : null,
    rays: kind === 'suncatcher' ? mk() : null, raysFor: -1,
  });

  /** How the room's light falls on a sprite: dimmer and bluer at night, warm at dawn and dusk, flatter in rain and storm */
  function tint() {
    const t = inn.timeNow(), w = inn.state.weather;
    let c = t === 'night' ? [0.42, 0.45, 0.6] : t === 'dawn' ? [1, 0.86, 0.74] : t === 'dusk' ? [0.98, 0.8, 0.66] : [1, 0.98, 0.95];
    const flat = w === 'stormy' ? 0.72 : w === 'rain' ? 0.82 : w === 'change' ? 0.92 : 1;
    return { rgb: c.map(x => x * flat), night: t === 'night', dim: w === 'stormy' || w === 'rain' };
  }

  function place(sprite, kind, s, k = 1, dx = 0, dy = 0) {
    const K = KINDS[kind], dist = s.distance || 2, near = 10 / Math.max(dist, 0.4), big = K.big || 1;
    const yaw = s.yaw + deg(K.off[0] * big / dist) + dx, pitch = s.pitch + deg(K.off[1] * big / dist) + dy;
    sprite.position.copy(inn.dir(yaw, pitch).multiplyScalar(10));
    sprite.scale.set(K.span * big * near * k, K.span * big * near * k, 1);
  }

  function show(kind) {
    const K = KINDS[kind], s = inn.spots?.[K.id], P = parts(kind);
    const on = !!s;
    for (const sp of [P.body, P.lit, P.glow, P.rays]) if (sp) sp.visible = on;
    if (!s) return;
    const T = tint(), v = visit.get(K.key), level = K.key === 'energy' ? (LEVEL[v] ?? 0) : 0;
    const rgb = new THREE.Color(...T.rgb);
    if (kind === 'lamp') {
      P.body.material.map = tex('lamp_off'); P.lit.material.map = tex('lamp_lit');
      place(P.body, kind, s); place(P.lit, kind, s);
      P.body.material.color.copy(rgb); P.lit.material.color.copy(rgb);
      P.lit.material.opacity = level;                                   // the shade warms as the candle burns up
      place(P.glow, kind, s, 1.9);
      P.glow.material.opacity = level * (T.night ? 1 : 0.55);            // by day a lamp is a gentle glow, at night it lights the shelf
      P.glow.position.y += 0.02;
    } else if (kind === 'suncatcher') {
      P.body.material.map = tex('suncatcher'); place(P.body, kind, s);
      P.body.material.color.copy(rgb);
      place(P.glow, kind, s, 1.4);
      P.glow.material.opacity = level * 0.6;
      const n = level === 0 ? 0 : Math.max(1, Math.round(level * 4));    // colours thrown onto the wall; fewer in rain, none at night
      const shown = T.night ? 0 : T.dim ? Math.min(n, 1) : n;
      if (P.raysFor !== shown) { P.rays.material.map = raysTex(shown); P.rays.material.needsUpdate = true; P.raysFor = shown; }
      place(P.rays, kind, s, 1.5, 3, -8);
      P.rays.material.opacity = shown ? 0.4 + 0.15 * level : 0;
    } else {
      const i = UNWOUND[v] ?? 0;
      P.body.material.map = tex(`${kind}_${i}`);
      P.body.material.color.copy(rgb);
      place(P.body, kind, s);
    }
    P.body.material.opacity = 1;
  }
  const showAll = () => { for (const k of Object.keys(KINDS)) show(k); inn.render(); };

  // Rooms rebuild their hotspots on entry: that's when these appear or go. The light changes with the weather and the time of
  // day, which have no event of their own, so the tint is checked once a second
  const buildHotspots = inn.buildHotspots;
  inn.buildHotspots = (...a) => { buildHotspots(...a); for (const k of Object.keys(KINDS)) show(k); };
  let lastTint = '';
  setInterval(() => {
    const T = tint(), sig = T.rgb.join() + T.night + T.dim + inn.state.room;
    if (sig === lastTint || document.hidden) return;
    lastTint = sig; showAll();
  }, 1000);
  visit.subscribe(({ part, key }) => { if (part === 'all' || key === 'energy' || key === 'time') showAll(); });

  // Taps: Gemma's line for the state, then the check-in card opens at the row this object shows
  inn.onTouch(35, obj => obj.tool?.startsWith('setting-'), obj => {
    const kind = obj.tool.slice(8), K = KINDS[kind], v = visit.get(K.key);
    const L = inn.LINES.settings?.[kind] || {};
    inn.say(L[v] || L.unset || '', [], true);
    inn.holdLine();
    inn.tell.open('checkin', 'object', { row: K.row });
    return true;
  });
}
