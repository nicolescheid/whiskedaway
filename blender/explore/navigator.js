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
 *   { kind: 'energy',  id }          picked one of the energy candles (id = a key of world.energies)
 *   { kind: 'season',  id }          turned the Conservatory's seasons wheel (id = a key of world.seasons)
 *   { kind: 'keep',    atom }        kept an idea in the recipe book (weighed through `book` below, not the trail)
 *
 * The recipe book and what the visitor told Gemma also steer serving (recipe-book-ux.md §6b), through localNavigate's options:
 *   book:  { now: [snapshot], before: [snapshot] }   this visit's keeps (×3 on their themes) and older ones (×1)
 *   about: { pantry: [...], useUp, cuisines: [...], synonyms }   a bonus per key ingredient they have (+2 each, max +4; doubled
 *                                                                with "use these up first"), and for a chosen cuisine (+2)
 *          timeLimit, confidence                      the check-in's "how long have you got" (minutes, or none for no rush) and
 *                                                     cooking confidence ('starting' | 'happy' | 'confident'): see TIME_OVER, CONFIDENCE
 * Dietary needs are a hard filter: the page leaves clashing atoms out (they arrive as served).
 */

const WEIGHTS = { touch: 3, linger: 1.5, map: 1, open: 2.5, dismiss: -2, choose: 4 };
const DECAY = 0.85;           // older events count for less, so a wander can change direction
const SERVE_MIN = 1.2;        // below this an atom isn't relevant enough to serve
const REVEAL_MIN = 1.2;
const FORK_BELOW = 0.2;       // confidence below which Gemma offers a fork instead of a guess
const WEATHER_WEIGHT = 3;     // the chosen weather is a standing mood: it holds until changed, it doesn't fade
const TIME_WEIGHT = { time: 2.5, clock: 1.2 };   // a chosen time counts more than the device's clock
const ENERGY_WEIGHT = 3;      // the candle the visitor picked: a standing signal like the weather
const SEASON_WEIGHT = 2.5;
const OWN_SEASON_WEIGHT = 1.2;  // the visitor's own season, not chosen: counted lightly (`own-season` in the trail)    // the season the visitor turned the wheel to (their own season isn't a choice, so it isn't counted)
const ROOM_LEAN = 4;          // an atom from the room the visitor is in (if it fits at all): mostly that room's own, the odd one from elsewhere
const AI_HOME = 30, AI_AWAY = 10;
const KEEP_NOW = 3, KEEP_BEFORE = 1, KEEP_BEFORE_MAX = 10;   // keeps weigh more than touches and don't fade; older ones only nudge
const PANTRY_EACH = 2, PANTRY_MAX = 4, CUISINE = 2;
// How long they've got is soft, never a filter: an idea whose active `time` runs over loses up to 6 (3 per 100% over), so a
// visitor with 15 minutes still gets ideas, just the quick ones first. `wait` is hands-off and doesn't count (an overnight chia is quick)
const TIME_OVER = 3, TIME_OVER_MAX = 6;
// Cooking confidence nudges by effort, like an energy's spoon_bias (added per spoon): starting out leans gentle, confident hands-on
const CONFIDENCE = { starting: -1.5, happy: 0, confident: 0.5 };
export const timePenalty = (a, limit) => (limit && a.time > limit ? Math.min(TIME_OVER_MAX, TIME_OVER * (a.time - limit) / limit) : 0);   // the AI's shortlist: the room's own atoms, then the best of the rest by local score
// Each energy level also has a spoon_bias: added per spoon to an atom's score, so a burnt-out candle
// (-3) all but rules out two-spoon pieces and a full one (+1) leans toward the hands-on ones.

export function themeWeights(trail, world, book = null) {
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
  const energy = currentEnergy(trail, world);
  if (energy) add(world.energies[energy].themes, ENERGY_WEIGHT);
  const season = currentSeason(trail, world);
  if (season) add(world.seasons[season].themes, SEASON_WEIGHT);
  else {
    const own = trail.find(e => e.kind === 'own-season' && world.seasons?.[e.id]);
    if (own) add(world.seasons[own.id].themes, OWN_SEASON_WEIGHT);
  }
  for (const k of book?.now || []) add(k.themes || [], KEEP_NOW);
  for (const k of (book?.before || []).slice(0, KEEP_BEFORE_MAX)) add(k.themes || [], KEEP_BEFORE);
  return w;
}

