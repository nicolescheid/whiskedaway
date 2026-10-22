// The chia Mix's data, swap matcher and recipe (blender/explore/chia-mix.js): A real mix's add-ins (appliances-chia-plan.md §2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chiaData, swapFor, whenMatches, toggleAddin, capLine, mixRecipe, stepsFor } from '../blender/explore/chia-mix.js';

const LINES = JSON.parse(readFileSync(new URL('../blender/explore/gemma-lines.json', import.meta.url), 'utf8'));
const D = chiaData(LINES);
const real = (addins, more = {}) => ({ mode: 'real', addins, ...more });

test('the content reads in: five groups, 40 add-ins, a soft cap of 6, the add-in rules after the old ones', () => {
  assert.equal(D.groups.length, 5);
  assert.equal(Object.keys(D.addins).length, 40);
  assert.equal(D.softCap, 6);
  assert.equal(D.addins.honey.group, 'sweeteners');
  assert.ok(D.swaps.some(r => r.swap?.step === 'addins'));
  for (const id of Object.values(D.fromDrawers)) assert.ok(D.addins[id] || D.seeds[id], `drawer ${id} maps to an add-in or a seed`);
});

test('steps: the jar size first, then the simple or the real mix', () => {
  assert.deepEqual(stepsFor({}), ['mode', 'mood', 'base', 'flavour', 'topping']);
  assert.deepEqual(stepsFor({ mode: 'real' }), ['mode', 'mood', 'base', 'flavour', 'addins']);
});

test('when: addins (every one), group + atLeast, and the single choices', () => {
  assert.ok(whenMatches(D, { addins: ['peanut-butter', 'almond-butter'] }, real(['almond-butter', 'peanut-butter', 'berries'])));
  assert.ok(!whenMatches(D, { addins: ['peanut-butter', 'almond-butter'] }, real(['peanut-butter'])));
  assert.ok(whenMatches(D, { group: 'sweeteners', atLeast: 3 }, real(['honey', 'agave', 'jam'])));
  assert.ok(!whenMatches(D, { group: 'sweeteners', atLeast: 3 }, real(['honey', 'agave', 'berries'])));
  assert.ok(whenMatches(D, { addins: ['kiwifruit'], base: 'milk' }, real(['kiwifruit'], { base: 'milk' })));
  assert.ok(!whenMatches(D, { addins: ['kiwifruit'], base: 'milk' }, real(['kiwifruit'], { base: 'oat' })));
  assert.ok(!whenMatches(D, { addins: ['kiwifruit'] }, { mode: 'simple', addins: ['kiwifruit'] }), 'a simple jar has no add-ins');
  assert.ok(!whenMatches(D, {}, real([])), 'an empty when never matches');
});

test('swapFor: a remove swap, then gone once taken out; a declined one stays quiet; old rules still work', () => {
  const d = real(['peanut-butter', 'almond-butter']);
  const r = swapFor(D, d);
  assert.deepEqual(r.swap, { step: 'addins', remove: 'almond-butter' });
  assert.equal(r.yes, 'Just peanut butter');
  assert.equal(swapFor(D, real(['peanut-butter'])), null, 'taken out: nothing to say');
  assert.notEqual(swapFor(D, d, new Set([r.i]))?.i, r.i, 'declined: not again');
  const note = swapFor(D, real(['honey', 'agave', 'date-syrup']));
  assert.equal(note.swap, null);
  assert.match(note.line, /sweet/);
  assert.equal(swapFor(D, { mood: 'cultured', base: 'oat' }).swap.to, 'kefir', 'the simple jar\'s rules are unchanged');
});

test('add-ins toggle and the soft cap is a line, never a block', () => {
  let xs = [];
  for (const id of ['berries', 'mango', 'walnuts', 'cinnamon', 'honey', 'mint', 'cocoa', 'jam']) xs = toggleAddin(xs, id);
  assert.equal(xs.length, 8);
  assert.deepEqual(toggleAddin(xs, 'mint').includes('mint'), false);
  assert.match(capLine(D, 6), /proper jar/);
  assert.match(capLine(D, 8), /very full/);
  assert.equal(capLine(D, 7), '');
});

test('the recipe: every add-in in the ingredients and the mix, on-top and thirsty ones named, the flavour never twice', () => {
  const rec = mixRecipe(D, real(['berries', 'granola', 'rolled-oats', 'matcha'], { base: 'milk', flavour: 'matcha' }));
  assert.deepEqual(rec.mix.addins, ['Berries', 'Granola', 'Rolled oats']);
  assert.deepEqual(rec.mix.top, ['Granola']);
  assert.deepEqual(rec.mix.thirsty, ['Rolled oats']);
  assert.equal(rec.mix.topping, undefined, 'a real mix has no single topping');
  assert.ok(rec.key_ingredients.includes('rolled oats'));
  assert.notEqual(rec.id, mixRecipe(D, real(['berries'], { base: 'milk', flavour: 'matcha' })).id, 'a different jar is a different recipe');
  const simple = mixRecipe(D, { mode: 'simple', base: 'milk', topping: 'granola', addins: ['berries', 'mint'] });
  assert.equal(simple.mix.addins, undefined, 'a simple jar sends no add-ins');
  assert.equal(simple.mix.topping, 'Granola');
});

test('plural labels take the plural verb', async () => {
  const { agree } = await import('../blender/explore/chia-mix.js');
  assert.equal(agree('{x} goes in.', 'Berries'), '{x} go in.');
  assert.equal(agree('{x} goes in.', 'Mango'), '{x} goes in.');
  assert.equal(agree('{x} is out again.', 'Rolled oats'), '{x} are out again.');
  assert.equal(agree('{x} drinks up liquid', 'Ground flaxseed'), '{x} drinks up liquid');
  assert.equal(agree(D.lines.addinClash, 'Walnuts').startsWith("{x} aren't {d}"), true, 'the content clash line agrees');
  assert.ok(!/health|good for|boost/i.test(D.lines.addinClash + D.lines.addinCheck), 'no health words');
});
