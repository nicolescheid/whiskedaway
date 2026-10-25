// Complete cards (freebies, 25 Oct): a card flagged `complete` holds its whole recipe and goes into the book free, as it is.
// node --test test/complete-cards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { asIsFull } from '../blender/explore/writeout.js';

const dir = new URL('../blender/explore/', import.meta.url);
const atoms = readdirSync(dir).filter(f => f.endsWith('-world.json'))
  .flatMap(f => (JSON.parse(readFileSync(new URL(f, dir), 'utf8')).atoms || []));
const complete = atoms.filter(a => a.complete);

test('there are complete cards, and only techniques, rituals and simple recipes carry the flag', () => {
  assert.ok(complete.length >= 8, `only ${complete.length}`);
  for (const a of complete) assert.ok(['technique', 'ritual', 'recipe idea'].includes(a.kind), `${a.id}: ${a.kind}`);
});
test('every complete card has amounts, ingredients and 3 to 6 short steps', () => {
  for (const a of complete) {
    const r = a.recipe;
    assert.ok(r, `${a.id}: no recipe`);
    assert.ok(r.ingredients?.length >= 1, `${a.id}: no ingredients`);
    for (const i of r.ingredients) assert.ok(i.item && i.amount, `${a.id}: an ingredient needs an amount and an item`);
    assert.ok(r.steps?.length >= 3 && r.steps.length <= 6, `${a.id}: ${r.steps?.length} steps`);
    for (const s of r.steps) assert.ok(s.length > 5 && s.length <= 220, `${a.id}: step length: ${s}`);
  }
});
test('complete cards keep the voice guide: no health claims, no em dashes', () => {
  for (const a of complete) {
    const text = JSON.stringify(a.recipe);
    assert.ok(!/\b(heal|cure|boost|detox|immune|inflammat|medicine)/i.test(text), `${a.id}: health claim`);
    assert.ok(!/—/.test(text), `${a.id}: em dash`);
  }
});
test('a complete card turns into a written-shape recipe, flagged as it is; an incomplete one does not', () => {
  const a = complete[0], f = asIsFull(a);
  assert.equal(f.asIs, true);
  assert.equal(f.steps.length, a.recipe.steps.length);
  assert.equal(f.howto, a.kind === 'technique');
  const plain = atoms.find(x => !x.complete);
  assert.equal(asIsFull(plain), null);
});
