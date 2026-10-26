// SEC-015: body-size caps and free-text trims in the genie Worker (worker/limits.js, and the routes in worker/whiskedaway-worker.js).
// The ones that matter most: the biggest payload a real guest can send is never limited, and an oversize body gets a 413 before any
// Claude call or Google forward.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_CAPS, capFor, readCapped, cleanWritePayload, cleanNavigatePayload, str, strList } from '../worker/limits.js';
import worker from '../worker/whiskedaway-worker.js';

const post = (path, body, headers = {}) => new Request(`https://genie.test${path}`, { method: 'POST', body, headers: { Origin: 'https://whiskedaway.com', ...headers } });
const bytes = o => Buffer.byteLength(typeof o === 'string' ? o : JSON.stringify(o));

// ---------- the biggest realistic payloads (the same as measured for the caps: every Tell Gemma field at its page maximum)
const fullest = {
  tome_id: 'inn-idea', locale: 'en-NZ', room: 'chiapothecary', units: 'both',
  idea: { name: 'n'.repeat(100), kind: 'k'.repeat(40), hook: 'h'.repeat(160), key_ingredients: Array(8).fill('i'.repeat(30)), method_short: 'm'.repeat(605), time: '35 min', why: 'w'.repeat(160) },
  mix: { mood: 'a'.repeat(40), inside: 'b'.repeat(120), base: 'c'.repeat(40), flavour: 'd'.repeat(40), topping: 'e'.repeat(40), addins: Array(12).fill('Chopped toasted hazelnuts'), top: Array(12).fill('Berries'), thirsty: Array(12).fill('Oat bran') },
  energy: 'Half full', weather: 'Rain', time_of_day: 'Late night', theme: ['warm', 'soft'], cuisines: ['Italian', 'Thai', 'Indian', 'Mexican'],
  pantry_ingredients: Array(12).fill('p'.repeat(60)), use_up: true,
  dietary_restrictions: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-fodmap', 'halal', 'kosher', 'hindu-no-beef', 'keto', 'low-carb'],
  dietary_other: 'z'.repeat(60), country: 'New Zealand', dish: { a: 'x'.repeat(20), b: 'y'.repeat(40), c: 'z', d: 'q' },
  sweetness: 'A bit less sugar', sweeteners: Array(6).fill('Maple syrup'), occasion: 'A birthday', servings: 8, confidence: 'happy', time_available: 60,
  appliances: Array(8).fill('Air fryer'), feels_skip: Array(13).fill('coriander'), feels_more: Array(13).fill('spicy heat'), keeping_off: Array(8).fill('grapefruit'),
};
const recipe = {
  name: 'n'.repeat(100), serves: 4, time: '35 min',
  ingredients: Array(12).fill({ item: 'i'.repeat(80), amount: '1 1/2', unit: 'tbsp', key: 'k'.repeat(40) }),
  steps: Array(10).fill({ text: 's'.repeat(200), minutes: 25, uses: ['a', 'b', 'c'] }), tip: 't'.repeat(240),
};
const navigate = (n = 1) => ({
  room: 'The Cuddlecore',
  trail: Array.from({ length: 30 }, (_, i) => ({ kind: 'touch', id: `object-${i}`, atom: `atom-${i}`, cluster: 'warm-comfort' })),
  objects: Array.from({ length: 40 * n }, (_, i) => ({ id: `object-${i}`, label: 'An object label here', type: 'tool', themes: ['warm', 'slow', 'soft', 'cosy', 'home', 'kind', 'quiet', 'easy'] })),
  atoms: Array.from({ length: 40 * n }, (_, i) => ({ id: `atom-${i}`, title: 'A recipe idea title that is long', kind: 'recipe', themes: Array(12).fill('warm-comfort'), spoons: 1, room: 'cuddlecore', time: 15, wait: 'overnight in the fridge' })),
  visitor: { time_available: '15 minutes', confidence: 'happy' },
  clusters: Array.from({ length: 24 }, (_, i) => ({ id: `cluster-${i}`, label: 'A cluster label', room: 'cuddlecore' })),
  already_served: Array.from({ length: 60 }, (_, i) => `atom-${i}`), dismissed: Array.from({ length: 60 }, (_, i) => `atom-${60 + i}`),
});

