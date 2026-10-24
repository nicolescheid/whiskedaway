// How you like it: the tray's filter, the bell jar's, and what the Worker is told (explore/feels.js, worker/inn-extras.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEELS, JAR, names, feelsOf, feelClash, jarClash, feelsSplit, feelsPayload } from '../blender/explore/feels.js';
import { feelsLine } from '../worker/inn-extras.js';
import { keyParts } from '../worker/writeout-cache.js';

const atom = (key_ingredients, more = {}) => ({ id: 'x', room: 'cuddlecore', key_ingredients, ...more });

test('ingredient words: whole words and plurals only', () => {
  assert.ok(names('nuts', 'Toasted walnuts'));
  assert.ok(names('nuts', 'pine nuts'));
  assert.ok(!names('nuts', 'coconut milk'), 'coconut is not a nut here');
  assert.ok(!names('nuts', 'nutmeg'));
  assert.ok(names('seeds', 'chia seeds'));
  assert.ok(names('spicy', 'red chillies'));
  assert.ok(!names('alcohol', 'portobello mushrooms'));
  assert.ok(names('grapefruit', 'pink grapefruit'));
});

test('a card: its tags win; untagged, its key ingredients', () => {
  assert.deepEqual(feelsOf(atom(['coriander', 'lime', 'peanuts'])), ['coriander', 'nuts']);
  assert.deepEqual(feelsOf(atom(['coriander'], { feels: ['crunchy'] })), ['crunchy'], 'tagged: only the tags');
  assert.equal(feelClash(atom(['chia seeds', 'milk']), ['seeds']), 'seeds');
  assert.equal(feelClash(atom(['chia seeds']), []), null, 'nothing skipped, nothing clashes');
  assert.equal(feelClash(atom(['rice'], { feels: ['slippery'] }), ['crunchy', 'slippery']), 'slippery');
});

test('the bell jar reads key ingredients', () => {
  assert.equal(jarClash(atom(['spaghetti', 'parmesan']), ['aged-cheese']), 'aged-cheese');
  assert.equal(jarClash(atom(['spinach', 'egg']), ['grapefruit']), null);
  assert.equal(jarClash(atom(['spinach']), []), null);
});

test('the store and the payload: words, never ids, in the tray order', () => {
  const v = { nuts: 'skip', spicy: 'skip', crunchy: 'more' };
  assert.deepEqual(feelsSplit(v), { skip: ['spicy', 'nuts'], more: ['crunchy'] });
  assert.deepEqual(feelsSplit(null), { skip: [], more: [] });
  assert.deepEqual(feelsPayload(v, ['grapefruit']), { feels_skip: ['spicy heat', 'nuts'], feels_more: ['very crunchy'], keeping_off: ['grapefruit'] });
  assert.deepEqual(feelsPayload(null), {}, 'nothing told: nothing sent');
});

test('Worker: the line says what to leave out and lean into, never why', () => {
  assert.equal(feelsLine({}), '', 'no preference: the prompt is as it was');
  const l = feelsLine({ feels_skip: ['coriander'], feels_more: ['spicy heat'], keeping_off: ['grapefruit'] });
  assert.match(l, /skip: coriander/);
  assert.match(l, /more of: spicy heat/);
  assert.match(l, /out entirely.*grapefruit/);
  assert.match(l, /never mention medicines/i);
  assert.ok(feelsLine({ feels_skip: ['x'.repeat(200)] }).length < 400, 'each word is cut short');
});

test('the write-out cache key follows the tray', () => {
  const base = { tome_id: 'inn-idea', room: 'cuddlecore', idea: { name: 'Congee' } };
  const a = keyParts({ ...base, feels_skip: ['nuts', 'coriander'] }), b = keyParts({ ...base, feels_skip: ['coriander', 'nuts'] });
  assert.deepEqual(a, b, 'order does not matter');
  assert.notDeepEqual(keyParts(base), a, 'a skip changes the key');
  assert.notDeepEqual(keyParts(base), keyParts({ ...base, keeping_off: ['grapefruit'] }), 'the bell jar changes the key');
});

test('content: every feel and jar food has a label and words for her lines', () => {
  for (const f of FEELS) assert.ok(f.label && f.skip && f.more && f.icon, f.id);
  for (const j of JAR) assert.ok(j.label && j.short && j.words?.length, j.id);
});
