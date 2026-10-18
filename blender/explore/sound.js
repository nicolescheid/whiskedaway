// The Inn's sound (docs: the sound plan in the team notes, stages A to D).
// Off until the visitor turns it on with the speaker chip by the bell (or "Sound" in Gemma's chat).
// The choice lives in this tab only, like the rest of the visit. Everything here is synthesised in
// Web Audio: no files to fetch, nothing to license, nothing to fail on a phone. Recordings may join later.
//
// One AudioContext for the whole Inn, made on the first gesture that turns sound on, and one master
// gain under it so every sound sits at a gentle level.
//
// Recorded files (none yet) go through recording(), which follows the Inn's low-data rule
// (explore/data-budget.js): with saveData nothing optional is fetched, and nothing ever waits on audio.

import { saveData } from './data-budget.js';

const KEY = 'wa-sound';
let on = false;
try { on = sessionStorage.getItem(KEY) === '1'; } catch { /* storage blocked: stays off */ }

let ctx = null, master = null;
// Sound was already on in this tab (a reload, another room): wake the audio on the first touch,
// since browsers won't start it without one
if (on) addEventListener('pointerdown', () => audio(), { once: true, capture: true });
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One soft bell-like note: a sine with a quiet octave above it, struck and left to ring
function note(f, at, { gain = 0.05, decay = 0.5, partials = [[1, 1], [2, 0.25]], type = 'sine', out = master } = {}) {
  for (const [mult, share] of partials) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * share, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + decay + 0.05);
  }
}

// A burst of filtered noise: the stuff of clicks, latches and clock ticks
let noiseBuf = null;
function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function noise(at, { len = 0.025, freq = 2400, q = 3, gain = 0.35, out = master } = {}) {
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(out);
  src.start(at, Math.random() * 0.5, len + 0.02);
}

// An old wooden door: the latch lifts and drops, a soft knock of the frame, a short low creak
function latch(t, out = master) {
  noise(t, { len: 0.02, freq: 3200, q: 2, gain: 0.3, out });
  noise(t + 0.075, { len: 0.035, freq: 1700, q: 2.5, gain: 0.4, out });
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(130, t + 0.075);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  g.gain.setValueAtTime(0.14, t + 0.075);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(out);
  o.start(t + 0.075); o.stop(t + 0.3);
  // the creak: a slow, wobbling sawtooth through a narrow wooden band, kept very quiet
  const c = ctx.createOscillator(), wob = ctx.createOscillator(), wg = ctx.createGain(), bp = ctx.createBiquadFilter(), cg = ctx.createGain();
  c.type = 'sawtooth'; c.frequency.value = 85;
  wob.frequency.value = 7; wg.gain.value = 18;
  wob.connect(wg).connect(c.frequency);
  bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 9;
  cg.gain.setValueAtTime(0, t + 0.2);
  cg.gain.linearRampToValueAtTime(0.03, t + 0.45);
  cg.gain.linearRampToValueAtTime(0, t + 0.95);
  c.connect(bp).connect(cg).connect(out);
  c.start(t + 0.2); wob.start(t + 0.2); c.stop(t + 1); wob.stop(t + 1);
}

// A deep clock bell: a bell's out-of-tune partials (hum, prime, tierce, quint, nominal), struck
function gong(t, f = 196, gain = 0.07) {
  note(f, t, { gain, decay: 2.6, partials: [[0.5, 0.35], [1, 1], [1.19, 0.3], [1.5, 0.2], [2, 0.45], [2.74, 0.12]] });
}

function play(fn) {
  if (!on) return;
  try { if (audio()) fn(ctx.currentTime + 0.01); } catch { /* no audio available: the Inn still works */ }
}

let lastShimmer = -Infinity;

// The grandfather clock: tick-tock once a second while you're in the hallway
let place = null, tickTimer = null, nextBeat = 0, beat = 0;
const hallway = () => /^hall-/.test(place || '');
function startTicking() {
  if (tickTimer || !on || !hallway() || !audio()) return;
  nextBeat = ctx.currentTime + 0.1;
  tickTimer = setInterval(() => {
    if (ctx.state !== 'running') return;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05;   // the tab slept: pick up the beat again
    while (nextBeat < ctx.currentTime + 0.4) {
      const tock = beat++ % 2;
      noise(nextBeat, { len: 0.03, freq: tock ? 1900 : 2600, q: 4, gain: 0.12 });
      noise(nextBeat, { len: 0.06, freq: 420, q: 1.5, gain: 0.08 });     // the wooden case
      nextBeat += 1;
    }
  }, 200);
}
function stopTicking() { clearInterval(tickTimer); tickTimer = null; }
let striking = [];
function stopStriking() { striking.forEach(clearTimeout); striking = []; }

