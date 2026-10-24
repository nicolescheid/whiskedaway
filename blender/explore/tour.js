// The first-visit tour (Nicole, 23–24 Oct; first-visit-tour.md, tour-plan.md). After the door film, on a first visit only,
// Gemma offers to show the visitor round. The tour is a walk on today's renders: at each door she says one line and the door
// glows, with Next and Skip and a dot row. It passes through the Chiapothecary to the Conservatory and the garden door, says
// once that the bar's Map goes anywhere, and ends at the foyer desk with why to check in.
//   - a layer over a live room (layers.js, modal: false): Escape and Back end it like Skip; a tap on a door (or anything) ends
//     it and the tap goes on, so you walk straight in; so does walking off by the Inn map
//   - rooms it walks through are entered quietly (goRoom { quiet }), and resting on its doors isn't lingering (inn.touring),
//     so the tour never steers what Gemma serves
//   - first visit: localStorage wa-tour-offered, set once offered (storage blocked: offered each visit, like the welcome).
//     "Show me round" on the bell's card starts it for anyone (front-door.js sends wa-tour)
// Gemma's lines are content's: gemma-lines.json `tour`; these stand in for any it doesn't have.
import { sound } from './sound.js';
import { layers } from './layers.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const OFFERED = 'wa-tour-offered';
const STAND_IN = {
  offer: "First time at the Inn? I can show you round. It takes a minute.",
  yes: 'Yes, give me the tour',
  started: 'This way, then.',
  no: "It's ok, I'll explore by myself",
  declined: "Right you are. Check in at the desk if you like. It helps me pick for you.",
  skipped: "Right you are. Ring the bell for the tour any time. Check in at the desk if you like.",
  later: "Right you are. The desk's here whenever you want it.",
  next: 'Next', skip: 'Skip', checkin: 'Check in', notNow: 'Later', of: '{n} of {m}',
  stops: {
    cuddlecore: "Cuddlecore. For days you're not at your best: gentle food, little effort.",
    flourish: "Flourish. Proper meals from whole foods, when you've a bit more time.",
    'sweet-spells': 'Sweet Spells. For the sweet tooth.',
    chiapothecary: 'The Chiapothecary. Chia, your way, set ahead.',
    conservatory: 'Through here, the Conservatory. Herbs, the seasons, and the garden through the glass.',
    garden: 'And the garden, for cooking outdoors. The Map up top takes you to any room.',
    desk: "Last stop. Check in here and I'll only suggest things that fit. It takes 20 seconds.",
  },
};
// The walk: which stop to stand at, which hotspot to face (and glow), and whose line. `map`: the bar's Map glows too
const STOPS = [
  { line: 'cuddlecore', room: 'hall-middle', spot: 'door-cuddlecore' },
  { line: 'flourish', room: 'hall-middle', spot: 'door-flourish' },
  { line: 'sweet-spells', room: 'hall-middle', spot: 'door-sweet-spells' },
  { line: 'chiapothecary', room: 'hall-middle', spot: 'door-chiapothecary' },
  { line: 'conservatory', room: 'chiapothecary', spot: 'chia-glasshouse-door', door: true },
  { line: 'garden', room: 'glasshouse', spot: 'garden-door', door: true, map: true },
  { line: 'desk', room: 'hall-entrance', spot: 'checkin-desk', door: true, last: true },
];