test('the caps leave room: the fullest real payloads are well under their route\'s cap', () => {
  assert.ok(bytes(fullest) * 4 < BODY_CAPS['/recipe'], `recipe ${bytes(fullest)}`);
  assert.ok(bytes({ ...fullest, rewrite: { recipe, swap: { from: 'a'.repeat(60), to: 'b'.repeat(60) } } }) * 4 < BODY_CAPS['/rewrite']);
  assert.ok(bytes(navigate()) * 2 < BODY_CAPS['/navigate'], `navigate ${bytes(navigate())}`);
  assert.ok(bytes({ token: 't'.repeat(2048) }) * 1.5 < BODY_CAPS['/session']);
  const batch = { pass: 'p'.repeat(200), visit: '0'.repeat(36), session: 1, surface: 'explore', device: 'mobile', debug: false, src: { bucket: 'google' },
    events: Array(25).fill({ name: 'tell_set', params: { kind: 'x'.repeat(39), count: '3', use_up: 'y', a: 'x'.repeat(39), b: 'x'.repeat(39), c: 'x'.repeat(39) }, ms: 60000 }) };
  assert.ok(bytes(batch) * 2 < BODY_CAPS['/m'], `analytics ${bytes(batch)}`);
  assert.equal(capFor('/something-else'), BODY_CAPS['/recipe']);
});

test('a normal write-out payload comes out of the trim unchanged', () => {
  assert.deepEqual(cleanWritePayload(fullest), fullest);
  assert.deepEqual(cleanWritePayload({ ...fullest, rewrite: { recipe, swap: null } }), { ...fullest, rewrite: { recipe, swap: null } });
});

test('a normal navigator payload comes out of the trim unchanged', () => {
  const p = navigate();
  assert.deepEqual(cleanNavigatePayload(p), p);
});

test('free text is cut quietly, lists are capped, and odd shapes do not throw', () => {
  const c = cleanWritePayload({ dietary_other: 'x'.repeat(5000), pantry_ingredients: Array(500).fill('y'.repeat(900)), dietary_restrictions: 'vegan', allergies: [{ a: 1 }, 'nuts'],
    symptoms_text: 'z'.repeat(9999), servings: '9'.repeat(500), energy_level: { evil: 1 }, craving_text: 'c'.repeat(3000) });
  assert.equal(c.dietary_other.length, 60);
  assert.equal(c.pantry_ingredients.length, 12);
  assert.equal(c.pantry_ingredients[0].length, 60);
  assert.deepEqual(c.dietary_restrictions, []);
  assert.deepEqual(c.allergies, ['nuts']);
  assert.equal(c.symptoms_text.length, 1000);
  assert.equal(c.craving_text.length, 1000);
  assert.equal(c.servings.length, 20);
  assert.equal(c.energy_level, undefined);
  assert.deepEqual(cleanWritePayload(null), {});
  assert.deepEqual(cleanWritePayload([1, 2]), {});
  assert.equal(str(null, 5), null);
  assert.deepEqual(strList('nope', 3, 3), []);
});

test('the navigator trim caps every list and string and drops fields the prompt does not use', () => {
  const big = navigate(5);
  big.room = 'r'.repeat(5000);
  big.objects[0].label = 'L'.repeat(5000);
  big.objects[0].secret = 'x'.repeat(5000);
  big.already_served = Array(1000).fill('s'.repeat(500));
  big.trail = Array.from({ length: 400 }, (_, i) => ({ kind: 'touch', id: 'i'.repeat(900), atom: null, cluster: 'c', extra: i }));
  const c = cleanNavigatePayload(big);
  assert.equal(c.room.length, 60);
  assert.equal(c.objects[0].label.length, 160);
  assert.ok(!('secret' in c.objects[0]));
  assert.equal(c.objects.length, 40);
  assert.equal(c.already_served.length, 60);
  assert.equal(c.already_served[0].length, 80);
  assert.equal(c.trail.length, 30);
  assert.equal(c.trail[0].id.length, 80);
  assert.ok(bytes(c) < BODY_CAPS['/navigate']);
  assert.deepEqual(cleanNavigatePayload('junk'), { room: undefined, objects: [], atoms: [], clusters: [], trail: [], already_served: [], dismissed: [], visitor: {} });
});

