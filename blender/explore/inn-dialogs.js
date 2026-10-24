// The Inn's small dialogs (moved out of explore.html, architecture step 3): showDialog and hideDialog (each one a layer,
// explore/layers.js), the tool card (openTool), the barometer (openWeather, chooseWeather), the clock (openClock,
// chooseTime) and the seasons wheel (openSeasons, chooseSeason). Shared through `inn` (docs/code-map.md).
import { sound } from './sound.js';
import { layers } from './layers.js';

export function install(inn) {
  Object.assign(inn, { openTool, showDialog, hideDialog, openWeather, chooseWeather, openClock, chooseTime, openSeasons, chooseSeason });   // its functions, for the other modules (hoisted)
  function openTool(title, text) { inn.$('tool-title').textContent = title; inn.$('tool-text').textContent = text; showDialog('tool'); }
  inn.$('tool-ok').onclick = () => hideDialog('tool');

  // ---------- the Inn's small dialogs (.tool: the barometer, clock, dial, seasons wheel, credits): each one a layer
  // (explore/layers.js), which owns their history step, Escape, Tab, inert and focus. The welcome card is front-door.js's own
  function showDialog(id) {
    const d = inn.$(id);
    if (!layers.isOpen(d)) {                                  // open already (the seasons wheel redraws itself): just the focus
      d.classList.add('open');
      layers.open({ el: d, name: id, close: () => hideDialog(id) });
    }
    (d.querySelector('.dial .on') || d.querySelector('.dial button, .ok'))?.focus();
  }
  function hideDialog(id) {
    const d = inn.$(id);
    if (!d.classList.contains('open')) return;
    d.classList.remove('open');
    layers.closed({ el: d, name: id });
  }
  // The welcome card keeps Tab inside it
  addEventListener('keydown', e => {
    const d = inn.$('welcome')?.classList.contains('open') ? inn.$('welcome') : null;
    if (e.key === 'Tab' && d) {
      const f = [...d.querySelectorAll('button, a[href]')].filter(x => !x.disabled && x.offsetParent), i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    }
  }, true);

  // ---------- barometer
  function openWeather() {
    inn.$('dial').innerHTML = Object.entries(inn.world.weathers).map(([id, w]) =>
      `<button data-w="${inn.esc(id)}" class="${id === inn.state.weather ? 'on' : ''}" aria-pressed="${id === inn.state.weather}">${inn.esc(w.label)}</button>`).join('');
    inn.$('dial').querySelectorAll('button').forEach(b => b.onclick = () => chooseWeather(b.dataset.w));
    showDialog('weather');
  }
  function chooseWeather(id, { quiet = false } = {}) {
    if (!inn.world.weathers[id]) return;
    inn.$('dial').querySelectorAll('button').forEach(b => { const on = b.dataset.w === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (id === inn.state.weather) return inn.introduce();
    inn.state.weather = id;
    inn.state.weatherFrom = 'visitor';
    inn.showWeather(id);
    if (!quiet) inn.say(inn.world.weathers[id].moment, [], true);
    inn.record({ kind: 'weather', id });
    inn.track('weather_change', { room: inn.state.room, weather: id });
    inn.introduce();
  }
  inn.$('weather-ok').onclick = () => hideDialog('weather');

  // ---------- clock
  function openClock() {
    const mine = inn.deviceTime();
    inn.$('clock-text').textContent = `Where you are, it's ${inn.world.times[mine].label.toLowerCase()}. Push the hands to whatever time you're cooking for.`;
    renderClock();
    showDialog('clockdlg');
  }
  // The clock's buttons (QA R5): the time in effect is pressed (the pushed one, or the visitor's own when they haven't pushed
  // it), the visitor's own time says so on the button, and "Back to my time" appears as soon as the hands have moved
  function renderClock() {
    const mine = inn.deviceTime(), now = inn.state.time || mine, focused = document.activeElement?.closest?.('#clockdial button')?.dataset.t;
    const opts = Object.entries(inn.world.times).map(([id, t]) => ({ id, label: t.label })).concat(inn.state.time ? [{ id: '', label: 'Back to my time' }] : []);
    inn.$('clockdial').innerHTML = opts.map(o => `<button data-t="${inn.esc(o.id)}" class="${o.id && o.id === inn.state.time ? 'on' : ''}${o.id === mine ? ' mine' : ''}" aria-pressed="${!!o.id && o.id === now}">${inn.esc(o.label)}${o.id === mine ? '<span class="your-time"> (your time)</span>' : ''}</button>`).join('');
    inn.$('clockdial').querySelectorAll('button').forEach(b => b.onclick = () => chooseTime(b.dataset.t || null));
    if (focused !== undefined) (inn.$('clockdial').querySelector(`[data-t="${CSS.escape(focused)}"]`) || inn.$('clockdial').querySelector('[aria-pressed="true"]'))?.focus();
  }
  function chooseTime(id) {
    if (id === inn.state.time) return;
    inn.state.time = id;
    inn.state.timeSetAt = id ? Date.now() : null;
    if (id) inn.track('time_change', { room: inn.state.room, time_of_day: id });
    inn.setHands(inn.handsHour());
    inn.showWeather(inn.state.weather);                                        // re-light: tint, or the night render
    if (inn.$('clockdlg').classList.contains('open')) renderClock();
    if (id) {
      sound.strike(inn.world.times[id].hour);                              // the grandfather clock, if you're in the hall
      inn.say(inn.world.times[id].moment, [], true);
      inn.record({ kind: 'time', id });
    } else {
      inn.track('time_change', { room: inn.state.room, time_of_day: 'own' });
      inn.say(`Back to your own time: ${inn.world.times[inn.deviceTime()].label.toLowerCase()}.`, [], true);
      inn.state.trail = inn.state.trail.filter(e => e.kind !== 'time');
      inn.store.save(inn.state);
      inn.scheduleNavigate();
    }
  }
  inn.$('clock-ok').onclick = () => hideDialog('clockdlg');

  // ---------- seasons wheel: the Conservatory opens in the visitor's season; the wheel shows any other
  function openSeasons() {
    inn.$('season-text').textContent = `Where you are, it's probably ${inn.seasonGuess}. Turn the wheel to see the Conservatory in any season.`;
    const opts = Object.entries(inn.world.seasons).map(([id, s]) => ({ id, label: s.label }))
      .concat(inn.state.season ? [{ id: '', label: 'Back to my season' }] : []);
    inn.$('seasondial').innerHTML = opts.map(o => `<button data-s="${inn.esc(o.id)}" class="${o.id && o.id === inn.seasonNow() ? 'on' : ''}" aria-pressed="${!!o.id && o.id === inn.seasonNow()}">${inn.esc(o.label)}</button>`).join('');
    inn.$('seasondial').querySelectorAll('button').forEach(b => b.onclick = () => chooseSeason(b.dataset.s || null));
    showDialog('seasondlg');
  }
  function chooseSeason(id) {
    if (id && !inn.world.seasons[id]) return;
    if (id === inn.state.season) return;
    const before = inn.seasonNow();
    inn.state.season = id;
    if (inn.seasonNow() !== before) inn.showWeather(inn.state.weather);
    if (id) {
      inn.say(inn.world.seasons[id].moment, [], true);
      inn.record({ kind: 'season', id });
      inn.track('season_change', { season: id });
    } else {
      inn.track('season_change', { season: 'own' });
      inn.say(`Back to your own season: ${inn.seasonGuess}.`, [], true);
      inn.state.trail = inn.state.trail.filter(e => e.kind !== 'season');
      inn.store.save(inn.state);
      inn.scheduleNavigate();
    }
    if (inn.$('seasondlg').classList.contains('open')) openSeasons();   // show or drop "Back to my season"
  }
  inn.$('season-ok').onclick = () => hideDialog('seasondlg');

  // Taps (explore/touch.js): the barometer, the clock and the seasons wheel open their dials
  inn.onTouch(70, obj => ['weather', 'time', 'season'].includes(obj.type), obj => {
    ({ weather: openWeather, time: openClock, season: openSeasons })[obj.type]();
  });
}
