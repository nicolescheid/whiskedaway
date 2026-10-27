// "Shall we sit down for a chat?" (Nicole, 26 Oct). After the check-in's Done, Gemma offers to walk the visitor to Cuddlecore and
// point out where to tell her about themselves: the food map, the tray and cage, the bell jar, the dietary-needs books and the
// appliances. One short line a step, the object glowing, Next and Skip and a dot row, like the tour.
//   - the offer is the tour card's own look (tour.css), asked once a browser (localStorage wa-chat-offered); Later (or a
//     Skip mid-chat) leaves "Sit down for a chat" on the bell's card (localStorage wa-chat-bell; front-door.js sends wa-sitdown)
//   - a layer over a live room (layers.js, modal: false): Escape and Back end it and take the visitor home; Skip stays where
//     they stand; a tap on anything ends it and the tap goes on (tapping the glowing object opens its sheet)
//   - rooms it walks into are entered quietly (goRoom { quiet }) and inn.chatting stops lingering, so it never steers the navigator
// Gemma's lines are content's: gemma-lines.json `sitdown`; these stand in for any it doesn't have.
import { sound } from './sound.js';
import { layers } from './layers.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const OFFERED = 'wa-chat-offered';
const ON_BELL = 'wa-chat-bell';                      // front-door.js reads it: the bell offers the chat only after a Later or Skip
const STAND_IN = {
  offer: 'Shall we sit down for a chat?', yes: 'Yes, please', later: 'Later',
  started: "Come and sit in Cuddlecore. I'll show you where to tell me about yourself.",
  declined: 'Right you are. The bell has it, whenever you want to sit down.',
  skipped: 'No bother. The bell has it, any time.',
  next: 'Next', skip: 'Skip', done: 'Done', of: '{n} of {m}',
  steps: {
    map: 'That map: Home, Family, Love the food. Tell me where your cooking comes from.',
    tray: "The tray is How you like it. The little cage keeps out what you'd rather not see.",
    jar: "The bell jar is for following what your doctor or pharmacist told you. I'll keep it out.",
    books: "The dietary-needs books. Tell me yours and I'll cook around them.",
    kitchen: "These are Your kitchen. Tell me what you've got and I'll suggest what you can make.",
    end: "You'll find other things around the Inn to touch, too.",
  },
};
// The steps: which hotspots glow (the view turns to the middle of them), and whose line. Cuddlecore is where they all are
const STEPS = [
  { line: 'map', spots: ['locale-map'] },
  { line: 'tray', spots: ['feels-tray', 'cage'] },
  { line: 'jar', spots: ['bell-jar'] },
  { line: 'books', spots: ['dietary-shelf'] },
  { line: 'kitchen', spots: ['microwave', 'air-fryer'] },
  { line: 'end', spots: [], last: true },
];

