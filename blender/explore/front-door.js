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
  // Portrait or landscape film, and whether it fills the screen or sits whole on paper (explore.html sets this up)
  const layout = () => window.__doorLayout?.() ?? { shape: innerWidth <= innerHeight ? 'portrait' : 'landscape', fit: 'cover' };
  let shape = layout().shape;
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
        <div class="who"><img src="explore/assets/gemma/avatar-56.png" srcset="explore/assets/gemma/avatar-112.png 2x, explore/assets/gemma/avatar-168.png 3x" width="56" height="56" alt=""><h2 id="welcome-title">Welcome to the Inn, love.</h2></div>
        <p id="welcome-line">Have a wander. Start at the desk if you like.</p>
        <div id="welcome-intro">
          <p>Have a wander. Drag to look around, and touch anything that glows.</p>
          <p>I'll notice what you're drawn to and bring you something to cook. Doors with dials lead to the other rooms.</p>
          <p>What I notice stays in this tab. Open My recipe book and pick This visit to see all of it.</p>
        </div>
        <div id="welcome-help">
          <p><b>Ring the bell any time.</b></p>
          <ul class="help">
            <li>Drag, or swipe on a phone, to look around.</li>
            <li>Touch anything that glows. A door with a dial beside it takes you to another room, and the star on the dial follows your wander.</li>
            <li>The map lists everything in the room you're in.</li>
            <li>Open My recipe book and pick This visit to see what I've noticed. "Forget this visit" clears it.</li>
            <li>"Front door" takes you back outside.</li>
            <li>The speaker beside the bell turns the Inn's sounds on. They start off.</li>
          </ul>
          <p><a href="/?door=1#story">About the Inn</a>: what it is, where the weather comes from, and what's kept.</p>
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
    // First visit: one line, then Gemma's check-in offer in the chat (one opener, not three: checkin-views.md).
    // The bell brings back the full welcome and help
    $('welcome-line').hidden = help;
    const line = window.__explore?.lines?.checkin?.opener?.welcome;   // the content editor's words, when loaded
    if (line) $('welcome-line').textContent = line;
    $('welcome-intro').hidden = !help;
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
  {
    const u = new URL(location.href);
    if (u.searchParams.has('door')) { u.searchParams.delete('door'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
  }
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
    // Once the film is indoors, any bands around it turn from paper to the hall's dark
    video.addEventListener('timeupdate', () => { if (video.currentTime > 2.6) door.classList.add('indoors'); });
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
    door.classList.add('short', 'indoors');
    await wait(550);
  }

  async function playFilm() {
    if (video && layout().shape !== shape) { video.remove(); video = null; }   // the screen turned since the film preloaded
    shape = layout().shape;
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
    // After 2 s, a quiet "Tap to skip" (QA 3: nothing said a tap or Escape skips the 8 s film)
    const hint = document.createElement('p');
    hint.className = 'fd-skip'; hint.textContent = 'Tap to skip'; hint.hidden = true; hint.setAttribute('aria-hidden', 'true');
    door.querySelector('.fd-first').appendChild(hint);
    const hintT = setTimeout(() => { hint.hidden = false; }, 2000);
    // The same, for screen readers (the hint above is aria-hidden)
    const say = document.createElement('p');
    say.className = 'sr-only'; say.setAttribute('role', 'status');
    door.querySelector('.fd-first').appendChild(say);
    setTimeout(() => { say.textContent = 'The film is playing. Press Escape to skip it.'; }, 300);
    const failed = new Promise(r => v.addEventListener('error', r, { once: true }));
    let ok = true;
    try { await v.play(); } catch { ok = false; }
    const how = ok ? await Promise.race([
      new Promise(r => v.addEventListener('ended', () => r('ended'), { once: true })),
      skipped.then(() => 'skipped'), failed.then(() => 'failed'),
    ]) : 'failed';
    removeEventListener('keydown', onKey);
    button.removeEventListener('click', skip);
    clearTimeout(hintT); hint.remove(); say.remove();
    if (how !== 'ended') { hush(); v.pause(); await showHall(); }
  }

  // The film's last frame as this screen shows it (cropped by cover, or whole with bands by contain):
  // the same view the panorama starts on
  function filmFov() {
    const f = FILM[shape];
    const scale = (door.classList.contains('contain') ? Math.min : Math.max)(innerWidth / f.w, innerHeight / f.h);
    const half = Math.atan(Math.tan(f.vfov * Math.PI / 360) * innerHeight / (f.h * scale));
    return half * 360 / Math.PI;
  }

  // ---------- the story below the picture (homepage-story-ux.md): a link down to it, "Step inside" while reading,
  // the credits from its footer, and two counts: the story seen, and the link used
  const how = $('fd-how'), pill = $('fd-pill'), first = door.querySelector('.fd-first');
  // With sound, chosen at the door (W2): the film then comes with its whoosh and latch, and the Inn arrives with sound on.
  // Inside the tap, so the browser lets the sound start
  const soundBtn = $('fd-sound');
  const showSound = () => { soundBtn.setAttribute('aria-pressed', String(sound.on)); soundBtn.querySelector('span').textContent = sound.on ? 'Sound on' : 'Sound off'; };
  if (soundBtn) {
    showSound();
    soundBtn.addEventListener('click', () => { sound.toggle(); showSound(); });
    addEventListener('wa-sound', showSound);
  }
  // Scrolled here rather than followed: the page's <base href="/explore/"> would turn "#story" into another page
  // ('auto' would mean the layer's CSS smooth scrolling, so a jump asks for 'instant')
  const toStory = smooth => $('story')?.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'instant', block: 'start' });
  how?.addEventListener('click', e => {
    e.preventDefault();
    toStory(true);
    $('story-what')?.focus({ preventScroll: true });
    track('story_link');
  });
  // The bell card's "About the Inn" link (/?door=1#story) opens on the story, not the picture
  if (location.hash === '#story') {
    const land = () => toStory(false);
    land();
    if (document.readyState !== 'complete') addEventListener('load', land, { once: true });   // again once the picture has its size
  }
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { track('story_view'); seen.disconnect(); }
    }, { root: door, threshold: 0.5 });
    const lead = $('story-what');
    if (lead) seen.observe(lead);
    // The pill shows once the picture has scrolled mostly out of view, and steps aside at the footer,
    // which has its own Step inside
    let pictureOut = false, footIn = false;
    const setPill = () => {
      const show = pictureOut && !footIn;
      pill.classList.toggle('show', show);
      pill.tabIndex = show ? 0 : -1;
      pill.setAttribute('aria-hidden', String(!show));
    };
    new IntersectionObserver(([e]) => { pictureOut = !e.isIntersecting; setPill(); }, { root: door, threshold: 0.15 }).observe(first);
    const foot = door.querySelector('.fd-foot');
    if (foot) new IntersectionObserver(([e]) => { footIn = e.isIntersecting; setPill(); }, { root: door }).observe(foot);
  }
  const fromStory = () => { door.style.scrollBehavior = 'auto'; door.scrollTop = 0; enter('story'); };
  pill.addEventListener('click', fromStory);
  $('fd-step')?.addEventListener('click', fromStory);
  $('fd-credits')?.addEventListener('click', () => {
    const credits = $('credits');
    if (!credits) return;
    credits.inert = false;
    credits.style.zIndex = '60';                         // above the door
    credits.classList.add('open');
    $('credits-ok')?.focus();
  });

  let entering = false;
  button.addEventListener('click', () => enter('picture'));
  async function enter(from) {
    if (entering) return;
    entering = true;
    track('door_open', { film: short ? 'short' : 'full', from });
    door.dataset.locked = '1';                            // the fit stays put from here, whatever the window does
    if (short) shape = layout().shape;
    try { sessionStorage.setItem('wa-door-done', '1'); } catch { /* fine */ }
    if (short) { sound.door(); await showHall(); }
    else await playFilm();
    await Promise.race([shown, wait(15000)]);           // the hall's first view (it has had the whole film to load)
    window.__explore?.settle(filmFov());
    history.replaceState(history.state, '', location.pathname + location.search);   // inside now: no #story,
    window.__explore?.showRoomInUrl?.();                                              // and the address names the room
    behind.forEach(el => { el.inert = false; });
    door.classList.add('leaving');
    await wait(reduced ? 250 : 650);
    door.hidden = true;
    video?.removeAttribute('src');
    video?.load();
    if (!welcomed) await openWelcome();
    enteredDone();
  }

  return api;
}