// ---------- ambience: each room's quiet bed, which follows the barometer (stage C)
// A bed is a few layers: steady ones (filtered noise, sometimes swaying) and scattered ones
// (drops, crackles, chirps, chimes, bubbles) fired at random by one scheduler.

// Steady filtered noise, optionally swaying in pitch and level: rain's hiss, wind, the sea, the fire's roar
function hiss(out, { type = 'bandpass', freq = 1000, q = 0.7, gain = 0.02, sway = 0, swayHz = 0.1, swell = 0, swellHz = 0.12 }) {
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer(); src.loop = true;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(out);
  const lfos = [];
  const lfo = (hz, depth, target) => {
    const o = ctx.createOscillator(), d = ctx.createGain();
    o.frequency.value = hz * (0.8 + Math.random() * 0.4); d.gain.value = depth;
    o.connect(d).connect(target); o.start(t); lfos.push(o);
  };
  if (sway) lfo(swayHz, sway, f.frequency);
  if (swell) lfo(swellHz, gain * swell, g.gain);
  src.start(t, Math.random());
  return [src, ...lfos];
}

const rnd = (a, b) => a + Math.random() * (b - a);
// Scattered sounds: each fires at time t and returns how long until it would like to fire again
const SCATTER = {
  drop: (out, k) => t => {                        // rain on glass: a tick and a tiny ping
    noise(t, { len: 0.012, freq: rnd(2500, 6000), q: 2, gain: 0.05 * k, out });
    if (Math.random() < 0.3) note(rnd(1800, 3200), t, { gain: 0.006 * k, decay: 0.08, partials: [[1, 1]], out });
    return rnd(0.04, 0.25) / k;
  },
  drip: (out, k) => t => {                        // mist: now and then a drop falls from the eaves
    note(rnd(900, 1500), t, { gain: 0.012 * k, decay: 0.12, partials: [[1, 1]], out });
    return rnd(1.5, 5);
  },
  crackle: (out, k) => t => {                     // the hearth
    const pops = Math.random() < 0.15 ? 3 : 1;
    for (let i = 0; i < pops; i++) noise(t + i * rnd(0.01, 0.04), { len: rnd(0.004, 0.02), freq: rnd(1200, 4500), q: 1.5, gain: rnd(0.04, 0.14) * k, out });
    return rnd(0.08, 0.7);
  },
  bubble: (out, k) => t => {                      // a flask, or a pot just simmering
    const o = ctx.createOscillator(), g = ctx.createGain(), f = rnd(250, 600);
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rnd(1.8, 2.6), t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.08);
    return rnd(0.15, 1.2) / k;
  },
  bird: (out, k) => t => {                        // a few chirps from the garden
    const n = Math.floor(rnd(2, 5)), base = rnd(2600, 3800);
    for (let i = 0; i < n; i++) {
      const at = t + i * rnd(0.09, 0.16), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(base, at); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.5), at + 0.06);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.012 * k, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      o.connect(g).connect(out); o.start(at); o.stop(at + 0.1);
    }
    return rnd(2.5, 8);
  },
  chime: (out, k) => t => {                       // the wind chime by the garden door: a pentatonic in D
    const notes = [1174.7, 1318.5, 1480, 1760, 1975.5, 2349.3];
    const n = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) note(notes[Math.floor(Math.random() * notes.length)], t + i * rnd(0.1, 0.4),
      { gain: 0.014, decay: 2.2, partials: [[1, 1], [2.76, 0.2], [5.4, 0.06]], out });
    return rnd(3, 9) / k;
  },
  bee: (out, k) => t => {                         // a bee drifting past, then gone
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), dur = rnd(2, 4);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(190, 240), t); o.frequency.linearRampToValueAtTime(rnd(190, 240), t + dur);
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.006 * k, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    return dur + rnd(3, 10);
  },
};