export function install(inn) {
  const T = { ...STAND_IN, ...(inn.LINES.tour || {}), stops: { ...STAND_IN.stops, ...(inn.LINES.tour?.stops || {}) } };
  const root = document.createElement('div');
  root.id = 'tour';
  root.className = 'tour';
  root.hidden = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'A tour of the Inn');
  root.innerHTML = `<div class="tr-card">
      <img class="tr-who" src="explore/assets/gemma/avatar-56.png" srcset="explore/assets/gemma/avatar-112.png 2x" width="40" height="40" alt="">
      <p class="tr-line" aria-live="polite"></p>
      <div class="tr-foot">
        <span class="tr-dots" aria-hidden="true"></span><span class="sr-only tr-count"></span>
        <span class="tr-btns"><button type="button" class="tr-skip"></button><button type="button" class="tr-next"></button></span>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  $('.tr-dots').innerHTML = STOPS.map(() => '<i></i>').join('');
  let layer = null, at = -1, moving = false;
  inn.touring = false;

  const firstVisit = () => { try { return localStorage.getItem(OFFERED) !== '1'; } catch { return true; } };
  const markOffered = () => { try { localStorage.setItem(OFFERED, '1'); } catch { /* storage blocked: offered again next visit */ } };

  /** On arrival in the foyer (arrival.js): a first visit gets the offer. Returns true if she made it */
  function offer() {
    if (!firstVisit()) return false;
    markOffered();
    inn.track('tour_offer', {});
    inn.chatLine('gemma', T.offer);
    inn.setChips([{ label: T.yes, do: ['tour'] }, { label: T.no, do: ['tourNo'] }]);   // chips raise the chat from Line, so they show on phones
    return true;
  }
  inn.CHIP_ACTS.tour = () => start('arrival');
  inn.CHIP_ACTS.tourNo = () => { inn.track('tour_end', { how: 'declined', stop: 0 }); inn.offerCheckin({ line: T.declined }); };

  function glow(on) {
    const s = STOPS[at];
    for (const h of inn.hotspots) h.el.classList.toggle('tour-glow', !!on && h.id === s?.spot);
    inn.$('btn-map').classList.toggle('tour-glow', !!on && !!s?.map);
  }
  // Walk to a stop: through a door (its sound) into another room, or along the hall; then the view glides onto the spot
  function go(i) {
    glow(false);
    at = i;
    const s = STOPS[i];
    moving = true;
    if (s.room !== inn.state.room) {
      if (s.door) sound.door?.();
      const to = inn.ROOMS[s.room]?.spots?.[s.spot];
      inn.goRoom(s.room, to ? to.yaw - 30 : undefined, { quiet: true });
    }
    moving = false;
    const p = inn.spots[s.spot];
    if (p) {
      // A portrait phone facing the desk sees the notice board too (arrival.js); elsewhere the spot sits mid-view
      const portraitDesk = s.spot === 'checkin-desk' && innerWidth < innerHeight;
      inn.lookTo(portraitDesk ? 52 : p.yaw, portraitDesk ? -16 : p.pitch);
    }
    glow(true);
    $('.tr-line').textContent = T.stops[s.line];
    [...$('.tr-dots').children].forEach((d, k) => d.classList.toggle('on', k <= i));
    $('.tr-count').textContent = T.of.replace('{n}', i + 1).replace('{m}', STOPS.length);
    $('.tr-next').textContent = s.last ? T.checkin : T.next;
    $('.tr-skip').textContent = s.last ? T.notNow : T.skip;
    root.classList.toggle('last', !!s.last);
    place();
  }

  function start(src = 'arrival') {
    if (inn.touring) return;
    inn.endCheckinOffer();                            // the tour ends at the desk with its own offer
    inn.setChips([]);
    inn.touring = true;
    root.hidden = false;
    layer = layers.open({ el: root, name: 'tour', modal: false, close: how => end(how === 'outside' ? 'skip' : how) });
    inn.track('tour_start', { from: src });
    inn.chatLine('gemma', T.started);                 // her chat moves on from the offer (its line would sit there all tour)
    go(0);
    if (!reduce()) $('.tr-card').animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' });
    $('.tr-next').focus({ preventScroll: true });
  }
  // how: finished (Check in or Later at the desk), skip, escape, back, door (a door tapped), tap (anything else), walk (the
  // Inn map). Only Skip, Escape and Back say anything: a tap or a walk carries on into what was chosen
  function end(how) {
    if (!inn.touring) return;
    const stop = at + 1;
    glow(false);
    inn.touring = false;
    root.hidden = true;
    layers.closed(layer, { how: how === 'back' ? 'back' : 'self', refocus: ['skip', 'escape', 'back', 'finished'].includes(how) });
    layer = null;
    at = -1;
    layers.afterBack(() => inn.showRoomInUrl());      // the step back lands on the address from before the walk: say where they are now
    inn.track('tour_end', { how, stop });
    if (['skip', 'escape', 'back'].includes(how)) inn.offerCheckin({ line: T.skipped });
  }
  $('.tr-next').onclick = () => {
    if (!STOPS[at]?.last) return go(at + 1);
    end('finished');
    inn.tell.open('checkin', 'tour');                 // check-ins after a tour, against those without one
  };
  $('.tr-skip').onclick = () => {
    if (!STOPS[at]?.last) return end('skip');
    end('finished');
    inn.say(T.later, [], true);
  };

  // A tap on anything ends the tour, and the tap goes on (a door walks you in); so does walking off by the Inn map
  const touch = inn.touch;
  inn.touch = id => {
    if (inn.touring) end(inn.world.objects[id]?.type === 'door' || inn.world.objects[id]?.type === 'walk' ? 'door' : 'tap');
    return touch(id);
  };
  const goRoom = inn.goRoom;
  inn.goRoom = (id, yaw, opts) => {
    if (inn.touring && !moving) end('walk');
    return goRoom(id, yaw, opts);
  };

  // Under the bar, clear of the chat; the room's hotspots stay tappable around it
  function place() {
    const bar = document.querySelector('.bar')?.getBoundingClientRect();
    root.style.top = `${Math.round((bar?.bottom ?? 56) + 8)}px`;
  }
  addEventListener('resize', () => { if (!root.hidden) place(); });
  // "Show me round" on the bell's card (front-door.js), once the card has tucked away
  addEventListener('wa-tour', () => layers.whenFree(() => start('bell')));
  // The top bar's Tour button (25 Oct): the same tour, for showing a friend
  inn.$('btn-tour')?.addEventListener('click', () => layers.whenFree(() => start('bar')));

  inn.tour = { offer, start, end, get stop() { return at + 1; } };
}
