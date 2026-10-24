// Dawn and dusk renders (blender/explore/pano-times.js): the list of what exists, and the fallback that never asks for what doesn't
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { EXISTS, sfx, panoExists, candidates, usable } from '../blender/explore/pano-times.js';

const OUT = new URL('../blender/out/', import.meta.url);
const files = readdirSync(OUT);
const WEATHERS = ['rain', 'fair', 'change', 'stormy', 'very-dry'];

test('names: night keeps its suffix, dawn and dusk take theirs', () => {
  assert.equal(sfx(true), '_night'); assert.equal(sfx('night'), '_night');
  assert.equal(sfx('dawn'), '_dawn'); assert.equal(sfx('dusk'), '_dusk'); assert.equal(sfx(false), '');
});

test('the list matches blender/out both ways, previews included (node scripts/pano-times-list.mjs rewrites it)', () => {
  const real = files.filter(f => /_(dawn|dusk)\.jpg$/.test(f)).map(f => f.replace(/\.jpg$/, ''));
  assert.deepEqual([...EXISTS].sort(), real.sort());
  for (const n of EXISTS) assert.ok(files.includes(`${n}_preview.jpg`), `${n} has no _preview`);
});

test('what exists: only the listed names, in any size', () => {
  for (const n of EXISTS) for (const end of ['.jpg', '_preview.jpg', '_4k.jpg']) assert.equal(panoExists(`out/${n}${end}`), true);
  assert.equal(panoExists('out/cuddlecore_pano_rain_dusk.jpg'), false);
  assert.equal(panoExists('out/hallway_pano_middle_stormy_dawn_preview.jpg'), false);
  assert.equal(panoExists('out/cuddlecore_pano_rain_night.jpg'), true);   // night and day aren't this list's business
});

test('fallback: with the real list, never a name that is not on it, and the day render is the last resort', () => {
  const rooms = [(w, t, f) => `out/cuddlecore_pano_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`, (w, t, f) => `out/hallway_pano_entrance_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
    (w, t, f) => `out/glasshouse_pano_spring_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`, (w, t, f) => `out/garden_pano_patio_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`];
  for (const pano of rooms) for (const time of ['dawn', 'dusk']) for (const w of WEATHERS) {
    const list = usable({ pano }, w, time);
    for (const [cw, t] of list) assert.ok(panoExists(pano(cw, t, false)));
    assert.deepEqual(list.at(-1), [w, null]);
  }
});

test('fallback order: own, fair, then day (dawn) or night then day (dusk)', () => {
  const R = { pano: (w, t) => `out/x_pano_${w}${sfx(t)}.jpg` };
  const has = ok => u => ok.includes(u);
  assert.deepEqual(usable(R, 'change', 'dawn', has(['out/x_pano_fair_dawn.jpg'])), [['fair', 'dawn'], ['change', null]]);
  assert.deepEqual(usable(R, 'change', 'dawn', has(['out/x_pano_change_dawn.jpg', 'out/x_pano_fair_dawn.jpg'])), [['change', 'dawn'], ['fair', 'dawn'], ['change', null]]);
  assert.deepEqual(usable(R, 'rain', 'dawn', has(['out/x_pano_fair_dawn.jpg'])), [['rain', null]]);
  assert.deepEqual(usable(R, 'rain', 'dusk', has(['out/x_pano_fair_dusk.jpg'])), [['rain', 'night'], ['rain', null]]);
  assert.deepEqual(usable(R, 'very-dry', 'dusk', has(['out/x_pano_fair_dusk.jpg'])), [['fair', 'dusk'], ['very-dry', 'night'], ['very-dry', null]]);
  assert.deepEqual(candidates('rain', 'midday'), [['rain', null]]);
  assert.deepEqual(candidates('rain', 'night'), [['rain', 'night'], ['rain', null]]);
});