// What each room sounds like, in this weather, at this hour, in this season
function recipe(room, weather, { night = false, season = null } = {}) {
  const wet = weather === 'rain' || weather === 'stormy', storm = weather === 'stormy', mist = weather === 'change';
  const L = { steady: [], scatter: [] };
  const rain = (k = 1) => {
    k *= storm ? 1.6 : 1;
    L.steady.push({ type: 'highpass', freq: 900, q: 0.5, gain: 0.012 * k });
    L.scatter.push(['drop', k]);
  };
  const wind = (k = 1) => L.steady.push({ freq: 420, q: 0.8, gain: 0.03 * k, sway: 220, swayHz: 0.08, swell: 0.8, swellHz: 0.07 });
  if (room === 'cuddlecore' || room === 'flourish') {
    if (room === 'cuddlecore') { L.steady.push({ type: 'lowpass', freq: 260, q: 0.5, gain: 0.03 }); L.scatter.push(['crackle', 1]); }   // the hearth
    else { L.steady.push({ type: 'lowpass', freq: 180, q: 0.5, gain: 0.02 }); L.scatter.push(['bubble', 0.5]); }   // the range, simmering
    if (wet) rain(0.7);
    if (storm) wind(0.8);
    if (mist) L.scatter.push(['drip', 0.8]);
    if (weather === 'fair' && !night) L.scatter.push(['bird', 0.5]);
  } else if (room === 'glasshouse') {
    if (wet) rain(1.2);
    if (storm) wind(0.7);
    if (mist) L.scatter.push(['drip', 1]);
    L.scatter.push(['chime', storm ? 1.6 : 1]);
    if (!wet && !night) {
      L.scatter.push(['bird', 1]);
      if (season !== 'winter' && !mist) L.scatter.push(['bee', 1]);
    }
  } else if (room === 'sweet-spells') {
    L.steady.push({ type: 'lowpass', freq: 520, q: 0.6, gain: mist ? 0.015 : 0.025, swell: 0.9, swellHz: 0.13 });   // the sea down the lane
    if (wet) rain(0.8);
    if (storm) wind(1);
    if (mist) L.scatter.push(['drip', 0.6]);
  } else if (room === 'chiapothecary') {
    L.scatter.push(['bubble', 1]);                // the flasks
    if (wet) rain(0.6);
    if (storm) wind(0.6);
    if (mist) L.scatter.push(['drip', 0.6]);
  } else {
    return null;                                  // the hallway: the clock is enough
  }
  return L;
}

let scene = null, bed = null, bedTimer = null;
function stopBed(fade = 1.5) {
  if (!bed) return;
  const { out, nodes } = bed;
  out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
  setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, fade * 1000 + 200);
  bed = null;
}
function startBed() {
  const L = on && scene ? recipe(scene.room, scene.weather, scene) : null;
  const key = L && JSON.stringify(L);
  if (bed && bed.key === key) return;            // same sound as now: leave it playing
  stopBed();
  if (!L || !audio()) return;
  const out = ctx.createGain(), t = ctx.currentTime;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 1.5);
  out.connect(master);
  const nodes = L.steady.flatMap(opts => hiss(out, opts));
  const scatter = L.scatter.map(([name, k]) => ({ fire: SCATTER[name](out, k), next: t + rnd(0.2, 2) }));
  bed = { key, out, nodes, scatter };
  if (!bedTimer) bedTimer = setInterval(() => {
    if (!bed || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const s of bed.scatter) {
      if (s.next < now) s.next = now + 0.05;      // the tab slept: carry on from here
      while (s.next < now + 0.4) s.next += s.fire(s.next);
    }
  }, 150);
}