export function install(inn) {
  const T = { ...STAND_IN, ...(inn.LINES.sitdown || {}), steps: { ...STAND_IN.steps, ...(inn.LINES.sitdown?.steps || {}) } };
  const root = document.createElement('div');
  root.id = 'sitdown';
  root.className = 'tour sitdown';
  root.hidden = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'A chat with Gemma');
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
  inn.chatting = false;
  let steps = [], at = -1, layer = null, home = null, offering = false, offerLayer = null, moving = false;

  const asked = () => { try { return localStorage.getItem(OFFERED) === '1'; } catch { return false; } };
  const markAsked = () => { try { localStorage.setItem(OFFERED, '1'); } catch { /* storage blocked: asked again next time */ } };
  const onBell = () => { try { localStorage.setItem(ON_BELL, '1'); } catch { /* storage blocked: the bell won't offer it */ } };

  // The offer, after a check-in's Done (tell-glue.js): once a browser, and not over the tour or another chat
  function offer() {
    if (asked() || offering || inn.chatting || inn.touring) return;
    offering = true;
    layers.whenFree(() => {
      if (!offering || inn.chatting || inn.touring) return;
      markAsked();
      root.classList.add('offer');
      $('.tr-line').textContent = T.offer;
      $('.tr-next').textContent = T.yes;
      $('.tr-skip').textContent = T.later;
      root.hidden = false;
      offerLayer = layers.open({ el: root, name: 'sitdown-offer', modal: false, close: how => answer(how === 'back' || how === 'escape' ? how : 'ignored') });
      place();
    });
  }
  // Leave the offer: Yes starts the chat; Later, Escape and Back decline with her line; a tap on anything else lets it go quietly
  function answer(how) {
    if (!offering) return;
    offering = false;
    root.hidden = true;
    root.classList.remove('offer');
    const l = offerLayer;
    offerLayer = null;
    if (l) layers.closed(l, { how: how === 'back' ? 'back' : 'self', refocus: how !== 'ignored' && how !== 'yes' });
    if (how === 'yes') return;
    inn.track('chat_end', { how: how === 'ignored' ? 'ignored' : how === 'later' ? 'later' : how, step: 0 });
    if (how !== 'ignored') { onBell(); inn.say(T.declined, [], true); }
  }

  const glowTo = ids => {
    for (const h of inn.hotspots) h.el.classList.toggle('tour-glow', ids.includes(h.id));
  };
  function go(i) {
    at = i;
    const s = steps[i];
    glowTo([]);
    const here = s.spots.filter(id => inn.spots?.[id]);
    if (here.length) {
      const ps = here.map(id => inn.spots[id]);
      inn.lookTo(ps.reduce((a, p) => a + p.yaw, 0) / ps.length, ps.reduce((a, p) => a + p.pitch, 0) / ps.length);
    }
    glowTo(here);
    $('.tr-line').textContent = T.steps[s.line];
    [...$('.tr-dots').children].forEach((d, k) => d.classList.toggle('on', k <= i));
    $('.tr-count').textContent = T.of.replace('{n}', i + 1).replace('{m}', steps.length);
    $('.tr-next').textContent = s.last ? T.done : T.next;
    root.classList.toggle('last', !!s.last);
    place();
  }

  function start(src = 'offer') {
    if (inn.chatting || inn.touring) return;
    if (offering) answer('yes');
    inn.endCheckinOffer?.();
    inn.setChips([]);
    inn.chatting = true;
    home = { room: inn.state.room, yaw: inn.look.yaw, pitch: inn.look.pitch };
    if (inn.state.room !== 'cuddlecore') {
      sound.door?.();
      moving = true;
      inn.goRoom('cuddlecore', undefined, { quiet: true });
      moving = false;
    }
    steps = STEPS.filter(s => s.spots.length === 0 || s.spots.some(id => inn.spots?.[id]));   // the bell jar is a step only while it's there
    $('.tr-dots').innerHTML = steps.map(() => '<i></i>').join('');
    root.classList.remove('offer');
    $('.tr-skip').textContent = T.skip;
    root.hidden = false;
    layer = layers.open({ el: root, name: 'sitdown', modal: false, close: how => end(how === 'outside' ? 'skip' : how) });
    inn.track('chat_start', { from: src });
    inn.chatLine('gemma', T.started);
    go(0);
    if (!reduce()) $('.tr-card').animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' });
    $('.tr-next').focus({ preventScroll: true });
  }
  // how: finished (Done), skip, escape, back, door (a door tapped), tap (anything else), walk (the Inn map). Only Skip, Escape
  // and Back say anything; a tap or a walk carries on into what was chosen
  function end(how) {
    if (!inn.chatting) return;
    const step = at + 1;
    glowTo([]);
    inn.chatting = false;
    root.hidden = true;
    layers.closed(layer, { how: how === 'back' ? 'back' : 'self', refocus: ['skip', 'escape', 'back', 'finished'].includes(how) });
    layer = null;
    at = -1;
    if (['escape', 'back'].includes(how) && home && home.room !== inn.state.room) {
      moving = true;
      inn.goRoom(home.room, home.yaw, { quiet: true });
      moving = false;
      inn.lookTo(home.yaw, home.pitch);
    }
    layers.afterBack(() => inn.showRoomInUrl());
    inn.track('chat_end', { how, step });
    if (['skip', 'escape', 'back'].includes(how)) onBell();
    if (how === 'skip') inn.say(T.skipped, [], true);
  }
  $('.tr-next').onclick = () => {
    if (offering) return start('offer');
    if (!steps[at]?.last) return go(at + 1);
    end('finished');
  };
  $('.tr-skip').onclick = () => {
    if (offering) return answer('later');
    end('skip');
  };

  const touch = inn.touch;
  inn.touch = id => {
    if (offering) answer('ignored');
    if (inn.chatting) end(inn.world.objects[id]?.type === 'door' || inn.world.objects[id]?.type === 'walk' ? 'door' : 'tap');
    return touch(id);
  };
  const goRoom = inn.goRoom;
  inn.goRoom = (id, yaw, opts) => {
    if (offering) answer('ignored');
    if (inn.chatting && !moving) end('walk');
    return goRoom(id, yaw, opts);
  };

  function place() {
    const bar = document.querySelector('.bar')?.getBoundingClientRect();
    root.style.top = `${Math.round((bar?.bottom ?? 56) + 8)}px`;
  }
  addEventListener('resize', () => { if (!root.hidden) place(); });
  // "Sit down for a chat" on the bell's card (front-door.js), once the card has tucked away
  addEventListener('wa-sitdown', () => (offering ? start('bell') : layers.whenFree(() => start('bell'))));

  inn.sitdown = { offer, start, end, get step() { return at + 1; }, get offering() { return offering; } };
}