/** The kept recipe that most explains this atom (shared themes, this visit's first), for "Because you kept the …" */
function keptReason(atom, book) {
  let best = null;
  for (const [list, bonus] of [[book?.now || [], 0.5], [(book?.before || []).slice(0, KEEP_BEFORE_MAX), 0]]) {
    for (const k of list) {
      const shared = (k.themes || []).filter(t => atom.themes.includes(t)).length + bonus;
      if (shared >= 2 && (!best || shared > best.shared)) best = { k, shared };
    }
  }
  if (!best) return null;
  const t = best.k.title.replace(/,.*$/, '');                    // "One square of dark chocolate, slowly" → "one square of dark chocolate"
  return `kept ${best.k.ref || `the ${t.charAt(0).toLowerCase()}${t.slice(1)}`}`;
}
/** What the visitor has in the cupboard that this atom uses ("spinach" matches "baby spinach"; synonyms: courgette = zucchini …) */
const singular = w => w.replace(/ies$/, 'y').replace(/(oes|ches|shes|xes)$/, m => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const pantryHits = (atom, pantry = [], synonyms = {}) => pantry.filter(p => {
  const w0 = singular(String(p).toLowerCase());
  const words = [w0, ...(synonyms[w0] || synonyms[String(p).toLowerCase()] || []).map(singular)];
  return (atom.key_ingredients || []).some(i => words.some(w => i.toLowerCase().includes(w)));
});
/** A chosen cuisine on the atom (its `cuisines`, from the content editor, or a theme of the same name) */
const cuisineHit = (atom, cuisines = []) => cuisines.some(c => [...(atom.cuisines || []), ...atom.themes].some(t => t.toLowerCase() === String(c).toLowerCase()));

/** The season the visitor last turned the seasons wheel to, if any. */
export function currentSeason(trail, world) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i].kind === 'season' && world.seasons && world.seasons[trail[i].id]) return trail[i].id;
  }
  return null;
}

/** The energy candle the visitor last picked, if any. */
export function currentEnergy(trail, world) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i].kind === 'energy' && world.energies && world.energies[trail[i].id]) return trail[i].id;
  }
  return null;
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
function reasonsFor(themes, trail, world, spoons = null, first = []) {
  const seen = new Set();
  const why = [...first];                  // about-you facts and keeps come before the trail (§6b)
  let context = null;                 // something observed rather than done, e.g. the device's time
  const energy = currentEnergy(trail, world);
  if (energy) {
    const e = world.energies[energy];
    // The candle is a reason when its themes match, or when it's why the effort fits
    const fitsEffort = spoons !== null && ((e.spoon_bias < 0 && spoons === 0) || (e.spoon_bias > 0 && spoons >= 2));
    if (fitsEffort || e.themes.some(t => themes.includes(t))) why.push(`picked the ${e.candle}`);
  }
  const weather = currentWeather(trail, world);
  if (weather && world.weathers[weather].themes.some(t => themes.includes(t))) {
    why.push(`turned the barometer to ${world.weathers[weather].label}`);
  }
  const season = currentSeason(trail, world);
  if (season && world.seasons[season].themes.some(t => themes.includes(t))) {
    why.push(`turned the seasons wheel to ${world.seasons[season].label.toLowerCase()}`);
  }
  const time = currentTime(trail, world);
  if (time && world.times[time.id].themes.some(t => themes.includes(t))) {
    const label = world.times[time.id].label.toLowerCase();
    if (time.kind === 'time') why.push(`turned the clock to ${label}`);
    else context = `it's ${label === 'late night' ? 'late at night' : label} where you are`;
  }
  for (let i = trail.length - 1; i >= 0 && why.length < 2; i--) {
    const e = trail[i];
    const obj = e.id && world.objects[e.id];
    if (!obj || seen.has(e.id) || !obj.themes.some(t => themes.includes(t))) continue;
    if (first.some(f => f.endsWith(obj.ref.replace(/^the /, '')))) continue;   // not "kept the truffles and went to the truffles"
    seen.add(e.id);
    why.push(`${e.kind === 'linger' ? 'lingered by' : 'went to'} ${obj.ref}`);
  }
  return { why, context };
}

export const listJoin = parts => parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
/** Reasons with the same verb share it: ["went to the window seat", "went to the music box"] → ["went to the window seat", "the music box"] */
const shareVerbs = parts => parts.map((p, i) => {
  const verb = ['went to ', 'lingered by ', 'turned the '].find(v => p.startsWith(v));
  return i && verb && parts[i - 1].startsWith(verb) ? p.slice(verb.length).replace(/^/, verb === 'turned the ' ? 'the ' : '') : p;
});

/** The clusters Gemma may name in this room: its own, or every one where a room has none (the hallway, the glasshouse) */
export function roomClusters(world, room) {
  const own = Object.entries(world.clusters).filter(([, c]) => room && c.room === room);
  return Object.fromEntries(own.length ? own : Object.entries(world.clusters));
}

