// The Inn's sound (docs: the sound plan in the team notes, stages A and B).
// Off until the visitor turns it on with the speaker chip by the bell (or "Sound" in Gemma's chat).
// The choice lives in this tab only, like the rest of the visit. Everything here is synthesised in
// Web Audio: no files to fetch, nothing to license, nothing to fail on a phone.
//
// One AudioContext for the whole Inn, made on the first gesture that turns sound on, and one master
// gain under it so every sound sits at a gentle level.

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
export const sound = {
  get on() { return on; },

  set(value) {
    on = !!value;
    try { on ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (on) { audio(); startTicking(); } else { stopTicking(); stopStriking(); }   // inside the click, so the browser allows it
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
  },

  // The grandfather clock strikes the hour (1 to 12 times), if you're in the hallway to hear it
  strike(hour) {
    stopStriking();
    if (!on || !hallway()) return;
    const n = (Math.round(hour) % 12) || 12;
    for (let i = 0; i < n; i++) striking.push(setTimeout(() => play(t => gong(t)), 600 + i * 1700));
  },
};
