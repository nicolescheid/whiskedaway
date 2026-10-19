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

test('an empty wander serves nothing and names nothing', () => {
  const r = localNavigate([], world, { room: 'cuddlecore' });
  assert.equal(r.serve.length, 0);
  assert.equal(r.cluster, undefined);
});