export function localNavigate(trail, world, { served = [], dismissed = [], room = null, book = null, about = {}, awayOk = true } = {}) {
  const meaningful = trail.filter(e => e.kind !== 'map' || trail.length < 3);
  if (meaningful.length === 0) {
    return { mode: 'local', hypothesis: null, confidence: 0, gemma: null, fork: [], reveal: [], serve: [] };
  }
  const weights = themeWeights(trail, world, book);
  const clusters = clusterScores(weights, { ...world, clusters: roomClusters(world, room) });
  const top = clusters[0];
  const second = clusters[1] || { score: 0 };   // a room can have a single reading (Flourish: build-up), so there may be no runner-up
  // Confidence is how clearly the leading reading beats the runner-up
  const confidence = top.score ? Math.round(((top.score - second.score) / top.score) * 100) / 100 : 0;

  const touched = new Set(trail.filter(e => e.id).map(e => e.id));
  const reveal = Object.entries(world.objects)
    .filter(([id, o]) => !touched.has(id) && o.type !== 'door' && o.type !== 'submit' && o.themes.length)
    .map(([id, o]) => ({ id, s: score(o.themes, weights) }))
    .filter(r => r.s >= REVEAL_MIN)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map(r => ({ object: r.id, reason: `fits ${top.label}` }));

  const lowSpoons = (weights['low-spoons'] || 0) + (weights.rest || 0) + (weights['no-cook'] || 0);
  const energy = currentEnergy(trail, world);
  const spoonBias = energy ? world.energies[energy].spoon_bias || 0 : 0;
  const skip = new Set([...served, ...dismissed, ...trail.filter(e => e.kind === 'dismiss').map(e => e.atom)]);
  const serve = world.atoms
    .filter(a => !skip.has(a.id))
    .filter(a => awayOk || !room || a.room === room || !world.atoms.some(x => x.room === room))   // an away idea only while none is out
    .map(a => ({ a, s: score(a.themes, weights) - (lowSpoons > 3 ? a.spoons * 1.5 : 0) + spoonBias * a.spoons
                       + Math.min(PANTRY_MAX * (about.useUp ? 2 : 1), pantryHits(a, about.pantry, about.synonyms).length * PANTRY_EACH * (about.useUp ? 2 : 1))
                       + (cuisineHit(a, about.cuisines) ? CUISINE : 0)
                       - timePenalty(a, about.timeLimit) + (CONFIDENCE[about.confidence] || 0) * a.spoons }))
    .map(x => (room && x.a.room === room && x.s > 0 ? { ...x, s: x.s + ROOM_LEAN } : x))   // a.room: from the room's *-world.json
    .filter(x => x.s >= SERVE_MIN)
    .sort((x, y) => y.s - x.s)
    .slice(0, 2)
    .map(({ a }) => {
      // The strongest reason first: what they told Gemma, then a keep, then the trail; never more than two (§6b)
      const hits = pantryHits(a, about.pantry, about.synonyms);
      const kept = keptReason(a, book);
      const cuisine = !hits.length && !kept && (about.cuisines || []).find(c => cuisineHit(a, [c]));
      const W = about.why || {};                                   // gemma-lines.json tell.why: "you've got {a} to use", "you chose {a} on the map"
      const fillWhy = (t, a) => t.replace(/^you've/, "'ve").replace(/^you\s+/, '').replace(/\{[apc]\}/, a);   // "Because you" comes first
      // A short time is a reason when the idea fits inside it ("Because you've got about 15 minutes")
      const quick = !hits.length && !kept && !cuisine && about.timeLimit && about.timeLimit <= 30 && a.time <= about.timeLimit && about.timeWords;
      const first = [...(hits.length ? [fillWhy(W.pantry || "you've got {p} to use", listJoin(hits.slice(0, 2)))] : []), ...(kept ? [kept] : []),
                     ...(cuisine ? [fillWhy(W.cuisine || 'you chose {c} on the map', about.cuisineLabel?.(cuisine) || cuisine)] : []),
                     ...(quick ? [fillWhy(W.time || "you've got {t}", about.timeWords).replace('{t}', about.timeWords)] : [])];
      const { why, context } = reasonsFor(a.themes, trail, world, a.spoons, first.slice(0, 2));
      const parts = shareVerbs(why.slice(0, 2));
      const text = (parts.length ? `Because you ${listJoin(parts)}${context && parts.length < 2 ? `, and ${context}` : ''}.`
        : context ? `Because ${context}.` : `Because it fits ${top.label}.`).replace("Because you 've", "Because you've");
      return { atom: a.id, why: text, fromKeep: !!kept && why.slice(0, 2).includes(kept) };
    });

  // No lead naming the last thing touched ("The clock… I think…"): it read oddly for tools, and the idea's own "Because you…" line
  // already says what she noticed. One short line also keeps her clear of the room in phone landscape (QA pass 3)
  let gemma, fork = [];
  if (confidence < FORK_BELOW && second.score > 0 && meaningful.length >= 2) {
    fork = [top.id, second.id];
    gemma = `I can't quite tell yet. Are you after ${top.label}, or ${second.label}?`;   // no lead: a question stays under 100 characters
  } else {
    gemma = `I think you're after ${top.label}.`;   // no "I found you something": the rising idea says that (Ideas, v4)
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
    const trailIds = new Set(trail.map(e => e.id).filter(Boolean));
    const here = new Set(state.here || []);
    const things = Object.entries(world.objects)
      .filter(([id, o]) => o.type !== 'energy' && (o.themes.length || trailIds.has(id)))
      .map(([id, o]) => ({ id, label: o.label, type: o.type, themes: o.themes }));
    // The Worker reads at most 40 objects. Send what the visitor has touched first, then the standing signals
    // (weathers, times, energies, seasons), then the rest of the room they're in, then anything else with themes.
    const rank = o => trailIds.has(o.id) ? 0 : here.has(o.id) ? 2 : 3;
    const signals = Object.entries(world.weathers || {}).map(([id, w]) => ({ id, label: `Weather: ${w.label}`, type: 'weather', themes: w.themes }))
      .concat(Object.entries(world.times || {}).map(([id, t]) => ({ id, label: `Time of day: ${t.label}`, type: 'time', themes: t.themes })))
      .concat(Object.entries(world.energies || {}).map(([id, e]) => ({ id, label: `Energy: ${e.label} (the ${e.candle})`, type: 'energy', themes: e.themes, spoon_bias: e.spoon_bias })))
      .concat(Object.entries(world.seasons || {}).map(([id, s]) => ({ id, label: `Season: ${s.label}`, type: 'season', themes: s.themes })));
    // The shortlist: the room's own atoms first, then the best of the rest (the hallway and glasshouse have none of
    // their own, so they get the best of everything). Nothing already served or set aside.
    const weights = themeWeights(trail, world, state.book), skip = new Set([...(state.served || []), ...(state.dismissed || [])]);
    const ranked = world.atoms.filter(a => !skip.has(a.id)).sort((a, b) => score(b.themes, weights) - score(a.themes, weights));
    const home = ranked.filter(a => state.room && a.room === state.room).slice(0, AI_HOME);
    const shortlist = home.concat(ranked.filter(a => !home.includes(a)).slice(0, home.length ? AI_AWAY : AI_HOME + AI_AWAY));
    const payload = {
        room: state.roomName || world.name,
        trail: trail.slice(-30),
        objects: [...things.filter(o => rank(o) === 0), ...signals, ...things.filter(o => rank(o) > 0).sort((a, b) => rank(a) - rank(b))].slice(0, 40),
        atoms: (shortlist.length ? shortlist : world.atoms).map(({ id, title, kind, themes, spoons, room, time, wait }) => ({ id, title, kind, themes, spoons, room, time, wait })),
        // What they told the check-in, when they did: how long they've got (active minutes) and how at home they are cooking
        visitor: { time_available: state.about?.timeLimit ? `${state.about.timeLimit} minutes` : null, confidence: state.about?.confidence || null },
        // the room's own readings first, so a cap at the Worker never drops them
        clusters: Object.entries(roomClusters(world, state.room)).map(([id, c]) => ({ id, label: c.label, room: c.room })),
        already_served: state.served || [],
        dismissed: state.dismissed || [],
    };
    // endpoint is either a function (e.g. genieFetch with a visitor pass) or a plain URL.
    // The race caps the whole step, including getting a visitor pass, so a stalled check falls back to local.
    const call = typeof endpoint === 'function'
      ? endpoint(payload, { signal: ctrl.signal })
      : fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal, body: JSON.stringify(payload) });
    const res = await Promise.race([call, new Promise((_, reject) => ctrl.signal.addEventListener('abort', () => reject(new Error('timeout'))))]);
    if (!res.ok) throw new Error(`navigate ${res.status}`);
    const r = await res.json();
    const objects = new Set(Object.keys(world.objects));
    const atoms = new Set(payload.atoms.map(a => a.id));
    const clusters = new Set(Object.keys(roomClusters(world, state.room)));
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
