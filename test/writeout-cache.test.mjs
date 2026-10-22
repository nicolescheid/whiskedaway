// The write-out cache's keys (worker/writeout-cache.js): different options, different keys; the same options in any order, one key
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, keyParts, stable, validRecipe, countKey, countWriteout, PROMPT_VERSION } from '../worker/writeout-cache.js';

const base = {
  tome_id: 'inn-idea', room: 'flourish', locale: 'en-NZ', units: 'metric', country: 'New Zealand', servings: 2,
  idea: { name: 'Corn fritters', kind: 'recipe idea', hook: 'Crisp, sweet fritters.', key_ingredients: ['corn', 'egg', 'flour'], method_short: 'Mix and fry.', time: '20 min', why: 'Because you lingered by the eggs.' },
  dietary_restrictions: [], dietary_other: '', cuisines: [], pantry_ingredients: [], use_up: false, dish: {},
  weather: 'Rain', time_of_day: 'Evening', theme: ['quick', 'cosy'],
};
const key = (p, o) => cacheKey(p, o);
const differs = async (change, why) => assert.notEqual(await key({ ...base, ...change }), await key(base), why);

test('the same options make the same key, whatever the order of sets or the case', async () => {
  const a = await key({ ...base, dietary_restrictions: ['vegan', 'nut-free'], appliances: ['oven', 'air fryer'], pantry_ingredients: ['Eggs', 'spinach'] });
  const b = await key({ ...base, dietary_restrictions: ['nut-free', 'vegan'], appliances: ['air fryer', 'oven'], pantry_ingredients: ['spinach', 'eggs'] });
  assert.equal(a, b);
  assert.match(a, /^wo:[0-9a-f]{64}$/);
});

test('every option that shapes the recipe changes the key', async () => {
  await differs({ units: 'cups' }, 'measurements');
  await differs({ servings: 4 }, 'servings');
  await differs({ dietary_restrictions: ['vegan'] }, 'diet');
  await differs({ dietary_other: 'coriander' }, 'something else to avoid');
  await differs({ appliances: ['air fryer'] }, 'appliances');
  await differs({ no_cooking: true }, 'no cooking');
  await differs({ country: 'United States' }, 'country words');
  await differs({ locale: 'en-US' }, 'locale');
  await differs({ pantry_ingredients: ['spinach'] }, 'pantry');
  await differs({ use_up: true, pantry_ingredients: [] }, 'use up');
  await differs({ cuisines: ['thai'] }, 'cuisines');
  await differs({ energy: 'Low' }, 'energy');
  await differs({ confidence: 'starting' }, 'confidence');
  await differs({ time_available: 15 }, 'time available');
  await differs({ room: 'cuddlecore' }, 'room');
  await differs({ idea: { ...base.idea, method_short: 'Mix, then fry in batches.' } }, 'a content edit to the idea');
  await differs({ idea: { ...base.idea, name: 'Kūmara fritters' } }, 'another idea');
  await differs({ mix: { base: 'Milk', addins: ['Berries'] } }, 'the Mix');
  await differs({ sweetness: 'No added sugar' }, 'sweetness');
  await differs({ sweeteners: ['Honey'] }, 'sweeteners');
  await differs({ dish: { occasion: 'birthday' } }, 'dish answers');
  assert.notEqual(await key(base, { model: 'claude-sonnet-5' }), await key(base, { model: 'claude-opus-5-5' }), 'model');
  assert.equal(keyParts(base).v, PROMPT_VERSION, 'the prompt version is in the key');
});

test('a re-write is keyed by its recipe and its swap; a write-out never shares a re-write key', async () => {
  const recipe = { name: 'Corn fritters', ingredients: [{ item: 'corn' }], steps: [{ text: 'Fry.' }] };
  const swap = (from, to) => ({ ...base, rewrite: { recipe, swap: { from, to } } });
  assert.notEqual(await key(swap('egg', 'flax egg')), await key(swap('egg', 'aquafaba')));
  assert.notEqual(await key(swap('egg', 'flax egg')), await key(base));
  assert.notEqual(await key({ ...base, units: 'cups', rewrite: { recipe, swap: null } }), await key({ ...base, units: 'cups' }));
  assert.equal(await key(swap('Egg', 'Flax egg')), await key(swap('egg', 'flax egg')), 'case does not matter');
});

test('seasoning stays out of the key: weather, theme, the card\'s why, time of day outside Sweet Spells', async () => {
  assert.equal(await key({ ...base, weather: 'Sun', theme: ['bright'], time_of_day: 'Morning', idea: { ...base.idea, why: 'Something else' } }), await key(base));
  const sweet = { ...base, room: 'sweet-spells' };
  assert.notEqual(await key({ ...sweet, time_of_day: 'Morning' }), await key(sweet), 'Sweet Spells suits the sweet to the time of day');
});

test('stable JSON sorts keys at every level', () => {
  assert.equal(stable({ b: 1, a: { d: [2, 1], c: null } }), stable({ a: { c: null, d: [2, 1] }, b: 1 }));
});

test('only whole recipes are kept', () => {
  const ok = { name: 'Fritters', ingredients: [{ item: 'corn' }, { item: 'egg' }], steps: [{ text: 'Fry.' }] };
  assert.ok(validRecipe(ok));
  assert.ok(!validRecipe({ ...ok, name: '' }));
  assert.ok(!validRecipe({ ...ok, ingredients: [{ item: 'corn' }] }));
  assert.ok(!validRecipe({ ...ok, steps: [] }));
  assert.ok(!validRecipe({ error: 'nope' }));
});

test('the day count: keyed by a hash of the pass, never the raw id; adds up hits', async () => {
  const k = await countKey('sid-123', 'secret', new Date('2026-10-23T05:00:00Z'));
  assert.match(k, /^n:2026-10-23:[0-9a-f]{24}$/);
  assert.ok(!k.includes('sid-123'));
  assert.notEqual(k, await countKey('sid-124', 'secret', new Date('2026-10-23T05:00:00Z')));
  assert.equal(await countKey(null, 'secret'), null);
  const store = new Map();
  const kv = { get: async (x) => (store.has(x) ? JSON.parse(store.get(x)) : null), put: async (x, v) => { store.set(x, v); } };
  await countWriteout(kv, k, false);
  assert.deepEqual(await countWriteout(kv, k, true), { n: 2, hits: 1 });
});
