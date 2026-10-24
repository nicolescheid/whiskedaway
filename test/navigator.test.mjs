// Navigator unit tests (npm run check runs them; or: node --test test/)
// The worlds are merged the way blender/explore.html merges them, so these test the real data too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localNavigate, roomClusters, listJoin, adventureScore, adventureKind } from '../blender/explore/navigator.js';

const read = f => JSON.parse(readFileSync(new URL(`../blender/explore/${f}-world.json`, import.meta.url), 'utf8'));
const homes = ['cuddlecore', 'flourish', 'sweet-spells', 'chiapothecary', 'garden'].map(read);
const [cuddle] = homes;
for (const w of homes) Object.values(w.clusters).forEach(c => { c.room = w.room; });
const world = {
  ...cuddle,
  objects: Object.assign({}, ...['hallway', 'glasshouse'].map(f => read(f).objects), ...homes.map(w => w.objects)),
  clusters: Object.assign({}, ...homes.map(w => w.clusters)),
  atoms: homes.flatMap(w => w.atoms),
};
const ROOMS = homes.map(w => w.room);
// Wanders that only set the standing signals, as on arrival: every weather at every time of day
const WANDERS = Object.keys(world.weathers).flatMap(w => Object.keys(world.times).map(t => [{ kind: 'weather', id: w }, { kind: 'time', id: t }]));

test('listJoin reads like English', () => {
  assert.equal(listJoin([]), '');
  assert.equal(listJoin(['a']), 'a');
  assert.equal(listJoin(['a', 'b']), 'a and b');
  assert.equal(listJoin(['a', 'b', 'c']), 'a, b and c');
});

test('every atom and cluster belongs to a room', () => {
  for (const a of world.atoms) assert.ok(ROOMS.includes(a.room), `atom ${a.id} has room ${a.room}`);
  for (const [id, c] of Object.entries(world.clusters)) assert.ok(ROOMS.includes(c.room), `cluster ${id}`);
});

test("a room's readings are its own; rooms without any get them all", () => {
  for (const room of ROOMS) {
    const own = Object.values(roomClusters(world, room));
    assert.ok(own.length > 0, room);
    assert.ok(own.every(c => c.room === room), `${room} names another room's reading`);
  }
  for (const room of ['hallway', 'glasshouse', null]) {
    assert.equal(Object.keys(roomClusters(world, room)).length, Object.keys(world.clusters).length, String(room));
  }
});

for (const room of ROOMS) test(`Gemma names one of the room's own readings: ${room}`, () => {
  for (const trail of WANDERS) {
    const r = localNavigate(trail, world, { room });
    if (r.cluster) assert.equal(world.clusters[r.cluster].room, room, `${room} ${JSON.stringify(trail)} -> ${r.cluster}`);
    for (const c of r.fork) assert.equal(world.clusters[c].room, room, `${room} fork ${c}`);
  }
});

// The page's rule (steer() in explore.html): an away idea is allowed only while none is out
for (const room of ROOMS) test(`at most one of three ideas comes from another room: ${room}`, () => {
  for (const trail of WANDERS) {
    const served = [];
    for (let i = 0; i < 3; i++) {
      const awayOut = served.some(id => world.atoms.find(a => a.id === id).room !== room);
      const pick = localNavigate(trail, world, { room, served, awayOk: !awayOut }).serve[0];
      if (!pick) break;
      served.push(pick.atom);
    }
    const away = served.filter(id => world.atoms.find(a => a.id === id).room !== room);
    assert.ok(away.length <= 1, `${room} ${JSON.stringify(trail)}: ${served.join(', ')}`);
  }
});

// The hallway and the Conservatory (glasshouse) have no readings or ideas of their own: the page runs the navigator there with the
// merged world and that room's id, so every reading is open and nothing gets a home bonus
for (const room of ['hallway', 'glasshouse']) test(`Gemma reads the wander in the ${room}`, () => {
  for (const trail of WANDERS) {
    const r = localNavigate(trail, world, { room });
    assert.ok(r.cluster && world.clusters[r.cluster], `${room} ${JSON.stringify(trail)}`);
    assert.ok(r.serve.length <= 2);
  }
});

