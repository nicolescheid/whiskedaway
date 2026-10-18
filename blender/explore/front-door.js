// The front door at whiskedaway.com/ (docs/front-door-spec.md).
// The storybook picture of the Inn in its whisk; a click plays the film (blender/front_door_film.py)
// that swirls in through the front door and ends where the entrance-hall panorama takes over.
// On a first visit Gemma's welcome follows, then tucks itself into the brass bell in the top bar.
// The bell is there in every room and brings the welcome and help back.
//
// explore.html decides before first paint whether the door shows (window.__doorActive), then calls
// frontDoor(). The Inn's own script calls innShown(promise) once its first view is loading, waits on
// `entered` before Gemma's arrival question, and offers settle(fov) for the hand-over from the film.

import { sound } from './sound.js';
import { slowLink } from './data-budget.js';

const ASSETS = 'explore/assets/front-door/';
// The film's last frame is a 28 mm lens on a 36 mm sensor: its vertical view in degrees, before cropping to the screen
const FILM = { landscape: { w: 1920, h: 1080, vfov: 39.7 }, portrait: { w: 1080, h: 1920, vfov: 65.5 } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);

export function frontDoor({ active, track }) {
  let shownDone, enteredDone;
  const shown = new Promise(r => { shownDone = r; });
  const entered = new Promise(r => { enteredDone = r; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shape = matchMedia('(max-aspect-ratio: 3/2)').matches ? 'portrait' : 'landscape';
  let welcomed = false;
  try { welcomed = localStorage.getItem('wa-welcomed') === '1'; } catch { /* storage blocked: welcome every visit */ }

  // ---------- the bell
  const bell = $('btn-bell');
  bell.onclick = () => {
    ring();
    track('bell_ring', { room: window.__explore?.state.room });
    openWelcome({ help: true });
  };

  // ---------- the welcome card, built once
  let card = null;
  function buildCard() {
    card = document.createElement('div');
    card.className = 'tool';
    card.id = 'welcome';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'welcome-title');
    card.innerHTML = `
      <div class="box welcome">
        <div class="who"><img src="explore/assets/gemma-pixel.png" alt=""><h2 id="welcome-title">Welcome to the Inn, love.</h2></div>
        <p>Have a wander. Drag to look around, and touch anything that glows.</p>
        <p>I'll notice what you're drawn to and bring you something to cook. Doors with dials lead to the other rooms.</p>
        <p>What I notice stays in this tab. My notebook, up at the top, shows you all of it.</p>
        <div id="welcome-help">
          <p><b>Ring the bell any time.</b></p>
          <ul class="help">
            <li>Drag, or swipe on a phone, to look around.</li>
            <li>Touch anything that glows. A door with a dial beside it takes you to another room, and the star on the dial follows your wander.</li>
            <li>The map lists everything in the room you're in.</li>
            <li>My notebook shows what I've noticed. "Forget this visit" clears it.</li>
            <li>"Front door" takes you back outside.</li>
            <li>The speaker beside the bell turns the Inn's sounds on. They start off.</li>
          </ul>
        </div>
        <button class="ok" id="welcome-ok">Come in</button>
      </div>`;
    document.body.appendChild(card);
  }

  let closing = null;
  function openWelcome({ help = false } = {}) {
    if (!card) buildCard();
    if (card.classList.contains('open')) return closing;
    $('welcome-help').hidden = !help;
    $('welcome-ok').textContent = help ? 'Back to the Inn' : 'Come in';
    card.classList.add('open');
    $('welcome-ok').focus();
    closing = new Promise(done => {
      const close = async () => {
        removeEventListener('keydown', onKey);
        $('welcome-ok').onclick = null;
        await tuckIntoBell(card.querySelector('.box'));
        card.classList.remove('open');
        card.querySelector('.box').getAnimations().forEach(a => a.cancel());
        card.getAnimations().forEach(a => a.cancel());
        if (!welcomed) {
          welcomed = true;
          try { localStorage.setItem('wa-welcomed', '1'); } catch { /* fine */ }
        }
        track('welcome_close');
        bell.focus();
        done();
      };
      const onKey = e => { if (e.key === 'Escape') close(); };
      addEventListener('keydown', onKey);
      $('welcome-ok').onclick = close;
    });
    return closing;
  }

  // The card swirls up into the bell, spinning as it shrinks, and the bell rings as it lands
  async function tuckIntoBell(box) {
    const b = bell.getBoundingClientRect(), r = box.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height / 2 - (r.top + r.height / 2);
    card.animate([{ backgroundColor: 'rgba(20, 14, 10, .35)' }, { backgroundColor: 'rgba(20, 14, 10, 0)' }],
                 { duration: reduced ? 200 : 800, fill: 'forwards' });
    if (reduced) {
      await box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
    } else {
      // A curved path: out to one side and round, rather than a straight line
      const at = t => {
        const bend = Math.sin(Math.PI * t) * 0.35;
        return `translate(${dx * t - dy * bend}px, ${dy * t + dx * bend}px) rotate(${540 * t}deg) scale(${1 - 0.96 * t})`;
      };
      await box.animate([0, 0.25, 0.5, 0.75, 1].map(t => ({ transform: at(t), opacity: t < 0.8 ? 1 : 0.3 })),
                        { duration: 850, easing: 'cubic-bezier(.45, 0, .7, .2)', fill: 'forwards' }).finished;
    }
    ring();
  }

  function ring() {
    bell.classList.remove('ring');
    void bell.offsetWidth;
    bell.classList.add('ring');
    sound.bell();
  }

  const api = { active, entered, innShown: p => Promise.resolve(p).then(shownDone, shownDone) };

  // ---------- no door (a link straight to a room, or back in the same tab): just the welcome, if it's new
  if (!active) {
    shown.then(() => (welcomed ? null : openWelcome())).then(enteredDone);
    return api;
  }

  // ---------- the door
  const door = $('front-door'), button = $('fd-enter'), pic = door.querySelector('picture');
  const behind = [...document.body.children].filter(el => el !== door && el.tagName !== 'SCRIPT');
  behind.forEach(el => { el.inert = true; });
  track('door_view');

  let video = null;
  const short = reduced || slowLink;                     // no film: the picture fades into the hall (data-budget.js)
  function makeVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.preload = 'auto';
    video.src = `${ASSETS}film-${shape}.mp4`;
    button.prepend(video);                                // under the picture until it plays
    return video;
  }
  if (!short) {
    if (document.readyState === 'complete') setTimeout(makeVideo, 200);
    else addEventListener('load', () => setTimeout(makeVideo, 200), { once: true });
  }

  async function showHall() {
    const hall = new Image();
    hall.className = 'fd-hall';
    hall.alt = '';
    hall.src = `${ASSETS}hall-${shape}.webp`;
    button.append(hall);
    await hall.decode().catch(() => {});
    door.classList.add('short');
    await wait(550);
  }

  async function playFilm() {
    const v = makeVideo();
    door.classList.add('playing');
    if (v.readyState < 3) door.classList.add('waiting');
    let hush = () => {};
    v.addEventListener('playing', () => { door.classList.remove('waiting'); pic.style.visibility = 'hidden'; hush = sound.film(v.currentTime); }, { once: true });
    let skip;
    const skipped = new Promise(r => { skip = r; });
    const onKey = e => { if (e.key === 'Escape') skip(); };
    addEventListener('keydown', onKey);
    button.addEventListener('click', skip);
    const failed = new Promise(r => v.addEventListener('error', r, { once: true }));
    let ok = true;
    try { await v.play(); } catch { ok = false; }
    const how = ok ? await Promise.race([
      new Promise(r => v.addEventListener('ended', () => r('ended'), { once: true })),
      skipped.then(() => 'skipped'), failed.then(() => 'failed'),
    ]) : 'failed';
    removeEventListener('keydown', onKey);
    button.removeEventListener('click', skip);
    if (how !== 'ended') { hush(); v.pause(); await showHall(); }
  }

  // The film's last frame, cropped to this screen the way object-fit: cover crops it: the same view the panorama starts on
  function filmFov() {
    const f = FILM[shape];
    const scale = Math.max(innerWidth / f.w, innerHeight / f.h);
    const half = Math.atan(Math.tan(f.vfov * Math.PI / 360) * innerHeight / (f.h * scale));
    return half * 360 / Math.PI;
  }

  button.addEventListener('click', async () => {
    track('door_open', { film: short ? 'short' : 'full' });
    try { sessionStorage.setItem('wa-door-done', '1'); } catch { /* fine */ }
    const url = new URL(location.href);
    if (url.searchParams.has('door')) { url.searchParams.delete('door'); history.replaceState(null, '', url); }
    if (short) { sound.door(); await showHall(); }
    else await playFilm();
    await Promise.race([shown, wait(15000)]);           // the hall's first view (it has had the whole film to load)
    window.__explore?.settle(filmFov());
    behind.forEach(el => { el.inert = false; });
    door.classList.add('leaving');
    await wait(reduced ? 250 : 650);
    door.hidden = true;
    video?.removeAttribute('src');
    video?.load();
    if (!welcomed) await openWelcome();
    enteredDone();
  }, { once: true });

  return api;
}
