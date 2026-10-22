// The write-out cache (vision-2026-10-23.md, Caching; PM 5, 23 Oct 2026): an Inn write-out (or re-write) asked for with the same
// options as an earlier one is served from KV (WRITEOUT_CACHE) instead of a new Claude call. The key is a hash of everything that
// shapes the recipe: the idea's own words (so a content edit misses), the room, measurements, servings, diet, kitchen, country words,
// pantry, the Mix, Sweet Spells' answers, the check-in's effort and time, a re-write's recipe and swap, the model and PROMPT_VERSION.
// Left out on purpose, as seasoning that would make every key unique: the weather, the visit's theme, the card's "why", and the
// time of day outside Sweet Spells (whose room rule uses it). A visitor whose weather differs may read a tip written for another day.
// Only validated recipes are kept, for 30 days. Unit tests: test/writeout-cache.test.mjs.
//
// Also the groundwork for server-side daily caps (the golden book): a per-day count of write-outs per visitor pass, keyed by an
// HMAC of the pass's sid (never the sid itself), kept 3 days. Logged only, not enforced.

/** Bump on any change to the Inn's prompt (INN_CONSTITUTION, buildUserMessage's inn-idea lines, inn-extras.js) or the model */
export const PROMPT_VERSION = 'inn-2026-10-23';
export const CACHE_TTL = 30 * 24 * 3600;
export const COUNT_TTL = 3 * 24 * 3600;

const s = (v, n = 400) => String(v ?? '').trim().slice(0, n);
const low = (v, n) => s(v, n).toLowerCase();
const arr = v => (Array.isArray(v) ? v : []);
const sorted = (v, f = low) => [...new Set(arr(v).map(x => f(x, 80)).filter(Boolean))].sort();
const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);

/** JSON with object keys sorted at every level, so the same options always make the same string */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** Everything about a write-out that shapes its text, normalised (order and case of sets don't matter) */
export function keyParts(payload = {}, { model = '' } = {}) {
  const p = payload, idea = p.idea || {}, mix = p.mix || {}, rw = p.rewrite || null;
  return {
    v: PROMPT_VERSION, model, tome: s(p.tome_id, 40), room: s(p.room, 40),
    idea: { name: s(idea.name, 100), kind: s(idea.kind, 40), hook: s(idea.hook, 160), key: arr(idea.key_ingredients).map(x => low(x, 60)),
            method: s(idea.method_short, 400), time: s(idea.time, 40) },
    units: s(p.units, 10), locale: s(p.locale, 20), country: s(p.country, 40), servings: num(p.servings),
    diet: sorted(p.dietary_restrictions), avoid: low(p.dietary_other, 60),
    appliances: p.no_cooking === true ? ['none'] : sorted(p.appliances),
    pantry: sorted(p.pantry_ingredients), use_up: !!p.use_up, cuisines: sorted(p.cuisines),
    energy: s(p.energy, 40), confidence: s(p.confidence, 20), time_available: num(p.time_available),
    time_of_day: p.room === 'sweet-spells' ? s(p.time_of_day, 40) : '',
    dish: Object.fromEntries(Object.entries(p.dish && typeof p.dish === 'object' ? p.dish : {}).slice(0, 4).map(([k, v]) => [s(k, 20), s(v, 40)])),
    mix: { mood: s(mix.mood, 40), inside: s(mix.inside, 120), base: s(mix.base, 40), flavour: s(mix.flavour, 40), topping: s(mix.topping, 40), seed: s(mix.seed, 40),
           addins: sorted(mix.addins), top: sorted(mix.top), thirsty: sorted(mix.thirsty) },
    sweetness: s(p.sweetness, 40), sweeteners: sorted(p.sweeteners), occasion: s(p.occasion, 40),
    // A re-write: the recipe it starts from and the one change (a swap from the substitutions table, or other measurements)
    rewrite: rw ? { recipe: stable(rw.recipe || {}), swap: rw.swap ? { from: low(rw.swap.from, 60), to: low(rw.swap.to, 60) } : null } : null,
  };
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** The KV key for a write-out: wo:<hash> */
export async function cacheKey(payload, opts) {
  return `wo:${await sha256(stable(keyParts(payload, opts)))}`;
}

/** Only a whole recipe is worth keeping: a name, at least two ingredients with names, at least one step */
export function validRecipe(r) {
  return !!r && typeof r === 'object' && typeof r.name === 'string' && r.name.trim().length > 0
    && Array.isArray(r.ingredients) && r.ingredients.filter(i => i && String(i.item || '').trim()).length >= 2
    && Array.isArray(r.steps) && r.steps.some(x => String(typeof x === 'string' ? x : x?.text || '').trim());
}

/** The day's count key for a visitor pass: n:YYYY-MM-DD:<first 24 hex of HMAC(secret, sid)>; null without a pass */
export async function countKey(sid, secret, now = new Date()) {
  if (!sid || !secret) return null;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(`count:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(String(sid))));
  return `n:${now.toISOString().slice(0, 10)}:${[...sig].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Add one write-out (hit or not) to the visitor's day; returns the new { n, hits }. KV is eventually consistent: a guide, not a lock */
export async function countWriteout(kv, key, hit) {
  if (!kv || !key) return null;
  const was = (await kv.get(key, 'json')) || { n: 0, hits: 0 };
  const now = { n: (was.n || 0) + 1, hits: (was.hits || 0) + (hit ? 1 : 0) };
  await kv.put(key, JSON.stringify(now), { expirationTtl: COUNT_TTL });
  return now;
}
