// Rooms and the wander (moved out of explore.html, architecture step 3): the time of day (deviceTime, timeNow, isNight),
// the season and hemisphere (seasonNow, askHemisphere), the trail the navigator reads (navTrail, record, lingering,
// countAtom), moving between rooms (goRoom, introduce, setRoomText) and the magic dial by every hallway door.
// The ROOMS table itself is the bootstrap's. Shared through `inn` (docs/code-map.md).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { localNavigate } from './navigator.js';
import { visit } from './visit-state.js';
import { sound } from './sound.js';

export function install(inn) {
  Object.assign(inn, { askHemisphere, countAtom, record, goRoom, introduce, setRoomText, openDial });   // its functions, for the other modules (hoisted)
  // ---------- time of day: the device's own, unless the visitor pushed the clock
  const bucketFor = h => (h < 5 || h >= 21) ? 'night' : h < 11 ? 'morning' : h < 17 ? 'midday' : 'evening';
  // With today's local sunrise and sunset (from /local-weather), it's night from half an hour after sunset until half an
  // hour before sunrise, so an October evening in Auckland goes dark at about 8.30 pm and a June one at 5.30 pm.
  // Without them, the fixed hours above (night from 9 pm to 5 am).
  const hours = t => { const [a, b] = t.split(':').map(Number); return a + b / 60; };
  const deviceTime = () => {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60, sun = inn.state.sun;
    if (!sun || hours(sun.set) <= hours(sun.rise)) return bucketFor(d.getHours());   // no sun times, or a sunset past midnight (far north in summer)
    if (h < hours(sun.rise) - 0.5 || h >= hours(sun.set) + 0.5) return 'night';
    return bucketFor(Math.min(Math.max(d.getHours(), 5), 20));
  }; inn.deviceTime = deviceTime;
  const timeNow = () => inn.state.time || deviceTime(); inn.timeNow = timeNow;
  const isNight = () => timeNow() === 'night'; inn.isNight = isNight;
  /** The trail the navigator sees: the device's time of day goes first, unless the visitor chose one. */
  // What the visitor told the Inn (the store) stands for the whole visit: it goes last, so it holds however long the trail gets
  // (the trail keeps 40 steps, and a candle picked early used to drop out of it)
  const navTrail = () => {
    const told = [...(visit.get('energy') ? [{ kind: 'energy', id: visit.get('energy') }] : []),
                  ...(visit.dish('chiapothecary', 'mood') ? [{ kind: 'mood', id: visit.dish('chiapothecary', 'mood') }] : [])];
    const trail = inn.state.trail.filter(e => e.kind !== 'energy');
    // The visitor's own season counts lightly, unless they've turned the wheel (that counts in full)
    const own = trail.some(e => e.kind === 'season') ? [] : [{ kind: 'own-season', id: seasonNow() }];
    return [...(trail.some(e => e.kind === 'time') ? [] : [{ kind: 'clock', id: deviceTime() }]), ...own, ...trail, ...told];
  }; inn.navTrail = navTrail;

  // ---------- season: a good guess from where the visitor seems to be, never a lock (docs/inn-floorplan.html)
  // North of the equator March to May is spring; south of it, September to November. Only the guess is used, in the page.
  const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  const FLIP = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
  const seasonFor = hemi => { const n = NORTH[new Date().getMonth()]; return hemi === 'south' ? FLIP[n] : n; }; inn.seasonFor = seasonFor;
  const SOUTH_TZ = /^(Australia\/|Antarctica\/|Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Norfolk|Tahiti|Rarotonga|Pago_Pago|Port_Moresby|Guadalcanal|Niue|Wallis|Funafuti|Easter)|America\/(Argentina\/|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Recife|Fortaleza|Belem|Maceio|Araguaina|Campo_Grande|Cuiaba|Porto_Velho|Rio_Branco|Punta_Arenas|Noronha)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi|Luanda|Dar_es_Salaam|Kinshasa|Kigali|Bujumbura)|Indian\/(Mauritius|Reunion|Antananarivo|Comoro|Mayotte)|Atlantic\/(St_Helena|Stanley|South_Georgia))/;
  const tzHemisphere = () => { try { return SOUTH_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '') ? 'south' : 'north'; } catch { return 'north'; } };
  inn.seasonGuess = seasonFor(tzHemisphere());
  inn.state.season = inn.state.season || null;        // a season the visitor turned the wheel to, or null for their own
  const seasonNow = () => inn.state.season || inn.seasonGuess; inn.seasonNow = seasonNow;
  // The rough latitude Cloudflare attaches to the visit (via the Worker) beats the time zone, when it answers.
  // Asked once, on the way to the Conservatory; nothing about it is kept.
  let hemiAsked = null;
  function askHemisphere() {
    return hemiAsked || (hemiAsked = (async () => {
      try {
        const r = await fetch(`${inn.GENIE_URL}/hemisphere`, { signal: AbortSignal.timeout(2500) });
        const { hemisphere } = r.ok ? await r.json() : {};
        if (hemisphere !== 'north' && hemisphere !== 'south') return;
        const guess = seasonFor(hemisphere);
        if (guess === inn.seasonGuess) return;
        inn.seasonGuess = guess;
        if (!inn.state.season && inn.room().seasons) inn.showWeather(inn.state.weather);
      } catch { /* the time zone's guess stands */ }
    })());
  }
  // ---------- trail + lingering
  const label = id => inn.world.objects[id]?.label || id; inn.label = label;
  const lingered = {};
  const SYS = {
    touch: e => `You went to ${inn.world.objects[e.id]?.ref || label(e.id)}`,
    weather: e => `You turned the barometer to ${inn.world.weathers[e.id]?.label}`,
    time: e => `You pushed the clock to ${inn.world.times[e.id]?.label.toLowerCase()}`,
    season: e => `You turned the seasons wheel to ${inn.world.seasons[e.id]?.label.toLowerCase()}`,
    energy: e => `You picked the ${inn.world.energies[e.id]?.candle}`,
    choose: e => `You chose ${inn.world.clusters[e.cluster]?.label}`,
    room: e => `You went into ${inn.ROOMS[e.id]?.title.replace(/^The /, 'the ')}`,
    dial: e => `You turned the dial to ${e.id}`,
    dismiss: e => `You set aside "${inn.atomsById[e.atom]?.title}"`,
    keep: e => `You kept "${inn.atomsById[e.atom]?.title}"`,
    recipe: e => `Gemma wrote out "${inn.atomsById[e.atom]?.title}"`,
  };
  // ---------- counting (docs/analytics-plan.md): what happens to the site, never the wander itself
  const stepNow = () => inn.stepBucket(inn.state.trail.length); inn.stepNow = stepNow;
  const servedBy = {}; inn.servedBy = servedBy;                      // which navigator served each card, kept for this page only
  function countAtom(name, atom, more = {}) {
    inn.track(name, { atom, atom_kind: inn.atomsById[atom]?.kind, nav_mode: servedBy[atom] || inn.state.result?.mode || (inn.AI ? 'ai' : 'local'),
                  room: inn.state.room, step: stepNow(), ...more });
  }

  function record(e) {
    if (SYS[e.kind]) inn.chatLine('sys', SYS[e.kind](e));
    inn.state.trail.push({ ...e, t: Date.now() });
    inn.state.trail = inn.state.trail.slice(-40);
    inn.store.save(inn.state);
    inn.renderNotes();
    if (e.kind !== 'room' && e.kind !== 'dial') inn.scheduleNavigate();   // walking about isn't a mood
  }
  setInterval(() => {
    inn.erwina?.tick({ still: !inn.drag && !document.hidden && performance.now() - inn.lastMove >= 1000 });   // the cat looks for a still second
    if (!inn.hasLooked || inn.drag || document.hidden || performance.now() - inn.lastMove < 2000) return;
    const centre = inn.dir(inn.look.yaw, inn.look.pitch);
    for (const h of inn.hotspots) {
      const ang = THREE.MathUtils.radToDeg(centre.angleTo(h.v.clone().normalize()));
      if (ang < 11 && (!lingered[h.id] || Date.now() - lingered[h.id] > 30000)) {
        lingered[h.id] = Date.now();
        record({ kind: 'linger', id: h.id });
      }
    }
  }, 300);
  // ---------- moving between rooms
  function goRoom(id, yaw) {
    if (!inn.ROOMS[id] || id === inn.state.room) return;
    const from = inn.state.room;
    inn.state.room = id;
    inn.showRoomInUrl();
    sound.place(id);
    inn.spots = inn.room().spots;
    inn.look.yaw = yaw ?? inn.room().yaw ?? 0;
    inn.look.pitch = inn.room().pitch ?? -6;                    // a stop may look a little lower on arrival (Flourish: its low table clears the chat)
    setRoomText();
    inn.buildHotspots();
    inn.fillMap();
    inn.showClock();
    inn.showWeather(inn.state.weather);
    record({ kind: 'room', id });
    inn.track('room_enter', { room: id, from_room: from, step: stepNow() });
    if (inn.state.result) inn.applyReveal(inn.state.result.reveal);
    inn.render();
    if (id !== 'cuddlecore') askHemisphere();
    if (inn.room().seasons && !inn.state.seasonTold) {
      // First time in the Conservatory: say which season it opened in, and that the wheel changes it
      inn.state.seasonTold = true;
      askHemisphere().then(() => inn.say(inn.state.season
        ? `It's set to ${inn.state.season}. The wheel by the door turns it to any season.`
        : `It's ${inn.seasonGuess} where you are, I think. The wheel by the door turns it to any season.`, [], true));
    }
    introduce(id);
    inn.chatUI.flashTags();                          // what you've told Gemma shows for a moment on arrival (Inn rule 11)
  }
  // First time in a room this visit: Gemma says what it's for, in the words of its blurb (ux-journey J3).
  // From goRoom, on arrival once the weather question is answered (or straight away if she didn't ask one), and on the
  // first touch in the room if the question was left unanswered
  function introduce(id = inn.state.room) {
    const intro = { cuddlecore: inn.world.intro, flourish: inn.flWorld.intro, 'sweet-spells': inn.sweetWorld.intro, chiapothecary: inn.chiaWorld.intro }[id];
    if (intro && !(inn.state.introduced ||= []).includes(id)) { inn.state.introduced.push(id); inn.say([intro, inn.entryFact(id)].filter(Boolean).join(' '), [], true); }
  }
  function setRoomText() {
    inn.$('room-title').textContent = inn.room().title;
    inn.$('cw-title').textContent = `Gemma · ${inn.room().title}`;
    inn.$('cw-where').textContent = inn.room().where;
    if (inn.$('front-door').hidden) document.title = `WhiskedAway · ${inn.room().title}`;   // at the front door it stays the Inn's name
  }

  // ---------- the magic dial beside every hallway door: any room, or wherever the wander points
  function openDial() {
    const opts = inn.hallWorld.dial.concat([{ label: 'Wherever my wander points', star: true }]);
    inn.$('roomdial').innerHTML = opts.map((o, i) => `<button data-i="${i}"${o.blurb ? ` aria-label="${inn.esc(o.label)}: ${inn.esc(o.blurb)}"` : ''}>${o.star ? '✦ ' : ''}${inn.esc(o.label)}${o.blurb ? `<span class="blurb">${inn.esc(o.blurb)}</span>` : ''}</button>`).join('');
    inn.$('roomdial').querySelectorAll('button').forEach(b => b.onclick = () => turnDial(opts[+b.dataset.i]));
    inn.showDialog('dialdlg');
  }
  function turnDial(o) {
    inn.hideDialog('dialdlg');
    record({ kind: 'dial', id: o.star ? 'the star' : o.label });
    inn.track('dial_turn', { dial_choice: o.star ? 'star' : o.go || 'closed' });
    // The star opens the room whose reading the wander leans to (the room identities, content stage 3): juices, smoothies,
    // quick breakfasts and comfort are Cuddlecore's; whole-food meals and busy hands Flourish's; anything sweet, frozen or
    // baked Sweet Spells'; the pudding superpowers the Chiapothecary's. A wander that hasn't said much yet opens Cuddlecore.
    const lean = localNavigate(navTrail(), inn.world, { ...inn.steer(), dismissed: inn.state.dismissed }).cluster;
    const STAR_OVERRIDES = { sweet: 'sweet-spells', 'hands-on': 'flourish' };   // Cuddlecore readings that belong next door
    const starGo = STAR_OVERRIDES[lean] || inn.world.clusters[lean]?.room || 'cuddlecore';
    const go = o.star ? starGo : o.go;
    if (!go) return inn.say((inn.LINES.dial?.closed || '{label} is only engraved on the dial. There is no door behind it.').replace('{label}', o.label), [], true);
    if (go === inn.state.room) return inn.say("You're already here.", [], true);
    const starSays = { flourish: 'Your wander says Flourish. In you go.', 'sweet-spells': 'Your wander says Sweet Spells. In you go.',
                       chiapothecary: 'Your wander says the Chiapothecary. In you go.' };
    inn.say(o.star ? (starSays[go] || 'Your wander says Cuddlecore. In you go.') : 'In you go.', [], true);
    setTimeout(() => goRoom(go), 700);
  }
  inn.$('dial-ok').onclick = () => inn.hideDialog('dialdlg');

  // Taps (explore/touch.js): doors and walks (a closed door says so; a door out of the Inn says goodbye first), and the
  // hallway's magic dial
  inn.onTouch(80, obj => obj.type === 'door' || obj.type === 'walk', (obj, id) => {
    if (!obj.go) {
      inn.track('door_closed', { room: inn.state.room, object: id });
      inn.say(obj.closed || "That one's not open yet.", [], true);
      return true;
    }
    if (obj.type === 'door') sound.door();
    if (obj.go.startsWith('/')) {
      inn.track('leave_to_inn', { room: inn.state.room, step: stepNow() });
      inn.say(obj.leaving || 'Mind the step, love.', [], true);
      setTimeout(() => { location.href = obj.go === '/' ? '/?door=1' : obj.go; }, 1200);   // "/" alone would skip the door (J6)
      return true;
    }
    goRoom(obj.go, obj.arrive_yaw);
  });
  inn.onTouch(90, obj => obj.type === 'dial', () => { openDial(); });
}
