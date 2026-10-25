// The ideas explainer's lines (blender/explore/gemma-lines.json `explain`): node --test test/explain-lines.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WRITE_CAP } from '../blender/explore/writeout.js';

const X = JSON.parse(readFileSync(new URL('../blender/explore/gemma-lines.json', import.meta.url), 'utf8')).explain;
const all = Object.entries(X).filter(([k]) => ['a', 'b', 'c', 'free'].includes(k)).flatMap(([, v]) => [...v.lines, ...(v.touch || [])]);

test('every beat line fits a phone chat line and keeps the voice guide', () => {
  for (const l of all) {
    assert.ok(l.length < 100, `too long: ${l}`);
    assert.ok(!/—/.test(l), `em dash: ${l}`);
    assert.ok(!/\b(heal|cure|boost|detox)/i.test(l), `health claim: ${l}`);
  }
});
test('the daily allowance is never typed into a line: it is {n}, from WRITE_CAP, on a tagged beat', () => {
  assert.ok(Number.isInteger(WRITE_CAP) && WRITE_CAP > 0);
  assert.equal(X.c.policy, 'daily-allowance');
  assert.ok(X.c.lines.some(l => l.includes('{n}')));
  for (const l of all) assert.ok(!/\b(\d+|one|two|three|four|five) a day\b/i.test(l), `typed allowance: ${l}`);
  for (const k of ['a', 'b']) assert.ok(!X[k].policy);
});
test('each beat says what it should', () => {
  assert.match(X.a.lines.join(' '), /ideas/);
  assert.match(X.b.lines.join(' '), /Keep/);
  assert.match(X.b.lines.join(' '), /Not this/);
  assert.match(X.c.lines.join(' '), /this device/);
  assert.match(X.c.lines.join(' '), /Your kitchen/);
});
