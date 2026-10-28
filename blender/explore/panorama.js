// The 360° view (moved out of explore.html, architecture step 3): the three.js renderer and its texture cache, each
// weather's panorama by day and night (showWeather, crossFade), the browser's theme colour, the clocks' hands, the
// hotspots (buildHotspots, render, resize), looking around by drag, keys and wheel (lookTo), and Erwina's wiring.
// Shared through `inn` (docs/code-map.md).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { sound } from './sound.js';
import { createEdgeHints } from './edge-hints.js';
import { createTilt } from './tilt.js';
import { saveData } from './data-budget.js';
import { createErwina } from './erwina.js';
import { usable } from './pano-times.js';

export function install(inn) {
  Object.assign(inn, { showWeather, showClock, buildHotspots, render, resize, lookTo });   // its functions, for the other modules (hoisted)
  // ---------- panorama
  const stage = inn.$('stage');
  const edgeHints = createEdgeHints({ stage, roomId: () => inn.homeOf(inn.state.room) || inn.state.room });
  // preserveDrawingBuffer keeps the last frame, so browser screenshot tools capture the room instead of black
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); inn.scene = scene;
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100); inn.camera = camera;
  const geo = new THREE.SphereGeometry(50, 96, 64);
  geo.scale(-1, 1, 1);
  // Two spheres: the current weather, and the next one fading in over it
  const sphere = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a2018 }));
  sphere.rotation.y = -Math.PI / 2;                       // image centre (front wall) faces -Z
  scene.add(sphere);
  const fader = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  fader.rotation.y = -Math.PI / 2;
  fader.scale.setScalar(0.98);
  fader.visible = false;
  scene.add(fader);
  const loader = new THREE.TextureLoader();
  // Which full render to fetch after the preview: the 8K, or the 4096 phone tier (~0.5 MB, 43 MB of GPU memory instead of ~170).
  // Phones get the phone tier even when their GPU could take 8K: the screen can't show the difference, the data plan and memory can.
  // Data Saver or a 2G connection keeps to the preview (explore/data-budget.js). ?pano=8k|phone|none overrides, for testing.
  const maxTex = renderer.capabilities.maxTextureSize;
  const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  const panoTier = new URLSearchParams(location.search).get('pano')
    || (saveData ? 'none' : maxTex >= 8192 && !isPhone ? '8k' : maxTex >= 4096 ? 'phone' : 'none');
  const useFull = panoTier !== 'none';
  const fullUrl = url => panoTier === 'phone' ? url.replace(/\.jpg$/, '_4k.jpg') : url;
  // Textures stay in a small most-recently-used cache; older ones are freed from the GPU (an 8K one is ~170 MB, and phones
  // reload the tab when they run out). A freed texture still on screen is freed when it's replaced instead.
  const texCache = new Map();
  const KEEP_TEXTURES = 6;
  const inUse = t => t === sphere.material.map || t === fader.material.map;
  const prep = t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.userData.cached = true; return t; };
  function loadTex(url) {
    let p = texCache.get(url);
    if (p) texCache.delete(url);                      // re-inserted below as the most recent
    else p = new Promise(ok => loader.load(url, t => ok(prep(t)), undefined, () => ok(null)));
    texCache.set(url, p);
    for (const [old, q] of texCache) {
      if (texCache.size <= KEEP_TEXTURES) break;
      texCache.delete(old);
      q.then(t => { if (!t) return; t.userData.cached = false; if (!inUse(t)) t.dispose(); });
    }
    return p;
  }
  function showTex(tex) {
    const old = sphere.material;
    sphere.material = new THREE.MeshBasicMaterial({ map: tex });
    if (old.map && !old.map.userData.cached && !inUse(old.map)) old.map.dispose();
    old.dispose();
  }

  let fadeSeq = 0;
  function crossFade(tex) {
    const seq = ++fadeSeq;
    fader.material.map = tex;
    fader.material.opacity = 0;
    fader.material.needsUpdate = true;
    fader.visible = true;
    const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1400;
    const step = now => {
      if (seq !== fadeSeq) return;
      const k = Math.min(1, (now - t0) / dur);
      fader.material.opacity = k * k * (3 - 2 * k);
      render();
      if (k < 1) return requestAnimationFrame(step);
      fader.visible = false;
      showTex(tex);
      render();
    };
    requestAnimationFrame(step);
  }

  /** Show a weather: preview first (fast), then the full-resolution render if the GPU can take it. */
  inn.erwina = null;                                   // the Inn cat (explore/erwina.js), made once the room is set up
  async function showWeather(w, { fade = true } = {}) {
    const night = inn.isNight(), time = inn.timeNow(), R = inn.room(), at = inn.state.room, season = inn.seasonNow();
    sound.ambience(at, w, { night, season, time });                     // the room's quiet bed follows the weather
    inn.erwina?.update();                                  // the cat: is a spot possible here, in this weather, at this time?
    const stale = () => w !== inn.state.weather || time !== inn.timeNow() || at !== inn.state.room || season !== inn.seasonNow();
    let shown = w;                                     // a room without this weather's render falls back to rain
    // Dawn, dusk and night try their own render first (explore/pano-times.js says which exist), then fall back, ending at the day render
    let preview = null, got = null;                    // got: [weather, tod] of the render on screen; tod null = the day render
    for (const [cw, tod] of R.dayOnly || R.noNight ? [[w, null]] : usable(R, w, time)) {
      preview = await loadTex(R.pano(cw, tod, false));
      if (preview) { got = [cw, tod]; break; }
    }
    const haveTod = !!got?.[1];                        // until a time's renders exist, tint the day render
    if (!preview && w !== 'rain') { shown = 'rain'; preview = await loadTex(R.pano('rain', false, false)); }
    if (stale()) return;
    inn.$('tint').className = haveTod ? '' : time === 'night' ? 'night' : time === 'dawn' ? 'morning' : time === 'dusk' ? 'evening' : time === 'midday' ? '' : time;
    setThemeColor();
    stage.className = stage.className.replace(/\s*wx-\S+/g, '') + (R.dayOnly || shown !== w ? ` wx-${w}` : '');
    if (preview) inn.erwina?.lightFrom(preview);          // she's lit from the pano on screen
    if (preview) fade && sphere.material.map ? crossFade(preview) : (showTex(preview), render());
    if (useFull) {
      const full = await loadTex(fullUrl(R.pano(got ? got[0] : shown, got ? got[1] : false, true)));
      if (full && !stale()) { showTex(full); if (!fader.visible) render(); }
    }
  }
  const firstView = showWeather(inn.state.weather, { fade: false });
  firstView.then(() => inn.erwina?.ensure());                // the cat: armed on a first load or reload too, once the first view is up
  addEventListener('pageshow', () => inn.erwina?.ensure());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) inn.erwina?.ensure(); });
  window.__door?.innShown(firstView);
  // The browser's toolbar colour: the door's paper while it's up, then parchment by day and the night blue after dark
  function setThemeColor() {
    const c = !inn.$('front-door').hidden ? '#fcf6e5' : inn.isNight() ? '#1e2238' : '#f4efe4';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c);
  }
  new MutationObserver(setThemeColor).observe(inn.$('front-door'), { attributes: true, attributeFilter: ['hidden'] });
  setThemeColor();
  firstView.then(() => {
    const s = performance.now() / 1000;
    inn.track('explore_start', { room: inn.state.room, nav_mode: inn.AI ? 'ai' : 'local', full_res: panoTier === '8k' ? 'yes' : panoTier === 'phone' ? 'phone' : 'no',
                             load_ms: s < 2 ? 'under-2s' : s < 5 ? '2-5s' : s < 10 ? '5-10s' : 'over-10s' });
    // Get the AI navigator's visitor pass (Turnstile, then /session) while the visitor looks around, so their first step
    // doesn't wait for it. Cached for the tab; genieFetch reuses it.
    if (typeof inn.AI === 'function') (window.requestIdleCallback || setTimeout)(() => inn.getPass());
  });

  // yaw: 0 = front wall, + = right; pitch: + = up (same convention as the Blender export)
  const dir = (yaw, pitch) => {
    const y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
    return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }; inn.dir = dir;
  const look = { yaw: 0, pitch: -6 }; inn.look = look;
  createTilt({ stage, look, render });                       // phones: an opt-in chip, the room follows the phone
  // Erwina, the Inn cat: there only once you look (explore/erwina.js). Her lines are content's (gemma-lines.json `erwina`),
  // with stand-ins until they're written. Nothing about her reaches the navigator.
  const ERWINA_LINES = {
    seen: ['Was that Erwina? She does that.', "That's Erwina. She's only there while you're looking."],
    box: ['Is she in there? I never check.', 'That box. She might be in it. She might not.'],
    trace: ['Still warm. She was just here.', "Hairs. Erwina's been and gone."],
    tap: ["Gone. She doesn't stay for questions.", 'And off she goes. She does that too.'],
  };
  const erwinaNote = sure => inn.LINES.erwina?.notebook?.[sure ? 'seen' : 'maybe'] || (sure ? 'You saw Erwina' : 'You think you saw Erwina'); inn.erwinaNote = erwinaNote;
  inn.erwina = createErwina({
    THREE, scene, camera, stage, render, ROOMS: inn.ROOMS, dir, look, saveData, panoTier, sound, track: inn.track,
    room: () => inn.state.room, weather: () => inn.state.weather, isNight: inn.isNight,
    pick: kind => inn.pickLine(`erwina.${kind}`, inn.LINES.erwina?.[kind]?.length ? inn.LINES.erwina[kind] : ERWINA_LINES[kind]),
    say: t => inn.say(t, [], true, { keep: true }),   // she never takes away the question Gemma has just asked
    notes: () => inn.renderNotes(),
    chatCover: () => document.body.dataset.chat === 'full' ? inn.$('chatwin').getBoundingClientRect() : null,   // under the open chat she isn't being looked at
  });
  if (sphere.material.map) inn.erwina.lightFrom(sphere.material.map);
  inn.erwina.update();

  // ---------- the clocks: hands drawn live in true perspective, one set per room view
  // room metres -> viewer space, for a camera standing at eye
  const toThree = ([x, y, z], [ex, ey, ez]) => new THREE.Vector3(x - ex, z - ez, -(y - ey));
  const NORMALS = { '+y': [0, 1, 0], '-y': [0, -1, 0], '+x': [1, 0, 0], '-x': [-1, 0, 0] };
  const clocks = {};
  inn.ROOMS.cuddlecore.clock = inn.world.fixtures?.clock;
  if (inn.ROOMS.cuddlecore.clock) {
    const [cx, cy, cz] = inn.ROOMS.cuddlecore.clock.center;
    inn.kitchenSpots.clock = { yaw: THREE.MathUtils.radToDeg(Math.atan2(cx, cy)), pitch: THREE.MathUtils.radToDeg(Math.atan2(cz - 1.6, Math.hypot(cx, cy))) };
  }
  for (const [id, R] of Object.entries(inn.ROOMS)) if (R.clock) clocks[id] = makeClock(R.clock, R.eye);
  const setHands = (hours, animate) => Object.values(clocks).forEach(c => c.setHands(hours, animate)); inn.setHands = setHands;
  function showClock() { for (const [id, c] of Object.entries(clocks)) c.group.visible = id === inn.state.room; }

  function makeClock(clockFx, eye) {
    const clock = new THREE.Group();
    const at = toThree(clockFx.center, eye);
    clock.position.copy(at);
    const n = clockFx.normal || NORMALS[clockFx.facing] || [0, 1, 0];
    clock.lookAt(at.clone().add(new THREE.Vector3(n[0], n[2], -n[1])));   // lie flat on the clock's face
    const R = clockFx.radius;
    const ink = new THREE.MeshBasicMaterial({ color: 0x2c2416, side: THREE.DoubleSide });
    if (!clockFx.in_render) {                                         // stand-in face until the renders include it
      clock.add(new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0xe9dfca, side: THREE.DoubleSide })));
      clock.add(new THREE.Mesh(new THREE.RingGeometry(R * 0.96, R * 1.08, 48), new THREE.MeshBasicMaterial({ color: 0x5a3e28, side: THREE.DoubleSide })));
      for (let i = 0; i < 12; i++) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.004, i % 3 ? 0.012 : 0.022), ink);
        const a = (i / 12) * Math.PI * 2;
        t.position.set(Math.sin(a) * R * 0.84, Math.cos(a) * R * 0.84, 0.001);
        t.rotation.z = -a;
        clock.add(t);
      }
    }
    const hand = (len, width) => {
      const g = new THREE.PlaneGeometry(width, len);
      g.translate(0, len / 2 - 0.012, 0);                                // pivot near the base
      const m = new THREE.Mesh(g, ink);
      m.position.z = 0.003;
      clock.add(m);
      return m;
    };
    const hourHand = hand(R * 0.55, 0.012), minuteHand = hand(R * 0.82, 0.008);
    scene.add(clock);
    let shown = null;
    const setHands = (hours, animate = true) => {
      const target = ((hours % 12) + 12) % 12;
      const from = shown ?? target;
      const delta = ((target - from) % 12 + 12) % 12;                  // the hands only ever go forward
      const t0 = performance.now(), dur = animate && delta && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 0;
      const step = now => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const h = from + delta * (1 - (1 - k) ** 3);
        hourHand.rotation.z = -(h / 12) * Math.PI * 2;
        minuteHand.rotation.z = -((h % 1) * Math.PI * 2);
        render();
        if (k < 1) requestAnimationFrame(step);
      };
      shown = target;
      requestAnimationFrame(step);
    };
    return { group: clock, setHands };
  }
  const handsHour = () => inn.state.time ? inn.world.times[inn.state.time].hour : new Date().getHours() + new Date().getMinutes() / 60; inn.handsHour = handsHour;

  // ---------- hotspots
  inn.hotspots = []; let spotOrder = '';
  function buildHotspots() {
    inn.hotspots.forEach(h => h.el.remove());
    inn.hotspots = Object.entries(inn.spots).filter(([id]) => inn.world.objects[id]).map(([id, s]) => {
      const obj = inn.world.objects[id];
      const el = document.createElement('button');
      // Dials and candles show their name on hover only: a row of them would crowd the view
      // An ambient object that only speaks has no dot or name (quiet.js notices it on hover or a rest); one that opens something keeps its dot
      const quiet = obj.type === 'ambient' && [59, 60].includes(inn.touchOrder?.(obj, id));
      el.className = `spot ${obj.type === 'ambient' ? 'ambient' : obj.type === 'dial' || obj.type === 'energy' ? '' : 'is-tool'} ${obj.type}${quiet ? ' quiet' : ''}`;
      el.innerHTML = `<span class="dot"></span><span class="name">${inn.esc(obj.label)}${obj.blurb ? `<span class="blurb">${inn.esc(obj.blurb)}</span>` : ''}</span>`;
      const hname = obj.map || obj.label;   // the Map's name, so the three dials aren't all "The dial" (a11y review 1, B4)
      el.setAttribute('aria-label', obj.blurb ? `${hname}: ${obj.blurb}` : hname);
      el.dataset.spot = id;                                    // for scripted checks (the sheet contract test)
      el.addEventListener('click', e => { e.stopPropagation(); inn.touch(id); });
      document.body.appendChild(el);
      return { id, el, s, quiet, v: dir(s.yaw, s.pitch).multiplyScalar(10) };
    });
    inn.showCandle();
  }

  let ideasCol = null;
  function render() {
    ideasCol ||= document.querySelector('.ideas');
    camera.lookAt(dir(look.yaw, look.pitch));
    renderer.render(scene, camera);
    // A name that would run under Gemma's idea bubbles (the right-hand column) trails to the left of its dot instead
    // (QA 3 #5: the foyer's Check in under the bubbles at 812x375)
    const col = ideasCol?.childElementCount ? ideasCol.getBoundingClientRect() : null;
    for (const h of inn.hotspots) {
      const p = h.v.clone().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      h.el.style.display = vis ? '' : 'none';
      const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
      h.el.style.left = `${x}px`;
      h.el.style.top = `${y}px`;
      h.x = p.x;
      if (vis) {
        const w = h.nameW ||= h.el.querySelector('.name')?.offsetWidth || 0;
        h.px = x; h.py = y; h.w = w;
        h.underBubbles = !!col && col.width > 0 && x + 20 + w > col.left - 6 && x - 26 - w > 0 && y > col.top - 20 && y < col.bottom + 20;
      }
    }
    // A name that would run over another spot's dot trails to the left of its own dot instead, when the left is clear
    // (a polish item: "How you like it" brushed "The bowl" at 812x375)
    const shown = inn.hotspots.filter(h => !h.quiet && h.px !== undefined && h.el.style.display !== 'none');   // a quiet one has no name to run over anything
    const dotIn = (h, x0, x1) => shown.some(o => o !== h && o.px > x0 && o.px < x1 && Math.abs(o.py - h.py) < 14);
    for (const h of shown) {
      h.el.classList.toggle('name-left', h.underBubbles || (dotIn(h, h.px + 8, h.px + 24 + h.w) && !dotIn(h, h.px - 28 - h.w, h.px - 8) && h.px - 26 - h.w > 0));
    }
    edgeHints.update(inn.hotspots, camera);                     // phones: arrows toward what's off-screen
    // Names trail to the right, so keep the spots in left-to-right order: a spot is always above any name coming
    // from its left, and a shown name never covers the next dot (NEW-4). Only when the order changes, and never
    // while a spot has focus (moving it would drop the focus).
    const order = inn.hotspots.filter(h => h.el.style.display !== 'none').sort((a, b) => a.x - b.x);
    const key = order.map(h => h.id).join();
    if (key !== spotOrder && !document.activeElement?.classList.contains('spot')) { spotOrder = key; order.forEach(h => document.body.appendChild(h.el)); }
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < 720 ? 82 : 72;
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', resize);

  inn.drag = null; inn.lastMove = performance.now(); inn.hasLooked = false;   // no lingering until the visitor has looked around
  stage.addEventListener('pointerdown', e => { inn.drag = { x: e.clientX, y: e.clientY, ...look }; stage.classList.add('dragging'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => {
    if (!inn.drag) return;
    const k = camera.fov / innerHeight;
    look.yaw = inn.drag.yaw - (e.clientX - inn.drag.x) * k;
    look.pitch = THREE.MathUtils.clamp(inn.drag.pitch + (e.clientY - inn.drag.y) * k, -75, 75);
    inn.lastMove = performance.now();
    inn.hasLooked = true;
    render();
  });
  // A drag ends however the pointer goes: lifted, cancelled by the browser (a scroll or gesture took over), or capture lost (R16)
  const endDrag = () => { inn.drag = null; stage.classList.remove('dragging'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stage.addEventListener(t, endDrag));
  // Keyboard look-around (R14): with the room focused (Tab to it), arrows turn the view and + / - zoom
  stage.tabIndex = 0;
  stage.setAttribute('role', 'application');
  stage.setAttribute('aria-roledescription', '360 degree room');
  stage.setAttribute('aria-label', 'The room. Arrow keys look around, plus and minus zoom.');
  stage.addEventListener('keydown', e => {
    const turn = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
    const zoom = { '+': -6, '=': -6, '-': 6, '_': 6 }[e.key];
    if (!turn && !zoom) return;
    e.preventDefault();
    if (turn) { look.yaw += turn[0]; look.pitch = THREE.MathUtils.clamp(look.pitch + turn[1], -75, 75); }
    if (zoom) { camera.fov = THREE.MathUtils.clamp(camera.fov + zoom, 40, 95); camera.updateProjectionMatrix(); }
    inn.lastMove = performance.now();
    inn.hasLooked = true;
    render();
  });
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches; inn.reduceMotion = reduceMotion;
  stage.addEventListener('wheel', e => { camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 40, 95); camera.updateProjectionMatrix(); render(); }, { passive: true });

  // opts (the tour's walk, 28 Oct): { ms, ease: 'inOut' } for a slower, gentler turn; a newer lookTo takes over from an older one
  let lookSeq = 0;
  function lookTo(yaw, pitch, { ms = 700, ease = 'out' } = {}) {
    const from = { ...look }, seq = ++lookSeq;
    let dy = ((yaw - from.yaw + 540) % 360) - 180;          // shortest way round
    const t0 = performance.now(), dur = reduceMotion() ? 0 : ms;   // reduced motion: jump straight there (R15)
    const step = now => {
      if (seq !== lookSeq) return;
      const k = dur ? Math.min(1, (now - t0) / dur) : 1,
        e = ease === 'inOut' ? (k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2) : 1 - (1 - k) ** 3;
      look.yaw = from.yaw + dy * e;
      look.pitch = from.pitch + (Math.max(-30, pitch) - from.pitch) * e;
      inn.lastMove = now;
      render();
      if (k < 1) requestAnimationFrame(step);
    };
    dur ? requestAnimationFrame(step) : step(t0);   // reduced motion: there at once
  }

  // ---------- walking through a door (tour.js, sitdown.js): a slow step forward, then a fade through to the next picture
  const veil = document.createElement('div');
  veil.id = 'walk-veil';
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  let walkSeq = 0, fovHome = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frames = (ms, fn, seq) => new Promise(res => {
    const t0 = performance.now();
    const f = now => {
      if (seq !== walkSeq) return res(false);
      const k = Math.min(1, (now - t0) / ms);
      fn(k);
      k < 1 ? requestAnimationFrame(f) : res(true);
    };
    requestAnimationFrame(f);
  });
  function restoreFov() {
    if (fovHome != null) { camera.fov = fovHome; camera.updateProjectionMatrix(); fovHome = null; }
  }
  /** Step forward (the view narrows, `ms`) then fade through dark; `swap` changes the room at the darkest moment and the
   *  view fades back in. Resolves true when it finished, false if walkAbort() or another walk cut it off (then `swap` may not
   *  have run). Reduced motion: no step, no fade: swap at once */
  async function walkThrough(swap, { dolly = 900, fadeOut = 260, fadeIn = 340 } = {}) {
    const seq = ++walkSeq;
    veil.style.opacity = 0;
    if (reduceMotion()) { restoreFov(); swap(); return true; }
    fovHome = camera.fov;
    const f0 = camera.fov, f1 = Math.max(46, f0 * .68);
    const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    if (dolly > 0 && !await frames(dolly, k => { camera.fov = f0 + (f1 - f0) * ease(k); camera.updateProjectionMatrix(); render(); }, seq)) return false;
    veil.style.transition = `opacity ${fadeOut}ms ease-in`;
    veil.style.opacity = 1;
    await wait(fadeOut);
    if (seq !== walkSeq) return false;
    restoreFov();
    swap();
    veil.style.transition = `opacity ${fadeIn}ms ease-out`;
    veil.style.opacity = 0;
    await wait(fadeIn);
    return seq === walkSeq;
  }
  /** Cut a walk short: no more steps, the view back to its own width, the veil gone */
  function walkAbort() {
    walkSeq++;
    restoreFov();
    veil.style.transition = 'none';
    veil.style.opacity = 0;
  }
  Object.assign(inn, { walkThrough, walkAbort });
}
