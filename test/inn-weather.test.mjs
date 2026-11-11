// The visitor's weather (worker/inn-weather.js): Open-Meteo's current conditions as one of the Inn's twelve weathers
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { innWeather } from '../worker/inn-weather.js';

const world = JSON.parse(readFileSync(new URL('../blender/explore/cuddlecore-world.json', import.meta.url), 'utf8'));
const mild = { temperature_2m: 14, precipitation: 0, wind_gusts_10m: 15, cloud_cover: 10 };
const wx = (code, more = {}) => innWeather({ ...mild, weather_code: code, ...more });

test('no code, no guess', () => {
  assert.equal(innWeather({}), null);
  assert.equal(innWeather(), null);
});

test('sky codes and cloud cover', () => {
  assert.equal(wx(0), 'fair');
  assert.equal(wx(1), 'fair');
  assert.equal(wx(1, { cloud_cover: 50 }), 'cloudy');
  assert.equal(wx(2, { cloud_cover: 30 }), 'cloudy');
  assert.equal(wx(3, { cloud_cover: 100 }), 'overcast');
  assert.equal(wx(2, { cloud_cover: 90 }), 'overcast');
  assert.equal(wx(45), 'change');
  assert.equal(wx(48), 'change');
});

test('what falls', () => {
  for (const c of [51, 53, 55, 56, 57]) assert.equal(wx(c, { cloud_cover: 90 }), 'drizzle', c);
  for (const c of [61, 63, 65, 66, 67]) assert.equal(wx(c, { cloud_cover: 90 }), 'rain', c);
  for (const c of [71, 73, 75, 77, 85, 86]) assert.equal(wx(c, { temperature_2m: -1 }), 'snow', c);
  assert.equal(wx(80, { cloud_cover: 95 }), 'rain');
  assert.equal(wx(80, { cloud_cover: 40 }), 'changeable');
  assert.equal(wx(81, { cloud_cover: 60 }), 'changeable');
  assert.equal(wx(2, { precipitation: 0.4, cloud_cover: 60 }), 'rain');
});

test('storms and wind', () => {
  for (const c of [95, 96, 99]) assert.equal(wx(c), 'stormy', c);
  assert.equal(wx(63, { wind_gusts_10m: 70 }), 'stormy');
  assert.equal(wx(1, { wind_gusts_10m: 55 }), 'windy');
  assert.equal(wx(3, { wind_gusts_10m: 80 }), 'windy');                 // a dry gale blows; it doesn't storm
  assert.equal(wx(1, { wind_gusts_10m: 45 }), 'fair');
});

test('heat and frost', () => {
  assert.equal(wx(0, { temperature_2m: 29 }), 'very-dry');
  assert.equal(wx(0, { temperature_2m: 0 }), 'frost');
  assert.equal(wx(2, { temperature_2m: -4, cloud_cover: 50 }), 'frost');
  assert.equal(wx(3, { temperature_2m: -4 }), 'overcast');              // frost wants a clear or broken sky
  assert.equal(wx(0, { temperature_2m: 1 }), 'fair');
});

test('every answer is a weather the Inn has, and all twelve can come up', () => {
  const seen = new Set();
  for (let code = 0; code <= 99; code++) for (const t of [-5, 0, 14, 30]) for (const g of [10, 55, 70]) for (const cc of [10, 50, 90]) for (const p of [0, 1]) {
    const w = innWeather({ weather_code: code, temperature_2m: t, wind_gusts_10m: g, cloud_cover: cc, precipitation: p });
    assert.ok(world.weathers[w], `${w} for code ${code}`);
    seen.add(w);
  }
  assert.deepEqual([...seen].sort(), Object.keys(world.weathers).sort());
});
