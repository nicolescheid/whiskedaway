/**
 * The trail navigator: reads what a visitor has touched, lingered on, opened and set aside
 * in this visit, and decides what the room reveals, what Gemma says, and what content is served.
 *
 * Pure functions, no DOM. localNavigate() is the deterministic engine; aiNavigate() asks the
 * Worker's /navigate route and falls back to localNavigate() on any failure.
 *
 * Trail event shapes:
 *   { kind: 'touch',   id }          clicked an object
 *   { kind: 'linger',  id }          held the view on an object
 *   { kind: 'map',     id }          jumped to an object from the fixed map
 *   { kind: 'open',    atom }        opened a served piece
 *   { kind: 'dismiss', atom }        set a served piece aside ("not this")
 *   { kind: 'choose',  cluster }     picked one side of a fork
 *   { kind: 'weather', id }          turned the barometer (id = a key of world.weathers)
 *   { kind: 'time',    id }          pushed the clock to a time of day (id = a key of world.times)
 *   { kind: 'clock',   id }          the device's own time of day, observed rather than chosen
 */

const WEIGHTS = { touch: 3, linger: 1.5, map: 1, open: 2.5, dismiss: -2, choose: 4 };
const DECAY = 0.85;           // older events count for less, so a wander can change direction
const SERVE_MIN = 1.2;        // below this an atom isn't relevant enough to serve
const REVEAL_MIN = 1.2;
const FORK_BELOW = 0.2;       // confidence below which Gemma offers a fork instead of a guess
const WEATHER_WEIGHT = 3;     // the chosen weather is a standing mood: it holds until changed, it doesn't fade
const TIME_WEIGHT = { time: 2.5, clock: 1.2 };   // a chosen time counts more than the device's clock

export function themeWeights(trail, world) {
  const w = {};
  // Each event spreads the same total weight over its themes, so theme-rich objects don't dominate
  const add = (themes, amount) => themes.forEach(t => { w[t] = (w[t] || 0) + amount / Math.sqrt(themes.length); });
  const atoms = Object.fromEntries(world.atoms.map(a => [a.id, a]));
  trail.forEach((e, i) => {
    const amount = (WEIGHTS[e.kind] || 0) * DECAY ** (trail.length - 1 - i);
    if (e.id && world.objects[e.id]) add(world.objects[e.id].themes, amount);
    if (e.atom && atoms[e.atom]) add(atoms[e.atom].themes, amount);
    if (e.cluster && world.clusters[e.cluster]) add(world.clusters[e.cluster].themes, amount);
  });
  const weather = currentWeather(trail, world);
  if (weather) add(world.weathers[weather].themes, WEATHER_WEIGHT);
  const time = currentTime(trail, world);
  if (time) add(world.times[time.id].themes, TIME_WEIGHT[time.kind]);
  return w;
}

/** The weather the visitor last chose on the barometer, if any. */
export function currentWeather(trail, world) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i].kind === 'weather' && world.weathers && world.weathers[trail[i].id]) return trail[i].id;
  }
  return null;
}

/** The time of day in play: the last one the visitor chose, else the device's own. */
export function currentTime(trail, world) {
  for (let i = trail.length - 1; i >= 0; i--) {
    const e = trail[i];
    if ((e.kind === 'time' || e.kind === 'clock') && world.times && world.times[e.id]) return { id: e.id, kind: e.kind };
  }
  return null;
}

function clusterScores(weights, world) {
  return Object.entries(world.clusters)
    .map(([id, c]) => ({ id, label: c.label, score: c.themes.reduce((s, t) => s + Math.max(0, weights[t] || 0), 0) }))
    .sort((a, b) => b.score - a.score);
}

const score = (themes, weights) => themes.reduce((s, t) => s + (weights[t] || 0), 0);

/** The objects in the trail whose themes overlap these themes, as readable reasons. */
function reasonsFor(themes, trail, world) {
  const seen = new Set();
  const why = [];
  let context = null;                 // something observed rather than done, e.g. the device's time
  const weather = currentWeather(trail, world);
  if (weather && world.weathers[weather].themes.some(t => themes.includes(t))) {
    why.push(`turned the barometer to ${world.weathers[weather].label}`);
  }
  const time = currentTime(trail, world);
  if (time && world.times[time.id].themes.some(t => themes.includes(t))) {
    const label = world.times[time.id].label.toLowerCase();
    if (time.kind === 'time') why.push(`turned the clock to ${label}`);
    else context = `it's ${label === 'late night' ? 'late at night' : label} where you are`;
  }
  for (let i = trail.length - 1; i >= 0 && why.length < 3; i--) {
    const e = trail[i];
    const obj = e.id && world.objects[e.id];
    if (!obj || seen.has(e.id) || !obj.themes.some(t => themes.includes(t))) continue;
    seen.add(e.id);
    why.push(`${e.kind === 'linger' ? 'lingered by' : 'went to'} ${obj.ref}`);
  }
  return { why, context };
}

const listJoin = parts => parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;

