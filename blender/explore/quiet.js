// Quiet objects and answered classes (Nicole, 28 Oct 2026: too many dots, nobody knows where to click next).
//   - An ambient object that only speaks (touch.js handler 59 or 60) has no dot and no name. Its hit area stays. Resting a mouse
//     on it for 500 ms gives Gemma's line as a tap would (inn.touch(id, 'hover')); on a touch screen, a view that has rested
//     still for 2 s with one near the centre does (inn.touch(id, 'gaze')). Each object once per page visit, and never
//     closer than 5 s to the last, so a wander is a few quiet remarks and not a storm. Taps work as before. Nothing is
//     noticed over the tour, a sit-down chat, an open layer, a drag or a hidden tab.
//   - A dot that sets something (Your kitchen, the candle, the patience string, Dietary needs, the food map, the tray, cage
//     and bell jar) glows until that is set, then dims. It stays tappable. "Set" is read from the visit store, so it survives
//     a reload. The tour and sit-down chat glow whatever they point at (.tour-glow, tour.css), quiet or not.
import { visit } from './visit-state.js';
import { layers } from './layers.js';

const HOVER_MS = 500, REST_MS = 2000, GAP_MS = 5000, GAZE_DEG = 12;

// The class of a dot: which saved answer settles it. null = no class (always plain)
const has = v => (Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v);
const SETTLED = {
  kitchen: () => has(visit.get('kitchen')),
  energy: () => has(visit.get('energy')),
  patience: () => has(visit.get('time')),
  dietary: () => has(visit.get('dietary')) || has(visit.get('dietaryOther')),
  foodmap: () => has(visit.get('foodMap')),
  tray: () => has(visit.get('feels')),
  cage: () => Object.values(visit.get('feels') || {}).includes('skip'),
  belljar: () => has(visit.get('keepingOff')),
};
const TOOL_CLASS = { 'setting-lamp': 'energy', 'setting-suncatcher': 'energy', 'setting-yarn': 'patience', 'setting-twine': 'patience',
  'setting-ribbon': 'patience', dietary: 'dietary', locale: 'foodmap', feels: 'tray', cage: 'cage', 'bell-jar': 'belljar' };
export const classOf = (obj, id) => (obj.type === 'kitchen' || id === 'fl-range' ? 'kitchen' : obj.type === 'energy' ? 'energy' : TOOL_CLASS[obj.tool] || null);

export function install(inn) {
  const done = new Set();                       // objects already noticed this visit
  let lastAt = 0;

  // ---- dimming
  function dim() {
    for (const h of inn.hotspots) {
      const c = classOf(inn.world.objects[h.id] || {}, h.id);
      h.el.classList.toggle('asks', !!c && !SETTLED[c]());
      h.el.classList.toggle('answered', !!c && SETTLED[c]());
    }
  }
  const buildHotspots = inn.buildHotspots;
  inn.buildHotspots = (...a) => { buildHotspots(...a); dim(); };
  visit.subscribe(dim);

  // ---- noticing
  const calm = () => !document.hidden && !inn.drag && !inn.touring && !inn.chatting && !inn.casting && !layers.any && inn.$('front-door').hidden;
  function notice(id, how) {
    if (done.has(id) || Date.now() - lastAt < GAP_MS || !calm()) return false;
    done.add(id); lastAt = Date.now();
    inn.touch(id, how);
    return true;
  }
  inn.quiet = { notice, dim, noticed: () => [...done] };

  let timer = null, over = null;
  const quietSpot = e => (e.target.closest?.('.spot.quiet') || null);
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = quietSpot(e);
    if (!el || el === over) return;
    clearTimeout(timer); over = el;
    const tryIt = ms => { timer = setTimeout(() => {
      if (over !== el || done.has(el.dataset.spot)) return;
      const wait = GAP_MS - (Date.now() - lastAt);
      if (wait > 0) tryIt(wait + 50);                                 // too soon after the last remark: ask again when it is not
      else notice(el.dataset.spot, 'hover');
    }, ms); };
    tryIt(HOVER_MS);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse' || !quietSpot(e) || e.relatedTarget?.closest?.('.spot.quiet') === over) return;
    clearTimeout(timer); over = null;
  });

  // Touch screens have no hover: a rest on a quiet object counts
  const coarse = matchMedia('(hover: none), (pointer: coarse)');
  setInterval(() => {
    if (!coarse.matches || !inn.hasLooked || performance.now() - inn.lastMove < REST_MS) return;
    const centre = inn.dir(inn.look.yaw, inn.look.pitch);
    let best = null, bestAng = GAZE_DEG;
    for (const h of inn.hotspots) {
      if (!h.quiet || done.has(h.id) || h.el.style.display === 'none') continue;
      const ang = centre.angleTo(h.v.clone().normalize()) * 180 / Math.PI;
      if (ang < bestAng) { best = h; bestAng = ang; }
    }
    if (best) notice(best.id, 'gaze');
  }, 400);
}