// ---------- music (stage D): things in the rooms that play when you touch them
// The music box in Sweet Spells: steel tines plucked by a turning drum. The tunes are public-domain
// compositions written out here note by note, so there's no recording to license.
// Notation: NOTE:length, in the tune's unit; R is a rest.
const TUNES = {
  // Any weather: Mozart's "Ah vous dirai-je, maman" (the tune of "Twinkle, Twinkle"). Unit: a crotchet
  twinkle: { unit: 0.42, up: 12, voices: [
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2',
    'C3:2 C3:2 F3:2 C3:2 F3:2 C3:2 G3:2 C3:2 C3:2 G3:2 C3:2 G3:2 C3:2 G3:2 C3:2 G3:2 C3:2 C3:2 F3:2 C3:2 F3:2 C3:2 G3:2 C3:2'] },
  // Rain: Beethoven, Für Elise, the opening. Unit: a semiquaver
  elise: { unit: 0.16, up: 0, voices: [
    'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:3 C4 E4 A4 B4:3 E4 G#4 B4 C5:3 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4:3 C4 E4 A4 B4:3 E4 C5 B4 A4:6',
    'R:8 A3 E4 A4 R:3 E3 E4 G#4 R:3 A3 E4 A4 R:3 R:6 A3 E4 A4 R:3 E3 E4 G#4 R:3 A3 E4 A4 R:3'] },
  // Night: Brahms, Lullaby (Wiegenlied, Op. 49 No. 4). Unit: a quaver
  brahms: { unit: 0.33, up: 12, voices: [
    'E4 E4 G4:4 E4 E4 G4:4 E4 G4 C5:3 B4 A4:2 A4:2 G4:2 D4 E4 F4:2 D4:2 D4 E4 F4:4 D4 F4 B4 A4 G4:2 B4:2 C5:4 C4 C4 C5:4 A4 F4 G4:4 E4 C4 F4:2 G4:2 A4:2 G4:4 C4 C4 C5:4 A4 F4 G4:4 E4 C4 F4:2 E4:2 D4:2 C4:6',
    'R:2 C3:6 C3:6 F3:6 C3:6 G3:6 G3:6 G3:6 C3:6 F3:6 C3:6 F3:6 C3:6 F3:6 C3:6 G3:6 C3:6'] },
};
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function parseTune({ unit, up, voices }) {
  const events = [];
  let total = 0;
  for (const voice of voices) {
    let at = 0;
    for (const tok of voice.trim().split(/\s+/)) {
      const [name, len = '1'] = tok.split(':');
      const m = /^([A-G])(#?)(\d)$/.exec(name);
      if (m) events.push({ t: at * unit, f: 440 * 2 ** ((12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] ? 1 : 0) + up - 69) / 12) });
      at += +len;
    }
    total = Math.max(total, at * unit);
  }
  return { events: events.sort((a, b) => a.t - b.t), total };
}
// A tine: bright, quick to speak, ringing on; the higher it is, the sooner it fades
function tine(f, t, out) {
  note(f, t + rnd(-0.006, 0.006), { gain: 0.05, decay: Math.min(1.6, 900 / f), partials: [[1, 1], [2, 0.12], [4.2, 0.06]], out });
}

