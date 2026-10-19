// Navigator unit tests (npm run check runs them; or: node --test test/)
// The worlds are merged the way blender/explore.html merges them, so these test the real data too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localNavigate, roomClusters, listJoin } from '../blender/explore/navigator.js';

const read = f => JSON.parse(readFileSync(new URL(`../blender/explore/${f}-world.json`, import.meta.url), 'utf8'));
const homes = ['cuddlecore', 'flourish', 'sweet-spells', 'chiapothecary'].map(read);
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
