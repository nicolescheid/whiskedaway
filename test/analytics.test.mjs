// Analytics: every event the code sends is on the allow-list (the Worker drops the rest silently, which is how
// erwina_seen went missing), and the visit-source buckets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EVENTS, cleanEvent, visitSource, sourceParams } from '../src/lib/analytics-events.js';

const walk = d => readdirSync(d).flatMap(f => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? (['assets', 'out', 'node_modules'].includes(f) ? [] : walk(p)) : [p];
});

test('every track(...) call names an event on the allow-list', () => {
  const files = [...walk('blender/explore'), ...walk('src'), 'blender/explore.html'].filter(f => /\.(js|jsx|html)$/.test(f));
  const unlisted = [];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\btrack(?:\?\.)?\(\s*'([a-z_]+)'/g)) if (!EVENTS[m[1]]) unlisted.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(unlisted, []);
});

test('explore_start carries nav_mode', () => {
  assert.deepEqual(cleanEvent('explore_start', { nav_mode: 'ai', room: 'hall-entrance', junk: 'x' }).params, { nav_mode: 'ai', room: 'hall-entrance' });
});

test('visit source buckets', () => {
  const b = (ref, search = '') => visitSource(ref, search, 'whiskedaway.com').bucket;
  assert.equal(b(''), 'direct');
  assert.equal(b('https://whiskedaway.com/archive/'), 'direct');
  assert.equal(b('https://www.linkedin.com/'), 'linkedin');
  assert.equal(b('https://lnkd.in/abc'), 'linkedin');
  assert.equal(b('android-app://com.linkedin.android/'), 'linkedin');
  assert.equal(b('https://www.google.co.nz/'), 'google');
  assert.equal(b('https://www.bing.com/'), 'bing');
  assert.equal(b('https://example.org/some/page?secret=1'), 'other');
});

test('visit source never carries a URL, and utm values are short ids', () => {
  const s = visitSource('https://example.org/a?b=c', '?utm_source=LinkedIn&utm_campaign=launch-1&x=1', 'whiskedaway.com');
  assert.deepEqual(s, { bucket: 'other', utm_source: 'linkedin', utm_campaign: 'launch-1' });
  assert.deepEqual(visitSource('', '?utm_source=https://evil.example/x', 'whiskedaway.com'), { bucket: 'direct' });
});

test('GA4 source parameters', () => {
  assert.deepEqual(sourceParams({ bucket: 'linkedin' }), { source: 'linkedin', medium: 'social', visit_source: 'linkedin', visit_medium: 'social' });
  assert.deepEqual(sourceParams({ bucket: 'google' }), { source: 'google', medium: 'organic', visit_source: 'google', visit_medium: 'organic' });
  assert.deepEqual(sourceParams({ bucket: 'direct' }), { source: '(direct)', medium: '(none)', visit_source: '(direct)', visit_medium: '(none)' });
  assert.deepEqual(sourceParams({ bucket: 'direct', utm_source: 'linkedin', utm_campaign: 'launch' }), { source: 'linkedin', medium: 'social', campaign: 'launch', visit_source: 'linkedin', visit_medium: 'social', visit_campaign: 'launch' });
  assert.deepEqual(sourceParams({ bucket: 'other', utm_source: 'newsletter' }), { source: 'newsletter', medium: 'campaign', visit_source: 'newsletter', visit_medium: 'campaign' });
  assert.equal(sourceParams({ bucket: 'https://x.example/' }), null);
  assert.equal(sourceParams(null), null);
});

test('tour, explainer and freebie events keep their parameters (tour_end stop is a number in the code)', () => {
  assert.deepEqual(cleanEvent('tour_end', { how: 'skip', stop: 3 }).params, { how: 'skip', stop: '3' });
  assert.deepEqual(cleanEvent('tour_end', { how: 'declined', stop: 0 }).params, { how: 'declined', stop: '0' });
  assert.deepEqual(cleanEvent('tour_offer', {}).params, {});
  assert.deepEqual(cleanEvent('chat_start', { from: 'bell' }).params, { from: 'bell' });
  assert.deepEqual(cleanEvent('chat_end', { how: 'later', step: 0 }).params, { how: 'later', step: '0' });
  assert.deepEqual(cleanEvent('tour_start', { from: 'arrival' }).params, { from: 'arrival' });
  assert.deepEqual(cleanEvent('explain_beat', { beat: 'b' }).params, { beat: 'b' });
  assert.deepEqual(cleanEvent('first_idea_open', { beat_a: 'yes' }).params, { beat_a: 'yes' });
  assert.deepEqual(cleanEvent('book_add_free', { count: '2-3' }).params, { count: '2-3' });
  assert.equal(cleanEvent('tour_end', { stop: -1, how: 'x' }).params.stop, undefined);
});
