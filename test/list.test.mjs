// The shopping list's sums (blender/explore/list.js): node --test test/list.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine, parseAmount, showAmount, qty } from '../blender/explore/list.js';

const one = (items, factor) => ({ id: `r${Math.random()}`, items, factor });
const lines = (...recipes) => combine(recipes).map(l => `${l.amount ? `${l.amount} ` : ''}${l.item}${l.note ? ` (${l.note})` : ''}`);

test('fractions and vulgar fractions', () => {
  assert.equal(qty('1 1/2'), 1.5);
  assert.equal(qty('1½'), 1.5);
  assert.equal(qty('¾'), 0.75);
  assert.ok(Number.isNaN(qty('2-3')));
});

test('grams and kilograms sum, and show as kg past 1000', () => {
  assert.deepEqual(lines(one([{ item: 'flour', amount: '600', unit: 'g' }]), one([{ item: 'flour', amount: '0.5', unit: 'kg' }])), ['1.1 kg flour']);
  assert.deepEqual(lines(one([{ item: 'butter', amount: '100', unit: 'g' }]), one([{ item: 'butter', amount: '50', unit: 'grams' }])), ['150 g butter']);
});

test('ml and litres sum', () => {
  assert.deepEqual(lines(one([{ item: 'stock', amount: '500', unit: 'ml' }]), one([{ item: 'stock', amount: '1', unit: 'l' }])), ['1.5 l stock']);
});

test('spoons and cups sum into the cleanest measure', () => {
  assert.deepEqual(lines(one([{ item: 'oil', amount: '1', unit: 'tbsp' }]), one([{ item: 'oil', amount: '3', unit: 'tsp' }])), ['2 tbsp oil']);
  assert.deepEqual(lines(one([{ item: 'sugar', amount: '1/2', unit: 'cup' }]), one([{ item: 'sugar', amount: '1', unit: 'cup' }])), ['1 1/2 cups sugar']);
  assert.deepEqual(lines(one([{ item: 'salt', amount: '1', unit: 'tsp' }]), one([{ item: 'salt', amount: '1', unit: 'tbsp' }])), ['4 tsp salt']);
});

test("counts and cups of the same thing stay apart: they can't be summed honestly", () => {
  const out = lines(one([{ item: 'onions', amount: '2', unit: '', key: 'onion' }]), one([{ item: 'chopped onion', amount: '1', unit: 'cup', key: 'onion' }]));
  assert.deepEqual(out, ['2 onions', '1 cup chopped onion']);
});

test('metric and cups never convert into each other', () => {
  const out = lines(one([{ item: 'flour', amount: '200', unit: 'g' }]), one([{ item: 'flour', amount: '1', unit: 'cup' }]));
  assert.deepEqual(out, ['200 g flour', '1 cup flour']);
});

test('"Both" amounts: metric sums, cups in brackets only when every part had them', () => {
  assert.deepEqual(parseAmount('200 g (1 1/2 cups)', '').main, { n: 200, fam: 'g', word: 'g' });
  const both = lines(one([{ item: 'flour', amount: '200 g (1 1/2 cups)', unit: '' }]), one([{ item: 'flour', amount: '100 g (3/4 cup)', unit: '' }]));
  assert.deepEqual(both, ['300 g (2 1/4 cups) flour']);
  const mixed = lines(one([{ item: 'flour', amount: '200 g (1 1/2 cups)', unit: '' }]), one([{ item: 'flour', amount: '100', unit: 'g' }]));
  assert.deepEqual(mixed, ['300 g flour']);
  assert.deepEqual(lines(one([{ item: 'oil', amount: '15 ml (1 tbsp)', unit: '' }])), ['15 ml (1 tbsp) oil']);
});

test('servings scale the sum, rounded where cooks round', () => {
  assert.deepEqual(lines(one([{ item: 'rice', amount: '150', unit: 'g' }], 2)), ['300 g rice']);
  assert.deepEqual(lines(one([{ item: 'eggs', amount: '3', unit: '' }], 1.5)), ['4 1/2 eggs']);
});

test('"to taste" joins the measured line, or shows in brackets alone', () => {
  const a = one([{ item: 'salt', amount: '1', unit: 'tsp' }]), b = one([{ item: 'salt', amount: 'to taste', unit: '' }]);
  const out = combine([a, b]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].from, [a.id, b.id]);
  assert.deepEqual(lines(one([{ item: 'pepper', amount: 'to taste' }])), ['pepper (to taste)']);
});

test('each line knows which recipes need it', () => {
  const a = { id: 'a', items: [{ item: 'garlic', amount: '2', unit: 'cloves' }] }, b = { id: 'b', items: [{ item: 'garlic', amount: '1', unit: 'clove' }] };
  const [l] = combine([a, b]);
  assert.equal(l.amount, '3 cloves');
  assert.deepEqual(l.from, ['a', 'b']);
});

test('shopping words: the same thing under two names joins', () => {
  const words = t => t.replace(/courgette/g, 'zucchini');
  const out = combine([one([{ item: 'courgette', amount: '1', unit: '', key: 'courgette' }]), one([{ item: 'zucchini', amount: '2', unit: '', key: 'zucchini' }])], words);
  assert.deepEqual(out.map(l => `${l.amount} ${l.item}`), ['3 zucchini']);
});

test('showAmount', () => {
  assert.equal(showAmount(1250, 'g'), '1.25 kg');
  assert.equal(showAmount(12, 'spoon', ['cup']), '1/4 cup');
  assert.equal(showAmount(2, 'u:pinch', ['pinch']), '2 pinches');
});

// A metric write-out that slipped into cups (Nicole's phone, 22 Oct), and a "Both" amount whose unit came apart
import { fitUnits } from '../blender/explore/writeout.js';
test('metric recipes: cups become ml (or tbsp for a quarter cup), and the page says so', () => {
  const f = fitUnits({ units: 'metric', ingredients: [{ item: 'sweetcorn kernels', amount: '1', unit: 'cup' },
    { item: 'baby spinach', amount: '1 1/2 cups', unit: '' }, { item: 'oil', amount: '1/4', unit: 'cup' }, { item: 'whitebait', amount: '150', unit: 'g' }] });
  assert.deepEqual(f.ingredients.map(i => `${i.amount} ${i.unit}`), ['250 ml', '375 ml', '4 tbsp', '150 g']);
  assert.equal(f.unitsFix, 'converted');
  assert.equal(fitUnits({ units: 'metric', ingredients: [{ item: 'rice', amount: 'a cup', unit: '' }] }).unitsFix, 'mixed');
  const ok = { units: 'metric', ingredients: [{ item: 'flour', amount: '200', unit: 'g' }] };
  assert.equal(fitUnits(ok), ok);
});
test('"Both" keeps its brackets: a unit that came apart goes back in the amount, and cups are left alone', () => {
  const f = fitUnits({ units: 'both', ingredients: [{ item: 'flour', amount: '200 (1 1/2 cups)', unit: 'g' }, { item: 'oil', amount: '15 ml (1 tbsp)', unit: '' }] });
  assert.deepEqual(f.ingredients.map(i => i.amount), ['200 g (1 1/2 cups)', '15 ml (1 tbsp)']);
  assert.equal(f.unitsFix, undefined);
});