export function localNavigate(trail, world, { served = [], dismissed = [] } = {}) {
  const meaningful = trail.filter(e => e.kind !== 'map' || trail.length < 3);
  if (meaningful.length === 0) {
    return { mode: 'local', hypothesis: null, confidence: 0, gemma: null, fork: [], reveal: [], serve: [] };
  }
  const weights = themeWeights(trail, world);
  const clusters = clusterScores(weights, world);
  const top = clusters[0];
  // Confidence is how clearly the leading reading beats the runner-up
  const confidence = top.score ? Math.round(((top.score - clusters[1].score) / top.score) * 100) / 100 : 0;

  const touched = new Set(trail.filter(e => e.id).map(e => e.id));
  const reveal = Object.entries(world.objects)
    .filter(([id, o]) => !touched.has(id) && o.type !== 'door' && o.type !== 'submit' && o.themes.length)
    .map(([id, o]) => ({ id, s: score(o.themes, weights) }))
    .filter(r => r.s >= REVEAL_MIN)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map(r => ({ object: r.id, reason: `fits ${top.label}` }));

  const lowSpoons = (weights['low-spoons'] || 0) + (weights.rest || 0) + (weights['no-cook'] || 0);
  const skip = new Set([...served, ...dismissed, ...trail.filter(e => e.kind === 'dismiss').map(e => e.atom)]);
  const serve = world.atoms
    .filter(a => !skip.has(a.id))
    .map(a => ({ a, s: score(a.themes, weights) - (lowSpoons > 3 ? a.spoons * 1.5 : 0) }))
    .filter(x => x.s >= SERVE_MIN)
    .sort((x, y) => y.s - x.s)
    .slice(0, 2)
    .map(({ a }) => {
      const { why, context } = reasonsFor(a.themes, trail, world);
      const text = why.length ? `Because you ${listJoin(why)}${context ? `, and ${context}` : ''}.`
        : context ? `Because ${context}.` : `Because it fits ${top.label}.`;
      return { atom: a.id, why: text };
    });

  const recent = [...new Set(trail.filter(e => e.id && world.objects[e.id]).map(e => e.id))]
    .slice(-3).map(id => world.objects[id].ref);
  const lead = recent.length ? `${recent.join(', ').replace(/^./, c => c.toUpperCase())}… ` : '';

  let gemma, fork = [];
  if (confidence < FORK_BELOW && clusters[1].score > 0 && meaningful.length >= 2) {
    fork = [top.id, clusters[1].id];
    gemma = `${lead}I can't quite tell yet. Are you after ${top.label}, or ${clusters[1].label}?`;
  } else {
    const putOut = ["I've put something on the counter for you.", "There's something on the counter for you.",
      "Have a look on the counter.", "I've left something out for you."][trail.length % 4];
    gemma = `${lead}I think you're after ${top.label}. ${putOut}`;
  }

  return { mode: 'local', hypothesis: top.label, cluster: top.id, confidence, gemma, fork, reveal, serve };
}

/** Ask the Worker. Anything off-list or malformed is dropped; any failure falls back to local. */
export async function aiNavigate(endpoint, trail, world, state, { timeoutMs = 20000 } = {}) {
  const local = localNavigate(trail, world, state);
  if (!trail.length) return local;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const payload = {
        room: world.name,
        trail: trail.slice(-30),
        objects: Object.entries(world.objects).map(([id, o]) => ({ id, label: o.label, type: o.type, themes: o.themes }))
          .concat(Object.entries(world.weathers || {}).map(([id, w]) => ({ id, label: `Weather: ${w.label}`, type: 'weather', themes: w.themes })))
          .concat(Object.entries(world.times || {}).map(([id, t]) => ({ id, label: `Time of day: ${t.label}`, type: 'time', themes: t.themes }))),
        atoms: world.atoms.map(({ id, title, kind, themes, spoons }) => ({ id, title, kind, themes, spoons })),
        clusters: Object.entries(world.clusters).map(([id, c]) => ({ id, label: c.label })),
        already_served: state.served || [],
        dismissed: state.dismissed || [],
    };
    // endpoint is either a function (e.g. genieFetch with a visitor pass) or a plain URL
    const res = typeof endpoint === 'function'
      ? await endpoint(payload, { signal: ctrl.signal })
      : await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`navigate ${res.status}`);
    const r = await res.json();
    const objects = new Set(Object.keys(world.objects));
    const atoms = new Set(world.atoms.map(a => a.id));
    const clusters = new Set(Object.keys(world.clusters));
    return {
      mode: 'ai',
      hypothesis: String(r.hypothesis || local.hypothesis),
      cluster: clusters.has(r.cluster) ? r.cluster : local.cluster,
      confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
      gemma: String(r.gemma_line || local.gemma),
      fork: (r.fork || []).filter(c => clusters.has(c)).slice(0, 2),
      reveal: (r.reveal || []).filter(x => objects.has(x.object_id)).slice(0, 2).map(x => ({ object: x.object_id, reason: x.reason })),
      serve: (r.serve || []).filter(x => atoms.has(x.atom_id) && !(state.dismissed || []).includes(x.atom_id)).slice(0, 2).map(x => ({ atom: x.atom_id, why: x.why })),
    };
  } catch (err) {
    return { ...local, mode: 'local', fallback: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}
