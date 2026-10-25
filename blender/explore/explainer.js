// The ideas explainer and first-visit nudges (Nicole, 25 Oct). Three short beats from Gemma, each once per browser and each
// when it's relevant: (a) the first bubble, (b) the first idea opened, (c) the first basket add. Also the first bubble's
// one-off bounce, and the sound button's "look at me" at the start of a visit.
//   - once per browser: localStorage `wa-explained` { a, b, c, free, bounce }; storage blocked: once per page load
//   - nothing speaks or moves over the first-visit tour, its unanswered offer, the front door or any open layer: it waits
//     (a, the bounce and the sound look poll for a quiet moment; b and c answer a tap the visitor has just made)
//   - the daily allowance in beat c is WRITE_CAP (writeout.js), the number the code itself uses; lines that carry it are
//     tagged "policy": "daily-allowance" in gemma-lines.json `explain`
// Lines are content's: gemma-lines.json `explain`; STAND_IN covers any missing.
import { sound } from './sound.js';
import { layers } from './layers.js';
import { WRITE_CAP } from './writeout.js';

const KEY = 'wa-explained';
const LOOKED = 'wa-sound-looked';                 // sessionStorage: the sound button has had its nudge this visit
const GAP = 3600;                                 // ms between the lines of one beat
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const STAND_IN = {
  a: { lines: ['These are my ideas for you.', 'Tap a bubble to take a look.'] },
  b: { lines: ['Like it? Tap ♥ Keep. Not for you? Tap Not this.', 'Not this teaches me too.', 'Kept ideas go in your basket.'],
       touch: ['Like it? Swipe right, or tap ♥ Keep.', 'Not for you? Swipe left. That teaches me too.', 'Kept ideas go in your basket.'] },
  c: { lines: ["That's in your basket.", 'At checkout I write up to {n} a day out in full, in your book.', 'I tailor each one to you. What you keep stays on this device.', 'I learn as you wander, and from what you tell me, like Your kitchen or Dietary needs.'] },
  free: { lines: ["This one needs nothing from me.", 'It goes in your book free, as it is.', 'Or I can write it out for you instead.'] },
  sound: 'Sound?',
};

export function install(inn) {
  const X = { ...STAND_IN, ...(inn.LINES.explain || {}) };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = {};                                  // what's been explained (in memory when storage is blocked)
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* once per page load */ }
  const mark = k => { done[k] = 1; try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* fine */ } };
  const allowanceWord = () => WORDS[WRITE_CAP] || String(WRITE_CAP);
  const linesOf = (k, touch) => ((touch && X[k].touch) || X[k].lines).map(l => l.replace('{n}', allowanceWord()));

  // A quiet moment: not in the film, not touring, no unanswered tour offer, nothing open
  const tourOffered = () => !!inn.tour?.offering;
  const quiet = () => inn.$('front-door').hidden && !inn.touring && !tourOffered() && !layers.any && !document.hidden;

  let timers = [], playing = false;
  /** Say a beat, a line at a time. keep: true leaves an open question's chips (the check-in offer) alone */
  function play(k, { touch = false } = {}) {
    const lines = linesOf(k, touch);
    mark(k);
    playing = true;
    inn.track('explain_beat', { beat: k });
    timers.forEach(clearTimeout);
    timers = [];
    inn.holdLine?.((lines.length - 1) * GAP + 3000);       // the navigator and the usual lines wait until the beat has played through
    lines.forEach((text, i) => {
      const go = () => {
        if (inn.touring) return;
        inn.say(text, [], true, { keep: true });
        inn.holdLine?.();
        if (i === lines.length - 1) playing = false;
      };
      i ? timers.push(setTimeout(go, i * GAP)) : go();
    });
    return true;
  }

  const bubble = () => inn.$('ideas')?.querySelector('.idea[data-atom]');
  // The first bubble's one-off nudge: a soft bounce, or with reduced motion a soft glow
  function nudgeBubble(el) {
    mark('bounce');
    const cls = reduce() ? 'ex-glow' : 'ex-bounce';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 2800);
  }

  // The sound button's look-at-me, once a visit: a soft glow and a "Sound?" label for a few seconds, then it settles.
  // With reduced motion the label alone (no movement)
  let looked = false;
  try { looked = sessionStorage.getItem(LOOKED) === '1'; } catch { /* once per page load */ }
  function soundLook() {
    looked = true;
    try { sessionStorage.setItem(LOOKED, '1'); } catch { /* fine */ }
    const btn = inn.$('btn-sound');
    const q = document.createElement('span');
    q.className = 'sound-q';
    q.setAttribute('aria-hidden', 'true');            // the button's own label says it; this is a glance for sighted visitors
    q.textContent = X.sound;
    document.body.append(q);
    const r = btn.getBoundingClientRect();           // under the button, wherever the bar has put it
    q.style.top = `${Math.round(r.bottom + 3)}px`;
    q.style.right = `${Math.round(innerWidth - r.right)}px`;
    if (!reduce()) btn.classList.add('look');
    setTimeout(() => { btn.classList.remove('look'); q.remove(); }, 5000);
  }

  function tick() {
    if (!quiet()) return;
    const el = bubble();
    if (el && !done.bounce) nudgeBubble(el);
    if (el && !done.a) { setTimeout(() => quiet() && !done.a && play('a'), done.bounce ? 0 : 700); return; }
    if (!looked && !sound.on) soundLook();
  }
  // Poll gently until there is nothing left to wait for
  const poll = setInterval(() => {
    tick();
    if (done.a && done.bounce && (looked || sound.on)) clearInterval(poll);
  }, 1500);

  let opened = false;
  inn.explain = {
    /** The first idea opened (serving.js onHighlight). Returns true if beat b spoke, so the swipe hint isn't said twice */
    opened(touch) {
      if (!opened) { opened = true; inn.track('first_idea_open', { beat_a: done.a ? 'yes' : 'no' }); }   // once a visit
      return done.b ? false : play('b', { touch });
    },
    /** The first add to the basket (serving.js keepIdea). Returns true if she spoke, so her usual first-keep line steps aside */
    basketAdd() { return done.c ? false : play('c'); },
    /** The first complete card kept (it can go into the book free): one line on that, once per browser */
    freeCard() { return done.free ? false : play('free'); },
    get playing() { return playing; },
    done: () => ({ ...done }),
  };
}