test('an empty wander serves nothing and names nothing', () => {
  const r = localNavigate([], world, { room: 'cuddlecore' });
  assert.equal(r.serve.length, 0);
  assert.equal(r.cluster, undefined);
});

// Sweet Spells (rooms-views.md, Stage B): cravings lean the room's own atoms; "no added sugar" is a penalty, never a filter
test('a craving leans Sweet Spells towards it', () => {
  const trail = [{ kind: 'touch', id: 'spell-books' }];
  const top = opts => localNavigate(trail, world, { room: 'sweet-spells', ...opts }).serve.map(s => world.atoms.find(a => a.id === s.atom));
  const cold = top({ cravingThemes: ['chilled'], cravingRoom: 'sweet-spells' });
  assert.ok(cold[0]?.themes.includes('chilled'), cold.map(a => a.id).join(', '));
  assert.ok(!top({})[0]?.themes.includes('chilled'));
});
test('no added sugar lowers sugary atoms but leaves them in', () => {
  const trail = [{ kind: 'touch', id: 'spell-books' }, { kind: 'touch', id: 'lectern' }];
  const none = localNavigate(trail, world, { room: 'sweet-spells', noAddedSugar: true }).serve.map(s => world.atoms.find(a => a.id === s.atom));
  assert.ok(none.length > 0);
  assert.ok(none.some(a => !a.added_sugar), none.map(a => a.id).join(', '));
  // With every unsweetened atom already out, the sugary ones still come
  const served = world.atoms.filter(a => a.room === 'sweet-spells' && !a.added_sugar).map(a => a.id);
  assert.ok(localNavigate(trail, world, { room: 'sweet-spells', noAddedSugar: true, served }).serve.length > 0);
});

// ---------- the food map's adventure dial: a score, never a filter, and the cage always wins
const ADV = step => ({ step, familiar: ['Italian'], near: ['Greek', 'French'] });
const card = (cuisines, more = {}) => ({ id: 'x', cuisines, themes: [], ...more });

test('adventure: familiar, near, new and untagged', () => {
  assert.equal(adventureKind(card(['Italian']), ADV(1)), 'familiar');
  assert.equal(adventureKind(card(['Greek']), ADV(1)), 'near');
  assert.equal(adventureKind(card(['Korean']), ADV(1)), 'fresh');
  assert.equal(adventureKind(card([]), ADV(1)), null);
  assert.equal(adventureScore(card([]), ADV(5)), 0, 'an untagged card is never moved by the dial');
  assert.equal(adventureScore(card(['Korean']), null), 0, 'unset: the Inn serves as it always has');
});

test('adventure: close to home leans familiar, somewhere new leans new, mild ways in help the middle steps', () => {
  assert.ok(adventureScore(card(['Italian']), ADV(1)) > adventureScore(card(['Korean']), ADV(1)));
  assert.ok(adventureScore(card(['Korean']), ADV(5)) > adventureScore(card(['Italian']), ADV(5)));
  assert.ok(adventureScore(card(['Greek']), ADV(3)) > adventureScore(card(['Italian']), ADV(3)));
  assert.ok(adventureScore(card(['Korean'], { mild_way_in: 'Korean' }), ADV(4)) > adventureScore(card(['Korean']), ADV(4)));
});

test('adventure: the cage always wins (a card the page left out is never served, whatever the dial)', () => {
  const wander = [{ kind: 'weather', id: 'rain' }, { kind: 'time', id: Object.keys(world.times)[0] }];
  for (const step of [1, 2, 3, 4, 5]) {
    const free = localNavigate(wander, world, { about: { adventure: { step, familiar: [], near: [] } } });
    assert.ok(free.serve.length, `step ${step} serves something to cage`);
    for (const s of free.serve) {
      // Cage the very card the dial picked: it must not come back, and nothing caged may take its place
      const caged = [s.atom, ...world.atoms.filter(a => (a.cuisines || []).length).map(a => a.id)];
      const r = localNavigate(wander, world, { served: caged, about: { adventure: { step, familiar: [], near: [] } } });
      for (const t of r.serve) assert.ok(!caged.includes(t.atom), `step ${step}: ${t.atom} was caged`);
    }
  }
});
