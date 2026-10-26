// Size limits for the genie Worker (SEC-015, 26 Oct 2026): a cap on every request body, and a trim on every visitor-typed field before
// it reaches a prompt, the write-out cache key or Google. Kept out of the main file so it can be unit-tested (test/limits.test.mjs).
//
// Body caps, in bytes. The biggest real payload the site sends today (measured 26 Oct from the world data and the client's own limits)
// is in the right-hand column; every cap leaves several times that:
//   /session   4 KB    the Turnstile token is at most 2048 characters; the body is {"token": "..."}            (about 2.1 KB worst)
//   /m        32 KB    one analytics batch is at most 25 events of allow-listed 39-character values + the pass (about 11 KB worst, 1.5 KB typical)
//   /recipe   32 KB    the fullest Chiapothecary write-out with every Tell Gemma field at its maximum        (about 4.5 KB worst)
//   /rewrite  64 KB    that plus the whole recipe being re-written and one swap                              (about 9.6 KB worst)
//   /navigate 64 KB    40 objects, 40 atoms, 24 clusters, a 30-step trail and 120 served/set-aside ids        (about 24 KB worst)
// Nothing below changes what a normal visit sends: every text trim is at or above the length the page itself allows, so a normal
// payload comes out identical (the prompts and the write-out cache keys are untouched, PROMPT_VERSION stays).

export const BODY_CAPS = { '/session': 4096, '/m': 32768, '/recipe': 32768, '/rewrite': 65536, '/navigate': 65536 };
/** Any other POST path is answered by the recipe route, so it gets the recipe cap */
export const capFor = path => BODY_CAPS[path] ?? BODY_CAPS['/recipe'];

/** The Content-Length header says it is over the cap (cheap, before reading anything) */
export const declaredTooLarge = (request, cap) => {
  const n = Number(request.headers.get('Content-Length'));
  return Number.isFinite(n) && n > cap;
};

/**
 * The request body as text, read in pieces and counted, so a missing or false Content-Length cannot get past the cap.
 * Returns { text } or { tooLarge: true }; a body that cannot be read comes back as an empty text.
 */
export async function readCapped(request, cap) {
  if (declaredTooLarge(request, cap)) { request.body?.cancel().catch(() => {}); return { tooLarge: true }; }
  if (!request.body) return { text: '' };
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) { reader.cancel().catch(() => {}); return { tooLarge: true }; }
      chunks.push(value);
    }
  } catch { return { text: '' }; }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return { text: new TextDecoder().decode(all) };
}

// ---------- text trims. Quiet: nothing here ever throws or tells the guest

/** A string cut to n characters (anything that is not a string or a number becomes ''); undefined/null stay as they are */
export const str = (v, n) => (v == null ? v : typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, n) : '');
/** A list of short strings: at most `max` items, each cut to n characters, empty ones dropped */
export const strList = (v, max, n) => (Array.isArray(v) ? v : []).slice(0, max)
  .map(x => (typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, n) : '')).filter(Boolean);
const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' && typeof v !== 'boolean' ? Number(v) : undefined);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// [field, max characters]. Short answers and ids first, then the free-text boxes of the older kitchens' forms.
const WRITE_STRINGS = [
  ['tome_id', 40], ['room', 40], ['locale', 20], ['units', 10], ['country', 40], ['energy', 40], ['weather', 40], ['time_of_day', 40],
  ['confidence', 20], ['sweetness', 40], ['occasion', 40], ['dietary_other', 60], ['sourcing_preference', 80],
  ['temperature_preference', 60], ['texture_preference', 60], ['chaos_dial', 40], ['craving', 120], ['goal', 120], ['meal_type', 60],
  ['effort_level', 20], ['desired_superpower', 120], ['vibe', 120], ['texture_goal', 60], ['base_preference', 60], ['topic', 120],
  ['symptoms_text', 1000], ['freeform_symptoms', 1000], ['craving_text', 1000], ['question', 1000],
];
// [field, max items, max characters per item]
const WRITE_LISTS = [
  ['dietary_restrictions', 16, 40], ['allergies', 16, 60], ['pantry_ingredients', 12, 60], ['cuisines', 8, 40], ['theme', 4, 40],
  ['sweeteners', 8, 40], ['appliances', 8, 30], ['feels_skip', 13, 40], ['feels_more', 13, 40], ['keeping_off', 8, 40],
  ['health_leanings', 16, 40], ['symptom_tags', 20, 40], ['symptoms', 20, 40], ['craving_tags', 12, 40], ['context', 12, 40],
];
const WRITE_NUMBERS = ['servings', 'energy_level', 'texture_level', 'sweetness_level', 'time_available'];

/**
 * A /recipe or /rewrite payload with every visitor-typed field cut to size. Fields it does not know pass through untouched (nothing
 * unknown reaches a prompt; the nested idea, mix, dish and rewrite are trimmed where the prompt is built, and the body cap bounds them).
 */
export function cleanWritePayload(payload) {
  const p = isObj(payload) ? { ...payload } : {};
  for (const [k, n] of WRITE_STRINGS) if (k in p) p[k] = str(p[k], n);
  for (const [k, max, n] of WRITE_LISTS) if (k in p) p[k] = strList(p[k], max, n);
  for (const k of WRITE_NUMBERS) if (k in p) p[k] = typeof p[k] === 'string' ? str(p[k], 20) : num(p[k]);
  return p;
}

/** A /navigate payload: lists capped in count, every string cut to size, only the fields the prompt uses */
export function cleanNavigatePayload(p) {
  p = isObj(p) ? p : {};
  const id = v => str(v, 80), label = v => str(v, 160);
  const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n).filter(isObj);
  const pick = (o, spec) => { const out = {}; for (const [k, f] of spec) if (o[k] !== undefined) { const v = f(o[k]); if (v !== undefined) out[k] = v; } return out; };
  const themes = v => strList(v, 12, 40), small = v => (typeof v === 'number' ? v : str(v, 40));
  return {
    room: str(p.room, 60),
    objects: arr(p.objects, 40).map(o => pick(o, [['id', id], ['label', label], ['type', v => str(v, 20)], ['themes', themes], ['spoon_bias', num]])),
    atoms: arr(p.atoms, 60).map(a => pick(a, [['id', id], ['title', label], ['kind', v => str(v, 20)], ['themes', themes], ['spoons', num],
      ['room', v => str(v, 40)], ['time', small], ['wait', small]])),
    clusters: arr(p.clusters, 24).map(c => pick(c, [['id', id], ['label', label], ['room', v => str(v, 40)]])),
    trail: (Array.isArray(p.trail) ? p.trail : []).slice(-30).filter(isObj)
      .map(e => ({ kind: str(e.kind, 20), id: id(e.id), atom: id(e.atom), cluster: id(e.cluster) })),
    already_served: strList(p.already_served, 60, 80),
    dismissed: strList(p.dismissed, 60, 80),
    visitor: isObj(p.visitor) ? p.visitor : {},
  };
}