test('readCapped counts the bytes actually read, whatever Content-Length says', async () => {
  assert.deepEqual(await readCapped(post('/recipe', 'a'.repeat(100)), 100), { text: 'a'.repeat(100) });
  assert.deepEqual(await readCapped(post('/recipe', 'a'.repeat(101)), 100), { tooLarge: true });
  // a body with no Content-Length (streamed) that runs past the cap
  const stream = new ReadableStream({ pull(ctl) { ctl.enqueue(new Uint8Array(40)); } });
  const r = new Request('https://genie.test/recipe', { method: 'POST', body: stream, duplex: 'half' });
  assert.deepEqual(await readCapped(r, 100), { tooLarge: true });
  // a lying Content-Length is judged by the header alone
  const lie = { headers: new Headers({ 'Content-Length': '999999' }), body: { cancel: async () => {} } };
  assert.deepEqual(await readCapped(lie, 100), { tooLarge: true });
  assert.deepEqual(await readCapped(new Request('https://genie.test/recipe', { method: 'POST' }), 100), { text: '' });
});

// ---------- the real routes, with Claude and Google answered by a stand-in
const env = { ALLOWED_ORIGINS: 'https://whiskedaway.com', ANTHROPIC_API_KEY: 'k', GA_API_SECRET: 'g', GA_MEASUREMENT_ID: 'G-1', TURNSTILE_SECRET_KEY: 't', PASS_SECRET: 'p' };   // BOT_GUARD unset: logs, lets through
const run = async (request, calls) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body });
    if (String(url).includes('anthropic')) return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ name: 'Toast', serves: 2, time: '5 min', ingredients: [], steps: [] }) }], usage: {} }));
    return new Response('{}');
  };
  try {
    const waits = [];
    const res = await worker.fetch(request, env, { waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    return res;
  } finally { globalThis.fetch = real; }
};

for (const [path, cap] of [['/recipe', BODY_CAPS['/recipe']], ['/rewrite', BODY_CAPS['/rewrite']], ['/navigate', BODY_CAPS['/navigate']], ['/m', BODY_CAPS['/m']], ['/session', BODY_CAPS['/session']]]) {
  test(`${path}: a body over ${cap} bytes gets a 413 and nothing else happens`, async () => {
    const calls = [];
    const res = await run(post(path, JSON.stringify({ pad: 'x'.repeat(cap + 1) })), calls);
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: 'too_large' });
    assert.deepEqual(calls, [], 'no Claude call, no Google forward, no Turnstile call');
  });
}

test('/recipe: the fullest real payload goes through, and the prompt is cut to size', async () => {
  const calls = [];
  const res2 = await run(post('/recipe', JSON.stringify({ ...fullest, dietary_other: 'q'.repeat(5000), pantry_ingredients: Array(30).fill('p'.repeat(500)) })), calls);
  assert.equal(res2.status, 200);
  const sent = JSON.parse(calls.find(c => c.url.includes('anthropic')).body).messages[0].content;
  assert.ok(!sent.includes('q'.repeat(61)), 'the "rather avoid" text is cut to 60');
  assert.ok(!sent.includes('p'.repeat(61)), 'pantry items are cut to 60');
  assert.ok(sent.length < 12000, `prompt ${sent.length}`);
});

test('/rewrite: the fullest re-write goes through', async () => {
  const calls = [];
  const res = await run(post('/rewrite', JSON.stringify({ ...fullest, rewrite: { recipe, swap: { from: 'butter', to: 'olive oil' } } })), calls);
  assert.equal(res.status, 200);
  assert.ok(calls.some(c => c.url.includes('anthropic')));
});

test('/m: a full batch is still counted; a Content-Length over the cap is refused before reading', async () => {
  const calls = [];
  const batch = { pass: 'x', visit: '0'.repeat(36), session: 1, surface: 'explore', device: 'mobile', events: [] };
  const res = await run(post('/m', JSON.stringify(batch), { 'Content-Type': 'text/plain' }), calls);
  assert.equal(res.status, 204);
  const calls2 = [];
  const big = await run(post('/m', 'x', { 'Content-Length': String(BODY_CAPS['/m'] + 1) }), calls2);
  assert.equal(big.status, 413);
  assert.deepEqual(calls2, []);
});
