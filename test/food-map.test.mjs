// The food map's rules (explore/food-map-rules.js) and its data (explore/food-map.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tidy, isEmpty, cuisineSets, shopFrom, migrate, hasRecipes } from '../blender/explore/food-map-rules.js';

const DATA = JSON.parse(readFileSync(new URL('../blender/explore/food-map.json', import.meta.url), 'utf8'));
const C = DATA.countries;
const WORLD = JSON.parse(readFileSync(new URL('../blender/explore/world-map.json', import.meta.url), 'utf8'));
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

test('content: every country is drawn (a shape or a dot) and linked to known neighbours; cuisines are ones cards use', () => {
  const ids = new Set(C.map(c => c.id));
  const known = new Set([...LINES.tell.cuisines, 'American']);
  assert.equal(ids.size, C.length, 'ids are unique');
  for (const c of C) {
    assert.ok(WORLD.shapes[c.id] || WORLD.dots[c.id], `${c.id} is on the map`);
    assert.ok(WORLD.centres[c.id] || WORLD.dots[c.id], `${c.id} has a place for its stamp`);
    assert.ok(c.region && c.sub, `${c.id} has a region`);
    for (const n of c.neighbours) assert.ok(ids.has(n), `${c.id}: neighbour ${n} is on the map`);
    for (const k of c.cuisines) assert.ok(known.has(k), `${c.id}: ${k} is a cuisine cards use`);
  }
  for (const id of [...Object.keys(WORLD.shapes), ...Object.keys(WORLD.dots)]) assert.ok(ids.has(id), `${id} is drawn but not listed`);
});

test("saved pins from the first food map still load (the original 24 ids, with their cuisines)", () => {
  const ORIGINAL = { ca: 'Canadian', us: 'American', mx: 'Mexican', ie: 'Irish', gb: 'British', fr: 'French', es: 'Spanish', it: 'Italian', gr: 'Greek', tr: 'Middle Eastern', lb: 'Middle Eastern',
    ir: 'Middle Eastern', in: 'Indian', cn: 'Chinese', kr: 'Korean', jp: 'Japanese', vn: 'Vietnamese', th: 'Thai', id: 'Indonesian', au: 'Australian', nz: 'Kiwi classics', fj: 'Pacific Islands',
    to: 'Pacific Islands', ws: 'Pacific Islands' };
  for (const [id, cuisine] of Object.entries(ORIGINAL)) assert.deepEqual(C.find(c => c.id === id)?.cuisines, [cuisine], id);
  const saved = { home: ['nz'], heritage: ['it', 'ws'], loved: ['jp', 'kr'] };
  assert.deepEqual(tidy(saved, C), saved);
});

test('every country is listed, so a country with no recipes still takes a pin', () => {
  assert.ok(C.length >= 190);
  for (const id of ['de', 'dk', 'za', 'br', 'sg', 'mt', 'xk', 'ps', 'tw']) assert.ok(C.some(c => c.id === id), id);
  assert.deepEqual(tidy({ home: ['de'], loved: ['sg'] }, C), { home: ['de'], heritage: [], loved: ['sg'] });
});

test('no recipes yet: nothing familiar, and the dial leans on neighbours, then the same part of the world, then the region', () => {
  const de = cuisineSets(tidy({ home: ['de'] }, C), C);
  assert.deepEqual(de.familiar, []);
  assert.ok(de.near.includes('French'), 'Germany borders France');
  const ph = cuisineSets(tidy({ home: ['ph'] }, C), C);       // an island: no land neighbours, so its sub-region (South-eastern Asia)
  assert.deepEqual(ph.familiar, []);
  assert.ok(ph.near.includes('Thai') && ph.near.includes('Vietnamese'));
  const cu = cuisineSets(tidy({ loved: ['cu'] }, C), C);       // Cuba: Caribbean has no dishes, so the Americas
  assert.ok(cu.near.includes('Mexican'));
  const za = cuisineSets(tidy({ home: ['za'] }, C), C);        // somewhere with nothing nearby: still no crash, and no invented familiar food
  assert.deepEqual(za.familiar, []);
  assert.ok(!hasRecipes(C.find(c => c.id === 'de')) && hasRecipes(C.find(c => c.id === 'it')));
});

test('a country that has recipes keeps the old near set (no region spill-over)', () => {
  const nz = cuisineSets(tidy({ home: ['nz'] }, C), C);
  assert.deepEqual(nz.familiar, ['Kiwi classics']);
  assert.deepEqual(nz.near.sort(), ['Australian', 'Pacific Islands']);
});

test("Gemma's food-map lines are short and make no health claims", () => {
  const F = LINES.foodMap;
  assert.ok(F.noRecipes && F.noRecipes.length <= 100, 'the no-recipes line is under 100 characters');
  for (const [k, v] of Object.entries(F)) if (typeof v === 'string' && !k.startsWith('_')) assert.ok(v.length <= 100, `foodMap.${k}`);
  assert.ok(!/health|healthy|cure|heal|nutrition|diet/i.test(Object.values(F).join(' ')));
});

test('the drawn world stays small (loaded only when the map opens)', () => {
  const raw = readFileSync(new URL('../blender/explore/world-map.json', import.meta.url));
  assert.ok(gzipSync(raw).length < 150 * 1024, 'under 150 KB gzipped');
});
