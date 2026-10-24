// The food map's rules (explore/food-map-rules.js) and its data (explore/food-map.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tidy, isEmpty, cuisineSets, shopFrom, migrate } from '../blender/explore/food-map-rules.js';

const DATA = JSON.parse(readFileSync(new URL('../blender/explore/food-map.json', import.meta.url), 'utf8'));
const C = DATA.countries;
const LINES = JSON.parse(readFileSync(new URL('../blender/explore/gemma-lines.json', import.meta.url), 'utf8'));

test('tidy: known ids only, in the map order; anything else is empty', () => {
  assert.deepEqual(tidy({ home: ['nz', 'zz'], loved: ['jp', 'it'] }, C), { home: ['nz'], heritage: [], loved: ['it', 'jp'] });
  assert.ok(isEmpty(tidy(null, C)));
});

test('familiar is home, then family, then loved; near is their neighbours, minus familiar', () => {
  const s = cuisineSets(tidy({ home: ['nz'], heritage: ['it'], loved: ['jp'] }, C), C);
  assert.deepEqual(s.familiar, ['Kiwi classics', 'Italian', 'Japanese']);
  assert.deepEqual(s.heritage, ['Italian']);
  assert.ok(s.near.includes('Greek') && s.near.includes('Korean') && s.near.includes('Pacific Islands'));
  assert.ok(!s.near.some(c => s.familiar.includes(c)));
});

test('shopping words: the first home pin that is a shopping country; family never sets it', () => {
  assert.equal(shopFrom(tidy({ home: ['it', 'au'] }, C), C), 'AU');
  assert.equal(shopFrom(tidy({ heritage: ['gb'] }, C), C), null);
});

test("the old Map's cuisines become loved countries", () => {
  assert.deepEqual(migrate(['Italian', 'Thai', 'Nope'], C), { home: [], heritage: [], loved: ['it', 'th'] });
  assert.deepEqual(migrate(null, C), { home: [], heritage: [], loved: [] });
});

test('content: every country is drawn and linked both ways to known neighbours; cuisines are the Inn\'s', () => {
  const ids = new Set(C.map(c => c.id));
  const known = new Set([...LINES.tell.cuisines, 'American']);
  for (const c of C) {
    assert.ok(Array.isArray(c.at) && c.at.length === 2, `${c.id} has a place on the map`);
    for (const n of c.neighbours) assert.ok(ids.has(n), `${c.id}: neighbour ${n} is on the map`);
    for (const k of c.cuisines) assert.ok(known.has(k), `${c.id}: ${k} is a cuisine cards use`);
  }
});
