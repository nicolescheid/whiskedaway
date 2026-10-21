/**
 * Erwina, the Inn cat (docs: the cat plan in the PM's notes; Nicole's brief, 20 Oct 2026).
 *
 * She isn't anywhere until she's observed. Each visit, the spots that suit the weather and the time are possible; when
 * the visitor holds the view on one (about 9° from the centre, still for a second) it collapses: she's there (most
 * often), or there's only the box, or only a trace. Once her spot leaves the frame, or the visitor leaves the room,
 * she's gone for the visit, and looking back finds a trace.
 *
 * She's a real three.js model (assets/erwina.glb, made by blender/cat_build.py) placed in room metres, so her size and
 * perspective are true from every camera stop. She's lit from the pano on screen (a light probe made from it, plus a
 * soft key from its brightest side), so weather, season and night carry over. Where something in the pano stands in
 * front of her, an invisible depth-only stand-in made from the build's own coordinates hides her.
 *
 * Loaded only in a room where a spot is possible this visit, never on Data Saver or the "none" pano tier.
 * Reduced motion: no fade, no blink, ear twitch, tail flick or breathing; she simply is or isn't there.
 * Nothing here talks to the navigator: sightings never steer the recipes.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/';
const KEY = 'wa-erwina';
const SEE_DEG = 9;            // how close to the centre of the view her spot must be
const MAX_LINES = 2;          // Gemma mentions her at most this often a visit

// Room metres (Z up), as the Blender builds use them. camYaw: where the middle of that room's pano looks (0 = +Y).
const SPOTS = {
  conservatory: {
    rooms: ['glasshouse'], camYaw: 90, at: [1.66, 2.565, 0.8], turn: -8, pose: 'sit',
    when: s => !s.night && ['fair', 'very-dry', 'change'].includes(s.weather),          // the staging in the sun
    // the lane oil lamp (glasshouse_build.oil_lamps) stands between her and the camera
    occluders: [{ cyl: [1.47, 2.55, 0.8, 0.05, 0.03] }, { cyl: [1.47, 2.55, 0.83, 0.022, 0.04] },
                { cyl: [1.47, 2.55, 0.87, 0.045, 0.1] }, { cyl: [1.47, 2.55, 0.97, 0.012, 0.25] }],
    trace: 'hairs', hair: 0x6f7279, size: 0.55, tone: 1, shadow: true,     // the staging is close to the camera: a smaller tuft
    // the sun in these renders (glasshouse_build SUN_AZ): from the garden, a little lane-ward, high. She's backlit by it.
    sun: { az: -35, el: 45, color: 0xffe0b0, k: s => ({ fair: 2.6, 'very-dry': 2.8, change: 1.6 })[s.weather] || 0 },
  },
  flourish: {
    rooms: ['flourish'], camYaw: 0, at: [0.5, 3.85, 2.12], turn: 0, pose: 'curled', boxScale: 0.7,
    when: s => ['rain', 'stormy'].includes(s.weather),                                  // curled up above the warm range
    // the hood's lower box (flourish_build: hood_low) hides the ledge she lies on
    occluders: [{ box: [0, 0.62, 3.17, 4.5, 1.98, 2.12] }],
    trace: 'hairs', hair: 0x666970, lift: 0.9, shadow: false,    // grey on the hood's white top; a tuft and a pressed patch where she lay
  },
  // The armchair by the back wall of Cuddlecore (cuddlecore_build: ArmChair_01, seat at 0.46 m): warm nights when the weather turns
  cuddlecore: {
    rooms: ['cuddlecore'], camYaw: 0, at: [0.85, -1.56, 0.47], turn: 0, pose: 'sit', boxScale: 0.7,
    when: s => s.night && ['stormy', 'change'].includes(s.weather),
    occluders: [],
    trace: 'hairs', hair: 0x655d54, size: 1.1, tone: 0.85, shadow: true,
    sun: { at: [0.3, 0.2, 1.9], color: 0xffcf9a, k: s => (s.night ? 1.3 : 0) },        // the room's lamplight, from the middle
  },
  // The window seat in Sweet Spells' bay (sweet_spells_build: the seat cushion at 0.49 m), at its right end, clear of the spell table's props
  'sweet-spells': {
    rooms: ['sweet-spells'], camYaw: 180, at: [2.75, -0.2, 0.49], turn: 0, pose: 'sit', boxScale: 0.7,
    when: s => !s.night && ['rain', 'change'].includes(s.weather),                       // watching the lane in the wet
    occluders: [],
    trace: 'hairs', hair: 0x6e6064, size: 1.1, tone: 0.85, shadow: true,
    sun: { at: [2.2, 1.6, 2.3], color: 0xffe2bc, k: s => (s.night ? 0 : 1.5) },          // the room's light, from the middle: the bay behind her would leave her in silhouette
  },
  // The shop-window sill in the Chiapothecary (chiapothecary_build: sill at 0.95 m), between the jars and the plant
  chiapothecary: {
    rooms: ['chiapothecary'], camYaw: 0, at: [2.375, 0.17, 0.95], turn: 0, pose: 'sit', boxScale: 0.6,
    when: s => !s.night && ['stormy', 'very-dry'].includes(s.weather),
    occluders: [],
    trace: 'hairs', hair: 0x6e6760, size: 1.1, tone: 0.85, shadow: true,
    sun: { at: [2.2, 2.2, 2.4], color: 0xfff0d8, k: s => (s.night ? 0 : 1.7) },          // the room's light on her face, not the window's behind her
  },
  hallway: {
    rooms: ['hall-middle', 'hall-entrance'], camYaw: 0, at: [0.02, 7.7, 0.6], turn: 0, pose: 'sit',
    when: s => s.night,                                                                  // the sea-window sill at night
    occluders: [],
    trace: 'hairs', hair: 0x77797f, size: 1.8, shadow: true,
    sun: { at: [-0.86, 7.25, 2.15], color: 0xffc58a, k: s => (s.night ? 1.8 : 0) },    // the wall lamp by the window
    basket: [0.6, 7.47, 0.24],                     // the lidded basket under the window (hallway_build): her box here
  },
};

export function createErwina(o) {
  const { THREE, scene, camera, stage, render, ROOMS } = o;
  const force = new URLSearchParams(location.search).get('erwina');          // ?erwina=there|box|trace, for testing
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mem = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } })()
    || { spots: {}, lines: 0, notes: [] };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* private mode */ } };
  // a new page (a reload, or back from elsewhere) counts as leaving: wherever she was, she's gone now
  for (const k of Object.keys(mem.spots)) if (mem.spots[k] === 'there') mem.spots[k] = 'gone';
  const allowed = !o.saveData && o.panoTier !== 'none';

  let gltf = null, loading = null;
  let active = null;               // { id, def, group, cat, box, trace, sit, curled, pos, occ }
  let anim = null;                 // the idle loop while she's on screen
  let purr = 0, purring = false;   // the rare purr, a few seconds into a sighting
  const probe = new THREE.LightProbe();
  const key = new THREE.DirectionalLight(0xffffff, 0);
  probe.layers.enableAll();
  scene.add(probe, key, key.target);

  const spotIn = id => Object.entries(SPOTS).find(([, d]) => d.rooms.includes(id));
  const now = () => ({ night: o.isNight(), weather: o.weather() });
  const possible = () => { const s = spotIn(o.room()); return s && s[1].when(now()) ? s : null; };

  // ---------- room metres -> the page's three.js space (the camera at the room's eye)
  function toView(def, [x, y, z], eye = ROOMS[o.room()].eye) {
    const a = THREE.MathUtils.degToRad(def.camYaw);
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    return new THREE.Vector3(rx, dz, -ry);
  }

  // ---------- loading (lazy, and only when a spot is possible here)
  let tries = 0;
  function load() {
    if (gltf || loading || !allowed) return loading;
    loading = (async () => {
      const bust = tries ? `?retry=${tries}` : '';            // a failed import is remembered by the browser: a retry needs a new address
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import(`${CDN}loaders/GLTFLoader.js${bust}`), import(`${CDN}libs/meshopt_decoder.module.js${bust}`)]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      gltf = await loader.loadAsync('explore/assets/erwina.glb');
      gltf.scene.traverse(m => {
        if (!m.isMesh) return;
        m.frustumCulled = false;                       // skinned bounds don't follow the bones
        m.renderOrder = 2;
        const mat = m.material;
        if (mat.name === 'fur') {                      // velvet, not vinyl: a soft sheen and a rough surface
          mat.roughness = 0.85;
          mat.sheen = 0.6;
          mat.sheenRoughness = 0.55;
          mat.sheenColor = new THREE.Color(0x9ea4ae);
        }
      });
    })().then(() => { place(); }).catch(e => {
      // a failed fetch (the CDN, a flaky connection) or a failed first placement: say so, and try again a few times
      console.warn('Erwina:', e?.message || e);
      loading = null;
      if (++tries < 4) setTimeout(() => { if (!active && possible()) update(); }, tries * 3000);
    });
    return loading;
  }

  // ---------- light from the pano on screen
  const shBasis = new Array(9);
  let lastPx = null;               // the pano on screen at 64 x 32, for the surface her trace sits on
  /** A light probe (and a soft key light from its brightest side) from the room's equirect texture. */
  function lightFrom(tex) {
    const img = tex?.image;
    if (!img || !img.width) return;
    const W = 64, H = 32;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(img, 0, 0, W, H); } catch { return; }
    let px;
    try { px = g.getImageData(0, 0, W, H).data; } catch { return; }
    lastPx = px;
    const sh = new THREE.SphericalHarmonics3();
    const col = new THREE.Color();
    let total = 0;
    for (let j = 0; j < H; j++) {
      const pitch = 90 - (j + 0.5) * 180 / H;
      const w = Math.cos(THREE.MathUtils.degToRad(pitch));               // the solid angle of an equirect row
      for (let i = 0; i < W; i++) {
        const yaw = (i + 0.5) * 360 / W - 180;
        const n = o.dir(yaw, pitch).normalize();
        const k = (j * W + i) * 4;
        col.setRGB(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255, THREE.SRGBColorSpace);   // to linear
        THREE.SphericalHarmonics3.getBasisAt(n, shBasis);
        for (let b = 0; b < 9; b++) {
          sh.coefficients[b].x += shBasis[b] * col.r * w;
          sh.coefficients[b].y += shBasis[b] * col.g * w;
          sh.coefficients[b].z += shBasis[b] * col.b * w;
        }
        total += w;
      }
    }
    const norm = (4 * Math.PI) / total;
    sh.coefficients.forEach(v => v.multiplyScalar(norm));
    probe.sh.copy(sh);
    probe.intensity = 0.7;                       // the probe sees the whole bright room; less of it keeps her shading
    // the brightest side: the probe's first band. A soft key from there gives her shading and the sheen its rim.
    const lum = v => 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;
    const d = new THREE.Vector3(lum(sh.coefficients[3]), lum(sh.coefficients[1]), lum(sh.coefficients[2]));
    const strength = THREE.MathUtils.clamp(d.length() / Math.max(1e-4, lum(sh.coefficients[0])), 0, 1.2);
    const c1 = sh.coefficients[0];
    key.color.setRGB(c1.x, c1.y, c1.z).multiplyScalar(1 / Math.max(1e-4, Math.max(c1.x, c1.y, c1.z)));
    key.intensity = strength * lum(c1) * 2.2;
    d.y *= 0.5;                                  // a bright roof or ceiling shouldn't light her only from straight above
    key.userData.dir = d.lengthSq() ? d.normalize() : new THREE.Vector3(0, 1, 0);
    key.userData.color = key.color.clone();
    key.userData.k = key.intensity;
    aimKey();
    tuneTrace();
  }
  /**
   * Her trace in her own grey, set against the surface it lies on: a spot with a `tone` takes the pano's brightness under
   * it (the pano on screen, so weather and time carry over) and the fur is that fraction as bright, grey and never
   * brighter than the surface. A fixed colour on a dim room's cushion would read as white.
   */
  function tuneTrace() {
    const a = active;
    if (!a?.trace || !a.def.tone || !lastPx) return;
    const W = 64, H = 32, v = a.pos, len = v.length() || 1;
    const yaw = THREE.MathUtils.radToDeg(Math.atan2(v.x, -v.z)), pitch = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y / len, -1, 1)));
    const i0 = Math.floor(((yaw + 180) / 360) * W), j0 = Math.floor(((90 - pitch) / 180) * H);
    let sum = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = (i0 + di + W) % W, j = Math.min(H - 1, Math.max(0, j0 + dj)), k = (j * W + i) * 4;
      sum += (0.2126 * lastPx[k] + 0.7152 * lastPx[k + 1] + 0.0722 * lastPx[k + 2]) / 255;
      n++;
    }
    const g = THREE.MathUtils.clamp((sum / n) * a.def.tone, 0.2, 0.7);
    a.trace.traverse(m => m.material?.color?.setRGB(g * 1.0, g, g * 1.02, THREE.SRGBColorSpace));
  }
  /** The key light: the spot's own sun or lamp when it's on (as the renders light it), otherwise the probe's brightest side. */
  function aimKey() {
    if (!active) return;
    const sun = active.def.sun, k = sun?.k(now());
    let d = key.userData.dir || new THREE.Vector3(0, 1, 0);
    if (k) {
      // a sun (az, el in room degrees) or a lamp (a point in room metres)
      const az = THREE.MathUtils.degToRad(sun.az ?? 0), el = THREE.MathUtils.degToRad(sun.el ?? 0);
      d = sun.at ? toView(active.def, sun.at).sub(active.pos).normalize()
        : toView(active.def, [0, 0, 0], [-Math.cos(az) * Math.cos(el), -Math.sin(az) * Math.cos(el), -Math.sin(el)]).normalize();
      key.color.set(sun.color);
      key.intensity = k;
    } else if (key.userData.color) {
      key.color.copy(key.userData.color);
      key.intensity = key.userData.k;
    }
    key.position.copy(active.pos).addScaledVector(d, 2);
    key.target.position.copy(active.pos);
  }

  // ---------- building what a spot shows
  const blobTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');   // tinted by the material
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  function blob(w, d, opacity, color = 0x000000) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: blobTex, color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.renderOrder = 3;
    return m;
  }
  /**
   * What she leaves: a soft pressed patch of her own grey fur with a scatter of fine short hairs and a few loose wisps
   * (not a tuft of long strands, which read as sticks). The patch is what a phone sees; the hairs give it its edge.
   * Colour is the spot's grey: lighter on the dark sill, darker on the white hood. The same patch every time.
   */
  function hairs(color, curled, lift = 0.5, size = 1) {
    const g = new THREE.Group();
    const spread = (curled ? 0.11 : 0.12) * size;      // on the hood the top is narrow: keep it all over the box, not hanging past its edge
    const wide = blob(spread * 2.4, spread * 2, 0.6, color);          // the pressed patch, soft at its edges
    wide.position.y = 0.002;
    const core = blob(spread * 1.4, spread * 1.1, 0.4, color);
    core.position.set(0.01 * size, 0.0025, 0.005 * size);
    g.add(wide, core);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: curled ? 0.8 : 0.65, depthWrite: false, side: THREE.DoubleSide });
    let r = 7;                                                   // a small fixed-seed generator
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const one = (len, w, rad, up) => {
      const a = rnd() * Math.PI * 2;
      const h = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
      h.rotation.set(-Math.PI / 2 + up, 0, rnd() * Math.PI);
      h.position.set(Math.cos(a) * rad * 1.2, 0.004 + (len / 2) * Math.sin(up), Math.sin(a) * rad * 0.9);
      h.renderOrder = 3;
      g.add(h);
    };
    for (let n = 0; n < 110; n++) one((0.014 + rnd() * 0.018) * size, 0.0042, Math.sqrt(rnd()) * spread, rnd() * 0.25);   // fine and short, lying down
    for (let n = 0; n < (curled ? 20 : 4); n++) one((0.026 + rnd() * 0.02) * size * (curled ? 2.2 : 1), curled ? 0.006 : 0.004, (0.4 + rnd() * 0.6) * spread, rnd() < lift ? 0.5 + rnd() * 0.5 : rnd() * 0.2);   // a few loose wisps
    if (curled) g.position.x = -0.1;
    return g;
  }
  function occluder(def, s) {
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false });
    let m;
    if (s.cyl) {
      const [x, y, z0, r, h] = s.cyl;
      m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
      m.position.copy(toView(def, [x, y, z0 + h / 2]));
    } else {
      const [x0, x1, y0, y1, z0, z1] = s.box;
      const swap = Math.round(def.camYaw / 90) % 2 !== 0;
      m = new THREE.Mesh(new THREE.BoxGeometry(swap ? y1 - y0 : x1 - x0, z1 - z0, swap ? x1 - x0 : y1 - y0), mat);
      m.position.copy(toView(def, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]));
    }
    m.renderOrder = 1;
    return m;
  }

  /** Build (or rebuild) what this room's spot shows now, from the visit's memory of it. */
  function place() {
    clear();
    const p = possible();
    const [id, def] = p || spotIn(o.room()) || [];
    if (!def || !gltf) return;
    const st = mem.spots[id];
    if (!p && !st) return;                          // not possible here now, and never observed: nothing at all
    const group = new THREE.Group();
    const pos = toView(def, def.at);
    group.position.copy(pos);
    group.rotation.y = Math.atan2(-pos.x, -pos.z) + THREE.MathUtils.degToRad(def.turn);   // facing the camera
    const tpl = gltf.scene;
    // a SkinnedMesh clone keeps pointing at the template's bones: cloneSkinned re-binds it to its own
    const cat = def.pose === 'curled' ? tpl.getObjectByName('Erwina_curled').clone(true) : cloneSkinned(tpl.getObjectByName('Erwina')).clone;
    cat.visible = false;
    cat.traverse(m => { if (m.isMesh) m.material = m.material.clone(); });
    group.add(cat);
    const box = tpl.getObjectByName('Box').clone(true);
    box.scale.setScalar(def.boxScale || 1);
    box.rotation.y = 0.5;
    box.visible = false;
    box.traverse(m => { if (m.isMesh) m.renderOrder = 2; });
    group.add(box);
    const shadow = def.shadow ? blob(def.pose === 'curled' ? 0.42 : 0.34, def.pose === 'curled' ? 0.36 : 0.32, 0.5) : null;
    if (shadow) { shadow.visible = false; group.add(shadow); }
    const trace = def.trace === 'hairs' ? hairs(def.hair, def.pose === 'curled', def.lift, def.size) : null;
    if (trace) { trace.visible = false; group.add(trace); }
    const occ = def.occluders.map(s => occluder(def, s));
    // in the hallway the basket is her box: two eyes in the gap under its lid, there for a blink
    let glints = null;
    if (def.basket) {
      glints = new THREE.Group();
      const gm = new THREE.MeshBasicMaterial({ color: 0xffc35a });
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), gm);
        e.scale.set(1, 0.7, 0.5);
        e.position.x = sx * 0.018;
        glints.add(e);
      }
      glints.position.copy(toView(def, def.basket));
      glints.lookAt(0, 0, 0);
      glints.visible = false;
      scene.add(glints);
    }
    scene.add(group, ...occ);
    active = { id, def, group, cat, box, shadow, trace, occ, glints, pos, seenAt: 0 };
    aimKey();
    tuneTrace();
    show(st);
  }
  function clear() {
    if (!active) return;
    stopAnim();
    scene.remove(active.group, ...active.occ);
    if (active.glints) scene.remove(active.glints);
    active = null;
  }
  // What each state shows. undefined: nothing (she isn't anywhere yet). 'there': her. 'box': the box (or the basket's
  // eyes). 'trace' / 'gone': only a trace.
  function show(st) {
    const a = active;
    if (!a) return;
    a.cat.visible = st === 'there';
    if (a.shadow) a.shadow.visible = st === 'there';
    a.box.visible = st === 'box' && !a.def.basket;
    if (a.glints) a.glints.visible = st === 'box';
    if (a.trace) a.trace.visible = st === 'trace' || st === 'gone';
    if (st === 'there' || (st === 'box' && a.glints)) startAnim(st);
    else stopAnim();
  }

  // ---------- re-binding a skinned clone (three's SkeletonUtils.clone, kept small)
  function cloneSkinned(src) {
    const clone = src.clone(true);
    const bones = {};
    clone.traverse(n => { if (n.isBone) bones[n.name] = n; });
    clone.traverse(n => {
      if (!n.isSkinnedMesh) return;
      const sk = n.skeleton;
      n.bind(new THREE.Skeleton(sk.bones.map(b => bones[b.name]), sk.boneInverses), n.bindMatrix);
    });
    return { clone, bones };
  }

  // ---------- idles (blink, ear twitch, tail flick, breathing) and the fade in
  function startAnim(st) {
    stopAnim();
    const a = active;
    if (reduce()) { setOpacity(a.cat, 1); render(); return; }
    const t0 = performance.now();
    const fadeIn = st === 'there' && !a.faded;
    a.faded = true;
    // a page without animation frames (a background tab, some previews) would leave her faded out: finish by timer
    if (fadeIn) setTimeout(() => { if (active === a && a.cat.visible) { setOpacity(a.cat, 1); render(); } }, 700);
    if (st === 'there' && a.def.pose !== 'curled' && (force || Math.random() < 0.25)) {   // now and then, a purr once she's settled
      purr = setTimeout(() => {
        if (active !== a || mem.spots[a.id] !== 'there') return;
        purring = true;
        o.sound?.erwina?.('purr');
      }, 4500);
    }
    const bones = {};
    a.cat.traverse(n => { if (n.isBone) bones[n.name] = n; });
    const rest = {};
    for (const [k, b] of Object.entries(bones)) rest[k] = b.quaternion.clone();
    let nextBlink = t0 + 2600 + Math.random() * 2000, nextEar = t0 + 4000, nextFlick = t0 + 700;
    const q = new THREE.Quaternion(), ax = new THREE.Vector3();
    let last = 0;
    const step = now => {
      anim = requestAnimationFrame(step);
      if (now - last < 33) return;                       // about 30 fps is plenty for a cat sitting still
      last = now;
      const t = (now - t0) / 1000;
      if (fadeIn) setOpacity(a.cat, Math.min(1, (now - t0) / 600));
      if (st === 'box' && a.glints) {                    // the basket's eyes, blinking now and then
        a.glints.scale.y = (now - t0) % 3400 > 3250 ? 0.1 : 1;
        render();
        return;
      }
      if (a.def.pose === 'curled') {
        a.cat.scale.set(1, 1 + Math.sin(t * 1.6) * 0.018, 1 + Math.sin(t * 1.6) * 0.008);   // breathing
        render();
        return;
      }
      const turn = (name, axis, ang) => { const b = bones[name]; if (!b) return; ax.set(...axis); q.setFromAxisAngle(ax, ang); b.quaternion.copy(rest[name]).multiply(q); };
      turn('head', [0, 1, 0], Math.sin(t * 0.5) * 0.06);
      // blink: a quick squash of each eye
      const bk = now > nextBlink ? Math.max(0, 1 - Math.abs(now - nextBlink - 90) / 90) : 0;
      if (now > nextBlink + 180) nextBlink = now + 2500 + Math.random() * 3500;
      for (const e of ['eye_L', 'eye_R']) if (bones[e]) bones[e].scale.set(1, 1, 1 - bk * 0.9);
      // ear twitch: a quick flick of one ear
      const ek = now > nextEar ? Math.max(0, 1 - Math.abs(now - nextEar - 80) / 80) : 0;
      if (now > nextEar + 160) nextEar = now + 4000 + Math.random() * 5000;
      turn('ear_R', [1, 0, 0], ek * 0.35);
      // tail flick: the tip lifts and settles (three's loader drops the dots from Blender's tail.0..4)
      const fk = now > nextFlick ? Math.sin(Math.min(1, (now - nextFlick) / 700) * Math.PI) : 0;
      if (now > nextFlick + 700) nextFlick = now + 3000 + Math.random() * 4000;
      turn('tail2', [1, 0, 0], fk * 0.25);
      turn('tail3', [1, 0, 0], fk * 0.35);
      turn('tail4', [1, 0, 0], fk * 0.45);
      render();
    };
    anim = requestAnimationFrame(step);
  }
  function stopAnim() {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
    clearTimeout(purr);
    if (purring) { purring = false; o.sound?.erwina?.('stop'); }
  }
  function setOpacity(obj, k) {
    obj.traverse(m => {
      if (!m.isMesh) return;
      m.material.transparent = k < 1;
      m.material.opacity = k;
      m.material.depthWrite = k >= 1;
    });
  }

  // ---------- observing
  const roll = () => force && ['there', 'box', 'trace'].includes(force) ? force
    : (r => (r < 0.7 ? 'there' : r < 0.85 ? 'box' : 'trace'))(Math.random());
  function observe() {
    const a = active, def = a.def;
    const out = roll();
    mem.spots[a.id] = out;
    save();
    show(out);
    render();
    if (out === 'there') {
      if (!reduce() && (force || Math.random() < 0.3)) o.sound?.erwina?.('meow');     // rare, and only with sound on (the hook checks)
      o.track?.('erwina_seen');
      note(true);
      line('seen');
    } else if (out === 'box') {
      note(false);
      line('box');
    } else line('trace');
    a.seenAt = performance.now();
  }
  function line(kind) {
    if (mem.lines >= MAX_LINES) return;
    const t = o.pick(kind);
    if (!t) return;
    mem.lines++;
    save();
    o.say(t);
  }
  function note(sure) {
    mem.notes.push({ sure, t: Date.now() });
    mem.notes = mem.notes.slice(-10);
    save();
    o.notes?.();
  }
  /** Is a view direction hidden under the chat panel (when it's open at Full)? Then it isn't being looked at. */
  function covered(dirv) {
    const r = o.chatCover?.();
    if (!r) return false;
    const v = dirv.clone().multiplyScalar(5).project(camera);
    const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  /** Every linger tick (300 ms): has the visitor looked at her spot, or has it left the frame? */
  function tick({ still }) {
    const a = active;
    if (!a) return;
    const st = mem.spots[a.id];
    const p = a.pos.clone();
    const v = p.clone().project(camera);
    const inFrame = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    if (!st) {
      const centre = o.dir(o.look.yaw, o.look.pitch).normalize();
      // her middle, not her feet: aim a little above the spot
      const mid = toView(a.def, [a.def.at[0], a.def.at[1], a.def.at[2] + 0.12]).normalize();
      if (still && THREE.MathUtils.radToDeg(centre.angleTo(mid)) < SEE_DEG && !covered(mid)) observe();
      return;
    }
    if ((st === 'there' || (st === 'box' && a.glints)) && !inFrame && performance.now() - a.seenAt > 500) {
      mem.spots[a.id] = 'gone';                       // looked away: she's gone (the basket's eyes too), and a trace is left
      save();
      show('gone');
    }
  }

  // ---------- tapping her (she lets you see her once)
  let down = null;
  stage.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointerup', e => {
    const a = active;
    if (!down || !a || mem.spots[a.id] !== 'there') return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = stage.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const centre = toView(a.def, [a.def.at[0], a.def.at[1], a.def.at[2] + 0.13]);
    if (ray.ray.distanceToPoint(centre) > 0.14) return;
    mem.spots[a.id] = 'gone';
    save();
    line('tap');
    show('gone');
    render();
  });

  /** Called on arrival in a room, and when the weather or the time changes. */
  function update() {
    if (!allowed) return;
    const here = spotIn(o.room())?.[0];
    const left = active && active.id !== here;
    // gone for the visit: she was there and the visitor left the room, or the weather or time no longer suits her
    if (active && mem.spots[active.id] === 'there' && (left || !possible())) { mem.spots[active.id] = 'gone'; save(); }
    if (force && here && (left || !active)) { delete mem.spots[here]; save(); }    // testing: every arrival re-arms her
    if (!possible() && !mem.spots[here]) return clear();
    // not requestIdleCallback alone: a hidden or busy page can starve it, and she'd never arm on a first load
    if (gltf) place(); else { let ran = false; const go = () => { if (!ran) { ran = true; load(); } }; (window.requestIdleCallback || setTimeout)(go, { timeout: 800 }); setTimeout(go, 1200); }
  }
  /** Arm her if a spot is possible here and she isn't yet (a first load, a page coming to the front). */
  function ensure() { if (allowed && !active && possible()) update(); }

  /** The notebook's lines about her, oldest first, with their times. */
  const notes = () => mem.notes;
  const api = { update, ensure, tick, lightFrom, notes, get visible() { return !!active?.cat.visible; } };
  if (force) window.__erwina = { api, active: () => active, probe, key, mem, look: o.look, camera, render };   // testing only (?erwina=)
  return api;
}
