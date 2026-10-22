// Which idea an object shows (blender/explore/idea-pick.js): node --test test/idea-pick.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickIdea } from '../blender/explore/idea-pick.js';

const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c', seasons: ['winter'] };

test('the first idea the page can still serve', () => {
  assert.equal(pickIdea([a, b], { canServe: x => x !== a }), b);
});
test('none to serve: an object shows its own best match (page), the star chart reopens any card out', () => {
  assert.equal(pickIdea([a, b], { canServe: () => false, onCard: x => x === b }), a);
  assert.equal(pickIdea([a, b], { canServe: () => false, onCard: x => x === b, anyCard: true }), b);
  assert.equal(pickIdea([a, b], { canServe: () => false, onCard: x => x === a }), a);
});
test('none to serve or reopen: the best fit (its page opens)', () => {
  assert.equal(pickIdea([a, b], { canServe: () => false }), a);
});
test('in season first, out of season still allowed', () => {
  assert.equal(pickIdea([c, a], { season: 'summer' }), a);
  assert.equal(pickIdea([c, a], { season: 'winter' }), c);
  assert.equal(pickIdea([c], { season: 'summer' }), c);
});
test('missing atoms are skipped; nothing at all gives null', () => {
  assert.equal(pickIdea([undefined, b]), b);
  assert.equal(pickIdea([]), null);
});

// Every object's ideas exist, so a tap always has a card to show
import { readdirSync, readFileSync } from 'node:fs';
test('every object.ideas id is a real atom', () => {
  const dir = new URL('../blender/explore/', import.meta.url);
  const worlds = readdirSync(dir).filter(f => f.endsWith('-world.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  const ids = new Set(worlds.flatMap(w => (w.atoms || []).map(a => a.id)));
  const missing = worlds.flatMap(w => Object.entries(w.objects || {}).flatMap(([k, o]) => (o.ideas || []).filter(i => !ids.has(i)).map(i => `${k}: ${i}`)));
  assert.deepEqual(missing, []);
});