// A recorded file, decoded and kept for the visit. Resolves to null, never throws, when there's no file to
// play: Data Saver or a 2G link, a failed fetch, or anything that isn't audio (a missing file comes back
// as the Inn's own page, with a 200; that's how the old uh-oh failed). Callers never wait on it to show anything.
const recordings = new Map();
function recording(url) {
  if (saveData || !audio()) return Promise.resolve(null);
  if (!recordings.has(url)) recordings.set(url, fetch(url)
    .then(r => r.ok && /^audio\//.test(r.headers.get('content-type') || '') ? r.arrayBuffer() : null)
    .then(b => b && ctx.decodeAudioData(b))
    .catch(() => null));
  return recordings.get(url);
}

// Things that play. `pick` chooses a written-out tune; `src` (optional) chooses a recorded file, which takes
// over when it has loaded. With no file (low data, or it failed), the tune plays, or, without a tune, nothing.
const MUSIC = {
  'music-box': { room: 'sweet-spells', pick: s => s?.night ? 'brahms' : s?.weather === 'rain' || s?.weather === 'stormy' ? 'elise' : 'twinkle' },
};
let playing = null;                              // { id, out, tune, start, i, timer }
function stopMusic(fade = 0.6) {
  if (!playing) return;
  clearInterval(playing.timer);
  const { out, src } = playing;
  out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
  setTimeout(() => { try { src?.stop(); } catch { /* not started */ } out.disconnect(); }, fade * 1000 + 300);
  playing = null;
}
function startMusic(id) {
  stopMusic(0.2);
  if (!on || !audio()) return;
  const out = ctx.createGain();
  out.connect(master);
  const m = MUSIC[id], p = { id, out, start: ctx.currentTime + 0.15, i: 0 };
  playing = p;
  if (m.src) recording(m.src(scene)).then(buf => {
    if (!buf || playing !== p) return;
    clearInterval(p.timer);                        // the recording takes over from the written-out tune
    p.src = ctx.createBufferSource();
    p.src.buffer = buf; p.src.loop = true;
    p.src.connect(out);
    p.src.start();
  });
  if (!m.pick) return;
  p.tune = parseTune(TUNES[m.pick(scene)]);
  p.timer = setInterval(() => {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (p.start + p.tune.total < now - 1) { p.start = now + 0.1; p.i = 0; }   // the tab slept: start the tune again
    while (true) {
      const ev = p.tune.events[p.i];
      if (!ev) {                                   // the end of the tune: a breath, then again, in whatever suits the weather now
        p.start += p.tune.total + 1.6;
        p.tune = parseTune(TUNES[m.pick(scene)]);
        p.i = 0;
        continue;
      }
      if (p.start + ev.t > now + 0.5) break;
      tine(ev.f, p.start + ev.t, out);
      p.i++;
    }
  }, 100);
}

// A hidden tab goes quiet (and stops using the battery), and picks up again when you come back
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ctx || !on) return;
  document.hidden ? ctx.suspend() : ctx.resume();
});
export const sound = {
  get on() { return on; },

  set(value) {
    on = !!value;
    try { on ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (on) { audio(); startTicking(); startBed(); } else { stopTicking(); stopStriking(); stopBed(0.4); stopMusic(0.3); }   // inside the click, so the browser allows it
    dispatchEvent(new CustomEvent('wa-sound', { detail: on }));
  },
  toggle() { this.set(!on); if (on) { lastShimmer = -Infinity; this.shimmer(); } },

  // Gemma's shimmer: a wish arriving. A quick rising E-major arpeggio with a sparkle on top.
  shimmer() {
    if (performance.now() - lastShimmer < 2500) return;
    lastShimmer = performance.now();
    play(t => {
      [1318.5, 1661.2, 1975.5, 2637].forEach((f, i) => {
        note(f, t + i * 0.055, { gain: 0.045 - i * 0.006, decay: 0.55 + i * 0.1 });
        note(f * 1.003, t + i * 0.055 + 0.012, { gain: 0.012, decay: 0.4, partials: [[1, 1]] });   // a hair of detune: glitter
      });
      note(5274, t + 0.24, { gain: 0.008, decay: 0.7, partials: [[1, 1]] });
    });
  },

  // The brass bell in the top bar, rung twice
  bell() {
    play(t => {
      for (const at of [0, 0.2]) note(1318.5, t + at, { gain: 0.09, decay: 1.2, partials: [[1, 1], [2, 0.4], [3, 0.15]] });
    });
  },

  // A dial clicking round one notch: a tiny filtered noise burst
  tick() { play(t => noise(t)); },

  // Through a door
  door() { play(t => latch(t)); },

  // The front-door film (24 fps: 2.5 s of swirl, a 0.5 s dissolve, then the door opens). A rush of
  // air that swells as the picture spins in, and the latch as the door opens. `at` is where the film
  // is now, in seconds. Returns a stop, for when the film is skipped.
  film(at = 0) {
    let out = null;
    play(t => {
      out = ctx.createGain();
      out.connect(master);
      const t0 = t - at, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuffer(); src.loop = true;
      bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(260, t0);
      bp.frequency.exponentialRampToValueAtTime(2200, t0 + 2.4);
      bp.frequency.exponentialRampToValueAtTime(700, t0 + 3.1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.11, t0 + 2.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
      src.connect(bp).connect(g).connect(out);
      src.start(t); src.stop(t0 + 3.3);
      if (t0 + 3.15 > t) latch(t0 + 3.15, out);
    });
    return () => { if (out) { out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => out.disconnect(), 400); } };
  },

  // Which room the visitor is in: the grandfather clock ticks in the hallway
  place(id) {
    place = id;
    if (hallway()) startTicking(); else { stopTicking(); stopStriking(); }
    if (playing && MUSIC[playing.id].room !== id) stopMusic(1.2);   // the music stays in its room
  },

  // Touch a thing that plays (the music box): starts it, or stops it if it's playing.
  // Returns whether it's playing now. With sound off it stays quiet.
  music(id) {
    if (!MUSIC[id] || !on) return false;
    try {
      if (playing?.id === id) { stopMusic(); return false; }
      startMusic(id);
      return !!playing;
    } catch { return false; }
  },

  // The room's ambience: call whenever the room, the weather, the hour or the season changes
  ambience(room, weather, { night = false, season = null } = {}) {
    scene = { room, weather, night, season };
    try { startBed(); } catch { /* no audio: no matter */ }
  },

  // The grandfather clock strikes the hour (1 to 12 times), if you're in the hallway to hear it
  strike(hour) {
    stopStriking();
    if (!on || !hallway()) return;
    const n = (Math.round(hour) % 12) || 12;
    for (let i = 0; i < n; i++) striking.push(setTimeout(() => play(t => gong(t)), 600 + i * 1700));
  },
};
