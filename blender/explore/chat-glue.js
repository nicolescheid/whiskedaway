// Gemma's chat glue (moved out of explore.html, architecture step 3): her lines in the chat (say, chatLine), the chips
// under them (setChips, CHIP_ACTS), "Gemma is typing…", and the sound chip. The chat's sizes are explore/chat.js's.
// Shared through `inn` (docs/code-map.md): other modules call inn.say(...), inn.setChips(...).
import { sound } from './sound.js';
import { createChat } from './chat.js';

export function install(inn) {
  Object.assign(inn, { renderChat, chatLine, setChips, thinking, say });   // its functions, for the other modules (hoisted)
  // ---------- Gemma's chat, in three sizes (explore/chat.js): Line, Short and Full; her newest line shows in every size
  const chatUI = createChat({ win: inn.$('chatwin'), track: inn.track }); inn.chatUI = chatUI;
  function clockLabel() {
    // Timestamps follow the kitchen clock: the visitor's own time, or the time they pushed it to
    let d = new Date();
    if (inn.state.time) {
      const h = inn.world.times[inn.state.time].hour;
      // the pushed time, moving on as real minutes pass since the push (it used to add a minute per message and drift)
      const since = (Date.now() - (inn.state.timeSetAt || Date.now())) / 60000;
      d = new Date(); d.setHours(Math.floor(h), Math.round((h % 1) * 60 + since), 0);
    }
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  function renderChat() {
    const log = inn.$('cw-log');
    log.innerHTML = inn.state.chat.map(m => m.who === 'sys'
      ? `<div class="cw-sys">${inn.esc(m.text)}</div>`
      : `<div class="cw-who">Gemma · ${inn.esc(m.at)}</div><div class="cw-msg">${inn.esc(m.text)}</div>`).join('');
    chatUI.update(inn.state.chat);                   // her newest line, and the log follows the bottom unless the visitor scrolled up
    inn.fitDock();                                // the chat may have grown: a phone that throttles ResizeObserver still gets it
  }
  function chatLine(who, text) {
    if (!text) return;
    const last = [...inn.state.chat].reverse().find(m => m.who === who);
    if (who === 'gemma' && last?.text === text) return;            // don't repeat herself
    inn.state.chat.push({ who, text, at: clockLabel() });
    inn.state.chat = inn.state.chat.slice(-60);
    renderChat();
    if (who === 'gemma') sound.shimmer();
    inn.store.save(inn.state);
  }
  // Chips are data ({ label, do: [action, ...args] }), so the last question's answers are kept with the visit and come
  // back after a reload (J9)
  const CHIP_ACTS = {
    checkin: () => { inn.endCheckinOffer(); inn.tell.open('checkin', 'foyer'); },   // the check-in sheet (the Ideas build's)
    choose: cluster => inn.record({ kind: 'choose', cluster }),
    tell: () => inn.tell.openMenu('offer'),                   // "Want to tell me what's in your cupboard…?" [Tell me]
    later: () => inn.endCheckinOffer(),                                      // [Not now]: the offer is over for the visit
    weather: id => inn.chooseWeather(id),
    barometer: () => { const s = inn.spots.barometer; if (s) inn.lookTo(s.yaw, s.pitch); setTimeout(inn.openWeather, 750); },
    confirm: () => { say("Good. I've set the Inn to match.", [], true); inn.track('weather_guess', { weather: inn.state.weather, outcome: 'confirmed' }); inn.introduce(); },
  }; inn.CHIP_ACTS = CHIP_ACTS;
  function setChips(chips) {
    const box = inn.$('cw-chips');
    box.innerHTML = '';
    inn.state.chips = chips.filter(c => CHIP_ACTS[c.do?.[0]]);
    inn.store.save(inn.state);
    for (const c of inn.state.chips) {
      const b = document.createElement('button');
      b.textContent = c.label;
      b.onclick = () => { box.innerHTML = ''; inn.state.chips = []; inn.store.save(inn.state); chatUI.setAsking(false); inn.fitDock(); CHIP_ACTS[c.do[0]](...c.do.slice(1)); };
      box.appendChild(b);
    }
    chatUI.setAsking(inn.state.chips.length > 0);    // a question raises Line to Short until it's answered
    inn.fitDock();                                // chips change the chat's height (ResizeObserver covers it too, when frames run)
  }
  // "Gemma is typing…" shows while she types a line, or while the AI navigator is reading the wander
  let typingLine = false, aiThinking = false;
  const showTyping = () => { inn.$('cw-typing').hidden = !(typingLine || aiThinking); inn.fitDock(); };
  function typing(on) { typingLine = on; showTyping(); }
  function thinking(on) { aiThinking = on; showTyping(); }
  let sayTimer;
  let sayPending = null;
  function say(text, fork = [], brief = false) {
    // Locally Gemma takes a beat to "type"; with the AI on, the typing indicator already covered the wait
    clearTimeout(sayTimer);
    sayPending?.();                       // a line still waiting (an object's own moment) goes out first, never replaced
    const post = () => {
      sayPending = null;
      typing(false);
      chatLine('gemma', text);
      setChips(fork.filter(c => inn.world.clusters[c]).map(c => ({ label: inn.world.clusters[c].label.replace(/^./, x => x.toUpperCase()), do: ['choose', c] })));
    };
    if (inn.AI && !brief) return post();
    typing(true);
    sayPending = post;
    sayTimer = setTimeout(post, brief ? 350 : 650);
  }

  // Sound (explore/sound.js): off until the visitor turns it on, with the speaker by the bell or here in the chat
  const soundLabel = () => {
    inn.$('cw-sound').textContent = sound.on ? 'Sound: on' : 'Sound: off';
    inn.$('btn-sound').setAttribute('aria-pressed', String(sound.on));
  }; inn.soundLabel = soundLabel;
  inn.$('cw-sound').onclick = inn.$('btn-sound').onclick = () => sound.toggle();
  addEventListener('wa-sound', soundLabel);
  // Every dial in the Inn clicks round a notch when you turn it
  document.addEventListener('click', e => { if (e.target.closest('.dial button')) sound.tick(); });
  // The grandfather clock ticks in the hallway, and on your own time strikes when the hour turns
  sound.place(inn.state.room);
  let lastHour = new Date().getHours();
  setInterval(() => { const h = new Date().getHours(); if (h !== lastHour && !inn.state.time) sound.strike(h); lastHour = h; }, 20000);
  inn.$('cw-credits').onclick = () => inn.showDialog('credits');
  inn.$('credits-ok').onclick = () => inn.hideDialog('credits');
}
