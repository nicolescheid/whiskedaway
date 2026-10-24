// Dawn and dusk renders (blender/explore/pano-times.js): what exists, and the fallback that never asks for what doesn't
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sfx, panoExists, candidates, usable } from '../blender/explore/pano-times.js';

const WEATHERS = ['rain', 'fair', 'change', 'stormy', 'very-dry'];
const NAMES = {
  cuddlecore: (w, t, f) => `out/cuddlecore_pano_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  flourish: (w, t, f) => `out/flourish_pano_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  sweet: (w, t, f) => `out/sweet_spells_pano_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  chia: (w, t, f) => `out/chiapothecary_pano_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  hall: (w, t, f) => `out/hallway_pano_entrance_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  glass: (w, t, f) => `out/glasshouse_pano_spring_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
  garden: (w, t, f) => `out/garden_pano_patio_${w}${sfx(t)}${f ? '' : '_preview'}.jpg`,
};
const CHANGE_ROOMS = ['cuddlecore', 'flourish', 'sweet', 'chia', 'hall'];

test('names: night keeps its suffix, dawn and dusk take theirs', () => {
  assert.equal(sfx(true), '_night'); assert.equal(sfx('night'), '_night');
  assert.equal(sfx('dawn'), '_dawn'); assert.equal(sfx('dusk'), '_dusk'); assert.equal(sfx(false), '');
  assert.equal(NAMES.glass('fair', 'dawn', true), 'out/glasshouse_pano_spring_fair_dawn.jpg');
});

test('what exists: fair everywhere, change for the kitchens and hallway, nothing else', () => {
  for (const [room, name] of Object.entries(NAMES)) for (const t of ['dawn', 'dusk']) for (const w of WEATHERS) for (const full of [true, false]) {
    const want = w === 'fair' || (w === 'change' && CHANGE_ROOMS.includes(room));
    assert.equal(panoExists(name(w, t, full)), want, `${room} ${w} ${t}`);
  }
  assert.equal(panoExists(NAMES.cuddlecore('rain', 'night', true)), true);   // night and day aren't this list's business
  assert.equal(panoExists(NAMES.cuddlecore('rain', false, true)), true);
});

test('fallback: never a missing picture, and always something to show', () => {
  for (const [room, name] of Object.entries(NAMES)) for (const time of ['dawn', 'dusk']) for (const w of WEATHERS) {
    const R = { pano: name }, list = usable(R, w, time);
    assert.ok(list.length, `${room} ${w} ${time}`);
    for (const [cw, t] of list) assert.ok(panoExists(name(cw, t, false)), `${room} ${w} ${time} -> ${cw} ${t}`);
    assert.deepEqual(list.at(-1), [w, null]);                                  // the day render is the last resort
  }
});

test('fallback order: own, fair, then day (dawn) or night then day (dusk)', () => {
  const R = { pano: NAMES.glass };                                               // the Conservatory has no `change` dawn or dusk
  assert.deepEqual(usable(R, 'change', 'dawn'), [['fair', 'dawn'], ['change', null]]);
  assert.deepEqual(usable(R, 'rain', 'dawn'), [['rain', null]]);
  assert.deepEqual(usable(R, 'rain', 'dusk'), [['rain', 'night'], ['rain', null]]);
  assert.deepEqual(usable(R, 'very-dry', 'dusk'), [['fair', 'dusk'], ['very-dry', 'night'], ['very-dry', null]]);
  assert.deepEqual(usable({ pano: NAMES.cuddlecore }, 'change', 'dusk').slice(0, 2), [['change', 'dusk'], ['fair', 'dusk']]);
  assert.deepEqual(usable(R, 'fair', 'dawn'), [['fair', 'dawn'], ['fair', null]]);
  assert.deepEqual(candidates('rain', 'midday'), [['rain', null]]);
  assert.deepEqual(candidates('rain', 'night'), [['rain', 'night'], ['rain', null]]);
});
