// Your kitchen (blender/explore/kitchen.js) and the Worker's kitchen and add-in lines (worker/inn-extras.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kitchenPicks, togglePick, kitchenFits, fitKitchen, kitchenTag, kitchenWords, kitchenPayload, APPLIANCES } from '../blender/explore/kitchen.js';
import { kitchenLine, addinsLine } from '../worker/inn-extras.js';

const LINES = JSON.parse(readFileSync(new URL('../blender/explore/gemma-lines.json', import.meta.url), 'utf8'));
const K = LINES.kitchen;
const atom = (id, appliances, checked = true) => ({ id, appliances, appliances_checked: checked });

test('picks: known ids in order, none alone', () => {
  assert.deepEqual(kitchenPicks(['air-fryer', 'oven', 'toaster']), ['oven', 'air-fryer']);
  assert.deepEqual(kitchenPicks(['oven', 'none']), ['none']);
  assert.deepEqual(kitchenPicks(null), []);
});

test('a tap: none clears the rest, an appliance clears none, again takes it out', () => {
  assert.deepEqual(togglePick(['oven', 'stove'], 'none'), ['none']);
  assert.deepEqual(togglePick(['none'], 'bbq'), ['bbq']);
  assert.deepEqual(togglePick(['oven', 'bbq'], 'oven'), ['bbq']);
  assert.deepEqual(togglePick([], 'kettle'), []);
});

test('the filter: any of the picked appliances, or no cooking', () => {
  const bake = atom('bake', ['oven', 'air-fryer']), salad = atom('salad', []), soup = atom('soup', ['stove', 'slow-cooker']);
  assert.ok(kitchenFits(bake, []), 'nothing picked: anything goes');
  assert.ok(kitchenFits(bake, ['air-fryer']), 'one of its appliances');
  assert.ok(!kitchenFits(soup, ['air-fryer']));
  assert.ok(kitchenFits(salad, ['air-fryer']), 'no cooking fits every kitchen');
  assert.ok(kitchenFits(salad, ['none']));
  assert.ok(!kitchenFits(bake, ['none']), 'no cooking leaves out cooked ideas');
  assert.ok(kitchenFits(atom('x', ['oven'], false), ['bbq']), 'cards not checked by content always fit');
  assert.ok(kitchenFits({ id: 'mix' }, ['bbq']), 'cards with no tags (a chia mix) always fit');
});

test('a room that runs dry is loosened, not emptied', () => {
  const room = [atom('a', ['oven']), atom('b', ['stove'])];
  assert.deepEqual(fitKitchen(room, ['oven']), { atoms: [room[0]], loosened: false });
  assert.deepEqual(fitKitchen(room, ['bbq']), { atoms: room, loosened: true });
  assert.deepEqual(fitKitchen([], ['bbq']), { atoms: [], loosened: false });
});

test('the tag, the words and the write-out', () => {
  assert.equal(kitchenTag([], K), '');
  assert.equal(kitchenTag(['oven', 'air-fryer'], K), '🍳 oven · air fryer');
  assert.equal(kitchenTag(['stove', 'oven', 'microwave', 'bbq'], K), '🍳 stove · oven +2');
  assert.equal(kitchenTag(['none'], K), '🥗 no cooking');
  assert.deepEqual(kitchenWords(['food-processor'], K), ['blender']);
  assert.deepEqual(kitchenPayload(['oven', 'air-fryer'], K), { appliances: ['oven', 'air fryer'] });
  assert.deepEqual(kitchenPayload(['none'], K), { no_cooking: true });
  assert.deepEqual(kitchenPayload([], K), {});
});

test('content: every appliance has words, every idea atom is tagged with known ids', () => {
  for (const id of APPLIANCES) assert.ok(K.appliances[id]?.label && K.appliances[id]?.short && K.pick[id], id);
  for (const room of ['cuddlecore', 'flourish', 'sweet-spells', 'chiapothecary', 'glasshouse']) {
    const w = JSON.parse(readFileSync(new URL(`../blender/explore/${room}-world.json`, import.meta.url), 'utf8'));
    for (const a of w.atoms || []) {
      if (!a.appliances_checked) continue;
      for (const x of a.appliances) assert.ok(APPLIANCES.includes(x), `${a.id}: ${x}`);
    }
  }
});

test('Worker: the kitchen line keeps to what they picked', () => {
  assert.equal(kitchenLine({}), '', 'no preference: the prompt is as it was');
  assert.equal(kitchenLine({ appliances: [] }), '');
  const l = kitchenLine({ appliances: ['oven', 'air fryer'] });
  assert.match(l, /cook it with: oven, air fryer/);
  assert.match(l, /Never ask for an appliance they did not list/);
  assert.match(l, /air fryer instead of the oven/);
  assert.match(kitchenLine({ no_cooking: true, appliances: ['oven'] }), /no cooking at all/);
  assert.ok(kitchenLine({ appliances: ['x'.repeat(200)] }).length < 600, 'each word is cut short');
  assert.equal(kitchenLine({ no_cooking: 'yes' }), '', 'only a real true means no cooking');
});

test('Worker: the add-ins line lists every add-in and keeps the ratio honest', () => {
  assert.equal(addinsLine({}), '');
  assert.equal(addinsLine({ base: 'Milk' }), '', 'a simple jar: the prompt is as it was');
  const l = addinsLine({ addins: ['Berries', 'Rolled oats', 'Granola', 'Cinnamon'], top: ['Granola', 'Mint'], thirsty: ['Rolled oats'] });
  assert.match(l, /every one in the recipe: Berries, Rolled oats, Granola, Cinnamon\./);
  assert.match(l, /on top just before eating, not in the jar overnight: Granola\./, 'only picked ones go on top');
  assert.match(l, /3 tbsp chia seeds to 1 cup \(250 ml\)/);
  assert.match(l, /Rolled oats soaks up liquid/);
});
