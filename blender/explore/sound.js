// The Inn's sound (docs: the sound plan in the team notes, stage A).
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
function note(f, at, { gain = 0.05, decay = 0.5, partials = [[1, 1], [2, 0.25]], type = 'sine' } = {}) {
  for (const [mult, share] of partials) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * share, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + decay + 0.05);
  }
}

function play(fn) {
  if (!on) return;
  try { if (audio()) fn(ctx.currentTime + 0.01); } catch { /* no audio available: the Inn still works */ }
}

let lastShimmer = -Infinity;
export const sound = {
  get on() { return on; },

  set(value) {
    on = !!value;
    try { on ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (on) audio();                        // inside the click, so the browser allows it
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
  tick() {
    play(t => {
      const len = Math.floor(ctx.sampleRate * 0.025);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf;
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
      g.gain.value = 0.35;
      src.connect(bp).connect(g).connect(master);
      src.start(t);
    });
  },
};
